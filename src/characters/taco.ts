/**
 * Taco (Rare).
 *
 * Built on the shared ChibiRig — see `donut.ts` for the reference implementation of
 * this pattern. The rig supplies torso, arms, hands, legs, feet and all motion; this
 * file authors only the food mass on `rig.joints.head`, the face and a palette.
 *
 * Identity is fixed by `rules.ts`: Taco, Rare rarity, Filling Toss / Onion Bomb /
 * Double Toss. The written description ("trapezoid shell, jagged crimped top edge,
 * face floats outside the shell to the side") is a personality guide rather than a
 * literal spec, per the brief — but the trapezoid-with-crimped-top IS kept as the
 * silhouette landmark, since it is exactly the shape that reads as "hard-shell taco"
 * at a glance. The floating face is realised as a second, smaller fold of the same
 * toasted shell fused onto the main shell's edge rather than a literally detached
 * head: it still reads as "the face lives outside the shell, off to the side" (the
 * eyes/mouth are nowhere near the shell's own front face), but a chunk of it is
 * physically embedded in the main mass so it doesn't read as a floating defect.
 */

import * as THREE from 'three';
import { BaseCharacter, type AnimContext } from './types';
import type { CharacterDef } from '../game/rules';
import { PALETTE } from '../game/rules';
import { toonMat, glossyMat, flatMat, outlineGroup } from '../render/toon';
import { ChibiRig } from './rig';

// ── Palette ──────────────────────────────────────────────────────────────────
const SHELL = '#F2A73E';       // toasted hard-shell gold — bright, saturated
const SHELL_DARK = '#D07F1E';  // shadow / crease tone
const POD = '#F7BB57';         // the face-pod fold — a shade warmer/lighter than the shell
const MEAT = PALETTE.patty;        // '#6B3E26'
const MEAT_DARK = PALETTE.pattyDark; // '#4E2C1B'
const TOMATO = PALETTE.tomato;       // '#E63946'
const LETTUCE = '#8FCB1E';
const LETTUCE_DARK = '#6FA112';
const ONION = '#C9A2E0';       // ties visually to the Onion Bomb projectile colour

/**
 * Trapezoid shell outline: a narrow crease at the bottom (the fold) widening to an
 * open mouth at the top, with a jagged zigzag baked directly into the top edge. Baking
 * the crimp into the outline (rather than gluing separate teeth on afterward) means
 * the whole shell — crimp included — is one solid mesh that can never read as toppings
 * floating detached from the surface they should sit on.
 */
function tacoShellShape(halfWBot: number, halfWTop: number, yBot: number, yTop: number, teeth: number, toothH: number): THREE.Shape {
  const shape = new THREE.Shape();
  shape.moveTo(-halfWBot, yBot);
  shape.lineTo(-halfWTop, yTop);
  const span = halfWTop * 2;
  for (let i = 0; i <= teeth; i++) {
    const x = -halfWTop + (span * i) / teeth;
    const peak = i % 2 === 0;
    const h = peak ? toothH * (0.7 + 0.45 * Math.abs(Math.sin(i * 1.9))) : toothH * 0.24;
    shape.lineTo(x, yTop + h);
  }
  shape.lineTo(halfWTop, yTop);
  shape.lineTo(halfWBot, yBot);
  shape.lineTo(-halfWBot, yBot);
  return shape;
}

export class TacoCharacter extends BaseCharacter {
  private rig: ChibiRig;
  private fillings: THREE.Object3D[] = [];
  private fillingBaseRotZ: number[] = [];

