#!/usr/bin/env node
/**
 * Plain-Node behavioural tests for the economy. No test framework — run directly:
 *
 *   node src/game/economy/economy.test.mjs
 *
 * Same contract as `src/game/sim.test.mjs`: Node's built-in TypeScript type-stripping
 * imports the `.ts` modules with no build step, which is why every file under
 * `src/game/economy/` imports its siblings with an explicit `.ts` extension.
 *
 * ── What is actually being tested, and why it matters ───────────────────────
 * Three things here are not ordinary unit tests and are the reason the module was
 * built this way at all:
 *
 *  1. PACING (sections 9 and 13). The trophy curve and the level ladder are both design
 *     claims — "first character in a sitting", "first upgrade in a sitting", "the road
 *     still finishes even if you spend every coin on levels". They are asserted against a
 *     seeded simulated player, so changing any number in `tuning.ts` reports exactly what
 *     it did instead of quietly moving it. ⚠️ The BOUNDS are in MATCHES; the wall-clock
 *     is printed from `tuning.ts:MATCH_PACING` and is never asserted, because a session
 *     length that lives in another file must not be able to turn a pacing gate red — and
 *     because a hardcoded 2-minute match survived a 4x clock change here undetected.
 *  2. PUBLISHED ODDS (section 5). Once gems are buyable with real money, box drop
 *     rates are a legal disclosure. The empirical distribution of the seeded roller
 *     is checked against `containerOdds()` — the exact string the player is shown —
 *     so the disclosure cannot drift from the table.
 *  3. THE ROSTER CONTRACT (section 4). The set of characters on the trophy road must
 *     be exactly `CHARACTER_IDS` minus the starter. Add a 12th character to
 *     `rules.ts` and this fails until the road has a home for them.
 */

import { CHARACTERS, CHARACTER_IDS, LEVEL_MAX, LEVEL_MIN, RARITY_ORDER } from '../rules.ts';
import {
  CONTAINERS, CONTAINER_KINDS, DUPLICATE_COINS, MATCH_PAYOUT, ROSTER_GATED,
  STARTER_CHARACTER, STARTING_BALANCE, STORE_AVAILABLE, STORE_PRODUCTS, TROPHY_ROAD,
  CHARACTERS_BY_RARITY, ENEMY_LEVEL_MODE, MATCH_PACING, SECONDS_PER_MATCH,
  LEVEL_UP, RARITY_MEANING, ROSTER_COMPLETE_TROPHIES,
} from './tuning.ts';
import { costToMax, enemyLevelFor, levelUpCost, totalLevelCost } from './levels.ts';
import { createRng, weightedIndex } from './rng.ts';
import { containerOdds, containerOddsLine, formatPercent, rollContainer, totalWeight } from './containers.ts';
import {
  claimable, milestoneFace, nextMilestone, resolveReward, roadEnd, roadProgress,
  trophyDelta, trophyLoss,
  placementBanksChestWin, placementCoins, placementCurve, placementRank01,
  placementTrophyDelta, placementWeight01,
} from './trophyRoad.ts';
import { MAX_FIGHTERS, MIN_FIGHTERS } from '../state.ts';
import { describeReward, emptyReward, mergeReward, pluralise } from './reward.ts';
import { bonusPercent, formatPrice, grantProduct, storeAvailable, storeProducts } from './store.ts';
import {
  applyMatchPlacement, applyMatchResult, buyContainer, claimAll, claimMilestone, createEconomy,
  deserialize, grantReward, openContainer, ownedSet, serialize, spend, totalContainers,
  winsToNextChest, adoptLegacyBalance, canLevelUp, characterLevel, coinsSpentOnLevels, levelUp,
  nextLevelPrice, rosterLevelProgress01,
} from './state.ts';

// ─────────────────────────────────────────────────────────────────────────────
// Tiny test harness — identical in shape to sim.test.mjs
// ─────────────────────────────────────────────────────────────────────────────

let pass = 0;
let fail = 0;
const failures = [];

function check(name, condition, detail) {
  if (condition) {
    pass++;
    console.log(`  ok - ${name}`);
  } else {
    fail++;
    failures.push(name);
    console.log(`  FAIL - ${name}${detail ? `\n         ${detail}` : ''}`);
  }
}

const approx = (a, b, eps) => Math.abs(a - b) <= eps;

/** A fixed-seed economy, so every test below is reproducible run to run. */
const seeded = (seed = 12345) => createEconomy(seed);

// ─────────────────────────────────────────────────────────────────────────────
// 1. Seeded RNG determinism
// ─────────────────────────────────────────────────────────────────────────────

console.log('\n1. Seeded RNG');
{
  const a = createRng(1234);
  const b = createRng(1234);
  const seqA = Array.from({ length: 16 }, () => a.next());
  const seqB = Array.from({ length: 16 }, () => b.next());
  check('same seed reproduces the same sequence', seqA.every((v, i) => v === seqB[i]));

  const c = createRng(1235);
  const seqC = Array.from({ length: 16 }, () => c.next());
  check('adjacent seeds do NOT correlate on the first draw',
    Math.abs(seqA[0] - seqC[0]) > 0.02,
    `seed 1234 -> ${seqA[0].toFixed(4)}, seed 1235 -> ${seqC[0].toFixed(4)}`);

  const all = seqA.concat(seqC);
  check('every draw is in [0,1)', all.every((v) => v >= 0 && v < 1));

  // Uniformity: 40k draws in 10 buckets should be within ~5% of 4000 each.
  const r = createRng(99);
  const buckets = new Array(10).fill(0);
  for (let i = 0; i < 40000; i++) buckets[Math.floor(r.next() * 10)]++;
  const worst = Math.max(...buckets.map((n) => Math.abs(n - 4000) / 4000));
  check('40k draws are uniform across 10 buckets to within 5%', worst < 0.05,
    `worst bucket deviation ${(worst * 100).toFixed(2)}%`);

  const r2 = createRng(7);
  const ints = Array.from({ length: 500 }, () => r2.int(5));
  check('int(n) stays in [0,n)', ints.every((v) => v >= 0 && v < 5 && Number.isInteger(v)));
  check('int(0) is 0 rather than NaN', createRng(1).int(0) === 0);
  check('pick() on an empty array is undefined', createRng(1).pick([]) === undefined);

  check('weightedIndex respects weights',
    weightedIndex({ next: () => 0.0 }, [10, 90], 100) === 0
    && weightedIndex({ next: () => 0.5 }, [10, 90], 100) === 1
    && weightedIndex({ next: () => 0.999 }, [10, 90], 100) === 1);
  check('weightedIndex never returns -1 for a non-empty list',
    weightedIndex({ next: () => 1 }, [10, 90], 100) === 1);
}

// ─────────────────────────────────────────────────────────────────────────────
// 2. Trophy arithmetic
// ─────────────────────────────────────────────────────────────────────────────

console.log('\n2. Trophy arithmetic');
{
  check('a win is always worth the same', trophyDelta(0, true) === MATCH_PAYOUT.trophiesWin
    && trophyDelta(9999, true) === MATCH_PAYOUT.trophiesWin);

  check('no trophy loss inside the grace band',
    trophyLoss(0) === 0 && trophyLoss(MATCH_PAYOUT.trophyLossGraceBelow - 1) === 0);

  check('loss starts at the base value the moment grace ends',
    trophyLoss(MATCH_PAYOUT.trophyLossGraceBelow) === MATCH_PAYOUT.trophyLossBase
      + Math.floor(MATCH_PAYOUT.trophyLossGraceBelow / MATCH_PAYOUT.trophyLossPer),
    `loss at ${MATCH_PAYOUT.trophyLossGraceBelow} = ${trophyLoss(MATCH_PAYOUT.trophyLossGraceBelow)}`);

  check('loss scales with standing', trophyLoss(1000) > trophyLoss(200));
  check('loss is capped', trophyLoss(1e6) === MATCH_PAYOUT.trophyLossCap);
  check('loss is never above the cap',
    [0, 99, 100, 300, 900, 1500, 5000, 50000].every((t) => trophyLoss(t) <= MATCH_PAYOUT.trophyLossCap));

  const s = seeded();
  s.trophies = 3;
  applyMatchResult(s, false);
  check('trophies never go negative', s.trophies === 3, `got ${s.trophies}`);

  const s2 = seeded();
  s2.trophies = 500;
  applyMatchResult(s2, false);
  check('a loss above the grace band actually costs trophies', s2.trophies < 500);

  const s3 = seeded();
  for (let i = 0; i < 5; i++) applyMatchResult(s3, true);
  applyMatchResult(s3, false);
  check('bestTrophies is a high-water mark', s3.bestTrophies > s3.trophies
    || s3.trophies === s3.bestTrophies,
    `best ${s3.bestTrophies} vs current ${s3.trophies}`);
  check('bestTrophies survives a loss', s3.bestTrophies === 5 * MATCH_PAYOUT.trophiesWin);
}

// ─────────────────────────────────────────────────────────────────────────────
// 3. Match payout
// ─────────────────────────────────────────────────────────────────────────────

console.log('\n3. Match payout');
{
  const s = seeded();
  const before = s.coins;
  const win = applyMatchResult(s, true);
  check('a win pays the win coin rate', win.coins === MATCH_PAYOUT.coinsWin);
  check('coins are actually credited', s.coins === before + MATCH_PAYOUT.coinsWin);
  check('a win reports its trophy delta', win.trophies === MATCH_PAYOUT.trophiesWin);
  check('a fresh result starts unseen', win.seen === false);

  const s2 = seeded();
  const loss = applyMatchResult(s2, false);
  check('a loss still pays coins', loss.coins === MATCH_PAYOUT.coinsLoss && loss.coins > 0);
  check('winning pays strictly more than losing', MATCH_PAYOUT.coinsWin > MATCH_PAYOUT.coinsLoss);

  const s3 = seeded();
  check('a new player needs the full run of wins for a chest',
    winsToNextChest(s3) === MATCH_PAYOUT.winsPerChest);
  let granted = 0;
  for (let i = 0; i < MATCH_PAYOUT.winsPerChest; i++) granted += applyMatchResult(s3, true).chests;
  check('a chest lands on exactly the Nth win', granted === 1 && s3.containers.chest === 1,
    `granted ${granted}, held ${s3.containers.chest}`);
  check('the chest counter resets', winsToNextChest(s3) === MATCH_PAYOUT.winsPerChest);

  const s4 = seeded();
  for (let i = 0; i < 30; i++) applyMatchResult(s4, false);
  check('losses never grant a chest', s4.containers.chest === 0);

  const s5 = seeded();
  for (let i = 0; i < 12; i++) applyMatchResult(s5, true);
  check('chests accrue at the intended rate over 12 wins',
    s5.containers.chest === Math.floor(12 / MATCH_PAYOUT.winsPerChest),
    `held ${s5.containers.chest}`);
}

// ─────────────────────────────────────────────────────────────────────────────
// 3b. THE 3-TO-6-SEAT PLACEMENT CURVE (`DECISIONS §57`)
// ─────────────────────────────────────────────────────────────────────────────
//
// ── ⚠️ WHAT THIS SECTION EXISTS TO STOP ────────────────────────────────────────
//
// Before it, this file called `applyMatchResult(state, boolean)` **97 times and never once
// with a seat count**, and the words "placement", "seat" and "position" appeared in it zero
// times. The whole placement curve was then written, `applyMatchResult` was rewritten to
// delegate through it, and `LastMatch` grew two fields — and the suite reported **227 passed,
// 0 failed, unchanged**. A green run of the old suite is *necessary and not sufficient*: it
// could not fail on this change, so it was not testing it.
//
// ── THE PROOF THAT MAKES THE CURVE REVERSIBLE, AND WHAT IT HOLDS OVER ────────
//
// The load-bearing claim is that **two seats pay exactly what they paid before**. It is proven
// against a FROZEN ORACLE — `oracleApply` below is the pre-curve body of `applyMatchResult`,
// transcribed from `MATCH_PAYOUT` and `trophyLoss` and importing nothing from the placement
// code — replayed match-for-match over seeded careers and compared as a TRANSCRIPT, not as a
// final balance.
//
//   HOLDS OVER: `trophies`, `bestTrophies`, `coins`, `gems`, every `containers` kind,
//     `claimed`, `unlocked`, `winsTowardChest`, `levels`, `seed`, `rolls`, and the returned
//     payout's `won` / `trophies` / `coins` / `chests` / `seen` — after EVERY match, over
//     8 seeded careers x 500 matches = 4,000 matches, spanning the grace band, the escalating
//     penalty and the loss cap, at win rates 0.0, 0.35, 0.5, 0.6, 0.85 and 1.0.
//   DELIBERATELY EXCLUDES: `LastMatch.place` and `LastMatch.seats`, which did not exist before
//     the change and so cannot be "preserved" — they are checked separately, below. And it
//     says nothing about three or more seats, which is a NEW quantity with no before-value.
//
// ── EVERY ASSERTION BELOW WAS SHOWN TO FAIL ON A NAMED BAD INPUT ─────────────
//
// The specific tautology this domain invites is an assertion that rebuilds the curve from the
// same constants it is checking — it would pass on any curve, including a broken one. So every
// invariant here is written as a PREDICATE OVER A CURVE FUNCTION and then run twice: once on
// the shipped one, and once on a deliberately wrong one that it must reject.

