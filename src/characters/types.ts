/**
 * Character model contract.
 *
 * Every one of the 11 characters is authored in code as procedural geometry — no
 * external asset pipeline. Each is a rig of nested THREE.Groups animated by hand,
 * which is what gives us Brawl-Stars-style squash/stretch and anticipation without
 * shipping .glb files.
 *
 * ── HARD CONVENTIONS (a model that breaks these will look wrong in-game) ────────
 *  1. `root` sits at the origin with the character's FEET (or lowest point) at y=0.
 *  2. The character FACES +Z. Movement/aim rotates `root.rotation.y`.
 *  3. Overall height ≈ CHARACTER_HEIGHT (2.1 m). The cast must read as one family.
 *  4. Build every surface with `toonMat` / `glossyMat` / `flatMat` from render/toon.
 *     Never construct a raw MeshStandardMaterial — it will break the art style.
 *  5. Call `outlineGroup(root, ...)` once at the end of construction.
 *  6. Solid meshes set `castShadow = true`. Eyes/decals set `userData.noOutline`.
 *  7. All animation is time-based (seconds), never frame-count based.
 */

import * as THREE from 'three';
import type { CharacterDef, CharacterId } from '../game/rules';

export type AnimState = 'idle' | 'run' | 'attack' | 'hit' | 'death' | 'victory';

export interface AnimContext {
  /** Seconds since last frame. */
  dt: number;
  /** Seconds since the model was created — use for continuous cycles. */
  elapsed: number;
  /** 0 = standing still, 1 = full speed. Drives run-cycle blending. */
  moveSpeed01: number;
  /** Current health fraction, 0-1. Lets models show strain when low. */
  health01: number;
}

export interface CharacterModel {
  readonly id: CharacterId;
  readonly def: CharacterDef;
  /** Feet at y=0, facing +Z. Add this to the scene. */
  readonly root: THREE.Group;

  /** Advance procedural animation. Called once per frame. */
  update(ctx: AnimContext): void;

  /**
   * Trigger a one-shot. `attack` should read differently per weapon index so a
   * melee smash and a ranged toss don't share one generic motion.
   */
  play(state: AnimState, opts?: { weaponIndex?: number; intensity?: number }): void;

  /** Free geometry/materials. */
  dispose(): void;
}

export type CharacterFactory = (def: CharacterDef) => CharacterModel;

// ─────────────────────────────────────────────────────────────────────────────
// Base implementation — shared motion vocabulary
// ─────────────────────────────────────────────────────────────────────────────

/**
 * Handles the motion every character shares: idle breathing, run bounce with
 * squash/stretch, hit flash, death topple. Subclasses build the geometry and can
 * override `onUpdate` for character-specific flourishes (sprinkles jiggling, steam
 * rising, a chick peeking out).
 *
 * The whole cast moving on one shared rhythm is a big part of why a real game's
 * roster feels cohesive rather than like 11 separate hobby projects.
 */
export abstract class BaseCharacter implements CharacterModel {
  readonly id: CharacterId;
  readonly def: CharacterDef;
  readonly root = new THREE.Group();

  /** Everything that should bob/squash goes in here, not directly on `root`. */
  protected readonly body = new THREE.Group();
  /** Optional: assign a head/face group and it gets subtle counter-motion. */
  protected head: THREE.Object3D | null = null;

  protected elapsed = 0;
  protected state: AnimState = 'idle';

  // One-shot timers
  protected attackT = -1;
  protected attackDuration = 0.36;
  protected attackWeaponIndex = 0;
  protected hitT = -1;
  protected deathT = -1;

  /** Materials that should flash white on hit. Populated by `collectFlashTargets`. */
  private flashMats: Array<{ mat: THREE.Material & { color?: THREE.Color; emissive?: THREE.Color }; baseEmissive: THREE.Color | null }> = [];

  constructor(def: CharacterDef) {
    this.def = def;
    this.id = def.id;
    this.root.name = `character:${def.id}`;
    this.root.add(this.body);
  }

  /**
   * Call at the END of the subclass constructor, after geometry is built and
   * outlines added. Caches which materials participate in the hit flash.
   */
  protected collectFlashTargets(): void {
    this.flashMats = [];
    this.root.traverse((o) => {
      const m = o as THREE.Mesh;
      if (!m.isMesh) return;
      if (m.name.endsWith('__outline')) return;
      const mats = Array.isArray(m.material) ? m.material : [m.material];
      for (const mat of mats) {
        const anyMat = mat as THREE.Material & { emissive?: THREE.Color };
        this.flashMats.push({
          mat: anyMat,
          baseEmissive: anyMat.emissive ? anyMat.emissive.clone() : null,
        });
      }
    });
  }

