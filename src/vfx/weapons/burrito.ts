/**
 * Burrito weapon VFX — the cast's WRAPPED character.
 *
 * ── Burrito's identity: A CYLINDER OF TORTILLA THAT COMES UNROLLED ───────────
 * Every other converted weapon in this directory throws a shape that is already
 * finished: `pizza.ts` throws flat spinning plates, `donut.ts` throws rings,
 * `taco.ts` throws brittle curved shell tiles, `soup.ts` throws liquid,
 * `lollipop.ts` owns candy stripes and a boundary arc. Burrito is the only fighter
 * whose ammunition is a thing that has been ROLLED UP, and that is the whole
 * vocabulary of this file:
 *
 *   * The RIBBON. A tortilla is one long flat strip wound into a spiral, and every
 *     big beat here is that strip changing state — a tight coil UNROLLING into a
 *     sweeping arc (`Disc`), or a loose strip WINDING UP around a target
 *     (`Roll`). It is drawn as a chain of flat slats laid along a spiral that is
 *     recomputed every frame, so the ribbon genuinely unwinds rather than just
 *     scaling up. Nothing else in the roster draws a spiral, and nothing else
 *     draws an effect whose SHAPE changes over its life.
 *   * The FOIL. Burrito is served in a peeled foil wrapper (`FOIL` in
 *     `src/characters/burrito.ts`), and foil is this file's answer to the recorded
 *     finding that additive warm glow over this arena's bright warm terracotta
 *     floor makes a wash instead of a core. Foil is COOL, near-white, opaque and
 *     hard-edged: it separates from the floor on hue AND on value, which pale
 *     tortilla on its own does not.
 *   * The SPILLED FILLING. Rice grains, beans and cheese strands — deliberately
 *     different forms from `taco.ts`'s meat lumps / lettuce curls / tomato dice, so
 *     the two "food that comes apart" fighters never read as each other. Rice is
 *     many tiny capsules; cheese is long thin strands; nothing here is a chunk.
 *
 * Weapon keys (`game/rules.ts` -> `CHARACTERS.burrito.weapons`), all converted:
 *   `'Disc'`  Burrito Disc  — `rangedLong`, 10 dmg      → he throws HIMSELF, rolled
 *   `'Roll'`  Roll Stun     — `meleeQuick`, 4 dmg, stun → the target gets WRAPPED
 *   `'Swarm'` Topping Swarm — `rangedMax`, 4 homing pellets, one per topping
 *
 * ── Topping Swarm reads its four pellets out of `rules.ts` ───────────────────
 * `combat.ts` spawns one projectile per `pelletColors` entry, all under the key
 * `'Swarm'`. A single `WeaponVfx` entry therefore has to serve four visually
 * different toppings, and it resolves which one an instance is by looking
 * `ctx.color` up IN `ctx.weapon.pelletColors` (`toppingIndex` below) rather than by
 * hardcoding hex strings — re-skinning the toppings in `rules.ts` keeps working.
 * Four pellets are in the air simultaneously, so each topping form also owns its own
 * body materials; a single shared body material recoloured at build time would make
 * whichever pellet built last recolour the other three.
 *
 * ── Scale discipline ────────────────────────────────────────────────────────
 * Every size is a fraction of `CHARACTER_HEIGHT`, never a bare metre literal, so
 * this survives the next camera move. `game/vfx.ts`'s generic burst is 1.74 m
 * typical / 3.0 m hard cap against a 2.10 m character; the largest thing here is
 * the wrap helix at 1.68 m across, and it is a narrow ribbon rather than a mass, so
 * the fighter stays readable straight through its own hit — the acceptance test, and
 * what every "rendering the first build settled" note below was checked against.
 */

import * as THREE from 'three';
import { FLIGHT_MS, type Weapon } from '../../game/rules';
import { CHARACTER_HEIGHT } from '../../units';
import type { CharacterWeaponVfxMap, WeaponVfxCtx } from './types';

// ─────────────────────────────────────────────────────────────────────────────
// Palette — mirrors the module-private consts in `src/characters/burrito.ts` so the
// thrown food matches the fighter throwing it. (They are `const`, not exported, so
// this is a deliberate copy; the values are the contract.) Authored as wanted and
// NOT pre-compensated: the grade reproduces hue within ~4° and only destroys
// channels below ~10/255.
// ─────────────────────────────────────────────────────────────────────────────

const TORTILLA = '#F5EAD6';        // pale flour wrap — the dominant mass
const TORTILLA_SHADE = '#E4CFA0';  // the shaded side of a slat
/** The toasted griddle edge. Every pale tortilla slat is drawn over a slightly
 * larger slat of THIS, which guarantees a dark outline on all sides — the same
 * device `pizza.ts` uses on its dough plate, and for the same reason: a pale warm
 * strip over this arena's pale warm floor otherwise dissolves into it. */
const TORTILLA_TOAST = '#B9843C';
/**
 * The ribbon's own rim colour, and it is deliberately much darker than
 * `TORTILLA_TOAST`.
 *
 * MEASURED at shipped framing rather than guessed: this arena's floor is a warm
 * terracotta around `rgb(192,120,79)`, and `TORTILLA_TOAST` (185,132,60) sits at
 * almost exactly the same VALUE. A rim in it is present in the buffer and does no
 * separating work on screen, so the pale ribbon still dissolved into the floor at
 * game distance even though it looked fine in a 4x crop. This is a full stop darker
 * and is what actually draws the ribbon's edge.
 */
const RIBBON_RIM = '#6B3E12';
/**
 * Charred griddle mark. The DARKEST thing this file draws, and it exists because
 * rendering the first build settled an argument: the arena floor is a bright warm
 * terracotta and the fighters are bright warm too, so a burst made entirely of pale
 * cream tortilla and near-white foil had no local contrast anywhere — it read as a
 * light smudge, which is the "the arena's own static floor decal has more contrast
 * than any combat hit" complaint restated. The impact pop now alternates hard white
 * and this, so every burst carries both ends of the value range.
 */
const TORTILLA_CHAR = '#452D18';
const WRAP_BAND = '#E0562B';       // the paper wrapper band — the vivid accent
/** Peeled foil. Cool and near-white on purpose — see the header. */
const FOIL = '#D5EAF4';
const FOIL_HOT = '#FFFFFF';
const RICE = '#FFF6E4';
const BEAN = '#5B3324';
const CHEESE = '#FFC93C';
const SALSA = '#E63946';
const GUAC = '#7DA33F';
const SOUR_CREAM = '#FFFDF7';

const CH = CHARACTER_HEIGHT;
const TWO_PI = Math.PI * 2;

/**
 * Ground height for anything in this file that comes to rest.
 *
 * The ground stack is crowded and getting this wrong silently deletes the effect
 * (this project's single most repeated bug): floor pads 0.045–0.048, seams 0.062,
 * baked prop shadows 0.068–0.07, prop toe-kicks 0.08, arena hazard decals 0.15–0.25,
 * `game/vfx.ts`'s splats at 0.17, trail marks at 0.19, melee arcs / impact rings at
 * `GROUND_VFX_Y` 0.24. Several of those are opaque and depth-writing. 0.29 clears
 * every one, and matches what the other finished weapons settled on. Every
 * transparent material in this file also sets `depthWrite: false`, so Burrito never
 * becomes the next thing that silently occludes somebody else's particles.
 */
const GROUND_Y = 0.29;

/**
 * NOTE ON GROUND MARKS: this file leaves no decal, only objects coming to rest.
 *
 * `soup.ts` and `pizza.ts` both had to fight to keep their floor marks
 * distinguishable from the arena's grease/water hazard puddles (which SLOW
 * fighters), from `donut.ts`'s pink Sticky Trail discs, and from the arena's
 * permanent beige lobed floor-spill decals — every one of which is a flat organic
 * blob. Burrito never enters that fight: what it leaves behind is a RIBBON and a
 * scatter of rice, i.e. long thin slats and discrete grains, which cannot be read as
 * a puddle at any size. The ribbon settles to `GROUND_Y` and fades within a second.
 */

// ─────────────────────────────────────────────────────────────────────────────
// Scale — all anchored to the character, never to a camera framing
// ─────────────────────────────────────────────────────────────────────────────

/** The thrown burrito: a 0.63 m rolled log, 0.48 m across. Sized against what it
 * replaces (`game/vfx.ts`'s generic projectile is a 1.0 m ball) and against the
 * other conversions (Pizza's plates 0.63–0.67 m, Taco's clump 0.62 m). */
const LOG_R = CH * 0.115;   // 0.242 m radius
const LOG_L = CH * 0.30;    // 0.630 m long

/**
 * Debris sizes. `pizza.ts` established 0.13 m as the floor for "still resolves as a
 * shape rather than as a speck" at shipped framing — a character is ~10.5% of frame
 * height there, i.e. 2.10 m spans ~95 px, so one metre is ~45 px and 0.13 m is ~6 px.
 * Nothing below is smaller than that in its LONG axis; the thin axes are allowed to
 * go under it because a grain of rice and a strand of cheese are supposed to read as
 * slivers, not as blocks.
 */
const FLAKE_R = CH * 0.085;   // 0.179 m tortilla flake
const FOIL_R = CH * 0.075;    // 0.158 m foil crinkle
const RICE_L = CH * 0.090;    // 0.189 m grain length (~8.5 px)
const RICE_R = CH * 0.032;    // 0.067 m grain width
const BEAN_R = CH * 0.058;    // 0.122 m bean
const DICE_R = CH * 0.050;    // 0.105 m cube
const STRAND_L = CH * 0.10;   // 0.210 m cheese strand
const STRAND_R = CH * 0.022;  // 0.046 m

