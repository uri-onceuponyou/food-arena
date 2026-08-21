#!/usr/bin/env node
/**
 * SPECTATOR CAMERA — the subject ladder, driven at SIX SEATS, headless.
 *
 *   node tools/tmp/sv_subject.mjs
 *
 * ── WHAT IT GUARDS ─────────────────────────────────────────────────────────────
 *
 * Uri, after a six-player match: *"when i played 6 players and lost, i continued to move
 * as dead, able to fire and move."* `7a32f3d` fixed the input half in `sim.ts` — a dead
 * fighter now `continue`s before the controller branch — and froze the corpse's position
 * doing it. `match.ts` followed `groundPos(observer.x, observer.y)` with `observer` hard-
 * wired to the local seat, so the fix turned "you play on as a corpse" into "you WATCH
 * your corpse", for up to `MATCH_DURATION_MS` = 150 000 ms. `sim.ts:671-675` wrote that
 * down at the site of its own fix and routed it out of the file.
 *
 * The policy that replaced it is `render/camera.ts:resolveViewSubject` — pure, no `three`,
 * no DOM, no clock — and this file is the battery that says it is right.
 *
 * ── 🚨 WHY EVERY ARM IS AT SIX SEATS ───────────────────────────────────────────
 *
 * At `MAX_FIGHTERS` 2 there is exactly ONE other fighter, so once the local seat is dead
 * "your killer", "the nearest living fighter", "the lowest living index" and "the only one
 * left" all name slot 1. **Every selection policy, right or wrong, returns the same answer
 * at two seats.** A two-seat battery for this feature is green by construction — the
 * `[].every()` shape wearing a different hat. Arm C does not assert that, it RUNS it: the
 * same known-bads are replayed at N=2 and at N=6 and the caught/missed table is printed.
 *
 * This repo has been bitten by the two-seat-vacuity class five times (the result card,
 * corpse input, shake proximity, seat order, melee against a single target), which is
 * why the control is an arm rather than a sentence in a commit message.
 *
 * ── THE ARMS ───────────────────────────────────────────────────────────────────
 *
 *   A  THE LADDER — a scripted six-seat elimination, one expectation per step, on both
 *      the SLOT and the RUNG that produced it. Asserting only the slot would let a lucky
 *      nearest-living pick pass for a correct killer hand-off; at six seats they often
 *      name the same fighter, which is exactly why `MatchDebug.viewReason` exists.
 *      ⚠️ Non-vacuity is asserted FIRST: every one of the five rungs must be exercised,
 *      both cut and glide must occur, and at least one step must be one where the killer
 *      rule and the nearest rule DISAGREE — otherwise "the table passed" says nothing
 *      about which rule produced it.
 *
 *   B  KNOWN-BADS — five alternative policies replayed through arm A's own table, which
 *      must go RED for each. KB1 is not a caricature: it is `() => LOCAL_SLOT`, the code
 *      that actually shipped and that Uri hit.
 *
 *   C  THE N=2 VACUITY CONTROL — the same known-bads at two seats. Prints CAUGHT/MISSED
 *      per policy per seat count. The arm FAILS unless at least one known-bad is MISSED at
 *      N=2 and CAUGHT at N=6, because that is the claim being made.
 *
 *   D  CUT vs GLIDE — the transition rule, against the rig's OWN
 *      `shakeFadeRadiusUnits()`, measured here rather than typed. Known-bads: a threshold
 *      of Infinity (always glide) and of 0 (always cut).
 *
 *   E  CHAIN ROBUSTNESS — a killer cycle (reachable: a projectile already in the air when
 *      its owner dies still lands), a killer index out of range, and a self-kill. The
 *      cycle's known-bad is a chain walk with the `seen` set removed, run under a step cap
 *      so a non-terminating policy reports SPUN instead of hanging this process.
 *
 *   F  THE DWELL LITERAL — `match.ts`'s `SPECTATE_DWELL_MS` against the `life:` argument
 *      of `vfx.ts:spawnDeathBurst`, read out of the real files. The dwell is a COPY of a
 *      number that has no export to import; this is what stops the copy going stale
 *      silently. Known-bad: the same comparison against a perturbed literal.
 *
 *   G  NO-STRAND, EXHAUSTIVE — all 64 alive-masks x 6 current subjects. Whenever ANY
 *      fighter is alive the resolved subject must BE alive. A hand-off rule that can
 *      strand the camera is the original defect with extra steps. Enumerated, not sampled:
 *      64 x 6 = 384 cases, of which 378 have someone alive, and the arm asserts that count
 *      before it asserts anything about the answers.
 *
 *   H  A LIVING PLAYER IS UNTOUCHED — over every mask where the local seat is alive, the
 *      subject must be `LOCAL_SLOT` and the transition must be a glide. This is the
 *      property that makes the change safe to ship: the shipped camera is not "close
 *      enough", it is the same argument to the same `follow()` call.
 *
 * ⚠️ `--selftest` VALIDATES THIS FILE'S LOGIC, NEVER WHERE IT IS POINTED. Arms F and D
 * read the real `src/` files and the real `CameraRig`; that is what points them.
 */

