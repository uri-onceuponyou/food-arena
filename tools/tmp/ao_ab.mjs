#!/usr/bin/env node
/**
 * DOES THE PROP GROUNDING REACH THE SCREEN? — the second half of the contested claim.
 *
 * `arena_shadow_ab.mjs` proved the shadow MAP is doing real work (5.4-11.3% of frame).
 * Both blind critics still reported props "not standing on the ground", and the second
 * one was forensic about it: "the purple skirt terminates against the floor on a hard,
 * evenly-lit line with ZERO ambient occlusion" and "the torus has no contact darkening
 * whatsoever". The baked grounding decals are a separate system from the shadow map
 * (`shared.ts:buildContactShadow`, meshes named `contact_shadow__no_outline`), sized
 * ~1.22-1.34x the prop's own footprint — so most of each decal is UNDERNEATH the prop
 * that casts it, which is `docs/LESSONS.md` §1 case 3 exactly.
 *
 * This ablates ONLY those decals and diffs, so "how many pixels of grounding actually
 * reach the screen, and at what contrast" is a number rather than an argument.
 */
import { chromium } from 'playwright';
import sharp from 'sharp';
const arg = (k, d) => { const i = process.argv.indexOf('--' + k); return i < 0 ? d : process.argv[i + 1]; };
const BASE = arg('url', 'http://localhost:5173');
const OUT = arg('out', 'shots/arena/ao_ab');
const STATIONS = arg('stations', '570:430,1150:420,340:500').split(',');
const HMR_STUB = `const noop=()=>{};export const createHotContext=()=>({accept:noop,acceptExports:noop,dispose:noop,prune:noop,invalidate:noop,on:noop,off:noop,send:noop,decline:noop,data:{}});export const injectQuery=(u)=>u;export const updateStyle=noop;export const removeStyle=noop;export const ErrorOverlay=class{};export default {};`;
const SET = (on) => `(() => { let n = 0; window.__stage.scene.traverse((o) => {
  if (o.isMesh && o.name === 'contact_shadow__no_outline') { o.visible = ${on}; n++; } }); return n; })()`;

const b = await chromium.launch({ args: ['--use-gl=angle', '--use-angle=swiftshader', '--enable-unsafe-swiftshader', '--enable-webgl', '--ignore-gpu-blocklist', '--disable-gpu-sandbox'] });
const { mkdir } = await import('node:fs/promises');
await mkdir(OUT, { recursive: true });
console.log('station     decals   px delivered   %frame   mean |dL|   p90 |dL|   max |dL|');
for (const st of STATIONS) {
  const [px, py] = st.split(':');
  const p = await b.newPage({ viewport: { width: 1600, height: 900 }, deviceScaleFactor: 1 });
  await p.route('**/@vite/client*', (r) => r.fulfill({ status: 200, contentType: 'text/javascript', body: HMR_STUB }));
  await p.goto(`${BASE}/?player=hamburger&enemy=donut&px=${px}&py=${py}&fogRadius=993&simSpeed=0.02&pointerLock=0`, { waitUntil: 'networkidle', timeout: 60000 });
  await p.waitForFunction('window.__gameReady === true', null, { timeout: 60000 });
  await p.waitForTimeout(1400);
  const base = await p.screenshot();
  const n = await p.evaluate(SET(false));
  await p.waitForTimeout(600);
  const off = await p.screenshot();
  await p.evaluate(SET(true));
  const A = await sharp(base).removeAlpha().raw().toBuffer({ resolveWithObject: true });
  const B = await sharp(off).removeAlpha().raw().toBuffer();
  const { width, height } = A.info;
  const out = Buffer.alloc(width * height * 3);
  const ds = [];
  for (let i = 0; i < A.data.length; i += 3) {
    const la = (0.2126 * A.data[i] + 0.7152 * A.data[i + 1] + 0.0722 * A.data[i + 2]) / 255;
    const lb = (0.2126 * B[i] + 0.7152 * B[i + 1] + 0.0722 * B[i + 2]) / 255;
    const d = lb - la, g = Math.round(la * 90);
    if (d > 0.01) { ds.push(d); const t = Math.min(1, d / 0.20);
      out[i] = Math.round(80 + 175 * t); out[i + 1] = Math.round(g * (1 - t)); out[i + 2] = Math.round(g * (1 - t)); }
    else { out[i] = g; out[i + 1] = g; out[i + 2] = g; }
  }
  await sharp(out, { raw: { width, height, channels: 3 } }).png().toFile(`${OUT}/${px}_${py}_AOMAP.png`);
  ds.sort((x, y) => x - y);
  const tot = width * height;
  const mean = ds.length ? ds.reduce((a, c) => a + c, 0) / ds.length : 0;
  console.log(`${st.padEnd(11)} ${String(n).padStart(5)}   ${String(ds.length).padStart(10)}   ${((100 * ds.length) / tot).toFixed(2).padStart(6)}%   `
    + `${mean.toFixed(4).padStart(8)}   ${(ds.length ? ds[Math.floor(0.9 * ds.length)] : 0).toFixed(4).padStart(7)}   ${(ds.length ? ds[ds.length - 1] : 0).toFixed(4).padStart(7)}`);
  await p.close();
}
await b.close();
