#!/usr/bin/env node
/**
 * BURGER LAB — where do the two drivers' matches DIVERGE, for one character?
 *
 * `6447a68` found that 8 of the 17 remaining settled matchups involve Hamburger, whose
 * halves are 15.0% in the player's hands against 65.6% in the AI's — a **50.6 pp role
 * split**, twice the next largest in the roster — and concluded it is *"a vitals/driver
 * interaction, not a kit-variety one"*. This tool is the instrument for that claim.
 *
 * A role split is the ideal probe target because the A/B is free: the same character, the
 * same arena, the same level, two different drivers. So rather than reporting a win rate
 * and inviting a theory, this reports the REALISED MECHANICS of both halves side by side —
 * presses, hits, damage, heal, statuses APPLIED and statuses SUFFERED, splats laid, and the
 * ticks each fighter actually spent slowed by terrain — so "the AI plays it better" and
 * "the AI plays a different game" can be told apart.
 *
 * ── THE DRIVER IS IMPORTED, NEVER COPIED ────────────────────────────────────
 *
 * `tools/tmp/scripted_player.mjs` is the one implementation; ten instruments were once
 * contaminated by private copies (`docs/LESSONS.md` §5). `driver_guard.mjs` fails if an
 * eleventh appears, and this file would be it.
 *
 * ── VALIDATED AGAINST KNOWN INPUTS BEFORE IT IS BELIEVED ────────────────────
 *
 * `--selftest` (12 assertions) drives derivable fixtures whose answers are arithmetic,
 * not opinion — including the TERRAIN-SLOW CONTROL, which parks each fighter inside a
 * whole-arena `slow` hazard and measures wu/ms against an identical run on clean floor.
 * `docs/LESSONS.md` §13: seventeen instruments on this project have returned confident
 * wrong answers, so the control comes first.
 *
 *   node tools/tmp/burger_lab.mjs --selftest
 *   node tools/tmp/burger_lab.mjs --char hamburger --seeds 32
 *   node tools/tmp/burger_lab.mjs --char hamburger --seeds 32 --sim /tmp/cand/game
 *   node tools/tmp/burger_lab.mjs --char hamburger --seeds 32 --json /tmp/bl.before.json
 *
 * ⚠️ RESOLUTION FLOORS. An AGGREGATE win rate is unresolvable below ~9 pp. A PAIRED
 * per-matchup delta on identical seeds is exact and is a DIFFERENT QUANTITY. This tool
 * prints role halves (aggregates over 10 matchups x N seeds) and never adds the two.
 */

import { readFileSync, writeFileSync, existsSync } from 'node:fs';
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
  CHARACTERS, CHARACTER_IDS, MATCH_DURATION_MS, REACH,
  HIT_RADIUS_VS_PLAYER, HIT_RADIUS_VS_ENEMY,
  PLAYER_MAX_HP, ENEMY_MAX_HP, PLAYER_SPEED, PUDDLE_SLOW_FACTOR, SLOW_MOVE_MULTIPLIER,
  AI_SELF_HEAL_HP_FRACTION,
} = RULES;

/**
 * ── `--player-heals`: THE COUNTERFACTUAL, AND WHY IT IS A WRAPPER ────────────
 *
 * `scripted_player.mjs:bestWeapon` opens with `if (w.type === 'self') return;`, so every
 * shipped measurement policy except `kite` is structurally incapable of pressing a heal.
 * Hamburger owns the roster's ONLY `self` weapon, so that one line is a Hamburger-shaped
 * hole in the instrument — and the question this tool exists to answer is exactly how big.
 *
 * This is a WRAPPER around the shared policy, never a copy of it: it calls
 * `POLICY_FNS[policy]` and overrides only `selectedWeapon`/`attack`, on the ticks where
 * `ai.ts:rankHeal`'s OWN three conditions hold — off cooldown, at or below
 * `AI_SELF_HEAL_HP_FRACTION`, and not about to overheal. So the counterfactual is
 * precisely *"the player uses the heal exactly as well as the AI already does"*, rather
 * than a new hand-tuned policy whose result would be a tuning artefact.
 *
 * It draws NO seeded RNG, so a `--player-heals` run is still paired tick-for-tick with the
 * run without it (`docs/LESSONS.md` §5: a driver that decides differently re-seeds every
 * match and a paired before/after stops being paired).
 */
const PLAYER_HEALS = !!args['player-heals'];
function wrapWithHeal(base) {
  if (!PLAYER_HEALS) return base;
  return (state) => {
    const inp = base(state);
    const p = state.player;
    const ws = CHARACTERS[p.characterId].weapons;
    const slot = ws.findIndex((w) => w.type === 'self');
    if (slot < 0) return inp;
    const w = ws[slot];
    const heal = w.healAmount ?? 0;
    if (heal <= 0) return inp;
    if (state.elapsed - p.lastUsed[slot] < w.cooldown) return inp;   // on cooldown
    if (p.hp > p.maxHp * AI_SELF_HEAL_HP_FRACTION) return inp;       // not hurt enough
    if (p.maxHp - p.hp < heal) return inp;                           // would overheal
    return { ...inp, selectedWeapon: slot, attack: true };
  };
}

