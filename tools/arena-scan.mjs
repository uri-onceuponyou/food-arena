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
 *   • `playerSalience` +/-0.004, `deltaLuma` +/-0.002, `hueHist` bins +/-0.002,
 *     `clipped` +/-0.01pp — and ONLY at the fog stations plus `pantry_ne`
 *   • `pot_south` and the other normal-play stations ARE byte-identical
 *   • the cumulative chroma aggregate drifts <= 0.0001 run to run
 * `simSpeed` slows the SIM; the fog ring and ambient shaders animate on wall clock, so
 * a station with a live ring on screen never freezes completely. Every chroma tolerance
 * below is ~100x that floor, which is why the gate does not cry wolf.
 *
 * ⚠️ THE OLD LINE HERE READ "`playerRank`, `dominantHueDeg`: identical everywhere".
 * FALSIFIED 2026-08-11 and kept above in corrected form rather than deleted, because it
 * is the row the regression gate reports and someone would otherwise treat a 1-place
 * move as signal. THREE full sweeps of ONE pinned tree (36ee0a6, arms A / B / D):
 *
 * FOUR full sweeps of ONE pinned tree (36ee0a6; arms A / B / D / E in `shots/sc/`):
 *
 *      station        A    B    D    E   spread     17 of 18 stations: spread 0, all four.
 *      fog_inside    27   26   37   30      11  <-- ONE station, and it is one of the
 *      every other  ==   ==   ==   ==       0      three flagged `unstill` below.
 *
 *      playerRankMedian  29.5  29.5  31  30   -> RESOLUTION FLOOR ~ +/-1.5 PLACES
 *      playerRankMean    26.1  26.1  26.7  26.3
 *      every chroma aggregate                    spread <= 0.0006
 *
 * The cause is not the arena. `fog_inside`'s frame carries the HUD's breathing screen-
 * EDGE wash, and how many edge cells out-rank the player depends on where a 0.9 s CSS
 * sine happened to be — see STATIONS' `unstill` block. **DO NOT ACT ON A `playerRankMedian`
 * MOVE UNDER ~1.5 PLACES.** The gate fires at +4, so it is ~2.7x the floor — real, but
 * nothing like the ~100x the chroma rails enjoy. `--still-hud` collapses this floor to
 * zero; the shipped baseline is deliberately taken WITHOUT it (an unbiased sample of the
 * look a player actually gets), and `--baseline` refuses to compare across the two.
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
 *   node tools/arena-scan.mjs --still-hud              # pause the HUD's CSS keyframes
 *                                                      # before capture. OFF by default:
 *                                                      # needed for PIXEL-IDENTITY work,
 *                                                      # wrong for colour numbers. See
 *                                                      # STATIONS' `unstill` block.
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
 * ── Colour baseline, 2026-08-11 @ 36ee0a6, 18/18 (`tools/scan/colour-baseline.json`) ──
 *
 * Taken through `node tools/tmp/headserve.mjs --ref 36ee0a6 --`, so the commit is a
 * stated fact the tool recorded and `--baseline` reads back, not a hand-written note.
 *
 *   frame       meanSat 0.4706  chroma 0.3253  warm 0.0596  cool 0.4078  warm/total 0.1258
 *   reference   meanSat 0.493   chroma 0.325   warm 0.145   cool 0.343   warm/total 0.297
 *   arena only  meanSat 0.4827                 warm 0.0580  cool 0.4219  warm/total 0.1189
 *
 *   FAIL  warm chroma 0.0596 — 41% of the reference, below the 0.0725 band floor. The
 *         ONE rail still out of contract, and `--gate` still fires on it.
 *   PASS  mean saturation 0.4706 (was 0.324 at the previous baseline), mean chroma
 *         0.3253 against a 0.325 target — arrived. cool 0.4078, warm SHARE 0.1258.
 *   ⚠️ WARM IS THE SCARCE BUDGET, still. Nothing here wants desaturating, and adding
 *         cool is no longer a free lever: coolChroma is 19% OVER its target already.
 *
 *   playerRank median 30 · mean 26.3 of 144 cells — and read the floor block above
 *   before treating any move in it as signal.
 *
 * ── WHY THIS REPLACED THE 2026-08-05 @ 3dcbc9a BASELINE ────────────────────────
 * That file was six days and 238 commits stale (104 touching `src/`, +32,898 lines) and
 * fired exactly one row on EVERY run — `player salience rank (median) 19.5 -> 31,
 * REGRESSION` — including on BOTH ARMS of a HEAD-to-HEAD drift control. Three agents in
 * one night were told to disregard it. A gate that always fires gets switched off.
 *
 * ⚠️ AND IT WAS NOT INVENTING THE NUMBER. `3dcbc9a` was re-served from `git archive` and
 * swept again with the CURRENT tool on 2026-08-11 (`shots/sc/C-3dcbc9a-knownbad`):
 *
 *              stored 2026-08-05   re-measured 2026-08-11
 *   meanSat          0.4434              0.4436
 *   warmChroma       0.0525              0.0525
 *   warmShare        0.1195              0.1194
 *   playerRankMedian   19.5                19.5
 *
 * It reproduces to <= 0.0002, and EXACTLY on the row that was firing. So the old
 * baseline described its own tree correctly; the failure was purely that the tree moved
 * ten salience places under it and every run since charged that to whatever change was
 * being tested. (It also proves this re-baseline changed the REFERENCE and not the
 * INSTRUMENT — same tool, same numbers on the same tree.) The proof, every arm served
 * from `git archive` at an EXPLICIT sha so no peer commit could enter one:
 *
 *   F  36ee0a6 vs THE SHIPPED FILE  0 regressions, exit 0  <- the drift control is CLEAN
 *                                                             on the artefact that ships.
 *                                                             `playerRankMedian 30 -> 31`,
 *                                                             inside its own floor.
 *   C  3dcbc9a vs this baseline     4 regressions, exit 1  <- and it still catches a real
 *                                                             difference: meanSat -0.0270,
 *                                                             meanChroma -0.0456,
 *                                                             arenaMeanSat -0.0363, and
 *                                                             warmShare LEFT the band.
 *   B, D  earlier arms of the same shape against the arm-A file, which differs from the
 *         shipped one by <= 0.0006 on every chroma rail. Both clean.
 *
 * ⚠️ WHAT THIS BAKES IN. The 19.5 -> 30 rank loss is now the reference and is therefore
 * INVISIBLE to future runs. It is real and it is nobody's: it accumulated over 104 src/
 * commits. `colour-baseline.json`'s `bakedInRegressions` says so, and attacking it needs
 * a fresh paired A/B rather than this gate.
 *
 *   HUE COLLISION — the cast lives in bins 0-30/30-60 (0.15 / 0.62 of its own chroma)
 *   and the ENVIRONMENT puts 0.02 / 0.09 in the SAME two bins; hueOverlap 0.1834,
 *   12.0% of env chroma inside the hero's +/-30 deg band, and 30% of the loudest
 *   non-player cells across the sweep are wearing it. Cleanest stations remain the ones
 *   dominated by cool steel, which is the contract working.
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
/**
 * `shared.ts` computes this as `ARENA_HALF_DIAGONAL / (1 - FOG_FIRST_CONTACT_S*1000 /
 * MATCH_DURATION_MS)` = 860.23 / (1 - 6/45) = 993, and `match.ts:applyQaSetup` clamps
 * `?fogRadius=` to it. Passing the real maximum is what parks the ring genuinely OFF the
 * map: the furthest corner is 860 wu from centre, so anything below that fogs the
 * corners. This file used to pass 850, which put the fog wall INSIDE the `edge_west`
 * frame and mixed death-zone colour into a "normal play" colour sample. Same class as
 * everything else in this file: a number that was right when it was written (the clock
 * was 180 s and the maximum was 890) and silently stopped being right.
 */
const MAX_SAFE_RADIUS = 993;
const GREASE = { x: 560, y: 900 };
const WATER = { x: 840, y: 100 };
const PLAYER_SIZE = 42;           // rules.ts; the fighter's collision box

/**
 * Every `CoverBox` in `kitchen.ts`, as {x, y, w, h} centre + full extent.
 * MIRRORS `tools/arena.gameplay.json` — `--selftest` asserts it box-for-box, because a
 * hand-copied layout is a second source of truth and this project has been burned by
 * every one it has ever had. **Refreshed for 60c5b92**, which moved every island, every
 * counter, every barrel, both spawns and made the pot solid.
 *
 * Here for TWO reasons, and the second was learned the hard way:
 *  1. `?px=/?py=` write straight into `MatchState`, so a station placed on a prop puts
 *     the player INSIDE it and at the shipped 58 deg pitch a freezer swallows the
 *     character. Four of eighteen stations were in this state after 60c5b92.
 *  2. Legal ground is not the same as REACHABLE ground. Before 60c5b92, `west_lane`,
 *     `west_choke` and `fog_boundary` sat inside sealed pockets — floor no fighter could
 *     ever walk to — so the colour baseline held frames shot from ground the game cannot
 *     produce. Nothing in the old validator could see that, because each station was
 *     legal on its own.
 *
 * `validate()` below tests BOTH and refuses to scan on either.
 */
