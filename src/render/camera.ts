/**
 * Camera rig — tilted top-down, the Brawl Stars / Zooba framing.
 *
 * A perspective camera with a fairly narrow FOV, pitched down steeply and orbited
 * slightly, so 3D models read as a clean top-down brawler while still showing their
 * fronts and picking up rim light. Orthographic would flatten the characters and
 * lose exactly the depth cue we're building models for.
 *
 * ── Viewport fairness (`frameMode: 'fair'`) ─────────────────────────────────────
 * This is a real-time PvP brawler, so how much arena a player can see is a balance
 * number, not a layout preference. `'fair'` mode fits a gameplay-derived FAIR-PLAY
 * RECTANGLE (see `FAIR_PLAY` below) at whatever aspect ratio the device happens to
 * have, so a phone in landscape, a 16:9 desktop and a 4:3 tablet are all guaranteed
 * the same view distance in every direction. Read `FAIR_PLAY` before touching any
 * framing number in here.
 */

import * as THREE from 'three';
import { WORLD_SCALE, wu } from '../units';
import { CHARACTERS, HIT_RADIUS_VS_PLAYER, PLAYER_SPEED, TRAIL } from '../game/rules';

// ─────────────────────────────────────────────────────────────────────────────
// THE FAIR-PLAY RECTANGLE
// ─────────────────────────────────────────────────────────────────────────────
//
// The region, in world units, that EVERY supported device is guaranteed to show
// around the player. It is derived from `game/rules.ts` (the frozen design), never
// from a screen size — a screen-derived window is exactly how the old rig ended up
// giving a 4:3 tablet 75% more forward vision than a 21:9 display.
//
// ── Derivation ──────────────────────────────────────────────────────────────
//
// 1. LONGEST THREAT REACH — the greatest centre-to-centre distance from which an
//    opponent can land a hit on you.
//
//      max weapon `range`            260 wu   (Lettuce Fling / Topping Swarm /
//                                              Hatch!, tied — see `MAX_WEAPON_RANGE`)
//    + HIT_RADIUS_VS_PLAYER         25.2 wu   projectiles spawn at the attacker's
//                                              centre (combat.ts `origin`) and connect
//                                              within this radius of yours, so the
//                                              attacker's usable reach is range + this
//    ------------------------------------
//    = 285.2 wu
//
//    EXCLUDED: Lollipop's Giant Lollipop (`giantSlam`, range 400, cone 360°). It is
//    an 8 s-cooldown map-scale ultimate whose warning is the screen-filling slam
//    visual, not the sight of the caster; covering it would demand a 918 wu radius,
//    i.e. 95% of the arena's width on screen at all times. => CONSTRAINT ON THE VFX
//    OWNER: the giantSlam tell must be readable when the caster is OFF SCREEN.
//
// 2. REACTION DISTANCE — a threat must be visible for long enough to be answered,
//    not merely visible at the instant it connects.
//
//      evade window  = HIT_RADIUS_VS_PLAYER / PLAYER_SPEED
//                    = 25.2 wu / 0.12 wu·ms⁻¹ = 210 ms
//        (the time it takes, at base speed, to move your own hit radius out of the
//         line of fire — the shortest reaction that changes an outcome in this game)
//      max closing   = PLAYER_SPEED * TRAIL.speedBoost
//                    = 0.12 * 1.35 = 0.162 wu·ms⁻¹   (nothing in rules.ts moves faster)
//      reaction dist = 0.162 * 210 = 34.0 wu
//
// 3. FAIR_PLAY.radiusUnits = 285.2 + 34.0 = 319.2 wu.
//
//    Threat is radial (twin-stick, 360° facing), so the guaranteed region is the
//    DISC of that radius — and a disc of radius R is contained in the view iff both
//    half-extents are >= R. The rectangle is therefore the square 638.4 x 638.4 wu
//    (31.9 x 31.9 m) centred ON THE PLAYER, not on the arena and not on the frame.
//
// ── What this costs, and the one knob ───────────────────────────────────────
//
// Honouring it pulls the camera from 14.4 m to 42.7 m at 16:9 (characters go from
// 24% to 8% of frame height). That is forced by the frozen ranges: the prototype
// used a 360x240 viewport with a 260 wu weapon, i.e. the 2D design always allowed
// off-screen attackers. If that zoom is judged unshippable, the ONLY honest knob is
// this radius, and the next defensible value down is the "react-in-time" criterion
// (see the report): max MELEE reach + reaction = 120 + 25.2 + 34 = 179 wu, which
// lets ranged fighters plink from off screen but still guarantees you see every
// projectile for >= 2 evade windows before impact. Change `radiusUnits` here — never
// by hardcoding a view width at a call site.
// ─────────────────────────────────────────────────────────────────────────────

