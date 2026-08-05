#!/usr/bin/env node
/** crop.mjs <in> <x> <y> <w> <h> <scale> <out> — look at a region of a plate at real zoom. */
import sharp from 'sharp';
const [, , src, x, y, w, h, s, out] = process.argv;
await sharp(src).extract({ left: +x, top: +y, width: +w, height: +h })
  .resize({ width: Math.round(+w * +s), kernel: 'nearest' }).png().toFile(out);
console.log(out);
