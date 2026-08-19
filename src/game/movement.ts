/**
 * Shared movement/collision helpers, plus the coarse-grid navigation the AI steers by.
 *
 * Split out of `sim.ts` so `ai.ts` can move the enemy fighter with the exact same
 * collision rule as the player without either module importing the other (sim.ts
 * drives both player movement and `ai.ts`; a `sim.ts` <-> `ai.ts` import cycle would
 * result if this lived in either of them).
 *
 * `CoverBox` (see `src/arena/types.ts`) is centre + full-extent, unlike the raw
 * top-left-corner boxes the prototype's `OBSTACLES` array used — arena geometry is
 * the one sanctioned exception to the frozen design, so this adapts to whatever
 * contract the arena module now exposes rather than copying prototype literals.
 *
 * Three layers live here and they are deliberately separate:
 *
 *   * RECOVERY — `escapeCover`. Restores the invariant everything else assumes: a
 *     fighter that is trying to move is not inside a box.
 *   * LOCAL — `tryMove` / the detour block in `moveToward`. Per-axis collision
 *     resolution and wall-sliding. Knows only what the mover is touching this tick.
 *   * GLOBAL — the flow field. Knows the whole map, and answers the one question no
 *     amount of local cleverness can: *which way is the exit?*
 *
 * The local layer alone is what `docs/STATE.md` item 7 recorded as insufficient, and
 * the reason is structural rather than a tuning miss: see the block comment on `NAV_CELL`.
 */

import type { ArenaDefinition, CoverBox } from '../arena/types.ts';
import type { Fighter, Splat } from './state.ts';
import {
  CONCEAL_REVEAL_RADIUS, concealmentKeepoutRadius, PUDDLE_SLOW_FACTOR, SPLAT_RADIUS,
} from './rules.ts';

/** True if two centre+full-extent AABBs overlap. */
export function boxesOverlap(
  ax: number,
  ay: number,
  aw: number,
  ah: number,
  bx: number,
  by: number,
  bw: number,
  bh: number,
): boolean {
  return Math.abs(ax - bx) < (aw + bw) / 2 && Math.abs(ay - by) < (ah + bh) / 2;
}

/**
 * Plain loop rather than `cover.some(fn)`: this is now called tens of times per tick
 * by the navigation layer's line-of-sight walk, and a per-call closure in that path is
 * the kind of thing that shows up in an allocation budget (`tools/perf.mjs --mode alloc`)
 * without ever showing up in a profile. Behaviour is identical.
 */
function collidesWithCover(cx: number, cy: number, size: number, cover: CoverBox[]): boolean {
  for (let i = 0; i < cover.length; i++) {
    const o = cover[i];
    if (Math.abs(cx - o.x) < (size + o.w) / 2 && Math.abs(cy - o.y) < (size + o.h) / 2) return true;
  }
  return false;
}

// ─────────────────────────────────────────────────────────────────────────────
// CONCEALMENT — the two predicates every reader in the sim calls
//
// The rule, its derivation and everything it deliberately does NOT do live in
// `rules.ts` under "CONCEALMENT". This file owns the GEOMETRY, for the same structural
// reason `boxesOverlap` and `tryMove` live here rather than in `sim.ts`: `sim.ts` imports
// `ai.ts`, so `ai.ts` cannot import `sim.ts`, and both already import this module. A
// predicate placed in `sim.ts` would have forced `ai.ts` to grow its own copy — which is
// the "stated once, implemented twice" shape that produced five AI defects.
// ─────────────────────────────────────────────────────────────────────────────

/**
 * Axis-aligned WALK-THROUGH region. Same `{x, y, w, h, kind}` shape as `CoverBox` — centre
 * plus full extents — deliberately, so `boxesOverlap` is reused verbatim rather than a
 * second overlap test being written next to the first one.
 *
 * It is a DIFFERENT TYPE from `CoverBox` even though the fields are identical, because the
 * one thing that must never happen is a concealment box reaching `arena.cover` or a cover
 * box reaching `arena.concealment`. Structural typing would let either pass silently; two
 * nominally-distinct interfaces at least make the mistake visible at the declaration site.
 */
export interface ConcealBox {
  /** Centre, in world units. */
  x: number;
  y: number;
  /** Full extents, in world units. */
  w: number;
  h: number;
  /** Purely descriptive — which prop class drew it, for VFX and for debugging. */
  kind?: string;
}

/**
 * ⚠️ `ArenaDefinition` DOES NOT DECLARE `concealment` YET, AND THAT IS ON PURPOSE.
 *
 * `src/arena/types.ts` belongs to the arena file set, which was mid-measurement when this
 * landed, and this project's hardest constraint is one owner per file set. So the sim
 * reads the field STRUCTURALLY through this one accessor instead. Every other module goes
 * through `isConcealed`/`isVisibleFrom` and never touches the cast.
 *
 * WHEN THE ARENA OWNER ADDS `concealment?: ConcealBox[]` TO `ArenaDefinition`, delete
 * `ConcealArena` and the intersection below; nothing else changes, and `tsc` will point at
 * the two lines. Until then an arena that supplies the field works, an arena that does not
 * gets an empty list, and — this is the acceptance test, not an assumption — an empty list
 * is bit-identical to no field at all.
 */
type ConcealArena = { readonly concealment?: readonly ConcealBox[] };

/** Shared empty list, so the common case allocates nothing on the hot path. */
const NO_CONCEALMENT: readonly ConcealBox[] = [];

/** This arena's concealment regions, or an empty list for an arena that has none. */
export function concealmentOf(arena: ArenaDefinition): readonly ConcealBox[] {
  return (arena as ArenaDefinition & ConcealArena).concealment ?? NO_CONCEALMENT;
}

/**
 * ⚠️ THE PER-MATCH HALF OF CONCEALMENT, AND WHY IT IS A SEPARATE ARGUMENT.
 *
 * `ArenaDefinition` is shared, immutable data — one object serves every match a process
 * runs (see `MatchState.brokenConcealment`). Two facts about concealment are NOT properties
 * of the arena and cannot be stored on it: **which regions this match has destroyed**, and
 * **when the target last attacked**. Both arrived with `DECISIONS §29c`.
 *
 * `MatchState` satisfies this structurally, so every gameplay reader passes `state` itself
 * and assembles nothing — this runs on every tick of every match and the concealment path
 * must stay allocation-free (`tools/perf.mjs --mode alloc`).
 */
export interface ConcealMatch {
  /** `MatchState.elapsed` — the clock `ConcealTarget.revealedUntil` is expressed on. */
  readonly elapsed: number;
  /** `MatchState.brokenConcealment` — the regions destroyed this match. */
  readonly brokenConcealment: readonly ConcealBox[];
}