const COVER = [
  [430, 300, 170, 90], [970, 300, 170, 90], [430, 700, 170, 90], [970, 700, 170, 90],  // stove islands
  [1010, 120, 55, 55], [390, 880, 55, 55],                                             // stacked pots
  [450, 120, 50, 50], [950, 880, 50, 50],                                              // spice carts
  [230, 190, 230, 190], [1170, 810, 230, 190],                                         // freezers
  [1120, 150, 90, 90], [280, 850, 90, 90],                                             // herb crates
  [1230, 140, 80, 80], [170, 860, 80, 80],                                             // tall crates
  [1175, 235, 110, 70], [225, 765, 110, 70],                                           // flour sacks
  // Two of the four moved in e9bb185: (265,330) -> (100,600) and (1135,670) -> (1300,400).
  // (265,330) sat 4.0 wu from the player spawn's collision face, so a player holding W
  // travelled 6.0 wu — one movement step. The selftest below asserts this table box-for-box
  // against tools/arena.gameplay.json, which is what caught the drift; keep it that way.
  [100, 600, 160, 55], [265, 670, 160, 55], [1300, 400, 160, 55], [1135, 330, 160, 55], // prep counters
  [60, 250, 60, 50], [60, 750, 48, 46], [1340, 750, 60, 50], [1340, 250, 48, 46],      // supply barrels
  [700, 830, 150, 70], [700, 170, 150, 70],                                            // fryer / sink
  [700, 500, 104, 104],                                                                // the boiling pot — SOLID since a31bdb4
];
/** Where the AI starts; the flood below runs from here, so "reachable" means
 *  "reachable by a fighter in a real match", not "connected to something". */
const ENEMY_SPAWN = { x: 1240, y: 610 };
/** Clearance a station must keep from every cover box, in world units. `movement.ts`
 *  refuses a step whose destination overlaps, i.e. within `(PLAYER_SIZE + w)/2`, so the
 *  minimum honest clearance is PLAYER_SIZE/2 = 21. This was 18 — LOOSER than the real
 *  collision test, so the guard could pass a station the sim would bury. */
const CLEARANCE = 24;

/** Does a fighter CENTRED here overlap any cover box? Exactly `movement.ts`'s test. */
function coverAt(x, y, pad = 0) {
  for (const [cx, cy, w, h] of COVER) {
    if (Math.abs(x - cx) < PLAYER_SIZE / 2 + w / 2 + pad && Math.abs(y - cy) < PLAYER_SIZE / 2 + h / 2 + pad) {
      return { x: cx, y: cy, w, h };
    }
  }
  return null;
}

/**
 * Flood the legal standing space outward from the enemy spawn on a 4 wu lattice, using
 * the same "diagonals only where both orthogonals are open" rule the nav grid uses.
 * Anything the flood does not touch is a sealed pocket: legal to stand on, impossible
 * to arrive at. Built once, lazily, and it costs ~5 ms.
 */
let REACHABLE = null;
const LATTICE = 4;
function buildReachable() {
  const cols = Math.floor(ARENA_W / LATTICE), rows = Math.floor(ARENA_H / LATTICE);
  const half = PLAYER_SIZE / 2;
  const legal = new Uint8Array(cols * rows);
  for (let gy = 0; gy < rows; gy++) for (let gx = 0; gx < cols; gx++) {
    const x = (gx + 0.5) * LATTICE, y = (gy + 0.5) * LATTICE;
    legal[gy * cols + gx] = (x >= half && x <= ARENA_W - half && y >= half && y <= ARENA_H - half && !coverAt(x, y)) ? 1 : 0;
  }
  const seen = new Uint8Array(cols * rows);
  const q = new Int32Array(cols * rows);
  let h = 0, t = 0;
  const s0 = Math.min(rows - 1, Math.floor(ENEMY_SPAWN.y / LATTICE)) * cols + Math.min(cols - 1, Math.floor(ENEMY_SPAWN.x / LATTICE));
  q[t++] = s0; seen[s0] = 1;
  while (h < t) {
    const c = q[h++], cx = c % cols, cy = (c - cx) / cols;
    for (let oy = -1; oy <= 1; oy++) for (let ox = -1; ox <= 1; ox++) {
      if (!ox && !oy) continue;
      const nx = cx + ox, ny = cy + oy;
      if (nx < 0 || nx >= cols || ny < 0 || ny >= rows) continue;
      const ni = ny * cols + nx;
      if (!legal[ni] || seen[ni]) continue;
      if (ox && oy && (!legal[cy * cols + nx] || !legal[ny * cols + cx])) continue;
      seen[ni] = 1; q[t++] = ni;
    }
  }
  return { cols, rows, seen, legal, nReached: t };
}
function isReachable(x, y) {
  REACHABLE ??= buildReachable();
  const gx = Math.min(REACHABLE.cols - 1, Math.max(0, Math.floor(x / LATTICE)));
  const gy = Math.min(REACHABLE.rows - 1, Math.max(0, Math.floor(y / LATTICE)));
  return !!REACHABLE.seen[gy * REACHABLE.cols + gx];
}

