#!/usr/bin/env node
/**
 * WHOLE-ARENA SCANNER — judge the arena as one artefact, the way a player sees it.
 *
 * ── Why this exists ──────────────────────────────────────────────────────────
 * This project decomposes everything into per-element critic loops: one agent owns
 * one element and loops until an independent critic scores it 7/10. That method has
 * a structural flaw recorded as a standing risk since day one:
 *
 *   Element scores read HIGHER than the whole, because a critic judging one barrel
 *   is not weighing composition, density, colour harmony or hierarchy. Optimising
 *   the easier metric is the standing risk of this entire working model.
 *
 * Nothing else in the toolchain checks that the parts add up. This does. It is
 * deliberately cheap enough to re-run after any element change — a one-off audit is
 * worth far less than a standing check.
 *
 * ── What it captures ─────────────────────────────────────────────────────────
 * The LIVE GAME, not `preview.html`. `preview.ts` reconstructs shipped framing from
 * `SHIPPED_SPAN`; the live match IS shipped framing, so there is nothing to get 18%
 * wrong (which is exactly how an earlier constant went wrong — `frameMode:'ground'`
 * frames `viewWidthUnits / sin(pitch)`, not `viewWidthUnits`). Verified against
 * `window.__fairView()`: at 16:9 the match camera shows halfWidth 289.4 wu and
 * near/far 199.2 wu, i.e. ~579 x 398 wu of ground centred on the PLAYER.
 *
 * Every station is PLAYER-CENTRED, never arena-centred. Centring on the pot once
 * filled the frame with the hazard and depressed several rounds of scores for
 * reasons that were purely framing.
 *
 * States covered: normal play, the closing-fog death zone (boundary / inside /
 * late), and both hazard puddles (approach and standing in).
 *
 * ── What it measures ─────────────────────────────────────────────────────────
 * Screenshots alone are a taste argument. Each station also gets objective numbers
 * so two runs are comparable without a critic:
 *
 *   playerRank    Where the player's own screen region ranks in a salience grid.
 *                 1 = the eye goes to the player. Anything else names what beat it.
 *                 This is the direct, measurable form of "visual hierarchy".
 *   topCells      The three loudest cells, with mean colour and grid position, so a
 *                 work-list can name the offender instead of gesturing at it.
 *   centreContrast  Player region mean luma vs the surrounding annulus. Low = the
 *                 hero and its ground share a value family and nothing separates.
 *   hueSpread     Saturation-weighted hue histogram (12 bins) + how much of the
 *                 frame sits in the single dominant bin. High = monochrome sludge.
 *   clipped       % of pixels with a channel pinned at 0 or 255. The colour grade
 *                 regression check — this was 9.39%/10.60% before `ToyGradeEffect`.
 *
 *   ── added 2026-08-05, and the reason is recorded in docs/LESSONS.md §7 ──
 *   colour        The CUMULATIVE colour budget of the whole frame: mean saturation,
 *                 absolute warm chroma, absolute cool chroma. NOT normalised shares.
 *   role          The same budget split ENVIRONMENT vs CAST, plus a hue-collision
 *                 number: does the environment spend the hero's own hue band?
 *   rails         Those totals checked against the measured reference figures, and
 *                 (with `--baseline`) against the previous run, so a colour pass
 *                 that overshoots FAILS instead of being found two passes later.
 *
 * ⚠️ CORRECTION, measured 2026-08-05. This file used to claim "metrics run on the
 * CANVAS ONLY (the DOM HUD would dominate every salience grid)". THAT IS NOT TRUE and
 * never was: `page.locator('canvas').screenshot()` captures the COMPOSITED page clipped
 * to the element's box, so every DOM element painted over the canvas is in the file.
 * Measured on `pot_south`: `.canvas.png` is pixel-identical to the full frame across the
 * whole HUD, the HUD covers **13.4%** of it, and it carries **~25% of the frame's warm
 * chroma**. So `playerRank`, `hueHist`, `clipped` and every recorded figure have always
 * included the HUD.
 *
 * That is deliberately NOT "fixed": changing the capture would invalidate every recorded
 * baseline, and the curated reference plates keep their own HUDs too (`INDEX.md`: "In-game
 * HUD is left in on gameplay crops — that's expected"), so whole-frame numbers stay
 * apples-to-apples. What IS fixed is that nothing calling itself "the environment" may be
 * measured that way: the role split runs on a second, genuinely HUD-free capture
 * (`<id>.nohud.png`), so `cast + env = arena` exactly and `all - arena` prices the HUD.
 *
 * The sheet handed to a critic is the FULL composited frame, HUD included, because
 * that is the artefact a player actually reads under pressure.
 *
 * ── THE CUMULATIVE COLOUR BUDGET — why, and exactly how it is measured ───────
 *
 * Two INDEPENDENTLY CORRECT desaturation passes together drove warm chroma from a
 * reference-matching 0.145 to 0.067 — under half — and mean saturation to 0.324
 * against the reference's 0.493 and against the 0.302 three critics called "muddy".
 * Each pass measured itself and each pass was right. NOBODY WAS WATCHING THE SUM.
 * That is `docs/STATE.md` item 8 and `docs/LESSONS.md` §7, and it is why this block
 * exists.
 *
 * METHODOLOGY — identical to `tools/tmp/chroma.mjs`, which is the code the recorded
 * 0.145 / 0.343 / 0.493 figures were produced with. Reproduced here byte-for-byte so
 * every number this tool prints is directly comparable to the ones already recorded:
 *
 *   • canvas PNG -> sharp resize 320x180 `fit:'fill'` -> removeAlpha -> raw RGB
 *   • per pixel, HSL saturation:  l = (max+min)/2/255
 *                                 s = l > 0.5 ? d/(510-max-min) : d/(max+min)
 *   • meanSat     = SUM(s) / n            <- every pixel, greys included
 *   • meanChroma  = SUM(max-min)/255 / n
 *   • warmChroma  = SUM(s where s >= 0.15 and hue <  60 deg) / n
 *   • coolChroma  = SUM(s where s >= 0.15 and hue >= 60 deg) / n
 *   • the s >= 0.15 gate is the "greys carry no hue opinion" gate, same as hueHist
 *   • a run's figure is the UNWEIGHTED MEAN over its frames, as the plates were
 *
 * These are ABSOLUTE quantities on purpose. `hueHist` is normalised (bin / total
 * chroma), so quieting a COOL surface RAISES the warm bin's share even though the
 * frame genuinely got quieter. That artifact bit round 1 of the saturation contract.
 * Absolute chroma cannot lie that way, and it is the only form in which two passes
 * can be added up.
 *
 * REFERENCE FIGURES, and how to re-derive them rather than trust this comment:
 *
 *   node tools/arena-scan.mjs --ref-plates reference/images/curated/gameplay
 *   ->  meanSat 0.493  chroma 0.325  warm 0.1449  cool 0.3431  warm/total 0.297
 *
 * (`reference/` is gitignored and must never be committed — this only ever READS a
 * path you pass it. See the security constraints in CLAUDE.md.)
 *
 * ── ROLE SPLIT: environment vs cast, and the hue-collision number ────────────
 *
 * A blind critic scored this arena 6/10 against a reference at 8.5 and named hue
 * placement as the top fix, warning explicitly: DO NOT DESATURATE — the winning
 * plates are highly saturated and that is part of why they read as shipped. The
 * lever is which hues the ENVIRONMENT is allowed to occupy. `docs/LESSONS.md` §8:
 * the reference reserves HUE, not saturation — a saturated cool ground with the warm
 * half of the wheel left for the cast.
 *
 * So "which hue band does the environment occupy, and does it collide with the
 * cast?" has to become a number. It does, via an exact CAST MATTE:
 *
 *   1. every scene object whose ancestry contains `character:<id>` (BaseCharacter's
 *      root, `src/characters/types.ts`) or `rig_root` (`src/characters/rig.ts`) is
 *      the CAST; everything else, background included, is the ENVIRONMENT
 *   2. hide the environment, null the scene background, disable shadows, and render
 *      the cast alone DIRECTLY (post chain bypassed) twice — once on a black clear
 *      colour, once on white
 *   3. a pixel the cast covers is IDENTICAL in both; a pixel it does not is 255
 *      apart. The matte is therefore independent of the characters' own colours,
 *      which a naive hide-and-diff is not — a dark character over dark ground
 *      would simply go missing, and that is precisely the figure/ground case this
 *      instrument exists to measure.
 *   4. the matte is box-downsampled to the same 320x180 grid the colour budget runs
 *      on and Y-flipped (gl.readPixels is bottom-up), so cast + env sum EXACTLY to
 *      the whole-frame budget. One methodology, three numbers that add up.
 *
 * Derived, per station and aggregated:
 *   castCoveragePct     % of frame the cast occupies. MEASURED at 0.43% with one
 *                       fighter in frame at shipped framing — a character is ~10.5%
 *                       of frame HEIGHT and narrow, so a plausible band is ~0.2-3%.
 *                       Outside that, suspect the matte before believing the hues,
 *                       and open `<id>.matte.png` to look at it.
 *   env.warmChroma      absolute warm chroma spent by the ENVIRONMENT alone
 *   env.warmShare       env warm / (env warm + env cool). Guard rail 0.297 — the
 *                       reference's whole-frame warm share INCLUDING its cast, so an
 *                       environment alone above it is provably out of contract.
 *   hueOverlap          SUM over 12 bins of min(castShare, envShare). 0 = disjoint
 *                       occupancy (the reference contract), 1 = the environment is
 *                       wearing exactly the cast's hues.
 *   envShareInCastBand  fraction of ENV chroma inside the cast's dominant bin +/-30
 *                       deg. This is the direct form of "the soup pot, the counter
 *                       front strips and a golden donut prop are wearing the hero's
 *                       own warm tan-orange".
 *   hueSeparationDeg    circular distance between the two chroma-weighted mean hues.
 *   topOther[].inCastBand  whether each loudest non-player cell sits in that band —
 *                       i.e. whether the thing beating the player is beating it
 *                       while wearing the player's colours.
 *
 * ── Repeatability ────────────────────────────────────────────────────────────
 * Default `--sim-speed 0.02` runs the match at 1/50th speed, so every capture lands
 * at sim elapsed ~0 with the same ambient phase, the same enemy position and the
 * same idle pose. Two runs a week apart are diffable. Pass `--sim-speed 1` for a
 * live look with moving AI, at the cost of repeatability. The cast matte and the
 * HUD-free capture both run AFTER `<id>.canvas.png`, and the matte is ONE synchronous
 * page.evaluate, so neither can perturb the pixels the whole-frame metrics run on.
 *
 * MEASURED NOISE FLOOR — "byte-comparable" is an overstatement, and it matters for
 * any gate. Running the tool twice against the SAME frozen snapshot:
 *   • `playerRank`, `dominantHueDeg`: identical everywhere
 *   • `playerSalience` +/-0.004, `deltaLuma` +/-0.002, `hueHist` bins +/-0.002,
 *     `clipped` +/-0.01pp — and ONLY at the fog stations plus `pantry_ne`
 *   • `pot_south` and the other normal-play stations ARE byte-identical
 *   • the cumulative chroma aggregate drifts <= 0.0001 run to run
 * `simSpeed` slows the SIM; the fog ring and ambient shaders animate on wall clock, so
 * a station with a live ring on screen never freezes completely. Every gate tolerance
 * below is ~100x that floor, which is why the gate does not cry wolf.
 *
 * KNOWN GAP: this cannot reliably put COMBAT VFX in frame. The AI has to cross the
 * map to engage, and `--sim-speed 6 --settle 7000` still only advanced 19s of match
 * time on SwiftShader — not enough. So the "do the floor decals out-contrast combat
 * VFX" question is NOT answered here; it needs a driven-input probe of the
 * `tools/tmp/burstshot.mjs` family. What this DOES answer is the same question
 * against the player character, measured below, which is the stricter test anyway.
 * The same gap applies to the role split: VFX is folded into ENVIRONMENT, and at
 * `--sim-speed 0.02` there is essentially none of it on screen.
 *
 * ── Usage ────────────────────────────────────────────────────────────────────
 *   node tools/arena-scan.mjs                          # full sweep, default out dir
 *   node tools/arena-scan.mjs --out shots/scan/r2      # pin the output dir
 *   node tools/arena-scan.mjs --only west_lane,pot_lane,fog_boundary
 *   node tools/arena-scan.mjs --url http://localhost:5187   # your own vite, not :5173
 *   node tools/arena-scan.mjs --list                   # print the station table
 *
 *   COLOUR BUDGET / REGRESSION GATE
 *   node tools/arena-scan.mjs --url $URL --baseline tools/scan/colour-baseline.json
 *                                                      # exit 1 on a colour regression
 *   node tools/arena-scan.mjs --url $URL --json tools/scan/colour-baseline.json
 *                                                      # RE-baseline (deliberate only —
 *                                                      # it is the record a later pass
 *                                                      # is judged against)
 *   node tools/arena-scan.mjs --url $URL --gate        # also exit 1 on an absolute
 *                                                      # rail FAIL, not just a drift
 *   node tools/arena-scan.mjs --ref-plates reference/images/curated/gameplay
 *                                                      # re-derive the reference figures
 *   node tools/arena-scan.mjs --selftest               # synthetic-input validation,
 *                                                      # no browser, no server
 *   node tools/arena-scan.mjs --no-role                # skip the cast matte
 *
 * Outputs, per station <id>:
 *   <out>/<id>.png          full frame, HUD included  <- this is what critics see
 *   <out>/<id>.canvas.png   canvas box — HUD INCLUDED <- what the whole-frame metrics run on
 *   <out>/<id>.nohud.png    canvas with the DOM HUD hidden <- what the ROLE split runs on
 *   <out>/<id>.marked.png   top-3 salience cells outlined, player region in green
 *   <out>/<id>.matte.png    the CAST MATTE painted magenta over the frame  <- LOOK AT IT
 *   <out>/metrics.json      every number, machine-readable (and a valid --baseline)
 *   <out>/sheet_*.png       contact sheets, 6 stations each
 *   <out>/SUMMARY.txt       the table you read first
 *
 * NEVER run this against the shared :5173 dev server for a full sweep — start your
 * own (`npx vite --port 5187 --strictPort`) and pass `--url`, or better, freeze a
 * snapshot and measure in the SAME shell invocation (it dies with its parent):
 *
 *   URL=$(node tools/snapshot.mjs --json | node -e "let s='';process.stdin.on('data',d=>s+=d).on('end',()=>console.log(JSON.parse(s).url))") \
 *     && node tools/arena-scan.mjs --url "$URL" --out shots/scan/x
 *
 * ── The critic half of the round ─────────────────────────────────────────────
 * The numbers say what changed; a blind critic says whether it is any good. After a
 * sweep, pick ONE representative frame and build THREE independent packets:
 *
 *   for i in 1 2 3; do
 *     node tools/review.mjs --ours shots/scan/<run>/pot_south.png \
 *       --category gameplay --out shots/review/scan-$i --n 2
 *   done
 *
 * Then spawn THREE FRESH critic subagents, one per packet, each told to judge the
 * frame as one artefact (composition / density / colour harmony / hierarchy / read
 * at a glance / do two elements fight) and forbidden from opening any `.key.json`.
 *
 * RECORD THE SCORE EACH CRITIC GIVES THE REFERENCE SIDE. One critic once scored the
 * shipped reference 4/10 while others gave the same plates 8-9/10. A round whose
 * reference control falls outside ~7-9 measured the critic, not the work, and must be
 * discarded. Three readings, not one — this instrument is noisy.
 *
 * ── Baseline, 2026-08-04, first ever whole-arena run (`shots/scan/run2`) ─────
 * Blind A/B, three fresh critics, `pot_south` vs the curated gameplay library:
 *
 *   ours       4 / 4.5 / 4        (mean 4.2, spread 0.5)
 *   reference  8+8 / 7.0+7.5 / 8  (all inside 7-9 -> all three rounds VALID)
 *
 * Metrics at that run: playerRank 4-88 of 144, median ~33 — the player was never in
 * the top three cells of any frame. |deltaLuma| <= 0.06 at 13 of 18 stations. Dominant
 * hue 0-30 deg holding 26-51% of frame chroma at 15 of 18. clipped 0.02-0.44 / 0.42-1.89%
 * (healthy; the colour grade is not regressing).
 *
 * All three critics independently named the SAME first fix: a saturation contract —
 * crush the static environment into one desaturated band and reserve chroma for
 * actors, threats and pickups. THAT INSTRUCTION WAS WRONG (docs/LESSONS.md §8): the
 * reference is not desaturated, and acting on it is what produced the overshoot the
 * colour budget below now watches for.
 *
 * ── Colour baseline, 2026-08-05, 18/18 stations (`tools/scan/colour-baseline.json`) ──
 *
 *   frame       meanSat 0.324   chroma 0.208   warm 0.064   cool 0.252   warm/total 0.214
 *   reference   meanSat 0.493   chroma 0.325   warm 0.145   cool 0.343   warm/total 0.297
 *   arena only  meanSat 0.320                  warm 0.058   cool 0.254   warm/total 0.197
 *
 *   FAIL  mean saturation 0.324 — below the lowest of eleven plates (0.370), and only
 *         0.022 above the 0.302 three critics read as "muddy".
 *   FAIL  warm chroma 0.064 — 44% of the reference. This reproduces the recorded 0.067
 *         to within run noise, so the STATE.md item-8 overshoot is confirmed, not
 *         inferred.
 *   PASS  cool chroma 0.252, warm SHARE 0.214. The frame is not warm-heavy; it is
 *         under-chromatic overall. There is nothing here to desaturate.
 *
 *   HUE COLLISION, and it names the top finding: the cast lives in bins 0-30/30-60
 *   (0.18 / 0.71 of its own chroma) and the ENVIRONMENT puts 0.05 / 0.14 in the SAME
 *   two bins — 19.1% of all environment chroma sits inside the hero's +/-30 deg band,
 *   and 37% of the loudest non-player cells across the sweep are wearing it. Worst
 *   offenders: grease_near 0.351, pot_diagonal 0.348, fryer_south 0.288, pantry_sw
 *   0.267, pantry_ne 0.260, pot_south 0.255. Cleanest: freezer_nw 0.035, edge_west
 *   0.057 — the two stations dominated by cool steel, which is the contract working.
 */

