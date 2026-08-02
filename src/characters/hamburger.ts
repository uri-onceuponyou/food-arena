/**
 * Hamburger — Normal rarity, the roster's first-built model and art-direction
 * anchor for the rest of the cast.
 *
 * Read as: a real stacked burger — bottom bun / patty / cheese / tomato /
 * lettuce / top bun — where every named layer owns a visible share of the
 * height, so the silhouette reads as a STACK rather than a big head sitting on
 * a thin belt. Stubby bun-coloured arms and dark little feet peek out in an
 * asymmetric, weight-shifted stance. Closed happy eyes + small smile live on
 * the crown, high enough on its front face to clear the lettuce collar below.
 */

import * as THREE from 'three';
import { BaseCharacter } from './types';
import type { AnimContext } from './types';
import type { CharacterDef } from '../game/rules';
import { PALETTE } from '../game/rules';
import { toonMat, glossyMat, flatMat, outlineGroup, roundedBox, RAMP_CHARACTER, OUTLINE_THIN } from '../render/toon';

// ─────────────────────────────────────────────────────────────────────────────
// Local geometry helpers — chunky rounded discs the shared kit doesn't provide.
// ─────────────────────────────────────────────────────────────────────────────

/** A rounded "hockey puck" — flat top/bottom with a filleted rim. Used for every
 * stacked layer (buns, patty, cheese, tomato, lettuce) so the whole stack reads as
 * one consistent chunky-food language. */
function roundedPuck(radius: number, height: number, edge: number, radialSegments = 24): THREE.BufferGeometry {
  const e = Math.min(edge, height / 2 - 0.001, radius * 0.9);
  const corner = 5;
  const pts: THREE.Vector2[] = [];
  pts.push(new THREE.Vector2(0, 0));
  pts.push(new THREE.Vector2(Math.max(radius - e, 0.001), 0));
  for (let i = 0; i <= corner; i++) {
    const a = (Math.PI / 2) * (i / corner);
    pts.push(new THREE.Vector2(radius - e + Math.sin(a) * e, e - Math.cos(a) * e));
  }
  for (let i = 0; i <= corner; i++) {
    const a = (Math.PI / 2) * (i / corner);
    pts.push(new THREE.Vector2(radius - e + Math.cos(a) * e, height - e + Math.sin(a) * e));
  }
  pts.push(new THREE.Vector2(0, height));
  const geo = new THREE.LatheGeometry(pts, radialSegments);
  geo.computeVertexNormals();
  return geo;
}

/** Bun crown profile as (radius fraction, height fraction) control points —
 * shared by `bunDome` (which revolves it into geometry) and `crownSurface`
 * (which samples the SAME points to place seeds/face decals exactly on the
 * resulting surface). One source of truth is what stops decals from floating
 * off the mesh or clipping through it if this silhouette is ever retuned. */
const CROWN_PROFILE: Array<[r: number, h: number]> = [
  [0, 0], [0.88, 0], [1.0, 0.16], [0.97, 0.42], [0.78, 0.72], [0.4, 0.93], [0, 1],
];

/** The bun crown: a squat dome that bulges out near its base then rounds to an
 * apex — the classic burger-bun silhouette, not just a sphere. */
function bunDome(baseRadius: number, height: number, radialSegments = 28): THREE.BufferGeometry {
  const pts = CROWN_PROFILE.map(([r, h]) => new THREE.Vector2(r * baseRadius, h * height));
  const geo = new THREE.LatheGeometry(pts, radialSegments);
  geo.computeVertexNormals();
  return geo;
}

/** Exact surface point + outward normal on the crown dome at a given azimuth
 * (`theta`, radians, 0 = character-front/+Z, increasing toward +X) and height
 * fraction (0 = crown base, 1 = apex). The normal is derived from the profile's
 * own tangent (dR, dH) → normal ∝ (dH, -dR) in the (radial, vertical) meridian
 * plane, which correctly tilts down-and-out on the lower bulge and up-and-out
 * near the apex — a fixed/guessed normal was the root cause of seeds floating
 * detached above the surface and the blush decal clipping through it. */
function crownSurface(theta: number, hFrac: number): { pos: THREE.Vector3; normal: THREE.Vector3 } {
  const h = THREE.MathUtils.clamp(hFrac, 0, 1);
  let seg = CROWN_PROFILE[0];
  let segNext = CROWN_PROFILE[1];
  for (let i = 0; i < CROWN_PROFILE.length - 1; i++) {
    if (h >= CROWN_PROFILE[i][1] && h <= CROWN_PROFILE[i + 1][1]) {
      seg = CROWN_PROFILE[i];
      segNext = CROWN_PROFILE[i + 1];
      break;
    }
  }
  const [r0, h0] = seg;
  const [r1, h1] = segNext;
  const t = h1 > h0 ? (h - h0) / (h1 - h0) : 0;
  const rFrac = r0 + (r1 - r0) * t;
  const radius = CROWN.baseR * rFrac;
  const y = h * CROWN.h;

  const dR = (r1 - r0) * CROWN.baseR;
  const dH = (h1 - h0) * CROWN.h;
  const n2 = new THREE.Vector2(dH, -dR);
  if (n2.lengthSq() < 1e-8) n2.set(1, 0);
  n2.normalize();

  const nx = Math.sin(theta);
  const nz = Math.cos(theta);
  const pos = new THREE.Vector3(nx * radius, y, nz * radius);
  const normal = new THREE.Vector3(nx * n2.x, n2.y, nz * n2.x).normalize();
  return { pos, normal };
}

