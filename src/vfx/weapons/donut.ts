/**
 * Donut weapon VFX — the cast's RING character.
 *
 * ── Donut's identity: ROUND, HOLED, GLAZED, SPRINKLED ────────────────────────
 * Every other converted weapon in this directory is built out of a shape that is
 * solid in the middle: `hamburger.ts` throws a round blob, `waterbottle.ts` throws
 * faceted slivers, `pizza.ts` throws flat plates, `soup.ts` throws a mass of liquid.
 * Donut is the only weapon in the roster whose form has a HOLE in it, so the hole is
 * the whole design: the projectile is a glazed ring flying face-up so its hole is
 * presented to the camera at every instant of flight, it leaves a chain of fading
 * ring echoes behind it, and it breaks into CURVED ARC fragments — never straight
 * shards, never round blobs.
 *
 * Weapon keys (`game/rules.ts` -> `CHARACTERS.donut.weapons`):
 *   `'Candy'`  Candy Barrage — `rangedLong`, 3 pellets at 14° spread, `trailBoosted`
 *
 * ── THE THREE DECISIONS THIS FILE IS BUILT AROUND ────────────────────────────
 *
 * 1. **The ring flies FACE UP, spun about world +Y by an explicit quaternion.**
 *    A ring tumbling about its travel axis spends half of every revolution edge-on,
 *    where it stops being a ring and becomes a short bar — i.e. the one feature that
 *    identifies the weapon strobes in and out for the whole flight. So the ring is
 *    thrown like a quoit and only ever BANKS (≤0.21 rad).
 *
 *    That rotation is applied as a quaternion and never as `rotation.x` + `.y`:
 *    Euler angles are intrinsic and sequential, so composing them tips a flat form
 *    edge-on and it vanishes from this game's pitched top-down camera. A torus is
 *    less fragile than a plate (it still has thickness edge-on) but the read is the
 *    same failure, one step milder.
 *
 * 2. **Sprinkles are what make the spin legible.** A torus spun about its own
 *    symmetry axis is geometrically identical at every angle — a perfectly smooth
 *    ring "spinning" is indistinguishable from a stationary one. Five sprinkles
 *    sitting proud of the glaze break that symmetry, exactly the job `pizza.ts`'s
 *    off-centre flour patch does for its round dough plate. They are also the single
 *    most recognisable thing about a donut, so they double as the identity carrier
 *    on the impact scatter.
 *
 * 3. **The ground element is an expanding ANNULUS, never a filled disc.** This is a
 *    readability constraint, not a style choice. Donut is the one character in the
 *    roster with `hasTrail: true`, and `game/vfx.ts` paints her Sticky Trail as
 *    filled pink discs (`#FF9EC4` at 0.6 opacity, `trailMats.player`) at y = 0.19 —
 *    a persistent gameplay object that speeds her up and hurts enemies. A pink
 *    filled splat dropped by her own weapon would read as more of that trail, which
 *    is a gameplay lie. The arena also carries permanent beige lobed floor-spill
 *    decals in the organic-blob grammar every combat mark competes with. A thin
 *    bright ring that expands and is gone in a third of a second cannot be mistaken
 *    for either: terrain does not move, and terrain is not a hollow circle.
 *
 * ── Scale discipline ─────────────────────────────────────────────────────────
 * Every size is a fraction of `CHARACTER_HEIGHT`, never a bare metre literal, so
 * this survives the next camera move. The generic impact burst (`game/vfx.ts`) is
 * 1.74 m typical / 3.0 m hard cap against a 2.10 m character, and at Candy Barrage's
 * 4 damage its own recipe would produce a 1.29 m ground mark. THREE pellets land
 * within a few frames of each other, so nothing here is allowed to be a solid mass:
 * the largest thing one pellet draws is a 1.68 m hoop, which is wider than the
 * generic mark and yet covers a fraction of its area, because it is HOLLOW. That
 * trade — wide enough to clear the silhouette, hollow enough not to hide it — is the
 * whole reason this weapon can be built out of rings. The fighter staying readable
 * through its own hit is the acceptance test, not "does it look powerful".
 */

import * as THREE from 'three';
import { FLIGHT_MS, type Weapon } from '../../game/rules';
import { CHARACTER_HEIGHT } from '../../units';
import type { CharacterWeaponVfxMap, WeaponVfxCtx } from './types';