/**
 * The observed fighter, for the one fact about it that geometry cannot answer.
 * `Fighter` satisfies this structurally.
 *
 * It is a separate parameter from `(tx, ty)` rather than replacing them, and that
 * redundancy is deliberate: it keeps the five-argument `isVisibleFrom(ox, oy, tx, ty,
 * arena)` — which `ui/hud.ts` and `tools/tmp/conceal_lab.mjs --selftest` both call, neither
 * of them in this owner's file set — a valid call that still means exactly what it always
 * meant, instead of a compile error in three files at once.
 */
export interface ConcealTarget {
  /** `Fighter.revealedUntil`. */
  readonly revealedUntil: number;
}

/** Has this region been destroyed this match? Reference identity — see `brokenConcealment`. */
function isBroken(b: ConcealBox, match: ConcealMatch | undefined): boolean {
  if (!match) return false;
  const broken = match.brokenConcealment;
  for (let i = 0; i < broken.length; i++) if (broken[i] === b) return true;
  return false;
}

/**
 * Is the point (x, y) inside a concealment region?
 *
 * ── CENTRE-IN-BOX, NOT AABB OVERLAP, AND NOT FULL CONTAINMENT ───────────────
 *
 * The fighter's CENTRE decides, which is the same membership rule
 * `sim.ts:terrainSlowFactor` already applies to hazards and splats (`hypot(fighter - hz) <
 * hz.radius` is a centre test too). The two alternatives were both rejected on measurement
 * rather than taste:
 *
 *   * AABB OVERLAP (`boxesOverlap(x, y, size, size, ...)`) hides a fighter that is merely
 *     brushing a box's corner by 1 wu, which is the "I was clearly standing in the open"
 *     complaint, and it makes the hidden area 42 wu larger than the drawn geometry in
 *     every direction — the render/sim mismatch `docs/LESSONS.md` §1 keeps finding.
 *   * FULL CONTAINMENT requires every box to exceed `PLAYER_SIZE` (42 wu) in both axes to
 *     be usable at all. The probe's headline finding is that the reference delivers its
 *     density as *"dozens of small tufts in lane-aligned bands"* while ours is 2-3 huge
 *     blocks (top-2 kinds own 74.3% of all cover pixels), so a rule that forbids small
 *     patches forbids the exact shape being chased.
 *
 * Expressed through `boxesOverlap` with a zero-extent probe box rather than as a fresh
 * inequality, so there is one AABB test in this file and not two.
 *
 * ── `match` — THE REGIONS THAT ARE STILL STANDING ───────────────────────────
 *
 * Pass it and a region destroyed by `breakConcealment` (`DECISIONS §29c`) is skipped;
 * omit it and the answer is about the arena's DECLARED regions, which is exactly what this
 * function meant before §29c and what the geometry-only callers still want.
 */
export function isConcealed(x: number, y: number, arena: ArenaDefinition, match?: ConcealMatch): boolean {
  const regions = concealmentOf(arena);
  for (let i = 0; i < regions.length; i++) {
    const b = regions[i];
    if (boxesOverlap(x, y, 0, 0, b.x, b.y, b.w, b.h) && !isBroken(b, match)) return true;
  }
  return false;
}

/**
 * IS THIS FIGHTER HIDDEN AT ALL RIGHT NOW — the one-body half of visibility, stated once.
 *
 * Two ways to be hidden by nothing, and they are different questions:
 *
 *   * the region you are standing in HAS BEEN DESTROYED — a property of the object, spent
 *     for the rest of the match (`isConcealed` above, via `match`); or
 *   * YOU JUST ATTACKED — a property of you, and it expires
 *     (`rules.ts:CONCEAL_ATTACK_REVEAL_MS`).
 *
 * Both are `DECISIONS §29c`, and both have to be in ONE function because the alternative is
 * `isVisibleFrom` and `sim.ts`'s published `Fighter.concealed` each spelling out half of
 * the rule — "a rule stated once and implemented twice", which is the shape of all five
 * recorded `ai.ts` defects and of the sixth that concealment itself nearly shipped.
 *
 * Degenerates to `isConcealed` when `match`/`target` are omitted, so the pre-§29c meaning
 * is still reachable and is what the geometry tests assert against.
 */
export function isHidden(
  tx: number,
  ty: number,
  arena: ArenaDefinition,
  match?: ConcealMatch,
  target?: ConcealTarget,
): boolean {
  if (match && target && match.elapsed < target.revealedUntil) return false;
  return isConcealed(tx, ty, arena, match);
}

/**
 * Can an observer at (ox, oy) see a target at (tx, ty)?
 *
 * The whole of concealment's gameplay meaning is this function. `ai.ts` calls it to decide
 * whether to update its belief about the player and whether it may fire at all;
 * `sim.ts:stepProjectiles` calls it to decide whether a homing projectile may re-aim. Both
 * are the same question and neither re-derives it.
 *
 * Note the observer's own concealment is irrelevant — hiding does not blind you. And note
 * this is deliberately NOT a line-of-sight test: `arena.cover` blocks projectiles but has
 * never blocked the AI's targeting, and adding raycast LOS here would be a much larger
 * behavioural change wearing concealment's clothes.
 *
 * ── ⚠️ THE TWO OPTIONAL ARGUMENTS ARE THE §29c RULE, AND OMITTING THEM IS A ──
 * ── QUIETLY DIFFERENT QUESTION ──────────────────────────────────────────────
 *
 * With `match` and `target`, this answers *can the observer see this FIGHTER, in THIS
 * match* — destroyed cover does not hide, and an attacker inside its reveal window does not
 * hide. Without them it answers *is this POINT inside a region the arena declares*, which
 * is what it meant before §29c.
 *
 * They are optional rather than required because two callers outside this owner's file set
 * pass five arguments — `ui/hud.ts:enemyVisibleToPlayer` (routed: it should pass `state`
 * and `state.enemy`) and `tools/tmp/conceal_lab.mjs --selftest` (correct as it stands: it
 * tests geometry against a hand-built arena, with no match anywhere). Making them required
 * would break a gate this change has to pass in order to be believed.
 *
 * Every reader inside `src/game/` passes all seven, and `sim.test.mjs` §26(m) asserts that
 * by reading this directory's source — because "everybody remembered" is a claim about
 * people and that is precisely the claim this file has been wrong about five times.
 */
export function isVisibleFrom(
  ox: number,
  oy: number,
  tx: number,
  ty: number,
  arena: ArenaDefinition,
  match?: ConcealMatch,
  target?: ConcealTarget,
): boolean {
  if (!isHidden(tx, ty, arena, match, target)) return true;
  return Math.hypot(tx - ox, ty - oy) <= CONCEAL_REVEAL_RADIUS;
}

