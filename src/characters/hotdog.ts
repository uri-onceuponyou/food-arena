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
const HOLSTER_LEATHER = '#6B4226';
const HOLSTER_TRIM = '#4A2E1A';
const HOLSTER_BUCKLE = '#C9A227';
const BANDANA = '#3E6B8A';      // cool contrast neckerchief — a fresh hue against the warm bun/meat palette
const BANDANA_TRIM = '#2A4C63';
const GRILL_MARK = '#7A4A1E';   // toasted griddle stripes on the bun

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
function buildBunBoot(fw: number, bodyMat: THREE.Material, trimMat: THREE.Material): THREE.Group {
  const g = new THREE.Group();
  const upper = new THREE.Mesh(roundedBox(fw * 1.0, fw * 0.66, fw * 1.36, fw * 0.24, 3), bodyMat);
  upper.position.set(0, -fw * 0.10, fw * 0.22);
  upper.castShadow = true;
  upper.receiveShadow = true;
  g.add(upper);

  const sole = new THREE.Mesh(roundedBox(fw * 1.10, fw * 0.20, fw * 1.58, fw * 0.09, 2), trimMat);
  sole.position.set(0, -fw * 0.46, fw * 0.30);
  sole.castShadow = true;
  sole.receiveShadow = true;
  g.add(sole);

  // No separate ankle-cuff ring — the boot's own dark colour against the bun
  // leg already reads as a material break at the ankle without a bolted-on
  // collar (see the dressLimbs() comment for why these were removed cast-wide).
  return g;
}

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
        limb: PALETTE.bun,
        hand: PALETTE.sausage,
        foot: PALETTE.bunDark,
        torso: PALETTE.bun,
        limbRoughness: 0.8,
      },
      // A fresh independent art director scored the cast 4/10 and named the body plan
      // directly: every character took the rig's defaults, so bodies read as identical
      // parts under different heads. HotDog's own head mass is long and HORIZONTAL —
      // per the brief it needs a low, wide stance and stubby limbs underneath to
      // balance that width, or the body reads like a stick holding up a long log.
      proportions: {
        headFraction: 0.53,
        shoulderWidth: CHARACTER_HEIGHT * 0.23,  // wide enough to visually support the sausage's span
        stanceWidth: CHARACTER_HEIGHT * 0.16,    // low, wide stance — the widest paired with Soup
        armRadius: CHARACTER_HEIGHT * 0.072,     // stubby, thick
        handRadius: CHARACTER_HEIGHT * 0.092,    // biggest bundled fist in the cast
        legRadius: CHARACTER_HEIGHT * 0.082,     // stubby, thick
      },
      // Slouched and sleepy — weight dropped onto one hip, one shoulder
      // drooping low, head lolling to the side. Distinct from every other
      // character's stance in this file's own cast slice: the only one with a
      // real forward slump and asymmetric shoulder droop.
      stance: {
        shoulderL: 0.10, shoulderR: -0.38,
        elbowL: -0.12, elbowR: -0.58,
        twist: 0.22, headTilt: 0.24, headTurn: -0.10,
        hipSway: 0.09, lean: 0.16,
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
    this.rig.dressTorso((size) => {
      const g = new THREE.Group();
      g.name = 'hotdog_torso';

      const bunMat = toonMat({ color: PALETTE.bun, roughness: 0.85 });
      const seamMat = toonMat({ color: PALETTE.mustard, roughness: 0.2 });

      for (const sx of [-1, 1]) {
        const lobe = new THREE.Mesh(
          new THREE.CapsuleGeometry(size.w * 0.34, size.h * 0.62, 6, 16),
          bunMat
        );
        lobe.position.set(sx * size.w * 0.26, size.h * 0.52, 0);
        lobe.rotation.z = sx * 0.06;
        lobe.castShadow = true;
        lobe.receiveShadow = true;
        g.add(lobe);
      }

      // Mustard seam down the split, sunk between the lobes so it reads as filling
      // rather than as a stripe painted on top.
      const seam = new THREE.Mesh(
        new THREE.CapsuleGeometry(size.w * 0.09, size.h * 0.5, 4, 10),
        seamMat
      );
      seam.position.set(0, size.h * 0.56, size.d * 0.12);
      seam.castShadow = true;
      g.add(seam);

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
    const bunMat = toonMat({ color: PALETTE.bun, roughness: 0.85 }); // dry, matte-baked crust
    const sausageMat = glossyMat({ color: PALETTE.sausage, roughness: 0.3 }); // taut, faintly greasy skin
    const mustardMat = glossyMat({ color: PALETTE.mustard, roughness: 0.15 }); // wettest surface on the model
    const ketchupMat = glossyMat({ color: PALETTE.ketchup, roughness: 0.15 });
    const glowMat = toonMat({
      color: CYBER, roughness: 0.4, metalness: 0.3, emissive: CYBER, emissiveIntensity: 0.45,
    });
    this.glowMats.push(glowMat);
    const neckMat = toonMat({ color: PALETTE.bun, roughness: 0.85 }); // matches the bun exactly — reads as its base, not a separate collar

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
    const eyeY = sausY + sausR * 0.34;

    for (const sx of [-1, 1]) {
      const lid = new THREE.Mesh(new THREE.CapsuleGeometry(R * 0.026, R * 0.15, 4, 8), lidMat);
      lid.name = 'lid';
      lid.rotation.z = Math.PI / 2; // level — a mirrored tilt read as an angry V-brow, not sleepy
      lid.position.set(sx * R * 0.24, eyeY, R * 0.02);
      lid.castShadow = true;
      face.add(lid);

      const pupil = new THREE.Mesh(new THREE.SphereGeometry(R * 0.05, 10, 8), lidMat);
      pupil.name = 'pupil';
      pupil.position.set(sx * R * 0.24, eyeY - R * 0.065, -R * 0.01);
      pupil.scale.set(1, 0.85, 0.7);
      pupil.castShadow = true;
      face.add(pupil);

      // Specular catchlight — cheapest trick for making even a sleepy eye feel alive.
      const glint = new THREE.Mesh(new THREE.SphereGeometry(R * 0.018, 8, 6), flatMat('#ffffff'));
      glint.position.set(sx * R * 0.24 - R * 0.018, eyeY - R * 0.05, R * 0.025);
      glint.userData.noOutline = true;
      face.add(glint);

      // A thin, level brow riding just above the lid — a fresh independent art
      // director's checklist explicitly called for verifying every character has
      // "brows carrying expression," and the sleepy lid alone was doing double duty
      // as both lid and brow. A separate stroke, mustard-toned rather than ink-black
      // so it doesn't fuse into the lid below it, keeps the same level/unbothered
      // angle (no V-tilt) so the laid-back personality isn't disturbed.
      const brow = new THREE.Mesh(new THREE.CapsuleGeometry(R * 0.018, R * 0.14, 4, 8), toonMat({ color: PALETTE.mustard, roughness: 0.4 }));
      brow.name = 'brow';
      brow.rotation.z = Math.PI / 2;
      brow.position.set(sx * R * 0.24, eyeY + R * 0.095, R * 0.01);
      brow.castShadow = true;
      face.add(brow);
    }

    // Small closed-lip smile — calm and symmetric-ish rather than crooked, to
    // match the "laid-back, unbothered" personality rather than a mischievous one.
    const mouth = new THREE.Mesh(
      new THREE.TorusGeometry(R * 0.14, R * 0.028, 8, 16, Math.PI * 0.68),
      lidMat
    );
    mouth.name = 'mouth';
    mouth.position.set(0, sausY - sausR * 0.02, R * 0.05);
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
  private buildAccessories(
    R: number,
    head: THREE.Group,
    lobe: { LOBE_Y: number; LOBE_DZ: number; LOBE_TILT: number; LOBE_LEN: number; LOBE_D: number; LOBE_H: number }
  ): void {
    const shoulderWidth = CHARACTER_HEIGHT * 0.23; // must match rig's own proportions.shoulderWidth
    const torsoH = CHARACTER_HEIGHT * 0.28;

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

    // Bandana: a knotted triangular neckerchief at the base of the neck — the
    // "patterned fabric panel" detail item, a cool hue breaking up the warm
    // bun/meat/condiment palette.
    const bandanaMat = toonMat({ color: BANDANA, roughness: 0.62 });
    const bandanaTrimMat = toonMat({ color: BANDANA_TRIM, roughness: 0.55 });
    const bTopY = torsoH * 0.96;
    const triShape = new THREE.Shape();
    triShape.moveTo(-shoulderWidth * 0.30, bTopY);
    triShape.lineTo(shoulderWidth * 0.30, bTopY);
    triShape.lineTo(0, bTopY - shoulderWidth * 0.42);
    triShape.lineTo(-shoulderWidth * 0.30, bTopY);
    const bandanaDepth = shoulderWidth * 0.03;
    const bandana = new THREE.Mesh(
      new THREE.ExtrudeGeometry(triShape, { depth: bandanaDepth, bevelEnabled: true, bevelThickness: bandanaDepth * 0.4, bevelSize: bandanaDepth * 0.4, bevelSegments: 2, curveSegments: 8 }),
      bandanaMat
    );
    bandana.name = 'hotdog_bandana';
    bandana.position.z = shoulderWidth * 0.55;
    bandana.castShadow = true;
    bandana.receiveShadow = true;
    this.rig.joints.torso.add(bandana);

    const knot = new THREE.Mesh(new THREE.SphereGeometry(shoulderWidth * 0.06, 10, 8), bandanaTrimMat);
    knot.name = 'hotdog_bandana_knot';
    knot.position.set(0, bTopY, -shoulderWidth * 0.50);
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
    const bunMat = toonMat({ color: PALETTE.bun, roughness: 0.85 });
    const bunDarkMat = toonMat({ color: PALETTE.bunDark, roughness: 0.8 });
    const ketchupMat = glossyMat({ color: PALETTE.ketchup, roughness: 0.15 });
    const sausageMat = glossyMat({ color: PALETTE.sausage, roughness: 0.3 });

    this.rig.dressLimbs((part: LimbPart, size) => {
      switch (part) {
        case 'upperArmL':
        case 'upperArmR':
          return taperedLimb(size.len, size.radius * 1.28, size.radius * 0.92, bunMat);
        case 'forearmL':
        case 'forearmR':
          return taperedLimb(size.len, size.radius * 0.90, size.radius * 0.64, bunMat);
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
          return taperedLimb(size.len, size.radius * 0.94, size.radius * 0.76, bunMat);
        case 'footL':
        case 'footR':
          return buildBunBoot(size.len, bunDarkMat, ketchupMat);
        default:
          return null;
      }
    });
  }

  /** The rig owns all body motion; the base class's whole-body pass would fight it. */
  protected applyBaseMotion(): void {}
}
