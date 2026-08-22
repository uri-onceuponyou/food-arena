/**
 * Burrito (Rare).
 *
 * Built on the shared ChibiRig — see `donut.ts` for the reference implementation of
 * this pattern. The rig supplies torso, arms, hands, legs, feet and all motion; this
 * file authors only the food mass on `rig.joints.head`, the face and a palette.
 *
 * Identity is fixed by `rules.ts`: Burrito, Rare rarity, Burrito Disc / Roll Stun /
 * Topping Swarm. The written description ("white wrap, stands upright, toppings
 * visible at the open end") is treated as a personality guide rather than a literal
 * spec, per the brief — but "open end with visible fillings" IS kept as the
 * silhouette landmark: a standing tortilla tube, cut open at the top, with a mound of
 * rice/meat/veg fillings spilling out. Read from the game's steeply pitched-down
 * camera, an UP-facing opening is far more legible than a forward-facing one would be,
 * so unlike Donut's hole (which faces +Z) this one faces +Y.
 *
 * The head+torso loop replaced the old decorated-barrel torso with a continuation of
 * the SAME tube (see `dressTorso`): head and torso are now one uncut ~2.5:1 vertical
 * cylinder, which is the one proportion nothing else in the cast has, with a torn foil
 * sleeve flared back over its lower half as the costume/silhouette break.
 *
 * ─────────────────────────────────────────────────────────────────────────────
 * ── THE GOAT PASS, 2026-08-06 — and FOUR of the five mechanisms were invisible
 *    to every number in this repo until somebody shot the LOBBY camera. ────────
 *
 * Uri, blind to the code: *"looks a bit like a GOAT. Face is not good."* `DECISIONS`
 * §39 worked out three of the causes by reading this file — torn foil peaks as EARS,
 * LANKY as animal proportions, pale cream as FUR, a small low face as a MUZZLE — and
 * explicitly warned that the per-part instrument **cannot** see a gestalt error
 * because isolation removes the information needed to detect one.
 *
 * Then `305d813` established that this project ships TWO cameras and that the lobby's
 * **20 degrees** (`charStage.ts:451`) is where Uri actually looks, while `limbmatch`,
 * `sepscan`, `valuescan` and the per-part pass all measure the match's **58**. Shot at
 * 20 degrees (`tools/tmp/ch_burrito_shots.mjs`), this character showed three further
 * defects that no metric on this project had ever reported, and two of them are worse
 * than the ears:
 *
 *  1. 🚨 **THE HEAD AND TORSO WERE NOT ONE TUBE. They were a blob on a stick.**
 *     `dressTorso` capped its own radius at `shoulderWidth - armRadius * 1.28`, and a
 *     later arm-clearance pass cut `shoulderWidth` from 0.135H to 0.105H. That cap
 *     therefore *shrank with the fix*: it floored out on `R * 0.34` = 0.139 m against a
 *     head tube of 0.238 m, so the torso was **59% of the head's width**. The doc
 *     comment below has claimed "one uncut ~2.5:1 vertical cylinder" the whole time
 *     and the render is a 1.1:1 barrel on a straw — which is the "pill with a waist"
 *     this file says it FIXED, silently reintroduced from the other end.
 *  2. 🚨 **THE ARMS WERE VISIBLY DETACHED**, with background between shoulder and body
 *     at 20 degrees. Same root cause: the arm's inner edge sat 0.006 m inside a 0.139 m
 *     tube, i.e. tangent. At 58 degrees foreshortening hides it completely — exactly
 *     what `305d813` predicts, and the reason a fix must be verified at BOTH pitches.
 *  3. 🚨 **THE FILLINGS READ AS A SECOND FACE.** At 58 degrees the mound is the top of
 *     the character, and two dark `MEAT` SPHERES (0.55R across, on a pale rice dome)
 *     sat side by side on it. Two dark round masses on a light ground **are eyes**, and
 *     with the foil peels flanking them the whole crown read as an animal's head. This
 *     is finding 4's rule ("a pointed mass either side of a head reads as an ear")
 *     generalised: **a SYMMETRIC PAIR of anything, at the top of a mass, recruits the
 *     mass into a face.** It is the fillings — the character's own identity landmark —
 *     doing it.
 *
 * And the foil is finding 5 (*"detail added to signal the subject can destroy the
 * silhouette that signalled it better"*) in its purest form on this cast. The head foil
 * sleeve, its six torn cone tabs and the three peeled corners were all added to say
 * "burrito". Rendered, they say: two silver EARS at ±X on the crown, and a zigzag row
 * of white triangles across the character's middle that reads as TEETH. All three
 * groups are removed here. What is left — a long tortilla tube, a fold seam, an open
 * top spilling filling, and a foil sleeve with a paper band at the waist — is both the
 * more recognisable burrito image and the one that keeps the outline.
 *
 * ⚠️ NOTHING IN `rules.ts` OR IN THIS FILE IS FROZEN (Uri, 2026-08-06). Where a written
 * description was producing a bad character the description is changed and said so.
 */

import * as THREE from 'three';
import { BaseCharacter, type AnimContext } from './types';
import type { CharacterDef } from '../game/rules';
import { PALETTE } from '../game/rules';
import { toonMat, glossyMat, flatMat, outlineCharacter } from '../render/toon';
import { ChibiRig, taperedSegment } from './rig';
import { bodyType } from './bodies';
import { CHARACTER_HEIGHT } from '../units';
import { aim, blade as peelBlade, localBounds, massAnchor } from './appendages';

// ── Palette ──────────────────────────────────────────────────────────────────
/**
 * ── NEAR-WHITE CLIPPING, and this is a measured pixel defect rather than taste ──
 * `sepscan --mode chars` reports the share of a character above luma 0.94 at the
 * shipped camera and shipped facing, and the same code over the six hand-verified
 * Brawl Stars full-body plates gives the band: **0.0072-0.0929, median 0.0249**,
 * p95 0.805-0.9685. An independent critic audit measured the same thing on gameplay
 * plates and got even less headroom — Shelly 0.2%, Barley 0.0%, with empty-floor
 * controls at 0.0%, so it is the character and not the frame.
 *
 * This character measured **11.44%** clipped and p95 **0.9647**.
 *
 * It is the cost `docs/STATE.md` records as cast-mean p95 drifting 0.896 -> 0.923
 * during the value pass, seen at the pixel: the dark rung was won (p05 is now better
 * than both plates) and the light end went with it, onto exactly the top-facing
 * surfaces a 58deg camera sees most of. The fix is albedo, and it is NOT a
 * desaturation — scaling a warm off-white DOWN raises its chroma, which is the
 * direction `docs/LESSONS.md` records as falsified four times in the other one.
 */
// ── PALE CREAM READS AS FUR, AND THAT IS ONE QUARTER OF THE GOAT ─────────────
// WAS: TORTILLA '#DFD2B9' — HSL(39.5, 37.5%, 80%) — and `DECISIONS` §39 names it in
// as many words: *"`TORTILLA #DFD2B9`, pale cream | authored as flour wrap | reads as
// FUR."* A cream so pale it has almost no hue left is the surface of an animal, not of
// a griddled flatbread, and it is 44% of this character's pixels.
//
// #E5C795 is HSL(37.5, 61%, 74%): **+24 pp saturation, -6 pp lightness, hue held.**
// Three things follow and all three are wanted:
//   • it stops reading as fur, because fur is not chromatic and a toasted tortilla is;
//   • ⚠️ it is a SATURATION INCREASE, which is the only direction `docs/LESSONS.md`
//     allows — "do not fix anything by desaturating" is falsified four times over, and
//     the frame is measured UNDER-chromatic (meanSat 0.324 vs the reference's 0.493);
//   • it pays down this file's own recorded near-white defect below. Scaling a warm
//     off-white DOWN raises its chroma, which is the same move `soup.ts` is briefed to
//     make on its bowl for the same reason.
// TORTILLA_SHADE was '#E4CFA0', which is *lighter than TORTILLA in two channels* — a
// "shade" that never shaded anything. #C99C5B is a real toast tone, luma 0.63 against
// the wrap's 0.79, so the rim, the seam and the brow creases now carry a value step.
const TORTILLA = '#E5C795';        // griddled flour wrap
const TORTILLA_SHADE = '#C99C5B';  // genuine toast/shadow tone — brow creases, lower lip
// ── AND A SECOND, MUCH QUIETER STEP, BECAUSE ONE STEP WAS DOING TWO JOBS ─────
// The first version of this pass used TORTILLA_SHADE for the rim, the fold seam AND the
// scorch spots, and the render says that is one step too big for all three: the rim read
// as an ORANGE HEADBAND, the seam as a row of orange dashes running down through the
// left eye, and the two visible scorch spots as BLOTCHES on the cheeks — three separate
// "somebody drew on this character" reads off one colour. #D9B075 is luma 0.708 against
// the wrap's 0.791: an 0.08 step, which is a griddle mark. TORTILLA_SHADE's 0.63 is an
// 0.16 step, which is a stripe. The strong step is kept only where a FEATURE needs to be
// read as a feature — the brow creases and the lower lip.
const TORTILLA_TOAST = '#D9B075';  // scorch spots, the cut rim, the fold seam
const WRAP_BAND = '#6A1C0C';       // paper wrapper band + hands — see THE DARK RUNG below
// Foil. Warm-NEUTRAL silver rather than either extreme, and the value is the
// load-bearing part: a first pass warmed this to #EFEBE0 to keep the character in
// the cast's warm half, and at that value it landed within 4% of the tortilla it
// wraps — the whole sleeve rendered, and was invisible, against the mass behind it.
// This is ~22% darker than TORTILLA. The scene is deliberately high-key and the
// contrast pass compresses the top end, so a gap that looks generous in the hex
// arrives much smaller on screen — measured by rendering, not by reading the values.
const FOIL = '#C4C0B5';
const BOOT = '#180E05';            // near-black toasted-tortilla boots, grounds the pale body
// WAS '#E6D8BC' (itself down from `PALETTE.cream` #FFF3DE, luma 0.957 -> 0.850). With the
// wrap darkened to a real tortilla the rice became the LIGHTEST large mass on the
// character by a clear margin, and the render says exactly what that costs: a smooth
// pale dome on a warm cone reads as SOFT-SERVE ICE CREAM, sprinkles and all. #E3CFA4 is
// luma 0.816 against the wrap's 0.791 — still lighter, as cooked rice is against a
// griddled tortilla, but no longer a different material. The rest of that read is
// COVERAGE, handled by the piece table below.
const RICE = '#E3CFA4';
// ── THE DARK RUNG ────────────────────────────────────────────────────────────
// Measured against 18 Brawl Stars plates: their P05 is 0.097 and every one of the
// eighteen puts 5% of the character below 0.18. Burrito's was 0.285, and 53.3% of its
// part boundaries measured under 0.10 apart — the arm chain almost entirely
// (`elbowL|handL` 0.011 across 22 px, `elbowL|hipL` 0.028 across 35 px, `torso|handR`
// 0.043 across 38 px). One character, four masses, all within a third of a stop.
//
// The tortilla and the rice are the light rung and do not move — they are 44% of the
// character and they are already at the reference's light end. The FILLING is where
// the dark rung goes: meat, boots, wrapper band and the lower limb tone. That is 9.7%
// + 4.7% + 5.8% of the pixels, which is what a P05 costs in AREA. Measured at
// pot_south, shipped framing: range 0.678 -> 0.799, p05 0.291 -> 0.169, fg 0.304 -> 0.251.
//
// Local, not `PALETTE.patty` / `pattyDark` / `tomato`: those three are shared with
// Hamburger and Taco, `rules.ts` is not this file's to edit, and the right value for a
// filling depends on the wrap it is sitting in.
const MEAT = '#241205';
const MEAT_DARK = '#140A03';
const TOMATO = '#7A1620';
const CHEESE = PALETTE.cheese;
const LETTUCE = PALETTE.lettuce;
// WAS '#EAE4D6' (luma 0.992 -> 0.893). Taken down one step for a reason that is new to
// this file: the SCLERA has to be the brightest value ANYWHERE on the character
// (`rules.ts`'s face standard), and a glossy near-white blob with a specular on it is
// the one thing that can out-bright a lit white sphere. Two small pixels are not worth
// costing the face its whole job.
const SOUR_CREAM = '#E2D9C4';
// ── The face's own values, and the one thing this character's ground makes hard ──
// `rules.ts` burrito: *"the wrap is TORTILLA, a pale cream — so an off-white sclera
// will dissolve into it. The sclera must be genuinely WHITE and carry a strong dark
// lash/lid line to hold its edge against a low-contrast ground; this is the one
// character where the eye needs a drawn boundary to survive its own background."*
// Both halves are built: `SCLERA` is pure white on a LIT material (so it takes the key
// and becomes the top of the character's value ladder) and every eye carries an ink
// lid arc over its top and outer corner.
const SCLERA = '#FFFFFF';
const MOUTH_THROAT = '#1E0803';    // the interior value step — darker than the lip ink
const MOUTH_TONGUE = '#C4514F';    // the third value inside the mouth, so it is an opening
// Limb-only avocado-green family. A second independent art-director pass named
// Burrito, Egg and Lollipop as all converging on pale cream/white LIMBS with dark
// boots — the wrap itself stays this pale tortilla tone (that's the food read for
// the head/torso), but the arms and legs shift to a fresh guac-green so the body
// no longer reads as another undifferentiated cream mass.
const LIMB_AVOCADO = '#3E5A1C';
const LIMB_AVOCADO_DARK = '#16220A';
// ── The ARM's own rung, and it exists to make an arm not be a leg ────────────
// Both limb pairs used to share `LIMB_AVOCADO` over `LIMB_AVOCADO_DARK`, so the
// four chains were the same object four times (see `dressLimbs`). The fix is a
// third rung and, more importantly, a DIRECTION: the arm now runs
// 0.462 -> 0.312 -> 0.753 (foil mitt) and the leg runs 0.312 -> 0.117 -> 0.056
// (boot), so one chain brightens toward its terminal and the other darkens.
// Opposite directions survive shading in a way a single value gap does not — the
// key can flatten a gap, it cannot reverse an order.
const LIMB_AVOCADO_LIGHT = '#5E8430';  // upper arm — fresh guac, luma 0.462