/** The wrap helix (Roll Stun's stun tell). 0.84 m radius — deliberately OUTSIDE the
 * widest head on this cast. The measured worst case is Donut, whose mass is ~1.5 m
 * across (0.75 m radius); Hamburger's bun is ~1.2 m. A wrap drawn at torso radius
 * would spend its whole life inside the silhouette, which is exactly the bug found
 * in `donut.ts`, `taco.ts` and `pizza.ts`. */
const WRAP_R = CH * 0.40;     // 0.840 m -> 1.68 m across
const WRAP_TOP = CH * 0.97;   // 2.037 m — over the head of a 2.10 m fighter

/** The unrolled ribbon's reach from its own anchor. Long, but it is a 0.23 m wide
 * strip, so it never occupies area the way a disc of the same span would. */
const RIBBON_REACH = CH * 0.70;   // 1.470 m
const RIBBON_W = CH * 0.11;       // 0.231 m wide

// ─────────────────────────────────────────────────────────────────────────────
// Module-scope geometry/material singletons. Only the cheap Object3D/Mesh WRAPPER
// is built per spawn — the same discipline as every other conversion in this
// directory; see the `spawnTransient` doc in `types.ts` for why that split matters.
// ─────────────────────────────────────────────────────────────────────────────

/** The ribbon slat, and the backing slat behind it. Unit box so `scale.set()` is a
 * size in metres: local X is LENGTH (along the ribbon), local Y is thickness, local
 * Z is width (across it). */
const slatGeo = new THREE.BoxGeometry(1, 1, 1);
/** A tortilla flake — a shallow curved tile, i.e. a torn scrap of a rolled wrap.
 * Open-ended, so `DoubleSide` on every material that uses it. */
const flakeGeo = new THREE.CylinderGeometry(0.5, 0.5, 1, 8, 1, true, -1.5, 3.0);
/** Foil crinkle: angular, faceted, deliberately NOT round. An icosahedron squashed
 * flat reads as a crumpled sheet; a tetrahedron reads as a torn corner. Two forms,
 * alternated, so a burst never shows the same flake twice. Both normalised to a unit
 * bounding box — see `riceGeo`. */
const foilGeoA = new THREE.IcosahedronGeometry(0.5, 0);
const foilGeoB = new THREE.TetrahedronGeometry(0.62, 0);
/** Rice: a capsule, because a grain of rice is a rounded rod and nothing else in
 * the roster's debris vocabulary is one. NORMALISED to a unit bounding box at module
 * scope — `CapsuleGeometry(radius, length, …)` spans `length + 2 * radius` in Y and
 * `2 * radius` in X/Z, so without this a `scale.set(w, l, w)` call would silently be
 * 3.4x too long. Every geometry in this file is authored so that `scale` is a SIZE
 * IN METRES, which is the only way the `CHARACTER_HEIGHT` fractions above mean what
 * they say. */
const riceGeo = new THREE.CapsuleGeometry(1, 1.4, 3, 6);
riceGeo.scale(0.5, 1 / 3.4, 0.5);
const beanGeo = new THREE.SphereGeometry(0.5, 8, 6);
const strandGeo = new THREE.BoxGeometry(1, 1, 1);
const bladeGeo = new THREE.ConeGeometry(0.5, 1, 4);
const diceGeo = new THREE.BoxGeometry(1, 1, 1);
/** The wrapper band on the flying log, and the spiral coil on its end cap. A torus
 * lies in XY with its axis along Z by default, which is already the plane a band
 * around a +Z-pointing log needs — so it never needs a composed rotation. */
const bandGeo = new THREE.TorusGeometry(1, 0.085, 5, 18);
const logGeo = new THREE.CylinderGeometry(1, 1, 1, 16, 1);
/** The folded tuck at each end of a rolled burrito — a short taper, which is what
 * stops the thrown body reading as a plain sausage. */
const tuckGeo = new THREE.CylinderGeometry(0.55, 1, 1, 14, 1);
/** A patch of the log's own surface: an open half-cylinder wall, used for the
 * toasted griddle side. Because it covers only half the circumference, the axial
 * spin rotates it into and out of view — which is the whole reason it is here. A
 * smooth body of revolution turning about its own axis is otherwise indistinguishable
 * from a still one (the finding `pizza.ts` records for its round dough plate). */
const patchGeo = new THREE.CylinderGeometry(1, 1, 1, 12, 1, true, -1.55, 3.1);
const capGeo = new THREE.CircleGeometry(1, 18);

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

const nextTortillaMat = materialPool(30, () => fading(TORTILLA));
const nextFillingMat = materialPool(34, () => fading(RICE));
const nextAccentMat = materialPool(6, () => fading(WRAP_BAND));
/**
 * The ribbon gets its OWN two pools, deliberately not shared with the flake/filling
 * debris above.
 *
 * A ribbon is ONE material driving eleven slats for up to 0.78 s, while a flake owns
 * its slot for 0.3 s and fades it to zero. If they shared a pool, a flake shed a
 * moment after an impact could be handed the live ribbon's slot and the two would
 * then fight over the same `opacity` every frame — the ribbon blinking out mid-
 * unroll. That is the same class of pooled-material collision that shipped in
 * `soup.ts` and `lollipop.ts`, arriving from the other direction: not "reads a stale
 * value at spawn" but "two live effects share one slot". Ten slots covers the worst
 * case (2 unrolls + 1 wrap + 2 coils live at once).
 */
const nextRibbonFaceMat = materialPool(10, () => fading(TORTILLA));
const nextRibbonBackMat = materialPool(10, () => fading(RIBBON_RIM));
/**
 * The foil pop, and it is deliberately NOT additive.
 *
 * A blind critic pinned an earlier weapon for having "zero impact punch — not one of
 * the six frames has a bright core", with the damning detail that the arena's own
 * static floor decal had more contrast than any of our combat hits. Additive pale
 * anything over this arena's bright warm terracotta does not make a core, it makes a
 * soft wash sitting in the same value band as the floor it is drawn on. Opaque,
 * hard-edged and COOL is what says an event happened here.
 */
const nextFoilMat = materialPool(24, () => fading(FOIL_HOT));

/**
 * PROJECTILE BODIES get their own materials, and nothing ever animates their opacity.
 *
 * This is not a stylistic split. In `soup.ts` the projectile bodies drew from the
 * same pools as the particles — which are handed round-robin to a stream of debris
 * that each fade THEMSELVES to zero — so a projectile in flight shared a material
 * with a particle spawned a moment later and vanished mid-flight the instant that
 * particle faded out. A Disc shedding a grain every ~0.07 s wraps a 34-slot pool in
 * about two seconds, so that would not have been a rare race here.
 */
const opaque = (color: string, extra: THREE.MeshBasicMaterialParameters = {}) =>
  new THREE.MeshBasicMaterial({ color, side: THREE.DoubleSide, ...extra });

const bodyTortillaMat = opaque(TORTILLA);
const bodyTortillaShadeMat = opaque(TORTILLA_SHADE);
const bodyToastMat = opaque(TORTILLA_TOAST);
const bodyFoilMat = opaque(FOIL);
const bodyBandMat = opaque(WRAP_BAND);
const bodyRiceMat = opaque(RICE);
const bodyBeanMat = opaque(BEAN);
const bodyCheeseMat = opaque(CHEESE);
const bodySalsaMat = opaque(SALSA);
const bodyGuacMat = opaque(GUAC);

/**
 * Topping Swarm puts FOUR pellets in the air at once, each with its own colour out of
 * `weapon.pelletColors`. One material per topping SLOT (not one shared material
 * recoloured at build time) is what stops the last pellet built from recolouring the
 * other three — the same trap `taco.ts` records for its two-part special, except here
 * there are four parts and they are always simultaneous.
 */
const bodyToppingMats = [opaque(GUAC), opaque(SALSA), opaque(CHEESE), opaque(RICE)];
const bodyToppingAccentMats = [opaque('#5C7F2A'), opaque('#B02733'), opaque('#E0A317'), opaque(SOUR_CREAM)];

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
 *   * Anything flat that must stay readable and lies in a HORIZONTAL plane (every
 *     ribbon slat on the ground, the unroll) is only ever YAWED — a single
 *     `rotation.y` on a slat whose face normal is +Y, which is exactly the safe case.
 *   * Anything flat that must follow a 3D curve (the wrap helix) is oriented by
 *     `orientBasis` below, which builds an explicit orthonormal basis and sets a
 *     QUATERNION. No Euler composition anywhere near it.
 *   * Free-tumbling DEBRIS is the one deliberate exception: a flake that is edge-on
 *     for part of its arc is what tumbling looks like.
 */
const _ax = new THREE.Vector3();
const _ay = new THREE.Vector3();
const _az = new THREE.Vector3();
const _basis = new THREE.Matrix4();

/** Orient `obj` so its local +X runs along `t` and its local +Y along `n`. Scratch
 * vectors are module-scope: this runs once per slat per frame and must not allocate. */
function orientBasis(
  obj: THREE.Object3D,
  tx: number, ty: number, tz: number,
  nx: number, ny: number, nz: number,
): void {
  _ax.set(tx, ty, tz).normalize();
  _ay.set(nx, ny, nz).normalize();
  _az.crossVectors(_ax, _ay).normalize();
  _ay.crossVectors(_az, _ax).normalize();   // re-orthogonalise
  _basis.makeBasis(_ax, _ay, _az);
  obj.quaternion.setFromRotationMatrix(_basis);
}

/** Seconds this projectile spends in the air, straight off the `REACH`/`FLIGHT_MS`
 * ladders in `rules.ts`, so spin rates authored as TURNS PER FLIGHT survive a weapon
 * changing rung. */
function flightSeconds(w: Weapon): number {
  if (w.range && w.speed) return w.range / w.speed;
  return FLIGHT_MS.normal / 1000;
}

/**
 * Which of Topping Swarm's four pellets this instance is — resolved out of
 * `rules.ts` rather than against a hardcoded hex. Returns 0 for anything else, so
 * every code path still has a valid topping.
 */
