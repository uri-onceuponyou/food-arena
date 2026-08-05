#!/usr/bin/env node
/**
 * Rectangle pixel probe — mean RGB / luma / HSV over one or more rects of a PNG.
 * Throwaway measurement tool for the cover-props loop.
 *
 *   node tools/tmp/rectprobe.mjs <png> "label:x,y,w,h" ["label2:x,y,w,h" ...]
 */
import sharp from 'sharp';

const [, , file, ...rects] = process.argv;
if (!file) { console.error('need <png> "label:x,y,w,h"...'); process.exit(2); }

const img = sharp(file);
const meta = await img.metadata();
const { data, info } = await img.raw().toBuffer({ resolveWithObject: true });
console.log(`${file}  ${meta.width}x${meta.height}  ch=${info.channels}`);

function hsv(r, g, b) {
  r /= 255; g /= 255; b /= 255;
  const mx = Math.max(r, g, b), mn = Math.min(r, g, b), d = mx - mn;
  let h = 0;
  if (d > 1e-6) {
    if (mx === r) h = ((g - b) / d + 6) % 6;
    else if (mx === g) h = (b - r) / d + 2;
    else h = (r - g) / d + 4;
    h *= 60;
  }
  return { h, s: mx === 0 ? 0 : d / mx, v: mx };
}

for (const spec of rects) {
  const [label, nums] = spec.split(':');
  const [x, y, w, h] = nums.split(',').map(Number);
  let R = 0, G = 0, B = 0, n = 0;
  for (let yy = y; yy < y + h; yy++) {
    if (yy < 0 || yy >= info.height) continue;
    for (let xx = x; xx < x + w; xx++) {
      if (xx < 0 || xx >= info.width) continue;
      const i = (yy * info.width + xx) * info.channels;
      R += data[i]; G += data[i + 1]; B += data[i + 2]; n++;
    }
  }
  R /= n; G /= n; B /= n;
  const luma = 0.2126 * R + 0.7152 * G + 0.0722 * B;
  const c = hsv(R, G, B);
  console.log(
    `${label.padEnd(24)} rgb(${R.toFixed(0)},${G.toFixed(0)},${B.toFixed(0)})  luma ${luma.toFixed(1)}  ` +
    `H ${c.h.toFixed(0)}  S ${c.s.toFixed(3)}  V ${c.v.toFixed(3)}   n=${n}`
  );
}