import { readFileSync } from 'node:fs';
import { fileURLToPath } from 'node:url';
import { dirname, join } from 'node:path';
import { CameraRig, resolveViewSubject } from '../../src/render/camera.ts';

const HERE = dirname(fileURLToPath(import.meta.url));
const REPO = join(HERE, '..', '..');
const SELFTEST = process.argv.includes('--selftest');

let pass = 0;
let fail = 0;
const check = (name, ok, detail = '') => {
  if (ok) { pass++; console.log(`  ok   - ${name}${detail ? ` · ${detail}` : ''}`); }
  else { fail++; console.log(`  FAIL - ${name}${detail ? ` · ${detail}` : ''}`); }
  return ok;
};
const section = (t) => console.log(`\n── ${t} ${'─'.repeat(Math.max(0, 74 - t.length))}`);

// ─────────────────────────────────────────────────────────────────────────────
// THE THRESHOLD, MEASURED FROM THE SHIPPED RIG
// ─────────────────────────────────────────────────────────────────────────────
// Not a constant in this file. `match.ts` passes `rig.shakeFadeRadiusUnits()` and so does
// this battery, so the day pitch / fov / the fair radius move, both move together and the
// table below is still describing the shipped camera.
const matchRig = new CameraRig({ frameMode: 'fair', pitchDeg: 58 });
const FADE = matchRig.shakeFadeRadiusUnits();

// ─────────────────────────────────────────────────────────────────────────────
// THE SIX-SEAT FIXTURE
// ─────────────────────────────────────────────────────────────────────────────
// Positions are chosen so that the killer rule and the nearest rule DISAGREE on real
// steps — that disagreement is the whole reason six seats can test this and two cannot,
// and arm A refuses to pass unless it actually happened.
const POS6 = [
  { x: 1400, y: 1000 },   // 0  local — arena centre
  { x: 1500, y: 1000 },   // 1  100 wu east: a close killer, inside the glide radius
  { x: 2400, y: 1000 },   // 2  1000 wu east: a far killer, a cut
  { x: 1400, y: 1900 },   // 3  900 wu south
  { x: 1000, y: 1000 },   // 4  400 wu west
  { x: 1450, y: 1050 },   // 5  ~70 wu: always the nearest to the centre
];
const seats6 = (aliveMask, pos = POS6) =>
  pos.map((p, i) => ({ alive: (aliveMask & (1 << i)) !== 0, x: p.x, y: p.y }));

const ALL6 = 0b111111;

/** The shipped rule, wrapped so a known-bad can be swapped in at the same call shape. */
const REAL = (input) => resolveViewSubject(input);