type Spot = readonly [angleDeg: number, radiusFrac: number];

/**
 * ── BURRITO'S OWN `taperedSegment` NOTE — the copy is gone, the finding is not ──
 * The `taperedSegment` COPY that used to sit here is gone; the function is imported
 * from `rig.ts`, which carries the mechanism (bone-bounded caps, profile winding,
 * interior/exterior caps) once for all six files that had it. Burrito's call sites
 * keep top/bottom radii close together — a rolled tortilla is close to a true
 * cylinder, not a tapered dough limb.
 *
 * ⚠️ THE CAP BUG NEVER FIRED ON THIS CHARACTER, and that is worth keeping. Measured
 * on LANKY's own numbers at `H = 2.0496` — the archetype `bodies.ts` calls "the one
 * that was already right", i.e. the only one whose segments are longer than thick:
 *
 *   segment      len       rTop+rBot   side?
 *   upper arm   0.3216      0.1681     yes
 *   forearm     0.2933      0.1448     yes
 *   thigh       0.3354      0.1807     yes
 *   shin        0.2744      0.1523     yes
 *
 * **Four for four, and the clamps are all inactive** (`len * 0.42` and `len * 0.30`
 * both exceed the radii), so the cap fix was a no-op on burrito's delivered geometry
 * and so is this migration.
 *
 * 🚨 SO THE BEAD-CHAIN READ ON THIS CHARACTER IS **NOT** THIS FUNCTION, AND SAYING
 * IT WAS WOULD HAVE CLOSED THE WRONG BUG. `shots/ca/before/burrito.png` shows four
 * chains of green pills separated by fat crimson rings; the rings are the
 * `WRAP_BAND` cuff torus that `dressLimbs` hangs at the TOP of every forearm and
 * shin — a joint-height band on a two-segment chain is a bead separator by
 * construction. That is fixed where it lives, in the call sites below.
 *
 * `rise` extends the mesh ABOVE its own joint origin so a top segment can start
 * inside the mass it hangs from.
 */

/**
 * A group sitting flush on the wrap's TRUE surface, with local **+Z along the outward
 * normal** and local +Y along the tube's own up direction — this character's answer to
 * `egg.ts`'s `addShellDecal`, which `rules.ts` names as the pattern for the whole cast.
 *
 * ── Why every feature has to share one frame ─────────────────────────────────
 * `rules.ts`'s face standard: *"NOTHING FLOATS. Every feature sits ON a surface,
 * sharing one tangent frame with its neighbours."* Burrito's body is a bulged cylinder,
 * so a feature placed at a guessed constant depth only matches the surface at one
 * height and one azimuth: the rig's own `face` offset (a flat `headRadius * 0.82`) sits
 * ~0.09R proud of this tube wherever it is not dead centre, and the previous face
 * dodged that with a per-feature `surfaceZ * 0.9`-style fudge that is a different fudge
 * for every feature. One frame, solved against `wrapRadiusAt`, removes the whole class.
 *
 * ── ⚠️ AND NOT `setFromUnitVectors`, WHICH IS A NAMED TRAP ────────────────────
 * `docs/LESSONS.md` §12: it picks the SHORTEST arc between two vectors and therefore
 * leaves a **different residual roll on each side** — the recorded cause of Sushi
 * reading as having a LAZY EYE, and `rules.ts` calls it out again in sushi's own spec.
 * The basis here is explicit: +Y is world-up projected into the tangent plane, +X is
 * +Y x +Z. Both eyes get the same roll by construction rather than by luck.
 *
 * The normal is the true normal of a surface of revolution — radial 1, axial -dr/dy —
 * sampled numerically off the very same `radiusAt` the geometry was built from, so a
 * change to the bulge cannot leave the decals behind.
 */
function tubeFrame(
  parent: THREE.Object3D,
  radiusAt: (y: number) => number,
  span: number,
  azimuth: number,
  y: number,
  embed: number,
): THREE.Group {
  const r = radiusAt(y);
  const sa = Math.sin(azimuth);
  const ca = Math.cos(azimuth);
  const h = span * 1e-3;
  const dr = (radiusAt(y + h) - radiusAt(y - h)) / (2 * h);
  const n = new THREE.Vector3(sa, -dr, ca).normalize();
  const g = new THREE.Group();
  g.position.set(sa * r, y, ca * r).addScaledVector(n, embed);
  const up = new THREE.Vector3(0, 1, 0).addScaledVector(n, -n.y).normalize();
  const right = new THREE.Vector3().crossVectors(up, n).normalize();
  g.quaternion.setFromRotationMatrix(new THREE.Matrix4().makeBasis(right, up, n));
  parent.add(g);
  return g;
}

/**
 * This character's own height, as a multiple of the cast's.
 *
 * It was the metre literal 2.05 until `CHARACTER_HEIGHT` moved. A literal here is
 * a silent opt-out of every cast-wide size decision: six of the eleven carried one,
 * so raising the cast height would have scaled five characters and left six behind.
 */
const H = CHARACTER_HEIGHT * 0.976;

export class BurritoCharacter extends BaseCharacter {
  private rig: ChibiRig;
  private toppings: THREE.Object3D[] = [];
  private toppingBaseRotZ: number[] = [];
  /** Head-local Y and radius where the food tube ends, so `dressTorso` can
   *  continue the SAME tube downward instead of guessing at a matching size. */
  private headTubeBottomY = 0;
  private headTubeBottomR = 0;

