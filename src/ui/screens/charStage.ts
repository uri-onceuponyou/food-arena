/**
 * The menu's 3D character portrait.
 *
 * This is the same machinery `preview.html?piece=character&id=<id>` uses — the real
 * `Stage` (toon materials, lighting, IBL, the colour grade) and the real
 * `createCharacter()` factory — with the camera set up exactly the way
 * `src/preview.ts` sets it up for a character piece. That matters: those framing
 * numbers — `frameMode: 'subject'`, a shallow pitch, a bright ground disc — are the
 * ones every character was authored and critiqued against, so a model approved in
 * preview looks the same in the menu. Picking new ones by eye would make the menu a
 * third, unjudged framing. The one deliberate departure is `applyFraming()` below,
 * which also fits WIDTH; see its comment for why a menu column forces that.
 *
 * ── Why this is a singleton ─────────────────────────────────────────────────
 * A WebGL context is expensive to create and browsers cap how many can be live.
 * Home and character select both want a hero portrait, and the user bounces between
 * them constantly, so the context is created once, re-parented on navigation, and
 * only destroyed when a MATCH starts (which needs the GPU for itself). The shell
 * owns that lifecycle — see `disposeCharacterStage()`.
 *
 * ═══════════════════════════════════════════════════════════════════════════
 * THE SET — and the measurement bug it exists to fix
 * ═══════════════════════════════════════════════════════════════════════════
 *
 * This file used to clear to an opaque saturated cyan and fog the ground disc into
 * that same colour. Two consequences, one aesthetic and one much worse.
 *
 * AESTHETIC. Two independent blind critics, both on valid rounds (references 8.5/8.0
 * and 8/7), said the same thing in the same words: the hero "reads as a cutout pasted
 * on a colour swatch". They were right, and the mechanism was structural rather than
 * a matter of taste — because `Stage` clears to an OPAQUE background, anything the
 * consuming screen paints behind the canvas is invisible, so every layer available
 * from `home.ts` was a tint drawn OVER the character. The screens had built masked
 * CSS horizons and contact shadows as a workaround. They are gone; the set below is
 * the real thing.
 *
 * MEASUREMENT. `docs/LESSONS.md` §13. Measured with `tools/tmp/stage_fg.mjs`:
 *
 *                                   character vs its surround
 *     this stage, cyan backdrop      body 0.464  surround 0.698   -0.234
 *     this stage, the set below      body 0.448  surround 0.260   +0.188
 *     the shipped match              body 0.541  frame    0.325   +0.216
 *
 * OPPOSITE POLARITY. The menus were showing every fighter as a dark shape on a bright
 * field while the game shows it as a bright shape on a darker one, so a silhouette
 * judged here was judged against a figure/ground relationship the player never sees —
 * and a cool rim light on a cyan backdrop measurably REDUCES separation, which is why
 * critics kept reporting the rim as absent when it demonstrably exists.
 *
 * ── What is built, and why each piece ───────────────────────────────────────
 *
 *  1. A CYCLORAMA, not a flat wall. The portrait yaws +/-22 degrees, so a flat
 *     backdrop's horizon would slide up and down the frame across the sway and every
 *     number measured off it would be sway-dependent. A cylinder centred on the
 *     subject is rotationally symmetric: the horizon sits at the same height at every
 *     yaw, which makes the acceptance numbers stable AND is what a real photographic
 *     cove is.
 *  2. A FLOOR THE DISC TERMINATES AGAINST. The old fog existed only to hide the
 *     ground disc's own edge. With a wall to stop against there is nothing to hide,
 *     so the fog is gone and the horizon is a real geometric edge between two lit
 *     surfaces instead of a smooth fade into the clear colour.
 *  3. A REAL CAST SHADOW plus a grounding decal. The key already threw a shadow; on a
 *     near-white floor it was invisible. On this floor it reads, and a soft radial
 *     MULTIPLY decal under the podium adds the tight contact the long cast shadow
 *     cannot give (multiply keeps the floor's hue and takes only value, which is what
 *     a shadow on a saturated surface does — a black wash goes grey).
 *  4. A PODIUM WITH A REAL INSET: a tapered body, an overhanging rim, and a gold top
 *     face recessed inside it. The reference plates that beat us all put their hero on
 *     something built rather than on a coloured disc.
 *
 * ── The value structure is authored as a table, not by eye ──────────────────
 * `CYC_VALUE` and `FLOOR_VALUE` below are vertex-colour multipliers over an albedo.
 * They exist as tables because three separate acceptance numbers depend on the same
 * few values and they have to be balanced against each other rather than tuned one at
 * a time:
 *
 *   * FIGURE/GROUND polarity wants the wall dark BEHIND THE HEAD.
 *   * `home_metrics`'s value break wants the head band brighter than the lower
 *     corners — so the near floor has to be darker still.
 *   * The horizon step wants a real discontinuity where they meet.
 *
 * The wall also renders at roughly 0.6x the floor for the same albedo, because the
 * key sits 30 degrees above the horizon: a floor normal collects 0.50 of it and the
 * cyclorama's back panel collects 0.24. That factor is why the wall's authored colour
 * is LIGHTER than the floor's and still renders darker.
 */

import * as THREE from 'three';
import { Stage } from '../../render/stage';
import { createCharacter } from '../../characters/registry';
import type { CharacterModel } from '../../characters/types';
import { CHARACTER_HEIGHT } from '../../units';
import { toonMat, RAMP_SOFT } from '../../render/toon';
import type { CharacterId } from '../../game/rules';

/**
 * Clear colour behind the set.
 *
 * The cyclorama covers the whole frame at every aspect the menus produce, so this is
 * only ever seen as a sliver — but it is also what the consuming screens paint as the
 * canvas's CSS background for the frame before WebGL first presents, and what
 * `opening.ts` fades its masked ellipse into. Keyed to the wall so a seam cannot show.
 */
// WAS `0x1d5a80` / `'#1d5a80'` until the palette-hierarchy pass. Kept visible per house
// style: the value is not arbitrary, it is KEYED TO THE WALL so no seam can show, so it
// has to move whenever `CYC_COLOR` moves. It is a slightly lighter, slightly bluer
// relative of the wall albedo, and it stays that.
const PORTRAIT_BG = 0x2f5266;
/** The same colour as a CSS string, so no screen has to re-type the hex. */
export const PORTRAIT_BG_CSS = '#2f5266';