// ─────────────────────────────────────────────────────────────────────────────
// Palette — mirrors the module-private consts in `src/characters/donut.ts` so the
// thrown candy matches the fighter throwing it. (They are `const`, not exported, so
// this is a deliberate copy; the values are the contract.)
// ─────────────────────────────────────────────────────────────────────────────

/** Deep berry — the backing ring that outlines every glazed form in this file. Warm
 * and dark rather than black: the art direction has almost no ink outline, so this
 * is a readability device on a small fast-moving object (a pale pink ring on this
 * arena's pale warm floor dissolves without it), not a style. */
const GLAZE_DEEP = '#C93F73';
/** `DOUGH` from `src/characters/donut.ts` — the fried body under the glaze. */
const DOUGH = '#F0C070';
/** Near-white sugar. The ONE element of this effect that is not competing inside the
 * pink-on-terracotta hue stack — see the `#FF9EC4` Sticky Trail note above — so it
 * is what carries the impact's first frame and the ground ring. */
const SUGAR = '#FFF0F6';
/** The ring echoes shed in flight. Sugar tinted just far enough toward the glaze to
 * read as icing rather than as a smoke ring — the trail is Donut's, not a generic
 * puff, and neutral white wisps are already the arena's ambient dust vocabulary. */
const GLAZE_ECHO = '#FFD9EC';
/** `SPRINKLE_COLORS` from `src/characters/donut.ts`. Authored as wanted, NOT
 * pre-compensated: the grade reproduces hue within ~4° and destroys channels below
 * ~10/255, and the darkest channel here is 0x1E. */
const SPRINKLES = ['#E63946', '#7CB518', '#FFC93C', '#7C4DFF', '#2E86D8', '#FFFFFF'];

const CH = CHARACTER_HEIGHT;
const TWO_PI = Math.PI * 2;

/**
 * Ground height for this file's flat rings.
 *
 * The ground stack is crowded and getting this wrong silently deletes the effect
 * (this project's single most repeated bug): floor pads 0.045–0.048, seams 0.062,
 * baked prop shadows 0.068–0.07, prop toe-kicks 0.08, arena hazard decals 0.15–0.25,
 * `game/vfx.ts`'s splats at 0.17, its trail marks — Donut's OWN Sticky Trail — at
 * 0.19, and its melee arcs / impact rings at `GROUND_VFX_Y` 0.24. Several of those
 * are opaque and depth-writing. 0.28 clears every one. Every material in this file
 * also sets `depthWrite: false`, so Donut never becomes the next thing that occludes
 * somebody else's particles.
 */
const GROUND_Y = 0.28;

// ─────────────────────────────────────────────────────────────────────────────
// Scale — all anchored to the character, never to a camera framing
// ─────────────────────────────────────────────────────────────────────────────

/** Torus centreline radius and tube radius. Outer radius is `R + TUBE` = 0.28 m, so
 * the ring is 0.56 m across with a 0.20 m hole. MEASURED against what it replaces:
 * `game/vfx.ts`'s generic projectile is `SphereGeometry(wu(10))`, a 1.0 m ball, and
 * against the other converted weapons (Pizza's plates 0.63–0.67 m, Soup's 3-pellet
 * gout 0.50 m). Candy Barrage is a 3-pellet weapon, so it sits with Soup's spread
 * rather than with the single-shot throws — but not smaller, because the HOLE has to
 * survive: at shipped framing (a 2.10 m fighter ≈ 10.5% of frame height) 0.56 m is
 * ~25 px with a ~9 px hole, which reads. Much under this and it is a pink bead. */
const RING_R = CH * 0.09;      // 0.189 m
const RING_TUBE = CH * 0.043;  // 0.090 m

/** Sprinkle — a stubby capsule, the smallest thing in this file that still resolves
 * as a SHAPE rather than a sub-pixel speck at shipped framing. */
const SPRINKLE_R = CH * 0.014; // 0.029 m radius
const SPRINKLE_L = CH * 0.042; // 0.088 m long -> ~0.15 m end to end

