/**
 * Lollipop (Cyber).
 *
 * Built on the shared ChibiRig — see `donut.ts` for the reference implementation of
 * this pattern. The rig supplies torso, arms, hands, legs, feet and all motion; this
 * file authors only the food mass on `rig.joints.head`, the face and a palette.
 *
 * ── ⚠️ THE PARAGRAPH THAT USED TO BE HERE IS KEPT BELOW, BECAUSE IT WAS THE BUG ──
 *
 * > "The written description ('eyes on the stick, mouth on the candy, concentric
 * > red/white swirl disc') is unusual among this cast's face guides — most are treated
 * > as loose vibe references, but this one is kept close to literal because it's a
 * > genuinely distinctive read once built […] so the split face (eyes low on the stick,
 * > mouth up on the candy) falls out naturally instead of needing anything hacky."
 *
 * That reasoning was internally consistent and it produced the character Uri rejected:
 * *"limbs and torso intersecting, MAKING THE FACE INVISIBLE. The candy should have more
 * colors than red only. UNFREEZE THE STRUCTURE — the mouth doesn't have to be above the
 * eyes."* (`docs/DECISIONS-FOR-URI.md` §41.) Both complaints trace to the one `rules.ts`
 * line this file was obeying, and the spec has now been rewritten there. The mouth was
 * above the eyes because the SPEC put it there; the face was occluded by the arms because
 * the spec put the eyes on the one part of the character the arms swing across.
 *
 * ── WHAT THE CHARACTER IS NOW ────────────────────────────────────────────────
 *  • The whole face lives on the CANDY DISC, mouth below the eyes. The disc is the
 *    largest flat frontal surface in the cast, so this also retires the ~3 px eye
 *    problem the old layout fought (see the `stickR` note) BY CONSTRUCTION rather than
 *    by widening a stick that is really a connectivity budget.
 *  • The disc front is a shallow SPHERICAL CAP, and every face feature is mounted
 *    through `discDecal()` — the same "nothing floats, one tangent frame" pattern as
 *    `egg.ts`'s `addShellDecal`. Egg is the cast's face reference and is copied here,
 *    then taken past it: sclera + iris + pupil + two catchlights + lash line per eye.
 *  • The swirl is THREE interleaved Archimedean ribbons in three candy hues on a
 *    candy-white ground, not one red one. Uri: *"more colors than red only."*
 *  • The two cellophane tails that flanked the disc are GONE — a pointed mass either
 *    side of a head reads as an ear or a horn, five for five across this cast, whatever
 *    it is made of. One asymmetric wrapper twist above the disc replaces them.
 *
 * The swirl disc is the silhouette landmark and is built from genuine Archimedean
 * spiral ribbons (not a bullseye of concentric rings) — see `spiralRibbonShape`.
 */

import * as THREE from 'three';
import { BaseCharacter, type AnimContext } from './types';
import type { CharacterDef } from '../game/rules';
import { PALETTE, RARITY_COLORS } from '../game/rules';
import { toonMat, glossyMat, flatMat, outlineGroup, roundedBox } from '../render/toon';
import { ChibiRig, taperedSegment } from './rig';
import { bodyType } from './bodies';
import { CHARACTER_HEIGHT } from '../units';
// `localBounds`/`massAnchor` are gone with the two side tails they placed — the whole
// point of the replacement is that the wrapper twist is anchored on the DISC, not on
// wherever the bounding box happens to be widest.
import { curl } from './appendages';

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
 * This character measured **16.10%** clipped and p95 **0.9781**.
 *
 * It is the cost `docs/STATE.md` records as cast-mean p95 drifting 0.896 -> 0.923
 * during the value pass, seen at the pixel: the dark rung was won (p05 is now better
 * than both plates) and the light end went with it, onto exactly the top-facing
 * surfaces a 58deg camera sees most of. The fix is albedo, and it is NOT a
 * desaturation — scaling a warm off-white DOWN raises its chroma, which is the
 * direction `docs/LESSONS.md` records as falsified four times in the other one.
 */
const CANDY_WHITE = '#DED6C6';  // luma 0.993 -> 0.842
// ── DISC_WHITE — CANDY_WHITE x 0.93, and it is a PROBE RESULT, not a taste choice ──
// The candy disc's own ground. `sepscan --mode chars --ids lollipop` put `clipShare` at
// **0.1233** after this pass's rebuild, against the six-plate Brawl Stars band of
// 0.0072-0.0929 — outside it, on the exact number `e6fed57` spent a round winning
// (0.1610 -> 0.0175). I guessed the cause twice (the domed glossy candy; the near-white
// cellophane twist), dropped the gloss, the dome depth and the twist's albedo, and moved
// it to **0.1192**. Four thousandths. That is `docs/LESSONS.md` §7 — symptom accurate,
// mechanism wrong — and §2: probe before you loop.
//
// `tools/tmp/ch_lollipop_clipmap.mjs` (offline, over PNGs `valuescan` had already
// written; 9/9 selftest including "background above threshold must NOT be counted") maps
// every clipped pixel. **They are one band on the disc's LIT FLANK** — the crown and the
// twist contribute zero — so it is the disc's DIFFUSE response on a 0.842 albedo, not any
// specular and not the twist. The same probe's luma histogram says the fix is small:
// scaling that albedo by 0.95 takes its measured share 0.0171 -> 0.0002, by 0.93 -> 0.0000.
//
// So the disc alone steps down 7%; CANDY_WHITE keeps its value everywhere else (hands,
// wrapper petals, twist cone), and the disc getting darker is a second win for the face —
// `rules.ts` wants the #FFFFFF sclera to be the brightest value on the character, and the
// thing it is drawn against just moved further away.
const DISC_WHITE = '#CEC7B8';   // luma 0.842 -> 0.782
const CANDY_RED = '#E63946';
const STICK = '#E2DBCC';       // matte paper stick (luma 0.969 -> 0.860)
const CYBER = RARITY_COLORS.Cyber; // '#00E5B0' — restrained trim accent only
// ── The WRAPPER is the dark rung ─────────────────────────────────────────────
// Measured (`tools/tmp/valuescan.mjs`): Lollipop's range already passed, but its P05
// was 0.291 and it carried the LARGEST SINGLE INVISIBLE SEAM in the whole cast —
// `head|hips` at ΔL 0.012 across 130 px. The cause was one shared constant: the candy
// swirl on the head and the wrapper collar on the hips were both `CANDY_RED`, so the
// character's waist simply did not exist.
//
// The wrapper is the natural place for the dark end — it is the one part of a lollipop
// that is not candy, it is 12.2% of the character's pixels across cape + collar +
// petals, and taking it to near-black makes the collar a hard edge against the swirl
// above it. The choker follows it down and the swirl sits one step deeper so the disc
// reads as candy in shadow rather than a flat red plate. Measured at pot_south,
// shipped framing: range 0.656 -> 0.782, p05 0.316 -> 0.191, steps@0.10 6 -> 7,
// figure/ground 0.259 -> 0.204.
const WRAPPER_INK = '#120818';  // cape, collar, petals — near-black cellophane
const CHOKER_INK = '#180C1E';
// PASS 2, and this one is a REVERSAL. Taking the swirl down to #9C2028 read as a
// bigger P05 and measured as a disaster: the head's median fell to 0.47 while the
// wrapper collar sat at 0.41, so `head|hips` — the largest seam in the cast at 130 px
// — stayed invisible and `face|head` joined it. Weak boundary went 38.1% -> 83.4%.
// The swirl goes back to CANDY_RED and the SEPARATION is bought on the other side
// instead, by taking the collar's trim down with the collar. 
const SWIRL_RED = CANDY_RED;    // the disc's ribbon, both faces
// ── THE DISC IS NOW THREE-COLOUR, AND THE HUES ARE PICKED ON A MEASUREMENT ──
// Uri: *"the candy should have more colors than red only, make it colorful."* The
// obvious move — grab any three hues — would have been free to get wrong, because
// this character is the cast's WORST figure/ground case and the disc is its largest
// single mass: `fig` sits pinned at **0.497** at 17 of 18 arena stations against a
// ground at 0.40–0.48, so `dL` is 0.02–0.10 BY CONSTRUCTION (`docs/DECISIONS-FOR-URI.md`
// §41). Any hue that lands INSIDE 0.40–0.48 is colour that costs separation.
//
// So both new arms are chosen ABOVE the ground band, not merely "different":
//   CANDY_WHITE  #DED6C6  luma 0.842   the ground between the arms (unchanged)
//   CANDY_SUN    #FFC53D  luma ~0.80   warm, high-key
//   CANDY_TEAL   #3FD3B8  luma ~0.73   COOL chroma — `docs/LESSONS.md` records that
//                                      adding cool chroma is cheaper than removing warm,
//                                      and this is a tint of her own Cyber accent so it
//                                      is authored rather than invented
//   CANDY_RED    #E63946  luma ~0.48   kept as the identity anchor: a lollipop that is
//                                      not red at all stops reading as this character
// Two values on the disc becomes four, all but the anchor above the ground band.
const CANDY_TEAL = '#3FD3B8';
const CANDY_SUN = '#FFC53D';
// ── The LEG family, and why the legs are red at all ─────────────────────────
// Arms and legs on this character were the same geometry in the same two tones with
// the same stripe rings, so she read as a four-legged thing on a stick. The pairs
// are now split on HUE — teal sleeves, red trousers — and the legs still ALTERNATE
// down their own length, because `valuescan --mode gate` steers on `minDL`, the
// weakest CONTACT pair, and a limb flattened to one tone takes `hipL|kneeL` to ~0.
// The first draft of this did exactly that and would have failed the gate.
// CANDY_RED is also the value this palette was missing: BOOT sits at 0.05 and
// LIMB_TEAL at 0.78 with nothing between them, so the legs are a rung in their own
// right rather than a repeat of the arms.
const CANDY_RED_DEEP = '#A81E31';   // shin — one rung under CANDY_RED
// The cellophane twist above the disc. Pale and cool rather than near-black — see
// `buildSilhouetteEvents` for the render that reversed that, and note it is a HALF-STEP
// above CANDY_WHITE so the twist separates from the candy's own top edge instead of
// disappearing into it.
// ── ⚠️ #EFF9F4 -> #DCEBE3, AND IT IS A MEASURED REVERSAL ─────────────────────
// The first pale value was picked to sit a half-step ABOVE CANDY_WHITE so the twist would
// separate from the candy's own top edge. Measured with `sepscan --mode chars --ids
// lollipop`, that plus the domed glossy candy took `clipShare` at the shipped facing from
// **0.0211 to 0.1233**, against a six-plate Brawl Stars band of 0.0072-0.0929 — i.e. OUT
// of the band, on the exact number `e6fed57` spent a whole round winning (0.1610 ->
// 0.0175). A near-white glossy tube with a Fresnel rim, at the TOP of the character where
// the key light lands hardest, is about the worst shape to hand that budget to.
// #DCEBE3 sits just BELOW CANDY_WHITE instead, and the separation is bought at the base
// with the near-black cinch ring rather than at the top with luma.
const CELLO = '#DCEBE3';
const BOOT = '#0C0814';        // near-ink boots — grounds the pale/red palette
// Limb-only frosted-teal family, a tint of Lollipop's own Cyber accent. A second
// independent art-director pass named Lollipop, Egg and Burrito as all converging
// on pale cream/white limbs with dark boots — the disc/stick stay their candy-white
// (that's the "hard sugar candy" read), but arms and legs shift to a cool teal so
// the body carries real hue instead of reading as another pale mass, and it ties
// directly to her own rarity accent rather than borrowing a hue from elsewhere.
const LIMB_TEAL = '#8FE0C9';
// PASS 3. Measured: the boot DELIVERS 0.37 despite a #0C0814 albedo (its own sole and
// trim are pale), so darkening it further buys nothing — the SHIN moves instead.
const LIMB_TEAL_DARK = '#7ACBB0';
// The mouth's own value ladder. `rules.ts`'s face standard asks for an INTERIOR VALUE
// STEP — "a lip line with a genuinely darker throat plane behind it, so it reads as an
// OPENING rather than a painted curve". A solid opaque disc cannot be recessed into
// without cutting a hole in it, so the step is built the way `egg.ts` builds every
// feature: as stacked plates at increasing z, darkest furthest back.
const THROAT = '#2A0E20';      // mouth interior — dark plum, not black; black kills the read
const TONGUE = '#FF6F91';
const TEETH = '#FFFFFF';
const EYE_WHITE = '#FFFFFF';   // must be the brightest value ANYWHERE on the character
const IRIS = '#5A3FC0';

