/**
 * THE FIGHTER CONTOUR — one continuous near-black silhouette line per fighter, drawn by the
 * post chain from an alpha tag, in place of 22-78 per-part ink hulls.
 *
 * Graphics campaign R1 (`docs/REVAMP.md` §2.1 / §2.8 / §5). Measured on `1090046`:
 *
 *   * the reference marks its fighters with a continuous near-black contour, ~3-5 px at
 *     900-px-equivalent (edge profiles at luma 0.01-0.02); ours drew a 1.53 px navy hull
 *     per PART, which reads as a broken 1-1.5 px line plus interior specks, and the share
 *     of dark contour pixels on our fighters measured 0.009 against ~0.07;
 *   * those hulls cost ~336 draw calls at six seats on the phone tier, which has no
 *     draw-call headroom left (1,567-1,571 draws). Measured with this effect in their
 *     place (`tools/tmp/r1_probe.mjs`, phone tier, 1055x487, shadow pass included):
 *     six seats 961 -> 729 and 1,224 -> 908; 2,390 -> 1,648 where a fighter has a
 *     TRANSMISSIVE part, because three re-renders every opaque mesh — hulls included —
 *     into its transmission target, so a hull there cost two draws.
 *
 * ── HOW IT FINDS A FIGHTER WITH ZERO EXTRA DRAWS ────────────────────────────────
 * Every OPAQUE character fragment writes `LOOK.charAlpha` (0 in a match) into alpha
 * (`roles.ts`); everything else in the scene is opaque at alpha 1, the background clears
 * to 1, and the composer's buffers are RGBA HalfFloat on every tier, so the RenderPass
 * output carries a silhouette mask for free. MSAA resolves it to fractional coverage at
 * the edge, which is what makes the line antialiased on both sides.
 *
 * This effect reads that alpha from `inputBuffer` around each pixel and paints ink on the
 * pixels that are NOT character but have character within `width`. It writes alpha 1, so
 * nothing after it can read the tag: the tag never leaves the RenderPass output.
 *
 * ── THE ONE AMBIGUITY, AND THE RULE THAT HANDLES IT ─────────────────────────────
 * A translucent effect drawn OVER a fighter (a hit splash, a status glow) blends alpha
 * toward its own, so a fighter pixel under it reads as partly "world". From one alpha value
 * that is indistinguishable from an antialiased silhouette edge — both are "partial
 * coverage". The difference is WHERE they are: a real edge pixel touches clean world
 * within one pixel; a splash over a fighter's body does not. So ink needs all three of:
 *   near   - character within `width` (16 taps, two radii);
 *   self   - this pixel is (partly) not character;
 *   edge   - this pixel, or one of its four 1-px neighbours, is CLEAN world.
 * Without `edge`, every translucent effect over a fighter would print a dark smudge where
 * it overlaps him. An opaque occluder in front of a fighter IS clean world and gets a line
 * along the occlusion boundary, which is the silhouette of what is visible.
 *
 * ── WHY ITS OWN EFFECT IN THE MAIN PASS, AND WHY NOT `CONVOLUTION` ─────────────
 * It samples `inputBuffer` at offsets, which is what `EffectAttribute.CONVOLUTION` exists to
 * declare — but `EffectPass` refuses to merge a convolution with any effect that defines
 * `mainUv`, and Squid Ink's lens warp does (`stage.ts`). Declaring it would cost the frame a
 * whole extra full-screen pass on the phone. Undeclared, it reads `inputBuffer` — the
 * RenderPass output, i.e. exactly the tagged frame — at `uv` + offsets; the only thing the
 * attribute would have changed is the merge check. When Squid Ink is warping, `uv` is the
 * warped coordinate and the contour follows the warp, which is correct.
 *
 * It sits AFTER the grade and the vignette and BEFORE Squid Ink: the ink is a final colour,
 * not a lighting term — the grade's toe would otherwise lift it off near-black — and Squid
 * Ink is an occlusion over everything, contour included.
 *
 * ⚠️ ABLATE IT WITH `amount = 0`, never with `blendMode.opacity` (it is `BlendFunction.SRC`,
 * whose shader never reads opacity — the trap `stage.ts` records for the grade).
 */

import * as THREE from 'three';
import { BlendFunction, Effect } from 'postprocessing';

