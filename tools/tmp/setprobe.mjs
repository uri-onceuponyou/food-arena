#!/usr/bin/env node
/**
 * THROWAWAY probe — what is the menu portrait's set actually made of, and what does
 * each piece deliver to the screen?
 *
 * Written because the first render of the new set came back with a white floor and two
 * visible quadrilaterals, and `docs/LESSONS.md` §1/§2 both say the same thing: do not
 * reason about it, replace it with something unmissable and look.
 *
 * Reports, per named mesh: material type, blending mode, whether the geometry carries a
 * `color` attribute at all, and the vertex-colour range. Then renders four ablations
 * (all on / no ground decal / no foot decal / neither) and samples a fixed grid, so the
 * contribution of each decal is a number rather than an impression.
 */
/**
 * capture-audit: css-immune — `gl.readPixels()` off `window.__stage`, on `index.html`. The screen fade DOES run here —
 * and it cannot reach the drawing buffer, which is composited after this read. (The live
 * hazard on this path is a DISPOSED stage, which is a different defect; see ab_probe.mjs.)
 */
import { chromium } from 'playwright';

const LAUNCH_ARGS = ['--use-gl=angle', '--use-angle=swiftshader', '--enable-unsafe-swiftshader',
  '--enable-webgl', '--ignore-gpu-blocklist', '--disable-gpu-sandbox'];
const argv = process.argv;
const get = (k, d) => (argv.includes(k) ? argv[argv.indexOf(k) + 1] : d);
const BASE = get('--url', process.env.PREVIEW_BASE ?? 'http://localhost:5173');

const HMR_STUB = `const noop=()=>{};
export const createHotContext=()=>({accept:noop,acceptExports:noop,dispose:noop,prune:noop,
  invalidate:noop,on:noop,off:noop,send:noop,decline:noop,data:{}});
export const injectQuery=(u)=>u; export const updateStyle=noop; export const removeStyle=noop;
export const ErrorOverlay=class{}; export default {};`;

const PROBE = () => {
  const stage = window.__stage;
  const scene = stage.scene;
  const renderer = stage.renderer;
  const gl = renderer.getContext();
  const cv = renderer.domElement;
  const W = cv.width, H = cv.height;
  const read = () => { const p = new Uint8Array(W * H * 4); gl.readPixels(0, 0, W, H, gl.RGBA, gl.UNSIGNED_BYTE, p); return p; };
  // readPixels origin is BOTTOM-left; fy is measured from the TOP like every other
  // number in this project, so flip it here once rather than in every caller.
  const at = (px, fx, fy) => {
    const x = Math.round(fx * (W - 1));
    const y = Math.round((1 - fy) * (H - 1));
    const i = (y * W + x) * 4;
    return [px[i], px[i + 1], px[i + 2]];
  };

  const meshes = [];
  scene.traverse((o) => {
    if (!o.isMesh || !o.name.startsWith('menu_')) return;
    const g = o.geometry;
    const c = g.attributes.color;
    let lo = null, hi = null;
    if (c) {
      lo = Infinity; hi = -Infinity;
      for (let i = 0; i < c.count; i++) { const v = c.getX(i); if (v < lo) lo = v; if (v > hi) hi = v; }
    }
    meshes.push({
      name: o.name,
      visible: o.visible,
      mat: o.material.type,
      blending: o.material.blending,
      transparent: o.material.transparent,
      depthWrite: o.material.depthWrite,
      vertexColors: o.material.vertexColors === true,
      hasColorAttr: !!c,
      colorRange: c ? [+lo.toFixed(3), +hi.toFixed(3)] : null,
      color: o.material.color ? `#${o.material.color.getHexString()}` : null,
      renderOrder: o.renderOrder,
      y: +o.position.y.toFixed(3),
    });
  });

  stage.rig.yawDeg = 0;
  stage.rig.update(0);

  const gd = scene.getObjectByName('menu_ground_decal');
  const fd = scene.getObjectByName('menu_foot_decal');
  const SAMPLES = [
    ['wall-top-L', 0.10, 0.12], ['wall-top-R', 0.90, 0.12],
    ['wall-mid-L', 0.08, 0.35], ['wall-mid-R', 0.92, 0.35],
    ['floor-far-L', 0.10, 0.52], ['floor-far-R', 0.90, 0.52],
    ['floor-mid-L', 0.12, 0.72], ['floor-mid-R', 0.88, 0.72],
    ['floor-near-L', 0.10, 0.95], ['floor-near-R', 0.90, 0.95],
    ['under-plinth', 0.50, 0.97],
  ];
  const cases = [
    ['all-on', true, true],
    ['no-ground-decal', false, true],
    ['no-foot-decal', true, false],
    ['no-decals', false, false],
  ];
  const out = [];
  for (const [label, g, f] of cases) {
    if (gd) gd.visible = g;
    if (fd) fd.visible = f;
    stage.render(0); stage.render(0);
    const px = read();
    const row = { label, samples: {} };
    for (const [n, fx, fy] of SAMPLES) row.samples[n] = at(px, fx, fy);
    out.push(row);
  }
  if (gd) gd.visible = true;
  if (fd) fd.visible = true;
  return { meshes, cases: out, canvas: `${W}x${H}` };
};

const browser = await chromium.launch({ args: LAUNCH_ARGS });
const page = await browser.newPage({ viewport: { width: 1600, height: 900 }, deviceScaleFactor: 1 });
await page.route('**/@vite/client*', (r) => r.fulfill({ status: 200, contentType: 'text/javascript', body: HMR_STUB }));
page.on('pageerror', (e) => console.error('PAGEERROR', String(e)));
await page.goto(`${BASE}/?screen=home`, { waitUntil: 'networkidle', timeout: 120000 });
await page.waitForFunction('window.__screen === "home" && window.__screenReady === true', null, { timeout: 120000 });
await page.waitForTimeout(4000);
const res = await page.evaluate(PROBE);
await browser.close();

console.log(`canvas ${res.canvas}`);
console.log('\nMESHES');
for (const m of res.meshes) {
  console.log(`  ${m.name.padEnd(20)} vis=${m.visible} ${m.mat.padEnd(22)} blend=${m.blending} trans=${m.transparent} dw=${m.depthWrite}`
    + ` vc=${m.vertexColors} attr=${m.hasColorAttr} range=${JSON.stringify(m.colorRange)} col=${m.color} ro=${m.renderOrder} y=${m.y}`);
}
console.log('\nSAMPLES (rgb 0-255)');
const names = Object.keys(res.cases[0].samples);
console.log('  ' + 'sample'.padEnd(14) + res.cases.map((c) => c.label.padEnd(20)).join(''));
for (const n of names) {
  console.log('  ' + n.padEnd(14) + res.cases.map((c) => JSON.stringify(c.samples[n]).padEnd(20)).join(''));
}