/**
 * Impact ring sizes — MEASURED against the fighter, not guessed.
 *
 * The first build sized these to clear a TORSO (the widest archetype, STOUT, is
 * 0.82 m across) and rendered it: at 1.26 m across, a horizontal ring centred on a
 * hit is almost entirely buried inside the target, because on this cast the widest
 * part of a fighter is its HEAD — Hamburger's bun is ~1.2 m and Donut's own glazed
 * mass is ~1.5 m. Only two thin slivers of ring reached the screen, at the left and
 * right extremes. That is this project's most repeated bug (an effect that renders
 * and is invisible) in the same form that cost `pizza.ts` its cheese sheet: a shape
 * sized against the wrong part of the rig.
 *
 * A ring has to CLEAR the silhouette to read as a ring at all — a hoop the same
 * width as the thing it surrounds is a pair of slivers. 1.58/1.68 m across does
 * that, and is still under the generic burst's 1.74 m typical mark. Being hollow it
 * covers almost none of the area it spans, which is exactly why this shape can
 * afford to be the widest element in the file.
 */
const HALO_R = CH * 0.375; // 0.79 m radius -> 1.58 m across, at hit height
const SHOCK_R = CH * 0.40; // 0.84 m radius -> 1.68 m across, on the floor

// ─────────────────────────────────────────────────────────────────────────────
// Module-scope geometry/material singletons. Only the cheap Object3D/Mesh WRAPPER
// is built per spawn — the same discipline as `hamburger.ts` / `waterbottle.ts` /
// `soup.ts` / `pizza.ts`; see the `spawnTransient` doc in `types.ts` for why that
// split matters.
// ─────────────────────────────────────────────────────────────────────────────

/** A torus lying FLAT in the XZ plane with its axis along world +Y. The lay-flat
 * rotation is baked into the BUFFER once, at module scope, which is what makes
 * decision (1) safe: with the flatten already in the geometry, a world-up quaternion
 * spins the ring in its own horizontal plane and cannot ever tip it. */
function flatTorus(r: number, tube: number, radial: number, tubular: number, arc?: number): THREE.BufferGeometry {
  const geo = new THREE.TorusGeometry(r, tube, radial, tubular, arc);
  geo.rotateX(-Math.PI / 2);
  return geo;
}

/**
 * The candy is drawn as THREE stacked tori, because one flat-coloured torus renders
 * as a pink washer, not as food. Rendering the first build settled it: a single
 * `#FF6FA5` ring reads as a hard plastic hoop. A DOUGH body with a GLAZE cap sitting
 * proud of it — the exact construction of the character's own head — reads as a
 * glazed ring at a glance, and the gold rim doubles as the value break that keeps a
 * saturated pink from dissolving into this arena's warm floor.
 *
 *   `ringBackGeo`  fattest, deep berry, sunk slightly    -> a dark rim inside AND out
 *   `ringGeo`      dough body                            -> the gold outer rim
 *   `ringGlazeGeo` thinner tube, raised                   -> the glaze cap, weapon colour
 */
const ringGeo = flatTorus(RING_R, RING_TUBE, 8, 22);
const ringGlazeGeo = flatTorus(RING_R, RING_TUBE * 0.82, 8, 22);
const ringBackGeo = flatTorus(RING_R, RING_TUBE * 1.30, 8, 22);
/** Curved arc fragments — a broken ring breaks into ARCS. No other weapon in the
 * directory throws curved debris (Water Bottle throws straight slivers, Pizza flat
 * triangles, Hamburger round chunks), so this alone identifies the hit. Three arc
 * lengths so a burst never shows the same fragment twice. */
const arcGeos = [
  flatTorus(RING_R * 0.92, RING_TUBE * 0.86, 6, 8, 1.5),
  flatTorus(RING_R * 1.05, RING_TUBE * 0.72, 6, 8, 1.0),
  flatTorus(RING_R * 0.80, RING_TUBE * 0.95, 6, 7, 2.1),
];
let arcCursor = 0;
const nextArcGeo = (): THREE.BufferGeometry => arcGeos[arcCursor++ % arcGeos.length];

const sprinkleGeo = new THREE.CapsuleGeometry(SPRINKLE_R, SPRINKLE_L, 3, 6);

/** Unit-OUTER-radius flat annuli, so `scale.set(r, 1, r)` means "this ring is `r`
 * metres in radius" — directly comparable to the generic burst's star decal, which
 * also peaks at exactly its stated radius. Two band widths: a thin one for the
 * airborne echoes and halo, a fatter one for the ground shock so it still reads as a
 * band and not a hairline at 1.2 m across. */
function flatRing(inner: number, seg = 40): THREE.BufferGeometry {
  const geo = new THREE.RingGeometry(inner, 1, seg, 1);
  geo.rotateX(-Math.PI / 2);
  return geo;
}
const thinRingGeo = flatRing(0.84);
const bandRingGeo = flatRing(0.70);

