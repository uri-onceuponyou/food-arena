/**
 * Hamburger weapon VFX.
 *
 * `Tomato` (Tomato Toss) is converted below as one of the two reference
 * implementations proving the `WeaponVfx` contract (`./types.ts`) is expressive
 * enough for real per-weapon identity: a wet, splattering fruit — round-but-squashed
 * in flight, a soft settling splatter (not crystalline shards/rings) on impact.
 * `waterbottle.ts`'s `Glass` conversion is the deliberately opposite case (hard,
 * angular, shattering) — read both together to see the contract flex.
 *
 * Weapon keys available (`game/rules.ts` -> `CHARACTERS.hamburger.weapons`):
 * `'Smash'`, `'Tomato'` (converted), `'Lettuce'`, `'Onion'`.
 */

import * as THREE from 'three';
import { CHARACTER_HEIGHT, CHARACTER_RADIUS } from '../../units';
import type { CharacterWeaponVfxMap, WeaponVfxCtx } from './types';

// ─────────────────────────────────────────────────────────────────────────────
// Tomato Toss — module-scope geometry/material singletons. Every Tomato projectile
// or impact reuses these; only the cheap Object3D/Mesh WRAPPER is created per spawn
// (see the `spawnTransient` doc in `types.ts` for why that split matters).
// ─────────────────────────────────────────────────────────────────────────────

const TOMATO_RADIUS = 0.11;

/**
 * ── SCALE: this file measured 19 px, and the reason is one shared unit ──────────
 *
 * `hamburger.ts` and `waterbottle.ts` are the two ORIGINAL reference conversions —
 * the oldest files in this directory, written before the rest of it adopted "express
 * every dimension against `CHARACTER_HEIGHT`". Both sized their impact and cast beats
 * against the PROJECTILE's own radius instead, which is the size of a tomato (0.11 m,
 * 5% of a 2.10 m character), not the size of a hit. Measured at shipped framing
 * (`tools/tmp/vfx_wcov.mjs`, 800x450 readback, peak slice):
 *
 *                        shipped   +nodepth   +scale4   verdict
 *     Tomato.cast            18       18       109      occlusion 1.00x — nothing is
 *     Tomato.impact          49       59       604      hiding it; it is 4% of a
 *                                                       character across and simply
 *                                                       sub-perceptual
 *
 * against the generic path's 735 (cast) / 3,102 (impact). So the repair here is SIZE,
 * and it is safe to make it one — the ablation proves nothing is buried, which is
 * exactly the check `docs/LESSONS.md` §1 demands before scaling anything up.
 *
 * `SPLAT_UNIT` is that missing unit. Everything the impact throws is expressed as a
 * multiple of it, so the splatter is sized against the THING IT HIT rather than
 * against the thing that hit it. The in-flight projectile keeps `TOMATO_RADIUS`,
 * because a tomato in flight genuinely is tomato-sized.
 */
const SPLAT_UNIT = CHARACTER_HEIGHT * 0.10; // 0.210 m

/** A plain sphere reads as a generic ball marker (exactly the thing this system
 * exists to move past) — a touch of vertical squash plus a stem is what reads as
 * FRUIT. */
const tomatoBodyGeo = new THREE.SphereGeometry(TOMATO_RADIUS, 12, 10);
tomatoBodyGeo.scale(1, 0.86, 1);
const tomatoStemGeo = new THREE.ConeGeometry(TOMATO_RADIUS * 0.32, TOMATO_RADIUS * 0.5, 6);
/** Flattened blob — shared by the mid-air highlight, every scattered splatter chunk
 * on impact, and the juice droplets, just at different scales. Doing double (triple)
 * duty like this is exactly the "one shared geometry, many cheap instances" pattern
 * this whole file leans on. */
const splatBlobGeo = new THREE.IcosahedronGeometry(TOMATO_RADIUS * 0.6, 0);
splatBlobGeo.scale(1, 0.4, 1);

