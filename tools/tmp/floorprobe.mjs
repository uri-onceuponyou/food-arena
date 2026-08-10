#!/usr/bin/env node
/**
 * FLOOR ACCEPTANCE PROBE — the objective test the floor loop never had.
 *
 * The criterion is a critic's, and it is gameplay-grounded rather than aesthetic:
 *
 *   "Composite a mid-value character silhouette on the floor. The character's
 *    outline must be the darkest edge within a 200px radius."
 *
 * Everything below is that criterion made measurable, plus the two supporting
 * numbers the whole-arena scan named:
 *
 *   R              strongest floor-internal edge within 200px of the silhouette,
 *                  divided by the silhouette's own outline edge. PASS < 1.0.
 *   vanish%        share of the 200px disc where |L_floor - L_char| < 0.06, the
 *                  scan's own "the hero has no value separation" threshold. A wide
 *                  low-band swing guarantees somewhere the floor equals the hero.
 *   paleDL         p99.5 floor luma minus median floor luma — the brightest piece
 *                  of decoration versus the surface it sits on. The scan measured
 *                  the pale lane decals at 0.374 against a player at 0.299.
 *
 * Band energies (low/mid/high standard deviation of luma) are reported too, because
 * the whole point of this pass is which BAND carries the floor at shipped distance.
 *
 * Renders `preview.html?piece=floor`, which now frames SHIPPED_SPAN — no floor round
 * has ever been judged at the distance the game is actually played at.
 *
 * Usage:
 *   node tools/tmp/floorprobe.mjs --url http://localhost:5190 --tag before
 */
import { chromium } from 'playwright';
import sharp from 'sharp';
import { mkdir, writeFile, readFile, access } from 'node:fs/promises';
import { settleScreen, captureSettled, frameStats, assertFrame } from './settle.mjs';

const LAUNCH_ARGS = [
  '--use-gl=angle', '--use-angle=swiftshader', '--enable-unsafe-swiftshader',
  '--enable-webgl', '--ignore-gpu-blocklist', '--disable-gpu-sandbox',
];

function args(argv) {
  const o = {};
  for (let i = 2; i < argv.length; i++) {
    if (!argv[i].startsWith('--')) continue;
    const k = argv[i].slice(2), n = argv[i + 1];
    if (n === undefined || n.startsWith('--')) o[k] = true; else { o[k] = n; i++; }
  }
  return o;
}
const A = args(process.argv);
// ⚠️ `PREVIEW_BASE` must be honoured, not just `--url`. `with_snapshot.mjs` injects PREVIEW_BASE
// into the child automatically and that is how every other tool here is driven
// (`arena-scan.mjs:654`, `aspect.mjs:27`, `shoot.mjs:37`, `match-play.mjs:81` all read it). Without
// it this tool silently fell back to 5190 under `headserve` and died with ERR_CONNECTION_REFUSED —
// which reads exactly like a broken build rather than a tool pointed at the wrong port. Same class
// as `aspect.mjs` defaulting to the shared dev server, which cost three separate agents.
const URL_BASE = A.url ?? process.env.PREVIEW_BASE ?? 'http://localhost:5190';
const TAG = A.tag ?? 'run';
const OUT = `shots/floorprobe/${TAG}`;
const W = 1600, H = 900;

// Player-centred stations, matching `tools/arena-scan.mjs` ids so the two are
// directly comparable. Never arena-centred (that framing fills the shot with the pot).
const STATIONS = [
  { id: 'west_choke', x: 400, y: 500 },
  { id: 'west_lane', x: 340, y: 500 },
  { id: 'spawn_west', x: 160, y: 500 },
  { id: 'pantry_ne', x: 1150, y: 330 },
  { id: 'pot_south', x: 700, y: 640 },
];

