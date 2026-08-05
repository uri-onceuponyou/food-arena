/**
 * Stage — renderer + scene + camera + lighting + post FX, wired together.
 *
 * Both the live game and every isolated piece preview construct a Stage, so a
 * character approved in preview renders identically in a match. If you change the
 * look, change it here, not in a preview.
 */

import * as THREE from 'three';
import {
  EffectComposer, RenderPass, EffectPass, NormalPass,
  BloomEffect, SMAAEffect, VignetteEffect, SSAOEffect,
  BlendFunction, Effect,
} from 'postprocessing';
import { CameraRig, SUPPORTED_ASPECT, type CameraRigOptions } from './camera';
import { createLighting, MATCH_SHADOW_RADIUS_M, type LightingRig } from './lighting';
import { noteGpu, onQualityChange, tierProfile, type TierProfile } from './quality';

// ─────────────────────────────────────────────────────────────────────────────
// THE GRADE — a saturation curve that cannot clip a channel
// ─────────────────────────────────────────────────────────────────────────────
//
// WHAT WAS WRONG (measured 2026-08-03, `tools/tmp/post_probe.mjs`, unlit swatches
// pushed through the live chain so lighting is out of the equation):
//
//   authored              arrived as        HSV sat          hue
//   KPAL.freezerDoor  #2E88AC (46,136,172)  ->   (0,140,200)  0.73 -> 1.00   +0.9°
//   KPAL.steel        #184F6E (24, 79,110)  ->   (0, 68,119)  0.78 -> 1.00   +4.1°
//   KPAL.subfloor     #B08355 (176,131,85)  -> (205,128, 13)  0.52 -> 0.94   +5.6°
//   KPAL.cabinet      #C1731E (193,115,30)  -> (233, 99,  0)  0.84 -> 1.00   -5.8°
//   KPAL.tileLight    #EAD3A8 (234,211,168) -> (255,232,149)  0.28 -> 0.42   +7.9°
//
// EIGHT of twelve sampled palette colours lost a channel outright, and every one of
// those arrived at HSV saturation 1.00 — an authored range of 0.52..0.89 collapsing
// onto a single value. Saturation had stopped being a dimension the palette could
// use. On the whole shipped frame, 9.4% of pixels had a channel pinned at 0 and
// 10.6% had one pinned at 255: a fifth of the image was carrying destroyed colour.
//
// `KPAL.subfloor` is the "heavy orange grout" complaint, reproduced: the authored
// warm brown arrives with blue crushed 85 -> 13 and its hue rotated toward orange.
// Rounds of albedo edits could never have fixed that, because the albedo was fine.
//
// WHY: `HueSaturationEffect` extrapolates each channel away from the ARITHMETIC MEAN
// of LINEAR RGB — and `EffectPass` runs it in linear light (verified by dumping the
// generated shader: `sRGBTransferOETF` is only inserted later, for the contrast
// pass). In linear light the mean is dominated by whichever channel is brightest, so
// the dimmest channel's distance from it is large, and a gain of 1/(1.001-0.32) =
// 1.47x drives it negative. Nothing clamps in between — the buffer is HalfFloat and
// the whole chain is one shader — so the negative survives to the framebuffer write
// and lands as 0. `BrightnessContrastEffect` then compounds it: gain 1/(1-0.18) =
// 1.22x about 0.5 in sRGB pushes anything below 23/255 to black and anything above
// 232/255 to white.
//
// THE FIX IS NOT LESS SATURATION. The art direction genuinely is hyper-saturated
// (reference: smooth-shaded, hyper-saturated, high-key, vinyl toy). The fix is a
// curve that spends the available gamut instead of overrunning it:
//
//   1. Work in sRGB (perceptual) space, not linear. Same nominal boost, far smaller
//      chroma excursion, and no hue rotation from the linear mean's green bias.
//   2. Saturate about Rec.709 LUMA, not the channel mean, so a chroma boost does not
//      also change perceived lightness.
//   3. Per pixel, compute `gMax` — the exact gain at which the first channel would
//      reach 0 or 1 — and drive the requested gain through a soft knee that is the
//      identity well below `gMax` and asymptotic to it above. Deep colours therefore
//      approach the gamut boundary and never cross it. Ordering is preserved: a 0.52
//      colour still arrives less saturated than a 0.89 one.
//   4. Contrast as a bounded S-curve (a mix toward `smoothstep`) rather than a linear
//      gain about 0.5. `smoothstep` maps [0,1] onto [0,1], so the ends COMPRESS
//      instead of clipping — the shadow ramp keeps its ordering, which is what lets
//      three stacked darkenings read as three things instead of one flat blob.
//
// CONSTRAINT FOR COLOUR AUTHORS ELSEWHERE: author the colour you actually want. The
// chain is now hue-faithful (<= ~2°) and monotone in saturation, so `KPAL` entries
// no longer need to be pre-compensated against the grade. Expect roughly +0.1 HSV
// saturation and unchanged hue/value on screen.
const TOY_GRADE_SHADER = /* glsl */`
uniform float satAmount;
uniform float satKnee;
uniform float contrastAmount;
uniform float highlightKnee;

/* Identity below k, asymptotic to 1 above it. C1 continuous at the join. */
float softKnee(const in float x, const in float k) {
  float head = max(1.0 - k, 1e-4);
  return x < k ? x : k + head * (1.0 - exp(-(x - k) / head));
}

void mainImage(const in vec4 inputColor, const in vec2 uv, out vec4 outputColor) {
  vec3 c = max(inputColor.rgb, 0.0);

  // ── Highlight shoulder ──
  // Scale by the BRIGHTEST channel's rolloff. A uniform scale leaves hue and HSV
  // saturation exactly unchanged — this is a range fix, not a look change, and
  // specifically not a filmic tonemap (nothing here desaturates).
  float m = max(c.r, max(c.g, c.b));
  if (m > highlightKnee) c *= softKnee(m, highlightKnee) / m;

  // Bounded contrast. smoothstep is monotone [0,1] -> [0,1], so mixing toward it can
  // never push a channel out of range: mid-tones steepen, ends compress.
  c = mix(c, c * c * (3.0 - 2.0 * c), contrastAmount);

  // Gamut-limited saturation about luma.
  float l = dot(c, vec3(0.2126, 0.7152, 0.0722));
  vec3 d = c - l;
  // Distance to the bound each channel is travelling toward, then the gain that
  // would put it exactly there. The smallest of the three is the pixel's ceiling.
  vec3 headroom = mix(vec3(1.0 - l), vec3(l), step(d, vec3(0.0)));
  vec3 lim = headroom / max(abs(d), vec3(1e-4));
  float avail = max(min(lim.r, min(lim.g, lim.b)) - 1.0, 1e-4);

  // Identity below the knee, asymptotic above it: the gain approaches gMax but never
  // reaches it. Scaled by 0.88 so the last sliver of headroom is always left unspent
  // — without it a channel lands within half a quantisation step of 0 and rounds to
  // black anyway, which is the very failure this whole curve exists to prevent.
  float tUse = 0.88 * softKnee(satAmount / avail, satKnee);

  outputColor = vec4(clamp(l + (1.0 + tUse * avail) * d, 0.0, 1.0), inputColor.a);
}
`;

