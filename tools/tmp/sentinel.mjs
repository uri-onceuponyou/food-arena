#!/usr/bin/env node
/**
 * SENTINEL — prove an instrument RESPONDS before believing what it says.
 *
 * ── Why this exists ──────────────────────────────────────────────────────────
 * Seventeen measuring devices have been caught in this session returning confident,
 * in-range, four-decimal numbers that were wrong. Not seventeen bugs in the game —
 * seventeen INSTRUMENTS. Two of them steered whole passes before anyone noticed.
 *
 * `docs/LESSONS.md` §13 already states the rule — *"validate the instrument against a
 * known input before believing it on an unknown one"* — and nothing enforced it. This
 * is the enforcement, and it is deliberately three assertions and not a framework.
 * Sorting the seventeen by what actually went wrong, they collapse into three shapes
 * plus one about copies:
 *
 *   MOVES   the instrument did not respond to the thing it claims to measure.
 *           · a cache serving a stale answer indistinguishable from a fresh one
 *           · four dL stations identical TO FOUR DECIMALS across a change that moved
 *             every other station by 0.03-0.04
 *           · `AI stalled: 0.0%`, true for months while the AI was permanently
 *             deadlocked, because the threshold was 15wu and it oscillated 38
 *           · a guard whose coverage SHRANK 49 -> 41 when a bug was fixed, because its
 *             census keyed off the bug's own fingerprint
 *           → perturb a known input; the number must move by at least `minDelta`.
 *
 *   HOLDS   the instrument responded to something it should be blind to.
 *           · the countdown length re-seeding every match, so a +0.01s timing change
 *             appeared to move 38 of 110 matchups by up to 50pp — entirely fictitious
 *           · a QA parameter that MANUFACTURED a bug that did not exist
 *           · a tool ignoring `PREVIEW_BASE`, so it answered "what is on port 5187"
 *             rather than "what does this tree do"
 *           → perturb something irrelevant; the number must NOT move.
 *
 *   ORDERS  the instrument had the wrong SIGN, which is worse than noise because it
 *           inverts the answer rather than blurring it.
 *           · the preview harness rendering characters DARKER than ground while the
 *             match renders them LIGHTER — opposite polarity, every character packet
 *             ever judged
 *           · a harness reporting a square as ROUNDER than a circle
 *           · a rail and its HUD-free twin returning opposite verdicts on one move
 *           → two inputs whose order is known by construction; the ranking must hold.
 *
 * And the special case of MOVES that is worth its own helper:
 *
 *   SELF-PAIR   feed the instrument the SAME input twice. Anything it reports as a
 *               difference is its own noise. A noise floor derived by dividing where
 *               the variance ratio needs sqrt(2) would have reported a LITERAL CLONE
 *               as a real difference; that is exactly this check failing.
 *
 * ── The second check: CLONES ─────────────────────────────────────────────────
 * One stale driver copied into ten tools, five still carrying the defect, and a
 * fourteenth copy born DURING the audit. `driver_guard.mjs` closes that specific
 * driver. The general shape — a 1,500-line instrument duplicated so a fix reaches one
 * copy and not the other — is not closed, and this session found a live instance:
 * `tools/tmp/perf_tier.mjs` is `tools/perf.mjs` with three lines changed.
 *
 * The census is a REGISTRY, not a nag. A pair that is not registered fails. A
 * registered pair that DIVERGES past its recorded budget fails — which is the actual
 * failure mode, because the copies do not start wrong, they drift.
 *
 * ── Every check is proved on the input it guards against ─────────────────────
 * `--selftest` runs each assertion kind against a deliberately broken instrument —
 * a constant metric, a metric frozen at its first answer (task 1's bug, verbatim), a
 * metric that reads the harness instead of the subject, a sign-flipped metric — and
 * FAILS on each. A guard that passes on the bug it guards against is not a guard.
 *
 * ⚠️ For `VL.adjacency` the broken instrument is not a stand-in — it is a MUTANT OF THE
 * REAL SOURCE. `valuelib.mjs` keeps every formula in one `VL_SRC` string precisely so
 * that Node and the page run the same code, and that string can be string-substituted
 * and re-evaluated. So the five mutations below are the actual shipped function with one
 * expression changed, not a hand-written imitation of it that could be wrong in a way the
 * original is not. `mutantVL([])` — a rebuild with NO substitution — is asserted to
 * reproduce the real `VL` exactly, because a mutation harness that changes the answer on
 * its own would make every refusal below meaningless.
 *
 * Usage:
 *   node tools/tmp/sentinel.mjs              # run the registry + the clone census
 *   node tools/tmp/sentinel.mjs --selftest   # prove the four assertions on known-bad input
 *   node tools/tmp/sentinel.mjs --clones     # census only
 */

import { readdir, readFile } from 'node:fs/promises';
import { join, relative, resolve } from 'node:path';
import { createHash } from 'node:crypto';
import { pathToFileURL } from 'node:url';
import sharp from 'sharp';

import { VL, VL_SRC } from './valuelib.mjs';
import { frameStats, assertFrame, CaptureRefused } from './settle.mjs';

const ROOT = resolve(new URL('../..', import.meta.url).pathname);

// ─────────────────────────────────────────────────────────────────────────────
// The three assertions
//
// Each takes a `metric` — any function of one input — and returns a result row.
// They are deliberately dumb: no config objects, no plugins, no discovery. The value
// is in what they FORBID, and a helper you have to read the source of to use is a
// helper nobody uses.
// ─────────────────────────────────────────────────────────────────────────────

const num = (v) => (typeof v === 'number' ? v : Number(v));

/**
 * MOVES — the metric must respond to a perturbation it is supposed to see.
 *
 * `minDelta` is the point below which the response would be indistinguishable from
 * rounding. Choose it from the metric's own reporting precision, not from taste: a
 * number printed to 4 decimals that moves by 1e-9 has not moved.
 */
export function moves({ name, metric, a, b, minDelta = 1e-4, why }) {
  let va; let vb; let err = null;
  try { va = num(metric(a)); vb = num(metric(b)); } catch (e) { err = String(e); }
  const delta = err ? null : Math.abs(vb - va);
  return {
    kind: 'MOVES', name, why, a: va, b: vb, delta, threshold: minDelta, err,
    ok: !err && Number.isFinite(delta) && delta >= minDelta,
    detail: err ? `threw: ${err}`
      : `${va} -> ${vb}  (moved ${delta}, needs >= ${minDelta})`,
  };
}

