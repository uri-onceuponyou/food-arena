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
 * Usage:
 *   node tools/tmp/sentinel.mjs              # run the registry + the clone census
 *   node tools/tmp/sentinel.mjs --selftest   # prove the three assertions on known-bad input
 *   node tools/tmp/sentinel.mjs --clones     # census only
 */

import { readdir, readFile } from 'node:fs/promises';
import { join, relative, resolve } from 'node:path';
import { createHash } from 'node:crypto';
import { pathToFileURL } from 'node:url';
import sharp from 'sharp';

import { VL } from './valuelib.mjs';
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
 */
export function selfPair({ name, metric, a, maxDelta = 0, why }) {
  const r = holds({ name, metric, a, b: a, maxDelta, why });
  return { ...r, kind: 'SELF-PAIR' };
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
