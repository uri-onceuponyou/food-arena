/**
 * PERSISTENT GROUND MARKS — Donut's Sticky Trail and the splatter weapons' splats — drawn as
 * ONE union per frame that DARKENS AND TINTS THE FLOOR UNDER IT: one draw call, the floor's own
 * tile seams and value variation still visible through it, a soft edge, never brighter.
 *
 * ── V1b: A STAIN, NOT A HOLE (graphics campaign, `docs/REVAMP.md` §8 w5) ─────────────────
 *
 * V1 (below, kept) made the marks dark with `MIN` blending. The blind round after it named the
 * result in 6 of 8 cast notes — *"a dark purple smoke blob"*, *"a near-black purple smear behind
 * the fighter that reads like a hole torn in the floor"* — and measured, it was: on `f6aabdc`
 * (`tools/tmp/gx_vfx_cap.mjs --plan live` + `tools/tmp/v1b_stain.py`, V1's five stations) the
 * stain sat **0.19–0.23 OKLab L below the floor** with a core p05 of **0.23**, and of the floor's
 * own tile seams it kept **2–21%** of their contrast (seam ratio 0.02–0.21): `MIN` does not darken
 * the floor, it REPLACES it — `min(mark, floor)` is the mark wherever the mark is the darker of the
 * two, which for a dark mark is everywhere, so the floor's detail is gone inside the union and the
 * eye reads a flat cut-out. The rule V1 followed (`vfx.ts` hue contract rule 3, "persistent marks
 * are spent DARK") still stands; what was wrong is that the target is DARKER FLOOR, not the
 * darkest thing in the frame.
 *
 * A darkening blend keeps the floor: `out = floor x f` (MULTIPLY) scales every floor pixel by the
 * same factor, so a seam that is 0.05 L below its cell stays ~0.04 below it inside the stain
 * (`v1b_stain.py`'s planted arm: 0.81 of the fine band survives, MIN 0.20). But multiply
 * ACCUMULATES — two overlapping marks would multiply twice — which is exactly the "overlap lens"
 * (every mark's outline printing inside the pile) that V1 adopted `MIN` to kill. No blend
 * equation is both idempotent and detail-preserving: WebGL2 offers ADD, SUBTRACT, MIN and MAX, and
 * only MIN/MAX are idempotent, and both replace.
 *
 * So the UNION is computed per pixel instead of by the blend, and the blend is applied ONCE:
 *
 *   * The ground is cut into 1 m TILES (`TILE_M`). Every frame, each live mark is listed in every
 *     tile its reach can touch; ONE INSTANCE per occupied tile draws that tile's square, and its
 *     fragment shader walks the tile's list to get the union's signed distance (`sdMin`) and the
 *     coverage-weighted dye at that pixel.
 *   * Tiles PARTITION the plane — corners are exact multiples of a power-of-two size, so adjacent
 *     tiles share bit-identical edge vertices and the rasterizer's fill rule gives every pixel to
 *     exactly one of them. Each stain pixel is therefore multiplied exactly once, by
 *     `mix(1, dye, coverage(sdMin))`: no overlap lens, by construction, under a non-idempotent
 *     blend. The soft edge and the dye are functions of the UNION, so neither prints inside it.
 *   * Still ONE draw: all tiles are instances of one quad, and the per-tile mark lists ride in one
 *     float `DataTexture` (texelFetch, no filtering — core WebGL2).
 *   * `f <= 1` per channel (the dye is solved inside (0, 1], and the shader clamps): a multiply by
 *     at most 1 cannot brighten, so "never the brightest thing on the floor" is still a property of
 *     the equation, as V1 had it with `MIN`.
 *
 * Alpha is still `ZERO, ONE` — destination alpha untouched — because R1's fighter contour reads a
 * tag there (`render/roles.ts:preserveDestinationAlpha`).
 *
 * ⚠️ WHAT THIS GIVES UP, STATED: the stain no longer carries its own world-space "wet sheen" churn.
 * V1 added it so a REPLACING union would not be a flat cut-out; a darkening union shows the floor's
 * own surface instead, and a slow-moving darker field inside a dark stain is a likely half of the
 * "smoke" read 4 of 8 notes used. And its VALUE now depends on the floor it lies on: the dye is
 * solved against one reference floor (`vfx.ts` `STAIN_REF_FLOOR`), and on a brighter or darker
 * surface the same factor gives a proportionally larger or smaller step — a darker version of
 * THAT surface, which is what a stain is.
 *
 * ═══════════════════════════════════════════════════════════════════════════════════════════
 * V1's HEADER, KEPT — it describes the MIN union this file drew until V1b, and why.
 * ═══════════════════════════════════════════════════════════════════════════════════════════
 *
 * Graphics campaign V1 (`docs/REVAMP.md` §2.5 / §5). Measured on `d1b2621` with
 * `tools/tmp/gx_vfx_cap.mjs --plan live` + `gx_vfx_salience.py`, five canonical Donut-vs-Taco
 * instants: the trail was drawn at OKLab L **0.686–0.691 over a floor at 0.478–0.519** — i.e.
 * BRIGHTER than the ground it lies on by 0.17–0.21 — and owned **58–72% of the frame's top-2%
 * most chromatic pixels** from 5–7% of its area (salience ratio 8.5–13.4). A floor hazard was
 * the loudest object in the frame, against `vfx.ts`'s own hue-contract rule 3 ("persistent
 * marks are environment ... they must be spent DARK").
 *
 * ── HOW ONE RIM AROUND A PILE OF OVERLAPPING MARKS FALLS OUT OF THE BLEND ──────────
 *
 * The old path drew one textured quad per mark with `src = ONE, dst = 1 − srcα` and tried, over
 * five polarities recorded in `vfx.ts`'s history, to stop the marks reading as "N shapes" —
 * every overlap of two partially-covering layers changes the composite, so every mark's edge
 * printed a contour INSIDE the pile ("hard-edged overlapping circular boundaries", "stacked
 * circles"). No colour choice can fix that under an accumulating blend; it is what the blend
 * computes.
 *
 * This draws with **`MIN`** (`out = min(src, dst)` per channel; WebGL2 core):
 *
 *   * IDEMPOTENT — `min(m, min(m, floor)) = min(m, floor)`. A second mark over the first adds
 *     nothing, so a pile of 28 marks is exactly as dark as one: no accumulation, no overlap lens.
 *   * THE BODY IS A FUNCTION OF WORLD POSITION, not of the mark — every overlapping mark
 *     computes the SAME value at a given pixel, so the union's interior is one continuous field
 *     with no seam where one mark's quad ends inside another.
 *   * THE RIM IS UNION-ONLY BY CONSTRUCTION. Each mark's rim band is LIGHTER than the body
 *     (and darker than the floor), so inside a neighbour `min(rim, body) = body` — the rim is
 *     hidden — and only along the union's outer boundary does `min(rim, floor) = rim` print.
 *     A rim DARKER than the body would do the opposite and draw every mark's outline, which
 *     is why the ordering body < rim < floor is load-bearing, not a taste call.
 *   * NEVER BRIGHTER THAN THE FLOOR — a per-channel min cannot exceed what it is drawn over.
 *     "Never the brightest thing on the floor" is a property of the equation, not a tuning.
 *
 * Alpha uses `ZERO, ONE` (destination alpha preserved) — R1's fighter contour reads a tag in
 * destination alpha (`render/roles.ts:preserveDestinationAlpha`), and a mark under a fighter's
 * feet must not erase it.
 *
 * ── WHAT THIS GIVES UP, STATED ──────────────────────────────────────────────────────
 * `MIN` ignores blend factors, so a mark cannot be partly transparent: where it is darker than
 * the floor it REPLACES the floor's micro-detail with its own field. A1 made the floor
 * dead-flat over ≥40% of a frame, so the loss is small; the body carries its own slow
 * world-space churn so the union is not a flat cut-out ("flat, unshaded" was a named
 * complaint about the old marks, and a hazard should still read as wet).
 *   ⚠️ V1b: "the loss is small" was the premise the next blind round falsified — see the top of
 *   this file. The floor was dead-flat in its MEAN, but its seams were the detail the eye used to
 *   read "floor", and the union kept 2–21% of them.
 *
 * ── DRAWS ──────────────────────────────────────────────────────────────────────────
 * One `InstancedBufferGeometry` mesh per batch — the trail and the splats share ONE — so the
 * pile costs one draw whatever its size. The old path cost one draw PER MARK: a Donut drops
 * one every `TRAIL.dropIntervalMs` (160) for `TRAIL.durationMs` (4500), i.e. up to 28 draws
 * per Donut on a phone tier with no draw headroom (`docs/REVAMP.md` §2.8).
 *   V1b keeps that: one draw, now with one instance per occupied 1 m tile instead of one per mark.
 */

