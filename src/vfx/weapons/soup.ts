/**
 * Soup weapon VFX — the cast's LIQUID character.
 *
 * The whole point of this file is that a thrown SOLID and a thrown FLUID must not
 * read the same way. `hamburger.ts`'s Tomato (a soft object that splatters) and
 * `waterbottle.ts`'s Glass (a hard object that shatters) are both still OBJECTS:
 * they hold their shape in flight and break into pieces. Soup has no pieces. Its
 * whole vocabulary is:
 *
 *   * VISCOSITY in flight — a blob stretches along its own travel direction,
 *     wobbles, and sheds drips it cannot hold on to. It never tumbles, because a
 *     liquid has no rigid body to tumble.
 *   * SPREADING on impact — the mass does not fly apart into debris, it hits the
 *     floor and RUNS OUTWARD as a flat irregular sheet with tendrils. Nearly all of
 *     the volume ends up on the ground plane, not in the air.
 *   * POOLING — what is left is a mark that behaves like liquid: it spreads a little
 *     past the moment of impact, then thins and sinks rather than shrinking.
 *   * STEAM — this soup is HOT. Steam is the one cue no other weapon in the roster
 *     has, and it is what separates "hot broth" from "spilled water".
 *
 * ── The readability constraint that shaped every number below ───────────────────
 *
 * The arena floor carries two terrain hazard puddles that SLOW anything standing in
 * them (`arena/hazards.ts`): grease (`KPAL.grease` `#A08350`) and water
 * (`KPAL.water` `#3F86A8`). Both were deliberately desaturated so they stop
 * out-shouting the fighters. A soup spill that a player mistakes for one of those is
 * a gameplay bug, not an art nitpick — they would walk around a harmless 0.5-second
 * mark, or worse, walk into a real puddle thinking it was someone's spill.
 *
 * Five independent separators, so the read never rests on a single one:
 *   1. VALUE + CHROMA. Broth is authored hot and bright (`#E8792A` from `rules.ts`,
 *      lifted to `BROTH_HOT` at the core); grease sits muted and dark. Authored as
 *      wanted, NOT pre-compensated — the grade reproduces hue within ~4°.
 *   2. A HOT CORE → DEEP RIM ramp. Nothing else on the floor has a two-tone
 *      temperature gradient; hazard discs are one flat body colour plus a rim.
 *   3. SHAPE. Hazards are smooth ~5 m discs. Every mark here is an irregular splat
 *      with tendrils, at most 2.6 m across.
 *   4. TIME. Nothing here outlives ~0.85 s. Terrain is permanent. A mark that fades
 *      while you look at it cannot be terrain.
 *   5. STEAM rising off it. Puddles are cold and static.
 *
 * ── Scale discipline ───────────────────────────────────────────────────────────
 *
 * Every size below is a fraction of `CHARACTER_HEIGHT`, never a bare metre literal,
 * so this survives the next camera move the way the generic burst was re-derived to.
 * The generic impact burst's largest opaque element is a ground mark of radius
 * `clamp(0.65 * sizeFactor, 0.55, 1.5)` m — 1.74 m across at typical damage, 3.0 m
 * hard cap (`game/vfx.ts`). Soup's marks are budgeted underneath that: Splash
 * (3 dmg, and three pellets land at once) 1.1 m, Noodle (5 dmg) 1.3 m, and the Soup
 * Dump special (16 dmg) 2.6 m — the biggest thing Soup owns, still inside the cap.
 * Liquid sprawls by nature; bigger is NOT better here, and the character has to stay
 * readable through its own hit.
 *
 * Weapon keys (`game/rules.ts` -> `CHARACTERS.soup.weapons`): `'Splash'` (Soup
 * Splash — ranged close, 3-pellet spread), `'Noodle'` (Noodle Toss — ranged long,
 * slow), `'Dump'` (Soup Dump — melee heavy, 90° cone, slow, special).
 */

import * as THREE from 'three';
import type { CharacterWeaponVfxMap, WeaponVfxCtx } from './types';
import { CHARACTER_HEIGHT, wu } from '../../units';
import { REACH } from '../../game/rules';

// ─────────────────────────────────────────────────────────────────────────────
// Palette
// ─────────────────────────────────────────────────────────────────────────────

/** Bright light-catching broth, used for the CORE of every splash and the top of
 * every blob. Deliberately hotter and more luminous than `Weapon.color` so the
 * hot-core → deep-rim ramp exists (separator #2 above). */
const BROTH_HOT = '#FFB35C';
/** Deep, red-shifted broth for splat rims and the underside of blobs. The red shift
 * (hue ~18° vs the body's ~25°) is what keeps the rim from reading as "the same
 * orange but darker" — a real broth edge pools thicker and goes redder. */
const BROTH_DEEP = '#B4400C';
/** Warm off-white steam. Warm, not neutral grey: grey wisps read as smoke/dust, of
 * which this arena already has a field. */
const STEAM_COLOR = '#FFF2E2';
/** Noodle body — matches Noodle Toss's own `Weapon.color` (`#FFE9A8`) so the strands
 * flung by Soup Dump read as the same pasta the Noodle weapon throws. */
const NOODLE_PALE = '#FFE9A8';

// ─────────────────────────────────────────────────────────────────────────────
// Scale — all anchored to the character, never to a camera framing
// ─────────────────────────────────────────────────────────────────────────────

const CH = CHARACTER_HEIGHT;
/**
 * Ground-plane height for every splat/pool mark.
 *
 * The ground layer stack here is CROWDED and getting this wrong silently deletes the
 * effect (this project's single most repeated bug): floor pads sit at 0.045-0.048,
 * seams at 0.062, baked prop shadows at 0.068-0.07, prop toe-kicks at 0.08, the
 * arena's own hazard decals at 0.15-0.25, and `game/vfx.ts`'s melee arcs / impact
 * rings at `GROUND_VFX_Y` 0.24. Several of those are opaque and depth-writing, and
 * the puddle discs are `transparent` WITHOUT `depthWrite: false`, which still writes
 * depth. 0.27 clears every one of them. Every material in this file also sets
 * `depthWrite: false` so Soup never becomes the next thing that occludes someone
 * else's particles.
 */
const SPLAT_Y = 0.27;
/** Splat marks are flat XZ geometry authored directly in the XZ plane (see
 * `buildSplatGeometry`), so nothing here ever rotates a plane about world up —
 * composing `rotation.x` then `rotation.y` does NOT do that, and a plane that has
 * tipped edge-on is invisible from this game's top-down camera. */

