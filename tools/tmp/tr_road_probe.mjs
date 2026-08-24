#!/usr/bin/env node
/**
 * TROPHY ROAD PROBE — the shape of the road, and the pacing it implies.
 *
 * Uri: *"Change the trophy road to distribute the characters across 10,000 trophies.
 * When you reach 10,000 you will have all of them. Add more steps and stretch the
 * distance between steps a bit."*
 *
 * Four falsifiable properties come out of that sentence, and this tool measures all
 * four against whatever road it is handed:
 *
 *   ROSTER    every non-starter character is unlocked at or before TARGET (10,000)
 *   CAP       the LAST character lands exactly ON TARGET, and TARGET is the road end
 *   STEPS     there are MORE milestones than the road it replaces
 *   STRETCH   the gaps between milestones are WIDER than the road it replaces
 *             (min, median and mean, all three — a mean can be dragged up by one
 *             enormous tail gap while every early gap shrinks)
 *
 * ── WHY THIS IS NOT JUST READ OFF THE TABLE ─────────────────────────────────
 * Three of the four are set operations over a FILTERED set — "the character nodes",
 * "the gaps" — and `[].every()` is `true`. `CLAUDE.md` non-negotiable 6 records that
 * exact vacuity firing three times in three files in one session, always green. So
 * every predicate here is preceded by a NON-EMPTY assertion on the set it runs over,
 * and `--selftest` plants a known-bad for each arm INCLUDING an empty-set arm whose
 * whole job is to prove the guard is not vacuous.
 *
 * ── WHAT `--selftest` DOES AND DOES NOT PROVE ───────────────────────────────
 * It validates this tool's LOGIC. It says nothing about whether the tool is pointed
 * at the shipped table — that is what `--json` on the real `TROPHY_ROAD` is for, and
 * why the before/after numbers in the commit message are two runs of THIS file
 * against two commits rather than two readings of the table.
 *
 * Usage:
 *   node tools/tmp/tr_road_probe.mjs                 # human report on the live road
 *   node tools/tmp/tr_road_probe.mjs --json          # machine form, for a before/after
 *   node tools/tmp/tr_road_probe.mjs --baseline F    # diff the live road against F
 *   node tools/tmp/tr_road_probe.mjs --selftest      # the known-bad battery
 */

import { fileURLToPath, pathToFileURL } from 'node:url';
import { readFileSync, realpathSync } from 'node:fs';
import { CHARACTERS, CHARACTER_IDS } from '../../src/game/rules.ts';
import { STARTER_CHARACTER, TROPHY_ROAD, SECONDS_PER_MATCH } from '../../src/game/economy/tuning.ts';
import { createRng } from '../../src/game/economy/rng.ts';
import { applyMatchResult, claimAll, createEconomy } from '../../src/game/economy/state.ts';

/** Uri's number. The one constant in this file, and it is the ask itself. */
export const TARGET_TROPHIES = 10_000;

/** The road this one replaces — `31f481c`, measured, not typed from memory. */
export const PREVIOUS_ROAD = {
  steps: 34,
  end: 3200,
  gapMin: 10,
  gapMedian: 70,
  gapMean: 3200 / 34,
};

const RARITY_RANK = { Normal: 0, Rare: 1, Epic: 2, Legendary: 3, Neon: 4, Cyber: 5 };

function median(sorted) {
  if (sorted.length === 0) return NaN;
  const mid = sorted.length >> 1;
  return sorted.length % 2 ? sorted[mid] : (sorted[mid - 1] + sorted[mid]) / 2;
}

/**
 * Walk a reward tree for character grants. A bundle can carry one, and a filter that
 * only matches `reward.type === 'character'` misses it — which is exactly how a
 * pacing sim comes to measure nine characters and call it ten.
 */
export function charactersIn(reward, out = []) {
  if (reward.type === 'character') out.push(reward.id);
  else if (reward.type === 'bundle') for (const p of reward.parts) charactersIn(p, out);
  return out;
}

/** Every character grant on a road, in road order, with the threshold it lands at. */
export function characterUnlocks(road) {
  const out = [];
  for (const m of road) for (const id of charactersIn(m.reward)) out.push({ id, trophies: m.trophies });
  return out;
}

/**
 * The measurement. Returns numbers and a list of FAULTS; it never throws on a bad
 * road, because the known-bad arms need it to keep measuring one.
 */
