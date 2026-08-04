/**
 * Taco weapon VFX — the cast's CRUMBLING character.
 *
 * ── Taco's identity: A BRITTLE SHELL FULL OF LOOSE CONTENTS ──────────────────
 * Every other converted weapon throws ONE substance. `hamburger.ts` throws a fruit,
 * `waterbottle.ts` throws glass, `pizza.ts` throws plates, `soup.ts` throws liquid,
 * `donut.ts` throws rings. Taco is the only weapon in the roster whose ammunition is
 * a CONTAINER AND ITS CONTENTS, and that split is the whole design:
 *
 *   * The SHELL is brittle. It appears as curved gold tiles — sections of a cylinder
 *     wall, so every fragment is visibly a piece of something that used to be a
 *     curve — plus a fall of fine crumbs. Curved-tile debris and crumbs are Taco's
 *     signature and appear in EVERY hit this file produces, which is what makes
 *     three quite different weapons read as the same fighter's.
 *   * The FILLING is loose. It is never one mass: it is meat lumps, curled lettuce
 *     shreds and diced tomato, four or five distinguishable little forms that come
 *     apart in flight and go everywhere on impact. Nothing here holds together.
 *
 * That is deliberately the opposite of `pizza.ts`'s hard geometric plates and of
 * `donut.ts`'s single clean ring: Taco's whole read is that it is FALLING APART.
 *
 * Weapon keys (`game/rules.ts` -> `CHARACTERS.taco.weapons`), all converted below:
 *   `'Filling'` Filling Toss — `rangedLong`, 12 dmg   → a clump that sheds as it flies
 *   `'Onion'`   Onion Bomb   — `rangedMid`,   7 dmg   → layers that peel, and vapour
 *   `'Double'`  Double Toss  — `rangedLong`, special  → both at once, see below
 *
 * ── Double Toss fires as TWO shots, and this file tells them apart from rules ──
 * `combat.ts` spawns one projectile per `comboParts` entry, each carrying that
 * part's own `color` and `damage` but all under the weapon key `'Double'`. So a
 * single `WeaponVfx` entry has to serve both halves. It resolves which half it is by
 * looking the instance up IN `ctx.weapon.comboParts` (`comboIndex` below) rather than
 * by hardcoding a hex string — if the combo's colours or damages are re-tuned in
 * `rules.ts`, this keeps working.
 *
 * ── Scale discipline ─────────────────────────────────────────────────────────
 * Every size is a fraction of `CHARACTER_HEIGHT`, never a bare metre literal, so
 * this survives the next camera move the way the generic burst had to be re-derived.
 * `game/vfx.ts`'s generic impact burst is 1.74 m typical / 3.0 m hard cap against a
 * 2.10 m character. Nothing here draws a single element over 1.4 m; the weight comes
 * from COUNT and from motion, not from any one piece being large, which is also what
 * keeps the fighter readable through its own hit — the acceptance test.
 */

import * as THREE from 'three';
import { FLIGHT_MS, type Weapon } from '../../game/rules';
import { CHARACTER_HEIGHT } from '../../units';
import type { CharacterWeaponVfxMap, WeaponVfxCtx } from './types';

// ─────────────────────────────────────────────────────────────────────────────
// Palette — mirrors the module-private consts in `src/characters/taco.ts` so the
// thrown food matches the fighter throwing it. (They are `const`, not exported, so
// this is a deliberate copy; the values are the contract.) Authored as wanted and
// NOT pre-compensated: the grade reproduces hue within ~4° and only destroys
// channels below ~10/255.
// ─────────────────────────────────────────────────────────────────────────────

const SHELL = '#F2A73E';        // toasted hard-shell gold
const SHELL_DARK = '#B96F16';   // the shaded inside of a curved fragment
const CRUMB = '#E9C078';        // fine broken shell
const MEAT_DARK = '#4E2C1B';    // `PALETTE.pattyDark`
const TOMATO = '#E63946';
const LETTUCE = '#8FCB1E';
const ONION_PALE = '#EFE2FA';   // the papery outer skin
const ONION_MID = '#C9A9E4';
/** The acrid vapour that comes off a cut onion. Violet-white and LOW in value
 * contrast on purpose — it is the one element here allowed to sit over the target,
 * so it must never be dense enough to hide it. */
const VAPOUR = '#CDB0EE';

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
 * every one. Every transparent material in this file also sets `depthWrite: false`,
 * so Taco never becomes the next thing that occludes somebody else's particles.
 */
const GROUND_Y = 0.29;

/**
 * NOTE ON GROUND MARKS: this file deliberately leaves NONE.
 *
 * `soup.ts` and `pizza.ts` both had to fight for their floor marks to be
 * distinguishable from the arena's terrain hazards (grease and water puddles, which
 * SLOW fighters) and from its permanent beige lobed floor-spill decals — all drawn
 * in the same flat organic-blob grammar. Taco has no need to enter that fight: what
 * a broken taco leaves behind is DISCRETE DEBRIS, and a scatter of individually
 * readable crumbs and shreds that fade in under a second can never be mistaken for a
 * puddle. So Taco's ground presence is the debris itself coming to rest, not a decal.
 */

// ─────────────────────────────────────────────────────────────────────────────
// Scale — all anchored to the character, never to a camera framing
// ─────────────────────────────────────────────────────────────────────────────

/** Shell fragment: a curved tile ~0.27 m across. MEASURED against `pizza.ts`'s
 * 0.22 m chip, which was the smallest debris on the project judged to still read as
 * a SHAPE at shipped framing — a curve needs slightly more span than a triangle to
 * show that it is a curve at all, which is the entire reason this shape is here. */
const SHARD_R = CH * 0.085;   // 0.179 m tile radius
const SHARD_H = CH * 0.105;   // 0.220 m tall

/** Fine crumb — sized to `pizza.ts`'s 0.13 m mote, the established floor for "still
 * resolves as something rather than as a speck". */
const CRUMB_R = CH * 0.032;   // 0.067 m -> ~0.13 m across

/** Filling clump: a 0.44 m meat core, so the whole loose clump spans ~0.62 m with
 * its bits attached. Sized against what it replaces (`game/vfx.ts`'s generic
 * projectile is a 1.0 m ball) and against the other conversions (Pizza's plates
 * 0.63–0.67 m, Soup's gout 0.50 m). Filling Toss is Taco's heavy single shot, so it
 * sits at the top of that band. */
const MEAT_R = CH * 0.105;    // 0.221 m radius -> a 0.44 m core, ~0.62 m clump
const LETTUCE_R = CH * 0.07;  // curled shred ~0.28 m across
const DICE_R = CH * 0.036;    // 0.076 m cube

