/**
 * Egg weapon VFX — the cast's BREAKABLE character.
 *
 * ── Egg's identity: SHELL FRACTURE, YOLK, ALBUMEN, and a CHICK ──────────────
 * An egg has a physical vocabulary nothing else in this roster owns, and this file
 * is built entirely out of it. Every other converted weapon breaks by SCATTERING —
 * `taco.ts` throws curved shell tiles and loose contents, `pizza.ts` throws flat
 * plates, `donut.ts` throws rings, `soup.ts` throws liquid, `lollipop.ts` owns candy
 * stripes and a boundary arc, `burrito.ts` owns a tortilla ribbon that unrolls. An
 * egg does not scatter first: it FRACTURES, and only then spills.
 *
 *   * The FRACTURE STAR. A radial burst of hard, tapered CRACK SPOKES — bright shell
 *     white over a dark seam, growing outward in 0.12 s. It is a line network, not a
 *     ring, a plate or a blob, and it is the single most identifying thing this
 *     fighter does. It appears in every hit in this file, in the air at the point of
 *     contact and again flat on the floor underneath.
 *   * YOLK. Fat, glossy, deep-orange drops that hold together and WOBBLE. Deliberately
 *     not `soup.ts`'s territory: soup is thin broth that sprays and steams, yolk is
 *     viscous, holds a round form, and this file draws no vapour of any kind.
 *   * ALBUMEN. Translucent white STRANDS that stretch and sag — the one stringy
 *     element in the roster, and Shell Shards' `effect: 'slow'` read (you are covered
 *     in something sticky).
 *   * DOWN. Weightless little feathers that flutter almost without gravity, which
 *     only Hatch! produces and which nothing else in the game has.
 *
 * Weapon keys (`game/rules.ts` -> `CHARACTERS.egg.weapons`), all converted below:
 *   `'Tackle'` Egg Tackle   — `meleeHeavy`, 16 dmg → she throws HERSELF; the heaviest
 *                             single hit in the file and the full fracture treatment
 *   `'Hatch'`  Hatch!       — `rangedMax`, `FLIGHT_MS.drift`, homing, `peckHits: 3`
 *                             → a CHICK that waddles the whole way there and pecks
 *   `'Shards'` Shell Shards — `rangedMid`, 3 pellets, `effect: 'slow'` → jagged shell
 *                             with albumen still on it
 *
 * ── Hatch! detects "landed and pecking" from the contract alone ─────────────
 * `Projectile.arrived`/`peckTimer` live in `game/state.ts` and are NOT on
 * `WeaponVfxCtx`, so `chickTrail` infers the phase from what it does have: the
 * per-frame position delta and `ctx.dt`. Once the chick's measured ground speed drops
 * under a quarter of `ctx.weapon.speed` it has stopped travelling and is pecking in
 * place, and the animation switches from a waddle to a peck cycle. Reading the speed
 * off the weapon rather than hardcoding a threshold means a re-tune in `rules.ts`
 * keeps working.
 *
 * ── Scale discipline ───────────────────────────────────────────────────────
 * Every size is a fraction of `CHARACTER_HEIGHT`, never a bare metre literal.
 * `game/vfx.ts`'s generic burst is 1.74 m typical / 3.0 m hard cap against a 2.10 m
 * character. The widest thing here is Egg Tackle's fracture star at ~2.4 m tip to tip
 * (2.8 m worst case, still inside that cap), and it is EIGHT THIN TAPERED SPIKES — it
 * occupies almost no area, and its inner end starts 0.65 m out, past the widest head
 * on this cast. The fighter stays readable straight through its own hit, which is the
 * acceptance test, and the probe frames behind every "rendering the first build
 * settled" note below are what it was checked against.
 */

import * as THREE from 'three';
import { FLIGHT_MS, type Weapon } from '../../game/rules';
import { CHARACTER_HEIGHT, wu } from '../../units';
import type { CharacterWeaponVfxMap, WeaponVfxCtx } from './types';

// ─────────────────────────────────────────────────────────────────────────────
// Palette — mirrors the module-private consts in `src/characters/egg.ts` so the
// broken shell matches the fighter it came off. (They are `const`, not exported, so
// this is a deliberate copy; the values are the contract.) Authored as wanted and
// NOT pre-compensated: the grade reproduces hue within ~4° and only destroys
// channels below ~10/255.
// ─────────────────────────────────────────────────────────────────────────────

const SHELL = '#FFF8EA';        // `PALETTE.egg` — matte porcelain
const SHELL_IN = '#E4D6AE';     // the shaded inside of a broken piece
const SHELL_HOT = '#FFFFFF';    // the freshly-split edge, at the instant it splits
/**
 * The crack itself. The DARKEST thing this file draws, and it is load-bearing: the
 * arena floor is a bright warm terracotta and every fighter on it is bright warm too,
 * so shell white alone has nothing to contrast against — a critic measured that the
 * arena's own static floor decal had more contrast than any of our combat hits. Every
 * crack spoke is a white wedge drawn over a slightly larger wedge of THIS, which
 * guarantees a hard dark outline on all sides at every size.
 */
const CRACK = '#4A3118';
const YOLK = '#FF9E12';
const YOLK_HI = '#FFCE55';
/** Egg white. Cool, pale and drawn at low opacity — the only translucent element in
 * the file, and the only one allowed to sit over the target. */
const ALBUMEN = '#F4FBFF';
const CHICK = '#FFD84D';
const CHICK_SHADE = '#EFB528';
const BEAK = '#F5872B';
const EYE = '#2A2320';
const DOWN = '#FFF0B8';

const CH = CHARACTER_HEIGHT;
const TWO_PI = Math.PI * 2;

/**
 * Ground height for anything in this file that comes to rest or is drawn flat.
 *
 * The ground stack is crowded and getting this wrong silently deletes the effect
 * (this project's single most repeated bug): floor pads 0.045–0.048, seams 0.062,
 * baked prop shadows 0.068–0.07, prop toe-kicks 0.08, arena hazard decals 0.15–0.25,
 * `game/vfx.ts`'s splats at 0.17, trail marks at 0.19, melee arcs / impact rings at
 * `GROUND_VFX_Y` 0.24. Several of those are opaque and depth-writing. 0.29 clears
 * every one, and matches what the other finished weapons settled on. Every
 * transparent material in this file also sets `depthWrite: false`, so Egg never
 * becomes the next thing that silently occludes somebody else's particles.
 */
const GROUND_Y = 0.29;

/**
 * ON THE GROUND MARK: this file leaves one, and it is a CRACK STAR, on purpose.
 *
 * `soup.ts` and `pizza.ts` both had to fight to keep their floor marks
 * distinguishable from the arena's grease/water hazard puddles (which SLOW fighters),
 * from `donut.ts`'s pink Sticky Trail discs, and from the arena's permanent beige
 * lobed floor-spill decals. Every one of those is a flat organic BLOB, and every
 * confusion between them was a blob-versus-blob confusion. A star of thin straight
 * radiating lines cannot be read as any of them at any size — it is the one ground
 * grammar nothing else in the game uses. It also fades inside a second, so it never
 * accumulates into something that looks like terrain.
 */

// ─────────────────────────────────────────────────────────────────────────────
// Scale — all anchored to the character, never to a camera framing
// ─────────────────────────────────────────────────────────────────────────────

