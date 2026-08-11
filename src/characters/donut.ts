/**
 * Donut (Normal).
 *
 * Reference implementation of the shared ChibiRig — the pattern every other
 * character follows. The rig supplies torso, arms, hands, legs and feet plus the
 * whole motion vocabulary; this file authors only what makes it a Donut:
 *
 *   - the food mass mounted on `rig.joints.head`
 *   - the face on `rig.joints.face`
 *   - a palette and per-material roughness
 *
 * Identity is fixed by `rules.ts`: Donut, Normal rarity, Candy Barrage plus the
 * passive Sticky Trail. The 2D description ("crooked smile, sprinkles") is treated
 * as a personality guide rather than a literal spec, per the brief.
 */

import * as THREE from 'three';
import { BaseCharacter, type AnimContext } from './types';
import type { CharacterDef } from '../game/rules';
import { PALETTE } from '../game/rules';
import { toonMat, glossyMat, flatMat, outlineGroup } from '../render/toon';
import { ChibiRig, taperedSegment } from './rig';
import { bodyType } from './bodies';
import { CHARACTER_HEIGHT } from '../units';
import { aim, curl, knob, localBounds, massAnchor } from './appendages';

const GLAZE = PALETTE.glaze;      // #FF9EC4
const DOUGH = '#F5CE86';
const DOUGH_DARK = '#D9A253';
// Shoes deliberately break from the dough/glaze pair — a genuine dark value drop
// ("chocolate-dipped feet") so the body doesn't read as one undifferentiated tan
// mass. `DOUGH_DARK` above is too close in hue/value to `DOUGH` to do that job.
const CHOC_DIP = '#120902';        // boots, darker than the shins above them
// Limb-only pink family — a second independent art-director pass found Hamburger,
// Donut and Taco all converging on the same golden-tan-dough hue for their limbs
// despite different heads. Donut's own icing is already pink, so her limbs lean
// into THAT identity instead of the shared dough tone: a saturated glaze pink for
// the meaty part of the limb, a deeper berry pink for the lower segment, so the
// whole body reads pink-and-cream rather than another tan blob.
// ── The dark rung ────────────────────────────────────────────────────────────
// Measured against 18 Brawl Stars plates: their P05 is 0.097 and all eighteen put 5%
// of the character below 0.18. Donut's was 0.333 — the second-worst in the cast — and
// 33.6% of its part boundaries were under 0.10 apart, the arm chain worst of all
// (`shoulderL|elbowL` 0.097, `elbowL|handL` 0.091, `hipL|kneeL` 0.086). Both are the
// same defect: the whole character lived between 0.44 and 0.81.
//
// The beanie is where the dark end goes — it is 13.9% of the character's pixels in
// ONE mesh, it is the reference's own grammar (near-black hair/hat over a light face),
// and it costs the food nothing. The lower limb tone follows it down so the arm chain
// alternates instead of ramping, and the pompom + dough come up to pay for both in
// figure/ground. Measured at pot_south, shipped framing: range 0.466 -> 0.676,
// p05 0.343 -> 0.173, steps@0.10 6 -> 7, figure/ground 0.262 -> 0.227.
const BEANIE = '#170C28';
const BEANIE_BRIM = '#0E0720';
/** The pompom, and only the pompom. Was `GLAZE`, i.e. the same pink as the icing it
 *  sits above; a wool pompom is the natural light rung and it pays for the beanie. */
const POMPOM = '#FFF6E8';

// ── PASS 2: the limb CHAIN has to alternate, not ramp ────────────────────────
// The first value pass took both limb tones down together. That fixed range/P05 and
// BROKE the part boundary — measured, `shoulderL|elbowL` 0.044, `kneeL|footL` 0.035,
// because a chain of four segments each a shade darker than the last is one mass. The
// reference's grammar is alternation: mid sleeve, dark cuff, light glove. So the upper
// segment comes back UP, the lower segment holds the dark, and the boot takes its own
// darkest tone instead of sharing the shin's.
const LIMB_PINK = '#DE6491';       // upper arm / thigh — mid
// #7E2340 -> #9A3455. `kneeL|footL` measured dL **0.0985** against the gate's 0.10 —
// a 0.0015 miss, i.e. the cliff `docs/TOOLS.md` warns about, and it appeared because
// the boot's own p50 rose 0.0599 -> 0.1000 when `taperedSegment` stopped degenerating
// it into a sphere. Lifting the shin/forearm rung is the safe side of that pair to
// move: `shoulderL|elbowL` has 0.29 of margin and `p05` is 0.08 against a 0.180 cap,
// carried by the beanie and the boots, not by this tone.
const LIMB_PINK_DARK = '#9A3455';  // thigh's partner — the shin, dark
// ── THE SLEEVE IS DOUGH, AND THAT IS WHAT SEPARATES AN ARM FROM A LEG ────────
// See the `dressLimbs` note: arms and legs were byte-identical masses in identical
// tones and the character read as four-legged. Every VALUE on this model is spoken
// for (`head|shoulderL` 0.0315, `kneeL|footL` cleared by 0.0015), so the pairs are
// split on HUE instead — the arms move into the donut's own gold, the legs keep the
// berry-pink. Chosen so each new boundary is better than the one it replaces:
//   ring GLAZE 0.72  ->  sleeve 0.32   `head|shoulderL`   was a mid-pink arm on a
//                                       light-pink ring, the weakest pair on the
//                                       character; gold is a full step away
//   sleeve 0.32      ->  cuff 0.16     `shoulderL|elbowL`
//   cuff 0.16        ->  mitt 0.72     `elbowL|handL`, the glaze mitt unchanged
// and the legs' three pairs are untouched because their three tones are untouched.
const SLEEVE_DOUGH = '#C98A4E';    // upper arm — baked dough, one step under DOUGH
const SLEEVE_DOUGH_DARK = '#8A5324'; // forearm — the same family, one rung down

// ── The ATTACHMENT masses, and why they are DOUGH and not a fifth pink ───────
// Donut is STUB: `torsoFraction: 0`, so there is no body between the ring and the
// limbs at all — `hipL`/`hipR` are empty groups at `(+/-stanceWidth, 0, 0)` and the
// ring is mounted above them. Measured on HEAD at the LOBBY camera
// (`rg_gap --pitch 20 --yaw 0`), that is not a figure of speech:
//
//   bridgeL = 1 px          the narrowest connection between the left leg and the
//                           body is ONE PIXEL wide. 0 would be a separate island.
//   pelvis fill = 0 px      `fc4d9ad`'s rig-level pelvis adds nothing to this
//                           character's silhouette at either shipped camera.
//
// The arithmetic behind it: at the hip line the ring's own half-width is 0.304 m
// while `stanceWidth` is 0.588 m, so each leg hangs 0.284 m outboard of the only
// mass it could attach to, and the ring's underside at that x starts 0.10 m above
// the top of the thigh. The gap is real, it is vertical, and nothing in `rig.ts`
// can close it because the shape that has to be met is this character's torus.
//
// ── 🚨 ROUND 1 MADE THE HAUNCH *DOUGH*, AND IT WAS BUILT, MEASURED, REJECTED ──
// The reasoning was that an attachment mass should read as the donut rather than as
// a fifth object, and gold dough emerging from under pink glaze is literally what a
// glazed donut's own edge looks like. Rendered and measured at the shipped 58 deg
// facing it fails twice, and both failures are worth keeping in front of whoever
// reads this next:
//
//   1. IT IS INVISIBLE TO THE VALUE GATE, BY CONSTRUCTION. `head` p50 renders at
//      0.7230 and a dough haunch at 0.7237 — `head|hips` dL **0.0007**. Add the
//      matching shoulder socket and `head|torso` 0.0482 and `torso|hips` 0.0475
//      join it, and `weakBoundaryPct` goes **12.2 -> 32.5** against a cap of 15.
//      An attachment mass that merges with the body is exactly what the eye wants
//      and exactly what this metric calls a defect; the metric wins, because the
//      cap is the shipped gate.
//   2. IT BURIED THE THIGH — `hipL` delivered **417 -> 108 px**, and `shoulderL`
//      834 -> 471. That is `fc4d9ad`'s own recorded first mistake, committed again
//      one level down: *"a mass that hides the leg is not a fix for 'the legs look
//      detached'."*
//
// So the haunch is a deep berry instead: it renders around 0.20 against the ring's
// 0.723 and the thigh's 0.389, which clears 0.10 on BOTH sides, and it reads as a
// worn piece (shorts) rather than as a lump of the food — which is the same call
// `rig.ts` offers on `RigPalette.pelvis` ("override it only to make it read as a
// garment rather than as body"). The shoulder socket is gone entirely: measured, the
// arm pivot already sits inside the ring's half-width at that height, so the socket
// was buying nothing and costing five new weak pairs and 363 px of upper arm. What
// stays there is the CUFF alone, parented to the ARM — `head|shoulderL` measured
// `dLcontact` **0.0315** on HEAD, the weakest boundary on the character, because a
// mid-pink arm meets a light-pink ring with no value at the join, and a dark band at
// the top of the sleeve is the one shape that sits exactly where that is measured.
const HIP_BERRY = '#6B1B36';

// ── The MOUTH INTERIOR ───────────────────────────────────────────────────────
// Uri: *"the mouth is deeper than burger but still missing details."* The old mouth
// was one ink torus arc lying on the icing — a painted curve with exactly ONE value
// in it. `rules.ts` asks for "a lip line with a darker throat plane behind it", so
// the mouth is now an OPENING: a near-black throat lens (darker than `PALETTE.ink`,
// deliberately, so the lip line reads as the rim of a hole and not as its edge), a
// warm tongue inside it as the light rung, and the ink arc kept as the lower lip.
const THROAT = '#2A0813';
const TONGUE = '#F2758F';

const SPRINKLE_COLORS = ['#E63946', '#7CB518', '#FFC93C', '#7C4DFF', '#2E86D8', '#FFFFFF'];

