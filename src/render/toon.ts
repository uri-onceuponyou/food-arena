/**
 * Stylised shading kit.
 *
 * Target look, verified against real reference plates in `reference/images/curated/`:
 * Brawl Stars & Zooba are smooth-shaded, hyper-saturated and high-key — moulded vinyl
 * toys with soft specular highlights, NOT banded cel shading, and with only a whisper
 * of a dark outline. Chunky rounded forms throughout. Everything in the game is built
 * with these helpers so the whole scene reads as one coherent art style.
 */

import * as THREE from 'three';

// ─────────────────────────────────────────────────────────────────────────────
// Gradient ramps — these drive the cel banding
// ─────────────────────────────────────────────────────────────────────────────

const rampCache = new Map<string, THREE.DataTexture>();

/**
 * Build a stepped gradient map for MeshToonMaterial.
 * `stops` are luminance multipliers from shadow → light.
 *
 * Brawl Stars reads as ~3 bands with a soft-ish terminator, so the default is a
 * 4-stop ramp that keeps shadows lifted (never crushed to black) — crushed shadows
 * are the #1 tell of amateur toon shading.
 */
export function makeToonRamp(stops: number[] = [0.55, 0.75, 0.92, 1.0]): THREE.DataTexture {
  const key = stops.join(',');
  const cached = rampCache.get(key);
  if (cached) return cached;

  const data = new Uint8Array(stops.length * 4);
  stops.forEach((s, i) => {
    const v = Math.round(THREE.MathUtils.clamp(s, 0, 1) * 255);
    data[i * 4 + 0] = v;
    data[i * 4 + 1] = v;
    data[i * 4 + 2] = v;
    data[i * 4 + 3] = 255;
  });

  const tex = new THREE.DataTexture(data, stops.length, 1, THREE.RGBAFormat);
  tex.minFilter = THREE.NearestFilter;
  tex.magFilter = THREE.NearestFilter;
  tex.generateMipmaps = false;
  tex.needsUpdate = true;
  rampCache.set(key, tex);
  return tex;
}

/** Softer ramp for large surfaces (floors, big props) so banding doesn't stripe. */
export const RAMP_SOFT = () => makeToonRamp([0.62, 0.78, 0.9, 1.0]);
/** Punchier ramp for characters so forms read at small on-screen size. */
export const RAMP_CHARACTER = () => makeToonRamp([0.5, 0.72, 0.9, 1.0]);

// ─────────────────────────────────────────────────────────────────────────────
// Materials
// ─────────────────────────────────────────────────────────────────────────────

export interface ToonMatOptions {
  color: THREE.ColorRepresentation;
  /** Emissive lift — use sparingly, mostly for glow accents and Neon/Cyber rarity. */
  emissive?: THREE.ColorRepresentation;
  emissiveIntensity?: number;
  ramp?: THREE.DataTexture;
  transparent?: boolean;
  opacity?: number;
  /** Render both faces — needed for thin shells like lettuce and nori. */
  doubleSide?: boolean;
  map?: THREE.Texture | null;
  flatShading?: boolean;
}

/**
 * The default character / prop surface.
 *
 * ── Why this is NOT MeshToonMaterial ────────────────────────────────────────
 * The brief said "toon/cel-shaded", but the actual Brawl Stars reference frames
 * (see `reference/images/curated/`) are not cel-shaded at all. They are smooth-shaded,
 * hyper-saturated, brightly lit surfaces with a soft specular highlight — the look of
 * moulded vinyl toys, not of banded cel shading. The brief is explicit that when the
 * written description and the reference bar disagree, the bar wins.
 *
 * MeshToonMaterial cannot produce a specular highlight at all, and that highlight is
 * doing a large share of the work in every reference image. So the default surface is
 * a standard material tuned for plastic, and `ramp` is accepted-but-ignored so the
 * call sites that pass one still compile.
 */
