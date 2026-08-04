/**
 * Hot Dog weapon VFX.
 *
 * ── Hot Dog's identity: THE SQUEEZED LINE and THE SPLIT BUN ──────────────────
 * Every other converted weapon set in this directory owns a different primitive, and
 * the whole point of per-weapon VFX is that they must not collide:
 *
 *   `donut.ts`     rings and curved orbiting debris
 *   `taco.ts`      curved shell tiles + scattering contents
 *   `soup.ts`      liquid droplets and lingering vapour
 *   `pizza.ts`     flat spinning plates (triangle / circle / rounded square)
 *   `lollipop.ts`  candy stripes wrapped on a body, plus a boundary arc
 *   → `hotdog.ts`  **POLYLINES.** A condiment squeezed out of a bottle: a constant-
 *                  width ribbon with hard corners, straight runs and blunt caps.
 *                  Plus **the split bun** — two hinged troughs that CLAP.
 *
 * Nothing else in the roster draws a line with corners in it. A zig-zag ribbon cannot
 * be mistaken for a ring, a plate, a droplet or a shell tile at any size, which is
 * exactly the property this system is for.
 *
 * Weapon keys (`game/rules.ts` -> `CHARACTERS.hotdog.weapons`), all three converted:
 *   `'Mustard'`  Mustard Blast — `rangedLong`, 7 dmg  → a zig-zag ribbon of mustard
 *   `'Ketchup'`  Ketchup Slip  — `rangedMid`, `slow`  → a fat wobbling slug + a slick
 *   `'Slash'`    Bun Slash     — `meleeStrong`, 11 dmg → the bun claps shut on you
 *
 * ── THE FOUR DECISIONS THIS FILE IS BUILT AROUND ─────────────────────────────
 *
 * 1. **Flat ribbons, yaw-only.** Every ribbon here is authored in the XZ plane with a
 *    +Y normal (the lay-flat rotation baked into the BUFFER once, at module scope) and
 *    is only ever rotated about world **Y**. A single rotation about world up can
 *    never tip a face-up plate edge-on, so the "compose rotation.x then rotation.y and
 *    watch the plane vanish" trap simply cannot fire here — there is no second axis.
 *    Where this file does need a second axis (the bun halves' hinge) it uses a
 *    PARENT/CHILD split — child rolls about its own Z, parent yaws about world Y —
 *    which composes in the correct order by construction, the same thing a quaternion
 *    would buy.
 *
 * 2. **Nothing is launched from dead centre; the hard core sits at the CONTACT
 *    POINT.** `impact()` fires at the target's centre, and on this cast the widest
 *    part of a fighter is its HEAD (Hamburger's bun ~1.2 m, Donut's glazed mass
 *    ~1.5 m). An effect born at the centre spends its first and brightest frames
 *    buried inside that head, where a 58°-pitched camera hides it completely — the
 *    single most repeated bug in this project, and the one that cost `donut.ts` its
 *    rings and `pizza.ts` its entire cheese sheet. So: debris launches from a contact
 *    RING already clear of the silhouette, and the bright hard core is placed at the
 *    physical point of contact (back along −direction, on the attacker's side of the
 *    body) rather than at the centre — which is both where the camera can see it and
 *    where the hit actually happened.
 *
 * 3. **Pooled materials are SET, never READ.** A helper that reads its starting
 *    opacity off a pooled material inherits whatever the previous user faded it to, so
 *    once the pool wraps — about a second of sustained firing — every particle spawns
 *    already invisible. Every `spawn*` below assigns `mat.opacity` (and `mat.color`)
 *    outright. Separately, **no animated pool is ever shared with a projectile body**:
 *    projectile bodies use plain opaque non-transparent singletons that nothing ever
 *    fades, which removes the failure mode structurally rather than by discipline.
 *
 * 4. **Hard-edged and near-opaque, not additive.** Additive white over this arena's
 *    bright warm floor produces a wash sitting in the same value band as the
 *    terracotta under it, not a core — a blind critic once measured the arena's own
 *    static floor decal as having more contrast than a combat hit. Every element here
 *    that has to say AN EVENT HAPPENED is normal-blended at opacity ≥0.9 and carries a
 *    dark backing plate one step larger, so a saturated gold ribbon never dissolves
 *    into a saturated warm floor. There is not one additive material in this file.
 *
 * ── Scale discipline ─────────────────────────────────────────────────────────
 * Every size is a fraction of `CHARACTER_HEIGHT`, never a magic metre value. The
 * generic burst in `game/vfx.ts` is 1.74 m typical / 3.0 m cap against a 2.10 m
 * fighter; finished weapons in this directory peak at 1.21 m (pizza) and 2.22 m
 * (soup). The widest thing here is the Bun Slash clap at 2.30 m across at its
 * first frame, and it is two thin troughs with the whole middle empty — the fighter
 * is framed by it, never covered.
 */

import * as THREE from 'three';
import { FLIGHT_MS, PALETTE, type Weapon } from '../../game/rules';
import { CHARACTER_HEIGHT } from '../../units';
import type { CharacterWeaponVfxMap, WeaponVfxCtx } from './types';

// ─────────────────────────────────────────────────────────────────────────────
// Palette. Keyed off `game/rules.ts`'s shared `PALETTE` where the food already has
// an entry there, so re-skinning the character re-skins its condiments too.
// ─────────────────────────────────────────────────────────────────────────────

const MUSTARD = PALETTE.mustard;        // '#FFC93C'
/** The value break under every gold element. Gold on this arena's pale warm floor is
 * a value match, not a contrast; a deeper amber backing one step larger is what gives
 * a mustard ribbon an edge at 20 px. */
const MUSTARD_DEEP = '#9A6410';
/** Near-white gold — the hard contact core. Deliberately not additive; see (4). */
const MUSTARD_HOT = '#FFF2C0';

const KETCHUP = PALETTE.ketchup;        // '#D62839'
const KETCHUP_DEEP = '#6E121D';
const KETCHUP_HOT = '#FFC0AE';

const BUN = PALETTE.bun;                // '#E8A33D'
const BUN_TOAST = '#7A4A1E';            // the character's own griddle-stripe brown
const BUN_CRUMB = '#F9E9C2';            // the pale cut face inside a split bun

const CH = CHARACTER_HEIGHT;
const TWO_PI = Math.PI * 2;

/**
 * Ground height for this file's flat marks.
 *
 * The ground stack is crowded and every layer in it is opaque or depth-writing:
 * floor pads 0.045–0.048, seams 0.062, baked shadows 0.068–0.07, prop kicks 0.08,
 * arena decals 0.15, `game/vfx.ts`'s splats 0.17 and Sticky-Trail marks 0.19, its
 * melee arcs and impact rings 0.24. Finished weapon files sit at 0.26–0.29.
 */
const GROUND_Y = 0.28;