/**
 * Cyclorama albedo. Lighter than the floor on purpose — see the header note on the
 * 0.6x factor.
 *
 * ── WAS `#1D5576`, AND THE REASON GIVEN FOR IT HAS BEEN MEASURED FALSE HERE ──────
 * The old comment read: *"Deliberately a saturated azure rather than a desaturated one:
 * `docs/LESSONS.md` §8 measured that the reference reserves HUE, not saturation, and
 * that adding COOL chroma lowers the warm band's share more cheaply than removing warm
 * chroma does. This stage is now the largest cool surface in the menus."* Kept above
 * the change, per house style, because it is still true about the ARENA'S warm/cool
 * budget and was simply never a statement about THIS frame's hierarchy.
 *
 * `tools/tmp/pc_pal.mjs --lobby` split this panel by element class and the reserved
 * set came last on both metrics it reports:
 *
 *              area%   meanS   meanC        the character is the LEAST saturated
 *   backdrop   41.0    0.963   0.463        thing in its own frame, and the plinth
 *   ground     30.9    0.960   0.458        OUT-CHROMAS the subject it exists to
 *   props      12.1    0.911   0.645        present, 0.645 against 0.442, wearing
 *   characters 15.8    0.688   0.442        the character's own hue band (34 vs 40)
 *
 * "the largest cool surface in the menus" was the whole problem: it was also the
 * loudest. 41% of the panel at meanC 0.463 is not a backdrop, it is a second subject.
 *
 * ── WHAT MOVED, AND WHAT DELIBERATELY DID NOT ───────────────────────────────────
 * CHROMA came down; HUE and VALUE did not. `tools/tmp/lp_sweep.mjs` ran a 9-rung
 * saturation x value grid in one page load (rendered figures, not authored ones):
 *
 *   authored          wall meanS  meanC  meanL     home_metrics blue-field pass
 *   #1D5576 shipped      0.963    0.463  0.240     96.2%
 *   #2C3F49 S25/L23      0.690    0.205  0.149     24.5%   <- WOULD HAVE BROKEN IT
 *   #364C59 S25/L28      0.716    0.285  0.200     76.5%
 *   #2E4E60 S35/L28      0.866    0.354  0.204     88.2%   <- shipped
 *   #275068 S45/L28      0.928    0.401  0.216     90.9%
 *
 * 🚨 AND THE FIRST TWO COLUMNS DISAGREE, WHICH IS THE POINT. Rendered HSL saturation
 * on this wall is NOT independently controllable from its value: `s = d/(max+min)` and
 * the tone curve crushes the wall's red channel to ~2/255 at any luma it is usable at,
 * so a near-black navy and an electric azure both score ~0.9. Every rung that pulled
 * `meanS` under the character's 0.688 did it by going nearly black (meanL 0.149), and
 * that is not "muted", it is unlit. CHROMA behaves properly and is what the eye reads
 * as colourfulness, so chroma is what this was tuned on — stated here because the
 * census's headline number ("93.3% of the panel above s >= 0.60") is measured on the
 * saturation that does NOT behave, and reading it as "the panel is garish" is wrong.
 *
 * 🚨 THE VALUE WAS HELD ON PURPOSE. Desaturating a dark blue by lifting its red
 * channel RAISES its luma — the ladder's grey rungs took the wall from meanL 0.240 to
 * 0.408 — and luma is exactly what the figure/ground polarity in this file's header is
 * made of. A washed-out wall would have traded the defect for the one `docs/LESSONS.md`
 * §13 already paid to fix. At `#2E4E60` the wall renders meanL 0.204 against the
 * character's 0.474: polarity +0.270, BETTER than the +0.234 it replaced.
 *
 * 🚨 AND THE BLUE-FIELD COLUMN IS NOT DECORATION. `home_metrics.mjs` only counts a
 * pixel as backdrop at `b > r+20 && b >= 70 && g > r`, and the two darkest rungs drop
 * 75% of the wall out of its own metric — the trap the floor's comment below has warned
 * about since it was written, hit for real by a candidate that measured beautifully on
 * everything else. It was pre-screened offline on the sweep PNGs before any constant
 * moved.
 */
const CYC_COLOR = '#2E4E60';
/** Floor albedo — deeper than the wall, so the horizon separates two materials rather
 *  than two brightnesses of one.
 *
 *  Both of these were CHOSEN BY SWEEP, not by eye: `stage_fg.mjs --sweep` retints
 *  `menu_wall` and `menu_ground` in-page across a ladder of candidates against one
 *  fixed silhouette mask, so eight albedo pairs cost one page load instead of eight.
 *  The ladder was monotone and the polarity it produced is the whole reason these are
 *  the numbers they are:
 *
 *    3C9CCE : 186A8E    surround 0.412   polarity +0.065
 *    2F7CA9 : 135871    surround 0.346   polarity +0.130
 *    236287 : 0F4658    surround 0.292   polarity +0.183
 *    1D5576 : 0D3D4B    surround 0.268   polarity +0.207   <- shipped, bluer floor
 *
 *  against the shipped match's body 0.541 / frame 0.325 / polarity +0.216.
 *
 *  The floor is not the swept `0D3D4B` on purpose: the same luma with the blue channel
 *  24 points higher. `home_metrics.mjs` identifies a backdrop pixel as b > r+20 AND
 *  b >= 70 AND g > r, and at this value a teal floor sits within a few counts of that
 *  threshold — a floor that measures correctly today and drops out of its own metric on
 *  the next character is not a floor, it is a trap. Deeper blue also spends HUE rather
 *  than VALUE, which is the direction `docs/LESSONS.md` §8 says is cheaper.
 *
 *  ⚠️ THAT PARAGRAPH NAMED A COLOUR THIS FILE HAS NEVER HELD. It read *"the floor is
 *  `0B3F63`"* while the constant below said `093F73` — two hex strings, transposed
 *  digits, and the prose one is not in the tree and never was. Nothing checks a colour
 *  quoted inside a comment, which is exactly why it sat there. The rule the paragraph
 *  states is real and load-bearing and it caught a candidate during this pass; the
 *  literal was noise. Removed rather than corrected — the constant is one line below
 *  and cannot drift from itself.
 *
 *  ── WAS `#093F73` until the palette-hierarchy pass ─────────────────────────────
 *  Same reasoning as `CYC_COLOR` above, same ladder, same rendered-not-authored
 *  figures: meanC 0.458 -> 0.275, meanS 0.960 -> 0.785, meanL 0.240 -> 0.184. It stays
 *  DEEPER than the wall, which is what makes the horizon a boundary between two
 *  materials instead of two brightnesses of one, and it stays comfortably inside
 *  `home_metrics`'s blue-field test. */
const FLOOR_COLOR = '#284053';

/**
 * The podium, and it used to be GOLD: `#8A4E15` / `#C07A23` / `#F4C55E`.
 *
 * 🚨 IT WAS THE SINGLE LOUDEST OBJECT IN THE FRAME AND IT WEARS THE HERO'S OWN HUE.
 * `pc_pal --lobby` measured the plinth at meanC 0.645 against the character's 0.442, at
 * hue 34 deg against the character's 40 — six degrees apart. A podium exists to PRESENT
 * a subject; this one out-chromaed it by half again and did so in the same colour, so
 * the hero's feet and legs dissolved into the thing they were standing on. That is not
 * a saturation problem, it is a figure/ground problem wearing a saturation costume, and
 * it is the largest single item in Uri's *"nothing leads and nothing recedes"*.
 *
 * So the podium moved OUT of the accent band entirely and into the room's own hue
 * family: cool stone, hue 200 deg, meanC 0.269. Measured on `lp_sweep`'s plinth-only
 * rungs, which change nothing else in the scene:
 *
 *                        props meanC   props hue   subject leads on chroma?
 *   gold, shipped            0.645        34         no  — plinth leads by 0.203
 *   warm stone `#6B5F52`     0.277        36         yes — but 3 deg of hue separation
 *   cool stone, this         0.269       200         yes — 160 deg of hue separation
 *
 * The warm-stone rung is kept in that table because it is the tempting one: it fixes
 * the chroma number completely and leaves the hue collision exactly where it was. Two
 * things were wrong and only one of them was about how loud the podium is.
 *
 * VALUE WAS SPENT RATHER THAN SAVED. The top face renders at meanL 0.478 — brighter
 * than the character's 0.474 — so the hero still stands on a lit stage and the feet
 * still read against it. What changed is that the stage is no longer competing for the
 * same hue: it separates by VALUE and by HUE now instead of by chroma.
 */
const PEDESTAL_BODY = '#3F5462';
const PEDESTAL_RIM = '#6D8290';
const PEDESTAL_TOP = '#9FB1BE';

/** Radius of the cyclorama, in metres.
 *
 *  This is a COMPOSITION number and it was solved, not guessed. At the portrait rig's
 *  20 degree pitch and 34 degree FOV the camera sits ~7.4 m from the subject, so the
 *  cylinder's base circle projects to roughly 44% of the panel's height from the top —
 *  which puts the horizon behind the character's waist, the wall behind its head, and
 *  the floor under its feet. Pushing the wall further back LOWERS the horizon and
 *  turns the panel into mostly floor; pulling it closer raises it until the character
 *  overlaps the top edge. It is also just outside the 4.68 m the tallest fighter's own
 *  cast shadow reaches, so the shadow stays ON the floor and does not climb the wall.
 */
const CYC_RADIUS = 5.0;
const CYC_HEIGHT = 14;
/** The cove starts below the floor so no seam can open at the horizon. */
const CYC_BASE_Y = -0.6;

/** Vertex-colour multiplier on the cyclorama, as [worldY, multiplier] pairs. */
const CYC_VALUE: Array<[number, number]> = [
  [-0.6, 0.86],
  [0.0, 0.88],
  [1.2, 0.94],
  [2.6, 1.02],
  [3.8, 1.16],
  [8.0, 1.40],
  [14.0, 1.55],
];