/** A group pre-positioned + oriented flush against the crown surface at
 * (theta, hFrac), pushed out along the normal by `embed` so a decal sits just
 * proud of the surface instead of floating above it or clipping through it. */
function addCrownDecal(parent: THREE.Object3D, theta: number, hFrac: number, embed: number): THREE.Group {
  const { pos, normal } = crownSurface(theta, hFrac);
  const g = new THREE.Group();
  g.position.copy(pos).addScaledVector(normal, embed);
  g.quaternion.setFromUnitVectors(new THREE.Vector3(0, 0, 1), normal);
  parent.add(g);
  return g;
}

/** Small flattened arc used for eyes (bulge up) and mouth (bulge down). The torus
 * ring lies in the XY plane by construction, so a 90°/-90° Z rotation aims the
 * bulge up or down without any extra math at the call site. */
function faceArc(curveRadius: number, tube: number, arcRad: number): THREE.BufferGeometry {
  const geo = new THREE.TorusGeometry(curveRadius, tube, 8, 20, arcRad);
  geo.rotateZ(-arcRad / 2); // centre the arc on angle 0 (local +X) before orienting
  geo.computeVertexNormals();
  return geo;
}

// ─────────────────────────────────────────────────────────────────────────────
// Layout constants (metres) — feet at y=0, apex lands close to CHARACTER_HEIGHT.
//
// Each named band owns a real fraction of the total ~2.07 m stack: bottom bun
// 24% / patty 16% / cheese 3% (a thin accent drape, not one of the five named
// bands) / tomato 10% / lettuce 11% / top bun 35%. The previous pass put 55%+
// of the height into the top bun alone, crushing everything else into an
// unreadable belt below it — rebalancing this is the single biggest fix here.
// ─────────────────────────────────────────────────────────────────────────────

const BOTTOM_BUN = { r: 0.6, h: 0.5, edge: 0.17, yTop: 0.5 };
const PATTY = { r: 0.56, h: 0.34, edge: 0.06, yTop: 0.84 };
// Cheese was the round-3 defect: a 0.07m puck read as a thin yellow LINE, not
// a melted slab. Given real thickness (0.16m) and a radius that overhangs
// the patty/tomato beneath it, so it drapes rather than just tints a seam.
const CHEESE = { r: 0.68, h: 0.16, edge: 0.05, yBottom: 0.84, yTop: 1.0 };
const TOMATO = { r: 0.6, h: 0.21, edge: 0.06, yBottom: 1.0, yTop: 1.21 };
// Lettuce is split into a low solid base disc (mostly hidden, structural only)
// and a taller ruffled frill ring near the TOP of the band, so it reads as a
// leaf collar peeking from under the (now much smaller) crown, not a wafer.
const LETTUCE = { r: 0.5, baseH: 0.11, frillR: 0.68, h: 0.23, edge: 0.035, yBottom: 1.21, yTop: 1.44 };
// Crown height trimmed down by the same amount cheese grew, so the apex
// still lands at CHARACTER_HEIGHT instead of pushing the model taller.
const CROWN = { baseR: 0.62, h: 0.63, yBase: 1.44 };
// apex ≈ 1.44 + 0.63 = 2.07 m, ≈ CHARACTER_HEIGHT (2.1 m).

export class HamburgerCharacter extends BaseCharacter {
  private topBun: THREE.Group;
  private armL: THREE.Group;
  private armR: THREE.Group;
  private forearmL: THREE.Group;
  private forearmR: THREE.Group;
  private footL: THREE.Group;
  private footR: THREE.Group;
  private healGlow: THREE.Mesh;

  // Spring-lag state for the crown "settles a beat after the body" flourish.
  private bunLagY = 0;
  private bunLagYVel = 0;
  private bunLagZ = 0;
  private bunLagZVel = 0;

