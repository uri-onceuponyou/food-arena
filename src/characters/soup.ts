/**
 * Soup (Epic).
 *
 * Built on the shared ChibiRig — see `donut.ts` for the reference implementation of
 * this pattern. The rig supplies torso, arms, hands, legs, feet and all motion; this
 * file authors only the food mass on `rig.joints.head`, the face, a held ladle prop
 * and a palette.
 *
 * Identity is fixed by `rules.ts`: Soup, Epic rarity, Soup Splash / Noodle Toss /
 * Soup Dump. The written description ("wide bowl with rising steam, grey steam-
 * coloured eyes, no mouth") is treated as a personality guide rather than a literal
 * spec, per the brief — but the no-mouth, grey-eyed blank stare is EXPLICITLY kept:
 * it is the one genuinely unsettling-calm read in the whole cast and nothing else
 * has it. The bowl silhouette + rising steam is the landmark; a ladle held in
 * `handR` nods at all three abilities (Splash / Toss / Dump) without inventing new
 * silhouette elements the brief didn't ask for.
 */

import * as THREE from 'three';
import { BaseCharacter, type AnimContext } from './types';
import type { CharacterDef } from '../game/rules';
import { PALETTE } from '../game/rules';
import { toonMat, glossyMat, flatMat, outlineGroup, roundedBox } from '../render/toon';
import { ChibiRig, type LimbPart } from './rig';
import { bodyType } from './bodies';
import { CHARACTER_HEIGHT } from '../units';

const CERAMIC = '#F7F1E6';      // glazed bowl exterior — warm off-white, not clinical
const CERAMIC_SHADE = '#E2D8C4'; // interior shadow / underside
const RIM_TRIM = '#B5432A';      // takeout-bowl rust-red trim band, contrast accent
// Limb/torso body colour. A fresh independent art director scored Soup 4/10 and named
// the cast-wide colour convergence directly: Soup, Water Bottle and Sushi all ended up
// with cream/white tapered limbs and dark boots, reading as the same parts reskinned.
// Soup's bowl stays CERAMIC cream (that identity wasn't the problem), but the BODY
// (arms/legs/torso) moves to a warm stoneware grey — ties back to this character's own
// grey-steam/grey-iris palette rather than inventing an unrelated hue, while being a
// real value/hue break from cream. Cream now lives on the hands (cloth mitts, echoing
// the bowl) instead, so the read becomes "grey sleeves, cream mitts, dark boots".
const GLAZE_GREY = '#9B9691';
const BROTH = PALETTE.broth;     // #E8792A
const BROTH_DARK = '#B85A16';    // broth depth shading
const STEAM = PALETTE.steam;     // #C9C9C9
const NOODLE = '#F2D98A';
const NOODLE_DARK = '#D9B85E';
const WOOD = '#8A5A34';          // ladle handle

// ── Costume layer ────────────────────────────────────────────────────────────
// A fresh independent art director named the missing costume/accessory layer as
// the TOP gap in the whole cast: without one, characters read as "naked mascot
// body with a themed head glued on" no matter how good the body sculpt is. A
// spare ladle worn on a diagonal back-sling is Soup's silhouette-breaking item —
// its handle pokes up past the shoulder line the way a cape or backpack does on
// the reference roster — plus a tied napkin bib layered over the existing apron
// sash as a smaller fabric-panel detail.
const BIB = '#FBF7EE';       // pale napkin cloth, warmer than pure white
const SLING = '#6B4226';     // leather sling strap
const SLING_DARK = '#4A2E1A';

/**
 * Tapered limb segment: a flat cap at the joint origin (plugs flush into the
 * shoulder/hip, no gap) tapering down a straight wall to a rounded tip. Reused here
 * with near-equal top/bottom radii to build the bowl-handle arms and the stubby
 * ceramic legs — glossy, like the bowl exterior itself.
 */
