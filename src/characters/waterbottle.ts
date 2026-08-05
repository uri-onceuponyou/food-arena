/**
 * WaterBottle (Legendary).
 *
 * Built on the shared ChibiRig — see `donut.ts` for the reference implementation of
 * this pattern. The rig supplies torso, arms, hands, legs, feet and all motion; this
 * file authors only the food mass on `rig.joints.head`, the face and a palette.
 *
 * This is the one genuinely transparent character in the cast, which makes it the
 * most dangerous to get wrong — see `render/toon.ts`'s `glossyMat` for the
 * `transmission` knob. Two decisions matter more than any other here:
 *
 *   1. The plastic shell keeps `transparent: false, opacity: 1` and lets
 *      `transmission` alone do the see-through work. Mixing alpha-blended
 *      transparency with transmission on the same surface is what produces the
 *      "wrong sort order" failure the brief warns about — alpha blending doesn't
 *      write depth, so the character's own limbs and the water inside can draw in
 *      the wrong order frame to frame. Depth-writing transmission avoids that.
 *   2. The water fill is NOT transmissive (transmission: 0). It is a normal glossy
 *      opaque liquid, seen through the transmissive shell around it. Three.js's
 *      transmission pass samples one snapshot of the opaque scene per transmissive
 *      object; nesting two transmissive materials inside each other (shell AND
 *      water both transmissive) makes that snapshot incoherent and one of them
 *      reads as flat or invisible. Keeping the water opaque-but-glossy sidesteps
 *      that entirely and still looks convincingly wet.
 *
 * The old preview background (0x39b7e8, a bright sky blue) was the worst case for a
 * blue translucent character — the exact "vanishes against the backdrop" trap the
 * brief calls out. **That backdrop was itself the bug**: measured, it put the figure
 * DARKER than the ground (-0.40 contrast) while the shipped match puts it LIGHTER
 * (+0.27), so this character was hardened against a frame the game never renders.
 * `preview.ts` now uses a warm mid-dark ground matching the match's own polarity.
 * The defences below are kept — they are correct for a translucent character on any
 * ground. This character used to measure the WORST figure/ground in the cast against
 * the real polarity (+0.034 body-minus-frame, against a >= 0.10 floor); the blue
 * family was lifted in round 2 and it now measures **+0.109 idle / +0.116 run**, above
 * the floor. See the palette block for the arithmetic and for why it is albedo-only. Held off by: a full ink outline on the shell/cap/label
 * (opaque regardless of transmission), a bright near-white label wrap breaking up
 * the transparent mass, a saturated water fill colour distinct from the pale shell,
 * and a dark matte cap anchoring the silhouette.
 *
 * Personality guide (identity is fixed, presentation is not, per the brief):
 *   Translucent blue bottle, darker cap, big smile.
 *
 * ── Structural fix, round 4 ──────────────────────────────────────────────────
 * Three independent art-director passes in a row flagged the same defect: the
 * eyes floated on a stalk above the cap, detached from the character's actual
 * body. No amount of shrinking the gap or adding a connector fixed it, because
 * the STRUCTURE was wrong — a face perched on top of a hat is never going to read
 * as attached, no matter how solid the perch. The fix is to stop treating the cap
 * as a head-topper and instead put the face on the BOTTLE ITSELF: eyes, brows and
 * a big smile are built directly onto the upper shell wall, just above the label,
 * using the shell's own lathed surface (`shellSurface()`, the same technique
 * `hamburger.ts`'s `crownSurface` and `soup.ts`'s `bowlSurface` use for THEIR
 * curved masses). The cap goes back to being what its name says — a cap, worn on
 * top of the bottle that IS the head — with no face-bearing geometry on it at all.
 */

import * as THREE from 'three';
import { BaseCharacter, type AnimContext } from './types';
import type { CharacterDef } from '../game/rules';
import { PALETTE } from '../game/rules';
import { toonMat, glossyMat, flatMat, outlineGroup, roundedBox } from '../render/toon';
import { ChibiRig, type LimbPart } from './rig';
import { bodyType } from './bodies';
import { aim, blade as lidBlade, curl, knob, localBounds, loop, massAnchor, rod } from './appendages';
import { CHARACTER_HEIGHT } from '../units';

// ── Palette ──────────────────────────────────────────────────────────────────
// Reuses the prototype's own water/waterCap hexes for the shell/liquid so the
// character's colours tie directly to its own ability VFX (Water Spray, Cap Shot —
// see `game/rules.ts`), then adds two new tones the prototype palette has no room
// for: a genuinely dark navy for the matte cap/boots, and a near-white for the label.
// Pushed off `PALETTE.water`'s #BFEFFF. A blind critic measured the problem
// exactly: at that value and hue the shell sat on top of a light backdrop with
// near-zero separation, and this character would vanish against a pale arena floor.
// The shell is still clearly the LIGHTEST thing on the character (that is what sells
// plastic against liquid) but it now carries real chroma of its own.
// ── The whole blue family lifted, for FIGURE/GROUND ──────────────────────────
// Water Bottle finished round 1 with the worst figure/ground in the cast: body luma
// minus frame luma **+0.034** against this project's own >= 0.10 floor
// (`docs/LESSONS.md` §3), on a frame whose polarity is now verified to match the
// shipped match (`preview.ts`'s backdrop note). The cause is arithmetic and not
// lighting: `WATER` is the limb colour AND the fill, at luma 0.409, and the cap
// family — hands, boots, cap — sat at 0.206 and 0.147. Two thirds of the character
// was darker than the kitchen floor it stands on.
//
// This is deliberately an ALBEDO-ONLY fix, exactly as HotDog's was (0.0740 ->
// 0.1328 in round 1). A measured rim-light sweep already proved lighting cannot buy
// this: retuning the existing rim is worth at most +0.012 before it inverts, because
// past ~3.4 it lights the GROUND faster than it lights the fighter. Do not reach for
// the rim here.
//
// Hue and saturation are held: `WATER` goes 0.816 -> 0.792 HSL saturation while its
// luma goes 0.409 -> 0.522, so this spends nothing from the colour budget
// `arena-scan` guards (`docs/LESSONS.md` §7).
const PLASTIC = '#BDEDFA';
const WATER = '#4FB0E8';            // richer, saturated liquid fill
const WATER_DEEP = '#3A87BE';       // shaded underside tone, and the fill-line ring
const CAP = '#3E6EA3';              // matte navy — still the darkest area, no longer near-black
// Held DOWN deliberately while the rest of the family came up. Lifting every blue
// by the same amount would have bought figure/ground by compressing this character's
// own internal value ladder, which is the cast's next known defect — measured, the
// ladder is shell 0.893 -> water/limb 0.625 -> deep 0.481 -> cap 0.407 -> boot 0.268,
// a span of 0.625 against 0.664 before this change, with every step preserved and in
// the same order.
// …and this is where the cast's dark rung goes on Water Bottle. `CAP_DARK` already
// dresses the belt, spout, cap ridges and boots — 10.8% of the character's pixels in
// one constant — so taking it to a near-black navy is a one-line change that buys the
// whole P05. Measured at pot_south, shipped framing: range 0.645 -> 0.710,
// p05 0.217 -> 0.151, steps@0.10 6 -> 7, figure/ground 0.161 -> 0.144. The ladder note
// above still holds — the ORDER of the five bands is unchanged, the bottom one just
// finally reaches the reference's dark end (18 of 18 BS plates sit below 0.18).
const CAP_DARK = '#0E1F35';
// The label was near-white, which spent the single largest opaque area on this
// character for no chroma at all. It is now a hot sports-label orange: it is the
// clearest "this is a drinks bottle" cue available, it is the complement of the
// blue it sits on (so it is the most salient thing on the character), and the cast
// owns the warm half of the wheel unopposed since the arena was re-keyed cool.
// Water Bottle was the only character with no warm area anywhere on it.
const LABEL = '#F0562A';            // wraparound sports label — saturated warm orange
const LABEL_PALE = '#FFF6EC';       // the label's own wave stripe, and the smile
const LABEL_TRIM = '#B8371A';       // trim rings on the label

