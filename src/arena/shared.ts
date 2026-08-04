/**
 * Kitchen arena — shared foundation.
 *
 * Owns everything the other `arena/` modules (floor, hazards, ambient, and the
 * `props/*` builders) all depend on, so there is exactly one copy of each:
 *
 *   - Map-scale constants (`ARENA_W`/`ARENA_H`/`CENTER`/`MAX_SAFE_RADIUS`) and the
 *     floor's layered Y heights (`FLOOR_Y`).
 *   - The `KPAL` colour palette and `buildMaterials()` (the `Materials` type/factory
 *     every builder takes as its first argument).
 *   - Tiny geometry helpers (`puck`, `mesh`, `noOutline`) used by every builder.
 *   - The baked contact-shadow decal system (`buildContactShadow`) and the two
 *     shared cover-prop trim helpers (`addBacksplash`, `addTopRim`).
 *   - `addCover()` — the single place a `CoverBox` gets registered AND its matching
 *     visual (body + contact AO ring) gets built, used by `kitchen.ts`'s layout.
 *
 * This module owns no gameplay layout (no coordinates for any specific prop) and no
 * per-prop visual design — it is pure infrastructure for the modules that do.
 */

import * as THREE from 'three';
import type { CoverBox } from './types';
import { toonMat, glossyMat, flatMat, roundedBox, RAMP_SOFT } from '../render/toon';
import { wu, groundPos } from '../units';
import { PALETTE, MATCH_DURATION_MS } from '../game/rules';
import {
  makeTileWearTexture,
  makeWoodGrainTexture,
  makeButcherBlockTexture,
  makeBrushedMetalTexture,
  makePlankTexture,
  makeBurlapTexture,
  makeBarrelTexture,
  makePanelSeamTexture,
} from './textures';

// ─────────────────────────────────────────────────────────────────────────────
// Map constants
// ─────────────────────────────────────────────────────────────────────────────

export const ARENA_W = 1400;
export const ARENA_H = 1000;
export const CENTER = { x: ARENA_W / 2, y: ARENA_H / 2 }; // 700, 500

/** Half-diagonal of the playfield — the distance to its FARTHEST point, a corner. */
export const ARENA_HALF_DIAGONAL = Math.hypot(ARENA_W / 2, ARENA_H / 2); // ≈ 860.23

/**
 * Seconds of play before the closing ring first cuts into the playfield.
 *
 * Uri's call: *"Start the circle bigger. So it touches first the arena after 5-7
 * seconds."* Set to 6, the middle of that range.
 */
export const FOG_FIRST_CONTACT_S = 6;

/**
 * Opening safe radius, DERIVED rather than hand-picked.
 *
 * The previous value (850) was **smaller than the arena's own half-diagonal (860.2)**, so
 * the safe circle never contained its own corners: the NW corner sits at 831 from centre
 * and was therefore inside the lethal fog **from t=0, for the entire match.** Corners were
 * permanently unusable space, and there was no way to see one un-fogged at all — which
 * also meant no frame of a corner could be judged for hue or value.
 *
 * `sim.ts` shrinks linearly: `safeRadius = maxSafeRadius × (1 − matchProgress)`. So to put
 * first contact at `FOG_FIRST_CONTACT_S`, solve for the radius that has decayed to exactly
 * the half-diagonal by then:
 *
 *     R0 = halfDiagonal / (1 − t / MATCH_DURATION)
 *        = 860.23 / (1 − 6/180)
 *        ≈ 890
 *
 * Derived from the arena dimensions and the match length rather than written as a literal,
 * so resizing the map or changing the match duration cannot silently re-create the
 * corners-fogged-from-birth bug.
 */
export const MAX_SAFE_RADIUS = Math.round(
  ARENA_HALF_DIAGONAL / (1 - (FOG_FIRST_CONTACT_S * 1000) / MATCH_DURATION_MS)
);

// ─────────────────────────────────────────────────────────────────────────────
// Ground-shadow direction, and the round-9 removal of the baked CAST decals.
//
// ── What this direction is for now ────────────────────────────────────────────
// One thing only: `addCover` offsets each prop's contact/AO ring a fraction of its
// own overhang along it, so the grounding band stays tight on the LIT side and runs
// a little further on the shaded side. That is what makes the ring read as
// light-driven contact darkening rather than a symmetric grey halo.
//
// It is the key light's azimuth, duplicated. `render/lighting.ts` is out of bounds
// for this module, so the number is copied rather than read at runtime: the key sits
// at (16.35, 9.82, 4.69) relative to its target, and a shadow falls AWAY from the
// light. IF THAT AZIMUTH MOVES, MOVE THIS. Two other files carry the same duplicate
// and are owned elsewhere — `arena/apron.ts` (`SHADOW_X`/`SHADOW_Y`, its kerb contact
// band) and `arena/floor.ts` (the `along` term in its baked litness ramp) — and both
// are still on the OLD azimuth (38.1 deg from +X; this one is 16.0), so both are 22
// deg out. Neither draws a hard shadow edge — apron.ts shades a soft one-sided kerb
// band, floor.ts a whole-arena low-frequency ramp — so neither is visibly wrong at 22
// deg, but they should be brought across.
//
// CORRECTION (verified against the tree): `apron.ts` is ALREADY on the new azimuth — it
// reads `Math.hypot(16.35, 4.69)`, matching this file and `lighting.ts:166`. Only
// `floor.ts` is still stale, and it is parked. This note claimed otherwise for a while,
// and a brief written from it sent an agent to "fix" something already correct.
//
// ── The cast decals are GONE, and why ─────────────────────────────────────────
// Rounds 6-8 gave every cover prop, the pot and several small props a second baked
// decal on top of the AO ring: a soft feathered oval trailing away from the prop
// along this direction, standing in for a real cast shadow back when the shadow map
// was mushy. It is not needed any more, and it was actively holding the rig back.
//
// Ablated at shipped framing, player-centred, in the live game (hide the family,
// re-render, per-pixel diff — `tools/tmp/rake.mjs --mode ablate`):
//
//   contact/AO decals  mean 2.25/255 over 8.5% of pixels — LOAD-BEARING, KEPT.
//                      The diff image is a tight dark band hugging every prop's
//                      footprint. Hiding them makes every pad-mounted prop float.
//   cast decals        mean 0.13/255 over 0.75% of pixels — REMOVED. The diff image
//                      is five faint slivers, most of them under the prop that casts
//                      them. The shadow map does this job properly now.
//
// The 0.13 was never the point, though. This direction being FROZEN is what stopped
// the key light's azimuth from moving at all, because rotating it would have pointed
// the real shadows one way and 32 baked ones another. With the cast decals gone the
// azimuth is free, and swinging the key side-on buys raking modelling on every curved
// surface in the arena — measured +21% terminator ramp on the barrel's skirt — which
// is worth incomparably more than 0.13/255. Removing these without moving the key
// would have been a small strict loss, which is why the two landed as one change.
const SHADOW_DIR_LEN = Math.hypot(16.35, 4.69);
const SHADOW_DIR = { x: -16.35 / SHADOW_DIR_LEN, z: -4.69 / SHADOW_DIR_LEN };

