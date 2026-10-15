/**
 * Storage-family cover props — walk-in freezers (NW/SE landmark corners), the pantry
 * cluster crates (produce crates, the cool-toned herb crate, flour sacks), and the
 * hub's stacked-pots chokepoint prop. These are mostly stationary "furniture" cover:
 * bulky, simple silhouettes meant to read at a glance and block a lane or corner,
 * as opposed to the counters (`./counters.ts`, which carry function — burners, prep
 * surfaces, basins) or the small mid-lane/decorative props (`./smallProps.ts`).
 *
 * Every builder here follows the COVER GRAMMAR defined at the top of `./counters.ts`
 * — near-black plinth at full CoverBox footprint, two-tone vertical body, solid mass
 * at least `COVER_MIN_H` tall. Read that block before changing any height here.
 *
 * `buildCrateSmall` is kept here even though nothing currently places it (see
 * `buildHerbCrate`'s doc comment, which references it as the sibling silhouette it
 * was modelled from).
 */

import * as THREE from 'three';
import { toonMat, roundedBox } from '../../render/toon';
import { puck, mesh, noOutline, buildContactShadow, type Materials } from '../shared';
import { addCoverPlinth, addRoundCoverPlinth, addCoverSides, addCoverCap, tinted, COVER_BODY_FRAC, COVER_MIN_H } from './counters';
import { KitGeo, KP, KIT_EDGE, KIT_SIDE, block, cabinetPanels, chamferBox, chamferCyl, fillCrate, flat, paint, sack, skirt, slatCrate, srgb, val } from './kit';

/**
 * Third step down the herb crate's green ladder. `KPAL` lives in `shared.ts` (not this
 * agent's to edit) and stops at two greens, but the cover grammar needs three tones on
 * every prop — bright cap, mid side, dark skirt — so this one is authored here.
 * Built lazily and cached: `buildMaterials()` is per-arena-instance to avoid leaks on
 * hot reload, but a plain colour with no texture has no per-instance state to leak.
 *
 * Authored at the value we actually want on screen: the post chain no longer eats a
 * channel (see PROGRESS's colour-grade note), so there is nothing to pre-compensate.
 */
let herbCrateSkirtMat: THREE.Material | null = null;
function herbSkirt(): THREE.Material {
  if (!herbCrateSkirtMat) herbCrateSkirtMat = toonMat({ color: '#0D3327', roughness: 0.78, rim: false }); // A1: flat skirt, see shared.ts
  return herbCrateSkirtMat;
}

/**
 * Round-9 note, kept because it is the second time this exact mistake has been made
 * here: the crates used to carry a pair of `wM * 1.02`, yaw-ROTATED slat boxes. Those
 * were wider than the CoverBox they belonged to and rotated off-axis, so from the
 * gameplay camera they read as a spiky star-shaped DECAL poking out from under a flat
 * green square — actively reinforcing the "is this a floor mat?" confusion this round
 * exists to fix. The first replacement was an axis-aligned band hugging the box, which
 * rendered as a dark letterbox SLOT cut into the face. Neither survived a look at the
 * pixels. Horizontal articulation on these crates now comes only from the two-tone
 * skirt and the stacked-box seam, both of which are real silhouette steps rather than
 * stripes painted across a face.
 */