// ── Costume layer ────────────────────────────────────────────────────────────
// A fresh independent art director named the missing costume/accessory layer as
// the TOP gap in the whole cast: without one, characters read as "naked mascot
// body with a themed head glued on" no matter how good the body sculpt is. A
// crossbody sports strap with a pouch and a carabiner clip is this character's
// silhouette-breaking item — it projects past the narrow bottle body the way a
// cape or backpack does on the reference roster — plus a thin retainer cord
// around the shoulder taper as a smaller "sports-cap strap" detail.
const STRAP_FABRIC = '#2E7D5B';    // sporty webbing — a fresh hue not used elsewhere on this character
const STRAP_TRIM = '#0C2418';      // near-black webbing trim, part of the same dark rung
const CARABINER_METAL = '#B6BEC4'; // brushed aluminium — genuinely new metalness on this character

// ── Bottle silhouette, in fractions of headRadius (R) ───────────────────────
// A genuine surface-of-revolution profile (LatheGeometry), not a stretched sphere —
// the shoulder-taper-into-a-narrow-neck is exactly the shape that reads as "bottle"
// at a glance, the same silhouette-first approach donut/pizza/taco take with their
// own identity shapes. Point order is bottom → top so LatheGeometry's automatic
// normals face outward correctly.
const SHELL_PROFILE: Array<[number, number]> = [
  [0, -0.98],      // rounded bottom, closes to the axis automatically
  [0.30, -0.96],
  [0.42, -0.91],
  [0.455, -0.84],  // base heel
  [0.468, -0.68],
  [0.428, -0.50],  // ── grip waist: the pinch a drinks bottle has, and the one
  [0.408, -0.34],  //    landmark a smooth cylinder can never have
  [0.428, -0.18],
  [0.468, -0.04],
  [0.478, 0.16],   // upper body, full width
  [0.458, 0.28],
  [0.40, 0.40],    // shoulder
  [0.27, 0.52],
  [0.20, 0.60],    // neck reached
  [0.19, 0.63],
  [0.19, 0.70],    // straight neck — long, because a long neck is what separates a
  [0.235, 0.73],   // bottle from a jar
  [0.235, 0.76],
  [0, 0.78],       // closes under the cap; the seam is fully hidden
];

const CAP_PROFILE: Array<[number, number]> = [
  [0.235, 0.76],   // matches the shell's lip exactly — no gap, no overlap
  [0.295, 0.79],   // cap flares out over the lip
  [0.295, 0.89],   // straight cap wall
  [0.255, 0.925],  // taper toward the shoulder of the cap
  [0.20, 0.945],
  [0.13, 0.955],
  [0, 0.962],
];
/**
 * The sports flip-spout. This is the one silhouette landmark a bottle can own that
 * nothing else in the cast has: a small stepped nub standing proud of the cap, with
 * a hinged lid flipped back off it.
 *
 * It matters more here than anywhere else in the cast. A bottle is a smooth vertical
 * cylinder — inherently the most generic shape on the roster — so identity has to be
 * bought from the parts that are NOT the cylinder: the cap, the label, the grip
 * waist, and the water level. This is the cap's share.
 */
const SPOUT_PROFILE: Array<[number, number]> = [
  [0.115, 0.95],
  [0.115, 1.035],
  [0.085, 1.06],
  [0.085, 1.10],
  [0, 1.115],
];

// ── Face placement, ON the shell wall ───────────────────────────────────────
// `EYE_Y`/`MOUTH_Y` are in the SAME absolute-fraction-of-R units as
// `SHELL_PROFILE`'s own second column, so they can be fed straight into
// `shellSurface()` below. Both sit on the UPPER body — above the grip waist,
// above the label, and below the shoulder taper — which is the widest,
// most camera-facing stretch of wall the bottle has.
const EYE_Y = 0.02;
const MOUTH_Y = -0.13;

// Water fill, in ABSOLUTE fractions of R first (bottom to the fill line), then
// re-expressed relative to its own sloshing pivot below.
const WATER_BOTTOM_F = -0.95;
// Raised hard, and the label dropped to meet it. The water used to be a 0.12R
// sliver between the label's top edge and the shoulder — the one feature that makes
// a transparent bottle read as a WATER bottle, and almost none of it reached the
// screen. There is now a ~0.55R block of saturated blue between the label and the
// fill line, which is the tallest single colour area on the character.
const WATER_FILL_F = 0.14;
/**
 * The liquid FOLLOWS the shell's own profile at 93%, rather than being a straight
 * cylinder inside it.
 *
 * A cylinder had to be sized against the WAIST — the narrowest point it passes
 * through — so it was a thin rod rattling around inside the widest parts of the
 * bottle, and almost none of it was close enough to the wall to survive the
 * shell's own tint and clearcoat. Following the profile keeps a real, constant
 * wall thickness (so no z-fighting) while putting the liquid right up against the
 * glass everywhere, which is the only way the colour actually reaches the screen.
 */
const WATER_INSET = 0.93;
const WATER_PROFILE_ABS: Array<[number, number]> = (() => {
  const pts: Array<[number, number]> = [[0, WATER_BOTTOM_F]];
  for (const [r, y] of SHELL_PROFILE) {
    if (y <= WATER_BOTTOM_F || y >= WATER_FILL_F) continue;
    pts.push([r * WATER_INSET, y]);
  }
  // Close with the shell's interpolated radius exactly at the fill line.
  let fillR = 0.4;
  for (let i = 0; i < SHELL_PROFILE.length - 1; i++) {
    const [r0, y0] = SHELL_PROFILE[i];
    const [r1, y1] = SHELL_PROFILE[i + 1];
    if (WATER_FILL_F >= y0 && WATER_FILL_F <= y1) {
      const t = y1 > y0 ? (WATER_FILL_F - y0) / (y1 - y0) : 0;
      fillR = (r0 + (r1 - r0) * t) * WATER_INSET;
      break;
    }
  }
  pts.push([fillR, WATER_FILL_F]);
  return pts;
})();
const WATER_RADIUS_F = WATER_PROFILE_ABS[WATER_PROFILE_ABS.length - 1][0];
// Pivot at the liquid's own mid-height, not the bottle's origin — rotating around
// this point makes it visibly TIP like a real half-full container instead of
// swinging like a pendulum hung from the bottle's base.
const WATER_PIVOT_F = (WATER_BOTTOM_F + WATER_FILL_F) / 2;

// ── Bespoke-limb geometry ────────────────────────────────────────────────────
// An independent art director named the shared snowman-body capsule arms and ball
// hands as the single biggest cast-wide tell; a follow-up pass recoloured/rescaled
// the same smooth taper and the note came back a THIRD time — recolouring a shared
// skeleton still reads as a shared skeleton. Round 4 fix: limbs are no longer a
// smooth taper at all. They are a genuinely ribbed/bellows profile — the "squeezable
// plastic hose" read the brief calls for, distinct in silhouette (not just material)
// from every other character's limbs. Kept OPAQUE here deliberately — the file
// header's whole point is that `transmission` is reserved for the head, where
// depth-write behaviour has been carefully reasoned through.

/** A ribbed, bellows-like limb segment: a flat cap at the joint origin (plugs
 * flush with no gap), then a shaft that alternates between a narrower "waist" and
 * a wider "rib" several times along its length before tapering to a rounded tip —
 * a squeeze-bottle accordion hose, not a smooth tapered tube. `taperedLimb`'s own
 * end-cap technique is reused so it still plugs cleanly into the rig's joints. */
