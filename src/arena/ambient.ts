/**
 * Ambient per-frame dressing — this module owns everything that moves on its own,
 * without any player input: the pot's rising/fading steam wisps, its gently pulsing
 * bubbles, the flickering burner flame, the hazard ring's breathing glow + drifting
 * heat-shimmer wisps, and the slow-drifting dust motes scattered across the whole
 * playfield.
 *
 * The STATIC geometry for the pot (`PotAssembly`) and the hazard ring (`HazardGround`)
 * is built in `./hazards.ts` — this module only reads/mutates the mesh references
 * those builders hand back, every frame, via `createAmbientUpdate`. Dust motes have
 * no other owner, so both their construction (`buildDustField`) and their animation
 * live here together.
 */

import * as THREE from 'three';
import { wu } from '../units';
import { ARENA_W, ARENA_H, noOutline, type Materials } from './shared';
import type { PotAssembly, HazardGround } from './hazards';

// ─────────────────────────────────────────────────────────────────────────────
// Ambient dust motes — a single InstancedMesh, positions drift and wrap per-frame.
// ─────────────────────────────────────────────────────────────────────────────

export interface DustField {
  mesh: THREE.InstancedMesh;
  base: THREE.Vector3[];
  phase: number[];
}

export function buildDustField(M: Materials, count: number): DustField {
  const geo = new THREE.SphereGeometry(0.025, 6, 6);
  const im = new THREE.InstancedMesh(geo, M.dust, count);
  im.castShadow = false;
  im.receiveShadow = false;
  noOutline(im);
  const base: THREE.Vector3[] = [];
  const phase: number[] = [];
  const m4 = new THREE.Matrix4();
  for (let i = 0; i < count; i++) {
    const x = wu(Math.random() * ARENA_W);
    const z = wu(Math.random() * ARENA_H);
    const y = 0.4 + Math.random() * 1.6;
    base.push(new THREE.Vector3(x, y, z));
    phase.push(Math.random() * Math.PI * 2);
    m4.makeTranslation(x, y, z);
    im.setMatrixAt(i, m4);
  }
  im.instanceMatrix.needsUpdate = true;
  return { mesh: im, base, phase };
}

/**
 * Builds a per-arena-instance `update(elapsed)` closure, scoped over its own reusable
 * scratch Matrix4/Quaternion/Vector3 (avoids a per-frame allocation for the dust
 * field's instance-matrix rebuild, same as the original inline `update()` did) plus
 * the three live assemblies it animates.
 */
export function createAmbientUpdate(pot: PotAssembly, hazardGround: HazardGround, dust: DustField) {
  const m4 = new THREE.Matrix4();
  const q = new THREE.Quaternion();
  const s = new THREE.Vector3(1, 1, 1);
  const v = new THREE.Vector3();

  return function updateAmbient(elapsed: number): void {
    // Steam: rise, fade, loop.
    const cycle = 1.6;
    pot.steam.forEach((wisp, i) => {
      const t = ((elapsed + i * 0.5) % cycle) / cycle;
      const baseY = wisp.userData.baseY as number;
      wisp.position.y = baseY + t * 0.5;
      const mat = wisp.material as THREE.MeshBasicMaterial;
      mat.opacity = 0.55 * (1 - t) * (t < 0.15 ? t / 0.15 : 1);
      wisp.scale.setScalar(0.7 + t * 0.6);
    });

    // Bubbling pot: gentle scale pulse, offset per bubble.
    pot.bubbles.forEach((b, i) => {
      const t = elapsed * 2.2 + i * 1.7;
      const k = 0.75 + Math.abs(Math.sin(t)) * 0.5;
      b.scale.setScalar(k);
    });

    // Flickering burner flame.
    const flicker = 0.75 + Math.sin(elapsed * 18) * 0.12 + Math.sin(elapsed * 41 + 1.3) * 0.08;
    pot.flame.scale.set(1, THREE.MathUtils.clamp(flicker, 0.5, 1.15), 1);
    pot.flameCore.scale.set(1, THREE.MathUtils.clamp(flicker * 1.08, 0.5, 1.2), 1);

    // Hazard boundary: a slow breathing pulse on the glow halo, plus heat wisps
    // rising and fading off the ring — the "shimmer" that keeps the danger zone
    // reading as active heat rather than a painted mark.
    hazardGround.glowMat.opacity = 0.75 + Math.sin(elapsed * 2.6) * 0.2;
    const wispCycle = 1.9;
    hazardGround.wisps.forEach((wisp, i) => {
      const t = ((elapsed + (wisp.userData.phase as number)) % wispCycle) / wispCycle;
      const baseY = wisp.userData.baseY as number;
      wisp.position.y = baseY + t * 0.7;
      const mat = wisp.material as THREE.MeshBasicMaterial;
      mat.opacity = 0.3 * (1 - t) * (t < 0.2 ? t / 0.2 : 1);
      wisp.scale.setScalar(0.6 + t * 0.7);
      void i;
    });

    // Slow-drifting dust motes: gentle circular drift + vertical bob, wrapped.
    const bounds = { w: wu(ARENA_W), h: wu(ARENA_H) };
    for (let i = 0; i < dust.base.length; i++) {
      const b = dust.base[i];
      const ph = dust.phase[i];
      const x = ((b.x + Math.sin(elapsed * 0.05 + ph) * 0.6 + Math.cos(elapsed * 0.03) * bounds.w * 0.02) % bounds.w + bounds.w) % bounds.w;
      const z = ((b.z + Math.cos(elapsed * 0.04 + ph) * 0.6) % bounds.h + bounds.h) % bounds.h;
      const y = b.y + Math.sin(elapsed * 0.6 + ph) * 0.15;
      v.set(x, y, z);
      m4.compose(v, q, s);
      dust.mesh.setMatrixAt(i, m4);
    }
    dust.mesh.instanceMatrix.needsUpdate = true;
  };
}
