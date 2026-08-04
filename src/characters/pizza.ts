/**
 * Pizza (Neon).
 *
 * Built on the shared ChibiRig — see `donut.ts` for the reference implementation of
 * this pattern. The rig supplies torso, arms, hands, legs, feet and all motion; this
 * file authors only the food mass on `rig.joints.head`, the face on `rig.joints.face`
 * and a palette.
 *
 * Identity is fixed by `rules.ts`: Pizza, Neon rarity, Dough Balls / Tomato Splat /
 * Cheese Blind. The written description ("triangular slice, pepperoni, crust base,
 * closed smiling eyes") is a personality guide, not a literal spec — but the triangle
 * is explicitly the silhouette landmark here, so unlike other characters it is
 * protected rather than freely reinterpreted.
 */

import * as THREE from 'three';
import { BaseCharacter, type AnimContext } from './types';
import type { CharacterDef } from '../game/rules';
import { PALETTE } from '../game/rules';
import { toonMat, glossyMat, flatMat, outlineGroup, roundedBox } from '../render/toon';
import { ChibiRig, type LimbPart } from './rig';
import { bodyType } from './bodies';
import { CHARACTER_HEIGHT } from '../units';

const CRUST = '#EFB868';       // baked dough slab
const CRUST_RIM = '#CE8A2E';   // puffier crust roll along the base — noticeably deeper/toastier
const SAUCE = PALETTE.tomato;  // '#E63946' — thin margin peeking past the cheese
const CHEESE = '#FFDE73';      // melted top layer — pushed brighter than the dough so it pops
const PEPPERONI = '#B93A28';   // wet cured meat, redder than the crust rim
// Feet deliberately break from the crust family altogether — a charred-crust-bottom
// brown, dark enough to be a real value drop against the pale CRUST limbs rather than
// a slightly-darker shade of the same tan.
const CRUST_CHAR = '#4A2A12';