function toppingIndex(ctx: WeaponVfxCtx): number {
  const cols = ctx.weapon.pelletColors;
  if (!cols || cols.length === 0) return 0;
  const i = cols.indexOf(ctx.color);
  return i >= 0 ? i % 4 : 0;
}

/**
 * Impact scale, matched to the recipe `game/vfx.ts` re-derived for the generic burst
 * (`clamp(0.85 + damage * 0.035, ...)`), so a Burrito hit reads as the same WEIGHT of
 * event as any other weapon's at the same damage — capped at 1.35 because Burrito's
 * hardest shot is 10 and nothing here should approach the burst's 3.0 m ceiling.
 */
function impactScale(damage: number): number {
  return THREE.MathUtils.clamp(0.85 + damage * 0.035, 0.85, 1.35);
}

/** Per-projectile spin/shed state, stashed on the pooled object — Topping Swarm has
 * four in flight at once, so this cannot be module state. */
interface Spin { t: number; rate: number; shed: number; age: number; }
function spinState(obj: THREE.Object3D, w: Weapon, turnsPerFlight: number): Spin {
  let st = obj.userData.__spin as Spin | undefined;
  if (!st) {
    st = { t: Math.random() * TWO_PI, rate: (turnsPerFlight * TWO_PI) / flightSeconds(w), shed: 0, age: 0 };
    obj.userData.__spin = st;
  }
  return st;
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
  const rx = (Math.random() - 0.5) * 18;
  const ry = (Math.random() - 0.5) * 18;
  const rz = (Math.random() - 0.5) * 18;
  const r0x = mesh.rotation.x, r0y = mesh.rotation.y, r0z = mesh.rotation.z;
  ctx.spawnTransient(mesh, life, (t, e) => {
    const y = oy + vy * e + 0.5 * gravity * e * e;
    const grounded = y <= GROUND_Y;
    mesh.position.set(ox + vx * e, grounded ? GROUND_Y : y, oz + vz * e);
    if (!grounded) mesh.rotation.set(r0x + rx * e, r0y + ry * e, r0z + rz * e);
    mat.opacity = 1 - Math.pow(t, 2.4);
  });
}

/** A torn scrap of tortilla. Curved, because it came off something rolled. */
function spawnFlake(
  ctx: WeaponVfxCtx, ox: number, oy: number, oz: number,
  vx: number, vy: number, vz: number, scale: number, life: number,
): void {
  const r = FLAKE_R * scale * (0.85 + Math.random() * 0.55);
  // A quarter of the flakes are CHARRED, so a scatter of tortilla always carries some
  // dark marks. All-pale debris over a pale warm floor was the first build's failure.
  const roll = Math.random();
  spawnDebris(
    ctx, flakeGeo, nextTortillaMat(), roll < 0.24 ? TORTILLA_CHAR : roll < 0.48 ? TORTILLA_TOAST : TORTILLA,
    ox, oy, oz, vx, vy, vz, r, r * 0.85, r, life, -7.5,
  );
}

/** Foil. Bright, cool, hard-edged — the thing that actually reads over the floor. */
function spawnFoil(
  ctx: WeaponVfxCtx, ox: number, oy: number, oz: number,
  vx: number, vy: number, vz: number, scale: number, life: number,
): void {
  const r = FOIL_R * scale * (0.7 + Math.random() * 0.6);
  spawnDebris(
    ctx, Math.random() < 0.5 ? foilGeoA : foilGeoB, nextFoilMat(),
    Math.random() < 0.45 ? FOIL_HOT : FOIL,
    ox, oy, oz, vx, vy, vz, r * 1.3, r * 0.34, r, life, -8.5,
  );
}

/** One piece of spilled filling. `kind` picks the FORM as well as the colour — rice
 * capsules, round beans and long cheese strands are three silhouettes, where three
 * colours of the same shape would just be confetti. */
function spawnFilling(
  ctx: WeaponVfxCtx, kind: 'rice' | 'bean' | 'cheese' | 'salsa' | 'guac',
  ox: number, oy: number, oz: number,
  vx: number, vy: number, vz: number, scale: number, life: number,
): void {
  if (kind === 'rice') {
    spawnDebris(
      ctx, riceGeo, nextFillingMat(), RICE, ox, oy, oz, vx, vy, vz,
      RICE_R * scale, RICE_L * scale, RICE_R * scale, life,
    );
  } else if (kind === 'bean') {
    const r = BEAN_R * scale;
    spawnDebris(
      ctx, beanGeo, nextFillingMat(), BEAN, ox, oy, oz, vx, vy, vz,
      r * 1.35, r * 0.85, r * 0.85, life,
    );
  } else if (kind === 'cheese') {
    spawnDebris(
      ctx, strandGeo, nextFillingMat(), CHEESE, ox, oy, oz, vx, vy, vz,
      STRAND_L * scale, STRAND_R * scale, STRAND_R * scale, life, -6.5,
    );
  } else if (kind === 'salsa') {
    const r = BEAN_R * 0.85 * scale;
    spawnDebris(ctx, diceGeo, nextFillingMat(), SALSA, ox, oy, oz, vx, vy, vz, r, r, r, life);
  } else {
    const r = BEAN_R * scale;
    spawnDebris(ctx, diceGeo, nextFillingMat(), GUAC, ox, oy, oz, vx, vy, vz, r * 1.2, r * 0.55, r * 1.2, life);
  }
}

/**
 * THE FOIL POP — Burrito's "an event happened here" beat.
 *
 * Eight hard crinkles thrown outward from a CONTACT RING and gone in 0.14 s. Fully
 * opaque, angular, and ALTERNATING white foil and charred tortilla, so the ring
 * carries both ends of the value range. Rendering the first build (all-white) is what
 * forced that: against a bright warm floor and a bright warm fighter, a pale-only
 * burst has no local contrast and reads as a smudge.
 *
 * It is RADIAL and it lives on the OUTSIDE of the silhouette: it starts at 0.55 m
 * from the hit — already past Hamburger's 0.6 m-radius bun — and travels to 0.92 m,
 * so it can be this loud without ever covering the head and torso the player is
 * reading the fight off.
 */
function spawnFoilPop(ctx: WeaponVfxCtx, scale: number): void {
  const { x, y, z } = ctx.position;
  const d = ctx.direction;
  const base = Math.random() * TWO_PI;
  for (let i = 0; i < 8; i++) {
    const a = base + (i / 8) * TWO_PI;
    const mat = nextFoilMat();
    mat.color.set(i % 2 === 0 ? FOIL_HOT : TORTILLA_CHAR);
    mat.opacity = 1;
    const flake = new THREE.Mesh(i % 2 === 0 ? foilGeoA : foilGeoB, mat);
    flake.renderOrder = 12;
    const cos = Math.cos(a), sin = Math.sin(a);
    const r0 = CH * 0.26 * scale;
    const r1 = CH * 0.44 * scale;
    const spin = (Math.random() - 0.5) * 14;
    ctx.spawnTransient(flake, 0.14, (t) => {
      const e = 1 - Math.pow(1 - t, 2.2);
      const r = THREE.MathUtils.lerp(r0, r1, e);
      flake.position.set(x + cos * r + d.x * r * 0.28, y + e * CH * 0.05, z + sin * r + d.z * r * 0.28);
      const s = FOIL_R * scale * (1.7 - t * 0.5);
      flake.scale.set(s * 1.6, s * 0.34, s);
      flake.rotation.set(spin * t, Math.atan2(cos, sin), spin * t * 0.6);
      // Held at full for the first 45%, then cut. A flash that starts fading on
      // frame one never has a bright frame at all.
      mat.opacity = t < 0.45 ? 1 : 1 - (t - 0.45) / 0.55;
    });
  }
}

// ─────────────────────────────────────────────────────────────────────────────
// THE RIBBON — Burrito's signature primitive
// ─────────────────────────────────────────────────────────────────────────────

/** 16, not 11. The first build used 11 and rendering it showed the coil reading as a
 * polygon — 11 slats across 2.35 turns is 4.7 per turn, i.e. a visible octagon at the
 * moment the ribbon is tightest and most identifying. */
const RIBBON_SLATS = 16;

/** How many turns the coil holds when tight, and how few are left once it has
 * unrolled. The whole effect is the interpolation between these two. */
const COIL_TURNS = 2.35;
const OPEN_TURNS = 0.42;

interface Slat { face: THREE.Mesh; back: THREE.Mesh; }

/** Build the slat chain for one ribbon. Two pooled materials serve the whole
 * ribbon (every slat fades together), and BOTH are set, never read — reading a
 * pooled material's opacity gets you whatever the previous user faded it to, which
 * means every particle spawns invisible about a second into every match. */
function buildRibbon(n: number): { group: THREE.Group; slats: Slat[]; faceMat: THREE.MeshBasicMaterial; backMat: THREE.MeshBasicMaterial } {
  const group = new THREE.Group();
  const faceMat = nextRibbonFaceMat();
  const backMat = nextRibbonBackMat();
  faceMat.color.set(TORTILLA);
  faceMat.opacity = 1;
  backMat.color.set(RIBBON_RIM);
  backMat.opacity = 1;
  const slats: Slat[] = [];
  for (let i = 0; i < n; i++) {
    const back = new THREE.Mesh(slatGeo, backMat);
    back.renderOrder = 10;
    const face = new THREE.Mesh(slatGeo, faceMat);
    face.renderOrder = 11;
    // Born at zero size. `spawnTransient`'s `onUpdate` does not run until the NEXT
    // `updateEffects` tick, so anything left at its default 1x1x1 scale draws a
    // one-frame metre cube at the VFX layer's origin. Every spawner below also runs
    // its own layout once at t=0 before handing the group over, so the first frame
    // is already correct rather than merely invisible.
    back.scale.setScalar(0);
    face.scale.setScalar(0);
    group.add(back, face);
    slats.push({ face, back });
  }
  return { group, slats, faceMat, backMat };
}

