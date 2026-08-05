/**
 * Counter-family cover props — this module owns the stove islands (the central hub's
 * four corner blockers, one with a hanging pan rack), the prep counters (the paired
 * mid-west/mid-east chokepoint cover, one variant with a knife block, the other with
 * a mixing bowl + rolling pin), and the service counters (the fryer south / sink
 * north pair). These are the biggest, tallest cover pieces in the arena, and
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

/**
 * ── THE COMMITTED HEIGHT RATIO ──────────────────────────────────────────────────
 * Round-10 acceptance criterion, fixed BEFORE the first critic round so no future
 * critic can push it back and forth (see PROGRESS's note on the floor loop, which
 * burned four rounds implementing each critic's fix and having the next demand its
 * reverse):
 *
 *   **every prop that owns a CoverBox presents a solid mass >= 0.94 x CHARACTER_HEIGHT,
 *   and a height : min-footprint aspect ratio >= 0.40.**
 *
 * The first number comes from the one datapoint we have that is not a taste call: the
 * supply barrel is the single prop a blind critic said reads correctly as cover, and it
 * was the tallest-relative-to-a-character thing in the arena. The second exists because
 * height alone is not enough — a 1.7m box on a 4.5m-square footprint is still a slab
 * with a lid when seen from a 58deg camera, which is the mechanism behind "blocking vs
 * walkable is indistinguishable." Both are checked in `tools/tmp/heights.mjs`.
 *
 * ── Round 10, r2: what a critic actually measures when it says "too short" ──────
 * A blind critic given r1 (every prop verified at 0.94-1.07x by `tools/tmp/heights.mjs`)
 * still reported the counters at "~0.6-0.7x character height... a slab you vault, not
 * cover." It was not misreading the metres; it was measuring the right thing. Its own
 * note says why: *"the freezer's top surface occupies roughly 350,000 px of screen
 * while its front face occupies about 50,000 — a 7:1 ratio. Your eye resolves that as
 * a pool or a platform."*
 *
 * **Perceived height on a 58deg top-down camera is a prop's front-face screen extent
 * over its top-face screen extent, not its height in metres.** For a box of height H
 * and depth D that ratio is (H*cos58) / (D*sin58) = 0.62 * H/D. Reading 1:1 would need
 * H = 1.6*D — 7.2m on a stove island. Metric height alone cannot get there, which is
 * exactly why five rounds of raising it never moved the verdict.
 *
 * So this round buys the ratio three ways at once: more height, a tall BACKSPLASH WALL
 * that converts top area into a second vertical band, and clutter that breaks the
 * remaining top plane.
 *
 * ── The ceiling I thought existed does not ─────────────────────────────────────
 * r1 capped cover at ~2.2m on the theory that taller cover would hide a player from
 * their own player-centred camera. That was wrong, and the reason is collision:
 * `CHARACTER_RADIUS` is 1.05m, so a character's centre can never get closer than
 * 1.05m to a CoverBox face. Their head (2.1m) is hidden only when 1.05 <
 * (H - 2.1)/tan(58deg), i.e. only when **H > 3.78m**. Nothing here is remotely near
 * that. Their chest (~1.2m) is clipped when H > 2.88m — which is the "cut off at the
 * shoulders behind a crate" read the reference has and the critic correctly named as
 * the definitive tell that an arena has cover rather than furniture.
 */
export const COVER_MIN_H = CHARACTER_HEIGHT * 0.95;

/** Top working surface of every counter-family prop. One number, so stove islands,
 * prep counters and service counters all read as the same piece of furniture height
 * rather than three near-misses — and the barrels and the spice cart are pinned to it
 * too, so the whole arena reads with ONE cover height.
 *
 * 0.85 -> 0.95 (r1) -> 1.15 (r2). 2.415m: above a character's head, below the 2.88m
 * where cover starts clipping a character's chest and far below the 3.78m where one
 * could actually vanish. See the ceiling note above. */
export const COUNTER_TOP_Y = CHARACTER_HEIGHT * 1.15;