/** The fracture star. Inner radius 0.65 m is deliberately OUTSIDE the widest head on
 * this cast — the measured worst case is Donut, whose mass is ~1.5 m across (0.75 m
 * radius); Hamburger's bun is ~1.2 m. Debris and flashes launched from dead centre
 * spend most of their life inside a silhouette a pitched top-down camera hides
 * completely; that bug shipped in `donut.ts`, `taco.ts` AND `pizza.ts`, and Pizza's
 * Cheese Blind sheet drew literally zero pixels because of it. */
const CRACK_R0 = CH * 0.31;   // 0.651 m — deliberately NOT damage-scaled: a head does
                              // not get bigger when the hit gets harder
/** How far past the contact ring a spoke reaches. This IS damage-scaled, so at Egg
 * Tackle's 16 damage (`impactScale` 1.41) the star runs 0.65 m -> ~1.16 m, i.e. 2.3 m
 * tip to tip. The first build ran to 1.8 m and rendered as a screen-filling compass
 * rose well past the generic burst's 3.0 m hard cap. */
const CRACK_LEN = CH * 0.20;  // 0.420 m
/** 0.063 m at the root — ~2.8 px at shipped framing, with a 7 px dark seam behind it.
 * Anything thinner is a sub-pixel line that aliases into a dotted grey. */
const CRACK_W = CH * 0.030;

/** Debris. `pizza.ts` established 0.13 m as the floor for "still resolves as a shape
 * rather than as a speck" at shipped framing — a character is ~10.5% of frame height
 * there, so 2.10 m spans ~95 px and one metre is ~45 px. */
const FLECK_R = CH * 0.062;   // 0.130 m shell splinter
const CAP_R = CH * 0.115;     // 0.242 m -> a 0.48 m half-shell
const YOLK_R = CH * 0.052;    // 0.109 m -> a 0.22 m drop
const STRAND_L = CH * 0.16;   // 0.336 m albumen strand
const STRAND_R = CH * 0.026;  // 0.055 m
const DOWN_R = CH * 0.045;    // 0.095 m feather

/** Hatch!'s chick: ~0.52 m tall including its shell hat. Comparable to the other
 * conversions' single-shot projectiles (Pizza's plates 0.63-0.67 m, Taco's clump
 * 0.62 m, Burrito's log 0.63 m) but a touch smaller, because Hatch! is 5 damage a
 * peck and the thing it has to sell is CHARACTER, not weight. */
const CHICK_R = CH * 0.125;   // 0.263 m body radius -> a 0.53 m bird

/** Shell Shards' pellet. */
const SHARD_R = CH * 0.085;   // 0.179 m
const SHARD_H = CH * 0.115;   // 0.242 m

// ─────────────────────────────────────────────────────────────────────────────
// Module-scope geometry/material singletons. Only the cheap Object3D/Mesh WRAPPER
// is built per spawn — the same discipline as every other conversion in this
// directory; see the `spawnTransient` doc in `types.ts` for why that split matters.
//
// Every geometry below is normalised to a UNIT BOUNDING BOX so that `scale.set()` is
// a size in metres. Without that the `CHARACTER_HEIGHT` fractions above would not
// mean what they say — three.js primitives span 2 for a radius-1 sphere, 1 for a
// unit box, and `length + 2 * radius` for a capsule.
// ─────────────────────────────────────────────────────────────────────────────

/**
 * A CRACK SPOKE — a tapered wedge, pre-rotated so its axis runs along local +X with
 * the point at +X. That is what `orientBasis` below aims, so a spoke never needs a
 * composed Euler rotation.
 */
const crackGeo = new THREE.ConeGeometry(0.5, 1, 4);
crackGeo.rotateZ(-Math.PI / 2);

/** An open shell cap — three quarters of a sphere, so the BREAK EDGE is visible as
 * the piece turns. A closed sphere is an egg; a sphere with a bite out of it is a
 * broken egg, and that difference is the whole read. */
const capGeo = new THREE.SphereGeometry(0.5, 16, 11, 0, Math.PI * 1.5);
/** A curved shell tile for Shell Shards' pellet body and its inner membrane. */
const tileGeo = new THREE.CylinderGeometry(0.5, 0.5, 1, 8, 1, true, -1.35, 2.7);
const tileInnerGeo = new THREE.CylinderGeometry(0.5, 0.5, 1, 8, 1, true, -1.2, 2.4);
/** Yolk. A sphere, and it stays a sphere — surface tension is the point. */
const blobGeo = new THREE.SphereGeometry(0.5, 12, 10);
/** Albumen strand: a stretched capsule, i.e. a rounded rod with no hard edges,
 * because egg white has none. Normalised to a unit box AND pre-rotated so the rod
 * runs along local +X, which is the axis `orientAlong` aims — so a strand is aimed
 * down its own launch vector without ever composing two Euler terms. */
const strandGeo = new THREE.CapsuleGeometry(1, 2.2, 3, 7);
strandGeo.scale(0.5, 1 / 4.2, 0.5);
strandGeo.rotateZ(-Math.PI / 2);
/** Shell splinter. A tetrahedron has the fewest faces that still read as "a hard
 * broken bit" rather than as a round particle. */
const fleckGeo = new THREE.TetrahedronGeometry(0.62, 0);
/** A down feather — a squashed 3-sided cone, so it has a soft point at one end and a
 * ragged base at the other. */
const downGeo = new THREE.ConeGeometry(0.5, 1, 3);
const boxGeo = new THREE.BoxGeometry(1, 1, 1);
const beakGeo = new THREE.ConeGeometry(0.5, 1, 4);
beakGeo.rotateX(Math.PI / 2);   // points along +Z, i.e. down the travel direction

/** Small fixed pool of material instances, cycled round-robin — the same helper (and
 * the same reasoning) as every other conversion: simultaneous elements that fade
 * independently each need their OWN `opacity`, so they need their own `Material`, and
 * a pool avoids allocating one per spawn.
 *
 * EVERY transparent material here sets `depthWrite: false`. A `transparent: true`
 * material still writes depth by three.js default, and that has silently deleted VFX
 * on this project more than once. */
function materialPool<T extends THREE.Material>(size: number, build: () => T): () => T {
  const pool = Array.from({ length: size }, build);
  let i = 0;
  return () => pool[i++ % size];
}

const fading = (color: string, extra: THREE.MeshBasicMaterialParameters = {}) =>
  new THREE.MeshBasicMaterial({ color, transparent: true, opacity: 1, depthWrite: false, side: THREE.DoubleSide, ...extra });

const nextShellMat = materialPool(34, () => fading(SHELL));
const nextYolkMat = materialPool(18, () => fading(YOLK));
const nextAlbumenMat = materialPool(18, () => fading(ALBUMEN));
const nextDownMat = materialPool(16, () => fading(DOWN));
/**
 * The fracture star, and it is deliberately NOT additive.
 *
 * A blind critic pinned an earlier weapon for having "zero impact punch — not one of
 * the six frames has a bright core", with the damning detail that the arena's own
 * static floor decal had more contrast than any of our combat hits. Additive pale
 * anything over this arena's bright warm terracotta does not make a core, it makes a
 * soft wash sitting in the same value band as the floor it is drawn on. Opaque,
 * hard-edged, and white-over-black is what says an event happened here.
 *
 * 40 slots: Egg Tackle spends 18 on the air star and 14 on the ground star at once,
 * and a smaller pool would hand the same material to two live spokes, which would
 * then fight over its `opacity` every frame.
 */
const nextCrackMat = materialPool(40, () => fading(SHELL_HOT));

