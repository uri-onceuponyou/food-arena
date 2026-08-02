/**
 * Kitchen arena — a working restaurant kitchen, built up from the prototype's single
 * 4-cabinet / 2-island / 1-pot layout into a full Brawl-Stars-scale map.
 *
 * ── Layout concept ───────────────────────────────────────────────────────────────
 * 1400 x 1000 world units (vs the prototype's 900 x 600) laid out with true 180°
 * point symmetry around the centre so both spawns face an identical, fair map.
 *
 *   - A central STOVE HUB: the boiling pot (the frozen hazard numbers, unmoved in
 *     spirit) ringed by 4 diagonal stove islands that block the corners but leave
 *     four cardinal lanes open, each with a small chokepoint prop sitting in the
 *     lane mouth. This is the classic "danger in the middle, cover on the corners"
 *     BS arena hub — you can dash straight up a lane, but the diagonals are blocked
 *     and the hub itself is lethal to linger in.
 *   - Two big WALK-IN FREEZERS anchor the NW/SE corners: single huge landmark props
 *     that fully block sightlines and give a hard flank route around the hub.
 *   - Two PANTRY clusters (crates + flour sacks) anchor the NE/SW corners: several
 *     smaller boxes clustered tight, reading as one nook but with more silhouette
 *     variety than the freezers.
 *   - Two PREP STATIONS sit mid-west/mid-east: paired counters with a narrow gap
 *     between them, a deliberate chokepoint on the flanking route around the hub.
 *   - Two SERVICE counters (a fryer south, a sink north) each sit beside a slowing
 *     puddle (grease / spilled water) — the required slow hazard, doubled for
 *     symmetry.
 * Player spawns west, enemy spawns east, both in open floor well clear of cover so
 * neither side opens the match already boxed in.
 *
 * ── Every CoverBox has exactly one matching visual, built by the same call ───────
 * `addCover()` is the single place a collision box gets created, and it always
 * builds and places the matching mesh in the same statement — there is no path to
 * declaring one without the other.
 */

import * as THREE from 'three';
import type { ArenaDefinition, ArenaFactory, CoverBox, HazardZone } from './types';
import { toonMat, glossyMat, flatMat, roundedBox, outlineGroup, RAMP_SOFT } from '../render/toon';
import { wu, groundPos } from '../units';
import { POT, PUDDLE_SLOW_FACTOR, PALETTE } from '../game/rules';

// ─────────────────────────────────────────────────────────────────────────────
// Map constants
// ─────────────────────────────────────────────────────────────────────────────

const ARENA_W = 1400;
const ARENA_H = 1000;
const CENTER = { x: ARENA_W / 2, y: ARENA_H / 2 }; // 700, 500

// Half-diagonal of the playfield ≈ 860.2; pulled in slightly so the very corners
// start just outside the opening safe zone, matching the prototype's ratio where
// MAX_SAFE_RADIUS (545) sat almost exactly on its own half-diagonal (540.8).
const MAX_SAFE_RADIUS = 850;

// ─────────────────────────────────────────────────────────────────────────────
// Kitchen palette — extends the shared character PALETTE with arena-only tones so
// produce accents on crates/sacks visually match the roster.
// ─────────────────────────────────────────────────────────────────────────────

const KPAL = {
  tileLight: '#EAD3A8',
  tileDark: '#D8B586',
  subfloor: '#B08355',
  border: '#5B3A22',
  woodPad: '#C9945A',
  woodSeam: '#9C6A38',
  flour: '#EFE6CE',

  cabinet: '#B5793C',
  cabinetDark: '#8A5A2E',
  butcherBlock: '#E4C48C',
  // Shifted from a neutral slate toward a visibly blue-teal steel — this surface is
  // large and sits front-and-centre on every stove/service top, so its hue is one of
  // the main levers for pulling the whole hub out of the orange/tan band. Kept dark
  // for the same exposure reason as before: a flat glossy top this size, viewed almost
  // head-on under this rig's key+hemisphere lighting, adds enough specular+clearcoat
  // energy on top of the albedo to blow straight past 1.0 and clip to white — only a
  // genuinely dark base survives with its hue intact once that highlight lands.
  steel: '#2E4A5C',
  steelDark: '#20313E',

  freezerBody: '#4FA0C2',
  freezerDoor: '#2E88AC',
  freezerTrim: '#2B2B2B',
  // Cold light spilling off the freezer onto the floor in front of its door.
  freezerGlow: '#8FE3FF',

  crateWood: '#C08A46',
  crateSlat: '#5B3A22',
  burlap: '#D9C08A',
  burlapDark: '#B99D66',

  // Cool counterpoint crate — herbs/greens, not another warm produce box. Deep
  // teal-green body reads as "cold storage / fresh herbs" against the orange hub.
  herbCrateWood: '#2F7A5E',
  herbCrateSlat: '#1E5641',
  herbLeafA: '#3FAE6E',
  herbLeafB: '#2E8F72',
  potteryWarm: '#B5602E',

  // Decorative tile band ringing the hub — a deliberate cool zone the eye can land
  // on before it reaches the warm scorch/hazard ring at the centre.
  tealTile: '#3C99A6',
  tealTileDark: '#2B7681',

  potMetal: '#888D95',
  potMetalDark: '#5B5F66',
  flame: '#FFB238',
  flameCore: '#FFE9A8',

  // A puddle mixing the character roster's pale `PALETTE.water` straight in at full
  // size blew out the same way the steel tops did — deepened toward the cap colour
  // instead so the disc keeps a visible blue body under its highlight.
  water: '#4FA8D6',
  waterCap: PALETTE.waterCap,
  grease: '#B08A2E',
} as const;

// ─────────────────────────────────────────────────────────────────────────────
// Shared materials — created once per arena instance, reused across every prop
// that shares a surface type. Kept in a factory function so nothing leaks between
// repeated `createKitchenArena()` calls (e.g. hot-reload during preview iteration).
// ─────────────────────────────────────────────────────────────────────────────

function buildMaterials() {
  return {
    // Roughness spread across the floor/cabinet/crate surfaces is deliberate: identical
    // mid-roughness everywhere is what makes a scene read as shadeless plastic even
    // under working lights, because nothing catches a distinct specular highlight.
    tileLight: toonMat({ color: KPAL.tileLight, ramp: RAMP_SOFT(), roughness: 0.55 }),
    tileDark: toonMat({ color: KPAL.tileDark, ramp: RAMP_SOFT(), roughness: 0.55 }),
    subfloor: toonMat({ color: KPAL.subfloor, ramp: RAMP_SOFT(), roughness: 0.92 }),
    border: toonMat({ color: KPAL.border, ramp: RAMP_SOFT(), roughness: 0.7 }),
    woodPad: toonMat({ color: KPAL.woodPad, ramp: RAMP_SOFT(), roughness: 0.68 }),
    woodSeam: toonMat({ color: KPAL.woodSeam, ramp: RAMP_SOFT(), roughness: 0.75 }),
    // Unlit on purpose: a lit near-white toonMat disc this pale caught the same
    // key+fill overexposure as the counter tops and rendered as a hard white lump
    // instead of a soft dusting. flatMat can't blow out — it ignores scene lighting
    // entirely, so the low opacity below is the only thing controlling how it reads.
    flour: flatMat(KPAL.flour, { transparent: true, opacity: 0.45 }),
    // Generic worn-floor marks — dark grime near the fryer, a cool wet sheen near the
    // sink. Small, cheap, and exactly the kind of graphic-not-fine floor wear the
    // reference frames are full of and this arena was missing.
    floorGrime: flatMat('#3E2A18', { transparent: true, opacity: 0.22 }),
    floorWet: flatMat('#3E90BE', { transparent: true, opacity: 0.2 }),

    cabinet: toonMat({ color: KPAL.cabinet, roughness: 0.62 }),
    cabinetDark: toonMat({ color: KPAL.cabinetDark, roughness: 0.65 }),
    butcherBlock: toonMat({ color: KPAL.butcherBlock, roughness: 0.5 }),
    steel: glossyMat({ color: KPAL.steel, roughness: 0.32 }),
    steelDark: glossyMat({ color: KPAL.steelDark, roughness: 0.36 }),

    freezerBody: glossyMat({ color: KPAL.freezerBody, roughness: 0.4 }),
    freezerDoor: toonMat({ color: KPAL.freezerDoor, roughness: 0.45 }),
    freezerTrim: toonMat({ color: KPAL.freezerTrim, roughness: 0.5 }),
    // Cold ground light spilling out in front of each freezer door — unlit so it
    // reads as emitted light rather than a painted floor patch.
    freezerGlow: flatMat(KPAL.freezerGlow, { transparent: true, opacity: 0.28 }),

    crateWood: toonMat({ color: KPAL.crateWood, roughness: 0.72 }),
    crateSlat: toonMat({ color: KPAL.crateSlat, roughness: 0.78 }),
    burlap: toonMat({ color: KPAL.burlap, roughness: 0.85 }),
    burlapDark: toonMat({ color: KPAL.burlapDark, roughness: 0.88 }),

    herbCrateWood: toonMat({ color: KPAL.herbCrateWood, roughness: 0.7 }),
    herbCrateSlat: toonMat({ color: KPAL.herbCrateSlat, roughness: 0.78 }),
    herbLeafA: toonMat({ color: KPAL.herbLeafA, roughness: 0.58 }),
    herbLeafB: toonMat({ color: KPAL.herbLeafB, roughness: 0.6 }),
    potteryWarm: toonMat({ color: KPAL.potteryWarm, roughness: 0.65 }),

    tealTile: toonMat({ color: KPAL.tealTile, ramp: RAMP_SOFT(), roughness: 0.5 }),
    tealTileDark: toonMat({ color: KPAL.tealTileDark, ramp: RAMP_SOFT(), roughness: 0.55 }),

    potMetal: glossyMat({ color: KPAL.potMetal, roughness: 0.22 }),
    potMetalDark: toonMat({ color: KPAL.potMetalDark, roughness: 0.4 }),
    broth: glossyMat({ color: PALETTE.broth, roughness: 0.22, emissive: '#3a1a05', emissiveIntensity: 0.12 }),
    flame: flatMat(KPAL.flame, { transparent: true, opacity: 0.92 }),
    flameCore: flatMat(KPAL.flameCore, { transparent: true, opacity: 0.95 }),

    water: glossyMat({ color: KPAL.water, roughness: 0.3, transparent: true, opacity: 0.82 }),
    waterCap: toonMat({ color: KPAL.waterCap, roughness: 0.4 }),
    grease: glossyMat({ color: KPAL.grease, roughness: 0.32, transparent: true, opacity: 0.85 }),

    tomato: glossyMat({ color: PALETTE.tomato, roughness: 0.28 }),
    lettuce: toonMat({ color: PALETTE.lettuce, roughness: 0.6 }),
    onion: toonMat({ color: PALETTE.onion, roughness: 0.6 }),
    ink: flatMat(PALETTE.ink),
    chalk: flatMat('#F4EFE2', { transparent: true, opacity: 0.85 }),
    dust: flatMat('#FFF6DC', { transparent: true, opacity: 0.5 }),

    // Fake ambient occlusion — a soft dark radial decal dropped under every cover
    // prop's footprint (see `addCover`) so props read as sitting ON the floor with
    // real contact darkening, rather than pasted on top of it.
    contactShadow: new THREE.MeshBasicMaterial({
      map: makeContactShadowTexture(),
      transparent: true,
      depthWrite: false,
      opacity: 0.9,
    }),
  };
}

