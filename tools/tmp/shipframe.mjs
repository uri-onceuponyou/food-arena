#!/usr/bin/env node
/**
 * THROWAWAY read-only probe — do the character findings survive at SHIPPED framing?
 *
 * Boots the real game route, freezes rAF, turns each fighter to face the camera
 * (rAF is frozen so nothing overwrites the yaw), and writes a padded crop of each
 * at the exact pixel size the player sees. Also sweeps the rim light's intensity
 * and reports figure/ground contrast at each step, so the proposed "add a rim"
 * fix can be priced before anyone spends a loop on it.
 */
import { chromium } from 'playwright';
import { mkdir, writeFile } from 'node:fs/promises';

const LAUNCH_ARGS = ['--use-gl=angle', '--use-angle=swiftshader', '--enable-unsafe-swiftshader',
  '--enable-webgl', '--ignore-gpu-blocklist', '--disable-gpu-sandbox'];
const a = process.argv;
const get = (k, d) => (a.includes(k) ? a[a.indexOf(k) + 1] : d);
const BASE = process.env.PREVIEW_BASE ?? 'http://localhost:5173';
const OUT = get('--out', 'shots/probe/ship');
const PAIR = get('--pair', 'donut:pizza');
const YAW = Number(get('--yaw', 0));
const W = Number(get('--w', 1300)), H = Number(get('--h', 740));

const HMR_STUB = `const noop=()=>{};
export const createHotContext=()=>({accept:noop,acceptExports:noop,dispose:noop,prune:noop,
  invalidate:noop,on:noop,off:noop,send:noop,decline:noop,data:{}});
export const injectQuery=(u)=>u; export const updateStyle=noop; export const removeStyle=noop;
export const ErrorOverlay=class{}; export default {};`;

const [P, E] = PAIR.split(':');
const browser = await chromium.launch({ args: LAUNCH_ARGS });
const page = await browser.newPage({ viewport: { width: W, height: H }, deviceScaleFactor: 1 });
page.on('pageerror', (e) => console.error('PAGEERROR', String(e)));
await page.route('**/@vite/client*', (r) => r.fulfill({ status: 200, contentType: 'text/javascript', body: HMR_STUB }));
await page.goto(`${BASE}/?player=${P}&enemy=${E}&simSpeed=1&pointerLock=0`, { waitUntil: 'networkidle', timeout: 90000 });
await page.waitForFunction('window.__gameReady === true', null, { timeout: 90000 });
await page.waitForFunction("document.querySelector('.hud-countdown')?.style.display === 'none'", null, { timeout: 90000 }).catch(() => {});
await page.waitForFunction('window.__stage && window.__stage.scene', null, { timeout: 60000 });
await page.waitForTimeout(1500);
await page.evaluate(() => { window.__raf = window.requestAnimationFrame; window.requestAnimationFrame = () => 0; });
await page.waitForTimeout(300);
await mkdir(OUT, { recursive: true });