import * as THREE from 'three';

// ── OKLab, for choosing mark colours by VALUE and HUE rather than by hex ───────────────
type Lin = [number, number, number];

function srgbToLin(c: number): number { return c <= 0.04045 ? c / 12.92 : Math.pow((c + 0.055) / 1.055, 2.4); }

/** `#rrggbb` -> LINEAR sRGB. */
function hexToLin(hex: string): Lin {
  const h = hex.replace('#', '');
  return [
    srgbToLin(parseInt(h.slice(0, 2), 16) / 255),
    srgbToLin(parseInt(h.slice(2, 4), 16) / 255),
    srgbToLin(parseInt(h.slice(4, 6), 16) / 255),
  ];
}

/** LINEAR sRGB -> OKLab [L, a, b]. */
export function linToOklab(c: Lin): Lin {
  const [r, g, b] = c;
  const l = Math.cbrt(0.4122214708 * r + 0.5363325363 * g + 0.0514459929 * b);
  const m = Math.cbrt(0.2119034982 * r + 0.6806995451 * g + 0.1073969566 * b);
  const s = Math.cbrt(0.0883024619 * r + 0.2817188376 * g + 0.6299787005 * b);
  return [
    0.2104542553 * l + 0.7936177850 * m - 0.0040720468 * s,
    1.9779984951 * l - 2.4285922050 * m + 0.4505937099 * s,
    0.0259040371 * l + 0.7827717662 * m - 0.8086757660 * s,
  ];
}

