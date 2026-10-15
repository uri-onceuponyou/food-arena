/**
 * ONE SHARED, VELOCITY-ALIGNED RIBBON TRAIL FOR EVERY PROJECTILE — one draw call for all of them.
 *
 * Graphics campaign V1 (`docs/REVAMP.md` §2.5): *"projectiles read as coins/marbles with no motion
 * language"*. A still frame of a shot in flight showed WHERE it was and nothing about where it was
 * going; eight of the 28 ranged weapons had no trail at all, and the other twenty each spawned
 * their own themed debris (one or more transient meshes per emission). This draws a tapered
 * streak behind every live projectile — newest point at the shot, fading to nothing ~`lifeMs`
 * behind it — from the shot's own recent positions, so its direction and speed are in the
 * picture. The bespoke trail hooks keep their themed debris; this is the shared base under them.
 *
 * The ribbon lies FLAT (side vector = travel x world-up), at the shot's own height: the match
 * camera looks down at 58°, where a flat band reads at ~85% of its width and needs no camera
 * vector. Width tapers and alpha fades toward the tail. Vertex colours carry the weapon's own
 * (identity re-keyed) colour lifted toward white, alpha in the 4th channel; normal blend with the
 * destination alpha preserved (`roles.ts:preserveDestinationAlpha`, R1's contour tag).
 */

import * as THREE from 'three';

export interface RibbonPoint { x: number; y: number; z: number }

export class RibbonBatch {
  readonly mesh: THREE.Mesh;
  private readonly geo = new THREE.BufferGeometry();
  private readonly mat: THREE.MeshBasicMaterial;
  private readonly pos: Float32Array;
  private readonly col: Float32Array;
  private readonly aPos: THREE.BufferAttribute;
  private readonly aCol: THREE.BufferAttribute;
  private n = 0;

  /** `maxRibbons` live projectiles, each drawn through exactly `points` points. */
  constructor(private readonly maxRibbons: number, private readonly points: number) {
    const verts = maxRibbons * points * 2;
    this.pos = new Float32Array(verts * 3);
    this.col = new Float32Array(verts * 4);
    this.aPos = new THREE.BufferAttribute(this.pos, 3).setUsage(THREE.DynamicDrawUsage);
    this.aCol = new THREE.BufferAttribute(this.col, 4).setUsage(THREE.DynamicDrawUsage);
    this.geo.setAttribute('position', this.aPos);
    this.geo.setAttribute('color', this.aCol);
    // A static index: every ribbon is `points - 1` quads; a short history is padded by
    // repeating its tail point, which makes zero-area quads rather than a second index.
    const idx: number[] = [];
    for (let r = 0; r < maxRibbons; r++) {
      const b = r * points * 2;
      for (let i = 0; i < points - 1; i++) {
        const a0 = b + i * 2; const a1 = a0 + 1; const b0 = a0 + 2; const b1 = a0 + 3;
        idx.push(a0, b0, a1, a1, b0, b1);
      }
    }
    this.geo.setIndex(idx);
    this.mat = new THREE.MeshBasicMaterial({
      vertexColors: true, transparent: true, depthWrite: false, side: THREE.DoubleSide,
    });
    this.mesh = new THREE.Mesh(this.geo, this.mat);
    this.mesh.name = 'vfx_projectile_ribbons';
    this.mesh.frustumCulled = false;
    this.mesh.visible = false;
    // Under the shot sprites (halo 6, particles 10), over the ground stack.
    this.mesh.renderOrder = 5.5;
  }

  get material(): THREE.Material { return this.mat; }
  get count(): number { return this.n; }

  begin(): void { this.n = 0; }

  /** `pts` newest first; `rgb` linear; `width` metres at the head; `alpha` at the head. */
  add(pts: readonly RibbonPoint[], rgb: readonly [number, number, number], width: number, alpha: number): void {
    if (this.n >= this.maxRibbons || pts.length < 2) return;
    const P = this.points;
    const base = this.n * P * 2;
    let lastSide = { x: 0, z: 0 };
    for (let i = 0; i < P; i++) {
      const k = Math.min(i, pts.length - 1);
      const p = pts[k]!;
      // Travel direction at this point (toward the head), flattened.
      const q = pts[Math.min(k + 1, pts.length - 1)]!;
      const h = pts[Math.max(k - 1, 0)]!;
      let dx = h.x - q.x; let dz = h.z - q.z;
      const len = Math.hypot(dx, dz);
      let side = lastSide;
      if (len > 1e-5) { dx /= len; dz /= len; side = { x: -dz, z: dx }; lastSide = side; }
      // Taper by position along the HISTORY (not along the padded index), so a short trail
      // still ends in a point.
      const f = pts.length > 1 ? Math.min(1, k / (pts.length - 1)) : 1;
      const w = width * 0.5 * Math.pow(1 - f, 0.85);
      const a = alpha * Math.pow(1 - f, 1.5);
      const v0 = (base + i * 2) * 3; const v1 = v0 + 3;
      this.pos[v0] = p.x + side.x * w; this.pos[v0 + 1] = p.y; this.pos[v0 + 2] = p.z + side.z * w;
      this.pos[v1] = p.x - side.x * w; this.pos[v1 + 1] = p.y; this.pos[v1 + 2] = p.z - side.z * w;
      const c0 = (base + i * 2) * 4; const c1 = c0 + 4;
      this.col[c0] = rgb[0]; this.col[c0 + 1] = rgb[1]; this.col[c0 + 2] = rgb[2]; this.col[c0 + 3] = a;
      this.col[c1] = rgb[0]; this.col[c1 + 1] = rgb[1]; this.col[c1 + 2] = rgb[2]; this.col[c1 + 3] = a;
    }
    this.n++;
  }

  end(): void {
    this.geo.setDrawRange(0, this.n * (this.points - 1) * 6);
    this.aPos.needsUpdate = true;
    this.aCol.needsUpdate = true;
    this.mesh.visible = this.n > 0;
  }

  dispose(): void {
    this.geo.dispose();
    this.mat.dispose();
  }
}