export function toonMat(opts: ToonMatOptions): THREE.MeshStandardMaterial {
  const m = new THREE.MeshStandardMaterial({
    color: new THREE.Color(opts.color),
    roughness: 0.52,
    metalness: 0.0,
    transparent: opts.transparent ?? false,
    opacity: opts.opacity ?? 1,
    side: opts.doubleSide ? THREE.DoubleSide : THREE.FrontSide,
    map: opts.map ?? null,
    flatShading: opts.flatShading ?? false,
  });
  if (opts.emissive !== undefined) {
    m.emissive = new THREE.Color(opts.emissive);
    m.emissiveIntensity = opts.emissiveIntensity ?? 1;
  }
  return m;
}

/**
 * Glossy variant with a specular pop. MeshToonMaterial has no specular, so for
 * things that need a wet/candy/glass highlight (lollipop, water bottle, glaze,
 * broth) use this physical material with low roughness and a clamped palette.
 */
export function glossyMat(opts: {
  color: THREE.ColorRepresentation;
  roughness?: number;
  metalness?: number;
  transparent?: boolean;
  opacity?: number;
  transmission?: number;
  emissive?: THREE.ColorRepresentation;
  emissiveIntensity?: number;
}): THREE.MeshPhysicalMaterial {
  const m = new THREE.MeshPhysicalMaterial({
    color: new THREE.Color(opts.color),
    roughness: opts.roughness ?? 0.28,
    metalness: opts.metalness ?? 0,
    clearcoat: 0.6,
    clearcoatRoughness: 0.2,
    transparent: opts.transparent ?? false,
    opacity: opts.opacity ?? 1,
    transmission: opts.transmission ?? 0,
  });
  if (opts.emissive !== undefined) {
    m.emissive = new THREE.Color(opts.emissive);
    m.emissiveIntensity = opts.emissiveIntensity ?? 1;
  }
  return m;
}

/** Unlit flat colour — for eyes, mouths, decals that must not pick up lighting. */
export function flatMat(color: THREE.ColorRepresentation, opts?: { transparent?: boolean; opacity?: number; doubleSide?: boolean }): THREE.MeshBasicMaterial {
  return new THREE.MeshBasicMaterial({
    color: new THREE.Color(color),
    transparent: opts?.transparent ?? false,
    opacity: opts?.opacity ?? 1,
    side: opts?.doubleSide ? THREE.DoubleSide : THREE.FrontSide,
  });
}

// ─────────────────────────────────────────────────────────────────────────────
// Outlines — inverted hull
// ─────────────────────────────────────────────────────────────────────────────

/**
 * Outline ink. Deliberately a deep desaturated navy rather than black — pure black
 * outlines read as flat stickers against saturated colour.
 */
export const OUTLINE_INK = '#241a33';

/**
 * Default outline thickness, in metres, for a ~2.1 m character.
 *
 * Tuned DOWN hard from an initial 0.035. In the actual gameplay reference frames,
 * characters carry almost no ink line — they separate from the environment through
 * value contrast, rim light and the ground ring beneath them. A heavy outline is one
 * of the loudest "hobby project" tells, so this is intentionally subtle.
 */
export const OUTLINE_THIN = 0.004;

/**
 * Inverted-hull outline. Clones the geometry, renders backfaces only, pushed out
 * along the vertex normals. Cheap, crisp, and — unlike post-process edge detection
 * — it survives against busy backgrounds, which is what Brawl Stars needs.
 *
 * `thickness` is in world units. Keep it proportional to the mesh: too thick reads
 * as a sticker, too thin disappears at gameplay camera distance.
 */
