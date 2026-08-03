/**
 * Floor — big flat graphic shapes, not fine repeating texture. A checkerboard of
 * 5m tiles (two InstancedMeshes, one per shade) covers the whole playfield; wood
 * pads sit above it under the two pantry nooks; a cool utility mat sits under each
 * freezer; a cool tile ring circles the hub; then a layer of decals on top (grime,
 * wet sheen, flour spills, scattered loose-produce debris, the playfield border
 * trim). This module owns all of that ground dressing — everything a player walks
 * over but never collides with. Cover props (`./props/*`) and the hazard ground
 * markings (`./hazards.ts`) are drawn on top of this, not by it.
 */

import * as THREE from 'three';
import { roundedBox } from '../render/toon';
import { wu, groundPos } from '../units';
import { mesh, noOutline, FLOOR_Y, ARENA_W, ARENA_H, CENTER, type Materials } from './shared';

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
  // `debrisBerry`, not `tomato` (round-6 fix): a bright-red loose sphere scattered on
  // the floor around the hazard ring read exactly like a collectible pickup and sat
  // far too close in hue to the hazard's own amber/red caution grammar. See the KPAL
  // note on `debrisBerry` — red stays exclusive to the hazard everywhere on this map.
  const mats = [M.debrisBerry, M.onion, M.lettuce];
  const count = 12;
  for (let i = 0; i < count; i++) {
    const ang = rand() * Math.PI * 2;
    const r = 104 + rand() * 30; // 104..134 wu — clear of the hazard glow and every hub prop
    const wx = CENTER.x + Math.cos(ang) * r;
    const wy = CENTER.y + Math.sin(ang) * r;
    const s = 0.11 + rand() * 0.08;
    const item = mesh(new THREE.SphereGeometry(s, 8, 6), mats[i % mats.length], 'hub_debris_veg');
    const p = groundPos(wx, wy);
    item.position.set(p.x, s * 0.7, p.z);
    item.scale.y = 0.7;
    item.rotation.y = rand() * Math.PI * 2;
    g.add(item);
  }
  return g;
}

/**
 * Small loose-produce pile anywhere on the map — same bold sphere language as
 * `buildHubDebris`, generalised so a prop cluster can visibly spill its own mess
 * instead of the corner nooks looking like staged furniture. Used to tie the flour
 * sacks to an actual flour spill and give the pantry corners a "someone was just
 * working here" story beat.
 */
function buildDebrisPile(M: Materials, cx: number, cy: number, seed: number, count = 5, spreadWu = 22): THREE.Group {
  const g = new THREE.Group();
  noOutline(g);
  let s = seed;
  const rand = () => { s = (s * 16807) % 2147483647; return s / 2147483647; };
  // `debrisBerry`, not `tomato` (round-6 fix): a bright-red loose sphere scattered on
  // the floor around the hazard ring read exactly like a collectible pickup and sat
  // far too close in hue to the hazard's own amber/red caution grammar. See the KPAL
  // note on `debrisBerry` — red stays exclusive to the hazard everywhere on this map.
  const mats = [M.debrisBerry, M.onion, M.lettuce];
  for (let i = 0; i < count; i++) {
    const ang = rand() * Math.PI * 2;
    const r = rand() * spreadWu;
    const wx = cx + Math.cos(ang) * r;
    const wy = cy + Math.sin(ang) * r;
    const sc = 0.1 + rand() * 0.07;
    const item = mesh(new THREE.SphereGeometry(sc, 8, 6), mats[i % mats.length], 'debris_veg');
    const p = groundPos(wx, wy);
    item.position.set(p.x, sc * 0.7, p.z);
    item.scale.y = 0.7;
    item.rotation.y = rand() * Math.PI * 2;
    g.add(item);
  }
  return g;
}