const ARENA_PATH = String(args.arena ?? `${ROOT}/tools/arena.gameplay.json`);
const ARENA_DATA = existsSync(ARENA_PATH) ? JSON.parse(readFileSync(ARENA_PATH, 'utf8')) : null;
// `arena.maxSafeRadius` is DERIVED from MATCH_DURATION_MS in `arena/shared.ts`; a cached
// dump goes stale the moment the clock moves, so recompute from the same formula.
const HALF_DIAG = ARENA_DATA ? Math.hypot(ARENA_DATA.width / 2, ARENA_DATA.height / 2) : 0;
const FOG_FIRST_CONTACT_MS = 6000;
const derivedMaxSafe = Math.round(HALF_DIAG / (1 - FOG_FIRST_CONTACT_MS / MATCH_DURATION_MS));
let arena = ARENA_DATA ? {
  ...ARENA_DATA,
  maxSafeRadius: Number(args.maxsafe ?? derivedMaxSafe),
  build: () => null, update: () => {},
} : null;

const DT = Number(args.dt ?? 16.667);
const SEEDS = Number(args.seeds ?? 8);
const POLICY = String(args.policy ?? 'smart2');
const CHAR = String(args.char ?? 'hamburger');
const dist = (ax, ay, bx, by) => Math.hypot(ax - bx, ay - by);
const mean = (a) => (a.length ? a.reduce((x, y) => x + y, 0) / a.length : 0);

const DRIVER_FLAGS = parseDriverFlags(args);
const driverFor = (a) => createScriptedPlayer({ CHARACTERS, REACH, arena: a, ...DRIVER_FLAGS });
let driver = arena ? driverFor(arena) : null;

// ─────────────────────────────────────────────────────────────────────────────
// One match, fully instrumented on BOTH sides symmetrically.
//
// Every counter below is collected identically for `player` and `enemy`. That symmetry
// is the whole point: a quantity gathered one way for one side and another way for the
// other cannot answer a question about the difference between the two sides.
// ─────────────────────────────────────────────────────────────────────────────

function blankSide() {
  return {
    presses: {},         // weaponKey -> count of `weapon-fired`
    dealt: {},           // weaponKey -> damage landed
    dealtTotal: 0,       // weapon + trail damage this side put on the other
    zoneTaken: 0,        // fog + pot damage this side took
    healedBySelf: 0,     // HP restored by a `self` weapon (NOT out-of-combat regen)
    healedByRegen: 0,
    splats: 0,
    slowApplied: 0,      // times this side started a `slow` on the other
    stunApplied: 0,
    terrainSlowTicks: 0, // ticks this fighter stood in a puddle/splat
    statusSlowTicks: 0,  // ticks this fighter carried the `slow` status
    stunTicks: 0,
    travel: 0,           // wu actually covered
    firstDamageMs: null, // play-ms at which this side first dealt damage
  };
}

