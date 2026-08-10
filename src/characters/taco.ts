/**
 * Taco (Rare).
 *
 * Built on the shared ChibiRig — see `donut.ts` for the reference implementation of
 * this pattern. The rig supplies torso, arms, hands, legs, feet and all motion; this
 * file authors only the food mass on `rig.joints.head`, the face and a palette.
 *
 * Identity is fixed by `rules.ts`: Taco, Rare rarity, Filling Toss / Onion Bomb /
 * Double Toss.
 *
 * ── Where this file departs from the written description, and why ────────────
 * The 2D note reads "trapezoid shell, jagged crimped top edge, face floats
 * outside the shell to the side". All three were implemented literally and all
 * three were wrong on screen:
 *
 *   - the TRAPEZOID read as a paper bag; a taco's signature is a crescent, so
 *     the wall outline is now a U with two horns and a dipped mouth;
 *   - the JAGGED crimp read as a crown, because tall spikes are the loudest
 *     thing in any silhouette and became the shape people named. It is a small
 *     ripple now;
 *   - the FLOATING FACE read as a second head — a pale ball with eyes sitting
 *     beside a brown mass, so the eye picked the ball as the character and the
 *     shell as scenery. The face is now front and centre on the near wall.
 *
 * The brief explicitly allows treating these notes as personality guides rather
 * than literal specs. What is kept is the intent behind them: a hard, crisp,
 * fried shape with an open crimped mouth and a cheeky expression.
 *
 * ── 2026-08-06: Uri's rejects, and all three were the SHAPES, not the colours ─
 * *"No mouth, seems like a hat or something. Not sure about the items on the head,
 * looks like fruit, not taco add-ons."* (`docs/DECISIONS-FOR-URI.md` §39.)
 *
 *   - **"No mouth"** was a FUSION, not an absence: the grin's lowest point sat at
 *     head-local y -0.977R on a shell whose own bottom edge is -1.036R, directly
 *     above the near-black neck collar. Two dark masses that close read as one
 *     band, and a dark band under a wide gold crescent is a hat brim. The mouth is
 *     lifted 0.21R and given a bright tooth band, so it is neither low nor
 *     uniformly dark. See `buildFace`.
 *   - **"Looks like fruit"** was every filling being built as the wrong solid: a
 *     sphere is a berry, a capsule is a bean, a purple torus arc is a grape. The
 *     palette was already correct and is untouched; the solids are now crumbles,
 *     dice, ribbons and slivers.
 *   - and the **eyes**, which Uri ranked as the cast's second best blind, still had
 *     no white in them at all — a near-black bead with a glint. Three elements now,
 *     egg's construction, with the sclera as the brightest albedo on the character.
 *
 * The two lettuce sprigs were also a pair of pointed masses either side of the head
 * — the construction that has read as an animal five times in this cast. One moved
 * behind; both now droop. See `buildSilhouetteEvents`.
 */

import * as THREE from 'three';
import { BaseCharacter, type AnimContext } from './types';
import type { CharacterDef } from '../game/rules';
import { PALETTE } from '../game/rules';
import { toonMat, glossyMat, flatMat, outlineGroup, roundedBox } from '../render/toon';
import { ChibiRig } from './rig';
import { bodyType } from './bodies';
import { CHARACTER_HEIGHT } from '../units';
import { aim, blade as leafBlade, localBounds, massAnchor } from './appendages';

// ── Palette ──────────────────────────────────────────────────────────────────
// ── The value ladder ─────────────────────────────────────────────────────────
// Measured against 18 Brawl Stars plates (`tools/tmp/valuescan.mjs`): their p05 is
// 0.097 and every single one puts 5% of the character below 0.18. Taco's was 0.236 —
// a row of light-to-mid masses with no dark end at all, which is why a blind critic
// read "near-zero value separation between shell, apron and limbs". The fix is the
// reference's own grammar: the FOOD keeps its hue and gets a touch brighter, the
// COSTUME AND LIMBS carry a genuine near-black. Measured at pot_south, shipped
// framing: range 0.544 -> 0.730, p05 0.236 -> 0.140, steps@0.10 6 -> 7 — and
// figure/ground goes UP, 0.164 -> 0.175, because the darkening is paid for by the
// lift on the shell and the pale serape stripe.
const SHELL = '#F8BE62';       // toasted hard-shell gold — bright, saturated
const SHELL_DARK = '#D07F1E';  // shadow / crease tone
/**
 * ── TRIED AND REVERTED: a darker TORSO fold, `#E09A3A`. A gate killed it. ──────
 *
 * The reasoning was that half of Uri's *"seems like a hat"* is the head shell and
 * the torso fold being the SAME gold in the SAME crimped-fold language, so the eye
 * resolves the upper mass as something the lower one is WEARING. The evidence was
 * one number: `head|torso` **dLcontact 0.0304** at the near-frontal lobby facing.
 *
 * **One number was not enough, and the other number said the opposite.** Whole-part
 * `dL` for the same pair was **0.248** — head and torso were already well separated
 * across their areas; what dLcontact sees is a 52-px band under the chin that the
 * neck and collar largely cover anyway. Darkening the torso moved its median TOWARD
 * the head's and traded a boundary the player cannot see for an area contrast they
 * can:
 *
 *     shipped facing (yaw 90)     head|torso dL   dLcontact   weakBoundaryPct (max 15)
 *     SHELL      (#F8BE62)            0.248        0.015           **8.2  PASS**
 *     #E09A3A                         0.094        0.079           **19.1 FAIL**
 *
 * `weakBoundaryPct` is `--mode gate`'s verdict key and its cap is 15. 8.2 -> 19.1 is
 * a shipped-threshold regression bought with a metric the same tool tells you not to
 * steer the verdict on. Reverted; the torso is `SHELL` again.
 *
 * ⚠️ The general shape, for whoever reads `dLcontact` next: it is boundary-LOCAL and
 * it is the better number *for a boundary*, but a pair can be locally flat and
 * globally separated, and only the second one is what "these two masses read as one"
 * means. Check both before moving a large area's albedo.
 */
// The cheek pad's tone. Deliberately only a HAIR lighter than SHELL: at a
// bigger gap the pad stopped reading as a swelling in the wall and started
// reading as a separate pale ball sitting inside a container, which put the
// character's identity back on the wrong object again.
const POD = '#FBD79A';
const MEAT = PALETTE.patty;        // '#6B3E26'
/** Local, not `PALETTE.pattyDark`: this is Taco's dark rung and it is per-character. */
const MEAT_DARK = '#1C0E07';
const TOMATO = PALETTE.tomato;       // '#E63946'
const LETTUCE = '#8FCB1E';
const LETTUCE_DARK = '#6FA112';
const ONION = '#AD82D6';       // ties visually to the Onion Bomb projectile colour — kept saturated
                                // enough not to read as another tomato bit at a glance
// ── The MITT, and why it is a new tone rather than `POD` ─────────────────────
// The hands were `ONION` icosahedra and read as gems (see `dressLimbs`). Their
// replacement has one job the shell tones cannot do: end the ARM chain on a value
// the LEG chain never reaches, so a human can say which pair is which. `POD`
// (#FBD79A, luma 0.856) is the cheek pad's tone and is nearly the character's
// brightest non-sclera albedo — putting it on two moving masses at hip height would
// bid against the eyes, which `SCLERA` above is explicit must stay the top rung.
// #F0C070 is one step down (luma ~0.79) and 20 pp MORE saturated, which is the
// direction `CLAUDE.md` records as the scarce budget on this frame (warm chroma
// measured 0.053 against a 0.072 floor) rather than the falsified one.
const MITT_MASA = '#F0C070';   // soft masa mitts — the ARM chain's light terminal
// Limb-only rust family. A second independent art-director pass found Hamburger's
// bun-amber, Donut's dough-tan and Taco's own shell-gold all sitting in the same
// golden-orange hue band despite different heads — the "one templated body" read
// survived per-character geometry because every limb was still the same colour
// family. The HEAD keeps its golden shell (that's the "hard taco shell" read), but
// the limbs shift to a deeper, redder terracotta — extra-crispy fried-edge shell —
// which is a distinctly different hue from both castmates above.
// …and this is where the dark end lives. The two limb tones drop a long way: the
// upper limbs to a deep terracotta and the forearms/shins/boots to a near-black
// charred-shell edge, which is 6.5% of the character's pixels and is what carries the
// P05. Hue and the light-to-dark ORDER are both unchanged; only the value moved.

// ── PASS 2: the limb CHAIN has to alternate, not ramp ────────────────────────
// The first value pass took both limb tones down together. That fixed range/P05 and
// BROKE the part boundary — measured, `shoulderL|elbowL` 0.044, `kneeL|footL` 0.035,
// because a chain of four segments each a shade darker than the last is one mass. The
// reference's grammar is alternation: mid sleeve, dark cuff, light glove. So the upper
// segment comes back UP, the lower segment holds the dark, and the boot takes its own
// darkest tone instead of sharing the shin's.
const LIMB_SHELL = '#C25A28';      // upper arm / thigh — mid
const LIMB_SHELL_DARK = '#4A1608'; // forearm / shin — dark
// PASS 3: a near-black boot under a near-black shin is not two shapes — measured
// `kneeL|footL` 0.028 across 41 px. The boot goes the OTHER way instead: this
// character's foot was `SHELL_DARK` originally, and a mid toasted boot under a dark
// shin is the same alternation the arms use.
// ── 0.457 -> 0.337 luma, and the alternation it protects still holds ────────
// WAS '#B06A2E'. PASS 3's argument for a LIGHTER boot is intact and is why this is a
// darkening and not a near-black: *"a near-black boot under a near-black shin is not
// two shapes — measured `kneeL|footL` 0.028 across 41 px."* The shin is
// `LIMB_SHELL_DARK`, albedo luma 0.126; at 0.337 the boot still stands **0.211**
// above it, twice the 0.10 the boundary gate asks for, so the alternation survives.
// What changed is the budget: this pass deleted the near-black neck collar (it was
// half a hat) and thinned the dark forearms to separate arms from legs, and
// `valuescan` measured the cost as p05 0.16 -> 0.20 against a 0.180 cap. The boots
// are the largest remaining mass that can carry dark without touching either fix.
const BOOT_CHAR = '#8A4C1E';       // boots — still a step LIGHTER than the shin above them
/**
 * The serape's own light rung. The stripe used to be `#C1432B`, a red a few units off
 * `TOMATO` and only 0.09 of luma from the limbs it sits above — one more mid tone on a
 * character that had five. A woven serape's pale stripe is the natural place to put
 * the top of the ladder, and it pays for the darkening above in figure/ground.
 */
const SERAPE_PALE = '#F7EDD8';

// ── The FACE's own value ladder ──────────────────────────────────────────────
// Uri ranked seven characters blind and the ranking reproduced the construction
// ladder exactly: a flattened arc (hamburger) < a sphere with a specular (donut) <
// a sphere PLUS an explicit white glint (taco) < open eyes with catchlights (egg).
// Taco placed third of three on the strength of one glint mesh — and even egg is
// not enough: measured across the cast, **0% of our eye pixels are above 0.85 luma
// against the reference plates' 31.1% and 34.1%**, because what this file called an
// "eye" was a near-black bead with a highlight on it and no white anywhere.
//
// The sclera is now a real mass and it is the brightest albedo on the character:
// 1.000, against the cheek pad's 0.856, the serape's pale stripe at 0.930 and the
// teeth's 0.924. The teeth are deliberately BELOW the sclera — an open mouth needs
// a bright interior on this character (see `THROAT`) but it must not outbid the eye.
const SCLERA = '#FFFFFF';
const TOOTH = '#F6EBD5';
/**
 * The mouth's interior. This is the value step that turns a painted curve into an
 * OPENING, and its exact tone is decided by what sits below it.
 *
 * `MEAT_DARK` is this character's near-black and it is on the neck collar directly
 * under the chin. A dark opening immediately above the darkest band merges with it
 * into one mass and reads as **a hat brim** — which is what Uri reported as "no
 * mouth, seems like a hat". So the throat is a warm dark red-brown (albedo luma
 * 0.196) rather than the collar's near-black (0.065): a real step down from the
 * cheek pad (0.856) with a real step UP from the collar, so the two darks cannot
 * be read as one band even before the mouth is lifted clear of it.
 */