/**
 * Azimuth compensation on the cove, and it is a MEASURED correction rather than a look.
 *
 * `tools/tmp/setprobe.mjs` sampled the first build of this set and found the cove
 * rendering at luma 0.608 on the left of the frame and 0.216 on the right — a 2.8x
 * range across one continuous surface, because the key sits at azimuth (16.35, 4.69)
 * and a cylinder's normals sweep through the whole dot-product range. Two problems with
 * that, one per acceptance number: the bright side was BRIGHTER than the character
 * standing in front of it (0.47), which inverts figure/ground on that whole flank, and
 * the dark side was heading for the blue-channel floor `home_metrics` needs to
 * recognise a pixel as backdrop at all.
 *
 * A painted cyclorama is the standard answer and it is what these two numbers are: the
 * albedo is authored DARKER where the key hits hardest and lighter where it does not,
 * which compresses the range without touching the lighting rig (`src/render/lighting.ts`
 * is not this file's to change, and `docs/LESSONS.md` §3 records a measured sweep
 * showing rim/key retunes are worth at most +0.012 of figure/ground anyway). It keeps
 * the direction — the cove is still visibly lit from one side — and gives up the part
 * of it that was beating the hero.
 */
const CYC_AZIMUTH_SHADE = 1.30;
const CYC_AZIMUTH_LIT = 0.52;
/** Direction to the key, from `src/render/lighting.ts`. Only the horizontal part is
 *  used: a cylinder wall's normal has no vertical component. */
const KEY_DIR = new THREE.Vector3(16.35, 9.82, 4.69).normalize();

/** Vertex-colour multiplier on the floor, as [radius, multiplier] pairs.
 *
 *  Darkest at the podium and brightening toward the horizon. That ordering is not
 *  decoration: it is what makes the warm podium sit in the darkest part of the frame
 *  (maximum separation exactly where the eye goes), it darkens the panel's lower
 *  corners so the value break stays positive against the wall behind the head, and it
 *  puts the floor's brightest band right where it meets the cove — the read every hero
 *  podium in the reference set uses. */
const FLOOR_VALUE: Array<[number, number]> = [
  [0.0, 0.58],
  [1.5, 0.62],
  [2.6, 0.88],
  [3.8, 1.16],
  [4.7, 1.36],
  [6.4, 1.42],
];

/** Height of the podium's rim, in metres — the top of the whole assembly. */
const PLINTH_H = 0.24;
/** Where the feet actually land: the recessed top face, inside the rim. */
const PLINTH_TOP_Y = 0.215;
/** Fraction of the frame's HEIGHT the subject fills when height is the binding axis. */
const V_FILL = 0.62;
/** Widest part of the podium, in metres — it has to be framed too.
 *  UNCHANGED at 2.48 deliberately: `applyFraming` fits `max(subjectW, PLINTH_BASE_W)`,
 *  so widening the podium would shrink every character.
 *
 *  ⚠️ The reason given here used to be *"and character width over panel width is an
 *  acceptance number (`menu_accept`, floor 0.42)"*. It is not, any more: that assertion
 *  measured a function of the PANEL'S ASPECT rather than of the hero, and it refused the
 *  reference plate's own composition. It now asserts the HEIGHT fraction, floor 0.47,
 *  derived from `bs_home`'s measured 0.486. The constant still matters — widening the
 *  podium past a character's own width makes `fillFromWidth` bind and shrinks the hero on
 *  BOTH axes, which the new assertion catches — but for a different reason than written. */
const PLINTH_BASE_W = 2.48;
/** Fraction of the frame's WIDTH the subject may fill when width is binding. */
const H_FILL = 0.86;

/** Sample a [key, value] ramp with smooth interpolation between stops. */
function rampAt(table: Array<[number, number]>, x: number): number {
  if (x <= table[0][0]) return table[0][1];
  const last = table[table.length - 1];
  if (x >= last[0]) return last[1];
  for (let i = 1; i < table.length; i++) {
    const [x1, v1] = table[i];
    const [x0, v0] = table[i - 1];
    if (x > x1) continue;
    const t = (x - x0) / Math.max(1e-6, x1 - x0);
    return v0 + (v1 - v0) * (t * t * (3 - 2 * t));
  }
  return last[1];
}

/**
 * A soft radial falloff as a texture, WHITE at the rim and dark in the middle.
 *
 * Used with `THREE.MultiplyBlending`, so white is a no-op and the middle takes value
 * out of whatever is underneath. That is deliberately not an alpha fade: multiply
 * ignores alpha, and a flat black ellipse at 34% opacity over a saturated floor goes
 * GREY — the previous version of this shadow did exactly that and greyed the podium it
 * was supposed to be grounding.
 */
function radialShadowTexture(core: [number, number, number], px = 128): THREE.Texture {
  const canvas = document.createElement('canvas');
  canvas.width = px;
  canvas.height = px;
  const ctx = canvas.getContext('2d');
  if (ctx) {
    const g = ctx.createRadialGradient(px / 2, px / 2, 0, px / 2, px / 2, px / 2);
    const [r, gc, b] = core;
    const toward = (t: number) =>
      `rgb(${Math.round(r + (255 - r) * t)},${Math.round(gc + (255 - gc) * t)},${Math.round(b + (255 - b) * t)})`;
    // The plinth's own base covers the inner ~54% of this square, so the falloff has
    // to still be dark where it EMERGES from under the object. A gradient that has
    // spent most of its range by then draws a shadow nobody can see — which is the
    // whole of `docs/LESSONS.md` §1 in one line.
    g.addColorStop(0, toward(0));
    g.addColorStop(0.54, toward(0.10));
    g.addColorStop(0.80, toward(0.58));
    g.addColorStop(1, 'rgb(255,255,255)');
    ctx.fillStyle = g;
    ctx.fillRect(0, 0, px, px);
  }
  const tex = new THREE.CanvasTexture(canvas);
  // NOT sRGB. Multiply blending happens against the composer's LINEAR HalfFloat
  // buffer, so these bytes are wanted as linear multipliers directly; decoding them
  // from sRGB first would square the darkening and crush the floor to near black.
  tex.colorSpace = THREE.NoColorSpace;
  tex.wrapS = THREE.ClampToEdgeWrapping;
  tex.wrapT = THREE.ClampToEdgeWrapping;
  return tex;
}

/**
 * A flat, multiply-blended decal.
 *
 * ⚠️ `THREE.MultiplyBlending` IS NOT USED HERE, AND THAT IS DELIBERATE. In three r180
 * `WebGLState.setBlending` refuses it outright unless `premultipliedAlpha` is also set:
 *
 *     case MultiplyBlending:
 *       console.error( 'THREE.WebGLState: MultiplyBlending requires
 *                       material.premultipliedAlpha = true' );
 *
 * It does not throw and it does not fall back — it logs to the console and leaves
 * whatever blend function the previous draw call set. The first render of this set came
 * back with a white floor and two visible white quadrilaterals: the decals drawing
 * their own texture opaquely, over the thing they were supposed to darken. That is
 * `docs/LESSONS.md` §1 with the sign flipped — not invisible, but present and doing the
 * opposite of its job — and the only reason it was caught in one pass rather than five
 * is that the failure was looked at and then probed instead of reasoned about.
 *
 * `CustomBlending` states the same equation explicitly (dst * src, alpha untouched) and
 * cannot be silently declined.
 *
 * Two other flags that are not optional, both also §1:
 *  * `depthWrite: false` — transparent materials that still write depth silently
 *    occlude whatever is behind them. Every transparent material in the cast carries
 *    `depthWrite: true` today; this one does not.
 *  * `transparent: true` — this is what puts the mesh in the TRANSPARENT queue.
 *    Without it three sorts it with the opaques, front-to-back, and a multiply decal
 *    drawn before the surface it darkens multiplies against the clear colour instead.
 */
