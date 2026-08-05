#!/usr/bin/env node
// node tools/tmp/imdiff.mjs a.png b.png [outdiff.png]
import sharp from 'sharp';

const [a, b, out] = process.argv.slice(2);
const A = await sharp(a).raw().toBuffer({ resolveWithObject: true });
const B = await sharp(b).raw().toBuffer({ resolveWithObject: true });
const n = Math.min(A.data.length, B.data.length);
const ch = A.info.channels;
let sum = 0, max = 0, changed = 0, px = 0;
const diff = Buffer.alloc(n);
for (let i = 0; i < n; i += ch) {
  let d = 0;
  for (let c = 0; c < 3; c++) d = Math.max(d, Math.abs(A.data[i + c] - B.data[i + c]));
  sum += d; px++;
  if (d > max) max = d;
  if (d > 4) changed++;
  const v = Math.min(255, d * 6);
  diff[i] = v; diff[i + 1] = v; diff[i + 2] = v;
  if (ch === 4) diff[i + 3] = 255;
}
console.log(JSON.stringify({
  meanAbsDiff: +(sum / px).toFixed(4),
  maxDiff: max,
  pctPixelsChanged: +(100 * changed / px).toFixed(2),
  w: A.info.width, h: A.info.height,
}));
if (out) {
  await sharp(diff, { raw: { width: A.info.width, height: A.info.height, channels: ch } }).png().toFile(out);
  console.log('diff ->', out);
}