const HMR_STUB = `const noop=()=>{};
export const createHotContext=()=>({accept:noop,acceptExports:noop,dispose:noop,prune:noop,
  invalidate:noop,on:noop,off:noop,send:noop,decline:noop,data:{}});
export const injectQuery=(u)=>u; export const updateStyle=noop; export const removeStyle=noop;
export const ErrorOverlay=class{}; export default {};`;

// ── image helpers ───────────────────────────────────────────────────────────
function lumaOf(data, n) {
  const L = new Float32Array(n);
  for (let i = 0; i < n; i++) {
    L[i] = (0.2126 * data[i * 3] + 0.7152 * data[i * 3 + 1] + 0.0722 * data[i * 3 + 2]) / 255;
  }
  return L;
}
/** Separable box blur, repeated 3x ≈ Gaussian. Radius in px. */
function blur(src, w, h, r) {
  if (r < 1) return Float32Array.from(src);
  let a = Float32Array.from(src), b = new Float32Array(w * h);
  for (let pass = 0; pass < 3; pass++) {
    for (let y = 0; y < h; y++) {
      let acc = 0;
      for (let x = -r; x <= r; x++) acc += a[y * w + Math.min(w - 1, Math.max(0, x))];
      for (let x = 0; x < w; x++) {
        b[y * w + x] = acc / (2 * r + 1);
        const out = Math.min(w - 1, Math.max(0, x - r));
        const inn = Math.min(w - 1, Math.max(0, x + r + 1));
        acc += a[y * w + inn] - a[y * w + out];
      }
    }
    [a, b] = [b, a];
    for (let x = 0; x < w; x++) {
      let acc = 0;
      for (let y = -r; y <= r; y++) acc += a[Math.min(h - 1, Math.max(0, y)) * w + x];
      for (let y = 0; y < h; y++) {
        b[y * w + x] = acc / (2 * r + 1);
        const out = Math.min(h - 1, Math.max(0, y - r));
        const inn = Math.min(h - 1, Math.max(0, y + r + 1));
        acc += a[inn * w + x] - a[out * w + x];
      }
    }
    [a, b] = [b, a];
  }
  return a;
}
function std(arr, mask) {
  let s = 0, s2 = 0, n = 0;
  for (let i = 0; i < arr.length; i++) {
    if (mask && !mask[i]) continue;
    s += arr[i]; s2 += arr[i] * arr[i]; n++;
  }
  const m = s / n;
  return Math.sqrt(Math.max(0, s2 / n - m * m));
}
function pct(arr, p, mask) {
  const v = [];
  for (let i = 0; i < arr.length; i++) if (!mask || mask[i]) v.push(arr[i]);
  v.sort((a, b) => a - b);
  return v[Math.min(v.length - 1, Math.max(0, Math.round((v.length - 1) * p)))];
}
/** Sobel magnitude on an already-smoothed field. */
function sobel(L, w, h) {
  const g = new Float32Array(w * h);
  for (let y = 1; y < h - 1; y++) {
    for (let x = 1; x < w - 1; x++) {
      const i = y * w + x;
      const gx = -L[i - w - 1] - 2 * L[i - 1] - L[i + w - 1] + L[i - w + 1] + 2 * L[i + 1] + L[i + w + 1];
      const gy = -L[i - w - 1] - 2 * L[i - w] - L[i - w + 1] + L[i + w - 1] + 2 * L[i + w] + L[i + w + 1];
      g[i] = Math.hypot(gx, gy) / 4; // /4 so a clean step of ΔL reads back as ΔL
    }
  }
  return g;
}

