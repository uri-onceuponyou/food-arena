#!/usr/bin/env node
/**
 * THROWAWAY read-only probe — WHERE does the rim light land?
 *
 * Renders the shipped post-processed frame, ablates one light, and paints the
 * absolute difference (amplified) over the page so the contribution can be SEEN,
 * not just averaged. Works on preview.html and on the real game route.
 *
 *   node tools/tmp/rimviz.mjs --url "<url>" --out shots/probe/x --light rim --gain 6
 *
 * On the game route it also reports the two fighters' screen boxes and writes a
 * crop around the player at shipped framing.
 */
import { chromium } from 'playwright';
import { mkdir, writeFile } from 'node:fs/promises';

const LAUNCH_ARGS = ['--use-gl=angle', '--use-angle=swiftshader', '--enable-unsafe-swiftshader',
  '--enable-webgl', '--ignore-gpu-blocklist', '--disable-gpu-sandbox'];
const a = process.argv;
const get = (k, d) => (a.includes(k) ? a[a.indexOf(k) + 1] : d);
const url = get('--url', 'http://localhost:5173/preview.html?piece=character&id=donut&anim=idle&t=1.5&shot=1');
const OUT = get('--out', 'shots/probe/rimviz');
const GAIN = Number(get('--gain', 6));
const W = Number(get('--w', 900)), H = Number(get('--h', 1100));
const isGame = !url.includes('preview.html');

const HMR_STUB = `const noop=()=>{};
export const createHotContext=()=>({accept:noop,acceptExports:noop,dispose:noop,prune:noop,
  invalidate:noop,on:noop,off:noop,send:noop,decline:noop,data:{}});
export const injectQuery=(u)=>u; export const updateStyle=noop; export const removeStyle=noop;
export const ErrorOverlay=class{}; export default {};`;

const browser = await chromium.launch({ args: LAUNCH_ARGS });
const page = await browser.newPage({ viewport: { width: W, height: H }, deviceScaleFactor: 1 });
page.on('pageerror', (e) => console.error('PAGEERROR', String(e)));
await page.route('**/@vite/client*', (r) => r.fulfill({ status: 200, contentType: 'text/javascript', body: HMR_STUB }));
await page.goto(url, { waitUntil: 'networkidle', timeout: 90000 });
if (isGame) {
  await page.waitForFunction('window.__gameReady === true', null, { timeout: 90000 });
  await page.waitForFunction("document.querySelector('.hud-countdown')?.style.display === 'none'", null, { timeout: 90000 }).catch(() => {});
} else {
  await page.waitForFunction('window.__previewReady === true', null, { timeout: 90000 });
}
await page.waitForFunction('window.__stage && window.__stage.scene', null, { timeout: 60000 });
await page.waitForTimeout(1200);
await page.evaluate(() => { window.__raf = window.requestAnimationFrame; window.requestAnimationFrame = () => 0; });
await page.waitForTimeout(300);
await mkdir(OUT, { recursive: true });

await page.screenshot({ path: `${OUT}/full.png` });