/** `#rrggbb` -> OKLab [L, a, b]. */
export function hexToOklab(hex: string): Lin {
  return linToOklab(hexToLin(hex));
}

function oklabToLin(L: number, a: number, b: number): Lin {
  const l = (L + 0.3963377774 * a + 0.2158037573 * b) ** 3;
  const m = (L - 0.1055613458 * a - 0.0638541728 * b) ** 3;
  const s = (L - 0.0894841775 * a - 1.2914855480 * b) ** 3;
  return [
    4.0767416621 * l - 3.3077115913 * m + 0.2309699292 * s,
    -1.2684380046 * l + 2.6097574011 * m - 0.3413193965 * s,
    -0.0041960863 * l - 0.7034186147 * m + 1.7076147010 * s,
  ];
}

/**
 * The LINEAR sRGB colour at OKLab lightness `L` and chroma `C` on `hex`'s own hue. Chroma is
 * walked down until the colour is inside the sRGB gamut, so a dark yellow comes back as the
 * most saturated dark yellow that exists rather than as a clipped (hue-shifted) one.
 */
export function linAtLC(hex: string, L: number, C: number): Lin {
  const [, a0, b0] = hexToOklab(hex);
  const h = Math.atan2(b0, a0);
  for (let c = C; c >= 0; c -= 0.005) {
    const rgb = oklabToLin(L, c * Math.cos(h), c * Math.sin(h));
    if (rgb.every((v) => v >= 0 && v <= 1)) return rgb;
  }
  return oklabToLin(L, 0, 0);
}

/**
 * The stain's MULTIPLY factor at full coverage (linear, per channel, each in (0, 1]) for a mark
 * keyed to `hex`: the owner's colour as a DYE — normalised to its brightest channel and mixed into
 * white by `tint` — times the darkening `d` that puts `floorLin x factor` exactly `dL` OKLab L
 * below `floorLin`. `d` is solved by bisection on (0, 1], so the factor can never brighten; if the
 * dye alone already darkens past `dL`, `d` comes back as 1 and the step is the dye's own.
 */
