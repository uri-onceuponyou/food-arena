/**
 * Pizza weapon VFX.
 *
 * ── Pizza's identity: FLAT, SPINNING, GEOMETRIC ──────────────────────────────
 * Pizza's silhouette (a triangle) is one of the strongest in the cast, so every
 * effect in this file is built out of FLAT, hard-edged, spinning plates rather than
 * the round blobs `hamburger.ts` uses or the faceted 3D shards `waterbottle.ts` uses.
 * A thrown slice, a hand-tossed dough base and a flopping sheet of cheese are all
 * *plates*; what separates the three weapons is the plate's OUTLINE (triangle /
 * circle / rounded square), its spin rate, and how it comes apart on impact.
 *
 * Weapon keys (`game/rules.ts` -> `CHARACTERS.pizza.weapons`), all converted below:
 *   `'Dough'`   Dough Balls  — `rangedLong`, `effect: 'slow'`  → a hand-tossed base
 *   `'Tomato'`  Tomato Splat — `rangedMid`, `splatter: true`   → the hero slice
 *   `'Cheese'`  Cheese Blind — `rangedClose`, `effect: 'stun'` → a floppy sheet
 *
 * ── THE TWO DECISIONS THIS FILE IS BUILT AROUND ──────────────────────────────
 *
 * 1. **The spin axis is world UP, and the plate never goes edge-on.** A flat plate
 *    tumbling about its travel axis spends half of every revolution edge-on, and at
 *    this game's tilted top-down camera an edge-on plate is a 1px line — i.e. the
 *    projectile would strobe in and out of existence for its whole flight. So every
 *    Pizza plate flies FACE UP, spinning about world +Y like a thrown discus, with
 *    only a shallow (≤20°) bank for life. Its full triangular/circular outline is
 *    presented to the camera at every instant of flight, which is the entire point:
 *    the shape IS the identification.
 *
 *    Consequently there is no "edge-on flash" beat here — it would require the very
 *    orientation this design exists to avoid. The flash lives in the SWEEP instead:
 *    a thin bright arc shed behind the spinning rim (`spawnSliceArc`), which reads as
 *    a blade trail and is far more visible at ~25px than a glint on a 2px edge.
 *
 * 2. **Every plate is a bright face over a slightly larger charred-crust backing
 *    plate** (`buildPlate`). That one device does three jobs at once: it gives the
 *    flat form visible thickness, it guarantees a dark outline on all sides so a pale
 *    warm plate (dough, cheese) never dissolves into the arena's pale warm floor, and
 *    it hardens the geometric silhouette the whole character is built on.
 *
 * ── Scale discipline ─────────────────────────────────────────────────────────
 * Every size below is a fraction of `CHARACTER_HEIGHT`, not a magic metre value, for
 * the same reason `game/vfx.ts`'s rescaled generic burst is: the camera has moved
 * before and will again. The generic impact burst is 1.74 m typical / 3.0 m cap
 * against a 2.10 m character; nothing spawned here exceeds that, and the whole point
 * of the impact effects is that the fighter stays readable through its own hit.
 */

import * as THREE from 'three';
import { FLIGHT_MS, type Weapon } from '../../game/rules';
import { CHARACTER_HEIGHT } from '../../units';
import type { CharacterWeaponVfxMap, WeaponVfxCtx } from './types';

// ─────────────────────────────────────────────────────────────────────────────
// Palette — mirrors the module-private consts in `src/characters/pizza.ts` so the
// thrown food matches the fighter throwing it. (They are `const`, not exported, so
// this is a deliberate copy rather than an import; the values are the contract.)
// ─────────────────────────────────────────────────────────────────────────────

const CRUST = '#EFB868';
const CRUST_RIM = '#CE8A2E';
/** Charred underside — the outline colour every plate in this file sits on. Warm and
 * dark rather than black, so it reads as baked crust and not as an ink stroke (the
 * art direction has almost no ink outline; this is a readability device on a small
 * fast-moving object, not a style). */
const CRUST_CHAR = '#4A2A12';
const PEPPERONI = '#B93A28';
const FLOUR_DUST = '#F7ECD3';

const CH = CHARACTER_HEIGHT;
const TWO_PI = Math.PI * 2;

/** Ground-decal height for this file's flat marks. The ground stack is crowded —
 * floor pads 0.045–0.048, seams 0.062, baked shadows 0.068–0.07, prop kicks 0.08,
 * arena decals 0.15, `game/vfx.ts`'s splats/trail marks 0.17/0.19 and its melee
 * arcs/impact rings 0.24 — so Pizza's marks sit just above all of it. */
const GROUND_Y = 0.26;

// ─────────────────────────────────────────────────────────────────────────────
// Flat-plate geometry. Everything is authored in the XZ plane with a +Y normal
// (`flatShapeGeo` bakes the lay-flat rotation into the BUFFER, once, at module
// scope) — which is also what makes decision (1) above safe. Composing
// `rotation.x` then `rotation.y` on a mesh does NOT spin a plate about world up:
// Euler angles are intrinsic and sequential, so the plate tips edge-on and vanishes.
// With the flatten baked into the geometry, a world-up quaternion spins the plate in
// its own horizontal plane and cannot ever tip it.
//
// UNIT vs REAL sizes: `triFlashGeo` / `blobGeo*` / `rayGeo` / `arcGeo` are authored
// at unit radius, so their `scale` IS a size in metres. The projectile plates and
// `chipGeo` are authored at final size, so their `scale` is a multiplier. Mixing the
// two up is the easiest way to ship an effect 3x too big; the comment on each
// spawn helper says which it is.
// ─────────────────────────────────────────────────────────────────────────────

