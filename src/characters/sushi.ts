/**
 * Sushi (Legendary).
 *
 * Built on the shared ChibiRig — see `donut.ts` for the reference implementation of
 * this pattern. The rig supplies torso, arms, hands, legs, feet and all motion; this
 * file authors only the food mass on `rig.joints.head`, the face and a palette.
 *
 * Identity is fixed by `rules.ts`: Sushi, Legendary rarity, Rice Spray / Seaweed Bait /
 * Fish Pile / Big Catch. The written description ("rice cylinder banded with nori,
 * salmon centre, wide eyes, puckered lips") is treated as a personality guide rather
 * than a literal spec, per the brief, but the nori-band-on-rice motif IS kept and
 * doubled down on as the character's silhouette landmark — it is the single strongest
 * high-contrast graphic read available (near-black on white) and Legendary is the
 * premium tier, so it earns the most craft in the cast.
 *
 * Read as classic salmon nigiri: a rounded rice mound, a dark nori strip wrapped
 * around its lower half like a belt, and a glossy salmon slice draped over the top —
 * exactly the silhouette of the 🍣 emoji, which is instantly recognisable. That same
 * rice + nori belt motif is carried down onto the torso so the whole body reads as
 * "made of sushi", not just the head.
 */

import * as THREE from 'three';
import { BaseCharacter, type AnimContext } from './types';
import type { CharacterDef } from '../game/rules';
import { PALETTE, RARITY_COLORS } from '../game/rules';
import { toonMat, glossyMat, flatMat, outlineGroup, roundedBox } from '../render/toon';
import { ChibiRig, type LimbPart } from './rig';
import { bodyType } from './bodies';
import { CHARACTER_HEIGHT } from '../units';

const RICE = '#FFFDF6';        // warm-white sticky rice, not clinical pure white
const RICE_SHADE = '#F2ECDD';  // grain shading, a touch deeper
// Lifted off `PALETTE.nori`'s near-black #2B2B2B to a dark seaweed GREEN. Two
// measured reasons: (1) at near-black the torso sat about six value stops below
// the cream head and a blind critic read the character as "a floating head with a
// hole under it"; (2) real nori is green-black, and a hue there means the dark mass
// is a material rather than a hole. Still the darkest thing on the character, so it
// keeps its job as the high-contrast landmark.
const NORI = '#2F4034';
const NORI_DEEP = '#1E2B22';   // the maki's own rim, one step darker than the wall
// Pushed off `PALETTE.salmon` (#F4A261, a pale peach) to a genuinely saturated
// fish orange. Two reasons, both measured rather than aesthetic: the fish is now
// the largest single colour area on the character (see the PROFILE rewrite below),
// and the cast owns the warm half of the colour wheel unopposed since the arena was
// re-keyed cool — a pale peach spends that position for nothing.
const SALMON = '#F5854A';
const SALMON_DARK = '#CE5C2E'; // fish striation lines
const LIP = '#E8798F';         // puckered-lip coral
const GOLD = RARITY_COLORS.Legendary; // #F4A300 — rarity accent, used sparingly

// ── Costume layer ────────────────────────────────────────────────────────────
// A fresh independent art director named the missing costume/accessory layer as
// the TOP gap in the whole cast: without one, characters read as "naked mascot
// body with a themed head glued on" no matter how good the body sculpt is. A
// tied hachimaki headband with trailing tails is Sushi's silhouette-breaking
// item — the tails project past the head's own round silhouette from the back/
// side the way a cape or backpack does on the reference roster — plus a pair of
// chopsticks tucked into the torso sash as a smaller detail prop.
const HEADBAND = '#B23A2E';      // chef's-headband red
const HEADBAND_DARK = '#8A2A20'; // knot shading
const CHOPSTICK = '#C99A52';     // pale bamboo

/**
 * Tapered limb segment: a flat cap at the joint origin (plugs flush into the
 * shoulder/hip, no gap) tapering down a straight wall to a rounded tip of radius
 * `rBot`. Reused per-character with different taper ratios so each cast member's
 * limbs read as their own shape rather than a shared uniform capsule.
 */