type Materials = ReturnType<typeof buildMaterials>;

// ─────────────────────────────────────────────────────────────────────────────
// Small geometry helpers
// ─────────────────────────────────────────────────────────────────────────────

/** Cheap cylinder, rounded-looking enough at this scale without the roundedBox cost. */
function puck(radius: number, height: number, segments = 20): THREE.CylinderGeometry {
  return new THREE.CylinderGeometry(radius, radius, height, segments);
}

function mesh(geo: THREE.BufferGeometry, mat: THREE.Material, name: string): THREE.Mesh {
  const m = new THREE.Mesh(geo, mat);
  m.name = name;
  m.castShadow = true;
  m.receiveShadow = true;
  return m;
}

function noOutline<T extends THREE.Object3D>(o: T): T {
  o.userData.noOutline = true;
  return o;
}

// ─────────────────────────────────────────────────────────────────────────────
// Fake contact AO — a soft dark radial-gradient decal, canvas-generated once and
// shared by every prop's footprint. This is the single cheapest lever for killing
// the "pasted onto the floor" look: real-time contact shadows are expensive, but a
// baked dark ellipse under each prop reads as grounding at gameplay camera distance.
// ─────────────────────────────────────────────────────────────────────────────

function makeContactShadowTexture(): THREE.CanvasTexture {
  const size = 128;
  const canvas = document.createElement('canvas');
  canvas.width = canvas.height = size;
  const ctx = canvas.getContext('2d')!;
  const g = ctx.createRadialGradient(size / 2, size / 2, 0, size / 2, size / 2, size / 2);
  g.addColorStop(0, 'rgba(12,8,6,0.55)');
  g.addColorStop(0.55, 'rgba(12,8,6,0.28)');
  g.addColorStop(1, 'rgba(12,8,6,0)');
  ctx.fillStyle = g;
  ctx.fillRect(0, 0, size, size);
  const tex = new THREE.CanvasTexture(canvas);
  tex.needsUpdate = true;
  return tex;
}

/** Elliptical AO blob sized to a prop's own footprint (in metres), slightly oversized
 * so it peeks out past the silhouette the way a real contact shadow would. */
function buildContactShadow(mat: THREE.Material, wM: number, dM: number, scale = 1.25): THREE.Mesh {
  const m = new THREE.Mesh(new THREE.PlaneGeometry(wM * scale, dM * scale), mat);
  m.rotation.x = -Math.PI / 2;
  m.position.y = 0.011;
  m.renderOrder = 1;
  m.name = 'contact_shadow__no_outline';
  m.castShadow = false;
  m.receiveShadow = false;
  noOutline(m);
  return m;
}

// ─────────────────────────────────────────────────────────────────────────────
// Cover prop builders. Each takes its footprint in METRES (already converted from
// the CoverBox's world-unit w/h by `addCover`) and returns a group whose outer-most
// visible geometry never exceeds that footprint — so the collision box always
// covers everything a player can see and bump into.
// ─────────────────────────────────────────────────────────────────────────────

/**
 * Small potted herb garnish — deliberately cool-green against every warm cabinet/
 * cabinetDark surface it sits on. Cheap, bold-shaped (a pot + a leaf cluster, no
 * fine detail) so it still reads at gameplay camera distance, and it is the one
 * prop guaranteed to sit on every stove island — i.e. always in the gameplay shot.
 */
function buildHerbSprig(M: Materials, scale = 1): THREE.Group {
  const g = new THREE.Group();
  const potR = 0.09 * scale;
  const potH = 0.11 * scale;
  const pot = mesh(puck(potR, potH, 10), M.potteryWarm, 'herb_pot');
  pot.position.y = potH / 2;
  g.add(pot);
  const leafMats = [M.herbLeafA, M.herbLeafB, M.herbLeafA];
  let a = 0;
  for (const lm of leafMats) {
    const leaf = mesh(new THREE.ConeGeometry(potR * 0.85, potR * 2.6, 6), lm, 'herb_leaf');
    leaf.position.set(Math.cos(a) * potR * 0.35, potH + potR * 1.15, Math.sin(a) * potR * 0.35);
    leaf.rotation.z = Math.cos(a) * 0.22;
    leaf.rotation.x = Math.sin(a) * 0.22;
    g.add(leaf);
    a += (Math.PI * 2) / leafMats.length;
  }
  return g;
}

function buildStoveIsland(M: Materials, wM: number, dM: number, opts?: { panRack?: boolean }): THREE.Group {
  const g = new THREE.Group();
  const cabH = 0.92;

  const cabinet = mesh(roundedBox(wM * 0.98, cabH, dM * 0.96, 0.06), M.cabinet, 'stove_cabinet');
  cabinet.position.y = cabH / 2;
  g.add(cabinet);

  const kick = mesh(roundedBox(wM * 0.98, 0.12, dM * 0.96 + 0.02, 0.02), M.cabinetDark, 'stove_kick');
  kick.position.y = 0.06;
  g.add(kick);

  // Top is deliberately narrower than the cabinet beneath it — from the steep
  // top-down gameplay camera the top face is almost all you see, so leaving a
  // visible tan rim is what keeps the island reading as a wood cabinet with a
  // steel cap rather than a single flat slab.
  const top = mesh(roundedBox(wM * 0.8, 0.09, dM * 0.72, 0.05), M.steel, 'stove_top');
  top.position.y = cabH + 0.045;
  g.add(top);

  // Two burner rings + a lit-coil disc each.
  for (const bx of [-wM * 0.22, wM * 0.22]) {
    const ring = mesh(new THREE.TorusGeometry(0.17, 0.03, 8, 20), M.potMetalDark, 'burner_ring');
    ring.rotation.x = Math.PI / 2;
    ring.position.set(bx, cabH + 0.1, 0);
    g.add(ring);
    const coil = mesh(puck(0.12, 0.02, 16), M.potMetalDark, 'burner_coil');
    coil.position.set(bx, cabH + 0.1, 0);
    g.add(coil);
  }

  // Herb garnish sitting on the steel top's inner-front corner (the side that faces
  // the pot — `+dM*0.28` lands there regardless of the 0/180° yaw the caller applies,
  // since that flips which world edge is "inner"), clear of both burners. These
  // islands are enormous (8.5m x 4.5m footprints), so a realistic pot-plant scale
  // was completely invisible at gameplay camera distance — sized way up, matching
  // roughly the same on-counter footprint fraction as the tomato/lettuce accents on
  // the produce crates, so it actually reads as a bold green shape.
  const herb = buildHerbSprig(M, 3.4);
  herb.position.set(wM * 0.3, cabH + 0.09, dM * 0.26);
  g.add(herb);

  if (opts?.panRack) {
    const postH = 1.15;
    const post = mesh(roundedBox(0.05, postH, 0.05, 0.02), M.freezerTrim, 'rack_post');
    post.position.set(-wM * 0.32, cabH + postH / 2, -dM * 0.38);
    g.add(post);
    const bar = mesh(roundedBox(wM * 0.5, 0.045, 0.045, 0.02), M.freezerTrim, 'rack_bar');
    bar.position.set(-wM * 0.05, cabH + postH, -dM * 0.38);
    g.add(bar);
    let px = -wM * 0.28;
    for (const pr of [0.16, 0.13, 0.15]) {
      const chain = mesh(puck(0.008, 0.16, 6), M.potMetalDark, 'pan_chain');
      chain.position.set(px, cabH + postH - 0.1, -dM * 0.38);
      noOutline(chain);
      g.add(chain);
      const pan = mesh(puck(pr, 0.045, 16), M.potMetal, 'hanging_pan');
      pan.position.set(px, cabH + postH - 0.2, -dM * 0.38);
      g.add(pan);
      px += wM * 0.24;
    }
  }

  return g;
}