function flatShapeGeo(shape: THREE.Shape, curveSegments = 10): THREE.BufferGeometry {
  const geo = new THREE.ShapeGeometry(shape, curveSegments);
  geo.rotateX(-Math.PI / 2);
  return geo;
}

/**
 * A pizza slice: sharp tip, two straight cuts, a bowed crust at the wide end. The
 * origin sits ~58% of the way from tip to crust — roughly where a real slice's mass
 * centres, so the spin looks thrown rather than swung around a corner.
 *
 * Note `flatShapeGeo` maps the shape's +Y to world −Z, so in the finished geometry
 * the TIP points toward +Z and the crust toward −Z.
 */
function sliceShape(len: number, halfAngle: number): THREE.Shape {
  const halfW = Math.tan(halfAngle) * len;
  const tip = -len * 0.58;
  const back = len * 0.42;
  const s = new THREE.Shape();
  s.moveTo(0, tip);
  s.lineTo(-halfW, back);
  s.quadraticCurveTo(0, back + halfW * 0.5, halfW, back);
  s.closePath();
  return s;
}

/** A rounded, slightly lopsided square — a sheet of cheese. Deliberately NOT a
 * circle or a triangle: three weapons, three distinguishable outlines. */
function sheetShape(r: number): THREE.Shape {
  const s = new THREE.Shape();
  s.moveTo(0, r);
  s.quadraticCurveTo(r * 0.82, r * 0.78, r * 0.96, -r * 0.06);
  s.quadraticCurveTo(r * 0.7, -r * 0.72, 0, -r);
  s.quadraticCurveTo(-r * 0.84, -r * 0.66, -r, r * 0.04);
  s.quadraticCurveTo(-r * 0.7, r * 0.8, 0, r);
  return s;
}

/** An irregular closed blob at unit radius — the outline of a splat. Deterministic
 * (the two seeds pick the lobes), so it is a module-scope geometry like the rest. */
function blobShape(seedA: number, seedB: number, points = 22): THREE.Shape {
  const s = new THREE.Shape();
  for (let i = 0; i <= points; i++) {
    const a = (i / points) * TWO_PI;
    const r = 1 + Math.sin(a * 3 + seedA) * 0.17 + Math.sin(a * 5 + seedB) * 0.11;
    const x = Math.cos(a) * r;
    const y = Math.sin(a) * r;
    if (i === 0) s.moveTo(x, y);
    else s.lineTo(x, y);
  }
  return s;
}

/** A thin tapered triangle of unit length — one flung ray of sauce. */
function rayShape(halfWidth: number): THREE.Shape {
  const s = new THREE.Shape();
  s.moveTo(-halfWidth, 0);
  s.lineTo(halfWidth, 0);
  s.lineTo(0, 1);
  s.closePath();
  return s;
}

// ── Projectile plate sizes, as fractions of a fighter ───────────────────────────
const SLICE_LEN = CH * 0.26;      // 0.55 m — a quarter of a fighter, tip to crust
const DOUGH_R = CH * 0.135;       // 0.28 m radius — same span as the slice
const SHEET_R = CH * 0.15;        // 0.32 m half-width

const sliceGeo = flatShapeGeo(sliceShape(SLICE_LEN, 0.44), 8);
const sheetGeo = flatShapeGeo(sheetShape(SHEET_R), 8);

/** Unit-radius flat disc — pepperoni, flour patch, cheese hole. */
const unitDiscGeo = (() => {
  const geo = new THREE.CircleGeometry(1, 12);
  geo.rotateX(-Math.PI / 2);
  return geo;
})();

/** Hand-tossed base: a circle pushed out of round on a fixed 3-lobe + 7-lobe wobble,
 * which is also what makes its spin legible — a perfectly circular disc spinning
 * about its own centre is visually indistinguishable from a stationary one. */
const doughGeo = (() => {
  const geo = new THREE.CircleGeometry(DOUGH_R, 20);
  geo.rotateX(-Math.PI / 2);
  const pos = geo.attributes.position;
  for (let i = 1; i < pos.count; i++) {
    const x = pos.getX(i);
    const z = pos.getZ(i);
    const a = Math.atan2(z, x);
    const k = 1 + Math.sin(a * 3) * 0.07 + Math.sin(a * 7 + 1.3) * 0.045;
    pos.setX(i, x * k);
    pos.setZ(i, z * k);
  }
  pos.needsUpdate = true;
  return geo;
})();

/** Debris, at final size (0.22 m): a small hard triangle. Shared by every weapon's
 * impact — the fragments a flat plate breaks into are still flat plates. */
const chipGeo = flatShapeGeo(sliceShape(CH * 0.105, 0.52), 4);
/** Impact "shape flash" — a unit-length pizza WEDGE, so even the bright pop that
 * fires on a hit carries Pizza's outline instead of the generic round bloom. */