/**
 * Height of the raised back wall on every counter-family prop.
 *
 * This is the single biggest lever on the front-face : top-face ratio the r1 critic
 * measured, and it is worth more than the same metres spent on the counter body: a
 * 0.9m wall standing on a 2.4m counter puts a SECOND vertical band on the prop at
 * 2.4-3.3m, which is above every character's head, so it also finally makes cover
 * clip a character standing behind it. Spending those 0.9m on the body instead would
 * add the same vertical extent but leave the enormous flat top plane untouched.
 *
 * 0.26-0.30 -> 0.9. `shared.ts`'s `addBacksplash` keeps the wall at 90% of the width
 * and well inside the depth, so nothing leaves the CoverBox.
 */
export const BACKSPLASH_H = 0.9;

/** Height of the reserved BLOCKING base band. ~5px at shipped framing (0.0222 m/px),
 * which is enough for a hard dark line under every solid object and small enough that
 * it never becomes the prop's dominant colour.
 *
 * Round-9b: 0.26 -> 0.20, and the material moved from `coverPlinth` to
 * `coverPlinthPanel`. Measured on screen, `coverPlinth` was an UNLIT near-black that
 * rendered at rgb(15,9,24), luma **11**, against a floor at luma 151. A blind critic
 * measured exactly that and read it not as a base band but as "a pit", "a black
 * cut-out", "two incompatible shadow systems" next to the soft grey blob shadows the
 * characters use. A 93%-value drop with hard square corners is a hole, not a plinth.
 *
 * Round 11 finished that move rather than repeating it: a SECOND, independent blind
 * critic reported the same thing again on the successor colour (*"the only thing
 * selling them as blocking volume is the near-black skirt, which is a darker value
 * than anything in a shipped brawler environment"*), and it was right — the panel was
 * still landing at luma 25. It now lands at 39, as the bottom rung of the explicit
 * ramp set out above `coverBody`. Two critics, two rounds apart, on the same property
 * is the strongest signal this element has produced; the HEIGHT (0.20) is unrelated
 * and unchanged. */
export const COVER_PLINTH_H = 0.2;

/** Fraction of the CoverBox footprint the visible BODY occupies, so the plinth beneath
 * it shows as a ledge. The remaining 5% is collidable-but-not-drawn — on the tightest
 * prop in the arena (the prep counter's 2.75m depth) that is 7cm against a 105cm
 * character radius, i.e. far below anything a player can feel. */
export const COVER_BODY_FRAC = 0.95;

/** Share of a two-tone body given to its darker lower band. */
const COVER_LOWER_FRAC = 0.34;

/**
 * Recolour of an existing shared material, keeping its texture `map` and every other
 * property. Cached per `Materials` instance (a `WeakMap`, so a hot-reloaded arena's
 * materials and their clones are collected together) — the same lifetime rule the rest
 * of `buildMaterials` follows, and the reason this is not a module-level singleton the
 * way `storage.ts`'s untextured `herbSkirt` can afford to be.
 *
 * ── Why any cap needs recolouring at all, measured ──────────────────────────────
 * The prep counter's top slab is one of the biggest single surfaces in the arena and
 * it renders at p10 212.4 / p50 216.0 / p90 218.0 — a **5.6/255 spread with 18.9% of
 * its pixels at R >= 253.** `butcherBlock` carries a butcher-block texture and a
 * `roughness` of 0.5, and neither reaches the screen: the surface is bright enough to
 * clip, and a clipped face is a flat face by construction. That is finding #4 ("flat
 * single-value faces") in its most literal form, and unlike the apron quad it is NOT
 * the one-normal problem — there is real texture here that simply has no headroom.
 *
 * This is deliberately NOT the "butcherBlock/cabinet are 15% too hot in red" claim
 * PROGRESS records as tested and DISPROVED. That claim was about whole-FRAME red
 * clipping and it was correctly rejected (cutting both moved frame R>=253 from 4.50%
 * to 4.47%; the real culprit was `rimLight`). This is a local, per-surface measurement
 * of tonal headroom, it is a different quantity, and it is why only the two CAP
 * surfaces move — the shared `KPAL` entries are untouched.
 */