// ─────────────────────────────────────────────────────────────────────────────
// Kitchen palette — extends the shared character PALETTE with arena-only tones so
// produce accents on crates/sacks visually match the roster.
// ─────────────────────────────────────────────────────────────────────────────

export const KPAL = {
  tileLight: '#EAD3A8',
  tileDark: '#D8B586',
  subfloor: '#B08355',
  border: '#5B3A22',
  woodPad: '#C9945A',
  woodSeam: '#9C6A38',
  flour: '#EFE6CE',

  // Pushed more saturated than the original muted tan — see the round-5 saturation
  // note on `buildMaterials`: cabinets are some of the biggest cover surfaces in
  // the arena, so their chroma does real work for the overall scene average.
  //
  // Round-8 NOTE, recorded so nobody re-derives it: a critic measured 5.94% of the
  // frame at R >= 253 against 0.27% in the reference plate, and these two were named
  // as the cause ("~15% too hot in red"). They are not. Cutting both by 15% moved
  // whole-frame red clipping from 4.50% to 4.47% — three hundredths of a point, i.e.
  // nothing — so the change was reverted rather than kept as an unmotivated look
  // shift on the arena's biggest warm surfaces. Rendering the clipped pixels as a
  // MASK instead of trusting the aggregate showed where the red actually flatlines:
  // `rimLight` trim (see below) and the pot's broth disc. Cutting `rimLight` alone
  // took the same frame from 4.50% to 3.02% (lower-right quadrant 2.05% -> 0.85%).
  // A percentage over a whole frame says how much is clipped, never what is doing
  // it; the mask is one command and settles it.
  cabinet: '#C1731E',
  cabinetDark: '#8A5A2E',
  butcherBlock: '#E4C48C',
  // Shifted from a neutral slate toward a visibly blue-teal steel — this surface is
  // large and sits front-and-centre on every stove/service top, so its hue is one of
  // the main levers for pulling the whole hub out of the orange/tan band. Kept dark
  // for the same exposure reason as before: a flat glossy top this size, viewed almost
  // head-on under this rig's key+hemisphere lighting, adds enough specular+clearcoat
  // energy on top of the albedo to blow straight past 1.0 and clip to white — only a
  // genuinely dark base survives with its hue intact once that highlight lands.
  steel: '#184F6E',
  steelDark: '#0F2E40',

  freezerBody: '#1F9FD1',
  freezerDoor: '#2E88AC',
  freezerTrim: '#2B2B2B',
  // Cold light spilling off the freezer onto the floor in front of its door.
  freezerGlow: '#8FE3FF',

  crateWood: '#CC7E23',
  crateSlat: '#5B3A22',
  burlap: '#D9C08A',
  burlapDark: '#B99D66',

  // Cool counterpoint crate — herbs/greens, not another warm produce box. Deep
  // teal-green body reads as "cold storage / fresh herbs" against the orange hub.
  herbCrateWood: '#0E8560',
  herbCrateSlat: '#1E5641',
  herbLeafA: '#3FAE6E',
  herbLeafB: '#2E8F72',
  potteryWarm: '#B5602E',

  // Decorative tile band ringing the hub — a deliberate cool zone the eye can land
  // on before it reaches the warm scorch/hazard ring at the centre.
  tealTile: '#0CA8BC',
  tealTileDark: '#087C8C',

  potMetal: '#888D95',
  potMetalDark: '#5B5F66',
  flame: '#FFB238',
  flameCore: '#FFE9A8',

  // ── Puddle bodies ───────────────────────────────────────────────────────────
  // Measured at shipped framing, these two discs were the loudest objects in the
  // arena — each ~19% of the frame width, so "loudest" is not a small area effect:
  //   water  rendered (97,203,251), HSV val **0.984** against a frame mean of 0.562
  //          — effectively clipped white-cyan, the single brightest thing on screen;
  //   grease rendered (210,152,23), HSV sat **0.897** against a frame mean of 0.603
  //          — the single most saturated thing on screen.
  // That is what made them read as MOBA pickup/heal pads instead of spills, and no
  // amount of edge treatment fixes a body that bright. Both are pulled down here to
  // land near the frame's own sat/val band while keeping their hue, so each still
  // reads instantly as water or grease and still separates from the warm tile
  // beneath it (rendered ≈ (160,107,76), sat 0.53, val 0.63) — a slow hazard still
  // has to be legible, it just must not out-shout the characters fighting on it.
  //
  // Both are authored BELOW the intended on-screen values: this rig's lighting plus
  // `stage.ts`'s grade add roughly +0.15 saturation and +0.13 value between the
  // authored albedo and the pixel.
  water: '#3F86A8',
  waterCap: PALETTE.waterCap,
  grease: '#A08350',

  // Warm gold used ONLY as a thin light-catching cap/rim trim along the top edge of
  // counters and backsplashes — the "chamfer that catches a different light angle"
  // cue. Never used as a body colour, so it stays legible as an edge accent.
  //
  // Round-8: pulled down from `#F6DFA0`. This trim runs along the top edge of every
  // counter, backsplash and `addTopRim` frame in the arena, which is a lot of pixels
  // for something this bright, and at R=246 it did not survive the rig's ~1.25x
  // lighting multiply — it arrived with its red channel flatlined. A clipped
  // highlight is not a brighter highlight: once one channel pins and the others keep
  // moving, the trim stops holding its own hue and slides toward white, which is
  // exactly the opposite of "a chamfer catching a warm light". Measured by clip mask
  // as the single biggest source of red clipping in the arena (see the note on
  // `cabinet` above): whole-frame R >= 253 went 4.50% -> 3.02% from this one value.
  // Still unmistakably the brightest trim in the frame — it just keeps its gold now.
  rimLight: '#D8BE84',

  // ── Round-5 visual-grammar accents ──────────────────────────────────────────
  // A critic scored this arena 4/10 for having "one visual grammar applied
  // uniformly" to blocking cover, the pot hazard, and flat floor decoration — no
  // object carried a material/outline/shadow language reserved for its own
  // category. The colours below exist ONLY to carry one of these three languages
  // and are never reused across categories.

  // BLOCKING — every single CoverBox's kick/base/backsplash band (stove islands,
  // prep + service counters, freezer, crates, barrels) is repainted this one
  // near-black plum, and ONLY cover ever uses it. A player should be able to tell
  // "this collides" from the colour alone, anywhere in the arena, before reading
  // shape at all.
  coverPlinth: '#191320',
  // Round-7: the backsplash WALL specifically (see `coverPlinthPanel` in
  // `buildMaterials`) needs a touch more headroom than the reserved trim colour
  // above — a texture `map` is multiplicative against the base colour, and
  // `coverPlinth` is dark enough (RGB ~25,19,32) that even a strong texture has
  // almost no absolute range left to show. A little lighter, still unmistakably the
  // same near-black plum family, so the panel-seam texture actually reads.
  coverPlinthPanel: '#332A3D',

  // HAZARD — replaces the old pale-gold "crisp ring" that sat almost exactly the
  // tile's own hue+value (the critic's literal complaint: "faint warm glow,
  // low-contrast against near-white tile"). A hard-edged black/amber caution-tape
  // ring traced exactly on the real damage boundary, plus a hotter, more saturated
  // glow underneath it.
  hazardStripeBright: '#FFB300',
  hazardStripeDark: '#241207',
  hazardGlowHot: '#FF5A1E',

  // ── Puddle edges — NOT hazard markings any more ─────────────────────────────
  // These used to be `#D6FF3A` (neon lime, s0.77/v1.00) and `#2FE8FF` (electric
  // cyan, s0.82/v1.00): the "hard bright edge" HAZARD grammar borrowed from the
  // pot's caution ring, on the theory that a puddle had to shout that it slows you.
  //
  // That theory was retired — a puddle now only has to look like a puddle, and the
  // "you are slowed" signal lives on the CHARACTER (`game/vfx.ts`). The rework that
  // deleted the rest of that layer (glow halo, accent tint, warning icons) could not
  // delete THIS one, because the colours live here in `shared.ts` and that pass only
  // owned `hazards.ts` — so the single loudest element of the layer outlived the
  // change written to remove it. Measured at shipped framing, the two puddles were
  // 19% of the frame width, 3.8x a character's width, and the most saturated objects
  // on screen: a saturated gold disc ringed in neon lime and a cyan disc ringed in
  // neon cyan, which is the exact visual language of a MOBA pickup or heal pad.
  //
  // What they are now is a WET EDGE: the darker, thicker meniscus a real spill leaves
  // where the liquid piles against the floor. Same hue family as the pool it edges
  // (so grease still reads as grease and water as water), but well down in value and
  // saturation, so the boundary comes from a VALUE step against the tile rather than
  // from chroma. Nothing in the arena reads these as a warning any more. Note these
  // are authored below the intended on-screen chroma on purpose: `stage.ts`'s grade
  // pushes saturation UP, so an "already muted" colour still arrives with life in it.
  greaseRim: '#7E6738',
  waterRim: '#5C8496',

  // New mid-lane cover (see the four `supply_barrel`s below) — round-7 RECOLOUR:
  // a critic mistook this prop for an explosive hazard and marked the arena down
  // for not telegraphing it. It never was one — it's plain cover, like the crates —
  // but the critic's mistake is itself the real bug: red means "danger" everywhere
  // else in this arena (the hazard ring, its glow, its caution stripes all live in
  // the amber/red band — see `hazardStripeBright`/`hazardGlowHot` below), so a red
  // COVER prop was actively lying about what it does. Every other cover prop reads
  // as safe-to-approach; this is the one place the arena accidentally spoke the
  // hazard language for something you're supposed to hide behind. Recoloured to a
  // saturated navy — the real-world "supply/water drum" convention (blue plastic
  // barrels read as cargo almost universally, the same way red/orange reads as
  // explosive) — and distinct in both hue and value from every other blue already
  // in the palette: much darker/more desaturated than the freezer's bright sky-cyan
  // (`freezerBody`) and the hub's vivid `tealTile`, and bluer (less teal, less
  // violet) than `steel`/`spiceCartBody`. Still bold enough to read as its own
  // landmark, never implying "this explodes."
  barrelBody: '#2E5A8A',
  barrelBodyDark: '#1D3B5C',

  // ── Round-6 fix: spice-cart body ─────────────────────────────────────────────
  // The cart's body used to share `tealTileDark` with the floor's own decorative
  // "hub zone" mat directly beneath it — the exact bug the round-6 critic flagged
  // ("cannot tell whether these are raised blocking terrain... or pure floor
  // decals"): a blocking CoverBox and a walkable floor decal painted the identical
  // colour. A violet nowhere else in KPAL keeps the cart's "cool counterpoint to the
  // warm hub" role while making it unmistakably its OWN thing, never confusable with
  // the mat it sits on.
  spiceCartBody: '#6C4FA6',
  spiceCartBodyDark: '#4A3572',

  // ── Round-6 fix: loose ground debris (mistaken for gameplay pickups) ─────────
  // `buildHubDebris`/`buildDebrisPile` used to include a bright-red "tomato" sphere
  // in their rotation. Small, red, scattered loose on the floor around the hazard
  // ring, it read exactly like a collectible pickup and sat far too close in hue to
  // the hazard's own amber/red caution grammar. Blueberry-violet keeps the "loose
  // veg" variety without ever using red for anything that isn't the hazard itself.
  debrisBerry: '#4C5FC4',

  // Cool utility rubber mat under the two walk-in freezers — round-6 "vary the four
  // corner mats" fix: only the two PANTRY corners had a distinguishing floor pad
  // (the warm wood `woodPad`); the two FREEZER corners sat on bare checkerboard tile.
  // A cool grey mat (never used anywhere else) gives all four corners their own
  // floor treatment instead of two matching and two bare.
  utilityMat: '#95A6AC',
  utilityMatDark: '#6D7C81',
} as const;