/**
 * PROJECTILE BODIES get their own materials, and nothing ever animates their opacity.
 *
 * This is not a stylistic split. In `soup.ts` the projectile bodies drew from the
 * same pools as the particles — which are handed round-robin to a stream of debris
 * that each fade THEMSELVES to zero — so a projectile in flight shared a material
 * with a particle spawned a moment later and vanished mid-flight the instant that
 * particle faded out.
 *
 * Hatch! makes that worse than usual and is the reason the chick's body materials are
 * POOLED rather than single: its cooldown is 2600 ms but a chick's total life is its
 * 1750 ms flight plus 3 x 500 ms of pecking = 3250 ms, so TWO CHICKS ARE ALIVE AT
 * ONCE by construction. A single shared body material recoloured from `ctx.color` at
 * build time would make the second chick recolour the first.
 */
const opaque = (color: string, extra: THREE.MeshBasicMaterialParameters = {}) =>
  new THREE.MeshBasicMaterial({ color, side: THREE.DoubleSide, ...extra });

const bodyShellMat = opaque(SHELL);
const bodyShellInMat = opaque(SHELL_IN);
/** The chick's hat has its OWN material rather than sharing `bodyShellMat` with the
 * Shell Shards pellet: a chick can be in the air at the same time as a shard, and the
 * shard tints its shell from `ctx.color`. */
const bodyHatMat = opaque(SHELL);
const bodyBeakMat = opaque(BEAK);
const bodyEyeMat = opaque(EYE);
const bodyChickShadeMat = opaque(CHICK_SHADE);
/** One slot per simultaneously-live chick — see the block comment above. */
const chickBodyMats = [opaque(CHICK), opaque(CHICK), opaque(CHICK)];
let chickMatCursor = 0;

// ─────────────────────────────────────────────────────────────────────────────
// Helpers
// ─────────────────────────────────────────────────────────────────────────────

/**
 * ORIENTATION RULE FOR THIS FILE.
 *
 * Composing `rotation.x` then `rotation.y` does NOT rotate a flat form about world
 * up — Euler angles are intrinsic and sequential, so the second angle turns the
 * already-tipped form and swings it edge-on, which is a recorded "rendering but
 * invisible" cause on this project. So:
 *
 *   * Every crack spoke — the one element that MUST read or the effect has no
 *     punch — is aimed by `orientBasis`, which builds an explicit orthonormal basis
 *     and sets a QUATERNION.
 *   * The flat ground star lies in a horizontal plane and is only ever YAWED: a
 *     single `rotation.y` on a slat whose face normal is +Y, which is the safe case.
 *   * Free-tumbling DEBRIS is the one deliberate exception. A splinter that is
 *     edge-on for part of its arc is what tumbling looks like.
 */
const _ax = new THREE.Vector3();
const _ay = new THREE.Vector3();
const _az = new THREE.Vector3();
const _basis = new THREE.Matrix4();

/** Orient `obj` so its local +X runs along (tx,ty,tz). The reference "up" is world up
 * unless the direction is nearly vertical, in which case the basis would be
 * degenerate. Scratch vectors are module-scope: this runs once per spoke per frame
 * and must not allocate. */
function orientAlong(obj: THREE.Object3D, tx: number, ty: number, tz: number): void {
  _ax.set(tx, ty, tz).normalize();
  if (Math.abs(_ax.y) > 0.94) _ay.set(1, 0, 0);
  else _ay.set(0, 1, 0);
  _az.crossVectors(_ax, _ay).normalize();
  _ay.crossVectors(_az, _ax).normalize();
  _basis.makeBasis(_ax, _ay, _az);
  obj.quaternion.setFromRotationMatrix(_basis);
}

/** Seconds this projectile spends in the air, straight off the `REACH`/`FLIGHT_MS`
 * ladders in `rules.ts`, so tumble rates authored as TURNS PER FLIGHT survive a
 * weapon changing rung. */
function flightSeconds(w: Weapon): number {
  if (w.range && w.speed) return w.range / w.speed;
  return FLIGHT_MS.normal / 1000;
}

/**
 * Impact scale, matched to the recipe `game/vfx.ts` re-derived for the generic burst
 * (`clamp(0.85 + damage * 0.035, ...)`), so an Egg hit reads as the same WEIGHT of
 * event as any other weapon's at the same damage. Egg Tackle is 16 damage — the
 * hardest hit in this file and near the top of the roster — so the cap is 1.45.
 */
function impactScale(damage: number): number {
  return THREE.MathUtils.clamp(0.85 + damage * 0.035, 0.85, 1.45);
}

// ─────────────────────────────────────────────────────────────────────────────
// Debris spawners. Every one of these SETS its material's opacity and colour and
// never READS them: the previous user of a pooled slot faded it to ~0 and left it
// there, so reading that as a starting value means every particle in the game spawns
// invisible once the pool wraps — about a second of firing. That bug shipped in
// `soup.ts`'s `spawnDroplet` and in `lollipop.ts`, and deleted the effect's whole
// identity mid-match.
// ─────────────────────────────────────────────────────────────────────────────

/** Generic ballistic debris: launch, tumble, settle onto the floor, fade. */
function spawnDebris(
  ctx: WeaponVfxCtx,
  geo: THREE.BufferGeometry,
  mat: THREE.MeshBasicMaterial,
  color: string,
  ox: number, oy: number, oz: number,
  vx: number, vy: number, vz: number,
  sx: number, sy: number, sz: number,
  life: number,
  gravity = -9,
): void {
  mat.color.set(color);
  mat.opacity = 1;
  const mesh = new THREE.Mesh(geo, mat);
  mesh.renderOrder = 9;
  mesh.position.set(ox, oy, oz);
  mesh.scale.set(sx, sy, sz);
  mesh.rotation.set(Math.random() * TWO_PI, Math.random() * TWO_PI, Math.random() * TWO_PI);
  const rx = (Math.random() - 0.5) * 20;
  const ry = (Math.random() - 0.5) * 20;
  const rz = (Math.random() - 0.5) * 20;
  const r0x = mesh.rotation.x, r0y = mesh.rotation.y, r0z = mesh.rotation.z;
  ctx.spawnTransient(mesh, life, (t, e) => {
    const y = oy + vy * e + 0.5 * gravity * e * e;
    const grounded = y <= GROUND_Y;
    mesh.position.set(ox + vx * e, grounded ? GROUND_Y : y, oz + vz * e);
    if (!grounded) mesh.rotation.set(r0x + rx * e, r0y + ry * e, r0z + rz * e);
    mat.opacity = 1 - Math.pow(t, 2.4);
  });
}

/** A hard shell splinter. */
function spawnFleck(
  ctx: WeaponVfxCtx, ox: number, oy: number, oz: number,
  vx: number, vy: number, vz: number, scale: number, life: number,
): void {
  const r = FLECK_R * scale * (0.75 + Math.random() * 0.6);
  spawnDebris(
    ctx, fleckGeo, nextShellMat(), Math.random() < 0.3 ? SHELL_IN : SHELL,
    ox, oy, oz, vx, vy, vz, r, r * 0.8, r, life,
  );
}

/**
 * A YOLK DROP. Fat, glossy and slow — it holds its round form the whole way, and it
 * WOBBLES rather than tumbling. That is the deliberate contrast with `soup.ts`'s
 * broth, which sprays and thins: yolk has surface tension and this is what surface
 * tension looks like at 10 px.
 */
