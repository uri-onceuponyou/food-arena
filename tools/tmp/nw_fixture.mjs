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
import {
  COUNTDOWN_FROM, COUNTDOWN_START_FLASH_MS, MATCH_DURATION_MS, SUDDEN_DEATH_MS,
} from '../../src/game/rules.ts';

/**
 * ── THE TICK BUDGETS, DERIVED — AND WHY THEY USED TO BE LITERALS ────────────
 *
 * 🚨 `buildSuddenDeathState` defaulted to **`maxTicks = 4000`** and `buildEndedState` to
 * **`6000`**. Both were sized against a clock that no longer exists: 4000 ticks is **66.7 s**
 * against a sudden death that `6d5c4d6` moved to **138.7 s**, and 6000 ticks is **100 s**
 * against a timeout that cannot arrive before **153.7 s**.
 *
 * ⚠️ **AND THE FIRST ONE WAS ALREADY BITING, LOUDLY.** `node tools/tmp/nw_fixture.mjs` — this
 * file's own demo, which exists so a reader can see the fixture's shape — threw on its first
 * `suddenDeath` row. That is the builder's throw doing precisely what its header promises, so
 * the failure was never a wrong number; it was a broken demo that reads like a broken fixture.
 * `nw_delta` had already worked around it by deriving the bound **caller-side**, and said in
 * its own comment that `nw_fixture.mjs` "is not this file's to change".
 *
 * ── SHOULD A DEFAULT EXIST AT ALL? ──────────────────────────────────────────
 * The case for refusing without an explicit bound is *"a throw beats a wrong number"* — but
 * **a too-small bound here already throws**, with `phase`, `safeRadius` and `elapsed` in the
 * message, so there is no wrong number to prevent. What refusing WOULD do is push this
 * derivation into every caller, and a duplicated derivation that agrees by construction until
 * a constant moves is exactly the defect `c858e3e` removed from `ax_layout`'s fog formula.
 * So: **derive it once, here, and keep the throw as the backstop.**
 *
 * ── THE BOUNDS ARE EXACT, AND THAT IS ASSERTED RATHER THAN PADDED ───────────
 * After step index `t` the state holds `elapsed = (t+1) * dt`, so the first index at which a
 * milestone at `X` ms has been reached is `ceil(X / dt) - 1`, and a loop bounded by
 * `ceil(X / dt)` reaches it with nothing to spare. Measured on the shipped fixture at
 * `dt = 1000/60`: `safeRadius === 0` first at tick **8321** (elapsed 138 700 ms) at BOTH N=2
 * and N=6, `+ dwell` → **8352**; and **8351 throws**. The bound is not padded, deliberately —
 * `nw_delta`'s caller-side copy carried `+ 2000 ms + 60` of slack, and slack is how a bound
 * stops describing anything. If the sim ever arms the collapse a tick later, this throws and
 * says so, which is the report you want.
 */
const COUNTDOWN_MS = COUNTDOWN_FROM * 1000 + COUNTDOWN_START_FLASH_MS;

/** Ticks needed for `elapsed` to REACH `ms`, at `dt`. Exclusive bound for a `t < n` loop. */
export const ticksToReach = (ms, dt) => Math.ceil(ms / dt);

/**
 * The tick at which `safeRadius` collapses to 0, plus the dwell the builder wants after it.
 * `SUDDEN_DEATH_MS` is PLAY milliseconds (`sim.ts` keys it off `timeRemaining`, not
 * `elapsed`), so the countdown is paid on top — the same asymmetry `fogRadiusAt` documents.
 */
export const suddenDeathTicks = (dt, dwell) => ticksToReach(COUNTDOWN_MS + SUDDEN_DEATH_MS, dt) + dwell;

/**
 * The tick by which a match MUST be over: `resolveTimeout` fires at `timeRemaining <= 0`.
 * ⚠️ Not observably wrong at the shipped seed — N=2 ends by knockout at tick 1994 and N=6 at
 * 2915, so the old 6000 was never reached — which is exactly why it survived. **A bound that
 * no longer bounds is still a defect**; the first stalemate seed anyone tries would have hit it.
 */
