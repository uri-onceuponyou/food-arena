/**
 * Kitchen arena — shared foundation.
 *
 * Owns everything the other `arena/` modules (floor, hazards, ambient, and the
 * `props/*` builders) all depend on, so there is exactly one copy of each:
 *
 *   - Map-scale constants (`ARENA_W`/`ARENA_H`/`CENTER`/`MAX_SAFE_RADIUS`) and the
 *     floor's layered Y heights (`FLOOR_Y`).
 *   - The `KPAL` colour palette and `buildMaterials()` (the `Materials` type/factory
 *     every builder takes as its first argument).
 *   - Tiny geometry helpers (`puck`, `mesh`, `noOutline`) used by every builder.
 *   - The baked contact-shadow decal system (`buildContactShadow`) and the two
 *     shared cover-prop trim helpers (`addBacksplash`, `addTopRim`).
 *   - `addCover()` — the single place a `CoverBox` gets registered AND its matching
 *     visual (body + contact AO ring) gets built, used by `kitchen.ts`'s layout.
 *
 * This module owns no gameplay layout (no coordinates for any specific prop) and no
 * per-prop visual design — it is pure infrastructure for the modules that do.
 */

import * as THREE from 'three';
import type { CoverBox } from './types';
// TYPE-ONLY, and for the same structural reason `arena/types.ts` imports it type-only:
// `game/movement.ts` imports `ArenaDefinition` from `./types`, and a VALUE import of a
// `game/` module here would close a runtime cycle through the arena. `import type` is
// erased by both tsc and esbuild, so no cycle exists in the emitted graph.
import type { ConcealBox } from '../game/movement';
import { mergeGeometries } from 'three/examples/jsm/utils/BufferGeometryUtils.js';
import { toonMat, glossyMat, flatMat, roundedBox, RAMP_SOFT } from '../render/toon';
import { wu, groundPos, CHARACTER_HEIGHT } from '../units';
import { PALETTE, fogOpeningRadiusFor } from '../game/rules';
import {
  makeTileWearTexture,
  makeWoodGrainTexture,
  makeButcherBlockTexture,
  makeBrushedMetalTexture,
  makePlankTexture,
  makeBurlapTexture,
  makeBarrelTexture,
  makePanelSeamTexture,
} from './textures';

// ─────────────────────────────────────────────────────────────────────────────
// Map constants
// ─────────────────────────────────────────────────────────────────────────────

/**
 * ── ×4 AREA, 2026-08-11. `DECISIONS §48`, Uri: *"Arena x4 - area to accommodate 4-6
 *    players"*, and `§53a`: *"6 players only on the ×4 map."* ───────────────────
 *
 * Was 1400 × 1000. **×4 AREA, not ×4 linear** — so ×2 on each edge. (×4 linear would have
 * been 5600 × 4000, i.e. 16× the area.) This is the size decision, settled by Uri and not
 * reopenable here; `src/arena/kitchen.ts`'s header carries the layout that fills it and
 * the five rules that layout had to satisfy.
 *
 * 🔴 **EVERYTHING DOWNSTREAM IS DERIVED, AND THAT IS THE WHOLE REASON THIS EDIT IS TWO
 * LINES.** `MAX_SAFE_RADIUS` below, `apron.ts`'s every bound, `floor.ts`'s tile grid and
 * chip scatter and border trim, `ambient.ts`'s dust volume and `camera.ts`'s fair-play
 * radius all read these two constants or a formula over them. Measured consequences:
 *
 *   * **The fog is DERIVED and stays derived.** The relative schedule is scale-invariant
 *     (the ring still opens at 1.1538 × the half-diagonal); only the ABSOLUTE sweep
 *     doubles, 22.1 → 44.1 wu/s. ⚠️ Pinning the 1× literal 993 on this map is degenerate —
 *     it was measured at **880/880 matches with no contact, every match over in 2.03 s**,
 *     because both spawns start outside the opening ring.
 *   * **The endgame keep-out doubles with it**: `max(MIN_SAFE_RADIUS, maxSafeRadius ×
 *     (1 − CONCEAL_ENDGAME_PROGRESS))` goes 248.25 → **496.25 wu**. Every concealment
 *     patch and every spawn has to clear it, which is why `kitchen.ts`'s 20 patches all
 *     sit out past r=500.
 *   * **`tools/aspect.mjs` cannot break on size** and is verified, not assumed:
 *     `FAIR_PLAY.radiusUnits` derives from `REACH`, never from the arena.
 *   * **`movement.ts:NAV_MAX_CELLS` (40,000) IS hit.** 2800 × 2000 at the shipped 10 wu
 *     nav cell needs 56,000, so `navGrid` silently doubles its cell to **20 wu**. That is
 *     not fixed here — `movement.ts` is not this module's file — it is answered as a
 *     LAYOUT RULE: every face-to-face gap in `kitchen.ts` is ≤ 16 wu or ≥ 82 wu
 *     (= `PLAYER_SIZE` + 2 nav cells), so no corridor exists that the flow field cannot
 *     see. `tools/tmp/x4_layout.mjs` asserts it.
 */
export const ARENA_W = 2800;
export const ARENA_H = 2000;
export const CENTER = { x: ARENA_W / 2, y: ARENA_H / 2 }; // 1400, 1000

/** Half-diagonal of the playfield — the distance to its FARTHEST point, a corner. */
export const ARENA_HALF_DIAGONAL = Math.hypot(ARENA_W / 2, ARENA_H / 2); // ≈ 1720.47

/**
 * How far the apron's service floor runs past EVERY bound, world units.
 *
 * ── Why it lives here rather than in `apron.ts`, where it was authored ──────────
 *
 * It is the outer extent of everything this game ever DRAWS, so it is a map-scale
 * constant and it now has a second consumer: `fogRing.ts` derives `FIELD_OUTER_UNITS`
 * from `ARENA_HALF_DIAGONAL + APRON_OUT`, because the danger canopy has to cover every
 * surface the camera can reach and the apron is the outermost of them. It was moved here
 * rather than copied — `fogRing` importing `apron` would be the renderer's boundary
 * effect depending on the set dressing, and a second literal `760` is the exact failure
 * this whole edit is fixing one generation later.
 *
 * ── The number, which is SOLVED and not chosen ─────────────────────────────────
 *
 * A player is clamped to `[21, W−21] × [21, H−21]` (`movement.ts`, half a body) and the
 * camera is player-centred, so the furthest the view ever reaches past a bound is the
 * frustum's own ground corner. Solved off `camera.ts`'s numbers in `apron.ts`'s header:
 *
 *     aspect   camera dist   lateral reach   up-screen   down-screen
 *     4:3        30.88 m        311 wu         319 wu       143 wu
 *     21:9       26.62 m        470 wu         275 wu       123 wu
 *
 * **470 wu is the worst case in any direction.** 760 is well past it on every side at
 * zero extra cost — the apron ring is the same vertex count either way — so no future
 * camera tweak can re-open a hole. `apron.ts`'s `DRESS_OUT` (540) is the separate,
 * tighter bound for where PROPS stop.
 */
export const APRON_OUT = 760;

/**
 * Seconds of play before the closing ring first cuts into the playfield.
 *
 * Uri's call: *"Start the circle bigger. So it touches first the arena after 5-7
 * seconds."* Set to 6, the middle of that range.
 *
 * ── Kept ABSOLUTE when the clock went 180 s -> 45 s (2026-08-05) ─────────────
 *
 * The obvious alternative was to make this a FRACTION of `MATCH_DURATION_MS`, since on
 * a 45 s clock the ring is technically "closing" for 87% of the match instead of 97%.
 * It stayed absolute, for three reasons:
 *
 *  1. It encodes a HUMAN duration, not a share of a match — how long a player gets to
 *     land, orient and start moving before the map begins to shrink. Uri specified it
 *     in seconds ("5-7 seconds"), and that intent does not scale with match length.
 *  2. First contact is with the arena's furthest CORNER, which nobody is standing in
 *     at t=6 s (both spawns sit on the centre line). The moments that actually matter
 *     to a player are when the ring crosses the inscribed radius (500 wu — it starts
 *     eating playfield rather than corners) and when it reaches its floor. Both are
 *     functions of `MATCH_DURATION_MS` alone and land correctly at 45 s: 22.3 s and
 *     42.0 s respectively. Fractionalising this constant would not move either.
 *  3. As a fraction it misbehaves at both ends — 1/30th of the old 180 s clock is the
 *     6 s it already was, but 1/30th of a hypothetical 20 s clock is 0.7 s, and the
 *     derivation below divides by `1 - t/T`, so a fraction bakes a fixed ring-growth
 *     multiplier in rather than letting the ring open wider as the clock shortens,
 *     which is exactly the behaviour that keeps first contact where Uri asked for it.
 *
 * ⚠️ This must stay well below `MATCH_DURATION_MS`: the derivation below divides by
 * `1 - FOG_FIRST_CONTACT_S * 1000 / MATCH_DURATION_MS`, which blows up as the two
 * approach each other. At 45 s the divisor is 0.867; the assertion in
 * `src/game/sim.test.mjs` guards the relationship.
 *
 * ── 🚨 2026-08-12: THIS IS NO LONGER A CAUSE. IT IS A CONSEQUENCE. ─────────
 *
 * Uri lengthened the match and gave the ring an explicit **HOLD**
 * (`rules.ts:FOG_HOLD_MS`, 25 s) instead of the start-outside-the-map trick, so first
 * contact is not solved for any more — it IS the hold, and the divisor above no longer
 * exists to be ill-conditioned. His words for why it moved 6 -> 25: *a grace period to find
 * a weapon and an opponent on a 2800x2000 map.* 6 s was 13% into a 45 s match and would
 * have been 4% into this one.
 *
 * ⚠️ **AND IT IS A LITERAL ON PURPOSE, WHICH RULE 10 WOULD ORDINARILY FORBID.** Writing
 * `FOG_HOLD_MS / 1000` here would be the honest derivation and it BREAKS THREE TOOLS:
 * `tools/tmp/arena_probe.mjs:120`, `tools/tmp/spawn_runway.mjs:108` and
 * `tools/tmp/radar_probe.mjs:63` read this constant by REGEX (`= ([\d.]+)`) out of this
 * file's text, and a non-numeric right-hand side makes `.exec(...)[1]` throw on null. The
 * duplication is instead guarded: `node tools/tmp/fs_sched_census.mjs` fails if this number
 * is not exactly `FOG_HOLD_MS / 1000`, and that guard is validated against a known-bad.
 */
export const FOG_FIRST_CONTACT_S = 25;

/**
 * Opening safe radius, DERIVED rather than hand-picked.
 *
 * The previous value (850) was **smaller than the arena's own half-diagonal (860.2)**, so
 * the safe circle never contained its own corners: the NW corner sits at 831 from centre
 * and was therefore inside the lethal fog **from t=0, for the entire match.** Corners were
 * permanently unusable space, and there was no way to see one un-fogged at all — which
 * also meant no frame of a corner could be judged for hue or value.
 *
 * `sim.ts` shrinks linearly: `safeRadius = maxSafeRadius × (1 − matchProgress)`. So to put
 * first contact at `FOG_FIRST_CONTACT_S`, solve for the radius that has decayed to exactly
 * the half-diagonal by then:
 *
 *     R0 = halfDiagonal / (1 − t / MATCH_DURATION)
 *        = 1720.47 / (1 − 6/45)
 *        ≈ 1985
 *
 * ⚠️ **THE OLD WORKING IS KEPT ABOVE THE NEW ONE BECAUSE THE FORMULA DID NOT CHANGE.**
 * At 1400×1000 the same expression read `860.23 / (1 − 6/45) ≈ 993`; the arena went ×4 in
 * area on 2026-08-11 (`DECISIONS §48`) and the half-diagonal doubled, so the ring opens at
 * 1985 and sweeps at 44.1 wu/s instead of 22.1. **The RELATIVE schedule is unchanged to
 * four decimals** (1.1543 → 1.1538 × the half-diagonal), which is the property that makes
 * deriving it rather than pinning it the whole point: `tools/tmp/ax_layout.mjs --selftest`
 * asserts both halves of that sentence, and a literal 993 on this map was measured at
 * 880/880 matches with zero contact.
 *
 * Derived from the arena dimensions and the match length rather than written as a literal,
 * so resizing the map or changing the match duration cannot silently re-create the
 * corners-fogged-from-birth bug.
 *
 * ⚠️ This VALUE MOVED on 2026-08-05, 890 -> 993, without this file's formula changing at
 * all: `MATCH_DURATION_MS` went 180 s -> 45 s (see the rationale on that constant), and a
 * shorter clock with first contact still pinned at 6 s necessarily means a larger opening
 * ring, swept faster (4.9 -> 22.1 wu/s). Anything that hardcoded 890 — or that normalises
 * the ring against a fixed arena extent rather than against `arena.maxSafeRadius` — is now
 * wrong by 12%.
 *
 * The closing ring also has a FLOOR now (`rules.ts:MIN_SAFE_RADIUS`, 140 wu): it no longer
 * reaches zero, because a zero ring made the last seconds of a full-length match a pure HP
 * arithmetic race that the 100 HP player always lost.
 *
 * ── 🚨 2026-08-12: THE DIVISION IS GONE. 1985 -> 1720.4650534085254. ───────
 *
 * **The whole formula above existed to place first contact at 6 s by starting the ring
 * OUTSIDE the map.** `rules.ts:FOG_HOLD_MS` does that explicitly now, so the opening radius
 * has one job left — contain the playfield at t=0 — and `rules.ts:fogOpeningRadiusFor`
 * names the answer: the half-diagonal. Everything above is kept because the values it
 * produced (850 -> 890 -> 993 -> 1985) are the record of a number that moved four times
 * without anyone deciding it should, which is the argument for removing the coupling.
 *
 * ⚠️ **UNROUNDED, AND THAT IS LOAD-BEARING.** `Math.round` would give 1720, putting the
 * four corners 0.47 wu outside the ring at t=0 — a small version of the corners-fogged-from-
 * birth bug this comment opens with. See `fogOpeningRadiusFor` for the margin arithmetic.
 *
 * 🚨 **THE OLD DERIVATION IS COPIED INTO DOZENS OF INSTRUMENTS AND EVERY COPY IS NOW WRONG
 * BY 4.2%.** They recompute `Math.round(halfDiag / (1 - 6000 / MATCH_DURATION_MS))`, which
 * on the new clock returns **1792** rather than 1720.47 — a plausible number, from a formula
 * that no longer describes the game, inside the instruments the balance re-measure runs on.
 * A silent 4.2% wrong fog is worse than a crash. `tools/arena.gameplay.json` additionally
 * bakes the stale **1985**.
 * → **`node tools/tmp/fs_sched_census.mjs` enumerates every executable copy, file and line.**
 * The count is deliberately not written here: it is measured, it will change as the copies
 * are fixed, and a number in prose is how six counts went stale in one session. The balance
 * tools accept `--maxsafe` as the interim fix; `rules.ts:fogOpeningRadiusFor` is the real one.
 */
export const MAX_SAFE_RADIUS = fogOpeningRadiusFor(ARENA_HALF_DIAGONAL);

// ─────────────────────────────────────────────────────────────────────────────
// Ground-shadow direction, and the round-9 removal of the baked CAST decals.
//
// ── What this direction is for now ────────────────────────────────────────────
// One thing only: `addCover` offsets each prop's contact/AO ring a fraction of its
// own overhang along it, so the grounding band stays tight on the LIT side and runs
// a little further on the shaded side. That is what makes the ring read as
// light-driven contact darkening rather than a symmetric grey halo.
//
// It is the key light's azimuth, duplicated. `render/lighting.ts` is out of bounds
// for this module, so the number is copied rather than read at runtime.
//
// ── ROUND 12: THE Z COMPONENT'S SIGN WAS WRONG, WHICH IS THE SAME BUG THE ─────
//    LIGHTING PASS JUST FOUND IN THE KEY ITSELF
//
// `086ff5f` moved the key from azimuth +16 deg to **-31 deg** because +Z is the
// CAMERA's own side and a light there throws every shadow behind its own caster. All
// three baked duplicates in `src/arena` were left on the pre-swing offset
// (16.35, 9.82, 4.69), i.e. shadow direction (-0.961, -0.276).
//
// That is 47 deg out — but the angle is not the interesting part. The Z component
// **changed sign**: the real key now throws shadows toward +Z, TOWARD the viewer, and
// every baked offset in this arena was still pushing them toward -Z, away from the
// viewer and behind the prop. Exactly the defect `086ff5f` fixed in the renderer,
// still live in the three files that mirror it, and invisible for the same reason:
// nothing here draws a hard edge, so a soft field pointing the wrong way just reads as
// "lit by nothing in particular" (`docs/LESSONS.md` §1).
//
// The live rig, read off `window.__stage.lighting.key` by `tools/tmp/aoband.mjs` at
// three stations: offset (29.98, 28.32, -18.01), azimuth -30.99 deg, elevation 39.00
// deg. hypot(29.98, 18.01) = 34.97, so the ground direction the light comes FROM is
// (0.8572, -0.5150) and a shadow falls the other way.
//
// IF THAT AZIMUTH MOVES, MOVE ALL THREE: this constant, `arena/apron.ts`'s
// `SHADOW_X`/`SHADOW_Y` (its kerb contact band) and `arena/floor.ts`'s `along` term
// (its baked litness ramp). `tools/tmp/bakedaz.mjs` asserts all three against
// `lighting.ts`'s own `KEY_OFFSET` and fails if any of them drifts again.
//
// ── The cast decals are GONE, and why ─────────────────────────────────────────
// Rounds 6-8 gave every cover prop, the pot and several small props a second baked
// decal on top of the AO ring: a soft feathered oval trailing away from the prop
// along this direction, standing in for a real cast shadow back when the shadow map
// was mushy. It is not needed any more, and it was actively holding the rig back.
//
// Ablated at shipped framing, player-centred, in the live game (hide the family,
// re-render, per-pixel diff — `tools/tmp/rake.mjs --mode ablate`):
//
//   contact/AO decals  mean 2.25/255 over 8.5% of pixels — LOAD-BEARING, KEPT.
//                      The diff image is a tight dark band hugging every prop's
//                      footprint. Hiding them makes every pad-mounted prop float.
//   cast decals        mean 0.13/255 over 0.75% of pixels — REMOVED. The diff image
//                      is five faint slivers, most of them under the prop that casts
//                      them. The shadow map does this job properly now.
//
// The 0.13 was never the point, though. This direction being FROZEN is what stopped
// the key light's azimuth from moving at all, because rotating it would have pointed
// the real shadows one way and 32 baked ones another. With the cast decals gone the
// azimuth is free, and swinging the key side-on buys raking modelling on every curved
// surface in the arena — measured +21% terminator ramp on the barrel's skirt — which
// is worth incomparably more than 0.13/255. Removing these without moving the key
// would have been a small strict loss, which is why the two landed as one change.
// `render/lighting.ts`'s KEY_OFFSET, XZ only. Written as the raw components rather
// than as a pre-normalised pair so the source of the number stays legible.
const KEY_X = 29.98, KEY_Z = -18.01;
const SHADOW_DIR_LEN = Math.hypot(KEY_X, KEY_Z);
const SHADOW_DIR = { x: -KEY_X / SHADOW_DIR_LEN, z: -KEY_Z / SHADOW_DIR_LEN };

