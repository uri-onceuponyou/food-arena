#!/usr/bin/env node
/**
 * BM_LAB — WHAT DECIDES A MATCH, and what the 3.3x clock did to it.
 *
 * ── Why a new instrument rather than another flag on `roster_lab` ───────────
 *
 * `roster_lab` answers "who wins". This pass has to answer "**what decided it**", and
 * that question needs three splits no existing tool makes:
 *
 *   1. **FOG vs SUDDEN-DEATH FOG.** Both emit `{ kind: 'fog' }` — `sim.ts:applyWorldTick`
 *      and `sim.ts:applySuddenDeathFog` deliberately share the predicate and the source
 *      tag. Every existing tool therefore reports one number where the schedule change
 *      created two populations. The split here is by `playMs >= SUDDEN_DEATH_MS`, read
 *      from the tree under test, so each arm is classified by **its own** rule.
 *   2. **REGEN vs a DELIBERATE HEAL.** Both emit `type: 'heal'`. `audio/director.ts`
 *      splits them on `amount <= REGEN_AMOUNT` and this file spells it the same way.
 *      Out-of-combat regen over 150 s is 3.3x what it was over 45 s; that is the whole
 *      reason this tool exists.
 *   3. **CAUSE OF THE KILLING BLOW**, per death, not per match. `roster_lab.mjs` has a
 *      `killedBy` field, but it is assigned inside the event loop from
 *      `state[role].hp === 0` — which reads the hp AFTER every event of the tick has been
 *      applied, so a fighter finished by a weapon on the same tick it also took a fog
 *      tick is attributed to whichever event came last. Here the last damage source per
 *      fighter is latched on every `hit-landed` and read when its `death` arrives.
 *
 * ── THE OPENING RADIUS IS DERIVED FROM THE TREE UNDER TEST, NOT COPIED ──────
 *
 * 🚨 47 tools carry `Math.round(halfDiag / (1 - 6000 / MATCH_DURATION_MS))`
 * (`tools/tmp/fs_sched_census.mjs` enumerates them). That expression WAS the shipped
 * derivation and on the 45 s clock it returns 1985, which is right. On the 150 s clock it
 * returns **1792** against a shipped **1720.4651** — 4.2% high, plausible, silent, and
 * inside every balance instrument. A tool that hardcodes either number measures one arm
 * of an A/B correctly and the other wrongly.
 *
 * So the ring is derived through `rules.fogOpeningRadiusFor` **when the tree exports it**
 * and through the superseded expression when it does not — i.e. each arm gets the
 * derivation its own `arena/shared.ts` ships, and neither is written here as a literal.
 * Same shape as `roster_lab`'s `maxHpFor` fallback, same reason. `--maxsafe` overrides
 * both and is printed when used.
 *
 * ── The driver is IMPORTED ─────────────────────────────────────────────────
 * `tools/tmp/scripted_player.mjs`, never copied. `driver_guard.mjs` fails on a copy.
 *
 * ── Use ────────────────────────────────────────────────────────────────────
 *   node tools/tmp/bm_lab.mjs --selftest
 *   node tools/tmp/bm_lab.mjs --sim /tmp/fa-bm-before/src/game --seeds 8 --json before.json
 *   node tools/tmp/bm_lab.mjs --seeds 8 --json after.json
 *   node tools/tmp/bm_ab.mjs before.json after.json
 *
 * ⚠️ RESOLUTION FLOORS. An AGGREGATE win rate is unresolvable below ~9 pp; pacing below
 * ~0.8 s of contact / ~4 pp dead time. A PAIRED per-cell delta on identical seeds is
 * EXACT and is a DIFFERENT QUANTITY — this tool prints both, labelled, and never adds
 * them.
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
  CHARACTERS, CHARACTER_IDS, MATCH_DURATION_MS, SUDDEN_DEATH_MS, REACH,
  HIT_RADIUS_VS_PLAYER, HIT_RADIUS_VS_ENEMY, PLAYER_MAX_HP, ENEMY_MAX_HP, PLAYER_SPEED,
  COUNTDOWN_FROM, COUNTDOWN_START_FLASH_MS, REGEN_AMOUNT, REGEN_DELAY_MS, REGEN_TICK_MS,
  MIN_SAFE_RADIUS,
} = RULES;

/**
 * The ring the tree under test actually opens at. See the header: this is the one number
 * that an A/B across this change gets silently wrong, in exactly one arm.
 */