function validate(stations) {
  const bad = [];
  for (const s of stations) {
    if (s.x < 20 || s.x > ARENA_W - 20 || s.y < 20 || s.y > ARENA_H - 20) {
      bad.push(`${s.id} (${s.x},${s.y}) is outside the playfield`);
      continue;
    }
    const box = coverAt(s.x, s.y, CLEARANCE - PLAYER_SIZE / 2);
    if (box) {
      bad.push(`${s.id} (${s.x},${s.y}) sits inside cover box centred (${box.x},${box.y}) ${box.w}x${box.h}`);
      continue;
    }
    if (!isReachable(s.x, s.y)) {
      bad.push(`${s.id} (${s.x},${s.y}) is on SEALED ground — legal to stand on, but no fighter can ever walk there, so no frame shot from it exists in a real match`);
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
  // MOVED with the spawn itself. 60c5b92 took the spawns 110wu off the centre line and
  // this station stayed at y=500, so a station whose entire purpose is "what the player
  // sees at the whistle" was 110wu from where the player actually stands. Cheap to miss,
  // and exactly the class of drift this file is supposed to be immune to.
  { id: 'spawn_west',    x: 160,  y: 390, fog: MAX_SAFE_RADIUS, note: 'THE player spawn (kitchen.ts playerSpawn), looking east down the west lane' },
  // Both of these were INSIDE A SEALED POCKET until 60c5b92 opened the centre line —
  // legal ground that nothing could walk to. Verified reachable by `validate()` now.
  { id: 'west_lane',     x: 340,  y: 500, fog: MAX_SAFE_RADIUS, note: 'primary combat lane: the two west prep counters and the spill decals between them' },
  { id: 'west_choke',    x: 400,  y: 500, fog: MAX_SAFE_RADIUS, note: 'mid-lane, looking east into the hub (the barrels that used to pinch here moved to the far strips in 60c5b92)' },
  // ── the hub. Never centred on the pot. ─────────────────────────────────────
  { id: 'pot_south',     x: 700,  y: 640, fog: MAX_SAFE_RADIUS, note: 'pot 140wu north of the player — hazard in frame, not filling it' },
  { id: 'pot_diagonal',  x: 570,  y: 430, fog: MAX_SAFE_RADIUS, note: 'hub diagonal: the pot, the NW stove island and the west prep counter in one frame' },
  { id: 'hub_north',     x: 700,  y: 320, fog: MAX_SAFE_RADIUS, note: 'north lane mouth: sink counter, both north stove islands, pot rim at the bottom of frame' },
  // ── corners: the four landmark clusters ────────────────────────────────────
  // ── MOVED for 60c5b92. All four of the old positions landed inside a prop that had
  //    been somewhere else when they were chosen: (430,240) in the NW stove island,
  //    (1150,330) and (270,665) in prep counters, (1000,700) in the SE stove island.
  //    Nothing rendered wrong; the camera simply centred on a buried character, and the
  //    frames were measured anyway. That alone manufactured a false colour regression
  //    (cast/env hue overlap read 0.1785 -> 0.2363, while on the 14 legal stations it had
  //    IMPROVED, 0.1742 -> 0.1674). A future colour pass would have chased it.
  { id: 'freezer_nw',    x: 430,  y: 420, fog: MAX_SAFE_RADIUS, note: 'NW corner: walk-in freezer beyond the north-west stove island' },
  { id: 'pantry_ne',     x: 1150, y: 420, fog: MAX_SAFE_RADIUS, note: 'NE pantry cluster: flour sacks and the east prep counter, crates beyond' },
  { id: 'pantry_sw',     x: 400,  y: 800, fog: MAX_SAFE_RADIUS, note: 'SW pantry cluster: herb crate, tall crate, flour sacks, prep counter and stacked pots together' },
  { id: 'freezer_se',    x: 1000, y: 580, fog: MAX_SAFE_RADIUS, note: 'SE quadrant: stove island, east prep counter, walk-in freezer beyond' },
  // ── service counters + decoration density ──────────────────────────────────
  { id: 'fryer_south',   x: 560,  y: 790, fog: MAX_SAFE_RADIUS, note: 'fryer counter, chalkboard, stacked pots, south apron edge' },
  // ── map edge: does the apron hold the frame? ───────────────────────────────
  { id: 'edge_west',     x: 70,   y: 500, fog: MAX_SAFE_RADIUS, note: 'hard west edge — apron/kerb occupies a third of the frame' },
  // ── hazard puddles, approach framing ───────────────────────────────────────
  { id: 'grease_near',   x: GREASE.x - 130, y: GREASE.y - 95, fog: MAX_SAFE_RADIUS, note: 'grease puddle off-centre, as you approach it' },
  { id: 'grease_in',     x: GREASE.x, y: GREASE.y, fog: MAX_SAFE_RADIUS, note: 'STANDING IN the grease puddle — the slowed player read' },
  { id: 'water_near',    x: WATER.x + 130, y: WATER.y + 95, fog: MAX_SAFE_RADIUS, note: 'water puddle off-centre, as you approach it' },
  // ── the closing fog death zone ─────────────────────────────────────────────
  //
  // 🚨 `unstill` — THESE THREE FRAMES ARE NOT STILL WHEN THEY ARE SAMPLED, and it is
  // NOT the arena. Measured `tools/tmp/sc_fogstill.mjs`, pinned at 36ee0a6, one page
  // load per station, `requestAnimationFrame` stubbed exactly as `gl_occl_ab` does it —
  // two captures 220 ms apart with NOTHING touched:
  //
  //     station            rAF frozen    + HUD CSS stilled    HUD hidden
  //     pot_south               0 px            0 px             0 px   <- control
  //     spawn_west              0 px            0 px             0 px   <- control
  //     fog_boundary  10,531-13,073 px          0 px             0 px
  //     fog_inside   471,742-478,143 px         0 px             0 px   <- 33% of frame
  //     fog_late      13,173-14,161 px          0 px             0 px
  //
  // Ranges, because TWO independent runs of the probe were taken and the raw counts are
  // supposed to differ — they sample a 0.6-1.2 s sine at whatever phase the page was in.
  // What does NOT differ is the conclusion: 0 px stilled and 0 px HUD-hidden, both runs,
  // all three stations, with the two control stations at 0 px throughout.
  //
  // 100% of it is `src/ui/hud.ts`'s CSS keyframes — `hud-fogedge-breathe` (a screen-EDGE
  // wash), `hud-zone-alarm` x2, `hud-safearrow-throb` — all `infinite`, all armed by the
  // death zone and by nothing else on the map. **CSS animations run on the document
  // timeline, not on `requestAnimationFrame`**, so every "rAF frozen" probe in this repo
  // is still animating them; and Playwright's `locator('canvas').screenshot()` is a page
  // capture clipped to the canvas box, so they land in every "canvas" PNG. Look at
  // `shots/sc/fogstill/fog_inside_A_raf_mask.png`: a bright vignette ring, the zone pill,
  // the safe arrow, the radar and the weapon slots — and a dead-black arena in the middle.
  //
  // `docs/LESSONS.md`'s "freezing the clock is not freezing the loop", one step further
  // out: **freezing the loop is not freezing the PAGE.**
  //
  // CONSEQUENCE FOR ANY PIXEL-IDENTITY CLAIM: a self-pair, drift control or A/B taken at
  // these three stations without `--still-hud` (or the equivalent — `PAGE_STILL_HUD` in
  // `tools/tmp/sc_fogstill.mjs`) is measuring the HUD's alarm animation. `gl_occl_ab`
  // refused outright here for exactly this reason (1a5b808: self-pair 110,963-472,512 px
  // of 1,440,000 against 0 px at `pot_south`). It was right to refuse.
  //
  // CONSEQUENCE FOR THE COLOUR NUMBERS: none worth acting on, and that is measured too —
  // this file's noise floor says these stations plus `pantry_ne` drift `playerSalience`
  // +/-0.004 and the chroma aggregate <= 0.0001 run to run, ~100x under every tolerance.
  // So `--still-hud` is OFF by default: seeking a keyframe to t=0 is deterministic but
  // BIASED, and a colour baseline wants an unbiased sample of the shipped look.
  { id: 'fog_boundary',  x: 1090, y: 500, fog: 420, unstill: 'hud-css', note: 'safe-zone wall ~30wu ahead of the player' },
  { id: 'fog_inside',    x: 1240, y: 500, fog: 420, unstill: 'hud-css', note: 'standing INSIDE the death zone, 50 HP/s' },
  { id: 'fog_late',      x: 700,  y: 340, fog: 200, unstill: 'hud-css', note: 'late match, ring closed to 200wu around the pot' },
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
  // freeAbove, and the rail's own note is why. It said "adding cool is the cheap lever"
  // while the drift check penalised adding cool — the same self-contradiction envWarmShare
  // shipped with, found the same way: by an agent doing the work the rail discouraged.
  //
  // The two rails are pulled in opposite directions by the same pixels. meanSat is 0.408
  // against a 0.493 target and must RISE; coolChroma is 0.3505 against 0.343 and has already
  // ARRIVED. This arena is ~87% cool chroma, so a global value or saturation change moves
  // both together and NO setting satisfies both. Concretely it cost real work: a measured
  // `contrast` 0.62 -> 0.72 is worth +0.016 of character value range across all eleven
  // characters, and was dropped because it spends 0.016 of coolChroma's entire 0.020 budget.
  //
  // Exceeding the reference on cool chroma is not a defect — LESSONS §8's whole finding is
  // that the reference reserves HUE, keeping a saturated COOL ground so the warm half is
  // free for the cast. The band ceiling (1.5x) still hard-fails, so this is one-sided drift,
  // not an unbounded licence.
  { key: 'coolChroma', label: 'cool chroma 60-360', target: REF.coolChroma, band: [REF.coolChroma * 0.5, REF.coolChroma * 1.5],
    tol: 0.020, kind: 'chosen band, freeAbove', freeAbove: true,
    note: 'adding cool is the cheap lever — LESSONS §8. Above target is free; the band ceiling still applies.' },
  { key: 'meanChroma', label: 'mean chroma', target: REF.chroma, band: [REF.chroma * 0.5, REF.chroma * 1.5],
    tol: 0.020, kind: 'chosen band', note: 'max-min per pixel; the raw colourfulness of the frame' },
  { key: 'warmShare', label: 'warm share of chroma', target: REF.warmShare, band: [0.12, 0.45],
    tol: 0.030, kind: 'chosen band', note: 'the reference reserves the warm half for the cast' },
  // CEILING-ONLY, and the target is 0 deliberately — see below.
  //
  // This rail shipped with `target: REF.warmShare`, which made the DIRECTIONAL drift
  // check treat 0.297 as a value to move TOWARD. That is backwards: 0.297 is the
  // reference's WHOLE-FRAME warm share *including its cast*, so it is the point above
  // which an environment alone is out of contract — a ceiling, exactly as the note said.
  //
  // The bug was not theoretical. On the shipped frame this rail reads 0.1226 while
  // `envShareInCastBand` reads 0.1244 — the same quantity, differing only by the 60-90
  // deg bin, which this arena measures at 0.00 — with OPPOSITE targets (0.297 vs 0).
  // No arena can satisfy both, and the pair mathematically floored the headline metric
  // at ~0.16 whatever the art did. So the instrument was penalising the precise move a
  // blind critic prescribed and the hue-reservation contract requires: vacating warm
  // hue from the environment so the cast can own it.
  //
  // Target 0 matches `envShareInCastBand` below and the contract itself — the ideal
  // environment warm share under hue reservation IS zero. The band keeps 0.297 as the
  // hard ceiling, so going ABOVE it still fails. LESSONS §13: validate the instrument.
  { key: 'envWarmShare', label: 'ENV warm share', target: 0, band: [0.0, REF.warmShare],
    tol: 0.030, kind: 'derived (ceiling-only)', role: true,
    note: 'CEILING 0.297 = the reference whole-frame warm share INCLUDING its cast; an environment alone above it is out of contract. Lower is always better — warm is reserved for the cast.' },
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
  // freeAbove, for the SAME reason its whole-frame twin `coolChroma` above is — this is
  // the identical quantity measured HUD-free, and shipping one half of a pair with the
  // one-sided flag and the other without makes them return OPPOSITE verdicts on the
  // identical directional move. Caught on the arena value lift (commit ce49cd3): in one
  // run `coolChroma` 0.389 -> 0.4234 read `ok` while `arenaCoolChroma` 0.3959 -> 0.4373
  // read REGRESSION.
  //
  // This is the THIRD instance of this exact shape in this file, and the first two are
  // documented a few lines up: `coolChroma` itself shipped without `freeAbove` and cost a
  // measured `contrast` 0.62 -> 0.72 that was dropped for spending 0.016 of a 0.020
  // budget; `envWarmShare` shipped with a ceiling as its drift target. Commit 8a91f7c is
  // literally titled "a SECOND arena-scan rail punished the move its own note recommends".
  // Both fixes were applied to one rail of a pair and not to its twin.
  //
  // ⚠️ Declared conflict of interest: this removes one of the two baseline regressions
  // that ce49cd3's own change produced. It is committed separately from that change, and
  // ce49cd3's message quotes the RAW numbers, so the arena result can be judged with this
  // reverted. The other regression there (`playerRankMedian` 19.5 -> 31) is real and is
  // NOT touched.
  { key: 'arenaCoolChroma', label: '(arena only) cool chroma', target: REF.coolChroma, band: [REF.coolChroma * 0.5, REF.coolChroma * 1.5],
    tol: 0.020, kind: 'HUD-free, advisory, freeAbove', role: true, advisory: true, freeAbove: true,
    note: 'the HUD-free twin of coolChroma; one-sided for the same reason — LESSONS §8' },
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
  console.log('id                x     y     fogRadius  still?      note');
  for (const s of STATIONS) {
    console.log(`${s.id.padEnd(16)} ${String(s.x).padEnd(5)} ${String(s.y).padEnd(5)} ${String(s.fog).padEnd(10)} ${(s.unstill ? `NOT(${s.unstill})` : 'still').padEnd(11)} ${s.note}`);
  }
  const un = STATIONS.filter((s) => s.unstill);
  if (un.length) {
    console.log(`\n  ⚠ ${un.length} station(s) are NOT STILL when sampled: ${un.map((s) => s.id).join(', ')}`);
    console.log('    Their frames move between two captures with nothing touched — up to 33% of the');
    console.log('    frame — because the DOM HUD\'s CSS keyframes do not stop when rAF is stubbed.');
    console.log('    NO PIXEL-IDENTITY CLAIM MAY BE QUOTED FROM THEM without --still-hud. The colour');
    console.log('    numbers are unaffected (drift <= 0.0001, ~100x under tolerance). See STATIONS.');
  }
  process.exit(0);
}

/**
 * Where to measure — and it must NEVER be guessed silently.
 *
 * `PREVIEW_BASE` was missing from this chain. `tools/tmp/with_snapshot.mjs` injects
 * exactly that variable into every child it runs, so the canonical "measure a frozen
 * snapshot" idiom —
 *
 *     node tools/tmp/with_snapshot.mjs -- node tools/arena-scan.mjs ...
 *
 * — silently fell through to the hardcoded `localhost:5187` and measured **whatever
 * happened to be listening on that port**. During a six-agent fan-out that is another
 * agent's tree, or a stale leaked server from hours ago. The run succeeds, writes a
 * SUMMARY, and reports confident numbers about a build nobody asked about.
 *
 * That is `docs/LESSONS.md` §5 with the contamination inside the instrument rather than
 * in the tree: a tool that is 90% snapshot-isolated invites you to trust the 10% that
 * is not.
 *
 * The default is kept for the documented "run your own vite on 5187" workflow, but it is
 * now ANNOUNCED. A measurement tool may pick a default; it may not pick one quietly.
 */
const BASE = args.url ?? process.env.PREVIEW_BASE ?? process.env.SCAN_BASE ?? 'http://localhost:5187';
if (!args.url && !process.env.PREVIEW_BASE && !process.env.SCAN_BASE && !args.list && !args.selftest) {
  console.warn(`\n  ⚠ no --url, PREVIEW_BASE or SCAN_BASE — falling back to ${BASE}`);
  console.warn('    If you meant to measure a snapshot, this is measuring something else.\n');
}
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
/**
 * Pause the DOM HUD's CSS keyframes before capturing. OFF by default — see the
 * `unstill` block in STATIONS for the measurement and for why the default is off.
 *
 * Kept as an inline copy of `tools/tmp/sc_fogstill.mjs`'s `PAGE_STILL_HUD` rather than
 * an import, for the same reason the COVER table is inlined: this file must keep working
 * when `tools/tmp` is mid-edit by another agent, and a gate that imports a scratch probe
 * inherits its owner. The two are asserted equivalent by neither — say so out loud
 * rather than imply a link that is not checked.
 */
const STILL_HUD = !!args['still-hud'];
const PAGE_STILL_HUD = () => {
  const s = document.createElement('style');
  s.id = 'sc-still';
  s.textContent = '*,*::before,*::after{animation-play-state:paused!important;'
                + 'transition:none!important;caret-color:transparent!important}';
  document.head.appendChild(s);
  for (const a of document.getAnimations()) { try { a.currentTime = 0; a.pause(); } catch { /* finished */ } }
  return document.getAnimations().filter((a) => a.playState === 'running').length;
};

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
    /**
     * The same guard, one level stronger — and the level that actually mattered.
     *
     * `stationIds` catches `--only` being compared against a full sweep. It does NOT
     * catch the failure that produced a false regression on 2026-08-05: the station IDs
     * were identical while four of them had MOVED, because the arena layout had moved
     * under them and the old coordinates now sat inside props. Same names, different
     * ground, silently compared, and the resulting 0.1785 -> 0.2363 hue-overlap "drift"
     * was an artefact of four buried characters.
     *
     * So the identity of a sweep is (id, x, y, fogRadius) for every station, not the
     * names. Any change to any of them makes the baseline incomparable and the gate says
     * so instead of printing a verdict.
     */
    stationKeys: ok.map((r) => {
      const s = STATIONS.find((z) => z.id === r.id);
      return s ? `${s.id}@${s.x},${s.y}/fog${s.fog}` : `${r.id}@?`;
    }),
    values, binChromaAll: binsAll.map((v) => +v.toFixed(5)),
    castBinShare: castBins.map((v) => +v.toFixed(4)),
    envBinShare: envBins.map((v) => +v.toFixed(4)),
    topCellsInCastBand: withRole.length
      ? +(mean(withRole.map((r) => r.metrics.topOther.filter((t) => t.inCastBand).length)) / 3).toFixed(3)
      : null,
  };
}