/**
 * ── 🚨 DONUT IS WHERE THE `taperedSegment` CAP FIX WAS DERIVED ───────────────
 * The COPY that used to sit here is gone; the function is imported from `rig.ts`.
 * **The record below is kept in full and deliberately**: this file is the primary
 * source for the fix, it contains a reversed assertion CLAUDE.md requires be kept
 * with its correction, and — the whole reason there is one function now — *"the fix
 * never reached the other five"*, which is why the bead necklace survived weeks.
 * **The knowledge was written down, correct, and in the repo while the FUNCTION was
 * duplicated. A comment cannot propagate a fix; a symbol can.**
 *
 * Donut's own radii stay close together (soft dough barely tapers) rather than the
 * aggressive wedge the rest of the cast gives it, which is the point: a cast that
 * shares a helper but tunes it per-character reads as one family, not one mould.
 *
 * ── 🚨 THE CAPS WERE SPHERICAL AND UNBOUNDED, AND THAT IS WHY THE LIMBS READ ──
 * ── AS A STRING OF BEADS ────────────────────────────────────────────────────
 * Uri, on the lobby render: *"limbs disattached or intersecting with the body
 * that causes weird shapes."* Rendered and looked at (non-negotiable #3), Donut's
 * arms and legs were not limbs at all — four separate balls per side, alternating
 * pink / dark berry, hanging beside the ring like a bead necklace.
 *
 * The mechanism is arithmetic, not taste. On STUB the bones are SHORT:
 * `upperArmLength` 0.209 m, `thighLength` 0.208 m, `shinLength` 0.170 m — while
 * the radii this file passed in were `radius * 1.16` and `radius * 1.0`, i.e.
 * 0.151 + 0.130 = **0.281 m of cap on a 0.209 m bone**. The old code detected
 * that (`if (yTopCap >= yBotCap)`), SKIPPED the straight side, and then clamped
 * with `yTopSafe = max(...)` — which does not shrink the caps, it just stacks two
 * full hemispheres on top of each other. The result is a sphere ~0.30 m across on
 * a 0.209 m bone, whose top cap reaches **0.072 m ABOVE its own joint origin**, so
 * each segment also pokes up through the segment above it. Four of those in a
 * chain, in two alternating values, is a bead necklace by construction.
 *
 * ── ⚠️ THE CLAIM THAT USED TO CLOSE THIS PARAGRAPH WAS FALSE. IT READ: ───────
 *
 *   > "…which turned the bead necklace into limbs."
 *
 * It did not. It is kept per CLAUDE.md's rule on reversed assertions, because the
 * mistake is more useful than the sentence: **the fix was correct, it was correctly
 * measured, and the defect it was claimed to close was still there in the very next
 * render.** Rendered at the lobby camera on the committed tree
 * (`shots/cb/before/donut.png`, pitch 20 — the camera Uri judges), donut was four
 * chains of alternating pink and berry lumps hanging off a ring.
 *
 * The bead had THREE causes and that fix addressed one of them:
 *   1. caps sized by RADIUS instead of by BONE — fixed, genuinely;
 *   2. every segment tapering to a POINT at both ends, so the limb pinches to zero
 *      width at every joint and the ink hull traces the pinch — see the interior/
 *      exterior cap note below, which is the fix for that;
 *   3. the ALTERNATING VALUE between adjacent segments, which puts a different
 *      colour inside each of those traced contours and confirms the read.
 * Fixing (1) alone leaves (2) and (3) intact, and (2)+(3) are sufficient on their
 * own. `docs/LESSONS.md` §6b, in the form that costs the most: a probe told us what
 * was broken and we read it as telling us what the viewer was reacting to.
 *
 * The fix is to bound each cap by the BONE, not by the radius: the cap heights are
 * clamped to 0.42/0.30 of `len` (sum 0.72 < 1, so a straight side always exists)
 * while the cap's WIDTH stays `rBot`/`rTop`. Two consequences, both wanted:
 *   · the mesh spans exactly y in [-len, 0] — it can never overlap its parent
 *     segment, so consecutive segments abut instead of interpenetrating;
 *   · there is always a real tapered side, so a chain of segments reads as one
 *     continuous limb whose colour changes at the elbow/knee, which is the
 *     reference's own grammar (mid sleeve, dark cuff, light glove) and the thing
 *     the alternating limb tones in this file were introduced to deliver.
 *
 * ── 0.42/0.30 IS A MEASURED CHOICE AND 0.18/0.14 WAS TRIED AND REVERTED ─────
 * Each cap tapers toward the joint and the next segment starts from a point at the
 * same place, so consecutive segments meet through a double taper and the limb has
 * a slight waist at every joint. Shortening the caps to 0.18/0.14 of the bone
 * removes the waist — and rendered (`shots/ch/donut/after4/lobby_3q.png`) it turns
 * every segment into a flat-ended CYLINDER: the limbs read as a stack of drink cans
 * rather than as dough, which is a worse defect than the waist it fixed. It also
 * cost a value rung — `steps@10` at the shipped station **7 -> 6**, against a gate
 * minimum of 6 — because a rounded limb's own shading gradient is one of the
 * plateaus the ladder counts, and flattening it collapsed the arm's.
 * What DOES survive from that round is the resolution: 6 cap segments against 4
 * side steps, and 16 radial, because a 5/3/12 lathe put a shading corner where
 * `computeVertexNormals` has to guess and rendered as a faceted gem.
 *
 * ── 🚨 AND 0.42/0.30 EVERYWHERE IS WHY THE FIX ABOVE DID NOT FINISH THE JOB ──
 * Every segment was a CLOSED CAPSULE: the profile starts at `(0, -len)`, a point on
 * the axis, so each segment tapers to nothing at its bottom, and the next segment
 * down starts from a point at exactly the same place and flares back out. So even
 * with perfectly matched radii the limb has a full pinch to ZERO WIDTH at every
 * joint — and `outlineGroup` draws an ink hull round each one, so the pinch is
 * traced. That is a bead by construction, at any albedo, and no value scheme
 * survives it.
 *
 * The previous round tried to remove it by shortening ALL FOUR caps to 0.18/0.14
 * and got flat-ended cylinders — "a stack of drink cans" — because that also
 * flattened the SHOULDER and the WRIST, which are the two caps you can actually
 * see. The distinction it missed is that a limb's caps are not interchangeable:
 *
 *   INTERIOR caps (the upper arm's BOTTOM, the forearm's TOP, and their leg
 *   equivalents) meet an abutting segment of the same radius and are NEVER VISIBLE.
 *   Flattening those to ~0.05 of the bone makes the two lathes share a silhouette
 *   tangent, so the limb runs as one continuous taper through the joint.
 *
 *   EXTERIOR caps (the shoulder, the wrist, the hip, the ankle) are the ones the
 *   drink-can round flattened by mistake. They keep 0.30/0.42 and stay round.
 *
 * Hence the two fractions are ARGUMENTS, defaulting to the values above so every
 * call site that does not pass them is byte-identical. A caller that knows which end
 * of its bone faces a neighbour passes ~0.05 for that end and nothing else changes.
 */

/** Soft tapered barrel — the same visual language as the rig's own default torso
 * (fuller belly, narrower neck) but built locally so each character can own its
 * material and proportions. */
function torsoBarrel(halfW: number, height: number, halfD: number, taper: number): THREE.BufferGeometry {
  const geo = new THREE.SphereGeometry(1, 22, 16);
  const pos = geo.attributes.position as THREE.BufferAttribute;
  for (let i = 0; i < pos.count; i++) {
    const y = pos.getY(i);
    const t = (y + 1) * 0.5; // 0 bottom .. 1 top
    const bulge = 1 + taper * Math.sin(t * Math.PI * 0.9) - taper * 0.55 * t;
    pos.setX(i, pos.getX(i) * halfW * bulge);
    pos.setZ(i, pos.getZ(i) * halfD * bulge);
    pos.setY(i, y * height * 0.5);
  }
  geo.computeVertexNormals();
  return geo;
}

/**
 * This character's own height, as a multiple of the cast's.
 *
 * It was the metre literal 2.10 until `CHARACTER_HEIGHT` moved. A literal here is
 * a silent opt-out of every cast-wide size decision: six of the eleven carried one,
 * so raising the cast height would have scaled five characters and left six behind.
 */
const H = CHARACTER_HEIGHT * 1.0;

export class DonutCharacter extends BaseCharacter {
  private rig: ChibiRig;
  private sprinkles: THREE.Object3D[] = [];