function openingRadiusFor(halfDiag) {
  if (args.maxsafe !== undefined) return Number(args.maxsafe);
  if (typeof RULES.fogOpeningRadiusFor === 'function') return RULES.fogOpeningRadiusFor(halfDiag);
  // The superseded derivation, kept because it is what `arena/shared.ts` SHIPPED on any
  // tree that has no `fogOpeningRadiusFor` — reproducing that tree faithfully is the job.
  return Math.round(halfDiag / (1 - 6000 / MATCH_DURATION_MS));
}

const ARENA_PATH = String(args.arena ?? `${ROOT}/tools/arena.gameplay.json`);
const ARENA_DATA = existsSync(ARENA_PATH) ? JSON.parse(readFileSync(ARENA_PATH, 'utf8')) : null;
const HALF_DIAG = ARENA_DATA ? Math.hypot(ARENA_DATA.width / 2, ARENA_DATA.height / 2) : 0;
let arena = ARENA_DATA ? {
  ...ARENA_DATA,
  maxSafeRadius: openingRadiusFor(HALF_DIAG),
  build: () => null, update: () => {},
} : null;

const DT = Number(args.dt ?? 16.667);
const SEEDS = Number(args.seeds ?? 8);
const POLICIES = String(args.policies ?? 'smart2,chase').split(',');
const dist = (ax, ay, bx, by) => Math.hypot(ax - bx, ay - by);
const mean = (a) => (a.length ? a.reduce((x, y) => x + y, 0) / a.length : 0);
const pct = (n, d) => (d ? (100 * n) / d : 0);

const DRIVER_FLAGS = parseDriverFlags(args);
const driverFor = (a) => createScriptedPlayer({ CHARACTERS, REACH, arena: a, ...DRIVER_FLAGS });
let driver = arena ? driverFor(arena) : null;

// ─────────────────────────────────────────────────────────────────────────────
// ONE MATCH, fully attributed.
// ─────────────────────────────────────────────────────────────────────────────
/**
 * The seed formula is `roster_lab.mjs`'s / `pacing_ladder.mjs`'s, unchanged, so a cell
 * here is the SAME match as a cell there and `--selftest` can check that against a figure
 * neither tool computed.
 */