/** Longest `range` on any weapon that is not a map-scale ultimate, in world units. */
const MAX_WEAPON_RANGE = (() => {
  let max = 0;
  for (const def of Object.values(CHARACTERS)) {
    for (const w of def.weapons) {
      if (w.giantSlam) continue; // map-scale ultimate; see note above
      max = Math.max(max, w.range ?? 0);
    }
  }
  return max;
})();

/** Longest distance an opponent can hit you from, centre to centre, in world units. */
const MAX_THREAT_REACH = MAX_WEAPON_RANGE + HIT_RADIUS_VS_PLAYER;

/** Shortest reaction that changes an outcome: clearing your own hit radius, in ms. */
const EVADE_WINDOW_MS = HIT_RADIUS_VS_PLAYER / PLAYER_SPEED;

/** Fastest anything in the frozen design travels, in world units per ms. */
const MAX_CLOSING_SPEED = PLAYER_SPEED * TRAIL.speedBoost;

export const FAIR_PLAY = {
  maxWeaponRangeUnits: MAX_WEAPON_RANGE,
  maxThreatReachUnits: MAX_THREAT_REACH,
  evadeWindowMs: EVADE_WINDOW_MS,
  reactionDistanceUnits: MAX_CLOSING_SPEED * EVADE_WINDOW_MS,
  /** Guaranteed visible radius around the player, in world units. */
  radiusUnits: MAX_THREAT_REACH + MAX_CLOSING_SPEED * EVADE_WINDOW_MS,
  /** The guaranteed rectangle itself, in world units (a square — threat is radial). */
  get rectUnits() {
    return { w: this.radiusUnits * 2, h: this.radiusUnits * 2 };
  },
} as const;

/**
 * SURPLUS POLICY — COSMETIC BLEED, CAPPED.
 *
 * The fair-play square is a floor, not a ceiling: any screen wider than the square's
 * own ground aspect shows extra arena to the left and right (and a 4:3 tablet shows
 * extra depth instead). Two ways to handle that surplus; we chose the first:
 *
 *   (a) COSMETIC BLEED — render it, and require that nothing which decides a fight
 *       lives only out there. Chosen: it is what shipped mobile brawlers do, it wastes
 *       no pixels on the smallest screens, and letterboxing a phone to a tablet's
 *       aspect would cost a fifth of the display.
 *   (b) HARD MASK — pillarbox/letterbox every device down to one design aspect. Exact
 *       parity, at the price of black bars on nearly every real device.
 *
 * Cosmetic bleed is only *fair* while the bleed stays small, so it is CAPPED: outside
 * `SUPPORTED_ASPECT` the viewport is hard-masked instead (`Stage.resize()`). Every
 * shipping device — 4:3 tablet through 21:9 phone/ultrawide — sits inside the band and
 * is never masked; a 32:9 desktop or a portrait window is.
 *
 * => CONSTRAINT ON THE ARENA OWNERS: see the note on `SUPPORTED_ASPECT.max`.
 */
export const SUPPORTED_ASPECT = {
  /** 4:3 — iPad, the narrowest landscape we support. Narrower than this is masked. */
  min: 4 / 3,
  /**
   * 21:9 — ultrawide desktop and 21:9 phones (Xperia). Wider than this is masked.
   *
   * At the cap a player sees 1217 wu of arena width against 807 wu at 4:3, so up to
   * 290 wu each side of the guaranteed square is BLEED. Everything that decides a
   * fight — cover, hazards, spawns, pickups, the fog edge — must be readable from
   * inside the 638 wu square; anything that only becomes visible in the bleed must be
   * decoration with no collision and no gameplay effect.
   */
  max: 21 / 9,
} as const;