// ─────────────────────────────────────────────────────────────────────────────
// Kitchen palette — extends the shared character PALETTE with arena-only tones so
// produce accents on crates/sacks visually match the roster.
//
// ═════════════════════════════════════════════════════════════════════════════
// THE SATURATION CONTRACT (2026-08-04)
// ═════════════════════════════════════════════════════════════════════════════
//
// The whole-arena scanner (`tools/arena-scan.mjs`) put the parts at 5-7/10 and the
// WHOLE at 4.2 — three fresh critics at 4 / 4.5 / 4 with reference controls at 8,
// 7.0-7.5 and 8, so all three rounds were valid and the spread (0.5) is the tightest
// this project has measured. All three independently named the SAME first fix, and
// the numbers agreed with them:
//
//   * playerRank median 34.5 of 144 — the player was never in the top three salience
//     cells of any of the 18 stations. The hierarchy did not point at the character
//     you control.
//   * |player - surround| luma <= 0.06 at 14 of 18 stations, NEGATIVE at 8.
//   * The player was no MORE saturated than his surroundings at 15 of 18.
//   * One 30-degree hue band held 26-51% of all frame chroma at 15 of 18.
//
// ── THE CONTRACT — and read the CORRECTION below before applying it ───────────
//
//   **WHAT IS RESERVED FOR ACTORS, THREATS AND PICKUPS IS HUE, NOT SATURATION.
//   THE STATIC ENVIRONMENT IS SATURATED, COOL, AND HELD IN A NARROW VALUE BAND.**
//
//   Static surface (floor, pads, crates, sacks, counters, freezers, barrels, trim):
//       confined to the COOL half of the wheel wherever the fiction allows, at full
//       chroma, in a narrow value band, and never the brightest OR the most
//       saturated thing in frame.
//   Warm hues (0-60 deg) and the frame's high-value highlights belong to the cast,
//       the hazards and the VFX.
//   Reserved chroma, DO NOT quiet these: `flame`, `flameCore`, `hazardStripeBright`,
//       `hazardGlowHot`, `broth`, `freezerGlow`, plus everything in `game/rules.ts`'s
//       `PALETTE` (characters) and every VFX colour.
//
// ── THE CORRECTION, and it cost two critic rounds to find ─────────────────────
// The first three rounds of this work read the contract as "desaturate the static
// environment", which is how all three original critics phrased it. That is WRONG,
// and it is wrong in a way that is easy to prove: `tools/tmp/chroma.mjs` run over the
// ten curated gameplay reference plates gives the band we are actually aiming at, and
// the references are not desaturated at all —
//
//                             reference (n=10)   after "desaturate the environment"
//   mean saturation           0.493 (0.37-0.69)  0.302   <- below ALL TEN plates
//   COOL chroma per px        0.343              0.131   <- 38% of reference
//   warm chroma per px        0.145              0.133   <- correctly in band
//   warm / total chroma       0.297              0.503
//   mean luma                 0.509              0.354
//
// So the warm environment had been brought into the reference band correctly, and
// then the COOL environment was cut alongside it — which is pure loss. Two fresh
// blind critics scored the result 4/10 (reference control 8/10 both times, so both
// rounds valid) and both used the words "muddy"/"drained"/"washed out", one naming
// the desaturated barrels specifically as props that "sink into" the floor.
//
// Look at `reference/images/curated/gameplay/bs_02.png` and the numbers become
// obvious: a saturated violet ground, saturated green bushes, cool violet-grey
// crates. Every static thing is high-chroma; it is just all in ONE COOL FAMILY, with
// a narrow value range. The warm half of the wheel is left empty so the cast and the
// VFX own it outright. That is how the reference gets its hierarchy — hue complement
// at full chroma, not a saturation gradient.
//
// So: the arena's own cool landmarks (freezer, steel tops, barrels, herb crate, spice
// cart, the hub mats, the utility pads) are authored at FULL chroma here. Only the
// WARM environment — the tile, the plank pads, the crates, the sacks, the trim — is
// held down, because warm is what the cast is made of. This is not less colour, it is
// colour spent on one side of the wheel.
//
// Putting the cool chroma back did exactly what the model predicts and cost nothing:
// cool chroma 0.131 -> 0.158, warm chroma held at 0.131, warm share of all frame
// chroma 0.503 -> 0.454, the 0-30 deg band 0.070 -> 0.064, mean saturation 0.302 ->
// 0.320, channel clipping unchanged. **Adding cool chroma lowers the warm band's
// SHARE more cheaply than removing warm chroma does**, which is worth knowing because
// every round before this one tried to do it the other way round.
//
// STILL SHORT OF THE REFERENCE, and the gap is not this file's: mean saturation 0.320
// vs 0.493, cool chroma 0.158 vs 0.343, mean luma 0.353 vs 0.509. All three are
// dominated by the FLOOR, which is a quarter of every frame. A grey floor satisfies
// the hue-band metric and still loses to the reference; what the reference plates
// actually run is a ground that is cool AND saturated AND at a higher value than
// ours. Measured, not asserted — see `tools/tmp/chroma.mjs`.
//
// ── WHAT THIS PALETTE ACTUALLY CONTROLS — measure before attributing ──────────
// `tools/tmp/matcover.mjs` renders a material ID buffer and reports, per material,
// its exact share of the frame plus the colour it arrives at after lighting and the
// grade. Run it before arguing about any colour in this file. Averaged over four
// player-centred gameplay stations, it showed that MOST of the frame is not this
// file's to move, which is not what the brief that commissioned this change assumed:
//
//   OWNED ELSEWHERE — these entries are overridden downstream, so editing them here
//   changes NOTHING on screen. Re-measured round 11 (6 stations, 1600x900); the hexes
//   below are the ones actually in the tree, because a stale quote here has already
//   sent one round chasing a colour that no longer existed:
//     floor.ts        tileLight (13.0%) / tileDark (13.2%) / subfloor (1.8%) /
//                     floorGrime (2.4%) / woodPad+woodSeam level+chroma transform
//     counters.ts     cabinet -> #6F8CAE `stoveCap` (6.2%), cabinetDark -> `coverBody`
//                     (5.2%), butcherBlock -> `prepCap` (1.6%), crateSlat ->
//                     `coverSkirt` (2.2%)
//     storage.ts      freezerLid -> `roofMat`, crateWood -> `lidMat`, potMetal ->
//                     the lane-pot stack
//   OWNED HERE: the grounding decals (10.1% combined — `groundedShadowStrong` alone is
//     7.3%, the third-largest surface in the game), utilityMat 8.4% (via floor.ts's
//     level transform, but the hue and chroma are this file's), coverPlinthPanel 1.8%,
//     potMetal 1.6%, rimLight 1.3%, steelDark 1.2%, flour 1.1%, burlap 0.9%, ...
//   The grounding decals' colour is the tint they blend TOWARD, not a surface colour —
//     which is exactly why it was overlooked for so long, and why it turned out to be
//     the cheapest cool chroma in the arena. See `SHADOW_TINT`.
//
// The entries below are still re-keyed even where they are currently overridden, so
// that the day an override is removed the palette already holds the right answer —
// but do not expect a screen change from them, and do not spend a round arguing
// about `cabinet` or `butcherBlock`: they reach the screen at zero pixels.
//
// ── The authored -> rendered transfer, measured, so nobody pre-compensates ────
// `stage.ts`'s `ToyGradeEffect` no longer destroys channels (see PROGRESS.md), so
// AUTHOR THE COLOUR YOU WANT. Measured across this palette: rendered HSV saturation
// lands about +0.10 to +0.15 above authored, rendered luma about x1.0-1.09 of
// authored on up-facing surfaces and lower on angled/dark ones, and hue arrives
// within ~4 degrees. So to land a surface at rendered sat 0.35, author ~0.22.
// One live trap remains: authored channels at or below ~8/255 still round to 0 and
// the surface loses its hue. `steel` (#184F6E, red 24) was arriving with red at 4,
// and `freezerBody` (#1F9FD1, red 31) with red at 3 — both are lifted below.
//
// ── WHAT THIS PALETTE CANNOT FIX, AND WHAT FIXING IT IS WORTH ─────────────────
// Measured, not argued: `tools/tmp/simfix.mjs` overrides materials in the live page
// (matched by name AND authored hex, so a `tinted()` clone is hit and its palette
// parent is not) and re-runs `arena-scan`'s own salience analysis. So "what would
// the other owners' change buy?" is a number rather than a request. On a frozen
// snapshot of the tree, 18 player-centred stations, with this palette in place:
//
//   palette at HEAD                     playerRank median 49.5 | player-vs-surround
//                                       saturation positive at 6/18, mean -0.050
//   this contract                       49.5 -> 41            | 6/18 -> 7/18, -0.016
//   + counters.ts caps in band          41   -> 39.5 (mean 37.3 -> 31.1)
//                                                             | 7/18 -> **10/18, +0.022**
//   + storage.ts freezer roof in band   39.5 -> 35.5 (mean 29.8)
//
// That prediction was acted on and it landed: `props/counters.ts` took `stoveCap` from
// #CE8C2E (rgb(243,146,11), HSV 0.95, 7.2% of frame) to the cool #6F8CAE it carries
// today, and `prepCap` from #C9AD7B at luma 193 down into band. **DO NOT re-derive
// those two — they are done, and the hexes quoted in older notes no longer exist.**
// ═════════════════════════════════════════════════════════════════════════════

// ═════════════════════════════════════════════════════════════════════════════
// ROUND 11 — THE HUE CONTRACT, AND THE MEASUREMENT THAT SETTLED THE WARM RAIL
// ═════════════════════════════════════════════════════════════════════════════
//
// The contract above is right and is now finished rather than re-argued. What this
// round adds is the number every previous round was missing: WHERE the reference's
// saturation actually lives, measured per plate rather than as one pooled average.
//
//   plate   meanSat   warm    cool    warm/total
//   bs_01    0.541    0.018   0.521     0.034     <- the plate this floor is keyed to
//   bs_02    0.447    0.025   0.422     0.055
//   bs_03    0.708    0.610   0.095     0.865     <- OUTLIER, and it moves the mean
//   bs_04    0.377    0.082   0.294     0.218
//   ...      median   0.097   0.348
//
// **The recorded reference warm chroma of 0.145 is an artefact of ONE plate.** The
// plate MEDIAN is 0.097, and the two cool-ground plates that scored 8/10 in this
// project's own review rounds run 0.018 and 0.025 — a QUARTER of ours (0.064). Every
// plate's saturation comes from its COOL half: cool chroma median 0.348 against our
// 0.252, and meanSat 0.493 against our 0.324, which is below all eleven plates.
//
// So the answer to "the frame is under-chromatic but must not become warm-heavy" is
// not a compromise, it is a measurement: **spend the entire deficit on the cool half
// and hold warm flat.** This round does exactly that, and it does not desaturate one
// surface (LESSONS §8 — do not become the fourth critic to prescribe that).
//
// ── Where the reference actually keeps its chroma, sampled off bs_01 ──────────
//   mauve paver ground   37.4% of frame   rgb(153,84,108)  hue 339  HSV 0.45  luma 104
//   teal bush mass                        rgb( 19,133,162) hue 192  HSV 0.88  luma 111
//   VIOLET BARREL (blocking)              rgb(104, 91,224) hue 246  HSV 0.59  luma 103
//   pale crate  (blocking)                rgb(161,152,227) hue 247  HSV 0.33  luma 159
//
// Ours, measured the same way (`tools/tmp/matcover.mjs`, 6 stations):
//   tile field  26.2% of frame  rgb(123,86,105)  hue 330  HSV 0.30  luma 93
//   coverBody    5.2%           rgb( 44,31, 42)  hue 309  HSV 0.30  luma 35
//   coverSkirt   2.2%           rgb( 33,25, 36)  hue 284  HSV 0.31  luma 27
//   plinthPanel  1.8%           rgb( 33,21, 46)  hue 269  HSV 0.54  luma 25
//
// **Our blocking props render at luma 27-35 where the reference's render at 103-159.**
// That is the blind critic's finding word for word — *"the only thing selling them as
// blocking volume is the near-black skirt, which is a darker value than anything in a
// shipped brawler environment"* — and it is also most of the missing cool chroma,
// because a near-black surface cannot carry any.
//
// ── The three hue families, and they are now disjoint ────────────────────────
//   WALKABLE   the tile field (rose-mauve, 330-340) and every mat/pad (teal-blue,
//              198-206). Saturated, mid-value, never dark.
//   BLOCKING   every CoverBox body, skirt and plinth: VIOLET, 258-268, saturated,
//              in a three-step value ramp under a bright cap. Nothing else is violet.
//   CAST       0-60 deg, left to the characters, the hazards and the VFX.
// The blocking-vs-walkable cue therefore has its HUE half back (STATE.md item 9,
// DECISIONS-FOR-URI §5): 71 deg between the ground's rose and the cover's violet, on
// top of the value ramp. Both were previously in the plum family and value alone
// carried it, which two independent sources called a defect.
//
// ═════════════════════════════════════════════════════════════════════════════
// THE TRADE-OFF CURVE, MEASURED — READ THIS BEFORE ADDING WARM CHROMA BACK
// ═════════════════════════════════════════════════════════════════════════════
//
// This round was steered by two of `arena-scan`'s rails at once and they pull in
// opposite directions, so it was landed by walking the curve rather than by picking a
// number. Five full 18-station runs, same tree, same stations:
//
//   variant   frame warm   envInCastBand   playerRank(med)   top cells in cast hue
//   BEFORE      0.0642        0.1906            33.5                37%
//   a           0.0502        0.0914            21.5                15%
//   b           0.0670        0.1341            26.5                26%
//   c           0.0752        0.1519            27.0                30%
//   d           0.0664        0.1353            24.0                30%
//   e           0.0594        0.1200            22.5                17%
//   SHIPPED     0.0599        0.1244            23.0                24%
//
// `e -> SHIPPED` is not on the warm curve at all: it is the tile field taken back 8%
// in VALUE at unchanged hue and chroma, because `tools/tmp/floorprobe.mjs` — the
// floor's own gameplay acceptance test — failed at `pantry_ne` (R 1.053, PASS is
// R < 1.0) once the ground rose to luma 106 and started sharing the cast's value band.
// It cost 0.004 of the collision metric and bought R 0.713 -> 0.536 with all five
// stations passing and vanish% 14.4 -> 4.6. **Run that probe after ANY floor change;
// the colour scanner cannot see this failure mode at all.**
//
// **Every unit of warm chroma added to the ENVIRONMENT costs hierarchy, monotonically.**
// That is not a tuning artefact, it is arithmetic: whole-frame warm chroma is
// env-warm + cast-warm + HUD-warm, the cast is 0.49% of frame and contributes 0.0031,
// so the only way to raise warm chroma is to put it in the environment — and every warm
// pixel in the environment is inside the cast's own +/-30 deg band by construction.
//
// The one lever that is NOT on this curve is LUMA. `d -> SHIPPED` is the same warm
// surfaces at 75-78% value: it cost 0.007 of warm chroma and bought 13 points of
// top-cell collision, because a warm surface only competes with the cast when it shares
// the cast's VALUE as well as its hue. Spend warm chroma DARK; never at luma ~150.
//
// TWO RAILS IN `arena-scan` CONTRADICT EACH OTHER, and that is why two of them are red
// on an otherwise all-green pass. On the shipped frame:
//     envShareInCastBand = 0.1200   target 0        (env chroma in the cast's bins)
//     envWarmShare       = 0.1179   target 0.297    (env chroma at hue < 60)
// They differ only by the 60-90 deg bin, which this arena measures at 0.00 — **they are
// the same quantity with opposite targets.** No arena can satisfy both, and the pair
// floors `envShareInCastBand` at ~0.16 whatever the art does. Flagged for Uri; do NOT
// try to clear it by warming the environment.
// ═════════════════════════════════════════════════════════════════════════════