/** Onion Bomb: a smaller, denser object than the filling clump — 7 damage against
 * 12, and a bulb is compact where a handful of filling is not. */
const ONION_R = CH * 0.125;   // 0.26 m radius -> 0.52 m across

/** The peeling layers at impact. The largest single element Taco draws, and still
 * under the generic burst's 1.74 m typical mark. */
const PEEL_R = CH * 0.33;     // 0.69 m radius -> 1.39 m across

// ─────────────────────────────────────────────────────────────────────────────
// Module-scope geometry/material singletons. Only the cheap Object3D/Mesh WRAPPER
// is built per spawn — the same discipline as every other conversion in this
// directory; see the `spawnTransient` doc in `types.ts` for why that split matters.
// ─────────────────────────────────────────────────────────────────────────────

/**
 * A CURVED TILE — a section of a cylinder wall, open-ended, spanning `arc` radians
 * and centred on its own middle so it tumbles about its centre of mass rather than
 * pivoting round a corner. Unit radius and unit height, so `scale.set(r, h, r)` is a
 * size in metres.
 *
 * This one primitive is Taco's entire shape vocabulary: shell shards, the big shell
 * halves that split at the moment of impact, the lettuce shreds, and the sweep the
 * cast draws are all this geometry at different proportions. `DoubleSide` on every
 * material that uses it, because an open wall seen from behind is a hole otherwise —
 * and half of a tumbling fragment's life IS from behind.
 */
function shellTile(arc: number, seg = 7): THREE.BufferGeometry {
  return new THREE.CylinderGeometry(1, 1, 1, seg, 1, true, -arc / 2, arc);
}

/** Three shard curvatures, cycled, so a burst never shows the same fragment twice —
 * the "any recognisable mark repeated becomes a visible stamp" lesson from the floor
 * texture work, applied at effect scale. */
const shardGeos = [shellTile(1.1), shellTile(1.7), shellTile(2.3)];
let shardCursor = 0;
const nextShardGeo = (): THREE.BufferGeometry => shardGeos[shardCursor++ % shardGeos.length];

/** A wide shallow curl — a shred of lettuce. Same primitive, very different
 * proportions, which is what keeps five kinds of debris distinguishable at 12 px. */
const lettuceGeo = shellTile(2.7, 9);
/** The two halves the shell splits into on impact. Nearly a half-cylinder each. */
const halfShellGeo = shellTile(2.9, 12);

/** Lumpy, faceted, irregular — cooked mince, not a ball. */
const meatGeo = new THREE.IcosahedronGeometry(1, 0);
/** Angular grit. A tetrahedron has the fewest faces that still read as "a hard
 * broken bit" rather than as a round particle. */
const crumbGeo = new THREE.TetrahedronGeometry(1, 0);
const diceGeo = new THREE.BoxGeometry(1, 1, 1);
/** Onion: a full core plus open shells with a wedge cut out, so the LAYER EDGES are
 * visible — a plain sphere is a ball, and a ball with the side cut away is an onion. */
const onionCoreGeo = new THREE.SphereGeometry(1, 14, 10);
/** The open layer-shells the impact peels apart — three quarters of a sphere, so the
 * cut edge (the layer's own edge) is visible as it opens out. */
const onionShellGeo = new THREE.SphereGeometry(1, 16, 10, 0, Math.PI * 1.5);
/** A meridian band on the bulb. A torus lies in XY with its axis along Z by default,
 * which is already a vertical great circle — it only ever needs a yaw. */
const onionBandGeo = new THREE.TorusGeometry(1, 0.062, 5, 20);
/** The papery neck at the top of the bulb, and the root wisps at the bottom. */
const onionNeckGeo = new THREE.ConeGeometry(1, 1, 6);
/** Papery skin flake — the thinnest curl in the file, shed in flight. */
const skinGeo = shellTile(2.2, 7);

/**
 * Acrid vapour. A soft radial SPRITE, for the two reasons `soup.ts` arrived at the
 * same choice: a hard-edged low-alpha polygon reads as a pale shard (i.e. exactly
 * like the debris it is supposed to be distinguishable from), and a sprite is always
 * camera-facing so it can never be caught edge-on the way a quad can.
 */
const vapourTex = (() => {
  const size = 64;
  const cvs = document.createElement('canvas');
  cvs.width = cvs.height = size;
  const c2d = cvs.getContext('2d')!;
  const g = c2d.createRadialGradient(size / 2, size / 2, 0, size / 2, size / 2, size / 2);
  g.addColorStop(0, 'rgba(255,255,255,0.85)');
  g.addColorStop(0.42, 'rgba(255,255,255,0.44)');
  g.addColorStop(0.76, 'rgba(255,255,255,0.12)');
  g.addColorStop(1, 'rgba(255,255,255,0)');
  c2d.fillStyle = g;
  c2d.fillRect(0, 0, size, size);
  const tex = new THREE.CanvasTexture(cvs);
  tex.colorSpace = THREE.SRGBColorSpace;
  return tex;
})();

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

const nextShellMat = materialPool(26, () => fading(SHELL));
const nextCrumbMat = materialPool(34, () => fading(CRUMB));
const nextBitMat = materialPool(30, () => fading(MEAT_DARK));
const nextPeelMat = materialPool(12, () => fading(ONION_MID));
/**
 * The contact flash, and it is deliberately NOT additive.
 *
 * It used to be. A blind critic pinned the whole effect for having "zero impact
 * punch — not one of the six frames has a bright core", with the damning detail that
 * the arena's own static floor decal had more contrast than any of our combat hits.
 * Additive pale gold over this arena's bright warm terracotta does not make a core,
 * it makes a soft wash sitting in the same value band as the floor it is drawn on.
 * Opaque and hard-edged is what says AN EVENT HAPPENED HERE.
 */
// 20 slots, not 10: one hit spends 6 (a crack flash plus a 5-tile shell snap) and
// Double Toss lands two hits together, so a smaller pool would hand the same
// material to two live flashes and they would fight over its `opacity`.
const nextFlashMat = materialPool(20, () => fading('#FFF3D6'));
const nextVapourMat = materialPool(14, () => new THREE.SpriteMaterial({
  // NORMAL blending at low alpha, not additive — additive pale violet over this
  // arena's bright warm floor blows straight to a clipped highlight and stops
  // reading as vapour at all (the finding `soup.ts` recorded for its steam).
  map: vapourTex, color: VAPOUR, transparent: true, opacity: 0.3, depthWrite: false,
}));

