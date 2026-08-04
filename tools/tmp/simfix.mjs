/**
 * LOCKED-SURFACE SIMULATION.
 *
 * `arena-scan` says the arena's visual hierarchy is wrong. `matcover` says which
 * materials own the pixels. This answers the remaining question — WHAT WOULD FIXING
 * THEM BUY? — without editing another owner's file, by overriding materials in-page
 * at runtime (matched by name AND authored hex, so a `tinted()`/`.color.set()` clone
 * is targeted and its palette parent is not) and re-running arena-scan's own salience
 * analysis on the result.
 *
 * Usage:
 *   node tools/tmp/simfix.mjs --url http://localhost:5196 --label control
 *   node tools/tmp/simfix.mjs --url http://localhost:5196 --label caps \
 *        --fix "kpal:cabinet=#CE8C2E>#9A7742,kpal:butcherBlock=#C9AD7B>#A2957E"
 */
import { chromium } from 'playwright';
import sharp from 'sharp';

const arg = (k, d) => { const i = process.argv.indexOf('--' + k); return i < 0 ? d : process.argv[i + 1]; };
const BASE = arg('url', 'http://localhost:5196');
const LABEL = arg('label', 'run');
const FIX = (arg('fix', '') || '').split(',').filter(Boolean).map((s) => {
  const [lhs, to] = s.split('>');
  const [name, from] = lhs.split('=');
  return { name, from: from.toUpperCase(), to };
});

const STATIONS = [
  ['spawn_west', 160, 500, 890], ['west_lane', 340, 500, 890], ['west_choke', 400, 500, 890],
  ['pot_south', 700, 640, 890], ['pot_diagonal', 570, 430, 890], ['hub_north', 700, 320, 890],
  ['freezer_nw', 430, 240, 890], ['pantry_ne', 1150, 330, 890], ['pantry_sw', 270, 665, 890],
  ['freezer_se', 1000, 700, 890], ['fryer_south', 560, 790, 890], ['edge_west', 70, 500, 890],
  ['grease_near', 430, 805, 890], ['grease_in', 560, 900, 890], ['water_near', 970, 195, 890],
  ['fog_boundary', 1090, 500, 420], ['fog_inside', 1240, 500, 420], ['fog_late', 700, 340, 200],
];
// arena-scan uses MAX_SAFE_RADIUS 850 for its "normal play" stations; keep whatever
// number is passed so both tools frame the fog identically.
const FOG_NORMAL = Number(arg('fog', '850'));

const GRID_COLS = 16, GRID_ROWS = 9, SMALL_W = 320, SMALL_H = 180;
function rgbToHsl(r, g, b) {
  r /= 255; g /= 255; b /= 255;
  const mx = Math.max(r, g, b), mn = Math.min(r, g, b), l = (mx + mn) / 2;
  if (mx === mn) return { h: 0, s: 0, l };
  const d = mx - mn;
  const s = l > 0.5 ? d / (2 - mx - mn) : d / (mx + mn);
  let h = mx === r ? ((g - b) / d + (g < b ? 6 : 0)) : mx === g ? (b - r) / d + 2 : (r - g) / d + 4;
  return { h: h * 60, s, l };
}
/** Byte-identical to `tools/arena-scan.mjs`'s `analyse` — verified against its own
 *  metrics.json before this script was used for anything. */
async function analyse(buf) {
  const { data } = await sharp(buf).resize(SMALL_W, SMALL_H, { fit: 'fill' }).removeAlpha().raw().toBuffer({ resolveWithObject: true });
  const n = SMALL_W * SMALL_H;
  const luma = new Float32Array(n), sat = new Float32Array(n), hue = new Float32Array(n);
  let c0 = 0, c255 = 0;
  for (let i = 0; i < n; i++) {
    const r = data[i * 3], g = data[i * 3 + 1], b = data[i * 3 + 2];
    if (r === 0 || g === 0 || b === 0) c0++;
    if (r === 255 || g === 255 || b === 255) c255++;
    luma[i] = (0.2126 * r + 0.7152 * g + 0.0722 * b) / 255;
    const { h, s } = rgbToHsl(r, g, b); sat[i] = s; hue[i] = h;
  }
  const medianLuma = Float32Array.from(luma).sort()[Math.floor(n / 2)];
  const cellW = SMALL_W / GRID_COLS, cellH = SMALL_H / GRID_ROWS, cells = [];
  for (let cy = 0; cy < GRID_ROWS; cy++) for (let cx = 0; cx < GRID_COLS; cx++) {
    let sum = 0, sum2 = 0, satSum = 0, cnt = 0;
    const x0 = Math.round(cx * cellW), x1 = Math.round((cx + 1) * cellW);
    const y0 = Math.round(cy * cellH), y1 = Math.round((cy + 1) * cellH);
    for (let y = y0; y < y1; y++) for (let x = x0; x < x1; x++) {
      const i = y * SMALL_W + x; sum += luma[i]; sum2 += luma[i] * luma[i]; satSum += sat[i]; cnt++;
    }
    const mean = sum / cnt, sd = Math.sqrt(Math.max(0, sum2 / cnt - mean * mean)), meanSat = satSum / cnt;
    cells.push({ cx, cy, mean, sd, sat: meanSat,
      salience: 0.5 * Math.min(1, sd / 0.25) + 0.3 * meanSat + 0.2 * Math.min(1, Math.abs(mean - medianLuma) / 0.35) });
  }
  const inPlayer = (c) => c.cx >= 7 && c.cx <= 9 && c.cy >= 4 && c.cy <= 5;
  const pc = cells.filter(inPlayer), pSal = Math.max(...pc.map((c) => c.salience));
  const ranked = [...cells].sort((a, b) => b.salience - a.salience);
  const rank = ranked.findIndex((c) => inPlayer(c) && c.salience === pSal) + 1;
  const ring = cells.filter((c) => !inPlayer(c) && c.cx >= 5 && c.cx <= 11 && c.cy >= 2 && c.cy <= 7);
  const avg = (a, k) => a.reduce((s, c) => s + c[k], 0) / a.length;
  const bins = new Array(12).fill(0); let wsum = 0;
  for (let i = 0; i < n; i++) { if (sat[i] < 0.15) continue; bins[Math.floor((((hue[i] % 360) + 360) % 360) / 30) % 12] += sat[i]; wsum += sat[i]; }
  const hist = bins.map((v) => (wsum ? v / wsum : 0));
  return { rank, dSat: avg(pc, 'sat') - avg(ring, 'sat'), dLuma: avg(pc, 'mean') - avg(ring, 'mean'),
    bin0: hist[0], warm: hist[0] + hist[1], dom: Math.max(...hist), c0: (c0 / n) * 100, c255: (c255 / n) * 100 };
}