  constructor(def: CharacterDef) {
    super(def);

    this.rig = new ChibiRig({
      palette: {
        limb: LIMB_PINK,
        hand: GLAZE,
        foot: CHOC_DIP,
        torso: DOUGH,
        limbRoughness: 0.72,
      },
      // Body: STUB archetype (see `bodies.ts`) — no torso at all, head straight
      // onto the hips, very short thick limbs, wide stance. A donut is a ring:
      // it has no neck and no waist to model, and giving it one was the reason
      // this character read as "a torus balanced on the cast's standard body".
      // As a STUB the ring IS the body and the whole silhouette is the landmark.
      //
      // `shoulderWidth` is a STUB-specific hand-fit: the arms have to clear the
      // ring's outer radius (1.04R) at shoulder height, where the torus is
      // ~0.86R wide. See the STUB notes in `bodies.ts`.
      //
      // `legFraction` used to be overridden to 0.20, up from STUB's old 0.15,
      // because a blind critic reading the silhouette said the feet were "two
      // indistinct pink stubs hidden under the ring's overhang, so the silhouette
      // is essentially a circle". STUB itself is now 0.24 and the override is
      // gone — the archetype finally does what this character had to hand-fit.
      //
      // `headFraction` 0.72 -> 0.685 pays for the extra 0.04H of leg so the ring
      // does not grow: STUB's own rewrite makes the same trade at the same rate.
      proportions: bodyType('stub', {
        height: H,
        // Unchanged. STUB was given a torso this round and it measured INVISIBLE at
        // the shipped camera (`bodies.ts`, `torsoFraction`) — this character's
        // `headFraction` moved with it and moved back. Recorded because the next
        // pass will want the arithmetic: a 0.16H torso costs `2 * 0.16 / (1 + 0.95)
        // = 0.1641` of `headFraction` to keep the top of the head still, i.e.
        // 0.685 -> 0.5209. Measured `neckPinch` at the shipped facing: **0.2545**
        // against a six-plate Brawl Stars floor of 0.2449.
        headFraction: 0.685,
        // 0.295H -> 0.345H. Measured: the ring is 0.619m half-wide at shoulder
        // height and the pivot sat at 0.620m — exactly ON the surface, so the whole
        // upper arm was inside the dough (delivery 0.46 left, 0.09 right).
        // 0.345H -> 0.305H. The ring shrank with `headFraction` 0.72 -> 0.685, so its
        // half-width at shoulder height went 0.619 -> 0.589 m while the arm's inner
        // edge stayed at 0.594 — 5 mm OUTSIDE the only mass it can attach to. At run
        // the whole left arm became its own connected component, 11,133 px.
        // 0.345 detached the arm (11,133 px at run), 0.305 buried it (shoulderR 0.375
        // delivered). 0.325H is the middle of a window only 0.084 m wide, which is what
        // a torus gives you: inner edge 0.552 m inside the ring's 0.589 m, outer edge
        // 0.224 m proud of it.
        shoulderWidth: H * 0.325,
        // ── A RING is widest at its own CENTRE, so STUB's new 0.26 is wrong here ──
        // `bodies.ts` raised STUB's `shoulderFraction` from 0.12 to 0.26 because
        // every other STUB mass (bottle, egg, lollipop stick) is widest LOW, so
        // lifting the pivot lifts it clear. A torus is the opposite: at 0.12 the
        // pivot sits 0.47m below the ring centre where the ring measures 0.62m
        // across, and at 0.26 it rises to 0.17m below centre where it measures
        // 0.79m. The archetype's fix would have cost this character 0.17m of extra
        // burial, which is why it is overridden rather than inherited.
        shoulderFraction: 0.12,
        // 0.26H -> 0.225H, back to STUB's own value. The 0.26 was bought to drag the
        // thighs out from under the ring when the legs were 0.20H long; at 0.24H they
        // clear it vertically instead and the width is no longer paying for anything.
        // It is now actively harmful: measured, the ring's own half-width at the hip
        // line is 0.504 m (`tools/tmp/masssit.mjs`) against hips at 0.535 — the legs
        // hung 0.031 m OUTSIDE the only mass they could attach to, and at run the
        // whole left arm-and-leg became its own connected component, 19,248 px
        // detached. That is the second edge of the same window round 1 documented.
        // 0.20H -> 0.28H. The 0.20 was measured against a ring whose half-width at
        // the hip line is 0.504 m — the leg had to overlap the dough to stay
        // attached. That constraint is unchanged and 0.28H = 0.588 m still clears
        // it on the inside edge; what changes is that the outside edge now leaves
        // the ring's shadow, which is where the outline gets its notch.
        stanceWidth: H * 0.28,
      }),
      // Bouncy and playful — hip popped out, head cocked, weight rocked back onto
      // her heels like she's mid-bounce. An art director's second pass named the
      // cast's identical dead-front symmetric pose as a top gap; Donut's read is
      // the cast's "sweetest"/most carefree attitude, distinct from every other
      // stance in this file's cast.
      // Both shoulders swung INWARD, and on this body that is a deletion rather
      // than a pose: `docs/LESSONS.md` §12 — `shoulderL` is the joint at
      // x = -shoulderWidth, so POSITIVE z there swings the arm across the body,
      // and NEGATIVE does the same on the right. +0.55 / -0.15 folded both arms
      // into a 0.62m-wide ring of dough. Signs flipped so both open outward; the
      // bouncy hip-shot read is carried by `hipSway` and `twist`, which are
      // untouched.
      stance: {
        // ── -0.12/0.10 -> -0.30/0.26, AND IT IS THE "INTERSECTING LIMBS" REPORT ──
        // Uri's standing note for this pass names *"limbs disattached or intersecting
        // with the body"*. On this body the arms and the legs are nearly coaxial:
        // `shoulderWidth` 0.6825 m against `stanceWidth` 0.588 m, so an arm hanging
        // at -0.12 rad falls 0.06 m outboard of the thigh and overlaps it down its
        // whole length. That is visible in `shots/ch/donut/before` as a single
        // ambiguous pink column per side, and it is measurable: `shoulderL|hipL` is
        // the ONE pair that failed the value gate on HEAD (dL 0.0675, 12.2% of all
        // contacts) purely because two same-material limbs are drawn against each
        // other. Swinging the arms clear removes the overlap AND the pair.
        // Signs per `docs/LESSONS.md` §12: `shoulderL` sits at x = -shoulderWidth, so
        // NEGATIVE z there opens outward; positive would fold it across the body.
        shoulderL: -0.30, shoulderR: 0.26,
        elbowL: -0.55, elbowR: -0.65,
        // ── 🚨 THE TWO EYES RENDER AT DIFFERENT SIZES, AND THE FACE SITS LOW-LEFT ─
        // Uri, on egg: *"the two eyes are drastically different sizes"* — and donut
        // has egg's defect from egg's mechanism, on a head that is three times the
        // area. `fb9d9da` derived it: the face is a child of `head`, `head` carries
        // `headTurn` and `twist` and BOTH are yaw, so an eye authored at theta ±t
        // images at ±t plus the net yaw and the two widths come out in the ratio
        // `cos(t - yaw) / cos(t + yaw)`.
        //
        // Measured on this character rather than assumed. `eyeX = ±0.50R` puts each
        // eye at `asin(0.50)` = **0.524 rad** off the axis, and the net yaw is
        // `headTurn + twist` = −0.30 + 0.22 = **−0.08 rad**:
        //
        //     cos(0.524 − 0.08) / cos(0.524 + 0.08) = 0.9032 / 0.8231 = **1.097**
        //
        // i.e. one sclera renders about 10% wider than the other. Read off
        // `shots/cb/a1/donut.png` the two sclerae span **88 px and 100 px** — 1.136,
        // which is that arithmetic plus the perspective of the nearer eye. −0.30 ->
        // −0.26 takes the net yaw to −0.04 and the predicted ratio to **1.047**.
        //
        // ⚠️ AND THE SECOND HALF IS `headTilt`, WHICH IS A ROLL AND NOT A YAW. At
        // 0.22 rad the two eyes sit **120 px apart vertically** in a 1400 px frame,
        // which on a large flat disc reads as the whole face having slid into the
        // lower-left quadrant with the ring's hole stranded above it — the "face off
        // the centreline of a large curved head" note. 0.22 -> 0.12.
        //
        // ⚠️ WHY NOTHING IS COUNTER-ROTATED HERE, when egg's equivalent edit
        // compensated five features: on egg the crack path, the cowl seam and both
        // clasps are authored at fixed head-local THETAS, so moving `headTurn` drags
        // them round the shell and the A/B measures four changes at once. Donut's
        // head furniture is placed by `massAnchor`/`surfaceZ` off the CURRENT mesh,
        // and the beanie is radially symmetric about the crown, so a 0.04 rad yaw
        // change moves the sprinkles and the drips with the head — which is what
        // rotating a head is supposed to do. The one thing authored against an
        // absolute azimuth is the face itself, and moving the face IS the edit.
        twist: 0.22, headTilt: 0.12, headTurn: -0.26,
        hipSway: 0.12, lean: -0.03,
        // Bouncy still reads with the feet apart — arguably better, since a rocked-
        // back weight needs a base to be rocked back ON. Measured at the shipped
        // facing: hull deficiency 0.1291 base -> 0.1368 at splay alone -> 0.1591
        // with the wider stance under it, islands 1 throughout.
        splay: 0.32,
      },
    });
    this.body.add(this.rig.joints.root);
    this.head = this.rig.joints.head;

    const R = this.rig.headRadius;
    const head = this.rig.joints.head;

    // ── Food mass: the torus, hole facing the camera ─────────────────────────
    // The hole is Donut's silhouette landmark — the one unmistakable read at any
    // size — so it faces +Z where the camera can always see it.
    const tubeR = R * 0.42;
    const ringR = R * 0.62;

    const dough = new THREE.Mesh(
      new THREE.TorusGeometry(ringR, tubeR, 18, 40),
      toonMat({ color: DOUGH, roughness: 0.82 })
    );
    dough.name = 'donut_dough';
    dough.castShadow = true;
    dough.receiveShadow = true;
    head.add(dough);

    // Glaze: a slightly larger, flattened torus sitting proud of the dough, wet and
    // glossy against the matte crumb. The roughness contrast is what makes it read
    // as icing on bread rather than as one moulded plastic object.
    const glaze = new THREE.Mesh(
      new THREE.TorusGeometry(ringR, tubeR * 1.04, 18, 40),
      glossyMat({ color: GLAZE, roughness: 0.16 })
    );
    glaze.name = 'donut_glaze';
    glaze.position.z = tubeR * 0.16;
    glaze.scale.set(1, 1, 0.78);
    glaze.castShadow = true;
    glaze.receiveShadow = true;
    head.add(glaze);

    // ── Sprinkles ────────────────────────────────────────────────────────────
    // Seated ON the glaze surface, not floating above it — an earlier character
    // shipped with visibly detached toppings and it read as broken immediately.
    const sprinkleGeo = new THREE.CapsuleGeometry(R * 0.028, R * 0.075, 4, 6);
    /**
     * The rectangle the face occupies on the front of the ring. Sprinkles that
     * land inside it are skipped.
     *
     * Not fussiness: a bright unrelated dot next to a mouth or between two eyes
     * gets read as part of the expression at the size a player sees, and a
     * purple lozenge sitting on the corner of the smile is a facial feature the
     * character did not ask for. Reference art keeps a clean margin around every
     * face for the same reason.
     */
    const inFaceZone = (x: number, y: number) => Math.abs(x) < R * 0.66 && y > -R * 0.80 && y < R * 0.28;
    for (let i = 0; i < 26; i++) {
      const a = (i / 26) * Math.PI * 2 + (i % 3) * 0.35;
      const rr = ringR + (((i * 37) % 100) / 100 - 0.5) * tubeR * 0.85;
      if (inFaceZone(Math.cos(a) * rr, Math.sin(a) * rr)) continue;
      const mat = flatMat(SPRINKLE_COLORS[i % SPRINKLE_COLORS.length]);
      const s = new THREE.Mesh(sprinkleGeo, mat);
      s.userData.noOutline = true;
      s.castShadow = true;
      // Sit ON the glaze surface. The glaze torus is offset forward by 0.16 tube
      // radii and squashed to 0.78 in Z, so its front surface at radial offset u is
      // 0.16 + 1.04*0.78*sqrt(1-u^2) — solving for that (rather than reusing the raw
      // tube radius) is the difference between sprinkles on the icing and sprinkles
      // buried inside it.
      const depth = Math.sqrt(Math.max(0, 1 - Math.pow((rr - ringR) / tubeR, 2)));
      s.position.set(Math.cos(a) * rr, Math.sin(a) * rr, tubeR * (0.16 + 0.81 * depth * 0.98));
      s.rotation.set(Math.PI / 2, 0, a + ((i * 53) % 100) / 100 - 0.5);
      head.add(s);
      this.sprinkles.push(s);
    }

    // ── Costume: knit beanie ─────────────────────────────────────────────────
    // A second independent art-director pass named the total absence of any worn
    // costume/accessory layer as the cast's single biggest remaining gap — every
    // reference character (mustache+tux, hoodie+cap+headphones, scarf+cape) reads
    // through wardrobe, and this cast had none. A jaunty knit beanie perched above
    // the ring is Donut's: it breaks the torus's round silhouette upward with a
    // real worn shape, in a fresh violet that doesn't fight her own pink glaze.
    const beanieMat = toonMat({ color: BEANIE, roughness: 0.68 });
    const beanieBrimMat = toonMat({ color: BEANIE_BRIM, roughness: 0.68 });
    const pompomMat = toonMat({ color: POMPOM, roughness: 0.7 });

    const beanieR = R * 0.36;
    const beanieThetaLen = Math.PI * 0.62;
    const beanieCenter = new THREE.Vector3(R * 0.12, R * 0.80, -R * 0.08);
    // A single quaternion drives the dome mesh AND every point/normal derived
    // from it (rim, apex) so the cap, its brim and its pompom stay geometrically
    // consistent with each other at any tilt — the same "one source of truth for
    // a curved surface" discipline `hamburger.ts`'s crownSurface encodes.
    const beanieTiltQ = new THREE.Quaternion().setFromEuler(new THREE.Euler(-0.45, 0.15, 0.35));

    const beanie = new THREE.Mesh(
      new THREE.SphereGeometry(beanieR, 20, 14, 0, Math.PI * 2, 0, beanieThetaLen),
      beanieMat
    );
    beanie.name = 'donut_beanie';
    beanie.position.copy(beanieCenter);
    beanie.quaternion.copy(beanieTiltQ);
    beanie.castShadow = true;
    beanie.receiveShadow = true;
    head.add(beanie);

    const rimLocalY = beanieR * Math.cos(beanieThetaLen);
    const rimRadius = beanieR * Math.sin(beanieThetaLen);
    const rimCenter = beanieCenter.clone().add(new THREE.Vector3(0, rimLocalY, 0).applyQuaternion(beanieTiltQ));
    const rimNormal = new THREE.Vector3(0, 1, 0).applyQuaternion(beanieTiltQ);

    const beanieBrim = new THREE.Mesh(new THREE.TorusGeometry(rimRadius, R * 0.06, 10, 24), beanieBrimMat);
    beanieBrim.name = 'donut_beanie_brim';
    beanieBrim.position.copy(rimCenter);
    beanieBrim.quaternion.setFromUnitVectors(new THREE.Vector3(0, 0, 1), rimNormal);
    beanieBrim.castShadow = true;
    beanieBrim.receiveShadow = true;
    head.add(beanieBrim);

    const pompom = new THREE.Mesh(new THREE.SphereGeometry(R * 0.115, 12, 10), pompomMat);
    pompom.name = 'donut_beanie_pompom';
    const apexLocal = new THREE.Vector3(0, beanieR, 0).applyQuaternion(beanieTiltQ);
    pompom.position.copy(beanieCenter).add(apexLocal);
    pompom.castShadow = true;
    pompom.receiveShadow = true;
    head.add(pompom);

    // ── Body: dress the torso ─────────────────────────────────────────────────
    // Two independent builder rounds both named the same gap: a themed head on a
    // generic body. Donut's body is a second, smaller dough mass wearing its own
    // iced collar — glaze drips over the shoulders and sprinkles carry on down
    // from the head — so the food identity runs the full height of the model
    // instead of stopping dead at the neck.
    // NOTE: this is a no-op under the STUB archetype, which has no torso to
    // dress — `rig.dressTorso` returns immediately and the ring above carries the
    // whole body. It is kept intact rather than deleted because switching
    // archetype is a supported one-line fix (see `bodies.ts`), and this is what
    // Donut's body looks like the moment she has a torso again.
    this.rig.dressTorso((size) => {
      const group = new THREE.Group();
      group.name = 'donut_torso';

      const bodyHalfW = size.w * 0.56;
      const bodyHalfD = size.d * 0.60;
      const bodyBottomY = size.h * 0.02;
      const bodyTopY = size.h * 1.06;
      const doughBody = new THREE.Mesh(
        torsoBarrel(bodyHalfW, bodyTopY - bodyBottomY, bodyHalfD, 0.30),
        toonMat({ color: DOUGH, roughness: 0.82 })
      );
      doughBody.name = 'donut_torso_dough';
      doughBody.position.y = (bodyTopY + bodyBottomY) / 2;
      doughBody.castShadow = true;
      doughBody.receiveShadow = true;
      group.add(doughBody);

      // Icing collar: a flattened glaze ring worn like a yoke, sized to sit
      // clearly inside the shoulder pivots so it never collides with the arms.
      const collarY = size.h * 0.86;
      const collarR = bodyHalfW * 0.82;
      const collarTube = bodyHalfW * 0.30;
      const collarMat = glossyMat({ color: GLAZE, roughness: 0.16 });
      // Radial segments pushed up from a first pass at 12 — viewed near
      // edge-on from the front (a flat ring's own tube cross-section faces the
      // camera almost directly there), 12 facets around the tube showed as a
      // visible jagged/faceted silhouette against the smooth dough body.
      const collar = new THREE.Mesh(new THREE.TorusGeometry(collarR, collarTube, 22, 40), collarMat);
      collar.name = 'donut_torso_collar';
      collar.rotation.x = Math.PI / 2;
      collar.position.y = collarY;
      collar.castShadow = true;
      collar.receiveShadow = true;
      group.add(collar);

      // Glaze drips down the chest — same trick as the head icing, dribbling
      // down from the collar across the front arc (theta ~0.5..2.6, +Z-ward).
      const dripAngles = [0.55, 0.95, 1.35, 1.75, 2.15, 2.55];
      for (let i = 0; i < dripAngles.length; i++) {
        const a = dripAngles[i];
        const len = collarTube * (1.5 + (i % 3) * 0.5);
        const drip = new THREE.Mesh(new THREE.SphereGeometry(collarTube * 0.85, 10, 10), collarMat);
        drip.name = 'donut_torso_drip';
        drip.position.set(Math.cos(a) * collarR * 0.98, collarY - len * 0.55, Math.sin(a) * collarR * 0.98);
        drip.scale.set(1, len / (collarTube * 0.85), 1);
        drip.castShadow = true;
        drip.receiveShadow = true;
        group.add(drip);
      }

      // Pin badge — a small worn detail on the collar, the accessory scaled down
      // (the beanie above is the silhouette-breaking piece; this is the close-up
      // "worn, not just coloured" read), tucked into the gap the drip angles leave
      // clear at the front (drips start at 0.55 rad).
      const badgeMat = toonMat({ color: '#FFD873', roughness: 0.5 });
      const badgeInnerMat = toonMat({ color: BEANIE, roughness: 0.5 }); // same near-black as the cap
      const badgeA = 0.18;
      const badgeR = collarR + collarTube * 0.85;
      const badge = new THREE.Mesh(new THREE.CylinderGeometry(collarTube * 0.55, collarTube * 0.55, collarTube * 0.18, 16), badgeMat);
      badge.name = 'donut_pin_badge';
      badge.position.set(Math.cos(badgeA) * badgeR, collarY, Math.sin(badgeA) * badgeR);
      badge.rotation.z = Math.PI / 2;
      badge.rotation.y = -badgeA;
      badge.castShadow = true;
      badge.receiveShadow = true;
      group.add(badge);
      const badgeInner = new THREE.Mesh(new THREE.CircleGeometry(collarTube * 0.32, 14), badgeInnerMat);
      badgeInner.name = 'donut_pin_badge_face__no_outline';
      badgeInner.userData.noOutline = true;
      badgeInner.position.set(0, 0, collarTube * 0.1);
      badge.add(badgeInner);

      // Sprinkles carry on down from the head, scattered across the lower half
      // of the collar band — kept off the topmost row, which sits right at the
      // seam against the head ring above and reads as a stray face feature.
      const sGeo = new THREE.CapsuleGeometry(R * 0.024, R * 0.06, 4, 6);
      for (let i = 0; i < 10; i++) {
        const a = 0.6 + (i / 10) * 2.1;
        const rr = collarR + (((i * 41) % 100) / 100 - 0.5) * collarTube * 1.4;
        const mat = flatMat(SPRINKLE_COLORS[(i + 2) % SPRINKLE_COLORS.length]);
        const s = new THREE.Mesh(sGeo, mat);
        s.userData.noOutline = true;
        s.castShadow = true;
        s.position.set(Math.cos(a) * rr, collarY - collarTube * (0.15 + (i % 3) * 0.22), Math.sin(a) * rr);
        s.rotation.set(Math.PI / 2, 0, a + ((i * 29) % 100) / 100 - 0.5);
        group.add(s);
        this.sprinkles.push(s);
      }

      return group;
    });

    // ── Limbs: bespoke, not the shared rig defaults ───────────────────────────
    // An independent art director named the rig's identical capsule-arm/ball-hand/
    // wedge-foot kit — recoloured but otherwise the same on every character — as
    // the single biggest "template" tell across the whole cast. Donut's limbs stay
    // soft and barely taper (this is dough, not muscle) but the extremities carry
    // her own material story: glaze-dipped glossy hands that end in a drip, and
    // chocolate-dipped glossy feet, both a deliberate step up in gloss from the
    // matte dough limbs, echoing the head's own matte-dough/glossy-glaze contrast.
    const limbPinkMat = toonMat({ color: LIMB_PINK, roughness: 0.7 });
    const limbPinkDarkMat = toonMat({ color: LIMB_PINK_DARK, roughness: 0.7 });
    const sleeveDoughMat = toonMat({ color: SLEEVE_DOUGH, roughness: 0.7 });
    const sleeveDoughDarkMat = toonMat({ color: SLEEVE_DOUGH_DARK, roughness: 0.7 });
    const glazeHandMat = glossyMat({ color: GLAZE, roughness: 0.16 });
    // Roughness 0.22 -> 0.34. `glossyMat` carries `clearcoat: 0.6`, so at 0.22 the
    // boot returns a broad specular and its measured p50 rose 0.0599 -> 0.1000 once
    // `taperedSegment` gave it a real tapered face to catch the key with. That is
    // half of `kneeL|footL`'s 0.0015 miss against the 0.10 gate; the shin tone
    // above carries the other half.
    const chocFootMat = glossyMat({ color: CHOC_DIP, roughness: 0.34 });
    this.rig.dressLimbs((part, size) => {
      switch (part) {
        // ── The radii are CONTINUITY constraints, not taste ────────────────────
        // The rig hands the lower segment a smaller base radius than the upper one
        // — published as `metrics.forearmRadius` and `metrics.shinRadius`, which
        // `limbSlots()` and `buildLimbs()` both READ BACK, so published and built
        // cannot diverge — so matching multipliers do NOT produce a matching diameter.
        // These are chosen so the upper segment's BOTTOM and the lower segment's TOP
        // are the same width in metres — arm 0.86*0.1302 = 0.112 against
        // 0.935*0.1198 = 0.112, leg 0.86*0.1218 = 0.1048 against 0.956*0.1096 =
        // 0.1048 — which is what turns two abutting meshes into one limb that
        // changes colour at the joint instead of two beads on a string.
        // ── 🚨 AND THE FOUR LIMBS WERE THE SAME OBJECT IN FOUR PLACES ──────────
        // `upperArm` and `thigh` shared `limbPinkMat`, `forearm` and `shin` shared
        // `limbPinkDarkMat`, and the radii differed by 4%. So an arm and a leg were
        // the same mass in the same two tones, distinguishable only by the terminal
        // cap — a glaze mitt against a choc boot, the two smallest elements on the
        // character — and the read at the lobby camera is a four-legged animal.
        //
        // The split is on HUE, not on value, and that is deliberate: every value on
        // this character is already spoken for. `head|shoulderL` is the weakest
        // boundary on the model at `dLcontact` **0.0315**, because a mid-pink arm
        // meets a light-pink ring; `hips|thighL` needs the haunch's berry to stay
        // clear of the thigh; `kneeL|footL` cleared its gate by **0.0015**. Moving
        // any of those four tones to separate the pairs breaks one of them.
        //
        // ⚠️ SO THE ARMS TAKE THE DOUGH FAMILY AND THE LEGS KEEP THE BERRY FAMILY.
        // That is not a new idea — it is the fix the removed-cuff note at the bottom
        // of this file explicitly names: *"the honest fix is lighting or a DIFFERENT
        // ARM TONE, not a shape bolted onto the boundary to satisfy the statistic."*
        // A hoop at the shoulder was built, measured and rejected there; recolouring
        // the sleeve buys the same boundary with no new geometry at all, and gold on
        // a glazed donut is the food's own second colour rather than an invention —
        // it is the band already visible inside the ring.
        case 'upperArmL': case 'upperArmR': {
          // `capBotFrac` 0.05: this end meets the forearm's top at the same radius
          // and is never seen. See the interior/exterior cap note in
          // `taperedSegment` — this is the argument that stops the limb pinching to
          // zero width at the elbow, which is what an ink hull traces as a bead.
          const m = new THREE.Mesh(taperedSegment(size.len, size.radius * 0.90, size.radius * 0.79, 16, { capTopFrac: 0.30, capBotFrac: 0.05 }), sleeveDoughMat);
          m.name = `${part}_mesh`;
          m.castShadow = true;
          m.receiveShadow = true;
          return m;
        }
        case 'thighL': case 'thighR': {
          // 1.02 -> 1.12 while the arm went 0.98 -> 0.90. The two were within 4% of
          // each other, which at this on-screen size is no difference at all; they
          // are now 24% apart, and the heavier pair being the LEGS is the one
          // proportion cue that survives any pose.
          const m = new THREE.Mesh(taperedSegment(size.len, size.radius * 1.12, size.radius * 0.945, 16, { capTopFrac: 0.30, capBotFrac: 0.05 }), limbPinkMat);
          m.name = `${part}_mesh`;
          m.castShadow = true;
          m.receiveShadow = true;
          return m;
        }
        case 'forearmL': case 'forearmR': {
          // Top radius matches the upper arm's bottom in METRES, not in multiplier:
          // 0.79 * 0.1302 = 0.1029 against 0.859 * 0.1198 = 0.1029. The rig hands the
          // lower segment a smaller base radius (`metrics.forearmRadius`), so equal
          // multipliers would put a step in the outline at the elbow.
          const m = new THREE.Mesh(taperedSegment(size.len, size.radius * 0.859, size.radius * 0.72, 16, { capTopFrac: 0.05, capBotFrac: 0.30 }), sleeveDoughDarkMat);
          m.name = `${part}_mesh`;
          m.castShadow = true;
          m.receiveShadow = true;
          return m;
        }
        case 'shinL': case 'shinR': {
          // Same continuity, on the leg: 0.945 * 0.1218 = 0.1151 against
          // 1.05 * 0.1096 = 0.1151.
          const m = new THREE.Mesh(taperedSegment(size.len, size.radius * 1.05, size.radius * 0.88, 16, { capTopFrac: 0.05, capBotFrac: 0.34 }), limbPinkDarkMat);
          m.name = `${part}_mesh`;
          m.castShadow = true;
          m.receiveShadow = true;
          return m;
        }
        case 'handL': case 'handR': {
          const g = new THREE.Group();
          // 0.98 -> 0.86. `bodies.ts` already cut STUB's `handRadiusF` 0.078 -> 0.068
          // because "the mitt is wider than the limb is long and simply contains it";
          // at 0.98 of what is left, the ball is still 0.274 m across against a
          // forearm that now ends at 0.187 m, and at profile it reads as a second
          // foot. 0.86 keeps a clear mitt without swallowing the arm.
          const ball = new THREE.Mesh(new THREE.SphereGeometry(size.radius * 0.86, 16, 14), glazeHandMat);
          ball.position.y = -size.radius * 0.86;
          ball.scale.set(1, 1.06, 1);
          ball.name = `${part}_mesh`;
          ball.castShadow = true;
          ball.receiveShadow = true;
          g.add(ball);
          // A small drip nub at the bottom — the same trick the head/torso glaze
          // uses, carried down to the extremities instead of stopping at the neck.
          const drip = new THREE.Mesh(new THREE.SphereGeometry(size.radius * 0.22, 8, 8), glazeHandMat);
          drip.position.y = -size.radius * 1.85;
          drip.scale.set(1, 1.6, 1);
          drip.userData.noOutline = true;
          g.add(drip);
          return g;
        }
        case 'footL': case 'footR': {
          // `taperedSegment`'s own convention hangs the FULL `len` down from the
          // joint origin — correct for an arm/leg bone, but the foot joint already
          // sits barely above true ground level, so the previous `size.len * 1.3`
          // (a full leg-segment length) sank the whole foot 30-40cm through the
          // floor: a verified defect (the character's own measured height came out
          // ~0.8m taller than the cast norm because the bounding box was being
          // measured down into the floor, not because anything visible got taller).
          // Shortened to a true foot-scaled drop, matching the shallow droop every
          // other character's own foot geometry keeps.
          // ── SEATED ON `groundY`, which this builder was ignoring ───────────────
          // `LimbSize.groundY` is the joint-local height of the world floor and
          // `rig.ts` added it precisely because "every bespoke boot in the cast
          // guessed its own seat and every one of them guessed low". This one
          // guessed too — `size.len * 0.55` is 0.132 m against an ankle 0.126 m off
          // the floor, so the toe sat 6 mm under it. Taking the min of the two makes
          // the boot as long as the character can stand on and no longer.
          // Also 1.2 -> 1.0 at the top: the old top radius was 0.128 m against a
          // shin that now ends at 0.088 m, i.e. a boot half again as wide as the leg
          // wearing it — the exact defect `FOOT_WIDTH_RATIO` was retuned to remove.
          const footLen = Math.min(size.len * 0.62, -size.groundY * 0.98);
          const foot = new THREE.Mesh(taperedSegment(footLen, size.radius * 1.0, size.radius * 0.34, 12), chocFootMat);
          // A foot points FORWARD. The lathe is radially symmetric, so the shape has
          // to come from the scale: 1.5x in Z reads as a shoe, 1.0x reads as a cone.
          foot.scale.set(1, 1, 1.35);
          foot.position.z = size.radius * 0.34;
          foot.name = `${part}_mesh`;
          foot.castShadow = true;
          foot.receiveShadow = true;
          return foot;
        }
        default:
          return null;
      }
    });

    this.buildAttachments();
    this.buildFace(R, ringR, tubeR);
    this.buildSilhouetteEvents(R);

    outlineGroup(this.root);
    this.collectFlashTargets();
    this.rig.restPose();
  }

