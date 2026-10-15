/**
 * BLUE CHEESE — the stink cloud, drawn from STATE: every living fighter with
 * `hasItem(f, 'blue_cheese')`, at `ITEM_TUNING.blue_cheese.radius`, every frame.
 *
 * B3 (`83754a9`) made the aura real — 1 damage per second to every opponent inside the radius —
 * and B2/B3b made its tick deliberately QUIET (no hit flash, no shake, a soft placed sound;
 * `match.ts` `quietTick`), so this cloud is the ONLY sign on screen that it exists. Before V1
 * nothing drew it: an invisible 1 dmg/s field.
 *
 * `ITEMS.blue_cheese.look`: *"A low, slowly-churning blue-green haze that follows the wearer
 * all match. It is ON SCREEN CONSTANTLY, so it is the one item that must NOT be loud — a
 * permanent effect at accent saturation would eat the frame. Read it by motion and by its
 * boundary, not by chroma."* Taken literally:
 *
 *   * LOW CHROMA, LOW ALPHA — the interior is a churn of world-space noise at alpha <= ~0.13
 *     in a greyed blue-green;
 *   * READ BY ITS BOUNDARY — a thin, slightly lighter band at exactly the damage radius, so
 *     the edge a player must stay outside of is the edge they can see;
 *   * READ BY MOTION — the interior noise drifts and the boundary band undulates slowly.
 *
 * One instanced draw for every wearer on the field (a six-seat match with three wearers is
 * still one draw). Premultiplied over-blend; destination alpha preserved (ZERO, ONE) so a
 * fighter standing in the haze keeps R1's contour tag.
 */

import * as THREE from 'three';

const VERT = /* glsl */`
attribute vec4 aAura;   // world x, world z, radius (m), seed
uniform float uY;
uniform float uHalf;
varying vec2 vLocal;
varying vec2 vWorld;
varying float vSeed;
void main() {
  vec2 local = position.xy * 2.0 * uHalf;
  vLocal = local;
  // (x, y) -> (x, 0, -y): front face up (see groundMarks.ts — the mirror is culled).
  vec2 w = aAura.xy + vec2(local.x, -local.y) * aAura.z;
  vWorld = w;
  vSeed = aAura.w;
  gl_Position = projectionMatrix * viewMatrix * modelMatrix * vec4(w.x, uY, w.y, 1.0);
}`;

const FRAG = /* glsl */`
uniform float uTime;
uniform vec3 uHaze;     // linear
uniform vec3 uEdge;     // linear, a little lighter than the haze
uniform float uHazeA;
uniform float uEdgeA;
varying vec2 vLocal;
varying vec2 vWorld;
varying float vSeed;

float hash(vec2 p) { return fract(sin(dot(p, vec2(127.1, 311.7))) * 43758.5453); }
float vnoise(vec2 p) {
  vec2 i = floor(p); vec2 f = fract(p);
  vec2 u = f * f * (3.0 - 2.0 * f);
  return mix(mix(hash(i), hash(i + vec2(1.0, 0.0)), u.x),
             mix(hash(i + vec2(0.0, 1.0)), hash(i + vec2(1.0, 1.0)), u.x), u.y);
}

void main() {
  float d = length(vLocal);
  float ang = atan(vLocal.y, vLocal.x);
  // The boundary undulates a little (motion), around exactly the damage radius (1.0).
  float wob = 0.018 * sin(5.0 * ang + uTime * 0.9 + vSeed * 6.2831853)
            + 0.012 * sin(9.0 * ang - uTime * 1.3);
  float e = d - (1.0 + wob);
  float aa = max(fwidth(d), 1e-4);
  if (e > 0.06 + aa) discard;

  // Interior haze: two drifting octaves of world-space noise, thinning toward the centre so
  // the wearer is not sitting in the densest part of his own cloud.
  float n = 0.6 * vnoise(vWorld * 0.55 + vec2(uTime * 0.18, -uTime * 0.12))
          + 0.4 * vnoise(vWorld * 1.4 + vec2(-uTime * 0.25, uTime * 0.21));
  float body = smoothstep(1.0, 0.82, d) * smoothstep(0.10, 0.45, d);
  float hazeA = uHazeA * body * (0.35 + 0.65 * smoothstep(0.35, 0.8, n));

  // Boundary band: thin, antialiased, inside the radius.
  float band = smoothstep(-0.07 - aa, -0.07 + aa, e) * (1.0 - smoothstep(-aa, aa, e));
  float edgeA = uEdgeA * band * (0.75 + 0.25 * sin(ang * 3.0 - uTime * 0.6));

  float a = max(hazeA, edgeA);
  vec3 col = mix(uHaze, uEdge, edgeA > hazeA ? 1.0 : 0.0);
  gl_FragColor = vec4(col * a, a);   // premultiplied
}`;

