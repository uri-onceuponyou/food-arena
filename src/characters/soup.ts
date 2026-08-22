/**
 * Soup (Epic).
 *
 * Built on the shared ChibiRig — see `donut.ts` for the reference implementation of
 * this pattern. The rig supplies torso, arms, hands, legs, feet and all motion; this
 * file authors only the food mass on `rig.joints.head`, the face, a held ladle prop
 * and a palette.
 *
 * Identity is fixed by `rules.ts`: Soup, Epic rarity, Soup Splash / Noodle Toss /
 * Soup Dump.
 *
 * ── ⚠️ THE OLD HEADER SAID THE OPPOSITE OF THIS ONE, AND IT WAS THE DEFECT ────
 * WAS: *"the no-mouth, grey-eyed blank stare is EXPLICITLY kept: it is the one
 * genuinely unsettling-calm read in the whole cast."* **That note is VOID.** Uri
 * rejected exactly that construction on taco by name (*"no mouth, seems like a
 * hat"*), `docs/DECISIONS-FOR-URI.md` §42 predicted the same reject would land here,
 * and `rules.ts`'s `face:` spec has since been rewritten to demand a mouth. The
 * old wording is kept above rather than deleted because an agent reading only the
 * code would otherwise re-derive it: **CALM IS AN EXPRESSION, NOT AN ABSENCE.** A
 * blank face reads as unfinished, not as eerie.
 *
 * "Grey steam-coloured eyes" is gone for the same reason and it was worse: it
 * specified the irises to be the SAME VALUE FAMILY as the steam behind them, which
 * is why this face carried no value range at all. The face now runs pure-white
 * sclera (the brightest value anywhere on the character, by construction — see
 * `CERAMIC`) through a near-black pupil to a mouth with a real interior step.
 *
 * ── What this file owns, and what it now DOESN'T ─────────────────────────────
 * The bowl silhouette + rising steam is the landmark. A ladle in `handR` nods at
 * all three abilities. Uri, on the deployed build: *"add noodles or something in the
 * liquid, make the liquid more yellow than brown"* — so the liquid is now a hue-46
 * gold rather than a hue-25 orange, and it carries a noodle nest, scallion rings and
 * carrot coins in a `soup_broth_top` group that bobs WITH the surface. It carried a
 * depth ring and three garnish specks before that and they delivered **0 pixels at
 * every shipped camera**; see `brothTop` and `onUpdate` for the one operator that
 * did it. The body below the bowl is a stoneware POT STAND rather than
 * a bare rig torso, because the rig's tapered-sphere torso is 0.34 m half-wide at
 * the shoulder line while soup's shoulder pivots sit at 0.54 m — the arms and legs
 * were hanging in ~0.19 m of open background, which is Uri's *"limbs disattached"*
 * on this character, measured rather than guessed. See `buildPotStand`.
 */

import * as THREE from 'three';
import { BaseCharacter, type AnimContext } from './types';
import type { CharacterDef } from '../game/rules';
import { PALETTE } from '../game/rules';
import { toonMat, glossyMat, flatMat, outlineCharacter, roundedBox } from '../render/toon';
import { ChibiRig, type LimbPart } from './rig';
import { bodyType, withoutNeck } from './bodies';
// `loop` is deliberately no longer imported: it built the two torus arcs that read
// as ears. See `buildSilhouetteEvents`.
import { aim, knob, localBounds, massAnchor, rod } from './appendages';
import { CHARACTER_HEIGHT } from '../units';

/**
 * ── NEAR-WHITE CLIPPING, and this is a measured pixel defect rather than taste ──
 * `sepscan --mode chars` reports the share of a character above luma 0.94 at the
 * shipped camera and shipped facing, and the same code over the six hand-verified
 * Brawl Stars full-body plates gives the band: **0.0072-0.0929, median 0.0249**,
 * p95 0.805-0.9685. An independent critic audit measured the same thing on gameplay
 * plates and got even less headroom — Shelly 0.2%, Barley 0.0%, with empty-floor
 * controls at 0.0%, so it is the character and not the frame.
 *
 * This character measured **16.23%** clipped and p95 **0.9753**.
 *
 * It is the cost `docs/STATE.md` records as cast-mean p95 drifting 0.896 -> 0.923
 * during the value pass, seen at the pixel: the dark rung was won (p05 is now better
 * than both plates) and the light end went with it, onto exactly the top-facing
 * surfaces a 58deg camera sees most of. The fix is albedo, and it is NOT a
 * desaturation — scaling a warm off-white DOWN raises its chroma, which is the
 * direction `docs/LESSONS.md` records as falsified four times in the other one.
 */
// WAS `#DCD3C2` (luma 0.830). `rules.ts`'s rewritten `face:` spec names the trade
// explicitly and it is the reason this moved: the sclera can only be "the brightest
// value on the character" if the bowl stops competing with it, and the bowl is where
// the 16.23% above luma 0.94 lives — a large area, against eyes that are a few dozen
// pixels. So the sclera is paid for by taking the BOWL DOWN, not by adding white.
// -13% (0.830 -> 0.722) with the chroma left in; per `docs/LESSONS.md` scaling a warm
// off-white down RAISES its chroma, which is the direction this frame needs.
const CERAMIC = '#C6B79A';      // glazed bowl exterior, luma 0.722
// WAS `#E2D8C4`, luma 0.863 — i.e. the "interior shadow" constant was LIGHTER than
// the surface it was supposed to shade, and `dressLimbs` used it for the LEGS, which
// made the legs the brightest large mass on the model. Both were contributing to the
// 16.23% clip. Now genuinely a shade (0.612), used for the bowl's interior wall.
const CERAMIC_SHADE = '#A99B80'; // interior shadow / underside, luma 0.612
// ── The dark rung ────────────────────────────────────────────────────────────
// `tools/tmp/valuescan.mjs --mode ref`: every one of eighteen Brawl Stars plates puts
// 5% of the character below luma 0.18. Not one of ours did. Soup's own part structure
// was already the cast's healthiest (5.1% weak boundary), so this is the SMALLEST
// change that gives it a dark end: the rust-red band it already wears goes from a
// mid-value accent to a near-black one. Measured at pot_south, shipped framing:
// range 0.652 -> 0.791, p05 0.317 -> 0.177, figure/ground 0.194 -> 0.174.
// Its 10.8% of the character is what buys the P05 — a dark rung has to carry AREA.
const RIM_TRIM = '#3A1009';      // takeout-bowl band, near-black rust — Soup's dark rung
// Limb/torso body colour. A fresh independent art director scored Soup 4/10 and named
// the cast-wide colour convergence directly: Soup, Water Bottle and Sushi all ended up
// with cream/white tapered limbs and dark boots, reading as the same parts reskinned.
// Soup's bowl stays CERAMIC cream (that identity wasn't the problem), but the BODY
// (arms/legs/torso) moves to a warm stoneware grey — ties back to this character's own
// grey-steam/grey-iris palette rather than inventing an unrelated hue, while being a
// real value/hue break from cream. Cream now lives on the hands (cloth mitts, echoing
// the bowl) instead, so the read becomes "grey sleeves, cream mitts, dark boots".
//
// 🚨 AND THE PARAGRAPH ABOVE DESCRIBED SOMETHING THE CODE NEVER DID. `GLAZE_GREY`
// was referenced only in the `ChibiRig` palette, which this character's own
// `dressLimbs()` overrides in every slot — the comment says the read is "grey
// sleeves, cream mitts, dark boots" and what shipped was cream sleeves, cream
// mitts, cream legs. It was never rendered once. `rules.ts` now names the same
// three-tone read in the spec, so the ladder below is authored against it and each
// tone is used by an actual mesh. Values are sRGB luma, and they are chosen as a
// LADDER because `valuescan`'s whole finding is that adjacent parts fusing at the
// seam is what makes limbs read as detached even when the geometry is fine —
// soup's own `torso|shoulderL` measured **0.0423**, a 0.72 median gap that fuses.
//
//   boots       0.06 │ trim 0.10 │ mouth 0.09 │ pupil 0.11   the dark rung
//   legs        0.41 │ stoneware posts
//   pot stand   0.52 │ the body mass
//   bowl inside 0.61
//   sleeves     0.65 │ grey stoneware
//   bowl        0.72 │ cream glaze
//   mitts       0.76 │ cream cloth
//   SCLERA      1.00 │ the brightest value anywhere on the character, by construction
// `#8B857E` (0.524) -> `#78726B` (0.452), and this one was MEASURED, not chosen.
// `valuescan --mode chars` reports `head|torso` — the bowl meeting the body at the
// neck, this character's single most prominent junction — going **dLcontact 0.2336
// -> 0.0803** when the pale rig torso was replaced by the pot stand: a boundary that
// used to be the model's strongest became one of its three weakest, because the
// stand's top-facing dome and the bowl's under-curve landed in the same value band.
const GLAZE_GREY = '#78726B';    // pot stand / body mass, luma 0.452
const SLEEVE_GREY = '#ABA49B';   // upper arms — grey stoneware sleeves, luma 0.647
// `shoulderL|elbowL` measured `dLcontact` **0.0612** with one sleeve tone for the
// whole arm — the two halves of a limb drawn in one colour fuse at the elbow, which
// is the same fusion that made the arm read as detached from the torso, one joint
// further out. A rolled-back cuff is the cheapest real break available.
// ── 🚨 0.556 -> 0.456, BECAUSE THE ELBOW BOUNDARY MEASURED 0.009 ────────────
// WAS '#948D84'. `valuescan --mode chars`, paired on frozen trees, reports this
// character's tightest contact as `shoulderL|elbowL` **0.026 before and 0.009 after**
// the arm-thinning in `dressLimbs` — against a 0.15 target and a 0.0039 measured
// floor, i.e. a boundary that is very nearly not there. An 0.09 albedo step between
// two glossy tubes that meet at a tangent does not survive the shading; the sleeve's
// own falloff eats it.
// '#7C7369' is luma 0.456, a **0.191** step under `SLEEVE_GREY`. It is deliberately
// still 0.048 ABOVE `LEG_STONE` (0.408) rather than darker than it: the arm/leg
// separation this pass is for is carried by thickness, by the warm cream mitt and by
// the ladder's DIRECTION, and a forearm darker than a thigh would invert that.
const CUFF_GREY = '#7C7369';     // forearms — the darker rolled cuff, luma 0.456
const LEG_STONE = '#6E675F';     // legs — darker stoneware posts, luma 0.408
// ── WARMED, and it is the frame's scarce budget rather than a preference ─────
// WAS '#CFC1A6' (HSL 39, 25%, 73%). This character is the cast's most achromatic:
// every large mass on it is a grey or a near-neutral cream and the only chroma in
// frame is the broth. `CLAUDE.md` records warm chroma measured at 0.053 against a
// 0.072 floor while cool sits OVER target, so a warm terminal mass is the cheap
// direction here and desaturating anything is the falsified one. '#E0BC8A' is
// HSL 36, 58%, 71% — **+33 pp saturation, -2 pp lightness, hue held within 3
// degrees** — so the mitts stay "cream cloth" (`rules.ts`'s spec) and stop being
// grey. It also widens the arm/leg split: the mitt is now the only warm thing on
// the limbs, and the boots below stay near-black stoneware.
const MITT_CREAM = '#E0BC8A';    // hands — warm cream cloth mitts, luma 0.756
// ── THE BROTH IS YELLOW NOW, AND THE OLD VALUE WAS ORANGE BY MEASUREMENT ─────
// Uri, playing the deployed build: *"Soup — add noodles or something in the liquid,
// make the liquid more yellow than brown."*
//
// WAS `PALETTE.broth` = `#E8792A`, which is **hue 24.9 degrees**. Yellow sits at
// 50-60 and gold at 40-50; 24.9 is ORANGE, so the report is a measurement rather
// than a preference. `#CC9F0D` is **hue 46.0**, HSL(46, 88%, 43%) — a +21.1 degree
// rotation into the gold-yellow band.
//
// ⚠️ IT IS NOT A PURE HUE ROTATION, AND THE REASON IS THE ONE ARITHMETIC TRAP HERE:
// sRGB luma weights GREEN at 0.7152, so rotating orange -> yellow at constant HSL
// lightness RAISES luma by ~0.15. Held at the shipped HSL lightness the broth would
// have landed at luma 0.72 — `CERAMIC`'s exact albedo (0.722), i.e. the cream rim
// the disc physically TOUCHES at the 58 degree match camera. Six candidates were
// rendered at both shipped cameras and looked at (`tools/tmp/lk1_sweep.mjs`); the
// two above luma 0.71 are the ones that start fusing with that rim. `#CC9F0D` is
// luma **0.620**, keeping a 0.102 step under the rim, where the shipped orange had
// 0.177 and every candidate above hue 41 read unmistakably yellow.
//
// 🚨 AND IT IS NO LONGER `PALETTE.broth`. That constant is ALSO read by
// `src/arena/shared.ts:1189` for an arena material, which is not this file's to
// move; `rules.ts` is not this agent's file set either. So soup's liquid and
// `PALETTE.broth` have DIVERGED deliberately. `soup.Splash` and `soup.Dump` still
// carry `color: '#E8792A'` in `rules.ts` — the splash projectile and the dump cone
// are still the old orange. Reported rather than changed.
const BROTH = '#CC9F0D';         // hue 46.0, HSL(46, 88%, 43%), luma 0.620
// The pair is a VALUE STEP, not two independent colours — moving one without the
// other flattens the bowl. The shipped pair `#E8792A`/`#B85A16` was **0.133 of
// luma** apart, so the new dark holds exactly that step at the new hue: luma
// 0.620 -> 0.487. (Holding the step in HSL lightness instead would have given
// 0.198 of luma, because of the same green-weighting trap above.)
// ⚠️ AND UNTIL THIS COMMIT THAT STEP HAD NEVER BEEN RENDERED ONCE — see the depth
// ring in `buildBrothSolids`, which measured 0 delivered pixels at all three shipped
// stations.
const BROTH_DARK = '#A07D0A';    // hue 46.0, luma 0.487 — exactly 0.133 under BROTH
const STEAM = PALETTE.steam;     // #C9C9C9
// ── The solids, and the pale one is a MEASURED hazard rather than a taste call ───
// Soup's own second weapon is `Noodle Toss`, `rules.ts` colour **`#FFE9A8`** — HSL
// lightness **0.829**. `tools/tmp/p2_bgcross.mjs` measured all 23 ranged weapons
// across the surfaces they actually cross and found the predictor of a projectile
// vanishing is **its own lightness, not hue**: Spearman -0.738 against own HSL
// lightness versus 0.238 for hue, and the eight weapons above 0.82 lightness ARE
// ranks 1-8. The collision it documented is `#FFE9A8` on the arena's cream ground
// cloth `#E9DCC0` — HSL lightness 0.833 against 0.829, a gap of **0.004**.
//
// So the obvious noodle colour is the trap. `NOODLE` `#F2D98A` below is HSL
// lightness **0.745** and hue 45.6 — 0.084 and 0.8 degrees from soup's own
// projectile. Filling 31% of this character (the broth's share of it at the match
// camera) with that would build a second cream ground cloth on soup's own head.
// `NOODLE_TOP` is HSL lightness **0.620**, i.e. **0.209 below** the projectile —
// fifty times the separation of the documented collision — and it is still a
// legible +0.110 of luma over the new broth.
const NOODLE_TOP = '#DDB95F';    // hue 42.9, HSL L 0.620, luma 0.730 — the strand you see
const NOODLE_WET = '#7A5510';    // hue 39.1, HSL L 0.271, luma 0.345 — a strand under the surface
// Green and orange are here for HUE RANGE, not for garnish realism, and there is a
// figure/ground reason. `docs/STATE.md` / `DECISIONS §73`: all 11 colour rails now
// PASS, but the warm arrived INSIDE THE CAST'S OWN HUE BAND (`topCellsInCastBand`
// 0.296 -> 0.648) and nothing gates that. Moving this character's largest colour
// from hue 24.9 to 46.0 pushes it TOWARD the same band — `CERAMIC`, the bowl it sits
// in, is hue 39.5 — so it is a real cost and it is priced rather than ignored: the
// two colours that separate them are chroma (broth S 0.88 against ceramic S 0.28)
// and value (0.102 of luma, plus the near-black inner wall and the ink line between
// them), and `valuescan --mode chars --ids soup` reads the boundary term `dL` going
// **0.1483 -> 0.2150** across this change rather than down. The carrot coin is the
// deliberate counterweight: it puts a little of the old `#E8792A` family back as an
// ACCENT instead of as 31% of the character. ⚠️ `arena-scan` was NOT re-run — it is
// an 18-station whole-frame instrument and this is one character — so the effect of
// this hue on the CAST half of that budget is unmeasured.
const SCALLION = '#5C8A3A';      // hue 94.5, luma 0.481 — was an unnamed speck, see below
const CARROT = '#D9601C';        // hue 21.6, luma 0.458
// ⚠️ `NOODLE`/`NOODLE_DARK` are the LADLE's draped noodles (`buildLadle`) and are
// deliberately left alone — but the reason is AREA, and it is measured rather than
// assumed: `lk1_area` puts them at 2,612 px at the lobby and 5,130 px (1.17% of the
// character) at the match camera, on a prop held out at arm's length rather than on
// the broad up-facing surface a projectile crosses. They are still in the pale band
// above, and if a projectile-legibility pass ever lands on this character they are
// the residual.
const NOODLE = '#F2D98A';
const NOODLE_DARK = '#D9B85E';
const WOOD = '#8A5A34';          // ladle handle

// ── Costume layer ────────────────────────────────────────────────────────────
// A fresh independent art director named the missing costume/accessory layer as
// the TOP gap in the whole cast: without one, characters read as "naked mascot
// body with a themed head glued on" no matter how good the body sculpt is. A
// spare ladle worn on a diagonal back-sling is Soup's silhouette-breaking item —
// its handle pokes up past the shoulder line the way a cape or backpack does on
// the reference roster — plus a tied napkin bib layered over the existing apron
// sash as a smaller fabric-panel detail.
/** Boots. Deepened with `RIM_TRIM` so the dark rung reaches the ground, not just the sash. */
const BOOT_STONE = '#160F0B';
// WAS `#E2DCCF` (0.863) on a chevron-shaped extruded bib. Rendered at the lobby
// camera that panel read as a white ARROW pointing up the chest, not as cloth, and
// it was the second-brightest large area on the model. It is now a curved apron
// PANEL that follows the pot stand's own lathe profile (see `buildApron`), at a
// value that sits between the stand and the bowl instead of above both.
const BIB = '#BCB29B';       // apron cloth, luma 0.700
const SLING = '#6B4226';     // leather sling strap
const SLING_DARK = '#4A2E1A';

