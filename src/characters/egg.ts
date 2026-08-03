/**
 * Egg (Neon).
 *
 * Built on the shared ChibiRig per `donut.ts`. The rig supplies torso, arms,
 * hands, legs, feet and all motion; this file authors:
 *
 *   - a true ovoid shell (not a sphere) — fuller/rounded at the bottom, tapering
 *     to a narrower rounded crown at top, the classic egg silhouette
 *   - a zigzag crack running from the crown down the character's right side —
 *     her single unmistakable landmark, foreshadowing Hatch!/Shell Shards
 *   - a thin glowing seam inside that crack, the Neon-rarity accent, plus a
 *     small glossy peek of yolk at the crack's tip
 *   - open eyes with catchlights, worried brow creases, and a straight,
 *     deadpan mouth
 *
 * `shellPoint()`/`eggSurface()` are the one source of truth for the shell's
 * curved surface: the shell mesh is built by displacing a unit sphere through
 * `shellPoint`, and every decal (crack, eyes, brows, mouth, yolk peek) is placed
 * through the same function. That is what stops decals from floating off the
 * surface or sinking into it when the taper/bulge constants are retuned — the
 * same lesson `hamburger.ts`'s `crownSurface()` encodes for its bun dome.
 */

import * as THREE from 'three';
import { BaseCharacter, type AnimContext } from './types';
import type { CharacterDef } from '../game/rules';
import { PALETTE, RARITY_COLORS } from '../game/rules';
import { toonMat, glossyMat, flatMat, outlineGroup, roundedBox } from '../render/toon';
import { ChibiRig } from './rig';

const SHELL = PALETTE.egg;          // #FFF8EA — matte-ish porcelain
const SHELL_SHADOW = '#E4D6AE';     // faint brow-crease shadow, subtle on purpose
const CRACK_DARK = '#7C5530';       // the crack itself — needs real value contrast against
                                     // the pale shell or it reads as a stray highlight, not a break
const YOLK = '#FFC23C';             // glossy peek at the crack tip
const NEON_ACCENT = RARITY_COLORS.Neon; // #FF2FD0 — Egg's rarity accent, used ONLY on the crack seam
const INK = PALETTE.ink;
// Limb-only pale-lilac family. A second independent art-director pass named Egg,
// Burrito and Lollipop as all converging on pale cream/white limbs with dark
// boots — the shell itself stays near-white (that IS the egg read), but the limbs
// shift to a soft lilac tint of her own Neon accent so the body carries real hue
// distinct from the shell, instead of reading as one undifferentiated pale mass.
const LIMB_LILAC = '#E4C2E8';
const LIMB_LILAC_SHADOW = '#CB9ED4';

// ─────────────────────────────────────────────────────────────────────────────
// Shell surface — single source of truth for both the mesh and every decal.
// ─────────────────────────────────────────────────────────────────────────────

/** How sharply the crown narrows toward the top pole. */
const TOP_TAPER = 0.42;
/** How much the shell bulges below the equator — the "fuller at the bottom" read. */
const BOTTOM_BULGE = 0.16;
/** Overall vertical elongation, taller than it is wide like a real egg. Kept modest —
 * an earlier pass at 1.08 pushed idle height to 2.26m, visibly off the 2.1m cast norm. */
const VERT_SCALE = 1.04;

/** Unit direction from spherical angles. theta=0 is character-front (+Z),
 * increasing toward +X (her right). phi=0 is the top pole, phi=PI the bottom. */
function dirFromAngles(theta: number, phi: number): THREE.Vector3 {
  const s = Math.sin(phi);
  return new THREE.Vector3(s * Math.sin(theta), Math.cos(phi), s * Math.cos(theta));
}

/** Maps a unit sphere direction to the actual egg-shell point at that direction,
 * scaled to radius R. Narrows above the equator, bulges below it. */
function shellPoint(dir: THREE.Vector3, R: number): THREE.Vector3 {
  const ny = dir.y;
  const scaleXZ = ny >= 0
    ? 1 - TOP_TAPER * Math.pow(ny, 1.7)
    : 1 + BOTTOM_BULGE * Math.sin(Math.PI * Math.min(1, -ny));
  return new THREE.Vector3(dir.x * scaleXZ, ny * VERT_SCALE, dir.z * scaleXZ).multiplyScalar(R);
}