export function measure(road, opts = {}) {
  const target = opts.target ?? TARGET_TROPHIES;
  const prev = opts.previous ?? PREVIOUS_ROAD;
  const roster = opts.roster ?? CHARACTER_IDS.filter((id) => id !== STARTER_CHARACTER);
  const faults = [];
  const fault = (code, msg) => { faults.push(`${code}: ${msg}`); };

  const thresholds = road.map((m) => m.trophies);
  const end = thresholds.length > 0 ? thresholds[thresholds.length - 1] : 0;
  const gaps = thresholds.map((t, i) => t - (i === 0 ? 0 : thresholds[i - 1]));
  const gapsSorted = [...gaps].sort((a, b) => a - b);

  // ── NON-EMPTY FIRST. Every predicate below runs over a filtered set. ───────
  if (road.length === 0) fault('EMPTY-ROAD', 'the road has no milestones');
  if (gaps.length === 0) fault('EMPTY-GAPS', 'no gaps to measure');
  if (roster.length === 0) fault('EMPTY-ROSTER', 'the expected character set is empty — every roster predicate below would pass vacuously');

  const unlocks = characterUnlocks(road);
  if (unlocks.length === 0) fault('EMPTY-UNLOCKS', 'no character grants on the road');

  // ── ROSTER: everyone, by target, once. ────────────────────────────────────
  const seen = new Map();
  for (const u of unlocks) if (!seen.has(u.id)) seen.set(u.id, u.trophies);
  const missing = roster.filter((id) => !seen.has(id));
  if (missing.length > 0) fault('ROSTER', `not on the road: ${missing.join(', ')}`);
  const late = [...seen.entries()].filter(([, t]) => t > target);
  if (late.length > 0) fault('LATE', `unlocked after ${target}: ${late.map(([id, t]) => `${id}@${t}`).join(', ')}`);
  const extra = [...seen.keys()].filter((id) => !roster.includes(id));
  if (extra.length > 0) fault('EXTRA', `on the road but not expected: ${extra.join(', ')}`);
  const dupes = unlocks.map((u) => u.id).filter((id, i, a) => a.indexOf(id) !== i);
  if (dupes.length > 0) fault('DUPE', `granted twice: ${[...new Set(dupes)].join(', ')}`);

  // ── CAP: the last unlock is ON the target, and the target ends the road. ──
  const lastUnlock = unlocks.length > 0 ? unlocks[unlocks.length - 1] : null;
  if (lastUnlock && lastUnlock.trophies !== target) {
    fault('CAP', `the last character (${lastUnlock.id}) lands at ${lastUnlock.trophies}, not ${target}`);
  }
  if (end !== target) fault('END', `the road ends at ${end}, not ${target}`);

  // ── ORDER: strictly increasing, integral, positive. ───────────────────────
  let ascending = true;
  for (let i = 1; i < thresholds.length; i++) if (thresholds[i] <= thresholds[i - 1]) ascending = false;
  if (!ascending) fault('ORDER', `thresholds are not strictly increasing: ${thresholds.join(',')}`);
  if (!thresholds.every((t) => Number.isInteger(t) && t > 0)) fault('INT', 'a threshold is not a positive integer');

  // ── STEPS and STRETCH, both against the road being replaced. ──────────────
  if (road.length <= prev.steps) fault('STEPS', `${road.length} milestones is not MORE than ${prev.steps}`);
  const gapMin = gapsSorted[0];
  const gapMed = median(gapsSorted);
  const gapMean = end / Math.max(1, road.length);
  if (!(gapMin > prev.gapMin)) fault('STRETCH-MIN', `smallest gap ${gapMin} is not wider than ${prev.gapMin}`);
  if (!(gapMed > prev.gapMedian)) fault('STRETCH-MED', `median gap ${gapMed} is not wider than ${prev.gapMedian}`);
  if (!(gapMean > prev.gapMean)) fault('STRETCH-MEAN', `mean gap ${gapMean.toFixed(1)} is not wider than ${prev.gapMean.toFixed(1)}`);

  // ── Rarity must climb, or the ladder means nothing (and §26 says rarity is
  //    ACQUISITION rarity only — the climb is scarcity, never power).
  const rarities = [...seen.keys()].map((id) => (CHARACTERS[id] ? RARITY_RANK[CHARACTERS[id].rarity] : -1));
  let rarityClimbs = true;
  for (let i = 1; i < rarities.length; i++) if (rarities[i] < rarities[i - 1]) rarityClimbs = false;
  if (rarities.includes(-1)) fault('UNKNOWN-CHAR', 'a road character is not in CHARACTERS');
  else if (!rarityClimbs) fault('RARITY', `rarity does not climb: ${[...seen.keys()].map((id) => `${id}(${CHARACTERS[id].rarity})`).join(' -> ')}`);

  // ── The character-to-character curve (what §9 asserts). ───────────────────
  const charT = [...seen.values()];
  const charGaps = charT.map((t, i) => t - (i === 0 ? 0 : charT[i - 1]));
  const charRatios = charGaps.map((g, i) => (i === 0 ? null : g / charGaps[i - 1]));

  return {
    target,
    steps: road.length,
    end,
    characters: seen.size,
    characterThresholds: charT,
    characterGaps: charGaps,
    characterGapRatios: charRatios,
    maxCharacterGapRatio: charRatios.filter((r) => r !== null).reduce((a, b) => Math.max(a, b), 0),
    gapMin,
    gapMedian: gapMed,
    gapMean,
    gapMax: gapsSorted[gapsSorted.length - 1],
    gaps,
    tailShare: end > 0 ? charGaps[charGaps.length - 1] / end : NaN,
    faults,
  };
}