export const KPAL = {
  // ── Floor family ────────────────────────────────────────────────────────────
  // These four now MATCH `floor.ts`'s overrides rather than contradicting them (the
  // floor still clones and overrides `tileLight`/`tileDark`/`subfloor`, so the day
  // that override is retired the palette already holds the right answer — see the
  // note above `tileLightInst` in that file).
  //
  // Rose-mauve, and DELIBERATELY not rotated. `bs_01`'s ground is hue 339 at HSV 0.45
  // and this element's own review rounds scored that plate 8/10 twice; the defect was
  // never the hue, it was that ours arrived at HSV 0.30 — 26% of every frame carrying
  // a third less chroma than the single surface it was copied from. Priced with
  // `tools/tmp/caphex.mjs` before it was written, then corrected once against the
  // rendered PNG: #9D657B measured HSV 0.52 at shipped framing and read as bubblegum
  // rather than fired clay, so it came down one step. #966779 lands on the plate.
  //
  // ── ROUND 12: THE CHROMA COMES DOWN. THE HUE AND THE VALUE DO NOT. ─────────
  // Uri: *"desaturate the pink floor significantly; it's currently high-saturation and
  // occupies most of the frame, which is backwards. The floor is a stage, not an
  // attraction."* These two are **26.2% of every frame** (the share table above), which
  // is what makes his argument a HIERARCHY argument rather than the "fix it by
  // desaturating" move `CLAUDE.md` has falsified four times — those four were about
  // repairing a defect by pulling chroma; this is about what the largest surface in the
  // game is allowed to spend. The paragraph above still holds on the point it was making
  // (the HUE was never wrong, and it has not moved: 337.7 -> 337.9 deg); what it got
  // wrong is that it priced this surface against the plate and never against the cast
  // standing on it. HSV 0.312 -> 0.158 at luma 105.3 -> 105.6.
  // ⚠️ These two are still OVERRIDDEN in `floor.ts` and reach the screen at zero pixels
  // from here. They are re-keyed anyway, for the reason this block already gives: the
  // day the override is retired the palette must already hold the right answer.
  //
  // ── ROUND 14: 0.158 WAS TOO FAR, AND THE PLATES ARE WHAT SAY SO ────────────
  // Round 12's argument stands and its old wording is kept above; what it lacked was a
  // measurement of the reference's OWN ground. `tools/tmp/v1_sat.mjs` over the six
  // curated `gameplay_topdown` plates: their largest colour mass covers 34.5-71.6% of the
  // frame at **HSV S 0.440-0.791**, and their whole-frame median S is 0.467-0.731. Ours
  // was 47.4% at S 0.298, median 0.328 — **below all six on both**. The mass number is
  // the load-bearing one: a high median alone cannot distinguish "one big saturated
  // surface" from "many small saturated objects on a quiet ground", and those two
  // prescribe opposite changes. Every plate is the first kind.
  // HSV 0.158 -> 0.267 at UNCHANGED max channel (120 / 113) and hue within 0.7 deg. That
  // is still 15% under the 0.312 Uri was looking at, and it is the smallest move that
  // clears the plate floor rather than the middle of the band.
  // ⚠️ Raising S at a fixed HSV VALUE necessarily lowers LUMA (105.6 -> 95.7, -9.3%),
  // because HSV value is the max channel. Reported, not hidden — and it is the direction
  // the plates sit in: their dominant masses are at V 0.372-0.958, median ~0.50, against
  // ours at 0.715.
  tileLight: '#785864',
  tileDark: '#71535F',
  // The joint seen through the grout gaps. Holds the ~1.7:1 albedo ratio to the tile
  // that four contradictory critics were finally split down the middle on (see the
  // `subfloorDark` note in `floor.ts`) — the ratio is unchanged, only the chroma moves.
  // Round 12: follows the tile by the same 1/1.7 luma construction `floor.ts` uses for
  // its `subfloorDark` override — the ratio is what four critics argued about and it is
  // unchanged; only the chroma moves, with the tile it belongs to. Also overridden
  // downstream, also re-keyed for the same reason.
  // Round 14: same construction, new input. #785864 x 0.5917 = (71, 52, 59); authored
  // luma ratio 95.7 / 56.5 = 1.693 against round 12's 1.707. Was '#473B3F'.
  subfloor: '#47343B',
  border: '#4A2F3C',

  // The pantry plank pad. This was the arena's single worst blocking-vs-walkable
  // confusion and all three cover-prop critics named it: measured, it rendered
  // rgb(233,152,52) — hue 33 deg, sat 0.78, luma 162 — against `counters.ts`'s stove
  // cap at rgb(242,146,12), hue 35 deg. **A walkable floor pad and the top of a
  // bullet-stopping counter were within two degrees of hue at similar value.** It is
  // now a quiet weathered-timber taupe: same wood family, but well below the caps in
  // both chroma and value, so "bright and saturated" means blocking and "quiet"
  // means you can run across it.
  // Round 2 took it further, and the reason is worth recording: at #8B7A69 it still
  // rendered at hue 32 deg against the stove cap's 35 deg. **The hue gap was still
  // three degrees** — the precise number two independent critics measured and named,
  // just at lower chroma. Warm timber cannot be rotated out of the 25-40 deg band
  // without ceasing to look like timber, so the escape is the other axis: drop its
  // saturation far enough that hue stops carrying information at all (rendered ~0.28
  // against the cap's 0.95). A near-neutral warm grey plank pad reads as floor from
  // any distance; a saturated warm one reads as a counter top lying down.
  //
  // ── Round 11: it stopped being timber, and the reason is a number ────────────
  // The escape-by-saturation above worked and still lost, because the metric that
  // matters is not this surface's own chroma, it is how much of the frame sits in the
  // cast's hue band. Measured: these pads are **6.0% of every frame** — the single
  // largest surface the arena spends inside 0-90 deg after the hazard itself — arriving
  // rgb(120,104,88), hue 30, at the same luma (106) as the tile they lie on and 8 deg
  // from the player's own bun. Two of the six worst hue-collision stations in the arena
  // are the two pantry corners, and this is what is in them (`pantry_ne` 0.260,
  // `pantry_sw` 0.267 of env chroma inside the cast band).
  //
  // Three rounds tried to make warm timber quiet enough. It cannot be: at any chroma
  // that still reads as timber it is still the cast's hue, and quieting it only trades
  // the collision for the "muddy" verdict. So it stops being timber. It is now painted
  // service decking — the cool blue-grey every commercial kitchen actually has under a
  // pantry rack — which puts it in the WALKABLE family with the mats instead of in the
  // cast's. Priced first: arrives rgb(64,107,132), hue 202, HSV 0.52, **luma 100**, so
  // it keeps the one property that was right (a pad at the tile's own value, which is
  // what puts a character back at maximum contrast against his ground) and swaps the
  // one that was wrong.
  woodPad: '#577182',
  woodSeam: '#405663',
  flour: '#E8C98A',

  // Pushed more saturated than the original muted tan — see the round-5 saturation
  // note on `buildMaterials`: cabinets are some of the biggest cover surfaces in
  // the arena, so their chroma does real work for the overall scene average.
  //
  // Round-8 NOTE, recorded so nobody re-derives it: a critic measured 5.94% of the
  // frame at R >= 253 against 0.27% in the reference plate, and these two were named
  // as the cause ("~15% too hot in red"). They are not. Cutting both by 15% moved
  // whole-frame red clipping from 4.50% to 4.47% — three hundredths of a point, i.e.
  // nothing — so the change was reverted rather than kept as an unmotivated look
  // shift on the arena's biggest warm surfaces. Rendering the clipped pixels as a
  // MASK instead of trusting the aggregate showed where the red actually flatlines:
  // `rimLight` trim (see below) and the pot's broth disc. Cutting `rimLight` alone
  // took the same frame from 4.50% to 3.02% (lower-right quadrant 2.05% -> 0.85%).
  // A percentage over a whole frame says how much is clipped, never what is doing
  // it; the mask is one command and settles it.
  // DEAD ENTRIES, kept in band deliberately. `props/counters.ts` clones all three
  // through `tinted()` and overrides the colour (see `stoveCap` / `coverBody` /
  // `prepCap` there — that file is the only place their live hexes exist, and quoting
  // them here has gone stale twice), so these reach the screen at ZERO pixels and no
  // change here is visible. They are re-keyed anyway so the palette is coherent if
  // those overrides are ever retired — and recorded as dead so no future round
  // spends itself arguing about them, which has now happened twice.
  // Round 13: re-keyed to the new `stoveCap` family for the reason this block already
  // states — still ZERO pixels, still not worth a round of argument.
  cabinet: '#94C5FF',
  // BLOCKING's body colour. `props/counters.ts` clones this through `tinted()` for
  // every CoverBox side (`coverBody`), which is 5.2% of every frame — so the value
  // here is dead but the one it is overridden with is the second-biggest prop surface
  // in the arena. Kept in the same violet family so the two files agree.
  cabinetDark: '#6B5A7A',
  // Round 13: likewise re-keyed to the new `prepCap`. ZERO pixels.
  butcherBlock: '#EDC277',
  // Blue-teal steel — this surface sits front-and-centre on every stove/service top,
  // so its hue is one of the levers pulling the hub out of the orange/tan band. Kept
  // DARK for the exposure reason it always was: a flat glossy top this size, viewed
  // almost head-on under this rig's key+hemisphere lighting, adds enough
  // specular+clearcoat energy on top of the albedo to blow past 1.0 — only a
  // genuinely dark base keeps its hue once that highlight lands.
  //
  // Saturation contract: measured, #184F6E arrived on screen at rgb(4,44,71), HSV
  // sat 0.94 with its RED CHANNEL AT 4 — i.e. below the ~8/255 floor where a channel
  // rounds to zero and the surface stops holding its own hue. Lifted off that floor
  // and pulled well down in chroma; still unmistakably the arena's cold steel.
  //
  // ── Round 13: still dark, but no longer in the near-black class ──────────────
  // These are the freezer's VERTICAL walls, so they do not belong in the highlight
  // band the caps just moved into — but measured they were rendering luma 56 / 66 with
  // the RED CHANNEL AT 5 and 16, i.e. the very channel-floor failure the paragraph
  // above was written to fix, still live. `bs_01`'s darkest BLOCKING surface renders at
  // 103; there is no near-black anywhere in either reference plate.
  // `caphex` at 430:240 (delivered hexes — authored is these to the 1/0.72 power):
  //   steel      #286F99 luma 56 sat 0.96 R=5  ->  #3086B8 luma 75 sat 0.96 R=6
  //   steelDark  #225C7E luma 66 sat 0.87 R=16 ->  #296F9E luma 84 sat 0.90 R=16
  // Rendered saturation holds or rises in both (deep blues have no room to desaturate
  // — red is already near zero), authored HSV S rises 0.736/0.729 -> 0.740, and the
  // walls stay 90+ luma below the roof above them, which is what makes the freezer read
  // as a solid rather than as a lit slab on legs.
  steel: '#2A75A2',
  steelDark: '#225F83',

  // Same story as `steel`, worse: #1F9FD1 rendered rgb(3,111,155) — HSV sat 0.98,
  // red channel at 3. A walk-in freezer is a large static structure and under the
  // contract it does not get to be one of the most saturated objects on screen.
  // Still the arena's cyan landmark, now inside the band and off the channel floor.
  // Round 13: up the value axis with the rest of the freezer, saturation held exactly
  // (authored HSV S 0.744 -> 0.740). `caphex` 430:240: delivered #3396C6 luma 101 sat
  // 0.95 -> #42C1FF luma 131 sat 0.92. It is the door and the frost band, i.e. the
  // freezer's identity chroma, and it has to stay clear of the walls that now sit at 75.
  freezerBody: '#42C1FF',
  freezerDoor: '#37738F',
  freezerTrim: '#2B2B2B',
  // Cold light spilling off the freezer onto the floor in front of its door.
  // RESERVED CHROMA — this is emitted light, not a surface. Left alone.
  freezerGlow: '#8FE3FF',

  // Round 13: `crate_lid` and `pot_crate_lid` are both `addCoverCap` faces, so this is a
  // prop TOP and belongs in the highlight band with the others. Saturation held EXACTLY
  // (HSV S 0.773, unchanged); value only, 0.553 -> 0.759, absolute chroma 0.427 -> 0.587.
  // ⚠️ This one is EXTRAPOLATED, not measured: `caphex`'s ID-buffer mask for this
  // material was contaminated at all four stations tried (its "current" row read back as
  // the utility mat's blue), so unlike every other constant in this round it has no
  // before/after row of its own. It was verified only in the composited after-frame.
  crateWood: '#C2842C',
  // BLOCKING's skirt band — `props/counters.ts` overrides this to `coverSkirt`, the
  // middle rung of the three-step ramp. Same violet family as `cabinetDark`.
  crateSlat: '#4A4058',
  // The arena's DELIBERATE warm note: the reference plates' warm chroma is 0.097
  // (median), not zero, and the sacks are where that budget is spent now that the
  // plank pads, the counter rim trim and the brass pot stack have left the cast's band.
  //
  // ── The correction that only the RENDERED FRAME caught ──────────────────────
  // A first pass opened these up to #C29233 and the numbers all improved. The PNG did
  // not: the sacks came out a bright orange mass at luma 149 — **the hamburger's own
  // hue AND his own luma, at several times his area**, sitting right behind him at
  // `pantry_sw`. That is the exact defect this whole round exists to remove, arrived
  // at from the opposite direction, and no aggregate in the scanner reports it because
  // in aggregate it reads as "more warm chroma", which is what the warm rail asks for.
  //
  // The fix is that CHROMA and LUMA are separable and only one of them was the problem.
  // #926E26 is #C29233 scaled to 75% value: HSL saturation 0.584 -> 0.587, i.e. the
  // warm chroma budget is untouched to three decimal places, while luma drops 149 -> 112
  // and the sacks stop occupying the player's own value band. **Warm chroma is cheap;
  // warm chroma AT THE CAST'S LUMA is what costs the hierarchy.** Every warm surface in
  // this palette is now keyed that way.
  burlap: '#926E26',
  burlapDark: '#7A551A',

  // Cool counterpoint crate — herbs/greens, not another warm produce box. Reads as
  // "cold storage / fresh herbs" against the warm hub. #0E8560 rendered at HSV sat
  // 0.96 with red at 6 (below the channel floor again); this is the same idea at
  // sage strength rather than signal-green.
  herbCrateWood: '#2A8462',
  herbCrateSlat: '#215947',
  herbLeafA: '#45A972',
  herbLeafB: '#309079',
  potteryWarm: '#8C4C22',

  // Decorative tile band ringing the hub — a cool zone the eye can land on before it
  // reaches the warm scorch/hazard ring at the centre. `floor.ts` overrides both
  // (#5E7F85 / #48646A); these now MATCH that override rather than contradicting it,
  // so the two files finally agree on what colour the hub mats are.
  tealTile: '#2E8E9C',
  tealTileDark: '#226E7C',

  // The hazard pot's drum. Measured, `#888D95` arrived rgb(111,120,128) — **HSL
  // saturation 0.071, below the scanner's own 0.15 grey gate**, i.e. 1.6% of every
  // frame contributing literally zero chroma in either direction. "Cold grey steel" is
  // the right read and it does not require being achromatic; this is the same steel
  // with a blue in it, which is the cheapest cool chroma in the palette.
  //
  // ── Round 13: this is not only the pot — it is the SERVICE COUNTER'S CAP ─────
  // `props/counters.ts:758` passes `M.potMetal` straight into `addCoverCap` for
  // `service_top`, so this constant is one of the three big prop TOP faces, and the
  // grep that says "the hazard pot's drum" is incomplete. It was rendering luma 148
  // against reference prop tops at 190-216.
  // `caphex` at 430:240 (delivered): #7E9EB5 luma 148 sat 0.49 -> #9BC9EB luma ~193
  // sat ~0.43, measured either side at #98BED9 (182 / 0.44) and #A8DBFF (201 / 0.42).
  // Authored HSV S RISES 0.304 -> 0.340 and absolute chroma 0.188 -> 0.303; the
  // rendered saturation dip is the cool key running out of blue, not white being added.
  potMetal: '#96C3E3',
  potMetalDark: '#3E5A73',
  flame: '#FFB238',
  flameCore: '#FFE9A8',

  // ── Puddle bodies ───────────────────────────────────────────────────────────
  // Measured at shipped framing, these two discs were the loudest objects in the
  // arena — each ~19% of the frame width, so "loudest" is not a small area effect:
  //   water  rendered (97,203,251), HSV val **0.984** against a frame mean of 0.562
  //          — effectively clipped white-cyan, the single brightest thing on screen;
  //   grease rendered (210,152,23), HSV sat **0.897** against a frame mean of 0.603
  //          — the single most saturated thing on screen.
  // That is what made them read as MOBA pickup/heal pads instead of spills, and no
  // amount of edge treatment fixes a body that bright. Both are pulled down here to
  // land near the frame's own sat/val band while keeping their hue, so each still
  // reads instantly as water or grease and still separates from the warm tile
  // beneath it (rendered ≈ (160,107,76), sat 0.53, val 0.63) — a slow hazard still
  // has to be legible, it just must not out-shout the characters fighting on it.
  //
  // Both are authored BELOW the intended on-screen values: this rig's lighting plus
  // `stage.ts`'s grade add roughly +0.15 saturation and +0.13 value between the
  // authored albedo and the pixel.
  // Round 11: the grease pool keeps its value and gains chroma (HSL 0.33 -> 0.60 at an
  // unchanged luma of ~132). It is one of the two places the arena is ALLOWED to be
  // warm — the contract reserves 0-60 deg for the cast, the HAZARDS and the VFX — and
  // a slow-hazard reading unmistakably as hot oil is a gameplay win, not a hierarchy
  // cost, because its salience is a floor decal's, not a highlight's. This is where
  // the warm chroma that leaves the rim trim, the plank pads and the brass pots is
  // re-spent, which is what keeps the whole-frame warm rail flat instead of dropping.
  water: '#3F86A8',
  waterCap: PALETTE.waterCap,
  grease: '#B0802C',

  // Warm gold used ONLY as a thin light-catching cap/rim trim along the top edge of
  // counters and backsplashes — the "chamfer that catches a different light angle"
  // cue. Never used as a body colour, so it stays legible as an edge accent.
  //
  // Round-8: pulled down from `#F6DFA0`. This trim runs along the top edge of every
  // counter, backsplash and `addTopRim` frame in the arena, which is a lot of pixels
  // for something this bright, and at R=246 it did not survive the rig's ~1.25x
  // lighting multiply — it arrived with its red channel flatlined. A clipped
  // highlight is not a brighter highlight: once one channel pins and the others keep
  // moving, the trim stops holding its own hue and slides toward white, which is
  // exactly the opposite of "a chamfer catching a warm light". Measured by clip mask
  // as the single biggest source of red clipping in the arena (see the note on
  // `cabinet` above): whole-frame R >= 253 went 4.50% -> 3.02% from this one value.
  //
  // Saturation contract: #D8BE84 STILL rendered rgb(247,216,113) — HSV value 0.97,
  // luma 215, the single brightest surface in the arena, at 1.45% of the frame.
  // Because it is drawn as thin strips along the edge of a near-black plum plinth it
  // costs far more than 1.45% of the eye: the salience grid weights LOCAL CONTRAST
  // at 0.5, and a luma-215 line against a luma-25 wall inside one 100x100px cell
  // pins that term at its ceiling. Those cells are precisely the ones that outranked
  // the player at 15 of 18 stations. Down ~30 luma — still the brightest trim in the
  // arena and still gold, no longer the brightest thing on screen.
  //
  // Round 2: further, because the first cut under-delivered and the reason is
  // instructive. #BFAA85 is authored at luma 172 and arrived at 202 — a x1.17
  // multiply, not the x1.08 the rest of the palette shows. `rimLight` is a
  // `glossyMat`, i.e. a MeshPhysicalMaterial carrying a fixed clearcoat 0.6 that
  // this module cannot turn off, so a thin strip catching the key head-on gets its
  // albedo PLUS a clearcoat lobe. Roughness is the only handle (0.28 -> 0.38 -> 0.46
  // below) and it has to be spent alongside the albedo, not instead of it.
  //
  // Round 3, measured again: #B3A07C STILL arrived at luma 193 (x1.21 on an authored
  // 159) — tied with the brightest surface in the arena. Taken to an authored luma of
  // ~142, which lands it near 170. With the floor now re-keyed to luma ~89 that is
  // still a 80-point step against the plum backsplash it edges, i.e. unambiguously a
  // lit chamfer, without being the loudest pixel on screen.
  //
  // ── Round 11: the value was never the problem. THE HUE WAS. ─────────────────
  // A blind critic scoring the arena 6/10 against a reference at 8.5 named three
  // elements as the whole of its top fix, and this is the second of them, described
  // without any access to this file: *"the tan-yellow strip running along the front of
  // both counters."* The scanner independently agreed — the two loudest non-player
  // cells at `fryer_south` measure rgb(198,160,100) and rgb(188,155,99), hue 36-38,
  // which is THIS material to within rounding (rgb(199,168,95), hue 42, luma 169), and
  // it wears the player's own hue.
  //
  // Three rounds of value cuts could not fix that, because a chamfer highlight has to
  // be bright — it is the "edge catching a different light angle" cue the whole
  // counter rebuild is built on, and the same critic's SECOND fix asks for MORE of it
  // (*"a chamfered top edge carrying a bright rim"*). So the brightness stays and the
  // hue goes: this is now the cool steel edge a stainless counter actually has.
  // Priced: arrives rgb(126,162,190), hue 206, luma 156 — 13 luma quieter than the
  // gold it replaces, still 78 clear of the violet backsplash it edges, and it moves
  // 1.3% of frame out of the cast's band and into the cool half rather than to grey.
  rimLight: '#78899A',

  // ── Round-5 visual-grammar accents ──────────────────────────────────────────
  // A critic scored this arena 4/10 for having "one visual grammar applied
  // uniformly" to blocking cover, the pot hazard, and flat floor decoration — no
  // object carried a material/outline/shadow language reserved for its own
  // category. The colours below exist ONLY to carry one of these three languages
  // and are never reused across categories.

  // BLOCKING — every single CoverBox's kick/base/backsplash band (stove islands,
  // prep + service counters, freezer, crates, barrels) is repainted this one
  // near-black plum, and ONLY cover ever uses it. A player should be able to tell
  // "this collides" from the colour alone, anywhere in the arena, before reading
  // shape at all.
  //
  // ── Round 11: it is no longer NEAR-BLACK, and that was a measured defect ─────
  // The blind critic: *"The only thing selling them as blocking volume is the
  // near-black skirt, which is a darker value than anything in a shipped brawler
  // environment."* Checked against the shipped environment rather than argued:
  // `bs_01`'s violet blocking barrels render at luma **103** and its blocking crates
  // at **159**; ours rendered at **25**. There is no near-black anywhere in either
  // reference plate.
  //
  // Two separate costs, both measured. (1) A luma-25 band under a luma-169 trim pins
  // the salience grid's local-contrast term at its ceiling inside one cell, and those
  // are exactly the cells that outranked the player at 15 of 18 stations. (2) A
  // near-black surface cannot carry chroma at all, so 3.6% of the frame was
  // contributing nothing to a frame measured as under-chromatic overall.
  //
  // Lifted to a violet that is still unambiguously the darkest band on any prop
  // (arrives luma 39 against a floor at 108 and a cap at 143) and now genuinely
  // saturated — HSL 0.53. It is also the anchor of the three-step ramp the same critic
  // asked for; see `props/counters.ts`, where the whole ladder is set out.
  coverPlinth: '#2E2440',
  // Round-7: the backsplash WALL specifically (see `coverPlinthPanel` in
  // `buildMaterials`) needs a touch more headroom than the reserved trim colour
  // above — a texture `map` is multiplicative against the base colour, and
  // `coverPlinth` is dark enough that even a strong texture has almost no absolute
  // range left to show. A little lighter, still unmistakably the same violet family,
  // so the panel-seam texture actually reads.
  coverPlinthPanel: '#4A3660',

  // HAZARD — replaces the old pale-gold "crisp ring" that sat almost exactly the
  // tile's own hue+value (the critic's literal complaint: "faint warm glow,
  // low-contrast against near-white tile"). A hard-edged black/amber caution-tape
  // ring traced exactly on the real damage boundary, plus a hotter, more saturated
  // glow underneath it.
  hazardStripeBright: '#FFB300',
  hazardStripeDark: '#241207',
  hazardGlowHot: '#FF5A1E',

  // ── Puddle edges — NOT hazard markings any more ─────────────────────────────
  // These used to be `#D6FF3A` (neon lime, s0.77/v1.00) and `#2FE8FF` (electric
  // cyan, s0.82/v1.00): the "hard bright edge" HAZARD grammar borrowed from the
  // pot's caution ring, on the theory that a puddle had to shout that it slows you.
  //
  // That theory was retired — a puddle now only has to look like a puddle, and the
  // "you are slowed" signal lives on the CHARACTER (`game/vfx.ts`). The rework that
  // deleted the rest of that layer (glow halo, accent tint, warning icons) could not
  // delete THIS one, because the colours live here in `shared.ts` and that pass only
  // owned `hazards.ts` — so the single loudest element of the layer outlived the
  // change written to remove it. Measured at shipped framing, the two puddles were
  // 19% of the frame width, 3.8x a character's width, and the most saturated objects
  // on screen: a saturated gold disc ringed in neon lime and a cyan disc ringed in
  // neon cyan, which is the exact visual language of a MOBA pickup or heal pad.
  //
  // What they are now is a WET EDGE: the darker, thicker meniscus a real spill leaves
  // where the liquid piles against the floor. Same hue family as the pool it edges
  // (so grease still reads as grease and water as water), but well down in value and
  // saturation, so the boundary comes from a VALUE step against the tile rather than
  // from chroma. Nothing in the arena reads these as a warning any more. Note these
  // are authored below the intended on-screen chroma on purpose: `stage.ts`'s grade
  // pushes saturation UP, so an "already muted" colour still arrives with life in it.
  greaseRim: '#8A6A22',
  waterRim: '#4A8AA6',

  // New mid-lane cover (see the four `supply_barrel`s below) — round-7 RECOLOUR:
  // a critic mistook this prop for an explosive hazard and marked the arena down
  // for not telegraphing it. It never was one — it's plain cover, like the crates —
  // but the critic's mistake is itself the real bug: red means "danger" everywhere
  // else in this arena (the hazard ring, its glow, its caution stripes all live in
  // the amber/red band — see `hazardStripeBright`/`hazardGlowHot` below), so a red
  // COVER prop was actively lying about what it does. Every other cover prop reads
  // as safe-to-approach; this is the one place the arena accidentally spoke the
  // hazard language for something you're supposed to hide behind. Recoloured to a
  // saturated navy — the real-world "supply/water drum" convention (blue plastic
  // barrels read as cargo almost universally, the same way red/orange reads as
  // explosive) — and distinct in both hue and value from every other blue already
  // in the palette: much darker/more desaturated than the freezer's bright sky-cyan
  // (`freezerBody`) and the hub's vivid `tealTile`, and bluer (less teal, less
  // violet) than `steel`/`spiceCartBody`. Still bold enough to read as its own
  // landmark, never implying "this explodes."
  // Saturation contract: pulled toward a working steel-drum blue-grey. The navy
  // "supply cargo, not explosive" semantic above is the whole point of the colour
  // and survives intact — it is still the only navy on the map, still distinct from
  // the freezer's cyan and the cart's violet — it just no longer competes with the
  // characters for chroma.
  // Round 13: value only, saturation held EXACTLY (HSV S 0.664), V 0.549 -> 0.708.
  // ⚠️ Also EXTRAPOLATED rather than measured — no station in the `caphex` set had a
  // barrel on screen with a clean mask. It is a small curved cover prop, so it is here
  // for family coherence with `steel`/`freezerBody` rather than for highlight area.
  barrelBody: '#3D7BB5',
  barrelBodyDark: '#1E4160',

  // ── Round-6 fix: spice-cart body ─────────────────────────────────────────────
  // The cart's body used to share `tealTileDark` with the floor's own decorative
  // "hub zone" mat directly beneath it — the exact bug the round-6 critic flagged
  // ("cannot tell whether these are raised blocking terrain... or pure floor
  // decals"): a blocking CoverBox and a walkable floor decal painted the identical
  // colour. A violet nowhere else in KPAL keeps the cart's "cool counterpoint to the
  // warm hub" role while making it unmistakably its OWN thing, never confusable with
  // the mat it sits on.
  // Saturation contract: #6C4FA6 rendered rgb(115,72,217), HSV sat 0.67 / value 0.85
  // — a neon violet on a piece of static cover. Muted to a dusty aubergine and taken
  // DOWN in value (rendered luma ~92 vs the hub mat beneath it at ~117), which keeps
  // the round-6 fix working — the cart still cannot be confused with the mat it
  // stands on, now by value and hue rather than by shouting.
  spiceCartBody: '#564A88',
  spiceCartBodyDark: '#3C3269',

  // ── Round-6 fix: loose ground debris (mistaken for gameplay pickups) ─────────
  // `buildHubDebris`/`buildDebrisPile` used to include a bright-red "tomato" sphere
  // in their rotation. Small, red, scattered loose on the floor around the hazard
  // ring, it read exactly like a collectible pickup and sat far too close in hue to
  // the hazard's own amber/red caution grammar. Blueberry-violet keeps the "loose
  // veg" variety without ever using red for anything that isn't the hazard itself.
  debrisBerry: '#5A5C86',

  // Cool utility rubber mat under the two walk-in freezers — round-6 "vary the four
  // corner mats" fix: only the two PANTRY corners had a distinguishing floor pad
  // (the warm wood `woodPad`); the two FREEZER corners sat on bare checkerboard tile.
  // A cool grey mat (never used anywhere else) gives all four corners their own
  // floor treatment instead of two matching and two bare.
  //
  // Saturation contract — THE BIGGEST SINGLE SURFACE THIS FILE ACTUALLY OWNS, at
  // 6.1% of the frame. #95A6AC rendered rgb(147,184,191): luma 177 against a frame
  // median of ~114, i.e. the brightest large area in the arena, on a WALKABLE floor
  // pad. Two costs, both measured: the salience grid's value-deviation term rewarded
  // it directly, and its hard bright edge against the terracotta tile spiked the
  // local-contrast term in every cell it touched. `freezer_nw` / `pantry_sw` /
  // `freezer_se` were three of the four worst playerRank stations in the arena.
  // Now a near-neutral rubber grey sitting close to the tile in value: still
  // obviously a different, cooler material (hue ~200 deg against the floor's ~21),
  // still gives the freezer corners their own floor treatment, no longer the
  // brightest thing a player sees.
  // Round 2 took both big floor pads DOWN to the tile's own value (rendered ~112
  // against the tile's 110-118) rather than merely below their old highlight. That
  // is a second, separate effect the scanner made visible: the player STANDS on
  // these pads, and his cell's salience is driven by his own contrast against
  // whatever he is standing on. A pad at luma 129 sat close to the character's own
  // mid-value mass and measurably REDUCED his separation — `freezer_nw` went 58 to
  // 69 and `pantry_ne` 31 to 44 on the first pass for exactly this reason. Pads that
  // sit at floor value put the character back at maximum contrast against his
  // ground, and a walkable surface reading as floor is what it should have been
  // doing anyway.
  //
  // ── Round 11: the level was right and the chroma was not ────────────────────
  // Everything above about VALUE stands and is untouched — these pads still sit at the
  // tile's own luma, for the measured reason recorded above. What moves is chroma:
  // #5A6E78 is HSL 0.14, and after `floor.ts`'s `keyServiceMat` it arrived at HSL 0.28
  // over **8.4% of the frame** — the arena's single biggest cool ground, spending less
  // than a third of the chroma the reference's equivalent mass carries (`bs_01`'s bush
  // field: HSL 0.79). Cool chroma is the half of the wheel this arena is short on and
  // the half it is allowed to spend freely, and this is the largest surface that can
  // spend it without touching a value relationship anything depends on.
  utilityMat: '#4B7186',
  utilityMatDark: '#375868',

  // ── CONCEALMENT — the one prop family that BLOCKS NOTHING AND HIDES YOU ──────
  //
  // Uri, `DECISIONS §29b`: *"it's supposed to be plates and other kitchen objects you
  // can hide under — fully hidden. Bushes don't make sense in a kitchen."* So this is a
  // service table's linen with plates and trays stacked on it, not foliage.
  //
  // ⚠️ **THE HUE IS CONSTRAINED FROM THREE SIDES, AND TWO OF THEM ARE ALREADY SPENT.**
  //   * It may not read as a HAZARD. The arena's hazard grammar is a hard saturated rim
  //     in a reserved hue — `hazardStripeBright` #FFB300, `hazardGlowHot` #FF5A1E,
  //     `greaseRim` #8A6A22, `waterRim` #4A8AA6 — so saturated amber and saturated teal
  //     are both taken, and a player must never confuse "hide here" with "burn here".
  //   * It may not read as BLOCKING. Blocking is the near-black plum `coverPlinth`
  //     #2E2440 plus the arena's heaviest ink line (0.016). Concealment carries NO
  //     outline at all, deliberately — that is the whole legibility cue for walk-through.
  //   * It may not spend the budget the frame has none of. Measured 2026-08-06: warm
  //     chroma FAILS LOW (0.053 against a 0.072 minimum) while cool sits at 0.427 against
  //     a 0.343 target. So this family is warm, and it is deliberately the LOW-CHROMA
  //     warm — a high-value linen — because the mat is a large ground surface and a
  //     saturated one would land in hazard territory by sheer intensity.
  //
  // The rim IS traced on the region's exact bound, borrowing the hazard grammar's one
  // good idea (`buildPuddleVisual`: "a hard, opaque rim traced exactly on its real
  // radius") without borrowing its hue: a player has to know exactly where concealment
  // starts, because standing 5 wu outside it is the difference between hidden and shot.
  concealCloth: '#E9DCC0',
  /** Traced on the region's true edge. Tan, not amber — well clear of `greaseRim`. */
  concealClothRim: '#C29A5E',
  /** Stacked plates. The brightest thing in the family, so the cluster reads at 58°. */
  concealPlate: '#F7F1E4',
  /** The band around a plate stack and the trays — the family's warm chroma. */
  concealTrayWarm: '#C9552F',
} as const;