export function buildFreezerSized(M: Materials, wM: number, dM: number): THREE.Group {
  // ── A2a: the walk-in, BUILT — insulated steel panel walls (raised panels, the seams
  // between them a value step darker), a door on the front with a chunky handle, two
  // hinges and a frosted window, a roof slab with a lit chamfer and a steel parapet, the
  // upper box set back on it, and a condenser with a fan grille. Same footprint, same
  // heights (body 2.4 m, upper box +1.15 m), same CoverBox.
  const g = new THREE.Group();
  const kg = new KitGeo();
  const bw = wM * COVER_BODY_FRAC, bd = dM * COVER_BODY_FRAC;
  const wall = srgb('#4E9CCB'), roof = srgb('#86D3F2'), trim = KP.steel;
  const y0 = block(kg, 0, 0, 0, wM, 0.2, dM, 0.05, paint(val(KP.plinth, 1.1), KP.plinth), 'matte', { bands: [0.08] });
  const bodyTop = 2.4, capT = 0.14;
  block(kg, 0, y0, 0, bw, bodyTop - capT - y0, bd, 0.08, paint(val(wall, 0.84), val(wall, 0.84)), 'gloss', { aoK: 0.7 });
  cabinetPanels(kg, bw, bd, y0, bodyTop - capT, wall);
  // the roof slab and its parapet rail
  kg.add(chamferBox(wM * 0.99, capT, dM * 0.99, 0.06), { y: bodyTop - capT }, paint(roof, val(roof, KIT_SIDE), val(roof, KIT_EDGE)), 'gloss', bodyTop - capT, 0.5);
  const pT = Math.min(wM, dM) * 0.04, pw = wM * 0.97, pd = dM * 0.97, pH = 0.22;
  for (const [x, z, w, d] of [[0, pd / 2 - pT / 2, pw, pT], [0, -pd / 2 + pT / 2, pw, pT], [pw / 2 - pT / 2, 0, pT, pd - pT * 2], [-pw / 2 + pT / 2, 0, pT, pd - pT * 2]] as const) {
    kg.add(chamferBox(w, pH, d, 0.04, { noVEdges: true }), { x, y: bodyTop, z }, paint(trim, val(trim, 0.86)), 'gloss', bodyTop, 0.4);
  }
  // two raised standing seams across the roof, either side of the condenser — a value step
  // DARKER than the roof so they read as seams at 58 deg, not as a sheen
  for (const sxf of [0.145, 0.44]) {
    kg.add(chamferBox(0.14, 0.07, pd - pT * 2, 0.02, { noVEdges: true }), { x: wM * sxf, y: bodyTop }, paint(val(roof, 0.84), val(roof, 0.72), val(roof, 1.05)), 'gloss', 0, 0);
  }
  // roof furniture, so the largest top in the arena is not one plane: an access hatch, two
  // mushroom vents (LIGHT caps — a dark disc on this roof was once read as a burner) and a
  // conduit run from the upper box to the condenser
  const hx = wM * 0.3, hz = -dM * 0.24;
  kg.add(chamferBox(1.3, 0.16, 1.1, 0.05), { x: hx, y: bodyTop, z: hz }, paint(val(roof, 1.06), val(roof, 0.82), val(roof, 1.18)), 'gloss', bodyTop, 0.5);
  kg.add(chamferBox(0.5, 0.06, 0.08, 0.02, { noVEdges: true }), { x: hx, y: bodyTop + 0.16, z: hz + 0.36 }, paint(KP.iron), 'matte', 0, 0);
  for (const [vx, vz] of [[wM * 0.04, dM * 0.3], [-wM * 0.36, dM * 0.3]] as const) {
    kg.add(chamferCyl(0.12, 0.42, 0.03, 10), { x: vx, y: bodyTop, z: vz }, paint(val(trim, 0.9), val(trim, 0.78)), 'gloss', bodyTop, 0.5);
    kg.add(chamferCyl(0.3, 0.12, 0.05, 12), { x: vx, y: bodyTop + 0.42, z: vz }, paint(val(trim, 1.05), val(trim, 0.85), val(trim, 1.15)), 'gloss', 0, 0);
  }
  kg.add(chamferBox(wM * 0.44, 0.12, 0.14, 0.03, { noVEdges: true }), { x: wM * 0.06, y: bodyTop, z: dM * 0.08 }, paint(val(trim, 0.92), val(trim, 0.75)), 'gloss', bodyTop, 0.4);
  // the upper box, set back toward the -x/-z corner
  const uw = wM * 0.56, ud = dM * 0.6, uh = 1.15, ux = -wM * 0.16, uz = -dM * 0.16;
  skirt(kg, { x: ux, z: uz }, bodyTop, uw / 2, ud / 2, 0.35, roof, 'gloss', 0.35, 0, { x0: -pw / 2 + pT, x1: pw / 2 - pT, z0: -pd / 2 + pT, z1: pd / 2 - pT });
  block(kg, ux, bodyTop, uz, uw, uh - 0.12, ud, 0.07, paint(val(wall, 0.84), val(wall, 0.84)), 'gloss', { bands: [0.2, 0.5], aoK: 0.6 });
  kg.add(chamferBox(uw * 1.02, 0.12, ud * 1.02, 0.05), { x: ux, y: bodyTop + uh - 0.12, z: uz }, paint(roof, val(roof, KIT_SIDE), val(roof, KIT_EDGE)), 'gloss', 0, 0);
  for (const f of [-0.2, 0.2]) {
    kg.add(chamferBox(0.14, 0.07, ud * 0.98, 0.02, { noVEdges: true }), { x: ux + uw * f, y: bodyTop + uh, z: uz }, paint(val(roof, 0.84), val(roof, 0.72), val(roof, 1.05)), 'gloss', 0, 0);
  }
  // the door on the front face: a recessed frame, the door leaf, handle, hinges, window
  const doorW = bw * 0.36, doorH = (bodyTop - capT - y0) * 0.8, fz = bd / 2;
  kg.add(chamferBox(doorW + 0.24, 0.07, doorH + 0.12, 0.025, { noVEdges: true }), { x: 0, y: y0 + doorH / 2 + 0.06, z: fz, rx: Math.PI / 2 }, paint(val(trim, 0.85)), 'gloss', 0, 0);
  kg.add(chamferBox(doorW, 0.12, doorH, 0.04), { x: 0, y: y0 + doorH / 2 + 0.06, z: fz + 0.02, rx: Math.PI / 2 }, paint(val(wall, 1.12), val(wall, 0.9), val(wall, 1.28)), 'gloss', 0, 0);
  kg.add(chamferBox(doorW * 0.42, 0.06, doorH * 0.2, 0.02, { noVEdges: true }), { x: 0, y: y0 + doorH * 0.78, z: fz + 0.14, rx: Math.PI / 2 }, flat(srgb('#CFEFFF')), 'gloss', 0, 0);
  kg.add(chamferBox(0.12, 0.12, doorH * 0.32, 0.03), { x: doorW * 0.36, y: y0 + doorH * 0.5, z: fz + 0.14, rx: Math.PI / 2 }, paint(KP.iron, val(KP.iron, 0.9), val(trim, 1.0)), 'matte', 0, 0);
  for (const hy of [0.25, 0.75]) kg.add(chamferBox(0.1, 0.1, 0.32, 0.025), { x: -doorW * 0.5, y: y0 + doorH * hy, z: fz + 0.12, rx: Math.PI / 2 }, paint(KP.iron), 'matte', 0, 0);
  // the condenser: a steel box on the roof with LOUVRES on its face. ⚠️ Not a round fan
  // grille on top: the old file records a blind critic reading two dark rings on this roof as
  // burners (*"a burner on ice is a material contradiction"*) — a dark disc on a pale plate is
  // the stove islands' own hob shape. Slats share no shape with anything else on the map.
  const cw = bw * 0.24, cd = bd * 0.26, ch = 0.7, cx = bw * 0.3, cz = bd * 0.2;
  skirt(kg, { x: cx, z: cz }, bodyTop, cw / 2, cd / 2, 0.3, roof, 'gloss', 0.35, 0, { x0: -pw / 2 + pT, x1: pw / 2 - pT, z0: -pd / 2 + pT, z1: pd / 2 - pT });
  block(kg, cx, bodyTop, cz, cw, ch, cd, 0.05, paint(val(roof, 0.96), val(trim, 0.8)), 'gloss', { bands: [0.15], aoK: 0.6 });
  for (let i = 0; i < 4; i++) {
    kg.add(chamferBox(cw * 0.8, 0.05, 0.06, 0.015, { noVEdges: true }), { x: cx, y: bodyTop + ch * 0.25 + i * 0.12, z: cz + cd / 2 + 0.03 }, paint(val(KP.iron, 1.2)), 'matte', 0, 0);
  }
  return kg.emit(g, M);
}