/**
 * Archimedean spiral ribbon: a band of constant width whose centreline radius grows
 * linearly with angle. Built as a single extrudable Shape (outer edge walked forward,
 * inner edge walked back) rather than concentric rings, so it reads as an actual swirl
 * — the shape the description asks for — instead of a dartboard/bullseye approximation.
 *
 * `phase` rotates the whole arm. Three arms at 0 / 2π/3 / 4π/3 interleave into one
 * multi-coloured swirl while every individual arm stays a true Archimedean spiral —
 * which is the part of the old spec `rules.ts` kept ("keep it a genuine Archimedean
 * spiral ribbon rather than a bullseye of concentric rings — that part is right and is
 * the landmark") while releasing "red/white".
 *
 * ⚠️ The band width is not free. Adjacent arms are `pitch / arms` apart in radius, so a
 * band wider than that MERGES them into a solid colour wheel and the swirl disappears.
 * `ARM_BAND` below is derived from that, not guessed.
 */
function spiralRibbonShape(turns: number, rStart: number, rEnd: number, bandWidth: number, phase = 0): THREE.Shape {
  const stepsPerTurn = 48;
  const steps = Math.max(8, Math.round(turns * stepsPerTurn));
  const outer: THREE.Vector2[] = [];
  const inner: THREE.Vector2[] = [];
  for (let i = 0; i <= steps; i++) {
    const t = i / steps;
    const theta = phase + t * turns * Math.PI * 2;
    const r = THREE.MathUtils.lerp(rStart, rEnd, t);
    const ro = r + bandWidth * 0.5;
    const ri = Math.max(0.001, r - bandWidth * 0.5);
    outer.push(new THREE.Vector2(Math.cos(theta) * ro, Math.sin(theta) * ro));
    inner.push(new THREE.Vector2(Math.cos(theta) * ri, Math.sin(theta) * ri));
  }
  const shape = new THREE.Shape();
  shape.moveTo(outer[0].x, outer[0].y);
  for (let i = 1; i < outer.length; i++) shape.lineTo(outer[i].x, outer[i].y);
  for (let i = inner.length - 1; i >= 0; i--) shape.lineTo(inner[i].x, inner[i].y);
  shape.closePath();
  return shape;
}

/**
 * The mouth outline: a wide grin with a shallow upward bow on the upper lip and a deep
 * curve on the lower. `pad` inflates it by a roughly constant amount in every direction —
 * which is how the LIP BAND is built (outer = padded outline, hole = the outline itself).
 *
 * ⚠️ Scaling `w`/`h` instead of padding was tried first and is wrong: the shape's origin
 * sits on the CORNER line, so scaling moves the top edge by 0.3·h·k and the bottom by
 * 1.3·h·k. A 17% scale gave a lip band 0.05·h thick at the top and 0.22·h at the bottom —
 * the upper lip line effectively vanished, which is the one edge that says "this is a
 * mouth" rather than "this is a dark blob".
 */
function mouthShape(w: number, h: number, pad = 0, hole?: THREE.Shape): THREE.Shape {
  const W = w + pad;
  const top = h * 0.30 + pad;
  const bot = h * 1.30 + pad;
  const s = new THREE.Shape();
  s.moveTo(-W, 0);
  s.quadraticCurveTo(0, top, W, 0);
  s.bezierCurveTo(W * 0.86, -bot, -W * 0.86, -bot, -W, 0);
  s.closePath();
  if (hole) s.holes.push(hole);
  return s;
}

/**
 * The candy disc's front/back surface, as a SHALLOW SPHERICAL CAP.
 *
 * The disc used to be a flat cylinder, which is two problems at once: real hard candy
 * is a lens, and a flat plate gives every face feature the same z — so the features
 * were coplanar cards rather than things sitting on a surface. `rules.ts`'s face
 * standard closes with "NOTHING FLOATS. Every feature sits ON a surface, sharing one
 * tangent frame with its neighbours (`egg.ts`'s `addShellDecal` is the pattern)". This
 * is that pattern for a disc.
 *
 * `sag` is the cap's height at the centre above the rim plane. The sphere it is cut
 * from has radius `(R² + sag²) / (2·sag)`; at the eye positions the surface tilts only
 * ~7°, which is the point — enough that the features are genuinely ON the candy and
 * catch the key light unevenly, not so much that they turn away from the camera.
 */
class DiscCap {
  readonly rs: number;
  private readonly base: number;
  constructor(readonly outerR: number, readonly sag: number, readonly halfDepth: number) {
    this.rs = (outerR * outerR + sag * sag) / (2 * sag);
    this.base = Math.sqrt(Math.max(0, this.rs * this.rs - outerR * outerR));
  }
  /** Height of the cap above the rim plane at radius `d` from the disc axis. */
  rise(d: number): number {
    const dd = Math.min(d, this.outerR);
    return Math.sqrt(Math.max(0, this.rs * this.rs - dd * dd)) - this.base;
  }
  /** Front surface z for a point `d` out from the axis (disc-local). */
  z(d: number): number {
    return this.halfDepth + this.rise(d);
  }
  /** Outward unit normal of the front cap at disc-local (x, y). */
  normal(x: number, y: number): THREE.Vector3 {
    const d = Math.min(Math.hypot(x, y), this.outerR);
    const s = d > 1e-6 ? d / Math.hypot(x, y) : 1;
    return new THREE.Vector3(x * s, y * s, Math.sqrt(Math.max(0, this.rs * this.rs - d * d))).normalize();
  }
}

/**
 * ⚠️ `curvedPanel` LIVED HERE and is deleted with the cape it existed for — a
 * `PlaneGeometry` bent around a cylinder. Its signature is recorded because the reason it
 * failed is reusable and is NOT about this character: **a zero-volume sheet cannot be
 * outlined** (`outlineGroup`'s inverted hull of a plane is a full-size opaque black copy
 * of the plane), and it cannot be given a transparent material without becoming a silent
 * occluder unless `depthWrite` is cleared by hand. Both were fixed here, in two separate
 * rounds, and the element still rendered as a black plate. If a costume layer is wanted on
 * any character, give it thickness.
 *
 *     function curvedPanel(radius, arcRad, height, angleOffset = 0, segX = 18, segY = 8)
 *       // PlaneGeometry(arcRad, height, segX, segY), then per vertex:
 *       //   theta = angleOffset + x;  setXYZ(sin(theta) * radius, y, cos(theta) * radius)
 */

/**
 * ── 🚨 LOLLIPOP HAD THE *MILD* HALF OF THE CAP BUG, AND THE RATIO TEST MISSES IT ──
 * The `taperedSegment` COPY that used to sit here is gone; the function is imported
 * from `rig.ts`, which carries the mechanism once for all six files that had it —
 * this was one of the five copies donut's fix never reached. **What stays is what is
 * true of LOLLIPOP.** Her call sites pass radii noticeably SMALLER than
 * `size.radius`: she is a slender candy-on-a-stick character and the rig's default
 * limb thickness read as far too stocky for that.
 *
 * The old body emitted a straight side only when `len >= rTop + rBot`, and when it
 * did not it clamped with `yTopSafe = Math.max(...)` — which does not shrink the
 * caps, it stacks two full hemispheres into a sphere that pokes above its own joint
 * origin. `tools/tmp/cb_rig.mjs` prints the arithmetic. **On lollipop that branch
 * never fires** — every bone here has ratio 0.64-0.74 — so the dramatic failure is
 * not what this character had. What it had is the MILD half of the same bug: with
 * caps of height `rBot` and `rTop` and a bone only ~1.35x their sum, the "straight
 * side" is **11-26% of the bone** and the other 74-89% is two hemispheres. Rendered
 * (`shots/cb/before/lollipop.png`) that is a ball, four to a limb, and Uri's
 * *"limbs disattached or intersecting with the body"* names the result exactly.
 *
 * So the ball read has TWO causes and the ratio test only catches one. Bounding the
 * caps by the BONE — 0.42/0.30 of `len`, sum 0.72 < 1 so a straight side always
 * exists — catches both, and it is the same code either way.
 *
 * ── AND THE CAP FRACTIONS ARE ARGUMENTS, WHICH IS THE OTHER HALF OF THE FIX ──
 * Bounding the caps by the bone still leaves every segment tapering to a POINT at
 * both ends — the profile starts at `(0, -len)`, on the axis — so the limb pinches
 * to zero width at every joint, and `outlineGroup` gives each segment its own ink
 * hull, which traces the pinch. That is a bead whatever the albedo is.
 * INTERIOR caps (the upper arm's bottom, the forearm's top, and the leg
 * equivalents) abut a segment of the same radius and are never visible, so a
 * caller passes ~0.05 for that end and the two lathes share a silhouette tangent.
 * EXTERIOR caps (shoulder, wrist, hip, ankle) keep 0.30/0.42 and stay round —
 * flattening THOSE is what turned donut's limbs into a stack of drink cans.
 */

/**
 * This character's own height, as a multiple of the cast's.
 *
 * It was the metre literal 2.00 until `CHARACTER_HEIGHT` moved. A literal here is
 * a silent opt-out of every cast-wide size decision: six of the eleven carried one,
 * so raising the cast height would have scaled five characters and left six behind.
 */
const H = CHARACTER_HEIGHT * 0.952;

export class LollipopCharacter extends BaseCharacter {
  private rig: ChibiRig;

