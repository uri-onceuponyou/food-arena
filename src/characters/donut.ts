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
import { ChibiRig } from './rig';

const GLAZE = PALETTE.glaze;      // #FF9EC4
const DOUGH = '#F0C070';
const DOUGH_DARK = '#D9A253';

const SPRINKLE_COLORS = ['#E63946', '#7CB518', '#FFC93C', '#7C4DFF', '#2E86D8', '#FFFFFF'];

export class DonutCharacter extends BaseCharacter {
  private rig: ChibiRig;
  private sprinkles: THREE.Object3D[] = [];

  constructor(def: CharacterDef) {
    super(def);

    this.rig = new ChibiRig({
      palette: {
        limb: DOUGH,
        hand: GLAZE,
        foot: DOUGH_DARK,
        torso: DOUGH,
        limbRoughness: 0.72,
      },
      proportions: { headFraction: 0.47 },
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
    for (let i = 0; i < 26; i++) {
      const a = (i / 26) * Math.PI * 2 + (i % 3) * 0.35;
      const rr = ringR + (((i * 37) % 100) / 100 - 0.5) * tubeR * 0.85;
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

    this.buildFace(R);

    outlineGroup(this.root);
    this.collectFlashTargets();
    this.rig.restPose();
  }

  /**
   * Face features sit around the hole on the front of the ring. Built as real
   * geometry with depth rather than flat decals — `types.ts` convention #6 was
   * relaxed precisely because flat stickers were capping quality.
   */
  private buildFace(R: number): void {
    const face = this.rig.joints.face;
    const ink = PALETTE.ink;

    const eyeGeo = new THREE.SphereGeometry(R * 0.115, 16, 14);
    const eyeMat = toonMat({ color: ink, roughness: 0.25 });
    for (const sx of [-1, 1]) {
      const eye = new THREE.Mesh(eyeGeo, eyeMat);
      eye.position.set(sx * R * 0.36, R * 0.30, -R * 0.16);
      eye.scale.set(1, 1.15, 0.6);
      eye.castShadow = true;
      face.add(eye);

      // Specular catchlight — the single cheapest trick for making eyes feel alive.
      const glint = new THREE.Mesh(new THREE.SphereGeometry(R * 0.038, 10, 8), flatMat('#ffffff'));
      glint.position.set(sx * R * 0.36 - R * 0.035, R * 0.345, -R * 0.10);
      glint.userData.noOutline = true;
      face.add(glint);
    }

    // Crooked smile — asymmetric on purpose, per Donut's described personality.
    const smile = new THREE.Mesh(
      new THREE.TorusGeometry(R * 0.20, R * 0.035, 8, 20, Math.PI * 0.85),
      toonMat({ color: ink, roughness: 0.3 })
    );
    smile.position.set(R * 0.03, -R * 0.30, -R * 0.14);
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
  }

  /**
   * The rig owns all body motion, so the base class's whole-body squash/lean would
   * fight it. Suppressed here; `onUpdate` drives the rig instead.
   */
  protected applyBaseMotion(): void {}
}