/**
 * THE UNROLL — the tortilla coming undone.
 *
 * A chain of flat slats laid along an Archimedean spiral whose turn count and radius
 * are BLENDED every frame from "wound tight" to "opened out". That is what makes
 * this an unrolling rather than a growing: the slats travel along the strip as it
 * opens, so the shape itself changes. Slats sit in a horizontal plane and are only
 * ever YAWED (see the orientation rule above), which presents the full width of the
 * strip to this game's pitched top-down camera at every instant.
 *
 * It is anchored PAST the point of contact along the incoming direction, so it
 * unwinds away from the target instead of across it.
 */
function spawnUnroll(
  ctx: WeaponVfxCtx,
  cx: number, cy: number, cz: number,
  baseAngle: number, dir: number, scale: number, life: number,
): void {
  const { group, slats, faceMat, backMat } = buildRibbon(RIBBON_SLATS);
  const r0 = CH * 0.06 * scale;
  const rCoil = CH * 0.15 * scale;
  const rOpen = RIBBON_REACH * scale;
  const w = RIBBON_W * scale;

  const at = (u: number, p: number, out: { x: number; z: number }): void => {
    const thC = u * COIL_TURNS * TWO_PI * dir;
    const thO = u * OPEN_TURNS * TWO_PI * dir;
    const th = thC + (thO - thC) * p;
    const rC = r0 + u * (rCoil - r0);
    const rO = r0 + u * (rOpen - r0);
    const r = rC + (rO - rC) * p;
    out.x = cx + Math.cos(baseAngle + th) * r;
    out.z = cz + Math.sin(baseAngle + th) * r;
  };

  const a = { x: 0, z: 0 };
  const b = { x: 0, z: 0 };

  const layout = (t: number): void => {
    // Unroll over the first 62% of life, then it is lying open.
    const p = 1 - Math.pow(1 - Math.min(1, t / 0.62), 2.4);
    // Falls from impact height to the floor over the same window.
    const y = THREE.MathUtils.lerp(cy, GROUND_Y, 1 - Math.pow(1 - Math.min(1, t / 0.72), 1.8));
    for (let i = 0; i < RIBBON_SLATS; i++) {
      const u0 = i / RIBBON_SLATS;
      const u1 = (i + 1) / RIBBON_SLATS;
      at(u0, p, a);
      at(u1, p, b);
      const dx = b.x - a.x, dz = b.z - a.z;
      const len = Math.hypot(dx, dz) * 1.14;   // overlap, so the strip has no gaps at corners
      const yaw = Math.atan2(dx, dz);
      const mx = (a.x + b.x) * 0.5, mz = (a.z + b.z) * 0.5;
      // The strip narrows toward its free end, which reads as a tortilla tapering
      // where it was rolled rather than as a plank.
      const ww = w * (1 - u0 * 0.35);
      const { face, back } = slats[i];
      // Yaw ONLY, on a slat whose face normal is +Y. Its length runs along local Z
      // so a single `rotation.y` aims it down the strip — the one flat-form rotation
      // that is safe from this camera.
      face.rotation.set(0, yaw, 0);
      back.rotation.set(0, yaw, 0);
      // The dark backing is 1.8x wider, not 1.3x. Rendering the first build settled
      // that too: at 1.3x the toasted rim was 1.6 px each side at shipped framing —
      // present in the buffer, invisible on screen — and the ribbon read as a plain
      // white strip dissolving into a pale warm floor.
      face.position.set(mx, y + 0.022, mz);
      back.position.set(mx, y, mz);
      face.scale.set(ww, CH * 0.008, len);
      back.scale.set(ww * 1.8, CH * 0.006, len * 1.12);
    }
    const fade = t < 0.68 ? 1 : 1 - (t - 0.68) / 0.32;
    faceMat.opacity = fade;
    backMat.opacity = fade * 0.95;
  };

  layout(0);
  ctx.spawnTransient(group, life, layout);
}

/**
 * THE WRAP — Roll Stun's stun tell, and the inverse of the unroll.
 *
 * A tortilla ribbon WINDS UP the target: slats appear one after another along a
 * helix from ankle to over the head, then the whole thing cinches inward and fades.
 * Two things make it a wrap rather than a ring (which `donut.ts` owns): it ASCENDS,
 * and it draws on progressively instead of appearing whole.
 *
 * Its radius is 0.84 m — past the widest head on this cast (Donut's ~0.75 m) — so it
 * encircles the fighter rather than covering them, and the gaps between slats are as
 * wide as the slats. The acceptance test for every effect in this directory is that
 * the silhouette stays readable through its own hit, and a wrap is the one effect
 * here that could plausibly fail it, so it is drawn deliberately sparse.
 */
function spawnWrap(ctx: WeaponVfxCtx, scale: number, life: number): void {
  const { x, z } = ctx.position;
  // 18 slats over 2.2 turns is ~8 per turn at 88% duty, i.e. a near-continuous band.
  // The first build used 10 over 2.15 turns (4.7 per turn at 72% duty) and rendering
  // it showed the problem immediately: short disconnected chords read as a spider of
  // sticks radiating off the fighter, not as something wound around them. Continuity
  // is what makes a helix legible as a WRAP.
  const N = 22;
  const turns = 2.2;
  const R = WRAP_R * scale;
  const { group, slats, faceMat, backMat } = buildRibbon(N);
  const spin0 = Math.random() * TWO_PI;
  const y0 = GROUND_Y + CH * 0.02;
  const dy = (WRAP_TOP * scale - y0) / (N - 1);
  const dth = (turns * TWO_PI) / (N - 1);

  const layout = (t: number): void => {
    // Winds on over the first 52% of life, holds, then cinches in and fades.
    const drawn = Math.min(1, t / 0.52);
    const cinch = t < 0.62 ? 1 : 1 - (t - 0.62) / 0.38 * 0.16;
    for (let i = 0; i < N; i++) {
      const appear = (i / N) * 0.9;
      const on = drawn > appear;
      const { face, back } = slats[i];
      face.visible = on;
      back.visible = on;
      if (!on) continue;
      const th = spin0 + i * dth;
      const r = R * cinch;
      const px = x + Math.cos(th) * r;
      const py = y0 + i * dy;
      const pz = z + Math.sin(th) * r;
      // Tangent runs around AND up the helix; the face normal points radially out,
      // so the slat lies flat on the cylinder. Set with an explicit basis and a
      // quaternion — never by composing two Euler terms on a flat form.
      orientBasis(face, -Math.sin(th) * r * dth, dy, Math.cos(th) * r * dth, Math.cos(th), 0, Math.sin(th));
      back.quaternion.copy(face.quaternion);
      const len = r * dth * 1.02;   // slight overlap: a continuous band, not a dotted one
      // 0.10, not 0.15. Narrower keeps the fighter readable through the wrap — the
      // acceptance test for every effect in this directory — while the extra slats
      // above supply the continuity that makes it read as a ribbon.
      const w = CH * 0.10 * scale;
      face.position.set(px, py, pz);
      back.position.set(px - Math.cos(th) * 0.02, py, pz - Math.sin(th) * 0.02);
      face.scale.set(len, CH * 0.009, w);
      back.scale.set(len * 1.02, CH * 0.007, w * 1.75);
    }
    const fade = t < 0.62 ? 1 : 1 - (t - 0.62) / 0.38;
    faceMat.opacity = 0.88 * fade;
    backMat.opacity = 0.92 * fade;
  };

  layout(0);
  ctx.spawnTransient(group, life, layout);
}

/**
 * A tight tortilla coil — the burrito rolled up, used as a cast flourish. Same
 * spiral maths as the unroll, frozen near the coiled end and spun, so the cast and
 * the impact are visibly the same object in two different states.
 */
function spawnCoil(
  ctx: WeaponVfxCtx, cx: number, cy: number, cz: number,
  vx: number, vy: number, vz: number, scale: number, life: number,
): void {
  const { group, slats, faceMat, backMat } = buildRibbon(RIBBON_SLATS);
  const r0 = CH * 0.03 * scale;
  const rCoil = CH * 0.13 * scale;
  const dir = Math.random() < 0.5 ? 1 : -1;
  const spin = dir * (9 + Math.random() * 5);
  const a = { x: 0, z: 0 };
  const b = { x: 0, z: 0 };
  const at = (u: number, base: number, out: { x: number; z: number }): void => {
    const th = base + u * COIL_TURNS * TWO_PI * dir;
    const r = r0 + u * (rCoil - r0);
    out.x = Math.cos(th) * r;
    out.z = Math.sin(th) * r;
  };
  const layout = (t: number, e: number): void => {
    const base = spin * e;
    const gx = cx + vx * e;
    const gy = Math.max(GROUND_Y, cy + vy * e - 4.0 * e * e);
    const gz = cz + vz * e;
    for (let i = 0; i < RIBBON_SLATS; i++) {
      at(i / RIBBON_SLATS, base, a);
      at((i + 1) / RIBBON_SLATS, base, b);
      const dx = b.x - a.x, dz = b.z - a.z;
      const len = Math.hypot(dx, dz) * 1.16;
      const yaw = Math.atan2(dx, dz);
      const { face, back } = slats[i];
      face.rotation.set(0, yaw, 0);
      back.rotation.set(0, yaw, 0);
      face.position.set(gx + (a.x + b.x) * 0.5, gy + 0.018, gz + (a.z + b.z) * 0.5);
      back.position.set(gx + (a.x + b.x) * 0.5, gy, gz + (a.z + b.z) * 0.5);
      const w = RIBBON_W * scale * 0.72;
      face.scale.set(w, CH * 0.007, len);
      back.scale.set(w * 1.8, CH * 0.005, len * 1.14);
    }
    const fade = 1 - Math.pow(t, 2);
    faceMat.opacity = fade;
    backMat.opacity = fade * 0.95;
  };

  layout(0, 0);
  ctx.spawnTransient(group, life, layout);
}

