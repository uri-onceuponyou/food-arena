/**
 * Ground-truth VFX layer: projectiles, splats, Donut's sticky trail marks, and every
 * ability/game-feel effect (muzzle flashes, melee sweeps, impact bursts, status
 * telegraphs, deaths, Lollipop's Giant Lollipop).
 *
 * The sim owns projectiles/splats/trailMarks — `sync()` keeps one THREE.Mesh per live
 * entry by id (see `syncPool`). Everything else here is TRANSIENT: one-shot effects
 * the sim has no notion of, driven by explicit `spawn*` calls from `match.ts`'s event
 * handling, advanced each frame by `updateEffects(dt)`. Every transient effect is
 * backed by a small fixed-size pool of pre-built THREE objects (Sprites/Meshes with
 * cached geometry/materials) that get reconfigured and reused — nothing is allocated
 * per frame or per spawn, matching the discipline the projectile/splat/trail pools
 * already established.
 */

import * as THREE from 'three';
import type { FighterRole, MatchState, Projectile, Splat, TrailMark, Vec2 } from './state';
import { SPLAT_RADIUS, TRAIL } from './rules';
import { CHARACTER_HEIGHT, groundPos, wu } from '../units';
import { flatMat } from '../render/toon';

/** Metres off the ground projectiles fly at — roughly chest height on the cast. */
const PROJECTILE_HEIGHT = 0.5;
/** Ground-decal layer heights, kept above the arena's own decal layer (0.15m) so
 * splats/trail marks never z-fight the kitchen floor's puddles/scorch marks. */
const SPLAT_Y = 0.17;
const TRAIL_Y = 0.19;

// ── Ability VFX layer heights/sizes (metres) ────────────────────────────────────
/** Chest-ish height for impact flashes/shards, so hits read as landing ON the
 * character rather than at their feet. */
const IMPACT_HEIGHT = 1.15;
const CAST_HEIGHT = 1.25;
/** Above splats/trail marks so melee sweeps and impact rings always render on top. */
const GROUND_VFX_Y = 0.24;
const STATUS_RING_Y = 0.3;
const STUN_STAR_HEIGHT = CHARACTER_HEIGHT * 1.04;
const STUN_STAR_RADIUS = 0.42;

const WHITE = new THREE.Color('#ffffff');
/** Deep desaturated ink, matching `render/toon.ts`'s outline colour (kept as a local
 * literal rather than an import — this module has no other reason to depend on the
 * character outline module). Mixing ground-plane fills toward this instead of using
 * a weapon's raw (often pale/warm) colour at low opacity is what keeps melee arcs and
 * AOE fills legible against the arena's bright cream floor. */
const INK = new THREE.Color('#241a33');

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

const easeOutCubic = (t: number): number => 1 - Math.pow(1 - t, 3);

/** Soft radial glow, generated once and shared by every particle sprite (flashes,
 * shards, heal sparkle). A hard-edged square sprite would read as a blocky decal;
 * this is what lets additive particles look like actual light instead of confetti. */
function buildRadialGlowTexture(): THREE.CanvasTexture {
  const size = 64;
  const canvas = document.createElement('canvas');
  canvas.width = size;
  canvas.height = size;
  const ctx = canvas.getContext('2d')!;
  const grad = ctx.createRadialGradient(size / 2, size / 2, 0, size / 2, size / 2, size / 2);
  grad.addColorStop(0, 'rgba(255,255,255,1)');
  grad.addColorStop(0.4, 'rgba(255,255,255,0.85)');
  grad.addColorStop(1, 'rgba(255,255,255,0)');
  ctx.fillStyle = grad;
  ctx.fillRect(0, 0, size, size);
  const tex = new THREE.CanvasTexture(canvas);
  tex.needsUpdate = true;
  return tex;
}

/**
 * Flat filled wedge (pie-slice), apex at the local origin, spanning `coneDeg`
 * symmetrically about local +Z, out to `radiusM`. `coneDeg = 360` degenerates into a
 * full disc — exactly what Lollipop's Giant Lollipop (cone: 360) needs. Built in the
 * XZ plane directly (not rotated from a Y-up ring) so a mesh using this geometry can
 * be oriented purely by `rotation.y = atan2(facing.x, facing.y)`, matching the same
 * convention `match.ts` uses for character facing.
 */