const capTints = new WeakMap<Materials, Map<string, THREE.Material>>();
export function tinted(M: Materials, base: THREE.Material, hex: string): THREE.Material {
  let byHex = capTints.get(M);
  if (!byHex) { byHex = new Map(); capTints.set(M, byHex); }
  const hit = byHex.get(hex);
  if (hit) return hit;
  const m = base.clone() as THREE.MeshStandardMaterial;
  m.color.set(hex);
  byHex.set(hex, m);
  return m;
}

/**
 * ── THE HUE CONTRACT, and why the two cap constants were the whole game ─────────
 *
 * `tools/tmp/matcover.mjs` (an ID-buffer pass reporting each material's exact share of
 * frame and the colour it ARRIVES at after lighting + the grade) settled a scoping
 * argument that three rounds of critique could not. Measured over the arena scan's own
 * stations, the two constants below owned more of the screen than the whole of `KPAL`'s
 * warm half put together:
 *
 *   kpal:cabinet      #CE8C2E  7.3% of frame   rgb(243,146,9)   hue  35  sat 0.96  luma 157
 *   kpal:butcherBlock #C9AD7B  3.2% of frame   rgb(240,195,94)  hue  42  sat 0.61  luma 197
 *
 * The first is the loudest single environment surface in the game and the second is the
 * brightest. Both arena critics, independently, spent their #1 fix on the same sentence:
 * *"the two large counter slabs — get the saturated orange off them."*
 *
 * ── The contract is NOT "desaturate" — that was tried three times and measured wrong ─
 * The ten curated reference plates run mean saturation 0.493, COOL chroma 0.343, WARM
 * chroma 0.145. Three dutiful desaturation rounds had taken this arena to 0.302 — below
 * every plate — by cutting the cool half for free, which is exactly the "muddy /
 * drained" both critics reported. **The reference reserves HUE, not saturation: a
 * saturated COOL ground at full chroma with the warm half of the wheel left empty for
 * the cast and the VFX.** Measured over the same 18 stations before this change, the
 * arena ran warm chroma 0.241 (66% ABOVE reference) against cool 0.153 (55% BELOW), and
 * 7.3% of the frame in one warm surface at saturation 0.96 is most of the reason.
 *
 * So the stove cap leaves the warm half rather than being greyed, and the prep cap —
 * the arena's remaining large warm identity surface — is held at reference chroma
 * instead of being taken to grey. `tools/tmp/simfix.mjs` (overrides materials in the
 * live page and re-runs `arena-scan`'s own salience analysis) priced every candidate
 * before a line was written; the pair below moved playerRank mean 35.2 -> 27.2 and
 * flipped player-minus-surround saturation from -0.017 to +0.023 on their own.
 */

/** Prep counter top — the arena's one large surface that stays WARM.
 *
 * `butcherBlock` (#E4C48C) at -12% value was still arriving at luma 197 / sat 0.61 over
 * 3.2% of the frame: the brightest plane in the map and, after the stove cap moves cool,
 * the only big warm one left. Held rather than greyed, because the reference's warm
 * chroma is 0.145, not zero — it is the deliberate warm note the cast is read against.
 * Arrives rgb(190,167,117), hue 41, sat 0.38, luma 168: 48 luma clear of the walkable
 * plank pad (115) and 53 clear of the lit floor tile (115).
 *
 * ── Round 11: STILL warm, DELIBERATELY, and this is the reasoning to keep ─────
 * A blind critic's headline fix was *"vacate the orange/amber band from the
 * environment so the food characters are the only warm-orange objects in the frame."*
 * Three of the four surfaces it named or the scanner found are doing exactly that this
 * round (the counter rim trim, the plank pads, the ground grime, the brass pot stack).
 * **This one is not, and the deviation is measured rather than taste.**
 *
 * The recorded reference warm chroma of 0.145 turns out to be an average pulled up by
 * a single outlier plate (bs_03, 0.610, warmShare 0.865). Per plate the median is
 * 0.097 — still HIGHER than our 0.064 — and `docs/LESSONS.md` §8 is explicit that
 * three critics have already unanimously prescribed crushing the environment when the
 * measurement said not to. An environment at warm chroma zero is not what any plate
 * does; it is what the "muddy / drained / washed out" verdicts were.
 *
 * So the arena keeps exactly one large warm identity surface, and this is it. What
 * moves is the two properties that were actually costing something: it comes DOWN 23
 * luma (163 -> 140, so it stops being the brightest plane in the map and stops
 * appearing in the salience grid's top cells) and UP in chroma (HSL 0.34 -> 0.47), so
 * the same 1.6% of frame delivers more of the warm budget from less of the eye.
 * Priced first: #96805C arrives rgb(178,136,64), hue 38, HSV 0.64, luma 140. */