/**
 * Tapered limb segment: a flat cap at the joint origin (plugs flush into the
 * shoulder/hip, no gap) tapering down a straight wall to a rounded tip. Reused here
 * with near-equal top/bottom radii to build the bowl-handle arms and the stubby
 * ceramic legs — glossy, like the bowl exterior itself.
 */
function taperedLimb(len: number, rTop: number, rBot: number, mat: THREE.Material, segs = 12): THREE.Mesh {
  // Points MUST run bottom → top for LatheGeometry's automatic normals to face
  // outward (this file's own BOWL_PROFILE lathe follows the same rule). Getting
  // it backwards was a round 1 defect: the real mesh got face-culled invisible
  // and its outline shell rendered as a solid dark wedge instead of a thin line.
  // Bottom tip is a full rounded hemisphere; the TOP is a shallow dome rather than
  // a hard flat disc — round 2 found that a flat cap, at the angle the rig's rest
  // pose rotates the shoulder/hip to, reads as a flat flag/wing sticking out of
  // the joint rather than blending into it. The dome keeps almost the whole
  // length budget for the actual tapered shaft.
  // ── 🚨 THE BOTTOM CAP WAS EATING `rBot`, AND THAT IS THE VISIBLE KNEE STEP ───
  // WAS: `capBot = min(rBot, len * 0.45)` used as BOTH the cap's height and its
  // radius, with the wall then starting at `capBot`. Whenever `len * 0.45 < rBot` —
  // which is every STOUT leg, the thigh being 0.276 m long against a 0.155 m radius —
  // the wall's bottom radius silently became `len * 0.45` instead of `rBot`. So the
  // thigh ended 0.031 m NARROWER than the shin that starts directly under it, and the
  // knee rendered as two stacked cups with a hard step between them. Read
  // `shots/ch/soup/before/crop_legs.png` and it is the most obvious thing in frame.
  //
  // The cap now has TWO numbers: `rBot` horizontally (so the wall keeps the radius it
  // was asked for) and `capH` vertically (so a short segment gets a squashed dome
  // instead of a truncated one). Same class as `docs/LESSONS.md` §12's capsule
  // degeneracy — a geometry helper quietly changing shape when a segment is shorter
  // than it is thick.
  const capH = Math.min(rBot, len * 0.45);
  const capTopH = Math.min(rTop * 0.42, len * 0.16);
  const wallBotY = -(len - capH);
  const wallTopY = -capTopH;
  const CAP = 5;
  const pts: THREE.Vector2[] = [];
  for (let i = CAP; i >= 0; i--) {
    const a = (i / CAP) * Math.PI * 0.5;
    pts.push(new THREE.Vector2(rBot * Math.cos(a), wallBotY - capH * Math.sin(a)));
  }
  pts.push(new THREE.Vector2(rTop, wallTopY));
  const TCAP = 4;
  for (let i = 1; i <= TCAP; i++) {
    const a = (i / TCAP) * Math.PI * 0.5;
    pts.push(new THREE.Vector2(rTop * Math.cos(a), wallTopY + capTopH * Math.sin(a)));
  }
  const m = new THREE.Mesh(new THREE.LatheGeometry(pts, segs), mat);
  m.castShadow = true;
  m.receiveShadow = true;
  return m;
}

/**
 * The MITT that terminates an arm.
 *
 * ── 🚨 WHY THIS IS NO LONGER "A SMALL ROUNDED CERAMIC KNOB" ──────────────────
 * It was, and its docblock defended the choice: *"a bowl handle terminates as a
 * rounded lip of the same moulded ceramic, not a separate hand shape grafted on."*
 * The reasoning is about what a BOWL is; the object on screen is a CHARACTER, and
 * read at the lobby camera (`shots/ca/before/soup.png`) this one has four grey
 * segmented columns hanging off it at four similar angles, two ending in a small
 * pale ball and two ending in a dark boot. Nothing says which pair is which and the
 * figure reads as a four-legged animal — the cross-character finding of this pass.
 *
 * A hand is the cheapest possible answer, because it is the ONE terminal that only
 * an arm can have. Three properties do the work and all three were missing:
 *   · SIZE — 1.55x the forearm's tip against the old 1.30x, so it is a mass rather
 *     than a lip. (`soup.ts`'s own measurement caps this: at the original
 *     `handRadius` sizing the hand was 1.40x the forearm TUBE and 2.09x the whole
 *     forearm's length, and ablation put 25.9% of the forearm's footprint behind
 *     it. 1.55x the TIP is 1.24x the tube — still under that.)
 *   · A THUMB — the element that makes the mass nameable at 20 px. A rounded blob
 *     is a ball; a rounded blob with a thumb is a hand, at any resolution.
 *   · A CUFF — arm-exclusive by construction. A leg has no wrist.
 */
function buildHandleCap(R: number, mat: THREE.Material, cuffMat: THREE.Material, sx: number): THREE.Group {
  const g = new THREE.Group();
  g.name = 'soup_mitt';
  const m = new THREE.Mesh(new THREE.SphereGeometry(R * 0.92, 16, 12), mat);
  m.name = 'soup_handle_cap';
  m.scale.set(1.0, 0.90, 1.02);
  m.position.y = -R * 0.28;
  m.castShadow = true;
  m.receiveShadow = true;
  g.add(m);
  const thumb = new THREE.Mesh(new THREE.CapsuleGeometry(R * 0.34, R * 0.56, 4, 8), mat);
  thumb.position.set(sx * R * 0.86, -R * 0.02, R * 0.44);
  thumb.rotation.set(0.34, 0, sx * 0.92);
  thumb.castShadow = true;
  g.add(thumb);
  const cuff = new THREE.Mesh(new THREE.TorusGeometry(R * 0.78, R * 0.20, 8, 16), cuffMat);
  cuff.name = 'soup_wrist_cuff';
  cuff.rotation.x = Math.PI / 2;
  cuff.position.y = R * 0.44;
  cuff.castShadow = true;
  g.add(cuff);
  return g;
}

/**
 * A bowed ceramic handle segment: a TUBE along a curve (not a straight tapered
 * lathe) that still starts at the joint origin and ends exactly `len` below it, so
 * it plugs into the rig's fixed joint positions with no gap, but bows out to the
 * side along the way — the structural fix for "every character shares the same
 * tapered-tube limb". Capped at both ends with rounded ceramic knobs so there is
 * never an open tube cross-section, and no separate "ball hand" reads at all: the
 * upper-arm/forearm/hand chain is authored as one continuous curved loop of the
 * bowl's own material, the strongest available "this is a handle, not an arm" cue.
 */
function buildHandleArc(
  len: number,
  /** Radius at the segment's TOP (the joint origin). */
  rTop: number,
  /** Radius at the segment's BOTTOM. Matching one segment's `rBot` to the next
   *  segment's `rTop` is what removes the step at the elbow — see below. */
  rBot: number,
  side: 1 | -1,
  bowOut: number,
  bowFwd: number,
  mat: THREE.Material,
  /**
   * Close the BOTTOM end with a knob. False on the forearm, because the `handL`/
   * `handR` slot already puts one at exactly that point and two coincident spheres
   * are not two shapes — the outer one hides the inner one and the inner one hides
   * the outer one's lower half. Measured: with both present the hand group delivered
   * **0.379** of its own footprint no matter how the sizes were traded, because
   * whichever sphere was smaller was simply inside the other. One knob, owned by the
   * slot that the acceptance test scores.
   */
  capBottom = true
): THREE.Group {
  const g = new THREE.Group();
  const start = new THREE.Vector3(0, 0, 0);
  const mid = new THREE.Vector3(side * len * bowOut, -len * 0.5, len * bowFwd);
  const end = new THREE.Vector3(0, -len, 0);
  const curve = new THREE.QuadraticBezierCurve3(start, mid, end);
  // ── WAS ONE RADIUS FOR THE WHOLE SEGMENT, AND THAT IS THE VISIBLE ELBOW STEP ──
  // `TubeGeometry` takes a single radius, so the upper arm was drawn at
  // `armRadius * 0.60` and the forearm at `armRadius * 0.52` — an 8-point jump in
  // diameter at the elbow, with a `radius * 1.02` cap sphere on the forearm's top
  // that was SMALLER than the tube above it. Rendered, the arm read as a chain of
  // separate blobs with a crease across it, which is the other half of Uri's
  // *"limbs disattached or intersecting"* on this character.
  //
  // The taper is applied by scaling each of `TubeGeometry`'s rings toward its own
  // centre on the curve — the technique `appendages.ts:curl` uses, reimplemented
  // here rather than imported because `curl` tags its mesh `silhouetteEvent`, which
  // would hide the arms from `localBounds()` and from the appendage instruments.
  const SEG = 16, RADIAL = 10;
  const geo = new THREE.TubeGeometry(curve, SEG, rTop, RADIAL, false);
  const p = geo.attributes.position;
  const centre = new THREE.Vector3();
  const v = new THREE.Vector3();
  for (let i = 0; i < p.count; i++) {
    const t = Math.floor(i / (RADIAL + 1)) / SEG;
    curve.getPointAt(Math.min(1, t), centre);
    v.set(p.getX(i), p.getY(i), p.getZ(i));
    v.sub(centre).multiplyScalar((rBot / rTop - 1) * t + 1).add(centre);
    p.setXYZ(i, v.x, v.y, v.z);
  }
  p.needsUpdate = true;
  geo.computeVertexNormals();
  geo.computeBoundingBox();
  const tube = new THREE.Mesh(geo, mat);
  tube.name = 'soup_handle_tube';
  tube.castShadow = true;
  tube.receiveShadow = true;
  g.add(tube);

  const capTop = new THREE.Mesh(new THREE.SphereGeometry(rTop * 1.02, 12, 10), mat);
  capTop.position.copy(start);
  capTop.castShadow = true;
  g.add(capTop);
  if (capBottom) {
    const capBot = new THREE.Mesh(new THREE.SphereGeometry(rBot * 0.98, 12, 10), mat);
    capBot.position.copy(end);
    capBot.castShadow = true;
    g.add(capBot);
  }
  return g;
}

/**
 * A worn strap: a curved tube from `from` to `to`, bowed out through a control
 * point offset by `bow` — the same bezier-tube technique `buildHandleArc` above
 * uses, reused here for costume webbing that has to read as cloth draped over a
 * body rather than a rigid straight rod.
 */
function strapArc(from: THREE.Vector3, to: THREE.Vector3, bow: THREE.Vector3, radius: number, mat: THREE.Material): THREE.Mesh {
  const mid = from.clone().add(to).multiplyScalar(0.5).add(bow);
  const curve = new THREE.QuadraticBezierCurve3(from, mid, to);
  const m = new THREE.Mesh(new THREE.TubeGeometry(curve, 12, radius, 8, false), mat);
  m.castShadow = true;
  m.receiveShadow = true;
  return m;
}

/** A sturdy little foot pad — a low, wide plate rather than a tall boot, echoing a
 * heavy vessel resting on stubby feet directly under its own base, dark against the
 * pale ceramic legs. */
function buildWorkBoot(fw: number, bodyMat: THREE.Material, trimMat: THREE.Material, groundLocalY: number): THREE.Group {
  const g = new THREE.Group();
  // ── The sole was a PLATE, not a sole ────────────────────────────────────────
  // It was built WIDER (1.10 vs 1.00), LONGER (1.58 vs 1.36) and lower than the
  // boot above it, in a saturated trim colour — so from the front it read as a
  // bright red flat plate protruding past the toe and out below the shoe, which is
  // exactly how a blind pass described it. A sole is a RIM: inset from the upper on
  // every axis except thickness, so it reads as the boot's own edge.
  //
  // `groundLocalY` is the foot joint's own distance above the floor, negated —
  // i.e. the local y at which the world floor sits. Seating the sole's underside
  // there fixes `types.ts` convention #1 ("feet at y=0"), which the whole cast was
  // violating by -0.08 to -0.25 m. It has to be passed in because `dressLimbs` hands
  // the builder a SIZE and not a position, and `rig.metrics.ankleY` is the only
  // place that knows the answer.
  // ── Fit the boot BETWEEN the floor and its own original top ─────────────────
  // Seating the sole on the floor (which is what fixes `types.ts` convention #1)
  // pushes everything above it up, and on a STOUT body the shin is only 0.116m long
  // while the boot is 0.42m tall — so a first pass at this raised the boot's top
  // ABOVE THE KNEE and swallowed the shin whole (soup's shins measured 0.653
  // delivered before, 0.000 after). The boot has to get shorter, not just higher.
  //
  // `avail` is the room between the floor and where the boot's top used to sit;
  // `k` squashes the boot vertically to fit it. Widths are untouched, so it reads
  // as the same chunky boot, just not one that is taller than the leg wearing it.
  const avail = -groundLocalY + fw * 0.22;
  const k = Math.min(1, avail / (fw * 0.86));
  const SOLE_H = fw * 0.16 * k;
  const UPPER_H = fw * 0.70 * k;
  const soleY = groundLocalY + SOLE_H / 2;
  const upper = new THREE.Mesh(roundedBox(fw * 0.96, UPPER_H, fw * 1.34, Math.min(fw * 0.26, UPPER_H * 0.45), 3), bodyMat);
  upper.position.set(0, groundLocalY + SOLE_H + UPPER_H / 2, fw * 0.22);
  upper.castShadow = true;
  upper.receiveShadow = true;
  g.add(upper);

  const sole = new THREE.Mesh(roundedBox(fw * 0.92, SOLE_H, fw * 1.28, fw * 0.07, 2), trimMat);
  sole.position.set(0, soleY, fw * 0.22);
  sole.castShadow = true;
  sole.receiveShadow = true;
  g.add(sole);

  // No separate ankle-cuff ring: the boot's own dark colour against the pale
  // ceramic leg already reads as a material break at the ankle. An earlier pass
  // added a thick contrasting torus here too, and stacked across every limb
  // joint it was exactly what an independent art director called out as
  // "bolted-together hardware" — a worse version of the ball-jointed-skeleton
  // problem this whole bespoke-limb system exists to solve.
  return g;
}

export class SoupCharacter extends BaseCharacter {
  private rig: ChibiRig;
  private steamWisps: THREE.Object3D[] = [];
  private steamMats: THREE.MeshStandardMaterial[] = [];
  private brothSurface!: THREE.Mesh;
  /**
   * The liquid AND everything floating in it, as one object.
   *
   * 🚨 THEY USED TO BE SIBLINGS UNDER `head`, AND THAT IS WHY THE BOWL WAS A FLAT
   * ORANGE DISC. `onUpdate` bobbed the broth with `position.y +=`, which INTEGRATES
   * rather than oscillates: measured at the frozen preview time t=1.5 the disc had
   * walked **+0.0169 m** off its authored height while its own ink outline — which
   * `addOutline` copies the transform of exactly once, at construction — stayed put
   * at 0.117863. The depth ring was authored 0.0011 above the disc and the garnish
   * specks 0.0055 above it, so the disc climbed past BOTH and occluded them, and it
   * kept climbing at a rate that depends on the frame rate because `dt` is not in
   * that expression. `docs/LESSONS.md` §1 for the twenty-second time: they were
   * rendering, and they were invisible.
   */
  private brothTop!: THREE.Group;
  /** The authored height the bob oscillates ABOUT. Its absence is the bug above. */
  private brothBaseY = 0;
  /**
   * How wide the pot stand is at a given torso-local height, in metres.
   *
   * Published by `buildPotStand()` and read by `buildAccessories()`. It exists so
   * that nothing on the body is ever placed against a REMEMBERED number — the same
   * discipline `bowlSurface` enforces on the head and `localBounds` enforces in
   * `appendages.ts`. The strap this replaces was authored as fractions of
   * `shoulderWidth`, and when the body's width changed it ran straight through the
   * inside of the torso.
   */
  private standRadiusAt: (y: number) => number = () => 0;

