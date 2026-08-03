/**
 * Water Bottle weapon VFX.
 *
 * `Glass` (Glass Shards) is converted below as the second of the two reference
 * implementations proving the `WeaponVfx` contract (`./types.ts`) is expressive
 * enough for real per-weapon identity — deliberately the OPPOSITE case from
 * `hamburger.ts`'s `Tomato`: hard, angular, brittle shards that shatter, instead of
 * a soft fruit that splatters. The weapon already carries `effect: 'stun'`
 * (`game/rules.ts`), which drives `game/vfx.ts`'s existing generic orbiting-star
 * status telegraph untouched by this file — `impact()` below only needed to add the
 * instant "crack" moment, not re-implement the ongoing stun indicator.
 *
 * Weapon keys available (`game/rules.ts` -> `CHARACTERS.waterbottle.weapons`):
 * `'Spray'`, `'Glass'` (converted), `'Cap'`, `'Mega'`.
 */

import * as THREE from 'three';
import type { CharacterWeaponVfxMap } from './types';

// ─────────────────────────────────────────────────────────────────────────────
// Glass Shards — module-scope geometry/material singletons, same discipline as
// `hamburger.ts`'s Tomato Toss (see that file's top-of-block comment for why).
// ─────────────────────────────────────────────────────────────────────────────

const SHARD_RADIUS = 0.09;
/** An octahedron stretched into a thin sliver — angular and faceted, the opposite
 * silhouette language from Tomato's rounded blob geometry. This IS the "hard and
 * brittle" identity; everything else in this file is built to move debris shaped
 * like this convincingly. */
const shardGeo = new THREE.OctahedronGeometry(SHARD_RADIUS, 0);
shardGeo.scale(0.55, 1.7, 0.55);
const glintGeo = new THREE.SphereGeometry(SHARD_RADIUS * 0.24, 6, 6);

/** Small fixed pool of material instances, cycled round-robin — see the identical
 * helper (and its doc comment) in `hamburger.ts`; independently-fading simultaneous
 * shards each need their own `opacity`/`color`, hence a pool instead of one shared
 * material or a `.clone()` per spawn. */
function materialPool<T extends THREE.Material>(size: number, build: () => T): () => T {
  const pool = Array.from({ length: size }, build);
  let i = 0;
  return () => pool[i++ % size];
}

const nextShardMat = materialPool(24, () => new THREE.MeshBasicMaterial({ color: '#BFEFFF', transparent: true, opacity: 0.8 }));
const nextGlintMat = materialPool(8, () => new THREE.MeshBasicMaterial({
  color: '#FFFFFF', transparent: true, opacity: 1, blending: THREE.AdditiveBlending, depthWrite: false,
}));
const nextFlashMat = materialPool(6, () => new THREE.MeshBasicMaterial({
  color: '#EAFBFF', transparent: true, opacity: 0.95, blending: THREE.AdditiveBlending, depthWrite: false,
}));

/** A small loose cluster of shards around the origin, plus one bright glint sprite
 * (its own child, tagged via `userData.__glint` so `trail()` can find and animate it
 * without touching the shards). Used for both the in-flight projectile and the cast
 * wind-up puff. */
function buildShardCluster(color: string): THREE.Group {
  const group = new THREE.Group();
  const count = 4;
  for (let i = 0; i < count; i++) {
    const mat = nextShardMat();
    mat.color.set(color);
    const shard = new THREE.Mesh(shardGeo, mat);
    const ang = (i / count) * Math.PI * 2;
    shard.position.set(
      Math.cos(ang) * SHARD_RADIUS * 0.5,
      (Math.random() - 0.5) * SHARD_RADIUS * 0.6,
      Math.sin(ang) * SHARD_RADIUS * 0.5,
    );
    shard.rotation.set(Math.random() * Math.PI, Math.random() * Math.PI, Math.random() * Math.PI);
    shard.scale.setScalar(0.6 + Math.random() * 0.5);
    group.add(shard);
  }
  const glint = new THREE.Mesh(glintGeo, nextGlintMat());
  group.add(glint);
  group.userData.__glint = glint;
  return group;
}