/** Exact surface point + outward normal at (theta, phi), via finite differences
 * of `shellPoint` — the curved-surface analogue of `hamburger.ts`'s crownSurface. */
function eggSurface(theta: number, phi: number, R: number): { pos: THREE.Vector3; normal: THREE.Vector3 } {
  const d = 0.015;
  const p0 = shellPoint(dirFromAngles(theta, phi), R);
  const pT = shellPoint(dirFromAngles(theta + d, phi), R);
  const pP = shellPoint(dirFromAngles(theta, phi + d), R);
  const normal = pT.clone().sub(p0).cross(pP.clone().sub(p0)).normalize();
  if (normal.dot(p0) < 0) normal.negate();
  return { pos: p0, normal };
}

/** A group flush against the shell surface at (theta, phi), pushed out along the
 * normal by `embed` so a decal sits just proud of the surface. Local +Z is the
 * outward normal — used for compact, roughly front-facing features (eyes, brow
 * creases, mouth) where the residual twist from `setFromUnitVectors` is invisible. */
function addShellDecal(parent: THREE.Object3D, theta: number, phi: number, embed: number, R: number): THREE.Group {
  const { pos, normal } = eggSurface(theta, phi, R);
  const g = new THREE.Group();
  g.position.copy(pos).addScaledVector(normal, embed);
  g.quaternion.setFromUnitVectors(new THREE.Vector3(0, 0, 1), normal);
  parent.add(g);
  return g;
}

/** Path (theta, phi-as-fraction-of-PI) for the crack landmark: a short, bold
 * zigzag on the temple/cheek, well clear of the eyes (theta ±0.50) and mouth
 * (theta 0) so it reads as a distinct scar rather than crowding the face.
 *
 * Two defects compounded here. First, this originally ran theta 1.20-1.48 —
 * nearly 90° round from front (the profile edge). At that theta the surface
 * normal is almost perpendicular to the default camera, so the curved shading
 * cue that makes every other decal (eyes, brows, mouth) read as "sitting on a
 * dome" disappears: the segments render against the flat, blown-out rim-light
 * band with no surrounding shell context, which read as a stray stick floating
 * beside the head rather than a crack IN it. Second, only 3 long segments with
 * large (~0.27 rad) theta swings drew one bold "V"/lightning-bolt shape, not a
 * crack — real fractures are made of several SHORT irregular jags, not two
 * long straight strokes. Fixed both: pulled in to theta 0.66-0.86 (clearly on
 * the visible frontal dome, still outside the eyes' ±0.50 clear zone) and
 * split into 5 short segments with small (~0.12-0.18 rad) alternating jags. */
const CRACK_PATH: Array<[theta: number, phiFrac: number]> = [
  [0.74, 0.13], [0.86, 0.19], [0.68, 0.24], [0.84, 0.30], [0.70, 0.36], [0.83, 0.41],
];

/** Continuation of the crack onto the torso shell, same side (character's right
 * front), near the top where it emerges from under the neck. `eggSurface` and
 * `buildCrackLine` are both already generic in R, so this reuses them verbatim
 * against the torso's own smaller shell radius. Theta band matches the
 * repositioned `CRACK_PATH` above so the two segments read as one continuous
 * crack running from head to torso instead of jumping sideways at the neck. */
const TORSO_CRACK_PATH: Array<[theta: number, phiFrac: number]> = [
  [0.80, 0.05], [0.68, 0.10], [0.82, 0.16],
];

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

/**
 * A jagged crack line: a chain of thin boxes, each built its own oriented basis
 * from the tangent between consecutive surface points and the averaged normal,
 * so every segment sits flush against the curved shell instead of floating off
 * it or clipping through it — the failure mode explicitly flagged in review.
 */