export function buildCrateSmall(M: Materials, wM: number, dM: number): THREE.Group {
  const g = new THREE.Group();
  const bw = wM * COVER_BODY_FRAC, bd = dM * COVER_BODY_FRAC;
  const y0 = addCoverPlinth(g, M, wM, dM);
  const capT = 0.1;
  const h = Math.max(COVER_MIN_H, Math.min(wM, dM) * 0.4) - y0;

  addCoverSides(g, bw, bd, y0, h - capT, M.cabinetDark, M.crateSlat, 0.05, 'crate_body');
  addCoverCap(g, wM, dM, y0 + h, capT, M.crateWood, 'crate_lid');

  const top = y0 + h;
  const tomato = mesh(new THREE.SphereGeometry(0.14, 12, 10), M.tomato, 'crate_tomato');
  tomato.position.set(-bw * 0.18, top + 0.12, bd * 0.1);
  g.add(tomato);
  const lettuce = mesh(new THREE.SphereGeometry(0.15, 10, 8), M.lettuce, 'crate_lettuce');
  lettuce.scale.set(1, 0.75, 1);
  lettuce.position.set(bw * 0.15, top + 0.1, -bd * 0.12);
  g.add(lettuce);

  return g;
}

/**
 * Two produce crates stacked, the upper one smaller and kicked off-axis.
 *
 * Round-9 height fix. This was 0.96m of crate on a 4.0 x 4.0m CoverBox — an aspect
 * ratio of 0.24, which from a 58deg top-down camera is a painted square with a lip,
 * not an object. A STACK rather than one taller box: it fills the footprint at the
 * base (so the visual still matches the collision), gives a stepped silhouette that
 * no flat decal can imitate, and reads as pantry storage rather than a plinth.
 */
