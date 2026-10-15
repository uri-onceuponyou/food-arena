/**
 * THE PROP KIT — graphics campaign A2a (`docs/REVAMP.md` §5, wave 3).
 *
 * ── Why this exists, measured ─────────────────────────────────────────────────────
 * Round w1's critics called our props *"plain untextured blocks / slabs / boxes"* in 11 of
 * 24 notes, and the density null (`fd76ef0`: 13% -> 24.9% footprint, +0.00) says adding
 * MORE of those blocks buys nothing. So the pieces get BUILT instead, in place, with every
 * `CoverBox` and every footprint untouched: chunky chamfers, a lit top edge, same-hue darker
 * sides, AO baked into vertex colour where a piece meets the floor or another piece, a
 * material read (painted panels, wood planks and slats, steel trim, burlap) and silhouette
 * breaks (lids, handles, overhangs, stacked contents).
 *
 * ── How a piece is made ───────────────────────────────────────────────────────────
 * A `KitGeo` accumulates triangles for ONE piece and emits ONE non-indexed geometry per
 * finish — `matte` (painted wood, fabric, iron) and `gloss` (steel and enamel: clearcoat,
 * low roughness). Every colour is a VERTEX colour on a white material, so:
 *
 *   * DRAWS FALL, they cannot rise. `mergeStaticMeshes` (`render/toon.ts`) buckets by
 *     material, and the whole kit is two materials — every converted piece retires the
 *     `tinted()` clones and per-part materials it used to carry (the phone's six-seat draw
 *     budget is the hard constraint, `docs/REVAMP.md` §2.8).
 *   * `liftArenaValue` (`../shared.ts`, V' = V^0.72 on MATERIAL colours) is a no-op here: the
 *     material is white, V = 1. **Kit colours are authored as DELIVERED sRGB.** Where a value
 *     below says "today's" it quotes the lifted, delivered value of the colour it replaces.
 *   * R1's form ramp (`render/roles.ts` `FORM_SIDE_ALBEDO` = 0.78 on near-vertical faces of
 *     every `arena:*` material) still applies on top. So a side authored at 0.86x of its top
 *     renders at ~0.67x — the 0.6-0.7 the REVAMP row asks for — and is NOT authored there.
 *
 * Colour is chosen per VERTEX by a `Paint` from the vertex's own normal and position: an
 * up-facing face takes the top colour, a chamfer between the top and a side takes the LIT
 * EDGE colour, a side takes the side colour. AO is a value multiplier on top of that,
 * `1 - floor x exp(-height / falloff)`, which is why tall faces are emitted in horizontal
 * BANDS: a face with vertices only at its bottom and top would spread the AO linearly over
 * its whole height.
 *
 * ⚠️ Every mesh made here is NAMED (`kit_matte` / `kit_gloss` and, after the merge,
 * `props:kit_*:<n>`): `AGENT-BRIEF` §3 — an unnamed mesh is invisible to every diagnostic.
 */
import * as THREE from 'three';
import { toonMat, glossyMat } from '../../render/toon';
import type { Materials } from '../shared';

// ─────────────────────────────────────────────────────────────────────────────────────
// Colour: sRGB triples, value moves only (hue and HSV saturation kept exactly)
// ─────────────────────────────────────────────────────────────────────────────────────

/** A DELIVERED sRGB colour, 0..1 per channel. */
export type SRGB = readonly [number, number, number];

const _c = new THREE.Color();
export function srgb(hex: string): SRGB {
  _c.set(hex);
  const o = { r: 0, g: 0, b: 0 };
  _c.getRGB(o, THREE.SRGBColorSpace);
  return [o.r, o.g, o.b];
}

/** Scale the sRGB VALUE: every channel by `k`, so hue and HSV saturation are unchanged
 * (until a channel clips). The only colour move this file makes — `CLAUDE.md`: never fix
 * anything by desaturating. */
export function val(c: SRGB, k: number): SRGB {
  return [Math.min(1, c[0] * k), Math.min(1, c[1] * k), Math.min(1, c[2] * k)];
}

export function mix(a: SRGB, b: SRGB, t: number): SRGB {
  return [a[0] + (b[0] - a[0]) * t, a[1] + (b[1] - a[1]) * t, a[2] + (b[2] - a[2]) * t];
}

const lin = (x: number) => (x <= 0.04045 ? x / 12.92 : Math.pow((x + 0.055) / 1.055, 2.4));

// ─────────────────────────────────────────────────────────────────────────────────────
// The value script for STRUCTURE, as numbers (the ground's half lives in `floor.ts`)
// ─────────────────────────────────────────────────────────────────────────────────────

/** Side faces at this fraction of their top's VALUE, authored. x R1's 0.78 -> ~0.67. */
export const KIT_SIDE = 0.86;
/** The chamfer between a top and a side: the LIT EDGE, this much above the top's value. */
export const KIT_EDGE = 1.14;
/** Floor-contact AO: value multiplier at the floor is `1 - KIT_AO_FLOOR`, e-folding height
 * `KIT_AO_FALLOFF` metres. 0.42 / 0.28 m: at 0.28 m a side is at 0.85, at 0.6 m at 0.95. */
export const KIT_AO_FLOOR = 0.42;
export const KIT_AO_FALLOFF = 0.28;
/** Horizontal vertex rows a banded face gets, in metres above its base, so the AO curve is
 * a curve and not a linear smear over the whole face. */
export const KIT_BANDS = [0.1, 0.28, 0.6, 1.2];

/** A per-vertex colour rule: piece-space position and normal in, DELIVERED sRGB out. */
export type Paint = (p: THREE.Vector3, n: THREE.Vector3) => SRGB;

/** Top / lit edge / side / underside by the face normal — the default for every block. */
export function paint(top: SRGB, side: SRGB = val(top, KIT_SIDE), edge: SRGB = val(top, KIT_EDGE)): Paint {
  const under = val(side, 0.62);
  return (_p, n) => (n.y > 0.8 ? top : n.y > 0.22 ? edge : n.y < -0.5 ? under : side);
}

/** One colour on every face (small trim, produce, cloth). */
export const flat = (c: SRGB): Paint => () => c;

// ─────────────────────────────────────────────────────────────────────────────────────
// Geometry generators (piece space: y up from the floor, footprint centred on x/z)
// ─────────────────────────────────────────────────────────────────────────────────────

type V3 = [number, number, number];

/** Push one triangle, oriented so its winding agrees with the intended normal `n`. */
function triOriented(P: number[], N: number[], a: V3, b: V3, c: V3, n: V3): void {
  const ux = b[0] - a[0], uy = b[1] - a[1], uz = b[2] - a[2];
  const vx = c[0] - a[0], vy = c[1] - a[1], vz = c[2] - a[2];
  const cx = uy * vz - uz * vy, cy = uz * vx - ux * vz, cz = ux * vy - uy * vx;
  const flip = cx * n[0] + cy * n[1] + cz * n[2] < 0;
  const [p1, p2] = flip ? [c, b] : [b, c];
  P.push(...a, ...p1, ...p2);
  N.push(...n, ...n, ...n);
}

function quadOriented(P: number[], N: number[], a: V3, b: V3, c: V3, d: V3, n: V3): void {
  triOriented(P, N, a, b, c, n);
  triOriented(P, N, a, c, d, n);
}

