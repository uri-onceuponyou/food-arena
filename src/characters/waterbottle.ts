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
 *   Translucent blue bottle, darker cap, big smile.
 *
 * ── Structural fix, round 4 ──────────────────────────────────────────────────
 * Three independent art-director passes in a row flagged the same defect: the
 * eyes floated on a stalk above the cap, detached from the character's actual
 * body. No amount of shrinking the gap or adding a connector fixed it, because
 * the STRUCTURE was wrong — a face perched on top of a hat is never going to read
 * as attached, no matter how solid the perch. The fix is to stop treating the cap
 * as a head-topper and instead put the face on the BOTTLE ITSELF: eyes, brows and
 * a big smile are built directly onto the upper shell wall, just above the label,
 * using the shell's own lathed surface (`shellSurface()`, the same technique
 * `hamburger.ts`'s `crownSurface` and `soup.ts`'s `bowlSurface` use for THEIR
 * curved masses). The cap goes back to being what its name says — a cap, worn on
 * top of the bottle that IS the head — with no face-bearing geometry on it at all.
 */

import * as THREE from 'three';
import { BaseCharacter, type AnimContext } from './types';
import type { CharacterDef } from '../game/rules';
import { PALETTE } from '../game/rules';
import { toonMat, glossyMat, flatMat, outlineGroup, roundedBox } from '../render/toon';
import { ChibiRig, type LimbPart } from './rig';
import { bodyType } from './bodies';
import { CHARACTER_HEIGHT } from '../units';

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

// ── Costume layer ────────────────────────────────────────────────────────────
// A fresh independent art director named the missing costume/accessory layer as
// the TOP gap in the whole cast: without one, characters read as "naked mascot
// body with a themed head glued on" no matter how good the body sculpt is. A
// crossbody sports strap with a pouch and a carabiner clip is this character's
// silhouette-breaking item — it projects past the narrow bottle body the way a
// cape or backpack does on the reference roster — plus a thin retainer cord
// around the shoulder taper as a smaller "sports-cap strap" detail.
const STRAP_FABRIC = '#2E7D5B';    // sporty webbing — a fresh hue not used elsewhere on this character
const STRAP_TRIM = '#1F5A40';
const CARABINER_METAL = '#B6BEC4'; // brushed aluminium — genuinely new metalness on this character

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
const CAP_TOP_F = 0.86; // the cap's own apex — a face landmark no longer, just the cap's shape

// ── Face placement, ON the shell wall ───────────────────────────────────────
// `EYE_Y`/`MOUTH_Y` are in the SAME absolute-fraction-of-R units as
// `SHELL_PROFILE`'s own second column, so they can be fed straight into
// `shellSurface()` below. Both sit in the straight cylindrical wall the profile
// holds at full body radius from y=-0.78 to y=0.00 — clear of the label (which
// spans -0.58 to -0.18) above it, and well below the shoulder taper (which
// begins at 0.10) — the widest, flattest, most camera-facing stretch of the main
// body wall, at the character's actual "chest/collar" height rather than in open
// air above its hat.
const EYE_Y = -0.03;
const MOUTH_Y = -0.145;

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

// ── Bespoke-limb geometry ────────────────────────────────────────────────────
// An independent art director named the shared snowman-body capsule arms and ball
// hands as the single biggest cast-wide tell; a follow-up pass recoloured/rescaled
// the same smooth taper and the note came back a THIRD time — recolouring a shared
// skeleton still reads as a shared skeleton. Round 4 fix: limbs are no longer a
// smooth taper at all. They are a genuinely ribbed/bellows profile — the "squeezable
// plastic hose" read the brief calls for, distinct in silhouette (not just material)
// from every other character's limbs. Kept OPAQUE here deliberately — the file
// header's whole point is that `transmission` is reserved for the head, where
// depth-write behaviour has been carefully reasoned through.

/** A ribbed, bellows-like limb segment: a flat cap at the joint origin (plugs
 * flush with no gap), then a shaft that alternates between a narrower "waist" and
 * a wider "rib" several times along its length before tapering to a rounded tip —
 * a squeeze-bottle accordion hose, not a smooth tapered tube. `taperedLimb`'s own
 * end-cap technique is reused so it still plugs cleanly into the rig's joints. */