const THROAT = '#8A3020';
/**
 * The brow. Was `SHELL_DARK` (#D07F1E, albedo luma 0.55) drawn on the cheek pad
 * (0.856) — a 0.31 step, which is a shade, not a stroke. Read off the rendered
 * lobby PNG the brows were two faint orange smudges. Uri asked for the face to be
 * "clear and crisp"; a brow is a LINE and a line needs to be dark against what it
 * is drawn on. Still the shell's own family (a deep fried edge), not ink — ink
 * brows on a warm pad read as pasted-on decals.
 */
const BROW = '#8A4A12';
/**
 * ── TRIED AND REVERTED: a MID-TONED collar, `#A85F22`. Two numbers killed it. ──
 *
 * The idea was that Uri's *"seems like a hat"* is partly the near-black ring under
 * the chin, and it was defended by this file's own note that removing the whole
 * neck moves p05 by **0.0038** — i.e. that the collar is not the dark rung.
 *
 * **That note does not transfer, and this is the `docs/LESSONS.md` §13 shape: a
 * measurement that was TRUE when it was taken and answers a narrower question than
 * the one it gets quoted for.** It was measured when p05 already sat at 0.1943 with
 * a different `CHARACTER_HEIGHT`; the value pass since then moved the whole ladder.
 * Measured now, on a frozen HEAD + this file, at the shipped facing:
 *
 *     collar                  p05      range    gate (p05 <= 0.180)
 *     MEAT_DARK #1C0E07       0.132    0.725    PASS
 *     #A85F22 (mid)           0.200    0.692    **FAIL**
 *
 * The collar is roughly HALF of this character's darkest 5% — 739 delivered px of
 * ~16.4k, against 305 + 285 for both dark limb segments together.
 *
 * And the render refuted the art reason too, which is the more useful half. With a
 * MID collar under the still-dark neck column the pair reads as **a black crown
 * with an orange brim** — a sombrero, which is a sharper version of the very defect
 * it was meant to remove. A uniformly dark neck+collar reads as a collar.
 *
 * → The lever for "seems like a hat" is the FACE and the MOUTH HEIGHT, exactly as
 *   `rules.ts` prescribes ("Lift the mouth, or lighten the interior, or both"), not
 *   the collar. Both were done; the collar stays `MEAT_DARK`.
 */

/**
 * Shell wall outline: a rounded fold at the bottom rising to a wide open mouth,
 * with a gently SCALLOPED top edge.
 *
 * ── Why this replaced a jagged trapezoid ────────────────────────────────────
 * The first version was a narrow-bottomed trapezoid whose top edge carried
 * sharp triangular teeth 0.30R tall. Rendered as a black silhouette it read as
 * a CROWN, and in colour it read as a torn paper bag — the one thing it never
 * read as was a taco. Two causes, both in this outline:
 *
 *   1. Tall sharp spikes are the loudest thing in a silhouette, so they became
 *      the shape the eye named. A real hard-shell taco has a crimped edge, and
 *      "crimped" is a small repeating WAVE, not a row of fangs. Scallops carry
 *      the same crinkle-fried read at a fraction of the silhouette budget.
 *   2. The bottom came to a near point (0.16R half-width), which is a wedge —
 *      pizza's shape, and pizza is in the same five-character cohort. A taco
 *      folds around a ROUNDED bottom; that curve is the half of the outline
 *      that actually distinguishes the two foods, and it was missing.
 *
 * ── Then it read as a PAPER BAG, and the missing thing was the arc ──────────
 * A blind critic's verdict on the scalloped-trapezoid version was exact: "the
 * shell is a flat rectangular slab with a straight vertical fold — there is no
 * taco arc anywhere in the silhouette." True. Rounding only the bottom left the
 * sides near-vertical for most of their run and the mouth dead flat, which is
 * an envelope. A taco's signature is a CRESCENT: two horns up at the corners,
 * the opening dipping between them, the mass bellying out below.
 *
 * So the top edge now dips parabolically to `dipFrac` of the wall height at
 * centre, and the outer edges bow OUT on their way down before turning into the
 * bowl. That single change is what puts a nameable food shape in the outline —
 * and it also opens a window in the middle of the near wall for the fillings to
 * show through, which no amount of moving the fillings could achieve while the
 * rim was a straight line above them.
 *
 * Baking the crimp into the outline rather than gluing teeth on afterward keeps
 * the whole wall one solid mesh, so no part of it can float off the surface.
 *
 * ── AND THE TWO HORNS ARE NOW ROUNDED ───────────────────────────────────────
 * 🚨 A pointed mass either side of a head reads as an EAR or a HORN whatever it
 * is made of — five for five across this cast (burrito's foil, egg's shards,
 * hamburger's lettuce, lollipop's cellophane, pizza's cheese strands). Taco is
 * the one character where the two upper corners ARE the food: a taco is a
 * crescent, and `rules.ts` asks for "two soft horns". Deleting them is the trap
 * on the other side of the same rule — detail added to signal the subject can
 * destroy the silhouette that signalled it better (`egg.ts:206`), and here the
 * crescent IS the signal.
 *
 * So they are re-SHAPED rather than re-placed: each corner was a hard vertex
 * where a near-vertical side met a top edge falling away at ~42 degrees, an
 * exterior turn of ~48 degrees. It is now a quadratic through that old vertex,
 * which keeps the horn's position and its height and takes the point off it.
 */
function tacoShellShape(halfW: number, yBot: number, yTop: number, dipFrac: number, crimp: number): THREE.Shape {
  const shape = new THREE.Shape();
  const h = yTop - yBot;
  const dip = h * dipFrac;
  // ── 🚨 THE TOP EDGE WAS A PARABOLA, AND A PARABOLA IS A PAIR OF EARS ────────
  // The paragraphs above rounded the two corner VERTICES and declared the horn read
  // solved. Read `shots/ca/before/taco.png` at the lobby camera and it is not: the
  // bright gold near wall is a wide **V**, with a pointed lobe at each end rising
  // 0.224 m (0.46R) above the face pad's own crown and a hard notch between them,
  // and the face sits in the notch. That is a cat's head, drawn exactly.
  //
  // The vertices were never the mechanism. `yTop - dip*(1 - u*u)` is an UPWARD
  // parabola: its minimum is at the centre and its maxima are at the ends, so the
  // edge has non-zero slope arriving at BOTH ends and a sharp turn at the middle.
  // The silhouette it produces is two peaks and a valley regardless of how the
  // corner vertex itself is filleted — the peaks are made by the curve, not by the
  // join. `docs/DECISIONS-FOR-URI.md` §40 pattern 1 says a mirrored pair of raised
  // masses beside a head is an ear whatever it is made of; here the pair is the
  // OUTLINE of the head, which is why rounding the tips did not touch it.
  //
  // A raised cosine has zero slope at BOTH ends and at the centre, so the same dip
  // arrives as one continuous scallop with no peak and no notch. Combined with
  // `dipFrac` 0.34 -> 0.18 at the call site the lobes drop from 0.46R to 0.19R of
  // relief, which is a shell rim.
  const topAt = (x: number): number => {
    const u = THREE.MathUtils.clamp(x / halfW, -1, 1);
    return yTop - dip * 0.5 * (1 + Math.cos(Math.PI * u));
  };
  // Rounding widened hard (0.14 -> 0.30 across, 0.045 -> 0.13 down). At the old
  // values the fillet was 0.07 m on a 0.51 m half-width — a chamfer on a spike.
  const hrX = halfW * 0.30;  // how far in from the corner the rounding starts
  const hrY = h * 0.13;      // and how far down the side
  shape.moveTo(-halfW, yTop - hrY);
  // Outer edge: was `±halfW * 1.05`, i.e. the wall bulged OUT below the corners so
  // the corners themselves were pinched — which is precisely an ear's outline (wide
  // base, narrowing tip). 0.97 makes the widest point the corner itself and the wall
  // taper gently down into the fold, which is what a shell seen end-on does.
  shape.quadraticCurveTo(-halfW * 0.97, yBot + h * 0.36, -halfW * 0.60, yBot + h * 0.04);
  shape.quadraticCurveTo(0, yBot - h * 0.06, halfW * 0.60, yBot + h * 0.04);
  shape.quadraticCurveTo(halfW * 0.97, yBot + h * 0.36, halfW, yTop - hrY);
  // The right corner: a long fillet through the old vertex, which keeps the corner's
  // place and takes the point off it.
  shape.quadraticCurveTo(halfW, yTop, halfW - hrX, topAt(halfW - hrX));
  // Top edge scallops toward the centre. Walked right → left as a fine polyline with
  // a small ripple riding on it, which gives the crimped fried edge without the
  // ripple ever becoming the shape the eye names. N 12 -> 24: at 12 the chords were
  // 0.086 m and the "curve" rendered as a row of straight facets, which put hard
  // vertices back into the outline the fillet had just removed.
  const N = 24;
  const span = halfW - hrX;
  for (let i = 1; i <= N; i++) {
    const t = i / N;
    const x = span - 2 * span * t;
    shape.lineTo(x, topAt(x) + crimp * Math.abs(Math.sin(t * Math.PI * 3)));
  }
  // The left corner, mirrored, closing back onto `moveTo`.
  shape.quadraticCurveTo(-halfW, yTop, -halfW, yTop - hrY);
  return shape;
}

/**
 * A rounded limb segment, like a capsule but with INDEPENDENT top and bottom
 * radii, hanging DOWN from the joint origin (spans y=0..-len) — the orientation
 * `dressLimbs()` expects. Local to this file; see `hamburger.ts` for the
 * reference copy. Taco's own call sites use a low `radialSegments` and a
 * flattened Z scale so the limb reads as a faceted, crunchy shell shard rather
 * than the smooth rubbery capsule every other character in the cast would get
 * from the same helper at default settings.
 */
function taperedSegment(len: number, rTop: number, rBot: number, radialSegments = 12, rise = 0): THREE.BufferGeometry {
  // Profile MUST be wound bottom-to-top (y increasing), matching every other
  // lathe helper in this cast (`bunDome`, `roundedPuck` in `hamburger.ts`) —
  // LatheGeometry's face winding (and therefore `computeVertexNormals`'s
  // outward-vs-inward call) depends on point order, not just point position. An
  // earlier version of this function built the profile top-to-bottom and every
  // limb using it rendered near-black: inverted normals facing away from the
  // light. The y=0/y=-len hang-down placement is unchanged.
  //
  // ── 🚨 THREE OF TACO'S FOUR SEGMENTS WERE SPHERES, AND THE FOURTH WAS CLOSE ──
  // Taken verbatim from `donut.ts:145`, which solved this and never propagated to
  // the other five copies of this helper. The old code emitted a straight side only
  // when `len >= rTop + rBot`; below that it SKIPPED the side and clamped with
  // `yTopSafe = max(...)`, which does not shrink the caps — it stacks two full
  // hemispheres. Taco's own numbers, measured off `bodies.ts`'s STOUT at
  // `CHARACTER_HEIGHT` 2.1 and the radii the call sites below used to pass:
  //
  //   segment      len       rTop+rBot   side?
  //   upper arm   0.1922      0.3302     NO -> ball, top cap 0.138 m ABOVE its pivot
  //   forearm     0.1753      0.2299     NO -> ball
  //   thigh       0.2757      0.2875     NO -> ball
  //   shin        0.2256      0.1958     yes (the only one)
  //
  // "0.138 m above its own joint origin" is the whole defect: the upper arm's mesh
  // pokes 72% of its own bone length UP through the shoulder, and the thigh does the
  // same through the hip, so a chain of segments interpenetrates instead of abutting
  // and reads as a string of beads. `shots/ca/before/taco.png` at the lobby camera:
  // four indistinguishable chains of orange-and-black balls.
  //
  // The fix bounds each cap by the BONE rather than by the radius — cap HEIGHTS
  // clamp to 0.42/0.30 of `len` (sum 0.72 < 1, so a straight side always exists)
  // while cap WIDTH stays `rBot`/`rTop`. The mesh then spans exactly y in [-len, 0]
  // and can never overlap its parent segment. Resolution follows donut's measured
  // choice (6 cap segments, 4 side steps) rather than the 4/3 that was here: a
  // coarser lathe puts a shading corner where `computeVertexNormals` has to guess.
  // ⚠️ The call sites' radii are re-tuned below, because bounding the caps changes
  // the delivered silhouette and the old radii were chosen against the broken shape.
  // `rise` (hamburger's parameter, same meaning) extends the mesh ABOVE its own joint
  // origin, so a segment can start INSIDE the mass it hangs from and have no contour
  // of its own until it emerges. On STOUT that is not a nicety: even with the caps
  // bounded, taco's bones are 1.3-1.5x as wide as they are long, so two segments that
  // merely ABUT meet through a double taper and leave a waist at every joint — which
  // is the same bead read from the other end. Overlapping them removes the waist.
  const capSegs = 6;
  const capBot = Math.min(rBot, len * 0.42);
  const capTop = Math.min(rTop, (len + rise) * 0.30);
  const yBotCap = -len + capBot;
  const yTopCap = rise - capTop;
  const pts: THREE.Vector2[] = [new THREE.Vector2(0, -len)];
  for (let i = 1; i <= capSegs; i++) {
    const a = (Math.PI / 2) * (i / capSegs);
    pts.push(new THREE.Vector2(Math.sin(a) * rBot, -len + capBot - Math.cos(a) * capBot));
  }
  const sideSteps = 4;
  for (let i = 1; i <= sideSteps; i++) {
    const t = i / sideSteps;
    pts.push(new THREE.Vector2(THREE.MathUtils.lerp(rBot, rTop, t), THREE.MathUtils.lerp(yBotCap, yTopCap, t)));
  }
  for (let i = 1; i <= capSegs; i++) {
    const a = (Math.PI / 2) * (i / capSegs);
    pts.push(new THREE.Vector2(Math.cos(a) * rTop, yTopCap + Math.sin(a) * capTop));
  }
  const geo = new THREE.LatheGeometry(pts, radialSegments);
  geo.computeVertexNormals();
  return geo;
}