export class ToyGradeEffect extends Effect {
  constructor({ saturation = 0.70, contrast = 0.62, knee = 0.55, highlightKnee = 0.82 } = {}) {
    super('ToyGradeEffect', TOY_GRADE_SHADER, {
      blendFunction: BlendFunction.SRC,
      uniforms: new Map<string, THREE.Uniform>([
        ['satAmount', new THREE.Uniform(saturation)],
        ['satKnee', new THREE.Uniform(knee)],
        ['contrastAmount', new THREE.Uniform(contrast)],
        ['highlightKnee', new THREE.Uniform(highlightKnee)],
      ]),
    });
    // Grade in display-encoded space. `EffectPass` inserts the sRGB transfer for us.
    this.inputColorSpace = THREE.SRGBColorSpace;
  }

  get saturation(): number { return this.uniforms.get('satAmount')!.value as number; }
  set saturation(v: number) { this.uniforms.get('satAmount')!.value = v; }
  get contrast(): number { return this.uniforms.get('contrastAmount')!.value as number; }
  set contrast(v: number) { this.uniforms.get('contrastAmount')!.value = v; }
  get knee(): number { return this.uniforms.get('satKnee')!.value as number; }
  set knee(v: number) { this.uniforms.get('satKnee')!.value = v; }
  get highlightKnee(): number { return this.uniforms.get('highlightKnee')!.value as number; }
  set highlightKnee(v: number) { this.uniforms.get('highlightKnee')!.value = v; }
}

/**
 * The environment the whole cast is lit and reflected in — a sky/ground gradient
 * dome with a few bright panels in it.
 *
 * Two jobs, deliberately separated (see the IBL note in the Stage constructor):
 *
 *  - The DOME carries the diffuse irradiance. Its top is a bright cool sky and its
 *    bottom a dark warm bounce, matching `lighting.ts`'s hemisphere fill so the two
 *    agree rather than fight. Because the two ends differ in VALUE and not merely in
 *    hue, a surface's irradiance now depends on which way it faces, which is the
 *    whole point: it reinforces the key's modelling instead of filling it in.
 *  - The PANELS carry the specular. They are small, above the horizon and brighter
 *    than 1.0, which is what puts a tight reflected highlight on a rounded vinyl
 *    surface. Keeping them small keeps their contribution to the diffuse integral
 *    negligible, so sheen can be tuned without touching the fill balance.
 */
function buildGradientEnvironment(): THREE.Scene {
  const scene = new THREE.Scene();

  // Inverted sphere, coloured per vertex by height. Vertex colours rather than a
  // texture because a gradient map's orientation depends on `flipY` and on the
  // geometry's UV convention, and getting that upside down would invert the entire
  // rig's fill with no obvious symptom beyond "it looks flat".
  const dome = new THREE.SphereGeometry(12, 32, 24);
  const pos = dome.attributes.position;
  const colors = new Float32Array(pos.count * 3);
  const sky = new THREE.Color(0xdff0ff);
  const horizon = new THREE.Color(0xa8a4a0);
  const ground = new THREE.Color(0x30231a);
  const c = new THREE.Color();
  for (let i = 0; i < pos.count; i++) {
    const t = THREE.MathUtils.clamp(pos.getY(i) / 12, -1, 1);
    // Two-segment ramp through the horizon, so the falloff is steepest right around
    // the equator where most of a rounded prop's normals actually point.
    if (t >= 0) c.copy(horizon).lerp(sky, Math.pow(t, 0.7));
    else c.copy(horizon).lerp(ground, Math.pow(-t, 0.55));
    colors[i * 3] = c.r; colors[i * 3 + 1] = c.g; colors[i * 3 + 2] = c.b;
  }
  dome.setAttribute('color', new THREE.BufferAttribute(colors, 3));
  scene.add(new THREE.Mesh(dome, new THREE.MeshBasicMaterial({
    vertexColors: true, side: THREE.BackSide, toneMapped: false,
  })));

  // Specular sources. Values above 1 on purpose — a highlight has to out-run the
  // diffuse it sits on or it reads as a pale smudge rather than a reflection.
  const panel = (x: number, y: number, z: number, w: number, h: number, v: number) => {
    const m = new THREE.Mesh(
      new THREE.PlaneGeometry(w, h),
      new THREE.MeshBasicMaterial({ side: THREE.DoubleSide, toneMapped: false }),
    );
    (m.material as THREE.MeshBasicMaterial).color.setRGB(v, v * 0.985, v * 0.95);
    m.position.set(x, y, z);
    m.lookAt(0, 0, 0);
    scene.add(m);
  };
  // Keyed to `lighting.ts`'s key at (+x, +y, +z) so the reflected highlight and the
  // diffuse terminator agree about where the light is.
  panel(5.5, 9.0, 4.5, 7, 7, 3.2);
  // A softer, cooler kicker opposite it, matching the rim's side.
  panel(-6.0, 5.0, -7.0, 6, 4, 1.15);

  return scene;
}

