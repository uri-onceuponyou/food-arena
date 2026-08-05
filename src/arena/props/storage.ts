/**
 * Storage-family cover props — walk-in freezers (NW/SE landmark corners), the pantry
 * cluster crates (produce crates, the cool-toned herb crate, flour sacks), and the
 * hub's stacked-pots chokepoint prop. These are mostly stationary "furniture" cover:
 * bulky, simple silhouettes meant to read at a glance and block a lane or corner,
 * as opposed to the counters (`./counters.ts`, which carry function — burners, prep
 * surfaces, basins) or the small mid-lane/decorative props (`./smallProps.ts`).
 *
 * Every builder here follows the COVER GRAMMAR defined at the top of `./counters.ts`
 * — near-black plinth at full CoverBox footprint, two-tone vertical body, solid mass
 * at least `COVER_MIN_H` tall. Read that block before changing any height here.
 *
 * `buildCrateSmall` is kept here even though nothing currently places it (see
 * `buildHerbCrate`'s doc comment, which references it as the sibling silhouette it
 * was modelled from).
 */

import * as THREE from 'three';
import { toonMat, roundedBox } from '../../render/toon';
import { puck, mesh, noOutline, buildContactShadow, type Materials } from '../shared';
import { addCoverPlinth, addRoundCoverPlinth, addCoverSides, addCoverCap, tinted, COVER_BODY_FRAC, COVER_MIN_H } from './counters';

/**
 * Third step down the herb crate's green ladder. `KPAL` lives in `shared.ts` (not this
 * agent's to edit) and stops at two greens, but the cover grammar needs three tones on
 * every prop — bright cap, mid side, dark skirt — so this one is authored here.
 * Built lazily and cached: `buildMaterials()` is per-arena-instance to avoid leaks on
 * hot reload, but a plain colour with no texture has no per-instance state to leak.
 *
 * Authored at the value we actually want on screen: the post chain no longer eats a
 * channel (see PROGRESS's colour-grade note), so there is nothing to pre-compensate.
 */
let herbCrateSkirtMat: THREE.Material | null = null;
function herbSkirt(): THREE.Material {
  if (!herbCrateSkirtMat) herbCrateSkirtMat = toonMat({ color: '#0D3327', roughness: 0.78 });
  return herbCrateSkirtMat;
}

/**
 * Round-9 note, kept because it is the second time this exact mistake has been made
 * here: the crates used to carry a pair of `wM * 1.02`, yaw-ROTATED slat boxes. Those
 * were wider than the CoverBox they belonged to and rotated off-axis, so from the
 * gameplay camera they read as a spiky star-shaped DECAL poking out from under a flat
 * green square — actively reinforcing the "is this a floor mat?" confusion this round
 * exists to fix. The first replacement was an axis-aligned band hugging the box, which
 * rendered as a dark letterbox SLOT cut into the face. Neither survived a look at the
 * pixels. Horizontal articulation on these crates now comes only from the two-tone
 * skirt and the stacked-box seam, both of which are real silhouette steps rather than
 * stripes painted across a face.
 */