  constructor(def: CharacterDef) {
    super(def);

    this.rig = new ChibiRig({
      palette: {
        // A third independent art-director pass named the structural problem
        // directly: every character shares the identical tube-and-ball-joint limb
        // TOPOLOGY, colour changes notwithstanding. Soup's fix is structural, not a
        // recolour — see `dressLimbs()` below, which replaces every slot.
        //
        // ⚠️ "only a fallback that is never actually rendered" WAS TRUE OF THE LIMB
        // SLOTS AND FALSE OF EVERYTHING ELSE, and believing it is how `GLAZE_GREY`
        // ended up describing a colour nothing wore. `dressLimbs()` overrides the
        // eight limb parts; the TORSO is built by `rig.ts` straight off this palette
        // and reaches the screen unchanged.
        limb: CERAMIC,
        hand: MITT_CREAM,
        foot: BOOT_STONE,
        torso: GLAZE_GREY,
        // ── 🔴 THESE TWO NOW DESCRIBE NOTHING, AND THAT IS DELIBERATE ────────────
        // KEPT ABOVE THE CORRECTION, per `CLAUDE.md`'s rule on reversed assertions.
        // WAS: *"STOUT carries `neckFraction: 0.055`, so this character has had a
        // neck column and a collar the whole time, drawn in `limb` (cream) and in
        // `foot * 0.55`. They are named here now."* True when written, and naming
        // them is what made the next question askable: HOW MUCH of them reaches the
        // screen. Ablated at the lobby camera the answer was **4,289 px**, and
        // `25d5579` had by then established that a column the mass does not hide is
        // a defect rather than a shortfall. `proportions` below drops the column, so
        // `rig.ts` builds neither mesh and these two colours are unreachable.
        //
        // They stay, unused, for one reason: they are the ONLY record of what the
        // column and collar were painted, and re-deriving that costs an ablation.
        // ⚠️ If `neckFraction` ever comes back on this character, it comes back with
        // these; if it does not, delete both. Do NOT retune them — nothing reads them.
        neck: LEG_STONE,        // (unreachable) a stoneware throat, darker than both lobes it joined
        collar: RIM_TRIM,       // (unreachable) the same near-black band the bowl's rim wears
        limbRoughness: 0.5,
      },
      // Structural fix, round 4: the face was sitting on a narrow neck BELOW the
      // bowl (a small creature wearing the bowl as a hat), and every character
      // shared the same tube-and-ball-joint limbs. Two changes: `headFraction`
      // grows so the wide bowl is unmistakably the dominant identity mass, and the
      // limbs below are rebuilt from scratch as short bowl-handle arms and stubby
      // pedestal legs rather than dressed versions of the shared tube topology.
      // Body: STOUT archetype (see `bodies.ts`) — short wide torso, thick short
      // limbs, low centre of mass. A bowl of soup is the heaviest, most planted
      // thing on the roster and this is the archetype built for that read.
      // `handRadius` stays small on purpose: these are handle caps, not mitts.
      // ── 🔴 `withoutNeck()`: 4,289 px OF COLUMN, AND THIS FILE ALREADY SAID SO ──
      // Measured by ABLATION through the shipped lobby path (column and collar
      // painted `#FF00FF`, captured at `charStage.ts`'s pitch 20, magenta counted,
      // unablated control scores zero): **4,289 px in a 194 x 49 box.**
      //
      // The palette block above names it: *"STOUT carries `neckFraction: 0.055`, so
      // this character has had a neck column and a collar the whole time"* — found
      // while correcting `GLAZE_GREY`, colour-named, and never priced. This is the
      // price, and it is the exact defect round 4 of this file already fixed one
      // level up: *"the face was sitting on a narrow neck BELOW the bowl (a small
      // creature wearing the bowl as a hat)"*. `headFraction: 0.58` and the pot stand
      // both exist to make the bowl sit ON the body; a 0.1155 m bare column between
      // them re-opens the same read from the one camera that can see it. A bowl
      // flares OUT and UP — it overhangs nothing below its own rim — so there is no
      // chin here for a column to hide under.
      // ⚠️ Occlusion costs `Δy / tan(pitch)` of forward overhang — 2.747 m per metre
      // at the lobby's 20° against 0.625 at the match's 58°, **4.4x**.
      //
      // ⚠️ WRAPPING `bodyType()` IS THE WHOLE POINT AND `neckFraction: 0` ALONE IS A
      // BUG. The constructor pays for the gap out of the head radius
      // (`headH = height*headFraction - 2*gap/(1+headMount)`), so dropping the knob on
      // its own GROWS R and DROPS the head centre, taking the bowl, the broth, the
      // face and every accessory placed against `bowlSurface` with it. `withoutNeck()`
      // is that arithmetic on the RESOLVED proportions, so the tweaks below are
      // already folded in: headFraction 0.58 -> 0.521489, headMount 0.88 -> 1.090934.
      // Verified by BUILDING both rigs off the shipped file — `node tools/tmp/
      // nm_neck.mjs --against <baseline> --migrated soup`: R 0.547564 and headCentreY
      // 1.716507 IDENTICAL, every other published metric unchanged. The comparator is
      // required to FAIL on the naive drop (`--knownbad naive`) and does.
      // 🚨 SEE `buildPotStand`: `m.neckRadius` GOES TO ZERO WITH THE COLUMN, and the
      // stand's throat was solved off it. That is a second, silent consequence of
      // this line and it is corrected there rather than absorbed.
      proportions: withoutNeck(bodyType('stout', {
        headFraction: 0.58,                     // the bowl dominates the silhouette
        handRadius: CHARACTER_HEIGHT * 0.062,   // small rounded cap, not a mitt
        // 0.25H -> 0.305H. The bowl is 0.32-0.34m half-wide at shoulder height and
        // the pivot sat at 0.52m, which sounds clear — but the bowl FLARES, so the
        // mass above the pivot projects down over the arm from this camera and
        // both upper arms delivered only 0.556 / 0.508, both forearms 0.276 /
        // 0.246, and both hands 0.200 / 0.386. Measuring the mass at the pivot's
        // own height under-reads a flared food; the screen-space overlap does not.
        //
        // ── 0.305H -> 0.255H, AND THIS IS URI'S "LIMBS DISATTACHED" ────────────
        // The paragraph above optimised ONE quantity — how much of the arm the bowl
        // covers at 58 degrees — and never checked what it cost at the other end.
        // The rig's torso is a tapered sphere of half-width `torsoWidth * 0.5 =
        // 0.407` m, and at the shoulder line (`shoulderFraction 0.192` of height,
        // i.e. 80% of the way up a 0.504 m torso, where the taper has already begun
        // closing) it is **0.340 m**. At 0.305H the shoulder pivot sat at 0.641 m
        // and the upper arm's inner wall at 0.533 m: **0.19 m of open background
        // between the arm and the body it is supposed to hang off.** At the LOBBY
        // camera (`charStage.ts`, pitch 20) that gap IS the read; at 58 degrees
        // foreshortening hides it, which is exactly why it survived every
        // instrument the previous passes ran. `docs/LESSONS.md` §1 in its newest
        // form — it rendered, and it rendered plausibly at the camera being measured.
        //
        // Two changes together, because neither is sufficient alone: the pivot comes
        // in to 0.255H (0.536 m, arm inner wall 0.407 m) AND `buildPotStand()` gives
        // the body a real mass 0.452 m half-wide at that height. The arm now
        // OVERLAPS the body by 0.045 m instead of missing it by 0.19 m.
        shoulderWidth: CHARACTER_HEIGHT * 0.255,
        // ── 0.175H -> 0.245H, and it is the SAME BUG the legs had ──────────────
        // Round 2 found `CapsuleGeometry(r, len - 2r)` degenerating to a sphere
        // whenever a segment was shorter than it was thick, and fixed it in the
        // legs. The arms were never checked. STOUT's forearm is `0.175 * 0.477 =
        // 0.0835H` long against `2 * armRadius * 0.92 * 0.52 = 0.0814H` of tube
        // diameter — a segment 1.03x longer than it is wide, which is not a limb,
        // it is a ball. Every archetype except LANKY is in that state (see the
        // arm-ratio note in `bodies.ts`); soup is the one where it was MEASURED,
        // because its forearms are the cast's worst-delivering limb group.
        //
        // The occluder was named by ablation rather than reasoned from source
        // (`tools/tmp/occluder.mjs`, which reproduces `limbcheck`'s own metric
        // exactly and then hides one candidate at a time): the bowl contributes
        // NOTHING — it is the character's own upper arm at 40.7% of the forearm's
        // footprint and its own hand cap at 25.9%. Two previous attempts moved the
        // forearm's BOW and both measured worse, because the bow was never the
        // variable; the chain is simply too short to have a visible middle.
        //
        // Kept soup-local rather than pushed into the archetype: hamburger and taco
        // share STOUT and neither has been re-measured for it. See the hand-off.
        armFraction: 0.245,
        // 0.215H -> 0.30H. STOUT is the archetype whose whole read is "heavy and
        // planted", and the bowl is 0.61 m across: at the old width the legs sat
        // under the middle of it and this camera projected the bowl straight down
        // over both. Kept character-local rather than pushed into `bodies.ts` —
        // hamburger and taco share STOUT and are moved by their own files, each
        // with its own measurement.
        // 0.30H -> 0.275H after `tools/tmp/castbox.mjs` measured what the widening
        // costs on the OTHER axis: the model's widest point against
        // `HIT_RADIUS_VS_PLAYER`. Soup was the cast's widest at 1.135 of it. The
        // 0.025H back is worth ~0.06 m of overhang and ~0.01 of hull deficiency
        // against a 0.115 margin over the reference floor — cheap, and it is the
        // difference between the size rise costing hit-feel and not.
        //
        // ── 0.275H -> 0.225H, same defect as the shoulders, one joint down ──────
        // The rig's torso mesh bottoms out AT the hip line and does so as a POLE
        // (`rig.ts`: the tapered sphere's lowest vertex has radius 0), and the
        // pelvis mass spans 0.42 m half-width. At 0.275H the hip pivots sat at
        // 0.578 m, so both thigh tops — flat discs, because of the `taperedLimb`
        // cap bug fixed above — floated 0.16 m outside anything solid, with the
        // 0.55 m-radius apron sash overhanging them and hiding what little body
        // there was. `shots/ch/soup/before/crop_legs.png`: the legs are two free-
        // standing columns with daylight between them and the torso.
        //
        // 0.225H puts the pivots at 0.473 m, comfortably inside the pot stand's
        // 0.462 m half-width at the hip line, so the thigh's inner half is buried
        // in the body. `splay: 0.34` is UNCHANGED, so the FEET still land as wide
        // as they did — the planted read and the hull deficiency the splay bought
        // are carried by the ankle, not by the hip.
        stanceWidth: CHARACTER_HEIGHT * 0.225,
      })),
      // Serene and still — the calmest, most nearly-neutral stance in the cast,
      // matching the unsettling-patient no-mouth-then-mouth face. Distinct from
      // every other character's stance in this file's own slice: the only one
      // with almost no shoulder/elbow swing or head turn at all.
      // Both shoulders were swung inward (positive-left and negative-right are
      // both "across the body"), which on a bowl this wide is 0.10m of extra
      // burial for nothing. Signs flipped; the serene, near-neutral read is
      // preserved by keeping the magnitudes the smallest in the cast.
      stance: {
        shoulderL: -0.14, shoulderR: 0.14,
        elbowL: -0.14, elbowR: -0.10,
        twist: 0.02, headTilt: 0.03, headTurn: 0.0,
        hipSway: 0.0, lean: 0.0,
        // A heavy vessel stands on a wide base. Measured at the shipped facing
        // (`limbmatch --mode proto --spec plant`): hull deficiency 0.1057 base,
        // 0.1431 at splay 0.35 alone, 0.1778 with the widened stance under it —
        // and islands stayed at 1 the whole way, so nothing came off the bowl.
        splay: 0.34,
      },
    });
    this.body.add(this.rig.joints.root);
    this.head = this.rig.joints.head;

    const R = this.rig.headRadius;
    const head = this.rig.joints.head;

    // ── Materials ────────────────────────────────────────────────────────────
    const ceramicMat = glossyMat({ rim: true, color: CERAMIC, roughness: 0.25 });      // glazed bowl
    const ceramicShadeMat = glossyMat({ rim: true, color: CERAMIC_SHADE, roughness: 0.28 });
    const trimMat = toonMat({ color: RIM_TRIM, roughness: 0.4 });
    // ── 🚨 THE "HOLE IN THE BOWL" WAS THIS MATERIAL, AND I MISDIAGNOSED IT TWICE ──
    // At the three-quarter lobby facing the bowl's interior renders as a broad
    // white-to-cyan band, and it looks exactly like backdrop showing through a
    // single-sided lathe. It is not. `glossyMat` is `MeshPhysicalMaterial` with
    // `clearcoat: 0.6, clearcoatRoughness: 0.2` hard-coded (`toon.ts:440`), and the
    // broth is a large FLAT disc: at a 20-35 degree camera the clearcoat lobe lines
    // up with the key and sweeps the whole far half of the disc to white. The
    // "cyan" is that white against the bloom of the backdrop behind the rim.
    //
    // Two wrong fixes were shipped and measured before this one, and both are worth
    // recording because each was a plausible reading of the same picture:
    //   1. an interior wall, which was the right instinct for a DIFFERENT bug and
    //      was itself built with `pos.x` as a radius — see the needle note below;
    //   2. `roughness 0.12 -> 0.28`, which does nothing useful, because roughness on
    //      the BASE lobe does not touch the clearcoat lobe at all.
    // `docs/LESSONS.md` §13: an instrument — here, the eye — reporting a plausible
    // wrong cause is worse than none. The tell was that neither fix moved the image.
    //
    // `toonMat` has no clearcoat, and thick soup is not lacquered. `rim: false`
    // because `toonMat`'s Fresnel is opt-OUT and this character has no clip budget.
    //
    // ⚠️ AND CLEARCOAT WAS ONLY HALF OF IT — 0.42 STILL BLEW OUT. `stage.ts` settles
    // where a highlight in this game comes from: *"the highlight a viewer actually
    // sees is the DIRECT lights' GGX lobe (key 3.5 + front 2.2), not the
    // environment's reflection"* — and the broth is a large FLAT disc facing
    // straight up, i.e. the single geometry in the cast most able to point a broad
    // GGX lobe at the camera. At 0.42 the lobe is wide AND bright and it whited out
    // the middle of the bowl; the surviving orange only showed at the rim, which is
    // what made it look like a hole rather than a highlight. 0.86 is the fix and it
    // is also the truth about the material: broth scatters, it does not reflect.
    // ⚠️ `envMapIntensity` is NOT an alternative lever — `stage.ts:396` quotes
    // three.js overwriting per-material `envMapIntensity` with the scene's whenever
    // `material.envMap === null`, which is every material in this project.
    const brothMat = toonMat({ color: BROTH, roughness: 0.86, rim: false }); // broth scatters, it does not reflect

    // ── Bowl ─────────────────────────────────────────────────────────────────
    // A true lathed bowl profile — flared rim, tapering to a small footed base —
    // rather than a squashed sphere, so the silhouette reads unmistakably as a
    // bowl (the flare-then-footed-base shape is what a sphere can never give).
    // `BOWL_PROFILE`/`bowlSurface()` is the one source of truth for the exterior,
    // mirroring `hamburger.ts`'s crownSurface: every decal (rim trim, eyes) is
    // placed through the same function so nothing floats off the curve or sinks
    // into it — the two failure modes named in the brief.
    //
    // Round 4 defect, the one that survived three rounds of colour/radius fixes:
    // the wall at the face's height (r≈0.52-0.58) was barely half the width of the
    // rim flare above it (r=1.0) — a ~2x radius jump. At a glance that reads as TWO
    // masses: a small head wearing a big flared bowl as a hat, with the eyes stuck
    // on the small head below. Fixed by making the profile reach near-maximum
    // radius EARLY (by h=0.55) and HOLD it through the whole belly where the face
    // sits, so there is no narrower "neck" segment for the eyes to look detached
    // on — only a small footed base at the very bottom (mostly hidden against the
    // torso below) and a modest rolled lip at the very top.
    const BOWL_PROFILE: Array<[r: number, h: number]> = [
      [0, 0], [0.34, 0], [0.40, 0.05], [0.60, 0.14], [0.82, 0.26],
      [0.95, 0.40], [1.0, 0.55], [1.0, 0.76], [0.97, 0.86], [1.04, 0.94], [0.92, 1.0],
    ];
    const bowlBaseR = R * 1.18;
    const bowlH = R * 1.35;
    const bowlBottomY = -R * 1.0; // head-local Y of the bowl's own base (h=0) — sunk into the torso below

    const bowlPoint = (rFrac: number, hFrac: number): THREE.Vector2 =>
      new THREE.Vector2(rFrac * bowlBaseR, bowlBottomY + hFrac * bowlH);

    /** Exact surface point + outward normal at a given (theta, hFrac), via linear
     * interpolation over BOWL_PROFILE — same technique as hamburger's crownSurface. */
    const bowlSurface = (theta: number, hFrac: number): { pos: THREE.Vector3; normal: THREE.Vector3 } => {
      const h = THREE.MathUtils.clamp(hFrac, 0, 1);
      let seg = BOWL_PROFILE[0];
      let segNext = BOWL_PROFILE[1];
      for (let i = 0; i < BOWL_PROFILE.length - 1; i++) {
        if (h >= BOWL_PROFILE[i][1] && h <= BOWL_PROFILE[i + 1][1]) {
          seg = BOWL_PROFILE[i];
          segNext = BOWL_PROFILE[i + 1];
          break;
        }
      }
      const [r0, h0] = seg;
      const [r1, h1] = segNext;
      const t = h1 > h0 ? (h - h0) / (h1 - h0) : 0;
      const rFrac = r0 + (r1 - r0) * t;
      const radius = rFrac * bowlBaseR;
      const y = bowlBottomY + h * bowlH;

      const dR = (r1 - r0) * bowlBaseR;
      const dH = (h1 - h0) * bowlH;
      const n2 = new THREE.Vector2(dH, -dR);
      if (n2.lengthSq() < 1e-8) n2.set(1, 0);
      n2.normalize();

      const nx = Math.sin(theta);
      const nz = Math.cos(theta);
      const pos = new THREE.Vector3(nx * radius, y, nz * radius);
      const normal = new THREE.Vector3(nx * n2.x, n2.y, nz * n2.x).normalize();
      return { pos, normal };
    };

    const bowlGeo = new THREE.LatheGeometry(BOWL_PROFILE.map(([r, h]) => bowlPoint(r, h)), 40);
    const bowl = new THREE.Mesh(bowlGeo, ceramicMat);
    bowl.name = 'soup_bowl';
    bowl.castShadow = true;
    bowl.receiveShadow = true;
    head.add(bowl);

    // Rim trim — a thin contrasting band just under the rolled rim lip (the new
    // profile's h 0.86-0.94 flare), the "costume colour contrast" the reference bar
    // calls for, echoed on the torso.
    //
    // ── 🚨 0.80-0.90 -> 0.86-0.94, AND THE COMMENT ABOVE IS WHERE THE BAND SAYS ──
    // ──    IT LIVES. IT WAS 0.06 OF BOWL HEIGHT LOWER, AND THAT GAP IS WHY THE ──
    // ──    BROW HAS NEVER RENDERED A SINGLE PIXEL ──────────────────────────────
    // MEASURED, `cf_ablate --id soup --names soup_brow`, on `headserve --ref 576d7fe`:
    // **paint = 0 changed px and hide = 0 changed px, at pitch 20 AND pitch 58.**
    // Not "hard to see" — the brow owns nothing. `buildFace` has the arithmetic; the
    // short version is that the sclera's top reaches head-local y **+0.0625R** and
    // this band's bottom edge was at **+0.0800R**, so the entire wall available for a
    // brow was **0.0175R ~ 4 px** at lobby framing and the brow was inside the eyeball.
    // `docs/LESSONS.md` §1 for the twenty-second time, and the SECOND time on this
    // exact element — the note in `buildFace` records the first (it was parented
    // inside the eye group), and moving it onto the wall did not help because the
    // eyeball stands 0.084R proud OF that wall.
    //
    // 0.86-0.94 is not a nudge to make room; it is where this comment already said the
    // band was, and it is strictly better geometry as well. `BOWL_PROFILE` has a
    // vertex at h 0.86 and another at 0.94, so between them the lathe is ONE straight
    // segment and the trim's cone is EXACTLY parallel to it at a constant 2% offset.
    // At 0.80-0.90 the cone spanned the kink at 0.86 and only approximated the wall.
    //   band height   0.135R -> 0.108R  (-20%; `RIM_TRIM` is also the boots and the
    //                                    sash, so the dark rung does not live here alone)
    //   bottom edge   y +0.080R -> +0.161R, i.e. 0.0985R of bare ceramic above the eye
    const trimTop = 0.94, trimBottom = 0.86;
    const trimTopPt = bowlSurface(0, trimTop);
    const trimBotPt = bowlSurface(0, trimBottom);
    const trimRadiusTop = new THREE.Vector2(trimTopPt.pos.x, trimTopPt.pos.z).length() * 1.02;
    const trimRadiusBot = new THREE.Vector2(trimBotPt.pos.x, trimBotPt.pos.z).length() * 1.02;
    const trim = new THREE.Mesh(
      new THREE.CylinderGeometry(trimRadiusTop, trimRadiusBot, trimTopPt.pos.y - trimBotPt.pos.y, 40, 1, true),
      trimMat
    );
    trim.name = 'soup_rim_trim';
    trim.position.y = (trimTopPt.pos.y + trimBotPt.pos.y) / 2;
    trim.castShadow = true;
    trim.receiveShadow = true;
    head.add(trim);

    // ── 🚨 THE BOWL HAD A HOLE IN IT, AND YOU COULD SEE THE SKY THROUGH IT ──────
    // The lathe and the rim-trim cylinder are both single-sided, so from any angle
    // that looks INTO the bowl — which at the lobby camera is every angle, the rim
    // being the highest thing on the character — the inner wall between the rim lip
    // (h 1.0) and the broth line (h 0.95) is back-face culled and the BACKGROUND
    // renders through it. `shots/ch/soup/before/lobby_yaw35.png`: the bright cyan
    // band inside the rim is not a specular, it is the sky. It went unnoticed at
    // yaw 0 only because the backdrop happens to be dark brown at that height, so
    // the hole looked like an intentional shadow ring.
    //
    // `docs/LESSONS.md` §1's newer form: the question is not only "is it there" but
    // "is it the SAME" — this rendered plausibly and wrongly for five rounds.
    // Closed with a real interior wall, run from the RIM DOWN so `LatheGeometry`'s
    // automatic normals face inward (the same bottom-to-top rule the exterior obeys,
    // deliberately inverted), plus `doubleSide` so no camera can find an edge case.
    // ⚠️ THE RADIUS IS `|(x, z)|`, NOT `x`. The first version of this loop read
    // `s.pos.x`, and `bowlSurface(0, h)` returns `(sin 0 * r, y, cos 0 * r)` — so
    // `x` is **exactly zero** at the azimuth it was sampled at and the whole wall
    // was built as a 0.0001 m needle down the bowl's axis. It rendered, it cost a
    // draw call, and the hole it was written to close was still there in the next
    // capture. `docs/LESSONS.md` §1 for the twenty-first time, and the tell was that
    // the "fix" changed the image by nothing at all. Every other radius in this file
    // already takes the 2-vector length; this one did not.
    const innerPts: THREE.Vector2[] = [];
    for (let i = 10; i >= 0; i--) {
      const h = 0.78 + (i / 10) * 0.22;
      const s = bowlSurface(0, h);
      const r = new THREE.Vector2(s.pos.x, s.pos.z).length() * 0.965;
      innerPts.push(new THREE.Vector2(Math.max(1e-4, r), s.pos.y));
    }
    const innerWall = new THREE.Mesh(
      new THREE.LatheGeometry(innerPts, 40),
      // ⚠️ `rim: false`, AND THE FIRST VERSION OF THIS WALL WITHOUT IT WAS WORSE
      // THAN THE HOLE IT CLOSED. `toonMat`'s Fresnel rim is opt-OUT (`toon.ts:192`,
      // unlike `glossyMat`'s opt-IN), and a Fresnel term on a CONCAVE surface is at
      // full strength across the whole visible area, because every one of its
      // normals is near-perpendicular to the view. Rendered, the plugged bowl
      // glowed brighter than the sky it replaced. This character has no rim budget
      // to spend anyway — it measures 16.23% above luma 0.94 against a reference
      // band that tops out at 9.29%.
      // The colour is a shadowed interior, not the exterior's shade: the inside of
      // a bowl above its own liquid line is one of the darkest places on a vessel,
      // and it is worth real dark AREA at the top of the character where the match
      // camera sees most.
      // `#7C7160` (0.447) -> `#463D31` (0.243). At 0.447 this is a MID tone, and once
      // the needle bug above was fixed and the wall actually rendered, soup's p05 went
      // 0.18 -> 0.22 — a "shadow" that is lighter than the shadow it replaced is a
      // belt, not a shadow. `rig.ts` records the identical mistake on the neck collar,
      // in the same words. The inside of a vessel above its own liquid line is one of
      // the darkest places on it, and at the 58 degree match camera it is also one of
      // the few dark surfaces that FACES THE CAMERA.
      toonMat({ color: '#463D31', roughness: 0.66, doubleSide: true, rim: false })
    );
    innerWall.name = 'soup_bowl_inner__no_outline';
    // A thin double-sided shell with no volume renders its inverted-hull outline as
    // a solid dark slab — `egg.ts:hood` records the same trade.
    innerWall.userData.noOutline = true;
    innerWall.receiveShadow = true;
    head.add(innerWall);

    // Underside shading disc — closes the bowl's hollow interior at the base so the
    // open lathe never shows a see-through hole from a low camera angle.
    const underside = new THREE.Mesh(new THREE.CircleGeometry(BOWL_PROFILE[1][0] * bowlBaseR, 24), ceramicShadeMat);
    underside.name = 'soup_underside__no_outline';
    underside.userData.noOutline = true;
    underside.rotation.x = Math.PI / 2;
    underside.position.y = bowlBottomY + 0.001;
    head.add(underside);

    // ── Broth surface ────────────────────────────────────────────────────────
    // A shallow glossy disc filling the bowl's opening, set just below the rim so
    // it reads as liquid inside rather than a lid on top.
    // 0.95 -> 0.915. Two things at once: the bowl stops being filled flush to the
    // brim (a pot you can see the inside of reads as a pot; a disc of orange level
    // with the rim reads as a lid), and the dark inner wall above the liquid gets
    // enough visible area at 58 degrees to carry part of the dark rung.
    const brothH = 0.915;
    const brothPt = bowlSurface(0, brothH);
    const brothRadius = new THREE.Vector2(brothPt.pos.x, brothPt.pos.z).length() * 0.90;
    // 🚨 THE LIQUID AND EVERYTHING IN IT NOW SHARE ONE PARENT. Read `brothTop`'s own
    // note: as siblings under `head` they were pulled apart by an integrating bob and
    // the disc ate the ring and the garnish whole. A group also means the solids can
    // be authored in the LIQUID's frame — `y` below is metres above the surface,
    // which is the only frame in which "half-submerged" is expressible.
    this.brothTop = new THREE.Group();
    this.brothTop.name = 'soup_broth_top';
    this.brothTop.position.y = brothPt.pos.y - R * 0.02;
    this.brothBaseY = this.brothTop.position.y;
    head.add(this.brothTop);

    this.brothSurface = new THREE.Mesh(new THREE.CircleGeometry(brothRadius, 40), brothMat);
    this.brothSurface.name = 'soup_broth';
    this.brothSurface.rotation.x = -Math.PI / 2;
    this.brothSurface.receiveShadow = true;
    this.brothTop.add(this.brothSurface);

    this.buildBrothSolids(R, brothRadius);
    this.buildSteam(R, brothPt.pos.y, brothRadius);
    this.buildFace(R, bowlSurface);
    this.buildLadle();
    // ⚠️ ORDER MATTERS AND IT IS NOT COSMETIC: `buildPotStand()` publishes
    // `standRadiusAt`, and `buildAccessories()` places every garment against it.
    this.buildPotStand();
    this.dressLimbs();
    this.buildAccessories();
    this.buildSilhouetteEvents();

    outlineCharacter(this.root);
    this.collectFlashTargets();
    this.rig.restPose();
  }

