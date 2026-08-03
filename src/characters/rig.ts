/**
 * Shared chibi character rig.
 *
 * ── Why this exists ──────────────────────────────────────────────────────────
 * The first three Hamburger rounds scored 4/10 against reference art, and the
 * critic's framing was the giveaway: it read as "one blob wearing coloured rings"
 * rather than as a character. The root cause was structural, not cosmetic.
 *
 * Every reference character — Brawl Stars and Zooba alike — is a CHARACTER first
 * and a theme second. Penny is a person who happens to be a pirate: head, torso,
 * arms, hands, legs, feet, all poseable, with the theme carried by costume and
 * silhouette landmarks. Modelling a food item and bolting stub arms onto it can't
 * reach that bar, because gesture is most of what sells "character".
 *
 * So every character in this cast is built on one body plan:
 *
 *      head        ← the FOOD ITEM mounts here; this is the identity mass
 *      face        ← eyes / brows / mouth, facing +Z
 *      torso       ← small, mostly hidden by the head, gives the body a waist
 *      arms        ← shoulder → elbow → hand, hands can hold props
 *      legs        ← hip → knee → foot
 *
 * Uri explicitly authorised departing from the original per-character visual
 * descriptions where it raises quality, and this is the deviation that buys the
 * most: a consistent, poseable cast that reads as one family.
 *
 * Proportions follow the reference: the head is ~45% of total height, limbs are
 * short and chunky, extremities are oversized. That ratio is what makes chibi
 * characters read as appealing rather than as scaled-down adults.
 *
 * ── Bodies come from `bodies.ts`, not from here ──────────────────────────────
 * A character does NOT author a body. It picks one of four archetypes — STUB,
 * STOUT, STANDARD, LANKY — via `bodyType()` and makes its head fit. See
 * `bodies.ts` for why, and `RigProportions` below for the knobs each archetype
 * sets.
 */

import * as THREE from 'three';
import { toonMat, roundedBox } from '../render/toon';
import { CHARACTER_HEIGHT } from '../units';

/**
 * Per-character idle stance. An art director's note after four rounds: "every
 * character stands in the identical symmetric, dead-front, arms-slightly-out pose
 * ... nothing in the lineup demonstrates the studio can vary silhouette or pose."
 * That was literally true — every character used one hardcoded rest pose. These
 * offsets let each character carry its own attitude while still sharing the rig.
 */
export interface RigStance {
  /** Shoulder raise/drop, radians. Positive lifts the arm outward. */
  shoulderL?: number;
  shoulderR?: number;
  /** Elbow bend, radians. More negative = more tucked. */
  elbowL?: number;
  elbowR?: number;
  /** Torso twist about Y, radians — the main weight-shift read. */
  twist?: number;
  /** Head tilt about Z and turn about Y, radians. */
  headTilt?: number;
  headTurn?: number;
  /** Hip sway about Z, radians. */
  hipSway?: number;
  /** Forward/back lean about X, radians. */
  lean?: number;
}

/** Attachment points `dressLimbs` can replace. */
export type LimbPart =
  | 'upperArmL' | 'upperArmR' | 'forearmL' | 'forearmR' | 'handL' | 'handR'
  | 'thighL' | 'thighR' | 'shinL' | 'shinR' | 'footL' | 'footR';

export interface RigPalette {
  /** Limb colour. Usually a tone from the character's own food palette. */
  limb: THREE.ColorRepresentation;
  /** Hand/mitt colour — reference characters almost always contrast the hands. */
  hand: THREE.ColorRepresentation;
  /** Foot/shoe colour. */
  foot: THREE.ColorRepresentation;
  /** Small torso mass between head and legs. */
  torso?: THREE.ColorRepresentation;
  limbRoughness?: number;
}