function spawnYolk(
  ctx: WeaponVfxCtx, ox: number, oy: number, oz: number,
  vx: number, vy: number, vz: number, scale: number, life: number,
): void {
  const mat = nextYolkMat();
  mat.color.set(Math.random() < 0.3 ? YOLK_HI : YOLK);
  mat.opacity = 1;
  const drop = new THREE.Mesh(blobGeo, mat);
  drop.renderOrder = 9;
  const r = YOLK_R * scale * (0.8 + Math.random() * 0.6);
  drop.position.set(ox, oy, oz);
  drop.scale.setScalar(r);
  const wob = 14 + Math.random() * 10;
  const phase = Math.random() * TWO_PI;
  ctx.spawnTransient(drop, life, (t, e) => {
    const y = oy + vy * e - 4.4 * e * e;
    drop.position.set(ox + vx * e, Math.max(GROUND_Y, y), oz + vz * e);
    // Volume-preserving squash: it is a liquid, so it never changes size, only shape.
    const s = Math.sin(phase + e * wob) * 0.24;
    drop.scale.set(r * (1 + s), r * (1 - s), r * (1 + s * 0.4));
    mat.opacity = 1 - Math.pow(t, 3);
  });
}

/**
 * An ALBUMEN STRAND. Stretches as it flies, sags under almost no gravity, and is the
 * only translucent thing in the file. `effect: 'slow'` lives on Shell Shards and this
 * is what carries it visually.
 */
function spawnStrand(
  ctx: WeaponVfxCtx, ox: number, oy: number, oz: number,
  vx: number, vy: number, vz: number, scale: number, life: number,
): void {
  const mat = nextAlbumenMat();
  mat.color.set(ALBUMEN);
  mat.opacity = 0.78;
  const strand = new THREE.Mesh(strandGeo, mat);
  strand.renderOrder = 10;
  strand.position.set(ox, oy, oz);
  const l0 = STRAND_L * scale * (0.55 + Math.random() * 0.4);
  const w = STRAND_R * scale * (0.75 + Math.random() * 0.5);
  orientAlong(strand, vx, vy, vz);
  strand.scale.set(l0, w, w);
  ctx.spawnTransient(strand, life, (t, e) => {
    const y = oy + vy * e - 2.2 * e * e;
    strand.position.set(ox + vx * e, Math.max(GROUND_Y, y), oz + vz * e);
    // It STRETCHES and thins — the thing that makes it read as a string of egg white
    // rather than as a white stick.
    strand.scale.set(l0 * (1 + t * 1.5), w * (1 - t * 0.4), w * (1 - t * 0.4));
    mat.opacity = 0.78 * (1 - Math.pow(t, 1.8));
  });
}

/** A DOWN FEATHER. Almost weightless, flutters side to side, takes ages to fall —
 * the softest motion in the game and Hatch!'s alone. */
function spawnDown(
  ctx: WeaponVfxCtx, ox: number, oy: number, oz: number,
  vx: number, vz: number, scale: number, life: number,
): void {
  const mat = nextDownMat();
  mat.color.set(Math.random() < 0.35 ? CHICK : DOWN);
  mat.opacity = 1;
  const f = new THREE.Mesh(downGeo, mat);
  f.renderOrder = 9;
  const r = DOWN_R * scale * (0.7 + Math.random() * 0.6);
  f.position.set(ox, oy, oz);
  f.scale.set(r, r * 1.5, r * 0.35);
  const sway = 4 + Math.random() * 4;
  const phase = Math.random() * TWO_PI;
  ctx.spawnTransient(f, life, (t, e) => {
    f.position.set(
      ox + vx * e + Math.sin(phase + e * sway) * 0.10,
      oy + 0.35 * e - 0.55 * e * e,
      oz + vz * e + Math.cos(phase + e * sway * 0.8) * 0.10,
    );
    f.rotation.set(Math.sin(phase + e * sway) * 1.5, e * 2.2, Math.cos(phase + e * sway * 0.7) * 1.2);
    mat.opacity = 1 - Math.pow(t, 2);
  });
}

/**
 * THE FRACTURE STAR — Egg's "an event happened here" beat, and the thing that makes
 * every hit in this file read as this fighter's.
 *
 * `count` hard tapered spokes shooting outward in 3D from a CONTACT RING, gone in
 * 0.13 s. Each is a bright shell-white wedge drawn over a slightly fatter wedge of
 * near-black crack, so it carries both ends of the value range and cannot dissolve
 * into a pale warm floor. It starts at 0.69 m from the hit — past the widest head on
 * this cast — and reaches 1.09 m, so it is entirely OUTSIDE the silhouette and can be
 * this loud without hiding the fighter it is giving feedback about.
 */
function spawnFractureStar(ctx: WeaponVfxCtx, count: number, scale: number, life = 0.13): void {
  const { x, y, z } = ctx.position;
  const d = ctx.direction;
  const base = Math.random() * TWO_PI;
  for (let i = 0; i < count; i++) {
    // Wide angular jitter. Evenly spaced spokes render as a compass rose, which reads
    // as a decorative starburst rather than as something breaking.
    const a = base + (i / count) * TWO_PI + (Math.random() - 0.5) * 0.5;
    // Alternating elevation, so the star is a 3D burst rather than a flat disc — a
    // flat disc is what `donut.ts` owns, and at this camera pitch a horizontal one
    // also foreshortens into an ellipse.
    const el = ((i % 3) - 1) * 0.42 + (Math.random() - 0.5) * 0.2;
    const ca = Math.cos(el);
    const dx = Math.cos(a) * ca, dy = Math.sin(el), dz = Math.sin(a) * ca;
    const mat = nextCrackMat();
    mat.color.set(i % 2 === 0 ? SHELL_HOT : SHELL);
    mat.opacity = 1;
    const seamMat = nextCrackMat();
    seamMat.color.set(CRACK);
    seamMat.opacity = 1;
    const spoke = new THREE.Mesh(crackGeo, mat);
    const seam = new THREE.Mesh(crackGeo, seamMat);
    spoke.renderOrder = 13;
    seam.renderOrder = 12;
    const r0 = CRACK_R0;
    const r1 = r0 + CRACK_LEN * scale * (0.7 + Math.random() * 0.55);
    const w = CRACK_W * (0.8 + Math.random() * 0.45);
    // Biased along the incoming shot, so the star leans away from the attacker the
    // way a struck shell actually breaks.
    const bx = x + d.x * r0 * 0.22, bz = z + d.z * r0 * 0.22;
    const group = new THREE.Group();
    group.add(seam, spoke);
    orientAlong(spoke, dx, dy, dz);
    seam.quaternion.copy(spoke.quaternion);
    ctx.spawnTransient(group, life, (t) => {
      const e = 1 - Math.pow(1 - t, 2.4);
      const inner = THREE.MathUtils.lerp(r0, r0 + (r1 - r0) * 0.45, e);
      const outer = THREE.MathUtils.lerp(r0 + (r1 - r0) * 0.35, r1, e);
      const len = Math.max(0.02, outer - inner);
      const mid = (inner + outer) * 0.5;
      spoke.position.set(bx + dx * mid, y + dy * mid, bz + dz * mid);
      seam.position.copy(spoke.position);
      spoke.scale.set(len, w, w);
      // 1.55x fatter and 1.06x longer, i.e. a hard dark rim on all sides. Measured
      // rather than guessed: at 1.2x the rim was under 2 px at shipped framing —
      // present in the buffer, invisible on screen.
      // 2.6x fatter, not 1.6x. MEASURED at shipped framing: at 1.6x the dark rim was
      // 0.9 px each side — present in the buffer, invisible on screen — and the star
      // read as bare white spikes with nothing separating them from a pale warm
      // floor. This is the same "it renders but you cannot see it" failure this
      // project has now hit eleven times, at sub-pixel scale.
      seam.scale.set(len * 1.06, w * 2.6, w * 2.6);
      // Held at full for the first 45%, then cut. A flash that starts fading on frame
      // one never has a bright frame at all.
      const o = t < 0.45 ? 1 : 1 - (t - 0.45) / 0.55;
      mat.opacity = o;
      seamMat.opacity = o;
    });
  }
}