function shadowDecal(size: number, core: [number, number, number], order: number): THREE.Mesh {
  const mat = new THREE.MeshBasicMaterial({
    map: radialShadowTexture(core),
    blending: THREE.CustomBlending,
    blendEquation: THREE.AddEquation,
    blendSrc: THREE.ZeroFactor,
    blendDst: THREE.SrcColorFactor,
    blendEquationAlpha: THREE.AddEquation,
    blendSrcAlpha: THREE.ZeroFactor,
    blendDstAlpha: THREE.OneFactor,
    transparent: true,
    depthWrite: false,
    toneMapped: false,
  });
  const mesh = new THREE.Mesh(new THREE.PlaneGeometry(size, size), mat);
  mesh.rotation.x = -Math.PI / 2;
  mesh.renderOrder = order;
  mesh.userData.noOutline = true;
  return mesh;
}

/**
 * ═══════════════════════════════════════════════════════════════════════════
 * THE LOBBY SET — a room, because the lobby was a backdrop
 * ═══════════════════════════════════════════════════════════════════════════
 *
 * Uri, after looking at the build: *"I've had a look at the Home Screen and menus and we
 * need to do a better job there. Looks amateurish."* and then, when asked: *"Perhaps we
 * should also create a background image or even better a background 3d world."*
 *
 * Measured, the lobby was **46.8% featureless** by `tools/tmp/hm_lang.mjs` — 12x12 tiles
 * whose luma stdev is under 2.5 — against our own character select's 30.4 and a Brawl
 * Stars plate's 31.5. The single biggest contributor was a flat CSS gradient, and
 * `home.ts` has replaced that with a room; this is the half of it that has to be
 * geometry, because `Stage` clears to an OPAQUE colour and anything a screen paints
 * behind the canvas is `docs/LESSONS.md` §1 in its purest form.
 *
 * ── Why it is a MODE and not just added to the set ──────────────────────────
 * This stage is a **singleton shared by three screens**. Character select scores 7.00 —
 * the best menu in the build — and the title card was re-framed against this exact cove
 * only a few rounds ago (`opening.ts`'s 54vh sweep). Dressing the shared set would have
 * changed both of them without either being measured. `setScene('lobby')` is called by
 * `home.ts` on mount and reset on dispose, so the room is opt-in and the two screens
 * that were judged against the plain cove keep it.
 *
 * ── Why these albedos, and why NOT a blur ───────────────────────────────────
 * The reference plate throws its background out of focus. We have no cheap DOF here, and
 * the honest substitute is the one this file already uses on the cove: author the value
 * so the background sits BELOW the hero. `docs/LESSONS.md` §13 records that the menus
 * used to show every fighter as a dark shape on a bright field (polarity -0.234) while
 * the game shows the opposite, and that the set fixed it to +0.188. A bright prop wall
 * behind the head would spend that straight back. So every colour below is a food or
 * kitchen hue at a DEEP value — chroma kept, value spent — which is also the direction
 * `docs/LESSONS.md` §8 measured as cheaper than removing warm chroma. Nothing here is
 * desaturated; that has been falsified four times on this project.
 *
 * ── The cost, because home is the first screen on a phone ───────────────────
 * 17 meshes, 6 materials, no instancing, no shadow casting except the counter. Measured
 * with `tools/perf.mjs --mode counts --scene home`; the number is in the commit message.
 * The obvious cheaper-looking idea — reuse `createKitchenArena()` — is a trap: it is a
 * 1400x1000 wu LAYOUT at ~1700 draw calls, more than a live match, and its scale is
 * world units where this scene is metres.
 */

/** Deep, saturated kitchen palette. Value spent, chroma kept — see the note above. */
const LOBBY = {
  counterBody: '#123A50',
  counterTop: '#A8641F',
  counterLip: '#D08A2E',
  shelf: '#7A431A',
  steel: '#24485C',
  jars: ['#B02733', '#4E8A12', '#C99414', '#1668A8', '#6B3AA8', '#B85A18', '#2E8C6A', '#C4553C'],
} as const;

export interface CharacterStage {
  /** Move the canvas into `host` (and size to it). Safe to call repeatedly. */
  attachTo(host: HTMLElement): void;
  /**
   * Which set is dressed behind the hero.
   *
   * `'portrait'` is the plain cove every character was authored and critiqued against,
   * and it is the DEFAULT — character select and the title card never call this.
   * `'lobby'` adds the kitchen. Idempotent; the geometry is built once and then only
   * shown or hidden, so bouncing home -> characters -> home costs nothing.
   */
  setScene(mode: 'portrait' | 'lobby'): void;
  /** Remove the canvas from the DOM without destroying the GL context. */
  detach(): void;
  /** Swap the displayed character. No-op if already showing `id`. */
  show(id: CharacterId): void;
  /** One-shot attack animation — the menu's "tap the mascot" easter egg. */
  poke(): void;
  /** Advance animation and render. Driven by whichever screen owns the stage. */
  update(dtSeconds: number): void;
  resize(): void;
  /** QA-only framing readout. See the implementation. */
  info(): Record<string, unknown>;
  dispose(): void;
}

class MenuCharacterStage implements CharacterStage {
  private readonly stage: Stage;
  private readonly holder = document.createElement('div');
  private model: CharacterModel | null = null;
  private currentId: CharacterId | null = null;
  /** Measured bounds of the mounted model, in metres. Drives `applyFraming`. */
  private subjectW = CHARACTER_HEIGHT * 0.8;
  private subjectH = CHARACTER_HEIGHT;
  private elapsed = 0;
  /** Seconds remaining on the entrance pop; drives a short scale-in on swap. */
  private introT = 0;
  private observer: ResizeObserver | null = null;
  private footShadow: THREE.Mesh | null = null;
  private disposed = false;
  /** The kitchen, built on first `setScene('lobby')` and then only toggled. */
  private dressing: THREE.Group | null = null;

  constructor() {
    // A holder the Stage can measure. The Stage appends its canvas here and reads
    // clientWidth/Height off it on every resize, so it must be a real sized box.
    this.holder.style.cssText = 'position:absolute;inset:0;';

    this.stage = new Stage({
      container: this.holder,
      background: PORTRAIT_BG,
      // NO FOG. It existed only to fade the ground disc into the clear colour before
      // the disc's own edge was reached, because there was nothing for the floor to
      // end against. The cyclorama is that thing, and fog over it would soften the
      // one hard edge the set is built to produce.
      fog: null,
      camera: {
        pitchDeg: 20,
        yawDeg: 0,
        frameMode: 'subject',
        subjectHeight: CHARACTER_HEIGHT,
        subjectFill: 0.60,
        targetHeight: CHARACTER_HEIGHT * 0.52,
        followLerp: 1,
      },
      // ── THE MENU IS NOT A MATCH, AND IT WAS PAYING A MATCH'S PIXEL BUDGET ────
      // `quality.ts`'s `pixelRatioCap` (1.25 on `low`) was derived entirely from the
      // match frame — six fighters, the arena, hazards, the full post chain, ~5.7x
      // measured overdraw. THIS Stage draws one character, a cove and a podium into a
      // panel. None of that reasoning describes it, so it now asks for the tier's MENU
      // ceiling instead. Measured on an emulated iPhone 15 Pro (393x852 CSS,
      // deviceScaleFactor 3, `tools/tmp/mdpr_probe.mjs`):
      //
      //   character portrait   458x202 -> 734x324   into a 1101x487 device box
      //   home portrait        452x823 -> 724x1318  into a 1085x1977 device box
      //     i.e. 0.416x linear and 17.3% of native  ->  0.666x and 44.4%
      //
      // ⚠️ **NOT A REGRESSION FIX.** 1.25 is bit-identical in every bundle Uri has ever
      // loaded, including the one he called smooth. A constant cannot regress. It is
      // the largest measured defect in the frame he named, which is a different claim.
      //
      // `maxPixelRatio: 2` below STAYS, and with this line it becomes the BINDING term
      // of `Stage.effectivePixelRatio`'s `min` on a DPR-3 phone — exactly what
      // `StageOptions.maxPixelRatio` documents itself as being for. Deleting it would
      // not "unlock" DPR 3; it would remove the only ceiling scoped to this panel.
      budget: 'menu',
      maxPixelRatio: 2,
    });
    this.stage.canvas.style.cssText = 'display:block;width:100%;height:100%;';

    this.buildSet();
    this.stage.rig.snapTo(0, 0);
    // 6 m, not 5: the tallest fighter's own cast shadow reaches 4.68 m from the origin
    // at the key's 30 degree elevation, and a shadow frustum that ends at 5 clips the
    // tip of it. 1024 texels across 12 m is 85 texels/m — nearly triple the shipped
    // match's 30.1, so the extra metre costs nothing that can be seen.
    this.stage.lighting.focus(0, 0, 6);
  }

