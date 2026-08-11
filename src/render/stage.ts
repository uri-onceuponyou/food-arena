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
import { CHARACTER_RADIUS } from '../units';

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
uniform float shadowToe;
uniform float toeKnee;
uniform float toeChromaKeep;

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

  // ── Shadow toe — the shoulder's mirror, and the reason it exists ──
  // Measured against 27 reference plates: our P95 is 0.896 and the reference's P95 is
  // 0.896 — the light end is ALREADY RIGHT. The whole deficit is at the bottom (P05
  // 0.304 against 0.097; every one of 18 Brawl Stars plates puts 5% of the character
  // below 0.18 and not one of ours did). So range has to be bought at the dark end.
  //
  // ⚠️ Opening the shoulder to buy range at the TOP was measured and rejected —
  // but NOT for the reason that was recorded here for four months. The correction,
  // three measurements and a reference-plate control, is on ToyGradeEffect below,
  // out of the shader source so it is not compiled on every program build.
  //
  // Driven by LUMA, not by the max channel, because luma is the quantity the ladder
  // metric measures; a saturated dark red sits at luma 0.20 with a max channel of 0.47,
  // and a max-channel toe would walk straight past it. smoothstep reaches the knee with
  // ZERO derivative, so the join is C1 and there is no banding edge where the toe stops.
  //
  // ── AND IT SUBTRACTS BEFORE IT SCALES, WHICH IS THE WHOLE DESIGN ──
  // The obvious implementation is a uniform SCALE, and the first one here was. A scale
  // leaves hue and HSV saturation exactly alone, so it looks like a pure VALUE lever —
  // but tools/arena-scan.mjs, the gate that exists on this project precisely to catch
  // cumulative colour loss, does not measure HSV saturation. It measures ABSOLUTE
  // chroma (max-min)/255, which is LINEAR in the scale, and HSL saturation, which is
  // scale-invariant below L=0.5 and strictly falls above it. Measured: the scale form
  // cost -0.0238 of mean chroma against a rail whose tolerance is 0.020, and it took a
  // saturation raise to 0.86 to buy that back, which then overshot the COOL chroma rail
  // by 0.042. One correct change, two gates, and no setting satisfied both.
  //
  // Removing the same luma as a SUBTRACTION instead leaves (max-min) untouched, so
  // absolute chroma is preserved exactly and HSL saturation RISES slightly. The catch
  // is the gamut: subtracting from a channel that is already near zero clips it, which
  // is the exact failure this grade was written to fix. So the subtraction is limited
  // to 85% of the DARKEST channel, and whatever luma that leaves unremoved is taken by
  // a scale, which cannot produce a negative. Bright, low-chroma pixels (most of this
  // floor) therefore get the pure chroma-preserving form; deep saturated pixels, which
  // have no headroom to subtract from, fall back to the old behaviour on the remainder.
  //
  // ── AND WHY toeChromaKeep IS 0.55 AND NOT 1 ──
  // The two forms fail OPPOSITE colour rails, and this is arithmetic, not taste:
  // chroma = saturation x f(luma), so lowering luma must lower chroma OR raise
  // saturation. There is no third option and arena-scan has a drift rail against each.
  // Swept with tools/tmp/gradechroma.mjs, six stations, one page load each, the gate's
  // own colourBudget, HEAD as an explicit control row:
  //
  //   keep    d meanChroma   d coolChroma   d meanSat        (tolerance is 0.020 each)
  //   0.00       -0.0238        -0.0000       -0.0002        chroma rail FAILS
  //   0.25       -0.0196        +0.0068       +0.0058
  //   0.40       -0.0169        +0.0110       +0.0095
  //   0.55       -0.0142        +0.0151       +0.0133        <- shipped, ~0.004 margin both
  //   0.70       -0.0113        +0.0192       +0.0173
  //   1.00       -0.0054        +0.0275       +0.0254        cool rail FAILS
  //
  // toeChromaKeep does not change the luma removed — that is fixed by shadowToe and
  // toeKnee — so the value ladder is the same at every row above. It only chooses
  // which of the two colour rails absorbs it.
  //
  // NOTE FOR ANYONE EDITING THIS COMMENT: this whole shader lives inside a JS template
  // literal, so a single backtick here terminates the string and 500s the dev server
  // for every agent in the repo (docs/LESSONS.md section 9 — it has bitten five times,
  // and this comment is the fifth). No backticks below this line.
  {
    float ly = dot(c, vec3(0.2126, 0.7152, 0.0722));
    float t = clamp(ly / max(toeKnee, 1e-4), 0.0, 1.0);
    // Fraction of this pixel's luma the toe wants to remove. 0 at and above the knee.
    float k = 1.0 - mix(1.0 - shadowToe, 1.0, t * t * (3.0 - 2.0 * t));
    float want = k * ly;
    float mn = min(c.r, min(c.g, c.b));
    float off = toeChromaKeep * min(want, 0.85 * mn);   // chroma-preserving part
    c -= off;
    float rest = max(want - off, 0.0);     // whatever the gamut would not allow
    c *= max(1.0 - rest / max(ly - off, 1e-4), 0.0);
  }

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