const res = await page.evaluate(({ yaw }) => {
  const stage = window.__stage, scene = stage.scene, renderer = stage.renderer, cam = stage.rig.camera;
  const gl = renderer.getContext(), cv = renderer.domElement;
  const W = cv.width, H = cv.height;
  const read = () => { const p = new Uint8Array(W * H * 4); gl.readPixels(0, 0, W, H, gl.RGBA, gl.UNSIGNED_BYTE, p); return p; };
  const shot = () => { stage.render(0); stage.render(0); return read(); };

  const roots = [];
  scene.traverse((o) => {
    if (o.name !== 'head') return;
    let r = o; while (r.parent && r.parent !== scene) r = r.parent;
    if (!roots.includes(r)) roots.push(r);
  });
  roots.forEach((r) => { r.rotation.y = yaw; r.updateMatrixWorld(true); });

  const LAYER = 7;
  const maskOf = (root) => {
    const ms = []; root.traverse((o) => { if (o.isMesh) ms.push(o); });
    if (!ms.length) return null;
    const saved = ms.map((m) => m.layers.mask);
    ms.forEach((m) => m.layers.set(LAYER));
    const cm = cam.layers.mask; cam.layers.set(LAYER);
    const fog = scene.fog, bg = scene.background, sh = renderer.shadowMap.enabled;
    scene.fog = null; scene.background = null; renderer.shadowMap.enabled = false;
    renderer.setRenderTarget(null); renderer.setClearColor(0x00ff00, 1); renderer.clear();
    renderer.render(scene, cam);
    const px = read();
    scene.fog = fog; scene.background = bg; renderer.shadowMap.enabled = sh;
    cam.layers.mask = cm; ms.forEach((m, i) => { m.layers.mask = saved[i]; });
    let x0 = 1e9, x1 = -1e9, y0 = 1e9, y1 = -1e9, n = 0;
    const mask = new Uint8Array(W * H);
    for (let y = 0; y < H; y++) for (let x = 0; x < W; x++) {
      const i = (y * W + x) * 4;
      if (px[i] < 60 && px[i + 1] > 180 && px[i + 2] < 60) continue;
      mask[y * W + x] = 1; n++;
      if (x < x0) x0 = x; if (x > x1) x1 = x; if (y < y0) y0 = y; if (y > y1) y1 = y;
    }
    return n ? { x0, y0, w: x1 - x0 + 1, h: y1 - y0 + 1, n, mask } : null;
  };

  const boxes = roots.map((r) => maskOf(r)).filter(Boolean).sort((p, q) => q.n - p.n);
  const primary = boxes[0];

  // rim sweep, measured as figure/ground on the primary fighter
  const rim = stage.lighting.rim;
  const i0 = rim.intensity;
  const bands = (m) => {
    const inner = new Uint8Array(W * H), outer = new Uint8Array(W * H);
    for (let y = 4; y < H - 4; y++) for (let x = 4; x < W - 4; x++) {
      const j = y * W + x;
      if (!m[j]) continue;
      if (m[j - 1] && m[j + 1] && m[j - W] && m[j + W]) continue;
      for (let dy = -4; dy <= 4; dy++) for (let dx = -4; dx <= 4; dx++) {
        const k = (y + dy) * W + (x + dx);
        if (m[k]) inner[k] = 1; else outer[k] = 1;
      }
    }
    return { inner, outer };
  };
  const sweep = [];
  if (primary) {
    const { inner, outer } = bands(primary.mask);
    for (const v of [0, 0.85, 1.7, 3.4, 6.0, 10.0]) {
      rim.intensity = v;
      const px = shot();
      let li = 0, ni = 0, lo = 0, no = 0, lb = 0, nb = 0, lf = 0, nf = 0;
      for (let j = 0; j < W * H; j++) {
        const i = j * 4;
        const L = (0.2126 * px[i] + 0.7152 * px[i + 1] + 0.0722 * px[i + 2]) / 255;
        if (primary.mask[j]) { lb += L; nb++; if (inner[j]) { li += L; ni++; } }
        else { lf += L; nf++; if (outer[j]) { lo += L; no++; } }
      }
      sweep.push({
        rim: v,
        edgeLuma: +(li / Math.max(1, ni)).toFixed(4),
        ringLuma: +(lo / Math.max(1, no)).toFixed(4),
        edgeMinusRing: +((li / Math.max(1, ni)) - (lo / Math.max(1, no))).toFixed(4),
        bodyLuma: +(lb / Math.max(1, nb)).toFixed(4),
        frameLuma: +(lf / Math.max(1, nf)).toFixed(4),
      });
    }
  }
  rim.intensity = i0;
  shot();
  return {
    canvas: [W, H], dpr: renderer.getPixelRatio(),
    fighters: boxes.map((b) => ({ x0: b.x0, y0: b.y0, w: b.w, h: b.h, n: b.n })),
    sweep,
  };
}, { yaw: YAW });

const dpr = res.dpr || 1;
let i = 0;
for (const b of res.fighters) {
  const cssTop = (res.canvas[1] - (b.y0 + b.h)) / dpr;
  const cssLeft = b.x0 / dpr;
  const cw = b.w / dpr, ch = b.h / dpr;
  const pad = Math.max(cw, ch) * 0.7;
  await page.screenshot({
    path: `${OUT}/${PAIR.replace(':', '-')}_f${i}.png`,
    clip: {
      x: Math.max(0, Math.round(cssLeft - pad)), y: Math.max(0, Math.round(cssTop - pad)),
      width: Math.min(W, Math.round(cw + pad * 2)), height: Math.min(H, Math.round(ch + pad * 2)),
    },
  });
  i++;
}
await page.screenshot({ path: `${OUT}/${PAIR.replace(':', '-')}_full.png` });
console.log(JSON.stringify(res, null, 2));
await writeFile(`${OUT}/${PAIR.replace(':', '-')}.json`, JSON.stringify(res, null, 2));
await browser.close();