/**
 * HOLDS — the metric must be BLIND to a perturbation that does not change the subject.
 *
 * This is the half that catches an instrument measuring its own harness. It is also
 * the half people skip, because a metric that moves feels alive.
 */
export function holds({ name, metric, a, b, maxDelta = 1e-9, why }) {
  let va; let vb; let err = null;
  try { va = num(metric(a)); vb = num(metric(b)); } catch (e) { err = String(e); }
  const delta = err ? null : Math.abs(vb - va);
  return {
    kind: 'HOLDS', name, why, a: va, b: vb, delta, threshold: maxDelta, err,
    ok: !err && Number.isFinite(delta) && delta <= maxDelta,
    detail: err ? `threw: ${err}`
      : `${va} vs ${vb}  (moved ${delta}, must be <= ${maxDelta})`,
  };
}

/**
 * ORDERS — the metric must RANK two inputs whose order is known by construction.
 *
 * The only one of the three that catches a sign error, and a sign error is the one
 * fault no amount of extra rounds can find: it does not add noise, it flips the
 * answer, so every round agrees with every other round and all of them are backwards.
 */
export function orders({ name, metric, lower, higher, minGap = 1e-4, why }) {
  let vl; let vh; let err = null;
  try { vl = num(metric(lower)); vh = num(metric(higher)); } catch (e) { err = String(e); }
  const gap = err ? null : vh - vl;
  return {
    kind: 'ORDERS', name, why, a: vl, b: vh, delta: gap, threshold: minGap, err,
    ok: !err && Number.isFinite(gap) && gap >= minGap,
    detail: err ? `threw: ${err}`
      : `lower ${vl} < higher ${vh}?  gap ${gap} (needs >= ${minGap})`,
  };
}

/**
 * SELF-PAIR — the same input twice. A difference reported here is the instrument's
 * own floor, and any claimed noise floor below it is fiction.
 *
 * ⚠️ `identity` is NOT optional decoration — without it this check proves ONLY
 * determinism. `holds({ a, b: a })` compares `metric(a)` against `metric(a)`, which for
 * any pure function is zero no matter WHAT the function returns. The row named
 * "figureGround reports ZERO on a figure identical to its ground" passed for its whole
 * life while asserting nothing of the kind: a `figureGround` that returned a confident
 * 0.42 separation on an identical field would have sailed through it. That is the exact
 * shape of the nineteen instruments — a green row that would look the same if the thing
 * it names were broken (`docs/LESSONS.md` §13, "a healthy dashboard is not evidence of
 * health"). When the answer on a self-identical input is known by construction, pass it,
 * and the returned VALUE is checked against it as well as against itself.
 */
export function selfPair({ name, metric, a, maxDelta = 0, identity, why }) {
  const r = holds({ name, metric, a, b: a, maxDelta, why });
  if (identity === undefined || !r.ok) return { ...r, kind: 'SELF-PAIR' };
  const off = Math.abs(num(r.a) - identity);
  return {
    ...r,
    kind: 'SELF-PAIR',
    ok: Number.isFinite(off) && off <= maxDelta,
    detail: `${r.detail}; and the IDENTITY answer: ${r.a} vs required ${identity} `
      + `(off by ${off}, must be <= ${maxDelta})`,
  };
}

// ─────────────────────────────────────────────────────────────────────────────
// The registry — real metrics this project steers by
//
// Kept small on purpose. Every entry here is a metric whose failure has ALREADY cost
// this project time, or which a live guard depends on being true.
// ─────────────────────────────────────────────────────────────────────────────

const rep = (v, n) => new Array(n).fill(v);

/** A W x H greyscale RGB buffer at a constant value. */
function flatRGB(W, H, v) {
  const b = new Uint8Array(W * H * 3);
  b.fill(v);
  return b;
}

/** A figure/ground field: an 8x8 figure at `fig` centred in a 40x40 ground at `grd`. */
function fgField(fig, grd) {
  const W = 40; const H = 40;
  const mask = new Uint8Array(W * H); const luma = new Float32Array(W * H);
  for (let y = 0; y < H; y++) {
    for (let x = 0; x < W; x++) {
      const inFig = x >= 16 && x < 24 && y >= 16 && y < 24;
      mask[y * W + x] = inFig ? 1 : 0;
      luma[y * W + x] = inFig ? fig : grd;
    }
  }
  return { W, H, mask, luma };
}

// ── VL.adjacency fixtures ────────────────────────────────────────────────────
// Two vertical slabs: part `A` owns the left half, part `B` the right. Their only
// contact is the seam at x = W/2, so the "contact band" is exactly one column on each
// side and every expected number below can be derived by hand. The construction is
// lifted from `tools/tmp/p5_dlprobe.mjs`, which is where these cases were derived.
//
// ⚠️ `adjacency` reports TWO quantities and they are NOT interchangeable:
//   dL         |p50(A) - p50(B)| over each part's WHOLE mask — a DISTRIBUTION statistic
//   dLcontact  |mean(A's touching pixels) - mean(B's touching pixels)| — a SPATIAL one
// On live HEAD they give a different 0.10 verdict on 30 of 90 pairs, so a fixture that
// cannot tell them apart guards neither. Every row below is chosen so the two answer
// DIFFERENTLY, which is what makes each one discriminating.
const ADJ_W = 40;
const ADJ_H = 40;

/** `fA(x,y)` sets the luma of A's pixels, `fB` of B's. */
function adjField(fA, fB) {
  const A = new Uint8Array(ADJ_W * ADJ_H);
  const B = new Uint8Array(ADJ_W * ADJ_H);
  const luma = new Float64Array(ADJ_W * ADJ_H);
  for (let y = 0; y < ADJ_H; y++) {
    for (let x = 0; x < ADJ_W; x++) {
      const j = y * ADJ_W + x;
      if (x < ADJ_W / 2) { A[j] = 1; luma[j] = fA(x, y); } else { B[j] = 1; luma[j] = fB(x, y); }
    }
  }
  return { A, B, luma };
}