console.log('\n3b. Placement curve, 2-6 seats');
{
  const SEATS = [];
  for (let n = MIN_FIGHTERS; n <= MAX_FIGHTERS; n++) SEATS.push(n);
  // Standings chosen to straddle every regime of `trophyLoss`: inside the grace band, the
  // first trophy above it, mid-road where the penalty is still climbing, and past the cap.
  const STANDINGS = [0, 99, MATCH_PAYOUT.trophyLossGraceBelow, 500, 1500, 50000];

  // ── (a) THE FROZEN ORACLE — the body `applyMatchResult` had before the curve ──
  //
  // Transcribed rather than imported, deliberately. This is the only copy of the old rule left
  // anywhere, and if it is ever deleted the N=2 no-op stops being provable.
  function oracleApply(state, won) {
    const delta = won ? MATCH_PAYOUT.trophiesWin : -trophyLoss(state.trophies);
    state.trophies = Math.max(0, state.trophies + delta);
    state.bestTrophies = Math.max(state.bestTrophies, state.trophies);
    const coins = won ? MATCH_PAYOUT.coinsWin : MATCH_PAYOUT.coinsLoss;
    state.coins += coins;
    let chests = 0;
    if (won) {
      state.winsTowardChest++;
      while (state.winsTowardChest >= MATCH_PAYOUT.winsPerChest) {
        state.winsTowardChest -= MATCH_PAYOUT.winsPerChest;
        chests++;
      }
      state.containers.chest += chests;
    }
    return { won, trophies: delta, coins, chests, seen: false };
  }

  /**
   * Replay one career and return a TRANSCRIPT — one line per match.
   *
   * ⚠️ A transcript, not a final state, and that is the whole design of the check: two payout
   * rules that differ on match 10 and differ back on match 11 leave identical balances. The
   * known-bad `compensating` below is exactly that career, and it exists so nobody can later
   * "simplify" this to a final-balance comparison without a gate going red.
   */
  function replay(applyFn, seed, matches, winRate) {
    const s = createEconomy(seed);
    const rng = createRng(seed);
    const lines = [];
    for (let i = 0; i < matches; i++) {
      const won = rng.next() < winRate;
      const paid = applyFn(s, won, i);
      claimAll(s);
      lines.push([
        s.trophies, s.bestTrophies, s.coins, s.gems, s.winsTowardChest, s.rolls,
        CONTAINER_KINDS.map((k) => s.containers[k]).join('.'),
        s.claimed.join('.'), s.unlocked.join('.'),
        Object.entries(s.levels).sort().map(([k, v]) => `${k}=${v}`).join('.'),
        // Only the five fields that existed before the curve. `place`/`seats` are excluded
        // by policy — see the section header.
        `${paid.won}|${paid.trophies}|${paid.coins}|${paid.chests}|${paid.seen}`,
      ].join(' '));
    }
    return lines.join('\n');
  }

  const ARMS = [
    { seed: 20260811, winRate: 0.60 }, { seed: 4242, winRate: 0.50 },
    { seed: 777, winRate: 0.35 }, { seed: 31337, winRate: 0.85 },
    { seed: 99, winRate: 0.0 }, { seed: 1234, winRate: 1.0 },
    { seed: 8080, winRate: 0.60 }, { seed: 555, winRate: 0.45 },
  ];
  const MATCHES = 500;
  const shipped = ARMS.map((a) => replay((s, won) => applyMatchResult(s, won), a.seed, MATCHES, a.winRate));
  const oracle = ARMS.map((a) => replay((s, won) => oracleApply(s, won), a.seed, MATCHES, a.winRate));

  check(`N=2 is UNCHANGED: ${ARMS.length} careers x ${MATCHES} matches transcribe identically to the pre-curve rule`,
    shipped.every((t, i) => t === oracle[i]),
    shipped.map((t, i) => t === oracle[i] ? null : `arm ${i} (seed ${ARMS[i].seed}, wr ${ARMS[i].winRate}) diverges`)
      .filter(Boolean).join('; '));

  // ⚠️ KNOWN-BAD #1: ONE trophy, on ONE match, in four thousand. If the comparator cannot see
  // this it is measuring nothing. Applied unconditionally on match 313 so it does not depend on
  // which way a coin landed in any particular arm.
  const offByOne = ARMS.map((a) => replay((s, won, i) => {
    const paid = oracleApply(s, won);
    if (i === 313) { s.trophies += 1; s.bestTrophies = Math.max(s.bestTrophies, s.trophies); }
    return paid;
  }, a.seed, MATCHES, a.winRate));
  check('...and the comparator FAILS on a single trophy in 4,000 matches (not a vacuous pass)',
    offByOne.every((t, i) => t !== oracle[i]),
    `${offByOne.filter((t, i) => t === oracle[i]).length} of ${ARMS.length} arms failed to notice`);

  // ⚠️ KNOWN-BAD #2: two errors that cancel. Final balances identical; transcript must differ.
  const compensating = ARMS.map((a) => replay(
    (s, won, i) => {
      const paid = oracleApply(s, won);
      if (i === 100) s.coins += 7;
      if (i === 101) s.coins -= 7;
      return paid;
    }, a.seed, MATCHES, a.winRate));
  const finalCoinsMatch = ARMS.every((a) => {
    const cmp = createEconomy(a.seed); const orc = createEconomy(a.seed);
    const r1 = createRng(a.seed); const r2 = createRng(a.seed);
    for (let i = 0; i < MATCHES; i++) {
      const w1 = r1.next() < a.winRate; oracleApply(cmp, w1);
      if (i === 100) cmp.coins += 7; if (i === 101) cmp.coins -= 7;
      oracleApply(orc, r2.next() < a.winRate);
    }
    return cmp.coins === orc.coins;
  });
  check('...and FAILS on two errors that cancel, which a final-balance check would pass',
    finalCoinsMatch && compensating.every((t, i) => t !== oracle[i]),
    `final balances equal: ${finalCoinsMatch}; `
    + `${compensating.filter((t, i) => t === oracle[i]).length} of ${ARMS.length} arms failed to notice`);

  // ── (b) THE NEW FIELDS. Excluded from the proof above, so checked here. ──────
  {
    const s = seeded();
    const w = applyMatchResult(s, true);
    check('a 1v1 win reports place 0 of 2', w.place === 0 && w.seats === MIN_FIGHTERS && w.won === true);
    const l = applyMatchResult(seeded(), false);
    check('a 1v1 loss reports last of 2', l.place === MIN_FIGHTERS - 1 && l.seats === MIN_FIGHTERS && l.won === false);
    const third = applyMatchPlacement(seeded(), 2, 6);
    check('third of six reports itself, and is NOT a win',
      third.place === 2 && third.seats === 6 && third.won === false, JSON.stringify(third));
    check('only FIRST place is a win — 2nd of six is a good result and still not one',
      applyMatchPlacement(seeded(), 1, 6).won === false
      && applyMatchPlacement(seeded(), 0, 6).won === true);
  }

  // ── (c) ENDPOINTS ARE PINNED AT EVERY SEAT COUNT AND EVERY STEEPNESS ────────
  //
  // This is what makes the whole thing reversible: the steepness dial in `tuning.ts` cannot
  // reach the shipped duel, because two seats only ever produce r = 0 and r = 1.
  const ADVERSARIAL_K = [0, 0.25, 0.6, 1, 1.6, 4, 8, Infinity, NaN];
  function endpointsPinned(weightFn) {
    return ADVERSARIAL_K.every((k) => weightFn(0, k) === 0 && weightFn(1, k) === 1);
  }
  check('the curve weight pins BOTH endpoints at every exponent, including 0, Infinity and NaN',
    endpointsPinned(placementWeight01),
    ADVERSARIAL_K.map((k) => `k=${k}: w(0)=${placementWeight01(0, k)} w(1)=${placementWeight01(1, k)}`).join(' · '));
  // ⚠️ KNOWN-BAD: the same curve WITHOUT the structural early-returns. `Math.pow(0, 0)` is 1 in
  // JS, so an unpinned weight pays FIRST PLACE THE LOSER'S RATE at k=0. This is the exact bug
  // the two early returns exist to make unreachable.
  const unpinnedWeight = (r, k) => Math.pow(r, k);
  check('...and that check REJECTS the arithmetic-only version it replaced (Math.pow(0,0) === 1)',
    endpointsPinned(unpinnedWeight) === false,
    `unpinned w(0) at k=0 is ${unpinnedWeight(0, 0)}`);

  check('two seats pay exactly the shipped duel at EVERY exponent, adversarial ones included',
    ADVERSARIAL_K.every((k) => STANDINGS.every((t) => {
      const c = placementCurve(MIN_FIGHTERS, t, k);
      return c.length === 2 && c[0] === MATCH_PAYOUT.trophiesWin && c[1] === -trophyLoss(t);
    })));

  check('first place always pays the shipped WIN and last always pays the shipped LOSS, 2-6 seats',
    SEATS.every((n) => STANDINGS.every((t) =>
      placementTrophyDelta(0, n, t) === trophyDelta(t, true)
      && placementTrophyDelta(n - 1, n, t) === trophyDelta(t, false))),
    SEATS.map((n) => `${n}:[${placementCurve(n, 500).join(',')}]`).join(' '));

  // ── (d) MONOTONE. A curve that ever pays a worse finish more is not a ladder. ──
  function monotone(curveFn) {
    return SEATS.every((n) => STANDINGS.every((t) => {
      const c = curveFn(n, t);
      return c.every((v, i) => i === 0 || v <= c[i - 1]);
    }));
  }
  check('the curve never pays a worse placement more, at any seat count or standing',
    monotone((n, t) => placementCurve(n, t)));
  // ⚠️ KNOWN-BAD: a plausible-looking hand table with one seat out of order.
  check('...and the monotonicity check REJECTS a table with 3rd and 4th swapped',
    monotone((n) => n === 6 ? [15, 10, 0, 5, -5, -10] : [15, -10]) === false);

  // ── (e) §57's THIRD QUESTION: does the curve scale with N? ──────────────────
  //
  // *"3rd of 4 is the bottom half and 3rd of 6 is the top half. A curve indexed on raw
  // placement gets this wrong."* Written as a predicate so the wrong design can be run
  // through it and rejected, rather than described in a comment.
  function scalesWithSeats(deltaFn) {
    const t = 1500; // above the loss cap, where the two halves are furthest apart
    return deltaFn(2, 6, t) !== deltaFn(2, 4, t) && deltaFn(2, 6, t) > 0 && deltaFn(2, 4, t) < 0;
  }
  check('3rd of SIX is the top half (+) and 3rd of FOUR is the bottom half (-) — the curve scales with N',
    scalesWithSeats((p, n, t) => placementTrophyDelta(p, n, t)),
    `3rd of 6 = ${placementTrophyDelta(2, 6, 1500)}, 3rd of 4 = ${placementTrophyDelta(2, 4, 1500)}`);
  // ⚠️ KNOWN-BAD: the raw-place table §57 warned about. It pays 3rd the same in both fields.
  const rawPlaceTable = [15, 10, 5, 0, -5, -10];
  check('...and that check REJECTS a raw-placement-indexed table, which is the design §57 warned about',
    scalesWithSeats((p) => rawPlaceTable[p]) === false,
    `raw table pays 3rd = ${rawPlaceTable[2]} whether the field is four or six`);

  check('normalised rank is 0 for first and 1 for last at every seat count',
    SEATS.every((n) => placementRank01(0, n) === 0 && placementRank01(n - 1, n) === 1));

  // ── (f) THE GRACE BAND SURVIVES SIX SEATS ──────────────────────────────────
  //
  // The band is why a new player does not read the first hour as standing still. Six seats
  // must not be the place it quietly stops applying.
  function graceHolds(deltaFn) {
    return SEATS.every((n) => [0, 1, 50, MATCH_PAYOUT.trophyLossGraceBelow - 1]
      .every((t) => Array.from({ length: n }, (_, p) => deltaFn(p, n, t)).every((d) => d >= 0)));
  }
  check('NOBODY loses trophies inside the grace band, at any seat count — last of six included',
    graceHolds(placementTrophyDelta),
    `last of 6 at 0 trophies: ${placementTrophyDelta(5, 6, 0)}`);
  // ⚠️ KNOWN-BAD: the obvious wrong implementation — price the span off the CAP rather than off
  // the finisher's own standing. It is what you write if you forget `trophyLoss` is a function.
  const cappedSpan = (p, n, t) => Math.round(
    MATCH_PAYOUT.trophiesWin - placementWeight01(placementRank01(p, n)) * (MATCH_PAYOUT.trophiesWin + MATCH_PAYOUT.trophyLossCap));
  check('...and that check REJECTS a curve priced off trophyLossCap instead of the standing',
    graceHolds(cappedSpan) === false,
    `it would take ${-cappedSpan(5, 6, 0)} trophies off a brand-new player's sixth place`);

  // ── (g) COINS: everybody is paid, nobody is overpaid ───────────────────────
  check('every finisher at every seat count is paid coins, bounded by the shipped pair',
    SEATS.every((n) => Array.from({ length: n }, (_, p) => placementCoins(p, n))
      .every((c) => Number.isInteger(c) && c >= MATCH_PAYOUT.coinsLoss && c <= MATCH_PAYOUT.coinsWin)),
    SEATS.map((n) => `${n}:[${Array.from({ length: n }, (_, p) => placementCoins(p, n)).join(',')}]`).join(' '));
  check('coins land exactly on the shipped win/loss rates at the two ends, 2-6 seats',
    SEATS.every((n) => placementCoins(0, n) === MATCH_PAYOUT.coinsWin
      && placementCoins(n - 1, n) === MATCH_PAYOUT.coinsLoss));

  // ── (h) THE PROPERTY THAT DISCHARGES §57's WARNING ABOUT THE ROAD ───────────
  //
  // §57: *"anything chosen here interacts with the trophy road and the store, both of which are
  // tuned against the current two-outcome payout."* The default is chosen so that it does not:
  // a linear curve on normalised rank has the SAME mean payout per match at every seat count,
  // so the road's pacing cannot move when the seat count does.
  //
  // ⚠️ RESOLUTION: the mean over seats is EXACT ARITHMETIC — no seeds, no sampling, no floor to
  // quote. The residual is integer rounding alone, and it is exactly 0 at even seat counts.
  function meanPerMatch(n, t, k) {
    const c = placementCurve(n, t, k);
    return c.reduce((a, b) => a + b, 0) / n;
  }
  const evTarget = (t) => (MATCH_PAYOUT.trophiesWin - trophyLoss(t)) / 2; // the 1v1 average player
  check('mean payout per match is FLAT in the seat count — the road cannot be retuned by seating six',
    SEATS.every((n) => STANDINGS.every((t) => Math.abs(meanPerMatch(n, t) - evTarget(t)) <= 0.2)),
    SEATS.map((n) => `${n}:${meanPerMatch(n, 1500).toFixed(3)}`).join(' ') + ` vs ${evTarget(1500)}`);
  check('...and is EXACTLY the 1v1 mean at even seat counts — the residual is integer rounding only',
    [2, 4, 6].every((n) => STANDINGS.every((t) => meanPerMatch(n, t) === evTarget(t))));
  // ⚠️ KNOWN-BAD: the "friendly" exponent Uri may prefer. It is a real option and it is NOT
  // EV-neutral — this check is what would go red if it were adopted without re-tuning the road,
  // which is precisely the interaction §57 asked about.
  check('...and that check REJECTS the friendlier k=1.6 shape, which nearly doubles six-seat income',
    SEATS.some((n) => Math.abs(meanPerMatch(n, 1500, 1.6) - evTarget(1500)) > 0.2),
    `k=1.6 at six seats: ${meanPerMatch(6, 1500, 1.6).toFixed(3)} vs ${evTarget(1500)}`);

  // ── (i) THE CHEST FAUCET — the one step in an otherwise continuous curve ────
  check('the chest rule is exactly today at two seats: first banks, last does not',
    placementBanksChestWin(0, 2) === true && placementBanksChestWin(1, 2) === false);
  check('the chest rule is the top half, strictly — 2nd of THREE banks nothing (r = 0.5 exactly)',
    placementBanksChestWin(1, 3) === false && placementBanksChestWin(0, 3) === true);
  check('at six seats the top three bank a chest win and the bottom three do not',
    [0, 1, 2].every((p) => placementBanksChestWin(p, 6))
    && [3, 4, 5].every((p) => !placementBanksChestWin(p, 6)));
  check('last place NEVER banks a chest, at any seat count',
    SEATS.every((n) => placementBanksChestWin(n - 1, n) === false));
  {
    // The faucet actually running, not just the predicate.
    const s = seeded();
    let chests = 0;
    for (let i = 0; i < MATCH_PAYOUT.winsPerChest; i++) chests += applyMatchPlacement(s, 2, 6).chests;
    check('three third-of-six finishes earn one chest, exactly as three 1v1 wins do',
      chests === 1 && s.containers.chest === 1, `${chests} / ${s.containers.chest}`);
    const t = seeded();
    for (let i = 0; i < 30; i++) applyMatchPlacement(t, 3, 6);
    check('thirty fourth-of-six finishes earn none', t.containers.chest === 0);
  }

  // ── (j) REFUSALS. A payout that silently clamps is a payout nobody can trace. ──
  const throws = (fn) => { try { fn(); return false; } catch (e) { return e instanceof RangeError; } };
  check('a seat count below the sim floor is REFUSED, not clamped',
    throws(() => placementRank01(0, MIN_FIGHTERS - 1)) && throws(() => placementCurve(1, 0)));
  check('a seat count above the sim ceiling is REFUSED',
    throws(() => placementRank01(0, MAX_FIGHTERS + 1)));
  check('a non-integer seat count is REFUSED', throws(() => placementRank01(0, 2.5)));
  check('a place outside the field is REFUSED at both ends',
    throws(() => placementRank01(-1, 6)) && throws(() => placementRank01(6, 6))
    && throws(() => placementTrophyDelta(9, 4, 0)));
  check('...and the refusal reaches the state mutator too',
    throws(() => applyMatchPlacement(seeded(), 3, 3)));
  {
    // A refused placement must leave the player untouched — the same atomicity §13(e) asserts
    // for a refused upgrade. A payout that half-applies before throwing is worse than no payout.
    const s = seeded();
    const before = JSON.stringify(serialize(s));
    try { applyMatchPlacement(s, 7, 4); } catch { /* expected */ }
    check('a refused placement changes NOTHING about the player', JSON.stringify(serialize(s)) === before);
  }

  // ── (k) THE PERSISTED BLOB, INCLUDING ONE WRITTEN BEFORE THE CURVE EXISTED ──
  {
    const s = seeded(606);
    applyMatchPlacement(s, 4, 6);
    const round = deserialize(JSON.parse(JSON.stringify(serialize(s))));
    check('a placement result survives the round trip',
      JSON.stringify(round.lastMatch) === JSON.stringify(s.lastMatch), JSON.stringify(round.lastMatch));

    // The blob shape that shipped before this change: `won`, no `place`, no `seats`.
    const legacyLoss = deserialize({ lastMatch: { won: false, trophies: -8, coins: 20, chests: 0, seen: true } });
    check('a pre-curve blob\'s LOSS reads back as last of two, not as a defaulted first place',
      legacyLoss.lastMatch.place === MIN_FIGHTERS - 1 && legacyLoss.lastMatch.seats === MIN_FIGHTERS
      && legacyLoss.lastMatch.won === false, JSON.stringify(legacyLoss.lastMatch));
    const legacyWin = deserialize({ lastMatch: { won: true, trophies: 15, coins: 60, chests: 1, seen: false } });
    check('a pre-curve blob\'s WIN reads back as first of two',
      legacyWin.lastMatch.place === 0 && legacyWin.lastMatch.seats === MIN_FIGHTERS
      && legacyWin.lastMatch.won === true);

    check('a blob claiming a seat count the sim refuses is repaired, never thrown on',
      deserialize({ lastMatch: { won: true, seats: 99, place: 40 } }).lastMatch.seats === MIN_FIGHTERS);
    check('a blob claiming 4th of two is repaired',
      deserialize({ lastMatch: { won: false, seats: 2, place: 3 } }).lastMatch.place === MIN_FIGHTERS - 1);
    check('`won` is DERIVED from place, so a blob cannot claim a victory at fourth of six',
      deserialize({ lastMatch: { won: true, seats: 6, place: 3 } }).lastMatch.won === false);
  }

  // ── (l) PACING AT SIX SEATS — the road still finishes ───────────────────────
  //
  // ⚠️ THE BOUNDS ARE IN MATCHES, for the same reason section 9's are: hours multiply by a
  // session length that lives in another file. And the placement stream is a MODEL, named as
  // one — Plackett-Luce with the player at weight 1.5 against N-1 opponents at 1.0, which
  // reproduces the 60% win rate section 9 already assumes when the field is two.
  function placeFor(rng, seats, strength = 1.5) {
    const w = [strength, ...new Array(seats - 1).fill(1)];
    const alive = w.map((_, i) => i);
    for (let pos = 0; pos < seats; pos++) {
      let tot = 0;
      for (const i of alive) tot += w[i];
      let x = rng.next() * tot;
      let chosen = alive[alive.length - 1];
      for (const i of alive) { x -= w[i]; if (x <= 0) { chosen = i; break; } }
      if (chosen === 0) return pos;
      alive.splice(alive.indexOf(chosen), 1);
    }
    return seats - 1;
  }
  {
    const rows = [];
    for (const n of SEATS) {
      const s = createEconomy(20260811);
      const rng = createRng(20260811);
      let firstChar = null;
      let complete = null;
      // ⚠️ GUARDED BECAUSE AN UNGUARDED `.find()` HERE MASKED EVERY LATER SECTION.
      // Found by planting a known-bad for §4b's vacuity guard: strike every character
      // node off the road and this line dereferences `undefined`, the suite dies with a
      // `TypeError` at section 3b, and sections 4 through 13 never run — so the guard
      // written specifically to catch that road never got the chance to. A crash IS a
      // red result, but it is red in the wrong place and under the wrong name, and it
      // hides however many other things the same edit broke. `check` first, then use it.
      const firstNode = TROPHY_ROAD.find((m) => m.reward.type === 'character');
      if (!firstNode) { check('the road has a character node to pace against', false, 'none'); break; }
      for (let m = 1; m <= 6000 && complete === null; m++) {
        applyMatchPlacement(s, placeFor(rng, n), n);
        claimAll(s);
        if (firstChar === null && s.claimed.includes(firstNode.trophies)) firstChar = m;
        if (s.claimed.length === TROPHY_ROAD.length) complete = m;
      }
      rows.push({ n, firstChar, complete, coins: s.coins, chests: s.containers.chest });
    }
    console.log(`     seats -> first character / road complete (matches), Plackett-Luce s=1.5:`);
    for (const r of rows) {
      console.log(`       ${r.n}: first=${r.firstChar}  complete=${r.complete}`
        + `  chests=${r.chests}  curve@1500=[${placementCurve(r.n, 1500).join(', ')}]`);
    }
    check('the road completes at EVERY seat count, not just at two',
      rows.every((r) => r.complete !== null), rows.map((r) => `${r.n}:${r.complete}`).join(' '));
    check('the FIRST character is still one sitting at every seat count (<= 20 matches)',
      rows.every((r) => r.firstChar !== null && r.firstChar <= 20),
      rows.map((r) => `${r.n}:${r.firstChar}`).join(' '));
    // The load-bearing pacing claim: seating six must not shift the road by more than the
    // spread the two-seat arm already has across seeds (section 9 quotes sd 51 on this figure).
    //
    // ── ⚠️ THE OLD BOUND WAS `spread <= 102` AND IT WAS WRONG TWICE OVER ────────────
    //
    // Kept above per house style. Both faults were invisible while the road was short:
    //
    //  1. **WRONG SCALE.** 102 is an ABSOLUTE match count derived from a career on the
    //     3,200-trophy road. A run-to-run sd is roughly proportional to the length of the
    //     career it measures, so carrying 102 onto a ×3.13 road silently tightened this
    //     test by ×3.13 — the line looked untouched and had become three times as strict.
    //     Measured with one instrument across both roads, 40 seeds, seat count held fixed
    //     (`tools/tmp/tr_road_probe.mjs --seatnull 40`):
    //       old road  mean 580.5 · sd 43.3 · cv 7.45%
    //       this road mean 1923.0 · sd 102.0 · cv 5.30%
    //
    //  2. **WRONG STATISTIC**, and this one was already wrong before the road moved.
    //     The number on the left is `max - min` over FIVE seat counts — a RANGE of five
    //     correlated arms — and `2 sd` describes the deviation of ONE. `CLAUDE.md`
    //     non-negotiable 10 names this exact error on seat fairness: the floor has to be
    //     built by permuting the labels and reading the NULL RANGE, because "reaching for
    //     the standard formula because it is the standard formula is how a floor gets
    //     quoted an order of magnitude too tight." The expected range of five normal draws
    //     is ~2.33 sd, not 2 sd.
    //
    // So the bound is now that null, measured rather than derived: run the career at a
    // FIXED seat count over 40 seeds, take `max - min` over random five-seed subsets, and
    // use its p95 — the spread five arms reach by SEED ALONE, with no seat effect present.
    //       old road  null range of five: mean 102.1 · p95 168   (the shipped bound was 102)
    //       this road null range of five: mean 238.7 · p95 354
    // ⚠️ Note what that says about the old bound: 102 sat at the MEAN of its own null, so
    // it would have fired on half of all seat-effect-free runs. It never did only because
    // the observed spread happened to be 45. A guard that survives by luck is furniture.
    const spread = Math.max(...rows.map((r) => r.complete)) - Math.min(...rows.map((r) => r.complete));
    check('road completion across 2-6 seats stays inside the seed-only NULL RANGE OF FIVE (p95 = 354)',
      spread <= 354, `spread ${spread} matches across seat counts`);
  }
}

