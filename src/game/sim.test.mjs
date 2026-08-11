#!/usr/bin/env node
/**
 * Plain-Node behavioural tests for the match simulation. No test framework — run
 * directly:
 *
 *   node src/game/sim.test.mjs
 *
 * Relies on Node's built-in TypeScript support (type-stripping; no build step) to
 * import `.ts` modules straight from `src/game/`. Every game/*.ts file imports its
 * siblings with an explicit `.ts` extension for exactly this reason — see the note
 * at the top of `state.ts`.
 *
 * There is no arena implementation yet (the art/arena agent hasn't landed
 * `src/arena/kitchen.ts`), so tests build a small fixture object that satisfies the
 * `ArenaDefinition` contract in `src/arena/types.ts` directly.
 */

import { createMatch, stepMatch } from './sim.ts';
// Section 16 drives the AI for a single tick without the rest of `stepMatch`, which is
// the only way to observe a projectile fired at zero separation before the projectile
// step in that same tick resolves and deletes it. See the note on `coincidentAI`.
// Section 20 asserts the enemy's half of rules that were already tested on the player's
// half. `pressValue` is imported rather than re-derived for the same reason
// `statusReadyAt` is: a copy of the driver's ranking arithmetic would only test the copy,
// and the whole point of that check is that the key and the sim cannot drift apart.
import { pressValue, stepAI } from './ai.ts';
// Section 17 needs the real damage path to prove that taking a hit restarts the
// out-of-combat delay — modelling `lastDamagedAt` by hand would test the model.
// Section 19 fires Lollipop's slam directly, because the thing under test is that it
// lands from beyond every other weapon's reach WITHOUT AIM — driving it through a whole
// match would confound that with whether the driver ever chose it.
import { applyDamage, attemptAttack, statusReadyAt } from './combat.ts';
// Section 26 tests CONCEALMENT. The predicates are imported rather than re-derived for
// the same reason `pressValue` and `statusReadyAt` are: the section's entire claim is that
// ONE rule is read by four call sites, and a copy of the AABB test here would pass forever
// against a sim that had stopped calling it. `tryMove`/`moveToward`/`navStats` come in so
// walk-through can be PROVEN by walking, and the nav grid's passable-cell count compared
// directly, rather than asserted from the fact that nobody wired concealment into them.
import {
  breakConcealment, concealmentInsideRadius, concealmentKeepoutViolations, concealmentOf,
  isConcealed, isHidden, isVisibleFrom, moveToward, navStats, tryMove,
} from './movement.ts';
// Section 26(m) reads `src/game/*.ts` back off disk and asserts that every gameplay reader
// of `isVisibleFrom` passes the two per-match arguments. "Everybody remembered" is a claim
// about people; five of this file's six recorded defects are exactly that claim being
// false, so it is checked against the source rather than believed.
import { readFileSync, readdirSync } from 'node:fs';
import { fileURLToPath } from 'node:url';
import { dirname, join } from 'node:path';
import {
  CHARACTERS, CHARACTER_IDS, PLAYER_MAX_HP, PLAYER_SIZE, PLAYER_SPEED, SLOW_MOVE_MULTIPLIER, FOG_DAMAGE, FOG_TICK_MS,
  MATCH_DURATION_MS, MIN_SAFE_RADIUS, ENEMY_MAX_HP, ENEMY_SIZE, POT, TRAIL,
  COUNTDOWN_FROM, COUNTDOWN_START_FLASH_MS,
  REGEN_DELAY_MS, REGEN_TICK_MS, REGEN_AMOUNT, STUN_DURATION_MS, SLOW_DURATION_MS,
  STUN_GRACE_MS, SLOW_GRACE_MS,
  AI_FLEE_HP_FRACTION, AI_HAZARD_MARGIN, AI_SELF_HEAL_HP_FRACTION, REACH,
  // Section 22: the card and the sim are the same numbers now, so the accessors are
  // imported rather than re-derived — a copy of `maxHpFor`'s arithmetic in the test
  // would pass forever against a `sim.ts` that had stopped calling it.
  maxHpFor, speedFor, healthMultiplier, speedMultiplier, kitDps, damageStatFor, powerIndex,
  HEALTH_BASELINE_STAT, HEALTH_PER_STAT, SPEED_TOP_STAT, STAT_MAX_DISPLAY, RARITY_ORDER,
  // Section 23: same rule — the level multipliers are imported, never re-derived, so a
  // `sim.ts` that stopped applying them cannot leave this section green.
  LEVEL_MIN, LEVEL_MAX, LEVEL_HEALTH_PER_LEVEL, LEVEL_DAMAGE_PER_LEVEL,
  clampLevel, levelHealthMultiplier, levelDamageMultiplier,
  // Section 24: the roster's kit VARIETY. Same rule again — the signature is derived in
  // `rules.ts` and imported, because the "KIT DISTINCTIVENESS" record in that file quotes
  // it and a second copy here could quietly stop agreeing with the thing it documents.
  kitSignature, weaponMechanics, WEAPON_MECHANICS,
  // Section 25: the terrain-slow rule. `PUDDLE_SLOW_FACTOR` is imported rather than
  // written as `0.45` because the section's whole claim is that ONE stated rule reaches
  // only ONE of the two fighters — a literal here would still pass if the constant moved.
  PUDDLE_SLOW_FACTOR, SPLAT_RADIUS,
  // Section 26: concealment. `CONCEAL_REVEAL_RADIUS` and `concealmentKeepoutRadius` are
  // imported rather than written as 84 and 248.25 because the section's claim is about the
  // DERIVATIONS — reveal is a rung of the `REACH` ladder, keepout is the ring formula
  // evaluated at `CONCEAL_ENDGAME_PROGRESS` — and a literal here would still pass after the
  // ladder or the ring moved out from under it.
  CONCEAL_REVEAL_RADIUS, CONCEAL_ENDGAME_PROGRESS, concealmentKeepoutRadius,
  // Section 26(j)-(l): DECISIONS §29c. `FLIGHT_MS` comes in beside the reveal duration for
  // the same reason — the claim is that the window IS the workhorse projectile's flight
  // time, so the assertion is the derivation and not the number 500.
  CONCEAL_ATTACK_REVEAL_MS, FLIGHT_MS,
  // Section 27: the N-fighter container. The two hit radii are imported rather than
  // written as 25.2 / 26 because the claim is that `Fighter.hitRadius` CARRIES the same
  // number the projectile loop's ternary used to branch on — a literal here would still
  // pass after either constant moved.
  HIT_RADIUS_VS_PLAYER, HIT_RADIUS_VS_ENEMY,
  // Section 29: `DECISIONS §53b`, the endgame ring scaling with fighter count. Both come in
  // for the same reason every derived constant above does — the section's claim is that the
  // floor is DERIVED from the reach ladder and the pot, so it re-derives the chord longhand
  // from `REACH`/`POT`/`HIT_RADIUS_*` and compares. A literal 166 or 237 here would keep
  // passing after the ladder, the hit radius or the hazard moved out from under it.
  ENDGAME_STANDOFF, minSafeRadiusFor,
} from './rules.ts';
// Section 26(b) needs a bare fighter to walk across a concealment box with `tryMove`, with
// no match, no AI and no `stepMatch` around it — the factory is imported so the thing being
// walked is the thing the sim actually moves.
// Section 28 needs the two halves the single `opponentOf` split into, plus `opponentOf`
// itself — which is kept for exactly this purpose. It is the N=2 ORACLE the split is checked
// against, so §28(a) can state "every split reduces exactly to today's behaviour at N=2" as
// a machine-checked claim rather than as prose. A test that re-derived the two-seat answer
// inline would only be testing its own copy of it.
import {
  createFighter, fighterBit, lastFighterStanding, MAX_FIGHTERS, MIN_FIGHTERS,
  nearestLivingOpponent, opponentOf, roleOfSlot, sightingIndex,
} from './state.ts';

// Weapon reach and projectile speed come off the `REACH`/`SPEED` ladders in
// `rules.ts` and moved once already (the 2026-08-03 retune, see `REACH`). Tests that
// need a position "in range" or a dt "exactly one range of travel" DERIVE it from
// the live weapon rather than hardcoding a rung, so a future rung change surfaces as
// a real behavioural failure instead of a test that quietly stops testing anything.

// ─────────────────────────────────────────────────────────────────────────────
// Tiny test harness
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

function approx(a, b, eps = 1e-6) {
  return Math.abs(a - b) <= eps;
}

// ─────────────────────────────────────────────────────────────────────────────
// Arena fixture — conforms to ArenaDefinition without pulling in Three.js/the
// real arena module (which does not exist yet, and is out of scope for this
// module to author anyway).
// ─────────────────────────────────────────────────────────────────────────────

function makeArena({ cover = [], hazards = [], width = 2000, height = 2000, maxSafeRadius = 545, concealment } = {}) {
  const arena = {
    id: 'test-fixture',
    displayName: 'Test Fixture Arena',
    width,
    height,
    center: { x: width / 2, y: height / 2 },
    maxSafeRadius,
    playerSpawn: { x: 200, y: 200 },
    enemySpawn: { x: width - 200, y: height - 200 },
    cover,
    hazards,
    build() {
      return {};
    },
  };
  // ABSENT unless asked for, not `concealment: []`. Every one of the 200-odd assertions
  // above this line runs against an arena with NO SUCH FIELD, which is the case §26(a)
  // and `tools/tmp/conceal_lab.mjs --bitid` both claim is inert — so the claim is exercised
  // by the whole suite rather than only by the section that states it.
  if (concealment) arena.concealment = concealment;
  return arena;
}

const noInput = { move: { x: 0, y: 0 }, selectedWeapon: 0, attack: false };

/** Hamburger's Patty Smash — the melee weapon tests 1, 2 and 7 all fire. */
const SMASH = CHARACTERS.hamburger.weapons.find((w) => w.key === 'Smash');
/**
 * A separation comfortably inside Patty Smash's reach. 70% of range, so it is well
 * clear of the range cutoff at either end and a cone check done at this distance is
 * testing the CONE, not the range.
 */
const SMASH_IN_RANGE = Math.round(SMASH.range * 0.7);

/** Fresh match, forced straight into 'playing' (skips the 5s countdown for focused tests). */
function playingMatch(arena, playerChar = 'hamburger', enemyChar = 'donut') {
  const state = createMatch(arena, playerChar, enemyChar);
  state.phase = 'playing';
  return state;
}

// ─────────────────────────────────────────────────────────────────────────────
// 1. Melee cone: inside hits, outside misses.
// ─────────────────────────────────────────────────────────────────────────────

console.log(`\n1. Melee cone check (Hamburger "Patty Smash": range ${SMASH.range}, cone ${SMASH.cone})`);
{
  const smashIndex = CHARACTERS.hamburger.weapons.findIndex((w) => w.key === 'Smash');
  check('found Patty Smash on the roster', smashIndex !== -1);

  // Inside the cone: enemy directly ahead of the player's facing.
  {
    const arena = makeArena();
    const state = playingMatch(arena);
    state.player.x = 0;
    state.player.y = 0;
    state.player.facing = { x: 1, y: 0 };
    state.enemy.x = SMASH_IN_RANGE; // within range, angle 0 from facing
    state.enemy.y = 0;

    const events = stepMatch(state, 0, { move: { x: 0, y: 0 }, selectedWeapon: smashIndex, attack: true });
    const hit = events.find((e) => e.type === 'hit-landed');
    check('inside cone: hit-landed event fired', !!hit, JSON.stringify(events.map((e) => e.type)));
    check('inside cone: enemy took 12 damage', hit && hit.amount === 12);
    check('inside cone: enemy hp reduced by 12', state.enemy.hp === state.enemy.maxHp - 12);
  }

  // Outside the cone: enemy directly to the side (90 deg), cone/2 = 40 deg.
  {
    const arena = makeArena();
    const state = playingMatch(arena);
    state.player.x = 0;
    state.player.y = 0;
    state.player.facing = { x: 1, y: 0 };
    state.enemy.x = 0;
    // Perpendicular to facing -> 90 deg, outside the 40 deg half-cone. Deliberately
    // the SAME distance as the in-cone case above, so the only thing that differs
    // between the two is the angle.
    state.enemy.y = SMASH_IN_RANGE;

    const enemyHpBefore = state.enemy.hp;
    const events = stepMatch(state, 0, { move: { x: 0, y: 0 }, selectedWeapon: smashIndex, attack: true });
    const hit = events.find((e) => e.type === 'hit-landed');
    const fired = events.find((e) => e.type === 'weapon-fired');
    check('outside cone: no hit-landed event', !hit, JSON.stringify(events.map((e) => e.type)));
    check('outside cone: weapon still fired (cooldown consumed on attempt)', !!fired);
    check('outside cone: enemy hp unchanged', state.enemy.hp === enemyHpBefore);
  }
}

// ─────────────────────────────────────────────────────────────────────────────
// 2. Cooldown blocks a second immediate use.
// ─────────────────────────────────────────────────────────────────────────────

console.log('\n2. Cooldown gating (Patty Smash: cooldown 650ms)');
{
  const smashIndex = CHARACTERS.hamburger.weapons.findIndex((w) => w.key === 'Smash');
  const arena = makeArena();
  const state = playingMatch(arena);
  state.player.x = 0;
  state.player.y = 0;
  state.player.facing = { x: 1, y: 0 };
  state.enemy.x = SMASH_IN_RANGE;
  state.enemy.y = 0;

  const first = stepMatch(state, 0, { move: { x: 0, y: 0 }, selectedWeapon: smashIndex, attack: true });
  check('first attack fires', !!first.find((e) => e.type === 'weapon-fired'));
  const hpAfterFirst = state.enemy.hp;

  // Immediately try again, only 100ms later (< 650ms cooldown).
  const second = stepMatch(state, 100, { move: { x: 0, y: 0 }, selectedWeapon: smashIndex, attack: true });
  check('second attack (100ms later) does not fire', !second.find((e) => e.type === 'weapon-fired'));
  check('second attack does not deal damage', state.enemy.hp === hpAfterFirst);

  // Wait out the remainder of the cooldown (650 total, 100 already elapsed -> 550 more).
  const third = stepMatch(state, 551, { move: { x: 0, y: 0 }, selectedWeapon: smashIndex, attack: true });
  check('third attack (after cooldown elapses) fires again', !!third.find((e) => e.type === 'weapon-fired'));
}

// ─────────────────────────────────────────────────────────────────────────────
// 3. Slow / stun movement multipliers.
// ─────────────────────────────────────────────────────────────────────────────

console.log('\n3. Slow and stun movement effects');
{
  const arena = makeArena();

  // Baseline: unimpeded movement over 10 steps of 100ms each.
  const baseline = playingMatch(arena);
  baseline.player.x = 1000;
  baseline.player.y = 1000;
  for (let i = 0; i < 10; i++) stepMatch(baseline, 100, { move: { x: 1, y: 0 }, selectedWeapon: 0, attack: false });
  const baselineDx = baseline.player.x - 1000;
  check('baseline moved a positive distance', baselineDx > 0);

  // Slowed: same setup, but slowedUntil is far in the future.
  const slowed = playingMatch(arena);
  slowed.player.x = 1000;
  slowed.player.y = 1000;
  slowed.player.status.slowedUntil = 1e9;
  for (let i = 0; i < 10; i++) stepMatch(slowed, 100, { move: { x: 1, y: 0 }, selectedWeapon: 0, attack: false });
  const slowedDx = slowed.player.x - 1000;
  check(
    `slow applies SLOW_MOVE_MULTIPLIER (${SLOW_MOVE_MULTIPLIER}) exactly`,
    approx(slowedDx, baselineDx * SLOW_MOVE_MULTIPLIER, 1e-6),
    `baseline=${baselineDx}, slowed=${slowedDx}, expected=${baselineDx * SLOW_MOVE_MULTIPLIER}`,
  );

  // Stunned: movement locked to zero regardless of input.
  const stunned = playingMatch(arena);
  stunned.player.x = 1000;
  stunned.player.y = 1000;
  stunned.player.status.stunnedUntil = 1e9;
  for (let i = 0; i < 10; i++) stepMatch(stunned, 100, { move: { x: 1, y: 0 }, selectedWeapon: 0, attack: false });
  check('stunned fighter does not move at all', stunned.player.x === 1000 && stunned.player.y === 1000);
}

// ─────────────────────────────────────────────────────────────────────────────
// 4. Projectile expires exactly at its range.
// ─────────────────────────────────────────────────────────────────────────────

const ONION = CHARACTERS.taco.weapons.find((w) => w.key === 'Onion');
console.log(`\n4. Projectile range expiry (Taco "Onion Bomb": range ${ONION.range}, speed ${ONION.speed})`);
{
  const onionIndex = CHARACTERS.taco.weapons.findIndex((w) => w.key === 'Onion');
  check('found Onion Bomb on the roster', onionIndex !== -1);

  const arena = makeArena({ width: 4000, height: 4000 });
  const state = createMatch(arena, 'taco', 'hamburger');
  state.phase = 'playing';
  state.player.x = 500;
  state.player.y = 500;
  state.player.facing = { x: 1, y: 0 };
  // Keep the enemy far out of the way so it neither blocks nor gets hit.
  state.enemy.x = 3800;
  state.enemy.y = 3800;

  // Fire with dt=0 so the shot spawns without also being advanced this tick —
  // isolates "distance travelled" to whole, exact dt steps afterwards.
  const fireEvents = stepMatch(state, 0, { move: { x: 0, y: 0 }, aim: { x: 1, y: 0 }, selectedWeapon: onionIndex, attack: true });
  const spawned = fireEvents.find((e) => e.type === 'projectile-spawned');
  check('projectile spawned', !!spawned);
  check('exactly one projectile in flight', state.projectiles.length === 1);

  // One step of exactly the weapon's full time-of-flight, so the projectile travels
  // exactly its range. `SPEED` is derived as range/FLIGHT_MS, so this is 500 ms —
  // and 500/1000 = 0.5 and 232*0.5 = 116 are both exact in binary fp, leaving no
  // floating-point remainder to make the `traveled >= range` comparison ambiguous.
  const flightMs = (ONION.range / ONION.speed) * 1000;
  const travelEvents = stepMatch(state, flightMs, { move: { x: 0, y: 0 }, selectedWeapon: onionIndex, attack: false });
  const destroyed = travelEvents.find((e) => e.type === 'projectile-destroyed');
  check('projectile destroyed after travelling exactly its range', !!destroyed, JSON.stringify(travelEvents.map((e) => e.type)));
  check('destruction reason is "expired" (not a wall/target hit)', destroyed && destroyed.reason === 'expired');
  check('no projectiles remain', state.projectiles.length === 0);
}

// ─────────────────────────────────────────────────────────────────────────────
// 5. Collision: blocked head-on, but slides along the wall.
// ─────────────────────────────────────────────────────────────────────────────

console.log('\n5. Cover collision: blocked head-on, slides along the wall');
{
  // Box centred at (500,300), full extents 100x100 -> spans x:[450,550], y:[250,350].
  const cover = [{ x: 500, y: 300, w: 100, h: 100 }];
  const arena = makeArena({ cover, width: 2000, height: 2000 });

  // (a) Head-on: approach straight along +x at the box's y-centre. The collision
  // half-gap threshold is (PLAYER_SIZE + box.w)/2 = (42+100)/2 = 71, so the player
  // should never be able to push its centre past x = 500 - 71 = 429.
  {
    const state = playingMatch(arena);
    state.player.x = 300;
    state.player.y = 300;
    for (let i = 0; i < 30; i++) stepMatch(state, 100, { move: { x: 1, y: 0 }, selectedWeapon: 0, attack: false });
    const stoppedX = state.player.x;
    check('head-on approach never crosses the collision boundary (429)', stoppedX <= 429 + 1e-9, `x=${stoppedX}`);

    const beforeExtra = state.player.x;
    stepMatch(state, 100, { move: { x: 1, y: 0 }, selectedWeapon: 0, attack: false });
    check('further attempts to push into the box do not move it', state.player.x === beforeExtra);
  }

  // (b) Slide: start pinned exactly at the boundary (x=429, gap=71, not colliding)
  // and move diagonally. X should stay blocked while Y is free to slide.
  {
    const state = playingMatch(arena);
    state.player.x = 429;
    state.player.y = 300;
    let yValues = [state.player.y];
    for (let i = 0; i < 5; i++) {
      stepMatch(state, 100, { move: { x: 1, y: 1 }, selectedWeapon: 0, attack: false });
      yValues.push(state.player.y);
    }
    const xUnchanged = state.player.x === 429;
    const yStrictlyIncreased = yValues.every((v, i) => i === 0 || v > yValues[i - 1]);
    check('x stays pinned against the wall while moving diagonally', xUnchanged, `x=${state.player.x}`);
    check('y slides freely along the wall (strictly increasing each step)', yStrictlyIncreased, JSON.stringify(yValues));
  }
}

// ─────────────────────────────────────────────────────────────────────────────
// 6. Fog damage ticks at the right rate once the safe radius has shrunk past a fighter.
// ─────────────────────────────────────────────────────────────────────────────

console.log('\n6. Fog damage tick rate');
{
  const arena = makeArena({ width: 2000, height: 2000 }); // centre = (1000,1000)
  const state = playingMatch(arena);

  // Enemy stays safe at the exact centre; only the player is tested.
  state.enemy.x = arena.center.x;
  state.enemy.y = arena.center.y;

  // Player sits 400 world units from centre.
  state.player.x = arena.center.x + 400;
  state.player.y = arena.center.y;

  // Force match progress to 50% so safeRadius = 545 * 0.5 = 272.5 < 400 -> player is outside.
  // DERIVED from the constant, not typed: MATCH_DURATION_MS moved 180 s -> 45 s on
  // 2026-08-05 and a hardcoded 90_000 silently became 200% progress, which put the ring
  // OUTSIDE the player and stopped this test testing fog at all.
  state.timeRemaining = MATCH_DURATION_MS / 2;

  const hpStart = state.player.hp;

  const e1 = stepMatch(state, 100, noInput);
  check('no fog hit at 100ms (< FOG_TICK_MS)', !e1.find((e) => e.type === 'hit-landed' && e.source.kind === 'fog'));

  const e2 = stepMatch(state, 100, noInput);
  check('no fog hit at 200ms (< FOG_TICK_MS)', !e2.find((e) => e.type === 'hit-landed' && e.source.kind === 'fog'));
  check(`safeRadius has shrunk below the player's distance from centre (400)`, state.safeRadius < 400, `safeRadius=${state.safeRadius}`);

  const e3 = stepMatch(state, 100, noInput); // totals exactly FOG_TICK_MS (300ms)
  const fogHit = e3.find((e) => e.type === 'hit-landed' && e.source.kind === 'fog');
  check(`exactly one fog hit fires right at ${FOG_TICK_MS}ms`, !!fogHit, JSON.stringify(e3.map((e) => e.type)));
  check(`fog hit deals FOG_DAMAGE (${FOG_DAMAGE})`, fogHit && fogHit.amount === FOG_DAMAGE);
  check('player hp reduced by exactly FOG_DAMAGE', state.player.hp === hpStart - FOG_DAMAGE);

  // Next tick shouldn't double-fire (timer just reset).
  const e4 = stepMatch(state, 100, noInput);
  check('no second fog hit immediately after (timer just reset)', !e4.find((e) => e.type === 'hit-landed' && e.source.kind === 'fog'));
}

// ─────────────────────────────────────────────────────────────────────────────
// 7. HP hitting zero ends the match with the correct winner.
// ─────────────────────────────────────────────────────────────────────────────

console.log('\n7. Match ends on death with the correct winner');
{
  const smashIndex = CHARACTERS.hamburger.weapons.findIndex((w) => w.key === 'Smash'); // damage 12

  // Player lands the killing blow -> enemy dies -> player wins.
  {
    const arena = makeArena();
    const state = playingMatch(arena);
    state.player.x = 0;
    state.player.y = 0;
    state.player.facing = { x: 1, y: 0 };
    state.enemy.x = SMASH_IN_RANGE;
    state.enemy.y = 0;
    state.enemy.hp = 5; // less than Smash's 12 damage

    const events = stepMatch(state, 0, { move: { x: 0, y: 0 }, selectedWeapon: smashIndex, attack: true });
    check('enemy hp clamps to 0 (not negative)', state.enemy.hp === 0);
    check('a death event fires for the enemy', !!events.find((e) => e.type === 'death' && e.fighterRole === 'enemy'));
    check(
      'a match-ended event fires with the player as winner',
      !!events.find((e) => e.type === 'match-ended' && e.winner === 'player'),
    );
    check('match phase is "ended"', state.phase === 'ended');
    check('state.winner is "player"', state.winner === 'player');
  }

  // Enemy lands the killing blow (via fog, to avoid depending on AI positioning) -> player dies -> enemy wins.
  {
    const arena = makeArena({ width: 2000, height: 2000 });
    const state = playingMatch(arena);
    state.enemy.x = arena.center.x;
    state.enemy.y = arena.center.y;
    state.player.x = arena.center.x + 400;
    state.player.y = arena.center.y;
    state.player.hp = 10; // less than one FOG_DAMAGE (15) tick
    state.timeRemaining = MATCH_DURATION_MS / 2; // 50% progress -> safeRadius 272.5 < 400

    let events = [];
    for (let i = 0; i < 3; i++) events = stepMatch(state, 100, noInput); // 300ms total = one fog tick

    check('player hp clamps to 0 (not negative)', state.player.hp === 0);
    check('a death event fires for the player', !!events.find((e) => e.type === 'death' && e.fighterRole === 'player'));
    check(
      'a match-ended event fires with the enemy as winner',
      !!events.find((e) => e.type === 'match-ended' && e.winner === 'enemy'),
    );
    check('match phase is "ended"', state.phase === 'ended');
    check('state.winner is "enemy"', state.winner === 'enemy');
  }
}

// ─────────────────────────────────────────────────────────────────────────────
// 8. Extra: full countdown -> playing -> match-timer flow, sanity check.
// ─────────────────────────────────────────────────────────────────────────────

console.log('\n8. Countdown -> playing transition (sanity)');
{
  const arena = makeArena();
  const state = createMatch(arena, 'hamburger', 'donut');
  check('match starts in countdown', state.phase === 'countdown');
  // Was `=== 5`, a hardcode that outlived the constant it claimed to be checking: this
  // assertion's own NAME says COUNTDOWN_FROM, and it went to 3 in DEVIATION #8. A test
  // that names a constant and compares against a literal stops testing anything the
  // moment the constant moves — it only tells you the literal is still the literal.
  check('countdown starts at COUNTDOWN_FROM', state.countdownValue === COUNTDOWN_FROM,
    `countdownValue=${state.countdownValue} COUNTDOWN_FROM=${COUNTDOWN_FROM}`);

  let sawMatchStarted = false;
  let sawFinalTick = false;
  // COUNTDOWN_FROM x 1000 + the START! flash, stepped in 50 ms increments with plenty
  // of headroom — derived, so this loop cannot silently stop reaching the whistle.
  const countdownSteps = Math.ceil((COUNTDOWN_FROM * 1000 + COUNTDOWN_START_FLASH_MS) / 50) + 20;
  for (let i = 0; i < countdownSteps; i++) {
    const events = stepMatch(state, 50, noInput);
    if (events.find((e) => e.type === 'countdown-tick' && e.value === 0)) sawFinalTick = true;
    if (events.find((e) => e.type === 'match-started')) sawMatchStarted = true;
    if (state.phase === 'playing') break;
  }
  check('countdown reaches its final "0" tick before START!', sawFinalTick);
  check('match transitions to playing', state.phase === 'playing');
  check('match-started event fired exactly once during the transition', sawMatchStarted);
  // The prototype's countdown-transition and playing-phase-timer blocks are two
  // separate `if`s (not else-if), so the very tick that flips phase to 'playing'
  // also immediately decrements timeRemaining by that same tick's dt (50ms here) —
  // reproduced faithfully rather than "corrected" to a clean 180000.
  check(
    'timeRemaining reset to full match duration, minus the transition tick\'s dt',
    state.timeRemaining === MATCH_DURATION_MS - 50,
    `timeRemaining=${state.timeRemaining}`,
  );
}

// ─────────────────────────────────────────────────────────────────────────────
// Summary

// ─────────────────────────────────────────────────────────────────────────────
// 9. AI must not axis-lock against cover (regression)
//
// The shipped arena placed chokepoint props exactly on y = CENTRE.y, which is also
// both spawn y-coordinates. With straight-line chase and per-axis collision, an AI
// sharing the player's y pressed into the box forever: the x step was refused and
// dy was exactly 0, so there was nothing to slide along. The fix makes a blocked
// mover try both perpendiculars and take whichever ends up closer to its target.
// ─────────────────────────────────────────────────────────────────────────────
{
  console.log('\n9. AI slides around cover instead of axis-locking');

  // A wall squarely between the two fighters, both on the same y.
  const arena = makeArena({
    cover: [{ x: 1000, y: 1000, w: 120, h: 120, kind: 'wall' }],
  });
  const state = playingMatch(arena);
  state.player.x = 1400; state.player.y = 1000;
  state.enemy.x = 600;   state.enemy.y = 1000;
  // Keep the AI in pure-chase mode: out of every weapon's range so it must walk.
  const startX = state.enemy.x;
  const startY = state.enemy.y;

  // Long enough to actually REACH the wall AND get around it: chase speed is 0.07
  // units/ms and the wall's near face is ~319 units away, so ~285 ticks just to
  // arrive. An earlier version used 200 ticks and passed vacuously — the AI never
  // made contact at all.
  //
  // Track the PEAK detour, not the final offset: a working AI rounds the obstacle
  // and then converges back onto the player's row, so its final dy is ~0 whether it
  // succeeded or was stuck. Asserting on final dy tested the wrong thing.
  let peakDetour = 0;
  let closest = Math.abs(state.player.x - state.enemy.x);
  for (let i = 0; i < 900; i++) {
    stepMatch(state, 16, noInput);
    peakDetour = Math.max(peakDetour, Math.abs(state.enemy.y - startY));
    closest = Math.min(closest, Math.hypot(state.player.x - state.enemy.x, state.player.y - state.enemy.y));
  }

  const wallNearFace = 1000 - 60 - state.enemy.size / 2; // ~919

  check('AI made forward progress toward the player',
    state.enemy.x > startX + 1,
    `enemy.x ${startX} -> ${state.enemy.x}`);
  check('AI detoured off the blocked axis to get around the wall',
    peakDetour > 20,
    `peak |dy| was ${peakDetour.toFixed(2)}`);
  check('AI got PAST the wall rather than stalling at its face',
    state.enemy.x > wallNearFace + 40,
    `enemy.x ended ${state.enemy.x.toFixed(1)}, wall face ~${wallNearFace.toFixed(1)}`);
  // Donut's only weapon is Candy Barrage, so "in range" means exactly its reach.
  // Asserted against the live number rather than a slack constant: the AI stops
  // walking the tick it is inside range, so a correct chase ends within one 16 ms
  // step (0.07 * 16 = 1.1 wu) of the boundary, and anything looser would still pass
  // if the AI stalled halfway.
  const donutReach = CHARACTERS.donut.weapons[0].range;
  check('AI closed to weapon range of the player',
    closest < donutReach + 2,
    `closest approach ${closest.toFixed(1)}, Candy Barrage reach ${donutReach}`);
}

// ─────────────────────────────────────────────────────────────────────────────
// 10. THE CLOCK ENDS THE MATCH (regression)
//
// `stepMatch` decremented `timeRemaining` to 0 and had no time-limit branch at all.
// Measured before the fix: 110 of 110 forced-immortal matchups were still
// phase='playing', winner=null after 360 s of a 180 s match. In an ordinary match the
// clock LOOKED decisive only because the ring had closed to zero and the fog had
// killed someone — and it always killed the player first, because 100 HP at 50 HP/s
// runs out a full second before 150 HP does. Timing out was a guaranteed player loss.
// ─────────────────────────────────────────────────────────────────────────────
{
  console.log('\n10. Time limit terminates the match, and the tiebreak is not role-determined');

  /** Fresh playing match with the clock about to expire and neither fighter able to act. */
  function atTheWhistle(opts = {}) {
    const arena = makeArena({ width: 2000, height: 2000 });
    const state = playingMatch(arena);
    // Park both on the centre so the fog cannot interfere with what is being tested.
    state.player.x = arena.center.x; state.player.y = arena.center.y;
    state.enemy.x = arena.center.x; state.enemy.y = arena.center.y;
    // Every weapon permanently on cooldown: `elapsed - Infinity` is -Infinity.
    state.player.lastUsed = state.player.lastUsed.map(() => Infinity);
    state.enemy.lastUsed = state.enemy.lastUsed.map(() => Infinity);
    state.timeRemaining = 100;
    Object.assign(state.player, opts.player ?? {});
    Object.assign(state.enemy, opts.enemy ?? {});
    return { arena, state };
  }

  // (a) It ends at all.
  {
    const { state } = atTheWhistle();
    const events = stepMatch(state, 200, noInput);
    check('clock expiry ends the match', state.phase === 'ended', `phase=${state.phase}`);
    check('clock expiry names a winner', state.winner !== null, `winner=${state.winner}`);
    check('clock expiry emits match-ended', !!events.find((e) => e.type === 'match-ended'));
    check('a timeout is not a knockout: both fighters are still alive',
      state.player.alive && state.enemy.alive);
    check('a timeout emits no death event', !events.find((e) => e.type === 'death'));
  }

  // (b) A full immortal match terminates rather than running forever.
  {
    const arena = makeArena({ width: 2000, height: 2000 });
    const state = createMatch(arena, 'hamburger', 'donut');
    state.player.hp = state.player.maxHp = 1e9;
    state.enemy.hp = state.enemy.maxHp = 1e9;
    let steps = 0;
    while (state.phase !== 'ended' && steps < 4000) { stepMatch(state, 100, noInput); steps++; }
    check('an unkillable-vs-unkillable match still ends', state.phase === 'ended', `after ${steps} steps`);
    check('...and ends on the clock, not later', state.timeRemaining === 0);
  }

  // (c) THE FAIRNESS REGRESSION. Absolute HP says one fighter, the HP FRACTION says the
  //     other. Any tiebreak that compares raw HP fails this.
  //
  //     ⚠️ RE-DERIVED, NOT WEAKENED (2026-08-05). This was two hardcoded numbers — player
  //     60/100 = 0.60 against enemy 75/150 = 0.50 — and that construction is only
  //     buildable while `ENEMY_MAX_HP > PLAYER_MAX_HP`. AUTHORISED DEVIATION #9 took the
  //     enemy pool to 90 and INVERTED the two, at which point 75/90 = 0.83 and the old
  //     literals asserted the opposite of the rule. The rule itself never mentioned which
  //     role owns the bigger pool, so the fixture now derives the disagreement from the
  //     constants and asserts it in whichever direction they imply. It tests the rule
  //     instead of the era, and it fails loudly if the constants ever make the
  //     disagreement unbuildable (they do when the pools are within ~2 HP of each other,
  //     because then no pair of HP values can separate absolute from fraction).
  {
    // ⚠️ THE POOLS ARE THE FIGHTERS', NOT THE ROLE CONSTANTS' (rules.ts DEVIATION #10).
    // `PLAYER_MAX_HP` / `ENEMY_MAX_HP` are the role BASES now, and every character scales
    // them — so which side holds the bigger pool depends on the two CHARACTERS in the
    // fixture, not on the two constants. Read it off the match that was actually created.
    const probe = atTheWhistle().state;
    const bigRole = probe.enemy.maxHp >= probe.player.maxHp ? 'enemy' : 'player';
    const smallRole = bigRole === 'enemy' ? 'player' : 'enemy';
    const bigMax = Math.max(probe.player.maxHp, probe.enemy.maxHp);
    const smallMax = Math.min(probe.player.maxHp, probe.enemy.maxHp);
    // The bigger pool gets more ABSOLUTE HP by exactly 1, which forces the smaller pool
    // to hold the higher FRACTION whenever the pools differ by more than 1/0.6 HP.
    const bigHp = 0.6 * bigMax;
    const smallHp = bigHp - 1;
    const disagree = bigHp > smallHp && smallHp / smallMax > bigHp / bigMax;
    const { state } = atTheWhistle({ [bigRole]: { hp: bigHp }, [smallRole]: { hp: smallHp } });
    stepMatch(state, 200, noInput);
    check(
      `higher HP FRACTION wins, not higher HP (${smallRole} ${smallHp}/${smallMax}=${(smallHp / smallMax).toFixed(2)} ` +
      `beats ${bigRole} ${bigHp}/${bigMax}=${(bigHp / bigMax).toFixed(2)})`,
      disagree && state.winner === smallRole,
      disagree ? `winner=${state.winner}` : `POOLS TOO CLOSE (${probe.player.maxHp} vs ${probe.enemy.maxHp}): absolute and fraction cannot be made to disagree — this check no longer tests anything, go and read it`,
    );
  }
  {
    // The mirror, same derivation: the bigger pool now also holds the higher fraction, so
    // both criteria agree and the winner must be the bigger pool's owner either way.
    const probe = atTheWhistle().state;
    const bigRole = probe.enemy.maxHp >= probe.player.maxHp ? 'enemy' : 'player';
    const smallRole = bigRole === 'enemy' ? 'player' : 'enemy';
    const bigMax = Math.max(probe.player.maxHp, probe.enemy.maxHp);
    const smallMax = Math.min(probe.player.maxHp, probe.enemy.maxHp);
    const { state } = atTheWhistle({ [bigRole]: { hp: 0.6 * bigMax }, [smallRole]: { hp: 0.5 * smallMax } });
    stepMatch(state, 200, noInput);
    check('lower HP fraction loses (0.50 against 0.60)', state.winner === bigRole, `winner=${state.winner}`);
  }

  // (d) Level on HP -> zone control decides, and it can go either way. Two runs with
  //     only the POSITIONS swapped: if the rule were role-determined both would agree.
  {
    const a = atTheWhistle();
    a.state.player.x = a.arena.center.x + 10;
    a.state.enemy.x = a.arena.center.x + 400;
    stepMatch(a.state, 200, noInput);

    const b = atTheWhistle();
    b.state.player.x = b.arena.center.x + 400;
    b.state.enemy.x = b.arena.center.x + 10;
    stepMatch(b.state, 200, noInput);

    check('level on HP: the fighter nearer the ring centre wins', a.state.winner === 'player', `winner=${a.state.winner}`);
    check('level on HP: and it is genuinely positional, not role-determined',
      b.state.winner === 'enemy', `winner=${b.state.winner}`);
  }

  // (e) A knockout on the very last tick is still a knockout.
  {
    const smashIndex = CHARACTERS.hamburger.weapons.findIndex((w) => w.key === 'Smash');
    const arena = makeArena({ width: 2000, height: 2000 });
    const state = playingMatch(arena);
    state.player.x = arena.center.x; state.player.y = arena.center.y;
    state.player.facing = { x: 1, y: 0 };
    state.enemy.x = arena.center.x + SMASH_IN_RANGE; state.enemy.y = arena.center.y;
    state.enemy.hp = 5;
    state.timeRemaining = 1;
    const events = stepMatch(state, 200, { move: { x: 0, y: 0 }, selectedWeapon: smashIndex, attack: true });
    check('a killing blow on the final tick wins as a KNOCKOUT, not a timeout',
      state.winner === 'player' && !!events.find((e) => e.type === 'death' && e.fighterRole === 'enemy'));
  }
}

// ─────────────────────────────────────────────────────────────────────────────
// 11. THE CLOSING RING HAS A FLOOR (regression)
//
// A ring that reaches zero means the last seconds of a full-length match contain no
// ground costing 0 HP/s, so the match is decided by which HP pool is smaller — always
// the player's. Measured before the fix, both fighters pinned and unable to attack:
// player dead at 2.00 s, enemy at 3.00 s. That also made section 10's tiebreak
// unreachable, because the fog always resolved the match before the whistle.
// ─────────────────────────────────────────────────────────────────────────────
{
  console.log('\n11. The closing ring never reaches zero');

  check(
    `MIN_SAFE_RADIUS (${MIN_SAFE_RADIUS}) clears the central damage hazard (${POT.dangerRadius}) by at least half a body`,
    MIN_SAFE_RADIUS >= POT.dangerRadius + PLAYER_SIZE / 2,
    `${MIN_SAFE_RADIUS} < ${POT.dangerRadius + PLAYER_SIZE / 2}`,
  );

  const arena = makeArena({ width: 2000, height: 2000 });
  const state = playingMatch(arena);
  state.player.hp = state.player.maxHp = 1e9;
  state.enemy.hp = state.enemy.maxHp = 1e9;
  let minSeen = Infinity;
  for (let i = 0; i < 600 && state.phase === 'playing'; i++) {
    stepMatch(state, 100, noInput);
    minSeen = Math.min(minSeen, state.safeRadius);
  }
  check('safeRadius never drops below MIN_SAFE_RADIUS over a whole match',
    minSeen >= MIN_SAFE_RADIUS - 1e-9, `min seen ${minSeen}`);

  // The point of the floor: at the whistle there is still ground that costs nothing.
  {
    const st = playingMatch(makeArena({ width: 2000, height: 2000 }));
    st.timeRemaining = 100;
    // Stand in the safe annulus: outside the pot, inside the floored ring.
    const r = (POT.dangerRadius + MIN_SAFE_RADIUS) / 2;
    st.player.x = st.arena.center.x + r; st.player.y = st.arena.center.y;
    st.enemy.x = st.arena.center.x - r; st.enemy.y = st.arena.center.y;
    const hp0 = st.player.hp;
    stepMatch(st, 99, noInput);
    check('a fighter in the final annulus takes no fog damage at the whistle',
      st.player.hp === hp0, `hp ${hp0} -> ${st.player.hp}, R=${st.safeRadius}`);
  }

  // The clock must stay far enough above the fog's first-contact time that
  // `arena/shared.ts`'s `R0 = halfDiagonal / (1 - t/T)` stays well conditioned.
  // FOG_FIRST_CONTACT_S lives in `arena/shared.ts`, which pulls in Three.js and cannot
  // be imported here; 6 is duplicated deliberately and is checked by eye against it.
  const FOG_FIRST_CONTACT_MS = 6000;
  check('MATCH_DURATION_MS leaves the derived opening ring well conditioned (>= 4x first contact)',
    MATCH_DURATION_MS >= FOG_FIRST_CONTACT_MS * 4,
    `${MATCH_DURATION_MS} vs ${FOG_FIRST_CONTACT_MS * 4}`);
}

// ─────────────────────────────────────────────────────────────────────────────
// 12. STICKY TRAIL CANNOT BURST (regression)
//
// `applyWorldTick` damaged once PER MARK, for every overlapping mark, in the same
// tick, uncapped. `TRAIL.radius` (22) is about double the ~11 wu a chasing AI covers
// between drops, and up to ceil(durationMs/dropIntervalMs) marks live at once, so a
// Donut that circles or is held against cover stacks its whole trail on one tile.
// Measured before the fix: 87 HP in one 16.67 ms tick across 29 hit events.
// ─────────────────────────────────────────────────────────────────────────────
{
  console.log('\n12. Sticky Trail is capped per tick');
  const MAX_MARKS = Math.ceil(TRAIL.durationMs / TRAIL.dropIntervalMs);

  function stackedMarks() {
    const arena = makeArena({ width: 2000, height: 2000 });
    // Enemy is deliberately NOT the Donut: the marks below are injected with
    // ownerRole 'enemy' directly, and a live Donut would keep dropping FRESH marks
    // every dropIntervalMs, which reads exactly like the stack dripping.
    const state = playingMatch(arena, 'hamburger', 'hamburger');
    state.player.x = arena.center.x; state.player.y = arena.center.y;
    state.enemy.x = arena.center.x; state.enemy.y = arena.center.y;
    // Enemy weapons permanently on cooldown so ONLY the trail can deal damage.
    state.enemy.lastUsed = state.enemy.lastUsed.map(() => Infinity);
    for (let i = 0; i < MAX_MARKS; i++) {
      state.trailMarks.push({
        id: 10_000 + i, ownerId: 1, ownerRole: 'enemy',
        x: arena.center.x, y: arena.center.y,
        expiresAt: state.elapsed + TRAIL.durationMs, damagedMask: 0, damaged: false,
      });
    }
    return state;
  }

  {
    const state = stackedMarks();
    const hp0 = state.player.hp;
    const events = stepMatch(state, 16.667, noInput);
    const trailHits = events.filter((e) => e.type === 'hit-landed' && e.source.kind === 'trail');
    check(`${MAX_MARKS} stacked marks deal at most TRAIL.damage (${TRAIL.damage}) in one tick`,
      hp0 - state.player.hp <= TRAIL.damage, `lost ${hp0 - state.player.hp} HP`);
    check(`...via at most TRAIL.maxHitsPerTick (${TRAIL.maxHitsPerTick}) hit events`,
      trailHits.length <= TRAIL.maxHitsPerTick, `${trailHits.length} events`);

    // And the cap must not merely defer the burst: the whole overlapping stack is
    // spent in that tick, so it cannot drip the same 87 HP out over the next 29 ticks.
    let dripped = 0;
    for (let i = 0; i < 60; i++) {
      const hpBefore = state.player.hp;
      stepMatch(state, 16.667, noInput);
      dripped += hpBefore - state.player.hp;
    }
    check('the spent stack does not drip the same damage out over later ticks',
      dripped === 0, `${dripped} HP over the following 60 ticks`);
  }

  // The mechanic still works: one mark under the opponent still hurts, once.
  {
    const arena = makeArena({ width: 2000, height: 2000 });
    const state = playingMatch(arena, 'hamburger', 'donut');
    state.player.x = arena.center.x; state.player.y = arena.center.y;
    state.enemy.x = arena.center.x + 800; state.enemy.y = arena.center.y;
    state.enemy.lastUsed = state.enemy.lastUsed.map(() => Infinity);
    state.trailMarks.push({
      id: 99, ownerId: 1, ownerRole: 'enemy', x: arena.center.x, y: arena.center.y,
      expiresAt: state.elapsed + TRAIL.durationMs, damagedMask: 0, damaged: false,
    });
    const hp0 = state.player.hp;
    stepMatch(state, 16.667, noInput);
    check('a single trail mark still deals TRAIL.damage', hp0 - state.player.hp === TRAIL.damage,
      `lost ${hp0 - state.player.hp}`);
    const hp1 = state.player.hp;
    stepMatch(state, 16.667, noInput);
    check('...and only once', state.player.hp === hp1);
  }
}

// ─────────────────────────────────────────────────────────────────────────────
// 13. MELEE FACING AT ZERO SEPARATION (regression)
//
// `dot = (facing . toTarget) / dist` with dist === 0 is NaN, and `NaN > cone/2` is
// false, so a coned melee swing landed on a perfectly overlapping target no matter
// where the attacker was pointing. The AI closes to literally zero separation, so aim
// stopped mattering exactly where the fight is closest. See combat.ts for the defined
// answer: coincident fighters have no bearing, so a DIRECTIONAL swing misses and an
// OMNIDIRECTIONAL one (cone >= 360) still lands.
// ─────────────────────────────────────────────────────────────────────────────
{
  console.log('\n13. Melee cone is well-defined at zero separation');
  const smashIndex = CHARACTERS.hamburger.weapons.findIndex((w) => w.key === 'Smash'); // cone 80
  const giantIndex = CHARACTERS.lollipop.weapons.findIndex((w) => w.key === 'Giant');  // cone 360

  function swing({ charId = 'hamburger', weaponIndex = smashIndex, dx = 0, dy = 0, facing = { x: 1, y: 0 } }) {
    const arena = makeArena({ width: 2000, height: 2000 });
    const state = playingMatch(arena, charId, 'hamburger');
    state.player.x = 500; state.player.y = 500;
    state.player.facing = facing;
    state.enemy.x = 500 + dx; state.enemy.y = 500 + dy;
    // The enemy AI acts inside this same tick and, at zero separation, lands its own
    // hits — so only the PLAYER's swing (targetRole 'enemy') is read here. Judging any
    // `hit-landed` event measured the AI, not the cone.
    state.enemy.lastUsed = state.enemy.lastUsed.map(() => Infinity);
    const events = stepMatch(state, 0, { move: { x: 0, y: 0 }, selectedWeapon: weaponIndex, attack: true });
    return {
      hit: !!events.find((e) => e.type === 'hit-landed' && e.targetRole === 'enemy'),
      fired: !!events.find((e) => e.type === 'weapon-fired' && e.fighterRole === 'player'),
    };
  }

  const away = swing({ facing: { x: -1, y: 0 } });
  check('coincident + coned weapon + facing away: NO hit', !away.hit);
  check('coincident: the attempt still consumed the cooldown', away.fired);
  check('coincident + coned weapon + facing "toward": also no hit (there is no bearing)',
    !swing({ facing: { x: 1, y: 0 } }).hit);
  check('coincident + OMNIDIRECTIONAL weapon (cone 360): still hits',
    swing({ charId: 'lollipop', weaponIndex: giantIndex }).hit);

  // Continuity: everything above the epsilon behaves exactly as it always did.
  check('just off coincident, inside the cone: hits', swing({ dx: 0.001, facing: { x: 1, y: 0 } }).hit);
  check('just off coincident, outside the cone: misses', swing({ dx: 0.001, facing: { x: -1, y: 0 } }).hit === false);
  check('normal range, inside the cone: hits', swing({ dx: SMASH_IN_RANGE, facing: { x: 1, y: 0 } }).hit);
  check('normal range, outside the cone: misses', swing({ dy: SMASH_IN_RANGE, facing: { x: 1, y: 0 } }).hit === false);
}

// ─────────────────────────────────────────────────────────────────────────────
// 14. GLOBAL NAVIGATION (regression)
//
// Greedy local avoidance is a hill-climber on straight-line distance. It escapes any
// obstacle whose detour eventually shortens that distance, and provably cannot escape one
// whose only route lengthens it first — there is no local signal saying which way is out,
// and both perpendiculars look equally wrong.
//
// The shipped arena contains exactly that shape, around the PLAYER'S OWN SPAWN. Measured
// on the real sim before `movement.ts` grew a flow field, with the player parked motionless
// and immortal on its own spawn: the enemy walked 2,968 wu, parked at the east face of a
// prep counter and oscillated 38 wu in y for the remaining 25 s of a 45 s match, closest
// approach 284 wu against a reach of 153 wu — for all 11 enemy characters, every time.
//
// The fixtures below are the two shapes that separate a router from a hill-climber. They
// are deliberately synthetic: they must keep testing the ALGORITHM after the arena peer
// moves the furniture, which a fixture copied from `kitchen.ts` would not.
//
// ⚠️ EVERY FIXTURE HERE HOLDS THE CLOSING RING OPEN (`NAV_SAFE_RADIUS`), and that is not
// a workaround — it is what keeps these tests about NAVIGATION. `ai.ts` gained a ring term
// on 2026-08-05 (rules.ts AUTHORISED DEVIATION #6), and each of these fixtures parks its
// motionless target ~540 wu from the arena centre and then runs for 40 s of a 45 s clock,
// by which time the real ring has closed to its 140 wu floor. A correct AI therefore
// REFUSES to walk out to the target — measured: closest approach 284 / 206 / 207 wu, all
// three ending near the centre. That is the hazard rule working, and scoring it as a
// pathfinding failure would have deleted a fix. Section 18 tests the ring term directly.
// ─────────────────────────────────────────────────────────────────────────────
{
  console.log('\n14. The AI routes around obstacles a greedy rule cannot escape');

  /** Ring radius that never bites inside a 40 s run, so routing is measured alone. */
  const NAV_SAFE_RADIUS = 20_000;

  /** Run the AI at a motionless, immortal player and report how close it ever got. */
  function chase(arena, px, py, ms = 40_000, enemyChar = 'donut') {
    const state = playingMatch(arena, 'hamburger', enemyChar);
    state.player.x = px; state.player.y = py;
    state.player.hp = 1e9; state.player.maxHp = 1e9;
    state.enemy.hp = 1e9; state.enemy.maxHp = 1e9;
    // Park the enemy's weapons on cooldown so it always chooses to MOVE. Otherwise the
    // test stops being about navigation the moment anything comes into range.
    let best = Infinity;
    let insideCover = 0;
    const t0 = state.elapsed;
    while (state.elapsed - t0 < ms) {
      state.player.x = px; state.player.y = py;
      state.enemy.lastUsed = state.enemy.lastUsed.map(() => state.elapsed);
      stepMatch(state, 16.667, noInput);
      best = Math.min(best, Math.hypot(state.enemy.x - px, state.enemy.y - py));
      for (const o of arena.cover) {
        if (Math.abs(state.enemy.x - o.x) < (state.enemy.size + o.w) / 2 &&
            Math.abs(state.enemy.y - o.y) < (state.enemy.size + o.h) / 2) { insideCover++; break; }
      }
    }
    return { best, insideCover, x: state.enemy.x, y: state.enemy.y };
  }

  // ── (a) The alcove. A wall with a barrel bridging the only straight approach, so the
  // route must first travel AWAY from the target. This is the shipped arena's shape.
  {
    const arena = makeArena({
      width: 1400, height: 1000, maxSafeRadius: NAV_SAFE_RADIUS,
      cover: [
        { x: 340, y: 420, w: 160, h: 55 },   // upper counter
        { x: 340, y: 580, w: 160, h: 55 },   // lower counter
        { x: 250, y: 500, w: 60, h: 50 },    // the barrel that seals the gap between them
      ],
    });
    arena.playerSpawn = { x: 160, y: 500 };
    arena.enemySpawn = { x: 1240, y: 500 };
    const r = chase(arena, 160, 500);
    check('alcove: the AI ARRIVES at the player behind a sealed straight approach',
      r.best < 30, `closest ${r.best.toFixed(0)}wu, ended at (${r.x.toFixed(0)},${r.y.toFixed(0)})`);
    check('alcove: it never ends a tick inside cover', r.insideCover === 0, `${r.insideCover} ticks inside`);
  }

  // ── (b) A concave pocket with its MOUTH FACING AWAY from the approach. The back wall
  // faces the enemy, so every route in first travels further from the target than the wall
  // it is standing on, for longer than in (a). Verified discriminating: against the tree as
  // committed before this layer landed, the AI stops on the back wall 241 wu out.
  //
  // Nothing this shape exists in `kitchen.ts` today. It is here so an arena that grows one
  // is covered before it ships — and because a fixture copied from the real arena would
  // stop testing the algorithm the moment the arena peer moves the furniture.
  const U_POCKET = [
    { x: 700, y: 500, w: 40, h: 400 },   // back wall, on the side the enemy comes from
    { x: 540, y: 320, w: 360, h: 40 },   // top arm, reaching west
    { x: 540, y: 680, w: 360, h: 40 },   // bottom arm
  ];
  {
    const arena = makeArena({ width: 1400, height: 1000, maxSafeRadius: NAV_SAFE_RADIUS, cover: U_POCKET });
    arena.enemySpawn = { x: 1240, y: 500 };
    const r = chase(arena, 500, 500);
    check('U-pocket with its mouth facing away: the AI still gets in',
      r.best < 30, `closest ${r.best.toFixed(0)}wu, ended at (${r.x.toFixed(0)},${r.y.toFixed(0)})`);
    check('U-pocket: it never ends a tick inside cover', r.insideCover === 0, `${r.insideCover} ticks inside`);
  }

  // ── (c) Degrade, do not break. A target sealed inside a box NOTHING can enter must not
  // send the AI back to pressing on the nearest wall: it should route to the closest point
  // the map allows and fight from there. The shipped kitchen really has two such pockets —
  // 114x63 wu each, 1.9% of all legal standing space, sealed by two prep counters and two
  // supply barrels — so this is a real shape, not a hypothetical.
  //
  // Nested inside the U above, so reaching even the nearest approach point requires
  // routing: it is the compound case, and the plain "give up and go greedy" answer fails it.
  {
    const arena = makeArena({
      width: 1400, height: 1000, maxSafeRadius: NAV_SAFE_RADIUS,
      cover: [
        ...U_POCKET,
        { x: 500, y: 430, w: 180, h: 40 },
        { x: 500, y: 570, w: 180, h: 40 },
        { x: 430, y: 500, w: 40, h: 180 },
        { x: 570, y: 500, w: 40, h: 180 },
      ],
    });
    arena.enemySpawn = { x: 1240, y: 500 };
    // The four inner boxes leave a 58x58 wu island of legal centres around (500,500) with
    // no way in; the nearest legal standing point outside is 112 wu due north, inside a
    // donut's 153 wu reach. So "as close as the map allows" is also "in range".
    const r = chase(arena, 500, 500);
    check('sealed target: the AI routes to it and closes to within weapon reach',
      r.best <= 153, `closest ${r.best.toFixed(0)}wu`);
    check('sealed target: it does not clip into the box', r.insideCover === 0, `${r.insideCover} ticks inside`);
  }

  // ── (d) An open field must still be walked STRAIGHT. A router that is 100% reliable and
  // takes scenic routes is a different bug, and this is the cheapest way to catch it.
  {
    const arena = makeArena({ width: 1400, height: 1000, cover: [] });
    const state = playingMatch(arena, 'hamburger', 'donut');
    state.player.x = 200; state.player.y = 500;
    state.player.hp = 1e9; state.player.maxHp = 1e9;
    state.enemy.x = 1200; state.enemy.y = 500;
    let maxDrift = 0;
    for (let i = 0; i < 300; i++) {
      state.player.x = 200; state.player.y = 500;
      state.enemy.lastUsed = state.enemy.lastUsed.map(() => state.elapsed);
      stepMatch(state, 16.667, noInput);
      maxDrift = Math.max(maxDrift, Math.abs(state.enemy.y - 500));
    }
    // 247 wu before the descent broke ties on Euclidean distance: an 8-connected BFS has a
    // Chebyshev metric, whose level sets are plateaus a naive descent walks diagonally.
    check('open ground: the route is a straight line (lateral drift under one body width)',
      maxDrift < PLAYER_SIZE, `max drift ${maxDrift.toFixed(1)}wu`);
    check('open ground: it actually closed the distance', state.enemy.x < 1200 - 200, `x=${state.enemy.x.toFixed(0)}`);
  }
}

// ─────────────────────────────────────────────────────────────────────────────
// 15. DEPENETRATION — a fighter inside cover must get out, not freeze (regression)
//
// `tryMove` tests the DESTINATION for overlap and never tests where the fighter already
// is, so a fighter that ends up inside a box was frozen permanently and silently on BOTH
// axes: every step from inside also overlaps, so every step is refused, with no event and
// no error. Unreachable by a player today (spawns are clear, knockback is visual-only) and
// reachable the moment anyone lands sim knockback, a dash, a pull, or a prop over a spawn.
//
// The numbers below are the real repro found by the input agent, not an invention:
// `?px=850&py=500` puts a 42 wu fighter 25 wu from the centre of `spice_cart`
// (875,500,50,50), and 25 < (42+50)/2 = 46.
// ─────────────────────────────────────────────────────────────────────────────
{
  console.log('\n15. A fighter buried inside cover escapes instead of freezing');

  // Both are the SHIPPED boxes, copied exactly, because the repro coordinates below are
  // only meaningful against the real extents.
  const SPICE_CART = { x: 875, y: 500, w: 50, h: 50 };
  const SUPPLY_BARREL = { x: 940, y: 500, w: 48, h: 46 };

  function buried(px, py, move = { x: 0, y: 0 }, ticks = 1, box = SPICE_CART) {
    const arena = makeArena({ width: 1400, height: 1000, cover: [box] });
    const state = playingMatch(arena);
    state.player.x = px; state.player.y = py;
    state.enemy.x = 100; state.enemy.y = 100;       // out of the way
    for (let i = 0; i < ticks; i++) stepMatch(state, 16.667, { move, selectedWeapon: 0, attack: false });
    const overlapping = Math.abs(state.player.x - box.x) < (PLAYER_SIZE + box.w) / 2 &&
      Math.abs(state.player.y - box.y) < (PLAYER_SIZE + box.h) / 2;
    return { x: state.player.x, y: state.player.y, overlapping };
  }

  {
    // The exact documented case. Half-sums are 46 on both axes, so at (850,500) the
    // penetration is 46-25 = 21 wu on x against 46-0 = 46 wu on y: the way out is -x.
    const r = buried(850, 500, { x: -1, y: 0 });
    check('buried at the documented ?px=850&py=500: no longer overlapping after one tick',
      !r.overlapping, `ended at (${r.x.toFixed(1)},${r.y.toFixed(1)})`);
    check('...pushed out along the axis of LEAST penetration (21wu on x vs 46wu on y)',
      approx(r.y, 500) && r.x < 850, `(${r.x.toFixed(1)},${r.y.toFixed(1)})`);
  }
  {
    // And once out, the controls work again — which is the actual symptom that was reported.
    const r = buried(850, 500, { x: -1, y: 0 }, 30);
    check('a buried fighter can move again afterwards', r.x < 800 && !r.overlapping, `x=${r.x.toFixed(1)}`);
  }
  {
    // Dead centre of a box that is WIDER than it is tall: half-sums 45 on x and 44 on y, so
    // the shallower axis is y and the escape must be vertical even though the fighter is
    // walking horizontally. This is the assertion that would catch an axis mix-up; the
    // square spice cart above cannot, because at its centre the two axes tie.
    const r = buried(940, 500, { x: 1, y: 0 }, 1, SUPPLY_BARREL);
    check('buried dead centre: escapes along the shallower axis (y), not the way it is walking',
      !r.overlapping && Math.abs(r.y - 500) > Math.abs(r.x - 940), `(${r.x.toFixed(1)},${r.y.toFixed(1)})`);
  }
  {
    // THE DIAGNOSTIC THIS MUST NOT DESTROY. `?px=`/`?py=` deliberately does not validate
    // against cover, and an arena agent used exactly that to park a fighter inside the pot
    // and photograph it — which is how "a fighter inside the pot is 0.0% visible" was
    // proven. Escaping is therefore gated on the fighter TRYING to move: parked and left
    // alone, it stays precisely where it was put, and the camera still sees what it was
    // pointed at.
    const r = buried(850, 500, { x: 0, y: 0 }, 120);
    check('a fighter PARKED inside cover and given no input stays put (QA photography)',
      r.x === 850 && r.y === 500 && r.overlapping, `(${r.x},${r.y}) overlapping=${r.overlapping}`);
  }
  {
    // The invariant that matters more than any of the above: a fighter walking in the open
    // must not be nudged sideways by so much as a float. Depenetration runs on every
    // `tryMove` with input, so a bug here would make the whole game drift.
    const r = buried(400, 400, { x: 1, y: 0 }, 60);
    check('a fighter moving in the OPEN gains no lateral drift at all',
      r.y === 400 && r.x > 400, `(${r.x},${r.y})`);
  }
  {
    // Standing legally against the box's face must not be disturbed either, INCLUDING while
    // pushing into it: the collision test is strict `<`, so exactly at the boundary is not
    // an overlap and there is nothing to resolve.
    const edgeX = SPICE_CART.x - (PLAYER_SIZE + SPICE_CART.w) / 2;   // 829
    const r = buried(edgeX, 500, { x: 1, y: 0 }, 10);
    check('a fighter pressed exactly on the collision boundary is not pushed off it',
      r.x === edgeX && r.y === 500, `(${r.x},${r.y}) expected (${edgeX},500)`);
  }
}

// ─────────────────────────────────────────────────────────────────────────────
// 16. RANGED FACING AT ZERO SEPARATION (regression)
//
// The melee half of this was made a rule in section 13. The ranged half was still an
// accident: `ai.ts` derived facing as `{x: adx/adist, y: ady/adist}` with
// `adist = hypot(0,0) || 1`, which is the ZERO VECTOR, and `combat.ts:spawnProjectile`
// turns that into a heading with `Math.atan2(0, 0)` — exactly 0, so a cornered AI's shot
// flew DUE EAST. The rule now matches `sim.ts:applyAim`'s treatment of the player: a
// zero-length aim leaves the previous facing untouched.
// ─────────────────────────────────────────────────────────────────────────────
{
  console.log('\n16. Ranged AI facing is well-defined at zero separation');

  /**
   * Coincident fighters, AI pre-pointed somewhere unambiguous, one tick of AI ONLY.
   *
   * `stepAI` rather than `stepMatch` deliberately: at exactly zero separation a projectile
   * is inside its target's hit radius the instant it spawns, so `stepProjectiles` — which
   * runs later in the same `stepMatch` tick — resolves and deletes it before any assertion
   * can read its velocity. Driving `ai.ts` directly is the only way to observe the heading
   * the AI actually chose, which is the quantity under test. (It also makes the point that
   * the DAMAGE at zero separation was never the bug: the shot connects whichever way it is
   * pointed. What flew due east was the thing the player watches.)
   */
  function coincidentAI(facing) {
    const arena = makeArena({ width: 2000, height: 2000 });
    const state = playingMatch(arena, 'hamburger', 'taco');   // taco: all three weapons ranged
    state.player.x = 900; state.player.y = 900;
    state.enemy.x = 900; state.enemy.y = 900;
    state.enemy.facing = { x: facing.x, y: facing.y };
    const events = [];
    stepAI(state, state.enemy, 16.667, events);
    return { state, events };
  }

  {
    const { state } = coincidentAI({ x: 0, y: -1 });
    check('coincident: the AI keeps its previous facing rather than adopting (0,0)',
      state.enemy.facing.x === 0 && state.enemy.facing.y === -1,
      JSON.stringify(state.enemy.facing));
  }
  {
    const { state } = coincidentAI({ x: -1, y: 0 });
    check('coincident: facing is preserved whichever way it pointed',
      state.enemy.facing.x === -1 && state.enemy.facing.y === 0,
      JSON.stringify(state.enemy.facing));
  }
  {
    // The bug, stated as the thing a player would see: a projectile leaving due east
    // regardless of where the shooter was pointing.
    const { state, events } = coincidentAI({ x: 0, y: -1 });
    const shots = state.projectiles;
    check('coincident: the AI still fires', events.some((e) => e.type === 'weapon-fired'),
      JSON.stringify(events.map((e) => e.type)));
    check('coincident: a projectile is actually spawned', shots.length > 0, `${shots.length} projectiles`);
    const dueEast = shots.filter((p) => p.vx > 0 && Math.abs(p.vy) < 1e-9);
    check('coincident: no shot flies DUE EAST by atan2(0,0) accident', dueEast.length === 0,
      shots.map((p) => `(${p.vx.toFixed(1)},${p.vy.toFixed(1)})`).join(' '));
    check('coincident: every shot flies along the facing that was actually held',
      shots.length > 0 && shots.every((p) => p.vy < 0),
      shots.map((p) => `(${p.vx.toFixed(1)},${p.vy.toFixed(1)})`).join(' '));
  }
  {
    // End to end, through the real `stepMatch`: the shot still LANDS. The rule change must
    // not quietly make a cornered AI harmless.
    const arena = makeArena({ width: 2000, height: 2000 });
    const state = playingMatch(arena, 'hamburger', 'taco');
    state.player.x = 900; state.player.y = 900;
    state.enemy.x = 900; state.enemy.y = 900;
    state.enemy.facing = { x: 0, y: -1 };
    const events = stepMatch(state, 16.667, noInput);
    check('coincident: the shot still lands on the player through the full step',
      events.some((e) => e.type === 'hit-landed' && e.targetRole === 'player'),
      JSON.stringify(events.map((e) => e.type)));
  }
  {
    // Continuity: a real bearing still overrides the old facing, immediately.
    const arena = makeArena({ width: 2000, height: 2000 });
    const state = playingMatch(arena, 'hamburger', 'taco');
    state.player.x = 900; state.player.y = 700;
    state.enemy.x = 900; state.enemy.y = 900;
    state.enemy.facing = { x: 1, y: 0 };
    stepMatch(state, 16.667, noInput);
    check('a real separation still re-points the AI at the player',
      approx(state.enemy.facing.x, 0) && approx(state.enemy.facing.y, -1),
      JSON.stringify(state.enemy.facing));
  }
  {
    // ⚠️ CHANGED ON PURPOSE, 2026-08-05, and stated rather than deleted.
    //
    // This used to assert "a stunned AI does not re-point at all", which was never a
    // rule — it was a side effect of `ai.ts` gating the facing on `aiFrozen` along with
    // everything else, and it is exactly the asymmetry §20(a) removes. The rule is that
    // AIM IS NOT MOVEMENT: `sim.ts:applyAim` re-points a stunned PLAYER every tick and
    // only `speed` goes to 0, so a stunned enemy re-points too. What still holds, and is
    // what section 16 is actually about, is the ZERO-SEPARATION rule below it — the
    // absence of a bearing is what preserves a facing, not the presence of a stun.
    const arena = makeArena({ width: 2000, height: 2000 });
    const state = playingMatch(arena, 'hamburger', 'taco');
    state.player.x = 900; state.player.y = 700;
    state.enemy.x = 900; state.enemy.y = 900;
    state.enemy.facing = { x: 1, y: 0 };
    state.enemy.status.stunnedUntil = state.elapsed + 5000;
    stepMatch(state, 16.667, noInput);
    check('a stunned AI re-points at the player, exactly as a stunned player re-aims',
      approx(state.enemy.facing.x, 0) && approx(state.enemy.facing.y, -1),
      JSON.stringify(state.enemy.facing));
  }
  {
    // …and the zero-separation rule outranks it: coincident AND stunned still keeps the
    // facing it held, because there is no bearing to adopt.
    const arena = makeArena({ width: 2000, height: 2000 });
    const state = playingMatch(arena, 'hamburger', 'taco');
    state.player.x = 900; state.player.y = 900;
    state.enemy.x = 900; state.enemy.y = 900;
    state.enemy.facing = { x: 1, y: 0 };
    state.enemy.status.stunnedUntil = state.elapsed + 5000;
    stepAI(state, state.enemy, 16.667, []);
    check('coincident AND stunned: still no bearing, so still no re-point',
      state.enemy.facing.x === 1 && state.enemy.facing.y === 0,
      JSON.stringify(state.enemy.facing));
  }
}

// ─────────────────────────────────────────────────────────────────────────────
// 17. OUT-OF-COMBAT REGEN CAN ACTUALLY FIRE (regression)
//
// `REGEN_DELAY_MS` was 10_000, transcribed against the prototype's 180 s clock and
// never re-checked against a FIGHT. Measured on the real sim across 11,000 matches at
// the shipped 45 s clock (`tools/tmp/rules_census.mjs`, 110 matchups x 25 seeds x 4
// scripted policies): out-of-combat regen fired for 1.9% of fighters under `smart`,
// 0.1% under `chase` and 0 of 5,500 under `idle` — 0.053 ticks and 0.11 HP per fighter
// per match. The mechanic, its `heal` event, and the throttled rising triad
// `audio/director.ts` plays for it were all DEAD CONTENT: nothing was broken, the
// trigger was simply unreachable, because a 10 s stretch without taking a hit does not
// exist inside a fight whose ENGAGED portion averages 6.0 s.
//
// The guard below is an OUTCOME test, not a threshold on the constant (docs/LESSONS.md
// §13 — prefer a metric that asks whether the thing ever happens over one that asks
// about a symptom). It runs whole matches with a hit-and-run player — the exact
// behaviour out-of-combat regen exists to reward — and requires regen to actually
// deliver HP. Measured on THIS fixture, by staged sweep:
//
//   REGEN_DELAY_MS   10 s   8 s   6 s   5 s   4 s   3 s
//   fighters healed   0/22  1/22  4/22  7/22  9/22  15/22
//
// so the assertion below (>= 3 of 22) fails at every value from 8 s up and passes at
// the shipped 4 s with 3x margin. The fixture is deliberately synthetic — it must keep
// testing the RULE after the arena peer moves the furniture (same reasoning as §14).
// ─────────────────────────────────────────────────────────────────────────────
{
  console.log(`\n17. Out-of-combat regen fires, and is reachable inside a real match (delay ${REGEN_DELAY_MS}ms)`);

  const regenArena = makeArena({
    width: 1400, height: 1000, maxSafeRadius: 993,
    cover: [
      { x: 500, y: 500, w: 180, h: 60 },
      { x: 900, y: 500, w: 180, h: 60 },
      { x: 700, y: 260, w: 60, h: 180 },
      { x: 700, y: 740, w: 60, h: 180 },
    ],
  });

  // ── (a) the mechanism, with the enemy neutralised ─────────────────────────
  //
  // Pinned in the far corner and permanently on cooldown, so the ONLY thing that can
  // move the player's HP is regen. The player sits on the arena centre, which the ring
  // never reaches (`MIN_SAFE_RADIUS`), so the fog cannot contribute either.
  {
    function tickIsolated(state) {
      state.enemy.x = 1350; state.enemy.y = 950;
      state.enemy.lastUsed = state.enemy.lastUsed.map(() => state.elapsed);
      return stepMatch(state, 16.667, noInput);
    }

    const state = playingMatch(regenArena);
    state.player.x = 700; state.player.y = 620;
    state.player.hp = 60;
    state.player.lastDamagedAt = state.elapsed;
    const t0 = state.elapsed;

    let earlyHeals = 0;
    while (state.elapsed - t0 < REGEN_DELAY_MS - 50) {
      for (const ev of tickIsolated(state)) if (ev.type === 'heal') earlyHeals++;
    }
    check(`no regen inside REGEN_DELAY_MS (${REGEN_DELAY_MS}ms since the last hit)`,
      earlyHeals === 0 && state.player.hp === 60, `heals=${earlyHeals} hp=${state.player.hp}`);

    let firstHealAt = null;
    let firstAmount = null;
    while (firstHealAt === null && state.elapsed - t0 < REGEN_DELAY_MS + 6 * REGEN_TICK_MS) {
      for (const ev of tickIsolated(state)) {
        if (ev.type === 'heal' && firstHealAt === null) { firstHealAt = state.elapsed - t0; firstAmount = ev.amount; }
      }
    }
    check('regen starts one REGEN_TICK_MS after the delay elapses',
      firstHealAt !== null && firstHealAt >= REGEN_DELAY_MS
        && firstHealAt <= REGEN_DELAY_MS + REGEN_TICK_MS + 17,
      `first heal at +${firstHealAt === null ? 'never' : Math.round(firstHealAt)}ms, expected ~${REGEN_DELAY_MS + REGEN_TICK_MS}ms`);
    check(`one regen tick heals REGEN_AMOUNT (${REGEN_AMOUNT})`, firstAmount === REGEN_AMOUNT, `amount=${firstAmount}`);

    // Rate: REGEN_AMOUNT per REGEN_TICK_MS, i.e. 10 HP/s. Allow one tick of slack for
    // where the 16.667ms step lands relative to the 200ms accumulator.
    const hpBefore = state.player.hp;
    const tRate = state.elapsed;
    while (state.elapsed - tRate < 1000) tickIsolated(state);
    const perSecond = state.player.hp - hpBefore;
    const expected = REGEN_AMOUNT * (1000 / REGEN_TICK_MS);
    check(`regen rate is REGEN_AMOUNT/REGEN_TICK_MS (${expected} HP/s)`,
      Math.abs(perSecond - expected) <= REGEN_AMOUNT, `${perSecond} HP in 1s, expected ${expected}`);

    // Any damage restarts the clock — the property that makes this "out of combat"
    // rather than "a passive trickle".
    const events = [];
    applyDamage(state, state.player, 5, null, { kind: 'fog' }, events);
    let healsAfterHit = 0;
    const tHit = state.elapsed;
    while (state.elapsed - tHit < REGEN_DELAY_MS - 50) {
      for (const ev of tickIsolated(state)) if (ev.type === 'heal') healsAfterHit++;
    }
    check('taking damage restarts the out-of-combat delay', healsAfterHit === 0, `heals=${healsAfterHit}`);
  }

  // ── (b) the outcome guard: does it EVER fire in a real match? ──────────────
  {
    /** Close while healthy, break contact while hurt. Deterministic; no RNG anywhere. */
    function hitAndRun() {
      return (st) => {
        const p = st.player, e = st.enemy;
        const d = Math.hypot(p.x - e.x, p.y - e.y) || 1;
        const ws = CHARACTERS[p.characterId].weapons;
        let slot = null;
        let bestDmg = -Infinity;
        ws.forEach((w, i) => {
          if (w.type === 'self') return;
          if (st.elapsed - p.lastUsed[i] < w.cooldown) return;
          if (d > (w.range ?? Infinity)) return;
          if ((w.damage ?? 0) > bestDmg) { bestDmg = w.damage ?? 0; slot = i; }
        });
        const hurt = p.hp < p.maxHp * 0.7;
        const sgn = hurt ? -1 : 1;
        const q = (v) => (v > 0.35 ? 1 : v < -0.35 ? -1 : 0);
        return {
          move: { x: q((sgn * (e.x - p.x)) / d), y: q((sgn * (e.y - p.y)) / d) },
          aim: { x: e.x - p.x, y: e.y - p.y },
          selectedWeapon: slot ?? 0,
          attack: slot !== null && !hurt,
        };
      };
    }

    let healedFighters = 0;
    let totalFighters = 0;
    let hpFromRegen = 0;
    for (const id of CHARACTER_IDS) {
      const state = createMatch(regenArena, id, 'donut');
      const act = hitAndRun();
      const got = { player: 0, enemy: 0 };
      let since = Infinity;
      let input = noInput;
      while (state.phase !== 'ended' && state.elapsed < MATCH_DURATION_MS + 6000) {
        if (since >= 150) { input = act(state); since = 0; }
        const evs = stepMatch(state, 16.667, input);
        since += 16.667;
        for (const ev of evs) {
          if (ev.type !== 'heal' || ev.amount > REGEN_AMOUNT) continue;
          // A `self` weapon (Hamburger's 25 HP Onion Ring) also emits `heal`; only the
          // ticks NOT accompanied by a self-weapon fire are regen.
          const selfFired = evs.some((x) => x.type === 'weapon-fired' && x.fighterRole === ev.fighterRole
            && CHARACTERS[state[ev.fighterRole].characterId].weapons.find((w) => w.key === x.weaponKey)?.type === 'self');
          if (!selfFired) got[ev.fighterRole] += ev.amount;
        }
      }
      for (const role of ['player', 'enemy']) {
        totalFighters++;
        if (got[role] > 0) healedFighters++;
        hpFromRegen += got[role];
      }
    }
    check('out-of-combat regen reaches a hit-and-run fighter in a real match',
      healedFighters >= 3,
      `${healedFighters}/${totalFighters} fighters regenerated (${hpFromRegen} HP) — 0/22 is what a 10s delay produced`);
  }

  // ── (c) the relationships that keep the two ground hazards reachable ───────
  //
  // Both were found DEAD-in-effect by the same audit and neither is fixed here, but a
  // relationship that is currently TRUE and load-bearing should not be allowed to
  // silently stop being true.
  {
    // The pot is registered as a SOLID CoverBox of `POT.bodyRadius * 2` by
    // `arena/hazards.ts`, so `movement.ts:tryMove` refuses any destination whose 42wu
    // body overlaps it. A fighter's CENTRE can therefore never be closer than
    // bodyRadius + PLAYER_SIZE/2 — and if that exceeds `dangerRadius` the hazard cannot
    // burn anybody at all, from any bearing. Measured today: only 26.2% of the burn
    // disc is standable, and a 45-degree approach never burns.
    check('the boiling pot has a standable burn band at all (dangerRadius > bodyRadius + half a body)',
      POT.dangerRadius > POT.bodyRadius + PLAYER_SIZE / 2,
      `dangerRadius ${POT.dangerRadius} <= ${POT.bodyRadius + PLAYER_SIZE / 2}`);

    // And the ring floor caps how big that band may grow: section 11 already asserts
    // MIN_SAFE_RADIUS >= dangerRadius + PLAYER_SIZE/2, so the two together pin
    // dangerRadius into a window. Record the window so a change to either end is
    // visibly a change to both.
    check('the pot burn band fits between the fighter body and the ring floor',
      POT.bodyRadius + PLAYER_SIZE / 2 < POT.dangerRadius && POT.dangerRadius <= MIN_SAFE_RADIUS - PLAYER_SIZE / 2,
      `${POT.bodyRadius + PLAYER_SIZE / 2} < ${POT.dangerRadius} <= ${MIN_SAFE_RADIUS - PLAYER_SIZE / 2}`);
  }

  // ── (d) the STATUS LOCK is now BOUNDED, not merely ratcheted ──────────────
  //
  // A weapon whose COOLDOWN is shorter than the status it applies used to hold that
  // status up by itself, forever. 4 of 5 stun weapons and 8 of 10 slow weapons still
  // have that cooldown relationship and always will — Pizza's Cheese Blind re-fires
  // every 1300 ms against a 2000 ms stun, Hamburger's Tomato Toss every 800 ms against a
  // 2500 ms slow — and the measured consequence was an unbroken movement lock of 11.02 s
  // against a 6.0 s mean engagement, 65.7% of stun applications landing on an
  // already-stunned target, and 47 of 110 matchups producing >= 4 s.
  //
  // What changed on 2026-08-05 is the RE-APPLICATION RULE (`rules.ts` DEVIATION #5), not
  // the durations and not the cooldowns. This section previously RATCHETED the locker
  // count, which was the right guard while the defect was open and is the wrong one now:
  // a ratchet is satisfied by the defect staying exactly the size it always was. What
  // follows asserts the property that makes those cooldowns harmless.
  {
    // The ratchet is KEPT and TIGHTENED — `<=` to `==`. It no longer needs headroom,
    // because the counts can no longer produce a lock; it now simply records the shape of
    // the roster so a new weapon inside the window is still visible.
    const lockers = { stun: 0, slow: 0 };
    const totals = { stun: 0, slow: 0 };
    for (const id of CHARACTER_IDS) {
      for (const w of CHARACTERS[id].weapons) {
        if (w.effect !== 'stun' && w.effect !== 'slow') continue;
        totals[w.effect]++;
        const duration = w.effect === 'stun' ? STUN_DURATION_MS : SLOW_DURATION_MS;
        if (w.cooldown < duration) lockers[w.effect]++;
      }
    }
    check('the roster still has exactly the 4-of-5 stun and 8-of-10 slow cooldown overlaps (ratchet tightened <= to ==)',
      lockers.stun === 4 && lockers.slow === 8,
      `${lockers.stun}/${totals.stun} stun, ${lockers.slow}/${totals.slow} slow re-fire inside their own effect`);

    // (i) THE BOUND. Spam the effect every single tick for ten times its own duration and
    // measure the longest UNBROKEN run. It must be one application, because a status is
    // refused while it is live. This is the assertion the old ratchet could not make.
    for (const effect of ['stun', 'slow']) {
      const duration = effect === 'stun' ? STUN_DURATION_MS : SLOW_DURATION_MS;
      const state = playingMatch(makeArena());
      const src = { kind: 'weapon', weaponKey: 'T', weaponName: 'test' };
      const DT = 16.667;
      let run = 0, longest = 0, applications = 0, refused = 0;
      for (let t = 0; t < 20_000; t += DT) {
        state.elapsed = t;
        state.player.hp = PLAYER_MAX_HP; // isolate the status from the kill
        const key = effect === 'stun' ? 'stunnedUntil' : 'slowedUntil';
        const before = state.player.status[key];
        applyDamage(state, state.player, 0, effect, src, []);
        if (state.player.status[key] > before) applications++; else refused++;
        if (t < state.player.status[key]) { run += DT; if (run > longest) longest = run; } else run = 0;
      }
      check(`spamming ${effect} every tick for 20 s never exceeds one ${duration}ms application`,
        longest <= duration + DT + 1e-6,
        `longest unbroken ${effect} ${longest.toFixed(0)}ms vs ${duration}ms (11,020ms was measured on the real sim)`);
      check(`spamming ${effect} every tick REFUSES the re-application rather than extending it`,
        refused > applications * 50,
        `${applications} landed, ${refused} refused over 20 s`);
    }

    // (ii) THE WINDOW. After it expires there is a grace before the same effect can land
    // again, and it is the grace the sim itself uses — `combat.ts` exports `statusReadyAt`
    // precisely so this is not a second copy of the arithmetic.
    {
      const state = playingMatch(makeArena());
      const src = { kind: 'weapon', weaponKey: 'T', weaponName: 'test' };
      state.elapsed = 1000;
      applyDamage(state, state.player, 0, 'stun', src, []);
      check('a stun sets a ready-at of duration + grace',
        approx(statusReadyAt(state.player, 'stun'), 1000 + STUN_DURATION_MS + STUN_GRACE_MS),
        `${statusReadyAt(state.player, 'stun')} vs ${1000 + STUN_DURATION_MS + STUN_GRACE_MS}`);

      // One tick before the grace ends: refused — AND the fighter is already free to move,
      // so this really is a shrug-off window and not a longer stun wearing a new name.
      state.elapsed = 1000 + STUN_DURATION_MS + STUN_GRACE_MS - 1;
      const held = state.player.status.stunnedUntil;
      applyDamage(state, state.player, 0, 'stun', src, []);
      check('inside the grace window a fresh stun is refused',
        state.player.status.stunnedUntil === held, `${state.player.status.stunnedUntil} vs ${held}`);
      check('and the fighter is NOT stunned during that window',
        state.elapsed >= state.player.status.stunnedUntil,
        `elapsed ${state.elapsed} < stunnedUntil ${state.player.status.stunnedUntil}`);

      // Exactly when the grace ends it lands again, at full duration. Capped, not deleted.
      state.elapsed = 1000 + STUN_DURATION_MS + STUN_GRACE_MS;
      applyDamage(state, state.player, 0, 'stun', src, []);
      check('once the grace ends the stun lands again at full duration',
        approx(state.player.status.stunnedUntil, state.elapsed + STUN_DURATION_MS));
    }

    // Slow gets the same window, and the two are independent of each other — a slow must
    // never consume a stun's grace or vice versa.
    {
      const state = playingMatch(makeArena());
      const src = { kind: 'weapon', weaponKey: 'T', weaponName: 'test' };
      state.elapsed = 0;
      applyDamage(state, state.player, 0, 'slow', src, []);
      check('a slow sets a ready-at of duration + grace',
        approx(statusReadyAt(state.player, 'slow'), SLOW_DURATION_MS + SLOW_GRACE_MS));
      applyDamage(state, state.player, 0, 'stun', src, []);
      check('a stun still lands on an already-slowed fighter (the two graces are independent)',
        approx(state.player.status.stunnedUntil, STUN_DURATION_MS));
    }

    // (iii) DAMAGE IS NOT RATE-LIMITED. Only the status is refused: a hit whose status is
    // blocked still costs full HP and still emits `hit-landed` carrying the weapon's
    // authored effect. `vfx.ts` reads the TARGET's timers for the stun ring, so a refused
    // stun correctly draws nothing without that layer knowing this rule exists.
    {
      const state = playingMatch(makeArena());
      const src = { kind: 'weapon', weaponKey: 'T', weaponName: 'test' };
      state.elapsed = 0;
      const events = [];
      applyDamage(state, state.player, 10, 'stun', src, events);
      applyDamage(state, state.player, 10, 'stun', src, events); // status refused, damage not
      // Against the fighter's OWN pool: per-character health (rules.ts DEVIATION #10)
      // means `PLAYER_MAX_HP` is the role BASE, not any particular fighter's maximum.
      // The rule under test is "full damage", which is a statement about the delta.
      check('a hit whose status is refused still deals its full damage',
        state.player.hp === maxHpFor(state.player.characterId, PLAYER_MAX_HP) - 20, `hp ${state.player.hp}`);
      check("and still emits hit-landed carrying the weapon's authored effect",
        events.length === 2 && events.every((e) => e.type === 'hit-landed' && e.effect === 'stun'),
        JSON.stringify(events.map((e) => `${e.type}:${e.effect}`)));
    }
  }
}

// ─────────────────────────────────────────────────────────────────────────────
// 18. THE AI CAN SEE HAZARDS, AND CAN HEAL
//
// Two measured blind spots, both fixed on 2026-08-05 (`rules.ts` DEVIATIONS #6 and #7):
//
//   * `ai.ts` had no ring term and no hazard term. Measured on the shipped layout with a
//     scripted player that engages: 94.8% of all pot damage and 100% of all fog damage
//     landed on the ENEMY, which died to the zone in 16.3% of matches against the
//     player's 0.0%. The scripted player has explicit "leave the pot" and "stay inside
//     the ring" clauses; the AI had neither, so this was a one-sided handicap and it grew
//     when the arena pass revived the pot (0.0% -> 8.7% of all damage).
//   * `pickHighestDamageWeapon` skipped `type === 'self'` and `pickSniperWeapon` required
//     `'ranged'`, so an enemy Hamburger could never use the roster's only `self` weapon,
//     which the human player uses on the same character. 0 fires / 17,677 ticks.
//
// Behaviour tests against the real `stepAI`, not shape tests: each one puts the AI
// somewhere specific and asserts where it ends up.
// ─────────────────────────────────────────────────────────────────────────────
{
  console.log('\n18. The AI avoids damaging ground and heals itself');

  const POT_HAZARD = {
    x: 700, y: 500, radius: POT.dangerRadius, kind: 'damage', damage: POT.damage, tickMs: POT.tickMs,
  };
  /** Big enough that the closing ring never bites inside these runs. */
  const OPEN_RING = 20_000;

  // ── (a) THE POT. Park the AI just outside the burn ring with the player directly
  // opposite, so the straight line to the player runs through the fire. Two things must
  // both be true, and only asserting the first would hide a worse bug than the one being
  // fixed: it must not walk in, AND it must still get there. A purely radial repulsion
  // cancels exactly against a head-on approach and leaves the AI oscillating on the spot
  // forever — see HAZARD_TANGENT in `ai.ts`.
  {
    const arena = makeArena({ width: 1400, height: 1000, maxSafeRadius: OPEN_RING, hazards: [POT_HAZARD] });
    const state = playingMatch(arena, 'hamburger', 'donut');
    state.player.x = 700 - 400; state.player.y = 500;
    state.enemy.x = 700 + POT.dangerRadius + 30; state.enemy.y = 500;
    let insideBurn = 0;
    let closestToPot = Infinity;
    let closestToPlayer = Infinity;
    for (let i = 0; i < 1500; i++) {
      state.player.hp = 1e9; state.player.maxHp = 1e9;
      // Weapons parked on cooldown so the AI always chooses to MOVE — otherwise this
      // measures weapon range rather than steering.
      state.enemy.lastUsed = state.enemy.lastUsed.map(() => state.elapsed);
      state.elapsed += 16.667;
      stepAI(state, state.enemy, 16.667, []);
      closestToPot = Math.min(closestToPot, Math.hypot(state.enemy.x - 700, state.enemy.y - 500));
      closestToPlayer = Math.min(closestToPlayer, Math.hypot(state.enemy.x - state.player.x, state.enemy.y - state.player.y));
      if (Math.hypot(state.enemy.x - 700, state.enemy.y - 500) < POT.dangerRadius) insideBurn++;
    }
    check('the AI never enters the boiling pot to reach a player on the far side of it',
      insideBurn === 0, `${insideBurn} ticks inside the ${POT.dangerRadius}wu burn ring (closest ${closestToPot.toFixed(0)}wu)`);
    check('and it goes AROUND rather than stalling head-on against the repulsion',
      closestToPlayer < 60, `closest approach to the player ${closestToPlayer.toFixed(0)}wu`);
  }

  // ── (b) THE CLOSING RING. A fleeing AI used to run directly away from the player and
  // straight out of the safe disc — the flee vector had no ring term at all, which is
  // why the zone was ~11x more lethal to it than to the human. Put the player between
  // the AI and the arena centre, so "away from the player" IS "into the fog".
  {
    const arena = makeArena({ width: 1400, height: 1000, maxSafeRadius: 500 });
    const state = playingMatch(arena, 'hamburger', 'donut');
    state.player.x = 700 + 150; state.player.y = 500;
    state.enemy.x = 700 + 300; state.enemy.y = 500;
    state.enemy.hp = state.enemy.maxHp * (AI_FLEE_HP_FRACTION - 0.05); // below the flee threshold
    let outside = 0;
    let furthest = 0;
    for (let i = 0; i < 900; i++) {
      state.player.hp = 1e9; state.player.maxHp = 1e9;
      state.enemy.hp = Math.max(1, state.enemy.hp);
      state.elapsed += 16.667;
      stepAI(state, state.enemy, 16.667, []);
      const r = Math.hypot(state.enemy.x - 700, state.enemy.y - 500);
      furthest = Math.max(furthest, r);
      if (r > state.safeRadius) outside++;
    }
    check('a fleeing AI does not run itself out of the closing ring',
      outside === 0,
      `${outside} ticks outside; furthest ${furthest.toFixed(0)}wu of a ${state.safeRadius.toFixed(0)}wu ring`);
  }

  // ── (c) SURVIVING OUTRANKS SHOOTING, and ONLY at the boundary. `stepAI` fires OR
  // moves, never both, so an AI with a weapon ready simply stops moving — which is how it
  // stood inside the burn ring trading shots while the pot did 32 HP/s to it. The
  // override has to fire when it is actually burning and NOT while it is merely near the
  // fire: an earlier draft compared against the WEIGHTED danger instead of the normalised
  // encroachment, which silently pushed the no-shoot line 36 wu outside the burn ring.
  {
    const shootsAt = (offset) => {
      const arena = makeArena({ width: 1400, height: 1000, maxSafeRadius: OPEN_RING, hazards: [POT_HAZARD] });
      const state = playingMatch(arena, 'hamburger', 'donut');
      state.enemy.x = 700 + offset; state.enemy.y = 500;
      state.player.x = state.enemy.x + 40; state.player.y = 500; // point blank, always in range
      state.player.hp = 1e9; state.player.maxHp = 1e9;
      state.enemy.lastUsed = state.enemy.lastUsed.map(() => -1e9);
      const events = [];
      stepAI(state, state.enemy, 16.667, events);
      return events.some((e) => e.type === 'weapon-fired');
    };
    check('an AI standing INSIDE the fire moves instead of shooting',
      !shootsAt(POT.dangerRadius - 10), 'it fired while burning');
    check('an AI merely NEAR the fire still shoots (the warning band costs it no output)',
      shootsAt(POT.dangerRadius + AI_HAZARD_MARGIN * 0.5),
      `it refused to fire ${(AI_HAZARD_MARGIN * 0.5).toFixed(0)}wu clear of the burn ring`);
  }

  // ── (d) THE HEAL.
  {
    const heal = CHARACTERS.hamburger.weapons.find((w) => w.type === 'self');
    const firesAt = (hp) => {
      const arena = makeArena({ width: 1400, height: 1000, maxSafeRadius: OPEN_RING });
      const state = playingMatch(arena, 'donut', 'hamburger');
      state.enemy.hp = hp;
      state.enemy.x = 700; state.enemy.y = 500;
      state.player.x = 900; state.player.y = 500;
      state.enemy.lastUsed = state.enemy.lastUsed.map(() => -1e9);
      const events = [];
      stepAI(state, state.enemy, 16.667, events);
      return events.filter((e) => e.type === 'weapon-fired' && e.weaponKey === heal.key).length;
    };
    // ⚠️ AGAINST THE ENEMY FIGHTER'S OWN POOL. `rules.ts` states the rule as a FRACTION of
    // max HP, and per-character health (DEVIATION #10) means an enemy Hamburger's pool is
    // `maxHpFor('hamburger', ENEMY_MAX_HP)`, not `ENEMY_MAX_HP`. Reading the role base here
    // put the "hurt" probe ABOVE the character's own half-HP line and the check failed for
    // a reason that was not the behaviour under test.
    const POOL = maxHpFor('hamburger', ENEMY_MAX_HP);
    check('a hurt AI Hamburger uses its Onion Ring — it never could before',
      firesAt(POOL * AI_SELF_HEAL_HP_FRACTION - 1) === 1, `no self-weapon fire at half of ${POOL} HP`);
    check('a healthy AI Hamburger saves it rather than spending a 6 s cooldown for nothing',
      firesAt(POOL - 1) === 0, `it healed at ${POOL - 1}/${POOL}`);
    check('and it never overheals — it waits until the whole heal fits',
      firesAt(POOL - (heal.healAmount - 1)) === 0,
      `it healed ${heal.healAmount} HP into a ${heal.healAmount - 1} HP hole`);
  }

  // ── (e) INERT WHEN NOTHING IS WRONG. Away from every hazard and well inside the ring
  // the AI must behave exactly as it always has: this is a blind spot removed, not a new
  // personality, and a steering term that leaks into open ground is a balance change
  // nobody asked for.
  {
    const arena = makeArena({ width: 1400, height: 1000, maxSafeRadius: OPEN_RING });
    const state = playingMatch(arena, 'hamburger', 'donut');
    state.player.x = 400; state.player.y = 500;
    state.enemy.x = 1000; state.enemy.y = 500;
    let drift = 0;
    let closest = Infinity;
    for (let i = 0; i < 900; i++) {
      state.player.hp = 1e9; state.player.maxHp = 1e9;
      state.enemy.lastUsed = state.enemy.lastUsed.map(() => state.elapsed);
      state.elapsed += 16.667;
      stepAI(state, state.enemy, 16.667, []);
      drift = Math.max(drift, Math.abs(state.enemy.y - 500));
      closest = Math.min(closest, Math.hypot(state.enemy.x - 400, state.enemy.y - 500));
    }
    // 5 wu of lateral drift is the flow field's own grid resolution and is present on the
    // tree as it was BEFORE this change too (verified: both end at 860.03, 497.08 after
    // 2 s, bit-identical). The assertion is that the hazard term adds nothing to it.
    check('with no hazard in reach the AI still walks straight at the player and arrives',
      closest < 30 && drift < 5,
      `closest ${closest.toFixed(1)}wu, worst lateral drift ${drift.toFixed(2)}wu`);
  }
}


// ─────────────────────────────────────────────────────────────────────────────
// 19. THE ROSTER — a character that cannot fight is a defect, not spice
// ─────────────────────────────────────────────────────────────────────────────
//
// Nothing had ever measured the roster PER CHARACTER. Every instrument on this project
// reported the aggregate player win rate or a flat matchup map, and both of those are
// blind to the only question a roster has: is any character out of the game? Measured
// for the first time on 2026-08-05 (`tools/tmp/roster_table.mjs`, 3,520 matches per
// policy), the answer was yes, once, and by a mile — Lollipop, LAST of eleven in six
// independent measurements (two policies x three sims), in BOTH roles.
//
// What follows pins the two things that were actually wrong with it, and the ceiling
// that stops the repair from becoming this project's fourth undodgeable burst.
{
  const lolli = CHARACTERS.lollipop;
  const smash = lolli.weapons.find((w) => w.key === 'Smash');
  const giant = lolli.weapons.find((w) => w.key === 'Giant');

  /** Damage ONE press delivers. Pellets and combo parts are separate hit events, so the
   *  per-EVENT damage and the per-PRESS damage are different questions and the two
   *  assertions below need different ones. */
  const perPress = (w) => (w.comboParts
    ? w.comboParts.reduce((a, p) => a + p.damage, 0)
    : (w.damage ?? 0) * (w.pellets ?? 1) * (w.peckHits ?? 1));
  /** The largest damage a SINGLE hit event from this weapon can carry. */
  const perEvent = (w) => (w.comboParts ? Math.max(...w.comboParts.map((p) => p.damage)) : (w.damage ?? 0));

  // ── (a) A SPECIAL MUST BE THE BIGGEST PRESS ITS OWNER HAS ─────────────────
  //
  // Two weapons in the roster are flagged as specials rather than attacks — Lollipop's
  // `giantSlam` and Taco's `comboParts`. Taco's Double Toss obeyed this (23 against 12
  // and 7). Lollipop's Giant Lollipop did NOT: 10 damage against its own 11 damage
  // basic swing.
  //
  // That is not a small mistuning, because BOTH drivers pick a weapon the same way —
  // `ai.ts:pickHighestDamageWeapon` and the scripted player's `bestWeapon` each take the
  // highest `damage` that is off cooldown and in range. A special that is one point
  // weaker than the swing next to it is therefore NEVER CHOSEN inside melee range by
  // anybody: an 8 s cooldown ability whose whole design is "grows huge and hits the
  // whole map" was reduced to a long-range poke, and measured, cutting its cooldown
  // 8000 -> 5000 made Lollipop WORSE (strength 9.7% -> 8.1%), because more presses of a
  // below-par weapon is a worse rotation, not a better one.
  for (const id of CHARACTER_IDS) {
    const ws = CHARACTERS[id].weapons.filter((w) => w.type !== 'self');
    const specials = ws.filter((w) => w.giantSlam || w.comboParts);
    if (!specials.length) continue;
    const best = Math.max(...ws.map(perPress));
    for (const sp of specials) {
      check(`${id}'s special (${sp.name}) is the biggest press it has`,
        perPress(sp) >= best,
        `${sp.key} delivers ${perPress(sp)} against a kit maximum of ${best}`);
    }
  }

  // ── (b) THE UNDODGEABLE CEILING ───────────────────────────────────────────
  //
  // A `giantSlam` has `cone: 360` and resolves ON THE TICK IT IS CAST, from up to
  // `REACH.ultimateSlam` (400 wu) — 2.0x the radius `render/camera.ts` guarantees is on
  // screen. It cannot be dodged, aimed away from, or broken line of sight with; it can
  // only be explained afterwards, which `docs/DECISIONS-FOR-URI.md` §9 has already
  // parked for a human to judge.
  //
  // So its damage is capped by the largest hit the roster can produce that a player CAN
  // do something about. This project has now had to bound three separate undodgeable
  // bursts — the Sticky Trail's 87 HP in one tick, the 11.02 s status lock, and the
  // melee-at-zero-separation rule — and the cheapest place to stop the fourth is here.
  const dodgeableMax = Math.max(...CHARACTER_IDS.flatMap((id) =>
    CHARACTERS[id].weapons.filter((w) => w.type !== 'self' && !w.giantSlam).map(perEvent)));
  for (const id of CHARACTER_IDS) {
    for (const w of CHARACTERS[id].weapons) {
      if (!w.giantSlam) continue;
      check(`${id}'s undodgeable slam stays under the biggest DODGEABLE hit in the roster`,
        perEvent(w) <= dodgeableMax,
        `${w.name} ${perEvent(w)} vs dodgeable maximum ${dodgeableMax}`);
    }
  }

  // ── (c) THE MELEE-ONLY CHARACTER, AND WHY IT IS ALONE ─────────────────────
  //
  // Lollipop is the only fighter in the roster with no `ranged` weapon at all. That is a
  // legitimate archetype and it is NOT what this ratchet is guarding. What it guards is
  // the consequence: `ai.ts:pickSniperWeapon` — the ONLY weapon picker the flee branch
  // could reach — required `w.type === 'ranged'`, so an AI of a melee-only character
  // could not attack at all while fleeing (below AI_FLEE_HP_FRACTION of its pool).
  // Exactly the same shape as the `self`-weapon hole fixed in DEVIATION #7.
  //
  // ✅ CLOSED. `ai.ts` now has ONE selector whose `allow` is `Record<WeaponType, boolean>`,
  // so every call site names every category and `tsc` refuses a fourth. §20(c) asserts
  // the behaviour. This check stays because the ARCHETYPE is what made the hole visible:
  // if a second melee-only character ever arrives, the driver work it depends on should
  // be re-read rather than assumed.
  const meleeOnly = CHARACTER_IDS.filter((id) =>
    !CHARACTERS[id].weapons.some((w) => w.type === 'ranged'));
  check('exactly one character has no ranged weapon, and it is Lollipop',
    meleeOnly.length === 1 && meleeOnly[0] === 'lollipop',
    `melee-only: [${meleeOnly.join(', ')}] — every AI branch must be able to select a weapon for these`);

  // ── (d) …SO ITS SWING HAS TO BE THE BEST SWING ────────────────────────────
  //
  // Sustained output from a BASIC swing (melee, cooldown <= 1 s — the roster's
  // press-repeatedly band, as opposed to the 2.2-3.5 s heavy specials). Lollipop's was
  // the WORST of the three: 11/750 = 14.7 HP/s against Hamburger's 12/650 = 18.5 and Hot
  // Dog's 11/650 = 16.9 — and Hamburger and Hot Dog each carry two ranged weapons on top
  // of theirs while Lollipop carries nothing. It was strictly Hot Dog's swing with a
  // longer cooldown and no rest of the kit, on the character whose own roster card
  // claims the joint-highest damage in the game.
  const swings = CHARACTER_IDS.flatMap((id) => CHARACTERS[id].weapons
    .filter((w) => w.type === 'melee' && w.cooldown <= 1000)
    .map((w) => ({ id, key: w.key, dps: (w.damage ?? 0) / w.cooldown })));
  const lolliSwing = swings.find((s) => s.id === 'lollipop');
  const bestSwing = swings.reduce((a, b) => (b.dps > a.dps ? b : a));
  check('the melee-only character has the roster\'s best sustained basic swing',
    lolliSwing && lolliSwing.dps >= bestSwing.dps,
    `lollipop ${(lolliSwing.dps * 1000).toFixed(1)} HP/s vs best ${bestSwing.id}/${bestSwing.key} ${(bestSwing.dps * 1000).toFixed(1)} HP/s`);

  // A special that outlasts its own status cannot self-lock (section 17(d)'s property,
  // restated for the one weapon whose damage just went up).
  check('the slam cannot hold its own stun up (cooldown > duration + grace)',
    giant.cooldown > STUN_DURATION_MS + STUN_GRACE_MS,
    `cd ${giant.cooldown} vs ${STUN_DURATION_MS + STUN_GRACE_MS}`);

  // ── (e) THE CHANGE REACHES THE SIM — through the real combat path ─────────
  //
  // (a)-(d) are arithmetic on `rules.ts` and would all still pass if `attemptAttack`
  // ignored the roster entirely. This drives the real one: Lollipop at melee range
  // against a full 150 HP pool, immortal so the measurement is a time-to-kill and not a
  // duel, choosing weapons with the same greedy rule both drivers use.
  //
  // Measured: 6.03 s after the change, 8.27 s before it (verified by re-running this
  // same file against a staged copy of `rules.ts` with the old values). The 7.5 s bound
  // is between the two — it is not a design target, it is a value only one side of the
  // change can reach, which is the whole point of asserting it.
  //
  // ⚠️ THE TARGET POOL IS PINNED AT 150, DELIBERATELY (2026-08-05). Both figures above
  // are times to remove a 150 HP pool, so the bound is only meaningful against one.
  // `ENEMY_MAX_HP` is a DIFFICULTY DIAL and went to 90 in AUTHORISED DEVIATION #9; left
  // reading the constant, this assertion would have silently re-calibrated itself to a
  // 40% smaller pool and gone on passing while testing something 1.7x easier. A dial must
  // not be able to move an OUTPUT test's bar. This is Lollipop's DPS under examination,
  // not the enemy's health.
  const TTK_REFERENCE_POOL = 150;
  {
    const arena = makeArena({ width: 2000, height: 2000, maxSafeRadius: 100000 });
    const state = playingMatch(arena, 'lollipop', 'donut');
    state.enemy.hp = state.enemy.maxHp = TTK_REFERENCE_POOL;
    const ws = CHARACTERS.lollipop.weapons;
    let killedAt = null;
    for (let t = 0; t < 30000 && state.phase !== 'ended'; t += 16.667) {
      state.player.x = 980; state.player.y = 1000;
      state.enemy.x = 1020; state.enemy.y = 1000;
      state.player.hp = 1e9; state.player.maxHp = 1e9; // measure a TTK, not a duel
      let slot = 0, bestDmg = -Infinity;
      ws.forEach((w, i) => {
        if (w.type === 'self') return;
        if (state.elapsed - state.player.lastUsed[i] < w.cooldown) return;
        if (40 > (w.range ?? Infinity)) return;
        if ((w.damage ?? 0) > bestDmg) { bestDmg = w.damage ?? 0; slot = i; }
      });
      const evs = stepMatch(state, 16.667, {
        move: { x: 0, y: 0 }, aim: { x: 1, y: 0 }, selectedWeapon: slot, attack: true,
      });
      for (const ev of evs) {
        if (ev.type === 'death' && ev.fighterRole === 'enemy' && killedAt === null) killedAt = state.elapsed;
      }
    }
    check(`Lollipop removes a full ${TTK_REFERENCE_POOL} HP pool at melee range inside 7.5 s`,
      killedAt !== null && killedAt < 7500,
      `killed at ${killedAt === null ? 'never' : `${(killedAt / 1000).toFixed(2)}s`} (was 8.27s at Smash 11 / Giant 10)`);
  }

  // ── (f) THE SLAM IS STILL THE SLAM ────────────────────────────────────────
  //
  // Raising its damage must not have quietly turned it into an ordinary swing: it still
  // has to land from beyond every other weapon's reach, with no aim, and still stun.
  {
    const arena = makeArena({ width: 2000, height: 2000, maxSafeRadius: 100000 });
    const state = playingMatch(arena, 'lollipop', 'donut');
    const giantIdx = CHARACTERS.lollipop.weapons.findIndex((w) => w.key === 'Giant');
    const otherReach = Math.max(...CHARACTER_IDS.flatMap((id) => CHARACTERS[id].weapons
      .filter((w) => !w.giantSlam).map((w) => w.range ?? 0)));
    state.player.x = 1000; state.player.y = 1000;
    state.enemy.x = 1000 + otherReach + 100; state.enemy.y = 1000;
    state.player.facing = { x: -1, y: 0 }; // pointing AWAY: a 360-degree cone needs no bearing
    const hp0 = state.enemy.hp;
    const evs = [];
    attemptAttack(state, state.player, giantIdx, evs);
    check('the slam lands beyond every other weapon\'s reach, unaimed, and stuns',
      state.enemy.hp === hp0 - giant.damage && state.enemy.status.stunnedUntil > state.elapsed,
      `dealt ${hp0 - state.enemy.hp} at ${otherReach + 100}wu (next-longest reach ${otherReach}wu), stunned=${state.enemy.status.stunnedUntil > state.elapsed}`);
  }

  // ── (g) A STUN IS A MOVEMENT LOCK, NOT A SILENCE ──────────────────────────
  //
  // `rules.ts` states the rule in one line: "stunned = movement locked to 0". `sim.ts`
  // implements exactly that — `moveFighter` (was `movePlayer`) reads `stunnedUntil` and `attemptAttack` is
  // called unconditionally, so a stunned player is rooted and keeps shooting.
  //
  // `ai.ts:stepAI` used NOT to: it gated `chosenIndex` on `aiFrozen`, so a stunned AI was
  // rooted AND silenced. Measured (`tools/tmp/stun_symmetry.mjs`): over one full 2000 ms
  // stun, with both fighters pinned in range, a stunned player fired 100% of its shots
  // and a stunned AI fired 0% — 11 of 11 characters, in that direction, every time.
  //
  // ✅ CLOSED, and declared rather than compensated for: §20(a) asserts the AI half of
  // the same rule, and the win-rate consequence is written up in `DECISIONS §12` where
  // `ENEMY_MAX_HP` — the dial that would offset it — is reserved for Uri.
  {
    const arena = makeArena({ width: 2000, height: 2000, maxSafeRadius: 100000 });
    const state = playingMatch(arena, 'hamburger', 'donut');
    const smashIdx = CHARACTERS.hamburger.weapons.findIndex((w) => w.key === 'Smash');
    state.player.x = 1000; state.player.y = 1000;
    state.enemy.x = 1000 + SMASH_IN_RANGE; state.enemy.y = 1000;
    state.player.status.stunnedUntil = state.elapsed + STUN_DURATION_MS;
    const x0 = state.player.x;
    const evs = stepMatch(state, 16.667, {
      move: { x: 1, y: 0 }, aim: { x: 1, y: 0 }, selectedWeapon: smashIdx, attack: true,
    });
    const fired = evs.some((e) => e.type === 'weapon-fired' && e.fighterRole === 'player');
    check('a stunned PLAYER is rooted but not silenced — the rule is a movement lock',
      fired && state.player.x === x0,
      `fired=${fired}, moved ${(state.player.x - x0).toFixed(3)}wu`);
  }
}

// ─────────────────────────────────────────────────────────────────────────────
// 20. THE DRIVER — the same rules, in both hands
// ─────────────────────────────────────────────────────────────────────────────
//
// `combat.ts:attemptAttack` is shared, so the two sides RESOLVE an attack identically.
// That guarantees nothing about which attacks each side gets to ATTEMPT, and `ai.ts` had
// quietly narrowed the enemy's side four separate times — a heal only the player could
// use (`07a4e3a`), a stun that also silenced, a flee branch that could select nothing at
// all for a melee-only character, and a flee branch that aimed backwards.
//
// Everything below drives the real `stepAI` / `stepMatch`. Nothing asserts the shape of
// the code; each check puts the AI in a specific state and asserts what it does. That
// matters here more than anywhere else in this file: all four defects were invisible to
// `tsc`, to 143 assertions, and to every screenshot, and three of them were found only
// by pointing an instrument at the enemy's half of a rule that was already tested on the
// player's half.
{
  console.log('\n20. The AI plays by the same rules it is judged by');

  const OPEN = 1e6;
  const TICK = 16.667;
  /** Fresh AI fixture: `charId` in the ENEMY seat, both fighters pinned `d` apart, every
   *  cooldown ready, nothing on the floor and no ring in reach — so the only thing that
   *  can decide the tick is the branch under test. */
  function aiFixture(charId, { d = 60, opponent = 'donut', flee = false } = {}) {
    const arena = makeArena({ width: 4000, height: 4000, maxSafeRadius: OPEN });
    const state = playingMatch(arena, opponent, charId);
    state.enemy.x = 2000; state.enemy.y = 2000;
    state.player.x = 2000 + d; state.player.y = 2000;
    state.player.hp = 1e9; state.player.maxHp = 1e9;
    if (flee) state.enemy.hp = state.enemy.maxHp * (AI_FLEE_HP_FRACTION - 0.05);
    state.enemy.lastUsed = state.enemy.lastUsed.map(() => -1e9);
    return state;
  }
  /** One `stepAI` tick. Returns what the AI did with it. */
  function aiTick(state) {
    const before = { x: state.enemy.x, y: state.enemy.y };
    const events = [];
    state.elapsed += TICK;
    stepAI(state, state.enemy, TICK, events);
    return {
      fired: events.filter((e) => e.type === 'weapon-fired' && e.fighterRole === 'enemy').map((e) => e.weaponKey),
      moved: Math.hypot(state.enemy.x - before.x, state.enemy.y - before.y),
      facing: state.enemy.facing,
    };
  }

  // ── (a) A STUN LOCKS MOVEMENT. IT DOES NOT SILENCE. ───────────────────────
  //
  // `rules.ts` says it once — "stunned = movement locked to 0" — and `sim.ts:moveFighter` (was `movePlayer`)
  // implements exactly that: a stunned player still aims, still fires, and only its
  // `speed` goes to 0 (§19(g) asserts that half). `ai.ts` read the same flag as "the
  // enemy's turn does not happen", gating the facing, the heal, the whole flee branch
  // and the chase branch's weapon choice on it.
  //
  // The measurement that found it (`tools/tmp/stun_symmetry.mjs`, one full 2000 ms stun,
  // both fighters pinned in range): the stunned PLAYER fired 100% of its shots and the
  // stunned AI fired 0%, for 11 of 11 characters. The same probe now reports 0 of 11
  // asymmetric. A roster-wide loop rather than one character, because it WAS roster-wide.
  {
    const silenced = [];
    const walked = [];
    const lookedAway = [];
    for (const id of CHARACTER_IDS) {
      const state = aiFixture(id);
      state.enemy.status.stunnedUntil = state.elapsed + STUN_DURATION_MS;
      const r = aiTick(state);
      if (r.fired.length === 0) silenced.push(id);
      if (r.moved > 1e-9) walked.push(id);
      if (r.facing.x < 0.99) lookedAway.push(`${id} ${r.facing.x.toFixed(2)}`);
    }
    check('a stunned AI still fires — all 11, exactly as a stunned player does',
      silenced.length === 0, `silenced: [${silenced.join(', ')}]`);
    check('a stunned AI does not move — the lock is a movement lock and it still bites',
      walked.length === 0, `moved: [${walked.join(', ')}]`);
    check('a stunned AI still aims at the player, because aim is not movement',
      lookedAway.length === 0, `facing away: [${lookedAway.join(', ')}]`);
  }
  {
    // The FLEE branch was gated on the same flag as a whole block, so it needs its own
    // check: fixing only the chase branch would leave a stunned, wounded AI silent.
    const silenced = [];
    const walked = [];
    for (const id of CHARACTER_IDS) {
      const state = aiFixture(id, { flee: true });
      state.enemy.status.stunnedUntil = state.elapsed + STUN_DURATION_MS;
      const r = aiTick(state);
      if (r.fired.length === 0) silenced.push(id);
      if (r.moved > 1e-9) walked.push(id);
    }
    check('a stunned AI in the FLEE branch fires too, and still cannot move',
      silenced.length === 0 && walked.length === 0,
      `silenced: [${silenced.join(', ')}] · moved: [${walked.join(', ')}]`);
  }

  // ── (b) THE DRIVER'S RANKING KEY IS THE DAMAGE IT DELIVERS ────────────────
  //
  // Both drivers ranked weapons by the authored `damage` field, which is per-PELLET,
  // per-PECK, and for a combo weapon is not the damage at all — Taco's Double Toss is
  // authored 0 and delivers 23. So the key and the quantity it was trying to maximise
  // were different numbers, and multi-part weapons were systematically under-used.
  //
  // `ai.ts:pressValue` now answers "what does one press deliver from here", including
  // the part `pellets x damage` gets wrong: `combat.ts` fans pellet i out at
  // `(i - (n-1)/2) * spreadDeg` and an off-axis pellet passes `d sin(theta)` wide, so it
  // stops landing past `HIT_RADIUS_VS_PLAYER / |sin theta|`. Sushi's Rice Spray is worth
  // 6 at 40 wu and 2 at 58.
  //
  // This asserts the estimate against the SIM, not against a copy of its arithmetic:
  // every offensive weapon of every character, at every band the AI decides in, fired
  // through the real `attemptAttack` and flown by the real `stepProjectiles`.
  {
    const BANDS = [40, 58, 70, 84, 98, 116, 128, 140];
    /** Damage one press actually puts on the player, measured. `phase = 'ended'` parks
     *  the playing block (aim, movement, `stepAI`, world tick) while leaving
     *  `stepProjectiles` running — it is deliberately never gated on phase — so the only
     *  thing moving in the fixture is the shot under test. */
    function delivered(charId, wi, d) {
      const state = aiFixture(charId, { d });
      state.enemy.facing = { x: 1, y: 0 };
      state.enemy.hp = 1e9; state.enemy.maxHp = 1e9;
      let dealt = 0;
      const take = (evs) => {
        for (const ev of evs) {
          if (ev.type === 'hit-landed' && ev.targetRole === 'player' && ev.source?.kind === 'weapon') dealt += ev.amount;
        }
      };
      const fired = [];
      attemptAttack(state, state.enemy, wi, fired);
      take(fired);
      state.phase = 'ended';
      for (let t = 0; t < 4000 && state.projectiles.length; t += TICK) {
        state.player.x = 2000 + d; state.player.y = 2000;
        take(stepMatch(state, TICK, noInput));
      }
      return dealt;
    }

    const wrong = [];
    let cells = 0;
    for (const id of CHARACTER_IDS) {
      CHARACTERS[id].weapons.forEach((w, i) => {
        if (w.type === 'self') return;
        for (const d of BANDS) {
          if (d > (w.range ?? Infinity)) continue;
          cells++;
          const got = delivered(id, i, d);
          const est = pressValue(w, d);
          if (Math.abs(got - est) > 1e-9) wrong.push(`${id}/${w.key}@${d} sim ${got} vs key ${est}`);
        }
      });
    }
    check(`the driver's ranking key equals what the sim delivers, in all ${cells} weapon-band cells`,
      wrong.length === 0, wrong.slice(0, 6).join(' · '));

    // And the two weapons the old key demonstrably lost. Behavioural: the real `stepAI`
    // choosing for itself, with everything off cooldown and in range.
    const picks = (id, d) => aiTick(aiFixture(id, { d })).fired;
    check('the AI picks Burrito\'s 4-pellet Topping Swarm (delivers 20) over its Disc (10)',
      picks('burrito', 98).includes('Swarm'), `picked [${picks('burrito', 98).join(', ')}]`);
    check('the AI picks Taco\'s Double Toss (authored damage 0, delivers 23) over Filling Toss (12)',
      picks('taco', 98).includes('Double'), `picked [${picks('taco', 98).join(', ')}]`);
  }

  // ── (c) EVERY BRANCH CAN SELECT A WEAPON, FOR EVERY CHARACTER ─────────────
  //
  // Three selection helpers, three silent category exclusions (see the header of
  // `ai.ts`). There is now one selector whose `allow` is `Record<WeaponType, boolean>`,
  // so a fourth category cannot be added to `rules.ts` without `tsc` demanding that
  // every call site says what it does with it. These are the behavioural half.
  {
    const silent = [];
    for (const id of CHARACTER_IDS) {
      // 60 wu is inside every character's shortest reach, so "nothing fired" here can
      // only mean the branch could not SELECT — never that nothing was in range. That
      // distinction is the whole finding: a metric that conflates "cannot" with
      // "nothing to" reports a defect that is not there, and hides one that is.
      const reach = CHARACTERS[id].weapons.filter((w) => w.type !== 'self' && 60 <= (w.range ?? Infinity)).length;
      if (reach === 0) { silent.push(`${id} (nothing reaches 60wu)`); continue; }
      if (aiTick(aiFixture(id, { d: 60, flee: true })).fired.length === 0) silent.push(id);
    }
    check('every character can attack from the FLEE branch, including the melee-only one',
      silent.length === 0, `selected nothing: [${silent.join(', ')}]`);

    // The type-level guard has a runtime shadow: every weapon TYPE the roster defines
    // must be observable coming out of the driver. `self` is §18(d)'s hole, `ranged` was
    // never in doubt, and `melee` is the one the flee branch could not reach.
    const seen = new Set();
    for (const id of CHARACTER_IDS) {
      for (const opts of [{ d: 60 }, { d: 60, flee: true }, { d: 128 }]) {
        for (const key of aiTick(aiFixture(id, opts)).fired) {
          seen.add(CHARACTERS[id].weapons.find((w) => w.key === key).type);
        }
      }
      const heal = CHARACTERS[id].weapons.find((w) => w.type === 'self');
      if (heal) {
        const state = aiFixture(id);
        state.enemy.hp = state.enemy.maxHp * AI_SELF_HEAL_HP_FRACTION - 1;
        for (const key of aiTick(state).fired) seen.add(CHARACTERS[id].weapons.find((w) => w.key === key).type);
      }
    }
    const types = new Set(CHARACTER_IDS.flatMap((id) => CHARACTERS[id].weapons.map((w) => w.type)));
    check('the driver can be observed firing every weapon TYPE the roster defines',
      [...types].every((t) => seen.has(t)),
      `roster has [${[...types].join(', ')}], driver reached [${[...seen].join(', ')}]`);
  }

  // ── (d) …AND "FLEE AND SNIPE" NOW SNIPES ──────────────────────────────────
  //
  // ⚠️ THIS CHECK WAS INVERTED, NOT DELETED (2026-08-05). It was written as a guard on an
  // OPEN DEFECT — the same device §19(g) used while the stun asymmetry was out of its
  // owner's scope — because the fix was measured, priced and parked for Uri rather than
  // smuggled in, and a pinned diagnosis cannot be closed by accident in either direction.
  // Uri took it (`DECISIONS §15`), so the guard now points the other way. The wording of
  // what it used to assert is kept below, because the next person to read this needs to
  // know that a green run here once meant the exact opposite.
  //
  //   WAS: "a fleeing AI lands ONLY its homing weapons — the branch aims away from the
  //         target". The flee branch pointed `facing` directly AWAY from the player and
  //         then called `attemptAttack`, which resolves BOTH the melee cone and the
  //         projectile heading off `attacker.facing`. Measured
  //         (`tools/tmp/flee_probe.mjs`, 8 s below the threshold at 60 wu): 8 of 11
  //         characters delivered ZERO from the branch, and every point of damage in the
  //         table came from the three HOMING weapons, which curve back on their own.
  //
  //   NOW:  the line is gone, aim is written once (at the player) in `stepAI`'s facing
  //         block, and a retreating enemy BACKPEDALS FACING YOU. It is priced in
  //         `rules.ts` AUTHORISED DEVIATION #9, where `ENEMY_MAX_HP` 150 -> 90 lands in
  //         the same commit because the two are one decision.
  //
  // Three assertions, and between them they pin the MECHANISM, the OUTCOME and the thing
  // that must NOT have changed:
  //
  //   1. while fleeing, `facing` points AT the player. This is the literal inverse of the
  //      deleted line, so re-introducing it fails here first and most legibly.
  //   2. no character delivers ZERO from the branch any more — the 8 of 11 is now 0 of 11
  //      — and straight-line (non-homing, directional) weapons land, which was impossible
  //      before by construction.
  //   3. it is still genuinely FLEEING. Aim and travel are separate quantities; a fix to
  //      the aim that also turned the retreat into a charge would pass (1) and (2) and be
  //      a completely different change.
  {
    const homing = [];
    const straight = [];
    const zeroDelivery = [];
    const facedAway = [];
    let retreated = 0;
    for (const id of CHARACTER_IDS) {
      const state = aiFixture(id, { d: 60, flee: true });
      const x0 = state.enemy.x;
      const byWeapon = {};
      let worstFacingDot = 1;
      // Only the PLAYER is pinned: the enemy must be free to retreat, because what is
      // under test is what it does while genuinely fleeing.
      for (let t = 0; t < 4000; t += TICK) {
        state.player.x = 2000 + 60; state.player.y = 2000;
        state.player.hp = 1e9; state.player.maxHp = 1e9;
        state.enemy.hp = state.enemy.maxHp * (AI_FLEE_HP_FRACTION - 0.05);
        for (const ev of stepMatch(state, TICK, noInput)) {
          if (ev.type === 'hit-landed' && ev.targetRole === 'player' && ev.source?.kind === 'weapon') {
            byWeapon[ev.source.weaponKey] = (byWeapon[ev.source.weaponKey] ?? 0) + ev.amount;
          }
        }
        // Facing vs the bearing to the player, every tick of the retreat.
        const bx = state.player.x - state.enemy.x;
        const by = state.player.y - state.enemy.y;
        const bm = Math.hypot(bx, by);
        if (bm > 1e-6) {
          const dot = (state.enemy.facing.x * bx + state.enemy.facing.y * by) / bm;
          if (dot < worstFacingDot) worstFacingDot = dot;
        }
      }
      // 0.999 rather than > 0: the AI does not merely face "roughly forwards", it faces
      // exactly along the bearing, because that is the one line that writes `facing`.
      if (worstFacingDot < 0.999) facedAway.push(`${id} dot ${worstFacingDot.toFixed(3)}`);
      let dealtAny = false;
      for (const [key, dmg] of Object.entries(byWeapon)) {
        const w = CHARACTERS[id].weapons.find((k) => k.key === key);
        if (dmg > 0) dealtAny = true;
        // A 360-degree cone needs no bearing, so it is not evidence either way.
        if (w.cone >= 360) continue;
        (w.homing ? homing : straight).push(`${id}/${key} ${dmg}`);
      }
      if (!dealtAny) zeroDelivery.push(id);
      if (state.enemy.x < x0) retreated++;
    }
    check('a fleeing AI AIMS AT the player every tick — the branch no longer turns its aim with its feet',
      facedAway.length === 0, `faced away: [${facedAway.join(', ')}]`);
    check('…so its straight-line weapons LAND, and 0 of 11 characters deliver nothing (was 8 of 11)',
      straight.length > 0 && zeroDelivery.length === 0,
      `delivered nothing: [${zeroDelivery.join(', ')}] · straight-line hits: [${straight.join(', ')}] · homing: [${homing.join(', ')}]`);
    check('and it is genuinely fleeing while it does it — all 11 retreat',
      retreated === CHARACTER_IDS.length, `${retreated}/${CHARACTER_IDS.length} moved away from the player`);
  }
}

// ─────────────────────────────────────────────────────────────────────────────
// 21. The countdown leaves NO RESIDUE — the property that makes its length free.
// ─────────────────────────────────────────────────────────────────────────────
//
// `COUNTDOWN_FROM` went 5 -> 3 (AUTHORISED DEVIATION #8) on the claim that the length
// of the countdown cannot move balance. That claim was verified empirically — 3,520
// paired matches, 0 of 110 matchups moved on any of four policies — but an empirical
// result is not a guard. These assertions are the guard: they state the STRUCTURAL
// reason the claim holds, so a future change that gives the countdown a side effect
// (fighters that may walk before the whistle, a pre-match hazard tick, a status applied
// on spawn) fails HERE, loudly, instead of silently re-pricing the whole roster.
//
// The reason is that nothing in `stepMatch` reads absolute `elapsed`: every cooldown,
// status and damage stamp starts at `-Infinity` and every timer is an accumulator from
// zero, so translating the clock cannot change a comparison. What that looks like from
// the outside is: at the whistle, the match is in EXACTLY its initial state.
console.log('\n21. The countdown leaves no residue (why its length is balance-free)');
{
  const arena = makeArena();
  const state = createMatch(arena, 'hamburger', 'donut');

  // An input that would do something if the countdown ever let it: full movement, a
  // firing press, and an aim. `stepMatch` must ignore all three until the whistle.
  const liveInput = { move: { x: 1, y: 1 }, selectedWeapon: 0, attack: true, aim: { x: 0, y: 1 } };
  const spawn = { px: state.player.x, py: state.player.y, ex: state.enemy.x, ey: state.enemy.y };
  const facing0 = { x: state.player.facing.x, y: state.player.facing.y };

  // ⚠️ THE TICK THAT BLOWS THE WHISTLE IS ITSELF A PLAYING TICK. `stepMatch` runs
  // `stepCountdown` and then a SEPARATE `if (state.phase === 'playing')` — not an else —
  // so the frame that flips the phase also aims, fires, moves and steps the world (that
  // is deliberate and section 8 asserts the `timeRemaining` half of it). Snapshotting
  // "after the countdown" therefore reads one frame of live match and reports it as
  // residue. The subject here is the state at the END OF THE COUNTDOWN, which is the
  // state at the TOP of the transition tick — so the loop captures before each step and
  // stops on `match-started`, and the events set excludes that final tick.
  const DT = 16.667;
  const seen = new Set();
  const snapshot = () => ({
    elapsed: state.elapsed,
    px: state.player.x, py: state.player.y, ex: state.enemy.x, ey: state.enemy.y,
    fx: state.player.facing.x, fy: state.player.facing.y,
    lastUsed: [state.player.lastUsed.slice(), state.enemy.lastUsed.slice()],
    stamps: [state.player, state.enemy].map((f) => [f.status.slowedUntil, f.status.stunnedUntil, f.lastDamagedAt]),
    timers: [state.player, state.enemy].map((f) => [f.fogTimer, f.regenTimer, f.trailDropTimer, ...f.hazardTimers]),
    hp: [state.player.hp, state.enemy.hp], alive: [state.player.alive, state.enemy.alive],
    world: [state.projectiles.length, state.splats.length, state.trailMarks.length],
    safeRadius: state.safeRadius, timeRemaining: state.timeRemaining,
  });

  let end = null;              // state at the end of the countdown
  let elapsedAtWhistle = null;
  for (let i = 0; i < 2000 && state.phase === 'countdown'; i++) {
    end = snapshot();
    const evs = stepMatch(state, DT, liveInput);
    if (evs.some((e) => e.type === 'match-started')) { elapsedAtWhistle = state.elapsed; break; }
    for (const ev of evs) seen.add(ev.type);
  }

  check('the countdown lasts COUNTDOWN_FROM x 1000 + COUNTDOWN_START_FLASH_MS (to within a tick)',
    elapsedAtWhistle !== null && Math.abs(elapsedAtWhistle - (COUNTDOWN_FROM * 1000 + COUNTDOWN_START_FLASH_MS)) <= DT,
    `whistle at ${elapsedAtWhistle?.toFixed(1)}ms, derived ${COUNTDOWN_FROM * 1000 + COUNTDOWN_START_FLASH_MS}ms`);

  check('the ONLY event a pre-whistle tick can emit is countdown-tick',
    [...seen].every((t) => t === 'countdown-tick'),
    `emitted [${[...seen].join(', ')}]`);

  check('a held move+attack+aim moves NEITHER fighter off its spawn',
    end.px === spawn.px && end.py === spawn.py && end.ex === spawn.ex && end.ey === spawn.ey);

  check('…and does not turn the player either — aim is gated with the rest',
    end.fx === facing0.x && end.fy === facing0.y);

  check('no weapon was consumed: every cooldown is still untouched at -Infinity',
    end.lastUsed.every((arr) => arr.every((t) => t === -Infinity)));

  check('no status, no damage stamp: all six are still -Infinity',
    end.stamps.every((arr) => arr.every((t) => t === -Infinity)));

  check('every per-fighter accumulator is still zero (fog / regen / trail / hazard)',
    end.timers.every((arr) => arr.every((t) => t === 0)));

  check('both fighters are at full HP and alive',
    end.hp[0] === maxHpFor('hamburger', PLAYER_MAX_HP) && end.hp[1] === maxHpFor('donut', ENEMY_MAX_HP)
    && end.alive[0] && end.alive[1],
    `player ${end.hp[0]} enemy ${end.hp[1]}`);

  check('nothing exists in the world: no projectiles, splats or trail marks',
    end.world.every((n) => n === 0));

  check('the ring is still at its opening radius and the match clock has not started',
    end.safeRadius === arena.maxSafeRadius && end.timeRemaining === MATCH_DURATION_MS,
    `safeRadius=${end.safeRadius} timeRemaining=${end.timeRemaining}`);
}

// ─────────────────────────────────────────────────────────────────────────────
// 22. THE CARD IS THE SIM — `CharacterDef.stats` is no longer display-only
// ─────────────────────────────────────────────────────────────────────────────
//
// `DisplayStats` used to be documented "Not used in combat math", and that was true of
// two of its three axes: every character had identical HP and identical movement speed,
// and the card drew two bars that described nothing. `rules.ts` AUTHORISED DEVIATION #10
// makes them real, and this section is what stops them becoming fiction again.
//
// Each axis has a DIRECTION and the direction is asserted, not assumed:
//
//   health, speed   card -> sim.  Authored on the card; `sim.ts` and `ai.ts` read them
//                   through `maxHpFor` / `speedFor`. A display value derived from the sim
//                   can still drift into meaninglessness; a sim driven BY the display
//                   value cannot disagree with it.
//   damage          sim -> card.  `weapons` is and stays the single source of truth for
//                   damage, so the bar is DERIVED from the kit by `damageStatFor`.
//
// Everything below drives the real `createMatch` / `stepMatch` / `stepAI`. Nothing here
// asserts the shape of `rules.ts` — an assertion that `healthMultiplier` returns what its
// own formula says would pass forever against a `sim.ts` that had stopped calling it.
{
  console.log('\n22. The character card is the simulation (per-character health and speed)');
  const TICK = 16.667;
  const OPEN = 1e6;

  // ── (a) HEALTH REACHES THE SIM, FOR BOTH ROLES ────────────────────────────
  {
    const wrongP = [], wrongE = [];
    for (const id of CHARACTER_IDS) {
      const m = createMatch(makeArena({ maxSafeRadius: OPEN }), id, id);
      if (m.player.maxHp !== maxHpFor(id, PLAYER_MAX_HP)) wrongP.push(`${id} ${m.player.maxHp}`);
      if (m.enemy.maxHp !== maxHpFor(id, ENEMY_MAX_HP)) wrongE.push(`${id} ${m.enemy.maxHp}`);
      if (m.player.hp !== m.player.maxHp || m.enemy.hp !== m.enemy.maxHp) wrongP.push(`${id} not at full`);
    }
    check('every character spawns with ITS OWN pool, in both roles',
      wrongP.length === 0 && wrongE.length === 0, `player [${wrongP.join(', ')}] enemy [${wrongE.join(', ')}]`);

    // The bar's ORDER is the pool's order. This is the whole promise the card makes, and
    // it is a stronger statement than "the numbers differ" — a roster where the bars and
    // the pools disagreed on which character is tougher would pass the check above.
    const byBar = [...CHARACTER_IDS].sort((a, b) => CHARACTERS[a].stats.health - CHARACTERS[b].stats.health);
    const bad = byBar.filter((id, i) => i > 0
      && maxHpFor(id, PLAYER_MAX_HP) < maxHpFor(byBar[i - 1], PLAYER_MAX_HP));
    check('a bigger health BAR always means a bigger pool — the card cannot lie about the order',
      bad.length === 0, `out of order: [${bad.join(', ')}]`);

    check('and nobody is authored into a pool of nothing',
      CHARACTER_IDS.every((id) => maxHpFor(id, PLAYER_MAX_HP) >= 1 && maxHpFor(id, ENEMY_MAX_HP) >= 1),
      `min player pool ${Math.min(...CHARACTER_IDS.map((id) => maxHpFor(id, PLAYER_MAX_HP)))}`);
  }

  // ── (b) URI'S DIFFICULTY DIAL SURVIVED ────────────────────────────────────
  //
  // `ENEMY_MAX_HP` is a per-ROLE constant and `DECISIONS §12`/`§15` is where it is
  // decided. Per-character health had to go ON TOP of it, never instead of it, or the
  // change would have quietly taken the dial away. The property that makes it still a
  // dial is that it scales the whole roster together: `maxHpFor` must be LINEAR in its
  // base, so halving the role pool halves every character's pool.
  {
    const off = CHARACTER_IDS.filter((id) =>
      Math.abs(maxHpFor(id, 200) - 2 * maxHpFor(id, 100)) > 1);  // >1 is rounding, not drift
    check('the role dial still scales the WHOLE roster — maxHpFor is linear in the role pool',
      off.length === 0, `not proportional: [${off.join(', ')}]`);
    check('…and a character at the baseline stat is exactly the role pool, so the dial keeps its meaning',
      CHARACTER_IDS.every((id) => CHARACTERS[id].stats.health !== HEALTH_BASELINE_STAT
        || maxHpFor(id, ENEMY_MAX_HP) === ENEMY_MAX_HP));
  }

  // ── (c) SPEED REACHES THE SIM — MEASURED, NOT COMPUTED ────────────────────
  //
  // Driven through the real `moveFighter` (was `movePlayer`): a straight run across open ground with no
  // slow, no trail and no cover, so the only thing that can decide the distance is the
  // character's own speed.
  {
    const run = (id) => {
      const arena = makeArena({ width: 8000, height: 8000, maxSafeRadius: OPEN });
      const state = playingMatch(arena, id, 'donut');
      state.player.x = 4000; state.player.y = 4000;
      state.enemy.x = 100; state.enemy.y = 100;      // far enough that the AI never arrives
      const x0 = state.player.x;
      for (let t = 0; t < 60; t++) {
        state.player.hp = 1e9; state.player.maxHp = 1e9;
        // ⚠️ Donut's Sticky Trail multiplies its speed AGAIN (`TRAIL.speedBoost`) from the
        // second tick onward — measured, it walks 139.5 wu where its own speed says 108.0.
        // That is a different mechanic and it has its own tests; clearing the marks each
        // tick is what makes this a measurement of `speedFor` and nothing else. (d) below
        // asserts the two STACKED, which is the case `camera.ts` actually depends on.
        state.trailMarks.length = 0;
        stepMatch(state, TICK, { move: { x: 1, y: 0 }, selectedWeapon: 0, attack: false });
      }
      return state.player.x - x0;
    };
    const wrong = [];
    for (const id of CHARACTER_IDS) {
      const expected = speedFor(id, PLAYER_SPEED) * TICK * 60;
      if (Math.abs(run(id) - expected) > 1e-6) wrong.push(`${id} moved ${run(id).toFixed(3)} vs ${expected.toFixed(3)}`);
    }
    check('every character MOVES at its own speed through the real moveFighter',
      wrong.length === 0, wrong.slice(0, 3).join(' · '));

    // Not all the same — otherwise the check above passes on a roster where the axis
    // exists in the code and not in the design.
    const speeds = new Set(CHARACTER_IDS.map((id) => speedFor(id, PLAYER_SPEED).toFixed(6)));
    check('…and they are not all the same speed — the axis exists in the ROSTER, not just the code',
      speeds.size > 1, `${speeds.size} distinct speeds across ${CHARACTER_IDS.length} characters`);
  }

  // ── (d) THE CAP. `render/camera.ts` DEPENDS ON THIS AND CANNOT ASSERT IT ──
  //
  // `camera.ts` derives the fair-play radius — the guarantee that you can always see the
  // fighter shooting you — partly from `MAX_CLOSING_SPEED = PLAYER_SPEED *
  // TRAIL.speedBoost`, commented "nothing in rules.ts moves faster". That is now a claim
  // ABOUT THE ROSTER, and it is a claim in a file this pass does not own, so it is
  // asserted here. A single character authored one point over the cap would silently
  // shrink the guarantee for everybody and no gate anywhere else would notice.
  {
    const over = CHARACTER_IDS.filter((id) => CHARACTERS[id].stats.speed > SPEED_TOP_STAT);
    check('no character is authored above SPEED_TOP_STAT — the cap is the cap',
      over.length === 0, `above the cap: [${over.join(', ')}]`);
    check('…so nothing in the roster moves faster than PLAYER_SPEED',
      CHARACTER_IDS.every((id) => speedFor(id, PLAYER_SPEED) <= PLAYER_SPEED + 1e-12),
      `fastest ${Math.max(...CHARACTER_IDS.map((id) => speedFor(id, PLAYER_SPEED)))} vs cap ${PLAYER_SPEED}`);
    // The binding case is Donut, the only character whose speed is multiplied again.
    const fastest = Math.max(...CHARACTER_IDS.map((id) =>
      speedFor(id, PLAYER_SPEED) * (CHARACTERS[id].hasTrail ? TRAIL.speedBoost : 1)));
    check('…and not even on its own Sticky Trail: camera.ts\'s MAX_CLOSING_SPEED is still an upper bound',
      fastest <= PLAYER_SPEED * TRAIL.speedBoost + 1e-12,
      `fastest achievable ${fastest.toFixed(6)} vs camera bound ${(PLAYER_SPEED * TRAIL.speedBoost).toFixed(6)}`);
    check('every multiplier is positive and at most 1 — a speed stat can only cost, never buy',
      CHARACTER_IDS.every((id) => speedMultiplier(id) > 0 && speedMultiplier(id) <= 1)
      && CHARACTER_IDS.every((id) => healthMultiplier(id) > 0));
  }

  // ── (e) THE AI GETS THE SAME SPEEDS — the asymmetry trap, pre-empted ──────
  //
  // `ai.ts` has had a rule stated once and implemented twice surgically removed from it
  // FOUR times (see that file's header). A speed stat that applied only in the player's
  // hands would be the fifth, and it would be invisible: `strength` is the mean of the
  // two roles, so the roster would simply respond at half rate and look like a weak
  // lever rather than a broken one.
  {
    const run = (id) => {
      const arena = makeArena({ width: 8000, height: 8000, maxSafeRadius: OPEN });
      const state = playingMatch(arena, 'donut', id);
      state.enemy.x = 4000; state.enemy.y = 4000;
      state.player.x = 4000 + REACH.rangedMax * 4; state.player.y = 4000;   // out of every reach
      const x0 = state.enemy.x;
      for (let t = 0; t < 60; t++) {
        state.enemy.lastUsed = state.enemy.lastUsed.map(() => Infinity);    // never fires, always moves
        state.elapsed += TICK;
        stepAI(state, state.enemy, TICK, []);
      }
      return Math.abs(state.enemy.x - x0);
    };
    const travel = Object.fromEntries(CHARACTER_IDS.map((id) => [id, run(id)]));
    const ratioOff = CHARACTER_IDS.filter((id) =>
      Math.abs(travel[id] / travel.hotdog - speedMultiplier(id) / speedMultiplier('hotdog')) > 0.02);
    check('the AI moves at ITS character\'s speed too — the stat is not player-only',
      ratioOff.length === 0,
      CHARACTER_IDS.map((id) => `${id} ${travel[id].toFixed(1)}wu`).join(' · '));
  }

  // ── (f) THE DAMAGE BAR IS THE KIT ─────────────────────────────────────────
  {
    const wrong = CHARACTER_IDS.filter((id) => CHARACTERS[id].stats.damage !== damageStatFor(id));
    check('every damage bar equals what the weapon table delivers — the card is derived, not authored',
      wrong.length === 0,
      wrong.map((id) => `${id} card ${CHARACTERS[id].stats.damage} vs kit ${damageStatFor(id)} (${kitDps(id).toFixed(1)} HP/s)`).join(' · '));

    // `kitDps` prices a PRESS, and the authored `damage` field is not that (per-pellet,
    // per-peck, and 0 for a combo weapon). `ai.ts:pressValue` is the sim-validated
    // version of the same idea — §20(b) checks it against the real combat path in every
    // weapon-band cell — so the two are cross-checked here at point blank, where every
    // off-axis pellet still lands and the two definitions must coincide exactly.
    const drift = [];
    for (const id of CHARACTER_IDS) {
      for (const w of CHARACTERS[id].weapons) {
        if (w.type === 'self') continue;
        const mine = w.comboParts
          ? w.comboParts.reduce((s, p) => s + p.damage, 0)
          : w.damage * (w.peckHits ?? 1) * (w.pellets ?? 1);
        if (Math.abs(mine - pressValue(w, 0)) > 1e-9) drift.push(`${id}/${w.key} ${mine} vs ${pressValue(w, 0)}`);
      }
    }
    check('…and kitDps prices a PRESS the same way the driver\'s sim-validated key does',
      drift.length === 0, drift.slice(0, 4).join(' · '));

    check('every bar is on the card\'s own 1..STAT_MAX_DISPLAY scale',
      CHARACTER_IDS.every((id) => ['damage', 'health', 'speed'].every((k) => {
        const v = CHARACTERS[id].stats[k];
        return Number.isInteger(v) && v >= 1 && v <= STAT_MAX_DISPLAY;
      })));
  }

  // ── (g) THE CARD CAN DISCRIMINATE THE ROSTER — the structural check ───────
  //
  // ⚠️ THE EVIDENCE THAT THE CARD WAS FICTION IS ITSELF WITHDRAWN, so this asserts the
  // replacement rather than the original. `DECISIONS §13(b)` recorded ρ = 0.327 between
  // the card's stat total and measured strength; the driver audit could not reproduce it
  // (0.395 on the same tool, same seeds, same commit; 0.462 today). A correlation that
  // moves cannot be a gate.
  //
  // What does not move: with n = 11 significance needs ρ ≈ 0.62, and the old card's stat
  // total took **five distinct values across eleven characters with five of them tied at
  // 19**. A statistic with five levels and a five-way tie in the middle cannot rank the
  // roster EVEN IN PRINCIPLE, whatever its correlation happens to be this week. That is a
  // property of the numbers alone, so it is assertable — and it is the honest form of
  // "the card is fiction".
  {
    const totals = CHARACTER_IDS.map((id) =>
      CHARACTERS[id].stats.damage + CHARACTERS[id].stats.health + CHARACTERS[id].stats.speed);
    const distinct = new Set(totals).size;
    const largestTie = Math.max(...[...new Set(totals)].map((t) => totals.filter((x) => x === t).length));
    // ── ⚠️ THE BOUND MOVED 7 -> 6, AND THE OLD WORDING IS KEPT DELIBERATELY ──
    //
    // WAS: "the card's stat total distinguishes the roster: >= 7 distinct values, no tie
    //       bigger than 3"  (against the pre-#10 card's 5 distinct values with a
    //       FIVE-WAY tie at 19, which could not rank the roster even in principle).
    //
    // The rule this encoded has been half-reversed by Uri: *"Match how common games do
    // it. There is a reason for it."* Rarity must NOT confer power at equal level, so the
    // roster was re-flattened (DEVIATION #12) and four health values moved. That took the
    // distinct-total count 7 -> 6, and the honest reading is that **the card SHOULD be
    // losing total-spread** — characters are meant to differ in SHAPE at comparable
    // totals (Hamburger 10/3/5 glass cannon, Pizza 4/10/5 wall), not in size.
    //
    // What must NOT come back is the degenerate case this check was built for. 6 distinct
    // values with a largest tie of 3 is still nothing like 5 with a tie of 5, so the
    // bound is lowered to exactly where the defect starts rather than deleted. Weakening
    // it further is how the old defect returns.
    check(`the card's stat total still discriminates: >= 6 distinct values, no tie bigger than 3`,
      distinct >= 6 && largestTie <= 3,
      `${distinct} distinct totals across ${CHARACTER_IDS.length} characters, largest tie ${largestTie} `
      + `(the pre-#10 card: 5 distinct, largest tie 5)`);
  }

  // ── (h) THE DESIGN RULE THAT PRODUCES A **FLAT** ROSTER ──────────────────
  //
  // ⚠️ THIS SECTION'S GOAL REVERSED, AND BOTH VERSIONS ARE URI'S. The old text read:
  //
  //   "The trophy road is built as a PROGRESSION and it used to sell a DOWNGRADE:
  //    measured, Normal 68.6 against Epic 12.5. Uri's answer to `DECISIONS §13(a)` was
  //    'rarity means power', and the roster now delivers it: MONOTONIC across all six
  //    tiers under `smart2`, 40.4 -> 61.1."
  //
  // Then, on seeing the level system stack a SECOND power axis on top of that one:
  // *"Match how common games do it. There is a reason for it."* The reason is his own
  // §22 answer — this becomes humans vs. humans, and **rarity-as-power is pay-to-win
  // that skill cannot close.** Brawl Stars brawlers and Clash Royale cards are balanced
  // at equal level; rarity there governs ACQUISITION and UPGRADE COST.
  //
  // ⚠️ CORRECTED 2026-08-06. The old wording read: "So it does here:
  // `economy/tuning.ts:LEVEL_UP.rarityCostMultiplier` charges a Cyber 4.5x a Normal to
  // reach the same level". That is FALSE — the multiplier is now 1.0 across every tier
  // (`68cac7a`, DECISIONS §26; Uri: "it means nothing besides the rarity to obtain it").
  // Rarity here governs ACQUISITION ONLY. `rules.ts` DEVIATION #12 flattened the power
  // ramp and the cost ramp is flat too, so a Cyber and a Normal cost an identical 44,770
  // coins to max. The half of the Clash Royale comparison that survives is the first
  // half: balanced at equal level.
  //
  // MEASURED, 110 matchups x 32 seeds, `smart2` (`tools/tmp/roster_lab.mjs`):
  //   tier means   BEFORE  40.4 · 41.7 · 46.3 · 50.0 · 58.7 · 61.1   spread 20.7 pp
  //                AFTER   48.4 · 52.0 · 48.9 · 48.8 · 52.4 · 48.9   spread  4.0 pp
  //   settled matchups 22/110 -> **17/110**, roster sd 12.4 pp -> 4.6 pp.
  // The 4.0 pp spread is BELOW the ~9 pp this project treats as the aggregate resolution
  // floor — the tiers are flat to the limit of what the instrument can distinguish.
  //
  // ⚠️ AND THE MODEL DOES NOT AGREE WITH THAT MEASUREMENT, WHICH IS DECLARED RATHER THAN
  // ASSERTED. `powerIndex` still correlates rho = 0.63 with rarity rank, and the card's
  // stat total rho = 0.75, on the roster that MEASURES flat to 4.0 pp. Exactly the trap
  // the paragraph below already describes: a model that disagrees with 7,040 matches is
  // not a gate. Neither correlation is asserted here, in either direction.
  //
  // ⚠️ THAT SENTENCE CANNOT BE ASSERTED HERE, AND AN EARLIER DRAFT OF THIS CHECK TRIED.
  // Measured strength is a 7,040-match quantity; `tools/tmp/roster_lab.mjs` owns it and
  // prints MONOTONIC yes/no on every run. The draft asserted a MODEL instead —
  // `powerIndex`, kit output x durability — and the model does not reproduce the
  // measurement: on the roster that measures monotone, `powerIndex` puts Neon BELOW
  // Legendary. Asserting it would have made a false statement a gate, and the next person
  // to satisfy the gate would have made the game worse. The model is kept in `rules.ts`,
  // labelled as a model, because it is a useful sketch; it is not a guard.
  //
  // What IS assertable is the DESIGN RULE the ramp was built from, and it is the whole
  // reason per-character health was the right lever: **health compensates the kit.**
  // Rarity in this roster is fixed and the kits are not aligned to it — Hamburger, the
  // free Normal starter, has the roster's strongest kit (33.9 HP/s) and Pizza, a Neon,
  // has the weakest (15.6) — so the ONLY way rarity can mean power is for durability to
  // run opposite to output. It does, and that is a property of `rules.ts` alone.
  {
    const dps = CHARACTER_IDS.map((id) => kitDps(id));
    const hp = CHARACTER_IDS.map((id) => healthMultiplier(id));
    const mean = (a) => a.reduce((x, y) => x + y, 0) / a.length;
    const mx = mean(dps), my = mean(hp);
    const cov = dps.reduce((s, x, i) => s + (x - mx) * (hp[i] - my), 0);
    const sx = Math.sqrt(dps.reduce((s, x) => s + (x - mx) ** 2, 0));
    const sy = Math.sqrt(hp.reduce((s, y) => s + (y - my) ** 2, 0));
    const rho = cov / (sx * sy);
    // Bound tightened -0.4 -> -0.6 with DEVIATION #12. Compensation is not merely
    // present now, it is the MECHANISM that makes the tiers flat: the kits are not
    // aligned to rarity at all (rho = 0.03 between kit HP/s and rarity rank), so a flat
    // roster is exactly a roster where durability cancels output. Measured -0.788.
    check('health COMPENSATES the kit: the strongest kits are the frailest (rho <= -0.6)',
      rho <= -0.6, `rho = ${rho.toFixed(3)} between kit HP/s and health multiplier`);

    // …and the compensation is big enough to be worth something. A roster where every
    // multiplier sat between 0.98 and 1.02 would satisfy every check above and change
    // nothing about the game.
    const lo = Math.min(...hp), hi = Math.max(...hp);
    check('…and the durability axis has real range — the toughest pool is >= 1.6x the frailest',
      hi / lo >= 1.6, `${(lo * 100).toFixed(0)}% .. ${(hi * 100).toFixed(0)}% of the role pool = ${(hi / lo).toFixed(2)}x`);
  }
}

// ─────────────────────────────────────────────────────────────────────────────
// 23. CHARACTER LEVELS 1-15 (rules.ts DEVIATION #11)
// ─────────────────────────────────────────────────────────────────────────────
//
// Uri asked for levels that raise damage and HP, and separately answered the two
// questions that make a level system more than a multiplier:
//
//   * *"AI players… need to be adjusted to the player's level"* -> the term is
//     ROLE-AGNOSTIC. Everything below drives BOTH fighters through the same function.
//   * *"level 15 normal should be able to beat level 1 cyber"* -> the level span must
//     exceed the rarity span. The crossover itself is a 7,040-match measurement and
//     lives in `tools/tmp/level_lab.mjs`; what is assertable here is the arithmetic that
//     makes it possible.

console.log('\n23. Character levels');
{
  // ── (a) The identity that every "bit-identical" claim in this pass rests on ──
  check('level 1 is exactly 1.0 on both axes',
    levelHealthMultiplier(LEVEL_MIN) === 1 && levelDamageMultiplier(LEVEL_MIN) === 1);
  check('a 3-argument createMatch gives level-1 fighters',
    (() => {
      const s = createMatch(makeArena(), 'hamburger', 'donut');
      return s.player.level === LEVEL_MIN && s.enemy.level === LEVEL_MIN
        && s.player.damageMul === 1 && s.enemy.damageMul === 1;
    })());
  check('an unlevelled fighter has exactly the pool it had before levels existed',
    createMatch(makeArena(), 'pizza', 'taco').player.maxHp
      === Math.round(PLAYER_MAX_HP * healthMultiplier('pizza')));

  // ── (b) The ladder ────────────────────────────────────────────────────────
  check('both multipliers rise strictly with level, all the way to the cap',
    Array.from({ length: LEVEL_MAX - 1 }, (_, i) => i + LEVEL_MIN).every((n) =>
      levelHealthMultiplier(n + 1) > levelHealthMultiplier(n)
      && levelDamageMultiplier(n + 1) > levelDamageMultiplier(n)));
  check('the cap is the documented 1 + 14 steps on both axes',
    Math.abs(levelHealthMultiplier(LEVEL_MAX) - (1 + (LEVEL_MAX - LEVEL_MIN) * LEVEL_HEALTH_PER_LEVEL)) < 1e-12
    && Math.abs(levelDamageMultiplier(LEVEL_MAX) - (1 + (LEVEL_MAX - LEVEL_MIN) * LEVEL_DAMAGE_PER_LEVEL)) < 1e-12);
  check('levels clamp rather than extrapolate in either direction',
    clampLevel(-5) === LEVEL_MIN && clampLevel(1e6) === LEVEL_MAX
      && clampLevel(NaN) === LEVEL_MIN && clampLevel(7.9) === 7);

  // ── (c) THE LEVEL SPAN MUST EXCEED THE RARITY SPAN ───────────────────────
  //
  // This is Uri's sentence expressed as arithmetic. HP and damage are multiplicative in
  // combat power, so a full ladder is `mult^2` of effective power against an unlevelled
  // opponent. The rarity side is now flat BY DESIGN (§22(h)), so the comparison is
  // against the widest per-character durability gap the roster still contains — if the
  // level ladder did not clear even that, "investment beats rarity" could not hold for
  // any pair of characters, let alone a Normal against a Cyber.
  {
    const levelPower = levelHealthMultiplier(LEVEL_MAX) * levelDamageMultiplier(LEVEL_MAX);
    const hp = CHARACTER_IDS.map((id) => healthMultiplier(id));
    const rosterSpread = Math.max(...hp) / Math.min(...hp);
    check('a full level ladder is worth more than the whole roster durability spread',
      levelPower > rosterSpread,
      `level 1->${LEVEL_MAX} = ${levelPower.toFixed(2)}x effective power vs a ${rosterSpread.toFixed(2)}x roster spread`);
  }

  // ── (d) ROLE-AGNOSTIC. One function, both sides. ─────────────────────────
  //
  // ⚠️ THE POINT OF THIS CHECK IS THE ABSENCE OF A BOT PATH. Uri's PvP answer means a
  // bot standing in for a level-8 human must have a level-8 human's stats. A level term
  // that applied only to the player would be invisible in every aggregate — and `ai.ts`
  // has had "a rule stated once and implemented twice" removed from it four times.
  {
    const s = createMatch(makeArena(), 'hamburger', 'hamburger', { player: LEVEL_MAX, enemy: LEVEL_MAX });
    const one = createMatch(makeArena(), 'hamburger', 'hamburger');
    // ⚠️ COMPARED AGAINST `maxHpFor` ITSELF, NOT AGAINST A RATIO. The first draft of this
    // asserted `enemyRatio === playerRatio` and failed at 1.6984 vs 1.7000 — which is
    // `maxHpFor`'s own `Math.round` on a 63 HP pool, not an asymmetry. A ratio between two
    // rounded integers is not the quantity under test; the quantity under test is that
    // both sides go through the same function with the same level.
    check('the level term reaches BOTH pools through the identical function',
      s.player.maxHp === maxHpFor('hamburger', PLAYER_MAX_HP, LEVEL_MAX)
      && s.enemy.maxHp === maxHpFor('hamburger', ENEMY_MAX_HP, LEVEL_MAX)
      && one.enemy.maxHp === maxHpFor('hamburger', ENEMY_MAX_HP, LEVEL_MIN),
      `player ${s.player.maxHp}, enemy ${s.enemy.maxHp}`);
    check('…so the two ratios agree to within the rounding maxHpFor already applies',
      Math.abs((s.enemy.maxHp / one.enemy.maxHp) - (s.player.maxHp / one.player.maxHp)) < 0.01,
      `player x${(s.player.maxHp / one.player.maxHp).toFixed(4)}, enemy x${(s.enemy.maxHp / one.enemy.maxHp).toFixed(4)}`);
    check('…and gives both fighters the identical damage multiplier',
      s.player.damageMul === s.enemy.damageMul && s.player.damageMul === levelDamageMultiplier(LEVEL_MAX));
    const asym = createMatch(makeArena(), 'hamburger', 'hamburger', { player: LEVEL_MAX, enemy: LEVEL_MIN });
    check('an asymmetric pairing is expressible — nothing forces the two together in the sim',
      asym.player.maxHp > asym.enemy.maxHp * 1.5);
  }

  // ── (e) maxHpFor STAYS LINEAR IN ITS ROLE BASE AT EVERY LEVEL ───────────
  //
  // §22(b) asserts this at level 1 because `ENEMY_MAX_HP` is Uri's live difficulty dial.
  // A level term that broke linearity would take the dial away at every level except 1,
  // which no existing gate would have caught.
  check('maxHpFor is linear in roleBaseHp at every level, not just level 1',
    CHARACTER_IDS.every((id) => [LEVEL_MIN, 5, 9, LEVEL_MAX].every((lvl) =>
      Math.abs(maxHpFor(id, 200, lvl) - 2 * maxHpFor(id, 100, lvl)) <= 1)),
    'tolerance 1 HP for the rounding maxHpFor already applies');

  // ── (f) THE DAMAGE MULTIPLIER REACHES REAL HITS — AND NOT THE ARENA ─────
  //
  // `combat.ts:applyDamage` is the single choke point for all five damage sources. The
  // failure this catches is the one that motivated putting it there: a multiplier wired
  // into four of them and not the fifth, or — worse — wired into the FOG, so levelling
  // up would make the closing ring hurt you more.
  {
    const arena = makeArena();
    const hi = createMatch(arena, 'hamburger', 'pizza', { player: LEVEL_MAX, enemy: LEVEL_MAX });
    const lo = createMatch(arena, 'hamburger', 'pizza');
    const evHi = [], evLo = [];
    applyDamage(hi, hi.enemy, 10, null, { kind: 'weapon', weaponKey: 'k', weaponName: 'n', attackerId: 0 }, evHi);
    applyDamage(lo, lo.enemy, 10, null, { kind: 'weapon', weaponKey: 'k', weaponName: 'n', attackerId: 0 }, evLo);
    check('a weapon hit is scaled by the ATTACKER\'s level',
      Math.abs(evHi[0].amount - 10 * levelDamageMultiplier(LEVEL_MAX)) < 1e-9
      && evLo[0].amount === 10,
      `${evHi[0].amount} vs ${evLo[0].amount}`);
    check('…and the health bar lost exactly what the event reported',
      Math.abs((hi.enemy.maxHp - hi.enemy.hp) - evHi[0].amount) < 1e-9,
      'the floating damage number and the bar cannot disagree');

    const evFog = [], evHaz = [];
    const fogState = createMatch(arena, 'hamburger', 'pizza', { player: LEVEL_MAX, enemy: LEVEL_MAX });
    applyDamage(fogState, fogState.player, 10, null, { kind: 'fog' }, evFog);
    applyDamage(fogState, fogState.player, 10, null, { kind: 'hazard' }, evHaz);
    check('the fog and the pot are NOT scaled by anybody\'s level',
      evFog[0].amount === 10 && evHaz[0].amount === 10,
      `fog ${evFog[0].amount}, hazard ${evHaz[0].amount}`);

    const evTrail = [];
    const trailState = createMatch(arena, 'donut', 'pizza', { player: LEVEL_MAX, enemy: LEVEL_MIN });
    applyDamage(trailState, trailState.enemy, 10, null, { kind: 'trail', ownerId: 0, ownerRole: 'player' }, evTrail);
    check('a trail mark is scaled by its OWNER, who may not be the target\'s opponent-of-record',
      Math.abs(evTrail[0].amount - 10 * levelDamageMultiplier(LEVEL_MAX)) < 1e-9,
      `${evTrail[0].amount}`);
  }

  // ── (g) A WHOLE MATCH AT LEVEL 1 IS BIT-IDENTICAL TO THE OLD CALL PATH ──
  //
  // The cheapest possible guarantee that shipping levels re-priced nothing: drive two
  // full matches, one through each signature, and require every tick to agree.
  {
    const drive = (state) => {
      let ticks = 0;
      const trace = [];
      while (state.phase !== 'ended' && ticks < 4000) {
        const evs = stepMatch(state, 16.667, { move: { x: 1, y: 0 }, selectedWeapon: 0, attack: true });
        for (const ev of evs) if (ev.type === 'hit-landed') trace.push(`${ticks}:${ev.targetRole}:${ev.amount}`);
        ticks++;
      }
      return { ticks, trace: trace.join('|'), hp: `${state.player.hp}/${state.enemy.hp}` };
    };
    const a = drive(createMatch(makeArena(), 'taco', 'soup'));
    const b = drive(createMatch(makeArena(), 'taco', 'soup', { player: LEVEL_MIN, enemy: LEVEL_MIN }));
    check('a level-1 match is tick-for-tick and hit-for-hit identical to a pre-levels one',
      a.ticks === b.ticks && a.trace === b.trace && a.hp === b.hp,
      `${a.ticks}/${b.ticks} ticks, hp ${a.hp} vs ${b.hp}`);
  }
}

// ─────────────────────────────────────────────────────────────────────────────
// 24. THE ROSTER'S KIT VARIETY — the half of "distinctiveness" a unit test can reach
// ─────────────────────────────────────────────────────────────────────────────
//
// `DECISIONS §26` proposed that rarity should buy DISTINCTIVENESS now that it no longer
// buys power. `tools/tmp/kit_lab.mjs` measured it over 3,520 matches and the full result
// is recorded in `rules.ts`'s "KIT DISTINCTIVENESS" section. Two of its findings are
// properties of `rules.ts` alone, so they belong here rather than in a probe nobody runs:
// the outcome half needs 3,520 matches and cannot live in a unit test, exactly as §22(h)
// already says about the rarity ramp.
//
//   MEASURED, for the record this section guards the inputs to:
//     mean pairwise matchup-profile correlation   **-0.026**   (uncorrelated)
//     pairs indistinguishable at 32 seeds          **0 / 55**
//     closest genuine pair (donut ~ lollipop)      11.65 pp, against a measured
//                                                  literal clone at 2.10 pp
//     a UNIFORM roster (all eleven cloned)          2.58 pp, settled 0/110
{
  console.log('\n24. The roster has real kit variety (the structural half of DECISIONS §26)');

  // ── (a) NO TWO CHARACTERS HAVE THE SAME KIT ───────────────────────────────
  //
  // The measured version of this is "0 of 55 pairs are indistinguishable over 3,520
  // matches". This is its structural shadow and it is worth having on its own: a pair
  // that collides HERE is two characters that cannot possibly play differently, and the
  // instrument that would notice takes 70 s and a staged tree to run.
  {
    const seen = new Map();
    const collisions = [];
    for (const id of CHARACTER_IDS) {
      const sig = kitSignature(id).join(' | ');
      if (seen.has(sig)) collisions.push(`${seen.get(sig)} == ${id}`);
      else seen.set(sig, id);
    }
    check('no two characters share a kit signature — the roster contains no clones',
      collisions.length === 0, collisions.join(' · '));
  }

  // ── (b) THE ROSTER SPANS ITS OWN DESIGN SPACE ─────────────────────────────
  //
  // Every optional mechanic the weapon model defines is used by somebody. A mechanic with
  // no user is dead content — `rules.ts` has had three of those already (the AI could not
  // reach `self` weapons, the regen delay was unreachable, the pot was standable-around)
  // and every one of them was invisible until something counted.
  {
    const users = Object.fromEntries(WEAPON_MECHANICS.map((m) => [m,
      CHARACTER_IDS.filter((id) => CHARACTERS[id].weapons.some((w) => weaponMechanics(w).includes(m)))]));
    const unused = WEAPON_MECHANICS.filter((m) => users[m].length === 0);
    check('every mechanic the weapon model defines is used by at least one character',
      unused.length === 0, `unused: [${unused.join(', ')}]`);
  }

  // ── (c) ⚠️ A PINNED DIAGNOSIS, NOT A PASSING GATE ─────────────────────────
  //
  // **Exactly one character's kit uses no mechanic at all, and it is the Cyber-tier Hot
  // Dog** — three weapons, all `plain`. This is written the way §19(c) and §20(d) are
  // written, as a guard on an OPEN and DELIBERATE state: eight replacement kits were built
  // and measured, none raised matchup-profile divergence, six of eight blew the rarity
  // tier-spread guard past 10 pp at constant kit output, and the one that held it bought
  // +0.046 of behavioural spread against a 0.030 floor. The full table is in `rules.ts`.
  //
  // It is asserted in BOTH directions on purpose. If a future pass gives Hot Dog a
  // mechanic this fails, and whoever fixes it has to read the record and re-measure the
  // guard — which is the entire point. If a SECOND character is flattened to `plain`, it
  // fails too, and that is a genuine regression.
  {
    const plain = CHARACTER_IDS.filter((id) =>
      CHARACTERS[id].weapons.every((w) => weaponMechanics(w).length === 0));
    check('exactly one kit is entirely plain, and it is Hot Dog — a pinned diagnosis, see rules.ts',
      plain.length === 1 && plain[0] === 'hotdog',
      `entirely plain: [${plain.join(', ')}] — read "KIT DISTINCTIVENESS" in rules.ts before changing this`);
    check('…and it is the rarest tier, which is why DECISIONS §26 asked the question at all',
      CHARACTERS.hotdog.rarity === RARITY_ORDER[RARITY_ORDER.length - 1],
      `hotdog is ${CHARACTERS.hotdog.rarity}, rarest is ${RARITY_ORDER[RARITY_ORDER.length - 1]}`);
  }

  // ── (d) THE SIGNATURE IS A SHAPE, NOT A NUMBER ────────────────────────────
  //
  // (a) is only worth anything if the signature ignores damage and cooldown: two
  // characters differing only in those ARE the same character with different numbers, and
  // a signature that separated them would report a roster of clones as varied. Driven
  // rather than asserted about — this is the instrument-validation rule (`docs/LESSONS.md`
  // §13) applied to a derivation in `rules.ts`.
  {
    const before = kitSignature('hotdog').join(' | ');
    const w = CHARACTERS.hotdog.weapons[0];
    const dmg0 = w.damage, cd0 = w.cooldown;
    // `CHARACTERS` is a plain mutable object at runtime, which is the only reason this is
    // possible. It is restored on the next line and the restoration is itself checked —
    // a fixture that leaves the roster edited would poison every section after it, and
    // this is the last section in the file only by accident.
    w.damage = dmg0 * 3; w.cooldown = cd0 * 3;
    const after = kitSignature('hotdog').join(' | ');
    w.damage = dmg0; w.cooldown = cd0;
    check('tripling a weapon\'s damage and cooldown does NOT change its kit signature',
      after === before, `${before}  ->  ${after}`);
    check('…and the fixture put the weapon back exactly as it found it',
      w.damage === dmg0 && w.cooldown === cd0 && kitSignature('hotdog').join(' | ') === before);
  }
}

// ─────────────────────────────────────────────────────────────────────────────
// 25. THE HAMBURGER ROLE SPLIT — and the rule that is STILL implemented twice
// ─────────────────────────────────────────────────────────────────────────────
//
// `6447a68` found that 8 of the 17 remaining settled matchups involve Hamburger, whose
// halves are **15.0% in the player's hands against 65.6% in the AI's — a 50.6 pp role
// split, twice the next largest in the roster** — and called it *"a vitals/driver
// interaction, not a kit-variety one"*. It was probed with `tools/tmp/burger_lab.mjs`
// (16 selftest assertions, `--roster` reproducing `roster_lab.mjs` 110/110 bit-identical)
// and the answer is TWO separate things pointing in opposite directions. The full record
// is in `rules.ts` under "THE HAMBURGER ROLE SPLIT"; this section pins the four inputs a
// unit test can reach, and (a) is a diagnosis rather than a passing gate.
//
//   MEASURED, 110 matchups x 32 seeds, policy smart2, paired on identical seeds:
//     shipped                        player 15.0%  AI 65.6%   split +50.6 pp
//     AI cannot heal (control)       player 15.0%  AI 11.3%   split  -3.7 pp
//     player heals on ai.ts's rule   player 75.6%  AI 65.6%   split -10.0 pp
//   The split is the SELF-HEAL, proven from both ends — and the driver that cannot press
//   it is the SCRIPTED PLAYER, not `ai.ts`. See `rules.ts`.
{
  console.log('\n25. The Hamburger role split, and the terrain-slow rule (see rules.ts)');

  // ── (a) ⚠️ A PINNED DIAGNOSIS: TERRAIN SLOW REACHES THE PLAYER AND NOT THE AI ──
  //
  // `rules.ts` states the rule twice, in prose, for BOTH ground effects, and both times
  // for *anyone*: "Standing-water hazard: slows anyone inside it" and "Splatter left by
  // `splatter: true` weapons — slows anyone standing in it". It is implemented ONCE, in
  // `sim.ts:moveFighter` (was `movePlayer`), which is the only caller of `terrainSlowFactor()` that scales a
  // speed. `ai.ts:stepAI` builds its own `aiSlowMult` from the STATUS slow alone. So the
  // enemy walks through every puddle and every splat in the game at full speed.
  //
  // This is the fifth instance of this file's oldest shape — a rule stated once in
  // `rules.ts` and implemented twice — and the first one nobody had counted.
  //
  // THE CONTROL IS ONE TICK WIDE, ON PURPOSE. The obvious version (flood the arena, run
  // two whole matches, compare travel per tick) reads the enemy at **ratio 1.096**, above
  // 1, which no movement rule in the sim can produce: a flood slows the player, so the
  // match it produces is a different match. Here both fighters are pinned 900 wu apart —
  // past every weapon in the roster, so the AI is guaranteed to be in its chase-MOVE
  // branch — one tick is stepped, and the only difference between the two runs is the
  // floor. The ratio then has an arithmetic answer and is asserted EXACTLY.
  //
  // Asserted in BOTH directions, in the idiom of §20(d) and §24(c). It is priced and
  // parked, not unknown: the three-line fix was staged and measured (settled 17 -> 19,
  // rarity tier spread 3.98 -> 5.55 pp, aggregate 49.5 -> 50.9%, 36 of 110 cells moved,
  // max |Δ| 34.4 pp) and refused against the hard settled guard. If a future pass lands
  // it, this fails, and whoever fixes it has to read the record and re-measure.
  {
    const oneTick = (hazards) => {
      // `maxSafeRadius` far outside the arena so the ring never steers, and the flood is
      // `kind: 'slow'`, which `dangerSteer` deliberately ignores — so no hazard steering
      // is in play on either side and the tick measures speed and nothing else.
      const state = playingMatch(makeArena({ hazards, maxSafeRadius: 50_000 }), 'hotdog', 'hotdog');
      state.player.x = 600; state.player.y = 1000;
      state.enemy.x = 1500; state.enemy.y = 1000;
      const p0x = state.player.x, p0y = state.player.y, e0x = state.enemy.x, e0y = state.enemy.y;
      stepMatch(state, 16.667, { move: { x: 1, y: 0 }, aim: { x: 1, y: 0 }, selectedWeapon: 0, attack: false });
      return {
        player: Math.hypot(state.player.x - p0x, state.player.y - p0y),
        enemy: Math.hypot(state.enemy.x - e0x, state.enemy.y - e0y),
        seenPlayer: state.player.terrainSlowFactor,
        seenEnemy: state.enemy.terrainSlowFactor,
      };
    };
    const dry = oneTick([]);
    const wet = oneTick([{ x: 1000, y: 1000, radius: 50_000, kind: 'slow', slowFactor: PUDDLE_SLOW_FACTOR }]);

    check('terrain control: both fighters move on a dry floor (a zero makes every ratio vacuous)',
      dry.player > 0 && dry.enemy > 0, `player ${dry.player.toFixed(4)} enemy ${dry.enemy.toFixed(4)} wu/tick`);
    // The SIM ITSELF sees the flood under both fighters. That is what makes the next two
    // checks a statement about who the rule is APPLIED to, not about who is standing in it.
    check('terrain control: the sim observes the flood under BOTH fighters',
      wet.seenPlayer === PUDDLE_SLOW_FACTOR && wet.seenEnemy === PUDDLE_SLOW_FACTOR
      && dry.seenPlayer === 1 && dry.seenEnemy === 1,
      `wet player ${wet.seenPlayer} enemy ${wet.seenEnemy}`);
    check('the PLAYER is slowed by terrain, at exactly PUDDLE_SLOW_FACTOR',
      approx(wet.player / dry.player, PUDDLE_SLOW_FACTOR, 1e-9),
      `ratio ${(wet.player / dry.player).toFixed(9)} vs ${PUDDLE_SLOW_FACTOR}`);
    check('the AI is NOT — a pinned diagnosis, measured and priced; read rules.ts before fixing',
      approx(wet.enemy / dry.enemy, 1, 1e-9),
      `ratio ${(wet.enemy / dry.enemy).toFixed(9)} — if this now reads ${PUDDLE_SLOW_FACTOR} the defect was fixed; `
      + 'update the record in rules.ts and re-measure settled/tier spread');
  }

  // ── (b) THE BLAST RADIUS OF (a), AS A PROPERTY OF `rules.ts` ──────────────
  //
  // Two things make terrain: the arena's `kind: 'slow'` hazards, and the `splatter`
  // weapons. Exactly two weapons in the roster carry `splatter`, so (a) is worth most to
  // exactly two characters — and one of them is Hamburger, which is why it surfaced here.
  {
    const splatters = [];
    for (const id of CHARACTER_IDS) {
      for (const w of CHARACTERS[id].weapons) if (w.splatter) splatters.push(`${id}:${w.key}`);
    }
    check('exactly two weapons in the roster leave a slowing splat, and they are Hamburger\'s and Pizza\'s',
      splatters.length === 2 && splatters.includes('hamburger:Tomato') && splatters.includes('pizza:Tomato'),
      `splatter weapons: [${splatters.join(', ')}]`);
    check('…and a splat is smaller than a fighter, so standing in one is a decision, not an area denial',
      SPLAT_RADIUS < PLAYER_SIZE, `SPLAT_RADIUS ${SPLAT_RADIUS} vs PLAYER_SIZE ${PLAYER_SIZE}`);
  }

  // ── (c) WHY ONE LINE IN AN INSTRUMENT WAS WORTH 50.6 pp, AND ONLY HERE ────
  //
  // `scripted_player.mjs:bestWeapon` opens with `if (w.type === 'self') return;`. That is
  // one line, in one function, and it is the exact mirror of the FIRST defect this file's
  // §19 records (`07a4e3a`: `pickHighestDamageWeapon` skipped `'self'`, so the AI could
  // never heal on the same character the player healed with). It cost 50.6 pp on exactly
  // one character because of the two facts below, and on nobody else because of the first.
  {
    const withSelf = CHARACTER_IDS.filter((id) => CHARACTERS[id].weapons.some((w) => w.type === 'self'));
    check('exactly one character owns a `self` weapon, and it is Hamburger',
      withSelf.length === 1 && withSelf[0] === 'hamburger', `self-weapon owners: [${withSelf.join(', ')}]`);
    // The heal is 25 HP on the SMALLEST pool in the roster. That ratio is the reason the
    // exclusion is worth a role split rather than a rounding error: measured 27.0 HP a
    // match in the AI's hands against 83.4 damage taken — a 32% effective-HP increase.
    const pools = CHARACTER_IDS.map((id) => maxHpFor(id, PLAYER_MAX_HP));
    const heal = CHARACTERS.hamburger.weapons.find((w) => w.type === 'self');
    check('…and it is the roster\'s smallest HP pool, so the heal is worth more to it than to anyone',
      maxHpFor('hamburger', PLAYER_MAX_HP) === Math.min(...pools),
      `hamburger ${maxHpFor('hamburger', PLAYER_MAX_HP)} HP, roster min ${Math.min(...pools)}`);
    // ⚠️ THE OLD ASSERTION, KEPT BECAUSE IT ENCODED A NUMBER THAT HAS BEEN CHANGED ON
    // PURPOSE: `'…the heal restores over a THIRD of that pool in one press'`, i.e.
    // `heal.healAmount / pool > 1/3`. True at `healAmount: 25` (0.357). The driver fix
    // that finally let the player press this weapon measured it at **70.9% strength and a
    // 15.94 pp rarity tier spread**, so `healAmount` was priced down 25 -> 18 (3.06 pp of
    // strength per HP; 18 is the only rung under the ~9 pp spread floor). 18/70 = 0.257.
    // The RATIO is still the point — it is why one line in an instrument was worth 50.6 pp
    // on this character and nothing anywhere else — so the threshold moves rather than
    // going away, and it stays well clear of a rounding error.
    //
    // 🚨 THIS CHECK CONSTRAINS TWO CONSTANTS IN TWO SECTIONS, AND NEITHER SAYS SO, WHICH
    // IS WHY THE FAILURE MESSAGE NOW DERIVES BOTH BOUNDS INSTEAD OF PRINTING TWO NUMBERS:
    //   * `healAmount` must clear a quarter of the pool — at the shipped 70 HP that is
    //     **> 17.5, i.e. 18 or more.** `DECISIONS §28` invites Uri to pick any integer in
    //     15..21, so **15, 16 and 17 turn this red**: the MEASURED range and the ADMISSIBLE
    //     range are not the same range. If he picks one, move the threshold and keep the
    //     old wording (as this check already did once at 1/3), do not move the heal back.
    //   * `rules.ts:HEALTH_PER_STAT` has a FLOOR here too, because Hamburger holds the
    //     roster's minimum health stat and its pool GROWS as that scale shrinks:
    //     100*(1 - 3p) < 4*healAmount gives p > 0.0933 at healAmount 18, against a shipped
    //     0.10. That is the reason the Legendary pass found no sub-point lever.
    const pool = maxHpFor('hamburger', PLAYER_MAX_HP);
    const minHeal = Math.floor(pool / 4) + 1;
    const minPerStat = (PLAYER_MAX_HP - 4 * heal.healAmount)
      / (PLAYER_MAX_HP * (HEALTH_BASELINE_STAT - CHARACTERS.hamburger.stats.health));
    check('…the heal restores over a quarter of that pool in one press',
      heal.healAmount / pool > 1 / 4,
      `${heal.healAmount} of ${pool} HP — this check needs healAmount >= ${minHeal} `
      + `(DECISIONS §28 offers 15..21; ${minHeal > 15 ? `15..${minHeal - 1} are NOT admissible` : 'all admissible'}) `
      + `and HEALTH_PER_STAT > ${minPerStat.toFixed(4)} (shipped ${HEALTH_PER_STAT})`);
  }

  // ── (d) THE SIM LETS THE PLAYER HEAL — so (c) is an INSTRUMENT gap, not a defect ──
  //
  // This is the check that decides which of the two possible stories is true. §19 already
  // proves the AI can heal. If the sim refused the player the same weapon, the 50.6 pp
  // would be a real game defect; it does not, `match.ts` calls
  // `setWeaponCount(weapons.length)` so the slot is bound to key `4` and to the HUD bar,
  // and the gap is entirely in the scripted player used to MEASURE the game.
  {
    const state = playingMatch(makeArena(), 'hamburger', 'donut');
    const onionIndex = CHARACTERS.hamburger.weapons.findIndex((w) => w.type === 'self');
    const heal = CHARACTERS.hamburger.weapons[onionIndex];
    state.player.hp = state.player.maxHp - heal.healAmount;
    const before = state.player.hp;
    const events = stepMatch(state, 0, { move: { x: 0, y: 0 }, selectedWeapon: onionIndex, attack: true });
    check('a hurt PLAYER Hamburger can press its Onion Ring through the ordinary input path',
      state.player.hp === before + heal.healAmount
      && events.some((e) => e.type === 'heal' && e.fighterRole === 'player'),
      `hp ${before} -> ${state.player.hp} (expected +${heal.healAmount})`);
  }

  // ── (e) ⚠️ THE SECOND STALE EXCLUSION — FIXED, AND IT NAMED THE WRONG CAST ─
  //
  // `4105116` proved the authored `damage` field is not what a press delivers — it is
  // per-PELLET, per-PECK, and for a combo weapon it is not the damage at all — and its own
  // commit message says **"both drivers ranked weapons by authored damage"**. It fixed
  // `ai.ts` (`pressValue`, validated against the sim in all 183 cells by §20(b)) and the
  // fix never crossed to `scripted_player.mjs:bestWeapon`. That crossing has now been made
  // (driver rev 4): `bestWeapon` ranks by `pressValue`, and the authored key survives only
  // behind `--damage-ranking-key`, so every pre-fix figure still reproduces byte-identically.
  //
  // ⚠️ THE OLD ASSERTION, KEPT VERBATIM BECAUSE IT PASSED AND WAS WRONG:
  //
  //     check('ranking a kit by authored `damage` picks the wrong weapon for exactly
  //            Taco and Burrito', mis.length === 2 && ...)
  //
  // …over `BANDS` with the FULL kit eligible at every band. That model has no cooldowns in
  // it, and cooldowns are the whole difference: on a live tick the eligible set is a
  // SUBSET, and three more characters flip inside a subset. Measured on real playing ticks
  // across the roster, the two keys disagree for **five** characters, not two — taco 3.7%
  // of ticks, burrito 0.9%, soup 0.6%, waterbottle 0.6%, sushi 0.1% — and `rules.ts` and
  // this file were the two places that said "exactly the two characters that commit named".
  //
  // The mis-rank is therefore enumerated over ELIGIBLE SUBSETS, which is what the driver
  // actually faces. Both directions still: a kit change that adds a sixth, or a driver
  // change that removes one, must come back through here.
  {
    const BANDS = [20, 40, 60, 80, 120, 160, 200, 260];
    const mis = [];
    const pairs = [];
    for (const id of CHARACTER_IDS) {
      const ws = CHARACTERS[id].weapons.filter((w) => w.type !== 'self');
      // Every non-empty subset: a cooldown is exactly "this weapon is not in the set".
      let hit = false;
      for (let m = 1; m < (1 << ws.length); m++) {
        const sub = ws.filter((_, i) => m & (1 << i));
        for (const d of BANDS) {
          const elig = sub.filter((w) => d <= (w.range ?? Infinity));
          if (!elig.length) continue;
          // First-wins on a tie, matching both implementations' strict `>`.
          let byDamage = elig[0], byPress = elig[0];
          for (const w of elig) if ((w.damage ?? 0) > (byDamage.damage ?? 0)) byDamage = w;
          for (const w of elig) if (pressValue(w, d) > pressValue(byPress, d)) byPress = w;
          if (byDamage !== byPress) {
            if (!hit) { mis.push(id); pairs.push(`${id}:${byDamage.key}->${byPress.key}`); hit = true; }
            break;
          }
        }
        if (hit) break;
      }
    }
    const WANT = ['taco', 'burrito', 'sushi', 'soup', 'waterbottle'];
    check('ranking a kit by authored `damage` mis-ranks FIVE characters once cooldowns are in it',
      mis.length === WANT.length && WANT.every((id) => mis.includes(id)),
      `mis-ranked by the damage key: [${mis.join(', ')}] — want [${WANT.join(', ')}]; first cell each: ${pairs.join(' ')}`);
    // …and the claim that the FULL-kit model finds only two, which is why it was believed.
    const misFullKit = [];
    for (const id of CHARACTER_IDS) {
      const ws = CHARACTERS[id].weapons.filter((w) => w.type !== 'self');
      for (const d of BANDS) {
        const elig = ws.filter((w) => d <= (w.range ?? Infinity));
        if (!elig.length) continue;
        let byDamage = elig[0], byPress = elig[0];
        for (const w of elig) if ((w.damage ?? 0) > (byDamage.damage ?? 0)) byDamage = w;
        for (const w of elig) if (pressValue(w, d) > pressValue(byPress, d)) byPress = w;
        if (byDamage !== byPress) { misFullKit.push(id); break; }
      }
    }
    check('…and with EVERY weapon off cooldown it finds only two — that gap is why "two" was believed',
      misFullKit.length === 2 && misFullKit.includes('taco') && misFullKit.includes('burrito'),
      `full-kit model: [${misFullKit.join(', ')}]`);
  }
}

// ─────────────────────────────────────────────────────────────────────────────
// 26. CONCEALMENT — walk-through cover, and the SIXTH instance of `ai.ts`'s defect
// ─────────────────────────────────────────────────────────────────────────────
//
// Uri approved this in `docs/DECISIONS-FOR-URI.md` §18: *"add bushes — but make it
// relevant to kitchen. For example plates you can hide under."* The full rule, its
// derivation, and everything it deliberately does not do are in `rules.ts` under
// "CONCEALMENT". This section is the behavioural half, and it exists because a probe found
// the defect ALREADY ARMED before a line was written: `stepAI` read the player's true
// position at three independent sites and one of them — the chase nav target — was a
// DIRECT read rather than something derived from the other two.
//
// An implementation that reached two of three produces an AI that FACES where it last saw
// you while WALKING to where you actually are. It looks correct on screen. It is the same
// asymmetry as the stun-silence defect (§20(d): stunned player fires 100% of its shots,
// stunned AI 0%) and it would be the SIXTH instance of this file's oldest shape.
//
// Every check below that could pass vacuously carries its ABLATION: the identical
// experiment with the `concealment` list removed, which must come out the other way. A
// concealment test on a sim that ignores concealment passes trivially, and that is the
// exact failure mode `docs/LESSONS.md` §13 is about.
{
  console.log('\n26. Concealment: walk-through, the three AI sites, and the fourth outside ai.ts');

  const REVEAL = CONCEAL_REVEAL_RADIUS;
  /** Nothing steers off the ring or a hazard in this section; only concealment is in play. */
  const openArena = (concealment) => makeArena({ maxSafeRadius: 50_000, concealment });
  /** A bare fighter for the movement-layer checks — no match, no AI, no `stepMatch`. */
  const createFighterLike = () =>
    createFighter({ id: 0, controller: 'human', characterId: 'hamburger', spawn: { x: 0, y: 0 },
      maxHp: 100, size: PLAYER_SIZE, hitRadius: HIT_RADIUS_VS_PLAYER, facing: { x: 1, y: 0 } });

  // ── (a) INERT WHEN ABSENT ─────────────────────────────────────────────────
  //
  // The mechanism's whole licence to exist is that an arena without it is unchanged. The
  // tick-for-tick proof over 110 matchups x 32 seeds is `tools/tmp/conceal_lab.mjs --bitid`
  // (0 differing ticks against the previous commit, in 8.6M ticks); this is the part a
  // unit test can hold, and it is what makes that tool's `0 concealment` header meaningful.
  {
    const state = playingMatch(makeArena(), 'pizza', 'soup');
    check('an arena with no `concealment` field conceals nobody',
      !isConcealed(state.player.x, state.player.y, state.arena)
      && !isConcealed(state.enemy.x, state.enemy.y, state.arena));
    let everConcealed = false;
    let beliefEverStale = false;
    for (let i = 0; i < 400; i++) {
      stepMatch(state, 16.667, { move: { x: 1, y: 0.3 }, aim: { x: 1, y: 0 }, selectedWeapon: 0, attack: true });
      if (state.player.concealed || state.enemy.concealed) everConcealed = true;
      if (state.aiSighting.x !== state.player.x || state.aiSighting.y !== state.player.y) beliefEverStale = true;
    }
    check('…so `Fighter.concealed` is false on both sides for a whole 400-tick match', !everConcealed);
    check('…and the AI\'s belief equals the player\'s TRUE position on every one of those ticks',
      !beliefEverStale, `belief (${state.aiSighting.x}, ${state.aiSighting.y}) vs player (${state.player.x}, ${state.player.y})`);
  }

  // ── (b) WALK-THROUGH IS PROVEN BY WALKING ─────────────────────────────────
  //
  // The inverse of a failure mode this repo has already paid for: `?px=850&py=500` spawns a
  // 42 wu fighter INSIDE `spice_cart`, and every step out of it is refused, forever, with
  // no event and nothing in the HUD — "total, silent, and indistinguishable from the
  // controls stopping working" (`movement.ts:escapeCover`). A concealment region that
  // accidentally reached `arena.cover` would do exactly that, in a prop the player has been
  // told they can hide in.
  {
    const boxes = [
      { x: 400, y: 400, w: 80, h: 80, kind: 'small' },
      { x: 900, y: 400, w: 300, h: 60, kind: 'band' },
      { x: 1400, y: 900, w: 240, h: 240, kind: 'patch' },
    ];
    const arena = openArena(boxes);
    let refused = 0;
    let stepsTaken = 0;
    let everInside = false;
    for (const b of boxes) {
      const f = { ...createFighterLike(), x: b.x - b.w / 2 - PLAYER_SIZE, y: b.y };
      // Walk east across the centre, in steps of a third of a body, past the far edge.
      const steps = Math.ceil((b.w + 2 * PLAYER_SIZE) / (PLAYER_SIZE / 3));
      for (let i = 0; i < steps; i++) {
        if (!tryMove(f, PLAYER_SIZE / 3, 0, arena)) refused++;
        stepsTaken++;
        if (isConcealed(f.x, f.y, arena)) everInside = true;
      }
    }
    check('a fighter crosses the centre of EVERY concealment box without one refused step',
      refused === 0 && stepsTaken > 40, `${refused} of ${stepsTaken} steps refused`);
    check('…and it really was inside them (a walk that missed every box would pass vacuously)',
      everInside);

    // The nav grid is built from `arena.cover` and must not have noticed. Compared by
    // COUNT rather than by reading the source, because "nobody wired it in" is an
    // assertion about a person and this is an assertion about the program.
    const empty = openArena();
    const probe = createFighterLike();
    moveToward(probe, 1, 0, 1, empty, 1800, 900);
    const passableWithout = navStats.passable;
    const probe2 = createFighterLike();
    moveToward(probe2, 1, 0, 1, arena, 1800, 900);
    check('the navigation grid has exactly as many passable cells with concealment as without',
      navStats.passable === passableWithout, `${navStats.passable} vs ${passableWithout}`);
  }

  // ── (c) MEMBERSHIP IS THE FIGHTER'S CENTRE ────────────────────────────────
  {
    const arena = openArena([{ x: 700, y: 500, w: 100, h: 100 }]);
    check('the centre of a region conceals', isConcealed(700, 500, arena));
    check('…1 wu inside its edge conceals, 1 wu outside does not — it is a centre test, not an AABB overlap',
      isConcealed(749, 500, arena) && !isConcealed(751, 500, arena));
    check('…so a fighter brushing the corner by half a body is NOT hidden (the render/sim mismatch that would cause)',
      !isConcealed(700 + 50 + PLAYER_SIZE / 2 - 1, 500, arena));
  }

  // ── (d) THE REVEAL RADIUS IS DERIVED FROM THE REACH LADDER ────────────────
  //
  // Asserted as the two INEQUALITIES the derivation rests on rather than as the literal, so
  // a rung change surfaces as a real behavioural failure instead of a stale constant. See
  // `rules.ts:CONCEAL_REVEAL_RADIUS`.
  {
    // ⚠️ THE ORIGINAL WORDING OF THIS ASSERTION WAS "every MELEE weapon in the roster
    // reaches no further than a target can be seen", AND IT FAILED ON ITS FIRST RUN —
    // `reveal 84, longest melee 400`. Kept above the corrected version because the failure
    // is the finding: Lollipop's Giant Lollipop is a `melee` weapon at `REACH.ultimateSlam`
    // (400 wu), which `rules.ts` states is DELIBERATELY NOT ON THE LADDER — it is anchored
    // to the ARENA ("hits the whole map") and is excluded from `render/camera.ts`'s
    // fair-play radius for exactly that reason. So the derivation holds for the ladder and
    // has ONE declared exception, rather than being a claim about every weapon.
    const LADDER_MELEE = CHARACTER_IDS.flatMap((id) => CHARACTERS[id].weapons
      .filter((w) => w.type === 'melee' && (w.range ?? 0) <= REACH.rangedMax));
    check('every melee weapon ON THE REACH LADDER reaches no further than a target can be seen',
      LADDER_MELEE.every((w) => (w.range ?? 0) <= REVEAL),
      `reveal ${REVEAL}, longest ladder melee ${Math.max(...LADDER_MELEE.map((w) => w.range ?? 0))}`);
    // The exception, named and pinned — so it cannot grow a second member unnoticed.
    const OFF_LADDER = CHARACTER_IDS.flatMap((id) => CHARACTERS[id].weapons
      .filter((w) => (w.range ?? 0) > REACH.rangedMax).map((w) => `${id}:${w.key}`));
    check('…and exactly ONE weapon is off the ladder and can therefore strike an unseen target',
      OFF_LADDER.length === 1 && OFF_LADDER[0] === 'lollipop:Giant',
      `off-ladder: [${OFF_LADDER.join(', ')}] at ${REACH.ultimateSlam} wu vs reveal ${REVEAL}`);
    check('…and the shortest RANGED weapon out-reaches it, so concealment always denies a full rung',
      REVEAL < Math.min(...CHARACTER_IDS.flatMap((id) => CHARACTERS[id].weapons
        .filter((w) => w.type === 'ranged').map((w) => w.range ?? Infinity))),
      `reveal ${REVEAL} vs REACH.rangedClose ${REACH.rangedClose}`);
    const arena = openArena([{ x: 700, y: 500, w: 100, h: 100 }]);
    check('visibility is a distance test only for a CONCEALED target',
      isVisibleFrom(0, 0, 100, 100, arena) && !isVisibleFrom(700 + REVEAL + 1, 500, 700, 500, arena)
      && isVisibleFrom(700 + REVEAL - 1, 500, 700, 500, arena));
  }

  // ── (e) ⚠️ THE THREE SITES IN `stepAI`, IN ONE EXPERIMENT, WITH ITS ABLATION ──
  //
  // The player is seen at A, then teleported into a bush at B on the OPPOSITE side of the
  // enemy. A correct AI keeps walking to A and keeps facing A. An AI that routed `adx/ady`
  // and missed the nav target walks to B while facing A — which is why the check is on
  // POSITION and on FACING separately, and why the ablation must reverse BOTH.
  {
    const run = (concealed) => {
      const A = { x: 1000, y: 400 };
      const B = { x: 1000, y: 1600 };
      const arena = openArena(concealed ? [{ x: B.x, y: B.y, w: 300, h: 300 }] : undefined);
      const state = playingMatch(arena, 'hamburger', 'donut');
      state.player.x = A.x; state.player.y = A.y;
      state.enemy.x = 1000; state.enemy.y = 1000;
      // One tick with the player in the open: the enemy SEES it at A.
      stepMatch(state, 16.667, noInput);
      const sightedAtA = state.aiSighting.x === A.x && state.aiSighting.y === A.y;
      // Now the player is at B — 600 wu the other way, inside the bush when `concealed`.
      state.player.x = B.x; state.player.y = B.y;
      const y0 = state.enemy.y;
      for (let i = 0; i < 60; i++) stepMatch(state, 16.667, noInput);
      return {
        sightedAtA,
        movedNorth: state.enemy.y < y0 - 1,
        movedSouth: state.enemy.y > y0 + 1,
        facingNorth: state.enemy.facing.y < 0,
        belief: { ...state.aiSighting },
        A, B,
      };
    };
    const hidden = run(true);
    const seen = run(false);

    check('control: the enemy sighted the player at A before it moved',
      hidden.sightedAtA && seen.sightedAtA);
    check('SITE 3 (the chase nav target): a concealed player is chased to where it was LAST SEEN',
      hidden.movedNorth && !hidden.movedSouth,
      `belief (${hidden.belief.x}, ${hidden.belief.y}) — expected A (${hidden.A.x}, ${hidden.A.y})`);
    check('SITE 2 (facing/aim): …and the enemy faces that stale point, not the player',
      hidden.facingNorth);
    check('ABLATION: with the SAME experiment and no concealment, it turns round and chases the truth',
      seen.movedSouth && !seen.movedNorth && !seen.facingNorth,
      `belief (${seen.belief.x}, ${seen.belief.y}) — expected B (${seen.B.x}, ${seen.B.y})`);
    check('…and the belief itself is frozen at A while concealed, and tracks B while not',
      hidden.belief.x === hidden.A.x && hidden.belief.y === hidden.A.y
      && seen.belief.x === seen.B.x && seen.belief.y === seen.B.y);
  }

  // ── (f) SITE 1, AND THE DEADLOCK IT WOULD OTHERWISE BUILD ─────────────────
  //
  // `visible`, not believed separation, gates the shot. Without that, an AI that walks to
  // the last-seen point arrives with a believed separation of ~0, every weapon passes the
  // range test, and the CHASE branch fires instead of moving — permanently, at an empty
  // patch of floor. It would register as "engaged" on `match-sim.mjs`'s stall detector,
  // which wants a 15 wu span and this stands perfectly still. §13's lesson exactly.
  {
    // Derived from the ladder, never hardcoded: a separation strictly between the reveal
    // radius and the character's own longest normal reach, so the weapon is in range and
    // the target is not in sight.
    const reachOf = (id) => Math.max(...CHARACTERS[id].weapons
      .filter((w) => (w.range ?? 0) <= REACH.rangedMax).map((w) => w.range ?? 0));
    // No `self` weapon, because the HEAL is deliberately NOT gated on sight (it targets the
    // caster) and would put `weapon-fired` events into the count that are not shots.
    const shooter = CHARACTER_IDS.find((id) => reachOf(id) > REVEAL + 10
      && !CHARACTERS[id].weapons.some((w) => w.type === 'self'));
    const sep = (REVEAL + reachOf(shooter)) / 2;
    const P = { x: 700, y: 500 };

    // ⚠️ PINNED ON BOTH SIDES, and the first version of this check was NOT — it pinned only
    // the player, the enemy walked in, crossed the reveal radius on its own, and fired 6
    // shots. The code was right and the experiment was wrong. Holding the separation is
    // what makes this a test of the RANGE GATE rather than of the chase.
    const shots = (concealed) => {
      const arena = openArena(concealed ? [{ x: P.x, y: P.y, w: 120, h: 120 }] : undefined);
      const state = playingMatch(arena, 'donut', shooter);
      let fired = 0;
      for (let i = 0; i < 120; i++) {
        state.player.x = P.x; state.player.y = P.y;
        state.enemy.x = P.x + sep; state.enemy.y = P.y;
        state.player.hp = state.player.maxHp;
        const evs = stepMatch(state, 16.667, noInput);
        fired += evs.filter((e) => e.type === 'weapon-fired' && e.fighterRole === 'enemy').length;
      }
      return fired;
    };
    check(`SITE 1 (range gating): a ${shooter} at ${sep.toFixed(0)} wu — in weapon range, out of sight — does not fire`,
      shots(true) === 0, `${shots(true)} shots`);
    check('ABLATION: the same character at the same separation with no concealment fires freely',
      shots(false) > 0, `${shots(false)} shots`);

    // ── THE DEADLOCK GUARD, AND THE SIZE LIMIT IT DERIVES FOR THE ARENA ──────
    //
    // The outcome question rather than the symptom one (`docs/LESSONS.md` §13). A believed
    // separation of ~0 at the stale point would let every weapon pass the range test and
    // the chase branch would fire forever at empty floor; `visible` prevents that, so the
    // AI walks instead. The question that decides whether the mechanic is playable is what
    // happens when it ARRIVES.
    //
    // ⚠️ THIS FILE'S FIRST DRAFT ASSERTED "IT ALWAYS RE-ACQUIRES" AND FAILED — final
    // separation 363 wu, never sighted. THE ASSERTION WAS WRONG AND THE BEHAVIOUR IS REAL:
    // **the AI has no search. It walks to the last-seen point and stops.** So whether
    // concealment is a delay or a permanent denial is a property of REGION SIZE, and it has
    // an exact answer rather than a judgement:
    //
    //   the AI arrives at the point where it last saw you and can see `CONCEAL_REVEAL_RADIUS`
    //   from there, so a player who can get FURTHER THAN THAT from their entry point while
    //   staying concealed is invisible for the rest of the match.
    //
    // => CONSTRAINT FOR THE ARENA OWNER, and it agrees with the probe's grain finding
    // independently: concealment wants MANY SMALL patches (no interior point more than
    // ~84 wu from where a fighter would have entered), not a few large blobs. A single
    // 300 wu bush is not more cover, it is a permanent AI-denial zone.
    const hideAndSlide = (offset) => {
      // Seen in the open first, so the belief is correct — which is the reachable case. A
      // player concealed since spawn has never been seen at all and the AI walks to
      // `playerSpawn`; that is a strictly worse case and is not what a real match produces.
      const state = playingMatch(openArena(), 'donut', shooter);
      state.player.x = P.x; state.player.y = P.y;
      // 300 wu, not 600: at `AI_CHASE_SPEED` x a character speed multiplier a 600 wu walk
      // takes ~550 ticks and the first draft of this ran 500, so the AI was still WALKING
      // when the loop ended and "never re-acquired" was an artefact of the budget rather
      // than a property of the AI. The horizon is now ~2x the walk.
      state.enemy.x = P.x + 300; state.enemy.y = P.y;
      stepMatch(state, 16.667, noInput);
      const seenAt = { x: state.aiSighting.x, y: state.aiSighting.y };
      // The region appears around the player (modelling "the player walked into it"), and
      // the player slides `offset` deeper inside it.
      state.arena = openArena([{ x: P.x, y: P.y, w: 800, h: 800 }]);
      const hideX = P.x - offset;
      let moved = 0;
      let reacquired = false;
      for (let i = 0; i < 500; i++) {
        const before = { x: state.enemy.x, y: state.enemy.y };
        stepMatch(state, 16.667, noInput);
        state.player.x = hideX; state.player.y = P.y;
        state.player.hp = state.player.maxHp;
        if (state.enemy.x !== before.x || state.enemy.y !== before.y) moved++;
        if (state.aiSighting.at === state.elapsed) reacquired = true;
      }
      return {
        moved, reacquired, seenAt,
        arrived: Math.hypot(state.enemy.x - seenAt.x, state.enemy.y - seenAt.y),
      };
    };
    const near = hideAndSlide(REVEAL * 0.5);
    const far = hideAndSlide(REVEAL * 2);

    check('…a blind AI MOVES rather than standing still shooting a ghost',
      near.moved > 100 && far.moved > 100, `${near.moved} / ${far.moved} of 500 ticks`);
    check('…and it walks all the way to the point where it last saw the player',
      near.arrived < REVEAL && far.arrived < REVEAL,
      `arrived within ${near.arrived.toFixed(1)} / ${far.arrived.toFixed(1)} wu of the sighting`);
    check(`…a player hiding WITHIN ${REVEAL} wu of where it was last seen is found again`,
      near.reacquired);
    check(`⚠️ …and one hiding FURTHER than ${REVEAL} wu is never found — the AI has no search. `
      + 'This is the region-SIZE limit, not a bug: keep concealment patches small.',
      !far.reacquired);
  }

  // ── (g) SITE 4 — THE READER OUTSIDE `ai.ts` ───────────────────────────────
  //
  // Homing projectiles re-aim at `target.x/target.y` every tick in `sim.ts:stepProjectiles`.
  // Miss this and concealment works for the melee half of the roster and visibly fails for
  // the homing half — a volley curving into a bush after a target its owner cannot see.
  {
    const homingId = CHARACTER_IDS.find((id) => CHARACTERS[id].weapons.some((w) => w.homing));
    const homingIndex = CHARACTERS[homingId].weapons.findIndex((w) => w.homing);

    const run = (concealed) => {
      // One big region containing the target's whole path, so the answer cannot depend on
      // exactly where the target ends up.
      const arena = openArena(concealed ? [{ x: 1200, y: 700, w: 800, h: 800 }] : undefined);
      const state = playingMatch(arena, homingId, 'donut');
      state.player.x = 300; state.player.y = 500; state.player.facing = { x: 1, y: 0 };
      state.enemy.x = 1200; state.enemy.y = 500;
      // Rooted, so the AI cannot walk out from under the experiment. It still aims and
      // fires — §20(d)'s rule — which is deliberate: the control has to be a real match.
      state.enemy.status.stunnedUntil = Infinity;
      const evs = [];
      attemptAttack(state, state.player, homingIndex, evs);
      const mine = state.projectiles.filter((p) => p.ownerRole === 'player').map((p) => p.id);
      const vy0 = state.projectiles.filter((p) => mine.includes(p.id)).map((p) => p.vy);
      // The target steps 400 wu off the projectiles' axis, deep inside the region.
      state.enemy.y = 900;
      let vyLast = vy0;
      for (let i = 0; i < 8; i++) {
        stepMatch(state, 16.667, noInput);
        state.enemy.x = 1200; state.enemy.y = 900;
        const live = state.projectiles.filter((p) => mine.includes(p.id));
        if (live.length === mine.length) vyLast = live.map((p) => p.vy);
      }
      return { vy0, vyLast, count: mine.length };
    };
    const hidden = run(true);
    const seen = run(false);

    check('control: the homing weapon actually spawned projectiles',
      hidden.count > 0 && seen.count === hidden.count, `${hidden.count} projectiles`);
    check('SITE 4 (homing): a volley does NOT curve toward a target its owner cannot see',
      hidden.vyLast.every((v, i) => v === hidden.vy0[i]),
      `vy ${JSON.stringify(hidden.vy0)} -> ${JSON.stringify(hidden.vyLast)}`);
    check('ABLATION: the same volley DOES curve when the target is in the open',
      seen.vyLast.some((v, i) => v !== seen.vy0[i]),
      `vy ${JSON.stringify(seen.vy0)} -> ${JSON.stringify(seen.vyLast)}`);
  }

  // ── (h) CONCEALMENT IS NOT INTANGIBILITY, AND NOT A ROLL ──────────────────
  //
  // Nothing in `combat.ts` reads concealment. A shot aimed at a hidden fighter that
  // connects, connects — which is what makes this deterministic instead of an accuracy
  // roll. `grep -rn 'Math.random' src/game/{sim,state,combat,ai,movement}.ts` must stay
  // empty; the sim's determinism underwrites every balance number in the project.
  {
    const arena = openArena([{ x: 0, y: 0, w: 4000, h: 4000 }]); // the whole map is a bush
    const state = playingMatch(arena, 'hamburger', 'donut');
    const smashIndex = CHARACTERS.hamburger.weapons.findIndex((w) => w.key === 'Smash');
    state.player.x = 0; state.player.y = 0; state.player.facing = { x: 1, y: 0 };
    state.enemy.x = SMASH_IN_RANGE; state.enemy.y = 0;
    // ⚠️ THE VACUITY CONTROL HAD TO MOVE BEFORE THE SWING, AND THE OLD ONE FAILING IS
    // WHY THIS SECTION IS TRUSTWORTHY. It used to read, AFTER the tick:
    //
    //     check('…and both fighters are observed as concealed, so the check is not vacuous',
    //       state.player.concealed && state.enemy.concealed);
    //
    // Under DECISIONS §29c that is now FALSE BY DESIGN — the swing destroys the one region
    // in this fixture, so neither fighter is concealed once the tick has run. It failed on
    // the first run of the §29c build and it was RIGHT to: a control asserted after the
    // event it controls for is measuring the wrong instant. Kept above rather than deleted
    // because the failure is the record of when the rule changed.
    check('control: both fighters ARE concealed before the swing, so the hit below is not vacuous',
      isHidden(state.player.x, state.player.y, arena, state, state.player)
      && isHidden(state.enemy.x, state.enemy.y, arena, state, state.enemy));
    const evs = stepMatch(state, 0, { move: { x: 0, y: 0 }, selectedWeapon: smashIndex, attack: true });
    check('a concealed fighter still takes the hit — concealment hides, it does not protect',
      evs.some((e) => e.type === 'hit-landed' && e.targetRole === 'enemy')
      && state.enemy.hp === state.enemy.maxHp - 12);
  }

  // ── (i) THE ENDGAME KEEPOUT, AND THE GUARD SHOWN TO FAIL ──────────────────
  //
  // ⚠️ `tools/tmp/arena_probe.mjs --occl` derives its occlusion series from `arena.cover`
  // ONLY, and `--verify`'s normaliser compares `{w,h,c,msr,ps,es,cover,hz}`. Both would
  // report a bush placed in the hub as MATCH — the arena's own guard is blind to this
  // feature. `kitchen.ts`'s rule 1 exists because measured occlusion once ROSE 30.6% ->
  // 67.7% as the ring closed, and the whole layout was rebuilt to fix it.
  {
    const R = 993; // the shipped kitchen's derived maxSafeRadius
    const keepout = concealmentKeepoutRadius(R);
    check('the keepout is derived from the ring, not picked, and lands where the endgame is fought',
      approx(keepout, Math.max(MIN_SAFE_RADIUS, R * (1 - CONCEAL_ENDGAME_PROGRESS))) && keepout > MIN_SAFE_RADIUS,
      `maxSafeRadius ${R} -> ${keepout.toFixed(2)} wu (floor ${MIN_SAFE_RADIUS})`);
    const centre = makeArena({ maxSafeRadius: R, concealment: [{ x: 1000, y: 1000, w: 100, h: 100 }] });
    check('the guard FAILS on a hub-placed region — a guard not shown to fail is not a guard',
      concealmentKeepoutViolations(centre).length === 1);
    const lane = makeArena({ maxSafeRadius: R, concealment: [{ x: 300, y: 300, w: 100, h: 100 }] });
    check('…and PASSES a region out on the lanes',
      concealmentKeepoutViolations(lane).length === 0);
    // NEAREST POINT, not centre: a long band whose centre is legal can still reach the hub.
    const band = makeArena({ maxSafeRadius: R, concealment: [{ x: 1000 - keepout - 100, y: 1000, w: 400, h: 60 }] });
    check('…and catches a BAND whose centre is legal but whose near edge is not',
      concealmentInsideRadius(band, keepout).length === 1);
    check('the SHIPPED arena has no concealment yet, so no arena can be failing this today',
      concealmentKeepoutViolations(makeArena()).length === 0);
  }

  // ── (j) ⚠️ DECISIONS §29c — ATTACKING BREAKS THE COVER AND REVEALS YOU ─────
  //
  // Uri, verbatim: *"attacking from under it will break it and reveal you. You can also
  // step out and attack."* Two mechanically separate consequences, tested separately
  // because they answer different questions and can fail independently:
  //
  //   DESTRUCTION is about the OBJECT. It is permanent for the match, it is per-region and
  //   not per-fighter (a shattered plate hides nobody, including the opponent), and it must
  //   NOT touch the shared `ArenaDefinition` — one arena object serves every match a
  //   process runs, so a plate broken on the arena would stay broken for the session.
  //
  //   THE REVEAL is about the FIGHTER. It expires, and it is what stops "break a plate,
  //   step 90 wu into the next one, vanish inside one tick" — the size constraint in (f)
  //   guarantees those patches are close together.
  {
    const P = { x: 700, y: 500 };
    const smashIndex = CHARACTERS.hamburger.weapons.findIndex((w) => w.key === 'Smash');
    const attackInput = { move: { x: 0, y: 0 }, selectedWeapon: smashIndex, attack: true };
    // ⚠️ A NEUTRAL PROBE, and the first draft of this section did not have one.
    //
    // "Is this point still cover?" was originally asked with `state.enemy` as the target,
    // and two checks failed for a reason that is worth keeping: THE AI FIRES TOO. `stepAI`
    // runs inside the same `stepMatch`, the enemy took its own shot, and its own reveal
    // window then answered a question that was supposed to be about the REGION. Asking
    // about a fighter is never a neutral way to ask about a plate; this is.
    const NEVER_ATTACKED = { revealedUntil: -Infinity };
    /** One box under the player, one 400 wu away that no attack ever touches. */
    const twoPlates = () => [
      { x: P.x, y: P.y, w: 120, h: 120, kind: 'plate' },
      { x: P.x + 400, y: P.y, w: 120, h: 120, kind: 'spare' },
    ];

    check('the reveal duration IS the workhorse projectile\'s flight time, not a picked number',
      CONCEAL_ATTACK_REVEAL_MS === FLIGHT_MS.normal && CONCEAL_ATTACK_REVEAL_MS > 0,
      `CONCEAL_ATTACK_REVEAL_MS ${CONCEAL_ATTACK_REVEAL_MS} vs FLIGHT_MS.normal ${FLIGHT_MS.normal}`);

    // ── The whole rule, in one tick, from under a plate ──────────────────────
    {
      const boxes = twoPlates();
      const arena = openArena(boxes);
      const state = playingMatch(arena, 'hamburger', 'donut');
      state.player.x = P.x; state.player.y = P.y;
      state.enemy.x = P.x; state.enemy.y = P.y + 40; // inside the same plate
      check('control: the attacker is hidden, and so is the opponent sharing its plate',
        isHidden(state.player.x, state.player.y, arena, state, state.player)
        && isHidden(state.enemy.x, state.enemy.y, arena, state, state.enemy));

      const evs = stepMatch(state, 16.667, attackInput);
      const broke = evs.filter((e) => e.type === 'concealment-broken');
      check('attacking from under a plate DESTROYS it — one `concealment-broken`, carrying its geometry',
        broke.length === 1 && broke[0].x === boxes[0].x && broke[0].y === boxes[0].y
        && broke[0].w === boxes[0].w && broke[0].h === boxes[0].h
        && broke[0].kind === 'plate' && broke[0].ownerRole === 'player',
        JSON.stringify(broke));
      check('…and the destroyed box is the one recorded on the match, by reference',
        state.brokenConcealment.length === 1 && state.brokenConcealment[0] === boxes[0]);
      check('…so the attacker is no longer hidden by it',
        !isHidden(state.player.x, state.player.y, arena, state, state.player)
        && !state.player.concealed);
      check('…and NEITHER IS THE OPPONENT standing in the same plate — the OBJECT broke, not the attacker\'s cover',
        !isHidden(state.enemy.x, state.enemy.y, arena, state, NEVER_ATTACKED));
      check('…while the plate 400 wu away still conceals — destruction is per-region, not global',
        isHidden(P.x + 400, P.y, arena, state, NEVER_ATTACKED));
      check('the attacker is REVEALED for exactly one flight time, on the match clock',
        state.player.revealedUntil === state.elapsed + CONCEAL_ATTACK_REVEAL_MS,
        `revealedUntil ${state.player.revealedUntil}, elapsed ${state.elapsed}`);

      // A SECOND match on the SAME arena object must start with the plate intact. This is
      // the assertion that would fail if destruction were a mutation of `arena.concealment`
      // — and it is the failure mode that would have been invisible in a single match and
      // catastrophic across `roster_lab`'s 3,520.
      const next = playingMatch(arena, 'hamburger', 'donut');
      check('⚠️ a FRESH match on the same arena object starts with every plate intact',
        next.brokenConcealment.length === 0
        && isHidden(P.x, P.y, arena, next, next.player)
        && concealmentOf(arena).length === 2,
        `broken ${next.brokenConcealment.length}, regions ${concealmentOf(arena).length}`);
    }

    // ── ABLATION: attacking from the OPEN keeps the plate ────────────────────
    //
    // Uri's second sentence — *"You can also step out and attack"* — is a mechanic only if
    // this comes out the other way. Same arena, same weapon, same tick, attacker moved off
    // the box.
    {
      const boxes = twoPlates();
      const arena = openArena(boxes);
      const state = playingMatch(arena, 'hamburger', 'donut');
      state.player.x = P.x + 200; state.player.y = P.y; // in the open, between the plates
      state.enemy.x = P.x + 200; state.enemy.y = P.y + 60;
      check('control: the attacker is NOT hidden before this attack',
        !isHidden(state.player.x, state.player.y, arena, state, state.player));
      const evs = stepMatch(state, 16.667, attackInput);
      check('ABLATION: attacking from the OPEN destroys nothing — the plate survives to be used later',
        !evs.some((e) => e.type === 'concealment-broken') && state.brokenConcealment.length === 0
        && isHidden(P.x, P.y, arena, state, NEVER_ATTACKED));
      check('…but it STILL reveals: you cannot fire and then dive into cover in the same second',
        state.player.revealedUntil === state.elapsed + CONCEAL_ATTACK_REVEAL_MS);
    }

    // ── THE REVEAL IS A STATE, AND IT EXPIRES ───────────────────────────────
    //
    // The measurement that decides whether the window is a mechanic or a rounding error:
    // walk the clock across it with the fighter standing still inside an untouched plate.
    {
      const arena = openArena(twoPlates());
      const state = playingMatch(arena, 'hamburger', 'donut');
      state.player.x = P.x + 200; state.player.y = P.y;
      stepMatch(state, 16.667, attackInput); // fired from the open — the plate survives
      // Now step into the plate it never broke.
      state.player.x = P.x; state.player.y = P.y;
      const hiddenDuring = [];
      const t0 = state.elapsed;
      for (let i = 0; i < 80; i++) {
        stepMatch(state, 16.667, noInput);
        hiddenDuring.push({
          dt: state.elapsed - t0,
          hidden: isHidden(state.player.x, state.player.y, arena, state, state.player),
        });
      }
      const lastExposed = hiddenDuring.filter((r) => !r.hidden).at(-1);
      const firstHidden = hiddenDuring.find((r) => r.hidden);
      check('a fighter that just fired stays exposed inside a plate it did not break…',
        !hiddenDuring[0].hidden && lastExposed !== undefined);
      check(`…and is hidden again once ${CONCEAL_ATTACK_REVEAL_MS} ms have passed, within one tick of it`,
        firstHidden !== undefined
        && Math.abs(firstHidden.dt - CONCEAL_ATTACK_REVEAL_MS) <= 16.667
        && lastExposed.dt < CONCEAL_ATTACK_REVEAL_MS,
        `last exposed at +${lastExposed?.dt.toFixed(1)} ms, first hidden at +${firstHidden?.dt.toFixed(1)} ms`);
    }

    // ── OVERLAPPING PLATES BOTH BREAK ───────────────────────────────────────
    //
    // Breaking only the first containing region leaves the attacker still hidden by the
    // second: a plate spent for nothing, which is the incoherent middle state §29c removes.
    // Nothing in the data model forbids two plates touching and the size constraint pushes
    // the layout toward many small ones, so this is reachable, not theoretical.
    {
      const boxes = [
        { x: P.x, y: P.y, w: 120, h: 120, kind: 'a' },
        { x: P.x + 30, y: P.y, w: 120, h: 120, kind: 'b' },
      ];
      const arena = openArena(boxes);
      const state = playingMatch(arena, 'hamburger', 'donut');
      state.player.x = P.x; state.player.y = P.y;
      // ⚠️ THE ENEMY IS PARKED OUT OF EVERY WEAPON'S RANGE, and the first draft did not do
      // that. With the enemy sharing the plates, a `break` after the first region STILL
      // produced two `concealment-broken` events in the tick — one from each fighter — and
      // the mutant passed. Ownership is now asserted as well, so the check cannot be
      // satisfied by the other fighter doing half the work.
      state.enemy.x = 100; state.enemy.y = 100;
      const evs = stepMatch(state, 16.667, attackInput);
      const broke = evs.filter((e) => e.type === 'concealment-broken');
      check('EVERY overlapping plate containing the attacker breaks, not just the first',
        broke.length === 2 && broke.every((e) => e.ownerRole === 'player')
        && state.brokenConcealment.length === 2,
        `${broke.length} events from [${[...new Set(broke.map((e) => e.ownerRole))].join(', ')}]`);
      check('…so the attacker is genuinely exposed rather than still hidden by the second one',
        !isHidden(state.player.x, state.player.y, arena, state, NEVER_ATTACKED));
    }

    // ── AND A PLATE IS SPENT ONCE, NOT ONCE PER SHOT ────────────────────────
    {
      const arena = openArena([{ x: P.x, y: P.y, w: 120, h: 120, kind: 'plate' }]);
      const state = playingMatch(arena, 'hamburger', 'donut');
      state.player.x = P.x; state.player.y = P.y;
      let broke = 0;
      for (let i = 0; i < 200; i++) {
        state.player.x = P.x; state.player.y = P.y;
        broke += stepMatch(state, 16.667, attackInput)
          .filter((e) => e.type === 'concealment-broken').length;
      }
      check('a plate emits `concealment-broken` exactly ONCE however many shots follow',
        broke === 1 && state.brokenConcealment.length === 1, `${broke} events`);
    }

    // ── THE PREDICATE ITSELF, WITHOUT A MATCH AROUND IT ─────────────────────
    //
    // `breakConcealment` is the only writer of `brokenConcealment`; asserted directly so a
    // failure upstream in `attemptAttack` cannot be confused with a failure in the geometry.
    {
      const boxes = twoPlates();
      const arena = openArena(boxes);
      const broken = [];
      const first = breakConcealment(P.x, P.y, arena, broken);
      const again = breakConcealment(P.x, P.y, arena, broken);
      const miss = breakConcealment(P.x, P.y + 2000, arena, broken);
      check('breakConcealment returns what it destroyed, is idempotent, and destroys nothing at a point in the open',
        first.length === 1 && first[0] === boxes[0] && again.length === 0 && miss.length === 0
        && broken.length === 1);
      check('KNOWN-BAD: an arena with NO regions cannot have anything broken in it',
        breakConcealment(P.x, P.y, openArena(), []).length === 0);
    }
  }

  // ── (k) ⚠️ THE REVEAL REACHES ALL THREE `stepAI` SITES, IN ONE EXPERIMENT ──
  //
  // (e) proved the three sites route CONCEALMENT. This proves they route the §29c REVEAL,
  // and it is a separate experiment because the reveal enters `stepAI` through the same
  // single `isVisibleFrom` call — which is exactly the property that could be lost by
  // someone "simplifying" that call, and would then fail here rather than nowhere.
  //
  // Shape mirrors (e) deliberately: seen at A, then teleported into a plate at B on the
  // OPPOSITE side of the enemy. Attacking from B destroys the plate, so a correct AI turns
  // round and chases B; an AI that missed one of the three would face one point and walk to
  // another. The ABLATION is the identical run in which the player never presses attack.
  {
    const A = { x: 1000, y: 400 };
    const B = { x: 1000, y: 1600 };
    const smashIndex = CHARACTERS.hamburger.weapons.findIndex((w) => w.key === 'Smash');
    const run = (fireFromCover) => {
      const arena = openArena([{ x: B.x, y: B.y, w: 300, h: 300, kind: 'plate' }]);
      const state = playingMatch(arena, 'hamburger', 'donut');
      state.player.x = A.x; state.player.y = A.y;
      state.enemy.x = 1000; state.enemy.y = 1000;
      stepMatch(state, 16.667, noInput); // sighted at A
      state.player.x = B.x; state.player.y = B.y;
      const y0 = state.enemy.y;
      // ONE attack, then silence — so what is measured is the STATE the attack left behind
      // and not a rule that only holds while the trigger is held.
      stepMatch(state, 16.667, fireFromCover
        ? { move: { x: 0, y: 0 }, selectedWeapon: smashIndex, attack: true }
        : noInput);
      for (let i = 0; i < 60; i++) {
        state.player.x = B.x; state.player.y = B.y;
        stepMatch(state, 16.667, noInput);
      }
      return {
        movedSouth: state.enemy.y > y0 + 1,
        facingSouth: state.enemy.facing.y > 0,
        belief: { ...state.aiSighting },
        broken: state.brokenConcealment.length,
      };
    };
    const fired = run(true);
    const quiet = run(false);

    check('SITE 3 (nav): a player who FIRED from under a plate is chased to where it really is',
      fired.movedSouth && fired.broken === 1,
      `belief (${fired.belief.x}, ${fired.belief.y}) — expected B (${B.x}, ${B.y})`);
    check('SITE 2 (facing/aim): …and the enemy turns to face it, not the stale sighting',
      fired.facingSouth);
    check('SITE 1 (belief): …and the belief itself tracks B, so the sighting is live',
      fired.belief.x === B.x && fired.belief.y === B.y && fired.belief.at > 0);
    check('ABLATION: the identical run in which the player never fires keeps the AI walking to A',
      !quiet.movedSouth && !quiet.facingSouth && quiet.broken === 0
      && quiet.belief.x === A.x && quiet.belief.y === A.y,
      `belief (${quiet.belief.x}, ${quiet.belief.y}) — expected A (${A.x}, ${A.y})`);

    // And the pure-REVEAL half, with no destruction anywhere: fire from the open, THEN hide.
    // This is the case destruction alone cannot cover, and it is why the window exists.
    {
      const arena = openArena([{ x: B.x, y: B.y, w: 300, h: 300, kind: 'plate' }]);
      const state = playingMatch(arena, 'hamburger', 'donut');
      state.player.x = A.x; state.player.y = A.y;
      state.enemy.x = 1000; state.enemy.y = 1000;
      stepMatch(state, 16.667, { move: { x: 0, y: 0 }, selectedWeapon: smashIndex, attack: true });
      state.player.x = B.x; state.player.y = B.y;
      stepMatch(state, 16.667, noInput);
      const seenWhileLit = state.aiSighting.x === B.x && state.aiSighting.y === B.y;
      check('a fighter that fired in the OPEN is still seen after diving into an intact plate',
        seenWhileLit && state.brokenConcealment.length === 0);
      // Run the window out with the fighter parked in the plate.
      for (let i = 0; i < 60; i++) { state.player.x = B.x; state.player.y = B.y; stepMatch(state, 16.667, noInput); }
      state.player.x = B.x + 100; state.player.y = B.y; // still inside the 300 wu plate
      for (let i = 0; i < 5; i++) stepMatch(state, 16.667, noInput);
      check('…and is lost again once the window expires — the reveal is a window, not a latch',
        state.aiSighting.x === B.x && state.aiSighting.y === B.y
        && state.aiSighting.at < state.elapsed,
        `belief (${state.aiSighting.x}, ${state.aiSighting.y}) at ${state.aiSighting.at.toFixed(0)} of ${state.elapsed.toFixed(0)}`);
    }
  }

  // ── (l) THE `self` EXEMPTION, IN BOTH DIRECTIONS ──────────────────────────
  //
  // Uri's word is *attacking*. The heal is the roster's only `self` weapon, it deals no
  // damage and spawns nothing, and `ai.ts` already exempts it from the sight gate for
  // exactly that reason. Asserted in BOTH directions because a one-directional check
  // ("the heal does not reveal") would still pass if the whole rule stopped working.
  {
    const P = { x: 700, y: 500 };
    const healIndex = CHARACTERS.hamburger.weapons.findIndex((w) => w.type === 'self');
    const smashIndex = CHARACTERS.hamburger.weapons.findIndex((w) => w.key === 'Smash');
    check('control: the roster still has exactly one `self` weapon, and it is on the attacker used here',
      healIndex >= 0 && CHARACTER_IDS.flatMap((id) => CHARACTERS[id].weapons)
        .filter((w) => w.type === 'self').length === 1);

    const press = (weaponIndex) => {
      const arena = openArena([{ x: P.x, y: P.y, w: 120, h: 120, kind: 'plate' }]);
      const state = playingMatch(arena, 'hamburger', 'donut');
      state.player.x = P.x; state.player.y = P.y;
      state.player.hp = 10; // so the heal has somewhere to go and definitely fires
      state.enemy.x = P.x + 600; state.enemy.y = P.y;
      const evs = stepMatch(state, 16.667, { move: { x: 0, y: 0 }, selectedWeapon: weaponIndex, attack: true });
      return {
        fired: evs.some((e) => e.type === 'weapon-fired' && e.fighterRole === 'player'),
        broke: evs.filter((e) => e.type === 'concealment-broken').length,
        revealed: state.player.revealedUntil > state.elapsed,
        hidden: isHidden(state.player.x, state.player.y, arena, state, state.player),
      };
    };
    const heal = press(healIndex);
    const smash = press(smashIndex);
    check('a HEAL is not an attack: it fires, and it neither breaks the plate nor reveals the caster',
      heal.fired && heal.broke === 0 && !heal.revealed && heal.hidden);
    check('ABLATION: the SAME fighter in the SAME plate pressing a MELEE weapon breaks it and is revealed',
      smash.fired && smash.broke === 1 && smash.revealed && !smash.hidden);
  }

  // ── (m) ⚠️ EVERY GAMEPLAY READER PASSES THE PER-MATCH ARGUMENTS ───────────
  //
  // `isVisibleFrom`'s two §29c arguments are OPTIONAL, because two callers outside this
  // owner's file set pass five and making them required would break a gate. An optional
  // argument that everybody is supposed to pass is a rule enforced by memory, and this
  // file's six recorded defects are all one rule remembered in one place and forgotten in
  // another. So it is checked against the SOURCE, not against anyone's recollection.
  //
  // A source scan is a weak instrument by nature, so it carries its own known-bad input:
  // the same matcher is run over a hand-written five-argument call and must REJECT it. A
  // scanner that silently matched nothing would otherwise report a clean sheet forever.
  {
    const gameDir = dirname(fileURLToPath(import.meta.url));
    /**
     * ⚠️ COMMENTS FIRST, AND THE FIRST DRAFT DID NOT DO THIS.
     *
     * It reported three offenders — `movement.ts: 5 args`, `rules.ts: 5 args`,
     * `state.ts: 1 args` — and every one was PROSE: this feature is documented by quoting
     * its own signature, so the files that explain the rule are the files that trip a naive
     * scanner. A guard that fires on documentation trains its reader to ignore it, which is
     * strictly worse than no guard.
     */
    const stripComments = (src) => src.replace(/\/\*[\s\S]*?\*\//g, ' ').replace(/\/\/[^\n]*/g, ' ');
    /** Argument lists of every `isVisibleFrom(...)` CALL in `src`, paren-matched so a
     *  multi-line call and a nested `Math.hypot(...)` are both handled. */
    const callArities = (raw) => {
      const src = stripComments(raw);
      const out = [];
      const re = /(?<![\w.])isVisibleFrom\s*\(/g;
      let m;
      while ((m = re.exec(src)) !== null) {
        // Skip the declaration itself — `export function isVisibleFrom(`.
        if (/function\s+$/.test(src.slice(0, m.index))) continue;
        let depth = 1;
        let commas = 0;
        let i = re.lastIndex;
        for (; i < src.length && depth > 0; i++) {
          const c = src[i];
          if (c === '(' || c === '[' || c === '{') depth++;
          else if (c === ')' || c === ']' || c === '}') depth--;
          else if (c === ',' && depth === 1) commas++;
        }
        out.push(commas + 1);
      }
      return out;
    };

    check('KNOWN-BAD: the matcher REJECTS a five-argument call, so a clean sheet means something',
      JSON.stringify(callArities('const v = isVisibleFrom(a.x, a.y, b.x, b.y, state.arena);')) === '[5]');
    check('…and accepts the seven-argument form, and is not confused by a nested call',
      JSON.stringify(callArities('isVisibleFrom(p.x, p.y, Math.max(t.x, 0), t.y, state.arena, state, t);')) === '[7]');
    check('…and ignores a five-argument mention in PROSE while still seeing the real call beside it',
      JSON.stringify(callArities(
        '// isVisibleFrom(ox, oy, tx, ty, arena) is the old form.\n'
        + '/* also isVisibleFrom(a, b, c, d, e) */\n'
        + 'isVisibleFrom(e.x, e.y, p.x, p.y, state.arena, state, p);')) === '[7]');

    const offenders = [];
    let calls = 0;
    for (const f of readdirSync(gameDir).filter((n) => n.endsWith('.ts'))) {
      for (const n of callArities(readFileSync(join(gameDir, f), 'utf8'))) {
        calls++;
        if (n !== 7) offenders.push(`${f}: ${n} args`);
      }
    }
    check('every `isVisibleFrom` CALL in src/game/ passes the match and the target',
      calls >= 2 && offenders.length === 0, `${calls} calls; offenders [${offenders.join(', ')}]`);

    // `revealedUntil` is written in exactly one place. The same claim `applyDamage` makes
    // about HP, checked the same way, because "there are five call sites and a rule applied
    // at four of them is a silent bug in the fifth" is this file's most expensive lesson.
    // A write is `<something>.revealedUntil =` that is not `==`/`===`, with comments stripped
    // for the same reason as above — the field is documented by name in three files.
    const isWriter = (src) => /\.revealedUntil\s*=(?!=)/.test(stripComments(src));
    check('KNOWN-BAD: the writer scan fires on an assignment and not on a comparison or a mention',
      isWriter('f.revealedUntil = now + 1;')
      && !isWriter('if (m.elapsed < t.revealedUntil) return false;')
      && !isWriter('// sets f.revealedUntil = now'));
    const writers = readdirSync(gameDir).filter((n) => n.endsWith('.ts'))
      .filter((f) => isWriter(readFileSync(join(gameDir, f), 'utf8')));
    check('`Fighter.revealedUntil` is written in exactly one file, and it is combat.ts',
      writers.length === 1 && writers[0] === 'combat.ts', `writers: [${writers.join(', ')}]`);
  }
}

// ─────────────────────────────────────────────────────────────────────────────
// 27. THE N-FIGHTER CONTAINER, AT A CAP PINNED TO 2
//
// `MatchState` used to have exactly `player: Fighter` and `enemy: Fighter`, which made the
// sim hard 1v1 at the type level (`DECISIONS §48`: the x4 arena "requires the N-fighter
// refactor first"). It now has `fighters: Fighter[]`, an N x N `sightings` matrix, a slot
// id on everything that names a fighter, and a ranked timeout tiebreak — at N=2, under the
// bit-identity differ, with the seat names kept as aliases.
//
// ⚠️ THE BIT-IDENTITY PROOF LIVES IN `tools/tmp/conceal_lab.mjs --bitid`, NOT HERE, and
// that division is deliberate: this section pins the INVARIANTS the proof rests on — that
// the aliases are the same objects, that the matrix index is what it claims, that the
// ranked sort reproduces the two-way comparison it replaced RUNG BY RUNG. A tick count
// cannot say any of those, and one of them (rung 3) is never reached by any corpus: the
// forced-immortal sweep resolved 3520 timeouts and landed on it 0 times.
// ─────────────────────────────────────────────────────────────────────────────

console.log('\n27. The N-fighter container (cap pinned to 2)');
{
  // ── (a) THE CONTAINER AND ITS INVARIANTS ──────────────────────────────────
  {
    const state = createMatch(makeArena(), 'hamburger', 'donut');

    check('MatchState carries a fighters ARRAY, not a Map/Set/Record',
      Array.isArray(state.fighters), `${Object.prototype.toString.call(state.fighters)}`);
    // ⚠️ WAS `…of exactly MAX_FIGHTERS (2)` — `state.fighters.length === MAX_FIGHTERS`.
    // That assertion encoded a rule that has since been reversed: `MAX_FIGHTERS` was the
    // LENGTH of every match while the cap was pinned at 2, and it is now a CEILING
    // (`MIN_FIGHTERS`..`MAX_FIGHTERS`). The old wording is kept because the change of meaning
    // is the whole point of the step: a test that still demanded equality would have failed
    // for the right reason and been "fixed" by raising a number.
    check(`the legacy 3-argument form still seats exactly ${MIN_FIGHTERS} (not MAX_FIGHTERS, now ${MAX_FIGHTERS})`,
      state.fighters.length === MIN_FIGHTERS, `${state.fighters.length}`);
    check(`…and MIN_FIGHTERS ${MIN_FIGHTERS} <= MAX_FIGHTERS ${MAX_FIGHTERS}, with room above the pair`,
      MIN_FIGHTERS === 2 && MAX_FIGHTERS > MIN_FIGHTERS);
    check('`fighters[i].id === i` — the identity invariant every id in the sim indexes on',
      state.fighters.every((f, i) => f.id === i), state.fighters.map((f) => f.id).join(','));
    // The bitmask ceiling. A JS bitwise operator coerces to int32, so slot 31 is the last
    // one `fighterBit` can express — asserted rather than assumed, so raising the cap past
    // it fails here instead of wrapping silently.
    check('MAX_FIGHTERS is inside the int32 ceiling `fighterBit` imposes',
      MAX_FIGHTERS <= 31, `${MAX_FIGHTERS}`);
    check('…and fighterBit gives every slot its own distinct bit',
      new Set(state.fighters.map((f) => fighterBit(f.id))).size === state.fighters.length
      && state.fighters.every((f) => fighterBit(f.id) > 0));

    // ⚠️ SAME OBJECTS, not equal ones. `===`, deliberately.
    check('`state.player` IS `fighters[0]` and `state.enemy` IS `fighters[1]` (identity, not equality)',
      state.player === state.fighters[0] && state.enemy === state.fighters[1]);
    // The differ walks the state with Object.keys/spread. A getter is not an own enumerable
    // DATA property, so defining the aliases as accessors would silently drop both fighters
    // out of `conceal_lab --bitid` and it would still print PASS. This is the guard on that.
    const isOwnDataProp = (o, k) => {
      const d = Object.getOwnPropertyDescriptor(o, k);
      return !!d && d.enumerable === true && 'value' in d;
    };
    check('KNOWN-BAD: the descriptor check REJECTS a getter and a non-enumerable property',
      !isOwnDataProp(Object.defineProperty({}, 'player', { get: () => 1, enumerable: true }), 'player')
      && !isOwnDataProp(Object.defineProperty({}, 'player', { value: 1, enumerable: false }), 'player')
      && isOwnDataProp({ player: 1 }, 'player'));
    check('…and both aliases are own ENUMERABLE DATA properties, so the differ can see them',
      isOwnDataProp(state, 'player') && isOwnDataProp(state, 'enemy'));

    check('`roleOfSlot` is what wrote each fighter\'s legacy role',
      state.fighters.every((f) => f.role === roleOfSlot(f.id)), state.fighters.map((f) => f.role).join(','));
    check('slot 0 is the human and slot 1 is driven by the AI',
      state.fighters[0].controller === 'human' && state.fighters[1].controller === 'ai');

    // `hitRadius` moved off `sim.ts`'s `targetRole === 'player' ? ... : ...` ternary and
    // onto the fighter. The values are imported from `rules.ts`, so this fails if the field
    // stops carrying the number the ternary used to branch on.
    check('each fighter carries the hit radius the projectile ternary used to branch on',
      state.player.hitRadius === HIT_RADIUS_VS_PLAYER && state.enemy.hitRadius === HIT_RADIUS_VS_ENEMY,
      `${state.player.hitRadius} / ${state.enemy.hitRadius}`);
    check('…and the two are actually different, so the test is not vacuous',
      HIT_RADIUS_VS_PLAYER !== HIT_RADIUS_VS_ENEMY);

    check('`opponentOf` never returns the fighter itself, and is an involution',
      state.fighters.every((f) => opponentOf(state, f) !== f
        && opponentOf(state, opponentOf(state, f)) === f));
  }

  // ── (b) THE PERCEPTION MATRIX ─────────────────────────────────────────────
  {
    const arena = makeArena();
    const state = createMatch(arena, 'pizza', 'soup');
    const n = state.fighters.length;

    check('`sightings` is a SQUARE n x n matrix, allocated once',
      Array.isArray(state.sightings) && state.sightings.length === n * n, `${state.sightings.length}`);
    check('…row-major: `sightingIndex(o, t, n)` is o*n + t, and every cell is distinct',
      new Set(state.sightings).size === n * n
      && state.sightings.every((_, i) => i === sightingIndex(Math.floor(i / n), i % n, n)));
    // The seed generalises `sim.ts`'s single spawn-seed line, which exists so the
    // no-concealment case is bit-identical FROM TICK 1: `stepAI` reads the belief before
    // anything has refreshed it.
    check('every cell is seeded with its TARGET\'s spawn, at t=0 — including the diagonal',
      state.sightings.every((s, i) => {
        const t = state.fighters[i % n];
        return s.x === t.x && s.y === t.y && s.at === 0;
      }));
    check('`aiSighting` IS `sightings[sightingIndex(1, 0, n)]` — the same object, not a copy',
      state.aiSighting === state.sightings[sightingIndex(1, 0, n)]);
    // Identity stability: a resized or reallocated matrix would break the alias silently,
    // and the alias is what four out-of-set consumers still read.
    const cells = state.sightings.slice();
    const arr = state.sightings;
    for (let i = 0; i < 400; i++) stepMatch(state, 16.667, noInput);
    check('…and a whole match neither reallocates the matrix nor replaces a cell',
      state.sightings === arr && state.sightings.length === cells.length
      && state.sightings.every((s, i) => s === cells[i])
      && state.aiSighting === state.sightings[sightingIndex(1, 0, n)]);
    check('…nor reorders `fighters`, which IS the turn order',
      state.fighters[0] === state.player && state.fighters[1] === state.enemy
      && state.fighters.every((f, i) => f.id === i));
  }

  // ── (c) THE TIMEOUT TIEBREAK, RUNG BY RUNG, AGAINST THE RULE IT REPLACED ──
  //
  // `resolveTimeout` was a two-way comparison and is now a ranked sort. The forced-immortal
  // corpus (`conceal_lab --bitid --corpus timeout`, 3520 matches) resolved rung 1 in 3516
  // of them and rung 2 in 4 — and rung 3 in ZERO. A tick count over that corpus therefore
  // says nothing about the rung where slot advantage re-enters at N>2, so it is constructed
  // here instead, and checked against the LEGACY FORMULA written out longhand rather than
  // against a copy of the new one.
  {
    // ── ⚠️ THE LONGHAND FORMULA GAINED A RUNG. IT USED TO BE, VERBATIM: ───────
    //
    //   > `const legacyWinner = (pf, ef, pd, ed) =>`
    //   >   `(pf !== ef ? (pf > ef ? 'player' : 'enemy') : (pd <= ed ? 'player' : 'enemy'));`
    //
    // Kept because the SHAPE of the change matters: the old two-way rule folded rungs 2 and
    // 3 into one `<=` — "nearer the centre, and on an exact tie the player" — and that fold
    // is exactly where `DECISIONS §49a` inserts. Uri, 2026-08-11: *"Fewest deaths, then
    // lower slot"*. The `<=` is therefore split into a strict `<` plus two more rungs, and
    // when the two deaths counts are equal the new formula must collapse back to the old
    // one character for character. Every case below is checked against THIS, written out
    // longhand, rather than against a copy of `resolveTimeout`'s comparator.
    const longhandWinner = (pf, ef, pd, ed, pDeaths, eDeaths) => (
      pf !== ef ? (pf > ef ? 'player' : 'enemy')
        : pd !== ed ? (pd < ed ? 'player' : 'enemy')
          : pDeaths !== eDeaths ? (pDeaths < eDeaths ? 'player' : 'enemy')
            : 'player'            // rung 4: the lower slot, and slot 0 is the player
    );
    // The collapse, asserted rather than assumed: with equal deaths the four-rung formula
    // IS the two-rung one it replaced, over a grid that reaches every branch of both.
    {
      const old = (pf, ef, pd, ed) => (pf !== ef ? (pf > ef ? 'player' : 'enemy') : (pd <= ed ? 'player' : 'enemy'));
      const vals = [0, 0.5, 1];
      let same = 0;
      let cells = 0;
      for (const pf of vals) for (const ef of vals) for (const pd of vals) for (const ed of vals) {
        cells++;
        if (longhandWinner(pf, ef, pd, ed, 0, 0) === old(pf, ef, pd, ed)) same++;
      }
      check('the four-rung formula collapses to the two-rung one it replaced when deaths are equal',
        same === cells, `${same}/${cells}`);
      // KNOWN-BAD: and it must NOT collapse when they differ, or the new rung is decoration.
      check('KNOWN-BAD: …and it DIVERGES from it the moment the deaths differ',
        longhandWinner(0.5, 0.5, 1, 1, 1, 0) === 'enemy' && old(0.5, 0.5, 1, 1) === 'player');
    }

    /**
     * One frozen tick that ends on the whistle. Everything that could move a fighter or its
     * HP inside that tick is disabled — the AI is rooted, every weapon is on an unreachable
     * cooldown, the player's input is zero, regen is blocked by a fresh `lastDamagedAt`, and
     * the ring is at `MIN_SAFE_RADIUS` with both fighters inside it — so the state the
     * tiebreak sees is exactly the state set up here.
     *
     * ⚠️ `pDeaths`/`eDeaths` are written STRAIGHT ONTO the fighters, which is the only way
     * to reach rung 3 at all: with no respawn in the sim a fighter's count is 0 or 1 and
     * `deaths === 1` iff `hp === 0`, so rung 1 has already sorted every corpse below every
     * survivor before rung 3 is consulted. The rung is real, it is total, and it is INERT on
     * every state real play can produce — which is what the `--bitid` acceptance measures
     * and what these rows construct around.
     */
    const timeoutWinner = ({ pHp, pMax, eHp, eMax, pOff, eOff, pDeaths = 0, eDeaths = 0 }) => {
      const arena = makeArena({ maxSafeRadius: 4000 });
      const state = playingMatch(arena, 'hamburger', 'hamburger');
      const cx = arena.center.x;
      const cy = arena.center.y;
      state.player.x = cx - pOff; state.player.y = cy;
      state.enemy.x = cx + eOff; state.enemy.y = cy;
      state.player.hp = pHp; state.player.maxHp = pMax;
      state.enemy.hp = eHp; state.enemy.maxHp = eMax;
      state.player.deaths = pDeaths; state.enemy.deaths = eDeaths;
      state.player.lastDamagedAt = state.elapsed;
      state.enemy.lastDamagedAt = state.elapsed;
      state.enemy.status.stunnedUntil = state.elapsed + 10_000; // rooted: no chase this tick
      state.player.lastUsed = state.player.lastUsed.map(() => Infinity);
      state.enemy.lastUsed = state.enemy.lastUsed.map(() => Infinity);
      state.timeRemaining = 0;
      const events = stepMatch(state, 16.667, noInput);
      return {
        winner: state.winner,
        winnerId: state.winnerId,
        ended: events.filter((e) => e.type === 'match-ended'),
        moved: state.player.x !== cx - pOff || state.enemy.x !== cx + eOff,
        hpMoved: state.player.hp !== pHp || state.enemy.hp !== eHp,
        deathsMoved: state.player.deaths !== pDeaths || state.enemy.deaths !== eDeaths,
        phase: state.phase,
      };
    };

    const CASES = [
      { name: 'rung 1: the player has the higher HP FRACTION', pHp: 60, pMax: 100, eHp: 30, eMax: 90, pOff: 100, eOff: 100 },
      { name: 'rung 1: the enemy has the higher HP FRACTION', pHp: 30, pMax: 100, eHp: 60, eMax: 90, pOff: 100, eOff: 100 },
      // Different POOLS, same fraction — the rung exists because "most HP left" would hand
      // the bigger pool a head start it did nothing to earn.
      { name: 'rung 1 does not fire on equal fractions from unequal pools', pHp: 50, pMax: 100, eHp: 45, eMax: 90, pOff: 100, eOff: 300 },
      { name: 'rung 2: level on HP, the player is nearer the centre', pHp: 50, pMax: 100, eHp: 45, eMax: 90, pOff: 100, eOff: 300 },
      { name: 'rung 2: level on HP, the enemy is nearer the centre', pHp: 50, pMax: 100, eHp: 45, eMax: 90, pOff: 300, eOff: 100 },
      // ── ⚠️ RUNG 3 IS NEW AND RUNG 4 IS THE OLD RUNG 3 (DECISIONS §49a) ──
      // This row used to be named `'rung 3: level on BOTH — the tie goes to the lower slot'`
      // and it is now rung 4, unchanged in every value: with both counts at 0 the deaths
      // rung ties and the slot decides, exactly as before. That is the row `--bitid` rests
      // on. Zero of 3520 forced-immortal timeouts reached even the old rung 3.
      { name: 'rung 4: level on HP, ground AND deaths — the tie goes to the lower slot', pHp: 50, pMax: 100, eHp: 45, eMax: 90, pOff: 100, eOff: 100 },
      // RUNG 3 ITSELF. The lower slot would take both of these; fewest deaths overrules it
      // in one direction and agrees with it in the other, so the pair proves the rung is
      // ordered ABOVE the slot rather than merely present.
      { name: 'rung 3: level on HP and ground — the enemy has died more, the player wins', pHp: 50, pMax: 100, eHp: 45, eMax: 90, pOff: 100, eOff: 100, pDeaths: 0, eDeaths: 1 },
      { name: 'rung 3: …and the PLAYER having died more hands it to the enemy, over its own slot', pHp: 50, pMax: 100, eHp: 45, eMax: 90, pOff: 100, eOff: 100, pDeaths: 2, eDeaths: 1 },
      // Rungs 1 and 2 still outrank it: a fighter that has never died still loses to one
      // that is ahead on pool or on ground. A rung inserted at the wrong depth passes the
      // two rows above and fails these.
      { name: 'rung 1 still outranks deaths — more deaths but a better fraction wins', pHp: 60, pMax: 100, eHp: 30, eMax: 90, pOff: 100, eOff: 100, pDeaths: 3, eDeaths: 0 },
      { name: 'rung 2 still outranks deaths — more deaths but nearer the centre wins', pHp: 50, pMax: 100, eHp: 45, eMax: 90, pOff: 100, eOff: 300, pDeaths: 3, eDeaths: 0 },
      { name: 'rung 1 with a zero pool: hp/0 is 0, not NaN', pHp: 10, pMax: 0, eHp: 1, eMax: 90, pOff: 100, eOff: 100 },
      // The ONE state real play can produce that reaches rung 3 with unequal counts: the
      // `f.maxHp > 0 ?` guard hands a LIVING fighter fraction 0, so it can meet a corpse
      // here. The corpse has one death and loses, which is the rung doing its job.
      { name: 'rung 3: a zero-pool survivor outranks a corpse it is level with on fraction', pHp: 10, pMax: 0, eHp: 0, eMax: 90, pOff: 100, eOff: 100, pDeaths: 0, eDeaths: 1 },
    ];

    let agreed = 0;
    const disagreements = [];
    for (const c of CASES) {
      const r = timeoutWinner(c);
      const pf = c.pMax > 0 ? c.pHp / c.pMax : 0;
      const ef = c.eMax > 0 ? c.eHp / c.eMax : 0;
      const want = longhandWinner(pf, ef, c.pOff, c.eOff, c.pDeaths ?? 0, c.eDeaths ?? 0);
      const ok = r.winner === want && !r.moved && !r.hpMoved && !r.deathsMoved
        && r.phase === 'ended' && r.ended.length === 1
        && r.ended[0].winner === want && r.ended[0].winnerId === (want === 'player' ? 0 : 1)
        && r.winnerId === (want === 'player' ? 0 : 1);
      if (ok) agreed++;
      else disagreements.push(`${c.name}: got ${r.winner}/${r.winnerId} want ${want}, moved=${r.moved} hpMoved=${r.hpMoved} deathsMoved=${r.deathsMoved}`);
      check(`the ranked sort reproduces the longhand rule — ${c.name}`, ok,
        `winner ${r.winner} (slot ${r.winnerId})`);
    }
    check('…on every constructed case, and the fixture really was frozen for the tick',
      agreed === CASES.length, disagreements.join(' | '));

    // KNOWN-BAD: the fixture has to be able to FAIL. If `timeoutWinner` silently produced
    // the same answer whatever it was handed, all the rows above would be one row.
    const both = new Set(CASES.map((c) => timeoutWinner(c).winner));
    check('KNOWN-BAD: the fixture returns BOTH answers across the cases, so it is not stuck',
      both.size === 2, [...both].join(','));
    // KNOWN-BAD: and the DEATHS input specifically has to be able to flip it. Two runs of
    // one case differing in nothing but `eDeaths` — if the fixture ignored the field (a
    // typo'd key, a fighter object rebuilt after the write) every deaths row above would
    // still pass, because they also differ from each other in name only.
    check('KNOWN-BAD: flipping ONLY `eDeaths` on one case flips the winner',
      timeoutWinner({ pHp: 50, pMax: 100, eHp: 45, eMax: 90, pOff: 100, eOff: 100, pDeaths: 1, eDeaths: 1 }).winner === 'player'
      && timeoutWinner({ pHp: 50, pMax: 100, eHp: 45, eMax: 90, pOff: 100, eOff: 100, pDeaths: 1, eDeaths: 0 }).winner === 'enemy');

    // ── AND THE SAME RUNG, ABOVE TWO SEATS, WHERE §49a ACTUALLY BITES ─────────
    //
    // The rows above are a DUEL, where rung 3 is unreachable in real play (a knockout ends
    // a two-seat match before the clock can — §28(d) measures that, so `resolveTimeout`
    // never sees a two-seat corpse). The rung exists for the brawl, so it is constructed at
    // six seats too: everyone level on pool and on ground, separated by nothing but how
    // often they have gone down. Slot 5 wins over slots 0..4, which is the whole point —
    // the old rung would have handed it to slot 0 forever.
    {
      const arena = makeArena({ width: 3000, height: 3000, maxSafeRadius: 4000 });
      const cx = arena.center.x;
      const cy = arena.center.y;
      const RING = 400;
      const DEATHS = [3, 3, 2, 2, 1, 0];   // slot 5 is the cleanest, slot 0 the most-killed
      const state = createMatch(arena, DEATHS.map((_, i) => ({
        characterId: 'hamburger',
        // Every fighter the SAME distance from the centre, so rung 2 cannot decide it, and
        // spread around a circle so no two share a position.
        spawn: { x: cx + RING * Math.cos((i / 6) * Math.PI * 2), y: cy + RING * Math.sin((i / 6) * Math.PI * 2) },
      })));
      state.phase = 'playing';
      state.fighters.forEach((f, i) => {
        f.hp = 50; f.maxHp = 100;                 // rung 1 ties
        f.deaths = DEATHS[i];
        f.lastDamagedAt = state.elapsed;          // regen blocked
        f.status.stunnedUntil = state.elapsed + 10_000; // rooted
        f.lastUsed = f.lastUsed.map(() => Infinity);
      });
      const distances = state.fighters.map((f) => Math.hypot(f.x - cx, f.y - cy));
      check('the six-seat fixture really is level on rungs 1 and 2 (or rung 3 decides nothing)',
        new Set(state.fighters.map((f) => f.hp / f.maxHp)).size === 1
        && distances.every((d) => approx(d, distances[0])),
        distances.map((d) => d.toFixed(6)).join(' '));
      state.timeRemaining = 0;
      const events = stepMatch(state, 16.667, noInput);
      const ended = events.filter((e) => e.type === 'match-ended');
      check('at six seats the FEWEST DEATHS wins the whistle, not the lowest slot (DECISIONS §49a)',
        state.winnerId === 5 && ended.length === 1 && ended[0].winnerId === 5,
        `winnerId ${state.winnerId} with deaths [${state.fighters.map((f) => f.deaths).join(',')}]`);
      check('…and no fighter died, was moved or was healed by the whistle tick',
        state.fighters.every((f, i) => f.deaths === DEATHS[i] && f.hp === 50 && f.alive)
        && events.every((e) => e.type !== 'death'),
        state.fighters.map((f) => `${f.id}:${f.hp}/${f.deaths}`).join(' '));
      // KNOWN-BAD: give the lowest slot the cleanest sheet instead and the answer must move.
      // Without this the row above passes for a comparator that returned slot 5 by accident
      // (a reversed `id` rung, a sort on the wrong key).
      const mirrored = createMatch(arena, DEATHS.map((_, i) => ({
        characterId: 'hamburger',
        spawn: { x: cx + RING * Math.cos((i / 6) * Math.PI * 2), y: cy + RING * Math.sin((i / 6) * Math.PI * 2) },
      })));
      mirrored.phase = 'playing';
      mirrored.fighters.forEach((f, i) => {
        f.hp = 50; f.maxHp = 100;
        f.deaths = [...DEATHS].reverse()[i];
        f.lastDamagedAt = mirrored.elapsed;
        f.status.stunnedUntil = mirrored.elapsed + 10_000;
        f.lastUsed = f.lastUsed.map(() => Infinity);
      });
      mirrored.timeRemaining = 0;
      stepMatch(mirrored, 16.667, noInput);
      check('KNOWN-BAD: mirror the death sheet and slot 0 wins — the rung reads deaths, not ids',
        mirrored.winnerId === 0, `winnerId ${mirrored.winnerId}`);
      // …and with every sheet EQUAL the slot rung is still the floor at six seats.
      const flat = createMatch(arena, DEATHS.map((_, i) => ({
        characterId: 'hamburger',
        spawn: { x: cx + RING * Math.cos((i / 6) * Math.PI * 2), y: cy + RING * Math.sin((i / 6) * Math.PI * 2) },
      })));
      flat.phase = 'playing';
      flat.fighters.forEach((f) => {
        f.hp = 50; f.maxHp = 100;
        f.deaths = 2;
        f.lastDamagedAt = flat.elapsed;
        f.status.stunnedUntil = flat.elapsed + 10_000;
        f.lastUsed = f.lastUsed.map(() => Infinity);
      });
      flat.timeRemaining = 0;
      stepMatch(flat, 16.667, noInput);
      check('…and with every death sheet EQUAL the lower slot is still the floor (rung 4)',
        flat.winnerId === 0, `winnerId ${flat.winnerId}`);
    }

    // ── `deaths` IS A REAL COUNTER, WRITTEN BY THE KILL PATH ──────────────────
    //
    // Everything above WRITES the field by hand, so on its own it proves the comparator
    // reads a number and nothing about where that number comes from. This is the other
    // half: a real knockout in a real match must move it, exactly once, in step with the
    // `death` event — otherwise rung 3 would be reading a field that is 0 forever.
    {
      const state = playingMatch(makeArena({ maxSafeRadius: 4000 }), 'hamburger', 'donut');
      check('every fighter starts the match on a clean sheet',
        state.fighters.every((f) => f.deaths === 0));
      let deathEvents = 0;
      for (let i = 0; i < 4000 && state.phase !== 'ended'; i++) {
        for (const ev of stepMatch(state, 16.667, { move: { x: 1, y: 0.2 }, selectedWeapon: 0, attack: true })) {
          if (ev.type === 'death') deathEvents++;
        }
      }
      const totalDeaths = state.fighters.reduce((a, f) => a + f.deaths, 0);
      check('a real knockout increments `deaths`, once, on the fighter that went down',
        deathEvents === 1 && totalDeaths === 1
        && state.fighters.every((f) => f.deaths === (f.alive ? 0 : 1)),
        `${deathEvents} death events, counts [${state.fighters.map((f) => f.deaths).join(',')}]`);
      // The invariant the rung's inertness rests on, asserted on a real corpse rather than
      // argued: with no respawn, `deaths === 1` iff the fighter is at 0 HP.
      check('…and with no respawn, `deaths === 1` iff `hp === 0` — which is why rung 3 is inert today',
        state.fighters.every((f) => (f.deaths === 1) === (f.hp === 0)),
        state.fighters.map((f) => `${f.id}:${f.hp}/${f.deaths}`).join(' '));
      // KNOWN-BAD: a second hit on the corpse must NOT count again. `applyDamage`'s
      // `if (!target.alive) return` is what stops it, and a counter incremented anywhere
      // else in the file would double here.
      const corpse = state.fighters.find((f) => !f.alive);
      for (let i = 0; i < 60; i++) stepMatch(state, 16.667, { move: { x: -1, y: 0 }, selectedWeapon: 0, attack: true });
      check('KNOWN-BAD: hitting a corpse for another second does not count a second death',
        corpse.deaths === 1, `${corpse.deaths}`);
    }
  }

  // ── (d) `damagedMask`: PER-VICTIM, AND EQUIVALENT TO THE BOOLEAN AT N=2 ───
  {
    const arena = makeArena({ width: 2000, height: 2000 });
    const state = playingMatch(arena, 'hamburger', 'donut');
    state.player.x = arena.center.x; state.player.y = arena.center.y;
    state.enemy.x = arena.center.x + 800; state.enemy.y = arena.center.y;
    state.enemy.lastUsed = state.enemy.lastUsed.map(() => Infinity);
    const mark = {
      id: 4242, ownerId: 1, ownerRole: 'enemy', x: arena.center.x, y: arena.center.y,
      expiresAt: state.elapsed + TRAIL.durationMs, damagedMask: 0, damaged: false,
    };
    state.trailMarks.push(mark);

    const hp0 = state.player.hp;
    stepMatch(state, 16.667, noInput);
    check('a mark that bites sets the VICTIM\'s bit, and only that bit',
      mark.damagedMask === fighterBit(state.player.id)
      && (mark.damagedMask & fighterBit(state.enemy.id)) === 0,
      `mask ${mark.damagedMask}, victim bit ${fighterBit(state.player.id)}`);
    check('…and the legacy boolean mirrors `damagedMask !== 0` exactly',
      mark.damaged === (mark.damagedMask !== 0));
    check('…and it dealt TRAIL.damage once', hp0 - state.player.hp === TRAIL.damage);

    const hp1 = state.player.hp;
    stepMatch(state, 16.667, noInput);
    check('…and does not bite the same victim twice', state.player.hp === hp1);

    // The bit is what stops it, not the boolean: clear the bit and it bites again.
    mark.damagedMask &= ~fighterBit(state.player.id);
    const hp2 = state.player.hp;
    stepMatch(state, 16.667, noInput);
    check('KNOWN-BAD: clearing the victim\'s BIT (leaving `damaged` true) makes it bite again',
      hp2 - state.player.hp === TRAIL.damage,
      `damaged is still ${mark.damaged}; lost ${hp2 - state.player.hp}`);
  }

  // ── (e) THE EVENT PROTOCOL NAMES EVERY FIGHTER BY SLOT ────────────────────
  //
  // Every `GameEvent` that identifies a fighter carries a `*Id` beside the legacy `*Role`.
  // This walks a REAL match's whole event stream and requires the two to agree on every
  // one — a mirror that is written in two places is a mirror that will disagree.
  {
    const FIELDS = [
      ['weapon-fired', 'fighterRole', 'fighterId'],
      ['projectile-spawned', 'ownerRole', 'ownerId'],
      ['hit-landed', 'targetRole', 'targetId'],
      ['heal', 'fighterRole', 'fighterId'],
      ['death', 'fighterRole', 'fighterId'],
      ['trail-mark-created', 'ownerRole', 'ownerId'],
      ['match-ended', 'winner', 'winnerId'],
    ];
    const audit = (evs) => {
      const seen = new Map();
      const bad = [];
      for (const ev of evs) {
        for (const [type, roleKey, idKey] of FIELDS) {
          if (ev.type !== type) continue;
          seen.set(type, (seen.get(type) ?? 0) + 1);
          if (typeof ev[idKey] !== 'number' || roleOfSlot(ev[idKey]) !== ev[roleKey]) {
            bad.push(`${type}.${idKey}=${ev[idKey]} vs .${roleKey}=${ev[roleKey]}`);
          }
        }
        if (ev.type === 'hit-landed' && ev.source.kind === 'weapon') {
          seen.set('source.weapon', (seen.get('source.weapon') ?? 0) + 1);
          if (typeof ev.source.attackerId !== 'number') bad.push('hit-landed.source.attackerId missing');
        }
        if (ev.type === 'hit-landed' && ev.source.kind === 'trail') {
          seen.set('source.trail', (seen.get('source.trail') ?? 0) + 1);
          if (roleOfSlot(ev.source.ownerId) !== ev.source.ownerRole) bad.push('hit-landed.source.trail id/role disagree');
        }
      }
      return { seen, bad };
    };

    // A real Donut match, so the trail source and a death both actually occur.
    const state = createMatch(makeArena({ width: 1400, height: 1000, maxSafeRadius: 700 }), 'donut', 'hamburger');
    const all = [];
    for (let i = 0; i < 4000 && state.phase !== 'ended'; i++) {
      for (const ev of stepMatch(state, 16.667, { move: { x: 1, y: 0.2 }, selectedWeapon: 0, attack: true })) all.push(ev);
    }
    const { seen, bad } = audit(all);
    check('a real match emits every fighter-naming event kind at least once',
      seen.size >= 6, `${all.length} events: ${[...seen.entries()].map(([k, v]) => `${k}x${v}`).join(' ')}`);
    check('…and the slot id agrees with the legacy seat name on every single one',
      bad.length === 0, bad.slice(0, 4).join(' | '));

    // KNOWN-BAD: the auditor must fail on a deliberately mismatched pair, or "0 bad" means
    // nothing. Both directions — a wrong id and a missing one.
    const forged = audit([
      { type: 'death', fighterRole: 'player', fighterId: 1 },
      { type: 'heal', fighterRole: 'enemy', amount: 1 },
    ]);
    check('KNOWN-BAD: the auditor catches a forged id/role mismatch AND a missing id',
      forged.bad.length === 2, forged.bad.join(' | '));
  }
}

// ─────────────────────────────────────────────────────────────────────────────
// 28. THE CAP OFF: PER-SLOT INPUT, A FIGHTER LIST, AND THE TARGET RULE SPLIT
//
// §27 built the container at a cap of 2. This is the step that raises it — `MAX_FIGHTERS` 2
// -> 6 (`DECISIONS §48` sizes the x4 arena for "4-6 players"), `createMatch` taking a fighter
// LIST behind a compat overload, `stepMatch` taking one input OR one per slot, and
// `opponentOf` splitting into `nearestLivingOpponent` (who do I hit) and
// `lastFighterStanding` (who won).
//
// ⚠️ THE BIT-IDENTITY PROOF IS STILL `tools/tmp/conceal_lab.mjs --bitid`, and the N=3..6
// SELF-CONSISTENCY arm is `--nfighter`. This section pins what a tick count cannot say:
//
//   (a) each split REDUCES to `opponentOf` at N=2 — checked against that function itself,
//       kept for exactly this purpose, rather than against a fresh copy of the two-seat rule;
//   (b) the two `createMatch` forms build the SAME state, field for field;
//   (c) broadcast and per-slot input agree at one human seat and DIVERGE at two — a compat
//       shim nobody can tell from the real thing is one that gets used by mistake;
//   (d) the "no living opponent" branch is unreachable while `phase === 'playing'`, measured
//       over real matches rather than argued from the source;
//   (e) a 6-fighter match holds every §27 invariant, and its ITERATION ORDER is observable
//       from the event stream rather than asserted.
// ─────────────────────────────────────────────────────────────────────────────

console.log('\n28. The cap off: per-slot input, a fighter list, and the split target rule');
{
  /**
   * Structural equality with EXACT numbers, skipping functions.
   *
   * ⚠️ NOT `JSON.stringify`, and the reason is a real hazard rather than fastidiousness:
   * this state is full of `-Infinity` sentinels (`lastDamagedAt`, `revealedUntil`, every
   * `lastUsed` slot, both `StatusTimers` deadlines) and `JSON.stringify` turns every one of
   * them into `null`. Two states that differed only in those fields would compare EQUAL, and
   * they are precisely the fields a mis-built fighter gets wrong.
   */
  const deepDiff = (a, b, path = '') => {
    if (a === b) return null;
    if (typeof a !== typeof b) return `${path}: type ${typeof a} vs ${typeof b}`;
    if (typeof a === 'number') {
      if (Number.isNaN(a) && Number.isNaN(b)) return null;
      return `${path}: ${a} !== ${b}`;
    }
    if (typeof a !== 'object' || a === null || b === null) return `${path}: ${a} !== ${b}`;
    if (Array.isArray(a) !== Array.isArray(b)) return `${path}: array vs object`;
    if (Array.isArray(a)) {
      if (a.length !== b.length) return `${path}.length: ${a.length} !== ${b.length}`;
      for (let i = 0; i < a.length; i++) {
        const d = deepDiff(a[i], b[i], `${path}[${i}]`);
        if (d) return d;
      }
      return null;
    }
    for (const k of new Set([...Object.keys(a), ...Object.keys(b)])) {
      if (typeof a[k] === 'function' || typeof b[k] === 'function') continue;
      if (!(k in a) || !(k in b)) return `${path}.${k}: present on one side only`;
      const d = deepDiff(a[k], b[k], `${path}.${k}`);
      if (d) return d;
    }
    return null;
  };
  const stateOnly = ({ arena: _a, ...rest }) => rest;

  // ── (a) EVERY SPLIT REDUCES TO `opponentOf` AT N=2 ────────────────────────
  {
    const state = createMatch(makeArena({ maxSafeRadius: 900 }), 'donut', 'hamburger');
    let ticks = 0;
    let deaths = 0;
    let agreedTarget = 0;
    let agreedWinner = 0;
    const breaks = [];
    for (let i = 0; i < 4000 && state.phase !== 'ended'; i++) {
      for (const f of state.fighters) {
        const legacy = opponentOf(state, f);
        const split = nearestLivingOpponent(state, f);
        // The claim, exactly: with two seats the nearest LIVING opponent is "the other one"
        // whenever the other one is up, and `null` in precisely the case the old callers
        // tested for with `target.hp <= 0`.
        const want = legacy.alive && legacy.hp > 0 ? legacy : null;
        if (split === want) agreedTarget++;
        else breaks.push(`tick ${ticks} slot ${f.id}: nearestLivingOpponent gave ${split && split.id} want ${want && want.id}`);
      }
      for (const ev of stepMatch(state, 16.667, { move: { x: 1, y: 0.3 }, selectedWeapon: 0, attack: true })) {
        if (ev.type === 'death') deaths++;
      }
      ticks++;
      // `lastFighterStanding` is only the same question as `opponentOf` while EXACTLY one
      // fighter is down, which is the only state the knockout block ever asks it from — and
      // that state exists only AFTER the killing tick, which is also the tick the loop
      // condition ends on. Checked here rather than at the top for exactly that reason: the
      // first draft asked before the step and found the case 0 times in 4000 ticks, which is
      // a green row measuring nothing.
      const down = state.fighters.filter((f) => !f.alive || f.hp <= 0);
      if (down.length === 1) {
        if (lastFighterStanding(state) === opponentOf(state, down[0])) agreedWinner++;
        else breaks.push(`tick ${ticks}: lastFighterStanding disagreed with opponentOf on the survivor`);
      }
    }
    check('the corpus this reduction runs on is not vacuous — a real match, run to a knockout',
      ticks > 200 && deaths >= 1, `${ticks} ticks, ${deaths} deaths`);
    check('`nearestLivingOpponent` reduces EXACTLY to `opponentOf` on every tick, both slots',
      breaks.length === 0 && agreedTarget === ticks * 2, `${agreedTarget}/${ticks * 2}; ${breaks.slice(0, 3).join(' | ')}`);
    check('…and `lastFighterStanding` names the same survivor `opponentOf` did',
      agreedWinner >= 1, `${agreedWinner} ticks with exactly one fighter down`);

    // KNOWN-BAD / POSITIVE CONTROL: they are DIFFERENT functions above two seats, so a
    // reduction that held everywhere would mean the split had not happened. Three fighters
    // in a line: slot 1's nearest is slot 2, and `opponentOf` insists on slot 0.
    const arena3 = makeArena({ width: 2000, height: 2000, maxSafeRadius: 4000 });
    const three = createMatch(arena3, [
      { characterId: 'hamburger', spawn: { x: 100, y: 1000 } },
      { characterId: 'donut', spawn: { x: 900, y: 1000 } },
      { characterId: 'pizza', spawn: { x: 1000, y: 1000 } },
    ]);
    check('KNOWN-BAD: at three seats the split DISAGREES with `opponentOf` — it is a real split',
      nearestLivingOpponent(three, three.fighters[1]) === three.fighters[2]
      && opponentOf(three, three.fighters[1]) === three.fighters[0],
      `nearest=${nearestLivingOpponent(three, three.fighters[1]).id}, opponentOf=${opponentOf(three, three.fighters[1]).id}`);
    check('…and `lastFighterStanding` is null while more than one is up, whatever just died',
      lastFighterStanding(three) === null);
    three.fighters[0].alive = false;
    three.fighters[0].hp = 0;
    check('…and null is not "no survivor": two of three up is still null',
      lastFighterStanding(three) === null);
    three.fighters[2].alive = false;
    three.fighters[2].hp = 0;
    check('…and it names the one that is left once it is the only one',
      lastFighterStanding(three) === three.fighters[1]);

    // Ties: the ONE place slot order survives in the target rule, stated out loud in
    // `state.ts` and pinned here so it cannot drift to "last wins" or to arbitrary.
    const tied = createMatch(arena3, [
      { characterId: 'hamburger', spawn: { x: 1000, y: 1000 } },
      { characterId: 'donut', spawn: { x: 1000, y: 800 } },
      { characterId: 'pizza', spawn: { x: 1000, y: 1200 } },
    ]);
    check('an exact distance tie breaks on the LOWER slot (deterministic, never arbitrary)',
      nearestLivingOpponent(tied, tied.fighters[0]) === tied.fighters[1]);
  }

  // ── (b) THE `createMatch` COMPAT OVERLOAD ─────────────────────────────────
  {
    const arena = makeArena();
    const legacy = createMatch(arena, 'sushi', 'taco', { player: 11, enemy: 4 });
    const list = createMatch(arena, [
      { characterId: 'sushi', level: 11 },
      { characterId: 'taco', level: 4 },
    ]);
    const d = deepDiff(stateOnly(legacy), stateOnly(list), 'state');
    check('the 3-argument form and the fighter LIST build the identical state, field for field',
      d === null, d ?? 'identical');
    check('…and the shared arena object is the same reference in both (not a copy)',
      legacy.arena === arena && list.arena === arena);

    // KNOWN-BAD: `deepDiff` has to be able to fail, or the row above is a comment with a
    // tick next to it. Two things it must catch — a different level, and an `-Infinity`
    // sentinel, which is exactly what `JSON.stringify` would have flattened to null.
    const other = createMatch(arena, [{ characterId: 'sushi', level: 12 }, { characterId: 'taco', level: 4 }]);
    check('KNOWN-BAD: the comparator catches a one-level difference between the two forms',
      deepDiff(stateOnly(legacy), stateOnly(other), 'state') !== null);
    const nudged = createMatch(arena, 'sushi', 'taco', { player: 11, enemy: 4 });
    nudged.player.lastDamagedAt = 0; // was -Infinity
    check('KNOWN-BAD: …and a -Infinity sentinel that became 0 (JSON.stringify would not)',
      deepDiff(stateOnly(legacy), stateOnly(nudged), 'state') !== null,
      JSON.stringify(-Infinity));

    // The default LADDER, slot by slot. Stated here because it is a balance decision above
    // two seats and a silent change to it would look like a tuning pass.
    //
    // ── ⚠️ THESE TWO ROWS ENCODED A RULE URI HAS SINCE REVERSED. THEY READ: ────
    //
    //   > `'slot 0 gets the PLAYER dial and every slot above it the ENEMY dial (DECISIONS §49c)'`
    //   >   `six.fighters[0].size === PLAYER_SIZE && … hitRadius === HIT_RADIUS_VS_PLAYER`
    //   >   `&& six.fighters.slice(1).every((f) => f.size === ENEMY_SIZE && f.hitRadius === HIT_RADIUS_VS_ENEMY)`
    //   > `'…and the pools follow the same seat dial, through maxHpFor and nothing else'`
    //   >   `six.fighters[1].maxHp === maxHpFor('donut', ENEMY_MAX_HP, LEVEL_MIN)`
    //   >   `&& six.fighters[5].maxHp === maxHpFor('sushi', ENEMY_MAX_HP, LEVEL_MIN)`
    //
    // Kept verbatim rather than deleted, because the reversal is the point: that WAS the
    // shipped rule, it was recorded as a choice parked with Uri, and he answered it on
    // 2026-08-11 — *"AI player is currently only for testing the game. Later on when real
    // PvP occurs each player has it stats based on the level if their brawler."* The AI
    // opponent is a TEST HARNESS, so `ENEMY_MAX_HP` is a bot-opponent constant and above two
    // seats no slot may be dialled by its index. A test that still demanded the old ladder
    // would have failed for exactly the right reason and been "fixed" by re-reading it.
    //
    // ⚠️ `controller` is deliberately still checked the old way: it was never part of the
    // dial. It says who supplies the input, and slot 0 is still the local human seat.
    const six = createMatch(makeArena({ width: 3000, height: 3000, maxSafeRadius: 4000 }), [
      { characterId: 'hamburger' },
      { characterId: 'donut' },
      { characterId: 'pizza', spawn: { x: 2800, y: 200 } },
      { characterId: 'egg', spawn: { x: 200, y: 2800 } },
      { characterId: 'soup', spawn: { x: 2800, y: 2800 } },
      { characterId: 'sushi', spawn: { x: 1500, y: 200 } },
    ]);
    check('above two seats NO slot is dialled by its index — one flat body (DECISIONS §49c)',
      six.fighters.every((f) => f.size === PLAYER_SIZE && f.hitRadius === HIT_RADIUS_VS_PLAYER),
      six.fighters.map((f) => `${f.id}:${f.size}/${f.hitRadius}`).join(' '));
    check('…and slot 0 is still the local human seat while every other seat is a bot',
      six.fighters[0].controller === 'human'
      && six.fighters.slice(1).every((f) => f.controller === 'ai'),
      six.fighters.map((f) => `${f.id}:${f.controller}`).join(' '));
    check('…and every pool comes from PLAYER_MAX_HP through `maxHpFor`, character card and level only',
      six.fighters[0].maxHp === maxHpFor('hamburger', PLAYER_MAX_HP, LEVEL_MIN)
      && six.fighters[1].maxHp === maxHpFor('donut', PLAYER_MAX_HP, LEVEL_MIN)
      && six.fighters[5].maxHp === maxHpFor('sushi', PLAYER_MAX_HP, LEVEL_MIN));
    // KNOWN-BAD: the row above passes just as well if `maxHpFor` collapsed to a constant, or
    // if the two role bases happened to be equal. Both are ruled out here, so "flat" is a
    // measured claim about the seats and not about the arithmetic.
    check('KNOWN-BAD: the two role bases DIFFER, so "every seat on PLAYER_MAX_HP" is not vacuous',
      PLAYER_MAX_HP !== ENEMY_MAX_HP
      && maxHpFor('donut', PLAYER_MAX_HP, LEVEL_MIN) !== maxHpFor('donut', ENEMY_MAX_HP, LEVEL_MIN),
      `${PLAYER_MAX_HP}/${ENEMY_MAX_HP}`);
    check('…and the flat pools are still PER-CHARACTER, not one number for the table',
      new Set(six.fighters.map((f) => f.maxHp)).size > 1,
      six.fighters.map((f) => `${f.characterId}:${f.maxHp}`).join(' '));
    // …and LEVEL is what separates two seats now, which is the whole of Uri's answer.
    {
      const levelled = createMatch(makeArena({ width: 3000, height: 3000, maxSafeRadius: 4000 }), [
        { characterId: 'donut', level: LEVEL_MIN },
        { characterId: 'donut', level: LEVEL_MAX },
        { characterId: 'donut', level: LEVEL_MAX, spawn: { x: 2800, y: 200 } },
      ]);
      check('…and LEVEL is the ONLY thing that separates two seats on the same character',
        levelled.fighters[0].maxHp === maxHpFor('donut', PLAYER_MAX_HP, LEVEL_MIN)
        && levelled.fighters[1].maxHp === maxHpFor('donut', PLAYER_MAX_HP, LEVEL_MAX)
        && levelled.fighters[1].maxHp === levelled.fighters[2].maxHp
        && levelled.fighters[1].damageMul === levelled.fighters[2].damageMul
        && levelled.fighters[1].maxHp > levelled.fighters[0].maxHp,
        levelled.fighters.map((f) => `${f.id}:L${f.level}:${f.maxHp}:x${f.damageMul}`).join(' '));
    }
    // ── AND THE DUEL KEEPS THE BOT DIAL, UNCHANGED. AUTHORISED DEVIATION #9 STANDS ──
    // This is the other half of the same rule and the half `--bitid` rests on: at exactly
    // two seats slot 1 IS the bot the difficulty is dialled against, so `ENEMY_MAX_HP`,
    // `ENEMY_SIZE` and `HIT_RADIUS_VS_ENEMY` still apply there and only there.
    {
      const duel = createMatch(makeArena(), 'hamburger', 'donut');
      check('the DUEL keeps the bot-opponent dial on slot 1 — ENEMY_MAX_HP is not reversed',
        duel.fighters[0].maxHp === maxHpFor('hamburger', PLAYER_MAX_HP, LEVEL_MIN)
        && duel.fighters[1].maxHp === maxHpFor('donut', ENEMY_MAX_HP, LEVEL_MIN)
        && duel.fighters[1].hitRadius === HIT_RADIUS_VS_ENEMY
        && duel.fighters[1].size === ENEMY_SIZE,
        `${duel.fighters[0].maxHp}/${duel.fighters[1].maxHp}`);
      // The gate is the SEAT COUNT, not the slot index: the same character in the same slot
      // gets a different pool at two seats and at three. Without this row the two claims
      // above could both hold while the implementation keyed on something else entirely.
      const trio = createMatch(makeArena({ width: 3000, height: 3000, maxSafeRadius: 4000 }), [
        { characterId: 'hamburger' },
        { characterId: 'donut' },
        { characterId: 'pizza', spawn: { x: 2800, y: 200 } },
      ]);
      check('…and the gate is the SEAT COUNT: slot 1 is 90-based at two seats and 100-based at three',
        trio.fighters[1].maxHp === maxHpFor('donut', PLAYER_MAX_HP, LEVEL_MIN)
        && trio.fighters[1].maxHp !== duel.fighters[1].maxHp
        && trio.fighters[1].hitRadius === HIT_RADIUS_VS_PLAYER,
        `duel ${duel.fighters[1].maxHp} vs trio ${trio.fighters[1].maxHp}`);
      // An explicit override still wins at every seat count — that is how an INSTRUMENT
      // keeps a 100/90 split above two seats if its own question needs one.
      const forced = createMatch(makeArena({ width: 3000, height: 3000, maxSafeRadius: 4000 }), [
        { characterId: 'hamburger' },
        { characterId: 'donut', maxHp: maxHpFor('donut', ENEMY_MAX_HP, LEVEL_MIN), hitRadius: HIT_RADIUS_VS_ENEMY },
        { characterId: 'pizza', spawn: { x: 2800, y: 200 } },
      ]);
      check('…and an explicit maxHp/hitRadius still overrides the flat default above two seats',
        forced.fighters[1].maxHp === maxHpFor('donut', ENEMY_MAX_HP, LEVEL_MIN)
        && forced.fighters[1].hitRadius === HIT_RADIUS_VS_ENEMY);
    }
    check('…and slots 0/1 keep the literal +x/-x facing the two-seat form always used',
      six.fighters[0].facing.x === 1 && six.fighters[0].facing.y === 0
      && six.fighters[1].facing.x === -1 && six.fighters[1].facing.y === 0);
    check('…while a slot above them looks at `arena.center`, derived and unit-length',
      approx(Math.hypot(six.fighters[2].facing.x, six.fighters[2].facing.y), 1)
      && six.fighters[2].facing.x < 0 && six.fighters[2].facing.y > 0,
      JSON.stringify(six.fighters[2].facing));
    check('…and every §27 container invariant still holds at six seats',
      six.fighters.length === 6 && six.fighters.every((f, i) => f.id === i)
      && six.sightings.length === 36 && new Set(six.sightings).size === 36
      && six.player === six.fighters[0] && six.enemy === six.fighters[1]
      && six.sightings.every((s, i) => {
        const t = six.fighters[i % 6];
        return s.x === t.x && s.y === t.y && s.at === 0;
      }));
    check('…and `fighterBit` still gives all six a distinct bit inside the int32 ceiling',
      new Set(six.fighters.map((f) => fighterBit(f.id))).size === 6 && MAX_FIGHTERS <= 31);

    // The REFUSALS. Every one is a throw rather than a clamp, because a match that quietly
    // seats a different number of fighters than it was asked for is a balance run nobody
    // can reproduce.
    const throws = (fn) => { try { fn(); return false; } catch { return true; } };
    check(`a list below MIN_FIGHTERS (${MIN_FIGHTERS}) is REFUSED, not padded`,
      throws(() => createMatch(arena, [{ characterId: 'donut' }])));
    check(`…and one above MAX_FIGHTERS (${MAX_FIGHTERS}) is REFUSED, not truncated`,
      throws(() => createMatch(arena, new Array(MAX_FIGHTERS + 1).fill({ characterId: 'donut' }))));
    check('…and a slot above 1 with NO spawn is REFUSED — arena geometry is src/arena/**\'s',
      throws(() => createMatch(arena, [
        { characterId: 'donut' }, { characterId: 'donut' }, { characterId: 'donut' },
      ])));
    check('…and the SAME list with an explicit spawn is accepted (the refusal is the spawn, not the count)',
      !throws(() => createMatch(arena, [
        { characterId: 'donut' }, { characterId: 'donut' },
        { characterId: 'donut', spawn: { x: 500, y: 500 } },
      ])));
    // A MIXED call would otherwise DROP the levels silently, and at LEVEL_MIN every
    // multiplier is exactly 1.0 — so the resulting balance run would look right and be
    // wrong. That is the same blindness `conceal_lab --levels` exists to expose.
    check('…and a fighter LIST with a levels argument is REFUSED, never silently ignored',
      throws(() => createMatch(arena, [{ characterId: 'donut' }, { characterId: 'pizza' }], undefined, { player: 15 })));
  }

  // ── (c) BROADCAST vs PER-SLOT INPUT ───────────────────────────────────────
  {
    const arena = makeArena({ maxSafeRadius: 4000 });
    const drive = { move: { x: 1, y: 0 }, selectedWeapon: 0, attack: false };

    // At ONE human seat the two readings are the same match. This is the compat claim in
    // miniature; `conceal_lab --bitid` is the same claim over 26M ticks.
    const bcast = playingMatch(arena, 'hamburger', 'donut');
    const slots = playingMatch(arena, 'hamburger', 'donut');
    for (let i = 0; i < 120; i++) {
      stepMatch(bcast, 16.667, drive);
      stepMatch(slots, 16.667, [drive]);
    }
    const d = deepDiff(stateOnly(bcast), stateOnly(slots), 'state');
    check('with one human seat, a bare MatchInput and a 1-long array are the same match',
      d === null, d ?? '120 ticks identical');

    // 🚨 AND THEY MUST DIVERGE AT TWO HUMAN SEATS, or the shim is indistinguishable from the
    // real thing and will be reached for by accident. Slot 1 is HUMAN here, which is the
    // configuration `Controller` was split out of `FighterRole` to make expressible.
    const twoHumanArena = makeArena({ maxSafeRadius: 4000 });
    const mk = () => {
      const s = createMatch(twoHumanArena, [
        { characterId: 'hamburger' },
        { characterId: 'donut', controller: 'human' },
      ]);
      s.phase = 'playing';
      return s;
    };
    const both = mk();
    const one = mk();
    const start = one.fighters[1].x;
    for (let i = 0; i < 60; i++) {
      stepMatch(both, 16.667, drive);        // broadcast: BOTH humans walk
      stepMatch(one, 16.667, [drive]);       // per-slot: only slot 0 has an input
    }
    check('two human seats: broadcast moves BOTH, so the shim is not silently per-slot',
      both.fighters[1].x > start, `${start} -> ${both.fighters[1].x}`);
    check('…and a short array leaves slot 1 NEUTRAL — a hole is not the neighbour\'s input',
      one.fighters[1].x === start, `${start} -> ${one.fighters[1].x}`);
    check('…so the two readings genuinely DIVERGE (the compat shim is distinguishable)',
      deepDiff(stateOnly(both), stateOnly(one), 'state') !== null);

    // An explicit `null` and a missing element must mean the same thing as each other, and
    // a per-slot entry must actually REACH slot 1 rather than being dropped.
    const holed = mk();
    const nulled = mk();
    const driven = mk();
    for (let i = 0; i < 60; i++) {
      stepMatch(holed, 16.667, [drive]);
      stepMatch(nulled, 16.667, [drive, null]);
      stepMatch(driven, 16.667, [drive, { move: { x: -1, y: 0 }, selectedWeapon: 0, attack: false }]);
    }
    check('an explicit null and a missing element are the same neutral seat',
      deepDiff(stateOnly(holed), stateOnly(nulled), 'state') === null);
    check('…and slot 1\'s OWN input reaches slot 1, in its own direction',
      driven.fighters[1].x < start && driven.fighters[0].x > driven.fighters[0].size,
      `slot1 ${start} -> ${driven.fighters[1].x}`);

    // The ATTACK half of the per-slot input, which travels a different path (`attemptAttack`
    // with `fi.selectedWeapon`) from the movement half.
    const firing = mk();
    const evs = stepMatch(firing, 16.667, [
      null,
      { move: { x: 0, y: 0 }, selectedWeapon: 0, attack: true },
    ]);
    const fired = evs.filter((e) => e.type === 'weapon-fired');
    check('a per-slot ATTACK fires that slot\'s weapon and only that slot\'s',
      fired.length === 1 && fired[0].fighterId === 1,
      fired.map((e) => `${e.fighterId}:${e.weaponKey}`).join(',') || 'none');
  }

  // ── (d) THE "NO LIVING OPPONENT" BRANCH IS UNREACHABLE WHILE PLAYING ──────
  //
  // `attemptAttack` and `stepAI` both handle a null target. `combat.ts` argues that state
  // cannot occur while `phase === 'playing'`, because `applyDamage` zeroes `hp`, clears
  // `alive` and ends the match in the same statement. That is an argument from code reading,
  // which `CLAUDE.md` #6 says not to trust — so it is measured.
  {
    let ticks = 0;
    let deaths = 0;
    const violations = [];
    for (const [p, e] of [['donut', 'hamburger'], ['egg', 'pizza'], ['lollipop', 'soup']]) {
      const state = createMatch(makeArena({ maxSafeRadius: 700 }), p, e);
      for (let i = 0; i < 4000 && state.phase !== 'ended'; i++) {
        for (const ev of stepMatch(state, 16.667, { move: { x: 1, y: 0.4 }, selectedWeapon: 0, attack: true })) {
          if (ev.type === 'death') deaths++;
        }
        ticks++;
        if (state.phase === 'playing' && state.fighters.some((f) => !f.alive || f.hp <= 0)) {
          violations.push(`${p}>${e} tick ${i}`);
        }
      }
    }
    check('a fighter at 0 HP implies the match is NOT `playing` — measured, not argued',
      violations.length === 0 && deaths >= 3 && ticks > 600,
      `${ticks} ticks, ${deaths} deaths, ${violations.length} violations`);

    // And what the branch DOES when it is forced. Reachable only by hand, and pinned so a
    // future change to it is a decision rather than an accident.
    const forced = playingMatch(makeArena(), 'hamburger', 'donut');
    forced.enemy.hp = 0;
    forced.enemy.alive = false;
    const tomato = CHARACTERS.hamburger.weapons.findIndex((w) => w.key === 'Tomato');
    const evs = [];
    const ok = attemptAttack(forced, forced.player, tomato, evs);
    check('forced: a ranged press with nobody alive is SPENT — cooldown gone, no projectile',
      ok === true && forced.player.lastUsed[tomato] === forced.elapsed
      && forced.projectiles.length === 0
      && evs.filter((e) => e.type === 'weapon-fired').length === 1
      && evs.filter((e) => e.type === 'projectile-spawned').length === 0,
      evs.map((e) => e.type).join(','));
    // The `self` exemption, in the same forced state: a heal targets its caster, so it must
    // still work in an empty arena. Gating it on a living opponent would be `ai.ts`'s oldest
    // defect shape (a rule stated once, implemented twice) in the shared path.
    const heal = CHARACTERS.hamburger.weapons.findIndex((w) => w.type === 'self');
    forced.player.hp = 10;
    const healEvs = [];
    attemptAttack(forced, forced.player, heal, healEvs);
    check('…but the SELF weapon still heals — it targets its caster, not an opponent',
      forced.player.hp > 10 && healEvs.some((e) => e.type === 'heal' && e.fighterId === 0),
      `hp ${forced.player.hp}`);
  }

  // ── (e) SIX SEATS: ITERATION ORDER, OBSERVED ─────────────────────────────
  //
  // `MatchState.fighters` documents slot order as a GAME RULE — who fires first inside a
  // tick, whose trail mark exists before the other walks onto it. A test that read
  // `state.fighters.map(f => f.id)` would be checking the array, not the loop. So the order
  // is recovered from the EVENT STREAM, which is the thing the rule is about.
  {
    const arena = makeArena({ width: 3000, height: 3000, maxSafeRadius: 4000 });
    const spawns = [
      { x: 400, y: 400 }, { x: 2600, y: 2600 }, { x: 2600, y: 400 },
      { x: 400, y: 2600 }, { x: 1500, y: 400 }, { x: 1500, y: 2600 },
    ];
    // Six DONUTS, every one human-driven, every one primed to drop a trail mark on the next
    // qualifying tick. Donut is the roster's only `hasTrail` character, so a mark per fighter
    // per tick is the one per-fighter event this loop can be made to emit on demand.
    const state = createMatch(arena, spawns.map((spawn) => ({
      characterId: 'donut', controller: 'human', spawn,
    })));
    state.phase = 'playing';
    for (const f of state.fighters) f.trailDropTimer = TRAIL.dropIntervalMs;
    const walk = { move: { x: 1, y: 0 }, selectedWeapon: 0, attack: false };
    const evs = stepMatch(state, 16.667, state.fighters.map(() => walk));
    const order = evs.filter((e) => e.type === 'trail-mark-created').map((e) => e.ownerId);
    check('every one of six fighters is stepped EXACTLY once in a tick — six marks, no repeats',
      order.length === 6 && new Set(order).size === 6, `[${order.join(',')}]`);
    check('…and the loop walks them in SLOT order, recovered from the event stream',
      order.join(',') === '0,1,2,3,4,5', `[${order.join(',')}]`);
    // ⚠️ ON A FRESH MATCH, not on the stepped one above — everybody just walked, so the
    // stepped positions are the spawns plus one tick of the same broadcast movement. The
    // first draft asserted it after the step and failed by exactly 1.88 wu on all six, which
    // is the check working.
    const fresh = createMatch(arena, spawns.map((spawn) => ({ characterId: 'donut', spawn })));
    check('…and slot i is `createMatch` ARGUMENT i, which is what makes slot order the caller\'s',
      fresh.fighters.every((f, i) => f.x === spawns[i].x && f.y === spawns[i].y),
      fresh.fighters.map((f, i) => `${i}:(${f.x},${f.y}) vs (${spawns[i].x},${spawns[i].y})`).join(' '));

    // "Stepped exactly once" again, through a completely different observable: `regenTimer`
    // accumulates `dt` per `applyWorldTick` call, so a fighter stepped twice would carry 2dt.
    const regen = createMatch(arena, spawns.slice(0, 4).map((spawn) => ({ characterId: 'pizza', spawn })));
    regen.phase = 'playing';
    for (const f of regen.fighters) f.hp = f.maxHp - 1; // eligible, and never damaged
    stepMatch(regen, 16.667, noInput);
    check('…corroborated by a second observable: regenTimer advances by exactly one dt',
      regen.fighters.every((f) => approx(f.regenTimer, 16.667)),
      regen.fighters.map((f) => f.regenTimer.toFixed(4)).join(' '));

    // A six-fighter match must run without producing a NaN anywhere. Non-finite coordinates
    // are how "the AI walks to the wrong place" becomes "the AI is nowhere at all", and the
    // path that produces them (a zero-length bearing) has bitten this sim twice already.
    const live = createMatch(arena, spawns.map((spawn, i) => ({
      characterId: CHARACTER_IDS[i % CHARACTER_IDS.length], spawn,
    })));
    live.phase = 'playing';
    let nonFinite = 0;
    for (let i = 0; i < 900; i++) {
      stepMatch(live, 16.667, noInput);
      for (const f of live.fighters) {
        if (!Number.isFinite(f.x) || !Number.isFinite(f.y) || !Number.isFinite(f.hp)) nonFinite++;
      }
      for (const pr of live.projectiles) {
        if (!Number.isFinite(pr.x) || !Number.isFinite(pr.y) || !Number.isFinite(pr.vx)) nonFinite++;
      }
    }
    check('900 ticks of a 6-fighter match produce no non-finite position, velocity or HP',
      nonFinite === 0, `${nonFinite} non-finite readings`);

    // A KNOCKOUT AT SIX SEATS IS NOT THE END OF THE MATCH. This is the single most natural
    // thing to get wrong when generalising `applyDamage`, and it is invisible at N=2.
    const brawl = createMatch(arena, spawns.map((spawn) => ({ characterId: 'hamburger', spawn })));
    brawl.phase = 'playing';
    const kill = [];
    applyDamage(brawl, brawl.fighters[3], 1e9, null, { kind: 'fog' }, kill);
    check('a knockout with four fighters still up does NOT end the match',
      brawl.phase === 'playing' && brawl.winner === null && brawl.winnerId === null
      && kill.some((e) => e.type === 'death' && e.fighterId === 3)
      && !kill.some((e) => e.type === 'match-ended'),
      `phase ${brawl.phase}, events ${kill.map((e) => e.type).join(',')}`);
    for (const id of [0, 1, 2, 4]) applyDamage(brawl, brawl.fighters[id], 1e9, null, { kind: 'fog' }, kill);
    check('…and the LAST knockout does, naming the one fighter left standing',
      brawl.phase === 'ended' && brawl.winnerId === 5
      && kill.filter((e) => e.type === 'match-ended').length === 1,
      `phase ${brawl.phase}, winnerId ${brawl.winnerId}`);
  }
}

// ─────────────────────────────────────────────────────────────────────────────
// 29. THE ENDGAME RING SCALES WITH FIGHTER COUNT (DECISIONS §53b)
//
// ⚠️ **NO CORPUS CAN SHOW THIS.** Nothing in `src/` seats more than two fighters, and even
// at N=2 the endgame ring is reached by only the last 6.34 s of a match that goes the
// distance. So this section is built the way §49a's rung was: the geometry is CONSTRUCTED
// by hand, the chord is asserted against the reach ladder written longhand, and the
// known-bad battery lives outside — `node tools/tmp/rg2_mutants.mjs`, one deliberately
// wrong sim per failure mode: a radius that ignores N, one that ignores the pot, the chord
// off by one seat in each direction, its factor of 2 applied twice, the hit radius dropped
// or taken as a `min`, the pot floor dropped, the guard widened, the LIVING count read
// instead of the seated one, and `sim.ts` pinning the count at 2. Every one is caught, and
// its §0 is the positive control that says so non-vacuously.
//
// The one thing that IS reachable — that the shipped duel is untouched — is asserted here
// against the live sim tick by tick, and proven bit-for-bit by `conceal_lab --bitid`.
// ─────────────────────────────────────────────────────────────────────────────
console.log('\n29. The endgame ring scales with fighter count (DECISIONS §53b)');
{
  /** Where a fighter stands in the final annulus: adjacent to neither hazard. Longhand. */
  const standRadius = (floor) => (POT.dangerRadius + floor) / 2;
  /** The gap between two of N fighters spread evenly on that circle. Longhand. */
  const chordAt = (n, floor) => 2 * standRadius(floor) * Math.sin(Math.PI / n);

  // ── (a) N <= 4 IS A NO-OP, AND THE GUARD IS NOT HIDING A DISCONTINUITY ────
  {
    check('`minSafeRadiusFor(2)` is EXACTLY the shipped constant — the duel is untouched',
      minSafeRadiusFor(2) === MIN_SAFE_RADIUS, `${minSafeRadiusFor(2)} !== ${MIN_SAFE_RADIUS}`);
    check('…and so are N=3 and N=4, so `DECISIONS §53a`\'s four-player map is untouched too',
      minSafeRadiusFor(3) === MIN_SAFE_RADIUS && minSafeRadiusFor(4) === MIN_SAFE_RADIUS,
      `${minSafeRadiusFor(3)} / ${minSafeRadiusFor(4)}`);

    // The n < 3 early return could be hiding a jump: the spacing term might have been
    // ABOVE the floor at n=2 and simply not evaluated. Write the general formula out here
    // and check it agrees, so the guard is proven to be a guard against sin(pi/1) and not
    // a special case with a different answer in it.
    const generalAt2 = Math.max(MIN_SAFE_RADIUS, ENDGAME_STANDOFF / Math.sin(Math.PI / 2) - POT.dangerRadius);
    check('the n<3 early return agrees with the general formula at n=2 (it guards sin(pi/1), not a special case)',
      generalAt2 === minSafeRadiusFor(2), `general ${generalAt2} vs guarded ${minSafeRadiusFor(2)}`);

    // Degenerate inputs. `Math.sin(Math.PI / 1)` is 1.2246e-16, not 0, so an unguarded
    // formula returns 1.4e18 rather than throwing — a one-fighter state would silently get
    // an infinite safe zone and the fog would never bite.
    check('a degenerate fighter count (1, 0, NaN) returns the floor, not 1.4e18',
      minSafeRadiusFor(1) === MIN_SAFE_RADIUS && minSafeRadiusFor(0) === MIN_SAFE_RADIUS
      && minSafeRadiusFor(NaN) === MIN_SAFE_RADIUS,
      `${minSafeRadiusFor(1)} / ${minSafeRadiusFor(0)} / ${minSafeRadiusFor(NaN)}`);

    // The live sim, tick for tick, against the pre-change formula written longhand. This is
    // the unit-suite half of the bit-identity claim: `conceal_lab --bitid` proves it across
    // 110 matchups, and this proves the one line that changed still evaluates to the old
    // expression at two seats even when nothing else in a match is happening.
    const st = playingMatch(makeArena({ width: 2000, height: 2000, maxSafeRadius: 993 }));
    st.player.hp = st.player.maxHp = 1e9;
    st.enemy.hp = st.enemy.maxHp = 1e9;
    let drift = 0;
    let sawFloor = 0;
    let ticks = 0;
    let prev = Infinity;
    let rose = 0;
    for (let i = 0; i < 600 && st.phase === 'playing'; i++) {
      stepMatch(st, 100, noInput);
      const progress = 1 - st.timeRemaining / MATCH_DURATION_MS;
      const legacy = Math.max(MIN_SAFE_RADIUS, st.arena.maxSafeRadius * (1 - progress));
      if (st.safeRadius !== legacy) drift++;
      if (st.safeRadius === MIN_SAFE_RADIUS) sawFloor++;
      if (st.safeRadius > prev) rose++;
      prev = st.safeRadius;
      ticks++;
    }
    check('the corpus this no-op runs on is not vacuous — a full match that REACHES the floor',
      ticks > 400 && sawFloor > 50, `${ticks} ticks, ${sawFloor} at the floor`);
    check('every tick of a two-fighter match has the pre-change `max(MIN_SAFE_RADIUS, …)` radius',
      drift === 0, `${drift} of ${ticks} ticks differ`);
    check('…and the ring is monotone non-increasing (a fog that recedes would break two latches)',
      rose === 0, `${rose} ticks rose`);
  }

  // ── (b) THE CHORD, LONGHAND, AGAINST THE REACH LADDER ────────────────────
  {
    check('`ENDGAME_STANDOFF` is derived from the ladder, not authored',
      ENDGAME_STANDOFF === REACH.rangedMax + Math.max(HIT_RADIUS_VS_PLAYER, HIT_RADIUS_VS_ENEMY),
      `${ENDGAME_STANDOFF}`);

    // The rung the standoff has to sit under, derived exactly as `render/camera.ts` derives
    // `FAIR_PLAY.radiusUnits` (max range + hit radius + a reaction distance that is
    // `TRAIL.speedBoost` closing speeds over one evade window). The design claim is that a
    // neighbour on the final ring is OUT OF REACH AND STILL ON SCREEN, so both bounds hold.
    const fairRadius = REACH.rangedMax + HIT_RADIUS_VS_PLAYER + TRAIL.speedBoost * HIT_RADIUS_VS_PLAYER;
    check(`the standoff is inside the fair-play disc (${ENDGAME_STANDOFF} < ${fairRadius.toFixed(2)}) — out of reach, still on screen`,
      ENDGAME_STANDOFF < fairRadius, `${ENDGAME_STANDOFF} vs ${fairRadius}`);

    const margins = [];
    for (let n = 2; n <= MAX_FIGHTERS; n++) {
      const floor = minSafeRadiusFor(n);
      const chord = chordAt(n, floor);
      margins.push(`N=${n} r=${floor.toFixed(2)} chord=${chord.toFixed(2)} (+${(chord - ENDGAME_STANDOFF).toFixed(2)})`);
    }
    // PRINTED, not only asserted: N=4 clears by 0.17 wu and that razor is what keeps the
    // four-player match bit-identical. The day a pot or ladder change flips it, it should be
    // visible in the run that flips it.
    console.log(`     chord ladder: ${margins.join('  ')}`);

    let tight = 0;
    let outside = 0;
    for (let n = 2; n <= MAX_FIGHTERS; n++) {
      const floor = minSafeRadiusFor(n);
      if (chordAt(n, floor) >= ENDGAME_STANDOFF - 1e-9) outside++;
      // Where the SPACING term binds the ring is the SMALLEST radius that satisfies the
      // rule, so the chord lands exactly on the standoff. This is the two-sided half of the
      // claim and it is what catches a radius that ignores the pot: dropping
      // `- POT.dangerRadius` gives a ring that is too BIG, which passes a one-sided test.
      if (floor > MIN_SAFE_RADIUS && approx(chordAt(n, floor), ENDGAME_STANDOFF, 1e-9)) tight++;
    }
    check(`no fighter on the final ring is inside another's reach, N=2..${MAX_FIGHTERS}`,
      outside === MAX_FIGHTERS - 1, `${outside} of ${MAX_FIGHTERS - 1}`);
    check('…and where the spacing term binds, the ring is the SMALLEST radius that satisfies it',
      tight === 2, `${tight} of 2 (N=5, N=6)`);

    // WHICH term binds, per N. A radius that ignored N would floor everywhere; a radius that
    // ignored the pot would never floor. Both are caught by pinning the regime boundary.
    const bindsPot = [];
    const bindsSpacing = [];
    for (let n = 2; n <= MAX_FIGHTERS; n++) (minSafeRadiusFor(n) === MIN_SAFE_RADIUS ? bindsPot : bindsSpacing).push(n);
    check('the POT term binds at N=2..4 and the SPACING term at N=5..6 — the threshold is between 4 and 5',
      bindsPot.join(',') === '2,3,4' && bindsSpacing.join(',') === '5,6',
      `pot ${bindsPot.join(',')} | spacing ${bindsSpacing.join(',')}`);

    // KNOWN-BAD, and it is the shipped defect: §53b's own table, re-derived here. The
    // constant floor put N=5 inside `rangedMax` and N=6 inside `rangedLong`.
    const old5 = chordAt(5, MIN_SAFE_RADIUS);
    const old6 = chordAt(6, MIN_SAFE_RADIUS);
    check(`KNOWN-BAD: at the constant 140 floor, N=5 (${old5.toFixed(1)}) is inside REACH.rangedMax and N=6 (${old6.toFixed(1)}) inside REACH.rangedLong`,
      old5 < REACH.rangedMax && old5 < ENDGAME_STANDOFF && old6 < REACH.rangedLong,
      `${old5} / ${old6}`);
    check('…and N=4 at the same constant floor was already fine, which is why it does not move',
      chordAt(4, MIN_SAFE_RADIUS) >= ENDGAME_STANDOFF,
      `${chordAt(4, MIN_SAFE_RADIUS)} vs ${ENDGAME_STANDOFF}`);

    // The whole roster, structurally: no authored weapon reaches across the standoff.
    // `REACH.ultimateSlam` is excluded exactly as `render/camera.ts` excludes it from the
    // fair-play radius — an 8 s map-scale ultimate whose tell is the slam visual.
    const maxTargetHit = Math.max(HIT_RADIUS_VS_PLAYER, HIT_RADIUS_VS_ENEMY);
    const overreach = [];
    let weapons = 0;
    for (const id of CHARACTER_IDS) {
      for (const w of CHARACTERS[id].weapons) {
        if (w.giantSlam) continue;
        weapons++;
        if (w.range + maxTargetHit > ENDGAME_STANDOFF) overreach.push(`${id}/${w.key} ${w.range}`);
      }
    }
    check(`no weapon in the roster reaches across the standoff (${weapons} weapons, giantSlam excluded)`,
      weapons >= 30 && overreach.length === 0, overreach.join(', '));
  }

  // ── (c) MONOTONIC, AND THE POT RULE FROM §11 GENERALISED TO EVERY N ──────
  {
    let dips = 0;
    let potBreaks = 0;
    for (let n = MIN_FIGHTERS; n <= MAX_FIGHTERS; n++) {
      if (n > MIN_FIGHTERS && minSafeRadiusFor(n) < minSafeRadiusFor(n - 1)) dips++;
      if (minSafeRadiusFor(n) < POT.dangerRadius + PLAYER_SIZE / 2) potBreaks++;
    }
    check('the floor is non-decreasing in fighter count',
      dips === 0, `${dips} dips`);
    check(`the §11 rule holds at EVERY seat count: the floor clears ${POT.dangerRadius} by at least half a body`,
      potBreaks === 0, `${potBreaks} counts break it`);
    check('the largest ring still closes — the six-fighter floor is far inside the shipped opening radius',
      minSafeRadiusFor(MAX_FIGHTERS) < 993 * 0.5,
      `${minSafeRadiusFor(MAX_FIGHTERS)} vs 993`);
  }

  // ── (d) THE LIVE SIM AT SIX SEATS, AND ONE REAL PROJECTILE ACROSS THE CHORD ──
  {
    const N = MAX_FIGHTERS;
    const arena = makeArena({ width: 3000, height: 3000, maxSafeRadius: 993 });
    const ringSpawn = (i) => ({
      x: arena.center.x + 900 * Math.cos((i / N) * Math.PI * 2),
      y: arena.center.y + 900 * Math.sin((i / N) * Math.PI * 2),
    });
    const six = createMatch(arena, Array.from({ length: N }, (_, i) => ({ characterId: 'hamburger', spawn: ringSpawn(i) })));
    six.phase = 'playing';
    for (const f of six.fighters) { f.hp = f.maxHp = 1e9; }
    let minSeen = Infinity;
    let rose = 0;
    let prev = Infinity;
    let ticks = 0;
    for (let i = 0; i < 600 && six.phase === 'playing'; i++) {
      stepMatch(six, 100, noInput);
      if (six.safeRadius > prev) rose++;
      prev = six.safeRadius;
      minSeen = Math.min(minSeen, six.safeRadius);
      ticks++;
    }
    check('a six-fighter match bottoms out at the six-fighter floor, not the constant one',
      approx(minSeen, minSafeRadiusFor(N), 1e-9) && minSeen > MIN_SAFE_RADIUS,
      `min seen ${minSeen} vs ${minSafeRadiusFor(N)} (constant floor ${MIN_SAFE_RADIUS})`);
    check('…over a full match, monotone non-increasing, and the run reached the floor',
      rose === 0 && ticks > 400, `${rose} rises in ${ticks} ticks`);

    // THE SEATED COUNT, NOT THE LIVING ONE — and this is invisible to `--bitid`, because at
    // two seats the two counts only ever differ on the tick the match ends. Reading the
    // living count would restart the close under the survivors: at three left the floor
    // would drop 237 -> 140 and the fog would eat 97 wu of ground they were standing on.
    {
      // ⚠️ 400 ticks, NOT 500. The first draft ran 50 s of a 45 s match, so the whistle had
      // already blown and `stepMatch` skips the whole ring block once `phase !== 'playing'` —
      // `safeRadius` was simply frozen at its last value and the row passed against a sim
      // that read the living count. The phase is asserted below so it cannot go quiet again.
      const st = createMatch(arena, Array.from({ length: N }, (_, i) => ({ characterId: 'hamburger', spawn: ringSpawn(i) })));
      st.phase = 'playing';
      for (const f of st.fighters) { f.hp = f.maxHp = 1e9; }
      for (let i = 0; i < 400 && st.phase === 'playing'; i++) stepMatch(st, 100, noInput);
      const atFloor = st.safeRadius;
      for (const id of [3, 4, 5]) applyDamage(st, st.fighters[id], 1e9, null, { kind: 'fog' }, []);
      stepMatch(st, 100, noInput);
      check('three of six knocked out does NOT reopen the close — the ring reads the SEATED count',
        st.phase === 'playing' && st.fighters.filter((f) => f.alive).length === 3
        && approx(st.safeRadius, minSafeRadiusFor(N), 1e-9) && approx(atFloor, minSafeRadiusFor(N), 1e-9),
        `phase ${st.phase}, ${atFloor} -> ${st.safeRadius}, three-seat floor would be ${minSafeRadiusFor(3)}`);
    }

    // A fighter standing where the endgame is actually fought takes nothing at the whistle.
    {
      const st = createMatch(arena, Array.from({ length: N }, (_, i) => ({ characterId: 'hamburger', spawn: ringSpawn(i) })));
      st.phase = 'playing';
      st.timeRemaining = 100;
      const r = (POT.dangerRadius + minSafeRadiusFor(N)) / 2;
      st.fighters.forEach((f, i) => {
        const a = (i / N) * Math.PI * 2;
        f.x = arena.center.x + r * Math.cos(a);
        f.y = arena.center.y + r * Math.sin(a);
      });
      const hp0 = st.fighters.map((f) => f.hp);
      stepMatch(st, 99, noInput);
      check('six fighters spread on the final ring take no fog and no pot damage at the whistle',
        st.fighters.every((f, i) => f.hp === hp0[i]),
        `R=${st.safeRadius}, r=${r}, hp ${st.fighters.map((f) => f.hp).join('/')}`);
    }

    // ── THE PROJECTILE. The claim is about the COMBAT CODE, not about my arithmetic. ──
    //
    // The longest authored ranged weapon, chosen from the roster rather than named, fired
    // point-blank-accurately at a neighbour exactly one chord away. `stepProjectiles`
    // expires it at `traveled >= w.range` BEFORE the hit test, and connects only inside
    // `target.hitRadius` — so this is the real reach, not a model of it.
    const LONGEST = (() => {
      let best = null;
      for (const id of CHARACTER_IDS) {
        for (const w of CHARACTERS[id].weapons) {
          if (w.type !== 'ranged' || w.giantSlam || w.homing || w.pellets) continue;
          if (!best || w.range > best.w.range) best = { id, w, index: CHARACTERS[id].weapons.indexOf(w) };
        }
      }
      return best;
    })();
    check(`the longest plain ranged weapon in the roster is at REACH.rangedMax (${LONGEST && LONGEST.id}/${LONGEST && LONGEST.w.key})`,
      !!LONGEST && LONGEST.w.range === REACH.rangedMax, LONGEST ? `${LONGEST.w.range}` : 'none found');

    /**
     * Fire `LONGEST` from slot 0 at slot 1, `gap` wu away in a `seats`-fighter match, and
     * report the damage dealt. Spare seats sit 900 wu out so slot 1 is unambiguously the
     * nearest opponent, and the fixture's ring never closes so nothing burns.
     */
    const shootAcross = (gap, seats, width = 4000) => {
      const a = makeArena({ width, height: width, maxSafeRadius: 4000 });
      const configs = [
        { characterId: LONGEST.id, spawn: { x: a.center.x, y: a.center.y } },
        { characterId: LONGEST.id, spawn: { x: a.center.x + gap, y: a.center.y } },
      ];
      for (let i = 2; i < seats; i++) {
        const ang = 1.2 + ((i - 2) / 4) * Math.PI * 2;
        configs.push({ characterId: LONGEST.id, spawn: { x: a.center.x + 900 * Math.cos(ang), y: a.center.y + 900 * Math.sin(ang) } });
      }
      const st = createMatch(a, configs);
      st.phase = 'playing';
      st.fighters[0].facing = { x: 1, y: 0 };
      // ⚠️ EVERY SEAT DRIVEN BY `noInput`, NOT STUNNED. The first draft stunned the target
      // and measured a hit at 166 wu: `stepAI` walks slot 1 toward slot 0 at
      // `AI_CHASE_SPEED` for the projectile's whole 875 ms flight — 61 wu of closing — so
      // the test was measuring a CHASE, not a reach. Flipping `controller` makes the seat
      // read `noInput` and hold still, which is the state the claim is about.
      for (const f of st.fighters) f.controller = 'human';
      const hp0 = st.fighters[1].hp;
      const ev = [];
      attemptAttack(st, st.fighters[0], LONGEST.index, ev);
      for (let i = 0; i < 4000 && st.projectiles.length > 0; i++) stepMatch(st, 1, noInput);
      return {
        hitRadius: st.fighters[1].hitRadius,
        fired: ev.some((e) => e.type === 'projectile-spawned'),
        moved: Math.abs(st.fighters[1].x - (st.arena.center.x + gap)) + Math.abs(st.fighters[1].y - st.arena.center.y),
        damage: hp0 - st.fighters[1].hp,
      };
    };

    const across = shootAcross(chordAt(N, minSafeRadiusFor(N)), N);
    check('the shot is really fired, the target really holds still, and it carries the BRAWL hit radius',
      across.fired && across.moved === 0 && across.hitRadius === HIT_RADIUS_VS_PLAYER, JSON.stringify(across));
    check(`the longest weapon does NOT connect across the six-fighter chord (${chordAt(N, minSafeRadiusFor(N)).toFixed(2)} wu)`,
      across.damage === 0, `dealt ${across.damage}`);
    // The same claim at the seat count that does NOT move, where the 0.17 wu razor lives.
    const at4 = shootAcross(chordAt(4, minSafeRadiusFor(4)), 4);
    check(`…nor across the four-fighter chord (${chordAt(4, minSafeRadiusFor(4)).toFixed(2)} wu) — the ring that did not have to move`,
      at4.damage === 0, `dealt ${at4.damage}`);

    // POSITIVE CONTROL, and it is the shipped defect stated as an experiment: the SAME
    // weapon, the SAME code, at the chord the constant 140 floor produced at six seats.
    const oldChord = chordAt(N, MIN_SAFE_RADIUS);
    const before = shootAcross(oldChord, N);
    check(`KNOWN-BAD: the same weapon DOES connect across the old constant-floor chord (${oldChord.toFixed(2)} wu)`,
      before.fired && before.damage > 0, `dealt ${before.damage}`);
    const oldChord5 = chordAt(5, MIN_SAFE_RADIUS);
    const before5 = shootAcross(oldChord5, 5);
    check(`KNOWN-BAD: …and across the old FIVE-fighter chord too (${oldChord5.toFixed(2)} wu, §53b's 138)`,
      before5.fired && before5.damage > 0, `dealt ${before5.damage}`);

    // ── 🚨 WHY `ENDGAME_STANDOFF` TAKES THE **MAX** OF THE TWO HIT RADII ─────
    //
    // MEASURED, and it is the reason this is not `+ HIT_RADIUS_VS_PLAYER` alone: at a
    // separation of EXACTLY `range + hitRadius` the outcome is not a miss, it is a coin
    // flip in the last ulp. `stepProjectiles` expires on `p.traveled >= w.range`, and
    // `traveled` is a running sum of per-tick step lengths — 874 additions of 0.16 reach
    // **139.99999999999773, not 140**, so the expiry does not fire and the hit test runs
    // one more time at a distance of 25.99999999999 against a 26 wu radius. Worse, the
    // distance is `hypot(p.x - target.x, …)` on ABSOLUTE coordinates, so the same shot at
    // the same separation resolves differently depending on WHERE ON THE MAP it is taken:
    // measured, it lands in a 3000 wu arena and misses in a 4000 wu one.
    //
    // The sweep below is the experiment, and it asserts the INDETERMINACY rather than a
    // direction — asserting "the boundary is a hit" would itself be a row pinned to a float
    // coin flip. Taking the MAX makes the binding chord 166.00 against a brawl's real
    // 165.2 wu reach — 0.8 wu clear, ~5e15 ulps — while `HIT_RADIUS_VS_ENEMY` only ever
    // belongs to the bot in a two-seat duel, where the spacing term never binds anyway. The
    // 0.8 wu is free: it fits inside the 0.17 wu of headroom N=4 already had, so no seat
    // count moves for it.
    const placements = [3000, 3200, 3400, 3600, 3800, 4000];
    const exact = placements.map((w) => shootAcross(REACH.rangedMax + HIT_RADIUS_VS_ENEMY, 2, w));
    check('KNOWN-BAD: at EXACTLY `range + hitRadius` the shot lands at some map positions and misses at others — the boundary is a float coin flip',
      exact.every((r) => r.hitRadius === HIT_RADIUS_VS_ENEMY)
      && exact.some((r) => r.damage > 0) && exact.some((r) => r.damage === 0),
      `damage by arena width: ${placements.map((w, i) => `${w}:${exact[i].damage}`).join(' ')}`);
    check('…and one wu further out it misses at EVERY position, so that row is a boundary and not "nothing reaches"',
      placements.every((w) => shootAcross(REACH.rangedMax + HIT_RADIUS_VS_ENEMY + 1, 2, w).damage === 0));
    check('…while the six-fighter chord misses at every position too — the 0.8 wu is what buys that',
      placements.every((w) => shootAcross(chordAt(N, minSafeRadiusFor(N)), N, w).damage === 0));
  }

  // ── (e) THE SCHEDULE IS RE-DERIVED, NEVER PINNED ─────────────────────────
  {
    // `arena/shared.ts` derives the opening radius from the half diagonal and the clock, so
    // both numbers below are computed the same way rather than quoted: 993 on the shipped
    // 1400x1000 kitchen and 1985 on §48's 2800x2000.
    const FOG_FIRST_CONTACT_MS = 6000;
    const openingRadius = (w, h) => Math.round(Math.hypot(w / 2, h / 2) / (1 - FOG_FIRST_CONTACT_MS / MATCH_DURATION_MS));
    const R1 = openingRadius(1400, 1000);
    const R4 = openingRadius(2800, 2000);
    check('the opening ring re-derives to the shipped 993 at 1x and 1985 at 2x linear',
      R1 === 993 && R4 === 1985, `${R1} / ${R4}`);

    /** Seconds of endgame: the ring stops when the linear close reaches the floor. */
    const windowS = (maxR, n) => (MATCH_DURATION_MS * (minSafeRadiusFor(n) / maxR)) / 1000;

    // §48 measured this pair at N=2 and published it as "6.4 s -> 3.2 s". Reproducing it
    // from the live formula is what says the schedule model here is the shipped one — and
    // it is the row that fails if anyone pins a literal in place of the derivation.
    check('§48\'s published N=2 endgame window re-derives: 6.4 s on the 1x map, 3.2 s on the 2x',
      approx(windowS(R1, 2), 6.34, 0.01) && approx(windowS(R4, 2), 3.17, 0.01),
      `${windowS(R1, 2).toFixed(2)} s / ${windowS(R4, 2).toFixed(2)} s`);
    check('…and scaling the floor with N gives part of it back at six seats (10.74 s / 5.37 s)',
      approx(windowS(R1, MAX_FIGHTERS), 10.74, 0.01) && approx(windowS(R4, MAX_FIGHTERS), 5.37, 0.01),
      `${windowS(R1, MAX_FIGHTERS).toFixed(2)} s / ${windowS(R4, MAX_FIGHTERS).toFixed(2)} s`);

    // §53b's headline: a bigger arena does NOT fix the annulus, because the floor is not a
    // function of the arena. Asserted against the LIVE SIM on two arenas of different size,
    // not against the formula, so a floor that quietly picked up an arena term would fail.
    const floorOn = (maxSafeRadius) => {
      const st = playingMatch(makeArena({ width: 2000, height: 2000, maxSafeRadius }));
      st.player.hp = st.player.maxHp = 1e9;
      st.enemy.hp = st.enemy.maxHp = 1e9;
      let min = Infinity;
      for (let i = 0; i < 600 && st.phase === 'playing'; i++) { stepMatch(st, 100, noInput); min = Math.min(min, st.safeRadius); }
      return min;
    };
    check('the floor is INDEPENDENT of arena size — a 2x map does not widen the final annulus',
      floorOn(R1) === floorOn(R4) && floorOn(R1) === MIN_SAFE_RADIUS,
      `${floorOn(R1)} vs ${floorOn(R4)}`);

    // The coupling `rules.ts` deliberately does NOT make: `concealmentKeepoutRadius` still
    // floors on `MIN_SAFE_RADIUS` because it cannot import `MAX_FIGHTERS`. So the
    // relationship is asserted instead — and this is the row that fails first if
    // `ENDGAME_STANDOFF` is ever derived upward past what the arena rule reserves.
    check('no concealment can sit inside the LARGEST final ring, on either arena size',
      concealmentKeepoutRadius(R1) >= minSafeRadiusFor(MAX_FIGHTERS)
      && concealmentKeepoutRadius(R4) >= minSafeRadiusFor(MAX_FIGHTERS),
      `keepout ${concealmentKeepoutRadius(R1).toFixed(2)} / ${concealmentKeepoutRadius(R4).toFixed(2)} vs ring ${minSafeRadiusFor(MAX_FIGHTERS)}`);
  }
}

// ─────────────────────────────────────────────────────────────────────────────

console.log(`\n${pass} passed, ${fail} failed`);
if (fail > 0) {
  console.log('\nFailed checks:');
  for (const f of failures) console.log(`  - ${f}`);
  process.exit(1);
}