// Splat marks are normalised to peak at exactly their stated radius (see
// `buildSplatGeometry`), so these are half-widths and 2x each one is the number to
// compare against the generic burst's 1.74 m typical / 3.0 m cap.
const SPLASH_MARK_RADIUS = CH * 0.30;  // 1.26 m across — and THREE of these land together
const NOODLE_MARK_RADIUS = CH * 0.34;  // 1.43 m across
const DUMP_MARK_RADIUS = CH * 0.55;    // 2.31 m across — Soup's largest element, under the cap

const DROP_RADIUS = CH * 0.042;        // 0.088 m — a droplet, ~4 px at shipped framing
/** The Splash projectile's head. MEASURED against what it replaces: `game/vfx.ts`'s
 * generic projectile is `SphereGeometry(wu(10))` — a 1.0 m ball. At the original
 * `CH * 0.062` the gout head was 0.26 m across, so swapping the bespoke visual in
 * made the projectile nearly 4x SMALLER than the generic one it was improving on,
 * and at shipped framing it rendered as a ~10 px bead. */
const BLOB_RADIUS = CH * 0.085;        // 0.18 m radius -> ~0.50 m gout, half the generic ball

const NOODLE_LENGTH = CH * 0.40;       // 0.84 m
const NOODLE_THICKNESS = CH * 0.024;   // 0.05 m radius -> 0.10 m thick

// ─────────────────────────────────────────────────────────────────────────────
// Module-scope geometry/material singletons. Only the cheap Object3D/Mesh WRAPPER
// is built per spawn — same discipline as `hamburger.ts` / `waterbottle.ts`; see the
// `spawnTransient` doc in `types.ts` for why that split matters.
// ─────────────────────────────────────────────────────────────────────────────

/** Deterministic PRNG so the handful of authored SHAPES below (splat outlines,
 * noodle curves) are fixed art, identical every run — unlike the per-spawn jitter,
 * which stays `Math.random()`. */
function lcg(seed: number): () => number {
  let s = seed % 2147483647;
  if (s <= 0) s += 2147483646;
  return () => { s = (s * 48271) % 2147483647; return s / 2147483647; };
}

/**
 * A unit-radius liquid splat, authored FLAT IN THE XZ PLANE (y = 0 for every vertex)
 * as a triangle fan. The outline is three summed sinusoids — a lumpy blob with no
 * dominant axis, which is what a liquid edge does — plus a few narrow gaussian
 * TENDRILS, the fingers that shoot out when a fluid slaps a hard surface. Those
 * tendrils are separator #3 against a hazard puddle's smooth disc, and they are the
 * single most identifiable feature of the shape at gameplay distance.
 *
 * Wound `(0, i + 1, i)` so the face normal is +Y (up, toward the camera); materials
 * are `DoubleSide` anyway as belt-and-braces, since an inverted flat mark is exactly
 * the kind of thing that renders as nothing at all.
 */
function buildSplatGeometry(seed: number, tendrilCount: number): THREE.BufferGeometry {
  const SEG = 84;
  const rnd = lcg(seed);
  const p0 = rnd() * Math.PI * 2, p1 = rnd() * Math.PI * 2, p2 = rnd() * Math.PI * 2;
  const tendrils: Array<[number, number, number]> = [];
  for (let i = 0; i < tendrilCount; i++) {
    // Amplitude/width MEASURED, not guessed: at the original 0.30-0.80 amplitude and
    // 0.075-0.135 angular width these were needles 80% longer than the blob and ~5°
    // wide, and because the outline is normalised to its longest point (below) the
    // BODY then shrank to ~55% of the stated radius. The rendered result was a hard
    // 5-pointed starburst — indistinguishable from `game/vfx.ts`'s generic star decal
    // and not liquid at all. Shorter and much wider reads as a fluid edge with
    // fingers, and keeps the body at ~78% of the stated radius.
    tendrils.push([rnd() * Math.PI * 2, 0.14 + rnd() * 0.20, 0.16 + rnd() * 0.14]);
  }

  const radii: number[] = [];
  let maxR = 0;
  for (let i = 0; i <= SEG; i++) {
    const a = (i / SEG) * Math.PI * 2;
    let r = 1 + 0.15 * Math.sin(3 * a + p0) + 0.09 * Math.sin(5 * a + p1) + 0.05 * Math.sin(8 * a + p2);
    for (const [ta, amp, width] of tendrils) {
      let d = a - ta;
      while (d > Math.PI) d -= Math.PI * 2;
      while (d < -Math.PI) d += Math.PI * 2;
      r += amp * Math.exp(-(d * d) / (2 * width * width));
    }
    radii.push(r);
    if (r > maxR) maxR = r;
  }
  // NORMALISE so the longest tendril reaches exactly r = 1. Without this the
  // tendrils are a hidden size multiplier on top of every call site's radius — the
  // exact class of mistake that let the generic burst reach 2.25x character height
  // before anyone measured it. After this, `scale.setScalar(R)` means "this mark is
  // at most 2R across", directly comparable to `game/vfx.ts`'s star decal (whose
  // 8-point polygon also peaks at exactly its stated radius).
  const pos = new Float32Array((SEG + 2) * 3);
  for (let i = 0; i <= SEG; i++) {
    const a = (i / SEG) * Math.PI * 2;
    const r = radii[i] / maxR;
    const o = (i + 1) * 3;
    pos[o] = Math.cos(a) * r;
    pos[o + 1] = 0;
    pos[o + 2] = Math.sin(a) * r;
  }
  const index: number[] = [];
  for (let i = 1; i <= SEG; i++) index.push(0, i + 1, i);

  const geo = new THREE.BufferGeometry();
  geo.setAttribute('position', new THREE.BufferAttribute(pos, 3));
  geo.setIndex(index);
  geo.computeVertexNormals();
  return geo;
}

/** Three authored splat outlines, cycled so two hits never stamp the identical
 * shape — the "any recognisable mark repeated becomes a visible stamp" lesson from
 * the floor texture work, applied at effect scale. */
const splatGeos = [buildSplatGeometry(9173, 4), buildSplatGeometry(48271, 5), buildSplatGeometry(11071, 3)];
let splatGeoCursor = 0;
const nextSplatGeo = (): THREE.BufferGeometry => splatGeos[splatGeoCursor++ % splatGeos.length];

