/**
 * Sushi weapon VFX.
 *
 * ── Sushi's identity: THE CUT, THE ROLL, THE GRAIN, THE SHEET ────────────────
 * Sushi is the WEAKEST SILHOUETTE IN THE CAST — the roster silhouette test named it,
 * with Burrito and Water Bottle, as a character that collapses into a generic blob
 * when you remove its colour. That is the single most important fact about this file:
 * every other weapon set here can afford effects that merely *don't clash*, and this
 * one has to actively do identity work its character cannot do for itself.
 *
 * So it takes the four most legible signs of sushi and uses nothing else:
 *
 *   THE CUT    A dead-straight, hard-edged, near-white blade line that WIPES across
 *              a hit in one frame. Nothing else in the roster draws a straight line
 *              of zero curvature, and it is COOL-hued — the only cool element in a
 *              relentlessly warm arena, which is worth more contrast than any amount
 *              of brightness. It fires on both melee and the special, so a Sushi hit
 *              is identifiable from the blade alone.
 *   THE ROLL   A maki round presented FACE UP: nori wall, rice ring, salmon centre.
 *              This is the picture everyone has of sushi, and a top-down camera is
 *              the perfect angle for it.
 *   THE GRAIN  Rice. Small, plural, warm-white, and it BOUNCES — grains scatter and
 *              settle, they do not splash (`soup.ts`) or shatter (`waterbottle.ts`).
 *   THE SHEET  Nori. A hard-edged near-black RECTANGLE that ripples along its length.
 *
 * How this stays clear of everything already claimed: `donut.ts` owns rings (the roll
 * is a filled disc with a dark rim, not a hoop), `taco.ts` owns curved shell tiles,
 * `soup.ts` owns liquid and vapour, `pizza.ts` owns flat plates SPINNING ABOUT UP (the
 * nori sheet never spins — it undulates along its length like a ribbon in water, and
 * it is near-black where every Pizza plate is pale and warm), `lollipop.ts` owns
 * wrapped candy stripes and a boundary arc, and `hotdog.ts` owns zig-zag polylines.
 *
 * Weapon keys (`game/rules.ts` -> `CHARACTERS.sushi.weapons`), all four converted:
 *   `'Rice'`     Rice Spray   — `rangedClose`, 5 pellets → a clutch of flying grains
 *   `'Seaweed'`  Seaweed Bait — `rangedMid`, `slow`      → a rippling nori sheet
 *   `'Fish'`     Fish Pile    — `meleeStrong`, cone 150  → slabs of salmon + the cut
 *   `'Catch'`    Big Catch    — `rangedMax`, 3x homing   → a roll that grows, then is
 *                                                          SLICED IN HALF on impact
 *
 * ── THE FOUR DECISIONS THIS FILE IS BUILT AROUND ─────────────────────────────
 *
 * 1. **Flat things are authored face-up and rotated about world Y only.** Every flat
 *    piece here (nori sheet, blade, salmon slab, ground mat) has its lay-flat rotation
 *    baked into the BUFFER at module scope and is only ever yawed. A single rotation
 *    about world up cannot tip a face-up plate edge-on, so the "compose rotation.x
 *    then rotation.y and watch the plane vanish from a top-down camera" trap has no
 *    way to fire. The one place a second axis is genuinely wanted — the nori sheet's
 *    ripple — puts it on CHILD segments inside the yawed parent, which the scene graph
 *    composes in the correct order by construction, and caps it at ±0.42 rad, where a
 *    plate still presents 91% of its area.
 *
 * 2. **Nothing spawns inside the target.** `impact()` fires at the target's CENTRE,
 *    and on this cast the widest part of a fighter is its HEAD — Hamburger's bun is
 *    ~1.2 m across and Donut's glazed mass ~1.5 m. An effect born there spends its
 *    brightest frames buried in that head where a 58°-pitched camera hides it
 *    completely; that is what cost `donut.ts` its rings and `pizza.ts` its entire
 *    cheese sheet. So every piece of debris launches from a contact RING already clear
 *    of the silhouette, and the two halves of a cut roll START apart and slide FURTHER
 *    apart, so they are outside the body on their very first frame.
 *
 * 3. **Pooled materials are SET, never READ.** A helper that reads its starting
 *    opacity off a pooled material inherits whatever the previous user faded it to, so
 *    once the pool wraps — about a second of sustained firing, and Rice Spray fires
 *    five pellets on a 700 ms cooldown, so it wraps fast — every particle spawns
 *    already invisible. Every spawn below assigns `opacity` (and `color`) outright.
 *    Separately, **projectile bodies never draw from an animated pool**: they use
 *    plain opaque singletons nothing ever fades, which removes the failure mode
 *    structurally rather than by discipline.
 *
 * 4. **Hard-edged and near-opaque, never additive.** Additive white over this arena's
 *    bright warm floor is a wash in the same value band as the terracotta under it,
 *    not a core — a blind critic measured the arena's own static floor decal as having
 *    more contrast than a combat hit. There is not one additive material in this file.
 *    The blade gets its punch from being near-white, COOL and hard-edged against a
 *    warm floor, and the nori from being genuinely dark.
 *
 * ── Scale discipline ─────────────────────────────────────────────────────────
 * Every size is a fraction of `CHARACTER_HEIGHT`. The generic burst is 1.74 m typical
 * / 3.0 m cap against a 2.10 m fighter; finished weapons here peak at 1.21 m (pizza)
 * and 2.22 m (soup). The widest thing in this file is Big Catch's cut, whose blade
 * reaches 2.20 m — a 0.13 m-wide line, so it spans the fighter without covering it.
 */

import * as THREE from 'three';
import { FLIGHT_MS, PALETTE, type Weapon } from '../../game/rules';
import { CHARACTER_HEIGHT } from '../../units';
import type { CharacterWeaponVfxMap, WeaponVfxCtx } from './types';

// ─────────────────────────────────────────────────────────────────────────────
// Palette — mirrors the module-private consts in `src/characters/sushi.ts` so the
// thrown food matches the fighter throwing it.
// ─────────────────────────────────────────────────────────────────────────────

/** Warm-white sticky rice, not clinical pure white — `rules.ts` gives Rice Spray
 * `color: '#FFFFFF'`, and a pure-white grain on a pale warm floor loses its edge. The
 * character file made the same call for the same reason. */
const RICE = '#FFFDF6';
const RICE_SHADE = '#E4D7BE';
/** Near-black with a green cast. `PALETTE.nori` is a neutral '#2B2B2B'; a touch of
 * green is what stops a dark rectangle on a warm floor reading as a cast shadow. */
const NORI = '#22301F';
const NORI_LIT = '#3E5B33';
const SALMON = PALETTE.salmon;   // '#F4A261'
const SALMON_DEEP = '#B85B26';
const SALMON_FAT = '#FFEEDD';    // the pale striations across a slice of fish
/** The blade. COOL near-white — the only cool hue in this file and very nearly the
 * only one in the arena, which is where its contrast comes from. */
const BLADE = '#F2FBFF';
const BLADE_HALO = '#8FD3E8';

const CH = CHARACTER_HEIGHT;
const TWO_PI = Math.PI * 2;

/**
 * Ground height for this file's flat marks.
 *
 * The ground stack is crowded and every layer of it is opaque or depth-writing: floor
 * pads 0.045–0.048, seams 0.062, baked shadows 0.068–0.07, prop kicks 0.08, arena
 * decals 0.15, `game/vfx.ts`'s splats 0.17 and Sticky-Trail marks 0.19, its melee arcs
 * and impact rings 0.24. Finished weapon files sit at 0.26–0.29.
 */