// ── the alternative policies, i.e. the known-bad inputs ──────────────────────
const KB = {
  // 🚨 NOT A CARICATURE. This is the code that shipped, and the defect Uri hit.
  'KB1 pinned to the local seat (the SHIPPED bug)': (input) =>
    ({ slot: input.localSlot, reason: 'local', cut: false }),

  'KB2 nearest living only (no killer rung)': (input) => {
    const { seats, localSlot, current, cameraX, cameraY, cutBeyondUnits } = input;
    if (seats[localSlot]?.alive) return mk(seats, localSlot, current, 'local', cutBeyondUnits, cameraX, cameraY);
    if (seats[current]?.alive) return mk(seats, current, current, 'hold', cutBeyondUnits, cameraX, cameraY);
    const n = nearest(seats, cameraX, cameraY);
    return n < 0
      ? mk(seats, current, current, 'stranded', cutBeyondUnits, cameraX, cameraY)
      : mk(seats, n, current, 'nearest', cutBeyondUnits, cameraX, cameraY);
  },

  'KB3 lowest living index': (input) => {
    const { seats, localSlot, current, cameraX, cameraY, cutBeyondUnits } = input;
    if (seats[localSlot]?.alive) return mk(seats, localSlot, current, 'local', cutBeyondUnits, cameraX, cameraY);
    if (seats[current]?.alive) return mk(seats, current, current, 'hold', cutBeyondUnits, cameraX, cameraY);
    const i = seats.findIndex((s) => s.alive);
    return i < 0
      ? mk(seats, current, current, 'stranded', cutBeyondUnits, cameraX, cameraY)
      : mk(seats, i, current, 'nearest', cutBeyondUnits, cameraX, cameraY);
  },

  // The camera hops between two fighters running past each other. Worse than the defect.
  'KB4 no stickiness (re-pick nearest every frame)': (input) => {
    const { seats, localSlot, current, cameraX, cameraY, cutBeyondUnits } = input;
    if (seats[localSlot]?.alive) return mk(seats, localSlot, current, 'local', cutBeyondUnits, cameraX, cameraY);
    const n = nearest(seats, cameraX, cameraY);
    return n < 0
      ? mk(seats, current, current, 'stranded', cutBeyondUnits, cameraX, cameraY)
      : mk(seats, n, current, n === current ? 'hold' : 'nearest', cutBeyondUnits, cameraX, cameraY);
  },

  // The original defect wearing a hand-off's clothes: strand back to the corpse.
  'KB5 strand to the local seat': (input) => {
    const r = resolveViewSubject(input);
    return r.reason === 'stranded'
      ? mk(input.seats, input.localSlot, input.current, 'stranded', input.cutBeyondUnits, input.cameraX, input.cameraY)
      : r;
  },
};

function nearest(seats, cx, cy) {
  let best = -1; let bd = Infinity;
  for (let i = 0; i < seats.length; i++) {
    if (!seats[i].alive) continue;
    const d = Math.hypot(seats[i].x - cx, seats[i].y - cy);
    if (d < bd) { bd = d; best = i; }
  }
  return best;
}
function mk(seats, slot, current, reason, cutBeyond, cx, cy) {
  const s = seats[slot];
  const cut = slot !== current && s !== undefined && Math.hypot(s.x - cx, s.y - cy) > cutBeyond;
  return { slot, reason, cut };
}

// ─────────────────────────────────────────────────────────────────────────────
// THE LADDER SCRIPT
// ─────────────────────────────────────────────────────────────────────────────
// `camera` is where the rig's look-at has got to when the step is evaluated — the
// PREVIOUS subject's position for a settled camera, which is what `targetUnits()` returns
// in the shipped loop.
const LADDER = [
  {
    what: 'everyone alive — the shipped camera, untouched',
    alive: ALL6, current: 0, killedBy: [], camera: POS6[0],
    want: { slot: 0, reason: 'local', cut: false },
  },
  {
    what: 'local dies to slot 1 — hand off to the KILLER, 100 wu away, a glide',
    alive: ALL6 & ~1, current: 0, killedBy: [1], camera: POS6[0],
    want: { slot: 1, reason: 'killer', cut: false },
  },
  {
    what: 'nothing changes — STICKINESS holds the subject',
    alive: ALL6 & ~1, current: 1, killedBy: [1], camera: POS6[1],
    want: { slot: 1, reason: 'hold', cut: false },
  },
  {
    what: 'slot 1 dies to slot 2 — chain to the KILLER 900 wu away, a CUT (nearest would say 5)',
    alive: ALL6 & ~1 & ~2, current: 1, killedBy: [1, 2], camera: POS6[1],
    want: { slot: 2, reason: 'killer', cut: true }, discriminates: true,
  },
  {
    what: 'slot 2 dies to FOG (no killer) — fall through to NEAREST LIVING',
    alive: ALL6 & ~1 & ~2 & ~4, current: 2, killedBy: [1, 2, null], camera: POS6[2],
    want: { slot: 5, reason: 'nearest', cut: true },
  },
  {
    what: 'slot 5 dies to slot 3 — KILLER again, and nearest would say 4',
    alive: (ALL6 & ~1 & ~2 & ~4) & ~(1 << 5), current: 5, killedBy: [1, 2, null, null, null, 3],
    camera: POS6[5],
    want: { slot: 3, reason: 'killer', cut: true }, discriminates: true,
  },
  {
    what: 'slot 3 dies to a HAZARD — nearest living, and only slot 4 is left',
    alive: 1 << 4, current: 3, killedBy: [1, 2, null, null, null, 3], camera: POS6[3],
    want: { slot: 4, reason: 'nearest', cut: true },
  },
  {
    what: 'the ring takes the last one — NOBODY is alive, so HOLD, never re-pin to the corpse',
    alive: 0, current: 4, killedBy: [1, 2, null, null, null, 3], camera: POS6[4],
    want: { slot: 4, reason: 'stranded', cut: false },
  },
];

