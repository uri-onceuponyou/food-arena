#!/usr/bin/env node
/**
 * cr2_crop — the DRIFT CONTROL and the zoom, for the paired BEFORE/AFTER round.
 *
 * THROWAWAY. Read-only on src/.
 *
 * TWO JOBS, and the first is the one that matters.
 *
 * 1. DRIFT CONTROL. `cr2_shot.mjs`'s paint floor was validated against a known-bad
 *    and the result was honest but limited: a cleared buffer is caught (stdev 0.000,
 *    exit 3), and a frame with the CHARACTER HIDDEN is NOT (stdev 0.1311, passes) —
 *    a graded, vignetted backdrop is not flat. So the floor certifies "something was
 *    drawn", not "the right thing was drawn", and it certainly cannot tell whether
 *    the two ARMS of this round differ. CLAUDE.md #4: the question is no longer only
 *    "is it there?" but "is it the SAME?". If the two worktrees somehow served the
 *    same tree, every panel would be identical and the round would read as a clean
 *    null result rather than as the broken experiment it was. So: per-pixel mean
 *    absolute difference between the arms, printed, with the two arms of the SAME
 *    tree as the zero control if asked.
 *
 * 2. Zoom one named region of both arms side by side, so a defect that is 40px wide
 *    in a 900x1400 frame can actually be looked at.
 *
 * USE
 *   node tools/tmp/cr2_crop.mjs --diff shots/cr2/before/egg.png shots/cr2/after/egg.png
 *   node tools/tmp/cr2_crop.mjs --a shots/cr2/before/egg.png --b shots/cr2/after/egg.png \
 *     --rect 60,600,780,520 --out shots/cr2/zoom/egg-limbs.png
 */
import sharp from 'sharp';
import { mkdir } from 'node:fs/promises';
import { dirname, basename } from 'node:path';

const a = process.argv;
const get = (k, d) => (a.includes(k) ? a[a.indexOf(k) + 1] : d);

if (a.includes('--diff')) {
  const i = a.indexOf('--diff');
  const [p1, p2] = [a[i + 1], a[i + 2]];
  const [r1, r2] = await Promise.all([p1, p2].map((p) =>
    sharp(p).removeAlpha().raw().toBuffer({ resolveWithObject: true })));
  if (r1.info.width !== r2.info.width || r1.info.height !== r2.info.height) {
    console.error(`!! SIZE MISMATCH ${r1.info.width}x${r1.info.height} vs ${r2.info.width}x${r2.info.height}`
      + ' — the two arms were not framed identically and the round is VOID.');
    process.exit(3);
  }
  const A = r1.data, B = r2.data;
  let sum = 0, changed = 0, mx = 0;
  const nPx = A.length / 3;
  for (let k = 0; k < A.length; k += 3) {
    const d = (Math.abs(A[k] - B[k]) + Math.abs(A[k + 1] - B[k + 1]) + Math.abs(A[k + 2] - B[k + 2])) / 3;
    sum += d; if (d > 2) changed++; if (d > mx) mx = d;
  }
  const mad = sum / nPx;
  const pctChanged = (100 * changed) / nPx;
  console.log(`${basename(dirname(p1))}/${basename(p1)} vs ${basename(dirname(p2))}/${basename(p2)}`);
  console.log(`  mean |diff| ${mad.toFixed(3)} / 255   pixels differing by >2: ${pctChanged.toFixed(2)}%   max ${mx.toFixed(0)}`);
  // A same-tree re-render of this frozen, t-pinned URL is pixel-identical by
  // construction (src/preview.ts freezes the clock for exactly this reason), so
  // ANY non-zero difference here is the tree and nothing else.
  console.log(`  verdict: ${mad > 0.1 ? 'ARMS DIFFER — the two worktrees served different code' : '!! ARMS ARE IDENTICAL — round is VOID'}`);
  process.exit(mad > 0.1 ? 0 : 4);
}

const A = get('--a'), B = get('--b'), OUT = get('--out');
const [x, y, w, h] = get('--rect').split(',').map(Number);
const SCALE = Number(get('--scale', 2));
const GAP = 16;
const tiles = await Promise.all([A, B].map(async (p) => sharp(p)
  .extract({ left: x, top: y, width: w, height: h })
  .resize({ width: w * SCALE, height: h * SCALE, kernel: 'nearest' }).png().toBuffer()));
await mkdir(dirname(OUT), { recursive: true });
await sharp({ create: { width: w * SCALE * 2 + GAP * 3, height: h * SCALE + GAP * 2, channels: 4, background: { r: 22, g: 16, b: 31, alpha: 1 } } })
  .composite([{ input: tiles[0], left: GAP, top: GAP }, { input: tiles[1], left: GAP * 2 + w * SCALE, top: GAP }])
  .png().toFile(OUT);
console.log(`wrote ${OUT}  (left=${basename(dirname(A))}  right=${basename(dirname(B))})`);