  /**
   * The set: cove, floor, podium, grounding.
   *
   * Order matters for the two multiply decals — they must draw AFTER the surface they
   * darken and BEFORE the podium, or they multiply against the wrong thing.
   */
  private buildSet(): void {
    // ── The cove ─────────────────────────────────────────────────────────────
    // Open-ended cylinder seen from the inside. Vertex colours carry the vertical
    // value ramp and `material.color` carries the hue, so a colour sweep can retint
    // the whole wall without rebuilding the gradient (which is exactly how the albedo
    // below was chosen — `tools/tmp/stage_fg.mjs --sweep`).
    const cycGeo = new THREE.CylinderGeometry(CYC_RADIUS, CYC_RADIUS, CYC_HEIGHT, 72, 28, true);
    this.paintVertexRamp(cycGeo, (x, y, z) => {
      // Inward normal of a cylinder wall is (-x, 0, -z)/R, so this is its dot with the
      // key. Clamped at 0: the unlit half is already at the shade end of the ramp.
      const lit = THREE.MathUtils.clamp(-(x * KEY_DIR.x + z * KEY_DIR.z) / CYC_RADIUS, 0, 1);
      return rampAt(CYC_VALUE, y + CYC_HEIGHT / 2 + CYC_BASE_Y)
        * (CYC_AZIMUTH_SHADE + (CYC_AZIMUTH_LIT - CYC_AZIMUTH_SHADE) * lit);
    });
    const cycMat = toonMat({ color: CYC_COLOR, ramp: RAMP_SOFT(), roughness: 0.9, rim: false });
    cycMat.side = THREE.BackSide;
    cycMat.vertexColors = true;
    const cyc = new THREE.Mesh(cycGeo, cycMat);
    cyc.position.y = CYC_HEIGHT / 2 + CYC_BASE_Y;
    cyc.receiveShadow = true;
    cyc.userData.noOutline = true;
    cyc.name = 'menu_wall';
    cyc.renderOrder = -1;
    this.stage.scene.add(cyc);

    // ── The floor ────────────────────────────────────────────────────────────
    // A RING and not a CIRCLE: `CircleGeometry` has exactly two distinct radii (the
    // centre vertex and the rim), so a radial vertex gradient across it is impossible.
    // 32 radial segments out to 6.4 m gives a stop every 20 cm, which is smooth at
    // this framing and still only ~3k triangles.
    const floorGeo = new THREE.RingGeometry(0, 6.4, 96, 32);
    this.paintVertexRamp(floorGeo, (x, y) => rampAt(FLOOR_VALUE, Math.hypot(x, y)));

    const floorMat = toonMat({ color: FLOOR_COLOR, ramp: RAMP_SOFT(), roughness: 0.86, rim: false });
    floorMat.vertexColors = true;
    const floor = new THREE.Mesh(floorGeo, floorMat);
    floor.rotation.x = -Math.PI / 2;
    floor.receiveShadow = true;
    floor.userData.noOutline = true;
    floor.name = 'menu_ground';
    this.stage.scene.add(floor);

    // ── Grounding under the podium ───────────────────────────────────────────
    // The key's cast shadow says "something is over there"; this says "this object is
    // standing HERE". Both blind critics independently called the hero out as
    // floating, and the earlier fix put its contact patch on the podium's TOP face
    // only — under the feet, where it grounds the character to the podium and leaves
    // the podium itself grounded to nothing.
    //
    // The core is a DEEP BLUE and not a neutral grey, and that is two decisions at
    // once. Physically it is what a shadow on a blue floor under a warm key actually
    // is: the key is the thing being blocked, so what is left is the cool fill and the
    // sky, and the surface goes bluer as it goes darker. Practically it is the only way
    // this shadow can be MEASURED. `home_metrics.mjs` only counts a pixel as backdrop
    // if b > r+20 AND b >= 70 AND g > r, so a neutral multiply drags the darkest part
    // of the shadow straight out of the metric's own sample — the harder the shadow, the
    // fewer of its pixels get counted, and the number goes DOWN as the thing improves.
    // Keeping blue high while dropping red and green takes luma out (multiplier 0.21
    // against a neutral core's 0.26) and leaves every pixel of it inside the definition.
    // The exact blue matters and it was tuned against the metric, not by eye. At core
    // blue 132 the shadowed floor arrived at b ~= 53 and `home_metrics` discarded every
    // one of those pixels; at 160 it arrives at ~74 and they all count. The measured
    // contact darkening moved 35.9% -> 37.2% -> 39.5% across that change, with the
    // shadow getting DARKER each time. A metric that silently stops seeing the
    // thing it measures is worse than no metric, so the fix is to stay inside its
    // definition rather than to argue with it.
    const ground = shadowDecal(5.4, [18, 32, 160], 1);
    ground.position.y = 0.012;
    ground.name = 'menu_ground_decal';
    this.stage.scene.add(ground);

    // ── The podium ───────────────────────────────────────────────────────────
    // Three pieces, because the thing the reference has and a coloured disc does not
    // is an INSET: an overhanging rim with a top face recessed inside it, so the rim
    // casts a hairline of its own shadow onto the face and the whole object reads as
    // built rather than as a cylinder.
    const body = new THREE.Mesh(
      new THREE.CylinderGeometry(1.15, 1.24, 0.18, 48),
      toonMat({ color: PEDESTAL_BODY, ramp: RAMP_SOFT(), roughness: 0.72 }),
    );
    body.position.y = 0.09;
    body.castShadow = true;
    body.receiveShadow = true;
    body.userData.noOutline = true;
    body.name = 'menu_plinth_body';
    this.stage.scene.add(body);

    // ⚠️ The rim is an OPEN cylinder plus a flat annulus, and that is not a modelling
    // preference. A solid `CylinderGeometry` occupies every radius from 0 outward, so a
    // solid rim spanning y 0.18..0.24 would have swallowed the gold face at 0.215
    // entirely — rendered perfectly, zero pixels delivered, which is `docs/LESSONS.md`
    // §1 case 5 (Sushi's maki roll inside the default torso barrel) rebuilt from
    // scratch. The recess has to be genuinely OPEN for the face to be seen through it.
    const rimMat = toonMat({ color: PEDESTAL_RIM, ramp: RAMP_SOFT(), roughness: 0.55 });
    const rimWall = new THREE.Mesh(
      new THREE.CylinderGeometry(1.21, 1.19, 0.06, 48, 1, true),
      rimMat,
    );
    rimWall.position.y = PLINTH_H - 0.03;
    rimWall.castShadow = true;
    rimWall.receiveShadow = true;
    rimWall.userData.noOutline = true;
    rimWall.name = 'menu_plinth_rim';
    this.stage.scene.add(rimWall);

    const rimTop = new THREE.Mesh(new THREE.RingGeometry(1.10, 1.21, 48), rimMat);
    rimTop.rotation.x = -Math.PI / 2;
    rimTop.position.y = PLINTH_H;
    rimTop.receiveShadow = true;
    rimTop.userData.noOutline = true;
    // NAMED, and the name is the only reason it is measurable. Every diagnostic that
    // splits this frame by element class keys on the ancestry path: `tools/tmp/pc_pal.mjs`
    // matches `menu_plinth` for the PROPS class. These two meshes shipped anonymous, so
    // `pc_pal --tree` reported them as "UNCLASSIFIED AND VISIBLE" and their pixels went
    // into no class and no total — the plinth was measured with two of its five pieces
    // missing. An unnamed mesh is not a small omission in a name-keyed instrument; it is
    // invisible to it, which is the same failure mode as the one the census exists to find.
    rimTop.name = 'menu_plinth_rim_top';
    this.stage.scene.add(rimTop);

    // The wall of the recess itself — 2.5 cm of it, from the gold face up to the rim.
    // This is the piece that makes the gap read as an inset rather than as a colour
    // change, because it catches a different amount of the key than either surface it
    // joins. `doubleSide` because the camera looks INTO it from above.
    const recess = new THREE.Mesh(
      new THREE.CylinderGeometry(1.10, 1.10, PLINTH_H - PLINTH_TOP_Y, 48, 1, true),
      toonMat({ color: PEDESTAL_BODY, ramp: RAMP_SOFT(), roughness: 0.8, doubleSide: true }),
    );
    recess.position.y = (PLINTH_H + PLINTH_TOP_Y) / 2;
    recess.receiveShadow = true;
    recess.userData.noOutline = true;
    recess.name = 'menu_plinth_recess';   // see the note on `rimTop.name` above
    this.stage.scene.add(recess);

    // The face the hero stands on. Deliberately deep enough to overlap the body below
    // it — a disc would leave a 3.5 cm gap at radii under 1.15 that a low sway angle
    // could see straight through.
    const top = new THREE.Mesh(
      new THREE.CylinderGeometry(1.10, 1.10, 0.05, 48),
      toonMat({ color: PEDESTAL_TOP, ramp: RAMP_SOFT(), roughness: 0.45 }),
    );
    top.position.y = PLINTH_TOP_Y - 0.025;
    top.receiveShadow = true;
    top.userData.noOutline = true;
    top.name = 'menu_plinth_top';
    this.stage.scene.add(top);

    // Contact under the FEET, on the podium's face. Warm core so it multiplies the
    // gold down in value without pulling it toward grey.
    // WAS `[92, 62, 30]` — a warm brown core, chosen when the face under it was gold so
    // that the multiply took VALUE without pulling the gold toward grey. The face is
    // cool stone now, and a warm multiply over it would do the one thing the original
    // comment existed to prevent: shift the hue instead of the value. Same idea, same
    // luma, moved into the face's own hue family.
    const foot = shadowDecal(1.9, [44, 70, 88], 2);
    foot.position.y = PLINTH_TOP_Y + 0.004;
    foot.scale.set(1, 1, 0.72);
    foot.name = 'menu_foot_decal';
    this.footShadow = foot;
    this.stage.scene.add(foot);
  }

