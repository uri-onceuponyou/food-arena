#!/usr/bin/env node
/**
 * p5_dlprobe — a KNOWN-BAD-INPUT test for `valuelib.vlAdjacency`'s `dL`.
 *
 * `weakBoundaryPct` gates on `dL = |p50(A) - p50(B)|` — the two parts' WHOLE-PART
 * medians. The perceptual question the metric is standing in for is "does the eye see
 * an edge where A meets B", which is a property of the pixels AT THE CONTACT.
 *
 * These two are the same number only when each part is roughly uniform. This file
 * builds the two cases where they are not and shows the metric returning a confident
 * wrong answer in BOTH directions. It reads nothing from the game and writes nothing;
 * every expected value below is derived by hand in the comment beside it.
 *
 * Run: node tools/tmp/p5_dlprobe.mjs
 */
import { VL } from './valuelib.mjs';

const W = 40, H = 40;
let pass = 0, fail = 0;
const check = (name, got, want, tol = 1e-3) => {
  const ok = Math.abs(got - want) <= tol;
  console.log(`${ok ? '  OK ' : '  ** '} ${name.padEnd(62)} ${String(got).padStart(8)}  (want ${want})`);
  ok ? pass++ : fail++;
};

/** Two vertical slabs, A on the left half, B on the right half. */
function slabs(lumaOfA, lumaOfB) {
  const A = new Uint8Array(W * H), B = new Uint8Array(W * H);
  const luma = new Float64Array(W * H);
  for (let y = 0; y < H; y++) for (let x = 0; x < W; x++) {
    const j = y * W + x;
    if (x < W / 2) { A[j] = 1; luma[j] = lumaOfA(x, y); } else { B[j] = 1; luma[j] = lumaOfB(x, y); }
  }
  return { A, B, luma };
}

// ── CASE 1: FALSE NEGATIVE — a boundary that is a hard 0.90 step, reported as 0.000 ──
// A is half 0.10 and half 0.90, arranged so the 0.90 band is the column that TOUCHES B.
// A's median is 0.50 by construction. B is uniform 0.50. Whole-part medians: identical.
// At the contact the step is |0.90 - 0.50| = 0.40, and it is a hard edge.
{
  const { A, B, luma } = slabs(
    (x) => (x >= W / 4 ? 0.90 : 0.10),   // right half of A (the touching side) is bright
    () => 0.50,
  );
  const r = VL.adjacency([A, B], ['A', 'B'], W, H, luma, 8);
  const p = r.pairs[0];
  check('CASE 1  contacts found', p.contacts, H);
  check('CASE 1  A p50 (half 0.10, half 0.90)', r.stats[0].p50, 0.50);
  check('CASE 1  B p50', r.stats[1].p50, 0.50);
  check('CASE 1  dL REPORTED  <- the metric says NO EDGE', p.dL, 0.0);
  // the truth, computed on the touching columns only
  let a = 0, b = 0;
  for (let y = 0; y < H; y++) { a += luma[y * W + (W / 2 - 1)]; b += luma[y * W + (W / 2)]; }
  check('CASE 1  dL AT THE CONTACT  <- what the eye sees', +(Math.abs(a - b) / H).toFixed(4), 0.40);
}

// ── CASE 2: FALSE POSITIVE — no visible edge at all, reported as a strong 0.40 ────────
// A ramps 0.10 -> 0.50 left to right; B ramps 0.50 -> 0.90. The two are CONTINUOUS
// across the seam: adjacent pixels differ by one ramp step. Medians are 0.30 and 0.70.
{
  const { A, B, luma } = slabs(
    (x) => 0.10 + (0.40 * x) / (W / 2 - 1),
    (x) => 0.50 + (0.40 * (x - W / 2)) / (W / 2 - 1),
  );
  const r = VL.adjacency([A, B], ['A', 'B'], W, H, luma, 8);
  const p = r.pairs[0];
  check('CASE 2  A p50 (ramp 0.10..0.50)', r.stats[0].p50, 0.30, 0.011);
  check('CASE 2  B p50 (ramp 0.50..0.90)', r.stats[1].p50, 0.70, 0.011);
  check('CASE 2  dL REPORTED  <- the metric says STRONG EDGE', p.dL, 0.40, 0.021);
  let a = 0, b = 0;
  for (let y = 0; y < H; y++) { a += luma[y * W + (W / 2 - 1)]; b += luma[y * W + (W / 2)]; }
  check('CASE 2  dL AT THE CONTACT  <- what the eye sees', +(Math.abs(a - b) / H).toFixed(4), 0.0, 0.011);
}

// ── CASE 3: the CONTROL — two uniform slabs, where median IS the contact ────────────
{
  const { A, B, luma } = slabs(() => 0.20, () => 0.65);
  const r = VL.adjacency([A, B], ['A', 'B'], W, H, luma, 8);
  check('CASE 3  uniform slabs: reported dL == contact dL', r.pairs[0].dL, 0.45);
}

// ── CASE 4: the minContacts gate is a CLIFF, not a taper ────────────────────────────
// One pixel of contact either side of the threshold flips a pair between "counted" and
// "does not exist". `weakBoundaryPct` weights by contacts, so a pair at the threshold
// enters the denominator AND the numerator at full weight.
{
  const A = new Uint8Array(W * H), B = new Uint8Array(W * H);
  const luma = new Float64Array(W * H).fill(0.5);
  for (let y = 0; y < 8; y++) { A[y * W + 10] = 1; B[y * W + 11] = 1; luma[y * W + 11] = 0.5; }
  const at8 = VL.adjacency([A, B], ['A', 'B'], W, H, luma, 8).pairs.length;
  const at9 = VL.adjacency([A, B], ['A', 'B'], W, H, luma, 9).pairs.length;
  check('CASE 4  8 contacts at minContacts=8  -> pair EXISTS', at8, 1);
  check('CASE 4  8 contacts at minContacts=9  -> pair VANISHES', at9, 0);
}

console.log(`\n${pass} passed, ${fail} failed`);
process.exit(fail ? 1 : 0);