/**
 * Line width as a fraction of FRAME HEIGHT: 3.25 px at 900. The reference reads ~3-5 px of
 * near-black at 900-px-equivalent and the brief asks 2.5-3.5. The 8 directions sit 45
 * degrees apart, so the line is solid to ~0.92 of this and bilinear-soft beyond it — about
 * 3 px of full ink. Swept 3.0 / 3.25 / 3.5 on one frozen six-seat frame and read at 3x
 * (`shots/rv/r1/ink1/sheet_ink_S1.png`): 3.0 broke up where a fighter's own dark artwork met
 * the line, 3.5 started to read as a sticker border on the smallest fighters.
 */
export const CONTOUR_WIDTH_FRAC = 3.25 / 900;

/**
 * Near-black with a violet lean (sRGB #08060e, Rec.709 luma ~0.025). Not pure black —
 * `toon.ts`'s OUTLINE_INK note records why a pure-black line reads as a sticker — but far
 * darker than the old navy hull (#241a33, luma ~0.12), because the reference's contour sits
 * at luma 0.01-0.02. #120d1c (luma ~0.06) was tried first and read as dark grey at 1x.
 */
export const CONTOUR_INK = 0x08060e;

const CONTOUR_SHADER = /* glsl */`
uniform float contourAmount;
uniform float contourWidth;
uniform vec3 contourColor;

// Character coverage at a point: 1 inside an opaque fighter, 0 on the world.
float ctCover(const in vec2 p) {
  return 1.0 - clamp(texture2D(inputBuffer, p).a, 0.0, 1.0);
}

void mainImage(const in vec4 inputColor, const in vec2 uv, out vec4 outputColor) {
  if (contourAmount <= 0.0) { outputColor = vec4(inputColor.rgb, 1.0); return; }
  float ctOwn = ctCover(uv);
  vec2 ctR = texelSize * max(1.25, contourWidth * resolution.y);

  float ctNear = 0.0;
  for (int i = 0; i < 8; i++) {
    float a = float(i) * 0.78539816;
    ctNear = max(ctNear, ctCover(uv + vec2(cos(a), sin(a)) * ctR));
    float b = a + 0.39269908;
    ctNear = max(ctNear, ctCover(uv + vec2(cos(b), sin(b)) * ctR * 0.5));
  }

  // Clean world here or one pixel away (see the header's ambiguity note).
  float ctClean = 1.0 - smoothstep(0.02, 0.20, ctOwn);
  ctClean = max(ctClean, 1.0 - smoothstep(0.02, 0.20, ctCover(uv + vec2(texelSize.x, 0.0))));
  ctClean = max(ctClean, 1.0 - smoothstep(0.02, 0.20, ctCover(uv - vec2(texelSize.x, 0.0))));
  ctClean = max(ctClean, 1.0 - smoothstep(0.02, 0.20, ctCover(uv + vec2(0.0, texelSize.y))));
  ctClean = max(ctClean, 1.0 - smoothstep(0.02, 0.20, ctCover(uv - vec2(0.0, texelSize.y))));

  float ctInk = ctNear * (1.0 - ctOwn) * ctClean * contourAmount;
  outputColor = vec4(mix(inputColor.rgb, contourColor, ctInk), 1.0);
}
`;

export class CharacterContourEffect extends Effect {
  constructor({ width = CONTOUR_WIDTH_FRAC, color = CONTOUR_INK }: { width?: number; color?: THREE.ColorRepresentation } = {}) {
    super('CharacterContourEffect', CONTOUR_SHADER, {
      blendFunction: BlendFunction.SRC,
      uniforms: new Map<string, THREE.Uniform>([
        // 0 by default: the effect is the identity (bar the alpha reset) until `Stage`
        // says this frame is a match with tagged fighters in it.
        ['contourAmount', new THREE.Uniform(0)],
        ['contourWidth', new THREE.Uniform(width)],
        // Linear working space: the chain is linear until Squid Ink's sRGB conversion.
        ['contourColor', new THREE.Uniform(new THREE.Color(color))],
      ]),
    });
  }

  /** 0..1. **Exactly 0 is the identity** on RGB (alpha is reset to 1 either way). */
  get amount(): number { return this.uniforms.get('contourAmount')!.value as number; }
  set amount(v: number) { this.uniforms.get('contourAmount')!.value = v; }
  /** Line width as a fraction of frame height. */
  get width(): number { return this.uniforms.get('contourWidth')!.value as number; }
  set width(v: number) { this.uniforms.get('contourWidth')!.value = v; }
  get color(): THREE.Color { return this.uniforms.get('contourColor')!.value as THREE.Color; }
}
