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
 * one unmistakable landmark, per the brief. Sleepy half-closed eyes (a thick lid
 * stroke over a small peeking pupil) and a small closed-lip smile carry the
 * laid-back, unbothered personality the brief calls out as the most distinctive
 * thing about this character.
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
import { aim, curl, knob, localBounds, massAnchor, rod } from './appendages';
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
/** The torso's bun-shade. Was `PALETTE.bun`; local now, and a value step ABOVE the
 *  head's own mass so `head|torso` stops measuring 0.026 across 128 px. */
const BUN_SHADE = '#E4D6BE';    // luma 0.939 -> 0.844
/** Mitts. Was `PALETTE.sausage`, i.e. exactly the head's sausage, so the hands had
 *  nowhere to separate to. A deeper cured red keeps the meat read and gains a step. */
const MITT_SAUSAGE = '#C4432F';

/** Tapered limb: a flat cap at the joint origin (plugs flush, no gap) taper to a
 * rounded tip — the bun's own matte roughness, no capsule uniformity. */
function taperedLimb(len: number, rTop: number, rBot: number, mat: THREE.Material, segs = 12): THREE.Mesh {
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
  const capTopH = Math.min(rTop * 0.42, len * 0.16);
  const wallBotY = -(len - capBot);
  const wallTopY = -capTopH;
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
      const zzThick = sausR * 0.20;
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

    const LOBE_LEN = R * 1.85;
    const LOBE_H = R * 0.58;
    const LOBE_D = R * 0.56;
    const LOBE_EDGE = R * 0.24;
    const LOBE_DZ = R * 0.32;
    const LOBE_TILT = 0.40;
    const LOBE_Y = NECK_Y + NECK_H / 2 + LOBE_H / 2; // lobes sit right on top of the neck block

    const SAUS_R = R * 0.38;
    const SAUS_MIDLEN = R * 1.70;
    const SAUS_Y = LOBE_Y + LOBE_H / 2 + SAUS_R * 0.35; // nestled into the trough, not floating above it
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
    const KET_DRIPS: Array<{ dx: number; len: number }> = [
      { dx: 0.50, len: 0.10 }, { dx: 0.64, len: 0.15 }, { dx: 0.77, len: 0.09 }, { dx: 0.90, len: 0.13 },
    ];
    for (const d of KET_DRIPS) {
      const dripLen = R * d.len;
      const drip = new THREE.Mesh(new THREE.SphereGeometry(R * 0.065, 8, 8), ketchupMat);
      drip.name = 'ketchup_drip';
      drip.userData.noOutline = true;
      drip.position.set(d.dx * R, LOBE_Y + LOBE_H * 0.74 - dripLen * 0.5, LOBE_DZ + LOBE_D * 0.46);
      drip.scale.set(1, dripLen / (R * 0.065), 0.8);
      drip.castShadow = true;
      head.add(drip);
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
    this.buildSilhouetteEvents(R);

    outlineGroup(this.root);
    this.collectFlashTargets();
    this.rig.restPose();
  }

  /**
   * Sleepy half-closed eyes + small closed-lip smile, built as real shaded
   * geometry (per types.ts convention #6) rather than flat decals.
   *
   * Each eye is a thick horizontal lid stroke with a small dark pupil peeking out
   * just beneath it — the standard "half-closed" cartoon read: a full closed line
   * alone reads as asleep, a full round eye reads as alert, a lid-over-a-sliver
   * reads as exactly the laid-back, unbothered personality the brief calls out.
   */
  private buildFace(R: number, sausY: number, sausR: number): void {
    const face = this.rig.joints.face;
    const ink = PALETTE.ink;

    // The rig's default face offset (0.82R forward) assumes a roughly spherical
    // mass. This sausage's front surface sits much closer to the head origin, so
    // without this override the face would float in empty space in front of it.
    face.position.z = R * 0.38;

    const lidMat = toonMat({ color: ink, roughness: 0.3 });
    // ── The face was too SMALL for the mass carrying it ──────────────────────
    // A blind critic described it as "a tiny face squeezed onto the lower third
    // of the sausage". The sausage is the widest single form in this cohort —
    // roughly 3.7R across — and the features were sized as if it were a normal
    // head, so at the ~10.5% of frame height a player actually sees the character
    // at, the expression was a few pixels of ink on a large red tube. Everything
    // below is scaled up about 35% and the eyes pushed wider apart.
    const eyeY = sausY + sausR * 0.30;

    for (const sx of [-1, 1]) {
      const lid = new THREE.Mesh(new THREE.CapsuleGeometry(R * 0.034, R * 0.20, 4, 8), lidMat);
      lid.name = 'lid';
      lid.rotation.z = Math.PI / 2; // level — a mirrored tilt read as an angry V-brow, not sleepy
      lid.position.set(sx * R * 0.32, eyeY, R * 0.02);
      lid.castShadow = true;
      face.add(lid);

      const pupil = new THREE.Mesh(new THREE.SphereGeometry(R * 0.068, 10, 8), lidMat);
      pupil.name = 'pupil';
      pupil.position.set(sx * R * 0.32, eyeY - R * 0.086, -R * 0.01);
      pupil.scale.set(1, 0.85, 0.7);
      pupil.castShadow = true;
      face.add(pupil);

      // Specular catchlight — cheapest trick for making even a sleepy eye feel alive.
      const glint = new THREE.Mesh(new THREE.SphereGeometry(R * 0.024, 8, 6), flatMat('#ffffff'));
      glint.position.set(sx * R * 0.32 - sx * R * 0.024, eyeY - R * 0.068, R * 0.03);
      glint.userData.noOutline = true;
      face.add(glint);

      // A thin, level brow riding just above the lid — a fresh independent art
      // director's checklist explicitly called for verifying every character has
      // "brows carrying expression," and the sleepy lid alone was doing double duty
      // as both lid and brow. A separate stroke, mustard-toned rather than ink-black
      // so it doesn't fuse into the lid below it, keeps the same level/unbothered
      // angle (no V-tilt) so the laid-back personality isn't disturbed.
      const brow = new THREE.Mesh(new THREE.CapsuleGeometry(R * 0.024, R * 0.19, 4, 8), toonMat({ color: PALETTE.mustard, roughness: 0.4 }));
      brow.name = 'brow';
      brow.rotation.z = Math.PI / 2;
      brow.position.set(sx * R * 0.32, eyeY + R * 0.125, R * 0.01);
      brow.castShadow = true;
      face.add(brow);
    }

    // Small closed-lip smile — calm and symmetric-ish rather than crooked, to
    // match the "laid-back, unbothered" personality rather than a mischievous one.
    const mouth = new THREE.Mesh(
      new THREE.TorusGeometry(R * 0.19, R * 0.036, 8, 16, Math.PI * 0.68),
      lidMat
    );
    mouth.name = 'mouth';
    mouth.position.set(0, sausY - sausR * 0.12, R * 0.05);
    mouth.rotation.z = Math.PI * 1.08;
    mouth.castShadow = true;
    face.add(mouth);
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
  private buildSilhouetteEvents(R: number): void {
    const torso = this.rig.joints.torso;
    const head = this.rig.joints.head;

    // ── The mustard bottle, holstered ─────────────────────────────────────────
    // On the TORSO, not the head, and angled down and out: it has to clear the bun
    // lobes, which is exactly what the sushi belt-chopsticks failed to do.
    {
      const box = localBounds(torso);
      const { at, out } = massAnchor(torso, box, { azimuth: -Math.PI * 0.42, height01: 0.34, inset: 0.05 });
      const g = new THREE.Group();
      g.name = 'hotdog_mustard_bottle';
      aim(g, at, out.clone().multiplyScalar(1.05).add(new THREE.Vector3(0, -0.55, 0)).normalize());
      torso.add(g);
      g.add(rod(glossyMat({ color: PALETTE.mustard, roughness: 0.18 }), {
        len: R * 0.52, rBase: R * 0.115, rTip: R * 0.085,
      }));
      const nozzle = rod(toonMat({ color: HOLSTER_TRIM, roughness: 0.45 }), {
        len: R * 0.18, rBase: R * 0.055, rTip: R * 0.028,
      });
      nozzle.position.y = R * 0.52;
      g.add(nozzle);
      const cap = knob(toonMat({ color: HOLSTER_LEATHER, roughness: 0.5 }), R * 0.085);
      g.add(cap);
    }

    // ── Fried-onion curls ─────────────────────────────────────────────────────
    // ROUND 3, and they exist for the HEAD-ON facing specifically. The bottle and
    // the bandana tail both sit on the character's back quarter, which is the axis
    // that projects to screen-X at the shipped facing and straight into the body at
    // yaw 0 — measured, hotdog came back with 3 appendages in profile and ZERO
    // head-on. These two are on the sausage's own ends, which is the free axis
    // there, and they are the one topping this character was missing.
    {
      const box = localBounds(head);
      for (const [azimuth, k] of [[Math.PI * 0.52, 1.0], [-Math.PI * 0.54, 0.82]] as const) {
        const { at, out } = massAnchor(head, box, { azimuth, height01: 0.62, inset: 0.16 });
        const pts = [
          at.clone(),
          at.clone().addScaledVector(out, R * 0.30 * k).add(new THREE.Vector3(0, R * 0.10 * k, 0)),
          at.clone().addScaledVector(out, R * 0.54 * k).add(new THREE.Vector3(0, -R * 0.06 * k, 0)),
          at.clone().addScaledVector(out, R * 0.52 * k).add(new THREE.Vector3(0, -R * 0.34 * k, 0)),
        ];
        const onion = curl(toonMat({ color: BUN_LIGHT, roughness: 0.66 }), pts, {
          rBase: R * 0.095, rTip: R * 0.045,
        });
        onion.name = 'hotdog_onion_curl';
        head.add(onion);
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
    const bottle = new THREE.Group();
    bottle.name = 'hotdog_mustard_bottle';
    bottle.position.copy(holsterPt).add(new THREE.Vector3(0, pouchH * 0.32, pouchD * 0.15));
    const bottleBody = new THREE.Mesh(new THREE.CylinderGeometry(pouchW * 0.32, pouchW * 0.36, pouchH * 0.55, 10), bottleMat);
    bottleBody.castShadow = true;
    bottle.add(bottleBody);
    const nozzle = new THREE.Mesh(new THREE.ConeGeometry(pouchW * 0.16, pouchH * 0.16, 8), bottleMat);
    nozzle.position.y = pouchH * 0.35;
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

    this.rig.dressLimbs((part: LimbPart, size) => {
      switch (part) {
        case 'upperArmL':
        case 'upperArmR':
          return taperedLimb(size.len, size.radius * 1.28, size.radius * 0.92, bunMat);
        // Lower segments step DOWN a value into `bunDark`. Every limb, hand, boot
        // and the torso were one identical `PALETTE.bun` tan, so the whole body
        // below the head was a single unbroken flat mass with no joint reading at
        // all — the reason it looked naked rather than simply plain.
        case 'forearmL':
        case 'forearmR':
          return taperedLimb(size.len, size.radius * 0.90, size.radius * 0.64, bunDarkMat);
        case 'handL':
        case 'handR': {
          const side = part === 'handL' ? 1 : -1;
          return buildSausageFingers(size.radius, side, sausageMat);
        }
        case 'thighL':
        case 'thighR':
          return taperedLimb(size.len, size.radius * 1.18, size.radius * 0.94, bunMat);
        case 'shinL':
        case 'shinR':
          return taperedLimb(size.len, size.radius * 0.94, size.radius * 0.76, bunDarkMat);
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
