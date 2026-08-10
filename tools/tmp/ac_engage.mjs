#!/usr/bin/env node
/**
 * AC_ENGAGE — WHERE does each driver choose to stand, and what can the KIT deliver
 * from there?
 *
 * ── The question, and why this quantity and not another ─────────────────────
 *
 * `6cc2438` refused the Sushi/Legendary vitals pass with numbers and left exactly one
 * lead: Sushi's role split is +30.7 pp (asPlayer 59.1%, asAI 28.4% — the roster's worst
 * AI half), Water Bottle's is +15.7 pp, and both are Legendary. *"Legendary is not weak
 * — the AI cannot play it."*
 *
 * `burger_lab.mjs` reports the realised MECHANICS of both halves and it was run first.
 * For Water Bottle it returns a result that rules out the obvious story: in the AI's
 * hands it deals MORE damage (103.5 vs 94.4), takes LESS (91.3 vs 95.8), and starts MORE
 * slows and MORE stuns than in the player's — and still loses 15.6 pp more often. So the
 * AI is not shooting worse. Something upstream of the shooting is different.
 *
 * The thing upstream is POSITION, and it is the one quantity neither existing lab prints.
 * `scripted_player.mjs:makeDecisionTree` holds a BAND — `preferredRange(id) * 0.85` — and
 * closes, backs off or strafes to keep it. `ai.ts:stepAI` has no band at all: it closes
 * until `pickWeapon` returns any index, and the chase branch then fires INSTEAD of moving.
 * Its equilibrium separation is therefore an emergent property of its cooldowns, not a
 * choice, and nothing in the file is aware that a kit has a range at which it is good.
 *
 * So this tool measures, for both roles of one character:
 *
 *   THE KIT'S OWN OUTPUT CURVE   `sustained(d)` = Σ pressValue(w, d) / cooldown_s over
 *                                every weapon that reaches `d`. HP/s, pure arithmetic,
 *                                zero matches. Its argmax is the separation the kit
 *                                WANTS, and it is a property of `rules.ts` alone.
 *   THE REALISED SEPARATION      the separation at every `weapon-fired` event, and over
 *                                every contact tick, per role.
 *   EXPRESSION                   `sustained(realised p50) / sustained(argmax)`. How much
 *                                of the kit the role's positioning leaves reachable.
 *
 * Expression is the point. A win rate says a role lost; expression says the kit was never
 * in a position to be used, and it is comparable ACROSS characters, which a win rate at
 * one end of a matchup is not.
 *
 * Two secondary counters, both of which are things `stepAI` cannot express and the
 * scripted player can:
 *
 *   BLIND PRESSES     a ranged press with no line of sight. `smart2` refuses these
 *                     (`attack: idx !== null && (los || melee || self)`); `stepAI` has no
 *                     LOS term anywhere, so every one is a cooldown spent into furniture.
 *   IMPATIENT PRESSES a press where a strictly higher-value weapon was IN RANGE but on
 *                     cooldown. Neither driver waits; this prices what waiting is worth.
 *
 * ── The driver is IMPORTED, never copied ────────────────────────────────────
 *
 * `driver_guard.mjs` fails if another copy of the scripted player appears and this file
 * would be it. `lineOfSight` in particular is taken off the driver instance rather than
 * re-implemented, so "did that shot have a lane" is answered by the same code that
 * decides it for the player and by the same 12x12-vs-CoverBox test `stepProjectiles`
 * runs.
 *
 * ── Validated against known-bad inputs before it is believed ────────────────
 *
 * `--selftest`. `docs/LESSONS.md` §13: instruments on this project have returned
 * confident wrong answers nineteen times in one session, so every assertion here is
 * shown to FAIL on an input constructed to break it — the curve against the authored
 * damage key, the separation against a pinned fixture, the LOS counter against a walled
 * arena, the histogram against fighters that never move.
 *
 *   node tools/tmp/ac_engage.mjs --selftest
 *   node tools/tmp/ac_engage.mjs --curves                  # kit curves only, no matches
 *   node tools/tmp/ac_engage.mjs --char sushi --seeds 32
 *   node tools/tmp/ac_engage.mjs --all --seeds 8           # every character, both roles
 *
 * ⚠️ RESOLUTION FLOORS. This tool prints NO win rate and no aggregate that one could be
 * derived from, deliberately — `roster_lab.mjs` owns that quantity and its floor is
 * ~9 pp. Separations and HP/s are means over thousands of events with a reported sd;
 * they are not win rates and must not be compared to one.
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
const AI = await import(`${SIM_DIR}/ai.ts`);
const {
  CHARACTERS, CHARACTER_IDS, MATCH_DURATION_MS, REACH,
  HIT_RADIUS_VS_PLAYER, HIT_RADIUS_VS_ENEMY, AI_FLEE_HP_FRACTION,
} = RULES;
/** The sim's own delivered-damage key, validated in all 183 cells by `sim.test.mjs` §20(b). */
const pressValue = AI.pressValue;

const ARENA_PATH = String(args.arena ?? `${ROOT}/tools/arena.gameplay.json`);
const ARENA_DATA = existsSync(ARENA_PATH) ? JSON.parse(readFileSync(ARENA_PATH, 'utf8')) : null;
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
const dist = (ax, ay, bx, by) => Math.hypot(ax - bx, ay - by);
const mean = (a) => (a.length ? a.reduce((x, y) => x + y, 0) / a.length : 0);
const pctile = (a, q) => {
  if (!a.length) return 0;
  const s = [...a].sort((x, y) => x - y);
  return s[Math.min(s.length - 1, Math.max(0, Math.round(q * (s.length - 1))))];
};

