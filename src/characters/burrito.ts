/**
 * Burrito (Rare).
 *
 * Built on the shared ChibiRig — see `donut.ts` for the reference implementation of
 * this pattern. The rig supplies torso, arms, hands, legs, feet and all motion; this
 * file authors only the food mass on `rig.joints.head`, the face and a palette.
 *
 * Identity is fixed by `rules.ts`: Burrito, Rare rarity, Burrito Disc / Roll Stun /
 * Topping Swarm. The written description ("white wrap, stands upright, toppings
 * visible at the open end") is treated as a personality guide rather than a literal
 * spec, per the brief — but "open end with visible fillings" IS kept as the
 * silhouette landmark: a standing tortilla tube, cut open at the top, with a mound of
 * rice/meat/veg fillings spilling out. Read from the game's steeply pitched-down
 * camera, an UP-facing opening is far more legible than a forward-facing one would be,
 * so unlike Donut's hole (which faces +Z) this one faces +Y.
 *
 * The torso is dressed as a continuation of the wrap with foil peeled back at the
 * base — per the brief's note that the reference bar dresses bodies with contrasting
 * colours (red overalls, blue shirt, dark boots), not one flat costume colour.
 */

import * as THREE from 'three';
import { BaseCharacter, type AnimContext } from './types';
import type { CharacterDef } from '../game/rules';
import { PALETTE } from '../game/rules';
import { toonMat, glossyMat, flatMat, outlineGroup } from '../render/toon';
import { ChibiRig } from './rig';

// ── Palette ──────────────────────────────────────────────────────────────────
const TORTILLA = '#F5EAD6';        // pale flour wrap — the dominant, matte mass
const TORTILLA_SHADE = '#E4CFA0';  // toasted/shadow tone — rim, torso wrap-continuation
const WRAP_BAND = '#E0562B';       // paper wrapper band + hands — vivid contrast colour
const FOIL = '#E7EDEF';            // peeled foil — cool, bright, metallic
const BOOT = '#7A5230';            // dark toasted-tortilla boots, grounds the pale body
const RICE = PALETTE.cream;        // '#FFF3DE' — filling mound base
const MEAT = PALETTE.patty;
const MEAT_DARK = PALETTE.pattyDark;
const TOMATO = PALETTE.tomato;
const CHEESE = PALETTE.cheese;
const LETTUCE = PALETTE.lettuce;
const SOUR_CREAM = '#FFFDF7';

type Spot = readonly [angleDeg: number, radiusFrac: number];