/** Unit sphere, stretched along +Z. Every airborne liquid element in this file is
 * this one geometry at a different scale — a blob is a blob. `+Z` is the projectile
 * convention `game/vfx.ts` orients bespoke projectiles to (`rotation.y =
 * atan2(dir.x, dir.y)`), so "long axis = travel axis" comes for free. */
const dropGeo = new THREE.SphereGeometry(1, 9, 7);
dropGeo.scale(0.78, 0.78, 1.4);
/** Unrotated round blob, for things whose long axis is NOT travel (the impact
 * compression column, splash crowns). */
const blobGeo = new THREE.SphereGeometry(1, 10, 8);

/**
 * Steam puff. This was a 7-sided open `ConeGeometry`, and rendering it settled the
 * question: a hard-edged 7-gon cone at 0.34 alpha does not read as vapour, it reads
 * as a pale angular SHARD — i.e. exactly like the debris from the generic burst it is
 * supposed to distinguish Soup from. A soft radial sprite is what vapour needs, and a
 * `Sprite` also removes the last orientation risk in the file (it is always
 * camera-facing, so it can never be caught edge-on the way a quad can).
 */
const steamTex = (() => {
  const size = 64;
  const cvs = document.createElement('canvas');
  cvs.width = cvs.height = size;
  const c2d = cvs.getContext('2d')!;
  const g = c2d.createRadialGradient(size / 2, size / 2, 0, size / 2, size / 2, size / 2);
  g.addColorStop(0, 'rgba(255,255,255,0.95)');
  g.addColorStop(0.45, 'rgba(255,255,255,0.52)');
  g.addColorStop(0.78, 'rgba(255,255,255,0.14)');
  g.addColorStop(1, 'rgba(255,255,255,0)');
  c2d.fillStyle = g;
  c2d.fillRect(0, 0, size, size);
  const tex = new THREE.CanvasTexture(cvs);
  tex.colorSpace = THREE.SRGBColorSpace;
  return tex;
})();

/** One wavy noodle strand, ~1 unit long along Z, so `scale.setScalar(NOODLE_LENGTH)`
 * gives a strand of that length with proportional thickness. Three authored curves
 * so a flung handful never shows the same strand twice. */
function buildNoodleGeometry(seed: number): THREE.BufferGeometry {
  const rnd = lcg(seed);
  const wobbleA = 1.1 + rnd() * 1.4;
  const wobbleB = 0.9 + rnd() * 1.3;
  const ampX = 0.13 + rnd() * 0.11;
  const ampY = 0.08 + rnd() * 0.09;
  const pts: THREE.Vector3[] = [];
  const N = 8;
  for (let i = 0; i < N; i++) {
    const t = i / (N - 1);
    pts.push(new THREE.Vector3(
      Math.sin(t * Math.PI * wobbleA + seed) * ampX,
      Math.cos(t * Math.PI * wobbleB + seed) * ampY,
      t - 0.5,
    ));
  }
  return new THREE.TubeGeometry(new THREE.CatmullRomCurve3(pts), 20, NOODLE_THICKNESS / NOODLE_LENGTH, 5, false);
}
const noodleGeos = [buildNoodleGeometry(7919), buildNoodleGeometry(30011), buildNoodleGeometry(65449)];
let noodleGeoCursor = 0;
const nextNoodleGeo = (): THREE.BufferGeometry => noodleGeos[noodleGeoCursor++ % noodleGeos.length];

/** Small fixed pool of material instances, cycled round-robin — the same helper (and
 * the same reasoning) as `hamburger.ts` / `waterbottle.ts`: simultaneous elements
 * that fade independently each need their OWN `opacity`, so they need their own
 * `Material`, and a pool avoids allocating one per spawn.
 *
 * EVERY material here sets `depthWrite: false`. A `transparent: true` material still
 * writes depth by three.js default, and that has silently deleted VFX in this project
 * twice (splash particles culled under a puddle decal; prop shadows buried under
 * floor pads). Liquid effects are wide and flat and sit right in that danger zone. */
function materialPool<T extends THREE.Material>(size: number, build: () => T): () => T {
  const pool = Array.from({ length: size }, build);
  let i = 0;
  return () => pool[i++ % size];
}

const flatLiquid = (color: string, opacity: number): THREE.MeshBasicMaterial =>
  new THREE.MeshBasicMaterial({ color, transparent: true, opacity, depthWrite: false, side: THREE.DoubleSide });

/** Splat rim (deep, red-shifted) and splat core (hot, bright) — the two-tone ramp. */
const nextRimMat = materialPool(10, () => flatLiquid(BROTH_DEEP, 0.9));
const nextCoreMat = materialPool(10, () => flatLiquid(BROTH_HOT, 0.9));
/** Airborne broth: body and hot highlight. */
const nextBrothMat = materialPool(28, () => flatLiquid('#E8792A', 0.95));
const nextHotMat = materialPool(14, () => flatLiquid(BROTH_HOT, 0.95));
const nextNoodleMat = materialPool(16, () => flatLiquid(NOODLE_PALE, 1));
/**
 * PROJECTILE BODIES get their own pools, and nothing ever animates their opacity.
 *
 * They used to draw from the pools above — which are handed round-robin to a stream
 * of droplets and strands that each fade THEMSELVES to zero. A projectile in flight
 * therefore shared a material with a droplet spawned a moment later, and vanished
 * mid-flight the instant that droplet faded out. Three pellets shedding a drip every
 * ~0.06 s wrap a 28-slot pool in well under a second, so this was not a rare race.
 */
const nextBodyBrothMat = materialPool(6, () => flatLiquid('#E8792A', 1));
const nextBodyHotMat = materialPool(6, () => flatLiquid(BROTH_HOT, 1));
const nextBodyNoodleMat = materialPool(12, () => flatLiquid(NOODLE_PALE, 1));
/** Steam: NORMAL blending at low alpha, not additive — additive white over this
 * arena's bright warm floor blows straight to a clipped highlight and stops reading
 * as vapour at all. */
const nextSteamMat = materialPool(16, () => new THREE.SpriteMaterial({
  map: steamTex, color: STEAM_COLOR, transparent: true, opacity: 0.5, depthWrite: false,
}));
/** The one additive element: a brief hot flash at the moment of contact, so a hit
 * still PUNCHES rather than just oozing. */
const nextFlashMat = materialPool(8, () => new THREE.MeshBasicMaterial({
  color: '#FFF4DF', transparent: true, opacity: 0.9, depthWrite: false, blending: THREE.AdditiveBlending,
}));