// ── the silhouette mask ─────────────────────────────────────────────────────
// Cached once. A real character outline, not a disc — the criterion is about an
// outline of a character-shaped mass, and a circle would understate the perimeter.
const MASK_PATH = 'tools/tmp/floorprobe-mask.png';
async function getMask(page) {
  try { await access(MASK_PATH); }
  catch {
    await page.goto(`${URL_BASE}/preview.html?piece=character&id=hamburger&anim=idle&yaw=20&t=1.5&shot=1&silhouette=1`, { waitUntil: 'networkidle', timeout: 60000 });
    await page.waitForFunction('window.__previewReady === true', null, { timeout: 60000 });
    await settleScreen(page, { soft: true, label: 'floorprobe mask' });
    // capture-audit: allow — this shot needs a CLIP rect, which captureSettled does not
    // take. Settled above and floor-checked below, so the two guards it would have applied
    // are both applied by hand rather than skipped.
    const maskBuf = await page.screenshot({ clip: { x: 0, y: 0, width: 900, height: 1100 } });
    assertFrame(await frameStats(maskBuf), { label: 'floorprobe mask' });
    await writeFile(MASK_PATH, maskBuf);
  }
  const img = sharp(MASK_PATH);
  const { data, info } = await img.greyscale().raw().toBuffer({ resolveWithObject: true });
  // Black subject on white. Tight-crop, then scale so the height is 95px — the
  // measured on-screen character height at shipped framing (10.5% of 900px).
  let x0 = info.width, x1 = -1, y0 = info.height, y1 = -1;
  for (let y = 0; y < info.height; y++) {
    for (let x = 0; x < info.width; x++) {
      if (data[y * info.width + x] < 128) {
        if (x < x0) x0 = x; if (x > x1) x1 = x;
        if (y < y0) y0 = y; if (y > y1) y1 = y;
      }
    }
  }
  const cw = x1 - x0 + 1, ch = y1 - y0 + 1;
  const target = 95;
  const sw = Math.max(1, Math.round((cw * target) / ch));
  const scaled = await sharp(MASK_PATH).extract({ left: x0, top: y0, width: cw, height: ch })
    .resize(sw, target, { kernel: 'nearest' }).greyscale().raw().toBuffer();
  const m = new Uint8Array(sw * target);
  for (let i = 0; i < m.length; i++) m[i] = scaled[i] < 128 ? 1 : 0;
  return { m, w: sw, h: target };
}

// ── the measurement ─────────────────────────────────────────────────────────
const RADIUS = 200;
// A mid-value character — MEASURED, not assumed. `tools/tmp/castvalue.mjs` masks a
// roster render with its own silhouette render and reads the cast's body pixels:
//   n=54,691  mean 0.546  p05 0.168  p25 0.351  MEDIAN 0.533  p75 0.742  p95 0.957
// So the middle of this cast is 0.53. The scan's `playerLuma` (0.27-0.60) is NOT this
// number — it averages a screen REGION, so it is diluted by the floor around the hero.
// Getting this wrong by 0.08 moves every `R` in the table, which is why it is measured.
const CHAR_L = Number(A.charL ?? 0.53);
const VANISH = 0.06; // the scan's own "no value separation" threshold