/**
 * THE GROUND CRACK — the same fracture grammar, flat on the floor, lingering after
 * everything in the air has gone. See the note near `GROUND_Y` for why a star of
 * straight lines is the one ground mark that can never be confused with the arena's
 * hazard puddles, Donut's sticky discs, or the permanent beige floor spills.
 */
function spawnGroundCrack(ctx: WeaponVfxCtx, count: number, scale: number, life: number): void {
  const { x, z } = ctx.position;
  const base = Math.random() * TWO_PI;
  const group = new THREE.Group();
  const mat = nextCrackMat();
  mat.color.set(SHELL_HOT);
  mat.opacity = 1;
  const seamMat = nextCrackMat();
  seamMat.color.set(CRACK);
  seamMat.opacity = 1;
  const spokes: Array<{ face: THREE.Mesh; seam: THREE.Mesh; a: number; len: number; w: number }> = [];
  for (let i = 0; i < count; i++) {
    const a = base + (i / count) * TWO_PI + (Math.random() - 0.5) * 0.55;
    const seam = new THREE.Mesh(crackGeo, seamMat);
    const face = new THREE.Mesh(crackGeo, mat);
    seam.renderOrder = 10;
    face.renderOrder = 11;
    seam.scale.setScalar(0);
    face.scale.setScalar(0);
    // `crackGeo` is a TAPERED wedge pointing along +X, and `orientAlong` aims it
    // horizontally. That matters more than it sounds: the first build used uniform
    // boxes of near-equal length and the ground mark rendered as a clean symmetrical
    // asterisk — it read as a decorative sun decal, not as a shell cracking. Uneven
    // tapered spikes read as a fracture.
    orientAlong(face, Math.cos(a), 0, Math.sin(a));
    seam.quaternion.copy(face.quaternion);
    group.add(seam, face);
    spokes.push({
      face, seam, a,
      len: CH * (0.16 + Math.random() * 0.30) * scale,
      w: CH * (0.020 + Math.random() * 0.014) * scale,
    });
  }
  const r0 = CH * 0.20 * scale;
  const layout = (t: number): void => {
    const e = 1 - Math.pow(1 - Math.min(1, t / 0.22), 2.6);
    for (const s of spokes) {
      const len = Math.max(0.001, s.len * e);
      const mid = r0 + len * 0.5;
      const px = x + Math.cos(s.a) * mid;
      const pz = z + Math.sin(s.a) * mid;
      s.face.position.set(px, GROUND_Y + 0.012, pz);
      s.seam.position.set(px, GROUND_Y, pz);
      s.face.scale.set(len, CH * 0.006, s.w);
      s.seam.scale.set(len * 1.05, CH * 0.004, s.w * 2.1);
    }
    const fade = t < 0.42 ? 1 : 1 - (t - 0.42) / 0.58;
    mat.opacity = 0.92 * fade;
    seamMat.opacity = 0.92 * fade;
  };
  layout(0);
  ctx.spawnTransient(group, life, layout);
}

/**
 * THE SHELL SPLITTING — two big caps flung apart across the line of fire, break edges
 * out. This is the beat that says the thing that hit you was an EGG.
 */
function spawnShellSplit(ctx: WeaponVfxCtx, scale: number, speed: number, life: number): void {
  const { x, y, z } = ctx.position;
  const d = ctx.direction;
  let px = -d.z, pz = d.x;
  if (Math.hypot(px, pz) < 1e-4) { px = 1; pz = 0; }
  for (const side of [-1, 1] as const) {
    const mat = nextShellMat();
    mat.color.set(side < 0 ? SHELL : SHELL_IN);
    mat.opacity = 1;
    const cap = new THREE.Mesh(capGeo, mat);
    cap.renderOrder = 10;
    // Born already parted by a head-radius. Two halves that start coincident at the
    // point of contact spend their first third inside the target, which is the exact
    // bug found in `donut.ts`, `taco.ts` and `pizza.ts`.
    const bx = x + px * side * CH * 0.26 * scale;
    const bz = z + pz * side * CH * 0.26 * scale;
    const r = CAP_R * 2 * scale;
    cap.position.set(bx, y, bz);
    cap.scale.set(r, r * 1.15, r);
    cap.rotation.set(0, side * 1.4, 0);
    const vx = px * side * speed + d.x * speed * 0.35;
    const vz = pz * side * speed + d.z * speed * 0.35;
    const vy = 1.6 + Math.random() * 0.9;
    const spin = side * (6 + Math.random() * 4);
    const tilt = (Math.random() - 0.5) * 5;
    ctx.spawnTransient(cap, life, (t, e) => {
      const yy = y + vy * e - 4.6 * e * e;
      cap.position.set(bx + vx * e, Math.max(GROUND_Y, yy), bz + vz * e);
      cap.rotation.set(tilt * e, side * 1.4 + spin * e, side * 0.4);
      mat.opacity = 1 - Math.pow(t, 2.2);
    });
  }
}

// ─────────────────────────────────────────────────────────────────────────────
// Projectile builders
// ─────────────────────────────────────────────────────────────────────────────

/**
 * THE CHICK — Hatch!'s projectile, and the most literal thing in this directory.
 *
 * Hatch! is `FLIGHT_MS.drift` (1750 ms), the slowest projectile in the game by a
 * factor of two, which is exactly why it can afford to be a CHARACTER rather than a
 * shape: the player has nearly two seconds to look at it. So it is built for
 * recognition at ~24 px — a round downy body, a hard orange beak, two black eyes, two
 * stub wings, two feet, and the broken half-shell still sitting on its head, which is
 * the single cue that makes it read as JUST HATCHED rather than as a yellow ball.
 *
 * The whole bird lives in a `bob` child group, because `game/vfx.ts` overwrites the
 * ROOT object's `rotation.y` every frame with its face-travel default. Waddling the
 * child composes cleanly with that and can never fight it.
 */
