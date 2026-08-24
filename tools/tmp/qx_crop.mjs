#!/usr/bin/env node
/** qx_crop — magnify a rect out of a PNG so it can be LOOKED at (CLAUDE.md rule 3). */
import sharp from 'sharp';
const A = process.argv.slice(2);
const g = (k, d) => (A.includes(k) ? A[A.indexOf(k) + 1] : d);
const src = g('--in'), out = g('--out');
const [x, y, w, h] = ['--x', '--y', '--w', '--h'].map((k) => Number(g(k)));
const z = Number(g('--zoom', 6));
await sharp(src).extract({ left: x, top: y, width: w, height: h })
  .resize({ width: w * z, height: h * z, kernel: 'nearest' }).png().toFile(out);
console.log(`${out}  ${w}x${h} @${z}x from ${src} at ${x},${y}`);