  constructor(def: CharacterDef) {
    super(def);

    this.rig = new ChibiRig({
      palette: {
        limb: LIMB_AVOCADO,
        hand: WRAP_BAND,
        foot: BOOT,
        torso: TORTILLA_SHADE,
        limbRoughness: 0.78,
      },
      // Body: LANKY archetype (see `bodies.ts`) — tall narrow torso, long thin
      // limbs, narrow stance. A burrito is a long vertical tube, so the archetype
      // IS the character's shape rather than a compromise with it.
      //
      // This replaces a hand-tuned `height: 2.35`, which was buying "tall" the
      // only way the old rig allowed: limb length was a fixed fraction of height,
      // so scaling the whole character was the sole route to longer legs. LANKY
      // has real `legFraction`/`armFraction` knobs, so height goes back near the
      // 2.1m cast norm and the tall read comes from proportion instead of size.
      // `shoulderWidth` is nudged out from LANKY's own 0.145H to 0.163H for one
      // measured reason: the food tube now runs the full height (see `dressTorso`)
      // and `bodies.ts` caps a torso's half-width below the shoulder pivot or the
      // arms sink into the mass. At the stock width the tube had to neck in to
      // 0.192m through the torso against 0.238m at the head, and that 20% step
      // rendered as a cone, not a roll. Everything else is stock LANKY.
      // ── The arms had gone all the way through the window and out the far side ─
      // `docs/STATE.md` Finding 7: the fix for a buried limb overshoots into a
      // DETACHED one, and Burrito is the clearest case in the cast. Its arms
      // delivered 0.93-1.01 of their own footprint — which reads as a triumph
      // until you measure WHY: an ID-buffer render (`tools/tmp/islands.mjs`) shows
      // both arms as their own connected components, 7,619 px and 7,454 px of limb
      // with visible background between them and the tortilla. Nothing was
      // occluding them because nothing was touching them.
      //
      // 0.163H -> 0.135H. The wrap is 0.239m half-wide at shoulder height and the
      // pivot sat at 0.340m with an 0.086m arm radius, so the arm's INNER edge was
      // still 0.015m clear of the body. 0.277m puts that inner edge inside the
      // wrap and leaves the outer edge proud of it — the straddle, not either edge
      // of the window.
      proportions: bodyType('lanky', {
        height: H,
        // ── WAS 0.105H, AND THE NOTE BELOW IT WAS SOLVING THE RIGHT PROBLEM AGAINST
        //    THE WRONG BODY. Kept verbatim because the reasoning is still correct: ──
        //
        //   "0.135H -> 0.115H. LANKY's torso is 0.167H wide, i.e. 0.171 m half-width,
        //    and at 0.135H the arm's INNER edge sat at 0.189 m — outside the only mass
        //    it can attach to. At the rearward extreme of the run the whole left arm
        //    became its own connected component, 10,060 px. 0.115H puts the inner edge
        //    at 0.148 m, inside the torso, while the outer edge is still 0.153 m proud
        //    of it."  (then 0.115H -> 0.105H by the same argument)
        //
        // ⚠️ **"LANKY's torso" is not the mass this character has.** `dressTorso()`
        // below REPLACES the rig's barrel with this file's own tube — so the pass above
        // narrowed the shoulders to reach a torso that is not there, and the tube it
        // should have been measured against then narrowed WITH it, because that tube's
        // cap was written as `shoulderWidth - armRadius * 1.28`. Two knobs chasing each
        // other down: 0.135H -> 0.105H shoulders, 0.238 m -> 0.139 m tube, and at
        // 20 degrees the arms are detached anyway (measured, `shots/ch/burrito/before`).
        //
        // Solved as one relationship instead, in metres, on LANKY's actual numbers
        // (R = 0.20H by construction: headFraction 0.40, halved):
        //
        //   tube half-width  = headTubeBottomR = 0.58R          = 0.116 H
        //   armRadius        = 0.040 H
        //   shoulderWidth    = tube + armRadius * 0.55          = 0.138 H
        //
        // which is the STRADDLE this file has always said it wanted and never had:
        // the arm's inner edge lands 0.55 of an arm-radius INSIDE the tube (attached),
        // its axis sits outside the surface (not buried), and its outer edge stands
        // 0.127 m proud (visible in outline). `dressTorso` derives the tube's cap from
        // this same expression, so the two can no longer drift apart.
        // ⚠️ It also stays clear of `bodies.ts`'s explicit warning — the tube's
        // half-width (0.116H) does NOT reach the shoulder pivot (0.138H).
        //
        // ── 🚨 0.138H -> 0.1177H, BECAUSE `R = 0.20H` ABOVE IS WRONG ─────────────
        // The relationship is right and it was solved against a head radius this rig
        // does not build. `rig.ts:602` subtracts the neck gap from the head before
        // halving it —
        //
        //     headH = height * headFraction - (2 * neckGap) / (1 + headMount)
        //           = 2.0496 * 0.40 - (2 * 0.1332) / 1.86 = 0.6766
        //     R     = headH * 0.5 = 0.3383,  NOT 0.20H = 0.4099
        //
        // — a 17.5% error, and every metre figure in the note above inherits it. The
        // tube is `0.58R` = **0.196 m**, not the 0.238 m claimed, so
        // `shoulderWidth - armRadius * 0.55` = 0.238 m was not "exactly
        // `headTubeBottomR`" and the `min` in `dressTorso` was not a tie: it was
        // 21% clear of the mass on the far side of it, i.e. the shoulder pivot sat
        // 0.087 m outside a tube it was supposed to straddle.
        //
        // Measured on a frozen HEAD before this change (`tools/tmp/ca_geom.mjs`,
        // which walks the joint tree and interpolates the body's half-width along
        // every triangle edge crossing the arm's own height):
        //
        //     side  worldY   bodyHalf  armInner   overlap
        //       L   1.1111    0.2019    0.2221    -0.0202     <- background between
        //       L   0.9838    0.1993    0.2221    -0.0228        arm and body
        //       R   1.1203    0.2021    0.2083    -0.0062
        //       R   0.9933    0.1995    0.2083    -0.0088
        //
        // **Both arms detached, and asymmetrically** (the stance is asymmetric), which
        // is exactly what `shots/ca/before/burrito.png` shows at the lobby camera and
        // what 58 degrees of foreshortening hides. `0.1177H` = `0.58R + armRadius *
        // 0.55` evaluated on the REAL R, so `dressTorso`'s cap now genuinely ties to
        // `headTubeBottomR` and head and torso are one tube for the first time.
        // ⚠️ The tube's half-width (0.0958H) still does not reach the pivot
        // (0.1177H), so `bodies.ts`'s warning is still respected — by 0.55 of an arm
        // radius, which is what the relationship above says it should be.
        shoulderWidth: H * 0.1177,
        // 0.062H -> 0.087H. LANKY's stance is narrow on purpose — "the whole figure
        // reads as a vertical line" — and a vertical line is exactly the outline
        // this pass exists to break. Still the second-narrowest in the cast, so the
        // archetype's read survives; the splay above does most of the work.
        stanceWidth: H * 0.087,
      }),
      // Arms held CLEAR of the body, with a deliberate asymmetry.
      //
      // The signs are the fix, not the magnitudes. `restPose()` sets
      // `shoulderL.rotation.z = stance.shoulderL`, and `shoulderL` is the joint at
      // x = -shoulderWidth; a POSITIVE z-rotation there swings the elbow toward +X,
      // i.e. across the body. The old 0.62 / -0.60 pair was commented as "both arms
      // swing wide" and was doing the exact opposite — pinning both arms against the
      // tube. A blind critic reading the silhouette named the result directly: no
      // arm-to-body negative space anywhere, so the outline is one solid slab.
      // Negative-left / positive-right opens them.
      // Magnitudes cut hard for the same reason as `shoulderWidth` above: these
      // signs are correct (negative-left / positive-right opens the arms outward)
      // and were the right fix for the original burial, but -0.26 / +0.19 on top
      // of an already-wide pivot is what pushed the hands 0.27m clear of the body.
      stance: {
        shoulderL: -0.04, shoulderR: 0.03,
        // ── ELBOWS OPENED TO PAY BACK WHAT THE SHOULDER FIX COST THE OUTLINE ──
        // Narrowing `shoulderWidth` to attach the arms (see the derivation above)
        // moved both hands inboard, and `limbmatch --mode chars --yaws 90` says what
        // that costs at the MATCH camera: hull deficiency 0.2074 -> 0.1856 and
        // **appendages 2 -> 0** — the hands had been the only two masses breaking
        // this character's hull at that facing, and tucking them in deleted both.
        //
        // `restPose()` puts the stance's elbow value on rotation.**X**, i.e. a
        // FORE-AFT swing. That is the one axis this trade is free on: the arm's
        // attachment is decided at the shoulder, 0.32 m above the elbow, so nothing
        // here can re-open the gap; and at the lobby's yaw 0 a fore-aft swing is
        // almost entirely depth, so nothing here disturbs the front read either.
        // -0.34/-0.20 -> -0.52/-0.36.
        elbowL: -0.52, elbowR: -0.36,
        twist: -0.04, headTilt: 0.03, headTurn: 0.08,
        hipSway: 0.02, lean: -0.05,
        // The largest single response in the cast: hull deficiency 0.178 -> 0.2189
        // at splay 0.5 at the shipped facing and 0.1451 -> 0.2894 head-on, both
        // from the splay alone, both with islands at 1. A tube on two narrow legs
        // has more to gain from the legs leaving the tube's shadow than anything
        // else here does.
        splay: 0.46,
      },
    });
    this.body.add(this.rig.joints.root);
    this.head = this.rig.joints.head;

    const R = this.rig.headRadius;
    const head = this.rig.joints.head;

    // ── Food mass: an upright rolled tortilla, cut open at the top ───────────
    // A barrel-bulged cylinder rather than a straight tube — real burritos bulge
    // where they're stuffed. Built by displacing a plain CylinderGeometry's vertices
    // radially, the same technique rig.ts uses for the torso taper.
    // Round 1 of the head+torso loop: the silhouette test called this a "generic
    // blob", and the measured reason was proportion, not detail. The old tube was
    // 1.35R tall by 1.39R wide — a barrel, i.e. as wide as it is tall — sitting on
    // a separate tapered-sphere torso, so the outline read as a pill with a waist.
    // A burrito's ONE non-negotiable property is that it is a long tube, so the
    // mass now runs uncut from the fillings down to the hips (see `dressTorso`,
    // which replaces the rig's barrel with a continuation of this same tube) and
    // the tube tapers UP — narrow at the folded base, fat at the stuffed open end,
    // which is what a real burrito does and what a plain cylinder never reads as.
    const botR = R * 0.58;
    const topR = R * 0.64;
    const bodyBottomY = -R * 1.00;
    const bodyTopY = R * 0.50;
    this.headTubeBottomY = bodyBottomY;
    this.headTubeBottomR = botR;
    const bodyH = bodyTopY - bodyBottomY;
    const bulgeAmt = 0.12;

    const wrapGeo = new THREE.CylinderGeometry(topR, botR, bodyH, 28, 8, false);
    {
      const pos = wrapGeo.attributes.position as THREE.BufferAttribute;
      for (let i = 0; i < pos.count; i++) {
        const gy = pos.getY(i);
        const t = gy / bodyH + 0.5; // 0 bottom .. 1 top
        const bulge = 1 + bulgeAmt * Math.sin(t * Math.PI);
        pos.setX(i, pos.getX(i) * bulge);
        pos.setZ(i, pos.getZ(i) * bulge);
      }
      wrapGeo.computeVertexNormals();
    }
    const wrap = new THREE.Mesh(wrapGeo, toonMat({ color: TORTILLA, roughness: 0.8 }));
    wrap.name = 'burrito_wrap';
    wrap.position.y = (bodyBottomY + bodyTopY) / 2;
    wrap.castShadow = true;
    wrap.receiveShadow = true;
    head.add(wrap);

    // Exact radius of the wrap's outer surface at a given head-local Y — mirrors the
    // bulge loop above exactly, so anything placed against "the surface" (the face,
    // decals) is solved against the real equation rather than a guessed constant.
    // This is the fix for the "decals floating above / buried inside the surface"
    // failure mode: a flat guess only ever matches the surface at one specific point.
    const wrapRadiusAt = (y: number): number => {
      const t = THREE.MathUtils.clamp((y - bodyBottomY) / bodyH, 0, 1);
      const base = THREE.MathUtils.lerp(botR, topR, t);
      return base * (1 + bulgeAmt * Math.sin(t * Math.PI));
    };
    // (A `surfaceZ(x, y)` helper lived here and is gone with the face that used it. It
    // gave a POSITION on the surface and nothing else, so every feature also carried a
    // hand-picked `* 0.9`-ish factor to fake the depth and had no orientation at all —
    // which is why the old eyes sat flat-on while the tube curved away underneath them.
    // `tubeFrame()` returns a full tangent frame from the same `wrapRadiusAt`, so
    // position, depth and orientation come out of one solve.)

    // ── Open top: rim + a mound of fillings spilling out ──────────────────────
    // Faces +Y (up), not +Z — under this game's steeply pitched-down camera an
    // up-facing opening reads far better than a forward-facing one across every yaw
    // angle, which is exactly what the 4-angle screenshot review checks for.
    //
    // The whole opening is CUT ON A SLANT. A tube capped by a level dome is
    // symmetric in outline, and a symmetric outline is what the silhouette test
    // called a blob; a slanted cut gives the top an unmistakable diagonal — the
    // shape of a wrap sliced open — and it costs one group rotation. Everything
    // below is authored in the opening's own frame (origin at the cut), so the
    // rim, the mound and every topping tilt together and stay welded to each other.
    const openEnd = new THREE.Group();
    openEnd.name = 'burrito_open_end';
    openEnd.position.y = bodyTopY;
    // WAS -0.30. The slant is kept — it is what stops the top reading as a level cap —
    // but it was costing the FACE. Solved rather than eyeballed: at the eye's own
    // azimuth the tilted rim's underside sat at +0.269R, and the face this pass builds
    // is deliberately large and HIGH (`rules.ts`: *"a small face low on a long narrow
    // head reads as a MUZZLE, and that is half of why Uri said 'looks a bit like a
    // goat'"*), with its sclera reaching +0.26R. -0.22 lifts the rim's underside there
    // to +0.299R and buys the clearance out of the one part of the shape nobody reads.
    openEnd.rotation.z = -0.22;
    openEnd.rotation.x = 0.10;
    head.add(openEnd);
    // The rim is now the tube's WIDEST point (1.02x the wall, plus its own tube
    // thickness) rather than tucked inside it at 0.92x. Round-1 silhouette read:
    // the open end has to be the landmark, and a rim narrower than the wall it
    // caps cannot be seen at all in outline — it just continues the cylinder.
    const rim = new THREE.Mesh(
      // Tube down from R * 0.075, and off TORTILLA_SHADE: at the old size and value this
      // rim rendered as a thick ORANGE HEADBAND round a pale dome, which is most of why
      // the crown read as a cupcake. It is the tortilla's own CUT EDGE — the one thing it
      // must not look like is a separate object put on top.
      new THREE.TorusGeometry(topR * 1.02, R * 0.058, 10, 28),
      toonMat({ color: TORTILLA_TOAST, roughness: 0.8 })
    );
    rim.name = 'burrito_rim';
    rim.rotation.x = -Math.PI / 2; // torus hole (default +Z) now points +Y
    rim.castShadow = true;
    rim.receiveShadow = true;
    openEnd.add(rim);

    // Overstuffed on purpose: the mound is now WIDER than the tube that holds it
    // (1.04x the wall radius) and sits a little higher, so the fillings bulge out
    // past the rim and break the tube's outline instead of hiding inside it. This
    // is the whole reason for the open end — an opening you cannot see the edge of
    // is not a landmark.
    const domeCenterY = R * 0.05; // openEnd-local: the group already sits at bodyTopY
    const domeR = topR * 1.04;
    const mound = new THREE.Mesh(
      // A dome cap (theta 0..~0.48π from the +Y pole) rather than a full sphere —
      // just the top bulge, like donut's proud-glaze trick.
      new THREE.SphereGeometry(domeR, 24, 12, 0, Math.PI * 2, 0, Math.PI * 0.48),
      toonMat({ color: RICE, roughness: 0.62 })
    );
    mound.name = 'burrito_rice';
    mound.position.y = domeCenterY;
    mound.castShadow = true;
    mound.receiveShadow = true;
    openEnd.add(mound);

    // Toppings seated ON the dome — each position solved against the dome's own
    // sphere equation (y = domeCenterY + sqrt(domeR^2 - r^2)) rather than eyeballed,
    // same fix as the wrap surface above.
    const meatMat = toonMat({ color: MEAT, roughness: 0.55 });
    const meatDarkMat = toonMat({ color: MEAT_DARK, roughness: 0.5 });
    const tomatoMat = glossyMat({ rim: true, color: TOMATO, roughness: 0.2 });
    const cheeseMat = glossyMat({ rim: true, color: CHEESE, roughness: 0.3 });
    const lettuceMat = toonMat({ color: LETTUCE, roughness: 0.6 });
    const creamMat = glossyMat({ rim: true, color: SOUR_CREAM, roughness: 0.15 });

    const placeOnDome = (
      spot: Spot,
      geo: THREE.BufferGeometry,
      mat: THREE.Material,
      name: string
    ): THREE.Mesh => {
      const a = THREE.MathUtils.degToRad(spot[0]);
      const r = spot[1] * domeR;
      const y = domeCenterY + Math.sqrt(Math.max(0, domeR * domeR - r * r)) * 0.96;
      const m = new THREE.Mesh(geo, mat);
      m.name = name;
      m.position.set(Math.cos(a) * r, y, Math.sin(a) * r);
      m.rotation.set(0.3, a, 0);
      m.castShadow = true;
      m.receiveShadow = true;
      openEnd.add(m);
      this.toppings.push(m);
      this.toppingBaseRotZ.push(m.rotation.z);
      return m;
    };

    // Sized up from round 1, where sparse small toppings left the pale rice mound
    // dominant and the whole thing read as ice-cream-with-sprinkles rather than a
    // packed burrito filling.
    //
    // Round 3 defect: each topping type had its own block of angles (all the meat
    // clustered in 0-150 deg, etc). From the front camera that meant one whole TYPE
    // dominated the visible half of the dome — a solid clump of meat with the cheese,
    // tomato and lettuce hidden behind/under it — rather than a mixed filling. Fixed
    // by interleaving all four types round-robin around the full circle, so every
    // angular slice the camera can see has a mix, never a monotone clump. Sizes also
    // trimmed down so adjacent pieces don't overlap into a single blob.
    // Sized up again in the head+torso round. A character is ~95px tall at shipped
    // framing, so this whole mound is ~14px across — pieces below ~0.16R simply do
    // not survive to the screen, and the "packed filling" read has to come from a
    // few big saturated lumps rather than many small ones.
    // ── SHAPES, and this is taco's finding applied to a different character ───
    // WAS: meat a `SphereGeometry(R * 0.25)` scaled to 0.55R across, tomato a cube,
    // cheese a 6-sided cone, lettuce a capsule. `DECISIONS` §39 records the same defect
    // on taco — *"'looks like fruit' is a SHAPE problem, not a colour one: the fillings
    // are authored correctly and built as SPHERES and RINGS, and spheres read as
    // berries. Real fillings are shredded, diced, crumbled. Change the shapes, keep the
    // palette."* Burrito's spheres were doing something worse than berries (see finding
    // 3 in the header): near-black, round, 0.55R across, and one on each side of a pale
    // dome — a pair of EYES, which turned the whole crown into an animal's head at the
    // match camera. Diced now, and smaller: a cube with visible facets cannot be a
    // pupil. Cheese likewise goes from a cone (a spike) to a flat shred.
    const meatGeo = new THREE.BoxGeometry(R * 0.26, R * 0.19, R * 0.24);
    const tomatoGeo = new THREE.BoxGeometry(R * 0.20, R * 0.20, R * 0.20);
    const cheeseGeo = new THREE.BoxGeometry(R * 0.34, R * 0.055, R * 0.11);
    const lettuceGeo = new THREE.CapsuleGeometry(R * 0.075, R * 0.26, 4, 6);
    const creamGeo = new THREE.SphereGeometry(R * 0.115, 10, 8);

    // ── AUTHORED, NOT GENERATED, AND THAT IS THE FIX ─────────────────────────
    // WAS: `deg = (i / 8) * 360 + jitter`, kinds assigned round-robin `i % 4`. A
    // round-robin over four kinds at an even eight-step **puts the same kind at +X and
    // -X by construction** — meat landed at 0 deg and 182 deg, i.e. screen-left and
    // screen-right, at matched height. That is a mirrored pair, and finding 4's rule
    // ("a pointed mass either side of a head reads as an ear") has a general form this
    // file had to learn the expensive way: **a SYMMETRIC PAIR of anything, near the top
    // of a mass, recruits that mass into a face.** The generator could not avoid it,
    // because evenness was the whole thing it was written to guarantee.
    //
    // Three rules, all checkable by reading the table rather than by rendering it:
    //   1. the three dark MEAT pieces sit at 62 / 176 / 290 deg. The mirror of an
    //      azimuth about the screen's vertical is `180 - deg`, so the forbidden
    //      partners are 118 / 4 / 250 — no meat is within 58 deg of any of them.
    //   2. no kind repeats within 58 deg of a mirrored azimuth (checked for all four).
    //   3. every radius differs, so nothing sits at a matching height on the dome
    //      either — the second half of what makes two blobs read as a pair.
    //
    // Twelve, not nine. The render of the nine-piece version still read as ICE CREAM,
    // and the missing half of that was never colour: a smooth pale dome showing between
    // widely spaced lumps is a scoop with sprinkles on it whatever the lumps are. Three
    // more (44 / 122 / 268) close the gaps to ~20 deg, which at r ~ 0.7 is about one
    // piece-width — packed, with the lump-and-gap rhythm the earlier round wanted, and
    // still inside every rule above (the three meats are untouched at 62 / 176 / 290).
    const PIECES = [
      ['tomato', 24, 0.38], ['cheese', 44, 0.72], ['meat', 62, 0.62],
      ['cheese', 104, 0.94], ['tomato', 122, 0.66], ['lettuce', 142, 0.30],
      ['meat', 176, 0.86], ['tomato', 214, 0.50], ['cheese', 250, 0.34],
      ['lettuce', 268, 0.78], ['meat', 290, 0.44], ['lettuce', 330, 0.90],
    ] as const satisfies readonly (readonly [kind: string, deg: number, rFrac: number])[];
    const creamSpots: Spot[] = [[46, 0.18], [252, 0.22]];

    PIECES.forEach(([kind, deg, rFrac], i) => {
      const spot: Spot = [deg, rFrac];
      switch (kind) {
        case 'meat': {
          const m = placeOnDome(spot, meatGeo, i % 2 === 0 ? meatDarkMat : meatMat, 'burrito_meat');
          // A per-piece tumble, so three cubes off the same geometry never present the
          // same face to the camera and cannot average into one shape.
          m.rotation.x += 0.42 * (i % 3) - 0.3;
          m.rotation.z += 0.55 - 0.31 * (i % 4);
          break;
        }
        case 'tomato': {
          const m = placeOnDome(spot, tomatoGeo, tomatoMat, 'burrito_tomato');
          m.rotation.z += 0.4;
          m.rotation.x += 0.25 * (i % 3);
          break;
        }
        case 'cheese': {
          const m = placeOnDome(spot, cheeseGeo, cheeseMat, 'burrito_cheese');
          m.rotation.y += 0.7 - 0.25 * (i % 3); // shreds lie across the mound, not radially
          m.rotation.z += 0.18;
          break;
        }
        default: {
          const m = placeOnDome(spot, lettuceGeo, lettuceMat, 'burrito_lettuce');
          m.rotation.x += Math.PI / 2; // lay along the surface rather than poking straight up
          break;
        }
      }
    });
    creamSpots.forEach((s) => {
      const m = placeOnDome(s, creamGeo, creamMat, 'burrito_cream');
      m.scale.set(1, 0.5, 1);
    });
    // ⚠️ A LATENT BUG, FOUND WHILE ADDING THE TUMBLES ABOVE, AND IT IS TWO ROUNDS OLD.
    // `placeOnDome` records `toppingBaseRotZ` at CREATION time — before the caller
    // adjusts anything — and `onUpdate()` then assigns `rotation.z = base + wobble`
    // every frame. So the old `tomato.rotation.z = 0.4` was reset to 0 by the first
    // animated frame and no tomato has ever been tilted in motion; it only ever looked
    // right in a `t=0` screenshot, which is exactly what every review capture is.
    // Re-reading the rest roll here is the whole fix, and it has to happen AFTER the
    // per-piece rotations rather than inside the placement helper.
    this.toppingBaseRotZ = this.toppings.map((t) => t.rotation.z);

    // ── The fold seam ────────────────────────────────────────────────────────
    // A rolled tortilla has one overlapping edge running its whole length. Without
    // it the tube is a machined cylinder, which a blind critic named exactly ("an
    // untapered straight cylinder... reads as a rolled towel"). Placed off-centre so
    // it does not sit behind the face, and solved against `wrapRadiusAt` so it hugs
    // the bulge instead of floating off it at one height and sinking at another.
    {
      const seamMat = toonMat({ color: TORTILLA_TOAST, roughness: 0.82 });
      // WAS -0.85 rad (-48.7 deg), commented "to her right of the face, still on the
      // visible front". Solved against the face this pass builds, it is not: the eye sits
      // at -29.5 deg and spans to -44 deg, and the seam DRIFTS +0.30 rad as it climbs, so
      // its top end lands at -32 deg — inside the eye. The render shows a column of orange
      // dashes running down through the left eye like a zip. -1.45 rad (-83 deg) puts the
      // overlap on the tube's side where a rolled edge actually sits, and it still catches
      // the key from three of the four review yaws.
      // (-1.45 first, then -1.25: at -83 deg the seam sat ON the silhouette edge and its
      // seven separate lumps read as a row of stitches down the outline. -71.6 deg puts
      // it back on the lit surface, still 10 deg clear of the eye's outer corner at
      // -44 deg once the +0.30 rad climb-drift is counted.)
      const seamTheta = -1.25;
      // 7 -> 10 -> 18, and the LENGTH comes down with the count. The 10-lump version
      // reasoned from spacing alone (0.22R capsules at 0.149R centres "overlap") and
      // the render still shows a column of separate dashes, because spacing was not
      // the mechanism: each lump is a STRAIGHT capsule seated on a CURVED surface at
      // `radius * 1.012`, so over 0.22R of length its two ends sink inside the tube
      // and only its middle stands proud. A chord is shorter than its arc — the
      // longer the lump, the less of it clears the wall.
      // Short lumps (0.10R + caps) at a CONSTANT normal offset (`+ R * 0.016`, not a
      // radius multiplier, which is a bigger stand-off at the fat end than the thin
      // one) each clear the wall along their whole length, and 18 of them at 0.079R
      // centres run into one another. Same total mass, same colour, one seam.
      const steps = 18;
      for (let i = 0; i < steps; i++) {
        const t = i / (steps - 1);
        const y = THREE.MathUtils.lerp(bodyBottomY + R * 0.10, bodyTopY - R * 0.06, t);
        const rr = wrapRadiusAt(y) + R * 0.016;
        // Drifts slightly around the tube as it climbs — a wrapped edge spirals, it
        // does not run dead vertical.
        const a = seamTheta + t * 0.30;
        const lump = new THREE.Mesh(
          new THREE.CapsuleGeometry(R * 0.026, R * 0.10, 4, 8),
          seamMat
        );
        lump.name = 'burrito_fold_seam';
        lump.position.set(Math.sin(a) * rr, y, Math.cos(a) * rr);
        lump.rotation.z = 0.06;
        lump.castShadow = true;
        head.add(lump);
      }
    }

    // ── THE HEAD FOIL AND ITS SIX TORN TABS ARE GONE. THIS IS FINDING 5. ──────
    //
    // What was here, kept verbatim because the intent was right and only the RESULT
    // was wrong:
    //
    //   "Foil wrap, cut on the diagonal. The single most recognisable burrito image is
    //    a tortilla tube half out of its foil, and the foil's torn edge running
    //    DIAGONALLY across the roll. In outline the diagonal costs nothing on its own
    //    (it is a colour break), but the torn tabs peeling off it do break the
    //    silhouette, and in the lit render the diagonal is what stops a cream cylinder
    //    reading as a cream cylinder."
    //   "Torn tabs riding the diagonal edge — the silhouette break... the tabs that
    //    actually break the SILHOUETTE are the ones near +-X."
    //
    // ⚠️ **Read that last sentence against finding 4.** The tabs were deliberately made
    // TALLEST at +X and -X — `h = R * (0.10 + 0.13 * |cos a| + ...)` — because that is
    // where a mass leaves the outline. That is the same reasoning, on the same
    // character, that produced the ears: *"a pointed mass either side of a head reads
    // as an ear or a horn, five for five, and it overrides what the shape is made of."*
    // Six three-sided cones on a sheared edge, tallest at the sides, rendered as a
    // ZIGZAG ROW OF WHITE TRIANGLES across the character's middle — teeth, or a bib —
    // with the two tallest standing off the head at ±X. Read the lobby captures in
    // `shots/ch/burrito/before/`: on `lobby_side.png` it is the single most legible
    // feature on the whole character, and it is not a burrito feature.
    //
    // And the sleeve underneath them earned even less. Its own note above records that
    // it once ate **53.5% of every face pixel**; it was lowered to -0.70R to stop that,
    // which left a cool grey band low on a warm character, doing nothing the torso's
    // foil sleeve was not already doing better and lower down.
    //
    // The trade this file was making is exactly `egg.ts:206`'s: **detail added to
    // signal the subject destroyed the silhouette that signalled it better.** The
    // "tortilla half out of its foil" image survives intact — the foil sleeve and its
    // takeaway paper band are still on the TORSO (`dressTorso`), which is where a
    // wrapper actually sits and where nothing occludes it.
    //
    // What replaces the diagonal's job — "stop a cream cylinder reading as a cream
    // cylinder" — is the thing a real tortilla has and this one never did: SCORCH.
    // Griddle spots are pure albedo, so they cost nothing in outline, they are warm
    // rather than cool, and they say "flatbread" in a way a grey band cannot.
    {
      const toastMat = toonMat({ color: TORTILLA_TOAST, roughness: 0.85 });
      // Deliberately irregular in all three of angle, height and size, and NEVER a
      // mirrored pair (see the toppings table above for why that matters here). The
      // front-centre band y in [-0.30R, +0.30R], |sin a| small, is left clear so
      // nothing lands on the face.
      // Angles checked against the face's own footprint rather than eyeballed: an eye
      // sits at azimuth ±asin(0.335R / r) ≈ ±29.5 deg and subtends ±14.5 deg, a brow
      // ±(28 ± 10) deg, the mouth 0 ± 18 deg. No spot's own angular half-width reaches
      // any of them. This is the same "solve it against the real equation" rule the
      // rest of the file applies to depth, applied to azimuth.
      // Seven, not nine, and the three that were front-facing have moved. Rendered, a
      // scorch at [18, -0.62] and one at [304, -0.36] landed on the two CHEEKS — beside
      // the pink blush that is already there — so the face carried two different blushes
      // in two different colours. The remaining front-ish pair is pushed low (y -0.90R,
      // below the mouth) and out to the tube's edge.
      const spots: readonly (readonly [deg: number, y: number, rx: number, ry: number])[] = [
        [8, -0.90, 0.15, 0.10], [78, 0.10, 0.11, 0.08], [96, -0.18, 0.18, 0.11],
        [168, 0.34, 0.16, 0.09], [239, 0.05, 0.20, 0.11], [272, -0.72, 0.14, 0.09],
        [318, -0.86, 0.12, 0.08],
      ];
      for (const [deg, yF, rx, ry] of spots) {
        const y = R * yF;
        const a = THREE.MathUtils.degToRad(deg);
        const g = tubeFrame(head, wrapRadiusAt, bodyH, a, y, R * 0.004);
        const spot = new THREE.Mesh(new THREE.CircleGeometry(R * rx, 12), toastMat);
        spot.name = 'burrito_toast_spot';
        spot.scale.set(1, ry / rx, 1);
        spot.userData.noOutline = true; // albedo only — a scorch mark has no outline
        g.add(spot);
      }
    }

    // ── Face: on the wrap's own front surface, mid-body ───────────────────────
    // `face` is reset to identity and every feature carries its own computed
    // (x, y, z) rather than relying on the rig's spherical-head default offset —
    // this body isn't spherical, so that default would float the eyes off the tube
    // wherever they're not dead-centre (verified: at the default x-offset the rig's
    // flat headRadius*0.82 constant sits ~0.09R proud of the tube's true surface).
    this.rig.joints.face.position.set(0, 0, 0);
    this.buildFace(R, wrapRadiusAt, bodyH);

    // ── Torso: dressed as a wrap continuation, foil peeling back at the base ──
    this.dressTorso(R);

    // ── Limbs: bespoke, not the shared rig defaults ───────────────────────────
    // An independent art director named the rig's identical capsule-arm/ball-hand/
    // wedge-foot kit as the single biggest "template" tell across the whole cast.
    // Burrito's limbs are rolled tortilla, close to true cylinders rather than
    // tapered dough, with a seam stripe echoing the roll; hands are twisted foil
    // nubs (the classic "twist the wrapper end" burrito silhouette) instead of a
    // generic mitt, and feet read as the wrap's own cut end.
    // ── 🚨 AN ARM AND A LEG WERE THE SAME OBJECT, SO THIS WAS A FOUR-LEGGED THING ─
    // Read `shots/ca/before/burrito.png` at the lobby camera. Four dark-green pill
    // chains hang off a pale tube at four near-identical angles, each cut in half by
    // a fat crimson ring, each ending in a small pale point. Nothing on screen says
    // which pair is which; the figure reads as an insect, and the two silver cones
    // read as claws. The old code says why in one line — `upperArm*` and `thigh*`
    // shared a `case`, and so did `forearm*` and `shin*`. They were the same mesh,
    // the same radii and the same material by construction.
    //
    // Three separations, none of which needs `rig.ts`:
    //
    //   THICKNESS   arms run 0.94/0.82 of their slot radius against the legs'
    //               1.14/1.00 — the arm's top is 77% of the thigh's.
    //   LADDER      the arm gets LIGHTER downward (fresh guac -> mid -> a bright
    //               FOIL MITT) and the leg gets DARKER downward (mid -> dark ->
    //               near-black boot). Opposite directions is worth more than any
    //               single value gap, because it survives the shading.
    //   TERMINAL    a real mitt with a thumb, ~0.20 m across, against a boot. That
    //               is the pair a human names without being told.
    //
    // ── AND THE CRIMSON RINGS WERE THE BEADS ────────────────────────────────────
    // `WRAP_BAND` cuffs sat at the TOP of every forearm and shin, i.e. at the elbow
    // and at the knee. A saturated ring at the joint of a two-segment chain does not
    // decorate the chain, it CUTS it — which is the bead-necklace read that
    // `taperedSegment` is usually blamed for and which, on this character, that
    // function is measurably not causing (see the note at the top of this file). Each band moves to a TERMINAL: the arm's to
    // the wrist (where it is a glove cuff and an arm-only feature — a leg has no
    // wrist) and the leg's is deleted, because the boot already terminates the leg.
    const limbLightMat = toonMat({ color: LIMB_AVOCADO_LIGHT, roughness: 0.75 });
    const limbWrapMat = toonMat({ color: LIMB_AVOCADO, roughness: 0.75 });
    const limbWrapShadeMat = toonMat({ color: LIMB_AVOCADO_DARK, roughness: 0.75 });
    const seamMat = toonMat({ color: LIMB_AVOCADO_DARK, roughness: 0.7 });
    const foilMatLimb = toonMat({ color: FOIL, roughness: 0.25, metalness: 0.5 });
    // ── THE MITT IS MATTE FOIL, AND THE CHROME WAS THE BELL ────────────────────
    // The first version of the hand used `foilMatLimb` — roughness 0.25, metalness
    // 0.5 — and `shots/ca/zoom/a1-burrito-limbs.png` shows what a 0.20 m polished
    // metal sphere with a saturated crimson ring round its top actually reads as:
    // a hand BELL. The shape was right; a mirror-finish sphere is a bell, a bauble
    // or a doorknob and never a hand, because skin and cloth do not have a specular
    // hotspot. Same albedo (this is still the wrapper's foil), matte surface.
    const mittMatLimb = toonMat({ color: FOIL, roughness: 0.62, metalness: 0.0 });
    const bandMatLimb = toonMat({ color: WRAP_BAND, roughness: 0.72 });
    const bootMatLimb = toonMat({ color: BOOT, roughness: 0.75 });
    this.rig.dressLimbs((part, size) => {
      switch (part) {
        case 'upperArmL': case 'upperArmR': {
          // `rise` = 0.30 of the bone. The upper arm's mesh now starts 0.097 m ABOVE
          // its own shoulder pivot, inside the wrap, so it has no contour of its own
          // until it emerges — the same fix `fb9d9da` used on hamburger, and the
          // other half of the detached-arm repair whose first half is the shoulder
          // swell in `dressTorso`.
          const m = new THREE.Mesh(
            taperedSegment(size.len, size.radius * 0.94, size.radius * 0.82, 12, { rise: size.len * 0.30 }),
            limbLightMat,
          );
          m.name = `${part}_mesh`;
          m.castShadow = true;
          m.receiveShadow = true;
          return m;
        }
        case 'thighL': case 'thighR': {
          const g = new THREE.Group();
          const m = new THREE.Mesh(
            taperedSegment(size.len, size.radius * 1.14, size.radius * 1.00, 12, { rise: size.len * 0.30 }),
            limbWrapMat,
          );
          m.name = `${part}_mesh`;
          m.castShadow = true;
          m.receiveShadow = true;
          g.add(m);
          // The rolled-tortilla seam stays on the LEG only. On the arm it was a third
          // parallel line beside two other verticals and read as a slit.
          const seam = new THREE.Mesh(new THREE.BoxGeometry(size.radius * 0.13, size.len * 0.78, size.radius * 0.05), seamMat);
          seam.position.set(0, -size.len * 0.52, size.radius * 1.06);
          seam.userData.noOutline = true;
          g.add(seam);
          return g;
        }
        case 'forearmL': case 'forearmR': {
          // Top radius is the upper arm's bottom radius EXACTLY (0.94 * 0.82 of
          // `armRadius` = 0.89 * 0.92 of it), so the elbow is a continuation and not
          // a step. Two constant-radius tubes at different constants cannot meet —
          // `soup.ts` records the same finding on its own arm chain.
          const m = new THREE.Mesh(
            taperedSegment(size.len, size.radius * 0.89, size.radius * 0.76, 12, { rise: size.len * 0.16 }),
            limbWrapMat,
          );
          m.name = `${part}_mesh`;
          m.castShadow = true;
          m.receiveShadow = true;
          return m;
        }
        case 'shinL': case 'shinR': {
          // Same continuity rule at the knee: `metrics.shinRadius * 1.11` is the
          // thigh's own bottom radius to within 0.1%. (`shinRadius` is the published
          // `legRadius * 0.9`; read the metric rather than re-typing the product.)
          const m = new THREE.Mesh(
            taperedSegment(size.len, size.radius * 1.11, size.radius * 0.95, 12, { rise: size.len * 0.16 }),
            limbWrapShadeMat,
          );
          m.name = `${part}_mesh`;
          m.castShadow = true;
          m.receiveShadow = true;
          return m;
        }
        case 'handL': case 'handR': {
          // ── THE TWISTED-FOIL CONE WAS A CLAW ────────────────────────────────
          // A cone tapering to a point, hung off the end of a limb, is a talon at any
          // size — and mirrored on a four-limbed silhouette it is the single element
          // that pushed this figure from "character" to "insect". The wrapper-twist
          // idea survives as the mitt's own twisted tip; the MASS becomes a hand.
          const g = new THREE.Group();
          // ⚠️ Sized off the FOREARM, not off `handRadius`. `dressLimbs` hands this
          // slot the rig's independent `handRadius` constant; on LANKY that is
          // 0.123 m, 2.1x the forearm's own tip.
          // ⚠️ This line used to RE-TYPE the derivation as `armRadius * 0.92 * 0.76`.
          // Identical arithmetic, and that is exactly the trap: `0.92` is the rig's
          // number, not this file's, and this same file already proved what a re-typed
          // derived constant costs — its `R = 0.20H` (see the head note above) ignored
          // that `rig.ts` subtracts the neck gap before halving, was 17.5% out, and
          // FOUR ROUNDS of shoulder tuning inherited it. `metrics.forearmRadius` is the
          // SAME value `limbSlots()` builds the forearm at, published so there is
          // nothing left to re-type.
          const tipR = this.rig.metrics.forearmRadius * 0.76;
          const mitt = new THREE.Mesh(new THREE.SphereGeometry(tipR * 1.70, 16, 12), mittMatLimb);
          mitt.position.y = -tipR * 1.30;
          mitt.scale.set(1, 0.96, 0.86);
          mitt.name = `${part}_mesh`;
          mitt.castShadow = true;
          mitt.receiveShadow = true;
          g.add(mitt);
          // The twist: a short blunt nub off the mitt's underside, which is the
          // wrapper end this file has always wanted and is far too small to be an
          // appendage on its own.
          const twist = new THREE.Mesh(new THREE.ConeGeometry(tipR * 0.52, tipR * 0.72, 8), mittMatLimb);
          twist.position.y = -tipR * 2.55;
          twist.rotation.z = Math.PI;
          twist.castShadow = true;
          g.add(twist);
          // Thumb — the element that makes the mass NAMEABLE at 20 px.
          const sx = part === 'handL' ? 1 : -1;
          const thumb = new THREE.Mesh(new THREE.CapsuleGeometry(tipR * 0.52, tipR * 0.86, 4, 8), mittMatLimb);
          thumb.position.set(sx * tipR * 1.42, -tipR * 0.74, tipR * 0.42);
          thumb.rotation.set(0.22, 0, sx * 1.02);
          thumb.castShadow = true;
          g.add(thumb);
          // The paper band, moved here from the elbow. At the wrist it is a glove
          // cuff; at the elbow it was a bead separator.
          // Slimmer than the elbow band it replaces (tube 0.24 -> 0.15 of the tip) and
          // pushed UP against the forearm: a cuff is an EDGE, and at 0.24 it was a
          // ring the same order as the mitt, which is the collar half of the bell.
          const cuff = new THREE.Mesh(new THREE.TorusGeometry(tipR * 1.02, tipR * 0.15, 8, 18), bandMatLimb);
          cuff.position.y = tipR * 0.16;
          cuff.rotation.x = Math.PI / 2;
          cuff.castShadow = true;
          g.add(cuff);
          return g;
        }
        case 'footL': case 'footR': {
          const g = new THREE.Group();
          const stub = new THREE.Mesh(
            new THREE.CylinderGeometry(size.radius * 1.1, size.radius * 1.02, size.len * 0.75, 16, 1, false),
            bootMatLimb
          );
          stub.position.set(0, -size.len * 0.42, size.radius * 0.3);
          stub.rotation.x = Math.PI * 0.06;
          stub.name = `${part}_mesh`;
          stub.castShadow = true;
          stub.receiveShadow = true;
          g.add(stub);
          const ring = new THREE.Mesh(new THREE.TorusGeometry(size.radius * 1.06, size.radius * 0.1, 6, 16), foilMatLimb);
          ring.rotation.x = Math.PI / 2;
          ring.position.set(0, -size.len * 0.1, size.radius * 0.3);
          ring.castShadow = true;
          g.add(ring);
          return g;
        }
        default:
          return null;
      }
    });

    this.buildSpill(R);

    outlineCharacter(this.root);
    this.collectFlashTargets();
    this.rig.restPose();
  }

