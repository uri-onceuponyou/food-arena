#!/usr/bin/env node
/**
 * THE ENVIRONMENT'S VALUE LADDER — the arena counterpart of `valuescan`'s cast ladder.
 *
 * `arena-scan` rails saturation and chroma against the 11 curated plates and never
 * rails BRIGHTNESS, so the arena was free to drift a full stop below every plate it is
 * measured against while every colour rail read PASS. A mean alone cannot say WHICH
 * rung is missing, so this prints the whole ladder: luma percentiles per frame.
 *
 * VALIDATED (docs/LESSONS.md §13): with no argument it measures the curated plates and
 * its p50 column must bracket the means `arena-scan --ref-plates` prints. Methodology is
 * `colourBudget()`'s verbatim — resize 320x180 fit:'fill', removeAlpha, Rec.709 luma/255.
 *
 *   node tools/tmp/arena_ladder.mjs                       # reference plates
 *   node tools/tmp/arena_ladder.mjs shots/scan/arena-b0   # an arena-scan output dir
 */
import sharp from 'sharp';
import { readdir } from 'node:fs/promises';
import { join } from 'node:path';

const REF = 'reference/images/curated/gameplay_topdown';
const dir = process.argv[2] ?? REF;
const files = (await readdir(dir))
  .filter((f) => /\.(png|jpg|jpeg)$/i.test(f))
  .filter((f) => !/\.(marked|matte|nohud|canvas)\.png$/i.test(f) && !/^sheet_/.test(f))
  .sort();

const P = [5, 25, 50, 75, 95];
const rows = [];
for (const f of files) {
  const { data } = await sharp(join(dir, f)).resize(320, 180, { fit: 'fill' }).removeAlpha()
    .raw().toBuffer({ resolveWithObject: true });
  const n = data.length / 3;
  const l = new Float32Array(n);
  for (let i = 0, j = 0; i < data.length; i += 3, j++) {
    l[j] = (0.2126 * data[i] + 0.7152 * data[i + 1] + 0.0722 * data[i + 2]) / 255;
  }
  const s = Float32Array.from(l).sort();
  const q = (p) => s[Math.min(n - 1, Math.floor((p / 100) * n))];
  let m = 0; for (let i = 0; i < n; i++) m += l[i];
  rows.push({ f, mean: m / n, p: P.map(q) });
}
console.log(`${dir}  (${rows.length})\n`);
console.log('  frame                   mean    p05    p25    p50    p75    p95   range(p95-p05)');
for (const r of rows) {
  console.log(`  ${r.f.padEnd(22)} ${r.mean.toFixed(3)}  ${r.p.map((v) => v.toFixed(3)).join('  ')}   ${(r.p[4] - r.p[0]).toFixed(3)}`);
}
const avg = (sel) => rows.reduce((a, r) => a + sel(r), 0) / rows.length;
console.log(`  ${'MEAN'.padEnd(22)} ${avg((r) => r.mean).toFixed(3)}  ${P.map((_, i) => avg((r) => r.p[i]).toFixed(3)).join('  ')}   ${(avg((r) => r.p[4]) - avg((r) => r.p[0])).toFixed(3)}`);
