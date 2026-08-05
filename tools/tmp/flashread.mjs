#!/usr/bin/env node
/**
 * flashread — what the HIT FLASH does to the character's own value structure.
 *
 * ── Why ──────────────────────────────────────────────────────────────────────
 * A peer measured the game's four feel channels across its full damage span (2 ->
 * 18, a 9.0x input) and found the hit flash is the LOUDEST channel and has **1.00x**
 * dynamic range — bit-identical at a chip and at a near-kill (4132 px vs 4113 px).
 * `BaseCharacter.play` was throwing `opts.intensity` away.
 *
 * Honouring it needs two numbers, not one: how far the flash should fall for a
 * light hit, and how far it should reach for a heavy one. The second is the one
 * nobody had measured. A blind critic in the same week named the outline as "the
 * entire read", and a full-white flash erases every value step inside that outline
 * — so the ceiling is not a taste call, it is a question about how much of the
 * character survives.
 *
 * This applies EXACTLY what `applyHitFlash` applies — `emissive.lerp(white, f)` on
 * every non-outline material of the player — at a sweep of `f`, in the live match at
 * the shipped camera, and reports what is left:
 *
 *   range / p05 / p95   the character's own value ladder, the thing the whole value
 *                       pass bought (p05 0.273 -> 0.157 against a reference 0.097)
 *   steps               distinct 0.10-wide luma buckets the character occupies —
 *                       "is there still internal structure or is it one slab"
 *   dL                  figure/ground against the surrounding floor. A white
 *                       character on a bright floor loses its edge, which is the
 *                       failure mode that matters at the exact instant a player is
 *                       looking hardest.
 *
 *   node tools/tmp/headserve.mjs --overlay src/characters -- node tools/tmp/flashread.mjs
 */
import { chromium } from 'playwright';

const a = process.argv;
const get = (k, d) => (a.includes(k) ? a[a.indexOf(k) + 1] : d);
const BASE = process.env.PREVIEW_BASE ?? process.env.HEADSERVE_URL ?? get('--url', null);
const IDS = get('--ids', 'egg,hamburger,donut').split(',');
const FS = get('--flash', '0,0.15,0.30,0.45,0.60,0.85').split(',').map(Number);
const STATION = { x: 700, y: 640, fog: 850 };

const LAUNCH_ARGS = ['--use-gl=angle', '--use-angle=swiftshader', '--enable-unsafe-swiftshader',
  '--enable-webgl', '--ignore-gpu-blocklist', '--disable-gpu-sandbox'];
const HMR_STUB = `const noop=()=>{};
export const createHotContext=()=>({accept:noop,acceptExports:noop,dispose:noop,prune:noop,
  invalidate:noop,on:noop,off:noop,send:noop,decline:noop,data:{}});
export const injectQuery=(u)=>u; export const updateStyle=noop; export const removeStyle=noop;
export const ErrorOverlay=class{}; export default {};`;