/** The quad reaches past the band and its wobble. */
const QUAD_HALF = 1.1;

export class BlueCheeseClouds {
  readonly mesh: THREE.Mesh;
  private readonly geo = new THREE.InstancedBufferGeometry();
  private readonly base = new THREE.PlaneGeometry(1, 1);
  private readonly mat: THREE.ShaderMaterial;
  private readonly aAura: THREE.InstancedBufferAttribute;
  private n = 0;

  /** `capacity` is `MAX_FIGHTERS` at the call site: one cloud per seat at most. */
  constructor(y: number, capacity: number, haze: [number, number, number], edge: [number, number, number],
    hazeA: number, edgeA: number) {
    this.geo.index = this.base.index;
    this.geo.setAttribute('position', this.base.getAttribute('position'));
    this.aAura = new THREE.InstancedBufferAttribute(new Float32Array(capacity * 4), 4);
    this.aAura.setUsage(THREE.DynamicDrawUsage);
    this.geo.setAttribute('aAura', this.aAura);
    this.mat = new THREE.ShaderMaterial({
      vertexShader: VERT,
      fragmentShader: FRAG,
      uniforms: {
        uY: { value: y },
        uHalf: { value: QUAD_HALF },
        uTime: { value: 0 },
        uHaze: { value: new THREE.Vector3(...haze) },
        uEdge: { value: new THREE.Vector3(...edge) },
        uHazeA: { value: hazeA },
        uEdgeA: { value: edgeA },
      },
      transparent: true,
      depthWrite: false,
      depthTest: true,
      premultipliedAlpha: true,
    });
    this.mat.blending = THREE.CustomBlending;
    this.mat.blendEquation = THREE.AddEquation;
    this.mat.blendSrc = THREE.OneFactor;
    this.mat.blendDst = THREE.OneMinusSrcAlphaFactor;
    this.mat.blendEquationAlpha = THREE.AddEquation;
    this.mat.blendSrcAlpha = THREE.ZeroFactor;
    this.mat.blendDstAlpha = THREE.OneFactor;
    this.mesh = new THREE.Mesh(this.geo, this.mat);
    this.mesh.name = 'vfx_blue_cheese';
    this.mesh.frustumCulled = false;
    this.mesh.visible = false;
  }

  get count(): number { return this.n; }

  begin(): void { this.n = 0; }

  push(x: number, z: number, radius: number, seed: number): void {
    if (this.n * 4 >= this.aAura.array.length) return;   // capacity is MAX_FIGHTERS
    const a = this.aAura.array as Float32Array;
    const i = this.n++ * 4;
    a[i] = x; a[i + 1] = z; a[i + 2] = radius; a[i + 3] = seed;
  }

  end(timeSeconds: number): void {
    this.geo.instanceCount = this.n;
    this.aAura.needsUpdate = true;
    this.mat.uniforms.uTime.value = timeSeconds;
    this.mesh.visible = this.n > 0;
  }

  dispose(): void {
    this.geo.dispose();
    this.base.dispose();
    this.mat.dispose();
  }
}