  /**
   * SILHOUETTE EVENTS — the spill, not the ears.
   *
   * ── WHAT WAS HERE, AND WHY IT WAS THE GOAT ───────────────────────────────────
   * Three peeled corners of foil, kept verbatim because the *reasoning* is sound and
   * still applies to what replaces them:
   *
   *   "Burrito already had the third-best outline in the cast at the shipped facing
   *    (0.1717, one appendage), and the same shape head-on was 0.1354 with the wrap
   *    reading as a plain cylinder... Three, at three lengths, curled out and UP so
   *    each leaves the tube on the horizontal — the direction worth 0.85-1.0 of a
   *    screen-metre at this camera against a vertical element's 0.53."
   *
   *     { azimuth:  PI * 0.54, len: 0.78, lift: 0.55 }   <- +X, lifted
   *     { azimuth: -PI * 0.48, len: 0.62, lift: 0.34 }   <- -X, lifted
   *     { azimuth:  PI * 0.96, len: 0.70, lift: 0.68 }   <- back
   *
   * The first two are the ears. `massAnchor`'s azimuth is 0 at +Z, so +0.54PI and
   * -0.48PI are **+X and -X within 11 degrees of each other's mirror**, at `height01`
   * 0.74 (the crown), both LIFTED, both `blade()` — which narrows to a point by
   * construction. Two pointed masses, either side of a head, aimed up. `DECISIONS` §39
   * called it from the source; the lobby capture makes it undeniable.
   *
   * ── AND THE REPLACEMENT IS NOT "THE SAME THING, ROUNDED" ─────────────────────
   * Rounding them would still leave a PAIR, and the pair is half of the read. The four
   * properties that make a flanking mass an ear are: two of them, mirrored, near the
   * top, pointing up. This breaks all four at once —
   *
   *   • ONE lettuce leaf and ONE cheese pull, not a pair;
   *   • at -0.34PI and +0.78PI, which are not mirrors (-61 deg vs +140 deg);
   *   • at different lengths (0.66R vs 0.40R) and different colours;
   *   • both DROOPING (lift is negative), hanging down the tube rather than off it.
   *
   * It is also made of FOOD rather than packaging, which is the converse of finding 5:
   * the detail that breaks the outline is now the same detail that says "burrito". A
   * filling spilling over a cut edge is the one thing this shape does that a tube does
   * not, and it costs nothing in the read to get the outline from it.
   *
   * ⚠️ Horizontal reach is deliberately traded away here. `appendages.ts` measures a
   * horizontal element at 0.85-1.0 of a screen-metre against a vertical's 0.53, so a
   * drooping event buys roughly half the hull deficiency an out-thrust one does. That
   * is the price of not being a goat, it is paid knowingly, and the number is reported.
   */
  private buildSpill(R: number): void {
    const head = this.rig.joints.head;
    const box = localBounds(head);
    const lettuceMat = toonMat({ color: LETTUCE, roughness: 0.55 });
    const cheeseMat = glossyMat({ rim: true, color: CHEESE, roughness: 0.28 });

    // ⚠️ The lettuce WAS at -0.34PI (-61 deg) and it covered the left eye's outer corner
    // — the eye spans to -44 deg and the leaf is 0.60R wide, so the two overlap on
    // screen from every front-ish yaw. Read the render: a green mass sitting exactly
    // where an ear goes, on top of an eye. -0.56PI (-101 deg) puts it on the tube's own
    // silhouette edge, which is where a spill breaking the OUTLINE wants to be anyway,
    // and clear of every face feature. This is the same class of error as the fold seam
    // and the scorch spots in this pass: three separate elements authored against the
    // tube and never checked against the face that shares it.
    // ── `height01` IS A BOX FRACTION, AND THIS FILE JUST MOVED THE BOX ──────────
    // `massAnchor` takes a fraction of the head's own bounding box, so deleting the head
    // foil (which reached to -1.02R) silently RE-MAPPED every fraction on this character.
    // Anchors are therefore stated in head-local Y — the same coordinate the tube, the
    // face and every decal already use — and converted here. A constant that means a
    // different height depending on what else exists is not a constant.
    const at01 = (y: number) => THREE.MathUtils.clamp(
      (y - box.min.y) / Math.max(1e-6, box.max.y - box.min.y), 0, 1,
    );
    const spec = [
      { azimuth: -Math.PI * 0.56, y: 0.80, len: 0.58, half: 0.30, waist: 1.75, mat: lettuceMat, name: 'burrito_lettuce_drape' },
      { azimuth: Math.PI * 0.78, y: 0.30, len: 0.40, half: 0.22, waist: 1.95, mat: cheeseMat, name: 'burrito_cheese_pull' },
    ] as const;
    for (const sp of spec) {
      // eslint-disable-next-line prefer-const
      let { at, out, hit } = massAnchor(head, box, { azimuth: sp.azimuth, height01: at01(R * sp.y), inset: 0.22 });
      // ⚠️ A GUARD WITH A KNOWN-BAD INPUT ALREADY ON THE RECORD, WHICH IS THE ONLY KIND
      // WORTH HAVING. The mound is a sphere CAP (theta 0..0.48PI), not a sphere, and it
      // is tilted twice — so a horizontal ray above its rim misses the geometry
      // entirely, `massAnchor` falls back to the bounding BOX exactly as it warns it
      // will, and the root lands ~0.2R clear of anything. That is not hypothetical: the
      // first version of this spill anchored at a flat `height01: 0.66` and the run
      // printed `[appendages] no mass at azimuth -1.76 height01 0.66 on head — anchor
      // fell back to the bounding box`, with a **detached green slab** beside the head in
      // `shots/ch/burrito/after/lobby_q45.png` to match. `massAnchor` was doing its job:
      // it returned `hit: false` and said so, and nothing was reading it.
      //
      // The re-anchor is on the TUBE, which is a surface of revolution and cannot be
      // missed at any azimuth — so this fallback always terminates on real geometry.
      if (!hit) {
        ({ at, out } = massAnchor(head, box, { azimuth: sp.azimuth, height01: at01(R * 0.20), inset: 0.22 }));
      }
      const g = new THREE.Group();
      g.name = sp.name;
      // -0.9 on Y: mostly DOWN with an outward lean. `blade()`'s tip is at local +Y, so
      // this is the whole difference between "spilling over" and "sticking up".
      aim(g, at, out.clone().add(new THREE.Vector3(0, -0.9, 0)).normalize(), Math.PI * 0.5);
      g.add(peelBlade(sp.mat, {
        len: R * sp.len, halfWidth: R * sp.half, thick: R * 0.035, curl: 0.42, waist: sp.waist,
      }));
      head.add(g);
    }
  }