  /**
   * Write a per-vertex multiplier into a geometry's `color` attribute.
   *
   * `docs/LESSONS.md` §12 records `vertexColors = true` rendering an entire floor
   * SOLID BLACK — that was an `InstancedMesh` whose geometry had no `color` attribute
   * at all. Setting the flag is only safe alongside writing the attribute, which is
   * why the two always happen together here.
   *
   * The ramp is always evaluated in the geometry's LOCAL frame, before any rotation:
   * a `RingGeometry` is authored in XY and tipped into the floor afterwards, so its
   * radius is hypot(x, y), while the cylinder is already vertical and wants its own y.
   */
  private paintVertexRamp(
    geo: THREE.BufferGeometry,
    at: (x: number, y: number, z: number) => number,
  ): void {
    const pos = geo.attributes.position;
    const colors = new Float32Array(pos.count * 3);
    for (let i = 0; i < pos.count; i++) {
      const v = at(pos.getX(i), pos.getY(i), pos.getZ(i));
      colors[i * 3] = v;
      colors[i * 3 + 1] = v;
      colors[i * 3 + 2] = v;
    }
    geo.setAttribute('color', new THREE.BufferAttribute(colors, 3));
  }

  /**
   * Fit the subject to the panel on BOTH axes.
   *
   * `frameMode: 'subject'` only fits HEIGHT — which is correct for `preview.html`,
   * whose plates are tall (900x1100). A menu hero column is the opposite shape: at
   * 1600x900 the character-select hero slot is ~300x745, aspect 0.40, and fitting a
   * 2.5 m tall subject to 62% of that height puts its 2.3 m width straight off both
   * sides. Round 1 shipped exactly that and lost Hamburger's lettuce and tomato.
   *
   * So the vertical fill is capped by whatever the WIDTH can afford, using the
   * subject's own measured bounding box — which matters because the cast is not one
   * shape: Hot Dog is wider than it is tall, Water Bottle is the reverse, and a
   * single hand-picked fill cannot serve both.
   */
  private applyFraming(): void {
    const cam = this.stage.rig.camera;
    const aspect = cam.aspect > 0 && Number.isFinite(cam.aspect) ? cam.aspect : 1;
    // Frame the WHOLE assembly, podium included. Framing the character alone let the
    // podium run off the bottom edge on a wide panel, which reads as a cropped
    // photograph rather than as a hero on a stand.
    const h = Math.max(0.5, this.subjectH) + PLINTH_H;
    const w = Math.max(0.5, this.subjectW, PLINTH_BASE_W);

    // Vertical fill we would like, and the largest one whose implied visible WIDTH
    // still leaves the subject inside H_FILL of the frame horizontally.
    const fillFromWidth = (H_FILL * aspect * h) / w;
    this.stage.rig.subjectHeight = h;
    this.stage.rig.subjectFill = THREE.MathUtils.clamp(Math.min(V_FILL, fillFromWidth), 0.2, V_FILL);
    this.stage.rig.targetHeight = h * 0.5;
    this.stage.rig.apply();
  }

  /**
   * Build the kitchen, once.
   *
   * ⚠️ EVERYTHING HAS TO FIT INSIDE THE COVE. `CYC_RADIUS` is 5.0 m and the cylinder is
   * seen from the inside, so any prop at hypot(x, z) > 5 is OUTSIDE the wall and simply
   * does not exist as far as the camera is concerned — it would be culled by the
   * backdrop it is standing behind. The counter run is half-width 3.2 at z = -3.35,
   * which is hypot 4.63, and every jar on it is inside that.
   *
   * ⚠️ AND NOTHING HERE CASTS EXCEPT THE COUNTER. The shadow frustum is 12 m across at
   * 1024 texels and it is spent on the hero's own cast shadow, which is the one that
   * does grounding work. Eight jars each throwing a soft blob onto the wall behind them
   * would take texels off that and add nothing a viewer can name.
   */
  /**
   * A grout grid for the lobby floor, as an alpha texture.
   *
   * The floor is the single largest smooth surface the camera sees — after the room was
   * built around it, `tools/tmp/hm_lang.mjs` still put 36% of the frame in featureless
   * 12x12 tiles and most of what was left was this. A kitchen floor is tiled, so the
   * cheapest honest detail available is the true one.
   *
   * DARK LINES ONLY, on transparent. Painting a lighter grid would raise the floor's
   * value behind the hero and spend the +0.188 figure/ground polarity `docs/LESSONS.md`
   * §13 records; taking value out in thin lines does not. Alpha rather than multiply
   * because a `CustomBlending` multiply is already in use twice in this file for the
   * contact shadows and a third one drawing over them would compound.
   */
  private static floorGridTexture(px = 256): THREE.Texture {
    const canvas = document.createElement('canvas');
    canvas.width = px;
    canvas.height = px;
    const ctx = canvas.getContext('2d');
    if (ctx) {
      ctx.clearRect(0, 0, px, px);
      ctx.strokeStyle = 'rgba(0,0,0,0.55)';
      ctx.lineWidth = px * 0.055;
      // Drawn ON the edge, so the wrapped copies meet and the joint is one line wide
      // rather than two half-lines with a gap between them at every repeat boundary.
      ctx.strokeRect(0, 0, px, px);
    }
    const tex = new THREE.CanvasTexture(canvas);
    tex.wrapS = THREE.RepeatWrapping;
    tex.wrapT = THREE.RepeatWrapping;
    tex.repeat.set(22, 22);
    tex.colorSpace = THREE.SRGBColorSpace;
    return tex;
  }