// ─────────────────────────────────────────────────────────────────────────────
// Shared materials — created once per arena instance, reused across every prop
// that shares a surface type. Kept in a factory function so nothing leaks between
// repeated `createKitchenArena()` calls (e.g. hot-reload during preview iteration).
// ─────────────────────────────────────────────────────────────────────────────

export function buildMaterials() {
  // ── Round-7 texture kit ──────────────────────────────────────────────────────
  // The recurring, round-over-round critic complaint has been the SAME finding every
  // time: "flat, single-value fills per surface with almost no internal gradient —
  // painted blockout, not finished material." Every reference frame gets most of its
  // material read from texture almost for free (mowed-grass stripes, brick coursing,
  // tile wear); this arena had exactly one place doing that (the hazard stripe/scorch
  // decals) and a solid colour everywhere else. These canvas textures (see
  // `./textures.ts` for the generators and the shared design rules) are assigned as
  // `map` below on every major surface family so the fix is broad, not another single
  // spot-fix. Built once per arena instance, same lifetime as everything else here.
  const tileWearA = makeTileWearTexture(4001);
  const tileWearB = makeTileWearTexture(4029);
  const woodGrainWarm = makeWoodGrainTexture(4111);
  const butcherBlockTex = makeButcherBlockTexture(4177);
  const brushedSteel = makeBrushedMetalTexture(4211);
  const brushedFreezer = makeBrushedMetalTexture(4237);
  const plankWarm = makePlankTexture(4271, 4);
  const plankHerb = makePlankTexture(4293, 3);
  const burlapTex = makeBurlapTexture(4321);
  const barrelTex = makeBarrelTexture(4357);
  const panelSeamTex = makePanelSeamTexture(4391);
  // Round-7 second pass — a few more surfaces that turned out to still be flat
  // single-value fills once the first batch above was actually visible on screen
  // (see the freezer lid: a SEPARATE material from `freezerBody`, missed entirely
  // by the first pass despite being the single biggest flat panel in the arena at
  // default gameplay framing). Own texture instances (not reused ones) so each can
  // carry its own `repeat` without fighting another surface's tuning.
  const rugWeave = makeBurlapTexture(4451);
  const cartMetal = makeBrushedMetalTexture(4487);
  const utilityMatTex = makeTileWearTexture(4519);
  const potMetalTex = makeBrushedMetalTexture(4547);

  // Floor tiles: applied at repeat (1,1) — each tile box's own UV already spans
  // 0..1 across its top face (see `buildFloor`), so the generator's one "tile's
  // worth" of wear IS the whole face, not a pattern meant to repeat within it.
  // Two different seeds (A for the light tile, B for the dark) so alternating
  // checkerboard squares don't show the identical mottling.
  tileWearA.repeat.set(1, 1);
  tileWearB.repeat.set(1, 1);
  // Wood pad is shared between the big pantry floor pads (~14x13m) and the small
  // rolling-pin prop — a single moderate repeat is the best compromise across both.
  woodGrainWarm.repeat.set(3, 3);
  butcherBlockTex.repeat.set(3, 1);
  brushedSteel.repeat.set(1, 1);
  // Own texture instance (not shared with `steel`/`steelDark`) so this can carry a
  // wider repeat suited to the freezer's much bigger flat faces without changing the
  // stove/service tops' streak scale.
  brushedFreezer.repeat.set(3, 2);
  burlapTex.repeat.set(2, 2);
  // Hub rugs are long thin rectangles (150x80wu / 80x150wu) — an elongated repeat
  // keeps the weave cells roughly square instead of stretched.
  rugWeave.repeat.set(3, 5);
  cartMetal.repeat.set(2, 2);
  // This pad is enormous (420x340wu, ~21x17m) and `makeTileWearTexture`'s features
  // (one border ring, a handful of sparse blotches/scuffs) are discrete, not a
  // continuous pattern — at a low repeat, most of any given camera framing could
  // land entirely inside one cell's flat interior and show nothing. A denser repeat
  // guarantees a border line (at minimum) crosses through frame from any angle.
  utilityMatTex.repeat.set(6, 5);
  potMetalTex.repeat.set(1, 1);

  const mats = {
    // Roughness spread across the floor/cabinet/crate surfaces is deliberate: identical
    // mid-roughness everywhere is what makes a scene read as shadeless plastic even
    // under working lights, because nothing catches a distinct specular highlight.
    tileLight: toonMat({ color: KPAL.tileLight, ramp: RAMP_SOFT(), roughness: 0.55, map: tileWearA }),
    tileDark: toonMat({ color: KPAL.tileDark, ramp: RAMP_SOFT(), roughness: 0.55, map: tileWearB }),
    subfloor: toonMat({ color: KPAL.subfloor, ramp: RAMP_SOFT(), roughness: 0.92 }),
    border: toonMat({ color: KPAL.border, ramp: RAMP_SOFT(), roughness: 0.7 }),
    woodPad: toonMat({ color: KPAL.woodPad, ramp: RAMP_SOFT(), roughness: 0.68, map: woodGrainWarm }),
    woodSeam: toonMat({ color: KPAL.woodSeam, ramp: RAMP_SOFT(), roughness: 0.75 }),
    // Unlit on purpose: a lit near-white toonMat disc this pale caught the same
    // key+fill overexposure as the counter tops and rendered as a hard white lump
    // instead of a soft dusting. flatMat can't blow out — it ignores scene lighting
    // entirely, so the low opacity below is the only thing controlling how it reads.
    flour: flatMat(KPAL.flour, { transparent: true, opacity: 0.45 }),
    // Generic worn-floor marks — dark grime near the fryer, a cool wet sheen near the
    // sink. Small, cheap, and exactly the kind of graphic-not-fine floor wear the
    // reference frames are full of and this arena was missing.
    floorGrime: flatMat('#3E2A18', { transparent: true, opacity: 0.22 }),
    floorWet: flatMat('#3E90BE', { transparent: true, opacity: 0.2 }),

    cabinet: toonMat({ color: KPAL.cabinet, roughness: 0.62, map: woodGrainWarm }),
    cabinetDark: toonMat({ color: KPAL.cabinetDark, roughness: 0.65, map: woodGrainWarm }),
    butcherBlock: toonMat({ color: KPAL.butcherBlock, roughness: 0.5, map: butcherBlockTex }),
    // `steel`/`steelDark` also get the brushed texture as a `roughnessMap`, not just
    // `map` — the same streak pattern darkening the diffuse read also breaks up the
    // specular highlight into fine bands instead of one smooth glossy patch, which is
    // what an actual brushed-metal counter top does under a key light.
    steel: glossyMat({ color: KPAL.steel, roughness: 0.32 }),
    steelDark: glossyMat({ color: KPAL.steelDark, roughness: 0.36 }),

    freezerBody: glossyMat({ color: KPAL.freezerBody, roughness: 0.4 }),
    freezerDoor: toonMat({ color: KPAL.freezerDoor, roughness: 0.45, map: brushedFreezer }),
    freezerTrim: toonMat({ color: KPAL.freezerTrim, roughness: 0.5 }),
    // Frosty lid cap, noticeably lighter/cooler than the body — from the steep
    // top-down camera the freezer's flat top is almost the whole silhouette, so this
    // two-tone break (plus the bright rim trim ringing it) is what keeps its huge top
    // face reading as a lid catching light rather than a single flat coloured slab.
    // Round-7: this is the SINGLE biggest flat-fill surface in the whole arena at the
    // default gameplay framing (a freezer corner fills a huge fraction of the frame,
    // top-down) and was missed by the first texture pass entirely — it's its own
    // material, not `freezerBody`, so `brushedFreezer` had to be wired here too.
    freezerLid: toonMat({ color: '#7FD6EE', roughness: 0.3, map: brushedFreezer }),
    // Cold ground light spilling out in front of each freezer door — unlit so it
    // reads as emitted light rather than a painted floor patch.
    freezerGlow: flatMat(KPAL.freezerGlow, { transparent: true, opacity: 0.28 }),

    crateWood: toonMat({ color: KPAL.crateWood, roughness: 0.72, map: plankWarm }),
    crateSlat: toonMat({ color: KPAL.crateSlat, roughness: 0.78, map: plankWarm }),
    burlap: toonMat({ color: KPAL.burlap, roughness: 0.85, map: burlapTex }),
    burlapDark: toonMat({ color: KPAL.burlapDark, roughness: 0.88, map: burlapTex }),

    herbCrateWood: toonMat({ color: KPAL.herbCrateWood, roughness: 0.7, map: plankHerb }),
    herbCrateSlat: toonMat({ color: KPAL.herbCrateSlat, roughness: 0.78, map: plankHerb }),
    herbLeafA: toonMat({ color: KPAL.herbLeafA, roughness: 0.58 }),
    herbLeafB: toonMat({ color: KPAL.herbLeafB, roughness: 0.6 }),
    potteryWarm: toonMat({ color: KPAL.potteryWarm, roughness: 0.65 }),

    // Round-7: these long rug-like floor patches under the hub chokepoint props were
    // a completely flat colour fill in the first review pass — a woven-mat texture
    // (reusing the burlap generator; hue comes entirely from the material colour)
    // gives them a fabric read instead of a painted rectangle.
    tealTile: toonMat({ color: KPAL.tealTile, ramp: RAMP_SOFT(), roughness: 0.5, map: rugWeave }),
    tealTileDark: toonMat({ color: KPAL.tealTileDark, ramp: RAMP_SOFT(), roughness: 0.55, map: rugWeave }),

    potMetal: glossyMat({ color: KPAL.potMetal, roughness: 0.22 }),
    potMetalDark: toonMat({ color: KPAL.potMetalDark, roughness: 0.4, map: potMetalTex }),
    broth: glossyMat({ color: PALETTE.broth, roughness: 0.22, emissive: '#3a1a05', emissiveIntensity: 0.12 }),
    flame: flatMat(KPAL.flame, { transparent: true, opacity: 0.92 }),
    flameCore: flatMat(KPAL.flameCore, { transparent: true, opacity: 0.95 }),

    water: glossyMat({ color: KPAL.water, roughness: 0.3, transparent: true, opacity: 0.82 }),
    waterCap: toonMat({ color: KPAL.waterCap, roughness: 0.4 }),
    grease: glossyMat({ color: KPAL.grease, roughness: 0.32, transparent: true, opacity: 0.85 }),

    tomato: glossyMat({ color: PALETTE.tomato, roughness: 0.28 }),
    lettuce: toonMat({ color: PALETTE.lettuce, roughness: 0.6 }),
    onion: toonMat({ color: PALETTE.onion, roughness: 0.6 }),
    ink: flatMat(PALETTE.ink),
    chalk: flatMat('#F4EFE2', { transparent: true, opacity: 0.85 }),
    dust: flatMat('#FFF6DC', { transparent: true, opacity: 0.5 }),

    // Thin glossy cap trim along backsplash/counter top edges — the one bright,
    // slightly specular accent used purely as an edge highlight (see `addBacksplash`).
    rimLight: glossyMat({ color: KPAL.rimLight, roughness: 0.28 }),

    // ── Round-5 visual-grammar materials ────────────────────────────────────────
    // BLOCKING's one reserved material. Unlit (flatMat) rather than lit, so it
    // reads as the same near-black plum from every angle and under every light
    // change — a lit dark colour this size still picks up enough key-light lift to
    // drift toward the same mid-brown/mid-slate every OTHER dark trim already used
    // (cabinetDark, freezerTrim, crateSlat...), which is exactly the "no reserved
    // material" problem being fixed here.
    coverPlinth: flatMat(KPAL.coverPlinth),

    // Round-7: the vertical backsplash WALL (see `addBacksplash`) is one of the
    // biggest single flat-colour surfaces on every stove/prep/service counter — at
    // gameplay pitch it's the whole visible "riser" face — so it gets its own
    // textured variant instead of sharing bare `coverPlinth`. Same near-black plum
    // (still unambiguously the reserved BLOCKING hue), plus horizontal tile-coursing
    // seam lines. `coverPlinth` itself stays untouched/flat: it's reused on tiny trim
    // (kicks, feet, bungs) where a patterned texture would be barely visible and
    // isn't worth diluting the "one flat reserved colour = blocking" instant-read cue.
    coverPlinthPanel: flatMat(KPAL.coverPlinthPanel),

    // Puddle wet-edge materials — see the KPAL note. Still unlit: the edge of a
    // spill wants to hold one steady value rather than pick up a key-light gradient
    // across a 5m disc, and unlit is also what keeps it from washing out on the lit
    // side the way an earlier lit ring did.
    greaseRim: flatMat(KPAL.greaseRim),
    waterRim: flatMat(KPAL.waterRim),

    // New mid-lane cover body — glossy like the pot's metal. Round-7: recoloured
    // from red to navy (see the KPAL note on `barrelBody`) after a critic mistook it
    // for an explosive hazard; the drum texture below (banding + a neutral shipping
    // chevron, see `makeBarrelTexture`) reinforces "supply cargo," not "danger."
    barrelBody: glossyMat({ color: KPAL.barrelBody, roughness: 0.4 }),
    barrelBodyDark: toonMat({ color: KPAL.barrelBodyDark, roughness: 0.55, map: barrelTex }),

    // Round-6 fixes — see the KPAL notes on `spiceCartBody` / `debrisBerry`. Round-7:
    // both the cart body and the utility mats were still flat single-value fills —
    // a metal-panel texture on the cart (it's a wheeled trolley), a subtle worn-mat
    // texture (reusing the tile-wear generator) on the rubber utility pads.
    spiceCartBody: toonMat({ color: KPAL.spiceCartBody, roughness: 0.5, map: cartMetal }),
    spiceCartBodyDark: toonMat({ color: KPAL.spiceCartBodyDark, roughness: 0.6, map: cartMetal }),
    debrisBerry: toonMat({ color: KPAL.debrisBerry, roughness: 0.55 }),
    utilityMat: toonMat({ color: KPAL.utilityMat, ramp: RAMP_SOFT(), roughness: 0.65, map: utilityMatTex }),
    utilityMatDark: toonMat({ color: KPAL.utilityMatDark, ramp: RAMP_SOFT(), roughness: 0.68, map: utilityMatTex }),

    // Fake ambient occlusion — a soft dark radial decal dropped under ROUND props
    // (the pot) so they read as sitting ON the floor with real contact darkening,
    // rather than pasted on top of it.
    contactShadow: new THREE.MeshBasicMaterial({
      map: makeContactShadowTexture(),
      transparent: true,
      depthWrite: false,
      opacity: 0.9,
    }),
    // Every CoverBox's automatic footprint shadow (see `addCover`) uses THIS instead
    // of `contactShadow`: a blurred ROUNDED-RECT, not a radial gradient. The critic's
    // #1 finding was that cover has "no AO where it meets the floor" — the old radial
    // gradient was drawn as a circle inscribed in the plane's UV space, so for any
    // elongated rectangular footprint (a stove island is 170x90wu) the gradient hit
    // zero alpha well inside the plane's edges and its CORNERS got no darkening at
    // all. A rounded-rect shadow hugs the actual silhouette — corners included — at
    // any aspect ratio, which is what makes every box prop read as pressing into the
    // floor instead of floating on it.
    groundedShadow: new THREE.MeshBasicMaterial({
      map: makeGroundedShadowTexture(),
      transparent: true,
      depthWrite: false,
      opacity: 1,
    }),

    // Round-7: stronger, wider-spread grounding pair reserved for `LARGE_COVER_KINDS`
    // (see `addCover` and the texture notes above `makeGroundedShadowTextureStrong`).
    groundedShadowStrong: new THREE.MeshBasicMaterial({
      map: makeGroundedShadowTextureStrong(),
      transparent: true,
      depthWrite: false,
      opacity: 1,
    }),
  };

  // ── Post-creation texture wiring ─────────────────────────────────────────────
  // `glossyMat`/`flatMat` (unlike `toonMat`) don't take a `map` option, but every
  // material they return is a real `THREE.Material` — mutating `.map` directly here
  // is exactly as valid as passing it through a constructor option, and doing it in
  // one place keeps `buildMaterials` itself the single source of truth for which
  // surface gets which texture.
  mats.steel.map = brushedSteel;
  mats.steel.roughnessMap = brushedSteel;
  mats.steel.needsUpdate = true;
  mats.steelDark.map = brushedSteel;
  mats.steelDark.roughnessMap = brushedSteel;
  mats.steelDark.needsUpdate = true;
  mats.freezerBody.map = brushedFreezer;
  mats.freezerBody.roughnessMap = brushedFreezer;
  mats.freezerBody.needsUpdate = true;
  mats.barrelBody.map = barrelTex;
  mats.barrelBody.needsUpdate = true;
  mats.coverPlinthPanel.map = panelSeamTex;
  mats.coverPlinthPanel.needsUpdate = true;
  mats.potMetal.map = potMetalTex;
  mats.potMetal.roughnessMap = potMetalTex;
  mats.potMetal.needsUpdate = true;

  return mats;
}