/**
 * Pacing, on the same seeded model `economy.test.mjs` §9 uses — deliberately the same
 * code path, not a reimplementation, because a test that reimplements the thing it
 * checks cannot fail on a broken one.
 *
 * Reads the LIVE road through `state.ts`, so it only means anything for the tree it
 * runs in. That is the point: the before/after is two runs, not two readings.
 */
export function pace(winRate = 0.6, maxMatches = 20_000, seed = 20260804) {
  const s = createEconomy(seed);
  const rng = createRng(seed);
  const unlockedAt = new Map();
  const unlocks = characterUnlocks(TROPHY_ROAD);
  const order = unlocks.map((u) => u.id);
  if (order.length === 0) throw new Error('pace: no character unlocks on the live road');
  for (let match = 1; match <= maxMatches; match++) {
    applyMatchResult(s, rng.next() < winRate);
    claimAll(s);
    for (const u of unlocks) {
      if (!unlockedAt.has(u.id) && s.claimed.includes(u.trophies)) unlockedAt.set(u.id, match);
    }
    if (unlockedAt.size === order.length && s.claimed.length === TROPHY_ROAD.length) {
      return { order, unlockedAt, matches: match, complete: true };
    }
  }
  return { order, unlockedAt, matches: maxMatches, complete: false };
}

/**
 * THE NULL ARM FOR THE SEAT-COUNT SPREAD, RE-DERIVED ON WHATEVER ROAD THIS TREE HOLDS.
 *
 * `economy.test.mjs` bounds "does seating 2..6 move road completion?" against the
 * run-to-run spread the arm already has at ONE seat count. That bound was `2 sd = 102`
 * matches, and the 51 came from a 12-seed career on the 3,200-trophy road.
 *
 * 🚨 **AN ABSOLUTE MATCH COUNT IS THE WRONG UNIT FOR THAT BOUND AND A LONGER ROAD
 * EXPOSES IT.** A run-to-run sd is roughly proportional to the length of the career it
 * measures, so carrying 102 across a ×3.1 road silently tightens the test by ×3.1 — the
 * bound looks unchanged and has become three times as strict. `CLAUDE.md` non-negotiable
 * 10: ask what the statistic IS before reaching for a number that describes a different
 * one. So the null is re-measured here, on this road, with the seat count HELD FIXED and
 * only the seed varying — which is the only thing that isolates run-to-run noise from the
 * seat effect the test is trying to see.
 *
 * `placeFor` is duplicated from the test deliberately and that is a cost, not an
 * oversight: the test file exports nothing. It is copied VERBATIM, and `--seatnull`
 * prints the two-seat mean so it can be compared against the test's own two-seat row.
 */
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

