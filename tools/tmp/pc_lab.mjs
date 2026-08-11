#!/usr/bin/env node
/**
 * `pc_lab` — the placement-curve lab. What a 3-to-6 seat match pays, and what changing its
 * one dial would cost.
 *
 * Built to answer `DECISIONS §57` with numbers instead of taste:
 *
 *   node tools/tmp/pc_lab.mjs                 # the shipped curve at every seat and standing
 *   node tools/tmp/pc_lab.mjs --compare       # URI'S ANSWER SHEET: three steepnesses side by side
 *   node tools/tmp/pc_lab.mjs --career        # seeded careers at 2-6 seats, with the spread
 *   node tools/tmp/pc_lab.mjs --selftest      # the known-bad battery
 *   node tools/tmp/pc_lab.mjs --steepness 1.6 # drive any of the above at another shape
 *
 * ── ⚠️ WHAT THIS TOOL IS AND IS NOT ────────────────────────────────────────────
 *
 * The CURVE half is exact arithmetic over `economy/tuning.ts` — no seeds, no sampling, no
 * resolution floor to quote. Every number in `--table` and `--compare` is reproducible to the
 * digit.
 *
 * The CAREER half is a MODEL and is labelled as one wherever it prints. Placement comes from
 * Plackett-Luce: the player carries weight `s`, the other N-1 seats carry 1.0, and the field is
 * drawn without replacement proportional to weight. `s = 1.5` is not chosen for elegance — it
 * is the value for which a two-seat field gives `1.5/(1.5+1) = 60%`, the exact win rate
 * `economy.test.mjs` section 9 already simulates. That makes the two-seat column of every
 * career table comparable to a figure the project already quotes, rather than a new one.
 *
 * 🚨 **CAREER FIGURES CARRY A SPREAD AND IT IS PRINTED.** `CLAUDE.md` non-negotiable 10: state
 * a metric's resolution floor before acting on a change in it. `economy.test.mjs` records
 * **sd 51 matches** on road-completion across 12 seeds at two seats. Every career row here runs
 * `--seeds` careers and prints mean, sd and range, and `--compare`'s verdict column refuses to
 * call a difference real unless it clears 2 sd of the two-seat arm.
 *
 * ⚠️ **AND A PER-SEAT CURVE DELTA IS A DIFFERENT QUANTITY FROM A CAREER MEAN.** The curve rows
 * are paired and exact; the career rows are a distribution. They are printed in separate
 * tables on purpose — conflating them is the trap `roster_table` fell into (aggregate moved
 * 0.8 pp inside the floor while 58 of 110 paired cells moved, max 34.4 pp).
 */

import {
  MATCH_PAYOUT, placementBanksChestWin, placementCoins, placementCurve, placementRank01,
  placementTrophyDelta, trophyLoss, TROPHY_ROAD,
} from '../../src/game/economy/index.ts';
import { applyMatchPlacement, claimAll, createEconomy } from '../../src/game/economy/state.ts';
import { createRng } from '../../src/game/economy/rng.ts';
import { MAX_FIGHTERS, MIN_FIGHTERS } from '../../src/game/state.ts';

// ─────────────────────────────────────────────────────────────────────────────
// CLI
// ─────────────────────────────────────────────────────────────────────────────

const ARGV = process.argv.slice(2);
const has = (flag) => ARGV.includes(flag);
function opt(flag, fallback) {
  const i = ARGV.indexOf(flag);
  return i >= 0 && i + 1 < ARGV.length ? ARGV[i + 1] : fallback;
}

const SEATS = [];
for (let n = MIN_FIGHTERS; n <= MAX_FIGHTERS; n++) SEATS.push(n);

/** The standings that straddle every regime of `trophyLoss`. */
const STANDINGS = [
  { t: 0, label: 'new player (grace band)' },
  { t: MATCH_PAYOUT.trophyLossGraceBelow, label: 'grace just ended' },
  { t: 500, label: 'mid road' },
  { t: 1500, label: 'loss capped' },
];

const pad = (s, n) => String(s).padStart(n);

// ─────────────────────────────────────────────────────────────────────────────
// THE CURVE — exact arithmetic, no seeds
// ─────────────────────────────────────────────────────────────────────────────

