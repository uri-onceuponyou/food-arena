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
  /**
   * Hard facets instead of interpolated normals.
   *
   * ⚠️ **This used to be a shader that never linked, and the mesh drew NOTHING.** The
   * rim below reads `vNormal`, which three does not declare under `FLAT_SHADED`. It is
   * safe now — `applyRimLight` carries an `#ifdef FLAT_SHADED` fallback normal and
   * `tools/tmp/tt_flatrim.mjs` renders both paths and refuses the pre-fix source — but
   * see that function's note before changing either.
   */
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
 * ── "NO MATERIAL VARIATION" IS NOT AN AUTHORING GAP. MEASURED. ──────────────
 *
 * A canonical-rubric baseline re-score (43 rounds, 43 valid) put one mechanism at the
 * top of four of five elements: *"surfaces are flat and unlit — no material variation,
 * no contact shadow, no depth"*, named by 6/6 critics on the HUD band, 6/6 on home,
 * 5/6 on character select, 4/6 on the arena. This function is the shared material
 * factory, so the finding points here. `docs/LESSONS.md` §3: take the observation,
 * re-derive the mechanism.
 *
 * `tools/tmp/matvar.mjs --mode census`, live match, hamburger at pot_south:
 *
 *   255 materials · 94 MeshStandardMaterial + 18 MeshPhysicalMaterial + 140 basic
 *   **33 DISTINCT roughness values**, 0.16 .. 0.98 · 36 distinct
 *   (roughness, metalness, envMapIntensity) triples · 38 standard materials on a
 *   character, carrying 20 distinct roughness values
 *
 * The variation is authored. It is not arriving. `--mode chart` drops spheres into the
 * live match at the shipped camera, lights and post chain, sized to a fighter's
 * measured 147 px, and reads each one's specular headroom (its own P99 - P50):
 *
 *   roughness   0.08    0.25    0.52    0.75    0.95
 *   specHead    0.328   0.400   0.166   0.055   0.034
 *
 * **A ten-fold collapse between 0.25 and 0.75 — and 53% of the cast's surfaces are
 * authored at 0.6 or above.** Rendered and LOOKED AT (`shots/matvar/chart.png`): 0.75
 * and 0.95 are the same matte ball. More than half this game's materials live where
 * the parameter that distinguishes them does nothing, which is "coloured paper" in one
 * number.
 *
 * ⚠️ AND THE PER-MATERIAL FIX FOR IT DOES NOT EXIST IN THIS CONFIGURATION.
 * `material.envMapIntensity` is the documented knob for making one surface glossier
 * than another. Driving it x0 / x2 / x4 across all 112 standard materials on one
 * frozen frame produces a **BYTE-IDENTICAL image** — dMean 0.0000, dMax 0, 0.00% of
 * pixels — while `scene.environmentIntensity` at x0 moves the frame by 30.7/255.
 * Root cause, `three/build/three.module.js:17340`:
 *
 *     if ( material.isMeshStandardMaterial && material.envMap === null
 *          && scene.environment !== null ) {
 *       m_uniforms.envMapIntensity.value = scene.environmentIntensity;
 *     }
 *
 * Every material here relies on `scene.environment` and none sets its own `envMap`, so
 * three overwrites the per-material value with the scene's on every single draw. The
 * property assigns without error and reads back correctly. `docs/LESSONS.md` §1 —
 * not missing, silently ignored. **To make it live, a material must be given
 * `envMap = scene.environment` explicitly**, and then its intensity is its own (note
 * that the default of 1 is not the scene's 0.32, so anything doing this has to carry
 * the 0.32 itself or it will jump three stops).
 *
 * Two levers were then priced and both were turned down, in `stage.ts`: brighter,
 * smaller IBL specular panels at constant irradiance moved specular headroom by ~0.007
 * at every roughness (these are dielectrics at metalness 0, so F0 is fixed at 0.04 and
 * the visible highlight is the DIRECT lights' lobe, not the environment's); and SSAO
 * delivers the contact shadow but costs a second full geometry pass, +314 draws/frame.
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
 *
 * ── IT IS ALSO THE SINGLE LARGEST MATERIAL LEVER IN THE FRAME. MEASURED. ────
 * `tools/tmp/haloprobe.mjs`, 4 characters x 2 stations, the rim ablated on ONE frozen
 * frame per sample so nothing else differs (mask from the direct render):
 *
 *   rimStrength      0        0.14      0.28 (shipped)     5.6 (validation)
 *   hero dLedge   0.0512     0.0696         0.0851              0.2193
 *   hero dL       0.1062     0.1169         0.1270              0.2573
 *   p05           0.082      0.105          0.119               0.274
 *   clipShare     0.0141     0.0164         0.0176              0.1903
 *
 * **Switching it off costs 40% of the cast's edge figure/ground** — more than any
 * other single thing measured in this file set, and it is the term that makes the
 * silhouette pass's work visible against the floor. The validation row is the ceiling
 * and shows why it is not simply turned up: at 5.6 the cast's share above luma 0.94
 * reaches 0.1903 against a reference band whose MAXIMUM is 0.0929, p05 blows through
 * the <= 0.180 gate, and the value ladder loses a step.
 *
 * ⚠️ TWO GAPS, MEASURED AND NOT ACTED ON, because they need an 11-character clipping
 * run this pass did not have the budget for:
 *   1. `strength` is 0.28 on **all 33 materials that carry it** — a lever worth 40% of
 *      edge separation, applied identically to bread, glass, meat and metal. It is
 *      itself a source of the sameness the critics named.
 *   2. `glossyMat` never calls this. So the 18 MeshPhysicalMaterials — lollipop, the
 *      water bottle, glaze, broth, i.e. exactly the surfaces that most want a wet edge
 *      — are the ONLY ones in the game with no edge response at all. Adding it is a
 *      one-line change and it lands on the four characters whose near-white clipping
 *      was hardest won (lollipop 0.1610 -> 0.0175, sushi, soup, egg), so it must be
 *      gated on a per-character `clipShare` run and not merged blind.
 */