function runLadder(policy, script = LADDER, pos = POS6) {
  return script.map((step) => policy({
    seats: seats6(step.alive, pos),
    localSlot: 0,
    current: step.current,
    killedBy: step.killedBy,
    cameraX: step.camera.x,
    cameraY: step.camera.y,
    cutBeyondUnits: FADE,
  }));
}

// ═════════════════════════════════════════════════════════════════════════════
console.log(`sv_subject — the spectator subject ladder at SIX seats`);
console.log(`  cut threshold = CameraRig.shakeFadeRadiusUnits() = ${FADE.toFixed(2)} wu (measured, pitch 58 / fair)`);

// ── ARM A ────────────────────────────────────────────────────────────────────
section('A  THE LADDER, six seats');

const got = runLadder(REAL);

// 🚨 NON-VACUITY FIRST — before a single expectation is compared. A table that never
// reaches a rung cannot fail on it, and `[].every()` is `true`.
{
  const rungs = new Set(LADDER.map((s) => s.want.reason));
  check('A0a every rung of the ladder is exercised',
    ['local', 'hold', 'killer', 'nearest', 'stranded'].every((r) => rungs.has(r)),
    `saw {${[...rungs].sort().join(', ')}}`);
  check('A0b both a CUT and a GLIDE occur in the script',
    LADDER.some((s) => s.want.cut) && LADDER.some((s) => !s.want.cut),
    `${LADDER.filter((s) => s.want.cut).length} cut / ${LADDER.filter((s) => !s.want.cut).length} glide`);

  // The step that makes six seats different from two: the killer rule and the nearest
  // rule name DIFFERENT fighters. Without at least one of these the whole battery could
  // be satisfied by a nearest-only policy.
  const disc = LADDER.filter((s, i) => {
    if (!s.discriminates) return false;
    const seats = seats6(s.alive);
    return nearest(seats, s.camera.x, s.camera.y) !== s.want.slot;
  });
  check('A0c at least one step where KILLER and NEAREST disagree',
    disc.length > 0, `${disc.length} such step(s)`);
  check('A0d the script is non-empty and the local seat really dies',
    LADDER.length > 1 && LADDER.some((s) => (s.alive & 1) === 0), `${LADDER.length} steps`);
}

LADDER.forEach((step, i) => {
  const g = got[i];
  const ok = g.slot === step.want.slot && g.reason === step.want.reason && g.cut === step.want.cut;
  check(`A${i + 1} ${step.what}`, ok,
    `want slot ${step.want.slot}/${step.want.reason}/${step.want.cut ? 'cut' : 'glide'} · ` +
    `got slot ${g.slot}/${g.reason}/${g.cut ? 'cut' : 'glide'}`);
});

// ── ARM B ────────────────────────────────────────────────────────────────────
section('B  KNOWN-BADS — arm A must go RED for every one');

/** How many steps of the ladder a policy gets WRONG. */
function faultsOf(policy, script = LADDER, pos = POS6) {
  const r = runLadder(policy, script, pos);
  let n = 0;
  script.forEach((step, i) => {
    if (r[i].slot !== step.want.slot || r[i].reason !== step.want.reason || r[i].cut !== step.want.cut) n++;
  });
  return n;
}

const kbAt6 = {};
for (const [name, policy] of Object.entries(KB)) {
  const n = faultsOf(policy);
  kbAt6[name] = n;
  check(`B  ${name}`, n > 0, `${n}/${LADDER.length} steps RED`);
}
check('B0 the real policy is GREEN on the same table', faultsOf(REAL) === 0,
  `${faultsOf(REAL)}/${LADDER.length} steps RED`);

// ── ARM C ────────────────────────────────────────────────────────────────────
section('C  THE N=2 VACUITY CONTROL — the same known-bads at TWO seats');