function ribbedLimb(len: number, rTop: number, rBot: number, mat: THREE.Material, ribCount = 4, segs = 14): THREE.Mesh {
  // Points MUST run bottom → top for LatheGeometry's automatic normals to face
  // outward — this file's own SHELL_PROFILE comment already documents the same
  // rule; getting it backwards was a round 1 defect elsewhere in this file.
  const capBot = Math.min(rBot, len * 0.32);
  const capTopH = Math.min(rTop * 0.32, len * 0.12);
  const wallBotY = -(len - capBot);
  const wallTopY = -capTopH;
  const CAP = 5;
  const pts: THREE.Vector2[] = [];
  for (let i = CAP; i >= 0; i--) {
    const a = (i / CAP) * Math.PI * 0.5;
    pts.push(new THREE.Vector2(capBot * Math.cos(a), wallBotY - capBot * Math.sin(a)));
  }
  // Ribbed shaft: `ribCount` bulge-waist pairs between the two end caps, radius
  // interpolated from rBot to rTop along the way so the limb still reads as
  // tapered overall (thick near the body, narrower toward the extremity) — the
  // ribbing rides ON TOP of that taper rather than replacing it.
  const shaftSpan = wallTopY - wallBotY;
  const steps = ribCount * 2;
  for (let i = 1; i < steps; i++) {
    const t = i / steps;
    const y = wallBotY + t * shaftSpan;
    const base = THREE.MathUtils.lerp(rBot, rTop, t);
    const isRib = i % 2 === 1; // odd steps bulge OUT, even steps pinch IN
    pts.push(new THREE.Vector2(base * (isRib ? 1.16 : 0.88), y));
  }
  pts.push(new THREE.Vector2(rTop, wallTopY));
  const TCAP = 4;
  for (let i = 1; i <= TCAP; i++) {
    const a = (i / TCAP) * Math.PI * 0.5;
    pts.push(new THREE.Vector2(rTop * Math.cos(a), wallTopY + capTopH * Math.sin(a)));
  }
  const m = new THREE.Mesh(new THREE.LatheGeometry(pts, segs), mat);
  m.castShadow = true;
  m.receiveShadow = true;
  return m;
}

/**
 * A worn strap: a curved tube from `from` to `to`, bowed out through a control
 * point offset by `bow` — the same bezier-tube technique `soup.ts`'s
 * `buildHandleArc` uses for its bowl-handle arms, reused here for costume
 * webbing that has to read as fabric draped over a body rather than a rigid rod.
 */
function strapArc(from: THREE.Vector3, to: THREE.Vector3, bow: THREE.Vector3, radius: number, mat: THREE.Material): THREE.Mesh {
  const mid = from.clone().add(to).multiplyScalar(0.5).add(bow);
  const curve = new THREE.QuadraticBezierCurve3(from, mid, to);
  const m = new THREE.Mesh(new THREE.TubeGeometry(curve, 12, radius, 8, false), mat);
  m.castShadow = true;
  m.receiveShadow = true;
  return m;
}

/** A grip-ridge ring — the same "thin darker ring around a cylindrical wall" motif
 * the head's cap already uses, echoed here as the limb's cuff/joint accent. */
function ridgeRing(y: number, radius: number, thickness: number, mat: THREE.Material): THREE.Mesh {
  const ring = new THREE.Mesh(new THREE.TorusGeometry(radius, thickness, 8, 20), mat);
  ring.name = 'limb_ridge';
  ring.rotation.x = Math.PI / 2;
  ring.position.y = y;
  ring.castShadow = true;
  ring.receiveShadow = true;
  return ring;
}

// A miniature of the head's own CAP_PROFILE silhouette (narrow base, flared grip
// body, domed top) — the hand becomes a literal little bottle cap, the strongest
// possible "this hand belongs to THIS character" read available, and it moves the
// dark matte cap material down into the silhouette twice instead of once.
// Rounded off from a hard-shouldered cap silhouette. A blind critic read the old
// version as "a stack of three flat discs — a separate pile of bottle caps": the
// straight 0.96 wall between two hard corners, plus two full-width grip rings, gave
// the hand three parallel horizontal edges and no mass. It is still recognisably a
// cap, just a fist-shaped one.
const MINI_CAP_PROFILE: Array<[number, number]> = [
  [0, -0.98], [0.42, -0.88], [0.78, -0.62], [0.94, -0.24],
  [0.96, 0.08], [0.88, 0.40], [0.62, 0.68], [0.32, 0.86], [0, 0.94],
];

function buildCapHand(R: number, mat: THREE.Material, ridgeMat: THREE.Material): THREE.Group {
  const g = new THREE.Group();
  const pts = MINI_CAP_PROFILE.map(([r, y]) => new THREE.Vector2(r * R, y * R));
  const body = new THREE.Mesh(new THREE.LatheGeometry(pts, 16), mat);
  body.name = 'cap_hand';
  body.castShadow = true;
  body.receiveShadow = true;
  g.add(body);
  // One ridge, not two — two parallel rings at a hand's scale are what made this
  // read as a stack rather than a fist.
  g.add(ridgeRing(-0.02 * R, R * 0.985, R * 0.05, ridgeMat));
  return g;
}

// A rounded-bottom "bottle base" foot — echoes the shell's own rounded underside
// (SHELL_PROFILE's bottom curve) instead of the rig's blocky wedge, with a pale
// plastic trim ring near the ankle breaking up the dark boot the same way the
// label wrap breaks up the head's transparency.
const BOTTLE_FOOT_PROFILE: Array<[number, number]> = [
  [0, -1.0], [0.55, -0.92], [0.92, -0.68], [1.0, -0.38],
  [1.0, -0.05], [0.82, 0.10], [0.55, 0.15],
];

function buildBottleFoot(FR: number, mat: THREE.Material, trimMat: THREE.Material): THREE.Group {
  const g = new THREE.Group();
  const heightScale = FR * 1.35;
  const radiusScale = FR * 1.05;
  const pts = BOTTLE_FOOT_PROFILE.map(([r, y]) => new THREE.Vector2(r * radiusScale, y * heightScale));
  const body = new THREE.Mesh(new THREE.LatheGeometry(pts, 18), mat);
  body.name = 'bottle_foot';
  body.position.z = FR * 0.18;
  body.castShadow = true;
  body.receiveShadow = true;
  g.add(body);

  const trim = new THREE.Mesh(new THREE.TorusGeometry(radiusScale * 1.0, FR * 0.03, 8, 20), trimMat);
  trim.name = 'bottle_foot_trim';
  trim.rotation.x = Math.PI / 2;
  trim.position.set(0, -0.05 * heightScale, FR * 0.18);
  trim.castShadow = true;
  trim.receiveShadow = true;
  g.add(trim);

  return g;
}

export class WaterBottleCharacter extends BaseCharacter {
  private rig: ChibiRig;
  private water: THREE.Group;
  private bubbles: THREE.Object3D[] = [];
  private bubbleBaseY: number[] = [];
  private bubbleRange = 0;

