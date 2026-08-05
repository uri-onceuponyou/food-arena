#!/usr/bin/env node
/**
 * POT OCCLUSION ACCEPTANCE TEST — "is a fighter inside the pot visible?"
 *
 * Measured in the REAL game route at SHIPPED framing (docs/LESSONS.md §6: isolation
 * views sat at 265wu while the game shows ~578wu, so every arena loop that judged a
 * preview judged ~3.5x the real zoom). One page load per station, camera centred on
 * the fighter exactly as it is in play.
 *
 * Method — the garish-probe technique from docs/LESSONS.md §1, made numeric:
 *   pass A  every mesh under `character:<id>` is forced to flat MAGENTA; every other
 *           mesh in the scene is forced to flat BLACK but KEEPS its transparency,
 *           blending, side and depthWrite flags, so occlusion is unchanged. Raw
 *           `renderer.render()`, not the composer, so post/bloom/grade cannot shift
 *           the classifier.  magenta pixels = the fighter's VISIBLE silhouette.
 *   pass B  same, but every other scene child is `.visible = false`.
 *           magenta pixels = the fighter's UNOCCLUDED silhouette.
 *
 *   visibility = A / B.  headVisibility = the same ratio restricted to the top 30%
 *   of B's bounding box — the acceptance test's "the head is never fully occluded".
 *
 * THREE is not a page global; the probe clones an existing MeshBasicMaterial out of
 * the scene instead of importing one.
 *
 * Usage:  PREVIEW_BASE=<snapshot-url> node tools/tmp/potvis.mjs --out shots/pot/before --tag before
 */
import { chromium } from 'playwright';
import { mkdir, writeFile } from 'node:fs/promises';
import { join } from 'node:path';

const BASE = process.env.PREVIEW_BASE ?? 'http://localhost:5173';
const args = {};
for (let i = 2; i < process.argv.length; i++) {
  const a = process.argv[i];
  if (!a.startsWith('--')) continue;
  const n = process.argv[i + 1];
  if (n === undefined || n.startsWith('--')) args[a.slice(2)] = true;
  else { args[a.slice(2)] = n; i++; }
}
const OUT = args.out ?? 'shots/pot/before';
const TAG = args.tag ?? 'before';
const PLAYER = args.player ?? 'hamburger';
const ENEMY = args.enemy ?? 'donut';
const ONLY = args.only ? String(args.only).split(',') : null;
const W = 1600, H = 900;

const LAUNCH_ARGS = [
  '--use-gl=angle', '--use-angle=swiftshader', '--enable-unsafe-swiftshader',
  '--enable-webgl', '--ignore-gpu-blocklist', '--disable-gpu-sandbox',
];
const HMR_STUB = 'export const createHotContext = () => ({ on(){}, send(){}, accept(){}, dispose(){}, prune(){}, invalidate(){}, decline(){} });\nexport function injectQuery(u){return u}\nexport function removeStyle(){}\nexport function updateStyle(){}\n';

// The arena centre (shared.ts CENTER) is where kitchen.ts puts the pot — NOT POT.x/y,
// which are the prototype's 900x600 coordinates.
const CX = 700, CY = 500;
const BODY_R = 52;   // POT.bodyRadius, world units
const DANGER_R = 95; // POT.dangerRadius, world units

const dirs = [
  ['E', 0], ['SE', 45], ['S', 90], ['SW', 135],
  ['W', 180], ['NW', 225], ['N', 270], ['NE', 315],
];
// `near` is the closest ring a fighter can still STAND on once the pot is solid
// (92wu CoverBox + 42wu fighter -> centres blocked inside |dx|,|dy| < 67), so it is
// the ring the acceptance test actually has to pass.
const NEAR_R = 68;
let stations = [{ id: 'centre', x: CX, y: CY }];
for (const [tag, R] of [['rim', BODY_R], ['near', NEAR_R], ['ring', DANGER_R]]) {
  for (const [name, deg] of dirs) {
    const r = (deg * Math.PI) / 180;
    stations.push({ id: `${tag}_${name}`, x: Math.round(CX + Math.cos(r) * R), y: Math.round(CY + Math.sin(r) * R) });
  }
}
// The set that actually matters once the pot is solid: every position a fighter can
// REACH that is still inside the damage radius. With a 104wu box and a 42wu fighter,
// standable means max(|dx|,|dy|) >= 73, and burning means hypot < 95 — four lens
// shapes on the cardinals. These are their flush centres and their far corners.
for (const [id, x, y] of [
  ['flush_E', 773, 500], ['flush_S', 700, 573], ['flush_W', 627, 500], ['flush_N', 700, 427],
  ['lens_ES', 773, 545], ['lens_SE', 745, 573], ['lens_WN', 627, 455], ['lens_NW', 655, 427],
]) stations.push({ id, x, y });