export function buildCrateTall(M: Materials, wM: number, dM: number): THREE.Group {
  // ── A2a: three SLATTED crates (`./kit.ts` `slatCrate`) in the same stack the old slabs
  // made — a lidded base crate at 0.95 of the footprint, an OPEN crate of produce on it
  // turned 0.18 rad, a small lidded crate at its corner turned -0.34 — on the dark band
  // that marks the footprint. Same heights, same offsets, same CoverBox.
  const g = new THREE.Group();
  const kg = new KitGeo();
  const bw = wM * COVER_BODY_FRAC, bd = dM * COVER_BODY_FRAC;
  const y0 = block(kg, 0, 0, 0, wM, 0.2, dM, 0.04, paint(val(KP.plinth, 1.1), KP.plinth), 'matte', { bands: [0.08] });
  const h1 = 1.62, h2 = 0.84, sh = 0.95;
  const slat = val(KP.body, 0.92), post = val(KP.plinth, 1.25);
  const top1 = slatCrate(kg, 0, y0, 0, bw, h1, bd, 0, { slat, post, lid: KP.lidWood });
  // the open crate of onions, and its contact shade on the lid
  const tx = bw * 0.13, tz = -bd * 0.11;
  const lidClip = { x0: -bw / 2, x1: bw / 2, z0: -bd / 2, z1: bd / 2 };
  skirt(kg, { x: tx, z: tz, yaw: 0.18 }, top1, bw * 0.31, bd * 0.31, 0.3, KP.lidWood, 'matte', 0.35, 0, lidClip);
  const top2 = slatCrate(kg, tx, top1, tz, bw * 0.62, h2, bd * 0.62, 0.18, { slat, post, lid: null, aoK: 0.6 });
  fillCrate(kg, tx, top2, tz, bw * 0.62 - 0.3, bd * 0.62 - 0.3, 0.18, [srgb('#F0CF9C'), srgb('#E4B27A'), srgb('#F6DDB0')], 0.36);
  const sx = -bw * 0.28, sz = bd * 0.26;
  skirt(kg, { x: sx, z: sz, yaw: -0.34 }, top1, bw * 0.17, bd * 0.17, 0.22, KP.lidWood, 'matte', 0.35, 0, lidClip);
  slatCrate(kg, sx, top1, sz, bw * 0.34, sh, bd * 0.34, -0.34, { slat, post, lid: KP.lidWood, slats: 2, aoK: 0.6 });
  return kg.emit(g, M);
}

/**
 * Cool-toned herb crate — same stacked silhouette language as `buildCrateTall` but
 * built entirely from the teal-green side of the palette. Exists specifically to break
 * up the orange/tan/cream monochrome the critic called out: a whole crate body in a
 * different hue family, not just a small coloured prop sitting on a warm one.
 *
 * Round-9: this was the single worst offender for "blocking vs walkable is
 * indistinguishable" — 0.82m tall on a 4.5 x 4.5m CoverBox (aspect 0.18), rendered as
 * a flat saturated green square with cones on it and a star of off-axis slats poking
 * out from underneath. Rebuilt to the shared cover grammar.
 */