// 🚨 THE COMPARISON THAT MATTERS IS **SLOT ONLY**, AND THE FIRST VERSION OF THIS ARM GOT
// THAT WRONG — it compared `{slot, reason, cut}` and reported four of five known-bads
// CAUGHT at two seats, which made the vacuity claim look false. They were caught on
// `reason`: a field this battery invented and published on `MatchDebug` so that a probe
// could tell a killer hand-off from a lucky nearest one. **Nobody playing the game can see
// `reason`.** What a player sees, what a screenshot shows and what the defect was ever
// about is WHICH FIGHTER THE CAMERA IS POINTED AT — the slot. So the control is run on the
// slot alone, and the reason-aware numbers are printed beside it so the difference between
// "this instrument can tell them apart" and "the product can" is on the page rather than
// in a commit message.
const POS2 = [{ x: 1400, y: 1000 }, { x: 1500, y: 1000 }];
const seats2 = (mask) => POS2.map((p, i) => ({ alive: (mask & (1 << i)) !== 0, x: p.x, y: p.y }));
const LADDER2 = [
  { what: 'both alive', alive: 0b11, current: 0, killedBy: [], camera: POS2[0], want: { slot: 0, reason: 'local', cut: false } },
  { what: 'local dies to slot 1', alive: 0b10, current: 0, killedBy: [1], camera: POS2[0], want: { slot: 1, reason: 'killer', cut: false } },
  { what: 'nothing changes', alive: 0b10, current: 1, killedBy: [1], camera: POS2[1], want: { slot: 1, reason: 'hold', cut: false } },
  // ⚠️ INCLUDED DELIBERATELY, AND IT COSTS THIS ARM ITS EASIEST RESULT. The ring collapses
  // to zero at two seats as readily as at six, so a fair two-seat script MUST contain the
  // nobody-alive step — leaving it out would have manufactured a MISSED for KB5 that the
  // seat count had nothing to do with.
  { what: 'the ring takes slot 1 too — nobody alive', alive: 0b00, current: 1, killedBy: [1, null], camera: POS2[1], want: { slot: 1, reason: 'stranded', cut: false } },
];
function runLadder2(policy) {
  return LADDER2.map((step) => policy({
    seats: seats2(step.alive), localSlot: 0, current: step.current, killedBy: step.killedBy,
    cameraX: step.camera.x, cameraY: step.camera.y, cutBeyondUnits: FADE,
  }));
}
/** `full` compares slot+reason+cut; otherwise SLOT ONLY — what a player can see. */
function faultsN(policy, script, runner, full) {
  const r = runner(policy);
  let n = 0;
  script.forEach((step, i) => {
    const bad = full
      ? (r[i].slot !== step.want.slot || r[i].reason !== step.want.reason || r[i].cut !== step.want.cut)
      : (r[i].slot !== step.want.slot);
    if (bad) n++;
  });
  return n;
}
const faults2 = (p, full = true) => faultsN(p, LADDER2, runLadder2, full);
const faults6 = (p, full = true) => faultsN(p, LADDER, (q) => runLadder(q), full);

// Non-vacuity of the CONTROL ITSELF: a two-seat script that never kills the local seat
// would trivially agree with everything.
check('C0a the two-seat script is non-empty, kills the local seat, and reaches the empty arena',
  LADDER2.length > 1 && LADDER2.some((s) => (s.alive & 1) === 0) && LADDER2.some((s) => s.alive === 0),
  `${LADDER2.length} steps`);
check('C0b the real policy is GREEN at two seats too, on both comparisons',
  faults2(REAL, true) === 0 && faults2(REAL, false) === 0);

let missedAt2CaughtAt6 = 0;
console.log('    policy                                                 SLOT ONLY (what a player sees)   with reason+cut');
console.log('                                                              N=2        N=6              N=2        N=6');
for (const [name, policy] of Object.entries(KB)) {
  const s2 = faults2(policy, false);
  const s6 = faults6(policy, false);
  const f2 = faults2(policy, true);
  const f6 = faults6(policy, true);
  const v = (n) => (n > 0 ? `CAUGHT(${n})` : 'MISSED   ');
  if (s2 === 0 && s6 > 0) missedAt2CaughtAt6++;
  console.log(`    ${name.padEnd(52)}  ${v(s2)}  ${v(s6)}       ${v(f2)}  ${v(f6)}`);
}
check('C1 on the OBSERVABLE, at least one known-bad is INVISIBLE at N=2 and RED at N=6',
  missedAt2CaughtAt6 > 0,
  `${missedAt2CaughtAt6} of ${Object.keys(KB).length} policies — a two-seat battery would have shipped them`);