export interface StageOptions {
  canvas?: HTMLCanvasElement;
  container?: HTMLElement;
  camera?: CameraRigOptions;
  /** Backdrop colour behind everything. */
  background?: THREE.ColorRepresentation;
  /** Distance fog tint. Set null to disable. */
  fog?: { color: THREE.ColorRepresentation; near: number; far: number } | null;
  /**
   * Post chain. `true` is the full chain; `false` skips the composer entirely.
   *
   * `'grade'` is the cheap middle: `ToyGradeEffect` + vignette in ONE `EffectPass`,
   * with no bloom and no SMAA. It exists because the grade IS the look — ablation
   * puts it at mean 19.39/255 over 99.99% of pixels for zero extra draw calls, since
   * it merges into a pass that has to run anyway — while bloom and SMAA are 19 of
   * the post chain's 20 draws and ~85% of its fill. Anything that renders a
   * thumbnail or an offscreen plate wants the colour identity without the cost.
   */
  postFx?: boolean | 'grade';
  shadows?: boolean;
  /**
   * Shadow map resolution. Defaults to a DENSITY, not a constant — see the
   * derivation in the constructor. Pass a number only to pin it.
   */
  shadowMapSize?: number;
  /**
   * Demote shadow casters whose world radius is smaller than this many shadow-map
   * texels. Default 2.5; 0 disables. See `auditShadowCaster`.
   */
  shadowCasterMinTexels?: number;
  /**
   * This Stage renders offscreen and is never the thing on screen — a thumbnail
   * generator, a plate renderer. It stays out of the `window.__stage` QA slot so a
   * probe never measures it by accident.
   */
  offscreen?: boolean;
  /** Image-based lighting. On by default — it is what gives surfaces their sheen. */
  environment?: boolean;
  environmentIntensity?: number;
  /**
   * Screen-space ambient occlusion. **OFF by default — see `buildPost`.** It was
   * measured to contribute EXACTLY ZERO at every framing this project renders, so
   * leaving it on bought nothing and cost a NormalPass plus a 16-tap AO pass.
   */
  ao?: boolean;
  /**
   * Cap the device pixel ratio. Screenshots use 2 for crisp critic review.
   *
   * This is a caller's ADDITIONAL ceiling, never a floor: the effective ratio is
   * `min(devicePixelRatio, this, tier.pixelRatioCap)`. A review harness asking for 2
   * on a phone still gets the phone's tier cap, because the alternative is a harness
   * that renders at a resolution the game never uses.
   */
  maxPixelRatio?: number;
}

/**
 * Every Stage ever built that has not been disposed.
 *
 * `window.__stage` used to be a single slot assigned by each constructor, so the
 * LAST Stage built won — which on a menu is `thumbs.ts`'s offscreen generator, and
 * that one then disposes itself. Every QA probe reading `__stage` on a menu route
 * was therefore reading a DEAD Stage: `tools/perf.mjs` duly reported the trophy road
 * as a 448x448 buffer with 0 meshes and shadows off, which describes the thumbnail
 * generator's corpse and not the screen.
 *
 * The slot is now a getter over this registry, preferring a live Stage that is
 * actually on screen. `tools/perf.mjs` installs an identical shim before the app
 * boots; when it does, `ensureRegistry` finds `__stages` already present and leaves
 * it alone, so the two cannot fight.
 */
const STAGES: Stage[] = [];

function canvasOnScreen(stage: Stage): boolean {
  const c = stage.canvas;
  if (!c?.isConnected) return false;
  // `isConnected` is not enough: `thumbs.ts` parks its generator host at
  // left:-9999px, which is connected, laid out and 448 px wide. Only an intersection
  // with the viewport tells the two apart.
  const r = c.getBoundingClientRect();
  return r.width > 1 && r.height > 1 && r.right > 0 && r.bottom > 0
    && r.left < window.innerWidth && r.top < window.innerHeight;
}

function ensureRegistry(): void {
  if (typeof window === 'undefined') return;
  const w = window as unknown as { __stages?: unknown };
  if (w.__stages) return; // a probe already installed its own registry
  w.__stages = STAGES;
  Object.defineProperty(window, '__stage', {
    configurable: true,
    get() {
      const live = STAGES.filter((s) => !s.disposed && !s.offscreen);
      return live.filter(canvasOnScreen).pop() ?? live.pop()
        ?? STAGES.filter((s) => !s.disposed).pop();
    },
    set() { /* registration happens in the constructor */ },
  });
}

export class Stage {
  readonly renderer: THREE.WebGLRenderer;
  readonly scene: THREE.Scene;
  readonly rig: CameraRig;
  readonly lighting: LightingRig;
  readonly canvas: HTMLCanvasElement;
  /** True once `dispose()` has run. Read by QA probes to skip dead stages. */
  disposed = false;
  /** Never the thing on screen — see `StageOptions.offscreen`. */
  readonly offscreen: boolean;
  private composer: EffectComposer | null = null;
  private container: HTMLElement;
  private envMap: THREE.Texture | null = null;
  private useAO = false;
  private shadowsOn = false;
  /** The quality knobs this Stage was last built/applied with. */
  private profile: TierProfile = tierProfile();
  /** The caller's own pixel-ratio ceiling, if it gave one. Never a floor — see `StageOptions`. */
  private readonly maxPixelRatio: number;
  /** `postFx === 'grade'` — remembered so the chain can be rebuilt on a tier change. */
  private gradeOnly = false;
  /** A caller's explicit `shadowMapSize`. Pinned means pinned — a tier change must not move it. */
  private readonly pinnedShadowMapSize: number | null;
  private unsubscribeQuality: (() => void) | null = null;
  /** Fingerprint of everything the shadow map depends on, from the last frame. */
  private shadowSig = -1;
  private shadowCasterMinTexels: number;
  /** The colour grade, exposed so a probe can sweep it without a rebuild. */
  grade: ToyGradeEffect | null = null;

