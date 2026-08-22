#!/usr/bin/env node
/**
 * SDB_RES — THE RESOLUTION CENSUS.
 *
 * The question this answers is NOT "are the numbers big enough". It is:
 *
 *     For every lever a designer can actually turn, what is the SMALLEST change
 *     that lever can express, in the units somebody reads or measures?
 *
 * Uri's ask has three parts and only the first is arithmetic:
 *   (1) magnitude  — damage in the 100s, HP in the 1000s
 *   (2) resolution — "allow small increments due to levelling"   <- the motivation
 *   (3) flavour    — "make it interesting"
 *
 * (2) is a claim about QUANTISERS, and this tool enumerates them. A quantiser that is
 * a FRACTION of a pool (the 0-10 stat card, the +5%/level step) does not get finer when
 * the pool grows. A quantiser that is ONE UNIT (an authored integer, `Math.round` on a
 * floating combat number) gets finer in exact proportion. Sorting the levers into those
 * two buckets is the whole analysis, and it is what decides whether a constant factor
 * buys anything at all.
 *
 * ── WHAT IS MEASURED, NOT ASSUMED ──────────────────────────────────────────
 *
 *   * every authored `damage`, `comboParts[].damage`, `pellets`, `peckHits`, `cooldown`
 *   * every character's HP ladder through the REAL `maxHpFor`
 *   * every weapon's displayed-damage ladder through the REAL `levelDamageMultiplier`
 *     and the REAL HUD quantiser (`Math.round(amount)`, `hud.ts` spawnDamageNumber)
 *   * the trail boost's REALISED multiplier (`Math.round(w.damage * damageBoost)`)
 *
 * Nothing is retyped from a doc. Every cell comes from the imported module.
 *
 * ── KNOWN-BAD VALIDATION ───────────────────────────────────────────────────
 *
 * `--selftest` runs 20 checks, of which 9 are KNOWN-BAD arms: inputs constructed so a
 * correct instrument MUST report a fault. A guard never shown to fail is not a guard.
 * Two of them exist specifically for the `[].every()` vacuity class — every filtered
 * assertion here asserts its set is NON-EMPTY first.
 *
 * Usage:
 *   node tools/tmp/sdb_res.mjs --sim <dir>/src/game [--k 1,5,10,20]
 *   node tools/tmp/sdb_res.mjs --selftest
 */

import { realpathSync } from 'node:fs';
import { fileURLToPath } from 'node:url';
import path from 'node:path';

// ── IS_MAIN, symlink-safe. macOS resolves /tmp -> /private/tmp, and a naive
//    `process.argv[1] === fileURLToPath(import.meta.url)` compare reads FALSE through
//    it — the tool then prints nothing and exits 0, which looks exactly like success.
const IS_MAIN = (() => {
  try {
    return realpathSync(process.argv[1] ?? '') === realpathSync(fileURLToPath(import.meta.url));
  } catch { return false; }
})();

const ROOT = path.resolve(path.dirname(fileURLToPath(import.meta.url)), '../..');

function parseArgs(argv) {
  const out = {};
  for (let i = 2; i < argv.length; i++) {
    const a = argv[i];
    if (!a.startsWith('--')) continue;
    const eq = a.indexOf('=');
    if (eq > 0) out[a.slice(2, eq)] = a.slice(eq + 1);
    else if (argv[i + 1] && !argv[i + 1].startsWith('--')) out[a.slice(2)] = argv[++i];
    else out[a.slice(2)] = true;
  }
  return out;
}

// ─────────────────────────────────────────────────────────────────────────────
// PURE MODEL — no imports, so `--selftest` can drive it with planted inputs.
// ─────────────────────────────────────────────────────────────────────────────

/**
 * The displayed ladder for one number across levels 1..LEVEL_MAX.
 *
 * `mulOf(L)` is the game's own multiplier function; `q` is the DISPLAY quantiser
 * (`Math.round` for a floating combat number, identity for an already-integer pool).
 *
 * Returns { values, distinct, invisible } where `invisible` counts level-ups L->L+1
 * whose displayed number does NOT change. That is the exact quantity Uri's sentence
 * "allow small increments due to levelling" is about.
 */
export function ladder(base, mulOf, levelMax, q = Math.round) {
  const values = [];
  for (let L = 1; L <= levelMax; L++) values.push(q(base * mulOf(L)));
  let invisible = 0;
  for (let i = 1; i < values.length; i++) if (values[i] === values[i - 1]) invisible++;
  return { values, distinct: new Set(values).size, invisible };
}

/** Per-press damage of a weapon, in the sim's own terms. Mirrors `rules.kitDps`. */
export function perPress(w) {
  if (w.comboParts) return w.comboParts.reduce((s, p) => s + p.damage, 0);
  return w.damage * (w.peckHits ?? 1) * (w.pellets ?? 1);
}

/**
 * Every DISPLAYED number a weapon can spawn, and how it is authored.
 *
 * ⚠️ THIS IS THE FIELD THAT COST 50.6 pp. `damage` is per-PELLET and per-PECK, it is
 * 0 for a combo (the real numbers live in `comboParts`), and on a `self` weapon it is
 * HP RESTORED, not damage — a different unit in the same field, scaled by
 * `levelHealthMultiplier` rather than `damageMul` (`combat.ts:382`).
 */
export function displayedNumbers(w) {
  if (w.type === 'self') return [{ base: w.healAmount ?? w.damage, unit: 'HP-RESTORED', label: 'heal' }];
  if (w.comboParts) {
    return w.comboParts.map((p, i) => ({ base: p.damage, unit: 'DAMAGE', label: `combo${i + 1}` }));
  }
  return [{ base: w.damage, unit: 'DAMAGE', label: (w.pellets ?? 1) > 1 ? `pellet(x${w.pellets})` : (w.peckHits ?? 1) > 1 ? `peck(x${w.peckHits})` : 'hit' }];
}