  constructor(def: CharacterDef) {
    super(def);

    // ── Material differentiation ──────────────────────────────────────────
    // Every layer gets its OWN roughness so the stack reads as different
    // SUBSTANCES — bread, meat, veg, dairy, tool — instead of one glossy
    // plastic shader repeated in different colours (critic defect #1: "reads
    // as a blob wearing coloured rings"). See ToonMatOptions.roughness.
    const bunMat = toonMat({ color: PALETTE.bun, ramp: RAMP_CHARACTER(), roughness: 0.85 }); // dry, matte-baked crust
    const bunDarkMat = toonMat({ color: PALETTE.bunDark, ramp: RAMP_CHARACTER(), roughness: 0.85 });
    const pattyMat = toonMat({ color: PALETTE.patty, ramp: RAMP_CHARACTER(), roughness: 0.55 }); // seared, faintly greasy meat
    const pattyDarkMat = toonMat({ color: PALETTE.pattyDark, ramp: RAMP_CHARACTER(), roughness: 0.55 });
    const cheeseMat = glossyMat({ color: PALETTE.cheese, roughness: 0.35 }); // soft melt sheen
    const tomatoMat = glossyMat({ color: PALETTE.tomato, roughness: 0.18 }); // wettest surface on the model
    const lettuceMatA = toonMat({ color: PALETTE.lettuce, ramp: RAMP_CHARACTER(), roughness: 0.6 }); // leafy, satin not shiny
    const lettuceMatB = toonMat({ color: new THREE.Color(PALETTE.lettuce).offsetHSL(0, -0.06, 0.05), ramp: RAMP_CHARACTER(), roughness: 0.6 });
    const seedMat = toonMat({ color: PALETTE.cream, ramp: RAMP_CHARACTER(), roughness: 0.75 }); // dry toasted sesame
    const armMat = toonMat({ color: PALETTE.bun, ramp: RAMP_CHARACTER(), roughness: 0.85 }); // same bread stock as the buns
    const mittMat = toonMat({ color: PALETTE.cream, ramp: RAMP_CHARACTER(), roughness: 0.68 }); // soft dough, a touch smoother than crust
    const blushMat = flatMat('#FF9EC4', { transparent: true, opacity: 0.45 });
    const glowMat = flatMat(PALETTE.mustard, { transparent: true, opacity: 0 });
    // Spatula — the held prop (see buildArm). Deliberately NOT a food
    // material: brushed metal + dark plastic reads as "tool", sells Patty
    // Smash as an ability, and gives the silhouette a landmark nothing else
    // in a roster of round food blobs would have.
    const spatulaHandleMat = toonMat({ color: '#3B2A22', roughness: 0.55 });
    const spatulaBladeMat = toonMat({ color: '#CDD3DC', roughness: 0.28, metalness: 0.55 });

    // Contrapposto weight-shift bias — set once. Nothing in BaseCharacter's
    // shared motion ever touches body.position.x or body.rotation.y (only
    // position.y / rotation.x / rotation.z are driven per-frame), so this
    // constant asymmetry survives idle, run, attack, hit and death alike.
    // Pushed noticeably further than the previous pass (0.05 / 0.07) — at
    // the small on-screen scale of a gameplay camera a subtle lean read as
    // "inert", not "weighted".
    this.body.position.x = 0.09;
    this.body.rotation.y = 0.13;

    // ── Bottom bun ────────────────────────────────────────────────────────────
    const bottomBun = new THREE.Mesh(roundedPuck(BOTTOM_BUN.r, BOTTOM_BUN.h, BOTTOM_BUN.edge), bunDarkMat);
    bottomBun.name = 'bottom_bun';
    bottomBun.position.y = 0;
    bottomBun.castShadow = true;
    bottomBun.receiveShadow = true;
    this.body.add(bottomBun);

    // ── Feet — asymmetric contrapposto stance, embedded into the bottom bun's
    // lower silhouette (rather than floating below it) via a short ankle nub
    // plus a pivot pulled inside the bun's footprint. ──────────────────────
    this.footL = this.buildFoot(pattyDarkMat, -1, { x: -0.34, y: 0.0, z: 0.36, rotY: -0.32 });
    this.footR = this.buildFoot(pattyDarkMat, 1, { x: 0.33, y: 0.0, z: 0.32, rotY: 0.24 });
    this.body.add(this.footL, this.footR);

    // ── Patty ─────────────────────────────────────────────────────────────────
    const patty = new THREE.Mesh(roundedPuck(PATTY.r, PATTY.h, PATTY.edge), pattyMat);
    patty.name = 'patty';
    patty.position.y = BOTTOM_BUN.h;
    patty.castShadow = true;
    patty.receiveShadow = true;
    this.body.add(patty);

    // Grill marks — thin embedded strips, decals so they don't want their own outline.
    for (const gx of [-0.18, 0.02, 0.22]) {
      const mark = new THREE.Mesh(new THREE.BoxGeometry(0.07, 0.02, PATTY.r * 1.5), pattyDarkMat);
      mark.name = 'grill_mark__no_outline';
      mark.userData.noOutline = true;
      mark.rotation.y = Math.PI / 5;
      mark.position.set(gx, BOTTOM_BUN.h + PATTY.h - 0.04, 0);
      mark.receiveShadow = true;
      this.body.add(mark);
    }

    // ── Cheese — a real melted slab with body, overhanging the patty/tomato
    // edge so it drapes rather than reading as a coloured seam line (round-3
    // defect: 0.07m tall was invisible at gameplay scale). Bigger, denser,
    // longer drips at the rim sell the "melting over the edge" read. ────────
    const cheese = new THREE.Mesh(roundedPuck(CHEESE.r, CHEESE.h, CHEESE.edge), cheeseMat);
    cheese.name = 'cheese';
    cheese.position.y = CHEESE.yBottom;
    cheese.castShadow = true;
    cheese.receiveShadow = true;
    this.body.add(cheese);
    // Kept off dead-centre-front/back (theta ~1.57/4.71) so they read as melt
    // dripping down the sides rather than fangs hanging under the face.
    const dripAngles = [0.5, 1.15, 2.2, 2.85, 3.6, 4.25, 5.3, 5.95];
    for (let i = 0; i < dripAngles.length; i++) {
      const a = dripAngles[i];
      const len = 0.09 + (i % 3) * 0.03;
      const drip = new THREE.Mesh(new THREE.SphereGeometry(0.075, 10, 10), cheeseMat);
      drip.name = 'cheese_drip';
      drip.position.set(Math.cos(a) * CHEESE.r * 0.97, CHEESE.yBottom - len * 0.7, Math.sin(a) * CHEESE.r * 0.97);
      drip.scale.set(1, len / 0.075, 1);
      drip.castShadow = true;
      drip.receiveShadow = true;
      this.body.add(drip);
    }

    // ── Tomato — glossy, peeks slightly beyond the patty/cheese edge ────────
    const tomato = new THREE.Mesh(roundedPuck(TOMATO.r, TOMATO.h, TOMATO.edge), tomatoMat);
    tomato.name = 'tomato';
    tomato.position.y = TOMATO.yBottom;
    tomato.castShadow = true;
    tomato.receiveShadow = true;
    this.body.add(tomato);
    for (const [sx, sz] of [[0.22, 0.4], [-0.28, 0.32], [0.05, -0.42], [-0.15, -0.3]]) {
      const seed = new THREE.Mesh(new THREE.SphereGeometry(0.035, 8, 8), seedMat);
      seed.name = 'tomato_seed__no_outline';
      seed.userData.noOutline = true;
      seed.position.set(sx * TOMATO.r, TOMATO.yBottom + TOMATO.h * 0.55, sz * TOMATO.r);
      seed.scale.set(1, 0.5, 1);
      seed.receiveShadow = true;
      this.body.add(seed);
    }

    // ── Lettuce — solid base disc + a ruffled ring of frill blobs sitting in
    // the upper portion of the band, so it reads as a leaf collar peeking out
    // from under the crown, not a flat green wafer. ─────────────────────────
    const lettuceBase = new THREE.Mesh(roundedPuck(LETTUCE.r, LETTUCE.baseH, LETTUCE.edge), lettuceMatA);
    lettuceBase.name = 'lettuce_base';
    lettuceBase.position.y = LETTUCE.yBottom;
    lettuceBase.castShadow = true;
    lettuceBase.receiveShadow = true;
    this.body.add(lettuceBase);

    const frillCount = 16;
    const frillCenterY = LETTUCE.yBottom + LETTUCE.h * 0.62;
    for (let i = 0; i < frillCount; i++) {
      const a = (i / frillCount) * Math.PI * 2;
      const wobble = (i % 3) * 0.025 - 0.025;
      const frill = new THREE.Mesh(new THREE.SphereGeometry(0.15, 8, 8), i % 2 === 0 ? lettuceMatA : lettuceMatB);
      frill.name = 'lettuce_frill';
      frill.position.set(Math.cos(a) * LETTUCE.frillR, frillCenterY + wobble, Math.sin(a) * LETTUCE.frillR);
      frill.scale.set(1, 0.5, 0.85);
      frill.rotation.y = a;
      frill.castShadow = true;
      frill.receiveShadow = true;
      this.body.add(frill);
    }

    // ── Arms — stubby bun-coloured limbs with cream mitts, each with a real
    // elbow joint (critic defect #3: arms were one straight capsule with a
    // ball hand, which cannot read as "bent" from any angle). Deliberately
    // asymmetric: the right arm is raised, shoulder higher, and grips the
    // spatula prop like a weapon at the ready; the left arm is bent low and
    // tucked near the body, akimbo. That asymmetry is what makes the idle
    // silhouette read as weight-shifted rather than mirrored. ───────────────
    const armResultL = this.buildArm(armMat, mittMat, -1, { y: 0.86, rotZ: -0.58, rotX: 0.06, elbowBend: 1.0 });
    const armResultR = this.buildArm(armMat, mittMat, 1, { y: 1.06, rotZ: 0.62, rotX: -0.16, elbowBend: -1.1, prop: { handleMat: spatulaHandleMat, bladeMat: spatulaBladeMat } });
    this.armL = armResultL.pivot;
    this.armR = armResultR.pivot;
    this.forearmL = armResultL.forearm;
    this.forearmR = armResultR.forearm;
    this.body.add(this.armL, this.armR);

    // ── Top bun crown, sesame seeds and face ─────────────────────────────────
    this.topBun = new THREE.Group();
    this.topBun.name = 'top_bun_group';
    this.topBun.position.y = CROWN.yBase;
    this.body.add(this.topBun);
    this.head = this.topBun; // free counter-lean/tilt from BaseCharacter

    // Fixed head turn — nothing in BaseCharacter or this file's onUpdate ever
    // touches topBun.rotation.y (only .position.y and .rotation.z are driven
    // per-frame), so this constant survives every state. Turned opposite the
    // torso twist for a jaunty "looking past you" mascot tilt rather than a
    // face pointed dead-on at the camera.
    this.topBun.rotation.y = -0.16;

    const crown = new THREE.Mesh(bunDome(CROWN.baseR, CROWN.h), bunMat);
    crown.name = 'crown';
    crown.castShadow = true;
    crown.receiveShadow = true;
    this.topBun.add(crown);

    // Sesame seeds — hand-placed, deterministic scatter across the crown's upper
    // and side surfaces, kept clear of the face zone (front, lower third).
    // Positions are (theta radians, height fraction 0-1), resolved to an EXACT
    // surface point + normal via `crownSurface` so every seed sits flush on the
    // dome regardless of how sharply the profile curves at that height — the
    // previous approximate placement is what let seeds float in mid-air.
    const seedSpots: Array<[number, number]> = [
      [0.0, 0.82], [0.5, 0.76], [-0.5, 0.76], [1.0, 0.68], [-1.0, 0.68],
      [1.5, 0.56], [-1.5, 0.56], [2.1, 0.46], [-2.1, 0.46], [2.7, 0.55],
      [-2.7, 0.55], [3.1, 0.72], [Math.PI, 0.62], [2.4, 0.84], [-2.4, 0.84], [0.2, 0.6],
    ];
    const seedGeo = new THREE.SphereGeometry(1, 8, 6);
    for (const [theta, hf] of seedSpots) {
      const { pos, normal } = crownSurface(theta, hf);
      const seed = new THREE.Mesh(seedGeo, seedMat);
      seed.name = 'sesame_seed';
      // Pushed out along the TRUE surface normal (not a flat radial guess) so
      // the seed sits flush against — and slightly embedded in — the dome.
      seed.position.copy(pos).addScaledVector(normal, 0.009);
      seed.quaternion.setFromUnitVectors(new THREE.Vector3(0, 0, 1), normal);
      seed.rotateZ(theta * 1.7); // vary tangential spin per seed for a natural scatter
      seed.scale.set(0.05, 0.085, 0.016);
      seed.castShadow = true;
      seed.receiveShadow = true;
      this.topBun.add(seed);
    }

    // Face — closed happy eyes + small smile, kept as the fixed personality
    // identity from rules.ts, but made SPECIFIC rather than a neutral sleepy
    // default: one eyebrow cocked higher than the other, eyes slightly
    // unequal in squint, and the smile tilted into a one-sided smirk.
    //
    // Round-3 regression fix: brows and eyes previously each called
    // `addCrownDecal` independently at DIFFERENT hFracs. Because the crown is
    // a dome, two different heights produce two DIFFERENT tangent-plane
    // orientations (the surface normal tilts as it climbs toward the apex),
    // so the eye's "up" and the brow's "up" were subtly different planes —
    // exactly what let the brow's arc swing down into the eye's arc on the
    // right side, and turn into a tangled smear once topBun picked up extra
    // rotation during run. Fixed by anchoring ONE shared tangent frame per
    // side (`faceSideG`) and placing the eye and brow as children offset
    // along that SAME local Y axis — they are now guaranteed coplanar and a
    // fixed, generous distance apart, at every crown rotation and every yaw.
    //
    // Per the relaxed face convention, eyes/brows/mouth are now built with a
    // real shaded material (`faceMat`, lit + outlined) instead of flatMat, so
    // they read as soft sculpted ink rather than sticker decals — closer to
    // the reference plates' soft-formed features.
    const faceMat = toonMat({ color: PALETTE.ink, ramp: RAMP_CHARACTER(), roughness: 0.42 });
    for (const sx of [-1, 1]) {
      const faceSideG = addCrownDecal(this.topBun, sx * 0.33, 0.5, 0.014);

      // Eye — closed happy "^" arc. Tube/curve radius held IDENTICAL between
      // sides so the two eyes carry equal visual weight; only the arc length
      // varies (right squints a touch tighter), which reads as a deliberate
      // half-wink rather than one eye being malformed.
      const eyeArc = sx > 0 ? Math.PI * 0.66 : Math.PI * 0.74;
      const eyeG = new THREE.Group();
      eyeG.position.set(0, -0.125, 0);
      faceSideG.add(eyeG);
      const eye = new THREE.Mesh(faceArc(0.12, 0.028, eyeArc), faceMat);
      eye.name = 'eye';
      eye.rotation.z = Math.PI / 2; // bulge upward: closed happy "^" eye
      eye.castShadow = true;
      eye.receiveShadow = true;
      eyeG.add(eye);

      // Eyebrow — offset +0.13 along the SAME local Y the eye is offset
      // -0.125 along, so the gap between them (~0.25 local units) is fixed
      // and cannot collapse regardless of dome curvature. Cocked higher on
      // the right than the left for a one-eyebrow-raised personality, but
      // the tilt is kept mild now that there's no collision risk to guard
      // against.
      const browG = new THREE.Group();
      browG.position.set(0, 0.13, 0.012);
      faceSideG.add(browG);
      const brow = new THREE.Mesh(faceArc(0.09, 0.02, Math.PI * 0.32), faceMat);
      brow.name = 'brow';
      brow.rotation.z = sx > 0 ? 0.24 : 0.1;
      brow.castShadow = true;
      brow.receiveShadow = true;
      browG.add(brow);

      const blushG = addCrownDecal(this.topBun, sx * 0.6, 0.3, 0.004);
      const blush = new THREE.Mesh(new THREE.CircleGeometry(0.068, 16), blushMat);
      blush.name = 'blush__no_outline';
      blush.userData.noOutline = true;
      blushG.add(blush);
    }

    // Mouth — kept off-centre with the whole arc tilted, so the small closed
    // smile reads as a one-sided smirk (playful short-order cook) instead of
    // a perfectly symmetric "u". Enlarged and switched to the shaded face
    // material to match the rebuilt eyes/brows.
    const mouthG = addCrownDecal(this.topBun, -0.05, 0.25, 0.014);
    const mouth = new THREE.Mesh(faceArc(0.13, 0.024, Math.PI * 0.46), faceMat);
    mouth.name = 'mouth';
    mouth.rotation.z = -Math.PI / 2 + 0.16; // bulge down-and-tilted: smirk, not a flat "u"
    mouth.castShadow = true;
    mouth.receiveShadow = true;
    mouthG.add(mouth);

    // ── Heal glow — dormant ring for the Onion Ring self-heal flourish ──────
    this.healGlow = new THREE.Mesh(new THREE.TorusGeometry(0.72, 0.05, 8, 32), glowMat);
    this.healGlow.name = 'heal_glow__no_outline';
    this.healGlow.userData.noOutline = true;
    this.healGlow.rotation.x = Math.PI / 2;
    this.healGlow.position.y = 0.78;
    this.body.add(this.healGlow);

    // Outline: a whisper, per render/toon.ts — the reference bar carries almost
    // no ink line. The previous 0.032 was 8x the module's tuned default.
    outlineGroup(this.root, OUTLINE_THIN);
    this.collectFlashTargets();
  }