const prepCap = (M: Materials) => tinted(M, M.butcherBlock, '#8E7B5A');

/** Stove island top — the single biggest lever in the arena, and now COOL.
 *
 * `cabinet` (#C1731E) arrived rgb(243,146,9): HSV saturation **0.96**, value 0.95, red
 * railed and blue crushed to 9, over **7.3% of every frame** — on the most numerous
 * cover prop in the map. Five earlier rounds moved it along the warm ladder
 * (#AE6820 -> #CE8C2E) and each time it came back railed, because the problem was never
 * headroom: it was that the arena's largest cover slab was sitting in the same half of
 * the colour wheel as the cast.
 *
 * Slate steel-blue, arriving rgb(94,152,208), hue 209, sat 0.55, val 0.82, luma 144.
 * A commercial range top is steel, so this costs nothing in read; what it buys is that
 * 7.3% of the frame moves out of the warm band and INTO the half the reference keeps at
 * full chroma. Measured: warm 0-60 deg share 0.624 -> 0.517 with saturation deliberately
 * NOT crushed.
 *
 * Hue 209 rather than the freezer's cyan on purpose. This arena has form for large flat
 * pale-cyan planes reading as water (a blind critic opened on the freezer with *"on first
 * look I read it as a swimming pool"*), and 209 also holds it 10-22 deg off the walkable
 * teal/utility pads at 187-199 — on top of the 26-35 luma it already clears them by.
 *
 * ── Why not simply take it further down ────────────────────────────────────────────
 * A lower-chroma variant (#7A8CA8, sat 0.42 at the same luma) was simulated: it bought
 * 0.4 of playerRank and 0.007 of player-minus-surround saturation, for measurably less
 * cool chroma. That is the trade the "muddy" verdicts came from, so it was rejected. */
const stoveCap = (M: Materials) => tinted(M, M.cabinet, '#6F8CAE');

