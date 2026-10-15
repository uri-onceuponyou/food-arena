/**
 * PERSISTENT GROUND MARKS — Donut's Sticky Trail and the splatter weapons' splats — drawn as
 * ONE dark union per frame: one draw call, one rim around the whole pile, below the floor.
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
 *
 * ── DRAWS ──────────────────────────────────────────────────────────────────────────
 * One `InstancedBufferGeometry` mesh per batch — the trail and the splats share ONE — so the
 * pile costs one draw whatever its size. The old path cost one draw PER MARK: a Donut drops
 * one every `TRAIL.dropIntervalMs` (160) for `TRAIL.durationMs` (4500), i.e. up to 28 draws
 * per Donut on a phone tier with no draw headroom (`docs/REVAMP.md` §2.8).
 */

import * as THREE from 'three';

// ── OKLab, for choosing mark colours by VALUE and HUE rather than by hex ───────────────
type Lin = [number, number, number];

function srgbToLin(c: number): number { return c <= 0.04045 ? c / 12.92 : Math.pow((c + 0.055) / 1.055, 2.4); }

/** `#rrggbb` -> OKLab [L, a, b]. */
export function hexToOklab(hex: string): Lin {
  const h = hex.replace('#', '');
  const r = srgbToLin(parseInt(h.slice(0, 2), 16) / 255);
  const g = srgbToLin(parseInt(h.slice(2, 4), 16) / 255);
  const b = srgbToLin(parseInt(h.slice(4, 6), 16) / 255);
  const l = Math.cbrt(0.4122214708 * r + 0.5363325363 * g + 0.0514459929 * b);
  const m = Math.cbrt(0.2119034982 * r + 0.6806995451 * g + 0.1073969566 * b);
  const s = Math.cbrt(0.0883024619 * r + 0.2817188376 * g + 0.6299787005 * b);
  return [
    0.2104542553 * l + 0.7936177850 * m - 0.0040720468 * s,
    1.9779984951 * l - 2.4285922050 * m + 0.4505937099 * s,
    0.0259040371 * l + 0.7827717662 * m - 0.8086757660 * s,
  ];
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

// ── The shader ─────────────────────────────────────────────────────────────────────────

const VERT = /* glsl */`
attribute vec4 aMark;   // world x, world z, radius (m, presence applied), seed 0..1
attribute vec3 aBody;   // linear body colour
attribute vec3 aRim;    // linear rim colour (between body and floor)
uniform float uY;
uniform float uHalf;    // quad half-size in radius units (headroom for the lobes)
varying vec2 vLocal;    // radius units
varying vec2 vWorld;    // metres
varying vec3 vBody;
varying vec3 vRim;
varying float vSeed;
void main() {
  vec2 local = position.xy * 2.0 * uHalf;
  vLocal = local;
  // local +y -> world -z: the plane's (x, y) -> (x, 0, -y) is a -90 deg turn about X, which
  // keeps its front face pointing UP at the camera. (x, 0, +y) is a mirror, and a mirrored
  // quad is back-face culled from above — drawn nothing, with every count reading correct.
  vec2 w = aMark.xy + vec2(local.x, -local.y) * aMark.z;
  vWorld = w;
  vBody = aBody;
  vRim = aRim;
  vSeed = aMark.w;
  gl_Position = projectionMatrix * viewMatrix * modelMatrix * vec4(w.x, uY, w.y, 1.0);
}`;

const FRAG = /* glsl */`
uniform float uTime;
uniform float uRimW;
uniform float uEdgeK;   // the AA fringe ramps toward rim x this — at or ABOVE any floor
varying vec2 vLocal;
varying vec2 vWorld;
varying vec3 vBody;
varying vec3 vRim;
varying float vSeed;

float hash(vec2 p) { return fract(sin(dot(p, vec2(127.1, 311.7))) * 43758.5453); }
float vnoise(vec2 p) {
  vec2 i = floor(p); vec2 f = fract(p);
  vec2 u = f * f * (3.0 - 2.0 * f);
  return mix(mix(hash(i), hash(i + vec2(1.0, 0.0)), u.x),
             mix(hash(i + vec2(0.0, 1.0)), hash(i + vec2(1.0, 1.0)), u.x), u.y);
}

void main() {
  // Lobed silhouette, mean radius 1.0 (= the sim's own damage radius), stable per mark.
  float ang = atan(vLocal.y, vLocal.x);
  float p = vSeed * 6.2831853;
  float R = 1.0 + 0.15 * sin(3.0 * ang + p) + 0.06 * sin(5.0 * ang + 2.3 * p);
  float sd = length(vLocal) - R;
  float aa = max(fwidth(sd), 1e-4);
  if (sd > aa) discard;

  // WORLD-SPACE body field: identical for every mark covering this pixel, so the pile's
  // interior is one surface. A slow churn, kept BELOW the rim's value (see the file header:
  // a body brighter than a neighbour's rim would let that rim print inside the union).
  float n = 0.55 * vnoise(vWorld * 1.1 + vec2(uTime * 0.07, -uTime * 0.05))
          + 0.45 * vnoise(vWorld * 3.2 + vec2(-uTime * 0.11, uTime * 0.09));
  // Sparse brighter POCKETS on a darker body — a wet sheen, not an even grain. Peak 1.48x
  // the body, under the rim's ~2.2x (see the file header for why that ordering matters).
  vec3 col = vBody * (0.78 + 0.70 * smoothstep(0.52, 0.86, n));

  // The rim band, just inside this mark's silhouette — LIGHTER than the body, so min
  // hides it wherever another mark's body covers it and only the union's boundary prints.
  float rimT = smoothstep(-uRimW - aa, -uRimW + aa, sd);
  col = mix(col, vRim, rimT);
  // Antialiased outer fringe: ramp toward a value above the floor, which min resolves to
  // the floor itself — so the fringe is as wide as it needs to be on any ground.
  col = mix(col, vRim * uEdgeK, smoothstep(-aa, aa, sd));
  gl_FragColor = vec4(col, 1.0);
}`;

/** Quad half-size in radius units: the lobes reach 1.0 + 0.15 + 0.06 = 1.21. */
const QUAD_HALF = 1.25;

export interface GroundMarkInstance {
  x: number; z: number;
  /** Radius in metres, presence (grow/shrink) already applied. */
  r: number;
  /** 0..1, stable per mark — picks the lobe phase. */
  seed: number;
  body: Lin;
  rim: Lin;
}

/**
 * One union-drawn batch of ground marks. `begin()`, `push()` per live mark, `end()` — every
 * frame; capacity grows by doubling and never shrinks (a mark pile is bounded by the sim's
 * lifetimes, so this settles within a match).
 */
export class GroundMarkBatch {
  readonly mesh: THREE.Mesh;
  private readonly geo = new THREE.InstancedBufferGeometry();
  private readonly mat: THREE.ShaderMaterial;
  private readonly base = new THREE.PlaneGeometry(1, 1);
  private cap = 0;
  private n = 0;
  private aMark!: THREE.InstancedBufferAttribute;
  private aBody!: THREE.InstancedBufferAttribute;
  private aRim!: THREE.InstancedBufferAttribute;

  constructor(name: string, y: number, rimWidth: number, edgeK: number, initialCap = 64) {
    this.geo.index = this.base.index;
    this.geo.setAttribute('position', this.base.getAttribute('position'));
    this.ensure(initialCap);
    this.mat = new THREE.ShaderMaterial({
      vertexShader: VERT,
      fragmentShader: FRAG,
      uniforms: {
        uY: { value: y },
        uHalf: { value: QUAD_HALF },
        uTime: { value: 0 },
        uRimW: { value: rimWidth },
        uEdgeK: { value: edgeK },
      },
      transparent: true,
      depthWrite: false,
      depthTest: true,
    });
    // ── THE BLEND — see the file header. RGB: MIN (factors ignored). ALPHA: ZERO, ONE, so
    // the destination alpha (R1's character tag) passes through untouched.
    this.mat.blending = THREE.CustomBlending;
    this.mat.blendEquation = THREE.MinEquation;
    this.mat.blendSrc = THREE.OneFactor;
    this.mat.blendDst = THREE.OneFactor;
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

  private ensure(cap: number): void {
    if (cap <= this.cap) return;
    let next = Math.max(16, this.cap);
    while (next < cap) next *= 2;
    const grow = (old: THREE.InstancedBufferAttribute | undefined, size: number): THREE.InstancedBufferAttribute => {
      const a = new THREE.InstancedBufferAttribute(new Float32Array(next * size), size);
      a.setUsage(THREE.DynamicDrawUsage);
      if (old) (a.array as Float32Array).set(old.array as Float32Array);
      return a;
    };
    this.aMark = grow(this.aMark, 4);
    this.aBody = grow(this.aBody, 3);
    this.aRim = grow(this.aRim, 3);
    this.geo.setAttribute('aMark', this.aMark);
    this.geo.setAttribute('aBody', this.aBody);
    this.geo.setAttribute('aRim', this.aRim);
    this.cap = next;
  }

  get count(): number { return this.n; }

  begin(): void { this.n = 0; }

  push(m: GroundMarkInstance): void {
    if (m.r <= 0) return;
    this.ensure(this.n + 1);
    const i = this.n++;
    const mk = this.aMark.array as Float32Array;
    mk[i * 4] = m.x; mk[i * 4 + 1] = m.z; mk[i * 4 + 2] = m.r; mk[i * 4 + 3] = m.seed;
    const b = this.aBody.array as Float32Array;
    b[i * 3] = m.body[0]; b[i * 3 + 1] = m.body[1]; b[i * 3 + 2] = m.body[2];
    const r = this.aRim.array as Float32Array;
    r[i * 3] = m.rim[0]; r[i * 3 + 1] = m.rim[1]; r[i * 3 + 2] = m.rim[2];
  }

  end(timeSeconds: number): void {
    this.geo.instanceCount = this.n;
    this.aMark.needsUpdate = true;
    this.aBody.needsUpdate = true;
    this.aRim.needsUpdate = true;
    this.mat.uniforms.uTime.value = timeSeconds;
    this.mesh.visible = this.n > 0;
  }

  dispose(): void {
    this.geo.dispose();
    this.base.dispose();
    this.mat.dispose();
  }
}
