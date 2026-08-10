#!/usr/bin/env node
/**
 * DIAGNOSIS ONLY — magnify a rendered plate so a human (or this agent) can LOOK at it.
 *
 * ⚠️ NOTHING JUDGED IS EVER QUOTED FROM THIS OUTPUT. The whole finding of `a77ff30` is
 * that letting a judge magnify moved the same 63 tiles from 67.2% to 96.3% — 29 points
 * from the protocol alone. So this writes to a `zoom/` name and exists for exactly one
 * purpose: CLAUDE.md non-negotiable #3, *read the PNG and look at it*, applied to a
 * glyph that is 11 px across and cannot be looked at otherwise.
 *
 * It re-derives the tile grid from the plate's own geometry — `cols`, `cell` and the
 * 10px pad `icon_legibility.html` writes — rather than from a stored rect, so it works
 * on any plate either driver produced.
 *
 *   node tools/tmp/ic_zoom.mjs shots/ic/diag/diag.png --key shots/ic/diag/diag.key.json \
 *     --cols 6 --scale 10 --crop 40 --out shots/ic/diag/zoom.png
 *
 * ── `--names 0`: the ONE output of this tool a judge may see ────────────────
 * The caption normally carries the tile's own NAME, which is the answer key, so a judged
 * plate could never come from here. `--names 0` prints the index alone. That is what the
 * MAGNIFIED protocol actually is — the same tiles, the same indices, the low-acuity
 * constraint lifted — and it has to be produced rather than assumed, because a judge
 * "allowed to magnify" a 72-tile plate at 11 px per glyph is not magnifying anything.
 * ⚠️ Still not the decision arm. `a77ff30` measured the protocol gap at 29 points and
 * `e4fa1bd` found the magnified arm sitting at 99.5%, i.e. at a ceiling that carries no
 * information; quote it as a ceiling, never as a verdict. The key file stays out of the
 * judge's hands either way — only the PNG is handed over.
 */
import sharp from 'sharp';
import { readFileSync } from 'node:fs';

const a = {};
const pos = [];
for (let i = 2; i < process.argv.length; i++) {
  if (process.argv[i].startsWith('--')) { a[process.argv[i].slice(2)] = process.argv[i + 1]; i++; }
  else pos.push(process.argv[i]);
}
const src = pos[0];
if (!src) { console.error('usage: ic_zoom.mjs <plate.png> [--key k.json] [--cols 6] [--cell 92] [--scale 10] [--crop 40] --out <png>'); process.exit(2); }

const cols = Number(a.cols ?? 6);
const cell = Number(a.cell ?? 92);
const pad = Number(a.pad ?? 10);
const scale = Number(a.scale ?? 10);
const crop = Number(a.crop ?? 40);
const out = a.out ?? src.replace(/\.png$/, '.zoom.png');

const key = a.key ? JSON.parse(readFileSync(a.key, 'utf8')) : null;
const tiles = key?.tiles ?? key?.plan ?? null;

const img = sharp(readFileSync(src));
const meta = await img.metadata();
const n = tiles ? tiles.length : Math.floor((meta.height - 2 * pad) / cell) * cols;
const rows = Math.ceil(n / cols);

/** The item box is `cell` square with the plate centred on the glyph row; the index
 *  caption sits under it, so the plate's centre is a few px above the cell centre. The
 *  crop is centred on the cell and generous enough that the offset cannot clip a glyph
 *  at these sizes. */
const side = crop * scale;
const LABEL = 26;
const composites = [];
for (let i = 0; i < n; i++) {
  const r = Math.floor(i / cols), c = i % cols;
  const cx = pad + c * cell + cell / 2;
  const cy = pad + r * cell + cell / 2 - 5;
  const left = Math.max(0, Math.round(cx - crop / 2));
  const top = Math.max(0, Math.round(cy - crop / 2));
  const w = Math.min(crop, meta.width - left), h = Math.min(crop, meta.height - top);
  const buf = await sharp(readFileSync(src)).extract({ left, top, width: w, height: h })
    .resize(w * scale, h * scale, { kernel: 'nearest' }).png().toBuffer();
  composites.push({ input: buf, left: c * side, top: r * (side + LABEL) });
  const name = tiles && a.names !== '0' ? (tiles[i].name ?? '?') : '';
  const svg = Buffer.from(
    `<svg width="${side}" height="${LABEL}" xmlns="http://www.w3.org/2000/svg">`
    + `<rect width="${side}" height="${LABEL}" fill="#1a1224"/>`
    + `<text x="6" y="19" font-family="monospace" font-size="17" fill="#FFF3DE">${i + 1}${name ? `. ${name}` : ''}</text></svg>`);
  composites.push({ input: svg, left: c * side, top: r * (side + LABEL) + side });
}

await sharp({ create: { width: cols * side, height: rows * (side + LABEL), channels: 3, background: '#3a3040' } })
  .composite(composites).png().toFile(out);
console.log(`wrote ${out}  ${cols * side}x${rows * (side + LABEL)}  ${n} tiles at ${scale}x`);
