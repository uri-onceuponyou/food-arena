/**
 * PROXIMITY — one answer to "how far away is too far", for every layer that has to ask.
 *
 * ## Why this module exists at all
 *
 * Uri, playing the deployed build:
 *
 *   > *"We need to make sure that SFX has the same behavior as the shake. I shouldn't
 *   > hear loudly or at all something very far, and as I get closer to it it becomes
 *   > louder, while what sits in the screen is the loudest."*
 *
 * Two presentation layers need that rule: `render/camera.ts` scales screen shake by how
 * far the impact was, and `audio/director.ts` scales a voice's gain the same way. **One
 * rule stated in two places is this repo's single most repeated defect** — five AI driver
 * bugs, `range` meaning two different quantities, per-pellet `damage` balanced against
 * twice, eleven copies of one module list, a fog formula that "AGREED BY CONSTRUCTION"
 * until it did not. Two answers to "how far is too far" would be that defect again, and
 * the second copy always looks harmless on the day it is written.
 *
 * ## 🚨 WHY IT IS HERE AND NOT IN `render/` OR IN `audio/`
 *
 * It is a sibling of `units.ts` — a root-level module that **imports nothing** — for a
 * layering reason, not a filing one:
 *
 *   * putting it in `render/camera.ts` makes `src/audio/` import the render layer;
 *   * putting it in `src/audio/` makes `src/render/` import the audio layer.
 *
 * Both are the same smell pointing opposite ways. A dependency-free root module is
 * reachable from both with no arrow between them, exactly as `units.ts` already is (it is
 * imported by `render/stage.ts`, `game/vfx.ts`, `arena/*` and `ui/screens/charStage.ts`
 * alike). It also means the whole rule is importable by a plain Node instrument —
 * `tools/tmp/sx_at_cens.mjs` measures the SHIPPED curve rather than a copy of it, which
 * is not possible for anything living inside `director.ts` (a TypeScript parameter
 * property there makes the file unloadable by `node --experimental-strip-types`).
 *
 * ⚠️ **If the shake ends up with its own falloff in `render/camera.ts`, that is the bug
 * this file exists to prevent.** The shake should call `proximityGain` with its own two
 * radii. Different radii are fine and expected — shake and sound do not have to reach
 * equally far. A different SHAPE is not.
 */

/**
 * The shared falloff: **1 inside `fullUnits`, 0 at and beyond `fadeUnits`, smooth between.**
 *
 * `smoothstep` rather than a linear ramp or a rational `1/(1+d/k)`, for three reasons that
 * are all about the ends rather than the middle:
 *
 *   * it is exactly 1.0 for a whole disc around the listener, so "what sits in the screen
 *     is the loudest" is a flat plateau and not a peak you can only stand on;
 *   * it reaches exactly 0 at a FINITE distance, so "I shouldn't hear it at all" is
 *     reachable — a rational falloff never gets there and needs a floor or a hard cut,
 *     which is precisely how the previous curve ended up with `MIN_DISTANCE_GAIN`;
 *   * its derivative is 0 at both ends, so a fighter drifting across either boundary does
 *     not produce an audible edge. A linear ramp has a corner at each end and the ear
 *     finds them.
 *
 * `fadeUnits <= fullUnits` is a misconfiguration rather than a crash: it degenerates to a
 * hard step at `fullUnits`, and never returns `NaN`.
 *
 * @param distanceUnits  world-unit distance from the listener/viewer to the event.
 * @param fullUnits      inside this, full strength.
 * @param fadeUnits      at and beyond this, nothing.
 */
export function proximityGain(distanceUnits: number, fullUnits: number, fadeUnits: number): number {
  if (!(distanceUnits > fullUnits)) return 1;      // also catches NaN -> full, never silent
  if (distanceUnits >= fadeUnits) return 0;
  const span = fadeUnits - fullUnits;
  if (span <= 0) return 0;
  const t = (distanceUnits - fullUnits) / span;
  return 1 - t * t * (3 - 2 * t);
}

/**
 * SFX: the disc that plays at FULL level.
 *
 * Sized to `render/camera.ts`'s `FAIR_PLAY.radiusUnits` (199.2 wu) — the disc EVERY
 * supported display is guaranteed to show — rounded to 200. That is the whole of Uri's
 * *"what sits in the screen is the loudest"* clause: if it is certainly on screen, it is
 * certainly at full level, on every device and every aspect.
 *
 * ⚠️ **NOT imported from `camera.ts`, and that is the layering point above.** The coupling
 * is checked instead of wired: `tools/tmp/sx_at_cens.mjs --selftest` fails if this drifts
 * from `FAIR_PLAY.radiusUnits`. Retyping a coordinate is how this repo grew a dozen stale
 * 1× map literals, so if you move `FAIR_PLAY`, run that selftest.
 */
export const SFX_FULL_WU = 200;

/**
 * SFX: the distance at which a sound has faded to nothing.
 *
 * Chosen against three measured landmarks rather than by ear, all of them re-derived in
 * `tools/tmp/sx_at_cens.mjs`'s table:
 *
 *   * **470 wu** — the camera's worst-case ground reach at the widest supported aspect.
 *     `fade` must sit well beyond it or something visible on screen could be silent, which
 *     is a competitive defect and not a mix choice. At 470 wu this curve gives **0.668**.
 *   * **915.9 wu** — the MINIMUM pairwise spawn separation on the shipped 2800×2000 arena
 *     (`arena/kitchen.ts`; seats 0↔3 and 1↔2). Nothing is in weapon range of anything at
 *     the whistle — the longest reach in `rules.ts` is `REACH.rangedMax = 140` — so a
 *     fade that lands at the spawn separation means the opening silence is genuine.
 *   * **3440.9 wu** — the map diagonal. Under the previous curve the far corner and a hit
 *     just off screen arrived at IDENTICAL volume (both floored at 0.32, and the floor
 *     bound everywhere past 892.5 wu — 74% of the diagonal). That is what Uri heard.
 *
 * ⚠️ **This number is a policy, and it is the one to turn if the mix is wrong.** Raising it
 * makes the arena chattier; lowering it makes an off-screen threat vanish sooner. It does
 * NOT change the shape, and nothing else in the game should acquire a second opinion about
 * it — see the header.
 */
export const SFX_FADE_WU = 900;

/**
 * Below this gain a voice is not scheduled at all.
 *
 * Not a taste threshold — a BUDGET one. `audio/engine.ts` runs a 20-voice cap and evicts
 * by priority, so a voice at 0.004 that nobody can hear still costs a slot that a nearby
 * hit wants. `proximityGain` reaches exactly 0 at `SFX_FADE_WU`, so this only ever culls
 * the last few percent before that; it is stated as a number rather than `=== 0` so the
 * cull does not silently stop working if the curve is ever re-shaped.
 *
 * ≈ -34 dB. `tools/audio-probe.mjs`'s master chain measures peaks in the 0.06–0.33 range
 * for a single voice, so 0.02 of one of those is comfortably under the kitchen bed.
 */
export const SFX_INAUDIBLE_GAIN = 0.02;