/** The one pair `adjacency` finds in an `adjField`. `vl` so the selftest can pass a mutant. */
function adjPair(f, vl = VL) {
  return vl.adjacency([f.A, f.B], ['A', 'B'], ADJ_W, ADJ_H, f.luma, 8).pairs[0];
}

// A's pixels are the SAME MULTISET in both — half 0.10, half 0.90, median 0.50 — mirrored
// so that the half TOUCHING B is bright in one and dark in the other. B is a uniform 0.60.
// Measured: dL 0.1000 in BOTH (blind to the mirror, as a distribution statistic must be);
// dLcontact 0.3000 vs 0.5000 (sees it, as a boundary statistic must).
const ADJ_MIRROR_BRIGHT = adjField((x) => (x < 10 ? 0.10 : 0.90), () => 0.60);
const ADJ_MIRROR_DARK = adjField((x) => (x < 10 ? 0.90 : 0.10), () => 0.60);

// The two cases that falsify `dL` by construction, from p5_dlprobe / valuescan section L.
// HARD_STEP: a 0.40 step the eye cannot miss   -> dL 0.0000, dLcontact 0.4000.
// SEAMLESS:  two ramps CONTINUOUS at the seam  -> dL 0.4000, dLcontact 0.0000.
const ADJ_HARD_STEP = adjField((x) => (x < 10 ? 0.10 : 0.90), () => 0.50);
const ADJ_SEAMLESS = adjField(
  (x) => 0.10 + (0.40 * x) / (ADJ_W / 2 - 1),
  (x) => 0.50 + (0.40 * (x - ADJ_W / 2)) / (ADJ_W / 2 - 1),
);

// The negative control: one uniform field, arbitrarily cut in two. There is no boundary
// here in any sense, and both columns must say so.
const ADJ_FLAT = adjField(() => 0.50, () => 0.50);

/**
 * A 320x180 frame with a bright player block, so `gridDL` has something to find.
 * `blockLuma` is the byte value inside the arena-scan player block.
 */
function gridFrame(blockV, ringV) {
  const W = 320; const H = 180; const d = new Uint8Array(W * H * 3);
  for (let y = 0; y < H; y++) {
    for (let x = 0; x < W; x++) {
      const cx = Math.floor(x / 20); const cy = Math.floor(y / 20);
      const inP = cx >= 7 && cx <= 9 && cy >= 4 && cy <= 5;
      const v = inP ? blockV : ringV;
      const k = (y * W + x) * 3; d[k] = v; d[k + 1] = v; d[k + 2] = v;
    }
  }
  return d;
}

/**
 * A PNG that looks like a settled menu screen, and the SAME content mid-fade.
 *
 * The fade is modelled the way the browser actually composites it: the screen's own
 * pixels at `alpha`, over the shell's flat background. That is why a mid-fade frame
 * loses contrast without going dark — `settle.mjs` measured exactly this on a real
 * navigation (stdev 67.16 -> 81.77 whole-frame, and the pure background UNCHANGED at
 * 4.92 -> 4.37, which is what proved the mechanism).
 */
async function framePNG(alpha) {
  const W = 160; const H = 120; const BG = 214;   // the orange `.fa-bg`, as a grey
  const buf = Buffer.alloc(W * H * 3);
  for (let y = 0; y < H; y++) {
    for (let x = 0; x < W; x++) {
      // A card with a title bar and a button — enough structure to have a real stdev.
      let v = 60;
      if (y > 20 && y < 100 && x > 20 && x < 140) v = 200;
      if (y > 30 && y < 44 && x > 30 && x < 130) v = 20;
      if (y > 70 && y < 92 && x > 50 && x < 110) v = 250;
      const composited = Math.round(v * alpha + BG * (1 - alpha));
      const k = (y * W + x) * 3;
      buf[k] = composited; buf[k + 1] = composited; buf[k + 2] = composited;
    }
  }
  return sharp(buf, { raw: { width: W, height: H, channels: 3 } }).png().toBuffer();
}

/**
 * The registry needs three MEASURED frame statistics before the rows can be built, so
 * it is a function rather than a constant. `framePNG(alpha)` composites the screen's
 * own pixels over the shell background exactly the way the browser does during
 * `fa-screen-in`, which is what makes the mid-fade row a real model and not a stand-in.
 */