function geoFrom(P: number[], N: number[]): THREE.BufferGeometry {
  const g = new THREE.BufferGeometry();
  g.setAttribute('position', new THREE.Float32BufferAttribute(P, 3));
  g.setAttribute('normal', new THREE.Float32BufferAttribute(N, 3));
  return g;
}

export interface BoxOpts {
  /** Extra horizontal vertex rows on the side faces (m above the box's own base). */
  bands?: number[];
  /** Emit the underside (only for a piece seen from below — almost never). */
  bottom?: boolean;
  /** Skip the four vertical sides (a plank laid flush between neighbours). */
  noSides?: boolean;
  /** Skip one or more sides: +x, -x, +z, -z (hidden against a neighbour or a wall). */
  skip?: Array<'+x' | '-x' | '+z' | '-z'>;
  /** Skip the four vertical chamfer strips: for small trim (slats, panels, pulls) whose
   * corners are hidden or too small to read — 8 triangles per band saved, a hairline slit
   * left at each vertical edge. */
  noVEdges?: boolean;
}

/**
 * A box with a 45-degree CHAMFER `b` on its four top edges and four vertical edges, base at
 * y = 0, centred on x/z. Flat normals per face, so each chamfer is its own lit facet: the top
 * chamfer is the "lit top edge" a painted toy block catches.
 */
export function chamferBox(w: number, h: number, d: number, b: number, opts: BoxOpts = {}): THREE.BufferGeometry {
  b = Math.max(0.002, Math.min(b, w / 2 - 0.002, d / 2 - 0.002, h - 0.002));
  const hw = w / 2, hd = d / 2, iw = hw - b, id = hd - b, yt = h, ys = h - b;
  const P: number[] = [], N: number[] = [];
  const S = Math.SQRT1_2, T = 1 / Math.sqrt(3);
  const levels = [0, ...(opts.bands ?? []).filter((y) => y > 0.01 && y < ys - 0.01), ys];
  const skip = new Set(opts.skip ?? []);
  // top
  quadOriented(P, N, [-iw, yt, -id], [-iw, yt, id], [iw, yt, id], [iw, yt, -id], [0, 1, 0]);
  // top chamfers
  quadOriented(P, N, [iw, yt, -id], [iw, yt, id], [hw, ys, id], [hw, ys, -id], [S, S, 0]);
  quadOriented(P, N, [-iw, yt, -id], [-iw, yt, id], [-hw, ys, id], [-hw, ys, -id], [-S, S, 0]);
  quadOriented(P, N, [-iw, yt, id], [iw, yt, id], [iw, ys, hd], [-iw, ys, hd], [0, S, S]);
  quadOriented(P, N, [-iw, yt, -id], [iw, yt, -id], [iw, ys, -hd], [-iw, ys, -hd], [0, S, -S]);
  // top corners
  for (const sx of [-1, 1]) for (const sz of [-1, 1]) {
    triOriented(P, N, [sx * iw, yt, sz * id], [sx * hw, ys, sz * id], [sx * iw, ys, sz * hd], [sx * T, T, sz * T]);
  }
  if (!opts.noSides) {
    for (let k = 0; k + 1 < levels.length; k++) {
      const y0 = levels[k], y1 = levels[k + 1];
      if (!skip.has('+x')) quadOriented(P, N, [hw, y0, -id], [hw, y0, id], [hw, y1, id], [hw, y1, -id], [1, 0, 0]);
      if (!skip.has('-x')) quadOriented(P, N, [-hw, y0, -id], [-hw, y0, id], [-hw, y1, id], [-hw, y1, -id], [-1, 0, 0]);
      if (!skip.has('+z')) quadOriented(P, N, [-iw, y0, hd], [iw, y0, hd], [iw, y1, hd], [-iw, y1, hd], [0, 0, 1]);
      if (!skip.has('-z')) quadOriented(P, N, [-iw, y0, -hd], [iw, y0, -hd], [iw, y1, -hd], [-iw, y1, -hd], [0, 0, -1]);
      if (!opts.noVEdges) for (const sx of [-1, 1]) for (const sz of [-1, 1]) {
        quadOriented(P, N, [sx * hw, y0, sz * id], [sx * iw, y0, sz * hd], [sx * iw, y1, sz * hd], [sx * hw, y1, sz * id], [sx * S, 0, sz * S]);
      }
    }
  }
  if (opts.bottom) quadOriented(P, N, [-hw, 0, -hd], [-hw, 0, hd], [hw, 0, hd], [hw, 0, -hd], [0, -1, 0]);
  return geoFrom(P, N);
}

export interface CylOpts {
  bands?: number[];
  /** Barrel bulge: radius x (1 + bulge * sin(pi * y / h)) along the side. */
  bulge?: number;
  /** Emit the top cap (default true). */
  cap?: boolean;
  /** Radius at the top of the side, if it tapers (default = r). */
  rTop?: number;
  /** Flat facets round the side (a prism: the hearth's octagon), not a smooth cylinder. */
  flatSides?: boolean;
  /** Rotate the segment ring by this many radians (e.g. pi/8 puts an octagon's FLATS on the axes). */
  phase?: number;
}

/** A cylinder, base at y = 0, with a 45-degree chamfer `b` round its top edge. Smooth
 * normals round the side (the bulge's slope included), flat on the cap. */
export function chamferCyl(r: number, h: number, b: number, seg: number, opts: CylOpts = {}): THREE.BufferGeometry {
  b = Math.max(0.002, Math.min(b, r * 0.5, h - 0.002));
  const ys = h - b, rTop = opts.rTop ?? r, bulge = opts.bulge ?? 0;
  const levels = [0, ...(opts.bands ?? []).filter((y) => y > 0.01 && y < ys - 0.01), ys];
  const rad = (y: number) => {
    const t = y / Math.max(1e-6, ys);
    return (r + (rTop - r) * t) * (1 + bulge * Math.sin(Math.PI * t));
  };
  const drdy = (y: number) => (rad(Math.min(ys, y + 1e-3)) - rad(Math.max(0, y - 1e-3))) / 2e-3;
  const P: number[] = [], N: number[] = [];
  const phase = opts.phase ?? 0;
  const ang = (i: number) => phase + (i / seg) * Math.PI * 2;
  const push = (v: V3, n: V3) => { P.push(...v); N.push(...n); };
  const sideN = (a: number, y: number): V3 => {
    const k = -drdy(y);
    const l = Math.hypot(1, k);
    return [Math.cos(a) / l, k / l, Math.sin(a) / l];
  };
  const flatN = opts.flatSides === true;
  for (let k = 0; k + 1 < levels.length; k++) {
    const y0 = levels[k], y1 = levels[k + 1], r0 = rad(y0), r1 = rad(y1);
    for (let i = 0; i < seg; i++) {
      const a0 = ang(i), a1 = ang(i + 1);
      const v00: V3 = [Math.cos(a0) * r0, y0, Math.sin(a0) * r0], v10: V3 = [Math.cos(a1) * r0, y0, Math.sin(a1) * r0];
      const v01: V3 = [Math.cos(a0) * r1, y1, Math.sin(a0) * r1], v11: V3 = [Math.cos(a1) * r1, y1, Math.sin(a1) * r1];
      // outward winding: (v00, v01, v11) is CCW seen from outside for increasing angle about +y
      const am = (a0 + a1) / 2, ym = (y0 + y1) / 2;
      const n00 = flatN ? sideN(am, ym) : sideN(a0, y0), n01 = flatN ? n00 : sideN(a0, y1);
      const n11 = flatN ? n00 : sideN(a1, y1), n10 = flatN ? n00 : sideN(a1, y0);
      push(v00, n00); push(v01, n01); push(v11, n11);
      push(v00, n00); push(v11, n11); push(v10, n10);
    }
  }
  const rs = rad(ys), ri = Math.max(0.001, rs - b);
  for (let i = 0; i < seg; i++) {
    const a0 = ang(i), a1 = ang(i + 1), am = (a0 + a1) / 2;
    const n: V3 = [Math.cos(am) * Math.SQRT1_2, Math.SQRT1_2, Math.sin(am) * Math.SQRT1_2];
    const o0: V3 = [Math.cos(a0) * rs, ys, Math.sin(a0) * rs], o1: V3 = [Math.cos(a1) * rs, ys, Math.sin(a1) * rs];
    const i0: V3 = [Math.cos(a0) * ri, h, Math.sin(a0) * ri], i1: V3 = [Math.cos(a1) * ri, h, Math.sin(a1) * ri];
    quadOriented(P, N, o0, i0, i1, o1, n);
    if (opts.cap !== false) triOriented(P, N, [0, h, 0], i1, i0, [0, 1, 0]);
  }
  return geoFrom(P, N);
}