function taperedLimb(len: number, rTop: number, rBot: number, mat: THREE.Material, segs = 12): THREE.Mesh {
  // Points MUST run bottom → top for LatheGeometry's automatic normals to face
  // outward (this file's own BOWL_PROFILE lathe follows the same rule). Getting
  // it backwards was a round 1 defect: the real mesh got face-culled invisible
  // and its outline shell rendered as a solid dark wedge instead of a thin line.
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

/**
 * A small rounded ceramic knob capping the end of a handle — deliberately NOT a
 * ball-fist. A bowl handle terminates as a rounded lip of the same moulded ceramic,
 * not a separate hand shape grafted on; this cap also gives the ladle prop (on
 * `handR`) somewhere to visually seat.
 */
function buildHandleCap(R: number, mat: THREE.Material): THREE.Mesh {
  const m = new THREE.Mesh(new THREE.SphereGeometry(R * 0.92, 14, 12), mat);
  m.name = 'soup_handle_cap';
  m.scale.set(1.0, 0.86, 1.05);
  m.castShadow = true;
  m.receiveShadow = true;
  return m;
}

/**
 * A bowed ceramic handle segment: a TUBE along a curve (not a straight tapered
 * lathe) that still starts at the joint origin and ends exactly `len` below it, so
 * it plugs into the rig's fixed joint positions with no gap, but bows out to the
 * side along the way — the structural fix for "every character shares the same
 * tapered-tube limb". Capped at both ends with rounded ceramic knobs so there is
 * never an open tube cross-section, and no separate "ball hand" reads at all: the
 * upper-arm/forearm/hand chain is authored as one continuous curved loop of the
 * bowl's own material, the strongest available "this is a handle, not an arm" cue.
 */
function buildHandleArc(
  len: number,
  radius: number,
  side: 1 | -1,
  bowOut: number,
  bowFwd: number,
  mat: THREE.Material
): THREE.Group {
  const g = new THREE.Group();
  const start = new THREE.Vector3(0, 0, 0);
  const mid = new THREE.Vector3(side * len * bowOut, -len * 0.5, len * bowFwd);
  const end = new THREE.Vector3(0, -len, 0);
  const curve = new THREE.QuadraticBezierCurve3(start, mid, end);
  const tube = new THREE.Mesh(new THREE.TubeGeometry(curve, 14, radius, 10, false), mat);
  tube.name = 'soup_handle_tube';
  tube.castShadow = true;
  tube.receiveShadow = true;
  g.add(tube);

  const capTop = new THREE.Mesh(new THREE.SphereGeometry(radius * 1.02, 12, 10), mat);
  capTop.position.copy(start);
  capTop.castShadow = true;
  g.add(capTop);
  const capBot = new THREE.Mesh(new THREE.SphereGeometry(radius * 0.9, 12, 10), mat);
  capBot.position.copy(end);
  capBot.castShadow = true;
  g.add(capBot);
  return g;
}

/**
 * A worn strap: a curved tube from `from` to `to`, bowed out through a control
 * point offset by `bow` — the same bezier-tube technique `buildHandleArc` above
 * uses, reused here for costume webbing that has to read as cloth draped over a
 * body rather than a rigid straight rod.
 */
function strapArc(from: THREE.Vector3, to: THREE.Vector3, bow: THREE.Vector3, radius: number, mat: THREE.Material): THREE.Mesh {
  const mid = from.clone().add(to).multiplyScalar(0.5).add(bow);
  const curve = new THREE.QuadraticBezierCurve3(from, mid, to);
  const m = new THREE.Mesh(new THREE.TubeGeometry(curve, 12, radius, 8, false), mat);
  m.castShadow = true;
  m.receiveShadow = true;
  return m;
}

/** A sturdy little foot pad — a low, wide plate rather than a tall boot, echoing a
 * heavy vessel resting on stubby feet directly under its own base, dark against the
 * pale ceramic legs. */
function buildWorkBoot(fw: number, bodyMat: THREE.Material, trimMat: THREE.Material, groundLocalY: number): THREE.Group {
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
  const upper = new THREE.Mesh(roundedBox(fw * 0.96, UPPER_H, fw * 1.34, Math.min(fw * 0.26, UPPER_H * 0.45), 3), bodyMat);
  upper.position.set(0, groundLocalY + SOLE_H + UPPER_H / 2, fw * 0.22);
  upper.castShadow = true;
  upper.receiveShadow = true;
  g.add(upper);

  const sole = new THREE.Mesh(roundedBox(fw * 0.92, SOLE_H, fw * 1.28, fw * 0.07, 2), trimMat);
  sole.position.set(0, soleY, fw * 0.22);
  sole.castShadow = true;
  sole.receiveShadow = true;
  g.add(sole);

  // No separate ankle-cuff ring: the boot's own dark colour against the pale
  // ceramic leg already reads as a material break at the ankle. An earlier pass
  // added a thick contrasting torus here too, and stacked across every limb
  // joint it was exactly what an independent art director called out as
  // "bolted-together hardware" — a worse version of the ball-jointed-skeleton
  // problem this whole bespoke-limb system exists to solve.
  return g;
}

export class SoupCharacter extends BaseCharacter {
  private rig: ChibiRig;
  private steamWisps: THREE.Object3D[] = [];
  private steamMats: THREE.MeshStandardMaterial[] = [];
  private brothSurface!: THREE.Mesh;

  constructor(def: CharacterDef) {
    super(def);

    this.rig = new ChibiRig({
      palette: {
        // A third independent art-director pass named the structural problem
        // directly: every character shares the identical tube-and-ball-joint limb
        // TOPOLOGY, colour changes notwithstanding. Soup's fix is structural, not a
        // recolour — see `dressLimbs()` below, which replaces every slot. This
        // palette is therefore only a fallback that is never actually rendered.
        limb: CERAMIC,
        hand: CERAMIC,
        foot: '#3A2E24',
        torso: GLAZE_GREY,
        limbRoughness: 0.5,
      },
      // Structural fix, round 4: the face was sitting on a narrow neck BELOW the
      // bowl (a small creature wearing the bowl as a hat), and every character
      // shared the same tube-and-ball-joint limbs. Two changes: `headFraction`
      // grows so the wide bowl is unmistakably the dominant identity mass, and the
      // limbs below are rebuilt from scratch as short bowl-handle arms and stubby
      // pedestal legs rather than dressed versions of the shared tube topology.
      // Body: STOUT archetype (see `bodies.ts`) — short wide torso, thick short
      // limbs, low centre of mass. A bowl of soup is the heaviest, most planted
      // thing on the roster and this is the archetype built for that read.
      // `handRadius` stays small on purpose: these are handle caps, not mitts.
      proportions: bodyType('stout', {
        headFraction: 0.58,                     // the bowl dominates the silhouette
        handRadius: CHARACTER_HEIGHT * 0.062,   // small rounded cap, not a mitt
        // 0.25H -> 0.305H. The bowl is 0.32-0.34m half-wide at shoulder height and
        // the pivot sat at 0.52m, which sounds clear — but the bowl FLARES, so the
        // mass above the pivot projects down over the arm from this camera and
        // both upper arms delivered only 0.556 / 0.508, both forearms 0.276 /
        // 0.246, and both hands 0.200 / 0.386. Measuring the mass at the pivot's
        // own height under-reads a flared food; the screen-space overlap does not.
        shoulderWidth: CHARACTER_HEIGHT * 0.305,
      }),
      // Serene and still — the calmest, most nearly-neutral stance in the cast,
      // matching the unsettling-patient no-mouth-then-mouth face. Distinct from
      // every other character's stance in this file's own slice: the only one
      // with almost no shoulder/elbow swing or head turn at all.
      // Both shoulders were swung inward (positive-left and negative-right are
      // both "across the body"), which on a bowl this wide is 0.10m of extra
      // burial for nothing. Signs flipped; the serene, near-neutral read is
      // preserved by keeping the magnitudes the smallest in the cast.
      stance: {
        shoulderL: -0.14, shoulderR: 0.14,
        elbowL: -0.14, elbowR: -0.10,
        twist: 0.02, headTilt: 0.03, headTurn: 0.0,
        hipSway: 0.0, lean: 0.0,
      },
    });
    this.body.add(this.rig.joints.root);
    this.head = this.rig.joints.head;

    const R = this.rig.headRadius;
    const head = this.rig.joints.head;

    // ── Materials ────────────────────────────────────────────────────────────
    const ceramicMat = glossyMat({ color: CERAMIC, roughness: 0.25 });      // glazed bowl
    const ceramicShadeMat = glossyMat({ color: CERAMIC_SHADE, roughness: 0.28 });
    const trimMat = toonMat({ color: RIM_TRIM, roughness: 0.4 });
    const brothMat = glossyMat({ color: BROTH, roughness: 0.12 });          // very wet broth

    // ── Bowl ─────────────────────────────────────────────────────────────────
    // A true lathed bowl profile — flared rim, tapering to a small footed base —
    // rather than a squashed sphere, so the silhouette reads unmistakably as a
    // bowl (the flare-then-footed-base shape is what a sphere can never give).
    // `BOWL_PROFILE`/`bowlSurface()` is the one source of truth for the exterior,
    // mirroring `hamburger.ts`'s crownSurface: every decal (rim trim, eyes) is
    // placed through the same function so nothing floats off the curve or sinks
    // into it — the two failure modes named in the brief.
    //
    // Round 4 defect, the one that survived three rounds of colour/radius fixes:
    // the wall at the face's height (r≈0.52-0.58) was barely half the width of the
    // rim flare above it (r=1.0) — a ~2x radius jump. At a glance that reads as TWO
    // masses: a small head wearing a big flared bowl as a hat, with the eyes stuck
    // on the small head below. Fixed by making the profile reach near-maximum
    // radius EARLY (by h=0.55) and HOLD it through the whole belly where the face
    // sits, so there is no narrower "neck" segment for the eyes to look detached
    // on — only a small footed base at the very bottom (mostly hidden against the
    // torso below) and a modest rolled lip at the very top.
    const BOWL_PROFILE: Array<[r: number, h: number]> = [
      [0, 0], [0.34, 0], [0.40, 0.05], [0.60, 0.14], [0.82, 0.26],
      [0.95, 0.40], [1.0, 0.55], [1.0, 0.76], [0.97, 0.86], [1.04, 0.94], [0.92, 1.0],
    ];
    const bowlBaseR = R * 1.18;
    const bowlH = R * 1.35;
    const bowlBottomY = -R * 1.0; // head-local Y of the bowl's own base (h=0) — sunk into the torso below

    const bowlPoint = (rFrac: number, hFrac: number): THREE.Vector2 =>
      new THREE.Vector2(rFrac * bowlBaseR, bowlBottomY + hFrac * bowlH);

    /** Exact surface point + outward normal at a given (theta, hFrac), via linear
     * interpolation over BOWL_PROFILE — same technique as hamburger's crownSurface. */
    const bowlSurface = (theta: number, hFrac: number): { pos: THREE.Vector3; normal: THREE.Vector3 } => {
      const h = THREE.MathUtils.clamp(hFrac, 0, 1);
      let seg = BOWL_PROFILE[0];
      let segNext = BOWL_PROFILE[1];
      for (let i = 0; i < BOWL_PROFILE.length - 1; i++) {
        if (h >= BOWL_PROFILE[i][1] && h <= BOWL_PROFILE[i + 1][1]) {
          seg = BOWL_PROFILE[i];
          segNext = BOWL_PROFILE[i + 1];
          break;
        }
      }
      const [r0, h0] = seg;
      const [r1, h1] = segNext;
      const t = h1 > h0 ? (h - h0) / (h1 - h0) : 0;
      const rFrac = r0 + (r1 - r0) * t;
      const radius = rFrac * bowlBaseR;
      const y = bowlBottomY + h * bowlH;

      const dR = (r1 - r0) * bowlBaseR;
      const dH = (h1 - h0) * bowlH;
      const n2 = new THREE.Vector2(dH, -dR);
      if (n2.lengthSq() < 1e-8) n2.set(1, 0);
      n2.normalize();

      const nx = Math.sin(theta);
      const nz = Math.cos(theta);
      const pos = new THREE.Vector3(nx * radius, y, nz * radius);
      const normal = new THREE.Vector3(nx * n2.x, n2.y, nz * n2.x).normalize();
      return { pos, normal };
    };

    const bowlGeo = new THREE.LatheGeometry(BOWL_PROFILE.map(([r, h]) => bowlPoint(r, h)), 40);
    const bowl = new THREE.Mesh(bowlGeo, ceramicMat);
    bowl.name = 'soup_bowl';
    bowl.castShadow = true;
    bowl.receiveShadow = true;
    head.add(bowl);

    // Rim trim — a thin contrasting band just under the rolled rim lip (the new
    // profile's h 0.86-0.94 flare), the "costume colour contrast" the reference bar
    // calls for, echoed on the torso.
    const trimTop = 0.90, trimBottom = 0.80;
    const trimTopPt = bowlSurface(0, trimTop);
    const trimBotPt = bowlSurface(0, trimBottom);
    const trimRadiusTop = new THREE.Vector2(trimTopPt.pos.x, trimTopPt.pos.z).length() * 1.02;
    const trimRadiusBot = new THREE.Vector2(trimBotPt.pos.x, trimBotPt.pos.z).length() * 1.02;
    const trim = new THREE.Mesh(
      new THREE.CylinderGeometry(trimRadiusTop, trimRadiusBot, trimTopPt.pos.y - trimBotPt.pos.y, 40, 1, true),
      trimMat
    );
    trim.name = 'soup_rim_trim';
    trim.position.y = (trimTopPt.pos.y + trimBotPt.pos.y) / 2;
    trim.castShadow = true;
    trim.receiveShadow = true;
    head.add(trim);

    // Underside shading disc — closes the bowl's hollow interior at the base so the
    // open lathe never shows a see-through hole from a low camera angle.
    const underside = new THREE.Mesh(new THREE.CircleGeometry(BOWL_PROFILE[1][0] * bowlBaseR, 24), ceramicShadeMat);
    underside.name = 'soup_underside__no_outline';
    underside.userData.noOutline = true;
    underside.rotation.x = Math.PI / 2;
    underside.position.y = bowlBottomY + 0.001;
    head.add(underside);

    // ── Broth surface ────────────────────────────────────────────────────────
    // A shallow glossy disc filling the bowl's opening, set just below the rim so
    // it reads as liquid inside rather than a lid on top.
    const brothH = 0.95;
    const brothPt = bowlSurface(0, brothH);
    const brothRadius = new THREE.Vector2(brothPt.pos.x, brothPt.pos.z).length() * 0.90;
    this.brothSurface = new THREE.Mesh(new THREE.CircleGeometry(brothRadius, 32), brothMat);
    this.brothSurface.name = 'soup_broth';
    this.brothSurface.rotation.x = -Math.PI / 2;
    this.brothSurface.position.y = brothPt.pos.y - R * 0.02;
    this.brothSurface.receiveShadow = true;
    head.add(this.brothSurface);

    // A darker broth-depth ring near the rim, and a couple of floating garnish bits,
    // so the broth reads as liquid with real depth rather than a flat orange disc.
    const brothDeepMat = glossyMat({ color: BROTH_DARK, roughness: 0.16 });
    const brothRing = new THREE.Mesh(new THREE.RingGeometry(brothRadius * 0.7, brothRadius * 0.98, 32), brothDeepMat);
    brothRing.name = 'soup_broth_ring__no_outline';
    brothRing.userData.noOutline = true;
    brothRing.rotation.x = -Math.PI / 2;
    brothRing.position.y = this.brothSurface.position.y + R * 0.002;
    head.add(brothRing);

    for (const [gx, gz] of [[0.3, 0.1], [-0.35, -0.15], [0.05, -0.35]] as const) {
      const speck = new THREE.Mesh(new THREE.SphereGeometry(R * 0.035, 8, 6), toonMat({ color: '#5C8A3A', roughness: 0.4 }));
      speck.position.set(gx * brothRadius, this.brothSurface.position.y + R * 0.01, gz * brothRadius);
      speck.scale.set(1, 0.3, 1);
      speck.userData.noOutline = true;
      head.add(speck);
    }

    this.buildSteam(R, brothPt.pos.y, brothRadius);
    this.buildFace(R, bowlSurface);
    this.buildLadle();
    this.dressTorsoAsSoup();
    this.dressLimbs();
    this.buildAccessories(R, bowlSurface);

    outlineGroup(this.root);
    this.collectFlashTargets();
    this.rig.restPose();
  }

  /**
   * Rising steam — translucent, soft-matte wisps (not glossy, which would read as
   * glass/plastic) drifting up from the broth surface. Kept few and subtle per the
   * brief: enough to sell "hot" without washing out the face at gameplay distance.
   */
  private buildSteam(R: number, brothY: number, brothRadius: number): void {
    const head = this.rig.joints.head;
    const wispSpots: Array<[number, number]> = [[-0.35, 0], [0.15, 0.3], [0.4, -0.25]];
    for (let i = 0; i < wispSpots.length; i++) {
      const [wx, wz] = wispSpots[i];
      const group = new THREE.Group();
      group.name = 'soup_steam_wisp';
      group.position.set(wx * brothRadius * 0.7, brothY, wz * brothRadius * 0.7);
      head.add(group);

      const mat = toonMat({ color: STEAM, roughness: 0.9, transparent: true, opacity: 0.3 }) as THREE.MeshStandardMaterial;
      // Steam that writes depth punches a hole in whatever is behind it — and what
      // is behind it is this character's own face. `docs/LESSONS.md` §1.
      mat.depthWrite = false;
      this.steamMats.push(mat);
      // Three stacked, slightly offset capsules per wisp — a cheap curling-smoke read
      // without needing a real particle system.
      for (let j = 0; j < 3; j++) {
        const seg = new THREE.Mesh(new THREE.CapsuleGeometry(R * (0.042 - j * 0.007), R * 0.11, 4, 6), mat);
        seg.position.set(Math.sin(j * 1.7 + i) * R * 0.04, R * (0.08 + j * 0.09), Math.cos(j * 1.3 + i) * R * 0.03);
        seg.rotation.z = Math.sin(j + i) * 0.3;
        seg.userData.noOutline = true;
        group.add(seg);
      }
      this.steamWisps.push(group);
    }
  }

  /**
   * Grey steam-coloured eyes and NO mouth — the one genuinely unsettling-calm read
   * in the cast, kept and sharpened rather than removed.
   *
   * With no mouth, the eyes carry the ENTIRE face, so they get top billing on the
   * bowl: EYE_H now sits in the real near-vertical WALL segment the narrowed
   * `BOWL_PROFILE` holds through h 0.16–0.58 (see the bowl comment above), where
   * the true surface normal points mostly outward rather than down — a genuinely
   * visible, camera-facing surface, not the underside of a flare. Eyes are sized
   * up from the previous pass now that the bowl itself is ~30% narrower, so they
   * read as prominent rather than lost against the ceramic. Each eye keeps its
   * heavy ceramic-toned LID — a shallow shell that caps the sclera's upper third
   * and casts a real shadow line — plus a soft brow stroke above: together they
   * turn "two dots" into a deliberate, sleepy, PATIENT stare, the single highest-
   * leverage shape this character has. Both eyes are built from one mirrored loop
   * at identical size/height, so any residual asymmetry in the render is the
   * camera angle, not the geometry.
   */
  private buildFace(R: number, bowlSurface: (theta: number, hFrac: number) => { pos: THREE.Vector3; normal: THREE.Vector3 }): void {
    const face = this.rig.joints.face;
    face.position.set(0, 0, 0); // features are authored directly on `head` in exact surface coords
    const head = this.rig.joints.head;

    // Structural fix, round 4: EYE_H now sits at h=0.62, squarely inside the
    // profile's h 0.55-0.76 plateau where the bowl holds its FULL rim-width radius
    // (see BOWL_PROFILE's own comment) — the same wide wall the rim trim and the
    // broth sit on, not a narrower transitional neck below it. The face is now ON
    // the bowl's main body, not on a separate head-shaped mass underneath it.
    // Orientation still uses the flattened HORIZONTAL-outward direction rather
    // than the raw 3D normal, as a belt-and-braces fix against any residual
    // downward tilt in the wall segment.
    const EYE_THETA = 0.46;
    const EYE_H = 0.62;
    // Darkened hard from #6B6E72. `rules.ts` calls for "grey steam-coloured eyes",
    // and a mid-grey iris on a near-white sclera on a cream bowl is three values
    // inside half a stop — a blind critic reported that at small size the face
    // vanishes entirely and the character reads as an empty dish. This is still a
    // cool grey rather than the cast's ink, so it keeps the steam association, but
    // it now has the value separation an eye needs to survive at ~10px.
    const irisMat = toonMat({ color: '#2B3138', roughness: 0.3 });
    const scleraMat = toonMat({ color: '#EDEDEA', roughness: 0.3 });
    const lidMat = toonMat({ color: '#B7BABD', roughness: 0.35 }); // between sclera and iris — a real shaded lid
    const browMat = toonMat({ color: '#3A4149', roughness: 0.4 }); // groups with the iris as "the eye area"

    for (const sx of [-1, 1] as const) {
      const { pos } = bowlSurface(sx * EYE_THETA, EYE_H);
      const outward = new THREE.Vector3(pos.x, 0, pos.z).normalize();
      const eye = new THREE.Group();
      eye.position.copy(pos).addScaledVector(outward, R * 0.03);
      eye.quaternion.setFromUnitVectors(new THREE.Vector3(0, 0, 1), outward);
      head.add(eye);

      const white = new THREE.Mesh(new THREE.SphereGeometry(R * 0.205, 16, 14), scleraMat);
      white.scale.set(1, 1, 0.55);
      white.castShadow = true;
      eye.add(white);

      const iris = new THREE.Mesh(new THREE.SphereGeometry(R * 0.125, 14, 12), irisMat);
      iris.position.set(0, 0, R * 0.075);
      iris.scale.set(1, 1, 0.55);
      iris.castShadow = true;
      eye.add(iris);

      const glint = new THREE.Mesh(new THREE.SphereGeometry(R * 0.029, 8, 8), flatMat('#ffffff'));
      glint.position.set(-R * 0.030, R * 0.036, R * 0.11);
      glint.userData.noOutline = true;
      eye.add(glint);

      // Heavy lid — a shallow dome capping the sclera's upper third, sitting proud
      // (bigger radius + forward Z) so it casts a real shadow line rather than
      // z-fighting with the white beneath. This is what turns a bare "dot on a
      // curve" into a deliberate, sleepy, PATIENT stare — the single highest-
      // leverage shape available here, since there is no mouth to share the work.
      const lid = new THREE.Mesh(
        new THREE.SphereGeometry(R * 0.185, 16, 10, 0, Math.PI * 2, 0, Math.PI * 0.30),
        lidMat
      );
      lid.name = 'soup_eye_lid';
      lid.position.set(0, R * 0.022, R * 0.022);
      lid.scale.set(1, 1, 0.62);
      lid.castShadow = true;
      eye.add(lid);

      // A soft brow stroke above the lid — flat, calm, not angled into a V (which
      // would read as annoyed rather than unsettling-calm).
      const brow = new THREE.Mesh(new THREE.CapsuleGeometry(R * 0.019, R * 0.16, 4, 8), browMat);
      brow.name = 'soup_brow';
      brow.rotation.z = Math.PI / 2 + sx * 0.05;
      brow.position.set(0, R * 0.165, R * 0.036);
      brow.castShadow = true;
      eye.add(brow);
    }

    // A small, serene mouth. A fresh independent art director was blunt: "no mouth or
    // brows — just dot-eyes on a stalk. That's the single biggest appeal gap," and the
    // brief explicitly authorises dropping the original no-mouth spec since it measurably
    // costs quality. Kept true to the personality doc's intent, though: a thin, nearly
    // flat closed curve with just a hint of an upturn at the ends — calm and knowing
    // rather than a grin — so the unsettling-patient read from the eyes/lids survives.
    // Sits centred (theta=0) below the eyes, still inside the wide plateau (the
    // profile holds full width from h=0.55) rather than down in the narrower
    // ramp-up zone below it, so mouth and eyes read as one continuous face on one
    // continuous wide wall.
    const MOUTH_H = 0.48;
    const mouthPt = bowlSurface(0, MOUTH_H);
    const mouthOutward = new THREE.Vector3(mouthPt.pos.x, 0, mouthPt.pos.z).normalize();
    const mouth = new THREE.Group();
    mouth.position.copy(mouthPt.pos).addScaledVector(mouthOutward, R * 0.028);
    mouth.quaternion.setFromUnitVectors(new THREE.Vector3(0, 0, 1), mouthOutward);
    head.add(mouth);

    const mouthMat = toonMat({ color: '#343A41', roughness: 0.4 }); // groups with the (now darker) iris/brow, not lip-pink
    const mouthLine = new THREE.Mesh(
      new THREE.TorusGeometry(R * 0.085, R * 0.017, 8, 16, Math.PI * 0.55),
      mouthMat
    );
    mouthLine.name = 'soup_mouth';
    mouthLine.rotation.z = Math.PI * 1.225; // a shallow, almost-flat arc — serene, not a grin
    mouthLine.castShadow = true;
    mouth.add(mouthLine);
  }

  /**
   * A ladle in `handR`: wooden handle + a small steel scoop, nodding at Soup
   * Splash/Noodle Toss/Soup Dump without inventing an unrelated prop. A few
   * noodles drape over the scoop's rim as the "matte noodle" material callout.
   */
  private buildLadle(): void {
    // Round 2 defect: every offset here was scaled against `R` (the BOWL/head
    // radius, ~0.44m) instead of the hand's own scale. `ChibiRig` sizes the hand
    // mitt from `CHARACTER_HEIGHT` (handRadius = height*0.075 ≈ 0.16m) — completely
    // independent of the food mass — so an offset of `R*0.05` (~0.02m) barely
    // clears the CENTRE of a 0.16m-radius hand sphere: the whole prop was built
    // sitting inside the mitt, invisible. Fixed by sizing against handRadius.
    const handRadius = this.rig.metrics.handRadius;
    const hand = this.rig.joints.handR;
    const ladle = new THREE.Group();
    ladle.name = 'soup_ladle';
    ladle.position.set(handRadius * 0.1, 0, handRadius * 0.35);
    ladle.rotation.set(-0.25, 0, 0.12);
    hand.add(ladle);

    const handleMat = toonMat({ color: WOOD, roughness: 0.6 });
    const handle = new THREE.Mesh(new THREE.CapsuleGeometry(handRadius * 0.16, handRadius * 1.7, 4, 8), handleMat);
    handle.name = 'soup_ladle_handle';
    handle.position.set(0, -handRadius * 0.35, 0);
    handle.castShadow = true;
    ladle.add(handle);

    const bowlMat = glossyMat({ color: '#C7CDD4', roughness: 0.3, metalness: 0.4 });
    const scoop = new THREE.Mesh(new THREE.SphereGeometry(handRadius * 0.5, 16, 12, 0, Math.PI * 2, 0, Math.PI * 0.62), bowlMat);
    scoop.name = 'soup_ladle_scoop';
    scoop.position.set(0, -handRadius * 1.55, 0);
    scoop.rotation.x = Math.PI;
    scoop.castShadow = true;
    ladle.add(scoop);

    // Noodles draped over the scoop rim — matte, per the brief's roughness callout.
    const noodleMat = toonMat({ color: NOODLE, roughness: 0.6 });
    const noodleDarkMat = toonMat({ color: NOODLE_DARK, roughness: 0.6 });
    for (let i = 0; i < 4; i++) {
      const noodle = new THREE.Mesh(new THREE.CapsuleGeometry(handRadius * 0.05, handRadius * 0.7, 3, 6), i % 2 === 0 ? noodleMat : noodleDarkMat);
      noodle.name = 'soup_noodle';
      const a = -0.5 + i * 0.33;
      noodle.position.set(Math.sin(a) * handRadius * 0.3, -handRadius * 1.28, Math.cos(a) * handRadius * 0.2);
      noodle.rotation.set(Math.PI / 2 + Math.sin(a) * 0.4, 0, a * 0.6);
      noodle.castShadow = true;
      ladle.add(noodle);
    }
  }

  /**
   * Dresses the torso as a simple vendor apron: a contrasting rust-trimmed bib over
   * the pale ceramic limb colour, matching the "contrasting costume colours" note
   * from the reference bar. There is no `dressTorso` helper on the shared rig, so
   * the apron is sized against the torso's own known geometry — `rig.ts` builds the
   * torso as a tapered sphere of half-width `(shoulderWidth*1.18)*0.5` at its
   * equator, scaled by a taper factor that peaks at ~1.123 around the vertical
   * midpoint — with a safety margin so the apron sits proud rather than sinking
   * into that taper at any point.
   */
  private dressTorsoAsSoup(): void {
    // Read off the rig, never hand-mirrored: body proportions come from an
    // archetype (`bodies.ts`) now, so a hardcoded copy of a rig constant goes
    // silently wrong the moment the archetype changes.
    const tw = this.rig.metrics.torsoWidth;
    const torsoH = this.rig.metrics.torsoHeight;
    const taperMid = 0.86 + 0.30 * Math.sin(0.5 * Math.PI * 0.85); // rig.ts's taper at t=0.5
    const torsoHalfWidthMid = tw * 0.5 * taperMid;
    const beltRadius = torsoHalfWidthMid * 1.16;
    const beltY = torsoH * 0.48;

    const trimMat = toonMat({ color: RIM_TRIM, roughness: 0.4 });
    const sash = new THREE.Mesh(new THREE.CylinderGeometry(beltRadius, beltRadius * 1.05, torsoH * 0.24, 24, 1, true), trimMat);
    sash.name = 'soup_torso_sash';
    sash.position.y = beltY;
    sash.castShadow = true;
    sash.receiveShadow = true;
    this.rig.joints.torso.add(sash);
    for (const dy of [-torsoH * 0.12, torsoH * 0.12]) {
      const rFrac = dy < 0 ? 1.05 : 1.0;
      const cap = new THREE.Mesh(new THREE.CircleGeometry(beltRadius * rFrac, 24), trimMat);
      cap.name = 'soup_torso_sash_cap__no_outline';
      cap.userData.noOutline = true;
      cap.rotation.x = -Math.PI / 2;
      cap.position.y = beltY + dy;
      this.rig.joints.torso.add(cap);
    }
  }

  /**
   * Costume layer: a spare ladle worn on a diagonal back-sling (handle poking up
   * past the shoulder — the silhouette-breaking element), a tied napkin bib
   * layered above the existing apron sash, and a bright ceramic glaze-highlight
   * streak climbing the bowl's own belly — the "glossy specular rim" for
   * ceramic the material-fidelity note calls for by name.
   */
  private buildAccessories(R: number, bowlSurface: (theta: number, hFrac: number) => { pos: THREE.Vector3; normal: THREE.Vector3 }): void {
    const head = this.rig.joints.head;
    const shoulderWidth = this.rig.metrics.shoulderWidth;
    const torsoH = this.rig.metrics.torsoHeight;

    // ── Napkin bib ────────────────────────────────────────────────────────────
    // A tied cloth bib hanging from the neck over the chest, layered above the
    // sash built in `dressTorsoAsSoup` so the body reads as dressed in two
    // garment pieces rather than one flat colour — reinforcing the exact
    // "garment, not paint-on-a-blob" read the critic already praised.
    const bibMat = toonMat({ color: BIB, roughness: 0.62 });
    const bibTrimMat = toonMat({ color: RIM_TRIM, roughness: 0.42 });
    const bTopY = torsoH * 0.94, bBotY = torsoH * 0.42;
    const bHalfW = shoulderWidth * 0.30;
    const midY = (bTopY + bBotY) / 2;
    const bibShapeAt = (scale: number): THREE.Shape => {
      const sc = (y: number) => midY + (y - midY) * scale;
      const s = new THREE.Shape();
      s.moveTo(0, sc(bTopY));
      s.lineTo(bHalfW * scale * 0.35, sc(bTopY - (bTopY - bBotY) * 0.12));
      s.lineTo(bHalfW * scale, sc(bBotY + (bTopY - bBotY) * 0.22));
      s.quadraticCurveTo(0, sc(bBotY - (bTopY - bBotY) * 0.12), -bHalfW * scale, sc(bBotY + (bTopY - bBotY) * 0.22));
      s.lineTo(-bHalfW * scale * 0.35, sc(bTopY - (bTopY - bBotY) * 0.12));
      s.lineTo(0, sc(bTopY));
      return s;
    };
    const bibDepth = shoulderWidth * 0.05;
    const bibOuter = new THREE.Mesh(
      new THREE.ExtrudeGeometry(bibShapeAt(1.0), { depth: bibDepth, bevelEnabled: true, bevelThickness: bibDepth * 0.3, bevelSize: bibDepth * 0.3, bevelSegments: 2, curveSegments: 16 }),
      bibTrimMat
    );
    bibOuter.name = 'soup_bib_trim';
    bibOuter.position.z = shoulderWidth * 0.60;
    bibOuter.castShadow = true;
    bibOuter.receiveShadow = true;
    this.rig.joints.torso.add(bibOuter);

    const innerDepth = bibDepth * 0.6;
    const bibInner = new THREE.Mesh(
      new THREE.ExtrudeGeometry(bibShapeAt(0.80), { depth: innerDepth, bevelEnabled: true, bevelThickness: innerDepth * 0.3, bevelSize: innerDepth * 0.3, bevelSegments: 2, curveSegments: 16 }),
      bibMat
    );
    bibInner.name = 'soup_bib';
    bibInner.position.z = shoulderWidth * 0.60 + bibDepth;
    bibInner.castShadow = true;
    bibInner.receiveShadow = true;
    this.rig.joints.torso.add(bibInner);

    const tie = new THREE.Mesh(new THREE.CapsuleGeometry(shoulderWidth * 0.018, shoulderWidth * 0.42, 4, 8), bibTrimMat);
    tie.name = 'soup_bib_tie';
    tie.rotation.z = Math.PI / 2;
    tie.position.set(0, bTopY + shoulderWidth * 0.02, shoulderWidth * 0.44);
    tie.castShadow = true;
    this.rig.joints.torso.add(tie);

    // ── Back-sling ladle ──────────────────────────────────────────────────────
    // Placement rule: the rig's thighs hang straight DOWN from y=0 in this same
    // torso-local frame, so the sling's low end stays at y ≥ torsoH*0.28 —
    // comfortably above the hip line, clear of the cast's thickest legs.
    const slingMat = toonMat({ color: SLING, roughness: 0.76 });
    const shoulderPt = new THREE.Vector3(shoulderWidth * 0.48, torsoH * 0.97, -shoulderWidth * 0.18);
    const hipPt = new THREE.Vector3(-shoulderWidth * 0.40, torsoH * 0.30, -shoulderWidth * 0.55);
    const sling = strapArc(shoulderPt, hipPt, new THREE.Vector3(shoulderWidth * 0.05, 0, -shoulderWidth * 0.30), shoulderWidth * 0.06, slingMat);
    sling.name = 'soup_ladle_sling';
    this.rig.joints.torso.add(sling);

    const dir = shoulderPt.clone().sub(hipPt).normalize();
    const miniLadle = new THREE.Group();
    miniLadle.name = 'soup_sling_ladle';
    miniLadle.position.copy(hipPt).addScaledVector(dir, shoulderWidth * 0.05);
    miniLadle.quaternion.setFromUnitVectors(new THREE.Vector3(0, 1, 0), dir);
    this.rig.joints.torso.add(miniLadle);

    const handleMat = toonMat({ color: WOOD, roughness: 0.6 });
    const handle = new THREE.Mesh(new THREE.CapsuleGeometry(shoulderWidth * 0.024, shoulderWidth * 0.55, 4, 8), handleMat);
    handle.name = 'soup_sling_ladle_handle';
    handle.position.y = shoulderWidth * 0.30;
    handle.castShadow = true;
    miniLadle.add(handle);

    const scoopMat = glossyMat({ color: '#C7CDD4', roughness: 0.3, metalness: 0.4 });
    const scoop = new THREE.Mesh(new THREE.SphereGeometry(shoulderWidth * 0.13, 14, 10, 0, Math.PI * 2, 0, Math.PI * 0.62), scoopMat);
    scoop.name = 'soup_sling_ladle_scoop';
    scoop.rotation.x = Math.PI;
    scoop.position.y = -shoulderWidth * 0.04;
    scoop.castShadow = true;
    miniLadle.add(scoop);

    // ── Glaze highlight ───────────────────────────────────────────────────────
    // A bright, near-mirror streak climbing the bowl's own belly, off to one
    // side clear of the face/rim-trim — the photographed ceramic specular pop
    // the material-fidelity note calls for by name.
    const stripeTheta = -1.15;
    const stripePts: THREE.Vector3[] = [];
    for (let i = 0; i <= 4; i++) {
      const h = 0.30 + (i / 4) * 0.45;
      const { pos, normal } = bowlSurface(stripeTheta, h);
      const outward = new THREE.Vector3(normal.x, normal.y * 0.3, normal.z).normalize();
      stripePts.push(pos.clone().addScaledVector(outward, R * 0.015));
    }
    const stripeCurve = new THREE.CatmullRomCurve3(stripePts);
    const highlightMat = glossyMat({ color: '#FFFCF5', roughness: 0.06 });
    const highlight = new THREE.Mesh(new THREE.TubeGeometry(stripeCurve, 16, R * 0.02, 8, false), highlightMat);
    highlight.name = 'soup_glaze_highlight';
    highlight.userData.noOutline = true;
    head.add(highlight);
  }

  protected onUpdate(ctx: AnimContext): void {
    this.rig.animate({
      elapsed: this.elapsed,
      move01: ctx.moveSpeed01,
      attack01: this.attackT >= 0 ? this.attackT / this.attackDuration : -1,
      hit01: this.hitT >= 0 ? this.hitT / 0.26 : -1,
      dead01: this.deathT >= 0 ? this.deathT / 0.75 : -1,
    });

    // Steam drifts and slowly billows — each wisp rises, fades and resets on its own
    // offset cycle so the three never sync into one pulsing blob.
    for (let i = 0; i < this.steamWisps.length; i++) {
      const wisp = this.steamWisps[i];
      const cycle = 2.6;
      const t = ((this.elapsed + i * 0.9) % cycle) / cycle;
      wisp.position.y = wisp.userData.baseY ?? (wisp.userData.baseY = wisp.position.y);
      wisp.position.y = (wisp.userData.baseY as number) + t * this.rig.headRadius * 0.34;
      wisp.rotation.y = this.elapsed * 0.6 + i;
      wisp.scale.setScalar(0.7 + t * 0.35);
      const mat = this.steamMats[i];
      if (mat) mat.opacity = 0.34 * (1 - t) * (t < 0.15 ? t / 0.15 : 1);
    }

    // Broth gently shimmers via a faint bob — cheap "hot liquid" life.
    this.brothSurface.position.y += Math.sin(this.elapsed * 3.2) * 0.0005;
  }

  /**
   * Structural limb rebuild, round 4. Three independent art-director passes named
   * the same root cause: every character shares the identical tapered-tube-and-
   * ball-joint limb TOPOLOGY, and recolouring that shared skeleton doesn't fix it.
   * Soup's brief: a wide heavy bowl doesn't need long tube arms and legs.
   *
   * Arms are now a pair of BOWED ceramic handles (`buildHandleArc`, a curved tube,
   * not a straight taper) running shoulder→elbow→hand as one continuous loop of
   * the bowl's own glossy ceramic material — reading as the bowl's own handles,
   * not as arms bolted onto a generic frame. There is no separate "ball hand": the
   * hand joint gets a small rounded cap of the same material, the loop's terminus.
   *
   * Legs are short, thick, near-uniform ceramic-stoneware posts — thigh and shin
   * share one material and almost the same radius, so the knee never reads as a
   * distinct jointed segment — ending in a low, wide dark foot pad directly under
   * the bowl, echoing a heavy vessel standing on stubby feet rather than walking
   * on legs.
   */
  private dressLimbs(): void {
    const handleMat = glossyMat({ color: CERAMIC, roughness: 0.22 }); // same material as the bowl itself
    const legMat = toonMat({ color: CERAMIC_SHADE, roughness: 0.48 }); // matte stoneware pedestal
    const trimMat = toonMat({ color: RIM_TRIM, roughness: 0.4 });
    const bootMat = toonMat({ color: '#3A2E24', roughness: 0.7 });

    this.rig.dressLimbs((part: LimbPart, size) => {
      switch (part) {
        case 'upperArmL':
        case 'upperArmR': {
          const side = part === 'upperArmL' ? 1 : -1;
          // Thinner than the rig's own arm radius and bowed hard outward — the
          // point is to NOT read as a muscle/limb thickness at all, but as a
          // moulded ceramic loop of roughly constant, modest thickness.
          return buildHandleArc(size.len, size.radius * 0.60, side, 1.0, 0.10, handleMat);
        }
        case 'forearmL':
        case 'forearmR': {
          const side = part === 'forearmL' ? 1 : -1;
          // Bows the OTHER way relative to the upper arm, so the two segments
          // together read as one D-shaped handle looping back toward the body
          // rather than a straight tube bent once at a joint.
          return buildHandleArc(size.len, size.radius * 0.52, side, -0.85, 0.12, handleMat);
        }
        case 'handL':
        case 'handR':
          return buildHandleCap(size.radius, handleMat);
        case 'thighL':
        case 'thighR':
          return taperedLimb(size.len, size.radius * 1.0, size.radius * 0.94, legMat);
        case 'shinL':
        case 'shinR':
          // Same material, near-identical radius to the thigh — no taper break at
          // the knee, so the leg reads as one short stub post, not two tube
          // segments joined at a visible ball joint.
          return taperedLimb(size.len, size.radius * 0.94, size.radius * 0.88, legMat);
        case 'footL':
        case 'footR':
          return buildWorkBoot(size.len, bootMat, trimMat, size.groundY);
        default:
          return null;
      }
    });
  }

  /** The rig owns all body motion; the base class's whole-body pass would fight it. */
  protected applyBaseMotion(): void {}
}