if (ONLY) stations = stations.filter((s) => ONLY.includes(s.id));

const PROBE = `(opts) => {
  const W = opts.w, H = opts.h;
  const st = window.__stage;
  const scene = st.scene, cam = st.rig.camera, gl = st.renderer;
  const charRoot = scene.children.find((c) => c.name === 'character:' + opts.playerId);
  if (!charRoot) return { error: 'no character root: ' + scene.children.map((c) => c.name).join(',') };

  // THREE is not a page global — clone a MeshBasicMaterial that already exists.
  let proto = null;
  scene.traverse((o) => {
    if (proto || !o.isMesh) return;
    const m = Array.isArray(o.material) ? o.material[0] : o.material;
    if (m && m.isMeshBasicMaterial) proto = m;
  });
  if (!proto) return { error: 'no MeshBasicMaterial in scene to clone' };

  const mkBasic = (cfg) => {
    const m = proto.clone();
    m.color.setHex(cfg.color);
    m.map = cfg.map ?? null;
    m.alphaMap = null;
    m.transparent = !!cfg.transparent;
    m.opacity = cfg.opacity ?? 1;
    m.depthWrite = cfg.depthWrite !== false;
    m.depthTest = cfg.depthTest !== false;
    m.side = cfg.side ?? 0;
    m.alphaTest = cfg.alphaTest ?? 0;
    m.blending = cfg.blending ?? 1;
    m.vertexColors = false;
    m.fog = false;
    m.toneMapped = false;
    m.needsUpdate = true;
    return m;
  };

  const inChar = new Set();
  charRoot.traverse((o) => { if (o.isMesh) inChar.add(o); });

  const saved = [];
  scene.traverse((o) => { if (o.isMesh) saved.push([o, o.material]); });

  const magenta = mkBasic({ color: 0xff00ff });
  const made = [magenta];
  for (const [o, mat] of saved) {
    if (inChar.has(o)) { o.material = magenta; continue; }
    const src = Array.isArray(mat) ? mat[0] : mat;
    const b = mkBasic({
      color: 0x000000,
      map: src.map ?? null,
      transparent: src.transparent,
      opacity: src.opacity,
      depthWrite: src.depthWrite,
      depthTest: src.depthTest,
      side: src.side,
      alphaTest: src.alphaTest,
      blending: src.blending,
    });
    made.push(b);
    o.material = b;
  }

  const cnv = document.createElement('canvas');
  cnv.width = W; cnv.height = H;
  const ctx = cnv.getContext('2d', { willReadFrequently: true });

  function shoot() {
    gl.setRenderTarget(null);
    gl.render(scene, cam);
    ctx.clearRect(0, 0, W, H);
    ctx.drawImage(gl.domElement, 0, 0, W, H);
    const d = ctx.getImageData(0, 0, W, H).data;
    let n = 0, minY = 1e9, maxY = -1e9, minX = 1e9, maxX = -1e9;
    const rows = new Array(H).fill(0);
    for (let y = 0; y < H; y++) {
      for (let x = 0; x < W; x++) {
        const i = (y * W + x) * 4;
        const R = d[i], G = d[i + 1], B = d[i + 2];
        if (R > 100 && B > 100 && G < 0.5 * Math.min(R, B)) {
          n++; rows[y]++;
          if (y < minY) minY = y; if (y > maxY) maxY = y;
          if (x < minX) minX = x; if (x > maxX) maxX = x;
        }
      }
    }
    return { n, minY, maxY, minX, maxX, rows };
  }

  const visible = shoot();

  const hidden = [];
  for (const c of scene.children) {
    if (c === charRoot) continue;
    if (c.visible) { hidden.push(c); c.visible = false; }
  }
  const full = shoot();
  for (const c of hidden) c.visible = true;

  for (const [o, mat] of saved) o.material = mat;
  for (const m of made) m.dispose();
  gl.setRenderTarget(null);

  let headTotal = 0, headVisible = 0;
  if (full.n > 0) {
    const cut = full.minY + Math.round((full.maxY - full.minY + 1) * 0.30);
    for (let y = full.minY; y <= cut; y++) { headTotal += full.rows[y]; headVisible += visible.rows[y]; }
  }

  return {
    visiblePx: visible.n,
    fullPx: full.n,
    visibility: full.n ? visible.n / full.n : 0,
    headTotalPx: headTotal,
    headVisiblePx: headVisible,
    headVisibility: headTotal ? headVisible / headTotal : 0,
    fullBox: [full.minX, full.minY, full.maxX, full.maxY],
    fullHeightPx: full.n ? full.maxY - full.minY + 1 : 0,
  };
}`;

