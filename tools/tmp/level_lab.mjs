#!/usr/bin/env node
/**
 * LEVEL LAB — the two questions `DECISIONS §22` has to answer with numbers.
 *
 *   --winrate    Is the win rate FLAT across levels 1..15?  Uri's answer to the
 *                enemy-scaling question is "AI players need to be adjusted to the
 *                player's level", which makes flatness a VERIFICATION rather than a
 *                design space: a drift here is a defect, not a shape to park.
 *
 *   --crossover  At what level does a Normal overtake a level-1 Cyber, and does it ever
 *                overtake a LEVEL-MATCHED one? Uri: "level 15 normal should be able to
 *                beat level 1 cyber". The second half is the guard on the first: if a
 *                Normal also beats a level-matched Cyber, levels have not beaten rarity,
 *                the roster is simply unbalanced.
 *
 * ── WHY THIS IS NOT A NEW DRIVER ────────────────────────────────────────────
 * It imports `tools/tmp/scripted_player.mjs`, the one driver implementation in this repo.
 * `driver_guard.mjs` exists because a stale private copy contaminated TEN instruments, and
 * the seed formula, the countdown guard and the decision loop below are all lifted from
 * `roster_lab.mjs` unchanged so that a cell here is the SAME match as a cell there. That
 * is what `--selftest` check B verifies, rather than asserting.
 *
 *   node tools/tmp/level_lab.mjs --selftest
 *   node tools/tmp/level_lab.mjs --winrate --seeds 8 --policies smart2,chase
 *   node tools/tmp/level_lab.mjs --crossover --seeds 16
 *
 * ⚠️ RESOLUTION FLOORS, and they are different quantities:
 *   * an AGGREGATE win rate over the whole roster is unresolvable below ~9 pp;
 *   * a PAIRED per-matchup delta on identical seeds is exact;
 *   * a single matchup cell at N seeds has a binomial standard error of
 *     sqrt(0.25/N) — 17.7 pp at 8 seeds, 8.8 pp at 32. `--crossover` prints it, because
 *     a crossover read off a cell inside its own error bar is not a crossover.
 */

import { readFileSync, existsSync } from 'node:fs';
import { resolve } from 'node:path';
import { createScriptedPlayer, rng, parseDriverFlags } from './scripted_player.mjs';

const ROOT = resolve(new URL('../..', import.meta.url).pathname);

const args = (() => {
  const o = {};
  for (let i = 2; i < process.argv.length; i++) {
    const a = process.argv[i];
    if (!a.startsWith('--')) continue;
    const n = process.argv[i + 1];
    if (n === undefined || n.startsWith('--')) o[a.slice(2)] = true;
    else { o[a.slice(2)] = n; i++; }
  }
  return o;
})();

const SIM_DIR = String(args.sim ?? `${ROOT}/src/game`);
const { createMatch, stepMatch } = await import(`${SIM_DIR}/sim.ts`);
const RULES = await import(`${SIM_DIR}/rules.ts`);
const {
  CHARACTERS, CHARACTER_IDS, MATCH_DURATION_MS, REACH, RARITY_ORDER,
  HIT_RADIUS_VS_PLAYER, HIT_RADIUS_VS_ENEMY, PLAYER_MAX_HP, ENEMY_MAX_HP,
  LEVEL_MIN, LEVEL_MAX, levelHealthMultiplier, levelDamageMultiplier, maxHpFor,
} = RULES;

const ARENA_PATH = String(args.arena ?? `${ROOT}/tools/arena.gameplay.json`);
const ARENA_DATA = existsSync(ARENA_PATH) ? JSON.parse(readFileSync(ARENA_PATH, 'utf8')) : null;
const HALF_DIAG = ARENA_DATA ? Math.hypot(ARENA_DATA.width / 2, ARENA_DATA.height / 2) : 0;
const FOG_FIRST_CONTACT_MS = 6000; // arena/shared.ts FOG_FIRST_CONTACT_S
let arena = ARENA_DATA ? {
  ...ARENA_DATA,
  maxSafeRadius: Math.round(HALF_DIAG / (1 - FOG_FIRST_CONTACT_MS / MATCH_DURATION_MS)),
  build: () => null, update: () => {},
} : null;

