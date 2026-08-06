#!/usr/bin/env node
/**
 * WHERE IS LOLLIPOP CLIPPING? — an OFFLINE probe over artefacts already on disk.
 *
 * `sepscan --mode chars` reports `clipShare`, the share of a character's pixels above
 * luma 0.94, against a six-plate Brawl Stars band of 0.0072–0.0929. It reports ONE
 * NUMBER, and a number cannot say which mesh spent the budget. This pass guessed twice —
 * "the domed glossy candy" and "the near-white cellophane twist" — dropped the gloss, the
 * dome and the twist's albedo, and moved `clipShare` 0.1233 -> 0.1192. That is
 * `docs/LESSONS.md` §7 exactly: symptom accurate, mechanism badly named. So: probe.
 *
 * ⚠️ NO BROWSER AND NO GPU. `valuescan --mode chars` already writes, per character and per
 * yaw, a MATTE (the character's exact pixels) and a VALUE image (the shipped
 * post-processed luma) into `<out>/chars/`. Peers are saturating the GPU; everything here
 * is arithmetic over PNGs that already exist.
 *
 *   node tools/tmp/ch_lollipop_clipmap.mjs --dir <vl_out>/chars [--yaw 90] [--out <png>]
 *   node tools/tmp/ch_lollipop_clipmap.mjs --selftest
 *
 * `--selftest` is the known-bad-input rule (CLAUDE.md #6): synthetic mattes and values
 * whose clipped share is derived by hand, including the two cases that would let a
 * plausible-but-wrong implementation through — background pixels above the threshold that
 * must NOT be counted, and a matte with zero clipped pixels that must report exactly 0.
 */
import { writeFile } from 'node:fs/promises';
import { join } from 'node:path';
// `sharp`, not `pngjs`: it is what this repo already depends on (`sepscan.mjs` uses it)
// and adding a decoder to package.json for a probe would be a dependency change in a file
// this agent does not own.
import sharp from 'sharp';

/** Decode a PNG to `{ data: Uint8Array RGBA, width, height }` — pngjs's shape, sharp's engine. */
async function readPNG(path) {
  const { data, info } = await sharp(path).ensureAlpha().raw().toBuffer({ resolveWithObject: true });
  return { data, width: info.width, height: info.height };
}

const a = process.argv;
const get = (k, d) => (a.includes(k) ? a[a.indexOf(k) + 1] : d);
const CLIP = Number(get('--clip', 0.94));

/** sRGB luma, the same weights `valuelib` uses. */
const luma = (r, g, b) => (0.2126 * r + 0.7152 * g + 0.0722 * b) / 255;

/**
 * Clipped-pixel statistics inside a matte.
 * `matte` is treated as "in the character" wherever its alpha > 0 AND it is not black —
 * both, because the two-clear-colour matte writes opaque black outside on some captures
 * and transparent outside on others, and trusting only one of them is how a probe ends up
 * counting the background.
 */
export function clipStats(matte, value, w, h, clip = 0.94) {
  let inMatte = 0;
  let clipped = 0;
  const rows = new Array(h).fill(0);
  const cols = new Array(w).fill(0);
  for (let i = 0; i < w * h; i++) {
    const o = i * 4;
    const inside = matte.data[o + 3] > 8 && (matte.data[o] + matte.data[o + 1] + matte.data[o + 2]) > 12;
    if (!inside) continue;
    inMatte++;
    const L = luma(value.data[o], value.data[o + 1], value.data[o + 2]);
    if (L >= clip) {
      clipped++;
      rows[(i / w) | 0]++;
      cols[i % w]++;
    }
  }
  return { inMatte, clipped, share: inMatte ? clipped / inMatte : 0, rows, cols };
}

function synth(w, h, fn) {
  const p = { width: w, height: h, data: new Uint8Array(w * h * 4) };
  for (let y = 0; y < h; y++) {
    for (let x = 0; x < w; x++) {
      const [r, g, b, al] = fn(x, y);
      const o = (y * w + x) * 4;
      p.data[o] = r; p.data[o + 1] = g; p.data[o + 2] = b; p.data[o + 3] = al;
    }
  }
  return p;
}