/**
 * DESTROY every standing concealment region containing (x, y), and report them.
 *
 * Uri, `DECISIONS §29c`: *"attacking from under it will break it and reveal you."* This is
 * the "break it" half; `Fighter.revealedUntil` is the "reveal you" half. `combat.ts` is the
 * only caller — attacking is the only thing that breaks cover.
 *
 * ── EVERY containing region, not just the first ─────────────────────────────
 *
 * Regions may overlap (nothing forbids two plates touching, and the size constraint pushes
 * the layout toward many small ones). Breaking only the first would leave the attacker
 * still hidden by the second — an ambush that costs a plate and reveals nothing, which is
 * the incoherent middle state §29c exists to remove. Membership is the same centre test
 * `isConcealed` uses, so "the region you are under" means one thing in this file.
 *
 * Returns the boxes destroyed by THIS call, so the caller can emit one event each without
 * re-deriving which ones they were. Empty — and allocation-free — in the overwhelmingly
 * common case where the attacker is standing in the open, and on every arena shipping
 * today, where there is nothing to be standing in at all.
 */
export function breakConcealment(
  x: number,
  y: number,
  arena: ArenaDefinition,
  broken: ConcealBox[],
): readonly ConcealBox[] {
  const regions = concealmentOf(arena);
  let destroyed: ConcealBox[] | null = null;
  for (let i = 0; i < regions.length; i++) {
    const b = regions[i];
    if (!boxesOverlap(x, y, 0, 0, b.x, b.y, b.w, b.h)) continue;
    if (broken.includes(b)) continue; // already spent, by this fighter or the other one
    broken.push(b);
    (destroyed ??= []).push(b);
  }
  return destroyed ?? NO_CONCEALMENT;
}

/**
 * Every concealment region whose NEAREST POINT falls within `radius` of the arena centre —
 * i.e. every violation of `rules.ts`'s endgame keepout. Empty means the arena is legal.
 *
 * Nearest point, not centre: a 600 wu band whose centre is 400 wu out still reaches the
 * hub, and a guard that only measured centres would pass it. Returned as the offending
 * boxes rather than a boolean so a caller can name them.
 *
 * ⚠️ THIS IS THE ONLY GUARD IN THE REPO THAT CAN SEE A CONCEALMENT REGION AT ALL.
 * `tools/tmp/arena_probe.mjs --occl` derives its series from `arena.cover` and `--verify`
 * normalises `{w,h,c,msr,ps,es,cover,hz}`; both would report a hub-placed bush as MATCH.
 * `sim.test.mjs` §26 runs this against a deliberately illegal arena and requires it to
 * FAIL, because a guard that has not been shown to fail is not a guard.
 */
export function concealmentInsideRadius(arena: ArenaDefinition, radius: number): ConcealBox[] {
  const out: ConcealBox[] = [];
  const cx = arena.center.x;
  const cy = arena.center.y;
  for (const b of concealmentOf(arena)) {
    // Distance from the centre to the box, 0 when the centre is inside it.
    const dx = Math.max(0, Math.abs(cx - b.x) - b.w / 2);
    const dy = Math.max(0, Math.abs(cy - b.y) - b.h / 2);
    if (Math.hypot(dx, dy) < radius) out.push(b);
  }
  return out;
}

/**
 * Convenience over `concealmentInsideRadius` for the common case: the keepout this arena's
 * own `maxSafeRadius` implies. One call, so no caller has to remember to combine the two.
 */
export function concealmentKeepoutViolations(arena: ArenaDefinition): ConcealBox[] {
  return concealmentInsideRadius(arena, concealmentKeepoutRadius(arena.maxSafeRadius));
}

// ─────────────────────────────────────────────────────────────────────────────
// TERRAIN SLOW — the movement rule that reached the human seat and no other
// ─────────────────────────────────────────────────────────────────────────────

/**
 * The strongest (smallest) terrain slow multiplier at a point: 1 where nothing applies,
 * `PUDDLE_SLOW_FACTOR` inside a `kind: 'slow'` hazard or a splat.
 *
 * ── 🚨 IT LIVES HERE BECAUSE IT USED TO LIVE IN `sim.ts` AND REACHED ONE SEAT ─
 *
 * `rules.ts` states this rule TWICE, in prose, and both times for *anyone* —
 * `PUDDLE_SLOW_FACTOR` (*"slows anyone inside it"*) and `SPLAT_DURATION_MS` (*"slows
 * anyone standing in it"*). Until 2026-08-19 it was implemented ONCE, as a private
 * function in `sim.ts` called only by `moveFighter`, which moves HUMAN-controlled
 * fighters. `ai.ts:stepAI` built its own `aiSlowMult` out of the STATUS slow alone, so
 * **every bot in the game walked through every puddle and every splat at full speed** —
 * measured, not inferred, by a one-tick control with both fighters pinned 900 wu apart on
 * flooded floor against dry floor: **player ratio 0.450000, enemy ratio 1.000000**
 * (`sim.test.mjs` §25(a)).
 *
 * That was the fifth instance of `ai.ts`'s oldest and most expensive defect shape — a rule
 * stated once in `rules.ts` and implemented twice — and it was the one that mattered most,
 * because the asymmetry ran against **the only seat a person occupies**. It is fixed by
 * DELETION rather than by addition: there is now one implementation, in the module that
 * exists precisely so `sim.ts` and `ai.ts` can share a movement rule without an import
 * cycle, and both call it.
 *
 * ⚠️ **A POINT TEST, NOT A BODY TEST, AND THAT IS DELIBERATE.** `hypot(fighter − hz) <
 * hz.radius` is a CENTRE test, exactly as `isConcealed` above is, and the two are stated to
 * agree in `isConcealed`'s own header. Widening either to the 42 wu body would make the
 * effective puddle 21 wu larger than the drawn one in every direction — the render/sim
 * mismatch `docs/LESSONS.md` §1 keeps finding.
 *
 * ⚠️ **THE FACTOR IS THE SAME NUMBER ON BOTH SIDES, WHICH `AI_SLOW_MULTIPLIER` IS NOT.**
 * `DECISIONS §75` records that a slowed BOT is slowed harder than a slowed PLAYER
 * (`AI_SLOW_MULTIPLIER` 0.35 against `SLOW_MOVE_MULTIPLIER` 0.45) — a deliberate STATUS
 * asymmetry. Terrain has no such dial and must not grow one: the floor is the floor, and
 * a second constant here would be this defect again with the sign flipped.
 */
export function terrainSlowAt(
  x: number,
  y: number,
  arena: ArenaDefinition,
  splats: readonly Splat[],
): number {
  let factor = 1;
  for (const hz of arena.hazards) {
    if (hz.kind !== 'slow') continue;
    if (Math.hypot(x - hz.x, y - hz.y) < hz.radius) {
      factor = Math.min(factor, hz.slowFactor ?? PUDDLE_SLOW_FACTOR);
    }
  }
  for (const s of splats) {
    if (Math.hypot(x - s.x, y - s.y) < SPLAT_RADIUS) {
      factor = Math.min(factor, PUDDLE_SLOW_FACTOR);
    }
  }
  return factor;
}