  constructor(def: CharacterDef) {
    super(def);

    this.rig = new ChibiRig({
      palette: {
        limb: LIMB_TEAL,
        // PASS 3: red mitts measured 0.35 against a boot at 0.37 — `handL|footL` 0.014.
        // White candy mitts are also the reference's own grammar (light extremities on a
        // mid body) and this character already owns that white.
        hand: CANDY_WHITE,
        foot: BOOT,
        torso: STICK,
        // ── The rig's new pelvis, recoloured OFF its default ──────────────────────
        // `fc4d9ad` added a pelvis mass on `hips` because `limbmatch` had no `hips` row
        // for 10 of 11 characters and Uri reported detached legs on three sheets running.
        // It defaults to `limb` deliberately (rig.ts: "the pelvis is the top of the legs")
        // and on ten characters that is right. On THIS one it is not, and the render says
        // so: lollipop is the one character that ALREADY had a hips mass — the near-black
        // wrapper collar — so the default put a LIMB_TEAL wedge on top of a WRAPPER_INK
        // collar, both poking out of a cream stick, and at the lobby camera the pair reads
        // as two unrelated chips stuck to the body rather than as one hip.
        //
        // WRAPPER_INK merges it INTO the collar: one dark wrapper band where the stick
        // enters the body, with a full value step to the cream stick above (0.86) and to
        // the teal thighs below (0.83). It keeps every pixel the rig fix delivered — the
        // mass is unchanged, only its albedo — and it does not re-open the seam the rig
        // was closing, because the seam it was closing is hips-to-THIGH and the thigh is
        // still the brightest thing next to it.
        pelvis: WRAPPER_INK,
        limbRoughness: 0.75,
      },
      // Body: STUB archetype (see `bodies.ts`) — no torso, head mounted low,
      // very short limbs. This is the archetype's cleanest fit in the whole cast:
      // a lollipop is literally a disc on a stick, and the stick already reaches
      // past the head origin down to the hips (`stickBottomY` below), so it
      // becomes the body outright. The torso it used to wear was a costume on an
      // anatomy the food does not have.
      //
      // `shoulderWidth` is the cast's narrowest by a wide margin, and that is the
      // STUB hand-fit doing its job: at shoulder height this character is a
      // 0.19R stick, not a 0.9R ball, so the stock 0.32H would leave both arms
      // hanging in mid-air unattached to anything.
      proportions: bodyType('stub', {
        height: H,
        // Unchanged. STUB was given a torso this round and it measured INVISIBLE at
        // the shipped camera (`bodies.ts`, `torsoFraction`) — this character's
        // `headFraction` moved with it and moved back. Recorded because the next
        // pass will want the arithmetic: a 0.16H torso costs `2 * 0.16 / (1 + 0.95)
        // = 0.1641` of `headFraction` to keep the top of the head still, i.e.
        // 0.72 -> 0.5559. Measured `neckPinch` at the shipped facing: **0.0769**
        // against a six-plate Brawl Stars floor of 0.2449.
        headFraction: 0.72,
        // ── 0.085H -> 0.20H, and the reason is NOT the stick ────────────────────
        // The old value was reasoned from the stick's own radius, and the
        // reasoning was sound about the stick and wrong about the character: at
        // shoulder height this body measures 0.366m half-wide, because the wrapper
        // cape and the petal cuff are out there too. The pivot at 0.170m was
        // therefore 0.196m INSIDE the silhouette — `handL`'s world x came out at
        // -0.02m, dead on the body centre-line, inside the stick — and the left
        // arm delivered 0.001 of its upper arm and 0.000 of its forearm.
        // `shots/probe/sil/lollipop.png` has nothing at all on the left side.
        // ── 0.185H -> 0.15H, because 0.185H is OUTSIDE the connectivity window ──
        // The arm has to straddle the stick: its OUTER edge proud of it to be seen,
        // its INNER edge inside it to stay attached. With `stickR` = 0.32R = 0.230 m
        // and `armRadius` = 0.124 m that window is 0.106 m .. 0.354 m of shoulder
        // half-width, and 0.185H = 0.370 m sat just outside the far end — measured,
        // the entire right arm was its own connected component (4,038 px at idle,
        // 4,400 at run) while the left one, pulled in by `hipSway`, was not.
        //
        // ── 🚨 0.17H -> 0.135H. THE WINDOW ABOVE IS CORRECT ARITHMETIC ON TWO ────
        // ── INPUTS THAT HAD BOTH GONE STALE UNDER IT ────────────────────────────
        // Uri, on the lobby render: *"Limbs, and torso intersecting, making the face
        // invisible sometimes"* — and on this character it is the plainest detachment
        // in the cast: all four limbs float clear of the stick with daylight between.
        // Neither the window nor the value derived from it was ever wrong as written.
        // Both of its numbers stopped being true:
        //
        //   1. `stickR` IS NOT 0.32R. The code four hundred lines down says
        //      `R * 0.28` — **0.2016 m, not 0.230 m.** The comment was accurate when
        //      it was written and the constant moved without it.
        //   2. THE ARM IS NOT `armRadius` WIDE. `dressLimbs` built the upper arm at
        //      `size.radius * 0.66` — **0.0818 m against the 0.1240 m the window
        //      assumes.** The window was solved for a limb 52% thicker than the one
        //      that gets built.
        //
        // Both errors push the same way, so they compound: inner edge = 0.340 −
        // 0.0818 = **0.2582 m against a stick surface at 0.2016 m**, i.e. the arm
        // starts **0.057 m OUTSIDE the body** — about 30 px at the lobby camera,
        // which is exactly what the render shows.
        //
        // Fixed on BOTH terms rather than by moving the pivot alone, because the
        // thin limb is independently the bead-necklace defect this pass is here for:
        // the arm goes to 0.95 of the rig radius (0.1178 m) and the pivot to 0.135H
        // (0.270 m), giving inner edge 0.1522 m and a **+0.049 m overlap** — while
        // the outer edge at 0.388 m still stands 0.186 m proud of the stick, which is
        // the other half of the window and the reason it cannot simply be pulled in.
        //
        // ⚠️ `limbmatch --mode chars` reports `detach 0 px, isl 1` for this character
        // at BOTH yaw 0 and yaw 90, BEFORE and AFTER. It is not wrong: at the 58deg
        // match camera the figure is ~190 px tall, the gap is sub-pixel and the ink
        // hulls bridge it. This defect is only visible at the lobby camera, which is
        // CLAUDE.md #3 in its purest form — the shallow view is the DETECTOR.
        shoulderWidth: H * 0.135,
        // ── STUB's widened 0.225H stance is wrong for a character this narrow ────
        // Every other STUB mass is 0.5-1.0m wide at hip height and needed the legs
        // pushed out from under it. This one is a 0.41m stick, so 0.45m of stance
        // put BOTH legs entirely off the body: measured, 12,409 px of limb in its
        // own connected component. 0.135H straddles the stick — the thigh's inner
        // edge lands inside it and its outer edge proud of it — which is the same
        // window the arms are fitted to, just on a much narrower body.
        // ── NARROWER than the archetype, not wider ──────────────────────────────
        // STUB's stance was widened to 0.225H to get four bottom-heavy masses off
        // their own legs. This character is the exception: below the hip line its
        // body is a 0.41m STICK, and at 0.16H the right thigh's inner edge already
        // sat 0.013m OUTSIDE it — the leg was only joined to the character by the
        // wrapper cape's inverted-hull outline, which is to say by the rendering
        // bug fixed further down this file. Removing that black slab revealed a
        // latent detachment worth 12,635 px; 0.145H closes it properly, with both
        // thighs overlapping the stick. Measured 0 px detached at idle, 1 px at run.
        // ── 0.145H -> 0.11H, because the round-2 leg rewrite HALVED the bridge ───
        // `legRadiusF` went 0.075 -> 0.058 cast-wide (see `bodies.ts`), so the thigh
        // that used to overlap the 0.41 m stick by 0.065 m now overlaps it by 0.031 m
        // — about 8 px — and the right arm-and-leg went back to being their own
        // connected component, 8,406 px at idle. The stance is what pays for that
        // overlap on this character, so the stance is what has to move with it.
        // 0.11H restores a 0.10 m (~25 px) bridge on both sides.
        // ── 0.145H -> 0.132H, the same correction as `shoulderWidth` above ───────
        // The thigh has the identical stale term: built at `size.radius * 0.66` =
        // 0.0766 m, so its inner edge sat at 0.290 − 0.0766 = **0.2134 m** against a
        // stick that is 0.2016-0.2117 m — a bridge of about ONE MILLIMETRE, which is
        // zero at any camera. The thigh goes to 1.10 of the rig radius (0.1276 m,
        // deliberately FATTER than the arm's 0.95 — legs read as legs partly by being
        // the heavier pair) and the stance to 0.132H = 0.264 m, for an inner edge of
        // 0.1364 m and a **+0.065 m overlap**.
        // ── 0.132H -> 0.115H, and the reason is `hipSway`, not the arithmetic ────
        // Rendered at 0.132H the LEFT leg overlaps the stick cleanly and the RIGHT
        // one hangs ~27 px clear, which is the signature of an offset rather than a
        // width: `hipSway` 0.20 and `twist` 0.30 swing the stick off the hip line, so
        // a stance solved for a centred body is right on one side and wrong on the
        // other. The sway is this character's whole "cocky, hip-shot" read and is not
        // being spent to fix a geometry error, so the stance absorbs it instead —
        // 0.115H leaves ~0.099 m of overlap, more than the swing.
        stanceWidth: H * 0.115,
        // Same override as Donut's, for the opposite mass: STUB's raised 0.26 is
        // right for a bottom-heavy food, but this character's food is a DISC on a
        // stick and the disc's underside starts at y=0.93m. Lifting the pivot
        // walks the arms up into the candy; 0.18 keeps them on the stick, where
        // the body actually is.
        shoulderFraction: 0.18,
      }),
      // Cocky and hip-shot — weight thrown hard onto one hip, one shoulder popped
      // up, head tilted with attitude. An art director's second pass named the
      // cast's identical dead-front symmetric pose as a top gap and named this
      // exact read ("cocky and hip-shot") as the target for Lollipop specifically;
      // `hipSway` is pushed well past every other character in this file's cast.
      // `shoulderL` +0.70 was the largest inward swing in the cast, on the
      // narrowest body in the cast — the left hand ended up at world x = -0.02m,
      // i.e. through the stick and out the other side. The cocky hip-shot read is
      // carried by `hipSway` 0.20 and `twist` 0.30, both untouched and both still
      // the most extreme in the cast; it never needed the arm to be inside the
      // character.
      stance: {
        shoulderL: -0.14, shoulderR: 0.12,
        elbowL: -0.30, elbowR: -0.55,
        // `headTilt` -0.28 -> -0.13. The stick hangs off `head`, so the tilt swings its
        // BOTTOM by 0.68 m x sin(tilt) = 0.188 m — more than half the stance — and that
        // offset, not any radius, is what buried the left thigh (0.041 delivered) while
        // detaching the right one. `twist` 0.30 and `hipSway` 0.20 carry the cocky read
        // and are untouched.
        twist: 0.30, headTilt: -0.13, headTurn: -0.35,
        hipSway: 0.20, lean: -0.06,
        // Splay ONLY. This character's `stanceWidth` is the narrowest override in
        // the cast (0.11H) and it is narrow BECAUSE the thigh has to straddle a
        // 0.41 m stick to stay attached — two previous rounds moved it inward for
        // exactly that reason and the second one had to move it again after the leg
        // radius halved. Splay leaves the hip pivot, and therefore that overlap,
        // exactly where it is. Measured: 0.1358 -> 0.1759 at 0.5 rad, islands 1.
        // ── 0.46 -> 0.58, and it is paying for a CORRECTION elsewhere ──────────
        // `CHARACTER_HEIGHT` went back 2.35 -> 2.10 this round (`src/units.ts`: the
        // 14-21% band that raised it was re-measured off a ruled frame and does not
        // exist). That is not a uniform-scale no-op for a silhouette read at a 58deg
        // perspective camera — a shorter character's crown sits nearer the view axis
        // and spreads less — and this character was the one it cost: hull deficiency
        // 0.2378 -> 0.1962 at the shipped facing, through the 0.2007 floor, with
        // `coreShare` (0.8158 -> 0.8123) and the appendage count (2 -> 2) both
        // unmoved, i.e. the appendages are all still there and simply reach less far.
        // Isolated by running the height change ALONE, which is the only reason it is
        // attributed correctly: the neck and the albedo work moved nothing here.
        //
        // ⚠️ RAISING THE SPLAY TO PAY IT BACK WAS TRIED AND FAILED, measured: 0.58
        // bought **0.0005** of hull deficiency (0.1962 -> 0.1967) and DETACHED THE
        // LEG — 1,437 px in its own component at yaw 0, against a hard requirement of
        // zero. This character is the one the previous pass already recorded as
        // unable to widen its stance, and the splay is at the same wall. Left at 0.46
        // and the 0.0050 shortfall against the weakest reference plate is REPORTED
        // rather than forced; it is a genuine conflict between the height correction
        // and a floor that was set while the height was wrong.
        splay: 0.46,
      },
    });
    this.body.add(this.rig.joints.root);
    this.head = this.rig.joints.head;

    const R = this.rig.headRadius;
    const head = this.rig.joints.head;
    // The rig's own neck→head offset, read straight off the constructed joint rather
    // than re-derived — this is exactly the gap every other character's food mass
    // extends down to cover, and here it becomes the visible stick.
    const neckGap = this.rig.joints.head.position.y;

    // ── Layout (head-local) ────────────────────────────────────────────────────
    // Round 1 defect: at discOuterR=0.92R centred on discCenterY=0.55R, the disc's own
    // circular footprint (it's a coin, so it spans +-discOuterR in Y too, not just X)
    // reached all the way down to Y=-0.37R — well past the stick's top — so the disc
    // visually swallowed most of the stick from the front. Shrunk and raised so the
    // disc's bottom edge clears the stick with room to spare.
    const discCenterY = R * 0.66;
    const discOuterR = R * 0.74;
    // 0.26R -> 0.28R, PLUS a domed front and back. Neither is decoration:
    //
    //  1. THE STICK WAS FATTER THAN THE DISC WAS DEEP. `stickR` is 0.28R and it is a
    //     CONNECTIVITY BUDGET, not a style choice — it is the only mass four limbs can
    //     attach to on this body. With a half-depth of 0.13R the stick protruded 0.15R
    //     THROUGH THE DISC'S OWN FRONT FACE everywhere the two overlap, which is the
    //     disc's lower third — exactly where the old spec put the mouth. A tapered plug
    //     (below) and a deeper disc together retire that.
    //  2. Real hard candy is a LENS, and a flat plate gives every face feature the same
    //     z. `rules.ts`: "NOTHING FLOATS. Every feature sits ON a surface, sharing one
    //     tangent frame with its neighbours." `DiscCap` is that surface.
    const discDepth = R * 0.28; // real thickness — a paper-thin disc would vanish to a
                                // blade edge-on (idle_135/210), same failure Taco solved
    // 0.10R, and it went 0.10 -> 0.085 -> 0.10 across this pass: flattening it was half of
    // the wrong clipShare theory above and bought a share of 0.0041 between them. The cap
    // is back at the depth that reads as candy, ~7.7° of tilt at the eye positions — enough
    // that the face is genuinely ON a surface and not so much that it turns away.
    const DOME_SAG = R * 0.10;
    const cap = new DiscCap(discOuterR, DOME_SAG, discDepth / 2);
    const discBottomY = discCenterY - discOuterR;
    // ── ⚠️ THE OLD JUSTIFICATION IS KEPT, BECAUSE HALF OF IT IS NOW DEAD ──────
    //
    // > "Widened from 0.19R. This is the character's FACE PLATE as much as it is a stick:
    // > `rules.ts` puts the eyes on the stick and the mouth on the candy, and at 0.19R the
    // > eyes came out ~3px at the size a player sees a character — a blind critic read the
    // > whole model as 'an inanimate prop, not a mascot', because the only thing on the
    // > huge disc was a small mouth arc."
    //
    // The face is no longer on the stick, so that half no longer applies — and its own
    // symptom is what the new layout retires: an eye sized to the DISC is ~4.8x the radius
    // of one sized to the stick, for free. **The rest still holds, and it is the reason
    // this value does not move now that its original motive is gone:**
    //
    // > "0.285R -> 0.32R. The stick is the ONLY thing both arms and both legs can attach
    // > to on this character, so its radius is a connectivity budget, not a styling choice.
    // > The extra 0.035R buys ~9 px of overlap on each of four limbs."
    //
    // Four separate rounds in this file are limbs detaching from this cylinder. It stays.
    const stickR = R * 0.28;
    const stickTopY = discCenterY - discOuterR * 0.5; // embeds into the disc's underside
    const stickBottomY = -neckGap * 1.12; // reaches past the neck join, into the torso —
                                           // no visible gap between stick and body

    // ── Candy disc ───────────────────────────────────────────────────────────
    // A LATHE, not a cylinder: domed front, straight rim wall, domed back. The rim wall
    // is kept — it is what the disc presents EDGE-ON at the shipped spawn facing (yaw 90,
    // where `valuescan` measures this character's bounding box as 39 px wide against
    // 126 tall), and a pure lens would taper it away to a blade.
    //
    // ⚠️ The profile MUST be wound with y INCREASING. `taperedSegment` below carries the
    // scar: an earlier lathe in this same file was wound top-to-bottom and every limb
    // using it rendered near-black, because `computeVertexNormals`'s outward-vs-inward
    // call depends on point ORDER, not point position.
    const discProfile: THREE.Vector2[] = [];
    const CAP_SEG = 12;
    for (let i = 0; i <= CAP_SEG; i++) {          // back pole -> back rim (y rising)
      const d = discOuterR * (i / CAP_SEG);
      discProfile.push(new THREE.Vector2(d, -cap.z(d)));
    }
    discProfile.push(new THREE.Vector2(discOuterR, cap.halfDepth)); // the rim wall
    for (let i = CAP_SEG - 1; i >= 0; i--) {      // front rim -> front pole (y rising)
      const d = discOuterR * (i / CAP_SEG);
      discProfile.push(new THREE.Vector2(d, cap.z(d)));
    }
    const discGeo = new THREE.LatheGeometry(discProfile, 44);
    discGeo.computeVertexNormals();
    discGeo.rotateX(Math.PI / 2);
    // ⚠️ `rim: true` on every `glossyMat` in this file. `toonMat` applies the Fresnel
    // rim by default; `glossyMat`'s is OPT-IN (`aeee0b9`) and **no call site anywhere
    // passed it**, so the eighteen `MeshPhysicalMaterial`s in the cast — the wet and
    // candy surfaces that most want a wet edge — were the only materials in the game
    // with no edge response at all. Lollipop is the most glossy-dominated character
    // there is, so it is where this is worth the most and where it is riskiest: its
    // near-white clipping was the hardest-won number of `e6fed57` (`clipShare` 0.1610
    // -> 0.0175 against a reference band max of 0.0929). The per-character `clipShare`
    // run gated it and says ON here; **soup is the one that FAILS it** (0.0883 ->
    // 0.0976, past the band) and egg is a no-op (0.33/255 over 1.67% of its matte).
    // ⚠️ TRIED AND REVERTED, and the number is the point: roughness 0.12 -> 0.22 with
    // `rim: false`, on the theory that a DOME has a grazing ring around its whole
    // circumference where a flat plate had none. Measured, together with DOME_SAG 0.10R ->
    // 0.085R, it moved `clipShare` **0.1233 -> 0.1192** — 0.0041, for the glossiest surface
    // in the cast going matte. Reverted; the cause was the disc's ALBEDO (see DISC_WHITE),
    // which is where the fix went instead. This is the single hardest shading surface in
    // the game on purpose — hard sugar candy.
    const candyMat = glossyMat({ color: DISC_WHITE, roughness: 0.12, rim: true });
    // Everything that belongs to the candy — base, three swirl arms front and back, edge
    // ring, Cyber trim — hangs off ONE group centred on the disc, so every disc-local
    // coordinate below is literally disc-local and the back-face swirl can be a plain
    // 180° rotation about the disc's own axis. The face joint is re-anchored to the same
    // origin in `buildFace`, which is what lets the face share the disc's tangent frame.
    const discGroup = new THREE.Group();
    discGroup.name = 'lollipop_disc';
    discGroup.position.y = discCenterY;
    head.add(discGroup);

    const disc = new THREE.Mesh(discGeo, candyMat);
    disc.name = 'lollipop_candy_base';
    disc.castShadow = true;
    disc.receiveShadow = true;
    discGroup.add(disc);

    // ── THE SWIRL: THREE interleaved Archimedean arms, three candy hues ────────
    // Uri: *"the candy should have more colors than red only, make it colorful."* One
    // red ribbon on white is TWO VALUES, which is the same defect `rules.ts` records for
    // the faces ("our faces carry two values total"), just on the largest mass in the
    // character.
    //
    // The band width is DERIVED, not chosen. Adjacent arms sit `pitch / ARMS` apart in
    // radius; a band wider than that merges them into a solid colour wheel and the
    // spiral — the landmark `rules.ts` explicitly keeps — disappears. At 62% of the
    // separation, ~59% of the disc face is coloured ribbon and ~41% stays candy-white
    // ground, which is close to the red/white ratio the old single arm produced.
    const ARM_TURNS = 2.0;
    const ARM_R0 = discOuterR * 0.10;
    const ARM_R1 = discOuterR * 0.97;
    const ARM_HUES = [SWIRL_RED, CANDY_TEAL, CANDY_SUN];
    const ARM_SEP = ((ARM_R1 - ARM_R0) / ARM_TURNS) / ARM_HUES.length;
    const ARM_BAND = ARM_SEP * 0.62;
    const ribbonT = R * 0.05;
    // The swirl is now CONFORMED to the domed face instead of being a flat card laid on
    // a flat plate: every vertex's z is pushed to the cap surface at its own radius, so
    // the ribbon curves with the candy and the face features that sit on top of it share
    // that same surface. `ribbonFrontZ` — a single flat z that the old mouth and blush
    // were placed against — no longer exists, because there is no single z.
    const swirlBack = new THREE.Group();
    swirlBack.name = 'lollipop_swirl_back';
    swirlBack.rotation.y = Math.PI;  // a true 180° turn, NOT `scale.z = -1`: a negative
                                     // scale inverts face winding and lights the mesh
                                     // from the inside. It also mirrors the spiral, which
                                     // is what the back of a real disc actually looks like.
    ARM_HUES.forEach((hue, i) => {
      const shape = spiralRibbonShape(ARM_TURNS, ARM_R0, ARM_R1, ARM_BAND, (i / ARM_HUES.length) * Math.PI * 2);
      const geo = new THREE.ExtrudeGeometry(shape, {
        depth: ribbonT, bevelEnabled: true, bevelThickness: R * 0.008, bevelSize: R * 0.008, bevelSegments: 2, curveSegments: 1,
      });
      const pos = geo.attributes.position as THREE.BufferAttribute;
      for (let v = 0; v < pos.count; v++) {
        const d = Math.hypot(pos.getX(v), pos.getY(v));
        pos.setZ(v, cap.z(d) + pos.getZ(v) - ribbonT * 0.55);
      }
      pos.needsUpdate = true;
      geo.computeVertexNormals();
      // The emissive stays on each arm's OWN hue at a low intensity — the old code kept
      // a brighter red emissive under a darker red diffuse so the swirl held its candy
      // glow while its value stepped down. Same trick, three times.
      const mat = glossyMat({ color: hue, roughness: 0.12, emissive: hue, emissiveIntensity: 0.10, rim: true });
      const arm = new THREE.Mesh(geo, mat);
      arm.name = `lollipop_swirl_${i}`;
      arm.castShadow = true;
      arm.receiveShadow = true;
      discGroup.add(arm);
      // A flat disc is one-sided by default — round 1 only decorated the front face, so
      // at yaw 135/210 the candy read as a featureless pale oval, the exact "vanishes to
      // a blank blade off-axis" failure the brief warns about.
      const back = new THREE.Mesh(geo, mat);
      back.name = `lollipop_swirl_back_${i}`;
      back.castShadow = true;
      back.receiveShadow = true;
      swirlBack.add(back);
    });
    discGroup.add(swirlBack);

    // Candy-white edge ring, cleaning up the swirl's outer terminus into a crisp rim.
    // ⚠️ DELIBERATELY LEFT WHITE while the faces went three-colour, and that is a
    // measurement, not an oversight. At the shipped spawn facing the disc is EDGE-ON —
    // `valuescan` measures this character at 39 px wide by 126 tall — so the rim is most
    // of what the arena metric ever sees of the disc, while the faces are what the LOBBY
    // camera sees and what Uri judges. Every candy hue available is DARKER than
    // CANDY_WHITE's 0.842, so striping the rim would have spent `figureLuma` (0.513
    // against a ground of 0.40–0.48) to buy colour at the one camera where the colour
    // does not show. Colour goes where the eye is; value stays where the metric is.
    const edgeRing = new THREE.Mesh(
      new THREE.TorusGeometry(discOuterR * 0.99, R * 0.035, 8, 32),
      candyMat
    );
    edgeRing.name = 'lollipop_edge';
    edgeRing.castShadow = true;
    edgeRing.receiveShadow = true;
    discGroup.add(edgeRing);

    // Restrained Cyber trim — a hairline emissive ring just outside the candy edge.
    // Kept deliberately thin and low-intensity per the brief: a blown-out glow on a
    // Cyber-rarity piece reads as amateur, a hairline accent reads as considered.
    const trim = new THREE.Mesh(
      new THREE.TorusGeometry(discOuterR * 1.03, R * 0.012, 6, 32),
      toonMat({ color: CYBER, roughness: 0.3, emissive: CYBER, emissiveIntensity: 0.4 })
    );
    trim.name = 'lollipop_cyber_trim';
    trim.userData.noOutline = true;
    discGroup.add(trim);

    // ── Stick, in two pieces, and the split is geometric ──────────────────────
    // The shaft stays at full `stickR` for its whole visible length, because that radius
    // is the connectivity budget every limb straddles. Above the disc's bottom point it
    // TAPERS to 0.45·stickR, which is under the disc's own half-depth — so the part of
    // the stick that is inside the candy no longer punches out through the candy's face.
    // That protrusion was a pale bulge across the disc's lower third and it is where the
    // old spec put the mouth.
    //
    // ⚠️ The taper start is CLAMPED against the rig's own shoulder height rather than
    // eyeballed. `metrics.shoulderY` is torso-local (origin = the hips), so in head-local
    // terms the shoulder sits at `hipY + shoulderY - headCentreY`; thinning the stick at
    // or below that point would pull the arms' attachment out from under them, and this
    // is the character whose file already records four separate rounds of limbs
    // detaching from this exact cylinder.
    const m = this.rig.metrics;
    const shoulderHeadY = m.hipY + m.shoulderY - m.headCentreY;
    const taperY = Math.max(discBottomY - R * 0.06, shoulderHeadY + m.armRadius + R * 0.10);
    const stick = new THREE.Mesh(
      new THREE.CylinderGeometry(stickR, stickR * 1.05, taperY - stickBottomY, 16, 1, false),
      toonMat({ color: STICK, roughness: 0.75 })
    );
    stick.name = 'lollipop_stick';
    stick.position.y = (taperY + stickBottomY) / 2;
    stick.castShadow = true;
    stick.receiveShadow = true;
    head.add(stick);

    const plug = new THREE.Mesh(
      new THREE.CylinderGeometry(stickR * 0.45, stickR, Math.max(R * 0.05, stickTopY - taperY), 16, 1, false),
      toonMat({ color: STICK, roughness: 0.75 })
    );
    plug.name = 'lollipop_stick_plug';
    plug.position.y = (stickTopY + taperY) / 2;
    plug.castShadow = true;
    plug.receiveShadow = true;
    head.add(plug);

    // Twisted wrapper cuff where the stick meets the body — alternating red/white
    // "petals", echoing real candy-stick wrapper twists and doubling as the torso's
    // contrasting costume accent (per the brief: dress the body in contrasting
    // colours, not one flat tone).
    // ── DO NOT SHRINK THIS WITHOUT RE-MEASURING THE LEGS ───────────────────────
    // At `stickR * 1.3` each cone reaches 2.15 stick-radii (0.44m) from the axis,
    // past the thigh's own outer edge — so it does bury part of the left leg. It is
    // also, measurably, the only thing CONNECTING the right leg to the body: below
    // the hip line this character is a 0.41m stick and the legs stand 0.64m apart,
    // so with the cuff narrowed to 0.55 the right leg became its own connected
    // component (12,608 px detached at idle, 13,284 at run) — a strictly worse
    // failure than the burial it was meant to fix. Tried and reverted; the real fix
    // is longer legs on the STUB archetype, which is called out in the handover
    // rather than attempted here.
    // 1.3 -> 0.80, and lifted from `+0.14R` to `+0.30R` so the cuff sits just ABOVE
    // the hip line rather than straddling it. The warning above was written when the
    // cuff was the only thing connecting the right leg to the body; with `stanceWidth`
    // at 0.11H the thighs now overlap the stick itself by 0.10 m each, so the cuff is
    // no longer load-bearing and can stop covering 100% of both thighs (`hipL`
    // delivered 0.006 of a 1,426 px footprint with the cuff reaching 0.44 m).
    const petalGeo = new THREE.ConeGeometry(stickR * 0.55, R * 0.18, 3, 1, true);
    const petalMatA = toonMat({ color: WRAPPER_INK, roughness: 0.68 });
    const petalMatB = toonMat({ color: CANDY_WHITE, roughness: 0.68 });
    for (let i = 0; i < 6; i++) {
      const a = (i / 6) * Math.PI * 2;
      const petal = new THREE.Mesh(petalGeo, i % 2 === 0 ? petalMatA : petalMatB);
      petal.name = 'lollipop_wrapper_petal';
      petal.position.set(Math.cos(a) * stickR * 0.75, stickBottomY + R * 0.50, Math.sin(a) * stickR * 0.75);
      petal.rotation.set(0.4, a, 0);
      petal.castShadow = true;
      petal.receiveShadow = true;
      head.add(petal);
    }

    // ── Wrapper collar, on the HIPS — the one thing both legs can hold on to ────
    // The stick is parented to `head` (it has to be: the eyes are built onto it), so
    // it inherits `headTilt`. At -0.28 rad and 0.68 m of lever that swings the stick's
    // BOTTOM 0.188 m sideways, which is more than half the stance — measured, the left
    // thigh ended up buried inside the stick (0.041 delivered) while the right thigh
    // and foot became their own connected component (4,325 px) in the same frame.
    // Widening the stick fixes one and worsens the other; there is no radius that
    // fixes both, because the failure is the OFFSET, not the width.
    //
    // A short wrapper collar on `joints.hips` does not inherit the tilt, so it sits
    // symmetrically over both hip pivots by construction. It is also the honest read:
    // this is the twisted candy wrapper where the stick enters the body.
    {
      const collarR = this.rig.metrics.stanceWidth * 0.86;
      const collarH = this.rig.metrics.thighLength * 0.55;
      const collar = new THREE.Mesh(
        new THREE.CylinderGeometry(collarR, collarR * 0.82, collarH, 18, 1, false),
        toonMat({ color: WRAPPER_INK, roughness: 0.68 })
      );
      collar.name = 'lollipop_wrapper_collar';
      collar.position.y = collarH * 0.16;
      collar.castShadow = true;
      collar.receiveShadow = true;
      this.rig.joints.hips.add(collar);
      const collarTrim = new THREE.Mesh(
        new THREE.TorusGeometry(collarR * 0.99, R * 0.022, 6, 22),
        toonMat({ color: WRAPPER_INK, roughness: 0.6 })
      );
      collarTrim.name = 'lollipop_wrapper_collar_trim';
      collarTrim.rotation.x = Math.PI / 2;
      collarTrim.position.y = collarH * 0.16 + collarH * 0.34;
      this.rig.joints.hips.add(collarTrim);
    }

    // ── Face: ALL of it on the candy disc, mouth BELOW the eyes ───────────────
    // The face joint is re-anchored to the disc's own centre, so every coordinate in
    // `buildFace` is disc-local and shares `cap`'s tangent frame. That is also a real
    // improvement to `thumbs.ts`, whose character-select framing rule crops to the
    // bottom of this joint's bounding box and falls back to a guess when the joint is
    // empty or misplaced — it used to describe two features on a stick.
    this.rig.joints.face.position.set(0, discCenterY, 0);
    this.buildFace(R, cap, discOuterR, ribbonT);

    // ── Torso: candy-wrapper costume, contrasting the pale limbs ──────────────
    this.dressTorso(R);

    // ── Costume: the wrapper gather under the candy ───────────────────────────
    // The anchor sits under the disc — where a real wrapper is twisted shut — rather than
    // on the neck joint, which on a STUB body is at the HIPS: a cape hung off it started
    // at hip height and ran through the floor.
    const capeAnchor = new THREE.Group();
    capeAnchor.name = 'lollipop_cape_anchor';
    capeAnchor.position.y = discBottomY;
    head.add(capeAnchor);
    const neck = capeAnchor;
    const twistMat = glossyMat({ color: CANDY_WHITE, roughness: 0.14, rim: true });

    // ── 🔴 THE CAPE IS DELETED — AND SO IS THE REASON I FIRST GAVE FOR IT ──────
    // What it was: a `curvedPanel` of WRAPPER_INK at 0.6 opacity wrapped round the back of
    // the stick, plus a CYBER-emissive hem. Its own comment block recorded TWO earlier
    // rounds spent stopping it rendering as a black slab — `depthWrite` on a transparent
    // material, then `outlineGroup`'s inverted hull, which on a PLANE is a full-size opaque
    // black copy of the plane because ink cannot outline a surface with no interior. Both
    // diagnoses were right, both fixes landed, and the element still contributed nothing a
    // render could show. It is `rules.ts`'s converse rule — detail added to signal the
    // subject destroying the silhouette that signalled it better — on a character whose
    // entire read is a clean coloured disc on a stick.
    //
    // ⚠️ AND THE CORRECTION, because I had the mechanism wrong first. I blamed the cape for
    // the near-black plate and bright teal wedge sitting across the stick at hip height in
    // `lobby_yaw0/35/170`. **Deleting the cape did not move them** — they are still there
    // in the next render. They are the WRAPPER COLLAR (near-black, on `hips`) and the rig's
    // new PELVIS (`fc4d9ad`, LIMB_TEAL by default), and the giveaway was in the first batch
    // before I touched anything: they appear at yaw 0 AND at yaw 170, so whatever they are
    // is radially symmetric, and the cape spans only 0.85π centred on the BACK. Fixed
    // instead by giving the pelvis the collar's own ink in the palette above, which merges
    // the two into one hip band. `docs/LESSONS.md` §7: a symptom named accurately, a
    // mechanism named badly — the cape deletion stands on its own evidence, not on this.
    //
    // ⚠️ If a future pass wants a cape back, it must be a SOLID with thickness, not a
    // plane — every failure this element ever had traces to being a zero-volume sheet.

    // Twisted wrapper knot — the gather where the cellophane is pinched shut under the
    // candy, echoing the twist-cone hands and wrapper-petal cuffs already on this
    // character.
    const twist = new THREE.Mesh(new THREE.ConeGeometry(R * 0.16, R * 0.3, 8), twistMat);
    twist.name = 'lollipop_wrapper_twist';
    twist.rotation.x = Math.PI;
    twist.position.set(0, R * 0.16, -R * 0.10);
    twist.castShadow = true;
    neck.add(twist);

    // Choker — a slim candy-cane ring around the stick, the small worn detail
    // underneath the cape's own silhouette break.
    const chokerMat = toonMat({ color: CHOKER_INK, roughness: 0.5 });
    const choker = new THREE.Mesh(new THREE.TorusGeometry(stickR * 1.15, stickR * 0.16, 8, 18), chokerMat);
    choker.name = 'lollipop_choker';
    choker.rotation.x = Math.PI / 2;
    choker.position.y = -neckGap * 0.3;
    choker.castShadow = true;
    head.add(choker);

    // ── Limbs: bespoke, not the shared rig defaults ───────────────────────────
    // An independent art director named the rig's identical capsule-arm/ball-hand/
    // wedge-foot kit as the single biggest "template" tell across the whole cast.
    // Lollipop is slender candy-on-a-stick, so her limbs are noticeably thinner
    // than the rig's default and wear the same red/white candy-cane stripe as her
    // own wrapper-petal cuff; hands are miniature glossy lollipops (a swirl ring
    // echoing the head disc), and feet are dark pointed candy-shoe boots.
    const stickLimbMat = toonMat({ color: LIMB_TEAL, roughness: 0.55 });
    const forearmMat = toonMat({ color: LIMB_TEAL_DARK, roughness: 0.55 });
    const cuffMat = toonMat({ color: WRAPPER_INK, roughness: 0.5 });
    const stripeMat = toonMat({ color: CANDY_RED, roughness: 0.55 });
    const legMat = toonMat({ color: CANDY_RED, roughness: 0.55 });
    const legDeepMat = toonMat({ color: CANDY_RED_DEEP, roughness: 0.55 });
    const candyHandMat = glossyMat({ color: CANDY_RED, roughness: 0.14, rim: true });
    const candySwirlMat = candyMat;

    // ── 🚨 THE FOUR LIMBS WERE ONE OBJECT IN FOUR PLACES ────────────────────────
    // The old mapping put `upperArm` WITH `thigh` and `forearm` WITH `shin`, so an
    // arm and a leg were the same geometry, the same two materials, the same stripe
    // rings, differing only in the terminal cap. Rendered at the lobby camera that
    // is four identical candy chains hanging off a stick, and the character reads as
    // a four-legged thing rather than as a figure. Split on four cues at once:
    //
    //   ARMS  teal sleeve, red candy-cane stripes, a dark cuff, a glossy red candy
    //         ball for a hand — the light, busy, round pair.
    //   LEGS  solid CANDY_RED for their whole length with NO stripes at all, and the
    //         near-black boot — the dark, plain, blocky pair. Red is also the value
    //         this palette was missing between BOOT (0.05) and LIMB_TEAL (0.78): the
    //         legs are now a rung in their own right rather than a repeat of the arms.
    //
    // And the two-tone alternation ALONG each limb is gone. `outlineGroup` gives every
    // mesh its own inverted hull, so a value flip at the elbow put a different colour
    // inside every ink contour — which is a bead, not a joint. One tone per limb, with
    // radii continuous across the joint, leaves the contour as the only separator.
    this.rig.dressLimbs((part, size) => {
      switch (part) {
        case 'upperArmL': case 'upperArmR': {
          const g = new THREE.Group();
          // ── 0.66 -> 0.95 OF THE RIG RADIUS, AND IT IS AN ATTACHMENT FIX ────────
          // See the `shoulderWidth` note in the constructor: the connectivity window
          // this character's proportions are solved against was computed with the
          // RIG's `armRadius` (0.124) while this call site built the segment at 0.66
          // of it (0.082). The arm was 0.042 m thinner than the arithmetic that
          // placed it, on a body 0.20 m wide, and that is most of the gap.
          const m = new THREE.Mesh(taperedSegment(size.len, size.radius * 0.95, size.radius * 0.80, 12, { capTopFrac: 0.30, capBotFrac: 0.05 }), stickLimbMat);
          m.name = `${part}_mesh`;
          m.castShadow = true;
          m.receiveShadow = true;
          g.add(m);
          for (const f of [0.34, 0.70]) {
            const ring = new THREE.Mesh(new THREE.TorusGeometry(size.radius * 0.86, size.radius * 0.11, 6, 14), stripeMat);
            ring.rotation.x = Math.PI / 2;
            ring.position.y = -size.len * f;
            ring.userData.noOutline = true;
            g.add(ring);
          }
          return g;
        }
        case 'forearmL': case 'forearmR': {
          const g = new THREE.Group();
          // Top radius matches the upper arm's bottom in METRES, not in multiplier:
          // 0.80 * 0.1240 = 0.0992 against 0.870 * 0.1140 = 0.0992. The rig gives the
          // forearm a smaller base radius (`metrics.forearmRadius`), so equal
          // multipliers would put a step in the outline at the elbow.
          const m = new THREE.Mesh(taperedSegment(size.len, size.radius * 0.870, size.radius * 0.70, 12, { capTopFrac: 0.05, capBotFrac: 0.30 }), forearmMat);
          m.name = `${part}_mesh`;
          m.castShadow = true;
          m.receiveShadow = true;
          g.add(m);
          for (const f of [0.30, 0.62]) {
            const ring = new THREE.Mesh(new THREE.TorusGeometry(size.radius * 0.72, size.radius * 0.09, 6, 14), stripeMat);
            ring.rotation.x = Math.PI / 2;
            ring.position.y = -size.len * f;
            ring.userData.noOutline = true;
            g.add(ring);
          }
          // The cuff — the one shape that says "sleeve" rather than "leg", and the
          // only place `LIMB_TEAL_DARK` still appears now that the forearm is not a
          // second tone. `noOutline`: an ink hull round a ring this small at this
          // on-screen size is most of the ring.
          const cuff = new THREE.Mesh(new THREE.TorusGeometry(size.radius * 0.64, size.radius * 0.14, 6, 14), cuffMat);
          cuff.rotation.x = Math.PI / 2;
          cuff.position.y = -size.len * 0.94;
          cuff.userData.noOutline = true;
          cuff.castShadow = true;
          g.add(cuff);
          return g;
        }
        case 'thighL': case 'thighR': {
          const m = new THREE.Mesh(taperedSegment(size.len, size.radius * 1.10, size.radius * 0.92, 12, { capTopFrac: 0.30, capBotFrac: 0.05 }), legMat);
          m.name = `${part}_mesh`;
          m.castShadow = true;
          m.receiveShadow = true;
          return m;
        }
        case 'shinL': case 'shinR': {
          // 0.92 * 0.1160 = 0.1067 against 1.022 * 0.1044 = 0.1067.
          const m = new THREE.Mesh(taperedSegment(size.len, size.radius * 1.022, size.radius * 0.84, 12, { capTopFrac: 0.05, capBotFrac: 0.34 }), legDeepMat);
          m.name = `${part}_mesh`;
          m.castShadow = true;
          m.receiveShadow = true;
          return m;
        }
        case 'handL': case 'handR': {
          const g = new THREE.Group();
          const ball = new THREE.Mesh(new THREE.SphereGeometry(size.radius * 0.62, 14, 12), candyHandMat);
          ball.position.y = -size.radius * 0.62;
          ball.name = `${part}_mesh`;
          ball.castShadow = true;
          ball.receiveShadow = true;
          g.add(ball);
          const swirl = new THREE.Mesh(new THREE.TorusGeometry(size.radius * 0.34, size.radius * 0.07, 6, 16, Math.PI * 1.4), candySwirlMat);
          swirl.position.set(0, -size.radius * 0.62, size.radius * 0.5);
          swirl.userData.noOutline = true;
          g.add(swirl);
          return g;
        }
        case 'footL': case 'footR': {
          const boot = new THREE.Mesh(
            roundedBox(size.radius * 1.6, size.len * 0.55, size.radius * 2.6, size.radius * 0.28, 3),
            toonMat({ color: BOOT, roughness: 0.55 })
          );
          // Seated on the floor via `size.groundY` (the joint-local y of the world
          // ground, new on `LimbSize`) rather than by eye. `types.ts` convention #1
          // is "feet at y=0" and the whole cast was 0.08-0.25 m under it; `Math.min`
          // keeps the authored droop as the floor for the value so this can only ever
          // raise a foot, never sink one.
          boot.position.set(0, Math.max(size.groundY + size.len * 0.275, -size.len * 0.42), size.radius * 0.55);
          boot.name = `${part}_mesh`;
          boot.castShadow = true;
          boot.receiveShadow = true;
          return boot;
        }
        default:
          return null;
      }
    });

    this.buildSilhouetteEvents(R, discCenterY, discOuterR);

    outlineGroup(this.root);
    this.collectFlashTargets();
    this.rig.restPose();
  }

