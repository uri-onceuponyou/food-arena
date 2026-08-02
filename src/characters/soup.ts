/**
 * Soup (Epic).
 *
 * STUB — built on the shared ChibiRig so it renders and animates correctly, but the
 * food mass is still a placeholder sphere. See `donut.ts` for the reference
 * implementation of this pattern.
 *
 * Personality guide (NOT a literal spec — silhouette readability wins):
 *   Wide bowl with rising steam, grey steam-coloured eyes, no mouth
 */

import * as THREE from 'three';
import { BaseCharacter, type AnimContext } from './types';
import type { CharacterDef } from '../game/rules';
import { PALETTE } from '../game/rules';
import { toonMat, flatMat, outlineGroup } from '../render/toon';
import { ChibiRig } from './rig';

export class SoupCharacter extends BaseCharacter {
  private rig: ChibiRig;

  constructor(def: CharacterDef) {
    super(def);

    this.rig = new ChibiRig({
      palette: { limb: '#E8A33D', hand: '#E8792A', foot: '#C46A20' },
    });
    this.body.add(this.rig.joints.root);
    this.head = this.rig.joints.head;

    const R = this.rig.headRadius;
    const mass = new THREE.Mesh(
      new THREE.SphereGeometry(R, 24, 20),
      toonMat({ color: '#E8A33D', roughness: 0.7 })
    );
    mass.name = 'soup_mass_STUB';
    mass.castShadow = true;
    mass.receiveShadow = true;
    this.rig.joints.head.add(mass);

    const face = this.rig.joints.face;
    for (const sx of [-1, 1]) {
      const eye = new THREE.Mesh(
        new THREE.SphereGeometry(R * 0.12, 14, 12),
        toonMat({ color: PALETTE.ink, roughness: 0.25 })
      );
      eye.position.set(sx * R * 0.32, R * 0.12, -R * 0.18);
      eye.scale.set(1, 1.1, 0.6);
      eye.castShadow = true;
      face.add(eye);
      const glint = new THREE.Mesh(new THREE.SphereGeometry(R * 0.035, 8, 8), flatMat('#ffffff'));
      glint.position.set(sx * R * 0.32 - R * 0.03, R * 0.16, -R * 0.12);
      glint.userData.noOutline = true;
      face.add(glint);
    }

    outlineGroup(this.root);
    this.collectFlashTargets();
    this.rig.restPose();
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