// ─────────────────────────────────────────────────────────────────────────────
// Projectile builders
// ─────────────────────────────────────────────────────────────────────────────

/**
 * BURRITO DISC — he throws HIMSELF, rolled.
 *
 * A wrapped log flying point-first and spinning about its own long axis, like a
 * rifled round. That is a deliberate contrast with `pizza.ts`, whose plates fly FACE
 * UP and spin about world up like a discus: from this game's pitched camera the two
 * motions look nothing alike, which is the whole reason per-weapon VFX exist.
 *
 * The log is built along local +Z inside a `spinner` child group, because
 * `game/vfx.ts` overwrites the ROOT object's `rotation.y` every frame with its
 * face-travel default. Spinning the child about its local Z therefore composes
 * cleanly with that and can never fight it.
 */
function buildDisc(color: string): THREE.Group {
  const group = new THREE.Group();
  const spinner = new THREE.Group();
  group.add(spinner);

  bodyTortillaMat.color.set(color);

  // The rolled body. A cylinder's default axis is +Y; a single `rotation.x` aims it
  // along +Z, which is safe here because a solid cylinder has no edge-on failure
  // mode — the orientation rule is about flat forms.
  const log = new THREE.Mesh(logGeo, bodyTortillaMat);
  log.rotation.x = Math.PI / 2;
  log.scale.set(LOG_R, LOG_L * 0.80, LOG_R);
  spinner.add(log);

  // The FOLDED TUCK at the trailing end. Rendering the first build settled that this
  // is needed: a bare cylinder seen side-on at ~28 px is a rectangle, and a rectangle
  // is exactly the generic quad this whole system exists to stop drawing. Only the
  // BACK is tucked — the leading end stays open, showing the spiral, because that is
  // the face the throw points at you.
  const tuck = new THREE.Mesh(tuckGeo, bodyTortillaShadeMat);
  tuck.rotation.x = -Math.PI / 2;
  tuck.scale.set(LOG_R, LOG_L * 0.12, LOG_R);
  tuck.position.z = -LOG_L * 0.46;
  spinner.add(tuck);

  // The TOASTED SIDE: half the circumference, griddle-brown. It is the spin cue —
  // as the log turns about its axis the dark side sweeps round, which is the only
  // thing that makes an axial spin visible at all.
  const toast = new THREE.Mesh(patchGeo, bodyToastMat);
  toast.rotation.x = Math.PI / 2;
  toast.scale.set(LOG_R * 1.02, LOG_L * 0.80, LOG_R * 1.02);
  spinner.add(toast);

  // The rolled SEAM — the tortilla's overlapping edge, running diagonally down the
  // body. Placed on the surface (normal +X) and angled by a single `rotation.x`,
  // which at that position tilts it ALONG the surface rather than off it.
  const seam = new THREE.Mesh(strandGeo, bodyToastMat);
  seam.position.set(LOG_R * 0.92, 0, 0);
  seam.rotation.set(0.42, 0, 0);
  seam.scale.set(LOG_R * 0.14, LOG_R * 0.16, LOG_L * 0.82);
  spinner.add(seam);

  // The foil sleeve over the back half — cool and bright against the warm log, and
  // slightly proud of it so it reads as a separate wrapper rather than as paint.
  const foil = new THREE.Mesh(logGeo, bodyFoilMat);
  foil.rotation.x = Math.PI / 2;
  foil.scale.set(LOG_R * 1.07, LOG_L * 0.26, LOG_R * 1.07);
  foil.position.z = -LOG_L * 0.20;
  spinner.add(foil);

  // The paper wrapper band — the one vivid accent on an otherwise pale body, and the
  // thing that stops it dissolving into this arena's pale warm floor. A torus already
  // lies in the plane perpendicular to +Z, so it needs no rotation at all.
  for (const zz of [-LOG_L * 0.10, LOG_L * 0.04]) {
    const band = new THREE.Mesh(bandGeo, bodyBandMat);
    band.scale.set(LOG_R * 1.08, LOG_R * 1.08, LOG_R * 0.85);
    band.position.z = zz;
    spinner.add(band);
  }

  // The SPIRAL end cap — three concentric rings alternating tortilla and filling,
  // which is what a rolled wrap looks like end-on and the single strongest identity
  // cue the projectile has when it is flying toward or away from the camera.
  const cap = new THREE.Mesh(capGeo, bodyTortillaShadeMat);
  cap.scale.setScalar(LOG_R * 0.99);
  cap.position.z = LOG_L * 0.404;
  spinner.add(cap);
  const ringMats = [bodyToastMat, bodyRiceMat, bodyToastMat];
  for (let i = 0; i < 3; i++) {
    const ring = new THREE.Mesh(bandGeo, ringMats[i]);
    const rr = LOG_R * (0.78 - i * 0.25);
    ring.scale.set(rr, rr, LOG_R * 0.20);
    ring.position.z = LOG_L * 0.412;
    spinner.add(ring);
  }

  // Filling spilling out of the leading end, around the spiral.
  for (let i = 0; i < 4; i++) {
    const a = (i / 4) * TWO_PI + 0.5;
    const bit = new THREE.Mesh(
      i % 2 === 0 ? riceGeo : beanGeo,
      i % 2 === 0 ? bodyRiceMat : bodyBeanMat,
    );
    const s = LOG_R * 0.28;
    bit.scale.set(s, i % 2 === 0 ? s * 2 : s, s);
    bit.position.set(Math.cos(a) * LOG_R * 0.6, Math.sin(a) * LOG_R * 0.6, LOG_L * 0.42);
    bit.rotation.set(Math.random(), Math.random(), Math.random());
    spinner.add(bit);
  }

  group.userData.__spinner = spinner;
  return group;
}

/**
 * ONE TOPPING, squeezed out and chasing you.
 *
 * Four forms, one per `pelletColors` slot, all deliberately different SILHOUETTES —
 * a fan of blades, a clump of dice, a bundle of long strands, a clump of rice
 * capsules. Four colours of the same shape would just be confetti at 15 px.
 */
function buildTopping(index: number): THREE.Group {
  const group = new THREE.Group();
  const mat = bodyToppingMats[index];
  const accent = bodyToppingAccentMats[index];
  // Every topping is built to span roughly 0.36-0.42 m, i.e. ~17 px at shipped
  // framing. Smaller than the single-shot projectiles in this directory (Pizza's
  // plates 0.63-0.67 m, Taco's clump 0.62 m) because there are four of them and each
  // carries 5 damage, but comfortably above the ~6 px "resolves as a shape" floor.
  const S = CH * 0.075;

  if (index === 0) {
    // Herb / lettuce sprig: three tapered blades fanned off a stem.
    for (let i = 0; i < 3; i++) {
      const blade = new THREE.Mesh(bladeGeo, i === 1 ? accent : mat);
      blade.scale.set(S * 0.5, S * 2.6, S * 0.22);
      blade.position.set((i - 1) * S * 0.5, S * 0.4, 0);
      blade.rotation.set(0.2, 0, (i - 1) * 0.55);
      group.add(blade);
    }
    const stem = new THREE.Mesh(strandGeo, accent);
    stem.scale.set(S * 0.16, S * 1.2, S * 0.16);
    stem.position.y = -S * 0.7;
    group.add(stem);
  } else if (index === 1) {
    // Pico de gallo: a loose clump of three dice, none of them aligned.
    for (let i = 0; i < 3; i++) {
      const a = (i / 3) * TWO_PI;
      const dice = new THREE.Mesh(diceGeo, i === 2 ? accent : mat);
      const s = S * (1.0 + Math.random() * 0.35);
      dice.scale.setScalar(s);
      dice.position.set(Math.cos(a) * S * 0.75, Math.sin(a) * S * 0.5, Math.sin(a * 1.7) * S * 0.55);
      dice.rotation.set(Math.random(), Math.random(), Math.random());
      group.add(dice);
    }
  } else if (index === 2) {
    // Shredded cheese: a bundle of long thin strands, splayed.
    for (let i = 0; i < 4; i++) {
      const strand = new THREE.Mesh(strandGeo, i === 3 ? accent : mat);
      strand.scale.set(S * 2.5, STRAND_R * 1.2, STRAND_R * 1.2);
      strand.position.set(0, (i - 1.5) * S * 0.28, (i - 1.5) * S * 0.2);
      strand.rotation.set(0, (i - 1.5) * 0.28, (i - 1.5) * 0.14);
      group.add(strand);
    }
  } else {
    // Rice: a clump of capsules, each pointing its own way.
    for (let i = 0; i < 5; i++) {
      const a = (i / 5) * TWO_PI + 0.3;
      const grain = new THREE.Mesh(riceGeo, i === 4 ? accent : mat);
      grain.scale.set(RICE_R * 1.15, RICE_L * 1.15, RICE_R * 1.15);
      grain.position.set(Math.cos(a) * S * 0.55, Math.sin(a * 1.3) * S * 0.4, Math.sin(a) * S * 0.55);
      grain.rotation.set(Math.random() * 2, Math.random() * 2, Math.random() * 2);
      group.add(grain);
    }
  }
  return group;
}

// ─────────────────────────────────────────────────────────────────────────────
// Hook bodies
// ─────────────────────────────────────────────────────────────────────────────