// ─────────────────────────────────────────────────────────────────────────────
// Shared spawn helpers
// ─────────────────────────────────────────────────────────────────────────────

const _axis = new THREE.Vector3();
const _forward = new THREE.Vector3(0, 0, 1);
/** Point an object's local +Z along a world direction using a QUATERNION. Composing
 * `rotation.x` then `rotation.y` does not do this — Euler angles are intrinsic and
 * sequential, and the resulting mis-rotation is one of this project's recorded
 * "rendering but invisible" causes. */
function orientAlong(obj: THREE.Object3D, x: number, y: number, z: number): void {
  _axis.set(x, y, z);
  if (_axis.lengthSq() < 1e-9) return;
  _axis.normalize();
  obj.quaternion.setFromUnitVectors(_forward, _axis);
}

/**
 * One broth droplet on a ballistic arc, stretching along its own velocity as it goes
 * — a falling drop elongates, which is most of what separates "liquid" from "a small
 * ball" at this distance. Used by every hook in the file.
 */
function spawnDroplet(
  ctx: WeaponVfxCtx,
  ox: number, oy: number, oz: number,
  vx: number, vy: number, vz: number,
  scale: number,
  life: number,
  hot = false,
): void {
  const mesh = new THREE.Mesh(dropGeo, hot ? nextHotMat() : nextBrothMat());
  const mat = mesh.material as THREE.MeshBasicMaterial;
  // SET, never READ. Every droplet fades its own pooled material to ~0 and leaves it
  // there; reading that as the next droplet's starting opacity meant that once the
  // pool had wrapped once — about a second of firing — every droplet in the game
  // spawned already invisible. The drips are most of Soup's liquid vocabulary, so
  // this quietly deleted the effect's whole identity a second into every match.
  const baseOpacity = 0.95;
  mat.opacity = baseOpacity;
  mesh.position.set(ox, oy, oz);
  const gravity = -9.4;
  ctx.spawnTransient(mesh, life, (t, e) => {
    const y = oy + vy * e + 0.5 * gravity * e * e;
    // Stop at the floor and let it flatten out, rather than sinking through it.
    const grounded = y <= SPLAT_Y;
    mesh.position.set(ox + vx * e, grounded ? SPLAT_Y : y, oz + vz * e);
    const cvy = vy + gravity * e;
    if (grounded) {
      // Landed: splay flat and thin away.
      orientAlong(mesh, vx, 0, vz);
      mesh.scale.set(scale * 1.5, scale * 0.3, scale * 1.7);
    } else {
      orientAlong(mesh, vx, cvy, vz);
      const speed = Math.hypot(vx, cvy, vz);
      const stretch = 1 + Math.min(0.9, speed * 0.075);
      mesh.scale.set(scale / Math.sqrt(stretch), scale / Math.sqrt(stretch), scale * stretch);
    }
    mat.opacity = baseOpacity * (1 - t * t);
  });
}

/**
 * A rising steam wisp — grows, drifts up, thins out. The one cue in the roster that
 * says HOT, and (with the two-tone splat ramp) the main reason a soup spill can never
 * be confused with a cold terrain puddle.
 */
function spawnSteam(ctx: WeaponVfxCtx, x: number, y: number, z: number, radius: number, rise: number, life: number): void {
  const sprite = new THREE.Sprite(nextSteamMat());
  const mat = sprite.material;
  mat.opacity = 0;
  const drift = (Math.random() - 0.5) * radius * 1.6;
  const driftZ = (Math.random() - 0.5) * radius * 1.6;
  sprite.renderOrder = 9;
  sprite.position.set(x, y, z);
  sprite.scale.set(radius * 1.1, radius * 1.1, 1);
  ctx.spawnTransient(sprite, life, (t) => {
    const e = 1 - Math.pow(1 - t, 2);
    sprite.position.set(x + drift * e, y + rise * e, z + driftZ * e);
    const s = radius * (1.1 + e * 1.5);
    sprite.scale.set(s, s, 1);
    mat.opacity = 0.5 * Math.sin(Math.min(1, t * 1.3) * Math.PI);
  });
}

/**
 * The spill mark: a deep-rimmed outer sheet with a hot core inside it, spreading
 * outward from the point of contact and then thinning away.
 *
 * The spread curve is the "liquid" part. It is deliberately NOT the generic burst's
 * pop-and-shrink: the mark keeps creeping outward for the whole first third of its
 * life (fluid still running), holds, and then FADES IN PLACE at full size rather than
 * shrinking — liquid soaks in and evaporates, it does not retract. The hot core
 * spreads slower than the rim, so the ramp opens up as it settles, exactly the way a
 * thick liquid's thin leading edge outruns its body.
 */
function spawnSpillMark(ctx: WeaponVfxCtx, x: number, z: number, radius: number, life: number): void {
  const geo = nextSplatGeo();
  const yaw = Math.random() * Math.PI * 2;

  const rim = new THREE.Mesh(geo, nextRimMat());
  const rimMat = rim.material as THREE.MeshBasicMaterial;
  rim.rotation.y = yaw;               // flat XZ geometry: yaw alone, never a tipped plane
  rim.position.set(x, SPLAT_Y, z);
  rim.renderOrder = 6;
  rim.scale.setScalar(radius * 0.35);

  const core = new THREE.Mesh(geo, nextCoreMat());
  const coreMat = core.material as THREE.MeshBasicMaterial;
  core.rotation.y = yaw + 0.7;
  core.position.set(x, SPLAT_Y + 0.01, z);
  core.renderOrder = 7;
  core.scale.setScalar(radius * 0.18);

  const spread = (t: number): number => (t < 0.34 ? 1 - Math.pow(1 - t / 0.34, 2.2) : 1);

  // The mark must be VISIBLY GOING somewhere from the moment you see it. Held at
  // 0.9 opacity for most of its life (`1 - t^2.4` barely moves before t=0.6) it was a
  // flat opaque organic blob lying in the ground plane — which is the exact grammar
  // this arena's PERMANENT floor-spill decals are drawn in, and a blind critic duly
  // read it as terrain, and then as a burning-area hazard to walk around. Fading from
  // the first frame is what separates "an event happened here" from "this is floor".
  ctx.spawnTransient(rim, life, (t) => {
    rim.scale.setScalar(radius * THREE.MathUtils.lerp(0.35, 1, spread(t)));
    rimMat.opacity = 0.82 * (1 - Math.pow(t, 1.5));
  });
  ctx.spawnTransient(core, life * 0.86, (t) => {
    core.scale.setScalar(radius * THREE.MathUtils.lerp(0.18, 0.62, spread(t)));
    coreMat.opacity = 0.9 * (1 - Math.pow(t, 1.8));
  });
}