export interface CameraRigOptions {
  /** Downward pitch in degrees. 90 = straight down. Brawl Stars sits around 55-62. */
  pitchDeg?: number;
  /** Rotation around Y in degrees. Small non-zero values add life. */
  yawDeg?: number;
  /** Vertical field of view. Narrow = less distortion at the frame edges. */
  fov?: number;
  /** How much of the world (in world units, horizontally) should fill the frame. */
  viewWidthUnits?: number;
  /** How quickly the camera catches up to its target. 0-1 per frame at 60fps. */
  followLerp?: number;
  /**
   * 'ground' frames a patch of the GROUND PLANE `viewWidthUnits` wide — correct for
   * arena/prop previews, where the framing is chosen by the reviewer.
   *
   * 'subject' frames a STANDING SUBJECT `subjectHeight` metres tall — correct for
   * character previews. Using ground-framing on a preview pushes the camera back by
   * 1/sin(pitch), which at a shallow preview pitch shrinks the model to a speck.
   *
   * 'fair' frames the FAIR-PLAY RECTANGLE — the only correct mode for an actual
   * match, because it is the only one whose framing does not change with the
   * player's display. Ignores `viewWidthUnits`.
   */
  frameMode?: 'ground' | 'subject' | 'fair';
  /** 'subject' mode: height in metres that should fill `subjectFill` of the frame. */
  subjectHeight?: number;
  /** 'subject' mode: fraction of frame height the subject occupies. Default 0.62. */
  subjectFill?: number;
  /** Raise the look-at point off the floor, in metres. */
  targetHeight?: number;
  /** 'fair' mode: guaranteed visible radius, world units. Defaults to `FAIR_PLAY`. */
  fairRadiusUnits?: number;
}

/** What the rig can actually see of the ground, in world units. For verification. */
export interface GroundWindow {
  /** Aspect the numbers were solved for. */
  aspect: number;
  /** Camera distance from its look-at point, in metres. */
  distanceM: number;
  /** Which axis forced that distance. */
  binding: 'width' | 'depth' | 'n/a';
  /** Ground visible toward the bottom of the frame, from the player, world units. */
  nearUnits: number;
  /** Ground visible toward the top of the frame, from the player, world units. */
  farUnits: number;
  /** Half-width at the player's own depth, world units. */
  halfWidthUnits: number;
  /** Half-width at the near edge of the fair square — the binding width, world units. */
  halfWidthAtFairEdgeUnits: number;
  /** Radius guaranteed visible in every direction = min(near, far, halfWidthAtEdge). */
  guaranteedRadiusUnits: number;
}

export class CameraRig {
  readonly camera: THREE.PerspectiveCamera;
  pitchDeg: number;
  yawDeg: number;
  viewWidthUnits: number;
  followLerp: number;
  frameMode: 'ground' | 'subject' | 'fair';
  subjectHeight: number;
  subjectFill: number;
  targetHeight: number;
  fairRadiusUnits: number;

  /** Look-at point on the ground plane, in metres. */
  private target = new THREE.Vector3(0, 0, 0);
  private desired = new THREE.Vector3(0, 0, 0);
  /** Additive shake offset, in metres. */
  private shakeOffset = new THREE.Vector3();
  private shakeAmount = 0;
  private shakeDecay = 0;
  private aspect = 16 / 9;
  /**
   * 'fair' mode: how far up-screen the look-at point sits from the player, in metres.
   *
   * A pitched camera does not show the same amount of ground in front of and behind
   * its look-at point — at pitch 58 / fov 34 the far half is 47% longer than the near
   * half. Aiming slightly past the player re-centres the visible ground ON the player,
   * which is what makes the guaranteed region a true disc; without it the same
   * guarantee costs 19% more camera distance for the same protection.
   */
  private lookAhead = 0;

  constructor(opts: CameraRigOptions = {}) {
    this.pitchDeg = opts.pitchDeg ?? 58;
    this.yawDeg = opts.yawDeg ?? 0;
    this.viewWidthUnits = opts.viewWidthUnits ?? 360;
    this.followLerp = opts.followLerp ?? 0.12;
    this.frameMode = opts.frameMode ?? 'ground';
    this.subjectHeight = opts.subjectHeight ?? 2.1;
    this.subjectFill = opts.subjectFill ?? 0.62;
    this.targetHeight = opts.targetHeight ?? 0;
    this.fairRadiusUnits = opts.fairRadiusUnits ?? FAIR_PLAY.radiusUnits;
    // Far plane must clear the fair framing: the camera sits ~50 m out at 4:3 and the
    // far edge of the ground window is further again.
    this.camera = new THREE.PerspectiveCamera(opts.fov ?? 34, this.aspect, 0.5, 300);
    this.camera.name = 'gameCamera';
    this.apply();

    // Verification hook for the aspect-isolation harness: a match rig publishes what
    // it can actually see, so the four aspect shots can be checked against numbers
    // rather than against an impression of the picture.
    if (this.frameMode === 'fair' && typeof window !== 'undefined') {
      (window as unknown as { __fairView?: () => GroundWindow }).__fairView = () => this.groundWindow();
    }
  }

