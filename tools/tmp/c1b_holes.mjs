#!/usr/bin/env node
/**
 * C1B_HOLES — does a silhouette have a HOLE in it? (graphics campaign C1b: "donut's hole
 * visible at 58°"). Reads a `c1b_sheet.mjs --sil` row (black figure on white, cells SIZE
 * wide with 4 px gutters) and, per cell, flood-fills the white background from the cell's
 * border; white pixels the fill cannot reach are ENCLOSED by the figure — a hole.
 *
 * Known-bad (CLAUDE.md rule 6), run every time: a synthetic ring (a black annulus on white)
 * must report its hole, and a synthetic disc must report none — else the run is refused.
 *
 *   node tools/tmp/c1b_holes.mjs <row.png> [--size 300] [--cells 58:0,58:45,...] [--min 40]
 */
import sharp from 'sharp';
const argv = process.argv.slice(2);
const arg = (k, d = null) => { const i = argv.indexOf(k); return i >= 0 ? argv[i + 1] : d; };
const SIZE = Number(arg('--size', 300)), H = Math.round(SIZE * 1.25), MIN = Number(arg('--min', 40));
const holeArea = (px, W, Hh, x0, w) => {
  const white = (x, y) => px[y * W + x] > 160;
  const seen = new Uint8Array(w * Hh); const st = [];
  const push = (x, y) => { const k = y * w + (x - x0); if (!seen[k] && white(x, y)) { seen[k] = 1; st.push(x, y); } };
  for (let x = x0; x < x0 + w; x++) { push(x, 0); push(x, Hh - 1); }
  for (let y = 0; y < Hh; y++) { push(x0, y); push(x0 + w - 1, y); }
  while (st.length) { const y = st.pop(), x = st.pop(); if (x > x0) push(x - 1, y); if (x < x0 + w - 1) push(x + 1, y); if (y > 0) push(x, y - 1); if (y < Hh - 1) push(x, y + 1); }
  let enclosed = 0; for (let y = 0; y < Hh; y++) for (let x = x0; x < x0 + w; x++) if (white(x, y) && !seen[y * w + (x - x0)]) enclosed++;
  return enclosed;
};
// known-bad controls on synthetic shapes
const synth = (ring) => { const W = 100, Hh = 100, px = new Uint8Array(W * Hh).fill(255);
  for (let y = 0; y < Hh; y++) for (let x = 0; x < W; x++) { const r = Math.hypot(x - 50, y - 50); if (r < 30 && (!ring || r > 12)) px[y * W + x] = 0; }
  return holeArea(px, W, Hh, 0, W); };
const kRing = synth(true), kDisc = synth(false);
if (!(kRing > 300 && kDisc === 0)) { console.log(`REFUSED: known-bad failed (ring ${kRing}, disc ${kDisc})`); process.exit(1); }
const { data, info } = await sharp(argv[0]).greyscale().raw().toBuffer({ resolveWithObject: true });
const n = Math.round((info.width + 4) / (SIZE + 4));
const cells = arg('--cells') ? String(arg('--cells')).split(',') : [...Array(n).keys()].map(String);
const out = [];
for (let i = 0; i < n; i++) out.push(`${cells[i] ?? i}: ${holeArea(data, info.width, Math.min(H, info.height), i * (SIZE + 4), SIZE)}`);
const vis = out.filter((o) => Number(o.split(': ')[1]) >= MIN).length;
console.log(`${argv[0]}\n  enclosed-background px per cell: ${out.join(' · ')}\n  hole visible (>= ${MIN} px) in ${vis}/${n} cells   [known-bad ok: ring ${kRing} px, disc ${kDisc}]`);
