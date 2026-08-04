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
import { addCoverPlinth, addRoundCoverPlinth, addCoverSides, addCoverCap, COVER_BODY_FRAC, COVER_MIN_H } from './counters';

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
  if (!herbCrateSkirtMat) herbCrateSkirtMat = toonMat({ color: '#0D3327', roughness: 0.78 });
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
  const g = new THREE.Group();
  const bw = wM * COVER_BODY_FRAC, bd = dM * COVER_BODY_FRAC;
  const y0 = addCoverPlinth(g, M, wM, dM);
  const capT = 0.14;
  const bodyTop = 2.24;

  // The freezer keeps its bright cyan identity on the TOP plane (which is most of what
  // this camera pitch shows of an 11.5 x 9.5m prop) and gives its VERTICAL faces the
  // deep-blue steel tones. Its old body/skirt pair (`freezerBody` over `freezerDoor`)
  // was a ~10% value step, i.e. no step at all on screen — measured.
  addCoverSides(g, bw, bd, y0, bodyTop - capT - y0, M.steel, M.steelDark, 0.09, 'freezer_body');
  addCoverCap(g, wM, dM, bodyTop, capT, M.freezerLid, 'freezer_lid');

  // Door panel + handle on the +Z face (rotated per-instance by the caller via yaw).
  // Kept flush with (never past) the body's outer face — this whole prop's visible
  // silhouette must stay inside its CoverBox footprint. Bright `freezerBody` cyan
  // against the dark steel sides, so the door is now the thing that says "freezer"
  // from ground level, not the whole box.
  const doorH = (bodyTop - capT - y0) * 0.76;
  const door = mesh(roundedBox(bw * 0.5, doorH, 0.08, 0.05), M.freezerBody, 'freezer_door');
  door.position.set(0, y0 + doorH / 2 + 0.06, bd / 2 - 0.04);
  g.add(door);

  const handle = mesh(roundedBox(0.07, doorH * 0.4, 0.05, 0.02), M.freezerTrim, 'freezer_handle');
  handle.position.set(bw * 0.17, y0 + doorH * 0.55, bd / 2 - 0.025);
  g.add(handle);

  // Vent grille — a few thin light strips near the top.
  for (let i = 0; i < 3; i++) {
    const strip = mesh(roundedBox(bw * 0.5, 0.03, 0.02, 0.01), M.freezerLid, 'freezer_vent');
    strip.position.set(-bw * 0.18, bodyTop - capT - 0.22 - i * 0.09, bd / 2 - 0.005);
    noOutline(strip);
    g.add(strip);
  }

  // Round-9: the cold floor glow that used to sit in front of the door is GONE. It
  // was authored at y = 0.02, i.e. underneath `floor.ts`'s opaque utility pad (0.045)
  // that the freezer deliberately stands on, so it has been rendering into the depth
  // buffer and reaching the screen at zero pixels for its entire life. Reviving it
  // would have added one more crisp, saturated, walkable-looking floor decal directly
  // beside solid cover — the exact confusion this round is fixing.

  return g;
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
  const g = new THREE.Group();
  const bw = wM * COVER_BODY_FRAC, bd = dM * COVER_BODY_FRAC;
  const y0 = addCoverPlinth(g, M, wM, dM);
  const h1 = 0.9, h2 = 0.66, capT = 0.1;

  // Each box: dark sides, one thin BRIGHT lid. That single bright plane per box is
  // what the earlier "gold picture-frame rim" was trying to be and failing at — a
  // uniform-width bright outline does not change with light direction, so it reads as
  // an ink line rather than a chamfer. A real slab does.
  addCoverSides(g, bw, bd, y0, h1 - capT, M.cabinetDark, M.crateSlat, 0.05, 'crate_bottom');
  addCoverCap(g, wM, dM, y0 + h1, capT, M.crateWood, 'crate_bottom_lid');

  const topCrate = new THREE.Group();
  addCoverSides(topCrate, bw * 0.78, bd * 0.78, y0 + h1, h2 - capT, M.cabinetDark, M.crateSlat, 0.05, 'crate_top');
  addCoverCap(topCrate, bw * 0.79, bd * 0.79, y0 + h1 + h2, capT, M.crateWood, 'crate_top_lid');
  topCrate.position.set(bw * 0.04, 0, -bd * 0.03);
  topCrate.rotation.y = 0.12;
  g.add(topCrate);

  const onion = mesh(new THREE.SphereGeometry(0.15, 10, 8), M.onion, 'crate_onion');
  onion.position.set(0, y0 + h1 + h2 + 0.12, 0);
  g.add(onion);

  return g;
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
  const g = new THREE.Group();
  const bw = wM * COVER_BODY_FRAC, bd = dM * COVER_BODY_FRAC;
  const y0 = addCoverPlinth(g, M, wM, dM);
  const h1 = 0.88, h2 = 0.66, capT = 0.1;

  addCoverSides(g, bw, bd, y0, h1 - capT, M.herbCrateSlat, herbSkirt(), 0.05, 'crate_body');
  addCoverCap(g, wM, dM, y0 + h1, capT, M.herbCrateWood, 'crate_body_lid');

  const topCrate = new THREE.Group();
  addCoverSides(topCrate, bw * 0.74, bd * 0.74, y0 + h1, h2 - capT, M.herbCrateSlat, herbSkirt(), 0.05, 'crate_top');
  addCoverCap(topCrate, bw * 0.75, bd * 0.75, y0 + h1 + h2, capT, M.herbCrateWood, 'crate_top_lid');
  topCrate.position.set(-bw * 0.05, 0, bd * 0.04);
  topCrate.rotation.y = -0.15;
  g.add(topCrate);

  // Bundled herb sprigs instead of loose produce — bold cone clusters read as
  // bunched greens at gameplay distance without needing fine leaf detail. Sized as
  // a fraction of the crate's own footprint (not a fixed metre size) so it stays
  // legible whatever scale this crate is built at.
  const crown = y0 + h1 + h2;
  const leafR = Math.min(bw, bd) * 0.055;
  const bundlePositions: Array<[number, number]> = [[-bw * 0.14, bd * 0.1], [bw * 0.12, -bd * 0.12]];
  const leafMats = [M.herbLeafA, M.herbLeafB];
  bundlePositions.forEach(([sx, sz]) => {
    for (let k = 0; k < 3; k++) {
      const leaf = mesh(new THREE.ConeGeometry(leafR, leafR * 2.6, 7), leafMats[k % 2], 'crate_herb_leaf');
      const a = (k / 3) * Math.PI * 2;
      leaf.position.set(sx + Math.cos(a) * leafR, crown + leafR * 1.3, sz + Math.sin(a) * leafR);
      leaf.rotation.set(Math.sin(a) * 0.3, 0, Math.cos(a) * 0.3);
      g.add(leaf);
    }
  });

  return g;
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
  const g = new THREE.Group();
  // A PALLET, not a bare plinth. The first pass put the standard 0.26m near-black
  // band across the whole 5.5 x 3.5m CoverBox with three small sacks on it, and the
  // uncovered remainder rendered as a black VOID cut into the floor — the reserved
  // BLOCKING colour only reads as a base band when a body sits on most of it. So the
  // near-black stays as a thin ground band and a wooden deck covers it, which is also
  // what a real sack stack sits on.
  const kick = addCoverPlinth(g, M, wM, dM, 0.1);
  const deck = mesh(roundedBox(wM * 0.98, 0.13, dM * 0.98, 0.02), M.crateSlat, 'sack_pallet');
  deck.position.y = kick + 0.065;
  g.add(deck);
  const y0 = kick + 0.13;

  const r = Math.min(wM, dM) * 0.23;
  // Five sacks in two offset rows — enough to actually cover the pallet, which is the
  // other half of why the base read as a hole.
  const positions: Array<[number, number, number]> = [
    [-wM * 0.31, 0.03, dM * 0.2],
    [0, 0, dM * 0.24],
    [wM * 0.3, 0.02, dM * 0.18],
    [-wM * 0.16, -0.02, -dM * 0.22],
    [wM * 0.17, -0.01, -dM * 0.2],
  ];
  for (const [sx, dr, sz] of positions) {
    const rr = r + dr;
    const sack = mesh(new THREE.SphereGeometry(rr, 14, 12), M.burlap, 'sack_body');
    sack.scale.set(1.12, 1, 1.12);
    sack.position.set(sx, y0 + rr, sz);
    g.add(sack);
    const tie = mesh(new THREE.TorusGeometry(rr * 0.4, 0.035, 6, 12), M.burlapDark, 'sack_tie');
    tie.rotation.x = Math.PI / 2;
    tie.position.set(sx, y0 + rr * 1.84, sz);
    noOutline(tie);
    g.add(tie);
  }
  return g;
}

