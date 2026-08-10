/**
 * Egg (Neon).
 *
 * Built on the shared ChibiRig per `donut.ts`. The rig supplies torso, arms,
 * hands, legs, feet and all motion; this file authors:
 *
 *   - a true ovoid shell (not a sphere) — fuller/rounded at the bottom, tapering
 *     to a narrower rounded crown at top, the classic egg silhouette, and
 *     **UNCUT**: nothing this file adds leaves that outline (see the block on
 *     `RIM_PHI`)
 *   - a zigzag hatching seam right around the crown and a second jagged crack
 *     running down the character's right side — her unmistakable landmark,
 *     foreshadowing Hatch!/Shell Shards, drawn entirely ON the surface
 *   - a thin glowing seam inside that crack, the Neon-rarity accent, plus a
 *     small glossy peek of yolk at the crack's tip
 *   - open eyes: a white sclera that is the brightest value anywhere on the
 *     character, a dark pupil OFFSET for gaze, two catchlights, a dark rim, and
 *     a straight deadpan mouth with a real interior value step
 *
 * `shellPoint()`/`eggSurface()` are the one source of truth for the shell's
 * curved surface: the shell mesh is built by displacing a unit sphere through
 * `shellPoint`, and every decal (crack, eyes, brows, mouth, yolk peek) is placed
 * through the same function. That is what stops decals from floating off the
 * surface or sinking into it when the taper/bulge constants are retuned — the
 * same lesson `hamburger.ts`'s `crownSurface()` encodes for its bun dome.
 */

import * as THREE from 'three';
import { BaseCharacter, type AnimContext } from './types';
import type { CharacterDef } from '../game/rules';
import { PALETTE, RARITY_COLORS } from '../game/rules';
import { toonMat, glossyMat, flatMat, outlineGroup, roundedBox } from '../render/toon';
import { ChibiRig, taperedSegment } from './rig';
import { bodyType } from './bodies';
import { CHARACTER_HEIGHT } from '../units';
// `./appendages` is deliberately NOT imported any more. It supplied `aim`/`blade`/
// `massAnchor` for the four flanking shell shards, which are the "ears" Uri named —
// see the block above `RIM_PHI`. Re-adding that import is the first symptom of the
// same mistake being made again.

/**
 * ── NEAR-WHITE CLIPPING, and this is a measured pixel defect rather than taste ──
 * `sepscan --mode chars` reports the share of a character above luma 0.94 at the
 * shipped camera and shipped facing, and the same code over the six hand-verified
 * Brawl Stars full-body plates gives the band: **0.0072-0.0929, median 0.0249**,
 * p95 0.805-0.9685. An independent critic audit measured the same thing on gameplay
 * plates and got even less headroom — Shelly 0.2%, Barley 0.0%, with empty-floor
 * controls at 0.0%, so it is the character and not the frame.
 *
 * This character measured **36.83%** clipped and p95 **0.9789**.
 *
 * It is the cost `docs/STATE.md` records as cast-mean p95 drifting 0.896 -> 0.923
 * during the value pass, seen at the pixel: the dark rung was won (p05 is now better
 * than both plates) and the light end went with it, onto exactly the top-facing
 * surfaces a 58deg camera sees most of. The fix is albedo, and it is NOT a
 * desaturation — scaling a warm off-white DOWN raises its chroma, which is the
 * direction `docs/LESSONS.md` records as falsified four times in the other one.
 */
const SHELL = '#D8CAAB';            // was `PALETTE.egg` #FFF8EA (luma 0.973 -> 0.795).
// TWO steps, because one was not enough and the reason is this character's shape:
// egg is 93.7% head, i.e. the largest unbroken SPHERE in the cast, so it presents
// more top-facing area to a 58deg camera than anything else and clips first. At
// luma 0.830 it still measured 14.72% against a reference max of 9.29%.
// ⚠️ NOT a `PALETTE` edit: `rules.ts` is a shared file with its own owner, and
// `src/vfx/weapons/egg.ts` carries its own copy of the same hex for the projectile,
// which is a DIFFERENT subject (a small bright shard against the floor) and is left
// alone deliberately. The clipping is on this character's lid and shards.
// ── Egg was the worst character in the cast on every value axis ──────────────
// Measured (`tools/tmp/valuescan.mjs`): range 0.401 — below the reference MINIMUM —
// steps@0.10 of 4 against a reference minimum of 5, P05 0.579 against a reference
// median of 0.097, and 73.8% of its part boundary under 0.10 apart. Its figure/ground
// was simultaneously the CAST'S BEST at +0.500. That combination has one meaning:
// perfect separation from the floor, zero internal structure. A white blob.
//
// It also has almost no room to fix that. The head is 93.7% of the character, so the
// only masses big enough to carry a P05 are the shell itself — and the shell being
// near-white IS the egg. So the shell SPLITS instead: the lifted lid keeps SHELL and
// stays the light rung (it is the piece the key light actually hits), the body drops
// one step into a warm shadowed eggshell, and everything that is not shell — limbs,
// boots, hands, brow shadow — goes near-black.
//
// Measured at pot_south, shipped framing: range 0.401 -> 0.643 (over the 0.636 floor),
// steps@0.10 4 -> 6, p05 0.579 -> 0.317, figure/ground 0.486 -> 0.416 — still by far
// the cast's largest, so this spent from the one budget Egg had a surplus of.
//
// ⚠️ P05 0.317 still FAILS the <= 0.18 gate and no albedo can fix it: with 90% of the
// character being one white ovoid, 5% of its pixels cannot be made near-black without
// deleting the character. Egg needs a dark GARMENT — geometry, not colour.
// ⚠️ 0.760 -> 0.667, and it is the albedo drop above paying its own debt. Taking
// SHELL from 0.973 to 0.755 in one move put BOTH shell tones inside the same
// 0.10-wide luma bin, and `valuescan` caught it immediately: egg's step count went
// 7 -> 5 against a gate of 6. The near-white fix had quietly deleted a rung of the
// ladder the previous pass was run to build. SHELL comes back up to 0.795 and this
// one goes down, so the pair is 0.128 apart instead of 0.005.
const SHELL_BODY = '#C0A87E';       // the lower shell and the torso shell — one step down
const SHELL_SHADOW = '#A08B5C';     // mid shell tone
const BROW_SHADOW = '#6E5B33';      // the UNDERSIDE of the brow ridge. See the block at
                                     // the brow: one bar has no shadow side and reads as
                                     // a bar; a ridge is a lit top AND a dark under-edge.
const CRACK_DARK = '#0E0916';       // the crack itself — needs real value contrast against
                                     // the pale shell or it reads as a stray highlight, not a break
const YOLK = '#FFC23C';             // glossy peek at the crack tip
const NEON_ACCENT = RARITY_COLORS.Neon; // #FF2FD0 — Egg's rarity accent, used ONLY on the crack seam
const INK = PALETTE.ink;            // the eye RIM — the cast's shared ink, one value above the pupil

/**
 * 🚨 THIS FACE MAKES `valuescan --mode gate` FAIL, AND THE GATE IS WRONG. MEASURED.
 *
 * `--mode gate --ids egg`, HEAD vs HEAD+this file, both served by `headserve` so the
 * arena is byte-identical across the two:
 *
 *                              before    after
 *   weakBoundaryPct              0.0      63.8   <- the key the gate FAILS on
 *   weakBoundaryPctContact      56.3       0.0   <- the key the tool says to STEER on
 *   face|head  dL             0.1505    0.0248
 *   face|head  dLcontact      0.0594    0.1923   <- 3.24x, on 134 contacts not 98
 *   face|head  boundary luma  .809/.750  .531/.723
 *
 * The two metrics did not diverge — they SWAPPED, and only one of them is measuring
 * the thing anyone cares about. `dL` is `|p50(face) - p50(head)|`, the two parts'
 * WHOLE-PART medians. `dLcontact` is the step at the pixels where they actually
 * touch. `valuescan`'s own header says so and then says what to do about it:
 * *"Steer on the per-pair dLcontact (floor 0.0039); read weakB% as history."*
 *
 * ── AND weakB% DOES NOT MERELY MISS THIS. IT PENALISES IT BY CONSTRUCTION. ────
 * A face that has an internal value ladder — a near-white sclera AND a near-black
 * pupil AND a black throat, which is the entire brief — has a MEDIAN near the head
 * it sits on, because it straddles it. The only two ways to make `|p50(face) -
 * p50(head)|` large are to make the face almost all bright (all sclera) or almost
 * all dark (which is the defect Uri rejected by name on four characters). There is
 * no good face that satisfies this metric on this character. The old face passed it
 * precisely because it was a few pale beads whose median sat 0.15 off the shell.
 *
 * ⚠️ AND ITS RESOLUTION FLOOR HERE IS ~50 PERCENTAGE POINTS. Egg has exactly TWO
 * part pairs (`face|head` 56.3% of contacts, `head|shoulderL` 43.7%), and weakB% is
 * a contact-weighted COUNT over a hard 0.10 threshold — so it can only ever return
 * 0, 43.7, 56.3 or 100. `valuescan`'s own warning block records the same cliff on
 * pizza, where 0.0142 of luma (below what anyone can see) moved it 8.0 -> 41.0.
 * **Nothing should be tuned against this number, in either direction.**
 *
 * Every other key passed and most improved: range 0.856 -> 0.861, p05 0.078 ->
 * 0.072, steps@0.10 6 -> 6, stations with dL < 0.10 0 -> 0, invalid 0 -> 0.
 */

/**
 * ── THE FACE PALETTE, and every one of these is a MEASURED target ────────────
 *
 * `sepscan --mode chars` over the reference plates: **31.1% and 34.1% of their eye
 * pixels are above luma 0.85.** Ours were **0%** — across the whole cast, egg
 * included. A face here carried two values, orange-ish food and near-black, and the
 * largest brightest element of a real face was absent. That single number is what
 * Uri was describing on four separate characters as *"drawn lines and not an actual
 * face"*, and `rules.ts` now specifies the fix for all eleven:
 *
 *   a white SCLERA that is the brightest value anywhere on the character,
 *   a dark PUPIL offset for gaze, an explicit CATCHLIGHT, and a MOUTH with an
 *   interior value step.
 *
 * Egg is the cast REFERENCE for this (`rules.ts`, DECISIONS §40 pattern 2), so these
 * constants are copied outward — changing them changes ten other characters' target.
 */
const SCLERA = '#FFFFFF';
const PUPIL = '#0D0814';            // one step BELOW `INK`, so the pupil is the darkest
                                    // point of the eye. A pupil is a hole; if the rim
                                    // around it is darker, the eye reads as a bead.
const MOUTH_DARK = '#0C0712';       // the throat — the darkest value on the face
const MOUTH_INNER = '#54394C';      // the far wall of the throat, catching bounce.
                                    // ⚠️ THIS IS THE "INTERIOR VALUE STEP". Without a
                                    // second value inside the opening, a dark mouth is
                                    // a sticker, which is the defect named on hamburger
                                    // ("a flat dark shape with no interior value step")
                                    // and on donut ("still missing details").

/** Sclera half-width, as a fraction of the head radius. */
const EYE_WHITE_R = 0.150;
/** The dark rim behind it. The DIFFERENCE is the visible lash width — keep it above
 *  ~0.020R or the rim falls under a pixel at match distance and the eye loses its
 *  hard edge exactly where it is smallest. */
