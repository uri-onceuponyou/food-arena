#!/usr/bin/env node
/**
 * LK1_CROP — crop + upscale a region of a PNG so a small feature can actually be
 * LOOKED AT (CLAUDE.md rule 3: judge rendered pixels, not a description).
 *
 * Exists because the soup broth's garnish is a few dozen pixels on a 1800x2300 plate
 * and "I cannot see it in the full frame" is not the same claim as "it is not there".
 *
 *   node tools/tmp/lk1_crop.mjs --in a.png --out b.png --x 400 --y 400 --w 600 --h 400 [--scale 2]
 */
import sharp from 'sharp';

const a = process.argv;
const get = (k, d) => (a.includes(k) ? a[a.indexOf(k) + 1] : d);
const IN = get('--in'), OUT = get('--out');
if (!IN || !OUT) { console.error('usage: --in <png> --out <png> --x --y --w --h [--scale]'); process.exit(2); }
const x = Number(get('--x', 0)), y = Number(get('--y', 0));
const w = Number(get('--w', 400)), h = Number(get('--h', 400));
const scale = Number(get('--scale', 2));

const meta = await sharp(IN).metadata();
const cx = Math.max(0, Math.min(x, meta.width - 1));
const cy = Math.max(0, Math.min(y, meta.height - 1));
const cw = Math.max(1, Math.min(w, meta.width - cx));
const ch = Math.max(1, Math.min(h, meta.height - cy));
await sharp(IN).extract({ left: cx, top: cy, width: cw, height: ch })
  .resize({ width: Math.round(cw * scale), kernel: 'nearest' }).png().toFile(OUT);
console.log(`[lk1_crop] ${IN} (${meta.width}x${meta.height}) -> ${OUT} crop ${cx},${cy} ${cw}x${ch} x${scale}`);
