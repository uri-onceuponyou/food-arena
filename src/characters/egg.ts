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
const SHELL_SHADOW = '#E4D6AE';     // crack gap + brow-crease shadow
const YOLK = '#FFC23C';             // glossy peek at the crack tip
const NEON_ACCENT = RARITY_COLORS.Neon; // #FF2FD0 — Egg's rarity accent, used ONLY on the crack seam
const INK = PALETTE.ink;

// ─────────────────────────────────────────────────────────────────────────────
// Shell surface — single source of truth for both the mesh and every decal.
// ─────────────────────────────────────────────────────────────────────────────

/** How sharply the crown narrows toward the top pole. */
const TOP_TAPER = 0.42;
/** How much the shell bulges below the equator — the "fuller at the bottom" read. */
const BOTTOM_BULGE = 0.16;
/** Overall vertical elongation, taller than it is wide like a real egg. */
const VERT_SCALE = 1.08;

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

/** Path (theta, phi-as-fraction-of-PI) for the crack landmark: crown, down the
 * right side, zigzagging past the equator. Kept clear of the eyes (theta ±0.50)
 * and mouth (theta 0). */
const CRACK_PATH: Array<[theta: number, phiFrac: number]> = [
  [1.00, 0.24], [1.22, 0.32], [0.92, 0.40], [1.16, 0.49], [0.86, 0.57],
];

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
    const seg = new THREE.Mesh(
      new THREE.BoxGeometry(length * 1.2, opts.thickness * taper, opts.thickness * 0.5),
      mat
    );
    seg.position.copy(mid).addScaledVector(normal, opts.embed);
    seg.quaternion.copy(quat);
    seg.userData.noOutline = true; // thin decal — an inverted-hull outline would read as a chunky sticker
    seg.castShadow = true;
    head.add(seg);
  }
}

export class EggCharacter extends BaseCharacter {
  private rig: ChibiRig;

  constructor(def: CharacterDef) {
    super(def);

    this.rig = new ChibiRig({
      palette: {
        limb: SHELL,
        hand: '#FFE9A8',       // warm yolk-tinted mitts
        foot: SHELL_SHADOW,
        torso: SHELL,
        limbRoughness: 0.5,
      },
      proportions: { headFraction: 0.47 },
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
    // Dark structural line (shadow of the gap), then a thinner glowing seam laid
    // just proud of it — the Neon accent, restrained to this one feature rather
    // than washing the whole shell.
    buildCrackLine(head, R, CRACK_PATH, {
      thickness: R * 0.052, embed: R * 0.006, color: SHELL_SHADOW, roughness: 0.55,
    });
    buildCrackLine(head, R, CRACK_PATH, {
      thickness: R * 0.020, embed: R * 0.011, color: '#FFE3F7', roughness: 0.35,
      emissive: NEON_ACCENT, emissiveIntensity: 0.5,
    });

    // A glossy sliver of yolk peeking through the lowest point of the crack —
    // wet where the shell is matte, and a quiet nod to Hatch!.
    const tip = CRACK_PATH[CRACK_PATH.length - 1];
    const tipSurface = eggSurface(tip[0], tip[1] * Math.PI, R);
    const yolk = new THREE.Mesh(new THREE.SphereGeometry(R * 0.05, 12, 10), glossyMat({ color: YOLK, roughness: 0.2 }));
    yolk.scale.set(1, 1, 0.4);
    yolk.position.copy(tipSurface.pos).addScaledVector(tipSurface.normal, R * 0.004);
    yolk.quaternion.setFromUnitVectors(new THREE.Vector3(0, 0, 1), tipSurface.normal);
    yolk.userData.noOutline = true;
    head.add(yolk);

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

    for (const sx of [-1, 1] as const) {
      const eye = addShellDecal(head, sx * EYE_THETA, EYE_PHI, R * 0.012, R);

      const white = new THREE.Mesh(new THREE.SphereGeometry(R * 0.125, 16, 14), toonMat({ color: '#FFFFFF', roughness: 0.3 }));
      white.scale.set(1, 1.08, 0.55);
      white.castShadow = true;
      eye.add(white);

      const pupil = new THREE.Mesh(new THREE.SphereGeometry(R * 0.062, 14, 12), toonMat({ color: INK, roughness: 0.25 }));
      pupil.position.set(0, -R * 0.01, R * 0.06);
      pupil.scale.set(1, 1, 0.55);
      pupil.castShadow = true;
      eye.add(pupil);

      const glint = new THREE.Mesh(new THREE.SphereGeometry(R * 0.028, 8, 8), flatMat('#ffffff'));
      glint.position.set(-sx * R * 0.03, R * 0.045, R * 0.10);
      glint.userData.noOutline = true;
      eye.add(glint);

      // Worry crease: a raised shell ridge, inner end lifted, above each eye.
      const brow = addShellDecal(head, sx * EYE_THETA * 0.92, EYE_PHI - 0.155, R * 0.010, R);
      const creaseMesh = new THREE.Mesh(
        roundedBox(R * 0.20, R * 0.040, R * 0.028, R * 0.018, 2),
        toonMat({ color: SHELL_SHADOW, roughness: 0.45 })
      );
      creaseMesh.rotation.z = -sx * 0.38;
      creaseMesh.castShadow = true;
      brow.add(creaseMesh);
    }

    // Straight, neutral mouth — dead centre, just below eye level.
    const mouth = addShellDecal(head, 0, 0.505 * Math.PI, R * 0.010, R);
    const mouthMesh = new THREE.Mesh(
      roundedBox(R * 0.20, R * 0.026, R * 0.020, R * 0.012, 2),
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