/**
 * Character proportions.
 *
 * ── Read this before adding a knob ──────────────────────────────────────────
 * For most of this project every field here was a THICKNESS or a WIDTH —
 * `armRadius`, `legRadius`, `shoulderWidth`, `stanceWidth`. There was no knob for
 * torso size, torso presence or limb LENGTH, so the vertical skeleton (leg 0.26H,
 * torso 0.28H, head mounted 0.86R above it) was hardcoded and IDENTICAL on all
 * eleven characters. Rendering the cast as pure black silhouettes made that
 * measurable: every body was the same shape and all identifying information lived
 * in the head. Characters could not fix it even if they wanted to.
 *
 * The `*Fraction` fields below are the shape knobs that were missing. They are
 * expressed as fractions of `height` so a character can change its overall size
 * without re-deriving its proportions.
 *
 * **Do not hand-author these.** Pick one of the four archetypes in `bodies.ts`
 * (`bodyType('stout', { ... })`) and tweak from there. Four deliberately
 * contrasting bodies separate better in silhouette than eleven near-identical
 * bespoke ones, and it keeps each character's scope to head + torso.
 */
export interface RigProportions {
  /** Total character height in metres. */
  height?: number;
  /** Head mass as a fraction of total height. Reference chibi sits around 0.42-0.48. */
  headFraction?: number;
  /** Arm thickness in metres. */
  armRadius?: number;
  /** Hand radius — oversized on purpose. */
  handRadius?: number;
  /** Leg thickness. */
  legRadius?: number;
  /** How far out from centre the shoulders sit, in metres. */
  shoulderWidth?: number;
  /** How far apart the feet stand. */
  stanceWidth?: number;

  // ── Shape knobs (added by the body-archetype work; see bodies.ts) ──────────

  /**
   * Torso height as a fraction of total height. Default 0.28.
   *
   * **`0` means NO TORSO** (the STUB archetype): the rig builds no default torso
   * mass, `hasTorso` is false, `torsoSize.h` is 0, and the head mounts directly on
   * the hips. Anything that dresses or measures the torso must check `hasTorso`
   * first — `torsoMesh` is null in that case.
   */
  torsoFraction?: number;
  /** Torso width (X extent) in metres. Default `shoulderWidth * 1.18`. */
  torsoWidth?: number;
  /** Torso depth (Z extent) in metres. Default `torsoWidth * 0.88`. */
  torsoDepth?: number;
  /** Leg length — hip pivot down to the ground — as a fraction of height. Default 0.26. */
  legFraction?: number;
  /** Total arm length — shoulder pivot to hand — as a fraction of height. Default 0.22. */
  armFraction?: number;
  /**
   * Shoulder pivot height above the HIPS, as a fraction of height.
   * Default `torsoFraction * 0.78`. Set it explicitly when there is no torso to
   * hang the shoulders off, so the arms emerge from the food mass rather than
   * from the ankles.
   */
  shoulderFraction?: number;
  /**
   * Head centre above the top of the torso, in HEAD RADII. Default 0.86.
   *
   * The rig assumes a head mass extending roughly ±R about its own origin. A
   * character whose mass is not a sphere (Hamburger and HotDog anchor their
   * underside at ≈ −0.90R) compensates in its own geometry, not here.
   */
  headMount?: number;
  /**
   * Ankle joint height above the ground, as a fraction of leg length. Default 0.14.
   *
   * Short thick legs need a bigger value: the foot mesh is sized off `legRadius`,
   * so a stubby archetype with the default 0.14 drives its feet through the floor.
   */
  footClearance?: number;
}

/**
 * Every derived length the rig computed internally, published so characters stop
 * hardcoding copies of them.
 *
 * Before this existed, eight of the eleven character files carried lines like
 * `const shoulderWidth = CHARACTER_HEIGHT * 0.23; // must match rig's own
 * proportions.shoulderWidth` — a hand-maintained mirror that silently goes wrong
 * the moment an archetype changes. Read `rig.metrics` instead.
 */
export interface RigMetrics {
  height: number;
  headFraction: number;
  headRadius: number;
  /** Absolute Y of the head group's origin, with feet at y=0. */
  headCentreY: number;
  /** Absolute Y of the hip pivot — also the top of the legs. */
  hipY: number;
  /** Hip pivot down to the ground. */
  legLength: number;
  /** Nominal torso height in metres. 0 when the archetype has no torso. */
  torsoHeight: number;
  torsoWidth: number;
  torsoDepth: number;
  /** Absolute Y of the top of the torso — where the neck joint sits. */
  torsoTopY: number;
  /** False for the STUB archetype: no default torso mass was built. */
  hasTorso: boolean;
  /** Shoulder pivot height in TORSO-LOCAL space (the torso joint origin is the hips). */
  shoulderY: number;
  shoulderWidth: number;
  stanceWidth: number;
  armRadius: number;
  handRadius: number;
  legRadius: number;
  upperArmLength: number;
  forearmLength: number;
  thighLength: number;
  shinLength: number;
  /** Ankle joint height above the ground. */
  ankleY: number;
  /** Ground to the top of a nominal spherical head mass. Sanity-check against `height`. */
  nominalHeight: number;
}

