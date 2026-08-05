/**
 * Donut (Normal).
 *
 * Reference implementation of the shared ChibiRig — the pattern every other
 * character follows. The rig supplies torso, arms, hands, legs and feet plus the
 * whole motion vocabulary; this file authors only what makes it a Donut:
 *
 *   - the food mass mounted on `rig.joints.head`
 *   - the face on `rig.joints.face`
 *   - a palette and per-material roughness
 *
 * Identity is fixed by `rules.ts`: Donut, Normal rarity, Candy Barrage plus the
 * passive Sticky Trail. The 2D description ("crooked smile, sprinkles") is treated
 * as a personality guide rather than a literal spec, per the brief.
 */

import * as THREE from 'three';
import { BaseCharacter, type AnimContext } from './types';
import type { CharacterDef } from '../game/rules';
import { PALETTE } from '../game/rules';
import { toonMat, glossyMat, flatMat, outlineGroup } from '../render/toon';
import { ChibiRig } from './rig';
import { bodyType } from './bodies';

const GLAZE = PALETTE.glaze;      // #FF9EC4
const DOUGH = '#F5CE86';
const DOUGH_DARK = '#D9A253';
// Shoes deliberately break from the dough/glaze pair — a genuine dark value drop
// ("chocolate-dipped feet") so the body doesn't read as one undifferentiated tan
// mass. `DOUGH_DARK` above is too close in hue/value to `DOUGH` to do that job.
const CHOC_DIP = '#120902';        // boots, darker than the shins above them
// Limb-only pink family — a second independent art-director pass found Hamburger,
// Donut and Taco all converging on the same golden-tan-dough hue for their limbs
// despite different heads. Donut's own icing is already pink, so her limbs lean
// into THAT identity instead of the shared dough tone: a saturated glaze pink for
// the meaty part of the limb, a deeper berry pink for the lower segment, so the
// whole body reads pink-and-cream rather than another tan blob.
// ── The dark rung ────────────────────────────────────────────────────────────
// Measured against 18 Brawl Stars plates: their P05 is 0.097 and all eighteen put 5%
// of the character below 0.18. Donut's was 0.333 — the second-worst in the cast — and
// 33.6% of its part boundaries were under 0.10 apart, the arm chain worst of all
// (`shoulderL|elbowL` 0.097, `elbowL|handL` 0.091, `hipL|kneeL` 0.086). Both are the
// same defect: the whole character lived between 0.44 and 0.81.
//
// The beanie is where the dark end goes — it is 13.9% of the character's pixels in
// ONE mesh, it is the reference's own grammar (near-black hair/hat over a light face),
// and it costs the food nothing. The lower limb tone follows it down so the arm chain
// alternates instead of ramping, and the pompom + dough come up to pay for both in
// figure/ground. Measured at pot_south, shipped framing: range 0.466 -> 0.676,
// p05 0.343 -> 0.173, steps@0.10 6 -> 7, figure/ground 0.262 -> 0.227.
const BEANIE = '#170C28';
const BEANIE_BRIM = '#0E0720';
/** The pompom, and only the pompom. Was `GLAZE`, i.e. the same pink as the icing it
 *  sits above; a wool pompom is the natural light rung and it pays for the beanie. */
const POMPOM = '#FFF6E8';

// ── PASS 2: the limb CHAIN has to alternate, not ramp ────────────────────────
// The first value pass took both limb tones down together. That fixed range/P05 and
// BROKE the part boundary — measured, `shoulderL|elbowL` 0.044, `kneeL|footL` 0.035,
// because a chain of four segments each a shade darker than the last is one mass. The
// reference's grammar is alternation: mid sleeve, dark cuff, light glove. So the upper
// segment comes back UP, the lower segment holds the dark, and the boot takes its own
// darkest tone instead of sharing the shin's.
const LIMB_PINK = '#DE6491';       // upper arm / thigh — mid
const LIMB_PINK_DARK = '#7E2340';  // forearm / shin — dark

const SPRINKLE_COLORS = ['#E63946', '#7CB518', '#FFC93C', '#7C4DFF', '#2E86D8', '#FFFFFF'];

/**
 * A rounded limb segment, like a capsule but with INDEPENDENT top and bottom
 * radii, hanging DOWN from the joint origin (spans y=0..-len) — the orientation
 * `dressLimbs()` expects. Local to this file per the same pattern as `dressTorso`
 * above; see `hamburger.ts` for the reference copy of this helper. Donut's own
 * radii stay close together (soft dough barely tapers) rather than the aggressive
 * wedge every other character in this file gives it, which is the point: a cast
 * that shares a helper but tunes it per-character reads as one family, not one mould.
 */