const GROUND_Y = 0.29;

// ─────────────────────────────────────────────────────────────────────────────
// Geometry.
//
// EVERY unit geometry below spans exactly 1 x 1 in XZ (or 1 x 1 x 1), so a mesh's
// `scale` is literally its size in METRES. That convention is not cosmetic: authoring
// a shape at some incidental width and then setting `scale.x` as though it were a
// width is how the first build of `hotdog.ts` shipped every ribbon at a third of its
// intended size — 3 px on screen, rendering perfectly, reading as nothing.
//
// The px/m these were all checked against, measured off a rendered frame rather than
// derived: a 2.10 m fighter is ~100 px tall at shipped framing (~10.5% of frame
// height), so **1 m ≈ 48 px**. Anything under ~0.12 m is a 6 px sliver.
// ─────────────────────────────────────────────────────────────────────────────

function flatShapeGeo(shape: THREE.Shape, curveSegments = 8): THREE.BufferGeometry {
  const geo = new THREE.ShapeGeometry(shape, curveSegments);
  geo.rotateX(-Math.PI / 2);
  return geo;
}

/** A flat quad, face-up, 1 x 1 — nori segment, ground mat, salmon striation. */
const quadGeo = (() => {
  const geo = new THREE.PlaneGeometry(1, 1);
  geo.rotateX(-Math.PI / 2);
  return geo;
})();

/**
 * THE BLADE, origined at one END (spans z ∈ [0, 1], x ∈ [−0.5, 0.5]).
 *
 * Origined at an end rather than centred so a parent's `scale.z` WIPES the cut on from
 * where the knife entered, which is what makes it read as a slice happening rather
 * than a bar appearing. A lens, not a rectangle: a cut is thin where it starts and
 * ends and widest in the middle.
 */
const bladeGeo = (() => {
  const s = new THREE.Shape();
  s.moveTo(0, 0);
  s.quadraticCurveTo(1, 0.5, 0, 1);   // control x=1 puts the widest point at x=0.5
  s.quadraticCurveTo(-1, 0.5, 0, 0);
  const geo = flatShapeGeo(s, 10);
  geo.translate(0, 0, 1);             // shape +Y maps to world −Z; put the span in [0,1]
  return geo;
})();

/** A slab of fish: a rounded rectangle, 1 x 1, face-up. Longer than it is wide once
 * scaled, with softened corners — a cut slice of salmon, not a card. */
const slabGeo = (() => {
  const r = 0.22;
  const s = new THREE.Shape();
  s.moveTo(-0.5 + r, -0.5);
  s.lineTo(0.5 - r, -0.5);
  s.quadraticCurveTo(0.5, -0.5, 0.5, -0.5 + r);
  s.lineTo(0.5, 0.5 - r);
  s.quadraticCurveTo(0.5, 0.5, 0.5 - r, 0.5);
  s.lineTo(-0.5 + r, 0.5);
  s.quadraticCurveTo(-0.5, 0.5, -0.5, 0.5 - r);
  s.lineTo(-0.5, -0.5 + r);
  s.quadraticCurveTo(-0.5, -0.5, -0.5 + r, -0.5);
  return flatShapeGeo(s, 6);
})();

/** A rice grain: an ellipsoid one unit long on Z and 0.44 wide, so `setScalar(len)`
 * gives a grain `len` metres long with a believable 2.3:1 rice proportion. The one
 * genuinely 3-D particle in the file — rice is a solid little object and reads as one
 * only if it catches the light on a curve. */
const riceGeo = (() => {
  const geo = new THREE.SphereGeometry(0.5, 7, 5);
  geo.scale(0.44, 0.44, 1);
  return geo;
})();

// ── The maki roll: unit diameter 1, unit height 1, axis along Y ───────────────
// Standing UP, so the camera looks straight into the cut face. That is the money
// shot for sushi and the reason this projectile does not fly nose-first like every
// other thrown food in the roster: the identifying picture is the ROUND FACE, and
// presenting it costs nothing because a shape spun about world up can never tip.
const rollWallGeo = new THREE.CylinderGeometry(0.5, 0.5, 1, 20, 1, true);
const rollFaceGeo = (() => {
  const geo = new THREE.CircleGeometry(0.5, 20);
  geo.rotateX(-Math.PI / 2);
  return geo;
})();
/** Half a roll, split down the x=0 plane, keeping the x ≥ 0 side. The wall's
 * `thetaStart: 0` and the face's `thetaStart: -PI/2` are what put both halves on the
 * SAME side; getting one of them wrong gives a roll whose rice cap faces the opposite
 * way from its nori wall, which is unmistakable once rendered and invisible in code. */
const halfWallGeo = new THREE.CylinderGeometry(0.5, 0.5, 1, 12, 1, true, 0, Math.PI);
const halfFaceGeo = (() => {
  const geo = new THREE.CircleGeometry(0.5, 12, -Math.PI / 2, Math.PI);
  geo.rotateX(-Math.PI / 2);
  return geo;
})();
/** The exposed rice face along the cut: a plane at x=0 spanning z ∈ [−0.5, 0.5] and
 * y ∈ [−0.5, 0.5], facing −X. `scale.set(_, height, diameter)`. */
const cutFaceGeo = (() => {
  const geo = new THREE.PlaneGeometry(1, 1);
  geo.rotateY(-Math.PI / 2);
  return geo;
})();

// ── Projectile sizes, as fractions of a fighter ───────────────────────────────
// Sized against what they REPLACE: `game/vfx.ts`'s generic projectile is a
// `SphereGeometry(wu(10))`, a 1.0 m ball. A bespoke projectile smaller than the
// generic one it improves on is a regression however characterful it is.
const GRAIN_LEN = CH * 0.155;   // 0.33 m long, 0.14 m across — ~16 x 7 px
const NORI_LEN = CH * 0.46;     // 0.97 m along travel
const NORI_WID = CH * 0.30;     // 0.63 m across
const ROLL_R = CH * 0.185;      // 0.39 m radius -> 0.78 m across
const ROLL_H = CH * 0.20;       // 0.42 m tall

// ─────────────────────────────────────────────────────────────────────────────
// Materials.
//
// Projectile BODIES use plain opaque singletons (no `transparent`, no pool, nothing
// ever animates them) — see decision (3). Anything that fades independently draws a
// pooled instance, and every transparent material sets `depthWrite: false`, because a
// transparent material that still writes depth silently occludes what is behind it
// and has deleted VFX in this project twice.
// ─────────────────────────────────────────────────────────────────────────────

function materialPool<T extends THREE.Material>(size: number, build: () => T): () => T {
  const pool = Array.from({ length: size }, build);
  let i = 0;
  return () => pool[i++ % size];
}

const solid = (color: string) => new THREE.MeshBasicMaterial({ color, side: THREE.DoubleSide });
const bodyRiceMat = solid(RICE);
const bodyRiceShadeMat = solid(RICE_SHADE);
const bodyNoriMat = solid(NORI);
const bodySalmonDeepMat = solid(SALMON_DEEP);

/** Per-colour opaque body materials, cached so re-skinning a weapon in `rules.ts`
 * still allocates one material for its whole run rather than one per projectile. */
const solidCache = new Map<string, THREE.MeshBasicMaterial>();
function solidFor(color: string): THREE.MeshBasicMaterial {
  let m = solidCache.get(color);
  if (!m) { m = solid(color); solidCache.set(color, m); }
  return m;
}