/** A soft lump (sack, produce): a sphere squashed to `sx, sy, sz` radii, flat-bottomed by
 * `sit` (0..1 of the lower half pressed flat), with smooth normals. Base at y = 0. */
export function lump(sx: number, sy: number, sz: number, seg = 12, rings = 8, sit = 0.35, pinch = 0): THREE.BufferGeometry {
  const g = new THREE.SphereGeometry(1, seg, rings);
  const pos = g.getAttribute('position') as THREE.BufferAttribute;
  const v = new THREE.Vector3();
  for (let i = 0; i < pos.count; i++) {
    v.fromBufferAttribute(pos, i);
    let y = v.y;
    if (y < -(1 - sit)) y = -(1 - sit) + (y + (1 - sit)) * 0.15; // pressed flat where it sits
    const neck = pinch > 0 ? 1 - pinch * Math.max(0, y - 0.55) / 0.45 : 1;
    pos.setXYZ(i, v.x * sx * neck, (y + (1 - sit)) * sy, v.z * sz * neck);
  }
  g.computeVertexNormals();
  return g;
}

// ─────────────────────────────────────────────────────────────────────────────────────
// The accumulator
// ─────────────────────────────────────────────────────────────────────────────────────

export type Finish = 'matte' | 'gloss';

interface Buf { P: number[]; N: number[]; C: number[] }

/**
 * Accumulates ONE piece. `add()` takes any geometry, a placement and a `Paint`; colours are
 * resolved per vertex (paint, then AO) at add time and stored LINEAR, as three reads them.
 */
export class KitGeo {
  private readonly bufs: Record<Finish, Buf> = { matte: { P: [], N: [], C: [] }, gloss: { P: [], N: [], C: [] } };
  private readonly _m = new THREE.Matrix4();
  private readonly _q = new THREE.Quaternion();
  private readonly _e = new THREE.Euler();
  private readonly _s = new THREE.Vector3(1, 1, 1);
  private readonly _t = new THREE.Vector3();
  private readonly _nm = new THREE.Matrix3();
  private readonly _p = new THREE.Vector3();
  private readonly _n = new THREE.Vector3();
  /** AO contacts other than the floor: footprints a vertex is darkened near, at a height. */
  private readonly contacts: Array<{ x: number; z: number; hw: number; hd: number; cos: number; sin: number; y: number; reach: number; k: number }> = [];

  /**
   * Place `geo` at (x, y, z) with yaw `yaw` (radians, about +y) and optional pitch/roll and
   * scale, colour it with `paint`. `aoBase` is the height the part STANDS on (0 = the floor):
   * its sides darken toward that height with the floor curve, at `aoK` of full strength.
   */
  add(geo: THREE.BufferGeometry, at: { x?: number; y?: number; z?: number; yaw?: number; rx?: number; rz?: number; s?: [number, number, number] },
    pnt: Paint | null, finish: Finish = 'matte', aoBase = 0, aoK = 1): this {
    const src = geo.index ? geo.toNonIndexed() : geo;
    if (!src.getAttribute('normal')) src.computeVertexNormals();
    this._e.set(at.rx ?? 0, at.yaw ?? 0, at.rz ?? 0, 'YXZ');
    this._q.setFromEuler(this._e);
    this._t.set(at.x ?? 0, at.y ?? 0, at.z ?? 0);
    if (at.s) this._s.set(at.s[0], at.s[1], at.s[2]); else this._s.set(1, 1, 1);
    this._m.compose(this._t, this._q, this._s);
    this._nm.getNormalMatrix(this._m);
    const flip = this._m.determinant() < 0;
    const pos = src.getAttribute('position') as THREE.BufferAttribute;
    const nor = src.getAttribute('normal') as THREE.BufferAttribute;
    // `pnt === null`: the geometry carries its own DELIVERED sRGB per vertex in `kitColor`
    const own = pnt ? null : (src.getAttribute('kitColor') as THREE.BufferAttribute | undefined);
    if (!pnt && !own) throw new Error('KitGeo.add: no paint and no kitColor attribute');
    const B = this.bufs[finish];
    const n = pos.count - (pos.count % 3);
    for (let t = 0; t < n; t += 3) {
      const order = flip ? [t, t + 2, t + 1] : [t, t + 1, t + 2];
      for (const i of order) {
        this._p.fromBufferAttribute(pos, i).applyMatrix4(this._m);
        this._n.fromBufferAttribute(nor, i).applyMatrix3(this._nm).normalize();
        const c: SRGB = pnt ? pnt(this._p, this._n) : [own!.getX(i), own!.getY(i), own!.getZ(i)];
        const ao = this.aoAt(this._p, this._n, aoBase, aoK);
        B.P.push(this._p.x, this._p.y, this._p.z);
        B.N.push(this._n.x, this._n.y, this._n.z);
        B.C.push(lin(c[0] * ao), lin(c[1] * ao), lin(c[2] * ao));
      }
    }
    if (src !== geo) src.dispose();
    return this;
  }

  /**
   * Register a footprint (a piece standing ON a surface at height `y`). Up-facing vertices
   * on that surface within `reach` metres of the footprint darken toward it — the contact
   * AO "where pieces meet each other". Call BEFORE adding the surface it darkens.
   */
  contact(x: number, z: number, hw: number, hd: number, yaw: number, y: number, reach = 0.35, k = 0.38): this {
    this.contacts.push({ x, z, hw, hd, cos: Math.cos(-yaw), sin: Math.sin(-yaw), y, reach, k });
    return this;
  }

  private aoAt(p: THREE.Vector3, n: THREE.Vector3, base: number, k: number): number {
    let f = 1;
    const up = Math.max(0, p.y - base);
    // Floor / base contact on everything that is not facing straight up (a top face is lit).
    if (n.y < 0.85) f *= 1 - KIT_AO_FLOOR * k * Math.exp(-up / KIT_AO_FALLOFF);
    for (const c of this.contacts) {
      if (n.y < 0.5 || Math.abs(p.y - c.y) > 0.04) continue;
      const dx = p.x - c.x, dz = p.z - c.z;
      const lx = Math.abs(dx * c.cos - dz * c.sin) - c.hw, lz = Math.abs(dx * c.sin + dz * c.cos) - c.hd;
      const dist = Math.hypot(Math.max(0, lx), Math.max(0, lz));
      if (dist < c.reach) f *= 1 - c.k * (1 - dist / c.reach) ** 2;
    }
    return f;
  }