  /**
   * WHAT IS IN THE LIQUID — a noodle nest, scallion rings and carrot coins, all in
   * the liquid's own frame so `y` is metres above the surface.
   *
   * ── Why this is not just "unhide the old garnish" ────────────────────────────
   * The old build had a `BROTH_DARK` depth ring and three green specks, and its own
   * comment claimed they stopped the broth reading as *"a flat orange disc"*.
   * `tools/tmp/lk1_area.mjs` (same-frame ablation, same shape `pj_probe` uses)
   * measured all four at the three shipped stations:
   *
   *     station        soup_broth_ring   the three specks
   *     lobby yaw 0          0 px              0 px
   *     lobby yaw 35         0 px              0 px
   *     match yaw 90         0 px              0 px
   *
   * — while the selector MATCHED 1 and 3 objects respectively, so this is "they
   * render and are invisible", not "they are missing". The cause is in `brothTop`'s
   * note. The specks were also UNNAMED, which is why they had to be addressed by
   * material hex: an unnamed mesh is invisible to every diagnostic in this repo.
   * Everything below carries a name.
   *
   * ── The nest, and why the strand heights are expressed in TUBE RADII ──────────
   * The disc is opaque, so nothing below it can be seen and "submerged" has to be
   * faked with height and colour. A strand at `y = -0.55 * tube` shows a thin
   * crescent; at `+0.30 * tube` it rides the surface. Three depths plus two albedos
   * give the flat disc a value range it never had: `NOODLE_WET` 0.345, `BROTH`
   * 0.620, `NOODLE_TOP` 0.730 in luma.
   *
   * ── The cost, stated ─────────────────────────────────────────────────────────
   * +20 meshes per soup fighter, i.e. +20 draw calls, derived from `lk1_area`'s own
   * `matched` counts rather than by counting the source: the liquid group holds 26
   * meshes after (2 disc + 1 ring + 10 float strands and their outlines + 4 sunk +
   * 5 scallion + 4 carrot) against 6 before.
   *
   * ⚠️ MEASURED SINCE, AND THE MESH COUNT IS RIGHT WHILE BOTH DRAW NUMBERS WERE WRONG
   * (`5708407`, `lq_draw.mjs`, `renderer.info` with `autoReset=false` on a frozen clock):
   * per VISIBLE fighter it is **+19 without a shadow pass and +25 with one**, ~30% above
   * the mesh count — and at `MAX_FIGHTERS` 6 on the ARENA'S OWN SPAWNS it is **+26, not
   * +120**, because five of the six are frustum-culled. +139 is reachable only by packing
   * all six into one frame, which no match does. On a mobile-tier frame (tier read back as
   * `low`, DPR 1.25) that is 462 -> 487. **The garnish stays.**
   * The lesson is the shape, not the number: "+20 meshes therefore +20 draw calls, times
   * six fighters" is two unmeasured inferences stacked, and they missed in OPPOSITE
   * directions — low per fighter, 5x high on the fleet.
   *
   * Draw counts are an EXACT metric (CLAUDE.md rule 10) and this one has
   * NOT been measured against a frame budget — `tools/perf.mjs` was not run.
   *
   * ⚠️ NOTHING HERE CRESTS THE RIM, AND THAT IS DELIBERATE. A noodle looping out of
   * the bowl is the obvious silhouette move and this file has already paid for it:
   * the `loop` import was REMOVED because two torus arcs on the head *"read as
   * ears"*. Every solid stays inside the liquid plane, so the silhouette — and
   * `buildSilhouetteEvents`'s read of it — is untouched by this pass.
   */
  private buildBrothSolids(R: number, brothRadius: number): void {
    const top = this.brothTop;
    // Same clearcoat trap as the broth disc: `glossyMat` is `MeshPhysicalMaterial`
    // with clearcoat hard-coded, and a broad flat lobe pointed at the key is what
    // whited out the middle of this bowl for five rounds. `rim: false` for the same
    // clipping budget the disc is on.
    const deepMat = toonMat({ color: BROTH_DARK, roughness: 0.82, rim: false });
    const wetMat = toonMat({ color: NOODLE_WET, roughness: 0.62, rim: false });
    const topMat = toonMat({ color: NOODLE_TOP, roughness: 0.52, rim: false });
    const scallionMat = toonMat({ color: SCALLION, roughness: 0.5, rim: false });
    const carrotMat = toonMat({ color: CARROT, roughness: 0.5, rim: false });

    // ── The depth ring, re-authored ──────────────────────────────────────────
    // WAS `RingGeometry(r * 0.7, r * 0.98)` — 0.7 to 0.98 is 94% of the disc's AREA,
    // so the moment the occlusion bug above is fixed that ring stops being a depth
    // cue and becomes the broth. Narrowed to 0.84-1.0: the liquid darkening where it
    // meets the wall, which is what the comment always claimed it was.
    const brothRing = new THREE.Mesh(new THREE.RingGeometry(brothRadius * 0.84, brothRadius, 40), deepMat);
    brothRing.name = 'soup_broth_ring__no_outline';
    brothRing.userData.noOutline = true;
    brothRing.rotation.x = -Math.PI / 2;
    brothRing.position.y = R * 0.002;
    top.add(brothRing);

    const tube = R * 0.045;   // ~0.025 m — a chunky vinyl-toy strand, not a hair

    /**
     * One noodle strand. `Euler` order is XYZ, i.e. the matrix is RX·RY·RZ, so `z`
     * spins the arc about its own ring axis (choosing WHERE the open ends sit) and
     * `x` then lays the ring into the liquid plane. A few hundredths of extra tilt
     * on `x` is what stops four concentric arcs reading as a target.
     */
    // ⚠️ `soup_noodle_float`, NOT `soup_noodle` — THE LADLE ALREADY OWNS THAT NAME.
    // `buildLadle` drapes four `soup_noodle` capsules over the scoop, so the first
    // version of this nest made `--hide soup_noodle` match 18 objects (5 strands + 4
    // ladle noodles + 9 outlines) and every per-part number silently mixed a prop on
    // the hand into a surface on the head. A duplicate name does not break the
    // RENDER, which is exactly why it survives: it breaks the DIAGNOSTIC, and this
    // repo's part maps and ablations all key on `name`.
    const strand = (
      name: string, mat: THREE.Material, radFrac: number, arc: number,
      spin: number, tilt: number, x: number, z: number, k: number, thick = 1,
    ): void => {
      const t = tube * thick;
      const m = new THREE.Mesh(new THREE.TorusGeometry(brothRadius * radFrac, t, 8, 24, arc), mat);
      m.name = name;
      m.rotation.set(-Math.PI / 2 + tilt, 0, spin);
      m.position.set(x * brothRadius, t * k, z * brothRadius);
      m.castShadow = true;
      m.receiveShadow = true;
      top.add(m);
    };

    // ── 🚨 ROUND 1 OF THIS NEST WAS CONCENTRIC, AND IT READ AS A SNAIL ──────────
    // The first layout gave every strand a large radius (0.21-0.50 of the disc) and
    // an offset near zero, so six arcs shared one centre. Rendered at BOTH cameras
    // that is not a tangle of noodles, it is a coiled rope — a spiral occupying the
    // middle third with a bare yellow ring around it. The fix is the opposite
    // parameterisation: SMALL radii (0.19-0.31) pushed OUT to offsets of ~0.45, so
    // each arc is a separate curl and the nest reaches the wall.
    // Arc lengths are 2.0-3.4 rad (115-195 deg) for the same reason: at 4-5 rad a
    // torus arc closes enough to read as a RING, which is what the scallion is.
    // Bounded so ring radius + tube + offset stays inside 0.93 of the disc — a
    // strand crossing the edge would float over the dark gap between the liquid and
    // the inner wall and read as a crack in the bowl.
    strand('soup_noodle_sunk', wetMat, 0.30, 3.0, 1.2, 0.03, 0.30, 0.30, -0.55, 0.92);
    strand('soup_noodle_sunk', wetMat, 0.22, 3.4, 3.9, -0.04, -0.36, -0.14, -0.50, 0.92);
    strand('soup_noodle_float', topMat, 0.28, 2.6, 0.4, 0.05, -0.40, 0.24, -0.10, 1.06);
    strand('soup_noodle_float', topMat, 0.23, 3.2, 2.3, -0.06, 0.38, -0.32, 0.05, 0.94);
    strand('soup_noodle_float', topMat, 0.26, 2.2, 4.4, 0.04, 0.08, 0.46, 0.20, 1.00);
    strand('soup_noodle_float', topMat, 0.19, 3.4, 5.7, -0.03, -0.14, -0.44, 0.30, 0.90);
    strand('soup_noodle_float', topMat, 0.31, 2.0, 3.1, 0.02, 0.04, -0.02, 0.12, 1.02);

    // ── Scallion rings ───────────────────────────────────────────────────────
    // A real ring, not the old flattened sphere: the hole is what makes a green dot
    // read as a spring onion instead of as a pea, and it costs 120 triangles.
    const scallionR = R * 0.052, scallionTube = R * 0.017;
    for (const [sx, sz, spin] of [
      [0.62, 0.18, 0.4], [-0.58, -0.30, 1.9], [0.10, -0.62, 3.1],
      [-0.24, 0.60, 4.7], [0.40, 0.46, 5.9],
    ] as const) {
      const ring = new THREE.Mesh(new THREE.TorusGeometry(scallionR, scallionTube, 6, 12), scallionMat);
      ring.name = 'soup_scallion__no_outline';
      ring.userData.noOutline = true;
      ring.rotation.set(-Math.PI / 2 + 0.06, 0, spin);
      ring.position.set(sx * brothRadius * 0.78, scallionTube * 0.2, sz * brothRadius * 0.78);
      ring.receiveShadow = true;
      top.add(ring);
    }

    // ── Carrot coins ─────────────────────────────────────────────────────────
    // Six-sided rather than round: a hexagon reads as a CUT slice at 58 degrees,
    // where a cylinder of 24 segments reads as a dot. Also where the frame's warm
    // chroma went when the broth stopped being orange.
    for (const [cx, cz, spin] of [[-0.44, 0.34, 0.5], [0.52, -0.36, 2.2]] as const) {
      const coin = new THREE.Mesh(new THREE.CylinderGeometry(R * 0.062, R * 0.062, R * 0.020, 6), carrotMat);
      coin.name = 'soup_carrot';
      coin.rotation.set(0.05, spin, 0);
      coin.position.set(cx * brothRadius * 0.8, R * 0.004, cz * brothRadius * 0.8);
      coin.castShadow = true;
      coin.receiveShadow = true;
      top.add(coin);
    }
  }