import { chromium } from 'playwright';
import sharp from 'sharp';
import { mkdir, writeFile, readFile } from 'node:fs/promises';
import { readdirSync } from 'node:fs';
import { tmpdir } from 'node:os';
import { resolve, join, dirname } from 'node:path';
import { execFileSync } from 'node:child_process';

// ─────────────────────────────────────────────────────────────────────────────
// Map facts. Mirrors `src/arena/shared.ts` + `src/arena/kitchen.ts`. Kept here as
// plain numbers on purpose: this tool must keep working when `src/` is mid-edit by
// five other agents, so it imports nothing from the app.
// ─────────────────────────────────────────────────────────────────────────────
const ARENA_W = 1400, ARENA_H = 1000;
const CENTRE = { x: 700, y: 500 };
const MAX_SAFE_RADIUS = 850;      // fogRadius=850 => ring parked off the map corners
const GREASE = { x: 560, y: 900 };
const WATER = { x: 840, y: 100 };

/**
 * Every `CoverBox` in `kitchen.ts`, as {x, y, w, h} centre + full extent.
 *
 * Here for ONE reason: `?px=/?py=` write straight into `MatchState` with no collision
 * resolution, so a station placed on a prop puts the player INSIDE it. At the shipped
 * 58 deg pitch a freezer or a barrel then swallows the character completely — the
 * first draft of this file lost four of eighteen stations that way and the frames
 * looked like a rendering bug. `validate()` below turns that into a startup error.
 */
const COVER = [
  [525, 350, 170, 90], [875, 350, 170, 90], [525, 650, 170, 90], [875, 650, 170, 90], // stove islands
  [700, 258, 55, 55], [700, 742, 55, 55],                                             // lane pots
  [525, 500, 50, 50], [875, 500, 50, 50],                                             // spice carts
  [230, 190, 230, 190], [1170, 810, 230, 190],                                        // freezers
  [1120, 150, 90, 90], [280, 850, 90, 90],                                            // herb crates
  [1230, 140, 80, 80], [170, 860, 80, 80],                                            // tall crates
  [1175, 235, 110, 70], [225, 765, 110, 70],                                          // flour sacks
  [340, 420, 160, 55], [340, 580, 160, 55], [1060, 580, 160, 55], [1060, 420, 160, 55], // prep counters
  [250, 500, 60, 50], [460, 500, 48, 46], [1150, 500, 60, 50], [940, 500, 48, 46],    // supply barrels
  [700, 830, 150, 70], [700, 170, 150, 70],                                           // fryer / sink
];
/** Clearance a station must keep from every cover box, in world units. */
const CLEARANCE = 18;

function validate(stations) {
  const bad = [];
  for (const s of stations) {
    for (const [cx, cy, w, h] of COVER) {
      if (Math.abs(s.x - cx) < w / 2 + CLEARANCE && Math.abs(s.y - cy) < h / 2 + CLEARANCE) {
        bad.push(`${s.id} (${s.x},${s.y}) sits inside cover box centred (${cx},${cy}) ${w}x${h}`);
      }
    }
    if (s.x < 20 || s.x > ARENA_W - 20 || s.y < 20 || s.y > ARENA_H - 20) {
      bad.push(`${s.id} (${s.x},${s.y}) is outside the playfield`);
    }
  }
  return bad;
}

/**
 * The stations.
 *
 * `x`/`y` are where the PLAYER stands; the camera centres its ground window there.
 * At 16:9 each station shows ~579 x 398 wu, so the 1400x1000 playfield needs ~6
 * views to be covered once and these 17 oversample the lanes and hazards, which is
 * where a player actually spends the match.
 *
 * Hazard stations deliberately stand OFF the hazard, not on it, so the hazard sits
 * about a fifth of the frame off-centre instead of filling it.
 */
const STATIONS = [
  // ── normal play, the west half (player spawn side) ──────────────────────────
  { id: 'spawn_west',    x: 160,  y: 500, fog: MAX_SAFE_RADIUS, note: 'player spawn, looking down the west lane' },
  { id: 'west_lane',     x: 340,  y: 500, fog: MAX_SAFE_RADIUS, note: 'primary combat lane: barrels, prep counters, spill decals' },
  { id: 'west_choke',    x: 400,  y: 500, fog: MAX_SAFE_RADIUS, note: 'the mid-lane chokepoint between the two supply barrels' },
  // ── the hub. Never centred on the pot. ─────────────────────────────────────
  { id: 'pot_south',     x: 700,  y: 640, fog: MAX_SAFE_RADIUS, note: 'pot 140wu north of the player — hazard in frame, not filling it' },
  { id: 'pot_diagonal',  x: 570,  y: 430, fog: MAX_SAFE_RADIUS, note: 'hub diagonal: pot + stove island + spice cart + lane pots together' },
  { id: 'hub_north',     x: 700,  y: 320, fog: MAX_SAFE_RADIUS, note: 'north lane mouth, stacked pots, sink counter beyond' },
  // ── corners: the four landmark clusters ────────────────────────────────────
  { id: 'freezer_nw',    x: 430,  y: 240, fog: MAX_SAFE_RADIUS, note: 'NW walk-in freezer + exhaust pipe, seen from the lane' },
  { id: 'pantry_ne',     x: 1150, y: 330, fog: MAX_SAFE_RADIUS, note: 'NE pantry cluster: crates, herb crate, flour sacks, on its plank pad' },
  { id: 'pantry_sw',     x: 270,  y: 665, fog: MAX_SAFE_RADIUS, note: 'SW pantry cluster + a real prep counter in the same frame' },
  { id: 'freezer_se',    x: 1000, y: 700, fog: MAX_SAFE_RADIUS, note: 'SE walk-in freezer (mirror)' },
  // ── service counters + decoration density ──────────────────────────────────
  { id: 'fryer_south',   x: 560,  y: 790, fog: MAX_SAFE_RADIUS, note: 'fryer counter, chalkboard, stacked pots, south apron edge' },
  // ── map edge: does the apron hold the frame? ───────────────────────────────
  { id: 'edge_west',     x: 70,   y: 500, fog: MAX_SAFE_RADIUS, note: 'hard west edge — apron/kerb occupies a third of the frame' },
  // ── hazard puddles, approach framing ───────────────────────────────────────
  { id: 'grease_near',   x: GREASE.x - 130, y: GREASE.y - 95, fog: MAX_SAFE_RADIUS, note: 'grease puddle off-centre, as you approach it' },
  { id: 'grease_in',     x: GREASE.x, y: GREASE.y, fog: MAX_SAFE_RADIUS, note: 'STANDING IN the grease puddle — the slowed player read' },
  { id: 'water_near',    x: WATER.x + 130, y: WATER.y + 95, fog: MAX_SAFE_RADIUS, note: 'water puddle off-centre, as you approach it' },
  // ── the closing fog death zone ─────────────────────────────────────────────
  { id: 'fog_boundary',  x: 1090, y: 500, fog: 420, note: 'safe-zone wall ~30wu ahead of the player' },
  { id: 'fog_inside',    x: 1240, y: 500, fog: 420, note: 'standing INSIDE the death zone, 50 HP/s' },
  { id: 'fog_late',      x: 700,  y: 340, fog: 200, note: 'late match, ring closed to 200wu around the pot' },
];

// ─────────────────────────────────────────────────────────────────────────────
// THE COLOUR BUDGET CONTRACT
//
// Every figure below was MEASURED, not chosen, except where it says otherwise.
// Re-derive the reference row at any time with:
//   node tools/arena-scan.mjs --ref-plates reference/images/curated/gameplay
// ─────────────────────────────────────────────────────────────────────────────
const REF = {
  source: 'reference/images/curated/gameplay — 11 curated Brawl Stars / Zooba plates',
  method: 'tools/tmp/chroma.mjs, reproduced exactly by colourBudget() below',
  meanSat: 0.493,      // and NOT ONE PLATE is below 0.370
  meanSatMin: 0.370,   // lowest single plate (bs_04)
  meanSatMax: 0.694,   // highest single plate (bs_03)
  chroma: 0.325,
  warmChroma: 0.145,   // hue < 60 deg, saturation-weighted, per frame pixel
  coolChroma: 0.343,   // hue >= 60 deg
  warmShare: 0.297,    // warm / (warm + cool) — INCLUDING the reference's own cast
  muddy: 0.302,        // the mean saturation three critics called "muddy / drained"
};

