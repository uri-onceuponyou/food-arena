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
 *
 * ── Module map ───────────────────────────────────────────────────────────────────
 * This file owns ONLY `createKitchenArena()` itself: the layout (every `addCover`
 * call site and its coordinates), the CoverBox/hazard lists, and wiring `update()`.
 * Everything each prop/system actually LOOKS like lives in its own module so a
 * separate agent can iterate on one without colliding with another:
 *
 *   - `./shared.ts`         — materials, palette, map constants, `addCover`, the
 *                             baked-shadow helpers every builder shares.
 *   - `./floor.ts`          — floor tiles, pads, rugs, spills, grime, wear decals.
 *   - `./hazards.ts`        — the pot assembly, its caution-tape ring, the puddles.
 *   - `./ambient.ts`        — steam/bubble/flame/hazard-shimmer/dust per-frame update.
 *   - `./props/counters.ts` — stove islands, prep counters, service counters.
 *   - `./props/storage.ts`  — freezer, produce/herb crates, flour sacks, lane pots.
 *   - `./props/smallProps.ts` — spice carts, supply barrels, chalkboard, pipes, signs.
 */

import * as THREE from 'three';
import type { ArenaDefinition, ArenaFactory, CoverBox, HazardZone } from './types';
import { outlineGroup } from '../render/toon';
import { groundPos } from '../units';
import { POT, PUDDLE_SLOW_FACTOR } from '../game/rules';
import { buildMaterials, noOutline, ARENA_W, ARENA_H, CENTER, MAX_SAFE_RADIUS, addCover } from './shared';
import { buildFloor } from './floor';
import { buildApron } from './apron';
import { buildPot, buildHazardGround, buildPuddleVisual } from './hazards';
import { buildDustField, createAmbientUpdate } from './ambient';
import { buildStoveIsland, buildPrepCounter, buildServiceCounter } from './props/counters';
import { buildFreezerSized, buildHerbCrate, buildCrateTall, buildFlourSack, buildLanePots } from './props/storage';
import {
  buildSpiceCart,
  buildSupplyBarrel,
  buildExhaustPipe,
  buildHangingSign,
  buildChalkboardMenu,
} from './props/smallProps';

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

  // ── Apron — everything OUTSIDE the 1400x1000 playfield ───────────────────────
  // Added to `root`, deliberately NOT to `propsGroup`: `propsGroup` is the set that
  // gets `outlineGroup()` below, i.e. the arena's reserved "this collides" ink line,
  // and no part of the apron collides with anything. It registers no CoverBox, has no
  // hazard, and is never read by the sim — it is cosmetic bleed in the sense
  // `camera.ts`'s SURPLUS POLICY means it. See `./apron.ts` for why it reaches 760 wu
  // past every bound and why the boundary is a raised kerb rather than a drop-off.
  if (!location.search.includes('apron=0')) root.add(buildApron());

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
    build: (w, d) => buildPrepCounter(M, w, d, { rollingPin: true }),
  });
  addCover(propsGroup, cover, M, {
    x: ARENA_W - 340, y: ARENA_H - 420, w: 160, h: 55, kind: 'prep_counter', yawDeg: 180,
    build: (w, d) => buildPrepCounter(M, w, d, { rollingPin: true }),
  });
  addCover(propsGroup, cover, M, {
    x: ARENA_W - 340, y: ARENA_H - 580, w: 160, h: 55, kind: 'prep_counter', yawDeg: 180,
    build: (w, d) => buildPrepCounter(M, w, d, { knifeBlock: true }),
  });

  // ── Mid-lane supply barrels ───────────────────────────────────────────────────
  // The straight run from each spawn to the hub was open floor along its centre
  // line: the prep-station pairs above sit at y=420/580 (offset ±80 from the
  // y=500 centreline), leaving a clear ~105-unit-wide channel a player could stand
  // in at spawn and see straight down to the opposing spawn. These four barrels
  // sit squarely IN that channel — two per lane, staggered front/back rather than
  // one solid wall, so the sightline is broken twice and there's still room to
  // dodge around each individually instead of the lane just being sealed.
  addCover(propsGroup, cover, M, {
    x: 250, y: 500, w: 60, h: 50, kind: 'supply_barrel',
    build: (w, d) => buildSupplyBarrel(M, w, d),
  });
  addCover(propsGroup, cover, M, {
    x: 460, y: 500, w: 48, h: 46, kind: 'supply_barrel',
    build: (w, d) => buildSupplyBarrel(M, w, d, { dark: true }),
  });
  addCover(propsGroup, cover, M, {
    x: ARENA_W - 250, y: ARENA_H - 500, w: 60, h: 50, kind: 'supply_barrel',
    build: (w, d) => buildSupplyBarrel(M, w, d),
  });
  addCover(propsGroup, cover, M, {
    x: ARENA_W - 460, y: ARENA_H - 500, w: 48, h: 46, kind: 'supply_barrel',
    build: (w, d) => buildSupplyBarrel(M, w, d, { dark: true }),
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
  // BLOCKING gets the heaviest ink line in the arena — roughly 2.5x the pot's own
  // outline and far past anything decoration ever carries (decoration is never
  // outlined at all; see `buildFloor`). A thin 0.006 line was invisible at gameplay
  // camera distance next to the coverPlinth swap above; this is the other half of
  // "a heavier outline than anything else" from the round-5 brief.
  outlineGroup(propsGroup, 0.016);

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

  // Every puddle gets the SAME hazard grammar as the pot: a hard, opaque, saturated
  // rim traced exactly on its real slow-radius, in a hue reserved for hazard rims
  // only (`greaseRim`/`waterRim` — never reused on cover or decoration). Without
  // this the puddles were just another softly-shaded coloured disc, indistinguishable
  // in kind from the tealTile floor patches.
  const puddleGroup = new THREE.Group();
  noOutline(puddleGroup);
  puddleGroup.add(buildPuddleVisual(M, puddleSouth.x, puddleSouth.y, puddleSouth.radius, M.grease, M.greaseRim));
  puddleGroup.add(buildPuddleVisual(M, puddleNorth.x, puddleNorth.y, puddleNorth.radius, M.water, M.waterRim));
  root.add(puddleGroup);

  // ── Chalkboard menu — freestanding, thin, decorative only ───────────────────
  const board = buildChalkboardMenu(M);
  const boardPos = groundPos(600, 760);
  board.position.set(boardPos.x, 0, boardPos.z);
  board.rotation.y = THREE.MathUtils.degToRad(20);
  // No outline here, deliberately: the chalkboard has no CoverBox — it's pure
  // DECORATION — and decoration is never outlined anywhere else in the arena (see
  // `buildFloor`). Outlining it would borrow BLOCKING's now much-heavier ink line
  // and falsely suggest this collides.
  root.add(board);

  // ── Round-6 kitchen-motif clutter — pipes + signage, height variety ──────────
  // Exhaust pipes beside both freezers: the tallest silhouette in either back
  // corner, giving those corners a foreground/midground/background read instead of
  // one uniform freezer-height block (see `buildExhaustPipe`). Decoration only — no
  // CoverBox, placed just clear of the freezer's own footprint.
  const pipeNW = buildExhaustPipe(M);
  const pipeNWPos = groundPos(375, 80);
  pipeNW.position.set(pipeNWPos.x, 0, pipeNWPos.z);
  root.add(pipeNW);
  const pipeSE = buildExhaustPipe(M);
  const pipeSEPos = groundPos(ARENA_W - 375, ARENA_H - 80);
  pipeSE.position.set(pipeSEPos.x, 0, pipeSEPos.z);
  root.add(pipeSE);

  // Hanging order-tag signs in the mid-lane, in the open gap BETWEEN the two supply
  // barrels — signage motif, and the single tallest thing in the lane view, the
  // composition the round-6 critic called emptiest. Kept clear of every CoverBox
  // (barrels sit at x=250/460 ±30/24, prep counters at y=420/580 ±27.5).
  const signW = buildHangingSign(M);
  const signWPos = groundPos(365, 500);
  signW.position.set(signWPos.x, 0, signWPos.z);
  root.add(signW);
  const signE = buildHangingSign(M, 180);
  const signEPos = groundPos(ARENA_W - 365, ARENA_H - 500);
  signE.position.set(signEPos.x, 0, signEPos.z);
  signE.rotation.y = THREE.MathUtils.degToRad(180);
  root.add(signE);

  // ── Ambient dust ──────────────────────────────────────────────────────────────
  const dust = buildDustField(M, 40);
  root.add(dust.mesh);

  // ── Spawns ────────────────────────────────────────────────────────────────────
  const playerSpawn = { x: 160, y: CENTER.y };
  const enemySpawn = { x: ARENA_W - 160, y: CENTER.y };

  const updateAmbient = createAmbientUpdate(pot, hazardGround, dust);

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
      updateAmbient(elapsed);
    },
  };

  return def;
};