// ─────────────────────────────────────────────────────────────────────────────
// Flat ribbon geometry — authored in the XZ plane with a +Y normal.
//
// UNIT vs REAL sizes: `dashGeo` and `rayGeo` are authored at unit LENGTH along +Z, so
// their `scale.z` is a length in metres and `scale.x` a width in metres. The
// projectile ribbons and the ground stripe are authored at final size, so their
// `scale` is a multiplier. Mixing the two up is the easiest way to ship an effect 3x
// too big, so every spawn helper's doc says which it is.
// ─────────────────────────────────────────────────────────────────────────────

function flatShapeGeo(shape: THREE.Shape, curveSegments = 8): THREE.BufferGeometry {
  const geo = new THREE.ShapeGeometry(shape, curveSegments);
  geo.rotateX(-Math.PI / 2);
  return geo;
}

/**
 * The primitive this whole file is built on: a constant-width ribbon whose centreline
 * zig-zags. Offsetting purely laterally (rather than along the true normal) keeps the
 * corners sharp and the horizontal width exactly constant, which is what makes it read
 * as a bead of condiment squeezed out of a nozzle rather than as a soft ribbon.
 *
 * Authored with its length along shape-Y, which `flatShapeGeo` maps to world −Z; the
 * geometries below re-centre or re-origin as each use needs.
 */
function zigShape(len: number, halfWidth: number, peaks: number, amp: number): THREE.Shape {
  const n = Math.max(2, peaks * 2);
  const s = new THREE.Shape();
  const xAt = (i: number) => (i % 2 === 0 ? -amp : amp);
  const yAt = (i: number) => -len / 2 + (i / n) * len;
  s.moveTo(xAt(0) - halfWidth, yAt(0));
  for (let i = 1; i <= n; i++) s.lineTo(xAt(i) - halfWidth, yAt(i));
  for (let i = n; i >= 0; i--) s.lineTo(xAt(i) + halfWidth, yAt(i));
  s.closePath();
  return s;
}

/** A blunt-capped lozenge — one dash of condiment. */
function lozengeShape(halfLen: number, halfWid: number): THREE.Shape {
  const s = new THREE.Shape();
  s.moveTo(0, halfLen);
  s.quadraticCurveTo(halfWid, halfLen * 0.45, halfWid, 0);
  s.quadraticCurveTo(halfWid, -halfLen * 0.45, 0, -halfLen);
  s.quadraticCurveTo(-halfWid, -halfLen * 0.45, -halfWid, 0);
  s.quadraticCurveTo(-halfWid, halfLen * 0.45, 0, halfLen);
  return s;
}

// ── Projectile sizes, as fractions of a fighter ───────────────────────────────
// Sized against what they REPLACE: the generic projectile in `game/vfx.ts` is a
// `SphereGeometry(wu(10))`, i.e. a 1.0 m ball. A bespoke projectile that comes out
// SMALLER than the generic one it improves on is a regression however characterful it
// is, so both bodies below span 0.9–1.1 m end to end.
//
// The px/m conversion every number in this file was checked against, measured off a
// rendered frame rather than derived: a 2.10 m fighter is ~100 px tall at shipped
// framing (~10.5% of frame height), so **1 m ≈ 48 px**. Anything under ~0.12 m across
// is a 6 px sliver and reads as noise no matter how bright it is — which is exactly
// what the first build of this file shipped, because the ribbon widths were being
// multiplied by a unit shape that was already only 0.26 wide.
const MUSTARD_LEN = CH * 0.44;      // 0.92 m nose to tail
const MUSTARD_HALFW = CH * 0.065;   // 0.27 m bead width (~13 px)
const MUSTARD_AMP = CH * 0.072;     // zig amplitude -> 0.57 m overall width
const KETCHUP_LEN = CH * 0.26;      // head lozenge, 0.55 m
const KETCHUP_WID = CH * 0.185;     // 0.39 m across

/** Centred zig-zag ribbon — the Mustard Blast body. Authored at FINAL SIZE, so its
 * `scale` is a multiplier, not a length. */
const mustardRibbonGeo = flatShapeGeo(zigShape(MUSTARD_LEN, MUSTARD_HALFW, 3, MUSTARD_AMP), 1);

/**
 * Ground-stripe ribbon, ORIGINED AT ONE END (spans z ∈ [0, len]) rather than centred.
 * That is what lets a parent group's `scale.z` DRAW the stripe on from its start the
 * way a squeeze bottle lays one down, instead of growing it out of its own middle.
 * Also authored at final size.
 */
const SLIP_LEN = CH * 0.78;                       // 1.64 m long (~78 px)
const SLIP_BEAD = CH * 0.075;                     // 0.32 m bead (~15 px)
const SLIP_WID = (SLIP_BEAD + CH * 0.098) * 2;    // 0.73 m band across the zig
const slipStripeGeo = (() => {
  const geo = flatShapeGeo(zigShape(SLIP_LEN, SLIP_BEAD, 3, CH * 0.098), 1);
  geo.translate(0, 0, SLIP_LEN / 2);
  return geo;
})();

// ── UNIT geometry: everything below spans exactly 1 x 1 in XZ ─────────────────
// So `scale.set(widthMetres, 1, lengthMetres)` is literally the size on the ground.
// This convention is not cosmetic: the first build authored these at 0.26–0.30 wide
// and then set `scale.x` as though it were a width in metres, which shipped every ray
// and dash at about a THIRD of its intended width — 3–4 px on screen. The effect
// rendered perfectly and read as nothing, this project's signature failure in its
// least dramatic form. Author unit, scale in metres, and the class of bug is gone.

/** Unit dash: a blunt-capped lozenge, 1 x 1. */
const dashGeo = flatShapeGeo(lozengeShape(0.5, 0.5), 6);
/** A crumb of bun — the one non-flat particle in the file, so bun debris reads as
 * solid matter rather than as another stripe. */
const crumbGeo = new THREE.IcosahedronGeometry(CH * 0.024, 0);

/**
 * A bun half: an open half-tube whose trough opens toward +Y, with its length along Z
 * and unit radius / unit length, so `scale.set(R, R, L)` is metres.
 *
 * Opening UPWARD is the load-bearing choice. `three.js` builds a partial cylinder
 * around +Y with the shell on the +X side; laid down with its opening facing sideways
 * this camera sees only a curved back and the pale crumb interior — the thing that
 * says BREAD — never reaches the screen. Rotating the trough so its mouth faces the
 * camera puts the crumb face front and centre. The two rotations are applied to the
 * BUFFER once, at module scope: rotateZ(−90°) swings the mouth up, rotateY(+90°) lays
 * the axis along Z.
 */
