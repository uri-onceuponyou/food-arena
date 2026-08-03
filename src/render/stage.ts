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
  postFx?: boolean;
  shadows?: boolean;
  /** Image-based lighting. On by default — it is what gives surfaces their sheen. */
  environment?: boolean;
  environmentIntensity?: number;
  /**
   * Screen-space ambient occlusion. **OFF by default — see `buildPost`.** It was
   * measured to contribute EXACTLY ZERO at every framing this project renders, so
   * leaving it on bought nothing and cost a NormalPass plus a 16-tap AO pass.
   */
  ao?: boolean;
  /** Cap the device pixel ratio. Screenshots use 2 for crisp critic review. */
  maxPixelRatio?: number;
}

export class Stage {
  readonly renderer: THREE.WebGLRenderer;
  readonly scene: THREE.Scene;
  readonly rig: CameraRig;
  readonly lighting: LightingRig;
  readonly canvas: HTMLCanvasElement;
  private composer: EffectComposer | null = null;
  private container: HTMLElement;
  private disposed = false;
  private envMap: THREE.Texture | null = null;
  private useAO = false;
  /** The colour grade, exposed so a probe can sweep it without a rebuild. */
  grade: ToyGradeEffect | null = null;

  constructor(opts: StageOptions = {}) {
    this.useAO = opts.ao === true;
    this.container = opts.container ?? document.body;
    this.canvas = opts.canvas ?? document.createElement('canvas');
    if (!this.canvas.parentElement) this.container.appendChild(this.canvas);

    this.renderer = new THREE.WebGLRenderer({
      canvas: this.canvas,
      antialias: true,
      alpha: false,
      powerPreference: 'high-performance',
      // Required so Playwright's toDataURL/screenshot sees the drawn frame.
      preserveDrawingBuffer: true,
    });
    this.renderer.setPixelRatio(Math.min(window.devicePixelRatio, opts.maxPixelRatio ?? 2));
    this.renderer.outputColorSpace = THREE.SRGBColorSpace;
    this.renderer.toneMapping = THREE.NoToneMapping; // handled in post
    if (opts.shadows !== false) {
      this.renderer.shadowMap.enabled = true;
      this.renderer.shadowMap.type = THREE.PCFSoftShadowMap;
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
    this.lighting = createLighting(
      this.rig.frameMode === 'fair' ? { minFocusRadius: MATCH_SHADOW_RADIUS_M } : undefined,
    );
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
      pmrem.compileEquirectangularShader();
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

    if (opts.postFx !== false) this.buildPost();
    this.resize();

    // QA-only handle, same spirit as match.ts's `__vfxDebug*`. Never read by game
    // code — it exists so a Playwright probe can measure the post chain and toggle
    // scene layers (e.g. the arena's baked shadow decals) without a rebuild.
    if (typeof window !== 'undefined') {
      (window as unknown as { __stage?: Stage }).__stage = this;
    }
  }

  private buildPost(): void {
    const composer = new EffectComposer(this.renderer, {
      frameBufferType: THREE.HalfFloatType,
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

    // Bloom only on genuinely hot highlights. The threshold is high on purpose:
    // at 0.72 it was haloing plain white geometry (sesame seeds glowed like LEDs).
    // Reopened slightly, 0.88 -> 0.80, once the grade's highlight shoulder stopped
    // large pale surfaces from sitting at the top of the range: the threshold is in
    // LINEAR light, so 0.80 is still sRGB 232 and only genuinely near-white pixels
    // reach it. Worth the 0.08 because the bleed is also what lifts the deepest
    // shadows without flattening anything (measured p05 luminance 0.218 -> 0.241),
    // and every reference plate has visible bloom while ours had none.
    const bloom = new BloomEffect({
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

    const effects = ssao
      ? [ssao, bloom, grade, vignette]
      : [bloom, grade, vignette];
    composer.addPass(new EffectPass(this.rig.camera, ...effects));
    composer.addPass(new EffectPass(this.rig.camera, new SMAAEffect()));
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
    if (this.composer) this.composer.render(dtSeconds);
    else this.renderer.render(this.scene, this.rig.camera);
  }

  dispose(): void {
    this.disposed = true;
    this.composer?.dispose();
    this.renderer.dispose();
  }
}