const EYE_RIM_R = 0.178;
/** Horizontal pupil offset, toward head-local -X. See the derivation at the pupil. */
const EYE_GAZE = 0.026;
// Limb-only pale-lilac family. A second independent art-director pass named Egg,
// Burrito and Lollipop as all converging on pale cream/white limbs with dark
// boots — the shell itself stays near-white (that IS the egg read), but the limbs
// shift to a soft lilac tint of her own Neon accent so the body carries real hue
// distinct from the shell, instead of reading as one undifferentiated pale mass.
// …and the limbs are where the dark rung goes. They were pale lilac — a fifth
// near-white on a character that was already four near-whites — so `head|shoulderL`
// measured 0.080 across 74 px, the largest seam on the model. Deep plum instead: the
// hue is still a tint of Egg's own Neon accent, only the value moved.
const LIMB_LILAC = '#241A38';
// PASS 3 tried this at #4A3568 to open `kneeL|footL` (0.011). MEASURED WORSE on every
// axis at once — it closed `hipL|kneeL` (0.051) and `shoulderL|elbowL` (0.069) instead,
// weak boundary 60.4% -> 70.3%, range 0.701 -> 0.653, p05 0.279 -> 0.326. Reverted.
//
// 🚨 THAT "WEAK BOUNDARY 60.4% -> 70.3%" WAS STEERING ON A NUMBER THAT MEANS NOTHING
// HERE, AND THE TOOL NOW PRINTS THE PROOF NEXT TO IT. `valuescan --mode gate` on this
// character, measured 2026-08-10 on a `headserve` HEAD tree (srcId f3a794a3f40f9fc0):
//
//   char        range   p05  steps  minDL  n<.10  weakB%  weakBc%  flip  verdict
//   egg         0.863 0.071      6  0.182      0    61.8      0.0     1  FAIL: weakBoundaryPct
//   hamburger   0.713 0.166      7  0.208      0     4.3      9.0     2  PASS
//   pizza       0.813 0.090      7  0.186      0    32.1     17.0     2  FAIL: weakBoundaryPct
//
// `weakBc%` is the IDENTICAL count computed on `dLcontact` — the step measured AT the
// boundary, which is where the contacts are counted. **Egg's is 0.0.** Not one boundary
// pair on this character is weak where it actually touches; `minDL` 0.182 clears the
// 0.15 target and is 47x the 0.0039 floor. **Egg's only gate failure is an artefact of
// comparing two whole-part MEDIANS**, and every hour spent darkening a limb tone to move
// 61.8% was spent on a statistic this character cannot fail for a real reason.
//
// The same run catches it wrong in the OTHER direction on the same day: hamburger PASSES
// at weakB% 4.3 while its contact-local count is **9.0** — more genuinely weak pairs than
// the gate can see. Steer on per-pair `dLcontact`. Read `weakB%` as history.
// Egg's limbs are ~1% of the character each; there is not enough room between the
// thigh, the shin and the boot to fit three 0.10 steps at 111 px. That is a geometry
// answer, not an albedo one.
const LIMB_LILAC_SHADOW = '#150E22';
/**
 * The cowl. Same plum family as the limbs so the costume reads as ONE garment,
 * one step darker than `LIMB_LILAC` so the limbs still separate from it where they
 * touch — the value pass's own rule that a chain has to ALTERNATE, not ramp.
 * `GARMENT_LIT` is the rolled rim, which is the piece the key light actually hits.
 *
 * ── #1A1228 -> #241A38, and the patch is narrowed: SOFTENED, not reverted ────
 * A blind critic named this garment as its second-biggest defect, unprompted and
 * without knowing it was new: *"a crushed near-black hemisphere with a hard
 * purple-rimmed edge cutting the body exactly in half"*. Rendered at match size
 * (`shots/limbmatch/before/chars/egg.yaw90.png`) that is exactly what it is — from
 * the shipped facing you are looking at the back of the head, so a patch spanning
 * 137 deg of azimuth from the crown to the equator IS half the circle.
 *
 * Reverting was the other option and it was rejected on arithmetic rather than
 * taste. `p05` is a PERCENTILE: it passes as long as 5% of the character's pixels
 * sit below luma 0.18, and the garment was covering far more than 5%. So the patch
 * can lose most of its area and lift a whole value step and still hold the gate
 * this character had no other way to pass (`p05` 0.270 -> 0.060 against <= 0.180,
 * on a head that is 93.7% of the character). Three changes, all in that direction:
 * the azimuth span 137 deg -> 101 deg, the top edge dropped off the crown
 * (`PHI_TOP` 0.16PI -> 0.30PI) so the egg's own dome stays pale and unbroken, and
 * the tone up one rung to sit WITH `LIMB_LILAC` instead of a step under it — the
 * limbs now separate from the garment by their shadow tone rather than by the
 * garment being the darkest thing on the model. Verified with
 * `valuescan --mode gate`, not assumed; the measured cost is in the report.
 */
const GARMENT = '#241A38';
const GARMENT_LIT = '#3E3157';
/**
 * Yolk-gold hands.
 *
 * ── ⚠️ #3A2408 -> #8A5A16, AND BOTH ENDS OF THIS ARE REVERSALS ──────────────
 * The wording this replaces is kept because it is still true at the end it was
 * written about:
 *
 *   > "Yolk-gold hands, deepened. At #FFC23C they were a sixth light mass."
 *
 * That was right: 0.62 of luma on a character that is already four near-whites is
 * another one, and it was correctly reversed. What went wrong is the SIZE of the
 * reversal — #3A2408 is luma **0.152**, which is not "deepened", it is a NEAR-BLACK
 * hand at the end of a near-black arm. Measured this pass, `valuescan --mode gate`
 * at the shipped station: `elbowL|handL` `dLcontact` **0.006** — the forearm and the
 * hand differ by about one 8-bit step where they meet, so the wrist does not exist.
 *
 * #8A5A16 is luma ~0.374: a full step over the 0.066 forearm, and still well under
 * the shell's own 0.42 over 93.7% of the character, so it cannot be the light mass
 * #FFC23C was — a 1%-area part at 0.374 is not competing with a 94%-area part at
 * 0.42. It is also the cast-wide grammar this file's limb note already cites
 * ("light extremities on a mid body"), which the near-black version silently opted
 * out of.
 */
const YOLK_HAND = '#8A5A16';

// ─────────────────────────────────────────────────────────────────────────────
// Shell surface — single source of truth for both the mesh and every decal.
// ─────────────────────────────────────────────────────────────────────────────

/** How sharply the crown narrows toward the top pole. */
const TOP_TAPER = 0.42;
/** How much the shell bulges below the equator — the "fuller at the bottom" read. */
const BOTTOM_BULGE = 0.16;
/** Overall vertical elongation, taller than it is wide like a real egg. Kept modest —
 * an earlier pass at 1.08 pushed idle height to 2.26m, visibly off the 2.1m cast norm. */
const VERT_SCALE = 1.04;

/** Unit direction from spherical angles. theta=0 is character-front (+Z),
 * increasing toward +X (her right). phi=0 is the top pole, phi=PI the bottom. */
function dirFromAngles(theta: number, phi: number): THREE.Vector3 {
  const s = Math.sin(phi);
  return new THREE.Vector3(s * Math.sin(theta), Math.cos(phi), s * Math.cos(theta));
}

/** Maps a unit sphere direction to the actual egg-shell point at that direction,
 * scaled to radius R. Narrows above the equator, bulges below it. */
function shellPoint(dir: THREE.Vector3, R: number): THREE.Vector3 {
  const ny = dir.y;
  const scaleXZ = ny >= 0
    ? 1 - TOP_TAPER * Math.pow(ny, 1.7)
    : 1 + BOTTOM_BULGE * Math.sin(Math.PI * Math.min(1, -ny));
  return new THREE.Vector3(dir.x * scaleXZ, ny * VERT_SCALE, dir.z * scaleXZ).multiplyScalar(R);
}

/** Exact surface point + outward normal at (theta, phi), via finite differences
 * of `shellPoint` — the curved-surface analogue of `hamburger.ts`'s crownSurface. */
function eggSurface(theta: number, phi: number, R: number): { pos: THREE.Vector3; normal: THREE.Vector3 } {
  const d = 0.015;
  const p0 = shellPoint(dirFromAngles(theta, phi), R);
  const pT = shellPoint(dirFromAngles(theta + d, phi), R);
  const pP = shellPoint(dirFromAngles(theta, phi + d), R);
  const normal = pT.clone().sub(p0).cross(pP.clone().sub(p0)).normalize();
  if (normal.dot(p0) < 0) normal.negate();
  return { pos: p0, normal };
}

/** A group flush against the shell surface at (theta, phi), pushed out along the
 * normal by `embed` so a decal sits just proud of the surface. Local +Z is the
 * outward normal — used for compact, roughly front-facing features (eyes, brow
 * creases, mouth) where the residual twist from `setFromUnitVectors` is invisible. */
function addShellDecal(parent: THREE.Object3D, theta: number, phi: number, embed: number, R: number): THREE.Group {
  const { pos, normal } = eggSurface(theta, phi, R);
  const g = new THREE.Group();
  g.position.copy(pos).addScaledVector(normal, embed);
  g.quaternion.setFromUnitVectors(new THREE.Vector3(0, 0, 1), normal);
  parent.add(g);
  return g;
}

/**
 * ── The hatching seam — ON the surface, NOT in the outline ───────────────────
 *
 * 🚨 THIS IS THE THING URI REJECTED, AND THE REASON IS RECORDED TWICE IN THIS FILE.
 *
 * > *"The **ears don't make sense**. The egg **lost the appearance of egg**. We need
 * >  to improve the face, and the shape to resemble an egg."*  — DECISIONS §40
 *
 * The shell used to be CUT in two here and the top piece LIFTED and tipped clear,
 * with four `shardBlade` plates flanking the head at the shoulder line. Every one
 * of those was added to signal *"egg"* — and between them they destroyed the one
 * thing that signalled it better. `egg.ts` said so itself, 400 lines below where
 * the lid was built:
 *
 *   > *"it broke the one thing Egg had going for it in the silhouette test, which
 *   >  is a clean ovoid."*
 *
 * That sentence was written about a **knit cap** that had already been removed for
 * exactly this reason, and then the lid and the shards did the same thing again.
 * Naming a failure mode is not avoiding it (`docs/LESSONS.md` §6b).
 *
 * ── What replaced them, and why it costs the silhouette nothing ──────────────
 * The rim is kept as the single source of truth for the sawtooth, and both halves
 * are still clamped to it — the lower shell from below, the crown cap from above —
 * so the teeth interlock exactly by construction. **The cap is now SEATED: zero
 * lift, zero tilt.** Because the two pieces clamp to the *same* `rimEdge(theta)`
 * they tile the complete ovoid, so the union's outline is a true uncut egg — this
 * is a property of the construction, not a tuned offset that can drift.
 *
 * The hatching then reads entirely as SURFACE: a value step across the sawtooth
 * (the crown cap is the light rung, the body one step down — which is also what a
 * key light does to an egg), plus a dark seam tube laid along the same rim. Both
 * are decals in the sense that matters — they change no pixel of the outline.
 *
 * ⚠️ Do not re-lift this cap, and do not put a pointed mass either side of this
 * head. FIVE characters were rejected for exactly that (burrito's foil, egg's
 * shards, hamburger's lettuce, lollipop's cape, pizza's cheese strands): a pointed
 * mass flanking a head reads as an EAR or a HORN whatever it is made of.
 */
const RIM_PHI = 0.32 * Math.PI;   // how far down the crown the seam runs
// Tooth depth. At the size a player sees a character (~95px tall, so this head is
// ~55px) a 0.075rad tooth was under two pixels and the rim read as a smooth line.
// 0.14rad is ~4px of zigzag, which is the minimum that survives.
const RIM_AMP = 0.14;
const RIM_TEETH = 7;
/**
 * How far the seam rides UP across the face and DOWN across the back, in radians.
 *
 * ⚠️ NOT decoration — it is a clearance constraint, and the constraint is new
 * because the face grew. At a level rim the sawtooth spans phi 0.865-1.145 rad, and
 * the enlarged brow creases now sit at phi 1.031 / 1.096 — INSIDE that band. The
 * seam would have run straight through both eyebrows.
 *
 * Lifting the front by 0.26 rad puts the seam's lowest tooth at the brow azimuth at
 * 0.912 rad, i.e. 0.12 rad of clear shell above the crease. It also happens to be
 * what a real crack does (a break around an egg is never a level ring) and it hands
 * the 58deg match camera MORE of the light crown value at the back, where that
 * camera sees most.
 *
 * Both shell pieces clamp to this same function, so changing it can never open a gap
 * between them — see `shellPiece`.
 */
const RIM_FRONT_LIFT = 0.26;

/** The sawtooth seam, as a function of azimuth: a triangle wave about `RIM_PHI`,
 *  tilted so it rides high across the face and low across the back. */
function rimEdge(theta: number): number {
  const u = ((theta * RIM_TEETH) / (Math.PI * 2)) % 1;
  const t = u < 0 ? u + 1 : u;
  return RIM_PHI + RIM_AMP * (4 * Math.abs(t - 0.5) - 1) - RIM_FRONT_LIFT * Math.cos(theta);
}

/**
 * A piece of eggshell: a sphere section pushed through `shellPoint`, with its
 * boundary snapped to the sawtooth rim. `side` picks which half — `'lower'`
 * clamps phi UP to the rim (the body of the egg), `'upper'` clamps it DOWN (the
 * crown cap).
 *
 * ⚠️ The two sides share `rimEdge` and are sampled at the SAME `widthSeg`, so their
 * boundary vertices coincide in theta. That is what makes the seated pair tile the
 * complete ovoid with no gap and no overlap — the silhouette guarantee is
 * structural. Changing `widthSeg` on one side only would break it silently.
 */
function shellPiece(R: number, side: 'lower' | 'upper', widthSeg = 64): THREE.BufferGeometry {
  // ⚠️ THESE MUST BRACKET THE FULL RANGE OF `rimEdge`, AND `RIM_FRONT_LIFT` BROKE THAT.
  // The clamp is one-sided per piece: the lower keeps `max(phi, edge)` over vertices
  // that only start at `phiMin`, so wherever `edge < phiMin` the lower piece cannot
  // reach up to meet the cap and the shell opens a HOLE — the ovoid guarantee is only
  // structural if the source geometry spans everywhere the seam can go. Derived from
  // the three seam constants rather than restated, so the next tweak cannot desync it.
  const phiMin = RIM_PHI - RIM_AMP - RIM_FRONT_LIFT;
  const phiMax = RIM_PHI + RIM_AMP + RIM_FRONT_LIFT;
  const geo = side === 'lower'
    ? new THREE.SphereGeometry(1, widthSeg, 40, 0, Math.PI * 2, phiMin, Math.PI - phiMin)
    : new THREE.SphereGeometry(1, widthSeg, 24, 0, Math.PI * 2, 0, phiMax);
  const pos = geo.attributes.position as THREE.BufferAttribute;
  const v = new THREE.Vector3();
  for (let i = 0; i < pos.count; i++) {
    v.fromBufferAttribute(pos, i).normalize();
    const phi = Math.acos(THREE.MathUtils.clamp(v.y, -1, 1));
    const theta = Math.atan2(v.x, v.z);
    const edge = rimEdge(theta);
    const newPhi = side === 'lower' ? Math.max(phi, edge) : Math.min(phi, edge);
    const p = shellPoint(dirFromAngles(theta, newPhi), R);
    pos.setXYZ(i, p.x, p.y, p.z);
  }
  geo.computeVertexNormals();
  return geo;
}