// ─────────────────────────────────────────────────────────────────────────────
// Shared materials — created once per arena instance, reused across every prop
// that shares a surface type. Kept in a factory function so nothing leaks between
// repeated `createKitchenArena()` calls (e.g. hot-reload during preview iteration).
// ─────────────────────────────────────────────────────────────────────────────

export function buildMaterials() {
  // ── Round-7 texture kit ──────────────────────────────────────────────────────
  // The recurring, round-over-round critic complaint has been the SAME finding every
  // time: "flat, single-value fills per surface with almost no internal gradient —
  // painted blockout, not finished material." Every reference frame gets most of its
  // material read from texture almost for free (mowed-grass stripes, brick coursing,
  // tile wear); this arena had exactly one place doing that (the hazard stripe/scorch
  // decals) and a solid colour everywhere else. These canvas textures (see
  // `./textures.ts` for the generators and the shared design rules) are assigned as
  // `map` below on every major surface family so the fix is broad, not another single
  // spot-fix. Built once per arena instance, same lifetime as everything else here.
  const tileWearA = makeTileWearTexture(4001);
  const tileWearB = makeTileWearTexture(4029);
  const woodGrainWarm = makeWoodGrainTexture(4111);
  const butcherBlockTex = makeButcherBlockTexture(4177);
  const brushedSteel = makeBrushedMetalTexture(4211);
  const brushedFreezer = makeBrushedMetalTexture(4237);
  const plankWarm = makePlankTexture(4271, 4);
  const plankHerb = makePlankTexture(4293, 3);
  const burlapTex = makeBurlapTexture(4321);
  const barrelTex = makeBarrelTexture(4357);
  const panelSeamTex = makePanelSeamTexture(4391);
  // Round-7 second pass — a few more surfaces that turned out to still be flat
  // single-value fills once the first batch above was actually visible on screen
  // (see the freezer lid: a SEPARATE material from `freezerBody`, missed entirely
  // by the first pass despite being the single biggest flat panel in the arena at
  // default gameplay framing). Own texture instances (not reused ones) so each can
  // carry its own `repeat` without fighting another surface's tuning.
  const rugWeave = makeBurlapTexture(4451);
  const cartMetal = makeBrushedMetalTexture(4487);
  const utilityMatTex = makeTileWearTexture(4519);
  const potMetalTex = makeBrushedMetalTexture(4547);

  // Floor tiles: applied at repeat (1,1) — each tile box's own UV already spans
  // 0..1 across its top face (see `buildFloor`), so the generator's one "tile's
  // worth" of wear IS the whole face, not a pattern meant to repeat within it.
  // Two different seeds (A for the light tile, B for the dark) so alternating
  // checkerboard squares don't show the identical mottling.
  tileWearA.repeat.set(1, 1);
  tileWearB.repeat.set(1, 1);
  // Wood pad is shared between the big pantry floor pads (~14x13m) and the small
  // rolling-pin prop — a single moderate repeat is the best compromise across both.
  woodGrainWarm.repeat.set(3, 3);
  butcherBlockTex.repeat.set(3, 1);
  brushedSteel.repeat.set(1, 1);
  // Own texture instance (not shared with `steel`/`steelDark`) so this can carry a
  // wider repeat suited to the freezer's much bigger flat faces without changing the
  // stove/service tops' streak scale.
  brushedFreezer.repeat.set(3, 2);
  burlapTex.repeat.set(2, 2);
  // Hub rugs are long thin rectangles (150x80wu / 80x150wu) — an elongated repeat
  // keeps the weave cells roughly square instead of stretched.
  rugWeave.repeat.set(3, 5);
  cartMetal.repeat.set(2, 2);
  // This pad is enormous (420x340wu, ~21x17m) and `makeTileWearTexture`'s features
  // (one border ring, a handful of sparse blotches/scuffs) are discrete, not a
  // continuous pattern — at a low repeat, most of any given camera framing could
  // land entirely inside one cell's flat interior and show nothing. A denser repeat
  // guarantees a border line (at minimum) crosses through frame from any angle.
  utilityMatTex.repeat.set(6, 5);
  potMetalTex.repeat.set(1, 1);

  const mats = {
    // Roughness spread across the floor/cabinet/crate surfaces is deliberate: identical
    // mid-roughness everywhere is what makes a scene read as shadeless plastic even
    // under working lights, because nothing catches a distinct specular highlight.
    tileLight: toonMat({ color: KPAL.tileLight, ramp: RAMP_SOFT(), roughness: 0.55, map: tileWearA }),
    tileDark: toonMat({ color: KPAL.tileDark, ramp: RAMP_SOFT(), roughness: 0.55, map: tileWearB }),
    subfloor: toonMat({ color: KPAL.subfloor, ramp: RAMP_SOFT(), roughness: 0.92 }),
    border: toonMat({ color: KPAL.border, ramp: RAMP_SOFT(), roughness: 0.7 }),
    woodPad: toonMat({ color: KPAL.woodPad, ramp: RAMP_SOFT(), roughness: 0.68, map: woodGrainWarm }),
    woodSeam: toonMat({ color: KPAL.woodSeam, ramp: RAMP_SOFT(), roughness: 0.75 }),
    // Unlit on purpose: a lit near-white toonMat disc this pale caught the same
    // key+fill overexposure as the counter tops and rendered as a hard white lump
    // instead of a soft dusting. flatMat can't blow out — it ignores scene lighting
    // entirely, so the low opacity below is the only thing controlling how it reads.
    // Saturation contract: opacity 0.45 -> 0.36. Unlit and pale, this composited at
    // luma 174 over the tile — a floor MARKING brighter than most of the props
    // standing on it. Thinner dusting, same read.
    flour: flatMat(KPAL.flour, { transparent: true, opacity: 0.26 }),
    // Generic worn-floor marks — dark grime near the fryer, a cool wet sheen near the
    // sink. Small, cheap, and exactly the kind of graphic-not-fine floor wear the
    // reference frames are full of and this arena was missing.
    // Neutralised from '#3E2A18'. Same trick, same reason as `SHADOW_TINT`: this is
    // an alpha-blended overlay covering 2.3% of the frame, all of it on `floor.ts`'s
    // terracotta tile, and a WARM overlay on a warm floor darkens without ever
    // reducing the hue-band concentration that is the arena's #1 measured colour
    // problem. Near-neutral, so it still reads as grime and quietly takes chroma out
    // of the one surface this module cannot recolour.
    floorGrime: flatMat('#2F2A26', { transparent: true, opacity: 0.22 }),
    floorWet: flatMat('#3E90BE', { transparent: true, opacity: 0.2 }),

    cabinet: toonMat({ color: KPAL.cabinet, roughness: 0.62, map: woodGrainWarm }),
    cabinetDark: toonMat({ color: KPAL.cabinetDark, roughness: 0.65, map: woodGrainWarm }),
    butcherBlock: toonMat({ color: KPAL.butcherBlock, roughness: 0.5, map: butcherBlockTex }),
    // `steel`/`steelDark` also get the brushed texture as a `roughnessMap`, not just
    // `map` — the same streak pattern darkening the diffuse read also breaks up the
    // specular highlight into fine bands instead of one smooth glossy patch, which is
    // what an actual brushed-metal counter top does under a key light.
    // Roughness up across the glossy family (steel 0.32->0.42, steelDark 0.36->0.46,
    // freezerBody 0.40->0.50, barrelBody 0.40->0.50, potMetal 0.22->0.30, rimLight
    // 0.28->0.38). `glossyMat` is a MeshPhysicalMaterial with a fixed clearcoat 0.6
    // that this module cannot change, so roughness is the only handle on how hot the
    // specular lobe gets. A tight lobe on a large flat top-down surface is a small
    // blown-out patch, and a blown-out patch is a maximum-local-contrast event in the
    // exact place the salience grid is looking. Still glossy — these read as metal
    // and plastic, just without the clipped hotspot.
    steel: glossyMat({ color: KPAL.steel, roughness: 0.42 }),
    steelDark: glossyMat({ color: KPAL.steelDark, roughness: 0.46 }),

    freezerBody: glossyMat({ color: KPAL.freezerBody, roughness: 0.5 }),
    freezerDoor: toonMat({ color: KPAL.freezerDoor, roughness: 0.45, map: brushedFreezer }),
    freezerTrim: toonMat({ color: KPAL.freezerTrim, roughness: 0.5 }),
    // Frosty lid cap, noticeably lighter/cooler than the body — from the steep
    // top-down camera the freezer's flat top is almost the whole silhouette, so this
    // two-tone break (plus the bright rim trim ringing it) is what keeps its huge top
    // face reading as a lid catching light rather than a single flat coloured slab.
    // Round-7: this is the SINGLE biggest flat-fill surface in the whole arena at the
    // default gameplay framing (a freezer corner fills a huge fraction of the frame,
    // top-down) and was missed by the first texture pass entirely — it's its own
    // material, not `freezerBody`, so `brushedFreezer` had to be wired here too.
    // Saturation contract: #7FD6EE -> #93BCC9. Still the frosty two-tone break that
    // keeps a freezer's huge flat top from reading as one slab, ~20 luma quieter.
    freezerLid: toonMat({ color: '#79B4CA', roughness: 0.38, map: brushedFreezer }),
    // Cold ground light spilling out in front of each freezer door — unlit so it
    // reads as emitted light rather than a painted floor patch.
    freezerGlow: flatMat(KPAL.freezerGlow, { transparent: true, opacity: 0.28 }),

    crateWood: toonMat({ color: KPAL.crateWood, roughness: 0.72, map: plankWarm }),
    crateSlat: toonMat({ color: KPAL.crateSlat, roughness: 0.78, map: plankWarm }),
    burlap: toonMat({ color: KPAL.burlap, roughness: 0.85, map: burlapTex }),
    burlapDark: toonMat({ color: KPAL.burlapDark, roughness: 0.88, map: burlapTex }),

    herbCrateWood: toonMat({ color: KPAL.herbCrateWood, roughness: 0.7, map: plankHerb }),
    herbCrateSlat: toonMat({ color: KPAL.herbCrateSlat, roughness: 0.78, map: plankHerb }),
    herbLeafA: toonMat({ color: KPAL.herbLeafA, roughness: 0.58 }),
    herbLeafB: toonMat({ color: KPAL.herbLeafB, roughness: 0.6 }),
    potteryWarm: toonMat({ color: KPAL.potteryWarm, roughness: 0.65 }),

    // Round-7: these long rug-like floor patches under the hub chokepoint props were
    // a completely flat colour fill in the first review pass — a woven-mat texture
    // (reusing the burlap generator; hue comes entirely from the material colour)
    // gives them a fabric read instead of a painted rectangle.
    tealTile: toonMat({ color: KPAL.tealTile, ramp: RAMP_SOFT(), roughness: 0.5, map: rugWeave }),
    tealTileDark: toonMat({ color: KPAL.tealTileDark, ramp: RAMP_SOFT(), roughness: 0.55, map: rugWeave }),

    potMetal: glossyMat({ color: KPAL.potMetal, roughness: 0.3 }),
    potMetalDark: toonMat({ color: KPAL.potMetalDark, roughness: 0.4, map: potMetalTex }),
    broth: glossyMat({ color: PALETTE.broth, roughness: 0.22, emissive: '#3a1a05', emissiveIntensity: 0.12 }),
    // ⚠️ BOTH OF THESE DELIVERED ZERO PIXELS AT EVERY STATION PROBED, ABLATED.
    // `tools/tmp/gl_occl_ab.mjs` forces a material to #FF00FF at opacity 1 and requires
    // the frame to MOVE before believing any measurement of it. At `pot_south` (1400:1200)
    // and `pot_diagonal` (1140:940) — the two `arena-scan` stations that exist to put the
    // ⚠️ WAS (700:640) and (570:430) — EXACTLY HALF of each, i.e. the 1x map's NW-quadrant
    // fossils, which `6631446` retired. `al_guard` cannot see this class here because it
    // scans CODE and these are prose; and "is this a legal point?" cannot see it either,
    // since the 1x playfield is exactly the NW quadrant so every stale coordinate stays
    // legal. Read the live values off `tools/arena-scan.mjs`'s STATIONS table, never here.
    // pot in frame — `kpal:flame` and `kpal:flameCore` moved the frame by **0 px**,
    // twice each, while `pot_steam` moved it by 2,394-4,332 px in the same captures. The
    // burner sits UNDER the pot body and at 58 degrees the body covers it, so this is
    // `docs/LESSONS.md` §1 shape: geometry that renders, is animated every frame by
    // `createAmbientUpdate` (flicker on `pot.flame.scale`), and reaches the screen never.
    // ROUTED, not fixed: the geometry and its placement are `src/arena/hazards.ts`, and
    // it is not established that the flame is MEANT to be visible from the match camera.
    flame: flatMat(KPAL.flame, { transparent: true, opacity: 0.92 }),
    flameCore: flatMat(KPAL.flameCore, { transparent: true, opacity: 0.95 }),

    water: glossyMat({ color: KPAL.water, roughness: 0.3, transparent: true, opacity: 0.82 }),
    waterCap: toonMat({ color: KPAL.waterCap, roughness: 0.4 }),
    grease: glossyMat({ color: KPAL.grease, roughness: 0.32, transparent: true, opacity: 0.85 }),

    tomato: glossyMat({ color: PALETTE.tomato, roughness: 0.28 }),
    lettuce: toonMat({ color: PALETTE.lettuce, roughness: 0.6 }),
    onion: toonMat({ color: PALETTE.onion, roughness: 0.6 }),
    ink: flatMat(PALETTE.ink),

    // ── THE SILENT-OCCLUDER CLASS, MEASURED RATHER THAN FIXED ON SIGHT ──────────
    //
    // `render/toon.ts`'s `flatMat` has no `depthWrite` option and three's default is
    // `true`, so BOTH materials below are `transparent: true` while still writing depth
    // — the authoring mistake in `docs/LESSONS.md` §1's corollary, and the one that cost
    // the fighter's contact shadow inside both puddles (`e47ba7c`). `hc_occluders`
    // prints `kpal:dust` for exactly this and deliberately does not gate on it.
    //
    // 🚨 DO NOT "FIX" `dust` BY CLEARING THE FLAG. It was probed, and clearing the flag
    // alone makes the render WORSE, not better. `tools/tmp/gl_occl_ab.mjs` — one page
    // load, `requestAnimationFrame` frozen, per-block self-pair 0 px and per-block drift
    // floor 0 px, 9 loads across `grease_in` / `pot_south` / `pot_diagonal`, worst case
    // with 12 VFX decals spawned on the floor:
    //
    //   what the depth write actually buries        6 .. 12 px of 1,440,000  (<= 0.0008%)
    //   ...as summed channel delta                  82 .. 126
    //   the whole field, ablated to magenta         6 .. 65 px               (one load: 0)
    //
    // ⚠️ Compare distances from `c`, the arm that is correct w.r.t. the ground stack —
    // and compare SUMMED DELTA, not pixel counts, because counting alone conflates a
    // 183-level change with a 3-level one and reads this as a tie:
    //
    //   shipped vs correct       30 / 13 / 31       <- 3.4x to 5.4x CLOSER
    //   flag-only vs correct    111 / 70 / 105
    //
    // The field is 40 motes at y 0.26 .. 2.13 — NOT the y -0.025 .. 0.025 `hc_occluders`
    // reports, which is one mote's geometry box at the origin (an `InstancedMesh` keeps
    // its instances in an attribute the bounding box never sees; that tool says so). So
    // the motes are ABOVE the whole ground stack, not buried under it, and along the
    // camera ray a mote is genuinely IN FRONT of the ground decal it rejects.
    //
    // That is why the flag alone is not the fix. The motes carry `renderOrder 0`, so
    // they are drawn FIRST in the transparent pass; stop them writing depth and they are
    // simply PAINTED OVER by every ground decal drawn after them. Rendered and looked at
    // (`shots/gl/dust6/load5/triptych_bot.png` — the same three arms, cropped on the load
    // where a mote happened to land over a VFX decal; the field is unseeded, so that
    // placement can be waited for but not requested): shipped shows the mote,
    // `depthWrite:false` alone ERASES it, and `depthWrite:false` PLUS a renderOrder above
    // the ground stack shows it again.
    //
    // ⚠️ ROUTED, NOT DONE: the complete fix is both halves, and `renderOrder` lives on
    // the mesh in `src/arena/ambient.ts` (`buildDustField`), which is not this file set.
    // It is worth <= 12 px, so it is not urgent — but half of it is a regression.
    //
    // `chalk` is in the same class and is CLEAN on the measurement: ablation-positive
    // (121-158 px of chalkboard line delivered, so the instrument can see it) and its
    // depth write buries 0 px at every station tried. Latent, left alone.
    //
    // ⚠️ AND THE ONE THAT IS NOT LATENT IS NOT IN THIS FILE. The same sweep found
    // `hazard:wisp` (`src/arena/hazards.ts`, 7 materials) burying up to **1,146 px at
    // meanD 71-89, maxD 183** at the pot's hazard ring — 100x the dust, "clearing the
    // flag is closer to correct" on every wisp at every station, and plainly visible in
    // `shots/gl/occl_pot2/load0/triptych_wisp5.png`: shipped draws the heat wisp as a
    // dull blue-grey SLAB that deletes the ring's flame crown behind it. `hc_occluders`
    // does not flag it because its predicate requires a FLAT box (h <= 0.50) and a wisp
    // cone spans 1.0-2.0 m. Routed, not this file set.
    chalk: flatMat('#F4EFE2', { transparent: true, opacity: 0.85 }),
    dust: flatMat('#FFF6DC', { transparent: true, opacity: 0.5 }),

    // Thin glossy cap trim along backsplash/counter top edges — the one bright,
    // slightly specular accent used purely as an edge highlight (see `addBacksplash`).
    rimLight: glossyMat({ color: KPAL.rimLight, roughness: 0.46 }),

    // ── Round-5 visual-grammar materials ────────────────────────────────────────
    // BLOCKING's one reserved material. Unlit (flatMat) rather than lit, so it
    // reads as the same near-black plum from every angle and under every light
    // change — a lit dark colour this size still picks up enough key-light lift to
    // drift toward the same mid-brown/mid-slate every OTHER dark trim already used
    // (cabinetDark, freezerTrim, crateSlat...), which is exactly the "no reserved
    // material" problem being fixed here.
    coverPlinth: flatMat(KPAL.coverPlinth),

    // Round-7: the vertical backsplash WALL (see `addBacksplash`) is one of the
    // biggest single flat-colour surfaces on every stove/prep/service counter — at
    // gameplay pitch it's the whole visible "riser" face — so it gets its own
    // textured variant instead of sharing bare `coverPlinth`. Same near-black plum
    // (still unambiguously the reserved BLOCKING hue), plus horizontal tile-coursing
    // seam lines. `coverPlinth` itself stays untouched/flat: it's reused on tiny trim
    // (kicks, feet, bungs) where a patterned texture would be barely visible and
    // isn't worth diluting the "one flat reserved colour = blocking" instant-read cue.
    coverPlinthPanel: flatMat(KPAL.coverPlinthPanel),

    // Puddle wet-edge materials — see the KPAL note. Still unlit: the edge of a
    // spill wants to hold one steady value rather than pick up a key-light gradient
    // across a 5m disc, and unlit is also what keeps it from washing out on the lit
    // side the way an earlier lit ring did.
    greaseRim: flatMat(KPAL.greaseRim),
    waterRim: flatMat(KPAL.waterRim),

    // New mid-lane cover body — glossy like the pot's metal. Round-7: recoloured
    // from red to navy (see the KPAL note on `barrelBody`) after a critic mistook it
    // for an explosive hazard; the drum texture below (banding + a neutral shipping
    // chevron, see `makeBarrelTexture`) reinforces "supply cargo," not "danger."
    barrelBody: glossyMat({ color: KPAL.barrelBody, roughness: 0.5 }),
    barrelBodyDark: toonMat({ color: KPAL.barrelBodyDark, roughness: 0.55, map: barrelTex }),

    // Round-6 fixes — see the KPAL notes on `spiceCartBody` / `debrisBerry`. Round-7:
    // both the cart body and the utility mats were still flat single-value fills —
    // a metal-panel texture on the cart (it's a wheeled trolley), a subtle worn-mat
    // texture (reusing the tile-wear generator) on the rubber utility pads.
    spiceCartBody: toonMat({ color: KPAL.spiceCartBody, roughness: 0.5, map: cartMetal }),
    spiceCartBodyDark: toonMat({ color: KPAL.spiceCartBodyDark, roughness: 0.6, map: cartMetal }),
    debrisBerry: toonMat({ color: KPAL.debrisBerry, roughness: 0.55 }),
    utilityMat: toonMat({ color: KPAL.utilityMat, ramp: RAMP_SOFT(), roughness: 0.65, map: utilityMatTex }),
    utilityMatDark: toonMat({ color: KPAL.utilityMatDark, ramp: RAMP_SOFT(), roughness: 0.68, map: utilityMatTex }),

    // ── Concealment. See the KPAL block for why the hue is what it is. ─────────
    // The cloth borrows `utilityMatTex` rather than growing a twelfth canvas: it is the
    // same kind of surface (a large flat ground mat whose job is to not be a flat fill)
    // and reusing the instance costs nothing. `concealPlate` is glossier than anything
    // else on the floor on purpose — a plate stack has to catch a highlight to read as
    // crockery rather than as another pale decal.
    concealCloth: toonMat({ color: KPAL.concealCloth, ramp: RAMP_SOFT(), roughness: 0.72, map: utilityMatTex }),
    concealClothRim: flatMat(KPAL.concealClothRim),
    concealPlate: toonMat({ color: KPAL.concealPlate, roughness: 0.28 }),
    concealTrayWarm: toonMat({ color: KPAL.concealTrayWarm, roughness: 0.5 }),

    // Fake ambient occlusion — a soft dark radial decal dropped under ROUND props
    // (the pot) so they read as sitting ON the floor with real contact darkening,
    // rather than pasted on top of it.
    // ⚠️ `vertexColors` is on for every decal material below, and every mesh that uses
    // one is built by `buildContactShadow`/`buildContactRing`, which ALWAYS write a
    // 4-component `color` attribute. Both halves of that are load-bearing: a material
    // with `vertexColors` on a geometry with no `color` attribute gets a shader
    // declaring an attribute that does not exist, which is `docs/LESSONS.md` §12's
    // "renders the whole floor solid black" trap. Do not hand these materials to a
    // mesh built any other way.
    contactShadow: new THREE.MeshBasicMaterial({
      map: makeContactShadowTexture(),
      transparent: true,
      depthWrite: false,
      vertexColors: true,
      opacity: 0.9,
    }),
    // ── ROUND 12: NO TEXTURE AT ALL — the falloff is now GEOMETRY ──────────────
    //
    // Every CoverBox's automatic footprint shadow (see `addCover`) used to be a blurred
    // rounded-rect CanvasTexture stretched over a plane sized 1.22x (small props) or
    // 1.34x (large) the footprint. A texture's feather is a fixed FRACTION of its own
    // canvas, so the world width of the falloff scaled with the prop: on a 2.5 m barrel
    // it was ~0.2 m and on an 8.5 m stove island ~1.4 m. That is the wrong dependency —
    // a contact shadow's width is set by the light's elevation and the object's height,
    // not by how long the object is — and it is why `tools/tmp/aoband.mjs` measures the
    // baked layer still putting dL 0.0132 at 0.60-1.20 m from a footprint, which is a
    // haze rather than contact. It is also unfixable with a shared texture: satisfying
    // "full alpha at the footprint edge" and "zero at a fixed distance outside it"
    // simultaneously forces the plane to be one specific multiple of the footprint.
    //
    // `buildContactRing` builds the rounded rect analytically instead — one inner
    // contour on the footprint at full alpha, one outer contour `CONTACT_OVERHANG_M`
    // outside it at zero — so the band is an absolute width on every prop, the corners
    // are hugged by construction, and the DIRECTIONAL term (see `shadowRampAlpha`)
    // rides on the same vertex-alpha channel. No canvas, no map, one draw call each,
    // exactly as before.
    groundedShadow: new THREE.MeshBasicMaterial({
      color: SHADOW_TINT_HEX,
      transparent: true,
      depthWrite: false,
      vertexColors: true,
      opacity: 1,
    }),
  };

  // ── Post-creation texture wiring ─────────────────────────────────────────────
  // `glossyMat`/`flatMat` (unlike `toonMat`) don't take a `map` option, but every
  // material they return is a real `THREE.Material` — mutating `.map` directly here
  // is exactly as valid as passing it through a constructor option, and doing it in
  // one place keeps `buildMaterials` itself the single source of truth for which
  // surface gets which texture.
  mats.steel.map = brushedSteel;
  mats.steel.roughnessMap = brushedSteel;
  mats.steel.needsUpdate = true;
  mats.steelDark.map = brushedSteel;
  mats.steelDark.roughnessMap = brushedSteel;
  mats.steelDark.needsUpdate = true;
  mats.freezerBody.map = brushedFreezer;
  mats.freezerBody.roughnessMap = brushedFreezer;
  mats.freezerBody.needsUpdate = true;
  mats.barrelBody.map = barrelTex;
  mats.barrelBody.needsUpdate = true;
  mats.coverPlinthPanel.map = panelSeamTex;
  mats.coverPlinthPanel.needsUpdate = true;
  mats.potMetal.map = potMetalTex;
  mats.potMetal.roughnessMap = potMetalTex;
  mats.potMetal.needsUpdate = true;

  // ── Name every material after its palette key ────────────────────────────────
  // Purely diagnostic, and it costs one string per material. It exists because
  // "which palette entry owns this many pixels of the frame?" was, until it was
  // added, unanswerable without guessing: an ID-buffer pass can label each material
  // by its `THREE.Material.name` and attribute screen coverage to a `KPAL` key
  // exactly. `THREE.Material.name` has no effect on rendering.
  //
  // The measurement this unlocked immediately overturned an assumption: `cabinet`
  // and `butcherBlock` — the two entries every previous colour round spent itself
  // arguing about — reach the screen at effectively ZERO pixels, because
  // `props/counters.ts` clones both through `tinted()` and overrides the colour
  // (`prepCap`, `stoveCap`). Same for `tileLight`/`tileDark`/`subfloor`/`tealTile`,
  // all overridden inside `floor.ts`. Clones keep the name, so a probe that reports
  // name AND rendered hex shows the override rather than silently crediting the
  // palette for a colour it no longer controls.
  //
  // ── Its one known blind spot, found round 11 ────────────────────────────────
  // Materials built OUTSIDE this factory get no name, and `matcover` keys its rows on
  // name+hex — so every `MeshBasicMaterial({ map, transparent })` in `hazards.ts` and
  // `fogRing.ts` collapses into ONE row reading `(unnamed) #FFFFFF`, which measured
  // **7.5% of frame at hue 20 deg**: the third-largest surface in the game, sitting
  // inside the cast's own hue band, with nothing in the report naming it. It is
  // actually the grease pool, the water pool, the pot's scorch apron, its caution ring
  // and the fog, averaged together. `tools/tmp/whomat.mjs` was built to break that row
  // apart (it walks the scene and prints mesh names per material); the hazard
  // materials are now named at their construction site so the next run does not need
  // it.
  for (const [key, m] of Object.entries(mats)) (m as THREE.Material).name = `kpal:${key}`;

  return mats;
}