export function stainFactor(hex: string, floorLin: Lin, dL: number, tint: number): Lin {
  const own = hexToLin(hex);
  const mx = Math.max(own[0], own[1], own[2], 1e-6);
  const dye: Lin = [
    1 + (own[0] / mx - 1) * tint,
    1 + (own[1] / mx - 1) * tint,
    1 + (own[2] / mx - 1) * tint,
  ];
  const target = linToOklab(floorLin)[0] + dL;
  let lo = 0;
  let hi = 1;
  for (let i = 0; i < 40; i++) {
    const d = (lo + hi) / 2;
    const L = linToOklab([floorLin[0] * dye[0] * d, floorLin[1] * dye[1] * d, floorLin[2] * dye[2] * d])[0];
    if (L > target) hi = d; else lo = d;
  }
  const d = (lo + hi) / 2;
  return [dye[0] * d, dye[1] * d, dye[2] * d];
}

// ── The tiling ─────────────────────────────────────────────────────────────────────────

/** Tile edge, metres. A POWER OF TWO: tile corners are then exact float32 values, so adjacent
 *  tiles share bit-identical edge vertices and the fill rule hands each pixel to exactly one of
 *  them (the whole idempotence argument rests on this — see the file header). 1 m against a
 *  1.0–1.1 m mark radius keeps a tile's list short (~4–8 marks for a straight trail). */
const TILE_M = 1;
/** The lobed silhouette's largest radius, in units of the mark's radius (1 + 0.15 + 0.06). */
const LOBE_MAX = 1.21;
/** Texels per row of the list texture. */
const LIST_W = 1024;
/** Most marks one tile walks. A tile overflowing it draws its first `MAX_PER_TILE` (index
 *  order, i.e. oldest trail marks first) — it would take ~50 mark centres within ~1.6 m of one
 *  1 m square, i.e. several Donuts laying track over the same spot at once. */
const MAX_PER_TILE = 48;
/** Tile-key packing for the per-frame sort: (ix + OFF) * SPAN + (iz + OFF), then * IDX + mark. */
const KEY_OFF = 4096;
const KEY_SPAN = 8192;
const KEY_IDX = 65536;

// ── The shader ─────────────────────────────────────────────────────────────────────────

const VERT = /* glsl */`
attribute vec4 aTile;   // tile corner x, z (metres, exact multiples of uTile), list start (texel), mark count
uniform float uY;
uniform float uTile;
varying vec2 vWorld;    // metres
flat varying ivec2 vList;
void main() {
  // position.xy is the unit square's corner (0 or 1): the sum is exact, so a shared edge is
  // bit-identical in both tiles that share it.
  vec2 w = aTile.xy + position.xy * uTile;
  vWorld = w;
  vList = ivec2(int(aTile.z + 0.5), int(aTile.w + 0.5));
  gl_Position = projectionMatrix * viewMatrix * modelMatrix * vec4(w.x, uY, w.y, 1.0);
}`;

