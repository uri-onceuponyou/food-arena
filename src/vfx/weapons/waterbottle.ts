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
import { CHARACTER_HEIGHT, CHARACTER_RADIUS } from '../../units';
import type { CharacterWeaponVfxMap } from './types';

// ─────────────────────────────────────────────────────────────────────────────
// Glass Shards — module-scope geometry/material singletons, same discipline as
// `hamburger.ts`'s Tomato Toss (see that file's top-of-block comment for why).
// ─────────────────────────────────────────────────────────────────────────────

const SHARD_RADIUS = 0.09;

/**
 * ── The same defect as `hamburger.ts`, and for the same reason ─────────────────
 *
 * These two files are the original reference conversions and predate the rest of the
 * directory's "every dimension is a fraction of `CHARACTER_HEIGHT`" discipline. Both
 * sized their beats against the PROJECTILE's own radius. Measured at shipped framing
 * (`tools/tmp/vfx_wcov.mjs`, 800x450 readback, peak slice):
 *
 *                        shipped   +nodepth   +scale4   occl    size
 *     Glass.cast             21        21       174    1.00x    8.3x
 *     Glass.impact           78       132       753    1.69x    9.7x
 *
 * against the generic path's 735 / 3,102. The cast is purely SIZE (occlusion 1.00x —
 * four slivers 0.15 m tall). The impact is BOTH: a 1.69x occlusion ratio means ~41%
 * of it never reached the screen, because eleven shards and the crack flash all spawn
 * at `ctx.position` — which is the hit point, i.e. INSIDE the body that was hit — and
 * have to fly out of a silhouette whose visible half-width is ~0.55 m before they can
 * be seen at all. That is `docs/LESSONS.md` §1's repeat offender ("start outside the
 * silhouette, not inside it"), and scaling this up without also moving it out would
 * have produced a bigger invisible effect.
 *
 * So: shards start on the RIM (`IMPACT_RIM`) and are sized in `GLASS_UNIT`s.
 */
const GLASS_UNIT = CHARACTER_HEIGHT * 0.075; // 0.158 m
/**
 * The impact's own unit, larger than the cast's.
 *
 * Both beats used to share `GLASS_UNIT`, and re-measuring after the rim fix showed
 * why they should not (`tools/tmp/vfx_wcov.mjs`, 800x450 readback, peak slice, against
 * a 300 px floor and the generic impact's 3,098 px):
 *
 *                     shipped  +nodepth  +scale4   occl    size
 *     Glass.cast          459       636    8,978   1.39x   19.6x   ✓ over floor
 *     Glass.impact        264       264    2,935   1.00x   11.1x   ✗ under floor
 *
 * The rim move did its job — occlusion is 1.00x, i.e. NOTHING is hidden any more, so
 * `docs/LESSONS.md` §1's precondition for scaling ("prove it is not buried first") is
 * met and size is the only remaining cause. And unlike every other under-floor row in
 * the roster, Glass Shards is a ONE-pellet weapon (`rules.ts`: no `pellets` field, 7
 * damage, `effect: 'stun'`) — Burrito's Swarm at 113 px fires four at once and Soup's
 * Splash at 312 px fires three, so their per-pellet numbers composite on screen and
 * this one does not. 264 px is what the player actually gets, for the roster's only
 * stun application.
 *
 * 0.10 rather than 0.075 is 1.33x linear ~ 1.78x area on a scatter that measured
 * essentially area-proportional (4x linear -> 11.1x delivered).
 *
 * The CAST keeps `GLASS_UNIT`: it clears the floor already, and `game/vfx.ts`'s
 * subordinate muzzle anchor is deliberately the load-bearing part of a cast beat.
 */
const IMPACT_UNIT = CHARACTER_HEIGHT * 0.10; // 0.210 m
/** Radius the shatter is born on. `CHARACTER_RADIUS` is the sim's collision radius
 * (1.05 m); 0.5 of it puts the shards at the edge of the visible silhouette rather
 * than at its centre, without throwing them so wide they stop reading as this hit. */