export function curveTable(steepness) {
  const out = [];
  for (const { t, label } of STANDINGS) {
    for (const n of SEATS) {
      const trophies = placementCurve(n, t, steepness);
      const coins = Array.from({ length: n }, (_, p) => placementCoins(p, n, steepness));
      const chests = Array.from({ length: n }, (_, p) => placementBanksChestWin(p, n));
      out.push({
        t, label, seats: n, trophies, coins, chests,
        mean: trophies.reduce((a, b) => a + b, 0) / n,
        evTarget: (MATCH_PAYOUT.trophiesWin - trophyLoss(t)) / 2,
        breakEven: trophies.findIndex((d) => d < 0),
      });
    }
  }
  return out;
}

function printTable(steepness) {
  console.log(`\n═══ THE CURVE at placementSteepness = ${steepness} ═══`);
  console.log('   Exact arithmetic over economy/tuning.ts. No seeds, no floor.\n');
  let lastLabel = null;
  for (const row of curveTable(steepness)) {
    if (row.label !== lastLabel) {
      lastLabel = row.label;
      console.log(`  ── ${row.label} (${row.t} trophies, a loss costs ${trophyLoss(row.t)}) ──`);
      console.log(`     seats │ trophies by place, best first                │ mean/match  (1v1 mean ${((MATCH_PAYOUT.trophiesWin - trophyLoss(row.t)) / 2).toFixed(2)})`);
    }
    const cells = row.trophies.map((d) => pad(d > 0 ? `+${d}` : d, 4)).join(' ');
    const flat = Math.abs(row.mean - row.evTarget) <= 0.2;
    console.log(`     ${pad(row.seats, 5)} │ ${cells.padEnd(44)} │ ${pad(row.mean.toFixed(3), 7)}  ${flat ? '' : '  ⚠️ OFF the 1v1 mean'}`);
  }

  console.log('\n  ── coins, which do not depend on standing ──');
  for (const n of SEATS) {
    const coins = Array.from({ length: n }, (_, p) => placementCoins(p, n, steepness));
    const mean = coins.reduce((a, b) => a + b, 0) / n;
    console.log(`     ${pad(n, 5)} │ ${coins.map((c) => pad(c, 4)).join(' ').padEnd(44)} │ ${pad(mean.toFixed(3), 7)}  (1v1 mean ${((MATCH_PAYOUT.coinsWin + MATCH_PAYOUT.coinsLoss) / 2).toFixed(2)})`);
  }

  console.log('\n  ── chest credit: a win is banked iff normalised rank < 0.5 ──');
  for (const n of SEATS) {
    const who = [];
    for (let p = 0; p < n; p++) if (placementBanksChestWin(p, n)) who.push(p + 1);
    console.log(`     ${pad(n, 5)} │ places ${who.join(',').padEnd(10)} bank a chest win  → ${(who.length / n).toFixed(3)} per match for a uniform field (1v1: 0.500)`);
  }
}

// ─────────────────────────────────────────────────────────────────────────────
// CAREERS — a MODEL, and it prints its spread
// ─────────────────────────────────────────────────────────────────────────────

/**
 * Plackett-Luce placement. Player at weight `strength`, `seats - 1` opponents at 1.0.
 *
 * At two seats this is exactly `P(win) = strength / (strength + 1)`, which is why 1.5 gives the
 * 60% the pacing section already assumes. Above two it is the standard extension: draw the
 * field one position at a time, proportional to the weights still in play.
 */