  /** Triangle count so far, both finishes. */
  get tris(): number { return (this.bufs.matte.P.length + this.bufs.gloss.P.length) / 9; }

  /** Emit the piece into `g` as at most two meshes, `kit_matte` and `kit_gloss`. */
  emit(g: THREE.Group, M: Materials): THREE.Group {
    const mats = kitMaterials(M);
    for (const f of ['matte', 'gloss'] as const) {
      const B = this.bufs[f];
      if (!B.P.length) continue;
      const geo = new THREE.BufferGeometry();
      geo.setAttribute('position', new THREE.Float32BufferAttribute(B.P, 3));
      geo.setAttribute('normal', new THREE.Float32BufferAttribute(B.N, 3));
      geo.setAttribute('color', new THREE.Float32BufferAttribute(B.C, 3));
      geo.computeBoundingSphere();
      const m = new THREE.Mesh(geo, mats[f]);
      m.name = `kit_${f}`;
      m.castShadow = true;
      m.receiveShadow = true;
      g.add(m);
    }
    return g;
  }
}

// ─────────────────────────────────────────────────────────────────────────────────────
// The two kit materials, ONE pair per `Materials` (so per arena build)
// ─────────────────────────────────────────────────────────────────────────────────────

const kitMats = new WeakMap<Materials, { matte: THREE.Material; gloss: THREE.Material }>();

/**
 * `matte`: painted wood, fabric, cast iron — roughness 0.66, no Fresnel rim (R1 turned the rim
 * off on flat architectural materials; the lit chamfers carry the edge now).
 * `gloss`: steel and enamel — `glossyMat`'s clearcoat vinyl at roughness 0.3.
 * Both white, `vertexColors` on: the colour is the geometry's.
 */
export function kitMaterials(M: Materials): { matte: THREE.Material; gloss: THREE.Material } {
  const hit = kitMats.get(M);
  if (hit) return hit;
  const matte = toonMat({ color: '#FFFFFF', roughness: 0.66, rim: false });
  matte.vertexColors = true;
  matte.name = 'kit:matte';
  const gloss = glossyMat({ color: '#FFFFFF', roughness: 0.3 });
  gloss.vertexColors = true;
  gloss.name = 'kit:gloss';
  const pair = { matte, gloss };
  kitMats.set(M, pair);
  return pair;
}

// ─────────────────────────────────────────────────────────────────────────────────────
// AO skirt — contact shade on a TOP surface around something standing on it
// ─────────────────────────────────────────────────────────────────────────────────────

/**
 * A flat ring lying on a top surface (colour `surface`, height `y`) round a footprint: its
 * inner edge at `1 - k` of the surface value, its outer edge EXACTLY the surface colour, so it
 * blends into the face it lies on with no seam. This is the "AO where pieces meet each other"
 * on a top face that has only four vertices of its own. `r` > 0 makes it round (radius r).
 */
export function skirt(kg: KitGeo, at: { x: number; z: number; yaw?: number }, y: number, hw: number, hd: number,
  width: number, surface: SRGB, finish: Finish = 'matte', k = 0.42, r = 0,
  clip?: { x0: number; x1: number; z0: number; z1: number }): void {
  const P: number[] = [], N: number[] = [], K: number[] = [], up: V3 = [0, 1, 0];
  const yy = y + 0.004;
  const yaw = at.yaw ?? 0, cs = Math.cos(yaw), sn = Math.sin(yaw);
  // piece space, so the CLIP (the surface's own bounds) can be applied after the placement:
  // an outer edge past the edge of the surface it lies on is a sheet floating in the air.
  const place = (lx: number, lz: number, outer: boolean): V3 => {
    let x = at.x + lx * cs + lz * sn, z = at.z - lx * sn + lz * cs;
    if (outer && clip) { x = Math.min(clip.x1, Math.max(clip.x0, x)); z = Math.min(clip.z1, Math.max(clip.z0, z)); }
    return [x, yy, z];
  };
  const inner: V3[] = [], outer: V3[] = [];
  if (r > 0) {
    const seg = 16;
    for (let i = 0; i < seg; i++) {
      const a = (i / seg) * Math.PI * 2;
      inner.push(place(Math.cos(a) * r, Math.sin(a) * r, false));
      outer.push(place(Math.cos(a) * (r + width), Math.sin(a) * (r + width), true));
    }
  } else {
    for (const [sx, sz] of [[-1, -1], [1, -1], [1, 1], [-1, 1]]) {
      inner.push(place(sx * hw, sz * hd, false));
      outer.push(place(sx * (hw + width), sz * (hd + width), true));
    }
  }
  const dark = val(surface, 1 - k);
  for (let i = 0; i < inner.length; i++) {
    const j = (i + 1) % inner.length;
    // two triangles, coloured by ring: (inner i, inner j, outer j) and (inner i, outer j, outer i)
    const tri = (a: V3, b: V3, c: V3, ka: SRGB, kb: SRGB, kc: SRGB) => {
      const before = P.length;
      triOriented(P, N, a, b, c, up);
      // triOriented may swap b and c; recover the order it wrote
      const wrote = [P.slice(before, before + 3), P.slice(before + 3, before + 6), P.slice(before + 6, before + 9)];
      for (const v of wrote) {
        const isA = v[0] === a[0] && v[2] === a[2], isB = v[0] === b[0] && v[2] === b[2];
        K.push(...(isA ? ka : isB ? kb : kc));
      }
    };
    tri(inner[i], inner[j], outer[j], dark, dark, surface);
    tri(inner[i], outer[j], outer[i], dark, surface, surface);
  }
  const geo = geoFrom(P, N);
  geo.setAttribute('kitColor', new THREE.Float32BufferAttribute(K, 3));
  kg.add(geo, {}, null, finish, -10, 0);
}

// ─────────────────────────────────────────────────────────────────────────────────────
// PARTS — the modular pieces every builder is assembled from
// ─────────────────────────────────────────────────────────────────────────────────────

/** The kit palette, DELIVERED sRGB. Hue families are the arena's existing contract
 * (`shared.ts`, "THE HUE CONTRACT"): BLOCKING bodies violet, steel cool, the prep top and the
 * crate lids the warm identity tops, herbs green, barrels blue, burlap warm-dark. Values are
 * today's delivered ones (after `liftArenaValue`) unless a note says otherwise. */