/**
 * PROJECTILE BODIES get their own materials, and nothing ever animates their opacity.
 *
 * This is not a stylistic split. In `soup.ts` the projectile bodies used to draw
 * from the same pools as the particles — which are handed round-robin to a stream of
 * debris that each fade THEMSELVES to zero — so a projectile in flight shared a
 * material with a particle spawned a moment later and vanished mid-flight the instant
 * that particle faded out. A Filling clump shedding a bit every ~0.075 s wraps a
 * 30-slot pool in a couple of seconds, so this would not have been a rare race here.
 *
 * Body materials are also SEPARATE PER COMBO PART. Double Toss puts a filling clump
 * and an onion in the air simultaneously, so a single shared body material tinted
 * from `ctx.color` at build time would make whichever built last recolour the other.
 */
const opaque = (color: string, extra: THREE.MeshBasicMaterialParameters = {}) =>
  new THREE.MeshBasicMaterial({ color, side: THREE.DoubleSide, ...extra });

const bodyMeatMat = opaque('#6B3E26');
const bodyMeatDarkMat = opaque(MEAT_DARK);
const bodyShellMat = opaque(SHELL);
const bodyShellDarkMat = opaque(SHELL_DARK);
const bodyLettuceMat = opaque(LETTUCE);
const bodyTomatoMat = opaque(TOMATO);
const bodyOnionMat = opaque('#B497D6');
const bodyOnionMidMat = opaque(ONION_MID);
const bodyOnionPaleMat = opaque(ONION_PALE);

// ─────────────────────────────────────────────────────────────────────────────
// Helpers
// ─────────────────────────────────────────────────────────────────────────────

/**
 * ORIENTATION RULE FOR THIS FILE.
 *
 * Every shell tile here is a section of a cylinder wall whose axis is local +Y, and
 * anything that has to stay READABLE is only ever YAWED about world up (a single
 * `rotation.y`), never given a composed orientation. That presents the curve to this
 * game's pitched top-down camera as a visible arc.
 *
 * Composing `rotation.x` then `rotation.y` does NOT rotate a flat-ish form about
 * world up — Euler angles are intrinsic and sequential, so the second angle turns the
 * already-tipped form and swings it edge-on, which is a recorded "rendering but
 * invisible" cause on this project. Aiming a tile down the throw vector with a
 * quaternion is no better for a readability cue: it points the tile's FLAT FACE at
 * the camera and the curve disappears (measured — see `tossCast`).
 *
 * Free-tumbling DEBRIS is the one exception and is deliberately unconstrained: a
 * fragment that is edge-on for part of its arc is what tumbling looks like.
 */

/** Seconds this projectile spends in the air, straight off the `REACH`/`FLIGHT_MS`
 * ladders in `rules.ts`, so tumble rates authored as TURNS PER FLIGHT survive a
 * weapon changing rung. */
function flightSeconds(w: Weapon): number {
  if (w.range && w.speed) return w.range / w.speed;
  return FLIGHT_MS.normal / 1000;
}

/**
 * Which half of Double Toss this instance is — resolved out of `rules.ts` rather
 * than against a hardcoded hex. Returns -1 for the single-shot weapons.
 */
function comboIndex(ctx: WeaponVfxCtx): number {
  const parts = ctx.weapon.comboParts;
  if (!parts) return -1;
  const exact = parts.findIndex((p) => p.color === ctx.color && p.damage === ctx.damage);
  if (exact >= 0) return exact;
  return parts.findIndex((p) => p.color === ctx.color);
}

/**
 * Impact scale, matched to the recipe `game/vfx.ts` re-derived for the generic burst
 * (`clamp(0.85 + damage * 0.035, ...)`), so a Taco hit reads as the same WEIGHT of
 * event as any other weapon's at the same damage — capped at 1.45 because Taco's
 * hardest shot is 14 and nothing here should approach the burst's 3.0 m ceiling.
 */
function impactScale(damage: number): number {
  return THREE.MathUtils.clamp(0.85 + damage * 0.035, 0.85, 1.45);
}

/** Per-projectile tumble state, stashed on the pooled object — Double Toss has two
 * in flight at once, so this cannot be module state. */
interface Tumble { t: number; rate: number; shed: number; }
function tumbleState(obj: THREE.Object3D, w: Weapon, turnsPerFlight: number): Tumble {
  let st = obj.userData.__tumble as Tumble | undefined;
  if (!st) {
    st = { t: Math.random() * TWO_PI, rate: (turnsPerFlight * TWO_PI) / flightSeconds(w), shed: 0 };
    obj.userData.__tumble = st;
  }
  return st;
}

// ─────────────────────────────────────────────────────────────────────────────
// Debris spawners. Every one of these SETS its material's opacity and colour and
// never READS them: the previous user of a pooled slot faded it to ~0 and left it
// there, so reading that as a starting value means every particle in the game spawns
// invisible once the pool wraps — about a second of firing. That bug shipped in
// `soup.ts`'s `spawnDroplet` and deleted the effect's whole identity mid-match.
// ─────────────────────────────────────────────────────────────────────────────

/** Generic ballistic debris: launch, tumble in 3D, settle onto the floor, fade. The
 * 3D tumble is deliberate contrast with `pizza.ts`, whose fragments stay FLAT because
 * a piece of a plate is still a plate — a piece of a taco is a chunk, and it goes
 * end over end. */
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

/** A curved shell fragment. */
function spawnShard(
  ctx: WeaponVfxCtx, ox: number, oy: number, oz: number,
  vx: number, vy: number, vz: number, scale: number, life: number,
): void {
  spawnDebris(
    ctx, nextShardGeo(), nextShellMat(), Math.random() < 0.35 ? SHELL_DARK : SHELL,
    ox, oy, oz, vx, vy, vz,
    SHARD_R * scale, SHARD_H * scale, SHARD_R * scale, life,
  );
}

/** Fine broken shell. Cheap, plentiful, and the thing that makes a Taco hit read as
 * CRUMBLY rather than as a handful of objects being thrown. */
function spawnCrumb(
  ctx: WeaponVfxCtx, ox: number, oy: number, oz: number,
  vx: number, vy: number, vz: number, scale: number, life: number,
): void {
  spawnDebris(
    ctx, crumbGeo, nextCrumbMat(), CRUMB,
    ox, oy, oz, vx, vy, vz,
    CRUMB_R * scale, CRUMB_R * scale, CRUMB_R * scale, life,
  );
}

/** One piece of filling. `kind` picks the FORM as well as the colour — five
 * distinguishable little shapes is what "loose contents" looks like at 12 px, where
 * five colours of the same shape would just look like confetti. */