const DRIVER_FLAGS = parseDriverFlags(args);
const driverFor = (a) => createScriptedPlayer({ CHARACTERS, REACH, arena: a, ...DRIVER_FLAGS });
let driver = arena ? driverFor(arena) : null;

// ─────────────────────────────────────────────────────────────────────────────
// THE KIT'S OWN OUTPUT CURVE — arithmetic over `rules.ts`, no matches involved
// ─────────────────────────────────────────────────────────────────────────────

/**
 * Sustained HP/s this kit can deliver against a target `d` away, with everything cycling
 * off cooldown and every press landing what `pressValue` says it lands from there.
 *
 * A `self` weapon contributes 0 (its `PRESS_VALUE` entry is `always: 0`), which is
 * correct here: this is the OFFENSIVE curve, and `rankHeal` decides a heal separately in
 * both drivers.
 *
 * ⚠️ This is a CEILING, not a prediction. It assumes the target stays at `d` and every
 * shot connects, so no fighter ever reaches it. That is exactly what makes it usable as a
 * denominator: the same optimism is applied to both roles of the same character, so the
 * RATIO between them is not inflated by it.
 */
function sustainedAt(id, d) {
  let s = 0;
  for (const w of CHARACTERS[id].weapons) {
    if ((w.range ?? Infinity) < d) continue;
    s += pressValue(w, d) / (w.cooldown / 1000);
  }
  return s;
}

/** The highest single press available from `d`, ignoring cooldown. */
function bestPressAt(id, d) {
  let b = 0;
  for (const w of CHARACTERS[id].weapons) {
    if ((w.range ?? Infinity) < d) continue;
    const v = pressValue(w, d);
    if (v > b) b = v;
  }
  return b;
}

/**
 * The separation this kit is best at, and the HP/s there.
 *
 * Swept at 1 wu rather than solved: `sustainedAt` is a step function (a pellet stops
 * landing at a discrete distance, a weapon leaves range at a discrete distance), so it
 * has no derivative and its argmax is not where anyone would guess. Sweeping from 1 to
 * `rangedMax` is 140 evaluations and removes the guess.
 */
function kitPeak(id) {
  let bestD = 1, best = -1;
  for (let d = 1; d <= REACH.rangedMax; d++) {
    const s = sustainedAt(id, d);
    if (s > best) { best = s; bestD = d; }
  }
  return { d: bestD, hps: best };
}

/**
 * EXPRESSION — what fraction of the kit's peak sustained output is reachable from `d`.
 *
 * The number the whole tool exists for. It is a property of a POSITION, not of a driver,
 * so the two roles of one character are directly comparable and so are two different
 * characters — which is what a win rate at one end of a matchup can never be.
 */
function expressionAt(id, d) {
  const peak = kitPeak(id).hps;
  return peak > 0 ? sustainedAt(id, d) / peak : 0;
}

// ─────────────────────────────────────────────────────────────────────────────
// One match, instrumented symmetrically on both sides.
// ─────────────────────────────────────────────────────────────────────────────

function blankSide() {
  return {
    pressSep: [],        // separation at every offensive `weapon-fired`
    pressValueGot: [],   // pressValue(chosen, sep) for each of those
    pressBestHere: [],   // best pressValue IN RANGE at that sep, ignoring cooldown
    blindRanged: 0,      // ranged presses with no line of sight
    rangedPresses: 0,
    impatient: 0,        // a strictly better weapon was in range but on cooldown
    contactSep: [],      // separation on every tick where either side could reach
    dealtTotal: 0,
    pressByKey: {},      // weaponKey -> presses
    dealtByKey: {},      // weaponKey -> damage that landed from it
    valueByKey: {},      // weaponKey -> Σ pressValue at the separation it was pressed from
    projSpawned: 0,      // ranged presses (one press = one volley)
    projLanded: 0,       // `hit-landed` events sourced from a ranged weapon
    // ── THE BRANCH CENSUS ────────────────────────────────────────────────────
    // `stepAI`'s CHASE branch is `if (weapon) attack; else if (!rooted) move;` — it fires
    // XOR moves, never both. `makeDecisionTree` returns `{move, aim, selectedWeapon,
    // attack}` and always does both. These counters price that difference, and they are
    // gathered IDENTICALLY for the two roles so the comparison is not built out of two
    // different quantities.
    playTicks: 0,
    firedTicks: 0,       // ticks on which this fighter emitted an offensive `weapon-fired`
    firedAndMoved: 0,    // …and also changed position on the same tick
    stationaryTicks: 0,  // ticks with zero displacement while alive and playing
    fleeTicks: 0,        // hp < maxHp * AI_FLEE_HP_FRACTION — counterfactual for the player
    fleeSep: [],         // separation while under that threshold
    chaseSep: [],        // separation while above it
    fleeDealt: 0,
    fleeTaken: 0,
  };
}

