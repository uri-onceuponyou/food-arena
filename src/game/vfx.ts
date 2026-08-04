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
import { CHARACTERS } from './rules';
import type { CharacterId, Weapon } from './rules';
import { CHARACTER_HEIGHT, groundPos, wu } from '../units';
import { flatMat } from '../render/toon';
// Per-weapon bespoke VFX extension point (see `vfx/weapons/types.ts` for the full
// `WeaponVfx` contract). `getWeaponVfx()` returns `undefined` for any weapon with no
// bespoke entry — every call site below falls back to this file's existing generic
// projectile/impact/cast behaviour in that case, unchanged from before this system
// existed.
import { getWeaponVfx } from '../vfx/weapons';
import type { WeaponVfx, WeaponVfxCtx } from '../vfx/weapons/types';

declare global {
  interface Window {
    /** QA-only counters, bumped once per `spawn*` call below — lets a Playwright
     * driver `waitForFunction` on the exact frame a specific effect fires instead of
     * guessing at screenshot timing for effects that live well under a second.
     * Never read by game logic. */
    __vfxQaCounts?: Record<'cast' | 'meleeArc' | 'impact' | 'death' | 'heal' | 'giantSlam' | 'puddleSplash', number>;
    /**
     * QA-only: fire one effect on demand at a world position, bypassing the sim
     * entirely. Never called by game logic — it exists because DRIVING a specific
     * effect through real gameplay is unreliable enough to have burned real time:
     * the AI kites, so scripted melee often never connects, and a probe that waits
     * for a hit can time out while the safe zone closes and kills the subject
     * instead. Nine per-weapon VFX agents are queued behind this file, and each of
     * them needs to see its own effect on demand, repeatably, to judge it.
     *
     * Published by `VfxLayer`'s constructor, cleared by `dispose()`.
     */
    __vfxSpawnTest?: (kind: 'impact' | 'death' | 'cast', xWU: number, yWU: number, amount?: number, color?: string, who?: CharacterId, weaponKey?: string) => void;
    /** QA-only per-tick fighter snapshot, refreshed every `sync()` call — lets a
     * Playwright driver steer input off real positions/HP/terrain-slow state instead
     * of guessing from rendered pixels (e.g. to script a player walking into a puddle
     * while dodging the AI). Never read by game logic. */
    __vfxDebugFighters?: Record<FighterRole, { x: number; y: number; hp: number; alive: boolean; terrainSlowFactor: number }>;
  }
}

type VfxQaKey = 'cast' | 'meleeArc' | 'impact' | 'death' | 'heal' | 'giantSlam' | 'puddleSplash';

function bumpVfxQaCount(key: VfxQaKey): void {
  window.__vfxQaCounts ??= { cast: 0, meleeArc: 0, impact: 0, death: 0, heal: 0, giantSlam: 0, puddleSplash: 0 };
  window.__vfxQaCounts[key]++;
}

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

// ── Slow feedback (design change) ───────────────────────────────────────────────
// The arena's grease/water puddles used to carry a whole "make this shout HAZARD"
// visual language of their own (glow halo, bold accent ring, warning icons — see
// `arena/hazards.ts`), chasing an accent colour that could mean "you'll be slowed
// here" without colliding with an existing genre convention. Five critic rounds
// plateaued at 6/10 doing that; every hue was already claimed by something else
// (magenta = lethal, violet = loot, green = heal/toxic, yellow = ordinary floor,
// cyan = water itself). Uri's fix: stop asking the PUDDLE's colour to carry that
// meaning at all. A puddle just has to look like a puddle (see `hazards.ts`); the
// "you are currently slowed" feedback moves onto the CHARACTER instead, where the
// player is already looking. It has to read identically regardless of which of the
// two slow sources caused it — a puddle underfoot (`Fighter.terrainSlowFactor`, the
// sim's read-only per-tick observation) or a weapon's own `status.slowedUntil`
// timer — so both are treated as one `slowed` signal below (see `sync()`).
/**
 * Cool blue wash — reads as "wet/cold/dragging" at a glance without competing with
 * any character's own palette.
 *
 * Brighter and more chromatic than the first pass (`#5C8FB0`), for a compositing
 * reason rather than a taste one. Alpha-blending a MID-value blue over a bright warm
 * character just averages toward grey — the result loses saturation but never gains a
 * cool cast, so it reads as "slightly dirty", not "chilled". To flip the hue the tint
 * has to be brighter in blue than the character is: our warmest cast member's bun sits
 * near `rgb(254,191,109)` (B=109), so a tint at B≈224 pulls the composited blue above
 * the composited red and the character visibly turns cold.
 */
const SLOW_TINT_COLOR = new THREE.Color('#63A8E0');
/**
 * Tint-sprite footprint, in metres. It reuses `glowTex` (a soft RADIAL gradient,
 * hottest dead-centre, fading equally toward every edge) stretched non-uniformly via
 * `Sprite.scale`, so its visual "hot zone" is concentrated right at the sprite's own
 * centre — sizing/centring this to the rig's actual HEAD mass (see `characters/rig.ts`:
 * the head is ~46% of total height and, from this game's steep top-down camera, is
 * almost the entire visible silhouette) matters more than covering the full body.
 * First pass centred this too high and too tall (spanned well above the head into
 * empty air, reading as a floating smudge with the actual head barely darkened) —
 * centred on the rig's own `headCentreY` instead, sized just past the head's own
 * diameter plus the torso peeking out beneath it, not the full body/legs. Kept at a
 * moderate-high peak opacity (see `sync()`) so a character's own colours still read
 * through rather than being fully overwritten.
 */
const SLOW_TINT_WIDTH = CHARACTER_HEIGHT * 0.62;
const SLOW_TINT_HEIGHT = CHARACTER_HEIGHT * 0.66;
const SLOW_TINT_CENTER_Y = CHARACTER_HEIGHT * 0.62;
/** Peak alpha of the tint wash. High enough that the composite actually flips the
 * character cool (see `SLOW_TINT_COLOR`), low enough that its own colours and face
 * still read through — a status effect, not a repaint. */
const SLOW_TINT_PEAK_OPACITY = 0.58;
/**
 * Ground telegraph ring at a slowed fighter's feet — TWO concentric rings, a dark
 * base and a bright frost band on top of it.
 *
 * The single ring this replaces was `#6FE0FF`: the same cyan as the water puddle it
 * is most often standing in, so the one place the cue mattered most was the one place
 * it could not be seen. Picking a different single hue only moves that problem, since
 * this ring has to read on warm brown tile, on an amber grease pool AND on a blue
 * water pool. A bright band with a dark band under it reads on all three by VALUE, the
 * same reason this file already mixes melee arcs toward `INK` — contrast that does not
 * depend on guessing the background.
 */
const SLOW_RING_BRIGHT = '#EAF4FF';
const SLOW_RING_DARK = '#1D2740';
/** World-unit distance a fighter must travel (accumulated only while terrain-slowed)
 * between puddle-splash bursts — a footstep-like cadence tied to actual movement,
 * not a timer, so it naturally speeds up or stops with the fighter's own motion. */
const PUDDLE_SPLASH_DIST_WU = 18;

const WHITE = new THREE.Color('#ffffff');
/** Deep desaturated ink, matching `render/toon.ts`'s outline colour (kept as a local
 * literal rather than an import — this module has no other reason to depend on the
 * character outline module). Mixing ground-plane fills toward this instead of using
 * a weapon's raw (often pale/warm) colour at low opacity is what keeps melee arcs and
 * AOE fills legible against the arena's bright cream floor. */
const INK = new THREE.Color('#241a33');
/**
 * Universal "hit spark" colour — a warm pale gold, deliberately NOT tinted per-weapon
 * like the flash/decal/rings are. Real brawler VFX almost always give flying impact
 * debris a neutral bright colour regardless of the attack's own theme colour, exactly
 * so the sparks/shards read as a distinct visual LAYER on top of the colour-graded
 * flash+decal rather than blending into it — a critic pass repeatedly perceived this
 * whole burst as "one flat coloured sprite" when every element shared the same
 * near-white/weapon-colour palette.
 */
const SPARK_COLOR = new THREE.Color('#FFE79A');

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

/** Normalize a (vx, vy) velocity into a unit direction, `{0,0}` for a ~stationary
 * vector. Shared by every bespoke-projectile call site below (`ctx.direction`). */