  constructor(def: CharacterDef) {
    super(def);

    this.rig = new ChibiRig({
      palette: {
        // Contrasting zones rather than one flat colour — the reference bar
        // (bs_06/bs_02) dresses the body in distinct blocks (overalls/shirt/boots),
        // not a single hue repeated everywhere. A fresh independent art director named
        // the cast-wide failure directly: Soup, Water Bottle and Sushi all ended up
        // with cream/white tapered limbs and dark boots, reading as the same parts
        // reskinned. The HEAD shell stays pale PLASTIC — that's load-bearing for the
        // transmission/glass read and untouched here — but the limbs/torso move to the
        // richer, more saturated WATER blue (the same hue already used for the water
        // fill and this character's own ability VFX), a real value/saturation break
        // from the pale near-white shell. Dark navy hands/feet stay as the contrast.
        limb: WATER,
        hand: CAP,
        foot: CAP_DARK,
        torso: WATER,
        limbRoughness: 0.4,
      },
      // Body: STUB archetype (see `bodies.ts`) — no torso, head straight onto the
      // hips, very short thick limbs, wide stance. This is the character Uri named
      // when he called for the archetype: "one body type has very short legs and
      // hands, no torso — would work for the bottle."
      //
      // It is also the fix the silhouette test demanded. A bottle is inherently a
      // generic cylinder, and splitting it across a head AND a torso meant the
      // outline was a cylinder interrupted by a waist — two mediocre reads instead
      // of one. As a STUB the whole bottle is one continuous mass from cap to
      // base, which is the only silhouette a bottle actually has.
      //
      // `headFraction` is large because the bottle now IS the body: the shell
      // profile spans -0.94R to +0.90R, so R has to carry nearly the whole height.
      // `shoulderWidth` is the STUB hand-fit — the shell wall is 0.58R at shoulder
      // height, so the arms sit just outside it.
      proportions: bodyType('stub', {
        // Trimmed from 0.90. The reprofiled bottle is a taller SHAPE for the same R
        // (longer neck plus a spout above the cap), and at 0.90 it measured 2.45m
        // against a cast that sits at 2.2-2.35 — `shoot.mjs --char waterbottle`
        // prints the real bounding height, which is the only way to settle this.
        // Unchanged. STUB was given a torso this round and it measured INVISIBLE at
        // the shipped camera (`bodies.ts`, `torsoFraction`) — this character's
        // `headFraction` moved with it and moved back. Recorded because the next
        // pass will want the arithmetic: a 0.16H torso costs `2 * 0.16 / (1 + 0.95)
        // = 0.1641` of `headFraction` to keep the top of the head still, i.e.
        // 0.85 -> 0.6859. Measured `neckPinch` at the shipped facing: **0.3077**
        // against a six-plate Brawl Stars floor of 0.2449.
        headFraction: 0.85,
        // Pulled in from 0.31H with the shell: the reprofiled body is 0.525R at
        // shoulder height instead of 0.58R, and `bodies.ts` is explicit that this
        // number is a per-character fit on STUB rather than a preset value — the
        // arms have to clear the FOOD, and the food just got narrower.
        shoulderWidth: CHARACTER_HEIGHT * 0.25,
        // 0.225H -> 0.30H. STUB's own value was set to get four bottom-heavy masses
        // off their own legs; this is the same argument taken one step further for
        // the outline, and it stops short of x1.5 because that is where this
        // character measured a second island.
        stanceWidth: CHARACTER_HEIGHT * 0.30,
      }),
      // Upright and eager — chest forward, one arm raised as if reaching/
      // waving. Distinct from every other character's stance in this file's
      // own cast slice: the only one leaning back into an eager, alert posture.
      // `shoulderL` +0.46 and `shoulderR` -0.12 are both INWARD swings
      // (`docs/LESSONS.md` §12). On a 0.46m-wide bottle with a 0.52m shoulder span
      // that is the whole margin and more: both forearms measured 0.002 and 0.004
      // delivered — two limbs at effectively zero pixels, the same defect this
      // file already fixed once for the shoulder strap.
      stance: {
        shoulderL: -0.15, shoulderR: 0.12,
        elbowL: -0.18, elbowR: -0.46,
        twist: -0.06, headTilt: -0.05, headTurn: 0.12,
        hipSway: 0.015, lean: -0.05,
        // Measured at the shipped facing: 0.1187 base -> 0.1414 at splay alone ->
        // 0.1805 with the wider stance under it. `st1.5_sp0.35` was the one
        // combination that put this character on TWO islands, so the stance below
        // stops at x1.33 and the splay carries the rest.
        splay: 0.36,
      },
    });
    this.body.add(this.rig.joints.root);
    this.head = this.rig.joints.head;

    const R = this.rig.headRadius;
    const head = this.rig.joints.head;
    const pt = (rF: number, yF: number) => new THREE.Vector2(rF * R, yF * R);

    /** Exact surface point + outward normal on the shell at a given azimuth
     * (`theta`) and absolute height fraction (`yF`, same units as
     * `SHELL_PROFILE`'s own second column) — the single source of truth for the
     * exterior, so the face lands exactly ON the shell instead of floating above
     * or clipping through it. Same technique as `hamburger.ts`'s `crownSurface`
     * and `soup.ts`'s `bowlSurface`. */
    const shellSurface = (theta: number, yF: number): { pos: THREE.Vector3; normal: THREE.Vector3 } => {
      let seg = SHELL_PROFILE[0];
      let segNext = SHELL_PROFILE[1];
      for (let i = 0; i < SHELL_PROFILE.length - 1; i++) {
        if (yF >= SHELL_PROFILE[i][1] && yF <= SHELL_PROFILE[i + 1][1]) {
          seg = SHELL_PROFILE[i];
          segNext = SHELL_PROFILE[i + 1];
          break;
        }
      }
      const [r0, y0] = seg;
      const [r1, y1] = segNext;
      const t = y1 > y0 ? (yF - y0) / (y1 - y0) : 0;
      const rFrac = r0 + (r1 - r0) * t;
      const radius = rFrac * R;
      const y = yF * R;

      const dR = (r1 - r0) * R;
      const dY = (y1 - y0) * R;
      const n2 = new THREE.Vector2(dY, -dR);
      if (n2.lengthSq() < 1e-8) n2.set(1, 0);
      n2.normalize();

      const nx = Math.sin(theta);
      const nz = Math.cos(theta);
      const pos = new THREE.Vector3(nx * radius, y, nz * radius);
      const normal = new THREE.Vector3(nx * n2.x, n2.y, nz * n2.x).normalize();
      return { pos, normal };
    };

    // ── Materials ────────────────────────────────────────────────────────────
    const shellMat = glossyMat({ color: PLASTIC, roughness: 0.12, transmission: 0.6 });
    const capMat = toonMat({ color: CAP, roughness: 0.4 }); // matte — the eye's resting place
    const capRidgeMat = toonMat({ color: CAP_DARK, roughness: 0.4 });
    const labelMat = toonMat({ color: LABEL, roughness: 0.55 });
    const labelTrimMat = toonMat({ color: LABEL_TRIM, roughness: 0.4 });
    const waterMat = glossyMat({ color: WATER, roughness: 0.08, transmission: 0 }); // opaque on purpose — see file header
    const fillRingMat = toonMat({ color: WATER_DEEP, roughness: 0.3 });

    // ── Shell ────────────────────────────────────────────────────────────────
    const shellGeo = new THREE.LatheGeometry(SHELL_PROFILE.map(([r, y]) => pt(r, y)), 32);
    const shell = new THREE.Mesh(shellGeo, shellMat);
    shell.name = 'waterbottle_shell';
    shell.castShadow = true;
    shell.receiveShadow = true;
    head.add(shell);

    // ── Cap ──────────────────────────────────────────────────────────────────
    const capGeo = new THREE.LatheGeometry(CAP_PROFILE.map(([r, y]) => pt(r, y)), 24);
    const cap = new THREE.Mesh(capGeo, capMat);
    cap.name = 'waterbottle_cap';
    cap.castShadow = true;
    cap.receiveShadow = true;
    head.add(cap);

    // Grip ridges — thin rings around the cap wall, a shade darker, breaking up
    // what would otherwise be a featureless matte cylinder.
    for (const yF of [0.815, 0.87]) {
      const ridge = new THREE.Mesh(new THREE.TorusGeometry(R * 0.296, R * 0.013, 6, 24), capRidgeMat);
      ridge.name = 'waterbottle_cap_ridge';
      ridge.rotation.x = Math.PI / 2;
      ridge.position.y = R * yF;
      ridge.userData.noOutline = true;
      head.add(ridge);
    }

    // ── Sports flip-spout ────────────────────────────────────────────────────
    // The cap's share of the identity budget. A bottle body is the most generic
    // shape on the roster, so the parts that are NOT the cylinder have to carry
    // the read — and a stepped spout with its lid flipped back is a shape only a
    // sports bottle has. It is also the character's only upward silhouette break.
    const spout = new THREE.Mesh(
      new THREE.LatheGeometry(SPOUT_PROFILE.map(([r, y]) => pt(r, y)), 20),
      capRidgeMat
    );
    spout.name = 'waterbottle_spout';
    spout.castShadow = true;
    spout.receiveShadow = true;
    head.add(spout);

    // The flipped-back lid: a small disc hinged off the spout's base, tipped away
    // from the face. Set as an explicit quaternion rather than composed Euler
    // angles — a flat disc rotated by rotation.x then rotation.y goes edge-on and
    // disappears under this game's pitched-down camera, a trap this project has
    // already paid for once.
    const lidPivot = new THREE.Group();
    lidPivot.name = 'waterbottle_spout_lid';
    lidPivot.position.set(0, R * 0.955, -R * 0.115);
    lidPivot.quaternion.setFromAxisAngle(new THREE.Vector3(1, 0, 0), -1.15);
    head.add(lidPivot);

    const lid = new THREE.Mesh(
      new THREE.CylinderGeometry(R * 0.125, R * 0.125, R * 0.05, 18),
      capMat
    );
    lid.position.set(0, 0, -R * 0.135);
    lid.rotation.x = Math.PI / 2;
    lid.castShadow = true;
    lid.receiveShadow = true;
    lidPivot.add(lid);

    const hinge = new THREE.Mesh(
      new THREE.CylinderGeometry(R * 0.022, R * 0.022, R * 0.11, 8),
      capRidgeMat
    );
    hinge.rotation.z = Math.PI / 2;
    hinge.castShadow = true;
    lidPivot.add(hinge);

    // ── Label wrap ───────────────────────────────────────────────────────────
    // Wrapped around the LOWER body, below the grip waist, sitting proud of the
    // shell so it can never z-fight. Two jobs: it is the character's clearest
    // "drinks bottle" cue, and — now that it is a saturated warm orange rather
    // than near-white — it is the only high-chroma area on an otherwise blue
    // character, on a cast that owns the warm half of the wheel.
    //
    // It MOVED DOWN in the head+torso round. At its old span (-0.58 to -0.18) it
    // covered the belly of the bottle and left the water a 0.12R sliver; a
    // translucent bottle whose water you cannot see is just a translucent
    // cylinder, which is precisely the "generic blob" the silhouette test named.
    // Built as a lathe following SHELL_PROFILE at 1.025x, not as a straight
    // cylinder. The body is not a cylinder any more — it has a grip waist — so a
    // constant-radius band would stand proud at the pinch and sink into the shell
    // above and below it. Same fix, same reason, as Sushi's nori band.
    // Kept BELOW the grip waist (which pinches at -0.34 to -0.50): the waist is a
    // silhouette landmark and a band over it would flatten it back out.
    const labelTopF = -0.545;
    const labelBotF = -0.90;
    const LABEL_OUT = 1.025;
    const labelPts: THREE.Vector2[] = [];
    {
      const steps = 10;
      for (let i = 0; i <= steps; i++) {
        const yF = labelBotF + (labelTopF - labelBotF) * (i / steps);
        labelPts.push(new THREE.Vector2(shellSurface(0, yF).pos.length() === 0
          ? 0 : Math.hypot(shellSurface(0, yF).pos.x, shellSurface(0, yF).pos.z) * LABEL_OUT, yF * R));
      }
    }
    const label = new THREE.Mesh(new THREE.LatheGeometry(labelPts, 28), labelMat);
    label.name = 'waterbottle_label';
    label.castShadow = true;
    label.receiveShadow = true;
    head.add(label);

    const labelRadiusAt = (yF: number) =>
      Math.hypot(shellSurface(0, yF).pos.x, shellSurface(0, yF).pos.z) * LABEL_OUT;

    for (const yF of [labelBotF, labelTopF]) {
      const trim = new THREE.Mesh(new THREE.TorusGeometry(labelRadiusAt(yF), R * 0.016, 6, 28), labelTrimMat);
      trim.name = 'waterbottle_label_trim';
      trim.rotation.x = Math.PI / 2;
      trim.position.y = yF * R;
      trim.userData.noOutline = true;
      head.add(trim);
    }

    // A pale wave stripe across the label. At ~95px of character a printed logo is
    // unreadable, but a single light band inside the orange survives as a value
    // step and stops the label reading as one flat block.
    {
      const waveF = labelTopF - 0.10;
      const wr = labelRadiusAt(waveF) * 1.006;
      const wave = new THREE.Mesh(
        new THREE.CylinderGeometry(wr, wr, R * 0.085, 28, 1, true),
        toonMat({ color: LABEL_PALE, roughness: 0.5 })
      );
      wave.name = 'waterbottle_label_wave';
      wave.position.y = waveF * R;
      wave.userData.noOutline = true;
      head.add(wave);
    }

    // ── Water fill ───────────────────────────────────────────────────────────
    // Parented under its own pivot group so the sloshing rotation in `onUpdate`
    // tips it around its own mid-height rather than the bottle's base.
    this.water = new THREE.Group();
    this.water.name = 'waterbottle_water_pivot';
    this.water.position.y = WATER_PIVOT_F * R;
    head.add(this.water);
    const rel = (yF: number) => (yF - WATER_PIVOT_F) * R;

    const waterGeo = new THREE.LatheGeometry(
      WATER_PROFILE_ABS.map(([r, y]) => new THREE.Vector2(r * R, rel(y))),
      24
    );
    const waterBody = new THREE.Mesh(waterGeo, waterMat);
    waterBody.name = 'waterbottle_water';
    waterBody.userData.noOutline = true; // fully enclosed — an ink hull here would
    this.water.add(waterBody);            // just read as a stray line through the glass

    const waterTop = new THREE.Mesh(
      new THREE.CircleGeometry(WATER_RADIUS_F * R, 24),
      waterMat
    );
    waterTop.name = 'waterbottle_water_surface';
    waterTop.rotation.x = -Math.PI / 2;
    waterTop.position.y = rel(WATER_FILL_F);
    waterTop.userData.noOutline = true;
    this.water.add(waterTop);

    // The fill line itself — an explicit ring at the liquid's surface rather than
    // relying on colour contrast alone, so "how full is the bottle" reads instantly
    // even at gameplay distance.
    const fillRing = new THREE.Mesh(new THREE.TorusGeometry(WATER_RADIUS_F * R, R * 0.016, 6, 28), fillRingMat);
    fillRing.name = 'waterbottle_fill_line';
    fillRing.rotation.x = Math.PI / 2;
    fillRing.position.y = rel(WATER_FILL_F);
    fillRing.userData.noOutline = true;
    this.water.add(fillRing);

    // A few small bubbles for cheap life — see `onUpdate` for the drift.
    const bubbleMat = flatMat('#EAFFFF', { transparent: true, opacity: 0.55 });
    bubbleMat.depthWrite = false; // transparent + depthWrite is a silent occluder — §1
    const bubbleSpots: Array<[number, number, number, number]> = [
      [0.18, -0.55, 0.10, 0.045],
      [-0.22, -0.35, -0.08, 0.035],
      [0.08, -0.20, 0.05, 0.03],
    ];
    this.bubbleRange = R * 0.035;
    for (const [xF, yF, zF, sF] of bubbleSpots) {
      const b = new THREE.Mesh(new THREE.SphereGeometry(sF * R, 8, 6), bubbleMat);
      b.name = 'waterbottle_bubble';
      b.position.set(xF * R, rel(yF), zF * R);
      b.userData.noOutline = true;
      this.water.add(b);
      this.bubbles.push(b);
      this.bubbleBaseY.push(rel(yF));
    }

    // ── Belt ──────────────────────────────────────────────────────────────────
    //
    // ── This is `docs/LESSONS.md` §1 case 6, RECURRING AFTER ITS OWN FIX ────────
    // Case 6 is this file's shoulder strap: anchored to `joints.torso`, which on a
    // STUB body is an empty group AT THE HIPS, so it drew as a hook beside the
    // waist. That was fixed. The belt was then written against `joints.hips` —
    // a real joint, in the right place for a belt on a body that HAS a waist — and
    // this character does not have one. Measured: 3,974 px of footprint, **0 px
    // delivered**. The hips sit at y=0.315m and the bottle's own shell reaches down
    // to y=0.26m, so a 0.268m torus there is inside 0.35m of plastic. The
    // seventeenth instance of the lesson, and the second on this object.
    //
    // The fix is not another joint — it is to put the belt where the character
    // actually has a waist. `SHELL_PROFILE` has one: the GRIP WAIST at yF -0.50 to
    // -0.34, the pinch that makes this read as a drinks bottle rather than a
    // cylinder. Sizing the ring off `shellSurface` at that height (rather than off
    // a guessed fraction of R) means it cannot drift inside the shell again if the
    // profile is ever retuned — the same single-source-of-truth rule the face and
    // the label already follow.
    const BELT_YF = -0.42;
    const beltSeat = shellSurface(0, BELT_YF);
    const beltR = Math.hypot(beltSeat.pos.x, beltSeat.pos.z);
    const belt = new THREE.Mesh(
      new THREE.TorusGeometry(beltR * 1.02, R * 0.030, 8, 28),
      toonMat({ color: CAP_DARK, roughness: 0.55 })
    );
    belt.name = 'waterbottle_belt';
    belt.rotation.x = Math.PI / 2;
    belt.position.y = beltSeat.pos.y;
    belt.castShadow = true;
    belt.receiveShadow = true;
    head.add(belt);

    this.buildFace(R, shellSurface);
    this.dressTorsoAsBottle();
    this.dressLimbs();
    this.buildAccessories(R, shellSurface);
    this.buildSilhouetteEvents(R);

    outlineGroup(this.root);
    this.collectFlashTargets();
    this.rig.restPose();
  }