function spawnFillingBit(
  ctx: WeaponVfxCtx, kind: 'meat' | 'lettuce' | 'tomato' | 'onion',
  ox: number, oy: number, oz: number,
  vx: number, vy: number, vz: number, scale: number, life: number,
): void {
  if (kind === 'lettuce') {
    spawnDebris(
      ctx, lettuceGeo, nextBitMat(), LETTUCE, ox, oy, oz, vx, vy, vz,
      LETTUCE_R * scale, LETTUCE_R * 0.42 * scale, LETTUCE_R * scale, life, -6.5,
    );
  } else if (kind === 'tomato') {
    spawnDebris(
      ctx, diceGeo, nextBitMat(), TOMATO, ox, oy, oz, vx, vy, vz,
      DICE_R * scale, DICE_R * scale, DICE_R * scale, life,
    );
  } else if (kind === 'onion') {
    spawnDebris(
      ctx, diceGeo, nextBitMat(), ONION_PALE, ox, oy, oz, vx, vy, vz,
      DICE_R * 1.3 * scale, DICE_R * 0.4 * scale, DICE_R * 1.3 * scale, life,
    );
  } else {
    const s = MEAT_R * (0.45 + Math.random() * 0.3) * scale;
    spawnDebris(
      ctx, meatGeo, nextBitMat(), Math.random() < 0.4 ? MEAT_DARK : '#6B3E26',
      ox, oy, oz, vx, vy, vz, s, s * 0.8, s * 1.15, life,
    );
  }
}

/**
 * A brief additive pop at the moment of contact — the frame of brightness that keeps
 * a hit feeling like a hit. Built from the CRUMB tetrahedron rather than a sphere or
 * a sprite, so even the flash is angular: a round bloom is the one thing the generic
 * burst already does, and it is what every one of these files exists to stop doing.
 * Kept small and short; the mass of a Taco hit is its debris, not its glow.
 */
function spawnCrackFlash(ctx: WeaponVfxCtx, x: number, y: number, z: number, radius: number): void {
  const mat = nextFlashMat();
  mat.color.set('#FFF3D6');
  mat.opacity = 1;
  const flash = new THREE.Mesh(crumbGeo, mat);
  flash.renderOrder = 12;
  flash.position.set(x, y, z);
  flash.rotation.set(Math.random() * TWO_PI, Math.random() * TWO_PI, 0);
  flash.scale.setScalar(radius * 0.6);
  ctx.spawnTransient(flash, 0.12, (t) => {
    flash.scale.setScalar(radius * THREE.MathUtils.lerp(0.6, 1.3, t));
    // Held at full for the first 40%, then cut. A flash that starts fading on frame
    // one never has a bright frame at all.
    mat.opacity = t < 0.4 ? 1 : 1 - (t - 0.4) / 0.6;
  });
}

/**
 * THE SHELL SNAP — Taco's "an event happened here" beat.
 *
 * Five near-white-hot shell tiles thrown outward from the contact ring and gone in
 * 0.13 s. Hard-edged, fully opaque, and bright enough to break out of the warm floor
 * value band the whole palette otherwise sits in. It is RADIAL and it lives on the
 * OUTSIDE of the silhouette: at 0.9 m from the hit these tiles sit beyond a
 * fighter's head (~0.6 m radius on the widest archetype), so they can be this loud
 * without touching the identity band on the character's head and torso.
 *
 * It is also the only element of a Taco hit that is not made of the food itself, and
 * it still carries the shell's curve — which is the point: the punch is a shell
 * cracking, not a spark.
 */
function spawnShellSnap(ctx: WeaponVfxCtx, scale: number): void {
  const { x, y, z } = ctx.position;
  const d = ctx.direction;
  const base = Math.random() * TWO_PI;
  for (let i = 0; i < 5; i++) {
    const a = base + (i / 5) * TWO_PI;
    const mat = nextFlashMat();
    mat.color.set(i % 2 === 0 ? '#FFF3D6' : '#FFD27A');
    mat.opacity = 1;
    const tile = new THREE.Mesh(shardGeos[i % shardGeos.length], mat);
    tile.renderOrder = 12;
    const cos = Math.cos(a), sin = Math.sin(a);
    const r0 = CH * 0.11 * scale;
    const r1 = CH * 0.44 * scale;
    const yaw = Math.atan2(cos, sin);
    ctx.spawnTransient(tile, 0.13, (t) => {
      const e = 1 - Math.pow(1 - t, 2.2);
      const r = THREE.MathUtils.lerp(r0, r1, e);
      tile.position.set(x + cos * r + d.x * r * 0.3, y, z + sin * r + d.z * r * 0.3);
      const sc = (1 - t * 0.45) * scale;
      // Yaw only — see the orientation rule near the top of the file. The curve has
      // to face the camera or this is five gold rectangles.
      tile.rotation.set(0, yaw, 0);
      tile.scale.set(SHARD_R * 1.15 * sc, SHARD_H * 1.0 * sc, SHARD_R * 1.15 * sc);
      mat.opacity = t < 0.45 ? 1 : 1 - (t - 0.45) / 0.55;
    });
  }
}

/** A drifting puff of onion vapour. Low alpha and low value contrast on purpose:
 * this is the only element in the file allowed to sit over the target, so it may
 * never be dense enough to hide it. */
function spawnVapour(
  ctx: WeaponVfxCtx, x: number, y: number, z: number,
  radius: number, rise: number, life: number, peak = 0.3,
): void {
  const sprite = new THREE.Sprite(nextVapourMat());
  const mat = sprite.material;
  mat.color.set(VAPOUR);
  mat.opacity = 0;                 // SET, never read — see the block comment above.
  sprite.renderOrder = 10;
  const driftX = (Math.random() - 0.5) * radius * 1.4;
  const driftZ = (Math.random() - 0.5) * radius * 1.4;
  sprite.position.set(x, y, z);
  sprite.scale.set(radius, radius, 1);
  ctx.spawnTransient(sprite, life, (t) => {
    const e = 1 - Math.pow(1 - t, 2);
    sprite.position.set(x + driftX * e, y + rise * e, z + driftZ * e);
    const s = radius * (1 + e * 0.9);
    sprite.scale.set(s, s, 1);
    mat.opacity = peak * Math.sin(Math.min(1, t * 1.25) * Math.PI);
  });
}

/**
 * The shell splitting: two big curved halves flung apart, one left one right of the
 * incoming direction. This is Taco's signature contact beat — the container breaking
 * open — and it is what tells you at a glance which fighter hit you.
 */