/**
 * A curved patch of the shell surface, pushed OUTWARD by `offset(u, v)`.
 *
 * Built from `eggSurface` rather than a THREE primitive so it hugs the ovoid
 * exactly at any taper/bulge setting — the same single-source-of-truth rule the
 * crack, the eyes and the mouth already follow. `u` runs `thetaA -> thetaB` and
 * `v` runs `phiA -> phiB` (0 = toward the crown).
 *
 * Deliberately DOUBLE-SIDED. `docs/LESSONS.md` §12: a lathe/patch whose profile
 * runs the wrong way inverts its normals and renders near-black, and it has bitten
 * six characters at once on this project. A cloth shell has no inside worth
 * defending, so the whole failure class is designed out instead of being got right.
 */
function shellPatch(
  thetaA: number, thetaB: number, phiA: number, phiB: number, R: number,
  offset: (u: number, v: number) => number,
  segT = 40, segP = 16
): THREE.BufferGeometry {
  const pos: number[] = [];
  const idx: number[] = [];
  for (let j = 0; j <= segP; j++) {
    const v = j / segP;
    const phi = phiA + (phiB - phiA) * v;
    for (let i = 0; i <= segT; i++) {
      const u = i / segT;
      const theta = thetaA + (thetaB - thetaA) * u;
      const s = eggSurface(theta, phi, R);
      const o = offset(u, v);
      pos.push(s.pos.x + s.normal.x * o, s.pos.y + s.normal.y * o, s.pos.z + s.normal.z * o);
    }
  }
  for (let j = 0; j < segP; j++) {
    for (let i = 0; i < segT; i++) {
      const a = j * (segT + 1) + i;
      const b = a + 1;
      const c = a + segT + 1;
      const d = c + 1;
      idx.push(a, c, b, b, c, d);
    }
  }
  const g = new THREE.BufferGeometry();
  g.setAttribute('position', new THREE.Float32BufferAttribute(pos, 3));
  g.setIndex(idx);
  g.computeVertexNormals();
  return g;
}

/** Path (theta, phi-as-fraction-of-PI) for the crack landmark: a short, bold
 * zigzag on the temple/cheek, well clear of the eyes (theta ±0.50) and mouth
 * (theta 0) so it reads as a distinct scar rather than crowding the face.
 *
 * Two defects compounded here. First, this originally ran theta 1.20-1.48 —
 * nearly 90° round from front (the profile edge). At that theta the surface
 * normal is almost perpendicular to the default camera, so the curved shading
 * cue that makes every other decal (eyes, brows, mouth) read as "sitting on a
 * dome" disappears: the segments render against the flat, blown-out rim-light
 * band with no surrounding shell context, which read as a stray stick floating
 * beside the head rather than a crack IN it. Second, only 3 long segments with
 * large (~0.27 rad) theta swings drew one bold "V"/lightning-bolt shape, not a
 * crack — real fractures are made of several SHORT irregular jags, not two
 * long straight strokes. Fixed both: pulled in to theta 0.66-0.86 (clearly on
 * the visible frontal dome, still outside the eyes' ±0.50 clear zone) and
 * split into 5 short segments with small (~0.12-0.18 rad) alternating jags.
 *
 * ⚠️ MOVED OUT AND DOWN THIS PASS, and BOTH axes are render-driven.
 *
 * OUT, because the eye's dark rim is 0.178R across — 0.182 rad of azimuth either
 * side of theta 0.50 at this phi — so the eye now reaches theta 0.682 and this
 * path's innermost point was 0.68. It was touching.
 *
 * DOWN, and that is the bigger one. It used to stop at phi 0.41PI, which is ABOVE
 * the eye centre (0.43PI) — so the crack's tail, its Neon segment and its yolk bead
 * all landed in the gap between the brow ridge and the eye. Rendered
 * (`shots/ch/egg/facecrop.after.png`, round 2) that is not a crack: it is a magenta
 * dash and an orange bead sitting beside an eyebrow, i.e. clutter on the one part of
 * the model that has to be read fastest. It now runs from the crown seam down PAST
 * the eye to phi 0.59PI, on the cheek — which is also simply a better crack, because
 * a fracture that starts at the seam and travels is a fracture, and a 0.3-rad stub
 * beside the eye is a scratch.
 *
 * ⚠️ AND THE FIRST ATTEMPT AT "OUT" WENT TOO FAR — 0.88-1.02, which re-committed
 * the exact failure the paragraph above this one records. `headTurn` is +0.20, so a
 * decal at theta 1.02 sits 1.22 rad = 70deg off the camera axis, not 58: the head's
 * own yaw ADDS to it on this side, and the round-3 render has the crack sliding off
 * the profile edge and the Neon tail disappearing behind her arm. The band is
 * therefore a WEDGE — wide at the top where there is nothing to avoid, tucked back
 * in below the eye where the surface is still facing the camera.
 *
 * ⚠️ EVERY THETA HERE IS +0.14 ON WHAT IT WAS, AND THE CRACK HAS NOT MOVED.
 * `stance.headTurn` went 0.20 -> 0.06 to centre the face (see the stance block); the
 * head's own yaw is ADDED to every decal's authored theta, so leaving these alone
 * would have swung the crack, its Neon segment and its yolk bead 8 degrees toward
 * the camera as a side effect of a face fix. The world azimuths are byte-identical
 * to the values this comment block was written about: 1.12, 1.20, 1.06, 1.14, 0.98,
 * 1.06 — including the 1.20 max the "went too far at 1.22" note above settled on. */
const CRACK_PATH: Array<[theta: number, phiFrac: number]> = [
  [1.06, 0.21], [1.14, 0.28], [1.00, 0.36], [1.08, 0.44], [0.92, 0.52], [1.00, 0.59],
];

/** Continuation of the crack onto the torso shell, same side (character's right
 * front), near the top where it emerges from under the neck. `eggSurface` and
 * `buildCrackLine` are both already generic in R, so this reuses them verbatim
 * against the torso's own smaller shell radius. Theta band matches the
 * repositioned `CRACK_PATH` above so the two segments read as one continuous
 * crack running from head to torso instead of jumping sideways at the neck.
 *
 * ⚠️ IT NO LONGER MATCHES `CRACK_PATH` NUMERICALLY, AND THAT IS THE POINT. These
 * are WORLD thetas because the torso is not a child of `head`; `CRACK_PATH`'s are
 * HEAD-LOCAL and the head carries `stance.headTurn`. The two paths line up when
 * `CRACK_PATH_local + headTurn ≈ TORSO_CRACK_PATH`, which is why both moved by the
 * same +0.14 when `headTurn` moved by -0.14 — one in its numbers, one not at all.
 * (Moot today: STUB gives Egg no torso, so `dressTorso` is a no-op.) */
const TORSO_CRACK_PATH: Array<[theta: number, phiFrac: number]> = [
  [0.80, 0.05], [0.68, 0.10], [0.82, 0.16],
];

/**
 * A jagged crack line: a chain of thin boxes, each built its own oriented basis
 * from the tangent between consecutive surface points and the averaged normal,
 * so every segment sits flush against the curved shell instead of floating off
 * it or clipping through it — the failure mode explicitly flagged in review.
 */
function buildCrackLine(
  head: THREE.Group,
  R: number,
  path: Array<[number, number]>,
  opts: { thickness: number; embed: number; color: string; roughness: number; emissive?: string; emissiveIntensity?: number }
): void {
  const mat = toonMat({ color: opts.color, roughness: opts.roughness, emissive: opts.emissive, emissiveIntensity: opts.emissiveIntensity });
  const pts = path.map(([theta, phiFrac]) => eggSurface(theta, phiFrac * Math.PI, R));

  for (let i = 0; i < pts.length - 1; i++) {
    const a = pts[i];
    const b = pts[i + 1];
    const mid = a.pos.clone().add(b.pos).multiplyScalar(0.5);
    const normal = a.normal.clone().add(b.normal).normalize();
    const dirVec = b.pos.clone().sub(a.pos);
    const length = dirVec.length();
    dirVec.normalize();
    const xAxis = dirVec.clone().sub(normal.clone().multiplyScalar(dirVec.dot(normal))).normalize();
    const yAxis = normal.clone().cross(xAxis).normalize();
    const quat = new THREE.Quaternion().setFromRotationMatrix(new THREE.Matrix4().makeBasis(xAxis, yAxis, normal));

    // Taper the two end segments so the crack fades rather than stopping abruptly.
    const taper = i === 0 || i === pts.length - 2 ? 0.65 : 1;
    // Kept deliberately flat (shallow Z/normal depth) — an earlier pass used a
    // near-cubic cross-section whose own proud depth was enough to bury the
    // thinner glow line laid on top of it, so the "glow" never actually showed.
    const seg = new THREE.Mesh(
      new THREE.BoxGeometry(length * 1.2, opts.thickness * taper, opts.thickness * 0.16),
      mat
    );
    seg.position.copy(mid).addScaledVector(normal, opts.embed);
    seg.quaternion.copy(quat);
    seg.userData.noOutline = true; // thin decal — an inverted-hull outline would read as a chunky sticker
    seg.castShadow = true;
    head.add(seg);
  }
}

/**
 * ── 🚨 EGG HAD THE *QUIET* HALF OF THE CAP BUG, AND A RATIO UNDER 1 HID IT ───
 * The `taperedSegment` COPY that used to sit here is gone; the function is imported
 * from `rig.ts`, which carries the mechanism once for all six files that had it —
 * this file was the THIRD independent copy, and donut's fix had reached only
 * `hamburger.ts`. **What stays is what is true of EGG.** Her call sites pass radii
 * noticeably SMALLER than `size.radius`: she is a small, delicate character and the
 * rig's default limb thickness read as too stocky for that.
 *
 * The old body emitted a straight side only when `len >= rTop + rBot`, and when it
 * did not, `yTopSafe = Math.max(...)` stacked two FULL hemispheres into a sphere
 * that pokes above its own joint origin. `tools/tmp/cb_rig.mjs` prints that test
 * and **egg never trips it** — her four bones come out at ratio 0.64-0.89, all
 * under 1. What she had instead is the QUIET half: caps of height `rBot`/`rTop` on
 * a bone barely longer than their sum leave a straight side of **11-36% of the
 * bone**, and the rest is two hemispheres. Rendered at the lobby camera
 * (`shots/cb/before/egg.png`) each limb was three dark balls on a string, which is
 * the same defect hamburger's critic called *"a chain of three separate orange
 * balls per side"* — arrived at from the other side of the same `if`.
 *
 * ⚠️ So a ratio under 1 is NOT a clean bill of health, and reading `fb9d9da`'s
 * table as one would have skipped this file. Bounding the caps by the BONE —
 * 0.42/0.30 of `len`, sum 0.72 < 1 so a straight side always exists — is the fix
 * for both halves, and it is the same code either way.
 *
 * ── AND THE CAP FRACTIONS ARE ARGUMENTS, WHICH IS THE OTHER HALF OF THE FIX ──
 * Bounding the caps by the bone still leaves every segment tapering to a POINT at
 * both ends — the profile starts at `(0, -len)`, on the axis — so the limb pinches
 * to zero width at every joint, and `outlineGroup` gives each segment its own ink
 * hull, which traces the pinch. That is a bead whatever the albedo is, and on this
 * character the albedo cannot help: all four limb tones sit between 0.04 and 0.15.
 * INTERIOR caps (the upper arm's bottom, the forearm's top, and the leg
 * equivalents) abut a segment of the same radius and are never visible, so a
 * caller passes ~0.05 for that end and the two lathes share a silhouette tangent.
 * EXTERIOR caps (shoulder, wrist, hip, ankle) keep 0.30/0.42 and stay round —
 * flattening THOSE is what turned donut's limbs into a stack of drink cans.
 */

/**
 * This character's own height, as a multiple of the cast's.
 *
 * It was the metre literal 2.02 until `CHARACTER_HEIGHT` moved. A literal here is
 * a silent opt-out of every cast-wide size decision: six of the eleven carried one,
 * so raising the cast height would have scaled five characters and left six behind.
 */
const H = CHARACTER_HEIGHT * 0.962;

export class EggCharacter extends BaseCharacter {
  private rig: ChibiRig;