function runMatch(playerId, enemyId, policy, seed, { beforeTick = null } = {}) {
  // `roster_lab.mjs` / `pacing_ladder.mjs` seed formula, unchanged — that is what makes a
  // row here the SAME match as a row there.
  const rnd = rng(seed * 7919 + playerId.length * 131 + enemyId.length * 17 + policy.length);
  const state = createMatch(arena, playerId, enemyId);
  const decide = wrapWithHeal(driver.POLICY_FNS[policy](rnd));
  const loop = driver.createDecisionLoop({ decide, reactBase: 150, reactJit: seed === 0 ? 0 : 60, rnd });

  const pReach = driver.maxNormalRange(playerId), eReach = driver.maxNormalRange(enemyId);
  const engageRange = Math.max(pReach + HIT_RADIUS_VS_ENEMY, eReach + HIT_RADIUS_VS_PLAYER);

  const side = { player: blankSide(), enemy: blankSide() };
  let countdownMs = null, playTicks = 0, engagedTicks = 0, contactPlayMs = null;
  let winner = null, endedAt = null, ending = null;
  let sepSum = 0;
  const prev = { player: null, enemy: null };
  const HARD_CAP = MATCH_DURATION_MS * 1.6 + 20000;

  while (state.phase !== 'ended' && state.elapsed < HARD_CAP) {
    if (beforeTick) beforeTick(state);
    // Status flags are read BEFORE the tick that may re-apply them, so "was this fighter
    // slowed while it was deciding" is what is counted, not "is it slowed afterwards".
    const wasSlowed = {
      player: state.elapsed < state.player.status.slowedUntil,
      enemy: state.elapsed < state.enemy.status.slowedUntil,
    };
    const wasStunned = {
      player: state.elapsed < state.player.status.stunnedUntil,
      enemy: state.elapsed < state.enemy.status.stunnedUntil,
    };
    // `Fighter.terrainSlowFactor` is the sim's OWN per-tick result, published as a
    // read-only observation. Reading it here is exactly what it is for; it is the only
    // way to count terrain contact without a second implementation of the geometry.
    const wasOnTerrain = {
      player: state.player.terrainSlowFactor < 1,
      enemy: state.enemy.terrainSlowFactor < 1,
    };
    if (state.phase === 'playing') {
      prev.player = { x: state.player.x, y: state.player.y };
      prev.enemy = { x: state.enemy.x, y: state.enemy.y };
    }

    const evs = stepMatch(state, DT, loop.next(state, DT));

    // A `self` weapon and out-of-combat regen emit the SAME `heal` event, so they are
    // separated by which of them could have fired on this tick: `attemptAttack` pushes
    // `weapon-fired` immediately before the heal it causes.
    let selfFiredBy = null;
    for (const ev of evs) {
      if (ev.type === 'weapon-fired') {
        const role = ev.fighterRole;
        side[role].presses[ev.weaponKey] = (side[role].presses[ev.weaponKey] ?? 0) + 1;
        const w = CHARACTERS[state[role].characterId].weapons.find((x) => x.key === ev.weaponKey);
        if (w && w.type === 'self') selfFiredBy = role;
      } else if (ev.type === 'heal') {
        if (selfFiredBy === ev.fighterRole) side[ev.fighterRole].healedBySelf += ev.amount;
        else side[ev.fighterRole].healedByRegen += ev.amount;
      } else if (ev.type === 'splat-created') {
        // A splat is spawned where a `splatter` projectile dies, which is at the TARGET.
        // Attribution is by which side owns a splatter weapon in this matchup; with both
        // sides splatter-capable the count is ambiguous and is reported as such.
        side[splatOwner(state)].splats++;
      } else if (ev.type === 'match-started') countdownMs = state.elapsed;
      else if (ev.type === 'match-ended') { winner = ev.winner; endedAt = state.elapsed; }
      else if (ev.type === 'death') ending = 'knockout';
      else if (ev.type === 'hit-landed') {
        const k = ev.source?.kind;
        const by = ev.targetRole === 'player' ? 'enemy' : 'player';
        if (k === 'weapon' || k === 'trail') {
          side[by].dealtTotal += ev.amount;
          const key = ev.source?.weaponKey ?? '(trail)';
          side[by].dealt[key] = (side[by].dealt[key] ?? 0) + ev.amount;
          if (side[by].firstDamageMs === null && countdownMs !== null) {
            side[by].firstDamageMs = state.elapsed - countdownMs;
          }
        } else side[ev.targetRole].zoneTaken += ev.amount;
        // A status that was refused by the grace window does not start; count STARTS.
        if (ev.effect === 'slow' && !wasSlowed[ev.targetRole]
            && state[ev.targetRole].status.slowedUntil > state.elapsed) side[by].slowApplied++;
        if (ev.effect === 'stun' && !wasStunned[ev.targetRole]
            && state[ev.targetRole].status.stunnedUntil > state.elapsed) side[by].stunApplied++;
      }
    }

    if (state.phase === 'playing') {
      playTicks++;
      for (const role of ['player', 'enemy']) {
        if (wasSlowed[role]) side[role].statusSlowTicks++;
        if (wasStunned[role]) side[role].stunTicks++;
        if (wasOnTerrain[role]) side[role].terrainSlowTicks++;
        if (prev[role]) side[role].travel += dist(prev[role].x, prev[role].y, state[role].x, state[role].y);
      }
      const sep = dist(state.player.x, state.player.y, state.enemy.x, state.enemy.y);
      sepSum += sep;
      if (sep <= engageRange) {
        engagedTicks++;
        if (contactPlayMs === null) contactPlayMs = MATCH_DURATION_MS - state.timeRemaining;
      }
    }
  }

  const playMs = countdownMs === null ? 0 : (endedAt ?? state.elapsed) - countdownMs;
  if (ending === null) ending = winner ? 'timeout' : 'UNRESOLVED';

  return {
    playerId, enemyId, policy, seed, winner, ending,
    playMs, playTicks, contactPlayMs,
    meanSeparation: playTicks ? sepSum / playTicks : 0,
    dutyCycle: playTicks ? engagedTicks / playTicks : 0,
    side,
    hpLeft: { player: state.player.hp, enemy: state.enemy.hp },
    maxHp: { player: state.player.maxHp, enemy: state.enemy.maxHp },
  };
}

/** Which side in this matchup owns a `splatter` weapon. `null` when both or neither do. */
function splatOwner(state) {
  const has = (r) => CHARACTERS[state[r].characterId].weapons.some((w) => w.splatter);
  const p = has('player'), e = has('enemy');
  if (p && !e) return 'player';
  if (e && !p) return 'enemy';
  return p ? 'player' : 'player'; // ambiguous: parked on one side, flagged by `bothSplatter`
}