// ─────────────────────────────────────────────────────────────────────────────
// 4. The trophy road table — structure and the roster contract
// ─────────────────────────────────────────────────────────────────────────────

console.log('\n4. Trophy road structure');
{
  check('the road has milestones', TROPHY_ROAD.length > 0);

  let ascending = true;
  for (let i = 1; i < TROPHY_ROAD.length; i++) {
    if (TROPHY_ROAD[i].trophies <= TROPHY_ROAD[i - 1].trophies) ascending = false;
  }
  check('thresholds are strictly ascending', ascending);

  const thresholds = TROPHY_ROAD.map((m) => m.trophies);
  check('thresholds are unique', new Set(thresholds).size === thresholds.length);
  check('every threshold is a positive integer',
    thresholds.every((t) => Number.isInteger(t) && t > 0));

  // THE ROSTER CONTRACT — see the file header.
  const onRoad = [];
  const walk = (reward) => {
    if (reward.type === 'character') onRoad.push(reward.id);
    else if (reward.type === 'bundle') reward.parts.forEach(walk);
  };
  TROPHY_ROAD.forEach((m) => walk(m.reward));
  const expected = CHARACTER_IDS.filter((id) => id !== STARTER_CHARACTER);
  check(`the road unlocks all ${expected.length} non-starter characters`,
    expected.every((id) => onRoad.includes(id)),
    `missing: ${expected.filter((id) => !onRoad.includes(id)).join(', ') || 'none'}`);
  check('no character appears on the road twice',
    new Set(onRoad).size === onRoad.length,
    `duplicates: ${onRoad.filter((id, i) => onRoad.indexOf(id) !== i).join(', ')}`);
  check('the starter is NOT a road reward', !onRoad.includes(STARTER_CHARACTER));

  // Rarity should climb along the road — a Cyber unlock before a Normal one would
  // make the ladder meaningless.
  const RANK = { Normal: 0, Rare: 1, Epic: 2, Legendary: 3, Neon: 4, Cyber: 5 };
  let monotonic = true;
  for (let i = 1; i < onRoad.length; i++) {
    if (RANK[CHARACTERS[onRoad[i]].rarity] < RANK[CHARACTERS[onRoad[i - 1]].rarity]) monotonic = false;
  }
  check('character unlocks climb in rarity along the road', monotonic,
    onRoad.map((id) => `${id}(${CHARACTERS[id].rarity})`).join(' -> '));

  check('every container referenced by the road exists', TROPHY_ROAD.every((m) => {
    const ok = (r) => r.type !== 'container' ? (r.type === 'bundle' ? r.parts.every(ok) : true)
      : CONTAINER_KINDS.includes(r.kind);
    return ok(m.reward);
  }));

  check('roadEnd is the last threshold', roadEnd() === thresholds[thresholds.length - 1]);
  check('nextMilestone at 0 is the first node', nextMilestone(0).trophies === thresholds[0]);
  check('nextMilestone past the end is null', nextMilestone(roadEnd() + 1) === null);

  const p = roadProgress(0);
  check('progress from zero measures against the first node',
    p.from === 0 && p.to === thresholds[0] && p.progress01 === 0);
  const mid = roadProgress(thresholds[0]);
  check('progress at a node boundary is 0 toward the NEXT node',
    mid.from === thresholds[0] && mid.progress01 === 0, JSON.stringify(mid));
  check('progress past the end of the road is full', roadProgress(roadEnd() + 500).progress01 === 1);
  const half = roadProgress(Math.floor((thresholds[0] + thresholds[1]) / 2));
  check('progress between two nodes is fractional',
    half.progress01 > 0.3 && half.progress01 < 0.7, `${half.progress01}`);
}