// ─────────────────────────────────────────────────────────────────────────────
// `highlightKnee` — the shoulder, RE-PRICED. Read this before touching the 0.82.
//
// Three independent probes put the project's #1 defect at "the game draws no
// highlights": the Fresnel rim reaches 1.402% of pixels, prop faces carry one flat
// value each, and share of playfield above luma 0.80 is ours 0.67-1.68% against a
// reference 2.39-19.06%, non-overlapping. The shoulder is the obvious first suspect,
// it is one number, and it is the wrong place to spend the pass — for a reason that
// is NOT the one this file recorded.
// ─────────────────────────────────────────────────────────────────────────────
// ⚠️ THE OLD WORDING, KEPT BECAUSE THE CONCLUSION SURVIVES AND THE REASON DOES NOT:
//   *"…and opening the shoulder to buy it at the top was measured and REJECTED: knee
//   0.82 -> 0.92 recovers +0.019 of range and takes whole-frame clipped-high from
//   0.06% of pixels to 2.50%, a 40x regression on the exact number this grade was
//   written to fix (the raw render clips 2.33%; the shoulder is what holds it at 0.06)."*
//
// ── THE "40x REGRESSION" IS AN ARTEFACT OF THE METRIC, MEASURED THREE WAYS ──
// tools/tmp/kneeprice.mjs (selftest 21/21), paired on ONE frozen frame via
// stage.render(0) inside a single synchronous evaluate, so the content cannot drift:
// the shipped-vs-shipped-again drift control is EXACTLY 0.0000 on every quantity.
//
//   1. THE NUMBER IS "ANY CHANNEL AT EXACTLY 255" (postablate.mjs:267-273), and this
//      shoulder is ASYMPTOTIC to 1.0 — softKnee returns k + head*(1-exp(...)), which
//      reaches 1.0 only at infinity. At knee 0.82 a pre-shoulder max channel of 1.63 is
//      needed to round to 255. **The metric is very nearly a detector for "is a soft
//      shoulder present", not a measure of lost highlight.** At the >=250 threshold —
//      the one that survives a resample and the one a viewer could see — the whole
//      canvas moves 3.98% -> 5.12% between the shipped knee and FULL ABLATION. 1.29x,
//      not 40x.
//   2. THE PIXELS IT COUNTS ARE ONE FLAT ORANGE SURFACE MOVING ONE CODE. Of the
//      52,306 newly channel-clipped pixels at knee 0.92, 45,856 (88%) were
//      rgb(254,128,34) in the shipped frame — the pot hazard's soup fill, going
//      254 -> 255 on RED ONLY. Rendered as a false-colour overlay and LOOKED AT
//      (shots/knee/newclip.png): the pot disc, a few hazard-stripe specks, and one
//      highlight on the bun. Luma-clipping (share above 0.94) over the whole canvas
//      moves 0.0049% -> 0.0076%. Nothing goes white; a saturated orange pins one channel.
//   3. THE REFERENCE CLIPS CHANNELS FAR HARDER THAN WE DO — the control neither side
//      of this argument had taken. Same code, same crop, native resolution, no resize,
//      6 gameplay_topdown plates vs 8 of our action frames:
//
//        playfield crop   ch>=255            ch>=250            all-255
//        reference        1.70 - 18.93%      2.70 - 26.65%      0.027 - 1.46%
//        ours             0.044 -  0.51%     0.38 -  3.00%      0.000%
//
//      2.50% is INSIDE the reference band, near its bottom. And the bias runs our way:
//      the plates are JPEG phone screenshots upscaled 1.33-1.43x, and resampling only
//      DESTROYS hard 255s — so their true channel clipping is if anything higher.
//      ⚠️ We do not produce a single all-channel-white pixel in the playfield. Every
//      plate does.
//
// ── SO WHY THE KNOB STILL DID NOT LAND: IT BUYS ALMOST NOTHING ──
// The rejection was right and its stated reason was not. Paired, frozen, playfield crop
// (0.05,0.16,0.95,0.86), drift control exactly 0.0000:
//
//   knee     p95      hi80      hi70    ch>=255(whole canvas)
//   0.82    0.5850   1.3948%   1.9438%   0.0626%   <- shipped
//   0.88    0.5964   1.4429%   1.9548%   3.5985%
//   0.92    0.6056   1.4593%   1.9576%   3.6949%
//   1.00    0.6208   1.4761%   1.9651%   4.7160%   <- fully ablated
//
// The reference playfield MINIMUM is p95 0.7320 and hi80 2.43%. Opening the shoulder
// ALL THE WAY buys 24% of the p95 gap and 8% of the hi80 gap to that minimum — about
// 3% of the gap to the reference MEDIAN. There are no highlights up there to recover:
// the whole cliff between 0.86 and 0.88 is one orange disc changing by one code.
// ⚠️ This also corrects a p6 probe figure: that probe measured the ablation as
// +0.72pp of hi80 on a LIVE sim, and on a genuinely frozen frame it is +0.081pp —
// 9x smaller. Its own report flags the contamination; this is what it cost.
//
// → RE-PRICE THIS AFTER THE ALBEDO PASS, NOT BEFORE. The knob is cheap, reversible
//   (one number, live at window.__stage.grade.highlightKnee) and now lands inside
//   the reference band rather than outside it — but it can only redistribute highlights
//   that exist, and today the arena draws none. Spending it now also makes the albedo
//   pass's own measurements harder to read.
//
export class ToyGradeEffect extends Effect {
  constructor({
    saturation = 0.70, contrast = 0.62, knee = 0.55, highlightKnee = 0.82,
    shadowToe = 0, toeKnee = 0.50, toeChromaKeep = 1,
  } = {}) {
    super('ToyGradeEffect', TOY_GRADE_SHADER, {
      blendFunction: BlendFunction.SRC,
      uniforms: new Map<string, THREE.Uniform>([
        ['satAmount', new THREE.Uniform(saturation)],
        ['satKnee', new THREE.Uniform(knee)],
        ['contrastAmount', new THREE.Uniform(contrast)],
        ['highlightKnee', new THREE.Uniform(highlightKnee)],
        ['shadowToe', new THREE.Uniform(shadowToe)],
        ['toeKnee', new THREE.Uniform(toeKnee)],
        ['toeChromaKeep', new THREE.Uniform(toeChromaKeep)],
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
  /** Depth of the shadow toe, 0..1. 0 is exactly the identity. */
  get shadowToe(): number { return this.uniforms.get('shadowToe')!.value as number; }
  set shadowToe(v: number) { this.uniforms.get('shadowToe')!.value = v; }
  /** Luma at and above which the toe is exactly the identity. */
  get toeKnee(): number { return this.uniforms.get('toeKnee')!.value as number; }
  set toeKnee(v: number) { this.uniforms.get('toeKnee')!.value = v; }
  /** 0 = remove luma by SCALE, 1 = remove it by SUBTRACTION as far as the gamut allows. */
  get toeChromaKeep(): number { return this.uniforms.get('toeChromaKeep')!.value as number; }
  set toeChromaKeep(v: number) { this.uniforms.get('toeChromaKeep')!.value = v; }
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

  // ── SMALLER AND BRIGHTER, AT CONSTANT IRRADIANCE ─────────────────────────
  //
  // Six independent critics named "surfaces are flat and unlit — no material
  // variation" as the top defect on four of five elements, and the diagnosis is NOT
  // the one the words suggest. `tools/tmp/matvar.mjs --mode census` on a live match:
  // 112 standard materials carrying **33 distinct roughness values** from 0.16 to
  // 0.98, 36 distinct (roughness, metalness, envMapIntensity) triples. The variation
  // is authored. It is not arriving.
  //
  // `--mode chart` drops spheres into the live match at the shipped camera, the
  // shipped lights and the shipped post chain, sized to a fighter's measured 147 px,
  // and reads each one's specular headroom (P99 - P50 of its own pixels):
  //
  //   roughness   0.08    0.25    0.52    0.75    0.95
  //   specHead    0.328   0.400   0.166   0.055   0.034
  //
  // A TEN-FOLD COLLAPSE between 0.25 and 0.75, and **53% of the cast's surfaces are
  // authored at 0.6 or above** — i.e. more than half the game's materials live in the
  // range where the parameter that is supposed to distinguish them does nothing. That
  // is "no material variation" precisely: not absent authoring, an absent response.
  // Rendered and LOOKED AT (`shots/matvar/chart.png`): 0.75 and 0.95 are the same
  // matte ball, and it is the "coloured paper" a critic named.
  //
  // ⚠️ AND THE OBVIOUS PER-MATERIAL FIX DOES NOT EXIST. `material.envMapIntensity` is
  // the documented knob for exactly this. Driving it x0 / x2 / x4 across all 112
  // materials produces a **BYTE-IDENTICAL frame** — dMean 0.0000, dMax 0, 0.00% of
  // pixels — while `scene.environmentIntensity` at x0 moves the frame by 30.7/255.
  // Root cause, `three/build/three.module.js:17340`:
  //
  //     if ( material.isMeshStandardMaterial && material.envMap === null
  //          && scene.environment !== null ) {
  //       m_uniforms.envMapIntensity.value = scene.environmentIntensity;
  //     }
  //
  // Every material here relies on `scene.environment` and none sets its own `envMap`,
  // so three OVERWRITES the per-material value with the scene's on every draw. The
  // property assigns without error, reads back correctly, and is discarded. That is
  // `docs/LESSONS.md` §1 in its nastiest costume — not missing, silently ignored.
  //
  // ⚠️ AND THE PANELS ARE NOT THE LEVER EITHER — TRIED, MEASURED, REVERTED.
  // The obvious next move is that these panels are the specular source, so making
  // them smaller and brighter should sharpen every highlight in the game at constant
  // fill. It is even principled: a highlight's brightness is the source's RADIANCE
  // while a surface's fill is its IRRADIANCE (radiance x solid angle), so holding the
  // product fixed and raising the first should buy sheen for free. Driven at
  // **peak x3, area /3** (7x7 @ 3.2 -> 4.04x4.04 @ 9.6, and 6x4 @ 1.15 ->
  // 3.46x2.31 @ 3.45), same chart, same fifteen spheres, same screen positions:
  //
  //   roughness    0.08     0.25     0.52     0.75     0.95
  //   specHead   0.328 -> 0.321   0.400 -> 0.395   0.166 -> 0.159   0.055 -> 0.053   0.034 -> 0.034
  //
  // Nothing, at every roughness, in both directions. The reason is arithmetic: these
  // materials are dielectrics at metalness 0, so F0 is fixed at 0.04, and the IBL
  // specular arrives as 0.04 x radiance x `environmentIntensity` 0.32 = 1.3% of the
  // panel. The highlight a viewer actually sees on a sphere here is the DIRECT
  // lights' GGX lobe (key 3.5 + front 2.2), not the environment's reflection. So the
  // panels are worth their place in the diffuse balance and are worth nothing as a
  // sheen control, and the honest record of that is this paragraph rather than a
  // shipped change that moves no number. Left exactly as they were.
  //
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
   * Screen-space ambient occlusion. **OFF by default, and the reason is now a PRICE
   * rather than a doubt** — see `buildPost`. It delivers the contact shadow six
   * critics asked for, its acne is fixed, and it costs a second full geometry pass:
   * +314 draw calls and +79% triangles per frame. Opt in knowingly.
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

/**
 * A rolling record of every GL context event this document has seen.
 *
 * ── Why a log and not just a flag ───────────────────────────────────────────────
 * A lost context is invisible in every artefact this project produces: `tsc` cannot
 * see it, no assertion fires, and a screenshot of it is a black rectangle that looks
 * like a hundred other black rectangles. `docs/LESSONS.md` §10 records that the two
 * most valuable bug reports on this project came from Uri simply playing it — so the
 * useful thing to build is not a guard, it is EVIDENCE. When he says "it went black",
 * `window.__glLog` answers whether the GPU dropped the context, how many times, on
 * which canvas, and whether it ever came back.
 *
 * Capped, because a driver that is resetting in a loop must not also be a memory leak.
 */
interface GlLogEntry {
  t: number;
  type: 'lost' | 'restored' | 'creationerror';
  /** Drawing-buffer size at the time, as a cheap identity for WHICH canvas. */
  size: string;
  offscreen: boolean;
  detail?: string;
}
const GL_LOG_MAX = 24;

declare global {
  interface Window {
    /** See `GlLogEntry`. QA/bug-report diagnostic; never read by game code. */
    __glLog?: GlLogEntry[];
  }
}

/**
 * Record a context event and broadcast it.
 *
 * The broadcast is a plain DOM `CustomEvent` on `window` rather than a callback the
 * Stage's owner has to wire up, for one reason: the layer that should TELL the player
 * (`ui/screens/shell.ts`) does not construct the Stage — `charStage.ts`, `thumbs.ts`
 * and `game/match.ts` do, and two of those are transient. An event decouples "the GPU
 * dropped us" from "somebody says so on screen" without `render/` learning that a UI
 * exists.
 *
 * `offscreen` rides in the detail so a listener can ignore a thumbnail generator's
 * context — that one is genuinely not worth interrupting the player for, and it is
 * also the one most likely to be sacrificed first when a browser starts reclaiming
 * contexts.
 */
function noteGlEvent(stage: Stage, type: GlLogEntry['type'], detail?: string): void {
  if (typeof window === 'undefined') return;
  const entry: GlLogEntry = {
    t: Date.now(),
    type,
    size: `${stage.canvas.width}x${stage.canvas.height}`,
    offscreen: stage.offscreen,
    ...(detail ? { detail } : {}),
  };
  const log = (window.__glLog ??= []);
  log.push(entry);
  if (log.length > GL_LOG_MAX) log.shift();
  try {
    window.dispatchEvent(new CustomEvent(`fa:webglcontext${type}`, {
      detail: { stage, offscreen: stage.offscreen, entry },
    }));
  } catch { /* an ancient engine without CustomEvent must still lose a context quietly */ }
}

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

/**
 * Height of the per-fighter contact decal above the floor plane, in metres.
 *
 * NOT a taste number. `docs/LESSONS.md` §1 lists eighteen separate occasions where
 * something rendered and was invisible, and three of them were ground decals buried
 * under the layer above them. The stack, measured: floor pads 0.045-0.048, tile seams
 * 0.062, the arena's baked prop shadows 0.068-0.07, prop kicks 0.08. 0.09 clears all
 * of it with 1 cm of margin, and at the match camera's 26.6 m that is far below the
 * depth buffer's resolution there, so it cannot z-fight.
 */
const CONTACT_Y = 0.09;

/**
 * Half-width of the decal in CHARACTER_RADIUS units — i.e. the normalised radius `t`
 * at which the darkening reaches zero, in exactly the units
 * `tools/tmp/cs_charcontact.mjs` measures in. Its NEAR band is t 1.10-2.20, and the
 * reference plates' props carry their darkening out to about t 2.3, so the falloff
 * has to still be alive at 2.2 and gone by 2.6.
 */
const CONTACT_SPREAD = 2.6;

/**
 * Peak multiply, as (1 - r, 1 - g, 1 - b) subtracted at the centre.
 *
 * COOL-LEANING ON PURPOSE, and it is derived rather than chosen: the light this
 * shadow occludes is the warm key (0xfff4de), so what is left in shade is the
 * hemisphere's SKY end (0xd8ecff) and the cool front fill. Removing more red than
 * blue is what an occluder physically does under this rig. `lighting.ts`'s hemisphere
 * exists for the same reason — "a hemisphere light only models form if its ends
 * differ in VALUE" — and a neutral grey here would have thrown that away at the one
 * place the eye looks for it.
 *
 * MEASURED, not predicted. `cs_charcontact.mjs --ours` isolates this decal from the
 * cast shadow by rendering a third frame with the contact group hidden, and reports
 * its own contribution as a fraction of the floor it lands on:
 *
 *   station        opposite flank        shade flank
 *   570:430            0.137                0.087
 *   1150:420           0.074                0.054
 *   340:500            0.144                0.052
 *
 * against the reference's opposite-flank 0.061 / 0.087 / 0.198 on bs_06's props. The
 * OPPOSITE flank is the one this exists for: it read exactly 0.000 at all three
 * stations before, because a cast shadow only darkens one side.
 */
const CONTACT_TINT: readonly [number, number, number] = [0.30, 0.27, 0.21];

/**
 * The decal's texture: white everywhere except a soft radial core.
 *
 * White is the identity of a MULTIPLY blend, so the quad's square corners have to be
 * exactly 255 — a texture that is merely "nearly white" at the edge draws a visible
 * square on the floor, which is the failure mode a whole round of arena work went
 * into removing from the baked prop decals.
 *
 * `NearestFilter` is deliberately NOT used: this is a smooth gradient blown up to
 * ~1.6 m on screen, and nearest sampling would band it.
 */
function contactTexture(size = 64): THREE.DataTexture {
  const data = new Uint8Array(size * size * 4);
  const c = (size - 1) / 2;
  for (let y = 0; y < size; y++) {
    for (let x = 0; x < size; x++) {
      const r = Math.min(1, Math.hypot((x - c) / c, (y - c) / c));
      // (1-r)^1.4: a soft shoulder at the centre and a long tail, so the darkening is
      // still ~46% of peak at t=1.10 (the inner edge of the measured band) and ~7% at
      // t=2.20 (its outer edge). A linear ramp put too much of the mass under the
      // character, where its own body hides it.
      const f = Math.pow(Math.max(0, 1 - r), 1.4);
      const i = (y * size + x) * 4;
      data[i] = Math.round(255 * (1 - CONTACT_TINT[0] * f));
      data[i + 1] = Math.round(255 * (1 - CONTACT_TINT[1] * f));
      data[i + 2] = Math.round(255 * (1 - CONTACT_TINT[2] * f));
      data[i + 3] = 255;
    }
  }
  const tex = new THREE.DataTexture(data, size, size, THREE.RGBAFormat);
  tex.colorSpace = THREE.SRGBColorSpace;
  tex.minFilter = THREE.LinearMipmapLinearFilter;
  tex.magFilter = THREE.LinearFilter;
  tex.generateMipmaps = true;
  tex.wrapS = THREE.ClampToEdgeWrapping;
  tex.wrapT = THREE.ClampToEdgeWrapping;
  tex.needsUpdate = true;
  return tex;
}

export class Stage {
  readonly renderer: THREE.WebGLRenderer;
  readonly scene: THREE.Scene;
  readonly rig: CameraRig;
  readonly lighting: LightingRig;
  readonly canvas: HTMLCanvasElement;
  /** True once `dispose()` has run. Read by QA probes to skip dead stages. */
  disposed = false;
  /**
   * True between `webglcontextlost` and `webglcontextrestored`.
   *
   * While it is set there is no GPU to draw with: `render()` is a no-op and the canvas
   * is transparent black. Public because the only useful reaction to it lives outside
   * `render/` — see `noteGlEvent`.
   */
  contextLost = false;
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
  /** IBL settings, remembered: the environment map has to be REBUILT after a context
   *  loss and the constructor's `opts` are long gone by then. See `buildEnvironment`. */
  private readonly envEnabled: boolean;
  private readonly envIntensity: number;
  /** Fingerprint of everything the shadow map depends on, from the last frame. */
  private shadowSig = -1;
  private shadowCasterMinTexels: number;
  /** The colour grade, exposed so a probe can sweep it without a rebuild. */
  grade: ToyGradeEffect | null = null;
  /** The per-fighter contact decals. Null until a match frame asks for one. */
  private contactGroup: THREE.Group | null = null;
  private readonly contactTargets: THREE.Object3D[] = [];
  // PER-STAGE, not static, and that is the whole reason it is written out: `dispose()`
  // walks the scene graph and disposes every geometry, material and texture it finds.
  // A shared static would be disposed by the FIRST Stage to tear down and every other
  // live Stage would keep drawing with a dead GPU resource — the same class of bug as
  // the PMREM env map that `onContextRestored` exists for. A 64x64 texture per Stage
  // is nothing; a cross-Stage dangling handle is a white screen.
  private contactGeometry: THREE.PlaneGeometry | null = null;
  private contactMaterial: THREE.MeshBasicMaterial | null = null;
  private readonly contactScratch = new THREE.Vector3();

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
    this.envEnabled = opts.environment !== false;
    this.envIntensity = opts.environmentIntensity ?? 0.32;
    if (!this.canvas.parentElement) this.container.appendChild(this.canvas);

    // BEFORE the renderer, deliberately: `webglcontextcreationerror` fires DURING
    // `getContext`, i.e. inside the constructor below, so a listener attached
    // afterwards can never see it. three logs the reason to the console and then
    // throws a bare "Error creating WebGL context"; this is what puts the driver's
    // own statusMessage somewhere a bug report can quote it. That case is real on the
    // devices this has not been tested on — Chrome kills the OLDEST context once a
    // process passes ~16 (see `dispose`), and the next Stage to be built is the one
    // that fails.
    this.canvas.addEventListener('webglcontextcreationerror', this.onContextCreationError, false);

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
    // before assuming that means "only when the player moves".
    //
    // ⚠️ THE PARAGRAPH THAT USED TO CLOSE THIS BLOCK WAS TRUE WHEN WRITTEN AND IS NOW
    // FALSE TWICE OVER. It read, verbatim:
    //
    //     "the honest accounting is that during play the two fighters move every frame
    //      and each is ~85 casters, so a match still pays most of this"
    //
    // Measured on the shipped bundle at the phone tier (`pf_census.mjs`, ec4f5af): on
    // the x4 map the shadow pass was **551 of 928 draws — 59.4% of the frame — and
    // 523 of them were the ARENA**. The two fighters were 28. The reasoning inverted
    // because the map grew 4x and the props with it, not because anything here changed.
    //
    // And the second reversal, which is why the paragraph is gone rather than
    // corrected: the fix was never in this file. `arena/kitchen.ts` now batches its
    // 1,908 static prop meshes into ~80 by material, so the SAME shadow, cast by the
    // SAME triangles, costs **84 draws instead of 523** — the shadow pass falls
    // 551 -> 112 with no change to the picture. A fingerprint that re-renders the map
    // when the fighters move is fine; re-rendering it 1,657 casters at a time was not.
    //
    // What this still removes is every frame where nothing moves — menus, the results
    // overlay, thumbnail and preview plates — and it is what makes the focus
    // quantisation in `lighting.ts` worth anything.
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
    this.buildEnvironment();

    if (opts.postFx !== false) this.buildPost(opts.postFx === 'grade');
    this.resize();

    // ── Context loss ─────────────────────────────────────────────────────────
    // three attaches its own handlers in the WebGLRenderer constructor above, so ours
    // run second — which is exactly what `onContextRestored` needs, since it may only
    // touch the GPU after three has re-initialised it.
    this.canvas.addEventListener('webglcontextlost', this.onContextLost, false);
    this.canvas.addEventListener('webglcontextrestored', this.onContextRestored, false);

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
   * Build (or REBUILD) the image-based lighting.
   *
   * Extracted from the constructor for one reason, and it is not tidiness: this is the
   * single piece of GPU state in the whole Stage that cannot survive a context loss.
   * `PMREMGenerator.fromScene` hands back a RENDER-TARGET texture — its pixels were
   * computed on the GPU and there is no `texture.image` anywhere on the CPU side. When
   * a context is restored, three throws away its entire `WebGLProperties` map and
   * re-uploads every texture from its `image`; a render-target texture has none, so
   * the binding silently falls back to an empty one and the whole scene loses its
   * diffuse irradiance and its specular sheen.
   *
   * MEASURED, `tools/tmp/glloss_probe.mjs`, live match at `simSpeed=0.02` so the frame
   * is frozen and the only variable is the loss:
   *
   *   frame mean before the loss ....... 76.291 / 255   (drift control over the same
   *   frame mean after restore ......... 60.641 / 255    span: 0.007, so this is 2200x
   *   -> the restored frame is 20.5% DARKER, permanently   the noise floor)
   *
   * Reproduced to a hundredth on a second loss/restore cycle (-15.650 then -15.657).
   * That is `docs/LESSONS.md` §1 in its nastiest form: not a black screen anyone would
   * report, just a quietly wrong image that never comes back.
   */
  private buildEnvironment(): void {
    if (!this.envEnabled) return;
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
    this.scene.environmentIntensity = this.envIntensity;
    envScene.traverse((o) => {
      const m = o as THREE.Mesh;
      if (m.isMesh) { m.geometry?.dispose(); (m.material as THREE.Material)?.dispose(); }
    });
    pmrem.dispose();
  }

  private readonly onContextCreationError = (e: Event): void => {
    const reason = (e as Event & { statusMessage?: string }).statusMessage ?? '';
    noteGlEvent(this, 'creationerror', reason || 'no statusMessage');
  };

  /**
   * The context is gone.
   *
   * `preventDefault()` is the whole ballgame: without it the browser will NEVER fire
   * `webglcontextrestored`, and the canvas is black for the lifetime of the document.
   * three's own handler already calls it — verified in `three.module.js:15852` and
   * measured true by `glloss_probe.mjs` before this handler existed — so this call is
   * belt and braces rather than the fix. It is kept anyway because three removes its
   * listener in `renderer.dispose()`, and because the requirement deserves to be
   * stated somewhere the next person will read.
   */
  private readonly onContextLost = (e: Event): void => {
    // `dispose()` ends with `forceContextLoss()`, which fires this event on purpose.
    // Recovering from a deliberate teardown would resurrect a Stage nobody wants.
    if (this.disposed) return;
    e.preventDefault();
    this.contextLost = true;
    noteGlEvent(this, 'lost');
  };

  /**
   * The context is back — but nothing that lived only on the GPU is.
   *
   * three has already run its own handler by the time this fires (it registered first,
   * in the `WebGLRenderer` constructor) so the GL context is re-initialised and every
   * geometry, material and CPU-backed texture will re-upload lazily. Three things will
   * NOT come back on their own, and all three were measured wrong before this existed:
   *
   *   1. THE ENVIRONMENT MAP — a render target with no CPU image. See
   *      `buildEnvironment`: worth 15.65/255 of frame mean, permanently.
   *   2. THE SHADOW MAP — `shadowMap.autoUpdate` is false here (see the constructor),
   *      and three faithfully preserves `needsUpdate: false` across the restore, so
   *      the shadow pass never runs again and every shadow samples an uninitialised
   *      depth target. `markShadowsDirty()` is the documented escape hatch for exactly
   *      "something changed that the fingerprint cannot see", and a new GL context is
   *      the largest such change there is. LOOKED AT, not inferred: in
   *      `shots/glloss/before/0{5,6}-menu-*.png` the character-select portrait's
   *      contact shadow on the pedestal is present before the loss and GONE after the
   *      restore. That framing is the worst case precisely because it is STATIC — the
   *      fingerprint in `scheduleShadowUpdate` never changes, so nothing ever asks for
   *      a redraw. A match hides it: the fighters move every frame, the fingerprint
   *      changes, and the map redraws by accident.
   *   3. THE PIXEL RATIO / SIZE — cheap to reassert, and free insurance against a
   *      restore that arrives with a different backing store.
   *
   * The post chain is deliberately NOT rebuilt. Its render targets are recreated by
   * three on first bind and its LUTs are CPU-backed, so a rebuild would cost two
   * program links (10-60 ms each on a mobile driver, at the exact moment the device is
   * already in trouble) and would swap `this.grade` for a new object under anything
   * holding a reference. Measured: with the two repairs above and no rebuild, the
   * restored frame matches the pre-loss frame to within the drift control.
   */
  private readonly onContextRestored = (): void => {
    if (this.disposed) return;
    this.contextLost = false;
    this.renderer.setPixelRatio(this.effectivePixelRatio());
    this.envMap?.dispose();
    this.envMap = null;
    this.buildEnvironment();
    this.markShadowsDirty();
    this.resize();
    noteGlEvent(this, 'restored');
  };

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
    // ── 2026-08-05: TURNED ON, AND THE REJECTION ABOVE HAD A SECOND DEFECT UNDER IT ─
    //
    // A canonical-rubric baseline re-score (43 rounds, 43 valid, instrument validated
    // in both directions) put ONE mechanism at the top of four of five elements:
    // "surfaces are flat and unlit — no material variation, NO CONTACT SHADOW, no
    // depth", named by 6/6 critics on the HUD band, 6/6 on home, 5/6 on character
    // select and 4/6 on the arena. The paragraph above rejected this pass on a single
    // critic saying the opposite ("one directionless blob"), so the evidence has
    // reversed and the decision has to be re-taken rather than inherited.
    //
    // ⚠️ AND THE REPAIRED PASS IS STILL NOT SHIPPABLE AS IT WAS CONFIGURED. Turning it
    // on measures beautifully and LOOKS BROKEN, which is exactly what non-negotiable #3
    // exists to catch. `tools/tmp/haloprobe.mjs`, hamburger + hotdog at pot_south,
    // AO ablated by BLEND OPACITY on one frozen frame (never by blend FUNCTION —
    // `docs/LESSONS.md` §12):
    //
    //   contact, 2-8 px outside the hero's own matte ...... -0.03798
    //   the same ground, 14-26 px out ..................... -0.01072
    //   gradient .......................................... -0.02726
    //   hero dLedge .......................... 0.0920 -> 0.1180   (+28%)
    //   value steps @0.10 .................... 6.50 -> 7.50
    //
    // ...and every tile grout line in the arena grew a heavy black speckled fringe
    // (`shots/halo/ao/floor_ab.png`, AO off above / on below, 4x nearest-neighbour).
    // Good numbers, worse frame.
    //
    // `tools/tmp/aotune.mjs` (selftest 11/11) separates the two with a metric per
    // defect, because a single "mean darkening" figure cannot tell them apart and
    // "mean darkening" is precisely what the earlier round rejected this pass on:
    //   CONTACT  the band difference above — smooth, localised at the base.
    //   ACNE     mean |Laplacian| of the AO difference map over open ground 40+ px
    //            from the hero, where a correct AO has nothing to draw at all. A
    //            constant field and a linear ramp both score EXACTLY zero (asserted),
    //            so contact cannot leak into this number; speckle scores high.
    //   HAZE     mean darkening over that same far region — the "broad low-frequency
    //            dimming of the whole floor" the earlier round named, kept as its own
    //            column so acne cannot be traded for haze unnoticed.
    //
    //   config                        contact      haze       acne   contact/acne
    //   as it was configured         -0.02739  -0.01134   0.009682          2.83
    //   bias 0.10                    -0.02151  -0.00244   0.002908          7.40
    //   bias 0.20                    -0.01882  -0.00041   0.000623         30.23
    //   bias 0.35                    -0.01497  -0.00018   0.000239         62.73
    //   bias 0.20 + material int 1.5 -0.02818  -0.00063   0.000881         32.00  <- shipped
    //   bias 0.35 + radius .25 i 1.8 -0.01647  -0.00140   0.001978          8.33
    //
    // The chosen row keeps MORE contact than the configuration that produced the
    // acne (-0.02818 against -0.02739) for **91% less acne and 94% less haze**.
    // Rendered and looked at at 4x (`shots/aotune/hamburger.sheet.png`): on open
    // floor it is indistinguishable from AO off, and the grout fringe is gone.
    //
    // ── AND IT STILL DOES NOT SHIP, ON A PRICE RATHER THAN A DOUBT ────────────
    // `node tools/perf.mjs --mode counts`, same frozen tree, AO the only difference:
    //
    //                          HEAD        with AO
    //   draw calls              804          1,118      +314   (+39%)
    //   triangles           383,450        685,128              (+79%)
    //   post-chain fill    5.46 Mpx     306.99 Mpx      5.7x -> 319x the draw buffer
    //   programs linked          32             37
    //   GPU memory          94.80 MB      115.41 MB     +21.7%
    //
    //   PER PASS, with AO:  RenderPass 784 · **NormalPass 312 draws / 301,676 tris**
    //                       · EffectPass(SSAO+Bloom+Grade+Vignette) 19 · SMAA 3
    //
    // SSAO in postprocessing needs a normal buffer, and a normal buffer means RENDERING
    // THE WHOLE SCENE A SECOND TIME. That is not a knob — `resolutionScale` cuts the
    // fill and leaves all 312 draws — so the contact costs 39% of the frame's draw
    // calls. This project's standing rule is that a perf change which moves the look is
    // not a win; the converse binds just as hard, and 0.027 of contact does not buy a
    // second geometry pass.
    //
    // ⚠️ THE CHEAP IMPLEMENTATION ALREADY EXISTS AND IS SIMPLY TOO WEAK. `src/arena/`
    // bakes a contact-occlusion layer whose band an arena pass measured at |dL| 0.0491
    // against a reference target of 0.1238 taken off real barrels — a shortfall of
    // 0.0747. AO's whole marginal contribution here is 0.0273. **Raising the baked
    // decal layer roughly 2.5x delivers more than this pass does, for zero extra draw
    // calls**, and that file has a different owner. Handed over with the numbers rather
    // than reached for.
    //
    // What IS kept below is the tuning, so that whoever enables `ao: true` next gets
    // the configuration that does not speckle rather than rediscovering it.
    //
    // `bias` is documented as "eliminates artifacts caused by depth discontinuities"
    // and defaults to 0.025; this floor is a stack of decals at y 0.045-0.08
    // (`docs/LESSONS.md` §1), so its seams ARE depth discontinuities and 0.025 was
    // never going to survive them. The intensity that pays the contact back is
    // `ssaoMaterial.intensity`, which is a DIFFERENT number from the constructor's
    // `intensity` — the latter scales the AO buffer in the blend and is already 2.4,
    // the former lives inside the occlusion sum and has no constructor option at all,
    // so it sat at its default 1 unnoticed.
    //
    // ⚠️ HIGH TIER ONLY. A NormalPass plus a 16-tap AO pass is the wrong thing for a
    // phone, and `TierProfile` has no `ao` field — `src/render/quality.ts` has another
    // owner. `tier.smaa` is true on `high` and only `high`, and it is already one of
    // the four flags `applyQuality` rebuilds the chain on, so gating here follows a
    // tier change correctly. A dedicated `TierProfile.ao` belongs in `quality.ts`.
    let ssao: SSAOEffect | null = null;
    if (this.useAO && !gradeOnly && tier.smaa) {
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
        // 0.20, not the library default 0.025 — see the table above. This is the one
        // knob that separates the contact from the seam acne.
        bias: 0.20,
        resolutionScale: 0.85,
      });
      // NOT the same number as `intensity` above, and that is the whole reason the
      // contact had to be bought back somewhere: `intensity` scales the finished AO
      // buffer at blend time, while this one sits inside the occlusion sum, has no
      // constructor option, and was silently at its default of 1.
      ssao.ssaoMaterial.intensity = 1.5;
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
    // ⚠️ THE SENTENCE ABOVE IS FALSE AND THE NUMBER IS KEPT ANYWAY. Read the effect
    // order at the bottom of this function: `effects.push(grade, vignette)` runs AFTER
    // bloom, in ONE `EffectPass`, so bloom's input is the RAW render and the highlight
    // shoulder cannot stop anything from reaching it. The stated justification for
    // 0.88 -> 0.80 describes a mechanism that does not exist. Re-derived rather than
    // inherited (`tools/tmp/haloprobe.mjs`, 4 characters x 2 stations, every bloom
    // setting driven on ONE frozen frame per sample so the rows differ by one knob):
    //
    //   threshold        bloom halo   deposit on the character   value steps @0.10
    //   0.80 (shipped)      0.00344                   0.00478                 6.50
    //   0.88                0.00206                   0.00259                 6.75
    //   0.92                0.00156                   0.00184                 6.75
    //
    // Raising it is worth -40% of halo and a quarter of a value step, and it is NOT
    // taken: the baseline re-score's dominant finding across four of five elements is
    // "surfaces are flat and UNLIT", so spending bloom to buy 0.0014 of luma at the
    // silhouette is the wrong direction on the strongest evidence this project has.
    // The setting stays; its false rationale does not.
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
    //
    // ── THE "27% OF THE VALUE GAP IS THE POST CHAIN" ITEM IS CLOSED, AND THE SIGN
    //    HAS FLIPPED. Do not re-open it from `docs/STATE.md`'s figure. ─────────────
    //
    // That number was measured at contrast 0.62, with NO shadow toe, on the PRE-albedo
    // cast. All three have since moved, so it was re-derived rather than inherited
    // (`tools/tmp/haloprobe.mjs`, 4 characters x 2 stations, every configuration
    // driven on ONE frozen frame per sample, mask from the DIRECT render):
    //
    //                                  THEN (recorded)      NOW (measured)
    //   whole chain, cast P05        0.272 -> 0.304        0.1817 -> 0.1191
    //                                  i.e. +0.032 COST       i.e. -0.063 GAIN
    //   whole chain, cast range      0.657 -> 0.593        0.7139 -> 0.7770
    //                                  i.e. -0.064 COST       i.e. +0.063 GAIN
    //
    // The post chain is now the LARGEST single contributor to the cast's dark end, not
    // a drain on it. Per element, as a change in the character's own P05 against the
    // shipped frame (negative = deeper darks, which is the direction wanted):
    //
    //   element            then      now     what changed
    //   SMAA              +0.032   +0.030    nothing — and it is not removable
    //   bloom             +0.020   +0.007    the albedo pass took the cast's share
    //                                        above luma 0.94 from 0.1007 to 0.0275,
    //                                        i.e. it removed 73% of bloom's own
    //                                        trigger population
    //   contrast S-curve  -0.046   -0.063    0.62 -> 0.72
    //   shadow toe            n/a  -0.040    new since that measurement
    //   vignette           0.000    0.000    exactly zero on a centred fighter, twice
    //   highlight shoulder 0.000    0.000    on P05 — but see below, it is NOT idle
    //
    // SMAA IS THE WHOLE OF WHAT REMAINS, AND IT IS NOT RECOVERABLE. It is the high
    // tier's antialiasing (MSAA does the same job on medium/low), and the +0.030 is
    // largely the metric measuring itself: P05 is the fifth percentile of a ~130 px
    // fighter whose one-pixel perimeter is ~5% of its area, so an AA pass that blends
    // the bright floor into the outermost ring moves exactly the percentile being
    // watched. The reference plates are captured game frames carrying their OWN
    // antialiasing, and `valuescan --mode ref` resamples them to our fighter's height,
    // so our AA'd P05 is compared against their AA'd P05. Removing ours would not
    // close a gap; it would break the comparison.
    //
    // The shoulder's real job is not P05 at all: ablating it (`highlightKnee` -> 1)
    // leaves P05 unmoved and takes the cast's share above luma 0.94 from 0.0176 to
    // 0.0675 — nearly 4x — while whole-frame clipped-high goes 0.020% -> 1.514%. It is
    // holding the near-white guard, not the dark one.
    //
    // ⚠️ ONE CLAUSE STRUCK FROM THAT SENTENCE, because it was arithmetically false and
    // it was load-bearing: it read *"nearly 4x, and clean past the reference band's
    // 0.0929 maximum"*. **0.0675 is BELOW 0.0929.** Fully ablating the shoulder leaves
    // the cast INSIDE the reference band, not past it. The 4x is real; the breach was
    // not. See the shoulder's own note at the top of this file for the three
    // measurements that re-priced this knob, and note the cast rail (a matte quantity)
    // and whole-frame clipped-high (a canvas quantity) are DIFFERENT QUANTITIES that
    // have been swapped for each other twice in this file's history.
    //
    // ── The original finding, for the record ─────────────────────────────────
    // `tools/tmp/valuescan.mjs` put our cast's P95 at 0.896 against a reference P95 of
    // 0.896 — identical — and our P05 at 0.304 against 0.097. The cast has NO DARK
    // RUNG, and 27% of that gap was measured to be the post chain rather than the art.
    //
    // `tools/tmp/postablate.mjs` then took the chain apart on one frozen frame, one
    // knob at a time, every row confirmed by image diff. Mean over the cast at
    // pot_south, as a change in the character's own P05 (negative = deeper darks):
    //
    //   SMAA .................. +0.032   edge blend, bright floor bleeding into the
    //                                    fighter's outline. NOT removable — it is the
    //                                    high tier's AA, and MSAA does the same thing
    //                                    on medium/low.
    //   bloom ................. +0.020   halo. Every partial trim measured bought less
    //                                    than 0.006 of it, and bloom is art direction
    //                                    (every reference plate has it, ours had none).
    //   contrast S-curve ...... -0.046   ALREADY FIGHTING FOR US. The only part of the
    //                                    chain pulling the right way.
    //   vignette ..............  0.000   exactly zero on a centred fighter.
    //   highlight shoulder ....  0.000   costs P95, not P05.
    //
    // So the post chain is not "eating" the dark end through the grade — the grade is
    // the only thing clawing it back, and the eaters are two passes that cannot be
    // deleted. The recovery therefore has to be a NEW pull at the bottom, which is
    // what `shadowToe` is (see the shader). Measured, same probe, same frame:
    //
    //   config                          ΔP05     Δrange      ΔdL   clip0   clip255
    //   HEAD                           +0.000    +0.000   +0.000    0.11      0.03
    //   toe .28 @ .62                  -0.044    +0.044   +0.019    0.11      0.02
    //   toe .28 @ .62 + contrast .72   -0.052    +0.060   +0.023    0.16      0.03
    //   highlightKnee .82 -> .92       +0.000    +0.018   +0.006    0.13      2.48  <- rejected
    //                                          ⚠️ still rejected, but NOT for that 2.48.
    //                                          See the shoulder's note at the top of the
    //                                          file: 2.48% is "any channel at exactly
    //                                          255" on a shoulder that is asymptotic to
    //                                          1.0, it is one orange surface moving one
    //                                          code, and the reference's own band on the
    //                                          same measurement is 1.35-16.36%. The real
    //                                          reason is +0.018 of range for 8% of the
    //                                          hi80 gap.
    //   lighting: fill .50 -> .30      -0.009    +0.006   -0.002    0.11      0.02  <- rejected
    //
    // AS SHIPPED, over all eleven characters at pot_south, with HEAD and this change
    // driven on the SAME frozen frame so the two differ by nothing else at all
    // (`tools/tmp/postablate.mjs --pair`):
    //
    //   P05    0.315 -> 0.280      range  0.584 -> 0.619      dL  0.226 -> 0.247
    //   P95    0.899 -> 0.899  — the light end is untouched, which is the point:
    //                            our P95 already equals the reference's 0.896.
    //
    // Every one of the eleven improved on both range and P05, and two gained a value
    // step (pizza 5 -> 6, hotdog 6 -> 7). The shipped figure is smaller than the
    // `+ contrast .72` row above because that row did not survive the colour gate; see
    // the note on the constructor call below for what it cost and what it was worth.
    //
    // The last two rows are the two obvious alternatives, priced and turned down.
    // Opening the highlight shoulder buys range at the end that is ALREADY CORRECT and
    // takes clipped-high from 0.06% of the frame to 2.50%.
    // ⚠️ THAT SECOND CLAUSE IS NOT A REASON — see the re-price on `ToyGradeEffect`. The
    // 0.06% is what a shoulder ASYMPTOTIC TO 1.0 does to a "channel === 255" counter by
    // construction, and 2.50% is inside the reference's own 1.35-16.36% band on the same
    // measurement. The first clause is the reason, and it survives: the shoulder is
    // still refused because it buys ~8% of the hi80 gap, not because of the clipping.
    // Dropping the hemisphere
    // fill — `lighting.ts`'s "shadow floor", the most obvious non-post lever on the
    // cast's dark end — buys a fifth as much AND costs figure/ground, because it
    // darkens the floor the fighter is standing on at the same time.
    //
    // ⚠️ The rim light is deliberately not in that table. A measured sweep put the
    // whole available gain from retuning it at +0.012 before it INVERTS (past intensity
    // ~3.4-6.0 separation drops BELOW switching it off, because it lights the floor
    // faster than it lights the fighter). It was not touched.
    // ── ONE knob changed, and here is why it is only one ────────────────────
    // `saturation`, `knee` and `highlightKnee` are untouched. All three were moved
    // during the toe pass and all three were put back, because the colour gate priced
    // them and they were not worth what they cost:
    //
    //   candidate (6 arena-scan stations, `tools/tmp/gradechroma.mjs`)
    //                                  ΔmeanSat  Δchroma  ΔcoolChroma   Δrange
    //   contrast .62 -> .72             +0.0151  +0.0088      +0.0160   +0.016
    //   saturation .70 -> .86           +0.0274  +0.0228      +0.0264    0.000
    //
    // Saturation buys NO range at all — it is applied about luma, so `dot(d, rec709)`
    // is 0 and the pixel's luma is algebraically unchanged; measured, P05/P95/range are
    // identical at 0.70, 0.82, 0.86 and 0.90 (`tools/tmp/postablate.mjs`, five
    // characters, four rows agreeing to three decimals). It was only ever bought to pay
    // back chroma the toe was spending, and once the toe stopped spending chroma it had
    // no job.
    //
    // ── CONTRAST 0.62 -> 0.72, TAKEN — AND THE CLAIM CAME IN 30% SHORT ────────
    //
    // It was left on the table last pass as a GATE decision, not an art one: it spends
    // +0.0160 of `coolChroma`, whose drift budget is 0.0200. `8a91f7c` then made that
    // rail `freeAbove` — exceeding the reference on cool chroma is never drift, because
    // LESSONS §8's whole finding is that the reference reserves HUE by keeping a
    // saturated COOL ground. So the block was removed and the gain was re-measured
    // rather than inherited. RE-MEASURING IT WAS THE POINT: it does not pay what the
    // handover said it pays.
    //
    // ⚠️ MEASURED TWICE, BECAUSE THE CAST MOVED UNDER IT. `tools/tmp/contrastab.mjs`
    // drives BOTH settings on ONE frozen frame per character, so the two rows differ
    // by exactly one uniform. All eleven, two independent stations, both times.
    //
    // It is NOT `postablate.mjs --toe`, and that matters: that tool's row helper is
    // `T = (toe, tk, sat = 0.70, c = 0.72)`, so its row LABELLED `toe .28@.60 s.70`
    // silently runs contrast 0.72 while the `HEAD ... c.62 toe0` row it is read
    // against passes 0.62 explicitly. Every `--toe` row bar the first therefore
    // differs from HEAD by TWO uniforms. Harmless for the sweep it was written for;
    // fatal for a question worth exactly one uniform.
    //
    //   (a) PRE-ALBEDO (cast as of 430c3c0), mean over 11:
    //         pot_south   range 0.6187 -> 0.6299   Δ +0.0112
    //         spawn_west  range 0.6205 -> 0.6319   Δ +0.0113
    //       Against a CLAIMED +0.016 that is 30% short — and the two stations agree
    //       with each other to 0.0001, so the shortfall was real, not noise. The
    //       +0.016 was a three-character sample being optimistic about the other eight.
    //
    //   (b) POST-ALBEDO (the shipped cast, 9854f2c swept the albedo pass in), same
    //       probe, same stations:
    //         pot_south   range 0.7592 -> 0.7734   Δ +0.0143
    //         spawn_west  range 0.7590 -> 0.7728   Δ +0.0138
    //
    // SO THE CLAIM IS NOW NEARLY RIGHT, AND FOR A REASON THAT IS ARITHMETIC RATHER
    // THAN LUCK. The S-curve's fixed point is 0.5. The albedo pass moved the cast's
    // fifth percentile from 0.280 to 0.167 — much further BELOW mid-grey — and the
    // deeper a dark sits below the fixed point the more the curve moves it. Same
    // uniform, darker cast, bigger payout. Anyone re-measuring this after another
    // albedo move should expect the number to move again, in that direction.
    //
    // Range improves for ALL ELEVEN at BOTH stations, both times (post-albedo: min
    // +0.0109 egg, max +0.0182 waterbottle). Post-albedo, donut gains a value step
    // 7 -> 8 and sushi 6 -> 7.
    //
    // ⚠️ THE HONEST COSTS.
    //
    //   1. P05 now deepens on ELEVEN of eleven. Pre-albedo it LIGHTENED on egg
    //      (+0.0028), because egg's P05 was 0.579 — above the S-curve's fixed point,
    //      so its dark end was on the half that gets pushed UP. The albedo pass took
    //      egg's P05 to 0.281 and the exception vanished. The RULE survives it: any
    //      character whose fifth percentile sits above mid-grey will lighten, so this
    //      is a property to re-check after any albedo move, not a solved problem.
    //   2. The character's own P95 rises +0.0056, on all eleven. ⚠️ THE PREMISE THAT
    //      MADE THIS CHEAP NO LONGER HOLDS: the light end WAS at the reference (0.896)
    //      when this was decided, and post-albedo the cast's P95 is 0.9266 BEFORE this
    //      change touches it. So this now adds 0.0056 to an existing +0.031 overshoot
    //      rather than to a +0.002 one. That overshoot is the albedo pass's, not this
    //      change's, but this change is no longer landing in the world the decision
    //      was made in, and the light end is worth re-opening on its own.
    //   3. Whole-frame clipping, both tails, post-albedo at pot_south:
    //      clipped-LOW 0.110% -> 0.155%, clipped-HIGH 0.053% -> 0.066%. Against the
    //      2.50% that got `highlightKnee` 0.92 rejected, and the raw render's 2.33%
    //      high. Both tails stay ~1.5 orders under the untouched render.
    //      ⚠️ "~1.5 orders under the untouched render" is no longer obviously a virtue:
    //      the RAW render's 2.33% is inside the reference's own 1.35-16.36% band on this
    //      exact measurement and our shipped 0.06% is 22x below its minimum. Read this
    //      row as "the shoulder is intact", not as "less clipping is better".
    //
    // AND THE THREE THINGS NO NUMBER ANSWERS, looked at rather than inferred
    // (`shots/contrastab/head_png/_sheet.*.png`, 4x nearest-neighbour so adjacent
    // 8-bit codes are visible, plus whole frames at shipped framing):
    //
    //   banding    NOT PRESENT. Checked on the surfaces that would show it first —
    //              the pot hazard's wide radial glow, egg's near-white sphere,
    //              waterbottle's large low-curvature body. No contour rings either
    //              side. The proxy agrees and is worth keeping: the widest flat 8-bit
    //              code in the dark half FALLS, 2.45% -> 2.23% of the matte, because
    //              the S-curve spreads dark codes APART rather than collapsing them.
    //   crush      Real but small, and it has ONE worst case: waterbottle 0.119% ->
    //              0.739% of its own pixels under luma 0.05. On lollipop — the lowest
    //              P05 in the cast — the dark cloak and its own drop shadow visibly
    //              begin to merge. Still readable; it is the character to watch if
    //              contrast is ever pushed past 0.72.
    //   sooty      NO — the opposite. HSV saturation of each character's darkest
    //              quartile RISES on 11 of 11 (mean 0.574 -> 0.589). The darks get
    //              more chromatic, not greyer, which is what `toeChromaKeep` 0.55 is
    //              for. The whole frame reads slightly more vivid, not muddier.
    //
    // The colour side DID reproduce, to a thousandth (`tools/tmp/gradechroma.mjs`, six
    // stations, one page load each, priced against the SHIPPED grade rather than the
    // pre-toe HEAD — printing only the pre-toe column once made a candidate look as
    // though it spent the toe's chroma twice):
    //
    //   contrast .62 -> .72   ΔmeanSat +0.0168   Δchroma +0.0075   Δwarm +0.0014
    //                         ΔcoolChroma +0.0162   ΔwarmShare -0.0019   Δluma -0.0050
    //
    // Four of those five move TOWARD the reference, and `meanSat` — the rail this
    // arena is furthest from — gains the most.
    //
    // ⚠️ BUT THE GATE STILL FIRES, IN A SECOND PLACE `8a91f7c` DID NOT REACH.
    // `arena-scan.mjs` has TWO cool-chroma rails against the same 0.343 target with
    // the same 0.020 tol: whole-frame `coolChroma`, which `8a91f7c` made `freeAbove`,
    // and `arenaCoolChroma`, which was NOT given the flag. So the identical move is
    // rated `ok` by one and `REGRESSION` by the other. Not this file's to fix — but
    // any future grade pass will hit it, and the fix is one flag.
    //
    // And a joint effect worth naming rather than burying: `warmShare` left its band
    // [0.120, 0.450] at 0.1195. Of the -0.0122 that took it there, this change is
    // -0.0019 and the cast-wide albedo pass is the rest — i.e. this change is a
    // seventh of the drift and the part that crosses the floor. Both are recorded in
    // `tools/scan/colour-baseline.json`'s `bakedInRegressions`, because the
    // re-baseline makes them invisible to the next run and a green gate must not be
    // mistaken for a healthy rail (`docs/LESSONS.md` §13).
    //
    // Worth recording as a shape, not just a number: this arena is ~87% cool chroma, so
    // ANY global value or saturation move pushes `meanSat` (needs to rise) and
    // `coolChroma` (already at target) in the same direction. Before `freeAbove` the
    // two rails could not both be satisfied by any setting. That is a property of the
    // instrument pair, and it is why the rail was one-sided rather than the change
    // being abandoned.
    //
    // The stronger toes were rendered and LOOKED AT at shipped framing
    // (`shots/gradechroma/v3/sheet.png`) and rejected on the art direction, not on a
    // number: `.40@.68` takes mean luma to 0.303 and the arena stops reading HIGH-KEY,
    // which is a stated pillar of the reference. `.28@.60` is the deepest toe that
    // still leaves the frame bright.
    const grade = new ToyGradeEffect({
      saturation: 0.70, contrast: 0.72, knee: 0.55, highlightKnee: 0.82,
      shadowToe: 0.28, toeKnee: 0.60, toeChromaKeep: 0.55,
    });
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
    // The camera keeps tracking through a blackout; only the DRAW is skipped.
    //
    // Deliberately in that order. `rig.update` is a damped follow and costs nothing on
    // the CPU, so ticking it through the loss means the first restored frame is
    // already framed correctly — freezing it instead would leave the camera however
    // many seconds behind the player and then glide to catch up, in full view, at the
    // exact moment the player is trying to work out what just happened.
    this.rig.update(dtSeconds);
    // No GPU to draw with. three's own `render()` early-returns while the context is
    // lost, but `composer.render()` does not — it would walk the whole post chain
    // binding dead render targets once per frame, for as long as the loss lasts.
    if (this.contextLost) return;
    // BEFORE the shadow fingerprint, deliberately: the decals move with the fighters
    // and `scheduleShadowUpdate` calls `scene.updateMatrixWorld()`, so placing them
    // after it would leave their matrices a frame behind. They never enter the
    // fingerprint itself — it only hashes meshes with `castShadow`, and these do not.
    this.updateContactShadows();
    if (this.shadowsOn) this.scheduleShadowUpdate();
    if (this.composer) this.composer.render(dtSeconds);
    else this.renderer.render(this.scene, this.rig.camera);
  }

  /**
   * ── THE CENTRED CONTACT SHADOW UNDER EACH FIGHTER ──────────────────────────
   *
   * Nine of fourteen arena critics said, unprompted, that "the characters sit on it
   * like decals rather than in a built environment ... no contact shading". That was
   * a symptom, and `docs/LESSONS.md` §3 says take the symptom and re-derive the
   * cause. `tools/tmp/cs_charcontact.mjs` (selftest 31/31) did, by rendering every
   * frame TWICE — shipped, and with the cast's own `castShadow` off and nothing else
   * moved — and measuring the darkening on two flanks mirrored about the screen
   * vertical: the one the key throws into, and its mirror.
   *
   *   hamburger, 3 stations, frozen snapshot     shade flank      OPPOSITE flank
   *     ablation delta, luma                  0.190/0.160/0.153   0.0000/0.0000/0.0001
   *     as a fraction of the floor            0.431/0.352/0.388   0.000/0.000/0.000
   *
   *   bs_06's vent props — the only reference   0.192/0.269/0.324   0.198/0.061/0.087
   *   subjects with no UI decal over them
   *
   * So the diagnosis is NOT "too little shadow". Our shade side is at or above the
   * reference. It is that our contact is **100% DIRECTIONAL**: three sides of every
   * fighter's feet are untouched floor, where the reference darkens all round by
   * 6-20% of the floor's own value. Rendered and looked at at 2x
   * (`shots/contact/before/570_430__shipped.png`): one offset slab to the left, and
   * a character standing on nothing.
   *
   * ── WHY A DECAL AND NOT SSAO ───────────────────────────────────────────────
   * `buildPost` above measured the repaired SSAO pass at 0.0273 of contact for +314
   * draw calls and +79% of triangles, because a normal buffer means rendering the
   * whole scene a second time, and rejected it on that price. This is the same
   * contact for **two draw calls in a match** — one per fighter, sharing one geometry,
   * one material and one 64x64 texture.
   *
   * ── THE THREE THINGS THAT WOULD HAVE BURIED IT ─────────────────────────────
   *  1. `y = 0.09`. The ground layer stack is crowded and has hidden things eighteen
   *     times (`docs/LESSONS.md` §1): floor pads 0.045-0.048, seams 0.062, baked prop
   *     shadows 0.068-0.07, prop kicks 0.08. This sits above all of them, and the fix
   *     is closed out by measuring DELIVERED pixels rather than authored ones — the
   *     §1 case-17 rule, which is what a decal at 0.011 under tiles at 0.015 cost.
   *  2. `depthWrite: false`. Every transparent material in the cast carries
   *     `depthWrite: true` and silently occludes; this one must not.
   *  3. MULTIPLY, not additive and not a black quad. Additive blending over this
   *     floor makes a wash, and a grey multiply keeps hue and saturation exactly
   *     while lowering value — the one darkening operation that is not a
   *     desaturation, which has been falsified here four times.
   *
   * ── MATCH FRAMING ONLY, and that is measured rather than cautious ──────────
   * `src/ui/screens/charStage.ts` already draws TWO contact decals under the
   * character-select podium and says in its own comment that "a third one drawing
   * over them would compound". `frameMode: 'fair'` is true in a match and false in
   * every preview and menu plate, so this is off wherever an authored contact shadow
   * already exists. The cost is that a character reviewed in `preview.html` no longer
   * sees exactly what a match draws — stated because `lighting.ts` deliberately
   * shares its rig for the opposite reason.
   */
  private updateContactShadows(): void {
    if (this.rig.frameMode !== 'fair') return;
    const targets = this.collectContactTargets();
    if (!targets.length && !this.contactGroup) return;
    if (!this.contactGroup) {
      this.contactGroup = new THREE.Group();
      this.contactGroup.name = 'contact:shadows';
      // Never a shadow caster and never a shadow receiver: it IS the shadow.
      this.contactGroup.matrixAutoUpdate = true;
      this.scene.add(this.contactGroup);
    }
    for (let i = this.contactGroup.children.length; i < targets.length; i++) {
      this.contactGroup.add(this.buildContactDecal());
    }
    const v = this.contactScratch;
    for (let i = 0; i < this.contactGroup.children.length; i++) {
      const decal = this.contactGroup.children[i];
      const target = targets[i];
      if (!target) { decal.visible = false; continue; }
      target.getWorldPosition(v);
      decal.visible = true;
      decal.position.set(v.x, CONTACT_Y, v.z);
    }
  }

  /**
   * The fighters, without walking the arena.
   *
   * A full `scene.traverse` is ~740 arena meshes a frame for two answers. This stops
   * descending at anything already named `character:*` (the answer) and at the two
   * subtrees that can never contain one, so it visits tens of nodes rather than
   * hundreds. Re-run every frame on purpose: a character is added at spawn and
   * removed on death, and a cached list would leave a shadow on empty floor for
   * however long the cache lived.
   */
  private collectContactTargets(): THREE.Object3D[] {
    const out = this.contactTargets;
    out.length = 0;
    const walk = (o: THREE.Object3D): void => {
      if (!o.visible) return;
      if (o.name.startsWith('character:')) { out.push(o); return; }
      if (o.name === 'arena:kitchen' || o.name === 'lighting' || o.name === 'contact:shadows') return;
      for (const c of o.children) walk(c);
    };
    for (const c of this.scene.children) walk(c);
    return out;
  }

  private buildContactDecal(): THREE.Mesh {
    if (!this.contactGeometry) {
      // A plane lying on the ground, sized in the character's OWN footprint radii so
      // it stays correct if `PLAYER_SIZE` moves — `CHARACTER_RADIUS` derives from it.
      this.contactGeometry = new THREE.PlaneGeometry(1, 1);
      this.contactGeometry.rotateX(-Math.PI / 2);
    }
    if (!this.contactMaterial) {
      this.contactMaterial = new THREE.MeshBasicMaterial({
        map: contactTexture(),
        transparent: true,
        // ── A MULTIPLY, SPELLED OUT AS CustomBlending, AND THAT IS NOT STYLE ────
        // out = 0*src + dst*src = dst*src, so a WHITE texel is an exact identity and
        // only the painted core darkens anything. The texture's border is white for
        // that reason — the square corners of the quad must be invisible.
        //
        // ⚠️ `blending: THREE.MultiplyBlending` DOES NOT WORK, AND IT FAILS BY DRAWING
        // AN OPAQUE WHITE QUAD 5.5 m ACROSS ON THE FLOOR — present, and doing the
        // exact opposite of its job. Probed rather than reasoned about
        // (`tools/tmp/cs_decalprobe.mjs`, the §1 unmissable-probe technique): the
        // material reported `blending: 4`, `transparent: true`, and a texture that had
        // uploaded correctly (corner 255,255,255 / centre 181,188,203) — everything as
        // authored — while the delivered pixels came back 248,248,248 at the corner and
        // 231,236,244 at the centre, i.e. the TEXTURE drawn opaquely. A multiply cannot
        // produce a pixel brighter than the floor it lands on, so the GL blend function
        // was not the one the material asked for.
        //
        // THE CAUSE, and `src/ui/screens/charStage.ts:294` had already written it down
        // — three r180's `WebGLState.setBlending` refuses the mode outright:
        //
        //     case MultiplyBlending:
        //       console.error('THREE.WebGLState: MultiplyBlending requires
        //                      material.premultipliedAlpha = true');
        //
        // It does not throw and it does not fall back; it logs and leaves whatever
        // blend function the previous draw call set. My first guess from the pixels
        // alone was a stale `currentBlending` cache colliding with `postprocessing`'s
        // own GL state — plausible, and WRONG. That guess is recorded because the
        // right answer was one console line away and one grep away.
        //
        // `CustomBlending` spells the same maths out and takes the branch that always
        // emits the factors. `premultipliedAlpha: true` would also work and is not
        // taken: it would change how every OTHER property of this material composites,
        // to buy a preset that is already expressible.
        blending: THREE.CustomBlending,
        blendEquation: THREE.AddEquation,
        blendSrc: THREE.ZeroFactor,
        blendDst: THREE.SrcColorFactor,
        blendEquationAlpha: THREE.AddEquation,
        blendSrcAlpha: THREE.ZeroFactor,
        blendDstAlpha: THREE.OneFactor,
        // §1's silent occluder. A transparent material that writes depth hides
        // whatever sorts after it.
        depthWrite: false,
        depthTest: true,
        toneMapped: false,
        fog: false,
      });
    }
    const m = new THREE.Mesh(this.contactGeometry, this.contactMaterial);
    m.name = 'contact:decal';
    m.castShadow = false;
    m.receiveShadow = false;
    m.frustumCulled = true;
    const s = CHARACTER_RADIUS * CONTACT_SPREAD * 2;
    m.scale.set(s, 1, s);
    // Transparents are sorted back-to-front by depth, and this sits ABOVE the arena's
    // own ground decals (0.045-0.08) so it already sorts after them. `renderOrder`
    // stated anyway, because relying on a y offset for draw order is how the ground
    // stack buried things eighteen times.
    m.renderOrder = 2;
    return m;
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

    // `forceContextLoss()` at the end of this method fires a REAL `webglcontextlost`
    // on this canvas. The handlers guard on `this.disposed` (already true) so they
    // would no-op anyway, but taking them off is what stops a teardown ever being
    // logged and broadcast as a GPU failure — the player must not be told the
    // graphics died because they walked out of a match.
    this.canvas.removeEventListener('webglcontextlost', this.onContextLost, false);
    this.canvas.removeEventListener('webglcontextrestored', this.onContextRestored, false);
    this.canvas.removeEventListener('webglcontextcreationerror', this.onContextCreationError, false);

    this.composer?.dispose();
    this.composer = null;
    this.grade = null;

    // ── The resource walk is GUARDED, and that is not paranoia ────────────────
    // Everything from here to `this.scene.clear()` is a best-effort tidy of a few
    // hundred shared objects, and the three lines AFTER it are the ones that actually
    // hand the GL context back. Ordered naively, a single throw anywhere in the walk —
    // one exotic material, one getter that objects to being enumerated — skips
    // `forceContextLoss()` and LEAKS THE WHOLE CONTEXT. That is the exact failure this
    // method was written to fix: Chrome caps a process at ~16 live contexts and kills
    // the OLDEST when the cap is hit, so the symptom is not "this teardown failed", it
    // is "eight round trips later, the menu portrait went black". The cleanup is
    // therefore allowed to fail; the handback is not.
    try {
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
    } catch (err) {
      // eslint-disable-next-line no-console
      console.error('[stage] resource teardown threw; releasing the context anyway:', err);
    }

    this.renderer.dispose();
    // The line that fixes the leak. Must come after `dispose()`, which detaches the
    // context-lost handler that would otherwise log and set `_isContextLost`.
    this.renderer.forceContextLoss();
    this.canvas.remove();

    const i = STAGES.indexOf(this);
    if (i >= 0) STAGES.splice(i, 1);
  }
}