export function applyRimLight(
  mat: THREE.MeshStandardMaterial | THREE.MeshPhysicalMaterial,
  color: THREE.ColorRepresentation = '#bfe4ff',
  strength = 0.28
): void {
  // ── The rim's PARAMETERS, recorded SYNCHRONOUSLY, so a clone can rebuild it ──
  // `rimUniforms` below is only written from inside `onBeforeCompile`, i.e. at first
  // render — so it does not exist yet on a material that is cloned at build time, and
  // there is otherwise no way to ask a material "what rim were you given?". Everything
  // stored here is JSON-safe on purpose: `Material.copy()` runs
  // `JSON.parse(JSON.stringify(userData))` (`three/src/materials/Material.js:974`), so
  // this record — and only this record — survives a `.clone()`. See `cloneToon`.
  // The colour is normalised to a hex number, which is 8-bit exact for every call site
  // in this game (all of them take the default) and is the one ColorRepresentation that
  // survives the round trip: a `THREE.Color` JSON-stringifies to `{r,g,b}`, which
  // `new THREE.Color()` cannot read back.
  (mat.userData as { rim?: { color: number; strength: number } }).rim = {
    color: new THREE.Color(color).getHex(),
    strength,
  };
  mat.onBeforeCompile = (shader) => {
    shader.uniforms.rimColor = { value: new THREE.Color(color) };
    shader.uniforms.rimStrength = { value: strength };
    // QA HANDLE, zero cost, and it exists because of a specific measurement problem.
    // The rim is the brightest thing on a silhouette EDGE, and bloom's halo is fed by
    // exactly those pixels — so "how much of the glow outside the character is the
    // rim's fault" is a question worth asking. Without this, answering it needs two
    // page loads on two trees, and `docs/LESSONS.md` §5 records what a two-load A/B is
    // worth while peers are mid-edit. With it, a probe drives rim and no-rim on ONE
    // frozen frame, one uniform apart. Never read by game code.
    (mat.userData as { rimUniforms?: unknown }).rimUniforms = shader.uniforms;
    shader.fragmentShader = shader.fragmentShader
      .replace(
        '#include <common>',
        `#include <common>
         uniform vec3 rimColor;
         uniform float rimStrength;`
      )
      // ── `vNormal` DOES NOT EXIST UNDER `flatShading`, AND THE FAILURE IS SILENT ──
      //
      // This term read `normalize(vNormal)` directly for most of its life. three
      // declares that varying inside `#ifndef FLAT_SHADED`
      // (`three/src/renderers/shaders/ShaderChunk/normal_pars_fragment.glsl.js`), so on
      // any material built with `flatShading: true` the fragment shader referenced an
      // undeclared identifier, the program never linked, and **every mesh using that
      // material drew nothing** — with no exception thrown and nothing missing from the
      // scene graph, only a line in a console nobody reads:
      //
      //     THREE.WebGLProgram: Shader Error 0 - VALIDATE_STATUS false
      //     ERROR: 0:1834: 'vNormal' : undeclared identifier
      //
      // `src/arena/floor.ts`'s chip layer shipped exactly that for THREE tuning rounds
      // and two whole palettes, because **the shadow-depth program carries no rim patch**
      // — it linked fine and kept drawing each invisible chip's contact shadow, so the
      // floor rendered a convincing field of dark specks. `docs/LESSONS.md` §1, twentieth
      // instance: a mesh's shadow can be drawn by a DIFFERENT program from the mesh.
      //
      // ── WHY A FALLBACK AND NOT A THROW ──────────────────────────────────────────
      // Refusing `flatShading + rim` would have been honest only if the combination were
      // unsupportable, and it is not: three shades flat surfaces by rebuilding the face
      // normal from screen-space derivatives of `vViewPosition`
      // (`normal_fragment_begin.glsl.js`), and the `#ifdef` below is that same
      // expression. Flat facets are a legitimate tool here — the chip layer wanted them
      // and had to buy them from geometry instead — so the renderer's real capability
      // should be reachable through the factory.
      //
      // three's own `normal` is deliberately NOT borrowed: by `<dithering_fragment>` it
      // has been through `<normal_fragment_maps>`, so reusing it would quietly give the
      // flat path a normal-mapped rim while the smooth path keeps a geometric one.
      //
      // ── AND IT IS PIXEL-NEUTRAL ─────────────────────────────────────────────────
      // The `#else` branch is `vNormal` unchanged and `#ifdef` resolves in the
      // preprocessor, so the compiled program is the same one for every existing call
      // site (none of the 315 passes `flatShading`). `tools/tmp/tt_flatrim.mjs` proves
      // that by rendering the PRE-FIX source alongside this one on a smooth material and
      // requiring the two frames to be byte-identical.
      //
      // GLSL comments are kept out of the injected string on purpose: it is concatenated
      // into every rim shader, and the ESSL character set does not promise to accept the
      // non-ASCII this file's prose uses.
      .replace(
        '#include <dithering_fragment>',
        `#include <dithering_fragment>
         // rim: view-space, so it follows the camera and holds on every silhouette edge
         #ifdef FLAT_SHADED
           vec3 rimNormal = normalize(cross(dFdx(vViewPosition), dFdy(vViewPosition)));
         #else
           vec3 rimNormal = vNormal;
         #endif
         float rimDot = 1.0 - clamp(dot(normalize(rimNormal), normalize(vViewPosition)), 0.0, 1.0);
         float rim = pow(rimDot, 2.6) * rimStrength;
         gl_FragColor.rgb += rimColor * rim;`
      );
  };
  // Force a program recompile if this material was already used.
  mat.needsUpdate = true;
}