export type Materials = ReturnType<typeof buildMaterials>;

// ─────────────────────────────────────────────────────────────────────────────
// Small geometry helpers
// ─────────────────────────────────────────────────────────────────────────────

/** Cheap cylinder, rounded-looking enough at this scale without the roundedBox cost. */
export function puck(radius: number, height: number, segments = 20): THREE.CylinderGeometry {
  return new THREE.CylinderGeometry(radius, radius, height, segments);
}

export function mesh(geo: THREE.BufferGeometry, mat: THREE.Material, name: string): THREE.Mesh {
  const m = new THREE.Mesh(geo, mat);
  m.name = name;
  m.castShadow = true;
  m.receiveShadow = true;
  return m;
}

export function noOutline<T extends THREE.Object3D>(o: T): T {
  o.userData.noOutline = true;
  return o;
}

// ─────────────────────────────────────────────────────────────────────────────
// Fake contact AO — a soft dark radial-gradient decal, canvas-generated once and
// shared by every prop's footprint. This is the single cheapest lever for killing
// the "pasted onto the floor" look: real-time contact shadows are expensive, but a
// baked dark ellipse under each prop reads as grounding at gameplay camera distance.
// ─────────────────────────────────────────────────────────────────────────────

function makeContactShadowTexture(): THREE.CanvasTexture {
  const size = 128;
  const canvas = document.createElement('canvas');
  canvas.width = canvas.height = size;
  const ctx = canvas.getContext('2d')!;
  const g = ctx.createRadialGradient(size / 2, size / 2, 0, size / 2, size / 2, size / 2);
  g.addColorStop(0, 'rgba(12,8,6,0.55)');
  g.addColorStop(0.55, 'rgba(12,8,6,0.28)');
  g.addColorStop(1, 'rgba(12,8,6,0)');
  ctx.fillStyle = g;
  ctx.fillRect(0, 0, size, size);
  const tex = new THREE.CanvasTexture(canvas);
  tex.needsUpdate = true;
  return tex;
}