/**
 * Named joints. Characters attach their own geometry to `head` (the food item),
 * `face` (features) and optionally `handL`/`handR` (props). Everything else is
 * built and animated for them.
 */
export interface RigJoints {
  root: THREE.Group;
  /** Whole-body group — squash/stretch and lean are applied here. */
  body: THREE.Group;
  hips: THREE.Group;
  torso: THREE.Group;
  neck: THREE.Group;
  head: THREE.Group;
  face: THREE.Group;
  shoulderL: THREE.Group;
  shoulderR: THREE.Group;
  elbowL: THREE.Group;
  elbowR: THREE.Group;
  handL: THREE.Group;
  handR: THREE.Group;
  hipL: THREE.Group;
  hipR: THREE.Group;
  kneeL: THREE.Group;
  kneeR: THREE.Group;
  footL: THREE.Group;
  footR: THREE.Group;
}

export interface ChibiRigOptions {
  palette: RigPalette;
  proportions?: RigProportions;
  /** Per-character idle attitude. Omit for the neutral default. */
  stance?: RigStance;
  /** Skip default limb geometry and only build the joint hierarchy. */
  jointsOnly?: boolean;
}

export class ChibiRig {
  readonly joints: RigJoints;
  readonly headRadius: number;
  readonly headCentreY: number;
  /** Every derived length, so characters never hardcode a copy. */
  readonly metrics: RigMetrics;
  /**
   * False when the archetype has no torso (STUB). Check this before dressing,
   * measuring or attaching to the torso — `torsoMesh` is null in that case and
   * `torsoSize.h` is 0.
   */
  readonly hasTorso: boolean;
  /** The default torso mesh, so characters can restyle or hide it. Null for STUB. */
  torsoMesh: THREE.Mesh | null = null;
  /** Per-character idle attitude, applied by restPose(). */
  stance: Required<RigStance>;
  private readonly p: Required<RigProportions>;