const triFlashGeo = flatShapeGeo(sliceShape(1, 0.62), 3);
const blobGeoA = flatShapeGeo(blobShape(0.0, 2.1), 1);
const blobGeoB = flatShapeGeo(blobShape(1.7, 4.3), 1);
const rayGeo = flatShapeGeo(rayShape(0.16), 1);
/** Unit sweep arc — the blade trail behind a spinning rim. */
const arcGeo = (() => {
  const geo = new THREE.RingGeometry(0.62, 1, 18, 1, 0, Math.PI * 0.8);
  geo.rotateX(-Math.PI / 2);
  return geo;
})();
/** Tiny flat mote (flour, sauce spray, grease) — ~0.13 m across at scale 1, which is
 * the smallest thing in this file that still resolves as a shape rather than a
 * sub-pixel speck at shipped framing. */
const moteGeo = (() => {
  const geo = new THREE.CircleGeometry(CH * 0.032, 6);
  geo.rotateX(-Math.PI / 2);
  return geo;
})();
/** Melted-cheese string: a thin unit-height BOX hanging from its top face. A box and
 * not a quad because a quad has a facing and these hang at random yaws — half of
 * them would have been edge-on and invisible, which is exactly the failure mode
 * decision (1) exists to avoid. */
const stringGeo = (() => {
  const geo = new THREE.BoxGeometry(CH * 0.022, 1, CH * 0.022);
  geo.translate(0, -0.5, 0);
  return geo;
})();

// ─────────────────────────────────────────────────────────────────────────────
// Materials. Opaque plate faces are one shared material per weapon (their colour
// never varies between two simultaneous shots of the same weapon); anything that
// fades independently gets a pooled instance, same discipline as `hamburger.ts` /
// `waterbottle.ts`. Every transparent material sets `depthWrite: false` — a
// transparent material that still writes depth silently occludes whatever is behind
// it, which has cost this project a whole round of invisible particles before.
// ─────────────────────────────────────────────────────────────────────────────

function materialPool<T extends THREE.Material>(size: number, build: () => T): () => T {
  const pool = Array.from({ length: size }, build);
  let i = 0;
  return () => pool[i++ % size];
}

const plateFace = (color: string) => new THREE.MeshBasicMaterial({ color, side: THREE.DoubleSide });
const doughFaceMat = plateFace('#F6E3B4');
const sauceFaceMat = plateFace('#E63946');
const cheeseFaceMat = plateFace('#FFD873');
const crustMat = plateFace(CRUST);
const crustRimMat = plateFace(CRUST_RIM);
const pepperoniMat = plateFace(PEPPERONI);
const flourPatchMat = plateFace(FLOUR_DUST);
const charMat = plateFace(CRUST_CHAR);

const nextChipMat = materialPool(20, () => new THREE.MeshBasicMaterial({
  color: '#E63946', transparent: true, opacity: 1, side: THREE.DoubleSide, depthWrite: false,
}));
const nextCharChipMat = materialPool(24, () => new THREE.MeshBasicMaterial({
  color: CRUST_CHAR, transparent: true, opacity: 1, side: THREE.DoubleSide, depthWrite: false,
}));
const nextMarkMat = materialPool(10, () => new THREE.MeshBasicMaterial({
  color: '#B62430', transparent: true, opacity: 0.9, side: THREE.DoubleSide, depthWrite: false,
}));
const nextMoteMat = materialPool(28, () => new THREE.MeshBasicMaterial({
  color: FLOUR_DUST, transparent: true, opacity: 0.9, side: THREE.DoubleSide, depthWrite: false,
}));
const nextFlashMat = materialPool(8, () => new THREE.MeshBasicMaterial({
  color: '#FFE9A8', transparent: true, opacity: 0.9, side: THREE.DoubleSide,
  blending: THREE.AdditiveBlending, depthWrite: false,
}));
const nextArcMat = materialPool(16, () => new THREE.MeshBasicMaterial({
  color: '#FFD9A0', transparent: true, opacity: 0.5, side: THREE.DoubleSide,
  blending: THREE.AdditiveBlending, depthWrite: false,
}));
const nextSheetMat = materialPool(12, () => new THREE.MeshBasicMaterial({
  color: '#FFD873', transparent: true, opacity: 0.95, side: THREE.DoubleSide, depthWrite: false,
}));

// ─────────────────────────────────────────────────────────────────────────────
// Flat-spin helpers — explicit quaternions, module-scope scratch objects so a
// per-frame `trail()` allocates nothing.
// ─────────────────────────────────────────────────────────────────────────────

const UP = new THREE.Vector3(0, 1, 0);
const _axis = new THREE.Vector3();
const _dir = new THREE.Vector3();
const _qSpin = new THREE.Quaternion();
const _qBank = new THREE.Quaternion();

/**
 * Orient a flat plate: spin `spin` radians about WORLD UP, then bank it by `bank`
 * radians about the horizontal axis perpendicular to travel.
 *
 * Composed as `qBank * qSpin` — spin applied first in the plate's own horizontal
 * plane, then the whole plane tipped — which is the ONLY composition that keeps the
 * face pointed at the camera. Doing this as `rotation.x` + `rotation.y` instead
 * produces intrinsic sequential Euler rotation, where the second angle rotates the
 * ALREADY-TIPPED plate and swings it edge-on. Keep `bank` shallow.
 */
function orientPlate(obj: THREE.Object3D, dir: THREE.Vector3, spin: number, bank: number): void {
  _qSpin.setFromAxisAngle(UP, spin);
  const len = Math.hypot(dir.x, dir.z);
  if (Math.abs(bank) > 1e-4 && len > 1e-4) {
    _axis.set(dir.z / len, 0, -dir.x / len);
    _qBank.setFromAxisAngle(_axis, bank);
    obj.quaternion.copy(_qBank).multiply(_qSpin);
  } else {
    obj.quaternion.copy(_qSpin);
  }
}

