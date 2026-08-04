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

/**
 * What `dressLimbs` tells a builder about the slot it is filling.
 *
 * `groundY` is the joint-local y of the world floor. It exists because bespoke
 * boots had no way to know where the ground was and every one of them was authored
 * by eye, leaving the whole cast standing 0.08-0.25 m below y=0 against
 * `types.ts` convention #1.
 */
export interface LimbSize {
  len: number;
  radius: number;
  /** Joint-local y of the world floor (negative). */
  groundY: number;
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
  /**
   * How HEAVY this body should MOVE, 0 (light, lanky) to 1 (heavy, planted).
   *
   * Derived from the archetype's own proportions rather than authored per
   * character, so switching archetype brings the matching motion with it and
   * nothing has to be kept in sync by hand. See the constructor for the formula
   * and `animate()` for everything it drives.
   */
  heaviness: number;
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
  /**
   * 0 = light and lanky, 1 = heavy and planted. Also published on `metrics`.
   *
   * Motion review measured that all four archetypes moved IDENTICALLY: every
   * amplitude and the single stride frequency in `animate()` were hardcoded
   * absolute constants with no reference to the body carrying them, so a STUB with
   * 0.15H legs and a LANKY with 0.33H legs ran at the same cadence with the same
   * bob. Run `bodyRise` spanned only 0.067-0.088 of height across the whole cast —
   * and the heaviest character bobbed the LEAST. This is the one number that fixes
   * that, and it is derived so it cannot drift out of sync with `bodies.ts`.
   */
  readonly heaviness: number;
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