async function registry() {
  const settled = await framePNG(1.0);
  const midFade = await framePNG(0.35);
  const background = await framePNG(0.0);
  const stSettled = await frameStats(settled);
  const stFade = await frameStats(midFade);
  const stBackground = await frameStats(background);

  const rows = [
    moves({
      name: 'VL.ladder.range responds to a real value ladder',
      why: 'a flat blob and a three-tone character must not score the same',
      metric: (xs) => VL.ladder(xs, {}).range,
      a: rep(0.5, 900),
      b: [...rep(0.05, 300), ...rep(0.50, 300), ...rep(0.95, 300)],
      minDelta: 0.5,
    }),
    holds({
      name: 'VL.ladder.range is blind to PIXEL ORDER',
      why: 'a distribution statistic; if shuffling the same pixels moves it, it is measuring scan order',
      metric: (xs) => VL.ladder(xs, {}).range,
      a: [...rep(0.1, 300), ...rep(0.9, 300)],
      b: Array.from({ length: 600 }, (_, i) => (i % 2 ? 0.9 : 0.1)),
      maxDelta: 1e-9,
    }),
    orders({
      name: 'VL.ladder.steps ranks a 3-tone ladder above a flat blob',
      why: 'the acceptance test gates on steps >= 6',
      metric: (xs) => VL.ladder(xs, {}).steps.j10,
      lower: rep(0.5, 900),
      higher: [...rep(0.05, 300), ...rep(0.50, 300), ...rep(0.95, 300)],
      minGap: 1,
    }),
    orders({
      name: 'VL.figureGround.dL has the RIGHT SIGN (LESSONS §13 polarity)',
      why: 'preview.ts rendered characters DARKER than ground (-0.40) while the match renders '
        + 'them LIGHTER (+0.27); every character packet was judged at the wrong polarity and nothing checked the sign',
      metric: ({ W, H, mask, luma }) => VL.figureGround(luma, W, H, mask, { ringFrac: 0.30, edgeR: 2 }).dL,
      lower: fgField(0.3, 0.7),
      higher: fgField(0.7, 0.3),
      minGap: 0.7,
    }),
    selfPair({
      name: 'VL.figureGround reports ZERO on a figure identical to its ground',
      why: 'the negative control: separation found where there is none makes every small dL unfalsifiable',
      metric: ({ W, H, mask, luma }) => VL.figureGround(luma, W, H, mask, { ringFrac: 0.30, edgeR: 2 }).dL,
      a: fgField(0.5, 0.5),
      maxDelta: 1e-9,
      // Added, not decoration: without it this row asserted only that figureGround is
      // deterministic — metric(a) vs metric(a) is zero for ANY pure function, so a
      // figureGround returning a confident 0.42 on an identical field passed this row.
      // Measured on the real VL: exactly 0.
      identity: 0,
    }),
    // ── VL.adjacency ─────────────────────────────────────────────────────────
    // The metric that fails 5 of 11 characters and that aims every character agent, and
    // until now the only member of the value-ladder core with NO sentinel of any kind.
    // Six rows, because `dL` and `dLcontact` are different quantities that disagree on
    // 30 of 90 live pairs, and a single row cannot be discriminating for both.
    moves({
      name: 'VL.adjacency.dLcontact SEES which side of A touches B',
      why: 'the whole reason the column exists. A is the SAME MULTISET in both fixtures — half '
        + '0.10, half 0.90 — mirrored so the touching half is bright in one and dark in the other. '
        + 'A dLcontact that does not move here is not measuring the boundary, and the boundary is '
        + 'the entire perceptual claim ("does the eye see an edge where A meets B").',
      metric: (f) => adjPair(f).dLcontact,
      a: ADJ_MIRROR_BRIGHT,   // 0.3000
      b: ADJ_MIRROR_DARK,     // 0.5000
      // 0.10 against a measured 0.20, and 26x the metric's own floor. RESOLUTION FLOOR of
      // dLcontact is 0.0039 — the 8-bit quantisation of valuescan's value.png, which is
      // where the live numbers are read from. Nothing here asserts inside that.
      minDelta: 0.10,
    }),
    holds({
      name: 'VL.adjacency.dL is blind to that same mirror — it is a DISTRIBUTION statistic',
      why: 'dL is PINNED, not endorsed. valuelib keeps it byte-for-byte because peers A/B against '
        + 'it and moving a metric under a running comparison is the fault this instrument exists to '
        + 'stop. Same multiset, same median, so dL MUST read 0.1000 both times; if it ever moves '
        + 'here someone has redefined dL in place and every recorded weakBoundaryPct silently '
        + 'changed meaning. This is the pin. It is the sibling of the ladder\'s pixel-order row.',
      metric: (f) => adjPair(f).dL,
      a: ADJ_MIRROR_BRIGHT,
      b: ADJ_MIRROR_DARK,
      maxDelta: 1e-9,
    }),
    orders({
      name: 'VL.adjacency.dLcontact ranks a HARD SEAM above a SEAMLESS RAMP (dL ranks them BACKWARDS)',
      why: 'the §13 polarity check, live in the instrument the next wave steers by. A hard 0.40 step '
        + 'at the seam and a pair of ramps that are CONTINUOUS across it — no edge at all. Measured: '
        + 'dLcontact 0.0000 -> 0.4000, correct; dL 0.4000 -> 0.0000, EXACTLY INVERTED. A sign error '
        + 'is the one fault more rounds can never find, because every round agrees and all of them '
        + 'are backwards — and this one is not hypothetical, it is what dL does on this input today.',
      metric: (f) => adjPair(f).dLcontact,
      lower: ADJ_SEAMLESS,     // 0.0000
      higher: ADJ_HARD_STEP,   // 0.4000
      minGap: 0.30,
    }),
    orders({
      name: 'VL.adjacency.cA is A\'s OWN contact band, not B\'s',
      why: 'cA/cB exist so dLcontact can be audited rather than trusted, and dLcontact is an '
        + 'ABSOLUTE difference — so swapping the two bands leaves it completely unchanged and is '
        + 'invisible to every other row here. What it changes is WHICH PART a character agent is '
        + 'told to move: read the wrong way round, the brief says darken the torso when the head is '
        + 'the bright side. cA belongs to the lower-indexed part; on the mirror fixtures that is A, '
        + 'whose touching column is 0.10 in one and 0.90 in the other.',
      metric: (f) => adjPair(f).cA,
      lower: ADJ_MIRROR_DARK,     // 0.1000
      higher: ADJ_MIRROR_BRIGHT,  // 0.9000
      minGap: 0.50,
    }),
    selfPair({
      name: 'VL.adjacency reports ZERO dLcontact on one uniform field cut in two',
      why: 'the negative control. A boundary found where there is none makes every small dLcontact '
        + 'unfalsifiable — and weakBoundaryPct is a CLIFF over a hard 0.10, so a constant offset '
        + 'anywhere in this path moves a character\'s score by its whole contact share (pizza 32.7 pp) '
        + 'without any pixel changing.',
      metric: (f) => adjPair(f).dLcontact,
      a: ADJ_FLAT,
      maxDelta: 1e-9,
      identity: 0,
    }),
    holds({
      name: 'VL.adjacency.contacts is a GEOMETRY count, blind to luma',
      why: 'contacts is the WEIGHT in weakBoundaryPct, so a wrong count rewrites every percentage '
        + 'ever recorded without touching a single dL. Same masks, wildly different luma (a flat '
        + 'field vs a hard 0.40 seam) must give the same 40 right-edge contacts. It also guards the '
        + 'minContacts CLIFF from below: valuescan section L4 shows 8 contacts at minContacts=8 is a '
        + 'pair and the same 8 at 9 is no pair at all, so anything that suppresses contacts does not '
        + 'shade a number, it deletes the pair from BOTH sides of the ratio.',
      metric: (f) => adjPair(f).contacts,
      a: ADJ_FLAT,
      b: ADJ_HARD_STEP,
      maxDelta: 0,
    }),
    moves({
      name: 'VL.gridDL responds to a hero/ground step',
      why: 'arena-scan records it and valuescan cross-checks against it; a frozen gridDL '
        + 'would make every cross-check agree by construction',
      metric: (d) => VL.gridDL(d, 320, 180).deltaLuma,
      a: gridFrame(60, 60),
      b: gridFrame(214, 60),
      minDelta: 0.3,
    }),
    orders({
      name: 'frameStats.stdev ranks a MID-FADE frame below a settled one',
      why: 'THE PREMISE of capture_audit and settle.mjs. If a fade did not compress '
        + 'contrast, the 43-file capture sweep would be guarding nothing.',
      metric: (s) => s.stdev,
      lower: stFade,
      higher: stSettled,
      minGap: 5,
    }),
    moves({
      name: 'assertFrame REFUSES a flat frame and accepts a real one',
      why: 'a guard nobody has seen refuse anything is not evidence (0 = accepted, 1 = refused)',
      metric: (st) => { try { assertFrame(st); return 0; } catch (e) { return e instanceof CaptureRefused ? 1 : 2; } },
      a: stSettled,
      b: { stdev: 0.0, mean: 214, min: 214, max: 214 },
      minDelta: 1,
    }),
    moves({
      name: 'assertFrame REFUSES a pure-background frame',
      why: 'settle.mjs measured the pure-background control at stdev 4.92 UNCHANGED across '
        + 'the fade, so the fade test cannot catch it — the FLOOR has to.',
      metric: (st) => { try { assertFrame(st); return 0; } catch { return 1; } },
      a: stSettled,
      b: stBackground,
      minDelta: 1,
    }),
    selfPair({
      name: 'frameStats is deterministic on identical bytes',
      why: 'a LITERAL CLONE must read as no difference — a noise floor derived by dividing '
        + 'where the variance ratio needs sqrt(2) would report one as a real difference',
      metric: (b) => b.stdev,
      a: stSettled,
      maxDelta: 0,
    }),
  ];
  return rows;
}