  /**
   * Structural fix, round 4: the face moves OFF the cap and onto the bottle's own
   * body. Three straight rounds of independent art direction named the same
   * defect no matter how the gap above the cap was tuned — "two dark balls on
   * stalks read as insect antennae, not a face" — because floating a face above
   * a hat is the wrong STRUCTURE, not a distance to tune. The bottle IS the head;
   * this treats it that way: eyes, brows and a big smile are built directly onto
   * the shell's own straight-wall surface (via `shellSurface`, this file's own
   * lathe-sampling helper, the same technique `hamburger.ts`'s `crownSurface` and
   * `soup.ts`'s `bowlSurface` use) at `EYE_Y`/`MOUTH_Y` — just above the label,
   * on the widest, flattest, most camera-facing stretch of the main body. The cap
   * goes back to being a plain cap, with no face-bearing geometry on it at all.
   *
   * Both eyes are built from one mirrored loop at an identical `theta`/`EYE_Y`,
   * so any residual asymmetry in the render is the camera angle, not the geometry.
   */
  private buildFace(
    R: number,
    shellSurface: (theta: number, yF: number) => { pos: THREE.Vector3; normal: THREE.Vector3 }
  ): void {
    // ── Mounted on `rig.joints.face`, re-anchored at the head origin ───────────
    // Every feature is authored in EXACT shell-surface coords by `shellSurface`, so it
    // cannot inherit `face`'s generic sphere-tuned forward offset — that offset is
    // zeroed and the features are parented to `face` anyway. With the offset cleared
    // `face` is a direct child of `head` with an identity transform, so this is a pure
    // reparent: nothing moves (proved by `tools/tmp/facemove.mjs`, which hashes every
    // mesh world matrix in the model). It matters because `thumbs.ts`'s character-select
    // framing rule is FACE-AWARE and falls back to the whole head box when this joint is
    // empty — a guess — and `tools/tmp/chars_metrics.mjs` cannot assert a face it cannot
    // find, which put four of the eleven characters outside that test.
    const face = this.rig.joints.face;
    face.position.set(0, 0, 0);
    const ink = PALETTE.ink;

    const EYE_THETA = 0.40;
    const eyeMat = toonMat({ color: ink, roughness: 0.25 });
    const browMat = toonMat({ color: CAP, roughness: 0.4 }); // ties the brows to the cap material
    // The face sits on the transparent upper body with saturated blue water behind
    // it, so ink eyes and a pale smile both hold their contrast; the previous
    // placement had them over pale near-white label, where the smile vanished.
    for (const sx of [-1, 1] as const) {
      const { pos, normal } = shellSurface(sx * EYE_THETA, EYE_Y);
      const outward = new THREE.Vector3(normal.x, 0, normal.z).normalize();
      const eyeG = new THREE.Group();
      eyeG.position.copy(pos).addScaledVector(outward, R * 0.02);
      eyeG.quaternion.setFromUnitVectors(new THREE.Vector3(0, 0, 1), outward);
      face.add(eyeG);

      const eye = new THREE.Mesh(new THREE.SphereGeometry(R * 0.155, 16, 14), eyeMat);
      eye.scale.set(1, 1.05, 0.6);
      eye.castShadow = true;
      eyeG.add(eye);

      const glint = new THREE.Mesh(new THREE.SphereGeometry(R * 0.04, 10, 8), flatMat('#ffffff'));
      glint.position.set(-R * 0.038, R * 0.045, R * 0.075);
      glint.userData.noOutline = true;
      eyeG.add(glint);

      // Brow: a slight friendly lift outward (not a V — this bottle is cheerful,
      // not fierce), on one shared height so the pair reads as deliberately level.
      const brow = new THREE.Mesh(new THREE.CapsuleGeometry(R * 0.022, R * 0.15, 4, 8), browMat);
      brow.name = 'waterbottle_brow';
      brow.rotation.z = Math.PI / 2 - sx * 0.18;
      brow.position.set(0, R * 0.205, R * 0.05);
      brow.castShadow = true;
      eyeG.add(brow);
    }

    // Big, warm smile — per the brief's own spec for this character, and a
    // repeated art-director miss when it lived up on the cap fused against the
    // stalk. Sits centred below the eyes, on the same shell wall, in the label's
    // bright near-white so it reads clearly against the richer WATER-blue shell.
    const mouthPt = shellSurface(0, MOUTH_Y);
    const mouthOutward = new THREE.Vector3(mouthPt.normal.x, 0, mouthPt.normal.z).normalize();
    const mouthG = new THREE.Group();
    mouthG.position.copy(mouthPt.pos).addScaledVector(mouthOutward, R * 0.022);
    mouthG.quaternion.setFromUnitVectors(new THREE.Vector3(0, 0, 1), mouthOutward);
    face.add(mouthG);

    const smileMat = toonMat({ color: LABEL_PALE, roughness: 0.4 });
    const smile = new THREE.Mesh(
      new THREE.TorusGeometry(R * 0.165, R * 0.032, 8, 20, Math.PI * 0.8),
      smileMat
    );
    smile.name = 'waterbottle_smile';
    smile.rotation.z = Math.PI * 1.09;
    smile.castShadow = true;
    mouthG.add(smile);
  }