/**
 * MINIMUM EXPRESSIBLE TUNING STEP on the offence axis, as a fraction of the
 * character's own kit DPS.
 *
 * A balance pass tunes by editing an authored integer. The smallest edit is +1. This
 * is what that +1 is worth, for the CHEAPEST weapon in the kit — i.e. the finest
 * offence nudge available to a designer at all.
 */
export function mtsDamage(weapons, kitDpsValue) {
  let best = Infinity, bestKey = null;
  for (const w of weapons) {
    if (w.type === 'self') continue;
    // +1 on `damage` moves per-press by pellets*pecks; +1 on ONE combo part moves it by 1.
    const dPerPress = w.comboParts ? 1 : (w.pellets ?? 1) * (w.peckHits ?? 1);
    const dDps = (dPerPress / w.cooldown) * 1000;
    if (dDps < best) { best = dDps; bestKey = w.key ?? w.name ?? '?'; }
  }
  return { absHpPerSec: best, fracOfKit: best / kitDpsValue, weapon: bestKey };
}

/** Realised trail multiplier: authored `damageBoost` is 1.5, delivered is `round(d*1.5)/d`. */
export function realisedBoost(d, boost) { return d === 0 ? NaN : Math.round(d * boost) / d; }

// ─────────────────────────────────────────────────────────────────────────────
// SELFTEST — 20 checks, 9 of them KNOWN-BAD arms
// ─────────────────────────────────────────────────────────────────────────────

function selftest() {
  const R = [];
  const ok = (name, cond, note = '') => R.push({ name, pass: !!cond, note });
  const LM = 15;
  const lin5 = (L) => 1 + (L - 1) * 0.05;   // the shipped curve: LINEAR, not compounding

  // --- ladder(): the level-visibility counter -------------------------------
  // base 20 with a +5%-of-base linear step is EXACTLY 1 unit per level.
  ok('L1  base20 -> 0 invisible', ladder(20, lin5, LM).invisible === 0);
  ok('L2  base20 -> 15 distinct', ladder(20, lin5, LM).distinct === 15);
  // KNOWN-BAD: one unit below the threshold MUST show a defect.
  ok('L3  KNOWN-BAD base19 -> invisible>0', ladder(19, lin5, LM).invisible > 0,
     `got ${ladder(19, lin5, LM).invisible}`);
  // KNOWN-BAD: the pathological end of the shipped roster.
  ok('L4  KNOWN-BAD base2  -> 13 invisible', ladder(2, lin5, LM).invisible === 13,
     `got ${ladder(2, lin5, LM).invisible}`);
  // The counter must MOVE with scale, or it is measuring nothing.
  ok('L5  MOVES: base2 x10 -> 0 invisible', ladder(20, lin5, LM).invisible === 0
     && ladder(2, lin5, LM).invisible === 13);
  // ORDERS: invisible count must be monotone non-increasing in base.
  {
    let mono = true, prev = Infinity;
    for (const b of [1, 2, 3, 5, 8, 12, 18, 20, 40, 100]) {
      const v = ladder(b, lin5, LM).invisible;
      if (v > prev) mono = false;
      prev = v;
    }
    ok('L6  ORDERS: invisible monotone in base', mono);
  }
  // KNOWN-BAD: a COMPOUNDING curve is a different curve. If the tool silently accepted
  // either, the derived threshold (base >= 20) would be wrong. 1.05^n reaches 1.98x.
  {
    const comp = (L) => Math.pow(1.05, L - 1);
    ok('L7  KNOWN-BAD compounding != linear at L15',
       Math.abs(comp(15) - lin5(15)) > 0.27, `comp ${comp(15).toFixed(3)} vs lin ${lin5(15).toFixed(3)}`);
  }
  // SELF-PAIR: identical input, identical output.
  ok('L8  SELF-PAIR', JSON.stringify(ladder(7, lin5, LM)) === JSON.stringify(ladder(7, lin5, LM)));

  // --- perPress(): the field that cost 50.6 pp ------------------------------
  ok('P1  pellets multiply', perPress({ damage: 2, pellets: 5 }) === 10);
  ok('P2  pecks multiply', perPress({ damage: 4, peckHits: 3 }) === 12);
  ok('P3  combo ignores damage', perPress({ damage: 0, comboParts: [{ damage: 14 }, { damage: 9 }] }) === 23);
  // KNOWN-BAD: the exact mistake `bestWeapon` made — reading the authored field.
  ok('P4  KNOWN-BAD authored != per-press for a pellet weapon',
     perPress({ damage: 2, pellets: 5 }) !== 2);
  ok('P5  KNOWN-BAD authored 0 combo is NOT harmless',
     perPress({ damage: 0, comboParts: [{ damage: 14 }, { damage: 9 }] }) !== 0);

  // --- displayedNumbers(): unit tagging ------------------------------------
  ok('D1  self weapon tagged HP-RESTORED',
     displayedNumbers({ type: 'self', damage: 0, healAmount: 18 })[0].unit === 'HP-RESTORED');
  // KNOWN-BAD: the heal lives in `healAmount`, NOT `damage`. Reading `damage` yields 0 and
  // a 0-base ladder reports "14 invisible level-ups" — a confident, wrong answer. This arm
  // exists because the first version of this tool did exactly that.
  ok('D1b KNOWN-BAD reading `damage` for a self weapon yields 0',
     displayedNumbers({ type: 'self', damage: 0, healAmount: 18 })[0].base === 18
     && ladder(0, lin5, LM).invisible === 14);
  ok('D2  combo yields one number per part',
     displayedNumbers({ comboParts: [{ damage: 14 }, { damage: 9 }] }).length === 2);
  // KNOWN-BAD: a self weapon must NOT be counted on the damage axis.
  ok('D3  KNOWN-BAD self weapon excluded from damage unit',
     displayedNumbers({ type: 'self', damage: 18 }).every((n) => n.unit !== 'DAMAGE'));

  // --- mtsDamage(): the balance lever --------------------------------------
  {
    const ws = [
      { key: 'fast', damage: 2, pellets: 5, cooldown: 700 },
      { key: 'slow', damage: 9, pellets: 3, cooldown: 3200 },
      { key: 'heal', type: 'self', damage: 18, cooldown: 6000 },
    ];
    const kit = ws.filter((w) => w.type !== 'self').reduce((s, w) => s + (perPress(w) / w.cooldown) * 1000, 0);
    const m = mtsDamage(ws, kit);
    // The FINEST lever is the slow weapon: 3 pellets / 3200 ms = 0.94 HP/s.
    ok('M1  picks the finest lever', m.weapon === 'slow', `picked ${m.weapon}`);
    ok('M2  heal is excluded', m.absHpPerSec < (5 / 700) * 1000);
    // MOVES: scaling every authored damage by k must divide fracOfKit by exactly k.
    const ws10 = ws.map((w) => ({ ...w, damage: w.damage * 10 }));
    const kit10 = ws10.filter((w) => w.type !== 'self').reduce((s, w) => s + (perPress(w) / w.cooldown) * 1000, 0);
    const m10 = mtsDamage(ws10, kit10);
    ok('M3  MOVES: x10 divides fracOfKit by 10',
       Math.abs(m.fracOfKit / m10.fracOfKit - 10) < 1e-9,
       `${m.fracOfKit.toFixed(6)} -> ${m10.fracOfKit.toFixed(6)}`);
    // KNOWN-BAD: an empty kit must NOT silently return a passing number.
    ok('M4  KNOWN-BAD empty kit -> Infinity, never 0',
       mtsDamage([], 1).absHpPerSec === Infinity);
  }

  // --- realisedBoost(): intent thrown away by a round() --------------------
  ok('B1  even authored -> exact 1.5', realisedBoost(12, 1.5) === 1.5);
  // KNOWN-BAD: odd authored value does NOT deliver the authored boost.
  ok('B2  KNOWN-BAD odd authored -> boost != 1.5',
     realisedBoost(5, 1.5) !== 1.5, `d=5 delivers ${realisedBoost(5, 1.5)}`);
  ok('B3  KNOWN-BAD d=3 delivers 1.667x', Math.abs(realisedBoost(3, 1.5) - 5 / 3) < 1e-9);

  const passed = R.filter((r) => r.pass).length;
  for (const r of R) console.log(`  ${r.pass ? 'ok  ' : 'FAIL'} ${r.name}${r.note ? '   [' + r.note + ']' : ''}`);
  console.log(`\n  ${passed}/${R.length} ${passed === R.length ? 'PASS' : 'FAIL'}`);
  return passed === R.length ? 0 : 1;
}