// ─────────────────────────────────────────────────────────────────────────────
// --selftest : derivable fixtures, run BEFORE any figure from this tool is believed.
// ─────────────────────────────────────────────────────────────────────────────
if (args.selftest) {
  let pass = 0, fail = 0;
  const ok = (name, cond, detail = '') => {
    if (cond) { pass++; console.log(`   PASS  ${name}${detail ? `  ${detail}` : ''}`); }
    else { fail++; console.log(`   FAIL  ${name}${detail ? `  ${detail}` : ''}`); }
  };
  console.log(`\n══ burger_lab SELFTEST ══  sim ${SIM_DIR === `${ROOT}/src/game` ? 'working tree' : SIM_DIR}`);

  const CLEAR = {
    id: 'selftest', displayName: 'selftest', width: 1400, height: 1000,
    center: { x: 700, y: 500 }, maxSafeRadius: 5000,
    playerSpawn: { x: 200, y: 500 }, enemySpawn: { x: 1000, y: 500 },
    cover: [], hazards: [], build: () => null, update: () => {},
  };
  const savedArena = arena, savedDriver = driver;

  // ── A. The plumbing is not inverted ────────────────────────────────────────
  arena = CLEAR; driver = driverFor(CLEAR);
  {
    const r = runMatch('hamburger', 'hamburger', 'idle', 0);
    ok('an idle player never wins', r.winner === 'enemy', `winner=${r.winner}`);
  }
  {
    const a = runMatch('hamburger', 'donut', 'smart2', 0);
    const b = runMatch('hamburger', 'donut', 'smart2', 0);
    ok('seed 0 is deterministic (bit-identical re-run)',
      a.playMs === b.playMs && a.winner === b.winner
      && a.side.player.dealtTotal === b.side.player.dealtTotal);
  }
  {
    // Presses are counted from `weapon-fired`, damage from `hit-landed`; damage without a
    // press is impossible and would mean the two are wired to different fighters.
    const r = runMatch('hamburger', 'donut', 'chase', 0);
    const pressed = Object.keys(r.side.player.presses).filter((k) => k !== 'Onion');
    const damaged = Object.keys(r.side.player.dealt);
    ok('every weapon that dealt damage was also pressed (the two counters agree)',
      damaged.every((k) => k === '(trail)' || pressed.includes(k)),
      `pressed=${pressed.join(',')} dealt=${damaged.join(',')}`);
  }

  // ── B. THE TERRAIN-SLOW CONTROL — a derivable known input, ONE TICK WIDE ───
  //
  // ⚠️ THE OBVIOUS VERSION OF THIS CONTROL IS CONFOUNDED, and it was written first.
  // Flooding the arena and comparing travel-per-tick across two whole matches reads the
  // enemy at ratio **1.096** — above 1, which no movement rule in the sim can produce.
  // The reason is that a flood slows the PLAYER, so the match it produces is a different
  // match: different separations, different branch mix, different length. A two-run ratio
  // is only a speed measurement if everything except speed is held.
  //
  // So the control is one tick wide. Both fighters are pinned at a known separation
  // (beyond every weapon's range, so the AI is guaranteed to be in its chase-MOVE branch
  // and the player's input is the only thing driving it), one tick is stepped, and the
  // displacement is compared against the identical tick on clean floor. Everything except
  // the floor is byte-identical, so the ratio has an arithmetic answer:
  // PUDDLE_SLOW_FACTOR for anyone the rule applies to, 1.0 for anyone it does not.
  const FLOODED = {
    ...CLEAR,
    hazards: [{ x: 700, y: 500, radius: 4000, kind: 'slow', slowFactor: PUDDLE_SLOW_FACTOR }],
  };
  const oneTickTravel = (arenaDef, id) => {
    const st = createMatch(arenaDef, id, id);
    // Skip the countdown the way the sim does, without touching the seeded stream.
    while (st.phase !== 'playing') stepMatch(st, DT, { move: { x: 0, y: 0 }, selectedWeapon: 0, attack: false });
    st.player.x = 300; st.player.y = 500;
    st.enemy.x = 1100; st.enemy.y = 500;    // 800 wu apart — past every weapon in the roster
    const p0 = { x: st.player.x, y: st.player.y }, e0 = { x: st.enemy.x, y: st.enemy.y };
    stepMatch(st, DT, { move: { x: 1, y: 0 }, aim: { x: 1, y: 0 }, selectedWeapon: 0, attack: false });
    return {
      player: dist(p0.x, p0.y, st.player.x, st.player.y),
      enemy: dist(e0.x, e0.y, st.enemy.x, st.enemy.y),
      seenPlayer: st.player.terrainSlowFactor, seenEnemy: st.enemy.terrainSlowFactor,
    };
  };
  {
    const dry = oneTickTravel(CLEAR, 'hotdog');
    const wet = oneTickTravel(FLOODED, 'hotdog');
    ok('the flood is detected on BOTH fighters (the observation channel is symmetric)',
      wet.seenPlayer === PUDDLE_SLOW_FACTOR && wet.seenEnemy === PUDDLE_SLOW_FACTOR
      && dry.seenPlayer === 1 && dry.seenEnemy === 1,
      `wet p=${wet.seenPlayer} e=${wet.seenEnemy}`);
    ok('the control moves both fighters at all (a zero would make every ratio vacuous)',
      dry.player > 0 && dry.enemy > 0, `player ${dry.player.toFixed(4)} enemy ${dry.enemy.toFixed(4)} wu/tick`);

    const pRatio = wet.player / dry.player;
    const eRatio = wet.enemy / dry.enemy;
    console.log(`     one tick  player  dry ${dry.player.toFixed(4)} -> wet ${wet.player.toFixed(4)}  ratio ${pRatio.toFixed(3)}`);
    console.log(`     one tick  enemy   dry ${dry.enemy.toFixed(4)} -> wet ${wet.enemy.toFixed(4)}  ratio ${eRatio.toFixed(3)}`);
    ok('the PLAYER is slowed by terrain, at exactly PUDDLE_SLOW_FACTOR',
      Math.abs(pRatio - PUDDLE_SLOW_FACTOR) < 1e-9, `ratio ${pRatio.toFixed(6)} vs ${PUDDLE_SLOW_FACTOR}`);
    // Deliberately reported in BOTH directions, in the idiom of sim.test.mjs §20(d): this
    // line is a PINNED DIAGNOSIS. It names which tree it is standing on, so a fix cannot
    // land without the instrument being re-read.
    const enemyImmune = Math.abs(eRatio - 1) < 1e-9;
    const enemySlowed = Math.abs(eRatio - PUDDLE_SLOW_FACTOR) < 1e-9;
    ok(`the ENEMY is ${enemyImmune ? 'IMMUNE to terrain slow  <-- DEFECT' : enemySlowed ? 'slowed by terrain  <-- FIXED' : 'NEITHER — investigate'}`,
      enemyImmune || enemySlowed, `ratio ${eRatio.toFixed(6)}`);
  }

  // ── C. A SPLAT IS TERRAIN, AND IT IS TERRAIN FOR WHOEVER LAID IT ───────────
  {
    arena = CLEAR; driver = driverFor(CLEAR);
    // Hamburger vs Donut on a hazard-free arena: the ONLY terrain that can exist is the
    // splat Hamburger's own Tomato Toss leaves, which lands at the target and which the
    // chasing player then walks into. So a non-zero player terrain count here is not
    // noise — it is the splatter owner being slowed by its own ground effect.
    const r = runMatch('hamburger', 'donut', 'chase', 0);
    ok('on a hazard-free arena the only terrain is a splat, and it is the splatterer\'s own',
      r.side.player.splats > 0 && r.side.player.terrainSlowTicks > 0 && r.side.enemy.terrainSlowTicks > 0,
      `splats=${r.side.player.splats} ownTerrain=${r.side.player.terrainSlowTicks} oppTerrain=${r.side.enemy.terrainSlowTicks}`);
    // …and with no splatter weapon anywhere, terrain is exactly zero on a clear arena.
    const c = runMatch('hotdog', 'donut', 'chase', 0);
    ok('no splatter weapon and no hazards -> zero terrain ticks on both sides',
      c.side.player.terrainSlowTicks === 0 && c.side.enemy.terrainSlowTicks === 0);
  }

  // ── D. The self-heal is separated from out-of-combat regen ─────────────────
  {
    arena = CLEAR; driver = driverFor(CLEAR);
    // `kite` is the one shipped policy that presses a `self` weapon, so it is the control
    // that proves the heal accounting can see a player-side heal at all. If this ever
    // reads 0 the separation logic is broken, not the policy.
    const r = runMatch('hamburger', 'donut', 'kite', 0);
    ok('a player-side self-heal is attributed to the WEAPON, not to regen',
      r.side.player.healedBySelf > 0, `self=${r.side.player.healedBySelf} regen=${r.side.player.healedByRegen}`);
    // …and the AI side, on the same character, through `ai.ts:rankHeal`.
    const r2 = runMatch('donut', 'hamburger', 'chase', 0);
    ok('an AI-side self-heal is attributed to the WEAPON too',
      r2.side.enemy.healedBySelf > 0, `self=${r2.side.enemy.healedBySelf}`);
    // THE ONE THAT MATTERS: the shipped measurement policy never presses it.
    const r3 = runMatch('hamburger', 'donut', 'smart2', 0);
    ok(`smart2 presses the self weapon ${(r3.side.player.presses.Onion ?? 0) > 0 ? 'YES' : 'NEVER  <-- instrument gap'}`,
      PLAYER_HEALS ? (r3.side.player.presses.Onion ?? 0) > 0 : (r3.side.player.presses.Onion ?? 0) === 0,
      `Onion presses = ${r3.side.player.presses.Onion ?? 0}  (--player-heals ${PLAYER_HEALS ? 'ON' : 'off'})`);
    // The wrapper must change NOTHING for a character with no `self` weapon: that is what
    // makes a `--player-heals` roster run comparable to one without it everywhere else.
    const a = runMatch('donut', 'sushi', 'smart2', 3);
    ok('the heal wrapper is inert for a character with no `self` weapon',
      a.side.player.presses.Onion === undefined && a.side.player.healedBySelf === 0);
  }

  // ── E. Splat accounting ────────────────────────────────────────────────────
  {
    arena = CLEAR; driver = driverFor(CLEAR);
    const a = runMatch('hamburger', 'donut', 'chase', 0);   // only the player splatters
    const b = runMatch('donut', 'hamburger', 'chase', 0);   // only the AI splatters
    ok('splats are attributed to the side whose kit has `splatter`',
      a.side.player.splats > 0 && a.side.enemy.splats === 0
      && b.side.enemy.splats > 0 && b.side.player.splats === 0,
      `a p=${a.side.player.splats} b e=${b.side.enemy.splats}`);
    const c = runMatch('donut', 'lollipop', 'chase', 0);    // neither splatters
    ok('a matchup with no `splatter` weapon creates no splats',
      c.side.player.splats === 0 && c.side.enemy.splats === 0);
  }

  // ── F. Travel is real displacement, not intent ─────────────────────────────
  {
    arena = CLEAR; driver = driverFor(CLEAR);
    const r = runMatch('hamburger', 'donut', 'idle', 0);
    ok('an idle player travels 0 wu (travel measures displacement, not input)',
      r.side.player.travel < 1e-9, `${r.side.player.travel.toFixed(3)} wu`);
  }

  arena = savedArena; driver = savedDriver;
  console.log(`\n   ${pass} passed, ${fail} failed\n`);
  process.exit(fail ? 1 : 0);
}