function runMatch(playerId, enemyId, policy, seed, { beforeTick = null } = {}) {
  const rnd = rng(seed * 7919 + playerId.length * 131 + enemyId.length * 17 + policy.length);
  const state = createMatch(arena, playerId, enemyId);
  const decide = driver.POLICY_FNS[policy](rnd);
  const loop = driver.createDecisionLoop({ decide, reactBase: 150, reactJit: seed === 0 ? 0 : 60, rnd });

  const pReach = driver.maxNormalRange(playerId), eReach = driver.maxNormalRange(enemyId);
  const engageRange = Math.max(pReach + HIT_RADIUS_VS_ENEMY, eReach + HIT_RADIUS_VS_PLAYER);

  let countdownMs = null, playTicks = 0, engagedTicks = 0, contactPlayMs = null, contactTick = null;
  let winner = null, endedAt = null, sawDeath = false;
  // Damage, split the four ways the schedule change created.
  const dmg = { weapon: 0, trail: 0, hazard: 0, fog: 0, fogSudden: 0 };
  const heal = { regen: 0, deliberate: 0, regenTicks: 0 };
  // Last damage source per fighter slot, latched on every hit and read at `death`.
  const lastSource = new Map();
  let killCause = null;              // what finished the FIRST fighter to die
  let reachedSuddenDeath = false;    // did play time ever cross SUDDEN_DEATH_MS
  let hardCapped = false;
  let peakPlayMs = 0;

  const HARD_CAP = MATCH_DURATION_MS * 1.6 + 20000;

  while (state.phase !== 'ended' && state.elapsed < HARD_CAP) {
    if (beforeTick) beforeTick(state);
    const playMsNow = MATCH_DURATION_MS - state.timeRemaining;
    // Read the phase-of-schedule BEFORE the step, because `stepMatch` is what advances
    // the clock past the boundary, and a fog tick emitted during this step was decided
    // against the ring this tick opened with.
    const suddenNow = state.phase === 'playing' && playMsNow >= SUDDEN_DEATH_MS;
    if (state.phase === 'playing') {
      peakPlayMs = Math.max(peakPlayMs, playMsNow);
      if (suddenNow) reachedSuddenDeath = true;
    }

    const evs = stepMatch(state, DT, loop.next(state, DT));

    for (const ev of evs) {
      if (ev.type === 'match-started') countdownMs = state.elapsed;
      else if (ev.type === 'match-ended') { winner = ev.winner; endedAt = state.elapsed; }
      else if (ev.type === 'hit-landed') {
        const k = ev.source?.kind;
        const bucket = k === 'fog' ? (suddenNow ? 'fogSudden' : 'fog') : k;
        if (dmg[bucket] === undefined) dmg[bucket] = 0;
        dmg[bucket] += ev.amount;
        lastSource.set(ev.targetId, bucket);
      } else if (ev.type === 'heal') {
        // `audio/director.ts`'s split, spelled the same way: regen ticks REGEN_AMOUNT.
        if (ev.amount <= REGEN_AMOUNT) { heal.regen += ev.amount; heal.regenTicks++; }
        else heal.deliberate += ev.amount;
      } else if (ev.type === 'death') {
        sawDeath = true;
        if (killCause === null) killCause = lastSource.get(ev.fighterId) ?? 'unknown';
      }
    }

    if (state.phase === 'playing') {
      playTicks++;
      const engaged = dist(state.player.x, state.player.y, state.enemy.x, state.enemy.y) <= engageRange;
      if (engaged) {
        engagedTicks++;
        if (contactPlayMs === null) {
          // ⚠️ TWO SPELLINGS OF "WHEN DID THEY MEET", AND ONLY ONE OF THEM CAN BE PAIRED.
          //
          // `MATCH_DURATION_MS - state.timeRemaining` is `roster_lab`'s spelling and is
          // kept, because it is what every published contact figure here means. But
          // `MATCH_DURATION_MS` is 45_000 on one arm and 150_000 on the other, so the
          // SAME instant subtracts in a different float regime and lands ~1.5e-8 ms
          // apart. Measured: pairing on it reported **1760 of 1760 cells moved, 0.00%
          // bit-identical** — a catastrophic-looking headline produced entirely by the
          // metric's own arithmetic, on a run where 2 winners and 14 causes actually
          // changed. `contactTick` is an integer count of PLAY ticks and is identical
          // across arms by construction; that is what `bm_ab` pairs on.
          contactPlayMs = MATCH_DURATION_MS - state.timeRemaining;
          contactTick = playTicks;
        }
      }
    }
  }
  if (state.phase !== 'ended') hardCapped = true;

  const playMs = countdownMs === null ? 0 : (endedAt ?? state.elapsed) - countdownMs;

  /**
   * ── THE ENDING TAXONOMY, and why it has five rungs and not three ─────────
   * `ko-weapon` / `ko-trail` / `ko-hazard` — a fighter was killed by play.
   * `ko-fog`        — killed by the ORDINARY closing ring: the schedule decided it.
   * `ko-fogSudden`  — killed after `SUDDEN_DEATH_MS`: the collapse decided it.
   * `timeout`       — nobody died; `resolveTimeout` ranked them. On the 45 s tree this
   *                   was structurally unreachable (the fog always resolved first) and
   *                   STATE.md records 0 in 880.
   * `UNRESOLVED`    — the hard cap fired. Must be zero; it is the stalemate row.
   */
  let ending;
  if (hardCapped) ending = 'UNRESOLVED';
  else if (sawDeath) ending = `ko-${killCause}`;
  else ending = 'timeout';

  const totalDmg = Object.values(dmg).reduce((a, b) => a + b, 0);
  return {
    playerId, enemyId, policy, seed, winner, ending,
    countdownMs: countdownMs ?? 0, playMs, peakPlayMs,
    sessionMs: (countdownMs ?? 0) + playMs,
    contactPlayMs, contactTick,
    engagedMs: engagedTicks * DT,
    playTickMs: playTicks * DT,
    dutyCycle: playTicks ? engagedTicks / playTicks : 0,
    dmg, totalDmg, heal, reachedSuddenDeath,
    hpLeft: { player: state.player.hp, enemy: state.enemy.hp },
    maxHp: { player: state.player.maxHp, enemy: state.enemy.maxHp },
  };
}

