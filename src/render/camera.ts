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
// ⚠️ THE `.ts` EXTENSIONS ARE LOAD-BEARING, not a style slip. Node's type-stripping
// resolves no extensions (`src/game/state.ts`'s header says the same thing for the same
// reason), so without them this module cannot be imported from a `.mjs` tool at all —
// and `tools/tmp/sh_dist.mjs` scores the shipped `shakeProximityScale` on a real match
// corpus rather than a transcription of it. A transcribed curve is a curve nothing gates.
import { WORLD_SCALE, wu } from '../units.ts';
import { CHARACTERS, HIT_RADIUS_VS_PLAYER, PLAYER_SPEED, TRAIL } from '../game/rules.ts';

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
//      max weapon `range`            140 wu   (`REACH.rangedMax` — Lettuce Fling /
//                                              Topping Swarm / Hatch! / Big Catch,
//                                              tied. See `MAX_WEAPON_RANGE`)
//    + HIT_RADIUS_VS_PLAYER         25.2 wu   projectiles spawn at the attacker's
//                                              centre (combat.ts `origin`) and connect
//                                              within this radius of yours, so the
//                                              attacker's usable reach is range + this
//    ------------------------------------
//    = 165.2 wu
//
//    EXCLUDED: Lollipop's Giant Lollipop (`giantSlam`, range 400, cone 360°). It is
//    an 8 s-cooldown map-scale ultimate whose screen-filling slam visual tells you what
//    hit you and roughly where it came from, without needing the caster in frame.
//
//    NOTE — this was verified in 2026-08-04 and the exclusion holds, but NOT for the
//    reason originally written here. The word "warning" was wrong: the slam resolves on
//    the SAME sim tick it is cast (melee damage is instantaneous in `combat.ts`), so the
//    visual cannot be dodged. It is an ATTRIBUTION cue that arrives with the damage, not
//    a warning that precedes it. Verified readable at 4:3 — the narrowest supported
//    aspect and therefore the binding case — with the caster 395 wu away and projecting
//    off screen; a blind critic traced the boundary arc back to within ~80 px of the
//    caster's true position. Whether an instantaneous, unavoidable, map-scale hit from
//    an unseen attacker is acceptable DESIGN is a separate question, raised with Uri.
//
//    Covering it instead would demand a 459 wu radius —
//    a 918 wu square, two thirds of the 1400 wu arena's width, on screen at all
//    times. => CONSTRAINT ON THE VFX OWNER: the giantSlam tell must be readable when
//    the caster is OFF SCREEN. That constraint got HEAVIER with the 2026-08-03 range
//    retune: the slam reaches 2.0x the guaranteed radius now, where it used to reach
//    1.25x, so the caster is off screen far more of the time.
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
// 3. FAIR_PLAY.radiusUnits = 165.2 + 34.0 = 199.2 wu.
//
//    Threat is radial (twin-stick, 360° facing), so the guaranteed region is the
//    DISC of that radius — and a disc of radius R is contained in the view iff both
//    half-extents are >= R. The rectangle is therefore the square 398.4 x 398.4 wu
//    (19.9 x 19.9 m) centred ON THE PLAYER, not on the arena and not on the frame.
//
// ── What this costs, and the one knob ───────────────────────────────────────
//
// Honouring it puts the camera at 26.6 m at 16:9, where characters read at ~13% of
// frame height — the Brawl Stars / Zooba band.
//
// It did not always. Against the ORIGINAL transcribed ranges (max 260 wu) this same
// rule demanded R = 319.2 and a 42.7 m camera, which shrank characters to ~8% — a
// third of their previous size. That was forced by a 2D design whose 360x240
// scrolling viewport had always allowed off-screen attackers; the ranges were never
// authored for a camera that guarantees you see who is shooting you. Rather than
// weaken the guarantee, Uri's call (2026-08-03) was to retune the ranges for the
// camera. `REACH` in `game/rules.ts` is that retune, and `rangedMax` there is the
// number that actually sets this radius.
//
// So DO NOT tune framing here. `radiusUnits` stays derived from `rules.ts`; if the
// camera needs to move, move `REACH.rangedMax` and let it fall out. The one escape
// hatch, if a future cast needs genuinely long-range weapons back, is to weaken the
// criterion itself to "react-in-time": max MELEE reach + reaction = 84 + 25.2 + 34 =
// 143.2 wu, which would let ranged fighters plink from off screen while still
// guaranteeing you see every projectile for >= 2 evade windows before impact. Note
// that is a LOOSER rule but a SMALLER radius, i.e. an even closer camera — it buys
// range, not framing. Either way: never hardcode a view width at a call site.
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
  /**
   * 4:3 — iPad, the narrowest landscape we support. Narrower than this is masked.
   *
   * ── 🚨 WIDENING THIS COSTS 2.96x THE ARENA DEPTH, AND `aspect.mjs` CANNOT SEE IT ─────
   *
   * This constant is the single biggest item on `docs/PHONE.md`'s page: it takes **43% of
   * a phone's screen in portrait**, more than the browser's chrome does. It gets proposed
   * for widening roughly once per phone pass, so the trade is measured here rather than
   * re-argued. `node tools/tmp/sc2_screen.mjs`, two builds differing in this one number,
   * iPhone 15 portrait at full screen:
   *
   *              canvas       game/screen   guaranteed R   visible DEPTH
   *   min 4/3    393 x 295       34.6%        199.22 wu       462 wu
   *   min 0.46   393 x 852      100.0%        199.22 wu      1181 wu
   *   (landscape 852 x 393      100.0%        199.22 wu       398 wu)
   *
   * 🚨 **`tools/aspect.mjs` PASSES AT 0.00 wu ON BOTH.** That is not a bug in it — it
   * checks the SPREAD of `guaranteedRadiusUnits`, which is a FLOOR that
   * `computeFairDistance()` holds at EVERY aspect by construction. The quantity that moves
   * is the **BLEED**, and nothing gates the bleed. So "widen it, aspect.mjs still passes"
   * is a confident wrong answer from a real instrument — CLAUDE.md #6 — and the fairness
   * gate must not be quoted as evidence FOR this change.
   *
   * What a widened mask would actually hand a portrait player: **2.96x the arena depth a
   * landscape player sees on the same phone** (1181 wu against 398), because a narrow
   * aspect is width-binding, so `distForWidth` scales with `1/tanHalfH` and the camera
   * retreats. Today's 4:3 portrait already sees 1.16x, and that bounded surplus is exactly
   * what the cap is for.
   *
   * And a THIRD cost, visible in the pixels rather than the numbers — read
   * `shots/sc2/WIDE_0_46_iPhone_15_standalone.png`: at 2.5x the camera distance the depth
   * fog saturates and washes the entire top half of the frame flat orange, and the fighter
   * is a speck. The atmospheric schedule is tuned for the shipped distance range. Widening
   * does not just trade fairness for area; it breaks the look.
   *
   * A derived middle point, for anyone who wants one (closed form above, NOT measured):
   * `min: 1` gives a 393x393 portrait canvas — 46.1% of the screen — at 589 wu of depth,
   * i.e. 1.48x a landscape player instead of today's 1.16x.
   *
   * => **DO NOT WIDEN THIS.** `docs/DECISIONS-FOR-URI.md` §14 is already answered by Uri —
   * *"i think the game should be landscape. Portrait can't serve the game. When it will be
   * in an app, we'll force landscape."* Portrait gets a **rotate prompt** (`src/ui/**`),
   * and the app wrapper gets the lock (§51a). Both delete the case; neither costs a wu.
   */
  min: 4 / 3,
  /**
   * 21:9 — ultrawide desktop and 21:9 phones (Xperia). Wider than this is masked.
   *
   * At the cap a player sees 760 wu of arena width against 504 wu at 4:3, so up to
   * 181 wu each side of the guaranteed square is BLEED. Everything that decides a
   * fight — cover, hazards, spawns, pickups, the fog edge — must be readable from
   * inside the 398 wu square; anything that only becomes visible in the bleed must be
   * decoration with no collision and no gameplay effect.
   */
  max: 21 / 9,
} as const;

