#!/usr/bin/env node
/**
 * THROWAWAY probe for the render-perf pass. Answers three questions that the
 * ablation in `tools/perf.mjs` cannot, because they need to poke the live scene:
 *
 *  1. How many draw calls does the SHADOW pass actually cost, split into the
 *     static arena and the two moving characters?
 *  2. What is the size distribution of the 636 shadow casters, and how many draws
 *     would a "too small to cast a visible shadow" cull remove?
 *  3. Same for the 431 inverted-hull outlines.
 *
 * Uses `renderer.info` with `autoReset = false`, because after `composer.render()`
 * three has already reset the counters for every pass but the last (documented in
 * the perf commit).
 *
 * Usage: node tools/tmp/perfpass_probe.mjs --url http://localhost:5191
 */
import { chromium } from 'playwright';

const LAUNCH_ARGS = ['--use-gl=angle', '--use-angle=swiftshader', '--enable-unsafe-swiftshader',
  '--enable-webgl', '--ignore-gpu-blocklist', '--disable-gpu-sandbox'];
const a = process.argv;
const get = (k, d) => (a.includes(k) ? a[a.indexOf(k) + 1] : d);
const base = get('--url', 'http://localhost:5191').replace(/\/$/, '');
const url = get('--game', `${base}/?player=hamburger&enemy=donut&simSpeed=12`);

const browser = await chromium.launch({ args: LAUNCH_ARGS });
const page = await browser.newPage({ viewport: { width: 1300, height: 740 }, deviceScaleFactor: 1 });
page.on('pageerror', (e) => console.error('PAGEERROR', String(e)));
// Vite HMR would full-reload the page mid-probe when a peer saves.
await page.route('**/@vite/client*', (r) => r.fulfill({
  status: 200, contentType: 'text/javascript',
  body: `const noop=()=>{};export const createHotContext=()=>({accept:noop,acceptExports:noop,dispose:noop,prune:noop,invalidate:noop,on:noop,off:noop,send:noop,decline:noop,data:{}});export const injectQuery=(u)=>u;export const updateStyle=noop;export const removeStyle=noop;export const ErrorOverlay=class{};export default {};`,
}));
await page.goto(url, { waitUntil: 'networkidle', timeout: 60000 });
await page.waitForFunction('window.__gameReady === true', null, { timeout: 60000 });
await page.waitForFunction("document.querySelector('.hud-countdown')?.style.display === 'none'", null, { timeout: 90000 });
await page.waitForTimeout(600);

const res = await page.evaluate(() => {
  const stage = window.__stage;
  const r = stage.renderer;
  const scene = stage.scene;
  r.info.autoReset = false;

  const measure = () => { r.info.reset(); stage.render(1 / 60); return r.info.render.calls; };

  // Full frame, then the same frame with the shadow map frozen.
  r.shadowMap.autoUpdate = true;
  const withShadow = measure();
  r.shadowMap.autoUpdate = false;
  r.shadowMap.needsUpdate = false;
  const noShadow = measure();
  r.shadowMap.autoUpdate = true;

  // Census.
  const sphere = new (Object.getPrototypeOf(scene).constructor.prototype.constructor ? Object : Object)();
  const casters = [];
  const outlines = [];
  scene.updateMatrixWorld(true);
  scene.traverse((o) => {
    if (!o.isMesh) return;
    const geo = o.geometry;
    if (!geo) return;
    if (!geo.boundingSphere) geo.computeBoundingSphere();
    const s = geo.boundingSphere ? geo.boundingSphere.radius : 0;
    // World-space radius: geometry radius times the largest world scale.
    const e = o.matrixWorld.elements;
    const sx = Math.hypot(e[0], e[1], e[2]);
    const sy = Math.hypot(e[4], e[5], e[6]);
    const sz = Math.hypot(e[8], e[9], e[10]);
    const rad = s * Math.max(sx, sy, sz);
    const rec = { name: o.name || '(anon)', rad, visible: o.visible };
    if (o.castShadow) casters.push(rec);
    if (/__outline$/.test(o.name || '')) outlines.push(rec);
  });

  const buckets = (list, edges) => edges.map((e, i) => {
    const lo = i === 0 ? 0 : edges[i - 1];
    return { lt: e, n: list.filter((c) => c.rad >= lo && c.rad < e).length };
  });
  const EDGES = [0.02, 0.04, 0.06, 0.08, 0.12, 0.2, 0.35, 0.6, 1e9];

  // What would culling small casters cost/save, measured for real.
  const cullTrial = (thresh) => {
    const flipped = [];
    scene.traverse((o) => {
      if (!o.isMesh || !o.castShadow) return;
      const geo = o.geometry;
      if (!geo) return;
      if (!geo.boundingSphere) geo.computeBoundingSphere();
      const e = o.matrixWorld.elements;
      const sc = Math.max(Math.hypot(e[0], e[1], e[2]), Math.hypot(e[4], e[5], e[6]), Math.hypot(e[8], e[9], e[10]));
      if (geo.boundingSphere.radius * sc < thresh) { o.castShadow = false; flipped.push(o); }
    });
    const draws = measure();
    for (const o of flipped) o.castShadow = true;
    return { thresh, culled: flipped.length, draws };
  };

  const trials = [0.03, 0.05, 0.08, 0.12].map(cullTrial);
  measure(); // restore

  // Outline split: how many of the 132 outline draws are the arena's thick prop ink
  // (0.016) versus the characters' hairline (0.004)?
  const hulls = [];
  scene.traverse((o) => {
    if (o.isMesh && /__outline$/.test(o.name || '')) {
      const t = o.material?.uniforms?.outlineThickness?.value ?? -1;
      hulls.push({ o, t });
    }
  });
  const hideTrial = (pred) => {
    const hidden = hulls.filter((h) => pred(h)).map((h) => h.o);
    for (const o of hidden) o.visible = false;
    const draws = measure();
    for (const o of hidden) o.visible = true;
    return { n: hidden.length, draws };
  };
  const outlineSplit = {
    all: hideTrial(() => true),
    propInk: hideTrial((h) => h.t >= 0.012),
    thinInk: hideTrial((h) => h.t < 0.012),
    thicknesses: [...new Set(hulls.map((h) => h.t))].sort(),
  };
  measure();

  return {
    outlineSplit,
    drawsFull: withShadow,
    drawsNoShadowPass: noShadow,
    shadowPassDraws: withShadow - noShadow,
    casterCount: casters.length,
    outlineCount: outlines.length,
    casterBuckets: buckets(casters, EDGES),
    outlineBuckets: buckets(outlines, EDGES),
    trials,
    smallestCasters: casters.slice().sort((x, y) => x.rad - y.rad).slice(0, 15)
      .map((c) => `${c.name}:${c.rad.toFixed(3)}`),
  };
});

console.log(JSON.stringify(res, null, 1));
await browser.close();
