#!/usr/bin/env node
/**
 * FX_OWN — in a REAL match frame, which pixels does the VFX layer own, and which
 * objects are drawing them?
 *
 * ── The question this exists for ────────────────────────────────────────────
 * Uri's complaint is about a frame he PLAYED, not about a staged single-weapon
 * spawn. `fx_dbg.mjs` fires one weapon's `spawnImpactBurst` on a paused clock; that
 * is the right lamp for a metric sheet and the wrong one for "what is the big red
 * mass in `match_donut_taco_05.png`". Three plausible owners for that mass —
 * ground splats (`PlaneGeometry`), a bespoke weapon hook, the generic burst — are
 * indistinguishable by reading source, and two of them are in different file sets.
 *
 * So: drive a live match exactly as `q1_capture.mjs` does, stop on the same
 * eligibility band, then ABLATE — screenshot with `vfx_layer` visible and again with
 * it hidden, on a frame that is otherwise frozen. The differing pixels are, by
 * construction, the VFX layer's. Everything else in the frame is somebody else's.
 *
 * ── Why the ablation and not a colour threshold ─────────────────────────────
 * A "count the red pixels" region metric cannot tell a weapon's splat from the
 * arena's own warm floor, and this arena's floor IS red-violet. LESSONS §14 is that
 * scar. An ablation asks the renderer instead of asking a threshold.
 *
 * ── Controls, because a null here reads exactly like "the layer draws nothing" ──
 *   NULL     two captures with NO ablation between them must differ by EXACTLY 0 px.
 *            If that is not 0, the frame is not frozen and every later number is
 *            noise. (CAMERA SHAKE re-randomises inside `render()` at dt=0, and CSS
 *            HUD keyframes run off the document timeline, not rAF — both are stilled
 *            explicitly, and the null is what proves it.)
 *   NONEMPTY the visible-object list and the ablation mask are both asserted
 *            non-empty before anything is concluded from them: `[].every()` is true
 *            and an empty mask is the shape a broken probe takes.
 *
 * Usage:
 *   node tools/tmp/sx_snap.mjs --root <worktree> -- \
 *     node tools/tmp/fx_own.mjs --url '{URL}' --out shots/fxc2/own
 */
import { mkdirSync, writeFileSync } from 'node:fs';
import { readFileSync } from 'node:fs';
import { join, resolve } from 'node:path';
import sharp from 'sharp';
import { chromium } from 'playwright';

const LAUNCH_ARGS = ['--use-gl=angle', '--use-angle=swiftshader', '--enable-unsafe-swiftshader',
  '--enable-webgl', '--ignore-gpu-blocklist', '--disable-gpu-sandbox'];

const args = {};
for (let i = 2; i < process.argv.length; i++) {
  const a = process.argv[i];
  if (!a.startsWith('--')) continue;
  const n = process.argv[i + 1];
  if (n === undefined || n.startsWith('--')) args[a.slice(2)] = true; else { args[a.slice(2)] = n; i++; }
}
const BASE = String(args.url ?? process.env.PREVIEW_BASE ?? '').replace(/\/$/, '');
if (!BASE) { console.error('fx_own: --url or PREVIEW_BASE required'); process.exit(2); }
if (BASE.includes(':5173')) { console.error('fx_own: that is the shared dev server'); process.exit(2); }
const OUT = resolve(String(args.out ?? 'shots/fxc2/own'));
const W = Number(args.w ?? 1600);
const H = Number(args.h ?? 900);
const PLAYER = String(args.player ?? 'donut');
const ENEMY = String(args.enemy ?? 'taco');
mkdirSync(OUT, { recursive: true });

const ROOT = resolve(process.argv[1], '../../..');
const ARENA = JSON.parse(readFileSync(join(ROOT, 'tools/arena.gameplay.json'), 'utf8'));
const POT = ARENA.hazards.find((h) => h.kind === 'damage' && h.x === ARENA.center.x && h.y === ARENA.center.y);
const ANCHOR = { x: Math.round(ARENA.center.x + POT.radius * 1.684), y: Math.round(ARENA.center.y) };