  /**
   * ATTACHMENT MASSES — the thing a STUB torus does not have and cannot borrow.
   *
   * Uri, on the lobby render: *"same issue with legs detached from torso."*
   * `fc4d9ad` answered that at the rig level with a pelvis on `hips`, and measured
   * against THIS character it does nothing — `rg_gap --ids donut --pitch 20 --yaw 0`
   * on HEAD: **fill 0 px, bridgeL 1 -> 1, bridgeR 7 -> 7.** That commit's own note
   * says why ("it is not the fix for 'the legs are detached'"), and for Donut the
   * reason is specific and geometric:
   *
   *   ring half-width at the hip line   0.304 m
   *   stanceWidth                       0.588 m      -> the leg is 0.284 m outboard
   *   ring underside directly above     world y 0.70
   *   top of the thigh                  world y 0.60 -> a 0.10 m vertical hole
   *
   * A rig-level pelvis sits between the LEGS. Donut's gap is not between the legs,
   * it is between each leg and a ring that curves away from it in both axes — so
   * the mass that closes it has to be shaped against a torus, which makes it this
   * file's job and not `rig.ts`'s.
   *
   * ── Where it is parented, and why not the obvious place ─────────────────────
   * `joints.hips`, a BODY frame: `hipSway` moves it with the body while `hipL`/`hipR`
   * swing freely inside it, which is what a socket is. Parenting it to `hipL` instead
   * would have swung the attachment with the leg, so the join would visibly slide
   * around the ring every stride.
   *
   * ── ONLY the hips. The shoulders were built and measured and did not need it ─
   * A matching pair of shoulder sockets on `joints.torso` was built in round 1 and
   * removed: the arm pivot at 0.6825 m already sits inside the ring's 0.611 m
   * half-width at shoulder height, so it was bridging a gap that does not exist. It
   * cost `shoulderL` **834 -> 471 delivered px** and added five weak pairs
   * (`head|torso` 0.0482, `torso|hips` 0.0475, `torso|hipL` 0.0162, `torso|elbowL`
   * 0.0229, `torso|shoulderL` 0.0750). What the arms actually needed was to stop
   * hanging over the legs — see `stance.shoulderL`.
   */
  private buildAttachments(): void {
    const m = this.rig.metrics;
    const berryMat = toonMat({ color: HIP_BERRY, roughness: 0.70 });

    for (const sx of [-1, 1]) {
      // ── THE HIP HAUNCH ────────────────────────────────────────────────────
      // Sized against the gap, which `taperedSegment`'s fix made BIGGER and more
      // honest: a segment mesh now spans exactly y in [-len, 0], so the top of the
      // thigh is at the hip line (world 0.480) instead of a hemisphere reaching
      // 0.124 m above it. The ring's underside directly above the hip x is world
      // 0.701, so the mass has 0.221 m to cross.
      //
      //   ellipsoid  x 0.470 +/- 0.212      y 0.115 +/- 0.155 (hips-local)
      //   at the hip x (0.588)              world 0.466 .. 0.724
      //   ring underside there              world 0.701     -> 0.023 m of overlap
      //   thigh buried                      0.014 m of 0.208 = 6.7%
      //
      // The two lobes stay SEPARATE — x 0.258..0.682 each side — so the crotch,
      // which is below the hip line and between the thighs, is untouched. It is
      // also already partly closed by the ring itself, whose lowest point (world
      // 0.415) is below the hip line.
      const haunch = new THREE.Mesh(new THREE.SphereGeometry(1, 20, 14), berryMat);
      haunch.name = 'donut_hip_haunch';
      haunch.scale.set(m.stanceWidth * 0.36, m.legRadius * 1.27, m.legRadius * 1.55);
      haunch.position.set(sx * m.stanceWidth * 0.80, m.legRadius * 0.945, 0);
      haunch.castShadow = true;
      haunch.receiveShadow = true;
      this.rig.joints.hips.add(haunch);
    }
  }