  /**
   * SILHOUETTE EVENTS — ONE wrapper twist, ABOVE the disc.
   *
   * ── ⚠️ THE OLD VERSION'S REASONING IS KEPT, BECAUSE IT WAS SOUND AND STILL WRONG ──
   *
   * > "Lollipop measured **hull deficiency 0.1377 with ZERO appendages** at the shipped
   * > facing: at yaw 90 the candy disc is edge-on, so the whole character is a tall flat
   * > slab. […] it is the ideal shape for this camera, because the two tails leave the
   * > mass sideways at the widest point rather than climbing over it."
   *
   * Two tapered tails leaving the head sideways at ±90° is the *literal* statement of
   * `rules.ts` pattern 1, and Uri named it without seeing the code: **a pointed mass
   * either side of a head reads as an ear or a horn — five for five across this cast
   * (burrito's foil "looks like a goat", egg's shards, hamburger's lettuce, THESE, and
   * pizza's cheese strands), whatever the shape is made of.** The metric that motivated
   * them is real; the shape it selected was the one shape this character could not wear.
   *
   * The replacement keeps the metric's requirement and drops the horn read, using all
   * three of the escape routes `rules.ts` lists:
   *   • **RE-PLACED** — above the mass, not beside it. This is also the honest object:
   *     every wrapped lollipop in the world is twisted shut at the TOP, not at 3 and 9
   *     o'clock.
   *   • **RE-SHAPED** — it hooks over and droops, and its tip is a rounded knot rather
   *     than a taper. Horns are straight and they point; this flops.
   *   • **ASYMMETRIC** — one, off the disc's axis, leaning. Two mirrored masses is what
   *     makes the brain read "ears" in the first place.
   * It should also do the hull job at least as well: the hook's underside is a real
   * concavity at every yaw, where the old pair only broke the outline sideways.
   */
  private buildSilhouetteEvents(R: number, discCenterY: number, discOuterR: number): void {
    const head = this.rig.joints.head;
    // ── 🔴 IT WAS `WRAPPER_INK`, AND THE FIRST RENDER OF THIS PASS KILLED THAT ──
    // The inherited reasoning was: near-black ties the twist to the cape and collar and
    // keeps the new mass inside the dark rung rather than adding another light one. Sound,
    // and wrong once looked at. At the lobby camera a near-black tube rising off a
    // character's crown does not read as cellophane at all — it reads as an ANTENNA or a
    // TAIL, which is the same class of error as the horns it replaced: the SHAPE is judged
    // by where it sits and how it is valued, not by what it is nominally made of. Pale,
    // glossy, high-key is what says "clear plastic wrapper".
    //
    // The dark rung it was carrying is not lost: the cape it matched is deleted this pass
    // and the boots (#0C0814), hip collar and choker still hold p05 at 0.083 against a
    // 0.18 cap, i.e. with room to spare — measured, not assumed.
    const filmMat = glossyMat({ color: CELLO, roughness: 0.30, rim: false });
    // The cinch stays near-black so the twist still has a value step at its root rather
    // than melting into the candy's own top edge.
    const cinchMat = toonMat({ color: WRAPPER_INK, roughness: 0.42 });

    // Anchored on the disc's own top edge rather than through `massAnchor`, because the
    // whole point is that this is the wrapper's twist-point — not a generic outline event
    // placed wherever the bounding box happens to be widest, which is what put the old
    // pair at ±90° in the first place.
    //
    // ⚠️ ~55% of the first version's reach. A big hook is a big silhouette event and it was
    // also the largest single element on the character that is not candy — which is
    // `rules.ts`'s converse rule ("detail added to signal the subject can destroy the
    // silhouette that signalled it better") pointed straight at the one thing this
    // character has always had going for it: a clean disc on a stick.
    const base = new THREE.Vector3(R * 0.05, discCenterY + discOuterR * 0.93, 0);
    const pts = [
      base.clone(),
      base.clone().add(new THREE.Vector3(R * 0.06, R * 0.15, -R * 0.01)),
      base.clone().add(new THREE.Vector3(R * 0.16, R * 0.27, -R * 0.03)),
      base.clone().add(new THREE.Vector3(R * 0.27, R * 0.31, -R * 0.035)),  // the hook over
      base.clone().add(new THREE.Vector3(R * 0.31, R * 0.21, -R * 0.030)),  // and the droop
    ];
    const tail = curl(filmMat, pts, { rBase: R * 0.105, rTip: R * 0.062, seg: 16 });
    tail.name = 'lollipop_wrapper_twist';
    head.add(tail);

    // The rounded knot on the end. A taper to a point is a horn tip whatever it is
    // attached to; a ball is a wrapper end.
    const knot = new THREE.Mesh(new THREE.SphereGeometry(R * 0.072, 12, 10), filmMat);
    knot.position.copy(pts[pts.length - 1]);
    knot.scale.set(1, 0.82, 0.9);
    knot.castShadow = true;
    head.add(knot);

    // The gather where the cellophane is cinched against the candy — a small torus at
    // the twist's base, so the twist grows OUT of the disc instead of being parked on it.
    const cinch = new THREE.Mesh(new THREE.TorusGeometry(R * 0.100, R * 0.026, 6, 16), cinchMat);
    cinch.position.copy(base).add(new THREE.Vector3(R * 0.015, R * 0.045, 0));
    cinch.rotation.set(Math.PI / 2, 0, -0.30);
    cinch.castShadow = true;
    head.add(cinch);
  }