function normalizedDir(vx: number, vy: number): { x: number; y: number } {
  const mag = Math.hypot(vx, vy);
  return mag > 1e-6 ? { x: vx / mag, y: vy / mag } : { x: 0, y: 0 };
}

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
 * Soft-edged disc with a FLAT alpha plateau — opaque out to ~62% of the radius, then
 * a smooth ramp to nothing. Used only by the slow tint (see `SLOW_TINT_COLOR`).
 *
 * The tint used to reuse `glowTex`, whose alpha peaks at a single point and is already
 * down to ~0.5 at 60% of the radius. Composited over a character that is only ~13% of
 * the frame height, that means the wash is at full strength on a handful of pixels
 * dead-centre and effectively absent across the rest of the silhouette — which is
 * exactly what a measurement found: a slowed Hamburger's bun still read `rgb(254,191,109)`,
 * pure warm orange, with no cooling at all. The compositing was never broken (forcing
 * the tint red at 5x proved it lands); the ALPHA PROFILE was wrong for the job. A tint
 * has to cover a silhouette evenly; a glow has to fall off from a hot core. They are
 * different shapes and this one needed its own.
 */
function buildSoftDiscTexture(): THREE.CanvasTexture {
  const size = 64;
  const canvas = document.createElement('canvas');
  canvas.width = size;
  canvas.height = size;
  const ctx = canvas.getContext('2d')!;
  const grad = ctx.createRadialGradient(size / 2, size / 2, 0, size / 2, size / 2, size / 2);
  grad.addColorStop(0, 'rgba(255,255,255,1)');
  grad.addColorStop(0.62, 'rgba(255,255,255,1)');
  grad.addColorStop(0.82, 'rgba(255,255,255,0.6)');
  grad.addColorStop(1, 'rgba(255,255,255,0)');
  ctx.fillStyle = grad;
  ctx.fillRect(0, 0, size, size);
  const tex = new THREE.CanvasTexture(canvas);
  tex.needsUpdate = true;
  return tex;
}

/**
 * 8-point sparkle/star flash — soft radial core plus radiating spikes (alternating
 * long/short) drawn with additive-friendly alpha falloff. A plain soft circle (the
 * radial-glow texture above) reads as a blur once scaled up big; the spikes are what
 * make a flash read as a CONCENTRATED burst of light — matching the starburst shapes
 * in the Brawl Stars reference plates — rather than a fog patch. Used for the
 * first-frame "pop" on every impact and the big ultimate/death flashes.
 */
function buildStarburstTexture(): THREE.CanvasTexture {
  const size = 128;
  const c = size / 2;
  const canvas = document.createElement('canvas');
  canvas.width = size;
  canvas.height = size;
  const ctx = canvas.getContext('2d')!;

  // Small, bright core — kept deliberately SMALL relative to round 1 (was 0.32 of the
  // canvas). A critic pass twice read this whole texture as "a single soft circular
  // bloom" with the spikes invisible at normal render size; a big soft core is what
  // was drowning them out. Long, high-alpha spikes below now do the actual shape
  // work.
  const core = ctx.createRadialGradient(c, c, 0, c, c, size * 0.16);
  core.addColorStop(0, 'rgba(255,255,255,1)');
  core.addColorStop(0.6, 'rgba(255,255,255,0.85)');
  core.addColorStop(1, 'rgba(255,255,255,0)');
  ctx.fillStyle = core;
  ctx.fillRect(0, 0, size, size);

  // 4 long cardinal spikes reaching almost to the edge (a classic "sparkle/lens
  // flare" cross) + 4 shorter diagonal spikes, all kept near-full alpha along most
  // of their length so the STAR SILHOUETTE itself is unmistakable, not just a
  // brightness gradient that blurs back into a circle.
  const spikes = 8;
  for (let i = 0; i < spikes; i++) {
    const long = i % 2 === 0;
    const len = size * (long ? 0.48 : 0.26);
    const halfWidth = size * (long ? 0.045 : 0.028);
    const ang = (i / spikes) * Math.PI * 2;
    ctx.save();
    ctx.translate(c, c);
    ctx.rotate(ang);
    const grad = ctx.createLinearGradient(0, 0, len, 0);
    grad.addColorStop(0, 'rgba(255,255,255,1)');
    grad.addColorStop(0.7, 'rgba(255,255,255,0.8)');
    grad.addColorStop(1, 'rgba(255,255,255,0)');
    ctx.fillStyle = grad;
    ctx.beginPath();
    ctx.moveTo(0, -halfWidth);
    ctx.lineTo(len, 0);
    ctx.lineTo(0, halfWidth);
    ctx.closePath();
    ctx.fill();
    ctx.restore();
  }

  const tex = new THREE.CanvasTexture(canvas);
  tex.needsUpdate = true;
  return tex;
}

/**
 * Thin directional glow streak — bright along its centreline, tapering to transparent
 * at both ends AND top/bottom. Rotated per-spawn via `SpriteMaterial.rotation` so one
 * texture can fire "hit spark" rays radiating out of an impact at any angle, instead
 * of needing a pre-rotated texture per direction.
 */
function buildStreakTexture(): THREE.CanvasTexture {
  const w = 128;
  const h = 32;
  const canvas = document.createElement('canvas');
  canvas.width = w;
  canvas.height = h;
  const ctx = canvas.getContext('2d')!;

  const along = ctx.createLinearGradient(0, 0, w, 0);
  along.addColorStop(0, 'rgba(255,255,255,0)');
  along.addColorStop(0.5, 'rgba(255,255,255,1)');
  along.addColorStop(1, 'rgba(255,255,255,0)');
  ctx.fillStyle = along;
  ctx.fillRect(0, 0, w, h);

  // Clip to a vertical taper (independent of x) so the ray narrows to a point at
  // both ends rather than reading as a hard-edged bar.
  ctx.globalCompositeOperation = 'destination-in';
  const across = ctx.createLinearGradient(0, 0, 0, h);
  across.addColorStop(0, 'rgba(255,255,255,0)');
  across.addColorStop(0.5, 'rgba(255,255,255,1)');
  across.addColorStop(1, 'rgba(255,255,255,0)');
  ctx.fillStyle = across;
  ctx.fillRect(0, 0, w, h);
  ctx.globalCompositeOperation = 'source-over';

  const tex = new THREE.CanvasTexture(canvas);
  tex.needsUpdate = true;
  return tex;
}

/**
 * Vertical gradient mapped onto a melee wedge's UV.y (apex→rim): faint/transparent
 * near the pivot, rising to a hot white-edged band right at the swept rim. A critic
 * pass called the melee cone out as "a flat, hard-edged" fill with zero internal
 * shading — this is what turns it into a directional swoosh with a bright leading
 * edge (like a blade catching light) instead of one uniform flat colour.
 */
function buildWedgeGradientTexture(): THREE.CanvasTexture {
  const w = 8;
  const h = 64;
  const canvas = document.createElement('canvas');
  canvas.width = w;
  canvas.height = h;
  const ctx = canvas.getContext('2d')!;
  // Canvas Y grows downward; texture V=0 (apex) should be the image's TOP row so it
  // maps to v=0 with THREE's default flipY, keeping v=1 (rim) at the bottom row.
  const grad = ctx.createLinearGradient(0, 0, 0, h);
  grad.addColorStop(0, 'rgba(255,255,255,0.1)');
  grad.addColorStop(0.55, 'rgba(255,255,255,0.55)');
  grad.addColorStop(0.86, 'rgba(255,255,255,0.85)');
  grad.addColorStop(0.94, 'rgba(255,255,255,1)');
  grad.addColorStop(1, 'rgba(255,255,255,0.65)');
  ctx.fillStyle = grad;
  ctx.fillRect(0, 0, w, h);
  const tex = new THREE.CanvasTexture(canvas);
  // Disable the automatic vertical flip so UV.y maps directly to the canvas rows as
  // drawn above (v=0 -> row 0 -> apex-faint, v=1 -> row h -> rim-bright) — with the
  // default flipY this directional gradient would come out inverted.
  tex.flipY = false;
  tex.needsUpdate = true;
  return tex;
}

/**
 * Angular crystal/shard silhouette — a hard-edged faceted polygon with a bright
 * off-centre highlight facet, NOT another soft circle. A critic pass specifically
 * flagged every particle in this layer as "just a soft additive circle... no shape
 * vocabulary — no shards, sparks, or debris". Reusing the radial-glow dot for impact
 * debris is exactly that complaint; this is a deliberately different silhouette so
 * flying debris reads as actual broken-off chunks.
 */