/**
 * Is this run comparable to that baseline AT ALL? Returns an explanatory message, or
 * null when the two sweeps sampled the same 18 points of the same arena.
 *
 * A named function rather than four lines inline, because a guard nobody can call is a
 * guard nobody can test, and this one exists precisely because an untested assumption
 * ("same station names means same sample") produced a confident false regression.
 * `--selftest` exercises it on the real shapes.
 */
function baselineIdentityError(base, now) {
  const bk = base.stationKeys, nk = now.stationKeys;
  if (!bk || !nk) return null;                     // one side predates the field
  if (bk.join(',') === nk.join(',')) return null;
  const byId = (list, id) => list.find((k) => k.startsWith(`${id}@`)) ?? '(absent)';
  const ids = [...new Set([...bk, ...nk].map((k) => k.split('@')[0]))];
  const moved = ids.filter((id) => byId(bk, id) !== byId(nk, id));
  return [
    'names the same stations but they are NOT IN THE SAME PLACE:',
    ...moved.map((id) => `  ${id}: baseline ${byId(bk, id)}  ->  now ${byId(nk, id)}`),
    'A station that moved is a different sample of the arena, so the difference would',
    'read as a colour regression that is really a different viewpoint. That has happened',
    'once already (2026-08-05: four stations left inside props by a layout change).',
    'Re-baseline deliberately with --json, and say in the commit which SHA it is.',
  ].join('\n');
}