  /**
   * THE FACE — all of it on the candy disc, mouth BELOW the eyes.
   *
   * ── ⚠️ THE OLD DOC COMMENT IS KEPT, BECAUSE IT DESCRIBES THE REJECTED CHARACTER ──
   *
   * > "Eyes sit low on the stick (round, alert, a curved surface solved the same way as
   * > the disc/wrap treatments elsewhere in this cast); a sweet closed-smile mouth and
   * > rosy blush sit up on the candy's front face."
   *
   * That is `rules.ts`'s old one-line spec implemented faithfully, and it is the whole of
   * Uri's reject sheet (`docs/DECISIONS-FOR-URI.md` §41): the mouth was above the eyes
   * because the SPEC put it there, and the arms hid the face because the spec put the
   * eyes on the one part of this character the arms swing across. Both halves of that
   * line are retired in `rules.ts` too — changing only this file would leave the next
   * agent to faithfully re-implement the layout Uri just rejected.
   *
   * ── THE STANDARD THIS BUILDS TO, AND IT IS MEASURED ──────────────────────────
   * `rules.ts`: **0% of our eye pixels are above 0.85 luma, against the reference plates'
   * 31.1% and 34.1%. Our faces carry TWO VALUES TOTAL.** Separate meshes fix that, and
   * `egg.ts` — the cast's face reference and the one character Uri rated well — is copied
   * rather than reinvented, then taken past:
   *
   *   sclera  #FFFFFF, and it is the BRIGHTEST ALBEDO ON THE CHARACTER by construction —
   *           above CANDY_WHITE (0.842), the stick (0.860) and the limbs (0.83). Egg's
   *           eye is a white sphere too, but egg's SHELL is near-white, so its sclera
   *           does not separate from its own head. Here the candy behind it is a step
   *           down, so the same construction delivers more.
   *   iris    a real coloured element between sclera and pupil. Egg has none; this is the
   *           "add depth, details, make the face clear and crisp" half of Uri's brief.
   *   pupil   INK, offset up-and-inward from the eye centre so she has a GAZE — both eyes
   *           the SAME way, which is what makes it a gaze rather than two independently
   *           wandering eyes. `rules.ts` is explicit that a centred pupil "reads dead
   *           even when everything else is right".
   *   catchlights  two, `noOutline`, the primary offset opposite the pupil.
   *   lash line    the closed-eye arc DEMOTED FROM BEING THE EYE TO BOUNDING IT. This is
   *                literally the geometry the old build used for the winking eye: it is
   *                not deleted, it is moved to the top of an open one. Removing "closed"
   *                is not removing character.
   *
   * ── AND THE WINK IS GONE, DELIBERATELY ───────────────────────────────────────
   * The old right eye was a genuine closed wink, chosen so the two eyes were not mirrored.
   * The asymmetry was the right instinct and the wrong element: Uri's blind ranking of
   * seven characters tracks CLOSED EYES, and a wink is a closed eye on the half of the
   * face nearest the camera at the lobby's three-quarter yaw. The asymmetry moves to the
   * brows and the lash tilt, which carry it without shutting an eye.
   *
   * Personality per `rules.ts`: bright, hyperactive, sugar-manic. Both eyes wide, brows
   * high and uneven, an open grin with teeth and tongue.
   */
  private buildFace(R: number, cap: DiscCap, discOuterR: number, ribbonT: number): void {
    const face = this.rig.joints.face;
    const ink = PALETTE.ink;

    // Every feature must clear the swirl arms, which stand `ribbonT * 0.45` proud of the
    // candy. The old code hard-coded one flat `ribbonFrontZ` for this and the round-1 note
    // records what happens without it: features "land UNDER the ribbon wherever it happens
    // to cross that point on the swirl and vanish entirely". There is no single z on a
    // domed disc, so the clearance is applied along the surface instead of at one plane.
    const LIFT = ribbonT * 0.45 + R * 0.006;

    /**
     * Mount a feature group flush on the candy's front cap at disc-local (x, y), pushed
     * out along the surface NORMAL by `embed`. Local +Z is the outward normal — the exact
     * contract of `egg.ts`'s `addShellDecal`, which is why the whole face shares one
     * tangent frame and cannot drift out of plane.
     */
    const decal = (x: number, y: number, embed: number): THREE.Group => {
      const n = cap.normal(x, y);
      const g = new THREE.Group();
      g.position.set(x, y, cap.z(Math.hypot(x, y))).addScaledVector(n, embed);
      g.quaternion.setFromUnitVectors(new THREE.Vector3(0, 0, 1), n);
      face.add(g);
      return g;
    };

    /**
     * Push a flat extruded plate onto the cap per-vertex, so a wide feature follows the
     * candy instead of hovering over its middle and sinking at its ends. `oy` is where the
     * shape's own origin sits in disc-local Y; the geometry comes out carrying ABSOLUTE
     * disc-local z, so its mesh is placed at z = 0.
     */
    const conform = (geo: THREE.BufferGeometry, oy: number, lift: number): THREE.BufferGeometry => {
      const p = geo.attributes.position as THREE.BufferAttribute;
      for (let i = 0; i < p.count; i++) {
        p.setZ(i, cap.z(Math.hypot(p.getX(i), p.getY(i) + oy)) + lift + p.getZ(i));
      }
      p.needsUpdate = true;
      geo.computeVertexNormals();
      return geo;
    };

    // ── EYES ───────────────────────────────────────────────────────────────────
    // Sized to the DISC, not to the stick. The old build's eyes were 0.44·stickR on a
    // 0.28R stick — this file records them measuring "~3px at the size a player sees a
    // character", and a blind critic reading the whole model as "an inanimate prop, not a
    // mascot". These are 0.255·discOuterR ≈ 0.19R, i.e. **~4.8x the radius**, and they
    // cost nothing structural because the disc is the largest flat frontal surface in the
    // cast. That is what the new `rules.ts` spec means by solving the eye-size problem BY
    // CONSTRUCTION rather than by widening a stick that is really a connectivity budget.
    const eyeR = discOuterR * 0.255;
    const eyeX = discOuterR * 0.335;
    const eyeY = discOuterR * 0.20;
    const gazeX = eyeR * 0.13;
    const gazeY = eyeR * 0.11;

    for (const sx of [-1, 1] as const) {
      const eye = decal(sx * eyeX, eyeY, LIFT);

      const white = new THREE.Mesh(
        new THREE.SphereGeometry(eyeR, 18, 14),
        toonMat({ color: EYE_WHITE, roughness: 0.28 })
      );
      white.scale.set(1, 1.06, 0.40);
      white.name = `lollipop_sclera_${sx > 0 ? 'r' : 'l'}`;
      white.castShadow = true;
      eye.add(white);

      // ── 🚨 THE PUPIL RENDERED AND WAS INVISIBLE. `docs/LESSONS.md` §1 AGAIN ──────
      // Read at 3.5x off the shipped lobby camera (`shots/ey/zoom/lollipop-face-before
      // .png`): each eye is a plain violet disc with two white bites out of it and NO
      // DARK CENTRE AT ALL. The pupil mesh is built, is in the graph, is the right
      // colour, and is drawn — behind the iris. It is arithmetic, in Z:
      //
      //   iris   z 0.26 + radius 0.52 * zScale 0.38 = front face at **0.458** eyeR
      //   pupil  z 0.33 + radius 0.30 * zScale 0.38 = front face at **0.444** eyeR
      //
      // The iris's front stands 0.014 eyeR PROUD OF THE PUPIL'S FRONT, so the smaller
      // sphere is enclosed by the larger one on every ray that could reach it. The two
      // z's were tuned independently and the one that matters is not either z but
      // `z + r*zScale`, which nothing here computed. `rules.ts` asks this character for
      // "dark pupils offset for gaze" and it has never had one.
      //
      // Fixed by separating the FRONT FACES, not the centres: the iris is flattened
      // (0.38 -> 0.30, front 0.416) and the pupil is pushed out and made rounder in Z
      // (0.33 -> 0.36, 0.38 -> 0.34, front 0.462). The pupil now stands 0.046 eyeR
      // proud of the iris — a real dark cap on a coloured lens, which is what an eye is.
      // Neither change moves a silhouette: both are lenses seen face-on.
      const iris = new THREE.Mesh(
        new THREE.SphereGeometry(eyeR * 0.52, 16, 12),
        toonMat({ color: IRIS, roughness: 0.3 })
      );
      iris.position.set(gazeX, gazeY, eyeR * 0.26);
      iris.scale.set(1, 1, 0.30);
      iris.castShadow = true;
      eye.add(iris);

      const pupil = new THREE.Mesh(
        new THREE.SphereGeometry(eyeR * 0.30, 14, 12),
        toonMat({ color: ink, roughness: 0.22 })
      );
      pupil.position.set(gazeX, gazeY, eyeR * 0.36);
      pupil.scale.set(1, 1, 0.34);
      pupil.castShadow = true;
      eye.add(pupil);

      // Primary catchlight. `rules.ts` asks for it as an explicit mesh rather than a
      // specular hit, because a specular is a property of the light rig and walks away
      // when the light moves.
      //
      // ── 🚨 "OFFSET OPPOSITE THE PUPIL'S OWN OFFSET" WAS THE BUG, TWICE OVER ─────
      // That is the old wording and it is kept because it names both mistakes exactly.
      //
      // 1. THE SIZE AND PLACE. `eyeR * 0.17` against a pupil of `eyeR * 0.30` is **57%
      //    of the pupil's radius**, centred `0.354 eyeR` away — so it spanned 0.184 to
      //    0.524 eyeR from the pupil's centre and straddled BOTH boundaries at once:
      //    the pupil's rim at 0.30 and the iris's at 0.52 (tangent to within 1.5%,
      //    which is `hotdog.ts`'s "exactly tangent" case, the one that renders as a
      //    bite at some framings and not at others). It is the same defect `fb9d9da`
      //    fixed on egg at 49% and `75daec3` fixed on pizza at 51%, and it is the
      //    WORST instance in the cast. `glint2` at 0.328 eyeR straddled the pupil too.
      // 2. THE SIGN. `- sx` / `+ sx` mirror both highlights, so the left eye is lit
      //    from the right and the right eye from the left: two eyes reflecting two
      //    different lights facing each other. A catchlight is a reflection of ONE key
      //    (`egg.ts`: *"a catchlight comes from a light in the world, not from a
      //    per-eye mirror"*), so both take a CONSTANT sign.
      //
      // The rebuild keeps two highlights of very different sizes — that contrast is
      // what reads as wet — and puts both ON the pupil, which is the only dark thing
      // an unlit white can be a highlight on.
      //
      // ⚠️ THE MARGIN IS 38%, NOT THE 18% THE CAST RECIPE STATES, and the reason lives
      // in PIXELS so no sum in eye radii can see it (full derivation in `egg.ts`, which
      // was still a Pac-Man after passing its own 18% test):
      //   BLOOM   `stage.ts` thresholds bloom at 0.80 luma and `flatMat` white is
      //           1.000, so a catchlight glows 2-3 px OUTWARD into the pupil's rim.
      //           That is an ABSOLUTE size, which is why the identical recipe measures
      //           0.95 on pizza's 29 px pupils and 0.83 on hotdog's 19 px ones.
      //   BURIAL  a glint whose centre sits BEHIND the pupil's front surface emerges
      //           as a cap displaced OUTWARD from the pupil's axis, because the surface
      //           recedes fastest away from its own apex — so sinking a highlight moves
      //           it further out than it was authored. Both of these are flattened
      //           lenses (`scale.z 0.45`) sitting just PROUD of the surface instead.
      //   key     0.105 eyeR (35% of the pupil radius, the cast's ratio) at 0.081 eyeR
      //           up-and-left of the pupil's centre: 0.270 + 0.350 = **0.620**.
      //           z 0.465 against a pupil front of 0.458 — 0.007 proud, emerging whole.
      //   bounce  0.055 eyeR at 0.095 eyeR down-and-right: 0.317 + 0.183 = **0.500**.
      //           It stays on the pupil rather than in the pupil/iris annulus: at this
      //           character's scale that gap is ~2 px and bloom would close it.
      const glint = new THREE.Mesh(new THREE.SphereGeometry(eyeR * 0.105, 10, 10), flatMat('#ffffff'));
      glint.position.set(gazeX - eyeR * 0.051, gazeY + eyeR * 0.063, eyeR * 0.465);
      glint.scale.set(1, 1, 0.45);
      glint.userData.noOutline = true;
      eye.add(glint);

      // Secondary, small, low and on the far side. Two catchlights is what reads as wet.
      const glint2 = new THREE.Mesh(new THREE.SphereGeometry(eyeR * 0.055, 8, 8), flatMat('#ffffff'));
      glint2.position.set(gazeX + eyeR * 0.060, gazeY - eyeR * 0.074, eyeR * 0.462);
      glint2.scale.set(1, 1, 0.45);
      glint2.userData.noOutline = true;
      eye.add(glint2);

      // ── LASH LINE — the old closed-eye arc, demoted to BOUNDING the eye ───────
      // Capping the top ~155° of the sclera. Its tilt is the character's asymmetry now:
      // the right lid rides higher and cocks harder, which is the same "confident, a
      // little sassy" read the wink carried, without shutting an eye.
      const lidArc = new THREE.Mesh(
        new THREE.TorusGeometry(eyeR * 0.94, eyeR * 0.17, 8, 22, Math.PI * 0.86),
        toonMat({ color: ink, roughness: 0.35 })
      );
      lidArc.rotation.z = Math.PI * 0.07 + sx * 0.16;
      lidArc.position.z = eyeR * 0.12;
      lidArc.scale.set(1, 1.06, 0.55);
      lidArc.castShadow = true;
      eye.add(lidArc);

      // Brows — real shaded geometry on their own decal, so they share the eyes' tangent
      // plane and cannot drift out of it. Cocked hard on the right, high and level on the
      // left.
      const brow = decal(sx * eyeX * 1.02, eyeY + eyeR * (sx > 0 ? 1.44 : 1.30), LIFT);
      const browMesh = new THREE.Mesh(
        new THREE.CapsuleGeometry(eyeR * 0.115, eyeR * 1.02, 4, 8),
        toonMat({ color: ink, roughness: 0.4 })
      );
      browMesh.rotation.z = Math.PI / 2 - sx * (sx > 0 ? 0.42 : 0.20);
      browMesh.castShadow = true;
      brow.add(browMesh);
    }

    // ── MOUTH — an OPENING, not a painted curve ────────────────────────────────
    // `rules.ts`: "THE MOUTH NEEDS AN INTERIOR VALUE STEP — a lip line with a genuinely
    // darker throat plane behind it." A solid opaque disc cannot be recessed into without
    // cutting a hole in it, so the step is built as stacked plates at strictly increasing
    // z, LIP frontmost and THROAT furthest back. Both ladders — depth and value — then run
    // the same way, which is what makes it read as a hole:
    //
    //   plate    z (relative to the candy surface)   albedo luma
    //   throat        -0.006R .. +0.014R                0.09
    //   tongue        -0.016R .. +0.024R                0.55
    //   teeth         +0.008R .. +0.028R                1.00
    //   lip           +0.012R .. +0.034R                0.06   <- frontmost
    //
    // It also clears the character's darkest band by a wide margin, which `rules.ts` flags
    // after taco's mouth fused with its near-black collar and Uri read the pair as a hat
    // brim: the nearest WRAPPER_INK mass here is the hip collar, most of a head below.
    const mw = discOuterR * 0.32;
    const mh = discOuterR * 0.21;
    const mouthY = -discOuterR * 0.30;
    const zAt = (dy: number) => cap.z(Math.abs(mouthY + dy));

    const lipRing = new THREE.Mesh(
      conform(new THREE.ExtrudeGeometry(mouthShape(mw, mh, R * 0.038, mouthShape(mw, mh)), {
        depth: R * 0.022, bevelEnabled: false, curveSegments: 10,
      }), mouthY, LIFT + R * 0.012),
      toonMat({ color: ink, roughness: 0.32 })
    );
    lipRing.name = 'lollipop_mouth';
    lipRing.position.y = mouthY;
    lipRing.castShadow = true;
    face.add(lipRing);

    // Slightly larger than the lip's hole so its rim tucks UNDER the lip band instead of
    // leaving a hairline of candy showing through the ring at an off-axis yaw.
    const throat = new THREE.Mesh(
      conform(new THREE.ExtrudeGeometry(mouthShape(mw, mh, R * 0.010), {
        depth: R * 0.020, bevelEnabled: false, curveSegments: 10,
      }), mouthY, LIFT - R * 0.006),
      toonMat({ color: THROAT, roughness: 0.55 })
    );
    throat.name = 'lollipop_throat';
    throat.position.y = mouthY;
    throat.userData.noOutline = true;   // it lives INSIDE the lip; an ink hull round a
                                        // near-black plate is pure cost
    face.add(throat);

    // Upper teeth. The only pure white below the eyes, and it is what makes the grin read
    // as a grin at gameplay scale instead of a dark hole. Deliberately allowed to overrun
    // the lip's INNER edge — the opaque lip band in front of it hides the overrun, and the
    // alternative (fitting a straight bar inside a bowed curve) leaves a dark gap under
    // the upper lip that reads as a gum line.
    //
    // ── 🚨 IT WAS A `roundedBox`, AND A BAR IN A MOUTH IS A STRIP OF TAPE ────────
    // Read at 3.5x off the shipped lobby camera (`shots/ey/zoom/lollipop-face-before
    // .png`): a flat white RECTANGLE with square ends floating in a black crescent.
    // `pizza.ts` shipped and reverted the identical construction — *"at lobby scale
    // that is a white rectangle stuck inside a mouth, not teeth"* — and it is the same
    // family as `egg.ts`'s brow bars and mouth bars: **nothing that is part of a face
    // has a square end.** Uri's verbatim on the worst-rated face in the cast, *"it
    // looks drawn lines and not an actual face"*, is this complaint.
    //
    // Two changes, and the second is the one that matters:
    //   · the top edge rides the upper lip's OWN curve — `mouthShape`'s
    //     `quadraticCurveTo(0, h*0.30, W, 0)` is the parabola y = 0.15 mh (1-(x/mw)^2),
    //     so the two can never drift apart;
    //   · **the band's HEIGHT tapers elliptically to zero at both ends** rather than
    //     being cut off square. A tooth band has no ends; it disappears into the
    //     corners of the mouth. `taco.ts` carries the note on why "follow the lip"
    //     alone is not enough — on a nearly-straight lip it still renders as a bar.
    // The deliberate overrun past the lip's inner edge (see above) is kept: at
    // TK 0.68 the band is still wider than the opening and the opaque lip band in
    // front of it hides the overrun, so no gum line opens up.
    const TK = 0.68;                       // half-width as a fraction of `mw`
    const TW = mw * TK;
    const T_GAP = mh * 0.06;               // dark lip line above the enamel
    const T_H = mh * 0.38;                 // height AT THE CENTRE; zero at both ends
    const SEG = 24;
    const lipY = (x: number): number => mh * 0.15 * (1 - (x / mw) * (x / mw));
    const tShape = new THREE.Shape();
    for (let i = 0; i <= SEG; i++) {
      const x = -TW + (2 * TW * i) / SEG;
      const y = lipY(x) - T_GAP;
      if (i === 0) tShape.moveTo(x, y); else tShape.lineTo(x, y);
    }
    for (let i = SEG; i >= 0; i--) {
      const x = -TW + (2 * TW * i) / SEG;
      const u = x / TW;
      tShape.lineTo(x, lipY(x) - T_GAP - T_H * Math.sqrt(Math.max(0, 1 - u * u)));
    }
    tShape.closePath();
    const teeth = new THREE.Mesh(
      new THREE.ExtrudeGeometry(tShape, { depth: R * 0.020, bevelEnabled: false, curveSegments: 8 }),
      toonMat({ color: TEETH, roughness: 0.35 })
    );
    teeth.position.set(0, mouthY, zAt(-mh * 0.055) + LIFT + R * 0.008);
    teeth.userData.noOutline = true;
    face.add(teeth);

    const tongue = new THREE.Mesh(new THREE.SphereGeometry(mw * 0.46, 14, 10), toonMat({ color: TONGUE, roughness: 0.45 }));
    tongue.position.set(0, mouthY - mh * 0.68, zAt(-mh * 0.68) + LIFT + R * 0.004);
    tongue.scale.set(1, 0.62, 0.18);
    tongue.userData.noOutline = true;
    face.add(tongue);

    // Blush. `depthWrite: false` because a transparent material that still writes depth is
    // a silent occluder (`docs/LESSONS.md` §1).
    const blushMat = flatMat('#FF9EC4', { transparent: true, opacity: 0.5 });
    blushMat.depthWrite = false;
    for (const sx of [-1, 1]) {
      const bx = sx * discOuterR * 0.60;
      const by = -discOuterR * 0.10;
      const blush = new THREE.Mesh(new THREE.SphereGeometry(R * 0.085, 10, 8), blushMat);
      blush.position.set(bx, by, cap.z(Math.hypot(bx, by)) + LIFT);
      blush.scale.set(1, 0.7, 0.3);
      blush.userData.noOutline = true;
      face.add(blush);
    }
  }

