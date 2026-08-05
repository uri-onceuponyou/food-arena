#!/usr/bin/env node
/**
 * THROWAWAY: sweep the key light's ELEVATION and intensity against figure/ground.
 *
 * A steep key lights the floor almost as efficiently as it lights a character (the
 * floor's normal points straight at it), which is why hero and ground sit at the same
 * value. Lowering the elevation costs the floor cos(theta) while a rounded character
 * keeps a face pointed at the light — so the same rig separates them for free.
 */
import { chromium } from 'playwright';
const LAUNCH_ARGS = ['--use-gl=angle', '--use-angle=swiftshader', '--enable-unsafe-swiftshader',
  '--enable-webgl', '--ignore-gpu-blocklist', '--disable-gpu-sandbox'];
const browser = await chromium.launch({ args: LAUNCH_ARGS });
const page = await browser.newPage({ viewport: { width: 1300, height: 740 }, deviceScaleFactor: 1 });
page.on('pageerror', (e) => console.error('PAGEERROR', String(e)));
await page.goto('http://localhost:5173/?player=hamburger&enemy=donut&simSpeed=12', { waitUntil: 'networkidle', timeout: 45000 });
await page.waitForFunction('window.__gameReady === true', null, { timeout: 45000 });
await page.waitForFunction("document.querySelector('.hud-countdown')?.style.display === 'none'", null, { timeout: 60000 });
await page.waitForTimeout(400);
await page.evaluate(() => { window.requestAnimationFrame = () => 0; });
await page.waitForTimeout(200);

const arg = process.argv.indexOf('--grid');
const GRID = arg > 0 ? JSON.parse(process.argv[arg + 1]) : (() => {
  const g = [];
  for (const elev of [55, 46, 38, 32]) for (const key of [3.8, 4.4, 5.0]) g.push({ elev, key });
  return g;
})();