export function buildLanePots(M: Materials, wM: number, dM: number): THREE.Group {
  const g = new THREE.Group();
  const base = Math.min(wM, dM);
  // Reserved BLOCKING foot disc — see the COVER GRAMMAR note in `./counters.ts`.
  const y0 = addRoundCoverPlinth(g, M, base * 0.48, 0.2);
  // Round props get a RADIAL contact decal of their own on top of `addCover`'s
  // rounded-rect one: the rect's corners are the wrong shape under a cylinder and the
  // mismatch is the grounding complaint that survives at `piece=prop` zoom. Sized to
  // land just outside the plinth so the visible darkening immediately around the base
  // is circular.
  g.add(buildContactShadow(M.contactShadow, wM, dM, 1.3));
  let y = y0;
  const radii = [base * 0.42, base * 0.34, base * 0.24];
  for (let i = 0; i < radii.length; i++) {
    const h = base * 0.26;
    const pot = mesh(puck(radii[i], h, 16), i % 2 === 0 ? M.potMetal : M.potMetalDark, 'stack_pot');
    pot.position.y = y + h / 2;
    g.add(pot);
    // Thin dark rim tracing each pot's top edge — the same "banding reads as a solid
    // round object" cue the supply barrel's hoops provide.
    const rim = mesh(new THREE.TorusGeometry(radii[i] * 0.99, radii[i] * 0.055, 6, 18), M.potMetalDark, 'stack_pot_rim');
    rim.rotation.x = Math.PI / 2;
    rim.position.y = y + h;
    noOutline(rim);
    g.add(rim);
    y += h * 0.92;
  }
  const handle = mesh(new THREE.TorusGeometry(base * 0.08, 0.02, 6, 12), M.potMetalDark, 'stack_pot_handle');
  handle.rotation.x = Math.PI / 2;
  handle.position.y = y + 0.04;
  noOutline(handle);
  g.add(handle);
  return g;
}
