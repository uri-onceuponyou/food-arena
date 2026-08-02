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
// Feet deliberately break from the crust family altogether — a charred-crust-bottom
// brown, dark enough to be a real value drop against the pale CRUST limbs rather than
// a slightly-darker shade of the same tan.
const CRUST_CHAR = '#4A2A12';

/**
 * Local stand-in for `ChibiRig`'s intended `dressTorso`/`torsoSize` — at the time of
 * writing `rig.ts` documents the pattern (see its torso comment) but does not yet
 * expose either, and this file is not allowed to touch `rig.ts`. Reads the real size
 * off the default torso mesh's geometry (so it stays correct even if rig proportions
 * are retuned later), then swaps it out for character geometry parented the same way
 * the default was — a child of `rig.joints.torso`, so it inherits the rig's own
 * breathing/lean/run animation for free.
 */
function dressTorso(rig: ChibiRig, build: (size: { w: number; h: number; d: number }) => THREE.Object3D): void {
  let size = { w: 0.42, h: 0.5, d: 0.32 };
  const old = rig.torsoMesh;
  if (old) {
    old.geometry.computeBoundingBox();
    const bb = old.geometry.boundingBox;
    if (bb) size = { w: bb.max.x - bb.min.x, h: bb.max.y - bb.min.y, d: bb.max.z - bb.min.z };
    old.parent?.remove(old);
    old.geometry.dispose();
  }
  rig.joints.torso.add(build(size));
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

export class PizzaCharacter extends BaseCharacter {
  private rig: ChibiRig;
  private pepperoni: THREE.Object3D[] = [];

  constructor(def: CharacterDef) {
    super(def);

    this.rig = new ChibiRig({
      palette: {
        limb: CRUST,
        // Cheese hands sat too close in hue to the crust limb — both warm
        // gold, differing mostly in value. Pepperoni-red mitts (the same
        // colour already used for the topping) give hands a genuine hue
        // break, not just a lighter shade of the same colour.
        hand: PEPPERONI,
        foot: CRUST_CHAR,
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

    // ── Body: dress the torso ─────────────────────────────────────────────────
    // Two independent builder rounds both named the same gap: a themed head on a
    // generic body. Pizza's body is a crust-coloured torso wearing a smaller
    // crust-rimmed cheese badge on the chest, with cheese drips over the
    // shoulders and a pepperoni continuing the topping motif — so the slice's
    // food language runs the full height of the model instead of stopping dead
    // at the neck.
    dressTorso(this.rig, (size) => {
      const group = new THREE.Group();
      group.name = 'pizza_torso';

      const bodyHalfW = size.w * 0.55;
      const bodyHalfD = size.d * 0.58;
      const bodyBottomY = size.h * 0.02;
      const bodyTopY = size.h * 1.05;
      const doughBody = new THREE.Mesh(
        torsoBarrel(bodyHalfW, bodyTopY - bodyBottomY, bodyHalfD, 0.26),
        toonMat({ color: CRUST, roughness: 0.85 })
      );
      doughBody.name = 'pizza_torso_crust';
      doughBody.position.y = (bodyTopY + bodyBottomY) / 2;
      doughBody.castShadow = true;
      doughBody.receiveShadow = true;
      group.add(doughBody);

      // Chest badge: a SMALLER echo of the head's own wedge (curved crust base,
      // sharp point), worn apex-down like a pendant on the chest rather than
      // covering the whole torso. A first pass built this as a full-width bib
      // and it read as a stiff funnel/collar wrapping the neck; narrowing it to
      // a badge that leaves bare crust body visible on both sides reads as a
      // garment ON a body instead of a robot collar.
      const apexY = size.h * 0.30;
      const baseY = size.h * 0.88;
      const halfW = bodyHalfW * 0.60;
      const bulge = (baseY - apexY) * 0.30;
      const cornerY = baseY - (baseY - apexY) * 0.10;
      const badgeShape = (scale: number): THREE.Shape => {
        const midY = (apexY + baseY) / 2;
        const sc = (y: number) => midY + (y - midY) * scale;
        const s = new THREE.Shape();
        s.moveTo(0, sc(apexY));
        s.lineTo(halfW * scale, sc(cornerY));
        s.quadraticCurveTo(0, sc(baseY + bulge), -halfW * scale, sc(cornerY));
        s.lineTo(0, sc(apexY));
        return s;
      };

      // Depths trimmed down from a first pass that pushed the badge proud enough
      // to read as a satchel bulging off the chest at an angle — this sits
      // closer to flush, like a patch on the crust rather than a strapped-on
      // slab.
      const badgeDepth = bodyHalfD * 0.14;
      const rim = new THREE.Mesh(
        new THREE.ExtrudeGeometry(badgeShape(1.0), { depth: badgeDepth, bevelEnabled: true, bevelThickness: badgeDepth * 0.25, bevelSize: badgeDepth * 0.25, bevelSegments: 2, curveSegments: 16 }),
        toonMat({ color: CRUST_RIM, roughness: 0.83 })
      );
      rim.name = 'pizza_torso_rim';
      rim.position.z = bodyHalfD * 0.60;
      rim.castShadow = true;
      rim.receiveShadow = true;
      group.add(rim);

      const cheeseDepth = bodyHalfD * 0.09;
      const badgeFrontZ = bodyHalfD * 0.60 + badgeDepth;
      const cheeseBadge = new THREE.Mesh(
        new THREE.ExtrudeGeometry(badgeShape(0.78), { depth: cheeseDepth, bevelEnabled: true, bevelThickness: cheeseDepth * 0.3, bevelSize: cheeseDepth * 0.3, bevelSegments: 2, curveSegments: 16 }),
        glossyMat({ color: CHEESE, roughness: 0.28 })
      );
      cheeseBadge.name = 'pizza_torso_cheese';
      cheeseBadge.position.z = badgeFrontZ;
      cheeseBadge.castShadow = true;
      cheeseBadge.receiveShadow = true;
      group.add(cheeseBadge);

      // Cheese drips off the badge's top corners, over the shoulders. Two
      // earlier passes anchored these against `baseY`, but the badge's actual
      // top boundary is a CURVE that bulges above `baseY` at its centre and
      // only meets `cornerY` right at the corners — anchoring against the
      // nominal (non-curved) value left both attempts poking up through the
      // rim as visible spikes. Anchored well below `cornerY` instead — a flat,
      // conservative floor that sits under the curve everywhere near these
      // corner-ish x positions — so only the bottom of each sphere is ever
      // visible, hanging down over the crust body.
      const dripAnchorY = cornerY - (baseY - apexY) * 0.14;
      const dripR = bodyHalfD * 0.06;
      const dripXs = [-halfW * 0.92, -halfW * 0.60, halfW * 0.60, halfW * 0.92];
      for (let i = 0; i < dripXs.length; i++) {
        const len = bodyHalfD * (0.10 + (i % 2) * 0.05);
        const drip = new THREE.Mesh(new THREE.SphereGeometry(dripR, 10, 10), glossyMat({ color: CHEESE, roughness: 0.28 }));
        drip.name = 'pizza_torso_drip';
        drip.position.set(dripXs[i], dripAnchorY - len, badgeFrontZ + cheeseDepth * 0.6 + dripR * 0.6);
        drip.scale.set(1, len / dripR, 1);
        drip.castShadow = true;
        drip.receiveShadow = true;
        group.add(drip);
      }

      // A single pepperoni on the badge, continuing the topping motif onto the
      // body without crowding the smaller shape.
      const pep = new THREE.Mesh(
        new THREE.CylinderGeometry(bodyHalfD * 0.10, bodyHalfD * 0.11, bodyHalfD * 0.06, 14),
        glossyMat({ color: PEPPERONI, roughness: 0.18 })
      );
      pep.name = 'pizza_torso_pepperoni';
      pep.rotation.x = Math.PI / 2;
      pep.position.set(halfW * 0.05, (apexY + baseY) / 2 + bulge * 0.2, badgeFrontZ + cheeseDepth * 0.5 + bodyHalfD * 0.03);
      pep.castShadow = true;
      pep.receiveShadow = true;
      group.add(pep);

      return group;
    });

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