  private buildDressing(): THREE.Group {
    const g = new THREE.Group();
    g.name = 'lobby_dressing';

    const add = (mesh: THREE.Mesh, cast = false): THREE.Mesh => {
      mesh.castShadow = cast;
      mesh.receiveShadow = true;
      mesh.userData.noOutline = true;
      g.add(mesh);
      return mesh;
    };

    /**
     * ⚠️ THE FIRST LAYOUT PUT EVERY PROP WHERE THE FIGHTER IS.
     *
     * The camera targets half the assembly's height (~1.37 m) with the subject filling
     * 62% of the frame, so the band from about 0.6 m to 2.6 m and roughly +/-1.2 m of
     * the axis is FIGHTER, at every framing, for every character. Round 1 put the
     * counter at 1.05 m, the stock pot dead centre at 1.41 m and the shelf at 2.78 m —
     * i.e. one object hidden behind the hero's waist, one behind its head, and one
     * cropped off the top by the canvas mask. Rendered, the room read as three
     * unidentifiable coloured rectangles poking out from behind a hamburger.
     *
     * The fix is compositional, not stylistic: the set has to live in the two vertical
     * gutters either side of the fighter and in the band BELOW its feet, which is the
     * same reasoning `home.ts` used to move the nameplate to the stage's top centre.
     * The counter drops so its lit lip crosses under the podium, and the shelf drops to
     * 2.15 m where the mask still passes it.
     */
    const Z = -3.35;
    const COUNTER_W = 7.2;
    const COUNTER_H = 0.78;

    // ── The tiled floor ──────────────────────────────────────────────────────
    // A square plane and NOT the floor ring's own UVs: `RingGeometry` parameterises u
    // by angle, so a repeating texture on it fans out from the centre like a dartboard
    // instead of tiling. The plane runs to 13 m, well past the 5 m cyclorama, and every
    // corner outside that radius is occluded by the cove's own back-facing wall — there
    // is nothing to clip and no seam to hide.
    const grid = new THREE.Mesh(
      new THREE.PlaneGeometry(13, 13),
      new THREE.MeshBasicMaterial({
        map: MenuCharacterStage.floorGridTexture(),
        transparent: true,
        depthWrite: false,
        toneMapped: false,
      }),
    );
    grid.rotation.x = -Math.PI / 2;
    grid.position.y = 0.006;
    grid.renderOrder = 0;
    grid.userData.noOutline = true;
    grid.name = 'lobby_floor_grid';
    g.add(grid);

    // ── The tiled back wall ──────────────────────────────────────────────────
    // Same texture, on a cylinder 4 cm inside the cove. The cove's albedo and its two
    // authored ramps are untouched — this only adds the joints — because those ramps
    // are load-bearing for three separate acceptance numbers (see CYC_VALUE) and
    // retinting the wall to get a texture on it would have moved all of them.
    const wallTex = MenuCharacterStage.floorGridTexture();
    wallTex.repeat.set(26, 9);
    const wallGrid = new THREE.Mesh(
      new THREE.CylinderGeometry(CYC_RADIUS - 0.04, CYC_RADIUS - 0.04, CYC_HEIGHT, 72, 1, true),
      new THREE.MeshBasicMaterial({
        map: wallTex,
        side: THREE.BackSide,
        transparent: true,
        depthWrite: false,
        toneMapped: false,
      }),
    );
    wallGrid.position.y = CYC_HEIGHT / 2 + CYC_BASE_Y;
    wallGrid.renderOrder = 0;
    wallGrid.userData.noOutline = true;
    wallGrid.name = 'lobby_wall_grid';
    g.add(wallGrid);

    // ── The counter run ──────────────────────────────────────────────────────
    // A cool steel body under a warm top, which is the same two-material read the podium
    // uses and the reason the room does not become one brown mass. The top is a separate
    // slab overhanging the body by 6 cm on each side so the join throws its own line —
    // the podium's inset trick, applied to furniture.
    add(new THREE.Mesh(
      new THREE.BoxGeometry(COUNTER_W, COUNTER_H, 0.72),
      toonMat({ color: LOBBY.counterBody, ramp: RAMP_SOFT(), roughness: 0.8 }),
    ), true).position.set(0, COUNTER_H / 2, Z);

    add(new THREE.Mesh(
      new THREE.BoxGeometry(COUNTER_W + 0.12, 0.11, 0.84),
      toonMat({ color: LOBBY.counterTop, ramp: RAMP_SOFT(), roughness: 0.5 }),
    )).position.set(0, COUNTER_H + 0.055, Z);

    // A bright lip on the front face of the slab. The single highest-value horizontal in
    // the room and the thing that reads as "a surface at this height" from any yaw.
    add(new THREE.Mesh(
      new THREE.BoxGeometry(COUNTER_W + 0.12, 0.045, 0.06),
      toonMat({ color: LOBBY.counterLip, ramp: RAMP_SOFT(), roughness: 0.4 }),
    )).position.set(0, COUNTER_H + 0.012, Z + 0.44);

    // ── The shelf ────────────────────────────────────────────────────────────
    add(new THREE.Mesh(
      new THREE.BoxGeometry(COUNTER_W - 0.4, 0.13, 0.52),
      toonMat({ color: LOBBY.shelf, ramp: RAMP_SOFT(), roughness: 0.75 }),
    )).position.set(0, 2.15, Z - 0.05);
    // Two brackets, so the shelf is held up rather than floating. Cheap, and the
    // difference between a prop and a set is whether things are attached to each other.
    for (const x of [-2.6, 2.6]) {
      add(new THREE.Mesh(
        new THREE.BoxGeometry(0.1, 0.36, 0.1),
        toonMat({ color: LOBBY.steel, ramp: RAMP_SOFT(), roughness: 0.7 }),
      )).position.set(x, 2.31, Z - 0.2);
    }

    // ── The jars ─────────────────────────────────────────────────────────────
    // THE HUE BUDGET LIVES HERE. `hm_lang`'s effective-hue count is a Simpson diversity
    // over the chromatic pixels, so one orange page plus one cream panel scores ~5.6 no
    // matter how many accents are sprinkled on it — the only thing that moves it is real
    // AREA in other hues. Eight jars split across the roster's own palette is that area,
    // it is on-brand for a food game, and it costs eight draw calls.
    //
    // Split across two heights so the row does not read as a bar chart: the shelf line
    // and the counter line each get four, staggered.
    const jarGeo = new THREE.CylinderGeometry(0.19, 0.21, 0.44, 20);
    const lidGeo = new THREE.CylinderGeometry(0.21, 0.21, 0.07, 20);
    const lidMat = toonMat({ color: LOBBY.steel, ramp: RAMP_SOFT(), roughness: 0.45 });
    // ALL OUTSIDE +/-1.35 m. That is the fighter's gutter — see the layout note above.
    const jarXs = [-2.95, -2.25, -1.55, 1.55, 2.25, 2.95, -2.6, 2.6];
    const jarYs = [2.35, 2.35, 2.35, 2.35, 2.35, 2.35, 0.9, 0.9];
    for (let i = 0; i < jarXs.length; i++) {
      const s = 0.86 + ((i * 37) % 5) * 0.09;
      const y = jarYs[i] + 0.22 * s;
      add(new THREE.Mesh(jarGeo, toonMat({ color: LOBBY.jars[i], ramp: RAMP_SOFT(), roughness: 0.55 })))
        .position.set(jarXs[i], y, Z - 0.02);
      g.children[g.children.length - 1].scale.setScalar(s);
      add(new THREE.Mesh(lidGeo, lidMat)).position.set(jarXs[i], y + 0.25 * s, Z - 0.02);
      g.children[g.children.length - 1].scale.setScalar(s);
    }

    // ── Two stock pots, flanking ─────────────────────────────────────────────
    // Round 1 put ONE dead centre, at exactly the height of the hero's chest, where it
    // was never once visible. A pair in the gutters breaks the counter's horizontal on
    // both sides and reads at every yaw of the +/-22 degree sway. Steel, so they
    // separate from the jars by MATERIAL rather than by hue.
    for (const x of [-1.95, 1.95]) {
      add(new THREE.Mesh(
        new THREE.CylinderGeometry(0.4, 0.36, 0.46, 24),
        toonMat({ color: LOBBY.steel, ramp: RAMP_SOFT(), roughness: 0.35 }),
      )).position.set(x, COUNTER_H + 0.34, Z - 0.02);
      add(new THREE.Mesh(
        new THREE.CylinderGeometry(0.44, 0.44, 0.06, 24),
        toonMat({ color: LOBBY.counterLip, ramp: RAMP_SOFT(), roughness: 0.3 }),
      )).position.set(x, COUNTER_H + 0.6, Z - 0.02);
    }

    return g;
  }