const fading = (color: string, opacity: number) => new THREE.MeshBasicMaterial({
  color, transparent: true, opacity, side: THREE.DoubleSide, depthWrite: false,
});

/**
 * The blade's own material: `fading`, plus `depthTest: false`.
 *
 * MEASURED, not assumed. The cut is spawned at `game/vfx.ts`'s `IMPACT_HEIGHT` of
 * 1.15 m, which is the middle of a fighter's mass — so with normal depth testing the
 * target ate the middle third of its own cut, and because `bladeGeo` is a LENS (thin
 * at the ends, widest in the middle) the only parts that survived were its two
 * thinnest tips. Probed against Donut, the widest head in the cast: a 2.74 m stroke
 * rendered as two disconnected cyan shards either side of the body, which reads as
 * debris, not as a slice. That is the file's signature effect and the one thing doing
 * identity work Sushi's silhouette cannot do for itself.
 *
 * Drawing over the target is the correct picture rather than a cheat: a cut passes
 * THROUGH the thing it cuts, and on a 58°-pitched camera a straight line crossing the
 * body is exactly how that reads. `game/vfx.ts:721` already sets `depthTest: false`
 * for the same class of reason — a flat plane at one depth cannot be depth-tested
 * sensibly against the chibi rig's non-flat silhouette without clipping unevenly.
 *
 * Scoped to the blade alone. Everything else in this file — grains, slabs, straps,
 * the nori mat, the cut roll's halves — launches from a contact ring already clear of
 * the silhouette and was verified to read WITH depth testing on, so none of them
 * needs or gets this.
 */
const bladeMat = (color: string, opacity: number) => new THREE.MeshBasicMaterial({
  color, transparent: true, opacity, side: THREE.DoubleSide,
  depthWrite: false, depthTest: false,
});

/** Rice grains in flight and scattering — the highest-churn pool in the file, since
 * Rice Spray puts five pellets in the air on a 700 ms cooldown. */
const nextGrainMat = materialPool(56, () => new THREE.MeshBasicMaterial({
  color: RICE, transparent: true, opacity: 1, depthWrite: false,
}));
/** The blade core and its cool halo — see `bladeMat` for why these two alone skip
 * the depth test. */
const nextBladeMat = materialPool(12, () => bladeMat(BLADE, 1));
const nextHaloMat = materialPool(12, () => bladeMat(BLADE_HALO, 0.5));
/** Nori: sheet segments, straps, the ground mat, and their lit edges. */
const nextNoriMat = materialPool(28, () => fading(NORI, 1));
const nextNoriEdgeMat = materialPool(28, () => fading(NORI_LIT, 1));
/** Salmon slabs and their pale striations. */
const nextFishMat = materialPool(24, () => fading(SALMON, 1));
const nextFishDeepMat = materialPool(24, () => fading(SALMON_DEEP, 1));
const nextFatMat = materialPool(24, () => fading(SALMON_FAT, 1));
/** The cut roll's four parts. */
const nextRollWallMat = materialPool(12, () => fading(NORI, 1));
const nextRollFaceMat = materialPool(12, () => fading(RICE, 1));
const nextRollCoreMat = materialPool(12, () => fading(SALMON, 1));

// ─────────────────────────────────────────────────────────────────────────────
// Shared helpers
// ─────────────────────────────────────────────────────────────────────────────

/** Yaw that points an object's local +Z along a world XZ direction. This is the only
 * rotation any flat piece in this file ever gets — see decision (1). */
function yawOf(dirX: number, dirZ: number): number {
  return Math.atan2(dirX, dirZ);
}

/**
 * Nudge a yaw away from the CAMERA'S DEPTH AXIS so a long thin shape is never handed
 * to the camera end-on.
 *
 * The shipped rig is `pitchDeg: 58, yawDeg: 0` (`game/match.ts`), and that yaw of zero
 * is what makes this exact: world +X is screen-horizontal at full length, and world +Z
 * is the depth axis, compressed to cos 58° = 0.53. A blade laid perpendicular to the
 * line of fire therefore renders at anything from 100% to 53% of its authored length
 * depending purely on which way the shooter happened to be standing — and MEASURED off
 * a render, the worst case put a 2.57 m cut on screen as a 60 px sliver that read as a
 * scratch rather than as a slice.
 *
 * So the cut keeps its intent (it crosses the line of fire, and it keeps the side it
 * was going to fall on) but is guaranteed at least `minX` of its length on the screen-
 * horizontal axis. This is the same class of decision as `pizza.ts` spinning its plates
 * about world up so they can never go edge-on: the camera is fixed and known, so the
 * effect is authored to be seen by it.
 */
function presentedYaw(yaw: number, minX = 0.62): number {
  const sx = Math.sin(yaw);
  const cz = Math.cos(yaw);
  if (Math.abs(sx) >= minX) return yaw;
  const sgnX = sx >= 0 ? 1 : -1;
  const sgnZ = cz >= 0 ? 1 : -1;
  return Math.atan2(sgnX * minX, sgnZ * Math.sqrt(1 - minX * minX));
}

/** Seconds this projectile spends in the air, straight off the `rules.ts` ladders, so
 * ripple and spin rates are authored per FLIGHT and survive a weapon changing rung. */
function flightSeconds(w: Weapon): number {
  if (w.range && w.speed) return w.range / w.speed;
  return FLIGHT_MS.normal / 1000;
}

/** Impact scale, deliberately the same curve `game/vfx.ts` re-derived for the generic
 * burst, so a Sushi hit and a generic hit read as the same WEIGHT of event. */
function impactScale(damage: number): number {
  return THREE.MathUtils.clamp(0.85 + damage * 0.035, 0.85, 1.4);
}

/** Per-projectile animation state, stashed on the pooled object (five Rice pellets can
 * be in flight at once, so this cannot be module state). */
interface FlightState { phase: number; shed: number; grow: number; }

function flightState(obj: THREE.Object3D): FlightState {
  let st = obj.userData.__sushi as FlightState | undefined;
  if (!st) {
    st = { phase: Math.random() * TWO_PI, shed: 0, grow: 0 };
    obj.userData.__sushi = st;
  }
  return st;
}

/**
 * THE CUT — this file's signature, and the thing that has to carry Sushi's identity
 * on its own because the character's silhouette does not.
 *
 * A dead-straight near-white lens wiping across the hit in one frame, over a wider,
 * dimmer cool halo. `bladeGeo` is origined at one end and 1 x 1, so the group is
 * placed at the START of the cut, `scale.z` is the length in metres and the wipe, and
 * `scale.x` the width.
 *
 * Cool near-white is doing the heavy lifting: the arena floor, both fighters and every
 * other weapon effect in this directory are warm, so a cool-white line is the only
 * element on screen not competing inside the same hue stack. It is deliberately NOT
 * additive — additive white over a bright warm floor is a wash, not an edge.
 */