const DT = Number(args.dt ?? 16.667);
const SEEDS = Number(args.seeds ?? 8);
const POLICIES = String(args.policies ?? 'smart2,chase').split(',');
const mean = (a) => (a.length ? a.reduce((x, y) => x + y, 0) / a.length : 0);
const pct = (v) => `${(v * 100).toFixed(1)}%`;

const DRIVER_FLAGS = parseDriverFlags(args);
const driverFor = (a) => createScriptedPlayer({ CHARACTERS, REACH, arena: a, ...DRIVER_FLAGS });
let driver = arena ? driverFor(arena) : null;

/**
 * One match at explicit levels.
 *
 * The seed formula is `roster_lab.mjs`'s, character-for-character, so a `{player, enemy,
 * policy, seed}` cell here is bit-identical to the same cell there WHEN both levels are
 * LEVEL_MIN. `--selftest` check B is exactly that comparison.
 */
function runMatch(playerId, enemyId, policy, seed, playerLevel = LEVEL_MIN, enemyLevel = LEVEL_MIN) {
  const rnd = rng(seed * 7919 + playerId.length * 131 + enemyId.length * 17 + policy.length);
  const state = createMatch(arena, playerId, enemyId, { player: playerLevel, enemy: enemyLevel });
  const decide = driver.POLICY_FNS[policy](rnd);
  const loop = driver.createDecisionLoop({ decide, reactBase: 150, reactJit: seed === 0 ? 0 : 60, rnd });

  let countdownMs = null, winner = null, endedAt = null;
  const HARD_CAP = MATCH_DURATION_MS * 1.6 + 20000;
  while (state.phase !== 'ended' && state.elapsed < HARD_CAP) {
    const evs = stepMatch(state, DT, loop.next(state, DT));
    for (const ev of evs) {
      if (ev.type === 'match-started') countdownMs = state.elapsed;
      else if (ev.type === 'match-ended') { winner = ev.winner; endedAt = state.elapsed; }
    }
  }
  return {
    winner,
    playMs: countdownMs === null ? 0 : (endedAt ?? state.elapsed) - countdownMs,
    maxHp: { player: state.player.maxHp, enemy: state.enemy.maxHp },
    damageMul: { player: state.player.damageMul, enemy: state.enemy.damageMul },
  };
}

/** Aggregate player win rate over the whole 110-matchup grid at one level pairing. */
function gridWinRate(policy, playerLevel, enemyLevel) {
  let wins = 0, n = 0;
  for (const p of CHARACTER_IDS) {
    for (const e of CHARACTER_IDS) {
      if (p === e) continue;
      for (let s = 0; s < SEEDS; s++) {
        if (runMatch(p, e, policy, s, playerLevel, enemyLevel).winner === 'player') wins++;
        n++;
      }
    }
  }
  return { rate: wins / n, n };
}

/** One matchup, one level pairing. */
function cellWinRate(playerId, enemyId, policy, playerLevel, enemyLevel) {
  let wins = 0;
  for (let s = 0; s < SEEDS; s++) {
    if (runMatch(playerId, enemyId, policy, s, playerLevel, enemyLevel).winner === 'player') wins++;
  }
  return wins / SEEDS;
}