/**
 * Rails. `band` is the pass window; outside it prints FAIL.
 *
 * MEASURED bands: meanSat uses the reference plates' own envelope [0.370, 0.694].
 * CHOSEN bands: warm/cool chroma use [0.5x, 1.5x] of the reference mean. The 0.5x
 * floor is not arbitrary — 0.067 against 0.145 is the "under half" that `STATE.md`
 * item 8 records as the alarm. The 1.5x ceiling exists so a future "put the warm
 * back" pass cannot overshoot in the other direction without the gate saying so.
 * The per-plate spread of warm chroma is 0.017-0.603, so a plate ENVELOPE would be
 * useless as a band here and is deliberately not used. Said out loud because a
 * chosen threshold presented as a measured one is how instruments start lying.
 */
const RAILS = [
  { key: 'meanSat', label: 'mean saturation', target: REF.meanSat, band: [REF.meanSatMin, REF.meanSatMax],
    hardFloor: REF.muddy, tol: 0.020, kind: 'measured',
    note: 'below 0.302 is the reading three critics called muddy; every plate is >= 0.370' },
  { key: 'warmChroma', label: 'warm chroma 0-60', target: REF.warmChroma, band: [REF.warmChroma * 0.5, REF.warmChroma * 1.5],
    tol: 0.010, kind: 'chosen band', note: 'absolute, not a share. 0.067 = the recorded overshoot' },
  { key: 'coolChroma', label: 'cool chroma 60-360', target: REF.coolChroma, band: [REF.coolChroma * 0.5, REF.coolChroma * 1.5],
    tol: 0.020, kind: 'chosen band', note: 'adding cool is the cheap lever — LESSONS §8' },
  { key: 'meanChroma', label: 'mean chroma', target: REF.chroma, band: [REF.chroma * 0.5, REF.chroma * 1.5],
    tol: 0.020, kind: 'chosen band', note: 'max-min per pixel; the raw colourfulness of the frame' },
  { key: 'warmShare', label: 'warm share of chroma', target: REF.warmShare, band: [0.12, 0.45],
    tol: 0.030, kind: 'chosen band', note: 'the reference reserves the warm half for the cast' },
  { key: 'envWarmShare', label: 'ENV warm share', target: REF.warmShare, band: [0.0, REF.warmShare],
    tol: 0.030, kind: 'derived', role: true,
    note: 'ceiling is the reference whole-frame warm share INCLUDING its cast, so an environment alone above it is out of contract' },
  { key: 'hueOverlap', label: 'cast/env hue overlap', target: 0, band: [0, 0.45],
    tol: 0.050, kind: 'no reference figure — baseline-relative', role: true,
    note: 'SUM min(castShare,envShare) over 12 bins. 0 = disjoint hue occupancy' },
  { key: 'envShareInCastBand', label: 'ENV chroma in cast band', target: 0, band: [0, 0.40],
    tol: 0.050, kind: 'no reference figure — baseline-relative', role: true,
    note: 'fraction of environment chroma inside the cast dominant bin +/-30 deg' },

  // ── advisory: the same quantities with the DOM HUD taken out ───────────────
  // These are what an ARENA colour pass actually moves. They have no exact reference
  // equivalent (the plates keep their own HUDs), so they never FAIL on an absolute
  // band — but drifting further from the reference on them IS a regression, and that
  // is the failure mode this whole block exists to catch.
  { key: 'arenaMeanSat', label: '(arena only) mean sat', target: REF.meanSat, band: [REF.meanSatMin, REF.meanSatMax],
    tol: 0.020, kind: 'HUD-free, advisory', role: true, advisory: true,
    note: 'the HUD is 13.4% of frame; this is the arena on its own' },
  { key: 'arenaWarmChroma', label: '(arena only) warm chroma', target: REF.warmChroma, band: [REF.warmChroma * 0.5, REF.warmChroma * 1.5],
    tol: 0.010, kind: 'HUD-free, advisory', role: true, advisory: true,
    note: '~25% of whole-frame warm chroma is HUD furniture, not arena' },
  { key: 'arenaCoolChroma', label: '(arena only) cool chroma', target: REF.coolChroma, band: [REF.coolChroma * 0.5, REF.coolChroma * 1.5],
    tol: 0.020, kind: 'HUD-free, advisory', role: true, advisory: true, note: '' },
];

// ─────────────────────────────────────────────────────────────────────────────
function parseArgs(argv) {
  const out = {};
  for (let i = 2; i < argv.length; i++) {
    const a = argv[i];
    if (!a.startsWith('--')) continue;
    const key = a.slice(2);
    const next = argv[i + 1];
    if (next === undefined || next.startsWith('--')) out[key] = true;
    else { out[key] = next; i++; }
  }
  return out;
}

const args = parseArgs(process.argv);

if (args.list) {
  console.log('id                x     y     fogRadius  note');
  for (const s of STATIONS) {
    console.log(`${s.id.padEnd(16)} ${String(s.x).padEnd(5)} ${String(s.y).padEnd(5)} ${String(s.fog).padEnd(10)} ${s.note}`);
  }
  process.exit(0);
}

const BASE = args.url ?? process.env.SCAN_BASE ?? 'http://localhost:5187';
const W = Number(args.w ?? 1600);
const H = Number(args.h ?? 900);
const PLAYER = args.player ?? 'hamburger';
const ENEMY = args.enemy ?? 'donut';
const SIM_SPEED = args['sim-speed'] ?? '0.02';
const SETTLE_MS = Number(args.settle ?? 900);
const OUT = resolve(args.out ?? `shots/scan/${new Date().toISOString().replace(/[:.]/g, '-').slice(0, 19)}`);
const JSON_OUT = typeof args.json === 'string' ? args.json : null;
const BASELINE = typeof args.baseline === 'string' ? args.baseline : null;
const WANT_ROLE = !args['no-role'];
const GATE = !!args.gate;

// ─────────────────────────────────────────────────────────────────────────────
// Metrics
// ─────────────────────────────────────────────────────────────────────────────
const GRID_COLS = 16, GRID_ROWS = 9;
const SMALL_W = 320, SMALL_H = 180;   // grid cell = 20x20 px
const HUE_BINS = 12;                  // 30 deg each
const GREY_GATE = 0.15;               // saturation below this carries no hue opinion

function rgbToHsl(r, g, b) {
  r /= 255; g /= 255; b /= 255;
  const mx = Math.max(r, g, b), mn = Math.min(r, g, b);
  const l = (mx + mn) / 2;
  if (mx === mn) return { h: 0, s: 0, l };
  const d = mx - mn;
  const s = l > 0.5 ? d / (2 - mx - mn) : d / (mx + mn);
  let h;
  if (mx === r) h = ((g - b) / d + (g < b ? 6 : 0));
  else if (mx === g) h = (b - r) / d + 2;
  else h = (r - g) / d + 4;
  return { h: (h * 60), s, l };
}

/**
 * THE CUMULATIVE COLOUR BUDGET.
 *
 * `data` is raw RGB (3 bytes/px) for `n` pixels; `mask` is an optional Uint8Array of
 * length n where 1 = CAST. Every "budget" quantity (warmChroma, coolChroma, binChroma,
 * meanChroma) is divided by the WHOLE-FRAME pixel count, so `cast` + `env` sum exactly
 * to `all`. Every "intensity" quantity is suffixed `Within` and divided by the role's
 * own pixel count instead — a cast covering 4% of frame does not have a mean saturation
 * of 0.04.
 *
 * Formulas are lifted verbatim from `tools/tmp/chroma.mjs`, which is the code that
 * produced the recorded 0.145 / 0.343 / 0.493 reference figures. Do not "tidy" them.
 */
function colourBudget(data, n, mask = null) {
  const make = () => ({ px: 0, sat: 0, chroma: 0, luma: 0, warm: 0, cool: 0, bins: new Float64Array(HUE_BINS), cx: 0, cy: 0 });
  const all = make(), cast = make(), env = make();

  for (let i = 0; i < n; i++) {
    const r = data[i * 3], g = data[i * 3 + 1], b = data[i * 3 + 2];
    const mx = Math.max(r, g, b), mn = Math.min(r, g, b), d = mx - mn;
    const l = (mx + mn) / 2 / 255;
    const s = d === 0 ? 0 : (l > 0.5 ? d / (510 - mx - mn) : d / (mx + mn));
    const isCast = mask ? mask[i] === 1 : false;
    const role = isCast ? cast : env;

    for (const acc of [all, role]) {
      acc.px++; acc.sat += s; acc.chroma += d / 255;
      acc.luma += (0.2126 * r + 0.7152 * g + 0.0722 * b) / 255;
    }
    if (s < GREY_GATE) continue;
    let h = mx === r ? ((g - b) / d + (g < b ? 6 : 0)) : mx === g ? (b - r) / d + 2 : (r - g) / d + 4;
    h = ((h * 60) % 360 + 360) % 360;
    const bin = Math.floor(h / 30) % HUE_BINS;
    const rad = (h * Math.PI) / 180;
    for (const acc of [all, role]) {
      if (h < 60) acc.warm += s; else acc.cool += s;
      acc.bins[bin] += s;
      acc.cx += s * Math.cos(rad); acc.cy += s * Math.sin(rad);
    }
  }

  const pack = (acc) => {
    const binChroma = Array.from(acc.bins, (v) => v / n);          // budget units, / WHOLE frame
    const total = acc.warm + acc.cool;
    const binShare = Array.from(acc.bins, (v) => (total ? v / total : 0)); // occupancy, / own chroma
    const hueDeg = total > 0 ? (((Math.atan2(acc.cy, acc.cx) * 180) / Math.PI) % 360 + 360) % 360 : null;
    const dom = binShare.indexOf(Math.max(...binShare));
    return {
      px: acc.px,
      pctOfFrame: +((acc.px / n) * 100).toFixed(3),
      meanSat: +(acc.sat / n).toFixed(4),          // budget form: share of the frame
      meanSatWithin: +(acc.px ? acc.sat / acc.px : 0).toFixed(4),
      meanChroma: +(acc.chroma / n).toFixed(4),
      meanChromaWithin: +(acc.px ? acc.chroma / acc.px : 0).toFixed(4),
      meanLumaWithin: +(acc.px ? acc.luma / acc.px : 0).toFixed(4),
      warmChroma: +(acc.warm / n).toFixed(4),
      coolChroma: +(acc.cool / n).toFixed(4),
      totalChroma: +(total / n).toFixed(4),
      warmShare: +(total ? acc.warm / total : 0).toFixed(4),
      binChroma: binChroma.map((v) => +v.toFixed(5)),
      binShare: binShare.map((v) => +v.toFixed(4)),
      dominantBin: total ? dom : null,
      dominantHueDeg: total ? dom * 30 : null,
      hueDeg: hueDeg == null ? null : +hueDeg.toFixed(1),
    };
  };

  const out = { all: pack(all) };
  if (!mask) return out;

  out.cast = pack(cast);
  out.env = pack(env);

  // ── the hue-collision numbers ──────────────────────────────────────────────
  // The cast's BAND is its dominant 30-deg bin plus its two neighbours (+/-30 deg),
  // which is the width at which a hue actually reads as "the same colour family" at
  // shipped framing. Everything below is computed against that band.
  const cs = out.cast.binShare, es = out.env.binShare;
  const overlap = cs.reduce((s2, v, i) => s2 + Math.min(v, es[i]), 0);
  const d0 = out.cast.dominantBin;
  const band = d0 == null ? [] : [(d0 + HUE_BINS - 1) % HUE_BINS, d0, (d0 + 1) % HUE_BINS];
  const envShareInCastBand = band.reduce((s2, b) => s2 + es[b], 0);
  const envChromaInCastBand = band.reduce((s2, b) => s2 + out.env.binChroma[b], 0);
  let sep = null;
  if (out.cast.hueDeg != null && out.env.hueDeg != null) {
    const raw = Math.abs(out.cast.hueDeg - out.env.hueDeg) % 360;
    sep = raw > 180 ? 360 - raw : raw;
  }
  out.collision = {
    castBandDeg: band.length ? band.map((b) => b * 30) : null,
    hueOverlap: +overlap.toFixed(4),
    envShareInCastBand: +envShareInCastBand.toFixed(4),
    envChromaInCastBand: +envChromaInCastBand.toFixed(5),
    hueSeparationDeg: sep == null ? null : +sep.toFixed(1),
    castHueDeg: out.cast.hueDeg,
    envHueDeg: out.env.hueDeg,
  };
  out.castBandBins = band;
  return out;
}

/**
 * Salience grid.
 *
 * Deliberately crude and deliberately fixed: this is not a model of human
 * attention, it is a REPEATABLE proxy that answers one question — is the player the
 * loudest thing on screen, and if not, what is? Weighting is local contrast first
 * (edges catch the eye hardest at speed), then saturation, then deviation from the
 * frame's own median value.
 */
async function grabRaw(png) {
  const { data } = await sharp(png)
    .resize(SMALL_W, SMALL_H, { fit: 'fill' })
    .removeAlpha().raw().toBuffer({ resolveWithObject: true });
  return data;
}

/**
 * `canvasPng` is the frame everything recorded was measured on — HUD INCLUDED, see the
 * `.canvas.png` note in the header. `nohudPng` is the same frame with the DOM HUD
 * hidden, and it is the ONLY honest source for an "environment" colour number.
 */
