/**
 * Small/decorative props — this module owns the objects too small or too singular to
 * be their own "family": the two hub spice carts, the four mid-lane supply barrels
 * (cover, despite the navy "supply drum" colouring — see the KPAL note on
 * `barrelBody` in `../shared`), the freestanding chalkboard menu, the exhaust pipes
 * beside each freezer, and the hanging order-tag signs in the mid-lanes.
 *
 * The spice cart and the supply barrel are COVER and follow the grammar defined at
 * the top of `./counters.ts`. Everything else here is PURE DECORATION — no
 * `CoverBox`, never outlined (see `buildFloor`'s note on why decoration stays
 * un-outlined), and deliberately kept OUT of the cover grammar: nothing that a player
 * can walk through may carry the near-black plinth band, or the band stops meaning
 * "this stops a bullet".
 */

import * as THREE from 'three';
import { toonMat, roundedBox } from '../../render/toon';
import { PALETTE } from '../../game/rules';
import {
  puck,
  mesh,
  noOutline,
  addTopRim,
  buildContactShadow,
  KPAL,
  type Materials,
} from '../shared';
import { addCoverPlinth, addRoundCoverPlinth, addCoverSides, addCoverCap, COVER_BODY_FRAC, COUNTER_TOP_Y } from './counters';
import { KitGeo, KP, barrel, block, cabinetPanels, chamferBox, chamferCyl, paint, srgb, val } from './kit';

/**
 * Third step down the spice cart's violet ladder — see the same note in
 * `./storage.ts`. `KPAL` gives two violets; the cover grammar needs a bright cap, a
 * mid side and a dark skirt, so the darkest one is authored here at the value we want
 * on screen (the post chain no longer eats a channel, so no pre-compensation).
 */
let cartSkirtMat: THREE.Material | null = null;
function cartSkirt(): THREE.Material {
  if (!cartSkirtMat) cartSkirtMat = toonMat({ color: '#2B1F47', roughness: 0.6, rim: false }); // A1: flat skirt, see shared.ts
  return cartSkirtMat;
}

/**
 * Hub spice cart.
 *
 * Round-9 height fix, and the arena's clearest single case of the "blocking vs
 * walkable is indistinguishable" finding: this was a 0.68m body on a 2.5 x 2.5m
 * CoverBox (aspect 0.27) standing on `floor.ts`'s teal hub mat, so a saturated violet
 * rectangle sat inside a saturated teal rectangle at the same crispness and a
 * comparable screen area, and neither one announced which was solid. Height, the
 * plinth band and the two-tone body are all doing that job now; the violet stays,
 * because hue was never the part that was broken.
 */