export type Materials = ReturnType<typeof buildMaterials>;

// ─────────────────────────────────────────────────────────────────────────────
// Small geometry helpers
// ─────────────────────────────────────────────────────────────────────────────

/** Cheap cylinder, rounded-looking enough at this scale without the roundedBox cost. */
export function puck(radius: number, height: number, segments = 20): THREE.CylinderGeometry {
  return new THREE.CylinderGeometry(radius, radius, height, segments);
}

export function mesh(geo: THREE.BufferGeometry, mat: THREE.Material, name: string): THREE.Mesh {
  const m = new THREE.Mesh(geo, mat);
  m.name = name;
  m.castShadow = true;
  m.receiveShadow = true;
  return m;
}

export function noOutline<T extends THREE.Object3D>(o: T): T {
  o.userData.noOutline = true;
  return o;
}

// ─────────────────────────────────────────────────────────────────────────────
// THE ARENA VALUE LIFT
//
// ── The defect, measured ─────────────────────────────────────────────────────
// `tools/arena-scan.mjs` rails mean saturation, warm chroma, cool chroma, hue
// overlap and clipping against the curated reference plates. It has never railed
// BRIGHTNESS. Its own `--ref-plates` pass prints the plates' luma column and then
// drops it. So the one axis nothing was watching is the one the arena drifted on,
// and `docs/LESSONS.md` §7 is explicit about what happens next: every pass measures
// itself, every pass is right, nobody watches the sum.
//
// Measured 2026-08-05 with `tools/tmp/arena_ladder.mjs` (whole-frame luma
// percentiles, methodology identical to `colourBudget()`, and validated first
// against `arena-scan --ref-plates`'s own numbers to 4 dp):
//
//                       arena, 18 stations     6 top-down Brawl Stars plates
//     p05 (darks)              0.114                    0.253
//     p25                      0.231                    0.356
//     p50                      0.311                    0.426
//     p75                      0.381                    0.522
//     p95 (lights)             0.580                    0.789
//     mean                     0.322                    0.453   (11-plate mean 0.509)
//
// EVERY rung is low and the ladder is only 0.07 narrower — so this is a SHIFT, not a
// compression. Not one of the eighteen stations reaches the mean of the darkest plate
// in the library, and eight of them sit below that plate entirely. An independent
// blind critic scored the arena 4/10 against those plates at 7.5-8.0 in the same
// hour, and its own number-one written note was "the tile albedo is a dark, greyed
// magenta sitting at roughly the same value as the props — it needs to become the
// lightest large surface in frame".
//
// How the arena got there is visible in this file's own history: `burlap` scaled to
// 75% value, `steel` "kept DARK", `freezerBody` "pulled down", both puddle bodies
// "pulled down", `woodPad` re-keyed to luma 100. Six independently-correct passes,
// each fixing a real hierarchy problem, each measuring only itself.
//
// ── Why a uniform channel SCALE, and not a per-hex rewrite ───────────────────
// Every value in `KPAL` carries a documented reason, and almost all of those reasons
// are RELATIVE ("below the caps in both chroma and value", "at the tile's own value",
// "the darkest thing in the arena"). Rewriting hexes one at a time would relitigate
// every one of those decisions and silently break some. Scaling all three channels of
// every arena albedo by one factor preserves all of them by construction, and makes
// two properties provable rather than hoped for:
//
//   - HUE is exactly unchanged — the channel ratios are unchanged.
//   - SATURATION cannot fall. `colourBudget()` measures HSL saturation,
//     `s = d/(mx+mn)` below l=0.5 and `d/(510-mx-mn)` above it. Scaling by k takes
//     both d and (mx+mn) to k times themselves, so s is EXACTLY invariant below
//     l=0.5, and strictly increases once a colour crosses above it. Measured over the
//     sweep: meanSat 0.4236 -> 0.4708, mean chroma 0.2890 -> 0.3542. That matters
//     because "fix it by desaturating" has now been falsified four times on this
//     project; this lift is incapable of doing it.
//
// The exponent is a gamma on the colour's own value, so dark things move least in
// absolute terms and the ladder's shape survives:
//
//     V  = max(r, g, b) in sRGB          V' = V^GAMMA          rgb *= V'/V
//
// ── Why 0.72 ────────────────────────────────────────────────────────────────
// Swept live on a frozen snapshot before a line of this was written
// (`tools/tmp/valuelift_price.mjs`, 4 stations, gamma 1 as the control):
//
//     gamma   mean    p05    p50    p95   meanSat  chroma   clipHi
//     1.00    0.346  0.126  0.336  0.579   0.4236  0.2890    0.40%   <- control
//     0.85    0.391  0.141  0.392  0.620   0.4389  0.3234    0.42%
//     0.72    0.435  0.158  0.453  0.657   0.4708  0.3542    0.43%
//     0.60    0.481  0.180  0.513  0.693   0.5178  0.3814    0.45%
//     0.50    0.520  0.198  0.563  0.722   0.5782  0.4008    0.53%
//     target  0.453  0.253  0.426  0.789   0.4925  0.3250
//
// 0.72 lands the mean and the median on the plates and keeps mean chroma inside the
// band; 0.60 overshoots the mean and pushes chroma to 0.381 against a 0.325 target;
// 0.85 leaves the arena below four of the six plates. Rendered and looked at at each
// step (`CLAUDE.md` non-negotiable 3): at 0.60 the floor reads as bubblegum plastic,
// at 0.72 as the fired-clay rose the palette was keyed to in the first place.
//
// ── What this deliberately does NOT touch ────────────────────────────────────
//  - The fog ring and curtain. They are built outside this root (`fog_boundary`), and
//    a lethal veil is supposed to be the darkest thing on screen. The sweep above was
//    measured with them excluded, so the numbers transfer exactly.
//  - Every contact-shadow and grounding decal, for free rather than by exception:
//    they are authored `#FFFFFF`, so V = 1 and the scale factor is 1^(GAMMA-1) = 1.
//    They keep their absolute darkening strength while the surface under them gets
//    brighter, so prop grounding gains contrast instead of losing it — which is the
//    same critic's number-one complaint ("props cast no shadow at all"), and that
//    complaint was measurably FALSE: `tools/tmp/arena_shadow_ab.mjs` ablated the
//    arena's shadow casting and found prop shadows covering 5.4-11.3% of the frame
//    at mean |dL| 0.10-0.12, five to nine times the character's own 1.05-1.20%. The
//    shadows were always there. They had nothing bright to be dark against.
// ─────────────────────────────────────────────────────────────────────────────

