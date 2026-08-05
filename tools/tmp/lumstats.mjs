#!/usr/bin/env node
/**
 * THROWAWAY: luminance/saturation statistics for our frames AND for the curated
 * reference plates, so "too dark" / "too flat" is settled against the bar rather than
 * against a critic's impression.
 *
 * Usage: node tools/tmp/lumstats.mjs <img...>
 *        node tools/tmp/lumstats.mjs --refs        (all curated gameplay plates)
 */
import sharp from 'sharp';
import { readdir } from 'node:fs/promises';
import { join } from 'node:path';

async function stats(path) {
  const { data, info } = await sharp(path).ensureAlpha().raw().toBuffer({ resolveWithObject: true });
  const n = info.width * info.height;
  const lums = new Float64Array(n);
  let satSum = 0, valSum = 0;
  for (let i = 0; i < n; i++) {
    const r = data[i * 4], g = data[i * 4 + 1], b = data[i * 4 + 2];
    lums[i] = (0.2126 * r + 0.7152 * g + 0.0722 * b) / 255;
    const mx = Math.max(r, g, b), mn = Math.min(r, g, b);
    valSum += mx / 255; satSum += mx === 0 ? 0 : (mx - mn) / mx;
  }
  const sorted = Float64Array.from(lums).sort();
  const q = (p) => sorted[Math.min(n - 1, Math.floor(p * n))];
  let m = 0; for (const v of lums) m += v; m /= n;
  let sd = 0; for (const v of lums) sd += (v - m) ** 2; sd = Math.sqrt(sd / n);
  let dark = 0, bright = 0;
  for (const v of lums) { if (v < 0.02) dark++; if (v > 0.5) bright++; }
  return { path, mean: m, median: q(0.5), p05: q(0.05), p95: q(0.95), p99: q(0.99), std: sd,
    darkPct: 100 * dark / n, brightPct: 100 * bright / n, meanSat: satSum / n, meanVal: valSum / n };
}

let paths = process.argv.slice(2).filter((a) => !a.startsWith('--'));
if (process.argv.includes('--refs')) {
  const d = 'reference/images/curated/gameplay';
  paths = paths.concat((await readdir(d)).filter((f) => /\.(png|jpe?g)$/i.test(f)).map((f) => join(d, f)));
}
console.log('image                                  mean   med    p05    p95    p99    std    <0.02  >0.5   sat   val');
for (const p of paths) {
  const s = await stats(p);
  console.log(`${p.slice(-37).padEnd(37)}  ${s.mean.toFixed(3)}  ${s.median.toFixed(3)}  ${s.p05.toFixed(3)}  `
    + `${s.p95.toFixed(3)}  ${s.p99.toFixed(3)}  ${s.std.toFixed(3)}  ${s.darkPct.toFixed(1)}%  ${s.brightPct.toFixed(1)}%  `
    + `${s.meanSat.toFixed(3)} ${s.meanVal.toFixed(3)}`);
}