// ─────────────────────────────────────────────────────────────────────────────
// 4b. URI'S 10,000 SPEC, ASSERTED
// ─────────────────────────────────────────────────────────────────────────────
//
// Uri, 2026-08-24: *"Change the trophy road to distribute the characters across 10,000
// trophies. When you reach 10,000 you will have all of them. Add more steps and stretch
// the distance between steps a bit."*
//
// Section 4 above already checks that the roster is ON the road. It has nothing to say
// about WHERE, which is the entire content of this instruction, so these are new.
//
// 🚨 EVERY PREDICATE HERE RUNS OVER A FILTERED SET, AND `[].every()` IS `true`. The
// character nodes are a filter of the road; the gaps are a derived list. `CLAUDE.md`
// non-negotiable 6 records that vacuity firing three times in three files in one session,
// always green, always because a fix emptied the set the assertion ran over. So the
// non-empty checks come FIRST and are real assertions, not comments — delete the road's
// character nodes and this section goes red on line one rather than passing in silence.
console.log(`\n4b. Uri's 10,000 spec (ROSTER_COMPLETE_TROPHIES = ${ROSTER_COMPLETE_TROPHIES.toLocaleString()})`);
{
  // A bundle can carry a character grant, and a filter matching only
  // `reward.type === 'character'` would miss it — which is how a road check comes to
  // measure nine characters and call it ten. Walk the tree.
  const unlocks = [];
  const walk = (reward, trophies) => {
    if (reward.type === 'character') unlocks.push({ id: reward.id, trophies });
    else if (reward.type === 'bundle') reward.parts.forEach((p) => walk(p, trophies));
  };
  TROPHY_ROAD.forEach((m) => walk(m.reward, m.trophies));

  const expected = CHARACTER_IDS.filter((id) => id !== STARTER_CHARACTER);

  // ── THE NON-VACUITY GUARDS. These are why the rest of the section means anything. ──
  check('the expected character set is NON-EMPTY', expected.length > 0, `${expected.length}`);
  check('the road has character unlocks to check', unlocks.length > 0, `${unlocks.length}`);
  check('...and there is one for every expected character',
    unlocks.length === expected.length, `${unlocks.length} unlocks vs ${expected.length} expected`);

  // ── "when you reach 10,000 you will have all of them" ──────────────────────
  const at = new Map(unlocks.map((u) => [u.id, u.trophies]));
  const late = expected.filter((id) => !at.has(id) || at.get(id) > ROSTER_COMPLETE_TROPHIES);
  check(`EVERY character is unlocked at or before ${ROSTER_COMPLETE_TROPHIES.toLocaleString()}`,
    late.length === 0,
    late.map((id) => `${id}@${at.get(id) ?? 'nowhere'}`).join(', '));

  // ── "distribute the characters across 10,000" — the LAST one lands ON it, and
  //    the road stops there. Both halves, because either alone is satisfiable in a
  //    way that misses the point: every character before 9,000 satisfies "at or
  //    before 10,000" while wasting the last tenth of the road.
  const last = unlocks[unlocks.length - 1];
  check(`the LAST character lands exactly on ${ROSTER_COMPLETE_TROPHIES.toLocaleString()}`,
    last !== undefined && last.trophies === ROSTER_COMPLETE_TROPHIES,
    last ? `${last.id}@${last.trophies}` : 'no character unlocks');
  check('...and that node is the END of the road — roster complete IS road complete',
    roadEnd() === ROSTER_COMPLETE_TROPHIES, `roadEnd ${roadEnd()}`);
  check('the road end is the exported constant, not a retyped literal',
    TROPHY_ROAD[TROPHY_ROAD.length - 1].trophies === ROSTER_COMPLETE_TROPHIES);

  // ── "the road is strictly increasing" ──────────────────────────────────────
  // Section 4 asserts this too. It is repeated here deliberately and in a DIFFERENT
  // shape: section 4's version is a `for` loop from i=1, which on a one-element road
  // never executes and reports `ascending = true`. This one asserts the road is long
  // enough for the question to mean something first.
  const ts = TROPHY_ROAD.map((m) => m.trophies);
  check('the road is long enough for "increasing" to mean anything', ts.length >= 2, `${ts.length} nodes`);
  const rising = ts.every((t, i) => i === 0 || t > ts[i - 1]);
  check('the road is STRICTLY increasing', rising, ts.join(','));

  // ── "add more steps" and "stretch the distance between steps a bit" ────────
  // The road being replaced, measured on `31f481c` rather than remembered:
  //   34 steps · end 3,200 · gaps min 10 · median 70 · mean 94.1
  const PREV = { steps: 34, gapMin: 10, gapMedian: 70, gapMean: 3200 / 34 };
  const gaps = ts.map((t, i) => t - (i === 0 ? 0 : ts[i - 1]));
  check('there are gaps to measure', gaps.length > 0);
  const sorted = [...gaps].sort((a, b) => a - b);
  const med = sorted.length % 2
    ? sorted[(sorted.length - 1) / 2]
    : (sorted[sorted.length / 2 - 1] + sorted[sorted.length / 2]) / 2;
  const mean = roadEnd() / TROPHY_ROAD.length;
  check(`MORE steps than the road it replaces (${PREV.steps})`,
    TROPHY_ROAD.length > PREV.steps, `${TROPHY_ROAD.length} steps`);
  // All three, not the mean alone: a mean can be dragged up by one enormous tail gap
  // while every early gap SHRINKS, which is the opposite of what was asked for.
  check(`STRETCHED — smallest gap wider than ${PREV.gapMin}`, sorted[0] > PREV.gapMin, `min ${sorted[0]}`);
  check(`STRETCHED — median gap wider than ${PREV.gapMedian}`, med > PREV.gapMedian, `median ${med}`);
  check(`STRETCHED — mean gap wider than ${PREV.gapMean.toFixed(1)}`,
    mean > PREV.gapMean, `mean ${mean.toFixed(1)}`);
  // The road never SPEEDS UP. The old one did, once: it stepped 25 then 22.
  check('step gaps never shrink along the road',
    gaps.every((g, i) => i === 0 || g >= gaps[i - 1]), gaps.join(','));
  console.log(`     ${TROPHY_ROAD.length} steps to ${roadEnd().toLocaleString()}`
    + `  ·  gaps min ${sorted[0]} / median ${med} / mean ${mean.toFixed(1)} / max ${sorted[sorted.length - 1]}`
    + `  ·  characters at ${unlocks.map((u) => u.trophies).join(', ')}`);

  // ── §26: rarity is ACQUISITION rarity and confers no power. The road must not
  //    imply otherwise. The ladder climbs in SCARCITY, and the assertion that it
  //    costs the same to level at every tier lives in §13 — this one only checks the
  //    road does not smuggle a second hierarchy in by ordering.
  check('every level costs the same at every rarity, so road position implies no power',
    RARITY_ORDER.every((t) => LEVEL_UP.rarityCostMultiplier[t] === 1),
    RARITY_ORDER.map((t) => `${t}:${LEVEL_UP.rarityCostMultiplier[t]}`).join(' '));
}

// ─────────────────────────────────────────────────────────────────────────────
// 5. Container tables and the PUBLISHED odds
// ─────────────────────────────────────────────────────────────────────────────