export function buildFloor(M: Materials): THREE.Group {
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
  // Round-6 fix: these used to be a THICKER patch (0.04) sitting ABOVE a wider, offset
  // "trim" box floating 0.06 BELOW it — two slabs stepped apart read exactly like a
  // raised curb/dais lip, which is precisely the "raised blocking terrain? ground-level
  // cover? or pure floor decal?" ambiguity the critic called out, made worse by the
  // trim sharing its colour (`tealTileDark`) with the spice cart's own body (see that
  // material's KPAL note). These are committed to being PURE FLOOR DECORATION now: a
  // flat two-tone rug — border + fill BOTH the same thin height, barely proud of each
  // other (0.003, just enough to dodge z-fighting) rather than stacked into a step —
  // so there is no raised edge for the eye to mistake for collidable geometry.
  for (const [zx, zy, zw, zh] of tealZones) {
    const trim = mesh(roundedBox(wu(zw) + 0.05, 0.025, wu(zh) + 0.05, 0.1, 3), M.tealTileDark, 'floor_teal_zone_trim');
    trim.position.set(wu(zx), FLOOR_Y.decal, wu(zy));
    noOutline(trim);
    g.add(trim);
    const patch = mesh(roundedBox(wu(zw), 0.025, wu(zh), 0.08, 3), M.tealTile, 'floor_teal_zone');
    patch.position.set(wu(zx), FLOOR_Y.decal + 0.003, wu(zy));
    noOutline(patch);
    g.add(patch);
  }

  // Scattered ingredients + floor wear around the hub — the empty tan floor in the
  // lane gaps was the single biggest "this feels empty" tell at gameplay framing.
  // Radius band (104-134wu) sits just past the hazard ring and stays clear of every
  // hub prop (nearest is the stove islands' inner corner at ~138wu), so it's safe
  // regardless of angle.
  g.add(buildHubDebris(M));

  // A couple of worn-floor marks near the service counters — grease behind the
  // fryer (south, on its far side away from the hub), a cool wet sheen behind the
  // sink (north). Placed on the OUTER side of each counter, clear of both the
  // counter's own CoverBox and the hub teal zone that sits on its inner side.
  const grimeSpots: Array<[number, number, number]> = [[675, 882, 20], [722, 892, 15], [745, 915, 10], [762, 935, 7]];
  for (const [gx, gy, gr] of grimeSpots) {
    const spot = mesh(new THREE.CircleGeometry(wu(gr), 12), M.floorGrime, 'floor_grime');
    spot.rotation.x = -Math.PI / 2;
    spot.scale.set(1, 1.3, 1);
    spot.position.set(wu(gx), FLOOR_Y.decal, wu(gy));
    noOutline(spot);
    g.add(spot);
  }
  const wetSpots: Array<[number, number, number]> = [[675, 118, 18], [722, 108, 13], [655, 90, 9], [640, 68, 6]];
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

  // Round-6 "vary the four corner mats" fix: the freezer corners (NW/SE) had no floor
  // pad at all — only the pantry corners did — so two of the arena's four corners read
  // as bare tile and two read as furnished. A cool utility mat (never used elsewhere;
  // see the KPAL note) gives the freezer corners their own distinct floor treatment, a
  // deliberate cool/industrial counterpoint to the pantry's warm wood.
  // Sized generously beyond the freezer's own 230x190 footprint (unlike a first pass
  // that used only a 30wu margin — so thin the mat was almost entirely hidden under
  // the freezer body itself, the same "peeks out" mistake the pantry wood pads avoid
  // by being sized to their whole cluster, not one prop).
  const utilityPads: Array<[number, number, number, number]> = [
    [230, 190, 420, 340],
    [ARENA_W - 230, ARENA_H - 190, 420, 340],
  ];
  for (const [px, py, pw, ph] of utilityPads) {
    const pad = mesh(roundedBox(wu(pw), 0.03, wu(ph), 0.1, 3), M.utilityMat, 'floor_utility_pad');
    pad.position.set(wu(px), FLOOR_Y.decal, wu(py));
    noOutline(pad);
    g.add(pad);
    // Drain grates sit in the mat's visible margin BEYOND the freezer's own 115wu
    // half-width, not hidden underneath its body.
    for (const ox of [-160, 160]) {
      const drain = mesh(new THREE.TorusGeometry(wu(pw) * 0.032, wu(pw) * 0.008, 6, 16), M.utilityMatDark, 'floor_drain');
      drain.rotation.x = -Math.PI / 2;
      drain.position.set(wu(px + ox), FLOOR_Y.fine, wu(py));
      noOutline(drain);
      g.add(drain);
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

  // Flour spill actually AT the flour-sack props (NE + SW pantry) — the sacks
  // themselves had nothing spilling out of them, which is exactly the "corner props
  // don't cohere into a story" gap: a produce crate with no dropped produce, a flour
  // sack with no spilled flour. Plus a small dropped-produce pile beside each, echoing
  // the hub debris ring at pantry scale.
  const sackSpills: Array<[number, number]> = [[1175, 235], [ARENA_W - 1175, ARENA_H - 235]];
  sackSpills.forEach(([sx, sy], i) => {
    const spill = mesh(new THREE.CircleGeometry(wu(34), 16), M.flour, 'floor_flour');
    spill.rotation.x = -Math.PI / 2;
    spill.scale.set(1.25, 1, 1);
    const dy = i === 0 ? 95 : -95; // mirrored offset, clear of the sack CoverBox's own footprint
    spill.position.set(wu(sx), FLOOR_Y.decal, wu(sy + dy));
    noOutline(spill);
    g.add(spill);
    g.add(buildDebrisPile(M, sx + (i === 0 ? 30 : -30), sy + dy, 5101 + i * 97, 5, 20));
  });

  return g;
}