export function buildFreezerSized(M: Materials, wM: number, dM: number): THREE.Group {
  const g = new THREE.Group();
  const bw = wM * COVER_BODY_FRAC, bd = dM * COVER_BODY_FRAC;
  const y0 = addCoverPlinth(g, M, wM, dM);
  const capT = 0.14;
  const bodyTop = 2.4;

  // The freezer keeps its bright cyan identity on the TOP plane (which is most of what
  // this camera pitch shows of an 11.5 x 9.5m prop) and gives its VERTICAL faces the
  // deep-blue steel tones. Its old body/skirt pair (`freezerBody` over `freezerDoor`)
  // was a ~10% value step, i.e. no step at all on screen — measured.
  addCoverSides(g, bw, bd, y0, bodyTop - capT - y0, M.steel, M.steelDark, 0.09, 'freezer_body');

  // ── The roof, and the value it has to clear ───────────────────────────────────
  // HISTORY — superseded by the measured table further down; kept because it records
  // what the failure looked like each time. Measured at prop framing: the `freezerLid`
  // roof rendered
  // rgb(93,227,249) — **luma 200.4, V 0.976, blue one step off the rail** — while the
  // walkable `utility_mat` it stands on rendered luma 184.9. **15 luma between a
  // 11.5 x 9.5m solid roof and the floor pad under it**, both flat, both crisp-edged,
  // the roof covering more screen area than any other single surface in the map. That
  // is the "blocking vs walkable is indistinguishable" finding at its largest scale,
  // and it is measured, not inferred: a critic looking at this shot has literally no
  // value cue telling it which of two big pale cyan rectangles stops a bullet.
  //
  // Two changes, both here rather than in `shared.ts` (not this agent's file):
  //   1. the roof leaves the clipped near-white cyan for a keyed value that clears the
  //      pad it stands on by a wide margin in BOTH directions — the prop now owns a real
  //      value ladder instead of two clipped planes. See the table below for the number,
  //      which has had to move twice;
  //   2. a raised PARAPET kerb rings it. A roof bounded by a raised edge is a
  //      building; a plane that runs flat to its own boundary is a floor. It is also
  //      the one piece of "chamfered edge" geometry that survives shipped framing
  //      here, because it is 24cm tall rather than a 3cm bevel.
  // First pass at '#4FA8C4' landed the roof at luma 152.2 against the mat's 153.2 —
  // separated on saturation (0.889 vs 0.078) but with ZERO value separation, which
  // leaves the cue dependent on a single channel. Down another step so the roof is
  // also unambiguously darker than the pad and unambiguously brighter than its own
  // walls (luma 74): a three-rung ladder on the axis that survives everything.
  //
  // ── THIS CONSTANT HAS GONE STALE TWICE. RE-MEASURE BEFORE YOU TRUST IT. ────────
  // Every number in the paragraph above was true when it was written and none of them
  // is true now, because the surface this is keyed against — `floor.ts`'s WALKABLE
  // utility pad — has been re-keyed twice underneath it, both times by a different
  // agent. That is the whole story of this constant, and it is why the measurement is
  // recorded here rather than the conclusion.
  //
  // Sampled at the `freezer_nw` scan station with `tools/tmp/caphex.mjs`, which reports
  // what a material ARRIVES at rather than what it was authored as:
  //
  //   generation   BLOCKING freezer roof          WALKABLE utility pad        gap
  //   r1  #4FA8C4  luma 152                       luma 153                    1   <- bug
  //   r2  #3E8399  luma 117  hue 194  sat 0.89    luma 109  hue 198 sat 0.44   8   <- bug
  //   now #4A9DB8  luma 143  hue 193  sat 0.89    luma  78  hue 199 sat 0.44  65
  //                                              (bright variant, luma 117)   26
  //
  // The r2 pair is the documented blocking-vs-walkable failure envelope almost exactly
  // (within ~3 deg of hue and ~10 luma), with the roof BRIGHTER than the pad rather than
  // darker as intended — and it is not a small surface: at this station the roof is 13.8%
  // of the frame and the pad it stands on is 17.7%, so the failure was two enormous cyan
  // rectangles with nothing but saturation between them.
  //
  // The pad is now TWO variants, luma 78 (17.7% of frame) and luma 117 (1.7%), so any
  // roof value between ~90 and ~110 is trapped between them. The only positions with
  // real clearance are above both or below the freezer's own steel walls (50), and below
  // the walls inverts the prop. So the roof goes clearly ABOVE: luma 143, which is 65
  // clear of the dominant pad, 26 clear of the bright one, and 93 above its own walls —
  // the bright cap the cover grammar asks for, with the biggest margin available in
  // either direction.
  //
  // Chroma is deliberately KEPT at 0.89. Cool chroma is the half of the wheel the ten
  // reference plates run at full strength (0.343) and this arena is at 72% of that even
  // after this pass, so quieting a cool surface is the one move the saturation contract
  // explicitly forbids. VALUE, not saturation, was wrong here — twice.
  //
  // ── Round 13: the same argument, one rung further up ─────────────────────────
  // Everything above holds; the roof was still not bright ENOUGH. Measured on a frozen
  // snapshot at station 430:240, where this roof is **13.23% of the frame** — the
  // single largest prop surface the arena owns at any station — it renders luma 150,
  // against reference prop tops at 0.745-0.848 (190-216). `p6-frame-vs-reference`:
  // share of playfield above luma 0.80 is ours 0.67-1.68% vs 2.39-19.06% across six
  // `gameplay_topdown/` plates, non-overlapping. The arena had no bright family at all.
  //
  // `caphex` on that station, before editing (delivered hexes; authored is the 1/0.72
  // power of these, see `liftArenaValue`):
  //
  //   #51ACCA  luma 150  sat 0.89   <- was
  //   #52D7FF  luma 177  sat 0.84   <- is        (authored HSV S 0.598 -> 0.680)
  //   #66DBFF  luma 184  sat 0.76   rejected — buys 7 luma for 0.08 of saturation
  //   #7AE0FF  luma 192  sat 0.67   rejected — same trade, worse
  //
  // The paragraph above says quieting a cool surface is the one move the saturation
  // contract forbids, and that is exactly why the two brighter candidates lost: the
  // chosen one raises AUTHORED saturation and absolute chroma (S x V 0.431 -> 0.680)
  // while the rejected ones spend chroma to buy value. Value, not saturation — a third
  // time. Clearance over the pads (78 / 117) goes from 65 / 26 to 99 / 60.
  const roofMat = tinted(M, M.freezerLid, '#52D4FF');
  addCoverCap(g, wM, dM, bodyTop, capT, roofMat, 'freezer_lid');

  const parapetH = 0.24, parapetT = Math.min(wM, dM) * 0.05;
  const pw = wM * 0.99, pd = dM * 0.99;
  const parapetBar = (bwid: number, bdep: number, px: number, pz: number) => {
    const b = mesh(roundedBox(bwid, parapetH, bdep, 0.04), M.steelDark, 'freezer_parapet');
    b.position.set(px, bodyTop + parapetH / 2, pz);
    g.add(b);
  };
  parapetBar(pw, parapetT, 0, pd / 2 - parapetT / 2);
  parapetBar(pw, parapetT, 0, -pd / 2 + parapetT / 2);
  parapetBar(parapetT, pd - parapetT * 2, pw / 2 - parapetT / 2, 0);
  parapetBar(parapetT, pd - parapetT * 2, -pw / 2 + parapetT / 2, 0);

  // ── The UPPER STOREY, and why it is the freezer's real fix ───────────────────
  // r1 gave this prop a mid-value roof, a parapet and a small condenser. A fresh
  // blind critic still opened with *"on first look I read it as a swimming pool"* and
  // *"a low chest with an open lid"*, and it measured the reason: the roof presents
  // ~350,000 px of screen against ~50,000 px of front face — **7:1**. Value and
  // saturation cannot beat a 7:1 area ratio; only geometry can, and the only geometry
  // that helps is geometry that DELETES top-face area by standing on it.
  //
  // So the walk-in freezer becomes an actual two-storey cold room. The upper block
  // covers ~34% of the roof and stands 1.15m proud of it, which:
  //   - removes a third of the flat plane outright,
  //   - leaves the remainder as an L-shaped strip that cannot read as a pool
  //     (a liquid surface is always one unbroken level),
  //   - takes the prop to 3.55m, past the 2.88m where cover starts clipping a
  //     character's chest, so this finally becomes the arena's one prop that CUTS a
  //     standing character — the critic's named "definitive tell" — while staying
  //     under the 3.78m where a character could actually vanish (see the collision
  //     proof in `./counters.ts`).
  const upperW = wM * 0.56, upperD = dM * 0.6, upperH = 1.15;
  const upperX = -wM * 0.16, upperZ = -dM * 0.16;
  addCoverSides(g, upperW, upperD, bodyTop, upperH - 0.12, M.steel, M.steelDark, 0.08, 'freezer_upper');
  addCoverCap(g, upperW, upperD, bodyTop + upperH, 0.12, roofMat, 'freezer_upper_cap');
  // `addCoverSides`/`addCoverCap` build at the group origin, so shift the two meshes
  // they just added rather than re-implementing them.
  for (const child of g.children.slice(-3)) {
    child.position.x += upperX;
    child.position.z += upperZ;
  }

  // Frost band along the upper storey's base — the bright identity cyan, now on a
  // narrow trim rather than on the biggest plane in the map.
  const frost = mesh(roundedBox(upperW * 1.02, 0.14, upperD * 1.02, 0.04), M.freezerBody, 'freezer_frost_band');
  frost.position.set(upperX, bodyTop + 0.07, upperZ);
  g.add(frost);

  // Panel joints across the remaining open roof. A manufactured metal roof is panels
  // bolted together; they survive shipped framing because they are geometry with their
  // own top face rather than a line painted in a texture.
  for (const sx of [0.16, 0.34]) {
    const seam = mesh(roundedBox(0.1, 0.07, dM * 0.94, 0.02), M.steelDark, 'freezer_roof_seam__no_outline');
    seam.position.set(wM * sx, bodyTop + 0.035, 0);
    noOutline(seam);
    g.add(seam);
  }

  // Door panel + handle on the +Z face (rotated per-instance by the caller via yaw).
  // Kept flush with (never past) the body's outer face — this whole prop's visible
  // silhouette must stay inside its CoverBox footprint. Bright `freezerBody` cyan
  // against the dark steel sides, so the door is now the thing that says "freezer"
  // from ground level, not the whole box.
  const doorH = (bodyTop - capT - y0) * 0.76;
  const door = mesh(roundedBox(bw * 0.5, doorH, 0.08, 0.05), M.freezerBody, 'freezer_door');
  door.position.set(0, y0 + doorH / 2 + 0.06, bd / 2 - 0.04);
  g.add(door);

  const handle = mesh(roundedBox(0.07, doorH * 0.4, 0.05, 0.02), M.freezerTrim, 'freezer_handle');
  handle.position.set(bw * 0.17, y0 + doorH * 0.55, bd / 2 - 0.025);
  g.add(handle);

  // Vent grille — a few thin light strips near the top.
  for (let i = 0; i < 3; i++) {
    const strip = mesh(roundedBox(bw * 0.5, 0.03, 0.02, 0.01), M.freezerLid, 'freezer_vent');
    strip.position.set(-bw * 0.18, bodyTop - capT - 0.22 - i * 0.09, bd / 2 - 0.005);
    noOutline(strip);
    g.add(strip);
  }

  // ── Roof condenser — a second, lower step on the open half of the roof ───────
  // Round-10 r2: the two ring-shaped "fans" that used to sit on this are gone. A
  // blind critic read them as burners — *"a hotplate on top of a freezer... a burner
  // on ice is a material contradiction"* — because a pair of dark tori on a pale plate
  // is exactly the hob this arena's own stove islands use. Louvre slats say
  // "refrigeration unit" and share no shape language with anything else in the map.
  const condW = bw * 0.24, condD = bd * 0.26, condH = 0.7;
  const condX = bw * 0.3, condZ = bd * 0.2;
  const cond = mesh(roundedBox(condW, condH, condD, 0.06), M.steel, 'freezer_condenser');
  cond.position.set(condX, bodyTop + condH / 2, condZ);
  g.add(cond);
  const condCap = mesh(roundedBox(condW * 0.96, 0.09, condD * 0.96, 0.03), roofMat, 'freezer_condenser_cap');
  condCap.position.set(condX, bodyTop + condH + 0.03, condZ);
  g.add(condCap);
  for (let i = 0; i < 4; i++) {
    const louvre = mesh(roundedBox(condW * 0.82, 0.05, 0.06, 0.02), M.freezerLid, 'freezer_louvre__no_outline');
    louvre.position.set(condX, bodyTop + condH * 0.72 - i * 0.13, condZ + condD / 2 - 0.02);
    noOutline(louvre);
    g.add(louvre);
  }

  // Round-9: the cold floor glow that used to sit in front of the door is GONE. It
  // was authored at y = 0.02, i.e. underneath `floor.ts`'s opaque utility pad (0.045)
  // that the freezer deliberately stands on, so it has been rendering into the depth
  // buffer and reaching the screen at zero pixels for its entire life. Reviving it
  // would have added one more crisp, saturated, walkable-looking floor decal directly
  // beside solid cover — the exact confusion this round is fixing.

  return g;
}

