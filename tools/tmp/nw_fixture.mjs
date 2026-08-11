#!/usr/bin/env node
/**
 * NW FIXTURE — a self-contained arena and a state-builder for the netcode gates.
 *
 * ── WHY THIS DOES NOT READ `tools/arena.gameplay.json` ──────────────────────────
 *
 * That cache is the right input for a BALANCE instrument, which has to measure the arena the
 * game ships. These gates measure a CODEC, and a codec's correctness is a property of the
 * shapes it meets, not of where the cover happens to sit. Reading the cache would make every
 * number here a function of a file four peers are editing right now — `AGENT-BRIEF` §3:
 * *"snapshot.mjs copies the WORKING tree — 'frozen' is not 'clean'."*
 *
 * So the fixture is built here, in one place, and it is deliberately built to be HOSTILE to
 * the codec rather than typical:
 *
 *   * **six spawns**, so N=6 is reachable (`createMatch` throws above slot 1 without them);
 *   * **a `concealment` list**, so `MatchState.brokenConcealment` can hold real arena
 *     references — 🚨 **without this the `conceal/identity` guard is VACUOUS**, because every
 *     shipped arena declares no concealment at all and an empty list passes every check
 *     trivially. `CLAUDE.md` #6: a guard that cannot fail is not a guard;
 *   * **four hazards**, so `Fighter.hazardTimers` can be given real array HOLES;
 *   * **an aliased pair** (`spawns[0]` IS `playerSpawn`, the same object), exactly as
 *     `arena/types.ts` specifies, so the registry's first-path-wins rule is exercised.
 *
 * A tool that exports needs an `IS_MAIN` guard (three in this repo did not, and importing one
 * of them printed a live sweep report). This one has it: run it directly and it prints the
 * fixture's shape; import it and it does nothing.
 */

import { createMatch, stepMatch } from '../../src/game/sim.ts';
import { createRng } from '../../src/game/economy/rng.ts';

/**
 * A 2800x2000 arena with six 180-degree-symmetric spawns.
 *
 * ⚠️ **NOT A LAYOUT CLAIM AND NOT A BALANCE FIXTURE.** `src/arena/kitchen.ts` owns the real
 * one and `sp_place`/`sp_gate`/`ap_reach` own whether a layout is fair. Nothing here is
 * measured against a gameplay rule; these coordinates exist so `createMatch` seats six and so
 * the codec meets every shape it has to carry.
 */
export function makeFixtureArena(tweak = 0) {
  const W = 2800;
  const H = 2000;
  const center = { x: W / 2, y: H / 2 };
  // The alias `arena/types.ts` mandates: spawns[0] IS playerSpawn, the same object.
  const playerSpawn = { x: 400, y: 1000 + tweak };
  const enemySpawn = { x: 2400, y: 1000 - tweak };
  const spawns = [
    playerSpawn, enemySpawn,
    { x: 900, y: 320 }, { x: 1900, y: 1680 },
    { x: 900, y: 1680 }, { x: 1900, y: 320 },
  ];
  return {
    id: 'nw-fixture',
    displayName: 'Netcode fixture',
    width: W,
    height: H,
    center,
    maxSafeRadius: 1200,
    playerSpawn,
    enemySpawn,
    spawns,
    cover: [
      { x: 700, y: 700, w: 160, h: 120, kind: 'counter' },
      { x: 2100, y: 1300, w: 160, h: 120, kind: 'counter' },
      { x: 1400, y: 600, w: 200, h: 90, kind: 'island' },
      { x: 1400, y: 1400, w: 200, h: 90, kind: 'island' },
    ],
    hazards: [
      { x: center.x, y: center.y, radius: 130, kind: 'damage', damage: 4, tickMs: 400 },
      { x: 800, y: 1500, radius: 150, kind: 'slow', slowFactor: 0.45 },
      { x: 2000, y: 500, radius: 150, kind: 'slow', slowFactor: 0.45 },
      { x: 1200, y: 1100, radius: 90, kind: 'damage', damage: 2, tickMs: 500 },
    ],
    // Small (well under the ~168 wu cap) and well outside the endgame keepout, per
    // `arena/types.ts`'s two authoring constraints. Present so the reference-identity guard
    // has something to guard.
    concealment: [
      { x: 620, y: 1320, w: 120, h: 100, kind: 'plate' },
      { x: 2180, y: 680, w: 120, h: 100, kind: 'plate' },
      { x: 1050, y: 520, w: 110, h: 90, kind: 'tray' },
      { x: 1750, y: 1480, w: 110, h: 90, kind: 'tray' },
    ],
    // Required by `ArenaDefinition`, never called here — and its presence is the reason
    // `wire.ts:fingerprintJson` has to tolerate a function at all.
    build() { throw new Error('nw_fixture: build() is not renderable in Node'); },
  };
}

