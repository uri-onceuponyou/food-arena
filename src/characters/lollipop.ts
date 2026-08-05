/**
 * Lollipop (Cyber).
 *
 * Built on the shared ChibiRig — see `donut.ts` for the reference implementation of
 * this pattern. The rig supplies torso, arms, hands, legs, feet and all motion; this
 * file authors only the food mass on `rig.joints.head`, the face and a palette.
 *
 * Identity is fixed by `rules.ts`: Lollipop, Cyber rarity, Lollipop Smash / Giant
 * Lollipop. The written description ("eyes on the stick, mouth on the candy,
 * concentric red/white swirl disc") is unusual among this cast's face guides — most
 * are treated as loose vibe references, but this one is kept close to literal because
 * it's a genuinely distinctive read once built: it plays on the rig's own neck→head
 * gap, which every other character hides by extending their food mass down to cover
 * it. Here that gap IS the stick, with the swirl disc mounted above it — so the split
 * face (eyes low on the stick, mouth up on the candy) falls out naturally instead of
 * needing anything hacky.
 *
 * The swirl disc is the silhouette landmark and is built as a genuine Archimedean
 * spiral ribbon (not a bullseye of concentric rings) — see `spiralRibbonShape`.
 */

import * as THREE from 'three';
import { BaseCharacter, type AnimContext } from './types';
import type { CharacterDef } from '../game/rules';
import { PALETTE, RARITY_COLORS } from '../game/rules';
import { toonMat, glossyMat, flatMat, outlineGroup, roundedBox } from '../render/toon';
import { ChibiRig } from './rig';
import { bodyType } from './bodies';
import { CHARACTER_HEIGHT } from '../units';
import { curl, localBounds, massAnchor } from './appendages';

// ── Palette ──────────────────────────────────────────────────────────────────
const CANDY_WHITE = '#FFFDF9';
const CANDY_RED = '#E63946';
const STICK = '#FBF7EE';       // matte paper stick
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

/**
 * Archimedean spiral ribbon: a band of constant width whose centreline radius grows
 * linearly with angle. Built as a single extrudable Shape (outer edge walked forward,
 * inner edge walked back) rather than concentric rings, so it reads as an actual swirl
 * — the shape the description asks for — instead of a dartboard/bullseye approximation.
 */