console.log('\n5. Containers and published odds');
{
  for (const kind of CONTAINER_KINDS) {
    const total = totalWeight(CONTAINERS[kind].entries);
    check(`${kind}: weights sum to exactly 100`, approx(total, 100, 1e-9), `sum ${total}`);
  }

  check('the chest is not purchasable', CONTAINERS.chest.price === null);
  check('every box IS priced', CONTAINER_KINDS.filter((k) => k !== 'chest')
    .every((k) => CONTAINERS[k].price && CONTAINERS[k].price.coins > 0 && CONTAINERS[k].price.gems > 0));

  check('box prices rise with rarity tier',
    CONTAINERS.hamburgerBox.price.coins < CONTAINERS.pineappleBox.price.coins
    && CONTAINERS.pineappleBox.price.coins < CONTAINERS.redBox.price.coins
    && CONTAINERS.redBox.price.coins < CONTAINERS.fireBox.price.coins);

  check('every rarity referenced by a container has at least one character',
    CONTAINER_KINDS.every((kind) => CONTAINERS[kind].entries.every((e) =>
      !e.characterRarity || (CHARACTERS_BY_RARITY[e.characterRarity] ?? []).length > 0)),
  );

  // CHARACTERS_BY_RARITY is derived, not hand-listed — prove it covers the roster.
  const grouped = Object.values(CHARACTERS_BY_RARITY).flat();
  check('CHARACTERS_BY_RARITY covers the whole roster exactly once',
    grouped.length === CHARACTER_IDS.length && new Set(grouped).size === CHARACTER_IDS.length);

  for (const kind of CONTAINER_KINDS) {
    const rows = containerOdds(kind);
    const sum = rows.reduce((a, r) => a + r.percent, 0);
    check(`${kind}: published odds sum to 100%`, approx(sum, 100, 1e-6), `sum ${sum}`);
  }

  // The disclosure must not round a real chance away to zero.
  const cyberRow = containerOdds('redBox').find((r) => r.rarity === 'Cyber');
  check('a 0.01% chance is published as 0.01%, not 0%',
    cyberRow && formatPercent(cyberRow.percent) === '0.01%',
    cyberRow ? formatPercent(cyberRow.percent) : 'row missing');
  check('formatPercent never prints a bare 0% for a non-zero chance',
    formatPercent(0.004) !== '0%' && formatPercent(0.0001) !== '0%',
    `${formatPercent(0.004)} / ${formatPercent(0.0001)}`);
  check('formatPercent trims trailing zeros', formatPercent(94.5) === '94.5%');
  check('an odds line is renderable for every container',
    CONTAINER_KINDS.every((k) => containerOddsLine(k).length > 0));

  // THE LOOP THAT MATTERS: does the seeded roller actually produce the published
  // distribution? 60k rolls against an empty owned-set (so character rows are
  // distinguishable from currency rows).
  const owned = new Set();
  for (const kind of ['chest', 'hamburgerBox', 'pineappleBox', 'fireBox']) {
    const rows = containerOdds(kind);
    const seen = new Map();
    const N = 60000;
    for (let i = 0; i < N; i++) {
      const res = rollContainer(kind, createRng(1000 + i), owned);
      const label = res.reward.characters.length > 0
        ? `${CHARACTERS[res.reward.characters[0]].rarity} fighter`
        : [res.reward.coins ? `${res.reward.coins.toLocaleString()} coins` : null,
           res.reward.gems ? `${res.reward.gems.toLocaleString()} gems` : null]
          .filter(Boolean).join(' + ');
      seen.set(label, (seen.get(label) ?? 0) + 1);
    }
    let worst = 0;
    let worstRow = '';
    for (const row of rows) {
      if (row.percent < 1) continue; // 0.01% rows need millions of samples; checked structurally above
      const empirical = ((seen.get(row.label) ?? 0) / N) * 100;
      const err = Math.abs(empirical - row.percent);
      if (err > worst) { worst = err; worstRow = `${row.label}: published ${row.percent}%, rolled ${empirical.toFixed(2)}%`; }
    }
    check(`${kind}: 60k seeded rolls match the published odds within 1pp`, worst < 1.0, worstRow);
    check(`${kind}: every rolled outcome is a published one`,
      [...seen.keys()].every((label) => rows.some((r) => r.label === label)),
      [...seen.keys()].filter((l) => !rows.some((r) => r.label === l)).join(' | '));
  }

  // Determinism at the roll level.
  const a = rollContainer('chest', createRng(555), new Set());
  const b = rollContainer('chest', createRng(555), new Set());
  check('the same seed opens the same chest',
    JSON.stringify(a.reward) === JSON.stringify(b.reward), JSON.stringify(a.reward));

  // Duplicate conversion.
  const allOwned = new Set(CHARACTER_IDS);
  const dup = rollContainer('fireBox', createRng(77), allOwned);
  check('a fully-owned roster converts a box to coins',
    dup.reward.characters.length === 0 && dup.reward.coins > 0 && !!dup.duplicateOf,
    JSON.stringify(dup));
  check('the duplicate pays that rarity rate',
    dup.reward.coins === DUPLICATE_COINS[CHARACTERS[dup.duplicateOf].rarity],
    `${dup.reward.coins} for ${dup.duplicateOf}`);

  // Never hand over a duplicate while an unowned character sits in the same pool.
  const legendaries = CHARACTERS_BY_RARITY.Legendary;
  const partial = new Set(CHARACTER_IDS.filter((id) => id !== legendaries[0]));
  let handedDuplicate = false;
  for (let i = 0; i < 400; i++) {
    const res = rollContainer('fireBox', createRng(9000 + i), partial);
    if (res.duplicateOf && CHARACTERS[res.duplicateOf].rarity === 'Legendary') handedDuplicate = true;
  }
  check('a box never gives a duplicate while an unowned character shares the pool',
    !handedDuplicate);
}

// ─────────────────────────────────────────────────────────────────────────────
// 6. Claiming
// ─────────────────────────────────────────────────────────────────────────────

console.log('\n6. Claiming milestones');
{
  const first = TROPHY_ROAD[0];

  const s = seeded();
  check('nothing is claimable at zero trophies', claimable(0, []).length === 0);
  check('claiming an unreached milestone returns null', claimMilestone(s, first.trophies) === null);
  check('a rejected claim changes nothing', s.claimed.length === 0 && s.coins === STARTING_BALANCE.coins);

  s.trophies = first.trophies;
  check('a reached milestone is claimable', claimable(s.trophies, s.claimed).length === 1);
  const got = claimMilestone(s, first.trophies);
  check('claiming returns a reward', got !== null);
  check('claiming records the threshold', s.claimed.includes(first.trophies));
  check('a claimed milestone is no longer claimable', claimable(s.trophies, s.claimed).length === 0);
  check('double-claiming returns null', claimMilestone(s, first.trophies) === null);

  check('claiming an unknown threshold returns null', claimMilestone(s, -1) === null);

  // Currency milestones credit exactly.
  const coinNode = TROPHY_ROAD.find((m) => m.reward.type === 'coins');
  const s2 = seeded();
  s2.trophies = coinNode.trophies;
  const before = s2.coins;
  claimMilestone(s2, coinNode.trophies);
  check('a coin milestone credits its exact amount',
    s2.coins === before + coinNode.reward.amount, `${before} -> ${s2.coins}`);

  const gemNode = TROPHY_ROAD.find((m) => m.reward.type === 'gems');
  const s3 = seeded();
  s3.trophies = gemNode.trophies;
  const gemsBefore = s3.gems;
  claimMilestone(s3, gemNode.trophies);
  check('a gem milestone credits its exact amount', s3.gems === gemsBefore + gemNode.reward.amount);

  const boxNode = TROPHY_ROAD.find((m) => m.reward.type === 'container');
  const s4 = seeded();
  s4.trophies = boxNode.trophies;
  claimMilestone(s4, boxNode.trophies);
  check('a container milestone credits the container',
    s4.containers[boxNode.reward.kind] === boxNode.reward.count);

  // Claim All.
  const s5 = seeded();
  s5.trophies = TROPHY_ROAD[4].trophies;
  const reachable = claimable(s5.trophies, s5.claimed).length;
  const bulk = claimAll(s5);
  check('claimAll clears every reachable node', claimable(s5.trophies, s5.claimed).length === 0
    && s5.claimed.length === reachable, `${reachable} reachable`);
  check('claimAll returns the merged reward',
    bulk.coins > 0 || bulk.gems > 0 || Object.keys(bulk.containers).length > 0);

  // The capstone bundle.
  //
  // ── ⚠️ THIS CHECK WAS NAMED `the road ends on a bundle` AND NEVER CHECKED THAT ──
  //
  // Kept per house style, and the lesson is worth more than the check was: it asserted
  // `!!TROPHY_ROAD.find(m => m.reward.type === 'bundle')` — "a bundle exists SOMEWHERE"
  // — under a name claiming a position. It would have passed with the bundle first. The
  // name was doing the reader's verification for them, which is the failure mode
  // `AGENT-BRIEF §4.4` states as *"ask of every assertion: what implementation would
  // fail this?"* Both halves are now asserted separately and by position.
  //
  // The road deliberately no longer ends on the bundle: Uri's 10,000 node is the last
  // CHARACTER, so the capstone haul sits second-to-last. See `tuning.ts`.
  const bundleNode = TROPHY_ROAD.find((m) => m.reward.type === 'bundle');
  check('the road carries a capstone bundle', !!bundleNode);
  check('...and it is at the TOP of the road, not buried early',
    !!bundleNode && TROPHY_ROAD.indexOf(bundleNode) >= TROPHY_ROAD.length - 2,
    `index ${bundleNode ? TROPHY_ROAD.indexOf(bundleNode) : -1} of ${TROPHY_ROAD.length}`);
  check('...and the road ENDS on a character — roster complete is the climax',
    TROPHY_ROAD[TROPHY_ROAD.length - 1].reward.type === 'character',
    TROPHY_ROAD[TROPHY_ROAD.length - 1].reward.type);
  const s6 = seeded();
  const bundleReward = resolveReward(bundleNode.reward, ownedSet(s6));
  check('a bundle resolves every part',
    bundleReward.coins > 0 && bundleReward.gems > 0
    && Object.values(bundleReward.containers).some((n) => n > 0),
    JSON.stringify(bundleReward));
}

// ─────────────────────────────────────────────────────────────────────────────
// 7. Character rewards and the roster gate
// ─────────────────────────────────────────────────────────────────────────────

console.log(`\n7. Character rewards (ROSTER_GATED = ${ROSTER_GATED})`);
{
  const charNode = TROPHY_ROAD.find((m) => m.reward.type === 'character');
  const s = seeded();
  const owned = ownedSet(s);

  if (ROSTER_GATED) {
    check('a locked character node grants the character',
      resolveReward(charNode.reward, owned).characters[0] === charNode.reward.id);
    check('a new player owns only the starter', s.unlocked.length === 1);
  } else {
    const reward = resolveReward(charNode.reward, owned);
    check('while ungated, every character counts as owned', owned.size === CHARACTER_IDS.length);
    check('an ungated character node pays its duplicate value in coins',
      reward.characters.length === 0
      && reward.coins === DUPLICATE_COINS[CHARACTERS[charNode.reward.id].rarity],
      JSON.stringify(reward));
    check('an ungated character node is never worth nothing', reward.coins > 0);
  }

  // The face keeps the character's identity either way — the road is a map of the
  // roster, and it discloses the substitution rather than hiding it.
  const face = milestoneFace(charNode.reward, owned);
  check('a character node still shows the character', face.isCharacter
    && face.title === CHARACTERS[charNode.reward.id].name);
  check('a substituted payout is disclosed on the node',
    ROSTER_GATED ? face.payoutNote === undefined : typeof face.payoutNote === 'string',
    String(face.payoutNote));

  // Faces exist for every reward type.
  check('every milestone renders a face', TROPHY_ROAD.every((m) => {
    const f = milestoneFace(m.reward, owned);
    return f.emoji.length > 0 && f.title.length > 0;
  }));

  // Granting a character is idempotent.
  const s2 = seeded();
  const target = CHARACTER_IDS.find((id) => id !== STARTER_CHARACTER);
  grantReward(s2, { coins: 0, gems: 0, containers: {}, characters: [target] });
  grantReward(s2, { coins: 0, gems: 0, containers: {}, characters: [target] });
  check('unlocking the same character twice keeps one entry',
    s2.unlocked.filter((id) => id === target).length === 1);

  check('every road character is a real roster id', TROPHY_ROAD.every((m) =>
    m.reward.type !== 'character' || CHARACTER_IDS.includes(m.reward.id)));
}

// ─────────────────────────────────────────────────────────────────────────────
// 8. Opening, spending and buying
// ─────────────────────────────────────────────────────────────────────────────

console.log('\n8. Inventory operations');
{
  const s = seeded();
  check('opening a container you do not hold returns null', openContainer(s, 'chest') === null);

  s.containers.chest = 2;
  const before = s.coins;
  const opened = openContainer(s, 'chest');
  check('opening consumes one container', s.containers.chest === 1);
  check('opening pays out', opened !== null && (opened.reward.coins > 0 || opened.reward.gems > 0
    || opened.reward.characters.length > 0));
  check('the payout is credited', s.coins >= before);
  check('opening advances the roll counter', s.rolls === 1);

  // The seed is persisted, so the outcome cannot be re-rolled by reloading.
  const a = seeded(4242);
  a.containers.chest = 1;
  const first = openContainer(a, 'chest');
  const b = deserialize(serialize(seeded(4242)));
  b.containers.chest = 1;
  const again = openContainer(b, 'chest');
  check('a reload cannot re-roll a held container',
    JSON.stringify(first.reward) === JSON.stringify(again.reward));

  // Consecutive opens differ (this is what mixSeed exists for).
  const c = seeded(31337);
  c.containers.chest = 40;
  const outcomes = new Set();
  for (let i = 0; i < 40; i++) outcomes.add(JSON.stringify(openContainer(c, 'chest').reward));
  check('40 consecutive chests are not all identical', outcomes.size > 2, `${outcomes.size} distinct`);

  check('totalContainers counts every kind', (() => {
    const t = seeded();
    t.containers.chest = 2;
    t.containers.fireBox = 3;
    return totalContainers(t) === 5;
  })());

  // Spending.
  const sp = seeded();
  check('spending more than you have fails', spend(sp, sp.coins + 1, 0) === false);
  check('a failed spend changes nothing', sp.coins === STARTING_BALANCE.coins);
  check('an affordable spend succeeds', spend(sp, 100, 0) === true && sp.coins === STARTING_BALANCE.coins - 100);
  check('gems are spent independently', spend(sp, 0, 5) === true && sp.gems === STARTING_BALANCE.gems - 5);
  check('a mixed spend is all-or-nothing',
    spend(sp, 10, 1e6) === false && sp.coins === STARTING_BALANCE.coins - 100);

  // Buying boxes with earned currency.
  const buy = seeded();
  check('a chest cannot be bought', buyContainer(buy, 'chest', 'coins') === false);
  check('a failed purchase grants nothing', buy.containers.chest === 0);
  buy.coins = CONTAINERS.hamburgerBox.price.coins;
  check('an affordable box is bought', buyContainer(buy, 'hamburgerBox', 'coins') === true);
  check('the box is delivered', buy.containers.hamburgerBox === 1);
  check('the coins are taken', buy.coins === 0);
  check('an unaffordable box is refused', buyContainer(buy, 'fireBox', 'coins') === false);
  buy.gems = CONTAINERS.fireBox.price.gems;
  check('gems buy the same box', buyContainer(buy, 'fireBox', 'gems') === true && buy.gems === 0);
}

// ─────────────────────────────────────────────────────────────────────────────
// 9. PACING — the design claim, asserted
// ─────────────────────────────────────────────────────────────────────────────