// ─────────────────────────────────────────────────────────────────────────────
// --roster : all 110 matchups, so the ROLE SPLIT can be read for every character and
//            the three guards (settled / rarity tier spread / aggregate) come out of
//            THE SAME RUN as the split. `6447a68` made that a rule: a guard taken from
//            a different measurement than the thing it guards is not a guard.
//
// The definitions below are `roster_lab.mjs:summarise`'s, and `--verify-roster <json>`
// asserts this tool reproduces that tool CELL FOR CELL at the same seeds — the same
// self-validation `kit_lab.mjs` carries, and the reason a second runner is allowed to
// exist at all.
// ─────────────────────────────────────────────────────────────────────────────
if (args.roster) {
  if (!arena) { console.error(`no arena at ${ARENA_PATH}`); process.exit(1); }
  const { RARITY_ORDER } = RULES;
  const byMatchup = {};
  for (const p of CHARACTER_IDS) {
    for (const e of CHARACTER_IDS) {
      if (p === e) continue;
      let w = 0;
      for (let s = 0; s < SEEDS; s++) if (runMatch(p, e, POLICY, s).winner === 'player') w++;
      byMatchup[`${p}>${e}`] = w / SEEDS;
    }
  }
  const perChar = {};
  for (const id of CHARACTER_IDS) {
    const asP = CHARACTER_IDS.filter((o) => o !== id).map((o) => byMatchup[`${id}>${o}`]);
    const asA = CHARACTER_IDS.filter((o) => o !== id).map((o) => 1 - byMatchup[`${o}>${id}`]);
    perChar[id] = { asPlayer: mean(asP), asAI: mean(asA), strength: (mean(asP) + mean(asA)) / 2 };
  }
  const cellsAll = Object.values(byMatchup);
  const settled = cellsAll.filter((r) => r >= 0.95 || r <= 0.05).length;
  const aggregate = mean(cellsAll);
  const byRarity = {};
  for (const tier of RARITY_ORDER) {
    const ids = CHARACTER_IDS.filter((id) => CHARACTERS[id].rarity === tier);
    if (ids.length) byRarity[tier] = mean(ids.map((id) => perChar[id].strength));
  }
  const tierVals = Object.values(byRarity);
  const tierSpread = (Math.max(...tierVals) - Math.min(...tierVals)) * 100;

  if (args['verify-roster']) {
    const ref = JSON.parse(readFileSync(String(args['verify-roster']), 'utf8'));
    const refCells = ref.policies?.[POLICY]?.matchupRates;
    if (!refCells) { console.error(`no matchupRates for ${POLICY} in the reference json`); process.exit(1); }
    let bad = 0;
    for (const k of Object.keys(byMatchup)) if (byMatchup[k] !== refCells[k]) bad++;
    console.log(`\n   VERIFY vs roster_lab: ${110 - bad}/110 cells bit-identical${bad ? `  ** ${bad} DIFFER **` : ''}`);
    if (bad) process.exit(1);
  }

  console.log(`\n══ BURGER LAB --roster ══  policy ${POLICY}  ·  ${SEEDS} seeds x 110 matchups = ${SEEDS * 110} matches`);
  console.log(`   sim ${SIM_DIR === `${ROOT}/src/game` ? 'working tree' : SIM_DIR}${PLAYER_HEALS ? '   ⚠️ --player-heals' : ''}`);
  console.log(`\n   GUARDS   settled ${settled}/110   ·   rarity tier spread ${tierSpread.toFixed(2)} pp   ·   aggregate player win ${(aggregate * 100).toFixed(1)}%`);
  console.log(`\n   ${'character'.padEnd(13)}${'asPlayer'.padStart(10)}${'asAI'.padStart(9)}${'strength'.padStart(10)}${'ROLE SPLIT'.padStart(12)}`);
  const ordered = [...CHARACTER_IDS].sort((a, b) =>
    Math.abs(perChar[b].asAI - perChar[b].asPlayer) - Math.abs(perChar[a].asAI - perChar[a].asPlayer));
  for (const id of ordered) {
    const c = perChar[id];
    const split = (c.asAI - c.asPlayer) * 100;
    console.log(`   ${id.padEnd(13)}${pctOf(c.asPlayer).padStart(10)}${pctOf(c.asAI).padStart(9)}${pctOf(c.strength).padStart(10)}${`${split >= 0 ? '+' : ''}${split.toFixed(1)} pp`.padStart(12)}`);
  }
  console.log(`\n   ${'tier'.padEnd(13)}${'strength'.padStart(10)}`);
  for (const [t, v] of Object.entries(byRarity)) console.log(`   ${t.padEnd(13)}${pctOf(v).padStart(10)}`);
  console.log('');
  if (args.json) {
    writeFileSync(String(args.json), JSON.stringify({
      mode: 'roster', policy: POLICY, seeds: SEEDS, sim: SIM_DIR, playerHeals: PLAYER_HEALS,
      settled, tierSpread, aggregate, perChar, byRarity, cells: byMatchup,
    }, null, 1));
    console.log(`   wrote ${args.json}\n`);
  }
  process.exit(0);
}
function pctOf(x) { return `${(x * 100).toFixed(1)}%`; }