  setAspect(aspect: number): void {
    this.aspect = aspect;
    this.camera.aspect = aspect;
    this.camera.updateProjectionMatrix();
    this.apply();
  }

  /**
   * How much ground the pitched frustum reaches per metre of camera distance, toward
   * the bottom (`near`) and top (`far`) of the frame, measured from the look-at point.
   *
   * Both are linear in distance, which is what makes the fair-rectangle fit a closed
   * form rather than a search. Guarded at both ends: a shallow enough pitch puts the
   * horizon in frame (far -> infinity) and a steep enough one would put the camera's
   * own position inside the near edge.
   */
  private groundReachPerMetre(): { near: number; far: number } {
    const vFov = THREE.MathUtils.degToRad(this.camera.fov);
    const pitch = THREE.MathUtils.degToRad(this.pitchDeg);
    const cosP = Math.cos(pitch);
    const sinP = Math.sin(pitch);
    const nearAngle = pitch + vFov / 2;
    const farAngle = pitch - vFov / 2;
    const near = nearAngle >= Math.PI / 2 ? cosP : cosP - sinP / Math.tan(nearAngle);
    const far = farAngle <= 0.02 ? 8 : Math.min(8, sinP / Math.tan(farAngle) - cosP);
    return { near: Math.max(0.02, near), far: Math.max(0.02, far) };
  }

  /** Distance needed to frame the ground patch, the standing subject, or the fair rect. */
  private computeDistance(): number {
    const vFov = THREE.MathUtils.degToRad(this.camera.fov);

    if (this.frameMode === 'subject') {
      // Fit `subjectHeight` into `subjectFill` of the vertical frame. No pitch
      // compensation — the subject stands up out of the ground plane, so it is not
      // foreshortened the way the floor is.
      const targetVisibleH = this.subjectHeight / THREE.MathUtils.clamp(this.subjectFill, 0.05, 1);
      this.lookAhead = 0;
      return (targetVisibleH / 2) / Math.tan(vFov / 2);
    }

    if (this.frameMode === 'fair') return this.computeFairDistance();

    this.lookAhead = 0;
    const halfW = (this.viewWidthUnits * WORLD_SCALE) / 2;
    const hFov = 2 * Math.atan(Math.tan(vFov / 2) * this.aspect);
    const distForWidth = halfW / Math.tan(hFov / 2);
    // Pitching the camera foreshortens the ground plane; compensate so the framed
    // ground width stays constant regardless of pitch. (Strictly this is the DEPTH
    // correction — a ground span across the frame is not foreshortened at all — so
    // 'ground' mode actually frames viewWidthUnits/sin(pitch). Left as-is on purpose:
    // every preview framing in `preview.ts` is calibrated against these numbers.)
    const pitch = THREE.MathUtils.degToRad(this.pitchDeg);
    return distForWidth / Math.max(0.35, Math.sin(pitch));
  }

  /**
   * Solve the camera distance that contains the fair-play square at the CURRENT
   * aspect, fitting by whichever axis binds.
   *
   * With the ground window re-centred on the player (`lookAhead`), the near and far
   * halves are equal, so depth is satisfied by
   *     d * (kNear + kFar) / 2 >= R.
   * Width binds at the NEAREST edge of the square (z = +R from the player, the
   * narrowest part of the trapezoid), where the axial distance from the camera is
   * d - (R + lookAhead)·cos(pitch), giving
   *     (d - (R + lookAhead)·cos p) · tan(hFov/2) >= R,
   * and since lookAhead is itself proportional to d this stays a one-line solve.
   *
   * Narrow aspects (4:3) are width-bound; 16:9 and wider are depth-bound. Both cases
   * occur on real devices, which is precisely why fitting always by height was wrong.
   */
  private computeFairDistance(): number {
    const vFov = THREE.MathUtils.degToRad(this.camera.fov);
    const pitch = THREE.MathUtils.degToRad(this.pitchDeg);
    const cosP = Math.cos(pitch);
    const R = wu(this.fairRadiusUnits);
    const { near: kNear, far: kFar } = this.groundReachPerMetre();
    const tanHalfH = Math.tan(vFov / 2) * this.aspect;

    const distForDepth = (2 * R) / (kNear + kFar);

    // lookAhead = lookAheadPerMetre * distance; folded into the width solve below.
    const lookAheadPerMetre = (kFar - kNear) / 2;
    const shrink = THREE.MathUtils.clamp(lookAheadPerMetre * cosP, 0, 0.5);
    const distForWidth = (R * (1 / tanHalfH + cosP)) / (1 - shrink);

    const dist = Math.max(distForDepth, distForWidth);
    this.lookAhead = lookAheadPerMetre * dist;
    return dist;
  }