function roundRectPath(ctx: CanvasRenderingContext2D, x: number, y: number, w: number, h: number, r: number): void {
  ctx.beginPath();
  ctx.moveTo(x + r, y);
  ctx.arcTo(x + w, y, x + w, y + h, r);
  ctx.arcTo(x + w, y + h, x, y + h, r);
  ctx.arcTo(x, y + h, x, y, r);
  ctx.arcTo(x, y, x + w, y, r);
  ctx.closePath();
}

/**
 * Blurred rounded-rect ground shadow, used for every `addCover` footprint (see the
 * `groundedShadow` material). Unlike a radial gradient, this hugs a RECTANGULAR
 * silhouette at any aspect ratio — corners included — because the shape itself is a
 * rounded rect, not a circle stretched to fit. The blur is faked by filling the rect
 * far off-canvas and letting `shadowBlur` paint only its soft edge onto the visible
 * area, so there's no hard sharp-rect artifact in the middle.
 *
 * `pad`/`blur` are deliberately SMALL fractions of the canvas (4% / 5%). A first pass
 * used 10%/11%, which reads fine on its own but is wrong for how this is actually
 * used: `addCover` sizes the plane only slightly larger than the prop's own footprint
 * (a "snug" contact shadow, scale ~1.3), which means the prop's edge lands almost
 * exactly where a wide feather is still ramping up from zero — so the one place a
 * player actually looks (right where the prop meets the floor) was the FAINTEST part
 * of the whole texture. A narrow feather keeps the interior at near-full alpha all
 * the way out to just shy of the plane edge, so a snug oversize actually shows a
 * crisp, visible dark edge instead of a barely-there haze.
 */