// ─────────────────────────────────────────────────────────────────────────────
// SUMMARY
// ─────────────────────────────────────────────────────────────────────────────
function summarise(rows) {
  const n = rows.length;
  if (!n) throw new Error('summarise: empty row set — refusing to report over nothing');
  const endings = {};
  for (const r of rows) endings[r.ending] = (endings[r.ending] ?? 0) + 1;
  const sum = (f) => rows.reduce((a, r) => a + f(r), 0);
  const dmgTot = {
    weapon: sum((r) => r.dmg.weapon), trail: sum((r) => r.dmg.trail),
    hazard: sum((r) => r.dmg.hazard), fog: sum((r) => r.dmg.fog),
    fogSudden: sum((r) => r.dmg.fogSudden),
  };
  const allDmg = Object.values(dmgTot).reduce((a, b) => a + b, 0);
  const contact = rows.filter((r) => r.contactPlayMs !== null);
  return {
    n,
    endings,
    // Decided-by, collapsed to the three the brief asks for.
    decidedByCombat: pct(rows.filter((r) => r.ending === 'ko-weapon' || r.ending === 'ko-trail').length, n),
    decidedByHazard: pct(rows.filter((r) => r.ending === 'ko-hazard').length, n),
    decidedByFog: pct(rows.filter((r) => r.ending === 'ko-fog').length, n),
    decidedBySuddenDeath: pct(rows.filter((r) => r.ending === 'ko-fogSudden').length, n),
    decidedByTimeout: pct(rows.filter((r) => r.ending === 'timeout').length, n),
    unresolved: rows.filter((r) => r.ending === 'UNRESOLVED').length,
    reachedSuddenDeathPct: pct(rows.filter((r) => r.reachedSuddenDeath).length, n),
    meanPlayS: mean(rows.map((r) => r.playMs)) / 1000,
    meanSessionS: mean(rows.map((r) => r.sessionMs)) / 1000,
    medianPlayS: [...rows.map((r) => r.playMs)].sort((a, b) => a - b)[Math.floor(n / 2)] / 1000,
    // Pacing. `noContact` is counted rather than dropped: a match with no contact at all
    // is the single most important pacing outcome and averaging it away hides it.
    noContact: n - contact.length,
    meanContactS: contact.length ? mean(contact.map((r) => r.contactPlayMs)) / 1000 : null,
    // % of PLAY time inside engage range, and its complement.
    withinReachPct: pct(sum((r) => r.engagedMs), sum((r) => r.playTickMs)),
    deadTimePct: 100 - pct(sum((r) => r.engagedMs), sum((r) => r.playTickMs)),
    // Absolute seconds of walking per match, which is the figure STATE.md quotes.
    meanWalkS: (sum((r) => r.playTickMs - r.engagedMs) / n) / 1000,
    dmgTot, allDmg,
    fogSharePct: pct(dmgTot.fog + dmgTot.fogSudden, allDmg),
    fogOrdinarySharePct: pct(dmgTot.fog, allDmg),
    fogSuddenSharePct: pct(dmgTot.fogSudden, allDmg),
    hazardSharePct: pct(dmgTot.hazard, allDmg),
    regenTot: sum((r) => r.heal.regen),
    deliberateHealTot: sum((r) => r.heal.deliberate),
    meanRegenPerMatch: sum((r) => r.heal.regen) / n,
    // The stalemate metric: regen HP as a share of all damage dealt. > 100% means the
    // roster heals faster than it hurts over a whole match population.
    regenVsDamagePct: pct(sum((r) => r.heal.regen) + sum((r) => r.heal.deliberate), allDmg),
    meanHpLeftFrac: mean(rows.map((r) => (r.hpLeft.player + r.hpLeft.enemy) / (r.maxHp.player + r.maxHp.enemy))),
    playerWinPct: pct(rows.filter((r) => r.winner === 'player').length, n),
  };
}