const tomatoBodyMat = new THREE.MeshBasicMaterial({ color: '#E63946' });
const tomatoStemMat = new THREE.MeshBasicMaterial({ color: '#3E5C2B' });
// `depthWrite: false` on every transparent material in this file. THREE defaults it
// TRUE, so a `transparent: true` material still writes depth and silently occludes
// whatever is behind it — `docs/LESSONS.md` §1's "silent occluder" trap, which cost
// the last VFX round 7,852 px of splat and trail marks project-wide. It matters more
// here than it did: the impact chunks below just went up ~5x in size.
const tomatoHighlightMat = new THREE.MeshBasicMaterial({ color: '#FF9E9E', transparent: true, opacity: 0.55, depthWrite: false });

/**
 * Small fixed pool of material instances, cycled round-robin — the same discipline
 * `game/vfx.ts`'s own particle pool uses, scaled down for this file's own needs.
 * Exists because independently-fading simultaneous splatter chunks/droplets each
 * need their OWN `opacity`, which means their own `Material` instance; a pool avoids
 * `material.clone()`-ing (and therefore allocating) one on every single spawn.
 */
function materialPool<T extends THREE.Material>(size: number, build: () => T): () => T {
  const pool = Array.from({ length: size }, build);
  let i = 0;
  return () => pool[i++ % size];
}

const nextSplatMat = materialPool(18, () => new THREE.MeshBasicMaterial({ color: '#E63946', transparent: true, opacity: 0.85, depthWrite: false }));
const nextDropletMat = materialPool(20, () => new THREE.MeshBasicMaterial({ color: '#C21F32', transparent: true, opacity: 0.9, depthWrite: false }));
const nextPopMat = materialPool(6, () => new THREE.MeshBasicMaterial({
  color: '#FFD9C7', transparent: true, opacity: 0.95, blending: THREE.AdditiveBlending, depthWrite: false,
}));

function buildTomatoObject(color: string): THREE.Group {
  const group = new THREE.Group();
  const body = new THREE.Mesh(tomatoBodyGeo, tomatoBodyMat);
  group.add(body);
  const stem = new THREE.Mesh(tomatoStemGeo, tomatoStemMat);
  stem.position.set(0, TOMATO_RADIUS * 0.75, 0);
  group.add(stem);
  const highlight = new THREE.Mesh(splatBlobGeo, tomatoHighlightMat);
  highlight.scale.setScalar(0.55);
  highlight.position.set(TOMATO_RADIUS * 0.32, TOMATO_RADIUS * 0.28, TOMATO_RADIUS * 0.5);
  group.add(highlight);
  void color; // the body deliberately stays a fixed ripe-tomato red regardless of
  // ctx.color — Tomato Toss's colour is already '#E63946' in rules.ts, and a fruit's
  // "what it actually is" reads as more convincing with a fixed ripe hue than a
  // colour-matched-to-weapon tint the way the generic projectile sphere works.
  return group;
}

/** A single juice droplet, launched from `origin` toward `(dirX, dirZ)` at `speed`
 * and arcing down under gravity — used by both the mid-flight drip (`trail`) and the
 * impact splash (`impact`/`cast`).
 *
 * `sizeMul` exists because those two callers want genuinely different sizes and used
 * to share one: a drip shed by a tomato in flight is tomato-scaled (1.0), a droplet
 * flung off a hit is hit-scaled (see `SPLAT_UNIT`). At the shared size the impact's
 * five droplets spanned ~0.03 m each — about two pixels at shipped framing. */
function spawnJuiceDroplet(ctx: WeaponVfxCtx, origin: THREE.Vector3, dirX: number, dirZ: number, speed: number, sizeMul = 1): void {
  const mesh = new THREE.Mesh(splatBlobGeo, nextDropletMat());
  const scale = (0.3 + Math.random() * 0.25) * sizeMul;
  mesh.scale.setScalar(scale);
  mesh.position.copy(origin);
  const ox = origin.x, oy = origin.y, oz = origin.z;
  const vy = 1.1 + Math.random() * 1.3;
  const gravity = -5.5;
  const life = 0.32 + Math.random() * 0.16;
  ctx.spawnTransient(mesh, life, (t, elapsed) => {
    mesh.position.set(
      ox + dirX * speed * elapsed,
      oy + vy * elapsed + 0.5 * gravity * elapsed * elapsed,
      oz + dirZ * speed * elapsed,
    );
    mesh.scale.setScalar(scale * (1 - t * 0.35));
    (mesh.material as THREE.MeshBasicMaterial).opacity = 0.9 * (1 - t);
  });
}

