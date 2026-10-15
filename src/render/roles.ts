/**
 * MATERIAL ROLES — which lights a surface answers to, without a second scene.
 *
 * three r180 has no per-object light mask, and the match needs two different rigs at
 * once (graphics campaign R1, `docs/REVAMP.md` §2.2 / §5):
 *
 *   * the WORLD wants form — light tops, distinctly darker sides — and shadows that stay in
 *     the ground's own hue;
 *   * the CAST wants the camera-axis front fill that carries its figure/ground
 *     (`lighting.ts`, `front`), which is exactly the light that flattens every prop's
 *     camera-facing face to the brightness of its top (same-mesh front/top 0.84-0.93,
 *     measured on `1090046`).
 *
 * So the rig is SPLIT. `lighting.ts` turns the world's share of the fill down, and every
 * CHARACTER material receives the difference back inside its own shader — an extra
 * `IncidentLight` through `RE_Direct` after the light loop (the same diffuse + GGX three
 * gives a real DirectionalLight, so the sum is the old light to float precision). A
 * character renders the same light it always did; the arena does not. The amounts are
 * SHARED uniforms (`LOOK`), written by `Stage` immediately before each of its renders, so a
 * lobby Stage and a match Stage alive at the same time each get their own answer.
 *
 * Three roles, assigned once per material:
 *
 *   char   every material under a `character:*` root — `outlineCharacter` (toon.ts) marks
 *          them at build, before anything compiles. Lit ones get the compensation; EVERY
 *          opaque one (eyes and mouths are `MeshBasicMaterial`) writes `LOOK.charAlpha` to
 *          alpha, which is the tag the match's screen-space contour reads. Transparent ones
 *          are switched to an alpha-PRESERVING blend (identical RGB factors), so a blush
 *          decal does not punch a hole in the tag.
 *   env    lit materials under an `arena:*` root — `Stage` marks them the first frame it sees
 *          the arena. They get the FORM RAMP (albedo x `LOOK.envSide` on faces whose world
 *          normal is within ~70 degrees of horizontal), the curvature gate on the Fresnel
 *          rim (`LOOK.envRimFlat`) and the SHADE TINT (`LOOK.envShadeTint`, scaled by how
 *          much key the fragment's shadow removed — `lighting.ts` `WORLD_SHADE_TINT`).
 *   (none) everything else — VFX, HUD, the lobby set. Untouched: no patch, no recompile.
 *
 * ── IDENTITY BY CONSTRUCTION ────────────────────────────────────────────────
 * Every `LOOK` default is the identity: zero light, alpha 1, side factor 1, rim gate 0, zero
 * tint. A
 * patched material with the defaults computes the same colour as an unpatched one (an added
 * term of exactly 0.0, a multiply by exactly 1.0, an OPAQUE alpha that was already 1.0), so
 * the lobby — which never moves a default — is untouched by this file. `Stage.look` exposes
 * the switches so a probe can drive old and new on ONE frozen frame.
 *
 * ── PROGRAM CACHE ───────────────────────────────────────────────────────────
 * `Material.customProgramCacheKey()` defaults to `onBeforeCompile.toString()`, and the
 * chained closure below has the same source for every material whatever it chains onto —
 * a rim material and a rim-less one would share a key and one would be handed the other's
 * GLSL. So the key is the PREVIOUS key plus the role, captured before the chain. Uniforms
 * are per material (three clones them per material before `onBeforeCompile`), and the
 * shared ones are shared by REFERENCE, which is what lets one write move every material.
 */

import * as THREE from 'three';

/**
 * The camera layer the per-part CHARACTER INK HULLS live on, and nothing else.
 *
 * `Stage` enables it on its camera everywhere except a match frame whose post chain draws
 * the screen-space contour instead (`contour.ts`). A layer, not `visible = false`: three
 * skips the hull at projection time with no traversal of ours, the lobby keeps its look,
 * and nothing has to be restored when the same character is shown by a different Stage.
 */
export const CHARACTER_INK_LAYER = 7;