// ─────────────────────────────────────────────────────────────────────────────
// --selftest
// ─────────────────────────────────────────────────────────────────────────────
if (args.selftest) {
  let pass = 0, fail = 0;
  const ok = (name, cond, detail = '') => {
    if (cond) { pass++; console.log(`   PASS  ${name}${detail ? `  ${detail}` : ''}`); }
    else { fail++; console.log(`   FAIL  ${name}${detail ? `  ${detail}` : ''}`); }
  };
  console.log(`\n══ bm_lab SELFTEST ══  sim ${SIM_DIR === `${ROOT}/src/game` ? 'working tree' : SIM_DIR}`);
  console.log(`   clock ${MATCH_DURATION_MS / 1000}s · sudden death ${SUDDEN_DEATH_MS / 1000}s · ring opens ${arena ? arena.maxSafeRadius : 'n/a'}`);

  // ── A. THE OPENING RADIUS. The one number an A/B across this change gets wrong.
  {
    const halfDiag = Math.hypot(1400, 1000);
    const derived = openingRadiusFor(halfDiag);
    const superseded = Math.round(halfDiag / (1 - 6000 / MATCH_DURATION_MS));
    if (typeof RULES.fogOpeningRadiusFor === 'function') {
      // KNOWN-BAD: the superseded expression, which 47 tools still carry. It must
      // DISAGREE here, or this assertion is checking nothing.
      ok('on a tree with fogOpeningRadiusFor, the derivation is the half-diagonal',
        Math.abs(derived - halfDiag) < 1e-9, `${derived.toFixed(4)}`);
      ok('…and the superseded expression 47 tools carry is DIFFERENT (known-bad separates)',
        Math.abs(derived - superseded) > 1, `derived ${derived.toFixed(4)} vs superseded ${superseded}`);
    } else {
      ok('on a pre-change tree, the derivation reproduces the shipped shared.ts expression',
        derived === superseded && derived === 1985, `${derived}`);
      ok('…and it is NOT the half-diagonal (the two eras are distinguishable)',
        Math.abs(derived - halfDiag) > 1, `derived ${derived} vs halfDiag ${halfDiag.toFixed(4)}`);
    }
  }

  // A synthetic arena with derivable answers. The driver must be REBOUND to it — it
  // captures cover and hazards at construction.
  const CLEAR = {
    id: 'selftest', displayName: 'selftest', width: 1400, height: 1000,
    center: { x: 700, y: 500 }, maxSafeRadius: 5000,
    playerSpawn: { x: 200, y: 500 }, enemySpawn: { x: 1000, y: 500 },
    cover: [], hazards: [], build: () => null, update: () => {},
  };
  const savedArena = arena, savedDriver = driver;
  arena = CLEAR; driver = driverFor(CLEAR);

  // ── B. THE TAXONOMY IS REACHABLE FROM BOTH ENDS.
  {
    const r = runMatch('hamburger', 'hamburger', 'idle', 0);
    ok('an idle player never wins (the outcome plumbing is not inverted)',
      r.winner === 'enemy', `winner=${r.winner} ending=${r.ending}`);
    ok('…and that death is attributed to a WEAPON, not to the fog (a 5000 wu ring never bites)',
      r.ending === 'ko-weapon', `ending=${r.ending}`);
  }
  {
    const r = runMatch('hamburger', 'donut', 'chase', 0, {
      beforeTick: (s) => { if (s.phase === 'playing') { s.enemy.hp = Math.min(s.enemy.hp, 1); s.player.hp = s.player.maxHp; } },
    });
    ok('an enemy pinned at 1 HP loses — both outcomes are reachable', r.winner === 'player', `winner=${r.winner}`);
  }

  // ── C. KNOWN-BAD: A RING THAT MUST KILL. The fog attribution has to FAIL to say
  //      "ko-weapon" when the ring is squeezed onto the spawns, or it is not measuring
  //      the fog at all — it is reporting the only label it ever emits.
  {
    const TIGHT = { ...CLEAR, maxSafeRadius: 1, id: 'tight' };
    const sa = arena, sd = driver;
    arena = TIGHT; driver = driverFor(TIGHT);
    const r = runMatch('hamburger', 'hamburger', 'idle', 0);
    arena = sa; driver = sd;
    ok('KNOWN-BAD: a 1 wu ring kills, and it is attributed to the FOG, not to a weapon',
      r.ending === 'ko-fog' || r.ending === 'ko-fogSudden', `ending=${r.ending} fogDmg=${r.dmg.fog + r.dmg.fogSudden}`);
    ok('…and that match records ZERO weapon damage (the buckets do not leak)',
      r.dmg.weapon === 0, `weapon=${r.dmg.weapon}`);
  }

  // ── D. THE FOG / SUDDEN-DEATH SPLIT IS A REAL SPLIT.
  //      Squeeze the ring only AFTER sudden death has begun: every fog point must land
  //      in `fogSudden` and none in `fog`. The mirror — a match that ends long before
  //      SUDDEN_DEATH_MS — must put zero in `fogSudden`. Two arms, opposite verdicts,
  //      so a tool that wrote everything into one bucket fails one of them.
  {
    const r = runMatch('hamburger', 'hamburger', 'idle', 0);
    ok('a match decided well before SUDDEN_DEATH_MS books NOTHING as sudden-death damage',
      r.dmg.fogSudden === 0 && r.playMs < SUDDEN_DEATH_MS,
      `fogSudden=${r.dmg.fogSudden} playMs=${(r.playMs / 1000).toFixed(1)}s < ${SUDDEN_DEATH_MS / 1000}s`);
  }
  {
    // Both fighters immortal until sudden death, then let it resolve them.
    const r = runMatch('hamburger', 'hamburger', 'idle', 0, {
      beforeTick: (s) => {
        const play = MATCH_DURATION_MS - s.timeRemaining;
        if (s.phase === 'playing' && play < SUDDEN_DEATH_MS) {
          s.player.hp = s.player.maxHp; s.enemy.hp = s.enemy.maxHp;
        }
      },
    });
    ok('KNOWN-BAD MIRROR: a match forced past SUDDEN_DEATH_MS books sudden-death damage, and reaches it',
      r.reachedSuddenDeath && r.dmg.fogSudden > 0, `fogSudden=${r.dmg.fogSudden} reached=${r.reachedSuddenDeath}`);
  }

  // ── E. REGEN IS SEPARATED FROM A DELIBERATE HEAL, and the separator is not vacuous.
  {
    // Two fighters that never meet: a huge arena, idle player, and the AI parked. The
    // point is only that regen ticks are BOOKED, and booked as regen.
    const FAR = {
      ...CLEAR, id: 'far', width: 20000, height: 20000, center: { x: 10000, y: 10000 },
      playerSpawn: { x: 100, y: 100 }, enemySpawn: { x: 19900, y: 19900 }, maxSafeRadius: 50000,
    };
    const sa = arena, sd = driver;
    arena = FAR; driver = driverFor(FAR);
    const r = runMatch('hamburger', 'hamburger', 'idle', 0, {
      beforeTick: (s) => { if (s.phase === 'playing' && s.player.hp === s.player.maxHp) s.player.hp = 1; },
    });
    arena = sa; driver = sd;
    ok('regen ticks are booked as REGEN and none of them as a deliberate heal',
      r.heal.regenTicks > 0 && r.heal.deliberate === 0,
      `regenTicks=${r.heal.regenTicks} regenHp=${r.heal.regen} deliberate=${r.heal.deliberate}`);
    /**
     * The tick count is derivable, and getting it wrong is instructive:
     *
     * ⚠️ The first draft of this row asserted `(playMs - REGEN_DELAY_MS) / REGEN_TICK_MS`
     * and FAILED at 469 observed against 452 predicted. The instrument was right and the
     * prediction was wrong: `sim.ts` gates regen on
     * `state.elapsed - fighter.lastDamagedAt > REGEN_DELAY_MS`, and **`state.elapsed`
     * includes the COUNTDOWN** while `playMs` does not. With `lastDamagedAt` still 0 at
     * the whistle, the delay is already 3,700 ms spent before play begins, so regen opens
     * at playMs ~300 rather than 4,000. Kept as a note because it is the same shape as
     * the `fogRadiusAt` docstring's warning about keying the ring off `elapsed`.
     *
     * Two-sided on purpose: an upper bound alone passes trivially for a tool that DROPS
     * heal events, which is the failure this row is really guarding against. The period
     * is `ceil(REGEN_TICK_MS / DT) * DT` = 200.004 ms, not 200, so a couple of ticks of
     * slack is arithmetic, not tolerance-guessing. Only ONE fighter regens here: nothing
     * ever damages the AI, so `hp < maxHp` is false for it on every tick.
     */
    const availableMs = r.playMs - Math.max(0, REGEN_DELAY_MS - r.countdownMs);
    const period = Math.ceil(REGEN_TICK_MS / DT) * DT;
    const expect = availableMs / period;
    ok('…and the tick COUNT lands on its derivable rate from BOTH sides (no double-count, no drop)',
      r.heal.regenTicks <= expect + 3 && r.heal.regenTicks >= expect - 3,
      `regenTicks=${r.heal.regenTicks} expected ${expect.toFixed(1)} (${(availableMs / 1000).toFixed(1)}s at ${period.toFixed(3)}ms)`);
  }

  // ── F. SUMMARY ARITHMETIC on a hand-built row set with an answer by hand.
  {
    const fake = [
      { ending: 'ko-weapon', winner: 'player', playMs: 10000, sessionMs: 13700, peakPlayMs: 10000, contactPlayMs: 3000, engagedMs: 5000, playTickMs: 10000, reachedSuddenDeath: false, dmg: { weapon: 100, trail: 0, hazard: 0, fog: 0, fogSudden: 0 }, heal: { regen: 10, deliberate: 0, regenTicks: 5 }, hpLeft: { player: 50, enemy: 0 }, maxHp: { player: 100, enemy: 100 } },
      { ending: 'ko-fog', winner: 'enemy', playMs: 30000, sessionMs: 33700, peakPlayMs: 30000, contactPlayMs: null, engagedMs: 0, playTickMs: 30000, reachedSuddenDeath: false, dmg: { weapon: 0, trail: 0, hazard: 0, fog: 100, fogSudden: 0 }, heal: { regen: 0, deliberate: 0, regenTicks: 0 }, hpLeft: { player: 0, enemy: 100 }, maxHp: { player: 100, enemy: 100 } },
    ];
    const s = summarise(fake);
    ok('fog share is fog+fogSudden over ALL damage, and the ordinary/sudden split sums to it',
      Math.abs(s.fogSharePct - 50) < 1e-9 && Math.abs(s.fogOrdinarySharePct + s.fogSuddenSharePct - s.fogSharePct) < 1e-9,
      `fogShare=${s.fogSharePct.toFixed(2)}%`);
    ok('dead time is the complement of within-reach over PLAY ticks, and no-contact rows are COUNTED not dropped',
      Math.abs(s.withinReachPct - 12.5) < 1e-9 && Math.abs(s.deadTimePct - 87.5) < 1e-9 && s.noContact === 1,
      `within ${s.withinReachPct.toFixed(2)}% dead ${s.deadTimePct.toFixed(2)}% noContact ${s.noContact}`);
    ok('decided-by percentages partition the row set (they sum to 100)',
      Math.abs(s.decidedByCombat + s.decidedByHazard + s.decidedByFog + s.decidedBySuddenDeath
        + s.decidedByTimeout + pct(s.unresolved, s.n) - 100) < 1e-9,
      `combat ${s.decidedByCombat} fog ${s.decidedByFog}`);
    // KNOWN-BAD for the empty-set trap: `[].every()` is true and `mean([])` is 0, so a
    // summary over nothing would report a confident 0% of everything.
    let threw = false;
    try { summarise([]); } catch { threw = true; }
    ok('KNOWN-BAD: summarising an EMPTY row set THROWS rather than reporting 0% of everything',
      threw);
  }

  arena = savedArena; driver = savedDriver;

  console.log(`\n   ${pass}/${pass + fail} assertions passed\n`);
  process.exit(fail ? 1 : 0);
}