/**
 * ⚠️ **AND `2 sd` IS THE WRONG SCALE FOR THE STATISTIC THE TEST ACTUALLY COMPUTES.**
 *
 * The test's number is `max - min` over **five** seat counts — a RANGE of five
 * correlated arms, not the deviation of one. `CLAUDE.md` non-negotiable 10 records the
 * identical mistake on seat fairness: *"the SE of any one mean says nothing about how
 * far apart six of them should land by chance… its floor had to be built by permuting
 * the seat labels and reading the null range. Reaching for the standard formula because
 * it is the standard formula is how a floor gets quoted an order of magnitude too
 * tight."* The old bound was `2 sd`, and the expected range of five normal draws is
 * about `2.33 sd` — so `2 sd` was already the wrong shape before the road moved; the
 * road moving only made it visible.
 *
 * So this builds the null the statistic deserves: run the career at a FIXED seat count
 * across many seeds, then read the distribution of `max - min` over random five-seed
 * subsets. The bound is that null's p95 — the spread five arms reach by seed alone,
 * with no seat effect present at all.
 */
export function nullRangeOfFive(runs, subset = 5, draws = 20_000, seed = 7) {
  if (runs.length < subset) throw new Error(`nullRangeOfFive: ${runs.length} runs cannot fill a ${subset}-subset`);
  const rng = createRng(seed);
  const ranges = [];
  for (let d = 0; d < draws; d++) {
    const pool = [...runs];
    let lo = Infinity; let hi = -Infinity;
    for (let k = 0; k < subset; k++) {
      const i = Math.floor(rng.next() * pool.length);
      const v = pool.splice(i, 1)[0];
      if (v < lo) lo = v;
      if (v > hi) hi = v;
    }
    ranges.push(hi - lo);
  }
  ranges.sort((a, b) => a - b);
  const at = (p) => ranges[Math.min(ranges.length - 1, Math.floor(p * ranges.length))];
  return {
    mean: ranges.reduce((a, b) => a + b, 0) / ranges.length,
    p50: at(0.5), p95: at(0.95), p99: at(0.99), max: ranges[ranges.length - 1],
  };
}

export async function seatNull(seats = 2, seeds = 12, limit = 12_000) {
  const { applyMatchPlacement } = await import('../../src/game/economy/state.ts');
  const runs = [];
  for (let k = 0; k < seeds; k++) {
    const seed = 20260811 + k * 1013;
    const s = createEconomy(seed);
    const rng = createRng(seed);
    let complete = null;
    for (let m = 1; m <= limit && complete === null; m++) {
      applyMatchPlacement(s, placeFor(rng, seats), seats);
      claimAll(s);
      if (s.claimed.length === TROPHY_ROAD.length) complete = m;
    }
    runs.push(complete);
  }
  if (runs.some((r) => r === null)) throw new Error(`seatNull: a run did not finish inside ${limit} matches`);
  const mean = runs.reduce((a, b) => a + b, 0) / runs.length;
  const sd = Math.sqrt(runs.reduce((a, b) => a + (b - mean) ** 2, 0) / (runs.length - 1));
  return { seats, seeds, runs, mean, sd, min: Math.min(...runs), max: Math.max(...runs) };
}

/** What the road hands over in raw currency, ignoring container contents. */
export function directPayout(road) {
  let coins = 0; let gems = 0;
  const walk = (r) => {
    if (r.type === 'coins') coins += r.amount;
    else if (r.type === 'gems') gems += r.amount;
    else if (r.type === 'bundle') r.parts.forEach(walk);
  };
  for (const m of road) walk(m.reward);
  return { coins, gems };
}

/**
 * Expected value of one container, in coins and gems, with a character outcome priced
 * at its DUPLICATE value — which is exactly what the box pays a player who already owns
 * the roster, and what `tuning.ts`'s "counting every chest, box and duplicate at
 * expected value" line has always meant.
 *
 * Derived from the same `CONTAINERS` table the roller uses, so it cannot drift from the
 * published odds. Weights are percentages and are asserted elsewhere to sum to 100;
 * this divides by the ACTUAL total rather than by 100 so a mis-summing table produces a
 * wrong-but-visible number instead of a silently rescaled one.
 */
export async function containerEV(kind) {
  const { CONTAINERS, DUPLICATE_COINS } = await import('../../src/game/economy/tuning.ts');
  const def = CONTAINERS[kind];
  if (!def) throw new Error(`containerEV: no container "${kind}"`);
  const total = def.entries.reduce((a, e) => a + e.weight, 0);
  if (!(total > 0)) throw new Error(`containerEV: ${kind} has zero total weight`);
  let coins = 0; let gems = 0;
  for (const e of def.entries) {
    const p = e.weight / total;
    coins += p * (e.coins ?? 0);
    gems += p * (e.gems ?? 0);
    if (e.characterRarity) coins += p * (DUPLICATE_COINS[e.characterRarity] ?? 0);
  }
  return { coins, gems };
}