  /**
   * Gives the torso bottle character instead of reading as a plain pale sphere.
   * The rig's default torso is already recoloured to the shell's own PLASTIC
   * tone via the palette, so this doesn't replace it (no `dressTorso` needed) —
   * it reshapes it slightly taller/narrower to break the round "ball body" read,
   * then wraps a label band around the middle, echoing the head's own label
   * wrap so the body reads as unmistakably "this bottle" rather than a generic
   * dressed torso. There is no `torsoSize`-driven helper needed here since the
   * default torso mesh itself is kept and just scaled + decorated in place.
   */
  private dressTorsoAsBottle(): void {
    // Nothing to dress under the STUB archetype (`bodies.ts`): there is no torso
    // mesh and `torsoHeight` is 0, so every offset below would collapse onto the
    // hip line. Kept intact because switching archetype is a supported one-line
    // fix — this is the body Water Bottle wears the moment it has a torso again.
    if (!this.rig.hasTorso) return;
    const tw = this.rig.metrics.torsoWidth;
    const torsoH = this.rig.metrics.torsoHeight;
    const taperMid = 0.86 + 0.30 * Math.sin(0.5 * Math.PI * 0.85); // rig.ts's taper at t=0.5
    const torsoHalfWidthMid = tw * 0.5 * taperMid;

    // Taller, narrower than the rig default — closer to a bottle's own
    // elongated silhouette than a round belly. The torso sits below the neck
    // and above the hips, so scaling it doesn't move the figure's overall
    // top-of-head-to-feet height (verified via the shoot tool's own height
    // print) — free proportion work with no height-budget cost.
    this.rig.torsoMesh?.scale.set(0.92, 1.10, 0.92);

    const labelMat = toonMat({ color: LABEL, roughness: 0.55 });
    const labelTrimMat = toonMat({ color: LABEL_TRIM, roughness: 0.4 });
    const labelRadius = torsoHalfWidthMid * 1.10;
    const labelY = torsoH * 0.56;
    const label = new THREE.Mesh(
      new THREE.CylinderGeometry(labelRadius, labelRadius, torsoH * 0.30, 24, 1, true),
      labelMat
    );
    label.name = 'waterbottle_torso_label';
    label.position.y = labelY;
    label.castShadow = true;
    label.receiveShadow = true;
    this.rig.joints.torso.add(label);
    for (const dy of [-torsoH * 0.15, torsoH * 0.15]) {
      const trim = new THREE.Mesh(new THREE.TorusGeometry(labelRadius, torsoH * 0.014, 6, 24), labelTrimMat);
      trim.name = 'waterbottle_torso_label_trim';
      trim.rotation.x = Math.PI / 2;
      trim.position.y = labelY + dy;
      trim.userData.noOutline = true;
      this.rig.joints.torso.add(trim);
    }
  }

