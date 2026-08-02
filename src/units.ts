/**
 * Unit system.
 *
 * All gameplay math runs in "world units" — the exact same numbers the 2D prototype
 * used, so the frozen balance in `game/rules.ts` stays literally unchanged. Rendering
 * happens in Three.js metres. This module is the only place that bridges the two.
 *
 * Prototype ground plane was X (right) / Y (down). In 3D that becomes X (right) /
 * Z (into the screen), with Y as up. So world (x, y) → three (x * S, 0, y * S).
 */

/** Three.js metres per world unit. 42-unit character ≈ 2.1 m tall. */
export const WORLD_SCALE = 0.05;

/** Convert a world-unit length to metres. */
export const wu = (n: number): number => n * WORLD_SCALE;

/** Convert metres back to world units. */
export const toWorldUnits = (m: number): number => m / WORLD_SCALE;

/** Convert a prototype ground position to a 3D ground position. */
export function groundPos(x: number, y: number): { x: number; z: number } {
  return { x: x * WORLD_SCALE, z: y * WORLD_SCALE };
}

/**
 * Canonical character height in metres. Every character model MUST be authored to
 * roughly this height with its feet at y=0, so the roster reads as one cast and the
 * camera framing works for all of them.
 */
export const CHARACTER_HEIGHT = 2.1;

/** Radius used for movement collision, in metres (PLAYER_SIZE 42 → 1.05 m). */
export const CHARACTER_RADIUS = 42 * WORLD_SCALE * 0.5;