export const KP = {
  /** cabinet paint — today's `coverBody` delivered (#9B80DC lifted) */
  body: srgb('#A286E5'),
  /** the toe-kick / plinth band — today's `coverPlinthPanel` delivered */
  plinth: srgb('#61477E'),
  /** steel: hardware, handles, rails, hoops, brackets */
  steel: srgb('#C3D3E6'),
  /** the stove's range top — today's `stoveCap` (#94C5FF, V = 1, unlifted) */
  rangeTop: srgb('#94C5FF'),
  /** the service counters' top — today's `potMetal` delivered */
  serviceTop: srgb('#9BC9EA'),
  /** the prep counter's butcher block — today's `prepCap` delivered */
  butcher: srgb('#F2C679'),
  /** cast iron: grates, pans, handles */
  iron: srgb('#3D3950'),
  /** the hob plate — a step lighter than the iron on it, so the largest dark mass in a hub
   * frame (it was the darkest thing on screen at #3D3950) reads as a cooktop, not a hole */
  hob: srgb('#4F4A6B'),
  /** crate lids / light wood — today's crate lid (#FFCB73, V = 1) */
  lidWood: srgb('#FFCB73'),
  /** herb crate paint — today's `herbCrateWood` (#2A8462) delivered */
  herbWood: srgb('#349C76'),
  /** barrel staves — today's `barrelBody` (#3D7BB5) delivered */
  barrel: srgb('#4A8FCB'),
  barrelDark: srgb('#2A5577'),
  /** burlap — today's `burlap` (#926E26) delivered */
  burlap: srgb('#A88232'),
  /** pallet / dark wood */
  darkWood: srgb('#8E6431'),
  leafA: srgb('#4CB97E'),
  leafB: srgb('#36A286'),
  terracotta: srgb('#A65C2E'),
  /** A2b: the stove island's GLAZED TILE — the range top's own hue (#94C5FF, 210 deg) at a mid
   * value and real saturation (HSV 0.60 / 0.84, luma 0.53 against the old top's 0.74), so the
   * steel frame round it is the brighter thing and reads as the edge. (#67A2E6, luma 0.60, was
   * tried first: the frame read barely a step above it.) */
  tile: srgb('#5692D6'),
  /** A2b: kitchen china and cloth — plates, the towel over a front edge. Below white on
   * purpose: `arena-scan` put a cream towel (#EEE8DC) in a hub station's top-2 salience cells
   * and the player's rank fell — "actors own the top of the range" (REVAMP §5 A2) */
  china: srgb('#D8D0C2'),
  cloth: srgb('#3E8F9A'),
} as const;

// ─────────────────────────────────────────────────────────────────────────────────────
// WORK SURFACES — A2b (graphics campaign wave 4): a MATERIAL on a top, not a flat slab
// ─────────────────────────────────────────────────────────────────────────────────────
//
// Round w3's crop critics, on the stove island's range top, 5 of 8: *"the big flat pale-blue
// counter ... no surface detail, edge highlights or material variation"*, *"reads as greybox"*
// (`shots/rv/w3/scores.json`). The countertop was ONE chamfered slab of one colour, and on a
// colour whose blue channel is already 1.0 the KIT_EDGE chamfer (`val(top, 1.14)`) clips, so
// its lit edge was barely a step. These fields put a material on the top and leave the slab
// under them showing as the frame: a STEEL slab, whose own lit chamfer is the edge highlight
// the critics asked for.

/** Deterministic 0..1 hash of a grid cell — no `Math.random`: two builds are identical. */
function cellHash(i: number, j: number): number {
  let h = (i * 374761393 + j * 668265263) | 0;
  h = Math.imul(h ^ (h >>> 13), 1274126177);
  return ((h ^ (h >>> 16)) >>> 0) / 4294967296;
}

/**
 * GLAZED TILES on a top at `y`: ~`size` m squares over the rectangle `r` (piece space), each a
 * FLAT quad 6 mm proud of the slab under it, so the slab shows between them
 * as a `gap`-wide grout line. Two triangles a tile — a chamfered tile would cost ~13x that and
 * the per-piece budget is 2.5k. Tiles whose centre falls inside `hole` (the hob, which stands on
 * them) are not emitted. Each tile's VALUE is jittered by ±`jitter` and its normal tipped up to
 * ~1.1 deg by the same hash, so the glaze catches the key light tile by tile: a material, not a
 * print. Returns the tile count.
 */
export function tileField(kg: KitGeo, r: { x0: number; x1: number; z0: number; z1: number }, y: number, size: number,
  gap: number, tile: SRGB, finish: Finish, hole?: { w: number; d: number }, jitter = 0.05): number {
  const w = r.x1 - r.x0, d = r.z1 - r.z0;
  const nx = Math.max(1, Math.round(w / size)), nz = Math.max(1, Math.round(d / size));
  const px = w / nx, pz = d / nz, hx = (px - gap) / 2, hz = (pz - gap) / 2, yy = y + 0.006;
  const P: number[] = [], N: number[] = [], K: number[] = [];
  let n = 0;
  for (let i = 0; i < nx; i++) for (let j = 0; j < nz; j++) {
    const cx = r.x0 + px * (i + 0.5), cz = r.z0 + pz * (j + 0.5);
    if (hole && Math.abs(cx) < hole.w / 2 && Math.abs(cz) < hole.d / 2) continue;
    const h1 = cellHash(i, j), h2 = cellHash(j + 17, i + 5);
    const c = val(tile, 1 + jitter * (h1 * 2 - 1));
    const tx = (h2 - 0.5) * 0.04, tz = (h1 - 0.5) * 0.04, nl = Math.hypot(tx, 1, tz);
    quadOriented(P, N, [cx - hx, yy, cz - hz], [cx - hx, yy, cz + hz], [cx + hx, yy, cz + hz], [cx + hx, yy, cz - hz],
      [tx / nl, 1 / nl, tz / nl]);
    for (let k = 0; k < 6; k++) K.push(c[0], c[1], c[2]);
    n++;
  }
  if (n) {
    const g = geoFrom(P, N);
    g.setAttribute('kitColor', new THREE.Float32BufferAttribute(K, 3));
    kg.add(g, {}, null, finish, -10, 0);
  }
  return n;
}

/**
 * STAINLESS SHEETS on a top at `y`: the `w x d` rectangle split into `n` sheets along x with a
 * `seam` between them (the slab under them shows as the seam), each sheet BRUSHED — its value
 * ramps ±`sheen` across its width on its own four vertices, the ramp alternating sheet to sheet,
 * which is how a run of steel panels catches one light. 2 triangles a sheet.
 */
export function steelSheets(kg: KitGeo, w: number, d: number, y: number, n: number, seam: number, steel: SRGB, sheen = 0.07): void {
  const P: number[] = [], N: number[] = [], K: number[] = [];
  const pw = w / n, yy = y + 0.006, up: V3 = [0, 1, 0];
  for (let i = 0; i < n; i++) {
    const xa = -w / 2 + pw * i + seam / 2, xb = -w / 2 + pw * (i + 1) - seam / 2;
    const lo = val(steel, 1 - sheen), hi = val(steel, 1 + sheen);
    const [ca, cb] = i % 2 ? [hi, lo] : [lo, hi];
    const before = P.length;
    quadOriented(P, N, [xa, yy, -d / 2], [xa, yy, d / 2], [xb, yy, d / 2], [xb, yy, -d / 2], up);
    for (let v = before; v < P.length; v += 3) {
      const c = P[v] < (xa + xb) / 2 ? ca : cb;
      K.push(c[0], c[1], c[2]);
    }
  }
  const g = geoFrom(P, N);
  g.setAttribute('kitColor', new THREE.Float32BufferAttribute(K, 3));
  kg.add(g, {}, null, 'gloss', -10, 0);
}

/** A folded TOWEL hung over a top's front edge at local `x`: a fold lying on the top and the
 * fall down the front face (`frontZ` = the face's z), one cloth colour with a darker hem. */