function selftest() {
  let pass = 0; let fail = 0;
  const check = (name, got, want) => {
    const ok = JSON.stringify(got) === JSON.stringify(want);
    console.log(`  ${ok ? '✓' : '✗'} ${name.padEnd(62)} ${JSON.stringify(got)}`);
    ok ? pass++ : fail++;
  };
  const W = 10; const H = 10;

  // A: a 4x4 opaque matte block; every pixel inside is pure white -> share 1.0
  {
    const m = synth(W, H, (x, y) => (x < 4 && y < 4 ? [255, 255, 255, 255] : [0, 0, 0, 0]));
    const v = synth(W, H, () => [255, 255, 255, 255]);
    const s = clipStats(m, v, W, H, 0.94);
    check('A inMatte counts only the matte block', s.inMatte, 16);
    check('A all-white inside -> share 1', s.share, 1);
  }
  // B: THE ONE THAT CATCHES THE OBVIOUS BUG — white everywhere in the VALUE image but a
  //    matte of 16 px. A probe that forgets the mask reports 100 clipped, not 16.
  {
    const m = synth(W, H, (x, y) => (x < 4 && y < 4 ? [255, 255, 255, 255] : [0, 0, 0, 0]));
    const v = synth(W, H, () => [255, 255, 255, 255]);
    check('B background above threshold is NOT counted', clipStats(m, v, W, H, 0.94).clipped, 16);
  }
  // C: nothing clipped -> exactly 0, not NaN and not 1
  {
    const m = synth(W, H, (x, y) => (x < 4 && y < 4 ? [255, 255, 255, 255] : [0, 0, 0, 0]));
    const v = synth(W, H, () => [128, 128, 128, 255]);
    const s = clipStats(m, v, W, H, 0.94);
    check('C mid-grey inside -> 0 clipped', s.clipped, 0);
    check('C ... and share is 0, not NaN', s.share, 0);
  }
  // D: an EMPTY matte must not divide by zero
  {
    const m = synth(W, H, () => [0, 0, 0, 0]);
    const v = synth(W, H, () => [255, 255, 255, 255]);
    const s = clipStats(m, v, W, H, 0.94);
    check('D empty matte -> share 0, inMatte 0', [s.share, s.inMatte], [0, 0]);
  }
  // E: the threshold is a real threshold — 0.939 out, 0.941 in
  {
    const m = synth(W, H, (x, y) => (x < 2 && y < 1 ? [255, 255, 255, 255] : [0, 0, 0, 0]));
    const below = synth(W, H, () => [239, 239, 239, 255]);   // luma 0.937
    const above = synth(W, H, () => [241, 241, 241, 255]);   // luma 0.945
    check('E just below threshold -> 0', clipStats(m, below, W, H, 0.94).clipped, 0);
    check('E just above threshold -> 2', clipStats(m, above, W, H, 0.94).clipped, 2);
  }
  // F: row histogram localises — clipped only on row 3 of the block
  {
    const m = synth(W, H, (x, y) => (x < 4 && y < 4 ? [255, 255, 255, 255] : [0, 0, 0, 0]));
    const v = synth(W, H, (x, y) => (y === 3 ? [255, 255, 255, 255] : [100, 100, 100, 255]));
    const s = clipStats(m, v, W, H, 0.94);
    check('F row histogram puts all 4 on row 3', s.rows.map((n, i) => (n ? i : -1)).filter((i) => i >= 0), [3]);
  }
  console.log(`\n${pass} passed, ${fail} failed`);
  return fail ? 1 : 0;
}

if (a.includes('--selftest')) process.exit(selftest());

const dir = get('--dir', null);
if (!dir) { console.error('need --dir <vl_out>/chars'); process.exit(2); }
const yaw = get('--yaw', '90');
const out = get('--out', null);

const matte = await readPNG(join(dir, `lollipop.ss.yaw${yaw}.matte.png`));
const value = await readPNG(join(dir, `lollipop.ss.yaw${yaw}.value.png`));
const { width: w, height: h } = matte;
const s = clipStats(matte, value, w, h, CLIP);
console.log(`yaw${yaw}  inMatte ${s.inMatte}  clipped ${s.clipped}  share ${s.share.toFixed(4)}  (band 0.0072-0.0929)`);

// Where, as a row profile — the cheapest localisation there is, and enough to say
// "the head" vs "the limbs" without a part map.
const first = s.rows.findIndex((n) => n > 0);
const last = s.rows.length - 1 - [...s.rows].reverse().findIndex((n) => n > 0);
const mFirst = (() => { for (let y = 0; y < h; y++) for (let x = 0; x < w; x++) { const o = (y * w + x) * 4; if (matte.data[o + 3] > 8 && matte.data[o] + matte.data[o + 1] + matte.data[o + 2] > 12) return y; } return -1; })();
const mLast = (() => { for (let y = h - 1; y >= 0; y--) for (let x = 0; x < w; x++) { const o = (y * w + x) * 4; if (matte.data[o + 3] > 8 && matte.data[o] + matte.data[o + 1] + matte.data[o + 2] > 12) return y; } return -1; })();
console.log(`character rows ${mFirst}..${mLast}   clipped rows ${first}..${last}`);
const span = Math.max(1, mLast - mFirst);
console.log(`clipped band, as a fraction of the character's height: ${((first - mFirst) / span).toFixed(3)} .. ${((last - mFirst) / span).toFixed(3)}  (0 = crown)`);
const bins = 10;
const hist = new Array(bins).fill(0);
for (let y = mFirst; y <= mLast; y++) hist[Math.min(bins - 1, Math.floor(((y - mFirst) / span) * bins))] += s.rows[y];
console.log('clipped px per tenth of height (crown -> feet):', hist.join(' '));

if (out) {
  const png = { width: w, height: h, data: Buffer.alloc(w * h * 4) };
  for (let i = 0; i < w * h; i++) {
    const o = i * 4;
    const inside = matte.data[o + 3] > 8 && (matte.data[o] + matte.data[o + 1] + matte.data[o + 2]) > 12;
    const L = luma(value.data[o], value.data[o + 1], value.data[o + 2]);
    const clip = inside && L >= CLIP;
    png.data[o] = clip ? 255 : Math.round(value.data[o] * (inside ? 0.55 : 0.12));
    png.data[o + 1] = clip ? 0 : Math.round(value.data[o + 1] * (inside ? 0.55 : 0.12));
    png.data[o + 2] = clip ? 255 : Math.round(value.data[o + 2] * (inside ? 0.55 : 0.12));
    png.data[o + 3] = 255;
  }
  await sharp(png.data, { raw: { width: w, height: h, channels: 4 } }).png().toFile(out);
  console.log(`wrote ${out}  (magenta = clipped)`);
}
