#!/usr/bin/env node
/** Luma percentile spread inside rects — is a face a flat single-value fill?
 *   node tools/tmp/spread.mjs <png> "label:x,y,w,h" ...
 */
import sharp from 'sharp';
const [, , file, ...rects] = process.argv;
const { data, info } = await sharp(file).raw().toBuffer({ resolveWithObject: true });
console.log(`${file} ${info.width}x${info.height}`);
for (const spec of rects) {
  const [label, nums] = spec.split(':');
  const [x, y, w, h] = nums.split(',').map(Number);
  const L = [];
  let clipR = 0, n = 0;
  for (let yy = y; yy < y + h; yy++) for (let xx = x; xx < x + w; xx++) {
    if (yy < 0 || yy >= info.height || xx < 0 || xx >= info.width) continue;
    const i = (yy * info.width + xx) * info.channels;
    L.push(0.2126 * data[i] + 0.7152 * data[i + 1] + 0.0722 * data[i + 2]);
    if (data[i] >= 253) clipR++;
    n++;
  }
  L.sort((a, b) => a - b);
  const p = (q) => L[Math.floor(q * (L.length - 1))];
  console.log(
    `${label.padEnd(20)} p10 ${p(0.1).toFixed(1)}  p50 ${p(0.5).toFixed(1)}  p90 ${p(0.9).toFixed(1)}  ` +
    `spread ${(p(0.9) - p(0.1)).toFixed(1)}  R>=253 ${(100 * clipR / n).toFixed(2)}%`
  );
}
