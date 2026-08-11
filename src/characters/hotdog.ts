/**
 * HotDog (Cyber).
 *
 * Built on the shared ChibiRig, following donut.ts as the reference pattern: only
 * the food mass on `rig.joints.head`, the face on `rig.joints.face`, and a palette
 * are authored here — the rig supplies torso, arms, legs, feet and all motion.
 *
 * Read as: a plump sausage nestled in a split bun, its long axis running along the
 * character's LEFT-RIGHT axis (local X) so the full length reads as one broadside
 * silhouette at the default camera instead of foreshortening away down its own
 * length. A bold mustard zigzag traces the sausage's top ridge — the character's
 * one unmistakable landmark, per the brief.
 *
 * ── THE FACE IS OPEN-EYED NOW, AND THE OLD SPEC IS WHY IT WASN'T ─────────────
 * This file used to say "sleepy half-closed eyes (a thick lid stroke over a small
 * peeking pupil)", faithfully implementing `rules.ts`'s old one-line
 * `face: 'Sleepy half-closed eyes'`. `docs/DECISIONS-FOR-URI.md` §42 is the reason
 * that line is gone: Uri ranked seven faces without seeing any code and his ranking
 * matches the `face:` field exactly — every character specified with CLOSED eyes was
 * rated badly ("the worst part", "terrible"), and the one specified with OPEN EYES
 * AND HIGHLIGHTS was rated best. **Eleven agents implemented their line faithfully;
 * the line was the problem.** `rules.ts` now says, for this character, "EYES OPEN,
 * NOT SLEEPY … RELAXED IS A LID ANGLE, NOT A MISSING EYE", and `buildFace` below
 * implements that: a white sclera that is the brightest value on the model, a dark
 * pupil offset down-and-across for a bored gaze, a catchlight in the pupil, the old
 * lid stroke demoted to a drooping lash hood, and a mouth with a real interior.
 *
 * Cyber rarity accent: a pair of small emissive "end caps" seated in the exposed
 * sausage tips, gently pulsing — restrained enough to read as energised food, not
 * a blown-out glow stick.
 */

import * as THREE from 'three';
import { BaseCharacter, type AnimContext } from './types';
import type { CharacterDef } from '../game/rules';
import { PALETTE, RARITY_COLORS } from '../game/rules';
import { toonMat, glossyMat, flatMat, outlineGroup, roundedBox } from '../render/toon';
import { ChibiRig, type LimbPart } from './rig';
import { bodyType } from './bodies';
// `aim`, `rod` and `knob` went with the duplicate mustard bottle — see
// `buildSilhouetteEvents`. `curl` is still the bandana tail's constructor.
import { curl, localBounds, massAnchor } from './appendages';
import { CHARACTER_HEIGHT } from '../units';

const CYBER = RARITY_COLORS.Cyber; // '#00E5B0'

// ── Costume layer ────────────────────────────────────────────────────────────
// A fresh independent art director named the missing costume/accessory layer as
// the TOP gap in the whole cast: without one, characters read as "naked mascot
// body with a themed head glued on" no matter how good the body sculpt is. A
// leather mustard-bottle holster slung on a bandolier strap is this character's
// silhouette-breaking item — it projects past the body outline at the hip the
// way a cape or backpack does on the reference roster — plus a knotted bandana
// at the neck as a smaller "patterned fabric panel" detail.
const HOLSTER_LEATHER = '#1E1006';   // near-black leather — part of the dark rung, see LIMB_BUN_DARK
const HOLSTER_TRIM = '#140A04';
const HOLSTER_BUCKLE = '#C9A227';
const BANDANA_TRIM = '#132532'; // the one cool accent on an otherwise all-warm body
const GRILL_MARK = '#7A4A1E';   // toasted griddle stripes on the bun
/**
 * Limb-only tones. Every limb, hand, boot AND the torso used to be exactly
 * `PALETTE.bun` — the same colour as the head's own bun — so the whole figure
 * below the neck was one flat orange column with no joints and no separation
 * from the food mass. These lean toward the sausage's own red rather than
 * repeating the neutral toasted tan `hamburger.ts` uses, so the two warm-bodied
 * characters in this cohort do not converge on one limb colour a third time.
 */
// ── Figure/ground: this character fails the project's own >= 0.10 floor ───────
// Measured at shipped framing (`tools/tmp/shipframe.mjs`): edge luma minus a 4px
// surround ring = **0.0740**, against donut 0.2063 and pizza 0.1926. A rim-light
// sweep across 0 / 0.85 / 1.70 / 3.40 / 6.0 / 10.0 moved it by at most **0.0000**
// and went NEGATIVE past 3.4, because the rim lights the floor faster than it
// lights the fighter. There is no lighting setting that fixes this — the body
// simply sits at luma 0.424 against a floor at 0.325, and separation you do not
// have in the albedo cannot be added later.
//
// So the values move. The bun is the largest area on the character and was
// PALETTE.bun (#E8A33D, luma 0.67) with limbs at #BE7040 (luma 0.49) — the limbs
// were the problem, sitting only 0.16 above the floor across a third of the
// silhouette. Both limb tones go up roughly a value step; the sausage stays
// exactly where it is because the red IS the identity and it is a minority of
// the area.
// ── …and the second half of the same problem: no dark rung ───────────────────
// The paragraph above lifted the limbs to buy figure/ground and it worked, but it
// left this character sitting entirely inside a 0.40-0.49 luma band: `head|torso`
// measured 0.026 across 128 px and `face|head` 0.035 across 70 px. Everything was
// one value. HotDog is the only character in the cast that needed BOTH ends moved
// at once, so both move here and the net mean luma goes UP, not down:
//
//   bun (20.2% of the character)  -> a genuinely near-white baked crust
//   torso bun-shade (7.6%)        -> the same, so the apron reads as cloth not crust
//   forearms/shins/boots (6.2%)   -> near-black griddle char, the dark rung
//   holster + bandana             -> near-black
//   the SAUSAGE does not move     -- the red is the identity and it was already the
//                                    cast's best P05 (0.183)
//
// Measured at pot_south, shipped framing: range 0.622 -> 0.732, p05 0.183 -> 0.174,
// steps@0.10 6 -> 8, and figure/ground 0.111 -> **0.129** — the one character where
// the value work BOUGHT separation instead of spending it.

// ── PASS 2: the limb CHAIN has to alternate, not ramp ────────────────────────
// The first value pass took both limb tones down together. That fixed range/P05 and
// BROKE the part boundary — measured, `shoulderL|elbowL` 0.044, `kneeL|footL` 0.035,
// because a chain of four segments each a shade darker than the last is one mass. The
// reference's grammar is alternation: mid sleeve, dark cuff, light glove. So the upper
// segment comes back UP, the lower segment holds the dark, and the boot takes its own
// darkest tone instead of sharing the shin's.
const LIMB_BUN = '#D89A68';        // upper arm / thigh — mid
const LIMB_BUN_DARK = '#5A3418';   // forearm / shin — dark (PASS 3: up a step, the boot below was 0.069 away)
const BOOT_CHAR = '#0A0501';       // boots — darker again
/** A lighter bun than `PALETTE.bun` for THIS character's own mass — see above.
 *  Kept local rather than pushed into the shared palette: Hamburger's bun is not
 *  the one failing the contrast floor, and its stack is tuned around the shared
 *  value. */
/**
 * ── NEAR-WHITE CLIPPING, and this is a measured pixel defect rather than taste ──
 * `sepscan --mode chars` reports the share of a character above luma 0.94 at the
 * shipped camera and shipped facing, and the same code over the six hand-verified
 * Brawl Stars full-body plates gives the band: **0.0072-0.0929, median 0.0249**,
 * p95 0.805-0.9685. An independent critic audit measured the same thing on gameplay
 * plates and got even less headroom — Shelly 0.2%, Barley 0.0%, with empty-floor
 * controls at 0.0%, so it is the character and not the frame.
 *
 * This character measured **8.87%** clipped and p95 **0.9574**.
 *
 * It is the cost `docs/STATE.md` records as cast-mean p95 drifting 0.896 -> 0.923
 * during the value pass, seen at the pixel: the dark rung was won (p05 is now better
 * than both plates) and the light end went with it, onto exactly the top-facing
 * surfaces a 58deg camera sees most of. The fix is albedo, and it is NOT a
 * desaturation — scaling a warm off-white DOWN raises its chroma, which is the
 * direction `docs/LESSONS.md` records as falsified four times in the other one.
 */
const BUN_LIGHT = '#EBDCB8';    // luma 0.951 -> 0.865
/**
 * The torso's bun-shade. Was `PALETTE.bun`; local now, and separated from the head's
 * own mass so `head|torso` stops measuring 0.026 across 128 px.
 *
 * ── 0.844 -> 0.871, and it is buying back a gate key, not taste ──────────────
 * `torso|shoulderL` has been sitting ON the `weakBoundaryPct` gate's hard 0.10 the
 * whole time — 0.1058 before this pass, i.e. 0.0058 of margin against a threshold
 * that any edit to this file moves by more than that. Deleting the duplicate mustard
 * bottle took bright pixels off the torso and pushed it under (0.0954), and two
 * independently-justified additions (a bolder torso zigzag, a bigger holstered
 * bottle) walked it back to 0.0999 and then stalled: the median pixel is a BUN
 * pixel, so the only lever with real authority over `torso.p50` is the bun's own
 * value. `shoulderL` is 0.6720 and does not move, so the torso needs >= 0.7720.
 *
 * ⚠️ It is the TORSO's constant and not `BUN_LIGHT`, deliberately. `BUN_LIGHT` is
 * the head as well, and the block above it records why it was pulled DOWN in the
 * first place (8.87% of the character clipping above 0.94). This lobe is 7.6% of
 * the character and touches nothing else.
 */
const BUN_SHADE = '#EBDDC2';    // luma 0.844 -> 0.871
/** Mitts. Was `PALETTE.sausage`, i.e. exactly the head's sausage, so the hands had
 *  nowhere to separate to. A deeper cured red keeps the meat read and gains a step. */
const MITT_SAUSAGE = '#C4432F';

// ── FACE VALUES, and these are the whole point of this pass ──────────────────
// Measured, cast-wide: **0% of our eye pixels are above 0.85 luma against the
// reference plates' 31.1% and 34.1%** — our faces carried TWO values, the food
// colour and near-black, so the largest and brightest element of a reference face
// was simply absent. Measured on THIS character before the pass, `valuescan --mode
// chars` put `face|head` at dLcontact **0.0794**, i.e. the face barely separated in
// value from the sausage it is drawn on, at 113 delivered pixels.
//
// Three named values fix that, and they are named rather than inlined because the
// FACE is now the character's brightest AND darkest surface at once — the value
// ladder that `valuescan --mode gate` measures runs through this face.
/** Pure white. It has to be the brightest value anywhere on the model — brighter
 *  than `BUN_LIGHT` (#EBDCB8, albedo luma 0.865), which was the previous maximum. */
