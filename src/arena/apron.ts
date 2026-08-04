/**
 * The APRON — everything outside the playfield.
 *
 * ── The problem this exists to solve ────────────────────────────────────────────
 *
 * The arena is 1400 x 1000 wu and, until this module, it simply STOPPED. `floor.ts`
 * runs its dark subfloor plane 150 wu past each bound and beyond that is the scene
 * clear colour. Measured on the live game at shipped framing (`tools/tmp/undressed.mjs`,
 * ten frames from legal player positions at 4:3 / 16:9 / 21:9): **39.4% of the average
 * edge frame, and 59.1% of the worst, was flat undressed background** — a huge empty
 * band of one colour with no form, no depth and no story. A Brawl Stars map sits
 * inside a world; ours read as a slab floating in a void.
 *
 * ── How far out this has to reach ───────────────────────────────────────────────
 *
 * A player is clamped to [21, W-21] x [21, H-21] (`movement.ts`, half a character
 * radius), and the camera is player-centred, so the furthest the view ever reaches
 * past a bound is the frustum's own ground corner. Solved off `camera.ts`'s numbers:
 *
 *   aspect   camera dist   lateral reach   up-screen reach   down-screen reach
 *   4:3        30.88 m        311 wu           319 wu             143 wu
 *   21:9       26.62 m        470 wu           275 wu             123 wu
 *
 * So 470 wu is the true worst case in any direction. `APRON_OUT` is 760 wu — well past
 * it on every side, at zero extra cost (the ring is the same vertex count either way),
 * so no future camera tweak can re-open a hole. Dressing (clutter, uprights) stops at
 * `DRESS_OUT` = 540 wu, just past what can actually be seen.
 *
 * ── What it is, and why THIS rather than a drop-off ─────────────────────────────
 *
 * A continuous, unbroken steel KERB standing on the exact play boundary, and beyond it
 * the kitchen's back-of-house: a darker, cooler service floor, a drain channel running
 * the perimeter, and ranks of stacked crates, drums and shelving uprights receding into
 * shadow.
 *
 * The two alternatives were considered and rejected on geometry, not taste:
 *
 *   - A DROP-OFF / raised-platform edge only reads from three sides. The camera sits
 *     due south (yaw 0) and 58 deg up, so the riser of a step DOWN at the north bound
 *     faces away from it and is invisible; the boundary would look like a bare colour
 *     change along the top of the frame, which is exactly the failure being fixed. A
 *     kerb standing UP presents a lit face to the camera on all four sides.
 *   - A VOID / darkness beyond the edge trades a flat gold band for a flat black one.
 *     It also collides with the closing-fog death zone, whose author already flagged
 *     the off-map region as "a flat violet void" — see the fog note below.
 *
 * ── Fair play: this is COSMETIC BLEED and must stay that way ────────────────────
 *
 * Nothing here has collision, registers a `CoverBox`, or carries gameplay meaning. It
 * cannot: `movement.ts` already clamps every fighter inside the bounds, so the kerb is
 * the VISUAL for a rule that already exists — it makes the invisible wall legible
 * rather than adding one. The kerb sits ON the bound, and the bound is at most 21 wu
 * from a player who is near it, so it is always inside the 199.2 wu guaranteed square
 * whenever it matters. Everything further out is decoration whose meaning ("you cannot
 * go there") is already known from the kerb.
 *
 * The dressing is also deliberately kept OUT of the arena's own visual grammar so it
 * can never be mistaken for cover: no `coverPlinth` near-black plum (reserved for
 * blocking), no hazard amber, no outline (this group is never passed to
 * `outlineGroup`, which only ever runs on `propsGroup`), and a cool desaturated palette
 * against a playfield that is uniformly warm and saturated.
 *
 * ── Traps this is built around ──────────────────────────────────────────────────
 *
 * 1. HEIGHT CAP 2.9 m. `fogRing.ts` draws its danger canopy — the tint that makes the
 *    lethal half of the map read as lethal — as a horizontal plane at y = 3.2 m.
 *    Anything taller pokes through it and renders untinted inside the kill zone.
 * 2. A BIG FLAT PLANE CANNOT HAVE AN INTERNAL GRADIENT. One normal, one directional
 *    light, constant output (measured p90-p10 = 0.003 on the old apron quad). The
 *    service floor therefore carries its lighting in VERTEX COLOURS: a radial value
 *    ramp away from the arena, two octaves of low-frequency mottle, and a directional
 *    contact-shadow band under the kerb aimed along the real key-light azimuth.
 * 3. THE SCENE FOG DOES NOTHING HERE. `match.ts` sets `near 40 / far 130` (metres) and
 *    the furthest visible ground corner is 32.9 m from the camera at 21:9 and 38.2 m at
 *    4:3 — inside `near` in both cases. There is no aerial perspective to lean on; all
 *    depth cueing in this module is baked into the albedo.
 * 4. `floor.ts` OWNS 150 wu OF THE APRON ALREADY. Its `floor_base` plane is
 *    ARENA + 300 wu at y = -0.1. The service floor sits at y = -0.06, four centimetres
 *    above it, which hides it completely (0.04 m is ~500x the depth-buffer resolution
 *    at this range, so no z-fighting) without editing a parked file.
 * 5. OCCLUSION AT THE NEAR BOUND. The south bound is between the camera and a player
 *    standing on it. At 58 deg the sight line rises 1.6 m per metre of ground, and the
 *    player's centre is 21 wu (1.05 m) inside, so anything under 1.68 m tall on the
 *    bound cannot hide any part of them. The kerb is 0.50 m; its posts are 0.92 m.
 *
 * ── Cost ────────────────────────────────────────────────────────────────────────
 *
 * Seven draw calls, ~11k triangles, all static — no per-frame work, no update hook.
 * Everything that repeats is one `InstancedMesh`; everything that rings the perimeter
 * is merged into a single buffer.
 */