/** Bounded so a fighter wedged between boxes cannot spin here forever. */
const ESCAPE_PASSES = 4;
/** Clear the `<` in `boxesOverlap` by a hair, so one push ends the overlap for good. */
const ESCAPE_EPS = 0.01;

/**
 * Push a fighter that is ALREADY inside cover back out, along its axis of least
 * penetration.
 *
 * ── Why this has to exist ───────────────────────────────────────────────────
 * `tryMove` tests the DESTINATION for overlap and refuses the step if it collides. It
 * never tests where the fighter already is. So a fighter that somehow ends up inside a
 * box is frozen permanently and silently, on BOTH axes: every candidate destination from
 * inside the box also overlaps it, so every step is refused, forever, with no event, no
 * error and nothing in the HUD. It is the worst shape a bug can have — total, silent, and
 * indistinguishable from "the controls stopped working".
 *
 * Proven rather than theorised (found by the input agent, handed over deliberately):
 * `?px=850&py=500` puts a 42 wu fighter 25 wu from the centre of `spice_cart`
 * (875,500,50,50), and 25 < (42+50)/2 = 46, so it spawns inside. A `px` sweep along
 * y=500 predicted pinned-vs-free at 10 of 10 points, with the boundary exactly where
 * burial depth exceeds one step (PLAYER_SPEED 0.12 wu/ms x the loop's 50 ms dt clamp =
 * 6 wu). The sweep's own mismatch turned up a cover box nobody had listed.
 *
 * No player can reach that state today — spawns are clear and knockback is visual-only.
 * It becomes reachable the moment anyone adds sim-side knockback, a dash, a pull, or a
 * prop that overlaps a spawn, and it is far cheaper to hold the invariant here than to
 * find it later from a bug report that reads "I just froze". Depenetration is also what
 * makes the flow field below safe: its waypoints are grid-cell centres, and the grid is
 * rebuilt from `arena.cover` — if an arena ever hands us geometry that disagrees with
 * itself, the fighter recovers instead of locking.
 *
 * Minimum-translation on purpose: the smallest displacement that resolves the overlap,
 * so nothing teleports across a wall. Clamped to the arena, and if a box is flush against
 * a wall with no room to be pushed into, the passes run out and the behaviour degrades to
 * exactly what it is today — stuck — rather than to something worse.
 *
 * Minimum translation does NOT care which way the fighter wanted to go, and that is the
 * right trade. Measured: `?px=960&py=500` sits 20 wu east of `supply_barrel`'s centre, so
 * the shortest exit is 25 wu EAST against 65 wu west; a fighter holding "left" is therefore
 * deposited on the barrel's east face and then presses into it. It is free — just not free
 * in the direction it asked for. Steering the escape by intent instead would mean taking
 * the longer exit through more geometry, which is how depenetration turns into teleporting.
 *
 * ── It only runs for a fighter that is TRYING to move, and that is deliberate ─────
 * The symptom being fixed is "I am pressing keys and nothing happens", so the escape is
 * tied to pressing keys. Gating it on intent rather than running it every tick also
 * preserves a diagnostic this project has already used to find a real bug: an arena agent
 * parks a fighter inside the pot with `?px=`/`?py=` and PHOTOGRAPHS it, which is how
 * "a fighter inside the pot is 0.0% visible" was proven. A fighter parked and left alone
 * stays exactly where it was put. The moment it tries to walk, it gets out.
 */
function escapeCover(fighter: Fighter, arena: ArenaDefinition): void {
  const size = fighter.size;
  const half = size / 2;
  const cover = arena.cover;

  for (let pass = 0; pass < ESCAPE_PASSES; pass++) {
    let worst: CoverBox | null = null;
    let worstDepth = 0;
    for (let i = 0; i < cover.length; i++) {
      const o = cover[i];
      const px = (size + o.w) / 2 - Math.abs(fighter.x - o.x);
      if (px <= 0) continue;
      const py = (size + o.h) / 2 - Math.abs(fighter.y - o.y);
      if (py <= 0) continue;
      const depth = px < py ? px : py;
      if (depth > worstDepth) { worstDepth = depth; worst = o; }
    }
    if (worst === null) return;   // the ordinary case, and it costs one pass over `cover`

    const px = (size + worst.w) / 2 - Math.abs(fighter.x - worst.x);
    const py = (size + worst.h) / 2 - Math.abs(fighter.y - worst.y);
    if (px <= py) {
      const sign = fighter.x >= worst.x ? 1 : -1;
      fighter.x = Math.min(arena.width - half, Math.max(half, fighter.x + sign * (px + ESCAPE_EPS)));
    } else {
      const sign = fighter.y >= worst.y ? 1 : -1;
      fighter.y = Math.min(arena.height - half, Math.max(half, fighter.y + sign * (py + ESCAPE_EPS)));
    }
  }
}

/**
 * Per-axis movement resolution: try X, then Y, independently. This is what lets a
 * fighter slide along a wall instead of sticking to it — exactly the prototype's
 * OBSTACLES collision, adapted to the ArenaDefinition CoverBox contract.
 *
 * Bounds are clamped to the arena's width/height BEFORE the collision test, and a
 * blocked axis simply leaves that coordinate unchanged (it does not snap to the
 * obstacle's edge) — matching the prototype precisely.
 */
export function tryMove(fighter: Fighter, dx: number, dy: number, arena: ArenaDefinition): boolean {
  const half = fighter.size / 2;
  const startX = fighter.x;
  const startY = fighter.y;

  // Before anything else: if we are trying to move and we are inside a box, get out.
  // Costs one pass over `arena.cover` when there is nothing to do; skipped entirely for a
  // fighter that is standing still, which is what keeps a deliberately parked QA fighter
  // parked. See `escapeCover`.
  if (dx !== 0 || dy !== 0) escapeCover(fighter, arena);

  if (dx !== 0) {
    const newX = Math.min(arena.width - half, Math.max(half, fighter.x + dx));
    if (!collidesWithCover(newX, fighter.y, fighter.size, arena.cover)) {
      fighter.x = newX;
    }
  }
  if (dy !== 0) {
    const newY = Math.min(arena.height - half, Math.max(half, fighter.y + dy));
    if (!collidesWithCover(fighter.x, newY, fighter.size, arena.cover)) {
      fighter.y = newY;
    }
  }

  // Whether ANY ground was gained. Per-axis resolution above already gives wall
  // sliding for free on diagonal input; this return value exists so a caller can
  // detect the case where BOTH axes were refused.
  return fighter.x !== startX || fighter.y !== startY;
}

