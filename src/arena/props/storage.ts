/**
 * Storage-family cover props — walk-in freezers (NW/SE landmark corners), the pantry
 * cluster crates (produce crates, the cool-toned herb crate, flour sacks), and the
 * hub's stacked-pots chokepoint prop. These are mostly stationary "furniture" cover:
 * bulky, simple silhouettes meant to read at a glance and block a lane or corner,
 * as opposed to the counters (`./counters.ts`, which carry function — burners, prep
 * surfaces, basins) or the small mid-lane/decorative props (`./smallProps.ts`).
 *
 * `buildCrateSmall` is kept here even though nothing currently places it (see
 * `buildHerbCrate`'s doc comment, which references it as the sibling silhouette it
 * was modelled from) — this is a pure move, so its unused status is preserved as-is.
 */

import * as THREE from 'three';
import { roundedBox } from '../../render/toon';
import { puck, mesh, noOutline, addTopRim, type Materials } from '../shared';

export function buildFreezerSized(M: Materials, wM: number, dM: number): THREE.Group {
  const g = new THREE.Group();
  const h = 2.05;

  const body = mesh(roundedBox(wM, h, dM, 0.09), M.freezerBody, 'freezer_body');
  body.position.y = h / 2;
  g.add(body);

  // `coverPlinth`, not `freezerTrim` — the freezer's foot band joins the same
  // reserved BLOCKING material as every other cover prop's base (handle/vent below
  // stay `freezerTrim`, since those are per-type accent detail, not the base cue).
  const base = mesh(roundedBox(wM * 0.98, 0.16, dM * 0.98, 0.03), M.coverPlinth, 'freezer_base');
  base.position.y = 0.08;
  g.add(base);

  // Lid cap + bright rim trim — the freezer is the single tallest, biggest-footprint
  // prop in the arena, so at this pitch its top face dominates the silhouette. A
  // lighter inset lid (mirroring the "top narrower than cabinet" trick used on the
  // stove islands) plus a thin light-catching edge keeps that huge top from reading
  // as one flat painted rectangle.
  const lid = mesh(roundedBox(wM * 0.86, 0.05, dM * 0.86, 0.07), M.freezerLid, 'freezer_lid');
  lid.position.y = h + 0.025;
  g.add(lid);
  // A proper THIN FRAME tracing the lid's own edge, not a solid plate stacked above
  // it — a plate this size sitting on top would simply hide the lighter lid entirely
  // from the steep top-down camera.
  addTopRim(g, M, wM * 0.86, dM * 0.86, h + 0.051, 0.05);

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

export function buildCrateSmall(M: Materials, wM: number, dM: number): THREE.Group {
  const g = new THREE.Group();
  const h = 0.82;
  // Dark plinth, same NOMINAL width as the crate body above it (must never exceed the
  // CoverBox footprint) but a much smaller corner radius — the crate body's own
  // rounding (0.05) pulls its silhouette inward near y=0, while this flatter-cornered
  // foot doesn't, so it still visibly peeks out as a "pallet lip" the crate sits IN
  // rather than on top of. Same trick `buildStoveIsland`'s kick band already uses —
  // and, as of round 5, the same reserved BLOCKING `coverPlinth` colour, not the
  // crate's own slat colour.
  const foot = mesh(roundedBox(wM, 0.09, dM, 0.03), M.coverPlinth, 'crate_foot');
  foot.position.y = 0.045;
  g.add(foot);
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

export function buildCrateTall(M: Materials, wM: number, dM: number): THREE.Group {
  const g = new THREE.Group();
  const h1 = 0.5, h2 = 0.46;
  const foot = mesh(roundedBox(wM, 0.09, dM, 0.03), M.coverPlinth, 'crate_foot');
  foot.position.y = 0.045;
  g.add(foot);
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
export function buildHerbCrate(M: Materials, wM: number, dM: number): THREE.Group {
  const g = new THREE.Group();
  const h = 0.82;
  const foot = mesh(roundedBox(wM, 0.09, dM, 0.03), M.coverPlinth, 'crate_foot');
  foot.position.y = 0.045;
  g.add(foot);
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
  // bunched greens at gameplay distance without needing fine leaf detail. Sized as
  // a fraction of the crate's own footprint (not a fixed metre size) so it stays
  // legible whatever scale this crate is built at — a fixed 0.05m cone was invisible
  // against a 4.5m crate top.
  const leafR = Math.min(wM, dM) * 0.065;
  const bundlePositions: Array<[number, number]> = [[-wM * 0.18, dM * 0.12], [wM * 0.16, -dM * 0.14]];
  const leafMats = [M.herbLeafA, M.herbLeafB];
  bundlePositions.forEach(([sx, sz]) => {
    for (let k = 0; k < 3; k++) {
      const leaf = mesh(new THREE.ConeGeometry(leafR, leafR * 2.6, 7), leafMats[k % 2], 'crate_herb_leaf');
      const a = (k / 3) * Math.PI * 2;
      leaf.position.set(sx + Math.cos(a) * leafR, h + leafR * 1.3, sz + Math.sin(a) * leafR);
      leaf.rotation.set(Math.sin(a) * 0.3, 0, Math.cos(a) * 0.3);
      g.add(leaf);
    }
  });

  return g;
}

export function buildFlourSack(M: Materials, wM: number, dM: number): THREE.Group {
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

export function buildLanePots(M: Materials, wM: number, dM: number): THREE.Group {
  const g = new THREE.Group();
  const base = Math.min(wM, dM);
  // Reserved BLOCKING foot disc — see the `coverPlinth` note on `buildStoveIsland`.
  const plinth = mesh(puck(base * 0.46, 0.05, 16), M.coverPlinth, 'stack_pot_plinth');
  plinth.position.y = 0.025;
  g.add(plinth);
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