function buildCrackLine(
  head: THREE.Group,
  R: number,
  path: Array<[number, number]>,
  opts: { thickness: number; embed: number; color: string; roughness: number; emissive?: string; emissiveIntensity?: number }
): void {
  const mat = toonMat({ color: opts.color, roughness: opts.roughness, emissive: opts.emissive, emissiveIntensity: opts.emissiveIntensity });
  const pts = path.map(([theta, phiFrac]) => eggSurface(theta, phiFrac * Math.PI, R));

  for (let i = 0; i < pts.length - 1; i++) {
    const a = pts[i];
    const b = pts[i + 1];
    const mid = a.pos.clone().add(b.pos).multiplyScalar(0.5);
    const normal = a.normal.clone().add(b.normal).normalize();
    const dirVec = b.pos.clone().sub(a.pos);
    const length = dirVec.length();
    dirVec.normalize();
    const xAxis = dirVec.clone().sub(normal.clone().multiplyScalar(dirVec.dot(normal))).normalize();
    const yAxis = normal.clone().cross(xAxis).normalize();
    const quat = new THREE.Quaternion().setFromRotationMatrix(new THREE.Matrix4().makeBasis(xAxis, yAxis, normal));

    // Taper the two end segments so the crack fades rather than stopping abruptly.
    const taper = i === 0 || i === pts.length - 2 ? 0.65 : 1;
    // Kept deliberately flat (shallow Z/normal depth) — an earlier pass used a
    // near-cubic cross-section whose own proud depth was enough to bury the
    // thinner glow line laid on top of it, so the "glow" never actually showed.
    const seg = new THREE.Mesh(
      new THREE.BoxGeometry(length * 1.2, opts.thickness * taper, opts.thickness * 0.16),
      mat
    );
    seg.position.copy(mid).addScaledVector(normal, opts.embed);
    seg.quaternion.copy(quat);
    seg.userData.noOutline = true; // thin decal — an inverted-hull outline would read as a chunky sticker
    seg.castShadow = true;
    head.add(seg);
  }
}

