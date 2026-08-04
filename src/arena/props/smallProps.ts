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
  buildDirectionalShadowMesh,
  KPAL,
  type Materials,
} from '../shared';
import { addCoverPlinth, addRoundCoverPlinth, addCoverSides, addCoverCap, COVER_BODY_FRAC } from './counters';

/**
 * Third step down the spice cart's violet ladder — see the same note in
 * `./storage.ts`. `KPAL` gives two violets; the cover grammar needs a bright cap, a
 * mid side and a dark skirt, so the darkest one is authored here at the value we want
 * on screen (the post chain no longer eats a channel, so no pre-compensation).
 */
let cartSkirtMat: THREE.Material | null = null;
function cartSkirt(): THREE.Material {
  if (!cartSkirtMat) cartSkirtMat = toonMat({ color: '#2B1F47', roughness: 0.6 });
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
  const g = new THREE.Group();
  const bw = wM * COVER_BODY_FRAC, bd = dM * COVER_BODY_FRAC;
  const y0 = addCoverPlinth(g, M, wM, dM, 0.18);
  const capT = 0.1;
  const bodyTop = 1.62;

  // Light wheels read AGAINST the near-black plinth band rather than being buried at
  // ground level under the body, which is where the old 0.06m ones were — invisible
  // at every framing this project has ever shot.
  for (const sx of [-1, 1] as const) {
    for (const sz of [-1, 1] as const) {
      const wheel = mesh(puck(0.1, 0.05, 12), M.potMetal, 'cart_wheel__no_outline');
      wheel.rotation.z = Math.PI / 2;
      wheel.position.set(sx * bw * 0.36, y0 * 0.5, sz * (bd * 0.5 - 0.03));
      noOutline(wheel);
      g.add(wheel);
    }
  }

  // Violet body, not the warm cabinetDark used everywhere else — this cart sits
  // dead-centre in the hub chokepoint and is one of the very few props guaranteed
  // to be on-screen in every gameplay frame, so its hue does real work for palette
  // contrast. NOT `tealTileDark` (round-6 fix): that colour belongs to the floor's
  // own decorative hub-zone mat directly beneath this cart.
  //
  // Round-9b: a blind critic measured this prop's top face at luma ~83-103 and its
  // VERTICAL face at ~93 — flat to INVERTED shading, which is exactly why it read as
  // "a flat purple sticker". The bright `spiceCartBody` violet is now the cap only;
  // the sides drop to `spiceCartBodyDark` over a darker skirt.
  addCoverSides(g, bw, bd, y0, bodyTop - capT - y0, M.spiceCartBodyDark, cartSkirt(), 0.05, 'cart_body');
  addCoverCap(g, wM, dM, bodyTop, capT, M.spiceCartBody, 'cart_lid');

  // Mostly-cool jars with a single warm tomato pop — the same "cool field, one warm
  // accent" contrast the reference frames use, just at prop scale.
  //
  // Round-7 fix: these used to be four bare, perfectly-even pucks in a dead-straight
  // row — exactly the "little coloured dots... genuinely unclear as decoration vs
  // pickup" a critic flagged. Two changes kill that read: (1) a shared wood TRAY
  // underneath ties all four into one object — jars sitting IN a rack, not loose
  // items floating on the cart — and (2) each is a two-part jar silhouette (a
  // neutral wood-tone LID stacked on the coloured body), staggered front/back so the
  // row itself is no longer perfectly regular.
  const jarColors = [PALETTE.lettuce, KPAL.herbLeafB, PALETTE.waterCap, PALETTE.tomato];
  const tray = mesh(roundedBox(bw * 0.68, 0.05, bd * 0.34, 0.02), M.woodPad, 'cart_tray');
  tray.position.set(0, bodyTop + 0.025, 0);
  g.add(tray);
  let jx = -bw * 0.26;
  jarColors.forEach((c, i) => {
    const stagger = i % 2 === 0 ? -bd * 0.05 : bd * 0.07;
    const jarY = bodyTop + 0.05;
    const jar = mesh(puck(0.07, 0.17, 10), toonMat({ color: c }), 'cart_jar');
    jar.position.set(jx, jarY + 0.085, stagger);
    g.add(jar);
    const lid = mesh(puck(0.074, 0.035, 10), M.woodSeam, 'cart_jar_lid');
    lid.position.set(jx, jarY + 0.17 + 0.018, stagger);
    noOutline(lid);
    g.add(lid);
    jx += bw * 0.175;
  });

  // Push handle — a trolley read from directly above, where the wheels are edge-on.
  for (const sx of [-1, 1] as const) {
    const post = mesh(puck(0.035, 0.34, 8), M.freezerTrim, 'cart_handle_post');
    post.position.set(sx * bw * 0.4, bodyTop + 0.17, -bd * 0.4);
    noOutline(post);
    g.add(post);
  }
  const handleBar = mesh(puck(0.035, bw * 0.8, 8), M.freezerTrim, 'cart_handle_bar');
  handleBar.rotation.z = Math.PI / 2;
  handleBar.position.set(0, bodyTop + 0.34, -bd * 0.4);
  noOutline(handleBar);
  g.add(handleBar);

  return g;
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
  const g = new THREE.Group();
  const base = Math.min(wM, dM);
  const r = base * 0.42;
  // 0.64 (was 0.62) lands the 60x50wu barrels' crown on the same COUNTER_TOP_Y the
  // whole counter family now shares, so the arena reads with one cover height rather
  // than a scatter.
  const h = base * 0.64;

  const y0 = addRoundCoverPlinth(g, M, r * 1.08, 0.18);
  // Round props get their own RADIAL grounding decal on top of `addCover`'s
  // rounded-rect one — a rect's corners are the wrong shape under a cylinder, which
  // is the grounding complaint that survives at `piece=prop` zoom.
  g.add(buildContactShadow(M.contactShadow, wM, dM, 1.3));

  const upper = opts?.dark ? M.barrelBodyDark : M.barrelBody;
  const skirt = opts?.dark ? M.steelDark : M.barrelBodyDark;
  const skirtH = h * 0.3;
  const lo = mesh(puck(r, skirtH, 20), skirt, 'barrel_skirt');
  lo.position.y = y0 + skirtH / 2;
  g.add(lo);
  const body = mesh(puck(r, h - skirtH, 20), upper, 'barrel_body');
  body.position.y = y0 + skirtH + (h - skirtH) / 2;
  g.add(body);

  for (const frac of [0.3, 0.72]) {
    const hoop = mesh(new THREE.TorusGeometry(r * 1.01, r * 0.08, 6, 18), M.potMetalDark, 'barrel_hoop');
    hoop.rotation.x = Math.PI / 2;
    hoop.position.y = y0 + h * frac;
    g.add(hoop);
  }

  // Thin metal lid rim tracing the top edge — NOT a large dark disc. An earlier pass
  // used a `coverPlinth` cap at 90% of the body's own radius, which from the steep
  // top-down gameplay camera covered almost the whole top face and read as a hollow
  // bucket interior rather than a barrel lid.
  const lidRim = mesh(new THREE.TorusGeometry(r * 0.94, r * 0.07, 6, 20), M.potMetalDark, 'barrel_lid_rim');
  lidRim.rotation.x = Math.PI / 2;
  lidRim.position.y = y0 + h + 0.01;
  g.add(lidRim);

  // Round-9: the bung used to be `coverPlinth` — the reserved near-black BLOCKING
  // colour, unlit, on a small disc in the middle of the barrel's brightest face. A
  // fresh critic read it as a HOLE punched through the mesh, which is what a pure
  // black ellipse on a lit curved surface always reads as. It is now a raised metal
  // cap: a mid-grey plug in the same `potMetal` family as the hoops, ringed so it has
  // an edge instead of being a silhouette.
  const bung = mesh(puck(r * 0.2, 0.06, 14), M.potMetal, 'barrel_bung');
  bung.position.y = y0 + h + 0.03;
  g.add(bung);
  const bungRing = mesh(new THREE.TorusGeometry(r * 0.22, r * 0.035, 6, 14), M.potMetalDark, 'barrel_bung_ring__no_outline');
  bungRing.rotation.x = Math.PI / 2;
  bungRing.position.y = y0 + h + 0.02;
  noOutline(bungRing);
  g.add(bungRing);

  return g;
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
  const post = mesh(puck(0.09, postH, 12), M.steelDark, 'pipe_post');
  post.position.y = postH / 2;
  g.add(post);
  for (let i = 0; i < 3; i++) {
    const band = mesh(new THREE.TorusGeometry(0.1, 0.014, 6, 14), M.freezerTrim, 'pipe_band__no_outline');
    band.rotation.x = Math.PI / 2;
    band.position.y = 0.42 + i * 0.72;
    noOutline(band);
    g.add(band);
  }
  const elbow = mesh(puck(0.12, 0.18, 12), M.freezerTrim, 'pipe_elbow');
  elbow.position.y = postH;
  g.add(elbow);
  const cap = mesh(puck(0.15, 0.05, 14), M.steelDark, 'pipe_cap');
  cap.position.y = postH + 0.115;
  g.add(cap);
  g.add(buildContactShadow(M.contactShadow, 0.3, 0.3, 1.5));
  g.add(buildDirectionalShadowMesh(M, Math.max(1.2, postH * 0.85), 0.5, 0, 0.25));
  return g;
}

