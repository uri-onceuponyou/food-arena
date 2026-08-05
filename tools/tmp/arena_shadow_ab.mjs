#!/usr/bin/env node
/**
 * DO ARENA PROPS ACTUALLY DARKEN THE FLOOR? — the ablation a critic's claim deserves.
 *
 * A blind critic scored the arena 4/10 naming "props cast no shadow at all while the
 * character casts a long one", and guessed a castShadow flag. `shadowprobe.mjs` already
 * disproved the flag guess (470 of 740 arena meshes cast, the frustum covers the whole
 * arena). So this measures the OUTCOME instead of the setting: render the shipped frame,
 * then re-render with castShadow cleared on every arena mesh ONLY, and diff.
 *
 * Pixels that change ARE the prop shadows. If the diff is near-zero the critic is right
 * for a reason nobody has found yet; if it is large the shadows exist and the real defect
 * is that they do not READ (docs/LESSONS.md §1 — rendering but invisible).
 *
 * The same run also ablates the CHARACTERS' shadows, so the two are measured the same way
 * and "the character's shadow is stronger" becomes a number instead of an impression.
 */
import { chromium } from 'playwright';
import sharp from 'sharp';
const arg = (k, d) => { const i = process.argv.indexOf('--' + k); return i < 0 ? d : process.argv[i + 1]; };
const BASE = arg('url', 'http://localhost:5173');
const OUT = arg('out', 'shots/arena/shadow_ab');
const STATIONS = arg('stations', '570:430,1150:420,340:500').split(',');
const HMR_STUB = `const noop=()=>{};export const createHotContext=()=>({accept:noop,acceptExports:noop,dispose:noop,prune:noop,invalidate:noop,on:noop,off:noop,send:noop,decline:noop,data:{}});export const injectQuery=(u)=>u;export const updateStyle=noop;export const removeStyle=noop;export const ErrorOverlay=class{};export default {};`;

const setCast = (group, on) => `(() => {
  const s = window.__stage.scene; let n = 0;
  s.traverse((o) => {
    if (!o.isMesh) return;
    let p = o, label = '';
    while (p) { if (p.name) label = p.name; p = p.parent; }
    if (label === '${group}' && o.__origCast === undefined) o.__origCast = o.castShadow;
    if (label === '${group}') { o.castShadow = ${on} ? o.__origCast : false; n++; }
  });
  window.__stage.renderer.shadowMap.needsUpdate = true;
  return n;
})()`;

const b = await chromium.launch({ args: ['--use-gl=angle', '--use-angle=swiftshader', '--enable-unsafe-swiftshader', '--enable-webgl', '--ignore-gpu-blocklist', '--disable-gpu-sandbox'] });
const { mkdir } = await import('node:fs/promises');
await mkdir(OUT, { recursive: true });
console.log('station     ablated group        px changed   mean |dL| over changed   max |dL|   share of frame');
for (const st of STATIONS) {
  const [px, py] = st.split(':');
  const p = await b.newPage({ viewport: { width: 1600, height: 900 }, deviceScaleFactor: 1 });
  await p.route('**/@vite/client*', (r) => r.fulfill({ status: 200, contentType: 'text/javascript', body: HMR_STUB }));
  await p.goto(`${BASE}/?player=hamburger&enemy=donut&px=${px}&py=${py}&fogRadius=993&simSpeed=0.02&pointerLock=0`, { waitUntil: 'networkidle', timeout: 60000 });
  await p.waitForFunction('window.__gameReady === true', null, { timeout: 60000 });
  await p.waitForTimeout(1400);
  const canvas = p.locator('canvas');
  const base = await canvas.screenshot();
  await sharp(base).toFile(`${OUT}/${px}_${py}_base.png`);
  for (const group of ['arena:kitchen', 'character:hamburger']) {
    const n = await p.evaluate(setCast(group, false));
    await p.waitForTimeout(600);
    const off = await canvas.screenshot();
    await sharp(off).toFile(`${OUT}/${px}_${py}_no_${group.replace(':', '_')}.png`);
    await p.evaluate(setCast(group, true));
    await p.waitForTimeout(400);
    const A = await sharp(base).removeAlpha().raw().toBuffer();
    const B = await sharp(off).removeAlpha().raw().toBuffer();
    let changed = 0, sum = 0, mx = 0;
    for (let i = 0; i < A.length; i += 3) {
      const la = (0.2126 * A[i] + 0.7152 * A[i + 1] + 0.0722 * A[i + 2]) / 255;
      const lb = (0.2126 * B[i] + 0.7152 * B[i + 1] + 0.0722 * B[i + 2]) / 255;
      const d = Math.abs(la - lb);
      if (d > 0.01) { changed++; sum += d; if (d > mx) mx = d; }
    }
    const total = A.length / 3;
    console.log(`${st.padEnd(11)} ${group.padEnd(20)} ${String(changed).padStart(9)}   ${(changed ? sum / changed : 0).toFixed(4).padStart(20)}   ${mx.toFixed(4).padStart(8)}   ${((100 * changed) / total).toFixed(2).padStart(5)}%   (${n} meshes)`);
  }
  await p.close();
}
await b.close();