/**
 * The instant of contact: a small additive hot flash. Kept deliberately smaller than
 * the spill mark it sits on — the mass of this effect belongs on the GROUND, and an
 * airborne bloom over the target is exactly what made the old generic burst swallow
 * the character it was giving feedback about.
 *
 * It is, however, the ONLY high-value element in the whole effect, and it was pitched
 * so warm (`#FFD9A0`) and so short (0.13 s) that a blind critic looking at a frame
 * 0.18 s after the hit reported the impact as having no punch at all and read the
 * remaining ground mark as permanent terrain. Broth is orange, the soup fighter is
 * orange and this arena's floor is orange — a near-white core is the one thing in
 * this file that is not competing in that hue stack, so it has to survive long enough
 * to be seen.
 */
function spawnContactFlash(ctx: WeaponVfxCtx, x: number, y: number, z: number, radius: number): void {
  const flash = new THREE.Mesh(blobGeo, nextFlashMat());
  const mat = flash.material as THREE.MeshBasicMaterial;
  flash.position.set(x, y, z);
  flash.scale.set(radius, radius * 0.55, radius);
  ctx.spawnTransient(flash, 0.19, (t) => {
    const s = radius * THREE.MathUtils.lerp(0.9, 1.7, t);
    flash.scale.set(s, s * 0.5, s);
    mat.opacity = 0.9 * (1 - t) * (1 - t);
  });
}

/** A noodle strand thrown clear of the bowl, tumbling out and then DRAPING flat where
 * it lands. The drape is the point: strands lying limp across the floor is the read
 * for `effect: 'slow'` on both Noodle Toss and Soup Dump — you are tangled up in it. */
function spawnNoodleStrand(
  ctx: WeaponVfxCtx,
  ox: number, oy: number, oz: number,
  vx: number, vy: number, vz: number,
  length: number,
  life: number,
): void {
  const mesh = new THREE.Mesh(nextNoodleGeo(), nextNoodleMat());
  const mat = mesh.material as THREE.MeshBasicMaterial;
  mat.opacity = 1;                     // SET, never read — see `spawnDroplet`.
  mesh.position.set(ox, oy, oz);
  mesh.scale.setScalar(length);
  const gravity = -9.4;
  const whip = 6 + Math.random() * 6;
  const flatYaw = Math.atan2(vx, vz) + (Math.random() - 0.5) * 0.8;
  ctx.spawnTransient(mesh, life, (t, e) => {
    const y = oy + vy * e + 0.5 * gravity * e * e;
    if (y <= SPLAT_Y + 0.02) {
      // Landed — lie flat on the floor, splayed roughly along the throw direction.
      mesh.position.set(ox + vx * e, SPLAT_Y + 0.02, oz + vz * e);
      mesh.quaternion.identity();
      mesh.rotation.set(0, flatYaw, 0);
      mesh.scale.set(length, length * 0.55, length);
    } else {
      mesh.position.set(ox + vx * e, y, oz + vz * e);
      orientAlong(mesh, vx, vy + gravity * e, vz);
      mesh.rotateZ(e * whip);           // strand whipping about its own long axis
    }
    mat.opacity = 1 - Math.pow(t, 3);
  });
}

// ─────────────────────────────────────────────────────────────────────────────
// Soup Splash — ranged close, 3 pellets, 3 dmg each
// ─────────────────────────────────────────────────────────────────────────────

/** A thrown gout of broth: one stretched head with a hot cap, trailed by two beads
 * that have already begun to separate from it. A liquid in flight is not one object
 * — it is a mass that is coming apart, and showing that from frame one is what stops
 * this reading as another tinted ball. */
function buildBrothGout(color: string): THREE.Group {
  const group = new THREE.Group();

  const head = new THREE.Mesh(dropGeo, nextBodyBrothMat());
  (head.material as THREE.MeshBasicMaterial).color.set(color);
  head.scale.setScalar(BLOB_RADIUS);
  head.position.z = BLOB_RADIUS * 0.4;
  group.add(head);

  const cap = new THREE.Mesh(blobGeo, nextBodyHotMat());
  cap.scale.setScalar(BLOB_RADIUS * 0.5);
  cap.position.set(BLOB_RADIUS * 0.25, BLOB_RADIUS * 0.4, BLOB_RADIUS * 0.85);
  group.add(cap);

  for (let i = 0; i < 2; i++) {
    const bead = new THREE.Mesh(dropGeo, nextBodyBrothMat());
    (bead.material as THREE.MeshBasicMaterial).color.set(color);
    const s = BLOB_RADIUS * (0.44 - i * 0.13);
    bead.scale.setScalar(s);
    bead.position.set(
      (Math.random() - 0.5) * BLOB_RADIUS * 0.5,
      (Math.random() - 0.5) * BLOB_RADIUS * 0.4,
      -BLOB_RADIUS * (1.05 + i * 0.95),
    );
    group.add(bead);
  }
  group.userData.__head = head;
  return group;
}

