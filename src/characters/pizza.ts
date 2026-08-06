/**
 * Pizza (Neon).
 *
 * Built on the shared ChibiRig — see `donut.ts` for the reference implementation of
 * this pattern. The rig supplies torso, arms, hands, legs, feet and all motion; this
 * file authors only the food mass on `rig.joints.head`, the face on `rig.joints.face`
 * and a palette.
 *
 * Identity is fixed by `rules.ts`: Pizza, Neon rarity, Dough Balls / Tomato Splat /
 * Cheese Blind. The triangle is explicitly the silhouette landmark here, so unlike
 * other characters it is protected rather than freely reinterpreted.
 *
 * ── ⚠️ THE OLD SENTENCE ABOVE IS KEPT BECAUSE IT WAS THE DEFECT ──────────────
 * It used to read: *"The written description ('triangular slice, pepperoni, crust
 * base, **closed smiling eyes**') is a personality guide, not a literal spec."*
 * It was treated as a literal spec, faithfully, and Uri's verdict on the result was
 * *"face is **TERRIBLE**"* — the second-harshest in the cast. `DECISIONS §42` shows
 * his blind ranking of seven characters tracking the `face:` string exactly: every
 * character he rated poorly is specified with CLOSED eyes or with no eye spec, and
 * the one specified **"open eyes with highlights"** (egg) is the one he rated best.
 * **The rule was obeyed and the rule was wrong.** `rules.ts`'s `face:` for pizza has
 * been rewritten; this file now builds that.
 *
 * ── Uri's three complaints, and where each is answered ───────────────────────
 *   *"face is TERRIBLE"*                -> `buildFace`, rebuilt from `egg.ts`'s open
 *                                          eye and taken past it (sclera as the
 *                                          brightest value, offset pupil, catchlight,
 *                                          a mouth with an interior).
 *   *"the torso should look more like    -> `dressTorso`, kneaded lobes + a fold +
 *    DOUGH"*                               flour, with the VALUE deliberately unmoved.
 *   *"the nose and ears are MESSY"*      -> `buildSilhouetteEvents`. They were cheese
 *                                          strands: one out of the face centre (the
 *                                          "nose") and a near-mirrored pair at the
 *                                          sides of the head (the "ears").
 *
 * Everything each of those blocks changed is argued at the block, against the render
 * in `shots/ch/pizza/{before,after}/` rather than against a description of it.
 */

import * as THREE from 'three';
import { BaseCharacter, type AnimContext } from './types';
import type { CharacterDef } from '../game/rules';
import { PALETTE } from '../game/rules';
import { toonMat, glossyMat, flatMat, outlineGroup, roundedBox } from '../render/toon';
import { ChibiRig, type LimbPart } from './rig';
import { bodyType } from './bodies';
import { curl, knob, localBounds, massAnchor } from './appendages';
import { CHARACTER_HEIGHT } from '../units';

// ── "Tan-on-tan": the whole character was one value ──────────────────────────
// Two blind critics independently used almost the same words for Pizza, and the
// instrument agreed: range 0.532, P05 0.317, and every weak part boundary was in the
// legs (`kneeL|footL` 0.014). The cause was structural rather than a bad hex — the
// SLICE and the LIMBS were literally the same constant (`limb: CRUST`), and the torso
// was the crust roll, so head, arms, legs and body were three tones inside a third of
// a stop.
//
// Pizza also has the least figure/ground headroom in the cast — its second-worst
// station measures 0.106 against a 0.10 floor — so this pass had to be luma-NEUTRAL:
// every pixel darkened is paid for by one lightened. Slice up, torso up, limbs down.
// Measured at pot_south, shipped framing: range 0.536 -> 0.733, p05 0.313 -> 0.171,
// figure/ground 0.267 -> 0.259 (-0.008, i.e. essentially nothing).
const CRUST = '#F7CE86';       // baked dough slab — the light rung, lifted to pay for LIMB_CHAR
const CRUST_RIM = '#CE8A2E';   // puffier crust roll along the base — noticeably deeper/toastier
/** The torso barrel. Was `CRUST_RIM`, i.e. the crust roll at 16.7% of the character
 *  sitting at luma 0.45 — the single biggest mid-value mass on the model. Flour-dusted
 *  dough instead: it is the light step the dark limbs are read against. */
const TORSO_DOUGH = '#E8CC96';
/** Arms and legs. Was `CRUST` — the identical constant as the slice itself, which is
 *  exactly the "tan-on-tan" the critics named. A charred crust edge, and the dark rung
 *  of the whole character at 13% of its pixels. */
const LIMB_CHAR = '#331C0D';

// ── PASS 2: the limb CHAIN has to alternate, not ramp ────────────────────────
// The first value pass took both limb tones down together. That fixed range/P05 and
// BROKE the part boundary — measured, `shoulderL|elbowL` 0.044, `kneeL|footL` 0.035,
// because a chain of four segments each a shade darker than the last is one mass. The
// reference's grammar is alternation: mid sleeve, dark cuff, light glove. So the upper
// segment comes back UP, the lower segment holds the dark, and the boot takes its own
// darkest tone instead of sharing the shin's.
/** Upper arm / thigh, and every joint ball. `LIMB_CHAR` stays on forearm and shin. */
const LIMB_MID = '#6B3A16';
const SAUCE = PALETTE.tomato;  // '#E63946' — thin margin peeking past the cheese
const CHEESE = '#FFDE73';      // melted top layer — pushed brighter than the dough so it pops
const PEPPERONI = '#A8301E';   // wet cured meat — the MITT, a step lighter than the cuff above it
// Feet deliberately break from the crust family altogether — a charred-crust-bottom
// brown, dark enough to be a real value drop against the pale CRUST limbs rather than
// a slightly-darker shade of the same tan.
const CRUST_CHAR = '#160A03';

// ── Costume layer ────────────────────────────────────────────────────────────
// A fresh independent art director named the missing costume/accessory layer as
// the TOP gap in the whole cast: without one, characters read as "naked mascot
// body with a themed head glued on" no matter how good the body sculpt is. A
// worn leather delivery satchel slung across the torso is Pizza's silhouette-
// breaking item — it projects past the body outline the way a cape or backpack
// does on the reference roster — plus a quilted oven mitt overlaid on one hand
// as a smaller detail prop that still reads as this character's own trade.
const SATCHEL_LEATHER = '#221304';   // near-black worn leather — part of the dark rung
const SATCHEL_TRIM = '#120802';
const SATCHEL_BUCKLE = '#D9B458';
const MITT_RED = '#7A2014';
const MITT_CREAM = '#F7EFE0';
const FLOUR_DUST = '#F7ECD3';

// ── The FACE palette, and the one number the whole pass is steered on ─────────
// `DECISIONS-FOR-URI.md` §42: Uri ranked seven faces without seeing any code and his
// ranking matches the one-line `face:` field in `rules.ts` exactly. Pizza's said
// **"Closed eyes, smiling"** and his verdict was *"face is TERRIBLE"* — the
// second-harshest in the cast, and the second character specified shut.
//
// The measurement behind it: **0% of our eye pixels are above 0.85 luma, against the
// reference's 31.1% and 34.1%.** Measured on this character specifically, at the LOBBY
// camera Uri judges (`ch_pizza_shots.mjs`, pitch 20, head band of the mask's own
// height): `>0.94` share was **0.0002 / 0.0003** — i.e. nothing on this head is near
// white. The `>0.85` share was already 0.109/0.245 and that number is NOT the eyes: it
// is the CHEESE, which sits at luma ~0.87 because `cheeseMat` carries an emissive.
//
// ⚠️ That is the trap this palette is built around. A white sclera on this character
// has to beat a background that is ALREADY at 0.87, so an unlit-white sphere under our
// key light does not clear it — the sclera carries its own emissive lift, and `>0.94`
// (not `>0.85`) is the acceptance number for the eyes.
const EYE_WHITE = '#FFFFFF';
/** Warm near-black for the mouth's interior. Deliberately warmer than `PALETTE.ink`:
 *  an ink-blue opening on a warm yellow face reads as a printed sticker, and this is
 *  meant to read as a hole. Not a new value extreme — `CRUST_CHAR` is darker. */
const MOUTH_DARK = '#2A0E12';
/** The tongue. Distinct from both `SAUCE` and `PEPPERONI` on purpose — a mouth
 *  interior the same red as a topping merges with the pepperoni at thumbnail size. */
const TONGUE = '#C4414C';
/** Teeth. Warm white, deliberately a step BELOW the sclera so the eye whites stay the
 *  brightest value anywhere on the character, which is what the spec asks for. */
const TOOTH = '#FFF6E4';
/** The melt shadow under the grin, which doubles as the lower lip. */
const CHEESE_SHADE = '#E0AF3C';
/** Kneaded-dough crease on the torso. A shade under `TORSO_DOUGH`, not a new hue —
 *  the torso's job in the value ladder (the light step the dark limbs read against)
 *  is measured and must not move. */
const DOUGH_FOLD = '#D3B27A';

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
 * Tapered limb segment: a flat cap (radius `rTop`) right at the joint origin — so it
 * plugs flush into the shoulder/hip with no gap — tapering down a straight wall to a
 * rounded hemisphere tip of radius `rBot`. Unlike the rig's default capsule (uniform
 * radius top-to-bottom), this reads as a real tapered form: thick doughy shoulder,
 * narrower wrist, per the art director's call for varied taper per character.
 */
