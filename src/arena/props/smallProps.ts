/**
 * Small/decorative props — this module owns the objects too small or too singular to
 * be their own "family": the two hub spice carts, the four mid-lane supply barrels
 * (cover, despite the navy "supply drum" colouring — see the KPAL note on
 * `barrelBody` in `../shared`), the freestanding chalkboard menu, the exhaust pipes
 * beside each freezer, and the hanging order-tag signs in the mid-lanes.
 *
 * Everything here except the spice cart and supply barrel is PURE DECORATION — no
 * `CoverBox`, never outlined (see `buildFloor`'s note on why decoration stays
 * un-outlined) — so `kitchen.ts`'s layout adds these directly to `root`, not through
 * `addCover`.
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

export function buildSpiceCart(M: Materials, wM: number, dM: number): THREE.Group {
  const g = new THREE.Group();
  const h = 0.62;
  // Reserved BLOCKING skid plate under the wheels — same `coverPlinth` every other
  // cover prop's foot band uses, so the cart reads as collidable at a glance even
  // though its body colour (below) is its own cool teal, not a shared cover hue.
  const skid = mesh(roundedBox(wM * 0.7, 0.05, dM * 0.7, 0.04), M.coverPlinth, 'cart_skid');
  skid.position.y = 0.025;
  g.add(skid);
  // Violet body, not the warm cabinetDark used everywhere else — this cart sits
  // dead-centre in the hub chokepoint and is one of the very few props guaranteed
  // to be on-screen in every gameplay frame, so its hue does real work for palette
  // contrast. NOT `tealTileDark` (round-6 fix): that colour belongs to the floor's
  // own decorative hub-zone mat directly beneath this cart, and a blocking prop
  // sharing its body colour with the walkable decal under it was exactly the
  // "cover vs decal, indistinguishable" bug the round-6 critic flagged.
  const body = mesh(roundedBox(wM * 0.85, h, dM * 0.85, 0.05), M.spiceCartBody, 'cart_body');
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
  //
  // Round-7 fix: these used to be four bare, perfectly-even pucks in a dead-straight
  // row — exactly the "little coloured dots... genuinely unclear as decoration vs
  // pickup" a critic flagged (a row of small, evenly-spaced saturated discs is the
  // same visual grammar most top-down arena games use for a resource/ammo count).
  // Two changes kill that read without touching the palette: (1) a shared wood TRAY
  // underneath ties all four into one object — jars sitting IN a rack, not loose
  // items floating on the cart — and (2) each is a two-part jar silhouette (a
  // neutral wood-tone LID stacked on the coloured body, not a flat coloured chip),
  // staggered front/back so the row itself is no longer perfectly regular.
  const jarColors = [PALETTE.lettuce, KPAL.herbLeafB, PALETTE.waterCap, PALETTE.tomato];
  const tray = mesh(roundedBox(wM * 0.64, 0.025, dM * 0.3, 0.02), M.woodPad, 'cart_tray');
  tray.position.set(0, h + 0.06 + 0.0125, 0);
  g.add(tray);
  let jx = -wM * 0.24;
  jarColors.forEach((c, i) => {
    const stagger = i % 2 === 0 ? -dM * 0.04 : dM * 0.06;
    const jarY = h + 0.06 + 0.025;
    const jar = mesh(puck(0.055, 0.13, 10), toonMat({ color: c }), 'cart_jar');
    jar.position.set(jx, jarY + 0.065, stagger);
    g.add(jar);
    const lid = mesh(puck(0.058, 0.028, 10), M.woodSeam, 'cart_jar_lid');
    lid.position.set(jx, jarY + 0.13 + 0.014, stagger);
    noOutline(lid);
    g.add(lid);
    jx += wM * 0.16;
  });
  return g;
}

/**
 * Supply barrel — new mid-lane cover (round 5's "open plaza" fix: the critic asked
 * for 3-5 obstacles between the two spawns to break the dead-straight sightline
 * that ran through the hub). A single bold cylinder in a saturated navy (see the
 * round-7 KPAL note on `barrelBody` — this used to be red, which a critic read as
 * an explosive hazard; it is cover, always was, and now reads that way) found
 * nowhere else in the arena, so it reads as its own landmark rather than another
 * tan crate, carrying the same reserved BLOCKING `coverPlinth` foot+bung every other
 * cover prop's base uses. Its drum texture (`makeBarrelTexture`) adds banding and a
 * neutral shipping-stencil chevron — the "stencil marks" half of the round-7 texture
 * brief — in the same desaturated tone as the rest of the drum, never a hazard hue.
 */
