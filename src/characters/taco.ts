/**
 * Taco (Rare).
 *
 * Built on the shared ChibiRig — see `donut.ts` for the reference implementation of
 * this pattern. The rig supplies torso, arms, hands, legs, feet and all motion; this
 * file authors only the food mass on `rig.joints.head`, the face and a palette.
 *
 * Identity is fixed by `rules.ts`: Taco, Rare rarity, Filling Toss / Onion Bomb /
 * Double Toss. The written description ("trapezoid shell, jagged crimped top edge,
 * face floats outside the shell to the side") is a personality guide rather than a
 * literal spec, per the brief — but the trapezoid-with-crimped-top IS kept as the
 * silhouette landmark, since it is exactly the shape that reads as "hard-shell taco"
 * at a glance. The floating face is realised as a second, smaller fold of the same
 * toasted shell fused onto the main shell's edge rather than a literally detached
 * head: it still reads as "the face lives outside the shell, off to the side" (the
 * eyes/mouth are nowhere near the shell's own front face), but a chunk of it is
 * physically embedded in the main mass so it doesn't read as a floating defect.
 */

import * as THREE from 'three';
import { BaseCharacter, type AnimContext } from './types';
import type { CharacterDef } from '../game/rules';
import { PALETTE } from '../game/rules';
import { toonMat, glossyMat, flatMat, outlineGroup, roundedBox } from '../render/toon';
import { ChibiRig } from './rig';

// ── Palette ──────────────────────────────────────────────────────────────────
const SHELL = '#F2A73E';       // toasted hard-shell gold — bright, saturated
const SHELL_DARK = '#D07F1E';  // shadow / crease tone
const POD = '#F7BB57';         // the face-pod fold — a shade warmer/lighter than the shell
const MEAT = PALETTE.patty;        // '#6B3E26'
const MEAT_DARK = PALETTE.pattyDark; // '#4E2C1B'
const TOMATO = PALETTE.tomato;       // '#E63946'
const LETTUCE = '#8FCB1E';
const LETTUCE_DARK = '#6FA112';
const ONION = '#AD82D6';       // ties visually to the Onion Bomb projectile colour — kept saturated
                                // enough not to read as another tomato bit at a glance
// Limb-only rust family. A second independent art-director pass found Hamburger's
// bun-amber, Donut's dough-tan and Taco's own shell-gold all sitting in the same
// golden-orange hue band despite different heads — the "one templated body" read
// survived per-character geometry because every limb was still the same colour
// family. The HEAD keeps its golden shell (that's the "hard taco shell" read), but
// the limbs shift to a deeper, redder terracotta — extra-crispy fried-edge shell —
// which is a distinctly different hue from both castmates above.
const LIMB_SHELL = '#C1522B';
const LIMB_SHELL_DARK = '#8F3A1D';

/**
 * Trapezoid shell outline: a narrow crease at the bottom (the fold) widening to an
 * open mouth at the top, with a jagged zigzag baked directly into the top edge. Baking
 * the crimp into the outline (rather than gluing separate teeth on afterward) means
 * the whole shell — crimp included — is one solid mesh that can never read as toppings
 * floating detached from the surface they should sit on.
 */
function tacoShellShape(halfWBot: number, halfWTop: number, yBot: number, yTop: number, teeth: number, toothH: number): THREE.Shape {
  const shape = new THREE.Shape();
  shape.moveTo(-halfWBot, yBot);
  shape.lineTo(-halfWTop, yTop);
  const span = halfWTop * 2;
  for (let i = 0; i <= teeth; i++) {
    const x = -halfWTop + (span * i) / teeth;
    const peak = i % 2 === 0;
    const h = peak ? toothH * (0.7 + 0.45 * Math.abs(Math.sin(i * 1.9))) : toothH * 0.24;
    shape.lineTo(x, yTop + h);
  }
  shape.lineTo(halfWTop, yTop);
  shape.lineTo(halfWBot, yBot);
  shape.lineTo(-halfWBot, yBot);
  return shape;
}

/**
 * A rounded limb segment, like a capsule but with INDEPENDENT top and bottom
 * radii, hanging DOWN from the joint origin (spans y=0..-len) — the orientation
 * `dressLimbs()` expects. Local to this file; see `hamburger.ts` for the
 * reference copy. Taco's own call sites use a low `radialSegments` and a
 * flattened Z scale so the limb reads as a faceted, crunchy shell shard rather
 * than the smooth rubbery capsule every other character in the cast would get
 * from the same helper at default settings.
 */