export function buildHerbCrate(M: Materials, wM: number, dM: number): THREE.Group {
  // ── A2a: the herb crate on the same slatted-crate part, painted green, the top crate
  // OPEN with herb bundles standing out of it (the silhouette break the old leaf cones made).
  const g = new THREE.Group();
  const kg = new KitGeo();
  const bw = wM * COVER_BODY_FRAC, bd = dM * COVER_BODY_FRAC;
  const y0 = block(kg, 0, 0, 0, wM, 0.2, dM, 0.04, paint(val(KP.plinth, 1.1), KP.plinth), 'matte', { bands: [0.08] });
  const h1 = 1.64, h2 = 0.86, sh = 0.95;
  const slat = KP.herbWood, post = val(KP.herbWood, 0.68), lid = val(KP.herbWood, 1.22);
  const top1 = slatCrate(kg, 0, y0, 0, bw, h1, bd, 0, { slat, post, lid });
  const tx = -bw * 0.14, tz = bd * 0.13;
  const lidClip = { x0: -bw / 2, x1: bw / 2, z0: -bd / 2, z1: bd / 2 };
  skirt(kg, { x: tx, z: tz, yaw: -0.2 }, top1, bw * 0.3, bd * 0.3, 0.3, lid, 'matte', 0.35, 0, lidClip);
  const top2 = slatCrate(kg, tx, top1, tz, bw * 0.6, h2, bd * 0.6, -0.2, { slat, post, lid: null, aoK: 0.6 });
  // leafy greens heaped out of the open crate (soft lumps), with a few spiky sprigs above
  fillCrate(kg, tx, top2 + 0.12, tz, bw * 0.6 - 0.3, bd * 0.6 - 0.3, -0.2, [KP.leafA, KP.leafB, val(KP.leafA, 1.12)], 0.42);
  for (const [ox, oz] of [[-0.5, 0.25], [0.45, -0.3]] as const) {
    kg.add(new THREE.ConeGeometry(0.16, 0.6, 6), { x: tx + ox, y: top2 + 0.5, z: tz + oz, rx: ox * 0.3, rz: oz * 0.3 },
      (_p, n) => (n.y > 0.3 ? val(KP.leafB, 1.1) : KP.leafB), 'matte', top2, 0.4);
  }
  const sx = bw * 0.27, sz = -bd * 0.25;
  skirt(kg, { x: sx, z: sz, yaw: 0.3 }, top1, bw * 0.165, bd * 0.165, 0.22, lid, 'matte', 0.35, 0, lidClip);
  slatCrate(kg, sx, top1, sz, bw * 0.33, sh, bd * 0.33, 0.3, { slat, post, lid, slats: 2, aoK: 0.6 });
  return kg.emit(g, M);
}

/**
 * Flour sacks on a pallet.
 *
 * Round-9: the two sacks used to be sized off `min(wM, dM) * 0.34` with a 1.15 Y
 * stretch, which on this CoverBox produced 2.74m spheres — 1.3x a character, the
 * TALLEST cover in the arena and openly competing with the cast's silhouettes, while
 * still leaving most of the footprint empty. Three smaller sacks on a proper pallet
 * fill the box, land in the same 1.8-2.2m band as everything else, and keep the
 * soft-organic read that distinguishes this prop from the boxes around it.
 */
export function buildFlourSack(M: Materials, wM: number, dM: number): THREE.Group {
  // ── A2a: a wooden PALLET (bearers + deck boards, the footprint) heaped with burlap
  // sacks (`./kit.ts` `sack`): slumped, necked, tied, flour-dusted. Same seven sacks in the
  // same places as the old spheres, the top two resting on the five below.
  const g = new THREE.Group();
  const kg = new KitGeo();
  const wood = KP.darkWood;
  const bearerH = 0.16, deckT = 0.07;
  for (const bz of [-dM * 0.36, 0, dM * 0.36]) block(kg, 0, 0, bz, wM * 0.98, bearerH, dM * 0.16, 0.03, paint(val(wood, 0.9)), 'matte', { bands: [0.06] });
  const nb = 7, bw = (wM * 0.98) / nb;
  for (let i = 0; i < nb; i++) {
    kg.add(chamferBox(bw - 0.05, deckT, dM * 0.98, 0.025, { noVEdges: true }), { x: -wM * 0.49 + bw * (i + 0.5), y: bearerH, z: 0 },
      paint(val(wood, 1.08 + 0.04 * ((i % 3) - 1)), val(wood, 0.86)), 'matte', bearerH, 0.4);
  }
  const y0 = bearerH + deckT;
  const r = Math.min(wM, dM) * 0.21;
  let yaw = 0.3;
  const at = (x: number, y: number, z: number, rr: number) => {
    sack(kg, x, y, z, rr * 1.15, rr * 0.62, rr * 0.8, yaw, KP.burlap);
    yaw += 0.71;
  };
  const baseTop = y0 + r * 0.62;
  at(-wM * 0.28, y0, dM * 0.13, r);
  at(wM * 0.02, y0, dM * 0.15, r * 1.06);
  at(wM * 0.3, y0, dM * 0.12, r);
  at(-wM * 0.12, y0, -dM * 0.15, r * 1.04);
  at(wM * 0.2, y0, -dM * 0.14, r);
  at(-wM * 0.12, baseTop, dM * 0.0, r * 0.92);
  at(wM * 0.16, baseTop, -dM * 0.02, r * 0.86);
  return kg.emit(g, M);
}

