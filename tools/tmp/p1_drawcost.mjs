#!/usr/bin/env node
// capture-audit: css-immune — no capture at all; renderer.info only.
/**
 * P1_DRAWCOST — what does a SECOND GEOMETRY PASS actually cost on HEAD?
 *
 * `docs/STATE.md` lead 2 prices SSAO at "+314 draw calls / +79% triangles". That figure
 * came from a tree where `ao: true` was temporarily set; on HEAD `Stage`'s `useAO` is
 * never true from anywhere in `src/**` (grep: zero `ao:` call sites), so the number
 * cannot be reproduced without a source edit. It CAN be bounded exactly, because the
 * whole of SSAO's draw cost is `NormalPass`, and a `NormalPass` is one extra full scene
 * render with `scene.overrideMaterial` set. That is measurable on HEAD, read-only.
 *
 * `renderer.info.autoReset` MUST be false or a post-processed frame reports only the
 * LAST pass (`docs/LESSONS.md` §12).
 */
import { chromium } from 'playwright';
import { settleScreen } from './settle.mjs';

const a = process.argv;
const get = (k, d) => (a.includes(k) ? a[a.indexOf(k) + 1] : d);
const BASE = (process.env.PREVIEW_BASE ?? get('--url', 'http://localhost:5173')).replace(/\/$/, '');
const W = Number(get('--w', 1300));
const H = Number(get('--h', 740));

const HMR_STUB = `const noop=()=>{};
export const createHotContext=()=>({accept:noop,acceptExports:noop,dispose:noop,prune:noop,
  invalidate:noop,on:noop,off:noop,send:noop,decline:noop,data:{}});
export const injectQuery=(u)=>u; export const updateStyle=noop; export const removeStyle=noop;
export const ErrorOverlay=class{}; export default {};`;

const browser = await chromium.launch({ args: ['--use-gl=angle', '--use-angle=swiftshader',
  '--enable-unsafe-swiftshader', '--enable-webgl', '--ignore-gpu-blocklist', '--disable-gpu-sandbox'] });
const page = await browser.newPage({ viewport: { width: W, height: H }, deviceScaleFactor: 1 });
await page.route('**/@vite/client*', (r) => r.fulfill({ status: 200, contentType: 'text/javascript', body: HMR_STUB }));
page.on('pageerror', (e) => console.error('PAGEERROR', String(e)));
await page.goto(`${BASE}/?player=hamburger&enemy=donut&px=700&py=640&fogRadius=850&simSpeed=0.02&pointerLock=0`,
  { waitUntil: 'networkidle', timeout: 90000 });
await page.waitForFunction('window.__gameReady === true', null, { timeout: 90000 });
await settleScreen(page, { timeout: 60000, soft: true, label: 'drawcost' });
await page.evaluate(() => { window.requestAnimationFrame = () => 0; });
await page.waitForTimeout(300);

const r = await page.evaluate(() => {
  const stage = window.__stage;
  const { scene, renderer } = stage;
  const cam = stage.rig.camera;
  renderer.info.autoReset = false;

  const grab = () => ({ calls: renderer.info.render.calls, tris: renderer.info.render.triangles });

  // 1. the SHIPPED frame, whole composed chain, shadow map allowed to redraw
  renderer.info.reset();
  stage.render(0.0);
  const full = grab();

  // 2. the shipped frame with the shadow map frozen (it is already autoUpdate=false;
  //    force it dirty to price the shadow pass, then let it settle again)
  renderer.info.reset();
  stage.render(0.0);
  const settled = grab();

  // 3. ONE extra full scene render with an override material — exactly what a
  //    postprocessing NormalPass does. Any override material gives the same DRAW count.
  const proto = (() => { let m = null; scene.traverse((o) => { if (!m && o.isMesh) m = Array.isArray(o.material) ? o.material[0] : o.material; }); return m; })();
  const ov = proto.clone();
  const saveOv = scene.overrideMaterial;
  const saveBg = scene.background;
  scene.overrideMaterial = ov;
  scene.background = null;
  renderer.setRenderTarget(null);
  renderer.info.reset();
  renderer.render(scene, cam);
  const normalPass = grab();
  scene.overrideMaterial = saveOv;
  scene.background = saveBg;
  ov.dispose();

  // 4. a plain scene render with NO override, for comparison
  renderer.info.reset();
  renderer.render(scene, cam);
  const plain = grab();

  renderer.info.autoReset = true;
  stage.render(0.0);
  return { full, settled, normalPass, plain,
    programs: renderer.info.programs?.length ?? null,
    buffer: `${renderer.domElement.width}x${renderer.domElement.height}`,
    passes: (stage.composer?.passes ?? []).map((p) => p.constructor.name + (p.effects ? `(${p.effects.map((e) => e.name).join('+')})` : '')) };
});
await browser.close();

console.log(`\nDRAW COST — buffer ${r.buffer}, programs ${r.programs}`);
console.log('post chain:', r.passes.join(' -> '));
console.log(`\n  shipped frame (1st render, shadow map may redraw) .... ${r.full.calls} draws, ${r.full.tris.toLocaleString()} tris`);
console.log(`  shipped frame (2nd, settled) ......................... ${r.settled.calls} draws, ${r.settled.tris.toLocaleString()} tris`);
console.log(`  ONE extra scene render, overrideMaterial (= NormalPass) ${r.normalPass.calls} draws, ${r.normalPass.tris.toLocaleString()} tris`);
console.log(`  ONE extra scene render, no override .................. ${r.plain.calls} draws, ${r.plain.tris.toLocaleString()} tris`);
console.log(`\n  => enabling SSAO adds the NormalPass row on top of the settled frame:`);
console.log(`     ${r.settled.calls} -> ${r.settled.calls + r.normalPass.calls} draws  (+${r.normalPass.calls}, +${((100 * r.normalPass.calls) / r.settled.calls).toFixed(0)}%)`);
console.log(`     ${r.settled.tris.toLocaleString()} -> ${(r.settled.tris + r.normalPass.tris).toLocaleString()} tris  (+${((100 * r.normalPass.tris) / r.settled.tris).toFixed(0)}%)`);
