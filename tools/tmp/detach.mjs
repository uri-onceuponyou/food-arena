#!/usr/bin/env node
/**
 * THROWAWAY read-only probe — WHICH MESHES ARE IN THE FLOATING COMPONENT?
 *
 * `limbcheck.mjs` reports that a silhouette breaks into more than one connected
 * component and how many LIMB pixels sit in the wrong one. It does not say which
 * meshes those components are made of. `islands.mjs` does, from an ID buffer — but an
 * ID buffer has to force every material opaque, and this cast is full of transparent
 * surfaces that correctly do not write depth, so ID attribution reports an ordering
 * the shipped render does not have (measured: hamburger `handR` reads 0.179 delivered
 * off the ID buffer against `limbcheck`'s 0.826).
 *
 * So this brute-forces it in the SHIPPED materials: label the components of
 * `limbcheck`'s own green-keyed silhouette, then isolate one mesh at a time and see
 * which component its pixels land in. Slower (one render per mesh) and exact.
 *
 *   node tools/tmp/detach.mjs --ids hamburger --anim idle --t 1.5
 */
/**
 * capture-audit: css-immune — same as bgsweep — `gl.readPixels()` on `preview.html`. The number is a pixel count off
 * the drawing buffer, which a CSS fade cannot touch.
 */
import { chromium } from 'playwright';
import { mkdir, writeFile } from 'node:fs/promises';

const LAUNCH_ARGS = ['--use-gl=angle', '--use-angle=swiftshader', '--enable-unsafe-swiftshader',
  '--enable-webgl', '--ignore-gpu-blocklist', '--disable-gpu-sandbox'];
const a = process.argv;
const get = (k, d) => (a.includes(k) ? a[a.indexOf(k) + 1] : d);
const BASE = process.env.PREVIEW_BASE ?? 'http://localhost:5173';
const OUT = get('--out', 'shots/probe/detach');
const TAG = get('--tag', 'detach');
const IDS = get('--ids', 'hamburger').split(',');
const ANIM = get('--anim', 'idle');
const T = Number(get('--t', 1.5));
const PITCH = Number(get('--pitch', 22));
const MIN = Number(get('--min', 40));
const W = Number(get('--w', 640)), H = Number(get('--h', 800));

const HMR_STUB = `const noop=()=>{};
export const createHotContext=()=>({accept:noop,acceptExports:noop,dispose:noop,prune:noop,
  invalidate:noop,on:noop,off:noop,send:noop,decline:noop,data:{}});
export const injectQuery=(u)=>u; export const updateStyle=noop; export const removeStyle=noop;
export const ErrorOverlay=class{}; export default {};`;

