#!/usr/bin/env node
/**
 * PRICE THE ARENA VALUE LIFT BEFORE WRITING IT (docs/TOOLS.md — simfix/caphex pattern).
 *
 * The measured defect: the arena's value ladder sits a full stop below all six top-down
 * Brawl Stars plates (p05 0.114 vs 0.253, p50 0.311 vs 0.426, p95 0.580 vs 0.789), while
 * every arena-scan COLOUR rail reads PASS — because arena-scan rails chroma and
 * saturation and has never railed brightness.
 *
 * The candidate fix is a single monotone lift applied to every arena albedo:
 *
 *     V' = V^gamma            (V = max sRGB channel)   then scale all three channels by V'/V
 *
 * Scaling all three channels by one factor is chosen deliberately, because it makes two
 * properties PROVABLE rather than hoped for:
 *   - hue is exactly unchanged (channel ratios are unchanged);
 *   - HSL saturation — the metric `arena-scan.colourBudget()` actually uses — is exactly
 *     unchanged below l=0.5 and INCREASES above it. So the lift cannot desaturate, which
 *     is the standing rule this project has falsified four separate fixes against.
 * Mean chroma (d/255) scales with the factor, so it moves toward the reference too.
 *
 * This applies the lift LIVE, per gamma, and reports the ladder plus the rails, so the
 * constant that gets written down is measured rather than guessed. The gamma=1 row is the
 * control and must reproduce the untouched frame.
 */
import { chromium } from 'playwright';
import sharp from 'sharp';
import { mkdir } from 'node:fs/promises';
const arg = (k, d) => { const i = process.argv.indexOf('--' + k); return i < 0 ? d : process.argv[i + 1]; };
const BASE = arg('url', 'http://localhost:5173');
const OUT = arg('out', 'shots/arena/lift');
const GAMMAS = arg('gammas', '1,0.85,0.72,0.6,0.5').split(',').map(Number);
const STATIONS = arg('stations', '570:430,340:500,1150:420,700:640').split(',');
const HMR_STUB = `const noop=()=>{};export const createHotContext=()=>({accept:noop,acceptExports:noop,dispose:noop,prune:noop,invalidate:noop,on:noop,off:noop,send:noop,decline:noop,data:{}});export const injectQuery=(u)=>u;export const updateStyle=noop;export const removeStyle=noop;export const ErrorOverlay=class{};export default {};`;

const LIFT = (g) => `(() => {
  const s = window.__stage.scene; const seen = new Set(); let n = 0;
  const t = { r: 0, g: 0, b: 0 };
  s.traverse((o) => {
    if (!o.isMesh) return;
    let p = o, label = '';
    while (p) { if (p.name) label = p.name; p = p.parent; }
    if (label !== 'arena:kitchen') return;
    const mats = Array.isArray(o.material) ? o.material : [o.material];
    for (const m of mats) {
      if (!m || !m.color || seen.has(m.uuid)) continue;
      seen.add(m.uuid);
      if (!m.__origRGB) { m.color.getRGB(t, 'srgb'); m.__origRGB = [t.r, t.g, t.b]; }
      const [r0, g0, b0] = m.__origRGB;
      const V = Math.max(r0, g0, b0);
      if (V <= 0.0001) continue;
      const k = Math.pow(V, ${g}) / V;
      m.color.setRGB(Math.min(1, r0 * k), Math.min(1, g0 * k), Math.min(1, b0 * k), 'srgb');
      m.needsUpdate = true; n++;
    }
  });
  window.__stage.renderer.shadowMap.needsUpdate = true;
  return n;
})()`;