export const endedTicks = (dt) => ticksToReach(COUNTDOWN_MS + MATCH_DURATION_MS, dt);

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
export function buildLivedState(arena, n, { ticks = 400, seed = 12345, dt = 1000 / 60, humans = 1 } = {}) {
  const state = createMatch(arena, fixtureConfigs(arena, n, { humans }));
  for (let t = 0; t < ticks; t++) {
    const inputs = [];
    for (let s = 0; s < n; s++) inputs.push(s < humans ? stimulus(seed, t, s) : null);
    stepMatch(state, dt, inputs);
    if (state.phase === 'ended') break;
  }
  return forceEdgeShapes(state, arena);
}

/**
 * The two shapes the sim will not produce on demand, forced onto a finished state.
 *
 * Stated ONCE and applied by all three builders, rather than inline in each — a fixture that
 * covers a shape in one arm and quietly not in another is a coverage claim nobody can check.
 * Both are reachable in the shipped sim; which arm reaches them is a property of the layout and
 * of who walked where, not of the codec.
 */
function forceEdgeShapes(state, arena) {
  // REAL ARRAY HOLES: `sim.ts:applyWorldTick` writes `hazardTimers` at the HAZARD'S index and
  // `state.ts` documents the array as "sparse; grows lazily", so meeting hazard 3 before hazard
  // 0 leaves holes at 0..2.
  state.fighters[0].hazardTimers[3] = 12.5;
  // REAL ARENA REFERENCES: `combat.ts:attemptAttack` pushes boxes here BY REFERENCE when a
  // fighter attacks from inside one. Without these the `conceal/identity` guard is vacuous.
  if (arena.concealment && arena.concealment.length > 0 && state.brokenConcealment.length === 0) {
    state.brokenConcealment.push(arena.concealment[0], arena.concealment[2]);
  }
  return state;
}

/**
 * A state with the SUDDEN-DEATH RING COLLAPSED — `DECISIONS §2`, shipped in `f87d407`.
 *
 * 🚨 **THE FIXTURE DID NOT COVER THIS AND THE CODEC HAD NEVER SEEN IT.** `buildLivedState`
 * runs 400 ticks = 6.67 s. Sudden death arms at `SUDDEN_DEATH_MS`, which is **30 s of PLAYING**
 * — about tick 2,023 once the ~223-tick countdown is paid — so every wire number this repo had
 * was measured on states where `safeRadius` was still hundreds of world units and nobody had
 * died. `MatchState` now reaches `safeRadius === 0` with the whole arena lethal, which is a
 * region of the state space the round trip had never been asked about.
 *
 * ⚠️ **IT THROWS IF IT DOES NOT GET THERE**, rather than returning whatever it ended up with.
 * A builder that silently hands back an ordinary mid-match state would make the new coverage
 * fake while every check went green — the same failure shape as the two known-bads in
 * `nw_stack.mjs` that passed falsely because they tampered with a tick inside the countdown.
 */