// ─────────────────────────────────────────────────────────────────────────────
// PROVENANCE — "which tree was this measured on", recorded BY THE TOOL.
//
// 🚨 A BASELINE IS ITSELF A MEASUREMENT (docs/AGENT-BRIEF.md §7), and this one spent
// six days manufacturing a regression nobody could attribute.
//
// `tools/scan/colour-baseline.json` was taken at `3dcbc9a` on 2026-08-05. By 2026-08-11
// HEAD was 238 commits ahead, 104 of them touching `src/` (+32,898 lines). Every run of
// `--baseline` in between fired exactly one row — `player salience rank (median)
// 19.5 -> 31, REGRESSION` — and it fired IDENTICALLY ON BOTH ARMS OF A HEAD-TO-HEAD
// DRIFT CONTROL (1a5b808 re-established it on a pinned ref containing none of the
// change under test). It was never a regression. It was the stored reference being six
// days old, and three separate agents in one night were told to disregard the line.
// A gate that always fires is a gate that gets switched off — the same failure mode
// `compareBaseline`'s DIRECTIONAL rule was written to avoid, arriving through the
// reference instead of through the rule.
//
// The old file DID carry a hand-written `sha` field. It was correct and it was useless,
// because nothing wrote it (an agent added it by hand after the fact) and nothing read
// it. So both halves are mechanical now: the tool RECORDS what it measured, and
// `--baseline` READS it back and says how far the tree has moved since.
//
// ⚠️ Provenance is REPORTED, never gated on, and it must never soften a verdict. The
// fault was a wrong reference, not a tight check — widening a tolerance here would hide
// the next real regression instead of the last fake one.
// ─────────────────────────────────────────────────────────────────────────────
function git(...a) {
  try {
    return execFileSync('git', a, { encoding: 'utf8', stdio: ['ignore', 'pipe', 'ignore'] }).trim();
  } catch { return ''; }
}

/**
 * What tree did this run actually measure?
 *
 * The ONLY authoritative answer comes from whatever served the URL, which is why
 * `tools/tmp/headserve.mjs` exports `HEADSERVE_SHA`. Asking git for `HEAD` here is a
 * GUESS: it describes this checkout at the moment the sweep FINISHED, and a full sweep
 * takes ~25 minutes during which peers push. That exact gap is what 1a5b808 unpicked.
 * So the trust level is recorded next to the sha, never merged into it.
 */
function scanProvenance() {
  const mode = process.env.HEADSERVE_MODE || '';
  const served = (process.env.HEADSERVE_SHA || '').trim();
  const overlay = (process.env.HEADSERVE_OVERLAY || '').split(',').filter(Boolean);
  const headNow = git('rev-parse', 'HEAD');
  const srcDirty = git('status', '--porcelain', '--', 'src').split('\n').filter(Boolean).length;

  let sha = served, trust = 'served', why = `tools/tmp/headserve.mjs archived this commit and served it at ${BASE}`;
  if (mode === 'worktree') {
    sha = ''; trust = 'worktree';
    why = 'headserve --worktree: a WORKING TREE, not a commit. Not reproducible; do not store as a baseline.';
  } else if (!served) {
    sha = headNow; trust = 'assumed';
    why = 'NO HEADSERVE_SHA — this is `git rev-parse HEAD` in this checkout, which is a GUESS about what '
        + `${BASE} was serving. Re-run under \`node tools/tmp/headserve.mjs --ref <sha> --\` to record it for real.`;
  }
  if (overlay.length) {
    trust = 'served+overlay';
    why = `headserve served ${served.slice(0, 7)} PLUS live working-tree ${overlay.join(', ')} — `
        + 'the measured tree is NOT that commit. Valid as an A/B arm, invalid as a stored baseline.';
  }
  return {
    sha, shaShort: sha ? sha.slice(0, 7) : '', trust, why,
    overlay, headAtWrite: headNow,
    srcDirtyFiles: srcDirty,
    // Recorded because a stilled run and an unstilled one are DIFFERENT SAMPLES of the
    // same tree, and the difference lands on `playerRankMedian` (see the floor block in
    // the header). `--baseline` refuses to compare across the two silently.
    stillHud: STILL_HUD,
    // The OTHER way a baseline goes stale: the instrument moved under it. A stored
    // number is only comparable to a number the same code produced.
    tool: {
      path: 'tools/arena-scan.mjs',
      blob: git('hash-object', 'tools/arena-scan.mjs'),
      committed: git('hash-object', 'tools/arena-scan.mjs') === git('rev-parse', 'HEAD:tools/arena-scan.mjs'),
    },
    generated: new Date().toISOString(),
  };
}

/**
 * How far has the tree moved since that baseline was taken? Returns null when the
 * question cannot be asked (no recorded sha, or the sha is not in this repo).
 *
 * `srcCommits` is the number that matters: `arena-scan` measures rendered pixels, so a
 * baseline is stale exactly when `src/` moved under it. Doc-only commits do not.
 */
function baselineStaleness(base) {
  const p = base.provenance ?? {};
  const sha = p.sha || base.sha || '';                     // `base.sha` = the hand-written legacy field
  if (!sha) return { sha: '', known: false, why: 'the baseline records NO commit — it predates provenance' };
  // `cat-file -e` communicates through its EXIT CODE and prints nothing, so `git()`
  // returns '' for both outcomes and testing it would be a tautology. rev-parse prints.
  if (git('rev-parse', '--verify', '--quiet', `${sha}^{commit}`) === '') {
    return { sha, known: false, why: 'the recorded commit is not in this repository' };
  }
  const n = (spec, path) => {
    const out = path ? git('rev-list', '--count', spec, '--', path) : git('rev-list', '--count', spec);
    return out === '' ? null : Number(out);
  };
  return {
    sha, shaShort: sha.slice(0, 7), known: true,
    trust: p.trust ?? '(legacy: hand-written, unverified)',
    generated: p.generated ?? base.generated ?? '(unrecorded)',
    commits: n(`${sha}..HEAD`), srcCommits: n(`${sha}..HEAD`, 'src'),
    toolMoved: p.tool?.blob ? p.tool.blob !== git('hash-object', 'tools/arena-scan.mjs') : null,
  };
}

/**
 * SAME TREE, DIFFERENT SAMPLE. A `--still-hud` run and a bare one disagree on
 * `playerRankMedian` by ~1.5 places for reasons that have nothing to do with the arena,
 * so comparing across the two is a rubric mismatch — the class of error CLAUDE.md rule 7
 * bans for critic scores, arriving here through a CLI flag instead.
 *
 * A named function rather than four lines inline, for the reason `baselineIdentityError`
 * gives: a guard nobody can call is a guard nobody can test. `--selftest` exercises it.
 * Returns a printable message, or null when the two runs are comparable.
 */