check('C2 the SHIPPED bug (KB1) is visible at BOTH seat counts, and saying so is the point',
  faults2(KB['KB1 pinned to the local seat (the SHIPPED bug)'], false) > 0
  && faults6(KB['KB1 pinned to the local seat (the SHIPPED bug)'], false) > 0,
  'the PINNING is a two-seat defect; the POLICY that replaces it is not a two-seat question');

// ── ARM D ────────────────────────────────────────────────────────────────────
section('D  CUT vs GLIDE, against the rig\'s own fade radius');

const cutCase = (dist, threshold) => {
  const seats = [
    { alive: false, x: 0, y: 0 },
    { alive: true, x: dist, y: 0 },
  ];
  return resolveViewSubject({
    seats, localSlot: 0, current: 0, killedBy: [1],
    cameraX: 0, cameraY: 0, cutBeyondUnits: threshold,
  });
};
check('D1 a hand-off just INSIDE the fade radius glides',
  cutCase(FADE - 1, FADE).cut === false, `${(FADE - 1).toFixed(2)} wu vs ${FADE.toFixed(2)}`);
check('D2 a hand-off just OUTSIDE it cuts',
  cutCase(FADE + 1, FADE).cut === true, `${(FADE + 1).toFixed(2)} wu vs ${FADE.toFixed(2)}`);
check('D3 a subject that did NOT change never cuts',
  resolveViewSubject({
    seats: [{ alive: false, x: 0, y: 0 }, { alive: true, x: 9999, y: 0 }],
    localSlot: 0, current: 1, killedBy: [], cameraX: 0, cameraY: 0, cutBeyondUnits: FADE,
  }).cut === false, 'current is alive and 9999 wu away — hold, not cut');
// KNOWN-BADS for D: the two degenerate thresholds.
check('D-KB1 threshold Infinity (always glide) FAILS D2',
  cutCase(FADE + 1, Infinity).cut === false);
check('D-KB2 threshold 0 (always cut) FAILS D1',
  cutCase(FADE - 1, 0).cut === true);

// ── ARM E ────────────────────────────────────────────────────────────────────
section('E  CHAIN ROBUSTNESS');

// A killed B and B killed A — reachable, because a projectile already in the air when its
// owner dies still lands. Both dead, a third seat alive.
{
  const seats = [
    { alive: false, x: 0, y: 0 },
    { alive: false, x: 10, y: 0 },
    { alive: true, x: 500, y: 0 },
  ];
  const t0 = Date.now();
  const r = resolveViewSubject({
    seats, localSlot: 0, current: 0, killedBy: [1, 0, null],
    cameraX: 0, cameraY: 0, cutBeyondUnits: FADE,
  });
  const ms = Date.now() - t0;
  check('E1 a killer CYCLE terminates and falls through to nearest living',
    r.slot === 2 && r.reason === 'nearest' && ms < 250, `slot ${r.slot}/${r.reason} in ${ms} ms`);

  // KNOWN-BAD: the same walk with the `seen` set removed, under a step cap so a
  // non-terminating policy reports SPUN rather than hanging this process.
  let node = 0; let steps = 0; let spun = false;
  const kb = [1, 0, null];
  for (;;) {
    const k = kb[node];
    if (k === null || k === undefined) break;
    if (seats[k].alive) break;
    node = k;
    if (++steps > 10_000) { spun = true; break; }
  }
  check('E1-KB the same walk WITHOUT the `seen` set spins forever', spun,
    spun ? 'capped at 10 000 steps' : 'it terminated — the cycle guard is not load-bearing here');
}

check('E2 a killer index out of range is ignored, not indexed',
  (() => {
    const r = resolveViewSubject({
      seats: [{ alive: false, x: 0, y: 0 }, { alive: true, x: 40, y: 0 }],
      localSlot: 0, current: 0, killedBy: [99], cameraX: 0, cameraY: 0, cutBeyondUnits: FADE,
    });
    return r.slot === 1 && r.reason === 'nearest';
  })(), 'killedBy[0] = 99 with 2 seats');