  /**
   * Cream paper-wrapper top with a red sash and a hairline Cyber trim — the same
   * bounding-box technique Burrito uses to size accessories against the ACTUAL
   * constructed torso mesh rather than hand-copied layout constants.
   */
  private dressTorso(R: number): void {
    // No torso under the STUB archetype (`bodies.ts`), so there is nothing to
    // dress and `torsoMesh` is null — this used to be a non-null assertion and
    // would now be a crash rather than a missing sash. Kept intact because
    // switching archetype is a supported one-line fix.
    const torsoMesh = this.rig.torsoMesh;
    if (!torsoMesh) return;
    torsoMesh.geometry.computeBoundingBox();
    const tb = torsoMesh.geometry.boundingBox!;
    const torsoBaseY = torsoMesh.position.y + tb.min.y;
    const torsoTopY = torsoMesh.position.y + tb.max.y;
    const torsoMaxX = tb.max.x;
    const torsoSpan = torsoTopY - torsoBaseY;

    const sash = new THREE.Mesh(
      new THREE.CylinderGeometry(torsoMaxX * 1.05, torsoMaxX * 1.02, torsoSpan * 0.24, 20, 1, true),
      toonMat({ color: CANDY_RED, roughness: 0.65 })
    );
    sash.name = 'lollipop_sash';
    sash.position.y = torsoBaseY + torsoSpan * 0.4;
    sash.castShadow = true;
    sash.receiveShadow = true;
    this.rig.joints.torso.add(sash);

    const trimBelt = new THREE.Mesh(
      new THREE.TorusGeometry(torsoMaxX * 1.04, R * 0.02, 6, 24),
      toonMat({ color: CYBER, roughness: 0.3, emissive: CYBER, emissiveIntensity: 0.35 })
    );
    trimBelt.name = 'lollipop_torso_trim';
    trimBelt.rotation.x = Math.PI / 2;
    trimBelt.position.y = torsoBaseY + torsoSpan * 0.55;
    trimBelt.userData.noOutline = true;
    this.rig.joints.torso.add(trimBelt);
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