const HMR_STUB = `const noop=()=>{};
export const createHotContext=()=>({accept:noop,acceptExports:noop,dispose:noop,prune:noop,
  invalidate:noop,on:noop,off:noop,send:noop,decline:noop,data:{}});
export const injectQuery=(u)=>u; export const updateStyle=noop; export const removeStyle=noop;
export const ErrorOverlay=class{}; export default {};`;

async function rawOf(buf) {
  const { data, info } = await sharp(buf).ensureAlpha().raw().toBuffer({ resolveWithObject: true });
  return { data, w: info.width, h: info.height };
}

/** Pixels differing by more than `delta` on any channel, plus their bbox. */
function diffMask(a, b, delta = 6) {
  let n = 0;
  let x0 = Infinity; let y0 = Infinity; let x1 = -Infinity; let y1 = -Infinity;
  const mask = Buffer.alloc(a.w * a.h);
  for (let y = 0; y < a.h; y++) {
    for (let x = 0; x < a.w; x++) {
      const i = (y * a.w + x) * 4;
      const d = Math.max(
        Math.abs(a.data[i] - b.data[i]),
        Math.abs(a.data[i + 1] - b.data[i + 1]),
        Math.abs(a.data[i + 2] - b.data[i + 2]),
      );
      if (d > delta) {
        mask[y * a.w + x] = 255;
        n++;
        if (x < x0) x0 = x; if (x > x1) x1 = x;
        if (y < y0) y0 = y; if (y > y1) y1 = y;
      }
    }
  }
  return { n, mask, bbox: n ? [x0, y0, x1, y1] : null };
}