export class TacoCharacter extends BaseCharacter {
  private rig: ChibiRig;
  private fillings: THREE.Object3D[] = [];
  private fillingBaseRotZ: number[] = [];

  constructor(def: CharacterDef) {
    super(def);

    this.rig = new ChibiRig({
      palette: {
        limb: LIMB_SHELL,
        hand: ONION,  // saturated purple — ties to Onion Bomb, breaks from the cast's
                       // repeated cream/white mitt, per the same review pass above
        foot: BOOT_CHAR,
        // ── The neck column and its collar are this character's DARKEST band ──────
        // `rig.ts` defaults the column to `limb` and the collar to 0.55 x `foot`.
        // On Taco that is a mid tone on top of a mid tone, and Taco is the one
        // character whose dark end has no margin: `valuescan` p05 was 0.1789 against
        // a <= 0.180 gate before this round, and the `CHARACTER_HEIGHT` correction
        // (2.35 -> 2.10, `src/units.ts`) took it to 0.1943 — a smaller figure spends
        // fewer pixels on the small dark features, so the percentile tail moves in.
        // Isolated: removing the neck entirely gives 0.1943, so the neck is NOT the
        // cause (0.0038 of it), the height is.
        //
        // The reference's own answer is to put the darkest band UNDER THE CHIN, so
        // that is where the recovery goes rather than into the boot — pass 3 already
        // measured that a near-black boot under a near-black shin is not two shapes
        // (`kneeL|footL` 0.028 across 41 px) and deliberately went the other way.
        //
        // ⚠️ A mid-toned collar was tried here for Uri's "seems like a hat" and
        // REVERTED on two measurements — see the reverted-experiment block above
        // `SCLERA`. p05 0.132 -> 0.200 against a <= 0.180 gate, and the render came
        // back reading as a sombrero rather than less like a hat.
        // ── 🚨 THE "HAT" WAS THE NECK COLUMN AND ITS COLLAR, AND BOTH ARE GONE ──
        // Uri: *"no mouth, seems like a hat."* Two previous rounds read that as the
        // MOUTH (lifted 0.21R, given a bright tooth band) and as the COLLAR (a mid
        // tone, measured, reverted — the block above `SCLERA` keeps the numbers).
        // Neither is wrong and neither was the object. The lobby capture
        // `shots/ca/before/taco.png` shows, directly under the chin, a dark
        // near-cylindrical mass 0.34 m across and 0.29 m tall with a near-black disc
        // 0.49 m across flaring at its base, standing on a bright gold chest. That is
        // a crown and a brim, and it is `rig.ts`'s `neck_column` + `neck_collar`.
        //
        // `neckFraction: 0` in the proportions below deletes both; the full
        // derivation — including why recolouring, covering and enclosing the column
        // all failed, and the compensation that keeps R and `headCentreY` identical —
        // is in `buildFood()` above the chin notch that replaces the ring.
        //
        // ⚠️ These two entries are therefore DEAD on this character and are kept, not
        // deleted, because `RigPalette` is shared: if a later pass restores a neck gap
        // here it must not silently restore the near-black crown with it. `SHELL`
        // (the chest's own gold) is what a re-enabled column should be.
        neck: SHELL,
        collar: MEAT_DARK,
        torso: SHELL,
        limbRoughness: 0.8,
      },
      // Body: STOUT archetype (see `bodies.ts`) — short wide torso, thick short
      // limbs, wide planted stance.
      //
      // This reverses an earlier hand-tune that pushed Taco "lean and angular,
      // longer limbs" via `height: 2.30`, which was the only lever the old rig
      // gave for limb length. A taco shell is a WIDE, low, heavy form; the lean
      // body was fighting the food's own shape class, and the silhouette test
      // showed it landing in the same generic middle as everything else anyway.
      // `headFraction` is raised so the shell (which spans -1.20R to +0.85R, far
      // from the spherical mass the rig assumes) still reaches cast height.
      // `headFraction` is raised because a folded shell is nothing like the ±R
      // sphere the rig assumes: the mass runs from -1.05R to about +0.5R once
      // the walls are tilted back, so R has to grow for the crimp to reach the
      // cast's ~2.10 m standing height. Verified with `shoot.mjs --char taco`,
      // which prints the real bounding height — not guessed.
      // `stanceWidth` 0.215H -> 0.30H, the same widening soup and hamburger take,
      // measured on this character: hull deficiency 0.2217 base -> 0.28 at stance
      // x1.5 with splay, islands 1 throughout, and it is the change that takes the
      // yaw-0 read off 0.1898.
      // `headFraction` 0.52 -> 0.461490 and `headMount` 0.88 -> 1.118344 are NOT a
      // re-proportioning: they are the exact compensation for `neckFraction: 0`, and
      // the arithmetic that shows they leave R and `headCentreY` unchanged to six
      // figures is with the chin-notch block in `buildFood()`. `neckFraction: 0`
      // deletes `rig.ts`'s neck column and collar, which on this character — and only
      // on this character, because its face sits 0.15 m BEHIND the rig's neck axis —
      // render as a hat crown and brim under the chin.
      proportions: bodyType('stout', {
        headFraction: 0.461490,
        headMount: 1.118344,
        neckFraction: 0,
        stanceWidth: CHARACTER_HEIGHT * 0.275,
      }),
      // ── Both elbows were tucked INSIDE the shell ────────────────────────────
      // The old -0.75 / -0.85 elbows plus a +0.20 / -0.45 shoulder pair swung both
      // forearms across the body and behind the shell: measured delivery 0.286
      // (left forearm) and 0.000 (right forearm, i.e. every pixel of it occluded),
      // with the right mitt down at 0.344. "Both fists cocked" was authored and
      // never reached the screen.
      //
      // The eager, forward-committed read is carried by `lean` (0.16, still the
      // most forward-committed in the cast) and by the shoulders' remaining
      // asymmetry, not by folding the arms into the food.
      // Leaning forward, eager — weight already committed toward the fight, both
      // fists cocked like she's about to toss filling. An art director's second
      // pass named the cast's identical dead-front symmetric pose as a top gap;
      // this is the most forward-committed lean in this file's cast, matching
      // a character built entirely around throwing things.
      // `headTurn` pushed from -0.05 to -0.24: a wide flat-fronted mass presented
      // dead square to camera reads as a signboard. Turning it a little shows the
      // fold's own thickness and the far wall behind the near one, which is what
      // makes the shape read as a container with a front and a back rather than
      // as a cut-out.
      stance: {
        // -0.05 barely opened at all and the left thigh measured 0.329 delivered with
        // only 0.206 of it covered by the shell — the occluder is the mitt, not the food.
        shoulderL: -0.18, shoulderR: 0.28,
        elbowL: -0.50, elbowR: -0.45,
        twist: 0.05, headTilt: -0.07, headTurn: -0.24,
        hipSway: -0.04, lean: 0.16,
        // Forward-committed AND planted — the throw needs a base. Measured:
        // 0.2217 -> 0.2395 at splay alone -> 0.28 with the wider stance under it.
        splay: 0.34,
      },
    });
    this.body.add(this.rig.joints.root);
    this.head = this.rig.joints.head;

    const R = this.rig.headRadius;
    const head = this.rig.joints.head;

    // ── Materials ────────────────────────────────────────────────────────────
    // Every filling gets its own roughness so the fold reads as bread + seared meat +
    // wet vegetables rather than one glossy plastic shader repeated in different hues.
    const shellMat = toonMat({ color: SHELL, roughness: 0.8 });        // crisp, dry, fried shell
    const shellDarkMat = toonMat({ color: SHELL_DARK, roughness: 0.8 });
    const podMat = toonMat({ color: POD, roughness: 0.76 });
    const meatMat = toonMat({ color: MEAT, roughness: 0.55 });         // seared, faintly greasy
    const meatDarkMat = toonMat({ color: MEAT_DARK, roughness: 0.5 });
    const tomatoMat = glossyMat({ color: TOMATO, roughness: 0.18 });   // wettest surface on the model
    const lettuceMatA = toonMat({ color: LETTUCE, roughness: 0.6 });   // leafy, satin not shiny
    const lettuceMatB = toonMat({ color: LETTUCE_DARK, roughness: 0.6 });
    const onionMat = glossyMat({ color: ONION, roughness: 0.32 });     // moist, faintly translucent

    // ── Shell ────────────────────────────────────────────────────────────────
    // A wide, jagged-topped trapezoid — the "hard shell taco" read at a glance — but
    // NOT one flat panel. Round 1 built it as a single extruded slab and it disappeared
    // to a thin featureless blade from every angle except near-front (idle_135/210
    // showed nothing but a flat gold triangle). Fixed by splitting it into two full
    // panels hinged at the bottom crease and tilted apart around that hinge like an
    // open book: the front wall leans toward the camera, the back wall leans away.
    // From the front this still reads as a solid shell; from the side/back the "V"
    // itself is now the silhouette, with real width in every direction.
    //
    // ── Head-attachment fix (floating-head defect) ──────────────────────────
    // `ChibiRig.headCentreY` places the head group's own origin at
    // `torsoTopY + 0.86*R`, which assumes a mass extending roughly symmetrically
    // ±R about that origin (true for a sphere-like donut ring or egg shell) —
    // the same trap `hamburger.ts` and `hotdog.ts` document. The shell's hinge
    // crease (its lowest point, at `yBot`) sits at head-local y = `hingeY`, so
    // its ABSOLUTE y is `headCentreY + hingeY`. At the old `yBot = -R*0.85` that
    // put the crease almost exactly ON `torsoTopY` (0.86R - 0.85R ≈ 0.01R) —
    // which looks right IF the torso actually reached its own full nominal
    // height. It doesn't: `dressTorso`'s `size.h` is read off the RIG's default
    // torso mesh bounding box, which only spans ~0.92 of the real torso height
    // (the sphere-derived default tapers before its poles), and this file's own
    // torso fold shape only climbs to ~0.82-0.94 of THAT already-short `size.h`
    // before its crimp teeth. Net effect: the tallest point of the dressed torso
    // fold lands a good 15-20% of the torso height below `torsoTopY` — exactly
    // the visible gap between shell and body the brief calls out, and it was
    // invisible dead-on (idle_0) but opened up at yaw/mid-stride because the
    // hinge crease is a narrow line (`halfWBot` wide), not a flat base, so a
    // small viewing-angle change is enough to see past it into the gap behind.
    // Fix: push the hinge crease further down (more negative `yBot`) so it sinks
    // safely BELOW the torso fold's own tallest crimp teeth instead of sitting
    // exactly at the torso's theoretical (but unreached) full height — the same
    // "anchor the mass's own underside, not the rig's assumed centre" reasoning
    // hamburger's BASE_Y and hotdog's neck block both use. `yTopBase` (the
    // shell's opening/pod region) is untouched, so the visible silhouette above
    // the crease — fillings, pod, face — is unaffected; only the hidden portion
    // below the opening gets longer, self-embedding into the torso fold.
    // Wider and shorter than the first two passes. A taco is a WIDE, low form;
    // at 0.94R half-width over a 1.67R span the shell came out taller than it
    // was broad, which is most of why it kept reading as a container rather
    // than as food.
    const halfWTop = R * 1.06;
    // ── THE HINGE AND THE SHELL'S BOTTOM ARE NOW TWO NUMBERS ────────────────────
    // `yBot` used to be both: the hinge the walls rotate about AND the lowest point
    // of the extruded outline. Making the shell reach further down (the lever this
    // method's own docblock prescribes for "the shell does not reach the body") was
    // therefore impossible without also moving the hinge, and `troughLen` — which
    // every filling's position is a fraction of — is measured from it. So the two
    // are split: `yBot` stays the hinge and the trough datum, and `shellBotY` is how
    // far the WALL hangs below it.
    const yBot = -R * 0.95;
    // ── 🚨 AND THIS IS THE SECOND HALF OF THE "HAT" ────────────────────────────
    // Recolouring the neck column to `SHELL` (see the palette) removed the dark
    // crown, and the lobby render then showed what was underneath: a gold CYLINDER
    // with a hard rounded rim standing under the chin — a cup. `outlineGroup` draws
    // an ink edge round every mesh, so a column that matches its background in ALBEDO
    // still has a drawn silhouette; matching the colour hid the mass and not the line.
    // ⚠️ `docs/LESSONS.md` §1 in its newest form, and worth stating plainly: **making
    // a thing the same colour as its neighbour is not the same as covering it.**
    //
    // The real fix is coverage, and it is the lever this file already documents.
    // `rig.ts` mounts the head `neckGap + 0.88R` above `torsoTopY`, so the shell's own
    // lowest point sits at `headCentreY + shellBotY`; at -0.95R that is
    // `torsoTopY + 0.1155 - 0.034` = **0.082 m of bare neck column**, exactly what is
    // in frame. -1.10R puts it at `torsoTopY - 0.010`, i.e. the wall closes over the
    // column and lands inside the torso fold. Nothing above the opening moves.
    const shellBotY = -R * 1.10;
    // ── The two walls are DIFFERENT HEIGHTS, and that is the load-bearing part ─
    // Built identical, the near wall's rim always sits higher on screen than
    // anything in the fold behind it — so the fillings, the one thing that says
    // "this is a taco and not a paper bag", were completely occluded and only
    // two stray lettuce tips cleared the crimp. Dropping the FRONT wall and
    // raising the back one opens the mouth toward the camera: meat, tomato and
    // lettuce now stack visibly above the near rim, in that order, with the tall
    // back wall behind them as the backdrop that keeps them reading as contained.
    const frontTopY = R * 0.48;
    const backTopY = R * 0.76;
    const panelThickness = R * 0.17;
    const hingeY = yBot;

    // ── Which way the walls lean, and why it is a LIGHTING decision ──────────
    // Both walls used to splay symmetrically about vertical: front +0.44 rad
    // (top toward camera), back -0.44. Rotating a panel's top toward the camera
    // tips its outward normal DOWN — away from a key light that comes from above
    // — so the front wall, the single largest surface on this character and the
    // one nearest the lens, rendered as a huge flat near-black-brown mass filling
    // the middle of the frame. The bright orange the eye actually found was the
    // BACK wall behind it, which is why the shape read as a crown: the only lit
    // part of the shell was its rear crimp.
    //
    // Both walls now lean BACK, the front only slightly and the back much
    // further. That does three things at once: the front wall's normal tilts UP
    // toward both the key and a camera pitched 58 degrees down, so it is lit and
    // presents its full area; the fold still opens (the walls differ by ~21
    // degrees) but opens up-and-away, which is exactly the direction the gameplay
    // camera looks INTO; and the fillings end up on the far side of the front
    // wall's top edge where they read as sitting IN the shell.
    const frontTilt = -0.26;
    const backTilt = -0.62;

    // The NEAR wall dips hard (0.34) — that dip is the window the fillings read
    // through. The far wall barely dips (0.14) so it stands up behind them as a
    // solid backdrop; give both the same dip and the toppings lose their
    // background and float against the sky.
    const wallGeo = (yTop: number, dipFrac: number): THREE.BufferGeometry => {
      const g = new THREE.ExtrudeGeometry(tacoShellShape(halfWTop, shellBotY, yTop, dipFrac, R * 0.06), {
        depth: panelThickness, bevelEnabled: false, curveSegments: 8,
      });
      g.translate(0, 0, -panelThickness / 2);
      g.computeVertexNormals();
      return g;
    };

    // Front wall — the dominant, camera-facing panel, and now the surface the
    // FACE lives on. Everything mounted on it inherits its tilt for free.
    const frontPivot = new THREE.Group();
    frontPivot.name = 'shell_front_pivot';
    frontPivot.position.set(0, hingeY, 0);
    frontPivot.rotation.x = frontTilt;
    head.add(frontPivot);
    // 0.34 -> 0.18 -> 0.12. See `tacoShellShape`: the dip is now a raised cosine, so
    // it no longer manufactures two PEAKS, but the lobes are still whatever relief the
    // dip leaves. Measured off the outline, the corner stands `0.794 * dip` above the
    // centre — 0.204R at 0.18 (and `shots/ca/after1/taco.png` still reads as a bonnet
    // with two soft corners), 0.150R at 0.12. The fillings clear it either way: they
    // sit in the trough behind, whose back wall is 0.28R taller, and the after-1
    // capture shows the whole mound standing clear of the rim with room to spare.
    const frontMesh = new THREE.Mesh(wallGeo(frontTopY, 0.12), shellMat);
    frontMesh.name = 'taco_shell_front';
    frontMesh.position.set(0, -hingeY, 0); // re-centres the shape's own yBot back onto the hinge
    frontMesh.castShadow = true;
    frontMesh.receiveShadow = true;
    frontPivot.add(frontMesh);

    // Back wall — same geometry, leaning further back, a shade darker so it reads
    // as the shadowed far wall of the fold rather than a plain duplicate.
    const backPivot = new THREE.Group();
    backPivot.name = 'shell_back_pivot';
    backPivot.position.set(0, hingeY, 0);
    backPivot.rotation.x = backTilt;
    head.add(backPivot);
    const backMesh = new THREE.Mesh(wallGeo(backTopY, 0.14), shellDarkMat);
    backMesh.name = 'taco_shell_back';
    backMesh.position.set(0, -hingeY, 0);
    backMesh.castShadow = true;
    backMesh.receiveShadow = true;
    backPivot.add(backMesh);

    // Everything loose in the fold rides a pivot bisecting the two walls, so
    // filling positions can be authored in plain "up the trough" coordinates
    // instead of each one needing its own hinge solve.
    const troughPivot = new THREE.Group();
    troughPivot.name = 'taco_trough';
    troughPivot.position.set(0, hingeY, 0);
    troughPivot.rotation.x = (frontTilt + backTilt) / 2;
    head.add(troughPivot);
    /** Back-wall length from the hinge to the crimped mouth. */
    const troughLen = backTopY - yBot;

    // ── Fillings: meat, tomato, lettuce, a wink of onion ────────────────────────
    // Sit in the gap between the two walls (z spans from the back wall toward the
    // front one), embedded into whichever wall they're closest to so nothing reads as
    // floating. Positions are given in "natural" (untilted) head-space coordinates —
    // the fillings themselves stay untilted, independent of either wall, which is
    // exactly right for something loose sitting in the pocket between them.
    // Coordinates are now TROUGH-local: `fy` is a fraction of the wall length
    // from the fold (1.0 = the crimped mouth), `fz` a small offset across the
    // gap between the walls. Authoring in the tilted frame is what lets the
    // stack be layered meat → tomato → lettuce by a single number, and it is
    // self-correcting if either wall angle is ever retuned.
    //
    // The meat band is packed dense and wide on purpose: it is what fills the
    // opening. The previous build left the fold's interior empty, and an empty
    // fold under a downward-facing wall is just a dark hole.
    // The `fy` band is set against the FRONT wall's rim, which in trough
    // coordinates sits at about 0.85 — anything below that is behind the near
    // wall and contributes nothing. Meat starts right at the waterline so a
    // little brown reads under the brighter toppings without the fold looking
    // like it is overflowing with beef.
    // ── 🚨 THE SHAPES WERE THE BUG, NOT THE PALETTE ──────────────────────────
    // Uri, on the lobby render: *"items on the head look like FRUIT, not taco
    // add-ons"* (`docs/DECISIONS-FOR-URI.md` §39). The colours were already right —
    // `TOMATO #E63946`, `LETTUCE`, `ONION` are exactly what a taco is filled with —
    // and every one of them was built as the wrong SOLID: **a sphere is a berry, a
    // rounded capsule is a bean, and a purple torus arc is a grape.** Real fillings
    // are crumbled, diced and shredded, so that is what each one is now built from,
    // with the palette untouched:
    //
    //   meat     sphere            -> faceted icosahedral CRUMBLES, smaller, 12 of
    //                                 them instead of 8, each with its own
    //                                 non-uniform scale and roll so no two repeat
    //   tomato   cube              -> kept (a dice IS a cube) but flattened, so it
    //                                 reads as a cut slab rather than a jelly bead
    //   lettuce  capsule           -> flat SHREDS — thin ribbons, not rods
    //   onion    torus arc         -> thin diced SLIVERS
    //
    // Sizes come DOWN across the board. The old blobs at 0.185R were the largest
    // objects in the fold; crumbled mince is small, and smallness is half of what
    // makes a pile of anything read as chopped rather than as whole fruit.
    const crumbGeo = new THREE.IcosahedronGeometry(R * 0.128, 0);
    const meatSpots: Array<[number, number, number, THREE.Material]> = [
      // ⚠️ The dark/mid SPLIT is a value-gate decision, not a taste one, and it was
      // measured both ways. Cutting `meatDarkMat` from 6 of 12 to 4 (because the
      // rendered fold looked like charcoal at the old 0.185R sphere size) moved the
      // shipped-capture p05 from 0.15 to 0.17 against a **max of 0.180** — the
      // fillings ARE part of this character's dark 5%, not just the limbs. 6 dark
      // crumbs at 0.128R read very differently from 6 dark spheres at 0.185R, which
      // is what actually caused the charcoal look: the fix was the SIZE and the
      // FACETING, not the count.
      [-0.66, 0.86, 0.22, meatMat], [-0.44, 0.88, 0.06, meatDarkMat], [-0.24, 0.85, 0.30, meatMat],
      [-0.06, 0.90, 0.12, meatDarkMat], [0.12, 0.86, 0.30, meatMat], [0.30, 0.89, 0.08, meatDarkMat],
      [0.48, 0.85, 0.26, meatMat], [0.66, 0.87, 0.12, meatMat], [-0.54, 0.83, 0.34, meatDarkMat],
      [0.02, 0.83, 0.02, meatDarkMat], [0.38, 0.83, 0.36, meatDarkMat], [-0.14, 0.92, 0.20, meatMat],
    ];
    for (let i = 0; i < meatSpots.length; i++) {
      const [fx, fy, fz, mat] = meatSpots[i];
      const blob = new THREE.Mesh(crumbGeo, mat);
      blob.name = 'taco_meat';
      // Deterministic per-index variation — a shared geometry with a different
      // non-uniform scale and a different roll on every instance is what stops a
      // dozen identical solids reading as a texture (the critic note that killed
      // the first filling pass: "a row of near-identical brown spheres").
      const j = (i * 2.399963) % 1;
      blob.scale.set(0.78 + j * 0.66, 0.62 + ((i * 7) % 5) * 0.11, 0.80 + j * 0.34);
      blob.rotation.set(j * 2.6, i * 1.31, ((i * 5) % 7) * 0.44);
      blob.position.set(fx * halfWTop, fy * troughLen, fz * R);
      blob.castShadow = true;
      blob.receiveShadow = true;
      troughPivot.add(blob);
      this.fillings.push(blob);
      this.fillingBaseRotZ.push(blob.rotation.z);
    }

    // ── Vary the size, or a filling row is just a row ────────────────────────
    // A critic on the previous build called the toppings "a row of
    // near-identical brown spheres that read as generic lumps". Correct: every
    // meat blob was one radius and every tomato one cube, so the fold read as a
    // texture rather than as ingredients. One dominant tomato wedge now anchors
    // the row and the rest step down from it.
    const tomatoSpots: Array<[number, number, number, number]> = [
      [-0.62, 0.96, 0.20, 1.55], [-0.26, 0.98, 0.06, 0.85], [0.12, 0.97, 0.26, 1.0],
      [0.46, 0.99, 0.08, 0.8], [0.70, 0.94, 0.20, 1.15], [-0.44, 0.94, 0.00, 0.75],
    ];
    for (const [fx, fy, fz, scale] of tomatoSpots) {
      const s = R * 0.155 * scale;
      // Flattened, not a cube: a diced tomato is a CUT SLAB with a thickness, and a
      // true cube at this size is the one solid that still reads as a bead.
      const bit = new THREE.Mesh(new THREE.BoxGeometry(s, s * 0.58, s * 0.92), tomatoMat);
      bit.name = 'taco_tomato';
      bit.position.set(fx * halfWTop, fy * troughLen, fz * R);
      bit.rotation.set(0.3, 0.5, 0.2 + fx);
      bit.castShadow = true;
      bit.receiveShadow = true;
      troughPivot.add(bit);
      this.fillings.push(bit);
      this.fillingBaseRotZ.push(bit.rotation.z);
    }

    // Lettuce is the only filling that clears the crimp, so it is the one that
    // states "this shell is FULL" in silhouette. Kept to the top band.
    // `burst` shreds stand nearly UPRIGHT and reach past the horns; the rest lie
    // across the fold. Two spiky green bursts breaking the outline is what makes
    // the crown of this silhouette specific instead of a flat lumpy line.
    //
    // ── AND THEY NOW CARRY THE HEIGHT THE SIDE SPRIGS USED TO ──────────────────
    // MEASURED, and it is why there are three bursts instead of two and why they
    // are longer: taking the up-aim off the two side sprigs (see
    // `buildSilhouetteEvents` — they were reading as ears) cost this character
    // **13 px of rendered height at the shipped facing, 152 -> 139**, because the
    // taller sprig was the top of the silhouette. That is a real loss of presence
    // and it must not be paid for by putting a pointed mass back at the side. The
    // crown of the fold — near CENTRE, where nothing can be mistaken for an ear —
    // is the correct place to spend it, and it is also what the food does: a
    // taco's filling stands out of the TOP.
    const lettuceSpots: Array<[number, number, number, number, boolean]> = [
      [-0.72, 1.02, 0.12, 0.3, false], [-0.42, 1.13, 0.24, -0.30, true], [-0.10, 1.04, 0.04, 0.25, false],
      [0.20, 1.15, 0.22, -0.34, true], [0.52, 1.04, 0.06, 0.2, false], [0.74, 1.00, 0.16, -0.25, false],
      [-0.56, 1.00, 0.28, 0.1, false], [0.36, 0.99, -0.04, -0.1, false],
      [-0.06, 1.11, 0.30, 0.18, true],
    ];
    for (let i = 0; i < lettuceSpots.length; i++) {
      const [fx, fy, fz, tilt2, burst] = lettuceSpots[i];
      // A flat RIBBON, not a capsule. Shredded lettuce is a thin cut strip; a
      // rounded rod of the same length and colour is a green bean, which is the
      // other half of Uri's "looks like fruit" — the palette was never the problem.
      const shred = new THREE.Mesh(
        // Narrower than the first ribbon pass: at 0.090R wide by 0.52R long the
        // bursts rendered as flat green BARS across the crown. A shred is thin.
        roundedBox(R * (burst ? 0.072 : 0.058), R * (burst ? 0.48 : 0.30), R * 0.018, R * 0.009, 2),
        i % 2 === 0 ? lettuceMatA : lettuceMatB
      );
      shred.name = 'taco_lettuce';
      shred.position.set(fx * halfWTop, fy * troughLen, fz * R);
      // Bursts stand up but are RAKED, not vertical — three dead-upright green
      // strips read as candles on a cake rather than as leaves. Raked HARDER than
      // before (0.55 -> 0.40) now that they are the tallest thing on the character:
      // a vertical spike at the crown is the "crown" silhouette this file spent two
      // rounds getting rid of, and a rake keeps the same height at a shallower angle.
      shred.rotation.set(burst ? 0.40 : Math.PI / 2 + tilt2 * 0.6, 0, tilt2 + (burst ? tilt2 * 2.2 : 0));
      shred.castShadow = true;
      shred.receiveShadow = true;
      troughPivot.add(shred);
      this.fillings.push(shred);
      this.fillingBaseRotZ.push(shred.rotation.z);
    }

    // A few onion slivers tucked among the meat — ties visually to the Onion Bomb
    // ability's projectile colour, and the only cool-leaning hue in the fold.
    // ⚠️ These were TORUS ARCS — purple rings — and a purple ring is a grape. Same
    // colour, same place, but built as the thin flat slivers a diced red onion
    // actually is. The hue is untouched; it still ties to the Onion Bomb.
    const onionSpots: Array<[number, number, number, number]> = [
      [-0.22, 0.94, 0.30, 0.4], [0.36, 0.96, 0.30, -0.8], [0.06, 0.90, 0.34, 1.1],
      [-0.50, 0.92, 0.16, -0.3], [0.58, 0.92, 0.34, 0.9],
    ];
    for (const [fx, fy, fz, roll] of onionSpots) {
      const sliver = new THREE.Mesh(roundedBox(R * 0.135, R * 0.052, R * 0.022, R * 0.011, 2), onionMat);
      sliver.name = 'taco_onion';
      sliver.position.set(fx * halfWTop, fy * troughLen, fz * R);
      sliver.rotation.set(0.4, 0.7 + roll, fx);
      sliver.castShadow = true;
      sliver.receiveShadow = true;
      troughPivot.add(sliver);
      this.fillings.push(sliver);
      this.fillingBaseRotZ.push(sliver.rotation.z);
    }

    // ── Face: ON THE SHELL, not beside it ────────────────────────────────────
    // The brief's 2D note ("the face floats outside the shell to the side") was
    // implemented literally as a separate sphere fused to the shell's right
    // edge. Rendered, that is not a quirk, it is a SECOND HEAD: a smooth pale
    // ball with two eyes and a grin, sitting next to a large brown mass, which
    // the eye reads as the character and the shell as scenery it is carrying.
    // Nothing about "taco" survived that read.
    //
    // The face goes where a character's face goes — front and centre on the
    // biggest surface it owns, which after the lean fix above is the front wall
    // and is now lit. The wall's slight backward tilt aims the face up toward a
    // camera pitched 58 degrees down, so it presents MORE area than a vertical
    // face would, not less. A soft cheek pad keeps the features from sitting on
    // a dead-flat plane.
    // Sits low, in the BOWL of the U, where the wall is solid. The rim above it
    // now dips toward the centre, so a face placed any higher would run out of
    // wall in the middle of its own forehead.
    // ── STATED IN R, NOT AS A FRACTION OF THE WALL ─────────────────────────────
    // WAS `yBot + (frontTopY - yBot) * 0.34`. A fraction of the wall height means the
    // face moves whenever the wall's BOTTOM moves — and the wall's bottom is now a
    // burial depth (`shellBotY`), a number chosen against the torso and having nothing
    // to do with where a face belongs. `burrito.ts` records the same class of bug on
    // its spill anchors: *"a constant that means a different height depending on what
    // else exists is not a constant."*
    //
    // -0.26R keeps the pad's crown 0.133R under the near rim, which is the clearance
    // the after-1 capture had; a face that stays put under a rim that rises is a face
    // at the bottom of a hood, and that is the MUZZLE read arriving from the other
    // direction.
    const faceY = -R * 0.26;
    const faceZ = panelThickness / 2;

    // Cheek pad: a shallow lens of slightly lighter shell proud of the wall, so
    // the face area has its own soft form under the features instead of reading
    // as decals on a flat card.
    // Domed harder than the first pass (0.20 → 0.34). A critic reading the flat
    // version said the face "looks like a decal rather than a head — no brow,
    // cheek or jaw form under it", which is what a 0.20 lens on a flat panel
    // gives you: features with correct depth sitting on nothing.
    // `sy` 0.66 -> 0.72. Not taste: the face below now carries three-element eyes
    // (sclera + pupil + catchlight) and a mouth with a real interior, and at 0.66
    // those two stacks did not FIT — the mouth's lowest point sat 0.14R below the
    // pad's own bottom edge and ran onto the bare shell wall immediately above the
    // near-black collar, which is the fusion Uri read as a hat brim. The ceiling on
    // this number is the wall: the near wall's rim dips to head-local y -0.006R at
    // centre and the pad's top now reaches -0.046R, so 0.72 is the largest value
    // that keeps the pad inside its own wall. Anything past ~0.74 pokes through it.
    const PAD_R = R * 0.58;
    const PAD = { sx: 1.28, sy: 0.72, sz: 0.26 };
    const cheek = new THREE.Mesh(new THREE.SphereGeometry(PAD_R, 20, 16), podMat);
    cheek.name = 'taco_face_pad';
    cheek.scale.set(PAD.sx, PAD.sy, PAD.sz);
    cheek.position.set(0, faceY, faceZ - R * 0.02);
    cheek.castShadow = true;
    cheek.receiveShadow = true;
    frontMesh.add(cheek);

    // `face` normally rides the head's own front surface; nothing in the rig's
    // per-frame animate() ever touches its transform, so re-parenting it onto the
    // front wall (it inherits the fold's tilt) is safe and keeps every feature
    // below in simple wall-local coordinates.
    frontMesh.add(this.rig.joints.face);
    this.rig.joints.face.position.set(0, faceY, faceZ + R * 0.10);
    this.buildFace(PAD_R, { ...PAD, originZ: -R * 0.12 });

    // ── 🚨 THE THIRD ROUND OF THE "HAT", AND THE ONE THAT CLOSES IT ────────────
    // Round 1 recoloured `pal.neck` to `SHELL` so the rig's neck column would stop
    // reading as a dark hat CROWN. Round 2 hung the shell wall 0.15R lower to cover
    // it. Round 3 grew a masa JAW to enclose it, and the render
    // (`shots/ca/after3/taco.png`) turned that into a pale saucer under the chin.
    // Three rounds, three renders, and the column was in frame in all three, because
    // every one of them attacked the wrong axis:
    //
    //   the column is a cylinder of radius `neckRatio * min(torsoWidth/2, R)` =
    //     0.42 * 0.4069 = **0.171 m**, centred on the rig's own axis, so it reaches
    //     z = +0.171;
    //   this character's FACE is on a wall that leans BACK 0.26 rad about a hinge, so
    //     the cheek pad's own front surface only reaches z = **+0.017**.
    //
    // **The neck stands 0.15 m in front of the face.** It is the closest thing on the
    // model to the camera, and nothing mounted on the face can ever cover it — which
    // is why a colour match failed (`outlineGroup` still draws its edge), a longer
    // wall failed (the wall is behind it), and a jaw failed (a jaw deep enough to
    // reach z 0.171 sticks out further than the face does).
    //
    // So the column goes. `neckFraction: 0` is a supported archetype value —
    // `bodies.ts` gives it to STUB with the same reasoning inverted (*"a neck gap on
    // STUB puts a bright column between two masses... STUB opts out until its masses
    // are carved"*) — and taco's masses ARE carved: the shell now hangs to -1.10R and
    // lands inside the torso fold, so there is no gap for a column to bridge.
    //
    // ⚠️ AND IT IS A NO-OP ON THE HEAD'S SIZE AND PLACEMENT, BY CONSTRUCTION.
    // `neckFraction` is not an isolated knob — `rig.ts:602` subtracts the gap from the
    // head before halving it and `rig.ts:630` mounts the head above it — so dropping
    // it alone would have grown R by 12.7% (a 0.13 m wider shell, straight at
    // `castbox`'s hit-radius margin) and dropped the head 0.115 m. Both are cancelled
    // exactly:
    //
    //     headH = height * headFraction - (2 * neckGap) / (1 + headMount)
    //     0.52 with gap 0.1155, mount 0.88  ->  headH 0.96913, R 0.484565
    //     0.461490 with gap 0, mount X      ->  headH 0.96913, R 0.484565   ✓
    //
    //     headCentreY = torsoTopY + neckGap + R * headMount
    //     before: + 0.1155 + 0.484565 * 0.88   = torsoTopY + 0.541917
    //     after:  + 0      + 0.484565 * 1.118344 = torsoTopY + 0.541917     ✓
    //
    // R, the shell, the fillings, the face and the standing height are byte-identical;
    // only the column and the ring are gone.
    //
    // The ring is not simply deleted, because it was load-bearing twice over: it is
    // the "hard dark occlusion notch under the chin" two blind critics asked for, and
    // it is roughly HALF of this character's darkest 5% (739 delivered px of ~16.4k,
    // measured — against 305 + 285 for both dark limb segments together). Taco builds
    // its own, at the same height and the same near-black, but as a SHADOW rather than
    // a brim: 8.8x wider than it is tall, hugging the shell's underside, with no crown
    // above it to make it a hat.
    //
    // ── ⚠️ SIZED BY MEASUREMENT, AFTER THE FIRST SIZE FAILED THE GATE ──────────
    // The first notch was `scale (1.15, 0.13, 0.62)` and `valuescan --mode chars`,
    // paired on frozen trees, says that is not enough dark: **p05 0.16 -> 0.20
    // against a `<= 0.180` gate**, and `range` 0.710 -> 0.669 with it (the range is
    // P95 - P05, so a lost dark anchor costs both). The collar it replaces presented
    // roughly `pi * (0.246^2 - 0.171^2) * sin 58` = 0.083 m^2 of near-black annulus
    // at the match camera; that notch presented `pi * 0.223 * 0.1066 * sin 58` =
    // 0.063 m^2, i.e. about three quarters of it, and the thinned dark forearms in
    // `dressLimbs` spent the rest.
    // `(1.30, 0.20, 0.95)` gives 0.124 m^2 and measured **p05 0.19** — still over the
    // 0.180 cap, so the collar was carrying more than the projected-area estimate
    // credited it with. It is worth stating why, because it is the useful number: p05
    // is the FIFTH PERCENTILE and the collar was ~739 px of a ~16.4k-px character,
    // i.e. **4.5%** — the collar was very nearly the whole of the darkest 5% by
    // itself, so removing it does not shave the tail, it deletes it and p05 jumps to
    // whatever sat at ~9.5%. Replacing it needs comparable AREA, not a token.
    // `(1.45, 0.34, 1.00)` measured p05 **0.1906** against 0.1902 at `(1.30, 0.20,
    // 0.95)` — i.e. widening it in X bought **nothing**, and that is the useful
    // finding: `valuescan`'s shipped framing is **yaw 90**, a SIDE view, so the axis
    // that projects to screen-horizontal there is **Z, not X**. Half of that growth
    // went into the depth axis of the camera measuring it. Read the value matte
    // (`shots/ca/vl-after3/chars/taco.shipped.value.png`) and the notch is plainly the
    // largest dark mass on the figure — it was never invisible, it was growing along
    // the one axis the number could not see. `docs/LESSONS.md` §6: ask what the
    // metric can EXPRESS before concluding a change did nothing.
    // `(1.30, 0.40, 1.55)` cleared the gate — p05 **0.1774** — and the lobby render
    // rejected it: a 0.50 x 0.16 x 0.60 m near-black ellipsoid hanging under the chin
    // is a bow tie. Both cameras, as the rule requires, and the second one vetoed it.
    //
    // ── SO IT IS A HORIZONTAL PLATE, WHICH IS WHAT A SHADOW ACTUALLY IS ────────
    // A dark mass under a chin has to be dark for the 58-degree gate and nearly
    // invisible from the 20-degree lobby, and those are not in conflict once the
    // notch is oriented instead of merely sized. A horizontal plate presents its FACE
    // to a camera pitched 58 (x sin 58 = 0.85 of its area) and its EDGE to one pitched
    // 20 — a 0.043 m dark line under the shell, which is the "hard dark occlusion
    // notch under the chin" two blind critics asked for, drawn as a line rather than
    // as an object.
    //   58 deg:  pi * 0.301 * 0.242 * sin 58 = **0.194 m^2** of near-black
    //   20 deg:  a 0.60 m x 0.043 m edge, tucked under the shell's own bottom
    // X is held at 0.62R, just inside the shell outline's own 0.636R half-width at
    // this height, so it never breaks the silhouette sideways; Z is pulled back to
    // -0.12R so the plate sits under the wall rather than in front of it.
    const notch = new THREE.Mesh(new THREE.SphereGeometry(R * 0.40, 22, 12), meatDarkMat);
    notch.name = 'taco_chin_notch';
    notch.scale.set(1.55, 0.11, 1.25);
    notch.position.set(0, -R * 1.02, -R * 0.12);
    notch.castShadow = true;
    notch.userData.noOutline = true;   // already the darkest thing on the model
    head.add(notch);

    // ── Torso: a second, smaller shell fold, not the rig's bare default ball ──
    // Taco never authored a torso, so it was rendering the shared rig's plain
    // default sphere underneath its shell head — on a cast where every other
    // character dresses its torso, an undressed default ball is exactly the
    // "one templated body" tell a second independent art-director pass warned
    // about, and the most obvious one in the whole roster. This is the same
    // trapezoid, crimped-top fold language as the head shell and the face pod,
    // just smaller, so the body keeps building on the same food identity instead
    // of exposing the shared rig underneath it.
    this.rig.dressTorso((size) => {
      const group = new THREE.Group();
      group.name = 'taco_torso_fold';
      const halfWTopT = size.w * 0.52;
      const toothHT = size.h * 0.05;
      const shapeT = tacoShellShape(halfWTopT, 0, size.h * 0.82, 0.24, toothHT);
      const thicknessT = size.d * 0.85;
      const geoT = new THREE.ExtrudeGeometry(shapeT, { depth: thicknessT, bevelEnabled: false, curveSegments: 1 });
      geoT.translate(0, 0, -thicknessT / 2);
      geoT.computeVertexNormals();
      // ⚠️ A deeper toasted tone was tried here and reverted — see the block above
      // `SCLERA`. It took `weakBoundaryPct` from 8.2 to 19.1 against a cap of 15.
      const mesh = new THREE.Mesh(geoT, shellMat);
      mesh.name = 'taco_torso_fold_mesh';
      mesh.castShadow = true;
      mesh.receiveShadow = true;
      group.add(mesh);

      // ── Costume: serape sash + chili charm ────────────────────────────────
      // A second independent art-director pass named the total absence of any
      // worn costume/accessory layer as the cast's single biggest remaining gap.
      // A striped serape sash slung diagonally across the shell — the classic
      // Mexican-blanket read — breaks the torso's trapezoid silhouette with a
      // hard diagonal line the shape itself doesn't have, and the chili charm
      // dangling off its low end is the small worn detail underneath it.
      const sashColors = [SERAPE_PALE, '#F5EAD6', '#2E8C86', SERAPE_PALE, '#F5EAD6', '#2E8C86', SERAPE_PALE]
        .map((c) => toonMat({ color: c, roughness: 0.72 }));
      // Endpoints pulled in from 0.85/0.68 and lifted off the hip line: with the
      // band's own width added perpendicular to its run, the old anchors put both
      // ends outside the torso silhouette and the low end down among the thighs,
      // so the sash read as a separate object slung over the character rather
      // than as cloth lying on it.
      const sashA = new THREE.Vector3(-halfWTopT * 0.66, size.h * 0.90, thicknessT * 0.56);
      const sashB = new THREE.Vector3(halfWTopT * 0.52, size.h * 0.16, thicknessT * 0.56);
      const sashDir = sashB.clone().sub(sashA);
      const sashLen = sashDir.length();
      sashDir.normalize();
      // Narrowed from 0.30w. At that width the seven-stripe band was wider than
      // the torso is deep and ran the full diagonal of the body, so the serape
      // — an accessory — was the single largest block of colour on the
      // character and covered the shell fold it is supposed to decorate. A sash
      // reads as a sash because it is NARROW against what it crosses.
      const sashWidth = size.w * 0.19;
      const sashQuat = new THREE.Quaternion().setFromUnitVectors(new THREE.Vector3(0, 1, 0), sashDir);
      const segCount = 7;
      const segLen = (sashLen / segCount) * 1.18; // slight overlap so segments read as one continuous band
      for (let i = 0; i < segCount; i++) {
        const t = (i + 0.5) / segCount;
        const center = sashA.clone().lerp(sashB, t);
        const seg = new THREE.Mesh(
          roundedBox(sashWidth, segLen, thicknessT * 0.14, sashWidth * 0.1, 2),
          sashColors[i % sashColors.length]
        );
        seg.name = 'taco_serape_stripe';
        seg.position.copy(center);
        seg.quaternion.copy(sashQuat);
        seg.castShadow = true;
        seg.receiveShadow = true;
        group.add(seg);
      }
      // Fringe tassels along the sash's low end.
      for (let i = 0; i < 5; i++) {
        const t = (i - 2) / 4;
        const base = sashB.clone().add(new THREE.Vector3(t * sashWidth * 0.85, 0, 0).applyQuaternion(sashQuat));
        const tassel = new THREE.Mesh(new THREE.ConeGeometry(sashWidth * 0.055, sashWidth * 0.42, 6), sashColors[i % sashColors.length]);
        tassel.name = 'taco_serape_tassel';
        tassel.position.copy(base).addScaledVector(sashDir, sashWidth * 0.24);
        tassel.quaternion.setFromUnitVectors(new THREE.Vector3(0, 1, 0), sashDir.clone().negate());
        tassel.castShadow = true;
        group.add(tassel);
      }
      // Chili charm — hangs off the sash's low point on a thin cord.
      const chiliStemMat = toonMat({ color: '#5E8C3B', roughness: 0.6 });
      const chiliMat = toonMat({ color: '#D93A2B', roughness: 0.48 });
      const chiliAnchor = sashB.clone().addScaledVector(sashDir, sashWidth * 0.5);
      const chiliString = new THREE.Mesh(new THREE.CapsuleGeometry(sashWidth * 0.025, size.h * 0.1, 4, 6), chiliStemMat);
      chiliString.name = 'taco_chili_string';
      chiliString.position.copy(chiliAnchor).add(new THREE.Vector3(0, -size.h * 0.06, 0));
      group.add(chiliString);
      const chiliBody = new THREE.Mesh(new THREE.SphereGeometry(sashWidth * 0.22, 10, 8), chiliMat);
      chiliBody.name = 'taco_chili';
      chiliBody.scale.set(0.6, 1.4, 0.6);
      chiliBody.position.copy(chiliAnchor).add(new THREE.Vector3(0, -size.h * 0.15, 0));
      chiliBody.castShadow = true;
      chiliBody.receiveShadow = true;
      group.add(chiliBody);
      const chiliStem = new THREE.Mesh(new THREE.ConeGeometry(sashWidth * 0.06, sashWidth * 0.2, 6), chiliStemMat);
      chiliStem.name = 'taco_chili_stem';
      chiliStem.position.copy(chiliBody.position).add(new THREE.Vector3(0, sashWidth * 0.3, 0));
      chiliStem.castShadow = true;
      group.add(chiliStem);

      return group;
    });

    // ── Limbs: bespoke, not the shared rig defaults ───────────────────────────
    // An independent art director named the rig's identical capsule-arm/ball-hand/
    // wedge-foot kit as the single biggest "template" tell across the whole cast.
    // Taco's limbs are hard shell, not soft dough: faceted (low radial segment
    // count) and flattened into shard-like cross-sections, with a couple of the
    // pod's own crimp teeth glued onto the hand — the same toasted-shell language
    // as the head, not a generic mitt.
    // ── 🚨 AND ALL FOUR CHAINS WERE THE SAME OBJECT, SO TACO WAS A QUADRUPED ───
    // Read `shots/ca/before/taco.png` at the lobby camera: an arm and a leg are the
    // SAME mid-terracotta segment over the SAME near-black segment, at the same
    // thickness, at the same angle. They differed only in the terminal cap — the
    // smallest element on screen — and one of those caps was a purple icosahedron,
    // so the read was four legs, two of them wearing gems.
    //
    // Nothing here needs `rig.ts`: an arm can be told apart from a leg by
    // THICKNESS, by the DIRECTION its value ladder runs, and by carrying a
    // hand-shaped terminal mass. All three are set below, and all three are
    // authored in this file.
    //
    //   arms   thinner (0.72/0.58 of `armRadius` against the legs' 1.06/0.86),
    //          ladder runs mid -> dark -> **PALE MASA MITT**: it ends LIGHT.
    //   legs   thicker, planted, ladder runs mid -> dark -> mid boot: it ends DARK
    //          and wide, on the floor.
    //
    // ⚠️ The old radii (1.05/0.8 and 0.8/0.6 of the slot radius) were tuned against
    // the BROKEN `taperedSegment` above, where the shape that came out was a sphere
    // of `max(rTop, rBot)` regardless — so they are not a baseline worth preserving.
    const limbShellMat = toonMat({ color: LIMB_SHELL, roughness: 0.78 });
    const limbShellDarkMat = toonMat({ color: LIMB_SHELL_DARK, roughness: 0.78 });
    const bootMat = toonMat({ color: BOOT_CHAR, roughness: 0.8 });
    // Soft masa, not hard shell — the mitt is the one part of this character that is
    // NOT fried, which is why it can carry a different value and still be food. It is
    // also warm chroma, and `CLAUDE.md` records warm as the scarce budget on this
    // frame today (0.053 delivered against a 0.072 floor), so a large warm terminal
    // mass is the cheap direction rather than the expensive one.
    const mittMat = toonMat({ color: MITT_MASA, roughness: 0.66 });
    // The Onion Bomb tie moves from the whole fist to a wrist band. It keeps the
    // projectile's colour on the character, and a BAND AT THE WRIST is an
    // arm-exclusive feature — a leg has no wrist — so it pays for itself twice.
    const cuffMat = glossyMat({ color: ONION, roughness: 0.32 });
    this.rig.dressLimbs((part, size) => {
      switch (part) {
        case 'upperArmL': case 'upperArmR': {
          const m = new THREE.Mesh(taperedSegment(size.len, size.radius * 0.72, size.radius * 0.58, 8, size.len * 0.30), limbShellMat);
          m.scale.z = 0.72;
          m.name = `${part}_mesh`;
          m.castShadow = true;
          m.receiveShadow = true;
          return m;
        }
        case 'thighL': case 'thighR': {
          const m = new THREE.Mesh(taperedSegment(size.len, size.radius * 1.06, size.radius * 0.86, 8, size.len * 0.30), limbShellMat);
          m.scale.z = 0.72;
          m.name = `${part}_mesh`;
          m.castShadow = true;
          m.receiveShadow = true;
          return m;
        }
        case 'forearmL': case 'forearmR': {
          const m = new THREE.Mesh(taperedSegment(size.len, size.radius * 0.58, size.radius * 0.46, 8, size.len * 0.22), limbShellDarkMat);
          m.scale.z = 0.72;
          m.name = `${part}_mesh`;
          m.castShadow = true;
          m.receiveShadow = true;
          return m;
        }
        case 'shinL': case 'shinR': {
          const m = new THREE.Mesh(taperedSegment(size.len, size.radius * 0.86, size.radius * 0.70, 8, size.len * 0.22), limbShellDarkMat);
          m.scale.z = 0.72;
          m.name = `${part}_mesh`;
          m.castShadow = true;
          m.receiveShadow = true;
          return m;
        }
        case 'handL': case 'handR': {
          // ── THE PURPLE ICOSAHEDRA READ AS GEMS, NOT AS FISTS ─────────────────
          // `IcosahedronGeometry(radius * 0.92, 0)` is a twenty-faced solid with hard
          // edges, in a saturated violet, hung off a near-black forearm at hip
          // height. At the lobby camera that is a jewel on a stick — two of them,
          // mirrored, which is also why they read as a PAIR of props rather than as
          // hands. The old comment defended the colour ("breaks from the cast's
          // repeated cream/white mitt"); the colour was never the problem, the
          // FACETED SOLID was, and a hand is the one place on a character where the
          // reference is unanimous: big, soft, one silhouette, with a thumb.
          const g = new THREE.Group();
          // Sized off the FOREARM it terminates, not off `handRadius`, for the same
          // reason `soup.ts` records: `handRadius` is an independent rig constant and
          // a hand wider than its own arm is long is an occluder, not a hand.
          // ⚠️ NOT `size.radius`. `dressLimbs` hands the hand slot `m.handRadius`,
          // an independent rig constant (0.095H = 0.1995 m here) that has nothing to
          // do with the arm it terminates — sizing off it is how the old icosahedron
          // ended up 0.367 m across, wider than the whole forearm is long.
          const tipR = this.rig.metrics.armRadius * 0.92 * 0.46;
          const mitt = new THREE.Mesh(new THREE.SphereGeometry(tipR * 1.62, 16, 12), mittMat);
          mitt.position.y = -tipR * 1.25;
          mitt.scale.set(1, 0.94, 0.82);
          mitt.name = `${part}_mesh`;
          mitt.castShadow = true;
          mitt.receiveShadow = true;
          g.add(mitt);
          // Thumb — a stub off the inner-forward quadrant. It is the smallest element
          // here and it is the one that makes the mass NAMEABLE: a rounded blob is a
          // ball, a rounded blob with a thumb is a hand, at any resolution.
          const sx = part === 'handL' ? 1 : -1;
          const thumb = new THREE.Mesh(new THREE.CapsuleGeometry(tipR * 0.46, tipR * 0.72, 4, 8), mittMat);
          thumb.position.set(sx * tipR * 1.15, -tipR * 0.62, tipR * 0.52);
          thumb.rotation.set(0.35, 0, sx * 0.85);
          thumb.castShadow = true;
          g.add(thumb);
          // Wrist cuff — arm-exclusive, and it also hides the join between the dark
          // forearm and the pale mitt so the value jump reads as a garment edge.
          const cuff = new THREE.Mesh(new THREE.TorusGeometry(tipR * 1.06, tipR * 0.26, 8, 16), cuffMat);
          cuff.rotation.x = Math.PI / 2;
          cuff.scale.z = 0.82;
          cuff.castShadow = true;
          g.add(cuff);
          return g;
        }
        case 'footL': case 'footR': {
          // Was a `radius*2.2 x len*0.85 x radius*2.6` slab hung at -len*0.5:
          // 0.45 m across and 0.54 m deep on a 2.1 m character, with its
          // underside 0.21 m BELOW y=0. Two separate defects in one mesh — it
          // read as a house brick rather than a foot, and it broke the "feet at
          // y=0" convention harder than anything else in this cohort (which also
          // inflated every measured height for this character by that 0.21 m).
          const foot = new THREE.Mesh(
            roundedBox(size.radius * 1.85, size.len * 0.55, size.radius * 2.15, size.radius * 0.30, 3),
            bootMat
          );
          // Seated on the floor via `size.groundY` (the joint-local y of the world
          // ground, new on `LimbSize`) rather than by eye. `types.ts` convention #1
          // is "feet at y=0" and the whole cast was 0.08-0.25 m under it; `Math.min`
          // keeps the authored droop as the floor for the value so this can only ever
          // raise a foot, never sink one.
          foot.position.set(0, Math.max(size.groundY + size.len * 0.275, -size.len * 0.26), size.radius * 0.5);
          foot.name = `${part}_mesh`;
          foot.castShadow = true;
          foot.receiveShadow = true;
          return foot;
        }
        default:
          return null;
      }
    });

    this.buildSilhouetteEvents();

    outlineGroup(this.root);
    this.collectFlashTargets();
    this.rig.restPose();
  }