// ─────────────────────────────────────────────────────────────────────────────
// THE SWEEP
// ─────────────────────────────────────────────────────────────────────────────
if (!arena) { console.error(`no arena at ${ARENA_PATH}`); process.exit(1); }

const rows = [];
const t0 = Date.now();
for (const policy of POLICIES) {
  for (const p of CHARACTER_IDS) {
    for (const e of CHARACTER_IDS) {
      if (p === e) continue;
      for (let s = 0; s < SEEDS; s++) rows.push(runMatch(p, e, policy, s));
    }
  }
}
const elapsed = (Date.now() - t0) / 1000;

const byPolicy = {};
for (const policy of POLICIES) byPolicy[policy] = summarise(rows.filter((r) => r.policy === policy));

// PAIRED CELL KEYS. A cell is one (policy, player, enemy, seed) — identical across arms
// by construction, which is what makes a per-cell delta EXACT rather than ~9 pp.
const cells = {};
for (const r of rows) {
  cells[`${r.policy}|${r.playerId}|${r.enemyId}|${r.seed}`] = {
    w: r.winner, end: r.ending, playMs: r.playMs, contact: r.contactTick,
    fog: r.dmg.fog + r.dmg.fogSudden, wpn: r.dmg.weapon + r.dmg.trail, regen: r.heal.regen,
    sd: r.reachedSuddenDeath ? 1 : 0,
  };
}

