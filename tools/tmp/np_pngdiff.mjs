#!/usr/bin/env node
/** Where two PNGs differ: count, bounding box, and a 3x-amplified diff image.
 *  A hash says "different"; this says WHERE, which is the only thing that can be judged. */
import sharp from 'sharp';
const [,, A, B, OUT] = process.argv;
const [a, b] = await Promise.all([
  sharp(A).raw().ensureAlpha().toBuffer({ resolveWithObject: true }),
  sharp(B).raw().ensureAlpha().toBuffer({ resolveWithObject: true }),
]);
const { width, height } = a.info;
const out = Buffer.alloc(width * height * 3, 0);
let n = 0, maxd = 0; let x0 = 1e9, y0 = 1e9, x1 = -1, y1 = -1;
const hist = new Map();
for (let i = 0, p = 0; i < a.data.length; i += 4, p++) {
  const d = Math.max(Math.abs(a.data[i]-b.data[i]), Math.abs(a.data[i+1]-b.data[i+1]), Math.abs(a.data[i+2]-b.data[i+2]));
  if (d > 0) {
    n++; if (d > maxd) maxd = d;
    const x = p % width, y = (p / width) | 0;
    if (x < x0) x0 = x; if (x > x1) x1 = x;
    if (y < y0) y0 = y; if (y > y1) y1 = y;
    const k = `${(x/64|0)*64},${(y/64|0)*64}`;
    hist.set(k, (hist.get(k) ?? 0) + 1);
    out[p*3] = Math.min(255, d*3); out[p*3+1] = Math.min(255, d*3); out[p*3+2] = Math.min(255, d*3);
  }
}
if (OUT) await sharp(out, { raw: { width, height, channels: 3 } }).png().toFile(OUT);
console.log(JSON.stringify({ width, height, changed: n, share: +(n/(width*height)).toFixed(6), maxDelta: maxd,
  bbox: n ? { x0, y0, x1, y1, w: x1-x0+1, h: y1-y0+1 } : null,
  hotTiles: [...hist.entries()].sort((p,q)=>q[1]-p[1]).slice(0,8) }, null, 2));