function makeGroundedShadowTexture(): THREE.CanvasTexture {
  const size = 256;
  const canvas = document.createElement('canvas');
  canvas.width = canvas.height = size;
  const ctx = canvas.getContext('2d')!;
  const pad = size * 0.04;
  const rectW = size - pad * 2;
  const rectH = size - pad * 2;
  const radius = size * 0.14;
  const blur = size * 0.05;
  const off = size * 3; // pushes the actual filled rect well outside the visible canvas

  ctx.save();
  ctx.shadowColor = 'rgba(14,9,6,0.88)';
  ctx.shadowBlur = blur;
  ctx.shadowOffsetX = -off;
  ctx.fillStyle = 'rgba(14,9,6,0.88)';
  roundRectPath(ctx, off + pad, pad, rectW, rectH, radius);
  ctx.fill();
  ctx.restore();

  const tex = new THREE.CanvasTexture(canvas);
  tex.needsUpdate = true;
  return tex;
}

/**
 * Round-7 "Strong" variant of `makeGroundedShadowTexture`, reserved for the large
 * structural cover pieces (stove islands, freezers, prep/service counters — see
 * `LARGE_COVER_KINDS` near `addCover`). The critic's finding was specific: small
 * props (barrels, crates, the lane pots) already show a consistent grounding
 * shadow, but the big platforms "mostly rely on a darker side-face... shadow
 * opacity/contrast is much lower than either shipped reference." The base
 * texture's feather is deliberately NARROW (4%/5% of the canvas) so a snug
 * 1.3x-oversized plane still shows a crisp edge close to a SMALL prop — but that
 * also means almost all of a LARGE prop's much bigger absolute overhang sits
 * under the fully-opaque interior, which is itself hidden beneath the box's own
 * geometry, leaving only a thin sliver of feather actually visible on the open
 * floor around it. This widens the feather zone and raises peak alpha so a wider,
 * darker band is actually visible beyond a big platform's silhouette instead of
 * fading to nothing within a few centimetres.
 */