export function buildCrateSmall(M: Materials, wM: number, dM: number): THREE.Group {
  const g = new THREE.Group();
  const bw = wM * COVER_BODY_FRAC, bd = dM * COVER_BODY_FRAC;
  const y0 = addCoverPlinth(g, M, wM, dM);
  const capT = 0.1;
  const h = Math.max(COVER_MIN_H, Math.min(wM, dM) * 0.4) - y0;

  addCoverSides(g, bw, bd, y0, h - capT, M.cabinetDark, M.crateSlat, 0.05, 'crate_body');
  addCoverCap(g, wM, dM, y0 + h, capT, M.crateWood, 'crate_lid');

  const top = y0 + h;
  const tomato = mesh(new THREE.SphereGeometry(0.14, 12, 10), M.tomato, 'crate_tomato');
  tomato.position.set(-bw * 0.18, top + 0.12, bd * 0.1);
  g.add(tomato);
  const lettuce = mesh(new THREE.SphereGeometry(0.15, 10, 8), M.lettuce, 'crate_lettuce');
  lettuce.scale.set(1, 0.75, 1);
  lettuce.position.set(bw * 0.15, top + 0.1, -bd * 0.12);
  g.add(lettuce);

  return g;
}

/**
 * Two produce crates stacked, the upper one smaller and kicked off-axis.
 *
 * Round-9 height fix. This was 0.96m of crate on a 4.0 x 4.0m CoverBox — an aspect
 * ratio of 0.24, which from a 58deg top-down camera is a painted square with a lip,
 * not an object. A STACK rather than one taller box: it fills the footprint at the
 * base (so the visual still matches the collision), gives a stepped silhouette that
 * no flat decal can imitate, and reads as pantry storage rather than a plinth.
 */