/**
 * Clone a material AND carry its Fresnel rim across. **Use this instead of
 * `material.clone()` anywhere a `toonMat` material is being copied.**
 *
 * ── WHY THIS EXISTS: `Material.clone()` SILENTLY DROPS THE RIM ──────────────
 * `three/src/materials/Material.js` `copy()` names 40+ properties and **not**
 * `onBeforeCompile` (verified in the installed 0.180.0). `applyRimLight` is the only
 * thing that ever sets it, and nothing re-applied it after a clone — so every cloned
 * `toonMat` rendered with no rim at all, while looking entirely plausible.
 * `docs/LESSONS.md` §1: not missing, silently ignored.
 *
 * Measured on HEAD before this landed: **33 of 112** lit materials still carried a
 * live rim uniform, agreed by two independent instruments (`matvar --mode census` and
 * a `renderer.properties` handle count), against **54 material-clone sites in `src/`**.
 * The delivered rim — every live rim uniform driven to strength 6, bloom ablated, one
 * frozen frame, pixels moving >1/255 — reached **1.402% of the frame**
 * (`tools/tmp/p1_rimlook.mjs`; resolution floor ±0.005 pp from a two-page-load drift
 * control). The smoking gun was `kpal:woodPad` appearing TWICE in one frame under the
 * same name: the original with the rim (0.805% of frame), its clone without (2.501%).
 *
 * ── WHAT IT COSTS: NOTHING ──────────────────────────────────────────────────
 * Zero draw calls and zero new GL programs. `Material.customProgramCacheKey()` returns
 * `this.onBeforeCompile.toString()` (`Material.js:541`) and `WebGLPrograms` pushes that
 * straight into the cache key (`WebGLPrograms.js:361,411`), so every material patched
 * by `applyRimLight` produces the SAME key and shares one compiled program. Only the
 * uniform container is per-material — `materialProperties.uniforms = parameters.uniforms`,
 * set once per (material, program) in `WebGLRenderer.js:2086`.
 *
 * ── THE THREE TRAPS THIS FUNCTION IS SHAPED AROUND ──────────────────────────
 *  1. **It must be possible to DECLINE the rim, and it must never be turned on
 *     silently.** `src/arena/apron.ts:830` passes `rim: false` deliberately: on a ground
 *     plane seen at 32° of grazing the Fresnel term becomes a broad wash across the far
 *     half of the apron, the opposite of the recession that bake is building. So the
 *     default here is **inherit** — a source with no rim yields a clone with no rim —
 *     and `{ rim: false }` declines one the source does have.
 *  2. **`Material.copy()` deep-JSON-copies `userData`** (`Material.js:974`), so cloning
 *     a material that has ALREADY RENDERED hands the clone a dead, JSON-mangled
 *     `rimUniforms` object. That is worse than useless: `haloprobe.mjs`, `matvar.mjs`,
 *     `rimcheck.mjs` and `p1_matresp.mjs` all count a rim by testing
 *     `userData.rimUniforms`, and would count that corpse as a live rim. It is detached
 *     across the clone and restored, so the clone never receives one.
 *  3. **`Texture.clone()` shares its `source`** — but `Material.copy()` does not clone
 *     textures at all, it copies the reference, which is what we want (no second GPU
 *     upload). Do not "improve" that: three caches uploaded textures BY SOURCE, so a
 *     cloned texture whose `.image` is then written overwrites the ORIGINAL albedo.
 *
 * Generic over `THREE.Material` on purpose, so it is a drop-in for `.clone()` at a call
 * site that does not know whether it holds a standard material or a basic one — a
 * material that never had a rim simply clones.
 */
export function cloneToon<T extends THREE.Material>(
  src: T,
  opts: {
    /** `false` declines the rim; `true` forces one on; omitted inherits the source's. */
    rim?: boolean;
    rimColor?: THREE.ColorRepresentation;
    rimStrength?: number;
  } = {},
): T {
  type RimSpec = { color: number; strength: number };
  const srcData = src.userData as { rim?: RimSpec; rimUniforms?: unknown };
  const spec = srcData.rim;

  // Trap 2: keep the live uniform handle out of the JSON deep copy entirely.
  const liveUniforms = srcData.rimUniforms;
  if (liveUniforms !== undefined) delete srcData.rimUniforms;
  const out = src.clone() as T;
  if (liveUniforms !== undefined) srcData.rimUniforms = liveUniforms;

  const wantRim = opts.rim ?? spec !== undefined;
  if (!wantRim) {
    delete (out.userData as { rim?: RimSpec }).rim;
    return out;
  }
  const lit = out as unknown as THREE.MeshStandardMaterial;
  if (!lit.isMeshStandardMaterial) {
    // A rim on a MeshBasicMaterial is a no-op with a cost: `applyRimLight` patches
    // `<dithering_fragment>` and reads `vNormal`, and a basic shader has neither.
    // Nothing in `src/` does this today; refuse loudly rather than ship a dead patch.
    throw new Error('cloneToon: rim requested on a material with no normals');
  }
  applyRimLight(
    lit,
    opts.rimColor ?? spec?.color,
    opts.rimStrength ?? spec?.strength,
  );
  return out;
}