// ─────────────────────────────────────────────────────────────────────────────
// GROUND REACH — the closed forms, lifted to module scope as PURE FUNCTIONS.
//
// `CameraRig` calls these for its OWN aspect. `shakeFadeRadiusUnits()` calls them for an
// aspect the rig is NOT at — "what would the widest supported display see?" — which the
// instance methods cannot answer without mutating the rig and putting it back. Lifting is
// deliberate rather than copying the solve for the second caller: a second copy would be
// exercised only by the new caller, and `tools/aspect.mjs` — the gate that would catch a
// drift between them — walks the rig's path and only the rig's path.
// ─────────────────────────────────────────────────────────────────────────────

/**
 * How much ground the pitched frustum reaches per metre of camera distance, toward the
 * bottom (`near`) and top (`far`) of the frame, measured from the camera's AIM point.
 *
 * Both are linear in distance, which is what makes the fair-rectangle fit a closed form
 * rather than a search. Guarded at both ends: a shallow enough pitch puts the horizon in
 * frame (far -> infinity) and a steep enough one would put the camera's own position
 * inside the near edge.
 */
function groundReachPerMetreAt(pitchDeg: number, fovDeg: number): { near: number; far: number } {
  const vFov = THREE.MathUtils.degToRad(fovDeg);
  const pitch = THREE.MathUtils.degToRad(pitchDeg);
  const cosP = Math.cos(pitch);
  const sinP = Math.sin(pitch);
  const nearAngle = pitch + vFov / 2;
  const farAngle = pitch - vFov / 2;
  const near = nearAngle >= Math.PI / 2 ? cosP : cosP - sinP / Math.tan(nearAngle);
  const far = farAngle <= 0.02 ? 8 : Math.min(8, sinP / Math.tan(farAngle) - cosP);
  return { near: Math.max(0.02, near), far: Math.max(0.02, far) };
}