import * as THREE from 'three';
import { mergeGeometries } from 'three/examples/jsm/utils/BufferGeometryUtils.js';
import { toonMat } from '../render/toon';
import { wu } from '../units';
import { ARENA_W, ARENA_H } from './shared';

// ─────────────────────────────────────────────────────────────────────────────
// Extents
// ─────────────────────────────────────────────────────────────────────────────

/** How far the service floor runs past every bound, world units. See the header. */
const APRON_OUT = 760;
/** How far out props are placed. Just past the 470 wu worst-case view reach. */
const DRESS_OUT = 540;
/** Distance at which the floor's value ramp bottoms out, world units. */
const FADE_OUT = 370;

/** Service floor height, metres. 0.04 above `floor.ts`'s `floor_base` (see trap 4). */
const FLOOR_Y = -0.06;

/** Kerb footprint, world units out from the bound, and its top height in metres. */
const KERB_W = 22;
const KERB_TOP = 0.30;

/** Nothing in this module may exceed this, or it punches through the fog canopy. */
const MAX_HEIGHT = 2.9;

// ─────────────────────────────────────────────────────────────────────────────
// Palette
// ─────────────────────────────────────────────────────────────────────────────
//
// Authored as wanted, NOT pre-compensated. The 2026-08-04 grade replacement
// (`ToyGradeEffect` in `stage.ts`) reproduces hue within ~4 deg, is monotone in
// saturation, and only destroys authored channels below ~10/255.
//
// The whole set is deliberately COOL and DESATURATED against a playfield that renders
// warm and saturated (its tile measures ~(160,107,76), HSV s0.53 v0.63). Two jobs:
// the eye stays inside the play space, and nothing out here can be confused with the
// warm cover props you actually fight around.

const APAL = {
  /** Service floor, immediately outside the kerb — the brightest point of the ramp. */
  floorNear: '#767D84',
  /**
   * Service floor at `FADE_OUT` and beyond.
   *
   * Round 2 lifted this a long way (from `#2B3038`). The first pass rendered the far
   * apron at RGB (4,3,3) — black — and the cause was not the albedo: every one of the
   * ~280 back-of-house masses had `castShadow`, and at the key's 30 deg elevation each
   * throws a shadow 1.73x its own height, so a field spaced 96 wu apart shadowed
   * itself completely. Casting is off now (trap: the apron is decoration, and a shadow
   * budget spent out here buys nothing), and the albedo carries the recession alone —
   * which means it has to be authored as the value it should actually be.
   */
  floorFar: '#343B45',

  /** Kerb body — the face and top the camera actually sees most of. */
  kerbBody: '#39424C',
  /** Kerb inner lip. A narrow machined chamfer, NOT a bright cap: see `buildKerb`. */
  kerbLip: '#78828B',
  /** Hard dark line where the kerb meets the service floor. */
  kerbFoot: '#171A1F',

  /** Back-of-house masses. Cool and desaturated, with two quiet counterpoint hues. */
  massA: '#5A626B',
  massB: '#4C5A50',
  massC: '#6B5B45',
  massD: '#39495E',
  /** Shelving uprights / pipes / handles. */
  upright: '#454F59',
} as const;

// ─────────────────────────────────────────────────────────────────────────────
// Determinism
// ─────────────────────────────────────────────────────────────────────────────
//
// A seeded LCG, never `Math.random()`. The before/after per-pixel diffs this project
// relies on are only meaningful if the arena renders identically every run — an
// unseeded random in the dust field is the known source of the harness noise floor.

function lcg(seed: number): () => number {
  let s = seed >>> 0;
  return () => {
    s = (s * 1664525 + 1013904223) >>> 0;
    return s / 0x100000000;
  };
}

/** Smooth 2-D value noise, period `cell` world units. Deterministic in (x, y). */
function valueNoise(x: number, y: number, cell: number, seed: number): number {
  const gx = Math.floor(x / cell);
  const gy = Math.floor(y / cell);
  const fx = x / cell - gx;
  const fy = y / cell - gy;
  const h = (ix: number, iy: number) => {
    let n = (ix * 374761393 + iy * 668265263 + seed * 1274126177) | 0;
    n = (n ^ (n >> 13)) * 1274126177;
    return ((n ^ (n >> 16)) >>> 0) / 0xffffffff;
  };
  const s = (t: number) => t * t * (3 - 2 * t);
  const u = s(fx);
  const v = s(fy);
  const a = h(gx, gy);
  const b = h(gx + 1, gy);
  const c = h(gx, gy + 1);
  const d = h(gx + 1, gy + 1);
  return (a * (1 - u) + b * u) * (1 - v) + (c * (1 - u) + d * u) * v;
}

// ─────────────────────────────────────────────────────────────────────────────
// The lighting bake
// ─────────────────────────────────────────────────────────────────────────────

/**
 * Direction the key light throws a shadow, on the ground plane, in world (x, y).
 *
 * `render/lighting.ts` puts the key at (13.4, 9.8, 10.5) relative to its target, i.e.
 * up and to the +x/+z side, so shadows fall toward -x/-z. That file is out of bounds
 * here, so — exactly as `shared.ts` does for its own baked decals — the azimuth is
 * duplicated as a constant. If the key's azimuth ever moves, both copies move with it.
 */
const SHADOW_DIR_LEN = Math.hypot(13.4, 10.5);
const SHADOW_X = -13.4 / SHADOW_DIR_LEN;
const SHADOW_Y = -10.5 / SHADOW_DIR_LEN;

const clamp01 = (t: number) => (t < 0 ? 0 : t > 1 ? 1 : t);