const CAST = ['hamburger', 'sushi', 'taco', 'pizza', 'donut', 'waterbottle'];

/** Slot-ordered fighter configs for an N-seat match on the fixture. */
export function fixtureConfigs(arena, n, { humans = 1 } = {}) {
  const out = [];
  for (let i = 0; i < n; i++) {
    out.push({
      characterId: CAST[i % CAST.length],
      controller: i < humans ? 'human' : 'ai',
      level: 1 + (i % 5),
      spawn: { x: arena.spawns[i].x, y: arena.spawns[i].y },
    });
  }
  return out;
}

/**
 * A deterministic input STIMULUS. Not a driver, and not a model of a player.
 *
 * ⚠️ Every number this produces is a function of `(seed, tick, slot)` and of nothing else, so
 * a state built from it is reproducible across runs and machines. It exists to make the sim
 * produce projectiles, trail marks, splats, damage and status timers — the shapes the codec
 * has to carry — and it is explicitly **not** a balance instrument: `tools/tmp/scripted_player.mjs`
 * is the shared driver and this is not a copy of it, does not import it, and makes no claim
 * any balance number could rest on.
 */
export function stimulus(seed, tick, slot) {
  const rng = createRng(seed * 7919 + tick * 131 + slot * 17);
  const a = rng.next() * Math.PI * 2;
  return {
    move: { x: Math.round(Math.cos(a) * 100) / 100, y: Math.round(Math.sin(a) * 100) / 100 },
    aim: { x: Math.cos(a + 0.7), y: Math.sin(a + 0.7) },
    selectedWeapon: rng.int(3),
    attack: rng.next() < 0.35,
  };
}

/**
 * Run a match forward and hand back a state that has actually been LIVED IN.
 *
 * The point is coverage of shapes, not of gameplay: by 400 ticks a six-seat match on this
 * fixture has projectiles in flight, trail marks with a non-zero `damagedMask`, splats,
 * advanced `lastUsed` cooldowns, at least one fighter with `-Infinity` still in place and at
 * least one with it overwritten. Options force the two shapes the sim will not produce on
 * demand.
 */
export function buildLivedState(arena, n, { ticks = 400, seed = 12345, dt = 1000 / 60, humans = 1, holes = true, broken = true } = {}) {
  const state = createMatch(arena, fixtureConfigs(arena, n, { humans }));
  for (let t = 0; t < ticks; t++) {
    const inputs = [];
    for (let s = 0; s < n; s++) inputs.push(s < humans ? stimulus(seed, t, s) : null);
    stepMatch(state, dt, inputs);
    if (state.phase === 'ended') break;
  }
  if (holes) {
    // ── REAL ARRAY HOLES, reachable in the shipped sim ──
    // `sim.ts:applyWorldTick` writes `fighter.hazardTimers[idx]` at the HAZARD'S index, and
    // `state.ts` documents the array as "sparse; grows lazily". A fighter that meets hazard 3
    // before hazard 0 therefore has holes at 0..2. Forced here because which hazard a fighter
    // meets first is a property of the layout, not of the codec.
    state.fighters[0].hazardTimers[3] = 12.5;
  }
  if (broken && arena.concealment && arena.concealment.length > 0) {
    // ── REAL ARENA REFERENCES in `brokenConcealment` ──
    // `combat.ts:attemptAttack` pushes boxes here by reference when a fighter attacks from
    // inside one. Forced, because that needs a fighter standing in a plate at the moment it
    // fires. What matters to the codec is that these are THE SAME OBJECTS as the arena's.
    state.brokenConcealment.push(arena.concealment[0], arena.concealment[2]);
  }
  return state;
}

/** `IS_MAIN` guard — see the header. Importing this file must have no side effects. */
const IS_MAIN = import.meta.url === `file://${process.argv[1]}`;
if (IS_MAIN) {
  const arena = makeFixtureArena();
  for (const n of [2, 6]) {
    const st = buildLivedState(arena, n);
    console.log(`N=${n}  phase=${st.phase} elapsed=${st.elapsed.toFixed(1)}ms`
      + ` fighters=${st.fighters.length} projectiles=${st.projectiles.length}`
      + ` trailMarks=${st.trailMarks.length} splats=${st.splats.length}`
      + ` sightings=${st.sightings.length} broken=${st.brokenConcealment.length}`);
  }
}