  /**
   * The face, rebuilt to `rules.ts`'s four-element standard.
   *
   * ── THE SPEC THIS IMPLEMENTS, AND WHY THERE WAS NONE ─────────────────────────
   * Burrito is the strongest single datum behind `DECISIONS` §42: it is **the one
   * character whose `face:` field never mentioned a face**, and it is the one whose
   * face Uri rejected without being able to say why (*"face is not good"*). Eleven
   * agents implemented their line faithfully; this line had nothing in it to implement.
   * The new spec is quoted where each element below satisfies it.
   *
   * What was here: two INK spheres (one squashed to 0.34 as a wink), a 0.04R white
   * glint, two ink capsule brows, and a torus arc for a mouth. That is the bottom of
   * the construction ladder Uri reproduced blind — *"a flattened arc (a stroke) < a
   * sphere with a specular < a sphere plus an explicit glint mesh < open eyes with
   * catchlights (egg)"* — with **two values total** and no white anywhere.
   *
   * ── THE FOUR ELEMENTS, ALL SEPARATE MESHES ──────────────────────────────────
   *  1. **SCLERA.** Pure white, LIT (`toonMat`, roughness 0.22), 0.17R — the largest,
   *     brightest mass on the face and intended to be the brightest value anywhere on
   *     the character. Measured cast-wide: *"0% of our eye pixels are above 0.85 luma
   *     against the reference plates' 31.1% and 34.1%."*
   *  2. **PUPIL**, real geometry, **OFFSET**. Both pupils are pushed the same way
   *     (+X and slightly up), so the character has a GAZE rather than two centred
   *     beads — `rules.ts` records that even egg, the cast reference, sets `x = 0` and
   *     therefore *"stares dead ahead"*.
   *  3. **CATCHLIGHT**, an explicit unlit mesh, offset OPPOSITE the pupil.
   *  4. **UPPER LID / LASH.** *"The wrap is a pale cream, so an off-white sclera will
   *     dissolve into it... this is the one character where the eye needs a DRAWN
   *     BOUNDARY to survive its own background."* The lid is a thick ink arc over the
   *     top and outer corner of each sclera — the one place the white would otherwise
   *     meet tortilla with nothing between them.
   *
   * The MOUTH gets the interior value step the standard demands: a near-black throat
   * (`MOUTH_THROAT`, darker than the lip ink), a tongue inside it, and a lit lower lip
   * — three values, so it reads as an opening rather than a painted curve.
   *
   * ── PLACEMENT IS THE OTHER HALF OF THE FIX ──────────────────────────────────
   * *"Set the face HIGH and WIDE on the tube. A small face low on a long narrow head
   * reads as a MUZZLE, and that is half of why Uri said 'looks a bit like a goat'."*
   * Eyes go from ±0.30R to ±0.335R and from 0.25R across to 0.34R, so the pair spans
   * **1.01R of a 1.36R-wide tube** where it spanned 0.85R before; the mouth comes UP
   * from -0.22R to -0.14R, closing the eye-to-mouth gap from 0.32R to 0.22R. A muzzle
   * is precisely a small feature set with a long blank gap under it.
   *
   * The wink is kept — it is this character's acting and a second art-director pass
   * named mirrored faces as the cast's biggest reason facial acting was not landing —
   * but it is now a LID ANGLE over a full open eye rather than a squashed eyeball, the
   * same correction `rules.ts` makes for hotdog (*"RELAXED IS A LID ANGLE, NOT A
   * MISSING EYE"*). The sclera is full size on both sides.
   */
  private buildFace(R: number, wrapRadiusAt: (y: number) => number, span: number): void {
    const face = this.rig.joints.face;
    const ink = PALETTE.ink;
    const inkMat = toonMat({ color: ink, roughness: 0.28 });
    const scleraMat = toonMat({ color: SCLERA, roughness: 0.22 });
    const glintMat = flatMat('#ffffff');
    // eyeY sits under a HARD CEILING and it is worth writing down: the open end's tilted
    // rim passes overhead, and its underside at the eye's own azimuth is at +0.299R (see
    // the `openEnd.rotation.z` note). The sclera's y half-extent is 0.17R, so anything
    // above +0.09R puts the eye through the rim.
    const eyeY = R * 0.09;
    const EYE_X = R * 0.335;

    for (const sx of [-1, 1] as const) {
      // Azimuth solved from the wanted screen-space X against the tube's TRUE radius at
      // this height, so widening the face never pushes an eye off the surface.
      const az = Math.asin(THREE.MathUtils.clamp((sx * EYE_X) / wrapRadiusAt(eyeY), -0.94, 0.94));
      const eye = tubeFrame(face, wrapRadiusAt, span, az, eyeY, R * 0.010);
      eye.name = `burrito_eye${sx > 0 ? 'R' : 'L'}`;

      // 1. SCLERA — full size on BOTH sides; the wink lives in the lid, not here.
      const white = new THREE.Mesh(new THREE.SphereGeometry(R * 0.17, 18, 14), scleraMat);
      // y-scale 1.06 -> 1.00. The extra 6% bought nothing and cost the MOUTH: it pushed
      // the sclera's bottom to -0.10R and the mouth had to start below that, which is the
      // muzzle gap this pass exists to close. Round eyes, and the mouth sits right under
      // them.
      white.scale.set(1, 1.00, 0.42);
      white.castShadow = true;
      eye.add(white);

      // 2. PUPIL — offset the SAME way on both sides, which is what makes it a gaze.
      // 0.040R -> 0.032R (19% of the sclera's own radius). The gaze has to be readable
      // and not googly, and the eye decal is ALSO rotated 29.5 deg outward on the tube,
      // which exaggerates a tangential offset on screen — measured off the render, not
      // assumed. It stays a real offset: `rules.ts` records that even egg, the cast
      // reference, sets `x = 0` and therefore "stares dead ahead".
      const pupil = new THREE.Mesh(new THREE.SphereGeometry(R * 0.082, 14, 12), inkMat);
      pupil.position.set(R * 0.032, R * 0.012, R * 0.062);
      pupil.scale.set(1, 1.05, 0.5);
      pupil.castShadow = true;
      eye.add(pupil);

      // 3. CATCHLIGHT — unlit and `noOutline`.
      // ⚠️ WAS AT x = -0.045R, "offset OPPOSITE the pupil", and on the right eye it was
      // INVISIBLE. This is `docs/LESSONS.md` §1 in miniature — it rendered, and it
      // rendered onto WHITE. A pure-white unlit dot has nothing to contrast with on a
      // pure-white lit sclera; the only reason the left eye's glint read at all is that
      // that side of the sclera happened to be in shade. The catchlight has to overlap
      // the PUPIL, which is the only dark thing on the eye — x = -0.010R puts it inside
      // the pupil's own x span (-0.042R .. +0.122R) and z = 0.105R stands it just proud
      // of the pupil's front (0.103R), so it reads as a highlight in the dark rather
      // than a white dot on white.
      // ── 🚨 AND IT WAS STILL BITING A CHUNK OUT OF THE PUPIL ──────────────────
      // `fb9d9da` found this on egg — a glint at 49% of the pupil's radius, placed
      // across its edge, renders every pupil as a Pac-Man. Burrito had the same
      // construction at 40% (0.033R against an 0.082R pupil) and the same placement
      // error, and `shots/ca/zoom/burrito-face.png` shows the bite plainly on the
      // open eye. It is arithmetic: the pupil is an ellipsoid with y half-extent
      // 0.0861R, so a glint centred at (-0.010R, +0.060R) sits at normalised radius
      // sqrt((0.042/0.082)^2 + (0.048/0.0861)^2) = 0.757, and 0.757 + 0.033/0.082 =
      // **1.16 > 1** — 16% of the way outside its own pupil.
      // 0.024R at (+0.008R, +0.052R) gives 0.550 + 0.293 = 0.843, comfortably inside,
      // and it stays high-and-inboard so it still reads as a catchlight rather than
      // as a centred dot.
      const glint = new THREE.Mesh(new THREE.SphereGeometry(R * 0.024, 8, 8), glintMat);
      glint.position.set(R * 0.008, R * 0.052, R * 0.105);
      glint.userData.noOutline = true;
      eye.add(glint);

      // 4. UPPER LID / LASH — the drawn boundary the pale ground makes necessary. A
      // torus arc hugging the sclera's rim, swept from the outer corner over the top.
      // The winking side (sx > 0) drops its lid further and sweeps further round; the
      // open side keeps a thin lash. This is where the old "wink" went.
      // ── THE WINK WAS EATING THE EYE ────────────────────────────────────────
      // A 1.15PI sweep dropped 0.030R over an 0.172R sclera covers 57% of the eye,
      // and `shots/ca/zoom/a3-burrito-face.png` shows the result: a near-black almond
      // with a sliver of white under it, beside a fully open round eye. Two blind
      // critics said of egg, in the same construction, *"the two eyes are drastically
      // different sizes"* — this is that complaint's other cause. A wink is a LID
      // ANGLE over a visible eye (`rules.ts`, on hotdog: *"RELAXED IS A LID ANGLE,
      // NOT A MISSING EYE"*); at 57% coverage it is a missing eye.
      // 0.95PI at -0.016R leaves the pupil and its catchlight fully in view, so the
      // acting survives and the pair reads as two eyes.
      const winking = sx > 0;
      const lid = new THREE.Mesh(
        new THREE.TorusGeometry(R * 0.172, R * 0.030, 8, 22, Math.PI * (winking ? 0.95 : 0.80)),
        inkMat,
      );
      lid.scale.set(1, 1.06, 1);
      lid.rotation.z = winking ? Math.PI * 0.06 : Math.PI * 0.14;
      lid.position.set(0, winking ? -R * 0.016 : 0, R * 0.020);
      lid.castShadow = true;
      eye.add(lid);

      // BROW — a toasted crease in the wrap, not a hair. Same reasoning `egg.ts` uses
      // for its shell ridge: this character has no hair, so a brow has to be made of
      // the thing the head IS made of, and INK here would put a third heavy black mark
      // on a face that already carries a lid and a pupil.
      // 0.255R -> 0.215R on the winking side. With the lid no longer dropped 0.030R
      // the raised brow no longer has that drop to clear, and at 0.255R it was
      // floating 0.07R clear of its own eye — a stray stick rather than a brow.
      const browY = eyeY + (winking ? R * 0.215 : R * 0.190);
      const browAz = Math.asin(THREE.MathUtils.clamp((sx * R * 0.315) / wrapRadiusAt(browY), -0.94, 0.94));
      const brow = tubeFrame(face, wrapRadiusAt, span, browAz, browY, R * 0.008);
      const browMesh = new THREE.Mesh(
        new THREE.CapsuleGeometry(R * 0.034, R * 0.18, 4, 8),
        toonMat({ color: TORTILLA_SHADE, roughness: 0.6 }),
      );
      browMesh.rotation.z = Math.PI / 2 - sx * (winking ? 0.42 : 0.12);
      browMesh.castShadow = true;
      brow.add(browMesh);
    }

    // ── MOUTH — an opening with an interior, not a painted curve ───────────────
    // Three values inside one shape, which is the whole of what the standard asks for:
    // THROAT (#1E0803, darker than the lip ink and the darkest thing on the head),
    // TONGUE, and a lit lower lip in the wrap's own toast tone. The lip ring is what
    // stops the dark opening reading as a hole punched in the tortilla.
    //
    // ⚠️ Checked against taco's fusion, which `rules.ts` calls out by name: a mouth
    // must not sit next to the character's darkest band or the two merge and read as a
    // hat brim. Burrito's darkest bands are BOOT (feet) and the WRAP_BAND at the waist,
    // both far below; the head foil that used to sit 0.56R under this mouth is gone, so
    // the opening now has clear griddled tortilla all round it.
    //
    // 🚨 AND THE FIRST VERSION OF THIS MOUTH READ AS A NOSE. Every element was present
    // and correct — throat behind lip behind tongue, three values, a real depth step —
    // and the assembled thing was a black ring with a red bean in it, sitting high and
    // centred between two eyes. Rendered, that is a snout, or a camera lens. Four
    // numbers were wrong and none of them were the ones the standard talks about:
    //
    //   major 0.205R, y-scale 0.60  ->  0.27R, 0.40   a mouth is WIDE. 0.41R x 0.25R is
    //                                                 round enough to be a nostril;
    //                                                 0.54R x 0.22R can only be a mouth.
    //   lip tube 0.036R             ->  0.020R        the ring was thicker than the
    //                                                 opening it framed, and the ink
    //                                                 outline doubled it again.
    //   tongue 0.125R at -0.046R    ->  0.095R at     it FILLED the opening, so the
    //                                   -0.062R       throat — the whole point — was a
    //                                                 thin dark annulus nobody could see.
    //   mouthY -0.14R               ->  -0.25R        directly under the eyes rather than
    //                                                 between them.
    //
    // The general form is worth keeping: **the four-element standard is necessary and it
    // is not sufficient.** It specifies what a mouth must CONTAIN; a mouth also has to
    // be the right SHAPE, in the right place, or the contents are correctly built inside
    // the wrong object.
    const mouthY = -R * 0.25;
    const mouth = tubeFrame(face, wrapRadiusAt, span, 0, mouthY, R * 0.004);
    mouth.name = 'burrito_mouth';

    const throat = new THREE.Mesh(
      new THREE.SphereGeometry(R * 0.27, 18, 14),
      toonMat({ color: MOUTH_THROAT, roughness: 0.62 }),
    );
    throat.scale.set(1, 0.40, 0.26);
    // ── The depth step is ARITHMETIC, not a look ─────────────────────────────
    // The frame's origin is on the tube's surface. Throat half-depth is 0.27R * 0.26 =
    // 0.070R, so at z = -0.052R its front face lands 0.018R proud of the surface while
    // the lip ring's front lands at 0.032R: **the throat sits 0.014R BEHIND the lip**,
    // which is the "interior value step" the standard asks for expressed as real
    // geometry rather than as a darker paint.
    throat.position.z = -R * 0.052;
    throat.castShadow = true;
    throat.userData.noOutline = true; // it is already the darkest thing on the head
    mouth.add(throat);

    const tongue = new THREE.Mesh(
      new THREE.SphereGeometry(R * 0.095, 12, 10),
      toonMat({ color: MOUTH_TONGUE, roughness: 0.45 }),
    );
    tongue.scale.set(1, 0.46, 0.30);
    // Low in the opening and small: it should read as a tongue GLIMPSED inside a mouth.
    // At 0.125R centred it was 62% of the opening's height and the mouth read as a
    // solid red centre — the "bean in a grommet".
    tongue.position.set(R * 0.010, -R * 0.062, -R * 0.014);
    tongue.userData.noOutline = true;
    mouth.add(tongue);

    const lip = new THREE.Mesh(
      new THREE.TorusGeometry(R * 0.27, R * 0.020, 8, 26),
      inkMat,
    );
    lip.scale.set(1, 0.40, 1);
    lip.position.z = R * 0.012;
    lip.castShadow = true;
    lip.userData.noOutline = true; // ink already; the hull outline was doubling its weight
    mouth.add(lip);

    // UPPER LIP — heavy along the top edge and light along the bottom, which is what
    // turns an oval into an open GRIN: a ring of even weight reads as a hole.
    //
    // ── 🚨 IT WAS A STRAIGHT BAR AND THE MOUTH READ AS A MAIL SLOT ──────────────
    // WAS a `CapsuleGeometry` 0.028R thick laid horizontally at y +0.104R. Two
    // things made that a slot rather than a lip, and neither is the value:
    //   · it is STRAIGHT and the opening under it is an ELLIPSE, so a rectangle sits
    //     on a curve with daylight between them at both ends;
    //   · at 0.028R it is **3.5x the lip ring's own tube** (0.020R, y-scaled to
    //     0.008R), so it does not thicken the ring, it replaces it.
    // Read `shots/ca/zoom/burrito-face.png`: a black rectangle above a black oval
    // with a red bean in it. `egg.ts` fixed the same class of error in `fb9d9da` —
    // *"the mouth was three bars of the same length with square ends, stacked"* — and
    // the general rule it recorded applies here unchanged: **nothing on a face is a
    // straight bar.**
    // The upper lip is now the SAME torus as the lip ring, on the same major radius
    // and the same y-scale, swept over the top arc only and one notch fatter. It
    // thickens the ring along the ring's own curve, so the mouth stays one shape.
    const upperLip = new THREE.Mesh(
      new THREE.TorusGeometry(R * 0.27, R * 0.030, 8, 20, Math.PI * 0.80),
      inkMat,
    );
    upperLip.scale.set(1, 0.40, 1);
    upperLip.rotation.z = Math.PI * 0.10;
    upperLip.position.z = R * 0.014;
    upperLip.castShadow = true;
    upperLip.userData.noOutline = true;
    mouth.add(upperLip);

    // LOWER LIP — a LIT strip under the opening, in the wrap's strong shade tone rather
    // than the quiet one, because this is a feature and not a griddle mark. `rules.ts`
    // names its absence on hamburger — *"not a flat dark shape, which is what the
    // per-part pass named: no lip thickness or interior value step"* — and it is the
    // fourth value in the mouth: throat 0.03, ink lip 0.05, tongue 0.31, lower lip 0.63.
    // Placed BELOW the lip ring's own outer edge (0.27R * 0.40 + 0.020R = 0.128R), which
    // is where a first version put it and had it swallowed whole.
    // ⚠️ AND IT WAS FLOATING, which is the same defect as the upper lip one paragraph
    // up. The lip ring's lowest point is -0.116R and this bar sat centred at -0.152R
    // with a 0.026R radius, so its top edge was -0.126R — a 0.010R strip of bare
    // tortilla between the two, and at that separation a horizontal light bar under a
    // dark mouth is a MOUSTACHE, which is what the lobby crop shows. Raised to -0.128R
    // (top edge -0.102R, overlapping the ring) and shortened so it cannot outrun the
    // ellipse's own curve at the corners.
    const lower = new THREE.Mesh(
      new THREE.CapsuleGeometry(R * 0.026, R * 0.20, 4, 8),
      toonMat({ color: TORTILLA_SHADE, roughness: 0.7 }),
    );
    lower.rotation.z = Math.PI / 2;
    lower.position.set(0, -R * 0.128, R * 0.020);
    lower.userData.noOutline = true;
    mouth.add(lower);

    // Hoisted and given `depthWrite: false` — a transparent material that still
    // writes depth is a silent occluder (`docs/LESSONS.md` §1), and every
    // transparent material in the cast carried the default `true`.
    const blushMat = flatMat('#FF9EC4', { transparent: true, opacity: 0.5 });
    blushMat.depthWrite = false;
    for (const sx of [-1, 1]) {
      // Pushed out and down from ±0.44R / -0.08R: the eyes are wider and lower-reaching
      // now, and a blush overlapping a sclera's outer corner reads as a smudge on it.
      const cy = -R * 0.20;
      const cheekAz = Math.asin(THREE.MathUtils.clamp((sx * R * 0.50) / wrapRadiusAt(cy), -0.96, 0.96));
      const cheek = new THREE.Mesh(new THREE.SphereGeometry(R * 0.07, 10, 8), blushMat);
      const g = tubeFrame(face, wrapRadiusAt, span, cheekAz, cy, R * 0.006);
      cheek.scale.set(1, 0.62, 0.28);
      cheek.userData.noOutline = true;
      g.add(cheek);
    }
  }