const browser = await chromium.launch({ args: LAUNCH_ARGS });
try {
  const page = await browser.newPage({ viewport: { width: W, height: H }, deviceScaleFactor: 1 });
  page.setDefaultTimeout(180_000);
  page.on('pageerror', (e) => console.log('PAGEERROR:', String(e).slice(0, 200)));
  await page.route('**/@vite/client*', (r) => r.fulfill({ status: 200, contentType: 'text/javascript', body: HMR_STUB }));

  const q = new URLSearchParams({
    pointerLock: '0', player: PLAYER, enemy: ENEMY,
    px: String(ANCHOR.x), py: String(ANCHOR.y),
  });
  await page.goto(`${BASE}/?${q}`, { waitUntil: 'networkidle' });
  await page.waitForFunction('window.__gameReady === true', null, { timeout: 240_000 });
  await page.waitForFunction(() => !!window.__vfxLayer && !!window.__vfxDebugFighters, null, { timeout: 120_000 });
  await page.waitForFunction(() => {
    const c = document.querySelector('[data-el="countdown"]');
    return !c || c.style.display === 'none';
  }, null, { timeout: 120_000 });

  // ── drive, exactly as q1_capture does, until a frame in the same band ──────
  const held = new Set();
  const KEYS = { up: 'KeyW', down: 'KeyS', left: 'KeyA', right: 'KeyD' };
  const setKeys = async (mx, my) => {
    const want = new Set();
    if (mx < 0) want.add(KEYS.left); if (mx > 0) want.add(KEYS.right);
    if (my < 0) want.add(KEYS.up); if (my > 0) want.add(KEYS.down);
    for (const k of held) if (!want.has(k)) { await page.keyboard.up(k).catch(() => {}); held.delete(k); }
    for (const k of want) if (!held.has(k)) { await page.keyboard.down(k).catch(() => {}); held.add(k); }
  };
  let firing = false;
  const t0 = Date.now();
  let got = false;
  const QA_KEYS = ['cast', 'meleeArc', 'impact', 'death', 'heal', 'giantSlam', 'puddleSplash', 'coverScuff'];
  const qaTotal = (c) => (c ? QA_KEYS.reduce((s, k) => s + (c[k] ?? 0), 0) : 0);
  let prevQa = 0;
  while (!got && Date.now() - t0 < 300_000) {
    // eslint-disable-next-line no-await-in-loop
    const r = await page.evaluate(() => ({
      f: window.__vfxDebugFighters ?? null,
      scr: window.__vfxDebugScreen ?? null,
      qa: window.__vfxQaCounts ? { ...window.__vfxQaCounts } : null,
      ended: (() => { const g = document.querySelector('[data-el="gameover"]'); return !!g && g.style.display === 'flex'; })(),
    }));
    if (r.ended) { console.log('match ended before an eligible frame'); break; }
    if (!r?.f) { await page.waitForTimeout(100); continue; }
    const p = r.f.player; const e = r.f.enemy;
    const d = Math.hypot(p.x - e.x, p.y - e.y);
    const onScreen = (s) => s && s.x > 40 && s.x < W - 40 && s.y > 40 && s.y < H - 40;
    const bothOn = onScreen(r.scr?.player) && onScreen(r.scr?.enemy);
    const now = qaTotal(r.qa);
    const vfxDelta = now - prevQa;
    prevQa = now;
    const dAnchor = Math.hypot(p.x - ANCHOR.x, p.y - ANCHOR.y);
    const toward = (tx, ty) => [tx > p.x + 12 ? 1 : tx < p.x - 12 ? -1 : 0, ty > p.y + 12 ? 1 : ty < p.y - 12 ? -1 : 0];
    let mx; let my;
    if (dAnchor > 240) [mx, my] = toward(ANCHOR.x, ANCHOR.y);
    else if (d < 65) [mx, my] = toward(p.x + (p.x - e.x), p.y + (p.y - e.y));
    else if (d > 120) [mx, my] = toward(e.x, e.y);
    else { const sx = e.x > p.x ? 1 : -1; const sy = e.y > p.y ? 1 : -1; mx = -sy; my = sx; }
    await setKeys(mx, my);
    if (r.scr?.enemy) await page.mouse.move(Math.max(2, Math.min(W - 2, r.scr.enemy.x)), Math.max(2, Math.min(H - 2, r.scr.enemy.y))).catch(() => {});
    if (!firing) { await page.mouse.down().catch(() => {}); firing = true; }
    if (p.alive && e.alive && bothOn && d >= 45 && d <= 140 && vfxDelta > 0) got = true;
    else await page.waitForTimeout(70);
  }
  for (const k of held) await page.keyboard.up(k).catch(() => {});
  if (firing) await page.mouse.up().catch(() => {});
  if (!got) { console.error('fx_own: never reached an eligible frame'); process.exit(4); }

  // ── FREEZE. rAF parked, clock stopped, camera shake zeroed, HUD stilled. ───
  const frozen = await page.evaluate(() => {
    window.requestAnimationFrame = () => 0;
    const st = document.createElement('style');
    st.textContent = '*,*::before,*::after{animation:none !important;transition:none !important}';
    document.head.appendChild(st);
    const rig = window.__stage?.rig ?? window.__cameraRig ?? null;
    let shakeZeroed = false;
    if (rig && typeof rig === 'object') {
      for (const k of ['shake', 'shakeAmp', 'shakeMag', 'trauma']) {
        if (k in rig) { rig[k] = 0; shakeZeroed = true; }
      }
    }
    return { shakeZeroed, hasStage: !!window.__stage };
  });
  console.log(`frozen: ${JSON.stringify(frozen)}`);

  const shot = async (name) => {
    const b = await page.locator('canvas').screenshot({ path: join(OUT, name) });
    return rawOf(b);
  };

  // NULL control FIRST: two captures, nothing changed between them.
  const n1 = await shot('null_a.png');
  const n2 = await shot('null_b.png');
  const nullD = diffMask(n1, n2, 0);
  console.log(`NULL control (identical state, delta>0): ${nullD.n} px  — must be 0`);

  // The visible-object census, before the ablation.
  const census = await page.evaluate(() => {
    const grp = window.__stage?.scene?.getObjectByName('vfx_layer');
    if (!grp) return { err: 'no vfx_layer' };
    const rows = [];
    grp.traverse((o) => {
      if (!o.visible) return;
      if (!o.isMesh && !o.isSprite) return;
      const m = Array.isArray(o.material) ? o.material[0] : o.material;
      const g = o.geometry;
      o.updateWorldMatrix(true, false);
      const ws = new (window.THREE?.Vector3 ?? Object)();
      rows.push({
        name: o.name || (o.isSprite ? '(sprite)' : '(mesh)'),
        parent: o.parent?.name || '(anon)',
        geo: g?.type ?? '?',
        params: g?.parameters ? JSON.stringify(g.parameters).slice(0, 90) : null,
        scale: [o.scale.x, o.scale.y, o.scale.z].map((v) => Number(v.toFixed(3))),
        opacity: m ? Number((m.opacity ?? 1).toFixed(3)) : null,
        matType: m?.type ?? null,
        color: m?.color ? `#${m.color.getHexString()}` : null,
        // 0 No 1 Normal 2 Additive 3 Subtractive 4 Multiply 5 Custom (THREE constants)
        blending: m ? m.blending : null,
        transparent: m ? !!m.transparent : null,
      });
    });
    return { rows, count: rows.length };
  });
  if (census.err) { console.error('fx_own:', census.err); process.exit(5); }
  if (!census.rows.length) { console.error('fx_own: vfx_layer has ZERO visible objects — the probe is not pointed at a live effect'); process.exit(5); }

  // ── ABLATE ────────────────────────────────────────────────────────────────
  await page.evaluate(() => {
    const grp = window.__stage.scene.getObjectByName('vfx_layer');
    grp.visible = false;
    window.__stage.render(0);
  });
  const off = await shot('vfx_off.png');
  await page.evaluate(() => {
    const grp = window.__stage.scene.getObjectByName('vfx_layer');
    grp.visible = true;
    window.__stage.render(0);
  });
  const on = await shot('vfx_on.png');

  const d = diffMask(on, off, 6);
  if (d.n === 0) {
    console.error('fx_own: the ablation changed ZERO pixels. Either the layer draws nothing '
      + 'in this frame or the ablation did not take — do not read anything else below.');
  }
  await sharp(d.mask, { raw: { width: on.w, height: on.h, channels: 1 } }).png().toFile(join(OUT, 'vfx_mask.png'));

  // ── SECOND ABLATION: the sticky-trail ground marks ALONE ──────────────────
  // Selected on the material colour `TRAIL_COLOR[0]` (`vfx.ts`) rather than on a
  // name, because `syncPool` leaves the pooled meshes unnamed. The selected set is
  // asserted NON-EMPTY before its mask is believed: a colour that matched nothing
  // would produce a 0-px mask that reads exactly like "the trail costs nothing".
  const trailHex = String(args.trailHex ?? 'f5475e').toLowerCase();
  const picked = await page.evaluate((hex) => {
    const grp = window.__stage.scene.getObjectByName('vfx_layer');
    const hit = [];
    grp.traverse((o) => {
      if (!o.visible || (!o.isMesh && !o.isSprite)) return;
      const m = Array.isArray(o.material) ? o.material[0] : o.material;
      if (m?.color && m.color.getHexString().toLowerCase() === hex) hit.push(o);
    });
    window.__fxPicked = hit;
    return hit.length;
  }, trailHex);
  let trailD = { n: 0, bbox: null };
  if (picked === 0) {
    console.error(`fx_own: NO object carries #${trailHex} — the trail ablation below would be VACUOUS, so it was not run.`);
  } else {
    await page.evaluate(() => { window.__fxPicked.forEach((o) => { o.visible = false; }); window.__stage.render(0); });
    const noTrail = await shot('trail_off.png');
    await page.evaluate(() => { window.__fxPicked.forEach((o) => { o.visible = true; }); window.__stage.render(0); });
    trailD = diffMask(on, noTrail, 6);
    await sharp(trailD.mask, { raw: { width: on.w, height: on.h, channels: 1 } }).png().toFile(join(OUT, 'trail_mask.png'));
    console.log(`\nTRAIL ablation: ${picked} objects carry #${trailHex}; they own ${trailD.n} px `
      + `= ${(100 * trailD.n / (on.w * on.h)).toFixed(2)}% of frame, ${(100 * trailD.n / Math.max(1, d.n)).toFixed(1)}% of all VFX-owned pixels. bbox ${JSON.stringify(trailD.bbox)}`);
  }

  // ── THIRD ABLATION: everything drawn with ADDITIVE blending ───────────────
  // An explosion reads as LIGHT when overlapping members ADD; with NormalBlending
  // they composite DARKER and denser instead, which is the "lump" read. This asks
  // the frame how much of the effect is actually additive, rather than counting
  // `AdditiveBlending` in the source (a grep counts constructions, not draws).
  const addN = await page.evaluate(() => {
    const grp = window.__stage.scene.getObjectByName('vfx_layer');
    const hit = [];
    grp.traverse((o) => {
      if (!o.visible || (!o.isMesh && !o.isSprite)) return;
      const m = Array.isArray(o.material) ? o.material[0] : o.material;
      if (m && m.blending === 2) hit.push(o);      // THREE.AdditiveBlending === 2
    });
    window.__fxAdd = hit;
    return hit.length;
  });
  let addD = { n: 0 };
  if (addN === 0) {
    console.error('fx_own: ZERO visible VFX objects use AdditiveBlending — the additive '
      + 'ablation is VACUOUS and was not run. That is itself the finding.');
  } else {
    await page.evaluate(() => { window.__fxAdd.forEach((o) => { o.visible = false; }); window.__stage.render(0); });
    const noAdd = await shot('add_off.png');
    await page.evaluate(() => { window.__fxAdd.forEach((o) => { o.visible = true; }); window.__stage.render(0); });
    addD = diffMask(on, noAdd, 6);
    console.log(`\nADDITIVE ablation: ${addN} of ${census.count} visible VFX objects blend ADDITIVELY; `
      + `they own ${addD.n} px = ${(100 * addD.n / Math.max(1, d.n)).toFixed(1)}% of all VFX-owned pixels.`);
  }

  const tally = new Map();
  for (const r of census.rows) {
    const k = `${r.name} | ${r.geo} | ${r.matType} ${r.color} op=${r.opacity}`;
    tally.set(k, (tally.get(k) ?? 0) + 1);
  }
  console.log(`\nvfx_layer visible objects: ${census.count}`);
  for (const [k, n] of [...tally.entries()].sort((a, b) => b[1] - a[1])) console.log(`  ${String(n).padStart(4)} x  ${k}`);
  console.log(`\nVFX-owned pixels: ${d.n} of ${on.w * on.h} = ${(100 * d.n / (on.w * on.h)).toFixed(2)}% of frame`);
  console.log(`bbox: ${JSON.stringify(d.bbox)}`);
  console.log(`NULL was ${nullD.n} px (must be 0 for the above to mean anything)`);
  writeFileSync(join(OUT, 'fx_own.json'), JSON.stringify({
    base: BASE, player: PLAYER, enemy: ENEMY, viewport: [W, H],
    nullPx: nullD.n, vfxPx: d.n, framePx: on.w * on.h, bbox: d.bbox,
    trailObjects: picked, trailPx: trailD.n, trailBbox: trailD.bbox,
    additiveObjects: addN, additivePx: addD.n,
    census: census.rows,
  }, null, 2));
  console.log(`-> ${OUT}`);
} finally {
  await browser.close();
}