const SCLERA = '#FFFFFF';
/** The mouth interior. DARKER than `PALETTE.ink` (#1a1224) deliberately: the brief
 *  asks for an "interior value step" so the mouth reads as an opening rather than a
 *  painted curve, and a step needs the throat to be a different value from the lip
 *  drawn around it, not the same ink twice. */
const THROAT = '#12060A';
/** …and the second half of the same step. A near-black hole is still one value; a
 *  lit tongue inside it is what makes the opening read as having depth. */
const TONGUE = '#E2707F';
/** Sweet green relish along the bun's front trough — see `buildSilhouetteEvents`
 *  for why the fried-onion curls it replaces had to go. */
const RELISH = '#7CB518';
const RELISH_DARK = '#5E8C10';

/** Tapered limb: a rounded cap at (or above) the joint origin tapering to a
 * rounded tip — the bun's own matte roughness, no capsule uniformity.
 *
 * `rise` lifts the top cap ABOVE the joint pivot so the segment's apex is buried in
 * whatever mass is above it. Taken from `hamburger.ts`'s `taperedSegment`, which
 * took it from `donut.ts`; see the block in `dressLimbs` for the probe numbers that
 * say how much each slot needs. */
function taperedLimb(len: number, rTop: number, rBot: number, mat: THREE.Material, segs = 12, rise = 0): THREE.Mesh {
  // Points MUST run bottom → top for LatheGeometry's automatic normals to face
  // outward. Getting it backwards was a round 1 defect: the real mesh got
  // face-culled invisible and its outline shell rendered as a solid dark wedge
  // instead of a thin line.
  // Bottom tip is a full rounded hemisphere; the TOP is a shallow dome rather than
  // a hard flat disc — round 2 found that a flat cap, at the angle the rig's rest
  // pose rotates the shoulder/hip to, reads as a flat flag/wing sticking out of
  // the joint rather than blending into it. The dome keeps almost the whole
  // length budget for the actual tapered shaft.
  const capBot = Math.min(rBot, len * 0.45);
  // ⚠️ `min(rTop * 0.42, len * 0.16)` IS `len * 0.16` ON EVERY SLOT THIS FILE USES,
  // and on LANKY that is ~4 cm of dome closing a 15 cm-wide ring — i.e. flat. The
  // lobby render (`shots/cc/before/hotdog_p20.png`, zoomed at
  // `shots/cc/zoom/hd-limbs-before.png`) shows all four upper segments ending in a
  // hard elliptical disc that reads as a cut sausage, not a shoulder. `rise` is the
  // budget that fixes it: the mesh may reach `rise` above the pivot, so the cap can
  // be that much taller and the widest ring simply sits below the pivot.
  const capTopH = Math.min(rTop, rise + len * 0.16);
  const wallBotY = -(len - capBot);
  const wallTopY = rise - capTopH;
  const CAP = 5;
  const pts: THREE.Vector2[] = [];
  for (let i = CAP; i >= 0; i--) {
    const a = (i / CAP) * Math.PI * 0.5;
    pts.push(new THREE.Vector2(capBot * Math.cos(a), wallBotY - capBot * Math.sin(a)));
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

/** A "condiment cuff" — a glossy drizzle ring at the wrist/knee, echoing the
 * mustard zigzag / ketchup drips already established as this character's motif. */
function condimentCuff(y: number, radius: number, thickness: number, mat: THREE.Material): THREE.Mesh {
  const ring = new THREE.Mesh(new THREE.TorusGeometry(radius, thickness, 8, 20), mat);
  ring.name = 'limb_cuff';
  ring.rotation.x = Math.PI / 2;
  ring.position.y = y;
  ring.castShadow = true;
  ring.receiveShadow = true;
  return ring;
}

/**
 * A little sausage-link fist: three short, plump glossy capsule "fingers" bundled
 * side by side instead of round knuckle bumps — a genuinely different hand grammar
 * from a knuckled fist, and one that reads unmistakably as this character's own meat
 * material rather than a recoloured ball.
 */
function buildSausageFingers(R: number, side: 1 | -1, mat: THREE.Material): THREE.Group {
  const g = new THREE.Group();
  const palm = new THREE.Mesh(new THREE.SphereGeometry(R * 0.72, 12, 10), mat);
  palm.scale.set(1.0, 0.9, 0.85);
  palm.position.z = -R * 0.10;
  palm.castShadow = true;
  palm.receiveShadow = true;
  g.add(palm);
  for (let i = 0; i < 3; i++) {
    const fx = (i - 1) * R * 0.46;
    const finger = new THREE.Mesh(new THREE.CapsuleGeometry(R * 0.22, R * 0.52, 4, 8), mat);
    finger.position.set(fx, -R * 0.05, R * 0.42);
    finger.rotation.x = Math.PI / 2 - 0.15;
    finger.castShadow = true;
    finger.receiveShadow = true;
    g.add(finger);
  }
  const thumb = new THREE.Mesh(new THREE.CapsuleGeometry(R * 0.20, R * 0.36, 4, 8), mat);
  thumb.position.set(side * R * 0.62, -R * 0.10, R * 0.05);
  thumb.rotation.set(0.2, 0, side * 0.9);
  thumb.castShadow = true;
  thumb.receiveShadow = true;
  g.add(thumb);
  return g;
}

/**
 * A worn strap: a curved tube from `from` to `to`, bowed out through a control
 * point offset by `bow` — the same bezier-tube technique `soup.ts`'s
 * `buildHandleArc` uses for its bowl-handle arms, reused here for costume
 * webbing that has to read as a draped bandolier rather than a rigid rod.
 */
function strapArc(from: THREE.Vector3, to: THREE.Vector3, bow: THREE.Vector3, radius: number, mat: THREE.Material): THREE.Mesh {
  const mid = from.clone().add(to).multiplyScalar(0.5).add(bow);
  const curve = new THREE.QuadraticBezierCurve3(from, mid, to);
  const m = new THREE.Mesh(new THREE.TubeGeometry(curve, 12, radius, 8, false), mat);
  m.castShadow = true;
  m.receiveShadow = true;
  return m;
}

/** A chunky bun-dark boot with a ketchup-trim sole and cuff, wide and stubby to
 * match the sausage/bun proportions rather than the rig's thin default wedge. */
function buildBunBoot(fw: number, bodyMat: THREE.Material, trimMat: THREE.Material, groundLocalY: number): THREE.Group {
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
  const upper = new THREE.Mesh(roundedBox(fw * 1.0, UPPER_H, fw * 1.36, Math.min(fw * 0.24, UPPER_H * 0.45), 3), bodyMat);
  upper.position.set(0, groundLocalY + SOLE_H + UPPER_H / 2, fw * 0.22);
  upper.castShadow = true;
  upper.receiveShadow = true;
  g.add(upper);

  const sole = new THREE.Mesh(roundedBox(fw * 0.96, SOLE_H, fw * 1.30, fw * 0.07, 2), trimMat);
  sole.position.set(0, soleY, fw * 0.22);
  sole.castShadow = true;
  sole.receiveShadow = true;
  g.add(sole);

  // No separate ankle-cuff ring — the boot's own dark colour against the bun
  // leg already reads as a material break at the ankle without a bolted-on
  // collar (see the dressLimbs() comment for why these were removed cast-wide).
  return g;
}

/**
 * This character's own height, as a multiple of the cast's.
 *
 * It was the metre literal 2.16 until `CHARACTER_HEIGHT` moved. A literal here is
 * a silent opt-out of every cast-wide size decision: six of the eleven carried one,
 * so raising the cast height would have scaled five characters and left six behind.
 */
const H = CHARACTER_HEIGHT * 1.029;

export class HotDogCharacter extends BaseCharacter {
  private rig: ChibiRig;
  private glowMats: THREE.MeshStandardMaterial[] = [];

  constructor(def: CharacterDef) {
    super(def);

    // Head fraction pushed up from the 0.46 default. A horizontal food mass gains
    // far less apex height per unit of R than a round one does — a donut's ring
    // reaches ~1.04R above its own centre, this sausage-on-a-bun only reaches
    // ~0.81R — so R needs to grow a bit to keep total figure height near
    // CHARACTER_HEIGHT instead of the model coming in visibly short.
    this.rig = new ChibiRig({
      palette: {
        limb: LIMB_BUN,
        hand: MITT_SAUSAGE,
        foot: BOOT_CHAR,
        torso: BUN_LIGHT,
        limbRoughness: 0.8,
      },
      // A fresh independent art director scored the cast 4/10 and named the body plan
      // directly: every character took the rig's defaults, so bodies read as identical
      // parts under different heads. HotDog's own head mass is long and HORIZONTAL —
      // per the brief it needs a low, wide stance and stubby limbs underneath to
      // balance that width, or the body reads like a stick holding up a long log.
      // Body: LANKY archetype (see `bodies.ts`) — long thin limbs, tall narrow
      // torso, narrow stance. A hot dog is the roster's other long tube, and the
      // horizontal bun reads far better perched on a tall thin frame than on the
      // squat one it had: the contrast between a WIDE head and a NARROW body is
      // the silhouette, where before both were mid-sized and it read as a log on
      // a lump.
      //
      // `height` runs above the 2.1m norm because this head mass is horizontal —
      // its vertical extent is only ~0.5R above the head origin, not the ~1.0R
      // the rig assumes — so the whole frame is scaled up to land the top of the
      // bun at the cast's standard height. Measured, not guessed: `shoot.mjs
      // --char hotdog` prints the real bounding height.
      // ── ❌ `withoutNeck()` WAS BUILT, RENDERED AND REVERTED HERE. THE NUMBER ──
      // ──    THAT KILLED IT: THE HEAD BECOMES ITS OWN 68,940 px ISLAND ─────────
      // This character has the worst neck column in the cast and the measurement is
      // not in dispute. ABLATED through the shipped lobby path by `25d5579` (column
      // and collar painted `#FF00FF`, captured at `charStage.ts`'s pitch 20, magenta
      // counted, unablated control scores zero): **9,767 px in a 152 x 101 box** —
      // *"a peach column with a hard black ring at its base, between the bun and the
      // torso"*. `shots/nm/neck_before/hotdog_p20.png` shows it plainly. LANKY's
      // `neckFraction: 0.065` is 0.1405 m and this head is a HORIZONTAL sausage
      // whose vertical extent is only ~0.5R above the head origin (see `height`
      // below), so it overhangs almost nothing.
      //
      // 🚨 AND DELETING IT IS STRICTLY WORSE, BECAUSE THE COLUMN IS THE JOIN.
      // `withoutNeck(bodyType(...))` was applied exactly as `bodies.ts` documents,
      // with R and `headCentreY` held IDENTICAL (0.356665 / 1.784190, |Δ| 5.6e-17 —
      // `nm_neck.mjs --against`), and the head then floats clear of the torso.
      // Measured on the shipped path with `tools/tmp/nm_island.mjs` (matte = shipped
      // frame minus the `rig_root`-hidden frame, 4-connected components; its
      // known-bad requires a head lifted 0.6 m to split the matte, and it does):
      //
      //   hotdog, lobby pitch 20   components 1 -> 2   (193,441 body + 68,940 HEAD)
      //   hotdog, match  pitch 58   components 1 -> 1
      //
      // ⚠️ The `bun_neck` block below is NOT the bridge and believing it was is what
      // made this look safe: it is a child of `head`, so it moves with the head and
      // spans nothing. Read `shots/nm/neck_after/hotdog_p20.png` — a hot dog hovering
      // above its own body. Uri has rejected three sheets for "disconnected"; a
      // floating HEAD is the worst available instance of that defect.
      //
      // ⚠️ SO THE MIGRATION IS NOT WRONG, IT IS INCOMPLETE. The missing half is
      // geometry IN THIS FILE — the split-bun torso would have to rise 0.1405 m to
      // meet the head, which is a design round on this character's whole proportion
      // block, not a wrap of one call. Handed over rather than forced at the end of
      // a session. ✅ soup and pizza took the same migration and hold at ONE
      // component at both cameras, because their masses already reach the torso top.
      proportions: bodyType('lanky', {
        height: H,
        // 0.21H -> 0.175H, with `torsoWidth` widened below to meet it. Same defect as
        // burrito: inner edge 0.348 m against a 0.259 m torso half-width, so the right
        // arm detached at run (9,073 px, one stride phase). Both numbers move because
        // moving either one alone leaves an overlap of a few millimetres.
        shoulderWidth: CHARACTER_HEIGHT * 0.196,
        // LANKY's stock torso is 1.15x the shoulder width. On this character the
        // torso is a dressed SPLIT BUN, and at that ratio it came out taller than
        // it was wide and read as a plain capsule instead of two bun halves. A bun
        // needs to be wider than it is deep to read as one at all.
        torsoWidth: CHARACTER_HEIGHT * 0.17 * 1.75,
        // 0.062H -> 0.087H, matching burrito on the same archetype. Small, and
        // measured as small — see the `splay` note in `stance`.
        stanceWidth: CHARACTER_HEIGHT * 0.087,
      }),
      // Slouched and sleepy — weight dropped onto one hip, one shoulder
      // drooping low, head lolling to the side. Distinct from every other
      // character's stance in this file's own cast slice: the only one with a
      // real forward slump and asymmetric shoulder droop.
      // `headTilt` was 0.24 rad — 14 degrees on a food mass that is nearly TWICE
      // as wide as it is tall, so the tilt showed up as the whole sausage sliding
      // off one side of the body and read as drunk rather than sleepy. A wide
      // horizontal mass needs a much smaller angle than a round one to express
      // the same amount of attitude; the slouch is carried by `lean` and the
      // dropped shoulder instead, where it costs the silhouette nothing.
      // `shoulderR` -0.38 swings the right arm ACROSS the body, and it put the
      // right forearm behind the torso bun at 0.216 delivered. -0.12 keeps the
      // asymmetry (this character's lean and twist are authored and deliberate —
      // see `lean: 0.16` below, which is NOT a defect) without burying a limb to
      // get it. `shoulderL` 0.10 is also inward, just mildly; zeroed.
      stance: {
        shoulderL: -0.20, shoulderR: -0.12,
        elbowL: -0.12, elbowR: -0.58,
        twist: 0.22, headTilt: 0.05, headTurn: -0.10,
        hipSway: 0.09, lean: 0.16,
        // HotDog is the character proportions cannot fix and the measurement says
        // so plainly: across ten stance/splay combinations at the shipped facing it
        // moved 0.1787 -> 0.1872, a total of 0.0085, while burrito on the same
        // archetype moved 0.046. The reason is that this character is already a
        // vertical bar whose legs are visible — there is no burial left to undo, so
        // spreading the base buys almost nothing. The splay is kept because it is
        // free and it matches the rest of the cast's footing; the outline work is
        // done by `buildSilhouetteEvents`.
        splay: 0.34,
      },
    });
    this.body.add(this.rig.joints.root);
    this.head = this.rig.joints.head;

    // ── Dressed torso ─────────────────────────────────────────────────────────
    // An audit found HotDog was the last character still rendering ChibiRig's BARE
    // DEFAULT torso — literally the "one templated body reskinned with different
    // heads" the art director scored the cast 4/10 for. A split bun roll carries the
    // head's own language down through the body: two lobes with a mustard seam
    // between them, so the food identity runs the full height of the figure.
    //
    // ── Round 1 rebuild: two fat tan capsules read as BUTTOCKS ───────────────
    // The first split-bun torso used two capsules of radius 0.34w whose combined
    // span (0.62m) was wider than the torso is tall, in exactly the same
    // `PALETTE.bun` tan as every limb, hand and boot on the model. Rendered, the
    // lower two thirds of this character was one continuous unbroken tan mass
    // and the two smooth rounded lobes read unmistakably as a bare backside.
    // The head carries ALL of the red-and-yellow that makes a hot dog a hot dog;
    // the body carried none of it.
    //
    // The fix is the same one the head already uses: put a SAUSAGE in the bun.
    // Narrower lobes, and a glossy red sausage standing proud in the split with
    // its own mustard zigzag down the front. The torso now states the character's
    // identity in its own right, and the vertical red stripe breaks the tan
    // column in both hue and value at the widest part of the silhouette.
    this.rig.dressTorso((size) => {
      const g = new THREE.Group();
      g.name = 'hotdog_torso';

      const bunMat = toonMat({ color: BUN_LIGHT, roughness: 0.85 });
      const bunShadeMat = toonMat({ color: BUN_SHADE, roughness: 0.85 });
      const meatMat = glossyMat({ color: PALETTE.sausage, roughness: 0.3 });
      const seamMat = glossyMat({ color: PALETTE.mustard, roughness: 0.15 });

      const lobeR = size.w * 0.19;
      const lobeLen = size.h * 0.50;
      for (const sx of [-1, 1]) {
        const lobe = new THREE.Mesh(
          new THREE.CapsuleGeometry(lobeR, lobeLen, 6, 16),
          sx > 0 ? bunMat : bunShadeMat
        );
        lobe.position.set(sx * size.w * 0.33, size.h * 0.54, -size.d * 0.06);
        lobe.rotation.z = sx * 0.05;
        lobe.scale.z = 0.9;
        lobe.castShadow = true;
        lobe.receiveShadow = true;
        g.add(lobe);
      }

      // The sausage itself — the whole point of the rebuild. Sits forward of the
      // lobes so it is never swallowed by them at any yaw the game camera uses.
      // Length and centre chosen so the sausage's LOWER cap clears the hip line.
      // A first pass used 0.64h centred at 0.52h, which — once the capsule's own
      // two hemispherical caps are counted — made the mesh taller than the torso
      // itself and pushed its bottom end down to y=0, i.e. between the thighs.
      // Total height here is `sausLen + 2*sausR` and it is kept inside `size.h`.
      // ── Fat enough to BE the chest ───────────────────────────────────────
      // A first pass made this a slim stripe down the middle at 0.20 of the
      // torso width, and a blind critic looking at the result still called the
      // body "untouched default-orange mannequin geometry in the exact same hue
      // and value as the bun". A narrow accent does not change what a body IS.
      // At 0.30 the sausage is the widest single form on the torso and the bun
      // lobes become a jacket at its sides, which is the read: a hot dog whose
      // meat runs all the way down, not a mannequin with a decal.
      const sausR = size.w * 0.30;
      const sausLen = size.h * 0.44;
      const sausCY = size.h * 0.58;
      const sausZ = size.d * 0.20;
      const sausage = new THREE.Mesh(new THREE.CapsuleGeometry(sausR, sausLen, 6, 16), meatMat);
      sausage.name = 'hotdog_torso_sausage';
      sausage.position.set(0, sausCY, sausZ);
      sausage.castShadow = true;
      sausage.receiveShadow = true;
      g.add(sausage);

      // Mustard zigzag down the sausage's front, built the same way as the head's
      // (segments plus joint spheres so the corners have no notch), just running
      // vertically instead of horizontally.
      const zzTop = sausCY + sausLen * 0.46;
      const zzBot = sausCY - sausLen * 0.46;
      const zzAmp = sausR * 0.52;
      // ── 0.20 -> 0.31, and it is paying for a MEASURED gate crossing ──────────
      // Deleting the duplicate mustard bottle (see `buildSilhouetteEvents`) took
      // bright mustard pixels off the TORSO, and mustard sits just above the torso's
      // own median. Measured on one frozen snapshot with only this file differing:
      // torso p50 0.7778 -> 0.7674, and because `shoulderL` did not move at all
      // (0.6720 both sides) `torso|shoulderL`'s whole-part dL fell 0.1058 -> 0.0954,
      // i.e. **across the gate's hard 0.10** on 0.0104 of luma. `weakBoundaryPct` is
      // a contact-weighted COUNT over that hard threshold, so an 86-contact pair
      // flipping took it 11.1% -> 16.3% against a cap of 15 — the exact cliff
      // `valuescan.mjs` documents ("pizza head|torso moved 0.0142 of luma and this
      // moved 33 pp"). The boundary-local measure, which is the perceptual one,
      // moved the OTHER way over the same change: dLcontact 0.0926 -> 0.0981.
      //
      // The repair puts the bright area back where the character wants it anyway.
      // This zigzag is the torso's half of "the one unmistakable landmark" and at
      // 0.20 it was a hairline at lobby distance.
      const zzThick = sausR * 0.31;
      const N = 6;
      const zzPts: THREE.Vector3[] = [];
      for (let i = 0; i < N; i++) {
        const t = i / (N - 1);
        const sign = i === 0 || i === N - 1 ? 0 : (i % 2 === 1 ? 1 : -1);
        const x = sign * zzAmp;
        // Ride the sausage's circular cross-section and push out along its own
        // surface normal, so the stripe stays proud of the meat at every vertex.
        const zOut = Math.sqrt(Math.max(0, sausR * sausR - x * x));
        const n = new THREE.Vector2(x / sausR, zOut / sausR);
        zzPts.push(new THREE.Vector3(x + n.x * zzThick * 0.5, zzBot + t * (zzTop - zzBot), sausZ + zOut + n.y * zzThick * 0.5));
      }
      const jointGeo = new THREE.SphereGeometry(zzThick * 0.55, 8, 8);
      for (const p of zzPts) {
        const j = new THREE.Mesh(jointGeo, seamMat);
        j.name = 'hotdog_torso_mustard_joint';
        j.userData.noOutline = true;
        j.position.copy(p);
        g.add(j);
      }
      const up = new THREE.Vector3(0, 1, 0);
      for (let i = 0; i < zzPts.length - 1; i++) {
        const a = zzPts[i], b = zzPts[i + 1];
        const dir = new THREE.Vector3().subVectors(b, a);
        const seg = new THREE.Mesh(new THREE.CapsuleGeometry(zzThick * 0.5, dir.length(), 4, 8), seamMat);
        seg.name = 'hotdog_torso_mustard_seg';
        seg.userData.noOutline = true;
        seg.position.copy(a).addScaledVector(dir, 0.5);
        seg.quaternion.setFromUnitVectors(up, dir.clone().normalize());
        g.add(seg);
      }

      return g;
    });

    const R = this.rig.headRadius;
    const head = this.rig.joints.head;

    // ── Layout (all fractions of R) ─────────────────────────────────────────
    // `ChibiRig.headCentreY` places the head group's own local origin at
    // `torsoTopY + 0.86 * R`, which assumes a mass that extends roughly
    // symmetrically ± R around that origin (true for a donut ring or a sphere).
    // Round 1 kept the bun close to Y=0 and the whole assembly floated ~0.33m
    // above the torso with visible empty air at the neck. Round 2 fixed that by
    // stretching the bun lobes themselves down to the torso, but a bun that tall
    // reads as one solid box, not a split bun — the landmark got lost.
    //
    // Fix: a separate, narrower "neck" block does the bridging (pinned to
    // -0.90R, which cancels the headCentreY offset almost exactly regardless of
    // R), hidden behind the bun lobes' own footprint from every angle the game
    // camera uses. The lobes themselves stay a moderate, readable height.
    const NECK_W = R * 0.95, NECK_D = R * 0.44, NECK_H = R * 0.34;
    const NECK_Y = -R * 0.90 + NECK_H / 2;

    // ── THE BUN WAS EATING THE FACE, AND THE NUMBER SAYS BY HOW MUCH ───────────
    // `LOBE_H` was 0.58R and the sausage seat 0.35 * SAUS_R. Take the front lobe's
    // top-BACK corner — the edge nearest the sausage, which a 0.40 rad forward tilt
    // makes the highest point on the bun — and project it at the lobby camera's
    // 20-degree pitch: it lands at screen height **-0.047R** relative to the
    // sausage's centre line, at depth 0.148. Solve the same projection for the
    // sausage's own front surface and everything below **dy = -0.124R** is BEHIND
    // the bread. Meanwhile the mustard zigzag's front nodes come down to screen
    // height +0.155R. The usable face field was **0.394R of screen height, and the
    // eyes alone need 0.33R of it.** That is why the old mouth was a comma at the
    // seam and why the rebuilt one rendered and was still invisible: the bound is
    // geometric, and no amount of moving the mouth around inside it helps.
    //
    // Both numbers move together so the head's BOUNDING BOX DOES NOT MOVE AT ALL —
    // and that is the point, because `H` above is tuned so the top of this mass
    // lands at the cast's standard height, and `LOBE_Y` is pinned to the neck block
    // below it. Shortening the lobes by d lowers `LOBE_Y` by d/2 and `SAUS_Y` by d;
    // raising the seat by dk raises `SAUS_Y` by dk * SAUS_R. Choosing
    // d = dk * SAUS_R cancels: bun bottom -0.713R -> -0.716R, sausage top unchanged
    // to three decimals. Only the RATIO of sausage to bread changes.
    //
    // Result: the occluding corner drops to -0.204R and the face field opens to
    // **0.483R** — the eyes keep their size and a real mouth fits under them. It is
    // also the read `rules.ts` asks for in the first place, "a PLUMP sausage nestled
    // in a split bun": the old proportion showed the top 60% of a thin sausage on a
    // deep slab of bread, which is why the bun read as a plank.
    const LOBE_LEN = R * 1.85;
    const LOBE_H = R * 0.42;
    const LOBE_D = R * 0.56;
    // 0.24R -> 0.17R: `roundedBox`'s edge radius has to stay under half the smallest
    // dimension, and half of the new LOBE_H is 0.21R.
    const LOBE_EDGE = R * 0.17;
    const LOBE_DZ = R * 0.32;
    const LOBE_TILT = 0.40;
    const LOBE_Y = NECK_Y + NECK_H / 2 + LOBE_H / 2; // lobes sit right on top of the neck block

    const SAUS_R = R * 0.38;
    const SAUS_MIDLEN = R * 1.70;
    /** Seat depth. 0.35 -> 0.78: the sausage still sits 0.17R behind the lobes' own
     *  inner-top corners, so it is nestled and not perched — see the block above. */
    const SAUS_Y = LOBE_Y + LOBE_H / 2 + SAUS_R * 0.78;
    const SAUS_HALF = SAUS_MIDLEN / 2 + SAUS_R; // half-length including the rounded caps

    // ── Materials — every part gets its own roughness so the model reads as
    // bread + meat + sauce, not one plastic shader repeated in different colours
    // (that was the single biggest criticism of an earlier character here). ───
    const bunMat = toonMat({ color: BUN_LIGHT, roughness: 0.85 }); // dry, matte-baked crust — see BUN_LIGHT
    const sausageMat = glossyMat({ color: PALETTE.sausage, roughness: 0.3 }); // taut, faintly greasy skin
    const mustardMat = glossyMat({ color: PALETTE.mustard, roughness: 0.15 }); // wettest surface on the model
    const ketchupMat = glossyMat({ color: PALETTE.ketchup, roughness: 0.15 });
    const glowMat = toonMat({
      color: CYBER, roughness: 0.4, metalness: 0.3, emissive: CYBER, emissiveIntensity: 0.45,
    });
    this.glowMats.push(glowMat);
    const neckMat = toonMat({ color: BUN_LIGHT, roughness: 0.85 }); // matches the bun exactly — reads as its base, not a separate collar

    // ── Neck block — bridges the bun down to the torso. Narrower than the bun
    // lobes above it, so it stays hidden behind their footprint at every angle
    // the game camera uses; it exists purely so nothing floats. ───────────────
    const neck = new THREE.Mesh(roundedBox(NECK_W, NECK_H, NECK_D, NECK_H * 0.35, 3), neckMat);
    neck.name = 'bun_neck';
    neck.position.set(0, NECK_Y, 0);
    neck.castShadow = true;
    neck.receiveShadow = true;
    head.add(neck);

    // ── Split bun — two lobes tilted apart from a shared seam, sausage nested
    // in the resulting trough. The steep gameplay camera looks down INTO this
    // trough, which is what keeps a horizontal mass from collapsing into an
    // unreadable lump when viewed from above. ────────────────────────────────
    const lobeGeo = roundedBox(LOBE_LEN, LOBE_H, LOBE_D, LOBE_EDGE, 4);
    for (const sz of [1, -1]) {
      const lobe = new THREE.Mesh(lobeGeo, bunMat);
      lobe.name = sz > 0 ? 'bun_front' : 'bun_back';
      lobe.position.set(0, LOBE_Y, sz * LOBE_DZ);
      lobe.rotation.x = sz * LOBE_TILT;
      lobe.castShadow = true;
      lobe.receiveShadow = true;
      head.add(lobe);
    }

    // ── Sausage — long axis along local X (character left-right), so it presents
    // its full broadside silhouette to the default camera instead of foreshortening
    // down its own length. Slightly longer than the bun so the ends peek out. ───
    const sausage = new THREE.Mesh(
      new THREE.CapsuleGeometry(SAUS_R, SAUS_MIDLEN, 6, 16),
      sausageMat
    );
    sausage.name = 'sausage';
    sausage.position.set(0, SAUS_Y, 0);
    sausage.rotation.z = Math.PI / 2;
    sausage.castShadow = true;
    sausage.receiveShadow = true;
    head.add(sausage);

    // ── Mustard zigzag — THE landmark. A chain of thick capsule segments tracing
    // a true triangular zigzag across the sausage's top ridge, each vertex pushed
    // out along the sausage's own surface normal so the stripe sits proud of the
    // meat rather than buried in it (the same trick donut.ts uses for sprinkles
    // sitting flush on its glaze). ───────────────────────────────────────────────
    this.buildZigzagStripe(head, mustardMat, {
      xHalf: LOBE_LEN * 0.43, saY: SAUS_Y, saR: SAUS_R,
      amp: SAUS_R * 0.62, thick: R * 0.08, count: 7,
    });

    // ── Ketchup — a modest cluster of glossy drips down the front lobe near one
    // end. Kept secondary to the mustard zigzag so the silhouette has ONE clear
    // landmark rather than two competing stripes, while still giving the wet
    // ketchup material a visible presence (it owns a real ability, Ketchup Slip).
    //
    // ⚠️ RE-SEATED, and this is a FACE fix rather than a ketchup one. The drips were
    // positioned in HEAD space at `LOBE_DZ + LOBE_D * 0.46` — but the lobe they are
    // meant to be running down is TILTED 0.40 rad, so solving that position back into
    // the lobe's own frame puts it at local y = 0.42 of a box whose half-height is
    // 0.29: they were floating 0.13R clear of the bread, in the trough beside the
    // sausage, at almost exactly the old eyes' height and 0.5R to one side. Read at
    // the lobby camera they were four red beads flanking the right eye.
    //
    // They now live in a group carrying the lobe's transform — the same fix
    // `hotdog_grill_marks` already uses — so they sit ON the crust and hang below
    // the sausage entirely (screen height -0.74R against the sclera's -0.20R).
    const dripGroup = new THREE.Group();
    dripGroup.name = 'hotdog_ketchup_drips';
    dripGroup.position.set(0, LOBE_Y, LOBE_DZ);
    dripGroup.rotation.x = LOBE_TILT;
    head.add(dripGroup);
    //
    // ⚠️ AND THEY HAVE TO STAY OFF THE ROUNDED END. At `dx` 0.46 the outermost drip's
    // centre sits at 0.851R against a lobe half-length of 0.925R — inside the box,
    // but `roundedBox` rolls the front face away over the last `LOBE_EDGE` of it, so
    // rendered and zoomed the last two drips hung in mid-air past the bread's own
    // outline like beads glued on. 0.22-0.36 keeps every drip on flat crust.
    const KET_DRIPS: Array<{ dx: number; len: number }> = [
      { dx: 0.22, len: 0.15 }, { dx: 0.27, len: 0.22 }, { dx: 0.31, len: 0.12 }, { dx: 0.36, len: 0.18 },
    ];
    for (const d of KET_DRIPS) {
      const dripLen = R * d.len;
      const drip = new THREE.Mesh(new THREE.SphereGeometry(R * 0.048, 8, 8), ketchupMat);
      drip.name = 'ketchup_drip';
      drip.userData.noOutline = true;
      drip.position.set(d.dx * LOBE_LEN, LOBE_H * 0.05 - dripLen * 0.5, LOBE_D * 0.50);
      drip.scale.set(1, dripLen / (R * 0.048), 0.8);
      drip.castShadow = true;
      dripGroup.add(drip);
    }

    // ── Cyber accent — small emissive end caps seated in the exposed sausage
    // tips (the spot the bun deliberately doesn't cover), pulsed gently in
    // onUpdate. Placed as caps rather than collar rings: at this X the sausage
    // is already tapering into its rounded end, so a fixed-radius ring would
    // float clear of the surface instead of hugging it. ─────────────────────
    const capGeo = new THREE.SphereGeometry(SAUS_R * 0.55, 12, 10);
    for (const sx of [-1, 1]) {
      const cap = new THREE.Mesh(capGeo, glowMat);
      cap.name = 'cyber_cap';
      cap.userData.noOutline = true;
      cap.position.set(sx * SAUS_HALF * 0.92, SAUS_Y, 0);
      cap.scale.set(0.7, 1, 1);
      head.add(cap);
    }

    this.buildFace(R, SAUS_Y, SAUS_R);
    this.dressLimbs();
    this.buildAccessories(R, head, { LOBE_Y, LOBE_DZ, LOBE_TILT, LOBE_LEN, LOBE_D, LOBE_H });
    this.buildSilhouetteEvents(R, { LOBE_LEN }, SAUS_Y);

    outlineGroup(this.root);
    this.collectFlashTargets();
    this.rig.restPose();
  }

  /**
   * OPEN eyes with a white sclera, an offset pupil, a catchlight in the pupil, a
   * drooping lash hood, and a smile with a real interior — built as shaded geometry
   * (types.ts convention #6), never as decals.
   *
   * ── WHAT WAS HERE, AND WHY IT WAS WRONG ─────────────────────────────────────
   * Each eye used to be "a thick horizontal lid stroke with a small dark pupil
   * peeking out just beneath it", implementing the old `face: 'Sleepy half-closed
   * eyes'` spec exactly. Rendered at the LOBBY camera Uri actually judges
   * (`charStage.ts:451` — pitch 20, subjectFill 0.60) and looked at, that is a
   * yellow mustard bar over a black bar over a 2-px bead: **two hazard-stripe
   * badges, not eyes.** It is the literal thing Uri wrote about the same
   * construction on hamburger — *"drawn lines and not an actual face"*. The pupil
   * was 0.068R and the sclera did not exist at all, so the face carried the food
   * colour and near-black and nothing else.
   *
   * ── WHAT REPLACES IT, ELEMENT BY ELEMENT ───────────────────────────────────
   * `docs/DECISIONS-FOR-URI.md` §40 names Egg as the cast reference (sclera, pupil
   * and highlight as SEPARATE elements) and §42 says even Egg is not far enough —
   * the target is a white sclera that is the brightest value on the whole model.
   *
   *   sclera   a white sphere half-embedded in the meat. Albedo 1.0 against
   *            `BUN_LIGHT` 0.865, so it is the model's brightest lit surface.
   *   pupil    offset DOWN and ACROSS. The offset is the same sign on BOTH eyes,
   *            not mirrored — mirroring gives a cross-eyed doll; one shared
   *            direction is a GAZE, and a bored sideways glance is what carries
   *            "permanently half-awake" now that the eyes are open.
   *   glint    inside the pupil, `flatMat` (unlit), so it is white at every light
   *            angle. A catchlight on the SCLERA — which is what Egg does — is
   *            white on white and invisible; on the pupil it is the thing that
   *            makes an eye read as wet.
   *   lash     the OLD LID STROKE, demoted. It is now a hood covering the top ~40%
   *            of the open eye, rotated so the OUTER corner drops. That is the
   *            whole "relaxed" read: a lid ANGLE over a full eye, not a missing eye.
   *
   * ── THE BROW IS DELIBERATELY GONE, and the reason is geometric ──────────────
   * The old mustard brow was the single worst element on the character at lobby
   * distance — a saturated yellow bar 0.19R long directly above a black bar, which
   * is a warning label. A previous pass added it against an art-director checklist
   * item ("brows carrying expression"), and it cannot simply be re-toned, because
   * there is nowhere to put it: the mustard zigzag rides the sausage's top ridge and
   * its FRONT nodes project to screen-height +0.20R at the lobby camera's 20-degree
   * pitch, while the sclera's top already reaches +0.125R. The 0.08R strip between
   * them is smaller than a brow. **The zigzag owns the space above the eyes**, so
   * the lash hood's angle carries the expression instead — which is exactly what the
   * new spec asks for.
   *
   * ── EVERY FEATURE RIDES THE CYLINDER, and that is not decoration ────────────
   * `face.position.z` is a single flat plane, but this face is drawn on a capsule
   * lying along X whose cross-section falls away fast: a feature 0.25R below the
   * sausage's centre line has its surface 0.094R BEHIND that plane, so the old flat
   * layout floated its lowest features clear of the meat. `onSausage` returns the
   * surface point and its normal, the same trick `buildZigzagStripe` already uses
   * for the mustard.
   */
  private buildFace(R: number, sausY: number, sausR: number): void {
    const face = this.rig.joints.face;
    const ink = PALETTE.ink;

    // The rig's default face offset (0.82R forward) assumes a roughly spherical
    // mass. This sausage's front surface sits much closer to the head origin, so
    // without this override the face would float in empty space in front of it.
    face.position.z = R * 0.38;
    const FACE_Z = face.position.z;

    /**
     * Ride the sausage's circular Y-Z cross-section. `dy` is the offset above the
     * sausage's centre line; the return is the surface point in HEAD-local space
     * plus the pitch that makes a feature face along the surface normal.
     */
    const onSausage = (dy: number) => {
      const d = Math.max(-0.97 * sausR, Math.min(0.97 * sausR, dy));
      const z = Math.sqrt(Math.max(1e-6, sausR * sausR - d * d));
      return { y: sausY + d, z, tilt: Math.atan2(d, z) };
    };

    const scleraMat = toonMat({ color: SCLERA, roughness: 0.28 });
    const inkMat = toonMat({ color: ink, roughness: 0.24 });
    const throatMat = toonMat({ color: THROAT, roughness: 0.6 });
    const tongueMat = glossyMat({ color: TONGUE, roughness: 0.35 });

    // ── The face was too SMALL for the mass carrying it ──────────────────────
    // A blind critic described it as "a tiny face squeezed onto the lower third
    // of the sausage". The sausage is the widest single form in this cohort —
    // roughly 3.7R across — and the features were sized as if it were a normal
    // head. The eyes are now 0.155R spheres at +/-0.42R, which fills the central
    // ~45% of the sausage's own width instead of the old 26%.
    const EYE_X = R * 0.42;
    const EYE_DY = R * 0.115;
    const SCL = R * 0.148;
    /** ONE direction for both pupils. See the header — mirrored is cross-eyed. */
    const GAZE_X = R * 0.030;

    for (const sx of [-1, 1] as const) {
      const s = onSausage(EYE_DY);
      const eye = new THREE.Group();
      eye.name = 'eye';
      eye.position.set(sx * EYE_X, s.y, s.z - FACE_Z);
      eye.rotation.x = -s.tilt;
      face.add(eye);

      const white = new THREE.Mesh(new THREE.SphereGeometry(SCL, 18, 14), scleraMat);
      white.name = 'eye_white';
      // Half in, half out: z-scale 0.62 leaves the sclera bulging 0.096R proud of
      // the meat and buried the same amount, so it reads as an eye set INTO the
      // sausage rather than a bead stuck on it.
      white.scale.set(1, 1.05, 0.62);
      white.castShadow = true;
      eye.add(white);

      const pupil = new THREE.Mesh(new THREE.SphereGeometry(R * 0.074, 14, 12), inkMat);
      pupil.name = 'pupil';
      pupil.scale.set(1, 1, 0.55);
      pupil.position.set(GAZE_X, -R * 0.040, SCL * 0.42);
      pupil.castShadow = true;
      eye.add(pupil);

      // ⚠️ The catchlight was EXACTLY TANGENT to the pupil's rim and it is checked here
      // rather than eyeballed, because the tangent case is the one that renders as a
      // bite out of the pupil at some framings and not at others. Pupil radius
      // R * 0.074; the glint sat at |offset| sqrt(0.034^2 + 0.029^2) = R * 0.0447 with
      // radius R * 0.029, so its outer edge was **R * 0.0737 against a R * 0.074 rim** —
      // 0.0003 of margin, i.e. none. That is the `pizza.ts`/`egg.ts` Pac-Man pupil with
      // the sign of the error flipped by a rounding. Pulled to |offset| R * 0.0374 with
      // radius R * 0.026: outer edge R * 0.0634, a real 14% margin, and still 35% of
      // the pupil's radius so the catchlight keeps its size.
      //
      // ── 🚨 AND THE 14% MARGIN DID NOT CLOSE IT. THE FIX ABOVE NEVER LANDED ──────
      // Read at 12x off the shipped lobby camera (`shots/ey/zoom/hotdog-Leye.png`) the
      // pupil is still a clear "C" with a white bite out of its upper-left, continuous
      // with the sclera. `tools/tmp/ey_pacman.mjs` scores it **0.8356** against
      // burrito's genuinely-whole 0.9679 at a comparable size.
      //
      // The paragraph above measures the right quantity in the wrong SPACE: it is done
      // in the eye's tangent plane, in head radii, and both of the terms that decide
      // this are in PIXELS. `egg.ts` carries the full derivation — the same recipe left
      // the cast reference itself bitten — and the short form is:
      //   BLOOM   `stage.ts` thresholds bloom at 0.80 luma and `flatMat` white is 1.000,
      //           so the highlight glows 2-3 px INTO the rim. **That is an ABSOLUTE
      //           size and hotdog has the SMALLEST pupils in the cast at 21 px**, so
      //           3 px is nearly a third of a radius. This character is the most
      //           exposed to the term and had the second-smallest margin.
      //   BURIAL  the glint's centre sat at `SCL * 0.58` = 0.0858R against a pupil
      //           front face of 0.1029R — buried 0.0171R, so only a 0.0102R sliver
      //           emerged, and an emerging sliver is displaced OUTWARD because the
      //           pupil's surface recedes fastest away from its own apex.
      //
      // So: a flattened LENS just PROUD of the surface, at an in-plane 0.59 rather than
      // 0.86, and the radius takes the extra step this character's pupil size argues
      // for — 0.026 -> 0.024R, still 32.4% of the pupil radius (egg ships 30.8%).
      //   offset  RELATIVE TO THE PUPIL's centre, which sits at y = -0.040R — so the
      //           ABSOLUTE y moves -0.015 -> -0.027, and reading the old pair as an
      //           offset is the trap this line exists to close: (-0.028, +0.025) ->
      //           (-0.015, +0.013), giving 0.268 + 0.324 = **0.592**, a 41% margin.
      //   z       SCL * 0.58 -> SCL * 0.70 (0.1036R) against a front face of 0.1014R at
      //           that offset, i.e. 0.002R proud — it emerges whole.
      const glint = new THREE.Mesh(new THREE.SphereGeometry(R * 0.024, 10, 8), flatMat('#ffffff'));
      glint.name = 'eye_glint';
      glint.position.set(GAZE_X - R * 0.015, -R * 0.027, SCL * 0.70);
      glint.scale.set(1, 1, 0.45);
      glint.userData.noOutline = true;
      eye.add(glint);

      const lash = new THREE.Mesh(new THREE.SphereGeometry(SCL * 1.06, 16, 12), inkMat);
      lash.name = 'eye_lash';
      lash.scale.set(1, 0.46, 0.66);
      lash.position.set(0, SCL * 0.72, R * 0.012);
      // Outer corner DOWN. `rotation.z` is applied in the eye's own frame, so the
      // sign has to mirror: about +Z, a positive angle lifts +X.
      lash.rotation.z = -sx * 0.20;
      lash.castShadow = true;
      eye.add(lash);
    }

    // ── The mouth, and the interior is the point ────────────────────────────────
    // The old mouth was a 0.19R torus arc at `sausY - sausR * 0.12` — right on the
    // seam where the sausage disappears behind the bread, so it rendered and was
    // invisible for the eighteenth time. A first rebuild at `-0.11R` with a 0.132R
    // ring rendered and was STILL invisible: measured against the bun's occluding
    // corner it needed depth 0.351 and had 0.348, and buying the difference with a
    // forward offset would have floated the mouth 0.075R clear of the meat and read
    // as a decal at any yaw. **The fix was the bun proportion, not the mouth** —
    // see the `LOBE_H` block in the constructor. With that field open the mouth sits
    // 0.02R proud on the surface at depth 0.252 against the bun's 0.136.
    //
    // Geometry: a `TorusGeometry` arc has its endpoints at `-r * sin(delta)` and its
    // low point at `-r`, so a 0.66PI arc is a smile whose crescent is 0.49r deep.
    // The interior fills exactly that crescent: an ink lower lip, a throat DARKER
    // than the ink, and a lit tongue inside that. Three values in a shape that used
    // to have one.
    // ⚠️ SIZED FROM A RENDER, NOT FROM TASTE. A first pass at 0.145R with a 0.66PI
    // arc rendered, was visible, and still carried NO interior: read at 5x zoom the
    // whole mouth was 11 x 5 px and the throat, the lip and the tongue resolved into
    // one dark almond. The value step is only a step if there are pixels to put it
    // in. At 0.185R with a 0.78PI arc the crescent is 0.66r deep — 0.122R against
    // the old 0.071R — and the tongue owns its lower 45%.
    const MOUTH_R = R * 0.185;
    const m = onSausage(0);
    const mouth = new THREE.Group();
    mouth.name = 'mouth';
    mouth.position.set(0, m.y, m.z - FACE_Z + R * 0.020);
    mouth.rotation.x = -m.tilt;
    face.add(mouth);

    const lip = new THREE.Mesh(
      new THREE.TorusGeometry(MOUTH_R, R * 0.024, 10, 24, Math.PI * 0.78),
      inkMat
    );
    lip.name = 'mouth_lip';
    // The arc is authored starting at +X and sweeping CCW; rotating it to start at
    // 199.8deg centres it on 270deg — the LOW point — which is a smile. Half a turn
    // out and it is a frown, which is the one sign error worth naming here.
    lip.rotation.z = Math.PI * (199.8 / 180);
    lip.castShadow = true;
    mouth.add(lip);

    const throat = new THREE.Mesh(new THREE.SphereGeometry(R * 0.155, 14, 12), throatMat);
    throat.name = 'mouth_throat';
    throat.scale.set(1, 0.39, 0.30);
    throat.position.set(0, -R * 0.124, R * 0.008);
    mouth.add(throat);

    const tongue = new THREE.Mesh(new THREE.SphereGeometry(R * 0.100, 12, 10), tongueMat);
    tongue.name = 'mouth_tongue';
    tongue.scale.set(1, 0.27, 0.26);
    tongue.position.set(0, -R * 0.157, R * 0.020);
    tongue.userData.noOutline = true;
    mouth.add(tongue);
  }

  /**
   * Chain of thick capsule segments tracing a true triangular zigzag (not a
   * smooth sine wave) across the sausage's curved top. Vertices alternate
   * sideways across the sausage's width while riding its circular cross-section,
   * so the stripe stays glued to the meat's surface instead of cutting a flat
   * chord through it. Small spheres at each vertex fill the joints so the
   * zigzag reads as one continuous stroke rather than a string of separate
   * segments with visible notches at each corner.
   */
  private buildZigzagStripe(
    head: THREE.Group,
    mat: THREE.Material,
    cfg: { xHalf: number; saY: number; saR: number; amp: number; thick: number; count: number }
  ): void {
    const { xHalf, saY, saR, amp, thick, count } = cfg;
    const embed = thick * 0.5;

    const pts: THREE.Vector3[] = [];
    for (let i = 0; i < count; i++) {
      const sign = i === 0 || i === count - 1 ? 0 : (i % 2 === 1 ? 1 : -1);
      const x = -xHalf + (i / (count - 1)) * 2 * xHalf;
      const z = sign * amp;
      const yUp = Math.sqrt(Math.max(0, saR * saR - z * z));
      // (nY, nZ) is the exact unit surface normal in the sausage's Y-Z cross
      // section — pushing each vertex out along it is what keeps the stripe
      // sitting proud of the meat at every point of the zigzag, not just at Z=0.
      const nY = yUp / saR, nZ = z / saR;
      pts.push(new THREE.Vector3(x, saY + yUp + nY * embed, z + nZ * embed));
    }

    const jointGeo = new THREE.SphereGeometry(thick * 0.55, 8, 8);
    for (const p of pts) {
      const joint = new THREE.Mesh(jointGeo, mat);
      joint.name = 'mustard_joint';
      joint.userData.noOutline = true;
      joint.position.copy(p);
      joint.castShadow = true;
      head.add(joint);
    }

    const up = new THREE.Vector3(0, 1, 0);
    for (let i = 0; i < pts.length - 1; i++) {
      const a = pts[i], b = pts[i + 1];
      const dir = new THREE.Vector3().subVectors(b, a);
      const len = dir.length();
      const seg = new THREE.Mesh(new THREE.CapsuleGeometry(thick * 0.5, len, 4, 8), mat);
      seg.name = 'mustard_seg';
      seg.userData.noOutline = true;
      seg.position.copy(a).addScaledVector(dir, 0.5);
      seg.quaternion.setFromUnitVectors(up, dir.clone().normalize());
      seg.castShadow = true;
      head.add(seg);
    }
  }

  /**
   * Costume layer: a mustard-bottle holster on a bandolier strap (the
   * silhouette-breaking item), a knotted bandana at the neck, and toasted
   * grill-mark stripes on the bun lobes — the "texture stripe" surface detail
   * the material-fidelity note calls for, so the bread reads as griddled rather
   * than one flat matte tan.
   */
  /**
   * SILHOUETTE EVENTS — a mustard bottle in the holster and a bandana tail.
   *
   * HotDog is the one character where the proportion levers do essentially nothing:
   * ten stance and splay combinations moved its hull deficiency by 0.0085 in total
   * at the shipped facing, against burrito's 0.046 on the same archetype. It is
   * already a vertical bar with visible legs, so there is no buried limb to
   * recover — its 0.1805 is honest and it is still below the six-plate reference
   * floor of 0.2007. Everything it gains has to come from geometry that leaves the
   * bun sideways.
   *
   * Two, and both are already implied by what this character wears: the holster it
   * has been carrying since the costume pass now has something IN it, and the
   * bandana has a tail. `HOLSTER_LEATHER` and `BANDANA_TRIM` are its own colours,
   * so no new hue enters a deliberately all-warm palette except the cool bandana
   * accent that was already there.
   */
  private buildSilhouetteEvents(R: number, lobe: { LOBE_LEN: number }, sausY: number): void {
    const head = this.rig.joints.head;

    // ── THE MUSTARD BOTTLE USED TO BE BUILT TWICE, AND IT SHOWED ──────────────
    // A second `hotdog_mustard_bottle` lived here — a `rod` anchored by `massAnchor`
    // on the torso at azimuth -0.42PI, i.e. the SAME hip that `buildAccessories`
    // already puts a holster and a bottle on. `massAnchor` skips objects tagged as
    // silhouette events, and the holster is NOT one, so the ray landed on the pouch
    // and the rod was aimed straight through it. Rendered at the lobby camera and
    // looked at: a yellow rod entering the black pouch on one side and a dark cone
    // leaving it on the other.
    //
    // That is exactly Uri's second hamburger reject — *"I don't understand what the
    // silver/grey element that is going in and out of the character"* — which
    // `docs/DECISIONS-FOR-URI.md` §37 diagnoses as a prop INTERSECTING body
    // geometry. One bottle survives, in `buildAccessories`, where the holster that
    // holds it is defined; it is now tipped outward there so it still leaves the
    // body outline, which is the only job this copy was doing.

    // ── Fried-onion curls: REMOVED. They were the ears. ───────────────────────
    // They were added in round 3 for the HEAD-ON facing, anchored at azimuth
    // +0.52PI and -0.54PI — that is `out = (sin, 0, cos)`, so both sat on the
    // sausage's own ends, i.e. one tapered mass projecting out and UP from either
    // side of the head at the same height. `docs/DECISIONS-FOR-URI.md` §40 pattern
    // 1: **two pointed masses either side of a head read as ears or horns, whatever
    // they are made of — five for five** (burrito's foil, egg's shards, hamburger's
    // lettuce, lollipop's cellophane, pizza's cheese). Read in the SILHOUETTE panel
    // rather than the shaded render, which is the only view that answers the
    // question, this character was six for six: a wide head with a horn curling off
    // each corner.
    //
    // And they were §40's other finding as well — **detail added to signal the
    // subject destroying the silhouette that signalled it better.** The one place
    // they could be mounted was the exposed sausage TIPS, which are the two features
    // that say "there is a sausage inside this bun" and are also where the Cyber end
    // caps live. Capping them cost more identity than the curls added.
    //
    // What replaces them obeys the same section's prescription — re-placed ABOVE,
    // ROUNDED, and ASYMMETRIC — and is a stronger hot-dog signal than fried onion:
    // sweet relish along the bun's front trough. It is also the model's only
    // saturated COOL hue, which `docs/LESSONS.md` records as the cheaper half of the
    // chroma problem ("adding cool chroma lowers the warm band's share more cheaply
    // than removing warm chroma does").
    //
    // ⚠️ The CENTRE IS DELIBERATELY EMPTY, and the bound is measured rather than
    // eyeballed. A nub in the trough projects to screen height -0.40R at the lobby
    // camera's 20-degree pitch, which is close to the band the mouth ends in
    // (-0.31R). Only the X axis separates them cleanly, so nothing is mounted inside
    // |x| = 0.68 * LOBE_LEN/2 = 0.63R, which clears the sclera's outer edge at
    // 0.568R.
    {
      const relishMat = toonMat({ color: RELISH, roughness: 0.5 });
      const relishDarkMat = toonMat({ color: RELISH_DARK, roughness: 0.55 });
      // The V between the sausage's flank and the front bun lobe's top face. The
      // lobe is tilted 0.40 rad, so with `LOBE_H` 0.42R its top face at the seam
      // sits at y = sausY - 0.313R, z = 0.402R; a nub centred just above and outside
      // that rests in the groove and touches both without entering either. Checked
      // both ways: 0.011R clear of the lobe's top plane in the lobe's own frame, and
      // 0.083R clear of the sausage's axis against its 0.38R radius.
      const troughY = sausY - R * 0.285;
      const troughZ = R * 0.365;
      const halfLen = lobe.LOBE_LEN * 0.5;
      const NUBS: Array<{ x: number; r: number; dy: number; dz: number; dark: boolean }> = [
        { x: -0.97, r: 0.058, dy: 0.018, dz: 0.010, dark: false },
        { x: -0.83, r: 0.074, dy: -0.006, dz: 0.038, dark: true },
        { x: -0.68, r: 0.056, dy: 0.012, dz: -0.006, dark: false },
        { x: 0.68, r: 0.066, dy: -0.010, dz: 0.030, dark: true },
        { x: 0.82, r: 0.054, dy: 0.014, dz: -0.004, dark: false },
        // Asymmetric by construction: ONE long nub droops over the bun's front lip,
        // on one side only. A matched pair is what the ear read is made of.
        { x: 0.97, r: 0.082, dy: -0.048, dz: 0.062, dark: false },
      ];
      for (const n of NUBS) {
        const nub = new THREE.Mesh(
          new THREE.SphereGeometry(R * n.r, 10, 8),
          n.dark ? relishDarkMat : relishMat
        );
        nub.name = 'hotdog_relish';
        nub.scale.set(1.25, 0.82, 1.0);
        nub.rotation.z = n.x * 0.35;
        nub.position.set(n.x * halfLen, troughY + R * n.dy, troughZ + R * n.dz);
        nub.castShadow = true;
        nub.receiveShadow = true;
        // Tagged, exactly as `appendages.ts:solid()` tags everything it builds:
        // `localBounds` and `massAnchor` both skip tagged meshes, so the bandana
        // tail below still measures the FOOD's box and still casts its anchor ray
        // at the bun rather than stopping on a relish nub. Untagged, the fourth
        // drip landing on the first is the documented failure mode.
        nub.userData.silhouetteEvent = true;
        head.add(nub);
      }
    }

    // ── The bandana tail ──────────────────────────────────────────────────────
    // Off the back of the sausage at head height, where this character is at its
    // widest and nothing is in front of it.
    {
      const box = localBounds(head);
      const { at, out } = massAnchor(head, box, { azimuth: Math.PI * 0.86, height01: 0.30, inset: 0.18 });
      const pts = [
        at.clone(),
        at.clone().addScaledVector(out, R * 0.26).add(new THREE.Vector3(0, -R * 0.06, 0)),
        at.clone().addScaledVector(out, R * 0.52).add(new THREE.Vector3(0, -R * 0.24, 0)),
        at.clone().addScaledVector(out, R * 0.62).add(new THREE.Vector3(0, -R * 0.50, 0)),
      ];
      const tail = curl(toonMat({ color: BANDANA_TRIM, roughness: 0.72, doubleSide: true }), pts, {
        rBase: R * 0.11, rTip: R * 0.035,
      });
      tail.name = 'hotdog_bandana_tail';
      head.add(tail);
    }
  }

  private buildAccessories(
    R: number,
    head: THREE.Group,
    lobe: { LOBE_Y: number; LOBE_DZ: number; LOBE_TILT: number; LOBE_LEN: number; LOBE_D: number; LOBE_H: number }
  ): void {
    // Read off the rig, never hand-mirrored: body proportions come from an
    // archetype (`bodies.ts`) now, so a hardcoded copy of a rig constant goes
    // silently wrong the moment the archetype changes.
    const shoulderWidth = this.rig.metrics.shoulderWidth;
    const torsoH = this.rig.metrics.torsoHeight;

    const holsterMat = toonMat({ color: HOLSTER_LEATHER, roughness: 0.76 });
    const buckleMat = toonMat({ color: HOLSTER_BUCKLE, roughness: 0.32, metalness: 0.5 });
    const bottleMat = glossyMat({ color: PALETTE.mustard, roughness: 0.2 });

    // The dressed split-bun torso (see the constructor's own `dressTorso` call)
    // is custom geometry, not the rig's default barrel. Measuring its REAL
    // half-width off the built mesh (root/hips/torso are all still at their
    // identity rest transform here — `restPose()` runs at the very end of the
    // constructor, so a world-space Box3 on `joints.torso` gives an exact
    // local half-extent) fixed an earlier pass's under-estimate that buried
    // the holster inside the body — but adding a flat clearance margin on TOP
    // of that measurement overshot the other way, pushing the pouch out past
    // the shoulder's own reach so it read as something HELD rather than WORN.
    // The shoulder joint itself (`shoulderWidth`) is already the rig's own
    // "clearly outside the torso" reference every arm uses, so anchoring there
    // — capped against the measured torso only as a safety floor — keeps the
    // holster snug against the body's own side instead of floating at arm's
    // length, right where a hand would otherwise rest.
    this.rig.joints.root.updateMatrixWorld(true);
    const torsoBB = new THREE.Box3().setFromObject(this.rig.joints.torso);
    const torsoHalfW = Math.max(Math.abs(torsoBB.min.x), Math.abs(torsoBB.max.x));

    // Holster pouch: rides at true WAIST height (well above where even a
    // tucked-elbow hand rests) on the LEFT side — the loose, low-hanging arm
    // in this character's own slouched stance — so it can never coincide with
    // where a hand naturally swings.
    const pouchW = shoulderWidth * 0.32, pouchH = shoulderWidth * 0.58, pouchD = shoulderWidth * 0.24;
    const holsterX = -Math.max(shoulderWidth * 0.85, torsoHalfW * 0.82);
    const holsterPt = new THREE.Vector3(holsterX, torsoH * 0.36, shoulderWidth * 0.14);
    const holster = new THREE.Mesh(roundedBox(pouchW, pouchH, pouchD, pouchW * 0.18, 3), holsterMat);
    holster.name = 'hotdog_holster';
    holster.position.copy(holsterPt);
    holster.rotation.z = 0.12;
    holster.castShadow = true;
    holster.receiveShadow = true;
    this.rig.joints.torso.add(holster);

    // Mustard-bottle prop nestled in the holster, nozzle peeking above the pouch.
    //
    // ── THIS IS NOW THE ONLY MUSTARD BOTTLE ON THE MODEL ─────────────────────
    // `buildSilhouetteEvents` built a second one, `massAnchor`-ed onto the torso at
    // the SAME hip. `massAnchor` only skips meshes tagged as silhouette events and
    // the holster is not one, so its ray stopped on the pouch and aimed the rod
    // through it — a yellow rod entering the black pouch on one side and a dark cone
    // leaving it on the other, which is Uri's hamburger reject #2 verbatim
    // ("going in and out of the character"). That copy is gone.
    //
    // Its one real job was breaking the body outline, so this one takes it over:
    // tipped 0.34 rad OUTWARD (the holster sits at -X, and about +Z a positive angle
    // carries the bottle's +Y top toward -X) and seated higher, so the neck and
    // nozzle clear the pouch rim and project past the torso's own edge instead of
    // hiding inside it.
    const bottle = new THREE.Group();
    bottle.name = 'hotdog_mustard_bottle';
    bottle.position.copy(holsterPt).add(new THREE.Vector3(0, pouchH * 0.46, pouchD * 0.15));
    bottle.rotation.z = 0.34;
    // Sized up from 0.32/0.36 x 0.62. Two reasons, one of them measured: this is the
    // "Mustard Blast" character and at the old size the prop was a yellow stub at
    // lobby distance; and the deleted duplicate took bright mustard off the torso,
    // which is what pushed `torso|shoulderL` under the gate's 0.10 (see the torso
    // zigzag note). `pouchW * 0.46` is still inside the pouch's own half-width
    // (`pouchW / 2`), so the bottle grows without breaking back out through the
    // leather — which was the whole defect.
    const bottleBody = new THREE.Mesh(new THREE.CylinderGeometry(pouchW * 0.42, pouchW * 0.46, pouchH * 0.80, 10), bottleMat);
    bottleBody.castShadow = true;
    bottle.add(bottleBody);
    const nozzle = new THREE.Mesh(new THREE.ConeGeometry(pouchW * 0.22, pouchH * 0.26, 8), bottleMat);
    nozzle.position.y = pouchH * 0.53;
    nozzle.castShadow = true;
    bottle.add(nozzle);
    this.rig.joints.torso.add(bottle);

    // Bandolier strap: opposite (right) shoulder, diagonally down the chest to
    // the left-hip holster — the actual silhouette-breaking read. Anchored at
    // natural shoulder height (not up near the neck) and given a real bow so
    // it reads as draped fabric rather than a rigid rod crossing the chest.
    const shoulderPt = new THREE.Vector3(shoulderWidth * 0.60, torsoH * 0.78, shoulderWidth * 0.18);
    const strap = strapArc(shoulderPt, holsterPt.clone().add(new THREE.Vector3(0, pouchH * 0.35, 0)), new THREE.Vector3(-shoulderWidth * 0.15, 0, shoulderWidth * 0.45), shoulderWidth * 0.06, holsterMat);
    strap.name = 'hotdog_bandolier';
    this.rig.joints.torso.add(strap);

    const buckle = new THREE.Mesh(new THREE.CylinderGeometry(pouchW * 0.14, pouchW * 0.14, pouchW * 0.06, 10), buckleMat);
    buckle.name = 'hotdog_holster_buckle';
    buckle.rotation.x = Math.PI / 2;
    buckle.position.copy(holsterPt).add(new THREE.Vector3(0, pouchH * 0.10, pouchD * 0.55));
    buckle.castShadow = true;
    this.rig.joints.torso.add(buckle);

    // ── The bandana is GONE, deliberately ────────────────────────────────────
    // It was a flat, solid, downward-pointing blue triangle mounted on the front
    // centre of an otherwise bare tan body. On a chibi with no clothing anywhere
    // else, that shape in that place reads as UNDERWEAR — it was the first thing
    // the eye landed on in every render, and no amount of retinting fixes a
    // silhouette that specific. It also now sits exactly where the torso sausage
    // and its mustard zigzag do (see `dressTorso`), which is a far stronger
    // statement of who this character is than a neckerchief that never reached
    // the neck. The bandolier + holster below remain as the worn costume layer.
    //
    // Shoulder-strap anchors below still read off the rig, never hand-mirrored.
    const bandanaTrimMat = toonMat({ color: BANDANA_TRIM, roughness: 0.55 });
    // A small knot of the same cool hue survives as a shoulder cord tie, behind
    // the bandolier's upper anchor — keeps one non-warm accent on the body
    // without putting a fabric panel on the character's crotch.
    const knot = new THREE.Mesh(new THREE.SphereGeometry(shoulderWidth * 0.07, 10, 8), bandanaTrimMat);
    knot.name = 'hotdog_strap_knot';
    knot.position.set(shoulderWidth * 0.60, torsoH * 0.78, shoulderWidth * 0.24);
    knot.castShadow = true;
    this.rig.joints.torso.add(knot);

    // Grill-mark stripes on the front bun lobe — built in a group that mirrors
    // the lobe mesh's own transform exactly, so marks land proud of its curved
    // front face rather than floating or sinking into it.
    const grillMat = toonMat({ color: GRILL_MARK, roughness: 0.78 });
    const grillGroup = new THREE.Group();
    grillGroup.name = 'hotdog_grill_marks';
    grillGroup.position.set(0, lobe.LOBE_Y, lobe.LOBE_DZ);
    grillGroup.rotation.x = lobe.LOBE_TILT;
    head.add(grillGroup);
    const markXs = [-0.32, -0.10, 0.14, 0.36];
    for (const mx of markXs) {
      const mark = new THREE.Mesh(new THREE.CapsuleGeometry(R * 0.018, R * 0.30, 3, 6), grillMat);
      mark.name = 'hotdog_grill_mark';
      mark.position.set(mx * lobe.LOBE_LEN, lobe.LOBE_H * 0.05, lobe.LOBE_D * 0.52);
      mark.rotation.set(Math.PI / 2, 0, 0.55);
      mark.userData.noOutline = true;
      grillGroup.add(mark);
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

    // Cyber accent: a gentle "power hum" pulse on the sausage-tip end caps.
    // Restrained amplitude (0.25-0.55) so it reads as tech-flavoured, not a strobe.
    const pulse = 0.4 + Math.sin(this.elapsed * 3.0) * 0.15;
    for (const m of this.glowMats) m.emissiveIntensity = pulse;
  }

  /**
   * Bespoke limbs — an independent art director named the shared snowman-body
   * capsule arms and ball hands as the biggest cast-wide tell. HotDog gets matte
   * bun-coloured tapered limbs, a bundled sausage-link fist instead of a
   * knuckled fist, and a wide stubby boot matching this character's chunky
   * proportions.
   *
   * A previous pass also added a glossy "drizzle cuff" at every shoulder/elbow/
   * hip break plus another on the boot. Stacked across all five bespoke-limb
   * characters that read as mechanical action-figure collars — a worse version
   * of the exact "ball-jointed skeleton" problem this system exists to solve.
   * Removed; the tapered limb's own thickness change plus the colour break into
   * the sausage-link hand/boot already reads as "sleeve ends here" without
   * bolted-on hardware. The mustard/ketchup condiment language still owns the
   * cast's single boldest landmark — the zigzag stripe across the sausage.
   */
  private dressLimbs(): void {
    const bunMat = toonMat({ color: LIMB_BUN, roughness: 0.85 });
    const bunDarkMat = toonMat({ color: LIMB_BUN_DARK, roughness: 0.8 });
    const bootMat = toonMat({ color: BOOT_CHAR, roughness: 0.8 });
    const ketchupMat = glossyMat({ color: PALETTE.ketchup, roughness: 0.15 });
    // MITT_SAUSAGE, not `PALETTE.sausage`: the mitts sat at exactly the head's own
    // sausage value, so `handL` had nowhere to separate to against the forearm above it.
    const sausageMat = glossyMat({ color: MITT_SAUSAGE, roughness: 0.3 });
    // ── The shoulder sleeve, and why it is MUSTARD and not the torso's own bun ───
    // The obvious choice for "make the arm start as part of the body" is `BUN_SHADE`,
    // the torso's own tone. It is the wrong one: `torso|shoulderL` has been sitting on
    // the `weakBoundaryPct` gate's hard 0.10 with 0.0058 of margin (see BUN_SHADE's own
    // block), and painting the shoulder the torso's colour would take that boundary to
    // roughly zero — buying a silhouette read by deleting a value read. Mustard is this
    // character's own condiment language, is already on the torso as the zigzag, and is
    // a step AWAY from both the bun and the limb tan rather than into either.
    const sleeveMat = glossyMat({ color: PALETTE.mustard, roughness: 0.25 });

    this.rig.dressLimbs((part: LimbPart, size) => {
      switch (part) {
        // ── 🚨 ARMS AND LEGS WERE THE SAME OBJECT ───────────────────────────────
        // Before this round all four upper segments were `bunMat` and all four lower
        // segments were `bunDarkMat`, built by ONE helper at radii within 0.10 of a
        // radius of each other (arm 1.28/0.92 -> 0.90/0.64, leg 1.18/0.94 -> 0.94/
        // 0.76). Four identical tan-over-brown chains, differing only in the terminal
        // cap. On this character the arms also hang close to vertical, so the lobby
        // render is a four-legged animal with two small red claws at the front.
        //
        // Two separations, and the `rise` that attaches them. Probe
        // (`tools/tmp/cc_probe.mjs`, body half-width from vertices, HEAD):
        //   upperArmL gap +0.041   upperArmR +0.073   thighL +0.102   thighR +0.044
        // — small gaps, unlike waterbottle's 0.10-0.22, and the thighs' `riseTo` is
        // only 0.02-0.04 m up. So here `rise` IS the lever and no lateral move is
        // needed; the segment radii do the rest.
        //
        //   1. MASS. Arms 1.28 -> 0.98 at the shoulder and 0.90 -> 0.74 at the elbow;
        //      legs 1.18 -> 1.46 and 0.94 -> 1.12. The leg is now half again the
        //      arm's width all the way down, which is the read every quadruped
        //      silhouette test is actually asking about.
        //   2. A SLEEVE. The upper arm carries a cream `bunPaleMat` cuff at the
        //      shoulder — the TORSO's own bun tone, so the arm starts as part of the
        //      body and steps down into limb tan. The legs have no such step, so the
        //      arm chain is three values and the leg chain is two.
        case 'upperArmL':
        case 'upperArmR': {
          const g = new THREE.Group();
          g.add(taperedLimb(size.len, size.radius * 0.98, size.radius * 0.74, bunMat, 12, size.len * 0.30));
          // ⚠️ A segment shorter than its own radius stops being a segment and becomes
          // a bauble — the failure `pizza.ts` records for a `CRUST_RIM` cuff that
          // rendered as a lampshade. This one survives because its two radii are
          // nearly EQUAL (1.02 / 0.94), so the lathe closes into a ball with no rim to
          // catch the eye, where pizza's 1.58-over-the-arm's-1.16 left a wide flat
          // brim. Trimmed 1.16/1.02 -> 1.02/0.94 after rendering: at 1.16 it is 0.28 m
          // across on a 2.1 m character and reads as a tennis ball on the shoulder.
          // 1.02 * `armRadius` = 0.124 still covers the 0.041-0.073 m the probe
          // measures between this joint and the bun.
          const cuff = taperedLimb(size.len * 0.34, size.radius * 1.02, size.radius * 0.94, sleeveMat, 12, size.len * 0.34);
          cuff.name = 'arm_sleeve';
          g.add(cuff);
          return g;
        }
        // Lower segments step DOWN a value into `bunDark`. Every limb, hand, boot
        // and the torso were one identical `PALETTE.bun` tan, so the whole body
        // below the head was a single unbroken flat mass with no joint reading at
        // all — the reason it looked naked rather than simply plain.
        case 'forearmL':
        case 'forearmR':
          return taperedLimb(size.len, size.radius * 0.74, size.radius * 0.54, bunDarkMat, 12, size.len * 0.12);
        case 'handL':
        case 'handR': {
          const side = part === 'handL' ? 1 : -1;
          return buildSausageFingers(size.radius, side, sausageMat);
        }
        case 'thighL':
        case 'thighR':
          return taperedLimb(size.len, size.radius * 1.46, size.radius * 1.12, bunMat, 14, size.len * 0.34);
        case 'shinL':
        case 'shinR':
          return taperedLimb(size.len, size.radius * 1.12, size.radius * 0.86, bunDarkMat, 14, size.len * 0.12);
        case 'footL':
        case 'footR':
          return buildBunBoot(size.len, bootMat, ketchupMat, size.groundY);
        default:
          return null;
      }
    });
  }

  /** The rig owns all body motion; the base class's whole-body pass would fight it. */
  protected applyBaseMotion(): void {}
}