/**
 * The face-over-backing-plate sandwich every Pizza form is built from — see
 * decision (2) in the file header. `outlineScale` is how far the dark plate stands
 * proud of the bright one; the −Y offset is what stops the two coplanar quads
 * z-fighting.
 */
function buildPlate(geo: THREE.BufferGeometry, faceMat: THREE.Material, outlineScale: number): THREE.Group {
  const group = new THREE.Group();
  const back = new THREE.Mesh(geo, charMat);
  back.scale.set(outlineScale, 1, outlineScale);
  back.position.y = -CH * 0.011;
  group.add(back);
  group.add(new THREE.Mesh(geo, faceMat));
  return group;
}

/** Seconds this projectile spends in the air, straight off the rules ladders — spin
 * rates below are authored as REVOLUTIONS PER FLIGHT so a weapon that changes rung
 * keeps the same read instead of suddenly spinning for twice as long. */
function flightSeconds(w: Weapon): number {
  if (w.range && w.speed) return w.range / w.speed;
  return FLIGHT_MS.normal / 1000;
}

/** Per-projectile spin state, stashed on the pooled object (several plates from the
 * same weapon can be in flight at once, so this cannot be module state). */
interface SpinState { spin: number; rate: number; shed: number; }

function spinState(obj: THREE.Object3D, w: Weapon, revsPerFlight: number): SpinState {
  let st = obj.userData.__spin as SpinState | undefined;
  if (!st) {
    st = { spin: Math.random() * TWO_PI, rate: (revsPerFlight * TWO_PI) / flightSeconds(w), shed: 0 };
    obj.userData.__spin = st;
  }
  return st;
}

/** One frame of the sweep arc a spinning rim leaves behind it — the "flash" beat
 * this weapon set gets instead of an edge-on glint (see the file header).
 * `radius` is in METRES (`arcGeo` is unit). */
function spawnSliceArc(ctx: WeaponVfxCtx, radius: number, yaw: number, color: string): void {
  const mat = nextArcMat();
  mat.color.set(color);
  mat.opacity = 0.45;
  const arc = new THREE.Mesh(arcGeo, mat);
  arc.renderOrder = 9;
  arc.position.copy(ctx.position);
  arc.rotation.y = yaw;
  arc.scale.set(radius, 1, radius);
  ctx.spawnTransient(arc, 0.13, (t) => {
    const r = radius * (1 + t * 0.28);
    arc.scale.set(r, 1, r);
    mat.opacity = 0.45 * (1 - t);
  });
}

/** A small flat mote (flour / sauce spray) launched on a ballistic arc. `scale` is a
 * multiplier on `moteGeo`'s 0.13 m. */
function spawnMote(
  ctx: WeaponVfxCtx, origin: THREE.Vector3, color: string,
  vx: number, vy: number, vz: number, gravity: number, scale: number, life: number,
): void {
  const mat = nextMoteMat();
  mat.color.set(color);
  mat.opacity = 0.9;
  const mote = new THREE.Mesh(moteGeo, mat);
  mote.renderOrder = 9;
  mote.position.copy(origin);
  mote.scale.setScalar(scale);
  const ox = origin.x, oy = origin.y, oz = origin.z;
  ctx.spawnTransient(mote, life, (t, e) => {
    mote.position.set(ox + vx * e, Math.max(GROUND_Y, oy + vy * e + 0.5 * gravity * e * e), oz + vz * e);
    mat.opacity = 0.9 * (1 - t * t);
  });
}

/** A flat triangular chip of debris, flung outward and spinning FLAT (a fragment of
 * a plate is still a plate — it never tumbles into 3D like `waterbottle.ts`'s
 * shards, which is most of what separates the two weapon sets on impact).
 * `scale` is a multiplier on `chipGeo`'s 0.22 m. */
function spawnChip(
  ctx: WeaponVfxCtx, origin: THREE.Vector3, color: string,
  ang: number, speed: number, scale: number, life: number,
): void {
  const chip = new THREE.Group();
  const backMat = nextCharChipMat();
  backMat.opacity = 1;
  const back = new THREE.Mesh(chipGeo, backMat);
  back.scale.set(1.22, 1, 1.22);
  back.position.y = -CH * 0.008;
  chip.add(back);
  const faceMat = nextChipMat();
  faceMat.color.set(color);
  faceMat.opacity = 1;
  chip.add(new THREE.Mesh(chipGeo, faceMat));
  chip.renderOrder = 9;
  chip.position.copy(origin);
  chip.scale.setScalar(scale);

  const ox = origin.x, oy = origin.y, oz = origin.z;
  const cos = Math.cos(ang), sin = Math.sin(ang);
  const vx = cos * speed;
  const vz = sin * speed;
  const vy = 0.8 + Math.random() * 0.9;
  const gravity = -7.5;
  const spin0 = Math.random() * TWO_PI;
  const spinRate = (Math.random() - 0.5) * 24;
  ctx.spawnTransient(chip, life, (t, e) => {
    chip.position.set(ox + vx * e, Math.max(GROUND_Y, oy + vy * e + 0.5 * gravity * e * e), oz + vz * e);
    _dir.set(cos, 0, sin);
    orientPlate(chip, _dir, spin0 + spinRate * e, 0.22);
    const fade = 1 - Math.pow(t, 2.2);
    faceMat.opacity = fade;
    backMat.opacity = fade;
  });
}

