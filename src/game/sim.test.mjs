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
import { stepAI } from './ai.ts';
// Section 17 needs the real damage path to prove that taking a hit restarts the
// out-of-combat delay — modelling `lastDamagedAt` by hand would test the model.
import { applyDamage } from './combat.ts';
import {
  CHARACTERS, CHARACTER_IDS, PLAYER_MAX_HP, PLAYER_SIZE, PLAYER_SPEED, SLOW_MOVE_MULTIPLIER, FOG_DAMAGE, FOG_TICK_MS,
  MATCH_DURATION_MS, MIN_SAFE_RADIUS, ENEMY_MAX_HP, POT, TRAIL,
  REGEN_DELAY_MS, REGEN_TICK_MS, REGEN_AMOUNT, STUN_DURATION_MS, SLOW_DURATION_MS,
} from './rules.ts';

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

function makeArena({ cover = [], hazards = [], width = 2000, height = 2000, maxSafeRadius = 545 } = {}) {
  return {
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
  check('countdown starts at COUNTDOWN_FROM', state.countdownValue === 5);

  let sawMatchStarted = false;
  let sawFinalTick = false;
  // 5s countdown + 700ms START! flash = 5700ms. Step in 50ms increments.
  for (let i = 0; i < 120; i++) {
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

  // (c) THE FAIRNESS REGRESSION. Absolute HP favours the enemy; the HP FRACTION
  //     favours the player. Any tiebreak that compares raw HP fails this.
  {
    const { state } = atTheWhistle({ player: { hp: 60 }, enemy: { hp: 75 } });
    stepMatch(state, 200, noInput);
    check(
      `higher HP FRACTION wins, not higher HP (player ${60}/${PLAYER_MAX_HP}=0.60 beats enemy ${75}/${ENEMY_MAX_HP}=0.50)`,
      state.winner === 'player',
      `winner=${state.winner}`,
    );
  }
  {
    const { state } = atTheWhistle({ player: { hp: 50 }, enemy: { hp: 90 } });
    stepMatch(state, 200, noInput);
    check('lower HP fraction loses (player 0.50 vs enemy 0.60)', state.winner === 'enemy', `winner=${state.winner}`);
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
        id: 10_000 + i, ownerRole: 'enemy',
        x: arena.center.x, y: arena.center.y,
        expiresAt: state.elapsed + TRAIL.durationMs, damaged: false,
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
      id: 99, ownerRole: 'enemy', x: arena.center.x, y: arena.center.y,
      expiresAt: state.elapsed + TRAIL.durationMs, damaged: false,
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
// ─────────────────────────────────────────────────────────────────────────────
{
  console.log('\n14. The AI routes around obstacles a greedy rule cannot escape');

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
      width: 1400, height: 1000,
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
    const arena = makeArena({ width: 1400, height: 1000, cover: U_POCKET });
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
      width: 1400, height: 1000,
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
    stepAI(state, 16.667, events);
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
    // And a stunned AI still does not re-point, coincident or not.
    const arena = makeArena({ width: 2000, height: 2000 });
    const state = playingMatch(arena, 'hamburger', 'taco');
    state.player.x = 900; state.player.y = 700;
    state.enemy.x = 900; state.enemy.y = 900;
    state.enemy.facing = { x: 1, y: 0 };
    state.enemy.status.stunnedUntil = state.elapsed + 5000;
    stepMatch(state, 16.667, noInput);
    check('a stunned AI does not re-point at all', state.enemy.facing.x === 1 && state.enemy.facing.y === 0,
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
    applyDamage(state, 'player', 5, null, { kind: 'fog' }, events);
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

  // ── (d) status-lock RATCHET ───────────────────────────────────────────────
  //
  // A weapon whose COOLDOWN is shorter than the status it applies holds that status up
  // by itself, forever. Measured on the real sim: 4 of 5 stun weapons and 8 of 10 slow
  // weapons do, worst observed unbroken movement lock 10.37 s (Pizza's Cheese Blind,
  // 1300 ms cooldown against a 2000 ms stun = 1.54x uptime), and 47 of 110 chase
  // matchups produce a lock of 4 s or more against a mean ENGAGEMENT of 6.0 s.
  //
  // Cutting `STUN_DURATION_MS` is NOT the fix — swept, it costs the player 10.6 pp of
  // win rate at 1000 ms because the 100 HP player needs the lock against a 150 HP enemy
  // more than the enemy needs it. That is a balance decision and it is parked in
  // `docs/DECISIONS-FOR-URI.md`. What this asserts is only that it must not get WORSE:
  // a ratchet on the count, not an endorsement of it.
  {
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
    check('no MORE weapons can hold a stun up by themselves than already do (ratchet, currently 4 of 5)',
      lockers.stun <= 4, `${lockers.stun} of ${totals.stun} stun weapons re-fire inside STUN_DURATION_MS (${STUN_DURATION_MS}ms)`);
    check('no MORE weapons can hold a slow up by themselves than already do (ratchet, currently 8 of 10)',
      lockers.slow <= 8, `${lockers.slow} of ${totals.slow} slow weapons re-fire inside SLOW_DURATION_MS (${SLOW_DURATION_MS}ms)`);
  }
}

// ─────────────────────────────────────────────────────────────────────────────

console.log(`\n${pass} passed, ${fail} failed`);
if (fail > 0) {
  console.log('\nFailed checks:');
  for (const f of failures) console.log(`  - ${f}`);
  process.exit(1);
}
