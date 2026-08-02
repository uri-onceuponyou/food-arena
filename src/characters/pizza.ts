/**
 * Pizza (Neon).
 *
 * Built on the shared ChibiRig — see `donut.ts` for the reference implementation of
 * this pattern. The rig supplies torso, arms, hands, legs, feet and all motion; this
 * file authors only the food mass on `rig.joints.head`, the face on `rig.joints.face`
 * and a palette.
 *
 * Identity is fixed by `rules.ts`: Pizza, Neon rarity, Dough Balls / Tomato Splat /
 * Cheese Blind. The written description ("triangular slice, pepperoni, crust base,
 * closed smiling eyes") is a personality guide, not a literal spec — but the triangle
 * is explicitly the silhouette landmark here, so unlike other characters it is
 * protected rather than freely reinterpreted.
 */

import * as THREE from 'three';
import { BaseCharacter, type AnimContext } from './types';
import type { CharacterDef } from '../game/rules';
import { PALETTE } from '../game/rules';
import { toonMat, glossyMat, flatMat, outlineGroup } from '../render/toon';
import { ChibiRig } from './rig';

const CRUST = '#EFB868';       // baked dough slab
const CRUST_RIM = '#CE8A2E';   // puffier crust roll along the base — noticeably deeper/toastier
const SAUCE = PALETTE.tomato;  // '#E63946' — thin margin peeking past the cheese
const CHEESE = '#FFDE73';      // melted top layer — pushed brighter than the dough so it pops
const PEPPERONI = '#B93A28';   // wet cured meat, redder than the crust rim

export class PizzaCharacter extends BaseCharacter {
  private rig: ChibiRig;
  private pepperoni: THREE.Object3D[] = [];