const Splash = {
  projectile(ctx: WeaponVfxCtx): THREE.Object3D {
    const obj = buildBrothGout(ctx.color);
    obj.position.copy(ctx.position);
    return obj;
  },

  /** No tumble — a liquid has no rigid body to tumble. Instead it PULSES along its
   * own travel axis (surface tension fighting air drag) and wags slightly side to
   * side, and it keeps losing drips it cannot hold on to. */
  trail(ctx: WeaponVfxCtx): void {
    const obj = ctx.object;
    if (!obj) return;
    const dt = ctx.dt ?? 0;

    const phase = ((obj.userData.__phase as number | undefined) ?? Math.random() * 6) + dt * 17;
    obj.userData.__phase = phase;
    const stretch = 1 + Math.sin(phase) * 0.22;
    obj.scale.set(1 / Math.sqrt(stretch), 1 / Math.sqrt(stretch), stretch);
    // Sway is applied to the HEAD child, not to the group — the group's `rotation.y`
    // is overwritten every frame by `game/vfx.ts`'s face-travel default, so anything
    // written there is lost, and stacking Euler terms on it is the flat-plane trap.
    const head = obj.userData.__head as THREE.Mesh | undefined;
    if (head) head.position.x = Math.sin(phase * 0.55) * BLOB_RADIUS * 0.3;

    const drip = ((obj.userData.__drip as number | undefined) ?? 0.04) - dt;
    if (drip <= 0) {
      obj.userData.__drip = 0.055 + Math.random() * 0.045;
      spawnDroplet(
        ctx,
        ctx.position.x - ctx.direction.x * BLOB_RADIUS * 1.6,
        ctx.position.y - BLOB_RADIUS * 0.4,
        ctx.position.z - ctx.direction.z * BLOB_RADIUS * 1.6,
        -ctx.direction.x * 0.5 + (Math.random() - 0.5) * 0.5,
        -0.3 - Math.random() * 0.4,
        -ctx.direction.z * 0.5 + (Math.random() - 0.5) * 0.5,
        DROP_RADIUS * (0.5 + Math.random() * 0.4),
        0.3,
      );
    } else {
      obj.userData.__drip = drip;
    }

    const steam = ((obj.userData.__steam as number | undefined) ?? 0.09) - dt;
    if (steam <= 0) {
      obj.userData.__steam = 0.13 + Math.random() * 0.09;
      spawnSteam(ctx, ctx.position.x, ctx.position.y + BLOB_RADIUS, ctx.position.z, CH * 0.075, CH * 0.14, 0.34);
    } else {
      obj.userData.__steam = steam;
    }
  },

  /** Three of these land nearly together (3-pellet spread), so this is the SMALLEST
   * effect in the file by a wide margin — mark, a short crown of droplets, one wisp.
   * Three overlapping copies still have to leave the character readable. */
  impact(ctx: WeaponVfxCtx): void {
    const { x, z } = ctx.position;

    spawnContactFlash(ctx, x, ctx.position.y * 0.55, z, CH * 0.19);
    spawnSpillMark(ctx, x, z, SPLASH_MARK_RADIUS, 0.38);

    // The crown: droplets thrown up and outward from the contact ring, not radial
    // debris — a liquid hitting a surface throws a ring of small drops UP first and
    // outward second, the opposite emphasis from flying shards.
    for (let i = 0; i < 6; i++) {
      const a = (i / 6) * Math.PI * 2 + Math.random() * 0.6;
      const out = 1.5 + Math.random() * 1.4;
      spawnDroplet(
        ctx,
        x + Math.cos(a) * SPLASH_MARK_RADIUS * 0.3, ctx.position.y * 0.5, z + Math.sin(a) * SPLASH_MARK_RADIUS * 0.3,
        Math.cos(a) * out, 2.1 + Math.random() * 1.2, Math.sin(a) * out,
        DROP_RADIUS * (0.7 + Math.random() * 0.5),
        0.34 + Math.random() * 0.12,
        i % 3 === 0,
      );
    }

    spawnSteam(ctx, x, SPLAT_Y + CH * 0.05, z, CH * 0.14, CH * 0.3, 0.5);
  },

  /** A forward SLOSH out of the bowl, not a muzzle flash: the broth's leading lip
   * pushes out ahead of the character and a few drops break off it. */
  cast(ctx: WeaponVfxCtx): void {
    const d = ctx.direction;
    const lip = new THREE.Mesh(dropGeo, nextHotMat());
    const mat = lip.material as THREE.MeshBasicMaterial;
    lip.position.copy(ctx.position);
    orientAlong(lip, d.x, -0.25, d.z);
    ctx.spawnTransient(lip, 0.16, (t) => {
      lip.position.set(
        ctx.position.x + d.x * t * CH * 0.2,
        ctx.position.y - t * CH * 0.07,
        ctx.position.z + d.z * t * CH * 0.2,
      );
      const s = CH * (0.05 + t * 0.05);
      lip.scale.set(s * 1.5, s * 0.8, s * (1.6 + t));
      mat.opacity = 0.95 * (1 - t * t);
    });

    for (let i = 0; i < 4; i++) {
      const jx = (Math.random() - 0.5) * 0.8;
      const jz = (Math.random() - 0.5) * 0.8;
      spawnDroplet(
        ctx,
        ctx.position.x, ctx.position.y, ctx.position.z,
        d.x * (1.6 + Math.random()) + jx, 0.7 + Math.random() * 0.9, d.z * (1.6 + Math.random()) + jz,
        DROP_RADIUS * (0.5 + Math.random() * 0.4),
        0.3,
      );
    }
    spawnSteam(ctx, ctx.position.x, ctx.position.y, ctx.position.z, CH * 0.09, CH * 0.2, 0.34);
  },
};

// ─────────────────────────────────────────────────────────────────────────────
// Noodle Toss — ranged long, 5 dmg, `effect: 'slow'`
// ─────────────────────────────────────────────────────────────────────────────

/** A wad of noodles slung out of the bowl: three strands in a loose tangle, still
 * dripping broth. Solid enough to read as a thrown OBJECT (which it is, unlike the
 * Splash gout), but never rigid. */
function buildNoodleWad(color: string): THREE.Group {
  const group = new THREE.Group();
  const strands: THREE.Mesh[] = [];
  for (let i = 0; i < 3; i++) {
    const strand = new THREE.Mesh(nextNoodleGeo(), nextBodyNoodleMat());
    (strand.material as THREE.MeshBasicMaterial).color.set(color);
    strand.scale.setScalar(NOODLE_LENGTH * 0.62);
    strand.rotation.set(Math.random() * Math.PI, Math.random() * Math.PI, Math.random() * Math.PI);
    strand.position.set(
      (Math.random() - 0.5) * NOODLE_LENGTH * 0.22,
      (Math.random() - 0.5) * NOODLE_LENGTH * 0.22,
      (Math.random() - 0.5) * NOODLE_LENGTH * 0.22,
    );
    group.add(strand);
    strands.push(strand);
  }
  const broth = new THREE.Mesh(blobGeo, nextBodyBrothMat());
  broth.scale.setScalar(BLOB_RADIUS * 0.62);
  group.add(broth);
  group.userData.__strands = strands;
  return group;
}

