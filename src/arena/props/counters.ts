/**
 * Counter-family cover props — this module owns the stove islands (the central hub's
 * four corner blockers, one with a hanging pan rack), the prep counters (the paired
 * mid-west/mid-east chokepoint cover, one variant with a knife block, the other with
 * a mixing bowl + rolling pin), and the service counters (the fryer south / sink
 * north pair). These are the biggest, tallest cover pieces in the arena — the ones
 * `shared.ts`'s `LARGE_COVER_KINDS` singles out for a stronger grounding shadow — and
 * every one of them is built from the same cabinet + kick + backsplash + steel-top
 * silhouette language (see `addBacksplash`/`addTopRim` in `../shared`).
 *
 * `buildHerbSprig` lives here as a private helper: it's only ever placed on a stove
 * island's counter top, never used by another module.
 */

import * as THREE from 'three';
import { toonMat, roundedBox } from '../../render/toon';
import { PALETTE } from '../../game/rules';
import { puck, mesh, noOutline, addBacksplash, addTopRim, type Materials } from '../shared';

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

export function buildStoveIsland(M: Materials, wM: number, dM: number, opts?: { panRack?: boolean }): THREE.Group {
  const g = new THREE.Group();
  const cabH = 0.92;

  const cabinet = mesh(roundedBox(wM * 0.98, cabH, dM * 0.96, 0.06), M.cabinet, 'stove_cabinet');
  cabinet.position.y = cabH / 2;
  g.add(cabinet);

  // Kick + backsplash both use `coverPlinth` — the one material reserved for
  // BLOCKING across every cover prop in the arena (see the KPAL note). Nothing
  // hazard or decoration ever uses this colour, so it alone signals "this collides."
  const kick = mesh(roundedBox(wM * 0.98, 0.12, dM * 0.96 + 0.02, 0.02), M.coverPlinth, 'stove_kick');
  kick.position.y = 0.06;
  g.add(kick);

  // Back wall + bright cap trim — see `addBacksplash`. Sits further back (-Z) than
  // the pan rack posts below, so on the island that has a rack this reads as "wall
  // behind the hanging pans" rather than clipping through them.
  addBacksplash(g, M, wM, dM, cabH, M.coverPlinthPanel, 0.46);

  // Top is deliberately narrower than the cabinet beneath it — from the steep
  // top-down gameplay camera the top face is almost all you see, so leaving a
  // visible tan rim is what keeps the island reading as a wood cabinet with a
  // steel cap rather than a single flat slab.
  const top = mesh(roundedBox(wM * 0.8, 0.09, dM * 0.72, 0.05), M.steel, 'stove_top');
  top.position.y = cabH + 0.045;
  g.add(top);
  addTopRim(g, M, wM * 0.8, dM * 0.72, cabH + 0.091);

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
  const h = 0.86;
  const cabinet = mesh(roundedBox(wM * 0.98, h, dM * 0.94, 0.06), M.cabinet, 'prep_cabinet');
  cabinet.position.y = h / 2;
  g.add(cabinet);
  const kick = mesh(roundedBox(wM * 0.98, 0.12, dM * 0.94 + 0.02, 0.02), M.coverPlinth, 'prep_kick');
  kick.position.y = 0.06;
  g.add(kick);
  addBacksplash(g, M, wM, dM, h, M.coverPlinthPanel, 0.3);
  const top = mesh(roundedBox(wM * 0.82, 0.08, dM * 0.72, 0.04), M.butcherBlock, 'prep_top');
  top.position.y = h + 0.04;
  g.add(top);
  addTopRim(g, M, wM * 0.82, dM * 0.72, h + 0.081, 0.03);

  // Always-present cutting board + a few chopped-veg cubes, off-centre so it never
  // collides with either the knife block or the bowl/pin below.
  const boardY = h + 0.08;
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
    block.position.set(wM * 0.3, h + 0.08 + 0.13, 0);
    g.add(block);
    for (const a of [-0.5, -0.2, 0.1, 0.4]) {
      const blade = mesh(new THREE.BoxGeometry(0.03, 0.3, 0.07), M.steel, 'knife_blade__no_outline');
      noOutline(blade);
      blade.position.set(wM * 0.3 + Math.sin(a) * 0.07, h + 0.08 + 0.32, Math.cos(a) * 0.04);
      blade.rotation.z = a * 0.5;
      g.add(blade);
    }
  } else if (opts?.rollingPin) {
    // The OTHER counter's distinct topper — a mixing bowl + rolling pin — so this
    // pair reads as two different prep stations rather than a copy-pasted repeat.
    const bowl = mesh(puck(0.16, 0.1, 16), toonMat({ color: PALETTE.lettuce, roughness: 0.5 }), 'prep_bowl');
    bowl.position.set(wM * 0.28, h + 0.08 + 0.05, 0.12);
    g.add(bowl);
    const bowlRimTorus = mesh(new THREE.TorusGeometry(0.16, 0.014, 6, 16), M.rimLight, 'prep_bowl_rim');
    bowlRimTorus.rotation.x = Math.PI / 2;
    bowlRimTorus.position.set(wM * 0.28, h + 0.08 + 0.1, 0.12);
    noOutline(bowlRimTorus);
    g.add(bowlRimTorus);
    const pin = mesh(puck(0.035, 0.36, 10), M.woodPad, 'prep_rolling_pin');
    pin.rotation.z = Math.PI / 2;
    pin.position.set(wM * 0.28, h + 0.08 + 0.035, -0.14);
    g.add(pin);
    for (const side of [-1, 1]) {
      const knob = mesh(puck(0.022, 0.05, 8), M.crateSlat, 'prep_rolling_pin_knob');
      knob.rotation.z = Math.PI / 2;
      knob.position.set(wM * 0.28 + side * 0.205, h + 0.08 + 0.035, -0.14);
      noOutline(knob);
      g.add(knob);
    }
  }

  return g;
}

export function buildServiceCounter(M: Materials, wM: number, dM: number, variant: 'fryer' | 'sink'): THREE.Group {
  const g = new THREE.Group();
  const h = 0.9;
  const cabinet = mesh(roundedBox(wM * 0.98, h, dM * 0.95, 0.06), M.cabinetDark, 'service_cabinet');
  cabinet.position.y = h / 2;
  g.add(cabinet);
  // The cabinet body here is ALREADY cabinetDark, so the kick uses the reserved
  // BLOCKING `coverPlinth` (near-black) to read as a distinct foot band rather than
  // disappearing into the body it's attached to.
  const kick = mesh(roundedBox(wM * 0.98, 0.1, dM * 0.95 + 0.02, 0.02), M.coverPlinth, 'service_kick');
  kick.position.y = 0.05;
  g.add(kick);
  addBacksplash(g, M, wM, dM, h, M.coverPlinthPanel, 0.32);
  const top = mesh(roundedBox(wM * 0.8, 0.09, dM * 0.74, 0.05), M.steel, 'service_top');
  top.position.y = h + 0.045;
  g.add(top);
  addTopRim(g, M, wM * 0.8, dM * 0.74, h + 0.091);

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