await mkdir(OUT, { recursive: true });
const browser = await chromium.launch({ args: LAUNCH_ARGS });
const results = [];
try {
  for (const s of stations) {
    const page = await browser.newPage({ viewport: { width: W, height: H }, deviceScaleFactor: 1 });
    await page.route('**/@vite/client*', (r) => r.fulfill({ status: 200, contentType: 'text/javascript', body: HMR_STUB }));
    const errs = [];
    page.on('pageerror', (e) => errs.push(String(e)));
    page.on('console', (m) => { if (m.type() === 'error') errs.push(m.text()); });
    const url = `${BASE}/?player=${PLAYER}&enemy=${ENEMY}&px=${s.x}&py=${s.y}&fogRadius=545&simSpeed=0.02&pointerLock=0`;
    try {
      await page.goto(url, { waitUntil: 'networkidle', timeout: 90000 });
      await page.waitForFunction('window.__gameReady === true', null, { timeout: 90000 });
      await page.waitForTimeout(2500);
      await page.screenshot({ path: join(OUT, `${TAG}_${s.id}.png`) });
      // A string passed to page.evaluate is an EXPRESSION and `arg` is ignored — build
      // the call site into the string instead (this silently returned undefined once).
      const m = await page.evaluate(`(${PROBE})(${JSON.stringify({ playerId: PLAYER, w: W, h: H })})`);
      if (m.error) throw new Error(m.error);
      results.push({ ...s, ...m, errs });
      console.log(`${s.id.padEnd(10)} visible ${(m.visibility * 100).toFixed(1)}%  head ${(m.headVisibility * 100).toFixed(1)}%  (${m.visiblePx}/${m.fullPx}px, h=${m.fullHeightPx}px)`);
    } catch (e) {
      console.error(`✗ ${s.id}: ${e}`);
      results.push({ ...s, error: String(e), errs });
    } finally {
      await page.close();
    }
  }
} finally {
  await browser.close();
}

const ok = results.filter((r) => !r.error);
const mean = ok.length ? ok.reduce((a, r) => a + r.visibility, 0) / ok.length : 0;
const body = ok.filter((r) => r.id === 'centre' || r.id.startsWith('rim_'));
const bodyMean = body.length ? body.reduce((a, r) => a + r.visibility, 0) / body.length : 0;
const worst = ok.length ? ok.reduce((a, r) => (r.visibility < a.visibility ? r : a)) : { visibility: 0, id: '-' };
const headFails = ok.filter((r) => r.headVisibility <= 0.001).map((r) => r.id);
console.log(`\n${TAG}: mean visibility ${(mean * 100).toFixed(1)}% over ${ok.length} stations`);
console.log(`${TAG}: pot-body stations (centre+8 rim) mean ${(bodyMean * 100).toFixed(1)}%`);
console.log(`${TAG}: worst ${worst.id} ${(worst.visibility * 100).toFixed(1)}%`);
console.log(`${TAG}: head FULLY occluded at: ${headFails.length ? headFails.join(', ') : '(none)'}`);
await writeFile(join(OUT, `${TAG}.json`), JSON.stringify({ base: BASE, tag: TAG, player: PLAYER, mean, bodyMean, headFails, stations: results }, null, 2));