const Noodle = {
  projectile(ctx: WeaponVfxCtx): THREE.Object3D {
    const obj = buildNoodleWad(ctx.color);
    obj.position.copy(ctx.position);
    return obj;
  },

  /** Each strand whips on its OWN axis at its own rate (a tangle is not a rigid
   * body), and the wad flings broth off itself the whole way — the drips are what
   * keep this in Soup's liquid vocabulary instead of reading as a thrown rope. */
  trail(ctx: WeaponVfxCtx): void {
    const obj = ctx.object;
    if (!obj) return;
    const dt = ctx.dt ?? 0;
    const strands = obj.userData.__strands as THREE.Mesh[] | undefined;
    if (strands) {
      for (let i = 0; i < strands.length; i++) {
        const s = strands[i];
        s.rotation.x += dt * (3.4 + i * 1.7);
        s.rotation.z += dt * (2.1 + i * 1.1);
      }
    }

    const drip = ((obj.userData.__drip as number | undefined) ?? 0.06) - dt;
    if (drip <= 0) {
      obj.userData.__drip = 0.085 + Math.random() * 0.06;
      spawnDroplet(
        ctx,
        ctx.position.x, ctx.position.y - NOODLE_LENGTH * 0.2, ctx.position.z,
        (Math.random() - 0.5) * 0.7, -0.2 - Math.random() * 0.5, (Math.random() - 0.5) * 0.7,
        DROP_RADIUS * (0.45 + Math.random() * 0.35),
        0.32,
      );
    } else {
      obj.userData.__drip = drip;
    }
  },

  /** Noodles do not shatter or splatter — they LAND and lie there. Strands splay out
   * and drape flat around the hit, which is the visual argument for this weapon's
   * `slow`: the target is standing in a tangle. The broth mark underneath keeps it
   * unmistakably Soup's. */
  impact(ctx: WeaponVfxCtx): void {
    const { x, z } = ctx.position;

    spawnContactFlash(ctx, x, ctx.position.y * 0.55, z, CH * 0.18);
    spawnSpillMark(ctx, x, z, NOODLE_MARK_RADIUS, 0.48);

    for (let i = 0; i < 5; i++) {
      const a = (i / 5) * Math.PI * 2 + Math.random() * 0.7;
      const out = 1.3 + Math.random() * 1.2;
      spawnNoodleStrand(
        ctx,
        x, ctx.position.y * 0.7, z,
        Math.cos(a) * out, 1.5 + Math.random() * 1.1, Math.sin(a) * out,
        NOODLE_LENGTH * (0.7 + Math.random() * 0.45),
        0.7 + Math.random() * 0.15,
      );
    }

    for (let i = 0; i < 4; i++) {
      const a = Math.random() * Math.PI * 2;
      const out = 1.2 + Math.random() * 1.3;
      spawnDroplet(
        ctx,
        x, ctx.position.y * 0.6, z,
        Math.cos(a) * out, 1.8 + Math.random() * 1.1, Math.sin(a) * out,
        DROP_RADIUS * (0.6 + Math.random() * 0.5),
        0.36,
        i === 0,
      );
    }

    spawnSteam(ctx, x, SPLAT_Y + CH * 0.05, z, CH * 0.15, CH * 0.32, 0.55);
  },

  /** A strand whipped up out of the bowl and flung forward, shedding broth. */
  cast(ctx: WeaponVfxCtx): void {
    const d = ctx.direction;
    spawnNoodleStrand(
      ctx,
      ctx.position.x, ctx.position.y, ctx.position.z,
      d.x * 1.4, 1.5, d.z * 1.4,
      NOODLE_LENGTH * 0.7,
      0.26,
    );
    for (let i = 0; i < 3; i++) {
      spawnDroplet(
        ctx,
        ctx.position.x, ctx.position.y, ctx.position.z,
        d.x * 1.2 + (Math.random() - 0.5) * 0.8, 0.9 + Math.random() * 0.7, d.z * 1.2 + (Math.random() - 0.5) * 0.8,
        DROP_RADIUS * 0.55,
        0.28,
      );
    }
  },
};

// ─────────────────────────────────────────────────────────────────────────────
// Soup Dump — melee heavy, 90° cone, 16 dmg, `effect: 'slow'`, the special
// ─────────────────────────────────────────────────────────────────────────────
//
// "Tips himself over onto an enemy, pouring all his soup and noodles." This is the
// only place in the roster where WEIGHT and VOLUME are the brief, so this is the one
// effect that gets built out of many overlapping bodies instead of a few clean ones:
// a dozen gouts falling together read as one mass of liquid, where three clean ones
// read as three thrown balls no matter how big you make them.
//
// It is also the largest thing Soup owns, which makes it the one most at risk of
// swallowing the character. The budget is held by putting the mass on the GROUND —
// a 2.6 m mark lying flat costs the character nothing, where a 2.6 m airborne bloom
// erases it. Airborne elements stay droplet-sized throughout.

/** The pour, sized to the weapon's REAL reach. `Weapon.range` is in world units and
 * `wu()` is the only sanctioned conversion (`src/units.ts`), so the curtain always
 * lands inside the actual 90° melee cone `game/vfx.ts` draws for this swing — if the
 * reach ladder in `rules.ts` moves again, the visual moves with it. */