function spawnCut(
  ctx: WeaponVfxCtx, cx: number, cy: number, cz: number,
  yaw: number, lengthM: number, widthM: number, life: number,
): void {
  const group = new THREE.Group();
  const py = presentedYaw(yaw);
  group.rotation.y = py;
  // Half a length back along the yaw, so the finished cut is CENTRED on (cx, cz).
  group.position.set(cx - Math.sin(py) * lengthM * 0.5, cy, cz - Math.cos(py) * lengthM * 0.5);
  group.renderOrder = 13;

  const haloMat = nextHaloMat();
  haloMat.color.set(BLADE_HALO);      // SET, never read — see decision (3).
  haloMat.opacity = 0.55;
  const halo = new THREE.Mesh(bladeGeo, haloMat);
  halo.scale.set(2.9, 1, 1.02);
  halo.position.y = -CH * 0.006;
  // Both skip the depth test, so their 6 mm height difference no longer decides which
  // wins — the draw order has to be stated. Without this the wide dim halo can sort in
  // front of the narrow bright core and grey out the very edge the cut is made of.
  halo.renderOrder = 0;
  group.add(halo);

  const coreMat = nextBladeMat();
  coreMat.color.set(BLADE);
  coreMat.opacity = 1;
  const core = new THREE.Mesh(bladeGeo, coreMat);
  core.renderOrder = 1;
  group.add(core);

  ctx.spawnTransient(group, life, (t) => {
    // Wipes across in the first eighth of its life — a knife stroke is one frame of
    // travel and then an afterimage, not a bar that grows.
    const wipe = Math.min(1, t * 8);
    group.scale.set(widthM * (1 - t * 0.55), 1, Math.max(0.02, lengthM * wipe));
    const fade = t < 0.3 ? 1 : 1 - (t - 0.3) / 0.7;
    coreMat.opacity = fade;
    haloMat.opacity = 0.55 * fade * fade;
  });
}

/**
 * One rice grain on a ballistic arc that BOUNCES once and settles. The bounce is the
 * whole point: a grain that simply falls and fades is a generic particle, and a grain
 * that hops off the tile and comes to rest is unmistakably a dry solid — the exact
 * opposite of `soup.ts`'s droplets, which flatten and smear where they land.
 * `lengthM` is the grain's length in metres (`riceGeo` is unit-length).
 */
function spawnGrain(
  ctx: WeaponVfxCtx, ox: number, oy: number, oz: number,
  vx: number, vy: number, vz: number, lengthM: number, life: number, shaded = false,
): void {
  const mat = nextGrainMat();
  mat.color.set(shaded ? RICE_SHADE : RICE);
  mat.opacity = 1;
  const mesh = new THREE.Mesh(riceGeo, mat);
  mesh.renderOrder = 9;
  mesh.scale.setScalar(lengthM);
  mesh.position.set(ox, oy, oz);
  const gravity = -9.6;
  const spinX = (Math.random() - 0.5) * 14;
  const spinY = (Math.random() - 0.5) * 14;
  ctx.spawnTransient(mesh, life, (t, e) => {
    let y = oy + vy * e + 0.5 * gravity * e * e;
    let damp = 1;
    if (y < GROUND_Y) {
      // One bounce, then it settles: mirror the parabola about the floor and shrink
      // the rebound hard so it reads as a hop and not a trampoline.
      const over = GROUND_Y - y;
      y = GROUND_Y + over * 0.28;
      damp = 0.35;
      if (y < GROUND_Y) y = GROUND_Y;
    }
    mesh.position.set(ox + vx * e, y, oz + vz * e * 1);
    mesh.rotation.set(spinX * e * damp, spinY * e * damp, 0);
    mat.opacity = 1 - t * t * t;
  });
}

/**
 * A slab of fish: bright salmon face over a deeper backing, with a pale fat striation
 * across it. `w`/`l` are metres. The dark backing is the same value-break device the
 * other converted files use — SALMON is a mid-value warm orange sitting on a mid-value
 * warm terracotta floor, and without an edge it dissolves into it.
 */
function buildSlab(w: number, l: number, mats: { face: THREE.Material; deep: THREE.Material; fat: THREE.Material }): THREE.Group {
  const g = new THREE.Group();
  const back = new THREE.Mesh(slabGeo, mats.deep);
  back.scale.set(w * 1.16, 1, l * 1.1);
  back.position.y = -CH * 0.008;
  g.add(back);
  const face = new THREE.Mesh(slabGeo, mats.face);
  face.scale.set(w, 1, l);
  g.add(face);
  for (let i = 0; i < 2; i++) {
    const fat = new THREE.Mesh(quadGeo, mats.fat);
    fat.scale.set(w * 0.86, 1, l * 0.09);
    fat.position.set(0, CH * 0.005, l * (i === 0 ? -0.18 : 0.16));
    g.add(fat);
  }
  return g;
}

/** Half a maki roll, cut down its middle: nori wall, rice cap, salmon core and the
 * exposed rice face along the cut. Occupies x ≥ 0 in its own frame. */
function buildHalfRoll(
  r: number, h: number,
  mats: { wall: THREE.Material; face: THREE.Material; core: THREE.Material },
): THREE.Group {
  const g = new THREE.Group();
  const wall = new THREE.Mesh(halfWallGeo, mats.wall);
  wall.scale.set(r * 2, h, r * 2);
  g.add(wall);
  const cap = new THREE.Mesh(halfFaceGeo, mats.face);
  cap.scale.set(r * 1.6, 1, r * 1.6);
  cap.position.y = h * 0.5;
  g.add(cap);
  const core = new THREE.Mesh(halfFaceGeo, mats.core);
  core.scale.set(r * 0.94, 1, r * 0.94);
  core.position.y = h * 0.5 + CH * 0.004;
  g.add(core);
  const cut = new THREE.Mesh(cutFaceGeo, mats.face);
  cut.scale.set(1, h * 0.98, r * 1.96);
  g.add(cut);
  return g;
}

// ─────────────────────────────────────────────────────────────────────────────
// Projectile builders
// ─────────────────────────────────────────────────────────────────────────────

/**
 * Rice Spray: a CLUTCH of grains, not one pellet. Rice is plural — a single object,
 * however grain-shaped, reads as a bead, and three grains tumbling in loose formation
 * read as rice instantly. `rules.ts` already fires five pellets, so each clutch is
 * deliberately small; the volley is the effect.
 */
function buildRiceClutch(color: string): THREE.Group {
  const group = new THREE.Group();
  const face = color === '#FFFFFF' ? bodyRiceMat : solidFor(color);
  const offsets: Array<[number, number, number, number]> = [
    [0, 0, GRAIN_LEN * 0.34, 1],
    [-GRAIN_LEN * 0.4, CH * 0.012, -GRAIN_LEN * 0.3, 0.85],
    [GRAIN_LEN * 0.38, -CH * 0.014, -GRAIN_LEN * 0.42, 0.78],
  ];
  for (let i = 0; i < offsets.length; i++) {
    const [ox, oy, oz, k] = offsets[i];
    const grain = new THREE.Mesh(riceGeo, i === 1 ? bodyRiceShadeMat : face);
    grain.scale.setScalar(GRAIN_LEN * k);
    grain.position.set(ox, oy, oz);
    grain.rotation.set(0, (i - 1) * 0.5, 0);
    group.add(grain);
  }
  return group;
}

/**
 * Seaweed Bait: a sheet of nori built as a CHAIN of four segments, so `trail()` can
 * run a travelling wave down its length. A single quad can only bank; a chain
 * undulates, and undulation is what says "seaweed in water" rather than "a card".
 *
 * This is also what keeps it clear of `pizza.ts`'s Cheese Blind, the nearest thing in
 * the roster: that is a pale warm sheet SPINNING ABOUT WORLD UP with a flap, this is a
 * near-black sheet that never spins and instead ripples along its travel axis.
 */
interface NoriParts { segs: THREE.Object3D[]; }

