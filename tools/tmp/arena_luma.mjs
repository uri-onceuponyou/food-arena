#!/usr/bin/env node
/**
 * FRAME LUMA — the one reference rail `arena-scan` does not carry.
 *
 * `arena-scan` rails saturation and chroma against the 11 curated plates but never
 * brightness, and the plates' own `luma` column is printed by `--ref-plates` and then
 * dropped. That left the arena free to drift a full stop darker than every plate it is
 * measured against while every colour rail read PASS.
 *
 * VALIDATED AGAINST A KNOWN INPUT (docs/LESSONS.md §13): run with no arguments it
 * measures the curated plates and must reproduce `arena-scan --ref-plates`'s luma
 * column to 4 dp. If it does not, this tool is wrong and its arena numbers mean nothing.
 *
 *   node tools/tmp/arena_luma.mjs                 # the reference plates (self-check)
 *   node tools/tmp/arena_luma.mjs shots/scan/x    # an arena-scan output directory
 *
 * Methodology is `colourBudget()`'s verbatim: resize 320x180 fit:'fill', removeAlpha,
 * raw RGB, Rec.709 luma / 255, mean over pixels then over frames.
 */
import sharp from 'sharp';
import { readdir } from 'node:fs/promises';
import { join } from 'node:path';

const REF = 'reference/images/curated/gameplay';
// arena-scan --ref-plates, run 2026-08-05 on the same 11 plates. The self-check target.
const KNOWN = { 'bs_01.png': 0.479, 'bs_02.png': 0.335, 'bs_03.png': 0.621, 'bs_04.png': 0.468,
  'bs_05.png': 0.447, 'bs_06.png': 0.370, 'zb_01.png': 0.672, 'zb_02.png': 0.632,
  'zb_03.png': 0.536, 'zb_04.png': 0.586, 'zb_05.png': 0.455 };

async function lumaOf(file) {
  const { data } = await sharp(file).resize(320, 180, { fit: 'fill' }).removeAlpha()
    .raw().toBuffer({ resolveWithObject: true });
  let l = 0;
  for (let i = 0; i < data.length; i += 3) l += (0.2126 * data[i] + 0.7152 * data[i + 1] + 0.0722 * data[i + 2]) / 255;
  return l / (data.length / 3);
}

const dir = process.argv[2] ?? REF;
const isRef = dir === REF;
// arena-scan writes <id>.png plus .marked/.matte/.nohud/.canvas variants and sheet_N.png.
// Only the plain shipped frames are stations.
const files = (await readdir(dir))
  .filter((f) => /\.(png|jpg|jpeg)$/i.test(f))
  .filter((f) => !/\.(marked|matte|nohud|canvas)\.png$/i.test(f) && !/^sheet_/.test(f))
  .sort();

let sum = 0, n = 0, worst = null, bad = 0;
console.log(`${isRef ? 'REFERENCE PLATES' : 'ARENA STATIONS'} — ${dir} (${files.length})\n`);
for (const f of files) {
  const m = await lumaOf(join(dir, f));
  sum += m; n++;
  if (!worst || m < worst[1]) worst = [f, m];
  let note = '';
  if (isRef) {
    const k = KNOWN[f];
    const ok = k !== undefined && Math.abs(m - k) < 0.0006;
    if (k !== undefined && !ok) bad++;
    note = k === undefined ? '' : ok ? `  ✓ matches arena-scan ${k}` : `  ✗ arena-scan says ${k}`;
  } else if (m < 0.335) note = '  <- darker than bs_02, the DARKEST of eleven plates';
  console.log(`  ${f.padEnd(22)} ${m.toFixed(4)}${note}`);
}
const mean = sum / n;
console.log(`\n  MEAN ${mean.toFixed(4)}   darkest ${worst[0]} ${worst[1].toFixed(4)}`);
if (isRef) {
  console.log(`  plate band [0.335, 0.672], mean 0.509`);
  console.log(bad ? `\n  ✗ ${bad} plate(s) disagree with arena-scan — DO NOT trust this tool.`
    : `\n  ✓ reproduces arena-scan's luma column — arena numbers from this tool are comparable.`);
  process.exit(bad ? 1 : 0);
} else {
  const below = files.length && mean < 0.335;
  console.log(`  reference band [0.335, 0.672], mean 0.509`);
  console.log(below ? `\n  FAIL — the arena mean is below the darkest of eleven reference plates.`
    : `\n  in band.`);
}
