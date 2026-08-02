/**
 * Ground-truth VFX layer: projectiles, splats and Donut's sticky trail marks.
 *
 * The sim owns all of this data (`MatchState.projectiles` / `.splats` / `.trailMarks`)
 * — this module's only job is to keep one THREE.Mesh in sync with each live entry by
 * id, reusing geometry/materials across every instance rather than allocating per
 * frame. `sync()` is meant to be called once per frame with the latest `MatchState`.
 */

import * as THREE from 'three';
import type { FighterRole, MatchState, Projectile, Splat, TrailMark } from './state';
import { SPLAT_RADIUS, TRAIL } from './rules';
import { groundPos, wu } from '../units';
import { flatMat } from '../render/toon';

/** Metres off the ground projectiles fly at — roughly chest height on the cast. */
const PROJECTILE_HEIGHT = 0.5;
/** Ground-decal layer heights, kept above the arena's own decal layer (0.15m) so
 * splats/trail marks never z-fight the kitchen floor's puddles/scorch marks. */
const SPLAT_Y = 0.17;
const TRAIL_Y = 0.19;

/**
 * Keep `pool` (id -> mesh) in sync with `items` (id-bearing sim records): create a
 * mesh for any new id via `create`, refresh every live mesh via `update`, and remove
 * meshes whose id no longer appears in `items`.
 */
function syncPool<T extends { id: number }>(
  pool: Map<number, THREE.Object3D>,
  group: THREE.Group,
  items: readonly T[],
  create: (item: T) => THREE.Object3D,
  update: (obj: THREE.Object3D, item: T) => void,
): void {
  const seen = new Set<number>();
  for (const item of items) {
    seen.add(item.id);
    let obj = pool.get(item.id);
    if (!obj) {
      obj = create(item);
      group.add(obj);
      pool.set(item.id, obj);
    }
    update(obj, item);
  }
  for (const [id, obj] of pool) {
    if (!seen.has(id)) {
      group.remove(obj);
      pool.delete(id);
    }
  }
}

export class VfxLayer {
  private readonly group = new THREE.Group();
  private readonly projectilePool = new Map<number, THREE.Object3D>();
  private readonly splatPool = new Map<number, THREE.Object3D>();
  private readonly trailPool = new Map<number, THREE.Object3D>();
  private readonly materialCache = new Map<string, THREE.Material>();

  // Shared geometry — every instance of a given kind reuses the same buffers.
  private readonly projectileGeo = new THREE.SphereGeometry(wu(10), 10, 8);
  private readonly splatGeo = new THREE.CircleGeometry(wu(SPLAT_RADIUS), 20);
  private readonly trailGeo = new THREE.CircleGeometry(wu(TRAIL.radius), 16);

  // Splat/trail records don't carry a source colour (see `state.ts`), so these use one
  // fixed tint each rather than trying to recover the weapon that made them.
  private readonly splatMat = flatMat('#C2461F', { transparent: true, opacity: 0.55 });
  private readonly trailMats: Record<FighterRole, THREE.Material> = {
    player: flatMat('#FF9EC4', { transparent: true, opacity: 0.6 }),
    enemy: flatMat('#FFD27A', { transparent: true, opacity: 0.6 }),
  };

  constructor(scene: THREE.Scene) {
    this.group.name = 'vfx_layer';
    scene.add(this.group);
  }

  sync(state: MatchState): void {
    syncPool<Projectile>(
      this.projectilePool,
      this.group,
      state.projectiles,
      (p) => new THREE.Mesh(this.projectileGeo, this.materialFor(p.color)),
      (obj, p) => {
        const mesh = obj as THREE.Mesh;
        mesh.material = this.materialFor(p.color);
        const pos = groundPos(p.x, p.y);
        mesh.position.set(pos.x, PROJECTILE_HEIGHT, pos.z);
      },
    );

    syncPool<Splat>(
      this.splatPool,
      this.group,
      state.splats,
      () => {
        const mesh = new THREE.Mesh(this.splatGeo, this.splatMat);
        mesh.rotation.x = -Math.PI / 2;
        return mesh;
      },
      (obj, s) => {
        const pos = groundPos(s.x, s.y);
        obj.position.set(pos.x, SPLAT_Y, pos.z);
      },
    );

    syncPool<TrailMark>(
      this.trailPool,
      this.group,
      state.trailMarks,
      (t) => {
        const mesh = new THREE.Mesh(this.trailGeo, this.trailMats[t.ownerRole]);
        mesh.rotation.x = -Math.PI / 2;
        return mesh;
      },
      (obj, t) => {
        const pos = groundPos(t.x, t.y);
        obj.position.set(pos.x, TRAIL_Y, pos.z);
      },
    );
  }

  /** Drop every tracked mesh — call on match restart so stale VFX doesn't linger. */
  clear(): void {
    for (const pool of [this.projectilePool, this.splatPool, this.trailPool]) {
      for (const obj of pool.values()) this.group.remove(obj);
      pool.clear();
    }
  }

  dispose(): void {
    this.clear();
    this.projectileGeo.dispose();
    this.splatGeo.dispose();
    this.trailGeo.dispose();
    this.splatMat.dispose();
    Object.values(this.trailMats).forEach((m) => m.dispose());
    this.materialCache.forEach((m) => m.dispose());
    this.materialCache.clear();
  }

  private materialFor(color: string): THREE.Material {
    let mat = this.materialCache.get(color);
    if (!mat) {
      mat = flatMat(color);
      this.materialCache.set(color, mat);
    }
    return mat;
  }
}