  /**
   * Round-3 defect: feet were small capsule blobs, easily lost against the
   * ground shadow, and one went missing entirely in idle. Rebuilt as a stout
   * ankle post plugged well up into the bottom bun's lower curve (real
   * overlap, not a hairline seam) plus a big chunky rounded-box shoe — a
   * shape with an actual toe/heel volume instead of a stretched sphere.
   */
  private buildFoot(mat: THREE.Material, sx: number, cfg: { x: number; y: number; z: number; rotY: number }): THREE.Group {
    const pivot = new THREE.Group();
    pivot.name = sx < 0 ? 'foot_l_pivot' : 'foot_r_pivot';
    pivot.position.set(cfg.x, cfg.y, cfg.z);
    pivot.rotation.y = cfg.rotY;

    const ankle = new THREE.Mesh(new THREE.CapsuleGeometry(0.1, 0.16, 4, 8), mat);
    ankle.name = 'ankle';
    ankle.position.set(0, 0.14, -0.02);
    ankle.castShadow = true;
    ankle.receiveShadow = true;
    pivot.add(ankle);

    const shoe = new THREE.Mesh(roundedBox(0.27, 0.17, 0.35, 0.085, 3), mat);
    shoe.name = 'foot';
    shoe.position.set(0, 0.07, 0.1);
    shoe.castShadow = true;
    shoe.receiveShadow = true;
    pivot.add(shoe);
    return pivot;
  }

