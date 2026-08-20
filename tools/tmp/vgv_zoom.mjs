#!/usr/bin/env node
/**
 * VGV_ZOOM — nearest-neighbour crop of one PNG, so a 60 px effect can be LOOKED at.
 * Deliberately dumb: it takes an explicit box because it is used AFTER `vgv_look.mjs`
 * has already derived one. Never use it to pick a region by guessing.
 *
 *   node tools/tmp/vgv_zoom.mjs <src.png> <x> <y> <w> <h> <out.png> [scale]
 */
import sharp from 'sharp';
const [, , src, x, y, w, h, out, scale] = process.argv;
if (!src || !out) { console.error('usage: <src> <x> <y> <w> <h> <out> [scale]'); process.exit(2); }
const s = Number(scale || 3);
await sharp(src).extract({ left: +x, top: +y, width: +w, height: +h })
  .resize(+w * s, +h * s, { kernel: 'nearest' }).png().toFile(out);
console.log('vgv_zoom ->', out);