function runMatch(playerId, enemyId, policy, seed, { beforeTick = null, arenaDef = arena, drv = driver } = {}) {
  // The `roster_lab.mjs` / `burger_lab.mjs` seed formula, unchanged — that is what makes a
  // row here the SAME match as a row there.
  const rnd = rng(seed * 7919 + playerId.length * 131 + enemyId.length * 17 + policy.length);
  const state = createMatch(arenaDef, playerId, enemyId);
  const decide = drv.POLICY_FNS[policy](rnd);
  const loop = drv.createDecisionLoop({ decide, reactBase: 150, reactJit: seed === 0 ? 0 : 60, rnd });

  const pReach = drv.maxNormalRange(playerId), eReach = drv.maxNormalRange(enemyId);
  const engageRange = Math.max(pReach + HIT_RADIUS_VS_ENEMY, eReach + HIT_RADIUS_VS_PLAYER);

  const side = { player: blankSide(), enemy: blankSide() };
  const idOf = { player: playerId, enemy: enemyId };
  let winner = null, playTicks = 0;
  const HARD_CAP = MATCH_DURATION_MS * 1.6 + 20000;

  while (state.phase !== 'ended' && state.elapsed < HARD_CAP) {
    if (beforeTick) beforeTick(state);
    // Separation and LOS are read BEFORE the tick that fires, because the press is
    // resolved against the geometry the deciding fighter was standing in — reading them
    // afterwards prices the shot at a position it was never taken from.
    const sepBefore = dist(state.player.x, state.player.y, state.enemy.x, state.enemy.y);
    const losBefore = drv.lineOfSight(state.player.x, state.player.y, state.enemy.x, state.enemy.y);
    const cdBefore = {
      player: [...state.player.lastUsed], enemy: [...state.enemy.lastUsed],
    };
    const tBefore = state.elapsed;
    const posBefore = {
      player: { x: state.player.x, y: state.player.y },
      enemy: { x: state.enemy.x, y: state.enemy.y },
    };
    const wasFleeing = {
      player: state.player.hp < state.player.maxHp * AI_FLEE_HP_FRACTION,
      enemy: state.enemy.hp < state.enemy.maxHp * AI_FLEE_HP_FRACTION,
    };
    const hpBefore = { player: state.player.hp, enemy: state.enemy.hp };
    const wasPlaying = state.phase === 'playing';
    const firedThisTick = { player: false, enemy: false };

    const evs = stepMatch(state, DT, loop.next(state, DT));

    for (const ev of evs) {
      if (ev.type === 'weapon-fired') {
        const role = ev.fighterRole;
        const ws = CHARACTERS[idOf[role]].weapons;
        const i = ws.findIndex((x) => x.key === ev.weaponKey);
        const w = ws[i];
        if (!w || w.type === 'self') continue;          // the heal is not an offensive press
        const s = side[role];
        firedThisTick[role] = true;
        s.pressSep.push(sepBefore);
        s.pressValueGot.push(pressValue(w, sepBefore));
        s.pressBestHere.push(bestPressAt(idOf[role], sepBefore));
        s.pressByKey[w.key] = (s.pressByKey[w.key] ?? 0) + 1;
        s.valueByKey[w.key] = (s.valueByKey[w.key] ?? 0) + pressValue(w, sepBefore);
        if (w.type === 'ranged') {
          s.rangedPresses++;
          if (!losBefore) s.blindRanged++;
        }
        // IMPATIENCE: was something strictly better in range, and merely on cooldown?
        const got = pressValue(w, sepBefore);
        for (let j = 0; j < ws.length; j++) {
          const o = ws[j];
          if (o.type === 'self') continue;
          if ((o.range ?? Infinity) < sepBefore) continue;
          if (pressValue(o, sepBefore) <= got) continue;
          if (tBefore - cdBefore[role][j] >= o.cooldown) continue;   // it was available; not impatience
          s.impatient++;
          break;
        }
      } else if (ev.type === 'match-ended') winner = ev.winner;
      else if (ev.type === 'hit-landed') {
        const k = ev.source?.kind;
        if (k === 'weapon' || k === 'trail') {
          const by = ev.targetRole === 'player' ? 'enemy' : 'player';
          side[by].dealtTotal += ev.amount;
          const key = ev.source?.weaponKey ?? '(trail)';
          side[by].dealtByKey[key] = (side[by].dealtByKey[key] ?? 0) + ev.amount;
        }
      }
    }

    if (wasPlaying) {
      playTicks++;
      if (sepBefore <= engageRange) {
        side.player.contactSep.push(sepBefore);
        side.enemy.contactSep.push(sepBefore);
      }
      for (const role of ['player', 'enemy']) {
        const s = side[role];
        s.playTicks++;
        const moved = dist(posBefore[role].x, posBefore[role].y, state[role].x, state[role].y) > 1e-9;
        if (!moved) s.stationaryTicks++;
        if (firedThisTick[role]) {
          s.firedTicks++;
          if (moved) s.firedAndMoved++;
        }
        if (wasFleeing[role]) {
          s.fleeTicks++;
          s.fleeSep.push(sepBefore);
          s.fleeTaken += Math.max(0, hpBefore[role] - state[role].hp);
          const opp = role === 'player' ? 'enemy' : 'player';
          s.fleeDealt += Math.max(0, hpBefore[opp] - state[opp].hp);
        } else s.chaseSep.push(sepBefore);
      }
    }
  }

  return { playerId, enemyId, policy, seed, winner, playTicks, side };
}