/** Shared uniforms, by reference. Defaults are the identity — see the file header. */
export const LOOK = {
  /** Front fill handed back to CHARACTER materials: linear RGB x intensity. */
  charFillColor: { value: new THREE.Color(0, 0, 0) },
  /** World-space direction TOWARD that light (normalised). */
  charFillDir: { value: new THREE.Vector3(0, 0.139, 0.990) },
  /** Alpha written by every OPAQUE character fragment. 1 = no tag (the identity). */
  charAlpha: { value: 1 },
  /** Albedo multiplier on near-vertical ENVIRONMENT faces. 1 = no ramp. */
  envSide: { value: 1 },
  /** 0..1: how far the environment Fresnel rim is gated by surface curvature. 0 = off. */
  envRimFlat: { value: 0 },
  /**
   * SHADE TINT: a zero-luminance irradiance offset (linear RGB, light units) added to
   * environment surfaces in proportion to how much of the KEY their shadow removes. 0 = off.
   * See `lighting.ts` `WORLD_SHADE_TINT` for what it corrects and how it was sized.
   */
  envShadeTint: { value: new THREE.Vector3(0, 0, 0) },
};

/**
 * The FORM RAMP's albedo factor on near-vertical environment faces, in a world framing.
 *
 * Paired with `lighting.ts`'s `FRONT_FILL_WORLD` — one knob in two halves, chosen together
 * against same-mesh front/top 0.40-0.60 (`tools/tmp/r1_probe.mjs` + `r1_metrics.py`, four
 * frozen scenes). Lighting alone cannot darken a side the KEY hits (azimuth -31: the +x side
 * of every prop faces it), and an albedo ramp is what a painted toy block does anyway: the
 * top is the light colour, the sides are the same hue, darker.
 *
 * ⚠️ 0.78, NOT THE 0.55-0.65 THE BRIEF SUGGESTED, AND THE REASON IS A MEASURED SIDE EFFECT.
 * Front/top lands in the band either way (0.43-0.51 at 0.62, 0.51-0.58 at 0.78; 0.88-0.92
 * before). But a dark-fronted prop is also a SALIENT one: on the review's own thumbnail
 * salience (32x18 cells), the cells that newly outranked the best fighter cell were all
 * obstacles, and the fighter's rank fell monotonically with the ramp — S1 14 before ->
 * 12 / 19 / 25 at 0.78 / 0.70 / 0.62; S2 4 -> 10 / 12 / 13 — while the fighter cell's own
 * salience ROSE (the contour). 0.78 keeps the form and gives the fighters most of that back;
 * at 0.62 the sides also read near-navy rather than as the prop's own hue, darker.
 */
export const FORM_SIDE_ALBEDO = 0.78;

export type MaterialRole = 'char' | 'env';
const ROLE = new WeakMap<THREE.Material, MaterialRole>();

/** The role a material was patched with, if any. QA + tests. */
export function roleOf(m: THREE.Material): MaterialRole | undefined {
  return ROLE.get(m);
}

/** Bumped when the GLSL below changes, so a stale cached program can never be reused. */
const ROLE_PATCH_VERSION = 1;

type Shader = THREE.WebGLProgramParametersWithUniforms;

function chain(mat: THREE.Material, role: MaterialRole, patch: (shader: Shader) => void): void {
  const prev = mat.onBeforeCompile;
  // Captured NOW, while `onBeforeCompile` is still the previous one — see the header.
  const prevKey = mat.customProgramCacheKey();
  mat.onBeforeCompile = function onBeforeCompileRole(shader, renderer) {
    prev.call(this, shader, renderer);
    patch(shader);
  };
  mat.customProgramCacheKey = () => `${prevKey}|r1role:${role}:${ROLE_PATCH_VERSION}`;
  ROLE.set(mat, role);
  mat.needsUpdate = true;
}

// GLSL is ASCII-only on purpose: it is concatenated into shaders, and ESSL does not promise
// to accept the non-ASCII this file's prose uses (`toon.ts` keeps the same rule).
const CHAR_HEAD = `
uniform vec3 r1FillColor;
uniform vec3 r1FillDir;
uniform float r1CharAlpha;`;

// One more IncidentLight through the material's own RE_Direct, after three's light loop:
// the same diffuse + GGX (+ clearcoat/sheen where the material has them) a DirectionalLight
// of this colour would add. The front fill casts no shadow, so there is nothing to attenuate.
const CHAR_LIGHT = `
if ( dot( r1FillColor, r1FillColor ) > 0.0 ) {
  IncidentLight r1L;
  r1L.direction = normalize( ( viewMatrix * vec4( r1FillDir, 0.0 ) ).xyz );
  r1L.color = r1FillColor;
  r1L.visible = true;
  RE_Direct( r1L, geometryPosition, geometryNormal, geometryViewDir, geometryClearcoatNormal, material, reflectedLight );
}
#include <lights_fragment_end>`;