  /**
   * Rising steam — translucent, soft-matte wisps (not glossy, which would read as
   * glass/plastic) drifting up from the broth surface. Kept few and subtle per the
   * brief: enough to sell "hot" without washing out the face at gameplay distance.
   */
  private buildSteam(R: number, brothY: number, brothRadius: number): void {
    const head = this.rig.joints.head;
    const wispSpots: Array<[number, number]> = [[-0.35, 0], [0.15, 0.3], [0.4, -0.25]];
    for (let i = 0; i < wispSpots.length; i++) {
      const [wx, wz] = wispSpots[i];
      const group = new THREE.Group();
      group.name = 'soup_steam_wisp';
      group.position.set(wx * brothRadius * 0.7, brothY, wz * brothRadius * 0.7);
      head.add(group);

      const mat = toonMat({ color: STEAM, roughness: 0.9, transparent: true, opacity: 0.3 }) as THREE.MeshStandardMaterial;
      // Steam that writes depth punches a hole in whatever is behind it — and what
      // is behind it is this character's own face. `docs/LESSONS.md` §1.
      mat.depthWrite = false;
      this.steamMats.push(mat);
      // Three stacked, slightly offset capsules per wisp — a cheap curling-smoke read
      // without needing a real particle system.
      for (let j = 0; j < 3; j++) {
        const seg = new THREE.Mesh(new THREE.CapsuleGeometry(R * (0.042 - j * 0.007), R * 0.11, 4, 6), mat);
        seg.position.set(Math.sin(j * 1.7 + i) * R * 0.04, R * (0.08 + j * 0.09), Math.cos(j * 1.3 + i) * R * 0.03);
        seg.rotation.z = Math.sin(j + i) * 0.3;
        seg.userData.noOutline = true;
        group.add(seg);
      }
      this.steamWisps.push(group);
    }
  }

  /**
   * THE FACE, rebuilt to `rules.ts`'s rewritten `face:` spec.
   *
   * WAS: *"Grey steam-coloured eyes and NO mouth — the one genuinely unsettling-calm
   * read in the cast."* Both halves of that are now rejected upstream (see this
   * file's header and `docs/DECISIONS-FOR-URI.md` §42), and the old text is kept
   * here because it explains every choice the new build undoes.
   *
   * Four things the spec asks for, each with the specific defect it replaces —
   * all four visible in `shots/ch/soup/before/crop_face.png`:
   *
   * 1. **A white sclera that is the brightest value anywhere on the character.**
   *    Was `#EDEDEA` (0.930) against a `#DCD3C2` bowl (0.830) — a tenth of a stop,
   *    on a surface the key light hits harder than it hits the eye. Now `#FFFFFF`
   *    against a 0.722 bowl. The per-part measurement behind this is blunt: **0% of
   *    our eye pixels are above 0.85 luma against the reference's 31.1% / 34.1%.**
   * 2. **A dark pupil OFFSET for gaze.** Was dead-centre in both eyes, which is
   *    the doll stare in the before crop. Now nudged toward the nose and down, so
   *    the two eyes converge on the viewer.
   * 3. **An explicit catchlight.** There was one, and it lost: the pupil ran
   *    `roughness 0.30`, so a broad specular smear across the whole pupil was
   *    brighter and larger than the 0.029R glint meant to be the catchlight. The
   *    pupil is now matte and the glint is the only bright thing in the eye.
   * 4. **A mouth with an INTERIOR VALUE STEP.** Was a `TorusGeometry` arc 0.17R
   *    wide next to 0.41R eyes — the "painted curve" §42 names, and about a third
   *    of the size it needed to read at all. Now a recessed cavity at 0.089 luma
   *    with a warm interior at 0.412 behind the lip: an OPENING, not a stroke.
   *
   * ⚠️ And the eye orientation was a live instance of `docs/LESSONS.md` §12.
   * `setFromUnitVectors` picks the shortest arc, so it leaves a DIFFERENT residual
   * roll on each side — the bug that gave Sushi a lazy eye. Both eyes here were
   * built with it, and every offset inside them (glint, pupil) therefore landed in
   * a slightly different place per side. The basis is now built explicitly from
   * world up, exactly as `appendages.ts:aim` does it, so a mirrored pair is
   * genuinely mirrored and `-sx` means "toward the nose" on both sides.
   *
   * Placement is unchanged: EYE_H sits in the profile's h 0.55–0.76 plateau where
   * the bowl holds full rim-width radius, so the face is on the bowl's main body
   * rather than on a narrower neck below it.
   */
  private buildFace(R: number, bowlSurface: (theta: number, hFrac: number) => { pos: THREE.Vector3; normal: THREE.Vector3 }): void {
    const face = this.rig.joints.face;
    // The features are authored in EXACT bowl-surface coords by `bowlSurface`, so they
    // cannot inherit `face`'s generic sphere-tuned forward offset — it is zeroed, and
    // then the features are parented to `face` ANYWAY. With the offset cleared `face` is
    // a direct child of `head` with an identity transform, so this is a pure reparent and
    // nothing moves (proved by `tools/tmp/facemove.mjs`, which hashes every mesh world
    // matrix in the model). It is not cosmetic: `thumbs.ts`'s character-select framing
    // rule reads this joint and falls back to the whole HEAD box when it is empty, and
    // `tools/tmp/chars_metrics.mjs` cannot assert a face it cannot find.
    face.position.set(0, 0, 0);

    // Structural fix, round 4: EYE_H now sits at h=0.62, squarely inside the
    // profile's h 0.55-0.76 plateau where the bowl holds its FULL rim-width radius
    // (see BOWL_PROFILE's own comment) — the same wide wall the rim trim and the
    // broth sit on, not a narrower transitional neck below it. The face is now ON
    // the bowl's main body, not on a separate head-shaped mass underneath it.
    // Orientation still uses the flattened HORIZONTAL-outward direction rather
    // than the raw 3D normal, as a belt-and-braces fix against any residual
    // downward tilt in the wall segment.
    const EYE_THETA = 0.42;
    const EYE_H = 0.63;

    /**
     * Orient a feature so its +Z points out of the bowl's wall and its +Y is world
     * up, with an EXPLICIT basis. See the §12 note in this method's docblock — the
     * `setFromUnitVectors` this replaces left a different roll on each side.
     *
     * With `y = world up` and `z = outward` both horizontal-plane derived, local +X
     * comes out as `up x outward`, which for an eye at `theta = sx * EYE_THETA`
     * points AWAY from the face's centre on both sides. So "toward the nose" is
     * `-sx` on local X, which is what the pupil offset below relies on.
     */
    const faceBasis = (obj: THREE.Object3D, at: THREE.Vector3, out: THREE.Vector3): void => {
      const z = out.clone().normalize();
      const up = new THREE.Vector3(0, 1, 0);
      const x = new THREE.Vector3().crossVectors(up, z).normalize();
      const y = new THREE.Vector3().crossVectors(z, x).normalize();
      obj.position.copy(at);
      obj.quaternion.setFromRotationMatrix(new THREE.Matrix4().makeBasis(x, y, z));
    };

    // WAS `#EDEDEA` — a "near-white" that was only 0.10 of luma above the bowl it
    // sat on. Pure white, and it is now the brightest albedo on the model by 0.24.
    const scleraMat = toonMat({ color: '#FFFFFF', roughness: 0.46 });
    // WAS `#2B3138` at `roughness 0.30`. The colour was fine; the ROUGHNESS was the
    // defect — a glossy pupil grows a broad specular that outshines the catchlight
    // meant to be the only highlight in the eye. Matte, and darker.
    const pupilMat = toonMat({ color: '#171C22', roughness: 0.62 });
    // WAS `#B7BABD`, a cool grey LIGHTER than the ceramic — rendered, it read as a
    // glass dome over a googly eye rather than as a lid. A lid is made of the same
    // stuff as the face, one step down in value.
    const lidMat = toonMat({ color: '#B0A288', roughness: 0.5 });
    const browMat = toonMat({ color: '#4A4038', roughness: 0.5 });

    for (const sx of [-1, 1] as const) {
      const { pos } = bowlSurface(sx * EYE_THETA, EYE_H);
      const outward = new THREE.Vector3(pos.x, 0, pos.z).normalize();
      const eye = new THREE.Group();
      eye.name = 'soup_eye';
      // 0.03R -> 0.010R of stand-off, and the sclera is flattened from `z 0.55` to
      // `z 0.42`. Together those are the difference between an eyeball GLUED ON and
      // an eye SET IN: the before crop's eyes bulge off the ceramic as two separate
      // spheres, which is most of why the face read as a toy's stick-on parts.
      faceBasis(eye, pos.clone().addScaledVector(outward, R * 0.010), outward);
      face.add(eye);

      const white = new THREE.Mesh(new THREE.SphereGeometry(R * 0.200, 18, 14), scleraMat);
      white.name = 'soup_eye_white';
      white.scale.set(1, 1.06, 0.42);
      white.castShadow = true;
      eye.add(white);

      // OFFSET FOR GAZE, which is item 2 of the spec. Toward the nose (`-sx` on
      // local X, see `faceBasis`) and slightly down, so the two eyes converge just
      // in front of the viewer and the stare becomes deliberate instead of blank.
      // Small on purpose — soup is the serene one, and a large converge reads as
      // cross-eyed comedy.
      const pupil = new THREE.Mesh(new THREE.SphereGeometry(R * 0.112, 16, 14), pupilMat);
      pupil.name = 'soup_eye_pupil';
      // ── 0.026R -> 0.060R, AND THE FIRST VALUE WAS CANCELLED BY PARALLAX ───────
      // Rendered at 0.026R the eyes came out WALL-EYED, both pupils sitting outboard
      // of their sclera (`shots/ch/soup/after/crop_face.png`, first pass). The basis
      // was right and the arithmetic was right; what was missing is that the pupil
      // stands `0.062R` PROUD of the sclera's centre on an eye whose axis is turned
      // `EYE_THETA = 0.42` rad away from the viewer, so it projects outboard by
      // `0.062R * sin(0.42) = 0.025R` before any authored offset applies. 0.026R of
      // inward offset therefore bought exactly nothing — it paid the parallax back
      // and stopped. The offset has to beat it, not match it.
      pupil.position.set(-sx * R * 0.060, -R * 0.020, R * 0.062);
      pupil.scale.set(1, 1, 0.42);
      pupil.castShadow = true;
      eye.add(pupil);

      // THE CATCHLIGHT. `flatMat` is unlit, so it is the one thing in the frame that
      // cannot be dimmed by the lighting rig. Constant sign, not `sx`-mirrored: a
      // catchlight is a reflection of ONE key light, so both eyes carry it on the
      // same WORLD side. (With the explicit basis above, local +X is world-ish +X
      // on both eyes, which is what makes that possible — under the old
      // `setFromUnitVectors` roll it was not.)
      // ── 🚨 IT FOLLOWED THE PUPIL'S SHIFT AND STILL SAT ON THE RIM ───────────────
      // The comment below is about the pupil's INWARD shift and it is satisfied. The
      // defect is the offset UP: read at 10x off the shipped lobby camera
      // (`shots/ey/zoom/soup-Leye.png`) the white breaks the pupil's upper-left edge
      // and runs into the sclera, so the dark reads as a "C". `tools/tmp/ey_pacman.mjs`
      // scores it **0.8842** against burrito's genuinely-whole 0.9679.
      //
      // The arithmetic, which nobody had done in the eye's own frame: the pupil sits at
      // y = -0.020R and the glint at y = +0.048R, so the OFFSET is 0.068R, not 0.048R —
      // reading an absolute position as an offset is the trap, and `hotdog.ts` records
      // the same one.
      //   normalised centre  sqrt((.038/.112)^2 + (.068/.112)^2) = 0.696
      //   plus glint radius  0.325 along that direction              -> **1.02**
      // i.e. 2% OUTSIDE the pupil before bloom is counted. `egg.ts` carries the two
      // pixel-space terms that make even a passing in-plane sum insufficient (BLOOM:
      // `flatMat` white is 1.000 against `stage.ts`'s 0.80 threshold, so 2-3 px of glow
      // eat the rim; BURIAL: a glint centred behind the pupil's front face emerges as a
      // cap displaced outward). Target is 0.62, not 0.82.
      //   offset 0.038/0.068 -> 0.014/0.026 (absolute y +0.048 -> +0.006)
      //          0.264 + 0.357 = **0.621**, a 38% margin
      //   z      0.098 -> 0.111R with `scale.z 0.5 -> 0.45`, so the lens sits 0.004R
      //          PROUD of the pupil's front face (0.1073R at that offset) instead of
      //          0.011R behind it.
      const glint = new THREE.Mesh(new THREE.SphereGeometry(R * 0.040, 10, 10), flatMat('#ffffff'));
      glint.name = 'soup_eye_glint';
      // Follows the pupil's own inward shift, or it drifts off the dark disc it is
      // supposed to sit on and lands on white, where a white glint is invisible.
      glint.position.set(-sx * R * 0.060 - R * 0.014, R * 0.006, R * 0.111);
      glint.scale.set(1, 0.85, 0.45);
      glint.userData.noOutline = true;
      eye.add(glint);
      // A second, much smaller bounce low on the opposite side. Two highlights of
      // very different size is what stops an eye reading as plastic — it is the one
      // piece of Egg's eye the per-part measurement said we were still short of.
      //
      // ⚠️ AND IT WAS NOT THERE. `docs/LESSONS.md` §1 again, in its cheapest form: the
      // pupil's front face at this bounce's own offset is 0.1023R and the bounce's
      // front reached only **0.0985R**, so it was drawn entirely INSIDE the pupil and
      // the eye has carried one highlight, not two, for as long as the file has said
      // it carries two. Read the before crop — there is a single white dot.
      // z 0.090 -> 0.104R with `scale.z 0.45` puts its front at 0.1117R, 0.009R proud.
      // OFFSET FROM THE PUPIL's centre — which is at y = -0.020R, so the ABSOLUTE y is
      // -0.049R — pulled 0.048/0.032 -> 0.044/0.029 (0.470 + 0.152 = 0.622) so it
      // clears the rim by the same margin, and it stays 0.0229R (~6 px) clear of the
      // key glint: `pizza.ts` records what happens when two highlights are pulled in
      // far enough to touch — they render as one lumpy shape, not as two lights.
      const glint2 = new THREE.Mesh(new THREE.SphereGeometry(R * 0.017, 8, 8), flatMat('#ffffff'));
      glint2.name = 'soup_eye_glint2';
      glint2.position.set(-sx * R * 0.060 + R * 0.044, -R * 0.049, R * 0.104);
      glint2.scale.set(1, 0.9, 0.45);
      glint2.userData.noOutline = true;
      eye.add(glint2);

      // Heavy lid — a shallow dome capping the sclera's upper quarter, sitting proud
      // so it casts a real shadow line rather than z-fighting with the white beneath.
      // Thinner than before (0.30PI -> 0.22PI of the sphere) because the sclera is
      // now the character's brightest value and covering a third of it was paying
      // that back. Still the shape that makes the stare PATIENT rather than blank.
      const lid = new THREE.Mesh(
        new THREE.SphereGeometry(R * 0.196, 18, 10, 0, Math.PI * 2, 0, Math.PI * 0.22),
        lidMat
      );
      lid.name = 'soup_eye_lid';
      lid.position.set(0, R * 0.014, R * 0.004);
      lid.scale.set(1, 1, 0.46);
      lid.castShadow = true;
      eye.add(lid);

      // ── THE BROW WAS RENDERING AND INVISIBLE. `docs/LESSONS.md` §1, nineteenth ──
      // It was parented INSIDE the eye group at `z = 0.036R` while the sclera in
      // front of it reached `0.113R` — so it sat behind the eyeball and inside the
      // bowl wall. Read the before crop: there is no brow on either eye, and the
      // file has described one for three rounds.
      //
      // It is now placed on the BOWL'S OWN SURFACE, above the eye, by the same
      // `bowlSurface` call everything else here uses — so it is on the wall by
      // construction rather than at a remembered offset from something else.
      //
      // ── 🚨 AND THAT FIX DID NOT WORK EITHER. IT WAS STILL 0 PIXELS. ────────────
      // `cf_ablate --id soup --names soup_brow` on `headserve --ref 576d7fe`:
      // **paint 0 changed px, hide 0 changed px, at pitch 20 AND at pitch 58.** Both
      // arms of the known-bad, both cameras, four runs. `docs/LESSONS.md` §1 twice on
      // one mesh; the first wording is kept above because it is the only record of
      // where the brow used to be, and because being RIGHT about "put it on the wall"
      // is exactly what made the second failure invisible.
      //
      // Being on the wall is not enough, because THE EYEBALL STANDS PROUD OF THE WALL
      // and reaches HIGHER than the brow did. All heights are head-local Y, R = head
      // radius, bowl base y = -1.0R and bowl height 1.35R:
      //   eye centre        -1.0R + 0.630 * 1.35R              = -0.1495R
      //   sclera half-height  R*0.200 * scale.y 1.06           =  0.2120R
      //   SCLERA TOP                                           = +0.0625R
      //   old brow centre   -1.0R + (0.630 + 0.105) * 1.35R    = -0.0078R  ← 0.070R
      //                                                          BELOW the sclera top
      // The sclera at that height still projects 0.062R out of the wall while the
      // brow's own front reached 0.034R, so the brow was drawn INSIDE the eyeball at
      // very nearly the eye's own azimuth. That is why `hide` moves nothing: there is
      // no camera from which any part of it is the frontmost surface.
      //
      // Placed off the SCLERA'S TOP now instead of off `EYE_H`, so it cannot drift
      // back inside the eye when either moves, and inverted through `bowlSurface`'s
      // own linear h->y map rather than through a remembered 1.35R:
      const scleraTopY = pos.y + R * 0.212;
      const yAt0 = bowlSurface(0, 0).pos.y, yAt1 = bowlSurface(0, 1).pos.y;
      const hOfY = (y: number): number => (y - yAt0) / (yAt1 - yAt0);
      // ── SHAPE: an ELLIPSOID, not a capsule, and `noOutline` ────────────────────
      // `taco.ts` round 3 / `egg.ts` round 5, two independent blind critics: *"the
      // mouth and brow marks look like flat pasted-on decals rather than sculpted
      // features"*. **Nothing in nature that is part of a face has parallel sides**,
      // and a `CapsuleGeometry` is parallel sides plus a sudden round end, wrapped in
      // its own closed inverted-hull contour. Both go.
      // The mark is also made LONGER AND LEANER rather than mass-preserved. taco's
      // derivation preserves a capsule's silhouette area because taco's brow was
      // already visible and the round was about shape alone; here the capsule's area
      // is 0.00966R^2 OF NOTHING, so there is no mass to preserve — and taco's own
      // note says the failure it fixed was "two fat brown ovals" and that *a brow
      // reads as a brow by being a thin stroke*. b/a is taco's 0.18, not the capsule's
      // 0.235, and the half-length goes 0.1145R -> 0.175R so the brow is 87% of the
      // eye's width instead of 57% (taco: *"a brow shorter than the eye it sits over
      // reads as a smudge"*).
      const BROW_A = R * 0.175, BROW_B = R * 0.020, BROW_TILT = 0.10;
      // Tilted, the ellipsoid's own vertical half-extent is
      // sqrt((a sin t)^2 + (b cos t)^2) = 0.0265R, NOT b — the term that makes a
      // clearance sum done on `b` alone read as clear when it is not.
      const browHalfH = Math.hypot(BROW_A * Math.sin(BROW_TILT), BROW_B * Math.cos(BROW_TILT));
      // 0.020R of BARE ceramic under the mark, the same order as taco's 0.020F.
      const browY = scleraTopY + R * 0.020 + browHalfH;
      const browPt = bowlSurface(sx * EYE_THETA * 0.98, hOfY(browY));
      const browOut = new THREE.Vector3(browPt.pos.x, 0, browPt.pos.z).normalize();
      const browG = new THREE.Group();
      faceBasis(browG, browPt.pos.clone().addScaledVector(browOut, R * 0.012), browOut);
      face.add(browG);
      const brow = new THREE.Mesh(new THREE.SphereGeometry(1, 20, 10), browMat);
      brow.name = 'soup_brow';
      brow.scale.set(BROW_A, BROW_B, R * 0.016);
      // Flat, not angled into a V — a V reads as annoyed, and soup is the serene
      // one. The tiny `sx` tilt lifts the OUTER end, which is calm/knowing; the
      // inner-end lift is the angry direction (verified on egg's own crease note).
      // ⚠️ The `PI/2` is gone with the capsule: a capsule's long axis is +Y and this
      // ellipsoid's is +X, so `Rz(PI/2 + sx*t)` and `Rz(sx*t)` send them to the SAME
      // unsigned direction. Same tilt, same sign, same read.
      brow.rotation.z = sx * BROW_TILT;
      brow.userData.noOutline = true;
      brow.castShadow = true;
      browG.add(brow);
    }

    // ── THE MOUTH: AN OPENING, NOT A STROKE ─────────────────────────────────────
    // WAS a `TorusGeometry` arc, 0.17R wide, 0.017R thick, in flat `#343A41`. Two
    // separate failures, both visible in the before crop: it is ~40% of the width
    // it needs next to 0.41R eyes, and it is a painted curve with no interior — the
    // exact construction `docs/DECISIONS-FOR-URI.md` §42 names as the cast-wide
    // defect ("a mouth with an interior value step so it reads as an opening rather
    // than a painted curve").
    //
    // Three parts, and the middle one is the whole point:
    //   cavity  #1E1512  luma 0.089   the opening, sunk INTO the wall
    //   throat  #B0574C  luma 0.412   the interior, a 0.32 step behind the lip
    //   lip     the bowl's own shade  a soft rim so the opening has an edge
    // `calm is an expression, not an absence` — it is a small, slightly open,
    // patient mouth, not a grin and not a gasp.
    // ── 0.46 -> 0.365, AND WIDER THAN IT IS TALL ────────────────────────────────
    // At 0.46 the opening sits directly under the eyes at nose height and comes out
    // ROUND, and rendered it reads as a NOSTRIL, not a mouth
    // (`shots/ch/soup/after/crop_face.png`, first pass — one small round hole in the
    // middle of the face). Two changes, both about read rather than taste: drop it
    // to 0.365 so there is a cheek between it and the eyes, and make it 2.0x wider
    // than tall. A round hole is a nostril at any size; a wide flattened one is a
    // mouth at any size.
    const MOUTH_H = 0.365;
    const mouthPt = bowlSurface(0, MOUTH_H);
    const mouthOutward = new THREE.Vector3(mouthPt.pos.x, 0, mouthPt.pos.z).normalize();
    const mouth = new THREE.Group();
    mouth.name = 'soup_mouth';
    faceBasis(mouth, mouthPt.pos.clone().addScaledVector(mouthOutward, R * 0.004), mouthOutward);
    face.add(mouth);

    const lipMat = toonMat({ color: '#9C8E77', roughness: 0.55 });
    const cavityMat = toonMat({ color: '#1E1512', roughness: 0.72 });
    const throatMat = toonMat({ color: '#B0574C', roughness: 0.6 });

    // The lip: a squashed ring standing just proud of the wall, so the opening reads
    // as a hole in a surface instead of a decal floating on one.
    const lip = new THREE.Mesh(new THREE.TorusGeometry(R * 0.150, R * 0.026, 8, 24), lipMat);
    lip.name = 'soup_mouth_lip';
    lip.scale.set(1, 0.50, 0.60);
    lip.position.z = R * 0.010;
    lip.castShadow = true;
    mouth.add(lip);

    const cavity = new THREE.Mesh(new THREE.SphereGeometry(R * 0.152, 16, 12), cavityMat);
    cavity.name = 'soup_mouth_cavity';
    cavity.scale.set(1, 0.48, 0.32);
    cavity.position.z = -R * 0.006;
    mouth.add(cavity);

    // ── THE THROAT WAS RENDERING AND INVISIBLE. `docs/LESSONS.md` §1, twentieth ──
    // First pass put it at `z = -0.004R` inside a cavity ellipsoid whose front face
    // at that height reaches `+0.034R`, so the whole interior step was sealed inside
    // the shape it was supposed to step against. The mouth came back as one flat
    // near-black hole — i.e. the exact "painted curve with no interior" the spec is
    // written to eliminate, with an extra mesh paying for nothing.
    //
    // It has to POKE THROUGH: the front of this ellipsoid reaches `0.014R + 0.085R *
    // 0.40 = 0.048R`, comfortably past the cavity's `0.034R` at the same height. So
    // the lower third of the opening is warm interior and the rest is near-black,
    // which is the value step — cavity 0.089, throat 0.412, a 0.32 break INSIDE the
    // mouth's own outline.
    const throat = new THREE.Mesh(new THREE.SphereGeometry(R * 0.100, 14, 12), throatMat);
    throat.name = 'soup_mouth_throat';
    throat.scale.set(1, 0.40, 0.40);
    throat.position.set(0, -R * 0.036, R * 0.014);
    throat.userData.noOutline = true;
    mouth.add(throat);
  }