// ═════════════════════════════════════════════════════════════════════════════
// --selftest — every assertion shown to FAIL on an input built to break it
// ═════════════════════════════════════════════════════════════════════════════
if (args.selftest) {
  let pass = 0, fail = 0;
  const ok = (name, cond, detail = '') => {
    if (cond) { pass++; console.log(`   PASS  ${name}${detail ? `  ${detail}` : ''}`); }
    else { fail++; console.log(`   FAIL  ${name}${detail ? `  ${detail}` : ''}`); }
  };
  console.log(`\n══ ac_engage SELFTEST ══  sim ${SIM_DIR === `${ROOT}/src/game` ? 'working tree' : SIM_DIR}`);

  const CLEAR = {
    id: 'selftest', displayName: 'selftest', width: 1400, height: 1000,
    center: { x: 700, y: 500 }, maxSafeRadius: 5000,
    playerSpawn: { x: 200, y: 500 }, enemySpawn: { x: 1000, y: 500 },
    cover: [], hazards: [], build: () => null, update: () => {},
  };
  /** One wall straddling the whole line between the two spawns: nothing has a lane, ever. */
  const WALLED = {
    ...CLEAR,
    cover: [{ x: 600, y: 500, w: 40, h: 900 }],
  };
  const savedArena = arena, savedDriver = driver;

  // ── A. THE CURVE IS THE SIM'S KEY, NOT A SECOND COPY OF IT ─────────────────
  //
  // `ai.ts`'s own header states two values as fact: *"Sushi's Rice Spray is worth 6 at
  // 40 wu and 2 at 58"*. If this tool's curve is built on `pressValue` those must come
  // back exactly; if it has drifted onto the authored `damage` key it returns 2 at both.
  {
    const rice = CHARACTERS.sushi.weapons.find((w) => w.key === 'Rice');
    const at40 = pressValue(rice, 40), at58 = pressValue(rice, 58);
    ok('the ranking key is `pressValue`, not authored damage (ai.ts states 6 at 40 wu, 2 at 58)',
      at40 === 6 && at58 === 2, `40wu=${at40} 58wu=${at58} authored=${rice.damage}`);
    // KNOWN-BAD: the authored key CANNOT tell the two apart. If it could, the assertion
    // above would pass for a broken tool too, and it would be a comment with a tick on it.
    ok('…and the authored key cannot tell those two separations apart (the check is not vacuous)',
      (rice.damage ?? 0) === (rice.damage ?? 0) && at40 !== at58, `authored ${rice.damage} at both`);
  }
  {
    // A single-projectile weapon has no off-axis parts, so its curve is FLAT in range and
    // ZERO past it. That is the step this tool's argmax sweep exists to find.
    const seaweed = CHARACTERS.sushi.weapons.find((w) => w.key === 'Seaweed');
    ok('a lone projectile is flat inside its range',
      pressValue(seaweed, 10) === 5 && pressValue(seaweed, 115) === 5);
    ok('`sustainedAt` drops a weapon the instant the target is past its range',
      sustainedAt('sushi', 116) > sustainedAt('sushi', 117),
      `116->${sustainedAt('sushi', 116).toFixed(2)} 117->${sustainedAt('sushi', 117).toFixed(2)} (Seaweed range 116)`);
  }
  {
    // Expression is 1.0 at the peak BY CONSTRUCTION, and must be < 1 somewhere or the
    // whole quantity is degenerate.
    let anyBelow = false;
    for (const id of CHARACTER_IDS) {
      const p = kitPeak(id);
      if (Math.abs(expressionAt(id, p.d) - 1) > 1e-12) { anyBelow = false; break; }
      if (expressionAt(id, REACH.rangedMax) < 0.999) anyBelow = true;
    }
    ok('expression is exactly 1.0 at the kit peak and strictly below it elsewhere',
      anyBelow, 'peak=1.0 for all 11, and < 1 at rangedMax for at least one');
  }

  // ── B. SEPARATION IS READ FROM THE SIM, AT THE TICK OF THE PRESS ───────────
  {
    arena = CLEAR; driver = driverFor(CLEAR);
    // Both fighters pinned every tick at a KNOWN separation. Every press must record
    // exactly that number — a tool that read the separation after the tick, or modelled
    // it, cannot produce a zero-variance histogram against moving fighters.
    const PIN = 90;
    const r = runMatch('sushi', 'sushi', 'chase', 0, {
      beforeTick: (st) => {
        st.player.x = 700 - PIN / 2; st.player.y = 500;
        st.enemy.x = 700 + PIN / 2; st.enemy.y = 500;
      },
    });
    const all = [...r.side.player.pressSep, ...r.side.enemy.pressSep];
    ok('a pinned fixture puts EVERY press in one bucket (separation is observed, not modelled)',
      all.length > 10 && all.every((s) => Math.abs(s - PIN) < 1e-9),
      `${all.length} presses, all at ${PIN} wu`);
    // KNOWN-BAD: unpinned, the same matchup must NOT be single-valued, or the assertion
    // above is satisfied by a tool that records a constant.
    const free = runMatch('sushi', 'sushi', 'chase', 0);
    const freeAll = [...free.side.player.pressSep, ...free.side.enemy.pressSep];
    const spread = Math.max(...freeAll) - Math.min(...freeAll);
    ok('…and an UNPINNED match is not single-valued (the pin is what made it constant)',
      spread > 50, `spread ${spread.toFixed(1)} wu over ${freeAll.length} presses`);
  }
  {
    arena = CLEAR; driver = driverFor(CLEAR);
    const a = runMatch('sushi', 'donut', 'smart2', 0);
    const b = runMatch('sushi', 'donut', 'smart2', 0);
    ok('seed 0 is deterministic (bit-identical re-run)',
      a.winner === b.winner && a.playTicks === b.playTicks
      && a.side.player.pressSep.length === b.side.player.pressSep.length
      && a.side.enemy.dealtTotal === b.side.enemy.dealtTotal);
  }

  // ── C. THE BLIND-PRESS COUNTER, IN BOTH DIRECTIONS ─────────────────────────
  //
  // On a clear arena nothing can be blind. Behind a wall that spans the whole engagement
  // line, every ranged press by the side that has no lane is blind. A counter that only
  // ever reads zero would pass the first and fail the second.
  {
    arena = CLEAR; driver = driverFor(CLEAR);
    const clear = runMatch('sushi', 'donut', 'chase', 1);
    ok('no cover -> zero blind presses on both sides',
      clear.side.player.blindRanged === 0 && clear.side.enemy.blindRanged === 0
      && clear.side.player.rangedPresses > 0 && clear.side.enemy.rangedPresses > 0,
      `ranged p=${clear.side.player.rangedPresses} e=${clear.side.enemy.rangedPresses}`);

    arena = WALLED; driver = driverFor(WALLED);
    const walled = runMatch('sushi', 'donut', 'chase', 1);
    const eBlind = walled.side.enemy.blindRanged;
    ok('a wall across the engagement line makes the AI\'s ranged presses BLIND  <-- stepAI has no LOS term',
      eBlind > 0, `enemy ${eBlind}/${walled.side.enemy.rangedPresses} ranged presses had no lane`);
    // And the PLAYER under `smart2` refuses them, which is the asymmetry being measured.
    const smartWalled = runMatch('sushi', 'donut', 'smart2', 1);
    ok('…while `smart2` refuses to take them (`attack` is gated on `los`)',
      smartWalled.side.player.blindRanged === 0,
      `player ${smartWalled.side.player.blindRanged}/${smartWalled.side.player.rangedPresses}`);
  }

  // ── D. IMPATIENCE IS REACHABLE AND IS NOT ALWAYS ON ────────────────────────
  {
    arena = CLEAR; driver = driverFor(CLEAR);
    // Sushi at close range: Rice (value 6 at 40 wu) and Fish (6) cycle every 0.7/1.2 s
    // while Big Catch (27) is on a 3.2 s cooldown, so most presses are taken with a
    // strictly better weapon in range and unavailable. Pinned so the geometry is fixed.
    const r = runMatch('sushi', 'sushi', 'chase', 0, {
      beforeTick: (st) => {
        st.player.x = 680; st.player.y = 500; st.enemy.x = 720; st.enemy.y = 500;
      },
    });
    const tot = r.side.enemy.pressSep.length;
    ok('impatience is REACHABLE (Sushi close in, Big Catch on cooldown)',
      r.side.enemy.impatient > 0 && r.side.enemy.impatient < tot,
      `${r.side.enemy.impatient}/${tot} presses`);
    // KNOWN-BAD: a one-weapon kit can never be impatient. Donut has exactly one
    // offensive weapon, so a counter that fires on anything would light up here.
    const one = runMatch('donut', 'donut', 'chase', 0, {
      beforeTick: (st) => {
        st.player.x = 680; st.player.y = 500; st.enemy.x = 720; st.enemy.y = 500;
      },
    });
    ok('…and a one-weapon kit is NEVER impatient (the counter is not firing on everything)',
      one.side.enemy.impatient === 0 && one.side.enemy.pressSep.length > 0,
      `donut ${one.side.enemy.impatient}/${one.side.enemy.pressSep.length}`);
  }

  // ── E. THE BRANCH CENSUS, IN BOTH DIRECTIONS ──────────────────────────────
  //
  // The single structural claim this tool makes about `ai.ts` is that its CHASE branch
  // fires XOR moves. That is only believable if the counter can read BOTH answers, so it
  // is asserted against the two drivers at once, on the same match: `smart2` returns
  // `move` and `attack` in the same input object and must read ~100%, `stepAI` takes the
  // `else if` and must read ~0%. A counter wired to one fighter, or one that always
  // returns 0, fails one of the two.
  {
    arena = CLEAR; driver = driverFor(CLEAR);
    const r = runMatch('sushi', 'sushi', 'smart2', 3);
    const p = r.side.player, e = r.side.enemy;
    const pPct = (p.firedAndMoved / p.firedTicks) * 100;
    const ePct = (e.firedAndMoved / e.firedTicks) * 100;
    ok('the scripted PLAYER fires and moves on the same tick',
      p.firedTicks > 5 && pPct > 80, `${p.firedAndMoved}/${p.firedTicks} = ${pPct.toFixed(1)}%`);
    ok('the AI does NOT — the chase branch is fire XOR move  <-- the asymmetry being measured',
      e.firedTicks > 5 && ePct < 25, `${e.firedAndMoved}/${e.firedTicks} = ${ePct.toFixed(1)}%`);
    ok('…and both counters are non-degenerate on the same match (not "always 0" / "always 100")',
      p.firedTicks > 0 && e.firedTicks > 0 && pPct !== ePct);
    ok('the stationary counter separates the two roles the same way',
      e.stationaryTicks / e.playTicks > p.stationaryTicks / p.playTicks,
      `player ${((p.stationaryTicks / p.playTicks) * 100).toFixed(1)}% enemy ${((e.stationaryTicks / e.playTicks) * 100).toFixed(1)}%`);
    // KNOWN-BAD: an `idle` player never fires and never moves, so BOTH of its counters
    // must be degenerate. If the fired counter still reported presses, it would be
    // reading the wrong fighter.
    const idle = runMatch('sushi', 'sushi', 'idle', 3);
    ok('an idle player fires on zero ticks and is stationary on all of them',
      idle.side.player.firedTicks === 0 && idle.side.player.stationaryTicks === idle.side.player.playTicks,
      `fired ${idle.side.player.firedTicks} stationary ${idle.side.player.stationaryTicks}/${idle.side.player.playTicks}`);
  }
  {
    // The flee census must be reachable and must not be always-on. A fighter pinned at
    // full HP is never below the threshold; the loser of a real match always ends there.
    arena = CLEAR; driver = driverFor(CLEAR);
    const full = runMatch('sushi', 'sushi', 'chase', 0, {
      beforeTick: (st) => { st.player.hp = st.player.maxHp; st.enemy.hp = st.enemy.maxHp; },
    });
    ok('a fighter held at full HP never enters the flee band',
      full.side.player.fleeTicks === 0 && full.side.enemy.fleeTicks === 0 && full.side.player.playTicks > 100,
      `over ${full.side.player.playTicks} ticks`);
    const real = runMatch('sushi', 'donut', 'smart2', 0);
    ok('…and a real match does reach it (the census is not structurally zero)',
      real.side.player.fleeTicks + real.side.enemy.fleeTicks > 0,
      `player ${real.side.player.fleeTicks} enemy ${real.side.enemy.fleeTicks} ticks below ${AI_FLEE_HP_FRACTION}`);
  }

  arena = savedArena; driver = savedDriver;
  console.log(`\n   ${pass} passed, ${fail} failed\n`);
  process.exit(fail ? 1 : 0);
}