/** The `frameMode: 'fair'` distance solve. `fairRadiusM` is in METRES; see
 *  `CameraRig.computeFairDistance` for the derivation this implements. */
function fairSolveAt(
  aspect: number, pitchDeg: number, fovDeg: number, fairRadiusM: number,
): { dist: number; lookAhead: number } {
  const vFov = THREE.MathUtils.degToRad(fovDeg);
  const cosP = Math.cos(THREE.MathUtils.degToRad(pitchDeg));
  const { near: kNear, far: kFar } = groundReachPerMetreAt(pitchDeg, fovDeg);
  const tanHalfH = Math.tan(vFov / 2) * aspect;

  const distForDepth = (2 * fairRadiusM) / (kNear + kFar);

  // lookAhead = lookAheadPerMetre * distance; folded into the width solve below.
  const lookAheadPerMetre = (kFar - kNear) / 2;
  const shrink = THREE.MathUtils.clamp(lookAheadPerMetre * cosP, 0, 0.5);
  const distForWidth = (fairRadiusM * (1 / tanHalfH + cosP)) / (1 - shrink);

  const dist = Math.max(distForDepth, distForWidth);
  return { dist, lookAhead: lookAheadPerMetre * dist };
}

/**
 * Radius of the smallest disc, centred on the FOLLOW TARGET, that contains every ground
 * point a `frameMode: 'fair'` frame can show at `aspect`. World units.
 *
 * The visible ground is a trapezoid, not a disc, so this is its FAR CORNER — deliberately
 * the conservative direction. A falloff built on it never silences anything the player can
 * actually see; the price is that a few points which are off screen but nearer than the
 * corner keep some shake. Radial symmetry is worth that: an anisotropic test would make
 * the kick depend on the BEARING to the event, so a fighter circling you at constant range
 * would pump the camera on and off, and it would make the feel depend on the display.
 */
export function visibleGroundRadiusUnits(
  aspect: number, pitchDeg: number, fovDeg: number, fairRadiusUnits: number,
): number {
  const cosP = Math.cos(THREE.MathUtils.degToRad(pitchDeg));
  const tanHalfH = Math.tan(THREE.MathUtils.degToRad(fovDeg) / 2) * aspect;
  const { near: kNear, far: kFar } = groundReachPerMetreAt(pitchDeg, fovDeg);
  const { dist, lookAhead } = fairSolveAt(aspect, pitchDeg, fovDeg, wu(fairRadiusUnits));
  // `kNear`/`kFar` are measured from the AIM point; the corners wanted here are offsets
  // from the TARGET, which sits `lookAhead` back down-screen from it.
  const reachNear = dist * kNear;
  const reachFar = dist * kFar;
  const halfWidthFar = (dist + reachFar * cosP) * tanHalfH;
  const halfWidthNear = Math.max(0, (dist - reachNear * cosP) * tanHalfH);
  return Math.max(
    Math.hypot(reachFar - lookAhead, halfWidthFar),
    Math.hypot(reachNear + lookAhead, halfWidthNear),
  ) / WORLD_SCALE;
}