/**
 * Everything the road hands over, in THREE separately-labelled terms, because
 * `tuning.ts`'s sentence — *"or 24,328 counting every chest, box and duplicate at
 * expected value"* — has three of them and reading it as two gets the wrong number.
 *
 * 🚨 **THE FIRST VERSION OF THIS FUNCTION OMITTED THE THIRD TERM AND WAS CONFIDENTLY
 * WRONG BY 42%.** It returned 14,168 for the road that is documented at 24,328, and
 * every intermediate it *did* compute was right: the direct payout reproduced 9,700
 * exactly, the ratio reproduced the documented 4.6×, and the chest's EV reproduced the
 * `~186 coins + ~1.5 gems` written on the chest's own definition. A wrong total assembled
 * entirely from verified parts is the hardest kind to notice, and the only thing that
 * caught it was checking the finished number against a figure someone else had written
 * down — a known-GOOD, which is the arm `--selftest` cannot supply.
 *
 *   direct      coins and gems authored on the nodes
 *   containers  every chest and box at expected value (characters inside them priced
 *               as duplicates, which is what a box pays a complete roster)
 *   duplicates  the road's own CHARACTER nodes priced as duplicates — what the road
 *               pays when `ROSTER_GATED` is false and everyone already counts as owned
 *
 * `duplicates` is the `ROSTER_GATED = false` reading and is NOT what a normal player
 * receives; a gated player gets the characters themselves, which have no coin price.
 * Both totals are returned so neither can be quoted as the other.
 */
export async function roadEV(road) {
  const { DUPLICATE_COINS } = await import('../../src/game/economy/tuning.ts');
  const direct = directPayout(road);
  let containerCoins = 0; let containerGems = 0; let containers = 0;
  let duplicateCoins = 0; let characters = 0;
  const walk = async (r) => {
    if (r.type === 'container') {
      const ev = await containerEV(r.kind);
      containerCoins += ev.coins * r.count;
      containerGems += ev.gems * r.count;
      containers += r.count;
    } else if (r.type === 'character') {
      const rarity = CHARACTERS[r.id]?.rarity;
      if (!rarity) throw new Error(`roadEV: no rarity for "${r.id}"`);
      duplicateCoins += DUPLICATE_COINS[rarity];
      characters += 1;
    } else if (r.type === 'bundle') { for (const p of r.parts) await walk(p); }
  };
  for (const m of road) await walk(m.reward);
  // NON-EMPTY FIRST: a road with no containers or no characters would make one of the
  // terms silently zero, and the total would still look like a total.
  if (containers === 0) throw new Error('roadEV: no containers on the road — the container term would be a silent zero');
  if (characters === 0) throw new Error('roadEV: no character nodes — the duplicate term would be a silent zero');
  return {
    directCoins: direct.coins,
    directGems: direct.gems,
    containerCoins,
    containerGems,
    duplicateCoins,
    containers,
    characters,
    /** What a GATED player banks in currency: direct + containers. */
    gatedCoins: direct.coins + containerCoins,
    gems: direct.gems + containerGems,
    /** The `ROSTER_GATED = false` reading — the one `tuning.ts` quotes. */
    ungatedCoins: direct.coins + containerCoins + duplicateCoins,
  };
}

// ─────────────────────────────────────────────────────────────────────────────
// KNOWN-BAD BATTERY — every arm must go RED, or the arm it guards is decoration
// ─────────────────────────────────────────────────────────────────────────────