function spawnShellSplit(ctx: WeaponVfxCtx, scale: number, speed: number, life: number): void {
  const { x, y, z } = ctx.position;
  const d = ctx.direction;
  // In-plane perpendicular to the incoming shot, so the two halves part ACROSS the
  // line of fire the way a struck shell actually opens.
  let px = -d.z, pz = d.x;
  if (Math.hypot(px, pz) < 1e-4) { px = 1; pz = 0; }
  for (const side of [-1, 1]) {
    const mat = nextShellMat();
    mat.color.set(side < 0 ? SHELL : SHELL_DARK);
    mat.opacity = 1;
    const half = new THREE.Mesh(halfShellGeo, mat);
    half.renderOrder = 9;
    // Born already parted by a head-radius, for the reason recorded in
    // `fillingImpact`: two halves that start coincident at the point of contact
    // spend the first third of their life inside the target.
    const bx = x + px * side * CH * 0.24 * scale;
    const bz = z + pz * side * CH * 0.24 * scale;
    half.position.set(bx, y, bz);
    const r = SHARD_R * 2.1 * scale;
    half.scale.set(r, SHARD_H * 1.9 * scale, r);
    const vx = px * side * speed + d.x * speed * 0.35;
    const vz = pz * side * speed + d.z * speed * 0.35;
    const vy = 1.5 + Math.random() * 0.9;
    const spin = side * (7 + Math.random() * 5);
    const tilt = (Math.random() - 0.5) * 6;
    ctx.spawnTransient(half, life, (t, e) => {
      const yy = y + vy * e - 4.6 * e * e;
      half.position.set(bx + vx * e, Math.max(GROUND_Y, yy), bz + vz * e);
      half.rotation.set(tilt * e, spin * e, side * 0.5);
      mat.opacity = 1 - Math.pow(t, 2.2);
    });
  }
}

// ─────────────────────────────────────────────────────────────────────────────
// Projectile builders
// ─────────────────────────────────────────────────────────────────────────────

/**
 * A handful of filling still cupped in a scrap of shell. Nothing about this is a
 * clean object: a lumpy mince core, a curl of lettuce and two dice of tomato poking
 * out at odd angles, and one gold shell fragment hugging the underside. The
 * asymmetry is the point — it makes the tumble legible AND says "this is coming
 * apart" from the first frame, which is what stops it reading as another tinted ball.
 */
function buildFillingClump(color: string): THREE.Group {
  const group = new THREE.Group();

  bodyMeatMat.color.set(color);
  const core = new THREE.Mesh(meatGeo, bodyMeatMat);
  core.scale.set(MEAT_R, MEAT_R * 0.85, MEAT_R * 1.18);
  core.rotation.set(0.6, 0.4, 0.2);
  group.add(core);

  const lump = new THREE.Mesh(meatGeo, bodyMeatDarkMat);
  lump.scale.setScalar(MEAT_R * 0.62);
  lump.position.set(MEAT_R * 0.55, -MEAT_R * 0.4, -MEAT_R * 0.3);
  lump.rotation.set(1.1, 0.3, 0.8);
  group.add(lump);

  const leaf = new THREE.Mesh(lettuceGeo, bodyLettuceMat);
  leaf.scale.set(LETTUCE_R * 1.15, LETTUCE_R * 0.4, LETTUCE_R * 1.15);
  leaf.position.set(-MEAT_R * 0.45, MEAT_R * 0.55, MEAT_R * 0.2);
  leaf.rotation.set(0.9, 0.7, -0.5);
  group.add(leaf);

  for (const [dx, dy, dz] of [[0.8, 0.3, 0.5], [-0.55, -0.25, -0.8]] as const) {
    const dice = new THREE.Mesh(diceGeo, bodyTomatoMat);
    dice.scale.setScalar(DICE_R * 1.45);
    dice.position.set(MEAT_R * dx, MEAT_R * dy, MEAT_R * dz);
    dice.rotation.set(Math.random(), Math.random(), Math.random());
    group.add(dice);
  }

  const leaf2 = new THREE.Mesh(lettuceGeo, bodyLettuceMat);
  leaf2.scale.set(LETTUCE_R * 0.8, LETTUCE_R * 0.3, LETTUCE_R * 0.8);
  leaf2.position.set(MEAT_R * 0.3, -MEAT_R * 0.15, -MEAT_R * 0.7);
  leaf2.rotation.set(-0.6, 1.9, 0.8);
  group.add(leaf2);

  // The shell scrap CRADLES the filling from below and to one side. Rendering the
  // first build settled its size: at radius `MEAT_R * 1.5` the tile wrapped right
  // round the core and the clump read as a plain gold rectangle — the container had
  // swallowed the contents, which is the exact opposite of this weapon's read.
  const scrap = new THREE.Mesh(shardGeos[2], bodyShellMat);
  scrap.scale.set(MEAT_R * 1.02, MEAT_R * 1.25, MEAT_R * 1.02);
  scrap.position.set(-MEAT_R * 0.25, -MEAT_R * 0.72, -MEAT_R * 0.1);
  scrap.rotation.set(1.5, 0.4, 0.15);
  group.add(scrap);

  const scrapEdge = new THREE.Mesh(shardGeos[0], bodyShellDarkMat);
  scrapEdge.scale.set(MEAT_R * 0.7, MEAT_R * 0.85, MEAT_R * 0.7);
  scrapEdge.position.set(MEAT_R * 0.75, -MEAT_R * 0.35, MEAT_R * 0.45);
  scrapEdge.rotation.set(0.9, 2.2, -0.6);
  group.add(scrapEdge);

  return group;
}

/**
 * An onion — built as a BULB, not as a ball.
 *
 * The first build was a core sphere inside two open layer-shells with staggered cut
 * edges. Rendered at shipped framing it was a plain pale lavender circle about 22 px
 * across: the outer shell hid the layers, and the cut edges faced away from the
 * camera as often as toward it. What identifies an onion at 22 px is its
 * SILHOUETTE — a squat bulb with a dry papery neck at the top and root wisps at the
 * bottom — plus its colour, so that is what this builds, with meridian banding for
 * surface interest and an off-centre pale patch to make the tumble legible (the same
 * device `pizza.ts` uses on its round dough plate, for the same reason: a smooth
 * body of revolution turning about its own axis is indistinguishable from a still
 * one).
 */