function buildShardTexture(): THREE.CanvasTexture {
  const size = 64;
  const c = size / 2;
  const canvas = document.createElement('canvas');
  canvas.width = size;
  canvas.height = size;
  const ctx = canvas.getContext('2d')!;

  // A slightly irregular 6-point crystal outline (not a regular hexagon) so it
  // doesn't read as a generic gem icon.
  const points: Array<[number, number]> = [
    [0.5, 0.02], [0.78, 0.32], [0.68, 0.98], [0.32, 0.98], [0.22, 0.32], [0.5, 0.02],
  ];
  ctx.beginPath();
  points.forEach(([px, py], i) => {
    const x = px * size;
    const y = py * size;
    if (i === 0) ctx.moveTo(x, y);
    else ctx.lineTo(x, y);
  });
  ctx.closePath();

  const grad = ctx.createLinearGradient(size * 0.3, 0, size * 0.6, size);
  grad.addColorStop(0, 'rgba(255,255,255,1)');
  grad.addColorStop(0.45, 'rgba(255,255,255,0.85)');
  grad.addColorStop(1, 'rgba(255,255,255,0.55)');
  ctx.fillStyle = grad;
  ctx.fill();

  // A brighter off-centre facet highlight so the shape reads as faceted crystal
  // catching light, not a flat cutout.
  ctx.beginPath();
  ctx.moveTo(size * 0.5, size * 0.05);
  ctx.lineTo(size * 0.62, size * 0.34);
  ctx.lineTo(size * 0.5, size * 0.5);
  ctx.lineTo(size * 0.4, size * 0.3);
  ctx.closePath();
  ctx.fillStyle = 'rgba(255,255,255,0.9)';
  ctx.fill();

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
  // UV.y = radial distance from the apex (0 at the pivot, 1 at the swept rim), UV.x =
  // angle across the sweep — lets `wedgeGradientTex` paint a bright leading edge at
  // the rim fading back to the pivot, instead of the wedge being one flat fill.
  const uvs: number[] = [0.5, 0];
  for (let i = 0; i <= segments; i++) {
    const a = -half + (i / segments) * half * 2;
    positions.push(Math.sin(a) * radiusM, 0, Math.cos(a) * radiusM);
    uvs.push(i / segments, 1);
  }
  const indices: number[] = [];
  for (let i = 1; i < segments + 1; i++) indices.push(0, i, i + 1);
  const geo = new THREE.BufferGeometry();
  geo.setAttribute('position', new THREE.Float32BufferAttribute(positions, 3));
  geo.setAttribute('uv', new THREE.Float32BufferAttribute(uvs, 2));
  geo.setIndex(indices);
  geo.computeVertexNormals();
  return geo;
}

/**
 * Flat jagged star polygon (a fan alternating outer/inner radius per point), lying in
 * the XZ plane like `buildWedgeGeometry`. This is what an impact's ground-mark decal
 * uses instead of another soft round particle — two critic rounds in a row read every
 * particle in this layer as "a soft circular bloom, no shape vocabulary"; a properly
 * sized (comparable to a fighter's own footprint) hard-edged star SHAPE is legible at
 * normal gameplay-camera distance in a way a handful of small sprite particles are
 * not, no matter how angular their own texture is.
 */
function buildStarPolygonGeometry(radiusM: number, points = 8, innerRatio = 0.45): THREE.BufferGeometry {
  const spikes = points * 2;
  const positions: number[] = [0, 0, 0];
  for (let i = 0; i <= spikes; i++) {
    const a = (i / spikes) * Math.PI * 2;
    const r = i % 2 === 0 ? radiusM : radiusM * innerRatio;
    positions.push(Math.sin(a) * r, 0, Math.cos(a) * r);
  }
  const indices: number[] = [];
  for (let i = 1; i < spikes + 1; i++) indices.push(0, i, i + 1);
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
  /** Height/width ratio applied on top of the (uniform) scale animation — 1 for every
   * ordinary glow dot/flash, < 1 for a hit-spark streak so it reads as a thin ray
   * rather than a square blob. Reset to 1 by `allocParticle` for every new use. */
  aspect: number;
}

// Bumped up from the original 64/10 once impacts gained a pop-flash + hit-spark
// streaks on top of the flash/shards they already had — a single big hit now
// allocates well over a dozen particles, and rings are used in pairs (bright inner
// rim + soft outer glow) for every burst.
const PARTICLE_POOL_SIZE = 96;
// Bumped from 6 — this pool now also serves the impact "star decal" ground mark
// (see `spawnImpactStarDecal`), not just melee-arc sweeps, so it needs headroom for
// both to be live at once.
const WEDGE_POOL_SIZE = 10;
const RING_POOL_SIZE = 16;

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
  /** Dark band drawn just outside/under `slowRing` so the pair reads on any
   * background — see `SLOW_RING_BRIGHT`/`SLOW_RING_DARK`. */
  slowRingDark: THREE.Mesh;
  /** Camera-facing colour-shift sprite over the character's own body — see the
   * "Slow feedback" design note above `SLOW_TINT_COLOR`. */
  slowTint: THREE.Sprite;
  stunStars: THREE.Sprite[];
}

export class VfxLayer {
  private readonly group = new THREE.Group();
  private readonly projectilePool = new Map<number, THREE.Object3D>();
  private readonly splatPool = new Map<number, THREE.Object3D>();
  private readonly trailPool = new Map<number, THREE.Object3D>();
  private readonly materialCache = new Map<string, THREE.Material>();

  // ── Bespoke per-weapon VFX support (`vfx/weapons/`) ────────────────────────
  /** Short-lived custom `Object3D`s spawned by a `WeaponVfx` hook via
   * `ctx.spawnTransient` (see `spawnTransientObject`/`updateEffects`). Unlike the
   * fixed-size pools above, this is a plain growable list — bespoke weapon VFX fire
   * at ability-cooldown cadence (roughly once a second per weapon), not every frame,
   * so pooling the *wrapper* list itself would add bookkeeping this doesn't need;
   * the discipline this system asks authors to hold is caching their own geometry/
   * material at module scope (see `vfx/weapons/types.ts`), not this list. */
  private readonly transientEffects: Array<{
    object: THREE.Object3D;
    life: number;
    maxLife: number;
    onUpdate?: (progress: number, elapsedSeconds: number) => void;
  }> = [];
  /** `state.elapsed` (sim ms) as of the previous `sync()` call — lets `sync()`
   * derive a SIM-time delta to hand bespoke `trail()` hooks as `ctx.dt`, so a
   * projectile's own per-frame animation freezes during hit-stop right along with
   * its position, matching every other projectile-flight behaviour. Reset to 0 in
   * `clear()` so a match restart never reads a huge bogus first-frame delta. */
  private lastSyncElapsedMs = 0;

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
  private readonly softDiscTex = buildSoftDiscTexture();
  private readonly starTex = buildStarburstTexture();
  private readonly streakTex = buildStreakTexture();
  private readonly shardTex = buildShardTexture();
  private readonly wedgeGradientTex = buildWedgeGradientTexture();
  private readonly particles: ParticleSlot[] = [];
  private readonly wedges: WedgeSlot[] = [];
  private readonly rings: RingSlot[] = [];
  private readonly wedgeGeoCache = new Map<string, THREE.BufferGeometry>();
  // Thickened from (0.8, 1) — a thin band read as a faint outline at the wider
  // camera framing this game uses versus the shipped references it's judged
  // against; a thicker band reads unmistakably as a shockwave rim instead.
  private readonly ringUnitGeo = new THREE.RingGeometry(0.62, 1, 40);