function selftest() {
  const live = TROPHY_ROAD;
  const roster = CHARACTER_IDS.filter((id) => id !== STARTER_CHARACTER);
  let pass = 0; let fail = 0;
  const arm = (name, road, code, opts = {}) => {
    const r = measure(road, opts);
    const hit = r.faults.some((f) => f.startsWith(`${code}:`));
    if (hit) { pass++; console.log(`  ok   - ${name} -> ${code}`); } else {
      fail++;
      console.log(`  FAIL - ${name} did NOT raise ${code}; faults were [${r.faults.join(' | ') || 'none'}]`);
    }
  };

  console.log('KNOWN-BAD ARMS (each must go RED)');

  // A. a character struck off the road entirely
  arm('a character removed from the road', live.filter((m) => charactersIn(m.reward).length === 0 || charactersIn(m.reward)[0] !== roster[0]), 'ROSTER');

  // ⚠️ B AND C ARE PLANTED ON THE LAST *CHARACTER* NODE, NOT THE LAST MILESTONE, AND
  // THE FIRST DRAFT GOT THAT WRONG. It moved `live[live.length - 1]`, which on the
  // road being replaced is the capstone BUNDLE — so the arm shoved a bundle past the
  // target, no character moved, and `LATE` never fired. The arm was green-adjacent
  // for the worst possible reason: it was pointed at the wrong object, which is the
  // `valuescan` failure `CLAUDE.md` non-negotiable 6 records verbatim. A selftest
  // validates logic; nothing but reading the plant validates where it is POINTED.
  const lastCharIdx = live.map((m, i) => (charactersIn(m.reward).length ? i : -1))
    .filter((i) => i >= 0).pop();
  if (lastCharIdx === undefined) {
    fail++; console.log('  FAIL - no character node to plant arms B/C on');
  } else {
    // B. the last character parked past the target
    arm('the last CHARACTER beyond the target',
      live.map((m, i) => (i === lastCharIdx ? { ...m, trophies: TARGET_TROPHIES + 1 } : m)), 'LATE');

    // C. the last character short of the target (the honest-looking failure: everyone
    //    IS unlocked by 10,000, but nothing lands ON it)
    arm('the last CHARACTER short of the target',
      live.map((m, i) => (i === lastCharIdx ? { ...m, trophies: TARGET_TROPHIES - 1 } : m)), 'CAP');
  }

  // D. thresholds out of order
  arm('a threshold out of order', live.map((m, i) => (i === 2 ? { ...m, trophies: live[0].trophies } : m)), 'ORDER');

  // E. fewer steps than the road being replaced
  arm('fewer steps than before', live.slice(0, PREVIOUS_ROAD.steps), 'STEPS');

  // F. gaps squeezed rather than stretched — every threshold divided by four, which
  //    keeps the road perfectly legal and perfectly ascending. This is the
  //    stale-but-legal class: nothing about "is this a valid road" can see it.
  arm('gaps squeezed, road still legal',
    live.map((m) => ({ ...m, trophies: Math.max(1, Math.round(m.trophies / 4)) })), 'STRETCH-MED');

  // G. THE VACUITY ARM. An empty expected-roster makes "every character is on the
  //    road" TRUE for free. If this arm goes green the ROSTER check is decoration.
  arm('an EMPTY expected roster must not pass vacuously', live, 'EMPTY-ROSTER', { roster: [] });

  // H. an empty road — `[].every()` again, from the other side
  arm('an EMPTY road', [], 'EMPTY-ROAD');

  // I. a character hidden inside a bundle must still COUNT. Planted by moving the
  //    first character grant into a bundle: a walker that only matches
  //    `type === 'character'` reports it missing, which is the bug this catches.
  const bundled = live.map((m) => (charactersIn(m.reward)[0] === roster[0]
    ? { ...m, reward: { type: 'bundle', parts: [m.reward, { type: 'coins', amount: 1 }] } }
    : m));
  const bundledResult = measure(bundled);
  const bundleSeen = bundledResult.faults.some((f) => f.startsWith('ROSTER:'));
  if (!bundleSeen) { pass++; console.log('  ok   - a character inside a bundle still counts (no ROSTER fault)'); } else {
    fail++; console.log(`  FAIL - a bundled character was not counted: ${bundledResult.faults.join(' | ')}`);
  }

  // J. rarity ladder inverted
  const inverted = [...live];
  const idxs = inverted.map((m, i) => (charactersIn(m.reward).length ? i : -1)).filter((i) => i >= 0);
  if (idxs.length >= 2) {
    const a = idxs[0]; const b = idxs[idxs.length - 1];
    const swapped = inverted.map((m, i) => (i === a ? { ...m, reward: inverted[b].reward }
      : i === b ? { ...m, reward: inverted[a].reward } : m));
    arm('rarity ladder inverted', swapped, 'RARITY');
  }

  // ── CONTROL: the live road itself must raise NOTHING. An all-red battery that
  //    also reddens the shipped table is a broken detector, not a strict one.
  //    ⚠️ On the road being REPLACED this control is red by construction — the old
  //    road ends at 3,200 and has 34 steps, so it fails CAP/END/STEPS/STRETCH on
  //    purpose. That is the arm reporting the job is not done, not the tool being
  //    broken, and the two are only distinguishable by reading the fault list.
  const liveResult = measure(live);
  if (liveResult.faults.length === 0) { pass++; console.log('  ok   - CONTROL: the shipped road raises no fault'); } else {
    fail++; console.log(`  FAIL - CONTROL: the shipped road raises [${liveResult.faults.join(' | ')}]`);
  }

  console.log(`\n${pass} passed, ${fail} failed`);
  return fail === 0;
}