function buildOnion(color: string): THREE.Group {
  const group = new THREE.Group();

  bodyOnionMat.color.set(color);
  const bulb = new THREE.Mesh(onionCoreGeo, bodyOnionMat);
  bulb.scale.set(ONION_R, ONION_R * 0.92, ONION_R);
  group.add(bulb);

  // Meridian banding — great circles standing in vertical planes. `TorusGeometry`
  // already lies in XY with its axis along Z, i.e. it IS a meridian ring; only a yaw
  // about world up is needed, so nothing here ever composes two Euler terms on a
  // flat form.
  const bands = new THREE.Group();
  for (let i = 0; i < 3; i++) {
    const band = new THREE.Mesh(onionBandGeo, bodyOnionPaleMat);
    band.scale.set(ONION_R * 1.01, ONION_R * 0.93, ONION_R * 1.01);
    band.rotation.y = (i / 3) * Math.PI;
    bands.add(band);
  }
  group.add(bands);

  // The dry papery neck. This is the single strongest identity cue in the silhouette
  // and it is why the projectile is not just "a purple ball".
  const neck = new THREE.Mesh(onionNeckGeo, bodyOnionPaleMat);
  neck.scale.set(ONION_R * 0.42, ONION_R * 0.62, ONION_R * 0.42);
  neck.position.y = ONION_R * 1.06;
  neck.rotation.z = 0.18;
  group.add(neck);

  // Root wisps.
  for (let i = 0; i < 3; i++) {
    const a = (i / 3) * TWO_PI + 0.4;
    const root = new THREE.Mesh(onionNeckGeo, bodyOnionMidMat);
    root.scale.set(ONION_R * 0.09, ONION_R * 0.34, ONION_R * 0.09);
    root.position.set(Math.cos(a) * ONION_R * 0.2, -ONION_R * 1.0, Math.sin(a) * ONION_R * 0.2);
    root.rotation.set(Math.PI + (Math.random() - 0.5) * 0.6, 0, (Math.random() - 0.5) * 0.6);
    group.add(root);
  }

  // Off-centre papery patch — the asymmetry that makes the tumble visible.
  const patch = new THREE.Mesh(onionCoreGeo, bodyOnionPaleMat);
  patch.scale.set(ONION_R * 0.42, ONION_R * 0.2, ONION_R * 0.42);
  patch.position.set(ONION_R * 0.42, ONION_R * 0.62, -ONION_R * 0.3);
  group.add(patch);

  group.userData.__bands = bands;
  return group;
}

// ─────────────────────────────────────────────────────────────────────────────
// Shared hook bodies. `Filling`/`Onion`/`Double` all call into these with a scale
// multiplier, so the special is visibly the same two foods, only more of them.
// ─────────────────────────────────────────────────────────────────────────────

function fillingTrail(ctx: WeaponVfxCtx, turns: number): void {
  const obj = ctx.object;
  if (!obj) return;
  const dt = ctx.dt ?? 0;
  const st = tumbleState(obj, ctx.weapon, turns);
  st.t += st.rate * dt;
  // A loose handful is not aerodynamic — it goes end over end on more than one axis.
  // `game/vfx.ts` overwrites `rotation.y` every frame with its face-travel default,
  // so the tumble is written into x and z (and the group's own y is left to it).
  obj.rotation.x = st.t;
  obj.rotation.z = Math.sin(st.t * 0.63) * 0.9;

  // "Loose contents", literally: it keeps dropping bits it cannot hold on to. This
  // is the single most identifying thing about the projectile in flight.
  st.shed -= dt;
  if (st.shed <= 0) {
    st.shed = 0.06 + Math.random() * 0.04;
    const roll = Math.random();
    const kind = roll < 0.45 ? 'meat' : roll < 0.72 ? 'tomato' : 'lettuce';
    const bx = ctx.position.x - ctx.direction.x * MEAT_R;
    const bz = ctx.position.z - ctx.direction.z * MEAT_R;
    spawnFillingBit(
      ctx, kind, bx, ctx.position.y - MEAT_R * 0.4, bz,
      -ctx.direction.x * 0.5 + (Math.random() - 0.5) * 0.7, -0.2 - Math.random() * 0.4,
      -ctx.direction.z * 0.5 + (Math.random() - 0.5) * 0.7,
      0.85, 0.34,
    );
    if (Math.random() < 0.55) {
      spawnCrumb(
        ctx, bx, ctx.position.y, bz,
        -ctx.direction.x * 0.7 + (Math.random() - 0.5) * 0.6, 0.1 + Math.random() * 0.3,
        -ctx.direction.z * 0.7 + (Math.random() - 0.5) * 0.6,
        0.9, 0.3,
      );
    }
  }
}

function fillingImpact(ctx: WeaponVfxCtx, mult: number): void {
  const s = impactScale(ctx.damage) * mult;
  const { x, y, z } = ctx.position;
  const d = ctx.direction;

  spawnCrackFlash(ctx, x, y, z, CH * 0.24 * s);
  spawnShellSnap(ctx, s);
  spawnShellSplit(ctx, s * 0.95, 2.4 * s, 0.4);

  // Everything below is launched from a RING already clear of the target rather than
  // from the exact point of contact, and thrown hard enough to keep clearing it.
  //
  // MEASURED, not guessed: at 2.5 m/s from dead centre a fragment has moved 0.35 m by
  // t=0.14, and the widest part of a fighter on this cast is its HEAD (Hamburger's
  // bun is ~1.2 m across) — so more than half of the effect's life was spent inside
  // the silhouette, where a pitched top-down camera hides it completely. Rendering it
  // is what showed this: the hit read as two gold specks. Starting on the contact
  // ring is the same fix `soup.ts` uses for its splash crown, and it is the
  // difference between debris that exists and debris that is seen.
  const R0 = CH * 0.26 * s;
  const bias = 0.8;
  for (let i = 0; i < 6; i++) {
    const a = (i / 6) * TWO_PI + Math.random() * 0.7;
    const out = (2.2 + Math.random() * 1.5) * s;
    const roll = Math.random();
    spawnFillingBit(
      ctx, roll < 0.5 ? 'meat' : roll < 0.78 ? 'tomato' : 'lettuce',
      x + Math.cos(a) * R0, y, z + Math.sin(a) * R0,
      Math.cos(a) * out + d.x * bias, 1.9 + Math.random() * 1.3, Math.sin(a) * out + d.z * bias,
      s, 0.42 + Math.random() * 0.14,
    );
  }
  for (let i = 0; i < 4; i++) {
    const a = (i / 4) * TWO_PI + Math.random() * 0.9;
    const out = (2.4 + Math.random() * 1.6) * s;
    spawnShard(
      ctx, x + Math.cos(a) * R0, y, z + Math.sin(a) * R0,
      Math.cos(a) * out + d.x * bias, 1.7 + Math.random() * 1.5, Math.sin(a) * out + d.z * bias,
      (0.85 + Math.random() * 0.5) * s, 0.42 + Math.random() * 0.12,
    );
  }
  for (let i = 0; i < 9; i++) {
    const a = Math.random() * TWO_PI;
    const out = (2.6 + Math.random() * 2.1) * s;
    spawnCrumb(
      ctx, x + Math.cos(a) * R0 * 0.8, y, z + Math.sin(a) * R0 * 0.8,
      Math.cos(a) * out + d.x * bias, 1.5 + Math.random() * 1.8, Math.sin(a) * out + d.z * bias,
      (0.85 + Math.random() * 0.7) * s, 0.36 + Math.random() * 0.14,
    );
  }
}

