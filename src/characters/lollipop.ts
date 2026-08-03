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

// ── Palette ──────────────────────────────────────────────────────────────────
const CANDY_WHITE = '#FFFDF9';
const CANDY_RED = '#E63946';
const STICK = '#FBF7EE';       // matte paper stick
const CYBER = RARITY_COLORS.Cyber; // '#00E5B0' — restrained trim accent only
const BOOT = '#2A2140';        // dark, near-ink boots — grounds the pale/red palette
// Limb-only frosted-teal family, a tint of Lollipop's own Cyber accent. A second
// independent art-director pass named Lollipop, Egg and Burrito as all converging
// on pale cream/white limbs with dark boots — the disc/stick stay their candy-white
// (that's the "hard sugar candy" read), but arms and legs shift to a cool teal so
// the body carries real hue instead of reading as another pale mass, and it ties
// directly to her own rarity accent rather than borrowing a hue from elsewhere.
const LIMB_TEAL = '#8FE0C9';
const LIMB_TEAL_DARK = '#57B296';

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

export class LollipopCharacter extends BaseCharacter {
  private rig: ChibiRig;

  constructor(def: CharacterDef) {
    super(def);

    this.rig = new ChibiRig({
      palette: {
        limb: LIMB_TEAL,
        hand: CANDY_RED,
        foot: BOOT,
        torso: STICK,
        limbRoughness: 0.75,
      },
      // Tall and gangly, very thin limbs, big head-to-body ratio. `headFraction` is
      // the highest in the cast (a bobblehead-on-a-stick read: the candy disc IS
      // most of her), paired with a taller-than-norm `height` for the gangly body
      // underneath and the thinnest radii/stance in the cast.
      proportions: {
        height: 2.00,
        headFraction: 0.49,
        armRadius: 0.072,
        handRadius: 0.100,
        legRadius: 0.080,
        shoulderWidth: 0.290,
        stanceWidth: 0.124,
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
    const stickR = R * 0.19;
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
    const ribbonMat = glossyMat({ color: CANDY_RED, roughness: 0.12, emissive: CANDY_RED, emissiveIntensity: 0.12 });
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
    const petalGeo = new THREE.ConeGeometry(stickR * 1.3, R * 0.18, 3, 1, true);
    const petalMatA = toonMat({ color: CANDY_RED, roughness: 0.68 });
    const petalMatB = toonMat({ color: CANDY_WHITE, roughness: 0.68 });
    for (let i = 0; i < 6; i++) {
      const a = (i / 6) * Math.PI * 2;
      const petal = new THREE.Mesh(petalGeo, i % 2 === 0 ? petalMatA : petalMatB);
      petal.name = 'lollipop_wrapper_petal';
      petal.position.set(Math.cos(a) * stickR * 0.85, stickBottomY + R * 0.14, Math.sin(a) * stickR * 0.85);
      petal.rotation.set(0.4, a, 0);
      petal.castShadow = true;
      petal.receiveShadow = true;
      head.add(petal);
    }

    // ── Face: eyes on the stick, mouth on the candy ───────────────────────────
    this.rig.joints.face.position.set(0, 0, 0);
    this.buildFace(R, stickR, discCenterY, discOuterR, discBottomY, ribbonFrontZ, stickBottomY);

    // ── Torso: candy-wrapper costume, contrasting the pale limbs ──────────────
    this.dressTorso(R);

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
          boot.position.set(0, -size.len * 0.42, size.radius * 0.55);
          boot.name = `${part}_mesh`;
          boot.castShadow = true;
          boot.receiveShadow = true;
          return boot;
        }
        default:
          return null;
      }
    });

    outlineGroup(this.root);
    this.collectFlashTargets();
    this.rig.restPose();
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
      const ex = sx * stickR * 0.68;
      const ez = Math.sqrt(Math.max(0, stickR * stickR - ex * ex)) * 0.96;

      if (winking) {
        // A thin closed-lid arc instead of an open eyeball — flattened almost to a
        // line, with a slight upward curve so it reads as shut-and-smiling rather
        // than a flat dash.
        const lid = new THREE.Mesh(new THREE.SphereGeometry(stickR * 0.5, 14, 12), eyeMat);
        lid.position.set(ex, stickFaceY - stickR * 0.06, ez);
        lid.scale.set(1, 0.16, 0.55);
        lid.castShadow = true;
        face.add(lid);
      } else {
        const eye = new THREE.Mesh(new THREE.SphereGeometry(stickR * 0.5, 14, 12), eyeMat);
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

    for (const sx of [-1, 1]) {
      const blush = new THREE.Mesh(
        new THREE.SphereGeometry(R * 0.07, 10, 8),
        flatMat('#FF9EC4', { transparent: true, opacity: 0.5 })
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
    const torsoMesh = this.rig.torsoMesh!;
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