export const hamburgerWeaponVfx: CharacterWeaponVfxMap = {
  Tomato: {
    projectile(ctx) {
      const obj = buildTomatoObject(ctx.color);
      obj.position.copy(ctx.position);
      return obj;
    },

    // Tumbles end-over-end with a soft squash pulse (a rigid spin would read as a
    // ball; the squash sells "soft") and periodically flings off a tiny drip behind
    // it — a tomato in flight should already look a little worse for wear.
    trail(ctx) {
      const obj = ctx.object;
      if (!obj) return;
      const dt = ctx.dt ?? 0;

      const spin = ((obj.userData.__spin as number | undefined) ?? 0) + dt * 8;
      obj.userData.__spin = spin;
      obj.rotation.x = spin;
      obj.rotation.z = Math.sin(spin * 0.6) * 0.25;
      const squash = 1 + Math.sin(spin * 2.2) * 0.09;
      obj.scale.set(1 / squash, squash, 1 / squash);

      const dripTimer = ((obj.userData.__dripTimer as number | undefined) ?? 0.05) - dt;
      if (dripTimer <= 0) {
        obj.userData.__dripTimer = 0.09 + Math.random() * 0.05;
        spawnJuiceDroplet(ctx, ctx.position, -ctx.direction.x * 0.5, -ctx.direction.z * 0.5, 0.3 + Math.random() * 0.25);
      } else {
        obj.userData.__dripTimer = dripTimer;
      }
    },

    // The splatter: a bright quick pop (still needs to read as a punchy hit, not a
    // slow ooze) + chunks flung outward that settle near the ground + juice droplets
    // arcing away. Zero shards, zero rings — the generic burst's whole shape
    // vocabulary is deliberately absent here.
    impact(ctx) {
      const origin = ctx.position;
      const sizeFactor = THREE.MathUtils.clamp(1 + ctx.damage * 0.05, 1, 2.2);
      /** Scale factor that turns a `splatBlobGeo` (radius `TOMATO_RADIUS * 0.6`)
       * into one `SPLAT_UNIT`. Every number below is in units, not in blob-radii. */
      const U = SPLAT_UNIT / (TOMATO_RADIUS * 0.6);

      // The contact pop: 0.7 -> 2.4 units of RADIUS, so ~0.15 -> 0.50 m before the
      // damage factor. Was 0.6 -> 2.1 BLOB radii = 0.04 -> 0.14 m.
      //
      // Two passes to get here, and the first one is the instructive one: scaling to
      // 0.34-1.15 units moved this hook from 49 px to 169 — still under the 300 px
      // floor, because `splatBlobGeo` is flattened to 0.4 in Y, so a blob of radius r
      // presents an ellipse only 0.8r tall and its delivered AREA grows far slower
      // than a sprite's. The generic burst it is being judged against opens with a
      // 1.4-3.2 m camera-facing SPRITE. A flat splat has to be physically wider than
      // a round flash to read at the same distance; that is the cost of the shape
      // vocabulary, not a reason to abandon it.
      const pop = new THREE.Mesh(splatBlobGeo, nextPopMat());
      pop.position.copy(origin);
      pop.scale.setScalar(0.7 * U);
      ctx.spawnTransient(pop, 0.18, (t) => {
        pop.scale.setScalar(THREE.MathUtils.lerp(0.7, 2.4, t) * U * sizeFactor);
        (pop.material as THREE.MeshBasicMaterial).opacity = 0.9 * (1 - t);
      });

      const chunkCount = 7;
      // Chunks START on the rim of the target's footprint, not at the hit point.
      // Occlusion here measured a mild 1.20x rather than the puddle splash's 14x, so
      // this is insurance rather than a repair — but it is free insurance, and a
      // splatter that appears at the EDGE of what it hit is also just more correct
      // than one that appears inside it.
      const rim = CHARACTER_RADIUS * 0.45;
      for (let i = 0; i < chunkCount; i++) {
        const ang = (i / chunkCount) * Math.PI * 2 + Math.random() * 0.5;
        const dist = rim + (0.5 + Math.random() * 0.75) * sizeFactor;
        const chunk = new THREE.Mesh(splatBlobGeo, nextSplatMat());
        // 0.55 -> 0.95 units of radius per chunk, i.e. 0.12-0.20 m before the damage
        // factor — a 0.32-0.56 m wide splat mark on a 2.10 m character. Was 0.5-0.9
        // BLOB radii = 0.033-0.06 m, about three pixels at shipped framing.
        const startScale = (0.55 + Math.random() * 0.40) * U * sizeFactor;
        const ox = origin.x + Math.cos(ang) * rim;
        const oy = origin.y;
        const oz = origin.z + Math.sin(ang) * rim;
        chunk.position.set(ox, oy, oz);
        chunk.rotation.y = Math.random() * Math.PI * 2;
        const targetX = origin.x + Math.cos(ang) * dist;
        const targetZ = origin.z + Math.sin(ang) * dist;
        // Settle down near the floor — a splatter falls, it doesn't hang at chest
        // height where the hit itself landed.
        const groundY = oy - 0.9;
        ctx.spawnTransient(chunk, 0.55 + Math.random() * 0.2, (t) => {
          const e = 1 - Math.pow(1 - t, 3);
          chunk.position.set(
            THREE.MathUtils.lerp(ox, targetX, e),
            THREE.MathUtils.lerp(oy, groundY, Math.min(1, e * 1.3)),
            THREE.MathUtils.lerp(oz, targetZ, e),
          );
          chunk.scale.setScalar(startScale * (1 - t * 0.3));
          (chunk.material as THREE.MeshBasicMaterial).opacity = 0.85 * (1 - Math.pow(t, 1.5));
        });
      }

      for (let i = 0; i < 5; i++) {
        const ang = Math.random() * Math.PI * 2;
        spawnJuiceDroplet(
          ctx, origin, Math.cos(ang), Math.sin(ang), 1.3 + Math.random() * 1.1,
          U,
        );
      }
    },

    // A quick squeeze-and-fling cue at the attacker: a small blob that pops then
    // flattens, plus a couple of forward-flicked droplets — reads as "about to throw
    // something wet", not the generic pale circular flash every other weapon shares.
    cast(ctx) {
      // Same unit as `impact` — see `SPLAT_UNIT`. The squeeze blob was 0.02-0.076 m
      // across, which is where the 18 px came from; `game/vfx.ts`'s subordinate muzzle
      // anchor now carries the "a weapon fired" beat, so this only has to be big
      // enough to read as HER squeeze on top of it, not to carry the cast alone.
      const U = SPLAT_UNIT / (TOMATO_RADIUS * 0.6);
      const blob = new THREE.Mesh(splatBlobGeo, nextPopMat());
      const mat = blob.material as THREE.MeshBasicMaterial;
      mat.color.set(ctx.color);
      blob.position.copy(ctx.position);
      blob.scale.setScalar(0.16 * U);
      ctx.spawnTransient(blob, 0.15, (t) => {
        blob.scale.setScalar(THREE.MathUtils.lerp(0.16, 0.62, t) * U);
        mat.opacity = 0.9 * (1 - t);
      });

      for (let i = 0; i < 3; i++) {
        const jitter = (Math.random() - 0.5) * 0.6;
        spawnJuiceDroplet(
          ctx, ctx.position,
          ctx.direction.x + jitter, ctx.direction.z + jitter,
          0.9 + Math.random() * 0.5,
          U * 0.35,
        );
      }
    },
  },
};