const bunHalfGeo = (() => {
  const geo = new THREE.CylinderGeometry(1, 1, 1, 16, 1, true, 0, Math.PI);
  geo.rotateZ(-Math.PI / 2);
  geo.rotateY(Math.PI / 2);
  return geo;
})();
/** The pale cut face that sits recessed inside a bun half. */
const bunCrumbGeo = (() => {
  const geo = new THREE.PlaneGeometry(2, 1);
  geo.rotateX(-Math.PI / 2);
  return geo;
})();
/** The mustard seam running down the inside of a bun half — UNIT (1 x 1), carrying
 * the character's own zig-zag motif into its melee. */
const bunSeamGeo = flatShapeGeo(zigShape(1, 0.14, 4, 0.36), 1);

// ─────────────────────────────────────────────────────────────────────────────
// Materials.
//
// Projectile BODIES use plain opaque singletons (no `transparent`, no pool, nothing
// ever animates them). Anything that fades independently draws a pooled instance.
// Every transparent material sets `depthWrite: false` — a transparent material that
// still writes depth silently occludes whatever is behind it, which has deleted VFX
// in this project twice.
// ─────────────────────────────────────────────────────────────────────────────

function materialPool<T extends THREE.Material>(size: number, build: () => T): () => T {
  const pool = Array.from({ length: size }, build);
  let i = 0;
  return () => pool[i++ % size];
}

/** Opaque, un-animated, projectile-only. Never handed to a fading particle: sharing
 * one material between a projectile in flight and a particle that fades itself to
 * zero makes the projectile vanish mid-flight the moment that particle dies. */
const solid = (color: string) => new THREE.MeshBasicMaterial({ color, side: THREE.DoubleSide });
const bodyMustardMat = solid(MUSTARD);
const bodyMustardDeepMat = solid(MUSTARD_DEEP);
const bodyMustardHotMat = solid(MUSTARD_HOT);
const bodyKetchupMat = solid(KETCHUP);
const bodyKetchupDeepMat = solid(KETCHUP_DEEP);
const bodyKetchupHotMat = solid(KETCHUP_HOT);

const fading = (color: string, opacity: number) => new THREE.MeshBasicMaterial({
  color, transparent: true, opacity, side: THREE.DoubleSide, depthWrite: false,
});

/** Bright condiment face — colour is set per spawn from `ctx.color`. */
const nextFaceMat = materialPool(48, () => fading(MUSTARD, 1));
/** The dark backing plate under every bright face. Sized separately per spawn. */
const nextBackMat = materialPool(48, () => fading(MUSTARD_DEEP, 1));
/** The hard near-white contact core. */
const nextHotMat = materialPool(20, () => fading(MUSTARD_HOT, 1));
/** Bun trough / crumb face / seam — the melee's three parts, pooled separately so a
 * clap never fights another clap over one material's opacity. */
const nextBunMat = materialPool(8, () => new THREE.MeshBasicMaterial({
  color: BUN, transparent: true, opacity: 1, side: THREE.DoubleSide, depthWrite: false,
}));
const nextCrustMat = materialPool(8, () => new THREE.MeshBasicMaterial({
  color: BUN_TOAST, transparent: true, opacity: 1, side: THREE.DoubleSide, depthWrite: false,
}));
const nextCrumbFaceMat = materialPool(8, () => fading(BUN_CRUMB, 1));
const nextSeamMat = materialPool(8, () => fading(MUSTARD, 1));
const nextCrumbMat = materialPool(14, () => new THREE.MeshBasicMaterial({
  color: BUN_TOAST, transparent: true, opacity: 1, depthWrite: false,
}));

// ─────────────────────────────────────────────────────────────────────────────
// Shared helpers
// ─────────────────────────────────────────────────────────────────────────────

/** Yaw that points an object's local +Z along a world XZ direction. This is the ONLY
 * rotation any flat ribbon in this file ever receives — see decision (1). */
function yawOf(dirX: number, dirZ: number): number {
  return Math.atan2(dirX, dirZ);
}

/** Seconds this projectile spends in the air, straight off the `rules.ts` ladders, so
 * wobble/shed rates can be authored per FLIGHT and survive a weapon changing rung. */
function flightSeconds(w: Weapon): number {
  if (w.range && w.speed) return w.range / w.speed;
  return FLIGHT_MS.normal / 1000;
}

/**
 * Impact scale, deliberately the same curve `game/vfx.ts` re-derived for the generic
 * burst (`clamp(0.85 + damage * 0.035, ...)`), so a Hot Dog hit and a generic hit read
 * as the same WEIGHT of event. Capped at 1.4 because none of these weapons should ever
 * approach the burst's 3.0 m ceiling.
 */
function impactScale(damage: number): number {
  return THREE.MathUtils.clamp(0.85 + damage * 0.035, 0.85, 1.4);
}

/** Per-projectile animation state, stashed on the pooled object (several shots from
 * the same weapon can be in flight at once, so this cannot be module state). */
interface FlightState { phase: number; shed: number; }

function flightState(obj: THREE.Object3D): FlightState {
  let st = obj.userData.__hotdog as FlightState | undefined;
  if (!st) {
    st = { phase: Math.random() * TWO_PI, shed: 0 };
    obj.userData.__hotdog = st;
  }
  return st;
}

/**
 * One flying dash of condiment on a ballistic arc: it stays aligned with its own
 * velocity, then lands flat on the ground and splays out sideways instead of sinking
 * through the floor. `scale` multiplies `dashGeo`'s 1 m length.
 *
 * The dash — a blunt-capped lozenge, never a round droplet — is what keeps this from
 * colliding with `soup.ts`, whose whole vocabulary is liquid droplets.
 */
function spawnDash(
  ctx: WeaponVfxCtx, color: string, deep: string,
  ox: number, oy: number, oz: number,
  vx: number, vy: number, vz: number,
  lengthM: number, life: number,
): void {
  const group = new THREE.Group();
  const backMat = nextBackMat();
  backMat.color.set(deep);           // SET, never read — see decision (3).
  backMat.opacity = 1;
  const back = new THREE.Mesh(dashGeo, backMat);
  back.scale.set(1.34, 1, 1.14);
  back.position.y = -CH * 0.008;
  group.add(back);
  const faceMat = nextFaceMat();
  faceMat.color.set(color);
  faceMat.opacity = 1;
  group.add(new THREE.Mesh(dashGeo, faceMat));
  group.renderOrder = 9;
  group.position.set(ox, oy, oz);

  // `dashGeo` is UNIT, so these are metres. 0.45 keeps a dash comfortably above the
  // ~0.12 m / 6 px floor below which a bright shape stops resolving at all.
  const width = lengthM * 0.45;
  const gravity = -8.2;
  ctx.spawnTransient(group, life, (t, e) => {
    const y = oy + vy * e + 0.5 * gravity * e * e;
    const grounded = y <= GROUND_Y;
    group.position.set(ox + vx * e, grounded ? GROUND_Y : y, oz + vz * e);
    if (grounded) {
      // Landed: flatten and smear along the direction it was travelling.
      group.rotation.y = yawOf(vx, vz);
      group.scale.set(width * 1.5, 1, lengthM * 0.75);
    } else {
      // In the air a dash stretches along its velocity — a squeezed line accelerating
      // is longer and thinner than one at rest, which is most of what separates
      // "condiment" from "pellet" at this distance.
      const cvy = vy + gravity * e;
      const speed = Math.hypot(vx, cvy, vz);
      const stretch = 1 + Math.min(0.85, speed * 0.07);
      group.rotation.y = yawOf(vx, vz);
      group.scale.set(width / stretch, 1, lengthM * stretch);
    }
    const fade = 1 - t * t;
    faceMat.opacity = fade;
    backMat.opacity = fade;
  });
}