const CHAR_TAG = `#include <dithering_fragment>
#ifdef OPAQUE
gl_FragColor.a = r1CharAlpha;
#endif`;

const ENV_HEAD = `
uniform float r1EnvSide;
uniform float r1EnvRimFlat;
uniform vec3 r1EnvShadeTint;
#define R1_RIM_GATE mix( 1.0, smoothstep( 0.010, 0.040, length( fwidth( rimNormal ) ) ), r1EnvRimFlat )`;

// ── THE KEY'S SHADOW FACTOR, CAPTURED FROM THREE'S OWN LIGHT LOOP ───────────────
// `lights_fragment_begin` is inlined here with ONE line changed, so the shade tint can know
// how much key a fragment lost without a second 17-tap shadow lookup (the floor is 55-71% of
// the frame). Every shadow-casting directional light reports through it; this rig has one.
// ⚠️ three UNROLLS that loop by pasting its body without braces, so nothing may be DECLARED
// inside it — the temporary is declared once, before the chunk.
const SHADOW_LINE = 'directLight.color *= ( directLight.visible && receiveShadow ) ? getShadow( directionalShadowMap[ i ], directionalLightShadow.shadowMapSize, directionalLightShadow.shadowIntensity, directionalLightShadow.shadowBias, directionalLightShadow.shadowRadius, vDirectionalShadowCoord[ i ] ) : 1.0;';
const SHADOW_CAPTURE = 'r1ShTmp = ( directLight.visible && receiveShadow ) ? getShadow( directionalShadowMap[ i ], directionalLightShadow.shadowMapSize, directionalLightShadow.shadowIntensity, directionalLightShadow.shadowBias, directionalLightShadow.shadowRadius, vDirectionalShadowCoord[ i ] ) : 1.0;\n\t\tdirectLight.color *= r1ShTmp;\n\t\tr1KeyShade = min( r1KeyShade, r1ShTmp );';

function envLightsBegin(): string | null {
  const chunk = THREE.ShaderChunk.lights_fragment_begin;
  if (!chunk.includes(SHADOW_LINE)) return null;
  return `float r1KeyShade = 1.0;\nfloat r1ShTmp = 1.0;\n${chunk.replace(SHADOW_LINE, SHADOW_CAPTURE)}`;
}

// Added to `irradiance` before `RE_IndirectDiffuse`, so it is lit like the sky: x albedo / pi.
const ENV_SHADE = `
irradiance += ( 1.0 - r1KeyShade ) * r1EnvShadeTint;
#include <lights_fragment_end>`;

// Albedo, not light: a multiply on `diffuseColor` scales direct AND indirect diffuse and
// leaves the dielectric specular alone, which is what a darker painted side is.
const ENV_RAMP = `
{
  vec3 r1nW = ( vec4( normal, 0.0 ) * viewMatrix ).xyz;
  float r1Up = abs( r1nW.y ) / max( length( r1nW ), 1e-4 );
  diffuseColor.rgb *= mix( r1EnvSide, 1.0, smoothstep( 0.25, 0.45, r1Up ) );
}
#include <lights_physical_fragment>`;

function mustReplace(src: string, needle: string, by: string, what: string): string {
  if (!src.includes(needle)) {
    // A silent miss is the failure this project has paid for twenty times: a patch that
    // never lands renders plausibly. Loud, once per program, and the material still draws.
    console.warn(`[roles] ${what}: '${needle}' not found — patch not applied`);
    return src;
  }
  return src.replace(needle, by);
}

/** Alpha-preserving blend with the material's own RGB factors. RGB output is unchanged. */
function preserveDestinationAlpha(m: THREE.Material): void {
  if (m.premultipliedAlpha) return;
  if (m.blending === THREE.NormalBlending) {
    m.blending = THREE.CustomBlending;
    m.blendEquation = THREE.AddEquation;
    m.blendSrc = THREE.SrcAlphaFactor;
    m.blendDst = THREE.OneMinusSrcAlphaFactor;
  } else if (m.blending === THREE.AdditiveBlending) {
    m.blending = THREE.CustomBlending;
    m.blendEquation = THREE.AddEquation;
    m.blendSrc = THREE.SrcAlphaFactor;
    m.blendDst = THREE.OneFactor;
  } else if (m.blending !== THREE.CustomBlending) {
    return;
  }
  m.blendEquationAlpha = THREE.AddEquation;
  m.blendSrcAlpha = THREE.ZeroFactor;
  m.blendDstAlpha = THREE.OneFactor;
}

