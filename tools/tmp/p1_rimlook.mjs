#!/usr/bin/env node
// capture-audit: css-immune — gl.readPixels only, no DOM screenshot, no element rect.
/**
 * P1_RIMLOOK — render the rim mutation and LOOK at it (`CLAUDE.md` non-negotiable #3).
 *
 * `p1_rimreach.mjs` reported the CAST responding EXACTLY 0.0000 to its own rim uniform
 * while arena surfaces with no rim at all appeared to respond by 40/255. Both cannot be
 * true, so the numbers are not the thing to reason about — the frame is.
 *
 * Drives every reachable `rimStrength` to a garish value with a pure-red `rimColor`,
 * with bloom ablated, and writes A / B / amplified diff so the rim's actual footprint is
 * visible. Also prints, per top-level scene root, how many of its pixels moved.
 */
import { mkdir, writeFile } from 'node:fs/promises';
import { join } from 'node:path';
import { chromium } from 'playwright';
import sharp from 'sharp';
import { settleScreen } from './settle.mjs';

const a = process.argv;
const get = (k, d) => (a.includes(k) ? a[a.indexOf(k) + 1] : d);
const BASE = (process.env.PREVIEW_BASE ?? get('--url', 'http://localhost:5173')).replace(/\/$/, '');
const OUT = get('--out', 'shots/p1');
const ID = get('--id', 'hamburger');
const HOT = Number(get('--hot', 6));
const W = Number(get('--w', 1300));
const H = Number(get('--h', 740));

const HMR_STUB = `const noop=()=>{};
export const createHotContext=()=>({accept:noop,acceptExports:noop,dispose:noop,prune:noop,
  invalidate:noop,on:noop,off:noop,send:noop,decline:noop,data:{}});
export const injectQuery=(u)=>u; export const updateStyle=noop; export const removeStyle=noop;
export const ErrorOverlay=class{}; export default {};`;

const PROBE = ({ hot }) => {
  const stage = window.__stage;
  const { scene, renderer } = stage;
  const gl = renderer.getContext();
  const w = renderer.domElement.width; const h = renderer.domElement.height; const n = w * h;
  const read = () => { const b = new Uint8Array(n * 4); gl.readPixels(0, 0, w, h, gl.RGBA, gl.UNSIGNED_BYTE, b); return b; };
  const shot = () => { stage.render(0.0); return read(); };
  const props = renderer.properties;

  const seen = new Set(); const handles = []; const byRoot = new Map();
  const topOf = (o) => { let p = o; while (p.parent && p.parent !== scene) p = p.parent; return p; };
  scene.traverse((o) => {
    if (!o.isMesh) return;
    const list = Array.isArray(o.material) ? o.material : [o.material];
    for (const m of list) {
      if (!m || seen.has(m.uuid)) continue;
      seen.add(m.uuid);
      const pu = props.get(m)?.uniforms;
      const ud = m.userData && m.userData.rimUniforms;
      const src = (pu && pu.rimStrength) ? 'props' : (ud && ud.rimStrength ? 'userData' : null);
      if (!src) continue;
      const u = src === 'props' ? pu : ud;
      handles.push({ u, root: topOf(o).name || '(root)', src, type: m.type });
      byRoot.set(topOf(o).name, (byRoot.get(topOf(o).name) ?? 0) + 1);
    }
  });

  const passes = stage.composer ? stage.composer.passes : [];
  const fx = passes.flatMap((p) => p.effects ?? []);
  const bloom = fx.find((e) => e.name === 'BloomEffect') ?? null;
  const was = bloom ? bloom.intensity : null;
  if (bloom) bloom.intensity = 0;

  const A = shot();
  const orig = handles.map((x) => x.u.rimStrength.value);
  const origC = handles.map((x) => (x.u.rimColor ? x.u.rimColor.value.clone() : null));
  handles.forEach((x) => { x.u.rimStrength.value = hot; if (x.u.rimColor) x.u.rimColor.value.setRGB(1, 0, 0); });
  const B = shot();
  handles.forEach((x, i) => { x.u.rimStrength.value = orig[i]; if (origC[i]) x.u.rimColor.value.copy(origC[i]); });
  if (bloom) bloom.intensity = was;
  stage.render(0.0);

  const flip = (src, ch) => { const o = new Uint8Array(w * h * ch);
    for (let y = 0; y < h; y++) for (let x = 0; x < w; x++) {
      const s = ((h - 1 - y) * w + x) * 4; const d = (y * w + x) * ch;
      o[d] = src[s]; o[d + 1] = src[s + 1]; o[d + 2] = src[s + 2];
    } return o; };
  const D = new Uint8Array(w * h * 3);
  let moved = 0; let sum = 0;
  for (let p = 0; p < n; p++) {
    const d = Math.max(Math.abs(A[p * 4] - B[p * 4]), Math.abs(A[p * 4 + 1] - B[p * 4 + 1]), Math.abs(A[p * 4 + 2] - B[p * 4 + 2]));
    sum += d; if (d > 1) moved++;
    const v = Math.min(255, d * 8);
    D[p * 3] = v; D[p * 3 + 1] = v; D[p * 3 + 2] = v;
  }
  const Df = new Uint8Array(w * h * 3);
  for (let y = 0; y < h; y++) Df.set(D.subarray((h - 1 - y) * w * 3, (h - y) * w * 3), y * w * 3);

  const b64 = (arr) => { let s = ''; const CH = 0x8000;
    for (let i = 0; i < arr.length; i += CH) s += String.fromCharCode.apply(null, arr.subarray(i, i + CH));
    return btoa(s); };

  return { w, h, handles: handles.length,
    bySrc: handles.reduce((o, x) => ({ ...o, [x.src]: (o[x.src] ?? 0) + 1 }), {}),
    byRoot: [...byRoot.entries()],
    movedPct: +((100 * moved) / n).toFixed(3), meanD: +(sum / n).toFixed(4),
    a: b64(flip(A, 3)), b: b64(flip(B, 3)), d: b64(Df) };
};

