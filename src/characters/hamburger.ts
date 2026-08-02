/**
 * Hamburger — Normal rarity, the roster's first-built model and art-direction
 * anchor for the rest of the cast.
 *
 * Read as: a big rounded bun "head" riding a stacked patty/cheese/tomato/lettuce
 * "torso" on a squat bun base, with stubby bun-coloured arms and dark little feet.
 * Closed happy eyes + small smile live on the crown, the roundest/most front-facing
 * surface, so they stay legible from the tilted gameplay camera.
 */

import * as THREE from 'three';
import { BaseCharacter } from './types';
import type { AnimContext } from './types';
import type { CharacterDef } from '../game/rules';
import { PALETTE } from '../game/rules';
import { toonMat, glossyMat, flatMat, outlineGroup, RAMP_CHARACTER } from '../render/toon';

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

/** The bun crown: a squat dome that bulges out near its base then rounds to an
 * apex — the classic burger-bun silhouette, not just a sphere. */
function bunDome(baseRadius: number, height: number, radialSegments = 28): THREE.BufferGeometry {
  const pts = [
    new THREE.Vector2(0, 0),
    new THREE.Vector2(baseRadius * 0.88, 0),
    new THREE.Vector2(baseRadius, height * 0.16),
    new THREE.Vector2(baseRadius * 0.97, height * 0.42),
    new THREE.Vector2(baseRadius * 0.78, height * 0.72),
    new THREE.Vector2(baseRadius * 0.4, height * 0.93),
    new THREE.Vector2(0, height),
  ];
  const geo = new THREE.LatheGeometry(pts, radialSegments);
  geo.computeVertexNormals();
  return geo;
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
// ─────────────────────────────────────────────────────────────────────────────

// Radii deliberately do NOT shrink monotonically: cheese and tomato are made
// *wider* than the patty beneath them so they peek out past its edge instead of
// hiding behind it, and the lettuce's solid base disc is kept narrower than the
// tomato so it nests on top rather than blanketing it from the camera's tilted
// downward view. Only the frill blobs (not the base disc) reach out wide, to read
// as a ruffled edge rather than a fourth solid occluding layer.
const BOTTOM_BUN = { r: 0.6, h: 0.58, edge: 0.18, yTop: 0.58 };
const PATTY = { r: 0.56, h: 0.26, edge: 0.07, yTop: 0.84 };
const CHEESE = { r: 0.62, h: 0.06, edge: 0.02, yBottom: 0.84, yTop: 0.9 };
const TOMATO = { r: 0.58, h: 0.14, edge: 0.06, yBottom: 0.9, yTop: 1.04 };
const LETTUCE = { r: 0.46, frillR: 0.64, h: 0.09, edge: 0.03, yBottom: 1.04, yTop: 1.13 };
const CROWN = { baseR: 0.62, h: 0.95, yBase: 1.1 };

export class HamburgerCharacter extends BaseCharacter {
  private topBun: THREE.Group;
  private armL: THREE.Group;
  private armR: THREE.Group;
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

    const bunMat = toonMat({ color: PALETTE.bun, ramp: RAMP_CHARACTER() });
    const bunDarkMat = toonMat({ color: PALETTE.bunDark, ramp: RAMP_CHARACTER() });
    const pattyMat = toonMat({ color: PALETTE.patty, ramp: RAMP_CHARACTER() });
    const pattyDarkMat = toonMat({ color: PALETTE.pattyDark, ramp: RAMP_CHARACTER() });
    const cheeseMat = glossyMat({ color: PALETTE.cheese, roughness: 0.4 });
    const tomatoMat = glossyMat({ color: PALETTE.tomato, roughness: 0.22 });
    const lettuceMatA = toonMat({ color: PALETTE.lettuce, ramp: RAMP_CHARACTER() });
    const lettuceMatB = toonMat({ color: new THREE.Color(PALETTE.lettuce).offsetHSL(0, -0.06, 0.05), ramp: RAMP_CHARACTER() });
    const seedMat = toonMat({ color: PALETTE.cream, ramp: RAMP_CHARACTER() });
    const armMat = toonMat({ color: PALETTE.bun, ramp: RAMP_CHARACTER() });
    const mittMat = toonMat({ color: PALETTE.cream, ramp: RAMP_CHARACTER() });
    const inkMat = flatMat(PALETTE.ink);
    const blushMat = flatMat('#FF9EC4', { transparent: true, opacity: 0.45 });
    const glowMat = flatMat(PALETTE.mustard, { transparent: true, opacity: 0 });

    // ── Bottom bun ────────────────────────────────────────────────────────────
    const bottomBun = new THREE.Mesh(roundedPuck(BOTTOM_BUN.r, BOTTOM_BUN.h, BOTTOM_BUN.edge), bunDarkMat);
    bottomBun.name = 'bottom_bun';
    bottomBun.position.y = 0;
    bottomBun.castShadow = true;
    bottomBun.receiveShadow = true;
    this.body.add(bottomBun);

    // ── Feet — peek out from under the bottom bun's front edge ──────────────
    this.footL = this.buildFoot(pattyDarkMat, -0.3);
    this.footR = this.buildFoot(pattyDarkMat, 0.3);
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
      mark.position.set(gx, BOTTOM_BUN.h + PATTY.h - 0.03, 0);
      this.body.add(mark);
    }

    // ── Cheese — thin glossy drape with a few melt drips at the rim ─────────
    const cheese = new THREE.Mesh(roundedPuck(CHEESE.r, CHEESE.h, CHEESE.edge), cheeseMat);
    cheese.name = 'cheese';
    cheese.position.y = CHEESE.yBottom;
    cheese.castShadow = true;
    this.body.add(cheese);
    const dripAngles = [0.5, 1.7, 3.4, 5.0];
    for (const a of dripAngles) {
      const drip = new THREE.Mesh(new THREE.ConeGeometry(0.045, 0.14, 8), cheeseMat);
      drip.name = 'cheese_drip';
      drip.position.set(Math.cos(a) * CHEESE.r * 0.96, CHEESE.yBottom + 0.02, Math.sin(a) * CHEESE.r * 0.96);
      drip.rotation.x = Math.PI;
      drip.castShadow = true;
      this.body.add(drip);
    }

    // ── Tomato — glossy, peeks slightly beyond the patty/cheese edge ────────
    const tomato = new THREE.Mesh(roundedPuck(TOMATO.r, TOMATO.h, TOMATO.edge), tomatoMat);
    tomato.name = 'tomato';
    tomato.position.y = TOMATO.yBottom;
    tomato.castShadow = true;
    this.body.add(tomato);
    for (const [sx, sz] of [[0.22, 0.4], [-0.28, 0.32], [0.05, -0.42], [-0.15, -0.3]]) {
      const seed = new THREE.Mesh(new THREE.SphereGeometry(0.035, 8, 8), seedMat);
      seed.name = 'tomato_seed__no_outline';
      seed.userData.noOutline = true;
      seed.position.set(sx * TOMATO.r, TOMATO.yBottom + TOMATO.h * 0.55, sz * TOMATO.r);
      seed.scale.set(1, 0.5, 1);
      this.body.add(seed);
    }

    // ── Lettuce — solid base disc + a ruffled ring of frill blobs ───────────
    const lettuceBase = new THREE.Mesh(roundedPuck(LETTUCE.r, LETTUCE.h, LETTUCE.edge), lettuceMatA);
    lettuceBase.name = 'lettuce_base';
    lettuceBase.position.y = LETTUCE.yBottom;
    lettuceBase.castShadow = true;
    lettuceBase.receiveShadow = true;
    this.body.add(lettuceBase);

    const frillCount = 14;
    for (let i = 0; i < frillCount; i++) {
      const a = (i / frillCount) * Math.PI * 2;
      const wobble = (i % 3) * 0.02 - 0.02;
      const frill = new THREE.Mesh(new THREE.SphereGeometry(0.115, 8, 8), i % 2 === 0 ? lettuceMatA : lettuceMatB);
      frill.name = 'lettuce_frill';
      frill.position.set(Math.cos(a) * LETTUCE.frillR, LETTUCE.yBottom + LETTUCE.h * 0.5 + wobble, Math.sin(a) * LETTUCE.frillR);
      frill.scale.set(1, 0.4, 0.8);
      frill.rotation.y = a;
      frill.castShadow = true;
      this.body.add(frill);
    }

    // ── Arms — stubby bun-coloured limbs with cream mitts ────────────────────
    this.armL = this.buildArm(armMat, mittMat, -1);
    this.armR = this.buildArm(armMat, mittMat, 1);
    this.body.add(this.armL, this.armR);

    // ── Top bun crown, sesame seeds and face ─────────────────────────────────
    this.topBun = new THREE.Group();
    this.topBun.name = 'top_bun_group';
    this.topBun.position.y = CROWN.yBase;
    this.body.add(this.topBun);
    this.head = this.topBun; // free counter-lean/tilt from BaseCharacter

    const crown = new THREE.Mesh(bunDome(CROWN.baseR, CROWN.h), bunMat);
    crown.name = 'crown';
    crown.castShadow = true;
    crown.receiveShadow = true;
    this.topBun.add(crown);

    // Sesame seeds — hand-placed, deterministic scatter across the crown's upper
    // and side surfaces, kept clear of the face zone (front, lower third).
    const seedSpots: Array<[number, number]> = [
      [0.0, 0.86], [0.5, 0.8], [-0.5, 0.8], [1.0, 0.74], [-1.0, 0.74],
      [1.5, 0.62], [-1.5, 0.62], [2.1, 0.5], [-2.1, 0.5], [2.7, 0.6],
      [-2.7, 0.6], [3.1, 0.78], [Math.PI, 0.68], [2.4, 0.9],
    ];
    const seedGeo = new THREE.SphereGeometry(1, 8, 6);
    for (const [theta, hf] of seedSpots) {
      const y = CROWN.h * hf;
      const radiusAtH = CROWN.baseR * (0.6 + 0.4 * Math.sin(hf * Math.PI * 0.9)); // rough profile match
      const nx = Math.sin(theta);
      const nz = Math.cos(theta);
      const seed = new THREE.Mesh(seedGeo, seedMat);
      seed.name = 'sesame_seed';
      seed.position.set(nx * (radiusAtH + 0.015), y, nz * (radiusAtH + 0.015));
      // Lie the seed flat against the crown: align its thin local-Z axis with the
      // (mostly horizontal) outward normal, then vary the tangential spin per seed
      // so they scatter naturally instead of all pointing the same way.
      const normal = new THREE.Vector3(nx, 0.15, nz).normalize();
      seed.quaternion.setFromUnitVectors(new THREE.Vector3(0, 0, 1), normal);
      seed.rotateZ(theta * 1.7);
      seed.scale.set(0.055, 0.09, 0.018);
      seed.castShadow = true;
      this.topBun.add(seed);
    }

    // Face — closed happy eyes + small smile + blush, on the crown's lower front.
    const faceGroup = new THREE.Group();
    faceGroup.name = 'face';
    faceGroup.position.set(0, CROWN.h * 0.3, CROWN.baseR * 0.98);
    this.topBun.add(faceGroup);

    for (const sx of [-1, 1]) {
      const eye = new THREE.Mesh(faceArc(0.1, 0.022, Math.PI * 0.72), inkMat);
      eye.name = 'eye__no_outline';
      eye.userData.noOutline = true;
      eye.rotation.z = Math.PI / 2; // bulge upward: closed happy "^" eye
      eye.position.set(sx * 0.155, 0.02, 0.03);
      faceGroup.add(eye);

      const blush = new THREE.Mesh(new THREE.CircleGeometry(0.075, 16), blushMat);
      blush.name = 'blush__no_outline';
      blush.userData.noOutline = true;
      blush.position.set(sx * 0.32, -0.08, 0.02);
      blush.rotation.y = sx * -0.5;
      faceGroup.add(blush);
    }

    const mouth = new THREE.Mesh(faceArc(0.11, 0.02, Math.PI * 0.5), inkMat);
    mouth.name = 'mouth__no_outline';
    mouth.userData.noOutline = true;
    mouth.rotation.z = -Math.PI / 2; // bulge downward: small smile "u"
    mouth.position.set(0, -0.16, 0.035);
    faceGroup.add(mouth);

    // ── Heal glow — dormant ring for the Onion Ring self-heal flourish ──────
    this.healGlow = new THREE.Mesh(new THREE.TorusGeometry(0.72, 0.05, 8, 32), glowMat);
    this.healGlow.name = 'heal_glow__no_outline';
    this.healGlow.userData.noOutline = true;
    this.healGlow.rotation.x = Math.PI / 2;
    this.healGlow.position.y = 0.58;
    this.body.add(this.healGlow);

    outlineGroup(this.root, 0.032);
    this.collectFlashTargets();
  }

  private buildFoot(mat: THREE.Material, sx: number): THREE.Group {
    const pivot = new THREE.Group();
    pivot.name = sx < 0 ? 'foot_l_pivot' : 'foot_r_pivot';
    // Pushed out to BOTTOM_BUN.r so the toe clearly pokes past the bun's front
    // edge — Kirby-style feet peeking from under a round body — while the heel
    // stays tucked just inside it.
    pivot.position.set(sx * 0.28, 0.1, 0.62);
    const shoe = new THREE.Mesh(new THREE.CapsuleGeometry(0.1, 0.1, 4, 10), mat);
    shoe.name = 'foot';
    shoe.rotation.x = Math.PI / 2;
    shoe.position.set(0, -0.01, 0.1);
    shoe.castShadow = true;
    pivot.add(shoe);
    return pivot;
  }

  private buildArm(armMat: THREE.Material, mittMat: THREE.Material, sx: number): THREE.Group {
    const pivot = new THREE.Group();
    pivot.name = sx < 0 ? 'arm_l_pivot' : 'arm_r_pivot';
    pivot.position.set(sx * 0.66, 0.76, 0.06);
    pivot.rotation.z = sx * 0.22;

    const upper = new THREE.Mesh(new THREE.CapsuleGeometry(0.12, 0.12, 4, 10), armMat);
    upper.name = 'arm_upper';
    upper.position.set(0, -0.12, 0);
    upper.castShadow = true;
    pivot.add(upper);

    const mitt = new THREE.Mesh(new THREE.SphereGeometry(0.12, 12, 10), mittMat);
    mitt.name = 'mitt';
    mitt.position.set(0, -0.27, 0);
    mitt.scale.set(1, 0.92, 1);
    mitt.castShadow = true;
    pivot.add(mitt);

    return pivot;
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

    // ── Idle sway / run swing for arms and feet ─────────────────────────────
    const idleSway = Math.sin(this.elapsed * 2.1) * 0.05 * (1 - move);
    const runSwing = Math.sin(runPhase) * 0.38 * move;
    const runSwingOpp = Math.sin(runPhase + Math.PI) * 0.38 * move;

    this.armL.rotation.x = idleSway + runSwing;
    this.armR.rotation.x = -idleSway + runSwingOpp;

    const liftL = Math.max(0, Math.sin(runPhase)) * 0.5 * move;
    const liftR = Math.max(0, Math.sin(runPhase + Math.PI)) * 0.5 * move;
    this.footL.rotation.x = -liftL;
    this.footR.rotation.x = -liftR;

    // ── Attack — differentiate per weapon so smash / toss / fling / heal all
    // read as distinct gestures rather than sharing one generic swing. ──────
    let glowOpacity = 0;
    if (this.attackT >= 0) {
      const p = this.attackT / this.attackDuration;
      const anticipation = p < 0.28 ? Math.sin((p / 0.28) * Math.PI) : 0;
      const strike = p >= 0.28 ? Math.sin(((p - 0.28) / 0.72) * Math.PI) : 0;

      switch (this.attackWeaponIndex) {
        case 0: {
          // Patty Smash — both arms rear back, then slam down together.
          const x = -anticipation * 0.55 + strike * 1.15;
          this.armL.rotation.x = x;
          this.armR.rotation.x = x;
          break;
        }
        case 1: {
          // Tomato Toss — right arm winds back and throws overhand.
          this.armR.rotation.x = -anticipation * 0.75 + strike * 1.3;
          this.armR.rotation.z = 0.35 - anticipation * 0.25;
          this.armL.rotation.x = anticipation * 0.12;
          break;
        }
        case 2: {
          // Lettuce Fling — left arm sweeps sideways in a low flick.
          this.armL.rotation.z = -0.35 - anticipation * 0.35 + strike * 0.9;
          this.armL.rotation.x = strike * 0.22;
          this.armR.rotation.x = anticipation * 0.12;
          break;
        }
        case 3: {
          // Onion Ring — self-hug and a warm healing pulse.
          const hug = anticipation * 0.4 + strike * 0.6;
          this.armL.rotation.x = hug;
          this.armR.rotation.x = hug;
          this.armL.rotation.z = -0.35 - hug * 0.4;
          this.armR.rotation.z = 0.35 + hug * 0.4;
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