const FRAG = /* glsl */`
#define LIST_W ${LIST_W}
#define MAX_PER_TILE ${MAX_PER_TILE}
uniform highp sampler2D uList;
uniform float uSoftIn;   // metres inside the union boundary where coverage starts to fall
uniform float uSoftOut;  // metres outside it where coverage reaches 0
uniform float uRimK;     // extra darkening at the rim's peak (1 = no rim)
uniform float uRimC;     // rim centre, metres inside the boundary
uniform float uRimW;     // rim half-width, metres
varying vec2 vWorld;
flat varying ivec2 vList;

vec4 listAt(int t) { return texelFetch(uList, ivec2(t % LIST_W, t / LIST_W), 0); }

void main() {
  float sdMin = 1e6;
  vec3 dyeSum = vec3(0.0);
  float wSum = 0.0;
  for (int k = 0; k < MAX_PER_TILE; k++) {
    if (k >= vList.y) break;
    int t = vList.x + 2 * k;
    vec4 m = listAt(t);          // x, z, radius (m), seed
    vec3 dye = listAt(t + 1).rgb; // the mark's multiply factor at full coverage
    vec2 d = vWorld - m.xy;
    float dist = length(d);
    // Lobed silhouette, mean radius 1.0 (= the sim's own damage radius), stable per mark.
    // atan(0, 0) is undefined in GLSL — guarded, or the exact centre texel can go NaN.
    float ang = dist > 1e-5 ? atan(d.y, d.x) : 0.0;
    float p = m.w * 6.2831853;
    float R = m.z * (1.0 + 0.15 * sin(3.0 * ang + p) + 0.06 * sin(5.0 * ang + 2.3 * p));
    float sd = dist - R;
    sdMin = min(sdMin, sd);
    float w = 1.0 - smoothstep(-uSoftIn, uSoftOut, sd);
    dyeSum += dye * w;
    wSum += w;
  }
  // Coverage and rim are functions of the UNION's distance, so neither prints inside the pile.
  float cov = 1.0 - smoothstep(-uSoftIn, uSoftOut, sdMin);
  if (cov <= 0.0) discard;
  vec3 f = dyeSum / max(wSum, 1e-5);
  float rim = 1.0 - smoothstep(0.0, uRimW, abs(sdMin + uRimC));
  f *= mix(1.0, uRimK, rim);
  // MULTIPLY (see the blend below): the floor x this. Clamped to <= 1 — never brighter.
  gl_FragColor = vec4(clamp(mix(vec3(1.0), f, cov), 0.0, 1.0), 1.0);
}`;

export interface GroundMarkInstance {
  x: number; z: number;
  /** Radius in metres, presence (grow/shrink) already applied. */
  r: number;
  /** 0..1, stable per mark — picks the lobe phase. */
  seed: number;
  /** LINEAR multiply factor at full coverage, each channel in (0, 1] (`stainFactor`). */
  stain: Lin;
}

/** The stain's edge and rim, in METRES (the shader works in world space, not radius units). */
export interface StainLook {
  softIn: number;
  softOut: number;
  rimK: number;
  rimC: number;
  rimW: number;
}

/**
 * One union-drawn batch of ground marks. `begin()`, `push()` per live mark, `end()` — every
 * frame. Capacities grow by doubling and never shrink (a mark pile is bounded by the sim's
 * lifetimes, so this settles within a match).
 */
export class GroundMarkBatch {
  readonly mesh: THREE.Mesh;
  private readonly geo = new THREE.InstancedBufferGeometry();
  private readonly mat: THREE.ShaderMaterial;
  private readonly look: StainLook;
  // Marks pushed this frame.
  private n = 0;
  private markCap = 0;
  private mPos = new Float32Array(0);   // x, z, r, seed
  private mDye = new Float32Array(0);   // r, g, b
  // (tile, mark) pairs, packed for one numeric sort.
  private pairs = new Float64Array(0);
  // Instances: one per occupied tile.
  private tileCap = 0;
  private tiles = 0;
  private aTile!: THREE.InstancedBufferAttribute;
  // Per-tile mark lists: 2 texels per entry.
  private listTex!: THREE.DataTexture;
  private listRows = 0;