function buildNoriSheet(color: string): THREE.Group {
  const group = new THREE.Group();
  const segs: THREE.Object3D[] = [];
  const n = 4;
  const segLen = NORI_LEN / n;
  const edgeMat = solidFor(color);
  for (let i = 0; i < n; i++) {
    const seg = new THREE.Group();
    const dark = new THREE.Mesh(quadGeo, bodyNoriMat);
    dark.scale.set(NORI_WID, 1, segLen * 1.02);
    seg.add(dark);
    // A bright rim down each long edge, in the weapon's own green. Nori alone is a
    // near-black rectangle; the rim is what stops it reading as a hole in the floor.
    for (const side of [-1, 1]) {
      const rim = new THREE.Mesh(quadGeo, edgeMat);
      rim.scale.set(NORI_WID * 0.1, 1, segLen * 1.02);
      rim.position.set(side * NORI_WID * 0.45, CH * 0.004, 0);
      seg.add(rim);
    }
    seg.position.z = (i - (n - 1) / 2) * segLen;
    group.add(seg);
    segs.push(seg);
  }
  const parts: NoriParts = { segs };
  group.userData.__parts = parts;
  return group;
}

/**
 * Big Catch: a maki roll standing on end, nori wall, rice cap, salmon core, and one
 * off-centre inclusion. The inclusion is not decoration — a perfectly round disc
 * spinning about its own centre is visually identical to a stationary one, and the
 * off-axis mark is the only thing that makes the roll's rotation legible frame to
 * frame.
 */
function buildRoll(color: string): THREE.Group {
  const group = new THREE.Group();
  const wall = new THREE.Mesh(rollWallGeo, bodyNoriMat);
  wall.scale.set(ROLL_R * 2, ROLL_H, ROLL_R * 2);
  group.add(wall);
  // Cap at 80% of the wall's diameter, not 93%: the DARK NORI RIM around the rice is
  // half of what makes a round of maki recognisable, and at 93% it was a 0.014 m
  // sliver — present in the geometry, absent from the screen.
  const cap = new THREE.Mesh(rollFaceGeo, bodyRiceMat);
  cap.scale.set(ROLL_R * 1.6, 1, ROLL_R * 1.6);
  cap.position.y = ROLL_H * 0.5;
  group.add(cap);
  const core = new THREE.Mesh(rollFaceGeo, solidFor(color));
  core.scale.set(ROLL_R * 0.94, 1, ROLL_R * 0.94);
  core.position.y = ROLL_H * 0.5 + CH * 0.004;
  group.add(core);
  const incl = new THREE.Mesh(rollFaceGeo, bodySalmonDeepMat);
  incl.scale.set(ROLL_R * 0.34, 1, ROLL_R * 0.34);
  incl.position.set(ROLL_R * 0.46, ROLL_H * 0.5 + CH * 0.005, -ROLL_R * 0.3);
  group.add(incl);
  return group;
}

// ─────────────────────────────────────────────────────────────────────────────

