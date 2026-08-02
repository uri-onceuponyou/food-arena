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
    const salmonDarkMat = glossyMat({ color: SALMON_DARK, roughness: 0.22 });

    // ── Rice mound ───────────────────────────────────────────────────────────
    // A capsule (constant-radius cylindrical wall + hemispherical caps) rather than a
    // sphere — its cylindrical section has a known, constant radius, which is what
    // lets every decal below (nori band, face, grains) be placed by exact algebra
    // against the true surface instead of a guessed offset (the float/bury failure
    // mode called out in the brief).
    const riceR = R * 0.58;
    const riceLen = R * 0.79;
    const capCenterY = riceLen / 2; // centre of the top hemisphere cap, in head-local space

    const rice = new THREE.Mesh(new THREE.CapsuleGeometry(riceR, riceLen, 10, 28), riceMat);
    rice.name = 'sushi_rice';
    rice.castShadow = true;
    rice.receiveShadow = true;
    head.add(rice);

    // ── Nori band ────────────────────────────────────────────────────────────
    // Wrapped around the lower-middle of the cylindrical wall, where the rice radius
    // is exactly constant (riceR) — a slightly larger cylinder (1.05x) is therefore
    // guaranteed proud of the rice everywhere along the band, never floating or
    // buried. This near-black band against warm-white rice is THE landmark.
    const noriTop = -R * 0.04;
    const noriBottom = -R * 0.38;
    const noriH = noriTop - noriBottom;
    const nori = new THREE.Mesh(
      new THREE.CylinderGeometry(riceR * 1.05, riceR * 1.05, noriH, 28, 1, true),
      noriMat
    );
    nori.name = 'sushi_nori_band';
    nori.position.y = (noriTop + noriBottom) / 2;
    nori.castShadow = true;
    nori.receiveShadow = true;
    head.add(nori);
    // Cap the band's open top/bottom rims with thin discs so the hollow cylinder
    // interior never peeks through at grazing angles.
    for (const y of [noriTop, noriBottom]) {
      const cap = new THREE.Mesh(new THREE.CircleGeometry(riceR * 1.05, 28), noriMat);
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
    clasp.position.set(0, (noriTop + noriBottom) / 2, riceR * 1.05 + R * 0.01);
    clasp.castShadow = true;
    head.add(clasp);

    // ── Salmon topping ───────────────────────────────────────────────────────
    // A spherical cap concentric with the rice's own top-hemisphere centre, at a
    // slightly larger radius (1.06x) — the same "two concentric spheres" guarantee
    // used for the nori band, extended just past the equator (thetaLength ~97°) so it
    // drapes down over the rice's shoulders like a real fish slice. Checked against
    // the cylindrical wall below the equator: at the bottom edge the cap's horizontal
    // radius (riceR*1.06*sin97°) still exceeds riceR, so it stays proud of the rice
    // wall the whole way down rather than curving back inside it.
    const salmonR = riceR * 1.06;
    const salmonThetaLen = THREE.MathUtils.degToRad(97);
    const salmon = new THREE.Mesh(
      new THREE.SphereGeometry(salmonR, 32, 20, 0, Math.PI * 2, 0, salmonThetaLen),
      salmonMat
    );
    salmon.name = 'sushi_salmon';
    salmon.position.y = capCenterY;
    salmon.castShadow = true;
    salmon.receiveShadow = true;
    head.add(salmon);

    // Fish striations — thin darker streaks running down the salmon, following the
    // exact same sphere (concentric, marginally larger radius) so they sit flush
    // against the salmon's own surface rather than floating off it.
    const streakR = salmonR * 1.01;
    for (let i = 0; i < 5; i++) {
      const phi = -0.9 + i * 0.42;
      const streak = new THREE.Mesh(new THREE.CapsuleGeometry(R * 0.014, R * 0.34, 3, 6), salmonDarkMat);
      streak.name = 'sushi_streak';
      const theta = 0.18 + (i % 2) * 0.1;
      const dir = new THREE.Vector3(Math.sin(theta) * Math.sin(phi), Math.cos(theta), Math.sin(theta) * Math.cos(phi)).normalize();
      streak.position.copy(dir).multiplyScalar(streakR).add(new THREE.Vector3(0, capCenterY, 0));
      streak.quaternion.setFromUnitVectors(new THREE.Vector3(0, 1, 0), dir);
      streak.rotateX(0.25);
      streak.userData.noOutline = true;
      head.add(streak);
    }

    // A wet glisten on the salmon — cheap, sells "wet" against the matte rice.
    const glisten = new THREE.Mesh(new THREE.SphereGeometry(R * 0.05, 10, 8), flatMat('#ffffff', { transparent: true, opacity: 0.55 }));
    glisten.position.set(-R * 0.18, capCenterY + salmonR * 0.55, salmonR * 0.72);
    glisten.userData.noOutline = true;
    head.add(glisten);

    // ── Rice grains ──────────────────────────────────────────────────────────
    // Small stretched capsules seated exactly on the cylindrical rice wall (surface
    // equation x²+z²=riceR² is exact there, so z is solved directly rather than
    // guessed), kept on the sides/back so they never compete with the face.
    const grainMat = toonMat({ color: RICE_SHADE, roughness: 0.7 });
    const grainSpots: Array<[number, number]> = [
      [0.44, -0.30], [-0.46, -0.28], [0.30, -0.08], [-0.32, -0.10],
      [0.50, 0.05], [-0.50, 0.02], [0.20, -0.36], [-0.18, -0.35],
    ];
    for (const [gx, gy] of grainSpots) {
      const x = gx * riceR;
      const y = gy * R;
      const zSq = riceR * riceR - x * x;
      if (zSq <= 0) continue;
      const z = -Math.sqrt(zSq) - R * 0.005; // back/side hemisphere, embedded a hair for a snug seat
      const grain = new THREE.Mesh(new THREE.CapsuleGeometry(R * 0.035, R * 0.09, 3, 6), grainMat);
      grain.position.set(x, y, z);
      const outNormal = new THREE.Vector3(x, 0, z).normalize();
      grain.quaternion.setFromUnitVectors(new THREE.Vector3(0, 1, 0), outNormal);
      grain.rotateX(Math.PI / 2 + (Math.random() - 0.5) * 0.6);
      grain.castShadow = true;
      head.add(grain);
      this.riceGrains.push(grain);
    }

    this.buildFace(R, riceR);
    this.dressTorsoAsSushi();

    outlineGroup(this.root);
    this.collectFlashTargets();
    this.rig.restPose();
  }

  /**
   * Wide, slightly-startled eyes and puckered "o" lips — placed on the front of the
   * rice mound's cylindrical wall, between the nori band and the salmon drape, where
   * the surface radius is exactly `riceR` (solved directly, not approximated).
   */
  private buildFace(R: number, riceR: number): void {
    const face = this.rig.joints.face;
    // `face` carries the rig's generic forward offset tuned for a plain sphere; this
    // model's surface is authored directly on `head` instead, in exact local coords,
    // so re-anchor `face` at the head origin and add features to `head` itself.
    face.position.set(0, 0, 0);
    const head = this.rig.joints.head;
    const ink = PALETTE.ink;

    const eyeY = R * 0.20;
    for (const sx of [-1, 1]) {
      const ex = sx * R * 0.27;
      const ez = Math.sqrt(Math.max(0, riceR * riceR - ex * ex));

      // Sclera — wide white eye, the "slightly startled" read.
      const white = new THREE.Mesh(new THREE.SphereGeometry(R * 0.165, 18, 14), toonMat({ color: '#FFFFFF', roughness: 0.25 }));
      white.position.set(ex, eyeY, ez + R * 0.02);
      white.scale.set(1, 1.08, 0.55);
      white.castShadow = true;
      head.add(white);

      // Pupil pushed toward the top of the sclera — white shows below, the classic
      // "wide-eyed" surprised cue.
      const pupil = new THREE.Mesh(new THREE.SphereGeometry(R * 0.088, 16, 12), toonMat({ color: ink, roughness: 0.25 }));
      pupil.position.set(ex, eyeY + R * 0.035, ez + R * 0.06);
      pupil.scale.set(1, 1, 0.6);
      pupil.castShadow = true;
      head.add(pupil);

      const glint = new THREE.Mesh(new THREE.SphereGeometry(R * 0.032, 8, 8), flatMat('#ffffff'));
      glint.position.set(ex - R * 0.03, eyeY + R * 0.06, ez + R * 0.10);
      glint.userData.noOutline = true;
      head.add(glint);
    }

    // Puckered "o" lips — a plump little ring (tube nearly as thick as its own
    // radius, for a pursed-lip read rather than a thin circle outline).
    const mouthY = -R * 0.005;
    const mouthZ = riceR + R * 0.01;
    const lipMat = toonMat({ color: LIP, roughness: 0.4 });
    const lips = new THREE.Mesh(new THREE.TorusGeometry(R * 0.052, R * 0.03, 10, 20), lipMat);
    lips.name = 'sushi_lips';
    lips.position.set(0, mouthY, mouthZ);
    lips.castShadow = true;
    head.add(lips);
    // A dark inner disc so the "o" reads as an open pucker, not a solid pink bead.
    const lipHole = new THREE.Mesh(new THREE.CircleGeometry(R * 0.026, 12), toonMat({ color: '#7A2E38', roughness: 0.5 }));
    lipHole.name = 'sushi_lip_hole__no_outline';
    lipHole.userData.noOutline = true;
    lipHole.position.set(0, mouthY, mouthZ + R * 0.005);
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