// ─────────────────────────────────────────────────────────────────────────────
// CLONE CENSUS
// ─────────────────────────────────────────────────────────────────────────────

/**
 * Acknowledged duplicates: pair -> the number of differing lines it is allowed.
 *
 * A registered clone is not forgiven, it is BUDGETED. The failure mode that cost this
 * project a session was not the copy existing; it was the copy DRIFTING while the
 * original was fixed. So the budget is the thing that fires.
 */
const CLONES = {
  'tools/perf.mjs :: tools/tmp/perf_tier.mjs': {
    budget: 12,
    why: 'perf_tier is perf.mjs plus a `--query` flag that pins a render tier. 8 differing '
      + 'lines today (a const, a comment block, two URL concatenations). This is the shape '
      + 'that put a stale scripted-player driver into ten tools with five still carrying the '
      + 'defect — the right fix is `perf.mjs --query <q>` and deleting the copy, which is '
      + 'the perf owner\'s call, not this guard\'s. The budget is what makes a divergent '
      + 'fix show up as a FAILURE instead of as silence.',
  },
  'tools/tmp/limbcheck.mjs :: tools/tmp/limbcheck_pitch.mjs': {
    budget: 26,
    why: 'FOUND BY THIS CENSUS ON ITS FIRST RUN. 93.3% identical, 21 lines diverged today: a '
      + '`--pitch` flag, the URL that carries it, one log line and the two files\' own header '
      + 'comments. `limbcheck_pitch.mjs`\'s header makes the claim out loud — "everything else '
      + 'in this file is byte-identical to limbcheck.mjs, so the two runs are directly '
      + 'comparable and any delta is PITCH" — and until now NOTHING CHECKED IT. That claim is '
      + 'what every 22-degree-vs-58-degree comparison rests on: if a fix lands in the chroma '
      + 'key or the detachment test in one file and not the other, the delta stops being '
      + 'pitch and starts being the fix, silently. The budget is the check.',
  },
};

const CLONE_MIN_LINES = 300;
const CLONE_MIN_SIMILARITY = 0.90;

/** Non-trivial lines, hashed. Blank lines and one-token lines carry no identity. */
function lineSet(src) {
  const s = new Set();
  for (const raw of src.split('\n')) {
    const l = raw.trim();
    if (l.length < 8) continue;
    s.add(createHash('sha1').update(l).digest('hex').slice(0, 12));
  }
  return s;
}

export function similarity(a, b) {
  let inter = 0;
  for (const x of a) if (b.has(x)) inter++;
  const union = a.size + b.size - inter;
  return union ? inter / union : 1;
}

async function listMjs(dir, out = []) {
  for (const e of await readdir(dir, { withFileTypes: true })) {
    const p = join(dir, e.name);
    if (e.isDirectory()) await listMjs(p, out);
    else if (e.name.endsWith('.mjs')) out.push(p);
  }
  return out;
}

export async function cloneCensus() {
  const files = (await listMjs(join(ROOT, 'tools'))).sort();
  const kept = [];
  for (const abs of files) {
    const rel = relative(ROOT, abs);
    // `_before_*` are FROZEN pre-change copies kept deliberately for A/B. They are
    // supposed to be stale; that is their entire job.
    if (/(^|\/)_before_/.test(rel)) continue;
    const src = await readFile(abs, 'utf8');
    const lines = src.split('\n').length;
    if (lines < CLONE_MIN_LINES) continue;
    kept.push({ rel, lines, set: lineSet(src), src });
  }
  const pairs = [];
  for (let i = 0; i < kept.length; i++) {
    for (let j = i + 1; j < kept.length; j++) {
      const sim = similarity(kept[i].set, kept[j].set);
      if (sim < CLONE_MIN_SIMILARITY) continue;
      const A = new Set(kept[i].src.split('\n').map((l) => l.trim()));
      const B = new Set(kept[j].src.split('\n').map((l) => l.trim()));
      let diverged = 0;
      for (const l of A) if (l && !B.has(l)) diverged++;
      for (const l of B) if (l && !A.has(l)) diverged++;
      pairs.push({ key: `${kept[i].rel} :: ${kept[j].rel}`, sim: +sim.toFixed(4), diverged });
    }
  }
  return pairs;
}