function buildWedgeGeometry(radiusM: number, coneDeg: number): THREE.BufferGeometry {
  const half = THREE.MathUtils.degToRad(THREE.MathUtils.clamp(coneDeg, 1, 360)) / 2;
  const segments = Math.max(8, Math.round(coneDeg / 8));
  const positions: number[] = [0, 0, 0];
  for (let i = 0; i <= segments; i++) {
    const a = -half + (i / segments) * half * 2;
    positions.push(Math.sin(a) * radiusM, 0, Math.cos(a) * radiusM);
  }
  const indices: number[] = [];
  for (let i = 1; i < segments + 1; i++) indices.push(0, i, i + 1);
  const geo = new THREE.BufferGeometry();
  geo.setAttribute('position', new THREE.Float32BufferAttribute(positions, 3));
  geo.setIndex(indices);
  geo.computeVertexNormals();
  return geo;
}

// ─────────────────────────────────────────────────────────────────────────────
// Transient particle pool — flashes, shards, heal sparkle. Every slot owns its own
// Sprite + SpriteMaterial (created once, mutated forever) so spawning never allocates.
// ─────────────────────────────────────────────────────────────────────────────

interface ParticleSlot {
  sprite: THREE.Sprite;
  mat: THREE.SpriteMaterial;
  active: boolean;
  life: number;
  maxLife: number;
  vx: number;
  vy: number;
  vz: number;
  gravity: number;
  startScale: number;
  endScale: number;
  startOpacity: number;
  endOpacity: number;
  fadeEase: number;
}

const PARTICLE_POOL_SIZE = 64;
const WEDGE_POOL_SIZE = 6;
const RING_POOL_SIZE = 10;

interface WedgeSlot {
  mesh: THREE.Mesh;
  mat: THREE.MeshBasicMaterial;
  active: boolean;
  life: number;
  maxLife: number;
  startOpacity: number;
}

interface RingSlot {
  mesh: THREE.Mesh;
  mat: THREE.MeshBasicMaterial;
  active: boolean;
  life: number;
  maxLife: number;
  startScale: number;
  targetScale: number;
  startOpacity: number;
}

interface StatusVisual {
  slowRing: THREE.Mesh;
  stunStars: THREE.Sprite[];
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

  // ── Ability VFX pools ──────────────────────────────────────────────────────
  private readonly glowTex = buildRadialGlowTexture();
  private readonly particles: ParticleSlot[] = [];
  private readonly wedges: WedgeSlot[] = [];
  private readonly rings: RingSlot[] = [];
  private readonly wedgeGeoCache = new Map<string, THREE.BufferGeometry>();
  private readonly ringUnitGeo = new THREE.RingGeometry(0.8, 1, 40);

  private readonly statusByRole: Record<FighterRole, StatusVisual>;