function taperedSegment(len: number, rTop: number, rBot: number, radialSegments = 12): THREE.BufferGeometry {
  // Profile MUST be wound bottom-to-top (y increasing), matching every other
  // lathe helper in this cast (`bunDome`, `roundedPuck` in `hamburger.ts`) —
  // LatheGeometry's face winding (and therefore `computeVertexNormals`'s
  // outward-vs-inward call) depends on point order, not just point position. An
  // earlier version of this function built the profile top-to-bottom and every
  // limb using it rendered near-black: inverted normals facing away from the
  // light. The y=0/y=-len hang-down placement is unchanged.
  const capSegs = 4;
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

export class TacoCharacter extends BaseCharacter {
  private rig: ChibiRig;
  private fillings: THREE.Object3D[] = [];
  private fillingBaseRotZ: number[] = [];

  constructor(def: CharacterDef) {
    super(def);

    this.rig = new ChibiRig({
      palette: {
        limb: LIMB_SHELL,
        hand: ONION,  // saturated purple — ties to Onion Bomb, breaks from the cast's
                       // repeated cream/white mitt, per the same review pass above
        foot: SHELL_DARK,
        torso: SHELL,
        limbRoughness: 0.8,
      },
      // Lean and angular, longer limbs, narrow stance. `height` runs well above the
      // 2.1m cast norm — since arm/leg LENGTH is a fixed fraction of `height` in the
      // shared rig, that's the only way to buy a genuinely longer-limbed read — while
      // a smaller `headFraction` keeps overall silhouette height close to the cast
      // norm rather than making Taco a giant. Radii and stance both pulled in hard for
      // the angular, narrow-framed read.
      proportions: {
        height: 2.30,
        headFraction: 0.40,
        armRadius: 0.097,
        handRadius: 0.133,
        legRadius: 0.106,
        shoulderWidth: 0.414,
        stanceWidth: 0.179,
      },
    });
    this.body.add(this.rig.joints.root);
    this.head = this.rig.joints.head;

    const R = this.rig.headRadius;
    const head = this.rig.joints.head;

    // ── Materials ────────────────────────────────────────────────────────────
    // Every filling gets its own roughness so the fold reads as bread + seared meat +
    // wet vegetables rather than one glossy plastic shader repeated in different hues.
    const shellMat = toonMat({ color: SHELL, roughness: 0.8 });        // crisp, dry, fried shell
    const shellDarkMat = toonMat({ color: SHELL_DARK, roughness: 0.8 });
    const podMat = toonMat({ color: POD, roughness: 0.76 });
    const meatMat = toonMat({ color: MEAT, roughness: 0.55 });         // seared, faintly greasy
    const meatDarkMat = toonMat({ color: MEAT_DARK, roughness: 0.5 });
    const tomatoMat = glossyMat({ color: TOMATO, roughness: 0.18 });   // wettest surface on the model
    const lettuceMatA = toonMat({ color: LETTUCE, roughness: 0.6 });   // leafy, satin not shiny
    const lettuceMatB = toonMat({ color: LETTUCE_DARK, roughness: 0.6 });
    const onionMat = glossyMat({ color: ONION, roughness: 0.32 });     // moist, faintly translucent

    // ── Shell ────────────────────────────────────────────────────────────────
    // A wide, jagged-topped trapezoid — the "hard shell taco" read at a glance — but
    // NOT one flat panel. Round 1 built it as a single extruded slab and it disappeared
    // to a thin featureless blade from every angle except near-front (idle_135/210
    // showed nothing but a flat gold triangle). Fixed by splitting it into two full
    // panels hinged at the bottom crease and tilted apart around that hinge like an
    // open book: the front wall leans toward the camera, the back wall leans away.
    // From the front this still reads as a solid shell; from the side/back the "V"
    // itself is now the silhouette, with real width in every direction.
    //
    // ── Head-attachment fix (floating-head defect) ──────────────────────────
    // `ChibiRig.headCentreY` places the head group's own origin at
    // `torsoTopY + 0.86*R`, which assumes a mass extending roughly symmetrically
    // ±R about that origin (true for a sphere-like donut ring or egg shell) —
    // the same trap `hamburger.ts` and `hotdog.ts` document. The shell's hinge
    // crease (its lowest point, at `yBot`) sits at head-local y = `hingeY`, so
    // its ABSOLUTE y is `headCentreY + hingeY`. At the old `yBot = -R*0.85` that
    // put the crease almost exactly ON `torsoTopY` (0.86R - 0.85R ≈ 0.01R) —
    // which looks right IF the torso actually reached its own full nominal
    // height. It doesn't: `dressTorso`'s `size.h` is read off the RIG's default
    // torso mesh bounding box, which only spans ~0.92 of the real torso height
    // (the sphere-derived default tapers before its poles), and this file's own
    // torso fold shape only climbs to ~0.82-0.94 of THAT already-short `size.h`
    // before its crimp teeth. Net effect: the tallest point of the dressed torso
    // fold lands a good 15-20% of the torso height below `torsoTopY` — exactly
    // the visible gap between shell and body the brief calls out, and it was
    // invisible dead-on (idle_0) but opened up at yaw/mid-stride because the
    // hinge crease is a narrow line (`halfWBot` wide), not a flat base, so a
    // small viewing-angle change is enough to see past it into the gap behind.
    // Fix: push the hinge crease further down (more negative `yBot`) so it sinks
    // safely BELOW the torso fold's own tallest crimp teeth instead of sitting
    // exactly at the torso's theoretical (but unreached) full height — the same
    // "anchor the mass's own underside, not the rig's assumed centre" reasoning
    // hamburger's BASE_Y and hotdog's neck block both use. `yTopBase` (the
    // shell's opening/pod region) is untouched, so the visible silhouette above
    // the crease — fillings, pod, face — is unaffected; only the hidden portion
    // below the opening gets longer, self-embedding into the torso fold.
    const halfWBot = R * 0.16;
    const halfWTop = R * 0.92;
    const yBot = -R * 1.20;
    const yTopBase = R * 0.55;
    const panelThickness = R * 0.16;
    const tilt = 0.44; // radians each panel splays from vertical
    const hingeY = yBot;

    const shellShape = tacoShellShape(halfWBot, halfWTop, yBot, yTopBase, 9, R * 0.3);
    const shellGeo = new THREE.ExtrudeGeometry(shellShape, {
      depth: panelThickness, bevelEnabled: false, curveSegments: 1,
    });
    shellGeo.translate(0, 0, -panelThickness / 2);
    shellGeo.computeVertexNormals();

    // Front wall — the dominant, camera-facing panel. Everything else (fillings, the
    // face pod) is parented under it so those features inherit its tilt for free and
    // stay correctly attached at every angle instead of needing separate hinge math.
    const frontPivot = new THREE.Group();
    frontPivot.name = 'shell_front_pivot';
    frontPivot.position.set(0, hingeY, 0);
    frontPivot.rotation.x = tilt;
    head.add(frontPivot);
    const frontMesh = new THREE.Mesh(shellGeo, shellMat);
    frontMesh.name = 'taco_shell_front';
    frontMesh.position.set(0, -hingeY, 0); // re-centres the shape's own yBot back onto the hinge
    frontMesh.castShadow = true;
    frontMesh.receiveShadow = true;
    frontPivot.add(frontMesh);

    // Back wall — same geometry, tilted the opposite way, a shade darker so it reads
    // as the shadowed inner wall of the fold rather than a plain duplicate.
    const backPivot = new THREE.Group();
    backPivot.name = 'shell_back_pivot';
    backPivot.position.set(0, hingeY, 0);
    backPivot.rotation.x = -tilt;
    head.add(backPivot);
    const backMesh = new THREE.Mesh(shellGeo, shellDarkMat);
    backMesh.name = 'taco_shell_back';
    backMesh.position.set(0, -hingeY, 0);
    backMesh.castShadow = true;
    backMesh.receiveShadow = true;
    backPivot.add(backMesh);

    // ── Fillings: meat, tomato, lettuce, a wink of onion ────────────────────────
    // Sit in the gap between the two walls (z spans from the back wall toward the
    // front one), embedded into whichever wall they're closest to so nothing reads as
    // floating. Positions are given in "natural" (untilted) head-space coordinates —
    // the fillings themselves stay untilted, independent of either wall, which is
    // exactly right for something loose sitting in the pocket between them.
    // Round 2 defect: meat sat too low/shallow (fy<=0.28, fz<=0.2) and was completely
    // hidden behind the front wall's crimp from every camera angle tested — only the
    // lettuce read. Raised into the same upper "peeking over the crimp" band the
    // lettuce and tomato occupy, low RGB choices swapped for a bit of extra spread so
    // it still forms a visible base layer under them rather than an equal-height mush.
    const meatSpots: Array<[number, number, number, THREE.Material]> = [
      [-0.5, 0.3, 0.24, meatMat], [-0.1, 0.46, 0.32, meatDarkMat], [0.3, 0.34, 0.22, meatMat],
      [0.58, 0.2, 0.14, meatDarkMat], [0.0, 0.2, 0.3, meatMat], [-0.32, 0.16, 0.14, meatDarkMat],
    ];
    for (const [fx, fy, fz, mat] of meatSpots) {
      const blob = new THREE.Mesh(new THREE.SphereGeometry(R * 0.22, 12, 10), mat);
      blob.name = 'taco_meat';
      blob.scale.set(1.15, 0.85, 0.9);
      blob.position.set(fx * halfWTop, fy * R, fz * R);
      blob.castShadow = true;
      blob.receiveShadow = true;
      head.add(blob);
      this.fillings.push(blob);
      this.fillingBaseRotZ.push(blob.rotation.z);
    }

    const tomatoSpots: Array<[number, number, number]> = [
      [-0.62, 0.46, 0.3], [-0.24, 0.52, 0.36], [0.14, 0.48, 0.32],
      [0.46, 0.42, 0.22], [0.6, 0.28, 0.16], [-0.46, 0.3, 0.12],
    ];
    for (const [fx, fy, fz] of tomatoSpots) {
      const bit = new THREE.Mesh(new THREE.BoxGeometry(R * 0.19, R * 0.19, R * 0.19), tomatoMat);
      bit.name = 'taco_tomato';
      bit.position.set(fx * halfWTop, fy * R, fz * R);
      bit.rotation.set(0.3, 0.5, 0.2 + fx);
      bit.castShadow = true;
      bit.receiveShadow = true;
      head.add(bit);
      this.fillings.push(bit);
      this.fillingBaseRotZ.push(bit.rotation.z);
    }

    const lettuceSpots: Array<[number, number, number, number]> = [
      [-0.74, 0.52, 0.16, 0.3], [-0.42, 0.6, 0.32, -0.15], [-0.12, 0.64, 0.22, 0.25], [0.18, 0.62, 0.34, -0.2],
      [0.44, 0.56, 0.14, 0.2], [0.7, 0.48, -0.04, -0.25], [-0.58, 0.38, -0.06, 0.1], [0.56, 0.32, -0.08, -0.1],
    ];
    for (let i = 0; i < lettuceSpots.length; i++) {
      const [fx, fy, fz, tilt2] = lettuceSpots[i];
      const shred = new THREE.Mesh(new THREE.CapsuleGeometry(R * 0.045, R * 0.26, 4, 6), i % 2 === 0 ? lettuceMatA : lettuceMatB);
      shred.name = 'taco_lettuce';
      shred.position.set(fx * halfWTop, fy * R, fz * R);
      shred.rotation.set(Math.PI / 2 + tilt2 * 0.6, 0, tilt2);
      shred.castShadow = true;
      shred.receiveShadow = true;
      head.add(shred);
      this.fillings.push(shred);
      this.fillingBaseRotZ.push(shred.rotation.z);
    }

    // A few onion slivers tucked among the meat — ties visually to the Onion Bomb
    // ability's projectile colour. Raised alongside the meat fix above (round 2 had
    // these buried too), and enlarged in round 4 — at the original R*0.1/R*0.028 size
    // they were nearly invisible against the meat, the one filling that didn't
    // register at gameplay distance.
    const onionSpots: Array<[number, number, number]> = [[-0.22, 0.42, 0.3], [0.36, 0.48, 0.34], [0.06, 0.24, 0.38]];
    for (const [fx, fy, fz] of onionSpots) {
      const sliver = new THREE.Mesh(new THREE.TorusGeometry(R * 0.14, R * 0.042, 6, 12, Math.PI * 1.3), onionMat);
      sliver.name = 'taco_onion';
      sliver.position.set(fx * halfWTop, fy * R, fz * R);
      sliver.rotation.set(0.4, 0.7, fx);
      sliver.castShadow = true;
      sliver.receiveShadow = true;
      head.add(sliver);
      this.fillings.push(sliver);
      this.fillingBaseRotZ.push(sliver.rotation.z);
    }

    // ── Face pod ─────────────────────────────────────────────────────────────
    // A second, smaller fold of shell fused onto the front wall's right edge — well
    // embedded (its centre sits inside the wall's own footprint), with roughly a third
    // of its volume protruding, so the landmark is unmistakably attached rather than
    // literally floating, while still reading as its own lobe living outside the main
    // shell surface. Parented under the front wall so it inherits the fold's tilt.
    const podR = R * 0.4;
    const podCenter = new THREE.Vector3(R * 0.55, R * 0.18, R * 0.08);
    const pod = new THREE.Mesh(new THREE.SphereGeometry(podR, 20, 16), podMat);
    pod.name = 'taco_face_pod';
    pod.scale.set(1, 1.04, 0.92);
    pod.position.copy(podCenter);
    pod.castShadow = true;
    pod.receiveShadow = true;
    frontMesh.add(pod);

    // A few small crimp teeth along the pod's upper-outer rim, echoing the main
    // shell's zigzag in miniature — without these the pod read as a plain ball
    // stuck to the character rather than another fold of the same toasted shell.
    // A cone's origin is its geometric CENTRE (half the height either side), so to
    // get a tip that actually pokes past the sphere surface the object must be
    // centred AT that surface (radius podR), not pulled inward — the first attempt
    // put the centre at 0.82*podR, which left the tip at just 0.97*podR: fully
    // swallowed by the sphere and invisible.
    const toothGeo = new THREE.ConeGeometry(podR * 0.14, podR * 0.34, 4);
    for (let i = 0; i < 4; i++) {
      const a = -0.55 + i * 0.42; // sweeps the upper-outer quarter, toward +X/+Z
      const dir = new THREE.Vector3(Math.sin(a) * 0.9, 0.62, Math.cos(a) * 0.55 + 0.35).normalize();
      const tooth = new THREE.Mesh(toothGeo, shellDarkMat);
      tooth.name = 'taco_pod_crimp';
      tooth.position.copy(dir).multiplyScalar(podR * 1.0);
      tooth.quaternion.setFromUnitVectors(new THREE.Vector3(0, 1, 0), dir);
      tooth.castShadow = true;
      pod.add(tooth);
    }

    // `face` normally rides the head's own front surface; nothing in the rig's
    // per-frame animate() ever touches its transform, so re-parenting it onto the
    // front wall (it inherits the tilt) and re-anchoring it onto the pod is safe, and
    // keeps every feature below in simple pod-local coordinates.
    frontMesh.add(this.rig.joints.face);
    this.rig.joints.face.position.copy(podCenter);
    this.buildFace(podR);

    // ── Torso: a second, smaller shell fold, not the rig's bare default ball ──
    // Taco never authored a torso, so it was rendering the shared rig's plain
    // default sphere underneath its shell head — on a cast where every other
    // character dresses its torso, an undressed default ball is exactly the
    // "one templated body" tell a second independent art-director pass warned
    // about, and the most obvious one in the whole roster. This is the same
    // trapezoid, crimped-top fold language as the head shell and the face pod,
    // just smaller, so the body keeps building on the same food identity instead
    // of exposing the shared rig underneath it.
    this.rig.dressTorso((size) => {
      const group = new THREE.Group();
      group.name = 'taco_torso_fold';
      const halfWBotT = size.w * 0.16;
      const halfWTopT = size.w * 0.50;
      const toothHT = size.h * 0.10;
      const shapeT = tacoShellShape(halfWBotT, halfWTopT, 0, size.h * 0.82, 6, toothHT);
      const thicknessT = size.d * 0.85;
      const geoT = new THREE.ExtrudeGeometry(shapeT, { depth: thicknessT, bevelEnabled: false, curveSegments: 1 });
      geoT.translate(0, 0, -thicknessT / 2);
      geoT.computeVertexNormals();
      const mesh = new THREE.Mesh(geoT, shellMat);
      mesh.name = 'taco_torso_fold_mesh';
      mesh.castShadow = true;
      mesh.receiveShadow = true;
      group.add(mesh);
      return group;
    });

    // ── Limbs: bespoke, not the shared rig defaults ───────────────────────────
    // An independent art director named the rig's identical capsule-arm/ball-hand/
    // wedge-foot kit as the single biggest "template" tell across the whole cast.
    // Taco's limbs are hard shell, not soft dough: faceted (low radial segment
    // count) and flattened into shard-like cross-sections, with a couple of the
    // pod's own crimp teeth glued onto the hand — the same toasted-shell language
    // as the head, not a generic mitt.
    const limbShellMat = toonMat({ color: LIMB_SHELL, roughness: 0.78 });
    const limbShellDarkMat = toonMat({ color: LIMB_SHELL_DARK, roughness: 0.78 });
    const mittMat = glossyMat({ color: ONION, roughness: 0.32 });
    const toothGeoSmall = new THREE.ConeGeometry(R * 0.05, R * 0.12, 4);
    this.rig.dressLimbs((part, size) => {
      switch (part) {
        case 'upperArmL': case 'upperArmR':
        case 'thighL': case 'thighR': {
          const m = new THREE.Mesh(taperedSegment(size.len, size.radius * 1.05, size.radius * 0.8, 6), limbShellMat);
          m.scale.z = 0.62;
          m.name = `${part}_mesh`;
          m.castShadow = true;
          m.receiveShadow = true;
          return m;
        }
        case 'forearmL': case 'forearmR':
        case 'shinL': case 'shinR': {
          const m = new THREE.Mesh(taperedSegment(size.len, size.radius * 0.8, size.radius * 0.6, 6), limbShellDarkMat);
          m.scale.z = 0.62;
          m.name = `${part}_mesh`;
          m.castShadow = true;
          m.receiveShadow = true;
          return m;
        }
        case 'handL': case 'handR': {
          const g = new THREE.Group();
          const fist = new THREE.Mesh(new THREE.IcosahedronGeometry(size.radius * 0.92, 0), mittMat);
          fist.position.y = -size.radius * 0.9;
          fist.scale.z = 0.75;
          fist.name = `${part}_mesh`;
          fist.castShadow = true;
          fist.receiveShadow = true;
          g.add(fist);
          for (const sx of [-1, 1]) {
            const tooth = new THREE.Mesh(toothGeoSmall, limbShellDarkMat);
            tooth.position.set(sx * size.radius * 0.5, -size.radius * 1.5, size.radius * 0.2);
            tooth.rotation.z = sx * 0.5;
            tooth.castShadow = true;
            g.add(tooth);
          }
          return g;
        }
        case 'footL': case 'footR': {
          const foot = new THREE.Mesh(
            roundedBox(size.radius * 2.2, size.len * 0.85, size.radius * 2.6, size.radius * 0.22, 3),
            limbShellDarkMat
          );
          foot.position.set(0, -size.len * 0.5, size.radius * 0.55);
          foot.name = `${part}_mesh`;
          foot.castShadow = true;
          foot.receiveShadow = true;
          return foot;
        }
        default:
          return null;
      }
    });

    outlineGroup(this.root);
    this.collectFlashTargets();
    this.rig.restPose();
  }

  /**
   * Oversized, slightly asymmetric eyes plus a crooked grin — a cheeky, spice-loving
   * personality that matches a taco throwing filling and onion bombs. Built as real
   * shaded geometry with depth, not flat decals, per the relaxed face convention.
   */
  private buildFace(podR: number): void {
    const face = this.rig.joints.face;
    const ink = PALETTE.ink;
    const eyeMat = toonMat({ color: ink, roughness: 0.25 });
    const browMat = toonMat({ color: SHELL_DARK, roughness: 0.7 });

    // Round 2 defect: at offset 0.4*podR with radii up to 0.46*podR each, the two eyes'
    // combined radius (0.84*podR) exceeded their 0.8*podR separation and they visually
    // fused into one dark mass. Pushed further apart and shrunk slightly so there's a
    // clear gap of bare "skin" between them.
    // An independent art director flagged mismatched pupil sizes elsewhere in this
    // cast as reading like a placement error rather than a deliberate choice. A
    // ~20% size difference between the two eyes here was exactly that: too subtle
    // to clearly read as a wink, easy to mistake for a mistake. Eyes are now the
    // SAME size on both sides; the single raised eyebrow below (over the left eye
    // only) carries the "mischievous, about to throw something spicy" asymmetry
    // instead, and a raised brow is unambiguous in a way a slightly smaller pupil
    // is not.
    const eyeSize = 0.33;
    for (const sx of [-1, 1]) {
      const eye = new THREE.Mesh(new THREE.SphereGeometry(podR * eyeSize, 16, 14), eyeMat);
      eye.position.set(sx * podR * 0.52, podR * 0.14, podR * 0.68);
      eye.scale.set(1, 1.2, 0.6);
      eye.castShadow = true;
      face.add(eye);

      const glint = new THREE.Mesh(new THREE.SphereGeometry(podR * 0.11, 10, 8), flatMat('#ffffff'));
      glint.position.set(sx * podR * 0.52 - podR * 0.08, podR * 0.24, podR * 0.82);
      glint.userData.noOutline = true;
      face.add(glint);
    }

    // One eyebrow cocked up over the left eye — a mischievous, "about to throw
    // something spicy" look. Round 2 defect: placed at a z-depth (0.68*podR) shallower
    // than the pod sphere's own surface at that (x,y) (~0.76*podR), so it was buried
    // almost entirely inside the pod and invisible. Pushed out just proud of the true
    // surface instead of a flat guessed offset.
    const browX = -podR * 0.52;
    const browY = podR * 0.42;
    const browSurfaceZ = podR * Math.sqrt(Math.max(0, 1 - (browX / podR) ** 2 - (browY / podR) ** 2));
    const brow = new THREE.Mesh(
      new THREE.CapsuleGeometry(podR * 0.055, podR * 0.3, 4, 8),
      browMat
    );
    brow.name = 'brow';
    brow.position.set(browX, browY, browSurfaceZ + podR * 0.05);
    brow.rotation.z = Math.PI / 2 + 0.35;
    brow.castShadow = true;
    face.add(brow);

    // A second, calmer brow over the right eye — flatter, lower, barely angled. A
    // second independent art-director pass flagged bare, brow-less eyes elsewhere in
    // the cast as reading "unfinished" rather than deliberate; this eye now has a real
    // brow too, it's just NOT the one doing the acting, so the mischievous raise above
    // stays unambiguous instead of reading as two brows that happen to differ.
    const browX2 = podR * 0.52;
    const browY2 = podR * 0.30;
    const browSurfaceZ2 = podR * Math.sqrt(Math.max(0, 1 - (browX2 / podR) ** 2 - (browY2 / podR) ** 2));
    const brow2 = new THREE.Mesh(
      new THREE.CapsuleGeometry(podR * 0.05, podR * 0.28, 4, 8),
      browMat
    );
    brow2.name = 'brow';
    brow2.position.set(browX2, browY2, browSurfaceZ2 + podR * 0.05);
    brow2.rotation.z = Math.PI / 2 - 0.06;
    brow2.castShadow = true;
    face.add(brow2);

    // Crooked, wide-open grin.
    const smile = new THREE.Mesh(
      new THREE.TorusGeometry(podR * 0.42, podR * 0.09, 8, 20, Math.PI * 0.8),
      toonMat({ color: ink, roughness: 0.3 })
    );
    smile.position.set(podR * 0.04, -podR * 0.42, podR * 0.6);
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

    // A faint jiggle through the loose fillings while running — cheap life, matches
    // the run bounce cadence from rig.ts (10.5 rad/s). Set relative to each filling's
    // OWN rest rotation every frame (never accumulated) so it settles cleanly back to
    // rest at move=0 instead of drifting.
    const move = THREE.MathUtils.clamp(ctx.moveSpeed01, 0, 1);
    const wobble = Math.sin(this.elapsed * 10.5) * 0.05 * move;
    for (let i = 0; i < this.fillings.length; i++) {
      this.fillings[i].rotation.z = this.fillingBaseRotZ[i] + wobble * (i % 2 === 0 ? 1 : -1);
    }
  }

  /** The rig owns all body motion; the base class's whole-body pass would fight it. */
  protected applyBaseMotion(): void {}
}