// ─────────────────────────────────────────────────────────────────────────────
// The default run: one character, both roles, all ten opponents.
// ─────────────────────────────────────────────────────────────────────────────
if (!arena) { console.error(`no arena at ${ARENA_PATH}`); process.exit(1); }
if (!CHARACTER_IDS.includes(CHAR)) { console.error(`unknown character ${CHAR}`); process.exit(1); }

const others = CHARACTER_IDS.filter((id) => id !== CHAR);
const halves = { player: [], enemy: [] };
const cells = [];

for (const other of others) {
  for (const roleOfChar of ['player', 'enemy']) {
    const playerId = roleOfChar === 'player' ? CHAR : other;
    const enemyId = roleOfChar === 'player' ? other : CHAR;
    let wins = 0;
    const rs = [];
    for (let s = 0; s < SEEDS; s++) {
      const r = runMatch(playerId, enemyId, POLICY, s);
      rs.push(r);
      // "wins" is always from CHAR's point of view, whichever end it is on.
      if (r.winner === roleOfChar) wins++;
    }
    halves[roleOfChar].push(...rs.map((r) => ({ r, other, roleOfChar })));
    cells.push({ other, roleOfChar, rate: wins / SEEDS });
  }
}

/** Aggregate CHAR's own side and its opponent's side over one half. */
function rollup(list) {
  const own = (r, role) => r.side[role];
  const acc = {
    n: list.length,
    presses: {}, dealt: {}, dealtTotal: 0, healedBySelf: 0, healedByRegen: 0,
    splats: 0, slowApplied: 0, stunApplied: 0,
    terrainSlowTicks: 0, statusSlowTicks: 0, stunTicks: 0, travel: 0,
    oppTerrainSlowTicks: 0, oppStatusSlowTicks: 0, oppStunTicks: 0, oppDealtTotal: 0, oppTravel: 0,
    playTicks: 0, meanSeparation: [], firstDamageMs: [], dutyCycle: [], playMs: [],
    hpFrac: [], oppHpFrac: [],
  };
  for (const { r, roleOfChar } of list) {
    const me = own(r, roleOfChar);
    const opp = own(r, roleOfChar === 'player' ? 'enemy' : 'player');
    for (const [k, v] of Object.entries(me.presses)) acc.presses[k] = (acc.presses[k] ?? 0) + v;
    for (const [k, v] of Object.entries(me.dealt)) acc.dealt[k] = (acc.dealt[k] ?? 0) + v;
    acc.dealtTotal += me.dealtTotal; acc.healedBySelf += me.healedBySelf;
    acc.healedByRegen += me.healedByRegen; acc.splats += me.splats;
    acc.slowApplied += me.slowApplied; acc.stunApplied += me.stunApplied;
    acc.terrainSlowTicks += me.terrainSlowTicks; acc.statusSlowTicks += me.statusSlowTicks;
    acc.stunTicks += me.stunTicks; acc.travel += me.travel;
    acc.oppTerrainSlowTicks += opp.terrainSlowTicks; acc.oppStatusSlowTicks += opp.statusSlowTicks;
    acc.oppStunTicks += opp.stunTicks; acc.oppDealtTotal += opp.dealtTotal; acc.oppTravel += opp.travel;
    acc.playTicks += r.playTicks;
    acc.meanSeparation.push(r.meanSeparation);
    acc.dutyCycle.push(r.dutyCycle);
    acc.playMs.push(r.playMs);
    if (me.firstDamageMs !== null) acc.firstDamageMs.push(me.firstDamageMs);
    acc.hpFrac.push(r.hpLeft[roleOfChar] / r.maxHp[roleOfChar]);
    const or = roleOfChar === 'player' ? 'enemy' : 'player';
    acc.oppHpFrac.push(r.hpLeft[or] / r.maxHp[or]);
  }
  return acc;
}

