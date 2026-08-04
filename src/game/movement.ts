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
  if (startDist - direct.d >= step * 0.35) {
    // Real progress toward the target: whatever we were going around, we are past it.
    fighter.detourSign = 0;
    return true;
  }

  // Blocked. Commit to a perpendicular even though it makes the straight-line
  // distance WORSE — that is what going around something means, and it is why a
  // greedy "pick whichever candidate ends up closest" rule can never escape: every
  // detour scores worse than pressing into the wall, so greedy picks the wall.
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
  // Measured before this fix, over 180s per cell against a motionless immortal
  // player: the enemy never reached 52% of standable cells, INCLUDING the player's
  // own spawn, and finished every match wedged at ~(749,227) in the 0.5wu notch
  // between `stacked_pots` and `sink_counter`, alternating N and SE.
  //
  // The fix is both halves: score the two sides by ACTUAL displacement (the only
  // informative signal available here — `tryMove` returning true merely means
  // "moved at all", which this function already documents as the wrong test), then
  // PERSIST the winner on the fighter until real progress resumes above.
  const candidate = (sign: number) => {
    fighter.x = startX;
    fighter.y = startY;
    // Bias the detour slightly forward so the mover rounds the corner instead of
    // sliding flat along the face forever.
    const px = -dirY * sign + dirX * 0.3;
    const py = dirX * sign + dirY * 0.3;
    const m = Math.hypot(px, py) || 1;
    tryMove(fighter, (px / m) * step, (py / m) * step, arena);
    return { x: fighter.x, y: fighter.y, moved: Math.hypot(fighter.x - startX, fighter.y - startY) };
  };

  // Already committed to a side? Keep it while it still buys real movement. Holding a
  // slightly worse side beats re-deciding into a dither — the mover needs several ticks
  // in one direction to actually clear an obstacle.
  if (fighter.detourSign !== 0) {
    const held = candidate(fighter.detourSign);
    if (held.moved >= step * 0.35) {
      fighter.x = held.x;
      fighter.y = held.y;
      return true;
    }
    // That side is now blocked too — an inside corner. Fall through and re-choose.
  }

  const a = candidate(1);
  const b = candidate(-1);
  const best = a.moved >= b.moved ? { sign: 1, r: a } : { sign: -1, r: b };

  if (best.r.moved >= step * 0.35) {
    fighter.detourSign = best.sign;
    fighter.x = best.r.x;
    fighter.y = best.r.y;
    return true;
  }

  // Fully boxed in: keep whatever the direct attempt managed, and drop the commitment
  // so the next tick is free to choose again rather than re-trying a dead side.
  fighter.detourSign = 0;
  fighter.x = direct.x;
  fighter.y = direct.y;
  return direct.x !== startX || direct.y !== startY;
}
