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
import { toonMat, glossyMat, flatMat, outlineGroup } from '../render/toon';
import { ChibiRig } from './rig';
import { CHARACTER_HEIGHT } from '../units';

const RICE = '#FFFDF6';        // warm-white sticky rice, not clinical pure white
const RICE_SHADE = '#F2ECDD';  // grain shading, a touch deeper
const NORI = PALETTE.nori;     // #2B2B2B — near-black, the high-contrast landmark
const SALMON = PALETTE.salmon; // #F4A261
const SALMON_DARK = '#D97F45'; // fish striation lines
const LIP = '#E8798F';         // puckered-lip coral
const GOLD = RARITY_COLORS.Legendary; // #F4A300 — rarity accent, used sparingly

export class SushiCharacter extends BaseCharacter {
  private rig: ChibiRig;
  private riceGrains: THREE.Object3D[] = [];

  constructor(def: CharacterDef) {
    super(def);

    this.rig = new ChibiRig({
      palette: {
        limb: RICE,
        hand: SALMON,   // contrasting fish-orange mitts against the white rice limbs
        foot: NORI,     // dark nori boots — the reference bar's contrasting dark footwear
        torso: RICE,
        limbRoughness: 0.65, // matte sticky rice
      },
      proportions: { headFraction: 0.46 },
    });
    this.body.add(this.rig.joints.root);
    this.head = this.rig.joints.head;

    const R = this.rig.headRadius;
    const head = this.rig.joints.head;

    // ── Materials ────────────────────────────────────────────────────────────
    const riceMat = toonMat({ color: RICE, roughness: 0.65 });        // matte sticky rice
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
    const PROFILE: Array<[h: number, r: number]> = [
      [0.00, 0.00], [0.02, 0.66], [0.08, 0.92], [0.14, 1.00],
      [0.40, 1.00], [0.63, 0.80], // ← SEAM_H
      [0.75, 0.94], [0.90, 0.68], [1.00, 0.00],
    ];
    const SEAM_H = 0.63;
    const SEAM_IDX = PROFILE.findIndex(([h]) => h === SEAM_H);
    const SCALE_R = R * 0.58;
    const SCALE_H = R * 1.65;

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
    /** Actual local radius (metres) at a height fraction. */
    const rAt = (hFrac: number): number => radiusFracAt(hFrac) * SCALE_R;
    /** Exact front-surface Z for a given local X at a height fraction (this is a
     * lathe, so any horizontal slice is a perfect circle of radius rAt(hFrac)). */
    const zAt = (x: number, hFrac: number): number => Math.sqrt(Math.max(0, rAt(hFrac) ** 2 - x * x));

    const latheGeo = (points: Array<[number, number]>) =>
      new THREE.LatheGeometry(points.map(([h, r]) => new THREE.Vector2(r * SCALE_R, yAt(h))), 32);

    const rice = new THREE.Mesh(latheGeo(PROFILE.slice(0, SEAM_IDX + 1)), riceMat);
    rice.name = 'sushi_rice';
    rice.castShadow = true;
    rice.receiveShadow = true;
    head.add(rice);

    const salmon = new THREE.Mesh(latheGeo(PROFILE.slice(SEAM_IDX)), salmonMat);
    salmon.name = 'sushi_salmon';
    salmon.castShadow = true;
    salmon.receiveShadow = true;
    head.add(salmon);

    // ── Nori band ────────────────────────────────────────────────────────────
    // Wrapped around the rice's constant-radius wall (h 0.14–0.40, where PROFILE
    // holds flat at r=1.00) — a slightly larger cylinder (1.03x) is therefore
    // guaranteed proud of the rice everywhere along the band. This near-black band
    // against warm-white rice is THE landmark.
    const noriTop = yAt(0.40);
    const noriBottom = yAt(0.14);
    const noriRadius = SCALE_R * 1.03;
    const nori = new THREE.Mesh(
      new THREE.CylinderGeometry(noriRadius, noriRadius, noriTop - noriBottom, 32, 1, true),
      noriMat
    );
    nori.name = 'sushi_nori_band';
    nori.position.y = (noriTop + noriBottom) / 2;
    nori.castShadow = true;
    nori.receiveShadow = true;
    head.add(nori);
    for (const y of [noriTop, noriBottom]) {
      const cap = new THREE.Mesh(new THREE.CircleGeometry(noriRadius, 32), noriMat);
      cap.name = 'sushi_nori_cap__no_outline';
      cap.userData.noOutline = true;
      cap.rotation.x = -Math.PI / 2;
      cap.position.y = y;
      head.add(cap);
    }

    // Small gold clasp on the band — a quiet Legendary-rarity accent, echoed on the
    // torso belt below so the two read as one costume detail.
    const clasp = new THREE.Mesh(
      new THREE.CylinderGeometry(R * 0.075, R * 0.075, R * 0.03, 16),
      toonMat({ color: GOLD, roughness: 0.3, metalness: 0.35 })
    );
    clasp.name = 'sushi_clasp';
    clasp.rotation.x = Math.PI / 2;
    clasp.position.set(0, (noriTop + noriBottom) / 2, noriRadius + R * 0.01);
    clasp.castShadow = true;
    head.add(clasp);

    // Fish striations — short, flush stripes on the salmon's own surface (built from
    // the same zAt() surface equation, embedded a hair proud rather than sticking out
    // radially — round 1's radial capsules read as hair spikes and are exactly the
    // mistake this avoids).
    const stripeHs: Array<[number, number]> = [[-0.28, 0.68], [0.05, 0.72], [0.32, 0.69], [-0.05, 0.82]];
    for (const [sx, hMid] of stripeHs) {
      const h0 = hMid - 0.05, h1 = hMid + 0.05;
      const x = sx * SCALE_R * 0.7;
      const p0 = new THREE.Vector3(x, yAt(h0), zAt(x, h0));
      const p1 = new THREE.Vector3(x, yAt(h1), zAt(x, h1));
      const mid = p0.clone().add(p1).multiplyScalar(0.5);
      const outward = new THREE.Vector3(x, 0, (p0.z + p1.z) / 2).normalize();
      mid.addScaledVector(outward, R * 0.006);
      const dir = p1.clone().sub(p0).normalize();
      const stripe = new THREE.Mesh(new THREE.BoxGeometry(R * 0.02, p0.distanceTo(p1) * 1.1, R * 0.012), salmonDarkMat);
      stripe.position.copy(mid);
      stripe.quaternion.setFromUnitVectors(new THREE.Vector3(0, 1, 0), dir);
      stripe.userData.noOutline = true;
      head.add(stripe);
    }

    // A wet glisten on the salmon's lip bulge — cheap, sells "wet" against the matte rice.
    {
      const gx = -R * 0.16, gh = 0.73;
      const glisten = new THREE.Mesh(new THREE.SphereGeometry(R * 0.045, 10, 8), flatMat('#ffffff', { transparent: true, opacity: 0.55 }));
      glisten.position.set(gx, yAt(gh), zAt(gx, gh) + R * 0.01);
      glisten.userData.noOutline = true;
      head.add(glisten);
    }

    // ── Rice grains ──────────────────────────────────────────────────────────
    // Small stretched capsules seated exactly on the rice's surface via zAt(), kept
    // on the sides/back so they never compete with the face.
    const grainMat = toonMat({ color: RICE_SHADE, roughness: 0.7 });
    const grainSpots: Array<[number, number, 1 | -1]> = [
      [0.30, 0.20, -1], [-0.34, 0.18, -1], [0.20, 0.28, -1], [-0.22, 0.30, -1],
      [0.36, 0.08, -1], [-0.38, 0.10, -1], [0.10, 0.04, -1], [-0.14, 0.06, -1],
    ];
    for (const [gx, gh, side] of grainSpots) {
      const x = gx * SCALE_R;
      const z = side * (zAt(x, gh) + R * 0.006);
      const grain = new THREE.Mesh(new THREE.CapsuleGeometry(R * 0.032, R * 0.085, 3, 6), grainMat);
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

    outlineGroup(this.root);
    this.collectFlashTargets();
    this.rig.restPose();
  }

  /**
   * Wide, slightly-startled eyes and puckered "o" lips — placed in the rice's own
   * face zone (between the nori band and the salmon seam), via `zAt()`, the exact
   * surface equation for this lathe (every horizontal slice is a perfect circle).
   */
  private buildFace(R: number, yAt: (h: number) => number, zAt: (x: number, h: number) => number): void {
    const face = this.rig.joints.face;
    // `face` carries the rig's generic forward offset tuned for a plain sphere; this
    // model's surface is authored directly on `head` instead, in exact local coords,
    // so re-anchor `face` at the head origin and add features to `head` itself.
    face.position.set(0, 0, 0);
    const head = this.rig.joints.head;
    const ink = PALETTE.ink;

    const eyeH = 0.54;
    const eyeY = yAt(eyeH);
    for (const sx of [-1, 1]) {
      const ex = sx * R * 0.24;
      const ez = zAt(ex, eyeH);

      // Sclera — wide white eye, the "slightly startled" read.
      const white = new THREE.Mesh(new THREE.SphereGeometry(R * 0.155, 18, 14), toonMat({ color: '#FFFFFF', roughness: 0.25 }));
      white.position.set(ex, eyeY, ez + R * 0.02);
      white.scale.set(1, 1.08, 0.55);
      white.castShadow = true;
      head.add(white);

      // Pupil pushed toward the top of the sclera — white shows below, the classic
      // "wide-eyed" surprised cue.
      const pupil = new THREE.Mesh(new THREE.SphereGeometry(R * 0.082, 16, 12), toonMat({ color: ink, roughness: 0.25 }));
      pupil.position.set(ex, eyeY + R * 0.03, ez + R * 0.06);
      pupil.scale.set(1, 1, 0.6);
      pupil.castShadow = true;
      head.add(pupil);

      const glint = new THREE.Mesh(new THREE.SphereGeometry(R * 0.03, 8, 8), flatMat('#ffffff'));
      glint.position.set(ex - R * 0.028, eyeY + R * 0.055, ez + R * 0.095);
      glint.userData.noOutline = true;
      head.add(glint);
    }

    // Puckered "o" lips — a plump little ring (tube nearly as thick as its own
    // radius, for a pursed-lip read rather than a thin circle outline).
    const mouthH = 0.46;
    const mouthY = yAt(mouthH);
    const mouthZ = zAt(0, mouthH) + R * 0.01;
    const lipMat = toonMat({ color: LIP, roughness: 0.4 });
    const lips = new THREE.Mesh(new THREE.TorusGeometry(R * 0.05, R * 0.028, 10, 20), lipMat);
    lips.name = 'sushi_lips';
    lips.position.set(0, mouthY, mouthZ);
    lips.castShadow = true;
    head.add(lips);
    // A dark inner disc so the "o" reads as an open pucker, not a solid pink bead.
    const lipHole = new THREE.Mesh(new THREE.CircleGeometry(R * 0.024, 12), toonMat({ color: '#7A2E38', roughness: 0.5 }));
    lipHole.name = 'sushi_lip_hole__no_outline';
    lipHole.userData.noOutline = true;
    lipHole.position.set(0, mouthY, mouthZ + R * 0.004);
    head.add(lipHole);
  }

  /**
   * Carries the rice + nori motif down onto the body: the rig's default torso is
   * already recoloured rice-white via the palette, so this only adds the nori belt
   * and its matching clasp. There is no `dressTorso` helper on the shared rig, so the
   * belt is sized against the torso's own known geometry — `rig.ts` builds the torso
   * as a tapered sphere of half-width `(shoulderWidth*1.18)*0.5` at its equator,
   * scaled by a taper factor that peaks at ~1.123 around the vertical midpoint — with
   * a further margin so the belt is guaranteed to sit proud of that taper rather than
   * sinking into it at any point.
   */
  private dressTorsoAsSushi(): void {
    const height = CHARACTER_HEIGHT;
    const shoulderWidth = height * 0.20;
    const tw = shoulderWidth * 1.18;
    const torsoH = height * 0.28;
    const taperMid = 0.86 + 0.30 * Math.sin(0.5 * Math.PI * 0.85); // rig.ts's taper at t=0.5
    const torsoHalfWidthMid = tw * 0.5 * taperMid;
    const beltRadius = torsoHalfWidthMid * 1.18; // safety margin over the tapered waist
    const beltY = torsoH * 0.52;

    const noriMat = glossyMat({ color: NORI, roughness: 0.3 });
    const belt = new THREE.Mesh(new THREE.CylinderGeometry(beltRadius, beltRadius, torsoH * 0.22, 24, 1, true), noriMat);
    belt.name = 'sushi_torso_belt';
    belt.position.y = beltY;
    belt.castShadow = true;
    belt.receiveShadow = true;
    this.rig.joints.torso.add(belt);
    for (const dy of [-torsoH * 0.11, torsoH * 0.11]) {
      const cap = new THREE.Mesh(new THREE.CircleGeometry(beltRadius, 24), noriMat);
      cap.name = 'sushi_torso_belt_cap__no_outline';
      cap.userData.noOutline = true;
      cap.rotation.x = -Math.PI / 2;
      cap.position.y = beltY + dy;
      this.rig.joints.torso.add(cap);
    }

    const clasp = new THREE.Mesh(
      new THREE.BoxGeometry(beltRadius * 0.32, torsoH * 0.16, beltRadius * 0.14),
      toonMat({ color: GOLD, roughness: 0.3, metalness: 0.35 })
    );
    clasp.name = 'sushi_torso_clasp';
    clasp.position.set(0, beltY, beltRadius + torsoH * 0.02);
    clasp.castShadow = true;
    this.rig.joints.torso.add(clasp);
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

  /** The rig owns all body motion; the base class's whole-body pass would fight it. */
  protected applyBaseMotion(): void {}
}