function discTrail(ctx: WeaponVfxCtx): void {
  const obj = ctx.object;
  if (!obj) return;
  const dt = ctx.dt ?? 0;
  const st = spinState(obj, ctx.weapon, 9);
  st.t += st.rate * dt;
  const spinner = obj.userData.__spinner as THREE.Object3D | undefined;
  // Spin about the log's OWN axis (local Z inside the spinner group), leaving the
  // root's `rotation.y` for `game/vfx.ts`'s face-travel default.
  if (spinner) spinner.rotation.z = st.t;
  // A very shallow wobble on the root's pitch, so a perfectly axial spin does not
  // read as a static object sliding along a line.
  obj.rotation.x = Math.sin(st.t * 0.35) * 0.10;

  st.shed -= dt;
  if (st.shed <= 0) {
    st.shed = 0.055 + Math.random() * 0.04;
    const bx = ctx.position.x - ctx.direction.x * LOG_L * 0.5;
    const bz = ctx.position.z - ctx.direction.z * LOG_L * 0.5;
    const roll = Math.random();
    if (roll < 0.42) {
      spawnFilling(
        ctx, 'rice', bx, ctx.position.y - LOG_R * 0.3, bz,
        -ctx.direction.x * 0.6 + (Math.random() - 0.5) * 0.7, -0.15 - Math.random() * 0.4,
        -ctx.direction.z * 0.6 + (Math.random() - 0.5) * 0.7, 0.9, 0.32,
      );
    } else if (roll < 0.72) {
      spawnFlake(
        ctx, bx, ctx.position.y, bz,
        -ctx.direction.x * 0.8 + (Math.random() - 0.5) * 0.6, 0.15 + Math.random() * 0.3,
        -ctx.direction.z * 0.8 + (Math.random() - 0.5) * 0.6, 0.75, 0.30,
      );
    } else {
      spawnFoil(
        ctx, bx, ctx.position.y, bz,
        -ctx.direction.x * 0.9 + (Math.random() - 0.5) * 0.5, 0.2 + Math.random() * 0.35,
        -ctx.direction.z * 0.9 + (Math.random() - 0.5) * 0.5, 0.65, 0.26,
      );
    }
  }
}

function discImpact(ctx: WeaponVfxCtx): void {
  const s = impactScale(ctx.damage);
  const { x, y, z } = ctx.position;
  const d = ctx.direction;

  spawnFoilPop(ctx, s);

  // THE UNROLL, anchored PAST the point of contact along the incoming direction so
  // it unwinds away from the fighter instead of across it. Two ribbons, opposite
  // handedness, fanned either side of the shot line — one strip alone reads as a
  // stray object, two read as something coming apart.
  const anchor = CH * 0.16 * s;
  let px = -d.z, pz = d.x;
  if (Math.hypot(px, pz) < 1e-4) { px = 1; pz = 0; }
  const shotYaw = Math.atan2(d.z, d.x);
  for (const side of [-1, 1] as const) {
    spawnUnroll(
      ctx,
      x + d.x * anchor + px * side * anchor * 0.7,
      y,
      z + d.z * anchor + pz * side * anchor * 0.7,
      shotYaw + side * 1.05, side, s * 0.92, 0.78,
    );
  }

  // Everything below launches from a CONTACT RING already clear of the target rather
  // than from the exact point of contact.
  //
  // MEASURED, not guessed, and this is the bug that shipped in `donut.ts`,
  // `taco.ts` AND `pizza.ts`: the widest part of a fighter on this cast is its HEAD
  // (Hamburger's bun is ~1.2 m across, Donut's mass ~1.5 m), so debris launched from
  // dead centre at a plausible speed spends over half its life inside a silhouette
  // that a pitched top-down camera hides completely. Pizza's Cheese Blind sheet
  // spawned entirely inside the head and drew literally zero pixels.
  const R0 = CH * 0.26 * s;
  const bias = 0.8;
  for (let i = 0; i < 9; i++) {
    const a = (i / 9) * TWO_PI + Math.random() * 0.6;
    const out = (2.3 + Math.random() * 1.5) * s;
    const roll = Math.random();
    // Beans are weighted up from the first build: they are the only DARK piece of
    // filling and on screen they were the debris that actually read.
    spawnFilling(
      ctx, roll < 0.32 ? 'rice' : roll < 0.66 ? 'bean' : roll < 0.85 ? 'cheese' : 'salsa',
      x + Math.cos(a) * R0, y, z + Math.sin(a) * R0,
      Math.cos(a) * out + d.x * bias, 1.9 + Math.random() * 1.3, Math.sin(a) * out + d.z * bias,
      s, 0.42 + Math.random() * 0.14,
    );
  }
  for (let i = 0; i < 6; i++) {
    const a = (i / 6) * TWO_PI + Math.random() * 0.9;
    const out = (2.4 + Math.random() * 1.6) * s;
    spawnFlake(
      ctx, x + Math.cos(a) * R0, y, z + Math.sin(a) * R0,
      Math.cos(a) * out + d.x * bias, 1.8 + Math.random() * 1.4, Math.sin(a) * out + d.z * bias,
      (0.9 + Math.random() * 0.5) * s, 0.44 + Math.random() * 0.12,
    );
  }
  for (let i = 0; i < 4; i++) {
    const a = Math.random() * TWO_PI;
    const out = (2.7 + Math.random() * 1.8) * s;
    spawnFoil(
      ctx, x + Math.cos(a) * R0 * 0.9, y, z + Math.sin(a) * R0 * 0.9,
      Math.cos(a) * out + d.x * bias, 1.6 + Math.random() * 1.6, Math.sin(a) * out + d.z * bias,
      (0.8 + Math.random() * 0.6) * s, 0.36 + Math.random() * 0.12,
    );
  }
}

/**
 * The throw. He tips the roll forward and the wrapper gives: a coil spinning off
 * ahead of him plus a spray of grain and foil. No pale circular flash — that shared
 * muzzle pop is exactly what this system exists to replace.
 */
function throwCast(ctx: WeaponVfxCtx, mult: number): void {
  const d = ctx.direction;
  const { x, y, z } = ctx.position;

  spawnCoil(
    ctx, x, y, z,
    d.x * 2.2 + (Math.random() - 0.5) * 0.4, 0.7, d.z * 2.2 + (Math.random() - 0.5) * 0.4,
    mult, 0.26,
  );

  for (let i = 0; i < 5; i++) {
    spawnFilling(
      ctx, i % 2 === 0 ? 'rice' : 'bean', x, y, z,
      d.x * (1.5 + Math.random() * 1.0) + (Math.random() - 0.5) * 0.9, 0.7 + Math.random() * 0.6,
      d.z * (1.5 + Math.random() * 1.0) + (Math.random() - 0.5) * 0.9,
      0.9 * mult, 0.30,
    );
  }
  for (let i = 0; i < 4; i++) {
    spawnFoil(
      ctx, x, y, z,
      d.x * (1.7 + Math.random() * 1.2) + (Math.random() - 0.5) * 0.8, 0.8 + Math.random() * 0.6,
      d.z * (1.7 + Math.random() * 1.2) + (Math.random() - 0.5) * 0.8,
      0.8 * mult, 0.24,
    );
  }
  for (let i = 0; i < 3; i++) {
    spawnFlake(
      ctx, x, y, z,
      d.x * (1.3 + Math.random() * 0.9) + (Math.random() - 0.5) * 0.7, 0.6 + Math.random() * 0.5,
      d.z * (1.3 + Math.random() * 0.9) + (Math.random() - 0.5) * 0.7,
      0.8 * mult, 0.26,
    );
  }
}

// ─────────────────────────────────────────────────────────────────────────────
// Topping Swarm — THE WIND-UP
//
// 🚨 DORMANT TODAY, BY A MEASURED DECISION IN `rules.ts`. `edadf78` ("five specials,
// five REFUSALS") priced every remaining ultimate's wind-up and shipped none of them,
// so `waterbottle.Mega` is still the only weapon with a `castMs` — and
// `game/vfx.ts:spawnCastTelegraph` returns immediately without one, so this hook is
// never called. That is not an oversight to fix by adding a `castMs`: read the refusal
// blocks in `rules.ts` first. The draw below is ready, measured at the shipped match
// pitch of 58 (`tools/tmp/tg_tele.mjs`, driven at 1100 ms through the QA path), and
// costs nothing until a wind-up is ever justified for this weapon.
//
// Built to `vfx/weapons/waterbottle.ts`'s `Mega` template (read its header first):
// one root, one `onUpdate`, TIMES as fractions of `ctx.castMs`, SIZES as fractions of
// `CHARACTER_HEIGHT`.
//
// ⚠️ `buildTopping` spans 0.36-0.42 m by design — "~17 px at shipped framing", sized
// for a pellet in flight. Four of those held still for a whole wind-up is the 36-px
// invisible-sculpt failure this project has on record. The swarm below therefore
// scales them up to `TELE_TOPPING_GROW` while they gather and drops them back to 1.0
// nowhere: the things being squeezed out are BIGGER than the things that fly, which
// is also what "squeezes out ALL his toppings" has to look like to be worth 3.6 s.
// ─────────────────────────────────────────────────────────────────────────────

/**
 * Full-charge multiplier on a topping's authored (flight) size: 0.4 m -> ~1.45 m.
 *
 * ⚠️ 2.7 first, ON A GESTURE WHOSE BULGE WAS DOING THE WORK. When the bulge was cut
 * back from the wash it rendered as (see `bs` in `telegraph()`), the four toppings
 * were left carrying the read alone and the bespoke half fell to **701 px, under
 * floor for 7 of 12 slices** — from 1,614 px that had been almost entirely blob. The
 * cut was right and it exposed that the toppings had never been the read at all.
 * They are now the largest thing in the gesture, which is what the card describes.
 */
const TELE_TOPPING_GROW = 3.6;
/** The bulge at the open end the toppings are squeezed out of — a soft mass, not a
 * flash, so it holds area for the whole cast rather than peaking and dying. */