  /**
   * Costume layer: a webbing carry-loop clipped to the bottle's neck, plus beaded
   * condensation on the clear upper shell.
   *
   * ── Why the crossbody strap had to go ───────────────────────────────────────
   * The previous accessory was a shoulder-to-hip strap with a hip pouch, anchored
   * to `joints.torso`. That was authored for a body with a torso. Water Bottle is
   * STUB — `hasTorso` is false, `torsoHeight` is 0, and `joints.torso` is an empty
   * group sitting AT THE HIPS — so every `torsoH * k` offset was silently
   * substituting the head radius, and the whole assembly rendered as a green hook
   * floating beside the bottle's waist at hip height, half inside the shell. This
   * is the same class of failure as Lollipop's cape hanging off `joints.neck` on a
   * torso-less body and rendering as a grey sheet through the floor.
   *
   * A carry-loop is the accessory this character actually has, it hangs off the
   * one part of the body that exists on STUB (the food mass itself), and it breaks
   * the silhouette at the top where nothing occludes it.
   */
  /**
   * SILHOUETTE EVENTS — a carry loop and a flip nozzle.
   *
   * Water Bottle measured the **worst hull deficiency in the cast at the shipped
   * facing, 0.0991, with ZERO appendages**. A bottle is a surface of revolution, so
   * it is a blob from every angle by construction — it is the one character whose
   * outline cannot be fixed by turning it round.
   *
   * The two things a real sports bottle has that break that outline are a carry
   * loop and a raised nozzle, and they are the right two for this camera as well as
   * for the food: the loop leaves the shell HORIZONTALLY at the neck (worth 0.85-1.0
   * of a screen-metre against a vertical element's 0.53), and the nozzle sits above
   * the cap where the shell has already stopped, so nothing can occlude it.
   *
   * Materials are this file's own: the loop is `CARABINER_METAL`, which the strap
   * clip already introduced, and the nozzle is `CAP_DARK`, so neither adds a hue to
   * a character whose palette was deliberately closed.
   */
  private buildSilhouetteEvents(R: number): void {
    const head = this.rig.joints.head;
    const box = localBounds(head);

    // ── Carry loop ────────────────────────────────────────────────────────────
    {
      // Down to the shoulder of the bottle and bigger. At 0.80 of the height the
      // shell is already narrowing into the cap, so the loop sat in the cap's own
      // projected shadow and measured nothing; at 0.68 it leaves the widest part.
      const { at, out } = massAnchor(head, box, { azimuth: -Math.PI * 0.52, height01: 0.68, inset: 0.08 });
      const g = new THREE.Group();
      g.name = 'waterbottle_carry_loop';
      aim(g, at, out.clone().add(new THREE.Vector3(0, 0.22, 0)).normalize());
      g.add(loop(glossyMat({ color: CARABINER_METAL, roughness: 0.32, metalness: 0.35 }), {
        radius: R * 0.50, tube: R * 0.105, arc: Math.PI * 1.35,
      }));
      head.add(g);
    }

    // ── Flip lid, open ────────────────────────────────────────────────────────
    // ROUND 2. The loop and the nozzle took this character 0.0991 -> 0.1943, just
    // short of the six-plate floor of 0.2007, and both sit on the same side. This
    // is the third event and it is deliberately at the BACK, which is the azimuth
    // that projects to screen-X at the shipped facing (see `appendages.ts`) — the
    // one place on a surface of revolution that nothing else can cover.
    {
      const box = localBounds(head);
      const { at, out } = massAnchor(head, box, { azimuth: Math.PI * 0.92, height01: 0.94, inset: 0.20 });
      const g = new THREE.Group();
      g.name = 'waterbottle_flip_lid';
      aim(g, at, out.clone().add(new THREE.Vector3(0, 0.20, 0)).normalize(), Math.PI * 0.5);
      g.add(lidBlade(toonMat({ color: CAP, roughness: 0.42, doubleSide: true }), {
        len: R * 0.46, halfWidth: R * 0.30, thick: R * 0.045, curl: 0.18, waist: 0.95,
      }));
      head.add(g);
    }

    // ── Flip nozzle ───────────────────────────────────────────────────────────
    {
      const nozzle = new THREE.Group();
      nozzle.name = 'waterbottle_nozzle';
      const { at } = massAnchor(head, box, { azimuth: Math.PI * 0.9, height01: 0.985, inset: 0.55 });
      aim(nozzle, at, new THREE.Vector3(0.10, 0.62, -0.78).normalize());
      head.add(nozzle);
      nozzle.add(rod(toonMat({ color: CAP_DARK, roughness: 0.45 }), {
        len: R * 0.38, rBase: R * 0.115, rTip: R * 0.080,
      }));
      const tip = knob(toonMat({ color: CAP, roughness: 0.4 }), R * 0.095);
      tip.position.y = R * 0.38;
      nozzle.add(tip);
    }

    // ── The straw ─────────────────────────────────────────────────────────────
    // A bent sports straw out of the cap, kicked hard sideways. It is here because
    // the carry loop measured **zero appendages** at both facings however large it
    // was made: a torus lying against a surface of revolution stays inside that
    // surface's own projection at a 58 deg camera, whatever its radius. A rod
    // leaving the TOP — where the shell has already ended and nothing is left to
    // project over it — is the mechanism that works, and this character had the
    // most obvious possible excuse for one.
    {
      const box = localBounds(head);
      const { at } = massAnchor(head, box, { azimuth: Math.PI * 0.05, height01: 0.99, inset: 0.55 });
      const pts = [
        at.clone(),
        at.clone().add(new THREE.Vector3(R * 0.04, R * 0.20, -R * 0.04)),
        at.clone().add(new THREE.Vector3(R * 0.28, R * 0.30, -R * 0.14)),
        at.clone().add(new THREE.Vector3(R * 0.60, R * 0.30, -R * 0.22)),
      ];
      const straw = curl(glossyMat({ color: LABEL, roughness: 0.3 }), pts, {
        rBase: R * 0.075, rTip: R * 0.062,
      });
      straw.name = 'waterbottle_straw';
      head.add(straw);
    }
  }