/** Small fixed pool of material instances, cycled round-robin — the same helper (and
 * the same reasoning) as every other converted weapon: simultaneous elements that
 * fade independently each need their OWN `opacity`, so they need their own
 * `Material`, and a pool avoids allocating one per spawn.
 *
 * EVERY transparent material here sets `depthWrite: false`. A `transparent: true`
 * material still writes depth by three.js default, and that has silently deleted VFX
 * in this project more than once. */
function materialPool<T extends THREE.Material>(size: number, build: () => T): () => T {
  const pool = Array.from({ length: size }, build);
  let i = 0;
  return () => pool[i++ % size];
}

const fading = (color: string, opacity: number, extra: THREE.MeshBasicMaterialParameters = {}) =>
  new THREE.MeshBasicMaterial({ color, transparent: true, opacity, depthWrite: false, side: THREE.DoubleSide, ...extra });

/**
 * PROJECTILE BODIES get their own pools, and nothing ever animates their opacity.
 *
 * This is not a stylistic split. In `soup.ts` the projectile bodies used to draw
 * from the same pools as the particles — which are handed round-robin to a stream of
 * debris that each fade THEMSELVES to zero — so a projectile in flight shared a
 * material with a particle spawned a moment later and vanished mid-flight the
 * instant that particle faded out. Three pellets shedding a sprinkle every ~0.075 s
 * wrap a small pool in well under a second, so this would not have been a rare race
 * here either.
 */
const bodyGlazeMat = new THREE.MeshBasicMaterial({ color: '#FF6FA5' });
const bodyDoughMat = new THREE.MeshBasicMaterial({ color: DOUGH });
const bodyBackMat = new THREE.MeshBasicMaterial({ color: GLAZE_DEEP });
const bodySprinkleMats = SPRINKLES.map((c) => new THREE.MeshBasicMaterial({ color: c }));

const nextArcMat = materialPool(18, () => fading(GLAZE_DEEP, 1));
const nextGlazeMat = materialPool(18, () => fading('#FF6FA5', 1));
const nextSprinkleMat = materialPool(30, () => fading('#FFFFFF', 1));
const nextRingMat = materialPool(24, () => fading(SUGAR, 0.7));
/** The additive element: the ring echoes shed behind the projectile in flight.
 * Additive because they are LIGHT (sugar catching the key), not matter.
 *
 * The IMPACT halo used to be additive too, and a blind critic pinned the whole
 * effect for having "zero impact punch — not one frame has a bright core", with the
 * damning detail that the arena's own static floor decal had more contrast than the
 * hit. Additive white over this arena's bright warm floor does not produce a bright
 * core, it produces a soft wash sitting in the same value band as the terracotta it
 * is drawn on. Every element that has to say AN EVENT HAPPENED HERE is now opaque
 * and hard-edged (`nextHardMat`); additive is reserved for things that are meant to
 * be faint. */
const nextGlowMat = materialPool(20, () => fading(SUGAR, 0.7, { blending: THREE.AdditiveBlending }));
/** Hard, near-opaque, normal-blended — the contact rings. Sized for the WORST CASE,
 * which is a full 3-pellet volley landing together: 4 hard rings per pellet plus the
 * cast's 2 is 14 live at once, and two rings sharing one material would fight over
 * its `opacity` every frame. */
const nextHardMat = materialPool(24, () => fading(SUGAR, 1));

// ─────────────────────────────────────────────────────────────────────────────
// Flat-spin helpers — explicit quaternions, module-scope scratch objects so a
// per-frame `trail()` allocates nothing.
// ─────────────────────────────────────────────────────────────────────────────

const UP = new THREE.Vector3(0, 1, 0);
const _axis = new THREE.Vector3();
const _qSpin = new THREE.Quaternion();
const _qBank = new THREE.Quaternion();

/**
 * Spin a flat ring `spin` radians about WORLD UP, then bank it `bank` radians about
 * the horizontal axis perpendicular to travel.
 *
 * Composed as `qBank * qSpin` — spin applied first in the ring's own horizontal
 * plane, then the whole plane tipped. This is the ONLY composition that keeps the
 * hole facing the camera; `rotation.x` then `rotation.y` instead gives intrinsic
 * sequential Euler rotation, where the second angle turns the ALREADY-TIPPED ring
 * and swings it edge-on. Keep `bank` shallow.
 */