/**
 * SHAKE PROXIMITY — how much of a camera kick survives the distance from the local seat
 * to whatever caused it.
 *
 * 🚨 REPORTED BY URI ON THE DEPLOYED SIX-FIGHTER BUILD: *"The VFX of screen shaking a bit
 * due to explosions, while playing 6, causes the screen to shake a lot. We need to make
 * sure that the shake only happens when the proximity is close."*
 *
 * `match.ts`'s three kick sites had **no distance term at all**: amplitude was a function
 * of damage and one boolean (was the victim the local seat). At two seats every hit
 * involves you, so "local" and "close" were the same predicate and the omission could not
 * express itself. `tools/tmp/sh_dist.mjs`, 20 matches each through the real sim, is what
 * it costs at six:
 *
 *                 kicks/match   shake asked for   median distance from slot 0
 *      N = 2            25.4     5.278 m/match                  1 wu
 *      N = 6           178.4    26.642 m/match              1 275 wu
 *
 * 7.0x the kick rate and 5.0x the amplitude, overwhelmingly from events a THOUSAND world
 * units away. Same root cause `lu2_offscreen` found for the HUD (63.7-82.9% of opponent HP
 * pills at six seats belonged to a fighter outside the frame, mean separation 1 534 wu) —
 * different symptom.
 *
 * ── THE TWO RADII ARE DERIVED, NOT CHOSEN ────────────────────────────────────
 *
 *   FULL  `FAIR_PLAY.radiusUnits` — the disc EVERY supported display is guaranteed to
 *         show. Inside it the event is on your screen whatever device you hold, so the
 *         kick is delivered at exactly its old amplitude. The scale is **1.000 at and
 *         below this radius**, which is why a hit on the local seat (distance 0) is
 *         bit-identical to the pre-change build and the 1.25x local-seat bias is
 *         untouched — proximity MULTIPLIES with that bias, it does not subsume it. The
 *         two answer different questions: WHERE, and WHO.
 *   FADE  `CameraRig.shakeFadeRadiusUnits()` — the farthest ground point ANY supported
 *         aspect can show. Beyond it nothing on the ground is on screen on any device.
 *
 * Both come out of the per-aspect solve but the pair is aspect-INDEPENDENT on purpose: a
 * kick is a translation of the whole camera and therefore momentarily costs fair-play
 * radius (`match.ts:kick`), so letting its amplitude depend on the player's display would
 * let the effective guarantee depend on the display. Taking the max over the supported
 * band is the conservative direction — nobody's visible shake is cut.
 *
 * ── AND WHY THERE IS A FLOOR RATHER THAN SILENCE ─────────────────────────────
 *
 * Uri's sentence is about the LOUD case, not about silence at range, and a six-way brawl
 * that goes dead still whenever the fight moves off screen reads as broken. So the floor
 * is derived rather than tasted: `CameraRig.update` **zeroes** the shake below 0.002 m,
 * and the smallest kick `match.ts` can ask for is **0.012 m** (`hit-landed`'s clamp
 * minimum). At 0.15 that smallest kick arrives as 0.0018 m — under the rig's own cutoff,
 * so chip damage from across the map is not merely quiet, it is **provably invisible** —
 * while the loudest (a death or a slam, both clamped to `SHAKE_MAX_M` = 0.40 m) still
 * arrives as 0.060 m, ~30x that cutoff. Loud things far away rumble; small things far
 * away are gone. Any floor at or above 1/6 breaks that derivation.
 */
export const SHAKE_PROXIMITY = {
  /** Full amplitude at and inside this radius, world units. */
  fullRadiusUnits: FAIR_PLAY.radiusUnits,
  /** Residual fraction at and beyond the fade radius. Derived above; not a taste dial. */
  floor: 0.15,
} as const;

/**
 * The multiplier a camera kick gets for happening `distanceUnits` from the local seat.
 * 1.0 inside `SHAKE_PROXIMITY.fullRadiusUnits`, `floor` at and beyond `fadeRadiusUnits`,
 * smoothstepped between — C1 at BOTH ends, so neither boundary pops as a fighter walks
 * across it. (A hard cut at either radius pops; that is why this is a curve.)
 *
 * `floor` is a parameter ONLY so `tools/tmp/sh_dist.mjs --sweep` can score candidates on a
 * real corpus without carrying a second copy of this curve. Every shipped caller takes the
 * default, and a second copy is what the sweep exists to avoid.
 */