    // Thick limbs and a wide stance read heavy; long legs read light and athletic.
    // Both terms are needed: bulk alone puts STUB and STOUT within 3% of each
    // other, and the leg term is what separates "a thing with feet" from "a short
    // wide body".
    //
    // Every term is a FRACTION of height, so a character that rescales itself
    // (several pass `height` to `bodyType`) keeps the same motion weight, and a
    // character that switches archetype gets the new one for free.
    //
    // Resolves to roughly stub 0.83 / stout 1.00 / standard 0.47 / lanky 0.00.
    // STOUT ending up heaviest is a check on the formula rather than a coincidence:
    // `rules.ts` independently gives the STOUT cast the lowest speed stats in the
    // game (soup 4, hamburger 5, taco 5) and the LANKY cast the highest (hotdog 7,
    // burrito 6), so the derived motion weight agrees with the design data.
    const bulk = (this.p.legRadius + this.p.armRadius + this.p.stanceWidth * 0.5) / height;
    const stubbiness = 0.30 - this.p.legFraction;
    this.heaviness = THREE.MathUtils.clamp(
      (bulk - 0.110) / 0.160 + stubbiness * 1.1, 0, 1
    );

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
      heaviness: this.heaviness,
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
    //
    // ── Seated ON the floor, not through it ────────────────────────────────────
    // `types.ts` convention #1 is "feet at y=0" and the whole cast was violating it
    // by -0.08 to -0.25 m standing still. The default was `-fw * 0.18`, which puts
    // the wedge's underside `fw * 0.54` below the ankle while the ankle itself only
    // sits `legLength * footClearance` above the ground — on STANDARD that is
    // 0.076 m of clearance against 0.162 m of overhang, so the foot is 0.085 m into
    // the floor before any animation touches it. Seating the underside at exactly
    // -ankleY is the whole fix, and it is expressed in terms of `metrics` so it
    // stays right when an archetype retunes `footClearance` or `legRadius`.
    for (const [joint, name] of [[this.joints.footL, 'footL'], [this.joints.footR, 'footR']] as const) {
      const fw = this.p.legRadius * 2.3;
      const m = solid(new THREE.Mesh(roundedBox(fw, fw * 0.72, fw * 1.5, fw * 0.3, 4), footMat));
      m.position.set(0, Math.max(-this.metrics.ankleY + fw * 0.36, -fw * 0.18), fw * 0.28);
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
  dressLimbs(build: (part: LimbPart, size: LimbSize) => THREE.Object3D | null): void {
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

  private limbSlots(): Array<[LimbPart, THREE.Group, LimbSize]> {
    const j = this.joints;
    const m = this.metrics;
    // Every slot carries the same `groundY`: the joint-local height of the WORLD
    // FLOOR. Only the foot slots have any use for it, but it costs nothing to pass
    // and it is the number a boot builder needs and could not previously obtain —
    // `dressLimbs` handed out a SIZE and no position, so every bespoke boot in the
    // cast guessed its own seat and every one of them guessed low. Foot joints sit
    // `ankleY` above the ground; for the others it is only meaningful as "how far
    // down the world floor is", which is what the sign says.
    const groundY = -m.ankleY;
    return [
      ['upperArmL', j.shoulderL, { len: m.upperArmLength, radius: m.armRadius, groundY }],
      ['upperArmR', j.shoulderR, { len: m.upperArmLength, radius: m.armRadius, groundY }],
      ['forearmL', j.elbowL, { len: m.forearmLength, radius: m.armRadius * 0.92, groundY }],
      ['forearmR', j.elbowR, { len: m.forearmLength, radius: m.armRadius * 0.92, groundY }],
      ['handL', j.handL, { len: m.handRadius * 2, radius: m.handRadius, groundY }],
      ['handR', j.handR, { len: m.handRadius * 2, radius: m.handRadius, groundY }],
      ['thighL', j.hipL, { len: m.thighLength, radius: m.legRadius, groundY }],
      ['thighR', j.hipR, { len: m.thighLength, radius: m.legRadius, groundY }],
      ['shinL', j.kneeL, { len: m.shinLength, radius: m.legRadius * 0.9, groundY }],
      ['shinR', j.kneeR, { len: m.shinLength, radius: m.legRadius * 0.9, groundY }],
      ['footL', j.footL, { len: m.legRadius * 2.3, radius: m.legRadius * 1.15, groundY }],
      ['footR', j.footR, { len: m.legRadius * 2.3, radius: m.legRadius * 1.15, groundY }],
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
   * This is called at the top of every `animate()` frame and MUST fully reset EVERY
   * transform that later stages touch — whether they use `+=` or `=`. The `body`
   * transform is reset here for exactly that reason: attack/hit/death accumulate
   * onto it, and while the run branch assigns `body.rotation.x` outright, idle
   * never did — so an attack played while standing still added ~0.2 rad per frame
   * and the character tumbled end over end within a fifth of a second.
   *
   * **A joint that only ever gets ASSIGNED inside one branch still has to be reset
   * here**, and that was not true for three of them, which is a bug this file
   * carried for the whole project:
   *
   *   - `hips.rotation.y` was assigned only by the run branch, so a character that
   *     stopped running kept up to 9 degrees of hip twist forever, and the attack
   *     branch's `+=` then piled onto that stale value.
   *   - `footL`/`footR` rotation was likewise run-only, so the feet stayed tilted
   *     at whatever angle the last stride left them at.
   *   - `hips.rotation.x` is now written by the hit branch and had no reset at all.
   *
   * None of them ran away frame-to-frame, which is why they survived review: they
   * are a permanent wrong OFFSET rather than an explosion.
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
    j.footL.rotation.set(0, 0, 0);
    j.footR.rotation.set(0, 0, 0);
    // Weight shift + counter-rotation through the spine.
    j.hips.rotation.set(0, 0, s.hipSway);
    j.torso.rotation.z = -0.05;
    j.torso.rotation.y = s.twist;
    j.torso.rotation.x = s.lean;
    j.head.rotation.set(0, s.headTurn, s.headTilt);
  }

  /**
   * The attack's single signed swing curve: 0 → back → through → settle → 0.
   *
   * ── Why one curve and not two envelopes ──────────────────────────────────────
   * The previous version drove the attack from two independent terms, a `wind`
   * that ramped to 1 and then STAYED there and a `swing = sin(strike * PI * 0.9)`
   * that ended at sin(0.9 PI) = 0.309. So at attack01 = 1 the shoulder was still
   * `-2.3 + 0.309 * 3.1` = **-1.34 rad (77 degrees) behind rest**, and the very
   * next frame the one-shot timer expired, `restPose()` won outright and the
   * character teleported. Measured by `tools/motion_probe.mjs`: a single-frame
   * joint jump of **0.29 m (waterbottle) to 0.79 m (hotdog)** at t = 0.368 s, on
   * every character, on every attack. It is visible in the filmstrip as the pose
   * collapsing between two adjacent cells.
   *
   * Expressing the whole action as ONE curve makes the fix structural rather than
   * a tuned constant: the final segment carries a `(1-u)^1.6` decay, so the value
   * is exactly 0 at a = 1 by construction and no amount of later re-tuning can
   * reintroduce the pop.
   *
   * Shape: 0 → -1 (anticipation, easing OUT so it hangs at the top of the
   * wind-up) → +1.15 (the drive, easing IN so it whips rather than drifts) → a
   * damped counter-swing back through rest → 0.
   */
  private attackSwing(a: number): number {
    const A1 = 0.30; // end of anticipation
    const A2 = 0.62; // end of the strike drive
    if (a <= 0) return 0;
    if (a >= 1) return 0;
    if (a < A1) return -(1 - Math.pow(1 - a / A1, 2.2));
    if (a < A2) return -1 + 2.15 * Math.pow((a - A1) / (A2 - A1), 1.7);
    const u = (a - A2) / (1 - A2);
    // The recovery has to do two incompatible things: carry a COUNTER-SWING big
    // enough to read as follow-through, and arrive at exactly 0 with ~0 velocity so
    // the hand-off to `restPose()` is invisible. A single decay exponent cannot do
    // both — at 2.1 the filmstrip's last five cells were visually identical (the
    // action was over by 60% of the window and the character just stood there),
    // and at 1.35 alone there is measurable residual speed at the boundary.
    //
    // So: a gentle 1.35 decay carries the overshoot, and a smoothstep taper over
    // the last 20% brings it to rest with zero derivative.
    // The taper window is WIDE on purpose. It has to bring the counter-swing all
    // the way to zero before the 0.36 s one-shot expires, and a narrow window makes
    // that final kill so steep that it reads as a snap even though it is continuous
    // — a critic sampling ten frames measured exactly that and called it a pop.
    // Spreading the decay across the last third, with a gentler exponent carrying
    // more of it, keeps the overshoot readable and the arrival soft.
    const s = u < 0.68 ? 0 : (u - 0.68) / 0.32;
    const taper = 1 - s * s * (3 - 2 * s);
    return 1.15 * Math.cos(u * Math.PI * 1.5) * Math.pow(1 - u, 1.30) * taper;
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
    const clamp01 = (x: number) => (x < 0 ? 0 : x > 1 ? 1 : x);
    const move = clamp01(opts.move01);
    const t = opts.elapsed;
    const W = this.heaviness;
    const d = opts.dead01 ?? -1;

    this.restPose();

    // Squash/stretch accumulates here and is applied ONCE at the end. It used to be
    // written directly by the hit branch, whose `else` arm reset the scale to
    // (1,1,1) — which is why run and idle measured exactly 0.0000 squash across the
    // entire cast. Multiplying into an accumulator lets every state contribute.
    let sqX = 1;
    let sqY = 1;

    // ── Idle ───────────────────────────────────────────────────────────────────
    //
    // The old idle was ONE sine at 2.0 rad/s driving every joint in phase, with a
    // 1.2 cm vertical bob and nothing at all in the hips, legs or hands. Measured:
    // `phaseSpread` 0.0 (every joint peaking at the same instant) and a total joint
    // travel of 0.031-0.034 body-heights across a whole 3.1 s cycle — ten frames
    // spanning the full cycle were visually indistinguishable. That is precisely
    // "a static pose with a sine wave on it".
    //
    // The fix is layered, deliberately incommensurate oscillators so the pose never
    // quite repeats, plus overlap: the shoulders ride the breath, the elbows lag it,
    // and the head drifts on its own much slower clock.
    const alive = d >= 0 ? 0 : 1;
    const idle = (1 - move) * alive;
    if (idle > 0.001) {
      const rate = 2.0 - 0.55 * W; // heavy bodies breathe slower
      const breath = Math.sin(t * rate);
      const shift = Math.sin(t * rate * 0.5 - 0.9); // slow lateral weight transfer
      const drift = Math.sin(t * rate * 0.31 + 1.7); // very slow gaze drift
      const flutter = Math.sin(t * rate * 2.7 + 0.4); // small and quick

      j.torso.rotation.x += breath * 0.065 * idle;
      j.torso.rotation.z += shift * 0.078 * (0.6 + 0.8 * W) * idle;
      j.torso.rotation.y += shift * 0.070 * idle;
      j.hips.rotation.z += shift * 0.062 * (0.5 + 1.0 * W) * idle;
      j.hips.rotation.y -= shift * 0.042 * idle;

      j.head.rotation.x -= breath * 0.075 * idle;
      j.head.rotation.y += drift * 0.22 * idle;
      j.head.rotation.z += (-shift * 0.085 + flutter * 0.018) * idle;

      j.shoulderL.rotation.z += breath * 0.085 * idle;
      j.shoulderR.rotation.z -= breath * 0.085 * idle;
      j.shoulderL.rotation.x += Math.sin(t * rate - 0.55) * 0.072 * idle;
      j.shoulderR.rotation.x += Math.sin(t * rate - 0.75) * 0.065 * idle;
      j.elbowL.rotation.x += Math.sin(t * rate - 1.1) * 0.130 * idle;
      j.elbowR.rotation.x += Math.sin(t * rate - 1.3) * 0.115 * idle;

      // The legs finally do something: the weight transfer loads one knee at a time.
      //
      // The ankle counter-rotates by the same amount so the FOOT STAYS FLAT on the
      // ground. This is not polish. The default foot mesh is `legRadius * 2.3 * 1.5`
      // long and hangs below the ankle, so on a thick-legged archetype it is a 0.69 m
      // plank: an uncompensated knee bend levers its toe straight through the floor.
      // Measured on Hamburger, whose feet are the widest in the cast — adding this
      // idle knee flex without the counter-rotation drove the model's lowest point
      // from -0.185 m to -0.296 m against a "feet at y=0" convention.
      const kneeFlexL = Math.max(0, shift) * 0.095 * idle;
      const kneeFlexR = Math.max(0, -shift) * 0.095 * idle;
      j.kneeL.rotation.x += kneeFlexL;
      j.kneeR.rotation.x += kneeFlexR;
      j.footL.rotation.x -= kneeFlexL;
      j.footR.rotation.x -= kneeFlexR;
      j.hipL.rotation.z += shift * 0.026 * idle;
      j.hipR.rotation.z += shift * 0.026 * idle;

      j.body.position.y += (breath * 0.019 + shift * 0.011) * (0.7 + 0.6 * W) * idle;
      // Breathing is a volume change, so the body widens as it settles.
      sqY *= 1 + breath * 0.020 * idle;
      sqX *= 1 - breath * 0.013 * idle;
    }

    // ── Run ────────────────────────────────────────────────────────────────────
    if (move > 0.001) {
      // Cadence now varies with the body carrying it. One hardcoded 10.5 rad/s for
      // the whole cast was the largest single reason the four archetypes moved
      // identically.
      const rate = 10.5 * (1.16 - 0.34 * W);
      const phase = t * rate;
      const raw = Math.sin(phase);
      // Hold at the extremes, whip through the middle. A pure sine spends most of
      // its time mid-swing, which is exactly what makes sine-driven limbs read
      // floaty; this is a cheap waveshaper that redistributes the time.
      const shape = (s: number) => Math.sign(s) * Math.pow(Math.abs(s), 0.78);
      const sw = shape(raw) * move;
      const swOpp = shape(Math.sin(phase + Math.PI)) * move;
      /** 1 at full leg split — the contact/compression pose. */
      const contact = Math.abs(raw);
      /** 1 when the legs pass each other — the airborne apex. */
      const pass = Math.abs(Math.cos(phase));

      const hipAmp = 0.85 * (1 + 0.30 * W);
      j.hipL.rotation.x = sw * hipAmp;
      j.hipR.rotation.x = swOpp * hipAmp;
      // Swing-leg tuck, plus a compression bend on whichever leg is landing. There
      // was no impact absorption at all before: the knees only ever tucked.
      const compL = Math.pow(Math.max(0, sw), 2) * 0.30 * (0.5 + W);
      const compR = Math.pow(Math.max(0, swOpp), 2) * 0.30 * (0.5 + W);
      const kneeXL = Math.max(0, -sw) * 1.15 + compL;
      const kneeXR = Math.max(0, -swOpp) * 1.15 + compR;
      j.kneeL.rotation.x = kneeXL;
      j.kneeR.rotation.x = kneeXR;
      // ── Keep the sole roughly parallel to the ground ─────────────────────────
      // The ankle cancels 60% of the ACCUMULATED thigh + shin rotation, rather than
      // pitching by a hand-picked constant. That matters because the two halves of
      // the stride do not carry the same leg angles: `comp` only exists on the
      // forward half, so the old `-sw * 0.28 - comp` pitched one foot 42 degrees
      // toe-UP at one contact and 16 degrees toe-DOWN at the other. A critic
      // measured the consequence without knowing the cause — the body dipped twice
      // per cycle but only one dip had a foot on the floor under it; on the other
      // the feet were 25 px airborne while the body compressed against nothing.
      // Cancelling the real angle makes both contacts behave the same by
      // construction, and the residual 40% still gives toe-off and heel strike.
      j.footL.rotation.x = -(sw * hipAmp + kneeXL) * 0.60;
      j.footR.rotation.x = -(swOpp * hipAmp + kneeXR) * 0.60;

      // Arms lag the legs. Overlap is what stops a run reading as one rigid object
      // rotating about its own centre, and heavier bodies drag further behind.
      const lag = 0.22 + 0.30 * W;
      const armL = shape(Math.sin(phase + Math.PI - lag)) * move;
      const armR = shape(Math.sin(phase - lag)) * move;
      const armAmp = 0.75 - 0.20 * W; // thick arms swing less
      j.shoulderL.rotation.x += armL * armAmp;
      j.shoulderR.rotation.x += armR * armAmp;
      j.elbowL.rotation.x -= Math.abs(Math.sin(phase + Math.PI - lag * 2)) * 0.35;
      j.elbowR.rotation.x -= Math.abs(Math.sin(phase - lag * 2)) * 0.35;

      // ── Vertical bob ──────────────────────────────────────────────────────────
      // LOW at contact, HIGH when the legs pass. The old cycle used
      // `abs(sin(phase))`, which peaks at exactly the frame of maximum leg split —
      // measured `bobAtSplit` = 1.000 on all four archetypes, i.e. perfectly
      // inverted. The body was rising as the legs spread, which reads as hopping
      // while doing the splits rather than as running.
      //
      // Light bodies float higher; heavy bodies stay low and pay for it in squash.
      const rise = 0.155 - 0.105 * W;
      j.body.position.y += (pass - 0.5) * rise * move;
      j.body.rotation.x = move * (0.16 - 0.07 * W);
      j.hips.rotation.y = sw * 0.16;
      j.hips.rotation.z += Math.sin(phase * 2 + 0.6) * 0.05 * (0.4 + W) * move;
      j.torso.rotation.y += swOpp * 0.20;
      j.head.rotation.z += Math.sin(phase - 0.5) * 0.06 * move;
      j.head.rotation.x -= (pass - 0.5) * 0.10 * move * (0.5 + W);

      // Compress at contact, stretch through the air. This is the loudest single
      // "animated, not a turntable render" cue and there was none of it.
      const sq = (0.07 + 0.11 * W) * move;
      sqY *= 1 - (contact - 0.5) * sq;
      sqX *= 1 + (contact - 0.5) * sq * 0.55;
    }

    // ── Attack: anticipation → drive → follow-through → settle ─────────────────
    // See `attackSwing()` for the curve and for the 0.29-0.79 m pose snap it fixes.
    const a = opts.attack01 ?? -1;
    if (a >= 0) {
      const ac = clamp01(a);
      // Hips lead, torso follows, arm follows last, hand last of all. Successive
      // breaking of joints is most of what separates a swing from a rotation.
      // Successive breaking of joints, widened. A critic comparing this against the
      // previous rig noted the OLD one did drag BETTER — its torso peaked two frames
      // before its blade — because here the hand's position is dominated by the
      // SHOULDER, and the shoulder had no lag at all, so the weapon arrived back at
      // rest on the same frame as the body and read as welded to the arm.
      //
      // The offset is scaled by the time REMAINING, so it is at full strength
      // through the action and closes to exactly zero as `ac` reaches 1. A fixed
      // offset does not work and reintroduces the very pop this rewrite removed:
      // a channel lagging by a constant 0.10 is still reading `attackSwing(0.895)`
      // — a value of -0.285 — on the last active frame, and then the one-shot timer
      // expires and it lands on 0. Measured at 0.114 m of hand travel in a single
      // frame before this line was written this way.
      const at = (d: number) => this.attackSwing(clamp01(ac + d * (1 - ac)));
      const sHip = at(0.12);
      const sTorso = at(0.06);
      const sArm = at(-0.03);
      const sHand = at(-0.10);
      const drive = Math.max(0, sArm);
      const wind = Math.max(0, -sArm);

      j.shoulderR.rotation.x += sArm * 2.45;
      j.shoulderR.rotation.z += sArm * 0.52;
      j.elbowR.rotation.x += sHand * 0.95;
      j.shoulderL.rotation.x -= sArm * 0.55;
      j.shoulderL.rotation.z += wind * 0.22;

      // The torso carries a visibly LARGER counter-rotation than the arm on the way
      // home, so the body passes through neutral rather than easing onto it. A
      // critic reading the silhouette centroid saw the recovery as a plain ease-out
      // even though the HAND was measurably overshooting — the overshoot was there,
      // it just wasn't in the mass that dominates the silhouette.
      // Counter-rotation on the way HOME only. `sTorso` is negative during the
      // anticipation as well, so gating on its sign alone would have added 0.55 rad
      // of extra twist to the wind-up — 73 degrees, which is not a wind-up, it is a
      // pirouette. `ac > A2` is the recovery phase specifically.
      const recoverTwist = ac > 0.62 ? Math.min(0, sTorso) * 0.55 : 0;
      j.torso.rotation.y -= sTorso * 0.72 + recoverTwist;
      j.torso.rotation.x += drive * 0.16 - wind * 0.10;
      j.hips.rotation.y -= sHip * 0.30;
      j.head.rotation.y -= sTorso * 0.26;
      j.head.rotation.x += drive * 0.12 - wind * 0.14;

      // The forward lean pitches about the ROOT, which sits between the feet, so a
      // foot that extends ~0.5 m in front of the ankle swings DOWNWARD through the
      // floor as the body leans in. Measured: the lunge frame put the support foot
      // ~37 mm deeper than the same character's idle. Reduced lean plus a matching
      // lift keeps the drive readable without burying the feet.
      j.body.rotation.x += drive * 0.14 - wind * 0.12;
      j.body.position.y += drive * 0.042 - wind * 0.045;
      // A secondary head bobble on the recovery, on its own faster clock than the
      // arm. Overlapping action: the heaviest mass on the character keeps moving
      // after the limb that threw it has stopped. Decays to 0 at ac = 1.
      if (ac > 0.62) {
        const recoil = Math.sin(((ac - 0.62) / 0.38) * Math.PI * 2.6) * Math.pow(1 - ac, 1.5);
        j.head.rotation.z += recoil * 0.16;
        j.head.rotation.x += recoil * 0.11;
        j.torso.rotation.z += recoil * 0.07;
      }
      // Gather on the wind-up, extend through the strike — with the ankle cancelling
      // the knee bend so the sole stays flat. Third occurrence of the same trap in
      // this file: the default foot is a long plank hanging below the ankle, so ANY
      // uncompensated knee rotation levers its toe through the floor.
      const gatherL = wind * 0.30;
      const gatherR = wind * 0.34;
      j.kneeL.rotation.x += gatherL;
      j.kneeR.rotation.x += gatherR;
      j.footL.rotation.x -= gatherL;
      j.footR.rotation.x -= gatherR;
      sqY *= 1 - wind * 0.09 + drive * 0.07;
      sqX *= 1 + wind * 0.06 - drive * 0.04;
    }

    // ── Hit: snap out, overshoot, settle ───────────────────────────────────────
    const h = opts.hit01 ?? -1;
    if (h >= 0) {
      // The old curve was `sin(h*PI) * (1 - 0.3h)`, whose derivative at h=1 is
      // -PI: the recoil was still travelling at full speed on the frame the timer
      // expired, so the motion stopped dead rather than settling. This one decays
      // as (1-h)^1.8, which reaches zero WITH zero velocity, and the 1.9 inside the
      // sine buys one counter-lobe — the flinch rebounds past neutral and comes
      // back, instead of easing symmetrically home.
      const hc = clamp01(h);
      const k = (Math.sin(hc * Math.PI * 1.9) * Math.pow(1 - hc, 1.3)) / 0.694;
      j.body.rotation.x -= k * 0.42;
      j.head.rotation.x -= k * 0.40;
      j.head.rotation.z += k * 0.10;
      j.shoulderL.rotation.z += k * 0.50;
      j.shoulderR.rotation.z -= k * 0.50;
      j.shoulderL.rotation.x += k * 0.30;
      j.shoulderR.rotation.x += k * 0.26;
      j.hips.rotation.x -= k * 0.12;
      j.kneeL.rotation.x += Math.abs(k) * 0.22 * (0.5 + W);
      j.kneeR.rotation.x += Math.abs(k) * 0.18 * (0.5 + W);
      sqX *= 1 + k * 0.10;
      sqY *= 1 - k * 0.10;
    }

    // ── Death: hitch, topple, land, settle ─────────────────────────────────────
    if (d >= 0) {
      // `ease = 1 - (1-d)^3` has its MAXIMUM rate at d = 0, so the old topple began
      // at full angular speed on the frame the character died — no anticipation,
      // and then it froze at 79 degrees, still leaning, never reaching the ground.
      const dc = clamp01(d);
      /** A short hitch UP and back before gravity takes over. */
      const antic = dc < 0.14 ? Math.sin((dc / 0.14) * Math.PI) : 0;
      const fall = clamp01((dc - 0.09) / 0.59);
      const land = fall * fall * (3 - 2 * fall);
      const after = clamp01((dc - 0.68) / 0.32);
      /** Damped rebound once the body reaches the floor. */
      const settle = Math.sin(after * Math.PI * 2.4) * Math.pow(1 - after, 1.4);
      /**
       * Ground-contact compression.
       *
       * ── Two bugs live here, both fixed ────────────────────────────────────────
       * The original was `(1-after)^3 * (after < 0.35 ? 1 : 0)`, a step function
       * that cut a value of 0.275 to 0 between adjacent frames — a one-frame pop of
       * exactly the kind this rewrite exists to remove.
       *
       * Replacing it with a bare `(1-after)^5` then introduced a WORSE bug, because
       * `after` is clamped and therefore **0 for the whole first 68% of the fall**:
       * the compression sat at full strength from frame 0, so the character began
       * its death already squashed to 83% height. A critic caught it as "frame 0 is
       * not the standing pose, the character is 19% shorter than in idle" — which is
       * the 0.17 squash, exactly.
       *
       * So: zero while falling, ramped in over the last moments before contact, and
       * decayed after it. Continuous at the contact frame by construction.
       */
      const preLand = clamp01((dc - 0.60) / 0.08);
      const impact = after > 0 ? Math.pow(1 - after, 5) : preLand;
      /** The head carries through one beat AFTER the torso has settled. */
      const afterHead = clamp01((dc - 0.72) / 0.28);
      const settleHead = Math.sin(afterHead * Math.PI * 2.2) * Math.pow(1 - afterHead, 1.3);

      j.body.rotation.z = land * Math.PI * 0.48 + settle * 0.09 - antic * 0.07;
      j.body.rotation.x = antic * 0.10 - land * 0.06;
      // Only a shallow sink. The topple pivots about the ROOT, which sits at floor
      // level, so a near-90-degree rotation already lays the body down at y~0 by
      // itself — every extra centimetre of downward translation just buries the
      // half of the body that rotated below the pivot. Measured lowest point went
      // to -1.19 m at 0.30; the previous rig reached -0.96 m and this reaches -0.79.
      j.body.position.y = antic * 0.10 - land * 0.12 + settle * 0.045 + impact * 0.05;
      j.head.rotation.x += land * 0.55 - antic * 0.25 + settleHead * 0.30;
      j.head.rotation.z += -land * 0.20;
      j.shoulderL.rotation.x += land * 1.30 + settle * 0.30;
      j.shoulderR.rotation.x += land * 1.05 + settle * 0.26;
      j.elbowL.rotation.x -= land * 0.55;
      j.elbowR.rotation.x -= land * 0.45;
      j.kneeL.rotation.x += land * 0.70;
      j.kneeR.rotation.x += land * 0.55;
      j.hipL.rotation.x -= land * 0.35;
      j.hipR.rotation.x -= land * 0.20;
      sqX *= 1 + impact * 0.17 + land * 0.05;
      sqY *= 1 - impact * 0.17 - land * 0.04;

      // `dead01` is NOT clamped by the caller — `deathT / 0.75` keeps growing — so
      // the corpse can go on settling past the nominal end WITHOUT the rig holding
      // any state of its own. A critic measured the last three death frames as
      // bit-identical renders; the curves ran out before the clip did.
      const post = Math.max(0, d - 1);
      if (post < 0.9) {
        const jiggle = Math.sin(post * Math.PI * 3.2) * Math.pow(1 - post / 0.9, 1.5);
        j.head.rotation.x += jiggle * 0.20;
        j.head.rotation.z += jiggle * 0.15;
        j.torso.rotation.z += jiggle * 0.12;
        j.shoulderL.rotation.x += jiggle * 0.26;
        j.shoulderR.rotation.x -= jiggle * 0.21;
        j.kneeL.rotation.x += jiggle * 0.16;
        sqX *= 1 + jiggle * 0.06;
        sqY *= 1 - jiggle * 0.06;
      }
    }

    j.body.scale.set(sqX, sqY, sqX);
  }
}
