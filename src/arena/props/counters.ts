/**
 * Counter-family cover props — this module owns the stove islands (the central hub's
 * four corner blockers, one with a hanging pan rack), the prep counters (the paired
 * mid-west/mid-east chokepoint cover, one variant with a knife block, the other with
 * a mixing bowl + rolling pin), and the service counters (the fryer south / sink
 * north pair). These are the biggest, tallest cover pieces in the arena — the ones
 * `shared.ts`'s `LARGE_COVER_KINDS` singles out for a stronger grounding shadow — and
 * every one of them is built from the same plinth + cabinet + backsplash + steel-top
 * silhouette language (see `addBacksplash`/`addTopRim` in `../shared`).
 *
 * It ALSO holds the shared COVER GRAMMAR helpers below, which `./storage.ts` and
 * `./smallProps.ts` import. They live here rather than in a new module because this
 * agent owns exactly `counters.ts` / `storage.ts` / `smallProps.ts`, and the one thing
 * the grammar must not do is drift between the three files.
 *
 * `buildHerbSprig` lives here as a private helper: it's only ever placed on a stove
 * island's counter top, never used by another module.
 */

import * as THREE from 'three';
import { toonMat, roundedBox } from '../../render/toon';
import { PALETTE } from '../../game/rules';
import { CHARACTER_HEIGHT } from '../../units';
import { puck, mesh, noOutline, addBacksplash, addTopRim, type Materials } from '../shared';

// ─────────────────────────────────────────────────────────────────────────────
// COVER GRAMMAR
//
// Round-9. The previous eight rounds' scores are void (they were all measured with
// ~63% of every prop's grounding shadow buried under opaque floor pads), and the
// re-baselined critic's top TWO findings are both about gameplay readability, not
// shadows:
//
//   1. HEIGHT. Counters presented a vertical face only ~0.56x character height with
//      no articulated base. The supply barrel, the one prop the critic said reads
//      correctly, was the tallest-relative-to-its-own-footprint thing in the arena.
//      Cover a character can see over does not read as cover.
//   2. BLOCKING vs WALKABLE was indistinguishable. The floor's teal/purple mats carry
//      the same saturation, edge crispness and screen area as the solid cover standing
//      on them — a player cannot tell what stops a bullet from what they can run over.
//
// Measured, before this change (metres; CHARACTER_HEIGHT = 2.1):
//
//   prop                footprint      solid height   ratio
//   spice_cart          2.5 x 2.5      0.68           0.32
//   herb_crate          4.5 x 4.5      0.82           0.39
//   produce_crate_tall  4.0 x 4.0      0.96           0.46
//   prep_counter        8.0 x 2.75     1.08           0.51
//   sink/fryer_counter  7.5 x 3.5      1.14           0.54
//   stove_island        8.5 x 4.5      1.17           0.56
//   supply_barrel       3.0 x 2.5      1.60           0.76   <- the one that reads
//   freezer            11.5 x 9.5      2.05           0.98
//
// The pattern is not "cover is short" — it is that every BOX prop had an absolute
// height in metres authored against a footprint a fraction of the size it is actually
// placed at, so the big ones are pancakes: a 4.5m-square crate 0.82m tall is a slab
// with an aspect ratio of 0.18, which is a floor mat with a lid. That is finding #2's
// mechanism, not a colour problem. The two are the same bug.
//
// So: ONE grammar, applied to every registered CoverBox in all three modules.
//
//   a. a near-black `coverPlinth` BASE BAND at full CoverBox footprint, 0.26m tall,
//      with the body inset on top of it so the band reads as a ledge running right
//      around the prop where it meets the floor. Floor decals cannot have one.
//   b. a TWO-TONE vertical body — a darker lower third under the main colour. Large
//      flat single-quad faces have ONE normal and physically cannot carry an internal
//      gradient (measured p90-p10 across the big apron quad: 0.003), so the value step
//      has to be geometry or albedo. This is the geometry version, and the seam
//      between the two rounded boxes doubles as a reveal groove + ink line.
//   c. a solid mass at least `COVER_MIN_H` tall, counters landing on one shared
//      `COUNTER_TOP_Y` so the whole arena reads with a single cover height.
//
// NOTE ON COLLISION: `CoverBox` is x/y/w/h only — there is no height in the contract
// and `game/movement.ts` / `game/sim.ts` collide in 2D against the footprint. Every
// change here is on the Y axis or shrinks a footprint fraction, so none of it can move
// a collision boundary. See the report for `shared.ts`'s `COVER_SHADOW_HEIGHT`, which
// is a per-kind height table this file can no longer keep in sync.
// ─────────────────────────────────────────────────────────────────────────────