function onionTrail(ctx: WeaponVfxCtx, turns: number): void {
  const obj = ctx.object;
  if (!obj) return;
  const dt = ctx.dt ?? 0;
  const st = tumbleState(obj, ctx.weapon, turns);
  st.t += st.rate * dt;
  obj.rotation.x = st.t * 0.8;
  obj.rotation.z = st.t * 0.45;
  // The banding turns at its OWN rate — an onion's skins are loose on it, and that
  // slip is what keeps the bands reading as skin rather than as a seam painted on a
  // ball.
  const bands = obj.userData.__bands as THREE.Object3D | undefined;
  if (bands) bands.rotation.y += dt * 1.9;

  st.shed -= dt;
  if (st.shed <= 0) {
    st.shed = 0.1 + Math.random() * 0.07;
    // Papery skin: flutters rather than falls — a much lower gravity than any other
    // debris in this file, which is the whole read for "dry outer skin".
    const mat = nextCrumbMat();
    mat.color.set(ONION_PALE);
    mat.opacity = 1;
    const flake = new THREE.Mesh(skinGeo, mat);
    flake.renderOrder = 9;
    const fx = ctx.position.x - ctx.direction.x * ONION_R;
    const fz = ctx.position.z - ctx.direction.z * ONION_R;
    flake.position.set(fx, ctx.position.y, fz);
    const r = ONION_R * (0.3 + Math.random() * 0.2);
    flake.scale.set(r, r * 0.5, r);
    const vx = -ctx.direction.x * 0.5 + (Math.random() - 0.5) * 0.5;
    const vz = -ctx.direction.z * 0.5 + (Math.random() - 0.5) * 0.5;
    const wobble = 5 + Math.random() * 5;
    ctx.spawnTransient(flake, 0.42, (t, e) => {
      flake.position.set(fx + vx * e, ctx.position.y - 0.7 * e * e - 0.25 * e, fz + vz * e);
      flake.rotation.set(Math.sin(e * wobble) * 1.4, e * 3, Math.cos(e * wobble * 0.7) * 1.1);
      mat.opacity = 1 - Math.pow(t, 2);
    });
  }
}

function onionImpact(ctx: WeaponVfxCtx, mult: number): void {
  const s = impactScale(ctx.damage) * mult;
  const { x, y, z } = ctx.position;
  const d = ctx.direction;

  spawnCrackFlash(ctx, x, y, z, CH * 0.21 * s);
  spawnShellSnap(ctx, s * 0.88);

  // The layers PEEL. Three open shells blow outward and upward, growing and thinning
  // — a bulb coming apart from the inside. This is Onion Bomb's signature beat and it
  // is deliberately 3D and domed, so it can never be confused with `donut.ts`'s flat
  // expanding hoops or `pizza.ts`'s flat plates.
  for (let i = 0; i < 3; i++) {
    const mat = nextPeelMat();
    mat.color.set(i === 0 ? ctx.color : i === 1 ? ctx.color : ONION_PALE);
    // 0.75, not 0.95. These are domed shells centred on the hit, so for their first
    // third they are WRAPPED AROUND the target; at near-full opacity they read as a
    // pale collar clamped over the fighter instead of as layers blowing off it, and
    // they hide the thing the hit is supposed to be giving feedback about.
    mat.opacity = 0.66;
    const peel = new THREE.Mesh(onionShellGeo, mat);
    peel.renderOrder = 10;
    peel.position.set(x, y, z);
    peel.rotation.set((Math.random() - 0.5) * 0.5, Math.random() * TWO_PI, (Math.random() - 0.5) * 0.5);
    const r0 = ONION_R * (0.8 + i * 0.12);
    const r1 = PEEL_R * s * (0.78 + i * 0.22);
    const spin = (Math.random() - 0.5) * 5;
    ctx.spawnTransient(peel, 0.3 + i * 0.05, (t) => {
      const e = 1 - Math.pow(1 - t, 2.6);
      const r = THREE.MathUtils.lerp(r0, r1, e);
      peel.scale.set(r, r * (0.9 - e * 0.45), r);   // flattens as it opens out
      peel.position.y = y + e * CH * 0.06;
      peel.rotation.y += spin * 0.02;
      mat.opacity = 0.66 * (1 - Math.pow(t, 1.4));
    });
  }

  // The sting. A low, slow, violet haze — the one cue in the roster that says
  // "this makes your eyes water", and the reason an Onion Bomb hit never gets
  // confused with a Filling Toss hit even though they share Taco's shell debris.
  spawnVapour(ctx, x, y * 0.6, z, CH * 0.34 * s, CH * 0.3, 0.65, 0.4);
  for (let i = 0; i < 3; i++) {
    const a = (i / 3) * TWO_PI + Math.random();
    spawnVapour(
      ctx,
      x + Math.cos(a) * CH * 0.24 * s, GROUND_Y + CH * 0.12, z + Math.sin(a) * CH * 0.24 * s,
      CH * 0.28 * s, CH * 0.26, 0.6, 0.34,
    );
  }

  // Launched from the contact RING, not from dead centre — see `fillingImpact` for
  // the measurement that forced this.
  const R0 = CH * 0.24 * s;
  const bias = 0.7;
  for (let i = 0; i < 5; i++) {
    const a = (i / 5) * TWO_PI + Math.random() * 0.8;
    const out = (2.3 + Math.random() * 1.4) * s;
    spawnFillingBit(
      ctx, 'onion', x + Math.cos(a) * R0, y, z + Math.sin(a) * R0,
      Math.cos(a) * out + d.x * bias, 1.9 + Math.random() * 1.2, Math.sin(a) * out + d.z * bias,
      s, 0.4 + Math.random() * 0.12,
    );
  }
  for (let i = 0; i < 3; i++) {
    const a = Math.random() * TWO_PI;
    const out = (2.3 + Math.random() * 1.5) * s;
    spawnShard(
      ctx, x + Math.cos(a) * R0, y, z + Math.sin(a) * R0,
      Math.cos(a) * out + d.x * bias, 1.6 + Math.random() * 1.4, Math.sin(a) * out + d.z * bias,
      (0.75 + Math.random() * 0.45) * s, 0.4,
    );
  }
  for (let i = 0; i < 7; i++) {
    const a = Math.random() * TWO_PI;
    const out = (2.5 + Math.random() * 1.9) * s;
    spawnCrumb(
      ctx, x + Math.cos(a) * R0 * 0.8, y, z + Math.sin(a) * R0 * 0.8,
      Math.cos(a) * out + d.x * bias, 1.4 + Math.random() * 1.6, Math.sin(a) * out + d.z * bias,
      (0.8 + Math.random() * 0.6) * s, 0.34 + Math.random() * 0.12,
    );
  }
}