console.log('\n9. Pacing (60% win rate, seeded)');
{
  /** Simulate a player at a fixed win rate, claiming everything as it unlocks. */
  function simulate(winRate, maxMatches = 5000, seed = 20260804) {
    const s = createEconomy(seed);
    const rng = createRng(seed);
    const unlockedAt = new Map();
    const charNodes = TROPHY_ROAD.filter((m) => m.reward.type === 'character');
    for (let match = 1; match <= maxMatches; match++) {
      applyMatchResult(s, rng.next() < winRate);
      claimAll(s);
      for (const node of charNodes) {
        if (!unlockedAt.has(node.reward.id) && s.claimed.includes(node.trophies)) {
          unlockedAt.set(node.reward.id, match);
        }
      }
      if (unlockedAt.size === charNodes.length && s.claimed.length === TROPHY_ROAD.length) {
        return { state: s, unlockedAt, matches: match, complete: true };
      }
    }
    return { state: s, unlockedAt, matches: maxMatches, complete: false };
  }

  const run = simulate(0.60);
  const order = TROPHY_ROAD.filter((m) => m.reward.type === 'character').map((m) => m.reward.id);
  const firstAt = run.unlockedAt.get(order[0]);
  const halfAt = run.unlockedAt.get(order[Math.floor(order.length / 2)]);
  const lastAt = run.unlockedAt.get(order[order.length - 1]);

  // ── ⚠️ THE WALL-CLOCK HERE WAS WRONG BY 4.7x FOR THE WHOLE OF THIS PROJECT ──
  //
  // This line used to read `const MIN = 2; // assumed minutes per match, including menus`
  // — a literal, in a test, dating from when `MATCH_DURATION_MS` was 180 s. It has been
  // wrong since the clock went to 45 s, and it is the source of every "hours to unlock"
  // figure the project has quoted: `tuning.ts`'s own "~15 hours to the full roster" and
  // `DECISIONS §13`'s "roughly 13 hours of play to unlock characters measurably worse
  // than the free one". **The measured session is 15.5 s, not 120 s.**
  //
  // It is exactly the `DECISIONS §13` defect in this module's own house: a number
  // presented as a finding that the model never computed. The fix is not a better guess —
  // it is moving the number to `tuning.ts:MATCH_PACING` where the two halves can be
  // labelled separately, one MEASURED (the session, off `roster_lab`) and one ASSUMED
  // (menu time, which nothing here instruments and which is parked for Uri).
  const MIN = SECONDS_PER_MATCH / 60;
  console.log(`     first=${firstAt} matches (~${(firstAt * MIN).toFixed(1)} min)`
    + `  half=${halfAt} (~${(halfAt * MIN / 60).toFixed(1)} h)`
    + `  full=${lastAt} (~${(lastAt * MIN / 60).toFixed(1)} h)`
    + `  road complete=${run.matches} (~${(run.matches * MIN / 60).toFixed(1)} h)`
    + `   [${SECONDS_PER_MATCH.toFixed(1)}s/match: ${MATCH_PACING.sessionSeconds}s measured + ${MATCH_PACING.menuSecondsPerMatch}s assumed menus]`);

  check('FIRST character is reachable in one sitting (<= 20 matches)',
    firstAt !== undefined && firstAt <= 20, `${firstAt} matches`);
  check('first character is not instant (>= 3 matches)', firstAt >= 3, `${firstAt} matches`);
  // ⚠️ THE BOUNDS ARE IN MATCHES, NOT HOURS, AND THAT IS DELIBERATE. Matches is what
  // this model computes; hours is matches times a session length that lives in another
  // file and moves whenever the clock does. Asserting the hours here is what let the
  // 2-minute literal survive a 4x change in match length without a single gate going red.
  //
  // ── ⚠️ THESE READ `240` AND `600` AND BOTH DESCRIBED THE 3,200-TROPHY ROAD ──────
  //
  // Kept per house style, because the pair is the record of what Uri's 10,000
  // instruction cost in matches. Nothing about the payout curve moved — `MATCH_PAYOUT`
  // is untouched — so the whole difference is road length, and it is NOT proportional
  // to it: the road grew ×3.13 and the grind grew **×4.80**, because the top of a
  // longer road is spent above `trophyLossCap` where a 60% player nets 5.0 trophies a
  // match instead of the 9.0 the grace band pays.
  //
  //   half the roster  94 -> 296 matches      (bound 240 -> 400)
  //   full roster     394 -> 1,891 matches    (bound 600 -> 2,400)
  //
  // The new bounds are ~1.35x and ~1.27x the measured figure. That is deliberate and it
  // is TIGHTER than what it replaces (240 was 2.55x of 94): these are single-seed
  // deterministic numbers whose seed-to-seed cv is 5.30%, measured over 40 seeds by
  // `tools/tmp/tr_road_probe.mjs --seatnull 40`, so 1.27x is about five sd of headroom —
  // loose enough that no reseeding reddens it, tight enough to catch a real regression.
  // A bound at 2.55x of the new figure would be 4,800 matches and could not fail.
  check('HALF the roster inside 400 matches', halfAt !== undefined && halfAt <= 400, `${halfAt} matches`);
  check('FULL roster inside 2400 matches', lastAt !== undefined && lastAt <= 2400, `${lastAt} matches`);
  check('full roster is not trivial (>= 150 matches)', lastAt >= 150, `${lastAt} matches`);
  check('the whole road is completable without spending a penny', run.complete,
    `stopped at ${run.matches} matches`);

  // Unlock cadence. Two separate properties, and mixing them up hides real defects:
  //
  //   * The TROPHY gaps are the design and are deterministic. A curve that steps
  //     60, 70, 90, 125 reads as gently accelerating; one that steps 60, 70, 90, 600
  //     reads as a paywall. Asserted exactly.
  //   * The MATCH gaps are what the player feels, and they carry the simulation's
  //     randomness, so they only get the loose end-of-road bound.
  const charThresholds = TROPHY_ROAD.filter((m) => m.reward.type === 'character').map((m) => m.trophies);
  const trophyGaps = charThresholds.map((t, i) => t - (i === 0 ? 0 : charThresholds[i - 1]));
  check('trophy gaps between characters never shrink',
    trophyGaps.every((g, i) => i === 0 || g >= trophyGaps[i - 1]), trophyGaps.join(','));
  check('no trophy gap more than 1.6x the one before it — no wall',
    trophyGaps.every((g, i) => i === 0 || g <= trophyGaps[i - 1] * 1.6), trophyGaps.join(','));

  const gaps = order.map((id, i) => run.unlockedAt.get(id) - (i === 0 ? 0 : run.unlockedAt.get(order[i - 1])));
  check('measured unlock gaps trend upward (no regression in pacing)',
    gaps.every((g, i) => i === 0 || g >= gaps[i - 1] * 0.7), gaps.join(','));
  // ⚠️ WAS `< 150`, ON THE 3,200 ROAD, WHERE THE LAST GAP MEASURED ~110 MATCHES.
  // The final character gap is 3,250 trophies of a 10,000 road (32.5%, where it was
  // 19.4%) and measures **609 matches**. That tail share is forced, not chosen: with the
  // character gaps required to be non-decreasing, the last of ten gaps summing to 10,000
  // can never be below the mean of 1,000, and holding the first unlock early forces the
  // curve near-geometric — see the note on donut moving 60 -> 100 in `tuning.ts`.
  // Bound set at 800, ~1.31x the measured value, the same headroom as the two above.
  check('the last unlock gap is under 800 matches', gaps[gaps.length - 1] < 800, `${gaps[gaps.length - 1]}`);

  // A weaker player must still progress rather than stall forever.
  const weak = simulate(0.45, 8000);
  const weakFirst = weak.unlockedAt.get(order[0]);
  check('a 45% player still reaches the first character', weakFirst !== undefined && weakFirst <= 40,
    `${weakFirst} matches`);
  console.log(`     45% player: first=${weakFirst}, unlocked ${weak.unlockedAt.size}/${order.length} in ${weak.matches} matches`);

  // The grace band must actually protect a new player from going backwards.
  const rough = createEconomy(7);
  for (let i = 0; i < 10; i++) applyMatchResult(rough, false);
  check('ten straight losses from zero cost no trophies', rough.trophies === 0);
  check('...but still pay coins', rough.coins === STARTING_BALANCE.coins + 10 * MATCH_PAYOUT.coinsLoss);
}

// ─────────────────────────────────────────────────────────────────────────────
// 10. Persistence
// ─────────────────────────────────────────────────────────────────────────────

console.log('\n10. Persistence');
{
  const s = seeded(8080);
  for (let i = 0; i < 20; i++) applyMatchResult(s, i % 3 !== 0);
  claimAll(s);
  s.containers.fireBox = 2;

  const round = deserialize(JSON.parse(JSON.stringify(serialize(s))));
  check('a round trip preserves trophies', round.trophies === s.trophies);
  check('a round trip preserves balances', round.coins === s.coins && round.gems === s.gems);
  check('a round trip preserves containers',
    JSON.stringify(round.containers) === JSON.stringify(s.containers));
  check('a round trip preserves claims', JSON.stringify(round.claimed) === JSON.stringify(s.claimed));
  check('a round trip preserves unlocks', JSON.stringify(round.unlocked) === JSON.stringify(s.unlocked));
  check('a round trip preserves the RNG stream', round.seed === s.seed && round.rolls === s.rolls);
  check('a round trip preserves the last match',
    JSON.stringify(round.lastMatch) === JSON.stringify(s.lastMatch));

  check('null deserialises to a fresh economy', deserialize(null).trophies === 0);
  check('a string deserialises to a fresh economy', deserialize('nope').coins === STARTING_BALANCE.coins);
  check('garbage fields are rejected field by field', (() => {
    const g = deserialize({ trophies: -50, coins: 'lots', gems: NaN, claimed: 'no', unlocked: 42, rolls: -1 });
    return g.trophies === 0 && g.coins === STARTING_BALANCE.coins && g.gems === STARTING_BALANCE.gems
      && g.claimed.length === 0 && g.unlocked.length === 1 && g.rolls === 0;
  })());
  check('an unknown character in the blob is dropped',
    deserialize({ unlocked: [STARTER_CHARACTER, 'spaghetti'] }).unlocked.length === 1);
  check('bestTrophies is repaired if it is below trophies',
    deserialize({ trophies: 900, bestTrophies: 10 }).bestTrophies === 900);
  check('a duplicated unlock in the blob is collapsed',
    deserialize({ unlocked: [STARTER_CHARACTER, STARTER_CHARACTER] }).unlocked.length === 1);
  check('a zero seed is replaced rather than kept',
    deserialize({ seed: 0 }).seed !== 0);
  // A milestone retuned out of the table must not linger as a claim on a threshold
  // that no longer exists, and the node that replaced it must be claimable.
  check('a claimed threshold that is no longer on the road is dropped',
    deserialize({ claimed: [TROPHY_ROAD[0].trophies, 999999] }).claimed.length === 1,
    JSON.stringify(deserialize({ claimed: [TROPHY_ROAD[0].trophies, 999999] }).claimed));

  // ── THE 10,000 RESHAPE, FROM AN EXISTING PLAYER'S SIDE ─────────────────────
  //
  // Uri's road change moved 33 of 34 thresholds. The one question that matters is
  // whether a player mid-progression can lose a chef they already earned, and the
  // answer is structural rather than lucky: `unlocked` is persisted as its own list of
  // character ids and `deserialize` restores it independently of `TROPHY_ROAD`. The
  // road is not the record of what you own; it is the record of where you got it.
  //
  // ⚠️ This is asserted with a HAND-WRITTEN OLD BLOB, not with `serialize(createEconomy())`.
  // A round trip through today's code cannot express the bug — it would write today's
  // thresholds and read them back, so the check would pass on a build that drops every
  // legacy save on the floor. The blob below carries the 3,200-road thresholds as
  // literals precisely because they are the ones that no longer exist.
  {
    const OLD_ROAD_THRESHOLDS = [10, 25, 42, 60, 85, 107, 130, 160, 190, 220, 260, 300,
      345, 400, 455, 510, 580, 650, 725, 815, 905, 1000, 1105, 1220, 1340, 1485];
    const OLD_UNLOCKED = ['hamburger', 'donut', 'taco', 'burrito', 'soup', 'sushi',
      'waterbottle', 'pizza', 'egg'];
    const migrated = deserialize({
      trophies: 1500, bestTrophies: 1500, coins: 3000, gems: 40,
      claimed: OLD_ROAD_THRESHOLDS, unlocked: OLD_UNLOCKED,
      winsTowardChest: 1, seed: 12345, rolls: 4,
    });
    check('a pre-10,000 save keeps EVERY character it had earned',
      OLD_UNLOCKED.every((id) => migrated.unlocked.includes(id)),
      `lost: ${OLD_UNLOCKED.filter((id) => !migrated.unlocked.includes(id)).join(', ') || 'none'}`);
    check('...and its trophy standing is untouched', migrated.trophies === 1500);
    // The thresholds moved, so the claims against them are correctly dropped: a claim on
    // a node that no longer exists must not linger, and the node that replaced it must be
    // claimable. That is the forgiving direction and it is a WINDFALL, never a loss.
    check('...and claims against thresholds that no longer exist are dropped',
      migrated.claimed.length === 0, JSON.stringify(migrated.claimed));
    const reclaimable = TROPHY_ROAD.filter((m) => m.trophies <= migrated.trophies);
    check('...leaving the nodes below their standing claimable again', reclaimable.length > 0,
      `${reclaimable.length} nodes`);
    // The one thing a re-claim must NOT do is hand back a character they already own.
    // `resolveReward` substitutes duplicate coins, so the windfall is currency only.
    //
    // ⚠️ NAME THE BRANCH THIS IS EXERCISING, because it is not the obvious one.
    // `ROSTER_GATED` is FALSE in the shipped tree, so every character already counts as
    // owned and this rides `resolveReward`'s `else` — the ungated duplicate-value path.
    // Under `ROSTER_GATED = true` the same assertion would ride the `!owned.has(...)`
    // branch instead. Both encode the same property, but a known-bad planted on the
    // GATED branch is planted where the bug cannot express itself today and passes
    // vacuously — which is exactly what happened when this was first checked.
    const windfall = claimAll(migrated);
    check('...and re-claiming a character node they already own pays COINS, not a duplicate chef',
      windfall.characters.length === 0 && windfall.coins > 0,
      `chars [${windfall.characters.join(', ')}], ${windfall.coins} coins`);
    check('...and the roster is exactly what it was before the re-claim',
      migrated.unlocked.length === OLD_UNLOCKED.length, `${migrated.unlocked.length}`);
  }

  const legacy = createEconomy(1);
  adoptLegacyBalance(legacy, { coins: 4321, gems: 99 });
  check('a pre-economy profile blob keeps its balance', legacy.coins === 4321 && legacy.gems === 99);
  adoptLegacyBalance(legacy, { coins: 'bad' });
  check('a bad legacy balance is ignored', legacy.coins === 4321);
}