  constructor(def: CharacterDef) {
    super(def);

    this.rig = new ChibiRig({
      palette: {
        limb: CRUST,
        hand: CHEESE,
        foot: CRUST_RIM,
        torso: CRUST,
        limbRoughness: 0.78,
      },
      proportions: { headFraction: 0.46 },
    });
    this.body.add(this.rig.joints.root);
    this.head = this.rig.joints.head;

    const R = this.rig.headRadius;
    const head = this.rig.joints.head;

    // ── Food mass: a triangular wedge, crust curving along the base, tip up ────
    // The triangle is Pizza's silhouette landmark, so it is built as a real
    // extruded prism (not squashed off a sphere/box) and kept big and simple —
    // one unmistakable shape read from any angle, per the reference bar.
    const tipY = R * 0.98;
    const baseY = -R * 0.86;
    const halfW = R * 0.80;
    const depth = R * 0.62; // slab thickness — enough to survive an edge-on view

    const shape = new THREE.Shape();
    shape.moveTo(0, tipY);
    shape.lineTo(halfW, baseY + R * 0.10);
    // Crust: a gentle outward bulge along the base, like the outer rim of a round pie.
    shape.quadraticCurveTo(0, baseY - R * 0.30, -halfW, baseY + R * 0.10);
    shape.lineTo(0, tipY);

    const dough = new THREE.Mesh(
      new THREE.ExtrudeGeometry(shape, { depth, bevelEnabled: true, bevelThickness: R * 0.035, bevelSize: R * 0.035, bevelSegments: 2, curveSegments: 16 }),
      toonMat({ color: CRUST, roughness: 0.85 })
    );
    dough.name = 'pizza_dough';
    dough.position.z = -depth / 2;
    dough.castShadow = true;
    dough.receiveShadow = true;
    head.add(dough);

    // Crust rim: a puffy raised band hugging the dough's own base curve exactly, so
    // it can never float outside the wedge silhouette or bury itself in the torso —
    // both happened in earlier passes (a free-floating capsule primitive first sat
    // fully embedded inside the dough, invisible, then — once pushed down to clear
    // the dough — sat low enough to disappear behind the torso instead). Built the
    // same way as the sauce/cheese insets: an exact offset of the dough's boundary,
    // extruded thicker and pushed proud in Z for a raised, toastier-coloured roll.
    const rimBand = R * 0.13;
    const rimShape = new THREE.Shape();
    rimShape.moveTo(-halfW, baseY + R * 0.10);
    rimShape.quadraticCurveTo(0, baseY - R * 0.30, halfW, baseY + R * 0.10);
    rimShape.lineTo(halfW, baseY + R * 0.10 + rimBand);
    rimShape.quadraticCurveTo(0, baseY - R * 0.30 + rimBand, -halfW, baseY + R * 0.10 + rimBand);
    rimShape.lineTo(-halfW, baseY + R * 0.10);
    const rimDepth = depth + R * 0.1;
    const rim = new THREE.Mesh(
      new THREE.ExtrudeGeometry(rimShape, { depth: rimDepth, bevelEnabled: true, bevelThickness: R * 0.03, bevelSize: R * 0.03, bevelSegments: 2, curveSegments: 16 }),
      toonMat({ color: CRUST_RIM, roughness: 0.83 })
    );
    rim.name = 'pizza_crust_rim';
    rim.position.z = -rimDepth / 2 + R * 0.08; // proud of the dough's own front face
    rim.castShadow = true;
    rim.receiveShadow = true;
    head.add(rim);

    // Sauce margin: a slightly larger, thin triangle sitting just behind the cheese
    // so a sliver of red shows at the border — the detail that reads as "sauce under
    // cheese" instead of "solid yellow triangle".
    const sauceShape = new THREE.Shape();
    const sTip = tipY - R * 0.14, sBase = baseY + R * 0.22, sHalfW = halfW * 0.74;
    sauceShape.moveTo(0, sTip);
    sauceShape.lineTo(sHalfW, sBase + R * 0.06);
    sauceShape.quadraticCurveTo(0, sBase - R * 0.16, -sHalfW, sBase + R * 0.06);
    sauceShape.lineTo(0, sTip);
    const sauce = new THREE.Mesh(
      new THREE.ExtrudeGeometry(sauceShape, { depth: R * 0.05, bevelEnabled: false, curveSegments: 16 }),
      glossyMat({ color: SAUCE, roughness: 0.18 })
    );
    sauce.name = 'pizza_sauce';
    sauce.position.z = depth / 2 - R * 0.01;
    sauce.castShadow = true;
    sauce.receiveShadow = true;
    head.add(sauce);

    // Cheese: inset further still, proud of the sauce, glossy and melted.
    const cheeseShape = new THREE.Shape();
    const cTip = tipY - R * 0.24, cBase = baseY + R * 0.34, cHalfW = halfW * 0.60;
    cheeseShape.moveTo(0, cTip);
    cheeseShape.lineTo(cHalfW, cBase + R * 0.05);
    cheeseShape.quadraticCurveTo(0, cBase - R * 0.12, -cHalfW, cBase + R * 0.05);
    cheeseShape.lineTo(0, cTip);
    const cheeseMat = glossyMat({ color: CHEESE, roughness: 0.25, emissive: CHEESE, emissiveIntensity: 0.18 });
    const cheese = new THREE.Mesh(
      new THREE.ExtrudeGeometry(cheeseShape, { depth: R * 0.07, bevelEnabled: true, bevelThickness: R * 0.02, bevelSize: R * 0.02, bevelSegments: 2, curveSegments: 16 }),
      cheeseMat
    );
    cheese.name = 'pizza_cheese';
    const cheeseFrontZ = depth / 2 + R * 0.07; // front face of the cheese slab, world Z
    cheese.position.z = depth / 2;
    cheese.castShadow = true;
    cheese.receiveShadow = true;
    head.add(cheese);

    // ── Pepperoni ────────────────────────────────────────────────────────────
    // Cupped discs sitting ON the cheese's front face. Kept small, few, and placed
    // outside the eyes/smile bounding zone (computed against the cheese triangle's
    // corners) — round 1 crowded the face with oversized pepperoni and blotted out
    // an eye entirely, which is exactly the "floating/colliding topping" failure the
    // brief warns about.
    const pepGeo = new THREE.CylinderGeometry(R * 0.078, R * 0.088, R * 0.045, 16);
    const pepMat = glossyMat({ color: PEPPERONI, roughness: 0.18 });
    const pepSpots: [number, number][] = [
      [R * 0.13, R * 0.38],
      [-R * 0.13, R * 0.38],
      [R * 0.38, -R * 0.39],
      [-R * 0.38, -R * 0.39],
    ];
    for (const [px, py] of pepSpots) {
      const pep = new THREE.Mesh(pepGeo, pepMat);
      pep.rotation.x = Math.PI / 2;
      pep.position.set(px, py, cheeseFrontZ + R * 0.02);
      pep.castShadow = true;
      pep.receiveShadow = true;
      head.add(pep);
      this.pepperoni.push(pep);
      // A faint grease glisten on top of each — the specular pop that sells "wet".
      const glisten = new THREE.Mesh(new THREE.SphereGeometry(R * 0.016, 8, 6), flatMat('#ffffff', { transparent: true, opacity: 0.5 }));
      glisten.position.set(px - R * 0.02, py + R * 0.02, cheeseFrontZ + R * 0.04);
      glisten.userData.noOutline = true;
      head.add(glisten);
    }

    this.buildFace(R, cheeseFrontZ);

    outlineGroup(this.root);
    this.collectFlashTargets();
    this.rig.restPose();
  }