const stats = async (buf) => {
  const { data } = await sharp(buf).resize(320, 180, { fit: 'fill' }).removeAlpha().raw().toBuffer({ resolveWithObject: true });
  const n = data.length / 3;
  const l = new Float32Array(n);
  let satSum = 0, chromaSum = 0, warm = 0, cool = 0, hi = 0, lo = 0;
  for (let i = 0, j = 0; i < data.length; i += 3, j++) {
    const r = data[i], g = data[i + 1], b = data[i + 2];
    const mx = Math.max(r, g, b), mn = Math.min(r, g, b), d = mx - mn;
    const L = (mx + mn) / 2 / 255;
    const sat = d === 0 ? 0 : (L > 0.5 ? d / (510 - mx - mn) : d / (mx + mn));
    satSum += sat; chromaSum += d / 255;
    if (sat >= 0.15 && d > 0) {
      let h = mx === r ? ((g - b) / d + (g < b ? 6 : 0)) : mx === g ? (b - r) / d + 2 : (r - g) / d + 4;
      h = ((h * 60) % 360 + 360) % 360;
      if (h < 60) warm += sat; else cool += sat;
    }
    if (mx >= 255) hi++; if (mn <= 0) lo++;
    l[j] = (0.2126 * r + 0.7152 * g + 0.0722 * b) / 255;
  }
  const sorted = Float32Array.from(l).sort();
  const q = (p) => sorted[Math.min(n - 1, Math.floor((p / 100) * n))];
  let m = 0; for (let i = 0; i < n; i++) m += l[i];
  return { mean: m / n, p05: q(5), p50: q(50), p95: q(95), meanSat: satSum / n,
    chroma: chromaSum / n, warm: warm / n, cool: cool / n, clipHi: (100 * hi) / n, clipLo: (100 * lo) / n };
};

const b = await chromium.launch({ args: ['--use-gl=angle', '--use-angle=swiftshader', '--enable-unsafe-swiftshader', '--enable-webgl', '--ignore-gpu-blocklist', '--disable-gpu-sandbox'] });
await mkdir(OUT, { recursive: true });
const acc = new Map(GAMMAS.map((g) => [g, []]));
for (const st of STATIONS) {
  const [px, py] = st.split(':');
  const p = await b.newPage({ viewport: { width: 1600, height: 900 }, deviceScaleFactor: 1 });
  await p.route('**/@vite/client*', (r) => r.fulfill({ status: 200, contentType: 'text/javascript', body: HMR_STUB }));
  await p.goto(`${BASE}/?player=hamburger&enemy=donut&px=${px}&py=${py}&fogRadius=993&simSpeed=0.02&pointerLock=0`, { waitUntil: 'networkidle', timeout: 60000 });
  await p.waitForFunction('window.__gameReady === true', null, { timeout: 60000 });
  await p.waitForTimeout(1400);
  for (const g of GAMMAS) {
    const n = await p.evaluate(LIFT(g));
    await p.waitForTimeout(700);
    const shot = await p.screenshot();
    await sharp(shot).toFile(`${OUT}/${px}_${py}_g${g}.png`);
    acc.get(g).push(await stats(shot));
    if (g === GAMMAS[0]) console.log(`  (${n} arena materials lifted)`);
  }
  await p.close();
}
await b.close();
const avg = (rows, k) => rows.reduce((a, r) => a + r[k], 0) / rows.length;
console.log(`\nARENA VALUE LIFT SWEEP — mean over ${STATIONS.length} stations`);
console.log('  gamma   mean    p05    p50    p95   | meanSat  chroma   warm    cool  | clipHi clipLo');
for (const g of GAMMAS) {
  const r = acc.get(g);
  console.log(`  ${String(g).padEnd(6)} ${avg(r, 'mean').toFixed(3)}  ${avg(r, 'p05').toFixed(3)}  ${avg(r, 'p50').toFixed(3)}  ${avg(r, 'p95').toFixed(3)}   `
    + `${avg(r, 'meanSat').toFixed(4)}  ${avg(r, 'chroma').toFixed(4)}  ${avg(r, 'warm').toFixed(4)}  ${avg(r, 'cool').toFixed(4)}   `
    + `${avg(r, 'clipHi').toFixed(2)}   ${avg(r, 'clipLo').toFixed(2)}`);
}
console.log('  TARGET 0.453  0.253  0.426  0.789   0.4925  0.3250  0.1449  0.3431     (6 top-down BS plates / 11-plate colour figures)');
