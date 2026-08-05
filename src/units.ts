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
 * ── 2.35 -> 2.10. THE NUMBER THAT MOVED IT THE OTHER WAY WAS WRONG ───────────
 * The previous pass took this 2.1 -> 2.35 on a measured claim that Brawl Stars
 * draws a brawler at **14-21%** of frame height while our cast drew at 12.2-14.2%.
 * A blind critic contradicted it in the same round, unprompted — "the WIP figure
 * occupies ~11% of frame height and the shipped brawlers occupy ~10-12% ... scaling
 * the character up will not fix it" — and the constant shipped anyway, with the
 * conflict written up as parked (`docs/DECISIONS-FOR-URI.md`).
 *
 * It has now been settled the only way it could be: **off a ruled frame against a
 * known-answer fixture**, rather than by eye on either side.
 *
 *   our cast (at 2.35)     10.4% of frame, 14.2% counting the legs
 *   Shelly                 12.5%
 *   Barley                 11-13.6%
 *   two blind critics      ~12% each, measured independently
 *
 * **The 14-21% band does not exist.** At 2.35 the cast is at or slightly ABOVE the
 * real band, not under it, and the direction of the original fix was backwards. At
 * 2.10 the same figures come to 9.3% / 12.7% — 12.7% sits almost exactly on
 * Shelly's 12.5% and inside Barley's range, which is the whole of the case.
 *
 * ── The second, independent reason, which pointed the same way all along ─────
 * `tools/tmp/castbox.mjs` measures the widest FOOD MASS half-width against
 * `HIT_RADIUS_VS_PLAYER` (`PLAYER_SIZE * 0.6` = **1.26 m** — the radius a shot is
 * actually tested against, not the 1.05 m movement radius):
 *
 *   2.10   widest model half-width 1.215 m  =  **0.96** of the hit radius
 *   2.35                           1.363 m  =  1.08   (art overhangs its hitbox)
 *   2.60                           1.505 m  =  1.19
 *
 * At 2.10 the art fills its own hitbox almost exactly, which is the ideal, and the
 * previous pass said so in the same breath as raising it. An attack that visually
 * connects with the edge of a character and whiffs is the "that should have hit me"
 * complaint arrived at from the opposite direction, and 2.35 was buying an 8%
 * overhang to chase a band that was not there.
 *
 * This constant is purely visual. The sim collides on `PLAYER_SIZE` (42 wu) and
 * `CHARACTER_RADIUS` below derives from that 42 independently, so moving it costs
 * nothing in balance and `aspect.mjs` never sees it.
 *
 * **The 2.6 note is withdrawn, not parked.** It rested on the same 14-21% band and
 * would have taken the cast to ~15.7% of frame, further from the reference than
 * either shipped value. It no longer wants a `HIT_RADIUS_VS_PLAYER` change because
 * it no longer wants to happen.
 *
 * ⚠️ Characters that author their own absolute height do it as a MULTIPLE of this
 * constant (`CHARACTER_HEIGHT * 0.976`), never as a metre literal, so this line
 * moves the whole cast. Six of them used literals until the previous pass, which is
 * the reason this revert is a one-line change rather than a seventh sweep.
 */
export const CHARACTER_HEIGHT = 2.1;

/**
 * Radius used for movement collision, in metres (PLAYER_SIZE 42 → 1.05 m).
 *
 * Deliberately derived from 42 and NOT from `CHARACTER_HEIGHT`: the sim's collision
 * is balance, the character's height is a look, and coupling them would make every
 * art decision a balance decision. See the note above.
 */
export const CHARACTER_RADIUS = 42 * WORLD_SCALE * 0.5;