function buildFreezerSized(M: Materials, wM: number, dM: number): THREE.Group {
  const g = new THREE.Group();
  const h = 2.05;

  const body = mesh(roundedBox(wM, h, dM, 0.09), M.freezerBody, 'freezer_body');
  body.position.y = h / 2;
  g.add(body);

  const base = mesh(roundedBox(wM * 0.98, 0.16, dM * 0.98, 0.03), M.freezerTrim, 'freezer_base');
  base.position.y = 0.08;
  g.add(base);

  // Door panel + handle on the +Z face (rotated per-instance by the caller via yaw).
  // Kept flush with (never past) the body's outer face — this whole prop's visible
  // silhouette must stay inside its CoverBox footprint.
  const door = mesh(roundedBox(wM * 0.46, h * 0.76, 0.08, 0.05), M.freezerDoor, 'freezer_door');
  door.position.set(0, h * 0.42, dM / 2 - 0.04);
  g.add(door);

  const handle = mesh(roundedBox(0.07, h * 0.3, 0.05, 0.02), M.freezerTrim, 'freezer_handle');
  handle.position.set(wM * 0.17, h * 0.42, dM / 2 - 0.025);
  g.add(handle);

  // Vent grille — a few thin light strips near the top.
  for (let i = 0; i < 3; i++) {
    const strip = mesh(roundedBox(wM * 0.5, 0.03, 0.02, 0.01), M.steelDark, 'freezer_vent');
    strip.position.set(-wM * 0.18, h * 0.86 - i * 0.09, dM / 2 - 0.005);
    noOutline(strip);
    g.add(strip);
  }

  // Cold light spilling onto the floor in front of the door — pushes the freezer's
  // cool colour out past its own footprint and onto the ground plane around it.
  const glow = mesh(new THREE.CircleGeometry(dM * 0.62, 20), M.freezerGlow, 'freezer_floor_glow__no_outline');
  glow.rotation.x = -Math.PI / 2;
  glow.scale.set(1, 1.4, 1);
  glow.position.set(0, 0.02, dM / 2 + dM * 0.35);
  noOutline(glow);
  g.add(glow);

  return g;
}

function buildCrateSmall(M: Materials, wM: number, dM: number): THREE.Group {
  const g = new THREE.Group();
  const h = 0.82;
  const crate = mesh(roundedBox(wM, h, dM, 0.05), M.crateWood, 'crate_body');
  crate.position.y = h / 2;
  g.add(crate);

  for (const rot of [Math.PI / 5, -Math.PI / 5]) {
    const slat = mesh(new THREE.BoxGeometry(wM * 1.02, 0.05, dM * 1.02), M.crateSlat, 'crate_slat__no_outline');
    noOutline(slat);
    slat.rotation.y = rot;
    slat.position.y = h * 0.55;
    g.add(slat);
  }

  const tomato = mesh(new THREE.SphereGeometry(0.14, 12, 10), M.tomato, 'crate_tomato');
  tomato.position.set(-wM * 0.18, h + 0.12, dM * 0.1);
  g.add(tomato);
  const lettuce = mesh(new THREE.SphereGeometry(0.15, 10, 8), M.lettuce, 'crate_lettuce');
  lettuce.scale.set(1, 0.75, 1);
  lettuce.position.set(wM * 0.15, h + 0.1, -dM * 0.12);
  g.add(lettuce);

  return g;
}

function buildCrateTall(M: Materials, wM: number, dM: number): THREE.Group {
  const g = new THREE.Group();
  const h1 = 0.5, h2 = 0.46;
  const bottom = mesh(roundedBox(wM, h1, dM, 0.05), M.crateWood, 'crate_bottom');
  bottom.position.y = h1 / 2;
  g.add(bottom);
  const top = mesh(roundedBox(wM * 0.86, h2, dM * 0.86, 0.05), M.crateWood, 'crate_top');
  top.position.set(wM * 0.04, h1 + h2 / 2, -dM * 0.03);
  top.rotation.y = 0.12;
  g.add(top);

  const slat = mesh(new THREE.BoxGeometry(wM * 0.9, 0.045, dM * 0.9), M.crateSlat, 'crate_slat__no_outline');
  noOutline(slat);
  slat.position.y = h1 * 0.5;
  g.add(slat);

  const onion = mesh(new THREE.SphereGeometry(0.13, 10, 8), M.onion, 'crate_onion');
  onion.position.set(0, h1 + h2 + 0.11, 0);
  g.add(onion);

  return g;
}

/**
 * Cool-toned herb crate — same silhouette language as `buildCrateSmall` (a slatted
 * box with produce piled on top) but built entirely from the teal-green side of the
 * palette. Exists specifically to break up the orange/tan/cream monochrome the
 * critic called out: a whole crate body in a different hue family, not just a small
 * coloured prop sitting on a warm one.
 */
function buildHerbCrate(M: Materials, wM: number, dM: number): THREE.Group {
  const g = new THREE.Group();
  const h = 0.82;
  const crate = mesh(roundedBox(wM, h, dM, 0.05), M.herbCrateWood, 'crate_body');
  crate.position.y = h / 2;
  g.add(crate);

  for (const rot of [Math.PI / 5, -Math.PI / 5]) {
    const slat = mesh(new THREE.BoxGeometry(wM * 1.02, 0.05, dM * 1.02), M.herbCrateSlat, 'crate_slat__no_outline');
    noOutline(slat);
    slat.rotation.y = rot;
    slat.position.y = h * 0.55;
    g.add(slat);
  }

  // Bundled herb sprigs instead of loose produce — bold cone clusters read as
  // bunched greens at gameplay distance without needing fine leaf detail.
  const bundlePositions: Array<[number, number]> = [[-wM * 0.2, dM * 0.1], [wM * 0.18, -dM * 0.12], [wM * 0.02, dM * 0.28]];
  const leafMats = [M.herbLeafA, M.herbLeafB];
  bundlePositions.forEach(([sx, sz], i) => {
    for (let k = 0; k < 3; k++) {
      const leaf = mesh(new THREE.ConeGeometry(0.05, 0.24, 6), leafMats[k % 2], 'crate_herb_leaf');
      const a = (k / 3) * Math.PI * 2;
      leaf.position.set(sx + Math.cos(a) * 0.05, h + 0.16, sz + Math.sin(a) * 0.05);
      leaf.rotation.set(Math.sin(a) * 0.3, 0, Math.cos(a) * 0.3);
      g.add(leaf);
    }
    void i;
  });

  return g;
}

function buildFlourSack(M: Materials, wM: number, dM: number): THREE.Group {
  const g = new THREE.Group();
  const positions: Array<[number, number, number]> = [
    [-wM * 0.2, 0, 0],
    [wM * 0.22, 0, dM * 0.15],
  ];
  for (const [sx, , sz] of positions) {
    const sack = mesh(new THREE.SphereGeometry(Math.min(wM, dM) * 0.34, 14, 12), M.burlap, 'sack_body');
    sack.scale.set(1, 1.15, 1);
    sack.position.set(sx, sack.scale.y * Math.min(wM, dM) * 0.34, sz);
    g.add(sack);
    const tie = mesh(new THREE.TorusGeometry(Math.min(wM, dM) * 0.14, 0.025, 6, 12), M.burlapDark, 'sack_tie');
    tie.rotation.x = Math.PI / 2;
    tie.position.set(sx, sack.position.y + Math.min(wM, dM) * 0.3, sz);
    noOutline(tie);
    g.add(tie);
  }
  return g;
}