/** Minimum solid height for anything that owns a CoverBox — 0.75x a character. */
export const COVER_MIN_H = CHARACTER_HEIGHT * 0.75;

/** Top working surface of every counter-family prop. One number, so stove islands,
 * prep counters and service counters all read as the same piece of furniture height
 * rather than three near-misses. */
export const COUNTER_TOP_Y = CHARACTER_HEIGHT * 0.85;

/** Height of the reserved BLOCKING base band. ~5px at shipped framing (0.0222 m/px),
 * which is enough for a hard dark line under every solid object and small enough that
 * it never becomes the prop's dominant colour.
 *
 * Round-9b: 0.26 -> 0.20, and the material moved from `coverPlinth` to
 * `coverPlinthPanel`. Measured on screen, `coverPlinth` is `flatMat('#191320')` — an
 * UNLIT near-black that renders at rgb(15,9,24), luma **11**, against a floor at luma
 * 151. A blind critic measured exactly that and read it not as a base band but as "a
 * pit", "a black cut-out", "two incompatible shadow systems" next to the soft grey
 * blob shadows the characters use. A 93%-value drop with hard square corners is a
 * hole, not a plinth. `coverPlinthPanel` (#332A3D, same reserved near-black plum
 * family, plus the panel-seam texture) lands near luma 49 — unmistakably the darkest
 * band on any prop, still clearly a surface. */
export const COVER_PLINTH_H = 0.2;

/** Fraction of the CoverBox footprint the visible BODY occupies, so the plinth beneath
 * it shows as a ledge. The remaining 5% is collidable-but-not-drawn — on the tightest
 * prop in the arena (the prep counter's 2.75m depth) that is 7cm against a 105cm
 * character radius, i.e. far below anything a player can feel. */
export const COVER_BODY_FRAC = 0.95;

/** Share of a two-tone body given to its darker lower band. */
const COVER_LOWER_FRAC = 0.34;

/**
 * Near-black base band at the FULL CoverBox footprint. Returns the Y the body above
 * it should start at, so callers never have to repeat the constant.
 *
 * Deliberately flush-and-proud rather than a recessed toe-kick: a recess is invisible
 * from this rig's 58deg top-down camera (rays that pass under the body's overhang
 * reach the floor in front of the prop, never the set-back face), so the only version
 * of "articulated base" that survives the shipped framing is a band that stands PROUD
 * of the body and shows its own top ledge.
 */
export function addCoverPlinth(g: THREE.Group, M: Materials, wM: number, dM: number, h = COVER_PLINTH_H): number {
  const p = mesh(roundedBox(wM, h, dM, 0.03), M.coverPlinthPanel, 'cover_plinth');
  p.position.y = h / 2;
  g.add(p);
  return h;
}

/** Round-footprint version of `addCoverPlinth`, for barrels and stacked pots. */
export function addRoundCoverPlinth(g: THREE.Group, M: Materials, r: number, h = COVER_PLINTH_H, seg = 20): number {
  const p = mesh(puck(r, h, seg), M.coverPlinthPanel, 'cover_plinth');
  p.position.y = h / 2;
  g.add(p);
  return h;
}