if (!arena) { console.error(`ac_engage: no arena at ${ARENA_PATH}`); process.exit(1); }

// ═════════════════════════════════════════════════════════════════════════════
// --curves — the kit output curves alone. No matches, pure `rules.ts` arithmetic.
// ═════════════════════════════════════════════════════════════════════════════
if (args.curves) {
  const BANDS = [40, 58, 70, 84, 98, 116, 128, 140];
  console.log(`\n══ KIT OUTPUT CURVES ══  sustained HP/s vs separation  (pressValue / cooldown, everything cycling)\n`);
  console.log(`   character      peak d   peak HP/s   ` + BANDS.map((b) => String(b).padStart(6)).join(''));
  for (const id of CHARACTER_IDS) {
    const p = kitPeak(id);
    const row = BANDS.map((b) => sustainedAt(id, b).toFixed(1).padStart(6)).join('');
    console.log(`   ${id.padEnd(13)} ${String(p.d).padStart(6)} ${p.hps.toFixed(1).padStart(11)}   ${row}`);
  }
  console.log(`\n   EXPRESSION — sustainedAt(d) / peak, i.e. the fraction of the kit reachable from d\n`);
  console.log(`   character      peak d   ` + BANDS.map((b) => String(b).padStart(6)).join(''));
  for (const id of CHARACTER_IDS) {
    const p = kitPeak(id);
    const row = BANDS.map((b) => `${(expressionAt(id, b) * 100).toFixed(0)}%`.padStart(6)).join('');
    console.log(`   ${id.padEnd(13)} ${String(p.d).padStart(6)}   ${row}`);
  }
  console.log('');
  process.exit(0);
}