  constructor(opts: StageOptions = {}) {
    this.useAO = opts.ao === true;
    this.offscreen = opts.offscreen === true;
    this.shadowCasterMinTexels = opts.shadowCasterMinTexels ?? 2.5;
    this.container = opts.container ?? document.body;
    this.canvas = opts.canvas ?? document.createElement('canvas');
    this.maxPixelRatio = opts.maxPixelRatio ?? Infinity;
    this.pinnedShadowMapSize = opts.shadowMapSize ?? null;
    // `postFx: false` needs no flag of its own: it leaves `composer` null, and
    // `applyQuality` only ever rebuilds a chain that already exists.
    this.gradeOnly = opts.postFx === 'grade';
    if (!this.canvas.parentElement) this.container.appendChild(this.canvas);

    this.renderer = new THREE.WebGLRenderer({
      canvas: this.canvas,
      antialias: true,
      alpha: false,
      powerPreference: 'high-performance',
      // Required so Playwright's toDataURL/screenshot sees the drawn frame.
      preserveDrawingBuffer: true,
    });
    this.renderer.setPixelRatio(this.effectivePixelRatio());
    this.reportGpu();
    this.renderer.outputColorSpace = THREE.SRGBColorSpace;
    this.renderer.toneMapping = THREE.NoToneMapping; // handled in post
    // ── The shadow map does NOT re-render every frame any more ────────────────
    //
    // `shadowMap.autoUpdate` was never set, so it was three's default `true` and the
    // WHOLE shadow map re-rendered on every single frame. Measured in a live match
    // at 1300x740 with `renderer.info.autoReset = false` (the only way to read a
    // post-processed frame's real total — see `tools/tmp/perfpass_probe.mjs`):
    //
    //   frame with the shadow pass ....... 692 draws
    //   same frame, shadow map frozen .... 390 draws
    //   => the shadow pass IS 302 draws, 43.6% of the whole frame
    //
    // ...for an arena that does not move. `render()` now recomputes the map only
    // when something it depends on has actually changed. Read `scheduleShadowUpdate`
    // before assuming that means "only when the player moves": the honest accounting
    // is that during play the two fighters move every frame and each is ~85 casters,
    // so a match still pays most of this. What it removes is every frame where
    // nothing moves — menus, the results overlay, thumbnail and preview plates — and
    // it is what makes the focus quantisation in `lighting.ts` worth anything.
    if (opts.shadows !== false && this.profile.shadows) {
      this.shadowsOn = true;
      this.renderer.shadowMap.enabled = true;
      this.renderer.shadowMap.type = THREE.PCFSoftShadowMap;
      this.renderer.shadowMap.autoUpdate = false;
      this.renderer.shadowMap.needsUpdate = true;
    }

    this.scene = new THREE.Scene();
    this.scene.background = new THREE.Color(opts.background ?? 0x2a1f3d);
    if (opts.fog !== null) {
      const f = opts.fog ?? { color: 0x3a2a4d, near: 30, far: 90 };
      this.scene.fog = new THREE.Fog(new THREE.Color(f.color), f.near, f.far);
    }

    this.rig = new CameraRig(opts.camera);
    // The shadow box only has to cover a whole ultrawide game viewport in an actual
    // match; every preview framing is closer and focuses its own tighter box, so
    // forcing the match minimum on those would only coarsen their shadows.
    const isMatch = this.rig.frameMode === 'fair';
    const subject = this.rig.frameMode === 'subject';
    this.lighting = createLighting({
      minFocusRadius: isMatch ? MATCH_SHADOW_RADIUS_M : undefined,
      // A subject framing is ONE character on a pedestal at the origin. The rig's
      // 22 m default box was sized for a ground framing, and at the key's 30° the
      // longest shadow a 2.5 m character throws is ~4.3 m — so 8 m is generous and
      // the other 14 were spending texels on empty floor. This is what makes 1024
      // safe below: 1024 across 16 m is 64 texels/m, DOUBLE the 30.1 texels/m the
      // shipped match renders at, off a quarter of the memory.
      shadowRadius: subject ? 8 : undefined,
      shadowMapSize: opts.shadowMapSize ?? this.defaultShadowMapSize(isMatch),
    });
    // Casters are only culled by size in an actual match — see `auditShadowCaster`.
    // Every other framing is a review plate or a menu portrait: closer, denser, and
    // the place where somebody is deliberately looking for small detail.
    if (!isMatch) this.shadowCasterMinTexels = opts.shadowCasterMinTexels ?? 0;
    this.scene.add(this.lighting.group);

    // ── Image-based lighting ─────────────────────────────────────────────────
    // Without an environment map, MeshStandardMaterial derives specular purely from
    // direct lights, which yields a dull, chalky surface no matter how the lights are
    // tuned. Reference art gets its moulded-vinyl sheen from IBL. This is the single
    // largest material-quality win available, and it applies to every mesh at once.
    //
    // BUT: which environment matters more than how much of it. Measured with a
    // neutral matte sphere dropped into the live scene
    // (`tools/tmp/terminator_probe.mjs`, value facing the key vs facing away):
    //
    //   as shipped, RoomEnvironment @0.32 ....  lit 0.753  away 0.323   away/lit 0.429
    //   same, IBL switched off ...............  lit 0.619  away 0.153   away/lit 0.248
    //
    // i.e. `RoomEnvironment` was adding MORE light to the shadow side (+0.170) than to
    // the lit side (+0.134). It is an enclosed white box, so its irradiance is nearly
    // the same in every direction — the definition of flat ambient. It was quietly
    // undoing the same top-vs-side falloff that `lighting.ts` darkened its hemisphere
    // fill to protect, and it was doing it more than three times as hard as the
    // ambient and hemisphere lights combined (which move away/lit by only 0.004 and
    // 0.016). A blind critic measuring horizontal scanlines called the result out
    // exactly: "the lighting is producing binary lit/unlit steps between surfaces and
    // nothing across them."
    //
    // The old comment here concluded that the fix was a lower `environmentIntensity`,
    // and that a previous round had tried 0.22 and been told it read as flat matte
    // plastic with no sheen. Both are true, and both are the wrong axis. Turning a
    // uniform environment down removes the sheen and the flatness together, because
    // one uniform number scales the diffuse irradiance and the specular reflection
    // alike. Replacing the environment separates them: a sky/ground GRADIENT dome
    // gives diffuse irradiance that genuinely varies with surface orientation (it
    // reinforces the key instead of filling it in), while the bright panels inside it
    // keep — in fact sharpen — the crisp reflected highlight that sells moulded vinyl.
    if (opts.environment !== false) {
      const pmrem = new THREE.PMREMGenerator(this.renderer);
      // NOT `compileEquirectangularShader()`. That warms the equirect-to-cubemap
      // material, which `fromScene` never touches — it renders the scene into the
      // cube faces directly. It was one wasted program link per Stage, and a program
      // link is a synchronous 10-60 ms stall on a mobile driver.
      const envScene = buildGradientEnvironment();
      this.envMap = pmrem.fromScene(envScene, 0.035).texture;
      this.scene.environment = this.envMap;
      // Held at the same number as the uniform box it replaces, so this change is a
      // change of SHAPE, not of exposure.
      this.scene.environmentIntensity = opts.environmentIntensity ?? 0.32;
      envScene.traverse((o) => {
        const m = o as THREE.Mesh;
        if (m.isMesh) { m.geometry?.dispose(); (m.material as THREE.Material)?.dispose(); }
      });
      pmrem.dispose();
    }

    if (opts.postFx !== false) this.buildPost(opts.postFx === 'grade');
    this.resize();

    // QA-only handle, same spirit as match.ts's `__vfxDebug*`. Never read by game
    // code — it exists so a Playwright probe can measure the post chain and toggle
    // scene layers (e.g. the arena's baked shadow decals) without a rebuild.
    if (typeof window !== 'undefined') {
      ensureRegistry();
      STAGES.push(this);
      // If a probe installed its own registry first, its `__stage` setter is what
      // does the registering. Assigning is a no-op against our own getter.
      try { (window as unknown as { __stage?: Stage }).__stage = this; } catch { /* our getter is read-only */ }
    }

    // Subscription, not a back-reference: `quality.ts` has no imports and must never
    // learn that `Stage` exists, or the dependency graph acquires a cycle that every
    // character and arena module would then be inside.
    this.unsubscribeQuality = onQualityChange(() => this.applyQuality());
  }