/**
 * Exponent applied to every arena albedo's value. 1 = no lift. See the block above
 * for the sweep this came from and for why the transform is a uniform channel scale.
 */
export const ARENA_VALUE_GAMMA = 0.72;

/**
 * Lift every material under `root` up the value axis, once each.
 *
 * Called from `kitchen.ts` on the assembled arena root, which is deliberately the
 * same set the sweep measured: one walk, one `seen` set, so a material shared by
 * several builders is lifted exactly once and a second call is a no-op.
 */
export function liftArenaValue(root: THREE.Object3D, gamma = ARENA_VALUE_GAMMA): number {
  if (gamma === 1) return 0;
  const seen = new Set<string>();
  const rgb = { r: 0, g: 0, b: 0 };
  let lifted = 0;
  root.traverse((o) => {
    const anyMesh = o as THREE.Mesh;
    if (!anyMesh.isMesh && !(o as THREE.Points).isPoints && !(o as THREE.Sprite).isSprite) return;
    const mats = Array.isArray(anyMesh.material) ? anyMesh.material : [anyMesh.material];
    for (const m of mats) {
      const mat = m as THREE.Material & { color?: THREE.Color };
      if (!mat || !mat.color || seen.has(mat.uuid)) continue;
      seen.add(mat.uuid);
      mat.color.getRGB(rgb, THREE.SRGBColorSpace);
      const v = Math.max(rgb.r, rgb.g, rgb.b);
      // Pure black has no value to lift and no ratios to preserve; leaving it alone
      // also keeps ink outlines and the `#2B2B2B` trims from crawling toward grey.
      if (v <= 0.02) continue;
      const k = Math.pow(v, gamma) / v;
      mat.color.setRGB(
        Math.min(1, rgb.r * k),
        Math.min(1, rgb.g * k),
        Math.min(1, rgb.b * k),
        THREE.SRGBColorSpace
      );
      lifted++;
    }
  });
  return lifted;
}

// ─────────────────────────────────────────────────────────────────────────────
// Fake contact AO — a soft dark radial-gradient decal, canvas-generated once and
// shared by every prop's footprint. This is the single cheapest lever for killing
// the "pasted onto the floor" look: real-time contact shadows are expensive, but a
// baked dark ellipse under each prop reads as grounding at gameplay camera distance.
// ─────────────────────────────────────────────────────────────────────────────

/**
 * The tint every baked grounding decal blends toward — COOL-neutral, not warm-black.
 *
 * These three decal materials together cover 9.7% of the frame (measured with
 * `tools/tmp/matcover.mjs`), all of it lying on `floor.ts`'s terracotta tile — the
 * single biggest hue-band offender in the game, at hue ~21 degrees and HSV saturation
 * ~0.51, and a surface this module does not own and cannot recolour (the floor is
 * PARKED and clones/overrides `tileLight`/`tileDark`/`subfloor` internally).
 *
 * Alpha-blending toward a WARM near-black, which is what these used to do
 * (rgb 14,9,6 and 10,6,4), scales all three channels together and therefore leaves
 * HSV saturation of the tile underneath essentially untouched — it made the floor
 * darker without making it any less orange. Blending toward a cool near-black instead
 * lifts blue relative to red as it darkens, so the same decal that grounds a prop
 * also pulls the tile beneath it toward neutral. Measured on the rendered tile
 * rgb(158,105,76): at 50% coverage the old warm tint left saturation at 0.523, this
 * one lands it at ~0.40.
 *
 * It is also the more physically honest choice under this rig — the fill is a sky
 * hemisphere, so what a real contact shadow occludes is the WARM key while the cool
 * bounce keeps arriving.
 *
 * ── Round 11: cool-NEUTRAL was half the idea. It is now cool-CHROMATIC. ────────
 * rgba(10,10,17) is HSL saturation 0.26 at luma 10, and blended over the floor it
 * arrived at HSL **0.155** across the three decal materials' combined **10.1% of the
 * frame** — barely above the scanner's 0.15 grey gate. So the tenth of every frame
 * that these decals own was, in chroma terms, dead space sitting on top of the
 * arena's most chromatic surface and diluting it.
 *
 * A deep INDIGO instead of a cool near-neutral fixes that without changing what the
 * decal does: the alpha, the falloff, the offset and the luma are all untouched, so
 * every grounding measurement above still holds. Both reference plates do exactly
 * this — `bs_01` and `bs_02` shade with a saturated violet, never with grey — and it
 * is the same physical argument one step further: what a contact shadow leaves behind
 * IS the sky's own colour, and this rig's sky is blue.
 */
const SHADOW_TINT = (alpha: number) => `rgba(16,10,36,${alpha})`;
/** The same tint as a material colour, for the decals that get their alpha from
 * vertex colours rather than from a canvas gradient. rgb(16,10,36). */
const SHADOW_TINT_HEX = 0x100a24;

function makeContactShadowTexture(): THREE.CanvasTexture {
  const size = 128;
  const canvas = document.createElement('canvas');
  canvas.width = canvas.height = size;
  const ctx = canvas.getContext('2d')!;
  // Tint: deep INDIGO, not warm-black and not grey. See the `SHADOW_TINT` note above —
  // these stops share that constant's reasoning and must move with it.
  //
  // ── THE STOPS MOVED OUTWARD, AND THE REASON IS THAT THE MIDDLE IS NEVER SEEN ───
  //
  // A blind critic: *"the single largest object in the frame — the pot — meets the
  // floor with no contact shadow at all, so it reads as a sticker rather than a
  // solid."* It has one. `tools/tmp/ao_ab.mjs` ablates exactly these decals and they
  // deliver 3.5-6.7% of frame at mean |dL| **0.057-0.072** — measurably present, and
  // just under `arena-scan`'s own 0.06 "the hero has no value separation" threshold,
  // i.e. right at the edge of perceptible. `docs/LESSONS.md` §1 in its usual costume:
  // it IS rendering and it is not readable.
  //
  // The reason is geometric and the old stop placement is the whole of it. The decal
  // is a square plane `scale`x the prop's footprint, so the prop covers the middle
  // and only the annulus from u = 1/scale to u = 1 (u = radius / half-width) is ever
  // seen. With the old stops, alpha across that annulus was:
  //
  //     scale   visible annulus   alpha at its inner edge   at its middle
  //     1.00    u 0.95 .. 1.00           0.03                   0.015
  //     1.25    u 0.80 .. 1.00           0.12                   0.06
  //     1.35    u 0.74 .. 1.00           0.16                   0.08
  //
  // — so 0.55 of the gradient's radius and most of its density was spent under the
  // prop, where it cannot be seen, and the pot's own decal (`hazards.ts`, scale 1)
  // was delivering a **3%** wash. That is the critic's "no contact shadow at all",
  // and it is measured rather than judged.
  //
  // The stops now hold density out to u = 0.74 and fall to nothing over the last
  // quarter. Nothing else moves: the same tint, the same size, the same falloff SHAPE
  // at the rim, so `SHADOW_TINT`'s round-11 chroma argument above is untouched and the
  // decal cannot start reading as a hard disc. What changes is that the part that
  // reaches the screen is the part that carries the density.
  const g = ctx.createRadialGradient(size / 2, size / 2, 0, size / 2, size / 2, size / 2);
  g.addColorStop(0, SHADOW_TINT(0.58));
  g.addColorStop(0.74, SHADOW_TINT(0.36));
  g.addColorStop(1, SHADOW_TINT(0));
  ctx.fillStyle = g;
  ctx.fillRect(0, 0, size, size);
  const tex = new THREE.CanvasTexture(canvas);
  tex.needsUpdate = true;
  return tex;
}

/**
 * ── THE DIRECTIONAL TERM, AND THE MEASUREMENT THAT ASKED FOR IT ──────────────
 *
 * Alpha multiplier for a decal vertex at local `(px, pz)` metres, from 1.0 on the side
 * the key throws its shadow to `SHADOW_RAMP_LIT` on the lit side. `dir` is already in
 * the prop's own pre-yaw frame (see `localShadowDir`).
 *
 * Two blind critics called the grounding "a symmetric grey halo pasted under the prop"
 * and both prescribed "a tight contact-occlusion ellipse". The symptom was right and
 * it is now a number. `tools/tmp/aoband.mjs` splits the contact band (0-0.25 m from a
 * footprint) into the key's shadow side and its lit side, each against open floor ON
 * ITS OWN SIDE so a brightness gradient cannot fake an asymmetry:
 *
 *                        shadow side   lit side   ratio
 *   ours, HEAD              0.1719      0.0835     2.06
 *   Brawl Stars bs_04       0.1238      0.0161     7.7
 *   (two isolated barrels, `tools/tmp/refcontact.mjs`, agreeing to 0.012)
 *
 * So the arena is not short of contact darkening in TOTAL — 0.1613 against the
 * reference's 0.1238 — it is putting 5.2x too much of it on the side the light comes
 * from. A symmetric ring cannot produce the reference's shape at any strength, which
 * is why this is a change of KIND and not a tuning pass, and why making the layer
 * darker (the obvious reading of "the ellipse is too weak") would have moved the one
 * number that is already wrong further in the wrong direction.
 *
 * Quadratic rather than linear: a linear ramp is at half strength on the two sides
 * PERPENDICULAR to the light, where the reference is already nearly clean.
 */
const SHADOW_RAMP_LIT = 0.10;
function shadowRampAlpha(px: number, pz: number, halfW: number, halfD: number, dir: { x: number; z: number }): number {
  const reach = Math.abs(dir.x) * halfW + Math.abs(dir.z) * halfD;
  if (reach <= 0) return 1;
  const t = (px * dir.x + pz * dir.z) / reach; // -1 (lit) .. +1 (shadow)
  const u = THREE.MathUtils.clamp((t + 1) / 2, 0, 1);
  return SHADOW_RAMP_LIT + (1 - SHADOW_RAMP_LIT) * u * u;
}

/**
 * Writes the 4-component `color` attribute every decal geometry in this file must
 * carry (see the `vertexColors` warning on `buildMaterials`). RGB is left at 1 so the
 * material's own colour and map still decide the tint; only alpha is authored.
 *
 * `dir` omitted means a flat 1.0 — the pre-round-12 behaviour, kept for the small
 * props that pass their own scale to `buildContactShadow`.
 */
function writeDecalAlpha(geo: THREE.BufferGeometry, halfW: number, halfD: number, dir?: { x: number; z: number }): void {
  const pos = geo.attributes.position;
  const col = new Float32Array(pos.count * 4);
  for (let i = 0; i < pos.count; i++) {
    // `PlaneGeometry` is authored in XY and every decal here is rotated -90 deg about
    // X, which maps local +Y to world -Z. So the world-space offset of a vertex is
    // (x, -y) and the ramp must be evaluated there, not on the raw attribute.
    const a = dir ? shadowRampAlpha(pos.getX(i), -pos.getY(i), halfW, halfD, dir) : 1;
    col[i * 4] = 1; col[i * 4 + 1] = 1; col[i * 4 + 2] = 1; col[i * 4 + 3] = a;
  }
  geo.setAttribute('color', new THREE.BufferAttribute(col, 4));
}

/**
 * Y height of every baked grounding decal in the arena. Only the contact/AO ring is
 * left (the directional cast blob that used to sit 0.002 below it is gone — see the
 * `SHADOW_DIR` note at the top of this file), but the constant stays because this
 * height has been wrong twice, both times by being buried under something opaque, and
 * it must keep being one number that a future decal cannot be added without.
 *
 * ── The history, because the number looks arbitrary and is not ──────────────────
 *
 * v1 put these at y = 0.011, INSIDE the floor tile's own 0.03m-tall box (top face at
 * +0.015), so every AO decal in the arena rendered behind opaque tile geometry and
 * was visible only through the ~6%-wide grout gaps. v2 raised them to 0.019/0.017 —
 * clear of the TILE, and that part is still true.
 *
 * v2 was still wrong, and a measured probe (garish-recolour every decal, render at
 * shipped framing) showed exactly how: only ~37% of contact-decal area reaches the
 * screen, ~75% for the cast decals. The tile is not the only opaque thing on the
 * floor. Above it sit `floor.ts`'s pads and mats — `floor_woodpad`,
 * `floor_utility_pad`, `floor_teal_zone`(+`_trim`), `floor_border` at y = 0.045-0.048
 * and `floor_seam`/`floor_drain` at 0.062 — all opaque, all depth-writing. And props
 * are DELIBERATELY placed on those pads, so the exact props that most needed
 * grounding (the spice carts and stacked pots standing on the hub's teal mats) had
 * their entire shadow drawn underneath an opaque plane and reaching the screen at
 * literally zero pixels, while the ~37% that did survive was the part leaking out
 * onto bare tile — un-anchored to anything, which is precisely the "mushy
 * directionless blob" a lighting round was once scored down for.
 *
 * That measurement also half-settles a question this project had queued for a long
 * time ("are these baked decals a redundant third darkening layer now that real
 * shadows are crisp — delete them?"). The answer split once they were measured on
 * screen rather than argued about: the CONTACT ring was never redundant, it was mostly
 * INVISIBLE, and the fraction that showed was the least useful fraction — so it stays.
 * The CAST blob genuinely was redundant and is gone (round 9, see `SHADOW_DIR`).
 *
 * 0.07 is chosen as a window, not a taste call: above the highest opaque floor layer
 * (`floor.ts`'s `FINE_Y` = 0.062) and below the lowest prop kick/plinth (~0.08), so a
 * decal clears every pad it might be standing on while still being occluded by the
 * prop body that casts it. Anything in `arena/floor.ts` that grows past 0.062, or any
 * prop base that drops below 0.08, breaks this and must move this constant with it.
 */