function orientRing(obj: THREE.Object3D, dirX: number, dirZ: number, spin: number, bank: number): void {
  _qSpin.setFromAxisAngle(UP, spin);
  const len = Math.hypot(dirX, dirZ);
  if (Math.abs(bank) > 1e-4 && len > 1e-4) {
    _axis.set(dirZ / len, 0, -dirX / len);
    _qBank.setFromAxisAngle(_axis, bank);
    obj.quaternion.copy(_qBank).multiply(_qSpin);
  } else {
    obj.quaternion.copy(_qSpin);
  }
}

/** Seconds this projectile spends in the air, straight off the `REACH`/`FLIGHT_MS`
 * ladders in `rules.ts` — the spin rate below is authored as REVOLUTIONS PER FLIGHT
 * so that if Candy Barrage ever changes rung it keeps the same read instead of
 * suddenly spinning for twice as long. */
function flightSeconds(w: Weapon): number {
  if (w.range && w.speed) return w.range / w.speed;
  return FLIGHT_MS.normal / 1000;
}

/** Per-projectile spin state, stashed on the pooled object — three pellets of the
 * same weapon are in flight at once, so this cannot be module state. */
interface RingState { spin: number; rate: number; shed: number; echo: number; }

function ringState(obj: THREE.Object3D, w: Weapon, revsPerFlight: number): RingState {
  let st = obj.userData.__ring as RingState | undefined;
  if (!st) {
    st = {
      spin: Math.random() * TWO_PI,
      rate: (revsPerFlight * TWO_PI) / flightSeconds(w),
      shed: 0,
      echo: 0,
    };
    obj.userData.__ring = st;
  }
  return st;
}

// ─────────────────────────────────────────────────────────────────────────────
// Spawn helpers
// ─────────────────────────────────────────────────────────────────────────────

/**
 * A flat ring drawn in the horizontal plane, growing from `r0` to `r1` and fading.
 *
 * `startOpacity` is always SET here and never read off the pooled material — the
 * previous user of that slot faded it to ~0 and left it there, so reading it as a
 * starting value means that once the pool wraps (about a second of firing) every
 * ring in the game spawns already invisible. Rings are Donut's entire vocabulary, so
 * that one line would quietly delete the weapon's identity a second into every
 * match. It is a bug this project has actually shipped; see `soup.ts`'s
 * `spawnDroplet`.
 */
function spawnRing(
  ctx: WeaponVfxCtx,
  x: number, y: number, z: number,
  r0: number, r1: number,
  color: string, startOpacity: number, life: number,
  opts: { glow?: boolean; hard?: boolean; band?: boolean; fadePow?: number; renderOrder?: number; hold?: number } = {},
): void {
  const mat = opts.hard ? nextHardMat() : opts.glow ? nextGlowMat() : nextRingMat();
  mat.color.set(color);
  mat.opacity = startOpacity;
  const ring = new THREE.Mesh(opts.band ? bandRingGeo : thinRingGeo, mat);
  ring.renderOrder = opts.renderOrder ?? 9;
  ring.position.set(x, y, z);
  ring.rotation.y = Math.random() * TWO_PI; // flat XZ geometry: yaw alone, never a tipped plane
  ring.scale.set(r0, 1, r0);
  const pow = opts.fadePow ?? 1;
  const hold = opts.hold ?? 0;
  ctx.spawnTransient(ring, life, (t) => {
    const r = THREE.MathUtils.lerp(r0, r1, 1 - Math.pow(1 - t, 2.4));
    ring.scale.set(r, 1, r);
    // `hold` keeps the ring at FULL strength for its first fraction, then drops it
    // hard. A ring that starts fading on frame one never has a bright frame at all,
    // which is precisely what a blind critic measured as "no impact punch".
    mat.opacity = t < hold ? startOpacity : startOpacity * (1 - Math.pow((t - hold) / (1 - hold), pow));
  });
}

/** One sprinkle on a ballistic arc, tumbling end over end. Multi-coloured hard
 * confetti is the loudest "DONUT" signal available and nothing else in the roster
 * scatters in six colours at once. */