  /**
   * A ladle in `handR`: wooden handle + a small steel scoop, nodding at Soup
   * Splash/Noodle Toss/Soup Dump without inventing an unrelated prop. A few
   * noodles drape over the scoop's rim as the "matte noodle" material callout.
   */
  private buildLadle(): void {
    // Round 2 defect: every offset here was scaled against `R` (the BOWL/head
    // radius, ~0.44m) instead of the hand's own scale. `ChibiRig` sizes the hand
    // mitt from `CHARACTER_HEIGHT` (handRadius = height*0.075 ≈ 0.16m) — completely
    // independent of the food mass — so an offset of `R*0.05` (~0.02m) barely
    // clears the CENTRE of a 0.16m-radius hand sphere: the whole prop was built
    // sitting inside the mitt, invisible. Fixed by sizing against handRadius.
    const handRadius = this.rig.metrics.handRadius;
    const hand = this.rig.joints.handR;
    const ladle = new THREE.Group();
    ladle.name = 'soup_ladle';
    ladle.position.set(handRadius * 0.1, 0, handRadius * 0.35);
    ladle.rotation.set(-0.25, 0, 0.12);
    hand.add(ladle);

    const handleMat = toonMat({ color: WOOD, roughness: 0.6 });
    const handle = new THREE.Mesh(new THREE.CapsuleGeometry(handRadius * 0.16, handRadius * 1.7, 4, 8), handleMat);
    handle.name = 'soup_ladle_handle';
    handle.position.set(0, -handRadius * 0.35, 0);
    handle.castShadow = true;
    ladle.add(handle);

    // `#C7CDD4` (luma 0.797) -> `#9AA3AC` (0.629). Steel that pale is a third
    // near-white area on the cast's worst near-white offender, and a ladle bowl is a
    // shadowed concave surface — it has no business being brighter than the ceramic
    // it hangs beside. Read as metal by its `metalness`, not by its albedo.
    const bowlMat = glossyMat({ rim: true, color: '#9AA3AC', roughness: 0.34, metalness: 0.4 });
    const scoop = new THREE.Mesh(new THREE.SphereGeometry(handRadius * 0.5, 16, 12, 0, Math.PI * 2, 0, Math.PI * 0.62), bowlMat);
    scoop.name = 'soup_ladle_scoop';
    scoop.position.set(0, -handRadius * 1.55, 0);
    scoop.rotation.x = Math.PI;
    scoop.castShadow = true;
    ladle.add(scoop);

    // Noodles draped over the scoop rim — matte, per the brief's roughness callout.
    const noodleMat = toonMat({ color: NOODLE, roughness: 0.6 });
    const noodleDarkMat = toonMat({ color: NOODLE_DARK, roughness: 0.6 });
    for (let i = 0; i < 4; i++) {
      const noodle = new THREE.Mesh(new THREE.CapsuleGeometry(handRadius * 0.05, handRadius * 0.7, 3, 6), i % 2 === 0 ? noodleMat : noodleDarkMat);
      noodle.name = 'soup_noodle';
      const a = -0.5 + i * 0.33;
      noodle.position.set(Math.sin(a) * handRadius * 0.3, -handRadius * 1.28, Math.cos(a) * handRadius * 0.2);
      noodle.rotation.set(Math.PI / 2 + Math.sin(a) * 0.4, 0, a * 0.6);
      noodle.castShadow = true;
      ladle.add(noodle);
    }
  }

  /**
   * ── THE POT STAND — the mass Uri's *"limbs disattached"* was missing ─────────
   *
   * WAS `dressTorsoAsSoup()`: a rust cylinder sash of radius `torsoHalfWidthMid *
   * 1.16` with two flat caps, described as "a simple vendor apron". Rendered at the
   * lobby camera it is a **tyre**, and worse than decorative — it is 0.55 m in
   * radius with a flat underside, overhanging the 0.35 m the torso has left at the
   * hip line, so it visually amputates the lower body. Read
   * `shots/ch/soup/before/crop_legs.png`: below the sash there is *background*, and
   * two free-standing leg columns beside it.
   *
   * The real defect underneath was arithmetic and it is the same one at both joints:
   *
   *   shoulder line   torso half-width 0.340 m   arm inner wall 0.533 m   gap 0.19 m
   *   hip line        torso half-width 0.000 m   thigh inner wall 0.423 m (the rig's
   *                   tapered sphere ENDS at the hip line, and it ends as a POLE)
   *
   * `rig.ts:pelvisScale` already records that the pelvis mass is not the fix — it is
   * 0.33% of the lobby silhouette and moved **zero** of 22 leg-attachment
   * measurements. It cannot be: it spans the hip TOPS, and the hole is between the
   * hips and the body ABOVE them.
   *
   * So this replaces the sash with a body: a lathed stoneware pot stand running from
   * below the hip line to the neck, whose radius is solved AT each joint's own
   * height to swallow the inner wall of the limb that starts there. It is not a
   * costume choice — it is the geometry that makes the arms and legs attached at
   * every camera angle, which is the standard `CLAUDE.md` sets for this defect class
   * ("fix the GEOMETRY, not the appearance at one pitch"). It also happens to be the
   * most on-brief shape available: a heavy vessel sitting on a heavy stand.
   *
   * The near-black band that carried part of the dark rung moves onto the stand's
   * lower flare, so no dark AREA is lost — `RIM_TRIM`'s note above is explicit that
   * a dark rung has to carry area, not just value.
   */
  private buildPotStand(): void {
    // Read off the rig, never hand-mirrored: body proportions come from an
    // archetype (`bodies.ts`) now, so a hardcoded copy of a rig constant goes
    // silently wrong the moment the archetype changes.
    const m = this.rig.metrics;
    const torsoH = m.torsoHeight;

    // Each radius is SOLVED from the joint it has to swallow, never picked.
    //  * `rShoulder`: the upper arm's tube is `armRadius * 0.72` at its top (see
    //    `dressLimbs`), so reaching `shoulderWidth - armRadius * 0.45` puts the
    //    stand's wall 0.27 of a tube-radius inside the arm. Overlap, not tangency.
    //  * `rHip`: the thigh's top radius is `legRadius`, so `stanceWidth * 0.98`
    //    buries the thigh's inner half completely.
    const rShoulder = m.shoulderWidth - m.armRadius * 0.45;
    const rHip = m.stanceWidth * 0.98;
    const rBelly = Math.max(rShoulder, rHip) * 1.06;
    // ── 🚨 THIS WAS `m.neckRadius * 1.30`, AND `m.neckRadius` IS NOW ZERO ───────
    // `proportions` above drops the rig's neck column (`withoutNeck()`), and
    // `rig.ts` computes `neckRadius = neckGap > 0 ? neckHalf * neckRatio : 0`. So the
    // old expression would have fallen through to its own `torsoWidth * 0.16` floor
    // and narrowed this stand's throat **0.2222 -> 0.1302 m, -41%**, for a reason
    // that has nothing to do with a neck column — and `standRadiusAt` is what every
    // accessory on this character is placed against, so it would have moved them too.
    // A silent geometry change riding along on a value fix is exactly the class this
    // file's `GLAZE_GREY` note is about.
    //
    // Restated in terms that do not depend on a column existing, and it is the SAME
    // number: `neckRadius = min(torsoWidth/2, headRadius) * neckRatio`, `neckRatio`
    // defaults to 0.42 (`rig.ts:753`), so `* 1.30` is `* 0.546` of that same min.
    // On the shipped proportions the torso half-width binds (0.4069 against R
    // 0.5476), giving 0.22215375 m.
    // ⚠️ NOT bit-identical, and saying so because a rounded claim is how a real drift
    // hides later: `0.42 * 1.30` and the literal `0.546` differ by one ULP, so the
    // product differs by **2.78e-17 m**. Twenty-six orders of magnitude below a pixel;
    // the empirical check is that soup's match-camera frame is **0 changed px** across
    // this whole pass and the lobby diff is confined to a 205 x 59 band at the collar
    // (`shots/nm/neck_before` vs `shots/nm/neck_after`), i.e. the stand did not move.
    const rNeck = Math.max(Math.min(m.torsoWidth * 0.5, m.headRadius) * 0.546, m.torsoWidth * 0.16);
    // How far the stand's skirt drops BELOW the hip line. Capped at a third of the
    // thigh, or the leg disappears into the body and the character loses its legs
    // the way `egg.ts` lost its ovoid — the trade `docs/DECISIONS-FOR-URI.md` §40
    // names as "the detail added to signal the subject destroyed the silhouette".
    const yBase = -m.thighLength * 0.34;

    const prof: Array<[r: number, y: number]> = [
      [0.00, yBase - m.legRadius * 0.20],
      [rHip * 0.42, yBase - m.legRadius * 0.14],
      [rHip * 0.78, yBase],
      [rHip * 0.95, yBase * 0.45],
      [rHip, 0],
      [rBelly * 0.985, torsoH * 0.22],
      [rBelly, torsoH * 0.46],
      [rShoulder * 1.03, torsoH * 0.68],
      [rShoulder, m.shoulderY],
      [rShoulder * 0.80, torsoH * 0.88],
      [rNeck * 1.25, torsoH * 0.97],
      [rNeck, torsoH * 1.02],
      [0.00, torsoH * 1.05],
    ];
    /** Linear interpolation over the stand's own profile — the one place anything
     *  is allowed to ask "how wide is the body at height y", so an accessory can
     *  never be placed against a remembered number. Same principle as
     *  `bowlSurface` above and `localBounds` in `appendages.ts`. */
    this.standRadiusAt = (y: number): number => {
      if (y <= prof[0][1]) return prof[0][0];
      for (let i = 0; i < prof.length - 1; i++) {
        const [r0, y0] = prof[i], [r1, y1] = prof[i + 1];
        if (y >= y0 && y <= y1) return y1 > y0 ? r0 + (r1 - r0) * ((y - y0) / (y1 - y0)) : r1;
      }
      return prof[prof.length - 1][0];
    };

    // Lathe points run bottom -> top: `docs/LESSONS.md` §12 — reversed, the normals
    // invert and the whole mass renders near-black. It bit six characters at once.
    const stand = new THREE.Mesh(
      new THREE.LatheGeometry(prof.map(([r, y]) => new THREE.Vector2(r, y)), 32),
      toonMat({ color: GLAZE_GREY, roughness: 0.55 })
    );
    stand.name = 'soup_pot_stand';
    // The rig's own torso is an ellipse in plan (`torsoDepth = torsoWidth * 0.88`),
    // and a circular body would be 14% deeper than the cast's convention at the
    // match camera's profile facing, where depth is the dimension that reaches the
    // screen. Matched rather than left circular.
    stand.scale.z = m.torsoDepth / m.torsoWidth;
    stand.castShadow = true;
    stand.receiveShadow = true;
    this.rig.joints.torso.add(stand);

    // ── The iron band ─────────────────────────────────────────────────────────
    // The dark rung, relocated from the sash. It sits on the hip flare, which is
    // where the stand is WIDEST in plan and therefore where a band buys the most
    // pixels per unit of height — and it reads as the hoop on a stoneware crock.
    //
    // ⚠️ SIZED BY MEASUREMENT AFTER THE FIRST VERSION LOST THE DARK RUNG. At
    // `legRadius * 0.70` tall this replaced a sash that was `torsoHeight * 0.24`
    // tall at a 12% larger radius PLUS a flat bottom cap disc that the lobby
    // camera sees almost face-on. Measured on `valuescan --mode chars`, soup's
    // **p05 went 0.10 -> 0.18** and its range 0.847 -> 0.677 — the near-white end
    // was fixed and the dark end went with it, which is the same trade recorded in
    // the opposite direction at the top of this file. `RIM_TRIM`'s own note says
    // it plainly: **a dark rung has to carry AREA.** So the band is now 2.6x
    // taller and it is the crock's cast-iron FOOT rather than a hoop.
    const bandA = -m.legRadius * 0.34, bandB = m.legRadius * 1.48;
    const band = new THREE.Mesh(
      new THREE.CylinderGeometry(this.standRadiusAt(bandB) * 1.022, this.standRadiusAt(bandA) * 1.022, bandB - bandA, 32, 1, true),
      toonMat({ color: RIM_TRIM, roughness: 0.42 })
    );
    band.name = 'soup_stand_band';
    band.position.y = (bandA + bandB) * 0.5;
    band.scale.z = stand.scale.z;
    band.castShadow = true;
    band.receiveShadow = true;
    this.rig.joints.torso.add(band);
  }