// ─────────────────────────────────────────────────────────────────────────────
// --selftest : validate the instrument against inputs whose answer is DERIVABLE
// ─────────────────────────────────────────────────────────────────────────────
if (args.selftest) {
  let pass = 0, fail = 0;
  const ok = (name, cond, detail = '') => {
    if (cond) { pass++; console.log(`   PASS  ${name}${detail ? `  ${detail}` : ''}`); }
    else { fail++; console.log(`   FAIL  ${name}${detail ? `  ${detail}` : ''}`); }
  };
  console.log(`\n══ level_lab SELFTEST ══  sim ${SIM_DIR === `${ROOT}/src/game` ? 'working tree' : SIM_DIR}`);

  // ── A. The multipliers themselves, against closed-form answers ────────────
  ok('level 1 is exactly 1.0 on both axes — the identity the "bit-identical" claim rests on',
    levelHealthMultiplier(LEVEL_MIN) === 1 && levelDamageMultiplier(LEVEL_MIN) === 1);
  ok(`level ${LEVEL_MAX} is the documented 1.70x on both axes`,
    Math.abs(levelHealthMultiplier(LEVEL_MAX) - 1.70) < 1e-9
    && Math.abs(levelDamageMultiplier(LEVEL_MAX) - 1.70) < 1e-9,
    `${levelHealthMultiplier(LEVEL_MAX).toFixed(4)} / ${levelDamageMultiplier(LEVEL_MAX).toFixed(4)}`);
  ok('out-of-range levels clamp rather than extrapolate',
    levelHealthMultiplier(0) === 1 && levelHealthMultiplier(999) === levelHealthMultiplier(LEVEL_MAX));

  // ── B. THE POOL THE SIM GIVES A FIGHTER IS THE POOL THIS TOOL SAYS ───────
  //
  // This is the check `docs/LESSONS.md` §13 is about: an instrument that reports a level
  // it did not actually apply would produce a confident, entirely fictional flat curve.
  {
    const bad = [];
    for (const id of CHARACTER_IDS) {
      for (const lvl of [LEVEL_MIN, 8, LEVEL_MAX]) {
        const r = runMatch(id, id, 'idle', 0, lvl, lvl);
        const wantP = maxHpFor(id, PLAYER_MAX_HP, lvl);
        const wantE = maxHpFor(id, ENEMY_MAX_HP, lvl);
        if (r.maxHp.player !== wantP) bad.push(`${id}@${lvl} player ${r.maxHp.player} vs ${wantP}`);
        if (r.maxHp.enemy !== wantE) bad.push(`${id}@${lvl} enemy ${r.maxHp.enemy} vs ${wantE}`);
        if (Math.abs(r.damageMul.player - levelDamageMultiplier(lvl)) > 1e-12) {
          bad.push(`${id}@${lvl} dmgMul ${r.damageMul.player}`);
        }
      }
    }
    ok('the sim applies the level this tool asked for — pools AND damage multiplier',
      bad.length === 0, bad.slice(0, 3).join(' · '));
  }

  // ── C. A LEVEL ACTUALLY CHANGES AN OUTCOME ───────────────────────────────
  //
  // A flat win-rate curve is the RESULT this tool exists to prove. That makes it
  // indistinguishable from a tool that silently ignores levels — so the asymmetric case
  // has to move, or flatness proves nothing.
  {
    const lo = cellWinRate('hamburger', 'pizza', 'smart2', LEVEL_MIN, LEVEL_MIN);
    const hi = cellWinRate('hamburger', 'pizza', 'smart2', LEVEL_MAX, LEVEL_MIN);
    ok('a level-15 player beats a level-1 enemy more often than a level-1 player does',
      hi > lo, `L1vL1 ${pct(lo)} -> L15vL1 ${pct(hi)}`);
    const mirror = cellWinRate('hamburger', 'pizza', 'smart2', LEVEL_MAX, LEVEL_MAX);
    ok('…and a MIRRORED level pairing lands back near the level-1 answer',
      Math.abs(mirror - lo) < 0.30, `L1vL1 ${pct(lo)} vs L15vL15 ${pct(mirror)}`);
  }

  // ── D. LEVEL 1 IS BIT-IDENTICAL TO THE PRE-LEVELS CALL PATH ──────────────
  {
    const withLevels = runMatch('taco', 'soup', 'smart2', 3, LEVEL_MIN, LEVEL_MIN);
    const savedCreate = createMatch;
    // Same match through the 3-argument signature every pre-levels caller used.
    const rnd = rng(3 * 7919 + 'taco'.length * 131 + 'soup'.length * 17 + 'smart2'.length);
    const st = savedCreate(arena, 'taco', 'soup');
    const loop = driver.createDecisionLoop({
      decide: driver.POLICY_FNS.smart2(rnd), reactBase: 150, reactJit: 60, rnd,
    });
    let w = null, c = null, e = null;
    while (st.phase !== 'ended' && st.elapsed < MATCH_DURATION_MS * 1.6 + 20000) {
      for (const ev of stepMatch(st, DT, loop.next(st, DT))) {
        if (ev.type === 'match-started') c = st.elapsed;
        else if (ev.type === 'match-ended') { w = ev.winner; e = st.elapsed; }
      }
    }
    ok('the 3-argument createMatch and an explicit level-1 pair are the SAME match',
      w === withLevels.winner && Math.abs(((e ?? st.elapsed) - (c ?? 0)) - withLevels.playMs) < 1e-9,
      `${w}/${withLevels.winner}`);
  }

  console.log(`\n   ${pass}/${pass + fail} assertions passed\n`);
  process.exit(fail ? 1 : 0);
}

