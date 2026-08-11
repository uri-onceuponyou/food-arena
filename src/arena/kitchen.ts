/**
 * Kitchen arena — a working restaurant kitchen, built up from the prototype's single
 * 4-cabinet / 2-island / 1-pot layout into a full Brawl-Stars-scale map.
 *
 * ── Layout concept ───────────────────────────────────────────────────────────────
 * 1400 x 1000 world units (vs the prototype's 900 x 600) laid out with true 180°
 * point symmetry around the centre so both spawns face an identical, fair map.
 *
 * ── The four rules the layout must satisfy, and why ──────────────────────────────
 * Read these before moving any prop. Each one was a measured defect, and every one of
 * them is re-checkable in seconds with `tools/tmp/arena_probe.mjs` (1-3) or
 * `tools/tmp/ap_reach.mjs` (4).
 *
 *   1. **COVER DENSITY MUST FALL TOWARD THE CENTRE.** The closing ring has to force
 *      fighters INTO each other; if the middle is the most cluttered part of the map
 *      it forces them into furniture instead. Measured on the shipped layout,
 *      occlusion rose 30.6% -> 67.7% as the ring shrank from 993 to MIN_SAFE_RADIUS,
 *      because the four stove islands' inner corners sat **138 wu from centre — inside
 *      MIN_SAFE_RADIUS (140)** — and the spice carts sat at 175. The endgame annulus
 *      literally touched them. The islands are now at ±270/±200 (inner corner 241 wu),
 *      the carts and lane pots are out on the service wall, and the whole 150..250 wu
 *      band is 0.3% solid: the endgame is a ring around ONE pillar, as intended.
 *      → `arena_probe.mjs --occl` must end BELOW where it starts.
 *
 *   2. **NO PROP MAY SEAL A POCKET.** Two prep counters plus two lane barrels sealed
 *      `x 301..415` and `x 985..1099`, both `y 469..531` — 114x63 wu each, **1.9% of
 *      all legal standing space that nothing could ever enter**, one of them containing
 *      a hanging sign nobody could ever walk up to. A small prop dropped in the gap
 *      between two large ones is exactly how this happens, and it is invisible in a
 *      screenshot. → `arena_probe.mjs --truth` must print ONE PIECE.
 *
 *   3. **A SPAWN'S STRAIGHT-AHEAD RUN MUST NOT END IN FURNITURE OR IN A HAZARD** —
 *      **AND THE RULE IS ABOUT A CORRIDOR, NOT A RAY.** A player holding one direction
 *      out of the shipped spawn travelled **38 wu** before a barrel stopped it dead
 *      (`tryMove` tests the destination and does not slide). With the lane cleared the
 *      run became 700 wu — and then ran into the boiling pot, whose CoverBox stops a
 *      fighter at r=73 while its damage ring is r=95, i.e. it **pins you inside the
 *      fire**. Hence the spawns are offset 110 wu off the centre line (still exactly
 *      point-symmetric), so the natural run out of spawn passes clear of both the pot's
 *      box and its 95 wu burn ring.
 *
 *      ⚠️ **AND THEN THE SAME BUG CAME BACK, 6 wu WIDE, BECAUSE THE MEASUREMENT WAS A
 *      SINGLE RAY.** `arena_probe.mjs --route` walks one line out of the spawn point and
 *      reported 700 / 84 / 318 wu on this layout — all healthy. `tools/tmp/input_accept.mjs`
 *      then measured a player holding W travelling **6.0 wu**, which is 0.14 of a body
 *      length and exactly ONE step (`PLAYER_SPEED` 0.12 wu/ms x the loop's 50 ms dt
 *      clamp). Both numbers were right. A ray is measure-zero and a fighter is not: the
 *      west `prep_counter` at (265,330,160x55) inflates to a collision box of
 *      **x 164..366, y 281.5..378.5** against a 42 wu body, and the player spawn (160,390)
 *      sat **4.0 wu west of one face and 11.5 wu south of the other**. Four wu of lateral
 *      drift — a tenth of a body — took the north runway from 84 wu to 11.5, and the run
 *      TOWARD THE ENEMY from 1219 wu to **4.0**. The counter had been placed by exactly
 *      that arithmetic: "x=265 so the inflated west edge (265-80-21=164) clears the
 *      spawn's x=160", i.e. deliberately, by 4 wu.
 *      → `tools/tmp/spawn_runway.mjs` is the acceptance test. It measures the WORST case
 *        over a +-21 wu lateral band (the fighter's own half-width) in all four cardinals
 *        from BOTH spawns, and requires 60 wu — 0.5 s of held input, 1.43 body lengths.
 *        Cardinals only, because `tryMove` resolves x and y independently, so a diagonal
 *        that is refused on one axis still travels on the other; only a cardinal can stop
 *        a fighter dead. It also fails if a run STOPS inside a damage hazard, which is the
 *        pot pin above stated as a test instead of as a paragraph.
 *
 *   4. 🔴 **NO GAP BETWEEN TWO FACES MAY BE WIDER THAN THE DRAWN BODY AND NARROWER THAN
 *      THE COLLIDING ONE.** Uri, playing the shipped build 2026-08-11:
 *      *"there are regions in the map that are unreachable due to obstacles."* He was
 *      right, and no gate here could see it, because the space is not SEALED — the flood
 *      `arena_probe --truth` runs still printed ONE PIECE, 0.00% sealed, 100% ceiling.
 *
 *      A character is DRAWN 20.5 wu wide (Donut) to 35.2 wu (Hamburger) and COLLIDES as
 *      **`PLAYER_SIZE` = 42, for every one of them**. So a gap of roughly 20..42 wu
 *      between two mesh faces — or between a face and an arena wall — is floor you can
 *      SEE, that reads as somewhere you could stand, and that no fighter can ever enter.
 *      It is not a pocket in the sim's own space, so a legal-space flood is structurally
 *      blind to it.
 *
 *      🚨 **AND THE THRESHOLD IS THE NARROWEST CHARACTER, NOT THE AVERAGE ONE.** The first
 *      pass fixed everything above **26 wu** — a figure derived from one pixel measurement
 *      (`shots/conceal/panels.json` charBox: 73 px against a 304.66 px-per-100-wu ruler =
 *      23.96 wu) — and re-running the probe at 20 wu found **six more gaps still open**,
 *      including two the same pass had walked past. `tools/tmp/ap_view.mjs` measures the
 *      model's world-space extent with no camera in it and the cast spans **20.5 to 35.2
 *      wu**, so a 25 wu gap is a slit for Hamburger and a see-through wall for Donut.
 *      Every gap now sits at or below **18 wu** or at or above 42.
 *
 *      **FOURTEEN of them shipped, in seven point-symmetric pairs**: 30 and 36 wu behind
 *      the four supply barrels (against the outer wall), 32.5 wu over 95 wu of run between
 *      the flour sacks and the rollingPin prep counter, 37.5 wu between the stacked pots
 *      and the herb crate, 25 wu between the herb crate and the tall crate, 20 wu between
 *      the tall crate and the flour sacks, and 20 wu between the knifeBlock counter and
 *      the west wall. Deepest point 68 wu from anywhere standable.
 *      → `node tools/tmp/ap_reach.mjs --body-visual 18` must report ZERO. Its `--selftest`
 *        builds a room whose doorway is 30 wu and requires a sealed pocket, a phantom
 *        pocket and a face gap; the 120 wu control requires none of the three.
 *
 *      Below the narrowest drawn body is a SLIT — nothing can stand in it and nothing
 *      looks like it could, so a slit is fine and several ship deliberately (the pantry
 *      crates are 10-18 wu apart). Above 42 wu is a corridor. **The band in between is the
 *      only illegal case, and it is measured against the SMALLEST character.**
 *
 * ── The map itself ───────────────────────────────────────────────────────────────
 *   - A central STOVE HUB: the boiling pot alone in a wide clearing, with 4 diagonal
 *     stove islands pushed out to the edge of that clearing. This is the classic
 *     "danger in the middle, cover on the corners" BS arena hub — the cardinal lanes
 *     are open and the diagonals are blocked, and the hub itself is lethal to linger
 *     in. The pot is SOLID (see the `boiling_pot` CoverBox below): the burning ground
 *     is the ring around it, not the vessel, so the middle of the map is a pillar you
 *     fight around rather than a hole fighters vanish into.
 *   - Two big WALK-IN FREEZERS anchor the NW/SE corners: single huge landmark props
 *     that fully block sightlines and give a hard flank route around the hub.
 *   - Two PANTRY clusters (crates + flour sacks) anchor the NE/SW corners: several
 *     smaller boxes clustered tight, reading as one nook but with more silhouette
 *     variety than the freezers.
 *   - Two PREP STATIONS. Each is a mid-lane counter plus a WALL PENINSULA out on the far
 *     west / far east strip, and neither one is inside a spawn's corridor. They used to
 *     straddle the lane 80 wu either side of the centre line (which made the spawn an
 *     alcove and sealed the pockets above), and then to tuck under the freezer (which is
 *     what put a collision face 4 wu from the player spawn — see rule 3).
 *   - A SERVICE LINE runs along the north and south walls: a sink (north) / fryer
 *     (south) counter flanked by the spice cart and the stacked pots that used to sit
 *     beside the pot. Each service counter still sits beside a slowing puddle (grease
 *     / spilled water) — the required slow hazard, doubled for symmetry.
 *   - Four SUPPLY BARRELS sit in the far west and east strips, where the map had no
 *     cover at all beyond r=650. They used to stand in the middle of the spawn lane.
 * Player spawns west-north, enemy east-south, both in open floor well clear of cover
 * so neither side opens the match already boxed in.
 *   - SIX SPAWNS, in three 180°-point-symmetric pairs (`spawns`, below). The duel's two are
 *     pair A and are untouched. 🔴 **The map has room for exactly TWO admissible spawn
 *     regions per half**, so pair C shares the west/east bay with pair A at 75.2 wu — inside
 *     `REACH.meleeHeavy`. At four seats the map is fine (509.8 wu); at six it is not. See
 *     the spawn block for the sweep, and `shots/sp/admissible.png` for the picture.
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
import type { ConcealBox } from '../game/movement';
import { outlineGroup } from '../render/toon';
import { groundPos } from '../units';
import { POT, PUDDLE_SLOW_FACTOR } from '../game/rules';
import {
  buildMaterials,
  noOutline,
  ARENA_W,
  ARENA_H,
  CENTER,
  MAX_SAFE_RADIUS,
  addCover,
  addConceal,
  buildConcealPatch,
  liftArenaValue,
} from './shared';
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
  //
  // ⚠️ `HUB_ISLAND_DX/DY` are the single most load-bearing pair of numbers in this
  // file. They were ±175/±150, which put each island's INNER CORNER at
  // hypot(175−85, 150−45) = **138 wu from centre — inside `MIN_SAFE_RADIUS` (140)**.
  // The last standable annulus of every long match was therefore wedged between the
  // pot and four counters, and measured occlusion CLIMBED 30.6% → 67.7% as the ring
  // closed: the closing zone was herding fighters into furniture instead of into each
  // other, the exact inverse of what a closing zone is for.
  //
  // At ±270/±200 the inner corner sits at hypot(185, 155) = **241 wu**, which is
  // outside `MIN_SAFE_RADIUS` + a fighter's own reach, so nothing but the pot is
  // shootable from the endgame annulus. Series now 27.7% → 25.2%, peak 31.3%.
  //
  // The outward limit is the freezer, not taste: at DX > 270 the island's west face
  // (CENTER.x − DX − 85) crosses the NW freezer's east face at x=345 and the two
  // meshes intersect. `arena_probe.mjs --audit` reports that as a MESH CLIP.
  const HUB_ISLAND_W = 170, HUB_ISLAND_H = 90;
  const HUB_ISLAND_DX = 270, HUB_ISLAND_DY = 200;
  addCover(propsGroup, cover, M, {
    x: CENTER.x - HUB_ISLAND_DX, y: CENTER.y - HUB_ISLAND_DY, w: HUB_ISLAND_W, h: HUB_ISLAND_H, kind: 'stove_island',
    build: (w, d) => buildStoveIsland(M, w, d),
  });
  addCover(propsGroup, cover, M, {
    x: CENTER.x + HUB_ISLAND_DX, y: CENTER.y - HUB_ISLAND_DY, w: HUB_ISLAND_W, h: HUB_ISLAND_H, kind: 'stove_island',
    build: (w, d) => buildStoveIsland(M, w, d, { panRack: true }),
  });
  addCover(propsGroup, cover, M, {
    x: CENTER.x - HUB_ISLAND_DX, y: CENTER.y + HUB_ISLAND_DY, w: HUB_ISLAND_W, h: HUB_ISLAND_H, kind: 'stove_island', yawDeg: 180,
    build: (w, d) => buildStoveIsland(M, w, d),
  });
  addCover(propsGroup, cover, M, {
    x: CENTER.x + HUB_ISLAND_DX, y: CENTER.y + HUB_ISLAND_DY, w: HUB_ISLAND_W, h: HUB_ISLAND_H, kind: 'stove_island', yawDeg: 180,
    build: (w, d) => buildStoveIsland(M, w, d),
  });

  // ── Service line, north and south walls ──────────────────────────────────────
  // The stacked pots (was CENTER.y ± 242) and the spice carts (was CENTER.x ± 175)
  // used to be the "chokepoint prop in the lane mouth" of the old hub. Both sat inside
  // the endgame annulus's reach — the carts at 175 wu from centre were the single
  // biggest contributor to the 67.7% endgame occlusion, since a fighter anywhere in
  // the annulus is within one weapon reach of them.
  //
  // They keep their job — clutter with silhouette variety, and a counterpoint to the
  // long service counters — out on the wall line instead, where cover SHOULD be dense.
  // Kept clear of the exhaust pipes at (375,80)/(1025,920) and of both puddles.
  // ⚠️ The stacked pots moved x 1010 -> 980, and that is rule 4 as well: at 1010 the
  // pots stood 37.5 wu from the pantry's herb crate over 43 wu of run — see-through,
  // impassable — and at 980 the gap is 67.5 wu, a corridor a body can use. Nothing else
  // is within 177 wu of them on the north wall.
  addCover(propsGroup, cover, M, {
    x: 980, y: 120, w: 55, h: 55, kind: 'stacked_pots',
    build: (w, d) => buildLanePots(M, w, d),
  });
  addCover(propsGroup, cover, M, {
    x: ARENA_W - 980, y: ARENA_H - 120, w: 55, h: 55, kind: 'stacked_pots', yawDeg: 180,
    build: (w, d) => buildLanePots(M, w, d),
  });
  addCover(propsGroup, cover, M, {
    x: 450, y: 120, w: 50, h: 50, kind: 'spice_cart',
    build: (w, d) => buildSpiceCart(M, w, d),
  });
  addCover(propsGroup, cover, M, {
    x: ARENA_W - 450, y: ARENA_H - 120, w: 50, h: 50, kind: 'spice_cart', yawDeg: 180,
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
  // ⚠️ The tall crate moved (1230,140) -> (1215,148), and that is rule 4 measured against
  // the NARROWEST character rather than the widest. At (1230,140) it stood 25.0 wu from
  // the herb crate over 75 wu of run and 20.0 wu from the flour sacks over 40 wu — both
  // comfortably under `PLAYER_SIZE`, and both WIDER than Donut is drawn (20.5 wu of
  // world-space model, `tools/tmp/ap_view.mjs`). Hamburger is drawn 35.2 wu, so those two
  // gaps are slits for one character and see-through walls for another. Now 10.0 and 12.0
  // wu: slits for every character in the roster.
  addCover(propsGroup, cover, M, {
    x: 1215, y: 148, w: 80, h: 80, kind: 'produce_crate_tall',
    build: (w, d) => buildCrateTall(M, w, d),
  });
  addCover(propsGroup, cover, M, {
    x: ARENA_W - 1215, y: ARENA_H - 148, w: 80, h: 80, kind: 'produce_crate_tall', yawDeg: 180,
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

  // ── Prep stations ────────────────────────────────────────────────────────────
  //
  // Was a PAIR STRADDLING THE LANE at x=340, y=420/580 — a 105 wu gap between them on
  // the centre line. Together with the two lane barrels below, that pair is what sealed
  // `x 301..415, y 469..531` (and its twin): a 114x63 wu pocket of legal standing space
  // that **nothing in the game could ever enter**, 1.9% of the map, found by a 2 wu
  // lattice flood and invisible to every other test. It is also the "alcove" the
  // navigation work had to build a flow field to escape — the player spawned in a bay
  // whose only exit was that gap, with a barrel parked in front of it.
  //
  // ── The knife-block counters MOVED OFF THE SPAWN CORRIDOR. This is rule 3. ───────
  //
  // They were at (265, CENTER.y-170) and its mirror, chosen so "the counter's inflated
  // west edge (265 - 80 - 21 = 164) clears the player spawn's x=160". It clears it by
  // **4.0 wu — 0.095 of a body length**, and that is not a clearance, it is a coincidence.
  // Against a 42 wu fighter the box inflates to x 164..366, y 281.5..378.5 while the spawn
  // is (160,390), so the spawn sat 4.0 wu west of one collision face and 11.5 wu south of
  // the other. Measured with `tools/tmp/spawn_runway.mjs`, which walks the +-21 wu band a
  // body actually occupies instead of the single ray `arena_probe --route` walks:
  //
  //     direction          centre ray     worst over the body's own width
  //     north                 84.0 wu     **11.5 wu**  at +4.5 wu of drift
  //     toward the enemy    1219.0 wu     ** 4.0 wu**  at -21 wu of drift
  //     south                319.0 wu       231.5 wu
  //
  // `tools/tmp/input_accept.mjs` caught the north case in the LIVE GAME at **6.0 wu**: an
  // 11.5 wu runway delivered in 6 wu steps (PLAYER_SPEED 0.12 wu/ms x the loop's 50 ms dt
  // clamp) is one step and then nothing. The 4.0 wu case is worse and nothing reported it
  // at all — it is the run TOWARD THE ENEMY, i.e. the first thing every match does.
  //
  // THE COUNTER COULD NOT BE FIXED IN PLACE, and the proof is two inequalities. To clear
  // the spawn's N/S corridor its collision box must start east of 181, and to avoid
  // clipping the NW stove island its mesh must end west of 345 — so `w + 21 <= 164`, i.e.
  // **no counter wider than 143 fits there at all**. To clear the E/W corridor its
  // collision box must end north of 369 while its mesh starts south of the freezer at 285
  // — so `h + 21 <= 84`, i.e. **h <= 63 with zero margin**. (That second one is structural:
  // anything tucked under the freezer extends the freezer's own collision shadow south by
  // half its mesh plus half its collision box plus 21, so it ALWAYS shortens the north
  // runway below the freezer's 84.) Shrinking to fit was measured: at 120x42 the guard
  // passes, but only out to a +-38 wu band against +-85 wu for moving it — one bad
  // prop-nudge from the same bug.
  //
  // So it moves to the far west/east strip as a WALL PENINSULA, which also serves rule 1:
  // r=467 -> r=608 from centre, the same band the barrels were moved to for the same
  // reason ("beyond r=650 the shipped layout was 7% solid"). Measured over the whole
  // layout: the occlusion series 27.7% -> 25.2% becomes **29.7% -> 25.2%** (peak 31.3% ->
  // 30.9%, i.e. it falls further and peaks lower), floor still ONE PIECE, ceiling still
  // 352/352 = 100.0%, 0 mesh clips, 6 pinches — unchanged. The spawn bay keeps a wall at
  // both ends: the freezer 84 wu north, this counter 161.5 wu south, open to the east.
  //
  // ⚠️ The two `rollingPin` counters did NOT move. Their nearest collision face is 231.5 wu
  // from the spawn and they were never part of this defect.
  // ⚠️ The knifeBlock counter moved x 100 -> 80, which puts it FLUSH against the west
  // wall. It is described above as a WALL PENINSULA and it was standing 20.0 wu off the
  // wall over 55 wu of run — rule 4's band for every character narrower than 20 wu of
  // drawn body, and a peninsula that does not touch the wall is not a peninsula anyway.
  // Its collision face relative to the player spawn is unchanged in the axis that
  // matters: the spawn (160,390) sits inside this box's inflated x range before and
  // after, so the 161.5 wu south runway `spawn_runway.mjs` measures does not move.
  addCover(propsGroup, cover, M, {
    x: 80, y: CENTER.y + 100, w: 160, h: 55, kind: 'prep_counter',
    build: (w, d) => buildPrepCounter(M, w, d, { knifeBlock: true }),
  });
  // ⚠️ The rollingPin counter moved CENTER.y+170 -> CENTER.y+185, and that is rule 4.
  // At +170 its inboard face stood 32.5 wu from the pantry's flour sacks over 95 wu of
  // run — inside the see-through-but-impassable band — stranding a 114 x 32 wu corridor
  // of visible floor. At +185 the gap is 17.5 wu: the sacks read as stacked AGAINST the
  // counter, which is what a kitchen looks like anyway, and 17.5 is a SLIT (well under
  // the 26 wu drawn body), so there is no floor left in between to be stranded.
  //
  // ⚠️ **+200 WAS TRIED FIRST AND PRODUCED A 4 wu SLIVER**, which is a worse defect than
  // the one being fixed: this counter's inflated west edge (265-80-21 = 164) and the
  // knifeBlock counter's inflated east edge (100+80+21 = 201) overlap in x for 37 wu, so
  // the y band between the two inflated boxes is a legal channel NARROWER THAN THE 10 wu
  // NAV CELL — legal for a fighter, invisible to the flow field. At +185 the two inflated
  // boxes OVERLAP by 12 wu in y and no channel exists at all. `arena_probe --audit` is
  // what caught it; it exits non-zero on a sliver.
  // Checked on the way out: 87.5 wu clear of the herb crate, and the nearest collision
  // face to the player spawn goes 231.5 -> 246.5 wu, i.e. further away.
  addCover(propsGroup, cover, M, {
    x: 265, y: CENTER.y + 185, w: 160, h: 55, kind: 'prep_counter',
    build: (w, d) => buildPrepCounter(M, w, d, { rollingPin: true }),
  });
  addCover(propsGroup, cover, M, {
    x: ARENA_W - 80, y: ARENA_H - (CENTER.y + 100), w: 160, h: 55, kind: 'prep_counter', yawDeg: 180,
    build: (w, d) => buildPrepCounter(M, w, d, { knifeBlock: true }),
  });
  addCover(propsGroup, cover, M, {
    x: ARENA_W - 265, y: ARENA_H - (CENTER.y + 185), w: 160, h: 55, kind: 'prep_counter', yawDeg: 180,
    build: (w, d) => buildPrepCounter(M, w, d, { rollingPin: true }),
  });

  // ── Supply barrels — far west / far east strips ──────────────────────────────
  // These used to stand squarely IN the spawn lane at x=250/460, to break the
  // spawn-to-spawn sightline. Three measurements retired that idea:
  //   * that sightline is 1080 wu long and the camera guarantees only 199.2 wu, so no
  //     player has ever seen down it;
  //   * `tryMove` tests the destination and does NOT slide, so a player holding one
  //     direction out of spawn walked **38 wu** and stopped dead against the first
  //     barrel — 0.9 of a body length, the very first thing anyone does in a match;
  //   * with the prep counters they sealed the two dead pockets described above.
  // Removing them took the shortest legal spawn-to-spawn route 1341 wu -> 1171 wu
  // (detour factor 1.24x -> 1.06x) and the runway 38 wu -> 700 wu.
  //
  // They land in the far west/east strips because that is where the map had NO cover
  // at all: beyond r=650 the shipped layout was 7% solid and beyond r=750 it was 0.0%,
  // while r=150..250 was its densest band. Density now falls toward the centre, which
  // is rule 1 at the top of this file.
  //
  // ── ⚠️ AND THEY ARE FLUSH TO THE WALL BECAUSE OF RULE 4 BELOW. WAS x = 60. ────
  // At x=60 the west face sat 30 wu from the bound (24 wu for the smaller pair, 36 wu
  // on the mirror), which is inside the 26..42 wu band rule 4 names: WIDE ENOUGH TO SEE
  // FLOOR THROUGH, TOO NARROW FOR A 42 wu BODY TO ENTER. Four strips of visible,
  // permanently unreachable floor, 30-36 wu wide and 46-50 wu long, one behind each
  // barrel. **Uri found these by playing.**
  //
  // Flush (x = w/2) rather than pushed inboard, and the lane arithmetic is why: the NW
  // freezer's west face is at x=115, so the whole lane is 115 wu wide. Two walkable
  // corridors need 60 + 60 = 120 wu of clearance around a barrel of any size — it does
  // not fit, at ANY width or position. Flush spends the entire lane on ONE side, and
  // that side goes from **completely blocked today** (the barrel's inflated box x[9,111]
  // covers every legal centre in x 21..94) to a 55 wu corridor. This change only ADDS
  // reachable floor. The kerb's lip reaches 1 wu inside the bound (`apron.ts:945`), so
  // the barrel rests against it rather than floating off it.
  addCover(propsGroup, cover, M, {
    x: 30, y: 250, w: 60, h: 50, kind: 'supply_barrel',
    build: (w, d) => buildSupplyBarrel(M, w, d),
  });
  addCover(propsGroup, cover, M, {
    x: 24, y: 750, w: 48, h: 46, kind: 'supply_barrel',
    build: (w, d) => buildSupplyBarrel(M, w, d, { dark: true }),
  });
  addCover(propsGroup, cover, M, {
    x: ARENA_W - 30, y: ARENA_H - 250, w: 60, h: 50, kind: 'supply_barrel',
    build: (w, d) => buildSupplyBarrel(M, w, d),
  });
  addCover(propsGroup, cover, M, {
    x: ARENA_W - 24, y: ARENA_H - 750, w: 48, h: 46, kind: 'supply_barrel',
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

  // ── Central hazard — the boiling pot ─────────────────────────────────────────
  //
  // The pot IS cover. It used to be the one solid-looking mass in the arena with no
  // CoverBox at all, on the reasoning (written into `hazards.ts`) that "dangerRadius
  // already keeps players well clear of the body before they'd ever touch it". The
  // sim does no such thing — `POT.dangerRadius` only applies damage, it never pushes
  // anyone out — so a fighter walked straight into a 2.6m-radius, 2.53m-tall opaque
  // cylinder and DISAPPEARED. Measured at shipped framing, 1600x900, with the player
  // parked by `?px=/?py=` (`tools/tmp/potvis.mjs`):
  //
  //     pot centre        0.0% of the fighter's silhouette visible, head 0.0%
  //     on the rim (r=52) 1.6% (N) .. 76.4% (SE), head 5.5% .. 44.3%
  //     at r=68           45.2% .. 101.4%, head 98.2% .. 102.1%
  //     at r=95 (the ring) 93.0% .. 101.3%, head 98% ..
  //
  // and the closing fog funnels BOTH fighters here at the end of every match.
  //
  // ── Why a CoverBox and not a visual fix ──────────────────────────────────────
  // The alternative was to stop the pot swallowing (transparent broth, a shorter
  // vessel) so a fighter reads as standing IN the boiling pot. Three numbers killed
  // it: the pot's rim/broth surface sits at 2.53m, `CHARACTER_HEIGHT` is 2.10m, so
  // the fighter is 0.43m SHORTER than the vessel — no material change reaches them,
  // only cutting the arena's tallest landmark to roughly waist height would, and
  // that is a redesign of the hub, not a bug fix.
  //
  // ── And the damage mechanic survives, which is the whole question ────────────
  // `sim.ts` damages any fighter whose CENTRE is within `POT.dangerRadius` = 95wu.
  // Collision is AABB vs AABB with a 42wu fighter, so a 104wu box blocks centres
  // only inside |dx| < 73 AND |dy| < 73. 73 < 95: a fighter can stand flush against
  // the pot on any cardinal side and still burn, in a band 22wu (1.10m) deep —
  // wider than the fighter's own radius. 36.7% of the damage disc stays standable.
  // If the box were >= 148wu the hazard could never fire again; it is 104.
  //
  // The box is `POT.bodyRadius * 2` — the exact same rules constant `buildPot`
  // sizes the mesh from, so the collision box cannot drift from the visual. An AABB
  // around a cylinder is flush on the cardinals and stands off by 21.5wu (1.07m) on
  // the diagonals; that is the AABB tax every round prop pays, and it costs nothing
  // in truthfulness because the thing a player reads danger off is the caution-tape
  // ring traced on r=95, not the pot's own edge.
  const pot = buildPot(M);
  const potPos = groundPos(CENTER.x, CENTER.y);
  addCover(propsGroup, cover, M, {
    x: CENTER.x, y: CENTER.y, w: POT.bodyRadius * 2, h: POT.bodyRadius * 2, kind: 'boiling_pot',
    build: () => pot.group,
  });

  root.add(propsGroup);
  // BLOCKING gets the heaviest ink line in the arena — far past anything decoration
  // ever carries (decoration is never outlined at all; see `buildFloor`). A thin
  // 0.006 line was invisible at gameplay camera distance next to the coverPlinth
  // swap above; this is the other half of "a heavier outline than anything else"
  // from the round-5 brief. The pot is inside `propsGroup` now precisely so it gets
  // this line too: it blocks, so it has to carry the arena's blocking cue (it used
  // to ink itself at 0.006, which is what decoration-weight ink looks like).
  //
  // `{ merge: true }` bakes every prop's outline hull into ONE mesh instead of one per
  // prop. Measured: **−45 draw calls per frame** against a per-pixel image change of
  // 0.0002/255, i.e. free. It is safe here precisely because this is a single
  // whole-group call at one thickness and one colour — the merge path can only combine
  // hulls that share a material.
  outlineGroup(propsGroup, 0.016, undefined, { merge: true });

  // Hazard ground marking (visual only — not collidable, not a CoverBox). Scorch +
  // glow ring + heat wisps, radius driven directly off POT.dangerRadius so it always
  // matches the real hazard exactly. Stays on `root`, NOT in `propsGroup`: it is a
  // floor decal and must never take the blocking ink line.
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

  // Hanging order-tag signs — signage motif, tucked against the freezer's inboard
  // face at the mouth of the north (west sign) / south (east sign) flank route.
  //
  // They used to stand at (365,500)/(1035,500), which the 2 wu lattice flood showed was
  // **inside one of the two sealed pockets** — a decoration nothing in the game could
  // ever walk up to. That is also why nobody noticed these are collision-free: with the
  // pockets healed, a sign left in the open lane would be a solid-looking post players
  // walk straight through. (350,180) sits 5 wu clear of the freezer mesh but inside the
  // band a 42 wu fighter's centre can never occupy, so it cannot be walked through at
  // all. Same convention as the exhaust pipes and the chalkboard: decoration only.
  const signW = buildHangingSign(M);
  const signWPos = groundPos(350, 180);
  signW.position.set(signWPos.x, 0, signWPos.z);
  root.add(signW);
  const signE = buildHangingSign(M, 180);
  const signEPos = groundPos(ARENA_W - 350, ARENA_H - 180);
  signE.position.set(signEPos.x, 0, signEPos.z);
  signE.rotation.y = THREE.MathUtils.degToRad(180);
  root.add(signE);

  // ── CONCEALMENT — plates and trays you hide under (DECISIONS §29) ────────────
  //
  // Uri, playing the shipped build 2026-08-11: *"i can't hide under conceilments or break
  // them."* Both halves of the mechanic have been built and inert since `f0e7aed` — the
  // radar blip, the floating HP pill, the 3D model, the player's own screen, projectile
  // re-aim, `CONCEAL_ATTACK_REVEAL_MS` and `breakConcealment` are all wired and proven
  // bit-identical when no region exists (`conceal_lab --bitid`: 0 differing ticks in
  // 3,283,873). **NO ARENA HAS EVER DECLARED A REGION.** That is the entire bug: there is
  // nothing to hide under, so there is also nothing to break by attacking. §29c is not
  // missing, it has never had an object to act on.
  //
  // ── SIX PATCHES, AND WHY IT IS NOT THE FIVE THAT WERE RECOMMENDED ───────────
  // `shots/conceal/concealment-scale.png` panel 4 recommends "a field of ~5 at 110-130
  // wu". Five is IMPOSSIBLE here: true 180 degree point symmetry pairs every patch with
  // its opposite, so an odd count forces one patch centred on the map centre — and the
  // map centre is inside `concealmentKeepoutRadius` (248.25 wu on this arena), which
  // `movement.ts:concealmentInsideRadius` refuses. So three PAIRS, at 110/120/130 wu.
  //
  // ── EVERY SIZE IS AN AI CONSTRAINT, NOT A TASTE ONE (§29a) ──────────────────
  // `stepAI` has no search behaviour: it walks to where it last saw you and can see
  // `CONCEAL_REVEAL_RADIUS` (84 wu) from there. A patch wider than ~168 wu therefore has
  // an interior the AI can NEVER see into — measured both ways, at half the radius it
  // re-acquires and at double it never does (final separation 363 wu). 110-130 leaves a
  // negative dead core at every one of these.
  //
  // ── PLACED FOR THE HUMAN'S ROUTES, AND THE SYMMETRY MAKES THAT FREE ─────────
  // `conceal_lab --traffic` (440 matches, 317,430 playing ticks) found the two fighters
  // barely share ground: the player's hot cells are (200,360) 5.87% and (280,360) 5.78%,
  // the enemy's are (1000,440) 12.71% and (1160,520) 11.87%, and **the player is at
  // 0.000% in the enemy's two busiest cells.** That reads as "one region set cannot serve
  // both" — and on a point-symmetric map it is the opposite. Each fighter camps its OWN
  // spawn quadrant, and those two quadrants are 180 degree images of each other, so a
  // MIRROR PAIR automatically puts one patch in the player's traffic and the other in the
  // enemy's. P1 covers the player's two hottest cells; P1's mirror sits in the enemy's
  // approach; P3's mirror covers the enemy's single hottest cell (1000,440).
  //
  // ── THE MIRROR IS A TRANSFORM IN SOURCE, AND THE TEST IS ON THE SHIPPED DATA ─
  // Point symmetry is a COMPETITIVE-FAIRNESS constraint in the same category as
  // `tools/aspect.mjs`, and hand-typing a mirrored coordinate is exactly how it breaks.
  // Each pair is therefore written ONCE as a named constant and mirrored as
  // `ARENA_W - K` / `ARENA_H - K`, which is the same idiom every mirrored prop above
  // uses, and `tools/tmp/ap_reach.mjs --selftest` §F asserts point symmetry of BOTH
  // lists on the BROWSER DUMP — the data the game actually builds — and is shown to
  // FAIL on a one-box perturbation.
  //
  // ⚠️ **A `for` LOOP OVER A TABLE WAS WRITTEN FIRST AND HAD TO BE REVERTED.**
  // `tools/tmp/arena_probe.mjs`'s source extractor evaluates each call site's coordinate
  // expressions against a scope of `ARENA_W`/`ARENA_H`/`CENTER`/`POT` plus the file's own
  // UPPERCASE numeric consts, so `x: px` from a loop variable is not evaluable — it threw
  // rather than answering, which took `--verify` (the guard that proves this source and
  // `tools/arena.gameplay.json` agree box-for-box) offline with it. Named consts are
  // readable by that extractor and give the loop's real benefit anyway: the number
  // appears once.
  const concealment: ConcealBox[] = [];
  const concealGroup = new THREE.Group();
  concealGroup.name = 'arena_concealment';
  noOutline(concealGroup);

  // P1 — the spawn-lane plates. Covers the player's two busiest cells ((200,360) 5.87%,
  // (280,360) 5.78%); nearest corner 377.7 wu from centre; 4 wu clear of the NW freezer's
  // collision shadow, so every wu of it is standable.
  const CONCEAL_P1X = 260, CONCEAL_P1Y = 375, CONCEAL_P1S = 130;
  addConceal(concealGroup, concealment, M, {
    x: CONCEAL_P1X, y: CONCEAL_P1Y, w: CONCEAL_P1S, h: CONCEAL_P1S, kind: 'plate_stack',
    build: (w, d) => buildConcealPatch(M, w, d),
  });
  addConceal(concealGroup, concealment, M, {
    x: ARENA_W - CONCEAL_P1X, y: ARENA_H - CONCEAL_P1Y, w: CONCEAL_P1S, h: CONCEAL_P1S,
    kind: 'plate_stack', yawDeg: 180,
    build: (w, d) => buildConcealPatch(M, w, d),
  });

  // P2 — the north service line's tray racks, in the lane between the sink counter and
  // the pantry. Nearest corner 286.2 wu from centre.
  const CONCEAL_P2X = 850, CONCEAL_P2Y = 175, CONCEAL_P2S = 110;
  addConceal(concealGroup, concealment, M, {
    x: CONCEAL_P2X, y: CONCEAL_P2Y, w: CONCEAL_P2S, h: CONCEAL_P2S, kind: 'tray_rack',
    build: (w, d) => buildConcealPatch(M, w, d),
  });
  addConceal(concealGroup, concealment, M, {
    x: ARENA_W - CONCEAL_P2X, y: ARENA_H - CONCEAL_P2Y, w: CONCEAL_P2S, h: CONCEAL_P2S,
    kind: 'tray_rack', yawDeg: 180,
    build: (w, d) => buildConcealPatch(M, w, d),
  });

  // P3 — the west lane mouth, the last cover before the hub. Nearest corner 260.0 wu from
  // centre, i.e. 11.75 wu outside the keepout — the tightest of the three, and the reason
  // it is 120 rather than 130. Its MIRROR (1020,440) lands on the enemy's single hottest
  // cell, (1000,440) at 12.71%.
  const CONCEAL_P3X = 380, CONCEAL_P3Y = 560, CONCEAL_P3S = 120;
  addConceal(concealGroup, concealment, M, {
    x: CONCEAL_P3X, y: CONCEAL_P3Y, w: CONCEAL_P3S, h: CONCEAL_P3S, kind: 'crate_stack',
    build: (w, d) => buildConcealPatch(M, w, d),
  });
  addConceal(concealGroup, concealment, M, {
    x: ARENA_W - CONCEAL_P3X, y: ARENA_H - CONCEAL_P3Y, w: CONCEAL_P3S, h: CONCEAL_P3S,
    kind: 'crate_stack', yawDeg: 180,
    build: (w, d) => buildConcealPatch(M, w, d),
  });

  root.add(concealGroup);

  // ── Ambient dust ──────────────────────────────────────────────────────────────
  const dust = buildDustField(M, 40);
  root.add(dust.mesh);

  // ── Spawns ────────────────────────────────────────────────────────────────────
  //
  // ── Why y is 390 and not CENTER.y ────────────────────────────────────────────
  // 180° point symmetry forces the segment between two spawns through the arena
  // centre, and the arena centre is a 32 HP/s hazard. On the centre line that is not
  // merely a coincidence, it is a trap: `POT.bodyRadius*2` blocks a fighter's centre
  // at r=73 while `POT.dangerRadius` burns from r=95, so a player holding one
  // direction out of spawn ran 466 wu, jammed flush against the pot **inside its burn
  // ring**, and cooked. Measured with the scripted `chase` player over all 110
  // matchups: the pot went from 0% of all damage dealt to **71%**, and the naive
  // player's win rate collapsed 47.3% -> 12.7%, without one balance constant moving.
  // The old lane barrels had hidden this by stopping everyone 38 wu from spawn.
  //
  // Offsetting each spawn 110 wu off the centre line — still exactly point-symmetric,
  // so both sides remain identical — puts the straight-ahead run clear of both the pot
  // box (needs |dy| > 73) and its burn ring (needs |dy| > 95). Pot share falls to 25%
  // and the naive win rate recovers to 39.1%. The offset costs 22 wu of spawn
  // separation (1080 -> 1102 straight line) and nothing else.
  //
  // ── Why the SEPARATION did not change ────────────────────────────────────────
  // Swept through all 110 matchups at gaps 1080/1000/920/840/760 on this layout.
  // Dead time did not improve (56.6 / 55.6 / 58.9 / 58.1 / 57.6%) because shortening
  // the walk shortens the match by about as much, while the scripted player's win rate
  // climbed 56.4% -> 90.0% as the spawns approached the hub. Pulling the spawns in buys
  // 1.7 s of contact time and costs a 34 pp balance swing, so it was not taken. The
  // pacing win came from the ROUTE (1341 -> 1171 wu) instead — see the barrels above.
  const playerSpawn = { x: 160, y: 390 };
  const enemySpawn = { x: ARENA_W - 160, y: ARENA_H - 390 };

  // ── SEATS 2..5 — the N-fighter spawn list (DECISIONS §49d) ───────────────────
  //
  // `sim.ts:createMatch` THREW for slot 2 and up rather than inventing a ring, because
  // spawn placement for 4-6 fighters is arena geometry and §48 makes true 180° point
  // symmetry a competitive-fairness constraint in the same category as `tools/aspect.mjs`.
  // This is the owner that refusal was waiting for. `spawns[0]`/`spawns[1]` are the two
  // objects above — not copies of their numbers — so a two-fighter match cannot drift from
  // what it has always read, and it is MEASURED rather than assumed:
  // `conceal_lab --bitid --corpus normal,timeout,countdown` run against the pre-change dump
  // and this one reports the same 15,674,938 ticks and 4,280,119 in-order events with
  // 0 divergent on both, and `match-sim --all-matchups` is byte-identical across the two at
  // policies smart, chase and idle.
  //
  // ── THREE PAIRS, AND AN ODD COUNT IS IMPOSSIBLE ─────────────────────────────
  // Exactly the argument the concealment block above makes: under a 180° point symmetry
  // every spawn is paired with its image, so an unpaired one would have to BE its image —
  // i.e. sit on the map centre, which is inside the boiling pot's own CoverBox and inside
  // the 248.25 wu endgame keep-out. So 3 pairs, 6 seats, interleaved so that N=2, N=4 and
  // N=6 are each a complete set of mirror pairs.
  //
  // ── 🔴 THE MAP HAS ROOM FOR EXACTLY TWO SPAWN REGIONS PER HALF, AND THIS IS THE
  //    MEASURED CASE FOR §48'S 2800x2000 ARENA ────────────────────────────────
  // `tools/tmp/sp_place.mjs` swept all 327,561 cells of a 2 wu lattice against every rule a
  // spawn has to satisfy — legal for a 42 wu body, `spawn_runway`-clean (60 wu in all four
  // cardinals over a ±21 wu band), no cardinal run STOPPING in the pot's burn ring, outside
  // the endgame keep-out, not concealed at t=0, not in a grease puddle — and **2,186 cells
  // survived, in FOUR regions that are two mirror pairs**:
  //
  //     the spawn bay      x 81..195,  y 366..406   114 x 40 wu   (and its 180° image)
  //     the north lane     x 556..583, y  81..93     27 x 12 wu   (and its 180° image)
  //
  // Everything else on the map fails, and the runway rule is the binding one by 47x:
  // dropping it alone takes 2,186 cells to 103,926. `shots/sp/admissible.png` is the picture.
  //
  // So pair A (the shipped duel pair) and pair C SHARE THE SPAWN BAY. The bay's absolute
  // best is 77.6 wu and this pair takes **75.2 wu** — inside `REACH.meleeHeavy` (84),
  // outside `REACH.meleeStrong` (70). **At six seats two fighters begin the match a heavy
  // swing apart, and it is not theoretical**: a real 6-fighter match, photographed in
  // `shots/sp/n6-playing.png`, is 9 s old and reads
  //
  //     slot 0   0/70  DEAD   75.2 wu from slot 4        slot 2   71/80    509.8 wu from anyone
  //     slot 5  11/140  0.08  75.2 wu from slot 1        slot 3  120/120   509.8 wu from anyone
  //     slot 1  28/110  0.25                             slot 4   90/90
  //
  // — the two worst-hurt seats are both bay-sharers, and the two healthiest are both out in
  // the north lane. The paired control is the SAME RUN at N=3 and N=4: same map, same frozen
  // clock, same seeded rng, same cast prefix, spawns 509.8 wu apart — **nobody dead, and at
  // N=3 nobody below full health**. At four seats the map is fine. That is the number §48
  // was missing — the 1400x1000 kitchen seats FOUR, not six.
  //
  // ── WHY THESE EXACT CELLS ───────────────────────────────────────────────────
  // Inside each region, separation trades against robustness 1 wu for 1 wu (both bays are
  // bounded by the west/east wall, so every wu you move outboard is a wu off the west
  // runway). The north lane is the tighter region and its deepest interior cell is only
  // 7 wu from a refusal, so BOTH new pairs are placed at depth 7 / worst-cardinal runway
  // 66 wu — matching the tightest region's robustness and spending everything else on
  // separation. Measured, all six, by `tools/tmp/spawn_runway.mjs --layout` (16/16 per
  // pair) and `tools/tmp/ap_reach.mjs --layout` (0 sealed, 0 phantom, one component, at
  // body-visual 18/20/22/24/26).
  //
  // ⚠️ THE MIRROR IS A TRANSFORM IN SOURCE, exactly as the concealment pairs are, and
  // `tools/tmp/sp_gate.mjs` asserts the symmetry on the SHIPPED DUMP — the data the game
  // actually builds — and is shown to FAIL on a one-wu perturbation of any entry.
  // Named consts rather than a table+loop for the same reason the concealment block gives:
  // `arena_probe.mjs`'s source extractor cannot evaluate a loop variable.
  const SPAWN_P2X = 570, SPAWN_P2Y = 87;   // the north lane, between the spice cart and the sink counter
  const SPAWN_P3X = 87, SPAWN_P3Y = 372;   // the spawn bay, outboard of the shipped pair
  const spawns = [
    playerSpawn,
    enemySpawn,
    { x: SPAWN_P2X, y: SPAWN_P2Y },
    { x: ARENA_W - SPAWN_P2X, y: ARENA_H - SPAWN_P2Y },
    { x: SPAWN_P3X, y: SPAWN_P3Y },
    { x: ARENA_W - SPAWN_P3X, y: ARENA_H - SPAWN_P3Y },
  ];

  // ── The value lift ───────────────────────────────────────────────────────────
  // LAST, after everything is in `root`, because it walks the finished graph. See the
  // long note above `ARENA_VALUE_GAMMA` in `./shared.ts` for the measurement that
  // motivated it (the arena's whole value ladder sat below all six top-down reference
  // plates while every colour rail read PASS), for why the transform is a uniform
  // per-channel scale (hue exactly preserved, saturation provably cannot fall) and for
  // the sweep that chose the exponent. It is applied here rather than at each authored
  // hex so that every relative decision recorded in `KPAL` — "below the caps in value",
  // "at the tile's own value", "the darkest thing in the arena" — survives untouched.
  liftArenaValue(root);

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
    spawns,
    cover,
    hazards,
    concealment,
    build: () => root,
    update: (_dt: number, elapsed: number) => {
      updateAmbient(elapsed);
    },
  };

  return def;
};