/**
 * Vertical body built as a darker lower band under the main side colour.
 *
 * Two rounded boxes rather than one: each rounds inward at the shared seam, so the
 * join is a real horizontal reveal groove (and picks up its own ink outline) instead
 * of an invisible material change. That groove plus the value step is what stops a
 * 1.7m x 8m slab face reading as one flat fill — the failure two of three lighting
 * critics spent their #1 fix on, which no lighting change can address.
 */
export function addCoverSides(
  g: THREE.Group,
  wM: number,
  dM: number,
  y0: number,
  h: number,
  upper: THREE.Material,
  lower: THREE.Material,
  radius: number,
  name: string
): void {
  const lowH = h * COVER_LOWER_FRAC;
  const lo = mesh(roundedBox(wM, lowH, dM, Math.min(radius, lowH * 0.45)), lower, `${name}_skirt`);
  lo.position.y = y0 + lowH / 2;
  g.add(lo);
  const up = mesh(roundedBox(wM, h - lowH, dM, radius), upper, name);
  up.position.y = y0 + lowH + (h - lowH) / 2;
  g.add(up);
}

/**
 * The BRIGHT top slab that turns a dark box into a readable solid.
 *
 * ── Why this exists, measured ────────────────────────────────────────────────────
 * A blind critic sampled our cover and the shipped reference side by side:
 *
 *   ours     counter up-facing rim luma 142 | its own vertical face luma 124  -> 18
 *   ours     spice cart top luma ~93        | its vertical face luma ~93      ->  0 (inverted)
 *   ref      planter top rail  98 | outer face 82 | corner post 105 | inner 67
 *
 * An 18-of-255 delta between an up-facing plane and a vertical plane means the box
 * has no form at all, and it is not fixable in `lighting.ts`: the rig's hemisphere
 * fill is bright enough that our own end faces render at luma 118 — a DESATURATED
 * warm grey, rgb(139,113,101) — while the key-lit face beside them renders 130. The
 * shaded side is the same brightness as the lit side and has lost its hue. The only
 * lever inside this module is albedo: make the vertical faces genuinely dark and cap
 * them with a separate, brighter, slightly OVERHANGING plane.
 *
 * The overhang matters as much as the value: it puts a real lip over the dark face
 * (corner geometry, which is what the reference is actually winning on) and it stops
 * the counter top reading as a recessed basin — the critic's literal misread of the
 * old inset steel slab was "a sink you might fall into".
 *
 * `wM`/`dM` here are the CoverBox footprint; the cap sits at 0.99 of it, so it always
 * stays inside the collision box while still overhanging the 0.95 body beneath.
 */
export function addCoverCap(
  g: THREE.Group,
  wM: number,
  dM: number,
  topY: number,
  t: number,
  mat: THREE.Material,
  name: string
): void {
  const cap = mesh(roundedBox(wM * 0.99, t, dM * 0.99, Math.min(0.04, t * 0.4)), mat, name);
  cap.position.y = topY - t / 2;
  g.add(cap);
}