const P = rollup(halves.player);
const E = rollup(halves.enemy);
const rate = (role) => mean(cells.filter((c) => c.roleOfChar === role).map((c) => c.rate));
const pRate = rate('player'), eRate = rate('enemy');

const pct = (x) => `${(x * 100).toFixed(1)}%`;
const per = (v, a) => (a.n ? v / a.n : 0);
const tickPct = (v, a) => (a.playTicks ? (v / a.playTicks) * 100 : 0);

console.log(`\n══ BURGER LAB ══  ${CHAR}  ·  policy ${POLICY}  ·  ${SEEDS} seeds x 10 opponents x 2 roles`);
console.log(`   sim ${SIM_DIR === `${ROOT}/src/game` ? 'working tree' : SIM_DIR}   arena ${ARENA_PATH.split('/').pop()}`);
if (driver.isHistorical) console.log('   ⚠️  HISTORICAL DRIVER — these numbers are not current.');

console.log(`\n   ROLE SPLIT   in the PLAYER's hands ${pct(pRate)}   ·   in the AI's ${pct(eRate)}   ·   split ${((eRate - pRate) * 100).toFixed(1)} pp`);

const rows = [
  ['win rate', pct(pRate), pct(eRate)],
  ['damage dealt / match', per(P.dealtTotal, P).toFixed(1), per(E.dealtTotal, E).toFixed(1)],
  ['damage taken / match', per(P.oppDealtTotal, P).toFixed(1), per(E.oppDealtTotal, E).toFixed(1)],
  ['HP frac left', mean(P.hpFrac).toFixed(3), mean(E.hpFrac).toFixed(3)],
  ['self-heal HP / match', per(P.healedBySelf, P).toFixed(1), per(E.healedBySelf, E).toFixed(1)],
  ['regen HP / match', per(P.healedByRegen, P).toFixed(1), per(E.healedByRegen, E).toFixed(1)],
  ['splats laid / match', per(P.splats, P).toFixed(1), per(E.splats, E).toFixed(1)],
  ['slow STARTED on opp / match', per(P.slowApplied, P).toFixed(2), per(E.slowApplied, E).toFixed(2)],
  ['stun STARTED on opp / match', per(P.stunApplied, P).toFixed(2), per(E.stunApplied, E).toFixed(2)],
  ['OPP ticks in terrain slow %', tickPct(P.oppTerrainSlowTicks, P).toFixed(2), tickPct(E.oppTerrainSlowTicks, E).toFixed(2)],
  ['OWN ticks in terrain slow %', tickPct(P.terrainSlowTicks, P).toFixed(2), tickPct(E.terrainSlowTicks, E).toFixed(2)],
  ['OPP ticks status-slowed %', tickPct(P.oppStatusSlowTicks, P).toFixed(2), tickPct(E.oppStatusSlowTicks, E).toFixed(2)],
  ['OWN ticks status-slowed %', tickPct(P.statusSlowTicks, P).toFixed(2), tickPct(E.statusSlowTicks, E).toFixed(2)],
  ['OPP ticks stunned %', tickPct(P.oppStunTicks, P).toFixed(2), tickPct(E.oppStunTicks, E).toFixed(2)],
  ['OWN ticks stunned %', tickPct(P.stunTicks, P).toFixed(2), tickPct(E.stunTicks, E).toFixed(2)],
  ['mean separation wu', mean(P.meanSeparation).toFixed(1), mean(E.meanSeparation).toFixed(1)],
  ['duty cycle', mean(P.dutyCycle).toFixed(3), mean(E.dutyCycle).toFixed(3)],
  ['time to first damage s', (mean(P.firstDamageMs) / 1000).toFixed(2), (mean(E.firstDamageMs) / 1000).toFixed(2)],
  ['travel wu / match', per(P.travel, P).toFixed(0), per(E.travel, E).toFixed(0)],
  ['match length s', (mean(P.playMs) / 1000).toFixed(1), (mean(E.playMs) / 1000).toFixed(1)],
];
console.log(`\n   ${'quantity'.padEnd(30)} ${'PLAYER hands'.padStart(13)} ${'AI hands'.padStart(13)}`);
for (const [k, a, b] of rows) console.log(`   ${k.padEnd(30)} ${String(a).padStart(13)} ${String(b).padStart(13)}`);