// ─────────────────────────────────────────────────────────────────────────────

function report(json) {
  const m = measure(TROPHY_ROAD);
  const p = pace();
  const payout = directPayout(TROPHY_ROAD);
  const order = m.characterThresholds;
  const first = p.unlockedAt.get(p.order[0]);
  const half = p.unlockedAt.get(p.order[Math.floor(p.order.length / 2)]);
  const full = p.unlockedAt.get(p.order[p.order.length - 1]);
  const out = {
    steps: m.steps,
    end: m.end,
    target: m.target,
    characters: m.characters,
    characterThresholds: order,
    characterGaps: m.characterGaps,
    maxCharacterGapRatio: Number(m.maxCharacterGapRatio.toFixed(3)),
    gapMin: m.gapMin,
    gapMedian: m.gapMedian,
    gapMean: Number(m.gapMean.toFixed(1)),
    gapMax: m.gapMax,
    tailShare: Number(m.tailShare.toFixed(3)),
    directCoins: payout.coins,
    directGems: payout.gems,
    matchesFirst: first ?? null,
    matchesHalf: half ?? null,
    matchesFull: full ?? null,
    matchesRoadComplete: p.complete ? p.matches : null,
    secondsPerMatch: Number(SECONDS_PER_MATCH.toFixed(1)),
    faults: m.faults,
  };
  if (json) { console.log(JSON.stringify(out, null, 2)); return out; }

  const hrs = (n) => (n === null ? 'n/a' : `${((n * SECONDS_PER_MATCH) / 3600).toFixed(1)} h`);
  console.log('TROPHY ROAD');
  console.log(`  steps            ${out.steps}   (was ${PREVIOUS_ROAD.steps})`);
  console.log(`  road end         ${out.end.toLocaleString()}   (was ${PREVIOUS_ROAD.end.toLocaleString()}; target ${out.target.toLocaleString()})`);
  console.log(`  characters       ${out.characters} of ${CHARACTER_IDS.length} (starter ${STARTER_CHARACTER} is granted, not earned)`);
  console.log(`  thresholds       ${order.join(', ')}`);
  console.log(`  char gaps        ${m.characterGaps.join(', ')}   max ratio ${out.maxCharacterGapRatio}`);
  console.log(`  step gaps        min ${out.gapMin} (was ${PREVIOUS_ROAD.gapMin}) · median ${out.gapMedian} (was ${PREVIOUS_ROAD.gapMedian}) · mean ${out.gapMean} (was ${PREVIOUS_ROAD.gapMean.toFixed(1)}) · max ${out.gapMax}`);
  console.log(`  final char gap   ${(out.tailShare * 100).toFixed(1)}% of the whole road`);
  console.log(`  direct payout    ${out.directCoins.toLocaleString()} coins · ${out.directGems.toLocaleString()} gems`);
  console.log('PACING (60% win rate, seed 20260804 — the same model as economy.test §9)');
  console.log(`  first character  ${out.matchesFirst} matches (~${hrs(out.matchesFirst)})`);
  console.log(`  half the roster  ${out.matchesHalf} matches (~${hrs(out.matchesHalf)})`);
  console.log(`  full roster      ${out.matchesFull} matches (~${hrs(out.matchesFull)})`);
  console.log(`  road complete    ${out.matchesRoadComplete} matches (~${hrs(out.matchesRoadComplete)})   [${out.secondsPerMatch}s/match]`);
  console.log(out.faults.length === 0 ? '\nFAULTS: none' : `\nFAULTS (${out.faults.length}):\n  ${out.faults.join('\n  ')}`);
  return out;
}

function diff(baselinePath) {
  const before = JSON.parse(readFileSync(baselinePath, 'utf8'));
  const after = report(true);
  const keys = ['steps', 'end', 'gapMin', 'gapMedian', 'gapMean', 'gapMax', 'directCoins',
    'directGems', 'matchesFirst', 'matchesHalf', 'matchesFull', 'matchesRoadComplete'];
  console.log('\nBEFORE -> AFTER');
  for (const k of keys) {
    const b = before[k]; const a = after[k];
    const mark = b === a ? '   ' : ' * ';
    console.log(`${mark}${k.padEnd(22)} ${String(b).padStart(10)} -> ${String(a).padStart(10)}`);
  }
}

