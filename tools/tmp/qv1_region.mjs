#!/usr/bin/env node
/**
 * qv1_region — split a BEFORE/AFTER canvas pair into WHERE it changed, and how much.
 *
 * WHY. A whole-canvas delta ("44.8% of pixels moved") cannot say which of two edits in
 * one commit produced it. `062513c` changed the BROWS and the HEAD PICK together. The
 * brow sits on the face; the pick sits above the crown. They are vertically disjoint,
 * so a ROW PROFILE of the change separates them without needing them isolated in source.
 *
 * DRIFT CONTROL IS AN ARM, NOT AN ASSUMPTION (rule 4). `--control a.png b.png` requires
 * the pair to differ by EXACTLY zero pixels. No non-zero number below is believable
 * until that arm has printed 0 on this same code path — the eighteenth "it isn't there"
 * in this project rendered plausibly and wrongly.
 *
 * VALIDATION (rule 6): `--selftest`
 *   A NON-EMPTY  the changed-pixel set is asserted non-empty BEFORE any share is taken.
 *                `[].every()` is true and 0/0 shares print as clean 0.0% rows.
 *   B ZERO       a self-pair must report 0 changed pixels (the differ can return zero).
 *   C KNOWN-BAD  a synthetic image with a single planted 4x4 block must be found, at the
 *                planted row band and nowhere else. A differ never shown to FAIL is not
 *                a differ.
 *   D SIZE       both images must share dimensions, else exit 3 rather than compare a
 *                resized pair and call the resampling a regression.
 */
import sharp from 'sharp';
import path from 'node:path';
import { fileURLToPath } from 'node:url';

const argv = process.argv.slice(2);
const arg = (k, d) => (argv.includes(k) ? argv[argv.indexOf(k) + 1] : d);
const flag = (k) => argv.includes(k);
const THRESH = Number(arg('--thresh', 6)); // per-channel, 0-255

async function raw(p) {
  const img = sharp(p).ensureAlpha();
  const { data, info } = await img.raw().toBuffer({ resolveWithObject: true });
  return { data, w: info.width, h: info.height, ch: info.channels };
}

/** Changed-pixel mask + per-row counts. Returns {n, rows, w, h}. */
export async function diffProfile(pa, pb, thresh = THRESH) {
  const A = await raw(pa), B = await raw(pb);
  if (A.w !== B.w || A.h !== B.h) {
    const e = new Error(`size mismatch ${A.w}x${A.h} vs ${B.w}x${B.h}`);
    e.code = 'SIZE';
    throw e;
  }
  const rows = new Int32Array(A.h);
  let n = 0;
  for (let y = 0; y < A.h; y++) {
    let c = 0;
    for (let x = 0; x < A.w; x++) {
      const i = (y * A.w + x) * A.ch;
      if (Math.abs(A.data[i] - B.data[i]) > thresh ||
          Math.abs(A.data[i + 1] - B.data[i + 1]) > thresh ||
          Math.abs(A.data[i + 2] - B.data[i + 2]) > thresh) c++;
    }
    rows[y] = c; n += c;
  }
  return { n, rows, w: A.w, h: A.h };
}

async function selftest() {
  let fails = 0;
  const ok = (t, c, d) => { console.log(`  ${c ? 'PASS' : 'FAIL'}  ${t}${d ? '  ' + d : ''}`); if (!c) fails++; };
  const W = 40, H = 40;
  const flat = Buffer.alloc(W * H * 3, 100);
  const planted = Buffer.from(flat);
  // plant a 4x4 block at rows 20-23, cols 10-13
  for (let y = 20; y < 24; y++) for (let x = 10; x < 14; x++) {
    const i = (y * W + x) * 3; planted[i] = 250; planted[i + 1] = 250; planted[i + 2] = 250;
  }
  const mk = (buf) => sharp(buf, { raw: { width: W, height: H, channels: 3 } }).png().toBuffer();
  const a = await mk(flat), b = await mk(planted);

  // §B ZERO — the differ must be able to return zero.
  const self = await diffProfile(a, a);
  ok('B self-pair = 0 changed px', self.n === 0, `n=${self.n}`);

  // §C KNOWN-BAD — planted block must be FOUND, and localised.
  const d = await diffProfile(a, b);
  const inBand = [...d.rows.slice(20, 24)].reduce((s, v) => s + v, 0);
  ok('C known-bad found', d.n === 16, `n=${d.n} (expect 16)`);
  ok('C localised to planted rows', inBand === 16 && d.n === inBand, `rows20-23=${inBand}`);

  // §A NON-EMPTY guard, asserted before any share.
  ok('A non-empty asserted', d.n > 0);

  // §D SIZE mismatch must throw, not silently resample.
  const small = await sharp(Buffer.alloc(20 * 20 * 3, 100), { raw: { width: 20, height: 20, channels: 3 } }).png().toBuffer();
  let threw = false;
  try { await diffProfile(a, small); } catch (e) { threw = e.code === 'SIZE'; }
  ok('D size mismatch refused', threw);

  console.log(fails === 0 ? 'SELFTEST 5/5 PASS' : `SELFTEST ${5 - fails}/5 — ${fails} FAIL`);
  process.exit(fails === 0 ? 0 : 1);
}

const IS_MAIN = process.argv[1] && path.resolve(process.argv[1]) === path.resolve(fileURLToPath(import.meta.url));
if (IS_MAIN) {
  if (flag('--selftest')) { await selftest(); }
  else if (flag('--control')) {
    const i = argv.indexOf('--control');
    const d = await diffProfile(argv[i + 1], argv[i + 2]);
    console.log(`DRIFT CONTROL  ${path.basename(argv[i + 1])} vs ${path.basename(argv[i + 2])}: ${d.n} changed px of ${d.w * d.h} (${(100 * d.n / (d.w * d.h)).toFixed(4)}%)`);
    console.log(d.n === 0 ? 'ZERO — non-zero numbers on this path are believable.'
      : 'NON-ZERO — this instrument drifts on identical input. Do not believe any delta below it.');
    process.exit(d.n === 0 ? 0 : 1);
  } else {
    const a = arg('--a'), b = arg('--b');
    if (!a || !b) { console.error('usage: --a <png> --b <png> [--thresh 6] | --control a b | --selftest'); process.exit(2); }
    const d = await diffProfile(a, b);
    if (d.n === 0) { console.log('0 changed pixels — nothing to attribute.'); process.exit(0); }
    console.log(`${path.basename(a)} vs ${path.basename(b)}  ${d.w}x${d.h}  changed ${d.n} px (${(100 * d.n / (d.w * d.h)).toFixed(3)}%)`);
    // Contiguous bands of changed rows, so two vertically disjoint edits separate.
    const bands = [];
    let cur = null;
    for (let y = 0; y < d.h; y++) {
      if (d.rows[y] > 0) { if (!cur) cur = { y0: y, y1: y, px: 0 }; cur.y1 = y; cur.px += d.rows[y]; }
      else if (cur) { bands.push(cur); cur = null; }
    }
    if (cur) bands.push(cur);
    console.log(`\n${'rows'.padEnd(14)} ${'changed px'.padEnd(12)} share`);
    for (const bd of bands.sort((p, q) => q.px - p.px)) {
      console.log(`${(bd.y0 + '-' + bd.y1).padEnd(14)} ${String(bd.px).padEnd(12)} ${(100 * bd.px / d.n).toFixed(2)}%`);
    }
  }
}