await mkdir(OUT, { recursive: true });
const browser = await chromium.launch({ args: ['--use-gl=angle', '--use-angle=swiftshader',
  '--enable-unsafe-swiftshader', '--enable-webgl', '--ignore-gpu-blocklist', '--disable-gpu-sandbox'] });
const page = await browser.newPage({ viewport: { width: W, height: H }, deviceScaleFactor: 1 });
await page.route('**/@vite/client*', (r) => r.fulfill({ status: 200, contentType: 'text/javascript', body: HMR_STUB }));
page.on('pageerror', (e) => console.error('PAGEERROR', String(e)));
await page.goto(`${BASE}/?player=${ID}&enemy=donut&px=700&py=640&fogRadius=850&simSpeed=0.02&pointerLock=0`,
  { waitUntil: 'networkidle', timeout: 90000 });
await page.waitForFunction('window.__gameReady === true', null, { timeout: 90000 });
await settleScreen(page, { timeout: 60000, soft: true, label: 'rimlook' });
await page.evaluate(() => { window.requestAnimationFrame = () => 0; });
await page.waitForTimeout(300);
const r = await page.evaluate(PROBE, { hot: HOT });
await browser.close();

console.log(`rim handles: ${r.handles}  by source ${JSON.stringify(r.bySrc)}`);
console.log('by scene root:', JSON.stringify(r.byRoot));
console.log(`rimStrength -> ${HOT}, rimColor -> pure red, bloom ablated:`);
console.log(`  frame moved on ${r.movedPct}% of pixels, mean |dRGB| ${r.meanD}/255`);
for (const [k, v] of [['a', 'shipped'], ['b', `rim${HOT}_red`], ['d', 'diff_x8']]) {
  await sharp(Buffer.from(r[k], 'base64'), { raw: { width: r.w, height: r.h, channels: 3 } })
    .png().toFile(join(OUT, `rimlook_${v}.png`));
}
await writeFile(join(OUT, 'rimlook.json'), JSON.stringify({ handles: r.handles, bySrc: r.bySrc, byRoot: r.byRoot, movedPct: r.movedPct, meanD: r.meanD }, null, 2));
console.log(`wrote ${OUT}/rimlook_{shipped,rim${HOT}_red,diff_x8}.png`);