const SWEEP = (opts) => {
  const stage = window.__stage;
  if (!stage || stage.disposed) return { error: 'no live Stage' };
  const r = stage.renderer, scene = stage.scene, cam = stage.rig.camera;
  const gl = r.getContext();
  const W = r.domElement.width, H = r.domElement.height;
  const casts = [];
  scene.traverse((o) => { if (/^character:/.test(o.name || '')) casts.push(o); });
  const target = casts.find((c) => c.name === `character:${opts.playerId}`) ?? casts[0];
  if (!target) return { error: 'no cast root' };
  const topOf = (o) => { let n = o; while (n.parent && n.parent !== scene) n = n.parent; return n; };

  const read = () => {
    const buf = new Uint8Array(W * H * 4);
    gl.readPixels(0, 0, W, H, gl.RGBA, gl.UNSIGNED_BYTE, buf);
    const out = new Uint8Array(W * H * 4);
    for (let row = 0; row < H; row++) out.set(buf.subarray((H - 1 - row) * W * 4, (H - row) * W * 4), row * W * 4);
    return out;
  };

  // The MATTE and the LUMA come from the same frame set: the matte is two clear
  // colours with the environment hidden, the luma is the shipped frame. That is a
  // two-render metric, so it is only valid where the two agree — the mask is of an
  // UNOCCLUDED character, so anything a prop covers would report the prop's luma as
  // the character's (`docs/LESSONS.md` §5). `pot_south` has the fighter in the open,
  // and the sanity check is that coverage stays in a sane band; it is printed.
  const savedBg = scene.background, savedShadow = r.shadowMap.enabled;
  let hidden = [];
  const hideEnv = (keep) => {
    hidden = [];
    for (const kid of scene.children) if (kid !== keep && kid.visible) { hidden.push(kid); kid.visible = false; }
  };
  const showEnv = () => { for (const k of hidden) k.visible = true; hidden = []; };

  // Every material that `collectFlashTargets` would have picked up, with its base
  // emissive — identical rule: every mesh, minus the outline shells.
  const mats = [];
  target.traverse((o) => {
    if (!o.isMesh) return;
    if ((o.name || '').endsWith('__outline')) return;
    const list = Array.isArray(o.material) ? o.material : [o.material];
    for (const m of list) if (m && m.emissive) mats.push({ m, base: m.emissive.clone() });
  });

  const results = [];
  try {
    for (const f of opts.flashes) {
      for (const { m, base } of mats) m.emissive.copy(base).lerp(new (base.constructor)(0xffffff), f);

      // shipped frame
      stage.render(0); stage.render(0);
      const shipped = read();

      // matte
      hideEnv(topOf(target));
      for (const o of casts) if (o !== target) o.visible = false;
      scene.background = null; r.shadowMap.enabled = false; r.autoClear = true;
      r.setRenderTarget(null);
      r.setClearColor(0x000000, 1); r.clear(true, true, true); r.render(scene, cam);
      const A = read();
      r.setClearColor(0xffffff, 1); r.clear(true, true, true); r.render(scene, cam);
      const B = read();
      showEnv();
      for (const o of casts) o.visible = true;
      scene.background = savedBg; r.shadowMap.enabled = savedShadow;

      const lum = [];
      let n = 0, x0 = 1e9, x1 = -1, y0 = 1e9, y1 = -1;
      for (let i = 0, j = 0; i < A.length; i += 4, j++) {
        const d = Math.max(Math.abs(A[i] - B[i]), Math.abs(A[i + 1] - B[i + 1]), Math.abs(A[i + 2] - B[i + 2]));
        if (d >= 32) continue;
        n++;
        const x = j % W, y = (j / W) | 0;
        if (x < x0) x0 = x; if (x > x1) x1 = x; if (y < y0) y0 = y; if (y > y1) y1 = y;
        lum.push((0.2126 * shipped[i] + 0.7152 * shipped[i + 1] + 0.0722 * shipped[i + 2]) / 255);
      }
      if (!n) { results.push({ f, error: 'no mask' }); continue; }

      // surround: a ring of background just outside the character's own box
      const pad = Math.round((x1 - x0 + 1) * 0.55);
      const sur = [];
      for (let y = Math.max(0, y0 - pad); y < Math.min(H, y1 + pad); y++) {
        for (let x = Math.max(0, x0 - pad); x < Math.min(W, x1 + pad); x++) {
          if (x >= x0 && x <= x1 && y >= y0 && y <= y1) continue;
          const i = (y * W + x) * 4;
          sur.push((0.2126 * shipped[i] + 0.7152 * shipped[i + 1] + 0.0722 * shipped[i + 2]) / 255);
        }
      }
      lum.sort((p, q) => p - q); sur.sort((p, q) => p - q);
      const q = (arr, t) => arr[Math.min(arr.length - 1, Math.floor(t * arr.length))];
      const buckets = new Set(lum.map((v) => Math.floor(v / 0.10)));
      results.push({
        f, px: n, coverage: +(n / (W * H)).toFixed(4),
        p05: +q(lum, 0.05).toFixed(4), p50: +q(lum, 0.5).toFixed(4), p95: +q(lum, 0.95).toFixed(4),
        range: +(q(lum, 0.95) - q(lum, 0.05)).toFixed(4),
        steps: buckets.size,
        dL: +Math.abs(q(lum, 0.5) - q(sur, 0.5)).toFixed(4),
      });
    }
  } finally {
    for (const { m, base } of mats) m.emissive.copy(base);
    showEnv();
    for (const o of casts) o.visible = true;
    scene.background = savedBg; r.shadowMap.enabled = savedShadow;
    try { stage.render(0); } catch (e) { /* best effort */ }
  }
  return { results };
};

if (!BASE) { console.error('PREVIEW_BASE unset — run under tools/tmp/headserve.mjs'); process.exit(2); }
const browser = await chromium.launch({ args: LAUNCH_ARGS });
try {
  for (const id of IDS) {
    const page = await browser.newPage({ viewport: { width: 1600, height: 900 }, deviceScaleFactor: 1 });
    await page.route('**/@vite/client*', (r) => r.fulfill({ status: 200, contentType: 'text/javascript', body: HMR_STUB }));
    page.on('pageerror', (e) => console.error('  PAGEERROR', String(e).slice(0, 200)));
    await page.goto(`${BASE}/?player=${id}&enemy=donut&px=${STATION.x}&py=${STATION.y}` +
      `&fogRadius=${STATION.fog}&simSpeed=0.02&pointerLock=0`, { waitUntil: 'networkidle', timeout: 180000 });
    await page.waitForFunction('window.__gameReady === true', null, { timeout: 180000 });
    await page.waitForTimeout(900);
    const res = await page.evaluate(SWEEP, { playerId: id, flashes: FS });
    if (res.error) { console.error(`✗ ${id}: ${res.error}`); await page.close(); continue; }
    console.log(`\n${id}`);
    console.log('  flash   p05     p50     p95    range  steps    dL   cover');
    for (const r of res.results) {
      if (r.error) { console.log(`  ${r.f}  ${r.error}`); continue; }
      console.log(`  ${String(r.f).padEnd(6)} ${String(r.p05).padStart(6)}  ${String(r.p50).padStart(6)}  ` +
        `${String(r.p95).padStart(6)}  ${String(r.range).padStart(6)}   ${String(r.steps).padStart(2)}  ` +
        `${String(r.dL).padStart(6)}  ${r.coverage}`);
    }
    await page.close();
  }
} finally { await browser.close(); }