  /**
   * Closed, happy eyes (upward arcs) and a warm smile, sitting on the cheese in the
   * lower-centre of the slice, clear of the crust and every pepperoni disc.
   */
  private buildFace(R: number, cheeseFrontZ: number): void {
    const face = this.rig.joints.face;
    // `face` is already pushed forward by the rig; pull local features back onto the
    // pizza's actual front (cheese) surface rather than the generic sphere assumption.
    const localZ = cheeseFrontZ - this.rig.headRadius * 0.82;
    const ink = PALETTE.ink;

    for (const sx of [-1, 1]) {
      // Closed eye: a thick upward-curved arc (happy ^_^ shape), built as real
      // geometry with depth per the face convention, not a flat decal.
      const eye = new THREE.Mesh(
        new THREE.TorusGeometry(R * 0.10, R * 0.028, 8, 16, Math.PI * 0.92),
        toonMat({ color: ink, roughness: 0.3 })
      );
      eye.position.set(sx * R * 0.26, -R * 0.05, localZ + R * 0.02);
      eye.rotation.z = sx > 0 ? Math.PI * 0.92 : Math.PI * 0.08;
      eye.castShadow = true;
      face.add(eye);
    }

    // Smile: a broad downward arc, wide and warm.
    const smile = new THREE.Mesh(
      new THREE.TorusGeometry(R * 0.20, R * 0.032, 8, 20, Math.PI * 0.8),
      toonMat({ color: ink, roughness: 0.3 })
    );
    smile.position.set(0, -R * 0.28, localZ);
    smile.rotation.z = Math.PI * 1.1;
    smile.castShadow = true;
    face.add(smile);

    // Rosy cheeks — small, warm, cheap charm that reads well at chibi scale.
    for (const sx of [-1, 1]) {
      const cheekBlush = new THREE.Mesh(
        new THREE.SphereGeometry(R * 0.06, 10, 8),
        flatMat('#FF9EC4', { transparent: true, opacity: 0.55 })
      );
      cheekBlush.position.set(sx * R * 0.42, -R * 0.18, localZ - R * 0.01);
      cheekBlush.scale.set(1, 0.7, 0.3);
      cheekBlush.userData.noOutline = true;
      face.add(cheekBlush);
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
   * The rig owns all body motion, so the base class's whole-body squash/lean would
   * fight it. Suppressed here; `onUpdate` drives the rig instead.
   */
  protected applyBaseMotion(): void {}
}