  constructor(opts: ChibiRigOptions) {
    const st = opts.stance ?? {};
    this.stance = {
      shoulderL: st.shoulderL ?? 0.30,
      shoulderR: st.shoulderR ?? -0.22,
      elbowL: st.elbowL ?? -0.42,
      elbowR: st.elbowR ?? -0.30,
      twist: st.twist ?? 0.10,
      headTilt: st.headTilt ?? 0.05,
      headTurn: st.headTurn ?? -0.13,
      hipSway: st.hipSway ?? 0.035,
      lean: st.lean ?? 0,
    };
    const pr = opts.proportions ?? {};
    const height = pr.height ?? CHARACTER_HEIGHT;
    const shoulderWidth = pr.shoulderWidth ?? height * 0.20;
    const torsoFraction = pr.torsoFraction ?? 0.28;
    const torsoWidth = pr.torsoWidth ?? shoulderWidth * 1.18;
    this.p = {
      height,
      headFraction: pr.headFraction ?? 0.46,
      armRadius: pr.armRadius ?? height * 0.058,
      handRadius: pr.handRadius ?? height * 0.075,
      legRadius: pr.legRadius ?? height * 0.062,
      shoulderWidth,
      stanceWidth: pr.stanceWidth ?? height * 0.115,
      torsoFraction,
      torsoWidth,
      torsoDepth: pr.torsoDepth ?? torsoWidth * 0.88,
      legFraction: pr.legFraction ?? 0.26,
      armFraction: pr.armFraction ?? 0.22,
      shoulderFraction: pr.shoulderFraction ?? torsoFraction * 0.78,
      headMount: pr.headMount ?? 0.86,
      footClearance: pr.footClearance ?? 0.14,
    };

    const headH = height * this.p.headFraction;
    // Layout from the ground up: feet/legs, then the torso (which may be absent
    // entirely), then the head.
    const legH = height * this.p.legFraction;
    const torsoH = height * this.p.torsoFraction;
    const hipY = legH;
    const torsoTopY = hipY + torsoH;
    this.hasTorso = torsoH > 1e-4;

    this.headRadius = headH * 0.5;
    this.headCentreY = torsoTopY + this.headRadius * this.p.headMount;

    const g = (name: string) => {
      const o = new THREE.Group();
      o.name = name;
      return o;
    };

    const root = g('rig_root');
    const body = g('rig_body');
    const hips = g('hips');
    const torso = g('torso');
    const neck = g('neck');
    const head = g('head');
    const face = g('face');

    root.add(body);
    body.add(hips);
    hips.position.y = hipY;
    hips.add(torso);
    torso.add(neck);
    neck.position.y = torsoH;
    neck.add(head);
    head.position.y = this.headCentreY - torsoTopY;
    head.add(face);
    // Face sits on the front surface of the head mass.
    face.position.z = this.headRadius * 0.82;

    const mk = (parent: THREE.Group, name: string, pos: THREE.Vector3) => {
      const j = g(name);
      j.position.copy(pos);
      parent.add(j);
      return j;
    };

    const shoulderY = height * this.p.shoulderFraction;
    // Arm split keeps the rig's original 0.115/0.105 ratio (52.3% / 47.7%).
    const armLen = height * this.p.armFraction;
    const upperArmLen = armLen * 0.523;
    const forearmLen = armLen - upperArmLen;

    const shoulderL = mk(torso, 'shoulderL', new THREE.Vector3(-this.p.shoulderWidth, shoulderY, 0));
    const shoulderR = mk(torso, 'shoulderR', new THREE.Vector3(this.p.shoulderWidth, shoulderY, 0));
    const elbowL = mk(shoulderL, 'elbowL', new THREE.Vector3(0, -upperArmLen, 0));
    const elbowR = mk(shoulderR, 'elbowR', new THREE.Vector3(0, -upperArmLen, 0));
    const handL = mk(elbowL, 'handL', new THREE.Vector3(0, -forearmLen, 0));
    const handR = mk(elbowR, 'handR', new THREE.Vector3(0, -forearmLen, 0));

    // The ankle sits `footClearance` of the way up the leg, because the foot mesh
    // hangs BELOW it and is sized off `legRadius`. Thigh/shin then split the rest
    // in the rig's original 0.52 : 0.34 ratio.
    const ankleY = legH * this.p.footClearance;
    const boneLen = legH - ankleY;
    const thighLen = boneLen * 0.605;
    const shinLen = boneLen - thighLen;
    const hipL = mk(hips, 'hipL', new THREE.Vector3(-this.p.stanceWidth, 0, 0));
    const hipR = mk(hips, 'hipR', new THREE.Vector3(this.p.stanceWidth, 0, 0));
    const kneeL = mk(hipL, 'kneeL', new THREE.Vector3(0, -thighLen, 0));
    const kneeR = mk(hipR, 'kneeR', new THREE.Vector3(0, -thighLen, 0));
    const footL = mk(kneeL, 'footL', new THREE.Vector3(0, -shinLen, 0));
    const footR = mk(kneeR, 'footR', new THREE.Vector3(0, -shinLen, 0));

    this.joints = {
      root, body, hips, torso, neck, head, face,
      shoulderL, shoulderR, elbowL, elbowR, handL, handR,
      hipL, hipR, kneeL, kneeR, footL, footR,
    };

    this.metrics = {
      height,
      headFraction: this.p.headFraction,
      headRadius: this.headRadius,
      headCentreY: this.headCentreY,
      hipY,
      legLength: legH,
      torsoHeight: torsoH,
      torsoWidth: this.p.torsoWidth,
      torsoDepth: this.p.torsoDepth,
      torsoTopY,
      hasTorso: this.hasTorso,
      shoulderY,
      shoulderWidth: this.p.shoulderWidth,
      stanceWidth: this.p.stanceWidth,
      armRadius: this.p.armRadius,
      handRadius: this.p.handRadius,
      legRadius: this.p.legRadius,
      upperArmLength: upperArmLen,
      forearmLength: forearmLen,
      thighLength: thighLen,
      shinLength: shinLen,
      ankleY,
      nominalHeight: this.headCentreY + this.headRadius,
    };

    if (!opts.jointsOnly) {
      this.buildLimbs(opts.palette, upperArmLen, forearmLen, thighLen, shinLen, torsoH);
    }
  }