function buildPrepCounter(M: Materials, wM: number, dM: number, opts?: { knifeBlock?: boolean }): THREE.Group {
  const g = new THREE.Group();
  const h = 0.86;
  const cabinet = mesh(roundedBox(wM * 0.98, h, dM * 0.94, 0.06), M.cabinet, 'prep_cabinet');
  cabinet.position.y = h / 2;
  g.add(cabinet);
  const top = mesh(roundedBox(wM * 0.82, 0.08, dM * 0.72, 0.04), M.butcherBlock, 'prep_top');
  top.position.y = h + 0.04;
  g.add(top);

  if (opts?.knifeBlock) {
    const block = mesh(roundedBox(0.22, 0.26, 0.18, 0.04), M.crateSlat, 'knife_block');
    block.position.set(wM * 0.3, h + 0.08 + 0.13, 0);
    g.add(block);
    for (const a of [-0.5, -0.2, 0.1, 0.4]) {
      const blade = mesh(new THREE.BoxGeometry(0.03, 0.3, 0.07), M.steel, 'knife_blade__no_outline');
      noOutline(blade);
      blade.position.set(wM * 0.3 + Math.sin(a) * 0.07, h + 0.08 + 0.32, Math.cos(a) * 0.04);
      blade.rotation.z = a * 0.5;
      g.add(blade);
    }
  }

  return g;
}

function buildServiceCounter(M: Materials, wM: number, dM: number, variant: 'fryer' | 'sink'): THREE.Group {
  const g = new THREE.Group();
  const h = 0.9;
  const cabinet = mesh(roundedBox(wM * 0.98, h, dM * 0.95, 0.06), M.cabinetDark, 'service_cabinet');
  cabinet.position.y = h / 2;
  g.add(cabinet);
  const top = mesh(roundedBox(wM * 0.8, 0.09, dM * 0.74, 0.05), M.steel, 'service_top');
  top.position.y = h + 0.045;
  g.add(top);

  if (variant === 'fryer') {
    const well = mesh(roundedBox(wM * 0.55, 0.1, dM * 0.55, 0.04), M.potMetalDark, 'fryer_well');
    well.position.y = h + 0.02;
    noOutline(well);
    g.add(well);
    const basket = mesh(roundedBox(wM * 0.4, 0.22, dM * 0.4, 0.03), M.steelDark, 'fryer_basket');
    basket.position.y = h + 0.16;
    g.add(basket);
    const handleBar = mesh(puck(0.015, wM * 0.5, 8), M.steelDark, 'fryer_handle');
    handleBar.rotation.z = Math.PI / 2;
    handleBar.position.set(0, h + 0.3, 0);
    noOutline(handleBar);
    g.add(handleBar);
  } else {
    const basin = mesh(roundedBox(wM * 0.6, 0.14, dM * 0.55, 0.05), M.steelDark, 'sink_basin');
    basin.position.y = h + 0.02;
    noOutline(basin);
    g.add(basin);
    const faucetPost = mesh(puck(0.025, 0.32, 8), M.steel, 'faucet_post');
    faucetPost.position.set(0, h + 0.2, -dM * 0.2);
    g.add(faucetPost);
    const faucetArc = mesh(new THREE.TorusGeometry(0.14, 0.02, 6, 12, Math.PI), M.steel, 'faucet_arc');
    faucetArc.rotation.set(0, Math.PI / 2, 0);
    faucetArc.position.set(0, h + 0.34, -dM * 0.08);
    g.add(faucetArc);
  }

  return g;
}

function buildLanePots(M: Materials, wM: number, dM: number): THREE.Group {
  const g = new THREE.Group();
  const base = Math.min(wM, dM);
  let y = 0;
  const radii = [base * 0.42, base * 0.34, base * 0.24];
  for (let i = 0; i < radii.length; i++) {
    const h = base * 0.32;
    const pot = mesh(puck(radii[i], h, 16), i % 2 === 0 ? M.potMetal : M.potMetalDark, 'stack_pot');
    pot.position.y = y + h / 2;
    g.add(pot);
    y += h * 0.92;
  }
  const handle = mesh(new THREE.TorusGeometry(base * 0.08, 0.015, 6, 12), M.potMetalDark, 'stack_pot_handle');
  handle.rotation.x = Math.PI / 2;
  handle.position.y = y + 0.02;
  noOutline(handle);
  g.add(handle);
  return g;
}

function buildSpiceCart(M: Materials, wM: number, dM: number): THREE.Group {
  const g = new THREE.Group();
  const h = 0.62;
  // Cool teal body, not the warm cabinetDark used everywhere else — this cart sits
  // dead-centre in the hub chokepoint and is one of the very few props guaranteed
  // to be on-screen in every gameplay frame, so its hue does real work for palette
  // contrast.
  const body = mesh(roundedBox(wM * 0.85, h, dM * 0.85, 0.05), M.tealTileDark, 'cart_body');
  body.position.y = h / 2 + 0.06;
  g.add(body);
  for (const [sx, sz] of [[-1, -1], [1, -1], [-1, 1], [1, 1]] as const) {
    const wheel = mesh(puck(0.06, 0.04, 12), M.freezerTrim, 'cart_wheel');
    wheel.rotation.z = Math.PI / 2;
    wheel.position.set(sx * wM * 0.32, 0.06, sz * dM * 0.32);
    noOutline(wheel);
    g.add(wheel);
  }
  // Mostly-cool jars with a single warm tomato pop — the same "cool field, one warm
  // accent" contrast the reference frames use, just at prop scale.
  const jarColors = [PALETTE.lettuce, KPAL.herbLeafB, PALETTE.waterCap, PALETTE.tomato];
  let jx = -wM * 0.28;
  for (const c of jarColors) {
    const jar = mesh(puck(0.06, 0.16, 10), toonMat({ color: c }), 'cart_jar');
    jar.position.set(jx, h + 0.06 + 0.08, 0);
    g.add(jar);
    jx += wM * 0.19;
  }
  return g;
}

// ─────────────────────────────────────────────────────────────────────────────
// Central pot assembly — the hazard's visual, kept separate from `addCover` since
// the pot has no collision box (matching the prototype: dangerRadius already keeps
// players well clear of the body before they'd ever touch it).
// ─────────────────────────────────────────────────────────────────────────────

interface PotAssembly {
  group: THREE.Group;
  steam: THREE.Mesh[];
  bubbles: THREE.Mesh[];
  flame: THREE.Mesh;
  flameCore: THREE.Mesh;
}