  constructor(def: CharacterDef) {
    super(def);

    this.rig = new ChibiRig({
      palette: {
        limb: LIMB_LILAC,
        // Hand/foot were both pale near-whites barely a shade off the shell —
        // the exact "one undifferentiated mass" failure called out in review.
        // Hands now take the same saturated yolk used for the crack-tip peek,
        // feet take the crack's own dark caramel, so extremities carry real
        // value AND hue contrast against the shell.
        hand: YOLK_HAND,
        foot: CRACK_DARK,
        torso: SHELL,
        limbRoughness: 0.5,
      },
      // Body: STUB archetype (see `bodies.ts`) — no torso, head on the hips,
      // very short thick limbs. An egg's silhouette IS its shell; it has no
      // waist and never did, and the old body was a torso invented purely
      // because the rig insisted on one.
      //
      // `height` still sits under the 2.1m cast norm — she is the smallest
      // character — and `shoulderWidth` is a STUB hand-fit: the shell is unusually
      // wide at shoulder height (~0.96R, thanks to `BOTTOM_BULGE`), so the stock
      // 0.32H would bury the upper arms inside it.
      proportions: bodyType('stub', {
        height: H,
        // ── The arms were INSIDE the shell ──────────────────────────────────
        // Measured: at the stock STUB `shoulderFraction` of 0.12 the shoulder
        // pivot lands ~0.59 of the way down the ovoid, where `BOTTOM_BULGE`
        // widens the shell to 1.15R = 0.83m — while `shoulderWidth` was 0.61m.
        // Both arms were buried in the food mass, and a blind critic reading the
        // silhouette reported flatly that this character "has no arms". It is the
        // project's most-repeated failure (rendering, and invisible) wearing yet
        // another costume.
        //
        // Fixed on both axes: raise the pivot to the ovoid's equator, where the
        // shell is narrowest above the bulge, and widen the span past the shell
        // there. `bodies.ts` says this per-character fit is expected on STUB
        // rather than a failure of the preset — "an egg is 0.96R" is its own
        // worked example, and that figure is for the equator, not the bulge.
        shoulderFraction: 0.30,
        // Settled by measurement, not arithmetic: removing the knit cap took ~0.15m
        // off, raising the lid put some back, and `shoot.mjs --char egg` prints the
        // real bounding height. 0.71 lands at ~2.2m, inside the cast's 2.2-2.35.
        // Unchanged. STUB was given a torso this round and it measured INVISIBLE at
        // the shipped camera (`bodies.ts`, `torsoFraction`) — this character's
        // `headFraction` moved with it and moved back. Recorded because the next
        // pass will want the arithmetic: a 0.16H torso costs `2 * 0.16 / (1 + 0.95)
        // = 0.1641` of `headFraction` to keep the top of the head still, i.e.
        // 0.71 -> 0.5459. Measured `neckPinch` at the shipped facing: **0.0111**
        // against a six-plate Brawl Stars floor of 0.2449.
        headFraction: 0.71,
        // 0.44H, not 0.40H: at 0.40 the pivot cleared the shell but the upper arm's
        // INNER half was still buried, so only the hands showed. The shell is 0.753m
        // at the raised pivot height and the arm radius is 0.103m, so the span has to
        // be at least 0.856m for the whole limb to sit outside the food.
        // 0.44H -> 0.395H. The previous fix over-corrected: measured, the left arm
        // sat as its own connected component, 4,494 px of limb with background
        // between it and the shell (`shots/probe/front/egg.png` shows it plainly),
        // and its inner edge was 0.101m clear of the food. This is the far side of
        // the same window the 0.40H note below is reasoning about — the arm has to
        // OVERLAP the shell at the pivot to read as attached, not merely avoid it.
        // 0.798m puts the upper arm's inner edge inside the shell while its outer
        // edge stays proud.
        shoulderWidth: H * 0.395,
        // The shell reaches almost to the floor, so at STUB's 0.225H stance the
        // thighs and shins measured 0.000 delivery — completely inside the food.
        // Widened here rather than in the archetype because no other STUB mass is
        // this deep.
        stanceWidth: H * 0.275,
      }),
      // Timid, closed-in — elbows pulled tight against the body, shoulders barely
      // lifted, head ducked and turned away shyly. An art director's second pass
      // named the cast's identical dead-front symmetric pose as a top gap; Egg's
      // read is the cast's most defensive/withdrawn stance, distinct from every
      // other character's more open posture in this file.
      // Still timid — elbows bent, head ducked and turned away — but the arms now
      // hang CLEAR of the shell. `restPose` maps `shoulderL` onto the rotation of
      // the joint at x = -shoulderWidth, and a positive value there swings the arm
      // ACROSS the body; the old +0.06 / -0.06 pair was closing what little gap
      // there was. Negative-left / positive-right opens it.
      // Magnitudes reduced with `shoulderWidth` above: the signs stay (they are
      // what opened the arms in the first place) but -0.22 / +0.18 on a pivot that
      // was already outside the shell is what detached them.
      stance: {
        shoulderL: -0.14, shoulderR: 0.18,
        elbowL: -0.80, elbowR: -0.76,
        // ── `headTurn` 0.32 -> 0.20, and this is a SHIPPED-VIEW fix ──────────────
        // 0.32 rad is 18 degrees of yaw on a head that is 93.7% of the character,
        // and the lobby camera (`charStage.ts`, pitch 20, yaw 0) is the one Uri
        // judges. Rendered there (`shots/ch/egg/facecrop.before.png`) the far eye is
        // foreshortened to two thirds of the near one — measured, the two bright
        // sclera components come back 4738 px and 3064 px — the mouth sits off the
        // centre line, and half the face pass lands on a surface curving away from
        // the viewer. "Improve the face" and "turn the face away from the camera"
        // are in direct conflict and the face wins.
        //
        // The timidity is NOT lost, it moves: the head still turns and tilts, and
        // the pupils are now offset the OTHER way (see `EYE_GAZE`), so the read goes
        // from "looking past you" to "turned away, still watching you" — which is a
        // stronger version of the same character note, not a weaker one.
        //
        // ── ROUND 2 OF THE SAME FIX: `headTurn` 0.20 -> 0.06 ─────────────────────
        // The paragraph above took 0.32 -> 0.20 and stopped halfway, and TWO
        // INDEPENDENT BLIND CRITICS then converged, unprompted, on *"the two eyes are
        // drastically different sizes"*. They are, and this is the whole mechanism —
        // there is no second cause and nothing about the eyes themselves is
        // asymmetric. `buildFace` places them at exactly `sx * EYE_THETA`.
        //
        // The arithmetic, and it predicts BOTH complaints from one number. Total head
        // yaw is `headTurn + twist` = 0.25 rad. An eye authored at theta ±0.50
        // therefore images at +0.75 / -0.25 rad off the camera axis, so:
        //
        //   face centre   (sin 0.75 + sin -0.25) / 2  =  +0.217 of the half-width
        //                 -> the whole face sits in the RIGHT half of the ovoid,
        //                    which is the second thing found by eye at pitch 20
        //   eye width     cos 0.75 / cos 0.25 = 0.755
        //                 -> the far eye is a quarter narrower than the near one
        //
        // Measured on `shots/cx/before/egg.png`: face centre +26% of the half-width,
        // eye widths 90 px vs 105 px (ratio 0.857 — perspective magnifies the near
        // side, which is why the measured ratio is milder than the flat-projection
        // prediction). **Both complaints are one variable.** At 0.06 the same
        // arithmetic gives +0.096 and 0.886.
        //
        // Kept non-zero deliberately: a dead-square head is a mannequin, and the
        // "turned away, still watching you" read is carried by `EYE_GAZE` on the
        // pupils, which is where it belongs — a gaze offset costs the face nothing,
        // a head yaw costs it its symmetry.
        //
        // ⚠️ `CRACK_PATH` and the cowl's `T0`/`T1`/clasp thetas are all compensated
        // by +0.14 rad so their WORLD azimuth is unchanged. Without that this edit
        // would silently drag the crack, the hood edge and both clasps 8 degrees
        // around the shell, and the before/after would be measuring four changes
        // instead of one. `TORSO_CRACK_PATH` is deliberately NOT compensated: the
        // torso is not a child of `head`, so it never saw the yaw in the first place
        // and moving it would be the very drift this compensation exists to prevent.
        twist: 0.05, headTilt: 0.16, headTurn: 0.06,
        hipSway: 0.01, lean: 0.10,
        // Splay ONLY, and the stance is deliberately left alone. Egg is the one
        // character whose `stanceWidth` cannot be widened at all: measured
        // (`limbmatch --mode proto --spec plant`) it goes to TWO islands at x1.2,
        // because the shell reaches almost to the floor and moving the hip pivot
        // out takes the thigh off the only mass it can attach to. Splay moves the
        // FOOT and leaves the pivot where it is, and islands stayed at 1 all the
        // way to 0.5 rad. Hull deficiency 0.107 -> 0.1351 on splay alone.
        splay: 0.42,
      },
    });
    this.body.add(this.rig.joints.root);
    this.head = this.rig.joints.head;

    const R = this.rig.headRadius;
    const head = this.rig.joints.head;

    // ── Shell: a true ovoid, UNCUT, seamed along a sawtooth hatching rim ─────
    const shell = new THREE.Mesh(shellPiece(R, 'lower'), toonMat({ color: SHELL_BODY, roughness: 0.35 }));
    shell.name = 'egg_shell';
    shell.castShadow = true;
    shell.receiveShadow = true;
    head.add(shell);

    // ⚠️ THE YOLK FILL IS GONE, AND IT WAS 800 TRIANGLES OF NOTHING.
    // It was a hemisphere at 0.935R, visible ONLY through the gap the lifted lid
    // opened. With the cap seated there is no gap, so every one of its pixels was
    // occluded by the shell that encloses it — `docs/LESSONS.md` §1 in its cheapest
    // form, geometry that renders and cannot be seen. The warm/saturated job it was
    // doing moves to the two places that are actually ON the surface: the glossy
    // yolk peek at the crack tip and the Neon seam, both below.

    // The crown cap: the same shell surface, the same rim, SEATED — zero lift, zero
    // tilt. See the block above `RIM_PHI`. It is a separate mesh purely so it can
    // carry the light value rung; geometrically it completes the ovoid.
    const cap = new THREE.Mesh(shellPiece(R, 'upper'), toonMat({ color: SHELL, roughness: 0.35 }));
    cap.name = 'egg_shell_cap';
    cap.castShadow = true;
    cap.receiveShadow = true;
    head.add(cap);

    // ── The hatching seam: the crack, drawn along the rim, ON the surface ──────
    // A thin dark tube following `rimEdge` right round the crown. This is what turns
    // the cap/body value step from "a two-tone paint job" into "a shell coming
    // apart" — the sawtooth is only legible as a break if there is a dark line in
    // it. Closed loop, because a crack that stops halfway round reads as a hat brim,
    // which is the exact failure `taco.ts` records for its own mouth.
    //
    // `noOutline`, because an inverted-hull outline on a tube this thin doubles its
    // apparent width and turns a hairline into a chunky sticker (the same reason
    // `buildCrackLine` sets it).
    {
      const pts: THREE.Vector3[] = [];
      const N = 96;
      for (let i = 0; i < N; i++) {
        const t = (Math.PI * 2 * i) / N;
        const s = eggSurface(t, rimEdge(t), R);
        pts.push(s.pos.clone().addScaledVector(s.normal, R * 0.008));
      }
      const seam = new THREE.Mesh(
        new THREE.TubeGeometry(new THREE.CatmullRomCurve3(pts, true), 160, R * 0.017, 6, true),
        toonMat({ color: CRACK_DARK, roughness: 0.55 })
      );
      seam.name = 'egg_hatch_seam';
      seam.userData.noOutline = true;
      seam.castShadow = true;
      head.add(seam);
    }

    // ── Crack: the silhouette landmark ────────────────────────────────────────
    // Bold caramel-brown fracture line — high contrast against the pale shell,
    // the way a real cracked eggshell darkens along the break. The Neon accent
    // is deliberately NOT smeared along the whole seam (that read as a blown-out
    // glow stripe on the first pass); instead it's one small, hot ember at the
    // crack's widest gap, right where the yolk peeks through.
    buildCrackLine(head, R, CRACK_PATH, {
      thickness: R * 0.05, embed: R * 0.010, color: CRACK_DARK, roughness: 0.55,
    });
    buildCrackLine(head, R, [CRACK_PATH[4], CRACK_PATH[5]], {
      thickness: R * 0.024, embed: R * 0.017, color: NEON_ACCENT, roughness: 0.3,
      emissive: NEON_ACCENT, emissiveIntensity: 1.0,
    });

    // A glossy sliver of yolk peeking through the widest point of the crack —
    // wet where the shell is matte, and a quiet nod to Hatch!.
    const tip = CRACK_PATH[CRACK_PATH.length - 1];
    const tipSurface = eggSurface(tip[0], tip[1] * Math.PI, R);
    // 0.065R -> 0.052R and flatter. It is the last warm accent on the model now that
    // the yolk FILL is gone, so it stays — but at the old size, sitting proud of the
    // surface, it rendered as a loose orange bead rather than as wet yolk in a crack.
    const yolk = new THREE.Mesh(new THREE.SphereGeometry(R * 0.052, 12, 10), glossyMat({ color: YOLK, roughness: 0.2 }));
    yolk.scale.set(1, 1, 0.32);
    yolk.position.copy(tipSurface.pos).addScaledVector(tipSurface.normal, R * 0.003);
    yolk.quaternion.setFromUnitVectors(new THREE.Vector3(0, 0, 1), tipSurface.normal);
    yolk.userData.noOutline = true;
    head.add(yolk);

    // ── Costume: oversized scarf + knit cap ───────────────────────────────────
    // A second independent art-director pass named the total absence of any worn
    // costume/accessory layer as the cast's single biggest remaining gap. An
    // oversized scarf wound around the neck, its tails hanging past the shell's
    // own front, is the single most legible costume for a timid character: it
    // reads as "bundled up, hiding a little" and breaks the ovoid silhouette with
    // real hanging cloth. The knit cap perched near the crown is the smaller worn
    // detail, tucked well clear of the crack landmark's own theta band.
    //
    // Round 1 defect: attached to `rig.joints.neck`. Egg's head is BOTH unusually
    // large (headFraction 0.46) and bulges wider below its own equator
    // (BOTTOM_BULGE), so the shell's lowest point actually sits BELOW the neck
    // joint's own world Y — the neck is entirely swallowed inside the shell
    // volume, not in a visible gap above the torso. Anything hung off it renders
    // fully hidden. Fixed by anchoring the scarf to the SHELL's own surface via
    // `eggSurface` (the same source of truth the crack and face already use)
    // near the bottom of the head, where the bulge gives it real radius to wrap.
    const scarfMat = toonMat({ color: LIMB_LILAC, roughness: 0.6 });
    // ── The scarf, not the shell, was burying this character's legs ─────────────
    // Measured with `tools/tmp/masssit.mjs`: the wrap sat 0.627 m half-wide at the
    // HIP LINE against a 0.549 m stance, and its tassels hung all the way to
    // y = 0.022 m — the floor. The shell itself is only 0.509 m half-wide there, i.e.
    // INSIDE the stance and not the problem at all. It showed up as `hipR`
    // overlapping the mass by **1.000 at every stride phase** while delivering 0.000
    // px. The costume was burying the legs, not the egg.
    //
    // **Do not fix it by raising `scarfPhi`.** Tried and measured: `BOTTOM_BULGE`
    // peaks at ny = -0.5, i.e. phi = 0.667π, so lifting the wrap moves it to the
    // WIDEST band on the ovoid — 0.66π took the wasted-limb figure from 27.9% to
    // 55.9% and put `hipL`, `hipR` and `elbowR` all on 0.000. 0.80π is near the
    // narrowest the wrap can sit and still read as a scarf; the fix is to stop the
    // wrap and its tails being oversized THERE.
    const scarfPhi = 0.80 * Math.PI;
    const scarfPt = eggSurface(Math.PI / 2, scarfPhi, R);
    const scarfRadius = Math.hypot(scarfPt.pos.x, scarfPt.pos.z);
    const scarfY = scarfPt.pos.y;

    // 1.08 / 0.13R -> 0.96 / 0.10R: outer edge 0.63 m -> 0.51 m, inside the 0.549 m
    // stance instead of 0.078 m outside it.
    const scarfWrap = new THREE.Mesh(new THREE.TorusGeometry(scarfRadius * 0.96, R * 0.10, 10, 24), scarfMat);
    scarfWrap.name = 'egg_scarf_wrap';
    scarfWrap.rotation.x = Math.PI / 2;
    scarfWrap.position.y = scarfY;
    scarfWrap.castShadow = true;
    scarfWrap.receiveShadow = true;
    head.add(scarfWrap);

    // ── 🔴 THE TWO SCARF TAILS AND THEIR TASSELS ARE DELETED. EGG HAD SIX LIMBS. ──
    // Found by eye at the SHIPPED LOBBY CAMERA (`shots/cx/before/egg.png`, pitch 20,
    // `charStage.ts:451`) and it is not subtle: this character rendered with **two
    // arms, two legs, and two extra dark stalks hanging between the legs, each
    // ending in a ball**. In near-black plum (`LIMB_LILAC` / `LIMB_LILAC_SHADOW`,
    // the SAME family as the limbs) against a pale yellow shell, six dark
    // appendages under one round body read as a BEETLE.
    //
    // The construction is why. A `CapsuleGeometry(R*0.085, R*0.30)` is a thin
    // straight rod, a `SphereGeometry(R*0.07)` on the end of it is a ball foot, they
    // were mirrored on `sx`, and they hung from `scarfY - 0.26R` to `-0.44R` — i.e.
    // INTO the leg band, at the leg pitch, in the leg colour, in a mirrored pair.
    // Every cue that says "limb" was present; nothing said "cloth".
    //
    // ⚠️ Nobody caused this and no metric could catch it. It is identical before and
    // after the cast rebuild, and it appears in NO score: a blind critic scored this
    // character 3.5 without mentioning it, because `valuescan`, `limbmatch` and
    // `sepscan` all count pixels and value steps and **none of them counts LIMBS**.
    // `docs/LESSONS.md` §6b read backwards — the defect a human sees instantly can be
    // invisible to every instrument in the repo.
    //
    // Deleted rather than re-shaped, on `docs/DECISIONS-FOR-URI.md` §40's third
    // pattern — *"the detail added to signal the subject destroyed the silhouette
    // that signalled it better"* — which is the same finding that removed the lid and
    // the shell shards. The wrap stays: it is a single ring tucked under the shell's
    // own bulge, it reads as a collar, and it cannot be mistaken for an appendage.
    // The COWL below is the costume layer that survives at this camera.

    this.buildCowl(R);

    // ── Body: dress the torso ─────────────────────────────────────────────────
    // Two independent builder rounds both named the same gap: a themed head on a
    // generic body. Egg's body is a second, smaller shell built from the exact
    // same `shellPoint` surface as the head — literally the same ovoid language,
    // just scaled down — with the crack motif continuing a short way down onto
    // it, so the identity runs the full height of the model instead of stopping
    // dead at the neck.
    // NOTE: a no-op under the STUB archetype, which has no torso — the head
    // shell is the whole body. Kept intact because switching archetype is a
    // supported one-line fix (see `bodies.ts`) and this is Egg's body the moment
    // she has a torso again.
    this.rig.dressTorso((size) => {
      const torsoR = size.w * 0.5;
      const halfH = 1.04 * torsoR;
      const bottomY = size.h * 0.05;
      const centerY = bottomY + halfH;

      const group = new THREE.Group();
      group.name = 'egg_torso_shell_group';
      group.position.y = centerY;

      const shellGeo = new THREE.SphereGeometry(1, 28, 20);
      {
        const posAttr = shellGeo.attributes.position as THREE.BufferAttribute;
        const dir = new THREE.Vector3();
        for (let i = 0; i < posAttr.count; i++) {
          dir.fromBufferAttribute(posAttr, i).normalize();
          const p = shellPoint(dir, torsoR);
          posAttr.setXYZ(i, p.x, p.y, p.z);
        }
        shellGeo.computeVertexNormals();
      }
      const torsoShell = new THREE.Mesh(shellGeo, toonMat({ color: SHELL_BODY, roughness: 0.35 }));
      torsoShell.name = 'egg_torso_shell';
      torsoShell.castShadow = true;
      torsoShell.receiveShadow = true;
      group.add(torsoShell);

      // The crack carries on down from the neck — same helper, same colour, just
      // a shorter path against the torso's own (smaller) shell radius.
      buildCrackLine(group, torsoR, TORSO_CRACK_PATH, {
        thickness: torsoR * 0.075, embed: torsoR * 0.008, color: CRACK_DARK, roughness: 0.55,
      });

      return group;
    });

    // ── Limbs: bespoke, not the shared rig defaults ───────────────────────────
    // An independent art director named the rig's identical capsule-arm/ball-hand/
    // wedge-foot kit as the single biggest "template" tell across the whole cast.
    // Egg is small and delicate, so her limbs are noticeably thinner than the
    // rig's own default thickness, glossy porcelain like the shell; hands taper
    // to a glossy yolk-coloured teardrop (a quiet echo of the crack-tip yolk
    // peek) and feet are small dark shell-chip wedges, echoing the crack motif
    // instead of a generic block.
    const limbShellMat = toonMat({ color: LIMB_LILAC, roughness: 0.4 });
    const limbShellShadowMat = toonMat({ color: LIMB_LILAC_SHADOW, roughness: 0.42 });
    const yolkHandMat = glossyMat({ color: YOLK_HAND, roughness: 0.2 }); // deepened — see YOLK_HAND
    const crackFootMat = toonMat({ color: CRACK_DARK, roughness: 0.5 });
    // ── 🚨 THE SHELL TRIM, AND IT IS PAYING A MEASURED DEBT ─────────────────────
    // Joining the limb segments (see `dressLimbs`) fixed the bead and CREATED a
    // problem the bead was hiding. `valuescan --mode gate`, this pass, both arms
    // recomputed on frozen trees:
    //
    //   char   minDL          n<.10   weakB%        weakBc%          verdict
    //   egg    0.182 -> 0.167   0->0   61.8 -> 76.2   0.0 -> 38.1    FAIL (unchanged)
    //
    // 🚨 `weakBc%` — the CONTACT-LOCAL count, the one `3ad20e2` proved is the real
    // quantity and the one this pass was told to steer on — went from **0.0 to 38.1**.
    // ⚠️ AND THE HEADLINE NUMBER OVERSTATES IT, WHICH IS ITS OWN LESSON. Before this
    // pass egg's `adjacent` list had **two entries**; after, it has more, because four
    // separated beads per limb DO NOT TOUCH and a joined limb does. So the denominator
    // is not the same denominator: 0.0% was not "no weak boundaries", it was "almost no
    // boundaries". A metric that improves when geometry falls apart is not measuring
    // what it is being read as measuring.
    //
    // It is still a real defect: `kneeL|footL` and `hipL|kneeL` both measure **0.001**,
    // which is two 8-bit steps, i.e. the knee and the ankle do not exist. The cause is
    // this character's own recorded corner — every limb tone she owns sits between 0.043
    // and 0.152 of albedo (`LIMB_LILAC_SHADOW`'s note: *"not enough room between the
    // thigh, the shin and the boot to fit three 0.10 steps at 111 px. That is a geometry
    // answer, not an albedo one"*) — and with the beads gone there is no longer a
    // rounded highlight per segment doing the separating by accident.
    //
    // So the step is bought as a SHAPE, at exactly the two boundaries that measure zero:
    // a thin pale shell-chip band at the top of the shin and at the top of the boot. It
    // is the character's own motif rather than a new colour, it is the reference's
    // light-trim grammar, and it lands ON the contact where `dLcontact` is sampled.
    // ⚠️ It is deliberately THIN. A wide band is another segment, and another segment is
    // another bead — the defect this whole pass exists to remove.
    const shellTrimMat = toonMat({ color: SHELL_BODY, roughness: 0.42 });
    const shellTrim = (ringR: number, tubeR: number, y: number): THREE.Mesh => {
      const t = new THREE.Mesh(new THREE.TorusGeometry(ringR, tubeR, 6, 16), shellTrimMat);
      t.rotation.x = Math.PI / 2;
      t.position.y = y;
      // `noOutline`: an ink hull round a ring this small at this on-screen size is most
      // of the ring, and the trim would render as a black band — the exact inversion of
      // what it is here to do.
      t.userData.noOutline = true;
      t.castShadow = true;
      return t;
    };
    // ── 🚨 ARMS AND LEGS WERE THE SAME OBJECT, AND SHE READ AS A FOUR-LEGGED BUG ──
    //
    // The old mapping put `upperArm` and `thigh` in one `case` and `forearm` and
    // `shin` in the other — so an arm and a leg were byte-identical geometry in
    // byte-identical materials, differing ONLY in the terminal cap: a yolk teardrop
    // versus a shell chip, the two smallest elements on the character. At the lobby
    // camera that is four indistinguishable dark chains under a pale ovoid, and the
    // read is an insect. `fb9d9da` deleted two scarf tails for making it SIX of them
    // and stopped there; the four that were left are the same finding.
    //
    // The split below uses four independent cues, because any one of them can be
    // defeated by pose or by foreshortening at 58deg:
    //   1. SHAPE   the legs wear a BOOT with a shaft that climbs over the ankle and
    //              is wider than the shin inside it; the arms end in a round bulb.
    //              A boot is the single least ambiguous "this is a leg" cue there is,
    //              and it survives foreshortening at 58deg because it is a mass, not
    //              a marking.
    //   2. PROPORTION  legs are ~23% fatter than arms at every station. The rig hands
    //              this character `armRadius` 0.1253 > `legRadius` 0.1172 — arms
    //              THICKER than legs, which is backwards for every chibi reference —
    //              so the multipliers here have to overturn it, not merely differ.
    //   3. CUFF    the arms get a dark ring at the wrist and nothing else does, which
    //              is the reference's own sleeve grammar (mid sleeve, dark cuff,
    //              light glove) and is the shape that reads as CLOTHING on a limb.
    //   4. TERMINAL  a round yolk bulb wider than the wrist it grows from, against a
    //              flat wide floor-seated chip.
    //
    // ⚠️ NOT ONE ALBEDO CHANGES, AND TWO EARLIER DRAFTS THAT DID CHANGE ONE WERE
    // DISCARDED ON THIS FILE'S OWN RECORD.
    //   · Giving each limb ONE flat tone — arms all lilac, legs all shadow — reads
    //     well and would FAIL THE SHIPPED GATE: `valuescan --mode gate` steers on
    //     `minDL`, the weakest CONTACT pair, and flattening a limb takes
    //     `shoulderL|elbowL` and `hipL|kneeL` to ~0 and `minDL` with them.
    //   · Adding a third, lighter rung for the sleeve moves the forearm up to the
    //     old upper-arm tone — and `elbowL|handL` is forearm-against-`YOLK_HAND`,
    //     which is 0.086 of albedo today and 0.033 after. A cue bought by breaking a
    //     boundary is not a cue, it is a trade, and this character has no value left
    //     to trade: see `LIMB_LILAC_SHADOW` above — *"there is not enough room
    //     between the thigh, the shin and the boot to fit three 0.10 steps at 111 px.
    //     That is a geometry answer, not an albedo one."*
    // So the split is entirely geometric, and the bead is fixed geometrically too:
    // it is not caused by the value step at the joint but by the SILHOUETTE pinching
    // to zero width there — every segment tapered to a point at both ends and
    // `outlineGroup` traced the pinch. Interior cap fractions unpinch it at no cost
    // to any boundary. Keep the steps; unpinch the joint.
    this.rig.dressLimbs((part, size) => {
      switch (part) {
        case 'upperArmL': case 'upperArmR': {
          // `capBotFrac` 0.05 — this end abuts the forearm at the same radius and is
          // never visible; see `taperedSegment`'s interior/exterior cap note.
          const m = new THREE.Mesh(taperedSegment(size.len, size.radius * 0.86, size.radius * 0.70, 12, { capTopFrac: 0.30, capBotFrac: 0.05 }), limbShellMat);
          m.name = `${part}_mesh`;
          m.castShadow = true;
          m.receiveShadow = true;
          return m;
        }
        case 'forearmL': case 'forearmR': {
          // Radii are continuous across the elbow in METRES: 0.70 * 0.1253 = 0.0877
          // against 0.761 * 0.1152 = 0.0877. The rig gives the forearm a smaller base
          // radius, so equal multipliers would step the outline. That radius is
          // published as `metrics.forearmRadius` — read it, never re-type `* 0.92`.
          const g = new THREE.Group();
          const m = new THREE.Mesh(taperedSegment(size.len, size.radius * 0.761, size.radius * 0.60, 12, { capTopFrac: 0.05, capBotFrac: 0.30 }), limbShellShadowMat);
          m.name = `${part}_mesh`;
          m.castShadow = true;
          m.receiveShadow = true;
          g.add(m);
          // The cuff. `noOutline` deliberately: an ink hull around a ring this small
          // at this on-screen size is most of the ring, and it would read as a black
          // bracelet rather than as the end of a sleeve.
          const cuff = new THREE.Mesh(
            new THREE.TorusGeometry(size.radius * 0.62, size.radius * 0.13, 6, 14), limbShellShadowMat
          );
          cuff.rotation.x = Math.PI / 2;
          cuff.position.y = -size.len * 0.90;
          cuff.userData.noOutline = true;
          cuff.castShadow = true;
          g.add(cuff);
          return g;
        }
        case 'thighL': case 'thighR': {
          // 1.06 against the arm's 0.86 — and on the RIG's own radii, which run the
          // wrong way for this character (`armRadius` 0.1253 > `legRadius` 0.1172),
          // so 1.06 * 0.1172 = 0.1242 against 0.86 * 0.1253 = 0.1078: the leg ends up
          // 15% fatter in metres from a 23% gap in multipliers. The multiplier is not
          // the cue; the metre is.
          const m = new THREE.Mesh(taperedSegment(size.len, size.radius * 1.06, size.radius * 0.90, 12, { capTopFrac: 0.30, capBotFrac: 0.05 }), limbShellMat);
          m.name = `${part}_mesh`;
          m.castShadow = true;
          m.receiveShadow = true;
          return m;
        }
        case 'shinL': case 'shinR': {
          // 0.90 * 0.1172 = 0.1055 against 1.0 * 0.1055 = 0.1055.
          const g = new THREE.Group();
          const m = new THREE.Mesh(taperedSegment(size.len, size.radius * 1.0, size.radius * 0.80, 12, { capTopFrac: 0.05, capBotFrac: 0.34 }), limbShellShadowMat);
          m.name = `${part}_mesh`;
          m.castShadow = true;
          m.receiveShadow = true;
          g.add(m);
          g.add(shellTrim(size.radius * 1.02, size.radius * 0.115, -size.len * 0.07));
          return g;
        }
        case 'handL': case 'handR': {
          // 0.50 -> 0.60 of the hand radius. The forearm now ENDS at 0.50 of its own
          // radius, and a bulb the same width as the wrist it grows from is not a
          // terminal — it is more limb. It has to be visibly wider to close the arm.
          const drop = new THREE.Mesh(new THREE.SphereGeometry(size.radius * 0.6, 14, 12), yolkHandMat);
          drop.position.y = -size.radius * 0.62;
          drop.scale.set(1, 1.5, 1);
          drop.name = `${part}_mesh`;
          drop.castShadow = true;
          drop.receiveShadow = true;
          return drop;
        }
        case 'footL': case 'footR': {
          // A flattened, rounded chip rather than a cone — a cone tip reads as a
          // sharp spike once the run cycle's own foot rotation combines with a
          // static tilt (verified against a render: it looked like she was
          // standing on a dagger mid-stride). Same "broken shell fragment" idea,
          // safe under animation.
          const chip = new THREE.Mesh(
            roundedBox(size.radius * 1.7, size.len * 0.5, size.radius * 1.15, size.radius * 0.3, 3),
            crackFootMat
          );
          // Seated on the floor via `size.groundY` (the joint-local y of the world
          // ground, new on `LimbSize`) rather than by eye. `types.ts` convention #1
          // is "feet at y=0" and the whole cast was 0.08-0.25 m under it; `Math.min`
          // keeps the authored droop as the floor for the value so this can only ever
          // raise a foot, never sink one.
          chip.position.set(0, Math.max(size.groundY + size.len * 0.25, -size.len * 0.36), size.radius * 0.25);
          chip.rotation.y = Math.PI / 5;
          chip.name = `${part}_mesh`;
          // ── THE BOOT SHAFT: cue 1 of the arm/leg split ────────────────────────
          // A chip lying flat on the floor is a foot, but at the lobby camera it is
          // 12 px of a 1000 px figure and it disappears under the leg above it — so
          // it was doing none of the work of distinguishing a leg from an arm. The
          // shaft climbs BACK UP over the ankle, wider than the shin it sleeves, in
          // the same crack tone: the leg now ends in a mass instead of a dot.
          //
          // ⚠️ It is parented to the FOOT joint, not the shin, so it swings with the
          // ankle in the run cycle and cannot shear off the leg mid-stride — the
          // failure mode the chip's own comment above records for a cone tip.
          // ⚠️ And it changes no albedo: it is `crackFootMat`, the tone that was
          // already here. `kneeL|footL` is measured shin-against-foot and both sides
          // of that pair are untouched; what changes is the AREA the foot side
          // occupies, which is the term that was too small to survive at 111 px.
          const g = new THREE.Group();
          g.add(chip);
          const shaft = new THREE.Mesh(
            taperedSegment(size.len * 0.46, size.radius * 1.06, size.radius * 1.28, 12, { capTopFrac: 0.14, capBotFrac: 0.30 }),
            crackFootMat
          );
          // Hangs from the ANKLE (y = 0 in this joint's frame) down over the boot, so
          // its top is buried in the shin and its bottom meets the chip. `taperedSegment`
          // spans y in [-len, 0], so no offset is needed and none should be added: an
          // offset here is what lifts a boot off its own foot when the pose changes.
          shaft.name = `${part}_shaft`;
          shaft.castShadow = true;
          shaft.receiveShadow = true;
          g.add(shaft);
          g.add(shellTrim(size.radius * 1.14, size.radius * 0.105, -size.len * 0.07));
          chip.castShadow = true;
          chip.receiveShadow = true;
          return g;
        }
        default:
          return null;
      }
    });

    this.buildFace(R);

    outlineGroup(this.root);
    this.collectFlashTargets();
    this.rig.restPose();
  }