async function analyse(canvasPng, nohudPng = null, castMask = null) {
  const roleBudget = nohudPng ? colourBudget(await grabRaw(nohudPng), SMALL_W * SMALL_H, castMask) : null;
  return analyseRaw(await grabRaw(canvasPng), roleBudget);
}

function analyseRaw(data, roleBudget = null) {
  const n = SMALL_W * SMALL_H;
  const luma = new Float32Array(n);
  const sat = new Float32Array(n);
  const hue = new Float32Array(n);
  let clipped0 = 0, clipped255 = 0;

  for (let i = 0; i < n; i++) {
    const r = data[i * 3], g = data[i * 3 + 1], b = data[i * 3 + 2];
    if (r === 0 || g === 0 || b === 0) clipped0++;
    if (r === 255 || g === 255 || b === 255) clipped255++;
    luma[i] = (0.2126 * r + 0.7152 * g + 0.0722 * b) / 255;
    const { h, s } = rgbToHsl(r, g, b);
    sat[i] = s; hue[i] = h;
  }

  const sorted = Float32Array.from(luma).sort();
  const medianLuma = sorted[Math.floor(n / 2)];

  const cellW = SMALL_W / GRID_COLS, cellH = SMALL_H / GRID_ROWS;
  const cells = [];
  for (let cy = 0; cy < GRID_ROWS; cy++) {
    for (let cx = 0; cx < GRID_COLS; cx++) {
      let sum = 0, sum2 = 0, satSum = 0, cnt = 0, rs = 0, gs = 0, bs = 0;
      const x0 = Math.round(cx * cellW), x1 = Math.round((cx + 1) * cellW);
      const y0 = Math.round(cy * cellH), y1 = Math.round((cy + 1) * cellH);
      for (let y = y0; y < y1; y++) for (let x = x0; x < x1; x++) {
        const i = y * SMALL_W + x;
        sum += luma[i]; sum2 += luma[i] * luma[i]; satSum += sat[i]; cnt++;
        rs += data[i * 3]; gs += data[i * 3 + 1]; bs += data[i * 3 + 2];
      }
      const mean = sum / cnt;
      const sd = Math.sqrt(Math.max(0, sum2 / cnt - mean * mean));
      const meanSat = satSum / cnt;
      const salience = 0.5 * Math.min(1, sd / 0.25) + 0.3 * meanSat + 0.2 * Math.min(1, Math.abs(mean - medianLuma) / 0.35);
      cells.push({
        cx, cy, mean: +mean.toFixed(3), sd: +sd.toFixed(3), sat: +meanSat.toFixed(3),
        salience: +salience.toFixed(4),
        rgb: [Math.round(rs / cnt), Math.round(gs / cnt), Math.round(bs / cnt)],
      });
    }
  }

  // The player. `camera.ts` aims PAST the player by `lookAhead` so the GROUND window
  // is centred on him; the character himself therefore sits a little below frame
  // centre. Measured off a 1600x900 live frame: body spans y ~430-580, i.e. rows 4-5
  // of 9, centre column. So the player region is the 3x2 block cols 7-9, rows 4-5.
  const inPlayer = (c) => c.cx >= 7 && c.cx <= 9 && c.cy >= 4 && c.cy <= 5;
  const playerCells = cells.filter(inPlayer);
  const playerSalience = Math.max(...playerCells.map((c) => c.salience));

  const ranked = [...cells].sort((a, b) => b.salience - a.salience);
  const playerRank = ranked.findIndex((c) => inPlayer(c) && c.salience === playerSalience) + 1;
  // Loudest cells that are NOT the player — the things stealing the read.
  const topOther = ranked.filter((c) => !inPlayer(c)).slice(0, 3);

  // Player region vs the annulus around it: does the hero separate from his ground?
  const ring = cells.filter((c) => !inPlayer(c) && c.cx >= 5 && c.cx <= 11 && c.cy >= 2 && c.cy <= 7);
  const pMean = playerCells.reduce((s, c) => s + c.mean, 0) / playerCells.length;
  const rMean = ring.reduce((s, c) => s + c.mean, 0) / ring.length;
  const pSat = playerCells.reduce((s, c) => s + c.sat, 0) / playerCells.length;
  const rSat = ring.reduce((s, c) => s + c.sat, 0) / ring.length;

  // Saturation-weighted hue histogram: 12 bins of 30 deg. NORMALISED — kept exactly
  // as it was, because two rounds of recorded numbers are in these units. Read the
  // ABSOLUTE `colour` block below for anything cumulative.
  const bins = new Array(12).fill(0);
  let wsum = 0;
  for (let i = 0; i < n; i++) {
    if (sat[i] < GREY_GATE) continue;              // greys carry no hue opinion
    const b = Math.floor(((hue[i] % 360) + 360) % 360 / 30) % 12;
    bins[b] += sat[i]; wsum += sat[i];
  }
  const hueHist = bins.map((v) => +(wsum ? v / wsum : 0).toFixed(3));
  const dominantBin = hueHist.indexOf(Math.max(...hueHist));

  // ── the cumulative colour budget, and its role split ───────────────────────
  // `all` is measured on the SAME pixels every recorded figure was measured on, HUD
  // included — which is also what the reference plates contain (`INDEX.md`: "In-game
  // HUD is left in on gameplay crops"). So `all` stays comparable to 0.145 / 0.493.
  // `arena` / `env` / `cast` come from the HUD-free capture, because 13.4% of this
  // frame is HUD and about a quarter of its warm chroma is HUD furniture, not arena.
  const colour = colourBudget(data, n, null);
  if (roleBudget) {
    colour.arena = roleBudget.all;
    colour.cast = roleBudget.cast;
    colour.env = roleBudget.env;
    colour.collision = roleBudget.collision;
    colour.castBandBins = roleBudget.castBandBins;
    // A DIFFERENCE, not a region: HUD pixels occlude arena pixels, so this is "what
    // the HUD adds to the frame's budget", which is exactly the question worth asking.
    colour.hudDelta = {
      meanSat: +(colour.all.meanSat - roleBudget.all.meanSat).toFixed(4),
      meanChroma: +(colour.all.meanChroma - roleBudget.all.meanChroma).toFixed(4),
      warmChroma: +(colour.all.warmChroma - roleBudget.all.warmChroma).toFixed(4),
      coolChroma: +(colour.all.coolChroma - roleBudget.all.coolChroma).toFixed(4),
    };
  }

  // Name the loudest non-player cells' hue, and whether they are wearing the CAST's
  // colours. This is the actionable half of the top finding: the eye lands on the pot
  // instead of the player, and the pot is wearing the player's own hue family.
  const castBand = colour.castBandBins ?? null;
  const topOtherOut = topOther.map((c) => {
    const { h, s } = rgbToHsl(c.rgb[0], c.rgb[1], c.rgb[2]);
    const bin = Math.floor(((h % 360) + 360) % 360 / 30) % 12;
    return {
      cell: `${c.cx},${c.cy}`, salience: c.salience, rgb: c.rgb, sat: c.sat, sd: c.sd,
      hueDeg: +h.toFixed(1), hueBin: bin,
      inCastBand: castBand ? castBand.includes(bin) && s >= GREY_GATE : null,
    };
  });

  return {
    playerRank,
    playerSalience: +playerSalience.toFixed(4),
    topOther: topOtherOut,
    centreContrast: { playerLuma: +pMean.toFixed(3), ringLuma: +rMean.toFixed(3), deltaLuma: +(pMean - rMean).toFixed(3), playerSat: +pSat.toFixed(3), ringSat: +rSat.toFixed(3) },
    medianLuma: +medianLuma.toFixed(3),
    hueHist,
    dominantHueDeg: dominantBin * 30,
    dominantHueShare: hueHist[dominantBin],
    clippedLowPct: +((clipped0 / n) * 100).toFixed(2),
    clippedHighPct: +((clipped255 / n) * 100).toFixed(2),
    colour,
    _cells: cells,
  };
}

/**
 * Paint the cast matte back over the frame it was measured on.
 *
 * Non-negotiable #3: judge rendered pixels. A role split is exactly the kind of
 * measurement that can be plausible and wrong — an off-by-one Y flip would report a
 * patch of floor as "the cast" and every hue number downstream would be confident
 * nonsense. This makes the mask something a human can LOOK at in one glance.
 */
async function matteOverlay(canvasPng, outPng, mask) {
  const rgba = Buffer.alloc(SMALL_W * SMALL_H * 4);
  for (let i = 0; i < SMALL_W * SMALL_H; i++) {
    if (!mask[i]) continue;
    rgba[i * 4] = 255; rgba[i * 4 + 1] = 0; rgba[i * 4 + 2] = 220; rgba[i * 4 + 3] = 150;
  }
  const layer = await sharp(rgba, { raw: { width: SMALL_W, height: SMALL_H, channels: 4 } })
    .resize(W, H, { fit: 'fill', kernel: 'nearest' }).png().toBuffer();
  await sharp(canvasPng).resize(W, H, { fit: 'fill' }).composite([{ input: layer, top: 0, left: 0 }]).png().toFile(outPng);
}

/** Outline the three loudest non-player cells in red and the player block in green. */
async function annotate(srcPng, outPng, m) {
  const cw = W / GRID_COLS, ch = H / GRID_ROWS;
  const rects = m.topOther.map((c, i) => {
    const [cx, cy] = c.cell.split(',').map(Number);
    const flag = c.inCastBand ? ' ⟡cast hue' : '';
    return `<rect x="${cx * cw}" y="${cy * ch}" width="${cw}" height="${ch}" fill="none" stroke="#ff2d55" stroke-width="4"/>
            <text x="${cx * cw + 8}" y="${cy * ch + 28}" font-family="Helvetica" font-size="22" font-weight="700" fill="#ff2d55">#${i + 1}${flag}</text>`;
  }).join('');
  const player = `<rect x="${7 * cw}" y="${4 * ch}" width="${3 * cw}" height="${2 * ch}" fill="none" stroke="#31ff8f" stroke-width="4" stroke-dasharray="10 6"/>
                  <text x="${7 * cw + 8}" y="${4 * ch + 28}" font-family="Helvetica" font-size="22" font-weight="700" fill="#31ff8f">player rank ${m.playerRank}</text>`;
  const svg = Buffer.from(`<svg width="${W}" height="${H}" xmlns="http://www.w3.org/2000/svg">${rects}${player}</svg>`);
  await sharp(srcPng).composite([{ input: svg, top: 0, left: 0 }]).png().toFile(outPng);
}

// ─────────────────────────────────────────────────────────────────────────────
// THE CAST MATTE — an exact environment/cast separation, in one page.evaluate.
//
// Runs AFTER both screenshots so it cannot perturb the captured pixels, and entirely
// SYNCHRONOUSLY so no rAF frame of the app's own loop can interleave with it.
//
// The matte is a two-clear-colour difference, not a hide-and-diff. Hide-and-diff
// fails in exactly the case this instrument exists to measure: a character whose
// colour matches its ground contributes ~0 difference and silently goes missing,
// so the tool would report best-case separation precisely when separation is worst.
// A pixel the cast covers is IDENTICAL under a black and a white clear; a pixel it
// does not is 255 apart. Character colour is irrelevant.
// ─────────────────────────────────────────────────────────────────────────────
const CAST_MATTE = ([MW, MH]) => {
  const stage = window.__stage;
  if (!stage || stage.disposed) return { error: 'no live Stage on this page' };
  const r = stage.renderer, scene = stage.scene, cam = stage.rig && stage.rig.camera;
  if (!r || !scene || !cam) return { error: 'Stage is missing renderer/scene/rig.camera' };
  const gl = r.getContext();
  const Wp = r.domElement.width, Hp = r.domElement.height;
  if (!Wp || !Hp) return { error: 'drawing buffer has zero size' };

  // CAST = anything under BaseCharacter's root (`character:<id>`, src/characters/types.ts)
  // or under ChibiRig's `rig_root` (src/characters/rig.ts). Two independent markers on
  // purpose; if BOTH ever disappear this must fail loudly rather than report env=100%.
  const isCastNode = (o) => o.name === 'rig_root' || /^character:/.test(o.name || '');
  const castRoots = [];
  for (const kid of scene.children) {
    let hit = false;
    kid.traverse((o) => { if (isCastNode(o)) hit = true; });
    if (hit) castRoots.push(kid);
  }
  if (castRoots.length === 0) {
    return { error: 'no `character:*` or `rig_root` node in the scene — the cast cannot be separated' };
  }

  const shot = () => { const p = new Uint8Array(Wp * Hp * 4); gl.readPixels(0, 0, Wp, Hp, gl.RGBA, gl.UNSIGNED_BYTE, p); return p; };

  // save
  const savedBg = scene.background;
  const savedShadow = r.shadowMap.enabled;
  const savedAutoClear = r.autoClear;
  const savedAlpha = r.getClearAlpha();
  let savedClearHex = null;
  try {
    let probe = null;
    scene.traverse((o) => { if (!probe && o.material && o.material.color) probe = o.material.color; });
    if (probe) { const c = probe.clone(); r.getClearColor(c); savedClearHex = c.getHex(); }
  } catch (e) { /* fall back to three's default below */ }

  const hidden = [];
  for (const kid of scene.children) {
    if (castRoots.includes(kid)) continue;
    if (kid.visible) { hidden.push(kid); kid.visible = false; }
  }

  let A, B;
  try {
    scene.background = null;
    r.shadowMap.enabled = false;
    r.autoClear = true;
    r.setRenderTarget(null);
    // Direct render, post chain BYPASSED: bloom would spill a halo into the matte and
    // SMAA would feather its edge, and neither belongs in a geometric coverage mask.
    r.setClearColor(0x000000, 1); r.clear(true, true, true); r.render(scene, cam); A = shot();
    r.setClearColor(0xffffff, 1); r.clear(true, true, true); r.render(scene, cam); B = shot();
  } finally {
    for (const k of hidden) k.visible = true;
    scene.background = savedBg;
    r.shadowMap.enabled = savedShadow;
    r.autoClear = savedAutoClear;
    if (savedClearHex != null) r.setClearColor(savedClearHex, savedAlpha);
    else r.setClearColor(0x000000, savedAlpha);
    try { stage.render(0); } catch (e) { /* restoring the visible frame is best-effort */ }
  }

  // Box-downsample to the metric grid, flipping Y (gl.readPixels is bottom-up).
  const acc = new Float64Array(MW * MH), cnt = new Float64Array(MW * MH);
  let castPx = 0;
  for (let y = 0; y < Hp; y++) {
    const my = Math.min(MH - 1, Math.floor(((Hp - 1 - y) / Hp) * MH));
    for (let x = 0; x < Wp; x++) {
      const mx = Math.min(MW - 1, Math.floor((x / Wp) * MW));
      const i = (y * Wp + x) * 4;
      const d = Math.max(Math.abs(A[i] - B[i]), Math.abs(A[i + 1] - B[i + 1]), Math.abs(A[i + 2] - B[i + 2]));
      const covered = d < 32 ? 1 : 0;   // identical under both clears => the cast covers it
      if (covered) castPx++;
      const k = my * MW + mx;
      cnt[k]++; acc[k] += covered;
    }
  }
  let cells = 0;
  const mask = new Array(MW * MH);
  for (let k = 0; k < mask.length; k++) {
    const f = cnt[k] ? acc[k] / cnt[k] : 0;
    mask[k] = f >= 0.5 ? '1' : '0';
    if (mask[k] === '1') cells++;
  }
  return {
    buffer: [Wp, Hp],
    castRoots: castRoots.length,
    castRootNames: castRoots.map((o) => o.name || '(unnamed)'),
    castPxPctFullRes: +((castPx / (Wp * Hp)) * 100).toFixed(3),
    castCells: cells,
    mask: mask.join(''),
  };
};