export function shakeProximityScale(
  distanceUnits: number,
  fadeRadiusUnits: number,
  floor: number = SHAKE_PROXIMITY.floor,
): number {
  const full = SHAKE_PROXIMITY.fullRadiusUnits;
  const t = THREE.MathUtils.smoothstep(distanceUnits, full, Math.max(fadeRadiusUnits, full + 1e-6));
  return 1 - (1 - floor) * t;
}

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
    // Far plane must clear the fair framing: the camera sits ~31 m out at 4:3 (the
    // widest-binding aspect) and the far edge of the ground window is further again.
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
    return groundReachPerMetreAt(this.pitchDeg, this.camera.fov);
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
    // The solve itself lives at module scope (`fairSolveAt`) so `shakeFadeRadiusUnits()`
    // can evaluate it for an aspect this rig is not at. Same arithmetic, one copy.
    const { dist, lookAhead } = fairSolveAt(
      this.aspect, this.pitchDeg, this.camera.fov, wu(this.fairRadiusUnits),
    );
    this.lookAhead = lookAhead;
    return dist;
  }

  /**
   * The distance at which a camera kick has decayed to `SHAKE_PROXIMITY.floor`, in world
   * units: the farthest ground point any SUPPORTED aspect can show at this rig's pitch,
   * fov and fair radius. See `SHAKE_PROXIMITY` for what it is for.
   *
   * ⚠️ SAMPLED ACROSS THE BAND rather than evaluated at its two ends, because the reach is
   * **not monotone in aspect**: below the width/depth crossover (~1.6) the rig sits further
   * back — 30.9 m at 4:3 against 26.6 m at 16:9 — so 4:3's corner beats 16:10's and the
   * minimum is in the interior. Reading `SUPPORTED_ASPECT.max` alone is right today and
   * silently wrong the day the crossover moves, which `fov` or `pitchDeg` can do.
   */
  shakeFadeRadiusUnits(): number {
    const STEPS = 32;
    let max = 0;
    for (let i = 0; i <= STEPS; i++) {
      const a = SUPPORTED_ASPECT.min + (SUPPORTED_ASPECT.max - SUPPORTED_ASPECT.min) * (i / STEPS);
      const r = visibleGroundRadiusUnits(a, this.pitchDeg, this.camera.fov, this.fairRadiusUnits);
      if (r > max) max = r;
    }
    return max;
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

  /**
   * 🚨 THE `dtSeconds > 0` GUARD IS A MEASUREMENT FIX, NOT A FEEL CHANGE.
   *
   * The decay below is multiplied by `dtSeconds`; the RE-RANDOMISATION under it was
   * not. So at `dt = 0` the amount never fell, the exit test at the bottom was never
   * reached, and **every call re-rolled `shakeOffset` to a new random vector** — while
   * `Stage.render()` calls this before it draws. A frozen frame was therefore not a
   * frozen camera: measured on `189d6ed`, **344 of 344 frozen frames drifted, up to
   * 349 px of mask**, and every rAF-frozen probe in this repo that renders twice with
   * shake alive has been diffing two different camera positions. `feel_probe.mjs`
   * zeroes the offset around its own captures for exactly this reason and never
   * generalised it (`docs/AGENT-BRIEF.md` §3).
   *
   * ⚠️ **The guard is chosen so the SHIPPED feel is unchanged by construction.** At any
   * `dt > 0` — every frame the player ever sees — the condition is true and the body
   * below is byte-for-byte the code that shipped: same decay, same three `Math.random`
   * draws in the same order, same exit threshold. Only `dt <= 0` behaves differently,
   * and there the new behaviour is the honest one: no time passed, so the shake HOLDS
   * its offset instead of inventing a new sample out of nothing.
   *
   * ⚠️ `shell.ts` clamps its rAF delta with `Math.max(0, …)`, so `dt === 0` also occurs
   * in real play (first frame, or two rAF callbacks on one timestamp). Holding is
   * correct there too — a zero-length frame that moved the camera was always a bug,
   * it was simply invisible next to the 16 ms ones.
   *
   * Do NOT "fix" this by stilling the shake for probes some other way (a debug flag, a
   * global): the defect is in the integrator, and a probe-only workaround leaves the
   * next probe to rediscover it, which is how this survived to be found by a drift
   * control on an unrelated pass.
   */
  update(dtSeconds: number): void {
    const t = 1 - Math.pow(1 - this.followLerp, dtSeconds * 60);
    this.target.lerp(this.desired, t);

    if (dtSeconds > 0 && this.shakeAmount > 0.0001) {
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