  /**
   * The pixel ratio this Stage may draw at.
   *
   * ── The bug this closes ─────────────────────────────────────────────────────
   * This used to be `min(devicePixelRatio, opts.maxPixelRatio ?? 2)`, i.e. a flat cap
   * of 2 for every device in the world. Phones report **DPR 3 to 4**, so a phone was
   * drawing 1688x780 where its own screen wanted 2532x1170 — the cap was doing real
   * work already — but 2 was chosen for desktop screenshot crispness and nothing ever
   * asked whether a phone should pay it. At this project's measured post-chain
   * overdraw of 5.7x, the difference between DPR 2 and DPR 1.25 on a phone is
   * 1.32 Mpx of buffer shaded ~6 times versus 0.51 Mpx — the single largest
   * hardware-independent lever mobile has.
   *
   * `maxPixelRatio` stays a caller ceiling and never a floor: a review harness that
   * pins 2 still gets the tier cap on a phone. `min` of everything, always.
   */
  private effectivePixelRatio(): number {
    const dpr = typeof window === 'undefined' ? 1 : (window.devicePixelRatio || 1);
    return Math.min(dpr, this.maxPixelRatio, this.profile.pixelRatioCap);
  }

  /**
   * Hand the GPU's own name to `quality.ts`, once.
   *
   * DIAGNOSTIC ONLY — nothing picks a tier from it. It cannot be a detection signal
   * because the first Stage is built before any GL context exists, and a tier that
   * changed after the scene was built would be a tier that half-applied (ink outlines
   * are baked at build time). It is here so a settings row and a bug report can say
   * *which* device made the choice.
   */
  private reportGpu(): void {
    try {
      const gl = this.renderer.getContext();
      const ext = gl.getExtension('WEBGL_debug_renderer_info');
      noteGpu(ext ? String(gl.getParameter(ext.UNMASKED_RENDERER_WEBGL)) : null);
    } catch {
      // Some browsers gate the extension behind a privacy setting. Not important.
    }
  }

  /**
   * Re-apply the quality tier to a Stage that is already on screen.
   *
   * Called from the `onQualityChange` subscription, i.e. whenever the player moves the
   * graphics control in settings. Three things move immediately and one cannot:
   *
   *   * PIXEL RATIO — `setPixelRatio` + `resize()`. Instant, and the only part of this
   *     the player will actually see move while the settings screen is open.
   *   * SHADOW MAP — `lighting.setShadowMapSize()` disposes the old render target and
   *     lets three allocate the new one on the next shadow render. `markShadowsDirty()`
   *     forces that render, because the fingerprint in `scheduleShadowUpdate` hashes
   *     the FRUSTUM and the casters and neither of them changed.
   *   * POST CHAIN — disposed and rebuilt on the SAME renderer. No new canvas, no new
   *     context: `perf --mode leak` must stay flat at 1 through a tier change, and it
   *     is measured doing so.
   *   * INK OUTLINES — cannot move. `outlineGroup` bakes hull meshes at build time.
   *     They pick the new tier up when the next character or arena is constructed,
   *     which for a menu-route settings screen is the next match.
   */
  private applyQuality(): void {
    if (this.disposed) return;
    const next = tierProfile();
    const prev = this.profile;
    if (next.tier === prev.tier) return;
    this.profile = next;

    this.renderer.setPixelRatio(this.effectivePixelRatio());

    if (this.shadowsOn && this.pinnedShadowMapSize === null
        && next.shadowMapScale !== prev.shadowMapScale) {
      this.lighting.setShadowMapSize(this.defaultShadowMapSize(this.rig.frameMode === 'fair'));
      this.markShadowsDirty();
    }

    const postDiffers = next.bloom !== prev.bloom || next.smaa !== prev.smaa
      || next.msaaSamples !== prev.msaaSamples || next.halfFloatBuffers !== prev.halfFloatBuffers;
    if (this.composer && postDiffers) {
      this.composer.dispose();
      this.composer = null;
      this.buildPost(this.gradeOnly);
    }

    this.resize();
  }

  /**
   * Shadow map size, as a DENSITY rather than a constant.
   *
   * It was a flat 2048 for every Stage in the project, which is 16 MB of render
   * target — and the menus and the thumbnail generator were each paying it for a
   * character framed at 5 m. The match's own density is the reference point:
   * 2048 texels across a 68 m box is 30.1 texels/m, and that is the number every
   * shadow in the game has been judged at.
   *
   *   match (r = 34 m) ............ 2048 @ 30.1 texels/m — exactly what shipped
   *   arena preview (r = 30 m) .... 2048 (unchanged — prop loops judge here)
   *   floor preview (r = 16 m) .... 2048 (unchanged)
   *   subject framings (r = 8 m) .. 1024 @ 64 texels/m, i.e. SHARPER than before
   *                                 (2048 over the rig's old 22 m box was 46.5) for
   *                                 a quarter of the memory
   *
   * That covers the menu portrait, `preview.html?piece=character`, and anything else
   * framing a single subject. Ground-framed plates keep 2048 outright: they are what
   * the prop and floor loops are judged on, and a review harness that renders softer
   * than the game is a harness that lies.
   *
   * The tier scales the whole thing: `medium` 0.75 and `low` 0.5, so a match's map is
   * 2048 / 1536 / 1024 and its render target 16 / 9 / 4 MB. The second, quieter effect
   * is the good one — `auditShadowCaster` expresses its cull threshold in TEXELS, so
   * halving the map doubles the world radius below which a caster is demoted (8.3 cm
   * -> 16.6 cm in a match) and more sub-pixel casters drop out of the shadow pass with
   * no extra knob.
   */
  private defaultShadowMapSize(isMatch: boolean): number {
    const base = !isMatch && this.rig.frameMode === 'subject' ? 1024 : 2048;
    return Math.max(512, Math.round(base * this.profile.shadowMapScale));
  }