const out = {
  simDir: SIM_DIR,
  clockMs: MATCH_DURATION_MS, suddenDeathMs: SUDDEN_DEATH_MS,
  fogHoldMs: RULES.FOG_HOLD_MS ?? null, fogCloseMs: RULES.FOG_CLOSE_MS ?? null,
  openingRadius: arena.maxSafeRadius, minSafeRadius: MIN_SAFE_RADIUS,
  arena: { path: ARENA_PATH, w: arena.width, h: arena.height },
  regen: { REGEN_AMOUNT, REGEN_DELAY_MS, REGEN_TICK_MS },
  seeds: SEEDS, policies: POLICIES, dt: DT, matches: rows.length, elapsedS: elapsed,
  overall: summarise(rows), byPolicy, cells,
};

const H = (s) => `\n══ ${s} ══`;
console.log(H(`bm_lab  ${rows.length} matches in ${elapsed.toFixed(1)}s`));
console.log(`   sim ${SIM_DIR}`);
console.log(`   clock ${MATCH_DURATION_MS / 1000}s · sudden death ${SUDDEN_DEATH_MS / 1000}s`
  + `${RULES.FOG_HOLD_MS !== undefined ? ` · hold ${RULES.FOG_HOLD_MS / 1000}s · close ${RULES.FOG_CLOSE_MS / 1000}s` : ' · ring welded to clock'}`);