// ─────────────────────────────────────────────────────────────────────────────
// GLOBAL NAVIGATION — a coarse-grid flow field
//
// ## Why a local rule provably cannot do this
//
// Greedy avoidance — "press toward the target, and when that is refused, commit to a
// perpendicular" — is a hill-climber on straight-line distance. It escapes any obstacle
// whose detour eventually reduces that distance. It cannot escape an obstacle whose
// only route INCREASES it first, because there is no local signal telling it which of
// the two perpendiculars leads out, and both look equally wrong.
//
// The arena contains exactly such a shape, and it contains it around the player's own
// spawn. Measured on the real sim, before this layer existed, with the player parked
// motionless and immortal on its own spawn (160,500):
//
//     the enemy walked 2,968 wu, arrived at (441,~435), and then oscillated in y
//     between 417 and 455 for the remaining 25 seconds of a 45 s match. Closest
//     approach 284 wu against a reach of 153 wu — 1.86x reach, "never arrives",
//     for all 11 enemy characters, every time.
//
// (441,435) is the east face of `prep_counter` at (340,420) inflated by the fighter's
// half-width. Between y=371 and y=628 the column x in [239,301] is sealed: two prep
// counters with a `supply_barrel` bridging the gap between them. The only routes to the
// spawn run through a 65 wu slot at y~340 (under the freezer) or an 80 wu slot at
// y~670 — and BOTH require heading north or south, away from the target, for ~150 wu
// before any progress happens. A greedy rule scores that as strictly worse than pressing
// on the wall, so it presses on the wall. Forever.
//
// Note this deadlock does NOT register on the stall detector in `tools/match-sim.mjs`:
// a 38 wu y-oscillation exceeds its 15 wu span threshold, so "AI stalled 0.0%" was
// literally true while the AI was permanently deadlocked. Stall fraction is a necessary
// but nowhere near sufficient navigation metric; reachability is the sufficient one.
//
// ## What this is
//
// A breadth-first distance field over a 20 wu grid, rebuilt from the target's cell.
// `dist[c]` is the number of grid steps from cell `c` to the target, so following the
// gradient downhill is a shortest route by construction — global knowledge, which is
// exactly what the local layer lacks. Steering then string-pulls the descent chain: it
// aims at the FURTHEST cell on the route still reachable in a straight line, so the
// fighter walks a smooth diagonal rather than a staircase of grid steps.
//
// The local layer is not replaced. It still resolves the actual step, so grid
// quantisation, a fighter wedged between two boxes, or a target standing inside cover
// all degrade to exactly the old behaviour instead of failing.
//
// ## What it is worth, measured
//
// Grid reachability — a full match through the real `stepMatch` per cell, with the player
// parked motionless and immortal on each of 358 standable cells of a 28x20 grid, asking
// only whether the enemy ever got inside its own weapon reach:
//
//     greedy local avoidance   283/358   79.1%
//     this layer               358/358  100.0%
//
// and 100.0% is not a lucky round number, it is the CEILING: an independent 2 wu lattice
// flood from the enemy spawn, using no pathfinder at all, puts a reachable point within
// weapon reach of every one of the 358 cells. There is nothing left on this metric.
//
// Sharper still, because an average can hide a total failure: with the player standing
// still at its own spawn and doing nothing, across all 110 character matchups, the enemy
// made contact in **0 of 110** matches before and **110 of 110** after.
//
// ## Cost
//
// One grid per arena, built once and cached; every buffer is a pre-sized typed array, so a
// rebuild allocates nothing at all. The field is rebuilt only when the target crosses into
// a different cell. Measured over 11 full matches (14,667 ticks, `nav_probe.mjs --cost`):
//
//     14,000 cells (140x100), 123 KB of typed arrays, allocated once
//     1,127 field rebuilds = 4.6 per second of simulated time
//     577 cells visited per tick amortised   ·   6.9 line-of-sight checks per tick
//
// All hardware-independent counts, deliberately: SwiftShader is a CPU rasteriser and frame
// time cannot be measured on this box at all (`docs/LESSONS.md` S10).
// ─────────────────────────────────────────────────────────────────────────────

/**
 * Grid resolution, world units — and this number is DERIVED, not picked.
 *
 * A grid can only route through a corridor if some cell centre lands inside it, so the
 * resolution has to be set by the arena's tightest legal gap. Measured on the shipped
 * kitchen (`tools/tmp/nav_probe.mjs --truth`, which flood-fills a 2 wu lattice and needs
 * no pathfinder at all): the tightest is the diagonal passage between the boiling pot and
 * a stove island. Raw, that is a 53 wu corridor — wide enough that a player will obviously
 * walk it — but a 42 wu body leaves only an **11 wu band of legal centre positions**
 * (y in 416..427 at x in 769..773). A grid of cell size c always places a centre inside any
 * band wider than c, so 10 resolves it with margin; 20 did not, and cost 7 of 358 cells.
 *
 * It is also well under half a fighter (42 wu), which is what makes an orthogonal grid
 * step provably safe: two fighter-boxes whose centres are 10 wu apart overlap, so their
 * union is a single AABB containing every intermediate position — if neither endpoint
 * collides, nothing between them can either.
 *
 * ⚠️ IF THE ARENA'S TIGHTEST GAP NARROWS, THIS MUST FOLLOW IT DOWN. The divergence is
 * measurable and does not need to be guessed at: `nav_probe.mjs --truth` prints the
 * ceiling a perfect pathfinder could reach and `--reach` prints what this one does. A gap
 * between the two is this constant being too large.
 */
const NAV_CELL = 10;

/** Guard against a future arena large enough to make the grid silly. Never hit at 1400x1000. */
const NAV_MAX_CELLS = 40_000;

/** How far down the route to string-pull. 16 cells = 320 wu, well past any single obstacle. */
const NAV_LOOKAHEAD = 16;

/** Ring search radius (cells) when the target, or the mover, is not on a passable cell. */
const NAV_GOAL_SEARCH = 8;
const NAV_SELF_SEARCH = 4;

interface NavGrid {
  cell: number;
  cols: number;
  rows: number;
  /** Fighter size this passability grid was built for. */
  size: number;
  /** Identity of the cover array the grid was built from; rebuild if the arena swaps it. */
  cover: CoverBox[];
  passable: Uint8Array;
  /** Grid steps from each cell to `goalCell`; -1 = not reached (unreachable or unbuilt). */
  dist: Int32Array;
  /** BFS frontier. Length = cell count, because each cell is enqueued at most once. */
  queue: Int32Array;
  /** Scratch for the descent chain. */
  chain: Int32Array;
  /** Cell the field is actually flooded from — the requested goal, or its stand-in. */
  goalCell: number;
  /** Goal that was ASKED for. May differ from `goalCell`; see `navSteer`'s fallback. */
  requestedGoal: number;
}