export const sushiWeaponVfx: CharacterWeaponVfxMap = {
  // ── Rice Spray ─────────────────────────────────────────────────────────────
  // `rangedClose`, 5 pellets, 2 damage each — the cheapest weapon in the roster, so
  // every element is deliberately small and the VOLLEY carries the read.
  Rice: {
    projectile(ctx) {
      const obj = buildRiceClutch(ctx.color);
      obj.position.copy(ctx.position);
      return obj;
    },

    trail(ctx) {
      const obj = ctx.object;
      if (!obj) return;
      const dt = ctx.dt ?? 0;
      const st = flightState(obj);
      st.phase += (dt / flightSeconds(ctx.weapon)) * TWO_PI * 1.6;
      // The clutch loosens and tightens as it flies — grains jostling, not a rigid
      // model. Yaw only, on the parent; the grains themselves are 3-D so their own
      // tumble is safe on any axis.
      obj.rotation.y = yawOf(ctx.direction.x, ctx.direction.z) + Math.sin(st.phase) * 0.3;
      const k = 1 + Math.sin(st.phase * 1.9) * 0.14;
      obj.scale.set(k, 1, 1 / k);
      for (let i = 0; i < obj.children.length; i++) {
        obj.children[i].rotation.x = st.phase * (0.6 + i * 0.35);
      }

      st.shed -= dt;
      if (st.shed <= 0) {
        st.shed = 0.1 + Math.random() * 0.06;
        // A grain drops out of the clutch and falls away — a spray loses rice.
        spawnGrain(
          ctx,
          ctx.position.x, ctx.position.y, ctx.position.z,
          -ctx.direction.x * 0.5 + (Math.random() - 0.5) * 0.7, -0.15,
          -ctx.direction.z * 0.5 + (Math.random() - 0.5) * 0.7,
          GRAIN_LEN * 0.75, 0.3 + Math.random() * 0.12, Math.random() < 0.4,
        );
      }
    },

    // Grains burst off the contact ring, hop once and settle. Two damage does not earn
    // a blade — the cut is reserved for Fish Pile and Big Catch, so a Sushi hit's
    // WEIGHT reads off which vocabulary it uses.
    impact(ctx) {
      const s = impactScale(ctx.damage);
      const { x, y, z } = ctx.position;
      const d = ctx.direction;
      // 0.55 m: clear of a default 0.48 m head radius on the very first frame.
      const R0 = CH * 0.26 * s;
      for (let i = 0; i < 7; i++) {
        const a = (i / 7) * TWO_PI + Math.random() * 0.7;
        const out = (1.9 + Math.random() * 1.5) * s;
        spawnGrain(
          ctx,
          x + Math.cos(a) * R0, y, z + Math.sin(a) * R0,
          Math.cos(a) * out + d.x * 0.7, 1.5 + Math.random() * 1.2, Math.sin(a) * out + d.z * 0.7,
          GRAIN_LEN * (0.9 + Math.random() * 0.5) * s, 0.44 + Math.random() * 0.16,
          Math.random() < 0.35,
        );
      }
      // A small pale pop AT THE CONTACT POINT, not at the centre — offset back along
      // −direction onto the attacker's side of the body, at the leading edge of the
      // silhouette where the camera can see it (see decision 2).
      const back = Math.hypot(d.x, d.z) > 1e-4 ? CH * 0.34 : 0;
      const mat = nextGrainMat();
      mat.color.set(RICE);
      mat.opacity = 1;
      const pop = new THREE.Mesh(riceGeo, mat);
      pop.renderOrder = 12;
      pop.position.set(x - d.x * back, y, z - d.z * back);
      pop.rotation.y = yawOf(d.x, d.z) + Math.PI * 0.5;
      ctx.spawnTransient(pop, 0.14, (t) => {
        pop.scale.setScalar(THREE.MathUtils.lerp(CH * 0.12, CH * 0.30, t) * s);
        mat.opacity = 1 - t;
      });
    },

    cast(ctx) {
      const d = ctx.direction;
      for (let i = 0; i < 6; i++) {
        spawnGrain(
          ctx, ctx.position.x, ctx.position.y, ctx.position.z,
          d.x * (1.5 + Math.random() * 1.2) + (Math.random() - 0.5) * 1.1,
          0.5 + Math.random() * 0.5,
          d.z * (1.5 + Math.random() * 1.2) + (Math.random() - 0.5) * 1.1,
          GRAIN_LEN * (0.7 + Math.random() * 0.4), 0.3 + Math.random() * 0.12,
          Math.random() < 0.4,
        );
      }
    },
  },

  // ── Seaweed Bait ───────────────────────────────────────────────────────────
  // `rangedMid`, `effect: 'slow'`, and the ability text is "seaweed lures every enemy
  // toward it" — so the hero beat is the MAT IT LEAVES ON THE FLOOR, and the sheet in
  // flight is the delivery.
  Seaweed: {
    projectile(ctx) {
      const obj = buildNoriSheet(ctx.color);
      obj.position.copy(ctx.position);
      return obj;
    },

    trail(ctx) {
      const obj = ctx.object;
      if (!obj) return;
      const dt = ctx.dt ?? 0;
      const st = flightState(obj);
      st.phase += (dt / flightSeconds(ctx.weapon)) * TWO_PI * 2.8;
      obj.rotation.y = yawOf(ctx.direction.x, ctx.direction.z);

      // A travelling wave down the sheet's length. `rotation.x` is applied to CHILD
      // segments inside the yawed parent, which the scene graph composes in the right
      // order — never two Euler angles stacked on one object, which is what tips a
      // flat plate edge-on and deletes it from this camera. Capped at 0.42 rad, where
      // a plate still presents 91% of its area, so no segment can ever vanish.
      const parts = obj.userData.__parts as NoriParts | undefined;
      if (parts) {
        for (let i = 0; i < parts.segs.length; i++) {
          const ph = st.phase - i * 1.1;
          parts.segs[i].rotation.x = Math.sin(ph) * 0.42;
          parts.segs[i].position.y = Math.sin(ph) * CH * 0.03;
        }
      }

      st.shed -= dt;
      if (st.shed <= 0) {
        st.shed = 0.14 + Math.random() * 0.08;
        spawnNoriFleck(
          ctx, ctx.position.x, ctx.position.y, ctx.position.z,
          -ctx.direction.x * 0.5 + (Math.random() - 0.5) * 0.6, -0.05,
          -ctx.direction.z * 0.5 + (Math.random() - 0.5) * 0.6,
          CH * 0.075, 0.28, ctx.color,
        );
      }
    },

    impact(ctx) {
      const s = impactScale(ctx.damage);
      const d = ctx.direction;
      const yaw = yawOf(d.x, d.z);
      const { x, y, z } = ctx.position;

      // ── The bait mat ───────────────────────────────────────────────────────
      // A hard-edged near-black RECTANGLE with a bright green border, unrolling along
      // the line of fire past the target's feet.
      //
      // Ground marks in this arena are a minefield, and this one was checked against
      // every family it could be confused with:
      //   * `game/vfx.ts`'s Sticky Trail marks — 2.2 m PINK / PALE-GOLD CIRCLES at
      //     opacity 0.6, painted continuously under a moving fighter.
      //   * its generic splats — 2.0 m red-orange CIRCLES at opacity 0.55.
      //   * the hazard puddles that slow fighters — large soft CYAN ellipses.
      //   * the arena's permanent beige LOBED floor-spill decals.
      // Every one of those is a soft, round or lobed, mid-to-pale WARM blob. This is a
      // straight-sided dark-green rectangle with four right angles and a hard lime
      // border, at opacity 0.95, that unrolls in 0.1 s and is gone in 0.85 s. It
      // shares neither shape, nor hue, nor value, nor duration with any of them.
      const mat = new THREE.Group();
      mat.rotation.y = yaw;
      mat.position.set(x + d.x * CH * 0.42, GROUND_Y, z + d.z * CH * 0.42);
      mat.renderOrder = 5;
      const edgeMat = nextNoriEdgeMat();
      edgeMat.color.set(ctx.color);
      edgeMat.opacity = 0.95;
      const border = new THREE.Mesh(quadGeo, edgeMat);
      border.scale.set(1.1, 1, 1.07);
      border.position.y = -0.004;
      mat.add(border);
      const darkMat = nextNoriMat();
      darkMat.color.set(NORI);
      darkMat.opacity = 0.95;
      mat.add(new THREE.Mesh(quadGeo, darkMat));
      const MAT_W = CH * 0.42 * s;   // 0.93 m across
      const MAT_L = CH * 0.72 * s;   // 1.59 m along the line of fire
      ctx.spawnTransient(mat, 0.85, (t) => {
        const roll = 1 - Math.pow(1 - Math.min(1, t * 8), 3);
        mat.scale.set(MAT_W, 1, Math.max(0.02, MAT_L * roll));
        const fade = t < 0.55 ? 1 : 1 - (t - 0.55) / 0.45;
        darkMat.opacity = 0.95 * fade;
        edgeMat.opacity = 0.95 * fade;
      });

      // Straps whipping off the contact ring — long, thin, dark, curling as they go.
      const R0 = CH * 0.28 * s;
      for (let i = 0; i < 4; i++) {
        const a = (i / 4) * TWO_PI + Math.random() * 0.8;
        const out = (1.7 + Math.random() * 1.2) * s;
        spawnNoriStrap(
          ctx, x + Math.cos(a) * R0, y, z + Math.sin(a) * R0,
          Math.cos(a) * out, 1.3 + Math.random() * 1.1, Math.sin(a) * out,
          CH * (0.34 + Math.random() * 0.16) * s, 0.42 + Math.random() * 0.14, ctx.color,
        );
      }
      for (let i = 0; i < 5; i++) {
        const a = Math.random() * TWO_PI;
        spawnNoriFleck(
          ctx, x + Math.cos(a) * R0 * 0.8, y, z + Math.sin(a) * R0 * 0.8,
          Math.cos(a) * (1.6 + Math.random() * 1.4), 1.2 + Math.random(),
          Math.sin(a) * (1.6 + Math.random() * 1.4),
          CH * 0.085 * s, 0.36, ctx.color,
        );
      }
    },

    cast(ctx) {
      const d = ctx.direction;
      const yaw = yawOf(d.x, d.z);
      // The sheet snapping open in the hands — a dark rectangle unfurling forward.
      const group = new THREE.Group();
      group.rotation.y = yaw;
      group.position.copy(ctx.position);
      group.renderOrder = 11;
      const edgeMat = nextNoriEdgeMat();
      edgeMat.color.set(ctx.color);
      edgeMat.opacity = 1;
      const border = new THREE.Mesh(quadGeo, edgeMat);
      border.scale.set(1.12, 1, 1.08);
      border.position.y = -CH * 0.006;
      group.add(border);
      const darkMat = nextNoriMat();
      darkMat.color.set(NORI);
      darkMat.opacity = 1;
      group.add(new THREE.Mesh(quadGeo, darkMat));
      ctx.spawnTransient(group, 0.18, (t) => {
        const e = 1 - Math.pow(1 - t, 2);
        group.scale.set(NORI_WID * (0.5 + e * 0.6), 1, NORI_LEN * (0.25 + e * 0.8));
        group.position.set(
          ctx.position.x + d.x * e * CH * 0.16, ctx.position.y, ctx.position.z + d.z * e * CH * 0.16,
        );
        darkMat.opacity = 1 - t;
        edgeMat.opacity = 1 - t;
      });
      for (let i = 0; i < 3; i++) {
        spawnNoriFleck(
          ctx, ctx.position.x, ctx.position.y, ctx.position.z,
          d.x * (1 + Math.random()) + (Math.random() - 0.5) * 0.7, 0.4 + Math.random() * 0.4,
          d.z * (1 + Math.random()) + (Math.random() - 0.5) * 0.7,
          CH * 0.08, 0.28, ctx.color,
        );
      }
    },
  },

  // ── Fish Pile ──────────────────────────────────────────────────────────────
  // `meleeStrong`, cone 150 — the widest melee arc in the roster, and the ability
  // literally says "turns into a pile of fish". So: slabs of salmon slap down all the
  // way round the target, and one clean CUT goes through the lot. No projectile.
  Fish: {
    impact(ctx) {
      const s = impactScale(ctx.damage);
      const d = ctx.direction;
      const { x, y, z } = ctx.position;
      const yaw = yawOf(d.x, d.z);

      // The knife, across the line of attack. 1.86 m against a ~1.15 m head, so it
      // overhangs the silhouette by a third of a metre on both sides and reads as one
      // continuous stroke passing through the target.
      spawnCut(ctx, x, y, z, yaw + Math.PI * 0.5, CH * 0.95 * s, CH * 0.078, 0.28);

      // The pile. Slabs land on a contact RING already clear of the body and skid
      // outward from there, so not one of them spends a frame inside the silhouette.
      const R0 = CH * 0.30 * s;
      for (let i = 0; i < 5; i++) {
        const a = (i / 5) * TWO_PI + Math.random() * 0.5;
        spawnFishSlab(
          ctx, x + Math.cos(a) * R0, y, z + Math.sin(a) * R0,
          a, (1.5 + Math.random() * 1.0) * s,
          CH * 0.16 * s, CH * 0.30 * s, 0.5 + Math.random() * 0.16,
        );
      }
      for (let i = 0; i < 8; i++) {
        const a = Math.random() * TWO_PI;
        const out = (1.7 + Math.random() * 1.4) * s;
        spawnGrain(
          ctx, x + Math.cos(a) * R0 * 0.85, y, z + Math.sin(a) * R0 * 0.85,
          Math.cos(a) * out, 1.4 + Math.random() * 1.2, Math.sin(a) * out,
          GRAIN_LEN * (0.85 + Math.random() * 0.4) * s, 0.42 + Math.random() * 0.14,
          Math.random() < 0.35,
        );
      }
    },

    // The wind-up: the knife glints across the swing line and two slabs fan forward
    // inside the 150° cone. Cast and impact are the two halves of one gesture.
    cast(ctx) {
      const d = ctx.direction;
      const yaw = yawOf(d.x, d.z);
      spawnCut(ctx, ctx.position.x, ctx.position.y, ctx.position.z, yaw + Math.PI * 0.42, CH * 0.5, CH * 0.062, 0.17);
      const cone = (ctx.weapon.cone ?? 150) * Math.PI / 180;
      for (let i = 0; i < 3; i++) {
        const off = (i - 1) * cone * 0.3;
        const a = yaw + off;
        spawnFishSlab(
          ctx, ctx.position.x, ctx.position.y, ctx.position.z,
          Math.atan2(Math.sin(a), Math.cos(a)) - Math.PI * 0.5, 1.5 + Math.random() * 0.7,
          CH * 0.12, CH * 0.22, 0.34,
        );
      }
    },
  },

  // ── Big Catch ──────────────────────────────────────────────────────────────
  // `rangedMax`, `FLIGHT_MS.slow`, 3 homing pellets, 3.2 s cooldown — Sushi's special,
  // and the only weapon in the roster whose ability text says the projectile GROWS
  // ("the fish grow huge"). So it does: a maki roll that swells over its flight and is
  // then CUT IN HALF on impact, the halves sliding apart and toppling.
  //
  // That bisect is the single most identity-asserting thing in this file, and it exists
  // because Sushi's own silhouette does not carry the character. Nothing else in the
  // roster comes apart along a straight line.
  Catch: {
    projectile(ctx) {
      const obj = buildRoll(ctx.color);
      obj.position.copy(ctx.position);
      obj.scale.setScalar(0.6);
      return obj;
    },

    trail(ctx) {
      const obj = ctx.object;
      if (!obj) return;
      const dt = ctx.dt ?? 0;
      const st = flightState(obj);
      const flight = flightSeconds(ctx.weapon);
      st.phase += (dt / flight) * TWO_PI * 1.1;
      st.grow = Math.min(1, st.grow + dt / flight);

      // Yaw only — the roll stands up and turns on the spot, so its round cut face is
      // presented to the camera at every instant of flight. A tumble would spend half
      // of every revolution edge-on, which on a 0.42 m-tall cylinder is a 20 px line.
      obj.rotation.y = st.phase;
      const g = THREE.MathUtils.lerp(0.6, 1.28, 1 - Math.pow(1 - st.grow, 2));
      obj.scale.setScalar(g);
      // A slow lateral sway — it is homing, and a shot that steers should look like it.
      obj.position.y += Math.sin(st.phase * 1.6) * CH * 0.02;

      st.shed -= dt;
      if (st.shed <= 0) {
        st.shed = 0.1 + Math.random() * 0.06;
        spawnGrain(
          ctx, ctx.position.x, ctx.position.y, ctx.position.z,
          -ctx.direction.x * 0.6 + (Math.random() - 0.5) * 0.8, 0.1,
          -ctx.direction.z * 0.6 + (Math.random() - 0.5) * 0.8,
          GRAIN_LEN * 0.8, 0.32, Math.random() < 0.4,
        );
      }
    },

    impact(ctx) {
      const s = impactScale(ctx.damage);
      const d = ctx.direction;
      const { x, y, z } = ctx.position;
      const yaw = yawOf(d.x, d.z);
      const cutYaw = yaw + Math.PI * 0.5;

      // 1. The knife goes through. 2.20 m — the widest element in the file, and it is
      //    a 0.13 m line, so it spans the fighter without covering it.
      spawnCut(ctx, x, y, z, cutYaw, CH * 1.12 * s, CH * 0.085, 0.32);

      // 2. The roll comes apart. Both halves START at ±0.30 m — already outside a
      //    default 0.48 m head's near face on the attacker's side — and slide out to
      //    ±0.68 m while falling to the floor, so they leave the silhouette rather than
      //    emerging from inside it (decision 2). Peak span 2 * (0.68 + 0.44) = 2.24 m,
      //    in family with `soup.ts`'s 2.22 m and well under the 3.0 m ceiling.
      const R = CH * 0.25 * s;
      const H = CH * 0.26 * s;
      const rig = new THREE.Group();
      rig.rotation.y = cutYaw;
      rig.position.set(x, y - CH * 0.05, z);
      rig.renderOrder = 10;

      const wallMat = nextRollWallMat();
      wallMat.color.set(NORI);              // SET, never read.
      wallMat.opacity = 1;
      const faceMat = nextRollFaceMat();
      faceMat.color.set(RICE);
      faceMat.opacity = 1;
      const coreMat = nextRollCoreMat();
      coreMat.color.set(ctx.color);
      coreMat.opacity = 1;
      const mats = { wall: wallMat, face: faceMat, core: coreMat };

      const right = buildHalfRoll(R, H, mats);
      const left = buildHalfRoll(R, H, mats);
      left.rotation.y = Math.PI;            // mirror: the other half of the same cut
      rig.add(right, left);

      const START = CH * 0.185 * s;
      const END = CH * 0.40 * s;
      const drop = y - CH * 0.05 - (GROUND_Y + R * 0.6);
      ctx.spawnTransient(rig, 0.55, (t) => {
        const e = 1 - Math.pow(1 - t, 2);
        const gap = THREE.MathUtils.lerp(START, END, e);
        right.position.x = gap;
        left.position.x = -gap;
        // They topple outward as they fall — a cut roll does not land upright.
        right.rotation.z = -e * 0.9;
        left.rotation.z = e * 0.9;
        rig.position.y = y - CH * 0.05 - drop * e * e;
        const fade = t < 0.6 ? 1 : 1 - (t - 0.6) / 0.4;
        wallMat.opacity = fade;
        faceMat.opacity = fade;
        coreMat.opacity = fade;
      });

      // 3. The spill: rice out of the cut, and one slab of fish that was inside it.
      const R0 = CH * 0.30 * s;
      for (let i = 0; i < 9; i++) {
        const a = (i / 9) * TWO_PI + Math.random() * 0.6;
        const out = (1.9 + Math.random() * 1.5) * s;
        spawnGrain(
          ctx, x + Math.cos(a) * R0, y, z + Math.sin(a) * R0,
          Math.cos(a) * out, 1.6 + Math.random() * 1.3, Math.sin(a) * out,
          GRAIN_LEN * (0.9 + Math.random() * 0.5) * s, 0.46 + Math.random() * 0.16,
          Math.random() < 0.35,
        );
      }
      for (let i = 0; i < 2; i++) {
        const a = cutYaw + (i === 0 ? 0.6 : -0.6) + Math.PI * (i === 0 ? 0 : 1);
        spawnFishSlab(
          ctx, x + Math.cos(a) * R0, y, z + Math.sin(a) * R0,
          a, (1.6 + Math.random() * 0.9) * s,
          CH * 0.14 * s, CH * 0.26 * s, 0.48,
        );
      }
    },

    cast(ctx) {
      const d = ctx.direction;
      const yaw = yawOf(d.x, d.z);
      spawnCut(ctx, ctx.position.x, ctx.position.y, ctx.position.z, yaw + Math.PI * 0.38, CH * 0.58, CH * 0.068, 0.18);
      for (let i = 0; i < 5; i++) {
        spawnGrain(
          ctx, ctx.position.x, ctx.position.y, ctx.position.z,
          d.x * (1.3 + Math.random()) + (Math.random() - 0.5) * 0.9, 0.5 + Math.random() * 0.4,
          d.z * (1.3 + Math.random()) + (Math.random() - 0.5) * 0.9,
          GRAIN_LEN * 0.8, 0.3, Math.random() < 0.4,
        );
      }
    },
  },
};