// ─────────────────────────────────────────────────────────────────────────────
// MUTANTS — the real instrument, with one expression changed
//
// `valuelib.mjs` holds every formula in a single `VL_SRC` string so Node and the page run
// identical code. That makes a real mutation cheap: substitute one expression, re-evaluate,
// and you have the SHIPPED function with a plausible bug in it — not a hand-written
// imitation that could differ from the original in ways the mutation never touched.
//
// Each anchor is matched EXACTLY and a miss THROWS. That matters more than it looks: if
// valuelib is refactored and an anchor stops matching, a silently-skipped mutation would
// turn every refusal below into a pass, which is the "guard whose coverage shrank when a
// bug was fixed" failure mode this file was written for.
// ─────────────────────────────────────────────────────────────────────────────

function mutantVL(muts) {
  const saved = globalThis.VL;
  let src = VL_SRC;
  for (const [from, to] of muts) {
    if (!src.includes(from)) throw new Error(`mutation anchor no longer present in VL_SRC: ${from}`);
    src = src.split(from).join(to);
  }
  try {
    new Function(src)();          // eslint-disable-line no-new-func
    return globalThis.VL;
  } finally {
    globalThis.VL = saved;        // the real VL is never left replaced
  }
}

const ADJ_DL_CONTACT = 'dLcontact: cA == null || cB == null ? null : +Math.abs(cA - cB).toFixed(4),';
const ADJ_DL = 'dL: +Math.abs(stats[a].p50 - stats[b].p50).toFixed(4),';
const ADJ_BAND_SIDE = 'if (o < p) { e.sA += luma[j]; e.nA++; } else { e.sB += luma[j]; e.nB++; }';
const ADJ_BUMP_RIGHT = 'if (x < W - 1) bump(owner[j], owner[j + 1]);';

/** dLcontact quietly becomes an ALIAS of dL — the "simplify the duplicate column" regression. */
const MUT_ALIAS = [[ADJ_DL_CONTACT, 'dLcontact: +Math.abs(stats[a].p50 - stats[b].p50).toFixed(4),']];
/** dL is "fixed" in place to the contact band — silently rewriting every running A/B. */
const MUT_REVERSE_ALIAS = [[ADJ_DL, 'dL: cA == null || cB == null ? null : +Math.abs(cA - cB).toFixed(4),']];
/** The two contact bands accumulate onto the wrong sides. dLcontact is UNCHANGED (it is an abs). */
const MUT_SIDE_SWAP = [[ADJ_BAND_SIDE, 'if (o < p) { e.sB += luma[j]; e.nB++; } else { e.sA += luma[j]; e.nA++; }']];
/** A constant offset in the boundary path — separation reported where there is none. */
const MUT_OFFSET = [[ADJ_DL_CONTACT, 'dLcontact: cA == null || cB == null ? null : +(Math.abs(cA - cB) + 0.42).toFixed(4),']];
/** "Only count a contact where there is actually a step" — a plausible optimisation that
 *  makes the WEIGHT depend on the values it is supposed to weight. */
const MUT_LUMA_GATED_CONTACTS = [[ADJ_BUMP_RIGHT, 'if (x < W - 1 && luma[j] !== luma[j + 1]) bump(owner[j], owner[j + 1]);']];

// ─────────────────────────────────────────────────────────────────────────────
// SELFTEST — every assertion, against an instrument that is BROKEN in its own way
// ─────────────────────────────────────────────────────────────────────────────