  constructor(def: CharacterDef) {
    super(def);

    this.rig = new ChibiRig({
      palette: {
        limb: SHELL,
        hand: PALETTE.onion, // cream — contrast against the golden shell, per the reference bar
        foot: SHELL_DARK,
        torso: SHELL,
        limbRoughness: 0.8,
      },
      proportions: { headFraction: 0.48 },
    });
    this.body.add(this.rig.joints.root);
    this.head = this.rig.joints.head;

    const R = this.rig.headRadius;
    const head = this.rig.joints.head;

    // ── Materials ────────────────────────────────────────────────────────────
    // Every filling gets its own roughness so the fold reads as bread + seared meat +
    // wet vegetables rather than one glossy plastic shader repeated in different hues.
    const shellMat = toonMat({ color: SHELL, roughness: 0.8 });        // crisp, dry, fried shell
    const podMat = toonMat({ color: POD, roughness: 0.76 });
    const meatMat = toonMat({ color: MEAT, roughness: 0.55 });         // seared, faintly greasy
    const meatDarkMat = toonMat({ color: MEAT_DARK, roughness: 0.5 });
    const tomatoMat = glossyMat({ color: TOMATO, roughness: 0.18 });   // wettest surface on the model
    const lettuceMatA = toonMat({ color: LETTUCE, roughness: 0.6 });   // leafy, satin not shiny
    const lettuceMatB = toonMat({ color: LETTUCE_DARK, roughness: 0.6 });
    const onionMat = glossyMat({ color: ONION, roughness: 0.32 });     // moist, faintly translucent

    // ── Shell ────────────────────────────────────────────────────────────────
    // A wide, jagged-topped trapezoid — the "hard shell taco" read at any distance.
    // Given real thickness (not a flat cutout) so it survives edge-on camera angles.
    const halfWBot = R * 0.16;
    const halfWTop = R * 0.95;
    const yBot = -R * 0.92;
    const yTopBase = R * 0.58;
    const shellDepth = R * 0.62;

    const shellShape = tacoShellShape(halfWBot, halfWTop, yBot, yTopBase, 9, R * 0.3);
    const shellGeo = new THREE.ExtrudeGeometry(shellShape, {
      depth: shellDepth, bevelEnabled: false, curveSegments: 1,
    });
    shellGeo.translate(0, 0, -shellDepth / 2);
    shellGeo.computeVertexNormals();
    const shell = new THREE.Mesh(shellGeo, shellMat);
    shell.name = 'taco_shell';
    shell.castShadow = true;
    shell.receiveShadow = true;
    head.add(shell);
    const shellFrontZ = shellDepth / 2;

    // ── Fillings: meat, tomato, lettuce, a wink of onion ────────────────────────
    // Piled onto the shell's front face in its upper half so they read as spilling
    // out the open top, each mesh embedded (overlapping into the shell surface) so
    // nothing floats detached from the shell it sits on.
    const meatSpots: Array<[number, number, THREE.Material]> = [
      [-0.55, 0.18, meatMat], [-0.14, 0.42, meatDarkMat], [0.3, 0.22, meatMat],
      [0.6, -0.02, meatDarkMat], [0.0, -0.08, meatMat], [-0.32, -0.14, meatDarkMat],
    ];
    for (const [fx, fy, mat] of meatSpots) {
      const blob = new THREE.Mesh(new THREE.SphereGeometry(R * 0.22, 12, 10), mat);
      blob.name = 'taco_meat';
      blob.scale.set(1.15, 0.85, 0.65);
      blob.position.set(fx * halfWTop, yTopBase * fy + R * 0.05, shellFrontZ + R * 0.02);
      blob.castShadow = true;
      blob.receiveShadow = true;
      head.add(blob);
      this.fillings.push(blob);
      this.fillingBaseRotZ.push(blob.rotation.z);
    }

    const tomatoSpots: Array<[number, number]> = [
      [-0.68, 0.62], [-0.28, 0.78], [0.12, 0.7], [0.5, 0.6], [0.72, 0.34], [-0.5, 0.4],
    ];
    for (const [fx, fyFrac] of tomatoSpots) {
      const bit = new THREE.Mesh(new THREE.BoxGeometry(R * 0.16, R * 0.16, R * 0.16), tomatoMat);
      bit.name = 'taco_tomato';
      bit.position.set(fx * halfWTop, yTopBase * fyFrac, shellFrontZ + R * 0.1);
      bit.rotation.set(0.3, 0.5, 0.2 + fx);
      bit.castShadow = true;
      bit.receiveShadow = true;
      head.add(bit);
      this.fillings.push(bit);
      this.fillingBaseRotZ.push(bit.rotation.z);
    }

    const lettuceSpots: Array<[number, number, number]> = [
      [-0.82, 0.95, 0.3], [-0.5, 1.08, -0.15], [-0.18, 1.15, 0.25], [0.16, 1.1, -0.2],
      [0.48, 1.0, 0.2], [0.78, 0.9, -0.25], [-0.66, 0.78, 0.1], [0.62, 0.68, -0.1],
    ];
    for (let i = 0; i < lettuceSpots.length; i++) {
      const [fx, fyFrac, tilt] = lettuceSpots[i];
      const shred = new THREE.Mesh(new THREE.CapsuleGeometry(R * 0.045, R * 0.26, 4, 6), i % 2 === 0 ? lettuceMatA : lettuceMatB);
      shred.name = 'taco_lettuce';
      shred.position.set(fx * halfWTop, yTopBase * fyFrac, shellFrontZ + R * 0.08);
      shred.rotation.set(Math.PI / 2 + tilt * 0.6, 0, tilt);
      shred.castShadow = true;
      shred.receiveShadow = true;
      head.add(shred);
      this.fillings.push(shred);
      this.fillingBaseRotZ.push(shred.rotation.z);
    }

    // A few onion slivers tucked into the meat — ties visually to the Onion Bomb
    // ability's projectile colour.
    const onionSpots: Array<[number, number]> = [[-0.2, 0.3], [0.35, 0.44], [0.05, 0.02]];
    for (const [fx, fyFrac] of onionSpots) {
      const sliver = new THREE.Mesh(new THREE.TorusGeometry(R * 0.1, R * 0.028, 6, 12, Math.PI * 1.3), onionMat);
      sliver.name = 'taco_onion';
      sliver.position.set(fx * halfWTop, yTopBase * fyFrac, shellFrontZ + R * 0.14);
      sliver.rotation.set(0.4, 0.7, fx);
      sliver.castShadow = true;
      sliver.receiveShadow = true;
      head.add(sliver);
      this.fillings.push(sliver);
      this.fillingBaseRotZ.push(sliver.rotation.z);
    }

    // ── Face pod ─────────────────────────────────────────────────────────────
    // A second, smaller fold of shell fused onto the main shell's right edge —
    // roughly a third of it embedded inside the shell's own volume, the rest
    // protruding, so the face landmark is unmistakably attached rather than
    // literally floating, while still reading as its own separate lobe living
    // outside the main shell's front face.
    const podR = R * 0.4;
    const podCenter = new THREE.Vector3(R * 0.5, R * 0.06, shellFrontZ + R * 0.14);
    const pod = new THREE.Mesh(new THREE.SphereGeometry(podR, 20, 16), podMat);
    pod.name = 'taco_face_pod';
    pod.scale.set(1, 1.04, 0.92);
    pod.position.copy(podCenter);
    pod.castShadow = true;
    pod.receiveShadow = true;
    head.add(pod);

    // `face` normally rides the head's own front surface; nothing in the rig's
    // per-frame animate() ever touches its transform, so re-anchoring it onto the
    // pod is safe and keeps every feature below in simple pod-local coordinates.
    this.rig.joints.face.position.copy(podCenter);
    this.buildFace(podR);

    outlineGroup(this.root);
    this.collectFlashTargets();
    this.rig.restPose();
  }