/**
 * A rounded limb segment, like a capsule but with INDEPENDENT top and bottom
 * radii, hanging DOWN from the joint origin (spans y=0..-len) — the orientation
 * `dressLimbs()` expects. Local to this file; see `hamburger.ts` for the
 * reference copy. Burrito's own call sites keep top/bottom radii close together
 * — a rolled tortilla is close to a true cylinder, not a tapered dough limb.
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

export class BurritoCharacter extends BaseCharacter {
  private rig: ChibiRig;
  private toppings: THREE.Object3D[] = [];
  private toppingBaseRotZ: number[] = [];

  constructor(def: CharacterDef) {
    super(def);

    this.rig = new ChibiRig({
      palette: {
        limb: TORTILLA,
        hand: WRAP_BAND,
        foot: BOOT,
        torso: TORTILLA_SHADE,
        limbRoughness: 0.78,
      },
      proportions: { headFraction: 0.46 },
    });
    this.body.add(this.rig.joints.root);
    this.head = this.rig.joints.head;

    const R = this.rig.headRadius;
    const head = this.rig.joints.head;

    // ── Food mass: an upright rolled tortilla, cut open at the top ───────────
    // A barrel-bulged cylinder rather than a straight tube — real burritos bulge
    // where they're stuffed. Built by displacing a plain CylinderGeometry's vertices
    // radially, the same technique rig.ts uses for the torso taper.
    const botR = R * 0.56;
    const topR = R * 0.62;
    const bodyBottomY = -R * 0.85;
    const bodyTopY = R * 0.50;
    const bodyH = bodyTopY - bodyBottomY;
    const bulgeAmt = 0.12;

    const wrapGeo = new THREE.CylinderGeometry(topR, botR, bodyH, 28, 8, false);
    {
      const pos = wrapGeo.attributes.position as THREE.BufferAttribute;
      for (let i = 0; i < pos.count; i++) {
        const gy = pos.getY(i);
        const t = gy / bodyH + 0.5; // 0 bottom .. 1 top
        const bulge = 1 + bulgeAmt * Math.sin(t * Math.PI);
        pos.setX(i, pos.getX(i) * bulge);
        pos.setZ(i, pos.getZ(i) * bulge);
      }
      wrapGeo.computeVertexNormals();
    }
    const wrap = new THREE.Mesh(wrapGeo, toonMat({ color: TORTILLA, roughness: 0.8 }));
    wrap.name = 'burrito_wrap';
    wrap.position.y = (bodyBottomY + bodyTopY) / 2;
    wrap.castShadow = true;
    wrap.receiveShadow = true;
    head.add(wrap);

    // Exact radius of the wrap's outer surface at a given head-local Y — mirrors the
    // bulge loop above exactly, so anything placed against "the surface" (the face,
    // decals) is solved against the real equation rather than a guessed constant.
    // This is the fix for the "decals floating above / buried inside the surface"
    // failure mode: a flat guess only ever matches the surface at one specific point.
    const wrapRadiusAt = (y: number): number => {
      const t = THREE.MathUtils.clamp((y - bodyBottomY) / bodyH, 0, 1);
      const base = THREE.MathUtils.lerp(botR, topR, t);
      return base * (1 + bulgeAmt * Math.sin(t * Math.PI));
    };
    // True surface Z at a given (x, y) on the tube, assuming a circular cross-section
    // at every height (true here since the bulge scales x/z uniformly together).
    const surfaceZ = (x: number, y: number): number => {
      const r = wrapRadiusAt(y);
      return Math.sqrt(Math.max(0, r * r - x * x));
    };

    // ── Open top: rim + a mound of fillings spilling out ──────────────────────
    // Faces +Y (up), not +Z — under this game's steeply pitched-down camera an
    // up-facing opening reads far better than a forward-facing one across every yaw
    // angle, which is exactly what the 4-angle screenshot review checks for.
    const rim = new THREE.Mesh(
      new THREE.TorusGeometry(topR * 0.92, R * 0.065, 10, 28),
      toonMat({ color: TORTILLA_SHADE, roughness: 0.8 })
    );
    rim.name = 'burrito_rim';
    rim.rotation.x = -Math.PI / 2; // torus hole (default +Z) now points +Y
    rim.position.y = bodyTopY;
    rim.castShadow = true;
    rim.receiveShadow = true;
    head.add(rim);

    const domeCenterY = bodyTopY + R * 0.02;
    const domeR = topR * 0.85;
    const mound = new THREE.Mesh(
      // A dome cap (theta 0..~0.48π from the +Y pole) rather than a full sphere —
      // just the top bulge, like donut's proud-glaze trick.
      new THREE.SphereGeometry(domeR, 24, 12, 0, Math.PI * 2, 0, Math.PI * 0.48),
      toonMat({ color: RICE, roughness: 0.62 })
    );
    mound.name = 'burrito_rice';
    mound.position.y = domeCenterY;
    mound.castShadow = true;
    mound.receiveShadow = true;
    head.add(mound);

    // Toppings seated ON the dome — each position solved against the dome's own
    // sphere equation (y = domeCenterY + sqrt(domeR^2 - r^2)) rather than eyeballed,
    // same fix as the wrap surface above.
    const meatMat = toonMat({ color: MEAT, roughness: 0.55 });
    const meatDarkMat = toonMat({ color: MEAT_DARK, roughness: 0.5 });
    const tomatoMat = glossyMat({ color: TOMATO, roughness: 0.2 });
    const cheeseMat = glossyMat({ color: CHEESE, roughness: 0.3 });
    const lettuceMat = toonMat({ color: LETTUCE, roughness: 0.6 });
    const creamMat = glossyMat({ color: SOUR_CREAM, roughness: 0.15 });

    const placeOnDome = (
      spot: Spot,
      geo: THREE.BufferGeometry,
      mat: THREE.Material,
      name: string
    ): THREE.Mesh => {
      const a = THREE.MathUtils.degToRad(spot[0]);
      const r = spot[1] * domeR;
      const y = domeCenterY + Math.sqrt(Math.max(0, domeR * domeR - r * r)) * 0.96;
      const m = new THREE.Mesh(geo, mat);
      m.name = name;
      m.position.set(Math.cos(a) * r, y, Math.sin(a) * r);
      m.rotation.set(0.3, a, 0);
      m.castShadow = true;
      m.receiveShadow = true;
      head.add(m);
      this.toppings.push(m);
      this.toppingBaseRotZ.push(m.rotation.z);
      return m;
    };

    // Sized up from round 1, where sparse small toppings left the pale rice mound
    // dominant and the whole thing read as ice-cream-with-sprinkles rather than a
    // packed burrito filling.
    //
    // Round 3 defect: each topping type had its own block of angles (all the meat
    // clustered in 0-150 deg, etc). From the front camera that meant one whole TYPE
    // dominated the visible half of the dome — a solid clump of meat with the cheese,
    // tomato and lettuce hidden behind/under it — rather than a mixed filling. Fixed
    // by interleaving all four types round-robin around the full circle, so every
    // angular slice the camera can see has a mix, never a monotone clump. Sizes also
    // trimmed down so adjacent pieces don't overlap into a single blob.
    const meatGeo = new THREE.SphereGeometry(R * 0.15, 10, 8);
    const tomatoGeo = new THREE.BoxGeometry(R * 0.14, R * 0.14, R * 0.14);
    const cheeseGeo = new THREE.ConeGeometry(R * 0.065, R * 0.23, 6);
    const lettuceGeo = new THREE.CapsuleGeometry(R * 0.04, R * 0.16, 4, 6);
    const creamGeo = new THREE.SphereGeometry(R * 0.08, 10, 8);

    const KIND_COUNT = 16; // 4 full trips around the four kinds below
    const kinds = ['meat', 'tomato', 'cheese', 'lettuce'] as const;
    const spotsByKind: Record<(typeof kinds)[number], Spot[]> = { meat: [], tomato: [], cheese: [], lettuce: [] };
    for (let i = 0; i < KIND_COUNT; i++) {
      const deg = (i / KIND_COUNT) * 360 + ((i * 13) % 10); // near-even ring, deterministic jitter
      const rFrac = 0.32 + (((i * 37) % 100) / 100) * 0.46; // 0.32..0.78, deterministic jitter
      spotsByKind[kinds[i % kinds.length]].push([deg, rFrac]);
    }
    const creamSpots: Spot[] = [[10, 0.2], [135, 0.22], [250, 0.18], [300, 0.24]];

    spotsByKind.meat.forEach((s, i) => {
      const m = placeOnDome(s, meatGeo, i % 3 === 0 ? meatDarkMat : meatMat, 'burrito_meat');
      m.scale.set(1.1, 0.8, 1.1);
    });
    spotsByKind.tomato.forEach((s) => {
      const m = placeOnDome(s, tomatoGeo, tomatoMat, 'burrito_tomato');
      m.rotation.z = 0.4;
    });
    spotsByKind.cheese.forEach((s) => placeOnDome(s, cheeseGeo, cheeseMat, 'burrito_cheese'));
    spotsByKind.lettuce.forEach((s) => {
      const m = placeOnDome(s, lettuceGeo, lettuceMat, 'burrito_lettuce');
      m.rotation.x += Math.PI / 2; // lay along the surface rather than poking straight up
    });
    creamSpots.forEach((s) => {
      const m = placeOnDome(s, creamGeo, creamMat, 'burrito_cream');
      m.scale.set(1, 0.5, 1);
    });

    // ── Face: on the wrap's own front surface, mid-body ───────────────────────
    // `face` is reset to identity and every feature carries its own computed
    // (x, y, z) rather than relying on the rig's spherical-head default offset —
    // this body isn't spherical, so that default would float the eyes off the tube
    // wherever they're not dead-centre (verified: at the default x-offset the rig's
    // flat headRadius*0.82 constant sits ~0.09R proud of the tube's true surface).
    this.rig.joints.face.position.set(0, 0, 0);
    this.buildFace(R, surfaceZ);

    // ── Torso: dressed as a wrap continuation, foil peeling back at the base ──
    this.dressTorso(R);

    // ── Limbs: bespoke, not the shared rig defaults ───────────────────────────
    // An independent art director named the rig's identical capsule-arm/ball-hand/
    // wedge-foot kit as the single biggest "template" tell across the whole cast.
    // Burrito's limbs are rolled tortilla, close to true cylinders rather than
    // tapered dough, with a seam stripe echoing the roll; hands are twisted foil
    // nubs (the classic "twist the wrapper end" burrito silhouette) instead of a
    // generic mitt, and feet read as the wrap's own cut end.
    const limbWrapMat = toonMat({ color: TORTILLA, roughness: 0.8 });
    const limbWrapShadeMat = toonMat({ color: TORTILLA_SHADE, roughness: 0.8 });
    const seamMat = toonMat({ color: TORTILLA_SHADE, roughness: 0.7 });
    const foilMatLimb = toonMat({ color: FOIL, roughness: 0.25, metalness: 0.5 });
    const bandMatLimb = toonMat({ color: WRAP_BAND, roughness: 0.72 });
    const bootMatLimb = toonMat({ color: BOOT, roughness: 0.75 });
    this.rig.dressLimbs((part, size) => {
      switch (part) {
        case 'upperArmL': case 'upperArmR':
        case 'thighL': case 'thighR': {
          const g = new THREE.Group();
          const m = new THREE.Mesh(taperedSegment(size.len, size.radius * 1.05, size.radius * 1.0, 12), limbWrapMat);
          m.name = `${part}_mesh`;
          m.castShadow = true;
          m.receiveShadow = true;
          g.add(m);
          const seam = new THREE.Mesh(new THREE.BoxGeometry(size.radius * 0.16, size.len * 0.94, size.radius * 0.05), seamMat);
          seam.position.set(0, -size.len * 0.5, size.radius * 0.98);
          seam.userData.noOutline = true;
          g.add(seam);
          return g;
        }
        case 'forearmL': case 'forearmR':
        case 'shinL': case 'shinR': {
          const g = new THREE.Group();
          const m = new THREE.Mesh(taperedSegment(size.len, size.radius * 1.0, size.radius * 0.92, 12), limbWrapShadeMat);
          m.name = `${part}_mesh`;
          m.castShadow = true;
          m.receiveShadow = true;
          g.add(m);
          // Wrapper-band cuff — same costume language as the torso's own sash.
          const cuff = new THREE.Mesh(new THREE.TorusGeometry(size.radius * 1.02, size.radius * 0.26, 8, 20), bandMatLimb);
          cuff.rotation.x = Math.PI / 2;
          cuff.position.y = -size.radius * 0.3;
          cuff.castShadow = true;
          g.add(cuff);
          return g;
        }
        case 'handL': case 'handR': {
          const g = new THREE.Group();
          const cuff = new THREE.Mesh(new THREE.TorusGeometry(size.radius * 0.7, size.radius * 0.22, 8, 16), bandMatLimb);
          cuff.rotation.x = Math.PI / 2;
          cuff.castShadow = true;
          g.add(cuff);
          // The classic twisted-foil wrapper end — a cone tapering to a point.
          const twist = new THREE.Mesh(new THREE.ConeGeometry(size.radius * 0.62, size.radius * 1.5, 8), foilMatLimb);
          twist.position.y = -size.radius * 0.95;
          twist.name = `${part}_mesh`;
          twist.castShadow = true;
          twist.receiveShadow = true;
          g.add(twist);
          return g;
        }
        case 'footL': case 'footR': {
          const g = new THREE.Group();
          const stub = new THREE.Mesh(
            new THREE.CylinderGeometry(size.radius * 1.1, size.radius * 1.02, size.len * 0.75, 16, 1, false),
            bootMatLimb
          );
          stub.position.set(0, -size.len * 0.42, size.radius * 0.3);
          stub.rotation.x = Math.PI * 0.06;
          stub.name = `${part}_mesh`;
          stub.castShadow = true;
          stub.receiveShadow = true;
          g.add(stub);
          const ring = new THREE.Mesh(new THREE.TorusGeometry(size.radius * 1.06, size.radius * 0.1, 6, 16), foilMatLimb);
          ring.rotation.x = Math.PI / 2;
          ring.position.set(0, -size.len * 0.1, size.radius * 0.3);
          ring.castShadow = true;
          g.add(ring);
          return g;
        }
        default:
          return null;
      }
    });

    outlineGroup(this.root);
    this.collectFlashTargets();
    this.rig.restPose();
  }

  /** Eager, open-mouthed grin — a Rare brawler ready to roll into a fight. */
  private buildFace(R: number, surfaceZ: (x: number, y: number) => number): void {
    const face = this.rig.joints.face;
    const ink = PALETTE.ink;
    const eyeMat = toonMat({ color: ink, roughness: 0.25 });
    const eyeY = R * 0.10;

    for (const sx of [-1, 1]) {
      const ex = sx * R * 0.30;
      const ez = surfaceZ(ex, eyeY) * 0.94;
      const eye = new THREE.Mesh(new THREE.SphereGeometry(R * 0.125, 16, 14), eyeMat);
      eye.position.set(ex, eyeY, ez);
      eye.scale.set(1, 1.15, 0.55);
      eye.castShadow = true;
      face.add(eye);

      const glint = new THREE.Mesh(new THREE.SphereGeometry(R * 0.04, 8, 8), flatMat('#ffffff'));
      glint.position.set(ex - R * 0.03, eyeY + R * 0.045, ez + R * 0.05);
      glint.userData.noOutline = true;
      face.add(glint);

      // Brows — matched height/angle on both sides, eager and upward, matching
      // "ready to roll into a fight". Real shaded geometry, not a flat decal, and
      // placed against the SAME `surfaceZ` equation as the eye it sits above so it
      // can't sink into or float off the tube regardless of where sx pushes it.
      const bx = ex;
      const by = eyeY + R * 0.155;
      const bz = surfaceZ(bx, by) * 0.95;
      const brow = new THREE.Mesh(
        new THREE.CapsuleGeometry(R * 0.022, R * 0.15, 4, 8),
        toonMat({ color: PALETTE.ink, roughness: 0.4 })
      );
      brow.position.set(bx, by, bz);
      brow.rotation.z = Math.PI / 2 - sx * 0.22;
      brow.castShadow = true;
      face.add(brow);
    }

    const mouthY = -R * 0.22;
    const mouth = new THREE.Mesh(
      new THREE.TorusGeometry(R * 0.17, R * 0.055, 8, 20, Math.PI * 0.85),
      toonMat({ color: ink, roughness: 0.3 })
    );
    mouth.position.set(0, mouthY, surfaceZ(0, mouthY) * 0.9);
    mouth.rotation.z = Math.PI * 1.08;
    mouth.castShadow = true;
    face.add(mouth);

    for (const sx of [-1, 1]) {
      const cx = sx * R * 0.44;
      const cy = -R * 0.08;
      const cheek = new THREE.Mesh(
        new THREE.SphereGeometry(R * 0.06, 10, 8),
        flatMat('#FF9EC4', { transparent: true, opacity: 0.5 })
      );
      cheek.position.set(cx, cy, surfaceZ(cx, cy) * 0.92);
      cheek.scale.set(1, 0.7, 0.3);
      cheek.userData.noOutline = true;
      face.add(cheek);
    }
  }

  /**
   * Foil peeled back at the base, a paper wrapper band above it — the torso reads as
   * a continuation of the wrap rather than a plain costume slab. Sized against the
   * ACTUAL constructed torso mesh (via its bounding box) rather than hand-copied
   * layout constants, so this stays correct even if the shared rig's proportions
   * ever change.
   */
  private dressTorso(R: number): void {
    const torsoMesh = this.rig.torsoMesh!;
    torsoMesh.geometry.computeBoundingBox();
    const tb = torsoMesh.geometry.boundingBox!;
    const torsoBaseY = torsoMesh.position.y + tb.min.y;
    const torsoTopY = torsoMesh.position.y + tb.max.y;
    const torsoMaxX = tb.max.x;
    const torsoSpan = torsoTopY - torsoBaseY;

    const foilMat = toonMat({ color: FOIL, roughness: 0.25, metalness: 0.5 });
    const bandMat = toonMat({ color: WRAP_BAND, roughness: 0.72 });

    // Paper wrapper band, snug around the lower-mid torso.
    const band = new THREE.Mesh(
      new THREE.CylinderGeometry(torsoMaxX * 0.99, torsoMaxX * 1.03, torsoSpan * 0.2, 20, 1, true),
      bandMat
    );
    band.name = 'burrito_band';
    band.position.y = torsoBaseY + torsoSpan * 0.46;
    band.castShadow = true;
    band.receiveShadow = true;
    this.rig.joints.torso.add(band);

    // Foil collar hugging the torso base, just below the band. Sized up from round 1
    // (0.8/0.05 -> 0.98/0.075) — at the original size it was almost entirely hidden
    // behind the rig's own oversized hands from the front, reading as a thin sliver.
    const collar = new THREE.Mesh(
      new THREE.TorusGeometry(torsoMaxX * 0.98, R * 0.075, 8, 20),
      foilMat
    );
    collar.name = 'burrito_foil_collar';
    collar.rotation.x = Math.PI / 2;
    collar.position.y = torsoBaseY + torsoSpan * 0.06;
    collar.castShadow = true;
    collar.receiveShadow = true;
    this.rig.joints.torso.add(collar);

    // Peeled foil flaps below the collar — flared outward/down, alternating tilt so
    // they read as torn foil rather than a uniform skirt. Round 2 defect: evenly
    // spaced around the full 360 degrees, only one ever pointed anywhere near the
    // camera at a time, so the front view (the primary read) showed barely a sliver.
    // +X/+Z here maps to world a=0 -> +X (side), a=90 -> +Z (front) — so the angles
    // below are deliberately clustered around 90 deg to bias flaps toward the front
    // hemisphere, with two left at the back for coverage from behind.
    const flapAngles = [20, 55, 90, 125, 160, 245, 300].map((d) => THREE.MathUtils.degToRad(d));
    const flapGeo = new THREE.ConeGeometry(torsoMaxX * 0.42, torsoMaxX * 0.85, 3, 1, true);
    flapAngles.forEach((a, i) => {
      const pivot = new THREE.Group();
      pivot.position.set(Math.cos(a) * torsoMaxX * 0.78, torsoBaseY, Math.sin(a) * torsoMaxX * 0.78);
      pivot.rotation.y = -a;
      pivot.rotation.x = 0.5 + (i % 2) * 0.22;
      this.rig.joints.torso.add(pivot);

      const flap = new THREE.Mesh(flapGeo, foilMat);
      flap.name = 'burrito_foil_flap';
      flap.position.y = -torsoMaxX * 0.4;
      flap.castShadow = true;
      flap.receiveShadow = true;
      pivot.add(flap);
    });
  }

  protected onUpdate(ctx: AnimContext): void {
    this.rig.animate({
      elapsed: this.elapsed,
      move01: ctx.moveSpeed01,
      attack01: this.attackT >= 0 ? this.attackT / this.attackDuration : -1,
      hit01: this.hitT >= 0 ? this.hitT / 0.26 : -1,
      dead01: this.deathT >= 0 ? this.deathT / 0.75 : -1,
    });

    // A faint jiggle through the loose toppings while running, same cadence rig.ts
    // uses for the run bounce (10.5 rad/s) — cheap life, relative to each topping's
    // OWN rest rotation so it settles cleanly rather than drifting.
    const move = THREE.MathUtils.clamp(ctx.moveSpeed01, 0, 1);
    const wobble = Math.sin(this.elapsed * 10.5) * 0.06 * move;
    for (let i = 0; i < this.toppings.length; i++) {
      this.toppings[i].rotation.z = this.toppingBaseRotZ[i] + wobble * (i % 2 === 0 ? 1 : -1);
    }
  }

  /** The rig owns all body motion; the base class's whole-body pass would fight it. */
  protected applyBaseMotion(): void {}
}
