#!/usr/bin/env node
/**
 * VGV_CROP — lay two `vg_frame` judgement PNGs side by side, cropped to the region that
 * actually changed, so CLAUDE.md #3 ("read the PNG and LOOK at it") is doable on an
 * effect that occupies 600 px of a 1280x720 frame.
 *
 * The crop box is DERIVED from the two images (the bbox of pixels whose channel delta
 * exceeds `--delta`, default 6 = `vg_frame`'s own threshold), never typed in — a hand
 * -typed box is exactly the "mis-aimed fixture that keeps its count perfectly" class.
 *
 * 🚨 NON-EMPTINESS: if the changed set is empty the tool FAILS rather than emitting a
 * crop of the frame's top-left corner, which would look like a legitimate panel.
 *
 *   node tools/tmp/vgv_crop.mjs --a <before.png> --b <after.png> --out <out.png> [--pad 40]
 */
import { writeFile } from 'node:fs/promises';
import sharp from 'sharp';

const arg = (n, d) => {
  const i = process.argv.indexOf(`--${n}`);
  return i >= 0 && process.argv[i + 1] ? process.argv[i + 1] : d;
};
const A = arg('a'), B = arg('b'), OUT = arg('out', '/tmp/vgv_crop.png');
const DELTA = Number(arg('delta', 6));
const PAD = Number(arg('pad', 40));
if (!A || !B) { console.error('usage: --a <png> --b <png> --out <png>'); process.exit(2); }

const load = async (p) => {
  const { data, info } = await sharp(p).ensureAlpha().raw().toBuffer({ resolveWithObject: true });
  return { data, width: info.width, height: info.height };
};
const a = await load(A), b = await load(B);
if (a.width !== b.width || a.height !== b.height) {
  console.error(`size mismatch ${a.width}x${a.height} vs ${b.width}x${b.height}`); process.exit(2);
}

let x0 = 1e9, y0 = 1e9, x1 = -1, y1 = -1, n = 0;
for (let y = 0; y < a.height; y++) {
  for (let x = 0; x < a.width; x++) {
    const i = (y * a.width + x) * 4;
    if (Math.abs(a.data[i] - b.data[i]) > DELTA
      || Math.abs(a.data[i + 1] - b.data[i + 1]) > DELTA
      || Math.abs(a.data[i + 2] - b.data[i + 2]) > DELTA) {
      n++;
      if (x < x0) x0 = x; if (x > x1) x1 = x;
      if (y < y0) y0 = y; if (y > y1) y1 = y;
    }
  }
}
// 🚨 The assertion CLAUDE.md #6 demands: assert the filtered set is NON-EMPTY before
// asserting anything over it. An empty set here would silently crop (0,0)-(pad,pad).
if (n === 0) { console.error(`vgv_crop: ZERO changed pixels at delta ${DELTA} — nothing to look at, refusing to emit a crop`); process.exit(1); }

x0 = Math.max(0, x0 - PAD); y0 = Math.max(0, y0 - PAD);
x1 = Math.min(a.width - 1, x1 + PAD); y1 = Math.min(a.height - 1, y1 + PAD);
const w = x1 - x0 + 1, h = y1 - y0 + 1;
const GAP = 12;
const OW = w * 2 + GAP;
const buf = Buffer.alloc(OW * h * 4, 255);
for (let y = 0; y < h; y++) {
  for (let x = 0; x < w; x++) {
    const src = ((y + y0) * a.width + (x + x0)) * 4;
    for (const [img, dx] of [[a, 0], [b, w + GAP]]) {
      const d = (y * OW + x + dx) * 4;
      buf[d] = img.data[src]; buf[d + 1] = img.data[src + 1];
      buf[d + 2] = img.data[src + 2]; buf[d + 3] = 255;
    }
  }
}
for (let y = 0; y < h; y++) for (let x = w; x < w + GAP; x++) {
  const d = (y * OW + x) * 4;
  buf[d] = 255; buf[d + 1] = 0; buf[d + 2] = 255; buf[d + 3] = 255;
}
await writeFile(OUT, await sharp(buf, { raw: { width: OW, height: h, channels: 4 } }).png().toBuffer());
console.log(`vgv_crop: ${n} changed px · box ${x0},${y0}..${x1},${y1} (${w}x${h}) · LEFT=${A} RIGHT=${B} -> ${OUT}`);