function spawnSprinkle(
  ctx: WeaponVfxCtx,
  ox: number, oy: number, oz: number,
  vx: number, vy: number, vz: number,
  life: number, scale = 1,
): void {
  const mat = nextSprinkleMat();
  mat.color.set(SPRINKLES[(Math.random() * SPRINKLES.length) | 0]);
  mat.opacity = 1;                       // SET, never read — see `spawnRing`.
  const mesh = new THREE.Mesh(sprinkleGeo, mat);
  mesh.renderOrder = 9;
  mesh.position.set(ox, oy, oz);
  mesh.scale.setScalar(scale);
  const spinX = (Math.random() - 0.5) * 26;
  const spinZ = (Math.random() - 0.5) * 26;
  const gravity = -9;
  ctx.spawnTransient(mesh, life, (t, e) => {
    mesh.position.set(
      ox + vx * e,
      Math.max(GROUND_Y, oy + vy * e + 0.5 * gravity * e * e),
      oz + vz * e,
    );
    mesh.rotation.set(spinX * e, 0, spinZ * e);
    mat.opacity = 1 - Math.pow(t, 2.4);
  });
}

/** A curved fragment of the broken ring, flung outward and tumbling in 3D. Unlike
 * `pizza.ts`'s chips — which stay flat because a fragment of a plate is still a
 * plate — a piece of a torus is a solid curved body, so it tumbles freely: that
 * difference in MOTION is as much of the identification as the silhouette is. */
function spawnArc(
  ctx: WeaponVfxCtx,
  origin: THREE.Vector3,
  color: string,
  ang: number, speed: number, scale: number, life: number,
): void {
  const group = new THREE.Group();
  const backMat = nextArcMat();
  backMat.color.set(GLAZE_DEEP);
  backMat.opacity = 1;
  const geo = nextArcGeo();
  const back = new THREE.Mesh(geo, backMat);
  back.scale.setScalar(1.28);
  group.add(back);
  const faceMat = nextGlazeMat();
  faceMat.color.set(color);
  faceMat.opacity = 1;
  group.add(new THREE.Mesh(geo, faceMat));
  group.renderOrder = 9;
  group.position.copy(origin);
  group.scale.setScalar(scale);

  const ox = origin.x, oy = origin.y, oz = origin.z;
  const vx = Math.cos(ang) * speed;
  const vz = Math.sin(ang) * speed;
  const vy = 1.5 + Math.random() * 1.2;
  const gravity = -8.5;
  const sx = (Math.random() - 0.5) * 20;
  const sy = (Math.random() - 0.5) * 20;
  ctx.spawnTransient(group, life, (t, e) => {
    group.position.set(
      ox + vx * e,
      Math.max(GROUND_Y, oy + vy * e + 0.5 * gravity * e * e),
      oz + vz * e,
    );
    group.rotation.set(sx * e, 0, sy * e);
    const fade = 1 - Math.pow(t, 2.2);
    faceMat.opacity = fade;
    backMat.opacity = fade;
  });
}

/**
 * Impact scale, matched to the recipe `game/vfx.ts` re-derived for the generic burst
 * (`clamp(0.85 + damage * 0.035, ...)`), so a Candy hit reads as the same WEIGHT of
 * event — capped much lower because three pellets land together and Candy Barrage is
 * the lowest-damage weapon in the roster after Sushi's rice.
 */
function impactScale(damage: number): number {
  return THREE.MathUtils.clamp(0.85 + damage * 0.035, 0.85, 1.25);
}

/** The candy ring itself: dark backing torus, glaze torus on top, four sprinkles
 * proud of the glaze. Built fresh per projectile (three are in flight at once). */
function buildCandyRing(color: string): THREE.Group {
  const group = new THREE.Group();

  const back = new THREE.Mesh(ringBackGeo, bodyBackMat);
  back.position.y = -CH * 0.007;
  group.add(back);

  group.add(new THREE.Mesh(ringGeo, bodyDoughMat));

  bodyGlazeMat.color.set(color);
  const glaze = new THREE.Mesh(ringGlazeGeo, bodyGlazeMat);
  glaze.position.y = RING_TUBE * 0.36;
  group.add(glaze);

  // Five sprinkles, unevenly spaced so no rotational symmetry survives — see
  // decision (2). Laid tangentially around the glaze crown, which is where they sit
  // on the real character's head.
  const base = Math.random() * TWO_PI;
  for (let i = 0; i < 5; i++) {
    const a = base + (i / 5) * TWO_PI + (Math.random() - 0.5) * 0.6;
    const s = new THREE.Mesh(sprinkleGeo, bodySprinkleMats[(Math.random() * bodySprinkleMats.length) | 0]);
    s.position.set(Math.cos(a) * RING_R, RING_TUBE * 1.05, Math.sin(a) * RING_R);
    // Lie the capsule down tangentially: its axis is local +Y, so tip it 90° and
    // then yaw it. Applied as a quaternion for the reason in `orientRing`.
    s.quaternion.setFromAxisAngle(UP, -a);
    s.rotateX(Math.PI / 2);
    s.scale.setScalar(1.05);
    group.add(s);
  }
  group.userData.__isCandyRing = true;
  return group;
}