  /**
   * ── THE DARK GARMENT: a hood pushed back off the crown, and its cape ─────────
   *
   * Two separate measurements asked for this and neither could be answered with
   * albedo.
   *
   * 1. VALUE. `valuescan --mode gate` wants P05 <= 0.180; Egg sits at 0.279, the
   *    only character in the cast that the albedo pass could not close. The
   *    reason is arithmetic, recorded at `SHELL_BODY` above: the head is 93.7% of
   *    the character and the shell being near-white IS the egg, so the only masses
   *    left to carry a dark rung are the limbs — ~1% of the silhouette each, with
   *    no room for three 0.10 steps at 111 px. A dark rung needs AREA, and the
   *    only area available is area that does not exist yet.
   *
   * 2. SILHOUETTE. Measured in the LIVE MATCH at the match camera and the shipped
   *    spawn facing (`tools/tmp/limbmatch.mjs`), Egg is the worst-reading shape in
   *    the cast: hull deficiency **0.0986** against a floor of **0.2007** taken
   *    from the weakest of six hand-verified Brawl Stars plates, and only **4.4%**
   *    of its on-screen pixels are anything other than the food mass. Rendered and
   *    looked at, it is a pale boulder with two dark stubs under it.
   *
   * ── Why a hood, and why PUSHED BACK ────────────────────────────────────────
   * The match camera pitches **58 degrees**, so the surface it sees most of is the
   * TOP of the mass — which on this character is the crown cap, the hatching seam
   * and the face, i.e. the entire identity. Anything laid over the crown buys value by
   * deleting the character. The back hemisphere above the equator is the one large
   * area this camera sees a lot of and the design needs none of, so that is where
   * the garment goes: `theta 0.55PI .. 1.45PI`, which leaves the front 0.55PI clear
   * on both sides of the face.
   *
   * The hood STANDS OFF the shell — 0.028R at the crown opening out to 0.11R at
   * the rim — and carries a DROOPING POINT off the back of the crown. The point is
   * the silhouette half of the job and it is not decoration: measured, a hood that
   * merely hugs the ovoid moved hull deficiency 0.0986 -> 0.0992, i.e. nothing at
   * all. The outline of a sphere with a dark patch painted on it is still the
   * outline of a sphere. Only geometry that leaves the surface changes the shape.
   *
   * ── Egg already HAD a dark garment, and it delivered nothing ────────────────
   * The scarf above is `LIMB_LILAC` (#241A38, near-black) and has been since the
   * value pass. It sits at `phi 0.80PI` — near the bottom pole, where the ovoid's
   * radius has collapsed — and under a camera looking DOWN at 58 degrees it is
   * almost entirely behind the shell's own bulge. `docs/LESSONS.md` §1 for the
   * seventeenth time: the fix is not "add a dark garment", it is "put the dark
   * garment where pixels reach the screen". The scarf is kept (it is the front
   * half of the costume and reads at character-select framing) and the cowl is the
   * half that reaches the match.
   */
  /**
   * ── SILHOUETTE EVENTS — FOUR SHELL SHARDS, BUILT, MEASURED, AND NOW DELETED ──
   *
   * They are kept here in prose because the measurement that produced them was
   * correct and is still true, and the next agent asked to "fix egg's outline" will
   * otherwise rebuild them.
   *
   * WHAT THEY WERE FOR. Egg has the worst outline in the cast at both facings —
   * hull deficiency 0.0995 at the shipped facing and 0.0613 head-on, against a
   * six-plate Brawl Stars floor of 0.2007. Read the mask and there is nothing to
   * interpret: it is a disc. Four `shardBlade` plates at the EQUATOR (not the
   * crown — at the crown the hull is already generous and a drooping hood point
   * moved deficiency by 0.0003) took it to 0.1662.
   *
   * 🚨 WHY THEY ARE GONE ANYWAY, AND IT IS NOT A TASTE CALL.
   * Uri, without seeing any code: *"the ears don't make sense. The egg lost the
   * appearance of egg."* Two pointed masses either side of a head read as EARS,
   * and that read overrides what they are made of — it has now been confirmed on
   * FIVE characters (burrito's torn foil = "looks like a goat", egg's shards,
   * hamburger's lettuce, lollipop's cellophane cape = horns, pizza's cheese
   * strands = "the ears are messy"). The shards were at `azimuth ±0.50PI`, i.e.
   * exactly the two flanks, which is the worst possible placement for that read.
   *
   * ⚠️ AND THE GENERAL FORM, which is the part worth keeping: **the metric was
   * measuring a real deficit and the fix for it made the character worse.** Hull
   * deficiency asks "is this outline interesting"; it cannot ask "is this outline
   * still an egg". `docs/LESSONS.md` §6b is exactly this shape — a pass that
   * succeeds completely against a target that was not the binding constraint.
   *
   * WHERE THE OUTLINE BUDGET GOES INSTEAD. Not onto the shell. The shell IS the
   * read and every addition to it has now failed twice (knit cap, lifted lid +
   * shards). It goes to the things that are not the egg: the scarf and its tails,
   * the hood rim, the splayed legs and the arms — all of which are already here,
   * and all of which can grow without touching the ovoid. If a future pass needs
   * more, that is the direction; a fifth ornament bolted to the egg is not.
   */