function selftest() {
  let pass = 0; let fail = 0;
  const t = (name, ok, detail) => {
    if (ok) pass++; else fail++;
    console.log(`${ok ? 'PASS' : 'FAIL'}  ${name.padEnd(64)} ${detail}`);
  };

  console.log('\n── MOVES, against instruments that do not respond ──\n');

  // 1. The constant. The dumbest broken instrument, and the one every other one
  //    degenerates into.
  t('a CONSTANT metric fails MOVES',
    !moves({ name: 'x', metric: () => 0.5, a: 1, b: 2, minDelta: 0.01 }).ok, 'refused');

  // 2. TASK 1'S BUG, VERBATIM: a metric that computes once and serves the cached answer
  //    forever. Indistinguishable from a live one by inspection; caught in one line here.
  const staleCache = (() => {
    let cached = null;
    return (x) => { if (cached === null) cached = x * 2; return cached; };
  })();
  t('a STALE CACHE (task 1: gate reading pre-value-pass JSON) fails MOVES',
    !moves({ name: 'x', metric: staleCache, a: 1, b: 99, minDelta: 0.01 }).ok, 'refused');

  // 3. A metric that moves, but under the reporting precision. `AI stalled: 0.0%` was
  //    true for months because 38wu did not clear a 15wu threshold.
  t('a metric that moves BELOW its own reporting precision fails MOVES',
    !moves({ name: 'x', metric: (x) => 0.5 + x * 1e-9, a: 1, b: 2, minDelta: 1e-4 }).ok, 'refused');

  t('a working metric PASSES MOVES',
    moves({ name: 'x', metric: (x) => x * 2, a: 1, b: 2, minDelta: 0.5 }).ok, 'accepted');

  console.log('\n── HOLDS, against instruments that respond to the HARNESS ──\n');

  // 4. The PREVIEW_BASE shape: the answer depends on something OUTSIDE the subject, so
  //    the SAME subject reads differently when the harness moves under it. `arena-scan`
  //    ignored PREVIEW_BASE and measured whatever was on port 5187 while its caller had
  //    just frozen a snapshot on another port (f73925e).
  const HARNESS = [5187, 5173];   // the shared dev server, then the frozen snapshot
  let visit = 0;
  const readsHarness = () => HARNESS[visit++ % HARNESS.length];
  t('a metric reading the HARNESS (the PREVIEW_BASE shape) fails HOLDS',
    !holds({ name: 'x', metric: readsHarness, a: { tree: 'X' }, b: { tree: 'X' }, maxDelta: 0 }).ok,
    'refused');

  // 5. The countdown re-seeding shape: an irrelevant parameter moves the answer.
  const reseeds = (o) => ((o.countdownMs * 2654435761) % 1000) / 1000;
  t('a metric that RE-SEEDS off an irrelevant parameter fails HOLDS',
    !holds({
      name: 'x', metric: reseeds,
      a: { seed: 7, countdownMs: 3000 }, b: { seed: 7, countdownMs: 3010 }, maxDelta: 1e-6,
    }).ok, 'refused');

  t('a metric blind to the irrelevant parameter PASSES HOLDS',
    holds({
      name: 'x', metric: (o) => o.seed, a: { seed: 7, countdownMs: 3000 },
      b: { seed: 7, countdownMs: 3010 }, maxDelta: 0,
    }).ok, 'accepted');

  console.log('\n── ORDERS, against instruments with the WRONG SIGN ──\n');

  // 6. The §13 inverted harness, as a pure function.
  t('a SIGN-FLIPPED metric fails ORDERS (the §13 inverted harness)',
    !orders({ name: 'x', metric: (x) => -x, lower: 1, higher: 9, minGap: 1 }).ok, 'refused');

  // 7. The "square reported as rounder than a circle" shape: a metric that ranks two
  //    known inputs backwards. Same failure, different subject.
  const roundness = (shape) => (shape === 'circle' ? 0.4 : 0.9);   // BACKWARDS on purpose
  t('a harness ranking a SQUARE rounder than a CIRCLE fails ORDERS',
    !orders({ name: 'x', metric: roundness, lower: 'square', higher: 'circle', minGap: 0.1 }).ok, 'refused');

  t('a correctly-ordered metric PASSES ORDERS',
    orders({ name: 'x', metric: (x) => x, lower: 1, higher: 9, minGap: 1 }).ok, 'accepted');

  console.log('\n── SELF-PAIR, the negative control ──\n');

  // 8. The sqrt(2) noise floor: an instrument that reports a difference between a thing
  //    and ITSELF. Modelled as a metric with an internal counter, which is what a
  //    stateful or RNG-seeded instrument actually is.
  let call = 0;
  const drifts = () => { call += 1; return 0.5 + call * 0.01; };
  t('an instrument that differs from ITSELF fails SELF-PAIR (the sqrt(2) floor)',
    !selfPair({ name: 'x', metric: drifts, a: 1, maxDelta: 0.001 }).ok, 'refused');

  t('a deterministic metric PASSES SELF-PAIR',
    selfPair({ name: 'x', metric: (x) => x * 3, a: 4, maxDelta: 0 }).ok, 'accepted');

  console.log('\n── a THROWN error is a failure, never a pass ──\n');
  t('a metric that throws fails MOVES rather than being skipped',
    !moves({ name: 'x', metric: () => { throw new Error('boom'); }, a: 1, b: 2 }).ok, 'refused');
  t('a metric returning NaN fails MOVES',
    !moves({ name: 'x', metric: () => NaN, a: 1, b: 2 }).ok, 'refused');
  t('a metric returning undefined fails HOLDS rather than comparing undefined to undefined',
    !holds({ name: 'x', metric: () => undefined, a: 1, b: 2, maxDelta: 0 }).ok, 'refused');

  console.log('\n── SELF-PAIR proves DETERMINISM ONLY unless an identity is named ──\n');

  // The gap that was live in this file: `holds({ a, b: a })` compares metric(a) against
  // metric(a), which is zero for any pure function REGARDLESS of what it returns. The row
  // named "figureGround reports ZERO on a figure identical to its ground" asserted no such
  // thing until `identity` existed. Both halves are proved here, because a check that
  // cannot be shown to accept is as untrustworthy as one that cannot be shown to refuse.
  const confidentlyWrong = () => 0.42;
  t('a metric returning 0.42 on a SELF-IDENTICAL input passes SELF-PAIR without an identity',
    selfPair({ name: 'x', metric: confidentlyWrong, a: 1, maxDelta: 1e-9 }).ok,
    'accepted — THIS IS THE GAP, and it is why `identity` is not optional');
  t('...and is REFUSED the moment the identity answer is named',
    !selfPair({ name: 'x', metric: confidentlyWrong, a: 1, maxDelta: 1e-9, identity: 0 }).ok, 'refused');
  t('a metric that DOES return the identity answer still passes',
    selfPair({ name: 'x', metric: () => 0, a: 1, maxDelta: 1e-9, identity: 0 }).ok, 'accepted');

  console.log('\n── VL.adjacency, against MUTANTS OF ITS OWN SOURCE ──\n');

  // The harness's own control, first. A rebuild with NO substitution must reproduce the
  // real VL exactly; if evaluating VL_SRC a second time changed anything, every refusal
  // below would be evidence about the harness rather than about the mutation.
  const rebuilt = mutantVL([]);
  t('mutantVL([]) — an UNMUTATED rebuild — reproduces the real VL.adjacency exactly',
    JSON.stringify(adjPair(ADJ_MIRROR_BRIGHT, rebuilt)) === JSON.stringify(adjPair(ADJ_MIRROR_BRIGHT)),
    'identical pair record');
  t('...and the real VL is left in place, not replaced by the mutant',
    globalThis.VL === VL && adjPair(ADJ_HARD_STEP).dLcontact === 0.40, 'VL intact, dLcontact 0.4');

  // Each mutation is stated with the row it must break. A mutation that breaks EVERY row
  // would prove nothing about which row is load-bearing, so the rows it must NOT break are
  // asserted too — that is the difference between a suite and a tripwire.
  const dLc = (vl) => (f) => adjPair(f, vl).dLcontact;
  const dLw = (vl) => (f) => adjPair(f, vl).dL;
  const cA = (vl) => (f) => adjPair(f, vl).cA;
  const nC = (vl) => (f) => adjPair(f, vl).contacts;

  const ALIAS = mutantVL(MUT_ALIAS);
  t('dLcontact ALIASED to dL fails the MOVES row (mirror: 0.1 vs 0.1)',
    !moves({ name: 'x', metric: dLc(ALIAS), a: ADJ_MIRROR_BRIGHT, b: ADJ_MIRROR_DARK, minDelta: 0.10 }).ok,
    'refused');
  t('dLcontact ALIASED to dL fails the ORDERS row — it INVERTS it (0.4 vs 0.0)',
    !orders({ name: 'x', metric: dLc(ALIAS), lower: ADJ_SEAMLESS, higher: ADJ_HARD_STEP, minGap: 0.30 }).ok,
    'refused');
  t('...and that same mutant is ACCEPTED by the dL pin, which is correct — it never touched dL',
    holds({ name: 'x', metric: dLw(ALIAS), a: ADJ_MIRROR_BRIGHT, b: ADJ_MIRROR_DARK, maxDelta: 1e-9 }).ok,
    'accepted — each row answers for its own quantity');

  const REV = mutantVL(MUT_REVERSE_ALIAS);
  t('dL "FIXED" in place to the contact band fails the dL pin (0.3 vs 0.5)',
    !holds({ name: 'x', metric: dLw(REV), a: ADJ_MIRROR_BRIGHT, b: ADJ_MIRROR_DARK, maxDelta: 1e-9 }).ok,
    'refused');

  const SWAP = mutantVL(MUT_SIDE_SWAP);
  t('the two contact BANDS swapped fails the cA ORDERS row (0.6 vs 0.6)',
    !orders({ name: 'x', metric: cA(SWAP), lower: ADJ_MIRROR_DARK, higher: ADJ_MIRROR_BRIGHT, minGap: 0.50 }).ok,
    'refused');
  t('...and is INVISIBLE to dLcontact, which is exactly why the cA row has to exist',
    orders({ name: 'x', metric: dLc(SWAP), lower: ADJ_SEAMLESS, higher: ADJ_HARD_STEP, minGap: 0.30 }).ok,
    'accepted — |cA-cB| is an ABSOLUTE difference and cannot see a swap');

  const OFF = mutantVL(MUT_OFFSET);
  t('a CONSTANT 0.42 OFFSET in dLcontact fails the SELF-PAIR row',
    !selfPair({ name: 'x', metric: dLc(OFF), a: ADJ_FLAT, maxDelta: 1e-9, identity: 0 }).ok, 'refused');
  t('...and would have PASSED it without the identity — the gap, on a real mutant',
    selfPair({ name: 'x', metric: dLc(OFF), a: ADJ_FLAT, maxDelta: 1e-9 }).ok,
    'accepted: 0.42 vs 0.42 is a difference of zero');

  const GATED = mutantVL(MUT_LUMA_GATED_CONTACTS);
  t('LUMA-GATED contacts fails the contacts row (the flat pair vanishes entirely)',
    !holds({ name: 'x', metric: nC(GATED), a: ADJ_FLAT, b: ADJ_HARD_STEP, maxDelta: 0 }).ok, 'refused');

  t('a vanished mutation ANCHOR throws rather than silently skipping the mutation',
    (() => { try { mutantVL([['this text is not in VL_SRC', 'x']]); return false; } catch { return true; } })(),
    'refused');

  console.log('\n── the CLONE census, on a synthetic pair ──\n');
  const base = Array.from({ length: 400 }, (_, i) => `const someIdentifier${i} = compute(${i}, 'x');`);
  const copy = base.slice();
  copy[10] = "const someIdentifier10 = compute(10, 'y');";
  const simHigh = similarity(lineSet(base.join('\n')), lineSet(copy.join('\n')));
  const simLow = similarity(lineSet(base.join('\n')),
    lineSet(Array.from({ length: 400 }, (_, i) => `let other${i} = different(${i});`).join('\n')));
  t('a 400-line file with ONE line changed reads as a clone',
    simHigh >= CLONE_MIN_SIMILARITY, `similarity ${simHigh.toFixed(4)} >= ${CLONE_MIN_SIMILARITY}`);
  t('two unrelated 400-line files do NOT read as a clone',
    simLow < CLONE_MIN_SIMILARITY, `similarity ${simLow.toFixed(4)} < ${CLONE_MIN_SIMILARITY}`);

  console.log(`\n${pass}/${pass + fail} sentinel checks passed`);
  return fail ? 1 : 0;
}