export function placeFor(rng, seats, strength) {
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

export function runCareer(seats, seed, strength, steepness, limit = 8000) {
  const s = createEconomy(seed);
  const rng = createRng(seed);
  const firstNode = TROPHY_ROAD.find((m) => m.reward.type === 'character');
  let firstChar = null;
  let complete = null;
  let trophiesEarned = 0;
  let m = 0;
  while (m < limit && complete === null) {
    m++;
    const place = placeFor(rng, seats, strength);
    // ⚠️ The steepness override cannot go through `applyMatchPlacement`, which reads the shipped
    // constant — so a non-default shape is applied by hand here, from the SAME functions the
    // game uses. Stated rather than hidden: at the default the two paths are the same code.
    if (steepness === MATCH_PAYOUT.placementSteepness) {
      const paid = applyMatchPlacement(s, place, seats);
      trophiesEarned += paid.trophies;
    } else {
      const d = placementTrophyDelta(place, seats, s.trophies, steepness);
      s.trophies = Math.max(0, s.trophies + d);
      s.bestTrophies = Math.max(s.bestTrophies, s.trophies);
      s.coins += placementCoins(place, seats, steepness);
      trophiesEarned += d;
      if (placementBanksChestWin(place, seats)) {
        s.winsTowardChest++;
        while (s.winsTowardChest >= MATCH_PAYOUT.winsPerChest) {
          s.winsTowardChest -= MATCH_PAYOUT.winsPerChest;
          s.containers.chest++;
        }
      }
    }
    claimAll(s);
    if (firstChar === null && s.claimed.includes(firstNode.trophies)) firstChar = m;
    if (s.claimed.length === TROPHY_ROAD.length) complete = m;
  }
  return { seats, seed, firstChar, complete: complete ?? limit, reached: complete !== null, matches: m, trophiesEarned, chests: s.containers.chest, coins: s.coins };
}

function stats(xs) {
  const mean = xs.reduce((a, b) => a + b, 0) / xs.length;
  const sd = Math.sqrt(xs.reduce((a, b) => a + (b - mean) ** 2, 0) / Math.max(1, xs.length - 1));
  return { mean, sd, min: Math.min(...xs), max: Math.max(...xs) };
}

export function careerSweep(steepness, seeds, strength) {
  return SEATS.map((n) => {
    const runs = seeds.map((seed) => runCareer(n, seed, strength, steepness));
    return {
      seats: n,
      complete: stats(runs.map((r) => r.complete)),
      firstChar: stats(runs.map((r) => r.firstChar ?? 9999)),
      perMatch: stats(runs.map((r) => r.trophiesEarned / r.matches)),
      chestsPerMatch: stats(runs.map((r) => r.chests / r.matches)),
      allReached: runs.every((r) => r.reached),
    };
  });
}

function printCareer(steepness, seeds, strength) {
  console.log(`\n═══ CAREERS at steepness ${steepness}, Plackett-Luce strength ${strength} (${seeds.length} seeds) ═══`);
  console.log('   ⚠️ A MODEL, not a measurement of play. Bounds are in MATCHES — hours multiply');
  console.log('      by a session length that lives in tuning.ts and moves when the clock does.\n');
  const rows = careerSweep(steepness, seeds, strength);
  const two = rows[0];
  console.log(`     seats │ road complete (matches)          │ trophies/match      │ chests/match  │ vs 2 seats`);
  for (const r of rows) {
    const d = r.complete.mean - two.complete.mean;
    const floor = 2 * two.complete.sd;
    const verdict = r.seats === MIN_FIGHTERS ? 'baseline'
      : Math.abs(d) <= floor ? `inside floor (±${floor.toFixed(0)})`
      : `🔴 ${d > 0 ? '+' : ''}${d.toFixed(0)} CLEARS ±${floor.toFixed(0)}`;
    console.log(`     ${pad(r.seats, 5)} │ ${pad(r.complete.mean.toFixed(0), 5)} mean, sd ${pad(r.complete.sd.toFixed(0), 3)}, ${pad(r.complete.min, 4)}-${pad(r.complete.max, 4)} │ `
      + `${pad(r.perMatch.mean.toFixed(3), 6)} sd ${r.perMatch.sd.toFixed(3)} │ ${pad(r.chestsPerMatch.mean.toFixed(3), 6)}        │ ${verdict}`);
  }
  if (!rows.every((r) => r.allReached)) console.log('     🔴 at least one career never completed the road inside the limit.');
  return rows;
}

// ─────────────────────────────────────────────────────────────────────────────
// URI'S ANSWER SHEET
// ─────────────────────────────────────────────────────────────────────────────

const CANDIDATES = [
  { k: 0.6, name: 'HARSH', gloss: 'the bottom half of a six-seat field all lose trophies' },
  { k: 1.0, name: 'LINEAR', gloss: 'SHIPPED DEFAULT — 4th of six is exactly break-even' },
  { k: 1.6, name: 'FRIENDLY', gloss: 'only 6th of six loses trophies' },
];

function printCompare(seeds, strength) {
  console.log('\n═══ §57 ANSWER SHEET — what Uri is choosing between ═══');
  console.log('   One number in economy/tuning.ts: MATCH_PAYOUT.placementSteepness.');
  console.log('   ⚠️ EVERY ROW BELOW PAYS THE SAME 1v1. The dial cannot reach a two-seat match,');
  console.log('      because two seats only ever produce normalised rank 0 and 1, and both are');
  console.log('      pinned before the exponent runs. So this is a decision about 3-6 seats only.\n');
  console.log('   SIX SEATS, above the grace band (a loss costs the 10-trophy cap):\n');
  console.log(`      k    name       1st  2nd  3rd  4th  5th  6th   who gains / holds / loses      per match  vs shipped`);
  const base = placementCurve(6, 1500, 1.0).reduce((a, b) => a + b, 0) / 6;
  for (const c of CANDIDATES) {
    const curve = placementCurve(6, 1500, c.k);
    const mean = curve.reduce((a, b) => a + b, 0) / 6;
    // ⚠️ "break-even" was printed here and it named the first LOSS, which is a different seat
    // whenever the curve passes exactly through zero — as the shipped one does at 4th of six.
    // Three seats groups instead, because that ambiguity is the actual decision.
    const grp = (pred) => { const a = []; curve.forEach((d, i) => { if (pred(d)) a.push(i + 1); }); return a.length ? a.join(',') : '—'; };
    const cells = curve.map((d) => pad(d > 0 ? `+${d}` : d, 4)).join(' ');
    console.log(`      ${c.k.toFixed(1)}  ${c.name.padEnd(9)} ${cells}   ${`${grp((d) => d > 0)} / ${grp((d) => d === 0)} / ${grp((d) => d < 0)}`.padEnd(28)} ${pad(mean.toFixed(2), 6)}     ${pad(((mean / base - 1) * 100).toFixed(0) + '%', 6)}`);
  }
  console.log('\n   COINS at six seats (identical at every standing):\n');
  for (const c of CANDIDATES) {
    const coins = Array.from({ length: 6 }, (_, p) => placementCoins(p, 6, c.k));
    console.log(`      ${c.k.toFixed(1)}  ${c.name.padEnd(9)} ${coins.map((x) => pad(x, 4)).join(' ')}   mean ${(coins.reduce((a, b) => a + b, 0) / 6).toFixed(1)}`);
  }
  console.log('\n   WHAT EACH ONE COSTS THE TUNED ECONOMY:\n');
  for (const c of CANDIDATES) {
    const rows = careerSweep(c.k, seeds, strength);
    const two = rows[0];
    const six = rows[rows.length - 1];
    const floor = 2 * two.complete.sd;
    const d = six.complete.mean - two.complete.mean;
    console.log(`      ${c.k.toFixed(1)}  ${c.name.padEnd(9)} road complete: ${pad(two.complete.mean.toFixed(0), 4)} matches at 2 seats → ${pad(six.complete.mean.toFixed(0), 4)} at 6`
      + `  (Δ ${d > 0 ? '+' : ''}${d.toFixed(0)}, floor ±${floor.toFixed(0)}) ${Math.abs(d) <= floor ? '✅ road unmoved' : '🔴 ROAD NEEDS RETUNING'}`);
    console.log(`           ${''.padEnd(9)} ${c.gloss}`);
  }
  console.log('\n   THE ASYMMETRY THAT PICKS THE DEFAULT: a curve shipped generous and then cut is a');
  console.log('   nerf players notice; a curve shipped conservative and then loosened is a bonus');
  console.log('   nobody misses. Only k=1.0 leaves the road where it was measured.');
}

// ─────────────────────────────────────────────────────────────────────────────
// SELFTEST — every claim above, against a KNOWN-BAD input
// ─────────────────────────────────────────────────────────────────────────────

function selftest() {
  let pass = 0; let fail = 0;
  const failures = [];
  const t = (name, cond, detail) => {
    if (cond) { pass++; console.log(`  ok - ${name}`); }
    else { fail++; failures.push(name); console.log(`  FAIL - ${name}${detail ? `\n         ${detail}` : ''}`); }
  };
  const throws = (fn) => { try { fn(); return false; } catch { return true; } };

  // ── the model itself ──────────────────────────────────────────────────────
  // ⚠️ THE TRAP THIS BLOCK EXISTS FOR: `placeFor` is the only thing here that could silently
  // return a plausible-looking distribution while being wrong, and every career figure rests on
  // it. So it is checked against the closed form it must reproduce, not eyeballed.
  {
    const rng = createRng(1);
    const N = 200000;
    const hist = [0, 0];
    for (let i = 0; i < N; i++) hist[placeFor(rng, 2, 1.5)]++;
    const winRate = hist[0] / N;
    t('placeFor at two seats reproduces the closed form 1.5/(1.5+1) = 0.600',
      Math.abs(winRate - 0.6) < 0.005, `measured ${winRate.toFixed(4)}`);
    // KNOWN-BAD: strength 1.0 is a coin flip. A model that ignored `strength` would pass the
    // check above only by accident and would fail this one.
    const rng2 = createRng(2);
    let firsts = 0;
    for (let i = 0; i < N; i++) if (placeFor(rng2, 2, 1.0) === 0) firsts++;
    t('...and REJECTS a strength-blind model: at strength 1.0 the win rate is 0.500, not 0.600',
      Math.abs(firsts / N - 0.5) < 0.005 && Math.abs(firsts / N - winRate) > 0.05,
      `strength 1.0 → ${(firsts / N).toFixed(4)}, strength 1.5 → ${winRate.toFixed(4)}`);
  }
  {
    const rng = createRng(3);
    const N = 120000;
    const hist = new Array(6).fill(0);
    for (let i = 0; i < N; i++) hist[placeFor(rng, 6, 1.5)]++;
    t('placeFor at six seats produces a proper distribution over all six places',
      hist.every((h) => h > 0) && Math.abs(hist.reduce((a, b) => a + b, 0) - N) < 1e-9);
    t('...and it is monotonically decreasing in place for a stronger-than-average player',
      hist.every((h, i) => i === 0 || h <= hist[i - 1]),
      hist.map((h) => (h / N).toFixed(3)).join(' '));
    t('...and never returns a place outside the field',
      !throws(() => { for (let i = 0; i < 5000; i++) { const p = placeFor(rng, 6, 1.5); if (p < 0 || p > 5) throw new Error('out'); } }));
  }

  // ── the curve, re-checked here so the tool cannot print a table the game disagrees with ──
  {
    t('the tool reads the SHIPPED curve: 2 seats is the shipped win/loss pair',
      placementCurve(2, 1500).join(',') === `${MATCH_PAYOUT.trophiesWin},${-trophyLoss(1500)}`,
      placementCurve(2, 1500).join(','));
    t('six seats at the cap is the documented [15,10,5,0,-5,-10]',
      placementCurve(6, 1500).join(',') === '15,10,5,0,-5,-10', placementCurve(6, 1500).join(','));
    t('the steepness argument actually reaches the curve (the tool is not printing one shape thrice)',
      placementCurve(6, 1500, 0.6).join(',') !== placementCurve(6, 1500, 1.6).join(','),
      `k=0.6 ${placementCurve(6, 1500, 0.6).join(',')} vs k=1.6 ${placementCurve(6, 1500, 1.6).join(',')}`);
    t('...and cannot reach two seats at any of the three candidates',
      CANDIDATES.every((c) => placementCurve(2, 1500, c.k).join(',') === placementCurve(2, 1500, 1.0).join(',')));
    t('rank is 0 first and 1 last at every seat count',
      SEATS.every((n) => placementRank01(0, n) === 0 && placementRank01(n - 1, n) === 1));
    t('a seat count the sim refuses is refused here too',
      throws(() => placementCurve(MAX_FIGHTERS + 1, 0)) && throws(() => placementCurve(1, 0)));
  }

  // ── the career harness ────────────────────────────────────────────────────
  // ⚠️ A CAREER RUNNER THAT IGNORED ITS ARGUMENTS WOULD PRINT A CONFIDENT, IDENTICAL TABLE.
  // Both arguments are proven live before any figure is believed.
  {
    const a = runCareer(6, 4242, 1.5, 1.0);
    const b = runCareer(6, 4242, 1.5, 1.0);
    t('a career is deterministic on its seed', JSON.stringify(a) === JSON.stringify(b));
    const c = runCareer(6, 4243, 1.5, 1.0);
    t('...and a different seed is a different career', a.complete !== c.complete || a.chests !== c.chests);
    const weak = runCareer(6, 4242, 0.7, 1.0);
    t('the STRENGTH argument is live: a weaker player takes longer to finish the road',
      weak.complete > a.complete, `s=0.7 → ${weak.complete}, s=1.5 → ${a.complete}`);
    const friendly = runCareer(6, 4242, 1.5, 1.6);
    t('the STEEPNESS argument is live: the friendly curve finishes the road sooner',
      friendly.complete < a.complete, `k=1.6 → ${friendly.complete}, k=1.0 → ${a.complete}`);
    t('...and the shipped-steepness path and the override path agree at the default',
      JSON.stringify(runCareer(6, 4242, 1.5, MATCH_PAYOUT.placementSteepness)) === JSON.stringify(a));
  }

  // ── the headline claim this tool exists to support ────────────────────────
  {
    const SEEDS = [1, 2, 3, 4, 5, 6, 7, 8];
    const rows = careerSweep(1.0, SEEDS, 1.5);
    const two = rows[0];
    const floor = 2 * two.complete.sd;
    const worst = Math.max(...rows.map((r) => Math.abs(r.complete.mean - two.complete.mean)));
    t(`the shipped curve leaves road pacing inside the 2-seat spread (worst Δ ${worst.toFixed(1)} vs ±${floor.toFixed(1)})`,
      worst <= floor, rows.map((r) => `${r.seats}:${r.complete.mean.toFixed(0)}`).join(' '));
    // KNOWN-BAD: the friendly curve must FAIL the same test on the same seeds. A verdict that
    // cannot go red is a comment with a tick next to it.
    const friendlyRows = careerSweep(1.6, SEEDS, 1.5);
    const fWorst = Math.max(...friendlyRows.map((r) => Math.abs(r.complete.mean - friendlyRows[0].complete.mean)));
    t(`...and that verdict REJECTS k=1.6 on the same seeds (worst Δ ${fWorst.toFixed(1)})`,
      fWorst > 2 * friendlyRows[0].complete.sd,
      friendlyRows.map((r) => `${r.seats}:${r.complete.mean.toFixed(0)}`).join(' '));
    t('the spread is real, not zero — a sd of 0 would mean the seeds are not reaching the model',
      two.complete.sd > 0, `sd ${two.complete.sd}`);
  }

  console.log(`\n${pass} passed, ${fail} failed`);
  if (fail > 0) { for (const f of failures) console.log(`  - ${f}`); process.exit(1); }
}

// ─────────────────────────────────────────────────────────────────────────────
// 🚨 IS_MAIN GUARD. This module EXPORTS, and three tools here have silently run their whole
// CLI on import — one printed a live snapshot sweep, one launched Chromium. Guard the main
// path; keep the exports.
// ─────────────────────────────────────────────────────────────────────────────

const IS_MAIN = process.argv[1] && process.argv[1].endsWith('pc_lab.mjs');

if (IS_MAIN) {
  const steepness = Number(opt('--steepness', MATCH_PAYOUT.placementSteepness));
  const strength = Number(opt('--strength', 1.5));
  const seeds = Array.from({ length: Number(opt('--seeds', 12)) }, (_, i) => 20260811 + i * 977);

  if (has('--selftest')) { selftest(); }
  else if (has('--compare')) { printCompare(seeds, strength); }
  else if (has('--career')) { printCareer(steepness, seeds, strength); }
  else {
    printTable(steepness);
    console.log('\n   → node tools/tmp/pc_lab.mjs --compare   for the §57 answer sheet');
    console.log('   → node tools/tmp/pc_lab.mjs --career    for seeded careers with their spread');
  }
}