  private buildAccessories(
    R: number,
    shellSurface: (theta: number, yF: number) => { pos: THREE.Vector3; normal: THREE.Vector3 }
  ): void {
    const head = this.rig.joints.head;

    const strapMat = toonMat({ color: STRAP_FABRIC, roughness: 0.72 });
    const trimMat = toonMat({ color: STRAP_TRIM, roughness: 0.68 });
    const metalMat = toonMat({ color: CARABINER_METAL, roughness: 0.28, metalness: 0.75 });

    // Collar the loop hangs from — a webbing band around the neck, sized off the
    // shell's own surface so it grips rather than floats.
    const collarYF = 0.60;
    const collarR = Math.hypot(shellSurface(0, collarYF).pos.x, shellSurface(0, collarYF).pos.z);
    const collar = new THREE.Mesh(
      new THREE.TorusGeometry(collarR * 1.06, R * 0.032, 8, 22),
      strapMat
    );
    collar.name = 'waterbottle_neck_collar';
    collar.rotation.x = Math.PI / 2;
    collar.position.y = collarYF * R;
    collar.castShadow = true;
    collar.receiveShadow = true;
    head.add(collar);

    // The loop itself: a webbing ring standing out to one side, clearly outside the
    // bottle's own outline. Asymmetric on purpose — the cast's biggest repeated
    // note is that every character is a dead-front symmetric statue.
    const loop = new THREE.Mesh(
      new THREE.TorusGeometry(R * 0.15, R * 0.030, 8, 20),
      strapMat
    );
    loop.name = 'waterbottle_carry_loop';
    loop.position.set(-collarR * 1.05 - R * 0.10, collarYF * R + R * 0.05, 0);
    loop.rotation.y = Math.PI / 2;
    loop.rotation.z = 0.45;
    loop.castShadow = true;
    loop.receiveShadow = true;
    head.add(loop);

    const loopTrim = new THREE.Mesh(
      new THREE.TorusGeometry(R * 0.062, R * 0.026, 8, 16),
      trimMat
    );
    loopTrim.name = 'waterbottle_loop_keeper';
    loopTrim.position.set(-collarR * 1.02, collarYF * R + R * 0.01, 0);
    loopTrim.rotation.y = Math.PI / 2;
    loopTrim.castShadow = true;
    head.add(loopTrim);

    // Carabiner clipped through the loop — the one genuinely high-metalness
    // material this character carries anywhere.
    const carabiner = new THREE.Mesh(
      new THREE.TorusGeometry(R * 0.085, R * 0.020, 8, 16, Math.PI * 1.7),
      metalMat
    );
    carabiner.name = 'waterbottle_carabiner';
    carabiner.position.set(-collarR * 1.05 - R * 0.24, collarYF * R + R * 0.02, 0);
    carabiner.rotation.y = Math.PI / 2;
    carabiner.rotation.z = 0.9;
    carabiner.castShadow = true;
    head.add(carabiner);

    // Retainer cord — a thin strap ring around the bottle's own shoulder taper,
    // echoing a sports-cap retainer strap. Built via `shellSurface` so it sits
    // exactly on the shell, never floating or sunk into the taper.
    const cordYF = 0.42;
    const cordPt = shellSurface(0, cordYF).pos;
    const cordRadius = Math.hypot(cordPt.x, cordPt.z) * 1.05;
    const cord = new THREE.Mesh(new THREE.TorusGeometry(cordRadius, R * 0.014, 6, 24), trimMat);
    cord.name = 'waterbottle_cap_strap';
    cord.rotation.x = Math.PI / 2;
    cord.position.y = cordPt.y;
    cord.castShadow = true;
    head.add(cord);

    // Condensation speckles — small beaded droplets on the CLEAR upper shell
    // (above the label's -0.545 top edge), spread around the circumference clear
    // of the face (EYE_THETA=0.40, MOUTH at 0). This is the stretch with water
    // behind it, which is the only place a bead reads as condensation rather than
    // as a speck on a printed label.
    const dropMat = flatMat('#EAFFFF', { transparent: true, opacity: 0.45 });
    dropMat.depthWrite = false; // transparent + depthWrite is a silent occluder — §1
    const dropSpots: Array<[number, number, number]> = [
      [0.9, -0.28, 0.026], [2.4, -0.12, 0.020], [4.2, 0.04, 0.017],
      [1.6, -0.34, 0.022], [3.3, -0.20, 0.019], [5.4, 0.12, 0.024],
    ];
    for (const [theta, yF, sF] of dropSpots) {
      const { pos, normal } = shellSurface(theta, yF);
      const outward = new THREE.Vector3(normal.x, 0, normal.z).normalize();
      const drop = new THREE.Mesh(new THREE.SphereGeometry(sF * R, 8, 6), dropMat);
      drop.name = 'waterbottle_condensation';
      drop.position.copy(pos).addScaledVector(outward, R * 0.012);
      drop.scale.set(1, 1.3, 0.6);
      drop.userData.noOutline = true;
      head.add(drop);
    }
  }

  protected onUpdate(ctx: AnimContext): void {
    this.rig.animate({
      elapsed: this.elapsed,
      move01: ctx.moveSpeed01,
      attack01: this.attackT >= 0 ? this.attackT / this.attackDuration : -1,
      hit01: this.hitT >= 0 ? this.hitT / 0.26 : -1,
      dead01: this.deathT >= 0 ? this.deathT / 0.75 : -1,
    });

    // ── Water sloshing ────────────────────────────────────────────────────────
    // Small amplitude on purpose: the liquid is inset from the shell by a real wall
    // thickness (WATER_RADIUS_F vs the shell's 0.58 body radius), but that gap is
    // finite, and the disc's outer rim is the farthest point from the sloshing
    // pivot. Too large a swing pokes the rim through the plastic wall — this stays
    // safely inside that margin even at full run speed plus an attack kick.
    const move = THREE.MathUtils.clamp(ctx.moveSpeed01, 0, 1);
    const attack01 = this.attackT >= 0 ? this.attackT / this.attackDuration : 0;
    const kick = Math.sin(attack01 * Math.PI) * 0.05;
    this.water.rotation.z =
      Math.sin(this.elapsed * 1.7) * 0.018 + Math.sin(this.elapsed * 10.5) * 0.045 * move + kick;
    this.water.rotation.x =
      Math.cos(this.elapsed * 1.3) * 0.014 + Math.cos(this.elapsed * 10.5 + 1.1) * 0.03 * move;

    // Bubbles drift gently in place — cheap life, matches the sprinkle/pepperoni
    // "small independent motion" convention used elsewhere in the cast.
    for (let i = 0; i < this.bubbles.length; i++) {
      this.bubbles[i].position.y =
        this.bubbleBaseY[i] + Math.sin(this.elapsed * (0.6 + i * 0.13) + i * 2) * this.bubbleRange;
    }
  }

  /**
   * Structural limb rebuild, round 4. Three independent art-director passes named
   * the same root cause: every character shares the identical tapered-tube-and-
   * ball-joint limb TOPOLOGY, and recolouring that shared skeleton doesn't fix it.
   * Water Bottle's limbs are now genuinely RIBBED (`ribbedLimb`, a bellows/
   * accordion profile, not a smooth taper) — a squeezable-plastic-hose read that
   * is a different silhouette, not just a different colour, from every other
   * character's limbs. The hand stays a miniature of the head's own bottle cap
   * (its grip-ridge rings are part of that shape's own identity) and the foot
   * stays a rounded bottle base — both already a direct echo of this character's
   * own silhouette rather than a generic part recoloured. Kept fully opaque — see
   * the block comment above the geometry helpers for why transmission stays
   * reserved for the head.
   */
  private dressLimbs(): void {
    // Richer WATER blue, not the pale near-white shell tone — see the constructor's
    // own comment on the colour-convergence fix.
    const plasticMat = glossyMat({ color: WATER, roughness: 0.16 });
    const capMat = toonMat({ color: CAP, roughness: 0.4 });
    const capDarkMat = toonMat({ color: CAP_DARK, roughness: 0.4 });

    this.rig.dressLimbs((part: LimbPart, size) => {
      switch (part) {
        case 'upperArmL':
        case 'upperArmR':
          return ribbedLimb(size.len, size.radius * 1.02, size.radius * 0.72, plasticMat, 3);
        case 'forearmL':
        case 'forearmR':
          return ribbedLimb(size.len, size.radius * 0.70, size.radius * 0.52, plasticMat, 3);
        case 'handL':
        case 'handR':
          return buildCapHand(size.radius, capMat, capDarkMat);
        case 'thighL':
        case 'thighR':
          return ribbedLimb(size.len, size.radius * 1.0, size.radius * 0.84, plasticMat, 3);
        case 'shinL':
        case 'shinR':
          return ribbedLimb(size.len, size.radius * 0.84, size.radius * 0.66, plasticMat, 3);
        case 'footL':
        case 'footR':
          return buildBottleFoot(size.radius, capDarkMat, plasticMat);
        default:
          return null;
      }
    });
  }

  /** The rig owns all body motion; the base class's whole-body pass would fight it. */
  protected applyBaseMotion(): void {}
}