/**
 * IS_MAIN — three tools in this repo ran a live sweep on import, so the guard is
 * mandatory. It is `realpath`-based, and the naive form cost a measurement here.
 *
 * 🚨 **AN IS_MAIN GUARD CAN FAIL *CLOSED*, AND THAT LOOKS EXACTLY LIKE SUCCESS.**
 * The first version compared `import.meta.url` to `pathToFileURL(process.argv[1])`.
 * Run from a detached worktree at `/tmp/fa-tr-old/...` — the recipe `CLAUDE.md`
 * non-negotiable 8 prescribes — `argv[1]` keeps the `/tmp` the shell was given while
 * `import.meta.url` carries the resolved `/private/tmp` (on darwin `/tmp` is a
 * symlink). The two never match, the guard declined to run, and the tool **printed
 * nothing and exited 0**. Nothing distinguishes that from a clean run except noticing
 * the empty file. The failure mode of an over-tight guard is silence, and silence is
 * the one result nobody re-checks.
 */
const argvPath = process.argv[1] ? pathToFileURL(realpathSync(process.argv[1])).href : '';
if (realpathSync(fileURLToPath(import.meta.url)) === (argvPath ? fileURLToPath(argvPath) : '')) {
  const argv = process.argv.slice(2);
  if (argv.includes('--selftest')) process.exitCode = selftest() ? 0 : 1;
  else if (argv.includes('--seatnull')) {
    const seeds = Number(argv[argv.indexOf('--seatnull') + 1]) || 12;
    const n = await seatNull(2, seeds);
    console.log(`SEAT-COUNT NULL ARM — ${n.seats} seats, ${n.seeds} seeds, seat count HELD FIXED`);
    console.log(`  road complete: ${n.runs.join(', ')}`);
    console.log(`  mean ${n.mean.toFixed(1)} · sd ${n.sd.toFixed(1)} · range ${n.min}-${n.max} (${n.max - n.min})`);
    console.log(`  cv ${((n.sd / n.mean) * 100).toFixed(2)}%   [2 sd = ${(2 * n.sd).toFixed(1)}, the OLD bound's shape]`);
    if (n.seeds >= 5) {
      const r = nullRangeOfFive(n.runs);
      console.log('  NULL RANGE OF FIVE (the statistic the test actually computes):');
      console.log(`    mean ${r.mean.toFixed(1)} · p50 ${r.p50} · p95 ${r.p95} · p99 ${r.p99} · max ${r.max}`);
      console.log(`  -> p95 = ${r.p95} matches is the bound a 5-seat-count spread must sit inside`);
    }
  } else if (argv.includes('--payout')) {
    const ev = await roadEV(TROPHY_ROAD);
    const { costToMax } = await import('../../src/game/economy/levels.ts');
    const max = costToMax(STARTER_CHARACTER).coins;
    const r = (n) => Math.round(n).toLocaleString();
    console.log('WHAT THE ROAD HANDS OVER');
    console.log(`  direct                 ${r(ev.directCoins)} coins · ${r(ev.directGems)} gems`);
    console.log(`  + ${String(ev.containers).padStart(2)} containers (EV)     ${r(ev.containerCoins)} coins · ${r(ev.containerGems)} gems`);
    console.log(`  = GATED total          ${r(ev.gatedCoins)} coins · ${r(ev.gems)} gems   (what a normal player banks)`);
    console.log(`  + ${String(ev.characters).padStart(2)} chars as duplicates ${r(ev.duplicateCoins)} coins`);
    console.log(`  = UNGATED total        ${r(ev.ungatedCoins)} coins   (the reading tuning.ts quotes)`);
    console.log(`  maxing ONE chef        ${max.toLocaleString()} coins`
      + `  ->  ${(max / ev.directCoins).toFixed(2)}x direct · ${(max / ev.gatedCoins).toFixed(2)}x gated · ${(max / ev.ungatedCoins).toFixed(2)}x ungated`);
  } else if (argv.includes('--baseline')) diff(argv[argv.indexOf('--baseline') + 1]);
  else {
    const out = report(argv.includes('--json'));
    if (out.faults.length > 0) process.exitCode = 1;
  }
}
