#!/usr/bin/env node
/**
 * Side-by-side sheets for the contrast A/B, at a magnification where banding is
 * actually visible.
 *
 * `docs/LESSONS.md` §6: judging at the wrong scale is judging a different image. A
 * 100 px-tall character crop shown at 1x cannot answer "is it banding" — the whole
 * question is about adjacent 8-bit codes. These are NEAREST-neighbour upscales, on
 * purpose: any smooth resampler would invent the intermediate values whose absence
 * IS the artefact.
 *
 *   node tools/tmp/cabsheet.mjs --dir shots/contrastab/pot_south --ids waterbottle,hotdog --zoom 4
 */
import sharp from 'sharp';
import { readdir } from 'node:fs/promises';
import { join } from 'node:path';

const a = process.argv;
const get = (k, d) => (a.includes(k) ? a[a.indexOf(k) + 1] : d);
const DIR = get('--dir', 'shots/contrastab/pot_south');
const ZOOM = Number(get('--zoom', '4'));
const GAP = 16;

const files = await readdir(DIR);
const ids = get('--ids', null)?.split(',')
  ?? [...new Set(files.filter((f) => /\.c0_62\.png$/.test(f)).map((f) => f.replace(/\.c0_62\.png$/, '')))];

for (const id of ids) {
  const lo = join(DIR, `${id}.c0_62.png`), hi = join(DIR, `${id}.c0_72.png`);
  const A = sharp(lo).resize({ width: null, height: null }); // meta only below
  const meta = await sharp(lo).metadata();
  const w = meta.width * ZOOM, h = meta.height * ZOOM;
  const up = (p) => sharp(p).resize(w, h, { kernel: 'nearest' }).toBuffer();
  const [bufA, bufB] = await Promise.all([up(lo), up(hi)]);
  await sharp({ create: { width: w * 2 + GAP, height: h, channels: 3, background: { r: 255, g: 0, b: 255 } } })
    .composite([{ input: bufA, left: 0, top: 0 }, { input: bufB, left: w + GAP, top: 0 }])
    .png().toFile(join(DIR, `_sheet.${id}.png`));
  console.log(`${id}: ${meta.width}x${meta.height} -> sheet ${w * 2 + GAP}x${h}   LEFT c0.62  RIGHT c0.72`);
}