  private buildCowl(R: number): void {
    const head = this.rig.joints.head;
    const cloth = toonMat({ color: GARMENT, roughness: 0.62, doubleSide: true });
    const clothLit = toonMat({ color: GARMENT_LIT, roughness: 0.58, doubleSide: true });

    // Back hemisphere only — the front stays bare, so the lid, the crack and the
    // face are untouched.
    //
    // ── SIZED BY MEASUREMENT, and the first size was a disaster ────────────────
    // Pass 1 ran the hood from `phi 0.15PI` to `0.60PI` standing 0.085R -> 0.34R
    // proud, with a scalloped cape under it down to `0.80PI`. Rendered and looked
    // at (non-negotiable #3), that is not a hood — it is a black dome that
    // swallowed the entire character, legs included. Measured at the match camera
    // and the shipped facing it made every single number WORSE: hull deficiency
    // 0.0986 -> 0.0532, wasted limb footprint 53.8% -> 89.9%, and the share of the
    // silhouette that is anything other than the food mass 4.4% -> 0.7%. A garment
    // big enough to guarantee a dark rung is big enough to BE the character.
    //
    // The working size is roughly a third of that, and the cape is gone: it was
    // the piece reaching down over the legs, which is the scarf's own recorded
    // mistake (`scarfPhi`, above) repeated one layer up.
    // Narrowed and dropped off the crown after a blind critic called the result a
    // near-black hemisphere cutting the body in half — see the note on `GARMENT`
    // for why softening rather than reverting still holds the p05 gate.
    // ⚠️ +0.14 rad on both ends, and the hood has NOT moved. `stance.headTurn` went
    // 0.20 -> 0.06 to centre the face; these are head-LOCAL azimuths, so the world
    // position of the hood's two visible profile edges is held by adding back exactly
    // what the head gave up. Was `0.72PI`/`1.28PI`.
    const T0 = 0.72 * Math.PI + 0.14;
    const T1 = 1.28 * Math.PI + 0.14;
    const PHI_TOP = 0.30 * Math.PI;
    const PHI_RIM = 0.50 * Math.PI;   // the equator — the garment never reaches the legs

    // ── The hood ──────────────────────────────────────────────────────────────
    const hood = new THREE.Mesh(
      shellPatch(T0, T1, PHI_TOP, PHI_RIM, R, (_u, v) => {
        const s = v * v * (3 - 2 * v);          // smoothstep: hugs the crown, lifts at the rim
        return R * (0.028 + 0.082 * s);
      }),
      cloth
    );
    hood.name = 'egg_hood';
    hood.castShadow = true;
    hood.receiveShadow = true;
    // Thin double-sided cloth: an inverted-hull outline on a shell with no interior
    // renders as a black slab rather than an edge.
    hood.userData.noOutline = true;
    head.add(hood);

    // ── The rolled rim ────────────────────────────────────────────────────────
    // A real tube, not a patch, so the opening has a solid edge to catch the key
    // light — and so ONE piece of this costume carries an ink outline. It stands
    // slightly PROUDER than the hood it closes, which is the whole silhouette
    // contribution: a lip on the outline instead of a smooth arc.
    {
      const pts: THREE.Vector3[] = [];
      const N = 26;
      for (let i = 0; i <= N; i++) {
        const t = T0 + (T1 - T0) * (i / N);
        const s = eggSurface(t, PHI_RIM, R);
        pts.push(s.pos.clone().addScaledVector(s.normal, R * 0.085));
      }
      const rim = new THREE.Mesh(
        new THREE.TubeGeometry(new THREE.CatmullRomCurve3(pts), 40, R * 0.042, 8, false),
        clothLit
      );
      rim.name = 'egg_hood_rim';
      rim.castShadow = true;
      rim.receiveShadow = true;
      head.add(rim);
    }

    // ── The drooping hood point: BUILT, MEASURED, REMOVED ─────────────────────
    // A tapered drooping tube off the back of the crown with a pale bobble on the
    // tip, added to buy the silhouette half of this garment's job. It moved hull
    // deficiency at the shipped facing by **0.0003** (0.0992 -> 0.0989) — nothing —
    // and rendered, from behind, as a lump in the middle of the hood. Both facts
    // are recorded here rather than the code being quietly deleted, because the
    // reason it failed is the finding: at the match camera Egg's ovoid is 1.16R
    // wide at its bulge and any addition that starts on the shell and reaches
    // 0.7R along the surface normal is still INSIDE that hull. Egg's outline
    // cannot be fixed by bolting a landmark onto the egg; it needs the egg to stop
    // being the whole character. See `tools/tmp/limbmatch.mjs` and the report.

    // ── The clasp ─────────────────────────────────────────────────────────────
    // One small saturated landmark at each end of the rim, so the garment reads as
    // WORN rather than as a shadow. Neon, because that is Egg's rarity accent and
    // the crack seam is the only other place it appears.
    for (const sx of [-1, 1] as const) {
      // +0.14 for the same `headTurn` compensation as `T0`/`T1` above. Note the sign
      // is NOT mirrored: the head's yaw is a rotation, so both clasps move the same
      // way round the shell, which is why this is `+ 0.14` and not `sx * 0.14`.
      const p = eggSurface(sx * 0.72 * Math.PI + 0.14, PHI_RIM - 0.02, R);
      const clasp = new THREE.Mesh(new THREE.SphereGeometry(R * 0.05, 12, 10), glossyMat({ color: NEON_ACCENT, roughness: 0.25 }));
      clasp.position.copy(p.pos).addScaledVector(p.normal, R * 0.085);
      clasp.name = 'egg_cowl_clasp';
      clasp.castShadow = true;
      head.add(clasp);
    }
  }