const keys = [...new Set([...Object.keys(P.presses), ...Object.keys(E.presses)])];
console.log(`\n   ${'weapon'.padEnd(12)} ${'P presses'.padStart(10)} ${'P damage'.padStart(10)} ${'A presses'.padStart(10)} ${'A damage'.padStart(10)}`);
for (const k of keys) {
  console.log(`   ${k.padEnd(12)} ${per(P.presses[k] ?? 0, P).toFixed(2).padStart(10)} ${per(P.dealt[k] ?? 0, P).toFixed(1).padStart(10)} ${per(E.presses[k] ?? 0, E).toFixed(2).padStart(10)} ${per(E.dealt[k] ?? 0, E).toFixed(1).padStart(10)}`);
}

console.log(`\n   per-opponent cell rates (${CHAR}'s win rate at each end)`);
console.log(`   ${'opponent'.padEnd(13)} ${'as PLAYER'.padStart(10)} ${'as AI'.padStart(10)}`);
for (const other of others) {
  const p = cells.find((c) => c.other === other && c.roleOfChar === 'player').rate;
  const e = cells.find((c) => c.other === other && c.roleOfChar === 'enemy').rate;
  const settled = (r) => (r >= 0.95 ? ' ≥95' : r <= 0.05 ? ' ≤5' : '');
  console.log(`   ${other.padEnd(13)} ${pct(p).padStart(10)}${settled(p).padEnd(4)} ${pct(e).padStart(10)}${settled(e)}`);
}
console.log('');

if (args.json) {
  writeFileSync(String(args.json), JSON.stringify({
    char: CHAR, policy: POLICY, seeds: SEEDS, sim: SIM_DIR,
    pRate, eRate, splitPP: (eRate - pRate) * 100, cells, P, E,
  }, null, 1));
  console.log(`   wrote ${args.json}\n`);
}