export const waterbottleWeaponVfx: CharacterWeaponVfxMap = {
  Glass: {
    projectile(ctx) {
      const obj = buildShardCluster(ctx.color);
      obj.position.copy(ctx.position);
      return obj;
    },

    // Each shard tumbles independently (glass doesn't spin as one rigid unit the way
    // a solid ball would) and a bright glint flares on and off as a facet catches
    // the light — the "catching light" cue is what a flat/soft weapon like Tomato
    // has no equivalent of.
    trail(ctx) {
      const obj = ctx.object;
      if (!obj) return;
      const dt = ctx.dt ?? 0;
      const glint = obj.userData.__glint as THREE.Mesh | undefined;

      let shardIndex = 0;
      for (const child of obj.children) {
        if (child === glint) continue;
        const speed = 2 + shardIndex * 0.9;
        child.rotation.x += dt * speed;
        child.rotation.y += dt * speed * 0.75;
        shardIndex++;
      }

      if (glint) {
        const mat = glint.material as THREE.MeshBasicMaterial;
        mat.opacity = Math.max(0, mat.opacity - dt * 3.2);
        const timer = ((obj.userData.__glintTimer as number | undefined) ?? 0) - dt;
        if (timer <= 0) {
          obj.userData.__glintTimer = 0.14 + Math.random() * 0.3;
          mat.opacity = 1;
          glint.position.set(
            (Math.random() - 0.5) * SHARD_RADIUS,
            (Math.random() - 0.5) * SHARD_RADIUS,
            (Math.random() - 0.5) * SHARD_RADIUS,
          );
        } else {
          obj.userData.__glintTimer = timer;
        }
      }
    },

    // The shatter: an instant cold-white crack flash (not the generic burst's warm
    // gold pop), then a wide scatter of angular debris flung outward AND downward
    // (glass falls fast, it doesn't drift) — sharp, brief, brittle, in contrast to
    // Tomato's soft settling splatter.
    impact(ctx) {
      const origin = ctx.position;

      const flash = new THREE.Mesh(glintGeo, nextFlashMat());
      flash.position.copy(origin);
      flash.scale.setScalar(2);
      ctx.spawnTransient(flash, 0.14, (t) => {
        flash.scale.setScalar(THREE.MathUtils.lerp(2, 7, t));
        (flash.material as THREE.MeshBasicMaterial).opacity = 0.95 * (1 - t);
      });

      const sizeFactor = THREE.MathUtils.clamp(1 + ctx.damage * 0.06, 1, 2.4);
      const shardCount = 11;
      for (let i = 0; i < shardCount; i++) {
        const ang = Math.random() * Math.PI * 2;
        const speed = (1.6 + Math.random() * 2.4) * sizeFactor;
        const mat = nextShardMat();
        mat.color.set(ctx.color);
        const shard = new THREE.Mesh(shardGeo, mat);
        const scale = (0.4 + Math.random() * 0.55) * sizeFactor;
        shard.scale.setScalar(scale);
        shard.position.copy(origin);
        const ox = origin.x, oy = origin.y, oz = origin.z;
        const vy = 1.1 + Math.random() * 1.6;
        const gravity = -9;
        const spinX = (Math.random() - 0.5) * 22;
        const spinY = (Math.random() - 0.5) * 22;
        ctx.spawnTransient(shard, 0.38 + Math.random() * 0.2, (t, elapsed) => {
          shard.position.set(
            ox + Math.cos(ang) * speed * elapsed,
            oy + vy * elapsed + 0.5 * gravity * elapsed * elapsed,
            oz + Math.sin(ang) * speed * elapsed,
          );
          shard.rotation.x = elapsed * spinX;
          shard.rotation.y = elapsed * spinY;
          shard.scale.setScalar(scale * (1 - t * 0.25));
          (shard.material as THREE.MeshBasicMaterial).opacity = 0.85 * (1 - t);
        });
      }
    },

    // A quick glinting puff at the attacker as the shards materialise/wind up —
    // angular and cold, distinct from the generic soft circular flash (and from
    // Tomato's soft red squeeze cue).
    cast(ctx) {
      const cluster = buildShardCluster(ctx.color);
      cluster.position.copy(ctx.position);
      cluster.scale.setScalar(0.15);
      ctx.spawnTransient(cluster, 0.16, (t) => {
        const grow = Math.min(1, t * 2.2);
        const shrink = t > 0.55 ? 1 - (t - 0.55) * 2.2 : 1;
        cluster.scale.setScalar(THREE.MathUtils.clamp(0.15 + grow * 0.75, 0.05, 1) * Math.max(0, shrink));
        cluster.rotation.y = t * 5;
      });

      const flash = new THREE.Mesh(glintGeo, nextFlashMat());
      flash.position.copy(ctx.position);
      flash.scale.setScalar(1.2);
      ctx.spawnTransient(flash, 0.12, (t) => {
        flash.scale.setScalar(THREE.MathUtils.lerp(1.2, 3, t));
        (flash.material as THREE.MeshBasicMaterial).opacity = 0.9 * (1 - t);
      });
    },
  },
};