check('E3 a SELF-kill (your own trail) does not pick the corpse',
  (() => {
    const r = resolveViewSubject({
      seats: [{ alive: false, x: 0, y: 0 }, { alive: true, x: 40, y: 0 }],
      localSlot: 0, current: 0, killedBy: [0], cameraX: 0, cameraY: 0, cutBeyondUnits: FADE,
    });
    return r.slot === 1 && r.reason === 'nearest';
  })());

check('E4 NEAREST is measured from the CAMERA, not from the corpse',
  (() => {
    // Corpse at 0,0; camera has glided to 900,0. Slot 1 is nearer the corpse, slot 2 is
    // nearer the camera. A rule that used the corpse would say 1.
    const seats = [
      { alive: false, x: 0, y: 0 },
      { alive: true, x: 200, y: 0 },
      { alive: true, x: 950, y: 0 },
    ];
    const r = resolveViewSubject({
      seats, localSlot: 0, current: 0, killedBy: [null],
      cameraX: 900, cameraY: 0, cutBeyondUnits: FADE,
    });
    const fromCorpse = nearest(seats, 0, 0);
    // Non-vacuity: the two answers must actually differ, or this proves nothing.
    return r.slot === 2 && fromCorpse === 1;
  })(), 'corpse says slot 1, camera says slot 2');

check('E5 a tie resolves to the LOWEST slot, deterministically',
  (() => {
    const r = resolveViewSubject({
      seats: [
        { alive: false, x: 0, y: 0 },
        { alive: true, x: 100, y: 0 },
        { alive: true, x: -100, y: 0 },
      ],
      localSlot: 0, current: 0, killedBy: [null], cameraX: 0, cameraY: 0, cutBeyondUnits: FADE,
    });
    return r.slot === 1;
  })());

// ── ARM F ────────────────────────────────────────────────────────────────────
section('F  THE DWELL LITERAL — match.ts vs vfx.ts, read from the real files');

const vfxSrc = readFileSync(join(REPO, 'src/game/vfx.ts'), 'utf8');
const matchSrc = readFileSync(join(REPO, 'src/game/match.ts'), 'utf8');
const burstLife = (() => {
  const m = vfxSrc.match(/spawnDeathBurst\([^)]*\)\s*:\s*void\s*\{[\s\S]{0,400}?life:\s*([0-9.]+)/);
  return m ? Number(m[1]) : null;
})();
const dwellMs = (() => {
  const m = matchSrc.match(/SPECTATE_DWELL_MS\s*=\s*([0-9]+)/);
  return m ? Number(m[1]) : null;
})();
check('F0 both literals were actually FOUND (a null read would pass any comparison)',
  burstLife !== null && dwellMs !== null, `vfx life=${burstLife} · dwell=${dwellMs}`);
check('F1 the dwell equals the death burst\'s own lifetime',
  burstLife !== null && dwellMs !== null && Math.round(burstLife * 1000) === dwellMs,
  `${burstLife} s -> ${Math.round((burstLife ?? 0) * 1000)} ms vs SPECTATE_DWELL_MS ${dwellMs}`);
check('F-KB the same comparison against a PERTURBED literal goes red',
  !(Math.round((burstLife ?? 0) * 1000) === (dwellMs ?? 0) + 1));

// ── ARM G ────────────────────────────────────────────────────────────────────
section('G  NO-STRAND, exhaustive over all 64 alive-masks x 6 subjects');

