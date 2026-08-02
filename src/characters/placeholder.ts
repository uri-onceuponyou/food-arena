/**
 * Placeholder character — a blockout stand-in.
 *
 * Exists so the preview harness, camera and screenshot pipeline are testable before
 * the real models land, and so a half-finished roster never crashes the game. Any
 * character still rendering as this shape is NOT done.
 */

import * as THREE from 'three';
import { BaseCharacter } from './types';
import type { CharacterDef } from '../game/rules';
import { toonMat, flatMat, outlineGroup, roundedBox, RAMP_CHARACTER } from '../render/toon';
import { CHARACTER_HEIGHT } from '../units';

export class PlaceholderCharacter extends BaseCharacter {
  constructor(def: CharacterDef) {
    super(def);

    const h = CHARACTER_HEIGHT * 0.72;
    const bodyMesh = new THREE.Mesh(
      roundedBox(1.05, h, 0.9, 0.26, 5),
      toonMat({ color: '#b9a7c9', ramp: RAMP_CHARACTER() })
    );
    bodyMesh.name = 'placeholder_body';
    bodyMesh.position.y = h / 2;
    bodyMesh.castShadow = true;
    bodyMesh.receiveShadow = true;
    this.body.add(bodyMesh);

    const headGroup = new THREE.Group();
    headGroup.position.y = h * 0.74;
    this.body.add(headGroup);
    this.head = headGroup;

    for (const sx of [-1, 1]) {
      const eye = new THREE.Mesh(new THREE.SphereGeometry(0.1, 16, 16), flatMat('#1a1224'));
      eye.name = 'placeholder_eye__no_outline';
      eye.userData.noOutline = true;
      eye.position.set(sx * 0.2, 0, 0.44);
      headGroup.add(eye);
    }

    outlineGroup(this.root, 0.03);
    this.collectFlashTargets();
  }
}
