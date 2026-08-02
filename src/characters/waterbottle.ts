/**
 * WaterBottle (Legendary).
 *
 * Built on the shared ChibiRig — see `donut.ts` for the reference implementation of
 * this pattern. The rig supplies torso, arms, hands, legs, feet and all motion; this
 * file authors only the food mass on `rig.joints.head`, the face and a palette.
 *
 * This is the one genuinely transparent character in the cast, which makes it the
 * most dangerous to get wrong — see `render/toon.ts`'s `glossyMat` for the
 * `transmission` knob. Two decisions matter more than any other here:
 *
 *   1. The plastic shell keeps `transparent: false, opacity: 1` and lets
 *      `transmission` alone do the see-through work. Mixing alpha-blended
 *      transparency with transmission on the same surface is what produces the
 *      "wrong sort order" failure the brief warns about — alpha blending doesn't
 *      write depth, so the character's own limbs and the water inside can draw in
 *      the wrong order frame to frame. Depth-writing transmission avoids that.
 *   2. The water fill is NOT transmissive (transmission: 0). It is a normal glossy
 *      opaque liquid, seen through the transmissive shell around it. Three.js's
 *      transmission pass samples one snapshot of the opaque scene per transmissive
 *      object; nesting two transmissive materials inside each other (shell AND
 *      water both transmissive) makes that snapshot incoherent and one of them
 *      reads as flat or invisible. Keeping the water opaque-but-glossy sidesteps
 *      that entirely and still looks convincingly wet.
 *
 * The default preview background (0x39b7e8, a bright sky blue) is the worst case for
 * a blue translucent character — it is the exact "vanishes against the backdrop"
 * trap the brief calls out. Held off by: a full ink outline on the shell/cap/label
 * (opaque regardless of transmission), a bright near-white label wrap breaking up
 * the transparent mass, a saturated water fill colour distinct from the pale shell,
 * and a dark matte cap anchoring the silhouette.
 *
 * Personality guide (identity is fixed, presentation is not, per the brief):
 *   Translucent blue bottle, darker cap, eyes above the cap, big smile. The floating
 *   eyes read as a deliberate, slightly surreal design choice — kept, and reinforced
 *   with a small sparkle trail linking them back down to the cap so they read as
 *   "this bottle's magic" rather than as detached geometry.
 */

import * as THREE from 'three';
import { BaseCharacter, type AnimContext } from './types';
import type { CharacterDef } from '../game/rules';
import { PALETTE } from '../game/rules';
import { toonMat, glossyMat, flatMat, outlineGroup } from '../render/toon';
import { ChibiRig } from './rig';

// ── Palette ──────────────────────────────────────────────────────────────────
// Reuses the prototype's own water/waterCap hexes for the shell/liquid so the
// character's colours tie directly to its own ability VFX (Water Spray, Cap Shot —
// see `game/rules.ts`), then adds two new tones the prototype palette has no room
// for: a genuinely dark navy for the matte cap/boots, and a near-white for the label.
const PLASTIC = PALETTE.water;      // '#BFEFFF' — pale, almost-white icy blue shell
const WATER = PALETTE.waterCap;     // '#1E90D8' — richer, saturated liquid fill
const WATER_DEEP = '#155F94';       // shaded underside tone, and the fill-line ring
const CAP = '#123A63';              // dark matte navy — the one place the eye can rest
const CAP_DARK = '#0B2A49';
const LABEL = '#F5FBFF';            // wraparound label — near white, breaks up the glass
const LABEL_TRIM = PALETTE.waterCap; // trim rings on the label, ties back to the cap

