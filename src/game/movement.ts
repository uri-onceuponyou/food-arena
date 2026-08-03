/**
 * Shared movement/collision helpers.
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
 */

import type { ArenaDefinition, CoverBox } from '../arena/types.ts';
import type { Fighter } from './state.ts';

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

function collidesWithCover(cx: number, cy: number, size: number, cover: CoverBox[]): boolean {
  return cover.some((o) => boxesOverlap(cx, cy, size, size, o.x, o.y, o.w, o.h));
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

/**
 * Move toward a target, sliding around cover when the direct path is fully blocked.
 *
 * Per-axis resolution alone only slides when the movement vector has a non-zero
 * component on the free axis. A purely axis-aligned approach — which happens
 * whenever two fighters share an x or y, including at spawn, since both spawns sit
 * on the arena's centre line — has a zero component on the other axis, so there is
 * literally nothing to slide along and the mover presses into the obstacle forever.
 *
 * When the direct step gains no ground, try both perpendiculars and take whichever
 * ends up closer to the target. Stateless and deterministic, so it cannot oscillate
 * between two remembered choices.
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
  const distTo = (x: number, y: number) => Math.hypot(x - targetX, y - targetY);
  const startDist = distTo(startX, startY);

  // Candidate 1: straight at the target.
  tryMove(fighter, dirX * step, dirY * step, arena);
  const direct = { x: fighter.x, y: fighter.y, d: distTo(fighter.x, fighter.y) };

  // "Did I move?" is the WRONG blocked test. Once a mover nudges even slightly off
  // the blocking axis, the direct step's tiny perpendicular component succeeds, so
  // tryMove reports movement while the mover creeps along the obstacle face at a
  // fraction of its speed and never actually gets around. Judge real progress
  // toward the target instead.
  if (startDist - direct.d >= step * 0.35) return true;

  // Blocked. Commit to a perpendicular even though it makes the straight-line
  // distance WORSE — that is what going around something means, and it is why a
  // greedy "pick whichever candidate ends up closest" rule can never escape: every
  // detour scores worse than pressing into the wall, so greedy picks the wall.
  //
  // Sign is chosen deterministically (never randomly, so it cannot dither between
  // two choices on alternating ticks): prefer the side the target already lies on,
  // and when the approach is perfectly axis-aligned — the exact case that caused the
  // original lock — fall back to a fixed direction.
  const perpDot = -dirY * (targetX - startX) + dirX * (targetY - startY);
  const primary = perpDot >= 0 ? 1 : -1;

  for (const sign of [primary, -primary]) {
    fighter.x = startX;
    fighter.y = startY;
    // Bias the detour slightly forward so the mover rounds the corner instead of
    // sliding flat along the face forever.
    const px = -dirY * sign + dirX * 0.3;
    const py = dirX * sign + dirY * 0.3;
    const m = Math.hypot(px, py) || 1;
    if (tryMove(fighter, (px / m) * step, (py / m) * step, arena)) return true;
  }

  // Fully boxed in: keep whatever the direct attempt managed.
  fighter.x = direct.x;
  fighter.y = direct.y;
  return direct.x !== startX || direct.y !== startY;
}