// ─────────────────────────────────────────────────────────────────────────────
// Aggregation + rails
// ─────────────────────────────────────────────────────────────────────────────
const mean = (a) => (a.length ? a.reduce((x, y) => x + y, 0) / a.length : 0);
const median = (a) => { if (!a.length) return 0; const s = [...a].sort((x, y) => x - y); const h = s.length >> 1; return s.length % 2 ? s[h] : (s[h - 1] + s[h]) / 2; };

/**
 * The whole point of this tool's new half: ONE number per rail, over the whole sweep,
 * so nobody has to notice a drift by eye across 18 rows two passes later.
 *
 * The aggregate is the UNWEIGHTED MEAN over stations, matching how the reference
 * figure is the unweighted mean over plates.
 */
function aggregate(results) {
  const ok = results.filter((r) => r.ok);
  const withRole = ok.filter((r) => r.metrics.colour && r.metrics.colour.cast);
  const g = (f) => ok.map((r) => f(r.metrics));
  const gr = (f) => withRole.map((r) => f(r.metrics));

  const binsAll = new Array(HUE_BINS).fill(0);
  for (const r of ok) r.metrics.colour.all.binChroma.forEach((v, i) => { binsAll[i] += v / ok.length; });
  const castBins = new Array(HUE_BINS).fill(0), envBins = new Array(HUE_BINS).fill(0);
  for (const r of withRole) {
    r.metrics.colour.cast.binShare.forEach((v, i) => { castBins[i] += v / withRole.length; });
    r.metrics.colour.env.binShare.forEach((v, i) => { envBins[i] += v / withRole.length; });
  }

  const values = {
    meanSat: +mean(g((m) => m.colour.all.meanSat)).toFixed(4),
    meanChroma: +mean(g((m) => m.colour.all.meanChroma)).toFixed(4),
    warmChroma: +mean(g((m) => m.colour.all.warmChroma)).toFixed(4),
    coolChroma: +mean(g((m) => m.colour.all.coolChroma)).toFixed(4),
    warmShare: +mean(g((m) => m.colour.all.warmShare)).toFixed(4),
    arenaMeanSat: withRole.length ? +mean(gr((m) => m.colour.arena.meanSat)).toFixed(4) : null,
    arenaWarmChroma: withRole.length ? +mean(gr((m) => m.colour.arena.warmChroma)).toFixed(4) : null,
    arenaCoolChroma: withRole.length ? +mean(gr((m) => m.colour.arena.coolChroma)).toFixed(4) : null,
    arenaWarmShare: withRole.length ? +mean(gr((m) => m.colour.arena.warmShare)).toFixed(4) : null,
    hudWarmChroma: withRole.length ? +mean(gr((m) => m.colour.hudDelta.warmChroma)).toFixed(4) : null,
    hudCoolChroma: withRole.length ? +mean(gr((m) => m.colour.hudDelta.coolChroma)).toFixed(4) : null,
    envWarmChroma: withRole.length ? +mean(gr((m) => m.colour.env.warmChroma)).toFixed(4) : null,
    envCoolChroma: withRole.length ? +mean(gr((m) => m.colour.env.coolChroma)).toFixed(4) : null,
    envWarmShare: withRole.length ? +mean(gr((m) => m.colour.env.warmShare)).toFixed(4) : null,
    envMeanSatWithin: withRole.length ? +mean(gr((m) => m.colour.env.meanSatWithin)).toFixed(4) : null,
    castWarmChroma: withRole.length ? +mean(gr((m) => m.colour.cast.warmChroma)).toFixed(4) : null,
    castMeanSatWithin: withRole.length ? +mean(gr((m) => m.colour.cast.meanSatWithin)).toFixed(4) : null,
    castCoveragePct: withRole.length ? +mean(gr((m) => m.colour.cast.pctOfFrame)).toFixed(3) : null,
    hueOverlap: withRole.length ? +mean(gr((m) => m.colour.collision.hueOverlap)).toFixed(4) : null,
    envShareInCastBand: withRole.length ? +mean(gr((m) => m.colour.collision.envShareInCastBand)).toFixed(4) : null,
    envChromaInCastBand: withRole.length ? +mean(gr((m) => m.colour.collision.envChromaInCastBand)).toFixed(5) : null,
    hueSeparationDeg: withRole.length ? +mean(gr((m) => m.colour.collision.hueSeparationDeg ?? 0)).toFixed(1) : null,
    playerRankMedian: median(g((m) => m.playerRank)),
    playerRankMean: +mean(g((m) => m.playerRank)).toFixed(1),
    clippedLowPct: +mean(g((m) => m.clippedLowPct)).toFixed(3),
    clippedHighPct: +mean(g((m) => m.clippedHighPct)).toFixed(3),
  };
  return {
    stations: ok.length, stationsWithRole: withRole.length,
    // The rails are cross-station MEANS, so a baseline built from a different set of
    // stations is not comparable to this run. Recorded so the gate can refuse rather
    // than print a confident wrong REGRESSION — an agent running `--only pot_south`
    // against the full 18-station baseline got exactly that.
    stationIds: ok.map((r) => r.id),
    values, binChromaAll: binsAll.map((v) => +v.toFixed(5)),
    castBinShare: castBins.map((v) => +v.toFixed(4)),
    envBinShare: envBins.map((v) => +v.toFixed(4)),
    topCellsInCastBand: withRole.length
      ? +(mean(withRole.map((r) => r.metrics.topOther.filter((t) => t.inCastBand).length)) / 3).toFixed(3)
      : null,
  };
}

/** PASS / FAIL each rail against its band, plus the hard "muddy" floor. */
function railStatus(agg) {
  const out = [];
  for (const rail of RAILS) {
    const v = agg.values[rail.key];
    if (v == null) { out.push({ ...rail, value: null, status: 'SKIP', why: 'no role split on this run' }); continue; }
    let status = 'PASS', why = '';
    if (v < rail.band[0]) { status = 'FAIL'; why = `below band ${rail.band[0].toFixed(3)}`; }
    else if (v > rail.band[1]) { status = 'FAIL'; why = `above band ${rail.band[1].toFixed(3)}`; }
    if (rail.hardFloor != null && v < rail.hardFloor) { status = 'FAIL'; why = `BELOW THE ${rail.hardFloor} "MUDDY" FLOOR`; }
    if (rail.advisory && status === 'FAIL') status = 'WARN';   // never gates; still reported
    out.push({ key: rail.key, label: rail.label, value: v, target: rail.target, band: rail.band, kind: rail.kind, note: rail.note, status, why });
  }
  return out;
}

/**
 * Regression gate, same contract as `tools/perf.mjs --baseline`.
 *
 * DIRECTIONAL on purpose: moving TOWARD the reference target is never a regression,
 * however far it moves. A gate that fires on an improvement is a gate that gets
 * switched off (docs/LESSONS.md §9 — a lint that cries wolf gets ignored).
 *
 * Fires when, and only when:
 *   • a rail moves FURTHER from its reference target by more than `tol`, or
 *   • a rail that was inside its band leaves it (reported with the louder reason), or
 *   • playerRank median worsens by more than 4 places, or
 *   • clipping grows by more than 1.0pp AND lands above 2%.
 *
 * `tol` is ~10% of each reference target and the MEASURED run-to-run noise at
 * `--sim-speed 0.02` is <= 0.0001 on every chroma quantity (two full sweeps of the same
 * frozen snapshot differ in the fourth decimal), so every tolerance here is ~100x the
 * noise floor. It is not a band-crossing test: the bands are +/-50% wide by design, and
 * an earlier draft of this function let 0.145 -> 0.078 through as "ok" because both ends
 * sat inside the band. That is precisely the drift this tool exists to catch, so the
 * rule is drift from TARGET, not membership of a band.
 */
function compareBaseline(baseAgg, nowAgg) {
  const rows = [];
  for (const rail of RAILS) {
    const b = baseAgg.values[rail.key], n = nowAgg.values[rail.key];
    if (typeof b !== 'number' || typeof n !== 'number') continue;
    const db = Math.abs(b - rail.target), dn = Math.abs(n - rail.target);
    const inB = b >= rail.band[0] && b <= rail.band[1];
    const inN = n >= rail.band[0] && n <= rail.band[1];
    let verdict = 'ok', why = '';
    if (dn > db + rail.tol) { verdict = 'REGRESSION'; why = `drifted ${(dn - db).toFixed(4)} further from ${rail.target} (tol ${rail.tol})`; }
    if (inB && !inN) { verdict = 'REGRESSION'; why = `LEFT the band [${rail.band[0].toFixed(3)}, ${rail.band[1].toFixed(3)}]`; }
    rows.push({ key: rail.key, label: rail.label, base: b, now: n, target: rail.target, delta: +(n - b).toFixed(4), verdict, why, moved: dn > db ? 'further' : dn < db ? 'closer' : 'same' });
  }
  const pr = [baseAgg.values.playerRankMedian, nowAgg.values.playerRankMedian];
  if (typeof pr[0] === 'number' && typeof pr[1] === 'number') {
    rows.push({ key: 'playerRankMedian', label: 'player salience rank (median)', base: pr[0], now: pr[1], target: 1, delta: pr[1] - pr[0], verdict: pr[1] > pr[0] + 4 ? 'REGRESSION' : 'ok', moved: pr[1] > pr[0] ? 'further' : pr[1] < pr[0] ? 'closer' : 'same' });
  }
  for (const k of ['clippedLowPct', 'clippedHighPct']) {
    const b = baseAgg.values[k], n = nowAgg.values[k];
    if (typeof b !== 'number' || typeof n !== 'number') continue;
    rows.push({ key: k, label: k, base: b, now: n, target: 0, delta: +(n - b).toFixed(3), verdict: n > b + 1.0 && n > 2.0 ? 'REGRESSION' : 'ok', moved: n > b ? 'further' : n < b ? 'closer' : 'same' });
  }
  return rows;
}

