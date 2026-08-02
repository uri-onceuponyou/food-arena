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
import { toonMat, glossyMat, flatMat, outlineGroup } from '../render/toon';
import { ChibiRig } from './rig';

// ── Palette ──────────────────────────────────────────────────────────────────
const CANDY_WHITE = '#FFFDF9';
const CANDY_RED = '#E63946';
const STICK = '#FBF7EE';       // matte paper stick
const CYBER = RARITY_COLORS.Cyber; // '#00E5B0' — restrained trim accent only
const BOOT = '#2A2140';        // dark, near-ink boots — grounds the pale/red palette

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

export class LollipopCharacter extends BaseCharacter {
  private rig: ChibiRig;

  constructor(def: CharacterDef) {
    super(def);

    this.rig = new ChibiRig({
      palette: {
        limb: STICK,
        hand: CANDY_RED,
        foot: BOOT,
        torso: STICK,
        limbRoughness: 0.75,
      },
      proportions: { headFraction: 0.44 },
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
    const discCenterY = R * 0.55;
    const discOuterR = R * 0.92;
    const discDepth = R * 0.24; // real thickness — a paper-thin disc would vanish to a
                                // blade edge-on (idle_135/210), same failure Taco solved
    const stickR = R * 0.17;
    const stickTopY = discCenterY - discOuterR * 0.35; // embeds into the disc's underside
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
    const ribbonDepth = discDepth * 0.55;
    const ribbonMat = glossyMat({ color: CANDY_RED, roughness: 0.12, emissive: CANDY_RED, emissiveIntensity: 0.12 });
    const ribbon = new THREE.Mesh(
      new THREE.ExtrudeGeometry(ribbonShape, {
        depth: ribbonDepth, bevelEnabled: true, bevelThickness: R * 0.008, bevelSize: R * 0.008, bevelSegments: 2, curveSegments: 1,
      }),
      ribbonMat
    );
    ribbon.name = 'lollipop_swirl';
    ribbon.position.set(0, discCenterY, discDepth / 2 - ribbonDepth * 0.2);
    ribbon.castShadow = true;
    ribbon.receiveShadow = true;
    head.add(ribbon);

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
    const petalGeo = new THREE.ConeGeometry(stickR * 1.7, R * 0.3, 3, 1, true);
    const petalMatA = toonMat({ color: CANDY_RED, roughness: 0.68 });
    const petalMatB = toonMat({ color: CANDY_WHITE, roughness: 0.68 });
    for (let i = 0; i < 6; i++) {
      const a = (i / 6) * Math.PI * 2;
      const petal = new THREE.Mesh(petalGeo, i % 2 === 0 ? petalMatA : petalMatB);
      petal.name = 'lollipop_wrapper_petal';
      petal.position.set(Math.cos(a) * stickR * 0.85, stickBottomY + R * 0.14, Math.sin(a) * stickR * 0.85);
      petal.rotation.set(0.55, a, 0);
      petal.castShadow = true;
      petal.receiveShadow = true;
      head.add(petal);
    }

    // ── Face: eyes on the stick, mouth on the candy ───────────────────────────
    this.rig.joints.face.position.set(0, 0, 0);
    this.buildFace(R, stickR, discCenterY, discOuterR, discDepth, stickTopY, stickBottomY);

    // ── Torso: candy-wrapper costume, contrasting the pale limbs ──────────────
    this.dressTorso(R);

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
    discDepth: number,
    stickTopY: number,
    stickBottomY: number
  ): void {
    const face = this.rig.joints.face;
    const ink = PALETTE.ink;
    const eyeMat = toonMat({ color: ink, roughness: 0.25 });

    const stickFaceY = stickBottomY + (stickTopY - stickBottomY) * 0.62;
    for (const sx of [-1, 1]) {
      const ex = sx * stickR * 0.52;
      const ez = Math.sqrt(Math.max(0, stickR * stickR - ex * ex)) * 0.96;
      const eye = new THREE.Mesh(new THREE.SphereGeometry(stickR * 0.42, 14, 12), eyeMat);
      eye.position.set(ex, stickFaceY, ez);
      eye.scale.set(1, 1.2, 0.55);
      eye.castShadow = true;
      face.add(eye);

      const glint = new THREE.Mesh(new THREE.SphereGeometry(stickR * 0.13, 8, 8), flatMat('#ffffff'));
      glint.position.set(ex - stickR * 0.11, stickFaceY + stickR * 0.15, ez + stickR * 0.1);
      glint.userData.noOutline = true;
      face.add(glint);
    }
    // One raised brow, echoing the confident "about to swing" personality without
    // duplicating Taco's identical trick verbatim — here it's built on the stick,
    // above the eyes, rather than on the food mass itself.
    const brow = new THREE.Mesh(
      new THREE.CapsuleGeometry(stickR * 0.09, stickR * 0.5, 4, 8),
      toonMat({ color: ink, roughness: 0.5 })
    );
    brow.position.set(-stickR * 0.52, stickFaceY + stickR * 0.62, stickR * 0.9);
    brow.rotation.z = Math.PI / 2 + 0.3;
    brow.castShadow = true;
    face.add(brow);

    // Mouth: a closed, sweet smile on the candy's front face.
    const mouthY = discCenterY - discOuterR * 0.42;
    const mouth = new THREE.Mesh(
      new THREE.TorusGeometry(R * 0.15, R * 0.04, 8, 20, Math.PI * 0.85),
      toonMat({ color: ink, roughness: 0.3 })
    );
    mouth.name = 'lollipop_mouth';
    mouth.position.set(0, mouthY, discDepth / 2 + R * 0.015);
    mouth.rotation.z = Math.PI * 1.08;
    mouth.castShadow = true;
    face.add(mouth);

    for (const sx of [-1, 1]) {
      const blush = new THREE.Mesh(
        new THREE.SphereGeometry(R * 0.07, 10, 8),
        flatMat('#FF9EC4', { transparent: true, opacity: 0.5 })
      );
      blush.position.set(sx * discOuterR * 0.48, discCenterY - discOuterR * 0.12, discDepth / 2 + R * 0.005);
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
