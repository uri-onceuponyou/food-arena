/**
 * Arena contract.
 *
 * The brief froze the game design with ONE sanctioned exception: the arena. Layout,
 * prop count, scale and specific set-dressing are open to redesign. What must survive
 * is the gameplay *types*:
 *
 *   1. a central hazard players must avoid (the prototype's boiling pot),
 *   2. physical cover objects with real collision,
 *   3. at least one hazard that slows anyone standing in it (the puddle).
 *
 * Everything the simulation needs is expressed in PROTOTYPE WORLD UNITS (see
 * `src/units.ts`), so the frozen balance numbers in `game/rules.ts` keep working
 * unchanged no matter how the arena is redressed.
 */

import type * as THREE from 'three';
// TYPE-ONLY, and it has to be: `game/movement.ts` imports `ArenaDefinition` from this
// file, so a VALUE import here would close a runtime cycle. `import type` is erased
// entirely by tsc and by esbuild, so no cycle exists in the emitted graph.
//
// `ConcealBox` is declared in `movement.ts` rather than beside `CoverBox` below because
// that module owns the concealment GEOMETRY — `isConcealed`, `isVisibleFrom` and the
// keepout guard all live there, and the type travels with the predicates that read it.
import type { ConcealBox } from '../game/movement';

/** Axis-aligned solid box. Movement and projectiles both collide against these. */
export interface CoverBox {
  /** Centre, in world units. */
  x: number;
  y: number;
  /** Full extents, in world units. */
  w: number;
  h: number;
  /** Purely descriptive — useful for debugging and for VFX to pick an impact sound. */
  kind?: string;
}

/** Circular area effect on the ground. */
export interface HazardZone {
  x: number;
  y: number;
  radius: number;
  kind: 'damage' | 'slow';
  /** `damage` only: HP per tick and tick period, in ms. */
  damage?: number;
  tickMs?: number;
  /** `slow` only: movement multiplier applied while inside. */
  slowFactor?: number;
}

export interface ArenaDefinition {
  id: string;
  displayName: string;

  /** Playfield extents in world units. The prototype was 900 x 600. */
  width: number;
  height: number;

  /** Where the closing fog ring contracts toward. */
  center: { x: number; y: number };
  /** Fog radius at match start, in world units. */
  maxSafeRadius: number;

  /** Spawn points, in world units. */
  playerSpawn: { x: number; y: number };
  enemySpawn: { x: number; y: number };

  /**
   * EVERY SEAT'S START, IN SLOT ORDER — the N-fighter superset of the two above.
   *
   * ── 🚨 WHY THIS IS AN ADDITION AND NOT A REPLACEMENT ────────────────────────
   * `playerSpawn` / `enemySpawn` have **74 `createMatch` call sites and 1,307 references,
   * 1,089 of them (83%) in untyped `.mjs`** that `tsc` cannot see. Replacing the pair would
   * not produce a compile break that finds them; it would produce a silent runtime break in
   * the tools that measure the game. So this list is added ALONGSIDE, and
   * `spawns[0]`/`spawns[1]` **are** `playerSpawn`/`enemySpawn` — not copies of their
   * coordinates, the same two objects, so they cannot drift. A two-fighter match reads
   * exactly what it read before (`conceal_lab --bitid`: **0 differing ticks in 41,722,453**).
   *
   * ── WHY IT EXISTS AT ALL: `sim.ts:defaultSpawn` THREW ────────────────────────
   * `createMatch` refused slot 2 and up rather than inventing a ring, because spawn
   * placement for 4-6 fighters is arena geometry and `DECISIONS §48` makes true 180° point
   * symmetry a **competitive-fairness** constraint in the same category as `tools/aspect.mjs`.
   * A default invented in `sim.ts` would be a second, quieter source of truth for it, it
   * would produce balance numbers, and it would look like it worked. This field is the owner
   * that refusal was waiting for.
   *
   * ── THE CONTRACT ON WHOEVER AUTHORS ONE ─────────────────────────────────────
   *   * **PAIRS, ALWAYS.** Entry `2k` and entry `2k+1` must be exact 180° images of each
   *     other about `center`. An ODD count is geometrically impossible: the unpaired spawn
   *     would have to be its own image, i.e. sit exactly on `center` — which on the shipped
   *     kitchen is inside the boiling pot's own CoverBox and inside the 248.25 wu endgame
   *     keep-out. The concealment list has the identical constraint for the identical reason.
   *   * **INTERLEAVED, SO EVERY EVEN N IS SYMMETRIC.** Slots 0..N-1 are what an N-fighter
   *     match seats, so ordering the list pair-by-pair makes N=2, N=4 and N=6 each a
   *     complete set of mirror pairs. N=3 and N=5 cannot be symmetric at any ordering.
   *   * **EVERY ENTRY MUST PASS `tools/tmp/spawn_runway.mjs`** — 60 wu of clear travel in
   *     all four cardinals over a ±21 wu lateral band, and no run may STOP inside a damage
   *     hazard. That rule is not a formality here: it is what makes this list *hard*. See
   *     `kitchen.ts`'s spawn block for what it costs on a 1400×1000 map.
   *   * **AND THE FAIRNESS IT BUYS IS PAIRWISE, NOT GLOBAL.** A C2-symmetric map can promise
   *     `seat 2k ≡ seat 2k+1` and nothing more; making pair A congruent to pair B would need
   *     the arena itself to be invariant under a 3-fold rotation, and it is not.
   *
   * Optional: an arena that omits it plays exactly as it did before the field existed, and
   * `createMatch` goes back to throwing above slot 1 — which is the correct behaviour for an
   * arena that has not done this work.
   */
  spawns?: readonly { x: number; y: number }[];