console.log(`   ring opens ${arena.maxSafeRadius.toFixed(4)} wu · floor ${MIN_SAFE_RADIUS} · arena ${arena.width}x${arena.height}`);
for (const [name, s] of [['OVERALL', out.overall], ...Object.entries(byPolicy).map(([k, v]) => [k, v])]) {
  console.log(H(name));
  console.log(`   n=${s.n}  mean play ${s.meanPlayS.toFixed(2)}s  median ${s.medianPlayS.toFixed(2)}s  session ${s.meanSessionS.toFixed(2)}s`);
  console.log(`   DECIDED BY   combat ${s.decidedByCombat.toFixed(1)}%  fog ${s.decidedByFog.toFixed(1)}%  suddenDeath ${s.decidedBySuddenDeath.toFixed(1)}%  hazard ${s.decidedByHazard.toFixed(1)}%  timeout ${s.decidedByTimeout.toFixed(1)}%  UNRESOLVED ${s.unresolved}`);
  console.log(`   reached sudden death: ${s.reachedSuddenDeathPct.toFixed(1)}% of matches`);
  console.log(`   DAMAGE       fog ${s.fogSharePct.toFixed(2)}% (ordinary ${s.fogOrdinarySharePct.toFixed(2)} + sudden ${s.fogSuddenSharePct.toFixed(2)})  hazard ${s.hazardSharePct.toFixed(2)}%  total ${Math.round(s.allDmg)}`);
  console.log(`   REGEN        ${s.meanRegenPerMatch.toFixed(1)} HP/match · all healing is ${s.regenVsDamagePct.toFixed(1)}% of all damage · mean HP left ${(100 * s.meanHpLeftFrac).toFixed(1)}%`);
  console.log(`   PACING       first contact ${s.meanContactS === null ? 'never' : s.meanContactS.toFixed(2) + 's'}  · no contact at all in ${s.noContact}/${s.n}  · within reach ${s.withinReachPct.toFixed(1)}%  dead ${s.deadTimePct.toFixed(1)}%  walking ${s.meanWalkS.toFixed(1)}s/match`);
  console.log(`   endings: ${Object.entries(s.endings).map(([k, v]) => `${k} ${v}`).join(' · ')}`);
}

if (typeof args.json === 'string') { writeFileSync(args.json, JSON.stringify(out, null, 1)); console.log(`\n   wrote ${args.json}`); }