// ─────────────────────────────────────────────────────────────────────────────
// 11. The real-money store — modelled, priced, NOT LIVE
// ─────────────────────────────────────────────────────────────────────────────

console.log('\n11. Real-money store');
{
  check('the store is NOT available', STORE_AVAILABLE === false && storeAvailable() === false);
  check('products exist to be modelled anyway', storeProducts().length > 0);
  check('every product has an integer cent price',
    STORE_PRODUCTS.every((p) => Number.isInteger(p.priceUsdCents) && p.priceUsdCents > 0));
  check('every product grants gems', STORE_PRODUCTS.every((p) => p.gems > 0));
  check('no product sells a chest',
    STORE_PRODUCTS.every((p) => !p.container || p.container.kind !== 'chest'));
  check('no product sells a character directly',
    STORE_PRODUCTS.every((p) => !('characters' in p)));

  const packs = STORE_PRODUCTS.filter((p) => !p.oneTime);
  const rates = packs.map((p) => p.gems / (p.priceUsdCents / 100));
  check('gems-per-dollar rises with tier', rates.every((r, i) => i === 0 || r >= rates[i - 1]),
    rates.map((r) => r.toFixed(1)).join(' < '));
  check('the cheapest tier has no bonus badge', bonusPercent(packs[0]) === 0);
  check('the top tier advertises a real bonus', bonusPercent(packs[packs.length - 1]) > 0,
    `${bonusPercent(packs[packs.length - 1])}%`);
  check('prices format as currency', formatPrice(499) === '$4.99' && formatPrice(4999) === '$49.99');

  // Fulfilment — the function a payment webhook would call.
  const s = seeded();
  const before = { coins: s.coins, gems: s.gems };
  grantReward(s, grantProduct('starterBundle'));
  const bundle = STORE_PRODUCTS.find((p) => p.id === 'starterBundle');
  check('fulfilment credits gems', s.gems === before.gems + bundle.gems);
  check('fulfilment credits coins', s.coins === before.coins + bundle.coins);
  check('fulfilment credits the container',
    s.containers[bundle.container.kind] === bundle.container.count);
  check('fulfilling an unknown product grants nothing', (() => {
    const t = seeded();
    grantReward(t, grantProduct('not-a-product'));
    return t.coins === STARTING_BALANCE.coins && t.gems === STARTING_BALANCE.gems;
  })());
}

// ─────────────────────────────────────────────────────────────────────────────
// 13. CHARACTER LEVELS 1-15 — the model, the sink, and the reload
// ─────────────────────────────────────────────────────────────────────────────