function taperedSegment(len: number, rTop: number, rBot: number, radialSegments = 12): THREE.BufferGeometry {
  // Profile MUST be wound bottom-to-top (y increasing), matching every other
  // lathe helper in this cast (`bunDome`, `roundedPuck` in `hamburger.ts`) —
  // LatheGeometry's face winding (and therefore `computeVertexNormals`'s
  // outward-vs-inward call) depends on point order, not just point position. An
  // earlier version of this function built the profile top-to-bottom and every
  // limb using it rendered near-black: inverted normals facing away from the
  // light. The y=0/y=-len hang-down placement is unchanged.
  const capSegs = 5;
  const pts: THREE.Vector2[] = [new THREE.Vector2(0, -len)];
  for (let i = 1; i <= capSegs; i++) {
    const a = (Math.PI / 2) * (i / capSegs);
    pts.push(new THREE.Vector2(Math.sin(a) * rBot, -len + rBot - Math.cos(a) * rBot));
  }
  const yBotCap = -len + rBot;
  const yTopCap = -rTop;
  if (yTopCap >= yBotCap) {
    const sideSteps = 3;
    for (let i = 1; i <= sideSteps; i++) {
      const t = i / sideSteps;
      pts.push(new THREE.Vector2(THREE.MathUtils.lerp(rBot, rTop, t), THREE.MathUtils.lerp(yBotCap, yTopCap, t)));
    }
  }
  const yTopSafe = Math.max(yTopCap, yBotCap);
  for (let i = 1; i <= capSegs; i++) {
    const a = (Math.PI / 2) * (i / capSegs);
    pts.push(new THREE.Vector2(Math.cos(a) * rTop, yTopSafe + Math.sin(a) * rTop));
  }
  const geo = new THREE.LatheGeometry(pts, radialSegments);
  geo.computeVertexNormals();
  return geo;
}

/** Soft tapered barrel — the same visual language as the rig's own default torso
 * (fuller belly, narrower neck) but built locally so each character can own its
 * material and proportions. */
function torsoBarrel(halfW: number, height: number, halfD: number, taper: number): THREE.BufferGeometry {
  const geo = new THREE.SphereGeometry(1, 22, 16);
  const pos = geo.attributes.position as THREE.BufferAttribute;
  for (let i = 0; i < pos.count; i++) {
    const y = pos.getY(i);
    const t = (y + 1) * 0.5; // 0 bottom .. 1 top
    const bulge = 1 + taper * Math.sin(t * Math.PI * 0.9) - taper * 0.55 * t;
    pos.setX(i, pos.getX(i) * halfW * bulge);
    pos.setZ(i, pos.getZ(i) * halfD * bulge);
    pos.setY(i, y * height * 0.5);
  }
  geo.computeVertexNormals();
  return geo;
}

export class DonutCharacter extends BaseCharacter {
  private rig: ChibiRig;
  private sprinkles: THREE.Object3D[] = [];