  // ── THE SLEEVE CUFF: BUILT, MEASURED, RENDERED, REMOVED ────────────────────
  // A berry torus at the top of each upper arm, parented to `shoulderL`/`shoulderR`,
  // to put a dark band exactly where `head|shoulderL`'s `dLcontact` is measured — it
  // reads 0.0315 on HEAD, the weakest boundary on this character, because a mid-pink
  // arm meets a light-pink ring and the join carries no value at all.
  //
  // It half-worked on the metric and failed on the picture, and BOTH halves are the
  // finding:
  //   · `head|shoulderL` dLcontact 0.0315 -> 0.0580 — real, still under 0.10, and it
  //     cost a NEW weak pair: darkening `shoulderL`'s p50 0.5270 -> 0.3414 dropped
  //     `shoulderL|elbowL` to dL 0.0498 and left `weakBoundaryPct` at 8.7% where
  //     removing the cuff takes it to 0.0%.
  //   · Read as a PNG (`shots/ch/donut/after2/lobby_side.png`) it is not a cuff. A
  //     torus of radius 1.06 arm-radii with its own inverted-hull outline, on a limb
  //     this short, is a HOOP the arm passes through — at profile it hangs off the
  //     hip as a separate dark ring with daylight inside it.
  //
  // A solid sleeve band would fix the picture and keep the metric cost, so the trade
  // is genuinely between two failing pairs. `head|shoulderL` fails on `dLcontact`
  // only (dL is 0.1955, comfortably inside the gate) and it failed before this pass
  // too; `shoulderL|elbowL` would fail the SHIPPED gate. Left unfixed, deliberately,
  // and recorded: the honest fix is lighting or a different arm tone, not a shape
  // bolted onto the boundary to satisfy the statistic.