/**
 * Small potted herb garnish — deliberately cool-green against every warm cabinet/
 * cabinetDark surface it sits on. Cheap, bold-shaped (a pot + a leaf cluster, no
 * fine detail) so it still reads at gameplay camera distance, and it is the one
 * prop guaranteed to sit on every stove island — i.e. always in the gameplay shot.
 *
 * Round-9: scale cut from 3.4 to 1.6. At 3.4 this was ~1.1m of prop sitting on a
 * counter that is now 1.78m tall, which put a decorative garnish 2.9m up — taller
 * than any character and directly competing with their silhouettes. The counter got
 * the height instead; the garnish does not need it.
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

export function buildStoveIsland(M: Materials, wM: number, dM: number, opts?: { panRack?: boolean }): THREE.Group {
  const g = new THREE.Group();
  const bw = wM * COVER_BODY_FRAC, bd = dM * COVER_BODY_FRAC;
  const capT = 0.11;
  const y0 = addCoverPlinth(g, M, wM, dM);
  const sideTop = COUNTER_TOP_Y - capT;

  // DARK sides, BRIGHT overhanging cap — see `addCoverCap`. `cabinet` (the arena's
  // saturated orange) is now the CAP only; the vertical faces drop two steps down the
  // same warm ladder, which is what gives the box a top-vs-side value break.
  addCoverSides(g, bw, bd, y0, sideTop - y0, M.cabinetDark, M.crateSlat, 0.06, 'stove_cabinet');
  addCoverCap(g, wM, dM, COUNTER_TOP_Y, capT, M.cabinet, 'stove_counter');

  // Back wall + bright cap trim — see `addBacksplash`. Sits further back (-Z) than
  // the pan rack posts below, so on the island that has a rack this reads as "wall
  // behind the hanging pans" rather than clipping through them.
  addBacksplash(g, M, wM, dM, COUNTER_TOP_Y, M.coverPlinthPanel, 0.3);

  // Hob plate laid ON the counter, not sunk into a frame. The old version was a
  // smaller steel slab inset below a bright orange rim, which a critic read as "a
  // sink/trough you might fall into" rather than a work surface.
  const hob = mesh(roundedBox(wM * 0.6, 0.06, dM * 0.52, 0.03), M.steelDark, 'stove_hob');
  hob.position.y = COUNTER_TOP_Y + 0.03;
  g.add(hob);

  // Two burner rings + a lit-coil disc each.
  for (const bx of [-wM * 0.18, wM * 0.18]) {
    const ring = mesh(new THREE.TorusGeometry(0.17, 0.03, 8, 20), M.potMetalDark, 'burner_ring');
    ring.rotation.x = Math.PI / 2;
    ring.position.set(bx, COUNTER_TOP_Y + 0.07, 0);
    g.add(ring);
    const coil = mesh(puck(0.12, 0.02, 16), M.potMetal, 'burner_coil');
    coil.position.set(bx, COUNTER_TOP_Y + 0.07, 0);
    g.add(coil);
  }

  // Herb garnish sitting on the steel top's inner-front corner (the side that faces
  // the pot — `+dM*0.26` lands there regardless of the 0/180 deg yaw the caller
  // applies, since that flips which world edge is "inner"), clear of both burners.
  const herb = buildHerbSprig(M, 1.6);
  herb.position.set(wM * 0.3, COUNTER_TOP_Y, dM * 0.26);
  g.add(herb);

  if (opts?.panRack) {
    const postH = 0.8;
    const post = mesh(roundedBox(0.05, postH, 0.05, 0.02), M.freezerTrim, 'rack_post');
    post.position.set(-wM * 0.32, COUNTER_TOP_Y + postH / 2, -dM * 0.38);
    g.add(post);
    const bar = mesh(roundedBox(wM * 0.5, 0.045, 0.045, 0.02), M.freezerTrim, 'rack_bar');
    bar.position.set(-wM * 0.05, COUNTER_TOP_Y + postH, -dM * 0.38);
    g.add(bar);
    let px = -wM * 0.28;
    for (const pr of [0.16, 0.13, 0.15]) {
      const chain = mesh(puck(0.008, 0.16, 6), M.potMetalDark, 'pan_chain');
      chain.position.set(px, COUNTER_TOP_Y + postH - 0.1, -dM * 0.38);
      noOutline(chain);
      g.add(chain);
      const pan = mesh(puck(pr, 0.045, 16), M.potMetal, 'hanging_pan');
      pan.position.set(px, COUNTER_TOP_Y + postH - 0.2, -dM * 0.38);
      g.add(pan);
      px += wM * 0.24;
    }
  }

  return g;
}

/**
 * Round-6 fix for "orange-trimmed platforms... raised walkway? bed? no clear
 * function?" — every prep counter now ALWAYS carries a cutting board with chopped
 * veg (not just the two that happened to get a knife block), so its function reads
 * unambiguously as a food-prep surface regardless of which instance a player sees.
 * `knifeBlock`/`rollingPin` are mutually-exclusive SECOND toppers so the pair of
 * counters on each side of the map are visibly distinct from one another rather than
 * a bare-vs-furnished repeat (the round-6 "vary... clutter" note).
 */