  /**
   * The torso IS the burrito — one uncut tube from the fillings down to the hips.
   *
   * ── Why this replaced a decorated barrel ────────────────────────────────────
   * The cast-wide silhouette test named Burrito as one of three characters that
   * "collapse into a generic blob", and the measurement says why. The food mass
   * used to stop dead at the neck: a 1.35R-tall by 1.39R-wide tube (as wide as it
   * is tall — a barrel, not a tube) perched on the rig's own tapered-sphere torso.
   * Two round masses with a waist between them is a pill, and a pill is exactly
   * what the black-on-white render showed.
   *
   * A burrito's single non-negotiable property is that it is LONG. Continuing the
   * head's own tube through the torso gives a ~2.5:1 vertical cylinder — the one
   * proportion no other character in the cast has — and it costs nothing in body
   * plan, because the archetype still owns every joint, limb length and stance.
   * `rig.dressTorso` exists for precisely this ("the strongest characters extend
   * their food mass down through the BODY").
   *
   * The costume layer moves with it. A striped poncho over the tube was actively
   * fighting the read — five horizontal colour bands across the middle of the one
   * shape that has to read as continuous — so it is replaced by the thing a
   * burrito actually wears: a foil sleeve over the lower half, torn open and
   * flared back at its top edge, with the takeaway paper band around it. That is a
   * real garment-scale silhouette break (the flare projects past the tube from
   * every yaw) that also happens to be the character's own identity cue.
   *
   * Sizing rules obeyed here:
   *  - the tube's radius is capped so it stays clear INSIDE the arms
   *    (`shoulderWidth - armRadius * 1.28`); `bodies.ts` warns that a torso whose
   *    half-width reaches the shoulder pivot turns the character into a pile of
   *    overlapping dough balls, and this file has to respect that cap because it
   *    is deliberately making the torso wider than the rig's own default.
   *  - the tube's TOP is solved from `metrics.headCentreY` + the head tube's own
   *    bottom, not from a hardcoded fraction, so an archetype change moves the
   *    join rather than opening a gap.
   */
  private dressTorso(R: number): void {
    const m = this.rig.metrics;
    // STUB has no torso (`bodies.ts`); `rig.dressTorso` no-ops there and every
    // offset below would collapse onto the hip line, so bail before measuring.
    if (!m.hasTorso) return;

    const wrapMat = toonMat({ color: TORTILLA, roughness: 0.8 });
    const foilMat = toonMat({ color: FOIL, roughness: 0.25, metalness: 0.5 });
    const foilShellMat = toonMat({ color: FOIL, roughness: 0.25, metalness: 0.5, doubleSide: true });
    const bandMat = toonMat({ color: WRAP_BAND, roughness: 0.72 });

    // Where the head's tube ends, in TORSO-LOCAL space (the torso joint's origin
    // is the hip pivot, so subtract hipY from the world height).
    const headBottomLocal = m.headCentreY + this.headTubeBottomY - m.hipY;
    // ── THE CAP THAT SHRANK WITH ITS OWN FIX ─────────────────────────────────
    // WAS: `Math.max(m.shoulderWidth - m.armRadius * 1.28, R * 0.34)` — "keep the tube
    // clear INSIDE the arms". That is the wrong sign for the thing this cap decides.
    // A limb reads as attached when the body OVERLAPS it; `-armRadius * 1.28` puts the
    // tube's surface a quarter of an arm-diameter SHORT of the arm's inner edge, so the
    // two only touch by accident. And because it is written as a subtraction from
    // `shoulderWidth`, every pass that narrowed the shoulders to fix a detached arm
    // narrowed the only mass that arm could attach to by MORE than it moved the arm.
    // Measured on HEAD: shoulders 0.2152 m, cap 0.1103 m, floored to R*0.34 = 0.1394 m,
    // against a head tube of 0.2378 m — a torso 59% of the head's width, and arms whose
    // inner edge cleared that torso by 0.006 m. Both defects, one line.
    //
    // `+ armRadius * 0.55` is the straddle stated once, here, and mirrored in the
    // `shoulderWidth` note above: the arm's inner edge ends up 0.55 of an arm-radius
    // inside the tube. With `shoulderWidth = H * 0.138` this evaluates to exactly
    // `headTubeBottomR`, so the `min` below is a tie and head and torso are ONE
    // CONTINUOUS TUBE for the first time — which is what the file header has claimed
    // since the head+torso loop and what the lobby render says was never true.
    const maxR = Math.max(m.shoulderWidth - m.armRadius * 0.55, R * 0.34);
    const tubeTopR = Math.min(this.headTubeBottomR, maxR);
    const tubeBotR = tubeTopR * 0.82;   // the folded, tucked end
    const yBot = -R * 0.16;             // dips below the hip pivot so no seam shows
    const yTop = headBottomLocal + R * 0.12; // overlaps up into the head mass

    this.rig.dressTorso(() => {
      const g = new THREE.Group();
      g.name = 'burrito_torso_tube';

      // Lathe, wound bottom → top. Getting this backwards inverts the normals and
      // the mesh renders near-black — the trap that bit six characters at once.
      const pts: THREE.Vector2[] = [
        new THREE.Vector2(0, yBot),
        new THREE.Vector2(tubeBotR * 0.52, yBot + R * 0.045),
        new THREE.Vector2(tubeBotR * 0.90, yBot + R * 0.14),
        new THREE.Vector2(tubeBotR, yBot + R * 0.26),
        new THREE.Vector2(tubeTopR * 0.99, (yBot + yTop) * 0.5),
        new THREE.Vector2(tubeTopR, yTop),
      ];
      const tube = new THREE.Mesh(new THREE.LatheGeometry(pts, 28), wrapMat);
      tube.name = 'burrito_torso_wrap';
      tube.castShadow = true;
      tube.receiveShadow = true;
      g.add(tube);

      // The tuck: a short diagonal fold across the base, the seam a real burrito
      // shows where the tortilla is folded under. Cheap, and it stops the bottom
      // of the tube reading as a machined cylinder.
      const foldMat = toonMat({ color: TORTILLA_SHADE, roughness: 0.82 });
      const fold = new THREE.Mesh(
        new THREE.CapsuleGeometry(tubeBotR * 0.13, tubeBotR * 1.5, 4, 10),
        foldMat
      );
      fold.name = 'burrito_tuck_fold';
      fold.position.set(0, yBot + R * 0.30, tubeBotR * 0.90);
      fold.rotation.z = Math.PI * 0.5 - 0.34;
      fold.castShadow = true;
      g.add(fold);

      return g;
    });

    // ── Foil sleeve over the whole torso tube ────────────────────────────────
    // A first pass ended the sleeve half way up and flared it into a torn collar.
    // The render killed it: the flare sat exactly where the arms hang, so it read
    // as a small grey ruffle rather than a silhouette break, and cool grey is the
    // worst colour to spend at the character's widest point on a cast that owns
    // the warm half of the wheel. The flare moved up to the HEAD tube's diagonal
    // edge instead (where nothing occludes it), and down here the foil simply runs
    // the full height, so head-foil and torso-foil read as one continuous wrap
    // with one diagonal mouth.
    const torso = this.rig.joints.torso;
    const sleeve = new THREE.Mesh(
      new THREE.CylinderGeometry(tubeTopR * 1.035, tubeBotR * 1.05, yTop - (yBot + R * 0.14), 28, 1, true),
      foilShellMat
    );
    sleeve.name = 'burrito_foil_sleeve';
    sleeve.position.y = (yTop + yBot + R * 0.14) * 0.5;
    sleeve.castShadow = true;
    sleeve.receiveShadow = true;
    torso.add(sleeve);

    // Takeaway paper band around the sleeve — the one hot, saturated ring on an
    // otherwise pale character, and the cast owns the warm half of the wheel.
    const band = new THREE.Mesh(
      new THREE.CylinderGeometry(tubeTopR * 1.10, tubeTopR * 1.12, R * 0.34, 26, 1, true),
      bandMat
    );
    band.name = 'burrito_band';
    band.position.y = yBot + (yTop - yBot) * 0.30;
    band.castShadow = true;
    band.receiveShadow = true;
    torso.add(band);
  }


  protected onUpdate(ctx: AnimContext): void {
    this.rig.animate({
      elapsed: this.elapsed,
      move01: ctx.moveSpeed01,
      attack01: this.attackT >= 0 ? this.attackT / this.attackDuration : -1,
      hit01: this.hitT >= 0 ? this.hitT / 0.26 : -1,
      dead01: this.deathT >= 0 ? this.deathT / 0.75 : -1,
    });

    // A faint jiggle through the loose toppings while running, same cadence rig.ts
    // uses for the run bounce (10.5 rad/s) — cheap life, relative to each topping's
    // OWN rest rotation so it settles cleanly rather than drifting.
    const move = THREE.MathUtils.clamp(ctx.moveSpeed01, 0, 1);
    const wobble = Math.sin(this.elapsed * 10.5) * 0.06 * move;
    for (let i = 0; i < this.toppings.length; i++) {
      this.toppings[i].rotation.z = this.toppingBaseRotZ[i] + wobble * (i % 2 === 0 ? 1 : -1);
    }
  }

  /** The rig owns all body motion; the base class's whole-body pass would fight it. */
  protected applyBaseMotion(): void {}
}