/**
 * Keyed on the arena object, so nothing has to be added to `ArenaDefinition` (that
 * contract is owned by `src/arena/types.ts`) and a discarded arena's grid is collected
 * with it. One live match means one entry.
 */
const NAV_CACHE = new WeakMap<ArenaDefinition, NavGrid>();

/**
 * Diagnostic counters. Integer increments only — no allocation, no branching on a debug
 * flag. Read by `tools/tmp/nav_probe.mjs --cost`, which is how the numbers quoted in the
 * block comment above were produced; nothing in the game reads them.
 */
export const navStats = {
  gridBuilds: 0,
  fieldBuilds: 0,
  cellsVisited: 0,
  queries: 0,
  losChecks: 0,
  cols: 0,
  rows: 0,
  cellSize: NAV_CELL,
  passable: 0,
  reset(): void {
    this.gridBuilds = 0;
    this.fieldBuilds = 0;
    this.cellsVisited = 0;
    this.queries = 0;
    this.losChecks = 0;
  },
};

function navGrid(arena: ArenaDefinition, size: number): NavGrid {
  const cached = NAV_CACHE.get(arena);
  if (cached && cached.size === size && cached.cover === arena.cover) return cached;

  let cell = NAV_CELL;
  while (Math.ceil(arena.width / cell) * Math.ceil(arena.height / cell) > NAV_MAX_CELLS) cell *= 2;
  const cols = Math.max(1, Math.ceil(arena.width / cell));
  const rows = Math.max(1, Math.ceil(arena.height / cell));
  const n = cols * rows;

  const passable = new Uint8Array(n);
  const half = size / 2;
  let open = 0;
  for (let gy = 0; gy < rows; gy++) {
    for (let gx = 0; gx < cols; gx++) {
      const cx = (gx + 0.5) * cell;
      const cy = (gy + 0.5) * cell;
      // A cell is passable only if a fighter's CENTRE may legally sit on it: inside the
      // same bounds `tryMove` clamps to, and clear of cover by the same test. That keeps
      // the route in the space movement can actually occupy.
      const ok =
        cx >= half && cx <= arena.width - half &&
        cy >= half && cy <= arena.height - half &&
        !collidesWithCover(cx, cy, size, arena.cover);
      if (ok) { passable[gy * cols + gx] = 1; open++; }
    }
  }

  const grid: NavGrid = {
    cell, cols, rows, size,
    cover: arena.cover,
    passable,
    dist: new Int32Array(n),
    queue: new Int32Array(n),
    chain: new Int32Array(NAV_LOOKAHEAD + 1),
    goalCell: -1,
    requestedGoal: -1,
  };
  NAV_CACHE.set(arena, grid);
  navStats.gridBuilds++;
  navStats.cols = cols;
  navStats.rows = rows;
  navStats.cellSize = cell;
  navStats.passable = open;
  return grid;
}

/**
 * Breadth-first distance field, flooded OUT from the goal, so `dist[c]` is the route
 * length from `c` to the goal and steering is a downhill walk.
 *
 * A diagonal step is only legal when both of its orthogonal neighbours are open. Without
 * that, the field claims a route through the point where two boxes touch at a corner —
 * a gap of zero width, which a 42 wu body obviously cannot use, and the mover would jam
 * on it exactly like the bug this replaces.
 */
function navBuildField(g: NavGrid, goal: number): void {
  const { cols, rows, passable, dist, queue } = g;
  dist.fill(-1);
  g.goalCell = goal;
  dist[goal] = 0;
  queue[0] = goal;
  let head = 0;
  let tail = 1;

  while (head < tail) {
    const c = queue[head++];
    const cx = c % cols;
    const cy = (c - cx) / cols;
    const nd = dist[c] + 1;
    for (let oy = -1; oy <= 1; oy++) {
      const ny = cy + oy;
      if (ny < 0 || ny >= rows) continue;
      const rowBase = ny * cols;
      for (let ox = -1; ox <= 1; ox++) {
        if (ox === 0 && oy === 0) continue;
        const nx = cx + ox;
        if (nx < 0 || nx >= cols) continue;
        const ni = rowBase + nx;
        if (passable[ni] === 0 || dist[ni] >= 0) continue;
        if (ox !== 0 && oy !== 0 && (passable[cy * cols + nx] === 0 || passable[rowBase + cx] === 0)) continue;
        dist[ni] = nd;
        queue[tail++] = ni;
      }
    }
  }

  navStats.fieldBuilds++;
  navStats.cellsVisited += tail;
}

/**
 * Nearest cell to (gx,gy) that is passable — and, when `needRouted`, that the current
 * field actually reached. Rings outward, so the first hit is the nearest in Chebyshev
 * distance. Returns -1 if there is none within `maxR`.
 *
 * This is what makes the layer safe against the cases that would otherwise crash it into
 * a fallback: a target standing inside cover (`?px=`/`?py=` does not validate against
 * cover, so a QA probe really can park a fighter inside a counter), a flee target thrown
 * 400 wu past a wall, or a mover in the outer 20 wu strip the grid deliberately excludes.
 */
function navNearestPassable(g: NavGrid, gx: number, gy: number, maxR: number, needRouted: boolean): number {
  const { cols, rows, passable, dist } = g;
  if (gx >= 0 && gx < cols && gy >= 0 && gy < rows) {
    const i0 = gy * cols + gx;
    if (passable[i0] === 1 && (!needRouted || dist[i0] >= 0)) return i0;
  }
  for (let r = 1; r <= maxR; r++) {
    for (let oy = -r; oy <= r; oy++) {
      const ny = gy + oy;
      if (ny < 0 || ny >= rows) continue;
      const edge = Math.abs(oy) === r;
      for (let ox = -r; ox <= r; ox += edge ? 1 : 2 * r) {
        const nx = gx + ox;
        if (nx < 0 || nx >= cols) continue;
        const i = ny * cols + nx;
        if (passable[i] === 1 && (!needRouted || dist[i] >= 0)) return i;
      }
    }
  }
  return -1;
}

/**
 * Can a fighter of `size` walk the straight segment (x0,y0)->(x1,y1) without touching
 * cover? Marches the fighter's own AABB along the line at 0.4 body-widths, which is the
 * same collision test `tryMove` applies, sampled finely enough that consecutive boxes
 * overlap heavily.
 *
 * Deliberately does NOT test the start point: the caller is standing there.
 */
function navClearPath(x0: number, y0: number, x1: number, y1: number, size: number, cover: CoverBox[]): boolean {
  navStats.losChecks++;
  const dx = x1 - x0;
  const dy = y1 - y0;
  const steps = Math.max(1, Math.ceil(Math.hypot(dx, dy) / (size * 0.4)));
  for (let i = 1; i <= steps; i++) {
    const t = i / steps;
    if (collidesWithCover(x0 + dx * t, y0 + dy * t, size, cover)) return false;
  }
  return true;
}