function ribbedLimb(len: number, rTop: number, rBot: number, mat: THREE.Material, ribCount = 4, segs = 14): THREE.Mesh {
  // Points MUST run bottom → top for LatheGeometry's automatic normals to face
  // outward — this file's own SHELL_PROFILE comment already documents the same
  // rule; getting it backwards was a round 1 defect elsewhere in this file.
  const capBot = Math.min(rBot, len * 0.32);
  const capTopH = Math.min(rTop * 0.32, len * 0.12);
  const wallBotY = -(len - capBot);
  const wallTopY = -capTopH;
  const CAP = 5;
  const pts: THREE.Vector2[] = [];
  for (let i = CAP; i >= 0; i--) {
    const a = (i / CAP) * Math.PI * 0.5;
    pts.push(new THREE.Vector2(capBot * Math.cos(a), wallBotY - capBot * Math.sin(a)));
  }
  // Ribbed shaft: `ribCount` bulge-waist pairs between the two end caps, radius
  // interpolated from rBot to rTop along the way so the limb still reads as
  // tapered overall (thick near the body, narrower toward the extremity) — the
  // ribbing rides ON TOP of that taper rather than replacing it.
  const shaftSpan = wallTopY - wallBotY;
  const steps = ribCount * 2;
  for (let i = 1; i < steps; i++) {
    const t = i / steps;
    const y = wallBotY + t * shaftSpan;
    const base = THREE.MathUtils.lerp(rBot, rTop, t);
    const isRib = i % 2 === 1; // odd steps bulge OUT, even steps pinch IN
    pts.push(new THREE.Vector2(base * (isRib ? 1.16 : 0.88), y));
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
 * A worn strap: a curved tube from `from` to `to`, bowed out through a control
 * point offset by `bow` — the same bezier-tube technique `soup.ts`'s
 * `buildHandleArc` uses for its bowl-handle arms, reused here for costume
 * webbing that has to read as fabric draped over a body rather than a rigid rod.
 */
function strapArc(from: THREE.Vector3, to: THREE.Vector3, bow: THREE.Vector3, radius: number, mat: THREE.Material): THREE.Mesh {
  const mid = from.clone().add(to).multiplyScalar(0.5).add(bow);
  const curve = new THREE.QuadraticBezierCurve3(from, mid, to);
  const m = new THREE.Mesh(new THREE.TubeGeometry(curve, 12, radius, 8, false), mat);
  m.castShadow = true;
  m.receiveShadow = true;
  return m;
}

/** A grip-ridge ring — the same "thin darker ring around a cylindrical wall" motif
 * the head's cap already uses, echoed here as the limb's cuff/joint accent. */
function ridgeRing(y: number, radius: number, thickness: number, mat: THREE.Material): THREE.Mesh {
  const ring = new THREE.Mesh(new THREE.TorusGeometry(radius, thickness, 8, 20), mat);
  ring.name = 'limb_ridge';
  ring.rotation.x = Math.PI / 2;
  ring.position.y = y;
  ring.castShadow = true;
  ring.receiveShadow = true;
  return ring;
}

// A miniature of the head's own CAP_PROFILE silhouette (narrow base, flared grip
// body, domed top) — the hand becomes a literal little bottle cap, the strongest
// possible "this hand belongs to THIS character" read available, and it moves the
// dark matte cap material down into the silhouette twice instead of once.
const MINI_CAP_PROFILE: Array<[number, number]> = [
  [0, -0.95], [0.35, -0.85], [0.85, -0.55], [0.96, -0.10],
  [0.96, 0.30], [0.70, 0.62], [0.30, 0.80], [0, 0.90],
];

function buildCapHand(R: number, mat: THREE.Material, ridgeMat: THREE.Material): THREE.Group {
  const g = new THREE.Group();
  const pts = MINI_CAP_PROFILE.map(([r, y]) => new THREE.Vector2(r * R, y * R));
  const body = new THREE.Mesh(new THREE.LatheGeometry(pts, 16), mat);
  body.name = 'cap_hand';
  body.castShadow = true;
  body.receiveShadow = true;
  g.add(body);
  for (const yF of [-0.08, 0.14]) {
    g.add(ridgeRing(yF * R, R * 0.99, R * 0.045, ridgeMat));
  }
  return g;
}

// A rounded-bottom "bottle base" foot — echoes the shell's own rounded underside
// (SHELL_PROFILE's bottom curve) instead of the rig's blocky wedge, with a pale
// plastic trim ring near the ankle breaking up the dark boot the same way the
// label wrap breaks up the head's transparency.
const BOTTLE_FOOT_PROFILE: Array<[number, number]> = [
  [0, -1.0], [0.55, -0.92], [0.92, -0.68], [1.0, -0.38],
  [1.0, -0.05], [0.82, 0.10], [0.55, 0.15],
];

function buildBottleFoot(FR: number, mat: THREE.Material, trimMat: THREE.Material): THREE.Group {
  const g = new THREE.Group();
  const heightScale = FR * 1.35;
  const radiusScale = FR * 1.05;
  const pts = BOTTLE_FOOT_PROFILE.map(([r, y]) => new THREE.Vector2(r * radiusScale, y * heightScale));
  const body = new THREE.Mesh(new THREE.LatheGeometry(pts, 18), mat);
  body.name = 'bottle_foot';
  body.position.z = FR * 0.18;
  body.castShadow = true;
  body.receiveShadow = true;
  g.add(body);

  const trim = new THREE.Mesh(new THREE.TorusGeometry(radiusScale * 1.0, FR * 0.03, 8, 20), trimMat);
  trim.name = 'bottle_foot_trim';
  trim.rotation.x = Math.PI / 2;
  trim.position.set(0, -0.05 * heightScale, FR * 0.18);
  trim.castShadow = true;
  trim.receiveShadow = true;
  g.add(trim);

  return g;
}

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
        // not a single hue repeated everywhere. A fresh independent art director named
        // the cast-wide failure directly: Soup, Water Bottle and Sushi all ended up
        // with cream/white tapered limbs and dark boots, reading as the same parts
        // reskinned. The HEAD shell stays pale PLASTIC — that's load-bearing for the
        // transmission/glass read and untouched here — but the limbs/torso move to the
        // richer, more saturated WATER blue (the same hue already used for the water
        // fill and this character's own ability VFX), a real value/saturation break
        // from the pale near-white shell. Dark navy hands/feet stay as the contrast.
        limb: WATER,
        hand: CAP,
        foot: CAP_DARK,
        torso: WATER,
        limbRoughness: 0.4,
      },
      // Body: STUB archetype (see `bodies.ts`) — no torso, head straight onto the
      // hips, very short thick limbs, wide stance. This is the character Uri named
      // when he called for the archetype: "one body type has very short legs and
      // hands, no torso — would work for the bottle."
      //
      // It is also the fix the silhouette test demanded. A bottle is inherently a
      // generic cylinder, and splitting it across a head AND a torso meant the
      // outline was a cylinder interrupted by a waist — two mediocre reads instead
      // of one. As a STUB the whole bottle is one continuous mass from cap to
      // base, which is the only silhouette a bottle actually has.
      //
      // `headFraction` is large because the bottle now IS the body: the shell
      // profile spans -0.94R to +0.90R, so R has to carry nearly the whole height.
      // `shoulderWidth` is the STUB hand-fit — the shell wall is 0.58R at shoulder
      // height, so the arms sit just outside it.
      proportions: bodyType('stub', {
        headFraction: 0.90,
        shoulderWidth: CHARACTER_HEIGHT * 0.31,
      }),
      // Upright and eager — chest forward, one arm raised as if reaching/
      // waving. Distinct from every other character's stance in this file's
      // own cast slice: the only one leaning back into an eager, alert posture.
      stance: {
        shoulderL: 0.46, shoulderR: -0.12,
        elbowL: -0.18, elbowR: -0.46,
        twist: -0.06, headTilt: -0.05, headTurn: 0.12,
        hipSway: 0.015, lean: -0.05,
      },
    });
    this.body.add(this.rig.joints.root);
    this.head = this.rig.joints.head;

    const R = this.rig.headRadius;
    const head = this.rig.joints.head;
    const pt = (rF: number, yF: number) => new THREE.Vector2(rF * R, yF * R);

    /** Exact surface point + outward normal on the shell at a given azimuth
     * (`theta`) and absolute height fraction (`yF`, same units as
     * `SHELL_PROFILE`'s own second column) — the single source of truth for the
     * exterior, so the face lands exactly ON the shell instead of floating above
     * or clipping through it. Same technique as `hamburger.ts`'s `crownSurface`
     * and `soup.ts`'s `bowlSurface`. */
    const shellSurface = (theta: number, yF: number): { pos: THREE.Vector3; normal: THREE.Vector3 } => {
      let seg = SHELL_PROFILE[0];
      let segNext = SHELL_PROFILE[1];
      for (let i = 0; i < SHELL_PROFILE.length - 1; i++) {
        if (yF >= SHELL_PROFILE[i][1] && yF <= SHELL_PROFILE[i + 1][1]) {
          seg = SHELL_PROFILE[i];
          segNext = SHELL_PROFILE[i + 1];
          break;
        }
      }
      const [r0, y0] = seg;
      const [r1, y1] = segNext;
      const t = y1 > y0 ? (yF - y0) / (y1 - y0) : 0;
      const rFrac = r0 + (r1 - r0) * t;
      const radius = rFrac * R;
      const y = yF * R;

      const dR = (r1 - r0) * R;
      const dY = (y1 - y0) * R;
      const n2 = new THREE.Vector2(dY, -dR);
      if (n2.lengthSq() < 1e-8) n2.set(1, 0);
      n2.normalize();

      const nx = Math.sin(theta);
      const nz = Math.cos(theta);
      const pos = new THREE.Vector3(nx * radius, y, nz * radius);
      const normal = new THREE.Vector3(nx * n2.x, n2.y, nz * n2.x).normalize();
      return { pos, normal };
    };

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

    this.buildFace(R, shellSurface);
    this.dressTorsoAsBottle();
    this.dressLimbs();
    this.buildAccessories(R, shellSurface);

    outlineGroup(this.root);
    this.collectFlashTargets();
    this.rig.restPose();
  }

  /**
   * Structural fix, round 4: the face moves OFF the cap and onto the bottle's own
   * body. Three straight rounds of independent art direction named the same
   * defect no matter how the gap above the cap was tuned — "two dark balls on
   * stalks read as insect antennae, not a face" — because floating a face above
   * a hat is the wrong STRUCTURE, not a distance to tune. The bottle IS the head;
   * this treats it that way: eyes, brows and a big smile are built directly onto
   * the shell's own straight-wall surface (via `shellSurface`, this file's own
   * lathe-sampling helper, the same technique `hamburger.ts`'s `crownSurface` and
   * `soup.ts`'s `bowlSurface` use) at `EYE_Y`/`MOUTH_Y` — just above the label,
   * on the widest, flattest, most camera-facing stretch of the main body. The cap
   * goes back to being a plain cap, with no face-bearing geometry on it at all.
   *
   * Both eyes are built from one mirrored loop at an identical `theta`/`EYE_Y`,
   * so any residual asymmetry in the render is the camera angle, not the geometry.
   */
  private buildFace(
    R: number,
    shellSurface: (theta: number, yF: number) => { pos: THREE.Vector3; normal: THREE.Vector3 }
  ): void {
    const head = this.rig.joints.head;
    const ink = PALETTE.ink;

    const EYE_THETA = 0.40;
    const eyeMat = toonMat({ color: ink, roughness: 0.25 });
    const browMat = toonMat({ color: CAP, roughness: 0.4 }); // ties the brows to the cap material
    for (const sx of [-1, 1] as const) {
      const { pos, normal } = shellSurface(sx * EYE_THETA, EYE_Y);
      const outward = new THREE.Vector3(normal.x, 0, normal.z).normalize();
      const eyeG = new THREE.Group();
      eyeG.position.copy(pos).addScaledVector(outward, R * 0.02);
      eyeG.quaternion.setFromUnitVectors(new THREE.Vector3(0, 0, 1), outward);
      head.add(eyeG);

      const eye = new THREE.Mesh(new THREE.SphereGeometry(R * 0.155, 16, 14), eyeMat);
      eye.scale.set(1, 1.05, 0.6);
      eye.castShadow = true;
      eyeG.add(eye);

      const glint = new THREE.Mesh(new THREE.SphereGeometry(R * 0.04, 10, 8), flatMat('#ffffff'));
      glint.position.set(-R * 0.038, R * 0.045, R * 0.075);
      glint.userData.noOutline = true;
      eyeG.add(glint);

      // Brow: a slight friendly lift outward (not a V — this bottle is cheerful,
      // not fierce), on one shared height so the pair reads as deliberately level.
      const brow = new THREE.Mesh(new THREE.CapsuleGeometry(R * 0.022, R * 0.15, 4, 8), browMat);
      brow.name = 'waterbottle_brow';
      brow.rotation.z = Math.PI / 2 - sx * 0.18;
      brow.position.set(0, R * 0.205, R * 0.05);
      brow.castShadow = true;
      eyeG.add(brow);
    }

    // Big, warm smile — per the brief's own spec for this character, and a
    // repeated art-director miss when it lived up on the cap fused against the
    // stalk. Sits centred below the eyes, on the same shell wall, in the label's
    // bright near-white so it reads clearly against the richer WATER-blue shell.
    const mouthPt = shellSurface(0, MOUTH_Y);
    const mouthOutward = new THREE.Vector3(mouthPt.normal.x, 0, mouthPt.normal.z).normalize();
    const mouthG = new THREE.Group();
    mouthG.position.copy(mouthPt.pos).addScaledVector(mouthOutward, R * 0.022);
    mouthG.quaternion.setFromUnitVectors(new THREE.Vector3(0, 0, 1), mouthOutward);
    head.add(mouthG);

    const smileMat = toonMat({ color: LABEL, roughness: 0.4 });
    const smile = new THREE.Mesh(
      new THREE.TorusGeometry(R * 0.165, R * 0.032, 8, 20, Math.PI * 0.8),
      smileMat
    );
    smile.name = 'waterbottle_smile';
    smile.rotation.z = Math.PI * 1.09;
    smile.castShadow = true;
    mouthG.add(smile);
  }

  /**
   * Gives the torso bottle character instead of reading as a plain pale sphere.
   * The rig's default torso is already recoloured to the shell's own PLASTIC
   * tone via the palette, so this doesn't replace it (no `dressTorso` needed) —
   * it reshapes it slightly taller/narrower to break the round "ball body" read,
   * then wraps a label band around the middle, echoing the head's own label
   * wrap so the body reads as unmistakably "this bottle" rather than a generic
   * dressed torso. There is no `torsoSize`-driven helper needed here since the
   * default torso mesh itself is kept and just scaled + decorated in place.
   */
  private dressTorsoAsBottle(): void {
    // Nothing to dress under the STUB archetype (`bodies.ts`): there is no torso
    // mesh and `torsoHeight` is 0, so every offset below would collapse onto the
    // hip line. Kept intact because switching archetype is a supported one-line
    // fix — this is the body Water Bottle wears the moment it has a torso again.
    if (!this.rig.hasTorso) return;
    const tw = this.rig.metrics.torsoWidth;
    const torsoH = this.rig.metrics.torsoHeight;
    const taperMid = 0.86 + 0.30 * Math.sin(0.5 * Math.PI * 0.85); // rig.ts's taper at t=0.5
    const torsoHalfWidthMid = tw * 0.5 * taperMid;

    // Taller, narrower than the rig default — closer to a bottle's own
    // elongated silhouette than a round belly. The torso sits below the neck
    // and above the hips, so scaling it doesn't move the figure's overall
    // top-of-head-to-feet height (verified via the shoot tool's own height
    // print) — free proportion work with no height-budget cost.
    this.rig.torsoMesh?.scale.set(0.92, 1.10, 0.92);

    const labelMat = toonMat({ color: LABEL, roughness: 0.55 });
    const labelTrimMat = toonMat({ color: LABEL_TRIM, roughness: 0.4 });
    const labelRadius = torsoHalfWidthMid * 1.10;
    const labelY = torsoH * 0.56;
    const label = new THREE.Mesh(
      new THREE.CylinderGeometry(labelRadius, labelRadius, torsoH * 0.30, 24, 1, true),
      labelMat
    );
    label.name = 'waterbottle_torso_label';
    label.position.y = labelY;
    label.castShadow = true;
    label.receiveShadow = true;
    this.rig.joints.torso.add(label);
    for (const dy of [-torsoH * 0.15, torsoH * 0.15]) {
      const trim = new THREE.Mesh(new THREE.TorusGeometry(labelRadius, torsoH * 0.014, 6, 24), labelTrimMat);
      trim.name = 'waterbottle_torso_label_trim';
      trim.rotation.x = Math.PI / 2;
      trim.position.y = labelY + dy;
      trim.userData.noOutline = true;
      this.rig.joints.torso.add(trim);
    }
  }

  /**
   * Costume layer: a crossbody sports strap with a hip pouch and a metal
   * carabiner clip (the silhouette-breaking item), a thin retainer cord around
   * the shoulder taper, and beaded condensation droplets on the lower shell —
   * the "cold glass" surface detail the material-fidelity note calls for.
   */
  private buildAccessories(
    R: number,
    shellSurface: (theta: number, yF: number) => { pos: THREE.Vector3; normal: THREE.Vector3 }
  ): void {
    const head = this.rig.joints.head;
    const shoulderWidth = this.rig.metrics.shoulderWidth;
    // Vertical scale for anything worn on the body. With a torso that is the
    // torso's own height; on a STUB body (no torso — see `bodies.ts`) the torso
    // joint has zero extent and every `torsoH * k` offset would pile up on the
    // hip line, so the head mass's radius stands in for it. The fractions below
    // are unchanged and land in the same places on the shell.
    const torsoH = this.rig.hasTorso ? this.rig.metrics.torsoHeight : this.rig.headRadius;

    const strapMat = toonMat({ color: STRAP_FABRIC, roughness: 0.72 });
    const trimMat = toonMat({ color: STRAP_TRIM, roughness: 0.68 });
    const metalMat = toonMat({ color: CARABINER_METAL, roughness: 0.28, metalness: 0.75 });

    // `dressTorsoAsBottle` rescales the rig's default torso (0.92/1.10/0.92).
    // Measuring its REAL half-width off the built mesh (root/hips/torso are all
    // still at their identity rest transform here — `restPose()` runs at the
    // very end of the constructor, so a world-space Box3 on `joints.torso`
    // gives an exact local half-extent) fixed an earlier pass's under-estimate
    // that buried the whole strap/pouch inside the body — but adding a flat
    // clearance margin on TOP of that measurement overshot the other way,
    // pushing the pouch out past the shoulder's own reach so it read as
    // something HELD rather than WORN. The shoulder joint itself
    // (`shoulderWidth`) is already the rig's own "clearly outside the torso"
    // reference every arm uses, so anchoring there — capped against the
    // measured torso only as a safety floor — keeps the pouch snug against the
    // body's own side instead of floating at arm's length.
    // Only meaningful when there IS a torso: on a STUB body `joints.torso` holds
    // nothing but the arm joints, so its bounding box measures the arms and would
    // push the pouch out to the fingertips.
    let torsoHalfW = 0;
    if (this.rig.hasTorso) {
      this.rig.joints.root.updateMatrixWorld(true);
      const torsoBB = new THREE.Box3().setFromObject(this.rig.joints.torso);
      torsoHalfW = Math.max(Math.abs(torsoBB.min.x), Math.abs(torsoBB.max.x));
    }
    const hipX = -Math.max(shoulderWidth * 0.90, torsoHalfW * 0.85);

    // Strap + pouch: a SHORT strap from the shoulder straight down to the
    // waist on the SAME side — not a long diagonal across the whole chest,
    // which read as a rigid rod in an earlier pass. Placement rule: the rig's
    // thighs hang straight DOWN from y=0 in this same torso-local frame, so
    // the pouch/strap low end stays at y ≥ torsoH*0.20 — above the hip line.
    const pouchW = shoulderWidth * 0.62, pouchH = shoulderWidth * 0.62, pouchD = shoulderWidth * 0.34;
    const hipPt = new THREE.Vector3(hipX, torsoH * 0.22, shoulderWidth * 0.12);
    const shoulderPt = new THREE.Vector3(hipX * 0.97, torsoH * 0.80, shoulderWidth * 0.22);
    const strap = strapArc(shoulderPt, hipPt, new THREE.Vector3(-shoulderWidth * 0.18, 0, shoulderWidth * 0.30), shoulderWidth * 0.065, strapMat);
    strap.name = 'waterbottle_strap';
    this.rig.joints.torso.add(strap);

    const pouch = new THREE.Mesh(roundedBox(pouchW, pouchH, pouchD, pouchW * 0.14, 3), trimMat);
    pouch.name = 'waterbottle_pouch';
    pouch.position.copy(hipPt);
    pouch.rotation.set(0.05, 0.15, 0.06);
    pouch.castShadow = true;
    pouch.receiveShadow = true;
    this.rig.joints.torso.add(pouch);

    // Carabiner clip pinning the pouch to the strap — a genuinely new, high-
    // metalness material this character doesn't otherwise carry anywhere on
    // its body.
    const carabiner = new THREE.Mesh(new THREE.TorusGeometry(pouchW * 0.28, pouchW * 0.06, 8, 16, Math.PI * 1.7), metalMat);
    carabiner.name = 'waterbottle_carabiner';
    carabiner.position.copy(hipPt).add(new THREE.Vector3(0, pouchH * 0.55, pouchD * 0.3));
    carabiner.rotation.z = 0.4;
    carabiner.castShadow = true;
    this.rig.joints.torso.add(carabiner);

    // Retainer cord — a thin strap ring around the bottle's own shoulder taper,
    // echoing a sports-cap retainer strap. Built via `shellSurface` so it sits
    // exactly on the shell, never floating or sunk into the taper.
    const cordYF = 0.20;
    const cordPt = shellSurface(0, cordYF).pos;
    const cordRadius = Math.hypot(cordPt.x, cordPt.z) * 1.05;
    const cord = new THREE.Mesh(new THREE.TorusGeometry(cordRadius, R * 0.014, 6, 24), trimMat);
    cord.name = 'waterbottle_cap_strap';
    cord.rotation.x = Math.PI / 2;
    cord.position.y = cordPt.y;
    cord.castShadow = true;
    head.add(cord);

    // Condensation speckles — small beaded droplets on the lower shell, spread
    // around the circumference clear of the face (EYE_THETA=0.40, MOUTH at 0).
    const dropMat = flatMat('#EAFFFF', { transparent: true, opacity: 0.45 });
    const dropSpots: Array<[number, number, number]> = [
      [0.9, -0.55, 0.026], [2.4, -0.42, 0.020], [4.2, -0.30, 0.017],
      [1.6, -0.68, 0.022], [3.3, -0.50, 0.019], [5.4, -0.60, 0.024],
    ];
    for (const [theta, yF, sF] of dropSpots) {
      const { pos, normal } = shellSurface(theta, yF);
      const outward = new THREE.Vector3(normal.x, 0, normal.z).normalize();
      const drop = new THREE.Mesh(new THREE.SphereGeometry(sF * R, 8, 6), dropMat);
      drop.name = 'waterbottle_condensation';
      drop.position.copy(pos).addScaledVector(outward, R * 0.012);
      drop.scale.set(1, 1.3, 0.6);
      drop.userData.noOutline = true;
      head.add(drop);
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

  /**
   * Structural limb rebuild, round 4. Three independent art-director passes named
   * the same root cause: every character shares the identical tapered-tube-and-
   * ball-joint limb TOPOLOGY, and recolouring that shared skeleton doesn't fix it.
   * Water Bottle's limbs are now genuinely RIBBED (`ribbedLimb`, a bellows/
   * accordion profile, not a smooth taper) — a squeezable-plastic-hose read that
   * is a different silhouette, not just a different colour, from every other
   * character's limbs. The hand stays a miniature of the head's own bottle cap
   * (its grip-ridge rings are part of that shape's own identity) and the foot
   * stays a rounded bottle base — both already a direct echo of this character's
   * own silhouette rather than a generic part recoloured. Kept fully opaque — see
   * the block comment above the geometry helpers for why transmission stays
   * reserved for the head.
   */
  private dressLimbs(): void {
    // Richer WATER blue, not the pale near-white shell tone — see the constructor's
    // own comment on the colour-convergence fix.
    const plasticMat = glossyMat({ color: WATER, roughness: 0.16 });
    const capMat = toonMat({ color: CAP, roughness: 0.4 });
    const capDarkMat = toonMat({ color: CAP_DARK, roughness: 0.4 });

    this.rig.dressLimbs((part: LimbPart, size) => {
      switch (part) {
        case 'upperArmL':
        case 'upperArmR':
          return ribbedLimb(size.len, size.radius * 1.02, size.radius * 0.72, plasticMat, 3);
        case 'forearmL':
        case 'forearmR':
          return ribbedLimb(size.len, size.radius * 0.70, size.radius * 0.52, plasticMat, 3);
        case 'handL':
        case 'handR':
          return buildCapHand(size.radius, capMat, capDarkMat);
        case 'thighL':
        case 'thighR':
          return ribbedLimb(size.len, size.radius * 1.0, size.radius * 0.84, plasticMat, 3);
        case 'shinL':
        case 'shinR':
          return ribbedLimb(size.len, size.radius * 0.84, size.radius * 0.66, plasticMat, 3);
        case 'footL':
        case 'footR':
          return buildBottleFoot(size.radius, capDarkMat, plasticMat);
        default:
          return null;
      }
    });
  }

  /** The rig owns all body motion; the base class's whole-body pass would fight it. */
  protected applyBaseMotion(): void {}
}