  play(state: AnimState, opts?: { weaponIndex?: number; intensity?: number }): void {
    switch (state) {
      case 'attack':
        this.attackT = 0;
        this.attackWeaponIndex = opts?.weaponIndex ?? 0;
        break;
      case 'hit':
        this.hitT = 0;
        break;
      case 'death':
        this.deathT = 0;
        this.state = 'death';
        break;
      default:
        this.state = state;
    }
  }

  update(ctx: AnimContext): void {
    this.elapsed += ctx.dt;

    // Advance one-shots
    if (this.attackT >= 0) {
      this.attackT += ctx.dt;
      if (this.attackT > this.attackDuration) this.attackT = -1;
    }
    if (this.hitT >= 0) {
      this.hitT += ctx.dt;
      if (this.hitT > 0.26) this.hitT = -1;
    }
    if (this.deathT >= 0) this.deathT += ctx.dt;

    this.applyBaseMotion(ctx);
    this.applyHitFlash();
    this.onUpdate(ctx);
  }

  /** Idle breathe + run bounce + attack lunge + death topple. */
  protected applyBaseMotion(ctx: AnimContext): void {
    const move = THREE.MathUtils.clamp(ctx.moveSpeed01, 0, 1);

    // Idle: slow breathing, amplitude falls off as the character starts running.
    const breathe = Math.sin(this.elapsed * 2.1) * 0.022 * (1 - move);

    // Run: fast two-step bounce with volume-preserving squash at the bottom.
    const runPhase = this.elapsed * 11.5;
    const bounce = Math.abs(Math.sin(runPhase)) * 0.16 * move;
    const squash = -Math.cos(runPhase * 2) * 0.09 * move;

    let y = bounce + breathe;
    let sx = 1 + squash * 0.5;
    let sy = 1 - squash;
    let tilt = Math.sin(runPhase) * 0.07 * move;
    let lean = move * 0.10; // lean into the run

    // Attack: quick anticipation dip, then a snap forward.
    if (this.attackT >= 0) {
      const p = this.attackT / this.attackDuration;
      const anticipation = p < 0.28 ? -Math.sin((p / 0.28) * Math.PI) * 0.4 : 0;
      const strike = p >= 0.28 ? Math.sin(((p - 0.28) / 0.72) * Math.PI) : 0;
      lean += strike * 0.34 + anticipation * 0.18;
      sy += strike * 0.10 + anticipation * 0.06;
      sx -= strike * 0.05;
      y += strike * 0.05;
    }

    // Hit: sharp recoil backwards.
    if (this.hitT >= 0) {
      const p = this.hitT / 0.26;
      const k = Math.sin(p * Math.PI) * (1 - p * 0.35);
      lean -= k * 0.30;
      sx += k * 0.10;
      sy -= k * 0.10;
    }

    // Death: topple over and sink.
    if (this.deathT >= 0) {
      const p = THREE.MathUtils.clamp(this.deathT / 0.75, 0, 1);
      const ease = 1 - Math.pow(1 - p, 3);
      this.body.rotation.z = ease * Math.PI * 0.42;
      y = -ease * 0.35 + Math.sin(p * Math.PI) * 0.22;
      sy = 1 - ease * 0.18;
      sx = 1 + ease * 0.14;
      lean = 0;
      tilt = 0;
    } else {
      this.body.rotation.z = tilt;
    }

    this.body.position.y = y;
    this.body.rotation.x = lean;
    this.body.scale.set(sx, sy, sx);

    // Head lags slightly behind the body — cheap, and it reads as weight.
    if (this.head) {
      this.head.rotation.x = -lean * 0.45;
      this.head.rotation.z = -tilt * 0.5;
    }
  }

  private applyHitFlash(): void {
    const active = this.hitT >= 0;
    const k = active ? Math.max(0, 1 - this.hitT / 0.26) : 0;
    for (const { mat, baseEmissive } of this.flashMats) {
      if (!baseEmissive || !mat.emissive) continue;
      mat.emissive.copy(baseEmissive).lerp(new THREE.Color(0xffffff), k * 0.85);
    }
  }

  /** Character-specific per-frame flourishes. Override as needed. */
  protected onUpdate(_ctx: AnimContext): void {}

  dispose(): void {
    this.root.traverse((o) => {
      const m = o as THREE.Mesh;
      if (!m.isMesh) return;
      m.geometry?.dispose();
      const mats = Array.isArray(m.material) ? m.material : [m.material];
      mats.forEach((mat) => mat?.dispose());
    });
    this.root.clear();
  }
}