export function buildSpiceCart(M: Materials, wM: number, dM: number): THREE.Group {
  // ── A2a: a rolling spice cabinet — four iron castors under a painted cabinet with a
  // drawer panel on every face, a raised tray of spice jars on top (coloured contents,
  // wooden lids) and a steel push-bar at the back. Same footprint, same COUNTER_TOP_Y.
  const g = new THREE.Group();
  const kg = new KitGeo();
  const bw = wM * COVER_BODY_FRAC, bd = dM * COVER_BODY_FRAC;
  const wheelY = 0.18;
  const body = srgb('#6D5FB4');
  kg.add(chamferBox(wM, 0.08, dM, 0.03), { y: 0 }, paint(val(KP.plinth, 1.1), KP.plinth), 'matte', 0, 1);
  for (const sx of [-1, 1]) for (const sz of [-1, 1]) {
    kg.add(chamferCyl(0.11, 0.07, 0.025, 10), { x: sx * bw * 0.36, y: 0.08 + 0.11, z: sz * (bd * 0.5 - 0.06), rz: Math.PI / 2 }, paint(KP.iron, val(KP.iron, 0.9), KP.steel), 'matte', 0, 0);
  }
  const topY = COUNTER_TOP_Y - 0.12;
  block(kg, 0, wheelY, 0, bw, topY - wheelY, bd, 0.06, paint(val(body, 1.08), val(body, 0.92)), 'matte', { aoK: 0.6 });
  cabinetPanels(kg, bw, bd, wheelY, topY, body, { pulls: true });
  // the top: a slab with a raised steel rim round a tray
  kg.add(chamferBox(wM * 0.99, 0.12, dM * 0.99, 0.04), { y: topY }, paint(val(body, 1.22), val(body, 1.0), val(body, 1.38)), 'matte', topY, 0.4);
  const ty = topY + 0.12, rimW = 0.06;
  const steel = paint(KP.steel);
  for (const [x, z, w, d] of [[0, bd * 0.42, bw * 0.86, rimW], [0, -bd * 0.42, bw * 0.86, rimW], [bw * 0.42, 0, rimW, bd * 0.84], [-bw * 0.42, 0, rimW, bd * 0.84]] as const) {
    kg.add(chamferBox(w, 0.07, d, 0.02, { noVEdges: true }), { x, y: ty, z }, steel, 'gloss', 0, 0);
  }
  const jars = [KP.leafA, srgb('#E8503A'), srgb('#F2C14E'), srgb('#7FD3E8'), srgb('#C06BD8'), KP.leafB];
  for (let i = 0; i < 6; i++) {
    const jx = -bw * 0.26 + (i % 3) * bw * 0.26, jz = (i < 3 ? -1 : 1) * bd * 0.18;
    kg.add(chamferCyl(0.1, 0.24, 0.025, 10), { x: jx, y: ty, z: jz }, (_p, n) => (n.y > 0.8 ? val(jars[i], 1.1) : jars[i]), 'gloss', ty, 0.4);
    kg.add(chamferCyl(0.105, 0.05, 0.015, 10), { x: jx, y: ty + 0.24, z: jz }, paint(srgb('#C89A5C')), 'matte', 0, 0);
  }
  for (const sx of [-1, 1]) block(kg, sx * bw * 0.4, ty, -bd * 0.44, 0.05, 0.36, 0.05, 0.015, steel, 'gloss', { bands: [], aoK: 0 });
  kg.add(chamferCyl(0.035, bw * 0.84, 0.012, 8), { x: -bw * 0.42, y: ty + 0.36, z: -bd * 0.44, rz: -Math.PI / 2 }, steel, 'gloss', 0, 0);
  return kg.emit(g, M);
}

/**
 * Supply barrel — mid-lane cover, and the ONE prop a fresh blind critic said reads
 * correctly as cover, specifically because of its height relative to its own
 * footprint. Everything the rest of this round does to the boxes is an attempt to get
 * them into the band this prop was already in.
 *
 * Round-7 recolour history: this used to be red, which a critic read as an explosive
 * hazard; it is cover, always was, and now reads that way (see the KPAL note on
 * `barrelBody`). Its drum texture (`makeBarrelTexture`) adds banding and a neutral
 * shipping-stencil chevron in the same desaturated tone as the rest of the drum,
 * never a hazard hue.
 */
export function buildSupplyBarrel(M: Materials, wM: number, dM: number, opts?: { dark?: boolean }): THREE.Group {
  // ── A2a: a built barrel (`./kit.ts` `barrel`) — staves, bulge, steel hoops, a plank lid —
  // on the round dark band that marks its footprint. Same radius and height as the old puck.
  const g = new THREE.Group();
  const kg = new KitGeo();
  const base = Math.min(wM, dM);
  const r = base * 0.42;
  const y0 = 0.18;
  kg.add(chamferCyl(r * 1.08, y0, 0.04, 18), {}, paint(val(KP.plinth, 1.1), KP.plinth), 'matte', 0, 1);
  barrel(kg, 0, y0, 0, r, COUNTER_TOP_Y - y0, opts?.dark ? KP.barrelDark : KP.barrel, val(KP.steel, 0.82));
  return kg.emit(g, M);
}

/**
 * Kitchen exhaust pipe — a vertical duct, elbow and vent cap standing beside each
 * walk-in freezer. Round-6 "add secondary themed clutter... at varied heights" fix:
 * the freezer is a single huge flat-topped shape and was the tallest thing in either
 * back corner, so the corner read as one uniform block height. This is taller than
 * the freezer itself, giving that corner a genuine foreground/midground/background
 * read. Pure decoration (no CoverBox) — and deliberately carries NO plinth band, so
 * the near-black base cue keeps meaning "solid".
 */