const BAKED_SHADOW_Y = 0.07;

/** Elliptical AO blob sized to a prop's own footprint (in metres), slightly oversized
 * so it peeks out past the silhouette the way a real contact shadow would.
 *
 * `dir` (the prop's local shadow direction, from `localShadowDir`) makes the blob
 * one-sided — see `shadowRampAlpha`. Omitting it keeps the flat, symmetric decal the
 * small props were tuned with. Either way the geometry gets its 4-component `color`
 * attribute, which the material REQUIRES. */
export function buildContactShadow(mat: THREE.Material, wM: number, dM: number, scale = 1.25, dir?: { x: number; z: number }): THREE.Mesh {
  const w = wM * scale, d = dM * scale;
  // 8x8 rather than 1x1: the ramp is per-vertex, so a two-triangle quad would carry
  // exactly one gradient across the whole decal and lose the quadratic entirely.
  const geo = new THREE.PlaneGeometry(w, d, 8, 8);
  writeDecalAlpha(geo, w / 2, d / 2, dir);
  const m = new THREE.Mesh(geo, mat);
  m.rotation.x = -Math.PI / 2;
  m.position.y = BAKED_SHADOW_Y;
  m.renderOrder = 1;
  m.name = 'contact_shadow__no_outline';
  m.castShadow = false;
  m.receiveShadow = false;
  noOutline(m);
  return m;
}

/**
 * The contact band as GEOMETRY: a rounded rect on the prop's own footprint at full
 * alpha, and a second contour `CONTACT_OVERHANG_M` outside it at zero, with the
 * directional ramp riding on the same vertex-alpha channel.
 *
 * See the `groundedShadow` material note for why this replaced a canvas texture. The
 * short version: a texture's feather is a fraction of its canvas, so its world width
 * scaled with the prop, and no single texture can be full-alpha at the footprint edge
 * AND zero a fixed distance outside it on both a 2.5 m barrel and an 8.5 m island.
 *
 * `CONTACT_OVERHANG_M` is not a taste number. At the key's 39 deg elevation a point at
 * height h is thrown h*cot(39) = 1.235h, and the reference's own prop shadows reach
 * 0.35-0.55 of the prop's height (hand-measured off three crates and a barrel in
 * `gameplay_topdown/bs_04.png` by the lighting pass). Arena cover stands 0.9-1.3 m, so
 * the reference band is 0.32-0.7 m — and the long half of that throw is the shadow
 * MAP's job now, not a decal's. 0.35 m is the near end: the core, not the tail.
 */
const CONTACT_OVERHANG_M = 0.35;
const CONTACT_PEAK_ALPHA = 0.9;

export function buildContactRing(mat: THREE.Material, wM: number, dM: number, dir: { x: number; z: number }, overhangM = CONTACT_OVERHANG_M): THREE.Mesh {
  const hw = wM / 2, hd = dM / 2;
  // Corner radius follows the prop's short side, capped so a long thin footprint does
  // not turn into a stadium. `roundedBox`'s prop bevels sit in the same neighbourhood.
  const r = Math.min(Math.min(hw, hd) * 0.35, 0.5);
  const cx = hw - r, cz = hd - r;
  const K = 6; // arc samples per corner
  const corners: Array<[number, number, number]> = [
    [cx, cz, 0], [-cx, cz, Math.PI / 2], [-cx, -cz, Math.PI], [cx, -cz, (3 * Math.PI) / 2],
  ];
  const inner: Array<[number, number]> = [];
  const outer: Array<[number, number]> = [];
  for (const [ox, oz, a0] of corners) {
    for (let k = 0; k <= K; k++) {
      const a = a0 + (Math.PI / 2) * (k / K);
      const ca = Math.cos(a), sa = Math.sin(a);
      inner.push([ox + r * ca, oz + r * sa]);
      outer.push([ox + (r + overhangM) * ca, oz + (r + overhangM) * sa]);
    }
  }
  const N = inner.length;
  const pos = new Float32Array((1 + N * 2) * 3);
  const col = new Float32Array((1 + N * 2) * 4);
  const put = (i: number, x: number, z: number, alpha: number) => {
    // Authored directly in the ground plane and rotated -90 deg about X like every
    // other decal here, so a local +Z lands at plane -Y.
    pos[i * 3] = x; pos[i * 3 + 1] = -z; pos[i * 3 + 2] = 0;
    col[i * 4] = 1; col[i * 4 + 1] = 1; col[i * 4 + 2] = 1; col[i * 4 + 3] = alpha;
  };
  put(0, 0, 0, CONTACT_PEAK_ALPHA * shadowRampAlpha(0, 0, hw, hd, dir));
  for (let i = 0; i < N; i++) {
    put(1 + i, inner[i][0], inner[i][1], CONTACT_PEAK_ALPHA * shadowRampAlpha(inner[i][0], inner[i][1], hw, hd, dir));
    put(1 + N + i, outer[i][0], outer[i][1], 0);
  }
  // ⚠️ WINDING. The contours above are generated counter-clockwise in (x, z), and
  // `put` writes them as (x, -z) in the plane's XY — a mirror, which REVERSES the
  // winding. Emitting them in the natural order therefore produces triangles facing
  // -Z, i.e. straight DOWN once the mesh is rotated -90 deg about X, and
  // `MeshBasicMaterial` is `FrontSide`, so the entire ring is backface-culled and
  // renders at zero pixels while the mesh count, the bounding box and every ablation
  // still say it is there. That is exactly how this shipped for one measurement round:
  // `aoband` reported the baked layer at dL 0.0034 against HEAD's 0.0438 with all 41
  // decals present and correct (`docs/LESSONS.md` §1, and §12's lathe-normal trap in a
  // new costume). Indices are reversed here to undo the mirror. If this geometry is
  // ever re-authored, check delivered PIXELS, not mesh count.
  const idx: number[] = [];
  for (let i = 0; i < N; i++) {
    const j = (i + 1) % N;
    // interior fan
    idx.push(0, 1 + j, 1 + i);
    // the band
    idx.push(1 + i, 1 + N + j, 1 + N + i);
    idx.push(1 + i, 1 + j, 1 + N + j);
  }
  const geo = new THREE.BufferGeometry();
  geo.setAttribute('position', new THREE.BufferAttribute(pos, 3));
  geo.setAttribute('color', new THREE.BufferAttribute(col, 4));
  geo.setIndex(idx);
  geo.computeVertexNormals();
  const m = new THREE.Mesh(geo, mat);
  m.rotation.x = -Math.PI / 2;
  m.position.y = BAKED_SHADOW_Y;
  m.renderOrder = 1;
  m.name = 'contact_shadow__no_outline';
  m.castShadow = false;
  m.receiveShadow = false;
  noOutline(m);
  return m;
}

/** Counter-rotates the fixed world `SHADOW_DIR` into a group's local (pre-yaw) space,
 * so `addCover`'s contact ring runs the same way as the real light whichever way the
 * prop itself is yawed. */
function localShadowDir(yawDeg: number): { x: number; z: number } {
  const yawRad = THREE.MathUtils.degToRad(yawDeg);
  const c = Math.cos(-yawRad), s = Math.sin(-yawRad);
  return { x: SHADOW_DIR.x * c + SHADOW_DIR.z * s, z: -SHADOW_DIR.x * s + SHADOW_DIR.z * c };
}

/**
 * Re-authors the directional ramp on every contact decal already inside `root`.
 *
 * Round props (barrels, the stacked-pot crate, the pot itself, the puddles) add their
 * own RADIAL decal on top of whatever `addCover` gives them, because a rounded rect's
 * corners are the wrong shape under a cylinder. Those are built inside `build(wM, dM)`,
 * which does not know the prop's yaw and therefore cannot know which way the light
 * comes from — so they were the one family left symmetric, and a symmetric decal on
 * the lit side is exactly the defect this round is closing.
 *
 * Doing it here, by walking for the decal's own reserved name, means a prop builder
 * never has to thread a light direction through its signature and a decal added in
 * future is covered by construction.
 *
 * ⚠️ ORDER MATTERS: call this BEFORE adding a `buildContactRing`, never after. The
 * ring authors a zero-alpha outer contour that the bounding box cannot distinguish
 * from any other vertex, so re-running the ramp over it would fill its feather in.
 */
export function applyContactRamp(root: THREE.Object3D, yawDeg = 0): void {
  const dir = localShadowDir(yawDeg);
  root.traverse((o) => {
    if (!(o as THREE.Mesh).isMesh || o.name !== 'contact_shadow__no_outline') return;
    const geo = (o as THREE.Mesh).geometry;
    if (!geo.boundingBox) geo.computeBoundingBox();
    const bb = geo.boundingBox!;
    writeDecalAlpha(geo, Math.max(Math.abs(bb.min.x), bb.max.x), Math.max(Math.abs(bb.min.y), bb.max.y), dir);
  });
}

/**
 * Raised counter-back wall + a thin bright cap trim along its top edge.
 *
 * This is the single biggest lever for the "cover has no height" finding: the steep
 * gameplay pitch (58°) looks almost straight down on a ~0.9m cabinet, so a flat top
 * plus a sliver of side face reads as barely-there relief. A vertical wall reads
 * unambiguously as height from ANY pitch, and the light-catching cap trim on top of
 * it is the literal "chamfer that catches a different light angle" the brief asked
 * for. Always placed at local -Z (the "outer/back" edge, away from the pot — see the
 * yaw convention noted on `buildStoveIsland`'s herb sprig) so it never faces the
 * hazard and never reads as blocking the lane a player is dashing down.
 *
 * `wM`/`dM` are the CALLER's already-shrunk cabinet footprint (not the raw CoverBox
 * size), and the wall is kept well inside it on every axis — this only adds height,
 * never pushes visible geometry past the CoverBox the player actually collides with.
 */
export function addBacksplash(g: THREE.Group, M: Materials, wM: number, dM: number, cabH: number, mat: THREE.Material, heightM = 0.4): void {
  const wallD = dM * 0.1;
  const wall = mesh(roundedBox(wM * 0.9, heightM, wallD, 0.025), mat, 'backsplash');
  wall.position.set(0, cabH + heightM / 2, -dM * 0.5 + wallD * 0.5 + dM * 0.02);
  g.add(wall);
  const cap = mesh(roundedBox(wM * 0.9, 0.03, wallD + 0.015, 0.015), M.rimLight, 'backsplash_cap__no_outline');
  cap.position.set(0, cabH + heightM + 0.015, wall.position.z);
  noOutline(cap);
  g.add(cap);
}

/**
 * Thin bright picture-frame trim tracing all FOUR edges of a flat top surface.
 *
 * `addBacksplash` only lights up one edge — fine for silhouette height, but which
 * edge that is depends on which way the object happens to face the camera, and the
 * default judged gameplay screenshot is centred on the hub with the near/pot-facing
 * edge of the north stove islands toward camera, NOT their back edge. A full
 * perimeter frame guarantees the "chamfer catching light" cue reads no matter which
 * side of a prop the camera happens to be looking at, in this shot or any other.
 * `w`/`d` are the exact footprint of the top surface this rims (already in metres).
 */
export function addTopRim(g: THREE.Group, M: Materials, w: number, d: number, y: number, thick = 0.035): void {
  const hw = w / 2, hd = d / 2;
  const bar = (bw: number, bd: number, px: number, pz: number) => {
    const b = mesh(new THREE.BoxGeometry(bw, 0.022, bd), M.rimLight, 'top_rim__no_outline');
    b.position.set(px, y, pz);
    noOutline(b);
    g.add(b);
  };
  bar(w, thick, 0, hd - thick / 2);
  bar(w, thick, 0, -hd + thick / 2);
  bar(thick, d - thick * 2, hw - thick / 2, 0);
  bar(thick, d - thick * 2, -hw + thick / 2, 0);
}

// ─────────────────────────────────────────────────────────────────────────────
// Floor layer heights, in METRES. Gameplay/overview cameras sit 20-100m out, where a
// standard depth buffer has nowhere near enough precision to resolve millimetre gaps
// reliably — an early pass stacked these a few mm apart and lost z-fights against the
// tile field beneath. Centimetre-scale separation is still visually flat from gameplay
// distance but leaves the depth buffer an unambiguous answer.
// ─────────────────────────────────────────────────────────────────────────────
export const FLOOR_Y = {
  subfloor: -0.1,
  tile: 0,
  decal: 0.15, // scorch patch, puddles, flour, wood pads, tile ring, border trim
  fine: 0.25, // marks drawn ON a decal (wood seams, hazard ring/glow)
} as const;

// ─────────────────────────────────────────────────────────────────────────────
// Cover placement — the single source of truth linking each CoverBox to its visual.
// ─────────────────────────────────────────────────────────────────────────────

export interface CoverSpec {
  x: number; y: number; w: number; h: number; kind: string;
  yawDeg?: number;
  build: (wM: number, dM: number) => THREE.Group;
}

export function addCover(propsGroup: THREE.Group, cover: CoverBox[], M: Materials, spec: CoverSpec): THREE.Group {
  const wM = wu(spec.w);
  const dM = wu(spec.h);
  const group = spec.build(wM, dM);
  // ── ROUND 12: one ring, absolute band width, directional alpha ─────────────
  //
  // What this replaced, and why none of it survived: a texture-mapped plane at 1.22x
  // (small props) or 1.34x (`LARGE_COVER_KINDS`) the footprint, nudged 0.42 of its own
  // overhang along `SHADOW_DIR`. Three faults, all of them measured:
  //
  //  1. The band's WIDTH scaled with the prop. Rounds 7 and 8 both tried to fix "a
  //     broad grey haze spreading well past the prop" by moving the multiplier, which
  //     cannot work: a texture feather is a fraction of its own canvas. `aoband` put
  //     the baked layer at dL 0.0132 a full 0.60-1.20 m from a footprint.
  //  2. The ring was very nearly SYMMETRIC. The 0.42-of-overhang nudge is 9% of the
  //     footprint on a small prop, so both sides of the base got nearly the same
  //     darkening. Measured: our contact band runs 2.06:1 shadow-to-lit where the
  //     reference runs 7.7:1 (`shadowRampAlpha`).
  //  3. `SHADOW_DIR` itself had the WRONG SIGN on Z, so what little offset there was
  //     pushed the band AWAY from the camera — the same defect `086ff5f` fixed in the
  //     key light, mirrored into three arena files and left there.
  //
  // The offset is gone rather than retuned: with a directional alpha ramp the band is
  // already thin on the lit side and thick on the shadow side, and an offset on top of
  // that would pull the full-alpha edge off the footprint it is supposed to hug.
  //
  // `LARGE_COVER_KINDS` is gone with it. It existed only because a proportional
  // feather was too thin, in world units, on a big prop; an absolute band makes a
  // stove island and a barrel the same problem.
  applyContactRamp(group, spec.yawDeg ?? 0);
  group.add(buildContactRing(M.groundedShadow, wM, dM, localShadowDir(spec.yawDeg ?? 0)));
  // No baked cast shadow any more. The one that used to be added here measured
  // 0.13/255 across the frame while its frozen direction pinned the key light's
  // azimuth in place — see the `SHADOW_DIR` note at the top of this file. The real
  // shadow map casts it now.
  const p = groundPos(spec.x, spec.y);
  group.position.set(p.x, 0, p.z);
  if (spec.yawDeg) group.rotation.y = THREE.MathUtils.degToRad(spec.yawDeg);
  group.name = `cover:${spec.kind}`;
  propsGroup.add(group);
  cover.push({ x: spec.x, y: spec.y, w: spec.w, h: spec.h, kind: spec.kind });
  return group;
}

// ─────────────────────────────────────────────────────────────────────────────
// CONCEALMENT — the same contract as `addCover`, for the list that blocks NOTHING
// ─────────────────────────────────────────────────────────────────────────────
//
// Uri, `DECISIONS §29b`, on what these are: *"it's supposed to be plates and other
// kitchen objects you can hide under — fully hidden. Bushes don't make sense in a
// kitchen."* And `§29c`: *"attacking from under it will break it and reveal you. You can
// also step out and attack."* Both halves of that rule are already implemented in
// `game/movement.ts` + `game/combat.ts`; **the mechanic has simply never had a region to
// act on.** Uri, playing the shipped build: *"i can't hide under conceilments or break
// them."* There was nothing to hide under. That is what this pair of functions is for.
//
// ⚠️ **THE ONE THING THAT MUST NOT HAPPEN IS A CONCEALMENT BOX REACHING `arena.cover`.**
// `arena/types.ts` says it at the field and `movement.ts` says it at the type: the two
// lists are separate PRECISELY so that nothing which reads `cover` can see this one, and
// that separation is the entire implementation of "walk-through". So `addConceal` takes a
// `ConcealBox[]` and `addCover` takes a `CoverBox[]`, and the two interfaces are
// nominally distinct despite identical fields. Passing the wrong array is a type error at
// the call site rather than a silent gameplay bug.
//
// ⚠️ **AND IT MUST NOT CARRY THE BLOCKING INK LINE.** `kitchen.ts` gives `propsGroup` a
// 0.016 outline — far past anything decoration carries — because that heavy line IS the
// arena's "this collides" cue. A walk-through patch inside `propsGroup` would inherit it
// and tell the player the exact opposite of the truth, so `addConceal` takes its own
// parent group and marks it `noOutline`.

export interface ConcealSpec {
  x: number; y: number; w: number; h: number; kind: string;
  yawDeg?: number;
  build: (wM: number, dM: number) => THREE.Group;
}

/**
 * Register ONE walk-through region and build its matching visual, in one statement —
 * the same "there is no path to declaring one without the other" guarantee `addCover`
 * gives, for the list where the mistake is more expensive: a region with no visual is a
 * player vanishing on open floor, and a visual with no region is Uri's actual bug report.
 */
export function addConceal(
  concealGroup: THREE.Group,
  concealment: ConcealBox[],
  M: Materials,
  spec: ConcealSpec,
): THREE.Group {
  const group = spec.build(wu(spec.w), wu(spec.h));
  const p = groundPos(spec.x, spec.y);
  group.position.set(p.x, 0, p.z);
  if (spec.yawDeg) group.rotation.y = THREE.MathUtils.degToRad(spec.yawDeg);
  group.name = `conceal:${spec.kind}`;
  noOutline(group);
  concealGroup.add(group);
  concealment.push({ x: spec.x, y: spec.y, w: spec.w, h: spec.h, kind: spec.kind });
  void M;
  return group;
}