/**
 * The throw. Taco tips her shell and the contents come out ahead of her — a curved
 * scrap of shell sweeping forward along the throw line, a spray of crumbs and a
 * couple of bits of the thing she is about to throw. No pale circular flash: that
 * shared muzzle pop is exactly what this system exists to replace.
 *
 * The sweep is YAW-ONLY — see the orientation rule near the top of the file.
 */
function tossCast(ctx: WeaponVfxCtx, kinds: Array<'meat' | 'lettuce' | 'tomato' | 'onion'>, mult: number): void {
  const d = ctx.direction;
  const { x, y, z } = ctx.position;

  // The shell TIPPING: a curved tile that opens forward along the throw line and
  // slides out ahead of her. Its axis stays VERTICAL and it is only ever yawed —
  // from this game's pitched top-down camera that presents the curve as a visible
  // "C", which is the whole point. The first build oriented it along the throw
  // vector with a quaternion, and rendering it settled that: pointed that way the
  // tile presents its flat face to the camera and reads as a plain gold rectangle,
  // i.e. as a generic quad, which is exactly what this system exists to replace.
  const mat = nextShellMat();
  mat.color.set(SHELL);
  mat.opacity = 0.9;
  const sweep = new THREE.Mesh(halfShellGeo, mat);
  sweep.renderOrder = 11;
  const yaw = Math.atan2(d.x, d.z);
  const r0 = SHARD_R * 0.9 * mult;
  ctx.spawnTransient(sweep, 0.18, (t) => {
    const r = r0 * (1 + t * 1.5);
    sweep.position.set(x + d.x * t * CH * 0.14, y - t * CH * 0.04, z + d.z * t * CH * 0.14);
    sweep.scale.set(r, SHARD_H * 1.1 * mult * (1 - t * 0.35), r);
    sweep.rotation.set(0, yaw + t * 1.1, 0);
    mat.opacity = 0.9 * (1 - t * t);
  });

  spawnCrackFlash(ctx, x + d.x * CH * 0.06, y, z + d.z * CH * 0.06, CH * 0.10 * mult);

  for (let i = 0; i < 7; i++) {
    spawnCrumb(
      ctx, x, y, z,
      d.x * (1.4 + Math.random() * 1.1) + (Math.random() - 0.5) * 0.9, 0.6 + Math.random() * 0.7,
      d.z * (1.4 + Math.random() * 1.1) + (Math.random() - 0.5) * 0.9,
      0.9, 0.3,
    );
  }
  for (const kind of kinds) {
    spawnFillingBit(
      ctx, kind, x, y, z,
      d.x * (1.3 + Math.random() * 0.7) + (Math.random() - 0.5) * 0.6, 0.8 + Math.random() * 0.5,
      d.z * (1.3 + Math.random() * 0.7) + (Math.random() - 0.5) * 0.6,
      0.9 * mult, 0.3,
    );
  }
}

// ─────────────────────────────────────────────────────────────────────────────

export const tacoWeaponVfx: CharacterWeaponVfxMap = {
  // ── Filling Toss ───────────────────────────────────────────────────────────
  // Taco's heavy single shot: a handful of filling that is visibly shedding itself
  // the whole way there, then bursts and puts its contents all over the floor.
  Filling: {
    projectile(ctx) {
      const obj = buildFillingClump(ctx.color);
      obj.position.copy(ctx.position);
      return obj;
    },
    trail(ctx) { fillingTrail(ctx, 1.7); },
    impact(ctx) { fillingImpact(ctx, 1); },
    cast(ctx) { tossCast(ctx, ['meat', 'tomato'], 1); },
  },

  // ── Onion Bomb ─────────────────────────────────────────────────────────────
  // A compact layered bulb, shedding papery skin as it turns. On impact the layers
  // peel open and leave a violet haze that lingers after every other element has
  // gone — the only lingering element Taco has, and the reason the two ranged shots
  // never read as the same hit.
  Onion: {
    projectile(ctx) {
      const obj = buildOnion(ctx.color);
      obj.position.copy(ctx.position);
      return obj;
    },
    trail(ctx) { onionTrail(ctx, 1.2); },
    impact(ctx) { onionImpact(ctx, 1); },
    cast(ctx) { tossCast(ctx, ['onion', 'onion'], 1); },
  },

  // ── Double Toss (special) ──────────────────────────────────────────────────
  // Two shots at once — the filling AND the onion — fanned ±10°. `comboIndex` reads
  // `rules.ts` to decide which half each instance is, so this one entry draws two
  // completely different projectiles and two completely different hits. Everything
  // is 12% larger than the single-shot versions: it is the special, and 14/9 damage
  // against 12/7 already pushes `impactScale` up a little on its own.
  Double: {
    projectile(ctx) {
      const obj = comboIndex(ctx) === 1 ? buildOnion(ctx.color) : buildFillingClump(ctx.color);
      obj.scale.setScalar(1.12);
      obj.position.copy(ctx.position);
      return obj;
    },
    trail(ctx) {
      if (comboIndex(ctx) === 1) onionTrail(ctx, 1.3);
      else fillingTrail(ctx, 1.9);
    },
    impact(ctx) {
      if (comboIndex(ctx) === 1) onionImpact(ctx, 1.12);
      else fillingImpact(ctx, 1.12);
    },
    // Fired ONCE per `weapon-fired` event for the whole combo (`ctx.damage` is the
    // weapon's own 0, not a part's), so this is the two-handed version: a wider
    // sweep and one of each filling going out together.
    cast(ctx) { tossCast(ctx, ['meat', 'onion', 'tomato'], 1.25); },
  },
};