export function addOutline(mesh: THREE.Mesh, thickness = OUTLINE_THIN, color: THREE.ColorRepresentation = OUTLINE_INK): THREE.Mesh {
  // A dedicated ShaderMaterial rather than patching MeshBasicMaterial: basic
  // materials carry no normal chunks, so `objectNormal` is undefined there and the
  // hull silently never expands (an outline that renders as nothing at all).
  const mat = new THREE.ShaderMaterial({
    uniforms: {
      outlineColor: { value: new THREE.Color(color) },
      outlineThickness: { value: thickness },
    },
    // Expansion happens in VIEW space, not object space. Expanding `position` directly
    // means the offset is subsequently multiplied by the object's scale, so a mesh
    // scaled 3x gets a 3x fatter outline — which reads as a randomly uneven ink line
    // across a model built from differently-scaled parts.
    vertexShader: /* glsl */ `
      uniform float outlineThickness;
      void main() {
        vec4 mvPosition = modelViewMatrix * vec4(position, 1.0);
        vec3 n = normalize(normalMatrix * normal);
        mvPosition.xyz += n * outlineThickness;
        gl_Position = projectionMatrix * mvPosition;
      }
    `,
    fragmentShader: /* glsl */ `
      uniform vec3 outlineColor;
      void main() { gl_FragColor = vec4(outlineColor, 1.0); }
    `,
    side: THREE.BackSide,
    depthWrite: true,
  });

  const outline = new THREE.Mesh(mesh.geometry, mat);
  outline.name = `${mesh.name || 'mesh'}__outline`;
  outline.position.copy(mesh.position);
  outline.rotation.copy(mesh.rotation);
  outline.scale.copy(mesh.scale);
  outline.castShadow = false;
  outline.receiveShadow = false;
  outline.renderOrder = (mesh.renderOrder ?? 0) - 1;
  return outline;
}

/**
 * Recursively outline every mesh in a group. Meshes named `*__no_outline`, or
 * carrying `userData.noOutline`, are skipped — use that for eyes and decals that
 * sit flush on a surface, where an outline would z-fight.
 */
export function outlineGroup(group: THREE.Object3D, thickness = OUTLINE_THIN, color: THREE.ColorRepresentation = OUTLINE_INK): void {
  const targets: THREE.Mesh[] = [];
  group.traverse((o) => {
    const m = o as THREE.Mesh;
    if (!m.isMesh) return;
    if (m.userData?.noOutline) return;
    if (m.name.endsWith('__no_outline') || m.name.endsWith('__outline')) return;
    targets.push(m);
  });
  for (const m of targets) {
    m.parent?.add(addOutline(m, thickness, color));
  }
}

// ─────────────────────────────────────────────────────────────────────────────
// Shared geometry helpers — chunky rounded forms
// ─────────────────────────────────────────────────────────────────────────────

/**
 * Rounded box. Brawl Stars silhouettes are almost never hard-edged; rounding every
 * prop corner is one of the cheapest wins for matching the look.
 */
export function roundedBox(w: number, h: number, d: number, radius = 0.08, segments = 4): THREE.BufferGeometry {
  const r = Math.min(radius, w / 2, h / 2, d / 2);
  const geo = new THREE.BoxGeometry(w, h, d, segments, segments, segments);
  const pos = geo.attributes.position as THREE.BufferAttribute;
  const half = new THREE.Vector3(w / 2 - r, h / 2 - r, d / 2 - r);
  const v = new THREE.Vector3();
  const inner = new THREE.Vector3();
  for (let i = 0; i < pos.count; i++) {
    v.fromBufferAttribute(pos, i);
    inner.set(
      THREE.MathUtils.clamp(v.x, -half.x, half.x),
      THREE.MathUtils.clamp(v.y, -half.y, half.y),
      THREE.MathUtils.clamp(v.z, -half.z, half.z)
    );
    const dir = v.clone().sub(inner);
    if (dir.lengthSq() > 1e-8) {
      dir.normalize().multiplyScalar(r);
      v.copy(inner).add(dir);
      pos.setXYZ(i, v.x, v.y, v.z);
    }
  }
  geo.computeVertexNormals();
  return geo;
}

/** Squash-and-stretch helper for animation: preserves volume. */
export function applySquash(obj: THREE.Object3D, squash: number): void {
  const s = THREE.MathUtils.clamp(squash, -0.9, 0.9);
  obj.scale.set(1 + s * 0.5, 1 - s, 1 + s * 0.5);
}
