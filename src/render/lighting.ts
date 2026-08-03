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
  // REVISED: an earlier version of this comment argued the key should do shaping,
  // NOT contrast, with most illumination coming from the fill below. That produced
  // measured value-std ~0.17 and a mean frame value of ~0.87 (reference cluster:
  // ~0.56-0.68) — the fill's two endpoint colours (sky 0xdcefff, ground 0xffc79a)
  // were both nearly full-bright, so the "fill" behaved like a flat ambient lift
  // regardless of surface orientation, and it was strong enough to blow bright
  // pastel top faces to clipped white — killing exactly the top-vs-side value
  // gradient that sells volume. The key is now the dominant, and the fill's ground
  // tone is deliberately darkened (see below) so it actually falls off with
  // orientation instead of just tinting a uniform pedestal.
  const key = new THREE.DirectionalLight(0xfff4de, 3.3);
  key.position.set(9, 16, 7);
  key.castShadow = true;
  key.shadow.mapSize.set(mapSize, mapSize);
  key.shadow.camera.near = 1;
  key.shadow.camera.far = 70;
  key.shadow.bias = -0.0006;
  key.shadow.normalBias = 0.035;
  // Blur radius tightened twice now (3 → 1.4 → 0.9): a critic blind-comparing us
  // directly against bs_01/04/06 still called our shadows "soft, centered blobs...
  // reads as blanket AO rather than a cast shadow" — the true directional shadow
  // needs a crisp enough edge that it doesn't get visually absorbed into the SSAO
  // contact halo (see the AO radius note in stage.ts, also pulled back this round).
  key.shadow.radius = 0.9;
  group.add(key);
  group.add(key.target);

  // The sky/bounce fill. Still keeps shadow sides coloured rather than grey — but
  // the ground tone is now a noticeably DARKER terracotta (value ~0.72 vs the sky's
  // ~1.0) rather than the previous near-white 0xffc79a. A hemisphere light only
  // creates value falloff across surface orientation if its two ends actually
  // differ in VALUE, not just hue; with both ends bright it lit every face almost
  // equally regardless of which way it faced, which is what read as "flat painted
  // blockout." Intensity is also down so it no longer wins the exposure fight
  // against the key on top faces.
  const fill = new THREE.HemisphereLight(0xd8ecff, 0x8c5830, 0.36);
  group.add(fill);

  // Cool rim from behind — the separation light that pops characters off the floor.
  const rim = new THREE.DirectionalLight(0xaddcff, 0.95);
  rim.position.set(-8, 7, -11);
  rim.castShadow = false;
  group.add(rim);

  // Flat lift so nothing ever reads as a dead black hole. Kept low — this is the
  // one light that truly ignores orientation, so any more than a whisper of it
  // re-introduces the flattening the fill rework above was meant to remove.
  const ambient = new THREE.AmbientLight(0xffffff, 0.04);
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