function makeGroundedShadowTextureStrong(): THREE.CanvasTexture {
  const size = 256;
  const canvas = document.createElement('canvas');
  canvas.width = canvas.height = size;
  const ctx = canvas.getContext('2d')!;
  // Round-8: feather tightened (pad 0.10 -> 0.075, blur 0.13 -> 0.09). Every number
  // in this texture was tuned while ~63% of the decal's area was z-occluded by the
  // opaque floor pads the props stand on (see `BAKED_SHADOW_Y`), so a wide, soft,
  // far-reaching feather was compensating for a shadow that mostly never arrived.
  // With the decal actually on screen the same feather reads as a broad grey haze
  // spreading well past the prop on every side — grounding wants a defined dark band
  // hugging the silhouette, not a fog bank around it.
  const pad = size * 0.075;
  const rectW = size - pad * 2;
  const rectH = size - pad * 2;
  const radius = size * 0.16;
  const blur = size * 0.09;
  const off = size * 3;

  ctx.save();
  ctx.shadowColor = 'rgba(10,6,4,0.95)';
  ctx.shadowBlur = blur;
  ctx.shadowOffsetX = -off;
  ctx.fillStyle = 'rgba(10,6,4,0.95)';
  roundRectPath(ctx, off + pad, pad, rectW, rectH, radius);
  ctx.fill();
  ctx.restore();

  const tex = new THREE.CanvasTexture(canvas);
  tex.needsUpdate = true;
  return tex;
}

/**
 * Y height of every baked grounding decal in the arena. Only the contact/AO ring is
 * left (the directional cast blob that used to sit 0.002 below it is gone — see the
 * `SHADOW_DIR` note at the top of this file), but the constant stays because this
 * height has been wrong twice, both times by being buried under something opaque, and
 * it must keep being one number that a future decal cannot be added without.
 *
 * ── The history, because the number looks arbitrary and is not ──────────────────
 *
 * v1 put these at y = 0.011, INSIDE the floor tile's own 0.03m-tall box (top face at
 * +0.015), so every AO decal in the arena rendered behind opaque tile geometry and
 * was visible only through the ~6%-wide grout gaps. v2 raised them to 0.019/0.017 —
 * clear of the TILE, and that part is still true.
 *
 * v2 was still wrong, and a measured probe (garish-recolour every decal, render at
 * shipped framing) showed exactly how: only ~37% of contact-decal area reaches the
 * screen, ~75% for the cast decals. The tile is not the only opaque thing on the
 * floor. Above it sit `floor.ts`'s pads and mats — `floor_woodpad`,
 * `floor_utility_pad`, `floor_teal_zone`(+`_trim`), `floor_border` at y = 0.045-0.048
 * and `floor_seam`/`floor_drain` at 0.062 — all opaque, all depth-writing. And props
 * are DELIBERATELY placed on those pads, so the exact props that most needed
 * grounding (the spice carts and stacked pots standing on the hub's teal mats) had
 * their entire shadow drawn underneath an opaque plane and reaching the screen at
 * literally zero pixels, while the ~37% that did survive was the part leaking out
 * onto bare tile — un-anchored to anything, which is precisely the "mushy
 * directionless blob" a lighting round was once scored down for.
 *
 * That measurement also half-settles a question this project had queued for a long
 * time ("are these baked decals a redundant third darkening layer now that real
 * shadows are crisp — delete them?"). The answer split once they were measured on
 * screen rather than argued about: the CONTACT ring was never redundant, it was mostly
 * INVISIBLE, and the fraction that showed was the least useful fraction — so it stays.
 * The CAST blob genuinely was redundant and is gone (round 9, see `SHADOW_DIR`).
 *
 * 0.07 is chosen as a window, not a taste call: above the highest opaque floor layer
 * (`floor.ts`'s `FINE_Y` = 0.062) and below the lowest prop kick/plinth (~0.08), so a
 * decal clears every pad it might be standing on while still being occluded by the
 * prop body that casts it. Anything in `arena/floor.ts` that grows past 0.062, or any
 * prop base that drops below 0.08, breaks this and must move this constant with it.
 */
const BAKED_SHADOW_Y = 0.07;

/** Elliptical AO blob sized to a prop's own footprint (in metres), slightly oversized
 * so it peeks out past the silhouette the way a real contact shadow would. */
export function buildContactShadow(mat: THREE.Material, wM: number, dM: number, scale = 1.25): THREE.Mesh {
  const m = new THREE.Mesh(new THREE.PlaneGeometry(wM * scale, dM * scale), mat);
  m.rotation.x = -Math.PI / 2;
  m.position.y = BAKED_SHADOW_Y;
  m.renderOrder = 1;
  m.name = 'contact_shadow__no_outline';
  m.castShadow = false;
  m.receiveShadow = false;
  noOutline(m);
  return m;
}


/** Counter-rotates the fixed world `SHADOW_DIR` into a group's local (pre-yaw) space,
 * so `addCover` can offset a prop's contact ring along the light direction whichever
 * way the prop itself is yawed. */
function localShadowDir(yawDeg: number): { x: number; z: number } {
  const yawRad = THREE.MathUtils.degToRad(yawDeg);
  const c = Math.cos(-yawRad), s = Math.sin(-yawRad);
  return { x: SHADOW_DIR.x * c + SHADOW_DIR.z * s, z: -SHADOW_DIR.x * s + SHADOW_DIR.z * c };
}

/**
 * Round-7 grounding fix. The critic's finding was specific: small props (barrels,
 * crates, the lane pots) already show a consistent grounding ring, but "the
 * larger structural pieces (the counters/platforms, which matter most for the
 * 'is this a wall' read) mostly rely on a darker side-face rather than a separate
 * ground-contact shadow falling onto the floor beyond their footprint." These are
 * exactly the CoverBox `kind`s tall/wide enough that a steep top-down camera mostly
 * shows their flat top, with only a thin riser visible at the near edge — the same
 * kinds the file header already calls out as needing a vertical `addBacksplash`
 * wall for the same reason. They get the wider, higher-contrast AO ring (see
 * `makeGroundedShadowTextureStrong`) so the grounding shadow actually pokes out past
 * the body and its kick, instead of the
 * thin sliver the base (small-prop-tuned) texture would leave visible on something
 * this big.
 */
const LARGE_COVER_KINDS = new Set(['stove_island', 'freezer', 'prep_counter', 'fryer_counter', 'sink_counter']);