/** Euclidean distance from (x, y) to the playfield rectangle, world units. */
function outsideDist(x: number, y: number): number {
  const dx = x - Math.min(ARENA_W, Math.max(0, x));
  const dy = y - Math.min(ARENA_H, Math.max(0, y));
  return Math.hypot(dx, dy);
}

/**
 * The apron's whole lighting model, as one scalar per world position.
 *
 * Three terms, all low-frequency, because at shipped framing the LOW band is the only
 * one that survives (`PROGRESS.md`: tile chamfer, high-frequency grain and per-tile
 * jitter all vanish; the baked low-frequency gradient is "the only thing carrying the
 * floor at distance"):
 *
 *   1. DISTANCE RAMP — the arena is the lit stage, and the back of house recedes from
 *      it. Also the reason the apron never competes with the playfield for the eye.
 *   2. MOTTLE — two octaves at 260 and 95 wu. Both are much larger than a tile, so
 *      they read as worn patches in a big floor rather than as surface grain.
 *   3. KERB CONTACT SHADOW — a band under the kerb thrown along `SHADOW_DIR`, so the
 *      west and north runs sit in their own shadow and the east and south runs do not.
 *      An unlit symmetrical dark ring is the tell that a boundary was pasted on; a
 *      one-sided one is the tell that it is standing in the same light as everything
 *      else in the frame.
 */
function apronShade(x: number, y: number): number {
  const d = outsideDist(x, y);

  const mottle =
    1 +
    (valueNoise(x, y, 260, 17) - 0.5) * 0.26 +
    (valueNoise(x, y, 95, 91) - 0.5) * 0.13;

  // Outward normal at this point — the direction the kerb's shadow would leave in.
  const nx = x - Math.min(ARENA_W, Math.max(0, x));
  const ny = y - Math.min(ARENA_H, Math.max(0, y));
  const nl = Math.hypot(nx, ny) || 1;
  const lit = SHADOW_X * (nx / nl) + SHADOW_Y * (ny / nl); // +1 = shadow falls outward
  const reach = 34 + 30 * Math.max(0, lit);
  const contact = 1 - 0.42 * Math.max(0, lit + 0.25) * (1 - clamp01((d - KERB_W) / reach));

  return mottle * contact;
}

/** Colour of the service floor at (x, y), already in linear working space. */
const _near = new THREE.Color(APAL.floorNear);
const _far = new THREE.Color(APAL.floorFar);
function apronFloorColor(x: number, y: number, out: THREE.Color): void {
  const t = Math.pow(clamp01(outsideDist(x, y) / FADE_OUT), 0.72);
  out.copy(_near).lerp(_far, t).multiplyScalar(apronShade(x, y));
}

// ─────────────────────────────────────────────────────────────────────────────
// Service floor texture — slab joints
// ─────────────────────────────────────────────────────────────────────────────

/**
 * World units per texture repeat. Four slabs across, so a slab is 64 wu (3.2 m).
 *
 * Sized against a MEASUREMENT, not by eye. The acceptance metric counts pixels sitting
 * in a locally flat 15x15 neighbourhood, and the closing fog's canopy divides every
 * value difference by 3.6, so what decides whether the apron holds up under it is the
 * DENSITY of hard edges, not their contrast. At the first size (6 m slabs) the apron
 * carried one joint per ~265 px against the playfield's one grout line per ~88 px, and
 * measured 64% flat against the playfield's 20% in the same fogged frame. 3.2 m brings
 * the two within a factor of ~1.5 and is still a plausible poured-slab size.
 */
const SLAB_UV = 256;

/**
 * Poured-slab joints for the service floor.
 *
 * The vertex-colour bake below owns the LOW band — the ramp away from the arena and
 * the broad mottle — and at shipped framing that is the band that survives. But a
 * gradient has no SCALE: rounds 1 and 2 both produced a service floor that was
 * correctly lit and still read as an empty plain, because there was nothing in it a
 * viewer could measure the apron against. Slab joints at 6 m give it that, and they
 * are the one piece of high-frequency detail here that is worth its bandwidth.
 *
 * They also carry the CLOSING-FOG case, which is the frame this module is hardest to
 * get right in. The danger canopy is a 0.72-alpha near-black violet plane, so every
 * value difference underneath it survives at ~28% — a smooth mottle at +/-13% arrives
 * as +/-3.6% and the whole apron collapses into the "flat violet void" the fog's author
 * flagged. A joint is a hard edge, not a gradient, so a fraction of it still reads.
 *
 * Everything except the joint lattice is isotropic on purpose. Any recognisable mark
 * in a tiling texture becomes a visible repeat, and this one repeats ~13 times across
 * the widest apron view.
 */
