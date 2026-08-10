#!/usr/bin/env node
/**
 * LOOK AT IT. A zoomed side-by-side of N full-frame captures, cropped to the union of
 * where they differ and scaled up, so the difference is READABLE by eye rather than only
 * by a summed-delta column.
 *
 * `docs/AGENT-BRIEF.md` §4.1: judging a description instead of an image is this project's
 * most common failure — and a 1600x900 frame in which 814 px changed is, at page scale,
 * indistinguishable from one in which nothing did. The crop is derived from the pixels
 * (the differing-pixel bounding box, padded), never hand-typed, so it cannot be aimed at
 * the wrong place: if the arms are identical it says so and writes nothing.
 *
 *   node tools/tmp/hw_trip.mjs --out shots/hw/x.png --labels 'shipped,flag,flag+ro' a.png b.png c.png
 */
import sharp from 'sharp';

const arg = (k, d) => { const i = process.argv.indexOf('--' + k); return i < 0 ? d : process.argv[i + 1]; };
const OUT = arg('out', 'shots/hw/trip.png');
const PAD = Number(arg('pad', '40'));
const ZOOM = Number(arg('zoom', '3'));
const LABELS = (arg('labels', '') || '').split(',').filter(Boolean);
const files = process.argv.slice(2).filter((a) => a.endsWith('.png') && a !== OUT);
if (files.length < 2) { console.error('need >= 2 pngs'); process.exit(2); }

const bufs = [];
for (const f of files) bufs.push(await sharp(f).raw().toBuffer({ resolveWithObject: true }));
const { width: W, height: H, channels: CH } = bufs[0].info;

// Union bbox over every PAIR, so a three-arm crop frames everything any arm moved.
let x0 = W, x1 = -1, y0 = H, y1 = -1, n = 0;
for (let i = 0; i < W * H; i++) {
  let d = 0;
  for (let k = 1; k < bufs.length; k++) {
    const o = i * CH;
    d = Math.max(d, Math.abs(bufs[0].data[o] - bufs[k].data[o]),
      Math.abs(bufs[0].data[o + 1] - bufs[k].data[o + 1]),
      Math.abs(bufs[0].data[o + 2] - bufs[k].data[o + 2]));
  }
  if (d > 0) { n++; const x = i % W, y = (i / W) | 0; if (x < x0) x0 = x; if (x > x1) x1 = x; if (y < y0) y0 = y; if (y > y1) y1 = y; }
}
if (n === 0) { console.log('IDENTICAL — the arms differ in 0 pixels, nothing to look at'); process.exit(0); }
const L = Math.max(0, x0 - PAD), T = Math.max(0, y0 - PAD);
const R = Math.min(W, x1 + PAD + 1), B = Math.min(H, y1 + PAD + 1);
const cw = R - L, chh = B - T;
console.log(`differing bbox ${x0},${y0}..${x1},${y1}  (${n} px)  ->  crop ${L},${T} ${cw}x${chh} at ${ZOOM}x`);

const tiles = [];
for (const f of files) {
  tiles.push(await sharp(f).extract({ left: L, top: T, width: cw, height: chh })
    .resize({ width: cw * ZOOM, height: chh * ZOOM, kernel: 'nearest' }).png().toBuffer());
}
const tw = cw * ZOOM, th = chh * ZOOM, gap = 8;
const canvas = sharp({ create: { width: tw * tiles.length + gap * (tiles.length - 1), height: th, channels: 3, background: '#FF00FF' } });
await canvas.composite(tiles.map((b, i) => ({ input: b, left: i * (tw + gap), top: 0 }))).png().toFile(OUT);
console.log(`wrote ${OUT}   panels: ${files.map((f, i) => LABELS[i] ?? f.split('/').pop()).join(' | ')}`);
