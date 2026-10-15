#!/usr/bin/env node
/**
 * C1B_STACK — stack `c1b_sheet` per-character rows into one image for LOOKING, optionally
 * cropping to the first N columns and pairing a BEFORE row above each AFTER row.
 *   node tools/tmp/c1b_stack.mjs --dir <sheetDir> --tag <tag> --ids a,b,c --cols 3 [--before-dir d --before-tag t] --out f.png
 */
import sharp from 'sharp';
import { join } from 'node:path';
const argv = process.argv.slice(2);
const arg = (k, d = null) => { const i = argv.indexOf(k); return i >= 0 ? argv[i + 1] : d; };
const ids = String(arg('--ids')).split(',');
const cols = Number(arg('--cols', 3));
const SIZE = Number(arg('--size', 300));
const rows = [];
for (const id of ids) {
  for (const [dir, tag] of [[arg('--before-dir'), arg('--before-tag')], [arg('--dir'), arg('--tag')]]) {
    if (!dir) continue;
    const img = sharp(join(dir, `${tag}_${id}.png`));
    const m = await img.metadata();
    const w = Math.min(m.width, cols * (SIZE + 4) - 4);
    rows.push(await img.extract({ left: 0, top: 0, width: w, height: m.height }).png().toBuffer());
  }
}
const metas = await Promise.all(rows.map((r) => sharp(r).metadata()));
const W = Math.max(...metas.map((m) => m.width));
let y = 0; const comp = [];
for (let i = 0; i < rows.length; i++) { comp.push({ input: rows[i], left: 0, top: y }); y += metas[i].height + 4; }
await sharp({ create: { width: W, height: y, channels: 3, background: '#000' } }).composite(comp).png().toFile(arg('--out'));
console.log('->', arg('--out'));