// ── Bottle silhouette, in fractions of headRadius (R) ───────────────────────
// A genuine surface-of-revolution profile (LatheGeometry), not a stretched sphere —
// the shoulder-taper-into-a-narrow-neck is exactly the shape that reads as "bottle"
// at a glance, the same silhouette-first approach donut/pizza/taco take with their
// own identity shapes. Point order is bottom → top so LatheGeometry's automatic
// normals face outward correctly.
const SHELL_PROFILE: Array<[number, number]> = [
  [0, -0.94],      // rounded bottom, closes to the axis automatically
  [0.30, -0.92],
  [0.52, -0.87],
  [0.58, -0.78],   // main body radius reached
  [0.58, 0.00],    // straight cylindrical wall
  [0.55, 0.10],    // shoulder begins easing in
  [0.38, 0.24],
  [0.22, 0.36],    // neck reached
  [0.195, 0.40],
  [0.195, 0.58],   // straight neck
  [0.24, 0.61],    // lip flare — where the cap will sit
  [0.24, 0.64],
  [0, 0.66],       // closes under the cap; the seam is fully hidden
];

const CAP_PROFILE: Array<[number, number]> = [
  [0.24, 0.64],    // matches the shell's lip exactly — no gap, no overlap
  [0.30, 0.67],    // cap flares out over the lip
  [0.30, 0.78],    // straight cap wall
  [0.26, 0.82],    // taper toward the dome
  [0.13, 0.85],
  [0, 0.86],       // rounded apex
];
const CAP_TOP_F = 0.86;
// The floating face's gap above the cap. Round 2 used +0.16 here and the smile
// vanished completely: a torus of radius R_s dips a full R_s below its own anchor
// point at the bottom of its arc (sin(-90°) = -1), which is easy to forget when
// only the anchor position gets checked against the cap's top. +0.16 left no room
// for a smile of any legible size once that was accounted for — this is wider so
// eyes AND a smile both fit with real clearance above the cap.
const FACE_FLOAT_F = CAP_TOP_F + 0.26;

// Water fill, in ABSOLUTE fractions of R first (bottom to the fill line), then
// re-expressed relative to its own sloshing pivot below.
const WATER_BOTTOM_F = -0.90;
const WATER_FILL_F = -0.06;   // sits well above the label, below the shoulder — a
                               // visibly "mostly full" bottle without hiding the fill
                               // line behind the label wrap.
const WATER_RADIUS_F = 0.51;  // inset from the shell's 0.58 body radius — a real wall
                               // thickness, not a coincident surface (avoids z-fighting
                               // between the shell and the liquid it contains).
const WATER_PROFILE_ABS: Array<[number, number]> = [
  [0, WATER_BOTTOM_F],
  [0.24, -0.885],
  [0.42, -0.84],
  [WATER_RADIUS_F, -0.76],
  [WATER_RADIUS_F, WATER_FILL_F],
];
// Pivot at the liquid's own mid-height, not the bottle's origin — rotating around
// this point makes it visibly TIP like a real half-full container instead of
// swinging like a pendulum hung from the bottle's base.
const WATER_PIVOT_F = (WATER_BOTTOM_F + WATER_FILL_F) / 2;

export class WaterBottleCharacter extends BaseCharacter {
  private rig: ChibiRig;
  private water: THREE.Group;
  private bubbles: THREE.Object3D[] = [];
  private bubbleBaseY: number[] = [];
  private bubbleRange = 0;