// ─────────────────────────────────────────────────────────────────────────────
// Debris spawners used by more than one weapon. Declared after the map purely for
// reading order — function declarations hoist, so call order is unaffected.
// ─────────────────────────────────────────────────────────────────────────────

/** A small torn scrap of nori, tumbling and fading. `sizeM` is its long edge. */
function spawnNoriFleck(
  ctx: WeaponVfxCtx, ox: number, oy: number, oz: number,
  vx: number, vy: number, vz: number, sizeM: number, life: number, edge: string,
): void {
  const group = new THREE.Group();
  const edgeMat = nextNoriEdgeMat();
  edgeMat.color.set(edge);              // SET, never read.
  edgeMat.opacity = 1;
  const rim = new THREE.Mesh(quadGeo, edgeMat);
  rim.scale.set(sizeM * 1.3, 1, sizeM * 0.75);
  rim.position.y = -CH * 0.005;
  group.add(rim);
  const darkMat = nextNoriMat();
  darkMat.color.set(NORI);
  darkMat.opacity = 1;
  const dark = new THREE.Mesh(quadGeo, darkMat);
  dark.scale.set(sizeM, 1, sizeM * 0.55);
  group.add(dark);
  group.renderOrder = 9;
  group.position.set(ox, oy, oz);
  group.rotation.y = Math.random() * TWO_PI;
  const spin = (Math.random() - 0.5) * 9;
  const gravity = -5.2;
  ctx.spawnTransient(group, life, (t, e) => {
    group.position.set(ox + vx * e, Math.max(GROUND_Y, oy + vy * e + 0.5 * gravity * e * e), oz + vz * e);
    group.rotation.y += spin * 0.016;
    darkMat.opacity = 1 - t * t;
    edgeMat.opacity = 1 - t * t;
  });
}

