#!/usr/bin/env node
/**
 * THROWAWAY read-only probe — pick the preview backdrop.
 *
 * docs finding #9: the preview backdrop 0x39b7e8 makes characters DARKER than the
 * background (contrast -0.40) while the real match makes them LIGHTER (+0.27).
 * Opposite polarity, so every character packet ever judged here was judged against
 * the wrong figure/ground.
 *
 * ONE page load per character; candidates are swept by mutating `scene.background`,
 * the fog colour and the ground material in-page. A page load costs ~30s under
 * SwiftShader, a re-render costs ~1s, so this is ~20x cheaper than one load per
 * candidate and it is the same pixels either way.
 *
 * Match reference (tools/tmp/shipframe.mjs, donut at shipped framing):
 *   bodyLuma 0.5411  frameLuma 0.3250  body-frame = +0.216   edge-ring = +0.2063
 */
import { chromium } from 'playwright';

const LAUNCH_ARGS = ['--use-gl=angle', '--use-angle=swiftshader', '--enable-unsafe-swiftshader',
  '--enable-webgl', '--ignore-gpu-blocklist', '--disable-gpu-sandbox'];
const a = process.argv;
const get = (k, d) => (a.includes(k) ? a[a.indexOf(k) + 1] : d);
const BASE = process.env.PREVIEW_BASE ?? 'http://localhost:5173';
const IDS = get('--ids', 'donut,hotdog,egg').split(',');
/** `bg:ground` pairs, hex without '#'. */
const PAIRS = get('--pairs', '39b7e8:8fd6f2').split(',');

const HMR_STUB = `const noop=()=>{};
export const createHotContext=()=>({accept:noop,acceptExports:noop,dispose:noop,prune:noop,
  invalidate:noop,on:noop,off:noop,send:noop,decline:noop,data:{}});
export const injectQuery=(u)=>u; export const updateStyle=noop; export const removeStyle=noop;
export const ErrorOverlay=class{}; export default {};`;

const SWEEP = (pairs) => {
  const stage = window.__stage, scene = stage.scene, renderer = stage.renderer;
  const THREE = stage.scene.background.constructor; // THREE.Color
  const gl = renderer.getContext(), cv = renderer.domElement;
  const W = cv.width, H = cv.height;
  const read = () => { const p = new Uint8Array(W * H * 4); gl.readPixels(0, 0, W, H, gl.RGBA, gl.UNSIGNED_BYTE, p); return p; };

  let root = null;
  for (const c of scene.children) {
    if (c.isLight || c.name === 'preview_ground' || c.name === 'lighting') continue;
    let has = false; c.traverse((o) => { if (o.name === 'head') has = true; });
    if (has) { root = c; break; }
  }
  const ground = scene.getObjectByName('preview_ground');

  // ── character mask, once (geometry does not change across candidates) ──────
  const gv = ground ? ground.visible : null;
  if (ground) ground.visible = false;
  const fog = scene.fog, bg = scene.background, sh = renderer.shadowMap.enabled;
  scene.fog = null; scene.background = null; renderer.shadowMap.enabled = false;
  renderer.setRenderTarget(null); renderer.setClearColor(0x00ff00, 1); renderer.clear();
  renderer.render(scene, stage.rig.camera);
  const key = read();
  scene.fog = fog; scene.background = bg; renderer.shadowMap.enabled = sh;
  if (ground) ground.visible = gv;

  const mask = new Uint8Array(W * H);
  for (let j = 0; j < W * H; j++) {
    const i = j * 4;
    mask[j] = (key[i] < 60 && key[i + 1] > 180 && key[i + 2] < 60) ? 0 : 1;
  }
  const inner = new Uint8Array(W * H), outer = new Uint8Array(W * H);
  for (let y = 6; y < H - 6; y++) for (let x = 6; x < W - 6; x++) {
    const j = y * W + x;
    if (!mask[j]) continue;
    if (mask[j - 1] && mask[j + 1] && mask[j - W] && mask[j + W]) continue;
    for (let dy = -6; dy <= 6; dy++) for (let dx = -6; dx <= 6; dx++) {
      const k = (y + dy) * W + (x + dx);
      if (mask[k]) inner[k] = 1; else outer[k] = 1;
    }
  }

  const out = [];
  for (const pair of pairs) {
    const [b, g] = pair.split(':');
    scene.background = new THREE(`#${b}`);
    if (scene.fog) scene.fog.color = new THREE(`#${b}`);
    if (ground && g) ground.material.color = new THREE(`#${g}`);
    stage.render(0); stage.render(0);
    const px = read();
    let lb = 0, nb = 0, lf = 0, nf = 0, li = 0, ni = 0, lo = 0, no = 0;
    for (let j = 0; j < W * H; j++) {
      const i = j * 4;
      const L = (0.2126 * px[i] + 0.7152 * px[i + 1] + 0.0722 * px[i + 2]) / 255;
      if (mask[j]) { lb += L; nb++; if (inner[j]) { li += L; ni++; } }
      else { lf += L; nf++; if (outer[j]) { lo += L; no++; } }
    }
    const f = (v) => +v.toFixed(4);
    out.push({
      pair,
      bodyLuma: f(lb / Math.max(1, nb)),
      frameLuma: f(lf / Math.max(1, nf)),
      bodyMinusFrame: f(lb / Math.max(1, nb) - lf / Math.max(1, nf)),
      edgeMinusRing: f(li / Math.max(1, ni) - lo / Math.max(1, no)),
    });
  }
  return out;
};

const browser = await chromium.launch({ args: LAUNCH_ARGS });
const byPair = new Map();
for (const id of IDS) {
  const page = await browser.newPage({ viewport: { width: 640, height: 800 }, deviceScaleFactor: 1 });
  await page.route('**/@vite/client*', (r) => r.fulfill({ status: 200, contentType: 'text/javascript', body: HMR_STUB }));
  try {
    await page.goto(`${BASE}/preview.html?piece=character&id=${id}&anim=idle&t=1.5&shot=1`, { waitUntil: 'networkidle', timeout: 120000 });
    await page.waitForFunction('window.__previewReady === true', null, { timeout: 120000 });
    const rows = await page.evaluate(SWEEP, PAIRS);
    for (const r of rows) {
      console.log(`${r.pair.padEnd(16)} ${id.padEnd(12)} body ${r.bodyLuma}  frame ${r.frameLuma}  b-f ${r.bodyMinusFrame >= 0 ? '+' : ''}${r.bodyMinusFrame}  edge-ring ${r.edgeMinusRing}`);
      if (!byPair.has(r.pair)) byPair.set(r.pair, []);
      byPair.get(r.pair).push(r.bodyMinusFrame);
    }
  } catch (e) { console.error(`✗ ${id}: ${e}`); }
  finally { await page.close(); }
}
await browser.close();
console.log('\nmean body-minus-frame per pair (match reference: +0.216):');
for (const [p, v] of byPair) console.log(`  ${p.padEnd(16)} ${(v.reduce((s, x) => s + x, 0) / v.length).toFixed(4)}`);