/**
 * Stacked pots — the hub's two lane-mouth chokepoint props.
 *
 * ── Round-10 r3: COVER MUST NOT SHARE A SHAPE FAMILY WITH DAMAGE ──────────────
 * A blind critic classified this prop BLOCKING at **LOW** confidence, the worst score
 * any cover prop got, and named the reason exactly: *"it is the same grey ribbed
 * cylinder on a dark plinth as the boiling-pot hazard in the same frame, just smaller.
 * I cannot tell cover from hazard by looking."* It is right, and it is a gameplay bug,
 * not a taste note: the pot at the centre of the hub does
 * damage, these two sit in the
 * lane mouths either side of it, and both were grey ribbed metal cylinders with a dark
 * base. Mistaking cover for a hazard costs a player tempo; mistaking a hazard for
 * cover costs them the fight.
 *
 * So this prop leaves the hazard's material and silhouette family entirely:
 *   - WARM BRASS instead of the hazard's cold grey steel (`potMetal`/`potMetalDark`
 *     stay reserved to the pot, the hob and the service tops);
 *   - a wooden CRATE BASE under the stack, so the ground contact is a square wooden
 *     step rather than the hazard's round dark foot;
 *   - domed LIDS with a knob on the two lower pots, so the silhouette is a stack of
 *     closed vessels rather than one tapering open cylinder.
 */
export function buildLanePots(M: Materials, wM: number, dM: number): THREE.Group {
  // ── A2a: three stockpots stacked on a low slatted crate — enamelled teal (the old
  // `brass` tint, delivered), each with a proud rolled rim, the lower two lidded, ear
  // handles on the bottom one. Same radii, heights and stacking as the old pucks.
  const g = new THREE.Group();
  const kg = new KitGeo();
  const base = Math.min(wM, dM);
  const enamel = srgb('#36A091'), enamelDark = srgb('#277168');
  const y0 = block(kg, 0, 0, 0, wM, 0.18, dM, 0.04, paint(val(KP.plinth, 1.1), KP.plinth), 'matte', { bands: [0.08] });
  const crateTop = slatCrate(kg, 0, y0, 0, wM * 0.9, 0.42, dM * 0.9, 0, { slat: val(KP.body, 0.92), post: val(KP.plinth, 1.25), lid: KP.lidWood, slats: 2 });
  let y = crateTop;
  const radii = [base * 0.38, base * 0.3, base * 0.21];
  for (let i = 0; i < radii.length; i++) {
    const r = radii[i], h = base * 0.26;
    const body = i % 2 === 0 ? enamel : enamelDark;
    if (i === 0) skirt(kg, { x: 0, z: 0 }, y, 0, 0, 0.16, KP.lidWood, 'matte', 0.4, r, { x0: -wM * 0.45, x1: wM * 0.45, z0: -dM * 0.45, z1: dM * 0.45 });
    kg.add(chamferCyl(r, h, 0.04, 16, { bands: [0.15] }), { y }, paint(val(body, 1.04), body, val(body, 1.18)), 'gloss', y, 0.7);
    kg.add(chamferCyl(r * 1.05, 0.07, 0.03, 16, { cap: false }), { y: y + h - 0.07 }, paint(val(enamelDark, 1.1), enamelDark, val(enamel, 1.25)), 'gloss', 0, 0);
    if (i < radii.length - 1) {
      kg.add(chamferCyl(r * 0.96, 0.08, 0.04, 16), { y: y + h }, paint(val(enamel, 1.1), enamel, val(enamel, 1.25)), 'gloss', y + h, 0.3);
    } else {
      kg.add(chamferCyl(r * 0.96, 0.08, 0.04, 16), { y: y + h }, paint(val(enamel, 1.1), enamel, val(enamel, 1.25)), 'gloss', y + h, 0.3);
      kg.add(chamferCyl(base * 0.05, 0.1, 0.02, 8), { y: y + h + 0.08 }, paint(KP.iron), 'matte', 0, 0);
    }
    if (i === 0) for (const sx of [-1, 1]) kg.add(chamferBox(0.12, 0.08, 0.32, 0.025), { x: sx * (r + 0.05), y: y + h * 0.6 }, paint(KP.iron), 'matte', 0, 0);
    y += h * 0.92;
  }
  return kg.emit(g, M);
}