function formatBudget(agg, rails) {
  const L = [];
  const v = agg.values;
  L.push('CUMULATIVE COLOUR BUDGET — the whole frame, not per element');
  L.push(`  methodology: ${REF.method}`);
  L.push(`  reference  : ${REF.source}`);
  L.push('');
  L.push('  rail                     value    target   band              status  kind');
  for (const r of rails) {
    L.push(`  ${String(r.label).padEnd(24)} ${r.value == null ? '    —' : r.value.toFixed(4)}   ${r.target.toFixed(3)}   ` +
      `[${r.band[0].toFixed(3)}, ${r.band[1].toFixed(3)}]   ${r.status.padEnd(6)}  ${r.kind}${r.why ? `  <- ${r.why}` : ''}`);
  }
  L.push('');
  L.push(`  frame       meanSat ${v.meanSat}  chroma ${v.meanChroma}  warm ${v.warmChroma}  cool ${v.coolChroma}  warm/total ${v.warmShare}   (HUD included, as the plates are)`);
  L.push(`  reference   meanSat ${REF.meanSat}  chroma ${REF.chroma}  warm ${REF.warmChroma}  cool ${REF.coolChroma}  warm/total ${REF.warmShare}`);
  if (v.envWarmShare != null) {
    L.push(`  arena only  meanSat ${v.arenaMeanSat}  warm ${v.arenaWarmChroma}  cool ${v.arenaCoolChroma}  warm/total ${v.arenaWarmShare}   <- what a colour pass actually moves`);
    L.push(`  the HUD adds  warm ${v.hudWarmChroma}  cool ${v.hudCoolChroma}  = ${((v.hudWarmChroma / (v.warmChroma || 1)) * 100).toFixed(0)}% of the frame's warm chroma`);
    L.push('');
    L.push(`  ENV         warm ${v.envWarmChroma}  cool ${v.envCoolChroma}  warm/total ${v.envWarmShare}  satWithin ${v.envMeanSatWithin}`);
    L.push(`  CAST        warm ${v.castWarmChroma}  satWithin ${v.castMeanSatWithin}  coverage ${v.castCoveragePct}% of frame`);
    L.push(`  COLLISION   hueOverlap ${v.hueOverlap}  envChromaInCastBand ${v.envChromaInCastBand} (${(v.envShareInCastBand * 100).toFixed(1)}% of env chroma)  hueSeparation ${v.hueSeparationDeg}deg`);
    L.push(`              loudest non-player cells wearing the cast's own hue: ${(agg.topCellsInCastBand * 100).toFixed(0)}%`);
    L.push('');
    L.push('  hue occupancy, 12 x 30deg bins (share of that role\'s own chroma)');
    L.push(`    bin deg   ${Array.from({ length: HUE_BINS }, (_, i) => String(i * 30).padStart(5)).join('')}`);
    L.push(`    CAST      ${agg.castBinShare.map((x) => x.toFixed(2).padStart(5)).join('')}`);
    L.push(`    ENV       ${agg.envBinShare.map((x) => x.toFixed(2).padStart(5)).join('')}`);
  } else {
    L.push('');
    L.push('  ROLE SPLIT UNAVAILABLE on this run — env-vs-cast rails were SKIPPED, not passed.');
  }
  return L;
}

// ─────────────────────────────────────────────────────────────────────────────
// MODE: --ref-plates — re-derive the reference figures with THIS code
// ─────────────────────────────────────────────────────────────────────────────
async function modeRefPlates(dir) {
  // Exclude this tool's own derivative files so pointing --ref-plates at a scan output
  // dir measures each frame ONCE instead of three times.
  const files = readdirSync(dir).filter((f) => /\.(png|jpe?g)$/i.test(f) && !/\.(marked|key|canvas|nohud|matte)\./.test(f) && !f.startsWith('sheet_')).sort();
  if (!files.length) { console.error(`no images in ${dir}`); process.exit(2); }
  console.log(`\nREFERENCE PLATES — ${dir} (${files.length})`);
  console.log('  Same colourBudget() the live scan uses. If these do not reproduce the recorded');
  console.log('  0.493 / 0.1449 / 0.3431, the live numbers are NOT comparable to anything recorded.\n');
  console.log('plate            meanSat  chroma   warm(0-30/30-60)   cool     warm/total  luma');
  const rows = [];
  for (const f of files) {
    const { data } = await sharp(join(dir, f)).resize(SMALL_W, SMALL_H, { fit: 'fill' }).removeAlpha().raw().toBuffer({ resolveWithObject: true });
    const c = colourBudget(data, SMALL_W * SMALL_H).all;
    rows.push(c);
    console.log(`${f.padEnd(16)} ${c.meanSat.toFixed(3)}    ${c.meanChroma.toFixed(3)}    ${c.binChroma[0].toFixed(3)} / ${c.binChroma[1].toFixed(3)}      ${c.coolChroma.toFixed(3)}    ${c.warmShare.toFixed(3)}       ${c.meanLumaWithin.toFixed(3)}`);
  }
  const M = (f) => +mean(rows.map(f)).toFixed(4);
  const warm = M((c) => c.warmChroma), cool = M((c) => c.coolChroma);
  console.log(`${'MEAN'.padEnd(16)} ${M((c) => c.meanSat).toFixed(3)}    ${M((c) => c.meanChroma).toFixed(3)}    ${M((c) => c.binChroma[0]).toFixed(3)} / ${M((c) => c.binChroma[1]).toFixed(3)}      ${cool.toFixed(3)}    ${(warm / (warm + cool)).toFixed(3)}       ${M((c) => c.meanLumaWithin).toFixed(3)}`);
  console.log(`\n  absolute warm chroma (0-60deg) = ${warm.toFixed(4)}   cool = ${cool.toFixed(4)}   warm/total = ${(warm / (warm + cool)).toFixed(3)}   meanSat = ${M((c) => c.meanSat).toFixed(4)}`);
  console.log(`  recorded baseline              = 0.1449                0.3431              0.297           0.493`);
  const ok = Math.abs(warm - 0.1449) < 0.002 && Math.abs(cool - 0.3431) < 0.002 && Math.abs(M((c) => c.meanSat) - 0.493) < 0.002;
  console.log(ok ? '  ✓ reproduces the recorded figures — live numbers ARE comparable.'
                 : '  ✗ DOES NOT reproduce the recorded figures. Do not compare anything to 0.145.');
  return ok ? 0 : 1;
}