  constructor(def: CharacterDef) {
    super(def);

    this.rig = new ChibiRig({
      palette: {
        limb: LIMB_PINK,
        hand: GLAZE,
        foot: CHOC_DIP,
        torso: DOUGH,
        limbRoughness: 0.72,
      },
      // Body: STUB archetype (see `bodies.ts`) — no torso at all, head straight
      // onto the hips, very short thick limbs, wide stance. A donut is a ring:
      // it has no neck and no waist to model, and giving it one was the reason
      // this character read as "a torus balanced on the cast's standard body".
      // As a STUB the ring IS the body and the whole silhouette is the landmark.
      //
      // `shoulderWidth` is a STUB-specific hand-fit: the arms have to clear the
      // ring's outer radius (1.04R) at shoulder height, where the torus is
      // ~0.86R wide. See the STUB notes in `bodies.ts`.
      //
      // `legFraction` used to be overridden to 0.20, up from STUB's old 0.15,
      // because a blind critic reading the silhouette said the feet were "two
      // indistinct pink stubs hidden under the ring's overhang, so the silhouette
      // is essentially a circle". STUB itself is now 0.24 and the override is
      // gone — the archetype finally does what this character had to hand-fit.
      //
      // `headFraction` 0.72 -> 0.685 pays for the extra 0.04H of leg so the ring
      // does not grow: STUB's own rewrite makes the same trade at the same rate.
      proportions: bodyType('stub', {
        height: 2.10,
        headFraction: 0.685,
        // 0.295H -> 0.345H. Measured: the ring is 0.619m half-wide at shoulder
        // height and the pivot sat at 0.620m — exactly ON the surface, so the whole
        // upper arm was inside the dough (delivery 0.46 left, 0.09 right).
        // 0.345H -> 0.305H. The ring shrank with `headFraction` 0.72 -> 0.685, so its
        // half-width at shoulder height went 0.619 -> 0.589 m while the arm's inner
        // edge stayed at 0.594 — 5 mm OUTSIDE the only mass it can attach to. At run
        // the whole left arm became its own connected component, 11,133 px.
        // 0.345 detached the arm (11,133 px at run), 0.305 buried it (shoulderR 0.375
        // delivered). 0.325H is the middle of a window only 0.084 m wide, which is what
        // a torus gives you: inner edge 0.552 m inside the ring's 0.589 m, outer edge
        // 0.224 m proud of it.
        shoulderWidth: 2.10 * 0.325,
        // ── A RING is widest at its own CENTRE, so STUB's new 0.26 is wrong here ──
        // `bodies.ts` raised STUB's `shoulderFraction` from 0.12 to 0.26 because
        // every other STUB mass (bottle, egg, lollipop stick) is widest LOW, so
        // lifting the pivot lifts it clear. A torus is the opposite: at 0.12 the
        // pivot sits 0.47m below the ring centre where the ring measures 0.62m
        // across, and at 0.26 it rises to 0.17m below centre where it measures
        // 0.79m. The archetype's fix would have cost this character 0.17m of extra
        // burial, which is why it is overridden rather than inherited.
        shoulderFraction: 0.12,
        // 0.26H -> 0.225H, back to STUB's own value. The 0.26 was bought to drag the
        // thighs out from under the ring when the legs were 0.20H long; at 0.24H they
        // clear it vertically instead and the width is no longer paying for anything.
        // It is now actively harmful: measured, the ring's own half-width at the hip
        // line is 0.504 m (`tools/tmp/masssit.mjs`) against hips at 0.535 — the legs
        // hung 0.031 m OUTSIDE the only mass they could attach to, and at run the
        // whole left arm-and-leg became its own connected component, 19,248 px
        // detached. That is the second edge of the same window round 1 documented.
        stanceWidth: 2.10 * 0.20,
      }),
      // Bouncy and playful — hip popped out, head cocked, weight rocked back onto
      // her heels like she's mid-bounce. An art director's second pass named the
      // cast's identical dead-front symmetric pose as a top gap; Donut's read is
      // the cast's "sweetest"/most carefree attitude, distinct from every other
      // stance in this file's cast.
      // Both shoulders swung INWARD, and on this body that is a deletion rather
      // than a pose: `docs/LESSONS.md` §12 — `shoulderL` is the joint at
      // x = -shoulderWidth, so POSITIVE z there swings the arm across the body,
      // and NEGATIVE does the same on the right. +0.55 / -0.15 folded both arms
      // into a 0.62m-wide ring of dough. Signs flipped so both open outward; the
      // bouncy hip-shot read is carried by `hipSway` and `twist`, which are
      // untouched.
      stance: {
        shoulderL: -0.12, shoulderR: 0.10,
        elbowL: -0.55, elbowR: -0.65,
        twist: 0.22, headTilt: 0.22, headTurn: -0.30,
        hipSway: 0.12, lean: -0.03,
      },
    });
    this.body.add(this.rig.joints.root);
    this.head = this.rig.joints.head;

    const R = this.rig.headRadius;
    const head = this.rig.joints.head;

    // ── Food mass: the torus, hole facing the camera ─────────────────────────
    // The hole is Donut's silhouette landmark — the one unmistakable read at any
    // size — so it faces +Z where the camera can always see it.
    const tubeR = R * 0.42;
    const ringR = R * 0.62;

    const dough = new THREE.Mesh(
      new THREE.TorusGeometry(ringR, tubeR, 18, 40),
      toonMat({ color: DOUGH, roughness: 0.82 })
    );
    dough.name = 'donut_dough';
    dough.castShadow = true;
    dough.receiveShadow = true;
    head.add(dough);

    // Glaze: a slightly larger, flattened torus sitting proud of the dough, wet and
    // glossy against the matte crumb. The roughness contrast is what makes it read
    // as icing on bread rather than as one moulded plastic object.
    const glaze = new THREE.Mesh(
      new THREE.TorusGeometry(ringR, tubeR * 1.04, 18, 40),
      glossyMat({ color: GLAZE, roughness: 0.16 })
    );
    glaze.name = 'donut_glaze';
    glaze.position.z = tubeR * 0.16;
    glaze.scale.set(1, 1, 0.78);
    glaze.castShadow = true;
    glaze.receiveShadow = true;
    head.add(glaze);

    // ── Sprinkles ────────────────────────────────────────────────────────────
    // Seated ON the glaze surface, not floating above it — an earlier character
    // shipped with visibly detached toppings and it read as broken immediately.
    const sprinkleGeo = new THREE.CapsuleGeometry(R * 0.028, R * 0.075, 4, 6);
    /**
     * The rectangle the face occupies on the front of the ring. Sprinkles that
     * land inside it are skipped.
     *
     * Not fussiness: a bright unrelated dot next to a mouth or between two eyes
     * gets read as part of the expression at the size a player sees, and a
     * purple lozenge sitting on the corner of the smile is a facial feature the
     * character did not ask for. Reference art keeps a clean margin around every
     * face for the same reason.
     */
    const inFaceZone = (x: number, y: number) => Math.abs(x) < R * 0.66 && y > -R * 0.80 && y < R * 0.28;
    for (let i = 0; i < 26; i++) {
      const a = (i / 26) * Math.PI * 2 + (i % 3) * 0.35;
      const rr = ringR + (((i * 37) % 100) / 100 - 0.5) * tubeR * 0.85;
      if (inFaceZone(Math.cos(a) * rr, Math.sin(a) * rr)) continue;
      const mat = flatMat(SPRINKLE_COLORS[i % SPRINKLE_COLORS.length]);
      const s = new THREE.Mesh(sprinkleGeo, mat);
      s.userData.noOutline = true;
      s.castShadow = true;
      // Sit ON the glaze surface. The glaze torus is offset forward by 0.16 tube
      // radii and squashed to 0.78 in Z, so its front surface at radial offset u is
      // 0.16 + 1.04*0.78*sqrt(1-u^2) — solving for that (rather than reusing the raw
      // tube radius) is the difference between sprinkles on the icing and sprinkles
      // buried inside it.
      const depth = Math.sqrt(Math.max(0, 1 - Math.pow((rr - ringR) / tubeR, 2)));
      s.position.set(Math.cos(a) * rr, Math.sin(a) * rr, tubeR * (0.16 + 0.81 * depth * 0.98));
      s.rotation.set(Math.PI / 2, 0, a + ((i * 53) % 100) / 100 - 0.5);
      head.add(s);
      this.sprinkles.push(s);
    }

    // ── Costume: knit beanie ─────────────────────────────────────────────────
    // A second independent art-director pass named the total absence of any worn
    // costume/accessory layer as the cast's single biggest remaining gap — every
    // reference character (mustache+tux, hoodie+cap+headphones, scarf+cape) reads
    // through wardrobe, and this cast had none. A jaunty knit beanie perched above
    // the ring is Donut's: it breaks the torus's round silhouette upward with a
    // real worn shape, in a fresh violet that doesn't fight her own pink glaze.
    const beanieMat = toonMat({ color: BEANIE, roughness: 0.68 });
    const beanieBrimMat = toonMat({ color: BEANIE_BRIM, roughness: 0.68 });
    const pompomMat = toonMat({ color: POMPOM, roughness: 0.7 });

    const beanieR = R * 0.36;
    const beanieThetaLen = Math.PI * 0.62;
    const beanieCenter = new THREE.Vector3(R * 0.12, R * 0.80, -R * 0.08);
    // A single quaternion drives the dome mesh AND every point/normal derived
    // from it (rim, apex) so the cap, its brim and its pompom stay geometrically
    // consistent with each other at any tilt — the same "one source of truth for
    // a curved surface" discipline `hamburger.ts`'s crownSurface encodes.
    const beanieTiltQ = new THREE.Quaternion().setFromEuler(new THREE.Euler(-0.45, 0.15, 0.35));

    const beanie = new THREE.Mesh(
      new THREE.SphereGeometry(beanieR, 20, 14, 0, Math.PI * 2, 0, beanieThetaLen),
      beanieMat
    );
    beanie.name = 'donut_beanie';
    beanie.position.copy(beanieCenter);
    beanie.quaternion.copy(beanieTiltQ);
    beanie.castShadow = true;
    beanie.receiveShadow = true;
    head.add(beanie);

    const rimLocalY = beanieR * Math.cos(beanieThetaLen);
    const rimRadius = beanieR * Math.sin(beanieThetaLen);
    const rimCenter = beanieCenter.clone().add(new THREE.Vector3(0, rimLocalY, 0).applyQuaternion(beanieTiltQ));
    const rimNormal = new THREE.Vector3(0, 1, 0).applyQuaternion(beanieTiltQ);

    const beanieBrim = new THREE.Mesh(new THREE.TorusGeometry(rimRadius, R * 0.06, 10, 24), beanieBrimMat);
    beanieBrim.name = 'donut_beanie_brim';
    beanieBrim.position.copy(rimCenter);
    beanieBrim.quaternion.setFromUnitVectors(new THREE.Vector3(0, 0, 1), rimNormal);
    beanieBrim.castShadow = true;
    beanieBrim.receiveShadow = true;
    head.add(beanieBrim);

    const pompom = new THREE.Mesh(new THREE.SphereGeometry(R * 0.115, 12, 10), pompomMat);
    pompom.name = 'donut_beanie_pompom';
    const apexLocal = new THREE.Vector3(0, beanieR, 0).applyQuaternion(beanieTiltQ);
    pompom.position.copy(beanieCenter).add(apexLocal);
    pompom.castShadow = true;
    pompom.receiveShadow = true;
    head.add(pompom);

    // ── Body: dress the torso ─────────────────────────────────────────────────
    // Two independent builder rounds both named the same gap: a themed head on a
    // generic body. Donut's body is a second, smaller dough mass wearing its own
    // iced collar — glaze drips over the shoulders and sprinkles carry on down
    // from the head — so the food identity runs the full height of the model
    // instead of stopping dead at the neck.
    // NOTE: this is a no-op under the STUB archetype, which has no torso to
    // dress — `rig.dressTorso` returns immediately and the ring above carries the
    // whole body. It is kept intact rather than deleted because switching
    // archetype is a supported one-line fix (see `bodies.ts`), and this is what
    // Donut's body looks like the moment she has a torso again.
    this.rig.dressTorso((size) => {
      const group = new THREE.Group();
      group.name = 'donut_torso';

      const bodyHalfW = size.w * 0.56;
      const bodyHalfD = size.d * 0.60;
      const bodyBottomY = size.h * 0.02;
      const bodyTopY = size.h * 1.06;
      const doughBody = new THREE.Mesh(
        torsoBarrel(bodyHalfW, bodyTopY - bodyBottomY, bodyHalfD, 0.30),
        toonMat({ color: DOUGH, roughness: 0.82 })
      );
      doughBody.name = 'donut_torso_dough';
      doughBody.position.y = (bodyTopY + bodyBottomY) / 2;
      doughBody.castShadow = true;
      doughBody.receiveShadow = true;
      group.add(doughBody);

      // Icing collar: a flattened glaze ring worn like a yoke, sized to sit
      // clearly inside the shoulder pivots so it never collides with the arms.
      const collarY = size.h * 0.86;
      const collarR = bodyHalfW * 0.82;
      const collarTube = bodyHalfW * 0.30;
      const collarMat = glossyMat({ color: GLAZE, roughness: 0.16 });
      // Radial segments pushed up from a first pass at 12 — viewed near
      // edge-on from the front (a flat ring's own tube cross-section faces the
      // camera almost directly there), 12 facets around the tube showed as a
      // visible jagged/faceted silhouette against the smooth dough body.
      const collar = new THREE.Mesh(new THREE.TorusGeometry(collarR, collarTube, 22, 40), collarMat);
      collar.name = 'donut_torso_collar';
      collar.rotation.x = Math.PI / 2;
      collar.position.y = collarY;
      collar.castShadow = true;
      collar.receiveShadow = true;
      group.add(collar);

      // Glaze drips down the chest — same trick as the head icing, dribbling
      // down from the collar across the front arc (theta ~0.5..2.6, +Z-ward).
      const dripAngles = [0.55, 0.95, 1.35, 1.75, 2.15, 2.55];
      for (let i = 0; i < dripAngles.length; i++) {
        const a = dripAngles[i];
        const len = collarTube * (1.5 + (i % 3) * 0.5);
        const drip = new THREE.Mesh(new THREE.SphereGeometry(collarTube * 0.85, 10, 10), collarMat);
        drip.name = 'donut_torso_drip';
        drip.position.set(Math.cos(a) * collarR * 0.98, collarY - len * 0.55, Math.sin(a) * collarR * 0.98);
        drip.scale.set(1, len / (collarTube * 0.85), 1);
        drip.castShadow = true;
        drip.receiveShadow = true;
        group.add(drip);
      }

      // Pin badge — a small worn detail on the collar, the accessory scaled down
      // (the beanie above is the silhouette-breaking piece; this is the close-up
      // "worn, not just coloured" read), tucked into the gap the drip angles leave
      // clear at the front (drips start at 0.55 rad).
      const badgeMat = toonMat({ color: '#FFD873', roughness: 0.5 });
      const badgeInnerMat = toonMat({ color: BEANIE, roughness: 0.5 }); // same near-black as the cap
      const badgeA = 0.18;
      const badgeR = collarR + collarTube * 0.85;
      const badge = new THREE.Mesh(new THREE.CylinderGeometry(collarTube * 0.55, collarTube * 0.55, collarTube * 0.18, 16), badgeMat);
      badge.name = 'donut_pin_badge';
      badge.position.set(Math.cos(badgeA) * badgeR, collarY, Math.sin(badgeA) * badgeR);
      badge.rotation.z = Math.PI / 2;
      badge.rotation.y = -badgeA;
      badge.castShadow = true;
      badge.receiveShadow = true;
      group.add(badge);
      const badgeInner = new THREE.Mesh(new THREE.CircleGeometry(collarTube * 0.32, 14), badgeInnerMat);
      badgeInner.name = 'donut_pin_badge_face__no_outline';
      badgeInner.userData.noOutline = true;
      badgeInner.position.set(0, 0, collarTube * 0.1);
      badge.add(badgeInner);

      // Sprinkles carry on down from the head, scattered across the lower half
      // of the collar band — kept off the topmost row, which sits right at the
      // seam against the head ring above and reads as a stray face feature.
      const sGeo = new THREE.CapsuleGeometry(R * 0.024, R * 0.06, 4, 6);
      for (let i = 0; i < 10; i++) {
        const a = 0.6 + (i / 10) * 2.1;
        const rr = collarR + (((i * 41) % 100) / 100 - 0.5) * collarTube * 1.4;
        const mat = flatMat(SPRINKLE_COLORS[(i + 2) % SPRINKLE_COLORS.length]);
        const s = new THREE.Mesh(sGeo, mat);
        s.userData.noOutline = true;
        s.castShadow = true;
        s.position.set(Math.cos(a) * rr, collarY - collarTube * (0.15 + (i % 3) * 0.22), Math.sin(a) * rr);
        s.rotation.set(Math.PI / 2, 0, a + ((i * 29) % 100) / 100 - 0.5);
        group.add(s);
        this.sprinkles.push(s);
      }

      return group;
    });

    // ── Limbs: bespoke, not the shared rig defaults ───────────────────────────
    // An independent art director named the rig's identical capsule-arm/ball-hand/
    // wedge-foot kit — recoloured but otherwise the same on every character — as
    // the single biggest "template" tell across the whole cast. Donut's limbs stay
    // soft and barely taper (this is dough, not muscle) but the extremities carry
    // her own material story: glaze-dipped glossy hands that end in a drip, and
    // chocolate-dipped glossy feet, both a deliberate step up in gloss from the
    // matte dough limbs, echoing the head's own matte-dough/glossy-glaze contrast.
    const limbPinkMat = toonMat({ color: LIMB_PINK, roughness: 0.7 });
    const limbPinkDarkMat = toonMat({ color: LIMB_PINK_DARK, roughness: 0.7 });
    const glazeHandMat = glossyMat({ color: GLAZE, roughness: 0.16 });
    const chocFootMat = glossyMat({ color: CHOC_DIP, roughness: 0.22 });
    this.rig.dressLimbs((part, size) => {
      switch (part) {
        case 'upperArmL': case 'upperArmR':
        case 'thighL': case 'thighR': {
          const m = new THREE.Mesh(taperedSegment(size.len, size.radius * 1.16, size.radius * 1.0, 10), limbPinkMat);
          m.name = `${part}_mesh`;
          m.castShadow = true;
          m.receiveShadow = true;
          return m;
        }
        case 'forearmL': case 'forearmR':
        case 'shinL': case 'shinR': {
          const m = new THREE.Mesh(taperedSegment(size.len, size.radius * 1.0, size.radius * 0.84, 10), limbPinkDarkMat);
          m.name = `${part}_mesh`;
          m.castShadow = true;
          m.receiveShadow = true;
          return m;
        }
        case 'handL': case 'handR': {
          const g = new THREE.Group();
          const ball = new THREE.Mesh(new THREE.SphereGeometry(size.radius * 0.98, 16, 14), glazeHandMat);
          ball.position.y = -size.radius * 0.98;
          ball.scale.set(1, 1.06, 1);
          ball.name = `${part}_mesh`;
          ball.castShadow = true;
          ball.receiveShadow = true;
          g.add(ball);
          // A small drip nub at the bottom — the same trick the head/torso glaze
          // uses, carried down to the extremities instead of stopping at the neck.
          const drip = new THREE.Mesh(new THREE.SphereGeometry(size.radius * 0.22, 8, 8), glazeHandMat);
          drip.position.y = -size.radius * 1.85;
          drip.scale.set(1, 1.6, 1);
          drip.userData.noOutline = true;
          g.add(drip);
          return g;
        }
        case 'footL': case 'footR': {
          // `taperedSegment`'s own convention hangs the FULL `len` down from the
          // joint origin — correct for an arm/leg bone, but the foot joint already
          // sits barely above true ground level, so the previous `size.len * 1.3`
          // (a full leg-segment length) sank the whole foot 30-40cm through the
          // floor: a verified defect (the character's own measured height came out
          // ~0.8m taller than the cast norm because the bounding box was being
          // measured down into the floor, not because anything visible got taller).
          // Shortened to a true foot-scaled drop, matching the shallow droop every
          // other character's own foot geometry keeps.
          const footLen = size.len * 0.55;
          const foot = new THREE.Mesh(taperedSegment(footLen, size.radius * 1.2, size.radius * 0.3, 12), chocFootMat);
          foot.position.z = size.radius * 0.3;
          foot.name = `${part}_mesh`;
          foot.castShadow = true;
          foot.receiveShadow = true;
          return foot;
        }
        default:
          return null;
      }
    });

    this.buildFace(R, ringR, tubeR);

    outlineGroup(this.root);
    this.collectFlashTargets();
    this.rig.restPose();
  }