function taperedLimb(len: number, rTop: number, rBot: number, mat: THREE.Material, segs = 12): THREE.Mesh {
  // Points MUST run bottom → top for LatheGeometry's automatic normals to face
  // outward — this file's other lathes (dough wedge etc.) rely on the same rule.
  // Getting it backwards was a round 1 defect: the real mesh got face-culled
  // invisible and its outline shell rendered as a solid dark wedge instead of a
  // thin line, which is exactly the "flipper" artifact a render caught.
  // Bottom tip is a full rounded hemisphere; the TOP is a shallow dome rather than
  // a hard flat disc — round 2 found that a flat cap, at the angle the rig's rest
  // pose rotates the shoulder/hip to, reads as a flat flag/wing sticking out of
  // the joint rather than blending into it. The dome keeps almost the whole
  // length budget for the actual tapered shaft.
  const capBot = Math.min(rBot, len * 0.45);
  const capTopH = Math.min(rTop * 0.42, len * 0.16);
  const wallBotY = -(len - capBot);
  const wallTopY = -capTopH;
  const CAP = 5;
  const pts: THREE.Vector2[] = [];
  for (let i = CAP; i >= 0; i--) {
    const a = (i / CAP) * Math.PI * 0.5;
    pts.push(new THREE.Vector2(capBot * Math.cos(a), wallBotY - capBot * Math.sin(a)));
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

/** A thin ring cinched around a limb — rolled-cuff / trim detail, sitting proud of
 * the limb's own surface at local Y `y`. */
function cuffRing(y: number, radius: number, thickness: number, mat: THREE.Material): THREE.Mesh {
  const ring = new THREE.Mesh(new THREE.TorusGeometry(radius, thickness, 8, 20), mat);
  ring.name = 'limb_cuff';
  ring.rotation.x = Math.PI / 2;
  ring.position.y = y;
  ring.castShadow = true;
  ring.receiveShadow = true;
  return ring;
}

/**
 * A worn strap/cord: a curved tube from `from` to `to`, bowed out through a control
 * point offset by `bow` — the same bezier-tube technique `soup.ts`'s `buildHandleArc`
 * uses for its bowl-handle arms, reused here for costume webbing that has to read as
 * cloth draped over a body rather than a rigid straight rod.
 */
function strapArc(from: THREE.Vector3, to: THREE.Vector3, bow: THREE.Vector3, radius: number, mat: THREE.Material): THREE.Mesh {
  const mid = from.clone().add(to).multiplyScalar(0.5).add(bow);
  const curve = new THREE.QuadraticBezierCurve3(from, mid, to);
  const m = new THREE.Mesh(new THREE.TubeGeometry(curve, 12, radius, 8, false), mat);
  m.castShadow = true;
  m.receiveShadow = true;
  return m;
}

/**
 * Doughy fist mitt: a flattened palm plus three knuckle bumps and a thumb — a real
 * hand silhouette rather than a smooth ball. `side` is +1/-1 to mirror the thumb.
 */
function buildDoughMitt(R: number, side: 1 | -1, mat: THREE.Material): THREE.Group {
  const g = new THREE.Group();
  const palm = new THREE.Mesh(new THREE.SphereGeometry(R * 0.95, 14, 12), mat);
  palm.scale.set(1.0, 0.8, 1.14);
  palm.position.z = R * 0.05;
  palm.castShadow = true;
  palm.receiveShadow = true;
  g.add(palm);
  for (let i = 0; i < 3; i++) {
    const kx = (i - 1) * R * 0.46;
    const knuckle = new THREE.Mesh(new THREE.SphereGeometry(R * 0.30, 8, 8), mat);
    knuckle.position.set(kx, R * 0.28, R * 0.66);
    knuckle.castShadow = true;
    knuckle.receiveShadow = true;
    g.add(knuckle);
  }
  const thumb = new THREE.Mesh(new THREE.CapsuleGeometry(R * 0.26, R * 0.38, 4, 8), mat);
  thumb.position.set(side * R * 0.78, -R * 0.05, R * 0.20);
  thumb.rotation.set(0.25, 0, side * 0.85);
  thumb.castShadow = true;
  thumb.receiveShadow = true;
  g.add(thumb);
  return g;
}

/**
 * A hearty charred-crust wedge boot: toe box + a proud sole plate + an ankle cuff
 * blending up into the shin — a real boot silhouette, not the rig's single blocky
 * wedge. `fw` is the foot-width scale the rig hands `dressLimbs` for this slot.
 */
function buildCrustBoot(fw: number, bodyMat: THREE.Material, trimMat: THREE.Material): THREE.Group {
  const g = new THREE.Group();
  const upper = new THREE.Mesh(roundedBox(fw * 0.92, fw * 0.62, fw * 1.30, fw * 0.22, 3), bodyMat);
  upper.position.set(0, -fw * 0.10, fw * 0.22);
  upper.castShadow = true;
  upper.receiveShadow = true;
  g.add(upper);

  const sole = new THREE.Mesh(roundedBox(fw * 1.02, fw * 0.22, fw * 1.55, fw * 0.10, 2), trimMat);
  sole.position.set(0, -fw * 0.46, fw * 0.30);
  sole.castShadow = true;
  sole.receiveShadow = true;
  g.add(sole);

  // No separate ankle-cuff ring — the boot's own charred colour against the pale
  // dough leg already reads as a material break at the ankle without a bolted-on
  // collar (see the dressLimbs() comment for why these were removed cast-wide).
  return g;
}

export class PizzaCharacter extends BaseCharacter {
  private rig: ChibiRig;
  private pepperoni: THREE.Object3D[] = [];

  constructor(def: CharacterDef) {
    super(def);

    this.rig = new ChibiRig({
      palette: {
        limb: LIMB_MID,
        // Cheese hands sat too close in hue to the crust limb — both warm
        // gold, differing mostly in value. Pepperoni-red mitts (the same
        // colour already used for the topping) give hands a genuine hue
        // break, not just a lighter shade of the same colour.
        hand: PEPPERONI,
        foot: CRUST_CHAR,
        torso: TORSO_DOUGH,
        limbRoughness: 0.78,
      },
      // A fresh independent art director scored the cast 4/10 and named the body plan
      // directly: every character took the rig's defaults, so bodies read as identical
      // parts under different heads. Pizza is written as a broad-shouldered wedge —
      // wide at the top, tapering down — so shoulders go wide while the stance pulls
      // narrow underneath, echoing the wedge's own triangular silhouette down through
      // the whole body rather than stopping at the neck.
      // Body: STANDARD archetype — the neutral chibi baseline (see `bodies.ts`).
      // Pizza is one of the two characters that keep it, because a wedge needs a
      // real torso underneath to taper INTO and neither a stub nor a stilt body
      // gives it one. The two tweaks are the wedge's own identity carried down
      // through the body: broad at the shoulders, narrow at the feet.
      // `armRadius` was 0.080H — nearly 40% above STANDARD's own 0.058 — while
      // `armFraction` stayed at the archetype's 0.22, which makes the upper arm
      // 0.24m long and 0.44m across. That is not a thick arm, it is a PANCAKE:
      // rendered, both upper arms read as flat tan flippers stuck to the ribs,
      // and the hand spheres at 0.086H read as loose tomatoes rather than as the
      // ends of limbs. A knob tweaked past the point where the archetype's own
      // length still supports it stops being a tweak. Both are back near stock;
      // the wedge identity is carried by the shoulder/stance ratio, which is
      // where it belongs — it costs the limbs nothing.
      //
      // `torsoWidth` is pinned rather than left to STANDARD's own 1.18x of the
      // shoulder span, because this character deliberately runs its shoulders
      // 30% wide for the wedge read — and the archetype's ratio then dragged the
      // WAIST out to match, giving a barrel nearly as broad as the shoulders. A
      // head only reads as the hero form if the body under it is smaller.
      proportions: bodyType('standard', {
        // 0.26H -> 0.235H. Pizza passes at idle and FAILS at run: measured, the
        // left arm breaks off into its own 9,032 px connected component during the
        // stride (`--anims run`), because the run cycle's own arm swing adds to a
        // pivot that was already 0.095m clear of the body at rest. The idle-only
        // baseline could not see this, which is exactly why the acceptance test
        // now samples both.
        shoulderWidth: CHARACTER_HEIGHT * 0.235, // broad shoulders — wide top of the wedge
        torsoWidth: CHARACTER_HEIGHT * 0.26 * 0.82, // narrow waist — do NOT track the wide shoulders
        // 0.09H -> 0.135H. Still the second-narrowest in the cast, so the wedge's
        // own taper still reads; the point of the change is that the feet now
        // arrive somewhere the crust is not already covering.
        stanceWidth: CHARACTER_HEIGHT * 0.135,
        armRadius: CHARACTER_HEIGHT * 0.062,     // a touch thicker than stock, still a limb
        handRadius: CHARACTER_HEIGHT * 0.074,
        legRadius: CHARACTER_HEIGHT * 0.050,     // slimmer, tapering — continues the wedge's own narrowing
      }),
      // Confident, presenting swagger — one hand planted on the hip (heavy elbow
      // tuck on the right), head cocked and turned toward camera. Distinct from
      // every other character in this file's own cast slice: the only one with a
      // strong asymmetric hand-on-hip read.
      stance: {
        // `shoulderR` -0.42 is an INWARD swing on the right (`docs/LESSONS.md` §12),
        // and the wedge is at its widest on that side: the right upper arm, forearm
        // and mitt measured 0.867 / 0.382 / 0.692 with 0.165-0.380 of each covered
        // by the dough. +0.10 opens it. The left stays as authored — it is the arm
        // that was already clear, and over-opening it is what detached it at run.
        // REVERTED to +0.22 after measuring. §12 says +0.22 swings this arm ACROSS the
        // body, and it does — but the wedge is a CONE, so at shoulder height the body
        // it has to reach is much narrower than at the hip. Opening to -0.18 put the
        // whole left arm in its own connected component (12,876 px at idle, 13,012 at
        // run). The inward swing is what keeps the arm on the wedge. This is the far
        // edge of the same window the rest of the cast is fitted to.
        shoulderL: 0.22, shoulderR: 0.10,
        // -0.64 -> -0.46 on the right: at -0.64 the right forearm tucked behind the
        // wedge and delivered exactly 0.500 of its footprint, sitting on the
        // acceptance floor with no margin, and dropping to 0.206 at run.
        elbowL: -0.28, elbowR: -0.46,
        // `headTurn` 0.20 -> 0.14. The head is a flat SLAB, so its turn costs more
        // than a sphere's: at 0.20 the lobby-front frame shows a wide band of the
        // wedge's bare side face on the left while the whole face is pushed into the
        // right third of the triangle, and a face that is not centred in the frame the
        // owner judges is a face he sees less of. 0.14 keeps the three-quarter
        // attitude and the visible slab edge that gives the wedge its thickness.
        twist: 0.16, headTilt: -0.09, headTurn: 0.14,
        hipSway: -0.045, lean: 0.04,
        // The presenting swagger needs a base under it. Pizza responds to splay
        // more than to stance — measured at the shipped facing, splay 0.5 alone is
        // 0.1786 against stance x1.5's 0.1546 — because the wedge tapers, so
        // moving the hip pivot out moves it into thinner mass while rotating the
        // leg moves only the foot. 0.1945 with both.
        splay: 0.44,
      },
    });
    this.body.add(this.rig.joints.root);
    this.head = this.rig.joints.head;

    const R = this.rig.headRadius;
    const head = this.rig.joints.head;

    // ── Food mass: a triangular wedge, crust curving along the base, tip up ────
    // The triangle is Pizza's silhouette landmark, so it is built as a real
    // extruded prism (not squashed off a sphere/box) and kept big and simple —
    // one unmistakable shape read from any angle, per the reference bar.
    const tipY = R * 0.98;
    const baseY = -R * 0.86;
    const halfW = R * 0.80;
    const depth = R * 0.62; // slab thickness — enough to survive an edge-on view

    const shape = new THREE.Shape();
    shape.moveTo(0, tipY);
    shape.lineTo(halfW, baseY + R * 0.10);
    // Crust: a gentle outward bulge along the base, like the outer rim of a round pie.
    shape.quadraticCurveTo(0, baseY - R * 0.30, -halfW, baseY + R * 0.10);
    shape.lineTo(0, tipY);

    const dough = new THREE.Mesh(
      new THREE.ExtrudeGeometry(shape, { depth, bevelEnabled: true, bevelThickness: R * 0.035, bevelSize: R * 0.035, bevelSegments: 2, curveSegments: 16 }),
      toonMat({ color: CRUST, roughness: 0.85 })
    );
    dough.name = 'pizza_dough';
    dough.position.z = -depth / 2;
    dough.castShadow = true;
    dough.receiveShadow = true;
    head.add(dough);

    // Crust rim: a puffy raised band hugging the dough's own base curve exactly, so
    // it can never float outside the wedge silhouette or bury itself in the torso —
    // both happened in earlier passes (a free-floating capsule primitive first sat
    // fully embedded inside the dough, invisible, then — once pushed down to clear
    // the dough — sat low enough to disappear behind the torso instead). Built the
    // same way as the sauce/cheese insets: an exact offset of the dough's boundary,
    // extruded thicker and pushed proud in Z for a raised, toastier-coloured roll.
    //
    // ── 🚨 READ FROM THE RENDER: a smooth band under a triangle is a HAT BRIM ────
    // `shots/ch/pizza/before/lobby_front.png`. The rim was a clean extruded band that
    // jutted forward past the dough and carried a row of EVENLY SPACED light and dark
    // specks along it. Rendered, that is not a crust — it is a studded helmet brim,
    // and with the near-black neck collar directly beneath it the pair reads as one
    // dark band under a cone. `DECISIONS §39` names exactly this failure on taco: *"a
    // dark opening immediately above the darkest band merges into one mass that reads
    // as a brim"*, and it cost that character its mouth.
    //
    // Two changes, both about MANUFACTURED vs BAKED: the band juts forward less
    // (`rimDepth` +0.10R -> +0.06R), and seven overlapping puffs ride along its own
    // base curve so its top edge is knobbly rather than ruled. The even speck row is
    // gone entirely — see `buildAccessories`.
    const rimBand = R * 0.13;
    const rimShape = new THREE.Shape();
    rimShape.moveTo(-halfW, baseY + R * 0.10);
    rimShape.quadraticCurveTo(0, baseY - R * 0.30, halfW, baseY + R * 0.10);
    rimShape.lineTo(halfW, baseY + R * 0.10 + rimBand);
    rimShape.quadraticCurveTo(0, baseY - R * 0.30 + rimBand, -halfW, baseY + R * 0.10 + rimBand);
    rimShape.lineTo(-halfW, baseY + R * 0.10);
    const rimDepth = depth + R * 0.06;
    const rimMat = toonMat({ color: CRUST_RIM, roughness: 0.83 });
    const rim = new THREE.Mesh(
      new THREE.ExtrudeGeometry(rimShape, { depth: rimDepth, bevelEnabled: true, bevelThickness: R * 0.03, bevelSize: R * 0.03, bevelSegments: 2, curveSegments: 16 }),
      rimMat
    );
    rim.name = 'pizza_crust_rim';
    rim.position.z = -rimDepth / 2 + R * 0.06; // proud of the dough's own front face
    rim.castShadow = true;
    rim.receiveShadow = true;
    head.add(rim);

    // The knobbly half of the brim fix. Sampled off the SAME quadratic the dough's own
    // base uses, so a puff can never float off the rim or sink behind the dough — the
    // failure this file already recorded twice for free-floating primitives.
    const rimCurve = (t: number): THREE.Vector2 => {
      const p0 = new THREE.Vector2(-halfW, baseY + R * 0.10);
      const p1 = new THREE.Vector2(0, baseY - R * 0.30);
      const p2 = new THREE.Vector2(halfW, baseY + R * 0.10);
      const a = (1 - t) * (1 - t), b = 2 * (1 - t) * t, c = t * t;
      return new THREE.Vector2(a * p0.x + b * p1.x + c * p2.x, a * p0.y + b * p1.y + c * p2.y);
    };
    // Ends pulled in to t 0.10/0.90 rather than 0/1: a puff at the base CORNER pushes
    // the silhouette out past the wedge's own widest point, and two rounded masses
    // level with the bottom of a head is the one place this cast cannot afford them
    // (`DECISIONS §40`, five for five). At 0.10/0.90 they sit inside the triangle.
    const puffTs = [0.10, 0.23, 0.37, 0.50, 0.63, 0.77, 0.90];
    for (let i = 0; i < puffTs.length; i++) {
      const p = rimCurve(puffTs[i]);
      // Alternating sizes so the row reads as hand-shaped dough, not as a bead strip.
      const pr = R * (i % 2 === 0 ? 0.105 : 0.088);
      const puff = new THREE.Mesh(new THREE.SphereGeometry(pr, 12, 10), rimMat);
      puff.name = 'pizza_crust_puff';
      puff.position.set(p.x, p.y + rimBand * 0.52, R * 0.06);
      // Z-scale spans the rim's own depth so the puff bulges on BOTH faces; a puff
      // that only bulged forward would read as a bolt head, which is the artefact
      // this whole block exists to remove.
      puff.scale.set(1, 0.86, (rimDepth * 0.5) / pr);
      puff.castShadow = true;
      puff.receiveShadow = true;
      head.add(puff);
    }

    // Sauce margin: a slightly larger, thin triangle sitting just behind the cheese
    // so a sliver of red shows at the border — the detail that reads as "sauce under
    // cheese" instead of "solid yellow triangle".
    // Widened from 0.74 -> 0.80 of the wedge and lifted 0.14R -> 0.10R off the tip,
    // because the CHEESE had to grow to host a real face (see below) and the red
    // margin between them is the detail that says "sauce under cheese". Growing one
    // without the other would have closed the margin to nothing.
    const sauceShape = new THREE.Shape();
    const sTip = tipY - R * 0.10, sBase = baseY + R * 0.20, sHalfW = halfW * 0.80;
    sauceShape.moveTo(0, sTip);
    sauceShape.lineTo(sHalfW, sBase + R * 0.06);
    sauceShape.quadraticCurveTo(0, sBase - R * 0.16, -sHalfW, sBase + R * 0.06);
    sauceShape.lineTo(0, sTip);
    const sauce = new THREE.Mesh(
      new THREE.ExtrudeGeometry(sauceShape, { depth: R * 0.05, bevelEnabled: false, curveSegments: 16 }),
      glossyMat({ color: SAUCE, roughness: 0.18 })
    );
    sauce.name = 'pizza_sauce';
    sauce.position.z = depth / 2 - R * 0.01;
    sauce.castShadow = true;
    sauce.receiveShadow = true;
    head.add(sauce);

    // Cheese: inset further still, proud of the sauce, glossy and melted.
    //
    // ── This is the FACE's ground, and it was too small to hold one ──────────────
    // At 0.60 of the wedge the cheese was 0.48R across at its widest and the old
    // closed-arc eyes were 0.20R apart — which is why the render shows a large empty
    // triangle with a tiny doodle in the middle of it. An open eye with a sclera, a
    // pupil and a catchlight needs roughly 0.27R of width EACH, so the cheese goes to
    // 0.66 of the wedge and up 0.24R -> 0.20R off the tip. The triangle itself is
    // untouched: `rules.ts` protects it as this character's whole read at gameplay
    // distance, and only the inset layers move.
    //
    // The lower boundary is now THREE scallops rather than one clean quadratic. That
    // is the authorised half of the cheese-strand fix — `rules.ts` says *"drape them
    // across the FRONT of the slice or run them continuously round the edge"* — and a
    // continuous lobed edge cannot read as an ear, because ears are discrete and
    // paired and this is neither.
    const cheeseShape = new THREE.Shape();
    const cTip = tipY - R * 0.20, cBase = baseY + R * 0.32, cHalfW = halfW * 0.66;
    const cRim = cBase + R * 0.05;
    cheeseShape.moveTo(0, cTip);
    cheeseShape.lineTo(cHalfW, cRim);
    cheeseShape.quadraticCurveTo(cHalfW * 0.68, cBase - R * 0.10, cHalfW * 0.33, cBase + R * 0.02);
    cheeseShape.quadraticCurveTo(0, cBase - R * 0.20, -cHalfW * 0.33, cBase - R * 0.03);
    cheeseShape.quadraticCurveTo(-cHalfW * 0.68, cBase - R * 0.14, -cHalfW, cRim);
    cheeseShape.lineTo(0, cTip);
    const cheeseMat = glossyMat({ color: CHEESE, roughness: 0.25, emissive: CHEESE, emissiveIntensity: 0.18 });
    const cheese = new THREE.Mesh(
      new THREE.ExtrudeGeometry(cheeseShape, { depth: R * 0.07, bevelEnabled: true, bevelThickness: R * 0.02, bevelSize: R * 0.02, bevelSegments: 2, curveSegments: 16 }),
      cheeseMat
    );
    cheese.name = 'pizza_cheese';
    const cheeseFrontZ = depth / 2 + R * 0.07; // front face of the cheese slab, world Z
    cheese.position.z = depth / 2;
    cheese.castShadow = true;
    cheese.receiveShadow = true;
    head.add(cheese);

    // ── Pepperoni ────────────────────────────────────────────────────────────
    // Cupped discs sitting ON the cheese's front face. Kept small, few, and placed
    // outside the eyes/smile bounding zone (computed against the cheese triangle's
    // corners) — round 1 crowded the face with oversized pepperoni and blotted out
    // an eye entirely, which is exactly the "floating/colliding topping" failure the
    // brief warns about.
    //
    // ── 🚨 READ FROM THE RENDER: FOUR pepperoni WERE A SECOND FACE ──────────────
    // `shots/ch/pizza/before/lobby_front.png`. The old layout put a mirrored PAIR at
    // (±0.13R, +0.38R) directly above the eyes and another mirrored pair at
    // (±0.38R, -0.39R) either side of the mouth. Rendered, the upper pair is two
    // round dark spots evenly spaced above two closed arcs, and it reads as the
    // character's real eyes with the arcs demoted to brows. A face has exactly one
    // pair of anything; a topping must therefore never be MIRRORED at eye height.
    //
    // Three now, and deliberately asymmetric: two at cheek height flanking the grin
    // (where a round warm spot reads as a pepperoni sitting beside a mouth, and does
    // the blush's old job — see `buildFace`), one small one near the tip. Every
    // position is checked against the cheese triangle's own half-width at that height
    // so no disc hangs off the melt onto the sauce.
    const pepMat = glossyMat({ color: PEPPERONI, roughness: 0.18 });
    // [x, y, radius] — radii differ so the row cannot read as a manufactured set.
    const pepSpots: [number, number, number][] = [
      [-R * 0.37, -R * 0.33, R * 0.078],
      [R * 0.33, -R * 0.36, R * 0.070],
      [-R * 0.06, R * 0.44, R * 0.055],
    ];
    for (const [px, py, pr] of pepSpots) {
      const pep = new THREE.Mesh(new THREE.CylinderGeometry(pr, pr * 1.12, R * 0.045, 16), pepMat);
      pep.rotation.x = Math.PI / 2;
      pep.position.set(px, py, cheeseFrontZ + R * 0.02);
      pep.castShadow = true;
      pep.receiveShadow = true;
      head.add(pep);
      this.pepperoni.push(pep);
      // A faint grease glisten on top of each — the specular pop that sells "wet".
      const glistenMat = flatMat('#ffffff', { transparent: true, opacity: 0.5 });
      glistenMat.depthWrite = false; // transparent + depthWrite is a silent occluder — §1
      const glisten = new THREE.Mesh(new THREE.SphereGeometry(pr * 0.21, 8, 6), glistenMat);
      glisten.position.set(px - pr * 0.26, py + pr * 0.26, cheeseFrontZ + R * 0.04);
      glisten.userData.noOutline = true;
      head.add(glisten);
    }

    // ── Melted cheese droplets, ON THE FRONT ────────────────────────────────────
    // The other authorised half of the strand fix. Three fat rounded lobes hanging off
    // the cheese's scalloped lower edge onto the sauce, at three different depths.
    // They are ROUND and they are on the face plane, so neither of the two reads Uri
    // rejected is available to them: a drip cannot be an ear (it is not at the side of
    // the head) and it cannot be a nose (it is below the mouth and it does not leave
    // the mass). This is where "melted" now lives.
    const dripMat = glossyMat({ color: CHEESE, roughness: 0.24, emissive: CHEESE, emissiveIntensity: 0.14 });
    const drips: [number, number, number][] = [
      [-R * 0.30, -R * 0.635, R * 0.070],
      [R * 0.06, -R * 0.700, R * 0.082],
      [R * 0.36, -R * 0.600, R * 0.058],
    ];
    for (const [dx, dy, dr] of drips) {
      const drip = new THREE.Mesh(new THREE.SphereGeometry(dr, 12, 10), dripMat);
      drip.name = 'pizza_cheese_drip';
      drip.position.set(dx, dy, cheeseFrontZ - R * 0.035);
      drip.scale.set(1, 1.25, 0.62);
      drip.castShadow = true;
      drip.receiveShadow = true;
      head.add(drip);
    }

    // ── 🚨 THE EVEN SPECK ROW WAS READING AS RIVETS ─────────────────────────────
    // WAS (in `buildAccessories`): eight specks at `t = 0.12 .. 0.90` along the crust
    // rim's own base curve, alternating flour-white and char-black, described as
    // *"small surface detail so the crust reads as baked dough rather than one flat
    // matte colour."* The intent is right and the execution inverted it. Read off
    // `shots/ch/pizza/before/lobby_front.face.png`: eight equally-spaced light and dark
    // dots in a single line along a smooth band is a **studded hatband**, and with the
    // near-black neck collar directly beneath it, it is the largest single contributor
    // to this head reading as a helmet rather than as a slice. Regular spacing is a
    // manufacturing signal; nothing baked is regular.
    //
    // The crust's texture is carried by the seven overlapping puffs on the rim now.
    // What is left is flour on the DOUGH's exposed margin — the strip of bare crust
    // between the cheese and the wedge's edge, which is where flour survives baking.
    //
    // ⚠️ It lives HERE, in the constructor, and that is the whole point: every one of
    // `tipY`, `halfW`, `cTip`, `cRim` and `cHalfW` is in scope, so each mark is solved
    // against the shapes that were actually built rather than against three literals
    // re-typed in another method. The old block re-derived `rimDepth` by hand and got
    // a DIFFERENT answer from the constructor's (`depth + R*0.1` vs the rim's own),
    // which is exactly how a decal ends up 2 mm inside a mesh.
    const doughEdgeHW = (y: number) => ((tipY - y) / (tipY - (baseY + R * 0.10))) * halfW;
    const cheeseEdgeHW = (y: number) => Math.max(0, ((cTip - y) / (cTip - cRim)) * cHalfW);
    // The dough's flat front face is inset from its outline by `bevelSize` (R*0.035),
    // so the usable band stops short of the true edge by that much again.
    const BEVEL_INSET = R * 0.045;
    const flourMat = toonMat({ color: FLOUR_DUST, roughness: 0.92 });
    // [y, side, radius]. x is SOLVED as the centre of the usable band at that height,
    // so no mark can float off the wedge or hide behind the cheese however the
    // triangle is later retuned.
    const marks: Array<[number, number, number]> = [
      [R * 0.30, -1, R * 0.026],
      [R * 0.62, 1, R * 0.019],
      [-R * 0.16, 1, R * 0.030],
      [-R * 0.44, -1, R * 0.024],
      [-R * 0.52, 1, R * 0.020],
      [R * 0.02, -1, R * 0.017],
    ];
    for (const [my, side, mr] of marks) {
      const inner = cheeseEdgeHW(my) + mr * 1.4;
      const outer = doughEdgeHW(my) - BEVEL_INSET - mr * 1.4;
      if (outer <= inner) continue;   // no band at this height — skip rather than float
      const speck = new THREE.Mesh(new THREE.SphereGeometry(mr, 7, 6), flourMat);
      speck.name = 'pizza_flour_speck';
      // Front face of the dough is `depth/2 + bevelThickness`; +0.02R clears the sauce
      // slab, which is itself proud of the dough by 0.005R.
      speck.position.set(side * (inner + outer) * 0.5, my, depth / 2 + R * 0.035 + R * 0.02);
      speck.scale.set(1.3, 0.7, 0.42);
      speck.userData.noOutline = true;
      head.add(speck);
    }

    // ── Body: dress the torso ─────────────────────────────────────────────────
    // Two independent builder rounds both named the same gap: a themed head on a
    // generic body. Pizza's body is a crust-coloured torso wearing a smaller
    // crust-rimmed cheese badge on the chest, with cheese drips over the
    // shoulders and a pepperoni continuing the topping motif — so the slice's
    // food language runs the full height of the model instead of stopping dead
    // at the neck.
    this.rig.dressTorso((size) => {
      const group = new THREE.Group();
      group.name = 'pizza_torso';

      const bodyHalfW = size.w * 0.55;
      const bodyHalfD = size.d * 0.58;
      const bodyBottomY = size.h * 0.02;
      const bodyTopY = size.h * 1.05;
      // Baked a full step DARKER than the head's crust. Both critics who saw the
      // pale version said the same thing — "a shapeless pale-yellow dough blob in
      // the same value family as the slice's crust, so there is no head/body
      // separation". A chibi needs its head to win the first read outright, and
      // value is the cheapest way to give it that.
      const doughBody = new THREE.Mesh(
        torsoBarrel(bodyHalfW, bodyTopY - bodyBottomY, bodyHalfD, 0.26),
        toonMat({ color: TORSO_DOUGH, roughness: 0.85 })
      );
      doughBody.name = 'pizza_torso_crust';
      doughBody.position.y = (bodyTopY + bodyBottomY) / 2;
      doughBody.castShadow = true;
      doughBody.receiveShadow = true;
      group.add(doughBody);

      // ── "Make the torso look more like DOUGH" — Uri, verbatim ─────────────
      // Read against `shots/ch/pizza/before/lobby_front.png`, the complaint is exact:
      // the barrel is one smooth unbroken ovoid in one flat tone, and at lobby scale
      // it is an EGG. Nothing on it says the material is dough rather than plastic.
      //
      // The fix is deliberately NOT a colour change. `TORSO_DOUGH` is load-bearing —
      // this file's value pass pinned it as "the light step the dark limbs are read
      // against" and measured range 0.536 -> 0.733 on it — so the torso stays exactly
      // the value it is and gains dough's two actual signatures instead:
      //
      //   1. KNEADED LOBES. Dough is hand-shaped, so its surface is a set of soft
      //      overlapping masses, never one revolved profile. Four lobes at different
      //      radii ride proud of the barrel, in the barrel's OWN colour, so they read
      //      purely as shading and cost the value ladder nothing.
      //   2. A FOLD, and FLOUR. One shallow crease where the dough was pinched, in a
      //      shade of the same hue, plus dusting patches. Flour is the one cue that
      //      says "raw dough" rather than "baked bread", and this file already
      //      declares `FLOUR_DUST` for the crust.
      //
      // ⚠️ Every patch stays clear of the top 18% of the barrel. `head|torso` is this
      // character's tightest real adjacency (dLcontact 0.1723, 133 contacts) and it is
      // measured AT THE BOUNDARY — a light flour patch parked under the chin would
      // move that number while looking like it moved nothing.
      // ⚠️ AND EVERY ONE OF THEM IS PLACED ON A SOLVED SURFACE POINT, NOT A GUESS.
      // This file already carries the note, from the pass that lost a satchel buckle
      // to it: *"`bodyHalfD` is the value handed to `torsoBarrel`, and that helper
      // then applies a bulge of up to 1.16x, so the body's real front face sits well
      // past it. A badge parked at `bodyHalfD * 0.58` was ENTIRELY INSIDE the mesh and
      // rendered as a 2 mm gold nub."* `barrelSurface` below is `torsoBarrel`'s own
      // arithmetic run forwards, so a lobe at `k = 0.80` is provably 20% of the local
      // radius inside a surface that is measured rather than remembered — the same
      // principle as `appendages.ts`'s raycast, one level cheaper.
      const doughMat = toonMat({ color: TORSO_DOUGH, roughness: 0.85 });
      const foldMat = toonMat({ color: DOUGH_FOLD, roughness: 0.88 });
      const flourMat = toonMat({ color: FLOUR_DUST, roughness: 0.95 });
      const bodyH = bodyTopY - bodyBottomY;
      const barrelCentreY = (bodyTopY + bodyBottomY) / 2;
      /** `u` in (-1, 1) up the barrel, `theta` around it (0 = front, +X to the right),
       *  `k` a radial fraction of the local surface. Mirrors `torsoBarrel` exactly. */
      const barrelSurface = (u: number, theta: number, k: number): THREE.Vector3 => {
        const t = (u + 1) * 0.5;
        const bulge = 1 + 0.26 * Math.sin(t * Math.PI * 0.9) - 0.26 * 0.55 * t;
        const c = Math.sqrt(Math.max(0, 1 - u * u));
        return new THREE.Vector3(
          bodyHalfW * bulge * c * Math.sin(theta) * k,
          barrelCentreY + u * bodyH * 0.5,
          bodyHalfD * bulge * c * Math.cos(theta) * k,
        );
      };

      // [u, theta, radius as a fraction of bodyHalfW, y-scale]
      const lobes: Array<[number, number, number, number]> = [
        [0.30, -0.86, 0.36, 0.92],
        [0.16, 0.92, 0.31, 0.98],
        [-0.30, -0.24, 0.40, 0.80],
        [-0.46, 0.62, 0.30, 0.86],
      ];
      for (const [u, theta, lr, sy] of lobes) {
        const lobe = new THREE.Mesh(new THREE.SphereGeometry(bodyHalfW * lr, 14, 12), doughMat);
        lobe.name = 'pizza_dough_lobe';
        lobe.position.copy(barrelSurface(u, theta, 0.80));
        lobe.scale.set(1, sy, 1);
        lobe.castShadow = true;
        lobe.receiveShadow = true;
        group.add(lobe);
      }

      // The pinch. A shallow arc across the belly's FRONT, opening downward — a fold,
      // not a belt, and deliberately off-horizontal so it cannot be confused with the
      // sash beneath it.
      const fold = new THREE.Mesh(
        new THREE.TorusGeometry(bodyHalfW * 0.52, bodyHalfW * 0.055, 8, 22, Math.PI * 0.72),
        foldMat
      );
      fold.name = 'pizza_dough_fold';
      fold.position.copy(barrelSurface(-0.06, -0.10, 0.98));
      fold.rotation.set(0.26, 0, Math.PI * 1.14);
      fold.castShadow = true;
      group.add(fold);

      // Flour. Irregular sizes and no mirrored pair — a mirrored pair of light spots
      // on a torso is a shirt button placket, which is the same class of accidental
      // read as the four pepperoni that were a second face. All of it is kept on the
      // FRONT (|theta| < 0.8) because a z-flattened patch on the barrel's SIDE is
      // edge-on and delivers nothing, and kept below u = +0.5 for the `head|torso`
      // reason above.
      // ⚠️ ROUND 1 SIZED THESE AT 0.07-0.13 OF THE BARREL AND THEY READ AS HOLES.
      // Read off `shots/ch/pizza/after/lobby_front.png`: five hard-edged white ellipses
      // on a pale ovoid are eggshell chips, or Swiss-cheese holes, not dusting. Flour
      // reads by DENSITY, not by patch size — nine marks at roughly half the radius.
      const dust: Array<[number, number, number]> = [
        [0.42, -0.52, 0.062],
        [0.08, 0.34, 0.050],
        [0.46, 0.14, 0.040],
        [-0.34, 0.66, 0.036],
        [-0.18, -0.72, 0.046],
        [0.30, -0.16, 0.034],
        [-0.06, -0.44, 0.042],
        [0.20, 0.62, 0.030],
        [-0.44, -0.06, 0.038],
      ];
      for (const [u, theta, dr] of dust) {
        const speck = new THREE.Mesh(new THREE.SphereGeometry(bodyHalfW * dr, 8, 6), flourMat);
        speck.name = 'pizza_torso_flour';
        speck.position.copy(barrelSurface(u, theta, 0.97));
        speck.scale.set(1.35, 0.72, 0.40);
        speck.userData.noOutline = true;
        group.add(speck);
      }

      // ── There is NO chest wedge here, and that is the point ──────────────
      //
      // Two passes tried to put a miniature slice on this torso and both failed
      // in different ways. Apex-down, its bright curved edge landed dead centre
      // on the belly and read as a giant FROWNING MOUTH. Apex-up — a faithful
      // miniature of the head — a blind critic read it as "a second, smaller
      // pizza triangle pinned to the belly, an accidental duplicate head growing
      // out of the hips."
      //
      // The lesson generalises past this file: **repeating the head's own
      // silhouette on the torso does not reinforce identity, it competes with
      // it.** The head is already an unmistakable triangle; a second triangle
      // below it only splits the viewer's first read between two candidates.
      //
      // So the torso stops trying to be a pizza and does the job it is actually
      // needed for — separating from the head in VALUE and WIDTH so the slice is
      // clearly the biggest, brightest form on the character. It is baked a
      // deeper golden brown than the head's pale crust, it is narrower (see
      // `torsoWidth` in the constructor), and the one worn thing on it is a
      // horizontal sauce-red waist sash, whose direction and colour share
      // nothing with the wedge above.
      const sashY = size.h * 0.30;
      const sashH = size.h * 0.26;
      const sash = new THREE.Mesh(
        torsoBarrel(bodyHalfW * 1.03, sashH, bodyHalfD * 1.03, 0.06),
        toonMat({ color: SAUCE, roughness: 0.55 })
      );
      sash.name = 'pizza_torso_sash';
      sash.position.y = sashY;
      sash.castShadow = true;
      sash.receiveShadow = true;
      group.add(sash);

      const sashTrim = new THREE.Mesh(
        torsoBarrel(bodyHalfW * 1.045, sashH * 0.20, bodyHalfD * 1.045, 0.06),
        toonMat({ color: MITT_CREAM, roughness: 0.7 })
      );
      sashTrim.name = 'pizza_torso_sash_trim';
      sashTrim.position.y = sashY + sashH * 0.44;
      sashTrim.castShadow = true;
      group.add(sashTrim);

      // ── There is no chest pepperoni either ──────────────────────────────
      // A single small red disc centred on a bare belly does not read as a
      // topping; it reads as a NAVEL, or a button. Anything round, small, dark
      // and dead-centre on a torso will. The sash already carries this
      // character's red and carries it as a BAND, which cannot be mistaken for
      // anatomy.
      //
      // NOTE for anything mounted on this torso later: `bodyHalfD` is the value
      // handed to `torsoBarrel`, and that helper then applies a bulge of up to
      // 1.16x, so the body's real front face sits well past it. A badge parked
      // at `bodyHalfD * 0.58` was *entirely inside the mesh* and rendered as a
      // 2 mm gold nub on a bare belly. Measure
      // `doughBody.geometry.computeBoundingBox()` → `boundingBox.max.z`; do not
      // approximate. Same trap as the buried sesame seeds and the buried brow —
      // three times in this cast now.

      return group;
    });

    this.buildFace(R, cheeseFrontZ);
    this.dressLimbs();
    this.buildAccessories(R, head);
    this.buildSilhouetteEvents(R);

    outlineGroup(this.root);
    this.collectFlashTargets();
    this.rig.restPose();
  }

  /**
   * OPEN eyes with a white sclera, an offset pupil and a catchlight, and a wide grin
   * with a real interior — a dark opening, a tooth band and a tongue.
   *
   * ── The old face, and why it was not an implementation failure ───────────────
   * WAS: two `TorusGeometry` arcs (a closed `^_^` pair) plus a third arc for a smile.
   * `rules.ts` said **"Closed eyes, smiling"** and that is exactly what was built.
   * Uri, without seeing any code: *"face is TERRIBLE"* — and `DECISIONS §42` shows his
   * ranking of seven characters tracking that one `face:` string with no exceptions.
   * **The rule was obeyed and the rule was wrong**, which is the inverse of this
   * project's most expensive defect shape. The string has since been rewritten; this
   * builds the new one.
   *
   * ── The construction ladder, which Uri reproduced blind ─────────────────────
   * a flattened arc (a stroke) < a sphere with a specular < a sphere plus an explicit
   * glint mesh < **egg's open eye**. `egg.ts:1017` is the cast reference and this is
   * built from it rather than invented — sclera, pupil and catchlight as three
   * separate meshes — then taken past it, because even egg has a catchlight where the
   * reference has a SCLERA as the brightest mass on the face.
   *
   * ── ⚠️ THE ONE THING THAT IS PIZZA-SPECIFIC, AND IT IS THE HARD PART ─────────
   * Every other character's face sits on a mid or dark ground. This one sits on
   * `cheeseMat`, which carries `emissive: CHEESE, emissiveIntensity: 0.18` and
   * measures **luma ~0.87** — so the cheese is ALREADY above the 0.85 threshold the
   * cast-wide finding is stated in. A plain white sclera does not separate from it.
   * Two devices, both required:
   *   1. the sclera carries its own emissive lift, so it clears the cheese rather
   *      than tying with it (steered on `>0.94`, which was 0.0002 before);
   *   2. every eye sits inside a dark LASH/SOCKET ring, so the separation does not
   *      depend on the value difference alone. That ring is where the old closed arc
   *      goes — **demoted from BEING the eye to BOUNDING it**, which is what the new
   *      spec asks for and is also why the expression survives the change.
   */
  private buildFace(R: number, cheeseFrontZ: number): void {
    const face = this.rig.joints.face;
    // `face` is already pushed forward by the rig; pull local features back onto the
    // pizza's actual front (cheese) surface rather than the generic sphere assumption.
    const localZ = cheeseFrontZ - this.rig.headRadius * 0.82;
    const ink = PALETTE.ink;

    // ── Eyes ────────────────────────────────────────────────────────────────
    // x = 0.225R, y = -0.10R is not free: the cheese is a TRIANGLE and it narrows
    // upward, so every eye position is bounded by the melt's own half-width at that
    // height. At y = -0.10R the widened cheese reaches 0.366R and the SCLERA reaches
    // 0.355R, so the white is fully on the melt; the dark socket ring around it
    // overshoots by 0.010R onto the sauce margin, which is deliberate — a dark ring
    // touching the red edge reads as an eye set into the slice, and shrinking the eye
    // to avoid it would cost more than it buys. The eye is as large as this shape
    // allows, and the shape is the one `rules.ts` protects.
    const EYE_X = R * 0.225, EYE_Y = -R * 0.10, EYE_R = R * 0.130;
    const scleraMat = toonMat({
      color: EYE_WHITE, roughness: 0.34,
      // See the header: the ground under this face is already at luma ~0.87.
      emissive: EYE_WHITE, emissiveIntensity: 0.30,
    });
    const pupilMat = toonMat({ color: ink, roughness: 0.22 });
    const lashMat = toonMat({ color: ink, roughness: 0.30 });
    const glintMat = flatMat('#ffffff');

    for (const sx of [-1, 1] as const) {
      const eye = new THREE.Group();
      eye.name = `pizza_eye_${sx > 0 ? 'R' : 'L'}`;
      eye.position.set(sx * EYE_X, EYE_Y, localZ + R * 0.02);
      face.add(eye);

      // 1. SOCKET — a dark disc a shade larger than the sclera. Cheap, and it is what
      //    makes a white eye read on a near-white ground.
      const socket = new THREE.Mesh(new THREE.SphereGeometry(EYE_R * 1.16, 16, 14), lashMat);
      socket.scale.set(1, 1.14, 0.26);
      socket.castShadow = true;
      eye.add(socket);

      // 2. SCLERA — the brightest value anywhere on the character.
      const white = new THREE.Mesh(new THREE.SphereGeometry(EYE_R, 18, 16), scleraMat);
      white.scale.set(1, 1.14, 0.44);
      white.position.z = R * 0.012;
      white.castShadow = true;
      eye.add(white);

      // 3. PUPIL — real geometry, OFFSET. Both pupils move the SAME way in world
      //    space, never mirrored: a mirrored offset is two eyes looking outward, i.e.
      //    wall-eyed, and `docs/LESSONS.md` §12 records the mirrored-roll version of
      //    this exact mistake shipping on sushi as a lazy eye.
      const PUP_X = R * 0.020, PUP_Y = R * 0.004;
      const pupil = new THREE.Mesh(new THREE.SphereGeometry(EYE_R * 0.56, 14, 12), pupilMat);
      pupil.scale.set(1, 1.05, 0.42);
      pupil.position.set(PUP_X, PUP_Y, R * 0.052);
      pupil.castShadow = true;
      eye.add(pupil);

      // 4. CATCHLIGHT — `flatMat` is unlit, so this is the one element guaranteed to
      //    hit 1.0 whatever the key light does.
      //
      //    ⚠️ ROUND 1 PUT IT ON THE SCLERA AND IT WAS INVISIBLE. `docs/LESSONS.md` §1
      //    for the nineteenth time, in its subtlest form yet: the mesh rendered, it was
      //    unoccluded, it was at full brightness — and it was WHITE ON WHITE, so there
      //    was nothing to see. Read off `shots/ch/pizza/after/lobby_front.face.png`:
      //    both glints are there and neither registers as a highlight.
      //    **A catchlight is not a bright thing; it is a bright thing ON A DARK THING.**
      //    Both are therefore anchored to the PUPIL's centre, not the eye's, and offset
      //    by less than the pupil's own radius so they straddle its edge.
      const glint = new THREE.Mesh(new THREE.SphereGeometry(EYE_R * 0.28, 10, 8), glintMat);
      glint.position.set(PUP_X - R * 0.030, PUP_Y + R * 0.030, R * 0.074);
      glint.userData.noOutline = true;
      eye.add(glint);

      const bounce = new THREE.Mesh(new THREE.SphereGeometry(EYE_R * 0.14, 8, 6), glintMat);
      bounce.position.set(PUP_X + R * 0.032, PUP_Y - R * 0.030, R * 0.070);
      bounce.userData.noOutline = true;
      eye.add(bounce);

      // 5. UPPER LASH LINE — the old "closed happy eyes" arc, kept and demoted. It
      //    caps the eye, it carries the expression, and it is asymmetric (the
      //    character's right lid rides higher) so the face has one raised brow rather
      //    than two matched worry lines, which an art-director pass named cast-wide.
      const lash = new THREE.Mesh(
        new THREE.TorusGeometry(EYE_R * 1.02, EYE_R * 0.20, 8, 18, Math.PI * 0.86),
        lashMat
      );
      lash.position.set(0, EYE_R * 0.30, R * 0.030);
      lash.rotation.z = Math.PI * 0.07 + sx * 0.10;
      lash.castShadow = true;
      eye.add(lash);
    }

    // ── Mouth ───────────────────────────────────────────────────────────────
    // "A flat dark shape with no lip thickness or interior value step" is the per-part
    // note that killed the old arc, and `DECISIONS §38` states the fix generally: a
    // mouth needs a value step INSIDE the silhouette so it reads as an opening rather
    // than a painted curve. Four values, outermost first: melt shadow (the lower lip)
    // -> dark opening -> tooth band -> tongue.
    const MW = R * 0.235, M_TOP = -R * 0.325, M_CTL = -R * 0.825;
    const grin = (k: number, dy: number): THREE.Shape => {
      const s = new THREE.Shape();
      const w = MW * k, top = M_TOP + dy, ctl = M_CTL + dy;
      s.moveTo(-w, top);
      // Top edge SAGS at the centre, so the corners are the highest points on it —
      // that is what makes a closed shape read as a grin instead of as a slot.
      s.quadraticCurveTo(0, top - R * 0.055, w, top);
      s.quadraticCurveTo(0, ctl, -w, top);
      return s;
    };

    // The melt shadow, sitting a touch lower and wider and BEHIND the opening, so a
    // warm rim shows along the bottom of the grin and reads as a lower lip.
    const lip = new THREE.Mesh(
      new THREE.ExtrudeGeometry(grin(1.09, -R * 0.024), { depth: R * 0.03, bevelEnabled: false, curveSegments: 14 }),
      toonMat({ color: CHEESE_SHADE, roughness: 0.35 })
    );
    lip.name = 'pizza_mouth_lip';
    lip.position.set(0, 0, localZ - R * 0.012);
    lip.castShadow = true;
    face.add(lip);

    // The opening. Bevelled on purpose — a flat extrusion has no lip thickness, and
    // "no lip thickness" is half of the per-part complaint verbatim.
    const mouth = new THREE.Mesh(
      new THREE.ExtrudeGeometry(grin(1, 0), {
        depth: R * 0.05, bevelEnabled: true, bevelThickness: R * 0.020, bevelSize: R * 0.018,
        bevelSegments: 2, curveSegments: 14,
      }),
      toonMat({ color: MOUTH_DARK, roughness: 0.42 })
    );
    mouth.name = 'pizza_mouth';
    mouth.position.set(0, 0, localZ);
    mouth.castShadow = true;
    face.add(mouth);

    // Tooth band.
    //
    // ⚠️ ROUND 1 BUILT THIS AS A `roundedBox` AND IT READ AS A STRIP OF TAPE. A
    // straight bar under a SAGGING upper lip leaves a black wedge at each end and a
    // hard horizontal top edge in the middle, and at lobby scale that is a white
    // rectangle stuck inside a mouth, not teeth. Read off
    // `shots/ch/pizza/after/lobby_front.face.png`. Teeth follow the lip they hang
    // from, so the band is now an extrusion of the SAME quadratic as the mouth's top
    // edge, offset down — one curve, authored once, so the two can never drift.
    //
    // The width is 0.76 of the mouth's, not 0.86: the opening's bottom boundary rises
    // fast toward the corners (`y = M_TOP - t + t²`), and at 0.86 the band's own lower
    // corners sat 0.012R from breaching it.
    const TW = MW * 0.76, T_TOP = M_TOP - R * 0.020, T_SAG = R * 0.042, T_H = R * 0.058;
    const toothShape = new THREE.Shape();
    toothShape.moveTo(-TW, T_TOP);
    toothShape.quadraticCurveTo(0, T_TOP - T_SAG, TW, T_TOP);
    toothShape.lineTo(TW, T_TOP - T_H);
    toothShape.quadraticCurveTo(0, T_TOP - T_SAG - T_H, -TW, T_TOP - T_H);
    toothShape.lineTo(-TW, T_TOP);
    const teeth = new THREE.Mesh(
      new THREE.ExtrudeGeometry(toothShape, { depth: R * 0.030, bevelEnabled: false, curveSegments: 12 }),
      toonMat({ color: TOOTH, roughness: 0.30, emissive: TOOTH, emissiveIntensity: 0.12 })
    );
    teeth.name = 'pizza_mouth_teeth';
    teeth.position.set(0, 0, localZ + R * 0.046);
    teeth.castShadow = true;
    face.add(teeth);

    // Tongue. Sized against the opening's own lower BOUNDARY, not against the mouth's
    // widest point — that is the trap, and the first sizing here fell into it. The
    // bottom edge is `y(x) = M_TOP - t + t²` with `t = (1 - x/MW)/2`, so at
    // |x| = 0.091R the floor is already up at -0.535R while the mouth's centre reaches
    // -0.575R: a tongue wide enough to look like a tongue pokes out through the
    // corners long before it reaches the middle of the opening.
    const tongue = new THREE.Mesh(new THREE.SphereGeometry(R * 0.070, 12, 10),
      toonMat({ color: TONGUE, roughness: 0.36 }));
    tongue.name = 'pizza_mouth_tongue';
    tongue.scale.set(1.30, 0.55, 0.5);
    tongue.position.set(0, -R * 0.495, localZ + R * 0.048);
    tongue.castShadow = true;
    face.add(tongue);

    // ── The blush is GONE, and that is a decision, not an omission ──────────────
    // It was two `#FF9EC4` discs at 0.55 opacity and 0.06R across. In the lobby render
    // they are two pink specks with no readable shape, sitting exactly where the face
    // now needs the room, and the two cheek PEPPERONI do the same job — a warm round
    // accent flanking the grin — in this character's own material rather than in a
    // borrowed cartoon convention. Removed, not moved.
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
   * Costume layer: a satchel bag slung on a strap across the torso, plus a
   * quilted oven mitt on one hand and flour/char speckling on the crust rim.
   *
   * Placement rule for anything mounted on `joints.torso`/`joints.hips`: the
   * shared rig's thighs hang straight DOWN from y=0 in that same local frame
   * (see `rig.ts`'s `hipL`/`hipR`), so every torso-mounted prop here stays at
   * y ≥ torsoH*0.20 — comfortably above the hip line — and is pushed out past
   * the wedge's own broad shoulders in X, so nothing sinks into a leg or floats
   * disconnected from the body.
   */
  /**
   * SILHOUETTE EVENTS — cheese pull, and this is the block Uri rejected by name.
   *
   * ── WHAT WAS HERE, AND WHAT IT ACTUALLY RENDERED AS ─────────────────────────
   * Uri: *"the **nose and ears are MESSY**."* Read against
   * `shots/ch/pizza/before/lobby_front.png` and `lobby_3q.png`, both of those are
   * exactly this function, and the mapping is one-to-one:
   *
   *   `[PI*0.08, 0.34]`  azimuth ~0 = **straight out of the FACE**, mid height —
   *                      a yellow tube that crosses the right eye, hangs down the
   *                      middle of the head and past the chin. **That is the "nose".**
   *                      At three-quarter view it reads as an elephant's trunk.
   *   `[PI*0.55, 0.42]` and `[-PI*0.50, 0.30]` — a near-mirrored PAIR at mid-head
   *                      height, one either side, curving out and down.
   *                      **Those are the "ears"**, and they read as a handlebar
   *                      moustache in the three-quarter frame.
   *   `[PI*0.96, 0.28]`  behind the slab. This one was never the problem.
   *
   * `DECISIONS §40/§41`: **a pointed mass either side of a head reads as an ear or a
   * horn, and it overrides what the shape is made of — five for five** across
   * burrito, egg, hamburger, lollipop and this character. The old comment reasoned
   * entirely about `limbmatch`'s appendage metric and azimuth projection, and every
   * word of that reasoning is correct; it simply never asked what the shape would be
   * READ as. A metric that is necessary is not a metric that is sufficient, and
   * `appendages.ts`'s own postscript says so in the same words.
   *
   * ── WHAT IS HERE NOW, AND WHAT IT COSTS ─────────────────────────────────────
   * The rewritten `face:` spec authorises two placements: *"drape them across the
   * FRONT of the slice or run them continuously round the edge."* Both are taken, and
   * neither is here — the front drape is the cheese layer's own scalloped lower
   * boundary plus three round drips, built in the constructor. What remains in this
   * function is the REAR pair only:
   *
   *   · nothing in the front hemisphere at all, so there is no nose;
   *   · nothing at +/-PI/2, so there is no mirrored pair at the sides of the head;
   *   · both strands in the rear quadrant at DIFFERENT heights, lengths and azimuths,
   *     so even seen from behind they are not a pair.
   *
   * ⚠️ **The cost is measured and it is real.** `appendages.ts` requires an event to
   * clear the core by more than the opening radius, and the two strands that did that
   * best at the shipped spawn facing (yaw 90, exact profile) were the two at +/-PI/2,
   * because azimuths PERPENDICULAR to the view are the ones that project to screen-X.
   * Rear strands project to screen-X at yaw 90 as well — that is why they are kept
   * rather than deleted — but this pass trades appendage COUNT for the read, on the
   * grounds that `appendages.ts` already recorded the count buying **zero** critic
   * points (cast hull deficiency 0.1379 -> 0.2621, panels 3/3 and 2/2, unchanged),
   * while the ear read cost this character a *"TERRIBLE"* from the owner.
   */
  private buildSilhouetteEvents(R: number): void {
    const head = this.rig.joints.head;
    const box = localBounds(head);
    const cheeseMat = toonMat({ color: CHEESE, roughness: 0.4 });

    // [azimuth, height01, length scale]. 0 is +Z, the direction the character faces
    // (`appendages.ts`), so both of these are behind the slab.
    const spec: Array<[number, number, number]> = [
      [Math.PI * 0.93, 0.58, 0.85],
      [Math.PI * 0.74, 0.40, 0.62],
    ];
    for (const [azimuth, height01, k] of spec) {
      const { at, out } = massAnchor(head, box, { azimuth, height01, inset: 0.14 });
      // ⚠️ ROUND 1 REACHED OUT 0.78R AND CAME BACK IN TO 0.74R, AND IT READ AS A
      // HANDLE. See `shots/ch/pizza/after/lobby_side.png`: a near-constant-thickness
      // tube that arcs out, over and down, with both ends against the mass, is a mug
      // handle — which is the same failure class as the ear, one shape further on.
      // Cheese does not arc; it SAGS. Reach halved, drop raised past the reach, and
      // the taper steepened to 3:1 so the strand thins as it falls.
      //
      // ⚠️ AND THE REACH IS MONOTONIC, which is the actual mechanism. Round 2 shortened
      // the strand and it STILL read as a handle in profile, because the reach went
      // 0.34 -> 0.50 -> 0.44: the tip curved back toward the mass, and a tube whose two
      // ends both approach the body IS a handle whatever its length. A hanging strand's
      // outline can only move away. 0.34 -> 0.46 -> 0.54.
      const pts = [
        at.clone(),
        at.clone().addScaledVector(out, R * 0.34 * k).add(new THREE.Vector3(0, -R * 0.24 * k, 0)),
        at.clone().addScaledVector(out, R * 0.46 * k).add(new THREE.Vector3(0, -R * 0.62 * k, 0)),
        at.clone().addScaledVector(out, R * 0.54 * k).add(new THREE.Vector3(0, -R * 1.00 * k, 0)),
      ];
      // Fatter at the root and BLUNTER at the tip than the old strands (0.085 -> 0.030
      // became 0.105 -> 0.035, and a bead caps it). A tapered point is the shape that
      // reads as a horn; a molten strand ends in a bead.
      const str = curl(cheeseMat, pts, { rBase: R * 0.105, rTip: R * 0.035 });
      str.name = 'pizza_cheese_string';
      head.add(str);
      const bead = knob(cheeseMat, R * 0.058 * (0.7 + 0.3 * k));
      bead.name = 'pizza_cheese_bead';
      bead.position.copy(pts[3]);
      head.add(bead);
    }
  }

  private buildAccessories(R: number, head: THREE.Group): void {
    // Read off the rig rather than hand-mirrored: body proportions now come from
    // an archetype (`bodies.ts`), so any hardcoded copy of a rig constant goes
    // silently wrong the moment the archetype changes.
    const shoulderWidth = this.rig.metrics.shoulderWidth;
    const torsoH = this.rig.metrics.torsoHeight;

    const leatherMat = toonMat({ color: SATCHEL_LEATHER, roughness: 0.78 });
    const trimMat = toonMat({ color: SATCHEL_TRIM, roughness: 0.72 });
    const buckleMat = toonMat({ color: SATCHEL_BUCKLE, roughness: 0.32, metalness: 0.55 });

    // The dressed dough torso is custom geometry (see `dressTorso` above), and
    // an earlier pass hand-estimated its half-width far too small, burying the
    // whole bag inside the body. Measuring the REAL half-width off the built
    // mesh (root/hips/torso are all still at their identity rest transform
    // here — `restPose()` runs at the very end of the constructor, so a
    // world-space Box3 on `joints.torso` gives an exact local half-extent)
    // fixed that — but adding a flat clearance margin on TOP of it overshot
    // the other way: at waist height this torso is nearly as wide as the
    // shoulders themselves, so the margin pushed the bag out past the whole
    // arm's own reach, and it read as something HELD rather than WORN. The
    // shoulder joint itself (`shoulderWidth`) is already the rig's own
    // "clearly outside the torso" reference every arm uses, so anchoring
    // there — capped against the measured torso only as a safety floor for
    // unusually wide waists — keeps the bag snug against the body's own side
    // instead of floating at arm's length.
    // ── `setFromObject(joints.torso)` MEASURES THE ARMS ────────────────────────
    // `shoulderL` and `shoulderR` are CHILDREN of the torso joint, and `Box3` walks
    // the whole subtree — so `torsoHalfW` was the half-width of the torso PLUS both
    // outstretched arms (0.65m against a real torso of 0.29m). The cap that was
    // added to stop the bag floating at arm's length was therefore computed FROM
    // arm's length, and the bag went straight back out there: measured, this
    // character's torso group reaches x = +0.72m and its right upper arm, forearm
    // and mitt deliver 0.867 / 0.382 / 0.692, with 0.17-0.38 of each covered by an
    // accessory. Excluding the two arm subtrees is the whole fix.
    this.rig.joints.root.updateMatrixWorld(true);
    const torsoBB = new THREE.Box3();
    for (const c of this.rig.joints.torso.children) {
      if (c === this.rig.joints.shoulderL || c === this.rig.joints.shoulderR) continue;
      torsoBB.expandByObject(c);
    }
    const torsoHalfW = torsoBB.isEmpty()
      ? this.rig.metrics.torsoWidth * 0.5
      : Math.max(Math.abs(torsoBB.min.x), Math.abs(torsoBB.max.x));
    // Positive X — the RIGHT side, opposite the oven mitt on `handL` below, so
    // the two accessories don't compete for the same patch of silhouette.
    const bagX = Math.max(shoulderWidth * 0.80, torsoHalfW * 0.92);

    // Satchel bag: hangs on a SHORT strap from the shoulder straight down to
    // the waist on the SAME side — not a long diagonal across the whole chest,
    // which read as a rigid mallet-like rod in an earlier pass — at true waist
    // height (clear of the hip line where the rig's own thighs hang straight
    // down from y=0).
    const bagW = shoulderWidth * 0.40, bagH = shoulderWidth * 0.42, bagD = shoulderWidth * 0.24;
    // Pushed BEHIND the arm in z rather than sharing its plane. A messenger bag
    // rides behind the hip; at z = +0.10 * shoulderWidth this one was coplanar with
    // the arm that hangs past it, so the two could only take turns being visible.
    const bagPt = new THREE.Vector3(bagX, torsoH * 0.22, -shoulderWidth * 0.38);
    const shoulderPt = new THREE.Vector3(bagX * 0.97, torsoH * 0.80, -shoulderWidth * 0.04);
    const strap = strapArc(shoulderPt, bagPt, new THREE.Vector3(shoulderWidth * 0.10, 0, shoulderWidth * 0.22), shoulderWidth * 0.055, leatherMat);
    strap.name = 'pizza_satchel_strap';
    this.rig.joints.torso.add(strap);

    const bag = new THREE.Mesh(roundedBox(bagW, bagH, bagD, bagW * 0.16, 3), leatherMat);
    bag.name = 'pizza_satchel_bag';
    bag.position.copy(bagPt);
    bag.rotation.set(0.06, 0.12, 0.08);
    bag.castShadow = true;
    bag.receiveShadow = true;
    this.rig.joints.torso.add(bag);

    const flap = new THREE.Mesh(roundedBox(bagW * 0.98, bagH * 0.42, bagD * 0.5, bagW * 0.14, 3), trimMat);
    flap.name = 'pizza_satchel_flap';
    flap.position.copy(bagPt).add(new THREE.Vector3(0, bagH * 0.26, bagD * 0.30));
    flap.rotation.set(-0.15, 0.12, 0.08);
    flap.castShadow = true;
    flap.receiveShadow = true;
    this.rig.joints.torso.add(flap);

    const buckle = new THREE.Mesh(new THREE.CylinderGeometry(bagW * 0.12, bagW * 0.12, bagW * 0.06, 12), buckleMat);
    buckle.name = 'pizza_satchel_buckle';
    buckle.rotation.x = Math.PI / 2;
    buckle.position.copy(bagPt).add(new THREE.Vector3(0, bagH * 0.10, bagD * 0.55));
    buckle.castShadow = true;
    this.rig.joints.torso.add(buckle);

    // Oven mitt: a flattened, oversized PADDLE on the LEFT hand — a genuine
    // silhouette/shape change (round fist → flat mitt), not just a recolour of
    // the existing pepperoni-red fist, which an earlier pass tried and found
    // unreadable at thumbnail scale since both were the same red hue. Cream
    // body with bold red trim stripes reads unmistakably as a quilted mitt.
    const handRadius = this.rig.metrics.handRadius;
    const mittMat = toonMat({ color: MITT_CREAM, roughness: 0.8 });
    const stripeMat = toonMat({ color: MITT_RED, roughness: 0.7 });
    const mittGroup = new THREE.Group();
    mittGroup.name = 'pizza_oven_mitt';
    const paddle = new THREE.Mesh(roundedBox(handRadius * 1.85, handRadius * 2.2, handRadius * 1.05, handRadius * 0.5, 4), mittMat);
    paddle.position.y = -handRadius * 0.05;
    paddle.castShadow = true;
    paddle.receiveShadow = true;
    mittGroup.add(paddle);
    for (const dy of [-0.62, 0, 0.62]) {
      const stripe = new THREE.Mesh(roundedBox(handRadius * 1.92, handRadius * 0.30, handRadius * 1.12, handRadius * 0.1, 2), stripeMat);
      stripe.name = 'pizza_mitt_stripe';
      stripe.position.y = -handRadius * 0.05 + dy * handRadius;
      stripe.castShadow = true;
      mittGroup.add(stripe);
    }
    // Thumb notch — the one shape cue that makes a paddle read as a MITT
    // rather than a shield.
    const thumb = new THREE.Mesh(new THREE.CapsuleGeometry(handRadius * 0.34, handRadius * 0.5, 4, 8), mittMat);
    thumb.name = 'pizza_mitt_thumb';
    thumb.rotation.z = 0.9;
    thumb.position.set(-handRadius * 0.95, handRadius * 0.35, handRadius * 0.10);
    thumb.castShadow = true;
    mittGroup.add(thumb);
    this.rig.joints.handL.add(mittGroup);

    // (The flour/char speck row that used to live here is gone — see the constructor,
    // where flour is now placed against the wedge's own solved half-widths.)
  }

  /**
   * Bespoke limbs — an independent art director named the shared snowman-body
   * capsule arms and ball hands as the biggest cast-wide tell. Pizza gets doughy
   * tapered limbs (thick at the shoulder, narrower at the wrist, matching the
   * crust's own matte roughness), a pepperoni-red fist mitt with a crust-rim
   * knuckle badge, and a charred-crust wedge boot with its own sole plate — all
   * built from colours this file already declared.
   *
   * A previous pass also added a contrasting `cuffRing` at every shoulder/elbow/
   * hip break plus another on the boot. Stacked across all five bespoke-limb
   * characters that read as mechanical action-figure collars — a worse version
   * of the exact "ball-jointed skeleton" problem this system exists to solve.
   * Removed; the tapered limb's own thickness change plus the colour break into
   * the mitt/boot already reads as "sleeve ends here" without bolted-on hardware.
   */
  private dressLimbs(): void {
    // Both limb tones are the charred crust now — see LIMB_CHAR. The slice keeps CRUST.
    const doughMat = toonMat({ color: LIMB_MID, roughness: 0.85 });
    const doughDarkMat = toonMat({ color: LIMB_CHAR, roughness: 0.8 });
    const pepMat = glossyMat({ color: PEPPERONI, roughness: 0.18 });
    const charMat = toonMat({ color: CRUST_CHAR, roughness: 0.75 });

    this.rig.dressLimbs((part: LimbPart, size) => {
      switch (part) {
        // The shoulder flare was 1.32x radius on a segment only ~1.9 radii LONG,
        // so the upper arm came out wider than it was tall and read as a flipper
        // rather than as the top of a limb. Flare pulled back to 1.10 so the
        // taper still reads without the segment going square.
        case 'upperArmL':
        case 'upperArmR':
          return taperedLimb(size.len, size.radius * 1.10, size.radius * 0.90, doughMat);
        case 'forearmL':
        case 'forearmR':
          return taperedLimb(size.len, size.radius * 0.90, size.radius * 0.62, doughDarkMat);
        case 'handL':
        case 'handR': {
          const side = part === 'handL' ? 1 : -1;
          const mitt = buildDoughMitt(size.radius, side, pepMat);
          const badge = new THREE.Mesh(
            new THREE.CylinderGeometry(size.radius * 0.22, size.radius * 0.22, size.radius * 0.08, 12),
            doughDarkMat
          );
          badge.name = 'mitt_badge';
          badge.rotation.x = Math.PI / 2;
          badge.position.set(0, size.radius * 0.18, size.radius * 0.98);
          badge.castShadow = true;
          mitt.add(badge);
          return mitt;
        }
        case 'thighL':
        case 'thighR':
          return taperedLimb(size.len, size.radius * 1.14, size.radius * 0.94, doughMat);
        case 'shinL':
        case 'shinR':
          return taperedLimb(size.len, size.radius * 0.94, size.radius * 0.76, doughDarkMat);
        case 'footL':
        case 'footR':
          return buildCrustBoot(size.len, charMat, doughDarkMat);
        default:
          return null;
      }
    });
  }

  /**
   * The rig owns all body motion, so the base class's whole-body squash/lean would
   * fight it. Suppressed here; `onUpdate` drives the rig instead.
   */
  protected applyBaseMotion(): void {}
}