/** The flat splat a plate leaves where it landed: an irregular ground blob plus a
 * few tapered rays thrown out of it. One transient (a group), so the rays and the
 * blob always fade together. `radius` is in METRES. */
function spawnGroundSplat(
  ctx: WeaponVfxCtx, color: string, radius: number, rays: number, life: number, startOpacity: number,
): void {
  const group = new THREE.Group();
  group.position.set(ctx.position.x, GROUND_Y, ctx.position.z);
  group.renderOrder = 4;

  const mat = nextMarkMat();
  mat.color.set(color);
  mat.opacity = startOpacity;
  const blob = new THREE.Mesh(Math.random() < 0.5 ? blobGeoA : blobGeoB, mat);
  blob.rotation.y = Math.random() * TWO_PI;
  group.add(blob);

  const rayMeshes: THREE.Mesh[] = [];
  for (let i = 0; i < rays; i++) {
    const ray = new THREE.Mesh(rayGeo, mat);
    ray.rotation.y = (i / rays) * TWO_PI + Math.random() * 0.7;
    ray.scale.set(0.7 + Math.random() * 0.4, 1, 1.0 + Math.random() * 0.4);
    group.add(ray);
    rayMeshes.push(ray);
  }

  ctx.spawnTransient(group, life, (t) => {
    // Snaps out over the first fifth of its life, then holds and fades — a splat
    // lands instantly, it doesn't grow.
    const grow = 1 - Math.pow(1 - Math.min(1, t * 5), 3);
    group.scale.set(radius * grow, 1, radius * grow);
    for (const r of rayMeshes) r.scale.y = grow;
    mat.opacity = startOpacity * (t < 0.55 ? 1 : 1 - (t - 0.55) / 0.45);
  });
}

/** The bright pop on a hit — a pizza WEDGE, not the generic round bloom. `peak` is
 * the wedge's tip-to-crust length in METRES (`triFlashGeo` is unit). */
function spawnTriangleFlash(ctx: WeaponVfxCtx, color: string, peak: number, life: number): void {
  const mat = nextFlashMat();
  mat.color.set(color);
  mat.opacity = 0.9;
  const flash = new THREE.Mesh(triFlashGeo, mat);
  flash.renderOrder = 11;
  flash.position.copy(ctx.position);
  flash.rotation.y = Math.random() * TWO_PI;
  flash.scale.set(peak * 0.35, 1, peak * 0.35);
  ctx.spawnTransient(flash, life, (t) => {
    const s = THREE.MathUtils.lerp(peak * 0.35, peak, 1 - Math.pow(1 - t, 2));
    flash.scale.set(s, 1, s);
    mat.opacity = 0.9 * (1 - t);
  });
}

/**
 * Impact scale, matched to the recipe `game/vfx.ts` re-derived for the generic burst
 * (`clamp(0.85 + damage * 0.035, ...)`) — this file deliberately reuses that curve so
 * a Pizza hit and a generic hit read as the same WEIGHT of event, capped lower
 * because Pizza's weapons are all mid-damage and nothing here should ever approach
 * the burst's 3.0 m ceiling.
 */
function impactScale(damage: number): number {
  return THREE.MathUtils.clamp(0.85 + damage * 0.035, 0.85, 1.4);
}

// ─────────────────────────────────────────────────────────────────────────────
// Projectile builders
// ─────────────────────────────────────────────────────────────────────────────

/**
 * The hero: a slice of pizza. Gold crust plate with the sauce inset on top of it,
 * biased toward the tip so the widest band of crust shows along the bowed outer
 * edge, plus two pepperoni. The toppings are not decoration — an untextured triangle
 * spinning about its own centre reads ambiguously, and the off-axis dots are what
 * make the rotation legible frame to frame.
 */
function buildSlice(color: string): THREE.Group {
  const group = buildPlate(sliceGeo, crustMat, 1.15);

  sauceFaceMat.color.set(color);
  const sauce = new THREE.Mesh(sliceGeo, sauceFaceMat);
  sauce.scale.set(0.86, 1, 0.86);
  sauce.position.set(0, CH * 0.006, SLICE_LEN * 0.04); // +Z is toward the tip
  group.add(sauce);

  for (const [px, pz, pr] of [[-0.2, -0.1, 0.075], [0.15, 0.11, 0.06]] as const) {
    const pep = new THREE.Mesh(unitDiscGeo, pepperoniMat);
    pep.position.set(SLICE_LEN * px, CH * 0.012, SLICE_LEN * pz);
    pep.scale.setScalar(SLICE_LEN * pr * 2);
    group.add(pep);
  }
  return group;
}

/** A hand-tossed base: pale, out-of-round, with a deeper rim roll. */
function buildDough(color: string): THREE.Group {
  const group = buildPlate(doughGeo, crustRimMat, 1.13);
  doughFaceMat.color.set(color);
  const top = new THREE.Mesh(doughGeo, doughFaceMat);
  top.scale.set(0.84, 1, 0.84);
  top.position.y = CH * 0.006;
  group.add(top);
  // Off-centre flour patch — the asymmetry that makes a round plate's spin visible.
  const patch = new THREE.Mesh(unitDiscGeo, flourPatchMat);
  patch.scale.setScalar(DOUGH_R * 0.3);
  patch.position.set(DOUGH_R * 0.36, CH * 0.011, -DOUGH_R * 0.24);
  group.add(patch);
  return group;
}

