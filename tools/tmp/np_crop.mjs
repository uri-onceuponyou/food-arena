#!/usr/bin/env node
/**
 * Nearest-neighbour crop-and-magnify, for LOOKING at a difference `np_pngdiff.mjs` located.
 *
 * A hash says "different" and a bounding box says "here"; neither can be judged. Judging a
 * description instead of an image is this project's most common failure, so the last step
 * of every diff in this pass is a magnified crop of BOTH arms, read side by side. That is
 * what identified the one pixel difference this refactor ever produced as the sprinkle
 * scatter on three donut projectiles rather than as a rendering change.
 *
 *   node tools/tmp/np_crop.mjs <in.png> <out.png> <x> <y> <w> <h> [scale=4]
 */
import sharp from 'sharp';
const [,, IN, OUT, x, y, w, h, scale] = process.argv;
await sharp(IN).extract({ left:+x, top:+y, width:+w, height:+h })
  .resize({ width: Math.round(+w * (+scale||4)), kernel: 'nearest' }).png().toFile(OUT);
console.log(OUT);