// ═════════════════════════════════════════════════════════════════════════════
// The measurement
// ═════════════════════════════════════════════════════════════════════════════

function profile(id) {
  const others = CHARACTER_IDS.filter((x) => x !== id);
  const acc = { player: blankSide(), enemy: blankSide() };
  const merge = (dst, src) => {
    dst.pressSep.push(...src.pressSep);
    dst.pressValueGot.push(...src.pressValueGot);
    dst.pressBestHere.push(...src.pressBestHere);
    dst.contactSep.push(...src.contactSep);
    dst.fleeSep.push(...src.fleeSep);
    dst.chaseSep.push(...src.chaseSep);
    dst.blindRanged += src.blindRanged;
    dst.rangedPresses += src.rangedPresses;
    dst.impatient += src.impatient;
    dst.dealtTotal += src.dealtTotal;
    dst.playTicks += src.playTicks;
    dst.firedTicks += src.firedTicks;
    dst.firedAndMoved += src.firedAndMoved;
    dst.stationaryTicks += src.stationaryTicks;
    dst.fleeTicks += src.fleeTicks;
    dst.fleeDealt += src.fleeDealt;
    dst.fleeTaken += src.fleeTaken;
  };
  let wins = { player: 0, enemy: 0 }, n = { player: 0, enemy: 0 };
  for (const o of others) {
    for (let s = 0; s < SEEDS; s++) {
      const a = runMatch(id, o, POLICY, s);            // `id` in the PLAYER's hands
      merge(acc.player, a.side.player);
      n.player++; if (a.winner === 'player') wins.player++;
      const b = runMatch(o, id, POLICY, s);            // `id` in the AI's hands
      merge(acc.enemy, b.side.enemy);
      n.enemy++; if (b.winner === 'enemy') wins.enemy++;
    }
  }
  return { id, acc, wins, n };
}