const teleBulgeGeo = new THREE.SphereGeometry(1, 14, 10);
/** Dedicated pools. One gesture uses 1 bulge + 1 shell + 4 wisps, so both pools are
 * >= their simultaneous users — `waterbottle.ts` records the round-robin collision
 * that silently emptied its own bottles when two element classes shared one pool. */
const nextTeleBulgeMat = materialPool(4, () => fading(WRAP_BAND, { opacity: 0.85 }));
const nextTeleShellMat = materialPool(4, () => fading(TORTILLA, { opacity: 0.7 }));

/**
 * 🚨 NAME THE CHILDREN, NOT JUST THE GROUP. `buildTopping` returns a `Group` whose
 * meshes are unnamed — fine for a projectile, wrong for anything a diagnostic has to
 * address. Every tool here keys on `name`, and `tools/tmp/tg_tele.mjs` keys on
 * `isMesh && name.startsWith(...)`: measured, the first run of this telegraph reported
 * **`bs2`** (the bulge and the shell) for a gesture also holding four whole toppings,
 * and Sushi's equivalent reported **`bs0`** while painting 10,633 px.
 *
 * ⚠️ Deliberately duplicated per character file rather than shared. The shared surface
 * is `./types.ts`, which is not this file's to grow, and `docs/LESSONS.md` §5's
 * warning is about a copied DRIVER — a stale copy that silently produces wrong
 * numbers. This is four lines with no behaviour to go stale; the alternative is a
 * cross-file dependency between two agents' owned sets.
 */
function nameParts(root: THREE.Object3D, prefix: string): void {
  let i = 0;
  root.traverse((c) => {
    if ((c as THREE.Mesh).isMesh && !c.name) c.name = `${prefix}Part${i++}`;
  });
}

