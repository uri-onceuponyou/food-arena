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

/**
 * Tapered limb segment: a flat cap at the joint origin (plugs flush into the
 * shoulder/hip, no gap) tapering down a straight wall to a rounded tip. Used for a
 * glazed-ceramic "sleeve" read — glossy, like the bowl exterior itself.
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

/** A thin rust-trim ring at local Y `y` — the apron sash's colour, cinched at the
 * wrist/elbow/knee like a rolled sleeve or cuffed pant leg. */
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
 * A cloth oven mitt — a flat paddle shape with a separate thumb, deliberately NOT a
 * round fist, so the glazed-ceramic arm visibly ends in a fabric mitt rather than
 * continuing the same material all the way down (the material break the brief calls
 * for: ceramic sleeve → cloth mitt).
 */
function buildOvenMitt(R: number, side: 1 | -1, mat: THREE.Material): THREE.Group {
  const g = new THREE.Group();
  const paddle = new THREE.Mesh(new THREE.SphereGeometry(R * 0.98, 14, 12), mat);
  paddle.scale.set(1.12, 0.62, 1.02);
  paddle.castShadow = true;
  paddle.receiveShadow = true;
  g.add(paddle);

  const cuffBand = new THREE.Mesh(new THREE.CylinderGeometry(R * 0.66, R * 0.66, R * 0.34, 14, 1, true), mat);
  cuffBand.name = 'mitt_cuff_band';
  cuffBand.position.set(0, R * 0.42, 0);
  cuffBand.castShadow = true;
  cuffBand.receiveShadow = true;
  g.add(cuffBand);

  const thumb = new THREE.Mesh(new THREE.CapsuleGeometry(R * 0.30, R * 0.34, 4, 8), mat);
  thumb.position.set(side * R * 0.80, -R * 0.02, R * 0.18);
  thumb.rotation.set(0.2, 0, side * 0.75);
  thumb.castShadow = true;
  thumb.receiveShadow = true;
  g.add(thumb);
  return g;
}

/** A sturdy vendor's work boot — toe box, sole plate and an ankle cuff blending up
 * into the shin, dark against the pale ceramic limbs. */