  constructor(def: CharacterDef) {
    super(def);

    this.rig = new ChibiRig({
      palette: {
        // Contrasting zones rather than one flat colour — the reference bar
        // (bs_06/bs_02) dresses the body in distinct blocks (overalls/shirt/boots),
        // not a single hue repeated everywhere. Pale plastic limbs and torso, dark
        // navy hands/feet (mitts/boots) for the contrast. Round 3 tried a near-white
        // LABEL torso here and it backfired: at this scale the torso sphere is the
        // single biggest mass below the neck, and full white made it compete with
        // the bottle itself — the eye landed on a floating white ball instead of
        // the glass. Matching it to the shell tone keeps the silhouette's brightest
        // white reserved for the label wrap, where it belongs.
        limb: PLASTIC,
        hand: CAP,
        foot: CAP_DARK,
        torso: PLASTIC,
        limbRoughness: 0.5,
      },
      // Smaller than the 0.46 default: the bottle's own elongation (shoulder, neck,
      // cap, then the floating face on top of that) already adds a lot of height
      // beyond a normal spherical food mass. Round 1 at the default measured 2.39m
      // against the 2.1m target — this pulls the whole assembly back down.
      proportions: { headFraction: 0.40 },
    });
    this.body.add(this.rig.joints.root);
    this.head = this.rig.joints.head;

    const R = this.rig.headRadius;
    const head = this.rig.joints.head;
    const pt = (rF: number, yF: number) => new THREE.Vector2(rF * R, yF * R);

    // ── Materials ────────────────────────────────────────────────────────────
    const shellMat = glossyMat({ color: PLASTIC, roughness: 0.12, transmission: 0.6 });
    const capMat = toonMat({ color: CAP, roughness: 0.4 }); // matte — the eye's resting place
    const capRidgeMat = toonMat({ color: CAP_DARK, roughness: 0.4 });
    const labelMat = toonMat({ color: LABEL, roughness: 0.55 });
    const labelTrimMat = toonMat({ color: LABEL_TRIM, roughness: 0.4 });
    const waterMat = glossyMat({ color: WATER, roughness: 0.08, transmission: 0 }); // opaque on purpose — see file header
    const fillRingMat = toonMat({ color: WATER_DEEP, roughness: 0.3 });

    // ── Shell ────────────────────────────────────────────────────────────────
    const shellGeo = new THREE.LatheGeometry(SHELL_PROFILE.map(([r, y]) => pt(r, y)), 32);
    const shell = new THREE.Mesh(shellGeo, shellMat);
    shell.name = 'waterbottle_shell';
    shell.castShadow = true;
    shell.receiveShadow = true;
    head.add(shell);

    // ── Cap ──────────────────────────────────────────────────────────────────
    const capGeo = new THREE.LatheGeometry(CAP_PROFILE.map(([r, y]) => pt(r, y)), 24);
    const cap = new THREE.Mesh(capGeo, capMat);
    cap.name = 'waterbottle_cap';
    cap.castShadow = true;
    cap.receiveShadow = true;
    head.add(cap);

    // Grip ridges — thin rings around the cap wall, a shade darker, breaking up
    // what would otherwise be a featureless matte cylinder.
    for (const yF of [0.71, 0.80]) {
      const ridge = new THREE.Mesh(new THREE.TorusGeometry(R * 0.301, R * 0.012, 6, 24), capRidgeMat);
      ridge.name = 'waterbottle_cap_ridge';
      ridge.rotation.x = Math.PI / 2;
      ridge.position.y = R * yF;
      ridge.userData.noOutline = true;
      head.add(ridge);
    }

    // ── Label wrap ───────────────────────────────────────────────────────────
    // Wrapped around the main cylindrical section of the body, sitting proud of the
    // shell so it can never z-fight. This is the primary defence against the
    // bottle vanishing into a similarly-blue background: a bright, fully opaque
    // band breaks up the transparent silhouette regardless of what's behind it, and
    // it doubles as the character's clearest "water bottle" identity cue.
    const labelR = R * 0.60;
    const labelTopF = -0.18;
    const labelBotF = -0.58;
    const labelH = (labelTopF - labelBotF) * R;
    const label = new THREE.Mesh(
      new THREE.CylinderGeometry(labelR, labelR, labelH, 28, 1, true),
      labelMat
    );
    label.name = 'waterbottle_label';
    label.position.y = ((labelTopF + labelBotF) / 2) * R;
    label.castShadow = true;
    label.receiveShadow = true;
    head.add(label);

    for (const yF of [labelBotF, labelTopF]) {
      const trim = new THREE.Mesh(new THREE.TorusGeometry(labelR, R * 0.013, 6, 28), labelTrimMat);
      trim.name = 'waterbottle_label_trim';
      trim.rotation.x = Math.PI / 2;
      trim.position.y = yF * R;
      trim.userData.noOutline = true;
      head.add(trim);
    }

    // ── Water fill ───────────────────────────────────────────────────────────
    // Parented under its own pivot group so the sloshing rotation in `onUpdate`
    // tips it around its own mid-height rather than the bottle's base.
    this.water = new THREE.Group();
    this.water.name = 'waterbottle_water_pivot';
    this.water.position.y = WATER_PIVOT_F * R;
    head.add(this.water);
    const rel = (yF: number) => (yF - WATER_PIVOT_F) * R;

    const waterGeo = new THREE.LatheGeometry(
      WATER_PROFILE_ABS.map(([r, y]) => new THREE.Vector2(r * R, rel(y))),
      24
    );
    const waterBody = new THREE.Mesh(waterGeo, waterMat);
    waterBody.name = 'waterbottle_water';
    waterBody.userData.noOutline = true; // fully enclosed — an ink hull here would
    this.water.add(waterBody);            // just read as a stray line through the glass

    const waterTop = new THREE.Mesh(
      new THREE.CircleGeometry(WATER_RADIUS_F * R, 24),
      waterMat
    );
    waterTop.name = 'waterbottle_water_surface';
    waterTop.rotation.x = -Math.PI / 2;
    waterTop.position.y = rel(WATER_FILL_F);
    waterTop.userData.noOutline = true;
    this.water.add(waterTop);

    // The fill line itself — an explicit ring at the liquid's surface rather than
    // relying on colour contrast alone, so "how full is the bottle" reads instantly
    // even at gameplay distance.
    const fillRing = new THREE.Mesh(new THREE.TorusGeometry(WATER_RADIUS_F * R, R * 0.016, 6, 28), fillRingMat);
    fillRing.name = 'waterbottle_fill_line';
    fillRing.rotation.x = Math.PI / 2;
    fillRing.position.y = rel(WATER_FILL_F);
    fillRing.userData.noOutline = true;
    this.water.add(fillRing);

    // A few small bubbles for cheap life — see `onUpdate` for the drift.
    const bubbleMat = flatMat('#EAFFFF', { transparent: true, opacity: 0.55 });
    const bubbleSpots: Array<[number, number, number, number]> = [
      [0.18, -0.55, 0.10, 0.045],
      [-0.22, -0.35, -0.08, 0.035],
      [0.08, -0.20, 0.05, 0.03],
    ];
    this.bubbleRange = R * 0.035;
    for (const [xF, yF, zF, sF] of bubbleSpots) {
      const b = new THREE.Mesh(new THREE.SphereGeometry(sF * R, 8, 6), bubbleMat);
      b.name = 'waterbottle_bubble';
      b.position.set(xF * R, rel(yF), zF * R);
      b.userData.noOutline = true;
      this.water.add(b);
      this.bubbles.push(b);
      this.bubbleBaseY.push(rel(yF));
    }

    // ── Belt — a small dressed-body accent for the side/back angles where the
    // torso peeks out from behind the bottle's narrower profile.
    const belt = new THREE.Mesh(new THREE.TorusGeometry(R * 0.30, R * 0.026, 8, 24), toonMat({ color: CAP_DARK, roughness: 0.55 }));
    belt.name = 'waterbottle_belt';
    belt.rotation.x = Math.PI / 2;
    belt.castShadow = true;
    belt.receiveShadow = true;
    this.rig.joints.hips.add(belt);

    this.buildFace(R);

    outlineGroup(this.root);
    this.collectFlashTargets();
    this.rig.restPose();
  }