export function buildCrateTall(M: Materials, wM: number, dM: number): THREE.Group {
  const g = new THREE.Group();
  const bw = wM * COVER_BODY_FRAC, bd = dM * COVER_BODY_FRAC;
  const y0 = addCoverPlinth(g, M, wM, dM);
  // Round-10: 0.9/0.66 (top 1.76m, aspect 0.44 on a 4.0m box) -> 1.30/0.70, landing the
  // crown at 2.20m = 1.05x a character, aspect 0.55. See the COMMITTED HEIGHT RATIO
  // note in `./counters.ts`: a stack whose base box is shorter than it is wide still
  // reads as a plinth from the gameplay pitch no matter how many boxes are on it.
  const h1 = 1.62, h2 = 0.84, capT = 0.12;

  // Each box: dark sides, one thin BRIGHT lid. That single bright plane per box is
  // what the earlier "gold picture-frame rim" was trying to be and failing at — a
  // uniform-width bright outline does not change with light direction, so it reads as
  // an ink line rather than a chamfer. A real slab does.
  // ── The measured heart of "blocking vs walkable is indistinguishable" ────────
  // Sampled at shipped framing, on this prop, standing where the arena actually
  // places it:
  //
  //   walkable `floor.ts` woodPad   rgb(233,146,43)  luma 157.0  H 33  S 0.813
  //   BLOCKING crate lid            rgb(240,148,43)  luma 160.4  H 32  S 0.820
  //
  // 3.4 luma, 1 degree of hue and 0.007 saturation apart. The solid crate and the
  // painted floor pad it stands on are the SAME COLOUR — not "similar", identical
  // inside measurement noise. `crateWood` (#CC7E23) and `woodPad` (#C9945A) are two
  // warm mid-oranges with the same plank/grain texture family, and one of them is
  // cover while the other is decoration.
  //
  // Value alone cannot fix this, because the lid has to stay the BRIGHT plane of the
  // cover grammar and the pad is already bright. The separation therefore goes on the
  // saturation axis — which only became usable when the post chain stopped collapsing
  // everything to HSV 1.00 (see PROGRESS). A pale pine lid at roughly S 0.4 against a
  // pad at S 0.81 is unmistakable at any zoom, keeps the crate's bright cap, and reads
  // as bare untreated crate timber rather than the pad's varnished decking.
  //
  // Re-measured at `pantry_ne` after the floor re-key: '#DEBE87' was arriving
  // rgb(232,192,97) — **luma 194, sat 0.58** — against a plank pad that has since fallen
  // to luma 115 / sat 0.24. So the pad went quiet and the lid did not, leaving it the
  // brightest plane in the arena once the prep-counter cap comes down to 168, and the
  // MORE saturated of the pair rather than the less. Now rgb(202,177,130), luma 179,
  // sat 0.36: still unmistakably the crate's bright cap (64 luma over the pad), still
  // bare pine, no longer the loudest thing in the pantry.
  // Round 11: same luma band, more chroma (HSL 0.24 -> 0.37). Bare pine is one of the
  // two places the arena deliberately keeps warm chroma — small, mid-value, never in
  // the salience grid's top cells — so it pays part of what the rim trim, the plank
  // pads and the brass stack give back. The 64-luma step over the pad below it, which
  // is what this constant exists for, is unchanged.
  // ── Round 13: brighter again, and the collision this constant guards is now GONE ──
  // The whole paragraph above is a hue-collision argument against `floor.ts`'s warm
  // orange plank pad. That pad no longer exists: `KPAL.woodPad` is #577182, a cool
  // blue-grey at hue 204 (see its own note in `shared.ts` — "it stops being timber").
  // The pair is now 166 degrees of hue apart, so the saturation-axis escape this
  // constant was cut for has nothing left to escape from, and the value cut it paid
  // for is pure cost against the highlight-band deficit `prepCap` documents.
  // `caphex` at 1150:330, where this lid is 1.46% of frame:
  //   #C6A46A  luma 163 sat 0.59   <- was
  //   #FFCC73  luma 185 sat 0.54   <- is   (authored HSV S 0.467 -> 0.550, chroma
  //                                          S x V 0.329 -> 0.550)
  // Still the crate's bright cap, now by 70+ luma over the pad instead of 64.
  const lidMat = tinted(M, M.crateWood, '#FFCB73');
  addCoverSides(g, bw, bd, y0, h1 - capT, M.cabinetDark, M.crateSlat, 0.05, 'crate_bottom');
  addCoverCap(g, wM, dM, y0 + h1, capT, lidMat, 'crate_bottom_lid');

  // A 0.78-scale second box left a 22% ledge — from the gameplay pitch, two nested
  // rectangles a hair apart in size read as ONE plane with a line drawn on it. 0.62
  // plus a bigger offset makes the step unmistakable, and a third small crate wedged
  // at the base turns a symmetric ziggurat into a pile.
  const topCrate = new THREE.Group();
  addCoverSides(topCrate, bw * 0.62, bd * 0.62, y0 + h1, h2 - capT, M.cabinetDark, M.crateSlat, 0.05, 'crate_top');
  addCoverCap(topCrate, bw * 0.63, bd * 0.63, y0 + h1 + h2, capT, lidMat, 'crate_top_lid');
  topCrate.position.set(bw * 0.13, 0, -bd * 0.11);
  topCrate.rotation.y = 0.18;
  g.add(topCrate);

  // r4: 0.62 -> 0.95 tall. At 0.62 on a 1.36m-wide box this third crate was itself a
  // slab, and a critic read the pair of small tilted tops as "lid boards hovering off
  // the body with a visible gap" rather than as boxes. A crate must be taller than it
  // is thin at every level of the stack, or the fix that made the pile read stops
  // working on the pile's own parts.
  const sideCrate = new THREE.Group();
  const sh = 0.95;
  addCoverSides(sideCrate, bw * 0.34, bd * 0.34, y0 + h1, sh - 0.09, M.crateSlat, M.cabinetDark, 0.04, 'crate_side');
  addCoverCap(sideCrate, bw * 0.35, bd * 0.35, y0 + h1 + sh, 0.09, lidMat, 'crate_side_lid');
  sideCrate.position.set(-bw * 0.28, 0, bd * 0.26);
  sideCrate.rotation.y = -0.34;
  g.add(sideCrate);

  const onion = mesh(new THREE.SphereGeometry(0.15, 10, 8), M.onion, 'crate_onion');
  onion.position.set(bw * 0.13, y0 + h1 + h2 + 0.12, -bd * 0.11);
  g.add(onion);

  return g;
}