/**
 * Hanging order-tag sign on a thin post — the "signage" half of the round-6 kitchen-
 * motif suggestion. Meant for the open mid-lane: the lane view was called the emptiest
 * composition, and this gives it a distinct silhouette between the supply barrels and
 * the hub without adding any new collision. `yawDeg` matches the caller's own mirror
 * flip so the pennant always faces the same way relative to the lane it sits in.
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
  g.add(buildDirectionalShadowMesh(M, Math.max(0.9, postH * 0.7), 0.4, yawDeg, 0.2));
  return g;
}

/**
 * Chalkboard menu — freestanding, thin, decorative only. Always placed at a fixed
 * 20 deg yaw by the caller (see the layout in `../kitchen.ts`); the baked cast shadow
 * below has that same 20 deg hardcoded into its own counter-rotation, matching the
 * `addCover` convention where the shadow's yaw must equal whatever rotation the
 * caller applies to the returned group afterward.
 */
export function buildChalkboardMenu(M: Materials): THREE.Group {
  const board = new THREE.Group();
  board.add(buildContactShadow(M.contactShadow, 0.55, 0.32, 1));
  // yawDeg here must match the board's OWN `rotation.y = 20deg` set by the caller —
  // the shadow direction is a world-space constant, so it has to be counter-rotated by
  // however much this particular group gets spun, same as every `addCover` prop.
  board.add(buildDirectionalShadowMesh(M, 0.75, 0.4, 20, 0.45));
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