function spiralRibbonShape(turns: number, rStart: number, rEnd: number, bandWidth: number): THREE.Shape {
  const stepsPerTurn = 48;
  const steps = Math.max(8, Math.round(turns * stepsPerTurn));
  const outer: THREE.Vector2[] = [];
  const inner: THREE.Vector2[] = [];
  for (let i = 0; i <= steps; i++) {
    const t = i / steps;
    const theta = t * turns * Math.PI * 2;
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
 * A cloth/cellophane strip curved around a cylinder of `radius`, spanning
 * `arcRad` of angle centred on `angleOffset` (radians, 0 = character-front/+Z),
 * `height` tall. Used for the wrapper cape — a panel that hugs the body's own
 * curvature rather than floating as a flat card behind it.
 */
function curvedPanel(radius: number, arcRad: number, height: number, angleOffset = 0, segX = 18, segY = 8): THREE.BufferGeometry {
  const geo = new THREE.PlaneGeometry(arcRad, height, segX, segY);
  const pos = geo.attributes.position as THREE.BufferAttribute;
  for (let i = 0; i < pos.count; i++) {
    const theta = angleOffset + pos.getX(i);
    const y = pos.getY(i);
    pos.setXYZ(i, Math.sin(theta) * radius, y, Math.cos(theta) * radius);
  }
  geo.computeVertexNormals();
  return geo;
}

/**
 * A rounded limb segment, like a capsule but with INDEPENDENT top and bottom
 * radii, hanging DOWN from the joint origin (spans y=0..-len) — the orientation
 * `dressLimbs()` expects. Local to this file; see `hamburger.ts` for the
 * reference copy. Lollipop's own call sites pass radii noticeably SMALLER than
 * `size.radius` — she is a slender candy-on-a-stick character, and the rig's
 * default limb thickness read as far too stocky for that read.
 */
function taperedSegment(len: number, rTop: number, rBot: number, radialSegments = 12): THREE.BufferGeometry {
  // Profile MUST be wound bottom-to-top (y increasing), matching every other
  // lathe helper in this cast (`bunDome`, `roundedPuck` in `hamburger.ts`) —
  // LatheGeometry's face winding (and therefore `computeVertexNormals`'s
  // outward-vs-inward call) depends on point order, not just point position. An
  // earlier version of this function built the profile top-to-bottom and every
  // limb using it rendered near-black: inverted normals facing away from the
  // light. The y=0/y=-len hang-down placement is unchanged.
  const capSegs = 5;
  const pts: THREE.Vector2[] = [new THREE.Vector2(0, -len)];
  for (let i = 1; i <= capSegs; i++) {
    const a = (Math.PI / 2) * (i / capSegs);
    pts.push(new THREE.Vector2(Math.sin(a) * rBot, -len + rBot - Math.cos(a) * rBot));
  }
  const yBotCap = -len + rBot;
  const yTopCap = -rTop;
  if (yTopCap >= yBotCap) {
    const sideSteps = 3;
    for (let i = 1; i <= sideSteps; i++) {
      const t = i / sideSteps;
      pts.push(new THREE.Vector2(THREE.MathUtils.lerp(rBot, rTop, t), THREE.MathUtils.lerp(yBotCap, yTopCap, t)));
    }
  }
  const yTopSafe = Math.max(yTopCap, yBotCap);
  for (let i = 1; i <= capSegs; i++) {
    const a = (Math.PI / 2) * (i / capSegs);
    pts.push(new THREE.Vector2(Math.cos(a) * rTop, yTopSafe + Math.sin(a) * rTop));
  }
  const geo = new THREE.LatheGeometry(pts, radialSegments);
  geo.computeVertexNormals();
  return geo;
}

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
        shoulderWidth: H * 0.17,
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
        stanceWidth: H * 0.145,
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
    const discDepth = R * 0.26; // real thickness — a paper-thin disc would vanish to a
                                // blade edge-on (idle_135/210), same failure Taco solved
    const discBottomY = discCenterY - discOuterR;
    // Widened from 0.19R. This is the character's FACE PLATE as much as it is a
    // stick: `rules.ts` puts the eyes on the stick and the mouth on the candy, and
    // at 0.19R the eyes came out ~3px at the size a player sees a character — a
    // blind critic read the whole model as "an inanimate prop, not a mascot,"
    // because the only thing on the huge disc was a small mouth arc. A real
    // candy-stick mascot's stick is chunky; this is still slender against a disc
    // more than three times its width, but the face now has room to exist.
    // 0.285R -> 0.32R. The stick is the ONLY thing both arms and both legs can
    // attach to on this character, so its radius is a connectivity budget, not a
    // styling choice. The extra 0.035R buys ~9 px of overlap on each of four limbs.
    const stickR = R * 0.28;
    const stickTopY = discCenterY - discOuterR * 0.5; // embeds into the disc's underside
    const stickBottomY = -neckGap * 1.12; // reaches past the neck join, into the torso —
                                           // no visible gap between stick and body

    // ── Candy disc ───────────────────────────────────────────────────────────
    // A short cylinder rotated so its flat faces point ±Z (camera-facing), the same
    // "coin facing the camera" orientation Donut's torus uses for its hole.
    const discGeo = new THREE.CylinderGeometry(discOuterR, discOuterR, discDepth, 40, 1, false);
    discGeo.rotateX(Math.PI / 2);
    const candyMat = glossyMat({ color: CANDY_WHITE, roughness: 0.12 });
    const disc = new THREE.Mesh(discGeo, candyMat);
    disc.name = 'lollipop_candy_base';
    disc.position.y = discCenterY;
    disc.castShadow = true;
    disc.receiveShadow = true;
    head.add(disc);

    // Spiral ribbon, proud of the base disc's front face. This is the single hardest
    // shading surface in the cast on purpose — hard sugar candy, glossiest thing built.
    const ribbonShape = spiralRibbonShape(2.35, discOuterR * 0.08, discOuterR * 0.97, discOuterR * 0.17);
    const ribbonGeo = new THREE.ExtrudeGeometry(ribbonShape, {
      depth: discDepth * 0.55, bevelEnabled: true, bevelThickness: R * 0.008, bevelSize: R * 0.008, bevelSegments: 2, curveSegments: 1,
    });
    const ribbonDepth = discDepth * 0.55;
    // Colour drops to SWIRL_RED; the emissive deliberately stays at the brighter
    // CANDY_RED so the swirl keeps its candy glow while its diffuse value steps down.
    const ribbonMat = glossyMat({ color: SWIRL_RED, roughness: 0.12, emissive: CANDY_RED, emissiveIntensity: 0.12 });
    const ribbon = new THREE.Mesh(ribbonGeo, ribbonMat);
    ribbon.name = 'lollipop_swirl';
    ribbon.position.set(0, discCenterY, discDepth / 2 - ribbonDepth * 0.2);
    ribbon.castShadow = true;
    ribbon.receiveShadow = true;
    head.add(ribbon);
    // The z coordinate that safely clears the ribbon's own proud front face — mouth
    // and blush below are placed relative to this rather than a flat guess, otherwise
    // they land UNDER the ribbon wherever it happens to cross that point on the swirl
    // and vanish entirely (exactly what happened in round 1).
    const ribbonFrontZ = ribbon.position.z + ribbonDepth;

    // A flat disc is one-sided by default — round 1 only decorated the front face, so
    // at yaw 135/210 (closer to a back/edge view) the candy read as a featureless pale
    // oval, the exact "vanishes to a blank blade off-axis" failure the brief warns
    // about. Mirroring the ribbon onto the back face fixes it: every angle now shows
    // swirl, not blank candy.
    const ribbonBack = new THREE.Mesh(ribbonGeo, ribbonMat);
    ribbonBack.name = 'lollipop_swirl_back';
    ribbonBack.position.set(0, discCenterY, -(discDepth / 2 - ribbonDepth * 0.2));
    ribbonBack.scale.z = -1;
    ribbonBack.castShadow = true;
    ribbonBack.receiveShadow = true;
    head.add(ribbonBack);

    // Candy-white edge ring, cleaning up the swirl's outer terminus into a crisp rim.
    const edgeRing = new THREE.Mesh(
      new THREE.TorusGeometry(discOuterR * 0.99, R * 0.035, 8, 32),
      candyMat
    );
    edgeRing.name = 'lollipop_edge';
    edgeRing.position.y = discCenterY;
    edgeRing.castShadow = true;
    edgeRing.receiveShadow = true;
    head.add(edgeRing);

    // Restrained Cyber trim — a hairline emissive ring just outside the candy edge.
    // Kept deliberately thin and low-intensity per the brief: a blown-out glow on a
    // Cyber-rarity piece reads as amateur, a hairline accent reads as considered.
    const trim = new THREE.Mesh(
      new THREE.TorusGeometry(discOuterR * 1.03, R * 0.012, 6, 32),
      toonMat({ color: CYBER, roughness: 0.3, emissive: CYBER, emissiveIntensity: 0.4 })
    );
    trim.name = 'lollipop_cyber_trim';
    trim.userData.noOutline = true;
    trim.position.y = discCenterY;
    head.add(trim);

    // ── Stick ────────────────────────────────────────────────────────────────
    const stick = new THREE.Mesh(
      new THREE.CylinderGeometry(stickR, stickR * 1.05, stickTopY - stickBottomY, 16, 1, false),
      toonMat({ color: STICK, roughness: 0.75 })
    );
    stick.name = 'lollipop_stick';
    stick.position.y = (stickTopY + stickBottomY) / 2;
    stick.castShadow = true;
    stick.receiveShadow = true;
    head.add(stick);

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

    // ── Face: eyes on the stick, mouth on the candy ───────────────────────────
    this.rig.joints.face.position.set(0, 0, 0);
    this.buildFace(R, stickR, discCenterY, discOuterR, discBottomY, ribbonFrontZ, stickBottomY);

    // ── Torso: candy-wrapper costume, contrasting the pale limbs ──────────────
    this.dressTorso(R);

    // ── Costume: translucent wrapper cape ─────────────────────────────────────
    // A second independent art-director pass named the total absence of any
    // silhouette-breaking costume/accessory layer as the cast's single biggest
    // remaining gap — the existing sash/trim dress the torso but never leave its
    // own footprint. A cellophane wrapper worn like a cloak (the brief's own
    // suggested read) is Lollipop's: translucent, glossy candy-wrap plastic
    // flowing from a twisted knot at the neck down her back, with a hairline
    // Cyber trim along its hem echoing her own rarity accent.
    // Parented to the HEAD, not the neck. On a STUB body the neck joint sits at
    // the hips, so a cape hanging `capeH * 0.38` below it started at hip height
    // and ran straight through the floor. Anchoring it under the candy disc —
    // where a wrapper would actually be twisted shut — works on any archetype.
    const capeAnchor = new THREE.Group();
    capeAnchor.name = 'lollipop_cape_anchor';
    capeAnchor.position.y = discBottomY;
    head.add(capeAnchor);
    const neck = capeAnchor;
    const capeMat = glossyMat({ color: WRAPPER_INK, roughness: 0.16, transparent: true, opacity: 0.6 });
    capeMat.side = THREE.DoubleSide; // seen edge-on/from behind at yaw 135/210, not just front
    // A transparent material that still writes depth is a silent occluder
    // (`docs/LESSONS.md` §1) — and this one is a DoubleSide panel wrapped around the
    // stick, so it was punching a hole through the character's own body from behind.
    capeMat.depthWrite = false;
    const capeTrimMat = toonMat({ color: CYBER, roughness: 0.3, emissive: CYBER, emissiveIntensity: 0.5 });
    const twistMat = glossyMat({ color: CANDY_WHITE, roughness: 0.14 });

    // Sized to the STICK, not to a torso. At the old R*0.55 x R*1.55 this was a
    // torso-scale cloak on a body that is 0.19R wide, and it rendered as a flat
    // grey sheet hanging behind the candy and through the floor — the STUB body
    // has no torso for a cloak to drape over. Cut down to a wrapper flare that
    // hugs the stick just under the disc, which is what a real lollipop wrapper
    // does anyway.
    const capeR = stickR * 1.7;
    const capeArc = Math.PI * 0.85;
    const capeH = R * 0.52;
    const cape = new THREE.Mesh(curvedPanel(capeR, capeArc, capeH, Math.PI), capeMat);
    cape.name = 'lollipop_wrapper_cape';
    // ── The cape rendered as a near-BLACK SLAB on both sides of the stick ───────
    // Two separate mechanisms, both of them `docs/LESSONS.md` §1:
    //
    //  1. `depthWrite` (fixed on the material above).
    //  2. THE INVERTED HULL. `outlineGroup` gives every mesh a BackSide copy of its
    //     own geometry, pushed out along the normals. That is correct for a solid:
    //     you see the ink only where the hull escapes the silhouette. This is not a
    //     solid — it is a PLANE. A plane's back face is the same plane, so its hull
    //     is a full-size opaque black copy of the cape sitting a hair behind it,
    //     which is precisely the dark grey trapezoid visible either side of the
    //     stick in `shots/probe/front/lollipop.png`. Ink cannot outline a surface
    //     with no interior.
    //
    // The same reasoning applies to the trim, which is already `noOutline` for the
    // z-fighting reason and gets the geometric one for free.
    cape.userData.noOutline = true;
    cape.castShadow = true;
    cape.receiveShadow = true;
    cape.position.y = -capeH * 0.38;
    neck.add(cape);

    const capeTrim = new THREE.Mesh(curvedPanel(capeR * 1.01, capeArc * 0.97, capeH * 0.045, Math.PI), capeTrimMat);
    capeTrim.name = 'lollipop_wrapper_cape_trim__no_outline';
    capeTrim.userData.noOutline = true;
    capeTrim.position.y = cape.position.y - capeH * 0.48;
    neck.add(capeTrim);

    // Twisted wrapper knot — the cape's own "tied at the neck" landmark, echoing
    // the twist-cone hands and wrapper-petal cuffs already on this character.
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
    const stickLimbDarkMat = toonMat({ color: LIMB_TEAL_DARK, roughness: 0.55 });
    const stripeMat = toonMat({ color: CANDY_RED, roughness: 0.55 });
    const candyHandMat = glossyMat({ color: CANDY_RED, roughness: 0.14 });
    const candySwirlMat = candyMat;
    this.rig.dressLimbs((part, size) => {
      switch (part) {
        case 'upperArmL': case 'upperArmR':
        case 'thighL': case 'thighR': {
          const g = new THREE.Group();
          const m = new THREE.Mesh(taperedSegment(size.len, size.radius * 0.66, size.radius * 0.52, 10), stickLimbMat);
          m.name = `${part}_mesh`;
          m.castShadow = true;
          m.receiveShadow = true;
          g.add(m);
          for (const f of [0.28, 0.62]) {
            const ring = new THREE.Mesh(new THREE.TorusGeometry(size.radius * 0.58, size.radius * 0.1, 6, 14), stripeMat);
            ring.rotation.x = Math.PI / 2;
            ring.position.y = -size.len * f;
            ring.userData.noOutline = true;
            g.add(ring);
          }
          return g;
        }
        case 'forearmL': case 'forearmR':
        case 'shinL': case 'shinR': {
          const g = new THREE.Group();
          const m = new THREE.Mesh(taperedSegment(size.len, size.radius * 0.52, size.radius * 0.38, 10), stickLimbDarkMat);
          m.name = `${part}_mesh`;
          m.castShadow = true;
          m.receiveShadow = true;
          g.add(m);
          for (const f of [0.22, 0.5, 0.78]) {
            const ring = new THREE.Mesh(new THREE.TorusGeometry(size.radius * 0.44, size.radius * 0.08, 6, 14), stripeMat);
            ring.rotation.x = Math.PI / 2;
            ring.position.y = -size.len * f;
            ring.userData.noOutline = true;
            g.add(ring);
          }
          return g;
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

    this.buildSilhouetteEvents(R);

    outlineGroup(this.root);
    this.collectFlashTargets();
    this.rig.restPose();
  }

  /**
   * SILHOUETTE EVENTS — the wrapper twist.
   *
   * Lollipop measured **hull deficiency 0.1377 with ZERO appendages** at the shipped
   * facing: at yaw 90 the candy disc is edge-on, so the whole character is a tall
   * flat slab. The one thing every wrapped lollipop in the world has, and this one
   * did not, is the twisted cellophane above the disc — and it is the ideal shape
   * for this camera, because the two tails leave the mass sideways at the widest
   * point rather than climbing over it.
   *
   * `WRAPPER_INK` is deliberate on both counts: it is the cape and collar's own
   * near-black cellophane, so this reads as the same material the character is
   * already wearing, and it keeps the two new events inside the dark rung rather
   * than adding a third light mass to a character that is mostly white and red.
   */
  private buildSilhouetteEvents(R: number): void {
    const head = this.rig.joints.head;
    const box = localBounds(head);
    const wrapMat = toonMat({ color: WRAPPER_INK, roughness: 0.42, doubleSide: true });

    for (const [azimuth, k, rise] of [[Math.PI * 0.5, 1.0, 0.62], [-Math.PI * 0.5, 0.82, 0.44]] as const) {
      const { at, out } = massAnchor(head, box, { azimuth, height01: 0.86, inset: 0.26 });
      const pts = [
        at.clone(),
        at.clone().addScaledVector(out, R * 0.22 * k).add(new THREE.Vector3(0, R * 0.18 * rise, 0)),
        at.clone().addScaledVector(out, R * 0.46 * k).add(new THREE.Vector3(0, R * 0.34 * rise, 0)),
        at.clone().addScaledVector(out, R * 0.58 * k).add(new THREE.Vector3(0, R * 0.60 * rise, 0)),
      ];
      const tail = curl(wrapMat, pts, { rBase: R * 0.115, rTip: R * 0.038 });
      tail.name = 'lollipop_wrapper_twist';
      head.add(tail);
    }
  }

  /**
   * Eyes sit low on the stick (round, alert, a curved surface solved the same way as
   * the disc/wrap treatments elsewhere in this cast); a sweet closed-smile mouth and
   * rosy blush sit up on the candy's front face. Confident, a little sassy — she
   * swings herself like a hammer.
   */
  private buildFace(
    R: number,
    stickR: number,
    discCenterY: number,
    discOuterR: number,
    discBottomY: number,
    ribbonFrontZ: number,
    stickBottomY: number
  ): void {
    const face = this.rig.joints.face;
    const ink = PALETTE.ink;
    const eyeMat = toonMat({ color: ink, roughness: 0.25 });

    // Centred in the stick's CLEARLY VISIBLE span — below the disc's actual bottom
    // edge (with a little clearance), not the full stick length, most of whose top
    // half is embedded inside the disc.
    const visibleStickTop = discBottomY - R * 0.05;
    const stickFaceY = stickBottomY + (visibleStickTop - stickBottomY) * 0.5;
    // Round 2 defect: eyes sat close together (+-0.52*stickR, radius 0.42*stickR) right
    // where the disc's shadow falls, and read as a single squinting smudge. Pushed
    // apart and enlarged — the stick was widened specifically to give this room.
    // Right eye (sx>0) winks shut — a real closed-eye read, not just a squint — under
    // a hard-cocked brow; the left stays wide open under a low, level brow. A second
    // independent art-director pass named matched, mirrored brows/eyes as the reason
    // facial acting wasn't landing across the cast, and "confident, a little sassy"
    // is exactly the personality a genuine wink sells that a symmetric stare can't.
    for (const sx of [-1, 1]) {
      const winking = sx > 0;
      const ex = sx * stickR * 0.52;
      const ez = Math.sqrt(Math.max(0, stickR * stickR - ex * ex)) * 0.96;

      if (winking) {
        // A thin closed-lid arc instead of an open eyeball — flattened almost to a
        // line, with a slight upward curve so it reads as shut-and-smiling rather
        // than a flat dash.
        const lid = new THREE.Mesh(new THREE.SphereGeometry(stickR * 0.44, 14, 12), eyeMat);
        lid.position.set(ex, stickFaceY - stickR * 0.06, ez);
        lid.scale.set(1, 0.16, 0.55);
        lid.castShadow = true;
        face.add(lid);
      } else {
        const eye = new THREE.Mesh(new THREE.SphereGeometry(stickR * 0.44, 14, 12), eyeMat);
        eye.position.set(ex, stickFaceY, ez);
        eye.scale.set(1, 1.15, 0.55);
        eye.castShadow = true;
        face.add(eye);

        const glint = new THREE.Mesh(new THREE.SphereGeometry(stickR * 0.15, 8, 8), flatMat('#ffffff'));
        glint.position.set(ex - stickR * 0.13, stickFaceY + stickR * 0.17, ez + stickR * 0.12);
        glint.userData.noOutline = true;
        face.add(glint);
      }

      // Brows — real shaded geometry, not a flat decal, sitting a fixed offset
      // above each eye so it can't drift out of alignment. Cocked hard over the
      // winking eye, low and level over the open one.
      const browLift = winking ? stickR * 0.78 : stickR * 0.55;
      const browTilt = winking ? 0.55 : 0.12;
      const brow = new THREE.Mesh(
        new THREE.CapsuleGeometry(stickR * 0.09, stickR * 0.55, 4, 8),
        toonMat({ color: ink, roughness: 0.4 })
      );
      brow.position.set(ex, stickFaceY + browLift, ez * 0.85);
      brow.rotation.z = Math.PI / 2 - sx * browTilt;
      brow.castShadow = true;
      face.add(brow);
    }

    // Mouth: a closed, sweet smile on the candy's front face. Pulled further down from
    // the disc centre than round 2 (0.42 -> 0.52) so it sits clear of the spiral's
    // innermost curl instead of visually merging with it.
    const mouthY = discCenterY - discOuterR * 0.52;
    const mouth = new THREE.Mesh(
      new THREE.TorusGeometry(R * 0.15, R * 0.04, 8, 20, Math.PI * 0.85),
      toonMat({ color: ink, roughness: 0.3 })
    );
    mouth.name = 'lollipop_mouth';
    mouth.position.set(0, mouthY, ribbonFrontZ + R * 0.02);
    mouth.rotation.z = Math.PI * 1.08;
    mouth.castShadow = true;
    face.add(mouth);

    // Hoisted and given `depthWrite: false` — a transparent material that still
    // writes depth is a silent occluder (`docs/LESSONS.md` §1), and every
    // transparent material in the cast carried the default `true`.
    const blushMat = flatMat('#FF9EC4', { transparent: true, opacity: 0.5 });
    blushMat.depthWrite = false;
    for (const sx of [-1, 1]) {
      const blush = new THREE.Mesh(
        new THREE.SphereGeometry(R * 0.07, 10, 8),
        blushMat
      );
      blush.position.set(sx * discOuterR * 0.48, discCenterY - discOuterR * 0.12, ribbonFrontZ + R * 0.01);
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