  private buildPost(gradeOnly: boolean): void {
    const tier = this.profile;
    // Antialiasing, and WHICH kind, is decided here rather than at the SMAA pass.
    //
    // `antialias: true` on the renderer does nothing once a composer exists — the
    // scene is drawn into the composer's own buffer, not the default framebuffer —
    // so SMAA has been carrying all of it. SMAA is 3 draws but 2.89 Mpx of fill,
    // 53% of the whole post chain, plus two LUT textures and two program links.
    // Where it is not worth that, hardware MSAA on the composer's buffer is: it
    // resolves on-chip on every tile-based mobile GPU and costs no pass, no program
    // and no texture.
    const smaa = !gradeOnly && tier.smaa;
    const msaa = smaa ? 0 : Math.max(4, tier.msaaSamples);
    const composer = new EffectComposer(this.renderer, {
      frameBufferType: tier.halfFloatBuffers ? THREE.HalfFloatType : THREE.UnsignedByteType,
      multisampling: msaa,
    });
    composer.addPass(new RenderPass(this.scene, this.rig.camera));

    // ── Ambient occlusion — OFF, and here is the measurement ─────────────────
    //
    // SSAO ran in every render this project ever made and contributed NOTHING. A/B
    // probe (`tools/tmp/ab_probe.mjs`, sim frozen so only the mutation differs),
    // skipping the effect's blend entirely:
    //
    //   live match ....................  mean 0.0000/255, max 0, 0.00% of pixels
    //   preview.html?piece=character ..  mean 0.0000/255, max 0, 0.00% of pixels
    //   preview.html?piece=arena ......  mean 0.0000/255, max 0, 0.00% of pixels
    //
    // Exactly zero, at every framing in the project — not "small", not "sub-pixel".
    // Sweeping the knobs found the single dead one: `worldProximityThreshold: 0.5`.
    // `intensity`, `radius`, `luminanceInfluence`, `minRadiusScale`, `bias` and
    // `fade` all moved the frame by 0.0000; only raising the proximity threshold
    // revived it. The shader rejects any sample whose linear-depth difference from
    // the centre exceeds that threshold, and on a ground plane pitched 58° under a
    // camera with a 300 m far plane, EVERY tap in the kernel exceeds 0.5 m. The
    // occlusion sum was therefore identically 0 and the MULTIPLY blend was a no-op.
    //
    // So the earlier rounds that "pulled the radius back to fine-seam duty"
    // (0.16 → 0.11 → 0.07) were tuning a pass that was already off, and the score
    // this element has been scoring was always the score WITHOUT AO.
    //
    // It is not worth reviving. Rendered with the threshold repaired it does not
    // produce contact seams — at shipped framing a character is ~70 px tall, so
    // seams are sub-pixel — it produces a broad low-frequency dimming of the whole
    // floor (measured mean 2.77/255 across 13% of the frame, and visibly so in
    // shots/light2/ssao/sheet.png). That is precisely the third soft darkening layer,
    // stacked on the arena's authored decals and the real shadow map, that a critic
    // read as one directionless blob and that scored this element 3/10.
    //
    // Kept behind `ao: true` with the dead knob repaired, so a future close-range
    // camera can turn it on knowingly rather than rediscovering the same trap.
    let ssao: SSAOEffect | null = null;
    if (this.useAO) {
      const normalPass = new NormalPass(this.scene, this.rig.camera);
      composer.addPass(normalPass);
      ssao = new SSAOEffect(this.rig.camera, normalPass.texture, {
        blendFunction: BlendFunction.MULTIPLY,
        distanceScaling: true,
        worldDistanceThreshold: 30,
        worldDistanceFalloff: 6,
        // 3.0, not 0.5 — see above. Below ~1.5 the kernel rejects every tap under
        // this rig and the whole pass silently becomes an identity multiply.
        worldProximityThreshold: 3.0,
        worldProximityFalloff: 1.0,
        luminanceInfluence: 0.6,
        samples: 16,
        rings: 5,
        radius: 0.07,
        intensity: 2.4,
        resolutionScale: 0.85,
      });
    }

    // ── Bloom — kept, and here is why, because it was on the block ────────────
    //
    // Bloom only fires on genuinely hot highlights. The threshold is high on purpose:
    // at 0.72 it was haloing plain white geometry (sesame seeds glowed like LEDs).
    // Reopened slightly, 0.88 -> 0.80, once the grade's highlight shoulder stopped
    // large pale surfaces from sitting at the top of the range: the threshold is in
    // LINEAR light, so 0.80 is still sRGB 232 and only genuinely near-white pixels
    // reach it. Worth the 0.08 because the bleed is also what lifts the deepest
    // shadows without flattening anything (measured p05 luminance 0.218 -> 0.241),
    // and every reference plate has visible bloom while ours had none.
    //
    // THE COST CASE AGAINST IT, and what re-measuring actually found. The perf pass
    // put bloom at 16 draws and 1.6 Mpx of fill per frame for mean 0.1132/255 over
    // 0.64% of pixels at the brightest matchup, and called it "the SSAO of this
    // chain". SSAO was EXACTLY 0.0000/255 over 0.00% of pixels, at every framing in
    // the project. Bloom is not that, and that difference is the whole argument:
    // 0.1132 is small, but it is a real thing happening in the places the art
    // direction cares about most.
    //
    // The obvious cheapening was tried and REJECTED on measurement. Dropping the
    // mipmap chain from 8 levels to 5 saves 6 draws and ~0.4 Mpx — and moves the
    // image by mean 0.0729/255 (max 176) on the arena plate and 0.2900/255 on the
    // character plate. Those are the same order as bloom's ENTIRE contribution, i.e.
    // three quarters of the cheapening's saving comes out of the effect's actual
    // output, because the wide top levels are what a soft halo IS. Six draws of 692
    // is 0.9% of a frame; this project's rule is that a perf win which changes the
    // look is not a win, and 0.9% does not buy an exception.
    //
    // So bloom ships unchanged on `high` and `medium`, and on `low` it goes ENTIRELY:
    // 16 draws and 30% of the post chain's fill is the wrong thing for a phone to
    // spend on 0.64% of pixels, and this is a decision about which device pays,
    // not a re-tune of a look that was arrived at deliberately. The grade — 99.99%
    // of pixels for zero extra draws — is untouched on all three.
    const bloom = gradeOnly || !tier.bloom ? null : new BloomEffect({
      intensity: 0.30,
      luminanceThreshold: 0.80,
      luminanceSmoothing: 0.20,
      mipmapBlur: true,
      radius: 0.58,
    });

    // NO filmic tonemapping. AgX/ACES are built to tame photorealistic HDR and both
    // desaturate hard — exactly the wrong move for a hyper-saturated toy-plastic look.
    // Reference frames are vivid and high-key, so we grade toward that instead.
    //
    // `ToyGradeEffect` (top of this file) replaces the old
    // `HueSaturationEffect(0.32)` + `BrightnessContrastEffect(0.18)` pair, which
    // between them were destroying a channel on 9.4% of the frame and pinning
    // another 10.6% at white. The numbers there are higher than the ones they
    // replace and the picture is nonetheless LESS clipped, because these units are
    // gamut-relative: the curve spends the headroom a pixel actually has instead of
    // applying a fixed gain and letting the framebuffer amputate the overflow.
    const grade = new ToyGradeEffect({ saturation: 0.70, contrast: 0.62, knee: 0.55, highlightKnee: 0.82 });
    this.grade = grade;

    // Barely-there vignette; the reference has essentially none.
    const vignette = new VignetteEffect({
      offset: 0.42,
      darkness: 0.20,
      blendFunction: BlendFunction.NORMAL,
    });

    const effects: Effect[] = [];
    if (ssao) effects.push(ssao);
    if (bloom) effects.push(bloom);
    effects.push(grade, vignette);
    composer.addPass(new EffectPass(this.rig.camera, ...effects));

    // SMAA where it earns its fill; 4x MSAA (set on the composer above) everywhere
    // else. Not "no antialiasing" — a hyper-saturated toy palette against a dark
    // floor is exactly the content that shows stair-stepping worst. MSAA is the right
    // substitute rather than a cheaper post AA: it resolves on-chip on every
    // tile-based mobile GPU, so it costs no pass, no program and no texture, which is
    // exactly the three things SMAA costs.
    if (smaa) {
      composer.addPass(new EffectPass(this.rig.camera, new SMAAEffect()));
    }
    this.composer = composer;
  }