const DUMP = ({ t, anim, min }) => {
  const stage = window.__stage, scene = stage.scene, renderer = stage.renderer;
  window.__preview.frameAt(t, { anim, remount: true });
  let root = null;
  for (const c of scene.children) {
    if (c.isLight || c.name === 'preview_ground' || c.name === 'lighting') continue;
    let has = false; c.traverse((o) => { if (o.name === 'head') has = true; });
    if (has) { root = c; break; }
  }
  const ground = scene.getObjectByName('preview_ground');
  const gv = ground ? ground.visible : null;
  if (ground) ground.visible = false;

  const gl = renderer.getContext(), cv = renderer.domElement;
  const W = cv.width, H = cv.height;
  const meshes = [];
  root.traverse((o) => { if (o.isMesh) meshes.push(o); });
  const path = (m) => {
    const names = []; let o = m;
    while (o && o !== root) { if (o.name) names.push(o.name); o = o.parent; }
    return names.reverse().join('/');
  };

  const plain = (only = null) => {
    const fog = scene.fog, bg = scene.background, sh = renderer.shadowMap.enabled;
    scene.fog = null; scene.background = null; renderer.shadowMap.enabled = false;
    let prev = null;
    if (only) { prev = meshes.map((m) => m.visible); meshes.forEach((m) => { m.visible = only(m); }); }
    renderer.setRenderTarget(null); renderer.setClearColor(0x00ff00, 1); renderer.clear();
    renderer.render(scene, stage.rig.camera);
    const px = new Uint8Array(W * H * 4);
    gl.readPixels(0, 0, W, H, gl.RGBA, gl.UNSIGNED_BYTE, px);
    if (prev) meshes.forEach((m, i) => { m.visible = prev[i]; });
    scene.fog = fog; scene.background = bg; renderer.shadowMap.enabled = sh;
    return px;
  };
  const keyed = (px) => {
    const m = new Uint8Array(W * H);
    for (let i = 0, j = 0; i < px.length; i += 4, j++) m[j] = (px[i] < 60 && px[i + 1] > 180 && px[i + 2] < 60) ? 0 : 1;
    return m;
  };

  const maskAll = keyed(plain());
  const comp = new Int32Array(W * H).fill(-1);
  const stack = new Int32Array(W * H);
  const sizes = [], boxes = [];
  for (let j0 = 0; j0 < W * H; j0++) {
    if (!maskAll[j0] || comp[j0] >= 0) continue;
    const id = sizes.length;
    let sp = 0; stack[sp++] = j0; comp[j0] = id;
    let n = 0, x0 = 1e9, x1 = -1e9, y0 = 1e9, y1 = -1e9;
    while (sp > 0) {
      const p = stack[--sp]; n++;
      const x = p % W, y = (p / W) | 0;
      if (x < x0) x0 = x; if (x > x1) x1 = x; if (y < y0) y0 = y; if (y > y1) y1 = y;
      if (x > 0 && maskAll[p - 1] && comp[p - 1] < 0) { comp[p - 1] = id; stack[sp++] = p - 1; }
      if (x < W - 1 && maskAll[p + 1] && comp[p + 1] < 0) { comp[p + 1] = id; stack[sp++] = p + 1; }
      if (y > 0 && maskAll[p - W] && comp[p - W] < 0) { comp[p - W] = id; stack[sp++] = p - W; }
      if (y < H - 1 && maskAll[p + W] && comp[p + W] < 0) { comp[p + W] = id; stack[sp++] = p + W; }
    }
    sizes.push(n); boxes.push([x0, y0, x1 - x0 + 1, y1 - y0 + 1]);
  }
  let main = 0;
  for (let i = 1; i < sizes.length; i++) if (sizes[i] > sizes[main]) main = i;
  const floats = sizes.map((n, i) => ({ i, n })).filter((c) => c.i !== main && c.n >= min);

  // ── Attribution by ABLATION, not by isolation ───────────────────────────────
  // Isolation (`m.visible = x === m`) is the obvious way and it is WRONG here:
  // `visible` is INHERITED, so a mesh parented to another mesh — this cast has
  // several, e.g. hamburger's `spatula_blade/spatula_slot` — vanishes with its
  // parent and reports an empty footprint. That is exactly how a first version of
  // this probe returned a 197 px component owned by NO mesh at all. Hiding one mesh
  // from the FULL render has no such failure mode: whatever pixels of the float stop
  // being solid belong to that mesh (or to something inside it, which is stated).
  const perComp = new Map(floats.map((c) => [c.i, []]));
  for (const m of meshes) {
    const hid = keyed(plain((x) => x !== m));
    const hits = new Map();
    for (let j = 0; j < W * H; j++) {
      if (!maskAll[j] || hid[j]) continue;      // was solid, no longer is
      const c = comp[j];
      if (c === main || c < 0) continue;
      hits.set(c, (hits.get(c) ?? 0) + 1);
    }
    for (const [c, n] of hits) if (perComp.has(c)) perComp.get(c).push({ mesh: path(m) || m.name || '?', px: n });
  }

  if (ground) ground.visible = gv;
  return {
    meshCount: meshes.length,
    mainPx: sizes[main],
    floats: floats.sort((p, q) => q.n - p.n).map((c) => ({
      px: c.n, bbox: boxes[c.i],
      meshes: (perComp.get(c.i) ?? []).sort((p, q) => q.px - p.px).slice(0, 10),
    })),
  };
};

const browser = await chromium.launch({ args: LAUNCH_ARGS });
await mkdir(OUT, { recursive: true });
const out = {};
for (const id of IDS) {
  const page = await browser.newPage({ viewport: { width: W, height: H }, deviceScaleFactor: 1 });
  page.on('pageerror', (e) => console.error('PAGEERROR', String(e)));
  await page.route('**/@vite/client*', (r) => r.fulfill({ status: 200, contentType: 'text/javascript', body: HMR_STUB }));
  try {
    await page.goto(`${BASE}/preview.html?piece=character&id=${id}&anim=idle&t=1.5&shot=1&pitch=${PITCH}`, { waitUntil: 'networkidle', timeout: 180000 });
    await page.waitForFunction('window.__previewReady === true', null, { timeout: 180000 });
    const r = await page.evaluate(DUMP, { t: T, anim: ANIM, min: MIN });
    out[id] = r;
    console.log(`=== ${id} ${ANIM} t=${T} pitch=${PITCH}  main ${r.mainPx}px, ${r.floats.length} float(s)`);
    for (const f of r.floats) {
      console.log(`   FLOAT ${String(f.px).padStart(6)}px  bbox ${f.bbox.join(',')}`);
      for (const m of f.meshes) console.log(`        ${String(m.px).padStart(6)}px  ${m.mesh}`);
    }
  } catch (e) { console.error(`✗ ${id}: ${e}`); out[id] = { error: String(e) }; }
  finally { await page.close(); }
}
await writeFile(`${OUT}/${TAG}.json`, JSON.stringify(out, null, 2));
console.log(`wrote ${OUT}/${TAG}.json`);
await browser.close();