function stillHudMismatch(base, nowStill) {
  const wasStill = base.provenance?.stillHud;
  if (wasStill === undefined) return '  (baseline predates the stillHud flag — assuming it was taken WITHOUT --still-hud)';
  if (!!wasStill === !!nowStill) return null;
  return [
    `\n  🚨 MISMATCH: the baseline was taken ${wasStill ? 'WITH' : 'WITHOUT'} --still-hud and this run is ${nowStill ? 'WITH' : 'WITHOUT'} it.`,
    '     These are different samples of the same tree. `playerRankMedian` alone moves',
    '     ~1.5 places between them, entirely from fog_inside. Re-run with the flag set the',
    '     same way, or re-baseline; do not read the rows below as a comparison.',
  ].join('\n');
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
    // `freeAbove` rails treat EXCEEDING the target as free: only movement below it is drift.
    // The band's ceiling still applies, so this is a one-sided DRIFT rule, not a blank cheque.
    const onFreeSide = rail.freeAbove === true && n >= rail.target;
    let verdict = 'ok', why = '';
    if (!onFreeSide && dn > db + rail.tol) { verdict = 'REGRESSION'; why = `drifted ${(dn - db).toFixed(4)} further from ${rail.target} (tol ${rail.tol})`; }
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
  // envWarmShare is CEILING-ONLY. It shipped with target 0.297, which made vacating warm
  // hue from the environment — the move the hue-reservation contract requires, and the one
  // a blind critic explicitly prescribed — register as a REGRESSION. It also contradicted
  // envShareInCastBand, which measures nearly the same quantity with target 0, and the pair
  // floored that headline metric at ~0.16 whatever the art did. These two lock the fix.
  check('env warm share 0.20 -> 0.12 (vacating the cast band — the CONTRACT)', verdictFor(agg({}), agg({ envWarmShare: 0.12 }), 'envWarmShare'), 'ok');
  check('env warm share 0.20 -> 0.00 (fully vacated, however large the move)', verdictFor(agg({}), agg({ envWarmShare: 0.0 }), 'envWarmShare'), 'ok');
  // coolChroma is freeAbove. Its note says "adding cool is the cheap lever" and its drift
  // check used to punish exactly that — the envWarmShare bug in a second rail. These four
  // pin both sides: above target is free however far (until the band), below target still
  // regresses, and the band ceiling is untouched.
  check('cool chroma 0.343 -> 0.380 (above target — the cheap lever)', verdictFor(agg({ coolChroma: 0.343 }), agg({ coolChroma: 0.380 }), 'coolChroma'), 'ok');
  check('cool chroma 0.350 -> 0.366 (the contrast 0.72 case, was a REGRESSION)', verdictFor(agg({ coolChroma: 0.350 }), agg({ coolChroma: 0.366 }), 'coolChroma'), 'ok');
  check('cool chroma 0.343 -> 0.300 (BELOW target past tol — still regresses)', verdictFor(agg({ coolChroma: 0.343 }), agg({ coolChroma: 0.300 }), 'coolChroma'), 'REGRESSION');
  check('cool chroma 0.343 -> 0.530 (breaches the 1.5x band ceiling)', verdictFor(agg({ coolChroma: 0.343 }), agg({ coolChroma: 0.530 }), 'coolChroma'), 'REGRESSION');
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

  // ── F. the station guard ───────────────────────────────────────────────────
  // Added after the layout moved under the station list and four of eighteen frames were
  // measured from inside a prop — producing a false 0.1785 -> 0.2363 hue-overlap
  // "regression" that a colour agent would have chased. The guard is only worth having
  // if it is itself proven on inputs whose answer is known, so: three synthetic stations
  // whose verdicts are derivable from the COVER table by hand, then the real list.
  console.log('\nF. station placement guard — legal AND reachable ground');
  {
    // The hand-copied COVER table is a SECOND SOURCE OF TRUTH for the layout, which is
    // the exact shape of bug that put four stations inside props. Assert it against the
    // browser dump box-for-box so it can never drift again silently.
    let dump = null;
    try { dump = JSON.parse(await readFile(resolve('tools/arena.gameplay.json'), 'utf8')); } catch { /* absent */ }
    if (dump) {
      const mine = COVER.map(([x, y, w, h]) => `${x},${y},${w}x${h}`).sort().join('|');
      const theirs = dump.cover.map((c) => `${c.x},${c.y},${c.w}x${c.h}`).sort().join('|');
      check('COVER matches tools/arena.gameplay.json box-for-box', mine === theirs, true);
      check('COVER has the same number of boxes as the dump', COVER.length, dump.cover.length);
      check('ENEMY_SPAWN matches the dump', `${ENEMY_SPAWN.x},${ENEMY_SPAWN.y}`, `${dump.enemySpawn.x},${dump.enemySpawn.y}`);
      check('MAX_SAFE_RADIUS matches the dump', MAX_SAFE_RADIUS, dump.maxSafeRadius);
    } else {
      console.log('  ⚠ tools/arena.gameplay.json absent — cross-check skipped');
    }

    // Derived by hand from COVER: the NW stove island is [430,300,170,90], so a fighter
    // centred at (430,300) overlaps it by its whole extent.
    check('a station on the NW stove island centre is rejected',
      validate([{ id: 't', x: 430, y: 300 }]).length, 1);
    // 300 + 45 (half height) + 21 (half fighter) + 24 (clearance) = 390. 420 clears it.
    check('the verified replacement 60wu clear of that island is accepted',
      validate([{ id: 't', x: 430, y: 420 }]).length, 0);
    check('a station outside the playfield is rejected',
      validate([{ id: 't', x: 5, y: 500 }]).length, 1);
    // The flood is what catches sealed ground. Prove it finds SOMETHING and that the
    // arena is currently one piece: every legal lattice node must be reachable.
    const R = buildReachable();
    const nLegal = R.legal.reduce((a, b) => a + b, 0);
    check('the walkable floor is ONE piece (no sealed pockets)', R.nReached, nLegal);
    check('the flood actually visited most of the map', R.nReached > nLegal * 0.99, true);
    // And a point inside a prop is by construction not reachable, so the two tests are
    // not the same test wearing two hats.
    check('a point inside the freezer is not reachable', isReachable(230, 190), false);

    // The baseline-identity guard, exercised through the REAL function, on the real
    // failure: the four stations 60c5b92 left inside props, with their IDs unchanged.
    {
      const keyed = (list) => ({ stationIds: list.map((k) => k.split('@')[0]), stationKeys: list });
      const now = keyed(STATIONS.map((s) => `${s.id}@${s.x},${s.y}/fog${s.fog}`));
      check('a baseline of THIS station set is comparable', baselineIdentityError(now, now), null);

      const stale = keyed(STATIONS.map((s) => {
        const old = { freezer_nw: [430, 240], pantry_ne: [1150, 330], pantry_sw: [270, 665], freezer_se: [1000, 700], spawn_west: [160, 500] }[s.id];
        return old ? `${s.id}@${old[0]},${old[1]}/fog850` : `${s.id}@${s.x},${s.y}/fog850`;
      }));
      const err = baselineIdentityError(stale, now);
      check('the PRE-60c5b92 baseline is refused, not compared', typeof err === 'string' && err.includes('NOT IN THE SAME PLACE'), true);
      check('...and it names freezer_nw as one of the moved stations', !!err && err.includes('freezer_nw@430,240'), true);
      check('...and the ID lists alone would have matched, so stationIds could not catch it',
        stale.stationIds.join(',') === now.stationIds.join(','), true);
      check('a baseline that predates stationKeys is not falsely refused',
        baselineIdentityError({ stationIds: now.stationIds }, now), null);
      // One station moved a single world unit is still a different sample.
      const nudged = keyed(now.stationKeys.map((k, i) => (i === 3 ? k.replace(/@(\d+),(\d+)/, (m, a, b) => `@${a},${Number(b) + 1}`) : k)));
      check('a ONE-WU move is enough to make a sweep incomparable',
        typeof baselineIdentityError(nudged, now) === 'string', true);
    }

    const bad = validate(STATIONS);
    check('every shipped station is on legal, reachable ground', bad.length, 0);
    if (bad.length) bad.forEach((m) => console.log(`      ${m}`));
    check('the four moved stations are where 60c5b92 needs them',
      STATIONS.filter((s) => ['freezer_nw', 'pantry_ne', 'pantry_sw', 'freezer_se'].includes(s.id))
        .map((s) => `${s.id}@${s.x},${s.y}`).sort().join(' '),
      'freezer_nw@430,420 freezer_se@1000,580 pantry_ne@1150,420 pantry_sw@400,800');
    // The three that were sealed before 60c5b92. Named explicitly so re-sealing the
    // centre line can never quietly restore the old defect.
    for (const id of ['west_lane', 'west_choke', 'fog_boundary']) {
      const s = STATIONS.find((z) => z.id === id);
      check(`${id} (sealed before 60c5b92) is reachable`, isReachable(s.x, s.y), true);
    }
  }

  // ── PROVENANCE, exercised on the exact shapes that produced the six-day fake
  //    regression. Every check below has a KNOWN-BAD input it must FAIL on; a guard
  //    that has not been shown to fail is not a guard (CLAUDE.md rule 6).
  console.log('\nD2. provenance: the tool records WHICH TREE it measured, and reads it back');
  {
    const save = { m: process.env.HEADSERVE_MODE, s: process.env.HEADSERVE_SHA, o: process.env.HEADSERVE_OVERLAY };
    const set = (m, s, o) => {
      if (m == null) delete process.env.HEADSERVE_MODE; else process.env.HEADSERVE_MODE = m;
      if (s == null) delete process.env.HEADSERVE_SHA; else process.env.HEADSERVE_SHA = s;
      if (o == null) delete process.env.HEADSERVE_OVERLAY; else process.env.HEADSERVE_OVERLAY = o;
    };
    const FAKE = 'a'.repeat(40);

    set('ref', FAKE, '');
    const served = scanProvenance();
    check('a headserve-served run records the SERVED sha, not this checkout\'s HEAD', served.sha, FAKE);
    check('...and marks it trust=served', served.trust, 'served');

    // KNOWN-BAD 1 — the state EVERY run was in before headserve exported anything, and
    // the state that let a hand-written sha go unchecked for six days. It must not be
    // allowed to look identical to a served run.
    set(null, null, null);
    const guessed = scanProvenance();
    check('KNOWN-BAD no HEADSERVE_SHA: the sha is marked ASSUMED, not served', guessed.trust, 'assumed');
    check('...and it says out loud that it is a guess about what the URL served',
      /GUESS/.test(guessed.why), true);
    check('...and it is NOT silently equal to a served run\'s trust level', guessed.trust === served.trust, false);

    // KNOWN-BAD 2 — an overlay arm. Legal as an A/B arm, INVALID as a stored baseline,
    // because the tree served is the commit plus somebody's uncommitted file.
    set('ref', FAKE, 'src/characters/rig.ts');
    const ovl = scanProvenance();
    check('KNOWN-BAD --overlay: the run does NOT claim to be that commit', ovl.trust, 'served+overlay');
    check('...and names the overlaid path', ovl.overlay.join(','), 'src/characters/rig.ts');

    // KNOWN-BAD 3 — --worktree. Not a commit at all.
    set('worktree', '', '');
    const wt = scanProvenance();
    check('KNOWN-BAD --worktree: no sha is claimed', wt.sha, '');
    check('...and it is flagged as not reproducible', /not reproducible/i.test(wt.why), true);
    set(save.m, save.s, save.o);

    // ── STALENESS. The 2026-08-05 baseline vs 2026-08-11 HEAD is the known-bad input:
    //    same station set, same rails, same tool — and one row fires anyway.
    const head = git('rev-parse', 'HEAD');
    check('a baseline taken at HEAD reports 0 src/ commits behind',
      baselineStaleness({ provenance: { sha: head } }).srcCommits, 0);
    // KNOWN-BAD the real shape: a baseline taken before a src/ commit landed. Derived
    // rather than hardcoded (the real case was `3dcbc9a`, 238 commits and 104 src/
    // commits behind HEAD on 2026-08-11) so the check does not rot into a SKIP the day
    // that sha ages out of a shallow clone — and so its COUNT is stable, which
    // `gatecount` reads.
    const prevSrc = git('rev-list', '--max-count=1', '--skip=1', 'HEAD', '--', 'src');
    const s = baselineStaleness({ provenance: { sha: prevSrc } });
    check('KNOWN-BAD a baseline older than the last src/ commit is seen as BEHIND HEAD', s.srcCommits > 0, true);
    check('...and the ancestor case is not confused with the descendant case',
      baselineStaleness({ provenance: { sha: head } }).srcCommits < s.srcCommits, true);
    // The LEGACY shape: `sha` at the top level, hand-written, no `provenance` block.
    // It must still be read rather than reported as "no commit recorded".
    check('a legacy hand-written top-level `sha` is still read', baselineStaleness({ sha: head }).known, true);
    check('...and is labelled as unverified rather than as trust=served',
      /legacy/i.test(baselineStaleness({ sha: head }).trust), true);
    // KNOWN-BAD 4 — a baseline with no sha at all, and one whose sha is not in the repo.
    check('KNOWN-BAD a baseline with NO recorded commit cannot be assessed', baselineStaleness({}).known, false);
    check('KNOWN-BAD an unknown commit is refused, not treated as up to date',
      baselineStaleness({ provenance: { sha: 'f'.repeat(40) } }).known, false);
    // The run records whether it stilled the HUD, because a stilled sweep and an
    // unstilled one disagree on playerRankMedian by ~1.5 places on the SAME tree.
    check('the run records whether --still-hud was applied', scanProvenance().stillHud, STILL_HUD);
    // KNOWN-BAD both ways round, plus BOTH positive controls — a checker that always
    // screamed would otherwise "pass" every refusal test here.
    const mm = (was, now) => stillHudMismatch({ provenance: { stillHud: was } }, now);
    check('KNOWN-BAD stilled baseline vs unstilled run is refused', /MISMATCH/.test(mm(true, false) ?? ''), true);
    check('KNOWN-BAD unstilled baseline vs stilled run is refused', /MISMATCH/.test(mm(false, true) ?? ''), true);
    check('CONTROL both unstilled compares silently', mm(false, false), null);
    check('CONTROL both stilled compares silently', mm(true, true), null);
    check('a baseline predating the flag is not falsely refused',
      /MISMATCH/.test(stillHudMismatch({ provenance: {} }, false) ?? ''), false);
    check('...and the shipped baseline records the flag, so that branch is not live',
      JSON.parse(await readFile('tools/scan/colour-baseline.json', 'utf8')).provenance?.stillHud, false);
  }

  // ── The three stations that are NOT STILL when sampled. Asserted here so that
  //    deleting the flag, or adding a fourth death-zone station without it, is a gate
  //    failure rather than a silent return to quoting a 33%-of-frame self-pair.
  console.log('\nD3. the non-still stations are declared, and the declaration matches the cause');
  {
    const un = STATIONS.filter((s) => s.unstill).map((s) => s.id).sort().join(',');
    check('exactly the three fog stations are flagged unstill', un, 'fog_boundary,fog_inside,fog_late');
    check('...and the flag names the CAUSE, not just "noisy"',
      STATIONS.filter((s) => s.unstill).every((s) => s.unstill === 'hud-css'), true);
    // The cause is "the HUD alarm is armed", and the HUD alarm is armed by standing at or
    // outside the safe radius. So the flag must track the GEOMETRY, not a hand-kept list:
    // any station whose fog radius is small enough to arm the zone readout is unstill.
    const armed = (s) => s.fog < MAX_SAFE_RADIUS;
    check('KNOWN-BAD every station with a live (non-parked) fog ring is flagged',
      STATIONS.filter(armed).every((s) => !!s.unstill), true);
    check('...and no station with the ring parked off the map is flagged',
      STATIONS.filter((s) => !armed(s)).some((s) => !!s.unstill), false);
  }

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

  // Validate the WHOLE list, not `jobs`. `--only` is how a colour agent re-checks two
  // stations after a change, and a subset filter must never be able to hide a station
  // that the next full sweep will silently measure from inside a freezer.
  const invalid = validate(STATIONS);
  if (invalid.length) {
    console.error('STATION PLACEMENT IS INVALID — refusing to scan. Every frame below would be');
    console.error('shot from ground the game cannot put a player on, and would be measured anyway:');
    invalid.forEach((m) => console.error(`  ${m}`));
    console.error('\nPick replacements with:  node tools/tmp/station_audit.mjs --at <x>,<y>');
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

        // ── the LIVE half of the placement guard ───────────────────────────
        // `validate()` above runs against this file's hand-copied COVER table, which is a
        // second source of truth and therefore exactly the thing that failed last time
        // (the layout moved, the table did not, four stations ended up inside props and
        // were measured anyway). `match.ts:checkQaSpawn` is the FIRST source: it tests
        // the same point against the arena the game actually built. If they ever
        // disagree, the game wins and this run stops — a frame shot from inside a
        // freezer must be a loud error, never a silently-measured sample.
        const insideCover = await page.evaluate(() => window.__matchDebug?.qaSpawnInsideCover ?? null);
        if (insideCover) {
          console.error(`\n✗ ${s.id} (${s.x},${s.y}): the RUNNING GAME reports the player inside cover — ${insideCover}`);
          console.error('  This file\'s COVER table says otherwise, so the table is stale. Refresh it from');
          console.error('  tools/arena.gameplay.json (--selftest asserts the two agree) and re-site the station.');
          await page.close();
          process.exit(2);
        }

        // ── OPTIONAL: still the HUD's CSS keyframes before any capture. See STATIONS'
        //    `unstill` block. VERIFIED, not assumed: `PAGE_STILL_HUD` returns the number
        //    of animations STILL running afterwards, and a non-zero answer is announced.
        //    A stylesheet that failed to apply is indistinguishable from a still page.
        let stillLeft = null;
        if (STILL_HUD) {
          stillLeft = await page.evaluate(PAGE_STILL_HUD);
          await page.waitForTimeout(150);
          if (stillLeft) console.error(`  ⚠ ${s.id}: --still-hud left ${stillLeft} animation(s) RUNNING. This frame is not still.`);
        }

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
        // `...s` carries the station's own `unstill` flag straight into metrics.json, so
        // a later reader of the JSON alone can tell a non-still station from a still one.
        results.push({ ...s, url, view, ok: true, errors, matte, metrics: clean, stillHud: STILL_HUD ? { applied: true, animationsLeft: stillLeft } : false });

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

  // A sweep that measured NOTHING must not look like a sweep that measured everything.
  // Reported after an arena pass: "a run where every station failed still exited 0 and
  // wrote a SUMMARY". Whatever the path, the guard is one line and the failure mode —
  // a confident-looking SUMMARY.txt built from zero frames — is exactly the kind this
  // project keeps paying for. Loud and early beats a plausible artefact.
  if (!okResults.length) {
    console.error(`\n✗ every station failed (${failures} of ${results.length}). Nothing was measured.`);
    console.error(`  Base URL was ${BASE} — check it is serving the tree you meant.`);
    process.exit(2);
  }

  const agg = aggregate(results);
  const rails = agg ? railStatus(agg) : [];

  const prov = scanProvenance();
  const report = {
    // FIRST key in the file on purpose: the next reader must not have to scroll 5,800
    // lines of station data to find out which tree this describes.
    provenance: prov,
    base: BASE, viewport: [W, H], player: PLAYER, enemy: ENEMY, simSpeed: SIM_SPEED,
    generated: prov.generated,
    reference: REF, aggregate: agg, rails, stations: results,
  };
  await writeFile(join(OUT, 'metrics.json'), JSON.stringify(report, null, 2));
  if (JSON_OUT) {
    await mkdir(dirname(resolve(JSON_OUT)), { recursive: true });
    // ── A RE-BASELINE MUST NOT ERASE THE RECORD OF WHAT THE LAST ONE HID.
    //    `bakedInRegressions` is editorial by nature — it is the human sentence "this
    //    baseline makes X invisible" — and `src/render/stage.ts` cross-references it by
    //    name. It was therefore hand-maintained, and a re-baseline silently dropped it.
    //    So the HISTORY half is mechanical now (copied, never invented) and only the new
    //    editorial line is left to a human, with a loud reminder that it is missing.
    //    docs/LESSONS.md §13: a green gate must not be mistaken for a healthy rail.
    let carried = null;
    try {
      const prev = JSON.parse(await readFile(resolve(JSON_OUT), 'utf8'));
      if (prev?.aggregate) {
        carried = {
          provenance: prev.provenance ?? null,
          sha: prev.provenance?.sha ?? prev.sha ?? null,
          shaShort: prev.provenance?.shaShort ?? prev.shaShort ?? null,
          shaNote: prev.shaNote ?? null,
          generated: prev.provenance?.generated ?? prev.generated ?? null,
          values: prev.aggregate.values ?? null,
          bakedInRegressions: prev.bakedInRegressions ?? null,
          supersedes: prev.supersedes ? '(one level deeper — see the previous file in git history)' : null,
        };
      }
    } catch { /* no previous baseline at this path, or unreadable — first write */ }
    if (carried) report.supersedes = carried;
    await writeFile(resolve(JSON_OUT), JSON.stringify(report, null, 2));
    console.log(`\nwrote baseline ${JSON_OUT}`);
    if (carried) {
      console.log(`  superseded ${carried.shaShort ?? '(unknown commit)'} — its values and bakedInRegressions were CARRIED FORWARD`);
      console.log('    into `supersedes`, mechanically. 🔴 NOW WRITE THIS BASELINE\'S OWN `bakedInRegressions`:');
      console.log('    every rail that is FAILing, and every number that just became the reference and is');
      console.log('    therefore invisible to the next run. That sentence is the only part a tool cannot write.');
    }
    console.log(`  provenance: ${prov.sha ? prov.shaShort : '(no commit)'}  trust=${prov.trust}`);
    console.log(`              ${prov.why}`);
    // A stored baseline is judged against for weeks. If its provenance is a guess, say
    // so AT WRITE TIME, when re-running under headserve still costs one command.
    if (prov.trust !== 'served') {
      console.log('\n  ⚠ THIS BASELINE\'S PROVENANCE IS NOT AUTHORITATIVE. A baseline is itself a');
      console.log('    measurement; one taken on an unidentified tree manufactures regressions for');
      console.log('    everyone downstream (see scanProvenance()). Prefer:');
      console.log(`      node tools/tmp/headserve.mjs --ref ${prov.headAtWrite.slice(0, 7) || '<sha>'} -- node tools/arena-scan.mjs --json ${JSON_OUT}`);
    }
    if (prov.srcDirtyFiles) console.log(`  ⚠ ${prov.srcDirtyFiles} file(s) dirty under src/ in this checkout at write time.`);
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
  lines.push(`tree: ${prov.sha ? prov.shaShort : '(no commit)'}  trust=${prov.trust}${prov.overlay.length ? `  overlay ${prov.overlay.join(',')}` : ''}`);
  {
    const un = okResults.filter((r) => r.unstill);
    if (un.length && !STILL_HUD) {
      lines.push('');
      lines.push(`⚠ NOT STILL WHEN SAMPLED (--still-hud was not passed): ${un.map((r) => r.id).join(', ')}`);
      lines.push('  Two captures with nothing touched differ by up to 33% of the frame at fog_inside,');
      lines.push('  100% of it src/ui/hud.ts CSS keyframes (CSS runs off the document timeline, not rAF).');
      lines.push('  The colour numbers below are unaffected (<=0.0001 drift). NO PIXEL-IDENTITY claim');
      lines.push('  may be quoted from these rows. See STATIONS `unstill` in tools/arena-scan.mjs.');
    } else if (un.length) {
      lines.push(`stilled: --still-hud applied; ${un.map((r) => r.id).join(', ')} are byte-comparable, and the`);
      lines.push('  keyframes are frozen at t=0 — deterministic, but a BIASED sample of the shipped look.');
    }
  }
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
    // Same IDs, different GROUND. See the `stationKeys` doc — this is the check that
    // would have stopped a colour agent chasing a regression that did not exist.
    const idErr = baselineIdentityError(base.aggregate, agg);
    if (idErr) { console.error(`\n${BASELINE} ${idErr}`); process.exit(2); }
    if (base.aggregate.stationKeys && !agg.stationKeys) console.log('\n  (this run predates stationKeys — position check skipped)');
    if (!base.aggregate.stationKeys) console.log('\n  (baseline predates stationKeys — a MOVED station would not be caught; re-baseline)');
    // ── WHICH TREE IS THE REFERENCE? Printed BEFORE the table, because it decides how
    //    to read every row under it. See scanProvenance().
    const st = baselineStaleness(base);
    console.log(`\n── the BASELINE itself: ${BASELINE} ──`);
    if (!st.known) {
      console.log(`  ⚠ ${st.why}. Staleness CANNOT BE ASSESSED, so a REGRESSION below may be`);
      console.log('    this run, or may be the tree having moved since. Re-baseline under headserve.');
    } else {
      console.log(`  taken at ${st.shaShort}  (${st.generated})   trust=${st.trust}`);
      const stale = (st.srcCommits ?? 0) > 0;
      console.log(`  HEAD is ${st.commits ?? '?'} commit(s) ahead, ${st.srcCommits ?? '?'} of them touching src/`);
      if (st.toolMoved) console.log('  ⚠ tools/arena-scan.mjs ITSELF has changed since — the instrument moved too.');
      if (stale) {
        console.log('\n  🟡 STALE BASELINE. Every row below compares TODAY\'S TREE against a tree that is');
        console.log(`     ${st.srcCommits} src/ commit(s) old. A REGRESSION here says the arena moved since ${st.shaShort};`);
        console.log('     it does NOT say your change moved it. To tell those apart, either re-baseline');
        console.log(`     (\`--json ${BASELINE}\` under \`headserve --ref <sha>\`) or run this same command on a`);
        console.log('     tree WITHOUT your change — if the row fires there too, it is not yours.');
        console.log('     (2026-08-05..11: a 6-day-old baseline fired `player salience rank 19.5 -> 31`');
        console.log('      on BOTH arms of a HEAD-to-HEAD control. Three agents were told to ignore it.)');
      } else {
        console.log('  ✓ no src/ commit since — a REGRESSION below is attributable to this tree.');
      }
    }
    // ── SAME TREE, DIFFERENT SAMPLE. A stilled run and an unstilled one disagree on
    //    `playerRankMedian` by ~1.5 places for reasons that have nothing to do with the
    //    arena, so comparing across the two is a rubric mismatch — the class of error
    //    CLAUDE.md rule 7 bans for critic scores, arriving through a CLI flag instead.
    { const m = stillHudMismatch(base, STILL_HUD); if (m) console.log(m); }
    console.log(`\n── colour budget vs baseline: ${BASELINE} ──`);
    console.log('  rail                          base      now     target   moved      verdict');
    for (const row of compareBaseline(base.aggregate, agg)) {
      console.log(`  ${row.label.padEnd(29)} ${String(row.base).padStart(7)}  ${String(row.now).padStart(7)}  ${String(row.target).padStart(7)}   ${row.moved.padEnd(8)}  ${row.verdict}${row.why ? `  <- ${row.why}` : ''}`);
      if (row.verdict === 'REGRESSION') bad++;
    }
    console.log(bad ? `\n  ${bad} colour regression(s). A pass that moves TOWARD the reference never fires this.` : '\n  no colour regressions.');
    // The exit code is UNCHANGED by staleness, deliberately. Provenance explains a
    // verdict; softening the verdict would hide the next real regression to excuse the
    // last fake one, and the fault was the reference, not the threshold.
    if (bad && st.known && (st.srcCommits ?? 0) > 0) {
      console.log(`  ⚠ ...but read the STALE BASELINE note above first: the reference is ${st.srcCommits} src/ commits old.`);
    }
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