  /**
   * Shoulder pivot -> forearm pivot (elbow) -> mitt, so the limb reads as a
   * jointed arm instead of one straight capsule with a ball hand glued to the
   * end. The shoulder is pushed out past the lettuce frill radius (0.68m) so
   * the arm is never swallowed by the collar silhouette.
   *
   * `elbowBend` sets the forearm pivot's REST rotation on Z, not X. Z is the
   * screen-plane axis (same axis body/topBun "tilt" already animates on), so
   * the fold is always visible from a front-on camera; an X-axis bend mostly
   * foreshortens into depth once the shoulder itself carries any Z swing,
   * which is what made the first pass at this read as one long straight limb
   * instead of a bent one. onUpdate layers dynamic swing on top via X, which
   * adds depth/life without fighting this static screen-plane fold.
   */
  private buildArm(
    armMat: THREE.Material,
    mittMat: THREE.Material,
    sx: number,
    cfg: { y: number; rotZ: number; rotX: number; elbowBend: number; prop?: { handleMat: THREE.Material; bladeMat: THREE.Material } }
  ): { pivot: THREE.Group; forearm: THREE.Group } {
    const pivot = new THREE.Group();
    pivot.name = sx < 0 ? 'arm_l_pivot' : 'arm_r_pivot';
    // Pulled in from the old 0.8 — that placed the shoulder pivot well outside
    // the torso's own radius (~0.6-0.68m through the cheese/tomato bands), so
    // the upper-arm capsule never touched the body and read as a floating
    // sausage (round-3 defect #1). Only a modest trim, to just outside the
    // torso surface: a first attempt at 0.47 (well INSIDE the torso) buried
    // the whole forearm/mitt in the body mesh and produced ugly z-fighting —
    // worse than the original gap. The residual few centimetres of gap left
    // at this distance is what the shoulder sphere below is sized to bridge.
    pivot.position.set(sx * 0.68, cfg.y, 0.08);
    pivot.rotation.z = cfg.rotZ;
    pivot.rotation.x = cfg.rotX;

    // Shoulder / deltoid cap — a sphere centred exactly on the pivot's own
    // origin. Because a sphere is rotationally symmetric about its centre,
    // it stays visually fixed at the shoulder attach point no matter how
    // `pivot.rotation` gets driven per-frame (idle sway, run swing, attack
    // wind-up) or which yaw the camera views from — it is what physically
    // bridges the torso surface to the upper-arm capsule at every angle,
    // instead of relying on a static pose that only happens to line up at
    // one rotation.
    const shoulder = new THREE.Mesh(new THREE.SphereGeometry(0.2, 14, 12), armMat);
    shoulder.name = 'shoulder';
    shoulder.castShadow = true;
    shoulder.receiveShadow = true;
    pivot.add(shoulder);

    const upper = new THREE.Mesh(new THREE.CapsuleGeometry(0.115, 0.15, 4, 10), armMat);
    upper.name = 'arm_upper';
    upper.position.set(0, -0.14, 0);
    upper.castShadow = true;
    upper.receiveShadow = true;
    pivot.add(upper);

    const forearmPivot = new THREE.Group();
    forearmPivot.name = sx < 0 ? 'forearm_l_pivot' : 'forearm_r_pivot';
    forearmPivot.position.set(0, -0.27, 0);
    forearmPivot.rotation.z = cfg.elbowBend;
    forearmPivot.rotation.x = 0.18;
    pivot.add(forearmPivot);

    const forearm = new THREE.Mesh(new THREE.CapsuleGeometry(0.098, 0.13, 4, 10), armMat);
    forearm.name = 'arm_forearm';
    forearm.position.set(0, -0.11, 0);
    forearm.castShadow = true;
    forearm.receiveShadow = true;
    forearmPivot.add(forearm);

    const mitt = new THREE.Mesh(new THREE.SphereGeometry(0.12, 12, 10), mittMat);
    mitt.name = 'mitt';
    mitt.position.set(0, -0.24, 0);
    mitt.scale.set(1, 0.92, 1);
    mitt.castShadow = true;
    mitt.receiveShadow = true;
    forearmPivot.add(mitt);

    // Held prop — a grill spatula, gripped in the fist. This is the roster's
    // one distinctive silhouette landmark (critic's "also worth considering")
    // and it's what a Patty Smash swing actually reads as swinging.
    if (cfg.prop) {
      // Round-3 defect: this rendered as a small grey rectangular sliver —
      // unreadable as a tool. Scaled up substantially (handle + blade both
      // roughly 1.6x longer and wider) and re-angled so the blade's broad
      // FACE is presented outward rather than edge-on, matching the "props
      // are oversized and bold" reference direction.
      const spatula = new THREE.Group();
      spatula.name = 'spatula';
      // Offset to the outer side of the mitt (sx-biased) rather than dead
      // centre through it — gripping through the palm's centre put the dark
      // handle crossing straight over the pale mitt sphere in side-on attack
      // poses, which coincidentally read as a stray eye.
      spatula.position.set(0.03 + sx * 0.07, -0.15, 0.1);
      spatula.rotation.x = -1.25;
      spatula.rotation.z = -0.16;
      forearmPivot.add(spatula);

      const handle = new THREE.Mesh(new THREE.CapsuleGeometry(0.048, 0.42, 4, 8), cfg.prop.handleMat);
      handle.name = 'spatula_handle';
      handle.position.set(0, 0.24, 0);
      handle.castShadow = true;
      handle.receiveShadow = true;
      spatula.add(handle);

      const blade = new THREE.Mesh(roundedBox(0.4, 0.05, 0.5, 0.09, 3), cfg.prop.bladeMat);
      blade.name = 'spatula_blade';
      blade.position.set(0, 0.55, 0.06);
      blade.rotation.x = 0.3;
      blade.castShadow = true;
      blade.receiveShadow = true;
      spatula.add(blade);
    }

    return { pivot, forearm: forearmPivot };
  }