console.log('\n13. Character levels');
{
  const CHEAPEST = CHARACTER_IDS.find((id) => CHARACTERS[id].rarity === 'Normal');
  const DEAREST = CHARACTER_IDS.find((id) => CHARACTERS[id].rarity === 'Cyber');

  // ── (a) The ladder's shape ────────────────────────────────────────────────
  check('a fresh player is level 1 on every character',
    CHARACTER_IDS.every((id) => characterLevel(seeded(), id) === LEVEL_MIN));

  check('a maxed character has no next price — null, not zero',
    levelUpCost(CHEAPEST, LEVEL_MAX) === null && levelUpCost(CHEAPEST, LEVEL_MAX + 5) === null);

  const ladder = [];
  for (let n = LEVEL_MIN; n < LEVEL_MAX; n++) ladder.push(levelUpCost(CHEAPEST, n).coins);
  check(`the ladder has exactly ${LEVEL_MAX - LEVEL_MIN} rungs`, ladder.length === LEVEL_MAX - LEVEL_MIN);
  check('every rung costs more than the one before it — no free or flat level',
    ladder.every((c, i) => i === 0 || c > ladder[i - 1]), ladder.join(','));
  check('every price is a positive whole number of coins',
    ladder.every((c) => Number.isInteger(c) && c > 0));

  // ── (b) RARITY PAYS FOR ITSELF IN COST, NOT IN POWER ──────────────────────
  //
  // Uri: "Match how common games do it. There is a reason for it." In Brawl Stars and
  // Clash Royale rarity governs ACQUISITION and UPGRADE COST, never strength at equal
  // level — because rarity-as-power is pay-to-win and cannot be closed by skill, which
  // is fatal in the humans-vs-humans game §22 says this is becoming. `rules.ts` holds
  // the other half (tiers comparable at equal level); this is the half that lives here.
  const byTier = RARITY_ORDER.map((tier) => {
    const id = CHARACTER_IDS.find((c) => CHARACTERS[c].rarity === tier);
    return id ? { tier, id, coins: costToMax(id).coins } : null;
  }).filter(Boolean);
  // ⚠️ INVERTED, NOT DELETED. These two asserted the OPPOSITE rule until `DECISIONS §26`:
  //
  //     'cost to max RISES with rarity, tier by tier'
  //     'the rarest character costs at least 3x the commonest to max'
  //
  // They were correct for the design in force when they were written — rarity granted
  // power, so it was paid for in upgrade cost, Clash-Royale style. §24b reversed
  // rarity-as-power (it is pay-to-win in a game heading for humans-vs-humans, and it is the
  // one imbalance skill cannot close), which left the cost ladder as a PURE PENALTY: same
  // power, 4.5x the price. Two independent routes then agreed it should go — Uri's own
  // reference plate shows rarity carrying no mechanical job at all, and a kit pass proved by
  // measurement that rarity could not be given a distinctiveness job either.
  //
  // The old wording is kept above so the reversal is legible in the file rather than only in
  // the git log. This is the fifth assertion this project has inverted rather than dropped.
  check('cost to max is IDENTICAL across every rarity tier',
    byTier.every((row) => row.coins === byTier[0].coins),
    byTier.map((r) => `${r.tier} ${r.coins.toLocaleString()}`).join(' · '));
  check('no tier is cheaper or dearer to max than any other — rarity buys acquisition, not price',
    Math.max(...byTier.map((r) => r.coins)) === Math.min(...byTier.map((r) => r.coins)),
    `spread ${Math.max(...byTier.map((r) => r.coins)) - Math.min(...byTier.map((r) => r.coins))} coins`);

  // ── (b2) THE DISCLOSURE SENTENCE MUST AGREE WITH THE TABLE ABOVE IT ───────
  //
  // `RARITY_MEANING` is rendered on the drop-rate sheet by BOTH `shop.ts` and
  // `trophyRoad.ts` — the one surface this product treats as a legal disclosure. It told
  // players rarity sets "how much it costs to level up" for a full commit AFTER §26 made
  // that false, in the same file whose comment three lines above it already said it was
  // false. Nothing caught it because nothing DERIVED the sentence from the constant. The
  // inverted assertions above guarded the number and left the prose describing it
  // unguarded, which is the whole lesson: flattening a constant is never just a constant.
  //
  // ⚠️ THIS IS A PROSE GUARD, AND PROSE GUARDS ARE BRITTLE. It is written as a pure
  // function of (sentence, multiplier map) for exactly one reason: so it can be run
  // against KNOWN-BAD inputs below. A guard that has not been shown to FAIL on the bug it
  // guards against is not a guard. Reword the sentence freely — but keep one of the two
  // phrasings it recognises, or teach it yours; a silent non-match is caught by the
  // "says exactly one of the two" clause rather than passing vacuously.
  const CLAIMS_COST = /\band how much it costs to level/i;  // rarity DOES set levelling cost
  const DENIES_COST = /\bnot what it costs to level/i;      // rarity does NOT
  function disclosureAgrees(sentence, multipliers) {
    const varies = new Set(Object.values(multipliers)).size > 1;
    const claims = CLAIMS_COST.test(sentence);
    const denies = DENIES_COST.test(sentence);
    if (claims === denies) return false;  // must say exactly one of them, never both/neither
    return varies ? claims : denies;
  }
  check('the drop-rate sheet sentence agrees with LEVEL_UP.rarityCostMultiplier',
    disclosureAgrees(RARITY_MEANING, LEVEL_UP.rarityCostMultiplier), RARITY_MEANING);

  const FLAT_MULT = { Normal: 1, Rare: 1, Epic: 1, Legendary: 1, Neon: 1, Cyber: 1 };
  const OLD_LADDER = { Normal: 1, Rare: 1.35, Epic: 1.8, Legendary: 2.45, Neon: 3.3, Cyber: 4.5 };
  const SHIPPED_WRONG = 'Rarity sets how hard a fighter is to find and how much it costs to '
    + 'level up — not how strong it is. Two fighters at the same level are a fair fight '
    + 'whatever their rarity.';
  check('...and REJECTS the exact sentence that shipped wrong (flat costs, cost claimed)',
    disclosureAgrees(SHIPPED_WRONG, FLAT_MULT) === false);
  check('...and REJECTS today\'s sentence if the cost ladder ever comes back',
    disclosureAgrees(RARITY_MEANING, OLD_LADDER) === false);
  check('...and ACCEPTS the old sentence under the old ladder it was written for',
    disclosureAgrees(SHIPPED_WRONG, OLD_LADDER) === true);
  check('...and rejects a sentence that makes neither claim (no vacuous pass)',
    disclosureAgrees('Rarity decides which fighters you find.', FLAT_MULT) === false);

  // ── (b3) THE COIN FIGURES `tuning.ts` QUOTES IN PROSE, ASSERTED ──────────
  //
  // Same defect class, one level up: that file's trophy-road block quoted "a Cyber costs
  // 201,460" — a price nothing charges since §26 — next to a Normal figure that was still
  // right, so the paragraph read as verified. These two pin the numbers it now quotes, so
  // a move in `baseCoins` or `growth` reddens a gate instead of silently rotting a comment.
  check('the 44,770 quoted for maxing ONE character is what the model charges',
    costToMax(CHEAPEST).coins === 44770, `${costToMax(CHEAPEST).coins}`);
  check('the 492,470 quoted for maxing the WHOLE roster is what the model charges',
    CHARACTER_IDS.reduce((a, id) => a + costToMax(id).coins, 0) === 492470,
    `${CHARACTER_IDS.reduce((a, id) => a + costToMax(id).coins, 0)}`);

  // ── (c) A total the player can verify by adding up their own receipts ─────
  //
  // Summed, never closed-form: the closed form of a ROUNDED geometric series is not the
  // sum of the rounded terms, and the player pays the terms. A headline total the
  // purchases do not add up to is `DECISIONS §13`'s defect in miniature.
  const stepwise = ladder.reduce((a, b) => a + b, 0);
  check('costToMax equals the sum of every individual upgrade',
    costToMax(CHEAPEST).coins === stepwise, `${costToMax(CHEAPEST).coins} vs ${stepwise}`);
  check('a zero-length span costs nothing',
    totalLevelCost(CHEAPEST, 5, 5).coins === 0 && totalLevelCost(CHEAPEST, 9, 3).coins === 0);
  check('a partial span is the matching slice of the ladder',
    totalLevelCost(CHEAPEST, LEVEL_MIN, LEVEL_MIN + 3).coins === ladder[0] + ladder[1] + ladder[2]);

  // ── (d) Buying one ────────────────────────────────────────────────────────
  {
    const s = seeded();
    const price = nextLevelPrice(s, CHEAPEST);
    s.coins = price.coins;
    check('an affordable upgrade is available', canLevelUp(s, CHEAPEST));
    const got = levelUp(s, CHEAPEST);
    check('levelling returns the new level and what it cost',
      got !== null && got.level === LEVEL_MIN + 1 && got.spent.coins === price.coins, JSON.stringify(got));
    check('the coins are actually taken', s.coins === 0);
    check('the level is recorded', characterLevel(s, CHEAPEST) === LEVEL_MIN + 1);
    check('the next level costs more than the one just bought',
      nextLevelPrice(s, CHEAPEST).coins > price.coins);
    check('only that character moved',
      CHARACTER_IDS.every((id) => id === CHEAPEST || characterLevel(s, id) === LEVEL_MIN));
  }

  // ── (e) Every refusal changes NOTHING. This is the atomicity property. ────
  //
  // ⚠️ Load-bearing beyond the obvious: the router writes `?screen=<name>` and a
  // mid-match reload restarts the match, so an upgrade can be interrupted by a page load
  // at any moment. The only durable record is the blob `serialize()` writes AFTER
  // `levelUp` returns — so as long as the spend and the grant cannot separate, no reload
  // can charge a player for a level they did not get, or hand them one they did not buy.
  {
    const s = seeded();
    s.coins = nextLevelPrice(s, CHEAPEST).coins - 1;
    check('an unaffordable upgrade is refused', canLevelUp(s, CHEAPEST) === false);
    check('...and returns null', levelUp(s, CHEAPEST) === null);
    check('...and takes no coins', s.coins === nextLevelPrice(s, CHEAPEST).coins - 1);
    check('...and grants no level', characterLevel(s, CHEAPEST) === LEVEL_MIN);
  }
  {
    const s = seeded();
    s.coins = 1e9;
    for (let n = LEVEL_MIN; n < LEVEL_MAX; n++) levelUp(s, CHEAPEST);
    check('a character can be walked all the way to the cap',
      characterLevel(s, CHEAPEST) === LEVEL_MAX);
    const before = s.coins;
    check('a maxed character refuses a further upgrade', levelUp(s, CHEAPEST) === null);
    check('...and is not charged for it', s.coins === before);
    check('canLevelUp is false at the cap even with infinite coins', canLevelUp(s, CHEAPEST) === false);
    check('the walk cost exactly costToMax', 1e9 - before === costToMax(CHEAPEST).coins,
      `${1e9 - before} vs ${costToMax(CHEAPEST).coins}`);
    check('coinsSpentOnLevels reconstructs the bill from the levels alone',
      coinsSpentOnLevels(s) === costToMax(CHEAPEST).coins, `${coinsSpentOnLevels(s)}`);
  }

  // ── (f) THE RELOAD. Levels are the one thing here a player PAYS for. ──────
  {
    const s = seeded(555);
    s.coins = 1e9;
    levelUp(s, CHEAPEST); levelUp(s, CHEAPEST); levelUp(s, DEAREST);
    const round = deserialize(JSON.parse(JSON.stringify(serialize(s))));
    check('levels survive a serialize/deserialize round trip',
      characterLevel(round, CHEAPEST) === LEVEL_MIN + 2 && characterLevel(round, DEAREST) === LEVEL_MIN + 1,
      JSON.stringify(round.levels));
    check('untouched characters come back at level 1',
      CHARACTER_IDS.every((id) => (id === CHEAPEST || id === DEAREST) || characterLevel(round, id) === LEVEL_MIN));
    check('level 1 is never stored — the sparse form has one spelling',
      !Object.keys(serialize(seeded()).levels).length);
  }
  check('an unknown character in the levels blob is dropped',
    Object.keys(deserialize({ levels: { spaghetti: 9 } }).levels).length === 0);
  check('a non-numeric level is dropped',
    characterLevel(deserialize({ levels: { [CHEAPEST]: 'nine' } }), CHEAPEST) === LEVEL_MIN);
  check('an over-cap level is CLAMPED, not discarded — a paid-for character never resets',
    characterLevel(deserialize({ levels: { [CHEAPEST]: 999 } }), CHEAPEST) === LEVEL_MAX);
  check('a below-floor level reads as the floor',
    characterLevel(deserialize({ levels: { [CHEAPEST]: -4 } }), CHEAPEST) === LEVEL_MIN);
  check('a missing levels field is a fresh, empty ladder',
    Object.keys(deserialize({ trophies: 10 }).levels).length === 0);

  // ── (g) Roster progress ──────────────────────────────────────────────────
  check('a fresh roster is 0% levelled', rosterLevelProgress01(seeded()) === 0);
  check('an all-maxed roster is 100% levelled', (() => {
    const s = seeded();
    for (const id of CHARACTER_IDS) s.levels[id] = LEVEL_MAX;
    return rosterLevelProgress01(s) === 1;
  })());

  // ── (h) THE OPPONENT. Uri: AI players adjust to the player's level. ──────
  check('the opponent mirrors the player at every level',
    Array.from({ length: LEVEL_MAX }, (_, i) => i + 1).every((n) => enemyLevelFor(n) === n),
    ENEMY_LEVEL_MODE);
  check('an out-of-range player level still yields a legal opponent level',
    enemyLevelFor(99) === LEVEL_MAX && enemyLevelFor(-1) === LEVEL_MIN && enemyLevelFor(NaN) === LEVEL_MIN);

  // ── (i) SOURCES AND SINKS — does the loop close? ─────────────────────────
  //
  // Levelling is by far the largest coin sink this economy has ever had, and the failure
  // it could produce is silent: a player who can never afford a second level, or one
  // whose balance still runs away because the sink is trivial. Both are measured here
  // against the SAME seeded career the pacing section runs, so retuning any price
  // reports what it did rather than hiding it.
  //
  // ⚠️ THE OPENING BALANCE IS PART OF THE LADDER, and it is a relationship between two
  // constants rather than a property of either — so it is asserted rather than commented.
  // 500 starting coins against a 300-coin first rung buys EXACTLY ONE level before a
  // single match: enough for the player to find the button, not enough for the welcome
  // gift to pay for the opening of the ladder.
  check('the starting balance buys exactly one level and no more', (() => {
    const s = seeded();
    let bought = 0;
    while (canLevelUp(s, STARTER_CHARACTER)) { levelUp(s, STARTER_CHARACTER); bought++; }
    return bought === 1;
  })(), `${STARTING_BALANCE.coins} coins vs a ${levelUpCost(STARTER_CHARACTER, LEVEL_MIN).coins} first rung`);

  {
    // ONE career, played to the end of the road, levelling the starter greedily along the
    // way. Greedy is the WORST case for the road, not the average one: it spends every
    // coin the instant it can, so if the road still completes here it completes for any
    // less aggressive spender.
    const s = createEconomy(20260805);
    const rng = createRng(20260805);
    let matches = 0;
    let firstUpgradeAt = null;
    let maxedStarterAt = null;
    let roadDoneAt = null;
    const LIMIT = 6000;
    while (matches < LIMIT && (roadDoneAt === null || maxedStarterAt === null)) {
      matches++;
      applyMatchResult(s, rng.next() < 0.60);
      claimAll(s);
      while (canLevelUp(s, STARTER_CHARACTER)) {
        levelUp(s, STARTER_CHARACTER);
        if (firstUpgradeAt === null) firstUpgradeAt = matches;
        if (characterLevel(s, STARTER_CHARACTER) === LEVEL_MAX && maxedStarterAt === null) maxedStarterAt = matches;
      }
      if (roadDoneAt === null && s.claimed.length === TROPHY_ROAD.length) roadDoneAt = matches;
    }
    const hrs = (m) => (m === null ? 'n/a' : `${((m * SECONDS_PER_MATCH) / 3600).toFixed(1)} h`);
    console.log(`     LEVELS, greedy on the starter: first upgrade match ${firstUpgradeAt}`
      + `  ·  road complete match ${roadDoneAt} (~${hrs(roadDoneAt)})`
      + `  ·  Lv${LEVEL_MAX} at match ${maxedStarterAt} (~${hrs(maxedStarterAt)})`);
    console.log(`     cost to max: ${RARITY_ORDER.map((t) => {
      const id = CHARACTER_IDS.find((c) => CHARACTERS[c].rarity === t);
      return id ? `${t} ${costToMax(id).coins.toLocaleString()}` : null;
    }).filter(Boolean).join(' · ')}`);

    check('the FIRST upgrade lands in the first sitting (<= 12 matches)',
      firstUpgradeAt !== null && firstUpgradeAt <= 12, `${firstUpgradeAt} matches`);
    check('maxing ONE character is reachable without spending a penny',
      maxedStarterAt !== null, `not reached in ${LIMIT} matches`);
    check('levelling does NOT starve the road — the road still completes on a greedy career',
      roadDoneAt !== null, `${s.claimed.length}/${TROPHY_ROAD.length} claimed in ${LIMIT} matches`);
    // ── ⚠️ THIS PAIR ASSERTED THE OPPOSITE AND URI'S 10,000 ROAD REVERSED IT ───────
    //
    // Old wording, kept per house style:
    //   check('maxing one character is a bigger project than finishing the road',
    //     maxedStarterAt > roadDoneAt, ...)
    //   check('...but not an absurd one (inside 4x the road)',
    //     maxedStarterAt < roadDoneAt * 4, ...)
    //
    // On the 3,200 road these were 590 vs 577 matches — the same size, which is why
    // `tuning.ts` called them the same size. On the 10,000 road they are **709 vs 1,747**:
    // the ROAD is now the long project, by 2.46x. Not one level price moved; `costToMax`
    // is the same 44,770 it was. The road simply became the bigger thing.
    //
    // ⚠️ Note the second check would have gone on passing after the reversal, silently and
    // vacuously: `709 < 1747 * 4` is true, and stays true for any road length, so it stops
    // bounding anything the moment the first one flips. A guard whose subject has swapped
    // sides is not a guard that got easier — it is one that has nothing left to say.
    check('finishing the road is a bigger project than maxing one character',
      roadDoneAt > maxedStarterAt, `road at ${roadDoneAt}, max at ${maxedStarterAt}`);
    check('...but not an absurd one (the road is inside 4x maxing one character)',
      roadDoneAt < maxedStarterAt * 4, `road at ${roadDoneAt}, max at ${maxedStarterAt}`);
  }

  // The sink must be REAL: a player who never levels should end up sitting on a balance
  // the leveller does not have. If the two are close, levelling is not a sink and coins
  // still have nowhere to go — which was the state of this economy before §22.
  {
    const idle = createEconomy(20260805);
    const rngA = createRng(20260805);
    for (let i = 0; i < 400; i++) { applyMatchResult(idle, rngA.next() < 0.60); claimAll(idle); }
    const spender = createEconomy(20260805);
    const rngB = createRng(20260805);
    for (let i = 0; i < 400; i++) {
      applyMatchResult(spender, rngB.next() < 0.60);
      claimAll(spender);
      while (canLevelUp(spender, STARTER_CHARACTER)) levelUp(spender, STARTER_CHARACTER);
    }
    console.log(`     400 matches: never levelling -> ${idle.coins.toLocaleString()} coins`
      + `  ·  levelling the starter -> ${spender.coins.toLocaleString()} coins, Lv${characterLevel(spender, STARTER_CHARACTER)}`);
    check('levelling absorbs at least 70% of a balance that would otherwise just pile up',
      spender.coins < idle.coins * 0.3, `${spender.coins} vs ${idle.coins}`);
    check('...and the two careers earned identically, so the gap IS the sink',
      idle.trophies === spender.trophies);
    check('every coin the spender is missing is accounted for by levels bought',
      idle.coins - spender.coins === coinsSpentOnLevels(spender),
      `${idle.coins - spender.coins} vs ${coinsSpentOnLevels(spender)}`);
  }
}

// ─────────────────────────────────────────────────────────────────────────────
// 12. Reward helpers
// ─────────────────────────────────────────────────────────────────────────────

console.log('\n12. Reward helpers');
{
  const a = emptyReward();
  mergeReward(a, { coins: 10, gems: 1, containers: { chest: 1 }, characters: ['donut'] });
  mergeReward(a, { coins: 5, gems: 0, containers: { chest: 2, fireBox: 1 }, characters: ['donut', 'taco'] });
  check('merge sums currency', a.coins === 15 && a.gems === 1);
  check('merge sums containers', a.containers.chest === 3 && a.containers.fireBox === 1);
  check('merge dedupes characters', a.characters.length === 2);

  const lines = describeReward(a);
  check('characters are described first', lines[0].label === CHARACTERS.donut.name);
  check('every part of the reward is described', lines.length === 6, JSON.stringify(lines));
  check('a single unit is singular', describeReward({
    coins: 1, gems: 1, containers: { chest: 1 }, characters: [],
  }).map((l) => l.label).join('/') === 'Chest/1 Coin/1 Gem');
  check('describing an empty reward gives no lines', describeReward(emptyReward()).length === 0);

  check('pluralise handles both container name shapes',
    pluralise('Chest', 2) === 'Chests' && pluralise('Hamburger Box', 2) === 'Hamburger Boxes'
    && pluralise('Chest', 1) === 'Chest');
}

// ─────────────────────────────────────────────────────────────────────────────

console.log(`\n${pass} passed, ${fail} failed`);
if (fail > 0) {
  console.log('\nFailed checks:');
  for (const f of failures) console.log(`  - ${f}`);
  process.exit(1);
}