export function towel(kg: KitGeo, x: number, topY: number, frontZ: number, w: number, cloth: SRGB): void {
  // T 18 mm and 2 mm off the face: the fall stays inside the CoverBox (the top is 0.99 of it)
  const T = 0.018, lie = 0.32, fall = 0.42;
  const cp = paint(cloth, val(cloth, 0.88), val(cloth, 1.05));
  kg.add(chamferBox(w, T, lie, 0.008, { noVEdges: true }), { x, y: topY, z: frontZ - lie / 2 + 0.02 }, cp, 'matte', topY, 0.3);
  kg.add(chamferBox(w, fall, T, 0.008, { noVEdges: true, skip: ['-z'] }), { x, y: topY - fall + 0.02, z: frontZ + T / 2 + 0.002 },
    (p, nn) => (p.y < topY - fall * 0.72 ? val(cloth, 0.78) : cp(p, nn)), 'matte', 0, 0);
}

/** A stack of `n` PLATES standing on `y`. */
export function plateStack(kg: KitGeo, x: number, y: number, z: number, r: number, n: number, china: SRGB, seg = 10): void {
  const pp = paint(china, val(china, 0.9), val(china, 1.06));
  for (let i = 0; i < n; i++) kg.add(chamferCyl(r * (1 - i * 0.015), 0.045, 0.02, seg), { x, y: y + i * 0.05, z }, pp, 'gloss', y, i ? 0.2 : 0.5);
}

/** The countertop's own bounds (0.99 of the footprint, minus its chamfer): a skirt's clip. */
export const topClip = (wM: number, dM: number) => ({ x0: -wM * 0.495 + 0.06, x1: wM * 0.495 - 0.06, z0: -dM * 0.495 + 0.06, z1: dM * 0.495 - 0.06 });

/** A box standing on `y`, its own base AO toward that height. Returns its top y. */
export function block(kg: KitGeo, x: number, y: number, z: number, w: number, h: number, d: number, b: number,
  pnt: Paint, finish: Finish = 'matte', opts: BoxOpts & { yaw?: number; aoK?: number } = {}): number {
  kg.add(chamferBox(w, h, d, b, { bands: opts.bands ?? KIT_BANDS, ...opts }), { x, y, z, yaw: opts.yaw ?? 0 }, pnt, finish, y, opts.aoK ?? 1);
  return y + h;
}

/**
 * Raised door / drawer panels on the four faces of a cabinet carcass `bw x bd`, from `y0` to
 * `y1`: one panel per ~1.5 m on the long faces, one on each end, each proud of the carcass by
 * its thickness with a chamfer that catches the light, and a steel pull near its top. The
 * reveal between two panels is the carcass itself, a value step darker — that is the "painted
 * cabinetry" read a flat-coloured box cannot carry.
 */
export function cabinetPanels(kg: KitGeo, bw: number, bd: number, y0: number, y1: number, panel: SRGB, opts: { pulls?: boolean; skipBack?: boolean } = {}): void {
  const T = 0.05, GAP = 0.13, inset = 0.12;
  const h = y1 - y0 - inset * 2;
  if (h < 0.3) return;
  const pnt = paint(val(panel, 1.0), panel, val(panel, KIT_EDGE));
  const pull = paint(KP.steel);
  const face = (len: number, along: 'x' | 'z', sign: 1 | -1, half: number) => {
    const n = along === 'x' ? Math.max(1, Math.round(len / 1.5)) : 1;
    const dw = len / n;
    for (let i = 0; i < n; i++) {
      const c = -len / 2 + dw * (i + 0.5);
      const pw = dw - GAP;
      // the panel's TOP (+y of the box) is rotated to face outward
      const rx = along === 'x' ? sign * Math.PI / 2 : 0;
      const rz = along === 'z' ? -sign * Math.PI / 2 : 0;
      const px = along === 'x' ? c : sign * half, pz = along === 'x' ? sign * half : c;
      kg.add(chamferBox(along === 'x' ? pw : h, T, along === 'x' ? h : pw, 0.022, { noVEdges: true }),
        { x: px, y: y0 + inset + h / 2, z: pz, rx, rz }, pnt, 'matte', 0, 1);
      if (opts.pulls && along === 'x') {
        const py = y0 + inset + h * 0.82;
        kg.add(chamferBox(Math.min(0.55, pw * 0.4), 0.07, 0.07, 0.02, { noVEdges: true, skip: ['-z'] }), { x: px, y: py, z: sign * (half + T + 0.03), yaw: sign > 0 ? 0 : Math.PI }, pull, 'gloss', 0, 0);
      }
    }
  };
  face(bw, 'x', 1, bd / 2);
  if (!opts.skipBack) face(bw, 'x', -1, bd / 2);
  face(bd, 'z', 1, bw / 2);
  face(bd, 'z', -1, bw / 2);
}

/** A gas burner: a cast-iron ring with a cross grate, standing on `y`. */
export function burner(kg: KitGeo, x: number, y: number, z: number, r: number): void {
  const iron = paint(KP.iron, val(KP.iron, 0.8), val(KP.iron, 1.5));
  kg.add(chamferCyl(r, 0.05, 0.015, 10), { x, y, z }, iron, 'matte', y, 0.5);
  for (const yaw of [Math.PI / 4, -Math.PI / 4]) {
    kg.add(chamferBox(r * 2.15, 0.045, 0.06, 0.014, { noVEdges: true }), { x, y: y + 0.05, z, yaw }, iron, 'matte', y, 0.4);
  }
}

/** A stockpot with a lid, a knob and two side handles, standing on `y`. */
export function stockpot(kg: KitGeo, x: number, y: number, z: number, r: number, h: number, body: SRGB = KP.steel): void {
  const p = paint(val(body, 1.04), val(body, 0.9), val(body, 1.12));
  kg.add(chamferCyl(r, h, 0.04, 16, { bands: [0.12] }), { x, y, z }, p, 'gloss', y, 0.8);
  kg.add(chamferCyl(r * 1.05, 0.06, 0.025, 16), { x, y: y + h, z }, p, 'gloss', y + h, 0.3);
  kg.add(chamferCyl(r * 0.16, 0.08, 0.02, 8), { x, y: y + h + 0.06, z }, paint(KP.iron), 'matte', y + h, 0);
  for (const s of [-1, 1]) {
    kg.add(chamferBox(0.1, 0.06, 0.18, 0.02), { x: x + s * (r + 0.04), y: y + h * 0.78, z }, paint(KP.iron), 'matte', 0, 0);
  }
}

/** A small potted herb (the sprig every stove island carries). */
export function herbPot(kg: KitGeo, x: number, y: number, z: number, s: number): void {
  kg.add(chamferCyl(0.09 * s, 0.11 * s, 0.015 * s, 8), { x, y, z }, paint(KP.terracotta), 'matte', y, 0.5);
  for (let k = 0; k < 3; k++) {
    const a = (k / 3) * Math.PI * 2;
    kg.add(new THREE.ConeGeometry(0.08 * s, 0.24 * s, 6), {
      x: x + Math.cos(a) * 0.03 * s, y: y + 0.11 * s + 0.11 * s, z: z + Math.sin(a) * 0.03 * s, rx: Math.sin(a) * 0.22, rz: Math.cos(a) * 0.22,
    }, flat(k % 2 ? KP.leafB : KP.leafA), 'matte', y, 0.3);
  }
}