  /**
   * SILHOUETTE EVENTS — four icing drips and a beanie tail.
   *
   * Donut measured **hull deficiency 0.1207 with ZERO appendages** at the shipped
   * facing. The ring's HOLE — the one feature that would make this outline
   * unmistakable — is a real, large piece of negative space and it contributes
   * nothing at the facing the player looks at, because at yaw 90 the torus is
   * edge-on and the hole closes. That is measurable: 0.1799 head-on against 0.1207
   * in profile, and the difference is almost exactly the hole.
   *
   * So the events have to be things that survive the ring turning edge-on. Drips
   * running off the glaze at four azimuths do: whichever way the character faces,
   * two of the four are broadside to camera. They are `curl`s rather than straight
   * rods so they hook as they fall, which is what makes icing read as icing.
   *
   * The beanie's tail is the fifth, and it is the one that does the most work,
   * because it leaves the mass HORIZONTALLY at head height where the ring is
   * widest — see `appendages.ts` for why that direction is worth roughly twice a
   * vertical one at a 58 deg camera. The existing pompom moves onto its tip.
   */
  private buildSilhouetteEvents(R: number): void {
    const head = this.rig.joints.head;
    const box = localBounds(head);

    // ── Icing drips ───────────────────────────────────────────────────────────
    const dripMat = toonMat({ color: GLAZE, roughness: 0.34 });
    /**
     * ── 🔴 TWO OF THESE WERE ANCHORED ON THE RING'S OWN HOLE AXIS ─────────────
     * WAS `[Math.PI * 0.90, 0.48, 0.86]` and `[-Math.PI * 0.86, 0.40, 0.66]`, and
     * both were BACK azimuths. `massAnchor` fires its ray through the mass's own
     * centre, so on a torus whose hole faces +Z a front or back ray runs **down the
     * hole and touches nothing** — at every height between the hole's two lips. Both
     * anchors therefore fell through to the bounding-box branch, which for this shape
     * is not an approximation of the geometry, it is a place the geometry is not:
     * `s.z` is only `2 * tubeR`, so the fallback put each drip at |x| ~ 0.12 of the
     * box width and near the back face — i.e. INSIDE THE HOLE. Read
     * `shots/nm/donut_hole_p58.png`, cropped from the SHIPPED tree: a pale pink shard
     * with a black socket at its root standing in the middle of the ring. That socket
     * is `curl`'s open tube end, which the comment below already warns about, seen
     * from the one direction the lobby camera cannot look.
     *
     * ⚠️ THE OBVIOUS FIX IS ALREADY REFUTED AND MUST NOT BE RE-TRIED. `de4bb11` built
     * a recovery INSIDE `massAnchor` that held the azimuth and swept `height01`
     * nearest-first until a ray hit. It satisfied its own contract — both anchors on
     * a surface, zero fallbacks — and it made the character WORSE, because the first
     * surface a hole-axis ray meets is the hole's INNER LIP (measured 0.007 m and
     * 0.033 m from the ring's own axis). **6,615 px at pitch 20 and 6,629 at 58**, and
     * it was reverted. A torus has no surface on its own hole axis at ANY height, so
     * the fix belongs here: ask for the drip where the ring exists.
     *
     * ── WHERE THE RING EXISTS, SWEPT AT CONSTRUCTION TIME ─────────────────────
     * 41 azimuths x 7 heights through `massAnchor` itself, inside this method, before
     * any drip is added — ⚠️ which is the only place the answer is valid: `de4bb11`
     * records that re-running `massAnchor` on a FINISHED character reports
     * `exact: true` at a surface 0.05 m from the axis, because by then the tree
     * carries `outlineGroup`'s baked hulls and a hull is an inverted shell.
     *
     *   height01 0.40 / 0.48, reach of the returned anchor from the ring's axis:
     *     azimuth   0.25pi  0.35  0.45  0.55  0.60  0.65  0.70  0.75  0.90(pi)
     *     reach      0.416  0.491 0.585 0.562 0.525 0.466 0.370 0.196  MISS
     *
     * Outside |azimuth| in [0.25pi, 0.70pi] the ray misses the ring entirely; past
     * 0.65pi it only grazes the tube tangentially and the anchor collapses toward the
     * axis, which is the same defect by another route. **0.62pi is the furthest
     * BACK a drip can go and still leave the outer rim** (reach ~0.50 against the
     * working drips' 0.556-0.577), so it is what the two back drips become. That
     * keeps the design this method exists for — four drips spread around the ring so
     * two are broadside at any facing — as far as a torus permits it, and the two
     * that moved are still on the ring's back half (z ~ -0.20).
     */
    const drips: Array<[number, number, number]> = [
      [Math.PI * 0.46, 0.52, 1.00],
      [-Math.PI * 0.40, 0.44, 0.78],
      [Math.PI * 0.62, 0.48, 0.86],
      [-Math.PI * 0.62, 0.40, 0.66],
    ];
    // ── 🚨 RE-SHAPED: THESE WERE READING AS HORNS ────────────────────────────
    // *"A pointed mass either side of a head reads as an ear or a horn — five for
    // five, and it overrides what the shape is made of."* Rendered at the lobby
    // camera on HEAD, two of these four are exactly that: short pink stubs standing
    // off the ring's left and right flanks at mid height, one at each side, pointing
    // out and slightly up. They are made of icing and they do not read as icing.
    //
    // The cause is the ratio, not the position. The old path reached OUT 0.30R while
    // falling only 0.62R, so the drip left the surface at roughly 26 degrees off
    // horizontal — a spur. Icing reads as icing when it clings: the outward reach is
    // now 0.09R against a 1.00R fall (5 degrees off vertical), the base is fatter so
    // it merges into the glaze it comes from instead of starting at a point, and the
    // tip stays round. Same four azimuths, same silhouette budget — a mass that
    // leaves the outline at head height is still worth roughly twice a vertical one
    // (`appendages.ts`) — but the outline it draws is now a tongue of icing running
    // down the ring rather than a spike sticking off it.
    for (const [azimuth, height01, k] of drips) {
      const { at, out } = massAnchor(head, box, { azimuth, height01, inset: 0.22 });
      const pts = [
        // ── 🚨 THE TUBE IS UNCAPPED AND ON A TORUS THE INSET IS NOT ENOUGH ──────
        // `curl` builds `TubeGeometry(..., closed: false)`, so both ends are OPEN
        // rings. `massAnchor` insets the root by 0.22 of the LOCAL REACH — and for a
        // torus whose hole faces +Z, the reach at a FRONT or BACK azimuth is only
        // `tubeR` (0.302 m), so the inset is 0.066 m against a tube radius of
        // 0.059 m. The start ring finished 7 mm inside the surface, i.e. flush, and
        // at the match camera (58 deg, looking down and behind) you look straight
        // into it: `shots/ch/donut/final/match58_run.png` shows two pink cones with
        // black sockets at their roots, which is finding 4's horn read arriving from
        // the one direction the lobby views cannot see.
        // The reach is a property of the SHAPE, so the fix is a leading control point
        // driven 0.20R back along the inward normal rather than a bigger `inset`,
        // which would move every drip's visible length as well as its root.
        at.clone().addScaledVector(out, -R * 0.20).add(new THREE.Vector3(0, R * 0.06, 0)),
        at.clone(),
        at.clone().addScaledVector(out, R * 0.05 * k).add(new THREE.Vector3(0, -R * 0.22 * k, 0)),
        at.clone().addScaledVector(out, R * 0.09 * k).add(new THREE.Vector3(0, -R * 0.50 * k, 0)),
        at.clone().addScaledVector(out, R * 0.07 * k).add(new THREE.Vector3(0, -R * 0.80 * k, 0)),
      ];
      // rBase 0.115R read as a flat pink TAB at profile — a slab with an outline
      // round it, not a run of icing. 0.082R/0.040R keeps the merge at the root and
      // the round tip while staying narrow enough to read as liquid.
      // rTip 0.040R -> 0.056R. A tapered tube ending at 0.029 m on a 2.1 m character
      // is a POINT, and a point either side of a head is the one shape finding 4 says
      // reads as a horn whatever it is made of. A blunt, rounded end reads as a bead
      // of icing about to fall, which is what this is.
      const d = curl(dripMat, pts, { rBase: R * 0.082, rTip: R * 0.056 });
      d.name = 'donut_icing_drip';
      head.add(d);
    }

    // ── Beanie tail ───────────────────────────────────────────────────────────
    const beanieMat = toonMat({ color: BEANIE, roughness: 0.8 });
    const { at, out } = massAnchor(head, box, { azimuth: -Math.PI * 0.68, height01: 0.90, inset: 0.30 });
    const tailPts = [
      at.clone(),
      at.clone().addScaledVector(out, R * 0.32).add(new THREE.Vector3(0, R * 0.16, 0)),
      at.clone().addScaledVector(out, R * 0.62).add(new THREE.Vector3(0, R * 0.10, 0)),
      at.clone().addScaledVector(out, R * 0.80).add(new THREE.Vector3(0, -R * 0.10, 0)),
    ];
    const tail = curl(beanieMat, tailPts, { rBase: R * 0.085, rTip: R * 0.048 });
    tail.name = 'donut_beanie_tail';
    head.add(tail);
    // The apex pompom MOVES here rather than a second one being added — one hat,
    // one bobble, and the light rung it carries keeps its area and its colour.
    const apexPompom = head.getObjectByName('donut_beanie_pompom');
    if (apexPompom) apexPompom.parent?.remove(apexPompom);
    const bob = new THREE.Mesh(new THREE.SphereGeometry(R * 0.125, 12, 10), toonMat({ color: POMPOM, roughness: 0.7 }));
    bob.name = 'donut_beanie_pompom';
    bob.position.copy(tailPts[3]);
    bob.castShadow = true;
    bob.receiveShadow = true;
    head.add(bob);
  }