function buildPot(M: Materials): PotAssembly {
  const g = new THREE.Group();
  const bodyR = wu(POT.bodyRadius);
  const bodyH = bodyR * 0.95;

  const solid = new THREE.Group();
  solid.name = 'pot_solid';

  // Contact AO directly under the pot's own base — a tighter, darker ring than the
  // broad hazard scorch, so the heaviest object in the arena visibly presses into
  // the floor rather than floating on top of it.
  g.add(buildContactShadow(M.contactShadow, bodyR * 2.1, bodyR * 2.1, 1));

  const base = mesh(puck(bodyR * 0.5, 0.06, 24), M.potMetalDark, 'pot_stove_base');
  base.position.y = 0.03;
  solid.add(base);

  const body = mesh(puck(bodyR, bodyH, 28), M.potMetal, 'pot_body');
  body.position.y = 0.06 + bodyH / 2;
  solid.add(body);

  const rim = mesh(new THREE.TorusGeometry(bodyR, bodyR * 0.06, 10, 28), M.potMetalDark, 'pot_rim');
  rim.rotation.x = Math.PI / 2;
  rim.position.y = 0.06 + bodyH;
  solid.add(rim);

  const broth = mesh(puck(bodyR * 0.88, 0.05, 28), M.broth, 'pot_broth');
  broth.position.y = 0.06 + bodyH + 0.01;
  noOutline(broth);
  solid.add(broth);

  for (const side of [-1, 1]) {
    const handle = mesh(new THREE.TorusGeometry(bodyR * 0.16, 0.025, 6, 12, Math.PI), M.potMetalDark, 'pot_handle');
    handle.rotation.set(0, side > 0 ? -Math.PI / 2 : Math.PI / 2, 0);
    handle.position.set(side * (bodyR + bodyR * 0.02), 0.06 + bodyH * 0.62, 0);
    solid.add(handle);
  }

  g.add(solid);

  // Flame licking out from under the rim — two overlapping unlit blobs, flicker
  // animated in update().
  const flameCore = mesh(new THREE.ConeGeometry(bodyR * 0.28, bodyR * 0.4, 10), M.flameCore, 'pot_flame_core__no_outline');
  flameCore.position.y = -0.02;
  noOutline(flameCore);
  g.add(flameCore);
  const flame = mesh(new THREE.ConeGeometry(bodyR * 0.42, bodyR * 0.6, 10), M.flame, 'pot_flame__no_outline');
  flame.position.y = -0.04;
  noOutline(flame);
  g.add(flame);

  // Steam — soft tapered blobs rising above the broth, reset by `update()`.
  const steam: THREE.Mesh[] = [];
  const steamMat = flatMat('#EDEDED', { transparent: true, opacity: 0.55 });
  const steamPositions: Array<[number, number]> = [
    [-bodyR * 0.4, 0], [0, bodyR * 0.05], [bodyR * 0.38, -bodyR * 0.05],
  ];
  for (const [sx, sz] of steamPositions) {
    const wisp = mesh(new THREE.ConeGeometry(bodyR * 0.16, bodyR * 0.5, 8, 1, true), steamMat, 'pot_steam__no_outline');
    noOutline(wisp);
    wisp.position.set(sx, 0.06 + bodyH + 0.2, sz);
    wisp.userData.baseY = wisp.position.y;
    g.add(wisp);
    steam.push(wisp);
  }

  // Bubbles on the broth surface.
  const bubbles: THREE.Mesh[] = [];
  const bubblePositions: Array<[number, number]> = [
    [-bodyR * 0.3, bodyR * 0.2], [bodyR * 0.15, bodyR * 0.35], [bodyR * 0.3, -bodyR * 0.15],
  ];
  for (const [sx, sz] of bubblePositions) {
    const bub = mesh(new THREE.SphereGeometry(bodyR * 0.08, 10, 8), M.broth, 'pot_bubble__no_outline');
    noOutline(bub);
    bub.position.set(sx, 0.06 + bodyH + 0.03, sz);
    g.add(bub);
    bubbles.push(bub);
  }

  outlineGroup(solid, 0.006);

  return { group: g, steam, bubbles, flame, flameCore };
}

// ─────────────────────────────────────────────────────────────────────────────
// Floor — big flat graphic shapes, not fine repeating texture. A checkerboard of
// 5m tiles (two InstancedMeshes, one per shade) covers the whole playfield; wood
// pads sit above it under the two pantry nooks; a cool tile ring circles the hub.
// ─────────────────────────────────────────────────────────────────────────────

// Floor layer heights, in METRES. Gameplay/overview cameras sit 20-100m out, where a
// standard depth buffer has nowhere near enough precision to resolve millimetre gaps
// reliably — an early pass stacked these a few mm apart and lost z-fights against the
// tile field beneath. Centimetre-scale separation is still visually flat from gameplay
// distance but leaves the depth buffer an unambiguous answer.
const FLOOR_Y = {
  subfloor: -0.1,
  tile: 0,
  decal: 0.15, // scorch patch, puddles, flour, wood pads, tile ring, border trim
  fine: 0.25, // marks drawn ON a decal (wood seams, hazard ring/glow)
} as const;

// ─────────────────────────────────────────────────────────────────────────────
// Hazard ground treatment — the pot's danger radius, drawn as a scorched floor
// patch + a bright glow ring + drifting heat wisps, NOT a flat opaque disc. Every
// measurement is driven off `POT.dangerRadius` (the actual gameplay hazard radius
// from `game/rules.ts`), so the visual always matches exactly what hurts the player —
// only the drawing changed, not the hazard.
// ─────────────────────────────────────────────────────────────────────────────

/** Soft, organic dark wash + irregular char blotches — reads as scorched concrete,
 * not a coloured lid, and lets the tile pattern show through almost everywhere. */
function makeScorchTexture(): THREE.CanvasTexture {
  const size = 256;
  const canvas = document.createElement('canvas');
  canvas.width = canvas.height = size;
  const ctx = canvas.getContext('2d')!;
  const cx = size / 2, cy = size / 2;

  const base = ctx.createRadialGradient(cx, cy, 0, cx, cy, size * 0.5);
  base.addColorStop(0, 'rgba(58,26,14,0.5)');
  base.addColorStop(0.5, 'rgba(66,32,16,0.26)');
  base.addColorStop(0.78, 'rgba(74,38,18,0.08)');
  base.addColorStop(1, 'rgba(74,38,18,0)');
  ctx.fillStyle = base;
  ctx.fillRect(0, 0, size, size);

  let seed = 907;
  const rand = () => { seed = (seed * 48271) % 2147483647; return seed / 2147483647; };
  for (let i = 0; i < 16; i++) {
    const a = rand() * Math.PI * 2;
    const r = rand() * size * 0.42;
    const bx = cx + Math.cos(a) * r;
    const by = cy + Math.sin(a) * r;
    const br = size * (0.03 + rand() * 0.08);
    const g = ctx.createRadialGradient(bx, by, 0, bx, by, br);
    const alpha = 0.14 + rand() * 0.2;
    g.addColorStop(0, `rgba(32,16,9,${alpha})`);
    g.addColorStop(1, 'rgba(32,16,9,0)');
    ctx.fillStyle = g;
    ctx.beginPath();
    ctx.arc(bx, by, br, 0, Math.PI * 2);
    ctx.fill();
  }

  const tex = new THREE.CanvasTexture(canvas);
  tex.needsUpdate = true;
  return tex;
}

/** Soft halo centred exactly on the hazard boundary — bright, defined edge with a
 * falloff on either side, instead of a hard-edged disc. `ringNorm` here must match
 * `glowPlaneR`'s derivation in `buildHazardGround` below. */
function makeHazardGlowTexture(): THREE.CanvasTexture {
  const size = 256;
  const canvas = document.createElement('canvas');
  canvas.width = canvas.height = size;
  const ctx = canvas.getContext('2d')!;
  const cx = size / 2, cy = size / 2, R = size * 0.5;
  const ringNorm = 0.84;

  const g = ctx.createRadialGradient(cx, cy, 0, cx, cy, R);
  g.addColorStop(0, 'rgba(255,140,60,0)');
  g.addColorStop(Math.max(0, ringNorm - 0.22), 'rgba(255,120,50,0)');
  g.addColorStop(ringNorm - 0.07, 'rgba(255,130,55,0.2)');
  g.addColorStop(ringNorm - 0.02, 'rgba(255,214,140,0.65)');
  g.addColorStop(ringNorm, 'rgba(255,240,195,0.95)');
  g.addColorStop(ringNorm + 0.025, 'rgba(255,170,80,0.5)');
  g.addColorStop(ringNorm + 0.09, 'rgba(255,110,40,0.16)');
  g.addColorStop(1, 'rgba(255,90,30,0)');
  ctx.fillStyle = g;
  ctx.fillRect(0, 0, size, size);

  const tex = new THREE.CanvasTexture(canvas);
  tex.needsUpdate = true;
  return tex;
}

interface HazardGround {
  group: THREE.Group;
  glowMat: THREE.MeshBasicMaterial;
  wisps: THREE.Mesh[];
}

function buildHazardGround(M: Materials): HazardGround {
  const g = new THREE.Group();
  noOutline(g);

  const R = wu(POT.dangerRadius);

  // Scorched floor patch — organic, mostly transparent, sits at the same layer as
  // every other floor decal (puddles, wood pads).
  const scorchMat = new THREE.MeshBasicMaterial({ map: makeScorchTexture(), transparent: true, depthWrite: false });
  const scorch = new THREE.Mesh(new THREE.PlaneGeometry(R * 2.15, R * 2.15), scorchMat);
  scorch.rotation.x = -Math.PI / 2;
  scorch.position.y = FLOOR_Y.decal;
  scorch.renderOrder = 1;
  g.add(scorch);

  // Bright glow halo, centred exactly on the real hazard boundary.
  const ringNorm = 0.84;
  const glowPlaneR = R / ringNorm * 1.02;
  const glowMat = new THREE.MeshBasicMaterial({
    map: makeHazardGlowTexture(),
    transparent: true,
    depthWrite: false,
    blending: THREE.AdditiveBlending,
  });
  const glow = new THREE.Mesh(new THREE.PlaneGeometry(glowPlaneR * 2, glowPlaneR * 2), glowMat);
  glow.rotation.x = -Math.PI / 2;
  glow.position.y = FLOOR_Y.fine;
  glow.renderOrder = 2;
  g.add(glow);

  // Crisp crest line right on the boundary — the "bright defined edge" the glow
  // alone can't quite give at gameplay camera distance.
  const crisp = mesh(
    new THREE.RingGeometry(R - 0.03, R + 0.03, 64),
    flatMat('#FFDCA0', { transparent: true, opacity: 0.8 }),
    'hazard_ring_crisp'
  );
  crisp.rotation.x = -Math.PI / 2;
  crisp.position.y = FLOOR_Y.fine + 0.002;
  noOutline(crisp);
  g.add(crisp);

  // Heat-shimmer wisps drifting up off the boundary — cheap stand-in for real
  // screen-space refraction, animated (rise + fade, looping) in the arena's update().
  const wisps: THREE.Mesh[] = [];
  const wispCount = 7;
  for (let i = 0; i < wispCount; i++) {
    const a = (i / wispCount) * Math.PI * 2 + 0.35;
    const wispMat = flatMat('#FFE6B8', { transparent: true, opacity: 0.28 });
    const wisp = mesh(new THREE.ConeGeometry(R * 0.1, R * 0.36, 8, 1, true), wispMat, 'hazard_wisp__no_outline');
    noOutline(wisp);
    wisp.position.set(Math.cos(a) * R * 0.96, 0.04, Math.sin(a) * R * 0.96);
    wisp.userData.baseY = wisp.position.y;
    wisp.userData.phase = i * 0.7;
    g.add(wisp);
    wisps.push(wisp);
  }

  return { group: g, glowMat, wisps };
}

