/**
 * Kitchen arena — a working restaurant kitchen, built up from the prototype's single
 * 4-cabinet / 2-island / 1-pot layout into a full Brawl-Stars-scale map.
 *
 * ── Layout concept ───────────────────────────────────────────────────────────────
 * **2800 x 2000 world units**, laid out with true 180° point symmetry around the centre
 * so every spawn faces an identical, fair map.
 *
 * ⚠️ **IT WAS 1400 x 1000 UNTIL 2026-08-11, AND THE OLD NUMBER IS KEPT HERE ON PURPOSE.**
 * `DECISIONS §48`, Uri: *"Arena x4 - area to accommodate 4-6 players"* — **x4 AREA, not x4
 * linear**, so x2 on each edge. `§53a`, the same day: *"6 players only on the x4 map."*
 * `sp_place.mjs` had just measured why: of 327,561 candidate cells on the 1400x1000 map
 * only **2,186** satisfied every spawn rule, in **two** mirror-pair regions, so a third
 * pair had to share the west bay at **75.2 wu — inside `REACH.meleeHeavy`** and slot 0 was
 * dead nine seconds into a real match. **The small map seats FOUR.** This one seats six,
 * and the acceptance test for that claim is the spawn block at the bottom of this file.
 *
 * ── The FIVE rules the layout must satisfy, and why ──────────────────────────────
 * Read these before moving any prop. Every one was a measured defect, and every one is
 * re-checkable in seconds: `tools/tmp/arena_probe.mjs` (1-3), `tools/tmp/ap_reach.mjs` (4)
 * and `tools/tmp/x4_layout.mjs` (3, 4, 5 and the size rules, all at once).
 *
 *   1. **COVER DENSITY MUST FALL TOWARD THE CENTRE.** The closing ring has to force
 *      fighters INTO each other; if the middle is the most cluttered part of the map
 *      it forces them into furniture instead. Measured on the 1400x1000 layout,
 *      occlusion rose 30.6% -> 67.7% as the ring shrank, because the four stove islands'
 *      inner corners sat **138 wu from centre — inside MIN_SAFE_RADIUS (140)**. At ±270/±200
 *      the inner corner sat at 241 wu and the endgame became a ring around ONE pillar, as
 *      intended. ⚠️ **±270/±200 is now ±320/±240 and 241 is now 305** — see rule 6: the
 *      ring itself moved to 237 at six seats, so the same argument produces a wider hub.
 *      → `arena_probe.mjs --occl` must end BELOW where it starts.
 *      ⚠️ **At 2800x2000 this rule got EASIER and its number moved.** The hub keeps its
 *      exact 1x offsets (rule 2), so the entire r < 500 wu disc holds nothing but the pot,
 *      four islands and two service counters, while ~104 props live outside it. Density
 *      genuinely falls toward the centre now instead of merely not rising.
 *
 *   2. **THE POT / CENTRAL HUB STAYS IN THE MIDDLE AT ITS CURRENT SCALE.** Uri, on how to
 *      grow the map: *"Obviously adding more obstacles, keeping the pot in the middle,
 *      things like that."* **A hub that doubles is a different game object; a hub that
 *      stays put becomes the landmark a bigger map needs.** So the pot, the four stove
 *      islands at CENTER ± 270/200 and the two service counters at CENTER.y ± 330 are
 *      written as offsets FROM CENTER and are byte-for-byte the 1400x1000 hub, moved.
 *      `x4_layout --selftest` §G asserts that against the shipped 1x dump.
 *
 *   3. **TRUE 180° POINT SYMMETRY — competitive fairness, the same category as
 *      `tools/aspect.mjs`.** It is the easiest thing in the world to break while placing
 *      ~110 props by hand, so **it is not placed by hand**: `tools/tmp/x4_layout.mjs`
 *      holds the NORTH HALF only and generates the south by transform, and every mirror
 *      below is written `ARENA_W - K` / `ARENA_H - K` rather than as a typed coordinate.
 *      `ap_reach --selftest` §F then asserts the symmetry on the BROWSER DUMP — the data
 *      the game actually builds, not the source that claims to build it — and is shown to
 *      FAIL on a 1 wu nudge of any single box.
 *
 *   4. 🔴 **NO GAP BETWEEN TWO FACES MAY BE WIDER THAN THE DRAWN BODY AND NARROWER THAN
 *      THE COLLIDING ONE.** Uri, playing the 1400x1000 build 2026-08-11:
 *      *"there are regions in the map that are unreachable due to obstacles."* He was
 *      right, and no gate could see it, because the space is not SEALED — the flood
 *      `arena_probe --truth` runs printed ONE PIECE, 0.00% sealed, 100% ceiling throughout.
 *
 *      A character is DRAWN 19.1 wu wide (Donut) to 36.1 wu (Hamburger) and COLLIDES as
 *      **`PLAYER_SIZE` = 42, for every one of them**. So a gap of roughly 19..42 wu is
 *      floor you can SEE, that reads as somewhere you could stand, and that no fighter can
 *      ever enter. **Fourteen of them shipped on the small map**, in seven point-symmetric
 *      pairs, deepest point 68 wu from anywhere standable.
 *
 *      🚨 **AND AT 2800x2000 THE BAND IS WIDER, BECAUSE THE NAV GRID SILENTLY HALVED ITS
 *      RESOLUTION.** `movement.ts:NAV_MAX_CELLS` is 40,000; this arena at the shipped
 *      10 wu cell needs 56,000, so `navGrid` doubles the cell to **20 wu** — and
 *      `NAV_CELL`'s own doc block records that **cell 20 already failed the 1400x1000
 *      kitchen's tightest legal gap** (it cost 7 of 358 cells). A corridor narrower than a
 *      body plus two cells is a corridor the flow field cannot see, so the AI walks past
 *      it. `movement.ts` is not this file's to change, so the constant is answered as a
 *      LAYOUT RULE instead:
 *
 *          **EVERY face-to-face gap is <= 16 wu (a slit) or >= 82 wu (a corridor).**
 *          82 = `PLAYER_SIZE` (42) + 2 x the 20 wu nav cell. The 16..82 band is illegal
 *          and it strictly contains rule 4's own 19..42 band, so one rule now covers both.
 *
 *      ⚠️ **16 AND NOT 18, AND THE 2 wu IS A MEASURED DEFECT RATHER THAN A MARGIN.** The
 *      first pass used 18 — "at or below the narrowest drawn body" — and a north-wall gap
 *      of EXACTLY 18 against a body-visual of EXACTLY 18 left a **measure-zero legal line**
 *      down the middle of the slit, because the collision test is a strict `<`.
 *      `ap_reach --body-visual 18` reported it as a real PHANTOM POCKET: 124 wu², 60 wu
 *      long, ONE lattice cell wide, 46 wu from anywhere standable. The gap was legal by
 *      the letter of the rule and produced exactly the defect the rule exists to prevent,
 *      so the rule moved off its own boundary.
 *
 *      ⚠️ **AND A FACE-GAP CHECK IS STRUCTURALLY BLIND TO THE DIAGONAL CASE.** Two props
 *      that overlap on NEITHER axis have no face gap at all, and their 21 wu collision
 *      collars can still leave a channel between them — measured at **0.5 wu** between the
 *      north-wall pot stack and the NW freezer, which `ap_reach` then reported as a 16 wu
 *      deep band region on a map whose 1400x1000 predecessor scores ZERO.
 *      `x4_layout.mjs:notchFaults` moves the test into INFLATED space, where a fighter's
 *      centre actually lives, and is the only check that can see it.
 *
 *      → `node tools/tmp/ap_reach.mjs --body-visual {18,20,22,24,26}` must report ZERO
 *        sealed pockets, ZERO phantom pockets and ZERO face gaps at every width.
 *
 *   6. 🔴 **NOTHING SOLID MAY STAND INSIDE THE LARGEST FINAL RING, PLUS A BODY.** The fog's
 *      last safe circle is the only ground left at the end of a match. A solid CoverBox
 *      inside it funnels six fighters into a ring they cannot occupy — and **no other rule
 *      in this file would say so**, because such a box is legal, reachable, point-symmetric
 *      and correctly gapped from its neighbours.
 *
 *      `4bb64e4` made the ring a function of the fighter count:
 *
 *          minSafeRadiusFor(N) = max(MIN_SAFE_RADIUS, ENDGAME_STANDOFF/sin(pi/N) - POT.dangerRadius)
 *          N = 2..4 -> 140.00     N = 5 -> 187.42     N = 6 -> **237.00**
 *
 *      and `§53a` puts six players on THIS map and no other, so **this is the arena that
 *      closes at 237**. The threshold is `ring + PLAYER_SIZE` = 279 — the SAME rule the
 *      1400x1000 hub was placed by (*"outside MIN_SAFE_RADIUS + a fighter's own reach"*),
 *      re-run against the constant that moved. The exact minimum is `ring + PLAYER_SIZE/2`
 *      (a box blocks fighter CENTRES out to its face plus a half body, so at ring+21 the
 *      whole disc is standable); the second half body makes the ring enterable and
 *      leaveable at its edge rather than merely occupiable.
 *
 *      🚨 **THIS SHIPPED WRONG ONCE, BY 4.35 wu.** The first version of this file kept the
 *      1x hub offsets ±270/±200 verbatim, which is the right instinct for rule 2 and put
 *      the islands' inner corner at **241.35 wu — inside the ring**. It passed every other
 *      check here. `tools/tmp/x4_layout.mjs` now restores exactly that geometry as a
 *      known-bad and requires rule 6 to refuse it while everything else still passes,
 *      because a guard that has not been shown to fail on its own bug is not a guard.
 *
 *      ⚠️ **THE POT IS EXEMPT AND THAT IS NOT A LOOPHOLE**: `minSafeRadiusFor` SUBTRACTS
 *      `POT.dangerRadius` in its own derivation, so the ring is already sized as an annulus
 *      around the pot. Every OTHER solid box is a surprise the formula never saw.
 *      ⚠️ **CONCEALMENT IS EXEMPT TOO, deliberately**: a patch blocks nothing and can be
 *      shot through, so a patch inside the ring is cover the endgame can actually use.
 *      → `node tools/tmp/x4_layout.mjs` must report RULE 6 with ZERO faults. Shipped
 *        clearance: nearest solid cover **295.00 wu, 58.00 wu clear of the ring.**
 *
 *   5. **~4x THE CONCEALMENT PATCH COUNT, AT THE UNCHANGED ~168 wu CAP.** `§48` rule 5:
 *      `CONCEAL_REVEAL_RADIUS` does not scale with the arena, so a patch wider than
 *      `2 x 84` = 168 wu has an interior `stepAI` can never see into, however big the map
 *      gets. **More objects, not bigger ones** — 6 patches became **20**, all still
 *      110-130 wu. The keep-out they must clear DID scale, 248.25 -> **496.25 wu**, so
 *      every patch sits out past r=500.
 *
 * ── The map itself ───────────────────────────────────────────────────────────────
 *   - A central STOVE HUB, unchanged from 1400x1000 and unchanged in size: the boiling pot
 *     alone in a wide clearing, four stove islands pushed out to the edge of it, a sink
 *     counter north and a fryer counter south. The classic "danger in the middle, cover on
 *     the corners" hub — cardinal lanes open, diagonals blocked, the hub lethal to linger
 *     in. On a map four times the size it is the LANDMARK, which is the whole argument for
 *     not growing it.
 *   - WALK-IN FREEZERS anchor the NW and SE corners, now stacked two deep with a crate
 *     tucked under, and a second walk-in stands mid-map east and west as the inboard wall
 *     of each spawn bay.
 *   - PANTRY NOOKS anchor the NE and SW corners: five boxes clustered tight, reading as one
 *     nook with more silhouette variety than a freezer.
 *   - A SERVICE LINE runs the full length of the north and south walls — pot stacks,
 *     barrels, spice carts and counters, the 1x idiom extended outward rather than
 *     sprinkled.
 *   - COOK LINES and PREP GALLEYS are the new structure the extra space bought: paired
 *     counters and paired stove islands butted into single long runs, so the middle band
 *     has real lanes and rooms instead of scattered clutter.
 *   - SUPPLY BARRELS sit FLUSH to the west and east walls (x = w/2). Not pushed inboard:
 *     at 30 wu off the wall they strand a strip of visible floor nothing can enter, which
 *     is rule 4 and which **Uri found by playing**.
 *   - SIX SPAWNS, in three 180°-point-symmetric pairs, one pair per BAY (west, north lane,
 *     north-east corner). See the spawn block for the measurements.
 *
 * ── Every CoverBox has exactly one matching visual, built by the same call ───────
 * `addCover()` is the single place a collision box gets created, and it always
 * builds and places the matching mesh in the same statement — there is no path to
 * declaring one without the other.
 *
 * ── Module map ───────────────────────────────────────────────────────────────────
 * This file owns ONLY `createKitchenArena()` itself: the layout (every `addCover` call
 * site and its coordinates), the CoverBox/hazard lists, and wiring `update()`.
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
 *
 * ⚠️ **THE LAYOUT BELOW IS GENERATED, AND THE GENERATOR IS THE PLACE TO EDIT IT.**
 * `tools/tmp/x4_layout.mjs` holds the NORTH HALF as a table, mirrors it by transform,
 * checks symmetry / mesh clips / the 16..82 gap band / diagonal notches / deep band
 * regions / the nav graph at cell 20 / every spawn rule / the concealment cap and the
 * density, and only then emits these call sites. Hand-editing a coordinate here is
 * allowed and is exactly how the 1400x1000 map accumulated fourteen unreachable regions:
 * **run `node tools/tmp/x4_layout.mjs` after any edit, by hand or not.**
 *
 * ⚠️ And the call sites are LITERAL rather than a table+loop for one concrete reason:
 * `arena_probe.mjs`'s source extractor evaluates each site's coordinate expressions
 * against a scope of `ARENA_W`/`ARENA_H`/`CENTER`/`POT` plus this file's own UPPERCASE
 * numeric consts, so `x: px` from a loop variable is not evaluable — it threw rather than
 * answering, which took `--verify` offline with it.
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

  // ── The central stove hub, at CENTER and at its 1400x1000 SCALE (§48 rule 2) ─
  //
  // ⚠️ **±320/±240, AND THE 1x MAP'S ±270/±200 IS KEPT HERE BECAUSE IT WAS RIGHT.** That
  // pair was chosen so the island's INNER CORNER sat at hypot(185,155) = 241 wu — *"outside
  // MIN_SAFE_RADIUS + a fighter's own reach"*, i.e. 140 + PLAYER_SIZE = 182, with 59 wu to
  // spare. The derivation still stands. **The constant under it does not**: `4bb64e4` made
  // the final ring `minSafeRadiusFor(N)`, which at MAX_FIGHTERS = 6 is **237**, and 241.35
  // is 4.35 wu inside it. Re-running the ORIGINAL rule against the NEW constant gives
  // 237 + 42 = 279, and ±320/±240 puts the inner corner at hypot(235,195) = **305.29**.
  //
  // **THIS IS NOT A HUB THAT GREW.** Every island is still 170x90, the pot is untouched,
  // the service counters have not moved, and the same `CENTER ± (DX, DY)` expression places
  // them. The number moved because the ring moved. A hub PINNED at ±270 on a map that
  // closes at 237 is the funnel rule 6 exists to prevent, and `x4_layout --selftest` §D
  // restores exactly it as the known-bad.
  addCover(propsGroup, cover, M, {
    x: CENTER.x - 320, y: CENTER.y - 240, w: 170, h: 90, kind: 'stove_island',
    build: (w, d) => buildStoveIsland(M, w, d),
  });
  addCover(propsGroup, cover, M, {
    x: CENTER.x + 320, y: CENTER.y + 240, w: 170, h: 90, kind: 'stove_island', yawDeg: 180,
    build: (w, d) => buildStoveIsland(M, w, d),
  });
  addCover(propsGroup, cover, M, {
    x: CENTER.x + 320, y: CENTER.y - 240, w: 170, h: 90, kind: 'stove_island',
    build: (w, d) => buildStoveIsland(M, w, d, { panRack: true }),
  });
  addCover(propsGroup, cover, M, {
    x: CENTER.x - 320, y: CENTER.y + 240, w: 170, h: 90, kind: 'stove_island', yawDeg: 180,
    build: (w, d) => buildStoveIsland(M, w, d, { panRack: true }),
  });
  addCover(propsGroup, cover, M, {
    x: CENTER.x, y: CENTER.y - 330, w: 150, h: 70, kind: 'sink_counter', yawDeg: 180,
    build: (w, d) => buildServiceCounter(M, w, d, 'sink'),
  });
  addCover(propsGroup, cover, M, {
    x: CENTER.x, y: CENTER.y + 330, w: 150, h: 70, kind: 'fryer_counter',
    build: (w, d) => buildServiceCounter(M, w, d, 'fryer'),
  });

  // ── NW walk-in freezer stack — the 1x corner landmark, now two deep ─────────
  addCover(propsGroup, cover, M, {
    x: 300, y: 300, w: 230, h: 190, kind: 'freezer',
    build: (w, d) => buildFreezerSized(M, w, d),
  });
  addCover(propsGroup, cover, M, {
    x: ARENA_W - 300, y: ARENA_H - 300, w: 230, h: 190, kind: 'freezer', yawDeg: 180,
    build: (w, d) => buildFreezerSized(M, w, d),
  });
  addCover(propsGroup, cover, M, {
    x: 300, y: 500, w: 230, h: 190, kind: 'freezer',
    build: (w, d) => buildFreezerSized(M, w, d),
  });
  addCover(propsGroup, cover, M, {
    x: ARENA_W - 300, y: ARENA_H - 500, w: 230, h: 190, kind: 'freezer', yawDeg: 180,
    build: (w, d) => buildFreezerSized(M, w, d),
  });
  addCover(propsGroup, cover, M, {
    x: 300, y: 650, w: 80, h: 80, kind: 'produce_crate_tall',
    build: (w, d) => buildCrateTall(M, w, d),
  });
  addCover(propsGroup, cover, M, {
    x: ARENA_W - 300, y: ARENA_H - 650, w: 80, h: 80, kind: 'produce_crate_tall', yawDeg: 180,
    build: (w, d) => buildCrateTall(M, w, d),
  });

  // ── West wall strip — flush to the wall (x = w/2), b9bc00e rule 4 ───────────
  addCover(propsGroup, cover, M, {
    x: 30, y: 250, w: 60, h: 50, kind: 'supply_barrel',
    build: (w, d) => buildSupplyBarrel(M, w, d),
  });
  addCover(propsGroup, cover, M, {
    x: ARENA_W - 30, y: ARENA_H - 250, w: 60, h: 50, kind: 'supply_barrel', yawDeg: 180,
    build: (w, d) => buildSupplyBarrel(M, w, d),
  });
  addCover(propsGroup, cover, M, {
    x: 135, y: 720, w: 80, h: 80, kind: 'produce_crate_tall',
    build: (w, d) => buildCrateTall(M, w, d),
  });
  addCover(propsGroup, cover, M, {
    x: ARENA_W - 135, y: ARENA_H - 720, w: 80, h: 80, kind: 'produce_crate_tall', yawDeg: 180,
    build: (w, d) => buildCrateTall(M, w, d),
  });
  addCover(propsGroup, cover, M, {
    x: 150, y: 900, w: 90, h: 90, kind: 'herb_crate',
    build: (w, d) => buildHerbCrate(M, w, d),
  });
  addCover(propsGroup, cover, M, {
    x: ARENA_W - 150, y: ARENA_H - 900, w: 90, h: 90, kind: 'herb_crate', yawDeg: 180,
    build: (w, d) => buildHerbCrate(M, w, d),
  });

  // ── North wall service line, west run ───────────────────────────────────────
  addCover(propsGroup, cover, M, {
    x: 525, y: 135, w: 55, h: 55, kind: 'stacked_pots',
    build: (w, d) => buildLanePots(M, w, d),
  });
  addCover(propsGroup, cover, M, {
    x: ARENA_W - 525, y: ARENA_H - 135, w: 55, h: 55, kind: 'stacked_pots', yawDeg: 180,
    build: (w, d) => buildLanePots(M, w, d),
  });
  addCover(propsGroup, cover, M, {
    x: 585, y: 135, w: 60, h: 50, kind: 'supply_barrel',
    build: (w, d) => buildSupplyBarrel(M, w, d),
  });
  addCover(propsGroup, cover, M, {
    x: ARENA_W - 585, y: ARENA_H - 135, w: 60, h: 50, kind: 'supply_barrel', yawDeg: 180,
    build: (w, d) => buildSupplyBarrel(M, w, d),
  });
  addCover(propsGroup, cover, M, {
    x: 775, y: 135, w: 150, h: 70, kind: 'sink_counter', yawDeg: 180,
    build: (w, d) => buildServiceCounter(M, w, d, 'sink'),
  });
  addCover(propsGroup, cover, M, {
    x: ARENA_W - 775, y: ARENA_H - 135, w: 150, h: 70, kind: 'sink_counter',
    build: (w, d) => buildServiceCounter(M, w, d, 'sink'),
  });
  addCover(propsGroup, cover, M, {
    x: 892, y: 135, w: 55, h: 55, kind: 'stacked_pots',
    build: (w, d) => buildLanePots(M, w, d),
  });
  addCover(propsGroup, cover, M, {
    x: ARENA_W - 892, y: ARENA_H - 135, w: 55, h: 55, kind: 'stacked_pots', yawDeg: 180,
    build: (w, d) => buildLanePots(M, w, d),
  });
  addCover(propsGroup, cover, M, {
    x: 958, y: 135, w: 50, h: 50, kind: 'spice_cart',
    build: (w, d) => buildSpiceCart(M, w, d),
  });
  addCover(propsGroup, cover, M, {
    x: ARENA_W - 958, y: ARENA_H - 135, w: 50, h: 50, kind: 'spice_cart', yawDeg: 180,
    build: (w, d) => buildSpiceCart(M, w, d),
  });

  // ── North wall centrepiece ──────────────────────────────────────────────────
  addCover(propsGroup, cover, M, {
    x: 1288, y: 120, w: 60, h: 50, kind: 'supply_barrel',
    build: (w, d) => buildSupplyBarrel(M, w, d),
  });
  addCover(propsGroup, cover, M, {
    x: ARENA_W - 1288, y: ARENA_H - 120, w: 60, h: 50, kind: 'supply_barrel', yawDeg: 180,
    build: (w, d) => buildSupplyBarrel(M, w, d),
  });
  addCover(propsGroup, cover, M, {
    x: 1400, y: 120, w: 160, h: 55, kind: 'prep_counter',
    build: (w, d) => buildPrepCounter(M, w, d, { knifeBlock: true }),
  });
  addCover(propsGroup, cover, M, {
    x: ARENA_W - 1400, y: ARENA_H - 120, w: 160, h: 55, kind: 'prep_counter', yawDeg: 180,
    build: (w, d) => buildPrepCounter(M, w, d, { knifeBlock: true }),
  });
  addCover(propsGroup, cover, M, {
    x: 1512, y: 120, w: 60, h: 50, kind: 'supply_barrel',
    build: (w, d) => buildSupplyBarrel(M, w, d, { dark: true }),
  });
  addCover(propsGroup, cover, M, {
    x: ARENA_W - 1512, y: ARENA_H - 120, w: 60, h: 50, kind: 'supply_barrel', yawDeg: 180,
    build: (w, d) => buildSupplyBarrel(M, w, d, { dark: true }),
  });

  // ── North wall service line, east run ───────────────────────────────────────
  addCover(propsGroup, cover, M, {
    x: 1720, y: 140, w: 90, h: 90, kind: 'herb_crate',
    build: (w, d) => buildHerbCrate(M, w, d),
  });
  addCover(propsGroup, cover, M, {
    x: ARENA_W - 1720, y: ARENA_H - 140, w: 90, h: 90, kind: 'herb_crate', yawDeg: 180,
    build: (w, d) => buildHerbCrate(M, w, d),
  });
  addCover(propsGroup, cover, M, {
    x: 1815, y: 140, w: 80, h: 80, kind: 'produce_crate_tall',
    build: (w, d) => buildCrateTall(M, w, d),
  });
  addCover(propsGroup, cover, M, {
    x: ARENA_W - 1815, y: ARENA_H - 140, w: 80, h: 80, kind: 'produce_crate_tall', yawDeg: 180,
    build: (w, d) => buildCrateTall(M, w, d),
  });
  addCover(propsGroup, cover, M, {
    x: 2015, y: 135, w: 150, h: 70, kind: 'fryer_counter',
    build: (w, d) => buildServiceCounter(M, w, d, 'fryer'),
  });
  addCover(propsGroup, cover, M, {
    x: ARENA_W - 2015, y: ARENA_H - 135, w: 150, h: 70, kind: 'fryer_counter', yawDeg: 180,
    build: (w, d) => buildServiceCounter(M, w, d, 'fryer'),
  });
  addCover(propsGroup, cover, M, {
    x: 2120, y: 135, w: 50, h: 50, kind: 'spice_cart',
    build: (w, d) => buildSpiceCart(M, w, d),
  });
  addCover(propsGroup, cover, M, {
    x: ARENA_W - 2120, y: ARENA_H - 135, w: 50, h: 50, kind: 'spice_cart', yawDeg: 180,
    build: (w, d) => buildSpiceCart(M, w, d),
  });
  addCover(propsGroup, cover, M, {
    x: 2585, y: 135, w: 90, h: 90, kind: 'herb_crate',
    build: (w, d) => buildHerbCrate(M, w, d),
  });
  addCover(propsGroup, cover, M, {
    x: ARENA_W - 2585, y: ARENA_H - 135, w: 90, h: 90, kind: 'herb_crate', yawDeg: 180,
    build: (w, d) => buildHerbCrate(M, w, d),
  });
  addCover(propsGroup, cover, M, {
    x: 2720, y: 135, w: 160, h: 55, kind: 'prep_counter',
    build: (w, d) => buildPrepCounter(M, w, d, { rollingPin: true }),
  });
  addCover(propsGroup, cover, M, {
    x: ARENA_W - 2720, y: ARENA_H - 135, w: 160, h: 55, kind: 'prep_counter', yawDeg: 180,
    build: (w, d) => buildPrepCounter(M, w, d, { rollingPin: true }),
  });

  // ── NE pantry nook — crates and sacks stacked tight, the 1x idiom scaled up ───
  addCover(propsGroup, cover, M, {
    x: 2300, y: 250, w: 90, h: 90, kind: 'herb_crate',
    build: (w, d) => buildHerbCrate(M, w, d),
  });
  addCover(propsGroup, cover, M, {
    x: ARENA_W - 2300, y: ARENA_H - 250, w: 90, h: 90, kind: 'herb_crate', yawDeg: 180,
    build: (w, d) => buildHerbCrate(M, w, d),
  });
  addCover(propsGroup, cover, M, {
    x: 2400, y: 250, w: 80, h: 80, kind: 'produce_crate_tall',
    build: (w, d) => buildCrateTall(M, w, d),
  });
  addCover(propsGroup, cover, M, {
    x: ARENA_W - 2400, y: ARENA_H - 250, w: 80, h: 80, kind: 'produce_crate_tall', yawDeg: 180,
    build: (w, d) => buildCrateTall(M, w, d),
  });
  addCover(propsGroup, cover, M, {
    x: 2300, y: 340, w: 80, h: 80, kind: 'produce_crate_tall',
    build: (w, d) => buildCrateTall(M, w, d),
  });
  addCover(propsGroup, cover, M, {
    x: ARENA_W - 2300, y: ARENA_H - 340, w: 80, h: 80, kind: 'produce_crate_tall', yawDeg: 180,
    build: (w, d) => buildCrateTall(M, w, d),
  });
  addCover(propsGroup, cover, M, {
    x: 2400, y: 345, w: 90, h: 90, kind: 'herb_crate',
    build: (w, d) => buildHerbCrate(M, w, d),
  });
  addCover(propsGroup, cover, M, {
    x: ARENA_W - 2400, y: ARENA_H - 345, w: 90, h: 90, kind: 'herb_crate', yawDeg: 180,
    build: (w, d) => buildHerbCrate(M, w, d),
  });
  addCover(propsGroup, cover, M, {
    x: 2295, y: 425, w: 110, h: 70, kind: 'flour_sacks',
    build: (w, d) => buildFlourSack(M, w, d),
  });
  addCover(propsGroup, cover, M, {
    x: ARENA_W - 2295, y: ARENA_H - 425, w: 110, h: 70, kind: 'flour_sacks', yawDeg: 180,
    build: (w, d) => buildFlourSack(M, w, d),
  });

  // ── East wall strip ─────────────────────────────────────────────────────────
  addCover(propsGroup, cover, M, {
    x: 2770, y: 200, w: 60, h: 50, kind: 'supply_barrel',
    build: (w, d) => buildSupplyBarrel(M, w, d),
  });
  addCover(propsGroup, cover, M, {
    x: ARENA_W - 2770, y: ARENA_H - 200, w: 60, h: 50, kind: 'supply_barrel', yawDeg: 180,
    build: (w, d) => buildSupplyBarrel(M, w, d),
  });
  addCover(propsGroup, cover, M, {
    x: 2745, y: 520, w: 110, h: 70, kind: 'flour_sacks',
    build: (w, d) => buildFlourSack(M, w, d),
  });
  addCover(propsGroup, cover, M, {
    x: ARENA_W - 2745, y: ARENA_H - 520, w: 110, h: 70, kind: 'flour_sacks', yawDeg: 180,
    build: (w, d) => buildFlourSack(M, w, d),
  });
  addCover(propsGroup, cover, M, {
    x: 2770, y: 590, w: 60, h: 50, kind: 'supply_barrel',
    build: (w, d) => buildSupplyBarrel(M, w, d, { dark: true }),
  });
  addCover(propsGroup, cover, M, {
    x: ARENA_W - 2770, y: ARENA_H - 590, w: 60, h: 50, kind: 'supply_barrel', yawDeg: 180,
    build: (w, d) => buildSupplyBarrel(M, w, d, { dark: true }),
  });
  addCover(propsGroup, cover, M, {
    x: 2776, y: 750, w: 48, h: 46, kind: 'supply_barrel',
    build: (w, d) => buildSupplyBarrel(M, w, d, { dark: true }),
  });
  addCover(propsGroup, cover, M, {
    x: ARENA_W - 2776, y: ARENA_H - 750, w: 48, h: 46, kind: 'supply_barrel', yawDeg: 180,
    build: (w, d) => buildSupplyBarrel(M, w, d, { dark: true }),
  });

  // ── Mid band west — the pantry shelf and the prep galley (NEW STRUCTURE) ────
  addCover(propsGroup, cover, M, {
    x: 700, y: 380, w: 110, h: 70, kind: 'flour_sacks',
    build: (w, d) => buildFlourSack(M, w, d),
  });
  addCover(propsGroup, cover, M, {
    x: ARENA_W - 700, y: ARENA_H - 380, w: 110, h: 70, kind: 'flour_sacks', yawDeg: 180,
    build: (w, d) => buildFlourSack(M, w, d),
  });
  addCover(propsGroup, cover, M, {
    x: 700, y: 465, w: 90, h: 90, kind: 'herb_crate',
    build: (w, d) => buildHerbCrate(M, w, d),
  });
  addCover(propsGroup, cover, M, {
    x: ARENA_W - 700, y: ARENA_H - 465, w: 90, h: 90, kind: 'herb_crate', yawDeg: 180,
    build: (w, d) => buildHerbCrate(M, w, d),
  });
  addCover(propsGroup, cover, M, {
    x: 700, y: 650, w: 160, h: 55, kind: 'prep_counter',
    build: (w, d) => buildPrepCounter(M, w, d, { rollingPin: true }),
  });
  addCover(propsGroup, cover, M, {
    x: ARENA_W - 700, y: ARENA_H - 650, w: 160, h: 55, kind: 'prep_counter', yawDeg: 180,
    build: (w, d) => buildPrepCounter(M, w, d, { rollingPin: true }),
  });
  addCover(propsGroup, cover, M, {
    x: 700, y: 720, w: 160, h: 55, kind: 'prep_counter',
    build: (w, d) => buildPrepCounter(M, w, d, { knifeBlock: true }),
  });
  addCover(propsGroup, cover, M, {
    x: ARENA_W - 700, y: ARENA_H - 720, w: 160, h: 55, kind: 'prep_counter', yawDeg: 180,
    build: (w, d) => buildPrepCounter(M, w, d, { knifeBlock: true }),
  });
  addCover(propsGroup, cover, M, {
    x: 700, y: 790, w: 55, h: 55, kind: 'stacked_pots',
    build: (w, d) => buildLanePots(M, w, d),
  });
  addCover(propsGroup, cover, M, {
    x: ARENA_W - 700, y: ARENA_H - 790, w: 55, h: 55, kind: 'stacked_pots', yawDeg: 180,
    build: (w, d) => buildLanePots(M, w, d),
  });
  addCover(propsGroup, cover, M, {
    x: 950, y: 670, w: 90, h: 90, kind: 'herb_crate',
    build: (w, d) => buildHerbCrate(M, w, d),
  });
  addCover(propsGroup, cover, M, {
    x: ARENA_W - 950, y: ARENA_H - 670, w: 90, h: 90, kind: 'herb_crate', yawDeg: 180,
    build: (w, d) => buildHerbCrate(M, w, d),
  });
  addCover(propsGroup, cover, M, {
    x: 950, y: 760, w: 80, h: 80, kind: 'produce_crate_tall',
    build: (w, d) => buildCrateTall(M, w, d),
  });
  addCover(propsGroup, cover, M, {
    x: ARENA_W - 950, y: ARENA_H - 760, w: 80, h: 80, kind: 'produce_crate_tall', yawDeg: 180,
    build: (w, d) => buildCrateTall(M, w, d),
  });

  // ── Mid band west-inner — the north lane's shoulder ─────────────────────────
  addCover(propsGroup, cover, M, {
    x: 1000, y: 380, w: 90, h: 90, kind: 'herb_crate',
    build: (w, d) => buildHerbCrate(M, w, d),
  });
  addCover(propsGroup, cover, M, {
    x: ARENA_W - 1000, y: ARENA_H - 380, w: 90, h: 90, kind: 'herb_crate', yawDeg: 180,
    build: (w, d) => buildHerbCrate(M, w, d),
  });
  addCover(propsGroup, cover, M, {
    x: 1000, y: 470, w: 110, h: 70, kind: 'flour_sacks',
    build: (w, d) => buildFlourSack(M, w, d),
  });
  addCover(propsGroup, cover, M, {
    x: ARENA_W - 1000, y: ARENA_H - 470, w: 110, h: 70, kind: 'flour_sacks', yawDeg: 180,
    build: (w, d) => buildFlourSack(M, w, d),
  });

  // ── North hub approach — one island and a pot stack, the lane's only furniture ───
  addCover(propsGroup, cover, M, {
    x: 1400, y: 345, w: 55, h: 55, kind: 'stacked_pots',
    build: (w, d) => buildLanePots(M, w, d),
  });
  addCover(propsGroup, cover, M, {
    x: ARENA_W - 1400, y: ARENA_H - 345, w: 55, h: 55, kind: 'stacked_pots', yawDeg: 180,
    build: (w, d) => buildLanePots(M, w, d),
  });
  addCover(propsGroup, cover, M, {
    x: 1400, y: 430, w: 170, h: 90, kind: 'stove_island',
    build: (w, d) => buildStoveIsland(M, w, d, { panRack: true }),
  });
  addCover(propsGroup, cover, M, {
    x: ARENA_W - 1400, y: ARENA_H - 430, w: 170, h: 90, kind: 'stove_island', yawDeg: 180,
    build: (w, d) => buildStoveIsland(M, w, d, { panRack: true }),
  });

  // ── Mid band east-inner ─────────────────────────────────────────────────────
  addCover(propsGroup, cover, M, {
    x: 1740, y: 380, w: 80, h: 80, kind: 'produce_crate_tall',
    build: (w, d) => buildCrateTall(M, w, d),
  });
  addCover(propsGroup, cover, M, {
    x: ARENA_W - 1740, y: ARENA_H - 380, w: 80, h: 80, kind: 'produce_crate_tall', yawDeg: 180,
    build: (w, d) => buildCrateTall(M, w, d),
  });
  addCover(propsGroup, cover, M, {
    x: 1740, y: 460, w: 60, h: 50, kind: 'supply_barrel',
    build: (w, d) => buildSupplyBarrel(M, w, d),
  });
  addCover(propsGroup, cover, M, {
    x: ARENA_W - 1740, y: ARENA_H - 460, w: 60, h: 50, kind: 'supply_barrel', yawDeg: 180,
    build: (w, d) => buildSupplyBarrel(M, w, d),
  });
  addCover(propsGroup, cover, M, {
    x: 1950, y: 430, w: 160, h: 55, kind: 'prep_counter',
    build: (w, d) => buildPrepCounter(M, w, d, { knifeBlock: true }),
  });
  addCover(propsGroup, cover, M, {
    x: ARENA_W - 1950, y: ARENA_H - 430, w: 160, h: 55, kind: 'prep_counter', yawDeg: 180,
    build: (w, d) => buildPrepCounter(M, w, d, { knifeBlock: true }),
  });
  addCover(propsGroup, cover, M, {
    x: 1950, y: 495, w: 55, h: 55, kind: 'stacked_pots',
    build: (w, d) => buildLanePots(M, w, d),
  });
  addCover(propsGroup, cover, M, {
    x: ARENA_W - 1950, y: ARENA_H - 495, w: 55, h: 55, kind: 'stacked_pots', yawDeg: 180,
    build: (w, d) => buildLanePots(M, w, d),
  });

  // ── Mid band east — a cook line, two stove islands butted into one run ──────
  addCover(propsGroup, cover, M, {
    x: 2100, y: 650, w: 170, h: 90, kind: 'stove_island',
    build: (w, d) => buildStoveIsland(M, w, d),
  });
  addCover(propsGroup, cover, M, {
    x: ARENA_W - 2100, y: ARENA_H - 650, w: 170, h: 90, kind: 'stove_island', yawDeg: 180,
    build: (w, d) => buildStoveIsland(M, w, d),
  });
  addCover(propsGroup, cover, M, {
    x: 2100, y: 745, w: 170, h: 90, kind: 'stove_island',
    build: (w, d) => buildStoveIsland(M, w, d, { panRack: true }),
  });
  addCover(propsGroup, cover, M, {
    x: ARENA_W - 2100, y: ARENA_H - 745, w: 170, h: 90, kind: 'stove_island', yawDeg: 180,
    build: (w, d) => buildStoveIsland(M, w, d, { panRack: true }),
  });
  addCover(propsGroup, cover, M, {
    x: 2150, y: 900, w: 160, h: 55, kind: 'prep_counter',
    build: (w, d) => buildPrepCounter(M, w, d, { rollingPin: true }),
  });
  addCover(propsGroup, cover, M, {
    x: ARENA_W - 2150, y: ARENA_H - 900, w: 160, h: 55, kind: 'prep_counter', yawDeg: 180,
    build: (w, d) => buildPrepCounter(M, w, d, { rollingPin: true }),
  });
  addCover(propsGroup, cover, M, {
    x: 2262, y: 900, w: 55, h: 55, kind: 'stacked_pots',
    build: (w, d) => buildLanePots(M, w, d),
  });
  addCover(propsGroup, cover, M, {
    x: ARENA_W - 2262, y: ARENA_H - 900, w: 55, h: 55, kind: 'stacked_pots', yawDeg: 180,
    build: (w, d) => buildLanePots(M, w, d),
  });

  // ── East room — the second walk-in, anchoring the east bay's inboard wall ───
  addCover(propsGroup, cover, M, {
    x: 2450, y: 700, w: 230, h: 190, kind: 'freezer',
    build: (w, d) => buildFreezerSized(M, w, d),
  });
  addCover(propsGroup, cover, M, {
    x: ARENA_W - 2450, y: ARENA_H - 700, w: 230, h: 190, kind: 'freezer', yawDeg: 180,
    build: (w, d) => buildFreezerSized(M, w, d),
  });
  addCover(propsGroup, cover, M, {
    x: 2450, y: 845, w: 80, h: 80, kind: 'produce_crate_tall',
    build: (w, d) => buildCrateTall(M, w, d),
  });
  addCover(propsGroup, cover, M, {
    x: ARENA_W - 2450, y: ARENA_H - 845, w: 80, h: 80, kind: 'produce_crate_tall', yawDeg: 180,
    build: (w, d) => buildCrateTall(M, w, d),
  });

  // ── The west bay's inboard wall — what makes the bay a BAY and not a lane ───
  addCover(propsGroup, cover, M, {
    x: 450, y: 845, w: 50, h: 50, kind: 'spice_cart',
    build: (w, d) => buildSpiceCart(M, w, d),
  });
  addCover(propsGroup, cover, M, {
    x: ARENA_W - 450, y: ARENA_H - 845, w: 50, h: 50, kind: 'spice_cart', yawDeg: 180,
    build: (w, d) => buildSpiceCart(M, w, d),
  });
  addCover(propsGroup, cover, M, {
    x: 450, y: 910, w: 160, h: 55, kind: 'prep_counter',
    build: (w, d) => buildPrepCounter(M, w, d, { knifeBlock: true }),
  });
  addCover(propsGroup, cover, M, {
    x: ARENA_W - 450, y: ARENA_H - 910, w: 160, h: 55, kind: 'prep_counter', yawDeg: 180,
    build: (w, d) => buildPrepCounter(M, w, d, { knifeBlock: true }),
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
  // and the closing fog funnels EVERY fighter here at the end of every match.
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
  //
  // ⚠️ It is the ONE prop a 180 degree point symmetry allows to be unpaired, because it
  // is its own image. Every other box in this file is written with a partner.
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
  // 0.0002/255, i.e. free — and it matters four times as much at 111 props as it did at
  // 27. It is safe here precisely because this is a single whole-group call at one
  // thickness and one colour — the merge path can only combine hulls that share a
  // material.
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
  //
  // ⚠️ TWO, NOT EIGHT, AND THAT IS A DELIBERATE EXCEPTION TO "4x THE PROPS".
  // Rule 1 is about COVER density; a slow hazard is not cover and adding six more would
  // have been a balance change smuggled in under a layout pass. The pair is also load
  // bearing for a gate: `arena_probe.mjs`'s source extractor reads exactly the two
  // identifiers `puddleSouth` and `puddleNorth`, so a third puddle would take
  // `--verify` — the guard that proves this source and `tools/arena.gameplay.json` agree
  // box for box — offline with it. If more puddles are ever wanted, teach the extractor
  // FIRST.
  //
  // Both moved outboard with the map: at r=559 wu from centre they sit just OUTSIDE the
  // 496.25 wu endgame keep-out, which is where the 1x pair sat relative to its own
  // 248.25 wu keep-out. A slow field inside the final ring is a coin-flip, not a hazard.
  const puddleSouth = { x: 1830, y: 1250, radius: 50 };
  const puddleNorth = { x: ARENA_W - 1830, y: ARENA_H - 1250, radius: 50 };
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
  const boardPos = groundPos(1150, 1450);
  board.position.set(boardPos.x, 0, boardPos.z);
  board.rotation.y = THREE.MathUtils.degToRad(20);
  // No outline here, deliberately: the chalkboard has no CoverBox — it's pure
  // DECORATION — and decoration is never outlined anywhere else in the arena (see
  // `buildFloor`). Outlining it would borrow BLOCKING's now much-heavier ink line
  // and falsely suggest this collides.
  root.add(board);

  // ── Round-6 kitchen-motif clutter — pipes + signage, height variety ──────────
  // Exhaust pipes beside both freezer stacks: the tallest silhouette in either back
  // corner, giving those corners a foreground/midground/background read instead of
  // one uniform freezer-height block (see `buildExhaustPipe`). Decoration only — no
  // CoverBox, placed just clear of the freezer's own footprint.
  const pipeNW = buildExhaustPipe(M);
  const pipeNWPos = groundPos(450, 180);
  pipeNW.position.set(pipeNWPos.x, 0, pipeNWPos.z);
  root.add(pipeNW);
  const pipeSE = buildExhaustPipe(M);
  const pipeSEPos = groundPos(ARENA_W - 450, ARENA_H - 180);
  pipeSE.position.set(pipeSEPos.x, 0, pipeSEPos.z);
  root.add(pipeSE);

  // Hanging order-tag signs — signage motif, tucked against the freezer stack's north
  // face at the mouth of the west (north sign) / east (south sign) flank route.
  //
  // They used to stand at (365,500)/(1035,500) on the 1400x1000 map, which the 2 wu
  // lattice flood showed was **inside one of the two sealed pockets** — a decoration
  // nothing in the game could ever walk up to. That is also why nobody noticed these are
  // collision-free: in an open lane a sign is a solid-looking post players walk straight
  // through. (300,190) sits 15 wu clear of the freezer mesh but INSIDE the band a 42 wu
  // fighter's centre can never occupy (its inflated box is y 184..416), so it cannot be
  // walked through at all. Same convention as the exhaust pipes and the chalkboard:
  // decoration only.
  const signW = buildHangingSign(M);
  const signWPos = groundPos(300, 190);
  signW.position.set(signWPos.x, 0, signWPos.z);
  root.add(signW);
  const signE = buildHangingSign(M, 180);
  const signEPos = groundPos(ARENA_W - 300, ARENA_H - 190);
  signE.position.set(signEPos.x, 0, signEPos.z);
  signE.rotation.y = THREE.MathUtils.degToRad(180);
  root.add(signE);

  // ── CONCEALMENT — plates and trays you hide under (DECISIONS §29, §48 rule 5) ─
  //
  // Uri, playing the 1400x1000 build 2026-08-11: *"i can't hide under conceilments or
  // break them."* Both halves of the mechanic have been built and inert since `f0e7aed` —
  // the radar blip, the floating HP pill, the 3D model, the player's own screen,
  // projectile re-aim, `CONCEAL_ATTACK_REVEAL_MS` and `breakConcealment` are all wired and
  // proven bit-identical when no region exists. `b9bc00e` placed the first six.
  //
  // ── TWENTY PATCHES, AND THE COUNT IS THE ONLY THING THAT SCALED ─────────────
  // `§48` rule 5: `CONCEAL_REVEAL_RADIUS` is fixed at `REACH.meleeHeavy` = 84 wu, so a
  // patch wider than 168 wu has an interior `stepAI` — which has NO search behaviour — can
  // never see into, **however big the map gets**. So the ~168 wu ceiling is unchanged and
  // the COUNT went 6 -> 20 instead. Same instinct as rule 1: more objects, not bigger ones.
  //
  // ── WHAT DID SCALE: THE KEEP-OUT, AND IT DOUBLED ────────────────────────────
  // `concealmentKeepoutRadius` is `max(MIN_SAFE_RADIUS, maxSafeRadius x (1 −
  // CONCEAL_ENDGAME_PROGRESS))`, and `maxSafeRadius` is derived from the half-diagonal —
  // so it went **248.25 -> 496.25 wu**. Every patch below clears it; the tightest sits
  // 15.4 wu outside. That is also why there is no patch anywhere near the hub: the whole
  // r < 500 disc is refused by the same rule that refuses one on the map centre.
  //
  // ── AN ODD COUNT IS STILL IMPOSSIBLE ────────────────────────────────────────
  // True 180° point symmetry pairs every patch with its opposite, so an unpaired one would
  // have to BE its own image — i.e. sit exactly on the map centre, inside the pot's
  // CoverBox and inside the keep-out. So ten PAIRS, at 110/120/130 wu.
  //
  // ── THE MIRROR IS A TRANSFORM IN SOURCE, AND THE TEST IS ON THE SHIPPED DATA ─
  // Each pair is written ONCE as a named constant and mirrored as `ARENA_W - K` /
  // `ARENA_H - K`, and `ap_reach --selftest` §F asserts point symmetry of BOTH lists on the
  // BROWSER DUMP — the data the game actually builds — and is shown to FAIL on a one-box
  // perturbation. Named consts rather than a table+loop because `arena_probe.mjs`'s source
  // extractor cannot evaluate a loop variable.
  //
  // Every patch is >= 95% standable, measured: a patch overlapping a prop's collision
  // collar is decoration you cannot get under.
  const concealment: ConcealBox[] = [];
  const concealGroup = new THREE.Group();
  concealGroup.name = 'arena_concealment';
  noOutline(concealGroup);

  const CONCEAL_P1X = 555, CONCEAL_P1Y = 290, CONCEAL_P1S = 130;
  addConceal(concealGroup, concealment, M, {
    x: CONCEAL_P1X, y: CONCEAL_P1Y, w: CONCEAL_P1S, h: CONCEAL_P1S, kind: 'plate_stack',
    build: (w, d) => buildConcealPatch(M, w, d),
  });
  addConceal(concealGroup, concealment, M, {
    x: ARENA_W - CONCEAL_P1X, y: ARENA_H - CONCEAL_P1Y, w: CONCEAL_P1S, h: CONCEAL_P1S,
    kind: 'plate_stack', yawDeg: 180,
    build: (w, d) => buildConcealPatch(M, w, d),
  });
  const CONCEAL_P2X = 1070, CONCEAL_P2Y = 220, CONCEAL_P2S = 110;
  addConceal(concealGroup, concealment, M, {
    x: CONCEAL_P2X, y: CONCEAL_P2Y, w: CONCEAL_P2S, h: CONCEAL_P2S, kind: 'tray_rack',
    build: (w, d) => buildConcealPatch(M, w, d),
  });
  addConceal(concealGroup, concealment, M, {
    x: ARENA_W - CONCEAL_P2X, y: ARENA_H - CONCEAL_P2Y, w: CONCEAL_P2S, h: CONCEAL_P2S,
    kind: 'tray_rack', yawDeg: 180,
    build: (w, d) => buildConcealPatch(M, w, d),
  });
  const CONCEAL_P3X = 700, CONCEAL_P3Y = 910, CONCEAL_P3S = 120;
  addConceal(concealGroup, concealment, M, {
    x: CONCEAL_P3X, y: CONCEAL_P3Y, w: CONCEAL_P3S, h: CONCEAL_P3S, kind: 'crate_stack',
    build: (w, d) => buildConcealPatch(M, w, d),
  });
  addConceal(concealGroup, concealment, M, {
    x: ARENA_W - CONCEAL_P3X, y: ARENA_H - CONCEAL_P3Y, w: CONCEAL_P3S, h: CONCEAL_P3S,
    kind: 'crate_stack', yawDeg: 180,
    build: (w, d) => buildConcealPatch(M, w, d),
  });
  const CONCEAL_P4X = 1400, CONCEAL_P4Y = 235, CONCEAL_P4S = 120;
  addConceal(concealGroup, concealment, M, {
    x: CONCEAL_P4X, y: CONCEAL_P4Y, w: CONCEAL_P4S, h: CONCEAL_P4S, kind: 'tray_rack',
    build: (w, d) => buildConcealPatch(M, w, d),
  });
  addConceal(concealGroup, concealment, M, {
    x: ARENA_W - CONCEAL_P4X, y: ARENA_H - CONCEAL_P4Y, w: CONCEAL_P4S, h: CONCEAL_P4S,
    kind: 'tray_rack', yawDeg: 180,
    build: (w, d) => buildConcealPatch(M, w, d),
  });
  const CONCEAL_P5X = 1215, CONCEAL_P5Y = 420, CONCEAL_P5S = 120;
  addConceal(concealGroup, concealment, M, {
    x: CONCEAL_P5X, y: CONCEAL_P5Y, w: CONCEAL_P5S, h: CONCEAL_P5S, kind: 'plate_stack',
    build: (w, d) => buildConcealPatch(M, w, d),
  });
  addConceal(concealGroup, concealment, M, {
    x: ARENA_W - CONCEAL_P5X, y: ARENA_H - CONCEAL_P5Y, w: CONCEAL_P5S, h: CONCEAL_P5S,
    kind: 'plate_stack', yawDeg: 180,
    build: (w, d) => buildConcealPatch(M, w, d),
  });
  const CONCEAL_P6X = 1910, CONCEAL_P6Y = 290, CONCEAL_P6S = 120;
  addConceal(concealGroup, concealment, M, {
    x: CONCEAL_P6X, y: CONCEAL_P6Y, w: CONCEAL_P6S, h: CONCEAL_P6S, kind: 'crate_stack',
    build: (w, d) => buildConcealPatch(M, w, d),
  });
  addConceal(concealGroup, concealment, M, {
    x: ARENA_W - CONCEAL_P6X, y: ARENA_H - CONCEAL_P6Y, w: CONCEAL_P6S, h: CONCEAL_P6S,
    kind: 'crate_stack', yawDeg: 180,
    build: (w, d) => buildConcealPatch(M, w, d),
  });
  const CONCEAL_P7X = 2650, CONCEAL_P7Y = 380, CONCEAL_P7S = 110;
  addConceal(concealGroup, concealment, M, {
    x: CONCEAL_P7X, y: CONCEAL_P7Y, w: CONCEAL_P7S, h: CONCEAL_P7S, kind: 'tray_rack',
    build: (w, d) => buildConcealPatch(M, w, d),
  });
  addConceal(concealGroup, concealment, M, {
    x: ARENA_W - CONCEAL_P7X, y: ARENA_H - CONCEAL_P7Y, w: CONCEAL_P7S, h: CONCEAL_P7S,
    kind: 'tray_rack', yawDeg: 180,
    build: (w, d) => buildConcealPatch(M, w, d),
  });
  const CONCEAL_P8X = 2470, CONCEAL_P8Y = 975, CONCEAL_P8S = 120;
  addConceal(concealGroup, concealment, M, {
    x: CONCEAL_P8X, y: CONCEAL_P8Y, w: CONCEAL_P8S, h: CONCEAL_P8S, kind: 'plate_stack',
    build: (w, d) => buildConcealPatch(M, w, d),
  });
  addConceal(concealGroup, concealment, M, {
    x: ARENA_W - CONCEAL_P8X, y: ARENA_H - CONCEAL_P8Y, w: CONCEAL_P8S, h: CONCEAL_P8S,
    kind: 'plate_stack', yawDeg: 180,
    build: (w, d) => buildConcealPatch(M, w, d),
  });
  const CONCEAL_P9X = 2660, CONCEAL_P9Y = 860, CONCEAL_P9S = 110;
  addConceal(concealGroup, concealment, M, {
    x: CONCEAL_P9X, y: CONCEAL_P9Y, w: CONCEAL_P9S, h: CONCEAL_P9S, kind: 'crate_stack',
    build: (w, d) => buildConcealPatch(M, w, d),
  });
  addConceal(concealGroup, concealment, M, {
    x: ARENA_W - CONCEAL_P9X, y: ARENA_H - CONCEAL_P9Y, w: CONCEAL_P9S, h: CONCEAL_P9S,
    kind: 'crate_stack', yawDeg: 180,
    build: (w, d) => buildConcealPatch(M, w, d),
  });
  const CONCEAL_P10X = 100, CONCEAL_P10Y = 500, CONCEAL_P10S = 110;
  addConceal(concealGroup, concealment, M, {
    x: CONCEAL_P10X, y: CONCEAL_P10Y, w: CONCEAL_P10S, h: CONCEAL_P10S, kind: 'tray_rack',
    build: (w, d) => buildConcealPatch(M, w, d),
  });
  addConceal(concealGroup, concealment, M, {
    x: ARENA_W - CONCEAL_P10X, y: ARENA_H - CONCEAL_P10Y, w: CONCEAL_P10S, h: CONCEAL_P10S,
    kind: 'tray_rack', yawDeg: 180,
    build: (w, d) => buildConcealPatch(M, w, d),
  });

  root.add(concealGroup);

  // ── Ambient dust ──────────────────────────────────────────────────────────────
  const dust = buildDustField(M, 40);
  root.add(dust.mesh);

  // ── Spawns — SIX, in three 180°-point-symmetric pairs, one pair per BAY ──────
  //
  // ── 🔴 THIS IS THE ACCEPTANCE TEST FOR THE WHOLE ×4 MAP ─────────────────────
  //
  // `§53a`, Uri: *"6 players only on the ×4 map."* The 1400×1000 kitchen seats FOUR, and
  // that is measured rather than asserted: `sp_place.mjs` swept all 327,561 cells of a 2 wu
  // lattice against every rule a spawn has to satisfy and **2,186 survived, in TWO mirror-
  // pair regions**. Three pairs need three regions, so pair C shared the west bay with pair
  // A at **75.2 wu — inside `REACH.meleeHeavy` (84)** — and in a real seeded N=6 match slot 0
  // read **0/70, DEAD, at 9.0 s**, with both bay-sharers the worst-hurt seats and both
  // north-lane seats the healthiest.
  //
  // On this map the three pairs get three BAYS, designed rather than searched for, and the
  // number that matters is the one that killed the small map:
  //
  //     slot 0/1  (300,810)  / (2500,1190)   the WEST bay      worst runway  99 wu
  //     slot 2/3  (1150,210) / (1650,1790)   the NORTH lane    worst runway 189 wu
  //     slot 4/5  (2560,300) / (240,1700)    the NE corner bay worst runway  94 wu
  //
  //     minimum pairwise separation over all 15 pairs: **892.0 wu** (slots 0 and 5)
  //     against `REACH.rangedMax` = 140. **No weapon in the game reaches between any two
  //     spawns**, with 6.4× to spare — against 75.2 wu, which was inside a melee swing.
  //
  // Every seat clears every rule `sp_place.mjs` applies, and they are IMPORTED from it
  // rather than restated: legal for a 42 wu body, ≥ 60 wu of travel in ALL FOUR cardinals
  // over a ±21 wu band, no cardinal run STOPPING within half a body of the pot's 95 wu burn
  // ring, outside the 496.25 wu endgame keep-out, `isConcealed` false at t=0, clear of both
  // slow puddles. ⚠️ **The runway rule is the binding one and it binds by 47×** — on the
  // small map, dropping it alone took 2,186 admissible cells to 103,926 — which is why each
  // bay here is an authored void rather than whatever gap the props happened to leave.
  //
  // ⚠️ **AND ALL SIX ARE IN ONE NAV COMPONENT AT THE 20 wu CELL**, checked against
  // `movement.ts:navGrid`'s own arithmetic (140×100 cells, 9,062 passable, 1 component).
  // A layout whose seats sit in different nav components has an AI that literally cannot
  // path between them, and no other gate here would say so.
  //
  // `spawns[0]`/`spawns[1]` are the `playerSpawn`/`enemySpawn` OBJECTS, not copies of their
  // numbers, so a two-fighter match cannot drift from what the duel has always read. The
  // list is interleaved so N=2, N=4 and N=6 are each a complete set of mirror pairs; N=3 and
  // N=5 cannot be symmetric at any ordering, and `sp_gate.mjs` says so per N rather than
  // pretending otherwise.
  //
  // ⚠️ **WHAT POINT SYMMETRY BUYS, STATED PLAINLY:** a C2-symmetric map admits exactly one
  // exact statement — **seat 2k is congruent to seat 2k+1**. It cannot make pair A congruent
  // to pair B; that needs the ARENA to be invariant under a 3-fold rotation and it is not.
  // The residual is measured and printed by `sp_place --search` rather than left implied.
  const playerSpawn = { x: 300, y: 810 };
  const enemySpawn = { x: ARENA_W - 300, y: ARENA_H - 810 };

  const SPAWN_P2X = 1150, SPAWN_P2Y = 210;  // the north wall lane, west of the centrepiece
  const SPAWN_P3X = 2560, SPAWN_P3Y = 300;  // the north-east corner bay, outboard of the pantry
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