/**
 * Cool-toned herb crate — same stacked silhouette language as `buildCrateTall` but
 * built entirely from the teal-green side of the palette. Exists specifically to break
 * up the orange/tan/cream monochrome the critic called out: a whole crate body in a
 * different hue family, not just a small coloured prop sitting on a warm one.
 *
 * Round-9: this was the single worst offender for "blocking vs walkable is
 * indistinguishable" — 0.82m tall on a 4.5 x 4.5m CoverBox (aspect 0.18), rendered as
 * a flat saturated green square with cones on it and a star of off-axis slats poking
 * out from underneath. Rebuilt to the shared cover grammar.
 */
export function buildHerbCrate(M: Materials, wM: number, dM: number): THREE.Group {
  const g = new THREE.Group();
  const bw = wM * COVER_BODY_FRAC, bd = dM * COVER_BODY_FRAC;
  const y0 = addCoverPlinth(g, M, wM, dM);
  // Round-10: 0.88/0.66 (top 1.74m on a 4.5m-square CoverBox — aspect 0.39, the worst
  // in the arena) -> 1.32/0.72, crown at 2.24m = 1.07x a character, aspect 0.50. This
  // crate is the arena's single largest FOOTPRINT-to-height offender and the one a
  // shipped-framing render showed reading as a flat green slab on an orange mat.
  const h1 = 1.64, h2 = 0.86, capT = 0.12;

  addCoverSides(g, bw, bd, y0, h1 - capT, M.herbCrateSlat, herbSkirt(), 0.05, 'crate_body');
  addCoverCap(g, wM, dM, y0 + h1, capT, M.herbCrateWood, 'crate_body_lid');

  // Same 0.74 -> 0.60 step-size change as `buildCrateTall`: a second box nearly the
  // size of the first reads as a line drawn on one plane, not as a stack.
  const topCrate = new THREE.Group();
  addCoverSides(topCrate, bw * 0.6, bd * 0.6, y0 + h1, h2 - capT, M.herbCrateSlat, herbSkirt(), 0.05, 'crate_top');
  addCoverCap(topCrate, bw * 0.61, bd * 0.61, y0 + h1 + h2, capT, M.herbCrateWood, 'crate_top_lid');
  topCrate.position.set(-bw * 0.14, 0, bd * 0.13);
  topCrate.rotation.y = -0.2;
  g.add(topCrate);

  const sideCrate = new THREE.Group();
  const sh = 0.95;
  addCoverSides(sideCrate, bw * 0.33, bd * 0.33, y0 + h1, sh - 0.09, herbSkirt(), M.herbCrateSlat, 0.04, 'crate_side');
  addCoverCap(sideCrate, bw * 0.34, bd * 0.34, y0 + h1 + sh, 0.09, M.herbCrateWood, 'crate_side_lid');
  sideCrate.position.set(bw * 0.27, 0, -bd * 0.25);
  sideCrate.rotation.y = 0.3;
  g.add(sideCrate);

  // Bundled herb sprigs instead of loose produce — bold cone clusters read as
  // bunched greens at gameplay distance without needing fine leaf detail. Sized as
  // a fraction of the crate's own footprint (not a fixed metre size) so it stays
  // legible whatever scale this crate is built at.
  // Centred on the (now much smaller, further-offset) top crate, not on the group.
  const crown = y0 + h1 + h2;
  const leafR = Math.min(bw, bd) * 0.055;
  const bundlePositions: Array<[number, number]> = [
    [-bw * 0.14 - bw * 0.11, bd * 0.13 + bd * 0.09],
    [-bw * 0.14 + bw * 0.1, bd * 0.13 - bd * 0.1],
  ];
  const leafMats = [M.herbLeafA, M.herbLeafB];
  bundlePositions.forEach(([sx, sz]) => {
    for (let k = 0; k < 3; k++) {
      const leaf = mesh(new THREE.ConeGeometry(leafR, leafR * 2.6, 7), leafMats[k % 2], 'crate_herb_leaf');
      const a = (k / 3) * Math.PI * 2;
      leaf.position.set(sx + Math.cos(a) * leafR, crown + leafR * 1.3, sz + Math.sin(a) * leafR);
      leaf.rotation.set(Math.sin(a) * 0.3, 0, Math.cos(a) * 0.3);
      g.add(leaf);
    }
  });

  return g;
}