function buildChick(color: string): THREE.Group {
  const group = new THREE.Group();
  const bob = new THREE.Group();
  group.add(bob);

  const bodyMat = chickBodyMats[chickMatCursor++ % chickBodyMats.length];
  bodyMat.color.set(color);

  const R = CHICK_R;
  const body = new THREE.Mesh(blobGeo, bodyMat);
  body.scale.set(R * 2, R * 1.85, R * 1.9);
  body.position.y = R * 0.15;
  bob.add(body);

  // A darker belly, so the round body has a bottom and does not read as a flat disc
  // from a pitched top-down camera.
  const belly = new THREE.Mesh(blobGeo, bodyChickShadeMat);
  belly.scale.set(R * 1.5, R * 0.8, R * 1.45);
  belly.position.set(0, -R * 0.42, R * 0.18);
  bob.add(belly);

  // The BEAK — pre-rotated to point along +Z, i.e. down the travel direction.
  const beak = new THREE.Mesh(beakGeo, bodyBeakMat);
  beak.scale.set(R * 0.55, R * 0.46, R * 0.70);
  beak.position.set(0, R * 0.26, R * 0.92);
  bob.add(beak);

  for (const side of [-1, 1] as const) {
    // Eyes sit HIGH and forward. The camera is pitched 58 deg and looks down on this
    // thing, so anything placed on the vertical front face foreshortens to nothing —
    // the eyes have to be visible from above or the bird has no face at all.
    const eye = new THREE.Mesh(blobGeo, bodyEyeMat);
    eye.scale.setScalar(R * 0.34);
    eye.position.set(side * R * 0.40, R * 0.62, R * 0.62);
    bob.add(eye);

    // Stub wings, held out — a chick that has just hatched has not folded them yet.
    const wing = new THREE.Mesh(blobGeo, bodyChickShadeMat);
    wing.scale.set(R * 0.34, R * 0.85, R * 1.05);
    wing.position.set(side * R * 0.92, R * 0.08, -R * 0.1);
    wing.rotation.z = side * 0.4;
    bob.add(wing);
    wing.userData.__side = side;

    // Feet.
    const foot = new THREE.Mesh(boxGeo, bodyBeakMat);
    foot.scale.set(R * 0.18, R * 0.10, R * 0.44);
    foot.position.set(side * R * 0.34, -R * 0.92, R * 0.12);
    bob.add(foot);
  }

  // THE SHELL HAT — the broken top of the egg she came out of, still perched on her
  // head. The single strongest identity cue in the silhouette and the thing that ties
  // this projectile back to the rest of the file.
  // Smaller and tilted, not a lid. Rendering the first build settled that: at 1.7x
  // the body radius and sitting square on top, the cap swallowed the whole head from
  // a pitched top-down camera and the projectile read as a white blob with a yellow
  // bottom. Perched to one side it leaves the face visible and reads as something
  // she has not shaken off yet.
  const hat = new THREE.Mesh(capGeo, bodyHatMat);
  hat.scale.set(R * 1.22, R * 1.0, R * 1.22);
  hat.position.set(-R * 0.16, R * 0.88, -R * 0.22);
  hat.rotation.set(Math.PI - 0.42, 0.7, 0.3);
  bob.add(hat);

  const hatRim = new THREE.Mesh(capGeo, bodyShellInMat);
  hatRim.scale.set(R * 1.08, R * 0.8, R * 1.08);
  hatRim.position.set(-R * 0.16, R * 0.86, -R * 0.22);
  hatRim.rotation.set(Math.PI - 0.42, 0.7, 0.3);
  bob.add(hatRim);

  group.userData.__bob = bob;
  return group;
}

/**
 * A SHELL SHARD — one pellet of Shell Shards.
 *
 * A curved tile with a visibly different INSIDE (the membrane) and a jagged splinter
 * off one edge, so a tumbling fragment reads as a piece of something hollow rather
 * than as a chip. Shell Shards carries `effect: 'slow'`, so it also flies with a
 * strand of albumen still hanging off it.
 */
function buildShard(color: string): THREE.Group {
  const group = new THREE.Group();
  bodyShellMat.color.set(color);

  const outer = new THREE.Mesh(tileGeo, bodyShellMat);
  outer.scale.set(SHARD_R * 2, SHARD_H, SHARD_R * 2);
  group.add(outer);

  const inner = new THREE.Mesh(tileInnerGeo, bodyShellInMat);
  inner.scale.set(SHARD_R * 1.78, SHARD_H * 0.92, SHARD_R * 1.78);
  group.add(inner);

  for (let i = 0; i < 2; i++) {
    const chip = new THREE.Mesh(fleckGeo, bodyShellMat);
    const s = SHARD_R * (0.42 + i * 0.18);
    chip.scale.set(s, s * 0.7, s);
    chip.position.set(SHARD_R * (i === 0 ? 0.8 : -0.5), SHARD_H * (i === 0 ? 0.45 : -0.5), SHARD_R * 0.4);
    chip.rotation.set(Math.random() * 2, Math.random() * 2, Math.random() * 2);
    group.add(chip);
  }

  // A bead of albumen still clinging to the inside — the slow effect, made visible on
  // the projectile itself rather than only on the hit.
  const goo = new THREE.Mesh(blobGeo, bodyShellInMat);
  goo.scale.set(SHARD_R * 0.75, SHARD_R * 0.4, SHARD_R * 0.75);
  goo.position.set(-SHARD_R * 0.2, -SHARD_H * 0.34, 0);
  group.add(goo);

  return group;
}

// ─────────────────────────────────────────────────────────────────────────────
// Hook bodies
// ─────────────────────────────────────────────────────────────────────────────

/** Per-projectile animation state, stashed on the pooled object — Shell Shards has
 * three in flight at once and Hatch! can have two, so this cannot be module state. */
interface Anim { t: number; rate: number; shed: number; age: number; lx: number; lz: number; speed: number; }
function animState(obj: THREE.Object3D, ctx: WeaponVfxCtx, turnsPerFlight: number): Anim {
  let st = obj.userData.__anim as Anim | undefined;
  if (!st) {
    st = {
      t: Math.random() * TWO_PI,
      rate: (turnsPerFlight * TWO_PI) / flightSeconds(ctx.weapon),
      shed: 0,
      age: 0,
      lx: ctx.position.x,
      lz: ctx.position.z,
      // Seeded at the weapon's OWN cruise speed, converted from world units to
      // metres. Seeding at zero would make the very first frame look stationary and
      // the chick would start pecking before it had gone anywhere.
      speed: wu(ctx.weapon.speed ?? 160),
    };
    obj.userData.__anim = st;
  }
  return st;
}

function chickTrail(ctx: WeaponVfxCtx): void {
  const obj = ctx.object;
  if (!obj) return;
  const dt = ctx.dt ?? 0;
  const st = animState(obj, ctx, 1);
  st.age += dt;

  // "Has it arrived?", derived from the contract alone — see the file header.
  const moved = Math.hypot(ctx.position.x - st.lx, ctx.position.z - st.lz);
  if (dt > 0) st.speed = st.speed * 0.55 + (moved / dt) * 0.45;
  st.lx = ctx.position.x;
  st.lz = ctx.position.z;
  const cruise = wu(ctx.weapon.speed ?? 160);
  const pecking = st.speed < cruise * 0.28;

  const bob = obj.userData.__bob as THREE.Object3D | undefined;
  if (bob) {
    if (pecking) {
      // THE PECK. A fast forward-and-down lunge on a 2.4 Hz cycle, which is roughly
      // `peckInterval` (500 ms) — the sim lands a hit on the same beat, so the
      // animation and the damage read as the same event.
      const p = (st.age * 2.2) % 1;
      const lunge = Math.sin(Math.min(1, p * 2.2) * Math.PI);
      bob.position.set(0, -CHICK_R * 0.30 * lunge, CHICK_R * 0.75 * lunge);
      bob.rotation.set(lunge * 0.95, 0, 0);
    } else {
      // THE WADDLE. Hatch! takes 1750 ms to arrive — the slowest projectile in the
      // game — so what it does on the way there is most of what the player sees of
      // it. It rocks side to side and bobs, which is the only motion in the roster
      // that reads as ALIVE rather than as thrown.
      const w = st.age * 7.0;
      bob.position.set(0, Math.abs(Math.sin(w)) * CHICK_R * 0.22, 0);
      bob.rotation.set(0, 0, Math.sin(w * 0.5) * 0.30);
      for (const child of bob.children) {
        const side = child.userData.__side as number | undefined;
        if (side !== undefined) child.rotation.z = side * (0.4 + Math.sin(w) * 0.5);
      }
    }
  }

  st.shed -= dt;
  if (st.shed <= 0) {
    st.shed = pecking ? 0.10 + Math.random() * 0.08 : 0.20 + Math.random() * 0.14;
    spawnDown(
      ctx,
      ctx.position.x + (Math.random() - 0.5) * CHICK_R,
      ctx.position.y + CHICK_R * 0.3,
      ctx.position.z + (Math.random() - 0.5) * CHICK_R,
      -ctx.direction.x * 0.25 + (Math.random() - 0.5) * 0.35,
      -ctx.direction.z * 0.25 + (Math.random() - 0.5) * 0.35,
      1, 0.7,
    );
  }
}