function taperedLimb(len: number, rTop: number, rBot: number, mat: THREE.Material, segs = 12): THREE.Mesh {
  // Points MUST run bottom → top for LatheGeometry's automatic normals to face
  // outward (this file's own PROFILE lathe follows the same rule). Getting it
  // backwards was a round 1 defect: the real mesh got face-culled invisible and
  // its outline shell rendered as a solid dark wedge instead of a thin line.
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

/** A thin ring cinched around a limb at local Y `y` — the nori-band motif echoed
 * down onto the limbs as a wrist/ankle wrap. */
function cuffRing(y: number, radius: number, thickness: number, mat: THREE.Material): THREE.Mesh {
  const ring = new THREE.Mesh(new THREE.TorusGeometry(radius, thickness, 8, 20), mat);
  ring.name = 'limb_cuff';
  ring.rotation.x = Math.PI / 2;
  ring.position.y = y;
  ring.castShadow = true;
  ring.receiveShadow = true;
  return ring;
}

/**
 * A smooth, closed rice-ball fist — no knuckle bumps (that read as too rustic for a
 * Legendary-tier character) — wrapped with a thin nori ribbon and a small gold stud,
 * echoing the head's own nori-band + gold-clasp motif at hand scale.
 */
function buildRiceFist(R: number, side: 1 | -1, mat: THREE.Material, noriMat: THREE.Material, goldMat: THREE.Material): THREE.Group {
  const g = new THREE.Group();
  const palm = new THREE.Mesh(new THREE.SphereGeometry(R * 0.92, 16, 14), mat);
  palm.scale.set(1.0, 0.94, 1.08);
  palm.castShadow = true;
  palm.receiveShadow = true;
  g.add(palm);

  const ribbon = new THREE.Mesh(new THREE.TorusGeometry(R * 0.72, R * 0.09, 8, 20), noriMat);
  ribbon.name = 'fist_ribbon';
  ribbon.rotation.z = side * 0.35;
  ribbon.position.set(0, -R * 0.05, 0);
  ribbon.castShadow = true;
  ribbon.receiveShadow = true;
  g.add(ribbon);

  const stud = new THREE.Mesh(new THREE.SphereGeometry(R * 0.13, 10, 8), goldMat);
  stud.name = 'fist_stud';
  stud.position.set(side * R * 0.55, R * 0.18, R * 0.55);
  stud.castShadow = true;
  g.add(stud);

  return g;
}

/**
 * A low, elegant lacquered boot — flatter and more slipper-like than a chunky wedge,
 * with a thin gold ankle strap in place of a thick rolled cuff, and a pale rice-shade
 * sole strip breaking up the near-black nori body.
 */
function buildLacqueredBoot(fw: number, bodyMat: THREE.Material, soleMat: THREE.Material, strapMat: THREE.Material): THREE.Group {
  const g = new THREE.Group();
  const body = new THREE.Mesh(roundedBox(fw * 0.90, fw * 0.46, fw * 1.42, fw * 0.20, 3), bodyMat);
  body.position.set(0, -fw * 0.20, fw * 0.26);
  body.castShadow = true;
  body.receiveShadow = true;
  g.add(body);

  const sole = new THREE.Mesh(roundedBox(fw * 0.98, fw * 0.14, fw * 1.60, fw * 0.06, 2), soleMat);
  sole.position.set(0, -fw * 0.44, fw * 0.30);
  sole.castShadow = true;
  sole.receiveShadow = true;
  g.add(sole);

  const strap = new THREE.Mesh(new THREE.TorusGeometry(fw * 0.38, fw * 0.028, 8, 18), strapMat);
  strap.name = 'boot_strap';
  strap.rotation.x = Math.PI / 2;
  strap.position.set(0, fw * 0.06, fw * 0.06);
  strap.castShadow = true;
  strap.receiveShadow = true;
  g.add(strap);

  return g;
}

export class SushiCharacter extends BaseCharacter {
  private rig: ChibiRig;
  private riceGrains: THREE.Object3D[] = [];
  /** Set by `dressTorsoAsSushi`, read by `buildAccessories` — measured off the rig
   *  rather than re-derived by hand in two places that could drift apart. */
  private beltRadius = 0;

  constructor(def: CharacterDef) {
    super(def);

    this.rig = new ChibiRig({
      palette: {
        // A fresh independent art director named the exact failure: Soup, Water Bottle
        // and Sushi all ended up with cream/white tapered limbs and dark boots, reading
        // as the same parts reskinned. The rice-mound HEAD stays white (that's not the
        // problem, and it's the character's own landmark shape) but the BODY moves to a
        // glossy nori-charcoal "wetsuit" — echoing the head's own nori band at body
        // scale — with pale rice-white boots inverting the old dark-boot convention.
        // Head+torso round: the limbs move from nori-charcoal to the fish's own
        // saturated orange, and the boots invert to nori. The previous split put
        // near-black on the limbs AND the torso AND a band across the head, so the
        // silhouette test's "generic blob" was partly literal — most of the
        // character was one dark value. Nothing else in the cast is orange-limbed,
        // and it keeps this character firmly in the warm half of the wheel.
        limb: SALMON,
        hand: RICE,        // rice-ball fists, the head's own other material
        foot: NORI,        // lacquered near-black boots ground the warm limbs
        torso: NORI,       // carries the maki cut-face on the chest — see dressTorsoAsSushi
        limbRoughness: 0.42,
      },
      // A fresh independent art director scored the cast 4/10 and named the body plan
      // directly: every character took the rig's defaults, so the bodies read as
      // identical parts under different heads. Sushi is written as compact and stout
      // with thick short limbs and a low wide stance, so shoulders pull IN (compact)
      // while the stance and limb thickness both go up (stout, planted).
      // Body: STANDARD archetype — the neutral chibi baseline (see `bodies.ts`).
      // A nigiri is a compact block that still needs a waist under it, so the
      // middle body suits it; the tweaks below keep Sushi's own "arms held close
      // in, feet planted wide" read on top of the baseline.
      proportions: bodyType('standard', {
        // `headFraction` up from STANDARD's 0.46: the nigiri is now a WIDE, LOW
        // bed rather than a tall lathe (see the PROFILE rewrite), so it needs more
        // radius to reach the same top-of-head. Measured with
        // `shoot.mjs --char sushi`, which prints the real bounding height.
        headFraction: 0.65,
        // Two knobs nudged off STANDARD, and only because the head is flat. The rig
        // sizes the whole character assuming a head ~2R tall; this one is 1.2R, so
        // ~0.5m of nominal height simply does not exist and Sushi came out the
        // shortest in the cast by a visible margin. Raising the hip and shoulder
        // lines puts the same flat head back at ~2.1m top-of-head without inflating
        // it into a dinner plate. Verified with `shoot.mjs --char sushi`.
        legFraction: 0.29,
        torsoFraction: 0.31,
        // `headMount` is the fix for the trap `rig.ts` documents: the rig places
        // the head centre `headRadius * headMount` above the torso top ASSUMING a
        // mass that extends ~±R about its origin. This mass extends ±0.67R, so at
        // the stock 0.86 the head floated a visible 0.14m clear of the body — which
        // is exactly what the first render of this rewrite showed. 0.62 seats the
        // rice bed's underside just inside the torso top.
        headMount: 0.50,
        // Out from 0.16H: the nigiri bed is now ~1.5x wider than the shoulders, and
        // the maki-roll torso (see `dressTorsoAsSushi`) needs radius that
        // `bodies.ts`'s "torso half-width must stay inside the shoulder pivot" rule
        // only allows if the pivot moves out with it.
        // 0.19H -> 0.225H. Both forearms measure 0.489 / 0.493 delivered — on the
        // wrong side of the 0.50 floor by a hair, with 0.21-0.23 of each covered by
        // the nigiri bed. The elbow tuck was already relaxed (see `stance` below);
        // this is the remaining 0.03-0.04m the measurement asks for.
        shoulderWidth: CHARACTER_HEIGHT * 0.225,
        stanceWidth: CHARACTER_HEIGHT * 0.15,    // low, wide stance
        armRadius: CHARACTER_HEIGHT * 0.068,     // thick
        handRadius: CHARACTER_HEIGHT * 0.088,    // big round rice-fist
        legRadius: CHARACTER_HEIGHT * 0.078,     // thick, stout
      }),
      // Poised and refined — arms held close in rather than out, a slight
      // aloof over-the-shoulder glance. Distinct from every other stance in
      // this file's own cast slice: the only near-symmetric, closed-arm pose.
      stance: {
        // Elbows -0.58 -> -0.40. Both forearms delivered 0.466 / 0.452 at idle and
        // 0.189 / 0.176 at run — under the floor in both states, tucked in behind
        // the nigiri. The shoulders are already correct (near-zero, so the arms
        // hang where the rig puts them); it was only the elbow tuck.
        shoulderL: 0.04, shoulderR: -0.04,
        elbowL: -0.40, elbowR: -0.40,
        twist: -0.07, headTilt: 0.11, headTurn: -0.22,
        hipSway: 0.02, lean: -0.02,
      },
    });
    this.body.add(this.rig.joints.root);
    this.head = this.rig.joints.head;

    const R = this.rig.headRadius;
    const head = this.rig.joints.head;

    // ── Materials ────────────────────────────────────────────────────────────
    const riceMat = toonMat({ color: RICE, roughness: 0.76 });        // matte sticky rice — pushed further from the glossy nori/salmon for real contrast
    const noriMat = glossyMat({ color: NORI, roughness: 0.3 });       // glossy seaweed sheen
    const salmonMat = glossyMat({ color: SALMON, roughness: 0.2 });   // wet fish
    const salmonDarkMat = toonMat({ color: SALMON_DARK, roughness: 0.3 });

    // ── Rice mound + salmon topping — one shared profile, two lathes ─────────
    // Round 1 built the salmon as a concentric sphere over the rice's own dome: at
    // any radius bigger than the rice, a matching ROUNDED cap continues the exact
    // same curvature as the ball beneath it, so the two fused into one bigger sphere
    // with no visible seam — it read as an orange hard hat, not a draped fish slice,
    // and the thin "streak" capsules stuck out radially near the pole like hair
    // spikes (which also blew the measured height past the 2.1 m budget).
    //
    // Fixed by giving rice and salmon DIFFERENT silhouettes that share one exact
    // vertex at the seam: `PROFILE` is a single (heightFraction, radiusFraction)
    // curve, split at `SEAM_H`. The rice half is rounded (classic nigiri mound,
    // constant-radius wall through the nori band); the salmon half is flatter with a
    // small overhanging lip, the way a real fish slice sits proud of the rice rather
    // than continuing its curve. Because both lathes are built from literally the
    // same point at the seam, there is no gap or float to solve for — it's exact by
    // construction, same technique as the bottom-bun/patty stack in hamburger.ts.
    // ── Head+torso round: the nigiri had the wrong ASPECT, not the wrong detail ──
    // The silhouette test named Sushi a "generic blob". Measured, the old head was
    // 1.65R tall by 1.16R wide — TALLER than it was wide — with the salmon a domed
    // cap on the top third. A dome on a tall round lathe is a mushroom, and that is
    // exactly what the black-on-white render showed: a stalk with a cap.
    //
    // A nigiri is a BED. It is roughly twice as long as it is tall, noticeably
    // shallower front-to-back than it is wide, and the fish is a flat slab draped
    // over it that OVERHANGS the rice at the ends. Two changes buy all of that:
    //
    //  1. `SX`/`SZ` turn every horizontal slice from a circle into an ellipse —
    //     stretched across, squashed in depth. Nothing else in the cast is wide-and-
    //     low (Egg, Lollipop and Donut are tall-and-round, Soup is a bowl, Pizza a
    //     wedge), so this alone is a silhouette nobody else can be confused with.
    //  2. The salmon half of the profile now flares OUT sharply at the seam and then
    //     runs nearly flat, so it reads as a slab with a drooping lip rather than a
    //     dome continuing the rice's curve.
    // A rice MOUND, curved all the way up. The straight-walled version (r held at
    // 1.00 across a third of the height) rendered as a can with a lid — the profile
    // has to be round for the mass to read as pressed rice rather than a container.
    const PROFILE: Array<[h: number, r: number]> = [
      [0.00, 0.00], [0.05, 0.55], [0.14, 0.82], [0.30, 0.97],
      [0.48, 1.00], [0.64, 0.97], [0.78, 0.86], [0.88, 0.60], [0.92, 0.00],
    ];
    /** Height fraction where the fish slab's underside meets the rice — the top of
     *  the face zone. Not a lathe seam any more; see the salmon block below. */
    const SEAM_H = 0.60;
    const SCALE_R = R * 0.50;
    const SCALE_H = R * 1.06;
    /** Horizontal ellipse: a nigiri is long across and shallow front-to-back.
     *  With the fish's own 1.16x overhang this puts the head at ~1.56:1 wide-to-tall
     *  — nothing else in the cast is wider than it is tall. */
    // Widened and flattened again after a blind critic flagged Sushi and Soup as the
    // one confusable pair on the silhouette sheet — "both a wide flat-topped dome on
    // a squat two-legged body". Soup's bowl is a truncated cone that OPENS upward
    // with a concave lip; the way to stop reading like it is to be a genuine slab, so
    // the head goes to ~1.7:1 wide-to-tall. `headFraction` and `headMount` move with
    // it to keep top-of-head near the cast's 2.2-2.35 (a flatter head reaches less
    // far for the same radius — the arithmetic `rig.ts` warns about).
    const SX = 1.72;
    const SZ = 0.86;

    /** Linear-interpolated radius FRACTION (0-1) at a given height fraction. */
    const radiusFracAt = (hFrac: number): number => {
      for (let i = 0; i < PROFILE.length - 1; i++) {
        const [h0, r0] = PROFILE[i];
        const [h1, r1] = PROFILE[i + 1];
        if (hFrac >= h0 && hFrac <= h1) {
          const t = h1 > h0 ? (hFrac - h0) / (h1 - h0) : 0;
          return r0 + (r1 - r0) * t;
        }
      }
      return PROFILE[PROFILE.length - 1][1];
    };
    /** Actual local Y (metres) for a height fraction — content spans ±SCALE_H/2. */
    const yAt = (hFrac: number): number => hFrac * SCALE_H - SCALE_H / 2;
    /** Actual local radius (metres) at a height fraction, BEFORE the SX/SZ ellipse. */
    const rAt = (hFrac: number): number => radiusFracAt(hFrac) * SCALE_R;
    /**
     * Exact front-surface Z for a given local X at a height fraction.
     *
     * The masses live inside a group scaled (SX, 1, SZ), so a horizontal slice is an
     * ELLIPSE with semi-axes (rAt*SX, rAt*SZ), not the circle the old one-line
     * version assumed. Anything placed with the circle equation would have floated
     * a long way off the front of the widened head — this is the same class of bug
     * as the "decals floating above / buried inside the surface" failure elsewhere
     * in the cast, so the surface equation moves with the shape.
     */
    const zAt = (x: number, hFrac: number): number => {
      const a = rAt(hFrac) * SX;
      const b = rAt(hFrac) * SZ;
      if (a <= 1e-6) return 0;
      const t = 1 - (x * x) / (a * a);
      return t > 0 ? b * Math.sqrt(t) : 0;
    };

    // The food masses sit inside one scaled group so they can be authored in a plain
    // circular frame; the face and every decal stay on `head` and use `zAt` above.
    // Scaling a GROUP rather than each geometry also keeps the eyes, brows and lips
    // perfectly round instead of stretching them 1.62x with the rice.
    const mass = new THREE.Group();
    mass.name = 'sushi_mass';
    mass.scale.set(SX, 1, SZ);
    head.add(mass);

    const latheGeo = (points: Array<[number, number]>) =>
      new THREE.LatheGeometry(points.map(([h, r]) => new THREE.Vector2(r * SCALE_R, yAt(h))), 32);

    const rice = new THREE.Mesh(latheGeo(PROFILE), riceMat);
    rice.name = 'sushi_rice';
    rice.castShadow = true;
    rice.receiveShadow = true;
    mass.add(rice);

    // ── The fish: a draped SLAB, not a lathe cap ─────────────────────────────
    // Two rewrites have now tried making the salmon the top half of the rice's own
    // lathe, and both produced a hat — first a hard hat, then a beret. The reason
    // is structural: a surface of revolution sharing the rice's axis can only ever
    // sit ON the rice, never hang OVER it, because a lathe is single-valued in y.
    // A real nigiri's fish is a slab laid across the bed whose rounded ENDS
    // overhang the rice and droop — and that overhang is the whole silhouette.
    //
    // So the fish is an ellipsoid, wider than the rice in every horizontal
    // direction, with its lower half buried in the bed. Its ends stick out past
    // the rice at the head's two widest points, which is precisely where a
    // silhouette gains information.
    const salmonGeo = new THREE.SphereGeometry(1, 32, 20);
    salmonGeo.scale(SCALE_R * 1.16, SCALE_H * 0.23, SCALE_R * 1.06);
    const salmon = new THREE.Mesh(salmonGeo, salmonMat);
    salmon.name = 'sushi_salmon';
    salmon.position.y = yAt(0.80);
    salmon.rotation.x = 0.09; // a slight forward droop, so it reads as laid on rather than moulded
    salmon.castShadow = true;
    salmon.receiveShadow = true;
    mass.add(salmon);

    // ── Nori band ────────────────────────────────────────────────────────────
    // A strip of seaweed hugging the base of the rice mound. It has to FOLLOW the
    // mound's profile, not ring it at a constant radius: the rice is only 0.4-0.8 of
    // full width down here, so a straight cylinder at 1.03x stood a long way proud
    // and rendered as a hat brim — which is exactly what the previous render came
    // back as, a chef's toque with a black brim. Built as a lathe over the same
    // PROFILE, offset 4%, it reads as a wrapped strip instead.
    const NORI_H0 = 0.04;
    const NORI_H1 = 0.20;
    const noriSteps = 6;
    const noriPts: THREE.Vector2[] = [];
    for (let i = 0; i <= noriSteps; i++) {
      const h = NORI_H0 + (NORI_H1 - NORI_H0) * (i / noriSteps);
      noriPts.push(new THREE.Vector2(rAt(h) * 1.04, yAt(h)));
    }
    const nori = new THREE.Mesh(new THREE.LatheGeometry(noriPts, 32), noriMat);
    nori.name = 'sushi_nori_band';
    nori.castShadow = true;
    nori.receiveShadow = true;
    mass.add(nori);

    // Small gold clasp on the band — a quiet Legendary-rarity accent, echoed on the
    // torso belt below so the two read as one costume detail.
    const clasp = new THREE.Mesh(
      new THREE.CylinderGeometry(R * 0.075, R * 0.075, R * 0.03, 16),
      toonMat({ color: GOLD, roughness: 0.3, metalness: 0.35 })
    );
    clasp.name = 'sushi_clasp';
    clasp.rotation.x = Math.PI / 2;
    // `rAt` is the UNSCALED lathe radius; the band's real front face is at
    // `rAt * SZ` once `mass` squashes it in depth.
    clasp.position.set(0, yAt(NORI_H1) - R * 0.02, rAt(NORI_H1 - 0.02) * SZ * 1.06);
    clasp.castShadow = true;
    head.add(clasp);

    // ── Fish striations + glisten, on the SLAB's own surface ─────────────────
    // These used to be solved against `zAt`, the rice lathe's surface equation.
    // That is now the wrong surface: the fish is an ellipsoid sitting above the
    // rice, and at the striations' own heights `rAt` has already closed to zero, so
    // every stripe would have collapsed onto the head's centre axis and rendered
    // buried inside the slab. Solved against the slab instead — the recurring
    // "rendering but invisible" failure, caught by re-deriving rather than
    // re-tuning.
    const slabX = SCALE_R * 1.16 * SX;
    const slabY = SCALE_H * 0.23;
    const slabZ = SCALE_R * 1.06 * SZ;
    const slabCY = yAt(0.80);
    /** Top surface of the fish slab at a horizontal (x, z), or null if outside it. */
    const slabTop = (x: number, z: number): number | null => {
      const t = 1 - (x / slabX) ** 2 - (z / slabZ) ** 2;
      return t > 0 ? slabCY + slabY * Math.sqrt(t) : null;
    };

    const stripeSpots: Array<[number, number]> = [[-0.46, 0.10], [0.0, -0.06], [0.46, 0.10]];
    for (const [fx, fz] of stripeSpots) {
      const x = fx * slabX;
      const z0 = (fz - 0.30) * slabZ;
      const z1 = (fz + 0.30) * slabZ;
      const y0 = slabTop(x, z0);
      const y1 = slabTop(x, z1);
      if (y0 === null || y1 === null) continue;
      const p0 = new THREE.Vector3(x, y0, z0);
      const p1 = new THREE.Vector3(x, y1, z1);
      const mid = p0.clone().add(p1).multiplyScalar(0.5);
      mid.y += R * 0.008;
      const dir = p1.clone().sub(p0).normalize();
      const stripe = new THREE.Mesh(
        new THREE.BoxGeometry(R * 0.045, p0.distanceTo(p1) * 1.05, R * 0.014),
        salmonDarkMat
      );
      stripe.position.copy(mid);
      stripe.quaternion.setFromUnitVectors(new THREE.Vector3(0, 1, 0), dir);
      stripe.userData.noOutline = true;
      head.add(stripe);
    }

    // A wet glisten on the slab — cheap, sells "wet" against the matte rice.
    // Hoisted and given `depthWrite: false` — a transparent material that still
    // writes depth is a silent occluder (`docs/LESSONS.md` §1), and every
    // transparent material in the cast carried the default `true`.
    const glintMat = flatMat('#ffffff', { transparent: true, opacity: 0.55 });
    glintMat.depthWrite = false;
    {
      const gx = -slabX * 0.30, gz = slabZ * 0.22;
      const gy = slabTop(gx, gz);
      if (gy !== null) {
        const glisten = new THREE.Mesh(
          new THREE.SphereGeometry(R * 0.055, 10, 8),
          glintMat
        );
        glisten.position.set(gx, gy + R * 0.008, gz);
        glisten.scale.set(1.3, 0.35, 1.0);
        glisten.userData.noOutline = true;
        head.add(glisten);
      }
    }

    // ── Rice grains ──────────────────────────────────────────────────────────
    // Small stretched capsules seated exactly on the rice's surface via zAt(), kept
    // on the sides/back so they never compete with the face. Kept strictly ABOVE
    // the nori band's own h-range (0.03-0.20): the band wraps the rice at a
    // slightly larger radius, so a grain placed at the rice's own surface inside
    // that range would be swallowed inside it, invisible.
    const grainMat = toonMat({ color: RICE_SHADE, roughness: 0.7 });
    const grainSpots: Array<[number, number, 1 | -1]> = [
      [0.36, 0.28, -1], [-0.38, 0.26, -1], [0.22, 0.34, -1], [-0.20, 0.24, -1],
      [0.32, 0.46, -1], [-0.34, 0.44, -1], [0.22, 0.54, -1], [-0.24, 0.56, -1],
    ];
    for (const [gx, gh, side] of grainSpots) {
      // x is a fraction of the head's REAL half-width, which the SX ellipse has
      // already widened — without it every grain lands well inside the surface.
      const x = gx * SCALE_R * SX;
      const z = side * (zAt(x, gh) + R * 0.006);
      const grain = new THREE.Mesh(new THREE.CapsuleGeometry(R * 0.026, R * 0.05, 3, 6), grainMat);
      grain.position.set(x, yAt(gh), z);
      const outNormal = new THREE.Vector3(x, 0, z).normalize();
      grain.quaternion.setFromUnitVectors(new THREE.Vector3(0, 1, 0), outNormal);
      grain.rotateX(Math.PI / 2);
      grain.castShadow = true;
      head.add(grain);
      this.riceGrains.push(grain);
    }

    this.buildFace(R, yAt, zAt);
    this.dressTorsoAsSushi();
    this.dressLimbs();
    this.buildAccessories(R, yAt, rAt, zAt, SX, SZ);

    outlineGroup(this.root);
    this.collectFlashTargets();
    this.rig.restPose();
  }

  /**
   * Wide, slightly-startled eyes and puckered "o" lips — placed in the rice's own
   * face zone (between the nori band and the salmon seam), via `zAt()`, the exact
   * surface equation for this lathe (every horizontal slice is a perfect circle).
   *
   * An independent art director read these as "googly/misaligned" eyes. Both are
   * built from one mirrored loop at an identical size/height (mirrored only in
   * sign), so there is no positional mismatch in the numbers. Fixed two things:
   * each eye's parts now live in their own locally-oriented group (surface point
   * + outward-facing quaternion — the same technique `soup.ts`'s `bowlSurface`
   * eyes use), so "above the eye" and "proud of the surface" are unambiguous
   * local-space offsets instead of raw head-space coordinates fighting a curved
   * lathe surface — a first attempt at this fix got the depth ordering wrong in
   * head-space and buried the pupil/glint behind the sclera and the brow behind
   * the eye's own bulge, entirely invisible. And the sizes/protrusion are trimmed
   * down from the original so the eyes read as inset rather than two balls stuck
   * on the curve, with a brow/lash stroke above each — the same anchor-line fix
   * already applied to Soup and Water Bottle's faces.
   */
  private buildFace(R: number, yAt: (h: number) => number, zAt: (x: number, h: number) => number): void {
    const face = this.rig.joints.face;
    // `face` carries the rig's generic forward offset tuned for a plain sphere; this
    // model's surface is authored directly on `head` instead, in exact local coords,
    // so re-anchor `face` at the head origin and add features to `head` itself.
    face.position.set(0, 0, 0);
    const head = this.rig.joints.head;
    const ink = PALETTE.ink;
    const browMat = toonMat({ color: SALMON_DARK, roughness: 0.35 }); // ties the brow to the fish accent colour

    // Face zone is the clear rice between the nori band (tops at h 0.26) and the
    // rice/salmon seam (h 0.62). The eyes spread wider than before because the head
    // is now 1.62x wider than it is deep — at the old ±0.24R they sat in the middle
    // third of a wide face and read as a narrow, pinched pair.
    const eyeH = 0.44;
    const eyeY = yAt(eyeH);
    for (const sx of [-1, 1] as const) {
      const ex = sx * R * 0.34;
      const ez = zAt(ex, eyeH);
      const outward = new THREE.Vector3(ex, 0, ez).normalize();
      const eye = new THREE.Group();
      eye.position.set(ex, eyeY, ez).addScaledVector(outward, R * 0.02);
      // Built from an explicit basis rather than `setFromUnitVectors`, which picks
      // the shortest arc and therefore leaves a different residual ROLL on each
      // side. Every offset inside the eye group (pupil lift, glint, brow) is then
      // rotated by a different amount per eye, and a blind critic read the pair as
      // "one iris jammed into the inner corner — a lazy eye". Pinning local up to
      // world up makes the two sides exact mirrors.
      {
        const fwd = outward.clone();
        const worldUp = new THREE.Vector3(0, 1, 0);
        const right = new THREE.Vector3().crossVectors(worldUp, fwd).normalize();
        const up = new THREE.Vector3().crossVectors(fwd, right).normalize();
        eye.quaternion.setFromRotationMatrix(
          new THREE.Matrix4().makeBasis(right, up, fwd)
        );
      }
      head.add(eye);

      // Sclera — wide white eye, the "slightly startled" read.
      const white = new THREE.Mesh(new THREE.SphereGeometry(R * 0.135, 18, 14), toonMat({ color: '#FFFFFF', roughness: 0.25 }));
      white.position.set(0, 0, R * 0.015);
      white.scale.set(1, 1.05, 0.5);
      white.castShadow = true;
      eye.add(white);

      // Pupil pushed toward the top of the sclera — white shows below, the classic
      // "wide-eyed" surprised cue. Local Z is unambiguously "outward" here, so it's
      // sized to clear the sclera's own front bulge (front ≈ 0.015+0.135*0.5=0.0825R)
      // by a real, checked margin rather than an assumption.
      const pupil = new THREE.Mesh(new THREE.SphereGeometry(R * 0.062, 16, 12), toonMat({ color: ink, roughness: 0.25 }));
      pupil.position.set(0, R * 0.022, R * 0.065);
      pupil.scale.set(1, 1, 0.55);
      pupil.castShadow = true;
      eye.add(pupil);

      const glint = new THREE.Mesh(new THREE.SphereGeometry(R * 0.023, 8, 8), flatMat('#ffffff'));
      glint.position.set(-R * 0.022, R * 0.045, R * 0.10);
      glint.userData.noOutline = true;
      eye.add(glint);

      // Brow/lash stroke, well above the sclera's own top edge (≈0.135*1.05=0.142R
      // above eye centre), so it can't be hidden behind the eye's own bulge — the
      // defect that made the previous head-space attempt invisible.
      const brow = new THREE.Mesh(new THREE.CapsuleGeometry(R * 0.015, R * 0.12, 4, 8), browMat);
      brow.name = 'sushi_brow';
      brow.rotation.z = Math.PI / 2 + sx * 0.08;
      brow.position.set(0, R * 0.165, R * 0.025);
      brow.castShadow = true;
      eye.add(brow);
    }

    // Puckered "o" lips — a plump little ring (tube nearly as thick as its own
    // radius, for a pursed-lip read rather than a thin circle outline).
    const mouthH = 0.30;
    const mouthY = yAt(mouthH);
    const mouthZ = zAt(0, mouthH) + R * 0.01;
    const lipMat = toonMat({ color: LIP, roughness: 0.4 });
    const lips = new THREE.Mesh(new THREE.TorusGeometry(R * 0.045, R * 0.024, 10, 20), lipMat);
    lips.name = 'sushi_lips';
    lips.position.set(0, mouthY, mouthZ);
    lips.castShadow = true;
    head.add(lips);
    // A dark inner disc so the "o" reads as an open pucker, not a solid pink bead.
    const lipHole = new THREE.Mesh(new THREE.CircleGeometry(R * 0.019, 12), toonMat({ color: '#7A2E38', roughness: 0.5 }));
    lipHole.name = 'sushi_lip_hole__no_outline';
    lipHole.userData.noOutline = true;
    lipHole.position.set(0, mouthY, mouthZ + R * 0.004);
    head.add(lipHole);
  }

  /**
   * Carries the sushi motif down onto the body — and gives the dark torso the one
   * thing it was missing.
   *
   * The rig's torso is nori-charcoal, which on its own is a large low-chroma mass
   * on a cast that owns the warm half of the wheel. A MAKI ROLL solves both
   * problems at once: it is the other universally-recognised sushi form, so the
   * character reads as "made of sushi" from head to hips rather than "a nigiri
   * wearing a wetsuit", and its cut face is a bullseye of white rice around a hot
   * salmon centre inside a dark nori ring — a big, high-contrast, warm graphic
   * sitting at chest height, which is where the eye goes.
   *
   * It is a torso DRESSING, not a body: the archetype still owns every joint,
   * limb length and stance. The roll's radius is capped at
   * `shoulderWidth - armRadius * 1.15` for the reason `bodies.ts` spells out — a
   * torso whose half-width reaches the shoulder pivot swallows the arms and the
   * character reads as a pile of overlapping dough balls.
   */
  private dressTorsoAsSushi(): void {
    // Read off the rig, never hand-mirrored: body proportions come from an
    // archetype (`bodies.ts`) now, so a hardcoded copy of a rig constant goes
    // silently wrong the moment the archetype changes.
    const m = this.rig.metrics;
    if (!m.hasTorso) return;
    const torsoH = m.torsoHeight;
    const taperMid = 0.86 + 0.30 * Math.sin(0.5 * Math.PI * 0.85); // rig.ts's taper at t=0.5
    const torsoHalfWidthMid = m.torsoWidth * 0.5 * taperMid;
    const beltRadius = torsoHalfWidthMid * 1.18; // safety margin over the tapered waist
    this.beltRadius = beltRadius;
    const beltY = torsoH * 0.52;

    const riceMat = toonMat({ color: RICE, roughness: 0.72 });
    const noriMat = glossyMat({ color: NORI, roughness: 0.3 });
    const salmonMat = glossyMat({ color: SALMON, roughness: 0.2 });
    const goldMat = toonMat({ color: GOLD, roughness: 0.3, metalness: 0.35 });

    // ── Maki roll, lying on its side with the cut face forward ────────────────
    // It has to REPLACE the rig's default torso, not sit inside it. A first pass
    // added the roll alongside the stock tapered barrel (half-width 0.22m) at a
    // radius of 0.17m and the whole thing rendered perfectly, entirely inside the
    // barrel, invisible — the project's most-repeated failure, now instance
    // fifteen. `rig.dressTorso` removes the default mesh, which is the only reason
    // this is visible at all.
    const rollR = Math.min(torsoH * 0.46, m.shoulderWidth - m.armRadius * 1.15);
    const rollD = rollR * 1.34;                 // front-to-back length of the roll
    // A perfectly round roll of this radius is shorter than the torso it stands in
    // for, so the group is stretched along its own local Z — which the quaternion
    // below maps to WORLD Y — until the roll fills the torso's height. The cut face
    // becomes a slight upright oval, which still reads as maki.
    const rollStretch = Math.min(1.35, (torsoH * 0.92) / (2 * rollR));

    const roll = new THREE.Group();
    roll.name = 'sushi_maki_roll';
    roll.position.set(0, torsoH * 0.5, 0);
    // Axis along Z so the cut face points at the camera. Set as an explicit
    // quaternion rather than composed Euler angles — composing rotation.x then
    // rotation.y on a disc is what has tipped planes edge-on elsewhere in this
    // project and made them vanish from a top-down camera.
    roll.quaternion.setFromAxisAngle(new THREE.Vector3(1, 0, 0), Math.PI / 2);
    roll.scale.set(1, 1, rollStretch);

    this.rig.dressTorso(() => roll);

    const wall = new THREE.Mesh(new THREE.CylinderGeometry(rollR, rollR, rollD, 30, 1, true), noriMat);
    wall.name = 'sushi_maki_wall';
    wall.castShadow = true;
    wall.receiveShadow = true;
    roll.add(wall);

    // Cut face: rice disc, salmon core, nori rim. Built as real discs stepped
    // forward in Z rather than one textured plane — a flat card would go edge-on
    // and vanish under this game's pitched-down camera.
    const faceY = rollD * 0.5;
    const riceFace = new THREE.Mesh(new THREE.CircleGeometry(rollR * 0.94, 30), riceMat);
    riceFace.name = 'sushi_maki_rice_face';
    riceFace.rotation.x = -Math.PI / 2;
    riceFace.position.y = faceY + 0.001;
    riceFace.castShadow = true;
    roll.add(riceFace);

    // Two fillings, not one. A single orange disc centred in a white ring on a dark
    // ground is a fried egg — a blind critic named exactly that — and the difference
    // between a fried egg and a maki cut face is that maki has SEVERAL fillings
    // packed off-centre inside the rice.
    const core = new THREE.Mesh(new THREE.CylinderGeometry(rollR * 0.30, rollR * 0.30, rollR * 0.10, 22), salmonMat);
    core.name = 'sushi_maki_core';
    core.position.set(rollR * 0.20, faceY + rollR * 0.04, -rollR * 0.12);
    core.castShadow = true;
    roll.add(core);

    const core2 = new THREE.Mesh(
      new THREE.CylinderGeometry(rollR * 0.20, rollR * 0.20, rollR * 0.10, 18),
      toonMat({ color: '#7FBF4A', roughness: 0.45 })   // cucumber
    );
    core2.name = 'sushi_maki_core2';
    core2.position.set(-rollR * 0.30, faceY + rollR * 0.04, rollR * 0.16);
    core2.castShadow = true;
    roll.add(core2);

    // Thicker nori rim — on a real cut roll the seaweed is a bold ring, and a bold
    // ring is also what tells the eye this is a slice of something.
    const rim = new THREE.Mesh(new THREE.TorusGeometry(rollR * 0.94, rollR * 0.105, 8, 30), toonMat({ color: NORI_DEEP, roughness: 0.4 }));
    rim.name = 'sushi_maki_rim';
    rim.rotation.x = Math.PI / 2;
    rim.position.y = faceY;
    rim.castShadow = true;
    roll.add(rim);

    // Back cap, so the roll is closed from behind.
    const backCap = new THREE.Mesh(new THREE.CircleGeometry(rollR, 30), noriMat);
    backCap.name = 'sushi_maki_back__no_outline';
    backCap.userData.noOutline = true;
    backCap.rotation.x = Math.PI / 2;
    backCap.position.y = -faceY;
    roll.add(backCap);

    // ── Rice sash across the roll's lower edge ────────────────────────────────
    const beltH = torsoH * 0.16;
    const beltLowY = torsoH * 0.16;
    const belt = new THREE.Mesh(new THREE.CylinderGeometry(beltRadius, beltRadius, beltH, 24, 1, true), riceMat);
    belt.name = 'sushi_torso_belt';
    belt.position.y = beltLowY;
    belt.castShadow = true;
    belt.receiveShadow = true;
    this.rig.joints.torso.add(belt);
    for (const dy of [-beltH * 0.5, beltH * 0.5]) {
      const cap = new THREE.Mesh(new THREE.CircleGeometry(beltRadius, 24), riceMat);
      cap.name = 'sushi_torso_belt_cap__no_outline';
      cap.userData.noOutline = true;
      cap.rotation.x = -Math.PI / 2;
      cap.position.y = beltLowY + dy;
      this.rig.joints.torso.add(cap);
    }

    const clasp = new THREE.Mesh(
      new THREE.BoxGeometry(beltRadius * 0.32, beltH * 0.9, beltRadius * 0.14),
      goldMat
    );
    clasp.name = 'sushi_torso_clasp';
    clasp.position.set(0, beltLowY, beltRadius + torsoH * 0.02);
    clasp.castShadow = true;
    this.rig.joints.torso.add(clasp);
  }

  /**
   * Costume layer: a tied hachimaki headband — a thin red ribbon riding the nori
   * band's upper edge, with a knot and two trailing tails at the BACK of the head
   * that project past the rice's own profile (a real silhouette break from the
   * side and back, where nothing else on this character sticks out). A pair of
   * chopsticks tucked into the torso sash is the smaller detail prop, and a thin
   * glossy sliver along the nori's top edge sells wet seaweed rather than flat
   * matte charcoal.
   *
   * The ribbon MOVED in the head+torso round. It used to sit at h 0.46, in what
   * was then clear rice; the wide-low nigiri rewrite turned that stretch into the
   * only place a face fits, so the ribbon dropped onto the nori band's edge. It is
   * built inside a group scaled (SX, 1, SZ) so it hugs the same ellipse as the
   * head, exactly like the nori band it rides on.
   */
  private buildAccessories(
    R: number,
    yAt: (h: number) => number,
    rAt: (h: number) => number,
    zAt: (x: number, h: number) => number,
    SX: number,
    SZ: number
  ): void {
    const head = this.rig.joints.head;
    const bandMat = toonMat({ color: HEADBAND, roughness: 0.55 });
    const knotMat = toonMat({ color: HEADBAND_DARK, roughness: 0.55 });

    const ellipse = new THREE.Group();
    ellipse.name = 'sushi_ribbon_ellipse';
    ellipse.scale.set(SX, 1, SZ);
    head.add(ellipse);

    const bandH = 0.13;
    const bandY = yAt(bandH);
    const bandR = rAt(bandH) * 1.055; // proud of both the rice and the nori band
    const band = new THREE.Mesh(
      new THREE.CylinderGeometry(bandR, bandR, R * 0.05, 30, 1, true),
      bandMat
    );
    band.name = 'sushi_headband';
    band.position.y = bandY;
    band.castShadow = true;
    ellipse.add(band);

    // Knot + tails at the BACK (-Z). Positioned against the real ellipse depth
    // (`zAt` at x=0), not the lathe radius, so they sit against the head rather
    // than 1.9x too far back.
    const backZ = -zAt(0, bandH) * 1.06;
    const knot = new THREE.Mesh(new THREE.SphereGeometry(R * 0.10, 12, 10), knotMat);
    knot.name = 'sushi_headband_knot';
    knot.position.set(0, bandY, backZ);
    knot.scale.set(1.1, 0.85, 0.8);
    knot.castShadow = true;
    head.add(knot);

    for (const sx of [-1, 1] as const) {
      const tail = new THREE.Mesh(roundedBox(R * 0.12, R * 0.40, R * 0.028, R * 0.02, 2), bandMat);
      tail.name = 'sushi_headband_tail';
      tail.position.set(sx * R * 0.10, bandY - R * 0.24, backZ - R * 0.05);
      tail.rotation.set(0.25, 0, sx * 0.22);
      tail.castShadow = true;
      tail.receiveShadow = true;
      head.add(tail);
    }

    // Glaze highlight streak along the nori band's own top edge.
    const highlightMat = glossyMat({ color: '#E8E8E8', roughness: 0.08 });
    const highlight = new THREE.Mesh(
      new THREE.TorusGeometry(rAt(0.15) * 1.02, R * 0.012, 6, 28, Math.PI * 0.5),
      highlightMat
    );
    highlight.name = 'sushi_nori_highlight';
    highlight.rotation.x = Math.PI / 2;
    highlight.rotation.z = Math.PI * 0.65; // front-ish arc, the side a key light would catch
    highlight.position.y = yAt(0.15);
    highlight.userData.noOutline = true;
    ellipse.add(highlight);

    // Chopsticks — a smaller detail prop, tucked crossed into the torso sash at
    // the back. Sized off `rig.metrics`, never off a hand-copied CHARACTER_HEIGHT
    // fraction: this file used to re-derive `shoulderWidth * 1.18 * taper` by hand,
    // which silently goes wrong the moment the archetype or a tweak moves.
    const m = this.rig.metrics;
    if (!m.hasTorso) return;
    const beltRadius = this.beltRadius;
    const beltY = m.torsoHeight * 0.52;

    const chopstickMat = toonMat({ color: CHOPSTICK, roughness: 0.5 });
    for (const sx of [-1, 1] as const) {
      const stick = new THREE.Mesh(new THREE.CylinderGeometry(R * 0.012, R * 0.02, R * 0.62, 8), chopstickMat);
      stick.name = 'sushi_chopstick';
      stick.position.set(sx * beltRadius * 0.30, beltY + R * 0.10, -beltRadius * 0.85);
      stick.rotation.set(0.35, 0, sx * 0.30);
      stick.castShadow = true;
      this.rig.joints.torso.add(stick);
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
  }

  /**
   * Bespoke limbs — an independent art director named the shared snowman-body
   * capsule arms and ball hands as the biggest cast-wide tell. Sushi gets slender
   * rice-white tapered limbs, a smooth rice-ball fist wrapped in a nori ribbon
   * with a small gold stud (Legendary accent, used sparingly per the file's own
   * convention), and a low lacquered boot with a thin gold ankle strap — reading
   * as refined rather than chunky, matching this character's premium tier.
   *
   * A previous pass also added a near-black `cuffRing` at every shoulder/elbow/
   * hip break. Nori against white rice is already this character's highest-
   * contrast pairing (the file header calls it out as the landmark read), so a
   * thick nori ring at every joint was the single worst offender in the whole
   * cast for the "bolted-together action figure" note — removed here. The fist's
   * own ribbon and the boot's own strap now carry the nori/gold accent instead,
   * trimmed down so they read as garment details rather than hardware.
   */
  private dressLimbs(): void {
    // Head+torso round: the limbs are the FISH's orange, not nori charcoal. The
    // rig palette above already says so; this block was still overriding it with
    // near-black, which is why the first render of the rewrite still came back as a
    // mostly-dark character with an orange hat. Nori is now confined to the maki
    // torso, the head's base strip and the boots, where it works as an accent
    // instead of as the character's dominant value.
    const noriLimbMat = glossyMat({ color: SALMON, roughness: 0.34 });
    const noriAccentMat = glossyMat({ color: NORI, roughness: 0.3 });
    const salmonMat = glossyMat({ color: SALMON, roughness: 0.2 });
    const goldMat = toonMat({ color: GOLD, roughness: 0.3, metalness: 0.35 });
    const riceMat = toonMat({ color: RICE, roughness: 0.6 });

    this.rig.dressLimbs((part: LimbPart, size) => {
      switch (part) {
        case 'upperArmL':
        case 'upperArmR':
          return taperedLimb(size.len, size.radius * 1.10, size.radius * 0.82, noriLimbMat);
        case 'forearmL':
        case 'forearmR':
          return taperedLimb(size.len, size.radius * 0.80, size.radius * 0.56, noriLimbMat);
        case 'handL':
        case 'handR': {
          // Rice-ball fists: white against the orange forearm, so the hands read as
          // separate shapes at gameplay distance instead of merging into the limb.
          const side = part === 'handL' ? 1 : -1;
          return buildRiceFist(size.radius, side, riceMat, noriAccentMat, goldMat);
        }
        case 'thighL':
        case 'thighR':
          return taperedLimb(size.len, size.radius * 1.05, size.radius * 0.88, noriLimbMat);
        case 'shinL':
        case 'shinR':
          return taperedLimb(size.len, size.radius * 0.88, size.radius * 0.70, noriLimbMat);
        case 'footL':
        case 'footR':
          // Lacquered nori boots with a rice-pale sole — the dark value moves to
          // the base of the figure, which is where it grounds rather than muddies.
          return buildLacqueredBoot(size.len, noriAccentMat, riceMat, goldMat);
        default:
          return null;
      }
    });
  }

  /** The rig owns all body motion; the base class's whole-body pass would fight it. */
  protected applyBaseMotion(): void {}
}