  protected onUpdate(ctx: AnimContext): void {
    const move = THREE.MathUtils.clamp(ctx.moveSpeed01, 0, 1);
    const runPhase = this.elapsed * 11.5;

    // ── Crown settle — a critically-damped spring that trails the body's
    // vertical bounce and tilt by a beat, so the top bun feels loosely stacked
    // rather than welded on. ────────────────────────────────────────────────
    const targetY = this.body.position.y;
    const targetZ = this.body.rotation.z;
    const springK = 380;
    const springD = 24;
    this.bunLagYVel += (targetY - this.bunLagY) * springK * ctx.dt;
    this.bunLagYVel *= Math.max(0, 1 - springD * ctx.dt);
    this.bunLagY += this.bunLagYVel * ctx.dt;
    this.bunLagZVel += (targetZ - this.bunLagZ) * springK * ctx.dt;
    this.bunLagZVel *= Math.max(0, 1 - springD * ctx.dt);
    this.bunLagZ += this.bunLagZVel * ctx.dt;
    this.topBun.position.y = CROWN.yBase + (this.bunLagY - targetY);
    this.topBun.rotation.z += this.bunLagZ - targetZ;

    // ── Contrapposto bias — a small constant lean layered on top of the
    // shared idle/run/hit/death motion (both of which fully overwrite
    // body.rotation.z and topBun.rotation.z earlier this frame), so the pose
    // always reads as weighted to one side rather than perfectly symmetric.
    // Pushed up from the previous pass (0.05 / 0.035) — at gameplay scale the
    // smaller values read as noise, not a stance. ──────────────────────────
    this.body.rotation.z += 0.075;
    this.topBun.rotation.z += 0.05;

    // ── Idle sway / run swing for arms and feet ─────────────────────────────
    const idleSway = Math.sin(this.elapsed * 2.1) * 0.05 * (1 - move);
    const runSwing = Math.sin(runPhase) * 0.38 * move;
    const runSwingOpp = Math.sin(runPhase + Math.PI) * 0.38 * move;

    this.armL.rotation.x = idleSway + runSwing;
    this.armR.rotation.x = -idleSway + runSwingOpp;
    // Elbows pump opposite the run bounce — a straight-locked elbow through a
    // full run cycle is a big part of what read as "inert" before. The 0.18
    // base matches the constant rest offset from buildArm so idle (move=0)
    // doesn't snap the forearm flat.
    this.forearmL.rotation.x = 0.18 - Math.abs(runSwing) * 0.6;
    this.forearmR.rotation.x = 0.18 - Math.abs(runSwingOpp) * 0.6;

    const liftL = Math.max(0, Math.sin(runPhase)) * 0.5 * move;
    const liftR = Math.max(0, Math.sin(runPhase + Math.PI)) * 0.5 * move;
    this.footL.rotation.x = -liftL;
    this.footR.rotation.x = -liftR;

    // ── Attack — differentiate per weapon so smash / toss / fling / heal all
    // read as distinct gestures rather than sharing one generic swing. Each
    // one now also drives the forearm/elbow, not just the shoulder, and
    // Patty Smash in particular swings the spatula OVERHEAD rather than
    // fore-and-aft, so its silhouette is unmistakable even head-on — a pure
    // forward/back swing foreshortens away to almost nothing from camera. ──
    let glowOpacity = 0;
    if (this.attackT >= 0) {
      const p = this.attackT / this.attackDuration;
      const anticipation = p < 0.28 ? Math.sin((p / 0.28) * Math.PI) : 0;
      const strike = p >= 0.28 ? Math.sin(((p - 0.28) / 0.72) * Math.PI) : 0;

      switch (this.attackWeaponIndex) {
        case 0: {
          // Patty Smash — spatula arm winds up high overhead (shoulder swings
          // back-and-up on both X and Z), then slams down and forward
          // together with the brace arm. The overhead raise is what makes
          // this silhouette unmistakable even head-on — a pure forward/back
          // swing would foreshorten away to almost nothing from camera.
          this.armR.rotation.x = -anticipation * 1.5 + strike * 1.35;
          this.armR.rotation.z = 0.62 - anticipation * 0.85 + strike * 0.2;
          this.forearmR.rotation.x = 0.18 - anticipation * 0.3 + strike * 0.55;
          this.armL.rotation.x = -anticipation * 0.3 + strike * 0.4;
          this.armL.rotation.z = -0.58 - strike * 0.3;
          this.forearmL.rotation.x = 0.18 + strike * 0.25;
          break;
        }
        case 1: {
          // Tomato Toss — right arm winds back and throws overhand, elbow
          // snapping through at release like a real pitching motion.
          this.armR.rotation.x = -anticipation * 0.75 + strike * 1.3;
          this.armR.rotation.z = 0.35 - anticipation * 0.25;
          this.forearmR.rotation.x = 0.18 - anticipation * 0.4 + strike * 0.65;
          this.armL.rotation.x = anticipation * 0.12;
          break;
        }
        case 2: {
          // Lettuce Fling — left arm sweeps sideways in a low flick, forearm
          // trailing then snapping through at release.
          this.armL.rotation.z = -0.58 - anticipation * 0.35 + strike * 0.9;
          this.armL.rotation.x = strike * 0.22;
          this.forearmL.rotation.x = 0.18 + anticipation * 0.3 - strike * 0.6;
          this.armR.rotation.x = anticipation * 0.12;
          break;
        }
        case 3: {
          // Onion Ring — self-hug and a warm healing pulse, elbows curling
          // tighter in than their idle bend.
          const hug = anticipation * 0.4 + strike * 0.6;
          this.armL.rotation.x = hug;
          this.armR.rotation.x = hug;
          this.armL.rotation.z = -0.58 - hug * 0.4;
          this.armR.rotation.z = 0.62 + hug * 0.4;
          this.forearmL.rotation.x = 0.18 + hug * 0.5;
          this.forearmR.rotation.x = 0.18 + hug * 0.5;
          glowOpacity = strike * 0.75;
          break;
        }
        default:
          break;
      }
    }
    const glowMat = this.healGlow.material as THREE.MeshBasicMaterial;
    glowMat.opacity = glowOpacity;
    this.healGlow.scale.setScalar(1 + glowOpacity * 0.35);

    // Subtle strain when low on health — a small permanent forward hunch.
    if (ctx.health01 < 0.35) {
      this.body.rotation.x += 0.06 * (0.35 - ctx.health01) / 0.35;
    }
  }
}