/**
 * Steering output. Module-scope and mutated in place: `moveToward` runs once per tick
 * for the whole match, and returning a fresh `{x,y}` from here would be a per-frame
 * allocation for no reason. Only ever read immediately after a `true` from `navSteer`.
 */
const NAV_OUT = { dirX: 0, dirY: 0, wpX: 0, wpY: 0 };

/**
 * Ask the flow field which way to go. Writes `NAV_OUT` and returns true when it has an
 * answer; returns false — leaving the caller on its straight-line bearing — when the map
 * genuinely offers no route, which is the honest answer rather than a fabricated one.
 */
function navSteer(arena: ArenaDefinition, fighter: Fighter, targetX: number, targetY: number): boolean {
  const g = navGrid(arena, fighter.size);
  const { cell, cols, rows, dist, chain } = g;
  const half = fighter.size / 2;

  // Clamp the goal into legal standing space first. A flee target is projected 400 wu
  // past the player and is routinely off the map.
  const tx = Math.min(arena.width - half, Math.max(half, targetX));
  const ty = Math.min(arena.height - half, Math.max(half, targetY));

  const goal = navNearestPassable(
    g,
    Math.min(cols - 1, Math.max(0, Math.floor(tx / cell))),
    Math.min(rows - 1, Math.max(0, Math.floor(ty / cell))),
    NAV_GOAL_SEARCH,
    false,
  );
  if (goal < 0) return false;

  const me = navNearestPassable(
    g,
    Math.min(cols - 1, Math.max(0, Math.floor(fighter.x / cell))),
    Math.min(rows - 1, Math.max(0, Math.floor(fighter.y / cell))),
    NAV_SELF_SEARCH,
    false,
  );
  if (me < 0) return false;

  // ── When the goal is in another connected component ─────────────────────────
  // Measured on the shipped kitchen, the walkable floor is not one region: two 114x63 wu
  // pockets (x 301..415 and x 985..1099, both y 469..531) are sealed shut by a pair of
  // prep counters and a pair of supply barrels, and hold 1.9% of all legal standing
  // space. NOTHING can enter them — not the AI, not the player.
  //
  // "Give up and fall back to the straight-line bearing" is the wrong answer for that,
  // because the straight-line bearing walks into the counter and jams, which is the exact
  // behaviour this layer exists to remove. What a player does instead is get as close as
  // the map allows and fight from there — and at 105 wu from the pocket's edge that is
  // comfortably inside weapon reach, so it is not even a concession.
  //
  // Implemented by RE-ROOTING rather than by walking a route backwards: flood from the
  // mover to learn what it can actually reach, take the reachable cell nearest the goal,
  // and flood once more from there. The steering code below is then completely unaware
  // anything unusual happened, and the result caches exactly like any other goal — so the
  // extra passes are paid once per goal cell, not once per tick.
  if (g.requestedGoal !== goal || dist[me] < 0) {
    navBuildField(g, goal);
    if (dist[me] < 0) {
      navBuildField(g, me);
      let stand = me;
      let bestD = Infinity;
      for (let i = 0; i < dist.length; i++) {
        if (dist[i] < 0) continue;
        const ix = i % cols;
        const ex = (ix + 0.5) * cell - tx;
        const ey = ((i - ix) / cols + 0.5) * cell - ty;
        const d2 = ex * ex + ey * ey;
        if (d2 < bestD) { bestD = d2; stand = i; }
      }
      navBuildField(g, stand);
    }
    g.requestedGoal = goal;
  }
  if (dist[me] < 0) return false;
  navStats.queries++;

  // Walk downhill, collecting the route.
  //
  // ── The tie-break is not cosmetic, it is the difference between a route and a drift ──
  // The field is a plain 8-connected BFS, so its metric is CHEBYSHEV: a diagonal step
  // costs the same as an orthogonal one. That makes every level set a huge plateau, and
  // taking "the first strictly-downhill neighbour" walks the plateau diagonally. Measured
  // on an EMPTY arena with the target 1,000 wu due west, that produced a lateral drift of
  // **247 wu** — the AI arrived, but it arrived via a 45-degree detour, which is the kind
  // of thing a player reads as broken long before they call it slow.
  //
  // Breaking ties on true Euclidean distance to the target costs one squared distance per
  // candidate and collapses the plateau onto the straight line: **247.5 wu of drift becomes
  // 4.4 wu**, which is grid quantisation and nothing else. It is worth more than tidiness —
  // it also took mean time-to-first-contact across 110 matchups from 12.1 s to 11.2 s of
  // match clock, because a 45-degree detour is a 41% longer walk.
  //
  // (Weighting the field itself with octile costs is the textbook fix. It needs a bucket
  // queue and a second pass; with the string-pull below doing the smoothing it was not
  // worth the code.)
  let c = me;
  let len = 0;
  while (len < NAV_LOOKAHEAD && dist[c] > 0) {
    const cx = c % cols;
    const cy = (c - cx) / cols;
    const cur = dist[c];
    let best = -1;
    let bestD = cur;
    let bestE = Infinity;
    for (let oy = -1; oy <= 1; oy++) {
      const ny = cy + oy;
      if (ny < 0 || ny >= rows) continue;
      const rowBase = ny * cols;
      for (let ox = -1; ox <= 1; ox++) {
        if (ox === 0 && oy === 0) continue;
        const nx = cx + ox;
        if (nx < 0 || nx >= cols) continue;
        const ni = rowBase + nx;
        const d = dist[ni];
        if (d < 0 || d >= cur) continue;
        if (ox !== 0 && oy !== 0 && (g.passable[cy * cols + nx] === 0 || g.passable[rowBase + cx] === 0)) continue;
        const ex = (nx + 0.5) * cell - tx;
        const ey = (ny + 0.5) * cell - ty;
        const e = ex * ex + ey * ey;
        if (d < bestD || (d === bestD && e < bestE)) {
          bestD = d;
          bestE = e;
          best = ni;
        }
      }
    }
    if (best < 0) break;
    chain[len++] = best;
    c = best;
  }

  // String-pull: the furthest waypoint on the route that is reachable in a straight line
  // from here. Without this the mover follows the grid literally and walks a staircase.
  let wpX: number;
  let wpY: number;
  if (len === 0) {
    // Already standing in the goal cell — aim at the real target, not its cell centre.
    wpX = tx;
    wpY = ty;
  } else {
    let pick = 0;
    for (let i = 1; i < len; i++) {
      const ci = chain[i];
      const cx = ci % cols;
      const cy = (ci - cx) / cols;
      if (!navClearPath(fighter.x, fighter.y, (cx + 0.5) * cell, (cy + 0.5) * cell, fighter.size, arena.cover)) break;
      pick = i;
    }
    const ci = chain[pick];
    const cx = ci % cols;
    const cy = (ci - cx) / cols;
    wpX = (cx + 0.5) * cell;
    wpY = (cy + 0.5) * cell;
    // If the route ended inside lookahead, the target itself is close; prefer its exact
    // position over the cell centre so the last stretch of a chase is not quantised.
    if (pick === len - 1 && dist[ci] === 0 && navClearPath(fighter.x, fighter.y, tx, ty, fighter.size, arena.cover)) {
      wpX = tx;
      wpY = ty;
    }
  }

  const vx = wpX - fighter.x;
  const vy = wpY - fighter.y;
  const m = Math.hypot(vx, vy);
  if (m < 1e-6) return false;
  NAV_OUT.dirX = vx / m;
  NAV_OUT.dirY = vy / m;
  NAV_OUT.wpX = wpX;
  NAV_OUT.wpY = wpY;
  return true;
}