export function buildSuddenDeathState(arena, n, {
  seed = 4242, dt = 1000 / 60, humans = 1, dwell = 30,
  // ⚠️ WAS `maxTicks = 4000` — 66.7 s against a 138.7 s collapse. See the tick-budget block
  // at the top of this file: the literal was sized on the pre-`6d5c4d6` clock, this file's own
  // demo threw on it, and `nw_delta` had to derive the bound caller-side to get past it.
  // ⚠️ `dwell` is listed BEFORE `maxTicks` on purpose — a destructuring default may only read
  // bindings to its left, and this one reads both `dt` and `dwell`.
  maxTicks = suddenDeathTicks(dt, dwell),
} = {}) {
  const state = createMatch(arena, fixtureConfigs(arena, n, { humans }));
  let armedAt = -1;
  for (let t = 0; t < maxTicks; t++) {
    const inputs = [];
    for (let s2 = 0; s2 < n; s2++) inputs.push(s2 < humans ? stimulus(seed, t, s2) : null);
    stepMatch(state, dt, inputs);
    // ── 🚨 FORCED IMMORTAL, AND IT IS THE ONLY WAY TO GET HERE ──────────────────
    // First attempt ran a plain match and threw: **N=2 ends by knockout at 13.35 s** and sudden
    // death arms at 30 s of playing, so a duel NEVER reaches it. That is a fact about the game,
    // not a limitation of the fixture — and it is worth recording, because it means the state
    // region this arm covers is one only a stalemate produces.
    // `match-sim.mjs`'s forced-immortal idiom is what the §49a timeout corpus already uses for
    // exactly this reason. HP is pinned AFTER the tick, so every damage event, `lastDamagedAt`
    // write and ring interaction still happens; only the death is suppressed.
    for (const f of state.fighters) { f.hp = f.maxHp; f.alive = true; }
    if (armedAt < 0 && state.phase === 'playing' && state.safeRadius === 0) armedAt = t;
    if (armedAt >= 0 && t - armedAt >= dwell) return forceEdgeShapes(state, arena);
    if (state.phase === 'ended') break;
  }
  throw new Error(`buildSuddenDeathState: N=${n} never reached safeRadius 0`
    + ` (phase ${state.phase}, safeRadius ${state.safeRadius}, elapsed ${state.elapsed.toFixed(0)}ms)`);
}

/**
 * A state after the whistle: `phase === 'ended'`, a winner recorded, corpses in the array.
 *
 * The shapes only this arm produces are the ones a mid-match state cannot have —
 * `winner`/`winnerId` non-null (so the legacy mirror is exercised on a real value rather than
 * on `null`), `alive: false` with `deaths: 1`, and `lastDamagedAt` holding a real timestamp
 * where a fresh fighter holds `-Infinity`. Throws if the match never ends, for the same reason
 * as above.
 */
export function buildEndedState(arena, n, {
  seed = 4242, dt = 1000 / 60, humans = 1,
  // ⚠️ WAS `maxTicks = 6000` — 100 s, short of the 153.7 s a TIMEOUT needs. Unlike the
  // sudden-death bound this one was never observed to bite, because every shipped seed ends by
  // knockout first; see `endedTicks`.
  maxTicks = endedTicks(dt),
} = {}) {
  const state = createMatch(arena, fixtureConfigs(arena, n, { humans }));
  for (let t = 0; t < maxTicks; t++) {
    const inputs = [];
    for (let s2 = 0; s2 < n; s2++) inputs.push(s2 < humans ? stimulus(seed, t, s2) : null);
    stepMatch(state, dt, inputs);
    if (state.phase === 'ended') return forceEdgeShapes(state, arena);
  }
  throw new Error(`buildEndedState: N=${n} still ${state.phase} after ${maxTicks} ticks`);
}

/** `IS_MAIN` guard — see the header. Importing this file must have no side effects. */
const IS_MAIN = import.meta.url === `file://${process.argv[1]}`;
if (IS_MAIN) {
  const arena = makeFixtureArena();
  const show = (label, st) => {
    console.log(`${label.padEnd(18)} phase=${st.phase.padEnd(8)} elapsed=${st.elapsed.toFixed(0).padStart(6)}ms`
      + ` safeR=${st.safeRadius.toFixed(1).padStart(7)} fighters=${st.fighters.length}`
      + ` alive=${st.fighters.filter((f) => f.alive).length}`
      + ` winnerId=${String(st.winnerId)}`
      + ` proj=${st.projectiles.length} trails=${st.trailMarks.length} splats=${st.splats.length}`
      + ` broken=${st.brokenConcealment.length}`);
  };
  for (const n of [2, 6]) show(`lived N=${n}`, buildLivedState(arena, n));
  for (const n of [2, 6]) show(`suddenDeath N=${n}`, buildSuddenDeathState(arena, n));
  for (const n of [2, 6]) show(`ended N=${n}`, buildEndedState(arena, n));
}
