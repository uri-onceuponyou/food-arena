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
export function tryMove(fighter: Fighter, dx: number, dy: number, arena: ArenaDefinition): void {
  const half = fighter.size / 2;
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
}