/**
 * Glossy variant with a specular pop. MeshToonMaterial has no specular, so for
 * things that need a wet/candy/glass highlight (lollipop, water bottle, glaze,
 * broth) use this physical material with low roughness and a clamped palette.
 *
 * ── `rim` IS OPT-IN HERE AND OPT-OUT IN `toonMat`. THAT ASYMMETRY IS MEASURED. ──
 * `applyRimLight`'s own note records the gap: all 18 `MeshPhysicalMaterial`s in the
 * game — lollipop, the water bottle, glaze, broth, i.e. exactly the surfaces that most
 * want a wet edge — are the ONLY lit materials with no edge response at all. It also
 * records why it was not simply switched on: those materials sit on the four characters
 * whose near-white clipping was hardest won.
 *
 * THE PER-CHARACTER RUN IT WAS GATED ON IS DONE (`tools/tmp/p1_castmat.mjs`,
 * `shots/p1/castmat.json`). One frozen frame per character at shipped gameplay framing,
 * on the character's own two-clear-colour matte, the same Fresnel patch at the same
 * default 0.28, with BOTH controls at exactly 0.0000 (a null re-render, and a
 * patched-with-strength-0 leg that proves the recompile alone moves nothing).
 * `clipShare` = share of the matte above luma 0.94; reference MEDIAN 0.0249, band
 * MAXIMUM 0.0929:
 *
 *   character    clipShare        verdict
 *   lollipop     0.0202 -> 0.0221  PASS   dMean 5.29/255 over 32.1% of the matte
 *   sushi        0.0337 -> 0.0337  PASS   unchanged; dMean 5.75 over 39.3%
 *   hamburger    0.0145 -> 0.0145  PASS
 *   egg          0.0174 -> 0.0174  PASS   but worth nothing — dMean 0.33 over 1.67%
 *                                         of the matte; egg's physical materials are
 *                                         tiny yolk beads
 *   soup         0.0883 -> 0.0976  FAIL   clears the band MAXIMUM of 0.0929
 *
 * The value ladder survives on all five (range 0.755-0.863 against a >=0.636 rail, p05
 * 0.079-0.130 against <=0.180, steps10 = 10/10).
 *
 * SO IT DEFAULTS **OFF**, and switching it on is a per-call-site decision in
 * `src/characters/**` — another owner's file set. **Turn it on for lollipop, sushi and
 * hamburger; leave egg alone because it buys nothing there; and do NOT turn it on for
 * soup's ceramic and broth** — soup sits at 0.0883 on HEAD, the closest character in
 * the cast to the near-white ceiling, which is its own problem regardless of this knob.
 * Re-run `node tools/tmp/valuescan.mjs --mode gate` (11/11) after any of it.
 *
 * A default of ON was considered and refused: it would ship a known `valuescan` failure
 * on soup in exchange for a lever worth 2.76-3.40% of the frame, and this project's own
 * rule is that a gate is not traded away for a change nobody has looked at yet.
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
  /** Fresnel rim light. **OFF by default here** — see the note above for why. */
  rim?: boolean;
  rimColor?: THREE.ColorRepresentation;
  rimStrength?: number;
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
  // Opt-IN, unlike `toonMat`'s opt-out. `=== true`, not truthiness, so this cannot be
  // switched on by a stray object spread.
  if (opts.rim === true) applyRimLight(m, opts.rimColor, opts.rimStrength);
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
 * ── ⚠️ KEPT, WITH ITS ORIGINAL REASONING, BUT IT IS NO LONGER THE CHARACTER INK ──
 * The wording below is the rule it encoded and it is still right about WIDTH. What it
 * was wrong about is UNITS, and the correction is `OUTLINE_CHAR_SCREEN` under it.
 *
 *   *"Tuned DOWN hard from an initial 0.035. In the actual gameplay reference frames,
 *   characters carry almost no ink line — they separate from the environment through
 *   value contrast, rim light and the ground ring beneath them. A heavy outline is one
 *   of the loudest 'hobby project' tells, so this is intentionally subtle."*
 *
 * 🚨 **A WORLD-SPACE THICKNESS CANNOT SERVE TWO CAMERAS, AND THIS GAME SHIPS TWO.**
 * The hull expands a fixed number of METRES, so its width in PIXELS is whatever the
 * camera distance makes it.
 *
 * ⚠️ **THIS PARAGRAPH SAID "~90 px ... 0.17 px" AND I DID NOT MEASURE EITHER.** The old
 * wording is kept because the error is the instructive part: 90 px was read off a
 * different frame by eye, and the figure it produced then travelled into a commit
 * message, where `--amend` is banned and the log is a primary source. The measured
 * bounding boxes on the frames this change was actually judged on
 * (`shots/v2/b2/v2-report.json`, six seats at `pot_south`, 1600x900) are **sushi 114 px
 * and soup 167 px** of a 900 px frame — 0.0184 and 0.0126 m per pixel at
 * `CHARACTER_HEIGHT = 2.1`. So the shipped ink line was
 *
 *     0.004 m  =  0.22 px on sushi  ..  0.32 px on soup
 *
 * **Still sub-pixel, so the conclusion is unchanged and the number was wrong by 1.9x.**
 * That is the whole lesson: the conclusion surviving is exactly why nobody re-checks the
 * figure. `docs/AGENT-BRIEF.md` §2b — *"a count written from memory is wrong here at
 * roughly coin-flip rate, whoever it came from"*, and this one was mine.
 *
 *   *"At the match camera a fighter measures ~90 px of a 900 px frame — about 0.023 m
 *   per pixel — so 0.004 m is 0.17 px: the character ink line does not exist at the
 *   framing the game is played at."*
 *
 * At the lobby camera the same
 * character is roughly ten times bigger on screen, so the same constant draws a line
 * ten times heavier there, which is the "sticker" failure the note above is describing.
 * One number was being asked to be both, and it could only ever be right at one
 * distance. That is why the value was tuned twice in opposite directions.
 *
 * Still exported and still the default for `addOutline`/`outlineGroup`, because the
 * ARENA's ink is world-space on purpose (a prop's ink should get heavier as you walk
 * up to it) and `arena/**` is owned elsewhere. Characters now use the screen-space
 * path below.
 */
