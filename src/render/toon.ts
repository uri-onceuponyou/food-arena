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
import { tierProfile as currentTierProfile } from './quality';

// ─────────────────────────────────────────────────────────────────────────────
// Render tier — re-exported, not owned
// ─────────────────────────────────────────────────────────────────────────────

/**
 * The tier now lives in `./quality`, which has NO imports at all — so a menu screen
 * can read and write the player's graphics preference without pulling three.js in,
 * and every character and arena module still gets `renderTier()` from here for the
 * price of one string comparison.
 *
 * Re-exported rather than moved silently: `renderTier` / `setRenderTier` /
 * `RenderTier` have been imported from `toon.ts` since the two-tier scaffold landed,
 * and this keeps every one of those call sites working.
 *
 * Override with `?tier=low|medium|high` — also the only way to measure a lower tier
 * under a headless desktop Chromium.
 */
export { renderTier, setRenderTier, tierProfile } from './quality';
export type { RenderTier } from './quality';

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
  /**
   * Surface roughness, 0 = mirror, 1 = fully matte. THIS IS THE MAIN TOOL for making
   * different materials read as different substances. A character whose every part
   * shares one roughness reads as "a blob wearing coloured rings" rather than as a
   * thing made of bread, meat and vegetables. Suggested: matte bread ~0.85, leafy
   * greens ~0.6, cooked meat ~0.55, wet tomato/sauce ~0.2, glaze/candy/glass ~0.1.
   */
  roughness?: number;
  metalness?: number;
  /** Fresnel rim light. On by default — set false for flat decals and eyes. */
  rim?: boolean;
  rimColor?: THREE.ColorRepresentation;
  rimStrength?: number;
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
    roughness: opts.roughness ?? 0.52,
    metalness: opts.metalness ?? 0.0,
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
  if (opts.rim !== false) applyRimLight(m, opts.rimColor, opts.rimStrength);
  return m;
}

/**
 * Fresnel rim term, injected into a standard material's fragment shader.
 *
 * An independent art director's third named gap was "move past single flat toon
 * gradients — add rim lighting and a couple more value steps per surface." A
 * directional rim light only catches surfaces facing that one direction; a
 * view-dependent Fresnel term lights every silhouette edge no matter how the
 * character is rotated, which is what actually separates a form from the background
 * at gameplay distance.
 *
 * Deliberately additive and subtle. This is edge definition, not a glow — an
 * overdone rim is its own species of amateur.
 */