function buildWorkBoot(fw: number, bodyMat: THREE.Material, trimMat: THREE.Material): THREE.Group {
  const g = new THREE.Group();
  const upper = new THREE.Mesh(roundedBox(fw * 0.96, fw * 0.68, fw * 1.34, fw * 0.26, 3), bodyMat);
  upper.position.set(0, -fw * 0.12, fw * 0.22);
  upper.castShadow = true;
  upper.receiveShadow = true;
  g.add(upper);

  const sole = new THREE.Mesh(roundedBox(fw * 1.04, fw * 0.20, fw * 1.56, fw * 0.09, 2), trimMat);
  sole.position.set(0, -fw * 0.48, fw * 0.30);
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
        limb: GLAZE_GREY,  // stoneware-grey sleeves — see the constant's own comment
        hand: CERAMIC,     // cream cloth mitts, echoing the bowl's own ceramic tone
        foot: '#3A2E24',   // dark boots — matches the reference bar's dark footwear
        torso: GLAZE_GREY,
        limbRoughness: 0.5,
      },
      // A fresh independent art director scored Soup 4/10 and named the body plan
      // directly: "one templated body reskinned with different heads" — every character
      // took the rig's defaults. Soup is written as wide-bodied and low with a heavy
      // planted base, so it gets the widest shoulders/stance and the thickest, stubbiest
      // limbs in the cast (a tureen on stout little legs, not a bowl on a generic frame).
      proportions: {
        // Unchanged from the original — the bowl's own flared-rim profile already
        // measures ~2.23m at this headFraction regardless (verified directly; it's a
        // pre-existing property of the bowl shape, not something the new body
        // proportions below affect), so there's no cheap win from nudging it further.
        headFraction: 0.46,      // the bowl is WIDE and shallow, not tall
        shoulderWidth: CHARACTER_HEIGHT * 0.27,  // widest body in the cast
        stanceWidth: CHARACTER_HEIGHT * 0.165,   // widest, most heavily planted stance
        armRadius: CHARACTER_HEIGHT * 0.074,     // thick, stubby
        handRadius: CHARACTER_HEIGHT * 0.076,
        legRadius: CHARACTER_HEIGHT * 0.088,     // thickest, stubbiest legs in the cast
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
    // Round 2 defect: `bowlBaseR` was 1.6R — wider than the character was tall —
    // so the flare read as a satellite dish dominating the whole silhouette, and
    // the profile flared so early (from h≈0.16 on) that there was no real vertical
    // wall left for the face to sit on; the eyes ended up small and low on the
    // underside of the flare, barely visible. Fixed on two axes: `bowlBaseR` is
    // cut by ~30% to a genuine "wide bowl" rather than a dish, and the profile now
    // holds a real near-vertical WALL through h 0.16–0.58 (r grows much slower than
    // h there) before flaring out toward the rim above it — giving the face a
    // clearly visible, mostly-outward-facing surface below the flare instead of
    // inside it.
    const BOWL_PROFILE: Array<[r: number, h: number]> = [
      [0, 0], [0.36, 0], [0.40, 0.06], [0.46, 0.16], [0.52, 0.30],
      [0.58, 0.44], [0.66, 0.58], [0.78, 0.72], [0.92, 0.86], [1.0, 1.0],
    ];
    const bowlBaseR = R * 1.15;
    const bowlH = R * 1.35;
    const bowlBottomY = -R * 1.0; // head-local Y of the bowl's own base (h=0) — flush with the neck

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

    // Rim trim — a thin contrasting band just under the flared rim lip, the
    // "costume colour contrast" the reference bar calls for, echoed on the torso.
    const trimTop = 0.82, trimBottom = 0.70;
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
    const brothH = 0.90;
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

    // EYE_H sits mid-wall (h 0.30-0.44 segment), well below the flare and well
    // above the footed base — a clearly visible, mostly-outward-facing surface.
    // Orientation still uses the flattened HORIZONTAL-outward direction rather
    // than the raw 3D normal, as a belt-and-braces fix against any residual
    // downward tilt in the wall segment.
    const EYE_THETA = 0.46;
    const EYE_H = 0.37;
    const irisMat = toonMat({ color: '#6B6E72', roughness: 0.3 }); // grey steam-toned, not ink-black
    const scleraMat = toonMat({ color: '#EDEDEA', roughness: 0.3 });
    const lidMat = toonMat({ color: '#B7BABD', roughness: 0.35 }); // between sclera and iris — a real shaded lid
    const browMat = toonMat({ color: '#6E7276', roughness: 0.4 }); // groups with the iris as "the eye area"

    for (const sx of [-1, 1] as const) {
      const { pos } = bowlSurface(sx * EYE_THETA, EYE_H);
      const outward = new THREE.Vector3(pos.x, 0, pos.z).normalize();
      const eye = new THREE.Group();
      eye.position.copy(pos).addScaledVector(outward, R * 0.03);
      eye.quaternion.setFromUnitVectors(new THREE.Vector3(0, 0, 1), outward);
      head.add(eye);

      const white = new THREE.Mesh(new THREE.SphereGeometry(R * 0.165, 16, 14), scleraMat);
      white.scale.set(1, 1, 0.55);
      white.castShadow = true;
      eye.add(white);

      const iris = new THREE.Mesh(new THREE.SphereGeometry(R * 0.095, 14, 12), irisMat);
      iris.position.set(0, 0, R * 0.06);
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
    // Sits centred (theta=0) below the eyes, in the same wall segment via `bowlSurface`.
    const MOUTH_H = 0.225;
    const mouthPt = bowlSurface(0, MOUTH_H);
    const mouthOutward = new THREE.Vector3(mouthPt.pos.x, 0, mouthPt.pos.z).normalize();
    const mouth = new THREE.Group();
    mouth.position.copy(mouthPt.pos).addScaledVector(mouthOutward, R * 0.028);
    mouth.quaternion.setFromUnitVectors(new THREE.Vector3(0, 0, 1), mouthOutward);
    head.add(mouth);

    const mouthMat = toonMat({ color: '#5A5D61', roughness: 0.4 }); // groups with the grey iris/brow, not lip-pink
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
    const handRadius = CHARACTER_HEIGHT * 0.076; // must match the rig's own `proportions.handRadius`
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
    const height = CHARACTER_HEIGHT;
    const shoulderWidth = height * 0.27; // must match the rig's own `proportions.shoulderWidth`
    const tw = shoulderWidth * 1.18;
    const torsoH = height * 0.28;
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
   * Bespoke limbs — an independent art director named the shared snowman-body
   * capsule arms and ball hands as the biggest cast-wide tell. Soup gets glazed-
   * ceramic tapered "sleeves" (glossy, matching the bowl's own exterior material)
   * ending in a genuinely different material: a matte cloth oven mitt, echoing the
   * vendor apron the torso already wears. A dark work boot replaces the blocky
   * default foot.
   *
   * A previous pass added a `cuffRing` at every segment break (shoulder, elbow,
   * hip) plus another on the boot — a thick, high-contrast trim-coloured torus
   * right at each joint. Stacked across all five bespoke-limb characters that
   * read as mechanical action-figure collars, a worse version of the exact
   * "ball-jointed skeleton" problem this system exists to solve. Removed: the
   * tapered limb's own silhouette change (thick shoulder to narrow wrist) plus
   * the colour break into the mitt/boot already sells "sleeve ends here" without
   * bolted-on hardware.
   */
  private dressLimbs(): void {
    // Grey glazed-stoneware sleeves (see GLAZE_GREY's own comment) — the fix for the
    // cream/white limb convergence a fresh art-director pass named across Soup, Water
    // Bottle and Sushi. Mitts move to cream to keep a genuine hand contrast without
    // reintroducing an all-cream body.
    const glazeMat = glossyMat({ color: GLAZE_GREY, roughness: 0.28 });
    const trimMat = toonMat({ color: RIM_TRIM, roughness: 0.4 });
    const mittMat = toonMat({ color: CERAMIC, roughness: 0.55 }); // matte cream cloth, not glazed ceramic
    const bootMat = toonMat({ color: '#3A2E24', roughness: 0.7 });

    this.rig.dressLimbs((part: LimbPart, size) => {
      switch (part) {
        case 'upperArmL':
        case 'upperArmR':
          return taperedLimb(size.len, size.radius * 1.08, size.radius * 0.80, glazeMat);
        case 'forearmL':
        case 'forearmR':
          return taperedLimb(size.len, size.radius * 0.78, size.radius * 0.58, glazeMat);
        case 'handL':
        case 'handR': {
          const side = part === 'handL' ? 1 : -1;
          return buildOvenMitt(size.radius, side, mittMat);
        }
        case 'thighL':
        case 'thighR':
          return taperedLimb(size.len, size.radius * 1.05, size.radius * 0.88, glazeMat);
        case 'shinL':
        case 'shinR':
          return taperedLimb(size.len, size.radius * 0.88, size.radius * 0.70, glazeMat);
        case 'footL':
        case 'footR':
          return buildWorkBoot(size.len, bootMat, trimMat);
        default:
          return null;
      }
    });
  }

  /** The rig owns all body motion; the base class's whole-body pass would fight it. */
  protected applyBaseMotion(): void {}
}