function measure(rgb, w, h, mask) {
  const n = w * h;
  const L = lumaOf(rgb, n);

  // Band split. σ chosen against SHIPPED framing: at 490wu across 1600px, one 40wu
  // tile is ~131px. So "low" is many tiles, "mid" is about one tile, "high" is
  // sub-tile. This is the frequency contract this arena arrived at the hard way.
  const lowF = blur(L, w, h, 96);
  const midF = blur(L, w, h, 24);
  const low = std(lowF);
  const mid = std(midF.map((v, i) => v - lowF[i]));
  const high = std(L.map((v, i) => v - midF[i]));

  // Silhouette placement: frame centre, feet at centre (the camera keeps the player
  // at frame centre in the shipped rig).
  const cx = Math.round(w / 2), cy = Math.round(h / 2);
  const mx = cx - Math.round(mask.w / 2), my = cy - Math.round(mask.h / 2);

  // The silhouette's own outline edge: |L_char - L_floor| sampled just outside every
  // boundary pixel of the mask. Median, so a couple of freak pixels cannot carry it.
  const outline = [];
  for (let y = 0; y < mask.h; y++) {
    for (let x = 0; x < mask.w; x++) {
      if (!mask.m[y * mask.w + x]) continue;
      const nb = [[1, 0], [-1, 0], [0, 1], [0, -1]];
      for (const [dx, dy] of nb) {
        const ax = x + dx, ay = y + dy;
        const inside = ax >= 0 && ay >= 0 && ax < mask.w && ay < mask.h && mask.m[ay * mask.w + ax];
        if (inside) continue;
        const fx = mx + ax, fy = my + ay;
        if (fx < 1 || fy < 1 || fx >= w - 1 || fy >= h - 1) continue;
        outline.push(Math.abs(CHAR_L - L[fy * w + fx]));
      }
    }
  }
  outline.sort((a, b) => a - b);
  const charEdge = outline[Math.floor(outline.length / 2)] ?? 0;

  // Floor-internal edges, at a matched scale: the same Sobel operator on a lightly
  // smoothed field (σ≈2px) so single-pixel aliasing spikes do not masquerade as
  // authored edges. Character pixels themselves are excluded.
  const sm = blur(L, w, h, 2);
  const g = sobel(sm, w, h);
  let gMax = 0;
  const inDisc = [];
  let vanishHit = 0, vanishTot = 0, minSep = 1;
  for (let y = 1; y < h - 1; y++) {
    for (let x = 1; x < w - 1; x++) {
      const dx = x - cx, dy = y - cy;
      if (dx * dx + dy * dy > RADIUS * RADIUS) continue;
      const inMaskX = x - mx, inMaskY = y - my;
      const isChar = inMaskX >= 0 && inMaskY >= 0 && inMaskX < mask.w && inMaskY < mask.h
        && mask.m[inMaskY * mask.w + inMaskX];
      if (isChar) continue;
      const i = y * w + x;
      inDisc.push(g[i]);
      if (g[i] > gMax) gMax = g[i];
      vanishTot++;
      const sep = Math.abs(L[i] - CHAR_L);
      if (sep < VANISH) vanishHit++;
      if (sep < minSep) minSep = sep;
    }
  }
  inDisc.sort((a, b) => a - b);
  const gHi = inDisc[Math.floor(inDisc.length * 0.999)] ?? 0;

  // The brightest decoration versus the surface it sits on, whole frame.
  //
  // `piece=floor` draws NO apron, so at `spawn_west` the frame clips past the map
  // edge and shows the preview backdrop (0xffcf8a) — which is brighter than anything
  // on the floor and was inflating `paleDL` from 0.21 to 0.47 at that one station.
  // That is a harness artifact, not decoration. The backdrop is the only perfectly
  // FLAT region in frame (every tile carries `textures.ts` grain, measured at a high-
  // band σ of 0.036), so a zero-local-gradient test separates it cleanly.
  // `preview.ts` uses 0xffcf8a for arena pieces; through `ToyGradeEffect` that lands
  // at rgb(245,200,108), measured. Nothing on the floor is within reach of it.
  const floorMask = new Uint8Array(n).fill(1);
  for (let i = 0; i < n; i++) {
    const r = rgb[i * 3], g2 = rgb[i * 3 + 1], b = rgb[i * 3 + 2];
    if (Math.abs(r - 245) < 14 && Math.abs(g2 - 200) < 14 && Math.abs(b - 108) < 20) floorMask[i] = 0;
  }
  const med = pct(L, 0.5, floorMask);
  const paleDL = pct(L, 0.995, floorMask) - med;
  const darkDL = med - pct(L, 0.005, floorMask);

  return {
    charEdge: +charEdge.toFixed(4),
    floorEdgeP999: +gHi.toFixed(4),
    floorEdgeMax: +gMax.toFixed(4),
    R: +(gHi / (charEdge || 1e-6)).toFixed(3),
    Rmax: +(gMax / (charEdge || 1e-6)).toFixed(3),
    vanishPct: +((100 * vanishHit) / Math.max(1, vanishTot)).toFixed(2),
    minSep: +minSep.toFixed(4),
    medianL: +med.toFixed(4),
    paleDL: +paleDL.toFixed(4),
    darkDL: +darkDL.toFixed(4),
    p5: +pct(L, 0.05, floorMask).toFixed(4),
    p95: +pct(L, 0.95, floorMask).toFixed(4),
    bandLow: +low.toFixed(4),
    bandMid: +mid.toFixed(4),
    bandHigh: +high.toFixed(4),
  };
}