/**
 * Move toward a target, routing around cover.
 *
 * Two layers, in order:
 *
 *  1. The flow field picks the heading. `dirX`/`dirY` — the straight-line bearing both
 *     `ai.ts` call sites pass — is only the right heading when nothing is in the way, and
 *     is kept solely as the fallback for a target the map cannot route to at all.
 *  2. Per-axis resolution plus a committed perpendicular detour executes the step, and is
 *     what handles everything below the grid's 20 wu resolution: a corner clipped by the
 *     string-pull, a body wedged between two boxes, a target standing inside cover.
 *
 * Progress is judged against the WAYPOINT, not the final target. That distinction is the
 * whole point of the layer: rounding an obstacle means the straight-line distance to the
 * target gets worse for a while, which is precisely why a greedy rule scored every detour
 * as a failure and pressed into the wall instead.
 *
 * Stateless apart from `fighter.detourSign`, and deterministic.
 */
export function moveToward(
  fighter: Fighter,
  dirX: number,
  dirY: number,
  step: number,
  arena: ArenaDefinition,
  targetX: number,
  targetY: number
): boolean {
  const startX = fighter.x;
  const startY = fighter.y;

  let headX = dirX;
  let headY = dirY;
  let aimX = targetX;
  let aimY = targetY;
  if (navSteer(arena, fighter, targetX, targetY)) {
    headX = NAV_OUT.dirX;
    headY = NAV_OUT.dirY;
    aimX = NAV_OUT.wpX;
    aimY = NAV_OUT.wpY;
  }

  const distTo = (x: number, y: number): number => Math.hypot(x - aimX, y - aimY);
  const startDist = distTo(startX, startY);

  // Candidate 1: straight at the waypoint.
  tryMove(fighter, headX * step, headY * step, arena);
  const directX = fighter.x;
  const directY = fighter.y;

  // "Did I move?" is the WRONG blocked test. Once a mover nudges even slightly off
  // the blocking axis, the direct step's tiny perpendicular component succeeds, so
  // tryMove reports movement while the mover creeps along the obstacle face at a
  // fraction of its speed and never actually gets around. Judge real progress
  // toward the waypoint instead.
  if (startDist - distTo(directX, directY) >= step * 0.35) {
    fighter.detourSign = 0;
    return true;
  }

  // Blocked below the grid's resolution. Commit to a perpendicular even though it makes
  // the straight-line distance WORSE — that is what going around something means, and it
  // is why a greedy "pick whichever candidate ends up closest" rule can never escape:
  // every detour scores worse than pressing into the wall, so greedy picks the wall.
  //
  // ── Two bugs lived here, and they compounded ────────────────────────────────
  //
  // 1. The side was chosen as
  //        perpDot = -dirY*(targetX-startX) + dirX*(targetY-startY)
  //    but BOTH call sites in `ai.ts` pass `dir = normalize(target - start)`. That
  //    makes this a vector crossed with ITSELF — identically zero at every call
  //    site — so `primary` was always +1 and the "deterministic side preference"
  //    decided nothing. The AI detoured the same way around every obstacle.
  //
  // 2. Even with a real preference, the choice was re-made from scratch every tick.
  //    Local geometry flips constantly while sliding along a corner, so the decision
  //    flips with it and the mover alternates between two headings forever.
  //
  // Fixing both took map reachability from 48% to 79.1% and stalls from 77% of the
  // match to 0.0%. It did NOT fix the alcove, and could not have: see the block comment
  // above `NAV_CELL` for why that needs global knowledge. This block's job is now
  // strictly sub-grid geometry, and it keeps that job because the flow field's waypoints
  // are cell centres — reaching one can still require squeezing past something the grid
  // cannot see.
  //
  // Ablated and measured rather than assumed: with this whole block removed and the flow
  // field left to steer alone, reachability is STILL 100/100 — the field does the routing —
  // but mean time-to-reach rises 14.2 s -> 14.5 s and the worst cell 25.8 s -> 26.3 s. So
  // it is worth keeping and it is no longer where the reachability comes from. Anyone
  // tempted to tune it should know it is now the small term.
  const candidate = (sign: number): number => {
    fighter.x = startX;
    fighter.y = startY;
    // Bias the detour slightly forward so the mover rounds the corner instead of
    // sliding flat along the face forever.
    const px = -headY * sign + headX * 0.3;
    const py = headX * sign + headY * 0.3;
    const m = Math.hypot(px, py) || 1;
    tryMove(fighter, (px / m) * step, (py / m) * step, arena);
    return Math.hypot(fighter.x - startX, fighter.y - startY);
  };

  // Already committed to a side? Keep it while it still buys real movement. Holding a
  // slightly worse side beats re-deciding into a dither — the mover needs several ticks
  // in one direction to actually clear an obstacle.
  if (fighter.detourSign !== 0) {
    if (candidate(fighter.detourSign) >= step * 0.35) return true;
    // That side is now blocked too — an inside corner. Fall through and re-choose.
  }

  const movedA = candidate(1);
  const ax = fighter.x;
  const ay = fighter.y;
  const movedB = candidate(-1);

  if (movedA >= movedB) {
    if (movedA >= step * 0.35) {
      fighter.detourSign = 1;
      fighter.x = ax;
      fighter.y = ay;
      return true;
    }
  } else if (movedB >= step * 0.35) {
    fighter.detourSign = -1;
    return true;   // candidate(-1) left the fighter in place already
  }

  // Fully boxed in: keep whatever the direct attempt managed, and drop the commitment
  // so the next tick is free to choose again rather than re-trying a dead side.
  fighter.detourSign = 0;
  fighter.x = directX;
  fighter.y = directY;
  return directX !== startX || directY !== startY;
}