// ── Costume layer ────────────────────────────────────────────────────────────
// A fresh independent art director named the missing costume/accessory layer as
// the TOP gap in the whole cast: without one, characters read as "naked mascot
// body with a themed head glued on" no matter how good the body sculpt is. A
// worn leather delivery satchel slung across the torso is Pizza's silhouette-
// breaking item — it projects past the body outline the way a cape or backpack
// does on the reference roster — plus a quilted oven mitt overlaid on one hand
// as a smaller detail prop that still reads as this character's own trade.
const SATCHEL_LEATHER = '#7A4A24';
const SATCHEL_TRIM = '#54301A';
const SATCHEL_BUCKLE = '#D9B458';
const MITT_RED = '#C23B2E';
const MITT_CREAM = '#F7EFE0';
const FLOUR_DUST = '#F7ECD3';

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
        limb: CRUST,
        // Cheese hands sat too close in hue to the crust limb — both warm
        // gold, differing mostly in value. Pepperoni-red mitts (the same
        // colour already used for the topping) give hands a genuine hue
        // break, not just a lighter shade of the same colour.
        hand: PEPPERONI,
        foot: CRUST_CHAR,
        torso: CRUST,
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
        stanceWidth: CHARACTER_HEIGHT * 0.09,    // narrow stance — the wedge tapers to a point
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
        shoulderL: 0.22, shoulderR: 0.10,
        // -0.64 -> -0.46 on the right: at -0.64 the right forearm tucked behind the
        // wedge and delivered exactly 0.500 of its footprint, sitting on the
        // acceptance floor with no margin, and dropping to 0.206 at run.
        elbowL: -0.28, elbowR: -0.46,
        twist: 0.16, headTilt: -0.09, headTurn: 0.20,
        hipSway: -0.045, lean: 0.04,
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
    const rimBand = R * 0.13;
    const rimShape = new THREE.Shape();
    rimShape.moveTo(-halfW, baseY + R * 0.10);
    rimShape.quadraticCurveTo(0, baseY - R * 0.30, halfW, baseY + R * 0.10);
    rimShape.lineTo(halfW, baseY + R * 0.10 + rimBand);
    rimShape.quadraticCurveTo(0, baseY - R * 0.30 + rimBand, -halfW, baseY + R * 0.10 + rimBand);
    rimShape.lineTo(-halfW, baseY + R * 0.10);
    const rimDepth = depth + R * 0.1;
    const rim = new THREE.Mesh(
      new THREE.ExtrudeGeometry(rimShape, { depth: rimDepth, bevelEnabled: true, bevelThickness: R * 0.03, bevelSize: R * 0.03, bevelSegments: 2, curveSegments: 16 }),
      toonMat({ color: CRUST_RIM, roughness: 0.83 })
    );
    rim.name = 'pizza_crust_rim';
    rim.position.z = -rimDepth / 2 + R * 0.08; // proud of the dough's own front face
    rim.castShadow = true;
    rim.receiveShadow = true;
    head.add(rim);

    // Sauce margin: a slightly larger, thin triangle sitting just behind the cheese
    // so a sliver of red shows at the border — the detail that reads as "sauce under
    // cheese" instead of "solid yellow triangle".
    const sauceShape = new THREE.Shape();
    const sTip = tipY - R * 0.14, sBase = baseY + R * 0.22, sHalfW = halfW * 0.74;
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
    const cheeseShape = new THREE.Shape();
    const cTip = tipY - R * 0.24, cBase = baseY + R * 0.34, cHalfW = halfW * 0.60;
    cheeseShape.moveTo(0, cTip);
    cheeseShape.lineTo(cHalfW, cBase + R * 0.05);
    cheeseShape.quadraticCurveTo(0, cBase - R * 0.12, -cHalfW, cBase + R * 0.05);
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
    const pepGeo = new THREE.CylinderGeometry(R * 0.078, R * 0.088, R * 0.045, 16);
    const pepMat = glossyMat({ color: PEPPERONI, roughness: 0.18 });
    const pepSpots: [number, number][] = [
      [R * 0.13, R * 0.38],
      [-R * 0.13, R * 0.38],
      [R * 0.38, -R * 0.39],
      [-R * 0.38, -R * 0.39],
    ];
    for (const [px, py] of pepSpots) {
      const pep = new THREE.Mesh(pepGeo, pepMat);
      pep.rotation.x = Math.PI / 2;
      pep.position.set(px, py, cheeseFrontZ + R * 0.02);
      pep.castShadow = true;
      pep.receiveShadow = true;
      head.add(pep);
      this.pepperoni.push(pep);
      // A faint grease glisten on top of each — the specular pop that sells "wet".
      const glistenMat = flatMat('#ffffff', { transparent: true, opacity: 0.5 });
      glistenMat.depthWrite = false; // transparent + depthWrite is a silent occluder — §1
      const glisten = new THREE.Mesh(new THREE.SphereGeometry(R * 0.016, 8, 6), glistenMat);
      glisten.position.set(px - R * 0.02, py + R * 0.02, cheeseFrontZ + R * 0.04);
      glisten.userData.noOutline = true;
      head.add(glisten);
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
        toonMat({ color: CRUST_RIM, roughness: 0.85 })
      );
      doughBody.name = 'pizza_torso_crust';
      doughBody.position.y = (bodyTopY + bodyBottomY) / 2;
      doughBody.castShadow = true;
      doughBody.receiveShadow = true;
      group.add(doughBody);

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

    outlineGroup(this.root);
    this.collectFlashTargets();
    this.rig.restPose();
  }

  /**
   * Closed, happy eyes (upward arcs) and a warm smile, sitting on the cheese in the
   * lower-centre of the slice, clear of the crust and every pepperoni disc.
   */
  private buildFace(R: number, cheeseFrontZ: number): void {
    const face = this.rig.joints.face;
    // `face` is already pushed forward by the rig; pull local features back onto the
    // pizza's actual front (cheese) surface rather than the generic sphere assumption.
    const localZ = cheeseFrontZ - this.rig.headRadius * 0.82;
    const ink = PALETTE.ink;

    for (const sx of [-1, 1]) {
      // Closed eye: a thick upward-curved arc (happy ^_^ shape), built as real
      // geometry with depth per the face convention, not a flat decal.
      const eye = new THREE.Mesh(
        new THREE.TorusGeometry(R * 0.10, R * 0.028, 8, 16, Math.PI * 0.92),
        toonMat({ color: ink, roughness: 0.3 })
      );
      eye.position.set(sx * R * 0.26, -R * 0.05, localZ + R * 0.02);
      eye.rotation.z = sx > 0 ? Math.PI * 0.92 : Math.PI * 0.08;
      eye.castShadow = true;
      face.add(eye);
    }

    // Smile: a broad downward arc, wide and warm.
    const smile = new THREE.Mesh(
      new THREE.TorusGeometry(R * 0.20, R * 0.032, 8, 20, Math.PI * 0.8),
      toonMat({ color: ink, roughness: 0.3 })
    );
    smile.position.set(0, -R * 0.28, localZ);
    smile.rotation.z = Math.PI * 1.1;
    smile.castShadow = true;
    face.add(smile);

    // Rosy cheeks — small, warm, cheap charm that reads well at chibi scale.
    // Hoisted and given `depthWrite: false` — a transparent material that still
    // writes depth is a silent occluder (`docs/LESSONS.md` §1), and every
    // transparent material in the cast carried the default `true`.
    const blushMat = flatMat('#FF9EC4', { transparent: true, opacity: 0.55 });
    blushMat.depthWrite = false;
    for (const sx of [-1, 1]) {
      const cheekBlush = new THREE.Mesh(
        new THREE.SphereGeometry(R * 0.06, 10, 8),
        blushMat
      );
      cheekBlush.position.set(sx * R * 0.42, -R * 0.18, localZ - R * 0.01);
      cheekBlush.scale.set(1, 0.7, 0.3);
      cheekBlush.userData.noOutline = true;
      face.add(cheekBlush);
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

    // Flour-dust + toasted-char speckling along the crust rim's own base curve —
    // small surface detail so the crust reads as baked dough rather than one
    // flat matte colour. Sampled off the exact quadratic curve `pizza_dough`'s
    // own base uses, so specks sit precisely on the rim, never floating or
    // sunk into the dough.
    const tipY = R * 0.98, baseY = -R * 0.86, halfWedge = R * 0.80, depth = R * 0.62;
    const rimDepth = depth + R * 0.1;
    const rimFrontZ = rimDepth / 2 + R * 0.13 + R * 0.008;
    const p0 = new THREE.Vector2(-halfWedge, baseY + R * 0.10);
    const p1 = new THREE.Vector2(0, baseY - R * 0.30);
    const p2 = new THREE.Vector2(halfWedge, baseY + R * 0.10);
    const quadPt = (t: number): THREE.Vector2 => {
      const a = (1 - t) * (1 - t), b = 2 * (1 - t) * t, c = t * t;
      return new THREE.Vector2(a * p0.x + b * p1.x + c * p2.x, a * p0.y + b * p1.y + c * p2.y);
    };
    const flourMat = toonMat({ color: FLOUR_DUST, roughness: 0.92 });
    const charMat = toonMat({ color: CRUST_CHAR, roughness: 0.8 });
    const speckTs = [0.12, 0.22, 0.34, 0.46, 0.58, 0.70, 0.82, 0.90];
    for (let i = 0; i < speckTs.length; i++) {
      const p = quadPt(speckTs[i]);
      const isChar = i % 3 === 1;
      const speck = new THREE.Mesh(new THREE.SphereGeometry(R * (isChar ? 0.026 : 0.020), 6, 6), isChar ? charMat : flourMat);
      speck.name = isChar ? 'pizza_char_speck' : 'pizza_flour_speck';
      speck.position.set(p.x, p.y + R * 0.035, rimFrontZ);
      speck.scale.set(1, 0.6, 0.5);
      speck.userData.noOutline = true;
      head.add(speck);
    }
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
    const doughMat = toonMat({ color: CRUST, roughness: 0.85 });
    const doughDarkMat = toonMat({ color: CRUST_RIM, roughness: 0.8 });
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