/**
 * The hard contact core: a short, bright, near-white squeeze at the POINT OF CONTACT,
 * not at the target's centre — see decision (2). Offset back along −direction so it
 * sits on the attacker's side of the body, at the leading edge of the silhouette where
 * the camera can actually see it, which is also where the hit physically happened.
 *
 * 0.76 m back: a default `ChibiRig` head is ~0.48 m in radius and the widest on the
 * cast is ~0.75 m, so this clears even the worst case.
 */
function spawnContactSqueeze(
  ctx: WeaponVfxCtx, hot: string, deep: string, lengthM: number, widthM: number, life: number,
): void {
  const d = ctx.direction;
  const flat = Math.hypot(d.x, d.z) > 1e-4;
  const back = flat ? CH * 0.36 : 0;
  spawnSqueeze(
    ctx, hot, deep,
    ctx.position.x - d.x * back, ctx.position.y, ctx.position.z - d.z * back,
    flat ? yawOf(d.x, d.z) + Math.PI * 0.5 : 0,
    lengthM, widthM, life, 0.45,
  );
}

/**
 * THE SQUEEZE — the one shape this whole file exists to draw.
 *
 * A hard-edged zig-zag ribbon laid down along `yaw`, DRAWN ON from one end the way a
 * bottle lays a stripe rather than stamped whole. Used for the crossing stripe an
 * impact paints on the target, for the short bright squirt at the contact point, and
 * for Ketchup's floor slick — one primitive, three jobs, which is what makes Hot Dog's
 * three weapons read as one character.
 *
 * `slipStripeGeo` is authored at FINAL SIZE (1.64 m long, 0.71 m across) and origined
 * at its start, so the group's scale is a multiplier and `scale.z` is the draw-on.
 *
 * The first build used a radial star of tapered rays here instead. Rendering it
 * settled the question immediately: a ring of short bright spikes radiating from a hit
 * is a SPARK BURST, which is precisely the generic vocabulary this system exists to
 * replace, and it read as a smear of gold specks against a warm floor. A stripe with
 * corners in it cannot be mistaken for a spark at any size.
 */
function spawnSqueeze(
  ctx: WeaponVfxCtx, color: string, deep: string,
  cx: number, cy: number, cz: number,
  yaw: number, lengthM: number, widthM: number,
  life: number, holdFrac: number, startOpacity = 1, core = '#FFF6DC',
): void {
  const lm = lengthM / SLIP_LEN;
  const wm = widthM / SLIP_WID;

  const group = new THREE.Group();
  group.rotation.y = yaw;
  // Origined at the START of the stripe, half a length back along `yaw`, so the drawn
  // stripe ends up CENTRED on `(cx, cz)` once it has fully snapped out.
  group.position.set(cx - Math.sin(yaw) * lengthM * 0.5, cy, cz - Math.cos(yaw) * lengthM * 0.5);

  const backMat = nextBackMat();
  backMat.color.set(deep);              // SET, never read — see decision (3).
  backMat.opacity = startOpacity;
  const back = new THREE.Mesh(slipStripeGeo, backMat);
  back.scale.set(1.42, 1, 1.02);
  back.position.y = -CH * 0.009;
  group.add(back);

  const faceMat = nextFaceMat();
  faceMat.color.set(color);
  faceMat.opacity = startOpacity;
  group.add(new THREE.Mesh(slipStripeGeo, faceMat));

  // A narrower PALE ribbon inset on top of the bright one. Gold and crimson are both
  // warm mid-value colours over a warm mid-value terracotta floor, so the stripe was
  // relying entirely on its dark backing for separation and read as one flat gold mass
  // at 100 px. A three-step value ramp — deep edge, saturated body, pale core — is
  // what makes it read as a squeezed BEAD with a highlight down its spine, and the
  // pale step is the only one of the three that is not competing inside the arena's
  // own hue stack.
  const coreMat = nextHotMat();
  coreMat.color.set(core);
  coreMat.opacity = startOpacity;
  const coreMesh = new THREE.Mesh(slipStripeGeo, coreMat);
  coreMesh.scale.set(0.42, 1, 0.985);
  coreMesh.position.y = CH * 0.006;
  group.add(coreMesh);

  ctx.spawnTransient(group, life, (t) => {
    // Snaps out over the first fifth of its life then holds: a squeeze is fast and it
    // does not grow afterwards.
    const draw = 1 - Math.pow(1 - Math.min(1, t * 5.5), 3);
    group.scale.set(wm, 1, Math.max(0.02, lm * draw));
    const fade = t < holdFrac ? 1 : 1 - (t - holdFrac) / (1 - holdFrac);
    faceMat.opacity = startOpacity * fade;
    backMat.opacity = startOpacity * fade;
    coreMat.opacity = startOpacity * fade;
  });
}

// ─────────────────────────────────────────────────────────────────────────────
// Projectile builders
// ─────────────────────────────────────────────────────────────────────────────

/**
 * Mustard Blast: a zig-zag ribbon of mustard, travelling along its own length with a
 * blunt head. It is a LINE, and it is the only projectile in the roster that is —
 * which is precisely why it is instantly separable from the plates, rings, rolls and
 * droplets every other converted weapon throws.
 */
function buildMustardRibbon(color: string): THREE.Group {
  const group = new THREE.Group();

  const back = new THREE.Mesh(mustardRibbonGeo, bodyMustardDeepMat);
  back.scale.set(1.5, 1, 1.07);
  back.position.y = -CH * 0.012;
  group.add(back);

  group.add(new THREE.Mesh(mustardRibbonGeo, color === MUSTARD ? bodyMustardMat : solidFor(color)));

  // Blunt head — the nozzle end. Gives the ribbon a front, so at 40 px the eye reads
  // a direction of travel instead of an ambiguous squiggle.
  const headBack = new THREE.Mesh(dashGeo, bodyMustardDeepMat);
  headBack.scale.set(MUSTARD_HALFW * 3.2, 1, CH * 0.15);
  headBack.position.set(0, -CH * 0.012, MUSTARD_LEN * 0.46);
  group.add(headBack);
  const head = new THREE.Mesh(dashGeo, bodyMustardHotMat);
  head.scale.set(MUSTARD_HALFW * 2.1, 1, CH * 0.105);
  head.position.set(0, 0, MUSTARD_LEN * 0.47);
  group.add(head);
  return group;
}

