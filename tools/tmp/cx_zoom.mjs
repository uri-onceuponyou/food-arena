#!/usr/bin/env node
/**
 * cx_zoom — crop one region of ONE capture and scale it up, so a defect that is
 * 40 px wide in a 900x1400 lobby frame can actually be LOOKED AT.
 *
 * THROWAWAY, read-only. `cr2_crop.mjs` already does this for a PAIR of arms and is
 * the right tool for a before/after; this is the single-panel case used while
 * DIAGNOSING, before an "after" exists at all.
 *
 *   node tools/tmp/cx_zoom.mjs --in shots/cx/before/egg.png --rect 60,600,780,520 \
 *     --out shots/cx/zoom/egg-limbs.png [--scale 2]
 */
import sharp from 'sharp';
import { mkdir } from 'node:fs/promises';
import { dirname } from 'node:path';

const a = process.argv;
const get = (k, d) => (a.includes(k) ? a[a.indexOf(k) + 1] : d);
const IN = get('--in', null);
const OUT = get('--out', null);
const RECT = get('--rect', null);
const SCALE = Number(get('--scale', '2'));
if (!IN || !OUT || !RECT) { console.error('usage: --in <png> --rect x,y,w,h --out <png> [--scale n]'); process.exit(2); }

const [x, y, w, h] = RECT.split(',').map(Number);
const meta = await sharp(IN).metadata();
const left = Math.max(0, Math.min(x, meta.width - 1));
const top = Math.max(0, Math.min(y, meta.height - 1));
const width = Math.min(w, meta.width - left);
const height = Math.min(h, meta.height - top);

await mkdir(dirname(OUT), { recursive: true });
await sharp(IN).extract({ left, top, width, height })
  .resize({ width: Math.round(width * SCALE), kernel: 'nearest' })
  .png().toFile(OUT);
console.log(`${IN} [${left},${top} ${width}x${height}] x${SCALE} -> ${OUT}`);