  /**
   * Default limb geometry. Chunky capsules with oversized mitts and feet, matching
   * the reference's short-limbs/big-extremities rule. Characters get a full body for
   * free and only author their food mass and face.
   */
  private buildLimbs(
    pal: RigPalette,
    upperArmLen: number,
    forearmLen: number,
    thighLen: number,
    shinLen: number,
    torsoH: number
  ): void {
    const rough = pal.limbRoughness ?? 0.62;
    const limbMat = toonMat({ color: pal.limb, roughness: rough });
    const handMat = toonMat({ color: pal.hand, roughness: rough * 0.9 });
    const footMat = toonMat({ color: pal.foot, roughness: rough });
    const torsoMat = toonMat({ color: pal.torso ?? pal.limb, roughness: rough });

    const solid = (m: THREE.Mesh) => {
      m.castShadow = true;
      m.receiveShadow = true;
      // Tagged so dressLimbs() can find and remove exactly the rig's own defaults
      // without disturbing anything a character has added to the same joint.
      m.userData.rigDefaultLimb = true;
      return m;
    };

    // Torso.
    //
    // Deliberately a soft tapered barrel rather than a box. A side-by-side against a
    // character whose food mass spanned its whole body showed the box torso reading
    // as "toy robot wearing a costume head" — the plain slab was doing active harm.
    // Characters SHOULD still dress this with their own food geometry (see the
    // `dressTorso` helper); this is a decent default, not a finished body.
    // Torso width is deliberately NARROWER than the shoulder span. At 1.72x the
    // shoulder width, half-width (0.36m) barely cleared the shoulder pivots (0.42m),
    // so 0.12m-radius arms sank into the body and the whole character read as a pile
    // of overlapping dough balls. Limbs must sit clearly OUTSIDE the torso silhouette
    // for the body to read as a body.
    //
    // Skipped entirely for the STUB archetype (`torsoFraction: 0`), whose head mass
    // mounts straight onto the hips.
    if (this.hasTorso) {
      const tw = this.p.torsoWidth;
      const td = this.p.torsoDepth;
      const torsoGeo = new THREE.SphereGeometry(tw * 0.5, 20, 16);
      // Taper: narrow at the shoulders, fuller at the waist, so it reads as a soft
      // body rather than a capsule.
      const pos = torsoGeo.attributes.position as THREE.BufferAttribute;
      for (let i = 0; i < pos.count; i++) {
        const y = pos.getY(i);
        const t = (y / (tw * 0.5) + 1) * 0.5; // 0 at bottom, 1 at top
        const taper = 0.86 + 0.30 * Math.sin(t * Math.PI * 0.85);
        pos.setX(i, pos.getX(i) * taper);
        pos.setZ(i, pos.getZ(i) * taper * (td / tw));
        pos.setY(i, y * (torsoH / tw) * 0.92);
      }
      torsoGeo.computeVertexNormals();

      const torsoMesh = solid(new THREE.Mesh(torsoGeo, torsoMat));
      torsoMesh.position.y = torsoH * 0.5;
      torsoMesh.name = 'torso_mesh';
      this.joints.torso.add(torsoMesh);
      this.torsoMesh = torsoMesh;
    }

    // Segment helper: a capsule whose top sits at the joint origin and hangs down.
    const segment = (len: number, radius: number, mat: THREE.Material, name: string) => {
      const geo = new THREE.CapsuleGeometry(radius, Math.max(0.001, len - radius * 2), 6, 12);
      const m = solid(new THREE.Mesh(geo, mat));
      m.position.y = -len * 0.5;
      m.name = name;
      return m;
    };

    this.joints.shoulderL.add(segment(upperArmLen, this.p.armRadius, limbMat, 'upperArmL'));
    this.joints.shoulderR.add(segment(upperArmLen, this.p.armRadius, limbMat, 'upperArmR'));
    this.joints.elbowL.add(segment(forearmLen, this.p.armRadius * 0.92, limbMat, 'forearmL'));
    this.joints.elbowR.add(segment(forearmLen, this.p.armRadius * 0.92, limbMat, 'forearmR'));

    for (const [joint, name] of [[this.joints.handL, 'handL'], [this.joints.handR, 'handR']] as const) {
      const m = solid(new THREE.Mesh(new THREE.SphereGeometry(this.p.handRadius, 16, 14), handMat));
      m.scale.set(1, 0.92, 1.05);
      m.name = `${name}_mesh`;
      joint.add(m);
    }

    this.joints.hipL.add(segment(thighLen, this.p.legRadius, limbMat, 'thighL'));
    this.joints.hipR.add(segment(thighLen, this.p.legRadius, limbMat, 'thighR'));
    this.joints.kneeL.add(segment(shinLen, this.p.legRadius * 0.9, limbMat, 'shinL'));
    this.joints.kneeR.add(segment(shinLen, this.p.legRadius * 0.9, limbMat, 'shinR'));

    // Feet: oversized rounded wedges, pushed forward so the character reads as
    // standing on something rather than balancing on pegs.
    for (const [joint, name] of [[this.joints.footL, 'footL'], [this.joints.footR, 'footR']] as const) {
      const fw = this.p.legRadius * 2.3;
      const m = solid(new THREE.Mesh(roundedBox(fw, fw * 0.72, fw * 1.5, fw * 0.3, 4), footMat));
      m.position.set(0, -fw * 0.18, fw * 0.28);
      m.name = `${name}_mesh`;
      joint.add(m);
    }
  }