// ── run ─────────────────────────────────────────────────────────────────────
await mkdir(OUT, { recursive: true });
const browser = await chromium.launch({ args: LAUNCH_ARGS });
const page = await browser.newPage({ viewport: { width: W, height: H }, deviceScaleFactor: 1 });
page.on('pageerror', (e) => console.error('PAGEERROR', String(e)));
await page.route('**/@vite/client*', (r) => r.fulfill({ status: 200, contentType: 'text/javascript', body: HMR_STUB }));

const mask = await getMask(page);
const results = {};
for (const s of STATIONS) {
  const url = `${URL_BASE}/preview.html?piece=floor&tx=${s.x}&ty=${s.y}&t=0&shot=1`;
  await page.goto(url, { waitUntil: 'networkidle', timeout: 60000 });
  await page.waitForFunction('window.__previewReady === true', null, { timeout: 60000 });
  // A floor station rendered on `preview.html` (no shell), so the working guard is the
  // flat-frame floor: a blank or boot-overlay frame here would produce a perfectly
  // plausible luminance histogram and nothing would say so.
  // `path` here rather than a bare writeFile, so the PNG lands with its `.capture.json`
  // sidecar: a station render with no provenance is exactly what `tools/review.mjs`
  // refuses to build a packet from.
  const { buf: png } = await captureSettled(page, { path: `${OUT}/${s.id}.png`, label: `floor:${s.id}`, tool: 'floorprobe' });
  const { data } = await sharp(png).removeAlpha().raw().toBuffer({ resolveWithObject: true });
  results[s.id] = measure(data, W, H, mask);
  console.log(s.id.padEnd(12), JSON.stringify(results[s.id]));
}
await browser.close();
await writeFile(`${OUT}/metrics.json`, JSON.stringify(results, null, 2));

const rows = Object.entries(results);
const hdr = 'station        R    Rmax  charEdge fEdge  vanish%  minSep  medL   paleDL darkDL  low    mid    high';
const lines = [hdr];
for (const [id, m] of rows) {
  lines.push(
    id.padEnd(13) +
    String(m.R).padStart(6) + String(m.Rmax).padStart(7) +
    String(m.charEdge).padStart(9) + String(m.floorEdgeP999).padStart(7) +
    String(m.vanishPct).padStart(8) + String(m.minSep).padStart(8) +
    String(m.medianL).padStart(8) + String(m.paleDL).padStart(8) + String(m.darkDL).padStart(7) +
    String(m.bandLow).padStart(7) + String(m.bandMid).padStart(7) + String(m.bandHigh).padStart(7)
  );
}
const mean = (k) => (rows.reduce((a, [, m]) => a + m[k], 0) / rows.length).toFixed(3);
lines.push('');
lines.push(`MEAN   R=${mean('R')}  vanish%=${mean('vanishPct')}  paleDL=${mean('paleDL')}  low=${mean('bandLow')} mid=${mean('bandMid')} high=${mean('bandHigh')}`);
lines.push('');
lines.push('PASS = R < 1.0 at every station (the character outline is the strongest edge within 200px).');
lines.push(`CHAR_L=${CHAR_L} mid-value silhouette, ${mask.w}x${mask.h}px, radius ${RADIUS}px, vanish threshold ${VANISH}.`);
const txt = lines.join('\n');
await writeFile(`${OUT}/SUMMARY.txt`, txt + '\n');
console.log('\n' + txt);