  /**
   * Size the drawing buffer, and — in a match — enforce the supported aspect band.
   *
   * The fair-play framing in `camera.ts` guarantees every device the same visible
   * radius, and lets screens wider than the square's own ground aspect keep the
   * surplus as cosmetic bleed. That bargain only holds while the bleed is bounded, so
   * outside `SUPPORTED_ASPECT` the render is masked instead: a 32:9 desktop is
   * pillarboxed to 21:9 and a portrait window is letterboxed to 4:3, rather than
   * being handed (or denied) a third of the arena.
   *
   * Masking is deliberately limited to `frameMode: 'fair'`, i.e. to actual matches.
   * The preview harness shoots portrait character plates (900x1100, 1200x1500) whose
   * framing every character loop is calibrated against; banding those would silently
   * re-crop every review shot in the project.
   */
  resize(): void {
    const cw = this.container.clientWidth || window.innerWidth;
    const ch = this.container.clientHeight || window.innerHeight;
    let w = cw;
    let h = ch;

    if (this.rig.frameMode === 'fair') {
      const aspect = cw / Math.max(1, ch);
      if (aspect > SUPPORTED_ASPECT.max) w = Math.round(ch * SUPPORTED_ASPECT.max);
      else if (aspect < SUPPORTED_ASPECT.min) h = Math.round(cw / SUPPORTED_ASPECT.min);
      // index.html styles the canvas `width:100%; height:100%`, which would stretch a
      // masked buffer back over the whole container; inline px wins over that rule.
      // Both the HUD (match.ts `projectToScreen`) and pointer input read the canvas's
      // own bounding rect, so an offset canvas stays correctly aligned.
      const style = this.canvas.style;
      style.position = 'absolute';
      style.left = `${Math.round((cw - w) / 2)}px`;
      style.top = `${Math.round((ch - h) / 2)}px`;
      style.width = `${w}px`;
      style.height = `${h}px`;
    }

    this.renderer.setSize(w, h, false);
    this.composer?.setSize(w, h);
    this.rig.setAspect(w / Math.max(1, h));
  }

  render(dtSeconds: number): void {
    if (this.disposed) return;
    this.rig.update(dtSeconds);
    if (this.shadowsOn) this.scheduleShadowUpdate();
    if (this.composer) this.composer.render(dtSeconds);
    else this.renderer.render(this.scene, this.rig.camera);
  }

  /** Force the shadow map to re-render on the next frame. For a caller that changes
   *  something the fingerprint below cannot see — a geometry rewritten in place, a
   *  material's alpha test, a light re-coloured. */
  markShadowsDirty(): void {
    this.renderer.shadowMap.needsUpdate = true;
    this.shadowSig = -1;
  }

  /**
   * Decide whether the shadow map has to be re-rendered this frame.
   *
   * ── Why a fingerprint and not a timer ────────────────────────────────────────
   * Every cheaper policy is wrong in a way that shows. A fixed cadence ("every other
   * frame") makes the shadow trail the character by a frame, which is exactly the
   * artefact a shadow exists to prevent. A "player moved" test misses the enemy, the
   * idle bob, and every VFX caster. So this hashes the things the shadow map is a
   * pure function of — the shadow frustum, and the world matrix and visibility of
   * every caster — and re-renders when that changes. No lag, ever.
   *
   * Matrices are brought up to date FIRST, deliberately. The decision has to be made
   * before `renderer.render()` runs the shadow pass, and reading last frame's
   * matrices would reintroduce the one-frame lag the fingerprint exists to avoid.
   * `updateMatrixWorld` is idempotent, so the renderer's own call a moment later
   * finds nothing dirty.
   *
   * WHAT THIS DOES NOT CATCH, stated so nobody has to rediscover it: a caster whose
   * GEOMETRY is rewritten in place without its matrix moving. Nothing in the game
   * does that today — `fogRing` and the VFX meshes that rewrite `position` buffers
   * all have `castShadow = false` — and `markShadowsDirty()` is the escape hatch if
   * that ever changes.
   */
  private scheduleShadowUpdate(): void {
    this.scene.updateMatrixWorld();

    const cam = this.lighting.key.shadow.camera;
    const key = this.lighting.key;
    let h = 2166136261;
    const mix = (v: number): void => { h = Math.imul(h ^ (v | 0), 16777619); };
    // 1 mm quantisation: finer than a shadow texel by a factor of 30, so this cannot
    // hide a movement that would change a single texel of the map.
    const mixF = (v: number): void => mix(Math.round(v * 1000));

    mixF(cam.left); mixF(cam.right); mixF(cam.top); mixF(cam.bottom);
    mixF(cam.near); mixF(cam.far);
    mixF(key.position.x); mixF(key.position.y); mixF(key.position.z);
    mixF(key.target.position.x); mixF(key.target.position.y); mixF(key.target.position.z);

    const minRadius = this.shadowCasterMinTexels > 0
      ? this.shadowCasterMinTexels * ((cam.right - cam.left) / Math.max(1, key.shadow.mapSize.x))
      : 0;

    // `traverseVisible` and not `traverse`: three's shadow pass stops descending at
    // an invisible node, so an object under a hidden parent contributes nothing and
    // must not contribute to the fingerprint either.
    this.scene.traverseVisible((o) => {
      const m = o as THREE.Mesh;
      if (!m.isMesh || !m.castShadow) return;
      if (minRadius > 0 && this.auditShadowCaster(m, minRadius)) return;
      const e = m.matrixWorld.elements;
      mix(m.id);
      mixF(e[12]); mixF(e[13]); mixF(e[14]);
      mixF(e[0]); mixF(e[2]); mixF(e[5]); mixF(e[8]); mixF(e[10]);
    });

    if (h !== this.shadowSig) {
      this.shadowSig = h;
      this.renderer.shadowMap.needsUpdate = true;
    }
  }