// ─────────────────────────────────────────────────────────────────────────────
// MODE: --selftest — prove each metric on inputs whose answer is known
//
// docs/LESSONS.md §10: "a plausible measurement taken once and treated as fact has
// cost this project real time — twice." An instrument that reports a plausible wrong
// number is worse than none, so every quantity below is checked against a value
// derived by hand, not against a previous run of itself.
//
// Frames are authored at EXACTLY 320x180 so sharp's resize is an identity and the
// synthetic answer is not blurred by a resampling kernel.
// ─────────────────────────────────────────────────────────────────────────────
async function modeSelftest() {
  const dir = join(tmpdir(), `arena-scan-selftest-${process.pid}`);
  await mkdir(dir, { recursive: true });
  let pass = 0, fail = 0;
  const near = (a, b, eps = 0.002) => a != null && Math.abs(a - b) <= eps;
  const check = (name, got, want, eps) => {
    const ok = typeof want === 'number' ? near(got, want, eps ?? 0.002) : got === want;
    if (ok) { pass++; console.log(`  ✓ ${name.padEnd(52)} ${JSON.stringify(got)}`); }
    else { fail++; console.log(`  ✗ ${name.padEnd(52)} got ${JSON.stringify(got)}  want ${JSON.stringify(want)}`); }
  };

  /** Build a 320x180 PNG from a per-pixel colour function and read it back the way a
   *  real capture is read — through sharp, at the metric grid. */
  const frame = async (name, fn) => {
    const buf = Buffer.alloc(SMALL_W * SMALL_H * 3);
    for (let y = 0; y < SMALL_H; y++) for (let x = 0; x < SMALL_W; x++) {
      const [r, g, b] = fn(x, y); const i = (y * SMALL_W + x) * 3;
      buf[i] = r; buf[i + 1] = g; buf[i + 2] = b;
    }
    const p = join(dir, `${name}.png`);
    await sharp(buf, { raw: { width: SMALL_W, height: SMALL_H, channels: 3 } }).png().toFile(p);
    const { data } = await sharp(p).resize(SMALL_W, SMALL_H, { fit: 'fill' }).removeAlpha().raw().toBuffer({ resolveWithObject: true });
    return data;
  };

  console.log('\nSELFTEST — synthetic frames whose answer is known by hand\n');

  console.log('A. absolute chroma, the recorded methodology');
  // 1. flat mid grey: no chroma at all. Saturation must be exactly 0, not "small".
  let c = colourBudget(await frame('grey', () => [128, 128, 128]), SMALL_W * SMALL_H).all;
  check('grey #808080 meanSat', c.meanSat, 0, 0);
  check('grey #808080 meanChroma', c.meanChroma, 0, 0);
  check('grey #808080 warmChroma', c.warmChroma, 0, 0);
  check('grey #808080 coolChroma', c.coolChroma, 0, 0);

  // 2. fully saturated red: s = d/(max+min) = 255/255 = 1 exactly, hue 0 -> bin 0.
  c = colourBudget(await frame('red', () => [255, 0, 0]), SMALL_W * SMALL_H).all;
  check('red #FF0000 meanSat', c.meanSat, 1);
  check('red #FF0000 meanChroma', c.meanChroma, 1);
  check('red #FF0000 warmChroma', c.warmChroma, 1);
  check('red #FF0000 coolChroma', c.coolChroma, 0, 0);
  check('red #FF0000 warmShare', c.warmShare, 1);
  check('red #FF0000 dominantHueDeg', c.dominantHueDeg, 0);
  check('red #FF0000 circular mean hue', c.hueDeg, 0, 0.05);

  // 3. pure warm orange, hue 30.1 -> the 30-60 bin. Proves the warm band is not just bin0.
  c = colourBudget(await frame('orange', () => [255, 128, 0]), SMALL_W * SMALL_H).all;
  check('orange #FF8000 warmChroma', c.warmChroma, 1);
  check('orange #FF8000 lands in bin 1 (30-60deg)', c.dominantBin, 1);
  check('orange #FF8000 coolChroma', c.coolChroma, 0, 0);

  // 4. pure cool cyan, hue 180 -> bin 6. warm must be exactly zero.
  c = colourBudget(await frame('cyan', () => [0, 255, 255]), SMALL_W * SMALL_H).all;
  check('cyan #00FFFF coolChroma', c.coolChroma, 1);
  check('cyan #00FFFF warmChroma', c.warmChroma, 0, 0);
  check('cyan #00FFFF warmShare', c.warmShare, 0, 0);
  check('cyan #00FFFF circular mean hue', c.hueDeg, 180, 0.05);

  // 5. 50/50 warm|cool split: the cumulative budget must SPLIT, not average away.
  c = colourBudget(await frame('split', (x) => (x < SMALL_W / 2 ? [255, 0, 0] : [0, 255, 255])), SMALL_W * SMALL_H).all;
  check('50/50 red|cyan meanSat', c.meanSat, 1);
  check('50/50 red|cyan warmChroma', c.warmChroma, 0.5);
  check('50/50 red|cyan coolChroma', c.coolChroma, 0.5);
  check('50/50 red|cyan warmShare', c.warmShare, 0.5);

  // 6/7. the s>=0.15 grey gate, from both sides. Hand-computed:
  //   (150,128,128): d=22, l=0.5451 -> s=22/232=0.09483  -> UNDER the gate
  //   (170,128,128): d=42, l=0.5843 -> s=42/212=0.19811  -> OVER the gate
  c = colourBudget(await frame('undergate', () => [150, 128, 128]), SMALL_W * SMALL_H).all;
  check('s=0.0948 counts in meanSat', c.meanSat, 0.0948, 0.0005);
  check('s=0.0948 is BELOW the 0.15 hue gate -> warm 0', c.warmChroma, 0, 0);
  c = colourBudget(await frame('overgate', () => [170, 128, 128]), SMALL_W * SMALL_H).all;
  check('s=0.1981 counts in meanSat', c.meanSat, 0.1981, 0.0005);
  check('s=0.1981 is ABOVE the gate -> warm 0.1981', c.warmChroma, 0.1981, 0.0005);

  // 8. a known non-trivial mix: 25% red, 25% cyan, 50% grey. Every quantity is a
  //    hand-computable fraction, which is the case a "plausible" bug survives.
  c = colourBudget(await frame('quarters', (x) => (x < SMALL_W / 4 ? [255, 0, 0] : x < SMALL_W / 2 ? [0, 255, 255] : [128, 128, 128])), SMALL_W * SMALL_H).all;
  check('25/25/50 red|cyan|grey meanSat', c.meanSat, 0.5);
  check('25/25/50 warmChroma', c.warmChroma, 0.25);
  check('25/25/50 coolChroma', c.coolChroma, 0.25);
  check('25/25/50 warmShare', c.warmShare, 0.5);

  console.log('\nB. role split and the hue-collision number');
  const half = new Uint8Array(SMALL_W * SMALL_H);
  for (let y = 0; y < SMALL_H; y++) for (let x = 0; x < SMALL_W / 2; x++) half[y * SMALL_W + x] = 1;

  // 9. DISJOINT: cast is red, environment is cyan. This is the reference contract —
  //    a saturated cool ground with the warm half left for the cast.
  let full = colourBudget(await frame('split', (x) => (x < SMALL_W / 2 ? [255, 0, 0] : [0, 255, 255])), SMALL_W * SMALL_H, half);
  check('disjoint: cast coverage %', full.cast.pctOfFrame, 50, 0.01);
  check('disjoint: cast warmChroma (frame units)', full.cast.warmChroma, 0.5);
  check('disjoint: env coolChroma (frame units)', full.env.coolChroma, 0.5);
  check('disjoint: cast+env warm == frame warm', +(full.cast.warmChroma + full.env.warmChroma).toFixed(4), full.all.warmChroma, 0.0002);
  check('disjoint: cast+env cool == frame cool', +(full.cast.coolChroma + full.env.coolChroma).toFixed(4), full.all.coolChroma, 0.0002);
  check('disjoint: hueOverlap', full.collision.hueOverlap, 0, 0);
  check('disjoint: envShareInCastBand', full.collision.envShareInCastBand, 0, 0);
  check('disjoint: hueSeparationDeg', full.collision.hueSeparationDeg, 180, 0.1);
  check('disjoint: env warmShare', full.env.warmShare, 0, 0);

  // 10. TOTAL COLLISION: the environment wearing exactly the cast's hue. This is the
  //     shape of the real finding — the pot and the counter fronts in the hero's tan.
  full = colourBudget(await frame('red', () => [255, 0, 0]), SMALL_W * SMALL_H, half);
  check('collision: hueOverlap', full.collision.hueOverlap, 1);
  check('collision: envShareInCastBand', full.collision.envShareInCastBand, 1);
  check('collision: hueSeparationDeg', full.collision.hueSeparationDeg, 0, 0.05);
  check('collision: env warmShare', full.env.warmShare, 1);

  // 11. ONE BIN APART: 0-30 vs 30-60 are adjacent, so they are inside each other's
  //     +/-30deg band — a metric that called these "separated" would miss the actual
  //     tan-orange-vs-tan-orange case entirely.
  full = colourBudget(await frame('adjacent', (x) => (x < SMALL_W / 2 ? [255, 0, 0] : [255, 128, 0])), SMALL_W * SMALL_H, half);
  check('adjacent bins: hueOverlap (disjoint bins)', full.collision.hueOverlap, 0, 0);
  check('adjacent bins: env IS inside the cast +/-30 band', full.collision.envShareInCastBand, 1);
  check('adjacent bins: hueSeparationDeg', full.collision.hueSeparationDeg, 30, 0.2);

  // 12. HALF-COLLIDING environment: half of the env chroma in the cast's band.
  full = colourBudget(await frame('halfcollide', (x, y) => (x < SMALL_W / 2 ? [255, 0, 0] : (y < SMALL_H / 2 ? [255, 0, 0] : [0, 255, 255]))), SMALL_W * SMALL_H, half);
  check('half-colliding: envShareInCastBand', full.collision.envShareInCastBand, 0.5);
  check('half-colliding: hueOverlap', full.collision.hueOverlap, 0.5);

  console.log('\nC. the whole analyse() path still answers the salience question');
  // A frame that is flat everywhere except one loud cell far from the player region:
  // playerRank must NOT be 1, and the loud cell must be named.
  const loud = analyseRaw(await frame('loud', (x, y) => {
    const inLoud = x >= 20 && x < 40 && y >= 20 && y < 40;
    return inLoud ? [240, 40, 12] : [110, 112, 120];   // nothing pinned at 0 or 255
  }));
  check('loud corner beats the player region', loud.playerRank > 1, true);
  check('loud corner is named as topOther #1', loud.topOther[0].cell, '1,1');
  check('nothing pinned at 0/255 -> clipping exactly 0', loud.clippedLowPct + loud.clippedHighPct, 0, 0);

  // Clipping is the colour-grade regression check, so it has to count the right
  // pixels: one 20x20 cell of 320x180 is 400/57600 = 0.694%, and a pixel with BOTH a
  // 0 and a 255 channel must be counted once on each side, not once in total.
  const clip = analyseRaw(await frame('clip', (x, y) => (
    x >= 20 && x < 40 && y >= 20 && y < 40 ? [255, 40, 0] : [110, 112, 120]
  )));
  check('one 20x20 cell at 255 -> clippedHighPct', clip.clippedHighPct, 0.69, 0.005);
  check('the same cell at 0 -> clippedLowPct', clip.clippedLowPct, 0.69, 0.005);

  console.log('\nD. the regression gate fires when it should, and stays quiet when it should not');
  // docs/LESSONS.md §9: a lint that cries wolf gets ignored. The gate is DIRECTIONAL —
  // moving toward the reference is never a regression, however large the move.
  const agg = (over) => ({ values: Object.assign({
    meanSat: 0.324, meanChroma: 0.208, warmChroma: 0.145, coolChroma: 0.343, warmShare: 0.297,
    envWarmShare: 0.20, hueOverlap: 0.27, envShareInCastBand: 0.21,
    arenaMeanSat: 0.288, arenaWarmChroma: 0.069, arenaCoolChroma: 0.215,
    playerRankMedian: 33, clippedLowPct: 0.12, clippedHighPct: 0.38,
  }, over) });
  const verdictFor = (base, now, key) => (compareBaseline(base, now).find((r) => r.key === key) || {}).verdict;
  check('warm chroma 0.145 -> 0.067 (further, leaves band)', verdictFor(agg({}), agg({ warmChroma: 0.067 }), 'warmChroma'), 'REGRESSION');
  check('warm chroma 0.067 -> 0.145 (an improvement)', verdictFor(agg({ warmChroma: 0.067 }), agg({}), 'warmChroma'), 'ok');
  check('warm chroma 0.067 -> 0.050 (further, already out)', verdictFor(agg({ warmChroma: 0.067 }), agg({ warmChroma: 0.050 }), 'warmChroma'), 'REGRESSION');
  check('warm chroma 0.067 -> 0.064 (further but inside tol)', verdictFor(agg({ warmChroma: 0.067 }), agg({ warmChroma: 0.064 }), 'warmChroma'), 'ok');
  // THE case an earlier draft of compareBaseline let through: both ends inside the
  // +/-50% band, and a 0.067 drop between them. That is the whole failure this exists for.
  check('warm chroma 0.145 -> 0.078 (BOTH inside the band)', verdictFor(agg({}), agg({ warmChroma: 0.078 }), 'warmChroma'), 'REGRESSION');
  check('warm chroma 0.145 -> 0.130 (drifted past tol)', verdictFor(agg({}), agg({ warmChroma: 0.130 }), 'warmChroma'), 'REGRESSION');
  check('warm chroma 0.145 -> 0.138 (drift inside tol)', verdictFor(agg({}), agg({ warmChroma: 0.138 }), 'warmChroma'), 'ok');
  // measured run-to-run noise on a frozen snapshot at --sim-speed 0.02 is <= 0.0001
  check('warm chroma 0.0784 -> 0.0783 (the measured noise floor)', verdictFor(agg({ warmChroma: 0.0784 }), agg({ warmChroma: 0.0783 }), 'warmChroma'), 'ok');
  check('meanSat 0.400 -> 0.300 (crosses the muddy floor)', verdictFor(agg({ meanSat: 0.400 }), agg({ meanSat: 0.300 }), 'meanSat'), 'REGRESSION');
  check('env warm share 0.20 -> 0.35 (breaches the 0.297 ceiling)', verdictFor(agg({}), agg({ envWarmShare: 0.35 }), 'envWarmShare'), 'REGRESSION');
  check('hue overlap 0.27 -> 0.60 (env moves onto the cast hue)', verdictFor(agg({}), agg({ hueOverlap: 0.60 }), 'hueOverlap'), 'REGRESSION');
  check('hue overlap 0.27 -> 0.10 (env moves off it)', verdictFor(agg({}), agg({ hueOverlap: 0.10 }), 'hueOverlap'), 'ok');
  check('arena warm chroma drifts further (advisory rail still gates)', verdictFor(agg({}), agg({ arenaWarmChroma: 0.040 }), 'arenaWarmChroma'), 'REGRESSION');
  check('playerRank 33 -> 39 (salience lost)', verdictFor(agg({}), agg({ playerRankMedian: 39 }), 'playerRankMedian'), 'REGRESSION');
  check('playerRank 33 -> 36 (inside the 4-place tolerance)', verdictFor(agg({}), agg({ playerRankMedian: 36 }), 'playerRankMedian'), 'ok');
  check('playerRank 33 -> 8 (an improvement)', verdictFor(agg({}), agg({ playerRankMedian: 8 }), 'playerRankMedian'), 'ok');
  check('clipping 0.38 -> 3.0% (the grade broke again)', verdictFor(agg({}), agg({ clippedHighPct: 3.0 }), 'clippedHighPct'), 'REGRESSION');
  check('clipping 0.38 -> 1.6% (up, but still healthy)', verdictFor(agg({}), agg({ clippedHighPct: 1.6 }), 'clippedHighPct'), 'ok');
  // and the absolute rails, which --gate enforces
  const rr = (over) => railStatus(agg(over));
  const st = (rows, key) => (rows.find((r) => r.key === key) || {}).status;
  check('--gate: warm 0.067 is a FAIL', st(rr({ warmChroma: 0.067 }), 'warmChroma'), 'FAIL');
  check('--gate: warm 0.145 is a PASS', st(rr({}), 'warmChroma'), 'PASS');
  check('--gate: meanSat 0.324 is a FAIL (below every plate)', st(rr({}), 'meanSat'), 'FAIL');
  check('--gate: meanSat 0.493 is a PASS', st(rr({ meanSat: 0.493 }), 'meanSat'), 'PASS');
  check('--gate: arena rails are advisory, never FAIL', st(rr({ arenaWarmChroma: 0.001 }), 'arenaWarmChroma'), 'WARN');
  check('--gate: rails with no role data SKIP, they do not pass', st(railStatus({ values: { meanSat: 0.5 } }), 'hueOverlap'), 'SKIP');

  console.log('\nE. the reference figures reproduce (skipped if reference/ is absent)');
  try {
    const rc = await modeRefPlates('reference/images/curated/gameplay');
    check('reference plates reproduce 0.493 / 0.1449 / 0.3431', rc, 0);
  } catch (e) {
    console.log(`  ⚠ SKIPPED — ${String(e.message || e).split('\n')[0]}`);
    console.log('    reference/ is gitignored; this check only runs where the plates exist.');
  }

  console.log(`\n${pass} passed, ${fail} failed`);
  return fail === 0 ? 0 : 1;
}