  /**
   * Replace the default limb, hand and foot geometry with character-authored parts.
   *
   * ── Why this exists ────────────────────────────────────────────────────────
   * An independent art director scored the cast 3/10 and named this as the single
   * biggest problem: "every character reuses the same snowman-body-plus-ball-joints
   * skeleton with a different head glued on." Sharing a SKELETON is correct — it buys
   * poseability, one motion vocabulary and a consistent scale. Sharing the same
   * capsule limbs and ball hands on every character is what reads as a template.
   *
   * So: keep the joints, replace the meshes. `build` is called once per attachment
   * point and should return geometry sized to `size` (metres) hanging DOWN from the
   * joint origin, matching how the defaults are built.
   */
  dressLimbs(build: (part: LimbPart, size: { len: number; radius: number }) => THREE.Object3D | null): void {
    for (const [part, joint, spec] of this.limbSlots()) {
      for (const child of [...joint.children]) {
        const m = child as THREE.Mesh;
        if (m.isMesh && m.userData.rigDefaultLimb) {
          joint.remove(m);
          m.geometry.dispose();
        }
      }
      const replacement = build(part, spec);
      if (replacement) joint.add(replacement);
    }
  }

  private limbSlots(): Array<[LimbPart, THREE.Group, { len: number; radius: number }]> {
    const j = this.joints;
    const m = this.metrics;
    return [
      ['upperArmL', j.shoulderL, { len: m.upperArmLength, radius: m.armRadius }],
      ['upperArmR', j.shoulderR, { len: m.upperArmLength, radius: m.armRadius }],
      ['forearmL', j.elbowL, { len: m.forearmLength, radius: m.armRadius * 0.92 }],
      ['forearmR', j.elbowR, { len: m.forearmLength, radius: m.armRadius * 0.92 }],
      ['handL', j.handL, { len: m.handRadius * 2, radius: m.handRadius }],
      ['handR', j.handR, { len: m.handRadius * 2, radius: m.handRadius }],
      ['thighL', j.hipL, { len: m.thighLength, radius: m.legRadius }],
      ['thighR', j.hipR, { len: m.thighLength, radius: m.legRadius }],
      ['shinL', j.kneeL, { len: m.shinLength, radius: m.legRadius * 0.9 }],
      ['shinR', j.kneeR, { len: m.shinLength, radius: m.legRadius * 0.9 }],
      ['footL', j.footL, { len: m.legRadius * 2.3, radius: m.legRadius * 1.15 }],
      ['footR', j.footR, { len: m.legRadius * 2.3, radius: m.legRadius * 1.15 }],
    ];
  }