{
  // A killer map with holes in it, so the chain rung and the nearest rung are both
  // reachable across the enumeration.
  const killers = [1, 2, null, 4, null, 0];
  let cases = 0;
  let live = 0;
  let stranded = 0;
  const strandExamples = [];
  for (let mask = 0; mask < 64; mask++) {
    for (let cur = 0; cur < 6; cur++) {
      cases++;
      const seats = seats6(mask);
      const anyAlive = seats.some((s) => s.alive);
      if (!anyAlive) continue;
      live++;
      const r = resolveViewSubject({
        seats, localSlot: 0, current: cur, killedBy: killers,
        cameraX: POS6[cur].x, cameraY: POS6[cur].y, cutBeyondUnits: FADE,
      });
      if (!seats[r.slot]?.alive) {
        stranded++;
        if (strandExamples.length < 3) strandExamples.push(`mask=${mask.toString(2).padStart(6, '0')} cur=${cur} -> ${r.slot}/${r.reason}`);
      }
    }
  }
  // 🚨 THE FILTER IS ASSERTED NON-EMPTY BEFORE THE ASSERTION OVER IT.
  check('G0 the enumeration ran and the filtered set is non-empty',
    cases === 384 && live === 378, `${cases} cases, ${live} with someone alive`);
  check('G1 the subject is ALIVE in every case where anyone is',
    live > 0 && stranded === 0, stranded ? strandExamples.join(' · ') : `${live}/${live} alive`);

  // KNOWN-BAD: KB5, which strands to the local seat, must be caught by G1.
  let kbStranded = 0;
  let kbLive = 0;
  for (let mask = 0; mask < 64; mask++) {
    for (let cur = 0; cur < 6; cur++) {
      const seats = seats6(mask);
      if (!seats.some((s) => s.alive)) continue;
      kbLive++;
      const r = KB['KB5 strand to the local seat']({
        seats, localSlot: 0, current: cur, killedBy: killers,
        cameraX: POS6[cur].x, cameraY: POS6[cur].y, cutBeyondUnits: FADE,
      });
      if (!seats[r.slot]?.alive) kbStranded++;
    }
  }
  // KB5 only diverges on the `stranded` rung, which needs NOBODY alive — and those masks
  // are excluded here by construction. So this arm CANNOT see KB5, and saying so is the
  // point: it is the vacuity trap, caught rather than hidden.
  check('G-KB KB5 is INVISIBLE to G1 by construction, and that is stated not assumed',
    kbStranded === 0 && kbLive === 378,
    'KB5 only differs when nobody is alive, which G1 filters out — arm A step 8 is what catches it');
}

// ── ARM H ────────────────────────────────────────────────────────────────────
section('H  A LIVING LOCAL SEAT IS UNTOUCHED, by construction');

{
  let checked = 0;
  let bad = 0;
  for (let mask = 0; mask < 64; mask++) {
    if ((mask & 1) === 0) continue;          // local must be alive
    for (let cur = 0; cur < 6; cur++) {
      checked++;
      const r = resolveViewSubject({
        seats: seats6(mask), localSlot: 0, current: cur, killedBy: [1, 2, null, 4, null, 0],
        cameraX: 9999, cameraY: 9999, cutBeyondUnits: FADE,
      });
      if (r.slot !== 0 || r.reason !== 'local') bad++;
    }
  }
  check('H0 the filtered set is non-empty', checked === 192, `${checked} cases with the local seat alive`);
  check('H1 the subject is ALWAYS the local seat while it lives', checked > 0 && bad === 0,
    `${checked - bad}/${checked}`);
  // The camera is deliberately parked at 9999,9999 above — absurdly far — so a policy
  // that consulted distance at all while the local seat lives would show up here.
  check('H-KB a "nearest living" policy with no local rung FAILS H1',
    (() => {
      const r = KB['KB4 no stickiness (re-pick nearest every frame)']({
        seats: seats6(0b111111), localSlot: 0, current: 3, killedBy: [],
        cameraX: 9999, cameraY: 9999, cutBeyondUnits: FADE,
      });
      // KB4 keeps its local rung, so use the raw nearest instead — the real known-bad.
      const raw = nearest(seats6(0b111111), 9999, 9999);
      return r.slot === 0 && raw !== 0;
    })(), 'raw nearest-to-camera picks a different seat, so H1 has teeth');
}

// ── SELFTEST ─────────────────────────────────────────────────────────────────
if (SELFTEST) {
  section('S  SELFTEST — this file\'s own comparison logic');
  check('S1 `check` counts a failure', (() => {
    const before = fail;
    const saved = console.log; console.log = () => {};
    check('(suppressed)', false);
    console.log = saved;
    const counted = fail === before + 1;
    fail = before; pass -= 0;
    return counted;
  })());
  check('S2 faultsOf() returns 0 for the real policy and >0 for KB1',
    faultsOf(REAL) === 0 && faultsOf(KB['KB1 pinned to the local seat (the SHIPPED bug)']) > 0);
  check('S3 the fade radius is a real, finite, positive number',
    Number.isFinite(FADE) && FADE > 0, `${FADE.toFixed(2)} wu`);
  check('S4 seats6() actually varies with the mask',
    seats6(0b000001)[0].alive === true && seats6(0b000001)[1].alive === false
    && seats6(0b111110)[0].alive === false);
}

console.log(`\n${pass} passed, ${fail} failed`);
process.exit(fail === 0 ? 0 : 1);