/**
 * THE PECK — Hatch!'s hit. Deliberately the smallest impact in the file: 5 damage,
 * three times, from a bird. It still uses the fracture grammar (a four-spoke star) so
 * it is unmistakably the same fighter, but at 60% scale and with down instead of
 * yolk, because what pecked you was not the egg, it was what came out of it.
 */
function peckImpact(ctx: WeaponVfxCtx): void {
  const s = impactScale(ctx.damage) * 0.75;
  const { x, y, z } = ctx.position;
  const d = ctx.direction;

  spawnFractureStar(ctx, 4, s * 0.72, 0.11);

  const R0 = CH * 0.22 * s;
  for (let i = 0; i < 4; i++) {
    const a = (i / 4) * TWO_PI + Math.random() * 0.8;
    const out = (1.9 + Math.random() * 1.2) * s;
    spawnFleck(
      ctx, x + Math.cos(a) * R0, y, z + Math.sin(a) * R0,
      Math.cos(a) * out + d.x * 0.5, 1.5 + Math.random() * 1.0, Math.sin(a) * out + d.z * 0.5,
      0.8 * s, 0.34,
    );
  }
  for (let i = 0; i < 5; i++) {
    const a = Math.random() * TWO_PI;
    spawnDown(
      ctx, x + Math.cos(a) * R0, y + CH * 0.05, z + Math.sin(a) * R0,
      Math.cos(a) * (0.9 + Math.random() * 0.8), Math.sin(a) * (0.9 + Math.random() * 0.8),
      s, 0.62,
    );
  }
}

function shardTrail(ctx: WeaponVfxCtx): void {
  const obj = ctx.object;
  if (!obj) return;
  const dt = ctx.dt ?? 0;
  const st = animState(obj, ctx, 1.9);
  st.t += st.rate * dt;
  // A broken piece of shell is not aerodynamic — it goes end over end on more than
  // one axis. `game/vfx.ts` overwrites `rotation.y` every frame with its face-travel
  // default, so the tumble is written into x and z.
  obj.rotation.x = st.t;
  obj.rotation.z = Math.sin(st.t * 0.7) * 1.0;

  st.shed -= dt;
  if (st.shed <= 0) {
    st.shed = 0.075 + Math.random() * 0.05;
    const bx = ctx.position.x - ctx.direction.x * SHARD_R;
    const bz = ctx.position.z - ctx.direction.z * SHARD_R;
    if (Math.random() < 0.45) {
      // It is WET — a shard still carrying albumen drips it the whole way there,
      // which is the in-flight version of the slow effect it applies on landing.
      spawnStrand(
        ctx, bx, ctx.position.y - SHARD_R * 0.3, bz,
        -ctx.direction.x * 0.35 + (Math.random() - 0.5) * 0.4, -0.5 - Math.random() * 0.4,
        -ctx.direction.z * 0.35 + (Math.random() - 0.5) * 0.4,
        0.6, 0.3,
      );
    } else {
      spawnFleck(
        ctx, bx, ctx.position.y, bz,
        -ctx.direction.x * 0.7 + (Math.random() - 0.5) * 0.6, 0.1 + Math.random() * 0.3,
        -ctx.direction.z * 0.7 + (Math.random() - 0.5) * 0.6,
        0.7, 0.28,
      );
    }
  }
}

// ─────────────────────────────────────────────────────────────────────────────