  /**
   * Face features sit around the hole on the front of the ring. Built as real
   * geometry with depth rather than flat decals — `types.ts` convention #6 was
   * relaxed precisely because flat stickers were capping quality.
   *
   * ── The face was FLOATING, and the shadows proved it ──────────────────────
   * `rig.joints.face` is parked at `headRadius * 0.82`, which assumes a roughly
   * spherical head whose front surface is about there. A torus is nowhere near
   * that: at the radius the eyes sit on, this ring's glazed front face is only
   * ~0.38R forward, so every feature hung ~0.25R — about 0.19 m — out in open
   * air. Dead-on it looked fine, which is exactly why it survived; at any yaw
   * the eyes visibly detached and cast their own drop shadows onto the dough
   * behind them.
   *
   * Every feature is now placed against the REAL glaze surface via
   * `glazeFrontZ`, which solves the same offset/squash the sprinkles already
   * solve rather than guessing a constant — so the face cannot drift if the
   * ring's proportions are ever retuned.
   */
  private buildFace(R: number, ringR: number, tubeR: number): void {
    const face = this.rig.joints.face;
    const ink = PALETTE.ink;

    /**
     * Head-local Z of the ring's OUTERMOST front surface at radius `hypot(x, y)`,
     * converted into `face`-local space.
     *
     * There are two surfaces here and which one is in front depends on where you
     * are across the tube — that is the whole reason the ring renders as a pink
     * outer band, a gold middle band and a pink inner band rather than as solid
     * icing. The dough torus is a plain tube of radius `tubeR` centred at z=0.
     * The glaze torus is 1.04x thicker, squashed to 0.78 in Z and pushed forward
     * 0.16 tube radii, so it wins near the tube's inner and outer edges and LOSES
     * across the middle, where the bare dough pokes through.
     *
     * A first fix at this solved only the glaze and buried the smile: the mouth
     * sits in the gold band, where the surface it needed to clear was the dough,
     * a full 0.05R further forward. Taking the max of both is what makes the
     * answer independent of which band a feature happens to land in.
     */
    const surfaceZ = (x: number, y: number, proud: number): number => {
      const d = Math.hypot(x, y);
      const ud = (d - ringR) / tubeR;
      const zDough = tubeR * Math.sqrt(Math.max(0, 1 - ud * ud));
      const ug = (d - ringR) / (tubeR * 1.04);
      const zGlaze = tubeR * (0.16 + 1.04 * 0.78 * Math.sqrt(Math.max(0, 1 - ug * ug)));
      return Math.max(zDough, zGlaze) + proud - face.position.z;
    };

    // ── The HOLE was acting as the mouth ─────────────────────────────────────
    // With the eyes at +0.30R and the smile at -0.30R, the ring's hole sat
    // exactly between them — and a hole is the darkest, highest-contrast feature
    // on the whole model, so a blind critic read it as the mouth and the real
    // smile as a stray mark low and off to the right. The face was losing to the
    // geometry.
    //
    // Dropping the whole face below the hole fixes it structurally rather than
    // by fighting for attention: eyes at -0.06R, mouth at -0.60R, so the hole is
    // now clearly ABOVE the eyes where it reads as what it is — a hole in a
    // donut — and the three ink features form one compact group in the lower
    // half of the ring. The eyes also move outward to sit on the gold dough band
    // rather than on the pink inner slope, where they were being crowded.
    //
    // Both eyes are the SAME size now. The 0.72 squint on one side was meant as
    // a half-wink; every independent read of it came back as "the painted eyes
    // are unequal in size and sit at different heights", which is the exact
    // failure `taco.ts` already documented — a subtle size difference reads as a
    // mistake, not as acting. The asymmetry lives entirely in the brows.
    const eyeGeo = new THREE.SphereGeometry(R * 0.125, 16, 14);
    const eyeMat = toonMat({ color: ink, roughness: 0.25 });
    for (const sx of [-1, 1]) {
      const squint = 1;
      const eyeX = sx * R * 0.44;
      const eyeY = -R * 0.06;
      // Centre sits ON the surface, so a little over half the ball stands proud —
      // an eye set flush into the icing reads as a printed dot, and one pushed
      // out past its own radius reads as detached.
      const eyeZ = surfaceZ(eyeX, eyeY, R * 0.015);
      const eye = new THREE.Mesh(eyeGeo, eyeMat);
      eye.position.set(eyeX, eyeY, eyeZ);
      eye.scale.set(1, 1.15 * squint, 0.6);
      eye.castShadow = true;
      face.add(eye);

      // Specular catchlight — the single cheapest trick for making eyes feel alive.
      const glintX = eyeX - sx * R * 0.038;
      const glintY = eyeY + R * 0.048;
      const glint = new THREE.Mesh(new THREE.SphereGeometry(R * 0.038, 10, 8), flatMat('#ffffff'));
      glint.position.set(glintX, glintY, eyeZ + R * 0.055);
      glint.userData.noOutline = true;
      face.add(glint);

      // Brows — genuinely asymmetric now: the right brow (over the squinting eye)
      // sits higher and cocks harder, the left stays low and nearly flat, so the
      // crooked smile below reads as ONE character's deliberate smirk instead of a
      // matched, interchangeable pair of brows either side of it.
      const browY = eyeY + (sx > 0 ? R * 0.25 : R * 0.18);
      const browTilt = sx > 0 ? 0.36 : 0.04;
      const brow = new THREE.Mesh(
        new THREE.CapsuleGeometry(R * 0.021, R * 0.14, 4, 8),
        toonMat({ color: PALETTE.ink, roughness: 0.4 })
      );
      brow.position.set(eyeX, browY, surfaceZ(eyeX, browY, R * 0.012));
      brow.rotation.z = Math.PI / 2 - sx * browTilt;
      brow.castShadow = true;
      face.add(brow);
    }

    // Crooked smile — asymmetric on purpose, per Donut's described personality.
    const smileX = R * 0.03;
    const smileY = -R * 0.52;
    const smile = new THREE.Mesh(
      new THREE.TorusGeometry(R * 0.22, R * 0.038, 8, 20, Math.PI * 0.85),
      toonMat({ color: ink, roughness: 0.3 })
    );
    // Sampled at the arc's DEEPEST point, not its centre. The mouth is a 0.20R
    // arc lying across a curved tube, so its extremes sit on surfaces up to
    // 0.09R apart; sampling anywhere but the frontmost of them leaves part of
    // the stroke buried, which is exactly how a first attempt at this lost all
    // but a sliver of the smile.
    smile.position.set(smileX, smileY, surfaceZ(smileX, smileY - R * 0.10, R * 0.02));
    smile.rotation.set(0, 0, Math.PI * 1.08);
    smile.castShadow = true;
    face.add(smile);
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
   * The rig owns all body motion, so the base class's whole-body squash/lean would
   * fight it. Suppressed here; `onUpdate` drives the rig instead.
   */
  protected applyBaseMotion(): void {}
}