  setScene(mode: 'portrait' | 'lobby'): void {
    if (this.disposed) return;
    if (mode === 'lobby' && !this.dressing) {
      this.dressing = this.buildDressing();
      this.stage.scene.add(this.dressing);
    }
    if (this.dressing) this.dressing.visible = mode === 'lobby';
  }

  attachTo(host: HTMLElement): void {
    if (this.disposed) return;
    if (this.holder.parentElement !== host) host.appendChild(this.holder);
    this.observer?.disconnect();
    // ResizeObserver rather than a window listener: the portrait's box changes when
    // the LAYOUT changes (a stats panel growing, a roster reflowing), not only when
    // the window does, and a stale drawing-buffer size is instantly visible.
    this.observer = new ResizeObserver(() => this.resize());
    this.observer.observe(host);
    this.resize();
  }

  detach(): void {
    this.observer?.disconnect();
    this.observer = null;
    this.holder.remove();
  }

  show(id: CharacterId): void {
    if (this.disposed || id === this.currentId) return;
    if (this.model) {
      this.stage.scene.remove(this.model.root);
      this.model.dispose();
    }
    this.model = createCharacter(id);
    this.model.play('idle');
    this.stage.scene.add(this.model.root);

    // Measure at rest, BEFORE the entrance pop scales the root — the framing has to
    // describe the character, not the animation it happens to be mid-way through.
    const box = new THREE.Box3().setFromObject(this.model.root);
    this.subjectH = Math.max(0.5, box.max.y - box.min.y);
    // Measured as twice the largest offset FROM THE AXIS, not as the raw box width.
    // The camera aims at x = 0, and several characters are asymmetric about it
    // (Hamburger holds a spatula out to one side), so a symmetric fit around the box
    // centre crops the long side. Depth counts too: the portrait sways +/-22 degrees,
    // so a shallow-but-wide character presents its depth to camera at the extremes of
    // the sway — framing the worst case once beats pumping the zoom every frame.
    this.subjectW = 2 * Math.max(
      0.25,
      Math.abs(box.min.x), Math.abs(box.max.x),
      Math.abs(box.min.z), Math.abs(box.max.z),
    );

    // Stand ON the podium's recessed face, whatever the model's own foot line is.
    this.model.root.position.y = PLINTH_TOP_Y + 0.005 - box.min.y;

    // Size the contact patch to this character's own footprint — a Hot Dog and a
    // Water Bottle do not share a shadow.
    if (this.footShadow) {
      const span = THREE.MathUtils.clamp(
        Math.max(box.max.x - box.min.x, box.max.z - box.min.z) * 1.15, 1.0, 2.3,
      );
      this.footShadow.scale.set(span / 1.9, 1, (span / 1.9) * 0.72);
    }

    this.currentId = id;
    this.introT = 0.34;
    this.applyFraming();
  }

  poke(): void {
    this.model?.play('attack');
  }

  update(dt: number): void {
    if (this.disposed) return;
    this.elapsed += dt;

    // Slow turntable sway rather than a full spin: a continuous rotation makes it
    // impossible to read a silhouette, and every character on this project is
    // authored to face +Z. +/-22 degrees shows the profile without ever losing the
    // front three-quarter view the models were judged at. The cove is a cylinder
    // centred on the subject precisely so this sway cannot move the horizon.
    this.stage.rig.yawDeg = Math.sin(this.elapsed * 0.42) * 22;

    if (this.model) {
      // Entrance pop on swap — a beat of squash/stretch so switching characters
      // feels like a card being slammed down, not a texture swap.
      if (this.introT > 0) {
        this.introT = Math.max(0, this.introT - dt);
        const p = 1 - this.introT / 0.34;
        const k = Math.sin(p * Math.PI) * (1 - p * 0.4);
        this.model.root.scale.setScalar(1 + k * 0.16);
        this.model.root.rotation.y = (1 - p) * -0.9;
      } else {
        this.model.root.scale.setScalar(1);
        this.model.root.rotation.y = 0;
      }
      this.model.update({ dt, elapsed: this.elapsed, moveSpeed01: 0, health01: 1 });
    }

    this.stage.render(dt);
  }

  resize(): void {
    if (this.disposed) return;
    this.stage.resize();
    // Framing depends on the panel's aspect, which `stage.resize()` has just
    // changed — so it has to be recomputed here, not only on character swap.
    this.applyFraming();
  }

  /**
   * QA hook, in the same spirit as `window.__preview.info()`. Reports where the
   * portrait camera actually is and where the model actually lands on screen, so a
   * framing regression is a number rather than an impression. Never read by the
   * menus themselves.
   */
  info(): Record<string, unknown> {
    const cam = this.stage.rig.camera;
    const box = this.model ? new THREE.Box3().setFromObject(this.model.root) : null;
    const project = (v: THREE.Vector3) => {
      const p = v.clone().project(cam);
      return { x: +((p.x * 0.5 + 0.5)).toFixed(3), y: +((1 - (p.y * 0.5 + 0.5))).toFixed(3) };
    };
    const rig = this.stage.rig;
    return {
      id: this.currentId,
      aspect: +cam.aspect.toFixed(3),
      fill: +rig.subjectFill.toFixed(3),
      subject: { w: +this.subjectW.toFixed(2), h: +this.subjectH.toFixed(2) },
      cameraOk: Number.isFinite(cam.position.x) && Number.isFinite(cam.position.y),
      // Normalised 0..1 screen coords of the model's extremes. All four must sit
      // inside [0,1] for the hero to be fully in frame — that is the framing
      // acceptance check, and it is a number rather than an impression.
      feet: box ? project(new THREE.Vector3(0, box.min.y, 0)) : null,
      crown: box ? project(new THREE.Vector3(0, box.max.y, 0)) : null,
      left: box ? project(new THREE.Vector3(box.min.x, (box.min.y + box.max.y) / 2, 0)) : null,
      right: box ? project(new THREE.Vector3(box.max.x, (box.min.y + box.max.y) / 2, 0)) : null,
    };
  }

  dispose(): void {
    if (this.disposed) return;
    this.disposed = true;
    this.observer?.disconnect();
    this.observer = null;
    if (this.dressing) {
      // `Stage.dispose()` tears down the renderer, not the scene graph, so the room's
      // geometries and materials have to be released here or a home -> match -> home
      // cycle leaks one kitchen per visit. The jar geometry is shared across eight
      // meshes, so this walks a Set rather than calling dispose per mesh.
      const geos = new Set<THREE.BufferGeometry>();
      const mats = new Set<THREE.Material>();
      this.dressing.traverse((o) => {
        const m = o as THREE.Mesh;
        if (m.geometry) geos.add(m.geometry);
        if (m.material) for (const mat of Array.isArray(m.material) ? m.material : [m.material]) mats.add(mat);
      });
      geos.forEach((x) => x.dispose());
      mats.forEach((x) => x.dispose());
      this.stage.scene.remove(this.dressing);
      this.dressing = null;
    }
    if (this.model) {
      this.stage.scene.remove(this.model.root);
      this.model.dispose();
      this.model = null;
    }
    this.stage.dispose();
    this.holder.remove();
  }
}

let instance: MenuCharacterStage | null = null;

declare global {
  interface Window {
    /** QA-only handle on the menu portrait. See `MenuCharacterStage.info()`. */
    __charStage?: () => Record<string, unknown> | null;
  }
}

/** The shared portrait stage, created on first use. */
export function getCharacterStage(): CharacterStage {
  if (!instance) {
    instance = new MenuCharacterStage();
    if (typeof window !== 'undefined') window.__charStage = () => instance?.info() ?? null;
  }
  return instance;
}

/** Destroy the shared portrait and free its WebGL context. The shell calls this
 *  before starting a match so the game never competes with an idle menu context. */
export function disposeCharacterStage(): void {
  instance?.dispose();
  instance = null;
}