/** A sheet of cheese: rounded square, no crust, one bite-hole for asymmetry. */
function buildSheet(color: string): THREE.Group {
  cheeseFaceMat.color.set(color);
  const group = buildPlate(sheetGeo, cheeseFaceMat, 1.12);
  const hole = new THREE.Mesh(unitDiscGeo, crustRimMat);
  hole.scale.setScalar(SHEET_R * 0.22);
  hole.position.set(SHEET_R * 0.34, CH * 0.006, SHEET_R * 0.2);
  group.add(hole);
  return group;
}

// ─────────────────────────────────────────────────────────────────────────────

export const pizzaWeaponVfx: CharacterWeaponVfxMap = {
  // ── Dough Balls ────────────────────────────────────────────────────────────
  // Not a ball. A pizzaiolo throws a DISC, and a spinning disc of raw dough is both
  // more characterful and more on-identity (flat, geometric) than a sphere — while
  // still reading as instantly different from the Tomato slice, because the outline
  // is a circle and not a triangle. Spins fastest of the three and sheds flour.
  Dough: {
    projectile(ctx) {
      const obj = buildDough(ctx.color);
      obj.position.copy(ctx.position);
      return obj;
    },

    trail(ctx) {
      const obj = ctx.object;
      if (!obj) return;
      const dt = ctx.dt ?? 0;
      const st = spinState(obj, ctx.weapon, 2.6);
      st.spin += st.rate * dt;
      // Slow precession on top of the spin — a tossed base wobbles on its axis.
      orientPlate(obj, ctx.direction, st.spin, 0.15 + Math.sin(st.spin * 0.37) * 0.07);
      obj.position.y += Math.sin(st.spin * 0.5) * CH * 0.012;

      st.shed -= dt;
      if (st.shed <= 0) {
        st.shed = 0.055 + Math.random() * 0.04;
        spawnMote(
          ctx, ctx.position, FLOUR_DUST,
          -ctx.direction.x * 0.5 + (Math.random() - 0.5) * 0.5,
          0.25 + Math.random() * 0.4,
          -ctx.direction.z * 0.5 + (Math.random() - 0.5) * 0.5,
          -1.1, 0.5 + Math.random() * 0.35, 0.3 + Math.random() * 0.15,
        );
        if (Math.random() < 0.45) spawnSliceArc(ctx, DOUGH_R * 1.2, st.spin, '#FFF0CC');
      }
    },

    // A heavy, low-energy landing: the base slaps flat, throws a ring of flour, and
    // leaves a pale flattened patch behind (the weapon's `effect: 'slow'` — dough is
    // the thing you get stuck in). No shards, no sparks.
    impact(ctx) {
      const s = impactScale(ctx.damage);

      const mat = nextMarkMat();
      mat.color.set('#F0DDAE');
      mat.opacity = 0.95;
      const pancake = new THREE.Mesh(blobGeoA, mat);
      pancake.renderOrder = 4;
      pancake.position.set(ctx.position.x, GROUND_Y, ctx.position.z);
      pancake.rotation.y = Math.random() * TWO_PI;
      const peak = CH * 0.25 * s; // radius ≈ 0.54 m → ~1.07 m across
      ctx.spawnTransient(pancake, 0.62, (t) => {
        const g = THREE.MathUtils.lerp(peak * 0.3, peak, 1 - Math.pow(1 - Math.min(1, t * 4), 3));
        pancake.scale.set(g, 1, g);
        mat.opacity = 0.95 * (t < 0.5 ? 1 : 1 - (t - 0.5) / 0.5);
      });

      spawnTriangleFlash(ctx, '#FFF3D2', CH * 0.28 * s, 0.14);

      for (let i = 0; i < 10; i++) {
        const ang = (i / 10) * TWO_PI + Math.random() * 0.5;
        const sp = (0.9 + Math.random() * 1.2) * s;
        spawnMote(
          ctx, ctx.position, FLOUR_DUST,
          Math.cos(ang) * sp, 0.7 + Math.random() * 0.9, Math.sin(ang) * sp,
          -2.4, 0.6 + Math.random() * 0.6, 0.45 + Math.random() * 0.25,
        );
      }
      for (let i = 0; i < 4; i++) {
        spawnChip(
          ctx, ctx.position, '#EFD9A6',
          Math.random() * TWO_PI, (1.1 + Math.random() * 1.1) * s,
          (0.55 + Math.random() * 0.35) * s, 0.4 + Math.random() * 0.14,
        );
      }
    },

    // Spinning the base up off the hands: a flat ring flaring outward plus a puff of
    // flour, at the muzzle. Flat and circular — the same outline the projectile has.
    cast(ctx) {
      const mat = nextArcMat();
      mat.color.set('#FFF0CC');
      mat.opacity = 0.6;
      const ring = new THREE.Mesh(arcGeo, mat);
      ring.renderOrder = 11;
      ring.position.copy(ctx.position);
      ctx.spawnTransient(ring, 0.16, (t) => {
        const r = THREE.MathUtils.lerp(CH * 0.05, CH * 0.16, t);
        ring.scale.set(r, 1, r);
        ring.rotation.y = t * 9;
        mat.opacity = 0.6 * (1 - t);
      });
      for (let i = 0; i < 5; i++) {
        spawnMote(
          ctx, ctx.position, FLOUR_DUST,
          ctx.direction.x * (0.5 + Math.random() * 0.6) + (Math.random() - 0.5) * 0.6,
          0.5 + Math.random() * 0.5,
          ctx.direction.z * (0.5 + Math.random() * 0.6) + (Math.random() - 0.5) * 0.6,
          -1.6, 0.55 + Math.random() * 0.4, 0.3 + Math.random() * 0.15,
        );
      }
    },
  },

  // ── Tomato Splat ───────────────────────────────────────────────────────────
  // The hero effect, and deliberately NOT `hamburger.Tomato` (same weapon key,
  // different character, different food): Hamburger throws a whole soft fruit that
  // tumbles end-over-end and settles into round chunks. Pizza throws a SLICE loaded
  // with sauce — a hard flat triangle spinning about world up, which breaks into
  // smaller flat triangles and paints a rayed splat on the floor. Round vs angular,
  // tumbling vs spinning, settling vs snapping.
  Tomato: {
    projectile(ctx) {
      const obj = buildSlice(ctx.color);
      obj.position.copy(ctx.position);
      return obj;
    },

    trail(ctx) {
      const obj = ctx.object;
      if (!obj) return;
      const dt = ctx.dt ?? 0;
      const st = spinState(obj, ctx.weapon, 1.8);
      st.spin += st.rate * dt;
      orientPlate(obj, ctx.direction, st.spin, 0.17 + Math.sin(st.spin * 0.5) * 0.06);

      st.shed -= dt;
      if (st.shed <= 0) {
        st.shed = 0.058;
        // The sweep arc — this weapon set's substitute for an edge-on glint.
        spawnSliceArc(ctx, SLICE_LEN * 0.62, st.spin, '#FFC08A');
        if (Math.random() < 0.5) {
          spawnMote(
            ctx, ctx.position, '#C4262F',
            -ctx.direction.x * 0.7 + (Math.random() - 0.5) * 0.4, 0.15 + Math.random() * 0.3,
            -ctx.direction.z * 0.7 + (Math.random() - 0.5) * 0.4,
            -2.2, 0.5 + Math.random() * 0.3, 0.26,
          );
        }
      }
    },

    // The slice SNAPS. A wedge-shaped flash, five smaller triangles skidding out
    // flat, a rayed sauce splat under the hit, a little spray. Every element is a
    // hard straight-edged shape — there is not one soft round sprite in this hit,
    // which is the whole shape-language argument for the weapon.
    impact(ctx) {
      const s = impactScale(ctx.damage);
      spawnTriangleFlash(ctx, '#FFB27A', CH * 0.38 * s, 0.13);
      spawnGroundSplat(ctx, ctx.color, CH * 0.22 * s, 4, 0.55, 0.9);

      for (let i = 0; i < 5; i++) {
        const ang = (i / 5) * TWO_PI + Math.random() * 0.6;
        spawnChip(
          ctx, ctx.position, ctx.color,
          ang, (1.3 + Math.random() * 1.1) * s,
          (0.75 + Math.random() * 0.45) * s, 0.4 + Math.random() * 0.14,
        );
      }
      for (let i = 0; i < 6; i++) {
        const ang = Math.random() * TWO_PI;
        const sp = (1.3 + Math.random() * 1.5) * s;
        spawnMote(
          ctx, ctx.position, '#C4262F',
          Math.cos(ang) * sp, 1.0 + Math.random() * 1.1, Math.sin(ang) * sp,
          -6.5, 0.7 + Math.random() * 0.5, 0.34 + Math.random() * 0.14,
        );
      }
    },

    // A wedge-shaped wind-up pointing down the throw line — the triangle again, this
    // time as a direction cue rather than a projectile.
    cast(ctx) {
      const mat = nextFlashMat();
      mat.color.set('#FF8E6A');
      mat.opacity = 0.85;
      const wedge = new THREE.Mesh(triFlashGeo, mat);
      wedge.renderOrder = 11;
      wedge.position.copy(ctx.position);
      // `triFlashGeo`'s tip points +Z, and the default facing convention in
      // `game/vfx.ts` maps local +Z to travel, so this points down the throw line.
      wedge.rotation.y = Math.atan2(ctx.direction.x, ctx.direction.z);
      ctx.spawnTransient(wedge, 0.15, (t) => {
        const g = THREE.MathUtils.lerp(CH * 0.08, CH * 0.24, 1 - Math.pow(1 - t, 2));
        wedge.scale.set(g * 0.7, 1, g);
        mat.opacity = 0.85 * (1 - t);
      });
      for (let i = 0; i < 3; i++) {
        spawnMote(
          ctx, ctx.position, '#C4262F',
          ctx.direction.x * (1 + Math.random()) + (Math.random() - 0.5) * 0.5, 0.4 + Math.random() * 0.4,
          ctx.direction.z * (1 + Math.random()) + (Math.random() - 0.5) * 0.5,
          -2.6, 0.6, 0.28,
        );
      }
    },
  },

  // ── Cheese Blind ───────────────────────────────────────────────────────────
  // A limp sheet, not a rigid plate: slowest spin of the three, with a flap
  // (non-uniform scale oscillation) instead of a clean bank. The weapon already
  // carries `effect: 'stun'`, so `game/vfx.ts`'s orbiting-star telegraph covers the
  // ONGOING state untouched — all `impact()` has to add is the instant the sheet
  // slaps over the target's face, which is literally what the ability does.
  Cheese: {
    projectile(ctx) {
      const obj = buildSheet(ctx.color);
      obj.position.copy(ctx.position);
      return obj;
    },

    trail(ctx) {
      const obj = ctx.object;
      if (!obj) return;
      const dt = ctx.dt ?? 0;
      const st = spinState(obj, ctx.weapon, 0.9);
      st.spin += st.rate * dt;
      orientPlate(obj, ctx.direction, st.spin, 0.2 * Math.sin(st.spin * 1.9));
      // Flap: the sheet stretches and slackens along one axis as it turns over.
      const flap = 1 + Math.sin(st.spin * 2.4) * 0.22;
      obj.scale.set(1 / flap, 1, flap);
      obj.position.y += Math.sin(st.spin * 1.2) * CH * 0.016;

      st.shed -= dt;
      if (st.shed <= 0) {
        st.shed = 0.13 + Math.random() * 0.07;
        spawnMote(
          ctx, ctx.position, '#FFE49A',
          -ctx.direction.x * 0.4, -0.1, -ctx.direction.z * 0.4,
          -1.6, 0.5, 0.24,
        );
      }
    },

    // SLAP + CLING. A cheese sheet snaps open over the target's head (the "blind"),
    // sags, then slides off — with melted strings drooping from it. Sized to the
    // head, not to the fighter: it has to obscure the face to mean anything, and it
    // must NOT swallow the body, so nothing here reaches even one character height.
    impact(ctx) {
      const s = impactScale(ctx.damage);
      const headY = CH * 0.72;

      const mat = nextSheetMat();
      mat.color.set(ctx.color);
      mat.opacity = 0.95;
      const sheet = new THREE.Mesh(sheetGeo, mat);
      sheet.renderOrder = 11;
      const backMat = nextCharChipMat();
      backMat.opacity = 0.6;
      const back = new THREE.Mesh(sheetGeo, backMat);
      back.scale.set(1.12, 1, 1.12);
      back.position.y = -CH * 0.008;
      sheet.add(back);
      sheet.position.set(ctx.position.x, headY, ctx.position.z);
      // `sheetGeo` is 0.63 m across already, so this is a MULTIPLIER: ~0.70 m at
      // peak, which covers a head and not a body.
      const span = 1.05 * s;
      ctx.spawnTransient(sheet, 0.5, (t) => {
        const g = THREE.MathUtils.lerp(span * 0.4, span, 1 - Math.pow(1 - Math.min(1, t * 3.5), 3));
        // Sags and slides down off the face as it lets go.
        sheet.scale.set(g, 1, g * (1 - t * 0.25));
        sheet.position.y = headY - t * t * CH * 0.3;
        orientPlate(sheet, ctx.direction, t * 1.2, 0.35 + t * 0.5);
        const fade = t < 0.6 ? 1 : 1 - (t - 0.6) / 0.4;
        mat.opacity = 0.95 * fade;
        backMat.opacity = 0.6 * fade;
      });

      spawnTriangleFlash(ctx, '#FFF0B0', CH * 0.24 * s, 0.12);

      for (let i = 0; i < 4; i++) {
        const smat = nextSheetMat();
        smat.color.set('#FFE08A');
        smat.opacity = 0.9;
        const str = new THREE.Mesh(stringGeo, smat);
        str.renderOrder = 10;
        const ang = Math.random() * TWO_PI;
        const r = CH * (0.06 + Math.random() * 0.08) * s;
        str.position.set(ctx.position.x + Math.cos(ang) * r, headY - CH * 0.04, ctx.position.z + Math.sin(ang) * r);
        const len = CH * (0.14 + Math.random() * 0.12) * s;
        ctx.spawnTransient(str, 0.42, (t) => {
          str.scale.set(1 - t * 0.55, len * (0.3 + t * 0.7), 1 - t * 0.55);
          smat.opacity = 0.9 * (1 - t * t);
        });
      }

      for (let i = 0; i < 3; i++) {
        spawnChip(
          ctx, ctx.position, '#FFD873',
          Math.random() * TWO_PI, (1 + Math.random()) * s,
          (0.55 + Math.random() * 0.3) * s, 0.38,
        );
      }
    },

    // The sheet unfurling out of the hands — a flat plate snapping open along the
    // throw direction, no sparks.
    cast(ctx) {
      const mat = nextSheetMat();
      mat.color.set(ctx.color);
      mat.opacity = 0.85;
      const sheet = new THREE.Mesh(sheetGeo, mat);
      sheet.renderOrder = 11;
      sheet.position.copy(ctx.position);
      ctx.spawnTransient(sheet, 0.16, (t) => {
        const g = THREE.MathUtils.lerp(0.3, 0.85, 1 - Math.pow(1 - t, 2));
        sheet.scale.set(g * (0.5 + t * 0.6), 1, g);
        orientPlate(sheet, ctx.direction, t * 2.4, 0.3 - t * 0.25);
        mat.opacity = 0.85 * (1 - t);
      });
      for (let i = 0; i < 3; i++) {
        spawnMote(
          ctx, ctx.position, '#FFE49A',
          ctx.direction.x * (0.6 + Math.random() * 0.5), 0.35 + Math.random() * 0.3,
          ctx.direction.z * (0.6 + Math.random() * 0.5),
          -2, 0.55, 0.26,
        );
      }
    },
  },
};