/**
 * Flour sacks on a pallet.
 *
 * Round-9: the two sacks used to be sized off `min(wM, dM) * 0.34` with a 1.15 Y
 * stretch, which on this CoverBox produced 2.74m spheres — 1.3x a character, the
 * TALLEST cover in the arena and openly competing with the cast's silhouettes, while
 * still leaving most of the footprint empty. Three smaller sacks on a proper pallet
 * fill the box, land in the same 1.8-2.2m band as everything else, and keep the
 * soft-organic read that distinguishes this prop from the boxes around it.
 */
export function buildFlourSack(M: Materials, wM: number, dM: number): THREE.Group {
  const g = new THREE.Group();
  // A PALLET, not a bare plinth. The first pass put the standard 0.26m near-black
  // band across the whole 5.5 x 3.5m CoverBox with three small sacks on it, and the
  // uncovered remainder rendered as a black VOID cut into the floor — the reserved
  // BLOCKING colour only reads as a base band when a body sits on most of it. So the
  // near-black stays as a thin ground band and a wooden deck covers it, which is also
  // what a real sack stack sits on.
  // r3: the deck was `crateSlat`, which rendered rgb(125,73,37) luma 81 — INSIDE the
  // band the long cast shadows occupy, so a blind critic put it at LOW confidence with
  // "its value sits inside the cast-shadow band, so it reads as a hole in the floor at
  // least as readily as a pallet." A pallet is bare pine; lifting it clear of the
  // shadow band is what makes it read as a thing rather than an absence.
  // r4: the deck is now a real PALLET with thickness and its own side face. All three
  // blind critics in a row landed on this prop as the least readable cover in the
  // arena — "no toe-kick or base, so 'run over the sacks' is a live reading", then
  // "six smooth spheres on a paper-thin board... no cue at all separating it from a
  // pickup cluster." A 13cm board on a 5.5 x 3.5m footprint presents no side face at
  // all from the gameplay pitch, so the whole assembly had nothing under it saying
  // "solid". 0.34m of deck plus visible bearer blocks is what a pallet actually looks
  // like and is thick enough to show an edge at shipped framing.
  // r5, and the same stale-measurement story as the freezer roof: the deck was lifted
  // to '#B08A5E' to clear the cast-shadow band, and it did — but sampled at `pantry_ne`
  // it now arrives rgb(175,118,47), **luma 125 / hue 33 / sat 0.73**, against the
  // WALKABLE plank pad it stands on at luma 115 / hue 31 / sat 0.24. Ten luma and TWO
  // degrees of hue: a solid pallet and a painted floor pad, in the documented failure
  // envelope, separated by saturation alone. Opened up to rgb(158,130,83) — luma 133,
  // sat 0.47 — which doubles the value gap to 18 and takes a third of the chroma out of
  // a warm surface the reference has no room for, while staying clear of the shadow
  // band (81) that made a `crateSlat` deck read as a hole.
  const kick = addCoverPlinth(g, M, wM, dM, 0.1);
  const deckH = 0.34;
  const deckMat = tinted(M, M.crateSlat, '#96681F');
  const deck = mesh(roundedBox(wM * 0.98, deckH, dM * 0.98, 0.03), deckMat, 'sack_pallet');
  deck.position.y = kick + deckH / 2;
  g.add(deck);
  // Bearer blocks under the deck edge, in the dark skirt tone — the gap-and-block
  // rhythm is the one silhouette detail that says "pallet" rather than "board".
  for (const bx of [-0.34, 0, 0.34]) {
    const bearer = mesh(roundedBox(wM * 0.16, kick + 0.04, dM * 0.99, 0.02), M.crateSlat, 'sack_pallet_bearer');
    bearer.position.set(wM * bx, (kick + 0.04) / 2, 0);
    g.add(bearer);
  }
  const y0 = kick + deckH;

  // ── Round-10 r2: five sacks in one layer -> a stacked PYRAMID ────────────────
  // A blind critic read the flat five-sack layer as *"knee-high... decoration"* and put
  // it at ~0.4x character height, against a measured 2.04m (0.97x). Same mechanism as
  // everywhere else this round: five spheres spread edge to edge across a 5.5 x 3.5m
  // footprint present almost pure top-face, so the pile reads as a texture on the
  // pallet rather than a mass on it. Four bigger sacks in a base row with two more
  // resting in the valleys between them stacks the silhouette instead of tiling it,
  // and the second course is what turns a field of bumps into a heap.
  // r4: a SACK, not a sphere. "Six smooth spheres... duplicates the round white
  // character's silhouette" and "the same primitive and near the same apparent size as
  // the scattered pea spheres" were both named by blind critics, and both are true of a
  // bare `SphereGeometry`. A real sack is a squashed, ELONGATED mass pinched at one end
  // with a tied neck standing proud of it — three cheap changes (non-uniform scale, a
  // per-sack yaw so the long axes are not parallel, and a visible neck stub above the
  // tie) that together stop it reading as a ball.
  const r = Math.min(wM, dM) * 0.21;
  let sackYaw = 0.3;
  const sackAt = (sx: number, sy: number, sz: number, rr: number) => {
    const sack = mesh(new THREE.SphereGeometry(rr, 14, 12), M.burlap, 'sack_body');
    sack.scale.set(1.34, 0.82, 1.0);
    sack.rotation.y = sackYaw;
    sack.position.set(sx, sy + rr * 0.82, sz);
    g.add(sack);
    const neck = mesh(puck(rr * 0.3, rr * 0.5, 8), M.burlap, 'sack_neck');
    neck.position.set(sx, sy + rr * 1.5, sz);
    g.add(neck);
    const tie = mesh(new THREE.TorusGeometry(rr * 0.33, 0.05, 6, 12), M.burlapDark, 'sack_tie');
    tie.rotation.x = Math.PI / 2;
    tie.position.set(sx, sy + rr * 1.44, sz);
    noOutline(tie);
    g.add(tie);
    sackYaw += 0.71;
  };
  const baseTop = y0 + r * 1.7;
  sackAt(-wM * 0.28, y0, dM * 0.13, r);
  sackAt(wM * 0.02, y0, dM * 0.15, r * 1.06);
  sackAt(wM * 0.3, y0, dM * 0.12, r);
  sackAt(-wM * 0.12, y0, -dM * 0.15, r * 1.04);
  sackAt(wM * 0.2, y0, -dM * 0.14, r);
  // Second course, sitting in the valleys of the first.
  sackAt(-wM * 0.12, baseTop, dM * 0.0, r * 0.92);
  sackAt(wM * 0.16, baseTop, -dM * 0.02, r * 0.86);
  return g;
}