  constructor(scene: THREE.Scene) {
    this.group.name = 'vfx_layer';
    scene.add(this.group);

    for (let i = 0; i < PARTICLE_POOL_SIZE; i++) {
      const mat = new THREE.SpriteMaterial({
        map: this.glowTex,
        color: 0xffffff,
        transparent: true,
        opacity: 0,
        depthWrite: false,
        blending: THREE.AdditiveBlending,
      });
      const sprite = new THREE.Sprite(mat);
      sprite.visible = false;
      sprite.renderOrder = 10;
      this.group.add(sprite);
      this.particles.push({
        sprite, mat, active: false, life: 0, maxLife: 1,
        vx: 0, vy: 0, vz: 0, gravity: 0,
        startScale: 1, endScale: 1, startOpacity: 1, endOpacity: 0, fadeEase: 1,
      });
    }

    for (let i = 0; i < WEDGE_POOL_SIZE; i++) {
      const mat = new THREE.MeshBasicMaterial({
        color: 0xffffff, transparent: true, opacity: 0,
        side: THREE.DoubleSide, depthWrite: false,
      });
      const mesh = new THREE.Mesh(buildWedgeGeometry(0.01, 10), mat);
      mesh.visible = false;
      mesh.renderOrder = 5;
      this.group.add(mesh);
      this.wedges.push({ mesh, mat, active: false, life: 0, maxLife: 1, startOpacity: 0.6 });
    }

    for (let i = 0; i < RING_POOL_SIZE; i++) {
      const mat = new THREE.MeshBasicMaterial({
        color: 0xffffff, transparent: true, opacity: 0,
        side: THREE.DoubleSide, depthWrite: false,
        blending: THREE.AdditiveBlending,
      });
      const mesh = new THREE.Mesh(this.ringUnitGeo, mat);
      mesh.rotation.x = -Math.PI / 2;
      mesh.visible = false;
      mesh.renderOrder = 6;
      this.group.add(mesh);
      this.rings.push({ mesh, mat, active: false, life: 0, maxLife: 1, startScale: 0.1, targetScale: 1, startOpacity: 0.9 });
    }

    const buildStatusVisual = (): StatusVisual => {
      const ringMat = new THREE.MeshBasicMaterial({
        color: '#6FE0FF', transparent: true, opacity: 0,
        side: THREE.DoubleSide, depthWrite: false,
      });
      const slowRing = new THREE.Mesh(new THREE.RingGeometry(0.62, 0.86, 28), ringMat);
      slowRing.rotation.x = -Math.PI / 2;
      slowRing.visible = false;
      slowRing.renderOrder = 4;
      this.group.add(slowRing);

      const stunStars: THREE.Sprite[] = [];
      for (let i = 0; i < 3; i++) {
        const mat = new THREE.SpriteMaterial({
          map: this.glowTex, color: '#FFE75E', transparent: true, opacity: 0,
          depthWrite: false, blending: THREE.AdditiveBlending,
        });
        const star = new THREE.Sprite(mat);
        star.scale.set(0.34, 0.34, 1);
        star.visible = false;
        star.renderOrder = 11;
        this.group.add(star);
        stunStars.push(star);
      }
      return { slowRing, stunStars };
    };

    this.statusByRole = { player: buildStatusVisual(), enemy: buildStatusVisual() };
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
        // Egg's Hatch!: once the projectile has arrived and is pecking in place
        // (`p.arrived`), pulse its scale on each peck interval instead of just
        // sitting still, so the repeated hits read as an actual attack rather than
        // a ball resting on the target.
        if (p.arrived) {
          const peckT = (p.peckTimer ?? 0) / 500;
          const pulse = 1 + Math.sin(peckT * Math.PI) * 0.5;
          mesh.scale.setScalar(pulse);
        } else {
          mesh.scale.setScalar(1);
        }
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
        // Donut's Sticky Trail: a slow glaze-like shimmer (gentle scale pulse) so a
        // trail of marks reads as a distinct hazard rather than a static decal,
        // matching the splatter/impact language used everywhere else in this layer.
        const phase = (state.elapsed + t.id * 137) * 0.004;
        const pulse = 1 + Math.sin(phase) * 0.08;
        obj.position.set(pos.x, TRAIL_Y, pos.z);
        obj.scale.setScalar(pulse);
      },
    );

    // ── Status telegraphs: slow (ground ring) / stun (orbiting stars) ─────────
    (['player', 'enemy'] as const).forEach((role) => {
      const fighter = state[role];
      const vis = this.statusByRole[role];
      const pos = groundPos(fighter.x, fighter.y);

      const slowed = fighter.alive && state.elapsed < fighter.status.slowedUntil;
      vis.slowRing.visible = slowed;
      if (slowed) {
        vis.slowRing.position.set(pos.x, STATUS_RING_Y, pos.z);
        const pulse = 0.9 + Math.sin(state.elapsed * 0.0035) * 0.12;
        vis.slowRing.scale.setScalar(pulse);
        vis.slowRing.rotation.z = state.elapsed * 0.0012;
        (vis.slowRing.material as THREE.MeshBasicMaterial).opacity = 0.55;
      }

      const stunned = fighter.alive && state.elapsed < fighter.status.stunnedUntil;
      vis.stunStars.forEach((star, i) => {
        star.visible = stunned;
        if (!stunned) return;
        const ang = state.elapsed * 0.006 + (i * Math.PI * 2) / vis.stunStars.length;
        star.position.set(
          pos.x + Math.cos(ang) * STUN_STAR_RADIUS,
          STUN_STAR_HEIGHT + Math.sin(state.elapsed * 0.01 + i) * 0.05,
          pos.z + Math.sin(ang) * STUN_STAR_RADIUS,
        );
        star.material.opacity = 0.95;
      });
    });
  }

  /**
   * Advance every one-shot effect (flashes, shards, melee sweeps, shockwave rings).
   * Deliberately takes its OWN `dt`, separate from `sync()`'s sim-driven state — call
   * this with a dt that is NOT slowed by hit-stop, so impact feedback stays snappy
   * and instantly readable even while the sim (and character animation) is frozen.
   * That's the whole point of hit-stop: the WORLD pauses, the HIT still pops.
   */
  updateEffects(dtSeconds: number): void {
    for (const p of this.particles) {
      if (!p.active) continue;
      p.life += dtSeconds;
      if (p.life >= p.maxLife) {
        p.active = false;
        p.sprite.visible = false;
        continue;
      }
      const t = p.life / p.maxLife;
      p.vy += p.gravity * dtSeconds;
      p.sprite.position.x += p.vx * dtSeconds;
      p.sprite.position.y += p.vy * dtSeconds;
      p.sprite.position.z += p.vz * dtSeconds;
      const scale = THREE.MathUtils.lerp(p.startScale, p.endScale, easeOutCubic(t));
      p.sprite.scale.set(scale, scale, 1);
      p.mat.opacity = Math.max(0, THREE.MathUtils.lerp(p.startOpacity, p.endOpacity, Math.pow(t, p.fadeEase)));
    }

    for (const w of this.wedges) {
      if (!w.active) continue;
      w.life += dtSeconds;
      if (w.life >= w.maxLife) {
        w.active = false;
        w.mesh.visible = false;
        continue;
      }
      const t = w.life / w.maxLife;
      // Hold near-full opacity through the first ~60% of life, then drop fast — a
      // swept cone should read as a clean, held shape, not something dissolving
      // from the instant it appears.
      w.mat.opacity = w.startOpacity * (1 - Math.pow(t, 1.8));
    }

    for (const r of this.rings) {
      if (!r.active) continue;
      r.life += dtSeconds;
      if (r.life >= r.maxLife) {
        r.active = false;
        r.mesh.visible = false;
        continue;
      }
      const t = r.life / r.maxLife;
      const s = THREE.MathUtils.lerp(r.startScale, r.targetScale, easeOutCubic(t));
      r.mesh.scale.set(s, s, s);
      r.mat.opacity = r.startOpacity * (1 - t);
    }
  }

  // ── Spawn API — called from match.ts's event handling ─────────────────────────

  /** Muzzle/cast flash at the attacker, tinted the weapon's colour. Fires for every
   * `weapon-fired` event (melee wind-up, ranged muzzle, or a self-cast heal). */
  spawnCastFlash(xWU: number, yWU: number, facing: Vec2, color: string): void {
    const origin = groundPos(xWU, yWU);
    const mag = Math.hypot(facing.x, facing.y) || 1;
    const fx = facing.x / mag;
    const fy = facing.y / mag;
    const offM = 0.7;
    const p = this.allocParticle();
    p.active = true;
    p.life = 0;
    p.maxLife = 0.16;
    p.sprite.visible = true;
    p.sprite.position.set(origin.x + fx * offM, CAST_HEIGHT, origin.z + fy * offM);
    p.vx = 0; p.vy = 0; p.vz = 0; p.gravity = 0;
    p.startScale = 0.55; p.endScale = 0.95;
    p.startOpacity = 1; p.endOpacity = 0; p.fadeEase = 1.6;
    p.mat.color.set(color).lerp(WHITE, 0.35);
  }

  /**
   * Swept melee cone matching the weapon's REAL `cone`/`range` exactly — this is what
   * makes a melee swing visible at all (previously nothing telegraphed the hitbox).
   * Fires on every melee `weapon-fired`, whether or not it actually connects, exactly
   * like a real swing animation would.
   */
  spawnMeleeArc(xWU: number, yWU: number, facing: Vec2, rangeWU: number, coneDeg: number, color: string): void {
    const origin = groundPos(xWU, yWU);
    const radiusM = wu(rangeWU);
    const key = `${Math.round(coneDeg)}_${radiusM.toFixed(3)}`;
    let geo = this.wedgeGeoCache.get(key);
    if (!geo) {
      geo = buildWedgeGeometry(radiusM, coneDeg);
      this.wedgeGeoCache.set(key, geo);
    }
    const w = this.allocWedge();
    w.active = true;
    w.life = 0;
    w.maxLife = 0.3;
    w.startOpacity = 0.88;
    w.mesh.visible = true;
    w.mesh.geometry = geo;
    w.mesh.rotation.y = Math.atan2(facing.x, facing.y);
    w.mesh.position.set(origin.x, GROUND_VFX_Y, origin.z);
    // Mix toward ink rather than using the weapon's raw colour at low opacity — a
    // pale weapon colour (e.g. Patty Smash's yellow) alpha-blended over the arena's
    // equally pale floor is nearly invisible; darkening it first guarantees contrast
    // regardless of what's underneath, matching how the reference bar's AOE
    // indicators are bold saturated shapes, not a light tint.
    w.mat.color.set(color).lerp(INK, 0.3);
    w.mat.opacity = w.startOpacity;
  }

  /** Bright impact burst at a hit location: expanding flash + ground ring + radial
   * shards, tinted by the damage source and scaled by how hard the hit was. */
  spawnImpactBurst(xWU: number, yWU: number, color: string, amount: number): void {
    const origin = groundPos(xWU, yWU);
    const sizeFactor = THREE.MathUtils.clamp(0.55 + amount * 0.035, 0.55, 2.4);
    this.burst(origin, color, sizeFactor, Math.round(THREE.MathUtils.clamp(3 + amount * 0.3, 3, 9)));
  }

  /** Bigger burst + scatter + a bright pop for a death — the biggest non-ultimate
   * moment in a match, so it deliberately outsizes even a hard hit. */
  spawnDeathBurst(xWU: number, yWU: number, color: string): void {
    const origin = groundPos(xWU, yWU);
    this.burst(origin, color, 2.4, 13, { life: 1.35 });
  }

  /** Gentle rising sparkle for a heal (Hamburger's Onion Ring). */
  spawnHealPulse(xWU: number, yWU: number): void {
    const origin = groundPos(xWU, yWU);
    for (let i = 0; i < 5; i++) {
      const p = this.allocParticle();
      const ang = (i / 5) * Math.PI * 2 + Math.random() * 0.6;
      const r = 0.25 + Math.random() * 0.35;
      p.active = true;
      p.life = 0;
      p.maxLife = 0.7 + Math.random() * 0.25;
      p.sprite.visible = true;
      p.sprite.position.set(origin.x + Math.cos(ang) * r, IMPACT_HEIGHT - 0.3, origin.z + Math.sin(ang) * r);
      p.vx = Math.cos(ang) * 0.3;
      p.vz = Math.sin(ang) * 0.3;
      p.vy = 0.8 + Math.random() * 0.4;
      p.gravity = 0.15; // slight upward drift that gently loses momentum, not falls
      p.startScale = 0.22; p.endScale = 0.08;
      p.startOpacity = 0.9; p.endOpacity = 0; p.fadeEase = 1;
      p.mat.color.set('#6FE0A8');
    }
  }

  /**
   * Lollipop's Giant Lollipop — an 8s-cooldown ultimate that per the ability text
   * "grows huge and hits the whole map". The normal melee-arc call already draws its
   * true cone/range (360°/huge radius already makes this screen-filling on its own);
   * this layers a racing shockwave ring + a big white flash + heavy scatter on top so
   * the cast reads as a genuine event, not just a bigger version of a normal swing.
   */
  spawnGiantSlamShockwave(xWU: number, yWU: number, color: string, rangeWU: number): void {
    const origin = groundPos(xWU, yWU);
    const radiusM = wu(rangeWU);

    const ring = this.allocRing();
    ring.active = true; ring.life = 0; ring.maxLife = 0.6;
    ring.startScale = 0.3; ring.targetScale = radiusM;
    ring.startOpacity = 1;
    ring.mesh.visible = true;
    ring.mesh.position.set(origin.x, GROUND_VFX_Y + 0.02, origin.z);
    ring.mesh.scale.setScalar(ring.startScale);
    ring.mat.color.set(color).lerp(WHITE, 0.3);
    ring.mat.opacity = ring.startOpacity;

    const flash = this.allocParticle();
    flash.active = true; flash.life = 0; flash.maxLife = 0.3;
    flash.sprite.visible = true;
    flash.sprite.position.set(origin.x, IMPACT_HEIGHT * 1.5, origin.z);
    flash.vx = 0; flash.vy = 0; flash.vz = 0; flash.gravity = 0;
    flash.startScale = 1.6; flash.endScale = 3.1;
    flash.startOpacity = 0.9; flash.endOpacity = 0; flash.fadeEase = 1.2;
    flash.mat.color.set(color).lerp(WHITE, 0.55);

    // Shards only — the dedicated flash+ring above already cover this cast's
    // "flash" and "shockwave rim" beats; a second overlapping flash/ring from the
    // shared burst helper just stacked additive brightness into a full whiteout.
    this.burst(origin, color, 2.2, 16, { life: 0.9, speedMult: 1.6, skipFlash: true, skipRing: true });
  }

  /** Shared flash+shards burst used by impact/death/giant-slam. */
  private burst(
    origin: { x: number; z: number },
    color: string,
    sizeFactor: number,
    shardCount: number,
    opts?: { life?: number; speedMult?: number; skipFlash?: boolean; skipRing?: boolean },
  ): void {
    const life = opts?.life ?? 1;
    const speedMult = opts?.speedMult ?? 1;

    if (!opts?.skipFlash) {
      const flash = this.allocParticle();
      flash.active = true; flash.life = 0; flash.maxLife = (0.16 + sizeFactor * 0.04) * life;
      flash.sprite.visible = true;
      flash.sprite.position.set(origin.x, IMPACT_HEIGHT, origin.z);
      flash.vx = 0; flash.vy = 0; flash.vz = 0; flash.gravity = 0;
      flash.startScale = 0.5 * sizeFactor; flash.endScale = 1.5 * sizeFactor;
      flash.startOpacity = 1; flash.endOpacity = 0; flash.fadeEase = 1.4;
      flash.mat.color.set(color).lerp(WHITE, 0.4);
    }

    if (!opts?.skipRing) {
      const ring = this.allocRing();
      ring.active = true; ring.life = 0; ring.maxLife = (0.22 + sizeFactor * 0.05) * life;
      ring.startScale = 0.15; ring.targetScale = 0.55 * sizeFactor + 0.3;
      ring.startOpacity = 0.85;
      ring.mesh.visible = true;
      ring.mesh.position.set(origin.x, GROUND_VFX_Y, origin.z);
      ring.mesh.scale.setScalar(ring.startScale);
      ring.mat.color.set(color);
      ring.mat.opacity = ring.startOpacity;
    }

    for (let i = 0; i < shardCount; i++) {
      const s = this.allocParticle();
      const ang = Math.random() * Math.PI * 2;
      const speed = (1.6 + Math.random() * 1.8) * (0.6 + sizeFactor * 0.4) * speedMult;
      s.active = true; s.life = 0; s.maxLife = (0.3 + Math.random() * 0.2 + sizeFactor * 0.06) * life;
      s.sprite.visible = true;
      s.sprite.position.set(origin.x, IMPACT_HEIGHT, origin.z);
      s.vx = Math.cos(ang) * speed;
      s.vz = Math.sin(ang) * speed;
      s.vy = 1.1 + Math.random() * 1.5;
      s.gravity = -5.4;
      s.startScale = (0.14 + Math.random() * 0.09) * sizeFactor;
      s.endScale = 0;
      s.startOpacity = 1; s.endOpacity = 0; s.fadeEase = 1;
      s.mat.color.set(color);
    }
  }

  private allocParticle(): ParticleSlot {
    for (const p of this.particles) if (!p.active) return p;
    let best = this.particles[0];
    let bestRatio = -Infinity;
    for (const p of this.particles) {
      const r = p.life / p.maxLife;
      if (r > bestRatio) { bestRatio = r; best = p; }
    }
    return best;
  }

  private allocWedge(): WedgeSlot {
    for (const w of this.wedges) if (!w.active) return w;
    return this.wedges.reduce((a, b) => (a.life / a.maxLife >= b.life / b.maxLife ? a : b));
  }

  private allocRing(): RingSlot {
    for (const r of this.rings) if (!r.active) return r;
    return this.rings.reduce((a, b) => (a.life / a.maxLife >= b.life / b.maxLife ? a : b));
  }

  /** Drop every tracked mesh AND reset one-shot effects — call on match restart so
   * stale VFX (a burst mid-fade, a status ring) doesn't linger into the next match. */
  clear(): void {
    for (const pool of [this.projectilePool, this.splatPool, this.trailPool]) {
      for (const obj of pool.values()) this.group.remove(obj);
      pool.clear();
    }
    for (const p of this.particles) { p.active = false; p.sprite.visible = false; }
    for (const w of this.wedges) { w.active = false; w.mesh.visible = false; }
    for (const r of this.rings) { r.active = false; r.mesh.visible = false; }
    for (const role of ['player', 'enemy'] as const) {
      const vis = this.statusByRole[role];
      vis.slowRing.visible = false;
      vis.stunStars.forEach((s) => { s.visible = false; });
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

    this.glowTex.dispose();
    for (const p of this.particles) p.mat.dispose();
    for (const w of this.wedges) w.mat.dispose();
    for (const r of this.rings) r.mat.dispose();
    this.wedgeGeoCache.forEach((g) => g.dispose());
    this.wedgeGeoCache.clear();
    this.ringUnitGeo.dispose();
    for (const role of ['player', 'enemy'] as const) {
      const vis = this.statusByRole[role];
      (vis.slowRing.material as THREE.Material).dispose();
      vis.slowRing.geometry.dispose();
      vis.stunStars.forEach((s) => (s.material as THREE.Material).dispose());
    }
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