/**
 * Scattered loose ingredients ringing the hub — bold, small, deterministic (seeded
 * RNG, not `Math.random()`) so the arena is identical across rebuilds/hot-reloads.
 * Kept purely decorative (no CoverBox) at a radius that never reaches an existing
 * prop, so it adds visual density without touching collision.
 */
function buildHubDebris(M: Materials): THREE.Group {
  const g = new THREE.Group();
  noOutline(g);
  let seed = 733;
  const rand = () => { seed = (seed * 16807) % 2147483647; return seed / 2147483647; };
  const mats = [M.tomato, M.onion, M.lettuce];
  const count = 12;
  for (let i = 0; i < count; i++) {
    const ang = rand() * Math.PI * 2;
    const r = 104 + rand() * 30; // 104..134 wu — clear of the hazard glow and every hub prop
    const wx = CENTER.x + Math.cos(ang) * r;
    const wy = CENTER.y + Math.sin(ang) * r;
    const s = 0.08 + rand() * 0.06;
    const item = mesh(new THREE.SphereGeometry(s, 8, 6), mats[i % mats.length], 'hub_debris_veg');
    const p = groundPos(wx, wy);
    item.position.set(p.x, s * 0.7, p.z);
    item.scale.y = 0.7;
    item.rotation.y = rand() * Math.PI * 2;
    g.add(item);
  }
  return g;
}

function buildFloor(M: Materials): THREE.Group {
  const g = new THREE.Group();
  noOutline(g);

  // Subfloor — extends past the playfield edge so nothing reads as a table-edge cliff.
  const base = mesh(
    new THREE.PlaneGeometry(wu(ARENA_W + 300), wu(ARENA_H + 300)),
    M.subfloor,
    'floor_base'
  );
  base.rotation.x = -Math.PI / 2;
  base.position.set(wu(CENTER.x), FLOOR_Y.subfloor, wu(CENTER.y));
  noOutline(base);
  g.add(base);

  // Checkerboard tile field, 100wu (5m) tiles, small gaps show the subfloor as grout.
  const TILE = 100;
  const cols = ARENA_W / TILE; // 14, exact
  const rows = ARENA_H / TILE; // 10, exact
  const tileGeo = roundedBox(wu(TILE) * 0.94, 0.03, wu(TILE) * 0.94, 0.04, 2);
  const total = cols * rows;
  const lightMesh = new THREE.InstancedMesh(tileGeo, M.tileLight, Math.ceil(total / 2) + 1);
  const darkMesh = new THREE.InstancedMesh(tileGeo, M.tileDark, Math.ceil(total / 2) + 1);
  lightMesh.receiveShadow = true;
  darkMesh.receiveShadow = true;
  noOutline(lightMesh);
  noOutline(darkMesh);
  let li = 0, di = 0;
  const m4 = new THREE.Matrix4();
  for (let i = 0; i < cols; i++) {
    for (let j = 0; j < rows; j++) {
      const wx = i * TILE + TILE / 2;
      const wy = j * TILE + TILE / 2;
      m4.makeTranslation(wu(wx), FLOOR_Y.tile, wu(wy));
      if ((i + j) % 2 === 0) lightMesh.setMatrixAt(li++, m4);
      else darkMesh.setMatrixAt(di++, m4);
    }
  }
  lightMesh.count = li;
  darkMesh.count = di;
  lightMesh.instanceMatrix.needsUpdate = true;
  darkMesh.instanceMatrix.needsUpdate = true;
  g.add(lightMesh, darkMesh);

  // Teal-tiled zones — four small cool floor patches under the hub's four
  // chokepoint props (the N/S lane pots, the E/W spice carts), the same "sits under
  // a cluster" treatment as the wood pantry pads. A first pass tried one continuous
  // ring around the whole hub at this radius and it just recreated the original
  // problem in a new colour: at this frame width (~360wu across) any full circle
  // out past ~r100 reads as a second giant disc dominating the shot, and it landed
  // exactly on the ring where the spawned cast stands. Four discrete patches sized
  // to their prop, elongated along the open lane so they clear the stove islands
  // on the cross-axis, read as floor styling instead.
  const tealZones: Array<[number, number, number, number]> = [
    [CENTER.x, CENTER.y - 242, 150, 80], // north, under the lane pot
    [CENTER.x, CENTER.y + 242, 150, 80], // south, under the lane pot
    [CENTER.x - 175, CENTER.y, 80, 150], // west, under the spice cart
    [CENTER.x + 175, CENTER.y, 80, 150], // east, under the spice cart
  ];
  for (const [zx, zy, zw, zh] of tealZones) {
    const patch = mesh(roundedBox(wu(zw), 0.04, wu(zh), 0.1, 3), M.tealTile, 'floor_teal_zone');
    patch.position.set(wu(zx), FLOOR_Y.decal, wu(zy));
    noOutline(patch);
    g.add(patch);
    const trim = mesh(roundedBox(wu(zw) + 0.06, 0.02, wu(zh) + 0.06, 0.12, 3), M.tealTileDark, 'floor_teal_zone_trim');
    trim.position.set(wu(zx), FLOOR_Y.decal - 0.06, wu(zy));
    noOutline(trim);
    g.add(trim);
  }

  // Scattered ingredients + floor wear around the hub — the empty tan floor in the
  // lane gaps was the single biggest "this feels empty" tell at gameplay framing.
  // Radius band (104-134wu) sits just past the hazard ring and stays clear of every
  // hub prop (nearest is the stove islands' inner corner at ~138wu), so it's safe
  // regardless of angle.
  g.add(buildHubDebris(M));

  // A couple of worn-floor marks near the service counters — grease under the
  // fryer (south), a cool wet sheen under the sink (north), doubling as one more
  // small patch of cool colour close to the hub.
  const grimeSpots: Array<[number, number, number]> = [[672, 792, 20], [733, 805, 15]];
  for (const [gx, gy, gr] of grimeSpots) {
    const spot = mesh(new THREE.CircleGeometry(wu(gr), 12), M.floorGrime, 'floor_grime');
    spot.rotation.x = -Math.PI / 2;
    spot.scale.set(1, 1.3, 1);
    spot.position.set(wu(gx), FLOOR_Y.decal, wu(gy));
    noOutline(spot);
    g.add(spot);
  }
  const wetSpots: Array<[number, number, number]> = [[668, 205, 18], [730, 195, 13]];
  for (const [gx, gy, gr] of wetSpots) {
    const spot = mesh(new THREE.CircleGeometry(wu(gr), 12), M.floorWet, 'floor_wet');
    spot.rotation.x = -Math.PI / 2;
    spot.scale.set(1.3, 1, 1);
    spot.position.set(wu(gx), FLOOR_Y.decal, wu(gy));
    noOutline(spot);
    g.add(spot);
  }

  // Wood pantry pads (NE + SW) — sit above the tile, hiding it under the clusters.
  const woodPads: Array<[number, number, number, number]> = [
    [1170, 185, 280, 260],
    [230, 815, 280, 260],
  ];
  for (const [px, py, pw, ph] of woodPads) {
    const pad = mesh(roundedBox(wu(pw), 0.05, wu(ph), 0.12, 3), M.woodPad, 'floor_woodpad');
    pad.position.set(wu(px), FLOOR_Y.decal, wu(py));
    noOutline(pad);
    g.add(pad);
    for (let s = -2; s <= 2; s++) {
      const seam = mesh(new THREE.BoxGeometry(wu(pw) * 0.96, 0.02, wu(ph) * 0.04), M.woodSeam, 'floor_seam');
      seam.position.set(wu(px), FLOOR_Y.fine, wu(py) + s * wu(ph) * 0.18);
      noOutline(seam);
      g.add(seam);
    }
  }

  // Border trim — thin frame marking the nominal playfield edge.
  const trimT = 0.05;
  const north = mesh(new THREE.BoxGeometry(wu(ARENA_W), 0.06, wu(trimT * 100)), M.border, 'floor_border');
  north.position.set(wu(CENTER.x), FLOOR_Y.decal, wu(-5));
  noOutline(north);
  const south = north.clone();
  south.position.z = wu(ARENA_H + 5);
  const west = mesh(new THREE.BoxGeometry(wu(trimT * 100), 0.06, wu(ARENA_H)), M.border, 'floor_border');
  west.position.set(wu(-5), FLOOR_Y.decal, wu(CENTER.y));
  noOutline(west);
  const east = west.clone();
  east.position.x = wu(ARENA_W + 5);
  g.add(north, south, west, east);

  // Spilled flour — a soft irregular patch near the west prep station.
  const flour = mesh(new THREE.CircleGeometry(wu(38), 16), M.flour, 'floor_flour');
  flour.rotation.x = -Math.PI / 2;
  flour.scale.set(1, 1.4, 1);
  flour.position.set(wu(300), FLOOR_Y.decal, wu(500));
  noOutline(flour);
  g.add(flour);
  const flourSpeck = mesh(new THREE.CircleGeometry(wu(16), 12), M.flour, 'floor_flour_speck');
  flourSpeck.rotation.x = -Math.PI / 2;
  flourSpeck.position.set(wu(330), FLOOR_Y.decal, wu(470));
  noOutline(flourSpeck);
  g.add(flourSpeck);

  return g;
}