const pk = (id) => kitPeak(id);
function report(id) {
  const { acc, wins, n } = profile(id);
  const peak = pk(id);
  console.log(`\n══ AC_ENGAGE ══  ${id}  ·  policy ${POLICY}  ·  ${SEEDS} seeds x 10 opponents x 2 roles`);
  console.log(`   kit peak: ${peak.hps.toFixed(1)} HP/s at ${peak.d} wu   ·   reaches ${Math.max(...CHARACTERS[id].weapons.map((w) => w.range ?? 0))} wu`);
  console.log('');
  const rows = [];
  const col = (r) => {
    const a = acc[r];
    const psep = pctile(a.pressSep, 0.5);
    const csep = pctile(a.contactSep, 0.5);
    return {
      'win rate': `${((wins[r] / n[r]) * 100).toFixed(1)}%`,
      'presses / match': (a.pressSep.length / n[r]).toFixed(2),
      'press separation p50 wu': psep.toFixed(0),
      'press separation p10 / p90': `${pctile(a.pressSep, 0.1).toFixed(0)} / ${pctile(a.pressSep, 0.9).toFixed(0)}`,
      'CONTACT separation p50 wu': csep.toFixed(0),
      '>> EXPRESSION at press p50': `${(expressionAt(id, psep) * 100).toFixed(0)}%`,
      '>> EXPRESSION at contact p50': `${(expressionAt(id, csep) * 100).toFixed(0)}%`,
      'mean press value got': mean(a.pressValueGot).toFixed(2),
      'mean best in range there': mean(a.pressBestHere).toFixed(2),
      'press-value efficiency': `${((mean(a.pressValueGot) / (mean(a.pressBestHere) || 1)) * 100).toFixed(0)}%`,
      'BLIND ranged presses': `${a.rangedPresses ? ((a.blindRanged / a.rangedPresses) * 100).toFixed(1) : '0.0'}%`,
      'IMPATIENT presses': `${a.pressSep.length ? ((a.impatient / a.pressSep.length) * 100).toFixed(1) : '0.0'}%`,
      'damage dealt / match': (a.dealtTotal / n[r]).toFixed(1),
      '>> FIRED AND MOVED same tick': `${a.firedTicks ? ((a.firedAndMoved / a.firedTicks) * 100).toFixed(1) : '0.0'}%`,
      '>> STATIONARY ticks': `${a.playTicks ? ((a.stationaryTicks / a.playTicks) * 100).toFixed(1) : '0.0'}%`,
      'ticks below flee threshold': `${a.playTicks ? ((a.fleeTicks / a.playTicks) * 100).toFixed(1) : '0.0'}%`,
      'separation p50 while fleeing': a.fleeSep.length ? pctile(a.fleeSep, 0.5).toFixed(0) : '—',
      'separation p50 while not': a.chaseSep.length ? pctile(a.chaseSep, 0.5).toFixed(0) : '—',
      'expression while fleeing': a.fleeSep.length
        ? `${(expressionAt(id, pctile(a.fleeSep, 0.5)) * 100).toFixed(0)}%` : '—',
      'HP dealt/taken while fleeing': a.fleeTaken > 0 ? (a.fleeDealt / a.fleeTaken).toFixed(2) : '—',
    };
  };
  const P = col('player'), E = col('enemy');
  console.log(`   ${'quantity'.padEnd(30)}${'PLAYER hands'.padStart(14)}${'AI hands'.padStart(14)}`);
  for (const k of Object.keys(P)) {
    console.log(`   ${k.padEnd(30)}${String(P[k]).padStart(14)}${String(E[k]).padStart(14)}`);
  }
  return { id, P, E, peak };
}