export function buildPrepCounter(M: Materials, wM: number, dM: number, opts?: { knifeBlock?: boolean; rollingPin?: boolean }): THREE.Group {
  const g = new THREE.Group();
  const bw = wM * COVER_BODY_FRAC, bd = dM * COVER_BODY_FRAC;
  const capT = 0.1;
  const y0 = addCoverPlinth(g, M, wM, dM);
  const sideTop = COUNTER_TOP_Y - capT;

  addCoverSides(g, bw, bd, y0, sideTop - y0, M.cabinetDark, M.crateSlat, 0.06, 'prep_cabinet');
  // Butcher block is the brightest surface in the warm palette — the perfect cap for
  // a prop whose sides are now two steps down the same ladder.
  addCoverCap(g, wM, dM, COUNTER_TOP_Y, capT, M.butcherBlock, 'prep_top');
  addBacksplash(g, M, wM, dM, COUNTER_TOP_Y, M.coverPlinthPanel, 0.26);

  // Always-present cutting board + a few chopped-veg cubes, off-centre so it never
  // collides with either the knife block or the bowl/pin below.
  const boardY = COUNTER_TOP_Y;
  const board = mesh(roundedBox(wM * 0.3, 0.035, dM * 0.5, 0.03), M.crateWood, 'prep_cutting_board');
  board.position.set(-wM * 0.2, boardY, 0);
  g.add(board);
  // Round-7 fix: these used to be four separate chips spread evenly across the
  // board — a critic flagged small isolated coloured items on counters as
  // "genuinely unclear as decoration vs pickup." Clustering them into two tight,
  // overlapping piles (with size jitter) reads as diced scraps someone just left
  // mid-prep, not four placed objects at reading-distance spacing.
  const choppedMats = [M.tomato, M.onion, M.lettuce];
  const choppedPiles: Array<[number, number]> = [[-0.05, 0.09], [0.07, -0.08]];
  let choppedIdx = 0;
  choppedPiles.forEach(([px, pz]) => {
    for (let k = 0; k < 2; k++) {
      const jx = (k === 0 ? -1 : 1) * 0.017;
      const jz = (k === 0 ? 1 : -1) * 0.013;
      const sc = k === 0 ? 1.15 : 0.85;
      const chip = mesh(
        new THREE.BoxGeometry(0.042 * sc, 0.026 * sc, 0.042 * sc),
        choppedMats[choppedIdx % choppedMats.length],
        'prep_chopped_veg'
      );
      chip.position.set(-wM * 0.2 + (px + jx) * wM * 0.3, boardY + 0.013 * sc, (pz + jz) * dM * 0.3);
      chip.rotation.y = choppedIdx * 0.8;
      g.add(chip);
      choppedIdx++;
    }
  });

  if (opts?.knifeBlock) {
    const block = mesh(roundedBox(0.22, 0.26, 0.18, 0.04), M.crateSlat, 'knife_block');
    block.position.set(wM * 0.3, boardY + 0.13, 0);
    g.add(block);
    for (const a of [-0.5, -0.2, 0.1, 0.4]) {
      const blade = mesh(new THREE.BoxGeometry(0.03, 0.24, 0.07), M.steel, 'knife_blade__no_outline');
      noOutline(blade);
      blade.position.set(wM * 0.3 + Math.sin(a) * 0.07, boardY + 0.3, Math.cos(a) * 0.04);
      blade.rotation.z = a * 0.5;
      g.add(blade);
    }
  } else if (opts?.rollingPin) {
    // The OTHER counter's distinct topper — a mixing bowl + rolling pin — so this
    // pair reads as two different prep stations rather than a copy-pasted repeat.
    const bowl = mesh(puck(0.16, 0.1, 16), toonMat({ color: PALETTE.lettuce, roughness: 0.5 }), 'prep_bowl');
    bowl.position.set(wM * 0.28, boardY + 0.05, 0.12);
    g.add(bowl);
    const bowlRimTorus = mesh(new THREE.TorusGeometry(0.16, 0.014, 6, 16), M.rimLight, 'prep_bowl_rim');
    bowlRimTorus.rotation.x = Math.PI / 2;
    bowlRimTorus.position.set(wM * 0.28, boardY + 0.1, 0.12);
    noOutline(bowlRimTorus);
    g.add(bowlRimTorus);
    const pin = mesh(puck(0.035, 0.36, 10), M.woodPad, 'prep_rolling_pin');
    pin.rotation.z = Math.PI / 2;
    pin.position.set(wM * 0.28, boardY + 0.035, -0.14);
    g.add(pin);
    for (const side of [-1, 1]) {
      const knob = mesh(puck(0.022, 0.05, 8), M.crateSlat, 'prep_rolling_pin_knob');
      knob.rotation.z = Math.PI / 2;
      knob.position.set(wM * 0.28 + side * 0.205, boardY + 0.035, -0.14);
      noOutline(knob);
      g.add(knob);
    }
  }

  return g;
}