/**
 * ── THE COUNTER BODY, and the one thing two independent critics both measured ──
 *
 * r1's critic: *"the props are separated from the floor only by hue... the counters'
 * cream tops are within a couple of value steps of the tile."*
 * r2's critic, with numbers: lit counter top rgb(226,106,7) luma 130 against lit floor
 * tile rgb(196,133,95) luma 147, **hue within 3 degrees**; counter side wall
 * rgb(115,53,16) luma 67 against shadowed floor rgb(101,67,39) luma 74 — **7 points of
 * 255**. Two fresh critics, no shared context, same finding, and the second one
 * measured it. That is the strongest signal this loop produced, and unlike the height
 * complaint it never reversed.
 *
 * The mechanism is that `cabinetDark`/`crateSlat` are warm mid-browns and `floor.ts`'s
 * terracotta tile is a warm mid-brown. The arena's primary cover and its ground are
 * literally the same colour family, so the ONLY thing separating a counter from the
 * floor is a crisp geometric edge — and edges are the first cue lost at gameplay zoom,
 * in motion, and under the fog overlay.
 *
 * The floor is not this agent's file, so the props move. Rather than pick an arbitrary
 * new hue, the body extends the grammar the arena already reserves for BLOCKING:
 * `coverPlinthPanel`'s near-black plum. The whole solid mass now runs plum-grey from
 * the ground up — desaturated (S ~0.2 against the floor's ~0.5), cool (plum against
 * terracotta), and dark — with the bright, saturated CAP left as the only identity
 * colour. One rule a player can learn in a second: **a dark plum mass under a bright
 * cap is a thing that stops bullets.**
 *
 * Value alone would not have been enough: the shadowed floor is itself at luma 74, so
 * a merely-darker body collides again the moment it is in shade. Hue and saturation
 * are what hold in shadow, and they only became usable when the post chain stopped
 * collapsing every colour to HSV saturation 1.00.
 *
 * ── ROUND 11: THE VALUE RAMP, AND THE NUMBER THAT PROVES IT WAS A DEFECT ──────
 *
 * Everything above is right and stays. What it got wrong is HOW FAR down: "dark" was
 * implemented as *near-black*, and near-black is not a value a shipped brawler uses.
 *
 * A blind critic scoring this arena 6/10 against a reference at 8.5 spent its second
 * fix here, in all six sheets, with no access to any of this:
 *
 *   *"The blue counter slabs are ~30% of the frame carrying almost no surface
 *    information — top face and front face sit within a very narrow value range and
 *    every edge is a hard unbeveled 90 deg, so they read as painted planes rather than
 *    solids. Give them a three-step value ramp — top face clearly lightest, front
 *    vertical face a distinct step darker, base skirt darkest — and a chamfered top
 *    edge carrying a bright rim. The only thing selling them as blocking volume is the
 *    near-black skirt, which is a darker value than anything in a shipped brawler
 *    environment."*
 *
 * That last clause is checkable rather than arguable, and it checks out. Sampled off
 * the curated plates and off our own frames the same way:
 *
 *                          rendered luma   HSL saturation
 *   bs_01 violet barrel        103             0.68        <- reference BLOCKING
 *   bs_01 pale crate           159             0.57        <- reference BLOCKING
 *   ours  coverBody             35             0.18
 *   ours  coverSkirt            27             0.18
 *   ours  coverPlinthPanel      25             0.47
 *
 * **There is no near-black anywhere in either reference plate.** Ours ran the whole
 * blocking family 70-130 luma below theirs, and it cost twice over:
 *
 *   1. HIERARCHY. A luma-169 trim strip against a luma-25 wall inside one 100x100px
 *      salience cell pins that cell's local-contrast term at its ceiling — and those
 *      are precisely the cells that outranked the player at 15 of 18 stations. The
 *      arena was manufacturing its own top-salience cells out of a contrast nothing
 *      needed to be that extreme to express.
 *   2. CHROMA. A surface at luma 25 cannot carry saturation at all, so 9.2% of every
 *      frame was contributing nothing to a frame independently measured as
 *      under-chromatic overall (meanSat 0.324 against a plate minimum of 0.370).
 *
 * ── The ladder, priced with `caphex` before it was written ────────────────────
 *
 *   surface        was        now        step   what it is
 *   cap (stove)    luma 143   luma 143     —    unchanged; the identity plane
 *   coverBody           35         78     −65   the front/side vertical face
 *   coverSkirt          27         53     −25   the lower band, below the reveal groove
 *   coverPlinthPanel    25         39     −14   the base band at the full footprint
 *
 * Three unambiguous steps under a bright cap, with the darkest band still 69 luma
 * below the floor it stands on — so "dark plum mass under a bright cap = stops
 * bullets" survives intact, and now reads as a solid rather than as a hole cut in one.
 *
 * ── And the hue moves with it: BLOCKING is now the only VIOLET in the arena ────
 * `docs/STATE.md` item 9 and `DECISIONS-FOR-URI.md` §5 record that the floor's move
 * into the plum family took the HUE half of the blocking-vs-walkable cue away, leaving
 * value alone to carry it. The same blind critic reported the symptom unprompted
 * (*"the dark teal/cyan pads under both counters read ambiguously — I could not tell
 * whether they are raised platforms, floor mats, water, or pits"*), which is two
 * independent sources on one defect.
 *
 * So the ground keeps rose-mauve (hue 332) and blocking takes VIOLET (hue 261-266) —
 * 71 deg apart, both saturated, and no other family in the arena is violet. Value and
 * hue now agree instead of one doing all the work. This is a deliberately clean,
 * revertible pair of constants because Uri may prefer the old look.
 */