  /**
   * Eyes float in open air above the cap, and the smile floats with them as one
   * small pod — the "floating face" idea kept and pushed further, per the brief's
   * authorisation to lean into it. A thin sparkle trail down toward the cap keeps
   * it reading as a deliberate whimsical touch rather than a detached defect.
   */
  private buildFace(R: number): void {
    const face = this.rig.joints.face;
    face.position.set(0, FACE_FLOAT_F * R, R * 0.04);
    const ink = PALETTE.ink;

    const eyeMat = toonMat({ color: ink, roughness: 0.25 });
    for (const sx of [-1, 1]) {
      const eye = new THREE.Mesh(new THREE.SphereGeometry(R * 0.13, 16, 14), eyeMat);
      eye.position.set(sx * R * 0.28, 0, 0);
      eye.scale.set(1, 1.15, 0.62);
      eye.castShadow = true;
      face.add(eye);

      const glint = new THREE.Mesh(new THREE.SphereGeometry(R * 0.036, 10, 8), flatMat('#ffffff'));
      glint.position.set(sx * R * 0.28 - R * 0.036, R * 0.045, R * 0.12);
      glint.userData.noOutline = true;
      face.add(glint);
    }

    // Big, warm, open smile — friendly rather than crooked, per the brief. A torus
    // arc's own bottom point sits a full `radius` below wherever it's anchored (the
    // arc sweeps through the ring's south pole), so the true footprint here is
    // "anchor Y minus 0.12R", not just the anchor itself — that's the exact math
    // that buried round 2's smile inside the cap. At radius 0.12R anchored 0.10R
    // below the face origin, the lowest point of the curve lands at
    // FACE_FLOAT_F - 0.10 - 0.12 = CAP_TOP_F + 0.04: a real, checked margin above
    // the cap's apex, not an assumption. Kept narrow (end-to-end span ≈ 0.23R) so it
    // sits cleanly in the gap between the eyes rather than tucking behind them.
    const smile = new THREE.Mesh(
      new THREE.TorusGeometry(R * 0.12, R * 0.028, 8, 20, Math.PI * 0.82),
      toonMat({ color: ink, roughness: 0.3 })
    );
    smile.name = 'waterbottle_smile';
    smile.position.set(0, -R * 0.10, 0);
    smile.rotation.z = Math.PI * 1.09;
    smile.castShadow = true;
    face.add(smile);

    // Two shrinking sparkles bridging the gap down to the cap — kept well clear of
    // the cap's apex (0.86R) and below the smile's own lowest point (0.90R above).
    const sparkleColor = flatMat('#EAFFFF', { transparent: true, opacity: 0.8 });
    const sparkleSpecs: Array<[number, number]> = [[-0.16, 0.03], [-0.20, 0.02]];
    for (const [yOff, size] of sparkleSpecs) {
      const sp = new THREE.Mesh(new THREE.SphereGeometry(size * R, 8, 6), sparkleColor);
      sp.name = 'waterbottle_sparkle';
      sp.position.set(0, yOff * R, 0);
      sp.userData.noOutline = true;
      face.add(sp);
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

    // ── Water sloshing ────────────────────────────────────────────────────────
    // Small amplitude on purpose: the liquid is inset from the shell by a real wall
    // thickness (WATER_RADIUS_F vs the shell's 0.58 body radius), but that gap is
    // finite, and the disc's outer rim is the farthest point from the sloshing
    // pivot. Too large a swing pokes the rim through the plastic wall — this stays
    // safely inside that margin even at full run speed plus an attack kick.
    const move = THREE.MathUtils.clamp(ctx.moveSpeed01, 0, 1);
    const attack01 = this.attackT >= 0 ? this.attackT / this.attackDuration : 0;
    const kick = Math.sin(attack01 * Math.PI) * 0.05;
    this.water.rotation.z =
      Math.sin(this.elapsed * 1.7) * 0.018 + Math.sin(this.elapsed * 10.5) * 0.045 * move + kick;
    this.water.rotation.x =
      Math.cos(this.elapsed * 1.3) * 0.014 + Math.cos(this.elapsed * 10.5 + 1.1) * 0.03 * move;

    // Bubbles drift gently in place — cheap life, matches the sprinkle/pepperoni
    // "small independent motion" convention used elsewhere in the cast.
    for (let i = 0; i < this.bubbles.length; i++) {
      this.bubbles[i].position.y =
        this.bubbleBaseY[i] + Math.sin(this.elapsed * (0.6 + i * 0.13) + i * 2) * this.bubbleRange;
    }
  }

  /** The rig owns all body motion; the base class's whole-body pass would fight it. */
  protected applyBaseMotion(): void {}
}