  /**
   * Face features sit around the hole on the front of the ring. Built as real
   * geometry with depth rather than flat decals — `types.ts` convention #6 was
   * relaxed precisely because flat stickers were capping quality.
   *
   * ── The face was FLOATING, and the shadows proved it ──────────────────────
   * `rig.joints.face` is parked at `headRadius * 0.82`, which assumes a roughly
   * spherical head whose front surface is about there. A torus is nowhere near
   * that: at the radius the eyes sit on, this ring's glazed front face is only
   * ~0.38R forward, so every feature hung ~0.25R — about 0.19 m — out in open
   * air. Dead-on it looked fine, which is exactly why it survived; at any yaw
   * the eyes visibly detached and cast their own drop shadows onto the dough
   * behind them.
   *
   * Every feature is now placed against the REAL glaze surface via
   * `glazeFrontZ`, which solves the same offset/squash the sprinkles already
   * solve rather than guessing a constant — so the face cannot drift if the
   * ring's proportions are ever retuned.
   */
  private buildFace(R: number, ringR: number, tubeR: number): void {
    const face = this.rig.joints.face;
    const ink = PALETTE.ink;

    /**
     * Head-local Z of the ring's OUTERMOST front surface at radius `hypot(x, y)`,
     * converted into `face`-local space.
     *
     * There are two surfaces here and which one is in front depends on where you
     * are across the tube — that is the whole reason the ring renders as a pink
     * outer band, a gold middle band and a pink inner band rather than as solid
     * icing. The dough torus is a plain tube of radius `tubeR` centred at z=0.
     * The glaze torus is 1.04x thicker, squashed to 0.78 in Z and pushed forward
     * 0.16 tube radii, so it wins near the tube's inner and outer edges and LOSES
     * across the middle, where the bare dough pokes through.
     *
     * A first fix at this solved only the glaze and buried the smile: the mouth
     * sits in the gold band, where the surface it needed to clear was the dough,
     * a full 0.05R further forward. Taking the max of both is what makes the
     * answer independent of which band a feature happens to land in.
     */
    const surfaceZ = (x: number, y: number, proud: number): number => {
      const d = Math.hypot(x, y);
      const ud = (d - ringR) / tubeR;
      const zDough = tubeR * Math.sqrt(Math.max(0, 1 - ud * ud));
      const ug = (d - ringR) / (tubeR * 1.04);
      const zGlaze = tubeR * (0.16 + 1.04 * 0.78 * Math.sqrt(Math.max(0, 1 - ug * ug)));
      return Math.max(zDough, zGlaze) + proud - face.position.z;
    };

    // ── The HOLE was acting as the mouth ─────────────────────────────────────
    // With the eyes at +0.30R and the smile at -0.30R, the ring's hole sat
    // exactly between them — and a hole is the darkest, highest-contrast feature
    // on the whole model, so a blind critic read it as the mouth and the real
    // smile as a stray mark low and off to the right. The face was losing to the
    // geometry.
    //
    // Dropping the whole face below the hole fixes it structurally rather than
    // by fighting for attention: eyes at -0.06R, mouth at -0.60R, so the hole is
    // now clearly ABOVE the eyes where it reads as what it is — a hole in a
    // donut — and the three ink features form one compact group in the lower
    // half of the ring. The eyes also move outward to sit on the gold dough band
    // rather than on the pink inner slope, where they were being crowded.
    //
    // Both eyes are the SAME size now. The 0.72 squint on one side was meant as
    // a half-wink; every independent read of it came back as "the painted eyes
    // are unequal in size and sit at different heights", which is the exact
    // failure `taco.ts` already documented — a subtle size difference reads as a
    // mistake, not as acting. The asymmetry lives entirely in the brows.
    // ── 🚨 THE EYE WAS A DARK BEAD WITH A SHINE, AND THAT IS THE SPEC'S FAULT ──
    // Uri ranked seven characters without seeing any code and the ranking matches
    // the one-line `face:` field in `rules.ts` exactly. Donut's read — *"better than
    // the burger, the eyes have more depth, but can be taken deeper"* — is what a
    // 3D ball with a real specular buys you over a flat painted arc, and it is the
    // ceiling of that idea. `rules.ts` now says the rest out loud: **a highlight is
    // not a sclera, and a dark bead with a glint is not an open eye.**
    //
    // Measured, and this is the number the whole pass is steered by: on the
    // reference plates **31.1% / 34.1%** of face-crop pixels are above luma 0.85.
    // On HEAD, at the lobby camera, Donut's face crop reads **0.0053** — half a
    // percent, and every one of those pixels is the 0.038R glint. Our faces carry
    // two values: ink and icing.
    //
    // So the eye is rebuilt as four elements, which is Egg's structure (the cast's
    // best-ranked face) taken one step further:
    //   1. a WHITE SCLERA that is the brightest value anywhere on the character,
    //   2. a dark PUPIL, offset toward the smile's high corner so gaze and grin agree,
    //   3. an explicit CATCHLIGHT mesh — kept *in addition to* the specular, not
    //      instead of it, because the specular is what Uri already liked here,
    //   4. a small secondary glint on the opposite side, which is what stops a
    //      single highlight reading as a plastic bead.
    //
    // ⚠️ THE SCLERA NEEDED EMISSIVE AND THIS IS THE EVIDENCE. Egg already uses
    // `toonMat` white at roughness 0.3 and Egg is inside the "0% of eye pixels above
    // 0.85" finding — a lit white ball on this key renders around 0.80-0.85, i.e.
    // just under the line, because the gold dough it is drawn against is itself an
    // 0.82-albedo surface. A modest emissive lifts the whole sclera clear of the
    // dough instead of relying on one specular pixel to do it. 0.30 is between
    // pizza's cheese (0.18) and hotdog's cyber caps (0.45), and it sits just above
    // `stage.ts`'s bloom threshold of 0.80 so the eye gets a soft lift rather than
    // a glare.
    const SCLERA_R = R * 0.165;
    const scleraGeo = new THREE.SphereGeometry(SCLERA_R, 20, 16);
    const scleraMat = toonMat({
      color: '#FFFFFF', roughness: 0.36, emissive: '#FFFFFF', emissiveIntensity: 0.30,
    });
    const pupilMat = toonMat({ color: ink, roughness: 0.22 });
    // The smile's high corner is at -x (see `mouthTilt` below). BOTH pupils shift the
    // same way in world space — that is what makes a gaze; mirroring them per side
    // makes a cross-eyed doll.
    const GAZE_X = -R * 0.030;

    // ⚠️ THE EYES HAD TO MOVE OUTWARD, AND THE HOLE IS WHY. At the old 0.44R the
    // eye centre sat 0.444R from the ring's axis while the hole's edge is at 0.20R,
    // so a 0.165R sclera would have overhung the hole by 0.079R — rendered at 3/4
    // on HEAD the *old, smaller* eye is already half-silhouetted against the hole's
    // background. 0.50R/-0.17R puts the centre at 0.528R and the inner edge at
    // 0.363R, a clear 0.163R of dough between the eye and the hole at every yaw,
    // and it keeps both eyes on the gold band where the sclera has the most contrast
    // to gain.
    for (const sx of [-1, 1]) {
      const eyeX = sx * R * 0.50;
      const eyeY = -R * 0.17;
      // Centre sits ON the surface, so a little over half the ball stands proud —
      // an eye set flush into the icing reads as a printed dot, and one pushed
      // out past its own radius reads as detached.
      const eyeZ = surfaceZ(eyeX, eyeY, R * 0.015);

      const sclera = new THREE.Mesh(scleraGeo, scleraMat);
      sclera.name = `donut_eye_sclera_${sx > 0 ? 'R' : 'L'}`;
      sclera.position.set(eyeX, eyeY, eyeZ);
      sclera.scale.set(1, 1.10, 0.62);
      sclera.castShadow = true;
      face.add(sclera);

      const pupil = new THREE.Mesh(new THREE.SphereGeometry(R * 0.084, 16, 14), pupilMat);
      pupil.name = `donut_eye_pupil_${sx > 0 ? 'R' : 'L'}`;
      pupil.position.set(eyeX + GAZE_X, eyeY - R * 0.014, eyeZ + SCLERA_R * 0.46);
      pupil.scale.set(1, 1.04, 0.58);
      pupil.castShadow = true;
      face.add(pupil);

      // The catchlight, and its opposite-corner partner. Both are `flatMat`, i.e.
      // unlit — that is the only material in this file guaranteed to deliver a pixel
      // above 0.94 regardless of which way the head is turned.
      // 0.044R -> 0.036R: at 0.044 the catchlight bit a crescent out of the pupil and
      // the pupil read as a "C" rather than as a round dark centre.
      //
      // ── 🚨 0.036 STILL BIT THE CRESCENT, AND IT IS MEASURED NOW, NOT JUDGED ────
      // Uri on this character: *"the eyes have more depth, but can be taken deeper."*
      // Read at 3x off the shipped lobby camera (`shots/ey/zoom/donut-face-before.png`)
      // **both pupils are Pac-Men** — a white bite out of the upper-inner quadrant,
      // continuous with the sclera behind it, so the dark reads as a "C" and not as a
      // round centre. The round above closed 22% of the error and declared it shut.
      //
      // `tools/tmp/ey_pacman.mjs` puts a number on it for the first time: threshold
      // dark, FILL HOLES, then solidity = filledArea / convexHullArea. A catchlight
      // that sits ON the pupil is a hole and is filled, so it scores ~0.98; one that
      // hangs off the rim is a notch in the outline and the hull spans it with a
      // chord. Measured at the lobby camera, on `headserve` HEAD:
      //
      //     donut L 0.7348   donut R 0.7394        <- this construction
      //     pizza L 0.9527   pizza R 0.9469        <- the same fix already shipped
      //     soup  L 0.8614   soup  R 0.8429
      //
      // ⚠️ AND THE IN-PLANE ARITHMETIC UNDER-READS THE DEFECT, WHICH IS THE FINDING.
      // egg/pizza/hotdog all sized this in the eye's own TANGENT PLANE:
      //   normalised centre  sqrt((0.040/0.084)^2 + (0.052/0.0874)^2) = 0.762
      //   plus glint radius  0.036/0.084 = 0.4286        ->  1.19, 19% outside.
      // A 19% overhang predicts solidity 0.865 (hand-derived; it is selftest case 3
      // of `ey_pacman`). The render delivers 0.735. The missing term is PARALLAX: the
      // glint is authored `SCLERA_R * 0.40` = 0.066R in FRONT of the pupil, and the
      // lobby camera pitches 20 degrees down, so a mesh standing that proud projects
      // clear of the pupil before it is ever seen. `soup.ts` records the same term
      // from the other side and nothing else in the cast applies it to the glint.
      // **The rim test has to be done after projection, i.e. in pixels.**
      //
      // ⚠️ AND THE MARGIN HAS TO BE 38%, NOT THE 18% THE CAST RECIPE STATES. The first
      // attempt here shipped 0.030R at offset 0.018/0.024 with z pulled BACK to
      // SCLERA_R * 0.60 — an in-plane 0.705 — and re-measured at **0.7897 / 0.8014**,
      // i.e. two thirds of the defect still on screen. Two terms live in PIXELS and so
      // are invisible to any sum done in head radii (full derivation in `egg.ts`):
      //   BLOOM   `stage.ts` thresholds at 0.80 luma and `flatMat` white is 1.000, so
      //           the highlight glows 2-3 px INTO the pupil's rim. On this character's
      //           41 px pupils that is ~0.14 of a radius, and it is an absolute size,
      //           which is why the identical recipe measures 0.95 on pizza's 29 px
      //           pupils and 0.83 on hotdog's 19 px ones.
      //   BURIAL  pulling z BACK was the wrong direction and made it worse. A glint
      //           whose centre sits behind the pupil's front surface emerges as a cap
      //           displaced OUTWARD from the pupil's axis, because the surface recedes
      //           fastest away from its own apex. `egg.ts` is the least-bitten of the
      //           four precisely because its glint is a flattened LENS sitting on the
      //           pupil's surface rather than a ball inside it.
      //
      // So both catchlights become lenses ON the surface, at an in-plane 0.62:
      //   glint  0.036 -> 0.030R (35.7% of the pupil radius, the cast's own ratio, so
      //          the catchlight is not made timid), offset 0.040/0.052 -> 0.014/0.018,
      //          z 0.86 -> 0.77 SCLERA_R with `scale.z 0.45`. The pupil's front face at
      //          that offset is 0.1228R from the eye centre and the lens centre is
      //          0.1268R, so it sits 0.004R PROUD — emerging whole, not as a sliver.
      //          0.265 + 0.357 = **0.622**.
      //   glint2 0.019 -> 0.016R, offset 0.036/0.044 -> 0.023/0.029, z 0.78 -> 0.73,
      //          same lens treatment. 0.430 + 0.190 = **0.620**. It was at 0.887 and
      //          the file called it "a small secondary glint": it was a second bite.
      //
      // 🚨 AND THE SIGNS WERE MIRRORED. `- sx` and `+ sx` put each catchlight on the
      // opposite side of the two eyes, which is two eyes lit by two different lights
      // facing each other. This file's own `GAZE_X` comment forbids exactly that for
      // the pupil — *"mirroring them per side makes a cross-eyed doll"* — and then
      // mirrors both highlights three lines later. A catchlight is a reflection of ONE
      // key, so it takes a CONSTANT sign, which is what `egg.ts` states and does.
      const glint = new THREE.Mesh(new THREE.SphereGeometry(R * 0.030, 10, 8), flatMat('#ffffff'));
      glint.position.set(eyeX + GAZE_X - R * 0.014, eyeY + R * 0.018, eyeZ + SCLERA_R * 0.77);
      glint.scale.set(1, 1, 0.45);
      glint.userData.noOutline = true;
      face.add(glint);

      const glint2 = new THREE.Mesh(new THREE.SphereGeometry(R * 0.016, 8, 6), flatMat('#ffffff'));
      glint2.position.set(eyeX + GAZE_X + R * 0.023, eyeY - R * 0.029, eyeZ + SCLERA_R * 0.73);
      glint2.scale.set(1, 1, 0.45);
      glint2.userData.noOutline = true;
      face.add(glint2);

      // Brows — genuinely asymmetric: the right brow sits higher and cocks harder,
      // the left stays low and nearly flat, so the crooked smile below reads as ONE
      // character's deliberate smirk instead of a matched, interchangeable pair.
      //
      // They also came DOWN. On HEAD the brows sat 0.25R/0.18R above eyes that were
      // only 0.125R tall, which at lobby framing is a full brow-height of bare dough
      // between them — read as a PNG they are two stray ink dashes floating near the
      // hole, not brows. The sclera's top is now at 0.182R, so 0.255R/0.235R keeps a
      // deliberate 0.05-0.07R gap and nothing more.
      const browY = eyeY + (sx > 0 ? R * 0.255 : R * 0.235);
      const browTilt = sx > 0 ? 0.36 : 0.04;
      const brow = new THREE.Mesh(
        new THREE.CapsuleGeometry(R * 0.026, R * 0.15, 4, 8),
        toonMat({ color: PALETTE.ink, roughness: 0.4 })
      );
      brow.position.set(eyeX, browY, surfaceZ(eyeX, browY, R * 0.012));
      brow.rotation.z = Math.PI / 2 - sx * browTilt;
      brow.castShadow = true;
      face.add(brow);
    }

    // ── THE MOUTH IS AN OPENING NOW, NOT A STROKE ────────────────────────────
    // Uri: *"the mouth is deeper than burger but still missing details."* The old
    // mouth was one ink torus arc: a single value, lying on the icing. `rules.ts`
    // asks for "a lip line with a darker throat plane behind it", and the crooked,
    // lopsided smile is explicitly to be kept — it is the personality, and Uri named
    // it as the better half of this face.
    //
    // Four values inside one silhouette, which is the whole point:
    //   dough ~0.70 rendered  ->  throat 0.063  ->  ink lip 0.082  ->  tongue 0.569
    // The THROAT is deliberately darker than `PALETTE.ink` so the lip reads as the
    // rim OF a hole rather than as the hole itself, and the tongue is the light rung
    // that stops the opening reading as a flat black patch at gameplay distance.
    //
    // The old arc's `rotation.z = PI * 1.08` on a 0.85PI arc also left a stray tail
    // hanging off the bottom-left corner — visible in `shots/ch/donut/before`, and it
    // is why the smile read as a "J". The whole mouth is now one group with a single
    // tilt, so the lopsidedness is authored once instead of falling out of a rotation.
    const mouthX = -R * 0.02;
    const mouthY = -R * 0.55;
    // -0.20 -> -0.12. At 0.20 rad ON TOP of `stance.headTilt` 0.22 and `headTurn`
    // -0.30, the mouth read as a hook rather than as a crooked smile — the tilts
    // compound, and the mouth's own is the one that is free to give.
    const mouthTilt = -0.12;          // high corner at -x; `GAZE_X` agrees with it
    const mouth = new THREE.Group();
    mouth.name = 'donut_mouth';
    // Sampled at the arc's DEEPEST point, not its centre. The mouth is a 0.22R
    // shape lying across a curved tube, so its extremes sit on surfaces up to
    // 0.09R apart; sampling anywhere but the frontmost of them leaves part of it
    // buried, which is exactly how a first attempt at this lost all but a sliver.
    mouth.position.set(mouthX, mouthY, surfaceZ(mouthX, mouthY - R * 0.10, R * 0.014));
    mouth.rotation.z = mouthTilt;
    face.add(mouth);

    // 1. THE OPENING. `outlineGroup` gives this its own inverted-hull ink edge, so
    //    the upper lip line comes for free and in the cast's own ink.
    const throat = new THREE.Mesh(
      new THREE.SphereGeometry(R * 0.195, 20, 14),
      toonMat({ color: THROAT, roughness: 0.62 })
    );
    throat.name = 'donut_mouth_throat';
    // ── ROUND 1 SHIPPED 0.52 AND IT READ AS A GASP, NOT A GRIN ────────────────
    // Read as a PNG at the lobby camera, a 1 : 0.52 dark ellipse on a face is an
    // "O" — a surprised mouth. `rules.ts` is explicit that the crooked, lopsided
    // SMILE stays, so the opening is wider and half as tall (1.14 : 0.36), which
    // makes it a slot rather than a hole, and the smile itself is carried by the
    // lip below (see the upturned-corner arc) rather than by the opening's outline.
    throat.scale.set(1.20, 0.38, 0.24);
    throat.position.y = -R * 0.030;
    throat.castShadow = true;
    mouth.add(throat);

    // 2. THE TONGUE — the light rung inside the dark. `noOutline`: an ink hull on a
    //    mesh this small, this deep inside another one, renders as a black smear.
    const tongue = new THREE.Mesh(
      new THREE.SphereGeometry(R * 0.105, 14, 12),
      toonMat({ color: TONGUE, roughness: 0.44 })
    );
    tongue.name = 'donut_mouth_tongue';
    tongue.scale.set(1.30, 0.40, 0.42);
    tongue.position.set(-R * 0.012, -R * 0.062, R * 0.026);
    tongue.userData.noOutline = true;
    mouth.add(tongue);

    // 3. THE LIP, AND IT IS WHAT MAKES THIS A SMILE ──────────────────────────
    // The ink arc that used to BE the whole mouth, kept, and now doing the job it is
    // good at. The trick is that the arc runs PAST horizontal at both ends: a torus
    // arc of `PI + 2d` starting at `PI - d` spans [180-d, 360+d] degrees, so both
    // ends finish ABOVE the mouth's centre line and the corners turn up. d = 0.15PI
    // puts them at y = +0.454 of the arc radius before the flatten, which is the
    // upturned corner a viewer reads as "smiling" — an arc that stops exactly at
    // horizontal reads as a frown-neutral bowl, and that is what round 1 had.
    // ⚠️ 0.15PI WAS TOO MUCH AND THE TUBE WAS TOO FAT. Rendered, the ends came up
    // 27 degrees past horizontal on a lip 0.034R thick, and against a throat that is
    // also near-black the two merged into one heavy hook — the value step designed
    // between them (0.063 vs 0.082) is real and INVISIBLE, because both sit at the
    // bottom of the curve. 0.06PI plus a 0.022R tube keeps the upturn as a LINE, and
    // the step that actually reads is dough -> dark -> tongue, which is the one the
    // brief asked for.
    const LIP_D = 0.06 * Math.PI;
    const lip = new THREE.Mesh(
      new THREE.TorusGeometry(R * 0.215, R * 0.022, 8, 28, Math.PI + 2 * LIP_D),
      toonMat({ color: ink, roughness: 0.3 })
    );
    lip.name = 'donut_mouth_lip';
    lip.rotation.z = Math.PI - LIP_D;
    lip.scale.set(1, 0.58, 1);
    lip.position.y = -R * 0.010;
    lip.position.z = R * 0.012;
    lip.castShadow = true;
    mouth.add(lip);
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

  /**
   * The rig owns all body motion, so the base class's whole-body squash/lean would
   * fight it. Suppressed here; `onUpdate` drives the rig instead.
   */
  protected applyBaseMotion(): void {}
}