function patchCharacterMaterial(m: THREE.Material): boolean {
  if (ROLE.has(m)) return false;
  if ((m as THREE.ShaderMaterial).isShaderMaterial) return false;   // ink hulls, custom shaders
  if (m.transparent) {
    // No tag from a translucent part: it composites over whatever is behind it. Preserve
    // the destination alpha instead, so the body under a blush decal stays tagged and the
    // world under a steam puff stays world. Marked so it is not revisited.
    preserveDestinationAlpha(m);
    ROLE.set(m, 'char');
    return true;
  }
  const lit = (m as THREE.MeshStandardMaterial).isMeshStandardMaterial === true;
  chain(m, 'char', (shader) => {
    shader.uniforms.r1FillColor = LOOK.charFillColor;
    shader.uniforms.r1FillDir = LOOK.charFillDir;
    shader.uniforms.r1CharAlpha = LOOK.charAlpha;
    let fs = mustReplace(shader.fragmentShader, '#include <common>', `#include <common>${CHAR_HEAD}`, 'char head');
    if (lit) fs = mustReplace(fs, '#include <lights_fragment_end>', CHAR_LIGHT, 'char light');
    fs = mustReplace(fs, '#include <dithering_fragment>', CHAR_TAG, 'char tag');
    shader.fragmentShader = fs;
  });
  return true;
}

function patchEnvironmentMaterial(m: THREE.Material): boolean {
  if (ROLE.has(m)) return false;
  if ((m as THREE.MeshStandardMaterial).isMeshStandardMaterial !== true) return false;
  chain(m, 'env', (shader) => {
    shader.uniforms.r1EnvSide = LOOK.envSide;
    shader.uniforms.r1EnvRimFlat = LOOK.envRimFlat;
    shader.uniforms.r1EnvShadeTint = LOOK.envShadeTint;
    let fs = mustReplace(shader.fragmentShader, '#include <common>', `#include <common>${ENV_HEAD}`, 'env head');
    fs = mustReplace(fs, '#include <lights_physical_fragment>', ENV_RAMP, 'env ramp');
    const begin = envLightsBegin();
    if (begin) {
      fs = mustReplace(fs, '#include <lights_fragment_begin>', begin, 'env lights begin');
      fs = mustReplace(fs, '#include <lights_fragment_end>', ENV_SHADE, 'env shade');
    } else {
      console.warn('[roles] three\'s lights_fragment_begin changed — the shade tint is not applied');
    }
    shader.fragmentShader = fs;
  });
  return true;
}

const materialsOf = (o: THREE.Object3D): THREE.Material[] => {
  const m = (o as THREE.Mesh).material;
  if (!m) return [];
  return Array.isArray(m) ? m : [m];
};

const isHull = (o: THREE.Object3D): boolean => o.name.endsWith('__outline');

/**
 * Give every material under a character root the CHARACTER role. Idempotent; returns how
 * many materials were newly patched. Ink hulls are skipped — they are the thing the
 * contour replaces, and they live on `CHARACTER_INK_LAYER`.
 */
export function markCharacter(root: THREE.Object3D): number {
  let n = 0;
  root.traverse((o) => {
    if (!(o as THREE.Mesh).isMesh || isHull(o)) return;
    for (const m of materialsOf(o)) if (patchCharacterMaterial(m)) n++;
  });
  root.userData.r1Character = true;
  return n;
}

/**
 * Give every LIT material under an arena root the ENVIRONMENT role. Idempotent. A
 * material already claimed by a character keeps that role (first claim wins), and is
 * reported in `shared` so a probe can see the collision instead of guessing.
 */
export function markEnvironment(root: THREE.Object3D): { patched: number; shared: number } {
  let patched = 0;
  let shared = 0;
  root.traverse((o) => {
    if (!(o as THREE.Mesh).isMesh || isHull(o)) return;
    for (const m of materialsOf(o)) {
      if (ROLE.get(m) === 'char') { shared++; continue; }
      if (patchEnvironmentMaterial(m)) patched++;
    }
  });
  return { patched, shared };
}
