/**
 * CANDIDATE-COLOUR TRANSFER PROBE.
 *
 * `matcover` tells you what a material arrives at. This tells you what a material WOULD
 * arrive at for N candidate authored hexes, in one page load: build the material's
 * screen mask once with matcover's ID-buffer trick, then for each candidate colour set
 * `.color`, re-render the real composited frame, and average inside the mask.
 *
 * Cheaper than `simfix` by ~20x (one station, one load, N renders) and answers the
 * question simfix cannot: does the candidate keep the prop's value ladder and stay clear
 * of the WALKABLE floor pads (the documented blocking-vs-walkable failure mode is a prop
 * landing within ~3 deg of hue and ~10 luma of a pad).
 *
 *   node tools/tmp/caphex.mjs --url http://localhost:5192 --station 570:430 \
 *     --probe "kpal:cabinet=#CE8C2E:#8A6A4E,#4A6E80" --ref "kpal:woodPad,kpal:utilityMat"
 */
import { chromium } from 'playwright';

const arg = (k, d) => { const i = process.argv.indexOf('--' + k); return i < 0 ? d : process.argv[i + 1]; };
const BASE = arg('url', 'http://localhost:5192');
const STATION = arg('station', '570:430');
// `name=<current>-><cand>,<cand>` — material names contain colons, so the separator
// cannot be one.
const PROBE = (arg('probe', '') || '').split(';').filter(Boolean).map((s) => {
  const [lhs, cands] = s.split('->');
  const [name, from] = lhs.split('=');
  return { name, from: from.toUpperCase(), cands: cands.split(',').filter(Boolean) };
});
const REF = (arg('ref', '') || '').split(',').filter(Boolean);

const HMR_STUB = `const noop=()=>{};
export const createHotContext=()=>({accept:noop,acceptExports:noop,dispose:noop,prune:noop,
  invalidate:noop,on:noop,off:noop,send:noop,decline:noop,data:{}});
export const injectQuery=(u)=>u; export const updateStyle=noop; export const removeStyle=noop;
export const ErrorOverlay=class{}; export default {};`;

const browser = await chromium.launch({ args: ['--use-gl=angle', '--use-angle=swiftshader',
  '--enable-unsafe-swiftshader', '--enable-webgl', '--ignore-gpu-blocklist', '--disable-gpu-sandbox'] });
const [px, py] = STATION.split(':');
const page = await browser.newPage({ viewport: { width: 1600, height: 900 }, deviceScaleFactor: 1 });
await page.route('**/@vite/client*', (r) => r.fulfill({ status: 200, contentType: 'text/javascript', body: HMR_STUB }));
page.on('pageerror', (e) => console.error('PAGEERROR', String(e)));
await page.goto(`${BASE}/?player=hamburger&enemy=donut&px=${px}&py=${py}&fogRadius=850&simSpeed=0.02&pointerLock=0`,
  { waitUntil: 'networkidle', timeout: 60000 });
await page.waitForFunction('window.__gameReady === true', null, { timeout: 60000 });
await page.waitForTimeout(1200);