export function buildExhaustPipe(M: Materials): THREE.Group {
  const g = new THREE.Group();
  noOutline(g);
  const postH = 2.4;
  // r3: a BASE FLANGE. Two blind critics in a row flagged this pipe as an unreadable
  // floating object — "reads as a floating detached stick, no base contact", "tall thin
  // vertical with a shadow, but no base plinth and no footprint... pepper mill? rolling
  // pin? bollard?" — and both then had to guess whether it was interactive. A 9cm-radius
  // dark cylinder viewed from a 58deg camera shows almost no ground contact, so the eye
  // has nothing to plant it with. A wider stepped foot gives it a real footprint AND
  // says "bolted down, walk around it". It is still DECORATION, so it deliberately does
  // NOT get the near-black `coverPlinthPanel` band that means BLOCKING.
  const footR = 0.3;
  const foot = mesh(puck(footR, 0.1, 14), M.freezerTrim, 'pipe_foot');
  foot.position.y = 0.05;
  g.add(foot);
  const footStep = mesh(puck(footR * 0.66, 0.09, 14), M.steelDark, 'pipe_foot_step');
  footStep.position.y = 0.13;
  g.add(footStep);
  const post = mesh(puck(0.13, postH, 12), M.steelDark, 'pipe_post');
  post.position.y = 0.17 + postH / 2;
  g.add(post);
  for (let i = 0; i < 3; i++) {
    const band = mesh(new THREE.TorusGeometry(0.15, 0.022, 6, 14), M.freezerTrim, 'pipe_band__no_outline');
    band.rotation.x = Math.PI / 2;
    band.position.y = 0.6 + i * 0.72;
    noOutline(band);
    g.add(band);
  }
  const elbow = mesh(puck(0.12, 0.18, 12), M.freezerTrim, 'pipe_elbow');
  elbow.position.y = 0.17 + postH;
  g.add(elbow);
  const cap = mesh(puck(0.15, 0.05, 14), M.steelDark, 'pipe_cap');
  cap.position.y = 0.17 + postH + 0.115;
  g.add(cap);
  g.add(buildContactShadow(M.contactShadow, 0.75, 0.75, 1.4));
  return g;
}

/**
 * Hanging order-tag sign on a thin post — the "signage" half of the round-6 kitchen-
 * motif suggestion. Meant for the open mid-lane: the lane view was called the emptiest
 * composition, and this gives it a distinct silhouette between the supply barrels and
 * the hub without adding any new collision.
 *
 * `yawDeg` is now unused and kept only so `kitchen.ts` (a different owner's file) keeps
 * compiling: it existed solely to counter-rotate this prop's baked directional cast
 * shadow, and `shared.ts` retired that whole decal family in round 9 after measuring
 * it at mean 0.13/255 over 0.75% of pixels. The three calls this module made to
 * `buildDirectionalShadowMesh` are gone, as that file's own note asked.
 */
export function buildHangingSign(M: Materials, yawDeg = 0): THREE.Group {
  const g = new THREE.Group();
  noOutline(g);
  const postH = 1.7;
  const post = mesh(puck(0.035, postH, 8), M.crateSlat, 'sign_post');
  post.position.y = postH / 2;
  g.add(post);
  // A HORIZONTAL little awning/shelf-sign, not a vertical hanging plaque — a vertical
  // board presents mostly its thin edge to this rig's steep top-down camera and reads
  // as a near-invisible sliver (an early version did exactly that).
  const board = mesh(roundedBox(0.42, 0.035, 0.3, 0.02), M.woodPad, 'sign_board');
  board.position.y = postH;
  g.add(board);
  addTopRim(g, M, 0.42, 0.3, postH + 0.018, 0.028);
  const pennant = mesh(new THREE.ConeGeometry(0.1, 0.18, 3), M.barrelBody, 'sign_pennant');
  pennant.rotation.x = Math.PI / 2;
  pennant.position.set(0, postH + 0.02, 0.23);
  g.add(pennant);
  g.add(buildContactShadow(M.contactShadow, 0.24, 0.24, 1.5));
  return g;
}

/**
 * Chalkboard menu — freestanding, thin, decorative only. Placed at a fixed 20 deg yaw
 * by the caller (see the layout in `../kitchen.ts`). It used to carry a baked cast
 * shadow with that same 20 deg hardcoded into a counter-rotation; that decal family is
 * retired (see `buildHangingSign`), so only the radial contact ring remains.
 */
export function buildChalkboardMenu(M: Materials): THREE.Group {
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
  return board;
}
