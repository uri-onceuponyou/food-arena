#!/usr/bin/env node
/**
 * ue_crop — cut one rectangle out of one PNG and write it, optionally upscaled.
 * A sighting aid for authoring the reference boxes in `ue_ref_boxes.mjs`; it exists
 * because the character pass's worst fault (four panels showing the wrong body part)
 * was invisible to five numeric checks and visible instantly in a PNG.
 *
 *   node tools/tmp/ue_crop.mjs --in <png> --box x,y,w,h [--scale 2] --out <png>
 */
import sharp from 'sharp';
const a = process.argv;
const g = (k, d) => (a.includes(k) ? a[a.indexOf(k) + 1] : d);
const [x, y, w, h] = String(g('--box')).split(',').map(Number);
const scale = Number(g('--scale', 1));
const src = sharp(g('--in')).extract({ left: x, top: y, width: w, height: h });
const out = scale === 1 ? src : src.resize(Math.round(w * scale), Math.round(h * scale), { kernel: 'nearest' });
await out.png().toFile(g('--out'));
console.log(`${g('--out')}  ${Math.round(w * scale)}x${Math.round(h * scale)} from [${x},${y} ${w}x${h}]`);