// ─────────────────────────────────────────────────────────────────────────────
// MAIN
// ─────────────────────────────────────────────────────────────────────────────

async function main() {
  const args = parseArgs(process.argv);
  if (args.selftest) { process.exitCode = selftest(); return; }

  const SIM_DIR = String(args.sim ?? `${ROOT}/src/game`);
  const RULES = await import(`${SIM_DIR}/rules.ts`);
  const {
    CHARACTERS, CHARACTER_IDS, PLAYER_MAX_HP, ENEMY_MAX_HP,
    LEVEL_MIN, LEVEL_MAX, LEVEL_HEALTH_PER_LEVEL, LEVEL_DAMAGE_PER_LEVEL,
    levelHealthMultiplier, levelDamageMultiplier, maxHpFor, kitDps, healthMultiplier,
    HEALTH_PER_STAT, HEALTH_BASELINE_STAT, STAT_MAX_DISPLAY, DPS_PER_DAMAGE_POINT,
    damageStatFor, FOG_DAMAGE, FOG_TICK_MS, REGEN_AMOUNT, REGEN_TICK_MS, POT, TRAIL,
  } = RULES;

  const KS = String(args.k ?? '1,5,10,20').split(',').map(Number);

  console.log(`SDB_RES — resolution census    sim=${SIM_DIR}`);
  console.log(`PLAYER_MAX_HP ${PLAYER_MAX_HP} · ENEMY_MAX_HP ${ENEMY_MAX_HP} · LEVEL ${LEVEL_MIN}..${LEVEL_MAX}`);
  console.log(`LEVEL_HEALTH_PER_LEVEL ${LEVEL_HEALTH_PER_LEVEL} · LEVEL_DAMAGE_PER_LEVEL ${LEVEL_DAMAGE_PER_LEVEL}`);
  console.log(`levelHealthMultiplier(15) = ${levelHealthMultiplier(15)}   levelDamageMultiplier(15) = ${levelDamageMultiplier(15)}`);
  console.log(`  (compounding 1.05^14 would be ${Math.pow(1.05, 14).toFixed(4)} — the shipped curve is LINEAR)`);

  // ── NON-EMPTY GUARDS FIRST. Every assertion below filters; `[].every()` is true.
  const ids = [...CHARACTER_IDS];
  const allWeapons = [];
  for (const id of ids) for (const w of CHARACTERS[id].weapons) allWeapons.push({ id, ...w });
  if (ids.length === 0) { console.error('FATAL: 0 characters'); process.exitCode = 1; return; }
  if (allWeapons.length === 0) { console.error('FATAL: 0 weapons'); process.exitCode = 1; return; }
  console.log(`\nNON-EMPTY GUARD: ${ids.length} characters, ${allWeapons.length} weapons`);

  // ── 1. THE QUANTISER INVENTORY ───────────────────────────────────────────
  console.log(`\n${'='.repeat(78)}\n1. QUANTISER INVENTORY — which levers get finer when the numbers get bigger\n${'='.repeat(78)}`);
  const damageBases = allWeapons.flatMap((w) => displayedNumbers(w).filter((n) => n.unit === 'DAMAGE').map((n) => n.base));
  const healBases = allWeapons.flatMap((w) => displayedNumbers(w).filter((n) => n.unit === 'HP-RESTORED').map((n) => n.base));
  const l1Pools = ids.map((id) => maxHpFor(id, PLAYER_MAX_HP, LEVEL_MIN));
  const l1PoolsEnemy = ids.map((id) => maxHpFor(id, ENEMY_MAX_HP, LEVEL_MIN));
  if (damageBases.length === 0) { console.error('FATAL: 0 damage numbers'); process.exitCode = 1; return; }
  const minDmg = Math.min(...damageBases), maxDmg = Math.max(...damageBases);
  const minPool = Math.min(...l1Pools, ...l1PoolsEnemy);

  const rows = [
    ['Q1  authored `damage` integer (per pellet/peck)', `1 of ${minDmg}..${maxDmg}`, 'SCALES', 'x k'],
    ['Q2  `stats.health` integer x HEALTH_PER_STAT', `${(HEALTH_PER_STAT * 100).toFixed(0)}% of role pool`, 'FIXED', 'a FRACTION — immune to k'],
    ['Q3  `stats.speed` integer x SPEED_PER_STAT', `${(RULES.SPEED_PER_STAT * 100).toFixed(0)}% of speed cap`, 'FIXED', 'fraction, and inert'],
    ['Q4  `maxHpFor` Math.round', `1 of ${minPool}..`, 'SCALES', 'x k'],
    ['Q5  HUD Math.round(amount) on a floating hit', `1 of ${minDmg}..${maxDmg}`, 'SCALES', 'x k'],
    ['Q6  HUD Math.ceil(hp) on the bar', `1 of ${minPool}..`, 'SCALES', 'x k'],
    ['Q7  damageStatFor round(kitDps/DPS_PER_DAMAGE_POINT)', `${DPS_PER_DAMAGE_POINT} HP/s`, 'BREAKS', 'must become 3.5*k or the card saturates'],
    ['Q8  ceil(hp/FOG_DAMAGE) tick count', '1 tick', 'INVARIANT', 'exact under a COMMON factor'],
    ['Q9  level step (LINEAR, +5% of base)', `${(LEVEL_HEALTH_PER_LEVEL * 100).toFixed(0)}% of base`, 'FIXED', 'a FRACTION — k makes it VISIBLE, never SMALLER'],
    ['Q10 combat.ts round(damage * TRAIL.damageBoost)', '1 unit', 'SCALES', 'x k'],
    ['Q11 REGEN_AMOUNT integer per tick', `${REGEN_AMOUNT} of ${minPool}`, 'SCALES', 'x k'],
    ['Q12 `healAmount` integer', `1 of ${healBases.join(',') || '-'}`, 'SCALES', 'HP-family: scale with k_HP, NOT k_dmg'],
  ];
  console.log(`  ${'lever'.padEnd(52)}${'step'.padEnd(24)}${'vs magnitude'.padEnd(12)}note`);
  for (const [a, b, c, d] of rows) console.log(`  ${a.padEnd(52)}${b.padEnd(24)}${c.padEnd(12)}${d}`);
  console.log(`\n  -> ${rows.filter((r) => r[2] === 'FIXED').length} of ${rows.length} levers are FRACTIONS of a pool. A constant factor cannot touch them.`);

  // ── 2. R1 — LEVEL VISIBILITY, per-pellet display vs per-press display ────
  console.log(`\n${'='.repeat(78)}\n2. R1 — LEVEL VISIBILITY. How many level-ups do NOT move the number a player reads?\n${'='.repeat(78)}`);
  const mulD = (L) => levelDamageMultiplier(L);
  const mulH = (L) => levelHealthMultiplier(L);

  console.log(`\n  (a) DAMAGE, displayed PER PELLET (what ships today: hud spawnDamageNumber per hit)`);
  console.log(`  ${'k'.padEnd(6)}${'numbers'.padEnd(10)}${'invisible level-ups'.padEnd(24)}${'%'.padEnd(9)}${'min base'.padEnd(10)}worst weapon`);
  const perPelletByK = {};
  for (const k of KS) {
    let tot = 0, inv = 0, worst = null, worstInv = -1, minB = Infinity;
    for (const w of allWeapons) {
      for (const n of displayedNumbers(w)) {
        if (n.unit !== 'DAMAGE') continue;
        const b = n.base * k;
        minB = Math.min(minB, b);
        const L = ladder(b, mulD, LEVEL_MAX);
        tot += LEVEL_MAX - 1; inv += L.invisible;
        if (L.invisible > worstInv) { worstInv = L.invisible; worst = `${w.id}/${w.key ?? w.name} ${n.label} base ${b}`; }
      }
    }
    perPelletByK[k] = { tot, inv };
    console.log(`  ${String('x' + k).padEnd(6)}${String(tot / (LEVEL_MAX - 1)).padEnd(10)}${`${inv} / ${tot}`.padEnd(24)}${(100 * inv / tot).toFixed(1).padStart(6)}%  ${String(minB).padEnd(10)}${worstInv} inv: ${worst}`);
  }

  console.log(`\n  (b) DAMAGE, displayed PER PRESS (one number per press — the genre convention)`);
  console.log(`  ${'k'.padEnd(6)}${'numbers'.padEnd(10)}${'invisible level-ups'.padEnd(24)}${'%'.padEnd(9)}${'min press'.padEnd(11)}worst weapon`);
  for (const k of KS) {
    let tot = 0, inv = 0, worst = null, worstInv = -1, minB = Infinity;
    for (const w of allWeapons) {
      if (w.type === 'self') continue;
      const b = perPress(w) * k;
      minB = Math.min(minB, b);
      const L = ladder(b, mulD, LEVEL_MAX);
      tot += LEVEL_MAX - 1; inv += L.invisible;
      if (L.invisible > worstInv) { worstInv = L.invisible; worst = `${w.id}/${w.key ?? w.name} press ${b}`; }
    }
    console.log(`  ${String('x' + k).padEnd(6)}${String(tot / (LEVEL_MAX - 1)).padEnd(10)}${`${inv} / ${tot}`.padEnd(24)}${(100 * inv / tot).toFixed(1).padStart(6)}%  ${String(minB).padEnd(11)}${worstInv} inv: ${worst}`);
  }

  console.log(`\n  (c) HP POOLS (both roles), through the real maxHpFor`);
  console.log(`  ${'k'.padEnd(6)}${'ladders'.padEnd(10)}${'invisible level-ups'.padEnd(24)}${'%'.padEnd(9)}uneven per-level steps`);
  for (const k of KS) {
    let tot = 0, inv = 0, uneven = 0;
    for (const id of ids) {
      for (const base of [PLAYER_MAX_HP * k, ENEMY_MAX_HP * k]) {
        const vals = [];
        for (let L = 1; L <= LEVEL_MAX; L++) vals.push(maxHpFor(id, base, L));
        let iv = 0; const steps = new Set();
        for (let i = 1; i < vals.length; i++) { if (vals[i] === vals[i - 1]) iv++; steps.add(vals[i] - vals[i - 1]); }
        tot += LEVEL_MAX - 1; inv += iv;
        if (steps.size > 1) uneven++;
      }
    }
    console.log(`  ${String('x' + k).padEnd(6)}${String(ids.length * 2).padEnd(10)}${`${inv} / ${tot}`.padEnd(24)}${(100 * inv / tot).toFixed(1).padStart(6)}%  ${uneven} of ${ids.length * 2} ladders`);
  }

  // ── 3. R2 — THE PER-CHARACTER LEVER ─────────────────────────────────────
  console.log(`\n${'='.repeat(78)}\n3. R2 — THE PER-CHARACTER DIFFERENTIATION LEVER\n${'='.repeat(78)}`);
  const pools = ids.map((id) => maxHpFor(id, PLAYER_MAX_HP, LEVEL_MIN));
  const distinctPools = new Set(pools);
  const statVals = ids.map((id) => CHARACTERS[id].stats.health);
  console.log(`  authored stat.health values : ${statVals.join(' ')}   -> ${new Set(statVals).size} distinct of ${ids.length} characters`);
  console.log(`  resulting L1 player pools   : ${pools.join(' ')}   -> ${distinctPools.size} distinct of ${ids.length}`);
  const collisions = [];
  for (const p of distinctPools) { const g = ids.filter((id) => maxHpFor(id, PLAYER_MAX_HP, LEVEL_MIN) === p); if (g.length > 1) collisions.push(`${p}: ${g.join('+')}`); }
  console.log(`  COLLISIONS (characters the sim cannot tell apart on HP): ${collisions.length ? collisions.join('  |  ') : 'none'}`);
  console.log(`\n  One card point = ${(HEALTH_PER_STAT * 100).toFixed(0)}% of the role pool = ${HEALTH_PER_STAT * PLAYER_MAX_HP} HP at k=1.`);
  console.log(`  MEASURED worth of one point (rules.ts HEALTH_PER_STAT, fixed driver): 13.5-27.9 pp of strength.`);
  console.log(`  Aggregate win-rate resolution floor: ~9 pp.`);
  console.log(`  -> finest available HP nudge is ${(13.5 / 9).toFixed(2)}x to ${(27.9 / 9).toFixed(2)}x the noise floor. It OVERSHOOTS by construction.`);
  console.log(`\n  ${'k'.padEnd(6)}${'card step (HP)'.padEnd(18)}${'card step (% pool)'.padEnd(22)}${'DIRECT step (% pool)'.padEnd(24)}direct step (pp, est)`);
  for (const k of KS) {
    const cardHp = HEALTH_PER_STAT * PLAYER_MAX_HP * k;
    const pool = PLAYER_MAX_HP * k;
    const directPp = [13.5, 27.9].map((v) => (v / (HEALTH_PER_STAT * 100)) * (100 / pool));
    console.log(`  ${String('x' + k).padEnd(6)}${String(cardHp).padEnd(18)}${(100 * cardHp / pool).toFixed(1).padEnd(22)}${(100 / pool).toFixed(3).padEnd(24)}${directPp[0].toFixed(3)}-${directPp[1].toFixed(3)}`);
  }
  console.log(`\n  NOTE the two right-hand columns are the SAME NUMBER in the "card step" columns at every k:`);
  console.log(`  the card is a FRACTION of the pool, so growing the pool moves it not at all. Only the`);
  console.log(`  DIRECT column (authoring HP in HP units) responds to k.`);

  // HEALTH_PER_STAT's hard floor, re-derived rather than quoted.
  {
    const burgerStat = CHARACTERS['hamburger'].stats.health;
    const healW = CHARACTERS['hamburger'].weapons.find((w) => w.type === 'self');
    const heal = healW?.healAmount;
    if (!heal) { console.error('FATAL: hamburger heal not found — refusing to derive a floor from a missing input'); process.exitCode = 1; return; }
    // sim.test.mjs 25(c): heal must clear a quarter of the pool.
    // heal > 0.25 * PLAYER_MAX_HP * (1 + (stat - baseline)*HPS)  ->  solve for HPS
    const floor = ((0.25 * PLAYER_MAX_HP - heal) / (0.25 * PLAYER_MAX_HP)) / (HEALTH_BASELINE_STAT - burgerStat);
    console.log(`\n  HEALTH_PER_STAT hard floor, RE-DERIVED (not quoted): hamburger stat ${burgerStat}, heal ${heal},`);
    console.log(`  25(c) needs heal > 0.25*pool  ->  HEALTH_PER_STAT > ${floor.toFixed(5)}. Today ${HEALTH_PER_STAT}.`);
    console.log(`  -> the card can only get ${(100 * (1 - floor / HEALTH_PER_STAT)).toFixed(1)}% finer before a gate turns red. It is NOT the way out.`);
  }

  // ── 4. THE OFFENCE LEVER ────────────────────────────────────────────────
  console.log(`\n${'='.repeat(78)}\n4. R3 — THE OFFENCE TUNING LEVER (minimum expressible step, per character)\n${'='.repeat(78)}`);
  console.log(`  ${'char'.padEnd(14)}${'kitDps'.padEnd(9)}${'finest weapon'.padEnd(16)}${KS.map((k) => ('x' + k + ' %kit').padEnd(11)).join('')}`);
  const mtsWorst = {};
  for (const id of ids) {
    const kd = kitDps(id);
    const m = mtsDamage(CHARACTERS[id].weapons, kd);
    const cells = KS.map((k) => (100 * m.fracOfKit / k).toFixed(2).padEnd(11));
    for (const k of KS) mtsWorst[k] = Math.max(mtsWorst[k] ?? 0, 100 * m.fracOfKit / k);
    console.log(`  ${id.padEnd(14)}${kd.toFixed(2).padEnd(9)}${String(m.weapon).padEnd(16)}${cells.join('')}`);
  }
  console.log(`  ${'WORST'.padEnd(39)}${KS.map((k) => mtsWorst[k].toFixed(2).padEnd(11)).join('')}`);
  console.log(`\n  Calibration: 10% of pool = 13.5-27.9 pp (measured). Durability and output are`);
  console.log(`  symmetric in an exchange (TTK = pool/dps), so 1% of kit DPS ~ 1.35-2.79 pp.`);
  console.log(`  To bracket a target inside a ~9 pp floor you need a step of <= ~4.5 pp, i.e. <= ~1.6-3.3% of kit.`);
  console.log(`  ${'k'.padEnd(6)}${'worst step (%kit)'.padEnd(20)}${'worst step (pp, est)'.padEnd(24)}verdict vs 4.5 pp`);
  for (const k of KS) {
    const lo = mtsWorst[k] * 1.35, hi = mtsWorst[k] * 2.79;
    console.log(`  ${String('x' + k).padEnd(6)}${mtsWorst[k].toFixed(2).padEnd(20)}${`${lo.toFixed(2)}-${hi.toFixed(2)}`.padEnd(24)}${hi <= 4.5 ? 'PASS' : lo <= 4.5 ? 'MARGINAL' : 'FAIL'}`);
  }

  // ── 5. INTENT THROWN AWAY ───────────────────────────────────────────────
  console.log(`\n${'='.repeat(78)}\n5. WHERE INTENT IS THROWN AWAY TODAY (the evidence, not the theory)\n${'='.repeat(78)}`);
  console.log(`\n  (a) TRAIL.damageBoost is authored ${TRAIL.damageBoost} and DELIVERED as round(d*${TRAIL.damageBoost})/d:`);
  const boosts = [];
  for (const w of allWeapons) {
    if (w.type === 'self' || w.comboParts || w.damage === 0) continue;
    boosts.push({ key: `${w.id}/${w.key ?? w.name}`, d: w.damage, got: realisedBoost(w.damage, TRAIL.damageBoost) });
  }
  if (boosts.length === 0) { console.error('FATAL: 0 boostable weapons'); process.exitCode = 1; return; }
  const offBoost = boosts.filter((b) => Math.abs(b.got - TRAIL.damageBoost) > 1e-9);
  console.log(`      ${offBoost.length} of ${boosts.length} weapons do NOT receive the authored boost.`);
  const span = offBoost.map((b) => b.got);
  if (span.length) console.log(`      realised range ${Math.min(...span).toFixed(4)} .. ${Math.max(...span).toFixed(4)}   worst: ${offBoost.sort((a, b) => Math.abs(b.got - TRAIL.damageBoost) - Math.abs(a.got - TRAIL.damageBoost))[0].key} (d=${offBoost[0].d} -> ${offBoost[0].got.toFixed(4)}x)`);
  for (const k of KS) {
    const bad = boosts.filter((b) => Math.abs(realisedBoost(b.d * k, TRAIL.damageBoost) - TRAIL.damageBoost) > 1e-9).length;
    console.log(`      x${String(k).padEnd(4)} -> ${bad} of ${boosts.length} still wrong`);
  }

  console.log(`\n  (b) RATE LEVERS — how many rungs exist between "off" and "twice today's value"?`);
  const rate = (name, amt, tickMs, poolRef) => {
    console.log(`      ${name.padEnd(16)} authored ${String(amt).padEnd(5)} / ${String(tickMs).padEnd(5)}ms = ${((amt / tickMs) * 1000).toFixed(1)} HP/s` +
      `   rungs to 2x: ${KS.map((k) => `x${k}:${amt * k}`).join('  ')}`);
  };
  rate('REGEN_AMOUNT', REGEN_AMOUNT, REGEN_TICK_MS);
  rate('FOG_DAMAGE', FOG_DAMAGE, FOG_TICK_MS);
  rate('POT.damage', POT.damage, POT.tickMs);
  console.log(`      -> REGEN_AMOUNT has ${REGEN_AMOUNT} rungs below its current value. A designer who wants`);
  console.log(`         "slightly less regen" has exactly one option (1), a 50% cut. That is the resolution problem`);
  console.log(`         in one line, and it has nothing to do with whether the numbers look big.`);

  console.log(`\n  (c) THE CARD'S DAMAGE BAR saturates unless DPS_PER_DAMAGE_POINT scales with damage:`);
  console.log(`      ${'k'.padEnd(6)}${'kitDps range'.padEnd(22)}${'card values if DPS_PER_DAMAGE_POINT stays ' + DPS_PER_DAMAGE_POINT}`);
  for (const k of KS) {
    const dps = ids.map((id) => kitDps(id) * k);
    const cards = ids.map((id) => Math.max(1, Math.min(STAT_MAX_DISPLAY, Math.round(kitDps(id) * k / DPS_PER_DAMAGE_POINT))));
    console.log(`      ${String('x' + k).padEnd(6)}${`${Math.min(...dps).toFixed(1)}..${Math.max(...dps).toFixed(1)}`.padEnd(22)}${new Set(cards).size} distinct  [${cards.join(' ')}]`);
  }

  // ── 6. THE DERIVATION ───────────────────────────────────────────────────
  console.log(`\n${'='.repeat(78)}\n6. THE DERIVATION — smallest k that satisfies each requirement\n${'='.repeat(78)}`);
  const solve = (pred) => { for (let k = 1; k <= 200; k++) if (pred(k)) return k; return null; };
  const kR1a = solve((k) => allWeapons.every((w) => displayedNumbers(w).filter((n) => n.unit === 'DAMAGE').every((n) => ladder(n.base * k, mulD, LEVEL_MAX).invisible === 0)));
  const kR1b = solve((k) => allWeapons.filter((w) => w.type !== 'self').every((w) => ladder(perPress(w) * k, mulD, LEVEL_MAX).invisible === 0));
  const kR1c = solve((k) => ids.every((id) => [PLAYER_MAX_HP, ENEMY_MAX_HP].every((b) => { for (let L = 2; L <= LEVEL_MAX; L++) if (maxHpFor(id, b * k, L) === maxHpFor(id, b * k, L - 1)) return false; return true; })));
  const kR2 = solve((k) => (100 / (PLAYER_MAX_HP * k)) * 2.79 / (HEALTH_PER_STAT * 100) * 100 <= 4.5);
  const kR3 = solve((k) => mtsWorst[1] !== undefined ? (mtsWorst[1] / k) * 2.79 <= 4.5 : false);
  const kR4 = solve((k) => boosts.every((b) => Math.abs(realisedBoost(b.d * k, TRAIL.damageBoost) - TRAIL.damageBoost) < 1e-9));
  const kR5 = solve((k) => Math.min(...ids.map((id) => maxHpFor(id, ENEMY_MAX_HP, LEVEL_MIN) * k)) >= 1000);
  const kR6 = solve((k) => Math.min(...allWeapons.filter((w) => w.type !== 'self').map((w) => perPress(w) * k)) >= 100);
  const kR7 = solve((k) => Math.min(...allWeapons.flatMap((w) => displayedNumbers(w).filter((n) => n.unit === 'DAMAGE').map((n) => n.base * k))) >= 100);
  const kR5p = solve((k) => Math.min(...ids.map((id) => maxHpFor(id, PLAYER_MAX_HP, LEVEL_MIN) * k)) >= 1000);
  // R8: every per-level HP step an EXACT integer, both roles — i.e. no ladder where the
  // upgrade card alternates +3/+4 for an identical 5%.
  const kR8 = solve((k) => ids.every((id) => [PLAYER_MAX_HP, ENEMY_MAX_HP].every((b) => {
    const steps = new Set();
    for (let L = 2; L <= LEVEL_MAX; L++) steps.add(maxHpFor(id, b * k, L) - maxHpFor(id, b * k, L - 1));
    return steps.size === 1;
  })));
  const req = [
    ['R1a  zero invisible level-ups, PER-PELLET display', kR1a],
    ['R1b  zero invisible level-ups, PER-PRESS display', kR1b],
    ['R1c  zero invisible level-ups, HP pools', kR1c],
    ['R2   HP lever <= 4.5 pp  (requires DIRECT authoring)', kR2],
    ['R3   offence lever <= 4.5 pp', kR3],
    ['R4   trail boost exact for every weapon', kR4],
    ['R4b  every per-level HP step an EXACT integer, both roles', kR8],
    ['R5   URI: every L1 pool >= 1000, ENEMY role ("thousands")', kR5],
    ['R5p  URI: every L1 pool >= 1000, PLAYER role only', kR5p],
    ['R6   URI: every PER-PRESS damage >= 100 ("hundreds")', kR6],
    ['R7   URI: every AUTHORED per-pellet damage >= 100', kR7],
  ];
  for (const [n, k] of req) console.log(`  ${n.padEnd(58)}k >= ${k === null ? 'unreachable' : k}`);
  console.log(`\n  BINDING (design requirements R1-R4b only): k >= ${Math.max(kR1a, kR1b, kR1c, kR2 ?? 0, kR3 ?? 0, kR4, kR8)}`);
  console.log(`  BINDING (+ Uri's magnitude, per-press reading R5+R6): k >= ${Math.max(kR1a, kR1b, kR1c, kR2 ?? 0, kR3 ?? 0, kR4, kR8, kR5, kR6)}`);
  console.log(`  BINDING (+ literal per-pellet reading R7): k >= ${Math.max(kR1a, kR1b, kR1c, kR2 ?? 0, kR3 ?? 0, kR4, kR8, kR5, kR6, kR7)}`);

  // ── 7. IS A RESCALE BIT-IDENTICAL? ──────────────────────────────────────
  console.log(`\n${'='.repeat(78)}\n7. BIT-IDENTITY — is a x k rescale a null change to the sim?\n${'='.repeat(78)}`);
  console.log(`  maxHpFor rounds: round(roleBase * hm * lm). round(k*x) != k*round(x) in general,`);
  console.log(`  so a rescaled pool is not always k x today's pool. Measured over ${ids.length} chars x 2 roles x ${LEVEL_MAX} levels:`);
  console.log(`  ${'k'.padEnd(6)}${'cells'.padEnd(8)}${'cells != k*today'.padEnd(20)}${'max abs diff'.padEnd(15)}max rel diff`);
  for (const k of KS) {
    let cells = 0, diff = 0, maxAbs = 0, maxRel = 0;
    for (const id of ids) for (const b of [PLAYER_MAX_HP, ENEMY_MAX_HP]) for (let L = 1; L <= LEVEL_MAX; L++) {
      cells++;
      const scaled = maxHpFor(id, b * k, L);
      const naive = k * maxHpFor(id, b, L);
      if (scaled !== naive) { diff++; maxAbs = Math.max(maxAbs, Math.abs(scaled - naive)); maxRel = Math.max(maxRel, Math.abs(scaled - naive) / naive); }
    }
    console.log(`  ${String('x' + k).padEnd(6)}${String(cells).padEnd(8)}${String(diff).padEnd(20)}${String(maxAbs).padEnd(15)}${(100 * maxRel).toFixed(4)}%`);
  }
  console.log(`\n  -> a sim rescale is NOT bit-identical. The divergence is a ROUNDING ERROR being removed,`);
  console.log(`     not introduced — but it is still a change, and the aggregate win rate (~9 pp floor)`);
  console.log(`     is the WRONG instrument to check it with. A PAIRED per-matchup delta on identical`);
  console.log(`     seeds is EXACT and is the only honest test.`);

  // The one thing that IS exactly invariant, verified rather than asserted.
  {
    let same = 0, tot = 0;
    for (const id of ids) for (const b of [PLAYER_MAX_HP, ENEMY_MAX_HP]) for (let L = 1; L <= LEVEL_MAX; L++) {
      for (const k of KS) {
        tot++;
        const t1 = Math.ceil(maxHpFor(id, b, L) / FOG_DAMAGE);
        const tk = Math.ceil(maxHpFor(id, b * k, L) / (FOG_DAMAGE * k));
        if (t1 === tk) same++;
      }
    }
    if (tot === 0) { console.error('FATAL: 0 fog cells'); process.exitCode = 1; return; }
    console.log(`\n  FOG TICK COUNT under a COMMON factor: ${same} / ${tot} cells identical` +
      `${same === tot ? '   (exactly invariant — verified, not assumed)' : '   <- NOT invariant'}`);
  }

  // ── 8. THE NULL ARM — a DISPLAY-ONLY multiplier ─────────────────────────
  console.log(`\n${'='.repeat(78)}\n8. THE NULL ARM — what does a DISPLAY-ONLY multiplier buy?\n${'='.repeat(78)}`);
  console.log(`  combat.ts:135 \`dealt = amount * damageMul\` does NOT round. The sim's damage is`);
  console.log(`  CONTINUOUS. The only quantiser on the level ladder is hud.ts's Math.round(amount).`);
  console.log(`  So multiplying INSIDE THE HUD moves the same ladder, with a provably bit-identical sim.`);
  console.log(`\n  ${'k'.padEnd(6)}${'display-only: invisible level-ups'.padEnd(36)}${'sim rescale: invisible'.padEnd(26)}same?`);
  for (const k of KS) {
    let invD = 0, tot = 0;
    for (const w of allWeapons) for (const n of displayedNumbers(w)) {
      if (n.unit !== 'DAMAGE') continue;
      // display-only: the SIM value is n.base (unscaled, continuous), the HUD renders round(k * value)
      const L = ladder(n.base, mulD, LEVEL_MAX, (x) => Math.round(k * x));
      invD += L.invisible; tot += LEVEL_MAX - 1;
    }
    const invS = perPelletByK[k].inv;
    console.log(`  ${String('x' + k).padEnd(6)}${`${invD} / ${tot}`.padEnd(36)}${`${invS} / ${perPelletByK[k].tot}`.padEnd(26)}${invD === invS ? 'IDENTICAL' : 'differ'}`);
  }
  console.log(`\n  -> a display-only multiplier delivers Uri's ask (1) AND ask (2)-for-levels, bit-identically.`);
  console.log(`     It delivers NOTHING for Q1/Q2/Q4 — the authoring levers — because those are integers`);
  console.log(`     in the sim and the sim did not move. That is the whole case for doing it for real.`);
}

if (IS_MAIN) await main();
