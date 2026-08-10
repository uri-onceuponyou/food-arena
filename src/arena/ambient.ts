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

/**
 * ⚠️ NO `renderOrder` HERE, AND THAT IS A MEASUREMENT, NOT AN OVERSIGHT.
 *
 * `M.dust` is `transparent: true` with `depthWrite` left true (`src/arena/shared.ts`), the
 * silent-occluder class. `2f05202` priced it and found the obvious fix BACKWARDS: with no
 * depth write the mote at `renderOrder 0` is drawn first in the transparent pass and then
 * simply PAINTED OVER by any decal drawn after it, so `depthWrite:false` alone ERASES the
 * mote and shipped is 3.4x-5.4x closer to correct than that. It routed the other half
 * here — "the dust needs `renderOrder`, not the flag" — because the flag lives in
 * `shared.ts` and the mesh lives in this file.
 *
 * Measured before acting on it (`tools/tmp/hw_ord.mjs`, one page load, `rAF` frozen,
 * `pot_south`, `--vfx` worst case, 3 loads; per-block self-pair 0 px and RETURN drift
 * 0 px). Distance from the reference arm that clears the flag AND raises the order, as
 * SUMMED channel delta — arm `d8` is the only one shippable from THIS file, i.e.
 * `renderOrder` raised with the flag left as it is:
 *
 *     load           0        1        2      (0 and 2 ablate at 37 px and 15 px — the
 *     shipped      110      652      152       field is unseeded, so on most loads no
 *     flag only     39      463       78       mote overlaps anything and every arm is
 *     flag + order   0       64        0       near-blind. Load 1 is the informative one)
 *     ORDER ONLY     0      589        0
 *
 * `renderOrder` alone buys **652 -> 589, i.e. 9.7%**, of a quantity the same sweep already
 * priced at <= 12 px of 1,440,000 (0.0008% of frame). It does not remove the rejection, it
 * MOVES it. The two knobs are separable and are NOT additive, so each is quoted against the
 * arm that differs from the reference in exactly one of them: `d8` (order raised, flag
 * kept) is **589** from correct, and that residue is the depth write rejecting everything
 * drawn AFTER `renderOrder` 8 — `slowTint` at 8, VFX sprites at 10, stars at 11 — which no
 * `renderOrder` reachable from this file can help, because drawing after the sprites means
 * painting over sprites that are in front of the mote. Only the flag fixes that layer.
 *
 * 🔴 AND THE PROBE'S REFERENCE ORDER OF 8 IS NOT A SHIPPING CANDIDATE. `src/arena/fogRing.ts`
 * puts the fog CURTAIN at 7 and the fog CANOPY at 8. Dust is scattered over the WHOLE
 * playfield, so most motes are outside the safe radius at any moment; at order 8 they would
 * composite on top of the fog of war as a field of sparkles over the curtain that exists to
 * hide the arena. Any order low enough to stay under the fog (<= 6) is also under the VFX
 * rings, so it does not reach the layer that owns 90% of the cost either.
 *
 * → The complete fix is BOTH halves, the half that matters is `M.dust`'s flag in
 * `src/arena/shared.ts`, and half of it landed here alone would buy 9.7% of 0.0008% while
 * making the item read as closed. Left alone deliberately; documented at the declaration so
 * the next sweep does not re-derive it. If `M.dust` ever loses `depthWrite`, THIS is where
 * the matching `renderOrder` goes, and it must be <= 6.
 */
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
    //
    // ⚠️ THIS LOOP REQUIRES ONE MATERIAL PER WISP AND, UNTIL THIS PASS, DID NOT HAVE ONE.
    // `buildPot` built a single `steamMat` and handed the same instance to all three
    // plumes, so the three `mat.opacity` writes below — one per plume, off a per-plume
    // phase offset `i * 0.5` — were three writes to the SAME uniform in the same frame.
    // The last one won and the pot pulsed as one blob on wisp 2's phase; the offset that
    // exists to stagger them was computed, assigned and discarded. Nothing here looked
    // wrong, and that is the point: `wisp.position` and `wisp.scale` are per-OBJECT and
    // were always correct, so only the ONE property that lives on the material collapsed.
    // Fixed at the source (`buildPot` now calls `flatMat` per iteration, as the hazard
    // ring's wisps below always did). If a future pass pools these again to save two
    // materials, THIS loop silently stops working.
    //
    // ⚠️ The standing corollary: NEVER READ INITIAL STATE OFF A POOLED MATERIAL. A spawn
    // helper doing `opacity: wisp.material.opacity` here inherits whatever the last plume
    // faded to, which is a number between 0 and 0.55 that depends on the frame it ran on.
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
    //
    // These seven have always had one material each — which is why `buildPot`'s three
    // sharing one was invisible: the two loops read identically and only one of them
    // worked. `buildHazardGround` now says so at the `flatMat` call, so the per-iteration
    // allocation is not "tidied up" into a pool by someone reading it as waste.
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