/** A long thin strap of nori whipping outward — the seaweed's own debris shape, and
 * deliberately nothing like a shard: it is soft, dark, and it CURLS. */
function spawnNoriStrap(
  ctx: WeaponVfxCtx, ox: number, oy: number, oz: number,
  vx: number, vy: number, vz: number, lengthM: number, life: number, edge: string,
): void {
  const group = new THREE.Group();
  const edgeMat = nextNoriEdgeMat();
  edgeMat.color.set(edge);
  edgeMat.opacity = 1;
  const rim = new THREE.Mesh(quadGeo, edgeMat);
  rim.scale.set(CH * 0.075, 1, lengthM * 1.03);
  rim.position.y = -CH * 0.006;
  group.add(rim);
  const darkMat = nextNoriMat();
  darkMat.color.set(NORI);
  darkMat.opacity = 1;
  const dark = new THREE.Mesh(quadGeo, darkMat);
  dark.scale.set(CH * 0.05, 1, lengthM);
  group.add(dark);
  group.renderOrder = 9;
  group.position.set(ox, oy, oz);
  const gravity = -5.6;
  const curl = (Math.random() - 0.5) * 4.5;
  ctx.spawnTransient(group, life, (t, e) => {
    group.position.set(ox + vx * e, Math.max(GROUND_Y, oy + vy * e + 0.5 * gravity * e * e), oz + vz * e);
    group.rotation.y = yawOf(vx, vz) + curl * e;
    // Slackens as it loses speed — a strap of seaweed does not stay taut.
    group.scale.set(1 + t * 0.5, 1, 1 - t * 0.35);
    darkMat.opacity = 1 - t * t;
    edgeMat.opacity = 1 - t * t;
  });
}

/** A slab of fish flung outward, skidding FLAT to the floor and sliding to a stop.
 * Never tumbles into 3-D: a cut slice of salmon is a flat thing and stays one, which
 * is most of what separates this from `waterbottle.ts`'s shards. */
function spawnFishSlab(
  ctx: WeaponVfxCtx, ox: number, oy: number, oz: number,
  ang: number, speed: number, w: number, l: number, life: number,
): void {
  const faceMat = nextFishMat();
  faceMat.color.set(SALMON);            // SET, never read.
  faceMat.opacity = 1;
  const deepMat = nextFishDeepMat();
  deepMat.color.set(SALMON_DEEP);
  deepMat.opacity = 1;
  const fatMat = nextFatMat();
  fatMat.color.set(SALMON_FAT);
  fatMat.opacity = 1;
  const slab = buildSlab(w, l, { face: faceMat, deep: deepMat, fat: fatMat });
  slab.renderOrder = 9;
  slab.position.set(ox, oy, oz);
  slab.rotation.y = ang + Math.PI * 0.5;

  const vx = Math.cos(ang) * speed;
  const vz = Math.sin(ang) * speed;
  const vy = 0.9 + Math.random() * 0.7;
  const gravity = -7.8;
  const skid = (Math.random() - 0.5) * 2.2;
  ctx.spawnTransient(slab, life, (t, e) => {
    const y = oy + vy * e + 0.5 * gravity * e * e;
    const grounded = y <= GROUND_Y;
    slab.position.set(ox + vx * e, grounded ? GROUND_Y : y, oz + vz * e);
    slab.rotation.y = ang + Math.PI * 0.5 + skid * e;
    const fade = 1 - Math.pow(t, 2.4);
    faceMat.opacity = fade;
    deepMat.opacity = fade;
    fatMat.opacity = fade;
  });
}