/**
 * A service table's linen with plates and trays stacked on it — the thing you duck under.
 *
 * ── 🚨 "EVERYTHING HERE IS UNDER 0.80 m ON PURPOSE" — REVERSED BY THE OWNER ──
 * The old header is kept verbatim below the reversal, per `CLAUDE.md`'s rule about an
 * assertion that encodes a rule which has been overturned. It read:
 *
 *   > *"`CHARACTER_HEIGHT` is 2.10 m and the match camera pitches 58 degrees, so a canopy
 *   > tall enough to physically cover a fighter would also hide the floor the fighter
 *   > stands on for a screen-height above it. It does not need to: `§29b` is FULLY HIDDEN
 *   > and the renderer removes the opponent's model outright, so the geometry's job is to
 *   > say 'this ground hides you', not to occlude. Every reference plate delivers its
 *   > concealment as a tinted GROUND PATCH with clutter on it, at ankle-to-knee height,
 *   > for exactly this reason."*
 *
 * Uri, playing the shipped build: *"i still can't see the 'bushes' that we can hide below
 * them."* That is the **third independent report of the same thing** — an agent measuring
 * these at a shallow camera weeks ago wrote that they *"read unambiguously as ground mats,
 * not as something you duck under"*, and `DECISIONS §29a` has been waiting on his eye
 * since. The argument above is internally sound and answers the wrong question: it
 * optimises for **not occluding the frame**, and the thing it was asked for is **reading
 * as cover**. Tallest element was **0.62 m against a 2.10 m character** — 29% of a
 * fighter, laid on a 0.02 m cloth. There was nothing to be below.
 *
 * ── WHAT REPLACED IT, AND WHY IT DOES NOT COST THE FRAME ────────────────────
 * A **pot rack on four poles** over the same footprint: an open grid of rails and slats at
 * `RACK_Y`, a short cloth valance hanging off its perimeter, and pans and lids swinging
 * under it. The old objection is answered by OPENNESS rather than by lowness — the rack
 * covers **~22% of the footprint in plan**, so the floor, the ground crockery and the
 * fighter are all still visible THROUGH it, while the near rails, the valance and the
 * hanging pans cross the fighter's silhouette and put something unmistakably above him.
 *
 * ── THE HEIGHTS ARE DERIVED FROM `CHARACTER_HEIGHT`, NEVER TYPED ────────────
 * `RACK_Y = CHARACTER_HEIGHT + DUCK_CLEAR_M + HANG_MAX`. Two properties fall out of that
 * and both are the point of writing it this way:
 *   * the lowest hanging pan clears a standing fighter's head by exactly `DUCK_CLEAR_M`,
 *     so **nothing here can ever interpenetrate a character** — `CLAUDE.md` rule 3 is
 *     about a limb through a torso and a pan through a head is the same defect;
 *   * if `CHARACTER_HEIGHT` moves again (it has, 2.35 → 2.10), the canopy moves with it
 *     instead of silently becoming a hat.
 *
 * ── 🔴 THE MECHANIC IS NOT TOUCHED, AND THE FOOTPRINT IS NOT TOUCHED ────────
 * `ConcealBox` is `{x, y, w, h}` — **plan extents only, no height field anywhere in the
 * sim**. `movement.ts:isConcealed` tests the fighter's centre against that rectangle and
 * `isVisibleFrom` works on the same 2D list, so height is invisible to every reader.
 * `DECISIONS §29a`'s constraint — `stepAI` has no search and sees `CONCEAL_REVEAL_RADIUS`
 * = 84 wu, so a patch wider than 168 wu has an interior it can never reach — is therefore
 * a constraint on **FOOTPRINT ONLY**, and this change adds none. Re-derived, not inherited.
 *
 * ── AND THE CANOPY MUST NOT OVERHANG THE RIM ────────────────────────────────
 * The rim is the true bound (below). A canopy wider than the cloth would give the player a
 * SECOND, wrong edge to read the hiding place off, and the outer one at that — so the rack
 * is built at the cloth's own `0.985` inset and every hanging thing lives inside it.
 *
 * ── THE RIM IS ON THE TRUE BOUND, TO THE WORLD UNIT ─────────────────────────
 * Standing 5 wu outside a region is the difference between hidden and shot, and the
 * membership rule is the fighter's CENTRE (`movement.ts:isConcealed`), so the drawn edge
 * has to be the real edge. It is traced at `FLOOR_Y.fine`, the same layer the hazard
 * rings use, and for the same reason: a hazard the player cannot see the boundary of is
 * a coin toss, and so is a hiding place.
 *
 * ── THE SCATTER IS A FIXED TABLE, NOT AN RNG ────────────────────────────────
 * Every patch ships with a point-symmetric partner (`kitchen.ts` generates it by
 * transform), and the pair must be identical under 180 degrees or the map is not fair.
 * A seeded RNG would be deterministic per PROCESS and still give the two patches
 * different clutter unless the seed were derived from position, which is one more thing
 * to get wrong. Fractions of the patch's own extent, so one table serves every size.
 */
export function buildConcealPatch(M: Materials, wM: number, dM: number): THREE.Group {
  const g = new THREE.Group();

  // The linen. Rounded, and inset a hair below the rim so the rim reads as an edge
  // rather than as a stripe painted on the cloth.
  const INSET = 0.985;
  const clothParts: THREE.BufferGeometry[] = [
    roundedBox(wM * INSET, 0.02, dM * INSET, Math.min(wM, dM) * 0.09).translate(0, FLOOR_Y.decal, 0),
  ];

  // The rim, ON the true bound: a thin frame of four bars rather than a scaled quad, so
  // the line width is absolute and does not thicken with the patch. Merged into ONE
  // geometry — see the draw-call note below.
  const RIM = 0.09;
  const frameParts: THREE.BufferGeometry[] = [];
  for (const [sx, sz, w, d] of [
    [0, dM / 2 - RIM / 2, wM, RIM],
    [0, -(dM / 2 - RIM / 2), wM, RIM],
    [wM / 2 - RIM / 2, 0, RIM, dM],
    [-(wM / 2 - RIM / 2), 0, RIM, dM],
  ] as const) {
    const b = new THREE.BoxGeometry(w, 0.02, d);
    b.translate(sx, FLOOR_Y.fine, sz);
    frameParts.push(b);
  }

  // Plate stacks and trays. `u`/`v` are fractions of the half-extent, `r` a fraction of
  // the smaller extent, `h` a height in metres, `plates` the number of discs.
  //
  // ⚠️ **THE RADII WERE HALVED AFTER LOOKING AT THE FIRST RENDER**, and the number that
  // settled it came out of the same frame: at `r` 0.075..0.130 of a 130 wu patch the
  // discs were **1.0 to 1.7 m ACROSS — as wide as the character is** (`shots/ap`, first
  // pass), so six of them read as giant coins on a mat rather than as a cluttered service
  // table. At 0.042..0.070 they are 0.55..0.91 m, which is crockery, and there are eleven
  // instead of six so the density carries the read that the size no longer does.
  // `docs/LESSONS.md` on judging the image and not the description: the first table
  // looked entirely reasonable as numbers.
  const CLUTTER: ReadonlyArray<readonly [number, number, number, number, number]> = [
    [-0.60, -0.55, 0.058, 0.40, 5],
    [-0.44, -0.34, 0.048, 0.24, 3],
    [-0.14, -0.66, 0.043, 0.18, 2],
    [0.16, -0.50, 0.066, 0.52, 6],
    [0.52, -0.62, 0.050, 0.30, 4],
    [0.63, -0.20, 0.070, 0.62, 7],
    [0.40, 0.16, 0.045, 0.22, 3],
    [0.60, 0.55, 0.056, 0.38, 5],
    [0.12, 0.63, 0.042, 0.18, 2],
    [-0.28, 0.48, 0.062, 0.46, 6],
    [-0.62, 0.24, 0.049, 0.28, 4],
  ];
  //
  // ── ⚠️ MERGED PER MATERIAL, AND THE FIRST DRAFT WAS NOT ─────────────────────
  // Eleven stacks of 2-7 discs is 47 meshes per patch; six patches is 282, plus a cloth
  // and four rim bars each. Measured on the unmerged draft with `tools/perf.mjs --mode
  // counts`: **draw calls 868 -> 1,177, i.e. +309 — a 36% rise for one feature**, on a
  // game whose owner plays it on a phone. Merging by material takes each patch to FOUR
  // draws (cloth, rim, plates, trays) and the whole feature to 24. It is safe here for
  // the same reason `kitchen.ts`'s `outlineGroup(..., { merge: true })` is: every part
  // going into one buffer already shares one material, so nothing about the shading
  // changes. The discs keep their world positions because each geometry is `translate`d
  // into patch-local space before the merge, exactly as `apron.ts` does for the kerb.
  const short = Math.min(wM, dM);
  const plateParts: THREE.BufferGeometry[] = [];
  const trayParts: THREE.BufferGeometry[] = [];
  for (const [u, v, r, h, plates] of CLUTTER) {
    const x = u * (wM / 2), z = v * (dM / 2);
    const rad = r * short;
    const step = h / plates;
    for (let i = 0; i < plates; i++) {
      // Alternating plate / warm tray, so a stack reads as crockery rather than as one
      // extruded cylinder — the same "silhouette variety inside a cluster" instinct the
      // pantry crates carry, at a tenth of the scale.
      const isTray = i % 2 === 1;
      const disc = puck(rad * (isTray ? 0.94 : 1), step * 0.86, 16);
      disc.translate(x, FLOOR_Y.fine + step * (i + 0.5), z);
      (isTray ? trayParts : plateParts).push(disc);
    }
  }

  // ───────────────────────────────────────────────────────────────────────────
  // THE CANOPY — the half that answers "hide BELOW them"
  // ───────────────────────────────────────────────────────────────────────────
  //
  // ⚠️ EVERY VERTICAL NUMBER HERE IS DERIVED FROM `CHARACTER_HEIGHT`. Retyping 2.1
  // would survive `tsc`, survive every gate, and go stale the next time the cast is
  // rescaled — which has already happened once (2.35 -> 2.10, `units.ts`).
  //
  //   RACK_Y is the UNDERSIDE of the rack, i.e. the ceiling of the space you stand in.
  //   HANG_MAX is the deepest anything is allowed to swing below it.
  //   => lowest hanging pan sits at CHARACTER_HEIGHT + DUCK_CLEAR_M, by construction.
  //
  // `DUCK_CLEAR_M` is deliberately generous. The alternative — clearing the head by a
  // few centimetres — reads better in a still and is a bug in motion: characters bob,
  // `rig.ts` animates the whole body, and a pan grazing a head at one phase of the run
  // cycle is the interpenetration defect `CLAUDE.md` rule 3 is entirely about.
  const DUCK_CLEAR_M = 0.45;
  const HANG_MAX = 0.44;
  const RACK_Y = CHARACTER_HEIGHT + DUCK_CLEAR_M + HANG_MAX;
  const RACK_T = 0.16;               // rail / slat thickness, absolute (see RIM's note)
  const RAIL = 0.14;                 // perimeter rail width
  const SLAT = 0.13;                 // cross-slat width
  const POST = 0.21;                 // corner pole side
  const VAL_DROP = 0.52;             // valance drop below the rack
  const VAL_T = 0.07;                // valance thickness

  // Plan extents of the rack. `INSET`, the CLOTH's own inset — the rack may never be the
  // outermost thing, or the player reads the hiding place off the wrong edge.
  const rW = wM * INSET, rD = dM * INSET;
  // The valance takes the OUTER plane and the rails sit just inside it. First draft had
  // them concentric with `RAIL` (0.20) wider than `VAL_T` (0.07), which put the cloth
  // entirely inside the rail's own footprint — rendered, invisible, and indistinguishable
  // from not having built it. `CLAUDE.md` rule 4, in its smallest possible form.
  const valX = rW / 2 - VAL_T / 2, valZ = rD / 2 - VAL_T / 2;
  const railX = valX - VAL_T / 2 - RAIL / 2, railZ = valZ - VAL_T / 2 - RAIL / 2;
  const railY = RACK_Y + RACK_T / 2;

  // ── Perimeter rails + TWO cross bars, and the count came down after looking ──
  // The first draft ran three slats one way and two the other. It rendered as a CAGE —
  // a regular orange lattice that says scaffolding, not kitchen — and the fix was not to
  // thin the bars but to delete most of them: the overhead mass belongs to the hanging
  // cookware below, which is the thing that says what this is. Plan coverage of the
  // frame is now
  //     (4·RAIL·rW + 2·SLAT·rD + 4·POST² − overlaps) / (rW·rD)
  // = **15.2 / 13.9 / 12.9%** at the shipped 110 / 120 / 130 wu sizes, and the nine
  // hanging pots add **11.1%** at every size (they scale with the patch), so the canopy
  // blocks **at most a quarter of its own footprint** and the fighter, the ground
  // crockery and the floor all read THROUGH it. The old builder's objection to a canopy
  // was that it would hide the ground; it is answered by OPENNESS, not by lowness.
  for (const [sx, sz, w, d] of [
    [0, railZ, rW, RAIL],
    [0, -railZ, rW, RAIL],
    [railX, 0, RAIL, rD],
    [-railX, 0, RAIL, rD],
  ] as const) {
    frameParts.push(new THREE.BoxGeometry(w, RACK_T, d).translate(sx, railY, sz));
  }
  for (const u of [-0.34, 0.34]) {
    frameParts.push(new THREE.BoxGeometry(SLAT, RACK_T, rD).translate(u * (rW / 2), railY, 0));
  }

  // ── Four poles, at the corners and NOT in the middle ────────────────────────
  // A concealment region is walk-through by definition (`addConceal`'s header), so every
  // solid-looking thing in it is something a fighter passes through. Corners are where a
  // fighter crossing the patch is least likely to be, and a slim pole reads as a prop you
  // brush past rather than as structure you ought to collide with. This is the one place
  // the build knowingly trades a little honesty for the read; it is called out here so
  // the next owner is deciding rather than discovering.
  for (const sx of [-railX, railX]) {
    for (const sz of [-railZ, railZ]) {
      const h = railY + RACK_T / 2 - FLOOR_Y.decal;
      frameParts.push(roundedBox(POST, h, POST, 0.05).translate(sx, FLOOR_Y.decal + h / 2, sz));
      frameParts.push(puck(POST * 0.85, 0.10, 12).translate(sx, FLOOR_Y.fine + 0.05, sz));
    }
  }

  // ── Hanging cookware — the part that crosses the fighter's silhouette ───────
  // A rack alone is a grid seen from above and foreshortens to almost nothing at 58°.
  // What actually says "this is over your head" is an object hanging INTO the space
  // between the camera and the fighter. Same fixed-table discipline as `CLUTTER`, same
  // reason: the point-symmetric partner patch must be identical under 180°.
  //
  // ⚠️ THESE ARE POTS, NOT PLATES — the `h` column is a HEIGHT, and the first draft's
  // 0.14 m pucks were the bug. Seen from a 58° camera a flat disc hanging at 2.6 m and a
  // flat disc lying on the floor at 0.2 m are the same shape at nearly the same screen
  // size, so the hangers merged into the ground crockery and the overhead read vanished.
  // A pot shows its side as well as its rim, which is what makes it obviously a solid at
  // a height. They hang on the two cross bars (`u = ±0.34`) and on the centre line.
  //   [u, v, warm, r (fraction of `short`), h (m), drop (m, rack underside -> pot bottom)]
  const HANGERS: ReadonlyArray<readonly [number, number, boolean, number, number, number]> = [
    [-0.34, -0.44, true, 0.070, 0.34, HANG_MAX],
    [-0.34, 0.06, false, 0.055, 0.24, 0.30],
    [-0.34, 0.56, true, 0.062, 0.30, 0.38],
    [0.00, -0.62, false, 0.050, 0.20, 0.26],
    [0.00, -0.10, true, 0.078, 0.38, HANG_MAX],
    [0.00, 0.44, false, 0.058, 0.26, 0.32],
    [0.34, -0.50, false, 0.052, 0.22, 0.28],
    [0.34, 0.00, true, 0.066, 0.32, 0.40],
    [0.34, 0.52, true, 0.058, 0.26, 0.32],
  ];
  for (const [u, v, warm, r, h, drop] of HANGERS) {
    const x = u * (rW / 2), z = v * (rD / 2);
    const pot = puck(r * short, h, 16).translate(x, RACK_Y - drop + h / 2, z);
    (warm ? trayParts : plateParts).push(pot);
    const stemH = Math.max(0.02, drop - h);
    frameParts.push(new THREE.BoxGeometry(0.05, stemH, 0.05).translate(x, RACK_Y - stemH / 2, z));
  }

  // ── The valance — a continuous roofline, which is what a silhouette needs ───
  // The rack read as a grid; the grid read as a grid. A skirt of cloth on all four sides
  // gives the structure ONE unbroken top edge, which is the thing the eye segments an
  // object by. It hangs from the rack underside, so its lowest point is
  // `RACK_Y - VAL_DROP` — still above a standing fighter by construction.
  for (const [sx, sz, w, d] of [
    [0, valZ, rW, VAL_T],
    [0, -valZ, rW, VAL_T],
    [valX, 0, VAL_T, rD],
    [-valX, 0, VAL_T, rD],
  ] as const) {
    clothParts.push(roundedBox(w, VAL_DROP, d, 0.03).translate(sx, RACK_Y - VAL_DROP / 2, sz));
  }

  // ── FOUR DRAWS PER PATCH, EXACTLY AS BEFORE ────────────────────────────────
  // The canopy adds 36 parts — four rails, two slats, four poles, four feet, nine pots,
  // nine stems and four valance panels — and **not one new MESH**, because every part was
  // authored into one of the four material buckets that already existed. `perf.mjs
  // --mode counts` confirms it: `meshes 858` before and after, at both 2 and 6 seats.
  // `CLAUDE.md` rule 10 — draw counts are EXACT, and Uri plays on a phone that `5aa4655`
  // took from 928 draws to 423.
  //
  // ⚠️ **THAT IS NOT THE SAME AS COSTING NOTHING, AND THE MESH COUNT IS WHY IT LOOKS LIKE
  // IT IS.** Measured, `--device mobile`, the tier the phone actually gets:
  // **423 -> 431 draws (+8, +1.89%)** and **755,292 -> 773,796 triangles (+2.45%)**,
  // identical at 2 and at 6 seats. Desktop: 484 -> 494 (+10, +2.07%). The split between
  // frustum and shadow is ablated at `cloth.castShadow` below.
  const cloth = mesh(mergeGeometries(clothParts, false)!, M.concealCloth, 'conceal_cloth');
  // Still `false`, and now for a second reason. It was false because a 0.02 m linen lying
  // on the floor casts nothing; the valance merged into the same buffer DOES hang at
  // 2.47 m and would. THE SPLIT WAS MEASURED, not reasoned — `tools/perf.mjs --mode
  // counts`, desktop, `match`, on a detached worktree of `c471efe`:
  //
  //     484   before (the flat mats)
  //     486   canopy, NEITHER new mesh casting     -> +2 is pure FRUSTUM: a 3 m pole has
  //                                                   a far bigger bounding sphere than a
  //                                                   0.02 m mat, so meshes that used to
  //                                                   be culled are now in frame
  //     494   canopy, FRAME casting                -> +8, the shadow-map pass
  //     502   canopy, frame AND cloth casting      -> +8 again, for a second shadow band
  //                                                   drawn inside the first
  //
  // The frame carries the poles and the rails, and its ground shadow is most of what says
  // "this is off the floor" at 58°. The valance's is a duplicate. **8 draws for a
  // duplicate is not a trade to make on the owner's phone**, so this stays false.
  // ⚠️ `renderer.shadowMap.autoUpdate` is `false` here, which reads like "shadow casters
  // are free per frame" and is not: the map is re-rendered when the light re-focuses, and
  // `perf.mjs` attributes those draws to `0:RenderPass`. The ablation above is how that
  // was established rather than assumed.
  cloth.castShadow = false;
  g.add(cloth);
  const frame = mesh(mergeGeometries(frameParts, false)!, M.concealClothRim, 'conceal_rim');
  frame.castShadow = true;
  frame.receiveShadow = false;
  g.add(frame);
  g.add(mesh(mergeGeometries(plateParts, false)!, M.concealPlate, 'conceal_plates'));
  g.add(mesh(mergeGeometries(trayParts, false)!, M.concealTrayWarm, 'conceal_trays'));
  return g;
}