const IMPACT_RIM = CHARACTER_RADIUS * 0.5;
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

// `depthWrite: false` — THREE defaults it true even on a `transparent` material, so
// without it every shard silently occludes whatever is behind it
// (`docs/LESSONS.md` §1's silent-occluder trap).
const nextShardMat = materialPool(24, () => new THREE.MeshBasicMaterial({ color: '#BFEFFF', transparent: true, opacity: 0.8, depthWrite: false }));
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
      /** Scale that turns one `shardGeo` (built at `SHARD_RADIUS`) into one
       * `IMPACT_UNIT`. Everything below is in units, not in shard-radii. */
      const U = IMPACT_UNIT / SHARD_RADIUS;

      // The crack flash: 0.30 -> 0.72 units (~0.11 -> 0.26 m of radius on a 2.10 m
      // character). Was 2 -> 7 GLINT radii = 0.043 -> 0.151 m.
      const flash = new THREE.Mesh(glintGeo, nextFlashMat());
      flash.position.copy(origin);
      flash.scale.setScalar(1.25 * U);
      ctx.spawnTransient(flash, 0.14, (t) => {
        flash.scale.setScalar(THREE.MathUtils.lerp(1.25, 3.0, t) * U);
        (flash.material as THREE.MeshBasicMaterial).opacity = 0.95 * (1 - t);
      });

      const sizeFactor = THREE.MathUtils.clamp(1 + ctx.damage * 0.06, 1, 2.4);
      const shardCount = 11;
      for (let i = 0; i < shardCount; i++) {
        // Evenly spaced plus jitter rather than fully random: eleven uniform draws
        // clump, and a clumped shatter starting on a rim reads as one blob leaving
        // one side rather than as glass breaking.
        const ang = (i / shardCount) * Math.PI * 2 + Math.random() * 0.5;
        const speed = (1.6 + Math.random() * 2.4) * sizeFactor;
        const mat = nextShardMat();
        mat.color.set(ctx.color);
        const shard = new THREE.Mesh(shardGeo, mat);
        // 0.42 -> 0.85 units per sliver (was 0.4-0.95 SHARD radii).
        const scale = (0.42 + Math.random() * 0.43) * U * sizeFactor;
        shard.scale.setScalar(scale);
        // Born on the rim of the silhouette, not at the hit point inside it.
        const ox = origin.x + Math.cos(ang) * IMPACT_RIM;
        const oy = origin.y;
        const oz = origin.z + Math.sin(ang) * IMPACT_RIM;
        shard.position.set(ox, oy, oz);
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
      // 2.3x the old linear size. `game/vfx.ts`'s subordinate muzzle anchor now
      // carries the "a weapon fired" beat for every bespoke cast, so this only has to
      // read as GLASS on top of it — but at 0.15-0.90 cluster scale the four slivers
      // spanned ~0.15 m total and delivered 21 px, which is not "quiet", it is absent.
      const U = GLASS_UNIT / SHARD_RADIUS;
      const cluster = buildShardCluster(ctx.color);
      cluster.position.copy(ctx.position);
      cluster.scale.setScalar(0.35 * U);
      ctx.spawnTransient(cluster, 0.16, (t) => {
        const grow = Math.min(1, t * 2.2);
        const shrink = t > 0.55 ? 1 - (t - 0.55) * 2.2 : 1;
        cluster.scale.setScalar(THREE.MathUtils.clamp(0.35 + grow * 0.75, 0.1, 1.15) * U * Math.max(0, shrink));
        cluster.rotation.y = t * 5;
      });

      const flash = new THREE.Mesh(glintGeo, nextFlashMat());
      flash.position.copy(ctx.position);
      flash.scale.setScalar(0.8 * U);
      ctx.spawnTransient(flash, 0.12, (t) => {
        flash.scale.setScalar(THREE.MathUtils.lerp(0.8, 1.9, t) * U);
        (flash.material as THREE.MeshBasicMaterial).opacity = 0.9 * (1 - t);
      });
    },
  },
};