  constructor(name: string, y: number, look: StainLook, initialTiles = 64) {
    this.look = look;
    const base = new THREE.BufferGeometry();
    base.setAttribute('position', new THREE.Float32BufferAttribute([0, 0, 0, 1, 0, 0, 1, 1, 0, 0, 1, 0], 3));
    // WINDING: the vertex shader maps (x, y) -> world (x, uY, +y), under which [0, 1, 2] has its
    // normal pointing DOWN — (1,0,0) x (1,0,1) = (0,-1,0) — and is back-face culled from above:
    // the same mirror V1 lost a build to ("drew NOTHING with every count correct"). [0, 2, 1]
    // faces UP, so the default FrontSide draws it.
    // ⚠️ The first V1b build used `side: DoubleSide` here and this comment then claimed that cost
    // a second draw (three renders a transparent DoubleSide material as a back pass + a front
    // pass, `WebGLRenderer.renderObject`). MEASURED, it did not: `ShaderMaterial` defaults
    // `forceSinglePass = true` (three r180, `ShaderMaterial.js`), and `tools/tmp/v1b_draws.mjs`
    // read +1 draw for it. The winding is fixed anyway — it is the honest statement of which way
    // the quad faces — and the guard's known-bad arm now forces `forceSinglePass = false` too.
    base.setIndex([0, 2, 1, 0, 3, 2]);
    this.geo.index = base.index;
    this.geo.setAttribute('position', base.getAttribute('position'));
    this.ensureTiles(initialTiles);
    this.ensureListRows(4);
    this.mat = new THREE.ShaderMaterial({
      vertexShader: VERT,
      fragmentShader: FRAG,
      uniforms: {
        uY: { value: y },
        uTile: { value: TILE_M },
        uList: { value: this.listTex },
        uSoftIn: { value: look.softIn },
        uSoftOut: { value: look.softOut },
        uRimK: { value: look.rimK },
        uRimC: { value: look.rimC },
        uRimW: { value: look.rimW },
      },
      transparent: true,
      depthWrite: false,
      depthTest: true,
      // FrontSide (the default) on purpose — see the WINDING note on the index above.
    });
    // ── THE BLEND — see the file header. RGB: MULTIPLY (`src x 0 + dst x src`), applied once per
    // pixel because the tiles partition the plane. ALPHA: ZERO, ONE, so the destination alpha
    // (R1's character tag) passes through untouched.
    this.mat.blending = THREE.CustomBlending;
    this.mat.blendEquation = THREE.AddEquation;
    this.mat.blendSrc = THREE.ZeroFactor;
    this.mat.blendDst = THREE.SrcColorFactor;
    this.mat.blendEquationAlpha = THREE.AddEquation;
    this.mat.blendSrcAlpha = THREE.ZeroFactor;
    this.mat.blendDstAlpha = THREE.OneFactor;
    this.mesh = new THREE.Mesh(this.geo, this.mat);
    // NAMED: every ablation in `tools/` selects ground marks by this name
    // (`gx_vfx_cap.mjs --modes noground`), never by material colour.
    this.mesh.name = name;
    // The base quad's bounds say nothing about where the instances are.
    this.mesh.frustumCulled = false;
    this.mesh.visible = false;
  }

  private ensureTiles(cap: number): void {
    if (cap <= this.tileCap) return;
    let next = Math.max(16, this.tileCap);
    while (next < cap) next *= 2;
    const a = new THREE.InstancedBufferAttribute(new Float32Array(next * 4), 4);
    a.setUsage(THREE.DynamicDrawUsage);
    if (this.aTile) (a.array as Float32Array).set(this.aTile.array as Float32Array);
    this.aTile = a;
    this.geo.setAttribute('aTile', a);
    this.tileCap = next;
  }

  private ensureListRows(rows: number): void {
    if (rows <= this.listRows) return;
    let next = Math.max(4, this.listRows);
    while (next < rows) next *= 2;
    const tex = new THREE.DataTexture(new Float32Array(LIST_W * next * 4), LIST_W, next, THREE.RGBAFormat, THREE.FloatType);
    tex.magFilter = THREE.NearestFilter;
    tex.minFilter = THREE.NearestFilter;
    tex.generateMipmaps = false;
    tex.needsUpdate = true;
    const old = this.listTex;
    this.listTex = tex;
    this.listRows = next;
    if (this.mat) this.mat.uniforms.uList.value = tex;
    old?.dispose();
  }

  private ensureMarks(cap: number): void {
    if (cap <= this.markCap) return;
    let next = Math.max(64, this.markCap);
    while (next < cap) next *= 2;
    const p = new Float32Array(next * 4); p.set(this.mPos); this.mPos = p;
    const d = new Float32Array(next * 3); d.set(this.mDye); this.mDye = d;
    this.markCap = next;
  }

  /** Marks pushed since the last `begin()`. */
  get count(): number { return this.n; }
  /** QA: tiles (= instances) the last `end()` drew. */
  get tileCount(): number { return this.tiles; }

  begin(): void { this.n = 0; }

  push(m: GroundMarkInstance): void {
    if (m.r <= 0) return;
    this.ensureMarks(this.n + 1);
    const i = this.n++;
    const p = this.mPos;
    p[i * 4] = m.x; p[i * 4 + 1] = m.z; p[i * 4 + 2] = m.r; p[i * 4 + 3] = m.seed;
    const d = this.mDye;
    d[i * 3] = m.stain[0]; d[i * 3 + 1] = m.stain[1]; d[i * 3 + 2] = m.stain[2];
  }