  /**
   * Costume layer over the pot stand: a cook's apron panel that follows the stand's
   * own lathe profile, and the diagonal shoulder strap that carries the spare ladle.
   *
   * ── TWO THINGS BUILT HERE WERE REMOVED, BOTH FOR MEASURED REASONS ───────────
   *
   * 1. THE CHEVRON BIB. An extruded `Shape` with a point at the top, sitting on a
   *    flat plane at `z = shoulderWidth * 0.60`. Rendered at the lobby camera it is
   *    a white ARROW on the chest — a flat plate standing off a curved body, at
   *    `#E2DCCF` (luma 0.863), which made it the second-brightest large area on a
   *    character already measured as the cast's worst near-white offender. Cloth on
   *    a vessel has to follow the vessel; this is now a partial LATHE of the stand's
   *    own profile, so it wraps.
   *
   * 2. THE GLAZE HIGHLIGHT — a `#FFFCF5` tube at `roughness 0.06` climbing the
   *    bowl. It was authored as "the photographed ceramic specular pop", and a
   *    painted-on specular does not behave like one: it does not move with the
   *    light, it renders at a FIXED near-white regardless of facing, and at the
   *    lobby camera it reads as a scratch or a seam down the bowl, not as gloss.
   *    It also broke the one rule `rules.ts` sets for this character's face — the
   *    sclera has to be the brightest value on the model, and a `#FFFCF5` stripe on
   *    a large surface outranks any eye. Deleted rather than dimmed: the bowl's
   *    `glossyMat` at `roughness 0.25` already produces a real specular that tracks
   *    the key light, which is what the material note was actually asking for.
   */
  private buildAccessories(): void {
    const m = this.rig.metrics;
    const shoulderWidth = m.shoulderWidth;
    const torsoH = m.torsoHeight;

    // ── The apron ─────────────────────────────────────────────────────────────
    // A partial lathe over the front arc of the pot stand at 1.035 of its own
    // radius, so it is a garment ON the body rather than a plate NEXT TO it.
    // `LatheGeometry`'s phi starts at +Z (`vertex.x = r*sin(phi)`, `z = r*cos(phi)`),
    // which is `types.ts` convention 2's facing direction, so a symmetric span about
    // 0 is a front panel with no further maths.
    // The apron starts ABOVE the stand's iron band rather than over it — the band is
    // this character's dark rung and the apron is the second-lightest large area on
    // it, so overlapping them spends the rung to no purpose.
    const apronTop = torsoH * 0.76, apronBot = m.legRadius * 1.40;
    const apronPts: THREE.Vector2[] = [];
    for (let i = 0; i <= 10; i++) {
      const y = apronBot + (apronTop - apronBot) * (i / 10);
      apronPts.push(new THREE.Vector2(this.standRadiusAt(y) * 1.035, y));
    }
    const apron = new THREE.Mesh(
      new THREE.LatheGeometry(apronPts, 20, -Math.PI * 0.36, Math.PI * 0.72),
      toonMat({ color: BIB, roughness: 0.68, doubleSide: true })
    );
    apron.name = 'soup_apron__no_outline';
    // A thin open shell has no interior, so an inverted-hull outline on it renders
    // as a dark slab rather than an edge — `egg.ts:hood` records the same trade.
    apron.userData.noOutline = true;
    apron.scale.z = m.torsoDepth / m.torsoWidth;
    apron.castShadow = true;
    apron.receiveShadow = true;
    this.rig.joints.torso.add(apron);

    // The waist tie: one dark horizontal line across the apron, which is what makes
    // it read as tied on rather than painted. Sits at the apron's own top edge.
    const tieY = apronTop * 0.96;
    const tie = new THREE.Mesh(
      new THREE.TorusGeometry(this.standRadiusAt(tieY) * 1.045, m.legRadius * 0.085, 8, 26, Math.PI * 0.84),
      toonMat({ color: SLING_DARK, roughness: 0.6 })
    );
    tie.name = 'soup_apron_tie';
    tie.rotation.set(Math.PI * 0.5, 0, Math.PI * 0.5 - Math.PI * 0.42);
    tie.position.y = tieY;
    tie.scale.y = m.torsoDepth / m.torsoWidth;
    tie.castShadow = true;
    this.rig.joints.torso.add(tie);

    // ── Back-sling ladle ──────────────────────────────────────────────────────
    // Placement is now solved against `standRadiusAt` rather than against
    // `shoulderWidth` fractions. Under the old numbers the strap's low end sat at
    // radius 0.364 while the body it was supposed to lie on was 0.495 wide there —
    // i.e. the strap ran INSIDE the torso and only its high end was ever visible,
    // and the mini ladle it carries surfaced beside the hip looking like a floating
    // trinket. `docs/LESSONS.md` §1 in the cheapest possible form: a hand-computed
    // offset against a mass that moved.
    const slingMat = toonMat({ color: SLING, roughness: 0.76 });
    const onStand = (angle: number, y: number, out: number): THREE.Vector3 => {
      const r = this.standRadiusAt(y) * out;
      return new THREE.Vector3(Math.sin(angle) * r, y, Math.cos(angle) * r * (m.torsoDepth / m.torsoWidth));
    };
    // Both anchors pushed onto the BACK hemisphere (0.86PI / 1.24PI, where 0 is the
    // facing direction). At 0.72PI the ladle's handle rose past the shoulder and
    // crossed the bowl's cheek in the lobby render — a stray stick over the face,
    // which is the one place on this character nothing is allowed to be.
    const shoulderPt = onStand(Math.PI * 0.86, torsoH * 0.90, 1.05);
    const hipPt = onStand(Math.PI * 1.24, torsoH * 0.26, 1.05);
    const sling = strapArc(shoulderPt, hipPt, new THREE.Vector3(0, 0, -shoulderWidth * 0.10), m.legRadius * 0.30, slingMat);
    sling.name = 'soup_ladle_sling';
    this.rig.joints.torso.add(sling);

    const dir = shoulderPt.clone().sub(hipPt).normalize();
    const miniLadle = new THREE.Group();
    miniLadle.name = 'soup_sling_ladle';
    // Seated at the SHOULDER end, not the hip end. The handle then rises past the
    // shoulder line — a genuine silhouette event on the body — instead of the scoop
    // poking out beside a knee, which is where the old hip-end seat put it.
    miniLadle.position.copy(shoulderPt).addScaledVector(dir, -shoulderWidth * 0.06);
    miniLadle.quaternion.setFromUnitVectors(new THREE.Vector3(0, 1, 0), dir);
    this.rig.joints.torso.add(miniLadle);

    const handleMat = toonMat({ color: WOOD, roughness: 0.6 });
    const handle = new THREE.Mesh(new THREE.CapsuleGeometry(shoulderWidth * 0.026, shoulderWidth * 0.52, 4, 8), handleMat);
    handle.name = 'soup_sling_ladle_handle';
    handle.position.y = shoulderWidth * 0.28;
    handle.castShadow = true;
    miniLadle.add(handle);

    const scoopMat = glossyMat({ rim: true, color: '#9AA3AC', roughness: 0.34, metalness: 0.4 });
    const scoop = new THREE.Mesh(new THREE.SphereGeometry(shoulderWidth * 0.13, 14, 10, 0, Math.PI * 2, 0, Math.PI * 0.62), scoopMat);
    scoop.name = 'soup_sling_ladle_scoop';
    scoop.rotation.x = Math.PI;
    scoop.position.y = -shoulderWidth * 0.04;
    scoop.castShadow = true;
    miniLadle.add(scoop);
  }

  /**
   * SILHOUETTE EVENTS — two crock ears and a standing ladle.
   *
   * Soup measured **hull deficiency 0.1003 and ZERO appendages** at the shipped
   * facing, the second-worst outline in the cast against a six-plate Brawl Stars
   * floor of 0.2007 and a median appendage count of 2.5. Look at
   * `shots/limbmatch/before/chars/soup.yaw90.png` and the reason is not subtle: at
   * 58 deg the camera is looking INTO the bowl, so the character is a filled circle
   * of broth with a leg stub under it and nothing else.
   *
   * It already carried a ladle in the hand, a spare ladle on a back-sling and a
   * napkin bib, all of which are described in this file as silhouette-breaking, and
   * the measured appendage count was still zero — because every one of them sits on
   * the TORSO, and the torso is underneath a 0.61 m bowl that this camera projects
   * straight down over. That is the whole lesson of `appendages.ts`: the event has
   * to leave the mass HORIZONTALLY, from the mass's own widest point.
   *
   * So: two handles on the bowl (a crock has handles; this one now looks like a
   * crock rather than a mixing bowl), and the ladle that was buried on the back is
   * stood up IN the broth with its handle out over the rim. All three are placed
   * against `localBounds(head)` — the bowl as it was actually built by the lathe —
   * rather than against a remembered radius.
   *
   * ── 🚨 AND THE THING ABOVE CALLED "EARS" WAS BUILT AS EARS AND READ AS EARS ──
   * `docs/DECISIONS-FOR-URI.md` §40/§41: **a pointed or looped mass either side of
   * a head reads as an ear or a horn, and it overrides what the shape is made of.**
   * Five for five across the cast — burrito's torn foil (*"looks a bit like a
   * goat"*), egg's shell shards (*"the ears don't make sense"*), hamburger's
   * lettuce, lollipop's cellophane petals (*horns*), pizza's cheese strands.
   *
   * Soup's were the literal case: two `loop()` torus arcs of radius `0.46 * rBowl`,
   * mounted at `height01: 0.90` — the TOP of the mass — at azimuth exactly ±PI/2,
   * and then tilted UP by `+0.45` on Y specifically to get them clear of the rim.
   * A large curved mass either side of a head, at the top, angled up and out, is a
   * rabbit. `shots/ch/soup/before/lobby_yaw35.png` is unambiguous about it.
   *
   * The fix is RE-SHAPE, which is the option §40 lists alongside re-placing. Ears
   * are TALL AND NARROW; a casserole lug is WIDE AND FLAT. So these are now flat
   * horizontal tabs — 1.9x wider than they are thick, sitting level at the bowl's
   * shoulder rather than climbing off its rim — which is also what a real soup crock
   * has. The azimuth is deliberately KEPT at ±PI/2: that is where a vessel's handles
   * belong, and the ear read was never about the azimuth, it was about a tall looped
   * silhouette. A flat tab cannot make that read at any position.
   *
   * ⚠️ What this costs, stated rather than discovered later: the handles were
   * already contributing **0.0000 to hull deficiency at four decimal places** — the
   * measurement recorded below — so there is nothing to lose there. But `appendages.ts`
   * is explicit that ±PI/2 is the OCCLUDED pair at the shipped spawn facing, so
   * these still register zero appendages at the match camera. The standing ladle and
   * the spoon carry that number alone, as they already did.
   */
  private buildSilhouetteEvents(): void {
    const head = this.rig.joints.head;
    const box = localBounds(head);
    const size = box.getSize(new THREE.Vector3());
    const rBowl = Math.max(size.x, size.z) * 0.5;

    // ── Crock LUGS — flat casserole tabs, not looped ears ─────────────────────
    // Glazed in the bowl's own ceramic so they read as part of the vessel rather
    // than as bolted-on props.
    //
    // WAS: `loop(earMat, { radius: rBowl * 0.46, tube: rBowl * 0.12, arc: 1.15PI })`
    // at `height01: 0.90`, aimed `out + (0, 0.45, 0)`. Two recorded rounds of tuning
    // are kept here because the reasoning behind them is sound and the OBJECTIVE was
    // wrong — they were optimised for hull deficiency and nobody looked at the shape:
    //
    //   ROUND 2: `height01` 0.66 -> 0.94 and half again the size. At 0.66 the ears
    //   sat on the bowl's waist, and at the shipped facing the bowl's own rim
    //   projects DOWN over everything below it — measured, soup came back with one
    //   appendage and both ears contributed none of it.
    //
    //   ROUND 5, and the instrument caught this one rather than the eye: changing
    //   the ear radius by a quarter (0.34 -> 0.42 of the bowl) moved soup's hull
    //   deficiency by **0.0000 at both facings, to four decimals**. Something that
    //   does not move when everything around it does is not contributing at all
    //   (`docs/LESSONS.md` §5) ... Tilting them up off the rim is what makes them
    //   shape rather than decoration.
    //
    // Both notes are about a quantity that was already dead (0.0000), and the tilt
    // ROUND 5 prescribed is precisely what turned them into ears. See this method's
    // docblock. A lug is authored on the two axes an ear is not: WIDE tangentially
    // (0.46 rBowl), FLAT vertically (0.155 rBowl — a 3.0 : 1 ratio), and LEVEL.
    //
    // `aim()` sets +Y along the outward direction and derives +X as `worldUp x out`,
    // so with a level `out` the local axes are exactly (tangential-horizontal,
    // outward, vertical) — the box below is authored in that frame directly.
    // ── 🚨 AND AT `height01: 0.80` THEY WERE STILL EARS. THE MISSING RULE IS ────
    // ── HEIGHT, NOT SHAPE. ──────────────────────────────────────────────────────
    // The re-shape above is right and it was not sufficient: `shots/ca/before/soup.png`
    // at the lobby camera still shows two pale masses flanking the head ABOVE the
    // eyes, which is where ears live. The rule the previous rounds were missing is
    // simple and it is geometric rather than stylistic:
    //
    //   **An ear is above the eye line. A handle at or below the eye line is not an
    //   ear at any shape, size or colour, because no animal has one there.**
    //
    // `height01` is a fraction of the HEAD'S BOUNDING BOX, and this head's box is not
    // the bowl — the standing ladle and the steam reach well above it — so 0.80 of the
    // box was some distance up the rim. The anchor is therefore stated in head-local
    // Y (the coordinate `BOWL_PROFILE`, the eyes and every decal already use) and
    // converted here, exactly as `burrito.ts` does for its spill: a constant that
    // means a different height depending on what else exists is not a constant.
    //
    // The target is the eyes' own height: `bowlBottomY + EYE_H * bowlH`
    // = `-R + 0.63 * 1.35R` = **-0.150R**. That is also inside the profile's
    // `h 0.55..0.76` plateau where the bowl holds its FULL radius, i.e. the crock's
    // widest point — which is where a real casserole's lugs are anyway. So the fix
    // for the ear read and the fix for "these look like nubs, not handles" are the
    // same move: at the belly they sit on the silhouette instead of on the rim.
    const at01 = (y: number) => THREE.MathUtils.clamp(
      (y - box.min.y) / Math.max(1e-6, box.max.y - box.min.y), 0, 1,
    );
    // ── ⚠️ AND "EYE HEIGHT" IS NOT `EYE_H` AT A PITCHED CAMERA ─────────────────
    // The first version of this fix put the lugs at exactly the eyes' own world Y
    // (-0.150R) and `shots/ca/after1/soup.png` still shows them ABOVE the eye line.
    // The reason is the theorem `fb9d9da` proved on hamburger's bun and `rig.ts`
    // proves for the collar: a camera pitched `p` maps a point to `y·cos p - z·sin p`,
    // so **depth buys downward screen travel**. The eyes sit on the bowl's FRONT at
    // z ~ +1.08R; the lugs sit at z = 0, on the axis. At the lobby's 20 degrees the
    // eyes therefore fall `1.08R · tan 20` = **0.39R further down the screen** than
    // anything at the same world height on the axis.
    //
    // Equal world height is not equal screen height. -0.46R puts the lug's screen
    // centre just BELOW the eye centre, measured off the after-1 capture at
    // 511 px/m, and `BOWL_PROFILE` still has r = 0.95 there — the belly, where a
    // casserole's lugs actually are — rather than the rim.
    const lugY = at01(-this.rig.headRadius * 0.46);
    const lugMat = toonMat({ color: CERAMIC, roughness: 0.34 });
    for (const side of [-1, 1] as const) {
      const { at, out } = massAnchor(head, box, { azimuth: side * Math.PI * 0.5, height01: lugY, inset: 0.16 });
      const g = new THREE.Group();
      g.name = 'soup_crock_lug';
      // Level, and the horizontal component kept — no vertical term at all. That
      // single change is what stops it being an ear.
      aim(g, at, new THREE.Vector3(out.x, 0, out.z).normalize());
      // 0.46 x 0.30 x 0.155 -> 0.52 x 0.34 x 0.165, still a 3.2 : 1 width-to-
      // thickness ratio. The first pass read correctly (no ear) and read SMALL —
      // at the lobby camera the tabs were two nubs rather than handles, which
      // loses the "crock, not mixing bowl" cue the shape is here for.
      // 0.52 x 0.34 -> 0.58 x 0.40 of the bowl. Dropping the lugs to the belly moved
      // them onto the silhouette but also onto the widest part of the mass, where a
      // small tab is easier to lose; the after-2 capture reads them as nubs again.
      // The width-to-thickness ratio (3.5 : 1) is untouched, which is the property
      // that makes them lugs and not ears.
      const reach = rBowl * 0.40;
      const lug = new THREE.Mesh(
        roundedBox(rBowl * 0.58, reach, rBowl * 0.165, rBowl * 0.078, 3),
        lugMat
      );
      lug.name = 'soup_crock_lug_tab';
      lug.position.y = reach * 0.42;
      lug.castShadow = true;
      lug.receiveShadow = true;
      g.add(lug);
      head.add(g);
    }

    // ── The standing ladle ────────────────────────────────────────────────────
    // Out of the broth at the back quarter, leaning away from the face so it never
    // competes with it. The handle is the event; the scoop only says what it is.
    const ladle = new THREE.Group();
    ladle.name = 'soup_standing_ladle';
    // ROUND 2: moved to dead astern (azimuth ~PI, i.e. the character's own back) and
    // lengthened. At the shipped facing that is the axis that projects to screen-X,
    // where the bowl cannot cover it at any height; at -0.72PI it was still half on
    // the occluded axis.
    const { at, out } = massAnchor(head, box, { azimuth: Math.PI * 0.94, height01: 0.86, inset: 0.30 });
    // ROUND 4: laid down to ~15 deg off horizontal. Standing it up cost 0.78 m of
    // TOTAL MODEL HEIGHT (2.26 -> 3.04 m against a cast band of 2.10-2.41), and it
    // was never the efficient direction anyway: at 58 deg pitch a vertical metre is
    // worth 0.53 of a screen-metre and a horizontal one 0.85-1.00.
    const dir = out.clone().multiplyScalar(1.00).add(new THREE.Vector3(0, 0.28, 0)).normalize();
    aim(ladle, at, dir);
    head.add(ladle);
    ladle.add(rod(toonMat({ color: WOOD, roughness: 0.6 }), {
      len: rBowl * 0.95, rBase: rBowl * 0.095, rTip: rBowl * 0.065,
    }));
    const cap = knob(toonMat({ color: RIM_TRIM, roughness: 0.45 }), rBowl * 0.105);
    cap.position.y = rBowl * 0.95;
    ladle.add(cap);

    // ── The spoon ─────────────────────────────────────────────────────────────
    // A second utensil, laid across the rim on the character's own left, and it is
    // here because the EARS are not doing the job the ears were built for. The
    // instrument said so before the eye did: changing their radius by a quarter
    // moved this character's hull deficiency by 0.0000 at both facings, so they are
    // decoration, not shape. Rather than tune a shape that has already proved it
    // cannot escape the bowl's own projection, this reuses the mechanism that
    // demonstrably works on this character — a thin rod leaving the rim, exactly
    // like the ladle, on the axis the ladle does not cover.
    const spoon = new THREE.Group();
    spoon.name = 'soup_spoon';
    // Aimed UP-and-out rather than out-and-up, and that is the whole difference on
    // this character. The ears sit on the bowl's wall and reach sideways, and both a
    // 25% size rise and a whole extra utensil moved hull deficiency by <= 0.0001 at
    // either facing: the bowl's RIM is its widest point AND its highest, so at 58 deg
    // it projects down over its own wall and swallows anything mounted there. Only
    // something that climbs past the rim escapes — which is exactly why the ladle,
    // the one element aimed steeply upward, is carrying this character on its own.
    const sp = massAnchor(head, box, { azimuth: Math.PI * 0.44, height01: 0.97, inset: 0.22 });
    aim(spoon, sp.at, sp.out.clone().multiplyScalar(0.55).add(new THREE.Vector3(0, 1.0, 0)).normalize());
    head.add(spoon);
    spoon.add(rod(toonMat({ color: WOOD, roughness: 0.6 }), {
      len: rBowl * 0.86, rBase: rBowl * 0.075, rTip: rBowl * 0.058,
    }));
    const bowlEnd = new THREE.Mesh(new THREE.SphereGeometry(rBowl * 0.13, 12, 10),
      glossyMat({ rim: true, color: '#C7CDD4', roughness: 0.3, metalness: 0.4 }));
    bowlEnd.name = 'soup_spoon_bowl';
    bowlEnd.scale.set(1, 0.42, 1.25);
    bowlEnd.position.y = rBowl * 0.86;
    bowlEnd.castShadow = true;
    bowlEnd.receiveShadow = true;
    spoon.add(bowlEnd);
  }