export const eggWeaponVfx: CharacterWeaponVfxMap = {
  // ── Egg Tackle (melee, 16 dmg) ─────────────────────────────────────────────
  // She throws HERSELF, so the thing that breaks is her own shell. The full
  // treatment: an eight-spoke fracture star, both halves of the shell flung apart,
  // a gout of yolk, albumen strung everywhere, and a crack star left on the floor
  // that outlives all of it.
  Tackle: {
    impact(ctx) {
      const s = impactScale(ctx.damage);
      const { x, y, z } = ctx.position;
      const d = ctx.direction;

      spawnFractureStar(ctx, 8, s);
      spawnShellSplit(ctx, s * 0.95, 2.4 * s, 0.42);
      spawnGroundCrack(ctx, 7, s, 0.66);

      // Everything below launches from a CONTACT RING already clear of the target
      // rather than from the exact point of contact. MEASURED, not guessed: the
      // widest part of a fighter on this cast is its HEAD (Hamburger's bun is ~1.2 m
      // across, Donut's mass ~1.5 m), so debris launched from dead centre spends over
      // half its life inside a silhouette a pitched top-down camera hides completely.
      const R0 = CH * 0.26 * s;
      const bias = 0.8;
      for (let i = 0; i < 5; i++) {
        const a = (i / 5) * TWO_PI + Math.random() * 0.7;
        const out = (2.0 + Math.random() * 1.2) * s;
        spawnYolk(
          ctx, x + Math.cos(a) * R0, y, z + Math.sin(a) * R0,
          Math.cos(a) * out + d.x * bias, 1.9 + Math.random() * 1.1, Math.sin(a) * out + d.z * bias,
          s * 1.15, 0.5 + Math.random() * 0.12,
        );
      }
      for (let i = 0; i < 6; i++) {
        const a = (i / 6) * TWO_PI + Math.random() * 0.8;
        const out = (2.4 + Math.random() * 1.5) * s;
        spawnStrand(
          ctx, x + Math.cos(a) * R0, y, z + Math.sin(a) * R0,
          Math.cos(a) * out + d.x * bias, 1.4 + Math.random() * 1.0, Math.sin(a) * out + d.z * bias,
          s, 0.4 + Math.random() * 0.12,
        );
      }
      for (let i = 0; i < 11; i++) {
        const a = Math.random() * TWO_PI;
        const out = (2.6 + Math.random() * 2.0) * s;
        spawnFleck(
          ctx, x + Math.cos(a) * R0 * 0.9, y, z + Math.sin(a) * R0 * 0.9,
          Math.cos(a) * out + d.x * bias, 1.7 + Math.random() * 1.7, Math.sin(a) * out + d.z * bias,
          (0.9 + Math.random() * 0.6) * s, 0.4 + Math.random() * 0.14,
        );
      }
    },
    // The wind-up. She rears back and the shell starts to go before she even lands:
    // a forward fan of cracks, a peeling cap, and a spray of shell. No pale circular
    // flash — that shared muzzle pop is exactly what this system exists to replace.
    cast(ctx) {
      const d = ctx.direction;
      const { x, y, z } = ctx.position;

      // A forward FAN of cracks rather than a full star: this is the tell for a
      // charge, so it has to point where she is going.
      const yawBase = Math.atan2(d.x, d.z);
      for (let i = 0; i < 4; i++) {
        const off = (i - 1.5) * 0.34;
        const dx = Math.sin(yawBase + off), dz = Math.cos(yawBase + off);
        const dy = ((i % 2) - 0.5) * 0.35;
        const mat = nextCrackMat();
        mat.color.set(i % 2 === 0 ? SHELL_HOT : SHELL);
        mat.opacity = 1;
        const seamMat = nextCrackMat();
        seamMat.color.set(CRACK);
        seamMat.opacity = 1;
        const spoke = new THREE.Mesh(crackGeo, mat);
        const seam = new THREE.Mesh(crackGeo, seamMat);
        spoke.renderOrder = 13;
        seam.renderOrder = 12;
        const group = new THREE.Group();
        group.add(seam, spoke);
        orientAlong(spoke, dx, dy, dz);
        seam.quaternion.copy(spoke.quaternion);
        const w = CRACK_W * 0.85;
        ctx.spawnTransient(group, 0.17, (t) => {
          const e = 1 - Math.pow(1 - t, 2.2);
          const inner = CH * 0.10 + e * CH * 0.10;
          const len = CH * (0.12 + e * 0.22);
          const mid = inner + len * 0.5;
          spoke.position.set(x + dx * mid, y + dy * mid * 0.5, z + dz * mid);
          seam.position.copy(spoke.position);
          spoke.scale.set(len, w, w);
          seam.scale.set(len * 1.06, w * 2.6, w * 2.6);
          const o = t < 0.5 ? 1 : 1 - (t - 0.5) / 0.5;
          mat.opacity = o;
          seamMat.opacity = o;
        });
      }

      for (let i = 0; i < 8; i++) {
        spawnFleck(
          ctx, x, y, z,
          d.x * (1.5 + Math.random() * 1.1) + (Math.random() - 0.5) * 0.9, 0.7 + Math.random() * 0.7,
          d.z * (1.5 + Math.random() * 1.1) + (Math.random() - 0.5) * 0.9,
          0.9, 0.3,
        );
      }
      for (let i = 0; i < 3; i++) {
        spawnYolk(
          ctx, x, y, z,
          d.x * (1.2 + Math.random() * 0.8) + (Math.random() - 0.5) * 0.6, 0.8 + Math.random() * 0.5,
          d.z * (1.2 + Math.random() * 0.8) + (Math.random() - 0.5) * 0.6,
          0.9, 0.32,
        );
      }
    },
  },

  // ── Hatch! (ranged, homing, pecks in place) ────────────────────────────────
  // She cracks open and a chick comes out. The projectile is a bird, it waddles the
  // whole 1750 ms flight, and once it arrives it switches to a peck cycle — a phase
  // it works out for itself from the per-frame position delta, since `arrived` is not
  // on the hook contract.
  Hatch: {
    projectile(ctx) {
      const obj = buildChick(ctx.color);
      obj.position.copy(ctx.position);
      return obj;
    },
    trail(ctx) { chickTrail(ctx); },
    impact(ctx) { peckImpact(ctx); },
    // THE HATCH itself: the shell splits, down goes everywhere, and the chick is
    // away. This is the one cast in the file that is an EVENT rather than a wind-up.
    cast(ctx) {
      const d = ctx.direction;
      const { x, y, z } = ctx.position;
      spawnFractureStar(ctx, 6, 0.62, 0.14);
      spawnShellSplit(ctx, 0.8, 2.0, 0.4);
      for (let i = 0; i < 9; i++) {
        const a = Math.random() * TWO_PI;
        spawnDown(
          ctx, x + Math.cos(a) * CH * 0.10, y + CH * 0.06, z + Math.sin(a) * CH * 0.10,
          Math.cos(a) * (0.8 + Math.random() * 0.9) + d.x * 0.5,
          Math.sin(a) * (0.8 + Math.random() * 0.9) + d.z * 0.5,
          1.1, 0.8,
        );
      }
      for (let i = 0; i < 5; i++) {
        spawnFleck(
          ctx, x, y, z,
          d.x * (1.2 + Math.random() * 0.9) + (Math.random() - 0.5) * 1.0, 0.8 + Math.random() * 0.6,
          d.z * (1.2 + Math.random() * 0.9) + (Math.random() - 0.5) * 1.0,
          0.85, 0.3,
        );
      }
    },
  },

  // ── Shell Shards (ranged, 3 pellets, `effect: 'slow'`) ─────────────────────
  // Jagged shell with the membrane still on the inside and albumen still dripping
  // off it. The hit is a small fracture star plus a lot of egg white, which is where
  // the slow effect lives visually.
  Shards: {
    projectile(ctx) {
      const obj = buildShard(ctx.color);
      obj.position.copy(ctx.position);
      return obj;
    },
    trail(ctx) { shardTrail(ctx); },
    impact(ctx) {
      const s = impactScale(ctx.damage) * 0.9;
      const { x, y, z } = ctx.position;
      const d = ctx.direction;

      spawnFractureStar(ctx, 5, s * 0.82, 0.12);
      spawnGroundCrack(ctx, 5, s * 0.7, 0.6);

      const R0 = CH * 0.24 * s;
      const bias = 0.7;
      for (let i = 0; i < 6; i++) {
        const a = (i / 6) * TWO_PI + Math.random() * 0.8;
        const out = (2.2 + Math.random() * 1.4) * s;
        spawnStrand(
          ctx, x + Math.cos(a) * R0, y, z + Math.sin(a) * R0,
          Math.cos(a) * out + d.x * bias, 1.4 + Math.random() * 1.0, Math.sin(a) * out + d.z * bias,
          s * 1.1, 0.42 + Math.random() * 0.12,
        );
      }
      for (let i = 0; i < 7; i++) {
        const a = (i / 7) * TWO_PI + Math.random() * 0.9;
        const out = (2.4 + Math.random() * 1.7) * s;
        spawnFleck(
          ctx, x + Math.cos(a) * R0, y, z + Math.sin(a) * R0,
          Math.cos(a) * out + d.x * bias, 1.6 + Math.random() * 1.4, Math.sin(a) * out + d.z * bias,
          (0.85 + Math.random() * 0.5) * s, 0.38 + Math.random() * 0.12,
        );
      }
      for (let i = 0; i < 2; i++) {
        const a = Math.random() * TWO_PI;
        spawnYolk(
          ctx, x + Math.cos(a) * R0, y, z + Math.sin(a) * R0,
          Math.cos(a) * 2.0 * s + d.x * bias, 1.7 + Math.random() * 0.9, Math.sin(a) * 2.0 * s + d.z * bias,
          s * 0.85, 0.44,
        );
      }
    },
    // She flicks a handful of shell forward through the weapon's own 30° spread.
    cast(ctx) {
      const d = ctx.direction;
      const { x, y, z } = ctx.position;
      const half = ((ctx.weapon.spreadDeg ?? 30) * Math.PI) / 360;
      for (let i = 0; i < 9; i++) {
        const off = (Math.random() * 2 - 1) * half;
        const c = Math.cos(off), sn = Math.sin(off);
        const fx = d.x * c - d.z * sn, fz = d.x * sn + d.z * c;
        const sp = 1.6 + Math.random() * 1.2;
        spawnFleck(ctx, x, y, z, fx * sp, 0.7 + Math.random() * 0.6, fz * sp, 0.95, 0.32);
      }
      for (let i = 0; i < 3; i++) {
        const off = (Math.random() * 2 - 1) * half;
        const c = Math.cos(off), sn = Math.sin(off);
        const fx = d.x * c - d.z * sn, fz = d.x * sn + d.z * c;
        spawnStrand(ctx, x, y, z, fx * 1.6, 0.5 + Math.random() * 0.4, fz * 1.6, 0.85, 0.3);
      }
    },
  },
};