/**
 * THE COUNTER SHELL — every counter-family piece (stove island, prep counter, service
 * counters) is this plus what stands on it: a dark toe-kick band at the full footprint, a
 * painted carcass at 0.95 of it with raised door panels and steel pulls, a thick overhanging
 * countertop whose front chamfer is the lit edge, and a back wall with a steel rail.
 * Returns the countertop's top y.
 */
export function counterShell(kg: KitGeo, wM: number, dM: number, s: {
  topY: number; topT: number; top: SRGB; topFinish: Finish; plinthH: number; bodyFrac: number; backsplashH: number;
  /** a butcher-block top: this many boards along the length, V seams between them */
  topBoards?: number;
}): number {
  const bw = wM * s.bodyFrac, bd = dM * s.bodyFrac;
  // toe-kick band: full footprint, dark, the floor AO pooled in it
  block(kg, 0, 0, 0, wM, s.plinthH, dM, 0.05, paint(val(KP.plinth, 1.1), KP.plinth), 'matte', { bands: [0.08] });
  // carcass (the reveal colour between the panels)
  const carcass = val(KP.body, 0.84);
  const sideTop = s.topY - s.topT;
  block(kg, 0, s.plinthH, 0, bw, sideTop - s.plinthH, bd, 0.07, paint(carcass, carcass), 'matte', { aoK: 0.7 });
  cabinetPanels(kg, bw, bd, s.plinthH, sideTop, KP.body, { pulls: true });
  // the countertop: overhangs the carcass, chamfered, lit front edge
  const tp = paint(s.top, val(s.top, KIT_SIDE), val(s.top, KIT_EDGE));
  if (s.topBoards && s.topBoards > 1) {
    // boards run the length; each a hair different in value, the seams are their chamfers
    const nb = s.topBoards, bd2 = (dM * 0.99) / nb;
    for (let i = 0; i < nb; i++) {
      const tone = 1 + 0.045 * (((i * 5) % 3) - 1);
      const bp = paint(val(s.top, tone), val(s.top, KIT_SIDE * tone), val(s.top, 0.84));
      kg.add(chamferBox(wM * 0.99, s.topT, bd2, 0.035), { x: 0, y: sideTop, z: -dM * 0.495 + bd2 * (i + 0.5) },
        (p, n) => (Math.abs(n.z) > 0.6 && Math.abs(p.z) < dM * 0.49 ? val(s.top, 0.8) : bp(p, n)), s.topFinish, sideTop, 0.5);
    }
  } else {
    kg.add(chamferBox(wM * 0.99, s.topT, dM * 0.99, 0.06), { x: 0, y: sideTop, z: 0 }, tp, s.topFinish, sideTop, 0.5);
  }
  // back wall + steel rail, at local -Z (the side away from the lane, see `addBacksplash`)
  if (s.backsplashH > 0) {
    const wallD = dM * 0.1, wz = -dM * 0.5 + wallD * 0.5 + dM * 0.02;
    block(kg, 0, s.topY, wz, bw * 0.9, s.backsplashH, wallD, 0.04, paint(val(KP.body, 1.06), KP.body), 'matte', { bands: [0.15], aoK: 0.6 });
    kg.add(chamferBox(bw * 0.92, 0.07, wallD * 1.3, 0.025), { x: 0, y: s.topY + s.backsplashH, z: wz }, paint(KP.steel), 'gloss', 0, 0);
    skirt(kg, { x: 0, z: wz }, s.topY, bw * 0.45, wallD * 0.5, 0.35, s.top, s.topFinish, 0.3, 0, topClip(wM, dM));
  }
  return s.topY;
}

/**
 * A SLATTED CRATE standing on `y`: a dark core seen through the gaps, four corner posts, and
 * horizontal slats proud of the core on all four faces — the read a flat-coloured box cannot
 * carry. `lid`: a plank lid on top (planks + seams); null = an OPEN crate (the core's top is
 * its dark interior, for produce to sit in). Returns the top y.
 */
export function slatCrate(kg: KitGeo, x: number, y: number, z: number, w: number, h: number, d: number, yaw: number,
  c: { slat: SRGB; post: SRGB; lid: SRGB | null; slats?: number; aoK?: number }): number {
  const cos = Math.cos(yaw), sin = Math.sin(yaw);
  const at = (lx: number, lz: number) => ({ x: x + lx * cos + lz * sin, z: z - lx * sin + lz * cos });
  const P = Math.min(0.17, Math.min(w, d) * 0.08), T = 0.06;
  const inner = val(c.slat, 0.42);
  // the core — its top is the crate's dark interior when the crate is open
  kg.add(chamferBox(w - T * 2, h - 0.02, d - T * 2, 0.02, { bands: [0.3], noVEdges: true }), { ...at(0, 0), y, yaw }, flat(inner), 'matte', y, c.aoK ?? 1);
  // posts
  const postP = paint(val(c.post, 1.06), c.post, val(c.post, KIT_EDGE));
  for (const sx of [-1, 1]) for (const sz of [-1, 1]) {
    kg.add(chamferBox(P, h, P, 0.025, { bands: [0.25] }), { ...at(sx * (w / 2 - P / 2), sz * (d / 2 - P / 2)), y, yaw }, postP, 'matte', y, c.aoK ?? 1);
  }
  // slats: n per face, a gap of ~22% between them
  const n = c.slats ?? Math.max(3, Math.round(h / 0.36));
  const pitch = h / n, sh = pitch * 0.76;
  const slatP = paint(val(c.slat, 1.0), c.slat, val(c.slat, KIT_EDGE));
  for (let i = 0; i < n; i++) {
    const cy = y + pitch * (i + 0.5);
    for (const [along, sign] of [['x', 1], ['x', -1], ['z', 1], ['z', -1]] as const) {
      const len = (along === 'x' ? w : d) - P * 2 - 0.02;
      const half = (along === 'x' ? d : w) / 2 - T;
      const rx = along === 'x' ? sign * Math.PI / 2 : 0;
      const rz = along === 'z' ? -sign * Math.PI / 2 : 0;
      const lp = along === 'x' ? at(0, sign * half) : at(sign * half, 0);
      // a slat's ends abut the posts: no end faces, no vertical chamfers (18 tris, not 30)
      kg.add(chamferBox(along === 'x' ? len : sh, T, along === 'x' ? sh : len, 0.018, { noVEdges: true, skip: along === 'x' ? ['+x', '-x'] : ['+z', '-z'] }),
        { ...lp, y: cy, yaw, rx, rz }, slatP, 'matte', y, c.aoK ?? 1);
    }
  }
  if (c.lid) {
    // a plank lid: four boards with V seams, a hair proud of the rim
    const nb = 4, bw = (w - 0.04) / nb;
    const lidP = paint(c.lid, val(c.lid, KIT_SIDE), val(c.lid, 0.8));
    for (let i = 0; i < nb; i++) {
      kg.add(chamferBox(bw, 0.07, d - 0.04, 0.025, { bands: [] }), { ...at(-w / 2 + 0.02 + bw * (i + 0.5), 0), y: y + h - 0.02, yaw },
        (p, nn) => (nn.y > 0.8 ? val(c.lid!, 1 + 0.035 * ((i * 7) % 3 - 1)) : lidP(p, nn)), 'matte', y + h - 0.02, 0.4);
    }
    return y + h + 0.05;
  }
  return y + h;
}