// ─────────────────────────────────────────────────────────────────────────────

async function main() {
  if (process.argv.includes('--selftest')) process.exit(selftest());

  let failed = 0;
  if (!process.argv.includes('--clones')) {
    console.log('── SENTINELS: does the instrument respond to what it claims to measure? ──\n');
    const rows = await registry();
    for (const r of rows) {
      if (!r.ok) failed++;
      console.log(`${r.ok ? 'PASS' : 'FAIL'}  ${r.kind.padEnd(9)} ${r.name}`);
      console.log(`      ${r.detail}`);
      if (!r.ok) console.log(`      WHY IT MATTERS: ${r.why}`);
    }
    console.log(`\n${rows.length - failed}/${rows.length} sentinels passed`);
  }

  if (!process.argv.includes('--sentinels')) {
    console.log('\n── CLONE CENSUS: an instrument duplicated is an instrument that drifts ──\n');
    const pairs = await cloneCensus();
    let cloneFail = 0;
    for (const p of pairs) {
      const reg = CLONES[p.key];
      if (!reg) {
        cloneFail++;
        console.log(`FAIL  UNREGISTERED CLONE  ${p.key}`);
        console.log(`      ${(p.sim * 100).toFixed(1)}% identical, ${p.diverged} lines diverged.`);
        console.log('      Either delete the copy and parameterise the original, or register it in'
          + ' CLONES with a divergence budget and the reason.');
        continue;
      }
      if (p.diverged > reg.budget) {
        cloneFail++;
        console.log(`FAIL  DRIFTED  ${p.key}`);
        console.log(`      ${p.diverged} lines diverged, budget ${reg.budget}. A fix has landed in one`
          + ' copy and not the other — which is exactly how ten tools ended up carrying one stale driver.');
        continue;
      }
      console.log(`PASS  registered  ${p.key}  (${(p.sim * 100).toFixed(1)}% identical, ${p.diverged}/${reg.budget} lines diverged)`);
    }
    for (const key of Object.keys(CLONES)) {
      if (!pairs.some((p) => p.key === key)) {
        console.log(`note  registered pair no longer a clone (or renamed): ${key}`);
      }
    }
    if (!pairs.length) console.log('no file pairs over the clone threshold');
    console.log(`\n${pairs.length - cloneFail}/${pairs.length} clone pairs accounted for`);
    failed += cloneFail;
  }

  process.exit(failed ? 1 : 0);
}

if (process.argv[1] && import.meta.url === pathToFileURL(process.argv[1]).href) await main();