const HMR_STUB = `const noop=()=>{};
export const createHotContext=()=>({accept:noop,acceptExports:noop,dispose:noop,prune:noop,
  invalidate:noop,on:noop,off:noop,send:noop,decline:noop,data:{}});
export const injectQuery=(u)=>u; export const updateStyle=noop; export const removeStyle=noop;
export const ErrorOverlay=class{}; export default {};`;

const browser = await chromium.launch({ args: ['--use-gl=angle', '--use-angle=swiftshader',
  '--enable-unsafe-swiftshader', '--enable-webgl', '--ignore-gpu-blocklist', '--disable-gpu-sandbox'] });
const rows = [];
for (const [id, x, y, fogArg] of STATIONS) {
  const fog = fogArg === 890 ? FOG_NORMAL : fogArg;
  const page = await browser.newPage({ viewport: { width: 1600, height: 900 }, deviceScaleFactor: 1 });
  await page.route('**/@vite/client*', (r) => r.fulfill({ status: 200, contentType: 'text/javascript', body: HMR_STUB }));
  try {
    await page.goto(`${BASE}/?player=hamburger&enemy=donut&px=${x}&py=${y}&fogRadius=${fog}&simSpeed=0.02&pointerLock=0`,
      { waitUntil: 'networkidle', timeout: 60000 });
    await page.waitForFunction('window.__gameReady === true', null, { timeout: 60000 });
    await page.waitForTimeout(900);
    const hits = await page.evaluate((fixes) => {
      if (!fixes.length) return 0;
      const seen = new Set(); let n = 0;
      window.__stage.scene.traverse((o) => {
        if (!o.isMesh) return;
        for (const m of (Array.isArray(o.material) ? o.material : [o.material])) {
          if (!m || !m.color || seen.has(m.uuid)) continue;
          seen.add(m.uuid);
          const hex = '#' + m.color.getHexString().toUpperCase();
          for (const f of fixes) if (m.name === f.name && hex === f.from) { m.color.set(f.to); n++; }
        }
      });
      return n;
    }, FIX);
    await page.waitForTimeout(250);
    const buf = await page.locator('canvas').first().screenshot({ timeout: 90000 });
    const m = await analyse(buf);
    rows.push({ id, hits, ...m });
    console.log(`${id.padEnd(14)} rank ${String(m.rank).padStart(3)}  dSat ${m.dSat.toFixed(3).padStart(6)}  bin0 ${m.bin0.toFixed(3)}  clip ${m.c0.toFixed(2)}/${m.c255.toFixed(2)}  (${hits} mats overridden)`);
  } catch (e) { console.error(`${id} FAILED ${e}`); }
  finally { await page.close(); }
}
await browser.close();
const med = (a) => { const s = [...a].sort((x, y) => x - y); const h = s.length >> 1; return s.length % 2 ? s[h] : (s[h - 1] + s[h]) / 2; };
const mean = (a) => a.reduce((x, y) => x + y, 0) / a.length;
const R = rows.map((r) => r.rank), D = rows.map((r) => r.dSat);
console.log(`\n### ${LABEL} (${rows.length} stations)`);
console.log(`A playerRank  median ${med(R)}  mean ${mean(R).toFixed(1)}  top6 ${R.filter((r) => r <= 6).length}/${rows.length}  top12 ${R.filter((r) => r <= 12).length}/${rows.length}`);
console.log(`B dSat        positive ${D.filter((d) => d > 0).length}/${rows.length}  mean ${mean(D).toFixed(3)}`);
console.log(`C hue         bin0 ${mean(rows.map((r) => r.bin0)).toFixed(3)}  warm ${mean(rows.map((r) => r.warm)).toFixed(3)}  dom ${mean(rows.map((r) => r.dom)).toFixed(3)}`);
console.log(`D clip        low ${Math.max(...rows.map((r) => r.c0)).toFixed(2)}%  high ${Math.max(...rows.map((r) => r.c255)).toFixed(2)}%`);