// ─────────────────────────────────────────────────────────────────────────────
// Ambient dust motes — a single InstancedMesh, positions drift and wrap per-frame.
// ─────────────────────────────────────────────────────────────────────────────

interface DustField {
  mesh: THREE.InstancedMesh;
  base: THREE.Vector3[];
  phase: number[];
}

function buildDustField(M: Materials, count: number): DustField {
  const geo = new THREE.SphereGeometry(0.025, 6, 6);
  const im = new THREE.InstancedMesh(geo, M.dust, count);
  im.castShadow = false;
  im.receiveShadow = false;
  noOutline(im);
  const base: THREE.Vector3[] = [];
  const phase: number[] = [];
  const m4 = new THREE.Matrix4();
  for (let i = 0; i < count; i++) {
    const x = wu(Math.random() * ARENA_W);
    const z = wu(Math.random() * ARENA_H);
    const y = 0.4 + Math.random() * 1.6;
    base.push(new THREE.Vector3(x, y, z));
    phase.push(Math.random() * Math.PI * 2);
    m4.makeTranslation(x, y, z);
    im.setMatrixAt(i, m4);
  }
  im.instanceMatrix.needsUpdate = true;
  return { mesh: im, base, phase };
}

// ─────────────────────────────────────────────────────────────────────────────
// Cover placement — the single source of truth linking each CoverBox to its visual.
// ─────────────────────────────────────────────────────────────────────────────

interface CoverSpec {
  x: number; y: number; w: number; h: number; kind: string;
  yawDeg?: number;
  build: (wM: number, dM: number) => THREE.Group;
}

function addCover(propsGroup: THREE.Group, cover: CoverBox[], M: Materials, spec: CoverSpec): THREE.Group {
  const wM = wu(spec.w);
  const dM = wu(spec.h);
  const group = spec.build(wM, dM);
  group.add(buildContactShadow(M.contactShadow, wM, dM));
  const p = groundPos(spec.x, spec.y);
  group.position.set(p.x, 0, p.z);
  if (spec.yawDeg) group.rotation.y = THREE.MathUtils.degToRad(spec.yawDeg);
  group.name = `cover:${spec.kind}`;
  propsGroup.add(group);
  cover.push({ x: spec.x, y: spec.y, w: spec.w, h: spec.h, kind: spec.kind });
  return group;
}

// ─────────────────────────────────────────────────────────────────────────────
// Arena factory
// ─────────────────────────────────────────────────────────────────────────────