export const OUTLINE_THIN = 0.004;

/**
 * CHARACTER ink, as a fraction of VIEWPORT HEIGHT — the unit an ink line is actually
 * authored in, and the reason it can be one number for both shipped cameras.
 *
 * `screenSpace: true` hulls expand in CLIP space by `thickness * w`, i.e. by a constant
 * fraction of the half-height of the frame, with the x component divided by the aspect
 * recovered from the projection matrix so the line is the same width on both axes. So:
 *
 *     px = thickness * viewportHeight / 2
 *
 * 0.0034 is **1.53 px at the shipped 900 px capture height** and the same 1.53 px at any
 * other resolution, on either camera, at any distance. It is chosen as the thinnest line
 * that is reliably more than one pixel — one pixel of ink dithers in and out under SMAA
 * and reads as an artefact rather than a contour — and it is deliberately at the bottom
 * of the usable range, because the note above is right that heavy ink is a tell.
 *
 * ⚠️ It must stay below `PROP_INK_MIN`, which is compared against the same field: the
 * tier policy drops any hull at or above 0.012 on `low`, and character ink is exactly
 * what `low` is supposed to keep. 0.0034 is 3.5x clear of that, and `--selftest` in
 * `tools/tmp/v2_ablate.mjs` asserts it rather than leaving it to be noticed.
 */