function makeSlabTexture(): THREE.CanvasTexture {
  const N = 256;
  const canvas = document.createElement('canvas');
  canvas.width = N;
  canvas.height = N;
  const ctx = canvas.getContext('2d')!;
  const img = ctx.createImageData(N, N);

  let seed = 0x2f6d1a9b;
  const rnd = () => {
    seed = (seed * 1664525 + 1013904223) >>> 0;
    return seed / 0x100000000;
  };

  const P = N / 4; // texels per slab
  for (let y = 0; y < N; y++) {
    for (let x = 0; x < N; x++) {
      // Distance in texels to the nearest joint of the 4x4 lattice.
      const mx = (x + P / 2) % P;
      const my = (y + P / 2) % P;
      const d = Math.min(Math.min(mx, P - mx), Math.min(my, P - my));

      // Recessed groove with a lit chamfer on its far side: dark core, then a narrow
      // lift. One value step would draw a line; two make it read as a real crevice.
      let v = 1;
      if (d <= 1.2) v = 0.5;
      else if (d <= 2.4) v = 0.7;
      else if (d <= 3.6) v = 1.07;

      // Per-slab tonal drift — the LOW band, and the one that still reads at 25 m. A
      // poured floor is patched and re-poured; identical slabs are the giveaway.
      const sx = Math.floor((x + P / 2) / P);
      const sy = Math.floor((y + P / 2) / P);
      v *= 0.93 + ((sx * 7 + sy * 13) % 5) * 0.035;

      // Isotropic tooth. No landmarks, nothing that survives as a recognisable stamp.
      v *= 0.955 + rnd() * 0.09;

      const c = Math.round(Math.max(0, Math.min(1, v)) * 255);
      const i = (y * N + x) * 4;
      img.data[i] = c;
      img.data[i + 1] = c;
      img.data[i + 2] = c;
      img.data[i + 3] = 255;
    }
  }
  ctx.putImageData(img, 0, 0);

  const tex = new THREE.CanvasTexture(canvas);
  tex.wrapS = THREE.RepeatWrapping;
  tex.wrapT = THREE.RepeatWrapping;
  // On a 58 deg pitched rig the whole apron is sampled at a grazing angle; at
  // anisotropy 1 every joint averages to mush before it reaches a pixel.
  tex.anisotropy = 8;
  tex.colorSpace = THREE.SRGBColorSpace;
  tex.needsUpdate = true;
  return tex;
}

// ─────────────────────────────────────────────────────────────────────────────
// Service floor — one merged ring, coloured per vertex
// ─────────────────────────────────────────────────────────────────────────────

/**
 * A rectangular annulus built as eight patches (four sides, four corners) so it has no
 * geometry under the playfield at all.
 *
 * The offset axis is sampled with a power curve, not uniformly: the ramp and the kerb's
 * contact shadow both do all their work in the first ~80 wu, and a linear grid there
 * would staircase the shadow into visible bands.
 */
function buildServiceFloor(): THREE.Mesh {
  const OFF_STEPS = 16;
  const offAt = (i: number) => APRON_OUT * Math.pow(i / OFF_STEPS, 2.3);

  const positions: number[] = [];
  const colors: number[] = [];
  const uvs: number[] = [];
  const indices: number[] = [];
  const c = new THREE.Color();

  /**
   * Emit one patch. `at(u, v)` maps grid coords to world (x, y), where v runs along
   * the outward offset axis.
   *
   * ── The winding has to be decided per patch, and this cost a round ─────────────
   *
   * The eight patches sweep in four different directions, so no single index order
   * faces them all the same way. Round 1 hard-coded one order and shipped four
   * back-facing patches; with `side: DoubleSide` that is not a hole you would notice,
   * because three.js flips the shading normal on a back face — so those patches were
   * lit as if their normal were -Y, i.e. from underneath, and rendered BLACK. The whole
   * north and south apron came out near zero while east and west looked correct, and
   * the hard straight seam between them read exactly like a shadow-frustum edge, which
   * is what it was misdiagnosed as first. (Instance #10 of this project's standing
   * trap: it was rendering, and invisible.)
   *
   * So the order is derived from the geometry instead of assumed — three.js takes the
   * face normal as cross(p1-p0, p2-p0) and CCW as front — and the material stays
   * `FrontSide`, so any future patch that gets this wrong disappears loudly instead of
   * quietly going black.
   */
  const patch = (uSteps: number, at: (ui: number, vi: number) => [number, number]) => {
    const base = positions.length / 3;
    for (let vi = 0; vi <= OFF_STEPS; vi++) {
      for (let ui = 0; ui <= uSteps; ui++) {
        const [x, y] = at(ui, vi);
        positions.push(wu(x), FLOOR_Y, wu(y));
        // UVs are WORLD-planar, so the slab lattice is continuous across all eight
        // patches and across the corner seams — a per-patch 0..1 UV would put a
        // different slab size on every one of them.
        uvs.push(x / SLAB_UV, y / SLAB_UV);
        apronFloorColor(x, y, c);
        colors.push(c.r, c.g, c.b);
      }
    }
    // Sample away from vi = 0: at the corner patches the whole vi = 0 row collapses
    // onto the corner point, so a quad taken there is degenerate and its cross product
    // is zero.
    const [ax, ay] = at(0, 1);
    const [bx, by] = at(1, 1);
    const [dx, dy] = at(0, 2);
    // cross(b-a, d-a).y in three's (X, up, Z) frame, with Z carrying world y.
    const upward = (bx - ax) * (dy - ay) - (by - ay) * (dx - ax) < 0;
    for (let vi = 0; vi < OFF_STEPS; vi++) {
      for (let ui = 0; ui < uSteps; ui++) {
        const a = base + vi * (uSteps + 1) + ui;
        const b = a + 1;
        const d = a + (uSteps + 1);
        const e = d + 1;
        if (upward) indices.push(a, b, d, b, e, d);
        else indices.push(a, d, b, b, d, e);
      }
    }
  };

  const NS = 22;
  const WE = 18;
  const CR = 12;

  // Sides. North/south span the full width; west/east fill only between them, so the
  // four corner patches own the diagonals and nothing overlaps.
  patch(NS, (ui, vi) => [(ui / NS) * ARENA_W, -offAt(vi)]);
  patch(NS, (ui, vi) => [(ui / NS) * ARENA_W, ARENA_H + offAt(vi)]);
  patch(WE, (ui, vi) => [-offAt(vi), (ui / WE) * ARENA_H]);
  patch(WE, (ui, vi) => [ARENA_W + offAt(vi), (ui / WE) * ARENA_H]);

  // Corners. Each is a quarter of the offset square, swept in `ui` from the horizontal
  // run to the vertical one so the two seams line up exactly with the side patches.
  const corner = (cx: number, cy: number, sx: number, sy: number) =>
    patch(CR, (ui, vi) => {
      const a = (ui / CR) * (Math.PI / 2);
      const o = offAt(vi);
      // Chebyshev sweep: the ring at offset `o` is the rectangle grown by `o`, so the
      // corner arc is a square corner, not a circle. Interpolating the two limbs keeps
      // the patch watertight against both neighbours.
      const k = Math.tan(Math.min(a, Math.PI / 2 - a));
      return a <= Math.PI / 4
        ? [cx + sx * o, cy + sy * o * k]
        : [cx + sx * o * k, cy + sy * o];
    });
  corner(0, 0, -1, -1);
  corner(ARENA_W, 0, 1, -1);
  corner(0, ARENA_H, -1, 1);
  corner(ARENA_W, ARENA_H, 1, 1);

  const geo = new THREE.BufferGeometry();
  geo.setAttribute('position', new THREE.Float32BufferAttribute(positions, 3));
  geo.setAttribute('color', new THREE.Float32BufferAttribute(colors, 3));
  geo.setAttribute('uv', new THREE.Float32BufferAttribute(uvs, 2));
  geo.setIndex(indices);
  // Normals are WRITTEN, not computed: every vertex lies in one horizontal plane, so
  // the true normal is exactly +Y, and `computeVertexNormals` would only re-derive it
  // from the winding this ring has to get right anyway (see `patch`).
  const normals = new Float32Array(positions.length);
  for (let i = 1; i < normals.length; i += 3) normals[i] = 1;
  geo.setAttribute('normal', new THREE.BufferAttribute(normals, 3));

  // `rim: false` — the Fresnel term is edge definition for rounded forms. On a ground
  // plane seen at 32 deg of grazing it becomes a broad wash across the whole far half
  // of the apron, which is the opposite of the recession this bake is building.
  const mat = toonMat({ color: 0xffffff, roughness: 0.93, rim: false, map: makeSlabTexture() });
  mat.vertexColors = true;
  const m = new THREE.Mesh(geo, mat);
  m.name = 'apron_service_floor';
  m.castShadow = false;
  m.receiveShadow = true;
  return m;
}