  /**
   * Demote a caster whose shadow cannot resolve on this shadow map. Returns true if
   * it was demoted.
   *
   * The threshold is expressed in SHADOW TEXELS, not metres, so it scales with the
   * map: 2.5 texels is 8.3 cm of world radius in a match (68 m across 2048). An
   * object below it covers under five texels across — and `lighting.ts` runs
   * `shadow.radius = 0.4` PCF soft filtering on top, which smears a five-texel blob
   * into nothing.
   *
   * Measured on a live match: 109 of the 636 casters fall under 8 cm — sesame seeds,
   * chopped-veg cubes, mitt studs — and demoting them takes the frame from 692 to
   * 625 draws, 9.7%, every frame.
   *
   * MATCH FRAMING ONLY, and that restriction is the result of a measurement, not
   * caution. Run on `preview.html?piece=character` — a plate that never calls
   * `focus()`, so it keeps the rig's whole default box — the same 2.5 texels became
   * an 11 cm threshold and started eating the lettuce and the patty, and the
   * character lost its self-shadowing (0.98/255 over 5.1% of the plate, and
   * obviously wrong to look at). A review plate is exactly where someone is hunting
   * for small detail, so it pays for all of it.
   *
   * Audited once per mesh and cached: the traversal above only reaches meshes that
   * still cast, so a demoted one is never re-examined.
   */
  private auditShadowCaster(m: THREE.Mesh, minRadius: number): boolean {
    if (m.userData.__shadowLod) return false;
    m.userData.__shadowLod = 1;
    const geo = m.geometry;
    if (!geo) return false;
    if (!geo.boundingSphere) geo.computeBoundingSphere();
    const r = geo.boundingSphere?.radius;
    if (!r) return false;
    const e = m.matrixWorld.elements;
    const scale = Math.max(
      Math.hypot(e[0], e[1], e[2]),
      Math.hypot(e[4], e[5], e[6]),
      Math.hypot(e[8], e[9], e[10]),
    );
    if (r * scale >= minRadius) return false;
    m.castShadow = false;
    return true;
  }

  /**
   * Tear the Stage down completely — and, crucially, RELEASE THE GL CONTEXT.
   *
   * ── The bug this fixes was a white screen, not a frame rate ──────────────────
   * `dispose()` used to be `composer.dispose(); renderer.dispose();`. Neither of
   * those releases a WebGL context: three's `dispose()` removes its event listeners
   * and empties its own caches, and that is all. Measured over
   * home -> match -> home -> match -> home (`tools/perf.mjs --mode leak`):
   *
   *   6 contexts created, 6 LIVE, 0 lost, +1 orphan DOM canvas per round trip,
   *   heap +5.4 MB per cycle
   *
   * Chrome caps a process at ~16 live contexts and mobile Safari lower, and when the
   * cap is hit the browser kills the OLDEST context — so the symptom is not "the
   * ninth match fails", it is "the menu portrait you left behind goes black, and
   * later the match does". Roughly eight menu/match round trips of ordinary play.
   *
   * The four things that were missing, in the order they have to happen:
   *   1. dispose the scene's own GPU resources while the context is still alive;
   *   2. dispose the PMREM environment map, which is a render target and is NOT
   *      reachable from the scene graph once `scene.environment` is cleared;
   *   3. `renderer.forceContextLoss()` — the ONLY thing that actually hands the
   *      context back, via `WEBGL_lose_context`;
   *   4. remove the canvas from the DOM, or the orphan keeps its backing store.
   */
  dispose(): void {
    if (this.disposed) return;
    this.disposed = true;

    // Before anything else: a listener holding `this` is a Stage that cannot be
    // collected, and one that would try to rebuild a post chain on a dead context.
    this.unsubscribeQuality?.();
    this.unsubscribeQuality = null;

    this.composer?.dispose();
    this.composer = null;
    this.grade = null;

    // three disposes NOTHING for you on teardown — not a geometry, not a material,
    // not a texture. Walk it once, de-duplicated, because materials and their maps
    // are shared across hundreds of meshes here (the arena's palette, `toon.ts`'s
    // one outline material per group).
    const geometries = new Set<THREE.BufferGeometry>();
    const materials = new Set<THREE.Material>();
    this.scene.traverse((o) => {
      const m = o as THREE.Mesh;
      if (!m.isMesh && !(o as THREE.Points).isPoints && !(o as THREE.Line).isLine) return;
      if (m.geometry) geometries.add(m.geometry);
      const mat = m.material;
      if (Array.isArray(mat)) for (const x of mat) materials.add(x);
      else if (mat) materials.add(mat);
    });
    for (const g of geometries) g.dispose();
    for (const mat of materials) {
      for (const v of Object.values(mat as unknown as Record<string, unknown>)) {
        if (v && (v as THREE.Texture).isTexture) (v as THREE.Texture).dispose();
      }
      mat.dispose();
    }
    this.scene.clear();

    // Reachable from nothing else once the scene is cleared: `PMREMGenerator` hands
    // back a render-target texture, and 16 MB of shadow map lives on the light.
    this.scene.environment = null;
    this.scene.background = null;
    this.envMap?.dispose();
    this.envMap = null;
    this.lighting.key.shadow.dispose();

    this.renderer.dispose();
    // The line that fixes the leak. Must come after `dispose()`, which detaches the
    // context-lost handler that would otherwise log and set `_isContextLost`.
    this.renderer.forceContextLoss();
    this.canvas.remove();

    const i = STAGES.indexOf(this);
    if (i >= 0) STAGES.splice(i, 1);
  }
}