/**
 * A rounded limb segment, like a capsule but with INDEPENDENT top and bottom
 * radii, hanging DOWN from the joint origin (spans y=0..-len) — the orientation
 * `dressLimbs()` expects. Local to this file; see `hamburger.ts` for the
 * reference copy. Egg's own call sites pass radii noticeably SMALLER than
 * `size.radius` — she is a small, delicate character, and the rig's default
 * limb thickness read as too stocky for that.
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

export class EggCharacter extends BaseCharacter {
  private rig: ChibiRig;

  constructor(def: CharacterDef) {
    super(def);

    this.rig = new ChibiRig({
      palette: {
        limb: LIMB_LILAC,
        // Hand/foot were both pale near-whites barely a shade off the shell —
        // the exact "one undifferentiated mass" failure called out in review.
        // Hands now take the same saturated yolk used for the crack-tip peek,
        // feet take the crack's own dark caramel, so extremities carry real
        // value AND hue contrast against the shell.
        hand: YOLK,
        foot: CRACK_DARK,
        torso: SHELL,
        limbRoughness: 0.5,
      },
      // Small, delicate, thin limbs, dainty narrow stance, slightly shorter overall.
      // `height` sits below the 2.1m cast norm (she's the smallest character) and
      // radii/stance are pulled in hard — the thinnest limbs and narrowest stance in
      // the cast bar Lollipop. `headFraction` stays close to her original value: an
      // egg's silhouette IS mostly head, so that ratio carries her identity rather
      // than needing to move.
      proportions: {
        height: 1.98,
        headFraction: 0.46,
        armRadius: 0.079,
        handRadius: 0.103,
        legRadius: 0.087,
        shoulderWidth: 0.307,
        stanceWidth: 0.139,
      },
      // Timid, closed-in — elbows pulled tight against the body, shoulders barely
      // lifted, head ducked and turned away shyly. An art director's second pass
      // named the cast's identical dead-front symmetric pose as a top gap; Egg's
      // read is the cast's most defensive/withdrawn stance, distinct from every
      // other character's more open posture in this file.
      stance: {
        shoulderL: 0.06, shoulderR: -0.06,
        elbowL: -0.95, elbowR: -0.92,
        twist: 0.05, headTilt: 0.16, headTurn: 0.32,
        hipSway: 0.01, lean: 0.10,
      },
    });
    this.body.add(this.rig.joints.root);
    this.head = this.rig.joints.head;

    const R = this.rig.headRadius;
    const head = this.rig.joints.head;

    // ── Shell: a true ovoid, not a sphere ─────────────────────────────────────
    const shellGeo = new THREE.SphereGeometry(1, 40, 30);
    {
      const posAttr = shellGeo.attributes.position as THREE.BufferAttribute;
      const dir = new THREE.Vector3();
      for (let i = 0; i < posAttr.count; i++) {
        dir.fromBufferAttribute(posAttr, i).normalize();
        const p = shellPoint(dir, R);
        posAttr.setXYZ(i, p.x, p.y, p.z);
      }
      shellGeo.computeVertexNormals();
    }
    const shell = new THREE.Mesh(shellGeo, toonMat({ color: SHELL, roughness: 0.35 }));
    shell.name = 'egg_shell';
    shell.castShadow = true;
    shell.receiveShadow = true;
    head.add(shell);

    // ── Crack: the silhouette landmark ────────────────────────────────────────
    // Bold caramel-brown fracture line — high contrast against the pale shell,
    // the way a real cracked eggshell darkens along the break. The Neon accent
    // is deliberately NOT smeared along the whole seam (that read as a blown-out
    // glow stripe on the first pass); instead it's one small, hot ember at the
    // crack's widest gap, right where the yolk peeks through.
    buildCrackLine(head, R, CRACK_PATH, {
      thickness: R * 0.05, embed: R * 0.010, color: CRACK_DARK, roughness: 0.55,
    });
    buildCrackLine(head, R, [CRACK_PATH[4], CRACK_PATH[5]], {
      thickness: R * 0.024, embed: R * 0.017, color: NEON_ACCENT, roughness: 0.3,
      emissive: NEON_ACCENT, emissiveIntensity: 1.0,
    });

    // A glossy sliver of yolk peeking through the widest point of the crack —
    // wet where the shell is matte, and a quiet nod to Hatch!.
    const tip = CRACK_PATH[CRACK_PATH.length - 1];
    const tipSurface = eggSurface(tip[0], tip[1] * Math.PI, R);
    const yolk = new THREE.Mesh(new THREE.SphereGeometry(R * 0.065, 12, 10), glossyMat({ color: YOLK, roughness: 0.2 }));
    yolk.scale.set(1, 1, 0.4);
    yolk.position.copy(tipSurface.pos).addScaledVector(tipSurface.normal, R * 0.003);
    yolk.quaternion.setFromUnitVectors(new THREE.Vector3(0, 0, 1), tipSurface.normal);
    yolk.userData.noOutline = true;
    head.add(yolk);

    // ── Costume: oversized scarf + knit cap ───────────────────────────────────
    // A second independent art-director pass named the total absence of any worn
    // costume/accessory layer as the cast's single biggest remaining gap. An
    // oversized scarf wound around the neck, its tails hanging past the shell's
    // own front, is the single most legible costume for a timid character: it
    // reads as "bundled up, hiding a little" and breaks the ovoid silhouette with
    // real hanging cloth. The knit cap perched near the crown is the smaller worn
    // detail, tucked well clear of the crack landmark's own theta band.
    //
    // Round 1 defect: attached to `rig.joints.neck`. Egg's head is BOTH unusually
    // large (headFraction 0.46) and bulges wider below its own equator
    // (BOTTOM_BULGE), so the shell's lowest point actually sits BELOW the neck
    // joint's own world Y — the neck is entirely swallowed inside the shell
    // volume, not in a visible gap above the torso. Anything hung off it renders
    // fully hidden. Fixed by anchoring the scarf to the SHELL's own surface via
    // `eggSurface` (the same source of truth the crack and face already use)
    // near the bottom of the head, where the bulge gives it real radius to wrap.
    const scarfMat = toonMat({ color: LIMB_LILAC, roughness: 0.6 });
    const scarfDarkMat = toonMat({ color: LIMB_LILAC_SHADOW, roughness: 0.6 });
    const scarfPhi = 0.80 * Math.PI;
    const scarfPt = eggSurface(Math.PI / 2, scarfPhi, R);
    const scarfRadius = Math.hypot(scarfPt.pos.x, scarfPt.pos.z);
    const scarfY = scarfPt.pos.y;

    const scarfWrap = new THREE.Mesh(new THREE.TorusGeometry(scarfRadius * 1.08, R * 0.13, 10, 24), scarfMat);
    scarfWrap.name = 'egg_scarf_wrap';
    scarfWrap.rotation.x = Math.PI / 2;
    scarfWrap.position.y = scarfY;
    scarfWrap.castShadow = true;
    scarfWrap.receiveShadow = true;
    head.add(scarfWrap);

    for (const sx of [-1, 1] as const) {
      const tail = new THREE.Mesh(new THREE.CapsuleGeometry(R * 0.085, R * 0.48, 4, 8), sx > 0 ? scarfMat : scarfDarkMat);
      tail.name = 'egg_scarf_tail';
      tail.position.set(sx * R * 0.16, scarfY - R * 0.40, scarfRadius * 0.92);
      tail.rotation.x = 0.22;
      tail.rotation.z = sx * 0.08;
      tail.castShadow = true;
      tail.receiveShadow = true;
      head.add(tail);

      const tassel = new THREE.Mesh(new THREE.SphereGeometry(R * 0.07, 8, 6), scarfDarkMat);
      tassel.name = 'egg_scarf_tassel';
      tassel.position.set(sx * R * 0.16, scarfY - R * 0.66, scarfRadius * 0.98);
      tassel.castShadow = true;
      head.add(tassel);
    }

    // Knit cap — a small dome-cap-plus-pompom perched near the top pole, well
    // clear of the crack (theta 0.66-0.86), on a curved basis solved the exact
    // same way as every other decal on this shell (`eggSurface`) so it can't
    // float off or sink into the surface.
    const capMat = toonMat({ color: '#CB9ED4', roughness: 0.6 });
    const capPompomMat = toonMat({ color: YOLK, roughness: 0.55 });
    const capBasis = eggSurface(-0.30, 0.10 * Math.PI, R);
    const capR = R * 0.34;
    const cap = new THREE.Mesh(new THREE.SphereGeometry(capR, 16, 12, 0, Math.PI * 2, 0, Math.PI * 0.66), capMat);
    cap.name = 'egg_cap';
    cap.position.copy(capBasis.pos).addScaledVector(capBasis.normal, capR * 0.22);
    cap.quaternion.setFromUnitVectors(new THREE.Vector3(0, 1, 0), capBasis.normal);
    cap.castShadow = true;
    cap.receiveShadow = true;
    head.add(cap);

    const capPompom = new THREE.Mesh(new THREE.SphereGeometry(capR * 0.3, 10, 8), capPompomMat);
    capPompom.name = 'egg_cap_pompom';
    const capApex = new THREE.Vector3(0, capR, 0).applyQuaternion(cap.quaternion);
    capPompom.position.copy(cap.position).add(capApex);
    capPompom.castShadow = true;
    head.add(capPompom);

    // ── Body: dress the torso ─────────────────────────────────────────────────
    // Two independent builder rounds both named the same gap: a themed head on a
    // generic body. Egg's body is a second, smaller shell built from the exact
    // same `shellPoint` surface as the head — literally the same ovoid language,
    // just scaled down — with the crack motif continuing a short way down onto
    // it, so the identity runs the full height of the model instead of stopping
    // dead at the neck.
    dressTorso(this.rig, (size) => {
      const torsoR = size.w * 0.5;
      const halfH = 1.04 * torsoR;
      const bottomY = size.h * 0.05;
      const centerY = bottomY + halfH;

      const group = new THREE.Group();
      group.name = 'egg_torso_shell_group';
      group.position.y = centerY;

      const shellGeo = new THREE.SphereGeometry(1, 28, 20);
      {
        const posAttr = shellGeo.attributes.position as THREE.BufferAttribute;
        const dir = new THREE.Vector3();
        for (let i = 0; i < posAttr.count; i++) {
          dir.fromBufferAttribute(posAttr, i).normalize();
          const p = shellPoint(dir, torsoR);
          posAttr.setXYZ(i, p.x, p.y, p.z);
        }
        shellGeo.computeVertexNormals();
      }
      const torsoShell = new THREE.Mesh(shellGeo, toonMat({ color: SHELL, roughness: 0.35 }));
      torsoShell.name = 'egg_torso_shell';
      torsoShell.castShadow = true;
      torsoShell.receiveShadow = true;
      group.add(torsoShell);

      // The crack carries on down from the neck — same helper, same colour, just
      // a shorter path against the torso's own (smaller) shell radius.
      buildCrackLine(group, torsoR, TORSO_CRACK_PATH, {
        thickness: torsoR * 0.075, embed: torsoR * 0.008, color: CRACK_DARK, roughness: 0.55,
      });

      return group;
    });

    // ── Limbs: bespoke, not the shared rig defaults ───────────────────────────
    // An independent art director named the rig's identical capsule-arm/ball-hand/
    // wedge-foot kit as the single biggest "template" tell across the whole cast.
    // Egg is small and delicate, so her limbs are noticeably thinner than the
    // rig's own default thickness, glossy porcelain like the shell; hands taper
    // to a glossy yolk-coloured teardrop (a quiet echo of the crack-tip yolk
    // peek) and feet are small dark shell-chip wedges, echoing the crack motif
    // instead of a generic block.
    const limbShellMat = toonMat({ color: LIMB_LILAC, roughness: 0.4 });
    const limbShellShadowMat = toonMat({ color: LIMB_LILAC_SHADOW, roughness: 0.42 });
    const yolkHandMat = glossyMat({ color: YOLK, roughness: 0.2 });
    const crackFootMat = toonMat({ color: CRACK_DARK, roughness: 0.5 });
    this.rig.dressLimbs((part, size) => {
      switch (part) {
        case 'upperArmL': case 'upperArmR':
        case 'thighL': case 'thighR': {
          const m = new THREE.Mesh(taperedSegment(size.len, size.radius * 0.82, size.radius * 0.6, 12), limbShellMat);
          m.name = `${part}_mesh`;
          m.castShadow = true;
          m.receiveShadow = true;
          return m;
        }
        case 'forearmL': case 'forearmR':
        case 'shinL': case 'shinR': {
          const m = new THREE.Mesh(taperedSegment(size.len, size.radius * 0.6, size.radius * 0.42, 12), limbShellShadowMat);
          m.name = `${part}_mesh`;
          m.castShadow = true;
          m.receiveShadow = true;
          return m;
        }
        case 'handL': case 'handR': {
          const drop = new THREE.Mesh(new THREE.SphereGeometry(size.radius * 0.5, 14, 12), yolkHandMat);
          drop.position.y = -size.radius * 0.62;
          drop.scale.set(1, 1.5, 1);
          drop.name = `${part}_mesh`;
          drop.castShadow = true;
          drop.receiveShadow = true;
          return drop;
        }
        case 'footL': case 'footR': {
          // A flattened, rounded chip rather than a cone — a cone tip reads as a
          // sharp spike once the run cycle's own foot rotation combines with a
          // static tilt (verified against a render: it looked like she was
          // standing on a dagger mid-stride). Same "broken shell fragment" idea,
          // safe under animation.
          const chip = new THREE.Mesh(
            roundedBox(size.radius * 1.7, size.len * 0.5, size.radius * 1.15, size.radius * 0.3, 3),
            crackFootMat
          );
          chip.position.set(0, -size.len * 0.36, size.radius * 0.25);
          chip.rotation.y = Math.PI / 5;
          chip.name = `${part}_mesh`;
          chip.castShadow = true;
          chip.receiveShadow = true;
          return chip;
        }
        default:
          return null;
      }
    });

    this.buildFace(head, R);

    outlineGroup(this.root);
    this.collectFlashTargets();
    this.rig.restPose();
  }

  /**
   * Face features are added directly to `head` rather than `rig.joints.face`:
   * `eggSurface()` already returns exact head-local surface coordinates, and
   * `face`'s built-in forward offset (tuned for a plain sphere) would double up
   * incorrectly against this custom ovoid. Open eyes with catchlights, thin
   * shell-toned brow creases (an egg has no hair, so "worry" reads as a raised
   * ridge, not eyebrows), and a straight, deadpan mouth.
   */
  private buildFace(head: THREE.Group, R: number): void {
    const EYE_THETA = 0.50;
    const EYE_PHI = 0.43 * Math.PI;
    // At the old sizing every feature here (eyes, brows, mouth) sat well under
    // half the size of the equivalent feature on any other character in the
    // cast, and against a head this large and this plain (no shell texture,
    // no costume) that read as a sparse, half-finished face rather than a
    // deliberately minimal one. FS scales every feature up ~35% uniformly;
    // positions are untouched, and the eyes stay well clear of collapsing
    // into each other at this size (see the round-2 note below).
    const FS = 1.35;

    for (const sx of [-1, 1] as const) {
      const eye = addShellDecal(head, sx * EYE_THETA, EYE_PHI, R * 0.012, R);

      const white = new THREE.Mesh(new THREE.SphereGeometry(R * 0.125 * FS, 16, 14), toonMat({ color: '#FFFFFF', roughness: 0.3 }));
      white.scale.set(1, 1.08, 0.55);
      white.castShadow = true;
      eye.add(white);

      const pupil = new THREE.Mesh(new THREE.SphereGeometry(R * 0.062 * FS, 14, 12), toonMat({ color: INK, roughness: 0.25 }));
      pupil.position.set(0, -R * 0.01, R * 0.06 * FS);
      pupil.scale.set(1, 1, 0.55);
      pupil.castShadow = true;
      eye.add(pupil);

      const glint = new THREE.Mesh(new THREE.SphereGeometry(R * 0.028 * FS, 8, 8), flatMat('#ffffff'));
      glint.position.set(-sx * R * 0.03, R * 0.045, R * 0.10 * FS);
      glint.userData.noOutline = true;
      eye.add(glint);

      // Worry crease: a raised shell ridge, inner end lifted, above each eye. A
      // second independent art-director pass named facial acting as the cast's
      // biggest remaining gap, and a mirrored crease on both sides (identical
      // height/tilt) was exactly the "matched, no personality" pattern it flagged —
      // so the right crease now sits higher and cocks harder than the left, one
      // genuinely raised eyebrow rather than two symmetric worry lines.
      const browPhi = sx > 0 ? EYE_PHI - 0.205 : EYE_PHI - 0.135;
      const brow = addShellDecal(head, sx * EYE_THETA * 0.92, browPhi, R * 0.010, R);
      const creaseMesh = new THREE.Mesh(
        roundedBox(R * 0.20 * FS, R * 0.040 * FS, R * 0.028 * FS, R * 0.018, 2),
        toonMat({ color: SHELL_SHADOW, roughness: 0.45 })
      );
      // (sign verified against a render: the naive -sx tilt read as angry —
      // inner end low, outer high — so this is flipped to lift the inner end.)
      creaseMesh.rotation.z = sx * (sx > 0 ? 0.52 : 0.30);
      creaseMesh.castShadow = true;
      brow.add(creaseMesh);
    }

    // Mouth: a small worried "o" rather than a flat dash — a flat bar barely reads
    // as a mouth shape at all at gameplay distance, and a second independent
    // art-director pass named a real mouth shape as required across the whole
    // cast. A small open ring pairs naturally with the raised-crease worry above
    // it (about to hatch, bracing for a hit) while staying dainty/deadpan rather
    // than a wide cartoon gasp.
    const mouth = addShellDecal(head, 0, 0.505 * Math.PI, R * 0.010, R);
    const mouthMesh = new THREE.Mesh(
      new THREE.TorusGeometry(R * 0.052 * FS, R * 0.019 * FS, 10, 16),
      toonMat({ color: INK, roughness: 0.3 })
    );
    mouthMesh.castShadow = true;
    mouth.add(mouthMesh);
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