/** A piece of produce (tomato, onion, lettuce) — a soft lump with a lighter top. */
export function produce(kg: KitGeo, x: number, y: number, z: number, r: number, c: SRGB, squash = 0.85): void {
  kg.add(lump(r, r * squash, r, 7, 5, 0.2), { x, y, z }, (_p, n) => (n.y > 0.5 ? val(c, 1.12) : c), 'gloss', y, 0.6);
}

/** Fill an OPEN crate's mouth (w x d at height y, turned `yaw`) with a jittered grid of
 * produce lumps, so its dark interior reads as full rather than as a dark slab. */
export function fillCrate(kg: KitGeo, x: number, y: number, z: number, w: number, d: number, yaw: number, colours: SRGB[], r: number): void {
  const nx = Math.max(1, Math.round(w / (r * 2.1))), nz = Math.max(1, Math.round(d / (r * 2.1)));
  const cs = Math.cos(yaw), sn = Math.sin(yaw);
  let k = 0;
  for (let i = 0; i < nx; i++) for (let j = 0; j < nz; j++) {
    const lx = -w / 2 + (w * (i + 0.5)) / nx + (((k * 37) % 7) - 3) * r * 0.05;
    const lz = -d / 2 + (d * (j + 0.5)) / nz + (((k * 53) % 5) - 2) * r * 0.06;
    const rr = r * (0.9 + ((k * 29) % 5) * 0.04);
    produce(kg, x + lx * cs + lz * sn, y - rr * 0.55, z - lx * sn + lz * cs, rr, colours[k % colours.length], 0.82);
    k++;
  }
}

/**
 * A WOODEN BARREL standing on `y`: flat staves (alternating a few % in value — the facets ARE
 * the staves), a bulge, three steel hoops proud of the wood at the bulge's own radius, a plank
 * lid inside the top chamfer and a bung. Returns the top y.
 */
export function barrel(kg: KitGeo, x: number, y: number, z: number, r: number, h: number, wood: SRGB, hoop: SRGB): number {
  const STAVES = 18, BULGE = 0.07;
  const stave = (n: THREE.Vector3) => {
    const k = Math.round(Math.atan2(n.z, n.x) / ((Math.PI * 2) / STAVES));
    return 1 + 0.06 * ((((k % 3) + 3) % 3) - 1);
  };
  const wp = paint(val(wood, 1.05), wood, val(wood, KIT_EDGE));
  kg.add(chamferCyl(r, h, 0.06, STAVES, { flatSides: true, bulge: BULGE, bands: [0.25, 0.6] }), { x, y, z },
    (p, n) => (Math.abs(n.y) < 0.5 ? val(wood, stave(n)) : wp(p, n)), 'matte', y, 1);
  const ys = h - 0.06;
  const rAt = (yy: number) => r * (1 + BULGE * Math.sin(Math.PI * Math.min(1, yy / ys)));
  const hp = paint(val(hoop, 1.1), hoop, val(hoop, 1.25));
  for (const f of [0.12, 0.5, 0.86]) {
    const yy = h * f;
    kg.add(chamferCyl(rAt(yy) * 1.035, 0.11, 0.025, STAVES, { flatSides: true, cap: false }), { x, y: y + yy - 0.055, z }, hp, 'gloss', 0, 0);
  }
  // the lid: three boards inside the rim, and a bung
  const lidR = r - 0.08;
  for (const dz of [-1, 0, 1]) {
    const len = 2 * Math.sqrt(Math.max(0.01, lidR * lidR - (dz * lidR * 0.62) ** 2)) * 0.95;
    kg.add(chamferBox(len, 0.04, lidR * 0.6, 0.015, { noVEdges: true }), { x, y: y + h - 0.02, z: z + dz * lidR * 0.62 },
      paint(val(wood, 1.1 + dz * 0.03), val(wood, 0.8), val(wood, 0.82)), 'matte', 0, 0);
  }
  kg.add(chamferCyl(r * 0.16, 0.06, 0.02, 10), { x: x + r * 0.35, y: y + h + 0.02, z }, paint(val(hoop, 1.1)), 'gloss', 0, 0);
  return y + h;
}

/**
 * A PILLOW: a sphere pushed toward a box by `square` (0 = ellipsoid, 1 = box), its top
 * sagging in the middle, flat where it sits, its +x end pinched by `pinch` into a tied neck.
 * Base at y = 0, half-extents sx / sy / sz. The flour sack's body.
 */
export function pillow(sx: number, sy: number, sz: number, seg = 12, rings = 8, square = 0.5, pinch = 0.45): THREE.BufferGeometry {
  const g = new THREE.SphereGeometry(1, seg, rings);
  const pos = g.getAttribute('position') as THREE.BufferAttribute;
  const v = new THREE.Vector3();
  for (let i = 0; i < pos.count; i++) {
    v.fromBufferAttribute(pos, i);
    const m = Math.max(Math.abs(v.x), Math.abs(v.y), Math.abs(v.z), 1e-6);
    let x = v.x + (v.x / m - v.x) * square, y = v.y + (v.y / m - v.y) * square, z = v.z + (v.z / m - v.z) * square;
    const t = Math.max(0, (x - 0.5) / 0.5);
    y *= 1 - pinch * t; z *= 1 - pinch * t;
    if (y > 0) y *= 1 - 0.22 * (1 - Math.min(1, Math.abs(x)));
    if (y < -0.62) y = -0.62 + (y + 0.62) * 0.15;
    pos.setXYZ(i, x * sx, (y + 0.62) * sy, z * sz);
  }
  g.computeVertexNormals();
  return g;
}

/** A FLOUR SACK lying on `y`: a slumped pillow of burlap (flour dusted on its top), a darker
 * tie round its neck and the folded mouth past it. `yaw` turns its long axis. */
export function sack(kg: KitGeo, x: number, y: number, z: number, rx: number, ry: number, rz: number, yaw: number, cloth: SRGB): void {
  const flour = srgb('#F3E6C8');
  kg.add(pillow(rx, ry, rz, 12, 8, 0.5, 0.45), { x, y, z, yaw }, (p, n) => {
    const up = THREE.MathUtils.clamp((p.y - y) / (ry * 1.6), 0, 1);
    return n.y > 0.6 && up > 0.6 ? mix(cloth, flour, 0.5 * (n.y - 0.6) / 0.4) : val(cloth, 0.9 + 0.14 * up);
  }, 'matte', y, 1);
  // the tie and the folded mouth, along the sack's own +x
  const cs = Math.cos(yaw), sn = Math.sin(yaw);
  const ex = (d: number) => ({ x: x + d * cs, z: z - d * sn });
  const neckY = y + ry * 0.62 * 0.95;
  kg.add(chamferCyl(Math.min(ry, rz) * 0.42, 0.14, 0.03, 10, { cap: false }), { ...ex(rx * 0.9), y: neckY, yaw, rz: -Math.PI / 2 }, paint(val(cloth, 0.6)), 'matte', 0, 0);
  kg.add(lump(rx * 0.16, ry * 0.42, rz * 0.5, 8, 5, 0.1), { ...ex(rx * 1.12), y: neckY - ry * 0.3, yaw }, (_p, n) => (n.y > 0.4 ? val(cloth, 1.08) : val(cloth, 0.9)), 'matte', y, 0.4);
}