  private readonly statusByRole: Record<FighterRole, StatusVisual>;
  /** Per-fighter footstep-distance tracking for puddle splashes (see
   * `PUDDLE_SPLASH_DIST_WU`) — `lastX`/`lastY` start at `NaN` so the very first
   * `sync()` call after construction/restart never reads a bogus huge "jump"
   * distance from an uninitialised position. */
  private readonly slowSplashState: Record<FighterRole, { lastX: number; lastY: number; distAccum: number }> = {
    player: { lastX: NaN, lastY: NaN, distAccum: 0 },
    enemy: { lastX: NaN, lastY: NaN, distAccum: 0 },
  };

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
        startScale: 1, endScale: 1, startOpacity: 1, endOpacity: 0, fadeEase: 1, aspect: 1,
      });
    }

    for (let i = 0; i < WEDGE_POOL_SIZE; i++) {
      const mat = new THREE.MeshBasicMaterial({
        color: 0xffffff, map: this.wedgeGradientTex, transparent: true, opacity: 0,
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
      // Dark base band first (wider on both sides), bright frost band on top of it.
      const darkMat = new THREE.MeshBasicMaterial({
        color: SLOW_RING_DARK, transparent: true, opacity: 0,
        side: THREE.DoubleSide, depthWrite: false,
      });
      const slowRingDark = new THREE.Mesh(new THREE.RingGeometry(0.55, 0.95, 28), darkMat);
      slowRingDark.rotation.x = -Math.PI / 2;
      slowRingDark.visible = false;
      slowRingDark.renderOrder = 3;
      this.group.add(slowRingDark);

      const ringMat = new THREE.MeshBasicMaterial({
        color: SLOW_RING_BRIGHT, transparent: true, opacity: 0,
        side: THREE.DoubleSide, depthWrite: false,
      });
      const slowRing = new THREE.Mesh(new THREE.RingGeometry(0.64, 0.86, 28), ringMat);
      slowRing.rotation.x = -Math.PI / 2;
      slowRing.visible = false;
      slowRing.renderOrder = 4;
      this.group.add(slowRing);

      // Colour-shift sprite over the character's own body (see the design note above
      // `SLOW_TINT_COLOR`). Reuses `glowTex` (the same soft radial dot every other
      // particle in this layer uses) stretched non-uniformly via `scale`, rather than
      // authoring a bespoke silhouette texture — a soft falloff reads fine at gameplay
      // distance and this is not trying to be a precise cutout. `depthTest: false` is
      // deliberate: the sprite's single flat plane sits at one depth, but the chibi
      // rig's real silhouette is not flat, so testing against the real depth buffer
      // would clip the tint unevenly (visible on one side of the body, missing on the
      // other) instead of reading as one even wash over the character.
      const tintMat = new THREE.SpriteMaterial({
        map: this.softDiscTex,
        color: SLOW_TINT_COLOR,
        transparent: true,
        opacity: 0,
        depthTest: false,
        depthWrite: false,
      });
      const slowTint = new THREE.Sprite(tintMat);
      slowTint.scale.set(SLOW_TINT_WIDTH, SLOW_TINT_HEIGHT, 1);
      slowTint.visible = false;
      slowTint.renderOrder = 8;
      this.group.add(slowTint);

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
      return { slowRing, slowRingDark, slowTint, stunStars };
    };

    this.statusByRole = { player: buildStatusVisual(), enemy: buildStatusVisual() };

    // QA-only on-demand spawn — see the `__vfxSpawnTest` declaration above.
    window.__vfxSpawnTest = (kind, xWU, yWU, amount = 14, color = '#FFC93C', who, weaponKey) => {
      // Resolve a real Weapon up front: BOTH the impact and cast paths consult the
      // bespoke registry through it, and passing nothing means every QA spawn silently
      // falls back to the generic burst. A first version of this hook wired only the cast
      // path, so `kind:'impact'` still could not reach anything in `vfx/weapons/` — which
      // is the single most common thing a per-weapon agent needs to look at.
      const qaId = who ?? 'hamburger';
      const qaWeapon = weaponKey ? CHARACTERS[qaId]?.weapons?.find((w: Weapon) => w.key === weaponKey) : undefined;

      if (kind === 'impact') {
        this.spawnImpactBurst(xWU, yWU, color, amount, qaWeapon ? { weapon: qaWeapon, characterId: qaId } : undefined);
      }
      else if (kind === 'death') this.spawnDeathBurst(xWU, yWU, color);
      else {
        // `who`/`weaponKey` let a probe drive a SPECIFIC character's bespoke hook. Without
        // them this falls back to a synthetic 'qa' weapon on 'hamburger', which is the
        // pre-existing behaviour. Driving a real hit through gameplay is not a workable
        // alternative: fighters spawn 1080wu apart, every weapon reaches at most 140wu,
        // and probes have timed out waiting for the AI to close.
        const weapon = qaWeapon ?? ({ key: 'qa', name: 'qa', type: 'ranged', range: 100, damage: amount, cooldown: 1, color, effect: null } as unknown as Weapon);
        this.spawnCastFlash(xWU, yWU, { x: 1, y: 0 }, weapon, qaId);
      }
    };
  }

  sync(state: MatchState): void {
    window.__vfxDebugFighters = {
      player: {
        x: state.player.x, y: state.player.y, hp: state.player.hp,
        alive: state.player.alive, terrainSlowFactor: state.player.terrainSlowFactor,
      },
      enemy: {
        x: state.enemy.x, y: state.enemy.y, hp: state.enemy.hp,
        alive: state.enemy.alive, terrainSlowFactor: state.enemy.terrainSlowFactor,
      },
    };

    // SIM-time delta since the last `sync()` call, in seconds — handed to bespoke
    // `trail()` hooks as `ctx.dt` (see `lastSyncElapsedMs`'s field comment for why
    // this is sim time, not real time). Computed once per call, before the
    // projectile pool below runs.
    const frameDtSeconds = Math.max(0, (state.elapsed - this.lastSyncElapsedMs) / 1000);
    this.lastSyncElapsedMs = state.elapsed;

    syncPool<Projectile>(
      this.projectilePool,
      this.group,
      state.projectiles,
      (p) => {
        // Bespoke-VFX lookup (`vfx/weapons/`): a weapon with its own `projectile()`
        // hook gets a fully custom Object3D instead of the generic tinted sphere.
        // The matched `WeaponVfx` (or `undefined`) is stashed on `userData` so the
        // `update` callback below — which only receives the pool's `Object3D`, not
        // the weapon that made it — knows which path to take without a second
        // lookup or a parallel id-keyed map.
        const owner = state[p.ownerRole];
        const bespoke = getWeaponVfx(owner.characterId, p.weapon.key);
        if (bespoke?.projectile) {
          const pos = groundPos(p.x, p.y);
          const dir = normalizedDir(p.vx, p.vy);
          const ctx: WeaponVfxCtx = {
            THREE,
            position: new THREE.Vector3(pos.x, PROJECTILE_HEIGHT, pos.z),
            direction: new THREE.Vector3(dir.x, 0, dir.y),
            color: p.color,
            damage: p.damage,
            weapon: p.weapon,
            characterId: owner.characterId,
            spawnTransient: (obj, life, onUpdate) => this.spawnTransientObject(obj, life, onUpdate),
          };
          const obj = bespoke.projectile(ctx);
          obj.userData.weaponVfx = bespoke;
          return obj;
        }
        const mesh = new THREE.Mesh(this.projectileGeo, this.materialFor(p.color));
        return mesh;
      },
      (obj, p) => {
        const owner = state[p.ownerRole];
        const bespoke = obj.userData.weaponVfx as WeaponVfx | undefined;
        const pos = groundPos(p.x, p.y);

        if (!bespoke) {
          // ── Generic path — unchanged from before this system existed. ──────────
          const mesh = obj as THREE.Mesh;
          mesh.material = this.materialFor(p.color);
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
          return;
        }

        // ── Bespoke path ────────────────────────────────────────────────────────
        obj.position.set(pos.x, PROJECTILE_HEIGHT, pos.z);
        const dir = normalizedDir(p.vx, p.vy);
        // Default orientation (face travel direction), same convention `match.ts`
        // uses for character facing — a `trail()` hook is free to override this.
        if (dir.x !== 0 || dir.y !== 0) obj.rotation.y = Math.atan2(dir.x, dir.y);
        if (bespoke.trail) {
          const ctx: WeaponVfxCtx = {
            THREE,
            position: obj.position.clone(),
            direction: new THREE.Vector3(dir.x, 0, dir.y),
            color: p.color,
            damage: p.damage,
            weapon: p.weapon,
            characterId: owner.characterId,
            spawnTransient: (o, life, onUpdate) => this.spawnTransientObject(o, life, onUpdate),
            object: obj,
            dt: frameDtSeconds,
          };
          bespoke.trail(ctx);
        }
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

    // ── Status telegraphs: slow (character tint + ground ring + puddle splash) /
    // stun (orbiting stars) ────────────────────────────────────────────────────
    (['player', 'enemy'] as const).forEach((role) => {
      const fighter = state[role];
      const vis = this.statusByRole[role];
      const pos = groundPos(fighter.x, fighter.y);

      // Two independent slow SOURCES — a puddle underfoot (`terrainSlowFactor`, the
      // sim's read-only per-tick observation; 1 = unaffected, see `state.ts`) and a
      // weapon's own `status.slowedUntil` timer — deliberately read as one identical
      // `slowed` signal below. The player shouldn't have to decode which source is
      // active; see the design note above `SLOW_TINT_COLOR`.
      const terrainSlowed = fighter.alive && fighter.terrainSlowFactor < 1;
      const weaponSlowed = fighter.alive && state.elapsed < fighter.status.slowedUntil;
      const slowed = terrainSlowed || weaponSlowed;

      vis.slowRing.visible = slowed;
      vis.slowRingDark.visible = slowed;
      vis.slowTint.visible = slowed;
      if (slowed) {
        const pulse = 0.9 + Math.sin(state.elapsed * 0.0035) * 0.12;
        const spin = state.elapsed * 0.0012;
        // Dark band sits a hair lower so it never z-fights the bright one.
        vis.slowRingDark.position.set(pos.x, STATUS_RING_Y - 0.01, pos.z);
        vis.slowRingDark.scale.setScalar(pulse);
        vis.slowRingDark.rotation.z = spin;
        (vis.slowRingDark.material as THREE.MeshBasicMaterial).opacity = 0.5;

        vis.slowRing.position.set(pos.x, STATUS_RING_Y, pos.z);
        vis.slowRing.scale.setScalar(pulse);
        vis.slowRing.rotation.z = spin;
        (vis.slowRing.material as THREE.MeshBasicMaterial).opacity = 0.9;

        vis.slowTint.position.set(pos.x, SLOW_TINT_CENTER_Y, pos.z);
        const tintPulse = SLOW_TINT_PEAK_OPACITY + Math.sin(state.elapsed * 0.006) * 0.08;
        (vis.slowTint.material as THREE.SpriteMaterial).opacity = tintPulse;
      }

      // Splash particles at the feet — ONLY while a puddle is the cause (not a
      // weapon slow) and only while actually moving through it, so this reads as
      // "wading through liquid" rather than a generic status particle. Distance-
      // accumulated rather than timer-based so the cadence tracks however fast the
      // fighter is actually moving (and stops the instant they stop, even if still
      // standing in the puddle).
      const splash = this.slowSplashState[role];
      if (terrainSlowed) {
        if (Number.isFinite(splash.lastX)) {
          splash.distAccum += Math.hypot(fighter.x - splash.lastX, fighter.y - splash.lastY);
          while (splash.distAccum >= PUDDLE_SPLASH_DIST_WU) {
            splash.distAccum -= PUDDLE_SPLASH_DIST_WU;
            this.spawnPuddleSplash(pos.x, pos.z);
          }
        }
      } else {
        splash.distAccum = 0;
      }
      splash.lastX = fighter.x;
      splash.lastY = fighter.y;

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
      p.sprite.scale.set(scale, scale * p.aspect, 1);
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

    // Bespoke per-weapon transients (`vfx/weapons/` hooks via `ctx.spawnTransient`)
    // — advanced on the same not-slowed-by-hit-stop clock as every pool above, so a
    // bespoke impact/cast effect stays exactly as snappy as the generic burst it's
    // standing in for. Iterated back-to-front so mid-loop removal is safe.
    for (let i = this.transientEffects.length - 1; i >= 0; i--) {
      const eff = this.transientEffects[i];
      eff.life += dtSeconds;
      if (eff.life >= eff.maxLife) {
        this.group.remove(eff.object);
        this.transientEffects.splice(i, 1);
        continue;
      }
      eff.onUpdate?.(eff.life / eff.maxLife, eff.life);
    }
  }

  /** `ctx.spawnTransient` for every `WeaponVfx` hook (see `vfx/weapons/types.ts`):
   * adds `object` to the VFX layer and removes it again after `lifetimeSeconds`,
   * calling `onUpdate(progress, elapsedSeconds)` once per `updateEffects` tick in
   * between so an author can fade/scale/move it over its life. */
  private spawnTransientObject(
    object: THREE.Object3D,
    lifetimeSeconds: number,
    onUpdate?: (progress: number, elapsedSeconds: number) => void,
  ): void {
    this.group.add(object);
    this.transientEffects.push({ object, life: 0, maxLife: Math.max(0.001, lifetimeSeconds), onUpdate });
  }

  // ── Spawn API — called from match.ts's event handling ─────────────────────────

  /** Muzzle/cast flash at the attacker, tinted the weapon's colour. Fires for every
   * `weapon-fired` event (melee wind-up, ranged muzzle, or a self-cast heal). Looks
   * up this weapon's bespoke `cast()` hook first (`vfx/weapons/`); falls back to the
   * generic flash below when it has none. */
  spawnCastFlash(xWU: number, yWU: number, facing: Vec2, weapon: Weapon, characterId: CharacterId): void {
    bumpVfxQaCount('cast');
    const origin = groundPos(xWU, yWU);
    const mag = Math.hypot(facing.x, facing.y) || 1;
    const fx = facing.x / mag;
    const fy = facing.y / mag;
    const offM = 0.7;
    const color = weapon.color;

    const bespoke = getWeaponVfx(characterId, weapon.key)?.cast;
    if (bespoke) {
      const ctx: WeaponVfxCtx = {
        THREE,
        position: new THREE.Vector3(origin.x + fx * offM, CAST_HEIGHT, origin.z + fy * offM),
        direction: new THREE.Vector3(fx, 0, fy),
        color,
        damage: weapon.damage,
        weapon,
        characterId,
        spawnTransient: (o, life, onUpdate) => this.spawnTransientObject(o, life, onUpdate),
      };
      bespoke(ctx);
      return;
    }

    // ── Generic path — unchanged from before this system existed. ────────────────
    const p = this.allocParticle();
    p.active = true;
    p.life = 0;
    p.maxLife = 0.16;
    p.sprite.visible = true;
    p.sprite.position.set(origin.x + fx * offM, CAST_HEIGHT, origin.z + fy * offM);
    p.vx = 0; p.vy = 0; p.vz = 0; p.gravity = 0;
    p.startScale = 0.75; p.endScale = 1.3;
    p.startOpacity = 1; p.endOpacity = 0; p.fadeEase = 1.6;
    p.mat.color.set(color).lerp(WHITE, 0.4);
  }

  /**
   * Swept melee cone matching the weapon's REAL `cone`/`range` exactly — this is what
   * makes a melee swing visible at all (previously nothing telegraphed the hitbox).
   * Fires on every melee `weapon-fired`, whether or not it actually connects, exactly
   * like a real swing animation would.
   */
  spawnMeleeArc(xWU: number, yWU: number, facing: Vec2, rangeWU: number, coneDeg: number, color: string): void {
    bumpVfxQaCount('meleeArc');
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
    // indicators are bold saturated shapes, not a light tint. Mixed only lightly now
    // (was 0.3) — a critic pass flagged melee arcs as reading dull/muddy next to how
    // saturated the reference bar's AOE shapes are; a hint of ink is still enough to
    // guarantee contrast on the pale floor without flattening the colour.
    w.mat.color.set(color).lerp(INK, 0.14);
    w.mat.opacity = w.startOpacity;
  }

  /**
   * Flat jagged star ground-mark at a hit location, sized comparable to a fighter's
   * own footprint. A repeated critic complaint was that every impact particle reads
   * as "a single soft circular bloom" — true even after giving shard/streak sprites
   * an angular texture, because at normal gameplay-camera distance small sprites
   * blur back into glow regardless of their own silhouette. This sidesteps that
   * entirely: a hard-edged, big-enough-to-matter SHAPE (the same flat-mesh approach
   * the melee arc uses, which the critic explicitly liked) rather than another
   * particle.
   */
  private spawnImpactStarDecal(origin: { x: number; z: number }, color: string, radiusM: number, life: number): void {
    const key = `star_${radiusM.toFixed(3)}`;
    let geo = this.wedgeGeoCache.get(key);
    if (!geo) {
      geo = buildStarPolygonGeometry(radiusM, 8, 0.42);
      this.wedgeGeoCache.set(key, geo);
    }
    const w = this.allocWedge();
    w.active = true;
    w.life = 0;
    w.maxLife = life;
    w.startOpacity = 0.9;
    w.mesh.visible = true;
    w.mesh.geometry = geo;
    w.mesh.rotation.y = Math.random() * Math.PI * 2;
    w.mesh.position.set(origin.x, GROUND_VFX_Y + 0.03, origin.z);
    // No UV on this geometry (see `buildStarPolygonGeometry`) — a flat fill, not the
    // melee arc's apex→rim gradient map. Kept close to the weapon's own SATURATED
    // colour (barely lifted toward white) rather than near-white — this needs to
    // read as a distinct coloured MARK sitting under/around the white flash, not
    // another white shape that optically fuses with it.
    w.mat.map = null;
    w.mat.needsUpdate = true;
    w.mat.color.set(color).lerp(WHITE, 0.05);
    w.mat.opacity = w.startOpacity;
  }

  /** Bright impact burst at a hit location: pop + expanding flash + double ground
   * ring + hit-spark streaks + radial shards, tinted by the damage source and scaled
   * by how hard the hit was. Sized to read as clearly BIGGER than the fighters
   * themselves for any hit that isn't trivial chip damage — matching the reference
   * bar, where combat VFX dominate the frame rather than politely sitting beside the
   * characters.
   *
   * `source`, when provided, identifies the weapon that caused this hit
   * (`combat.ts`'s `DamageSource.kind === 'weapon'` — trail/hazard/fog hits have no
   * weapon and so never look up bespoke VFX, exactly like they never had a `cast`
   * either). When that weapon has a bespoke `impact()` hook (`vfx/weapons/`), it
   * fully replaces the generic burst below; otherwise this falls back to the exact
   * generic burst that ran here before this system existed. `fromXWU`/`fromYWU`
   * (the attacker's position) are optional and only used to give the bespoke hook a
   * meaningful `ctx.direction` (attacker → hit); omit them and it's just zero. */
  spawnImpactBurst(
    xWU: number,
    yWU: number,
    color: string,
    amount: number,
    source?: { weapon: Weapon; characterId: CharacterId; fromXWU?: number; fromYWU?: number },
  ): void {
    bumpVfxQaCount('impact');
    const origin = groundPos(xWU, yWU);

    const bespoke = source && getWeaponVfx(source.characterId, source.weapon.key)?.impact;
    if (bespoke && source) {
      let dirX = 0;
      let dirY = 0;
      if (source.fromXWU !== undefined && source.fromYWU !== undefined) {
        const d = normalizedDir(xWU - source.fromXWU, yWU - source.fromYWU);
        dirX = d.x; dirY = d.y;
      }
      const ctx: WeaponVfxCtx = {
        THREE,
        position: new THREE.Vector3(origin.x, IMPACT_HEIGHT, origin.z),
        direction: new THREE.Vector3(dirX, 0, dirY),
        color,
        damage: amount,
        weapon: source.weapon,
        characterId: source.characterId,
        spawnTransient: (o, life, onUpdate) => this.spawnTransientObject(o, life, onUpdate),
      };
      bespoke(ctx);
      return;
    }

    // ── Generic path ────────────────────────────────────────────────────────────
    // `sizeFactor` is the ONE knob every element of `burst()` is multiplied by, so
    // it is also the one number that decides whether a hit is readable. It has been
    // wrong in both directions:
    //
    // Four critic rounds judged our combat VFX against Brawl Stars plates shot on a
    // much closer camera, so the same world-space effect filled far less of OUR
    // frame — and the response was to keep scaling the world-space effect up (base
    // 0.85 → 1.2, cap 3.4 → 4.4). That over-corrected past the point of absurdity:
    // measured against the current camera, the star ground-mark reached **4.4m** on
    // a **2.1m** character and each individual shard sprite reached 2.6m, i.e. a
    // single piece of debris was larger than the fighter it came off. On screen the
    // burst spanned ~270px against a ~55px character and completely swallowed it —
    // during a hit the only things still legible were the HP bar and the damage
    // number, which are HUD, not the character. An effect that hides the thing it is
    // giving feedback about has stopped being feedback.
    //
    // Re-derived against `CHARACTER_HEIGHT` rather than against a reference plate's
    // framing, so it stays anchored if the camera moves again: at typical weapon
    // damage the burst's largest opaque element is about ONE character height across
    // and every element is sized as a fraction of that (see `burst`). The character
    // stays readable through its own hit; the burst still dominates the tile it
    // lands on.
    //
    // This is load-bearing beyond this call site: nine per-weapon `vfx/weapons/*`
    // agents each tune a bespoke effect against this generic recipe as their
    // reference for "how big is a hit", so an error here gets paid for nine times.
    const sizeFactor = THREE.MathUtils.clamp(0.85 + amount * 0.035, 0.85, 2.0);
    // Fewer, bigger shards (see the shard loop's comment in `burst`) — round 2 used
    // up to 11 small ones per hit; they averaged into more glow instead of reading as
    // individual debris.
    this.burst(origin, color, sizeFactor, Math.round(THREE.MathUtils.clamp(3 + amount * 0.16, 3, 6)));
  }

  /** Bigger burst + scatter + a bright pop for a death — the biggest non-ultimate
   * moment in a match, so it deliberately outsizes even a hard hit. 2.6 against
   * `spawnImpactBurst`'s 2.0 cap keeps that ordering after the burst rescale (see the
   * note there); it is not an independent number, it is "a bit more than the hardest
   * possible hit". */
  spawnDeathBurst(xWU: number, yWU: number, color: string): void {
    bumpVfxQaCount('death');
    const origin = groundPos(xWU, yWU);
    this.burst(origin, color, 2.6, 9, { life: 1.35 });
  }

  /** Gentle rising sparkle for a heal (Hamburger's Onion Ring). */
  spawnHealPulse(xWU: number, yWU: number): void {
    bumpVfxQaCount('heal');
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
   * Small splash burst at a fighter's feet — the "wading through liquid" motion cue
   * for terrain slow (see `sync()`'s distance-accumulated splash cadence). Reuses the
   * shared particle pool exactly like every other one-shot effect in this layer, so
   * nothing new is allocated per spawn. Deliberately one neutral bright droplet
   * colour for both puddles (not per-kind grease/water tinted) — this motion cue's
   * job is "you're moving through liquid," not re-litigating which hazard this is.
   *
   * Spawn height starts at `STATUS_RING_Y` (0.3m), NOT ground level: the puddle disc
   * itself (`hazards.ts`'s `buildPuddleVisual`) sits at `FLOOR_Y.decal`/`FLOOR_Y.fine`
   * (0.15-0.25m) using `glossyMat`/`flatMat`, neither of which sets `depthWrite:
   * false` — a `transparent: true` material still writes the depth buffer by THREE's
   * own default unless told otherwise, so a particle spawned BELOW that plane (this
   * used 0.06m originally) gets depth-tested against it and is silently culled for
   * its entire life, everywhere the puddle disc covers it. Verified by temporarily
   * blowing the particles up to multi-second lifetimes and still seeing nothing
   * render — confirms occlusion, not a timing/capture artifact.
   */
  private spawnPuddleSplash(xM: number, zM: number): void {
    bumpVfxQaCount('puddleSplash');
    const count = 4;
    for (let i = 0; i < count; i++) {
      const p = this.allocParticle();
      const ang = (i / count) * Math.PI * 2 + Math.random() * 1.2;
      const r = 0.05 + Math.random() * 0.08;
      p.active = true;
      p.life = 0;
      p.maxLife = 0.3 + Math.random() * 0.12;
      p.sprite.visible = true;
      p.sprite.position.set(xM + Math.cos(ang) * r, STATUS_RING_Y, zM + Math.sin(ang) * r);
      p.vx = Math.cos(ang) * 0.6;
      p.vz = Math.sin(ang) * 0.6;
      p.vy = 1.1 + Math.random() * 0.5;
      p.gravity = -5.5;
      // ~3x the first pass (was 0.20-0.26 shrinking to 0.03). Measured against the
      // current camera those droplets spanned 0.03-0.04m for most of their life —
      // about TWO PIXELS — with a 0.22m peak on the first frame, so the splash was
      // present, correct and completely sub-perceptual. This is not the old depth bug
      // (fixed: see the spawn-height note above); it is a scale failure against a
      // camera that moved out from under it. At 0.6m a droplet is ~29% of a
      // character's height, which is a readable splash without becoming a smoke plume.
      p.startScale = 0.58 + Math.random() * 0.2;
      p.endScale = 0.12;
      p.startOpacity = 1; p.endOpacity = 0; p.fadeEase = 1;
      // Additive blending (this whole pool's material — see the constructor) washes
      // a pale colour out to near-white against a bright background rather than
      // reading as a distinct hue; that's fine here since these only need to read as
      // bright droplets of light catching a splash, not carry any colour meaning of
      // their own (this design deliberately put NO meaning on colour any more — see
      // the file header). Lifted toward white instead of fighting the blend mode.
      p.mat.color.set('#E8F8FF');
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
    bumpVfxQaCount('giantSlam');
    const origin = groundPos(xWU, yWU);
    const radiusM = wu(rangeWU);

    // Bright inner shockwave rim, racing out to the ability's true (huge) radius...
    const ring = this.allocRing();
    ring.active = true; ring.life = 0; ring.maxLife = 0.65;
    ring.startScale = 0.3; ring.targetScale = radiusM * 1.05;
    ring.startOpacity = 1;
    ring.mesh.visible = true;
    ring.mesh.position.set(origin.x, GROUND_VFX_Y + 0.02, origin.z);
    ring.mesh.scale.setScalar(ring.startScale);
    ring.mat.color.set(color).lerp(WHITE, 0.3);
    ring.mat.opacity = ring.startOpacity;

    // ...plus a second, softer ring trailing just behind it, so the shockwave reads
    // as a THICK expanding band rather than a single thin line racing outward.
    const ring2 = this.allocRing();
    ring2.active = true; ring2.life = 0; ring2.maxLife = 0.8;
    ring2.startScale = 0.15; ring2.targetScale = radiusM * 0.85;
    ring2.startOpacity = 0.6;
    ring2.mesh.visible = true;
    ring2.mesh.position.set(origin.x, GROUND_VFX_Y + 0.01, origin.z);
    ring2.mesh.scale.setScalar(ring2.startScale);
    ring2.mat.color.set(color);
    ring2.mat.opacity = ring2.startOpacity;

    // Starburst flash — the sparkle silhouette, not just a soft circle, is what
    // makes an 8-second ultimate read as a genuinely special event. Pulled back
    // slightly from round 1 (was scale 6.5 / flash-white 0.55) — big enough to
    // dominate the frame, but not so bright it fuses with the shard debris below
    // into one indistinct white mass, which a critic pass explicitly called out
    // ("zero debris/sparks" — they WERE there, just visually swallowed).
    this.spawnStarPop(origin, IMPACT_HEIGHT * 1.5, color, 5.2, 0.38);

    const flash = this.allocParticle();
    flash.active = true; flash.life = 0; flash.maxLife = 0.3;
    flash.sprite.visible = true;
    flash.sprite.position.set(origin.x, IMPACT_HEIGHT * 1.5, origin.z);
    flash.vx = 0; flash.vy = 0; flash.vz = 0; flash.gravity = 0;
    flash.startScale = 1.8; flash.endScale = 3.5;
    flash.startOpacity = 0.9; flash.endOpacity = 0; flash.fadeEase = 1.2;
    flash.mat.color.set(color).lerp(WHITE, 0.4);

    // Long hit-spark rays punching outward from the epicentre, on top of the ring —
    // SPARK_COLOR (not the weapon colour) so they read as their own bright layer.
    this.spawnStreaks(origin, IMPACT_HEIGHT * 0.6, '#FFE79A', 10, 4.5, 0.55);

    // Shards only — the dedicated flash+rings above already cover this cast's
    // "flash" and "shockwave rim" beats; a second overlapping flash/ring from the
    // shared burst helper just stacked additive brightness into a full whiteout.
    // These now render as angular crystal debris (see `burst`'s shard loop), not
    // more soft dots, so this is where the ultimate gets actual particle craft.
    this.burst(origin, color, 3.2, 14, { life: 0.9, speedMult: 1.7, skipFlash: true, skipRing: true, skipStreaks: true, skipDecal: true });
  }

  /** Shared flash+ring+decal+streaks+shards burst used by impact/death/giant-slam. */
  private burst(
    origin: { x: number; z: number },
    color: string,
    sizeFactor: number,
    shardCount: number,
    opts?: { life?: number; speedMult?: number; skipFlash?: boolean; skipRing?: boolean; skipStreaks?: boolean; skipDecal?: boolean },
  ): void {
    const life = opts?.life ?? 1;
    const speedMult = opts?.speedMult ?? 1;

    // Round 3 added a starburst "pop" here on top of the star-shaped ground decal
    // below — both pale/white, both roughly star-ish, both centred on the same
    // point, so a critic pass kept reading the two of them AS ONE shape ("a single
    // flat additive starburst sprite"). Cut entirely for the ordinary hit/death case
    // — the softer round `flash` a few lines down already covers "bright core", and
    // giant-slam keeps its OWN dedicated big pop (a real once-per-8s event, not
    // fighting a decal for the same silhouette). One star per burst, not two.

    // Ground-level jagged star mark, sized to at least match a fighter's own
    // footprint — see `spawnImpactStarDecal`'s comment for why this exists. Now the
    // ONLY star-shaped element in an ordinary hit, and deliberately outlives the
    // flash/shards by a good margin so it reads as a mark LEFT BEHIND, not part of
    // the initial pop.
    if (!opts?.skipDecal) {
      // Radius, so ~1m here is a ~2m mark — about one character height across at
      // typical weapon damage. See `spawnImpactBurst`'s note for why every
      // multiplier in this function is now expressed against the character rather
      // than against a reference plate's framing.
      this.spawnImpactStarDecal(origin, color, THREE.MathUtils.clamp(0.65 * sizeFactor, 0.55, 1.5), (0.55 + sizeFactor * 0.08) * life);
    }

    if (!opts?.skipFlash) {
      const flash = this.allocParticle();
      flash.active = true; flash.life = 0; flash.maxLife = (0.16 + sizeFactor * 0.04) * life;
      flash.sprite.visible = true;
      flash.sprite.position.set(origin.x, IMPACT_HEIGHT, origin.z);
      flash.vx = 0; flash.vy = 0; flash.vz = 0; flash.gravity = 0;
      flash.startScale = 0.5 * sizeFactor; flash.endScale = 1.15 * sizeFactor;
      flash.startOpacity = 1; flash.endOpacity = 0; flash.fadeEase = 1.4;
      flash.mat.color.set(color).lerp(WHITE, 0.3);
    }

    if (!opts?.skipRing) {
      // Bright inner rim...
      const ring = this.allocRing();
      ring.active = true; ring.life = 0; ring.maxLife = (0.24 + sizeFactor * 0.06) * life;
      ring.startScale = 0.15; ring.targetScale = 0.6 * sizeFactor + 0.35;
      ring.startOpacity = 0.95;
      ring.mesh.visible = true;
      ring.mesh.position.set(origin.x, GROUND_VFX_Y, origin.z);
      ring.mesh.scale.setScalar(ring.startScale);
      ring.mat.color.set(color).lerp(WHITE, 0.25);
      ring.mat.opacity = ring.startOpacity;

      // ...plus a softer, slightly larger companion ring right behind it, so the
      // shockwave reads as a band with body rather than a single thin line. It is
      // allowed to outrun the character's own footprint — a thin expanding rim
      // doesn't hide anything, unlike the opaque star mark above.
      const ring2 = this.allocRing();
      ring2.active = true; ring2.life = 0; ring2.maxLife = (0.32 + sizeFactor * 0.08) * life;
      ring2.startScale = 0.1; ring2.targetScale = (0.6 * sizeFactor + 0.35) * 1.35;
      ring2.startOpacity = 0.55;
      ring2.mesh.visible = true;
      ring2.mesh.position.set(origin.x, GROUND_VFX_Y - 0.01, origin.z);
      ring2.mesh.scale.setScalar(ring2.startScale);
      ring2.mat.color.set(color);
      ring2.mat.opacity = ring2.startOpacity;
    }

    // Hit-spark rays — deliberately SPARK_COLOR (a universal warm gold), not the
    // weapon's own colour, so they read as a distinct bright layer flying OVER the
    // colour-graded flash/decal rather than another same-hued shape fusing into them.
    if (!opts?.skipStreaks) {
      const streakCount = Math.max(4, Math.round(shardCount * 0.7));
      this.spawnStreaks(origin, IMPACT_HEIGHT, '#FFE79A', streakCount, (0.5 + sizeFactor * 0.5) * speedMult, 0.26 * life);
    }

    // Angular crystal-shard debris, NOT more soft glow dots (that was the critic's
    // repeated complaint across four rounds: "no shape vocabulary... reads as a
    // single flat sprite"). SPARK_COLOR, for the same reason as the streaks above —
    // every earlier round kept shards in the weapon's own hue, which is exactly what
    // let them optically merge into the flash/decal instead of reading as a separate
    // kind of thing. Sized up hard again this round (was 0.55x, now 0.95x) and, new
    // this round, each shard's `mat.rotation` is aligned to ITS OWN flight direction
    // (elongated via `aspect` along that axis) rather than a random spin — a still
    // screenshot can't show real motion, but a chunk visibly ELONGATED pointing away
    // from the epicentre reads as "flung outward" even frozen, the same trick 2D
    // hit-effect sprites have always used for exactly this problem. Pre-offset from
    // the epicentre so they read as already-scattered from the very first frame.
    // 0.4x, not 0.95x. At the old value a single shard sprite measured 2.6m against a
    // 2.1m character — one chip of debris bigger than the fighter it flew off, which
    // is most of why a hit read as one undifferentiated bloom rather than as debris.
    const shardBaseScale = 0.4 * sizeFactor;
    for (let i = 0; i < shardCount; i++) {
      const s = this.allocParticle();
      s.mat.map = this.shardTex;
      const ang = Math.random() * Math.PI * 2;
      s.mat.rotation = ang;
      s.aspect = 0.4 + Math.random() * 0.15;
      const speed = (2.6 + Math.random() * 2.8) * (0.6 + sizeFactor * 0.4) * speedMult;
      const startOffset = 0.18 + Math.random() * 0.24;
      s.active = true; s.life = 0; s.maxLife = (0.36 + Math.random() * 0.22 + sizeFactor * 0.06) * life;
      s.sprite.visible = true;
      s.sprite.position.set(
        origin.x + Math.cos(ang) * startOffset,
        IMPACT_HEIGHT,
        origin.z + Math.sin(ang) * startOffset,
      );
      s.vx = Math.cos(ang) * speed;
      s.vz = Math.sin(ang) * speed;
      s.vy = 1.3 + Math.random() * 1.8;
      s.gravity = -6.2;
      s.startScale = shardBaseScale * (0.8 + Math.random() * 0.5);
      s.endScale = shardBaseScale * 0.2;
      s.startOpacity = 1; s.endOpacity = 0; s.fadeEase = 0.85;
      s.mat.color.set(SPARK_COLOR);
    }
  }

  /**
   * Grab a free (or, failing that, closest-to-death) particle slot, reset to its
   * default look (soft glow, unrotated) so nothing a PRIOR occupant configured (a
   * star/streak texture, a rotation) leaks into this new use. Callers that want
   * something other than a plain glow dot (see `spawnStarPop`/`spawnStreaks`) set
   * `mat.map`/`mat.rotation` themselves right after allocating.
   */
  private allocParticle(): ParticleSlot {
    let best: ParticleSlot | null = null;
    for (const p of this.particles) {
      if (!p.active) { best = p; break; }
    }
    if (!best) {
      let bestRatio = -Infinity;
      for (const p of this.particles) {
        const r = p.life / p.maxLife;
        if (r > bestRatio) { bestRatio = r; best = p; }
      }
    }
    const slot = best!;
    slot.mat.map = this.glowTex;
    slot.mat.rotation = 0;
    slot.aspect = 1;
    return slot;
  }

  /** Single bright starburst pop — the instant, punchy "frame 1" flash of an impact,
   * separate from the softer colour-tinted afterglow flash that follows it. */
  private spawnStarPop(origin: { x: number; z: number }, height: number, color: string, scale: number, life: number): void {
    const p = this.allocParticle();
    p.mat.map = this.starTex;
    p.active = true; p.life = 0; p.maxLife = life;
    p.sprite.visible = true;
    p.sprite.position.set(origin.x, height, origin.z);
    p.vx = 0; p.vy = 0; p.vz = 0; p.gravity = 0;
    p.startScale = scale * 0.5; p.endScale = scale;
    p.startOpacity = 1; p.endOpacity = 0; p.fadeEase = 1.7;
    // Kept the colour more saturated (was 0.6 toward white) — a fully white-hot pop
    // at this size was blowing out the debris/streaks sharing the same space.
    p.mat.color.set(color).lerp(WHITE, 0.45);
  }

  /** Radiating hit-spark rays out of an impact point — thin bright streaks at random
   * angles, reusing one texture via per-sprite `SpriteMaterial.rotation`. This is
   * what separates a "concentrated hit" from a generic puff of particles. */
  private spawnStreaks(origin: { x: number; z: number }, height: number, color: string, count: number, length: number, life: number): void {
    for (let i = 0; i < count; i++) {
      const p = this.allocParticle();
      p.mat.map = this.streakTex;
      p.mat.rotation = Math.random() * Math.PI * 2;
      p.aspect = 0.22;
      p.active = true; p.life = 0; p.maxLife = life * (0.8 + Math.random() * 0.4);
      p.sprite.visible = true;
      p.sprite.position.set(origin.x, height, origin.z);
      p.vx = 0; p.vy = 0; p.vz = 0; p.gravity = 0;
      p.startScale = length * (0.7 + Math.random() * 0.3); p.endScale = length * 1.35;
      p.startOpacity = 0.95; p.endOpacity = 0; p.fadeEase = 1.3;
      p.mat.color.set(color).lerp(WHITE, 0.3);
    }
  }

  /** This pool is shared between melee-arc sweeps (which want `wedgeGradientTex`'s
   * apex→rim gradient, keyed to their own UVs) and the impact star decal (a UV-less
   * flat polygon, which wants a solid flat fill) — reset to the melee-arc default on
   * every allocation so a star decal's `map = null` never leaks into the next arc. */
  private allocWedge(): WedgeSlot {
    let slot: WedgeSlot | undefined;
    for (const w of this.wedges) if (!w.active) { slot = w; break; }
    if (!slot) slot = this.wedges.reduce((a, b) => (a.life / a.maxLife >= b.life / b.maxLife ? a : b));
    if (slot.mat.map !== this.wedgeGradientTex) {
      slot.mat.map = this.wedgeGradientTex;
      slot.mat.needsUpdate = true;
    }
    return slot;
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
    // Bespoke per-weapon transients (`vfx/weapons/`) — a burst mid-fade from a
    // bespoke `impact()`/`cast()` hook is exactly the kind of stale VFX this method
    // exists to drop; see `lastSyncElapsedMs`'s own reset just below for why the
    // sim-time-delta tracking resets here too.
    for (const eff of this.transientEffects) this.group.remove(eff.object);
    this.transientEffects.length = 0;
    this.lastSyncElapsedMs = 0;
    for (const role of ['player', 'enemy'] as const) {
      const vis = this.statusByRole[role];
      vis.slowRing.visible = false;
      vis.slowRingDark.visible = false;
      vis.slowTint.visible = false;
      vis.stunStars.forEach((s) => { s.visible = false; });
      // Reset footstep-distance tracking too — see the `slowSplashState` field
      // comment: stale `lastX`/`lastY` from the match just ended, carried into a
      // fresh spawn position, would otherwise read as one huge instantaneous "jump"
      // and could fire a splash burst on the very first tick of the new match.
      const splash = this.slowSplashState[role];
      splash.lastX = NaN;
      splash.lastY = NaN;
      splash.distAccum = 0;
    }
  }

  dispose(): void {
    this.clear();
    delete window.__vfxSpawnTest;
    this.projectileGeo.dispose();
    this.splatGeo.dispose();
    this.trailGeo.dispose();
    this.splatMat.dispose();
    Object.values(this.trailMats).forEach((m) => m.dispose());
    this.materialCache.forEach((m) => m.dispose());
    this.materialCache.clear();

    this.glowTex.dispose();
    this.softDiscTex.dispose();
    this.starTex.dispose();
    this.streakTex.dispose();
    this.shardTex.dispose();
    this.wedgeGradientTex.dispose();
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
      (vis.slowRingDark.material as THREE.Material).dispose();
      vis.slowRingDark.geometry.dispose();
      (vis.slowTint.material as THREE.Material).dispose();
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