// ─────────────────────────────────────────────────────────────────────────────
// Perimeter ring helper
// ─────────────────────────────────────────────────────────────────────────────

/**
 * Four boxes forming a closed rectangular band between world-unit offsets `o0` and
 * `o1` outside the bounds, spanning metres `yLo`..`yHi`. North and south run the full
 * corner-to-corner width, west and east fill between them — no overlap, one buffer.
 */
function ringBand(o0: number, o1: number, yLo: number, yHi: number): THREE.BufferGeometry {
  const t = o1 - o0;
  const h = yHi - yLo;
  const cy = (yLo + yHi) / 2;
  const parts: THREE.BufferGeometry[] = [];
  const add = (cx: number, cz: number, sx: number, sz: number) => {
    const g = new THREE.BoxGeometry(wu(sx), h, wu(sz));
    g.translate(wu(cx), cy, wu(cz));
    parts.push(g);
  };
  const span = ARENA_W + 2 * o1;
  add(ARENA_W / 2, -(o0 + o1) / 2, span, t);
  add(ARENA_W / 2, ARENA_H + (o0 + o1) / 2, span, t);
  add(-(o0 + o1) / 2, ARENA_H / 2, t, ARENA_H);
  add(ARENA_W + (o0 + o1) / 2, ARENA_H / 2, t, ARENA_H);
  return mergeGeometries(parts, false)!;
}

/** Walk the perimeter at offset `o`, calling `fn` roughly every `step` world units. */
function alongPerimeter(
  o: number,
  step: number,
  fn: (x: number, y: number, yawDeg: number, i: number) => void
): void {
  let i = 0;
  const runs: Array<[number, number, number, number, number]> = [
    // x0, y0, dx, dy, length
    [-o, -o, 1, 0, ARENA_W + 2 * o],
    [ARENA_W + o, -o, 0, 1, ARENA_H + 2 * o],
    [ARENA_W + o, ARENA_H + o, -1, 0, ARENA_W + 2 * o],
    [-o, ARENA_H + o, 0, -1, ARENA_H + 2 * o],
  ];
  for (const [x0, y0, dx, dy, len] of runs) {
    const n = Math.max(1, Math.round(len / step));
    for (let k = 0; k < n; k++) {
      const t = (k + 0.5) / n;
      fn(x0 + dx * len * t, y0 + dy * len * t, dx !== 0 ? 0 : 90, i++);
    }
  }
}

// ─────────────────────────────────────────────────────────────────────────────
// The kerb
// ─────────────────────────────────────────────────────────────────────────────

/**
 * The boundary itself: a continuous, unbroken steel kick-kerb standing on the exact
 * play bound, with buttress pilasters for rhythm.
 *
 * ── The proportions are the whole design, and round 1 got them backwards ────────
 *
 * At 58 deg of pitch the camera sees mostly the kerb's TOP face, so whatever colour
 * the top is, that is what the kerb is. Round 1 put a pale steel cap across the full
 * 30 wu width and measured it on screen at HSV value 0.76 against a playfield tile at
 * 0.71 — the boundary was the brightest object in the frame, and at the south bound
 * (where it sits nearest the camera and so is magnified most) it read as a pale
 * walkway rather than as a barrier.
 *
 * So the top is now mid-dark steel and the only light-catching element is `kerbLip`, a
 * 7 wu chamfer along the INNER edge. A thin bright line on a dark mass reads as a
 * machined metal edge; a wide one reads as a painted stripe. It also has a second job:
 * it is the one high-contrast feature at the boundary that still separates through the
 * closing fog's 0.72-alpha canopy, which crushes every value difference to ~28%.
 *
 * `kerbFoot` is a dark line laid on the service floor just outside the body, i.e. a
 * baked contact shadow. `apronShade` already darkens the floor asymmetrically along
 * the key azimuth; this is the hard core of that contact, and it is what stops the
 * kerb reading as a bar floating on a plane.
 *
 * UNBROKEN is the load-bearing property. A gap anywhere would read as a doorway, and a
 * player who believes there is a way out is a player mis-reading the map.
 */