  /**
   * Open eyes with a real white sclera, a dark offset pupil and an explicit
   * catchlight, under a cocked brow; and an open cheeky grin with an interior value
   * step. Built as real shaded geometry with depth, not flat decals.
   *
   * ── WHAT THIS REPLACED, AND WHY IT WAS THE DEFECT ────────────────────────────
   * The old eye was a near-black bead (`PALETTE.ink`, radius 0.27F) with a 0.10F
   * white glint stuck on it, and the old mouth was a `TorusGeometry` arc of the
   * same ink — a painted curve with no interior. Uri ranked seven characters blind
   * and put taco third of three purely on that glint mesh, which is exactly the
   * construction ladder `rules.ts` now records: arc < sphere+specular <
   * sphere+glint < open eye with a catchlight. **Egg is the cast reference and even
   * egg is not enough** — measured, 0% of our eye pixels clear luma 0.85 against
   * the reference plates' 31.1% and 34.1%, because none of these faces had a WHITE
   * in them at all. Three elements per eye, egg's construction, taco's sizing.
   *
   * ── AND THE MOUTH IS LIFTED, WHICH IS THE "HAT" FIX ─────────────────────────
   * The old grin's centre sat at -0.40F with a 0.40F torus radius under it, so its
   * lowest point reached head-local **y -0.977R** against a shell whose own bottom
   * edge is at -1.036R: a wide dark arc riding the very bottom lip of the shell,
   * with the near-black neck collar (`MEAT_DARK`, this character's darkest band)
   * immediately below it. Two dark masses that close together merge into one band,
   * and a wide dark band under a wide gold crescent is **a hat brim** — which is
   * precisely what Uri reported. It was never a missing mouth; it was a fusion.
   * The new mouth's lowest point is at **-0.765R**, a lift of 0.21R, and it has a
   * bright tooth band inside it so the mass is no longer uniformly dark either.
   */
  private buildFace(F: number, pad: { sx: number; sy: number; sz: number; originZ: number }): void {
    const face = this.rig.joints.face;
    const ink = PALETTE.ink;
    const browMat = toonMat({ color: BROW, roughness: 0.7 });
    const scleraMat = toonMat({ color: SCLERA, roughness: 0.28 });
    const pupilMat = toonMat({ color: ink, roughness: 0.22 });
    const lidMat = toonMat({ color: ink, roughness: 0.35 });
    const throatMat = toonMat({ color: THROAT, roughness: 0.45 });
    const toothMat = toonMat({ color: TOOTH, roughness: 0.30 });

    /**
     * Z of the cheek pad's front surface directly in front of (x, y), in
     * `face`-local space. Every feature is placed against this rather than
     * against a guessed constant — the same discipline the shell's own crimp
     * and the sprinkles on `donut.ts` use. Guessing this offset is what buried
     * a brow inside the old face pod and left the sesame seeds on
     * `hamburger.ts` floating, twice.
     */
    const padZ = (x: number, y: number, proud: number): number => {
      const u = x / (F * pad.sx);
      const v = y / (F * pad.sy);
      const d = Math.sqrt(Math.max(0, 1 - u * u - v * v));
      return pad.originZ + F * pad.sz * d + proud;
    };

    // Round 2 defect: at offset 0.4*podR with radii up to 0.46*podR each, the two eyes'
    // combined radius (0.84*podR) exceeded their 0.8*podR separation and they visually
    // fused into one dark mass. Pushed further apart and shrunk slightly so there's a
    // clear gap of bare "skin" between them.
    // An independent art director flagged mismatched pupil sizes elsewhere in this
    // cast as reading like a placement error rather than a deliberate choice. A
    // ~20% size difference between the two eyes here was exactly that: too subtle
    // to clearly read as a wink, easy to mistake for a mistake. Eyes are now the
    // SAME size on both sides; the single raised eyebrow below (over the left eye
    // only) carries the "mischievous, about to throw something spicy" asymmetry
    // instead, and a raised brow is unambiguous in a way a slightly smaller pupil
    // is not.
    //
    // ⚠️ The eye is a GROUP sitting on the pad surface, not four meshes each solving
    // their own `padZ`. The old glint took `padZ(ex, ey, …)` — the surface height at
    // the EYE's centre — while being drawn 0.09F to the side and 0.13F above it, so
    // it was only ever accidentally in front of a curved surface. Everything inside
    // the group is now in eye-local coordinates and cannot drift out of plane.
    const EYE_R = F * 0.285;
    const eyeY = F * 0.14;
    for (const sx of [-1, 1]) {
      const ex = sx * F * 0.46;
      const eye = new THREE.Group();
      eye.name = 'taco_eye';
      eye.position.set(ex, eyeY, padZ(ex, eyeY, F * 0.02));
      face.add(eye);

      // 1. THE SCLERA — and it is sized to be the brightest MASS on the face, not a
      //    highlight on a dark one. Silhouette radius 0.285F x 0.331F per eye, which
      //    is larger than the whole old eye bead was.
      const white = new THREE.Mesh(new THREE.SphereGeometry(EYE_R, 18, 16), scleraMat);
      white.scale.set(1, 1.16, 0.52);
      white.castShadow = true;
      eye.add(white);

      // 2. A DARK PUPIL, OFFSET — outward and a touch low, so there is a gaze. A
      //    centred pupil reads dead even when everything else is right.
      const pupil = new THREE.Mesh(new THREE.SphereGeometry(EYE_R * 0.48, 14, 12), pupilMat);
      pupil.position.set(sx * EYE_R * 0.20, -EYE_R * 0.12, EYE_R * 0.34);
      pupil.scale.set(1, 1.05, 0.50);
      pupil.castShadow = true;
      eye.add(pupil);

      // 3. AN EXPLICIT CATCHLIGHT, offset OPPOSITE the pupil. `flatMat` and
      //    `noOutline`: an inverted hull around a 0.06F sphere would eat it.
      const glint = new THREE.Mesh(new THREE.SphereGeometry(EYE_R * 0.21, 8, 8), flatMat('#ffffff'));
      glint.position.set(-sx * EYE_R * 0.30, EYE_R * 0.40, EYE_R * 0.46);
      glint.userData.noOutline = true;
      eye.add(glint);

      // 4. AN UPPER LID, hugging the inside of the sclera's top edge. This is where
      //    the old "the eye IS an arc" construction goes — demoted from being the
      //    eye to BOUNDING it. Kept thin (tube 0.10 EYE_R) on purpose: the sclera
      //    has to win the value contest inside its own outline.
      const lid = new THREE.Mesh(
        new THREE.TorusGeometry(EYE_R * 0.94, EYE_R * 0.10, 6, 16, Math.PI * 0.74),
        lidMat
      );
      lid.rotation.z = Math.PI * 0.13;
      lid.scale.set(1, 1.16, 0.55);
      lid.position.z = EYE_R * 0.10;
      eye.add(lid);
    }

    // One eyebrow cocked up over the left eye — a mischievous, "about to throw
    // something spicy" look.
    //
    // Thinner and much closer to the eye than the first pass. Two fat brown
    // ovals sitting high and wide on a round pale pad do not read as brows at
    // all: they read as EARS, and the whole face came back as a teddy bear
    // rather than a taco. A brow reads as a brow by being a thin stroke that
    // nearly touches the eye it belongs to.
    // Both brows move UP with the eyes (0.40F -> 0.56F, 0.31F -> 0.50F) and get
    // LONGER (0.32F -> 0.40F). Position is not free here: the eye's top edge is now
    // at 0.47F, so the old 0.40F would have buried the raised brow inside the
    // sclera, and a brow shorter than the eye it sits over reads as a smudge.
    const browX = -F * 0.46;
    const browY = F * 0.56;
    const brow = new THREE.Mesh(
      new THREE.CapsuleGeometry(F * 0.036, F * 0.40, 4, 8),
      browMat
    );
    brow.name = 'brow';
    brow.position.set(browX, browY, padZ(browX, browY, F * 0.04));
    brow.rotation.z = Math.PI / 2 + 0.35;
    brow.castShadow = true;
    face.add(brow);

    // A second, calmer brow over the right eye — flatter, lower, barely angled. A
    // second independent art-director pass flagged bare, brow-less eyes elsewhere in
    // the cast as reading "unfinished" rather than deliberate; this eye now has a real
    // brow too, it's just NOT the one doing the acting, so the mischievous raise above
    // stays unambiguous instead of reading as two brows that happen to differ.
    const browX2 = F * 0.46;
    const browY2 = F * 0.50;
    const brow2 = new THREE.Mesh(
      new THREE.CapsuleGeometry(F * 0.032, F * 0.38, 4, 8),
      browMat
    );
    brow2.name = 'brow';
    brow2.position.set(browX2, browY2, padZ(browX2, browY2, F * 0.04));
    brow2.rotation.z = Math.PI / 2 - 0.06;
    brow2.castShadow = true;
    face.add(brow2);

    // ── The mouth: an OPENING, with an interior value step ────────────────────
    // Three values where the old grin had one, which is the whole point — a lip
    // outline (the inverted hull), a dark throat behind it, and a bright tooth band
    // in front of the throat. A single flat dark curve is a painted mouth; a value
    // step behind the lip is a mouth that is open. Kept crooked (11 degrees) so the
    // cheeky read survives the rebuild.
    // ⚠️ MH read off the rendered lobby PNG, not chosen: at 0.32F the opening was
    // nearly as tall as it was wide and rendered as a dark OVAL — a heavy blob under
    // the eyes rather than a smile, and a big dark mass low on the face is the thing
    // this whole change is trying to stop. A cartoon grin is WIDE AND SHALLOW.
    const MW = F * 0.38;   // half width
    const MH = F * 0.22;   // depth of the smile below its top line
    const mouthX = F * 0.03;
    const mouthY = -F * 0.30;
    const mouth = new THREE.Group();
    mouth.name = 'taco_mouth';
    mouth.position.set(mouthX, mouthY, padZ(mouthX, mouthY, F * 0.03));
    mouth.rotation.z = 0.11;
    face.add(mouth);

    const mShape = new THREE.Shape();
    mShape.moveTo(-MW, 0);
    mShape.quadraticCurveTo(0, -MH * 2, MW, 0);        // the smile, bottoming at -MH
    mShape.quadraticCurveTo(0, MH * 0.30, -MW, 0);     // upper lip, arched gently up
    const mGeo = new THREE.ExtrudeGeometry(mShape, { depth: F * 0.05, bevelEnabled: false, curveSegments: 10 });
    mGeo.translate(0, 0, -F * 0.05);                   // front face flush with the group origin
    const throat = new THREE.Mesh(mGeo, throatMat);
    throat.name = 'taco_mouth_throat';
    throat.castShadow = true;
    mouth.add(throat);

    // The tooth band sits IN FRONT of the throat, not level with it — that parallax
    // is what makes the dark below it read as depth rather than as a second colour.
    // Width and height are bounded by the upper-lip curve above (at x = +/-0.72 MW
    // that curve is at 0.072 MH and the band's corners reach 0.05 MH), so no corner
    // of it can escape the mouth outline and sit on bare cheek as a stray tooth.
    const teeth = new THREE.Mesh(
      roundedBox(MW * 1.44, MH * 0.44, F * 0.055, F * 0.018, 2),
      toothMat
    );
    teeth.name = 'taco_mouth_teeth';
    teeth.position.set(0, -MH * 0.16, F * 0.012);
    teeth.castShadow = true;
    mouth.add(teeth);
  }

