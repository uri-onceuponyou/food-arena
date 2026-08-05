#!/usr/bin/env node
/**
 * WHAT OWNS THE LIGHT END? — the arena's ladder is short at the top (p95 0.657 after
 * the value lift, against 0.789 on the plates). A lift alone cannot close that: the
 * gap is not brightness spread thinly, it is a MISSING SURFACE FAMILY. So this asks
 * the plates directly — of the pixels above p90, what colour are they and how much of
 * the frame is it — and asks the same of our own frames, so the answer names a
 * surface instead of a number.
 */
import sharp from 'sharp';
import { readdir } from 'node:fs/promises';
import { join } from 'node:path';
const dir = process.argv[2] ?? 'reference/images/curated/gameplay_topdown';
const files = (await readdir(dir)).filter((f) => /\.(png|jpg|jpeg)$/i.test(f))
  .filter((f) => !/\.(marked|matte|nohud|canvas)\.png$/i.test(f) && !/^sheet_/.test(f)).sort();
const hsv = (r, g, b) => {
  const mx = Math.max(r, g, b), mn = Math.min(r, g, b), d = mx - mn;
  let h = 0;
  if (d) { if (mx === r) h = ((g - b) / d) % 6; else if (mx === g) h = (b - r) / d + 2; else h = (r - g) / d + 4; h *= 60; if (h < 0) h += 360; }
  return [h, mx ? d / mx : 0, mx / 255];
};
console.log(`${dir}\n`);
console.log('  frame                  p90   share>0.70  share>0.80 | modal colour above p90        hue   sat   val');
for (const f of files) {
  const { data } = await sharp(join(dir, f)).resize(320, 180, { fit: 'fill' }).removeAlpha().raw().toBuffer({ resolveWithObject: true });
  const n = data.length / 3;
  const l = new Float32Array(n);
  for (let i = 0, j = 0; i < data.length; i += 3, j++) l[j] = (0.2126 * data[i] + 0.7152 * data[i + 1] + 0.0722 * data[i + 2]) / 255;
  const p90 = Float32Array.from(l).sort()[Math.floor(0.9 * n)];
  let a = 0, b70 = 0, b80 = 0;
  const buckets = new Map();
  for (let i = 0, j = 0; i < data.length; i += 3, j++) {
    if (l[j] > 0.70) b70++;
    if (l[j] > 0.80) b80++;
    if (l[j] < p90) continue;
    a++;
    const k = ((data[i] >> 4) << 8) | ((data[i + 1] >> 4) << 4) | (data[i + 2] >> 4);
    let acc = buckets.get(k); if (!acc) buckets.set(k, (acc = [0, 0, 0, 0]));
    acc[0]++; acc[1] += data[i]; acc[2] += data[i + 1]; acc[3] += data[i + 2];
  }
  const [c, R, G, B] = [...buckets.values()].sort((x, y) => y[0] - x[0])[0];
  const [r, g, bb] = [R / c, G / c, B / c];
  const [h, s, v] = hsv(r, g, bb);
  console.log(`  ${f.padEnd(22)} ${p90.toFixed(3)}   ${((100 * b70) / n).toFixed(1).padStart(6)}%     ${((100 * b80) / n).toFixed(1).padStart(5)}%  | `
    + `rgb(${r.toFixed(0).padStart(3)},${g.toFixed(0).padStart(3)},${bb.toFixed(0).padStart(3)}) ${((100 * c) / a).toFixed(0).padStart(3)}% of top decile  ${h.toFixed(0).padStart(3)}°  ${s.toFixed(2)}  ${v.toFixed(2)}`);
}
