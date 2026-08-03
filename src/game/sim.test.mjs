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
import { CHARACTERS, PLAYER_MAX_HP, PLAYER_SIZE, PLAYER_SPEED, SLOW_MOVE_MULTIPLIER, FOG_DAMAGE, FOG_TICK_MS } from './rules.ts';

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
  state.timeRemaining = 90_000;

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
    state.timeRemaining = 90_000; // 50% progress -> safeRadius 272.5 < 400

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
    state.timeRemaining === 180_000 - 50,
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

console.log(`\n${pass} passed, ${fail} failed`);
if (fail > 0) {
  console.log('\nFailed checks:');
  for (const f of failures) console.log(`  - ${f}`);
  process.exit(1);
}