const coverBody = (M: Materials) => tinted(M, M.cabinetDark, '#8975B9');
const coverSkirt = (M: Materials) => tinted(M, M.crateSlat, '#6D5695');

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
 * Small potted herb garnish — a saturated green against the slate cap it stands on and
 * the plum body below it. Cheap, bold-shaped (a pot + a leaf cluster, no
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
  const capT = 0.15;
  const y0 = addCoverPlinth(g, M, wM, dM);
  const sideTop = COUNTER_TOP_Y - capT;

  // DARK sides, BRIGHT overhanging cap — see `addCoverCap`. The cap is the only plane
  // carrying this prop's identity colour and it is now cool steel rather than the
  // arena's saturated orange (see `stoveCap`); the plum vertical faces render ~100 luma
  // below it, which is what gives the box its top-vs-side value break.
  addCoverSides(g, bw, bd, y0, sideTop - y0, coverBody(M), coverSkirt(M), 0.06, 'stove_cabinet');
  addCoverCap(g, wM, dM, COUNTER_TOP_Y, capT, stoveCap(M), 'stove_counter');

  // Back wall + bright cap trim — see `addBacksplash`. Sits further back (-Z) than
  // the pan rack posts below, so on the island that has a rack this reads as "wall
  // behind the hanging pans" rather than clipping through them.
  addBacksplash(g, M, wM, dM, COUNTER_TOP_Y, coverBody(M), BACKSPLASH_H);

  // ── Hob plate — round-10 rebuild ────────────────────────────────────────────
  // Measured at shipped framing, the old hob rendered rgb(18,51,76), **luma 45.6**,
  // against its own counter cap at luma 137: a 91-value drop, hard-edged, filling
  // ~55% of the counter's top face. A large flat rectangle that dark on a lit
  // surface is a HOLE — the same read the barrel's pure-black bung got, at ten times
  // the screen area. Worse for this round specifically: luma 45.6 is within 11 of the
  // reserved `coverPlinthPanel` BLOCKING band (luma 34.9), so the arena's one colour
  // that is supposed to mean "this stops a bullet" was also appearing as a big flat
  // panel lying flat on top of cover, i.e. exactly the flat-coloured-rectangle
  // language the walkable floor mats use. Two grammars collided on one surface.
  //
  // r10 gave it a smaller MID-grey plate with real thickness and a brighter lip, and a
  // fresh blind critic measured that the fix only got halfway: *"the grey griddle plates
  // on the blue counters are the darkest large shapes in the midfield and read as HOLES
  // IN THE FLOOR rather than as surface detail on solid cover — and they use the same
  // grey as the pot's corrugated drum, so one material is doing two unrelated jobs."*
  //
  // Both halves check out on the pixels:
  //   - `potMetalDark` arrives at luma 85 against a counter cap at 144. The drop went
  //     91 -> 59, which is better and still a hard-edged dark rectangle over a third of
  //     the counter's top face.
  //   - the LIP that exists specifically to stop that read is `potMetal`, which arrives
  //     at luma 92 here. **Seven luma brighter than the thing it is supposed to frame** —
  //     the cue was authored and then never checked against a render.
  //   - `potMetal`/`potMetalDark` ARE the boiling-pot hazard's own materials. Cover and
  //     damage sharing a material is the same class of bug `buildLanePots` was rebuilt
  //     to fix, and it survived here because the hob was thought of as machinery rather
  //     than as part of a cover prop.
  //
  // So both surfaces leave the hazard's palette through `tinted()` and are authored as a
  // real ladder instead of inheriting one. Measured on screen after the change:
  //
  //   griddle  rgb(117,102,81)   luma 104  hue  35  sat 0.31   <- warm cast iron
  //   cap      rgb(94,152,208)   luma 144  hue 209  sat 0.55
  //   lip      rgb(150,170,178)  luma 166  hue 197  sat 0.16   <- bright steel
  //
  // Griddle < cap < lip, so the plate reads as recessed INTO a lit surface rather than
  // punched through it, and the warm hue puts it 174 degrees off the hazard pot's cold
  // grey drum. The burner rings stay on the shared dark metal — they are 6cm tori, far
  // too small to read as a panel.
  const hobW = wM * 0.32, hobD = dM * 0.36;
  const hobT = 0.12;
  const hobLip = mesh(roundedBox(hobW + 0.1, hobT * 0.6, hobD + 0.1, 0.03), tinted(M, M.potMetal, '#D2D7DC'), 'stove_hob_lip');
  hobLip.position.y = COUNTER_TOP_Y + hobT * 0.3;
  g.add(hobLip);
  const hob = mesh(roundedBox(hobW, hobT, hobD, 0.03), tinted(M, M.potMetalDark, '#7A6A52'), 'stove_hob');
  hob.position.y = COUNTER_TOP_Y + hobT / 2;
  g.add(hob);

  // Two burner rings + a lit-coil disc each.
  for (const bx of [-wM * 0.14, wM * 0.14]) {
    const ring = mesh(new THREE.TorusGeometry(0.17, 0.03, 8, 20), M.potMetalDark, 'burner_ring');
    ring.rotation.x = Math.PI / 2;
    ring.position.set(bx, COUNTER_TOP_Y + hobT + 0.02, 0);
    g.add(ring);
    const coil = mesh(puck(0.12, 0.02, 16), M.potMetal, 'burner_coil');
    coil.position.set(bx, COUNTER_TOP_Y + hobT + 0.02, 0);
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
    post.position.set(-wM * 0.32, COUNTER_TOP_Y + postH / 2, -dM * 0.26);
    g.add(post);
    const bar = mesh(roundedBox(wM * 0.5, 0.045, 0.045, 0.02), M.freezerTrim, 'rack_bar');
    bar.position.set(-wM * 0.05, COUNTER_TOP_Y + postH, -dM * 0.26);
    g.add(bar);
    let px = -wM * 0.28;
    for (const pr of [0.16, 0.13, 0.15]) {
      const chain = mesh(puck(0.008, 0.16, 6), M.potMetalDark, 'pan_chain');
      chain.position.set(px, COUNTER_TOP_Y + postH - 0.1, -dM * 0.26);
      noOutline(chain);
      g.add(chain);
      const pan = mesh(puck(pr, 0.045, 16), M.potMetal, 'hanging_pan');
      pan.position.set(px, COUNTER_TOP_Y + postH - 0.2, -dM * 0.26);
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
  const capT = 0.14;
  const y0 = addCoverPlinth(g, M, wM, dM);
  const sideTop = COUNTER_TOP_Y - capT;

  addCoverSides(g, bw, bd, y0, sideTop - y0, coverBody(M), coverSkirt(M), 0.06, 'prep_cabinet');
  // Butcher block is the arena's one large WARM surface — see `prepCap` for why it is
  // held at reference chroma here rather than greyed with the rest of the environment,
  // and why it runs well below the shared `KPAL` entry's value.
  addCoverCap(g, wM, dM, COUNTER_TOP_Y, capT, prepCap(M), 'prep_top');
  addBacksplash(g, M, wM, dM, COUNTER_TOP_Y, coverBody(M), BACKSPLASH_H);

  // Always-present cutting board + a few chopped-veg cubes, off-centre so it never
  // collides with either the knife block or the bowl/pin below.
  //
  // Round-10: this was 3.5cm thick in `crateWood` and rendered rgb(248,133,16) — S
  // 0.934 with red one step off the rail — i.e. a hard-edged, fully saturated, flat
  // orange RECTANGLE lying flat on the counter with no measurable thickness. That is
  // the visual language of a floor decal, and the whole point of this round is that
  // the player must be able to tell a painted rectangle from a solid object. It is now
  // a 9cm slab (thick enough to throw its own shadow line and show an edge from the
  // gameplay pitch) in the calmer `woodPad` tone, so it reads as a board someone put
  // down rather than a colour printed on the counter.
  const boardY = COUNTER_TOP_Y;
  const board = mesh(roundedBox(wM * 0.3, 0.09, dM * 0.5, 0.025), M.woodPad, 'prep_cutting_board');
  board.position.set(-wM * 0.2, boardY + 0.045, 0);
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
      chip.position.set(-wM * 0.2 + (px + jx) * wM * 0.3, boardY + 0.09 + 0.013 * sc, (pz + jz) * dM * 0.3);
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
  const capT = 0.15;
  const y0 = addCoverPlinth(g, M, wM, dM);
  const sideTop = COUNTER_TOP_Y - capT;

  addCoverSides(g, bw, bd, y0, sideTop - y0, coverBody(M), coverSkirt(M), 0.06, 'service_cabinet');
  // Stainless cap — the DARKEST and least saturated top in the counter family, so
  // fryer/sink stay distinguishable from the stove islands and the prep counters
  // without the sides having to differ. Consistent dark sides across all cover is the
  // point; identity lives on the top plane, which is also the plane that dominates the
  // frame at this camera pitch. Measured, the three caps now read as a proper ladder
  // rather than three hues: service `potMetal` luma 92 sat 0.18 / stove slate luma 144
  // sat 0.55 / prep butcher-block luma 168 sat 0.38. The stove cap moving cool put it
  // in the same half of the wheel as this one (see `stoveCap`), which is why the gap
  // that separates them is now 52 luma and 0.37 of saturation rather than hue.
  addCoverCap(g, wM, dM, COUNTER_TOP_Y, capT, M.potMetal, 'service_top');
  addBacksplash(g, M, wM, dM, COUNTER_TOP_Y, coverBody(M), BACKSPLASH_H);

  // Both variants get a bright metal LIP standing proud of the counter around their
  // dark well/basin. Same round-10 reason as the stove hob: a flat dark rectangle
  // sitting flush in a lit top face reads as a hole punched through the mesh, and any
  // large flat single-value rectangle on cover is the walkable-floor-decal language
  // this round exists to stop borrowing.
  // A lighter tint of the cap's own metal, not `potMetal` itself — the service cap IS
  // `potMetal`, so an untinted lip would be invisible against it.
  const lipT = 0.07;
  const lip = mesh(roundedBox(wM * 0.66, lipT, dM * 0.66, 0.03), tinted(M, M.potMetal, '#B7BEC6'), 'service_well_lip');
  lip.position.y = COUNTER_TOP_Y + lipT / 2;
  g.add(lip);

  if (variant === 'fryer') {
    const well = mesh(roundedBox(wM * 0.55, 0.1, dM * 0.55, 0.04), M.potMetalDark, 'fryer_well');
    well.position.y = COUNTER_TOP_Y + lipT - 0.025;
    noOutline(well);
    g.add(well);
    const basket = mesh(roundedBox(wM * 0.4, 0.22, dM * 0.4, 0.03), M.steelDark, 'fryer_basket');
    basket.position.y = COUNTER_TOP_Y + lipT + 0.115;
    g.add(basket);
    const handleBar = mesh(puck(0.015, wM * 0.5, 8), M.steelDark, 'fryer_handle');
    handleBar.rotation.z = Math.PI / 2;
    handleBar.position.set(0, COUNTER_TOP_Y + lipT + 0.255, 0);
    noOutline(handleBar);
    g.add(handleBar);
  } else {
    const basin = mesh(roundedBox(wM * 0.6, 0.14, dM * 0.55, 0.05), M.steelDark, 'sink_basin');
    basin.position.y = COUNTER_TOP_Y + lipT - 0.025;
    noOutline(basin);
    g.add(basin);
    const faucetPost = mesh(puck(0.025, 0.32, 8), M.steel, 'faucet_post');
    faucetPost.position.set(0, COUNTER_TOP_Y + lipT + 0.155, -dM * 0.2);
    g.add(faucetPost);
    const faucetArc = mesh(new THREE.TorusGeometry(0.14, 0.02, 6, 12, Math.PI), M.steel, 'faucet_arc');
    faucetArc.rotation.set(0, Math.PI / 2, 0);
    faucetArc.position.set(0, COUNTER_TOP_Y + lipT + 0.295, -dM * 0.08);
    g.add(faucetArc);
  }

  return g;
}