/**
 * Ketchup Slip: a fat blunt slug with three trailing dashes that lag and swing behind
 * it. Deliberately the opposite READ from Mustard's ribbon while staying inside the
 * same vocabulary — a broken, wobbling, heavy line against a continuous sharp one, and
 * deep crimson against gold. Two weapons of one character should share a language and
 * not a silhouette.
 */
interface KetchupParts { tail: THREE.Object3D[]; }

function buildKetchupSlug(color: string): THREE.Group {
  const group = new THREE.Group();
  const faceMat = color === KETCHUP ? bodyKetchupMat : solidFor(color);

  const headBack = new THREE.Mesh(dashGeo, bodyKetchupDeepMat);
  headBack.scale.set(KETCHUP_WID * 1.32, 1, KETCHUP_LEN * 1.12);
  headBack.position.y = -CH * 0.012;
  group.add(headBack);
  const head = new THREE.Mesh(dashGeo, faceMat);
  head.scale.set(KETCHUP_WID, 1, KETCHUP_LEN);
  group.add(head);
  const gloss = new THREE.Mesh(dashGeo, bodyKetchupHotMat);
  gloss.scale.set(KETCHUP_WID * 0.32, 1, KETCHUP_LEN * 0.42);
  gloss.position.set(-KETCHUP_WID * 0.2, CH * 0.004, KETCHUP_LEN * 0.16);
  group.add(gloss);

  const tail: THREE.Object3D[] = [];
  for (let i = 0; i < 3; i++) {
    const seg = new THREE.Group();
    const k = 1 - i * 0.24;
    const sb = new THREE.Mesh(dashGeo, bodyKetchupDeepMat);
    sb.scale.set(KETCHUP_WID * 0.72 * k * 1.34, 1, KETCHUP_LEN * 0.42 * k * 1.14);
    sb.position.y = -CH * 0.012;
    seg.add(sb);
    const sf = new THREE.Mesh(dashGeo, faceMat);
    sf.scale.set(KETCHUP_WID * 0.72 * k, 1, KETCHUP_LEN * 0.42 * k);
    seg.add(sf);
    seg.position.z = -KETCHUP_LEN * (0.7 + i * 0.46);
    group.add(seg);
    tail.push(seg);
  }
  const parts: KetchupParts = { tail };
  group.userData.__parts = parts;
  return group;
}

/** Opaque per-colour body materials, cached so a weapon re-skinned in `rules.ts` still
 * allocates exactly one material for its whole run rather than one per projectile. */
const solidCache = new Map<string, THREE.MeshBasicMaterial>();
function solidFor(color: string): THREE.MeshBasicMaterial {
  let m = solidCache.get(color);
  if (!m) { m = solid(color); solidCache.set(color, m); }
  return m;
}

// ─────────────────────────────────────────────────────────────────────────────
// The Bun Slash clap — the melee hero
// ─────────────────────────────────────────────────────────────────────────────

/** One bun half: trough + recessed pale crumb face + the character's mustard seam.
 * Returned as a group so the caller can hinge it about its own Z inside a yawed
 * parent, which is the correct-by-construction way to compose two rotations. */
function buildBunHalf(
  radius: number, length: number,
  fade: { bun: THREE.Material; crust: THREE.Material; crumb: THREE.Material; seam: THREE.Material },
): THREE.Group {
  const g = new THREE.Group();
  // Toasted outer shell, one step proud of the bun — the same dark-backing device
  // every ribbon in this file uses. Without it a 0.65-value bun sits on a 0.55-value
  // terracotta floor with no edge at all, and the clap reads as a pale tray.
  const crust = new THREE.Mesh(bunHalfGeo, fade.crust);
  crust.scale.set(radius * 1.13, radius * 1.13, length * 1.04);
  crust.position.y = -radius * 0.04;
  g.add(crust);
  const shell = new THREE.Mesh(bunHalfGeo, fade.bun);
  shell.scale.set(radius, radius, length);
  g.add(shell);
  // Sized to FILL most of the trough, leaving the gold shell as a rim around it.
  // Rendering settled this: a half-tube whose mouth faces a top-down camera shows its
  // concave interior as a solid rectangle, so a small recessed crumb face just turned
  // the whole half into a flat gold slab. A pale interior framed by a gold rim and a
  // toasted outer edge is what actually reads as bread from this angle.
  const crumb = new THREE.Mesh(bunCrumbGeo, fade.crumb);
  crumb.scale.set(radius * 0.86, 1, length * 0.92);
  crumb.position.y = -radius * 0.34;
  g.add(crumb);
  const seam = new THREE.Mesh(bunSeamGeo, fade.seam);
  seam.scale.set(radius * 1.3, 1, length * 0.84);
  seam.position.y = -radius * 0.3;
  g.add(seam);
  return g;
}

// ─────────────────────────────────────────────────────────────────────────────