export const OUTLINE_CHAR_SCREEN = 0.0034;

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
function outlineMaterial(
  thickness: number,
  color: THREE.ColorRepresentation,
  screenSpace = false,
): OutlineMaterial {
  // A dedicated ShaderMaterial rather than patching MeshBasicMaterial: basic
  // materials carry no normal chunks, so `objectNormal` is undefined there and the
  // hull silently never expands (an outline that renders as nothing at all).
  return new THREE.ShaderMaterial({
    uniforms: {
      outlineColor: { value: new THREE.Color(color) },
      outlineThickness: { value: thickness },
    },
    // ── WORLD path: expansion happens in VIEW space, not object space. Expanding
    // `position` directly means the offset is subsequently multiplied by the object's
    // scale, so a mesh scaled 3x gets a 3x fatter outline — which reads as a randomly
    // uneven ink line across a model built from differently-scaled parts.
    //
    // ── SCREEN path: the same expansion carried one transform further, into CLIP
    // space, where a displacement of `t * w` is a constant fraction of the frame at
    // ANY depth. That is the whole difference: the world path draws a line whose
    // pixel width is a function of camera distance (0.22-0.32 px on a fighter at the
    // match camera, ~10x that on the same fighter in the lobby), the screen path draws the
    // same width at both. Both paths are compiled from this one function so they
    // cannot drift; the world path's three lines are byte-for-byte what shipped.
    //
    // The aspect correction is recovered from the projection matrix rather than passed
    // in as a uniform — `P[1][1] = 1/tan(fov/2)` and `P[0][0] = P[1][1]/aspect` — so
    // nothing has to be re-pushed on resize, on a live tier change, or on the two
    // different FOVs the lobby and match cameras run. A uniform here would be a second
    // source of truth that goes stale silently the first time one of them is missed.
    vertexShader: screenSpace ? /* glsl */ `
      uniform float outlineThickness;
      void main() {
        vec4 mvPosition = modelViewMatrix * vec4(position, 1.0);
        vec3 n = normalize(normalMatrix * normal);
        vec4 clip  = projectionMatrix * mvPosition;
        vec4 clipN = projectionMatrix * vec4(mvPosition.xyz + n, 1.0);
        // The normal's direction on SCREEN, which is the clip-space delta divided by w
        // (the perspective divide) — not the clip-space delta itself.
        vec2 dir = clipN.xy / max(1e-6, clipN.w) - clip.xy / max(1e-6, clip.w);
        float aspect = projectionMatrix[1][1] / max(1e-6, projectionMatrix[0][0]);
        // Normalise in a square space so a horizontal and a vertical edge get the same
        // width, then take the offset back into clip space through the same aspect.
        vec2 sq = vec2(dir.x * aspect, dir.y);
        float len = length(sq);
        vec2 unit = len > 1e-6 ? sq / len : vec2(0.0);
        clip.xy += vec2(unit.x / aspect, unit.y) * outlineThickness * clip.w;
        gl_Position = clip;
      }
    ` : /* glsl */ `
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
  /**
   * Read `thickness` as a fraction of VIEWPORT HEIGHT instead of as metres.
   *
   * For CHARACTERS. A world-space ink line is a different width in pixels at every
   * camera distance, and this game ships two cameras an order of magnitude apart —
   * see `OUTLINE_CHAR_SCREEN`. Opt-in, and NOT the default, because the arena's ink
   * genuinely wants the world-space behaviour (a prop's contour thickening as you
   * approach it is correct) and `arena/**` is owned elsewhere.
   *
   * ⚠️ `thickness` is still compared against `PROP_INK_MIN` by the tier gate below.
   * The two units are not interchangeable, and the guard is a floor rather than a
   * conversion: any screen-space value large enough to trip a metres threshold would
   * be an ink line ~5 px wide, which is not something this project would ship anyway.
   */
  screenSpace?: boolean;
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

  const mat = outlineMaterial(thickness, color, opts.screenSpace === true);
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
 * THE CHARACTER INK LINE. One call, one policy, one place to change it.
 *
 * Every character's `build()` ended with a bare `outlineGroup(this.root)`, which took
 * `OUTLINE_THIN`'s **metres** and therefore drew a line whose pixel width was a function
 * of camera distance — 0.22-0.32 px on a fighter at the match camera (MEASURED bboxes,
 * see `OUTLINE_THIN`), roughly ten times that
 * on the same fighter in the lobby. That is not a value that can be tuned right; it is a
 * unit that cannot be right at two distances, and it had been tuned twice in opposite
 * directions by rounds looking at different cameras.
 *
 * This exists as a function rather than as three extra arguments at twelve call sites
 * because the twelve call sites are the thing that went wrong: a policy spread across
 * twelve files is twelve places to forget it, and the one that forgets is invisible —
 * a character with no contour looks like a character that needs more contrast.
 *
 * ⚠️ Named `outlineCharacter`, not `outlineGroup(…, { character: true })`, so a grep for
 * who carries character ink returns the roster and nothing else.
 */
export function outlineCharacter(root: THREE.Object3D): void {
  outlineGroup(root, OUTLINE_CHAR_SCREEN, OUTLINE_INK, { screenSpace: true });
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
// STATIC BATCHING — the whole set dressing, in one mesh per material
// ─────────────────────────────────────────────────────────────────────────────

/**
 * A subtree carrying this in `userData` is never merged, and neither is anything
 * under it. Set it on anything whose transform, geometry or child list changes at
 * runtime — the merge bakes world matrices into vertex data, so a merged part is
 * frozen where it stood.
 *
 * ⚠️ This is an OPT-OUT, and that is deliberate. An opt-IN would have to be
 * remembered by every future prop author, and the failure mode of forgetting it is
 * a silent 17x draw-call regression that nothing in the gate battery would catch.
 * The failure mode of forgetting the opt-out is a visibly frozen prop, which is
 * loud — and `tools/tmp/mg_probe.mjs` measures which meshes actually move over a
 * live match rather than trusting either list.
 */
export const MERGE_SKIP = 'mergeSkip';

export interface MergeStaticReport {
  /** Drawables removed from the graph. */
  removed: number;
  /** Merged meshes created — one per (material, shadow flags, layers, attributes). */
  created: number;
  /** Drawables deliberately left alone: skipped subtrees, singletons, odd geometry. */
  kept: number;
  /** Empty containers pruned once their meshes moved into a merged mesh. */
  prunedGroups: number;
}

/**
 * Collapse every STATIC mesh under `root` into one mesh per render bucket, baked
 * into `root`'s own space.
 *
 * ── WHY THIS EXISTS, WITH THE MEASUREMENT THAT MOTIVATED IT ─────────────────
 * `tools/tmp/pf_census.mjs` on the shipped bundle at the phone tier: a match frame
 * is 942 draw calls, of which **613 are the arena props — 118 in the main pass and
 * 495 in the SHADOW pass** — carried by **1,924 drawables for 111 props**, about 17
 * meshes each. `pf_ablate.mjs` priced the same set at **-8.00 ms of a 14.70 ms
 * main-thread frame** when detached entirely, of which **-2.30 ms is pure
 * `updateMatrixWorld`** over 2,111 objects — a cost no culling can reach, because
 * `Object3D.updateMatrixWorld` does not test `.visible`.
 *
 * None of that is shader, material or texture cost: across the x4 map commit GL
 * programs went 26 -> 25 and texture bytes did not move at all. It is object count.
 *
 * ── WHY MERGING IS SAFE HERE AND MERGING THE HULLS WAS NOT ENOUGH ───────────
 * `mergeOutlines`/`bakeHulls` above already merge the arena's INK, and they drop
 * every attribute except position and normal because the hull shader reads nothing
 * else. A real prop reads `uv` (every major surface carries a canvas texture) and
 * may carry vertex colours, so this keeps the FULL attribute set and refuses to
 * merge across two geometries that disagree about it.
 *
 * The bucket key is (material, castShadow, receiveShadow, renderOrder, layers,
 * attribute signature). Every one of those is a per-DRAW property that a merged
 * mesh can only hold one of, so folding across any of them would change the image:
 * merging across `castShadow` alone would either invent shadows or delete them.
 *
 * ── WHAT THIS DOES NOT CHANGE, AND WHY THE FRAME IS BIT-IDENTICAL ───────────
 * Object-level frustum culling is a pure optimisation: submitting geometry the
 * camera cannot see produces the same pixels as not submitting it, because the GPU
 * clips it anyway. So a merged mesh spanning the whole arena draws the same frame
 * as 1,900 separately-culled ones — it just submits more triangles to do it. The
 * arena's props are **268,600 triangles in total** against a frame that already
 * submits 1,095,807, so that trade is small and it is paid on the GPU, which this
 * frame has 6.2x of spare.
 *
 * ⚠️ `Material.clone()` silently drops `onBeforeCompile` and that has cost this
 * project a shipped bug across 54 sites. This function **never clones a material**:
 * the merged mesh is handed the exact instance its sources shared, so the Fresnel
 * rim patch, the ramp and every uniform come with it untouched.
 */
export function mergeStaticMeshes(root: THREE.Object3D, label = 'merged'): MergeStaticReport {
  root.updateMatrixWorld(true);
  const toLocal = new THREE.Matrix4().copy(root.matrixWorld).invert();

  const report: MergeStaticReport = { removed: 0, created: 0, kept: 0, prunedGroups: 0 };
  const buckets = new Map<string, { mat: THREE.Material; meshes: MergeSource[] }>();

  const walk = (o: THREE.Object3D): void => {
    if (o.userData?.[MERGE_SKIP]) return;
    const m = o as THREE.Mesh;
    if (m.isMesh) {
      const key = bucketKey(m);
      if (key === null) report.kept++;
      else {
        const e = buckets.get(key) ?? { mat: m.material as THREE.Material, meshes: [] };
        // The world matrix is CAPTURED HERE, before anything is detached. Reading
        // it later would recompute it from a parent chain the merge has already
        // taken apart, and a prop would bake at the wrong place — plausibly, and
        // only in whichever bucket happened to be processed last.
        e.meshes.push({ mesh: m, world: m.matrixWorld.clone() });
        buckets.set(key, e);
      }
    }
    for (const c of [...o.children]) walk(c);
  };
  walk(root);

  for (const [, { mat, meshes }] of buckets) {
    // A bucket of one is already one draw call. Merging it would only move it in
    // the graph and lose its own frustum culling for nothing.
    if (meshes.length < 2) { report.kept++; continue; }
    const geo = bakeGeometries(meshes, toLocal);
    if (!geo) { report.kept += meshes.length; continue; }
    const src = meshes[0].mesh;
    const out = new THREE.Mesh(geo, mat);
    // AGENT-BRIEF §3: an UNNAMED mesh is invisible to every diagnostic here.
    out.name = `${label}:${src.name || 'mesh'}:${meshes.length}`;
    out.castShadow = src.castShadow;
    out.receiveShadow = src.receiveShadow;
    out.renderOrder = src.renderOrder;
    out.layers.mask = src.layers.mask;
    for (const m of meshes) m.mesh.removeFromParent();
    root.add(out);
    report.removed += meshes.length;
    report.created++;
  }

  // Prune the containers the merge emptied. A `cover:*` group with no drawables
  // left is 100% of a `updateMatrixWorld` walk for 0% of a frame — and the walk is
  // the -2.30 ms this function exists to remove.
  const prune = (o: THREE.Object3D): boolean => {
    if (o.userData?.[MERGE_SKIP]) return false;
    for (const c of [...o.children]) if (prune(c)) { c.removeFromParent(); report.prunedGroups++; }
    const any = o as THREE.Mesh & { isLight?: boolean; isCamera?: boolean };
    return o !== root && o.children.length === 0
      && !any.isMesh && !any.isLight && !any.isCamera
      && !(o as THREE.Points).isPoints && !(o as THREE.Sprite).isSprite;
  };
  prune(root);

  return report;
}

/** A merge source, with the world matrix it had BEFORE anything was detached. */
interface MergeSource { mesh: THREE.Mesh; world: THREE.Matrix4 }

/**
 * The per-draw identity of a mesh: two meshes may only be merged if this matches.
 * `null` means "not mergeable at all" — reported as kept rather than merged.
 */
function bucketKey(m: THREE.Mesh): string | null {
  if (!m.visible) return null;                    // hidden: leave it hidden, alone
  // A mesh with children would take its whole subtree out of the graph when it is
  // detached. Measured on the shipped arena (`tools/tmp/mg_probe.mjs`): ZERO of the
  // 1,908 static prop drawables have children, so refusing them costs nothing and
  // removes an entire class of bug rather than handling it.
  if (m.children.length) return null;
  if (Array.isArray(m.material)) return null;     // multi-material draw groups
  if ((m as unknown as { isInstancedMesh?: boolean }).isInstancedMesh) return null;
  if ((m as unknown as { isSkinnedMesh?: boolean }).isSkinnedMesh) return null;
  const geo = m.geometry;
  const mat = m.material as THREE.Material | undefined;
  if (!geo || !mat) return null;
  if (geo.morphAttributes && Object.keys(geo.morphAttributes).length) return null;
  // ⚠️ THERE IS NO `geometry.groups` TEST HERE, AND THE FIRST VERSION HAD ONE.
  // `THREE.BoxGeometry` emits SIX groups, one per face, so `groups.length > 1`
  // rejected essentially every prop in the arena: the first run of this merge
  // collapsed 452 of 1,908 drawables instead of 1,908, and the count looked like a
  // plausible partial success rather than a bug.
  // Groups only ever mean anything when `object.material` IS AN ARRAY —
  // `WebGLRenderer.projectObject` and `WebGLShadowMap.renderObject` both branch on
  // `Array.isArray(material)` and ignore `geometry.groups` entirely otherwise, in
  // both the main and the shadow pass. The array case is already refused above, so
  // by this line groups are dead data and the merged geometry deliberately carries
  // none.
  const pos = geo.getAttribute('position');
  if (!pos) return null;
  // The attribute SET has to match exactly. A merged buffer with a hole in its uv
  // channel is a texture read of garbage, which renders plausibly and wrongly —
  // this repo's most expensive failure mode.
  const sig = Object.keys(geo.attributes).sort()
    .map((k) => {
      const a = geo.attributes[k] as THREE.BufferAttribute;
      return `${k}:${a.itemSize}:${a.normalized ? 1 : 0}`;
    }).join(',');
  return [
    mat.uuid, sig,
    m.castShadow ? 1 : 0, m.receiveShadow ? 1 : 0,
    m.renderOrder | 0, m.layers.mask,
  ].join('|');
}

/**
 * Bake `meshes` into one geometry expressed in the frame `toLocal` maps world into.
 *
 * Every attribute the sources carry survives. `position` is transformed by the full
 * world matrix, `normal` by the normal matrix and renormalised, and everything else
 * — uv, uv1, colour — is copied verbatim, which is correct because none of them is
 * a spatial quantity.
 *
 * ⚠️ A MIRRORED PROP FLIPS TRIANGLE WINDING. A matrix with a negative determinant
 * (an authored `scale.x = -1`, which is how a mirror-pair prop is cheapest to
 * build) reverses front and back faces. Three handles that per-object via
 * `material.side` and the renderer's own front-face flip; a merged mesh has ONE
 * winding for all of it, so the indices of a mirrored source are emitted reversed.
 * Without this, half a mirror-symmetric arena renders inside-out under backface
 * culling — and it would look fine from the one angle you happened to shoot.
 */
function bakeGeometries(meshes: MergeSource[], toLocal: THREE.Matrix4): THREE.BufferGeometry | null {
  const names = Object.keys(meshes[0].mesh.geometry.attributes);
  let vTotal = 0;
  let iTotal = 0;
  for (const { mesh } of meshes) {
    const g = mesh.geometry;
    const p = g.getAttribute('position');
    if (!p) return null;
    vTotal += p.count;
    iTotal += g.index ? g.index.count : p.count;
  }
  if (vTotal === 0) return null;

  const out = new THREE.BufferGeometry();
  const dst = new Map<string, THREE.BufferAttribute>();
  for (const n of names) {
    const a = meshes[0].mesh.geometry.getAttribute(n) as THREE.BufferAttribute;
    const arr = new Float32Array(vTotal * a.itemSize);
    dst.set(n, new THREE.BufferAttribute(arr, a.itemSize, a.normalized));
  }
  const index = vTotal > 65535 ? new Uint32Array(iTotal) : new Uint16Array(iTotal);

  const v = new THREE.Vector3();
  const mw = new THREE.Matrix4();
  const nm = new THREE.Matrix3();
  let vOff = 0;
  let iOff = 0;
  for (const { mesh, world } of meshes) {
    mw.multiplyMatrices(toLocal, world);
    nm.getNormalMatrix(mw);
    const flip = mw.determinant() < 0;
    const g = mesh.geometry;
    const p = g.getAttribute('position') as THREE.BufferAttribute;

    for (const n of names) {
      const src = g.getAttribute(n) as THREE.BufferAttribute | undefined;
      const d = dst.get(n)!;
      if (!src) return null;
      if (n === 'position') {
        for (let i = 0; i < src.count; i++) {
          v.fromBufferAttribute(src, i).applyMatrix4(mw);
          d.setXYZ(vOff + i, v.x, v.y, v.z);
        }
      } else if (n === 'normal') {
        for (let i = 0; i < src.count; i++) {
          v.fromBufferAttribute(src, i).applyMatrix3(nm).normalize();
          d.setXYZ(vOff + i, v.x, v.y, v.z);
        }
      } else {
        const w = src.itemSize;
        for (let i = 0; i < src.count; i++) {
          if (w >= 1) d.setX(vOff + i, src.getX(i));
          if (w >= 2) d.setY(vOff + i, src.getY(i));
          if (w >= 3) d.setZ(vOff + i, src.getZ(i));
          if (w >= 4) d.setW(vOff + i, src.getW(i));
        }
      }
    }

    const idx = g.index;
    const n = idx ? idx.count : p.count;
    const at = (k: number): number => (idx ? idx.getX(k) : k) + vOff;
    if (flip) {
      for (let t = 0; t + 2 < n; t += 3) {
        index[iOff + t] = at(t + 2); index[iOff + t + 1] = at(t + 1); index[iOff + t + 2] = at(t);
      }
    } else {
      for (let k = 0; k < n; k++) index[iOff + k] = at(k);
    }
    iOff += n;
    vOff += p.count;
  }

  for (const [n, a] of dst) out.setAttribute(n, a);
  out.setIndex(new THREE.BufferAttribute(index, 1));
  out.computeBoundingSphere();
  out.computeBoundingBox();
  return out;
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