/**
 * Stacked pots — the hub's two lane-mouth chokepoint props.
 *
 * ── Round-10 r3: COVER MUST NOT SHARE A SHAPE FAMILY WITH DAMAGE ──────────────
 * A blind critic classified this prop BLOCKING at **LOW** confidence, the worst score
 * any cover prop got, and named the reason exactly: *"it is the same grey ribbed
 * cylinder on a dark plinth as the boiling-pot hazard in the same frame, just smaller.
 * I cannot tell cover from hazard by looking."* It is right, and it is a gameplay bug,
 * not a taste note: the pot at the centre of the hub does
 * damage, these two sit in the
 * lane mouths either side of it, and both were grey ribbed metal cylinders with a dark
 * base. Mistaking cover for a hazard costs a player tempo; mistaking a hazard for
 * cover costs them the fight.
 *
 * So this prop leaves the hazard's material and silhouette family entirely:
 *   - WARM BRASS instead of the hazard's cold grey steel (`potMetal`/`potMetalDark`
 *     stay reserved to the pot, the hob and the service tops);
 *   - a wooden CRATE BASE under the stack, so the ground contact is a square wooden
 *     step rather than the hazard's round dark foot;
 *   - domed LIDS with a knob on the two lower pots, so the silhouette is a stack of
 *     closed vessels rather than one tapering open cylinder.
 */
