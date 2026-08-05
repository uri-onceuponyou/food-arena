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
 *
 * ── 2.1 -> 2.35, and this is the ONLY free lever on apparent size ────────────
 * Measured by pixels rather than trigonometry (hide the character, render, show it,
 * render again, bbox the diff, null control 0 px): the cast draws at **12.2-14.2%**
 * of frame height against a Brawl Stars band of **14-21%** — at or under the floor.
 * The camera cannot fix it: pitch and FOV are structurally neutral (best case x1.08)
 * because the fair-play rectangle fixes how much GROUND is in frame and the rig
 * re-solves distance to hold that window, and the one real camera lever,
 * `FAIR_PLAY.radiusUnits`, derives every term from `rules.ts` — reaching 17% that
 * way would need `REACH.rangedMax` down at melee reach.
 *
 * This constant is purely visual. The sim collides on `PLAYER_SIZE` (42 wu) and
 * `CHARACTER_RADIUS` below derives from that 42 independently, so moving it costs
 * nothing in balance and `aspect.mjs` never sees it.
 *
 * ── Why 2.35 and not 2.6, which is where the band's middle is ────────────────
 * Because the models are already almost exactly as wide as the radius a shot is
 * tested against, and a uniform scale widens them too. Measured
 * (`tools/tmp/castbox.mjs`, which reports the food mass separately from the
 * extremities, against `HIT_RADIUS_VS_PLAYER` = `PLAYER_SIZE * 0.6` = **1.26 m**,
 * not the 1.05 m movement radius — the hit radius is the one a player judges by):
 *
 *   shipped 2.1   widest model half-width 1.215 m  =  **0.96** of the hit radius
 *   2.35 (x1.12)                          1.363 m  =  1.08
 *   2.60 (x1.24)                          1.505 m  =  1.19
 *
 * At 2.1 the art fills its own hitbox almost exactly, which is the ideal. At 2.6 the
 * art is a fifth wider than the thing a shot tests, so an attack that visually
 * connects with the edge of a character whiffs — the "that should have hit me"
 * complaint, arrived at from the opposite direction to the usual one. 2.35 takes the
 * apparent size to roughly **15.9%** — inside the reference band rather than under
 * it — for an 8% overhang on the single widest character.
 *
 * **The remaining step is parked, not rejected, and it is a `rules.ts` decision:**
 * going to 2.6 wants `HIT_RADIUS_VS_PLAYER` at ~0.72 of `PLAYER_SIZE` instead of
 * 0.6 so the hitbox keeps up with the art. That is a balance change and belongs to
 * whoever owns the reach ladder.
 *
 * ⚠️ Characters that author their own absolute height do it as a MULTIPLE of this
 * constant (`CHARACTER_HEIGHT * 0.976`), never as a metre literal, so this line
 * moves the whole cast. Six of them used literals until this change.
 */
export const CHARACTER_HEIGHT = 2.35;

/**
 * Radius used for movement collision, in metres (PLAYER_SIZE 42 → 1.05 m).
 *
 * Deliberately derived from 42 and NOT from `CHARACTER_HEIGHT`: the sim's collision
 * is balance, the character's height is a look, and coupling them would make every
 * art decision a balance decision. See the note above.
 */
export const CHARACTER_RADIUS = 42 * WORLD_SCALE * 0.5;