const rows = await page.evaluate(async (GRID) => {
  const THREE = await import('/node_modules/.vite/deps/three.js?import');
  const stage = window.__stage, L = stage.lighting, scene = stage.scene;
  const gl = stage.renderer.getContext(), cv = stage.renderer.domElement;
  const W = cv.width, H = cv.height;
  const frame = new Uint8Array(W * H * 4);

  // Player mask, captured once (geometry does not move — rAF is frozen).
  const player = scene.children.find((o) => o.name?.startsWith?.('character:'));
  const hidden = [];
  for (const c of scene.children) {
    if (c === player || c.name === 'lighting' || c.type.endsWith('Camera')) continue;
    if (c.visible) { hidden.push(c); c.visible = false; }
  }
  const fog = scene.fog, bg = scene.background;
  scene.fog = null; scene.background = null;
  stage.renderer.setRenderTarget(null);
  stage.renderer.setClearColor(0x000000, 1);
  stage.renderer.clear();
  stage.renderer.render(scene, stage.rig.camera);
  const mask = new Uint8Array(W * H * 4);
  gl.readPixels(0, 0, W, H, gl.RGBA, gl.UNSIGNED_BYTE, mask);
  for (const c of hidden) c.visible = true;
  scene.fog = fog; scene.background = bg;

  const isBody = (i) => mask[i] + mask[i + 1] + mask[i + 2] > 12;
  const tgt = L.key.target.position.clone();
  const az = Math.atan2(7, 9);          // keep the shipped azimuth exactly
  const out = [];
  for (const g of GRID) {
    const r = 19.65;                     // keep the shipped distance
    const e = (g.elev * Math.PI) / 180;
    L.key.position.set(tgt.x + r * Math.cos(e) * Math.cos(az), r * Math.sin(e), tgt.z + r * Math.cos(e) * Math.sin(az));
    L.key.intensity = g.key;
    if (g.rim !== undefined) L.rim.intensity = g.rim;
    if (g.rimElev !== undefined) {
      const rr = 15.3, re = (g.rimElev * Math.PI) / 180, raz = Math.atan2(-11, -8);
      L.rim.position.set(rr * Math.cos(re) * Math.cos(raz), rr * Math.sin(re), rr * Math.cos(re) * Math.sin(raz));
    }
    if (g.fill !== undefined) L.fill.intensity = g.fill;
    if (g.contrast !== undefined) stage.grade.contrast = g.contrast;
    if (g.hk !== undefined) stage.grade.highlightKnee = g.hk;
    if (g.sat !== undefined) stage.grade.saturation = g.sat;
    if (g.amb !== undefined) L.ambient.intensity = g.amb;
    if (g.skyHex !== undefined) L.fill.color.setHex(g.skyHex);
    if (g.bloomT !== undefined) { const bl = stage.composer.passes.flatMap(pp => pp.effects ?? []).find(e => e.name === 'BloomEffect'); if (bl) bl.luminanceMaterial.threshold = g.bloomT; }
    L.key.target.updateMatrixWorld();
    stage.render(1 / 60); stage.render(1 / 60);
    gl.readPixels(0, 0, W, H, gl.RGBA, gl.UNSIGNED_BYTE, frame);
    const lum = (i) => (0.2126 * frame[i] + 0.7152 * frame[i + 1] + 0.0722 * frame[i + 2]) / 255;
    let bN = 0, bS = 0, bx = 0, by = 0, full = 0, n = 0, val = 0, sat = 0;
    const allLum = new Float64Array(W * H);
    for (let y = 0; y < H; y++) for (let x = 0; x < W; x++) {
      const i = (y * W + x) * 4; n++;
      const mx = Math.max(frame[i], frame[i + 1], frame[i + 2]), mn = Math.min(frame[i], frame[i + 1], frame[i + 2]);
      val += mx / 255; sat += mx === 0 ? 0 : (mx - mn) / mx;
      if (frame[i] === 255 || frame[i + 1] === 255 || frame[i + 2] === 255) full++;
      allLum[y * W + x] = lum(i);
      if (isBody(i)) { bN++; bS += lum(i); bx += x; by += y; }
    }
    const cx = Math.round(bx / bN), cy = Math.round(by / bN);
    let aN = 0, aS = 0;
    for (let y = Math.max(0, cy - 140); y < Math.min(H, cy + 140); y++)
      for (let x = Math.max(0, cx - 140); x < Math.min(W, cx + 140); x++) {
        const d2 = (x - cx) ** 2 + (y - cy) ** 2;
        if (d2 < 55 * 55 || d2 > 140 * 140) continue;
        const i = (y * W + x) * 4;
        if (isBody(i)) continue;
        aN++; aS += lum(i);
      }
    const srt = Float64Array.from(allLum).sort();
    out.push({ ...g, body: bS / bN, floor: aS / aN, delta: Math.abs(bS / bN - aS / aN),
      meanVal: val / n, meanSat: sat / n, fullPct: 100 * full / n,
      p05: srt[Math.floor(0.05 * srt.length)], lumMed: srt[Math.floor(0.5 * srt.length)] });
  }
  return out;
}, GRID);

console.log('\nconfig                              body   floor  L1 delta  lumMed  p05    meanSat  clip%');
for (const r of rows) {
  const tag = `e${r.elev} k${r.key}${r.rim !== undefined ? ' rim' + r.rim : ''}${r.rimElev !== undefined ? '@' + r.rimElev : ''}${r.fill !== undefined ? ' fill' + r.fill : ''}${r.amb !== undefined ? ' amb' + r.amb : ''}${r.bloomT !== undefined ? ' bT' + r.bloomT : ''}${r.contrast !== undefined ? ' c' + r.contrast : ''}${r.hk !== undefined ? ' hk' + r.hk : ''}`;
  console.log(`${tag.padEnd(34)}  ${r.body.toFixed(3)}  ${r.floor.toFixed(3)}   `
    + `${r.delta.toFixed(3)}     ${r.lumMed.toFixed(3)}   ${r.p05.toFixed(3)}  ${r.meanSat.toFixed(3)}    ${r.fullPct.toFixed(2)}%`);
}
console.log('\nshipped baseline r0: L1 delta 0.094, meanVal 0.662, meanSat 0.503, anyChan==255 10.60%');
await browser.close();