// ═════════════════════════════════════════════════════════════════════════════
// --mirror — THE DRIVER GAP WITH THE OPPONENT HELD IDENTICAL
//
// `asPlayer` and `asAI` are NOT two measurements of the same thing, and nothing in the
// repo said so. `asPlayer(X)` is X under `smart2` against ten opponents under `stepAI`;
// `asAI(X)` is X under `stepAI` against ten opponents under `smart2`. The opponent's
// DRIVER changes with the role, so a role split confounds "how much worse is stepAI at
// playing X" with "how much worse is stepAI at playing everyone X has to fight". Those
// are different questions and the second one is not about X at all.
//
// A MIRROR — X vs X, `smart2` on one side and `stepAI` on the other — removes the
// confound by construction: the kit, the pools' ratio, the speeds' ratio and the arena
// are identical on both sides, so the only thing left is the driver. `roster_lab` and
// `burger_lab` both exclude mirrors (110 = 11 x 10), so this quantity has never been
// measured on this project.
//
// ⚠️ THE ABSOLUTE NUMBER IS NOT 50% AND MUST NOT BE READ AS FAIRNESS. The AI role carries
// a uniform 0.900 pool handicap and a uniform 0.583 speed handicap, so the roster-wide
// mirror rate is expected to sit well above 50% on the player's side. The quantity that
// means something is the SPREAD across characters: a driver gap that is a property of
// `stepAI` alone is flat, and one that is a property of a KIT is not.
// ═════════════════════════════════════════════════════════════════════════════
if (args.mirror) {
  console.log(`\n══ MIRROR ══  X vs X, smart2 on the player side and stepAI on the enemy side`);
  console.log(`   ${SEEDS} seeds x 11 characters   ·   the opponent is held IDENTICAL, so only the driver differs\n`);
  console.log(`   character      player wins   presses P/A     press sep P/A    expr P/A     dealt P/A`);
  const rows = [];
  const perChar = {};
  for (const id of CHARACTER_IDS) {
    let wins = 0, n = 0;
    const acc = { player: blankSide(), enemy: blankSide() };
    for (let s = 0; s < SEEDS; s++) {
      const r = runMatch(id, id, POLICY, s);
      n++; if (r.winner === 'player') wins++;
      for (const role of ['player', 'enemy']) {
        acc[role].pressSep.push(...r.side[role].pressSep);
        acc[role].dealtTotal += r.side[role].dealtTotal;
        for (const k of Object.keys(r.side[role].pressByKey)) {
          acc[role].pressByKey[k] = (acc[role].pressByKey[k] ?? 0) + r.side[role].pressByKey[k];
          acc[role].valueByKey[k] = (acc[role].valueByKey[k] ?? 0) + r.side[role].valueByKey[k];
        }
        for (const k of Object.keys(r.side[role].dealtByKey)) {
          acc[role].dealtByKey[k] = (acc[role].dealtByKey[k] ?? 0) + r.side[role].dealtByKey[k];
        }
      }
    }
    perChar[id] = acc;
    const rate = wins / n;
    const pS = pctile(acc.player.pressSep, 0.5), eS = pctile(acc.enemy.pressSep, 0.5);
    rows.push({ id, rate });
    console.log(`   ${id.padEnd(13)} ${`${(rate * 100).toFixed(1)}%`.padStart(11)}`
      + `  ${(acc.player.pressSep.length / n).toFixed(1).padStart(5)}/${(acc.enemy.pressSep.length / n).toFixed(1).padEnd(5)}`
      + `  ${pS.toFixed(0).padStart(7)}/${eS.toFixed(0).padEnd(6)}`
      + ` ${`${(expressionAt(id, pS) * 100).toFixed(0)}%`.padStart(5)}/${`${(expressionAt(id, eS) * 100).toFixed(0)}%`.padEnd(5)}`
      + ` ${(acc.player.dealtTotal / n).toFixed(1).padStart(6)}/${(acc.enemy.dealtTotal / n).toFixed(1).padEnd(6)}`);
  }
  const rs = rows.map((r) => r.rate);
  const m = mean(rs);
  const sd = Math.sqrt(mean(rs.map((x) => (x - m) ** 2)));
  const lo = rows.reduce((a, b) => (a.rate < b.rate ? a : b));
  const hi = rows.reduce((a, b) => (a.rate > b.rate ? a : b));
  console.log(`\n   mirror mean ${(m * 100).toFixed(1)}%  ·  sd ${(sd * 100).toFixed(1)}pp  ·  range `
    + `${lo.id} ${(lo.rate * 100).toFixed(1)}% .. ${hi.id} ${(hi.rate * 100).toFixed(1)}% = ${((hi.rate - lo.rate) * 100).toFixed(1)}pp`);
  console.log(`   n = ${SEEDS} per character. ⚠️ This is an AGGREGATE win rate: ~9 pp floor. A ${((hi.rate - lo.rate) * 100).toFixed(1)}pp range across`);
  console.log(`   characters is ${(hi.rate - lo.rate) * 100 > 9 ? 'ABOVE' : 'INSIDE'} it.\n`);

  // PER-WEAPON, for the characters the spread singles out. Same kit on both sides, so a
  // difference here is a difference in WHICH PRESS EACH DRIVER CHOOSES and what it got
  // for it — the only remaining place a mirror gap can live.
  const focus = String(args.weapons ?? '').split(',').filter(Boolean);
  for (const id of (focus.length ? focus : [lo.id, hi.id])) {
    const acc = perChar[id];
    if (!acc) continue;
    console.log(`   ── ${id} ── per weapon, per side (mirror, ${SEEDS} seeds)`);
    console.log(`      weapon      P press  P dmg  P d/press   |  A press  A dmg  A d/press   |  Σ pressValue P/A`);
    const keys = [...new Set([...Object.keys(acc.player.pressByKey), ...Object.keys(acc.enemy.pressByKey),
      ...Object.keys(acc.player.dealtByKey), ...Object.keys(acc.enemy.dealtByKey)])];
    for (const k of keys) {
      const pp = acc.player.pressByKey[k] ?? 0, pd = acc.player.dealtByKey[k] ?? 0;
      const ep = acc.enemy.pressByKey[k] ?? 0, ed = acc.enemy.dealtByKey[k] ?? 0;
      console.log(`      ${k.padEnd(10)} ${(pp / SEEDS).toFixed(2).padStart(7)} ${(pd / SEEDS).toFixed(1).padStart(6)}`
        + ` ${(pp ? pd / pp : 0).toFixed(2).padStart(10)}   | ${(ep / SEEDS).toFixed(2).padStart(7)} ${(ed / SEEDS).toFixed(1).padStart(6)}`
        + ` ${(ep ? ed / ep : 0).toFixed(2).padStart(10)}   | `
        + `${(pp ? (acc.player.valueByKey[k] ?? 0) / pp : 0).toFixed(1).padStart(5)}/${(ep ? (acc.enemy.valueByKey[k] ?? 0) / ep : 0).toFixed(1)}`);
    }
    console.log('');
  }
  process.exit(0);
}

const targets = args.all ? CHARACTER_IDS : [String(args.char ?? 'sushi')];
const out = [];
for (const id of targets) out.push(report(id));

if (args.all) {
  console.log(`\n══ ROSTER SUMMARY ══  expression at the separation each role actually presses from\n`);
  console.log(`   character      peak d    P sep  P expr     A sep  A expr    Δexpr   A blind  A impat`);
  for (const r of out) {
    const pd = r.P['press separation p50 wu'], ad = r.E['press separation p50 wu'];
    const pe = parseFloat(r.P['>> EXPRESSION at press p50']), ae = parseFloat(r.E['>> EXPRESSION at press p50']);
    console.log(`   ${r.id.padEnd(13)} ${String(r.peak.d).padStart(6)} ${pd.padStart(8)} ${(pe.toFixed(0) + '%').padStart(7)}`
      + ` ${ad.padStart(9)} ${(ae.toFixed(0) + '%').padStart(7)} ${((ae - pe).toFixed(0) + 'pp').padStart(8)}`
      + ` ${r.E['BLIND ranged presses'].padStart(9)} ${r.E['IMPATIENT presses'].padStart(8)}`);
  }
}
console.log('');