  cover: CoverBox[];
  hazards: HazardZone[];

  /**
   * WALK-THROUGH CONCEALMENT — plates, pot lids, crates and stacked trays you hide
   * UNDER. Optional: an arena that omits it plays exactly as it did before the
   * mechanic existed, and that is proven rather than assumed
   * (`tools/tmp/conceal_lab.mjs --bitid`: 0 differing ticks in 3,283,873).
   *
   * ⚠️ **A SEPARATE LIST FROM `cover`, AND THE SEPARATION IS THE WHOLE MECHANIC.**
   * Nothing in `tryMove`, `escapeCover`, `collidesWithCover`, the nav grid or the
   * projectile wall test ever reads this array, so "walk-through" is a property of the
   * data model instead of a rule every future reader has to remember. `ConcealBox` is
   * deliberately a DIFFERENT TYPE from `CoverBox` despite identical fields, so putting
   * a plate in `cover` (solid, blocks movement) or a counter in `concealment`
   * (walk-through, blocks nothing) is visible at the declaration site rather than
   * silently accepted by structural typing.
   *
   * The rule it buys is one sentence — *while you are concealed, nothing that tracks
   * you updates* — stated once in `game/rules.ts` under "CONCEALMENT" and implemented
   * once in `movement.ts:isConcealed`/`isVisibleFrom`. Five historical `ai.ts` defects
   * were all "stated once, implemented twice"; this is what stops the sixth.
   *
   * ⚠️ **TWO CONSTRAINTS ON WHOEVER AUTHORS THE BOXES**, both measured, both asserted
   * in `sim.test.mjs` §26 rather than left as prose:
   *
   *   * **SIZE.** `stepAI` has no search behaviour — it walks to where it last saw you
   *     and can see `CONCEAL_REVEAL_RADIUS` (84 wu) from there. A region a player can
   *     cross while staying inside is a permanent AI-denial zone (measured: at 2x the
   *     radius the AI *never* re-acquires — final separation 363 wu). Keep patches
   *     under roughly **168 wu** across.
   *   * **THE ENDGAME ANNULUS.** No region may reach within
   *     `rules.ts:concealmentKeepoutRadius(maxSafeRadius)` of `center` — 248.25 wu on
   *     the shipped kitchen — measured on the box's NEAREST point, because a band whose
   *     centre is legal can still reach the hub. `movement.ts:concealmentKeepoutViolations`
   *     is the guard.
   */
  concealment?: ConcealBox[];

  /** The renderable scene graph. Feet of all props sit at y=0. */
  build(): THREE.Group;

  /**
   * Per-frame hook for ambient life — steam, bubbling, flickering flame, drifting
   * dust. Optional, but it is a large part of why a real game's arena feels alive
   * rather than like a static diorama.
   */
  update?(dt: number, elapsed: number): void;
}

export type ArenaFactory = () => ArenaDefinition;