export const hotdogWeaponVfx: CharacterWeaponVfxMap = {
  // ── Mustard Blast ──────────────────────────────────────────────────────────
  // `rangedLong` / `SPEED.long` — the fast straight poke. Everything about it is
  // sharp: hard corners, a blunt nose, a tight shed rate, and an impact that is all
  // straight tapered rays.
  Mustard: {
    projectile(ctx) {
      const obj = buildMustardRibbon(ctx.color);
      obj.position.copy(ctx.position);
      return obj;
    },

    trail(ctx) {
      const obj = ctx.object;
      if (!obj) return;
      const dt = ctx.dt ?? 0;
      const st = flightState(obj);
      // Authored as oscillations PER FLIGHT, so the read survives a rung change.
      st.phase += (dt / flightSeconds(ctx.weapon)) * TWO_PI * 3.2;

      // Yaw only — see decision (1). A face-up ribbon rotated about world up cannot
      // tip edge-on, so the wobble is free of the trap that eats flat planes here.
      obj.rotation.y = yawOf(ctx.direction.x, ctx.direction.z) + Math.sin(st.phase) * 0.16;
      // Extrusion pulse: the ribbon lengthens and narrows as if still being squeezed.
      const squeeze = 1 + Math.sin(st.phase * 1.7) * 0.13;
      obj.scale.set(1 / squeeze, 1, squeeze);

      st.shed -= dt;
      if (st.shed <= 0) {
        st.shed = 0.05 + Math.random() * 0.03;
        // Flicked off the TAIL, backwards and sideways: a bead breaking off the line.
        spawnDash(
          ctx, ctx.color, MUSTARD_DEEP,
          ctx.position.x - ctx.direction.x * MUSTARD_LEN * 0.5,
          ctx.position.y,
          ctx.position.z - ctx.direction.z * MUSTARD_LEN * 0.5,
          -ctx.direction.x * (0.6 + Math.random() * 0.7) + (Math.random() - 0.5) * 0.9,
          0.25 + Math.random() * 0.45,
          -ctx.direction.z * (0.6 + Math.random() * 0.7) + (Math.random() - 0.5) * 0.9,
          CH * (0.12 + Math.random() * 0.06), 0.26 + Math.random() * 0.12,
        );
      }
    },

    // The blast: a hard near-white blot AT THE CONTACT POINT, a seven-ray squeeze star
    // launched from a contact ring already clear of the head, and dashes thrown out to
    // land on the floor. No ring, no plate, no round bloom, no spark — every element
    // is a straight-edged squeezed line.
    impact(ctx) {
      const s = impactScale(ctx.damage);
      const d0 = ctx.direction;
      const across = yawOf(d0.x, d0.z) + Math.PI * 0.5;

      // ── The stripe ─────────────────────────────────────────────────────────
      // A bold zig-zag squeezed ACROSS the target, perpendicular to the line of fire.
      // MEASURED against the fighter, not guessed: at 2.19 m long against a ~1.15 m
      // head it overhangs the silhouette by half a metre on BOTH sides, so even with
      // its middle third hidden behind the target the two ends read as one continuous
      // stripe passing through — which is a stronger composition than an effect that
      // dodges the character, because the interruption is what places it in depth.
      spawnSqueeze(
        ctx, ctx.color, MUSTARD_DEEP,
        ctx.position.x, ctx.position.y, ctx.position.z,
        across, CH * 1.045 * s, CH * 0.30 * s, 0.34, 0.5,
      );
      // The hot squirt, at the CONTACT POINT rather than dead centre — decision (2).
      spawnContactSqueeze(ctx, MUSTARD_HOT, MUSTARD_DEEP, CH * 0.46 * s, CH * 0.2 * s, 0.19);

      const { x, y, z } = ctx.position;
      const R0 = CH * 0.30 * s;
      for (let i = 0; i < 8; i++) {
        const a = (i / 8) * TWO_PI + Math.random() * 0.6;
        const out = (2.1 + Math.random() * 1.5) * s;
        spawnDash(
          ctx, ctx.color, MUSTARD_DEEP,
          x + Math.cos(a) * R0, y, z + Math.sin(a) * R0,
          Math.cos(a) * out + ctx.direction.x * 0.7, 1.7 + Math.random() * 1.2,
          Math.sin(a) * out + ctx.direction.z * 0.7,
          CH * (0.14 + Math.random() * 0.07) * s, 0.42 + Math.random() * 0.14,
        );
      }
    },

    // The squeeze: a short zig-zag stripe snapping out ahead of the muzzle plus a few
    // dashes flicked down the line of fire. Not the generic pale circular pop.
    cast(ctx) {
      const d = ctx.direction;
      const yaw = yawOf(d.x, d.z);
      const group = new THREE.Group();
      const backMat = nextBackMat();
      backMat.color.set(MUSTARD_DEEP);
      backMat.opacity = 1;
      const back = new THREE.Mesh(mustardRibbonGeo, backMat);
      back.scale.set(1.5, 1, 1.08);
      back.position.y = -CH * 0.012;
      group.add(back);
      const faceMat = nextFaceMat();
      faceMat.color.set(ctx.color);
      faceMat.opacity = 1;
      group.add(new THREE.Mesh(mustardRibbonGeo, faceMat));
      group.renderOrder = 11;
      group.rotation.y = yaw;
      const ox = ctx.position.x, oz = ctx.position.z;
      ctx.spawnTransient(group, 0.16, (t) => {
        const e = 1 - Math.pow(1 - t, 2);
        group.scale.set(0.6 + t * 0.3, 1, 0.35 + e * 0.85);
        group.position.set(ox + d.x * e * CH * 0.16, ctx.position.y, oz + d.z * e * CH * 0.16);
        const fade = 1 - t;
        faceMat.opacity = fade;
        backMat.opacity = fade;
      });

      for (let i = 0; i < 4; i++) {
        spawnDash(
          ctx, ctx.color, MUSTARD_DEEP,
          ctx.position.x, ctx.position.y, ctx.position.z,
          d.x * (1.4 + Math.random() * 1.1) + (Math.random() - 0.5) * 0.7,
          0.4 + Math.random() * 0.5,
          d.z * (1.4 + Math.random() * 1.1) + (Math.random() - 0.5) * 0.7,
          CH * (0.12 + Math.random() * 0.05), 0.3,
        );
      }
    },
  },

  // ── Ketchup Slip ───────────────────────────────────────────────────────────
  // `rangedMid`, `effect: 'slow'`, and the ability text is literally "makes enemies
  // slide and lose control" — so the hero beat is a SLICK ON THE FLOOR, not the hit.
  Ketchup: {
    projectile(ctx) {
      const obj = buildKetchupSlug(ctx.color);
      obj.position.copy(ctx.position);
      return obj;
    },

    trail(ctx) {
      const obj = ctx.object;
      if (!obj) return;
      const dt = ctx.dt ?? 0;
      const st = flightState(obj);
      st.phase += (dt / flightSeconds(ctx.weapon)) * TWO_PI * 2.4;
      obj.rotation.y = yawOf(ctx.direction.x, ctx.direction.z);

      // The tail LAGS: each segment swings later than the one ahead of it, so the slug
      // reads as a heavy thing dragging a loose line rather than as a rigid arrow.
      const parts = obj.userData.__parts as KetchupParts | undefined;
      if (parts) {
        for (let i = 0; i < parts.tail.length; i++) {
          const seg = parts.tail[i];
          const lag = Math.sin(st.phase - (i + 1) * 0.9);
          seg.position.x = lag * CH * 0.055 * (i + 1) * 0.55;
          seg.rotation.y = lag * 0.4;
        }
      }
      const squash = 1 + Math.sin(st.phase * 1.3) * 0.09;
      obj.scale.set(squash, 1, 1 / squash);

      st.shed -= dt;
      if (st.shed <= 0) {
        st.shed = 0.09 + Math.random() * 0.05;
        spawnDash(
          ctx, ctx.color, KETCHUP_DEEP,
          ctx.position.x - ctx.direction.x * KETCHUP_LEN * 1.5,
          ctx.position.y,
          ctx.position.z - ctx.direction.z * KETCHUP_LEN * 1.5,
          (Math.random() - 0.5) * 0.9, 0.1 + Math.random() * 0.3, (Math.random() - 0.5) * 0.9,
          CH * (0.11 + Math.random() * 0.05), 0.24 + Math.random() * 0.1,
        );
      }
    },

    impact(ctx) {
      const s = impactScale(ctx.damage);
      const d = ctx.direction;
      // Shorter and fatter than Mustard's stripe — the same primitive read as a
      // heavier, wetter condiment. Same character, different weapon.
      spawnSqueeze(
        ctx, ctx.color, KETCHUP_DEEP,
        ctx.position.x, ctx.position.y, ctx.position.z,
        yawOf(d.x, d.z) + Math.PI * 0.5, CH * 0.78 * s, CH * 0.36 * s, 0.3, 0.45,
      );
      spawnContactSqueeze(ctx, KETCHUP_HOT, KETCHUP_DEEP, CH * 0.4 * s, CH * 0.2 * s, 0.18);

      // ── THE SLICK ──────────────────────────────────────────────────────────
      // A hard-edged zig-zag stripe DRAWN ON along the line of fire, starting just
      // past the target's own footprint.
      //
      // Ground marks in this arena are a minefield and this one was checked against
      // every family it could be confused with, because a condiment stripe is the most
      // confusable thing anyone has proposed:
      //   * `game/vfx.ts`'s Sticky Trail marks — 2.2 m PINK/PALE-GOLD CIRCLES at
      //     opacity 0.6, painted continuously under a moving fighter.
      //   * its generic splats — 2.0 m red-orange CIRCLES at opacity 0.55.
      //   * the hazard puddles that slow fighters — large soft cyan ellipses.
      //   * the arena's permanent beige LOBED floor-spill decals.
      // Every one of those is a soft round or lobed blob. This is a 1.6 m long,
      // 0.26 m wide POLYLINE with four hard corners, at opacity 0.95, that grows from
      // one end over 0.12 s and is gone inside 0.8 s. It shares neither shape, nor
      // width-to-length ratio, nor duration, nor opacity with any of them, and it is
      // the only mark in the arena with a corner in it.
      spawnSqueeze(
        ctx, ctx.color, KETCHUP_DEEP,
        ctx.position.x + d.x * CH * 0.5, GROUND_Y, ctx.position.z + d.z * CH * 0.5,
        yawOf(d.x, d.z), SLIP_LEN * s, SLIP_WID * s, 0.8, 0.55, 0.95, KETCHUP_HOT,
      );

      const { x, y, z } = ctx.position;
      const R0 = CH * 0.29 * s;
      for (let i = 0; i < 6; i++) {
        const a = (i / 6) * TWO_PI + Math.random() * 0.7;
        const out = (1.8 + Math.random() * 1.3) * s;
        spawnDash(
          ctx, ctx.color, KETCHUP_DEEP,
          x + Math.cos(a) * R0, y, z + Math.sin(a) * R0,
          Math.cos(a) * out + d.x * 0.6, 1.5 + Math.random() * 1.1,
          Math.sin(a) * out + d.z * 0.6,
          CH * (0.14 + Math.random() * 0.07) * s, 0.44 + Math.random() * 0.14,
        );
      }
    },

    cast(ctx) {
      const d = ctx.direction;
      for (let i = 0; i < 5; i++) {
        spawnDash(
          ctx, ctx.color, KETCHUP_DEEP,
          ctx.position.x, ctx.position.y, ctx.position.z,
          d.x * (1 + Math.random() * 0.9) + (Math.random() - 0.5) * 0.8,
          0.3 + Math.random() * 0.4,
          d.z * (1 + Math.random() * 0.9) + (Math.random() - 0.5) * 0.8,
          CH * (0.13 + Math.random() * 0.05), 0.3,
        );
      }
      // A single fat blob squeezed out ahead of the muzzle — the nozzle burping.
      const group = new THREE.Group();
      const backMat = nextBackMat();
      backMat.color.set(KETCHUP_DEEP);
      backMat.opacity = 1;
      const back = new THREE.Mesh(dashGeo, backMat);
      back.scale.set(1.3, 1, 1.16);
      back.position.y = -CH * 0.01;
      group.add(back);
      const faceMat = nextFaceMat();
      faceMat.color.set(ctx.color);
      faceMat.opacity = 1;
      group.add(new THREE.Mesh(dashGeo, faceMat));
      group.renderOrder = 11;
      group.rotation.y = yawOf(d.x, d.z);
      group.position.copy(ctx.position);
      ctx.spawnTransient(group, 0.15, (t) => {
        const g = THREE.MathUtils.lerp(CH * 0.06, CH * 0.24, 1 - Math.pow(1 - t, 2));
        group.scale.set(g * 0.55, 1, g);
        group.position.set(
          ctx.position.x + d.x * t * CH * 0.14, ctx.position.y, ctx.position.z + d.z * t * CH * 0.14,
        );
        faceMat.opacity = 1 - t;
        backMat.opacity = 1 - t;
      });
    },
  },

  // ── Bun Slash ──────────────────────────────────────────────────────────────
  // `meleeStrong`, 11 dmg, cone 75. The bun CLAPS SHUT on the target: two troughs
  // swing in from outside the silhouette, their pale crumb faces and mustard seams
  // turned up at the camera, meet, squirt condiment sideways, and fall open.
  //
  // Nothing else in the roster does a paired hinged motion. `taco.ts` owns curved
  // SHELL TILES, but those are fragments SCATTERING outward — small, many, one-way.
  // These are two large mirrored halves converging and closing. The shared curvature
  // is incidental; the readable event is the clap.
  Slash: {
    impact(ctx) {
      const s = impactScale(ctx.damage);
      const d = ctx.direction;
      const yaw = yawOf(d.x, d.z);
      const { x, y, z } = ctx.position;

      // Sized against the HEAD, not the torso — the widest part of a fighter on this
      // cast is its head (Hamburger's bun ~1.2 m, Donut's glazed mass ~1.5 m), so
      // "clears the body" means clearing ~0.75 m of radius, not the 0.41 m a STOUT
      // torso would suggest. Open span 2 * (0.79 + 0.39) = 2.36 m at the first frame,
      // closing to 1.30 m; under the generic burst's 3.0 m ceiling and, being two thin
      // troughs with an empty middle, it FRAMES the fighter instead of covering it.
      const R = CH * 0.175 * s;     // 0.45 m trough radius
      const L = CH * 0.62 * s;      // 1.60 m long, along the line of attack
      const OPEN = CH * 0.375 * s;  // 0.79 m from centre at first frame
      const SHUT = CH * 0.125 * s;  // 0.26 m from centre when closed

      const rig = new THREE.Group();
      rig.rotation.y = yaw;
      rig.position.set(x, y - CH * 0.06, z);
      rig.renderOrder = 10;

      const bunMat = nextBunMat();
      bunMat.color.set(BUN);
      bunMat.opacity = 1;
      const crumbMat = nextCrumbFaceMat();
      crumbMat.color.set(BUN_CRUMB);
      crumbMat.opacity = 1;
      const seamMat = nextSeamMat();
      seamMat.color.set(ctx.color);
      seamMat.opacity = 1;
      const crustMat = nextCrustMat();
      crustMat.color.set(BUN_TOAST);
      crustMat.opacity = 1;
      const fadeSet = { bun: bunMat, crust: crustMat, crumb: crumbMat, seam: seamMat };

      const right = buildBunHalf(R, L, fadeSet);
      const left = buildBunHalf(R, L, fadeSet);
      rig.add(right, left);

      // The seam flash: a hard pale bar along the line where the two halves meet,
      // fired at the instant of closure. Its whole job is to say WHEN the clap landed.
      const seamFlashMat = nextHotMat();
      seamFlashMat.color.set('#FFF6DA');
      seamFlashMat.opacity = 0;
      const seamFlash = new THREE.Mesh(dashGeo, seamFlashMat);
      seamFlash.scale.set(CH * 0.075, 1, L * 0.92);
      seamFlash.position.y = R * 0.15;
      seamFlash.renderOrder = 12;
      rig.add(seamFlash);

      let squirted = false;
      ctx.spawnTransient(rig, 0.46, (t) => {
        // Snap shut over the first 35% of the life, then spring back open and fade —
        // a bite, not a slow squeeze.
        const closing = Math.min(1, t / 0.35);
        const eased = 1 - Math.pow(1 - closing, 3);
        const open = t <= 0.35 ? eased : eased - (t - 0.35) / 0.65 * 0.55;
        const gap = THREE.MathUtils.lerp(OPEN, SHUT, THREE.MathUtils.clamp(open, 0, 1));
        right.position.x = gap;
        left.position.x = -gap;
        // Hinge: the mouths tip toward each other as they close. `rotation.z` on the
        // CHILD inside a yawed PARENT — two rotations composed by the scene graph in
        // the right order, never stacked as intrinsic Euler angles on one object.
        const tip = THREE.MathUtils.lerp(0.55, 0.12, THREE.MathUtils.clamp(open, 0, 1));
        right.rotation.z = tip;
        left.rotation.z = -tip;

        seamFlashMat.opacity = t < 0.35 ? 0 : Math.max(0, 1 - (t - 0.35) / 0.2);

        const fade = t < 0.6 ? 1 : 1 - (t - 0.6) / 0.4;
        bunMat.opacity = fade;
        crustMat.opacity = fade;
        crumbMat.opacity = fade;
        seamMat.opacity = fade;

        if (!squirted && t >= 0.35) {
          squirted = true;
          // The payoff: condiment squeezed sideways out of the closing bun, both
          // colours at once — the character's whole identity in one beat.
          const px = -Math.sin(yaw), pz = -Math.cos(yaw); // world axis across the bun
          for (let i = 0; i < 6; i++) {
            const side = i % 2 === 0 ? 1 : -1;
            const gold = i < 4;
            const spread = (Math.random() - 0.5) * 0.8;
            spawnDash(
              ctx, gold ? MUSTARD : KETCHUP, gold ? MUSTARD_DEEP : KETCHUP_DEEP,
              x + px * side * SHUT * 1.2, y, z + pz * side * SHUT * 1.2,
              (px * side * (2.4 + Math.random() * 1.6)) + d.x * spread,
              1.6 + Math.random() * 1.3,
              (pz * side * (2.4 + Math.random() * 1.6)) + d.z * spread,
              CH * (0.15 + Math.random() * 0.07) * s, 0.4 + Math.random() * 0.14,
            );
          }
        }
      });

      // Toasted crumbs knocked loose — the one non-flat particle in the file, launched
      // from the contact ring so none of them lives inside the silhouette.
      const R0 = CH * 0.24 * s;
      for (let i = 0; i < 6; i++) {
        const a = Math.random() * TWO_PI;
        const out = (1.9 + Math.random() * 1.6) * s;
        const mat = nextCrumbMat();
        mat.color.set(i % 3 === 0 ? BUN : BUN_TOAST);
        mat.opacity = 1;
        const crumb = new THREE.Mesh(crumbGeo, mat);
        crumb.renderOrder = 9;
        const ox = x + Math.cos(a) * R0, oz = z + Math.sin(a) * R0;
        const vx = Math.cos(a) * out, vz = Math.sin(a) * out;
        const vy = 1.7 + Math.random() * 1.3;
        const sc = (0.8 + Math.random() * 0.7) * s;
        crumb.scale.setScalar(sc);
        const rx = Math.random() * 9 - 4.5, ry = Math.random() * 9 - 4.5;
        ctx.spawnTransient(crumb, 0.42 + Math.random() * 0.14, (t, e) => {
          crumb.position.set(ox + vx * e, Math.max(GROUND_Y, y + vy * e - 4.6 * e * e), oz + vz * e);
          crumb.rotation.set(rx * e, ry * e, 0);
          mat.opacity = 1 - t * t;
        });
      }
    },

    // The wind-up, at the attacker: the bun springs OPEN and a lick of mustard is
    // flicked down the swing line. Cast and impact are the two halves of one gesture,
    // which is what makes a melee swing read as a swing rather than as two effects.
    cast(ctx) {
      const d = ctx.direction;
      const yaw = yawOf(d.x, d.z);
      const s = 0.62;
      const R = CH * 0.175 * s;
      const L = CH * 0.62 * s;

      const rig = new THREE.Group();
      rig.rotation.y = yaw;
      rig.position.copy(ctx.position);
      rig.renderOrder = 11;

      const bunMat = nextBunMat();
      bunMat.color.set(BUN);
      bunMat.opacity = 1;
      const crumbMat = nextCrumbFaceMat();
      crumbMat.color.set(BUN_CRUMB);
      crumbMat.opacity = 1;
      const seamMat = nextSeamMat();
      seamMat.color.set(ctx.color);
      seamMat.opacity = 1;
      const crustMat = nextCrustMat();
      crustMat.color.set(BUN_TOAST);
      crustMat.opacity = 1;
      const fadeSet = { bun: bunMat, crust: crustMat, crumb: crumbMat, seam: seamMat };
      const right = buildBunHalf(R, L, fadeSet);
      const left = buildBunHalf(R, L, fadeSet);
      rig.add(right, left);

      ctx.spawnTransient(rig, 0.2, (t) => {
        const e = 1 - Math.pow(1 - t, 2);
        const gap = THREE.MathUtils.lerp(CH * 0.06, CH * 0.2, e);
        right.position.x = gap;
        left.position.x = -gap;
        right.rotation.z = e * 0.6;
        left.rotation.z = -e * 0.6;
        const fade = 1 - t;
        bunMat.opacity = fade;
        crustMat.opacity = fade;
        crumbMat.opacity = fade;
        seamMat.opacity = fade;
      });

      for (let i = 0; i < 3; i++) {
        spawnDash(
          ctx, MUSTARD, MUSTARD_DEEP,
          ctx.position.x, ctx.position.y, ctx.position.z,
          d.x * (1.2 + Math.random()) + (Math.random() - 0.5) * 0.9, 0.5 + Math.random() * 0.4,
          d.z * (1.2 + Math.random()) + (Math.random() - 0.5) * 0.9,
          CH * (0.12 + Math.random() * 0.05), 0.28,
        );
      }
    },
  },
};