const Dump = {
  cast(ctx: WeaponVfxCtx): void {
    const d = ctx.direction;
    // `Weapon.range` is optional in the type (self-cast weapons have none); Soup Dump
    // always has one, and `REACH.meleeHeavy` is the value it is declared with.
    const reach = wu(ctx.weapon.range ?? REACH.meleeHeavy); // 84 wu -> 4.2 m
    const ox = ctx.position.x, oy = ctx.position.y, oz = ctx.position.z;
    const px = -d.z, pz = d.x;                   // in-plane perpendicular, for the sheet's width

    // ── The curtain: many overlapping gouts leaving the bowl together ────────────
    for (let i = 0; i < 13; i++) {
      const across = (i / 12 - 0.5) * 2;                       // -1..1 across the pour
      const lateral = across * reach * 0.16 + (Math.random() - 0.5) * reach * 0.06;
      const fwd = 1.1 + Math.random() * 1.5 - Math.abs(across) * 0.35;
      const scale = CH * (0.055 + Math.random() * 0.055) * (1 - Math.abs(across) * 0.25);
      spawnDroplet(
        ctx,
        ox + px * lateral, oy + CH * (0.05 + Math.random() * 0.12), oz + pz * lateral,
        d.x * fwd + px * across * 0.35, 0.5 + Math.random() * 0.7, d.z * fwd + pz * across * 0.35,
        scale,
        0.42 + Math.random() * 0.16,
        i % 4 === 0,
      );
    }

    // ── The sheet: three wide thin slabs falling as one, so the curtain has a
    // CONTINUOUS body between the gouts rather than reading as a shotgun of blobs.
    for (let i = 0; i < 3; i++) {
      const slab = new THREE.Mesh(blobGeo, i === 1 ? nextHotMat() : nextBrothMat());
      const mat = slab.material as THREE.MeshBasicMaterial;
      const lead = 0.35 + i * 0.5;
      const sx = ox + d.x * reach * 0.1, sz = oz + d.z * reach * 0.1;
      const sy = oy + CH * 0.1;
      slab.position.set(sx, sy, sz);
      const life = 0.4;
      ctx.spawnTransient(slab, life, (t) => {
        const e = t * t;                            // gravity-ish acceleration downward
        slab.position.set(
          sx + d.x * lead * reach * 0.28 * t,
          Math.max(SPLAT_Y, sy - e * CH * 0.8),
          sz + d.z * lead * reach * 0.28 * t,
        );
        // Widens across the pour and thins vertically — a falling sheet spreads.
        slab.scale.set(
          CH * (0.13 + t * 0.1),
          CH * (0.13 - t * 0.09),
          CH * (0.13 + t * 0.1),
        );
        mat.opacity = 0.85 * (1 - Math.pow(t, 1.7));
      });
    }

    // ── "...and his noodles." Three strands tip out with the broth.
    for (let i = 0; i < 3; i++) {
      const across = (i - 1) * 0.5;
      spawnNoodleStrand(
        ctx,
        ox + px * across * reach * 0.1, oy, oz + pz * across * reach * 0.1,
        d.x * (1.6 + Math.random()) + px * across, 0.9 + Math.random() * 0.6, d.z * (1.6 + Math.random()) + pz * across,
        NOODLE_LENGTH * (0.8 + Math.random() * 0.4),
        0.6,
      );
    }

    // ── The tongue: broth running forward along the floor inside the melee cone.
    // Stretched along the facing rather than circular, so it reads as POURED (it has
    // a direction) instead of as a puddle that was always there.
    const tongueGeo = nextSplatGeo();
    const tongue = new THREE.Mesh(tongueGeo, nextRimMat());
    const tongueMat = tongue.material as THREE.MeshBasicMaterial;
    tongue.position.set(ox + d.x * reach * 0.26, SPLAT_Y, oz + d.z * reach * 0.26);
    tongue.rotation.y = Math.atan2(d.x, d.z);
    tongue.renderOrder = 6;
    ctx.spawnTransient(tongue, 0.6, (t) => {
      const grow = t < 0.45 ? 1 - Math.pow(1 - t / 0.45, 2) : 1;
      tongue.scale.set(reach * 0.13 * grow + 0.05, 1, reach * 0.3 * grow + 0.05);
      tongueMat.opacity = 0.8 * (1 - Math.pow(t, 2.2));
    });

    for (let i = 0; i < 3; i++) {
      spawnSteam(
        ctx,
        ox + d.x * reach * (0.12 + i * 0.13), SPLAT_Y + CH * 0.06, oz + d.z * reach * (0.12 + i * 0.13),
        CH * 0.16, CH * 0.42, 0.6,
      );
    }
  },

  /** The landing. All the weight is here: a mass compresses down onto the floor, the
   * spill runs out to 2.6 m, and steam comes off the whole thing. */
  impact(ctx: WeaponVfxCtx): void {
    const { x, z } = ctx.position;

    // The compression: a tall column of broth that slams down and flattens out in
    // 0.14 s. This is what sells MASS — the eye reads the vertical collapse as
    // something heavy arriving, which a burst that only expands sideways cannot do.
    const column = new THREE.Mesh(blobGeo, nextHotMat());
    const colMat = column.material as THREE.MeshBasicMaterial;
    column.position.set(x, SPLAT_Y, z);
    ctx.spawnTransient(column, 0.16, (t) => {
      const e = 1 - Math.pow(1 - t, 2.6);
      const h = CH * THREE.MathUtils.lerp(0.42, 0.05, e);
      const r = CH * THREE.MathUtils.lerp(0.13, 0.4, e);
      column.position.set(x, SPLAT_Y + h * 0.5, z);
      column.scale.set(r, h, r);
      colMat.opacity = 0.95 * (1 - Math.pow(t, 2.5));
    });

    spawnContactFlash(ctx, x, ctx.position.y * 0.5, z, CH * 0.30);
    spawnSpillMark(ctx, x, z, DUMP_MARK_RADIUS, 0.62);

    // A big crown, thrown wide. Individually these stay droplet-sized — the volume
    // read comes from COUNT, not from any one element being large.
    for (let i = 0; i < 11; i++) {
      const a = (i / 11) * Math.PI * 2 + Math.random() * 0.5;
      const out = 2.2 + Math.random() * 2.2;
      spawnDroplet(
        ctx,
        x + Math.cos(a) * CH * 0.12, SPLAT_Y + CH * 0.1, z + Math.sin(a) * CH * 0.12,
        Math.cos(a) * out, 2.6 + Math.random() * 1.8, Math.sin(a) * out,
        DROP_RADIUS * (0.9 + Math.random() * 0.8),
        0.45 + Math.random() * 0.15,
        i % 3 === 0,
      );
    }

    for (let i = 0; i < 4; i++) {
      const a = (i / 4) * Math.PI * 2 + Math.random();
      const out = 1.5 + Math.random() * 1.3;
      spawnNoodleStrand(
        ctx,
        x, SPLAT_Y + CH * 0.15, z,
        Math.cos(a) * out, 2 + Math.random() * 1.2, Math.sin(a) * out,
        NOODLE_LENGTH * (0.85 + Math.random() * 0.45),
        0.85,
      );
    }

    // Steam column at the centre plus a low ring around it — a big hot spill boils
    // off for a moment. This is the loudest "HOT LIQUID, not a hazard puddle" cue in
    // the file and the special is where it can afford to be loud.
    spawnSteam(ctx, x, SPLAT_Y + CH * 0.05, z, CH * 0.22, CH * 0.6, 0.8);
    for (let i = 0; i < 3; i++) {
      const a = (i / 3) * Math.PI * 2 + Math.random();
      spawnSteam(
        ctx,
        x + Math.cos(a) * DUMP_MARK_RADIUS * 0.55, SPLAT_Y + CH * 0.03, z + Math.sin(a) * DUMP_MARK_RADIUS * 0.55,
        CH * 0.14, CH * 0.4, 0.7,
      );
    }
  },
};

export const soupWeaponVfx: CharacterWeaponVfxMap = {
  Splash,
  Noodle,
  Dump,
};