function buildKerb(): THREE.Group {
  const g = new THREE.Group();
  g.name = 'apron_kerb';

  // Pilasters: short thickenings of the kerb itself every ~230 wu. They give the run a
  // rhythm and a repeated vertical, and because they are the kerb's own material they
  // merge into its buffer and cost nothing. Round 1 used capped bollards here, which
  // at gameplay distance read as a row of eggs sitting on a shelf.
  const bodyParts: THREE.BufferGeometry[] = [ringBand(0, KERB_W, FLOOR_Y, KERB_TOP)];
  alongPerimeter(KERB_W / 2, 230, (x, y, yaw) => {
    const long = 54;
    const b = new THREE.BoxGeometry(
      wu(yaw === 0 ? long : KERB_W + 8),
      0.52 - FLOOR_Y,
      wu(yaw === 0 ? KERB_W + 8 : long)
    );
    b.translate(wu(x), (0.52 + FLOOR_Y) / 2, wu(y));
    bodyParts.push(b);
  });

  const bands: Array<[THREE.BufferGeometry, string, number, string]> = [
    [mergeGeometries(bodyParts, false)!, APAL.kerbBody, 0.62, 'apron_kerb_body'],
    [ringBand(-1, 6, KERB_TOP, KERB_TOP + 0.055), APAL.kerbLip, 0.34, 'apron_kerb_lip'],
    [ringBand(KERB_W, KERB_W + 13, FLOOR_Y, FLOOR_Y + 0.012), APAL.kerbFoot, 0.98, 'apron_kerb_foot'],
  ];
  for (const [geo, color, roughness, name] of bands) {
    const m = new THREE.Mesh(geo, toonMat({ color, roughness, metalness: 0.22 }));
    m.name = name;
    m.castShadow = false;
    m.receiveShadow = true;
    g.add(m);
  }
  return g;
}

// ─────────────────────────────────────────────────────────────────────────────
// REMOVED IN ROUND 2 — a perimeter drain channel
// ─────────────────────────────────────────────────────────────────────────────
//
// Round 1 ran a recessed 40 wu drain channel with grate bars 62 wu outside the kerb,
// on the reasoning that a dark line parallel to the boundary would give the near band
// a rhythm and a readable scale. In the render it did the opposite: a dark channel with
// a regular pale tick along it is the exact visual grammar of a RAILWAY TRACK, and at
// the south bound — where the near band is magnified because it is closest to the
// camera — the bottom third of the frame became sleepers-and-rails. Two loud parallel
// bands (pale kerb, striped channel) also turned the boundary into a runway.
//
// The lesson generalises and is worth leaving here: the near band of the apron is
// magnified far more than its 123 wu of ground depth suggests, so it wants FEWER
// concentric features, not more. The rhythm the drain was meant to supply now comes
// from the kerb's own pilasters and from clutter placed close in (`NEAR_IN`).

// ─────────────────────────────────────────────────────────────────────────────
// Back of house
// ─────────────────────────────────────────────────────────────────────────────

/**
 * The kitchen going on past the boundary: clustered crates, drums, trolleys and
 * shelving uprights, in three depth ranks.
 *
 * All of it is one `InstancedMesh` per shape family, coloured per instance, so ~260
 * masses cost two draw calls. Per-instance colour also carries the same distance ramp
 * and mottle the floor uses (`apronShade`), so a crate 400 wu out is visibly deeper in
 * shadow than one 160 wu out — the aerial perspective the scene fog cannot provide
 * (trap 3).
 *
 * Nothing here is closer than `NEAR_IN` to the bound. That is not a fairness rule (the
 * kerb already settles that) but a readability one: cover in this arena is a warm,
 * outlined, plum-plinthed object standing on open tile, and keeping the apron's masses
 * well back, cool, unoutlined and behind a kerb means the two families never sit close
 * enough to be compared.
 */
