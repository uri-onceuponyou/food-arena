#!/usr/bin/env node
/**
 * R1_SHEET — side-by-side crops for LOOKING at R1's before/after (CLAUDE.md rule 3).
 *
 *   node tools/tmp/r1_sheet.mjs --out sheet.png [--crop x,y,w,h] [--scale 3] [--cols 2]
 *        [--labels "before,after"] a.png b.png ...
 *
 * Same crop from every input, nearest-neighbour upscale (so a 1-px line stays a 1-px line,
 * not a blur), labelled tiles via `tools/compare.mjs`'s tile mode conventions. Read-only.
 */
import sharp from 'sharp';

const argv = process.argv.slice(2);
const arg = (k, d = null) => { const i = argv.indexOf(k); return i >= 0 ? argv[i + 1] : d; };
const flags = new Set(['--out', '--crop', '--scale', '--cols', '--labels']);
const files = argv.filter((a, i) => !a.startsWith('--') && !flags.has(argv[i - 1]));
const out = arg('--out');
if (!out || !files.length) { console.error('usage: r1_sheet.mjs --out sheet.png [--crop x,y,w,h] [--scale n] a.png b.png ...'); process.exit(2); }
const scale = Number(arg('--scale', 1));
const cols = Number(arg('--cols', Math.min(files.length, 2)));
const labels = (arg('--labels', '') || '').split(',');
const crop = arg('--crop') ? arg('--crop').split(',').map(Number) : null;

const tiles = [];
for (const f of files) {
  let img = sharp(f);
  if (crop) img = img.extract({ left: crop[0], top: crop[1], width: crop[2], height: crop[3] });
  const meta = await sharp(await img.png().toBuffer()).metadata();
  const w = Math.round(meta.width * scale), h = Math.round(meta.height * scale);
  const buf = await sharp(await (crop ? sharp(f).extract({ left: crop[0], top: crop[1], width: crop[2], height: crop[3] }) : sharp(f)).png().toBuffer())
    .resize(w, h, { kernel: 'nearest' }).png().toBuffer();
  tiles.push({ buf, w, h });
}
const LABEL = 40, GAP = 12;
const tw = Math.max(...tiles.map((t) => t.w)), th = Math.max(...tiles.map((t) => t.h));
const rows = Math.ceil(tiles.length / cols);
const W = cols * tw + (cols + 1) * GAP, H = rows * (th + LABEL) + (rows + 1) * GAP;
const comps = [];
tiles.forEach((t, i) => {
  const cx = GAP + (i % cols) * (tw + GAP), cy = GAP + Math.floor(i / cols) * (th + LABEL + GAP);
  const text = (labels[i] || files[i].split('/').pop()).replace(/&/g, '&amp;').replace(/</g, '&lt;');
  comps.push({ input: Buffer.from(`<svg width="${tw}" height="${LABEL}"><text x="4" y="${LABEL - 12}" font-family="Helvetica,Arial" font-size="26" fill="#f4eefc">${text}</text></svg>`), left: cx, top: cy });
  comps.push({ input: t.buf, left: cx, top: cy + LABEL });
});
await sharp({ create: { width: W, height: H, channels: 3, background: { r: 22, g: 16, b: 31 } } }).composite(comps).png().toFile(out);
console.log(`sheet ${W}x${H} -> ${out}`);