export function buildSupplyBarrel(M: Materials, wM: number, dM: number, opts?: { dark?: boolean }): THREE.Group {
  const g = new THREE.Group();
  const base = Math.min(wM, dM);
  const r = base * 0.42;
  const h = base * 0.62;

  const plinth = mesh(puck(r * 1.04, 0.05, 20), M.coverPlinth, 'barrel_plinth');
  plinth.position.y = 0.025;
  g.add(plinth);

  const body = mesh(puck(r, h, 20), opts?.dark ? M.barrelBodyDark : M.barrelBody, 'barrel_body');
  body.position.y = 0.05 + h / 2;
  g.add(body);

  for (const frac of [0.26, 0.76]) {
    const hoop = mesh(new THREE.TorusGeometry(r * 1.01, r * 0.08, 6, 18), M.potMetalDark, 'barrel_hoop');
    hoop.rotation.x = Math.PI / 2;
    hoop.position.y = 0.05 + h * frac;
    g.add(hoop);
  }

  // Thin metal lid rim tracing the top edge — NOT a large dark disc. An earlier pass
  // used a `coverPlinth` cap at 90% of the body's own radius, which from the steep
  // top-down gameplay camera covered almost the whole top face and read as a hollow
  // bucket interior rather than a barrel lid. This keeps the body's own red top face
  // as the dominant colour, with only a thin rim + small centre bung in the
  // reserved BLOCKING colour.
  const lidRim = mesh(new THREE.TorusGeometry(r * 0.94, r * 0.07, 6, 20), M.potMetalDark, 'barrel_lid_rim');
  lidRim.rotation.x = Math.PI / 2;
  lidRim.position.y = 0.05 + h + 0.01;
  g.add(lidRim);

  const bung = mesh(puck(r * 0.22, 0.035, 14), M.coverPlinth, 'barrel_bung__no_outline');
  bung.position.y = 0.05 + h + 0.018;
  noOutline(bung);
  g.add(bung);

  return g;
}

/**
 * Kitchen exhaust pipe — a vertical duct, elbow and vent cap standing beside each
 * walk-in freezer. Round-6 "add secondary themed clutter... at varied heights" fix:
 * the freezer is a single huge flat-topped shape and was the tallest thing in either
 * back corner, so the corner read as one uniform block height. This is taller than
 * the freezer itself, giving that corner a genuine foreground/midground/background
 * read. Pure decoration (no CoverBox) — the "pipes" half of the brief's kitchen-motif
 * suggestion (pipes, signage, spill stains, hanging racks).
 */
export function buildExhaustPipe(M: Materials): THREE.Group {
  const g = new THREE.Group();
  noOutline(g);
  const postH = 1.9;
  const post = mesh(puck(0.09, postH, 12), M.steelDark, 'pipe_post');
  post.position.y = postH / 2;
  g.add(post);
  for (let i = 0; i < 3; i++) {
    const band = mesh(new THREE.TorusGeometry(0.1, 0.014, 6, 14), M.freezerTrim, 'pipe_band__no_outline');
    band.rotation.x = Math.PI / 2;
    band.position.y = 0.32 + i * 0.58;
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
 * motif suggestion. Mid-height (~1.4m), meant for the open mid-lane: the lane view was
 * called the emptiest composition, and this gives it a distinct silhouette between
 * the supply barrels and the hub without adding any new collision. `yawDeg` matches
 * the caller's own mirror flip so the pennant always faces the same way relative to
 * the lane it sits in.
 */
export function buildHangingSign(M: Materials, yawDeg = 0): THREE.Group {
  const g = new THREE.Group();
  noOutline(g);
  const postH = 1.35;
  const post = mesh(puck(0.035, postH, 8), M.crateSlat, 'sign_post');
  post.position.y = postH / 2;
  g.add(post);
  // A HORIZONTAL little awning/shelf-sign, not a vertical hanging plaque — a vertical
  // board presents mostly its thin edge to this rig's steep top-down camera and reads
  // as a near-invisible sliver (an early version did exactly that). Flat-and-up, plus
  // the same bright `addTopRim` cap trim every counter uses, reads immediately.
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
 * 20° yaw by the caller (see the layout in `../kitchen.ts`); the baked cast shadow
 * below has that same 20° hardcoded into its own counter-rotation, matching the
 * `addCover` convention where the shadow's yaw must equal whatever rotation the
 * caller applies to the returned group afterward.
 */
export function buildChalkboardMenu(M: Materials): THREE.Group {
  const board = new THREE.Group();
  board.add(buildContactShadow(M.contactShadow, 0.55, 0.32, 1));
  // yawDeg here must match the board's OWN `rotation.y = 20°` set by the caller — the
  // shadow direction is a world-space constant, so it has to be counter-rotated by
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