function buildBackOfHouse(): THREE.Group {
  const g = new THREE.Group();
  g.name = 'apron_backofhouse';

  const NEAR_IN = 76;
  const rnd = lcg(0x51ce);
  const shade = new THREE.Color();
  const massColors = [APAL.massA, APAL.massB, APAL.massC, APAL.massD].map(
    (h) => new THREE.Color(h)
  );

  interface Item {
    x: number;
    y: number;
    w: number;
    d: number;
    h: number;
    yaw: number;
    color: THREE.Color;
    /** Metres above the service floor the piece sits at — used for stacked crates. */
    baseY?: number;
  }
  const masses: Item[] = [];
  const uprights: Item[] = [];

  /** Instance colour: the floor's own bake, plus a little extra recession. */
  const tint = (px: number, py: number, base: THREE.Color, jitter = 1) => {
    const d = outsideDist(px, py);
    const amt = apronShade(px, py) * (0.98 - 0.3 * clamp01(d / FADE_OUT)) * jitter;
    return base.clone().multiplyScalar(amt);
  };

  // Jittered grid over the whole apron ring. Sampling in world space rather than along
  // the perimeter keeps the corners — the frames that measured worst — as densely
  // dressed as the sides.
  const STEP = 88;
  for (let x = -DRESS_OUT; x <= ARENA_W + DRESS_OUT; x += STEP) {
    for (let y = -DRESS_OUT; y <= ARENA_H + DRESS_OUT; y += STEP) {
      const px = x + (rnd() - 0.5) * STEP * 0.9;
      const py = y + (rnd() - 0.5) * STEP * 0.9;
      const d = outsideDist(px, py);
      if (d < NEAR_IN || d > DRESS_OUT) continue;

      // Denser further out, so the far field silhouettes into a solid back wall of
      // stock while the near band stays open enough to read as a service walkway.
      const density = 0.5 + 0.34 * clamp01((d - NEAR_IN) / 300);
      if (rnd() > density) continue;

      const pick = massColors[(rnd() * massColors.length) | 0];

      if (rnd() < 0.17) {
        uprights.push({
          x: px,
          y: py,
          w: 10 + rnd() * 7,
          d: 10 + rnd() * 7,
          h: 1.5 + rnd() * 1.3,
          yaw: rnd() * Math.PI,
          color: tint(px, py, new THREE.Color(APAL.upright)),
        });
        continue;
      }

      // Stock, not rubble. Round 1 drew wide shallow slabs at free yaw and they read as
      // fallen boards; crates and drums are near-square in plan, stand tall relative to
      // their footprint, and get pushed roughly square to the walls by the people
      // stacking them. So: square-ish plan, modest yaw, and the cluster STACKS
      // vertically rather than scattering sideways.
      const bw = 38 + rnd() * 46;
      const bd = bw * (0.78 + rnd() * 0.44);
      const bh = 0.62 + rnd() * 1.15;
      const yaw = (rnd() - 0.5) * 0.34;
      masses.push({ x: px, y: py, w: bw, d: bd, h: bh, yaw, color: tint(px, py, pick) });

      if (rnd() < 0.5) {
        // A second crate stacked on the first, slightly offset and turned.
        const sub = massColors[(rnd() * massColors.length) | 0];
        masses.push({
          x: px + (rnd() - 0.5) * bw * 0.3,
          y: py + (rnd() - 0.5) * bd * 0.3,
          w: bw * (0.66 + rnd() * 0.26),
          d: bd * (0.66 + rnd() * 0.26),
          h: 0.42 + rnd() * 0.7,
          yaw: yaw + (rnd() - 0.5) * 0.5,
          color: tint(px, py, sub, 1.08),
          baseY: bh,
        });
      }
      if (rnd() < 0.45) {
        // A companion piece beside it — a drum, a bin, a folded trolley.
        const ang = rnd() * Math.PI * 2;
        const r = bw * 0.62 + 14 + rnd() * 22;
        const sub = massColors[(rnd() * massColors.length) | 0];
        masses.push({
          x: px + Math.cos(ang) * r,
          y: py + Math.sin(ang) * r,
          w: 24 + rnd() * 26,
          d: 24 + rnd() * 26,
          h: 0.5 + rnd() * 0.95,
          yaw: (rnd() - 0.5) * 0.8,
          color: tint(px, py, sub, 0.92),
        });
      }
    }
  }

  // ── The near run ────────────────────────────────────────────────────────────
  //
  // Deliberate, not sampled: the jittered grid above is a Poisson-ish field, and a
  // Poisson field WILL leave holes. One of them landed on the south bound, where only
  // 123 wu of apron is ever visible, and the whole bottom third of that frame came back
  // as bare floor. A guaranteed run 112 wu out means every stretch of the boundary has
  // something behind it. Kept low (max 1.35 m) — this is the only dressing close enough
  // to the bound for height to matter at all.
  alongPerimeter(112, 92, (x, y, yaw) => {
    if (rnd() > 0.62) return;
    const w = 30 + rnd() * 34;
    const item: Item = {
      x: x + (rnd() - 0.5) * 46 + (yaw === 0 ? 0 : (rnd() - 0.5) * 34),
      y: y + (rnd() - 0.5) * 46 + (yaw === 0 ? (rnd() - 0.5) * 34 : 0),
      w,
      d: w * (0.8 + rnd() * 0.4),
      h: 0.45 + rnd() * 0.9,
      yaw: (rnd() - 0.5) * 0.5,
      color: new THREE.Color(),
    };
    item.color = tint(item.x, item.y, massColors[(rnd() * massColors.length) | 0]);
    masses.push(item);
  });

  // ── The stock line ──────────────────────────────────────────────────────────
  //
  // A near-continuous run of tall stacked stock 325 wu out, which is the apron's
  // HORIZON. Without it the far field is an unbroken floor running to the top of the
  // frame with nothing to stop the eye, which is how round 1's north-edge frame ended
  // up reading as a black void even after its lighting bug was fixed. 325 wu is chosen
  // off the reach table in the header: past the 275/319 wu up-screen reach, so it never
  // crowds the play space, and well inside the 470 wu lateral reach, so it always shows
  // on the two edges that reveal the most apron.
  alongPerimeter(325, 104, (x, y, yaw) => {
    const along = 78 + rnd() * 46;
    const deep = 48 + rnd() * 26;
    masses.push({
      x: x + (rnd() - 0.5) * 26,
      y: y + (rnd() - 0.5) * 26,
      w: yaw === 0 ? along : deep,
      d: yaw === 0 ? deep : along,
      h: 1.75 + rnd() * 0.95,
      yaw: (rnd() - 0.5) * 0.18,
      color: tint(x, y, massColors[(rnd() * massColors.length) | 0], 0.94),
    });
  });

  const build = (items: Item[], geo: THREE.BufferGeometry, name: string, cast: boolean) => {
    const mesh = new THREE.InstancedMesh(
      geo,
      toonMat({ color: 0xffffff, roughness: 0.82 }),
      items.length
    );
    mesh.name = name;
    mesh.castShadow = cast;
    mesh.receiveShadow = true;
    const m = new THREE.Matrix4();
    const q = new THREE.Quaternion();
    const pos = new THREE.Vector3();
    const scale = new THREE.Vector3();
    const up = new THREE.Vector3(0, 1, 0);
    items.forEach((it, i) => {
      const base = it.baseY ?? 0;
      const h = Math.min(MAX_HEIGHT - base, it.h);
      q.setFromAxisAngle(up, it.yaw);
      pos.set(wu(it.x), FLOOR_Y + base + h / 2, wu(it.y));
      scale.set(wu(it.w), h, wu(it.d));
      m.compose(pos, q, scale);
      mesh.setMatrixAt(i, m);
      shade.copy(it.color);
      mesh.setColorAt(i, shade);
    });
    mesh.instanceMatrix.needsUpdate = true;
    if (mesh.instanceColor) mesh.instanceColor.needsUpdate = true;
    return mesh;
  };

  // Unit-sized sources, scaled per instance. A slightly bevelled box reads as a crate
  // rather than a texture-mapped cube once it is only ~40 px across.
  const boxGeo = new THREE.BoxGeometry(1, 1, 1);
  const upGeo = new THREE.CylinderGeometry(0.5, 0.56, 1, 7);

  // castShadow is FALSE on both, and that is a fix rather than a saving. See the note
  // on `APAL.floorFar`: with it on, ~280 masses at the key's 30 deg elevation each
  // threw a shadow 1.73x their height across a field spaced 88 wu apart, and the far
  // apron rendered at RGB (4,3,3).
  g.add(build(masses, boxGeo, 'apron_mass', false));
  g.add(build(uprights, upGeo, 'apron_upright', false));
  g.add(buildGrounding([...masses, ...uprights]));
  return g;
}