export const createKitchenArena: ArenaFactory = () => {
  const M = buildMaterials();
  const root = new THREE.Group();
  root.name = 'arena:kitchen';

  const propsGroup = new THREE.Group();
  propsGroup.name = 'arena_props';

  const cover: CoverBox[] = [];

  // ── Floor ────────────────────────────────────────────────────────────────────
  root.add(buildFloor(M));

  // ── Central stove hub ────────────────────────────────────────────────────────
  const HUB_ISLAND_W = 170, HUB_ISLAND_H = 90;
  addCover(propsGroup, cover, M, {
    x: CENTER.x - 175, y: CENTER.y - 150, w: HUB_ISLAND_W, h: HUB_ISLAND_H, kind: 'stove_island',
    build: (w, d) => buildStoveIsland(M, w, d),
  });
  addCover(propsGroup, cover, M, {
    x: CENTER.x + 175, y: CENTER.y - 150, w: HUB_ISLAND_W, h: HUB_ISLAND_H, kind: 'stove_island',
    build: (w, d) => buildStoveIsland(M, w, d, { panRack: true }),
  });
  addCover(propsGroup, cover, M, {
    x: CENTER.x - 175, y: CENTER.y + 150, w: HUB_ISLAND_W, h: HUB_ISLAND_H, kind: 'stove_island', yawDeg: 180,
    build: (w, d) => buildStoveIsland(M, w, d),
  });
  addCover(propsGroup, cover, M, {
    x: CENTER.x + 175, y: CENTER.y + 150, w: HUB_ISLAND_W, h: HUB_ISLAND_H, kind: 'stove_island', yawDeg: 180,
    build: (w, d) => buildStoveIsland(M, w, d),
  });

  addCover(propsGroup, cover, M, {
    x: CENTER.x, y: CENTER.y - 242, w: 55, h: 55, kind: 'stacked_pots',
    build: (w, d) => buildLanePots(M, w, d),
  });
  addCover(propsGroup, cover, M, {
    x: CENTER.x, y: CENTER.y + 242, w: 55, h: 55, kind: 'stacked_pots', yawDeg: 180,
    build: (w, d) => buildLanePots(M, w, d),
  });
  addCover(propsGroup, cover, M, {
    x: CENTER.x - 175, y: CENTER.y, w: 50, h: 50, kind: 'spice_cart',
    build: (w, d) => buildSpiceCart(M, w, d),
  });
  addCover(propsGroup, cover, M, {
    x: CENTER.x + 175, y: CENTER.y, w: 50, h: 50, kind: 'spice_cart', yawDeg: 180,
    build: (w, d) => buildSpiceCart(M, w, d),
  });

  // ── Walk-in freezers (NW / SE) ───────────────────────────────────────────────
  addCover(propsGroup, cover, M, {
    x: 230, y: 190, w: 230, h: 190, kind: 'freezer',
    build: (w, d) => buildFreezerSized(M, w, d),
  });
  addCover(propsGroup, cover, M, {
    x: ARENA_W - 230, y: ARENA_H - 190, w: 230, h: 190, kind: 'freezer', yawDeg: 180,
    build: (w, d) => buildFreezerSized(M, w, d),
  });

  // ── Pantry clusters (NE / SW) ────────────────────────────────────────────────
  // One crate in each pantry cluster is the cool-toned herb crate rather than the
  // warm produce crate — every prop cluster in the arena carries at least one
  // deliberate counterpoint hue instead of being uniformly orange/tan.
  addCover(propsGroup, cover, M, {
    x: 1120, y: 150, w: 90, h: 90, kind: 'herb_crate',
    build: (w, d) => buildHerbCrate(M, w, d),
  });
  addCover(propsGroup, cover, M, {
    x: ARENA_W - 1120, y: ARENA_H - 150, w: 90, h: 90, kind: 'herb_crate', yawDeg: 180,
    build: (w, d) => buildHerbCrate(M, w, d),
  });
  addCover(propsGroup, cover, M, {
    x: 1230, y: 140, w: 80, h: 80, kind: 'produce_crate_tall',
    build: (w, d) => buildCrateTall(M, w, d),
  });
  addCover(propsGroup, cover, M, {
    x: ARENA_W - 1230, y: ARENA_H - 140, w: 80, h: 80, kind: 'produce_crate_tall', yawDeg: 180,
    build: (w, d) => buildCrateTall(M, w, d),
  });
  addCover(propsGroup, cover, M, {
    x: 1175, y: 235, w: 110, h: 70, kind: 'flour_sacks',
    build: (w, d) => buildFlourSack(M, w, d),
  });
  addCover(propsGroup, cover, M, {
    x: ARENA_W - 1175, y: ARENA_H - 235, w: 110, h: 70, kind: 'flour_sacks', yawDeg: 180,
    build: (w, d) => buildFlourSack(M, w, d),
  });

  // ── Prep stations (mid-west / mid-east) ──────────────────────────────────────
  addCover(propsGroup, cover, M, {
    x: 340, y: 420, w: 160, h: 55, kind: 'prep_counter',
    build: (w, d) => buildPrepCounter(M, w, d, { knifeBlock: true }),
  });
  addCover(propsGroup, cover, M, {
    x: 340, y: 580, w: 160, h: 55, kind: 'prep_counter',
    build: (w, d) => buildPrepCounter(M, w, d),
  });
  addCover(propsGroup, cover, M, {
    x: ARENA_W - 340, y: ARENA_H - 420, w: 160, h: 55, kind: 'prep_counter', yawDeg: 180,
    build: (w, d) => buildPrepCounter(M, w, d),
  });
  addCover(propsGroup, cover, M, {
    x: ARENA_W - 340, y: ARENA_H - 580, w: 160, h: 55, kind: 'prep_counter', yawDeg: 180,
    build: (w, d) => buildPrepCounter(M, w, d, { knifeBlock: true }),
  });

  // ── Service counters (fryer south / sink north) ──────────────────────────────
  addCover(propsGroup, cover, M, {
    x: CENTER.x, y: 830, w: 150, h: 70, kind: 'fryer_counter',
    build: (w, d) => buildServiceCounter(M, w, d, 'fryer'),
  });
  addCover(propsGroup, cover, M, {
    x: CENTER.x, y: 170, w: 150, h: 70, kind: 'sink_counter', yawDeg: 180,
    build: (w, d) => buildServiceCounter(M, w, d, 'sink'),
  });

  root.add(propsGroup);
  outlineGroup(propsGroup, 0.006);

  // ── Central hazard — the boiling pot ─────────────────────────────────────────
  const pot = buildPot(M);
  const potPos = groundPos(CENTER.x, CENTER.y);
  pot.group.position.set(potPos.x, 0, potPos.z);
  root.add(pot.group);

  // Hazard ground marking (visual only — not collidable, not a CoverBox). Scorch +
  // glow ring + heat wisps, radius driven directly off POT.dangerRadius so it always
  // matches the real hazard exactly.
  const hazardGround = buildHazardGround(M);
  hazardGround.group.position.set(potPos.x, 0, potPos.z);
  root.add(hazardGround.group);

  const hazards: HazardZone[] = [
    { x: CENTER.x, y: CENTER.y, radius: POT.dangerRadius, kind: 'damage', damage: POT.damage, tickMs: POT.tickMs },
  ];

  // ── Slowing hazards — grease puddle (south) + spilled water (north) ─────────
  const puddleSouth = { x: 560, y: 900, radius: 50 };
  const puddleNorth = { x: ARENA_W - 560, y: ARENA_H - 900, radius: 50 };
  hazards.push(
    { x: puddleSouth.x, y: puddleSouth.y, radius: puddleSouth.radius, kind: 'slow', slowFactor: PUDDLE_SLOW_FACTOR },
    { x: puddleNorth.x, y: puddleNorth.y, radius: puddleNorth.radius, kind: 'slow', slowFactor: PUDDLE_SLOW_FACTOR }
  );

  const puddleGroup = new THREE.Group();
  noOutline(puddleGroup);
  for (const [p, mat] of [[puddleSouth, M.grease], [puddleNorth, M.water]] as const) {
    const disc = mesh(new THREE.CircleGeometry(wu(p.radius), 32), mat, 'puddle');
    disc.rotation.x = -Math.PI / 2;
    const gp = groundPos(p.x, p.y);
    disc.position.set(gp.x, FLOOR_Y.decal, gp.z);
    noOutline(disc);
    puddleGroup.add(disc);
  }
  root.add(puddleGroup);

  // ── Chalkboard menu — freestanding, thin, decorative only ───────────────────
  const board = new THREE.Group();
  board.add(buildContactShadow(M.contactShadow, 0.55, 0.32, 1));
  const legMat = M.crateSlat;
  for (const sx of [-0.24, 0.24]) {
    const leg = mesh(puck(0.02, 0.62, 6), legMat, 'chalkboard_leg');
    leg.position.set(sx, 0.31, 0);
    noOutline(leg);
    board.add(leg);
  }
  const boardFace = mesh(roundedBox(0.62, 0.5, 0.05, 0.03), M.freezerTrim, 'chalkboard_face');
  boardFace.position.y = 0.92;
  board.add(boardFace);
  for (let i = 0; i < 3; i++) {
    const line = mesh(new THREE.BoxGeometry(0.4 - i * 0.06, 0.02, 0.01), M.chalk, 'chalkboard_line__no_outline');
    noOutline(line);
    line.position.set(0, 1.02 - i * 0.1, 0.03);
    board.add(line);
  }
  const boardPos = groundPos(600, 760);
  board.position.set(boardPos.x, 0, boardPos.z);
  board.rotation.y = THREE.MathUtils.degToRad(20);
  outlineGroup(board, 0.005);
  root.add(board);

  // ── Ambient dust ──────────────────────────────────────────────────────────────
  const dust = buildDustField(M, 40);
  root.add(dust.mesh);

  // ── Spawns ────────────────────────────────────────────────────────────────────
  const playerSpawn = { x: 160, y: CENTER.y };
  const enemySpawn = { x: ARENA_W - 160, y: CENTER.y };

  const m4 = new THREE.Matrix4();
  const q = new THREE.Quaternion();
  const s = new THREE.Vector3(1, 1, 1);
  const v = new THREE.Vector3();

  const def: ArenaDefinition = {
    id: 'kitchen',
    displayName: 'The Kitchen',
    width: ARENA_W,
    height: ARENA_H,
    center: CENTER,
    maxSafeRadius: MAX_SAFE_RADIUS,
    playerSpawn,
    enemySpawn,
    cover,
    hazards,
    build: () => root,
    update: (_dt: number, elapsed: number) => {
      // Steam: rise, fade, loop.
      const cycle = 1.6;
      pot.steam.forEach((wisp, i) => {
        const t = ((elapsed + i * 0.5) % cycle) / cycle;
        const baseY = wisp.userData.baseY as number;
        wisp.position.y = baseY + t * 0.5;
        const mat = wisp.material as THREE.MeshBasicMaterial;
        mat.opacity = 0.55 * (1 - t) * (t < 0.15 ? t / 0.15 : 1);
        wisp.scale.setScalar(0.7 + t * 0.6);
      });

      // Bubbling pot: gentle scale pulse, offset per bubble.
      pot.bubbles.forEach((b, i) => {
        const t = elapsed * 2.2 + i * 1.7;
        const k = 0.75 + Math.abs(Math.sin(t)) * 0.5;
        b.scale.setScalar(k);
      });

      // Flickering burner flame.
      const flicker = 0.75 + Math.sin(elapsed * 18) * 0.12 + Math.sin(elapsed * 41 + 1.3) * 0.08;
      pot.flame.scale.set(1, THREE.MathUtils.clamp(flicker, 0.5, 1.15), 1);
      pot.flameCore.scale.set(1, THREE.MathUtils.clamp(flicker * 1.08, 0.5, 1.2), 1);

      // Hazard boundary: a slow breathing pulse on the glow halo, plus heat wisps
      // rising and fading off the ring — the "shimmer" that keeps the danger zone
      // reading as active heat rather than a painted mark.
      hazardGround.glowMat.opacity = 0.75 + Math.sin(elapsed * 2.6) * 0.2;
      const wispCycle = 1.9;
      hazardGround.wisps.forEach((wisp, i) => {
        const t = ((elapsed + (wisp.userData.phase as number)) % wispCycle) / wispCycle;
        const baseY = wisp.userData.baseY as number;
        wisp.position.y = baseY + t * 0.7;
        const mat = wisp.material as THREE.MeshBasicMaterial;
        mat.opacity = 0.3 * (1 - t) * (t < 0.2 ? t / 0.2 : 1);
        wisp.scale.setScalar(0.6 + t * 0.7);
        void i;
      });

      // Slow-drifting dust motes: gentle circular drift + vertical bob, wrapped.
      const bounds = { w: wu(ARENA_W), h: wu(ARENA_H) };
      for (let i = 0; i < dust.base.length; i++) {
        const b = dust.base[i];
        const ph = dust.phase[i];
        const x = ((b.x + Math.sin(elapsed * 0.05 + ph) * 0.6 + Math.cos(elapsed * 0.03) * bounds.w * 0.02) % bounds.w + bounds.w) % bounds.w;
        const z = ((b.z + Math.cos(elapsed * 0.04 + ph) * 0.6) % bounds.h + bounds.h) % bounds.h;
        const y = b.y + Math.sin(elapsed * 0.6 + ph) * 0.15;
        v.set(x, y, z);
        m4.compose(v, q, s);
        dust.mesh.setMatrixAt(i, m4);
      }
      dust.mesh.instanceMatrix.needsUpdate = true;
    },
  };

  return def;
};