  /**
   * What the rig can actually see of the ground right now, in world units.
   *
   * This is the verification hook for viewport fairness: `guaranteedRadiusUnits` must
   * be >= `FAIR_PLAY.radiusUnits` on every supported aspect, and it is what the
   * aspect-isolation shots are checked against.
   */
  groundWindow(): GroundWindow {
    const vFov = THREE.MathUtils.degToRad(this.camera.fov);
    const pitch = THREE.MathUtils.degToRad(this.pitchDeg);
    const cosP = Math.cos(pitch);
    const tanHalfH = Math.tan(vFov / 2) * this.aspect;
    const { near: kNear, far: kFar } = this.groundReachPerMetre();
    const dist = this.computeDistance();
    const R = wu(this.fairRadiusUnits);

    const near = dist * kNear + this.lookAhead;
    const far = dist * kFar - this.lookAhead;
    const halfWidth = dist * tanHalfH;
    const halfWidthAtEdge = (dist - (R + this.lookAhead) * cosP) * tanHalfH;

    let binding: GroundWindow['binding'] = 'n/a';
    if (this.frameMode === 'fair') {
      const distForDepth = (2 * R) / (kNear + kFar);
      binding = dist > distForDepth + 1e-6 ? 'width' : 'depth';
    }

    const toUnits = (m: number) => m / WORLD_SCALE;
    return {
      aspect: this.aspect,
      distanceM: dist,
      binding,
      nearUnits: toUnits(near),
      farUnits: toUnits(far),
      halfWidthUnits: toUnits(halfWidth),
      halfWidthAtFairEdgeUnits: toUnits(halfWidthAtEdge),
      guaranteedRadiusUnits: toUnits(Math.min(near, far, halfWidthAtEdge)),
    };
  }

  /** Snap the camera to its computed position immediately. */
  apply(): void {
    const dist = this.computeDistance();
    const pitch = THREE.MathUtils.degToRad(this.pitchDeg);
    const yaw = THREE.MathUtils.degToRad(this.yawDeg);

    const horiz = Math.cos(pitch) * dist;
    const offset = new THREE.Vector3(
      Math.sin(yaw) * horiz,
      Math.sin(pitch) * dist,
      Math.cos(yaw) * horiz
    );

    const c = this.target.clone().add(this.shakeOffset);
    c.y += this.targetHeight;
    // Aim past the player, directly away from the camera, so the visible ground is
    // centred on the player even though the frustum is not (see `lookAhead`).
    if (this.lookAhead !== 0) {
      c.x -= Math.sin(yaw) * this.lookAhead;
      c.z -= Math.cos(yaw) * this.lookAhead;
    }
    this.camera.position.copy(c).add(offset);
    this.camera.lookAt(c);
  }

  /** Set the follow target instantly (use on spawn / respawn). */
  snapTo(x: number, z: number): void {
    this.target.set(x, 0, z);
    this.desired.set(x, 0, z);
    this.apply();
  }

  /** Set the follow target for smooth catch-up. */
  follow(x: number, z: number): void {
    this.desired.set(x, 0, z);
  }

  /** Kick off a screen shake. `amount` is in metres. */
  shake(amount = 0.18, decay = 4.5): void {
    this.shakeAmount = Math.max(this.shakeAmount, amount);
    this.shakeDecay = decay;
  }

  update(dtSeconds: number): void {
    const t = 1 - Math.pow(1 - this.followLerp, dtSeconds * 60);
    this.target.lerp(this.desired, t);

    if (this.shakeAmount > 0.0001) {
      this.shakeAmount = Math.max(0, this.shakeAmount - this.shakeDecay * this.shakeAmount * dtSeconds);
      const a = this.shakeAmount;
      this.shakeOffset.set(
        (Math.random() * 2 - 1) * a,
        (Math.random() * 2 - 1) * a * 0.4,
        (Math.random() * 2 - 1) * a
      );
      if (this.shakeAmount < 0.002) {
        this.shakeAmount = 0;
        this.shakeOffset.set(0, 0, 0);
      }
    }
    this.apply();
  }
}
