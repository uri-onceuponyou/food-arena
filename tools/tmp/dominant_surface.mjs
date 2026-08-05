#!/usr/bin/env node
/**
 * THE MODAL SURFACE of a frame — what the biggest single surface actually arrives at.
 *
 * The value ladder says the arena's light rung is missing; this says WHICH surface a
 * reference plate spends its area on and at what value, so a palette change can be
 * aimed rather than guessed. Quantises to a 16^3 RGB lattice and reports the heaviest
 * buckets, which on a top-down brawler plate is the ground.
 *
 *   node tools/tmp/dominant_surface.mjs <dir> [topN]
 */
import sharp from 'sharp';
import { readdir } from 'node:fs/promises';
import { join } from 'node:path';

const dir = process.argv[2] ?? 'reference/images/curated/gameplay_topdown';
const TOP = Number(process.argv[3] ?? 3);
const files = (await readdir(dir))
  .filter((f) => /\.(png|jpg|jpeg)$/i.test(f))
  .filter((f) => !/\.(marked|matte|nohud|canvas)\.png$/i.test(f) && !/^sheet_/.test(f))
  .sort();

const hsv = (r, g, b) => {
  r /= 255; g /= 255; b /= 255;
  const mx = Math.max(r, g, b), mn = Math.min(r, g, b), d = mx - mn;
  let h = 0;
  if (d) {
    if (mx === r) h = ((g - b) / d) % 6; else if (mx === g) h = (b - r) / d + 2; else h = (r - g) / d + 4;
    h *= 60; if (h < 0) h += 360;
  }
  return [h, mx ? d / mx : 0, mx];
};

console.log(`${dir}\n`);
console.log('  frame                  share%  rgb                  hue    sat    val    luma');
for (const f of files) {
  const { data } = await sharp(join(dir, f)).resize(320, 180, { fit: 'fill' }).removeAlpha()
    .raw().toBuffer({ resolveWithObject: true });
  const n = data.length / 3;
  const buckets = new Map();
  for (let i = 0; i < data.length; i += 3) {
    const k = ((data[i] >> 4) << 8) | ((data[i + 1] >> 4) << 4) | (data[i + 2] >> 4);
    let acc = buckets.get(k);
    if (!acc) buckets.set(k, (acc = [0, 0, 0, 0]));
    acc[0]++; acc[1] += data[i]; acc[2] += data[i + 1]; acc[3] += data[i + 2];
  }
  const top = [...buckets.values()].sort((a, b) => b[0] - a[0]).slice(0, TOP);
  top.forEach((t, i) => {
    const [c, R, G, B] = t;
    const r = R / c, g = G / c, b = B / c;
    const [h, s, v] = hsv(r, g, b);
    const lum = (0.2126 * r + 0.7152 * g + 0.0722 * b) / 255;
    console.log(`  ${(i ? '' : f).padEnd(22)} ${((100 * c) / n).toFixed(1).padStart(5)}  `
      + `rgb(${r.toFixed(0).padStart(3)},${g.toFixed(0).padStart(3)},${b.toFixed(0).padStart(3)})   `
      + `${h.toFixed(0).padStart(3)}°  ${s.toFixed(2)}   ${v.toFixed(2)}   ${lum.toFixed(3)}`);
  });
}