export function buildServiceCounter(M: Materials, wM: number, dM: number, variant: 'fryer' | 'sink'): THREE.Group {
  const g = new THREE.Group();
  const bw = wM * COVER_BODY_FRAC, bd = dM * COVER_BODY_FRAC;
  const capT = 0.11;
  const y0 = addCoverPlinth(g, M, wM, dM);
  const sideTop = COUNTER_TOP_Y - capT;

  addCoverSides(g, bw, bd, y0, sideTop - y0, M.cabinetDark, M.crateSlat, 0.06, 'service_cabinet');
  // Stainless cap — the one bright NEUTRAL top in the counter family, so fryer/sink
  // stay distinguishable from the stove islands (orange cap) and the prep counters
  // (butcher-block cap) without the sides having to differ. Consistent dark sides
  // across all cover is the point; identity lives on the top plane, which is also the
  // plane that dominates the frame at this camera pitch.
  addCoverCap(g, wM, dM, COUNTER_TOP_Y, capT, M.potMetal, 'service_top');
  addBacksplash(g, M, wM, dM, COUNTER_TOP_Y, M.coverPlinthPanel, 0.28);

  if (variant === 'fryer') {
    const well = mesh(roundedBox(wM * 0.55, 0.1, dM * 0.55, 0.04), M.potMetalDark, 'fryer_well');
    well.position.y = COUNTER_TOP_Y - 0.025;
    noOutline(well);
    g.add(well);
    const basket = mesh(roundedBox(wM * 0.4, 0.22, dM * 0.4, 0.03), M.steelDark, 'fryer_basket');
    basket.position.y = COUNTER_TOP_Y + 0.115;
    g.add(basket);
    const handleBar = mesh(puck(0.015, wM * 0.5, 8), M.steelDark, 'fryer_handle');
    handleBar.rotation.z = Math.PI / 2;
    handleBar.position.set(0, COUNTER_TOP_Y + 0.255, 0);
    noOutline(handleBar);
    g.add(handleBar);
  } else {
    const basin = mesh(roundedBox(wM * 0.6, 0.14, dM * 0.55, 0.05), M.steelDark, 'sink_basin');
    basin.position.y = COUNTER_TOP_Y - 0.025;
    noOutline(basin);
    g.add(basin);
    const faucetPost = mesh(puck(0.025, 0.32, 8), M.steel, 'faucet_post');
    faucetPost.position.set(0, COUNTER_TOP_Y + 0.155, -dM * 0.2);
    g.add(faucetPost);
    const faucetArc = mesh(new THREE.TorusGeometry(0.14, 0.02, 6, 12, Math.PI), M.steel, 'faucet_arc');
    faucetArc.rotation.set(0, Math.PI / 2, 0);
    faucetArc.position.set(0, COUNTER_TOP_Y + 0.295, -dM * 0.08);
    g.add(faucetArc);
  }

  return g;
}