export function buildLanePots(M: Materials, wM: number, dM: number): THREE.Group {
  const g = new THREE.Group();
  const base = Math.min(wM, dM);
  // ── Round 11: brass -> VERDIGRIS, and the semantic above is untouched ────────
  // The whole point of this pair is "NOT the hazard's cold grey steel", and patinated
  // copper satisfies that at least as well as brass does — it is still an aged copper
  // vessel, still nothing like the pot's drum, still its own landmark. What forced the
  // move is that brass was the arena's most saturated warm object after the hazard
  // itself: measured, `#B08A3C` arrived rgb(124,87,15) — HSL saturation **0.75**, hue
  // **40 deg**, which is the hamburger's own bun to within two degrees — over 0.8% of
  // frame across three stacked drums that read as one bright gold mass. A blind
  // critic's headline finding was that the environment spends the cast's exact hue on
  // its most attention-grabbing elements; on chroma-per-pixel this was the worst
  // offender per unit area in the arena.
  // Priced first: `#2E8F82` arrives rgb(12,98,87), hue 172, HSV 0.88, **HSL 0.78** —
  // so the prop keeps every bit of its loudness and simply spends it on the half of
  // the wheel the environment is allowed to own. It is also the arena's only 170-deg
  // hue, 22 deg off the herb crate and 21 off the freezer, so it stays a landmark.
  const brass = tinted(M, M.potMetal, '#2E8F82');
  const brassDark = tinted(M, M.potMetalDark, '#215F58');

  // A square wooden crate base, NOT the hazard's round dark foot. This also gives the
  // prop the same near-black plinth ledge every other CoverBox has.
  const y0 = addCoverPlinth(g, M, wM, dM, 0.18);
  const crateH = 0.42;
  addCoverSides(g, wM * 0.9, dM * 0.9, y0, crateH - 0.09, M.cabinetDark, M.crateSlat, 0.04, 'pot_crate');
  addCoverCap(g, wM * 0.9, dM * 0.9, y0 + crateH, 0.09, M.crateWood, 'pot_crate_lid');
  // Round props get a RADIAL contact decal of their own on top of `addCover`'s
  // rounded-rect one: the rect's corners are the wrong shape under a cylinder.
  g.add(buildContactShadow(M.contactShadow, wM, dM, 1.3));

  let y = y0 + crateH;
  const radii = [base * 0.38, base * 0.3, base * 0.21];
  for (let i = 0; i < radii.length; i++) {
    const h = base * 0.26;
    const pot = mesh(puck(radii[i], h, 16), i % 2 === 0 ? brass : brassDark, 'stack_pot');
    pot.position.y = y + h / 2;
    g.add(pot);
    const rim = mesh(new THREE.TorusGeometry(radii[i] * 0.99, radii[i] * 0.06, 6, 18), brassDark, 'stack_pot_rim');
    rim.rotation.x = Math.PI / 2;
    rim.position.y = y + h;
    noOutline(rim);
    g.add(rim);
    // A domed LID with a knob on every pot but the top one — the single cheapest way
    // to stop a stack of cylinders reading as one open cauldron.
    if (i < radii.length - 1) {
      const lid = mesh(new THREE.SphereGeometry(radii[i] * 0.92, 14, 6, 0, Math.PI * 2, 0, Math.PI * 0.42), brass, 'stack_pot_lid');
      lid.position.y = y + h;
      lid.scale.y = 0.5;
      g.add(lid);
    }
    y += h * 0.92;
  }
  const knob = mesh(puck(base * 0.05, 0.09, 10), brassDark, 'stack_pot_knob');
  knob.position.y = y + 0.05;
  noOutline(knob);
  g.add(knob);
  for (const sx of [-1, 1] as const) {
    const ear = mesh(new THREE.TorusGeometry(base * 0.07, base * 0.022, 6, 12, Math.PI), brassDark, 'stack_pot_ear');
    ear.rotation.set(0, Math.PI / 2, sx > 0 ? 0 : Math.PI);
    ear.position.set(sx * radii[0] * 0.98, y0 + crateH + base * 0.14, 0);
    g.add(ear);
  }
  return g;
}