/**
 * Raised counter-back wall + a thin bright cap trim along its top edge.
 *
 * This is the single biggest lever for the "cover has no height" finding: the steep
 * gameplay pitch (58°) looks almost straight down on a ~0.9m cabinet, so a flat top
 * plus a sliver of side face reads as barely-there relief. A vertical wall reads
 * unambiguously as height from ANY pitch, and the light-catching cap trim on top of
 * it is the literal "chamfer that catches a different light angle" the brief asked
 * for. Always placed at local -Z (the "outer/back" edge, away from the pot — see the
 * yaw convention noted on `buildStoveIsland`'s herb sprig) so it never faces the
 * hazard and never reads as blocking the lane a player is dashing down.
 *
 * `wM`/`dM` are the CALLER's already-shrunk cabinet footprint (not the raw CoverBox
 * size), and the wall is kept well inside it on every axis — this only adds height,
 * never pushes visible geometry past the CoverBox the player actually collides with.
 */
export function addBacksplash(g: THREE.Group, M: Materials, wM: number, dM: number, cabH: number, mat: THREE.Material, heightM = 0.4): void {
  const wallD = dM * 0.1;
  const wall = mesh(roundedBox(wM * 0.9, heightM, wallD, 0.025), mat, 'backsplash');
  wall.position.set(0, cabH + heightM / 2, -dM * 0.5 + wallD * 0.5 + dM * 0.02);
  g.add(wall);
  const cap = mesh(roundedBox(wM * 0.9, 0.03, wallD + 0.015, 0.015), M.rimLight, 'backsplash_cap__no_outline');
  cap.position.set(0, cabH + heightM + 0.015, wall.position.z);
  noOutline(cap);
  g.add(cap);
}

/**
 * Thin bright picture-frame trim tracing all FOUR edges of a flat top surface.
 *
 * `addBacksplash` only lights up one edge — fine for silhouette height, but which
 * edge that is depends on which way the object happens to face the camera, and the
 * default judged gameplay screenshot is centred on the hub with the near/pot-facing
 * edge of the north stove islands toward camera, NOT their back edge. A full
 * perimeter frame guarantees the "chamfer catching light" cue reads no matter which
 * side of a prop the camera happens to be looking at, in this shot or any other.
 * `w`/`d` are the exact footprint of the top surface this rims (already in metres).
 */
export function addTopRim(g: THREE.Group, M: Materials, w: number, d: number, y: number, thick = 0.035): void {
  const hw = w / 2, hd = d / 2;
  const bar = (bw: number, bd: number, px: number, pz: number) => {
    const b = mesh(new THREE.BoxGeometry(bw, 0.022, bd), M.rimLight, 'top_rim__no_outline');
    b.position.set(px, y, pz);
    noOutline(b);
    g.add(b);
  };
  bar(w, thick, 0, hd - thick / 2);
  bar(w, thick, 0, -hd + thick / 2);
  bar(thick, d - thick * 2, hw - thick / 2, 0);
  bar(thick, d - thick * 2, -hw + thick / 2, 0);
}

// ─────────────────────────────────────────────────────────────────────────────
// Floor layer heights, in METRES. Gameplay/overview cameras sit 20-100m out, where a
// standard depth buffer has nowhere near enough precision to resolve millimetre gaps
// reliably — an early pass stacked these a few mm apart and lost z-fights against the
// tile field beneath. Centimetre-scale separation is still visually flat from gameplay
// distance but leaves the depth buffer an unambiguous answer.
// ─────────────────────────────────────────────────────────────────────────────
export const FLOOR_Y = {
  subfloor: -0.1,
  tile: 0,
  decal: 0.15, // scorch patch, puddles, flour, wood pads, tile ring, border trim
  fine: 0.25, // marks drawn ON a decal (wood seams, hazard ring/glow)
} as const;

// ─────────────────────────────────────────────────────────────────────────────
// Cover placement — the single source of truth linking each CoverBox to its visual.
// ─────────────────────────────────────────────────────────────────────────────

export interface CoverSpec {
  x: number; y: number; w: number; h: number; kind: string;
  yawDeg?: number;
  build: (wM: number, dM: number) => THREE.Group;
}

export function addCover(propsGroup: THREE.Group, cover: CoverBox[], M: Materials, spec: CoverSpec): THREE.Group {
  const wM = wu(spec.w);
  const dM = wu(spec.h);
  const group = spec.build(wM, dM);
  // Rounded-rect grounded shadow — see the `groundedShadow` material comment. 1.3x
  // is snug against the redesigned texture's much narrower feather (see
  // `makeGroundedShadowTexture`), so the prop's own edge sits in the near-full-alpha
  // interior instead of the faint outer ramp. `LARGE_COVER_KINDS` (see the round-7
  // note above `LARGE_COVER_KINDS`) get a bigger oversize AND the wider/darker
  // `groundedShadowStrong` texture, so the shadow visibly clears the prop's own body
  // instead of staying hidden under it — the exact "counters/platforms... rely on a
  // darker side-face rather than a separate ground-contact shadow" gap.
  //
  // Round-8: both oversizes come DOWN (1.6 -> 1.34 large, 1.3 -> 1.22 small) and the
  // ring is now OFFSET along the shadow direction instead of sitting concentric.
  // Same reason as the texture-feather change (see `makeGroundedShadowTextureStrong`):
  // every one of these numbers was chosen while most of the decal's area was buried
  // under an opaque floor pad, so they were sized to make a mostly-invisible thing
  // register. Fully visible, a 1.6x ring around an 11.5m freezer threw 3.5m of grey
  // in every direction — including the side the key light comes from, where a real
  // contact shadow is at its thinnest. Offsetting it a fraction of its own overhang
  // along `SHADOW_DIR` keeps the band tight on the lit side and lets it run a little
  // further on the shaded side, which is what makes it read as light-driven contact
  // darkening rather than a symmetric grey halo pasted under the prop.
  const isLarge = LARGE_COVER_KINDS.has(spec.kind);
  const aoMat = isLarge ? M.groundedShadowStrong : M.groundedShadow;
  const aoScale = isLarge ? 1.34 : 1.22;
  const ao = buildContactShadow(aoMat, wM, dM, aoScale);
  const aoDir = localShadowDir(spec.yawDeg ?? 0);
  ao.position.x += aoDir.x * wM * (aoScale - 1) * 0.42;
  ao.position.z += aoDir.z * dM * (aoScale - 1) * 0.42;
  group.add(ao);
  // No baked cast shadow any more. The one that used to be added here measured
  // 0.13/255 across the frame while its frozen direction pinned the key light's
  // azimuth in place — see the `SHADOW_DIR` note at the top of this file. The real
  // shadow map casts it now.
  const p = groundPos(spec.x, spec.y);
  group.position.set(p.x, 0, p.z);
  if (spec.yawDeg) group.rotation.y = THREE.MathUtils.degToRad(spec.yawDeg);
  group.name = `cover:${spec.kind}`;
  propsGroup.add(group);
  cover.push({ x: spec.x, y: spec.y, w: spec.w, h: spec.h, kind: spec.kind });
  return group;
}