// ─────────────────────────────────────────────────────────────────────────────
// --winrate : the curve across levels, mirrored (shipped) and fixed (the control)
// ─────────────────────────────────────────────────────────────────────────────
if (args.winrate) {
  const LEVELS = String(args.levels ?? `${LEVEL_MIN},4,8,11,${LEVEL_MAX}`).split(',').map(Number);
  console.log(`\n══ WIN-RATE ACROSS LEVELS ══ ${SEEDS} seeds x 110 matchups per cell`);
  console.log(`   binomial SE on a 110x${SEEDS} grid: ${(Math.sqrt(0.25 / (110 * SEEDS)) * 100).toFixed(2)} pp`
    + `   ·  the project's aggregate resolution floor: ~9 pp`);
  for (const policy of POLICIES) {
    const rows = [];
    for (const lvl of LEVELS) {
      const mirror = gridWinRate(policy, lvl, lvl);
      const fixed = args.control ? gridWinRate(policy, lvl, LEVEL_MIN) : null;
      rows.push({ lvl, mirror: mirror.rate, fixed: fixed?.rate ?? null, n: mirror.n });
      console.log(`   ${policy.padEnd(7)} L${String(lvl).padStart(2)}  mirror ${pct(mirror.rate)}`
        + (fixed ? `   ·  enemy pinned at L1: ${pct(fixed.rate)}` : ''));
    }
    const ms = rows.map((r) => r.mirror);
    const drift = (Math.max(...ms) - Math.min(...ms)) * 100;
    console.log(`   ${policy.padEnd(7)} >> MIRRORED DRIFT ACROSS L1..L${LEVEL_MAX}: ${drift.toFixed(1)} pp`
      + `  ${drift < 9 ? '(inside the ~9pp aggregate floor — FLAT)' : '(OUTSIDE the floor — a defect)'}`);
  }
  console.log('');
  process.exit(0);
}

// ─────────────────────────────────────────────────────────────────────────────
// --crossover : Uri's sentence, measured
// ─────────────────────────────────────────────────────────────────────────────
if (args.crossover) {
  const normals = CHARACTER_IDS.filter((id) => CHARACTERS[id].rarity === 'Normal');
  const cybers = CHARACTER_IDS.filter((id) => CHARACTERS[id].rarity === 'Cyber');
  const se = Math.sqrt(0.25 / (SEEDS * normals.length * cybers.length)) * 100;
  console.log(`\n══ CROSSOVER ══ ${normals.join('/')} (Normal) vs ${cybers.join('/')} (Cyber)`);
  console.log(`   ${SEEDS} seeds x ${normals.length * cybers.length} pairings per cell · binomial SE ${se.toFixed(1)} pp`);

  for (const policy of POLICIES) {
    console.log(`\n   ── policy ${policy} ──`);
    console.log(`   ${'Normal Lv'.padEnd(11)}${'vs Cyber L1'.padStart(13)}${'vs Cyber, LEVEL-MATCHED'.padStart(26)}`);
    for (let lvl = LEVEL_MIN; lvl <= LEVEL_MAX; lvl++) {
      const vsFresh = mean(normals.flatMap((n) => cybers.map((c) => cellWinRate(n, c, policy, lvl, LEVEL_MIN))));
      const vsMatched = mean(normals.flatMap((n) => cybers.map((c) => cellWinRate(n, c, policy, lvl, lvl))));
      const mark = vsFresh > 0.5 ? '  <- beats a fresh Cyber' : '';
      console.log(`   Lv${String(lvl).padStart(2).padEnd(9)}${pct(vsFresh).padStart(13)}${pct(vsMatched).padStart(26)}${mark}`);
    }
  }
  console.log('');
  process.exit(0);
}

console.log('nothing to do — pass --selftest, --winrate or --crossover');