  /**
   * Oversized, slightly asymmetric eyes plus a crooked grin — a cheeky, spice-loving
   * personality that matches a taco throwing filling and onion bombs. Built as real
   * shaded geometry with depth, not flat decals, per the relaxed face convention.
   */
  private buildFace(podR: number): void {
    const face = this.rig.joints.face;
    const ink = PALETTE.ink;
    const eyeMat = toonMat({ color: ink, roughness: 0.25 });
    const browMat = toonMat({ color: SHELL_DARK, roughness: 0.7 });

    const eyeSizes: [number, number] = [0.38, 0.46]; // left, right — right eye a touch wider open
    for (const sx of [-1, 1]) {
      const size = sx < 0 ? eyeSizes[0] : eyeSizes[1];
      const eye = new THREE.Mesh(new THREE.SphereGeometry(podR * size, 16, 14), eyeMat);
      eye.position.set(sx * podR * 0.4, podR * 0.14, podR * 0.7);
      eye.scale.set(1, 1.2, 0.6);
      eye.castShadow = true;
      face.add(eye);

      const glint = new THREE.Mesh(new THREE.SphereGeometry(podR * 0.13, 10, 8), flatMat('#ffffff'));
      glint.position.set(sx * podR * 0.4 - podR * 0.1, podR * 0.24, podR * 0.86);
      glint.userData.noOutline = true;
      face.add(glint);
    }

    // One eyebrow cocked up over the left eye — a mischievous, "about to throw
    // something spicy" look.
    const brow = new THREE.Mesh(
      new THREE.CapsuleGeometry(podR * 0.05, podR * 0.34, 4, 8),
      browMat
    );
    brow.name = 'brow';
    brow.position.set(-podR * 0.42, podR * 0.5, podR * 0.68);
    brow.rotation.z = Math.PI / 2 + 0.35;
    brow.castShadow = true;
    face.add(brow);

    // Crooked, wide-open grin.
    const smile = new THREE.Mesh(
      new THREE.TorusGeometry(podR * 0.42, podR * 0.09, 8, 20, Math.PI * 0.8),
      toonMat({ color: ink, roughness: 0.3 })
    );
    smile.position.set(podR * 0.04, -podR * 0.42, podR * 0.6);
    smile.rotation.set(0, 0, Math.PI * 1.08);
    smile.castShadow = true;
    face.add(smile);
  }

  protected onUpdate(ctx: AnimContext): void {
    this.rig.animate({
      elapsed: this.elapsed,
      move01: ctx.moveSpeed01,
      attack01: this.attackT >= 0 ? this.attackT / this.attackDuration : -1,
      hit01: this.hitT >= 0 ? this.hitT / 0.26 : -1,
      dead01: this.deathT >= 0 ? this.deathT / 0.75 : -1,
    });

    // A faint jiggle through the loose fillings while running — cheap life, matches
    // the run bounce cadence from rig.ts (10.5 rad/s). Set relative to each filling's
    // OWN rest rotation every frame (never accumulated) so it settles cleanly back to
    // rest at move=0 instead of drifting.
    const move = THREE.MathUtils.clamp(ctx.moveSpeed01, 0, 1);
    const wobble = Math.sin(this.elapsed * 10.5) * 0.05 * move;
    for (let i = 0; i < this.fillings.length; i++) {
      this.fillings[i].rotation.z = this.fillingBaseRotZ[i] + wobble * (i % 2 === 0 ? 1 : -1);
    }
  }

  /** The rig owns all body motion; the base class's whole-body pass would fight it. */
  protected applyBaseMotion(): void {}
}