  /**
   * Replace the default torso with character-authored geometry.
   *
   * The strongest characters extend their food mass down through the BODY rather
   * than perching a themed head on a generic one — a burger whose lower bun IS its
   * torso reads far richer than a donut head on a plain barrel, which is exactly what
   * a side-by-side showed and what two independent builders both named as their top
   * remaining gap.
   *
   * The returned size is measured off the real default mesh, so it stays correct if
   * rig proportions are retuned later. Geometry is parented to `joints.torso`, so it
   * inherits the rig's breathing, lean and run animation for free.
   */
  dressTorso(build: (size: { w: number; h: number; d: number }) => THREE.Object3D): void {
    // STUB has no torso to dress. Silently doing nothing is deliberate: it lets a
    // character keep its torso-dressing code intact so switching archetype is a
    // one-line change, which is the supported fix when a body doesn't suit a head.
    if (!this.hasTorso) return;
    const size = this.torsoSize;
    if (this.torsoMesh) {
      this.torsoMesh.parent?.remove(this.torsoMesh);
      this.torsoMesh.geometry.dispose();
      this.torsoMesh = null;
    }
    this.joints.torso.add(build(size));
  }

  /**
   * Torso extents in metres, measured from the built mesh where available.
   *
   * **`h` is ~92% of `metrics.torsoHeight`**, not equal to it: the default barrel
   * is a sphere that tapers before reaching its own poles, so its bounding box is
   * shorter than the nominal joint spacing. This is a real trap — it once produced
   * a floating head that looked exactly like a `headCentreY` bug and wasn't. The
   * no-mesh fallback below returns the same 0.92 so both paths agree.
   */
  get torsoSize(): { w: number; h: number; d: number } {
    const m = this.torsoMesh;
    if (m) {
      m.geometry.computeBoundingBox();
      const bb = m.geometry.boundingBox;
      if (bb) {
        return { w: bb.max.x - bb.min.x, h: bb.max.y - bb.min.y, d: bb.max.z - bb.min.z };
      }
    }
    if (!this.hasTorso) return { w: this.p.torsoWidth, h: 0, d: this.p.torsoDepth };
    return {
      w: this.p.torsoWidth,
      h: this.metrics.torsoHeight * 0.92,
      d: this.p.torsoDepth,
    };
  }

  /**
   * Neutral standing pose with a slight, appealing asymmetry.
   *
   * This is called at the top of every `animate()` frame and MUST fully reset any
   * transform that later stages touch with `+=`. The `body` transform is reset here
   * for exactly that reason: attack/hit/death accumulate onto it, and while the run
   * branch assigns `body.rotation.x` outright, idle never did — so an attack played
   * while standing still added ~0.2 rad per frame and the character tumbled end over
   * end within a fifth of a second.
   */
  restPose(): void {
    const j = this.joints;
    j.body.position.set(0, 0, 0);
    j.body.rotation.set(0, 0, 0);
    j.body.scale.set(1, 1, 1);
    const s = this.stance;
    j.shoulderL.rotation.set(0.12, 0, s.shoulderL);
    j.shoulderR.rotation.set(0.06, 0, s.shoulderR);
    j.elbowL.rotation.set(s.elbowL, 0, -0.16);
    j.elbowR.rotation.set(s.elbowR, 0, 0.12);
    j.hipL.rotation.set(0.03, 0, 0.05);
    j.hipR.rotation.set(-0.02, 0, -0.04);
    j.kneeL.rotation.set(0.10, 0, 0);
    j.kneeR.rotation.set(0.05, 0, 0);
    // Weight shift + counter-rotation through the spine.
    j.hips.rotation.z = s.hipSway;
    j.torso.rotation.z = -0.05;
    j.torso.rotation.y = s.twist;
    j.torso.rotation.x = s.lean;
    j.head.rotation.y = s.headTurn;
    j.head.rotation.z = s.headTilt;
  }