/**
 * Baked contact shadows, one instanced quad per mass.
 *
 * With real shadow casting off (see above) every crate out here was standing on the
 * floor with nothing under it, which is precisely the "props read as floating" finding
 * that `shared.ts` built its whole decal system to answer. This is the same idea at a
 * tenth of the cost: one soft rounded-rect texture, one `InstancedMesh`, offset along
 * the key's real azimuth so the darkening leaves the lit side and runs on the shaded
 * one rather than sitting as a symmetric grey halo.
 *
 * `depthWrite: false` is not optional. A transparent material that writes depth still
 * occludes whatever is behind it — this project's single most repeated bug, and one
 * that would silently punch ~280 holes in the floor here.
 */
function buildGrounding(items: Array<{ x: number; y: number; w: number; d: number; baseY?: number }>): THREE.Mesh {
  const N = 64;
  const canvas = document.createElement('canvas');
  canvas.width = N;
  canvas.height = N;
  const ctx = canvas.getContext('2d')!;
  const img = ctx.createImageData(N, N);
  for (let y = 0; y < N; y++) {
    for (let x = 0; x < N; x++) {
      // Rounded-rect falloff: flat and near-opaque under the footprint, a short feather
      // outside it. A radial blob under a square crate reads as a stain, not a shadow.
      const u = Math.abs((x + 0.5) / N - 0.5) * 2;
      const v = Math.abs((y + 0.5) / N - 0.5) * 2;
      const q = Math.max(0, Math.hypot(Math.max(0, u - 0.34), Math.max(0, v - 0.34)) / 0.66);
      const a = Math.pow(clamp01(1 - q), 1.5);
      const i = (y * N + x) * 4;
      img.data[i] = img.data[i + 1] = img.data[i + 2] = 0;
      img.data[i + 3] = Math.round(a * 190);
    }
  }
  ctx.putImageData(img, 0, 0);
  const tex = new THREE.CanvasTexture(canvas);
  tex.needsUpdate = true;

  const mat = new THREE.MeshBasicMaterial({
    map: tex,
    transparent: true,
    depthWrite: false,
    color: 0x121820,
  });
  const geo = new THREE.PlaneGeometry(1, 1);
  geo.rotateX(-Math.PI / 2);

  const grounded = items.filter((it) => (it.baseY ?? 0) === 0);
  const mesh = new THREE.InstancedMesh(geo, mat, grounded.length);
  mesh.name = 'apron_grounding';
  mesh.castShadow = false;
  mesh.receiveShadow = false;
  mesh.renderOrder = 1;
  const m = new THREE.Matrix4();
  const q = new THREE.Quaternion();
  const pos = new THREE.Vector3();
  const scale = new THREE.Vector3();
  grounded.forEach((it, i) => {
    const sx = wu(it.w) * 1.7;
    const sz = wu(it.d) * 1.7;
    pos.set(
      wu(it.x) + SHADOW_X * sx * 0.18,
      FLOOR_Y + 0.008,
      wu(it.y) + SHADOW_Y * sz * 0.18
    );
    scale.set(sx, 1, sz);
    m.compose(pos, q, scale);
    mesh.setMatrixAt(i, m);
  });
  mesh.instanceMatrix.needsUpdate = true;
  return mesh;
}

// ─────────────────────────────────────────────────────────────────────────────
// Assembly
// ─────────────────────────────────────────────────────────────────────────────

/**
 * Build the whole apron. Static: no `update()` hook, nothing animated, nothing that
 * allocates after this returns.
 */
export function buildApron(): THREE.Group {
  const g = new THREE.Group();
  g.name = 'arena_apron';
  g.add(buildServiceFloor());
  g.add(buildKerb());
  g.add(buildBackOfHouse());
  // Belt and braces: `outlineGroup` is only ever called on `propsGroup`, but the ink
  // line is this arena's reserved signal for "this collides" and nothing out here does.
  g.traverse((o) => {
    o.userData.noOutline = true;
  });
  return g;
}