const res = await page.evaluate(({ gain, which }) => {
  const stage = window.__stage;
  const scene = stage.scene;
  const renderer = stage.renderer;
  const cam = stage.rig.camera;
  const gl = renderer.getContext();
  const cv = renderer.domElement;
  const W = cv.width, H = cv.height;
  const read = () => { const p = new Uint8Array(W * H * 4); gl.readPixels(0, 0, W, H, gl.RGBA, gl.UNSIGNED_BYTE, p); return p; };
  const shot = () => { stage.render(0); stage.render(0); return read(); };

  // fighter roots + their screen boxes, via a layer-isolated render
  const roots = [];
  scene.traverse((o) => {
    if (o.name === 'head' && o.parent) {
      let r = o; while (r.parent && r.parent !== scene) r = r.parent;
      if (!roots.includes(r)) roots.push(r);
    }
  });
  const LAYER = 7;
  const boxOf = (objs) => {
    const ms = []; objs.forEach((r) => r.traverse((o) => { if (o.isMesh) ms.push(o); }));
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
      mask[y * W + x] = 1;
      n++; if (x < x0) x0 = x; if (x > x1) x1 = x; if (y < y0) y0 = y; if (y > y1) y1 = y;
    }
    return n ? { x0, y0, w: x1 - x0 + 1, h: y1 - y0 + 1, n, mask } : null;
  };
  const boxes = roots.map((r) => { const b = boxOf([r]); return b ? { x0: b.x0, y0: b.y0, w: b.w, h: b.h, n: b.n, mask: b.mask } : null; });
  const primary = boxes.filter(Boolean).sort((p, q) => q.n - p.n)[0] ?? null;

  const light = stage.lighting[which];
  const full = shot();
  const i0 = light.intensity; light.intensity = 0;
  const off = shot();
  light.intensity = i0;

  // paint the amplified diff
  const c2 = document.createElement('canvas');
  c2.width = W; c2.height = H;
  c2.style.cssText = `position:fixed;left:0;top:0;width:${cv.clientWidth}px;height:${cv.clientHeight}px;z-index:99999;`;
  const ctx = c2.getContext('2d');
  const img = ctx.createImageData(W, H);
  for (let y = 0; y < H; y++) {
    const sy = H - 1 - y; // readPixels is bottom-up
    for (let x = 0; x < W; x++) {
      const s = (sy * W + x) * 4, d = (y * W + x) * 4;
      img.data[d] = Math.min(255, Math.abs(full[s] - off[s]) * gain);
      img.data[d + 1] = Math.min(255, Math.abs(full[s + 1] - off[s + 1]) * gain);
      img.data[d + 2] = Math.min(255, Math.abs(full[s + 2] - off[s + 2]) * gain);
      img.data[d + 3] = 255;
    }
  }
  ctx.putImageData(img, 0, 0);
  document.body.appendChild(c2);
  window.__diffCanvas = c2;

  // stats on the primary fighter's pixels + local figure/ground at the silhouette
  let stats = null;
  if (primary) {
    const m = primary.mask;
    let sBody = 0, nBody = 0, sEdge = 0, nEdge = 0, mx = 0;
    // outer band: 1..4 px outside the mask; inner band: 0..3 px inside
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
    let lIn = 0, nIn = 0, lOut = 0, nOut = 0, lInOff = 0, lOutOff = 0;
    for (let j = 0; j < W * H; j++) {
      const i = j * 4;
      const lf = (0.2126 * full[i] + 0.7152 * full[i + 1] + 0.0722 * full[i + 2]) / 255;
      const lo = (0.2126 * off[i] + 0.7152 * off[i + 1] + 0.0722 * off[i + 2]) / 255;
      if (m[j]) {
        const d = (Math.abs(full[i] - off[i]) + Math.abs(full[i + 1] - off[i + 1]) + Math.abs(full[i + 2] - off[i + 2])) / 3;
        sBody += d; nBody++; if (d > mx) mx = d;
        if (inner[j]) { sEdge += d; nEdge++; lIn += lf; lInOff += lo; nIn++; }
      } else if (outer[j]) { lOut += lf; lOutOff += lo; nOut++; }
    }
    stats = {
      bodyPx: nBody, edgePx: nEdge,
      bodyMean: +(sBody / Math.max(1, nBody)).toFixed(3),
      edgeMean: +(sEdge / Math.max(1, nEdge)).toFixed(3),
      max: +mx.toFixed(1),
      innerLuma: +(lIn / Math.max(1, nIn)).toFixed(4),
      outerLuma: +(lOut / Math.max(1, nOut)).toFixed(4),
      contrastWith: +((lIn / Math.max(1, nIn)) - (lOut / Math.max(1, nOut))).toFixed(4),
      contrastWithout: +((lInOff / Math.max(1, nIn)) - (lOutOff / Math.max(1, nOut))).toFixed(4),
    };
  }
  return {
    canvas: [W, H], dpr: renderer.getPixelRatio(),
    fighters: boxes.filter(Boolean).map((b) => ({ x0: b.x0, y0: b.y0, w: b.w, h: b.h, n: b.n })),
    primary: primary ? { x0: primary.x0, y0: primary.y0, w: primary.w, h: primary.h, n: primary.n } : null,
    stats,
    frameHeightPct: primary ? +(100 * primary.h / H).toFixed(2) : null,
  };
}, { gain: GAIN, which: get('--light', 'rim') });

await page.screenshot({ path: `${OUT}/diff.png` });
await page.evaluate(() => { window.__diffCanvas?.remove(); });

// crop around the primary fighter at shipped framing
if (res.primary) {
  const dpr = res.dpr || 1;
  const p = res.primary;
  // readPixels y is bottom-up; convert to CSS top-down
  const cssTop = (res.canvas[1] - (p.y0 + p.h)) / dpr;
  const cssLeft = p.x0 / dpr;
  const cw = p.w / dpr, ch = p.h / dpr;
  const pad = Math.max(cw, ch) * 0.6;
  const clip = {
    x: Math.max(0, Math.round(cssLeft - pad)),
    y: Math.max(0, Math.round(cssTop - pad)),
    width: Math.min(W, Math.round(cw + pad * 2)),
    height: Math.min(H, Math.round(ch + pad * 2)),
  };
  await page.screenshot({ path: `${OUT}/player_crop.png`, clip });
}

console.log(JSON.stringify(res, null, 2));
await writeFile(`${OUT}/stats.json`, JSON.stringify(res, null, 2));
await browser.close();