  /**
   * Drive the rig for a frame.
   *
   * `move01` blends between idle and run. `attack01` is 0-1 through an attack, and
   * `hit01` 0-1 through a hit reaction. Kept as one function so every character in
   * the cast shares a motion vocabulary — that shared rhythm is a large part of why
   * a real game's roster reads as one production rather than eleven side projects.
   */
  animate(opts: {
    elapsed: number;
    move01: number;
    attack01?: number;
    hit01?: number;
    dead01?: number;
  }): void {
    const j = this.joints;
    const move = THREE.MathUtils.clamp(opts.move01, 0, 1);
    const t = opts.elapsed;

    this.restPose();

    // ── Idle: slow breathing through the whole spine ───────────────────────────
    const breath = Math.sin(t * 2.0) * (1 - move);
    j.torso.rotation.x = breath * 0.03;
    j.head.rotation.x = -breath * 0.05;
    j.shoulderL.rotation.z += breath * 0.05;
    j.shoulderR.rotation.z -= breath * 0.05;
    j.body.position.y = breath * 0.012;

    // ── Run: contralateral stride, arms opposing legs ──────────────────────────
    if (move > 0.001) {
      const phase = t * 10.5;
      const sw = Math.sin(phase) * move;
      const swOpp = Math.sin(phase + Math.PI) * move;

      j.hipL.rotation.x = sw * 0.85;
      j.hipR.rotation.x = swOpp * 0.85;
      j.kneeL.rotation.x = Math.max(0, -sw) * 1.15;
      j.kneeR.rotation.x = Math.max(0, -swOpp) * 1.15;
      j.footL.rotation.x = -sw * 0.28;
      j.footR.rotation.x = -swOpp * 0.28;

      j.shoulderL.rotation.x += swOpp * 0.75;
      j.shoulderR.rotation.x += sw * 0.75;
      j.elbowL.rotation.x -= Math.abs(swOpp) * 0.35;
      j.elbowR.rotation.x -= Math.abs(sw) * 0.35;

      // Vertical bob at twice stride frequency, plus a forward lean into the run.
      j.body.position.y += Math.abs(Math.sin(phase)) * 0.075 * move;
      j.body.rotation.x = move * 0.13;
      j.hips.rotation.y = sw * 0.16;
      j.torso.rotation.y += swOpp * 0.20;
      j.head.rotation.z += Math.sin(phase) * 0.05 * move;
    }

    // ── Attack: anticipation, then an overhead swing ───────────────────────────
    const a = opts.attack01 ?? -1;
    if (a >= 0) {
      const wind = a < 0.3 ? a / 0.3 : 1;
      const strike = a >= 0.3 ? (a - 0.3) / 0.7 : 0;
      const swing = Math.sin(strike * Math.PI * 0.9);
      // Wind back, then drive through.
      j.shoulderR.rotation.x += -2.3 * wind + swing * 3.1;
      j.shoulderR.rotation.z += -0.5 * wind + swing * 0.7;
      j.elbowR.rotation.x += -1.0 * wind + swing * 0.9;
      j.torso.rotation.y += 0.45 * wind - swing * 0.85;
      j.hips.rotation.y += 0.18 * wind - swing * 0.35;
      j.body.rotation.x += swing * 0.22;
      j.head.rotation.y += 0.2 * wind - swing * 0.3;
    }

    // ── Hit: sharp recoil ──────────────────────────────────────────────────────
    const h = opts.hit01 ?? -1;
    if (h >= 0) {
      const k = Math.sin(h * Math.PI) * (1 - h * 0.3);
      j.body.rotation.x -= k * 0.42;
      j.head.rotation.x -= k * 0.35;
      j.shoulderL.rotation.z += k * 0.5;
      j.shoulderR.rotation.z -= k * 0.5;
      j.body.scale.set(1 + k * 0.1, 1 - k * 0.1, 1 + k * 0.1);
    } else {
      j.body.scale.set(1, 1, 1);
    }

    // ── Death: topple and settle ───────────────────────────────────────────────
    const d = opts.dead01 ?? -1;
    if (d >= 0) {
      const ease = 1 - Math.pow(1 - THREE.MathUtils.clamp(d, 0, 1), 3);
      j.body.rotation.z = ease * Math.PI * 0.44;
      j.body.position.y = -ease * 0.3 + Math.sin(Math.min(1, d) * Math.PI) * 0.2;
      j.head.rotation.x = ease * 0.5;
      j.shoulderL.rotation.x = ease * 1.2;
      j.shoulderR.rotation.x = ease * 1.0;
    }
  }
}