// ─────────────────────────────────────────────────────────────────────────────
async function run() {
  const wanted = args.only ? new Set(String(args.only).split(',').map((s) => s.trim())) : null;
  const jobs = STATIONS.filter((s) => !wanted || wanted.has(s.id));
  if (jobs.length === 0) { console.error('No stations matched --only'); process.exit(2); }

  const invalid = validate(jobs);
  if (invalid.length) {
    console.error('Station placement is invalid — the player would spawn inside a prop:');
    invalid.forEach((m) => console.error(`  ${m}`));
    process.exit(2);
  }

  const LAUNCH_ARGS = [
    '--use-gl=angle', '--use-angle=swiftshader', '--enable-unsafe-swiftshader',
    '--enable-webgl', '--ignore-gpu-blocklist', '--disable-gpu-sandbox',
  ];

  /** Vite HMR client stub. Five agents edit `src/` live; every save full-reloads the
   *  page and wipes a capture mid-flight. Pattern lifted from `tools/tmp/rake.mjs`. */
  const HMR_STUB = `const noop=()=>{};
export const createHotContext=()=>({accept:noop,acceptExports:noop,dispose:noop,prune:noop,
  invalidate:noop,on:noop,off:noop,send:noop,decline:noop,data:{}});
export const injectQuery=(u)=>u; export const updateStyle=noop; export const removeStyle=noop;
export const ErrorOverlay=class{}; export default {};`;

  await mkdir(OUT, { recursive: true });
  const browser = await chromium.launch({ args: LAUNCH_ARGS });
  const results = [];
  let failures = 0, roleFailures = 0;

  console.log(`arena-scan · ${jobs.length} stations · ${W}x${H} · base ${BASE}${WANT_ROLE ? '' : ' · role split OFF'}`);
  console.log(`out: ${OUT}\n`);

  try {
    for (const s of jobs) {
      const page = await browser.newPage({ viewport: { width: W, height: H }, deviceScaleFactor: 1 });
      await page.route('**/@vite/client*', (r) => r.fulfill({ status: 200, contentType: 'text/javascript', body: HMR_STUB }));

      const errors = [];
      page.on('pageerror', (e) => errors.push(String(e)));
      page.on('console', (m) => { if (m.type() === 'error') errors.push(m.text()); });

      const url = `${BASE}/?player=${PLAYER}&enemy=${ENEMY}&px=${s.x}&py=${s.y}` +
                  `&fogRadius=${s.fog}&simSpeed=${SIM_SPEED}&pointerLock=0`;
      const full = join(OUT, `${s.id}.png`);
      const canvasPng = join(OUT, `${s.id}.canvas.png`);

      try {
        await page.goto(url, { waitUntil: 'networkidle', timeout: 60000 });
        await page.waitForFunction('window.__gameReady === true', null, { timeout: 60000 });
        await page.waitForTimeout(SETTLE_MS);

        const view = await page.evaluate(() => (window.__fairView ? window.__fairView() : null));
        await page.screenshot({ path: full, timeout: 90000 });
        await page.locator('canvas').first().screenshot({ path: canvasPng, timeout: 90000 });

        // ── the HUD-free capture ───────────────────────────────────────────
        // `<id>.canvas.png` is NOT canvas-only: Playwright element screenshots capture
        // the composited page clipped to the element box, so the DOM HUD painted over
        // the canvas lands in it. Measured: 13.4% of the frame and ~25% of its warm
        // chroma. Every recorded figure includes it and so do the reference plates, so
        // `all` keeps it — but nothing calling itself "the environment" may.
        let nohudPng = null;
        if (WANT_ROLE) {
          const before = await page.evaluate(() => {
            const c = document.querySelector('canvas'); const r = c.getBoundingClientRect();
            return [c.width, c.height, Math.round(r.width), Math.round(r.height)];
          });
          const hid = await page.evaluate(() => {
            // `visibility`, not `display`: display:none reflows, and a reflow could
            // resize the canvas and silently change the pixels being compared.
            const els = [...document.querySelectorAll('.hud-root, #screens')];
            for (const e of els) e.style.visibility = 'hidden';
            return els.length;
          });
          await page.waitForTimeout(200);
          const after = await page.evaluate(() => {
            const c = document.querySelector('canvas'); const r = c.getBoundingClientRect();
            return [c.width, c.height, Math.round(r.width), Math.round(r.height)];
          });
          if (!hid) {
            roleFailures++;
            console.error(`  ⚠ ${s.id}: no .hud-root/#screens found — the HUD selector is stale.`);
            console.error('    Without a HUD-free capture there is no honest environment number; role rails SKIP.');
          } else if (before.join() !== after.join()) {
            roleFailures++;
            console.error(`  ⚠ ${s.id}: hiding the HUD RESIZED the canvas ${before} -> ${after}. Skipping the HUD-free capture.`);
          } else {
            nohudPng = join(OUT, `${s.id}.nohud.png`);
            await page.locator('canvas').first().screenshot({ path: nohudPng, timeout: 90000 });
          }
          await page.evaluate(() => {
            for (const e of document.querySelectorAll('.hud-root, #screens')) e.style.visibility = '';
          });
        }

        // The matte runs AFTER every screenshot and never touches them.
        let matte = null, mask = null;
        if (WANT_ROLE) {
          matte = await page.evaluate(CAST_MATTE, [SMALL_W, SMALL_H]);
          if (matte && matte.error) {
            roleFailures++;
            console.error(`  ⚠ ${s.id}: cast matte FAILED — ${matte.error}`);
            console.error('    role-split rails will be SKIPPED, not passed. Do not read env=100%.');
          } else if (matte) {
            mask = Uint8Array.from(matte.mask, (ch) => (ch === '1' ? 1 : 0));
            const { mask: _drop, ...meta } = matte;
            matte = meta;
          }
        }

        const m = await analyse(canvasPng, mask ? nohudPng : null, mask);
        await annotate(full, join(OUT, `${s.id}.marked.png`), m);
        if (mask) await matteOverlay(nohudPng ?? canvasPng, join(OUT, `${s.id}.matte.png`), mask);
        const { _cells, ...clean } = m;
        results.push({ ...s, url, view, ok: true, errors, matte, metrics: clean });

        const col = clean.colour.all;
        console.log(
          `✓ ${s.id.padEnd(14)} playerRank ${String(m.playerRank).padStart(3)}/${GRID_COLS * GRID_ROWS}` +
          `  ΔL ${String(m.centreContrast.deltaLuma).padStart(6)}` +
          `  domHue ${String(m.dominantHueDeg).padStart(3)}° ${(m.dominantHueShare * 100).toFixed(0)}%` +
          `  clip ${m.clippedLowPct}/${m.clippedHighPct}%`
        );
        console.log(
          `  ${' '.repeat(14)} sat ${col.meanSat.toFixed(3)}  warm ${col.warmChroma.toFixed(3)}  cool ${col.coolChroma.toFixed(3)}` +
          (clean.colour.collision
            ? `  cast ${clean.colour.cast.pctOfFrame.toFixed(1)}%  envWarm/total ${clean.colour.env.warmShare.toFixed(3)}` +
              `  overlap ${clean.colour.collision.hueOverlap.toFixed(2)}  envInCastBand ${(clean.colour.collision.envShareInCastBand * 100).toFixed(0)}%`
            : '  (no role split)')
        );
      } catch (err) {
        failures++;
        results.push({ ...s, url, ok: false, error: String(err), errors });
        console.error(`✗ ${s.id}\n  ${err}`);
        if (errors.length) console.error(`  page errors: ${errors.slice(0, 3).join(' | ')}`);
      } finally {
        await page.close();
      }
    }
  } finally {
    await browser.close();
  }

  const okResults = results.filter((r) => r.ok);
  const agg = okResults.length ? aggregate(results) : null;
  const rails = agg ? railStatus(agg) : [];

  const report = {
    base: BASE, viewport: [W, H], player: PLAYER, enemy: ENEMY, simSpeed: SIM_SPEED,
    generated: new Date().toISOString(),
    reference: REF, aggregate: agg, rails, stations: results,
  };
  await writeFile(join(OUT, 'metrics.json'), JSON.stringify(report, null, 2));
  if (JSON_OUT) {
    await mkdir(dirname(resolve(JSON_OUT)), { recursive: true });
    await writeFile(resolve(JSON_OUT), JSON.stringify(report, null, 2));
    console.log(`\nwrote baseline ${JSON_OUT}`);
  }

  // Contact sheets, 6 per sheet, so the whole map is one glance.
  for (let i = 0; i < okResults.length; i += 6) {
    const chunk = okResults.slice(i, i + 6);
    try {
      execFileSync('node', [
        'tools/compare.mjs',
        '--tile', chunk.map((c) => join(OUT, `${c.id}.png`)).join(','),
        '--labels', chunk.map((c) => c.id).join(','),
        '--cols', '3', '--height', '420',
        '--out', join(OUT, `sheet_${Math.floor(i / 6) + 1}.png`),
      ], { stdio: 'inherit' });
    } catch { /* sheet is a convenience, never a gate */ }
  }

  // SUMMARY.txt — the thing you read first.
  const lines = [];
  lines.push(`WHOLE-ARENA SCAN  ${new Date().toISOString()}`);
  lines.push(`${BASE}  ${W}x${H}  player=${PLAYER} enemy=${ENEMY} simSpeed=${SIM_SPEED}`);
  lines.push('');
  lines.push('station          rank  pLuma  ringLuma   dL   pSat ringSat  domHue share  clip0 clip255  loudest (cell rgb)');
  for (const r of results) {
    if (!r.ok) { lines.push(`${r.id.padEnd(16)} FAILED  ${r.error}`); continue; }
    const m = r.metrics, c = m.centreContrast, t = m.topOther[0];
    lines.push(
      `${r.id.padEnd(16)} ${String(m.playerRank).padStart(4)}  ` +
      `${c.playerLuma.toFixed(3)}  ${c.ringLuma.toFixed(3)}  ${String(c.deltaLuma).padStart(6)}  ` +
      `${c.playerSat.toFixed(2)}   ${c.ringSat.toFixed(2)}   ` +
      `${String(m.dominantHueDeg).padStart(4)}° ${(m.dominantHueShare * 100).toFixed(0).padStart(3)}%  ` +
      `${m.clippedLowPct.toFixed(2)}  ${m.clippedHighPct.toFixed(2)}   ` +
      `${t.cell} rgb(${t.rgb.join(',')})${t.inCastBand ? ' ⟡wearing the cast hue' : ''}`
    );
  }
  lines.push('');
  lines.push('COLOUR BUDGET PER STATION — meanSat/chroma/warm/cool are whole-frame (HUD included,');
  lines.push('as the reference plates are). cast%/envWarm/overlap are HUD-FREE.');
  lines.push('station          meanSat  chroma   warm    cool   warm/tot   cast%  envWarm/tot  overlap  envInCastBand');
  for (const r of results) {
    if (!r.ok) continue;
    const c = r.metrics.colour, a = c.all;
    lines.push(
      `${r.id.padEnd(16)} ${a.meanSat.toFixed(3)}    ${a.meanChroma.toFixed(3)}   ${a.warmChroma.toFixed(3)}  ${a.coolChroma.toFixed(3)}   ${a.warmShare.toFixed(3)}    ` +
      (c.collision
        ? `${c.cast.pctOfFrame.toFixed(2).padStart(5)}   ${c.env.warmShare.toFixed(3)}       ${c.collision.hueOverlap.toFixed(3)}    ${c.collision.envShareInCastBand.toFixed(3)}`
        : '    —       —           —        —')
    );
  }
  lines.push('');
  if (agg) lines.push(...formatBudget(agg, rails));
  lines.push('');
  lines.push('HOW TO READ IT');
  lines.push('  rank      player region\'s place in a 16x9 salience grid. 1 = the eye goes to the hero.');
  lines.push('            Worse than ~6 means static decoration is out-shouting the player.');
  lines.push('  dL        player luma minus surrounding-ring luma. |dL| < 0.05 = the hero has no');
  lines.push('            value separation from his own ground.');
  lines.push('  domHue    hue bin holding the largest saturation-weighted share of the frame.');
  lines.push('            share > ~45% means the frame is one hue family and nothing reads as');
  lines.push('            "different kind of thing".');
  lines.push('  clip      % pixels with a channel at 0 / 255. The colour-grade regression check.');
  lines.push('            Was 9.39 / 10.60 before ToyGradeEffect; a jump means the grade broke again.');
  lines.push('  loudest   the top non-player cell as "col,row" in the 16x9 grid + its mean colour.');
  lines.push('            Open <id>.marked.png to see it outlined.');
  lines.push('  meanSat / warm / cool');
  lines.push('            ABSOLUTE, cumulative, and directly comparable to the reference plates.');
  lines.push('            These are the numbers nobody was watching when two independently-correct');
  lines.push('            desaturation passes took warm chroma to 0.067 against a reference 0.145.');
  lines.push('  cast%     what fraction of frame the fighters cover, from an exact matte.');
  lines.push('            ~0.43% with one fighter in frame at shipped framing. Outside ~0.2-3%');
  lines.push('            means the matte is wrong — OPEN <id>.matte.png AND LOOK before you');
  lines.push('            believe any role row.');
  lines.push('  overlap   how much of the environment\'s hue occupancy coincides with the cast\'s.');
  lines.push('            0 = the reference contract (cool ground, warm cast). 1 = same colours.');
  lines.push('  envInCastBand');
  lines.push('            share of ENVIRONMENT chroma inside the cast\'s dominant hue +/-30 deg.');
  lines.push('            High = the props are wearing the hero\'s colour and will steal the read.');
  await writeFile(join(OUT, 'SUMMARY.txt'), lines.join('\n'));

  console.log('');
  if (agg) console.log(formatBudget(agg, rails).join('\n'));
  console.log(`\n  playerRank median ${agg ? agg.values.playerRankMedian : '—'} · mean ${agg ? agg.values.playerRankMean : '—'} of ${GRID_COLS * GRID_ROWS} cells`);
  if (roleFailures) console.log(`\n  ⚠ cast matte failed at ${roleFailures} station(s) — role rails are SKIPPED there, not passed.`);
  // The one number that says "the matte itself is wrong", which would make every hue
  // number downstream confidently false. Loud, and it names the file to go and look at.
  if (agg && agg.values.castCoveragePct != null && (agg.values.castCoveragePct < 0.2 || agg.values.castCoveragePct > 3)) {
    console.log(`\n  ⚠ cast coverage ${agg.values.castCoveragePct}% is outside the plausible 0.2-3% for one or two`);
    console.log('    fighters at shipped framing. SUSPECT THE MATTE, not the arena. Open');
    console.log(`    ${join(OUT, '<station>.matte.png')} and look at it before believing any role number.`);
  }
  console.log(`\nwrote ${OUT}/SUMMARY.txt, metrics.json, ${okResults.length} frames + marked + sheets`);

  let bad = 0;
  if (BASELINE) {
    const base = JSON.parse(await readFile(BASELINE, 'utf8'));
    if (!base.aggregate) {
      console.error(`\n${BASELINE} has no \`aggregate\` block — it predates the colour budget. Re-baseline with --json.`);
      process.exit(2);
    }
    const bi = base.aggregate.stationIds, ni = agg.stationIds;
    if (bi && ni && bi.join(',') !== ni.join(',')) {
      console.error(`\n${BASELINE} was built from a DIFFERENT station set:`);
      console.error(`  baseline (${bi.length}): ${bi.join(',')}`);
      console.error(`  this run (${ni.length}): ${ni.join(',')}`);
      console.error('Every rail is a cross-station mean, so these numbers are not comparable and');
      console.error('the difference would read as a regression that is really just a different sweep.');
      console.error('Re-run without --only, or baseline the same subset.');
      process.exit(2);
    }
    if (!bi) console.log('\n  (baseline predates stationIds — assuming the same sweep; verify by hand)');
    console.log(`\n── colour budget vs baseline: ${BASELINE} ──`);
    console.log('  rail                          base      now     target   moved      verdict');
    for (const row of compareBaseline(base.aggregate, agg)) {
      console.log(`  ${row.label.padEnd(29)} ${String(row.base).padStart(7)}  ${String(row.now).padStart(7)}  ${String(row.target).padStart(7)}   ${row.moved.padEnd(8)}  ${row.verdict}${row.why ? `  <- ${row.why}` : ''}`);
      if (row.verdict === 'REGRESSION') bad++;
    }
    console.log(bad ? `\n  ${bad} colour regression(s). A pass that moves TOWARD the reference never fires this.` : '\n  no colour regressions.');
  }
  if (GATE) {
    const failed = rails.filter((r) => r.status === 'FAIL');
    if (failed.length) {
      console.log(`\n  --gate: ${failed.length} rail(s) outside their band:`);
      for (const f of failed) console.log(`    FAIL ${f.label}: ${f.value} — ${f.why}`);
      bad += failed.length;
    } else console.log('\n  --gate: every rail inside its band.');
  }

  if (failures || bad) process.exit(1);
}

// ─────────────────────────────────────────────────────────────────────────────
if (args.selftest) {
  process.exit(await modeSelftest());
} else if (typeof args['ref-plates'] === 'string') {
  process.exit(await modeRefPlates(args['ref-plates']));
} else {
  run().catch((e) => { console.error(e); process.exit(1); });
}