export const donutWeaponVfx: CharacterWeaponVfxMap = {
  // ── Candy Barrage ──────────────────────────────────────────────────────────
  // Three glazed candy rings fanned at 14°, each spinning face-up and dragging a
  // chain of sugar-ring echoes behind it. `trailBoosted` means the same shot can
  // arrive at 4 or 6 damage; `impactScale` reads `ctx.damage`, so a boosted hit is
  // visibly (slightly) heavier without any extra branching.
  Candy: {
    projectile(ctx) {
      const obj = buildCandyRing(ctx.color);
      obj.position.copy(ctx.position);
      return obj;
    },

    trail(ctx) {
      const obj = ctx.object;
      if (!obj) return;
      const dt = ctx.dt ?? 0;
      const st = ringState(obj, ctx.weapon, 2.4);
      st.spin += st.rate * dt;
      // Shallow oscillating bank — enough to read as a thrown object rather than a
      // decal sliding across the screen, nowhere near enough to go edge-on.
      orientRing(obj, ctx.direction.x, ctx.direction.z, st.spin, 0.13 + Math.sin(st.spin * 0.41) * 0.08);
      obj.position.y += Math.sin(st.spin * 0.62) * CH * 0.011;

      // The ring echo: a hoop of sugar left hanging in the air where the ring just
      // was, expanding slightly as it fades. A chain of these behind the projectile
      // is a trail language nothing else in the roster has — Pizza sheds a sweep
      // arc, Soup sheds drips, Water Bottle glints — and it reinforces the one
      // shape this weapon is about.
      st.echo -= dt;
      if (st.echo <= 0) {
        st.echo = 0.075;
        const outer = RING_R + RING_TUBE;
        spawnRing(
          ctx,
          ctx.position.x, ctx.position.y, ctx.position.z,
          outer, outer * 1.45,
          GLAZE_ECHO, 0.55, 0.2,
          { glow: true, fadePow: 1.4 },
        );
      }

      st.shed -= dt;
      if (st.shed <= 0) {
        st.shed = 0.085 + Math.random() * 0.05;
        spawnSprinkle(
          ctx,
          ctx.position.x - ctx.direction.x * RING_R, ctx.position.y, ctx.position.z - ctx.direction.z * RING_R,
          -ctx.direction.x * 0.6 + (Math.random() - 0.5) * 0.6, 0.15 + Math.random() * 0.35,
          -ctx.direction.z * 0.6 + (Math.random() - 0.5) * 0.6,
          0.34, 0.85,
        );
      }
    },

    // The ring SNAPS. Two hoops open outward — one at the hit, one on the floor —
    // the ring breaks into curved arcs, and the sprinkles go everywhere. No sparks,
    // no shards, no round bloom: three of the four elements are literally rings and
    // the fourth is confetti.
    impact(ctx) {
      const s = impactScale(ctx.damage);
      const { x, y, z } = ctx.position;

      // 1. The halo — a HARD, near-opaque bright hoop snapping outward around the
      // target at hit height. Three properties, each one a fix for something a blind
      // critic measured:
      //   * OPAQUE and normal-blended, not additive. Additive white over a bright
      //     warm floor is a wash, not a core, and the hit read as having no punch.
      //   * HELD at full strength for its first 45%, so there IS a bright frame.
      //   * THIN (`thinRingGeo`, inner 0.84) and started at 0.80 of its peak, so the
      //     band lives just OUTSIDE the head — a fighter's identity on this cast is
      //     in its head and torso, and an opaque bar drawn concentrically across
      //     that band erases the character even while its silhouette survives.
      // A hollow hoop is the only shape that can be this bright at this size without
      // hiding the thing it is giving feedback about.
      spawnRing(ctx, x, y, z, HALO_R * 0.80 * s, HALO_R * s, '#FFF6FA', 1, 0.16,
        { hard: true, renderOrder: 12, fadePow: 1.1, hold: 0.45 });
      // A candy-pink hoop just inside it — the two-tone hard edge, and the colour
      // that says whose hit this was.
      spawnRing(ctx, x, y, z, HALO_R * 0.62 * s, HALO_R * 0.86 * s, ctx.color, 1, 0.19,
        { hard: true, renderOrder: 11, fadePow: 1.4, hold: 0.3 });

      // 2. The floor shock — two concentric hoops, NOT a filled disc (decision (3),
      // the Sticky Trail this character paints under herself). Two-tone on purpose:
      // the leading edge is candy pink, the body behind it near-white sugar. Donut's
      // own trail discs are `#FF9EC4` at 0.6 opacity, so a pink-only mark would be
      // competing inside the exact hue it must not be confused with; the pale band
      // is the value break that settles it, and it is the same "author the one
      // element that is not in the scene's hue stack" call `soup.ts` and `pizza.ts`
      // both arrived at independently.
      spawnRing(ctx, x, GROUND_Y, z, SHOCK_R * 0.20 * s, SHOCK_R * s, ctx.color, 0.95, 0.3,
        { hard: true, renderOrder: 7, fadePow: 1.6, hold: 0.35 });
      spawnRing(ctx, x, GROUND_Y - 0.01, z, SHOCK_R * 0.16 * s, SHOCK_R * 0.86 * s, SUGAR, 0.9, 0.34,
        { hard: true, band: true, renderOrder: 6, fadePow: 1.4, hold: 0.3 });

      // 3. The broken ring — curved arcs, thrown hard enough to CLEAR THE BODY.
      // (At 1.3 m/s over 0.38 s debris travels ~0.5 m and spends its whole life
      // inside the fighter's own silhouette, where a pitched top-down camera hides
      // it completely — present and unreadable, this project's most repeated failure
      // in its subtlest form.) Fewer and BIGGER than the first build: at ~0.3 m a
      // fragment is ~13 px on screen and its curvature — the entire reason it is an
      // arc and not a chip — is undetectable. Biased along `ctx.direction`, the
      // attacker→hit vector, so fragments carry through the way real debris does.
      for (let i = 0; i < 3; i++) {
        const ang = (i / 3) * TWO_PI + Math.random() * 0.9;
        spawnArc(
          ctx, ctx.position, ctx.color,
          ang, (2.3 + Math.random() * 1.5) * s,
          (1.05 + Math.random() * 0.5) * s, 0.36 + Math.random() * 0.12,
        );
      }

      // 4. The sprinkles.
      for (let i = 0; i < 8; i++) {
        const ang = Math.random() * TWO_PI;
        const out = (2.2 + Math.random() * 1.8) * s;
        spawnSprinkle(
          ctx,
          x, y, z,
          Math.cos(ang) * out + ctx.direction.x * 0.9,
          2.5 + Math.random() * 1.6,
          Math.sin(ang) * out + ctx.direction.z * 0.9,
          0.4 + Math.random() * 0.14,
          1.1 + Math.random() * 0.6,
        );
      }
    },

    // A ring snapping open at the muzzle as the barrage leaves her hands, plus a few
    // sprinkles flicked down the throw line. Flat and hollow — the same outline the
    // projectile has, which is what makes a cast cue read as belonging to its weapon
    // rather than being the shared pale circular flash every weapon used to get.
    cast(ctx) {
      spawnRing(
        ctx, ctx.position.x, ctx.position.y, ctx.position.z,
        CH * 0.06, CH * 0.20, '#FFF6FA', 1, 0.16,
        { hard: true, renderOrder: 12, hold: 0.3 },
      );
      spawnRing(
        ctx, ctx.position.x, ctx.position.y, ctx.position.z,
        CH * 0.03, CH * 0.13, ctx.color, 0.95, 0.13,
        { hard: true, band: true, renderOrder: 11, hold: 0.25 },
      );
      for (let i = 0; i < 4; i++) {
        spawnSprinkle(
          ctx,
          ctx.position.x, ctx.position.y, ctx.position.z,
          ctx.direction.x * (1.2 + Math.random() * 0.8) + (Math.random() - 0.5) * 0.7,
          0.7 + Math.random() * 0.6,
          ctx.direction.z * (1.2 + Math.random() * 0.8) + (Math.random() - 0.5) * 0.7,
          0.3, 0.85,
        );
      }
    },
  },
};