const res = await page.evaluate(({ PROBE, REF }) => {
  const stage = window.__stage, scene = stage.scene, cam = stage.rig.camera, renderer = stage.renderer;
  const gl = renderer.getContext();
  const W = renderer.domElement.width, H = renderer.domElement.height;

  // ---- index every visible material, exactly as matcover does
  const mats = [], idx = new Map(), meshes = [];
  let basicProto = null;
  scene.traverse((o) => {
    if (!o.isMesh || !o.visible) return;
    for (let p = o; p; p = p.parent) if (!p.visible) return;
    const m = Array.isArray(o.material) ? o.material[0] : o.material;
    if (!m) return;
    if (m.isMeshBasicMaterial && !basicProto) basicProto = m;
    if (!idx.has(m.uuid)) { idx.set(m.uuid, mats.length); mats.push(m); }
    meshes.push({ o, i: idx.get(m.uuid) });
  });
  if (!basicProto) return { error: 'no MeshBasicMaterial to clone' };

  // ---- one ID pass -> per-material pixel index lists
  const savedTone = renderer.toneMapping; renderer.toneMapping = 0;
  const savedBg = scene.background; scene.background = null;
  const idMats = mats.map((_, i) => {
    const mm = basicProto.clone();
    mm.map = null; mm.alphaMap = null; mm.transparent = false; mm.opacity = 1;
    mm.depthWrite = true; mm.depthTest = true; mm.fog = false; mm.side = 0;
    const id = i + 1;
    mm.color.setRGB(((id & 15) * 16 + 8) / 255, (((id >> 4) & 15) * 16 + 8) / 255, (((id >> 8) & 15) * 16 + 8) / 255, 'srgb');
    return mm;
  });
  const saved = meshes.map((e) => e.o.material);
  meshes.forEach((e) => { e.o.material = idMats[e.i]; });
  renderer.setRenderTarget(null); renderer.clear(true, true, true); renderer.render(scene, cam);
  const ids = new Uint8Array(W * H * 4);
  gl.readPixels(0, 0, W, H, gl.RGBA, gl.UNSIGNED_BYTE, ids);
  meshes.forEach((e, k) => { e.o.material = saved[k]; });
  idMats.forEach((m) => m.dispose());
  renderer.toneMapping = savedTone; scene.background = savedBg;

  const n = W * H;
  const masks = new Map();
  const q = (v) => Math.min(15, Math.max(0, Math.round((v - 8) / 16)));
  for (let p = 0; p < n; p++) {
    const id = q(ids[p * 4]) | (q(ids[p * 4 + 1]) << 4) | (q(ids[p * 4 + 2]) << 8);
    if (id === 0 || id > mats.length) continue;
    const i = id - 1;
    let a = masks.get(i); if (!a) { a = []; masks.set(i, a); }
    a.push(p);
  }

  const key = (m) => (m.name || '') + '|' + (m.color ? '#' + m.color.getHexString().toUpperCase() : '-');
  const avgOf = (list, buf) => {
    let r = 0, g = 0, b = 0;
    for (const p of list) { r += buf[p * 4]; g += buf[p * 4 + 1]; b += buf[p * 4 + 2]; }
    const k = list.length;
    return [Math.round(r / k), Math.round(g / k), Math.round(b / k)];
  };
  const shoot = () => { stage.render(0.0); const buf = new Uint8Array(n * 4); gl.readPixels(0, 0, W, H, gl.RGBA, gl.UNSIGNED_BYTE, buf); return buf; };

  const out = { total: n, refs: [], probes: [] };
  const base = shoot();
  for (const rname of REF) {
    for (let i = 0; i < mats.length; i++) {
      if (mats[i].name !== rname) continue;
      const list = masks.get(i); if (!list || list.length < 200) continue;
      out.refs.push({ key: key(mats[i]), px: list.length, rgb: avgOf(list, base) });
    }
  }
  for (const pr of PROBE) {
    const targets = [];
    for (let i = 0; i < mats.length; i++) {
      const m = mats[i];
      if (m.name !== pr.name || !m.color) continue;
      if ('#' + m.color.getHexString().toUpperCase() !== pr.from) continue;
      const list = masks.get(i); if (!list || list.length < 200) continue;
      targets.push({ i, m, list });
    }
    if (!targets.length) { out.probes.push({ name: pr.name, from: pr.from, error: 'no on-screen match' }); continue; }
    const list = targets.flatMap((t) => t.list);
    const rows = [{ hex: pr.from, rgb: avgOf(list, base) }];
    const orig = targets.map((t) => t.m.color.getHex());
    for (const c of pr.cands) {
      targets.forEach((t) => t.m.color.set(c));
      const buf = shoot();
      rows.push({ hex: c.toUpperCase(), rgb: avgOf(list, buf) });
    }
    targets.forEach((t, k) => t.m.color.setHex(orig[k]));
    out.probes.push({ name: pr.name, from: pr.from, px: list.length, rows });
  }
  shoot();
  return out;
}, { PROBE, REF });

await page.close(); await browser.close();
if (res.error) { console.error(res.error); process.exit(1); }

const hsv = ([r, g, b]) => {
  const mx = Math.max(r, g, b), mn = Math.min(r, g, b), d = mx - mn;
  let h = 0;
  if (d) h = mx === r ? ((g - b) / d + (g < b ? 6 : 0)) : mx === g ? (b - r) / d + 2 : (r - g) / d + 4;
  return { h: Math.round(((h * 60) % 360 + 360) % 360), s: mx ? d / mx : 0, v: mx / 255, luma: 0.2126 * r + 0.7152 * g + 0.0722 * b };
};
const line = (label, rgb, px) => {
  const k = hsv(rgb);
  console.log(`  ${label.padEnd(30)} rgb(${rgb.join(',').padEnd(12)})  hue ${String(k.h).padStart(4)}  sat ${k.s.toFixed(2)}  val ${k.v.toFixed(2)}  luma ${k.luma.toFixed(0).padStart(4)}${px ? `   ${(px / res.total * 100).toFixed(2)}% of frame` : ''}`);
};
console.log(`\nSTATION ${STATION}\n\nREFERENCE SURFACES (unchanged)`);
for (const r of res.refs) line(r.key, r.rgb, r.px);
for (const p of res.probes) {
  console.log(`\nPROBE ${p.name} ${p.from}${p.error ? '  -> ' + p.error : `  (${(p.px / res.total * 100).toFixed(2)}% of frame)`}`);
  for (const r of p.rows || []) line(r.hex === p.from ? `${r.hex}  <- CURRENT` : r.hex, r.rgb);
}
