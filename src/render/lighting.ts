/**
 * Lighting rig.
 *
 * Three-point setup tuned for the toon look: a warm directional key that casts the
 * only shadow, a cool hemisphere fill that keeps shadows coloured rather than grey,
 * and a cool back-rim that separates characters from the floor. This rig is shared
 * by the game and every isolated preview so a character judged in preview looks
 * identical in-game.
 */

import * as THREE from 'three';

export interface LightingRig {
  group: THREE.Group;
  key: THREE.DirectionalLight;
  fill: THREE.HemisphereLight;
  rim: THREE.DirectionalLight;
  ambient: THREE.AmbientLight;
  /** Re-aim the shadow frustum around a world position (follows the action). */
  focus(x: number, z: number, radius?: number): void;
}

export function createLighting(opts?: { shadowRadius?: number; shadowMapSize?: number }): LightingRig {
  const group = new THREE.Group();
  group.name = 'lighting';

  const shadowRadius = opts?.shadowRadius ?? 22;
  const mapSize = opts?.shadowMapSize ?? 2048;

  // Warm key — the sun. Slightly off-axis so shadows fall down-right.
  const key = new THREE.DirectionalLight(0xfff2d6, 2.6);
  key.position.set(9, 16, 7);
  key.castShadow = true;
  key.shadow.mapSize.set(mapSize, mapSize);
  key.shadow.camera.near = 1;
  key.shadow.camera.far = 70;
  key.shadow.bias = -0.0006;
  key.shadow.normalBias = 0.035;
  key.shadow.radius = 3;
  group.add(key);
  group.add(key.target);

  // Cool sky / warm bounce. Keeps shadow sides tinted instead of muddy.
  const fill = new THREE.HemisphereLight(0xbfd9ff, 0xffb774, 0.85);
  group.add(fill);

  // Cool rim from behind — the separation light. This is what makes toon characters
  // pop off the floor in Brawl Stars.
  const rim = new THREE.DirectionalLight(0x9fd0ff, 1.15);
  rim.position.set(-8, 7, -11);
  rim.castShadow = false;
  group.add(rim);

  // Tiny flat lift so nothing ever reads pure black.
  const ambient = new THREE.AmbientLight(0xffffff, 0.22);
  group.add(ambient);

  const focus = (x: number, z: number, radius = shadowRadius) => {
    const cam = key.shadow.camera;
    cam.left = -radius;
    cam.right = radius;
    cam.top = radius;
    cam.bottom = -radius;
    cam.updateProjectionMatrix();
    key.target.position.set(x, 0, z);
    key.position.set(x + 9, 16, z + 7);
    key.target.updateMatrixWorld();
  };
  focus(0, 0, shadowRadius);

  return { group, key, fill, rim, ambient, focus };
}