  end(_timeSeconds: number): void {
    const n = this.n;
    const pos = this.mPos;
    // ── 1. every (tile, mark) a mark's reach touches, packed so ONE numeric sort groups the
    // pairs by tile with each tile's marks in push order.
    let np = 0;
    for (let i = 0; i < n; i++) {
      const x = pos[i * 4], z = pos[i * 4 + 1], r = pos[i * 4 + 2];
      const reach = r * LOBE_MAX + this.look.softOut + 0.02;
      const ix0 = Math.floor((x - reach) / TILE_M), ix1 = Math.floor((x + reach) / TILE_M);
      const iz0 = Math.floor((z - reach) / TILE_M), iz1 = Math.floor((z + reach) / TILE_M);
      const need = np + (ix1 - ix0 + 1) * (iz1 - iz0 + 1);
      if (need > this.pairs.length) {
        const grown = new Float64Array(Math.max(256, this.pairs.length * 2, need * 2));
        grown.set(this.pairs.subarray(0, np));
        this.pairs = grown;
      }
      for (let ix = ix0; ix <= ix1; ix++) {
        for (let iz = iz0; iz <= iz1; iz++) {
          this.pairs[np++] = ((ix + KEY_OFF) * KEY_SPAN + (iz + KEY_OFF)) * KEY_IDX + i;
        }
      }
    }
    const sorted = this.pairs.subarray(0, np);
    sorted.sort();

    // ── 2. one instance per tile, its marks copied into the list texture.
    let tiles = 0;
    let texel = 0;
    let j = 0;
    while (j < np) {
      const key = Math.floor(sorted[j] / KEY_IDX);
      let k = j + 1;
      while (k < np && Math.floor(sorted[k] / KEY_IDX) === key) k++;
      const count = Math.min(k - j, MAX_PER_TILE);
      this.ensureTiles(tiles + 1);
      const rowsNeeded = Math.ceil((texel + 2 * count) / LIST_W);
      if (rowsNeeded > this.listRows) {
        // Grow and keep what this frame already wrote.
        const prev = this.listTex.image.data as Float32Array;
        this.ensureListRows(rowsNeeded);
        (this.listTex.image.data as Float32Array).set(prev.subarray(0, texel * 4));
      }
      const ix = Math.floor(key / KEY_SPAN) - KEY_OFF;
      const iz = (key % KEY_SPAN) - KEY_OFF;
      const at = this.aTile.array as Float32Array;
      at[tiles * 4] = ix * TILE_M;
      at[tiles * 4 + 1] = iz * TILE_M;
      at[tiles * 4 + 2] = texel;
      at[tiles * 4 + 3] = count;
      const list = this.listTex.image.data as Float32Array;
      for (let q = 0; q < count; q++) {
        const i = sorted[j + q] % KEY_IDX;
        const o = texel * 4;
        list[o] = pos[i * 4]; list[o + 1] = pos[i * 4 + 1]; list[o + 2] = pos[i * 4 + 2]; list[o + 3] = pos[i * 4 + 3];
        list[o + 4] = this.mDye[i * 3]; list[o + 5] = this.mDye[i * 3 + 1]; list[o + 6] = this.mDye[i * 3 + 2]; list[o + 7] = 0;
        texel += 2;
      }
      tiles++;
      j = k;
    }
    this.tiles = tiles;
    this.geo.instanceCount = tiles;
    if (tiles > 0) {
      this.aTile.needsUpdate = true;
      // Upload only the rows this frame wrote (one range per row: three merges ranges within a
      // row only).
      const rows = Math.ceil(texel / LIST_W);
      for (let r = 0; r < rows; r++) this.listTex.addUpdateRange(r * LIST_W * 4, LIST_W * 4);
      this.listTex.needsUpdate = true;
    }
    this.mesh.visible = tiles > 0;
  }

  dispose(): void {
    this.geo.dispose();
    this.mat.dispose();
    this.listTex.dispose();
  }
}