  protected onUpdate(ctx: AnimContext): void {
    this.rig.animate({
      elapsed: this.elapsed,
      move01: ctx.moveSpeed01,
      attack01: this.attackT >= 0 ? this.attackT / this.attackDuration : -1,
      hit01: this.hitT >= 0 ? this.hitT / 0.26 : -1,
      dead01: this.deathT >= 0 ? this.deathT / 0.75 : -1,
    });

    // Steam drifts and slowly billows — each wisp rises, fades and resets on its own
    // offset cycle so the three never sync into one pulsing blob.
    for (let i = 0; i < this.steamWisps.length; i++) {
      const wisp = this.steamWisps[i];
      const cycle = 2.6;
      const t = ((this.elapsed + i * 0.9) % cycle) / cycle;
      wisp.position.y = wisp.userData.baseY ?? (wisp.userData.baseY = wisp.position.y);
      wisp.position.y = (wisp.userData.baseY as number) + t * this.rig.headRadius * 0.34;
      wisp.rotation.y = this.elapsed * 0.6 + i;
      wisp.scale.setScalar(0.7 + t * 0.35);
      const mat = this.steamMats[i];
      if (mat) mat.opacity = 0.34 * (1 - t) * (t < 0.15 ? t / 0.15 : 1);
    }

    // Broth gently shimmers via a faint bob — cheap "hot liquid" life.
    // ── 🚨 WAS `this.brothSurface.position.y += sin(...) * 0.0005`, AND THAT `+=` IS
    // THE WHOLE "THERE IS NOTHING IN THE LIQUID" BUG ─────────────────────────────
    // `+=` on an absolute position with a `sin` term is an ACCUMULATOR, not an
    // oscillator: it integrates the wave instead of tracing it, so the disc walks off
    // its authored height and stays there. Measured at the frozen preview time
    // t = 1.5: the disc sat at local y **0.134722** against an authored **0.117863**
    // (its own outline, which copies the transform once at construction, is still
    // sitting on that number) — a drift of **+0.0169 m**, against a 0.0011 m
    // clearance to the depth ring and 0.0055 m to the garnish. Both were eaten.
    // `dt` is not in the expression either, so the drift was frame-rate dependent.
    // The old wording is kept above per CLAUDE.md's rule on reversed assertions: the
    // INTENT ("a faint bob") was always right and only the operator was wrong.
    // The whole `brothTop` group moves, so the liquid and its solids stay coplanar.
    this.brothTop.position.y = this.brothBaseY + Math.sin(this.elapsed * 3.2) * this.rig.headRadius * 0.004;
  }

  /**
   * Structural limb rebuild, round 4. Three independent art-director passes named
   * the same root cause: every character shares the identical tapered-tube-and-
   * ball-joint limb TOPOLOGY, and recolouring that shared skeleton doesn't fix it.
   * Soup's brief: a wide heavy bowl doesn't need long tube arms and legs.
   *
   * Arms are now a pair of BOWED ceramic handles (`buildHandleArc`, a curved tube,
   * not a straight taper) running shoulder→elbow→hand as one continuous loop of
   * the bowl's own glossy ceramic material — reading as the bowl's own handles,
   * not as arms bolted onto a generic frame. There is no separate "ball hand": the
   * hand joint gets a small rounded cap of the same material, the loop's terminus.
   *
   * Legs are short, thick, near-uniform ceramic-stoneware posts — thigh and shin
   * share one material and almost the same radius, so the knee never reads as a
   * distinct jointed segment — ending in a low, wide dark foot pad directly under
   * the bowl, echoing a heavy vessel standing on stubby feet rather than walking
   * on legs.
   */
  private dressLimbs(): void {
    // ── THE THREE-TONE READ THIS FILE HAS DESCRIBED FOR ROUNDS, NOW BUILT ───────
    // WAS: `handleMat = CERAMIC` for both arms AND hands, `legMat = CERAMIC_SHADE`
    // (which was LIGHTER than CERAMIC). So the whole limb set was one cream, on a
    // cream bowl, on a cream torso — which is exactly the fusion `valuescan`
    // measured as `torso|shoulderL` **dLcontact 0.0423**, a boundary step of four
    // hundredths where the gate wants 0.10. A limb the same value as the thing it
    // grows out of reads as detached however well it is attached, which is the
    // finding that whole instrument exists for.
    //
    // `GLAZE_GREY`'s own note (above) records the intent — "grey sleeves, cream
    // mitts, dark boots" — and `rules.ts` now states it as spec. Each tone below is
    // one rung of the ladder at the top of this file.
    const sleeveMat = glossyMat({ rim: true, color: SLEEVE_GREY, roughness: 0.34 }); // upper arm — grey stoneware sleeve
    const cuffMat = glossyMat({ rim: true, color: CUFF_GREY, roughness: 0.38 });     // forearm — the darker rolled cuff
    const mittMat = toonMat({ color: MITT_CREAM, roughness: 0.62 });      // cream cloth mitt
    const legMat = toonMat({ color: LEG_STONE, roughness: 0.55 });        // dark stoneware post
    const trimMat = toonMat({ color: RIM_TRIM, roughness: 0.4 });
    const bootMat = toonMat({ color: BOOT_STONE, roughness: 0.7 });

    this.rig.dressLimbs((part: LimbPart, size) => {
      switch (part) {
        case 'upperArmL':
        case 'upperArmR': {
          const side = part === 'upperArmL' ? 1 : -1;
          // WAS: `radius * 0.60` constant, `bowOut 1.0`. A quadratic bezier whose
          // control point is a FULL segment-length out to the side is not a bowed
          // limb — it is a hook, and with the forearm hooking back the other way at
          // -0.85 the pair rendered as a tentacle. `lobby_yaw35.png` before.
          //
          // 1.0 -> 0.42, and the segment now tapers 0.72 -> 0.60 of `armRadius` so
          // it hands off to the forearm at exactly the forearm's own top radius.
          // "A moulded loop of roughly constant thickness" was the old intent and it
          // is what produced the visible step at the elbow: two constant-radius
          // tubes at different constants cannot meet.
          // 0.72/0.60 -> 0.62/0.52 of `armRadius`. The ARM/LEG separator this pass is
          // for needs a THICKNESS gap as well as a value one: at 0.72 the upper arm
          // was 0.83 of the thigh's top radius, which is not a difference a viewer
          // reads. At 0.62 it is 0.60, and soup keeps STOUT's planted read because
          // the LEGS carry it — they got thicker in the same edit.
          return buildHandleArc(size.len, size.radius * 0.62, size.radius * 0.52, side, 0.42, 0.10, sleeveMat);
        }
        case 'forearmL':
        case 'forearmR': {
          const side = part === 'forearmL' ? 1 : -1;
          // Bows the OTHER way relative to the upper arm, so the two segments
          // together read as one D-shaped handle looping back toward the body
          // rather than a straight tube bent once at a joint.
          // -0.85 / 0.12 -> -0.38 / 0.34. Measured: both forearms delivered 0.337 and
          // 0.383 with the food mass covering **0.005 and 0.004** of them — the bowl
          // was not the occluder, the character's own upper arm was, because the
          // forearm bowed back INSIDE the D the upper arm makes. Swapping most of the
          // inward bow for a forward one keeps the D reading while putting the segment
          // where this camera could see it. **Both variants measured WORSE and were
          // reverted**: -0.38/0.34 gave 0.322/0.386 and +0.34/0.34 gave 0.257/0.294,
          // against the original's 0.337/0.383. Recorded because the reasoning was
          // sound and the result was not — whatever is covering these forearms is not
          // answered by the bow, and the next attempt should isolate the occluder with
          // an ID-buffer pass (`tools/tmp/islands.mjs`) before moving geometry again.
          //
          // ── AND THAT WHOLE PARAGRAPH IS ABOUT THE WRONG QUANTITY ──────────────
          // Every number in it is `delivered` at the MATCH camera. Uri's complaint
          // is *"limbs disattached or intersecting with the body that causes weird
          // shapes"*, at the LOBBY camera, and it is about SHAPE, not coverage. The
          // bow is now -0.28 rather than -0.85: enough to keep the D-shaped handle
          // read the design asked for, not enough to hook the forearm back inside
          // the upper arm's own arc. Radii run 0.60 -> 0.46 of `armRadius`, starting
          // exactly where the upper arm ended, so there is no step at the elbow.
          // ⚠️ If `delivered` regresses at 58 degrees, the answer recorded above
          // still stands: isolate the occluder before moving the bow again.
          return buildHandleArc(size.len, size.radius * 0.52, size.radius * 0.42, side, -0.28, 0.22, cuffMat, false);
        }
        case 'handL':
        case 'handR': {
          // Sized against the FOREARM it terminates, not against `handRadius`.
          // `handRadius` is an independent rig constant, and at `0.062H` it made this
          // sphere `0.114H` across — **1.40x the forearm tube's diameter and 1.37x
          // the whole forearm's LENGTH**. Ablation put 25.9% of the right forearm's
          // entire footprint behind it (`tools/tmp/occluder.mjs`), which is the same
          // defect round 1 found on waterbottle: "the occluder was its own hand,
          // which is wider than the forearm was long."
          //
          // It is also redundant geometry — `buildHandleArc` already closes the
          // segment with a `radius * 0.9` knob — so matching the tube is what the
          // file's own description asked for all along: "a bowl handle terminates as
          // a rounded lip of the same moulded ceramic, not a separate hand shape
          // grafted on." `handRadius` itself is left alone because the ladle prop is
          // sized off it.
          // 1.30 x the forearm tube (sphere radius 1.20x it) is the measured
          // setting, not a guessed one. At the old `handRadius` sizing — 1.40x the
          // tube and 2.09x the forearm's whole LENGTH — the forearms delivered
          // 0.337 / 0.383. At 1.15x they delivered 0.515 / 0.560 but the hand itself
          // dropped to 0.379, because a knob that barely clears the tube is not a
          // shape. 1.30x, with the forearm's duplicate end knob removed, is the
          // point where BOTH clear the 0.50 gate and soup passes idle for the first
          // time. `handRadius` itself is untouched because the ladle prop is sized
          // off it.
          //
          // The SIZE is kept exactly (`armRadius * 0.92 * 0.52 * 1.30`, measured, and
          // the forearm's own tip radius is now 0.46 of `armRadius` which lands
          // within 3% of the old 0.92*0.52) — only the MATERIAL changes, from the
          // arm's cream to a cream CLOTH mitt against a grey sleeve. That is the one
          // value break the old "one continuous loop of the bowl's own material"
          // read could never have, and `rules.ts` names it: cream mitts.
          // 1.30 -> 1.55 of the forearm's tip, plus a thumb and a wrist cuff. See
          // `buildHandleCap`: this is the ARM/LEG separator, and the numbers that
          // capped the old sizing are still respected (1.55x the tip is 1.24x the
          // tube, under the 1.40x that measured as an occluder).
          const forearmR = this.rig.metrics.armRadius * 0.92 * 0.52;
          return buildHandleCap(forearmR * 1.55, mittMat, trimMat, part === 'handL' ? 1 : -1);
        }
        case 'thighL':
        case 'thighR':
          // 1.0/0.93 -> 1.04/0.94: thicker than the arm by construction (see the
          // upper-arm note), and STOUT is the archetype whose whole read is planted.
          return taperedLimb(size.len, size.radius * 1.04, size.radius * 0.94, legMat);
        case 'shinL':
        case 'shinR':
          // Same material, and the shin's TOP radius is now exactly the thigh's
          // BOTTOM radius (0.93). It was already written that way and it did not
          // hold, because `taperedLimb` silently replaced the thigh's `rBot` with
          // `len * 0.45` on any segment shorter than it is thick — see the fix in
          // that function. So "no taper break at the knee" was true of the numbers
          // passed in and false of the geometry that came out.
          // 🚨 0.93 -> 1.044, AND THE COMMENT ABOVE WAS WRONG ABOUT ITS OWN NUMBER.
          // "The shin's TOP radius is now exactly the thigh's BOTTOM radius (0.93)"
          // was true of the FACTOR and false of the RADIUS: `dressLimbs` hands the
          // thigh `legRadius` and the shin `legRadius * 0.9`, so `0.93` on each gave
          // 0.1445 m against 0.1301 m — a **10% step at the knee**, which is exactly
          // the two-stacked-cups defect `taperedLimb`'s own cap fix was written to
          // remove, surviving in the call site. 0.94 / 0.9 = 1.0444 makes them equal.
          return taperedLimb(size.len, size.radius * 1.0444, size.radius * 0.95, legMat);
        case 'footL':
        case 'footR':
          return buildWorkBoot(size.len, bootMat, trimMat, size.groundY);
        default:
          return null;
      }
    });
  }

  /** The rig owns all body motion; the base class's whole-body pass would fight it. */
  protected applyBaseMotion(): void {}
}