export function applyRimLight(
  mat: THREE.MeshStandardMaterial | THREE.MeshPhysicalMaterial,
  color: THREE.ColorRepresentation = '#bfe4ff',
  strength = 0.28
): void {
  mat.onBeforeCompile = (shader) => {
    shader.uniforms.rimColor = { value: new THREE.Color(color) };
    shader.uniforms.rimStrength = { value: strength };
    shader.fragmentShader = shader.fragmentShader
      .replace(
        '#include <common>',
        `#include <common>
         uniform vec3 rimColor;
         uniform float rimStrength;`
      )
      .replace(
        '#include <dithering_fragment>',
        `#include <dithering_fragment>
         // vNormal / vViewPosition are in view space, so the rim follows the camera
         // and holds on every silhouette edge regardless of character rotation.
         float rimDot = 1.0 - clamp(dot(normalize(vNormal), normalize(vViewPosition)), 0.0, 1.0);
         float rim = pow(rimDot, 2.6) * rimStrength;
         gl_FragColor.rgb += rimColor * rim;`
      );
  };
  // Force a program recompile if this material was already used.
  mat.needsUpdate = true;
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
 * The arena's "this mass blocks you" ink — `arena/kitchen.ts` passes this literal to
 * `outlineGroup(propsGroup, 0.016)`. Named here so the tier policy below has a
 * threshold to test against rather than a magic number.
 */
export const OUTLINE_PROP = 0.016;

/** Any hull at or above this thickness is prop-scale ink, not character ink. */
const PROP_INK_MIN = 0.012;

/**
 * WHERE THE OUTLINE COST ACTUALLY IS — measured, and it is not where it looked.
 *
 * The perf commit counted 431 inverted hulls costing 132 draws/frame and noted that
 * the arena's 0.016 prop hulls are the bulk of the COUNT. They are — and they are a
 * minority of the DRAWS, because most of the arena is off-screen at any moment while
 * both fighters are always in frame. Measured in a live match at 1300x740 by hiding
 * one family at a time (`tools/tmp/perfpass_probe.mjs`, `renderer.info` with
 * `autoReset = false`):
 *
 *   all 431 hulls hidden ................ 692 -> 560 draws   (-132)
 *   318 arena prop hulls (0.016) hidden . 692 -> 646 draws   ( -46)
 *   113 character hulls (0.004/0.006) ... 692 -> 606 draws   ( -86)
 *
 * So two thirds of the outline cost is the CHARACTER silhouette, which this project
 * has worked hard on and which must not be touched, and the arena's 318 hulls are
 * worth 6.6% of the frame. That reframes the whole item: there is no large safe win
 * in deleting prop ink on desktop, and the honest lever for the arena is MERGING —
 * see `mergeOutlines` below, which turns those 318 hulls into ONE draw for a
 * measured image difference of 0.0002/255.
 *
 * What did land here for every tier: all the hulls in one `outlineGroup` call now
 * SHARE ONE MATERIAL. A match carried 431 `ShaderMaterial` instances for three
 * distinct configurations; it now carries three. Unique materials in the live match
 * fall 686 -> 259 with a pixel-identical image.
 */
type OutlineMaterial = THREE.ShaderMaterial;

/**
 * One material per (thickness, colour), shared by every hull that uses it.
 *
 * Previously every hull built its own `ShaderMaterial`, so a match carried 431 of
 * them for three distinct configurations. Identical materials are also what lets
 * three sort the hulls into one uninterrupted run instead of re-binding uniforms per
 * draw. Pixel-for-pixel identical output; it is the same shader with the same
 * uniforms.
 */
function outlineMaterial(thickness: number, color: THREE.ColorRepresentation): OutlineMaterial {
  // A dedicated ShaderMaterial rather than patching MeshBasicMaterial: basic
  // materials carry no normal chunks, so `objectNormal` is undefined there and the
  // hull silently never expands (an outline that renders as nothing at all).
  return new THREE.ShaderMaterial({
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
}

/**
 * Inverted-hull outline. Clones the geometry, renders backfaces only, pushed out
 * along the vertex normals. Cheap, crisp, and — unlike post-process edge detection
 * — it survives against busy backgrounds, which is what Brawl Stars needs.
 *
 * `thickness` is in world units. Keep it proportional to the mesh: too thick reads
 * as a sticker, too thin disappears at gameplay camera distance.
 *
 * `material` lets a caller share one material across a whole group; omit it and the
 * hull gets its own, which is what a one-off call wants.
 */
export function addOutline(
  mesh: THREE.Mesh,
  thickness = OUTLINE_THIN,
  color: THREE.ColorRepresentation = OUTLINE_INK,
  material?: OutlineMaterial,
): THREE.Mesh {
  const outline = new THREE.Mesh(mesh.geometry, material ?? outlineMaterial(thickness, color));
  outline.name = `${mesh.name || 'mesh'}__outline`;
  outline.position.copy(mesh.position);
  outline.rotation.copy(mesh.rotation);
  outline.scale.copy(mesh.scale);
  outline.castShadow = false;
  outline.receiveShadow = false;
  outline.renderOrder = (mesh.renderOrder ?? 0) - 1;
  return outline;
}

export interface OutlineGroupOptions {
  /**
   * Bake every hull in this group into ONE mesh, in the group's own space.
   *
   * ONLY VALID FOR A GROUP WHOSE PARTS NEVER MOVE RELATIVE TO EACH OTHER — the
   * arena's cover props, a static set dressing. A character rig animates its joints,
   * so merging one would freeze every limb outline in its bind pose. There is no way
   * to detect that from here, which is why this is an explicit opt-in and not a
   * heuristic: a heuristic that is wrong once produces a character whose ink line
   * detaches from its arm, and nobody would look for the cause in `toon.ts`.
   */
  merge?: boolean;
  /**
   * Drop this group's hulls entirely on any tier that clears `propInk` (today:
   * `low`). Intended for decoration-scale ink; see the tier policy in `outlineGroup`.
   */
  tierOptional?: boolean;
}

/**
 * Recursively outline every mesh in a group. Meshes named `*__no_outline`, or
 * carrying `userData.noOutline`, are skipped — use that for eyes and decals that
 * sit flush on a surface, where an outline would z-fight.
 *
 * ── TIER POLICY ─────────────────────────────────────────────────────────────
 * On a tier whose profile clears `propInk` (today: `low` only), PROP-SCALE ink
 * (>= 0.012, i.e. the arena's 0.016) is skipped and character/hazard ink is kept.
 * That is 318 hulls and 46 draws/frame off a
 * phone, and it is the correct half to spend: the ablation over eight combat moments
 * put ALL 431 hulls together at mean 0.25/255 over 0.50% of pixels, so the arena's
 * share of that is well under bloom's 0.11/255 — while the character silhouette is
 * the thing this project has spent the most rounds on.
 *
 * CAVEAT FOR THE ARENA OWNER, because this is not purely cosmetic: `kitchen.ts`
 * documents the 0.016 line as the arena's "this collides" affordance, deliberately
 * ~2.5x the pot's. If that affordance is load-bearing for play, it needs a carrier
 * that survives at gameplay distance — the measurement says the ink line already
 * does not deliver it on ANY tier, so this is a reason to re-do the affordance, not
 * a reason to keep paying 318 hulls for it.
 */
export function outlineGroup(
  group: THREE.Object3D,
  thickness = OUTLINE_THIN,
  color: THREE.ColorRepresentation = OUTLINE_INK,
  opts: OutlineGroupOptions = {},
): void {
  if (!currentTierProfile().propInk && (opts.tierOptional || thickness >= PROP_INK_MIN)) return;

  const targets: THREE.Mesh[] = [];
  group.traverse((o) => {
    const m = o as THREE.Mesh;
    if (!m.isMesh) return;
    if (m.userData?.noOutline) return;
    if (m.name.endsWith('__no_outline') || m.name.endsWith('__outline')) return;
    targets.push(m);
  });
  if (!targets.length) return;

  const mat = outlineMaterial(thickness, color);
  if (opts.merge) {
    const merged = bakeHulls(group, targets, mat);
    if (merged) {
      // `addOutline` puts a hull one step BEFORE its source mesh; a merged hull has
      // to sit before all of them.
      merged.renderOrder = Math.min(...targets.map((m) => m.renderOrder ?? 0)) - 1;
      group.add(merged);
      return;
    }
    // Fall through to per-mesh hulls if the geometry set could not be baked.
  }
  for (const m of targets) {
    m.parent?.add(addOutline(m, thickness, color, mat));
  }
}

/**
 * Collapse the hulls already created under `root` into one mesh per (thickness,
 * colour), in `root`'s own space.
 *
 * The retrofit form of `outlineGroup(..., { merge: true })`, for a caller that
 * cannot change its `outlineGroup` call — e.g. an arena assembler that builds its
 * props, outlines them, and only later knows the set is final. Same contract, same
 * warning: the parts must not move relative to `root`.
 *
 * ── MEASURED, on the live match, so the arena owner does not have to ────────
 * Running this on the `arena:kitchen` root only — the static cover and the pot, and
 * NOT either fighter (`tools/tmp/merge_probe.mjs`):
 *
 *   321 hulls -> 2 meshes
 *   frame 625 -> 580 draw calls  (-45, i.e. -7.2%)
 *   image: mean 0.0002182/255, max 21, 0.0025% of pixels — the noise floor
 *
 * That is the whole arena's ink line for two draw calls, with no visible change.
 * `src/arena/**` is owned elsewhere, so this is not wired up: the one-line change is
 * `outlineGroup(propsGroup, 0.016, undefined, { merge: true })` at `kitchen.ts:229`.
 *
 * Returns the number of draw calls removed.
 */
export function mergeOutlines(root: THREE.Object3D): number {
  const byKey = new Map<string, { mat: OutlineMaterial; meshes: THREE.Mesh[] }>();
  root.traverse((o) => {
    const m = o as THREE.Mesh;
    if (!m.isMesh || !m.name.endsWith('__outline')) return;
    const mat = m.material as OutlineMaterial;
    if (!mat?.uniforms?.outlineThickness) return;
    const key = `${mat.uniforms.outlineThickness.value}|${(mat.uniforms.outlineColor.value as THREE.Color).getHexString()}`;
    const e = byKey.get(key) ?? { mat, meshes: [] };
    e.meshes.push(m);
    byKey.set(key, e);
  });

  let removed = 0;
  for (const { mat, meshes } of byKey.values()) {
    if (meshes.length < 2) continue;
    const merged = bakeHulls(root, meshes, mat);
    if (!merged) continue;
    for (const m of meshes) m.removeFromParent();
    root.add(merged);
    removed += meshes.length - 1;
  }
  return removed;
}

/**
 * Bake `meshes` into a single geometry expressed in `space`'s local frame.
 *
 * Only `position` and `normal` survive — they are the only two attributes the hull
 * shader reads, so the merge also drops every UV and vertex-colour buffer the source
 * geometries carried, which is where most of the memory saving comes from.
 *
 * The view-space expansion contract is preserved: the shader still offsets by a
 * CONSTANT `outlineThickness` after transforming the (re-normalised) baked normal,
 * so a source mesh that was scaled 3x still gets the same ink width as one that
 * was not — which was the whole reason the expansion lives in view space.
 */
function bakeHulls(space: THREE.Object3D, meshes: THREE.Mesh[], mat: OutlineMaterial): THREE.Mesh | null {
  space.updateMatrixWorld(true);
  const toLocal = new THREE.Matrix4().copy(space.matrixWorld).invert();

  const parts: Array<{ geo: THREE.BufferGeometry; m: THREE.Matrix4 }> = [];
  let vTotal = 0;
  let iTotal = 0;
  for (const mesh of meshes) {
    const geo = mesh.geometry;
    const pos = geo?.getAttribute('position') as THREE.BufferAttribute | undefined;
    if (!pos || !geo.getAttribute('normal')) return null;
    mesh.updateMatrixWorld(true);
    parts.push({ geo, m: new THREE.Matrix4().multiplyMatrices(toLocal, mesh.matrixWorld) });
    vTotal += pos.count;
    iTotal += geo.index ? geo.index.count : pos.count;
  }
  if (!parts.length) return null;

  const position = new Float32Array(vTotal * 3);
  const normal = new Float32Array(vTotal * 3);
  const index = vTotal > 65535 ? new Uint32Array(iTotal) : new Uint16Array(iTotal);
  const v = new THREE.Vector3();
  const nm = new THREE.Matrix3();
  let vOff = 0;
  let iOff = 0;
  for (const { geo, m } of parts) {
    const p = geo.getAttribute('position') as THREE.BufferAttribute;
    const n = geo.getAttribute('normal') as THREE.BufferAttribute;
    nm.getNormalMatrix(m);
    for (let i = 0; i < p.count; i++) {
      v.fromBufferAttribute(p, i).applyMatrix4(m);
      position[(vOff + i) * 3] = v.x; position[(vOff + i) * 3 + 1] = v.y; position[(vOff + i) * 3 + 2] = v.z;
      v.fromBufferAttribute(n, i).applyMatrix3(nm).normalize();
      normal[(vOff + i) * 3] = v.x; normal[(vOff + i) * 3 + 1] = v.y; normal[(vOff + i) * 3 + 2] = v.z;
    }
    if (geo.index) {
      const src = geo.index;
      for (let i = 0; i < src.count; i++) index[iOff + i] = src.getX(i) + vOff;
      iOff += src.count;
    } else {
      for (let i = 0; i < p.count; i++) index[iOff + i] = vOff + i;
      iOff += p.count;
    }
    vOff += p.count;
  }

  const out = new THREE.BufferGeometry();
  out.setAttribute('position', new THREE.BufferAttribute(position, 3));
  out.setAttribute('normal', new THREE.BufferAttribute(normal, 3));
  out.setIndex(new THREE.BufferAttribute(index, 1));
  out.computeBoundingSphere();

  const mesh = new THREE.Mesh(out, mat);
  mesh.name = `${space.name || 'group'}__outline`;
  mesh.castShadow = false;
  mesh.receiveShadow = false;
  mesh.renderOrder = Math.min(...meshes.map((m) => m.renderOrder ?? 0));
  return mesh;
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