export const burritoWeaponVfx: CharacterWeaponVfxMap = {
  // ── Burrito Disc ───────────────────────────────────────────────────────────
  // He throws himself: a wrapped log flying point-first, spinning about its own
  // axis and shedding grain and foil the whole way there. On impact the wrap comes
  // undone — two tortilla ribbons unroll out of the hit and settle on the floor.
  Disc: {
    projectile(ctx) {
      const obj = buildDisc(ctx.color);
      obj.position.copy(ctx.position);
      return obj;
    },
    trail(ctx) { discTrail(ctx); },
    impact(ctx) { discImpact(ctx); },
    cast(ctx) { throwCast(ctx, 1); },
  },

  // ── Roll Stun (melee, `effect: 'stun'`) ────────────────────────────────────
  // The inverse of the Disc. He rolls in, and the target ends up WRAPPED: a ribbon
  // winds up them ankle to head, then cinches. It is the only effect in the roster
  // that encircles a fighter rather than bursting off one, which is what makes the
  // stun legible as a stun rather than as a small hit.
  Roll: {
    impact(ctx) {
      const s = impactScale(ctx.damage);
      spawnWrap(ctx, 1, 0.62);
      spawnFoilPop(ctx, s * 0.85);
      const { x, y, z } = ctx.position;
      const d = ctx.direction;
      const R0 = CH * 0.24 * s;
      for (let i = 0; i < 5; i++) {
        const a = (i / 5) * TWO_PI + Math.random() * 0.8;
        const out = (2.0 + Math.random() * 1.3) * s;
        spawnFilling(
          ctx, i % 2 === 0 ? 'rice' : 'guac',
          x + Math.cos(a) * R0, y, z + Math.sin(a) * R0,
          Math.cos(a) * out + d.x * 0.6, 1.7 + Math.random() * 1.1, Math.sin(a) * out + d.z * 0.6,
          s, 0.38 + Math.random() * 0.12,
        );
      }
      for (let i = 0; i < 3; i++) {
        const a = Math.random() * TWO_PI;
        const out = (2.2 + Math.random() * 1.4) * s;
        spawnFlake(
          ctx, x + Math.cos(a) * R0, y, z + Math.sin(a) * R0,
          Math.cos(a) * out + d.x * 0.6, 1.6 + Math.random() * 1.2, Math.sin(a) * out + d.z * 0.6,
          0.85 * s, 0.4,
        );
      }
    },
    // He rolls up and drives forward: two coils tumbling out along the swing, plus
    // the crumbs that come off a wrap being squeezed. `game/vfx.ts` still draws its
    // generic melee arc alongside this, which is the sweep; this is the tortilla.
    cast(ctx) {
      const d = ctx.direction;
      const { x, y, z } = ctx.position;
      for (const side of [-0.5, 0.5]) {
        spawnCoil(
          ctx, x - d.z * side * CH * 0.12, y, z + d.x * side * CH * 0.12,
          d.x * 2.6 - d.z * side * 1.2, 0.5, d.z * 2.6 + d.x * side * 1.2,
          0.9, 0.3,
        );
      }
      for (let i = 0; i < 5; i++) {
        spawnFlake(
          ctx, x, y, z,
          d.x * (1.6 + Math.random() * 1.1) + (Math.random() - 0.5) * 1.0, 0.6 + Math.random() * 0.6,
          d.z * (1.6 + Math.random() * 1.1) + (Math.random() - 0.5) * 1.0,
          0.85, 0.28,
        );
      }
      for (let i = 0; i < 3; i++) {
        spawnFoil(
          ctx, x, y, z,
          d.x * (1.8 + Math.random() * 1.0) + (Math.random() - 0.5) * 0.9, 0.7 + Math.random() * 0.5,
          d.z * (1.8 + Math.random() * 1.0) + (Math.random() - 0.5) * 0.9,
          0.75, 0.24,
        );
      }
    },
  },

  // ── Topping Swarm (special) ────────────────────────────────────────────────
  // Four homing pellets, one per `pelletColors` entry, each a physically different
  // topping. `toppingIndex` reads `rules.ts` to decide which, so this one entry
  // draws four completely different projectiles and four differently-coloured hits.
  Swarm: {
    projectile(ctx) {
      const obj = buildTopping(toppingIndex(ctx));
      obj.position.copy(ctx.position);
      return obj;
    },
    trail(ctx) {
      const obj = ctx.object;
      if (!obj) return;
      const dt = ctx.dt ?? 0;
      const st = spinState(obj, ctx.weapon, 2.4);
      st.t += st.rate * dt;
      st.age += dt;
      // A WEAVE. These toppings are alive — `homing: true` already curves their
      // path, and a lateral sway on top of it is what sells "chasing you" rather
      // than "drifting toward you". It is a purely visual offset applied after
      // `game/vfx.ts` has written the true sim position, so it never moves the hit.
      const w = Math.sin(st.age * 7.5 + st.t) * CH * 0.085;
      obj.position.x += -ctx.direction.z * w;
      obj.position.z += ctx.direction.x * w;
      obj.position.y += Math.sin(st.age * 5.2) * CH * 0.03;
      obj.rotation.x = st.t * 0.8;
      obj.rotation.z = Math.sin(st.t * 0.7) * 0.7;

      st.shed -= dt;
      if (st.shed <= 0) {
        st.shed = 0.14 + Math.random() * 0.08;
        const mat = nextFillingMat();
        mat.color.set(ctx.color);
        mat.opacity = 1;
        const bit = new THREE.Mesh(diceGeo, mat);
        bit.renderOrder = 9;
        const bx = obj.position.x, by = obj.position.y, bz = obj.position.z;
        const r = CH * 0.030;
        bit.position.set(bx, by, bz);
        bit.scale.setScalar(r);
        ctx.spawnTransient(bit, 0.26, (t, e) => {
          bit.position.set(bx, by - 0.5 * e * e, bz);
          bit.scale.setScalar(r * (1 - t * 0.6));
          mat.opacity = 1 - t;
        });
      }
    },
    // 5 damage from one of four pellets — deliberately the smallest hit in the file.
    // It still carries the tortilla and foil signature so it reads as Burrito's.
    impact(ctx) {
      const s = impactScale(ctx.damage) * 0.8;
      const { x, y, z } = ctx.position;
      const d = ctx.direction;
      spawnFoilPop(ctx, s * 0.7);
      const R0 = CH * 0.22 * s;
      for (let i = 0; i < 5; i++) {
        const a = (i / 5) * TWO_PI + Math.random() * 0.8;
        const out = (2.1 + Math.random() * 1.2) * s;
        const mat = nextFillingMat();
        mat.color.set(ctx.color);
        mat.opacity = 1;
        const bit = new THREE.Mesh(diceGeo, mat);
        bit.renderOrder = 9;
        const ox = x + Math.cos(a) * R0, oz = z + Math.sin(a) * R0;
        const vx = Math.cos(a) * out + d.x * 0.6;
        const vz = Math.sin(a) * out + d.z * 0.6;
        const vy = 1.6 + Math.random() * 1.1;
        const r = DICE_R * s;
        bit.scale.setScalar(r);
        bit.rotation.set(Math.random() * 3, Math.random() * 3, Math.random() * 3);
        ctx.spawnTransient(bit, 0.36, (t, e) => {
          const yy = y + vy * e - 4.5 * e * e;
          bit.position.set(ox + vx * e, Math.max(GROUND_Y, yy), oz + vz * e);
          mat.opacity = 1 - Math.pow(t, 2.2);
        });
      }
      for (let i = 0; i < 3; i++) {
        const a = Math.random() * TWO_PI;
        const out = (2.2 + Math.random() * 1.3) * s;
        spawnFlake(
          ctx, x + Math.cos(a) * R0, y, z + Math.sin(a) * R0,
          Math.cos(a) * out + d.x * 0.5, 1.5 + Math.random() * 1.2, Math.sin(a) * out + d.z * 0.5,
          0.7 * s, 0.34,
        );
      }
    },
    // THE SQUEEZE: he compresses himself and every topping comes out at once, in a
    // wide fan matching the weapon's own 55° spread. The wrapper band whips forward
    // ahead of them.
    cast(ctx) {
      const d = ctx.direction;
      const { x, y, z } = ctx.position;
      const half = ((ctx.weapon.spreadDeg ?? 40) * Math.PI) / 360;
      const kinds = ['guac', 'salsa', 'cheese', 'rice'] as const;
      for (let i = 0; i < 12; i++) {
        const off = (Math.random() * 2 - 1) * half;
        const c = Math.cos(off), sn = Math.sin(off);
        const fx = d.x * c - d.z * sn, fz = d.x * sn + d.z * c;
        const sp = 1.8 + Math.random() * 1.4;
        spawnFilling(
          ctx, kinds[i % 4], x, y, z,
          fx * sp, 0.8 + Math.random() * 0.7, fz * sp, 0.95, 0.34,
        );
      }
      // The paper wrapper band, whipping forward. A short flat strip, yaw-only.
      const mat = nextAccentMat();
      mat.color.set(WRAP_BAND);
      mat.opacity = 1;
      const band = new THREE.Mesh(slatGeo, mat);
      band.renderOrder = 11;
      const yaw = Math.atan2(d.x, d.z);
      ctx.spawnTransient(band, 0.2, (t) => {
        const e = 1 - Math.pow(1 - t, 2);
        band.position.set(x + d.x * e * CH * 0.30, y + e * CH * 0.05, z + d.z * e * CH * 0.30);
        band.rotation.set(0, yaw + e * 0.8, 0);
        band.scale.set(CH * 0.20 * (1 + e * 0.5), CH * 0.01, CH * 0.05);
        mat.opacity = 1 - t * t;
      });
      for (let i = 0; i < 4; i++) {
        spawnFoil(
          ctx, x, y, z,
          d.x * (1.6 + Math.random() * 1.1) + (Math.random() - 0.5) * 1.1, 0.8 + Math.random() * 0.6,
          d.z * (1.6 + Math.random() * 1.1) + (Math.random() - 0.5) * 1.1,
          0.8, 0.26,
        );
      }
    },

    /**
     * TOPPING SWARM — the card, drawn: *"squeezes out all his toppings, which fly
     * everywhere and chase enemies"*. The squeeze is the wind-up; the flying
     * everywhere is `cast()` above, which the sim now emits at the RESOLVE.
     *
     * ── The beats, as fractions of `castMs` ───────────────────────────────────
     *
     *     0.00 - 0.40   SQUEEZE   a bulge swells at the open end and the wrap
     *                             compresses around it
     *     0.18 - 0.85   EMERGE    the four toppings push out one after another —
     *                             staggered, because four leaving together reads as
     *                             one expanding disc, which is the generic effect
     *                             this replaces — orbiting wider and faster
     *     0.85 - 1.00   FAN       they snap onto the weapon's real 55° spread, at
     *                             the angles the pellets will actually leave on
     *
     * Overlapping on purpose: `tools/tmp/tg_tele.mjs` reports the MINIMUM 100 ms
     * slice of the cast, not the peak, so a seam between beats is a measured fault.
     *
     * ⚠️ The fan comes from `ctx.weapon.spreadDeg`, never from a literal. A wind-up
     * that shows a different spread from the one `rules.ts` fires is lying about
     * where the shot goes, and *"a telegraph you can dodge"* is the whole point.
     */
    telegraph(ctx) {
      const T = ctx.THREE;
      const castSec = Math.max(0.2, (ctx.castMs ?? 1100) / 1000);

      const root = new T.Group();
      root.name = 'teleBurritoRoot';
      const feet = ctx.position.clone();
      feet.y -= CH * 0.55; // `ctx.position` arrives at muzzle height
      root.position.copy(feet);
      // Local +Z is his facing, so every offset below is "ahead / across".
      root.rotation.y = Math.atan2(ctx.direction.x, ctx.direction.z);

      const bulgeMat = nextTeleBulgeMat();
      const bulge = new T.Mesh(teleBulgeGeo, bulgeMat);
      bulge.name = 'teleBurritoBulge';
      root.add(bulge);

      const shellMat = nextTeleShellMat();
      const shell = new T.Mesh(teleBulgeGeo, shellMat);
      shell.name = 'teleBurritoShell';
      root.add(shell);

      const N = 4;
      const toppings: THREE.Group[] = [];
      for (let i = 0; i < N; i++) {
        const g = buildTopping(i);
        g.name = `teleBurritoTopping${i}`;
        nameParts(g, `teleBurritoTopping${i}`);
        toppings.push(g);
        root.add(g);
      }

      const beat = (t: number, a: number, b: number): number => {
        const k = T.MathUtils.clamp((t - a) / (b - a), 0, 1);
        return k * k * (3 - 2 * k);
      };

      /** Where the squeeze happens: chest height, just ahead of him. Everything stays
       * inside roughly one character height — at 58° vertical distance becomes screen
       * distance fast, and `waterbottle.ts` records a beat that strayed further
       * reading as unrelated objects floating over the arena. */
      const VENT_Y = CH * 0.78;
      const VENT_Z = CH * 0.22;
      const half = ((ctx.weapon.spreadDeg ?? 55) * Math.PI) / 360;

      const drive = (_p: number, elapsed: number): void => {
        const t = T.MathUtils.clamp(elapsed / castSec, 0, 1);
        const squeeze = beat(t, 0.0, 0.40);
        const fan = beat(t, 0.85, 1.0);

        // ── 1. SQUEEZE ───────────────────────────────────────────────────────
        // Never starts at zero area: a first slice worth a handful of pixels is the
        // invisible-sculpt failure wearing a good peak.
        // 🚨 JUDGED ON THE RENDERED PNG, AND IT WAS A WASH.
        //
        // At `0.22 + 0.28 * squeeze` this sphere reached 1.05 m of RADIUS — 2.1 m
        // across, i.e. the whole fighter — in the wrapper's saturated orange, sitting
        // over his head and torso. The frame showed one flat orange blob with the
        // character and all four toppings buried inside it. Every number was green:
        // 17,354 px of sustain, 1,614 px of bespoke, ablation and hide both clean.
        // The numbers were measuring the wash.
        //
        // That is `game/vfx.ts`'s own recorded failure mode ("information-free wash
        // that erases the arena the player is trying to read", 262,797 px / 73.0%) at
        // character scale, and this file's `Roll` block already states the budget it
        // breaks: the character keeps its silhouette. The bulge is a CUE at the open
        // end now — 0.21 -> 0.48 m of radius — and the read is carried by the four
        // toppings, which is what the card is about.
        const bs = CH * (0.13 + 0.15 * squeeze) * (1 - 0.35 * fan);
        bulge.position.set(0, VENT_Y, VENT_Z);
        bulge.scale.set(bs, bs * (0.82 + 0.25 * Math.sin(t * 11)), bs);
        bulgeMat.opacity = (0.55 + 0.40 * squeeze) * (1 - fan * 0.8);
        // The wrap compressing around it — a second, paler mass a touch behind, so
        // the bulge has something to be squeezed OUT of. Same size cut as the bulge
        // above and for the same reason: at 0.71 m of radius in near-white tortilla
        // this was the second half of the blob that erased him.
        const ss = CH * (0.17 - 0.05 * squeeze);
        shell.position.set(0, VENT_Y - CH * 0.04, VENT_Z - CH * 0.16);
        shell.scale.set(ss, ss * (1.25 - 0.30 * squeeze), ss);
        shellMat.opacity = 0.62 * (1 - fan * 0.9);

        // ── 2. EMERGE + 3. FAN ───────────────────────────────────────────────
        for (let i = 0; i < N; i++) {
          const g = toppings[i];
          // Each topping lags the one before it, so they leave as a stream.
          const lag = i * 0.09;
          const out = beat(t, 0.18 + lag, 0.85);
          // The angle it will actually be fired on: evenly spaced across the real
          // spread, exactly as `sim.ts` fans `pellets`.
          // `N` is fixed at 4 here — `buildTopping` has exactly four authored forms,
          // one per `pelletColors` slot — so unlike sushi's telegraph this does not
          // need an N=1 guard on the divisor.
          const target = (i / (N - 1) - 0.5) * 2 * half;
          // Orbiting while it gathers, then converging on that angle.
          const spin = (i / N) * TWO_PI + t * (3.2 + 2.4 * out);
          const ang = T.MathUtils.lerp(spin, target, fan);
          // ⚠️ `0.10 + ...` PUT ALL FOUR TOPPINGS INSIDE THE BULGE AT t=0, so the
          // opening frames were the bulge alone and the toppings only emerged from
          // inside a shape that was already covering them. They orbit CLEAR of his
          // silhouette from the first slice now: 0.88 m out, widening to 1.5 m.
          const radius = CH * (0.42 + 0.34 * out + 0.26 * fan);
          g.position.set(
            Math.sin(ang) * radius,
            VENT_Y + Math.sin(spin * 1.6) * CH * 0.10 * (1 - fan) + CH * 0.10 * out,
            VENT_Z + Math.cos(ang) * radius * (0.55 + 0.45 * fan),
          );
          // 1.9 left the OPENING slice at 1,461 px — 39 under the floor, on the one
          // frame a player sees first. Area is quadratic in this number, so 2.2 is
          // a 34% lift on it and nothing else in the gesture had to move.
          const grow = 2.2 + (TELE_TOPPING_GROW - 2.2) * out;
          g.scale.setScalar(grow);
          // A tumble on all three axes — these are irregular clumps, and a
          // single-axis spin on a near-symmetric form changes nothing on screen.
          g.rotation.set(t * 4.2 + i, t * 3.0 - i, t * 2.4);
        }
      };

      // Posed before it is handed to the layer — see `waterbottle.ts`: the meshes are
      // built at their authoring transform, and whether the first `updateEffects`
      // tick beats the first `render` is a `match.ts` call-order detail.
      drive(0, 0);
      ctx.spawnTransient(root, castSec + 0.06, drive);
    },
  },
};
