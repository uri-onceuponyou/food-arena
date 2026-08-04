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
 *  1. PACING (section 9). The trophy curve is a design claim — "first character in a
 *     sitting, full roster in ~15 hours". It is asserted against a seeded simulated
 *     player, so changing any number in `tuning.ts` reports exactly what it did to
 *     time-to-first-unlock and time-to-full-roster instead of quietly moving them.
 *  2. PUBLISHED ODDS (section 5). Once gems are buyable with real money, box drop
 *     rates are a legal disclosure. The empirical distribution of the seeded roller
 *     is checked against `containerOdds()` — the exact string the player is shown —
 *     so the disclosure cannot drift from the table.
 *  3. THE ROSTER CONTRACT (section 4). The set of characters on the trophy road must
 *     be exactly `CHARACTER_IDS` minus the starter. Add a 12th character to
 *     `rules.ts` and this fails until the road has a home for them.
 */

import { CHARACTERS, CHARACTER_IDS } from '../rules.ts';
import {
  CONTAINERS, CONTAINER_KINDS, DUPLICATE_COINS, MATCH_PAYOUT, ROSTER_GATED,
  STARTER_CHARACTER, STARTING_BALANCE, STORE_AVAILABLE, STORE_PRODUCTS, TROPHY_ROAD,
  CHARACTERS_BY_RARITY,
} from './tuning.ts';
import { createRng, weightedIndex } from './rng.ts';
import { containerOdds, containerOddsLine, formatPercent, rollContainer, totalWeight } from './containers.ts';
import {
  claimable, milestoneFace, nextMilestone, resolveReward, roadEnd, roadProgress,
  trophyDelta, trophyLoss,
} from './trophyRoad.ts';
import { describeReward, emptyReward, mergeReward, pluralise } from './reward.ts';
import { bonusPercent, formatPrice, grantProduct, storeAvailable, storeProducts } from './store.ts';
import {
  applyMatchResult, buyContainer, claimAll, claimMilestone, createEconomy, deserialize,
  grantReward, openContainer, ownedSet, serialize, spend, totalContainers, winsToNextChest,
  adoptLegacyBalance,
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
  const bundleNode = TROPHY_ROAD.find((m) => m.reward.type === 'bundle');
  check('the road ends on a bundle', !!bundleNode);
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

  const MIN = 2; // assumed minutes per match, including menus
  console.log(`     first=${firstAt} matches (~${(firstAt * MIN)} min)`
    + `  half=${halfAt} (~${(halfAt * MIN / 60).toFixed(1)} h)`
    + `  full=${lastAt} (~${(lastAt * MIN / 60).toFixed(1)} h)`
    + `  road complete=${run.matches} (~${(run.matches * MIN / 60).toFixed(1)} h)`);

  check('FIRST character is reachable in one sitting (<= 20 matches)',
    firstAt !== undefined && firstAt <= 20, `${firstAt} matches`);
  check('first character is not instant (>= 3 matches)', firstAt >= 3, `${firstAt} matches`);
  check('HALF the roster inside ~8 hours (<= 240 matches)',
    halfAt !== undefined && halfAt <= 240, `${halfAt} matches`);
  check('FULL roster inside ~20 hours (<= 600 matches)',
    lastAt !== undefined && lastAt <= 600, `${lastAt} matches`);
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
  check('the last unlock gap is under 150 matches', gaps[gaps.length - 1] < 150, `${gaps[gaps.length - 1]}`);

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