  /**
   * Open eyes with catchlights, thin shell-toned brow creases (an egg has no hair,
   * so "worry" reads as a raised ridge, not eyebrows), and a small worried mouth.
   *
   * ── Mounted on `rig.joints.face`, re-anchored at the head origin ─────────────
   * Every feature here is authored in EXACT head-local surface coordinates by
   * `eggSurface()`, so it cannot inherit `face`'s built-in forward offset (which is
   * tuned for a plain sphere and would double up against this ovoid). The offset is
   * therefore zeroed and the features are parented to `face` anyway, which is a pure
   * reparent: `face` is a direct child of `head` with an identity transform once the
   * offset is cleared, so not one vertex moves.
   *
   * It is not cosmetic. `thumbs.ts`'s character-select framing rule is FACE-AWARE —
   * it crops to the lower of the waist and a margin below the bottom of the face,
   * read from this joint — and it falls back to the whole head box when the joint is
   * empty, which is a guess. `tools/tmp/chars_metrics.mjs` likewise cannot assert a
   * face it cannot find, and four of eleven characters were outside that test.
   * Verified with `tools/tmp/facemove.mjs`: the world matrix of every mesh in the
   * model hashes identically before and after.
   */
  private buildFace(R: number): void {
    const face = this.rig.joints.face;
    face.position.set(0, 0, 0);
    const EYE_THETA = 0.50;
    const EYE_PHI = 0.43 * Math.PI;

    for (const sx of [-1, 1] as const) {
      const eye = addShellDecal(face, sx * EYE_THETA, EYE_PHI, R * 0.012, R);

      // 1. THE RIM — a dark lens BEHIND the sclera, wider than it on every axis, so
      //    a hard dark edge runs all the way round the white. This is the element
      //    that makes an eye read CRISP rather than smudged, and it is what the
      //    "flattened arc / drawn lines" characters were missing entirely: a stroke
      //    has one edge, an eye has two. `noOutline` on both this and the sclera —
      //    the rim IS the outline here, authored at a width this file controls,
      //    rather than an inverted hull at a fixed 0.004 m that would fatten the
      //    whole eye by a different fraction at every head size in the cast.
      const rim = new THREE.Mesh(new THREE.SphereGeometry(R * EYE_RIM_R, 20, 16), toonMat({ color: INK, roughness: 0.45 }));
      rim.scale.set(1, 1.13, 0.28);
      rim.userData.noOutline = true;
      rim.castShadow = true;
      eye.add(rim);

      // 2. THE SCLERA — and this is the one measurable claim in the whole face pass.
      //    Measured on the reference plates, 31.1% and 34.1% of their eye pixels are
      //    above luma 0.85. Ours were at **0%** — the cast (egg included) had a
      //    catchlight where a sclera belongs, so the largest and brightest element of
      //    a reference face was simply absent and every face carried two values.
      //
      //    ⚠️ Lit white is NOT bright white. The old sclera was `#FFFFFF` at
      //    roughness 0.3 and still measured 0% over 0.85, because this decal sits on
      //    a dome at phi 0.43PI / theta ±0.50 with its normal pointing out and
      //    sideways — the key never squares up to it. A colour cannot fix that; the
      //    surface is not facing the light. The emissive floor is what makes the
      //    value independent of where on the ovoid the eye happens to sit, and it is
      //    deliberately a FLOOR (0.34) rather than a flat unlit fill: `flatMat` would
      //    pin every sclera pixel at exactly 1.000, which is both a dead sticker and
      //    a near-white clipping problem — `sepscan --mode chars` puts the reference
      //    band for share-above-0.94 at 0.0072-0.0929, and two eyes this size are
      //    ~3.5% of this character on their own.
      const white = new THREE.Mesh(new THREE.SphereGeometry(R * EYE_WHITE_R, 20, 16), toonMat({
        color: SCLERA, roughness: 0.40, emissive: SCLERA, emissiveIntensity: 0.34,
      }));
      white.scale.set(1, 1.13, 0.42);
      white.position.z = R * 0.030;
      white.userData.noOutline = true;
      eye.add(white);

      // 3. THE PUPIL — OFFSET. `rules.ts` names this as the one part of the face
      //    standard the cast reference itself did not meet: this file set
      //    `pupil.position.x = 0`, so Egg stared dead ahead and had no gaze, and a
      //    centred pupil reads DEAD however good everything else is.
      //
      //    The direction is derived, not picked. `stance.headTurn = +0.32` rotates
      //    the head about +Y, so the world-forward axis lands at head-local
      //    (-sin 0.32, 0, cos 0.32) — i.e. toward local -X. Both pupils therefore
      //    move to -X (the SAME sign on both eyes; mirroring them would cross her
      //    eyes, which is the failure mode of copying the `sx` pattern used for the
      //    brows). The read is the character: turned shyly away, still watching you.
      const pupil = new THREE.Mesh(new THREE.SphereGeometry(R * 0.078, 16, 14), toonMat({ color: PUPIL, roughness: 0.22 }));
      pupil.position.set(-R * EYE_GAZE, -R * 0.006, R * 0.062);
      pupil.scale.set(1, 1.06, 0.50);
      pupil.userData.noOutline = true;
      eye.add(pupil);

      // 4. TWO CATCHLIGHTS, both unlit so they are the true 1.000 peak of the frame
      //    and the sclera is the broad bright MASS beneath them. A key glint high on
      //    the outer side and a small cool bounce low on the inner side — the second
      //    one is what stops the eye reading as a flat disc with a dot on it, and it
      //    is the cheapest "depth" available anywhere on this model.
      //    Both sit on the same side on BOTH eyes: a catchlight comes from a light
      //    in the world, not from a per-eye mirror.
      //
      //    🚨 THE KEY GLINT WAS EATING THE PUPIL, AND THE PUPIL READ AS A COMMA.
      //    Found by eye at 2.6x on the lobby render (`shots/cx/zoom/egg-face-*.png`):
      //    the dark of each eye is not a disc, it is a **Pac-Man** — a round pupil
      //    with a rounded bite taken out of its upper-left. At `R*0.038` against a
      //    pupil of `R*0.078` the glint was **49% of the pupil's radius**, centred
      //    `R*0.030` off its centre, so it straddled the pupil's edge and replaced a
      //    whole quadrant of it with white. A catchlight sits ON an eye; at half the
      //    pupil's size it IS the eye. Down to `R*0.024` and pulled inside the pupil's
      //    own radius, which is what makes it read as a wet highlight rather than as
      //    a notch cut in the iris.
      //    ⚠️ It is NOT a value or a colour change and no metric here can see it: the
      //    same white pixels are drawn either way, in nearly the same place. Only the
      //    SHAPE of the dark region moved, and nothing in `valuescan`, `sepscan` or
      //    `limbmatch` describes a shape. `docs/LESSONS.md` §6b read backwards.
      //
      //    🚨 ROUND 2, AND THE FIX ABOVE DID NOT LAND. THE PUPIL IS STILL A PAC-MAN.
      //    Read at 12x off the shipped lobby camera (`shots/ey/zoom/egg-Leye.png`):
      //    the bite is still there, still upper-left, still continuous with the sclera.
      //    The round above measured the right quantity and shipped a value that does
      //    not close it, and it was declared closed — **on this file, the one the other
      //    ten are being brought up to.** `tools/tmp/ey_pacman.mjs` (dark-blob solidity
      //    after hole-filling: a catchlight that sits ON the pupil is a hole and scores
      //    ~0.98, one that hangs off the rim is a notch the convex hull spans) puts
      //    egg at **L 0.8469 / R 0.9414** against pizza's 0.9527 / 0.9469.
      //
      //    ── WHY THE TANGENT-PLANE SUM UNDER-READS IT, WHICH IS THE REUSABLE PART ──
      //    The recipe copied into pizza and hotdog is "36% of the pupil radius with an
      //    18% margin", i.e. normalised centre + normalised radius <= ~0.82, computed
      //    in the eye's own tangent plane. Egg itself sits at
      //      sqrt((0.024/0.078)^2 + (0.042/0.0827)^2) + 0.024/0.078 = 0.594 + 0.308
      //      = **0.902**
      //    which passes that test and fails the render. Two terms are missing and both
      //    are in PIXELS, not in head radii:
      //
      //    1. **BLOOM.** `stage.ts` thresholds bloom at 0.80 luma and this is `flatMat`
      //       white, i.e. 1.000 by construction — the one thing in the frame guaranteed
      //       to be over the line. The glow spreads the white 2-3 px OUTWARD into the
      //       darkest neighbour it has, which is the pupil's own rim. On a pupil whose
      //       screen radius is ~13 px at lobby framing, 3 px is **0.23 of a radius** —
      //       larger than the whole 0.10 margin this construction was left with. It is
      //       also why the same recipe measures 0.95 on pizza (29 px pupils) and 0.83
      //       on hotdog (19 px): the term is absolute and the pupils are not.
      //    2. **BURIAL.** A glint whose centre sits BEHIND the pupil's front surface
      //       emerges as a cap, and the cap's centroid is pushed OUTWARD from the
      //       pupil's axis, because the pupil's surface recedes fastest away from its
      //       own apex. So burying a highlight moves it further out than it was
      //       authored. (Egg is already safe here — z 0.104R against a pupil front of
      //       0.101R, and `scale.z 0.45` makes it a lens rather than a ball — which is
      //       exactly why this file's bite is the *smallest* of the four found.)
      //
      //    So the target is not 0.82, it is **0.62**, and the lever is the OFFSET, not
      //    the radius: 0.024R of glint on 0.078R of pupil is already the smallest ratio
      //    in the cast (30.8%) and shrinking it further makes a timid catchlight rather
      //    than a whole pupil. Offset 0.024/0.042 -> 0.013/0.022:
      //      sqrt((0.013/0.078)^2 + (0.022/0.0827)^2) + 0.308 = 0.314 + 0.308 = 0.622
      //    a 38% margin, which is ~5 px of dark rim at lobby framing — more than the
      //    bloom can bridge. Nothing about the glint's SIZE, VALUE or Z changes.
      const glint = new THREE.Mesh(new THREE.SphereGeometry(R * 0.024, 10, 10), flatMat('#ffffff'));
      glint.position.set(-R * (EYE_GAZE + 0.013), R * 0.016, R * 0.104);
      glint.scale.set(1, 1, 0.45);
      glint.userData.noOutline = true;
      eye.add(glint);

      // The cool bounce moves OFF the pupil for the same reason: at `R*0.019` sitting
      // on the pupil's lower-right edge it was a lilac smudge on the iris. On the
      // sclera just clear of the pupil it does the job it was added for — a second,
      // dimmer light in the world — without carving the dark shape up.
      // ⚠️ It cleared the rim by 11% of a pupil radius (1.114 normalised) — which is
      // inside the same bloom budget the key glint just failed on, from the outside.
      // 0.060 -> 0.075 and 0.048 -> 0.056 puts it at 1.328, and it stays well inside
      // the sclera (0.622 of `EYE_WHITE_R`'s own half-width including its radius).
      const bounce = new THREE.Mesh(new THREE.SphereGeometry(R * 0.015, 8, 8), flatMat('#DCD4F0'));
      bounce.position.set(-R * (EYE_GAZE - 0.075), -R * 0.056, R * 0.098);
      bounce.scale.set(1, 1, 0.45);
      bounce.userData.noOutline = true;
      eye.add(bounce);

      // 5. Worry crease: a raised shell ridge, inner end lifted, above each eye. An
      //    egg has no hair, so worry reads as a raised RIDGE rather than as
      //    eyebrows, and `rules.ts` explicitly keeps this — including the asymmetry,
      //    which is what makes it one genuinely raised eyebrow instead of two
      //    matched worry lines.
      //
      //    ⚠️ THE OFFSETS MOVED AND HAD TO. They were `EYE_PHI - 0.205` / `- 0.135`
      //    against an eye whose angular half-height was 0.135 rad. The left crease
      //    was therefore sitting ON the eye and the right one 0.07 rad off it — it
      //    only looked correct because the eyes were small. This sclera is 0.170 rad
      //    tall, so both had to clear it: 0.32 / 0.255 keeps the same asymmetry with
      //    real air under both.
      //    ⚠️ AND IT WAS ONE BAR, WHICH RENDERED AS A GOLD STICK. Read the before
      //    plate (`shots/ch/egg/facecrop.before.png`): a single `SHELL_SHADOW` box
      //    standing 0.010R proud of a pale dome has no shadow side, so it does not
      //    read as a RIDGE at all — it reads as a small gold bar lying on the
      //    forehead, and on the turned-away side it reads as a stray splinter. A
      //    ridge is legible only as a lit top plus a dark underside, so it is now
      //    two bars: `SHELL` catching the key above, `BROW_SHADOW` tucked under it.
      //    That is one more value step on the face, which is the whole brief.
      //    🚨 AND ROUND 5 FOUND THE BROWS WERE NOT OVER THE EYES AT ALL.
      //    `shots/cx/zoom/egg-face-after.png`, read at 2.6x: the far brow floats
      //    between the two eyes, nearer the crown than to the eye it belongs to. Both
      //    old numbers pull it inboard and the ovoid multiplies the error:
      //      · `* 0.92` on theta moves it in by 7% before the surface is consulted;
      //      · 0.32 rad of phi is nearly FOUR sclera half-heights above the eye, and
      //        `shellPoint` narrows hard up there — at the eye band the surface radius
      //        factor is 0.943, at the old brow band it is 0.741.
      //    Together the brow landed at **73% of its own eye's horizontal offset**. The
      //    fix is both: bring the brow down to a brow's distance (0.21 / 0.17 rad,
      //    still asymmetric — the raised-one-eyebrow read is the character and
      //    `rules.ts` keeps it — and still clearing the 0.085 rad sclera half-height
      //    by 1.4x), and open theta to 1.14 so the narrowing is paid for rather than
      //    compounded. Derived, not eyeballed: `sin(theta_brow) = (0.943 / 0.83) *
      //    sin(0.50)` solves to 0.577 rad = 1.15 * EYE_THETA on the far side and
      //    1.11 on the near one, so one factor covers both to within 3%.
      const browPhi = EYE_PHI - (sx > 0 ? 0.21 : 0.17);
      const brow = addShellDecal(face, sx * EYE_THETA * 1.14, browPhi, R * 0.006, R);
      // (sign verified against a render: the naive -sx tilt read as angry —
      // inner end low, outer high — so this is flipped to lift the inner end.)
      //    ⚠️ AND `noOutline` IS LOAD-BEARING, not tidiness. Round 2 of this pass
      //    rendered with the default inverted-hull ink and the two bars came back as
      //    a cream PLANK lying on the forehead — the ink draws a closed contour
      //    around any proud box, which is exactly the cue that says "separate
      //    object" rather than "relief in this surface". Read
      //    `shots/ch/egg/facecrop.after.png` at the round-2 tag: it looks like a
      //    sticking plaster. Depth is down to 0.020R for the same reason.
      //    ⚠️ AND THE DARK BAR IS THE BIG ONE, WHICH IS ROUND 3 REVERSING ROUND 2.
      //    Round 2 made the lit `SHELL` bar dominant and the dark one a hairline
      //    under it, on the reasoning that a ridge is defined by its highlight.
      //    Rendered, that is a cream strip on a cream dome — a 0.10 luma step across
      //    a 0.03R-tall mark, i.e. invisible at anything but this crop. The mark that
      //    carries a brow has to be the DARK one (0.362 against the shell's 0.72,
      //    a 0.36 step) with the highlight as the thin lit top edge of the ridge.
      //    Same two pieces, same geometry, the emphasis swapped.
      //    `rim: false` because `toonMat` applies a view-dependent Fresnel rim by
      //    DEFAULT (opt-out) and `toon.ts` measures it as the largest material lever
      //    in the frame; on a bar 0.038R tall standing proud of a dome nearly every
      //    fragment is near-grazing, so the rim covers the whole mark rather than
      //    edging it. The rim belongs on masses, not on 4 px marks.
      //
      //    🚨 AND A CORRECTION, KEPT BECAUSE IT COST TWO ROUNDS.
      //    Rounds 3 and 4 each darkened this bar and I recorded both as "the render
      //    came back unchanged", concluding the albedo was being painted over. THAT
      //    WAS WRONG, and a pixel probe of the shipped frame says so: across the brow
      //    band the luma runs mean 0.386 / min 0.133 against the surrounding shell's
      //    0.707-0.733, with a 0.88 highlight along the lit top edge. It is a ridge
      //    with a 0.35 luma step and it always was after round 3.
      //
      //    What was actually unreliable was ME, reading a 2x crop: the mark is ~4 px
      //    tall at shipped size and sits inside a 0.72 field, so the surrounding
      //    value dominates the impression. `docs/LESSONS.md` §6 in its exact form —
      //    the answer changes with the scale you judge at — and the reason the rule
      //    here is "read the PNG" AND "measure it", not either one alone. Two rounds
      //    of albedo were spent on a defect that a 20-line probe showed did not exist.
      //    🚨 ROUND 5, AND IT IS A SHAPE CHANGE, NOT ANOTHER VALUE CHANGE.
      //    Two independent blind critics said, unprompted, that the mouth and brow
      //    marks *"look like flat pasted-on decals rather than sculpted features"*.
      //    Rounds 3 and 4 both read that as a VALUE complaint and both were wrong
      //    (see the correction above — the value step is 0.35 and always was).
      //    Read the render instead (`shots/cx/before/egg.png` at the lobby camera):
      //    these are `roundedBox`es, so each brow is a bar with **two straight
      //    parallel long edges and two square ends**, and a shape with square ends
      //    lying on a dome is a STICKER. Nothing in nature that is part of a face
      //    has a square end. It reads as a strip of gold tape, which is exactly the
      //    phrase both critics reached for and exactly the *"drawn lines and not an
      //    actual face"* verdict Uri gave hamburger, arriving here by a different
      //    route: hamburger's marks were too FLAT, these are too RECTANGULAR.
      //
      //    So: the same two bars, the same two colours, the same two sizes, the same
      //    tilt — as ELLIPSOIDS. A lens tapers to nothing at both ends, which is what
      //    a raised ridge in a shell actually does, and it costs no value rung, no
      //    extra mesh and nothing the rounds above measured. The scale factors are
      //    `2/PI`-corrected on the minor axis so the ellipse keeps the bar's visual
      //    mass rather than the 0.785 of it a naive swap would give.
      const tilt = sx * (sx > 0 ? 0.52 : 0.30);
      for (const [w, h, y, z, col] of [
        [0.268, 0.018, 0.022, 0.010, SHELL],
        [0.290, 0.038, -0.002, 0.004, BROW_SHADOW],
      ] as const) {
        const bar = new THREE.Mesh(
          new THREE.SphereGeometry(1, 20, 10),
          toonMat({ color: col, roughness: 0.45, rim: false })
        );
        bar.scale.set(R * w * 0.5, R * h * 0.64, R * 0.010);
        bar.position.set(0, R * y, R * z);
        bar.rotation.z = tilt;
        bar.userData.noOutline = true;
        bar.castShadow = true;
        brow.add(bar);
      }
    }

    // ── THE MOUTH: straight, deadpan, and with a real INTERIOR ─────────────────
    // `rules.ts` keeps the deadpan by name — *"it is the whole personality and
    // nothing else in the cast has it"* — so this is NOT a smile, and it is not the
    // worried "o" torus that was here either. A torus is a painted RING: the ring
    // and the shell inside it are the same distance from the camera and the same
    // number of value steps from each other as a drawn line, which is precisely the
    // *"drawn lines and not an actual face"* verdict Uri gave the character with the
    // most drawn face in the cast.
    //
    // Three pieces, and the point of all three is a VALUE STEP INSIDE the silhouette:
    //
    //   interior          near-black     flush   — the throat: it is a HOLE, and it
    //                                             is the darkest value on the face
    //   inner lip         mid plum       flush   — the far wall of that hole,
    //                                             catching a little bounce. This is
    //                                             the step that makes it an opening
    //                                             rather than a black sticker.
    //   lower lip         SHELL          proud   — the one lit edge, thin, and
    //                                             NARROWER than the opening
    //
    // ⚠️ THERE WAS A FOURTH — AN UPPER LIP RIDGE — AND IT MADE A SANDWICH.
    // A `SHELL`-toned bar above the slot, the same width as the slot, rendered as a
    // cream moustache: two pale bars with a dark gap between them read as a stack of
    // three objects, not as one opening. The top edge of the slot does not need a
    // ridge at all — it already has the shell behind it, which is a 0.60 luma step.
    // The lower lip stays because that IS where a lit edge belongs (the key is
    // above, so the underside of an opening is what catches it) and it is now
    // narrower than the slot so it cannot bracket it.
    //
    // Dropped from phi 0.505PI to 0.525PI: the sclera is now 0.170 rad tall instead
    // of 0.135, and at the old spacing the face was crowded into the top third of a
    // head that is 93.7% of the character.
    //
    // 🚨 ROUND 2 — THREE STACKED BARS ARE A STRIP OF TAPE, WHATEVER THEY ARE MADE OF.
    // The three pieces above are correct in VALUE and were wrong in SHAPE, and the
    // render says so plainly at the lobby camera (`shots/cx/before/egg.png`): a black
    // rectangle, a thin plum rectangle and a cream rectangle, **all three the same
    // length, all three with square ends, stacked**. That is not an opening, it is
    // three parallel stripes — and the file's own note above already caught the
    // identical failure from the other side ("a `SHELL`-toned bar ABOVE the slot
    // rendered as a cream moustache… two pale bars with a dark gap read as a stack of
    // three objects"). The upper bar was removed and the lower one, which does the
    // same thing from below, was kept. Both critics who called the face *"flat
    // pasted-on decals"* were looking at this.
    //
    // The rebuild keeps all three VALUES and all three ROLES and changes only the
    // outline each one presents:
    //   • every piece is an ELLIPSOID, so the mouth's corners taper the way a real
    //     opening's do instead of terminating in a 90-degree corner;
    //   • the inner lip is pushed UP into the throat so only its lower crescent
    //     shows — it is now the far wall seen THROUGH the opening rather than a
    //     stripe drawn under it, which is the thing the value step was always for;
    //   • the lit lower lip is 52% of the throat's width instead of 78%, so it can
    //     no longer bracket the slot; it is a highlight on the middle of the lower
    //     edge, which is where a key above the head actually lands.
    const mouth = addShellDecal(face, 0, 0.525 * Math.PI, R * 0.004, R);

    /** An ellipsoid decal: tapered at both ends, flattened into the shell. */
    const lens = (hw: number, hh: number, hd: number, color: string, rough: number) => {
      const m = new THREE.Mesh(new THREE.SphereGeometry(1, 24, 12), toonMat({ color, roughness: rough }));
      m.scale.set(R * hw, R * hh, R * hd);
      m.userData.noOutline = true;
      return m;
    };

    const throat = lens(0.140, 0.042, 0.013, MOUTH_DARK, 0.62);
    mouth.add(throat);

    const innerLip = lens(0.104, 0.023, 0.014, MOUTH_INNER, 0.55);
    innerLip.position.set(0, -R * 0.017, R * 0.002);
    mouth.add(innerLip);

    const lowerLip = lens(0.073, 0.011, 0.012, SHELL, 0.42);
    lowerLip.position.set(0, -R * 0.043, R * 0.008);
    lowerLip.castShadow = true;
    mouth.add(lowerLip);
  }

  protected onUpdate(ctx: AnimContext): void {
    this.rig.animate({
      elapsed: this.elapsed,
      move01: ctx.moveSpeed01,
      attack01: this.attackT >= 0 ? this.attackT / this.attackDuration : -1,
      hit01: this.hitT >= 0 ? this.hitT / 0.26 : -1,
      dead01: this.deathT >= 0 ? this.deathT / 0.75 : -1,
    });
  }

  /** The rig owns all body motion; the base class's whole-body pass would fight it. */
  protected applyBaseMotion(): void {}
}