  /**
   * SILHOUETTE EVENTS — two lettuce sprigs out of the shell's open top.
   *
   * Taco has the best outline in the cast at the shipped facing (hull deficiency
   * 0.2158, two appendages — already inside the six-plate Brawl Stars band) and the
   * WORST asymmetry between facings: 0.1847 with ZERO appendages at yaw 0, because
   * a folded shell presented square-on is a slab. These are the cheapest fix that
   * is also the most obviously right for the food: a taco's filling sticks out of
   * the top, and this one's did not.
   *
   * Deliberately only two, at different heights and different lengths. The metric
   * counts DISTINCT protrusions, and a fringe of eight would merge into one core
   * under the morphological opening exactly the way hamburger's lettuce frill did.
   *
   * ── 🚨 AND THEY WERE A PAIR OF EARS ─────────────────────────────────────────
   * `azimuth +0.52 PI` and `-0.60 PI` are +/-94 and -108 degrees: one pointed blade
   * sticking out either side of the head at 88% and 80% of its height, aimed OUTWARD
   * AND UP (`out + (0, +0.30, 0)`). That is the exact construction that has now read
   * as an animal five times in this cast — burrito's foil peaks ("looks a bit like a
   * goat"), egg's shell shards ("the ears don't make sense"), hamburger's lettuce,
   * lollipop's cellophane petals, pizza's cheese strands. **It overrides what the
   * shape is made of**, so "but they are lettuce" is not a defence; the burrito's
   * peaks were correctly-authored foil and composed a goat anyway.
   *
   * Fixed with all three of the prescribed remedies at once rather than one:
   *   RE-PLACED    the second sprig from -0.60 PI (mirrored, side) to -0.90 PI
   *                (behind), so the frontal lobby read has ONE protrusion, not a
   *                symmetric pair. A single garnish cannot be a pair of ears.
   *   RE-AIMED     both from `+0.30` up to a negative droop, so they flop out over
   *                the rim the way a filling spills instead of standing up.
   *   RE-SHAPED    `curl` 0.22 -> 0.42, which bends the blade along its length —
   *                "rounded, drooping, continuous" rather than a straight point.
   *
   * ⚠️ This costs the yaw-0 hull number, and knowingly: the sprigs were added here
   * because a folded shell presented square-on is a slab (0.1847 with zero
   * appendages), and moving one behind the head hides it at exactly that facing.
   * Uri's silhouette rule outranks a hull statistic — it is his own report against
   * a metric — and the front sprig still breaks the outline at yaw 0.
   */
  private buildSilhouetteEvents(): void {
    const head = this.rig.joints.head;
    const box = localBounds(head);
    const size = box.getSize(new THREE.Vector3());
    const scale = Math.max(size.x, size.z) * 0.5;

    const sprigMat = toonMat({ color: LETTUCE, roughness: 0.7 });
    const sprigDarkMat = toonMat({ color: LETTUCE_DARK, roughness: 0.7 });
    const spec = [
      // ⚠️ `height01` IS NOT FREE, and the first version of this change proved it:
      // at 0.90 the ray at azimuth 0.62 PI found NO MASS and `massAnchor` fell back
      // to the bounding box, which put a green blade floating off the corner of the
      // head — visible in the render, and the tool said so on the console
      // ("[appendages] no mass at azimuth 1.95 height01 0.90 — anchor fell back to
      // the bounding box"). The head's bbox got TALLER in the same edit (the crown
      // bursts below), so the same fraction reached a height where only thin lettuce
      // lives. Both fractions are now solidly on the shell walls. **A console warning
      // from `massAnchor` is a build failure, not noise** — check for it after any
      // change to either the fractions or the head's extent.
      { azimuth: Math.PI * 0.62, height01: 0.60, len: 0.66, droop: -0.26, mat: sprigMat },
      { azimuth: -Math.PI * 0.90, height01: 0.50, len: 0.46, droop: -0.12, mat: sprigDarkMat },
    ];
    for (const s of spec) {
      const { at, out } = massAnchor(head, box, { azimuth: s.azimuth, height01: s.height01, inset: 0.30 });
      const g = new THREE.Group();
      g.name = 'taco_filling_sprig';
      aim(g, at, out.clone().add(new THREE.Vector3(0, s.droop, 0)).normalize(), Math.PI * 0.5);
      g.add(leafBlade(s.mat, {
        len: scale * s.len, halfWidth: scale * 0.24, thick: scale * 0.03, curl: 0.42, waist: 1.3,
      }));
      head.add(g);
    }
  }

  protected onUpdate(ctx: AnimContext): void {
    this.rig.animate({
      elapsed: this.elapsed,
      move01: ctx.moveSpeed01,
      attack01: this.attackT >= 0 ? this.attackT / this.attackDuration : -1,
      hit01: this.hitT >= 0 ? this.hitT / 0.26 : -1,
      dead01: this.deathT >= 0 ? this.deathT / 0.75 : -1,
    });

    // A faint jiggle through the loose fillings while running — cheap life, matches
    // the run bounce cadence from rig.ts (10.5 rad/s). Set relative to each filling's
    // OWN rest rotation every frame (never accumulated) so it settles cleanly back to
    // rest at move=0 instead of drifting.
    const move = THREE.MathUtils.clamp(ctx.moveSpeed01, 0, 1);
    const wobble = Math.sin(this.elapsed * 10.5) * 0.05 * move;
    for (let i = 0; i < this.fillings.length; i++) {
      this.fillings[i].rotation.z = this.fillingBaseRotZ[i] + wobble * (i % 2 === 0 ? 1 : -1);
    }
  }

  /** The rig owns all body motion; the base class's whole-body pass would fight it. */
  protected applyBaseMotion(): void {}
}
