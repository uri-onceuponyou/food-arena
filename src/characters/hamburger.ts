/**
 * Hamburger (Normal) — ported onto the shared `ChibiRig`.
 *
 * This was the roster's first-built model, authored before `ChibiRig` existed, and
 * scored the richest food mass in the cast: a real bottom-bun/patty/cheese/tomato/
 * lettuce/top-bun stack where every layer owns real height and its own substance
 * (matte bread, seared meat, wet tomato, glossy cheese), a spatula prop, and a face
 * solved with a single shared tangent frame on the curved crown so eyes and brows
 * can never drift out of plane with each other. All of that is preserved here —
 * this file only replaces the bespoke body/limbs/motion with the shared rig, per
 * `donut.ts` (the reference implementation of this pattern).
 *
 * ── What the rig supplies ────────────────────────────────────────────────────
 * Torso, arms (shoulder → elbow → hand), legs (hip → knee → foot) and the entire
 * motion vocabulary (idle breathing, run stride, attack wind-up/strike, hit recoil,
 * death topple) all come from `ChibiRig`. This file authors only:
 *   - the upper stack (patty / cheese / tomato / lettuce / top bun) on `head`
 *   - the bottom bun as the dressed torso, via `rig.dressTorso()`
 *   - the face on `rig.joints.face`
 *   - the spatula prop on `rig.joints.handR`
 *
 * ── Vertical alignment (the documented rig gotcha) ───────────────────────────
 * `ChibiRig.headCentreY` places the head group's local origin at
 * `torsoTopY + 0.86 * R`, which assumes a mass extending roughly ±R about its OWN
 * origin (true for a sphere-like donut ring or egg shell). The burger's upper stack
 * is the opposite of that: it is built entirely upward from the patty's underside,
 * with nothing below. Left at head-local y=0, the whole stack would float ~0.86R
 * above the torso with a visible gap — the exact failure this brief calls out.
 *
 * HotDog solved the equivalent problem (a horizontal sausage-on-a-bun, also not
 * symmetric about its own centre) with a hidden connector block pinned to -0.90R,
 * which cancels headCentreY's own offset almost exactly regardless of R. The same
 * fix generalises here without needing a hidden connector mesh at all: the stack's
 * own bottom (the patty's underside) is anchored at local y = BASE_Y.
 *
 * ── Structural fix, round 4: arms emerge from the SEAM, not the bun's middle ──
 * A third independent art-director pass named the cast-wide problem directly, and
 * for Hamburger specifically: arms should come out from between the bun layers,
 * so the stack itself is the body, rather than being bolted onto a generic torso.
 * Rounds 1-3 set `BASE_Y ≈ -0.90*R` so the patty's underside landed flush with the
 * dressed torso's TOP surface — but the rig's shoulder joints are not at the
 * torso's top; `ChibiRig` plants them at `torsoH * 0.78`, which is `torsoH * 0.22`
 * BELOW the torso top. That gap meant the arms actually emerged from the middle of
 * the bottom bun's OWN mass, with the patty/cheese/tomato/lettuce stack floating
 * entirely above the arm line — "bolted to a torso" exactly as flagged, just a
 * torso wearing a bun costume. `BASE_Y` now targets the SHOULDER height instead of
 * the torso top (still derived the same way, just re-targeted — see its own
 * comment below), so the patty's underside sinks down to where the arms actually
 * pivot. The wider bottom bun (`bunR` in `dressTorso` below) still peeks out
 * beyond the narrower patty at that height, so the arm reads as sprouting from the
 * visible seam between the two buns, not from inside either one.
 */

import * as THREE from 'three';
import { BaseCharacter } from './types';
import type { AnimContext } from './types';
import type { CharacterDef } from '../game/rules';
import { PALETTE } from '../game/rules';
import { toonMat, glossyMat, flatMat, outlineGroup, roundedBox, RAMP_CHARACTER, OUTLINE_THIN } from '../render/toon';
import { ChibiRig, taperedSegment } from './rig';
import { bodyType } from './bodies';
import { CHARACTER_HEIGHT } from '../units';
import { aim, blade as leafBlade, knob, localBounds, massAnchor, rod } from './appendages';

/**
 * Limb-only toasted-crust tones, a genuine value step below the bun.
 *
 * Kept out of `PALETTE` on purpose: this is a per-character separation between
 * the FOOD MASS and the BODY carrying it, not a shared ingredient colour. See
 * the palette block in the constructor for the defect that forced it.
 */
// ── The dark rung ────────────────────────────────────────────────────────────
// Measured against 18 Brawl Stars plates: every one of them puts 5% of the character
// below luma 0.18; Hamburger's P05 was 0.295. A blind critic's words for the same
// thing were "the arms and feet collapse into near-identical dark brown lumps" —
// correct observation, and the cause was not that the limbs were too dark but that
// NOTHING on the character was dark, so a mid-brown arm and a mid-brown boot had no
// third value to be read against. Both limb tones drop to a charred crust (8.3% of
// the character's pixels, which is what a P05 actually costs) and the mitts come UP
// to pay for it in figure/ground. Measured at pot_south, shipped framing:
// range 0.570 -> 0.716, p05 0.315 -> 0.176, steps@0.10 6 -> 7, fg 0.258 -> 0.224.

// ── PASS 2: the limb CHAIN has to alternate, not ramp ────────────────────────
// The first value pass took both limb tones down together. That fixed range/P05 and
// BROKE the part boundary — measured, `shoulderL|elbowL` 0.044, `kneeL|footL` 0.035,
// because a chain of four segments each a shade darker than the last is one mass. The
// reference's grammar is alternation: mid sleeve, dark cuff, light glove. So the upper
// segment comes back UP, the lower segment holds the dark, and the boot takes its own
// darkest tone instead of sharing the shin's.
// PASS 3: at #7A4318 the upper arm measured 0.32 against a bottom bun at 0.33 —
// `torso|shoulderL` 0.011 across 68 px, the biggest seam on the character. #96581E took
// it to 0.087, still inside the 0.10 floor, so one more step.
const LIMB_TOAST = '#AD6C29';      // upper arm / thigh — mid
const LIMB_TOAST_DARK = '#3E1F09'; // forearm / shin — dark
/**
 * Local copies of four `PALETTE` ingredient tones, deepened for THIS character only.
 *
 * `PALETTE.patty` / `pattyDark` / `bunDark` / `lettuce` are shared with Taco and
 * Burrito, and `rules.ts` is not this file's to edit — nor should it be, because the
 * right value for a patty depends on what else is in the frame with it. Hue is held;
 * only value moved.
 */
/**
 * ── 🚨 #2A1408 -> #4A2410, AND THIS IS THE THIRD AND LAST CAUSE OF THE HIPS ─────
 * WAS `#2A1408`, luma **0.090**. `3ad20e2` and `75daec3` closed the other two causes
 * of Uri's "hips look detached" — the apron's contour (0.70 -> 0.58 -> 0.46 of the
 * bun's height) and a 0.305 luma cliff where `LIMB_TOAST` met the bun, cut to 0.200
 * by `LIMB_THIGH` — and both rounds ended "IMPROVED, NOT CLOSED" with the residual
 * named as this constant. It was left alone as "a `valuescan` round of its own".
 *
 * ── IT IS NOT A `valuescan` ROUND, AND THAT IS WHY THREE PASSES COULD NOT CLOSE IT ─
 * `tools/tmp/cf_ablate.mjs` paints one named mesh through the SHIPPED path and counts
 * the pixels it owns. The patty owns:
 *
 *   pitch 20 (charStage.ts, the LOBBY camera Uri judges)   9,886 px   **0.785%** of frame
 *   pitch 58 (camera.ts, the MATCH camera)                   240 px   **0.019%** of frame
 *
 * **`valuescan` measures pitch 58. At the camera every previous round steered on, this
 * element is 240 pixels — it structurally cannot see the thing it was asked about.**
 * `docs/LESSONS.md` §6b read backwards: a flat metric is not evidence a change did
 * nothing; ask what the metric can express. The patty is occluded at 58 by the cheese
 * slab overhanging it (`CHEESE_R` 0.74R against `PATTY_R` 0.60R) and fully visible at
 * 20. It is a LOBBY defect and only a lobby instrument can price it.
 *
 * ── AND THE SAME OVERHANG IS WHY THE ALBEDO IS THE RIGHT LEVER ─────────────────
 * Ablated (`shots/cf/ablate/hb-patty-p20.png`), the black waist band IS exactly the
 * patty: it runs from the cheese's underside to the apron's top edge, and the dark at
 * the hips proper — where the thighs attach — is the BOTTOM BUN, a different mesh
 * (1.537% of the same frame). Recessed 0.14R behind the cheese, the patty never sees
 * the key light, so at 0.090 albedo it renders as a hole rather than as meat.
 *
 * Four candidates rendered through the shipped path with no source edit
 * (`cf_ablate --color`, `shots/cf/patty/`) and judged by eye at the lobby camera:
 *   #2A1408  0.090  shipped — a black slot. The defect.
 *   #3A1C0C  0.130  the centre reads brown; the LEFT HALF is still black. Not enough.
 *   #4A2410  0.167  the whole band reads as a seared patty.            <- ships
 *   #5E2E14  0.213  reads well, but closes on `LIMB_THIGH` #8A5220 (0.354) — the exact
 *                   body/limb merge `75daec3` spent that constant to open. Rejected.
 *   (hidden)        proves the diagnosis and answers the identity question: with the
 *                   patty gone the band is warm bun and the black is gone — and the
 *                   character is a bun with salad in it. **The patty stays.**
 *
 * ⚠️ 0.167 is ABOVE the bottom bun's albedo (#43220B, 0.154) and that inversion is
 * deliberate: the two are not lit alike. The bun's flank faces the key; the patty sits
 * under an overhang. In the RENDER the patty still reads at or below the bun.
 * ⚠️ `PATTY_DARK` is NOT lifted with it — it is shared with `foot`, and lifting it
 * would repaint the boots to fix the grill marks.
 */
const PATTY = '#4A2410';
const PATTY_DARK = '#0C0603';     // and the boots are darker than the shins above them
/**
 * ── ❌ #43220B -> #7B4415 WAS BUILT, MEASURED AND REVERTED. THE NUMBER THAT
 *    KILLED IT: `p05` **0.166 -> 0.238** AGAINST A HARD MAX OF **0.180** ──────
 * `valuescan --mode gate`, recomputed on both trees under `headserve`
 * (before f2ed2d9b3ce0d8e6, after 06621542555b1d37):
 *
 *   hamburger    range    p05  steps  minDL  weakB%  weakBc%  verdict
 *   #43220B      0.713  0.166      7  0.208     4.3      9.0  PASS
 *   #7B4415      0.639  0.238      6  0.209     4.7     11.6  FAIL: p05
 *
 * `p05` is the DARK ANCHOR and its band is calibrated off the reference plates
 * (max 0.180, target 0.100). The bottom bun is this character's whole torso, so it
 * IS the dark end of the ladder — lifting it 0.145 of luma lifted `p05` 0.072 and
 * cost a value rung as well (`steps@10` 7 -> 6, `range` 0.713 -> 0.639).
 * ⚠️ The slope is the finding: **+0.5 of p05 per unit of bun albedo**, so the p05
 * headroom (0.180 - 0.166 = 0.014) buys **0.028 of bun luma** — nothing. Lifting
 * this constant is not affordable at any useful size, and the next pass should not
 * re-derive that.
 *
 * The diagnosis below is unchanged and correct; only the side it is paid from moved.
 * See `LIMB_THIGH` — the same value step, taken from the LIMB instead, which pushes
 * `p05` DOWN (the safe direction) and separates the thigh from the upper arm at the
 * same time.
 *
 * ── the diagnosis this was written for ──────────────────────────────────────
 *
 * `bunDarkMat` paints the **bottom bun, which is this character's whole torso**
 * (`dressTorso`). At #43220B it is **luma 0.154** — the darkest large surface on the
 * model — while `LIMB_TOAST`, the thigh that attaches to it, is 0.459. Rendered at
 * the lobby camera and zoomed 2x (`shots/cc/zoom/hb-hips-after4.png`) the body's
 * lower half is a BLACK VOID with two lit orange legs standing in front of it. A
 * body that is the darkest thing on the character cannot read as the thing its
 * limbs attach to, whatever the contour does.
 *
 * ⚠️ This is the third distinct cause found for the same reject, and the first two
 * were both real and both insufficient:
 *   · `fc4d9ad`'s pelvis — measured 0.08% of the silhouette, enclosed by the bun on
 *     every axis (`LESSONS` §1);
 *   · the apron's hard hem — fixed, twice (0.70 -> 0.58 -> 0.46 of the bun's height),
 *     and the contour under the body IS the bun's curve now. The zoom shows it.
 * The geometry is right and the paint is wrong.
 *
 * The value it was deepened FOR still holds, because the number that made it
 * necessary has moved. PASS 3's note above reads *"at #7A4318 the upper arm measured
 * 0.32 against a bottom bun at 0.33 — `torso|shoulderL` 0.011 across 68 px"* — that
 * was when the LIMB was #7A4318. The limb has since gone to #AD6C29 (0.459), so:
 *
 *   torso|shoulderL step   old #43220B: 0.459 - 0.154 = 0.305
 *                          new #7B4415: 0.459 - 0.299 = 0.160
 *
 * — still above the 0.10 floor and at the 0.15 target, bought with 0.145 of luma
 * that the torso had no use for. Hue is held exactly (the same 24-degree bake); only
 * value moved, which is the rule the block below already states.
 */
const BUN_DARK = '#43220B';
/**
 * The THIGH's own tone, and it exists to pay for the paragraph above from the side
 * that `p05` does not object to.
 *
 * `LIMB_TOAST` (#AD6C29, luma 0.459) dressed the upper arm AND the thigh — one
 * material for both, which is half of why this character reads as four legs. Against
 * a bottom bun at 0.154 it also puts a **0.305 luma cliff exactly at the hip**, and a
 * bright limb butted against a black body is the "disconnected" read whatever the
 * contour does.
 *
 * #8A5220 is luma **0.354**, so:
 *   thigh | bottom bun   0.305 -> 0.200   the hip cliff, cut by a third
 *   upper arm | thigh    0.000 -> 0.105   arms and legs now differ in VALUE too,
 *                                         on top of 1.08/0.70 against 1.34/1.10
 * and because it moves a large surface DOWN, it moves `p05` down — the direction the
 * gate wants — where lifting the bun moved it up and failed.
 */
const LIMB_THIGH = '#8A5220';
const LETTUCE = '#4E7A12';
/** The frill's own lighter green. Was `PALETTE.lettuce` offset in HSL; pinned to the
 *  value that offset actually produced so deepening `LETTUCE` does not drag it down
 *  too — the frill is the light side of this character's green step. */
const LETTUCE_FRILL = '#88C32F';
/** Mitts. Were `PALETTE.bun`, i.e. EXACTLY the crown they are held in front of.
 *  A lighter toasted bun keeps the "toasted mitt" read and buys back the figure/ground
 *  the charred limbs above spend. */
const MITT_BUN = '#F7CE86';

// ─────────────────────────────────────────────────────────────────────────────
// Local geometry helpers — chunky rounded discs the shared kit doesn't provide.
// ─────────────────────────────────────────────────────────────────────────────

/** A rounded "hockey puck" — flat top/bottom with a filleted rim. Used for every
 * stacked layer (buns, patty, cheese, tomato, lettuce) so the whole stack reads as
 * one consistent chunky-food language. */
function roundedPuck(radius: number, height: number, edge: number, radialSegments = 24, bulge = 0): THREE.BufferGeometry {
  const e = Math.min(edge, height / 2 - 0.001, radius * 0.9);
  const corner = 5;
  const pts: THREE.Vector2[] = [];
  // ── `bulge`: how far the UNDERSIDE domes below y=0. Default 0 = the old flat disc.
  // A real bun bottom is convex, and so is the reason this exists. At the lobby
  // camera the flat version gave this character a body whose lowest contour is a
  // straight horizontal line with background under it and a leg butted against each
  // end — see the thigh case in `dressLimbs` for the full reading. The dome tapers to
  // zero by `radius - e`, so it descends ONLY in the span between the two thigh tops
  // and adds nothing outboard of them: it closes the notch it is aimed at without
  // repeating `rig.ts:1137`'s full-span pelvis slab, which buried the thighs on 9 of
  // 11 characters and cost hull deficiency the pass that had just bought it.
  if (bulge > 0) {
    const dome = 6;
    pts.push(new THREE.Vector2(0, -bulge));
    for (let i = 1; i <= dome; i++) {
      const a = (Math.PI / 2) * (i / dome);
      pts.push(new THREE.Vector2(Math.max(radius - e, 0.001) * Math.sin(a), -bulge * Math.cos(a)));
    }
  } else {
    pts.push(new THREE.Vector2(0, 0));
    pts.push(new THREE.Vector2(Math.max(radius - e, 0.001), 0));
  }
  for (let i = 0; i <= corner; i++) {
    const a = (Math.PI / 2) * (i / corner);
    pts.push(new THREE.Vector2(radius - e + Math.sin(a) * e, e - Math.cos(a) * e));
  }
  for (let i = 0; i <= corner; i++) {
    const a = (Math.PI / 2) * (i / corner);
    pts.push(new THREE.Vector2(radius - e + Math.cos(a) * e, height - e + Math.sin(a) * e));
  }
  pts.push(new THREE.Vector2(0, height));
  const geo = new THREE.LatheGeometry(pts, radialSegments);
  geo.computeVertexNormals();
  return geo;
}

/** Bun crown profile as (radius fraction, height fraction) control points —
 * shared by `bunDome` (which revolves it into geometry) and `crownSurface`
 * (which samples the SAME points to place seeds/face decals exactly on the
 * resulting surface). One source of truth is what stops decals from floating
 * off the mesh or clipping through it if this silhouette is ever retuned. */
const CROWN_PROFILE: Array<[r: number, h: number]> = [
  [0, 0], [0.88, 0], [1.0, 0.16], [0.97, 0.42], [0.78, 0.72], [0.4, 0.93], [0, 1],
];

/** The bun crown: a squat dome that bulges out near its base then rounds to an
 * apex — the classic burger-bun silhouette, not just a sphere. */
function bunDome(baseRadius: number, height: number, radialSegments = 28): THREE.BufferGeometry {
  const pts = CROWN_PROFILE.map(([r, h]) => new THREE.Vector2(r * baseRadius, h * height));
  const geo = new THREE.LatheGeometry(pts, radialSegments);
  geo.computeVertexNormals();
  return geo;
}

interface CrownSize {
  baseR: number;
  h: number;
}

/** Exact surface point + outward normal on the crown dome at a given azimuth
 * (`theta`, radians, 0 = character-front/+Z, increasing toward +X) and height
 * fraction (0 = crown base, 1 = apex), for a crown of the given `size`. The
 * normal is derived from the profile's own tangent (dR, dH) → normal ∝
 * (dH, -dR) in the (radial, vertical) meridian plane, which correctly tilts
 * down-and-out on the lower bulge and up-and-out near the apex — a fixed/guessed
 * normal was the root cause of seeds floating detached above the surface and the
 * blush decal clipping through it. Takes `size` as a parameter (rather than
 * reading a module constant) so it stays correct however the rig scales R. */
function crownSurface(size: CrownSize, theta: number, hFrac: number): { pos: THREE.Vector3; normal: THREE.Vector3 } {
  const h = THREE.MathUtils.clamp(hFrac, 0, 1);
  let seg = CROWN_PROFILE[0];
  let segNext = CROWN_PROFILE[1];
  for (let i = 0; i < CROWN_PROFILE.length - 1; i++) {
    if (h >= CROWN_PROFILE[i][1] && h <= CROWN_PROFILE[i + 1][1]) {
      seg = CROWN_PROFILE[i];
      segNext = CROWN_PROFILE[i + 1];
      break;
    }
  }
  const [r0, h0] = seg;
  const [r1, h1] = segNext;
  const t = h1 > h0 ? (h - h0) / (h1 - h0) : 0;
  const rFrac = r0 + (r1 - r0) * t;
  const radius = size.baseR * rFrac;
  const y = h * size.h;

  const dR = (r1 - r0) * size.baseR;
  const dH = (h1 - h0) * size.h;
  const n2 = new THREE.Vector2(dH, -dR);
  if (n2.lengthSq() < 1e-8) n2.set(1, 0);
  n2.normalize();

  const nx = Math.sin(theta);
  const nz = Math.cos(theta);
  const pos = new THREE.Vector3(nx * radius, y, nz * radius);
  const normal = new THREE.Vector3(nx * n2.x, n2.y, nz * n2.x).normalize();
  return { pos, normal };
}

/** A group pre-positioned + oriented flush against the crown surface at
 * (theta, hFrac), pushed out along the normal by `embed` so a decal sits just
 * proud of the surface instead of floating above it or clipping through it. */
function addCrownDecal(parent: THREE.Object3D, size: CrownSize, theta: number, hFrac: number, embed: number): THREE.Group {
  const { pos, normal } = crownSurface(size, theta, hFrac);
  const g = new THREE.Group();
  g.position.copy(pos).addScaledVector(normal, embed);
  g.quaternion.setFromUnitVectors(new THREE.Vector3(0, 0, 1), normal);
  parent.add(g);
  return g;
}

/** Small flattened arc used for eyes (bulge up) and mouth (bulge down). The torus
 * ring lies in the XY plane by construction, so a 90°/-90° Z rotation aims the
 * bulge up or down without any extra math at the call site. */
function faceArc(curveRadius: number, tube: number, arcRad: number): THREE.BufferGeometry {
  const geo = new THREE.TorusGeometry(curveRadius, tube, 8, 20, arcRad);
  geo.rotateZ(-arcRad / 2); // centre the arc on angle 0 (local +X) before orienting
  geo.computeVertexNormals();
  return geo;
}

/**
 * A crescent bounded by two quadratic arcs that both hang DOWN from the same two
 * corners at (±`halfW`, 0) — the upper one through (0, -`upper`), the lower through
 * (0, -`lower`). The corners are therefore the HIGHEST points, which is the whole
 * difference between a smile and a frown, and the reason this is one helper rather
 * than two hand-placed curves that can drift apart.
 *
 * Used three ways on the mouth: `grinCrescent(w, topSag, botSag)` is the open
 * aperture; a thin one hugging either arc is a LIP. A Bézier from (-w,0) to (w,0)
 * with control (0, -2s) passes exactly through (0, -s), so `upper`/`lower` are the
 * real mid-height sags rather than control-point coordinates.
 */
function grinCrescent(halfW: number, upper: number, lower: number): THREE.Shape {
  const s = new THREE.Shape();
  s.moveTo(-halfW, 0);
  s.quadraticCurveTo(0, -2 * upper, halfW, 0);
  s.quadraticCurveTo(0, -2 * lower, -halfW, 0);
  return s;
}

/**
 * A vertical cloth strip curved around a cylinder of `radius`, spanning `arcRad`
 * of angle centred on the character's front (+Z), `height` tall. Used for the
 * apron bib — a cloth panel that hugs the dressed torso's own curvature rather
 * than floating in front of it as a flat card.
 */
function curvedPanel(radius: number, arcRad: number, height: number, segX = 14, segY = 6): THREE.BufferGeometry {
  const geo = new THREE.PlaneGeometry(arcRad, height, segX, segY);
  const pos = geo.attributes.position as THREE.BufferAttribute;
  for (let i = 0; i < pos.count; i++) {
    const theta = pos.getX(i);
    const y = pos.getY(i);
    pos.setXYZ(i, Math.sin(theta) * radius, y, Math.cos(theta) * radius);
  }
  geo.computeVertexNormals();
  return geo;
}

/**
 * ── 🚨 THE ARM WAS A CHAIN OF BALLS, AND IT IS ARITHMETIC, NOT TASTE ─────────
 * The `taperedSegment` COPY that used to sit here is gone; the function is now
 * imported from `rig.ts`, which carries the mechanism (bone-bounded caps, profile
 * winding, the interior/exterior cap rule) once for all six files that had it.
 * **What stays here is what is true of HAMBURGER and of no other character**, and it
 * is the reason the four `rise` arguments below are the values they are.
 *
 * ⚠️ THE ORIGINAL DOC LINE READ *"Degenerates to a plain sphere when
 * rTop==rBot==len/2, which is exactly what the hand slot wants"*, AND IT IS KEPT
 * BECAUSE IT WAS THE BUG. That degeneration was described as a feature for a slot
 * this function is not used for, and it is what turned all four of this character's
 * limb segments into balls.
 *
 * Found by eye at the shipped lobby camera (`shots/cx/before/hamburger.png`,
 * `charStage.ts:451`, pitch 20): each arm read as **three separate orange balls**
 * — an orange lump, a dark lump, another orange lump — and each leg did the same.
 * A blind critic scored this character 4.0 against a reference 8-9 and **the number
 * contains none of this**, because no instrument in the repo counts limb segments.
 *
 * The cause is one inequality: a cylindrical SIDE only exists when
 * `yTopCap >= yBotCap`, i.e. when `len >= rTop + rBot`; below that the profile
 * collapses to two hemispheres sharing an equator — a ball. Hamburger's four segment
 * types, on the numbers this file actually passes:
 *
 *   segment      len      rTop+rBot   side?
 *   upper arm   0.2412     0.3554     NO   -> ball
 *   forearm     0.2200     0.2372     NO   -> ball
 *   thigh       0.2691     0.3095     NO   -> ball
 *   shin        0.2201     0.2245     NO   -> ball
 *
 * **All four. Every limb on this character was a sphere.** And it is a rediscovery,
 * not a new bug: `rig.ts` and `bodies.ts:80` both record `CapsuleGeometry`
 * degenerating to a sphere at `len < 2r` and the archetype pass that fixed it —
 * `bodies.ts:88` even says in capitals that **the ARM row has the same defect and
 * has not been fixed**. This file's private copy was hamburger's own re-entry into
 * the same trap: written to replace those capsules, it reproduced their failure mode
 * with `1.2x` radii, which are FATTER than the rig defaults it replaced.
 * **A private copy is how a fix fails to travel — donut derived the cap bound and it
 * never reached the other five.** That is why there is one function now.
 *
 * `rise` — how far the top cap reaches ABOVE the joint — is the OTHER half of Uri's
 * reject (§37 #1, *"the legs are disconnected from the body"*): a segment whose apex
 * is at the joint butts the mass above it and draws its own closed contour there, and
 * two closed contours touching is what "detached" looks like. A segment that starts
 * INSIDE the mass has no contour of its own until it emerges from under it.
 * The default `rise: 0` is the pre-fix behaviour exactly.
 */

/**
 * This character's own height, as a multiple of the cast's.
 *
 * It was the metre literal 2.05 until `CHARACTER_HEIGHT` moved. A literal here is
 * a silent opt-out of every cast-wide size decision: six of the eleven carried one,
 * so raising the cast height would have scaled five characters and left six behind.
 */
const H = CHARACTER_HEIGHT * 0.976;

export class HamburgerCharacter extends BaseCharacter {
  private rig: ChibiRig;

  constructor(def: CharacterDef) {
    super(def);

    this.rig = new ChibiRig({
      palette: {
        // ── The limbs are NOT bun-coloured any more ─────────────────────────
        // `PALETTE.bun` and `PALETTE.bunDark` are #E8A33D and #D98E3D — 6% apart
        // in value and identical in hue — and they were on the arms, the legs,
        // the torso AND the crown. A blind critic's read was that "from the neck
        // down it's one undifferentiated orange mass": true, because it was
        // literally one colour. A deeper toasted-crust tone drops the limbs a
        // real value step below the food mass so the burger stack is what the
        // eye picks up first, which is the whole job of a chibi body.
        limb: LIMB_TOAST,
        hand: PALETTE.cream,    // cream mitts
        foot: PATTY_DARK, // dark little feet — now genuinely near-black, see PATTY_DARK
        torso: BUN_DARK,  // fallback only — dressTorso() replaces this mesh below
        limbRoughness: 0.85,     // dry, matte-baked crust, matching the bun layers
      },
      // Wide, squat, heavy, planted — broad shoulders and thick, short-reading legs so
      // the silhouette reads as "burger" even with the head covered. A second
      // independent art-director pass named identical body proportions across the cast
      // as the single biggest remaining "template" tell despite per-character limb
      // geometry; `height` is deliberately below the 2.1m cast norm (short/squat) while
      // radii and stance run well above it (thick/planted).
      // Body: STOUT archetype (see `bodies.ts`) — short wide torso, thick short
      // limbs, low centre of mass, widest stance in the cast. Exactly the read
      // this character was hand-tuning toward before archetypes existed, so the
      // preset replaces those numbers rather than fighting them.
      //
      // `headFraction` runs high because the whole burger stack is sized off R
      // (see the vertical layout below): the food mass IS most of this character,
      // and the stack is what has to reach the cast's standard height.
      proportions: bodyType('stout', {
        height: H,
        headFraction: 0.68,
        // ── OPTS OUT of STOUT's neck gap, and the measurement is the whole reason ──
        // The neck is a real win where the mass already has two lobes (burrito
        // `neckPinch` 0.0769 -> 0.3636, sushi 0.2500 -> 0.2927). Hamburger is the
        // case where it is not: a burger's filling ring is as wide as its buns, so
        // there is no row narrower than both, and the gap measured **0.1159 ->
        // 0.0968 — WORSE** while shrinking the bun stack enough to float a mitt off
        // it (15 detached limb px at yaw 0, against a hard requirement of zero).
        // Attributed by running the height change alone, which left detachment at 0.
        neckFraction: 0,
        // 0.25H -> 0.30H. Measured, not styled: the burger stack is 0.534m
        // half-wide at shoulder height and the shoulder pivot sat at 0.512m, so
        // the upper arm STARTED inside the food and everything below it was
        // deeper still — delivered footprint 0.241 (upper arm), 0.000 (forearm),
        // 0.130 (mitt). 0.615m puts the pivot 0.08m outside the mass, which is
        // about 0.4 of an arm radius: the arm still overlaps the body at the
        // shoulder (so it reads as attached) and clears it everywhere below.
        //
        // This is only safe because `bodies.ts` no longer ties `torsoWidth` to
        // `shoulderWidth` — before that, widening the shoulders by 0.10m widened
        // the bottom bun by 0.16m and the arm ended up exactly as buried.
        //
        // ── 0.30H -> 0.33H, and the reason is the OTHER instrument ────────────────
        // `341ce8f` measured interpenetration across a whole animation cycle for the
        // first time (`rg_interpen`, exact to its 1/32 quantisation) and named this
        // character's two worst pairs explicitly: `handR~thighR` **0.727 idle / 0.909
        // run** — 73-91% of the mitt's centreline INSIDE its own thigh — with the fix
        // routed here because "17 degrees of splay cannot close a quarter-metre. These
        // need `shoulderWidth` up or `stanceWidth` down." Both, here: the deficit is
        // -0.262 m and each move alone is inside it.
        // Burial re-checked, because that is what 0.30H was bought with: the stack is
        // 0.534 m half-wide at shoulder height, so 0.6765 m puts the pivot 0.143 m
        // outside it while the arm's own 0.174 m radius still reaches 0.031 m INTO the
        // mass — the arm reads attached and clears below, which is the same condition
        // 0.615 m was chosen to satisfy.
        shoulderWidth: H * 0.33,
        // ── `armFraction` 0.175 (STOUT) -> 0.225, character-local, exactly as SOUP ──
        // The remaining pair the elbow could not touch: `handL~upperArmL` **0.515**
        // held at 0.515 after `elbowL` went -0.95 -> -0.58, which falsifies the elbow
        // as its cause. The real one is arithmetic and angle-independent: STOUT gives
        // `forearmLength` 0.1711 m against a `handRadius` of 0.1947 m, so the mitt's
        // TOP sits 0.024 m ABOVE its own elbow at every pose. `bodies.ts:105` already
        // names this exact shape — *"on three of the four, the HAND BALL is wider than
        // the whole forearm is long, so the segment has no visible middle at any camera
        // angle"* — and records soup fixing it character-locally at `armFraction:
        // 0.245` rather than in the archetype, because moving it there moves nine
        // characters at once. Same fix, same reason. 0.225 puts the forearm at 0.220 m,
        // 1.13x the mitt radius, so the segment has a middle again.
        armFraction: 0.225,
        // 0.215H -> 0.30H. STOUT's own note says a planted character stands wide and
        // that this is the one place where the silhouette fix and the burial fix are
        // the same change; the shipped facing says it was not wide enough. Moved in
        // this file rather than in `bodies.ts` so soup and taco each carry their own
        // measurement.
        // ⚠️ 0.30H -> 0.24H. The sentence above is still true about the SILHOUETTE and
        // was wrong to be spent on the arm: a wider stance walks the thigh INTO the
        // hand, and the hand is the thing that was buried.
        // ⚠️ AND THE REASON I FIRST WROTE HERE WAS FALSE, so it is corrected rather than
        // deleted: *"narrowing also deepens the crotch concavity, which is the one place
        // hull deficiency is bought cheaply."* Measured, same tree, only this constant
        // swapped (`ch_hamburger_sil.mjs`, offline raster, drift control 0 by
        // construction): hull deficiency at 0.30H vs 0.24H is **0.2953 -> 0.2700**
        // (lobby yaw 0) and **0.2244 -> 0.2049** (match). Narrowing the stance COSTS
        // hull deficiency at both shipped cameras. It is still the right move — it buys
        // 0.42 of `insideFrac` on the pair Uri actually reported — but it is paid for,
        // not free, and the leaf placement below is where it was paid back.
        //
        // ── THE THREE KNOBS ABOVE ARE ONE DECISION, and they fight ────────────────
        // Lengthening the arm fixes the mitt-in-biceps and drives the hand FURTHER
        // DOWN into the thigh — `docs/LESSONS.md` §7 exactly. Measured together
        // (`rg_interpen --ids hamburger`, whose `insideFrac` is EXACT to its 1/32 =
        // 0.031 quantisation, so every move below is real):
        //
        //   shoulderW  stanceW  armF   worst idle   worst run
        //     0.30H     0.30H   0.175    0.727        0.909   <- HEAD, all three defects
        //     0.33H     0.27H   0.175    0.515        0.545
        //     0.33H     0.27H   0.225    0.758        0.545   <- the arm undoing the legs
        //     0.33H     0.24H   0.200    0.424        0.333
        //     0.33H     0.24H   0.225    0.303        0.333   <- SHIPPED
        //     0.33H     0.24H   0.240    0.333        0.364
        //
        // Offending pairs 5 -> 3 (idle) and 6 -> 2 (run); `forearmR~thighR` 0.697 and
        // `handL~thighL` 0.364 leave the table entirely. ⚠️ `shoulderWidth` is CAPPED
        // by attachment, not by the metric: the sweep's best leg numbers are at 0.39H,
        // which puts the arm's inner surface 0.09 m CLEAR of the food and detaches the
        // limb — the defect Uri actually reported. 0.33H is the widest value that still
        // overlaps.
        stanceWidth: H * 0.24,
      }),
      // Grill-master swagger: weight planted and leaning in over the flat-top,
      // one arm cocked back with the spatula ready, the other tucked in tight —
      // an art director's second pass named the cast's identical dead-front
      // symmetric pose as a top gap, and Hamburger's read (short-order cook,
      // mid-flip) is the most physically confident stance in this file's cast.
      //
      // ── The left arm was inside the burger ──────────────────────────────────
      // `shoulderL` was +0.46, and `docs/LESSONS.md` §12 is explicit about what a
      // positive value there does: `shoulderL` is the joint at x = -shoulderWidth,
      // so a POSITIVE z-rotation swings that arm ACROSS the body. "Tucked in
      // tight" was authored as a pose and rendered as a deletion — the silhouette
      // shot `shots/probe/sil/hamburger.png` has no left arm at all.
      //
      // The swagger is kept; it is now carried by the ELBOW (which still tucks
      // hard at -0.95) and by the asymmetry between the two shoulders, rather
      // than by burying one whole limb. Both shoulders now open outward.
      stance: {
        // ── `shoulderR` -0.26 -> +0.20: round 1 missed this one ──────────────────
        // `docs/LESSONS.md` §12 — `shoulderR` sits at x = +shoulderWidth, so a
        // NEGATIVE z-rotation swings that arm ACROSS the body. Round 1 opened
        // `shoulderL` outward and left `shoulderR` swinging 0.26 rad inward, right
        // over the right thigh. It shows up not on the arm (which measured 0.899
        // delivered — it is in FRONT, so it is perfectly visible) but underneath it:
        // `hipR` delivered **0.000** of a 4,697 px footprint while the food mass
        // covered only 0.343 of it. The occluder was the character's own 0.195 m
        // bun-mitt, which is wider than the thigh it hangs over.
        // ── `elbowL` -0.95 -> -0.58, and it is the pair the SOLVER refuses to fix ──
        // `341ce8f`: "The mitt folds back into its own biceps. `handL~upperArmL`
        // **0.515** on hamburger... Cause is the authored elbow tuck — hamburger's
        // `elbowL: -0.95` is 54 degrees, and at that fold a mitt of `handRadius` 0.195
        // against a `forearmLength` shorter than it reaches the upper arm. Splay cannot
        // fix it and the solver correctly REFUSES to splay further because of it (that
        // pair is in its objective). **The lever is the elbow, in the character file.**"
        // The tuck is the grill-master swagger and is kept — 33 degrees still reads as
        // an arm cocked in, it just no longer puts the mitt inside the biceps.
        shoulderL: -0.38, shoulderR: 0.20,
        elbowL: -0.58, elbowR: -0.22,
        twist: -0.12, headTilt: -0.07, headTurn: 0.20,
        hipSway: 0.06, lean: 0.06,
        // Grill-master weight, planted. Measured at the shipped facing: hull
        // deficiency 0.1156 base -> 0.1283 at splay alone -> 0.1542 with the wider
        // stance under it, islands 1 throughout.
        splay: 0.34,
      },
    });
    this.body.add(this.rig.joints.root);
    this.head = this.rig.joints.head; // free counter-lean/tilt from BaseCharacter

    const R = this.rig.headRadius;
    const head = this.rig.joints.head;

    // ── Material differentiation ──────────────────────────────────────────
    // Every layer gets its OWN roughness so the stack reads as different
    // SUBSTANCES — bread, meat, veg, dairy, tool — instead of one glossy
    // plastic shader repeated in different colours.
    const bunMat = toonMat({ color: PALETTE.bun, ramp: RAMP_CHARACTER(), roughness: 0.85 }); // dry, matte-baked crust
    const bunDarkMat = toonMat({ color: BUN_DARK, ramp: RAMP_CHARACTER(), roughness: 0.85 });
    const pattyMat = toonMat({ color: PATTY, ramp: RAMP_CHARACTER(), roughness: 0.55 }); // seared, faintly greasy meat
    const pattyDarkMat = toonMat({ color: PATTY_DARK, ramp: RAMP_CHARACTER(), roughness: 0.55 });
    const cheeseMat = glossyMat({ color: PALETTE.cheese, roughness: 0.35, rim: true }); // soft melt sheen
    const tomatoMat = glossyMat({ color: PALETTE.tomato, roughness: 0.18, rim: true }); // wettest surface on the model
    const lettuceMatA = toonMat({ color: LETTUCE, ramp: RAMP_CHARACTER(), roughness: 0.6 }); // leafy, satin not shiny
    const lettuceMatB = toonMat({ color: LETTUCE_FRILL, ramp: RAMP_CHARACTER(), roughness: 0.6 });
    const seedMat = toonMat({ color: PALETTE.cream, ramp: RAMP_CHARACTER(), roughness: 0.75 }); // dry toasted sesame
    const faceMat = toonMat({ color: PALETTE.ink, ramp: RAMP_CHARACTER(), roughness: 0.42 });
    // ── THE FACE'S OWN VALUE LADDER ───────────────────────────────────────────
    // The measurement behind Uri's *"drawn lines and not an actual face"*
    // (DECISIONS §37/§42): **0% of our eye pixels are above 0.85 luma, against the
    // reference's 31.1% and 34.1%.** The face carried exactly TWO values — orange bun
    // and near-black ink — so the largest, brightest, highest-contrast element of a
    // reference face was simply absent. These five materials are that missing ladder,
    // and `egg.ts:1032` is the construction they are copied from (sclera / pupil /
    // explicit glint as three separate meshes, which is why Uri ranked egg's eyes best
    // in the cast without seeing any code).
    //
    // `scleraMat` is a lit `toonMat` so the eye turns with the light like a ball, and
    // the GLINT is `flatMat` — unlit, so it is 1.0 luma by construction at every angle.
    // A shaded white alone cannot GUARANTEE the >0.85 band on the shadow side, and the
    // whole point of this pass is that the band exists.
    const scleraMat = toonMat({ color: '#FFFFFF', ramp: RAMP_CHARACTER(), roughness: 0.28 });
    const pupilMat = toonMat({ color: PALETTE.ink, ramp: RAMP_CHARACTER(), roughness: 0.22 });
    const glintMat = flatMat('#FFFFFF');
    // The mouth's INTERIOR. `#2E0A0B` is deliberately warmer than `PALETTE.ink`, not
    // darker for its own sake: a throat is a lit cavity, and an ink-black hole reads as
    // a punched-out shape rather than an opening. The tongue and the lit lower lip are
    // the two steps that turn "a flat dark shape with no lip thickness or interior
    // value step" (the per-part pass's exact words) into a mouth.
    const throatMat = toonMat({ color: '#2E0A0B', ramp: RAMP_CHARACTER(), roughness: 0.5 });
    const tongueMat = toonMat({ color: '#C2453B', ramp: RAMP_CHARACTER(), roughness: 0.38 });
    const lipMat = toonMat({ color: '#FFDCA6', ramp: RAMP_CHARACTER(), roughness: 0.55 });
    const blushMat = flatMat('#FF9EC4', { transparent: true, opacity: 0.45 });
    // `depthWrite: false`: a transparent material that still writes depth is a
    // SILENT OCCLUDER — `docs/LESSONS.md` §1 names it explicitly, and every
    // transparent material in the cast was carrying the default `true`.
    blushMat.depthWrite = false;
    // Spatula — the held prop. Deliberately NOT a food material: brushed metal +
    // dark plastic reads as "tool", sells Patty Smash as an ability, and gives the
    // silhouette a landmark nothing else in a roster of round food blobs would have.
    // ── ⚠️ THE HANDLE WAS THE SAME VALUE AS THE ARM HOLDING IT ────────────────
    // `#3B2A22` is luma 0.175. `LIMB_TOAST_DARK`, the forearm the handle is drawn
    // against for most of its length, is `#3E1F09` — luma 0.146. **A 0.03 separation**,
    // which is a quarter of the 0.10 floor `valuescan` uses for a part boundary. So the
    // handle was invisible and the blade appeared to float: exactly Uri's *"I don't
    // understand what the silver/grey element"* read, since a blade with no visible
    // handle is not a spatula, it is a shard. `docs/LESSONS.md` §1, "contrast, blending,
    // colour" — the fifteenth entry on that list is this same prop's blade.
    // `#4A5560` is luma 0.32 and, more importantly, COOL: it separates from the
    // near-black forearm by value AND from every warm tone on this character by hue,
    // and it puts the handle in the same steel family as the blade so the two read as
    // one tool in two values rather than as two objects.
    const spatulaHandleMat = toonMat({ color: '#4A5560', roughness: 0.55 });
    // Metalness was 0.55 and the blade rendered as a near-BLACK wedge in every
    // shot — a metal with no strong environment reflection has almost no diffuse
    // term left to light, so the one prop that is supposed to be the roster's
    // silhouette landmark read as an axe head cut out of the sky. This is the
    // "rendering but invisible" failure in its dark-on-light costume. Steel is
    // now carried by a bright albedo and a tight specular, not by metalness.
    // #E9EEF5 is luma 0.93 — within a few percent of the top of the range, so the
    // blade had no headroom to shade INTO and every lit angle resolved to "white".
    // #B9C4D2 is luma 0.76: still unmistakably bright steel against the burger's
    // warm palette, with room for both a highlight and a turn into shadow. Paired
    // with the curl below, that is what makes it stop reading as a flat plate.
    // (The value pass that gave this character its dark rung measured a variant at
    // #8894A4. It was worth 0.002 of P05 and it walks straight back toward the
    // near-black-metal defect the paragraph above records, so it was NOT taken.)
    const spatulaBladeMat = toonMat({ color: '#B9C4D2', roughness: 0.3, metalness: 0.06 });
    const spatulaSlotMat = toonMat({ color: '#8F98A4', roughness: 0.45, metalness: 0 });
    // Apron — the costume layer. A second independent art-director pass named the
    // complete absence of any costume/accessory layer as the cast's top remaining
    // gap: personality was coming entirely from the food mass, with nothing worn.
    // A bib apron is the single most legible costume for a short-order cook — hard
    // straight edges and a real pocket break the bottom bun's round silhouette,
    // and it reads instantly even at gameplay distance.
    //
    // ── The apron was RED, and red is already a burger layer ─────────────────
    // At #D2453A it sat within a few units of `PALETTE.tomato` (#E63946), so the
    // tomato slice and the apron fused into one continuous red cylinder running
    // from the lettuce down to the shoes — and because the apron is the widest
    // thing on the model it also hid the bottom bun completely. Rendered, the
    // character read as "a bun balanced on a red barrel", i.e. a burger with no
    // bottom half at all. Colliding a costume colour with a FOOD colour costs
    // more than the costume buys.
    //
    // Cream body with a deep-red hem/tie keeps the cook read (it is still
    // unmistakably an apron), moves the garment a full value step AWAY from
    // every bun/patty/tomato tone instead of into one, and the narrower, shorter
    // panel below now leaves the toasted bottom bun visible at both sides and
    // underneath — so the stack reads as a whole burger again.
    const apronMat = toonMat({ color: '#FFF3DE', roughness: 0.8 });
    const apronTrimMat = toonMat({ color: '#B5342B', roughness: 0.72 });
    const apronPocketMat = toonMat({ color: '#B5342B', roughness: 0.78 });

    // ── Vertical layout ──────────────────────────────────────────────────────
    // See the file-level comment for the full derivation. BASE_Y anchors the
    // patty's underside at the rig's own SHOULDER height (not the torso top) so
    // the arms emerge from the seam between the two buns.
    //
    // Solved from `rig.metrics` rather than from hand-mirrored copies of the
    // rig's constants (which is what this used to do, down to a `const rigHeight
    // = 1.95; // must match proportions.height above`). Bodies now come from an
    // archetype, so any hardcoded mirror is a latent bug: it would still compile,
    // still render, and quietly put the patty in the wrong place.
    //
    // In head-local space the head origin sits at `metrics.headCentreY`; the
    // shoulder joint sits at `metrics.hipY + metrics.shoulderY`. The difference
    // lands the patty's BOTTOM edge exactly level with the shoulder. Rendered,
    // that wasn't enough: the shoulder joint is the TOP of the visible arm mound
    // (the arm mesh hangs DOWN from it), so the arm's own visible bulk still sat
    // entirely below the patty, reading as attached to the bottom bun rather than
    // to the seam. `SEAM_EMBED` pulls the patty (and everything above it) down
    // further so the patty layer itself — not just its lower edge — surrounds the
    // arm's attachment point, with the cheese poking out just above the arm mound.
    const M = this.rig.metrics;
    const SEAM_EMBED = R * 0.3077;
    const BASE_Y = (M.hipY + M.shoulderY) - M.headCentreY - SEAM_EMBED;
    // Layer heights are multiples of R so the whole stack scales with the head.
    // They were absolute metres until the archetype retrofit, which made this the
    // shortest character in the cast by 30cm — the stack could not grow with the
    // rig, so every proportion change shrank the burger relative to its own body.
    // The ratios below are the old constants divided by the old R (0.4875), so at
    // that R the geometry is unchanged.
    const PATTY_H = R * 0.4103;
    const CHEESE_H = R * 0.1949;
    const TOMATO_H = R * 0.2564;
    const LETTUCE_H = R * 0.2872;
    const CROWN_H = R * 0.8205;

    // ── Radii carry the SILHOUETTE, and they were all within 20% of each other ─
    // Rendered as pure black, this character was a featureless column: crown
    // 0.66R, cheese 0.72R, frill 0.74R and the bottom bun below them all landed
    // inside a 12% band, so the six-layer stack that is the entire point of a
    // burger contributed nothing to the outline. It was the only one of these
    // five whose silhouette a viewer could not name.
    //
    // A burger reads from its STEP PROFILE: a broad domed crown overhanging a
    // narrower patty, with the lettuce frill flaring out past both. Those three
    // now span 0.60R to 0.88R, which puts real scallops on the edge, and the
    // wider crown also buys a ~20% bigger face (`faceScale` is derived from
    // `CROWN_BASE_R`) at a framing where the face is a few dozen pixels.
    const PATTY_R = R * 0.60;
    const CHEESE_R = R * 0.74;
    const TOMATO_R = R * 0.63;
    // ── 0.56R -> 0.70R, and it closes a floating leaf ─────────────────────────
    // At 0.56R the base disc ended 0.10R INSIDE the nearest frill blob's inner
    // surface (worst case `0.78 * 0.95 - 0.079 * 0.8 = 0.678R`), so at the
    // character's silhouette edge — where nothing else of the burger is at that
    // height, the tomato below being 0.63R and the crown above only starting at
    // `crownBaseY` — a leaf had clear background on both sides of it. Measured
    // (`tools/tmp/detach.mjs`, which ablates one mesh at a time out of the SHIPPED
    // render rather than trusting an ID buffer): an **877 px connected component
    // consisting of exactly one `lettuce_frill` and its outline hull**, i.e. a green
    // pea floating in mid-air beside the burger. That is the failure mode the frill
    // loop's own comment warns about, and it was live.
    //
    // 0.70R guarantees every blob overlaps the disc radially with margin, and it is
    // still under the cheese (0.74R) and the crown (0.82R), so the step ladder and
    // the outer silhouette — which the frill flare and the crown set, not this — do
    // not move. What it does change is the read between the leaves: a solid green
    // collar instead of background, which is what "leaf collar, not a ring of peas"
    // asked for in the first place.
    // ── 0.70R -> 0.74R, and it is the SAME defect a third time ────────────────
    // Shrinking the lettuce POINTS (see `buildSilhouetteEvents`) stopped them bridging
    // the frill ring, and one blob immediately became a **197 px detached island** at
    // the lobby camera — measured, and NAMED, by `ch_hamburger_sil.mjs`. 0.70R
    // guaranteed radial overlap against the frill's own geometry; it did not guarantee
    // it against the CAMERA, which is the third time this character has shipped a
    // floating green component. 0.74R equals the cheese above it, so the step ladder
    // (0.60 patty / 0.74 cheese / 0.63 tomato / 0.82 crown) is unchanged.
    const LETTUCE_BASE_R = R * 0.74;
    // The frill must stay INSIDE the crown's own radius at mouth height
    // (~0.81R, see `crownSurface` at hFrac 0.25) or a leaf sits in front of the
    // face. 0.78R is the largest flare that clears it.
    const LETTUCE_FRILL_R = R * 0.78;
    const CROWN_BASE_R = R * 0.82;

    const pattyY = BASE_Y;
    const cheeseY = pattyY + PATTY_H;
    const tomatoY = cheeseY + CHEESE_H;
    const lettuceY = tomatoY + TOMATO_H;
    const crownBaseY = lettuceY + LETTUCE_H;
    const CROWN: CrownSize = { baseR: CROWN_BASE_R, h: CROWN_H };
    // Scale every face-feature offset/size against the tuned-for-0.62 original so
    // the "well-solved face" keeps its proportions on the smaller rig-era crown.
    const faceScale = CROWN_BASE_R / 0.62;

    // ── Patty ─────────────────────────────────────────────────────────────────
    const patty = new THREE.Mesh(roundedPuck(PATTY_R, PATTY_H, PATTY_R * 0.11), pattyMat);
    patty.name = 'patty';
    patty.position.y = pattyY;
    patty.castShadow = true;
    patty.receiveShadow = true;
    head.add(patty);

    // Grill marks — thin embedded strips, decals so they don't want their own outline.
    for (const gx of [-0.55, 0.03, 0.5]) {
      const mark = new THREE.Mesh(new THREE.BoxGeometry(0.07, 0.02, PATTY_R * 1.5), pattyDarkMat);
      mark.name = 'grill_mark__no_outline';
      mark.userData.noOutline = true;
      mark.rotation.y = Math.PI / 5;
      mark.position.set(gx * PATTY_R, pattyY + PATTY_H - 0.04, 0);
      mark.receiveShadow = true;
      head.add(mark);
    }

    // ── Cheese — a real melted slab with body, overhanging the patty/tomato
    // edge so it drapes rather than reading as a coloured seam line. ───────────
    const cheese = new THREE.Mesh(roundedPuck(CHEESE_R, CHEESE_H, CHEESE_R * 0.08), cheeseMat);
    cheese.name = 'cheese';
    cheese.position.y = cheeseY;
    cheese.castShadow = true;
    cheese.receiveShadow = true;
    head.add(cheese);
    // Kept off dead-centre-front/back (theta ~1.57/4.71) so they read as melt
    // dripping down the sides rather than fangs hanging under the face.
    const dripAngles = [0.5, 1.15, 2.2, 2.85, 3.6, 4.25, 5.3, 5.95];
    for (let i = 0; i < dripAngles.length; i++) {
      const a = dripAngles[i];
      const len = (0.055 + (i % 3) * 0.02) * (CHEESE_R / 0.68);
      const dripR = 0.05 * (CHEESE_R / 0.68);
      const drip = new THREE.Mesh(new THREE.SphereGeometry(dripR, 10, 10), cheeseMat);
      drip.name = 'cheese_drip';
      drip.position.set(Math.cos(a) * CHEESE_R * 0.97, cheeseY - len * 0.7, Math.sin(a) * CHEESE_R * 0.97);
      drip.scale.set(1, len / dripR, 1);
      drip.castShadow = true;
      drip.receiveShadow = true;
      head.add(drip);
    }

    // Two long melted-cheese drips, positioned directly at the arm's own side
    // (straight out to the left/right where the shoulders actually are) and
    // reaching from the cheese layer DOWN PAST the patty's own underside — into
    // the arm mound itself, not just down to its top edge — the visual bridge
    // that sells "arms emerge from between the bun layers" rather than from a
    // bare torso.
    const dripTopY = cheeseY;
    const dripBottomY = BASE_Y - R * 0.1846; // sinks past the patty's underside, into the arm mound
    const shoulderDripLen = Math.max(0.05, dripTopY - dripBottomY);
    for (const sx of [-1, 1] as const) {
      const drip = new THREE.Mesh(new THREE.CapsuleGeometry(CHEESE_R * 0.085, shoulderDripLen, 4, 8), cheeseMat);
      drip.name = 'shoulder_cheese_drip';
      drip.position.set(sx * CHEESE_R * 0.92, (dripTopY + dripBottomY) / 2, CHEESE_R * 0.14);
      drip.castShadow = true;
      drip.receiveShadow = true;
      head.add(drip);
    }

    // ── Tomato — glossy, peeks slightly beyond the patty/cheese edge ────────
    const tomato = new THREE.Mesh(roundedPuck(TOMATO_R, TOMATO_H, TOMATO_R * 0.1), tomatoMat);
    tomato.name = 'tomato';
    tomato.position.y = tomatoY;
    tomato.castShadow = true;
    tomato.receiveShadow = true;
    head.add(tomato);
    for (const [sx, sz] of [[0.22, 0.4], [-0.28, 0.32], [0.05, -0.42], [-0.15, -0.3]]) {
      const seed = new THREE.Mesh(new THREE.SphereGeometry(0.023, 8, 8), seedMat);
      seed.name = 'tomato_seed__no_outline';
      seed.userData.noOutline = true;
      seed.position.set(sx * TOMATO_R, tomatoY + TOMATO_H * 0.55, sz * TOMATO_R);
      seed.scale.set(1, 0.5, 1);
      seed.receiveShadow = true;
      head.add(seed);
    }

    // ── Lettuce — solid base disc + a ruffled ring of frill blobs sitting in
    // the upper portion of the band, so it reads as a leaf collar peeking out
    // from under the crown, not a flat green wafer. ─────────────────────────
    // 0.48 -> 0.86 of the band. The frills are centred at `0.52 * LETTUCE_H` with up
    // to `±0.26 * LETTUCE_H` of jitter, so a high, small blob's underside sat at
    // `0.61 * LETTUCE_H` — above a disc that stopped at `0.48`. The radial fix above
    // does not help a leaf that misses the disc VERTICALLY, and both gaps had to
    // close for the component to merge. 0.86 still leaves the crown (which starts at
    // `1.0 * LETTUCE_H`) sitting visibly ON the lettuce band rather than in it.
    const lettuceBaseH = LETTUCE_H * 0.86;
    const lettuceBase = new THREE.Mesh(roundedPuck(LETTUCE_BASE_R, lettuceBaseH, LETTUCE_BASE_R * 0.07), lettuceMatA);
    lettuceBase.name = 'lettuce_base';
    lettuceBase.position.y = lettuceY;
    lettuceBase.castShadow = true;
    lettuceBase.receiveShadow = true;
    head.add(lettuceBase);

    // ── Ruffled leaves, NOT a ring of identical peas ─────────────────────────
    // A blind critic reading this character named its worst defect as an
    // unintended SECOND FACE: the bun carries the real one, and directly below
    // it the layer band drew another dark horizontal smile-shape at the same
    // scale, so the eye kept landing on the wrong one. The mechanism was this
    // loop — sixteen equal blobs at one radius and one height traced a perfectly
    // even horizontal line all the way round the model, and an even horizontal
    // line under a face is a mouth.
    //
    // Nine leaves of deliberately unequal size, radius and height break that
    // line into a ruffle. Irregularity is doing real work here, not decoration:
    // the defect was the REGULARITY.
    //
    // Sized carefully: a first attempt at this went to 0.15 base radius on a
    // 0.88R ring and the leaves came out as 0.34 m green boulders standing
    // FURTHER forward than the crown's own face surface — so one of them parked
    // itself directly over the mouth. Breaking up a false mouth is worthless if
    // the fix hides the real one. The band now sits inside the face's radius by
    // construction (see `LETTUCE_FRILL_R` above, held below the crown's radius
    // at mouth height) and the leaves are back to a believable leaf size.
    const frillCount = 12;
    const frillCenterY = lettuceY + LETTUCE_H * 0.52;
    const frillR = 0.088 * (LETTUCE_FRILL_R / 0.68);
    for (let i = 0; i < frillCount; i++) {
      const a = (i / frillCount) * Math.PI * 2 + 0.35;
      // Deterministic but incommensurate jitter, so no two neighbours match and
      // the pattern never resolves into a repeat.
      // Jitter bands are tight on purpose. At ±0.12 of the ring radius the
      // outermost leaves lost contact with the band behind them and read as
      // peas floating in mid-air next to the burger — irregularity has to stay
      // inside the shape it is varying.
      const sizeJ = 0.78 + 0.42 * Math.abs(Math.sin(i * 2.399));
      const radJ = 0.95 + 0.09 * Math.abs(Math.cos(i * 1.71));
      const yJ = (Math.sin(i * 3.13) * 0.5 + Math.sin(i * 1.09) * 0.5) * LETTUCE_H * 0.26;
      const frill = new THREE.Mesh(new THREE.SphereGeometry(frillR * sizeJ, 10, 8), i % 2 === 0 ? lettuceMatA : lettuceMatB);
      frill.name = 'lettuce_frill';
      frill.position.set(
        Math.cos(a) * LETTUCE_FRILL_R * radJ,
        frillCenterY + yJ,
        Math.sin(a) * LETTUCE_FRILL_R * radJ
      );
      frill.scale.set(1, 0.62, 0.8);
      frill.rotation.set(Math.sin(i * 2.11) * 0.35, a, Math.cos(i * 1.87) * 0.30);
      frill.castShadow = true;
      frill.receiveShadow = true;
      head.add(frill);
    }

    // ── Top bun crown, sesame seeds ───────────────────────────────────────────
    const crown = new THREE.Mesh(bunDome(CROWN.baseR, CROWN.h), bunMat);
    crown.name = 'crown';
    crown.position.y = crownBaseY;
    crown.castShadow = true;
    crown.receiveShadow = true;
    head.add(crown);

    // Sesame seeds — hand-placed, deterministic scatter across the crown's upper
    // and side surfaces, kept clear of the face zone (front, lower third).
    // Positions are (theta radians, height fraction 0-1), resolved to an EXACT
    // surface point + normal via `crownSurface` so every seed sits flush on the
    // dome regardless of how sharply the profile curves at that height.
    // ── ⚠️ FOUR OF THESE WERE ON THE FOREHEAD, AND THEY WERE THE BRIGHTEST THING
    //    ON THE FACE. Read the per-part crop (`shots/perpart/face-overall/ours.png`):
    //    near-white seeds sit directly above and BETWEEN the eyes at theta 0.0/±0.5/0.2,
    //    and because the old eyes were ink strokes, the seeds — not the eyes — carried
    //    every high value in the face. That is the same measurement DECISIONS §37
    //    reports from the other end (0% of eye pixels above 0.85 luma) with the
    //    brightness landing on the wrong feature.
    //    The comment above claimed they were "kept clear of the face zone (front, lower
    //    third)". They were clear of the lower third and squarely on the brow line.
    //    Front seeds now start at hFrac 0.82, above the brows; the count stays 16 so
    //    the crown's scatter density is unchanged.
    const seedSpots: Array<[number, number]> = [
      [0.0, 0.97], [0.34, 0.94], [-0.40, 0.95], [1.30, 0.76], [-1.30, 0.76],
      [1.6, 0.56], [-1.6, 0.56], [2.1, 0.46], [-2.1, 0.46], [2.7, 0.55],
      [-2.7, 0.55], [3.1, 0.72], [Math.PI, 0.62], [2.4, 0.84], [-2.4, 0.84], [0.90, 0.88],
    ];
    const seedGeo = new THREE.SphereGeometry(1, 8, 6);
    for (const [theta, hf] of seedSpots) {
      const { pos, normal } = crownSurface(CROWN, theta, hf);
      const seed = new THREE.Mesh(seedGeo, seedMat);
      seed.name = 'sesame_seed';
      seed.position.copy(pos).addScaledVector(normal, 0.006);
      seed.position.y += crownBaseY;
      seed.quaternion.setFromUnitVectors(new THREE.Vector3(0, 0, 1), normal);
      seed.rotateZ(theta * 1.7); // vary tangential spin per seed for a natural scatter
      seed.scale.set(0.03 * faceScale, 0.05 * faceScale, 0.01 * faceScale);
      seed.castShadow = true;
      seed.receiveShadow = true;
      head.add(seed);
    }

    // ── Face — OPEN eyes with a white sclera, and a mouth with an interior ──────
    //
    // ⚠️ THE OLD HEADING SAID "closed happy eyes + small smile" AND IT WAS THE BUG.
    // It is kept one line above because the geometry below was authored against it and
    // because DECISIONS §42 is the reason it changed: Uri ranked seven characters
    // without seeing any code, and his ranking matches `rules.ts`'s one-line `face:`
    // field EXACTLY — *"Closed happy eyes"* -> hamburger, **"the worst part in the
    // character… drawn lines and not an actual face"**; *"Open eyes with highlights"*
    // -> egg, the best face in the cast. Eleven agents implemented their line
    // faithfully. **The line was the problem**, and `rules.ts`'s hamburger `face:` spec
    // has since been rewritten to ask for exactly what is built below.
    //
    // The construction ladder Uri reproduced blind, in his own order:
    //   hamburger  a flattened arc / torus            — a STROKE      <- was here
    //   donut      `SphereGeometry` + a specular      — a bead
    //   taco       a sphere + an explicit glint mesh
    //   egg        sclera + pupil + catchlight, three separate meshes <- copied here
    //
    // What is kept from the old face, because it was right: the SHARED TANGENT FRAME.
    // Mounted on `rig.joints.face`, repositioned to share the crown's exact
    // local frame (same y offset, zero relative rotation — the rig applies all
    // yaw/tilt personality to `head` itself, which both the crown mesh above
    // and this face group inherit identically) so decals computed against the
    // SAME `crownSurface`/`CROWN` used for the mesh land exactly on it.
    //
    // Brows and eyes each anchor through ONE shared tangent-frame group per side
    // (`faceSideG`, built with a single `addCrownDecal` call) rather than being
    // placed independently at different heights on the dome — two different
    // heights on a curved surface produce two different tangent-plane
    // orientations, which is what let a brow's arc swing into its eye's arc on
    // an earlier pass. Eye and brow are children offset along that SAME local Y
    // axis, so they are guaranteed coplanar and a fixed distance apart at every
    // crown rotation and yaw.
    const face = this.rig.joints.face;
    face.position.set(0, crownBaseY, 0);
    face.rotation.set(0, 0, 0);

    // The eye is a BALL, so it can afford to sink into the dome — the sphere's own
    // curvature keeps its rim welded to the crown instead of leaving the gap a flat
    // decal would. `embed` is therefore SMALLER than the mouth's, not larger.
    const EYE_R = 0.108 * faceScale;
    for (const sx of [-1, 1]) {
      const faceSideG = addCrownDecal(face, CROWN, sx * 0.36, 0.62, 0.010 * faceScale);

      const eyeG = new THREE.Group();
      eyeG.position.set(0, -0.050 * faceScale, 0);
      faceSideG.add(eyeG);

      // 1. THE SCLERA — and it is the point of this whole pass. On this orange bun a
      //    white ball is the brightest mass anywhere on the character, which is what
      //    the reference faces do and what ours did not do at all. Slightly taller
      //    than wide and flattened in z so it reads as an eye set in a head rather
      //    than a marble glued to one.
      const sclera = new THREE.Mesh(new THREE.SphereGeometry(EYE_R, 18, 16), scleraMat);
      sclera.name = 'eye';
      sclera.scale.set(1, 1.12, 0.44);
      sclera.castShadow = true;
      sclera.receiveShadow = true;
      eyeG.add(sclera);

      // 2. THE PUPIL — offset UP and FORWARD, per the spec. Up reads as "eager,
      //    looking at you"; a centred pupil reads as a doll and a low one as sad.
      //    Nudged toward the character's own centre line as well, so both eyes agree
      //    on where they are looking instead of staring outward in parallel.
      const pupil = new THREE.Mesh(new THREE.SphereGeometry(EYE_R * 0.52, 14, 12), pupilMat);
      pupil.position.set(-sx * EYE_R * 0.10, EYE_R * 0.20, EYE_R * 0.50);
      pupil.scale.set(1, 1.14, 0.52);
      pupil.castShadow = true;
      eyeG.add(pupil);

      // 3. THE CATCHLIGHT — an explicit mesh, `flatMat`, so it is 1.0 luma at every
      //    lighting angle. `noOutline`: an ink hull around a 2 mm highlight turns it
      //    grey, which is the failure this exact element exists to avoid.
      // ── ⚠️ AND IT WAS 1.0% OUTSIDE ITS OWN PUPIL. LATENT PAC-MAN. ─────────────
      // The same defect `fb9d9da` fixed on egg, `75daec3` on pizza and found on hotdog
      // at 0.0003 of margin. This face is the fourth from that recipe. The pupil is an
      // ELLIPSE — `SphereGeometry(EYE_R * 0.52)` scaled 1.14 in y — so the rim is not a
      // single number and the naive circular check passes it. In units of `EYE_R`:
      //
      //   pupil semi-axes            a = 0.520   b = 0.593  (0.52 * 1.14)
      //   glint offset from pupil    (0.200, 0.260)  ->  |d| = 0.3280, dir (0.610, 0.793)
      //   pupil rim along that dir   0.5623
      //   glint outer edge           0.3280 + 0.240 = 0.5680     +0.0057 = 1.0% PAST
      //
      // It does not render as an obvious bite only because the lash covers the top of
      // the pupil, which is luck, not margin — exactly hotdog's situation.
      // Pulled to 82% of the rim (the number pizza's fix settled on): |d| 0.3280 ->
      // 0.2210, outer edge 0.4610, an 18% margin.
      // ⚠️ **The RADIUS is deliberately not reduced.** §40 pattern 2 is that ~0% of our
      // eye pixels clear 0.85 luma against the reference's 31%, so shrinking the one
      // pure-white mass on the face to buy margin would pay for this defect with that
      // one. Moving it inward instead should *increase* visible white, because the part
      // that was overhanging the sclera was adding no contrast at all.
      // `z` 0.74 -> 0.769 keeps the 0.0204 of proud clearance it had: the pupil is
      // scaled 0.52 in z, so a light moved toward the axis rides a surface that has
      // risen 0.029 under it, and leaving z alone would sink it into the pupil.
      const glint = new THREE.Mesh(new THREE.SphereGeometry(EYE_R * 0.24, 10, 8), glintMat);
      glint.position.set(-sx * EYE_R * 0.235, EYE_R * 0.375, EYE_R * 0.769);
      glint.userData.noOutline = true;
      glint.name = 'eye_glint__no_outline';
      eyeG.add(glint);

      // 4. THE OLD CLOSED-HAPPY ARC, DEMOTED TO A LASH LINE. `rules.ts`'s rewritten
      //    spec asks for exactly this — *"the old closed-happy arc kept ONLY as the
      //    upper lash line above them"* — and it is worth saying why rather than
      //    deleting it: the arc was never badly built, it was standing in for the
      //    whole eye. Over a sclera it is what a reference eye actually has. The
      //    left/right arc-length asymmetry is kept as the character's own half-wink.
      const lashArc = sx > 0 ? Math.PI * 0.74 : Math.PI * 0.84;
      const lash = new THREE.Mesh(faceArc(EYE_R * 1.02, 0.030 * faceScale, lashArc), faceMat);
      lash.name = 'eye_lash';
      lash.rotation.z = Math.PI / 2;   // arc centred on the top of the eye
      lash.position.z = EYE_R * 0.30;
      lash.castShadow = true;
      eyeG.add(lash);

      // Eyebrow — offset along the SAME local Y the eye is offset along, so the
      // gap between them is fixed and cannot collapse regardless of dome
      // curvature. Cocked higher on the right than the left for a
      // one-eyebrow-raised personality. Thickened and cocked further than the
      // original pass — a second independent art-director round named facial
      // acting as the single biggest appeal gap across the cast, and this face
      // was singled out as the one to keep rather than replace, so the brow gets
      // more read (bolder arc, stronger raise) without changing its shape language.
      // Raised from 0.13 to 0.20 because the eye below it is now a 0.24 m ball
      // rather than a 0.03 m stroke, and a brow resting ON the lash reads as a
      // second lash line rather than as a brow.
      const browG = new THREE.Group();
      browG.position.set(0, 0.112 * faceScale, 0.012 * faceScale);
      faceSideG.add(browG);
      // ── ⚠️ THE BROW WAS NEVER ARCHED. IT WAS A COMMA. ─────────────────────────
      // `faceArc()` centres its arc on local +X (see its own doc comment) and the
      // caller is expected to rotate it: the eye's lash uses `rotation.z = PI/2`, which
      // is what turns a piece of a circle into something that bulges UPWARD. The brow
      // used `rotation.z = 0.32` — a 18-degree tilt off +X — so its arc bulged
      // SIDEWAYS and rendered as a short vertical crescent beside the eye. Read
      // `shots/perpart/face-overall/ours.png`: two black apostrophes on the forehead.
      // It has been that shape since the face was built, through a pass that
      // deliberately "thickened and cocked" it, because thickening a comma makes a
      // bolder comma. The tilt is KEPT as the one-eyebrow-raised personality it was
      // authored for; it is now a tilt applied to an arch instead of instead of one.
      // Also 1.9x wider (0.09 -> 0.13 curve radius, arc 0.36PI -> 0.52PI): the eye
      // below it went from a 0.03 m stroke to a 0.23 m ball, and a brow narrower than
      // a third of its eye reads as a speck.
      const brow = new THREE.Mesh(faceArc(0.13 * faceScale, 0.030 * faceScale, Math.PI * 0.52), faceMat);
      brow.name = 'brow';
      brow.rotation.z = Math.PI / 2 + (sx > 0 ? 0.32 : 0.05);
      brow.castShadow = true;
      brow.receiveShadow = true;
      browG.add(brow);

      // Blush, pushed out to 0.68 rad and down: the eye is nearly three times its old
      // width, and at 0.60 the disc was landing under the sclera's own outer edge.
      const blushG = addCrownDecal(face, CROWN, sx * 0.68, 0.28, 0.004 * faceScale);
      const blush = new THREE.Mesh(new THREE.CircleGeometry(0.068 * faceScale, 16), blushMat);
      blush.name = 'blush__no_outline';
      blush.userData.noOutline = true;
      blushG.add(blush);
    }

    // ── Mouth — an OPENING with an interior, not a painted curve ────────────────
    // The per-part pass named the old one precisely: *"a flat dark shape with no lip
    // thickness or interior value step."* It was a single ink torus, so the whole
    // mouth carried ONE value and the bun carried the other — the same two-value
    // problem as the eyes, in the same face.
    //
    // Four meshes, four values, ordered outward in z so each one occludes the last:
    //   throat  #2E0A0B  the aperture           (darkest, and warm — a cavity, not a hole)
    //   tongue  #C2453B  low and central        (mid, warm)
    //   lipLow  #F0B778  hugging the lower arc  (LIGHTER than the bun — the lit lip)
    //   lipUp   ink      hugging the upper arc  (the smile line itself)
    //
    // ⚠️ `embed` is 0.026 and not the eyes' 0.010, and the reason is geometric: these
    // are FLAT plates on a dome of radius ~0.57 m, so a plate 0.135 half-wide sags
    // 0.0136 m below its own tangent plane at the corners. Embed less than that and
    // the corners of the mouth clip THROUGH the crown — the mouth would lose its ends
    // and read as a short dash. This is `docs/LESSONS.md` §1 in its "buried inside the
    // target" costume, and it is why the number is derived rather than eyeballed.
    const MW = 0.135 * faceScale;      // half-width
    const MA = 0.030 * faceScale;      // upper-arc sag: shallow, so the corners lift
    const MB = 0.108 * faceScale;      // lower-arc sag: deep, so it is an OPEN grin
    const mouthG = addCrownDecal(face, CROWN, -0.05, 0.25, 0.026 * faceScale);
    // Tilted, keeping the old face's one-sided smirk (playful short-order cook).
    mouthG.rotation.z += 0.14;

    const throat = new THREE.Mesh(new THREE.ShapeGeometry(grinCrescent(MW, MA, MB), 20), throatMat);
    throat.name = 'mouth';
    throat.castShadow = true;
    mouthG.add(throat);

    const tongue = new THREE.Mesh(new THREE.CircleGeometry(MW * 0.30, 18), tongueMat);
    tongue.name = 'mouth_tongue';
    tongue.position.set(0, -MB * 0.56, 0.006 * faceScale);
    tongue.scale.set(1.4, 0.62, 1);
    mouthG.add(tongue);

    // The lower lip: a lens between the aperture's own bottom arc and a deeper one,
    // so it is thickest at the centre and tapers to nothing at the corners — which is
    // what a lip does, and what a constant-width band would not.
    const lipLow = new THREE.Mesh(new THREE.ShapeGeometry(grinCrescent(MW, MB, MB + 0.038 * faceScale), 20), lipMat);
    lipLow.name = 'mouth_lip_lower';
    lipLow.position.z = 0.010 * faceScale;
    lipLow.castShadow = true;
    mouthG.add(lipLow);

    const lipUp = new THREE.Mesh(new THREE.ShapeGeometry(grinCrescent(MW, Math.max(MA - 0.024 * faceScale, 0.002), MA), 20), faceMat);
    lipUp.name = 'mouth_lip_upper';
    lipUp.position.z = 0.010 * faceScale;
    lipUp.castShadow = true;
    mouthG.add(lipUp);

    // ── Body: dress the torso with the bottom bun ─────────────────────────────
    // The strongest characters in this cast extend their food mass down through
    // the body rather than perching a themed head on a generic one — Hamburger
    // is the character that proved that read richest in the first place (a real
    // stacked burger, not a food-headed mannequin), so its bottom bun becomes
    // the torso itself via the rig's own `dressTorso`.
    this.rig.dressTorso((size) => {
      const group = new THREE.Group();
      group.name = 'bottom_bun';
      // Narrower than the crown above it, so the stack steps IN at the waist and
      // back OUT at the bottom bun instead of running straight down.
      const bunR = size.w * 0.53;
      const bunH = size.h * 1.02;
      // ── ❌ A DOMED UNDERSIDE WAS BUILT HERE, RENDERED, AND REVERTED ────────────
      // `roundedPuck(..., bulge = bunH * 0.20)` — 0.10 m of convex bun bottom, aimed
      // at the flat horizontal terminator this body ends in. Rendered at the lobby
      // camera it changed **nothing**: `shots/cx/zoom/hamburger-crotch-ab.png` is two
      // identical panels below the hem. The `bulge` parameter is kept (default 0, a
      // no-op) because the ARITHMETIC is the finding and the next pass should not
      // re-derive it:
      //
      //   A camera pitched `p` below horizontal maps a point to screen height
      //   `y·cos p − z·sin p`. The bun's front-bottom rim is at z ≈ 0.556 m, so it
      //   already buys `0.556·sin20 = 0.190` of downward screen travel FROM ITS
      //   DEPTH. The dome descends on the AXIS, where **z = 0** — it gets none of
      //   that. To reach the screen height the front rim already occupies, the dome
      //   would have to drop `z_front · tan p` = **0.202 m**, which is 75% of the
      //   thigh, i.e. exactly the "mass that hides the leg" failure `rig.ts:1133`
      //   measured on 9 of 11 characters. At the MATCH camera (pitch 58) the same
      //   number is 0.89 m — more than the character has.
      //
      // 🚨 **Anything added on the axis of a body is projected UP-screen relative to
      // that body's own front surface, and the steeper the camera the worse it gets.**
      // Same theorem as `rig.ts:1015`'s collar analysis, which found the same class of
      // fix needed 2.1x-3.5x its size to deliver one pixel. The lever that works at a
      // pitched camera is the FRONT of the mass, never its centre.
      const bottomBun = new THREE.Mesh(roundedPuck(bunR, bunH, bunR * 0.28), bunDarkMat);
      bottomBun.name = 'bottom_bun_mesh';
      bottomBun.position.y = size.h * 0.02;
      bottomBun.castShadow = true;
      // ❌ `receiveShadow = false` WAS TRIED HERE AND THE FRAME DID NOT MOVE.
      // After `BUN_DARK` 0.154 -> 0.299 the bun's SIDES read as warm brown and the
      // legs read as growing out of them, but a near-black band survived across the
      // FRONT of the waist (`shots/cc/zoom/hb-hips-after5.png`). The obvious
      // explanation is that the patty/cheese/tomato/lettuce stack, which is the same
      // radius as this bun and sits directly on it, casts a hard shadow across it.
      // Ablated — shadow receipt off, re-rendered, `shots/cc/zoom/hb-hips-after6.png`
      // — and the two crops are **indistinguishable**. `docs/AGENT-BRIEF.md` §4.2:
      // require the frame to MOVE. It did not, so the hypothesis is wrong and the
      // flag goes back.
      // 🚨 **The band is the PATTY.** `PATTY` is `#2A1408`, luma **0.09**, and the
      // stack order puts it directly under the cheese — so the dark strip at the
      // waist is a correctly-lit surface whose ALBEDO is a void. It sits above the
      // hip line, so it is not what detaches the legs (the bun was), but it is why
      // this character still reads as two objects stacked at the waist. Left alone
      // deliberately: `PATTY`/`PATTY_DARK` are this file's dark rung and the value
      // pass used them to buy `p05`, so moving them is a `valuescan` round of its own
      // and not a free ride on this one.
      // ── ✅ DIAGNOSIS CONFIRMED BY ABLATION; THE PARKING REASON WAS WRONG ────────
      // The paragraph above is kept because its diagnosis is exactly right and its
      // conclusion sent this defect round the loop a third time. Confirmed rather than
      // inferred: `cf_ablate.mjs` paints `patty` alone through the shipped path and the
      // magenta IS that band, cheese-underside to apron-top, while the dark at the hips
      // proper is `bottom_bun_mesh` (`shots/cf/ablate/`). Both were "the black band".
      // 🚨 BUT IT IS NOT "A `valuescan` ROUND OF ITS OWN", AND THAT IS WHY IT SURVIVED
      // THREE PASSES: `valuescan` measures the MATCH camera, where the cheese overhang
      // (0.74R vs the patty's 0.60R) hides this mesh completely — **9,886 px at pitch
      // 20 against 240 px at pitch 58, 0.785% of the frame against 0.019%.** The
      // instrument it was deferred to cannot see it. `PATTY` is now #4A2410 (0.167) and
      // `valuescan` is BYTE-FLAT across the change, which is the proof, not the alarm.
      // ⚠️ `PATTY_DARK` is still untouched and is still shared with `foot`.
      bottomBun.receiveShadow = true;
      group.add(bottomBun);

      // ── Apron: the costume layer ─────────────────────────────────────────
      // Narrower and shorter than the first pass: the bib now covers the front
      // of the bun instead of wrapping most of its circumference, so the bun's
      // own gold reads at both sides and along the bottom and the burger keeps
      // its lowest layer.
      // ── The apron hung BELOW the bun, over the legs ──────────────────────────
      // `roundedPuck` spans 0..height, so the bun runs from `size.h * 0.02` UP.
      // The apron was a `curvedPanel`, which is centred on its own origin, placed
      // at `size.h * 0.02 + bunH * 0.06` — so a 0.70*bunH panel centred there hung
      // 0.30*bunH BELOW the bun's own bottom edge, into the thigh space. Measured:
      // the thighs delivered 0.006 and 0.075 of their footprint and the shins
      // 0.000 and 0.154, which is the cast-wide "feet with no legs" read
      // (`docs/STATE.md` Finding 2) with a garment, not a bun, doing the burying.
      //
      // Centring the panel on the bun's own mid-height puts the whole bib on the
      // bun, where a bib belongs, and hands the legs back their space.
      const apronR = bunR * 1.05;
      const apronArc = Math.PI * 0.50;
      // ── 0.70 -> 0.58, AND IT IS THE LEVER THE AXIAL DOME COULD NOT BE ──────────
      // The bib is drawn on a cylinder at `apronR` — i.e. on the FRONT of the mass,
      // z ≈ 0.58 — which by the projection above is the one place a change reaches
      // the bottom of this character on screen. Its bottom edge, a hard `#B5342B`
      // arc, was sitting only ~9 px above the bun's own rounded rim, so the body
      // terminated in a bright straight-ish red line with background under it and a
      // leg butted against each end. That line IS Uri's *"the legs are disconnected
      // from the body"* at the lobby camera.
      //
      // Shortening the bib is the cheapest possible fix and it ADDS NO MASS: it
      // uncovers ~30 px of the bun's own convex bottom, so the contour under the body
      // becomes the bun's curve instead of the apron's edge. It also moves the
      // garment further from the failure recorded two paragraphs down (an apron
      // hanging into the thigh space, which measured the thighs delivering 0.006 and
      // 0.075 of their footprint) rather than closer to it.
      // ── 0.58 -> 0.46, AND THE HIP IS STILL NOT CLOSED AT 0.58 ──────────────────
      // The paragraph above is right about the mechanism and stopped short of the
      // number. Re-rendered at the lobby camera and zoomed 2x
      // (`shots/cc/zoom/hb-hips-before.png`), the body's lowest contour is STILL the
      // apron: a cream drum with a bright `#B5342B` hem across it, terminating in two
      // hard CORNERS where the panel's arc ends, with the bun's gold curve visible
      // only outboard of those corners. A cream panel that is the widest, lowest and
      // lightest thing on the body is what the eye takes for the bottom of the body,
      // whatever is behind it.
      // 0.46 of the bun's height, raised to sit on the bun's upper half, uncovers
      // roughly twice as much of the bun's own convex rim. It still ADDS NO MASS —
      // the same argument as the 0.70 -> 0.58 step, taken to where the bun actually
      // wins the contour. ⚠️ And it moves the garment further from the failure the
      // paragraph above records (an apron hanging into the thigh space, measured at
      // 0.006/0.075 of thigh footprint delivered), never closer.
      const apronH = bunH * 0.46;
      const bunBaseY = size.h * 0.02;
      const apronY = bunBaseY + bunH * 0.58;
      const apron = new THREE.Mesh(curvedPanel(apronR, apronArc, apronH), apronMat);
      apron.name = 'apron_bib';
      apron.position.y = apronY;
      apron.castShadow = true;
      apron.receiveShadow = true;
      group.add(apron);

      // Cream hem trim along the bottom edge — the second material, so the
      // apron reads as a garment (fabric + trim) rather than a flat colour card.
      const hem = new THREE.Mesh(curvedPanel(apronR * 1.01, apronArc * 0.96, apronH * 0.09), apronTrimMat);
      hem.name = 'apron_hem';
      hem.position.y = apronY - apronH * 0.46;
      hem.castShadow = true;
      group.add(hem);

      // Chest pocket, proud of the bib's own front face — the small detail item
      // that sells "worn garment" up close, on top of the bib's silhouette break.
      const pocket = new THREE.Mesh(roundedBox(apronR * 0.42, apronH * 0.22, apronR * 0.06, apronR * 0.05, 2), apronPocketMat);
      pocket.name = 'apron_pocket';
      pocket.position.set(0, apronY + apronH * 0.08, apronR * 1.02);
      pocket.castShadow = true;
      pocket.receiveShadow = true;
      group.add(pocket);

      // Neck straps rising from the bib's top corners — reads as "tied behind
      // the neck" without needing a literal loop back there.
      // Two blind critics reported these as FLOATING, and an ID-buffer render
      // (`tools/tmp/islands.mjs`) confirmed it: they were their own connected
      // components in the silhouette, 857 px and 510 px of apron hanging in space.
      // The cause was the same off-by-a-panel as the bib — the strap was centred
      // 0.62 of a bib-height above a bib whose own top edge was only 0.50 above
      // that origin, so it started ABOVE the garment it is tied to. Longer, and
      // seated lower, so its bottom third is inside the bib by construction.
      for (const sx of [-1, 1] as const) {
        const strap = new THREE.Mesh(new THREE.CapsuleGeometry(apronR * 0.075, apronH * 0.62, 4, 8), apronMat);
        strap.name = 'apron_strap';
        const baseTheta = sx * apronArc * 0.42;
        strap.position.set(Math.sin(baseTheta) * apronR, apronY + apronH * 0.50, Math.cos(baseTheta) * apronR);
        strap.rotation.z = sx * 0.55;
        strap.rotation.x = -0.3;
        strap.castShadow = true;
        strap.receiveShadow = true;
        group.add(strap);
      }

      // Waist tie — a bow knotted at the character's left hip, the classic
      // "apron tied at the side" landmark, and a silhouette break independent
      // of the bib itself (visible from the back/side yaw angles too).
      const tieTheta = -apronArc * 0.62;
      // Pulled IN and UP. Measured (`tools/tmp/masssit.mjs`): `apron_tie_loop` was the
      // single widest thing on this character at the hip line — 0.612 m half-width
      // against a 0.435 m stance — and it is knotted on the LEFT hip, which is exactly
      // where `hipL` was delivering 0.429 of its footprint.
      const tieBase = new THREE.Vector3(Math.sin(tieTheta) * apronR * 0.90, apronY + apronH * 0.06, Math.cos(tieTheta) * apronR * 0.90);
      const tieKnot = new THREE.Mesh(new THREE.SphereGeometry(apronR * 0.13, 10, 8), apronTrimMat);
      tieKnot.name = 'apron_tie_knot';
      tieKnot.position.copy(tieBase);
      tieKnot.castShadow = true;
      group.add(tieKnot);
      for (const sx of [-1, 1] as const) {
        const loop = new THREE.Mesh(new THREE.CapsuleGeometry(apronR * 0.06, apronR * 0.24, 4, 8), apronTrimMat);
        loop.name = 'apron_tie_loop';
        loop.position.copy(tieBase);
        loop.position.x += sx * apronR * 0.15;
        loop.position.y += apronR * 0.02;
        loop.rotation.z = sx * 0.85;
        loop.castShadow = true;
        group.add(loop);
      }

      return group;
    });

    // ── Limbs: bespoke, not the shared rig defaults ───────────────────────────
    // An independent art director named the rig's identical capsule-arm/ball-hand/
    // wedge-foot kit as the single biggest "template" tell across the whole cast.
    // Hamburger's limbs are dough: thicker near the body, tapering toward the
    // wrist/ankle, capped with a mini toasted bun for a hand and a mini seared
    // patty (grill mark included) for a foot — the same food language as the
    // stack on `head`, carried all the way down through the body.
    // The mitt is documented as "a mini toasted bun for a hand", but the material
    // wired up was PALETTE.cream — a near-white (#FFF3DE) that, on a rounded dome
    // shape with no other detail, rendered as a pale, featureless blob at gameplay
    // distance (a confirmed defect: it read as nothing, not as a hand). Bun gold
    // actually matches the "toasted bun" description; sesame seeds (added on the
    // mesh below, same technique as the crown's) are what finish selling the shape.
    const mittMat = toonMat({ color: MITT_BUN, roughness: 0.68 });
    const mittSeedMat = toonMat({ color: PALETTE.cream, roughness: 0.75 });
    const limbMat = toonMat({ color: LIMB_TOAST, ramp: RAMP_CHARACTER(), roughness: 0.85 });
    const limbDarkMat = toonMat({ color: LIMB_TOAST_DARK, ramp: RAMP_CHARACTER(), roughness: 0.85 });
    // See `LIMB_THIGH`: the thigh no longer shares the upper arm's material.
    const thighMat = toonMat({ color: LIMB_THIGH, ramp: RAMP_CHARACTER(), roughness: 0.85 });
    this.rig.dressLimbs((part, size) => {
      switch (part) {
        // ── The two TOP segments differ only in how far they reach UP ────────────
        // 10 radial segments -> 20. A blind critic judging the home screen at 1:1
        // named "faceted shoulder normals", and on this character specifically
        // that is arithmetic: STOUT has the thickest limbs in the cast
        // (`armRadius` 0.174m, so this segment is 0.21m across), and 10 segments
        // put a 36-degree crease every 65px at menu size. The rest of the cast
        // gets away with 10 because their limbs are half the width. Costs ~8
        // meshes x ~120 extra triangles against a 295k-triangle match.
        case 'upperArmL': case 'upperArmR': {
          // `rise` 0.32 of the bone, up into the bun seam the arm emerges from. See
          // the SEAM block above: this character's whole arm placement exists to make
          // the arm come out from BETWEEN the bun layers, and a segment whose apex
          // stops dead at the shoulder pivot draws its own closed silhouette right
          // there and undoes it.
          // ── 🚨 1.2/0.84 WAS THE THIGH'S NUMBER TOO, CHARACTER-FOR-CHARACTER ──────
          // Until this round `upperArm` and `thigh` were the SAME call with the SAME
          // material, and `forearm` and `shin` were literally the same `case` block.
          // Four identical orange-over-brown chains; a viewer at the lobby camera
          // cannot say which pair is which, and the honest read of
          // `shots/cc/before/hamburger_p20.png` is a four-legged animal whose front
          // pair happens to end in bun mitts. STOUT makes it worse by archetype:
          // `armRadiusF` 0.085 against `legRadiusF` 0.074, so **the arms were fatter
          // than the legs**, which no animal is.
          // ⚠️ 1.28 WAS TRIED FIRST AND RENDERED AS A MUSHROOM CAP. A top/bottom ratio
          // of 1.78 on a bone this short is not a taper, it is a dome on a stalk:
          // `shots/cc/after3/hamburger_p20.png` shows both upper arms as wide orange
          // caps with a dark rim and a thin brown stem under them. 1.08/0.70 (ratio
          // 1.54, the same as the old 1.2/0.84's 1.43 within a hair) keeps the arm a
          // limb. **The arm/leg separation is carried by the SHAFT, not the shoulder**
          // — the arm's widest point is 1.08 * 0.1785 = 0.193 m and its elbow is
          // 0.118 m, against a thigh at 0.208 m and a shin at 0.154 m, so the leg is
          // 30% thicker where both pairs are simply columns and the eye compares them.
          const geo = taperedSegment(size.len, size.radius * 1.08, size.radius * 0.70, 20, { rise: size.len * 0.32 });
          const m = new THREE.Mesh(geo, limbMat);
          m.name = `${part}_mesh`;
          m.castShadow = true;
          m.receiveShadow = true;
          return m;
        }
        case 'thighL': case 'thighR': {
          // ── 🔴 URI'S §37 REJECT #1, AND THE PELVIS WAS NEVER THE ANSWER ─────────
          // *"It seems like the legs are disconnected from the body."* `fc4d9ad` gave
          // the rig a pelvis mass for this and the render at the lobby camera is
          // unchanged, with the pelvis measured at **0.08% of the silhouette**. The
          // reason is geometric and complete: `rig.ts:1147` sizes the pelvis
          // `(stanceWidth * 0.58 + legRadius * 0.55) * 2` = 0.74 m wide and seats it
          // ABOVE the hip line — and hamburger's dressed torso is the BOTTOM BUN,
          // `bunR = size.w * 0.53` ~ 0.56 m radius, i.e. **1.11 m wide**, whose own
          // base sits at `size.h * 0.02` above that same hip line. The pelvis is
          // enclosed by the bun on every axis. It is not failing to help; it is
          // `docs/LESSONS.md` §1 for the twenty-first time — it is there, and it is
          // invisible, and it always would have been on this character.
          //
          // What the lobby render actually shows (`shots/cx/before/hamburger.png`,
          // zoomed at `shots/cx/zoom/hamburger-hip.png`) is a **flat-bottomed drum
          // with a bright red hem across it and two ball-chains hanging outside its
          // left and right edges**. The body's lowest contour is a horizontal line,
          // each leg is a separate closed outline butted against it, and background
          // shows between them. "Detached" is a CONTOUR failure, not a fill failure,
          // which is why a mass that delivered pixels moved the read by nothing.
          //
          // `rise` 0.34 of the bone puts the thigh's top cap 0.09 m INSIDE the bun.
          // The thigh has no contour of its own until it emerges from under the
          // overhang, so the leg reads as coming out of the body rather than as
          // standing next to it. This is the same lever donut used from the other
          // side (an attachment mass added to the body); here the body mass already
          // exists and overhangs the hip by 0.06 m, so the cheaper half of the pair
          // is to reach the leg up into it.
          // 1.2/0.84 -> 1.34/1.10. The thigh keeps its width all the way to the knee
          // instead of tapering like the arm above; see the upper-arm case for the
          // arm/leg separation this is one half of.
          const geo = taperedSegment(size.len, size.radius * 1.34, size.radius * 1.10, 20, { rise: size.len * 0.34 });
          const m = new THREE.Mesh(geo, thighMat);
          m.name = `${part}_mesh`;
          m.castShadow = true;
          m.receiveShadow = true;
          return m;
        }
        // ⚠️ These two were ONE `case` block sharing one set of radii — the strongest
        // possible statement that a forearm and a shin are the same object, made in
        // the code rather than only in the render. Split, and the numbers now differ:
        // the forearm is the slimmest segment on the character and the shin is nearly
        // as thick as the thigh above it.
        case 'forearmL': case 'forearmR': {
          // A small `rise` here too, for the same reason one segment up: the elbow and
          // knee are the two joints where the previous fix left a double taper meeting
          // at a point (donut's recorded "waist"), and 0.12 of the bone is enough for
          // the lower segment's shoulder to sit inside the upper one's skirt without
          // widening either.
          const geo = taperedSegment(size.len, size.radius * 0.72, size.radius * 0.54, 20, { rise: size.len * 0.12 });
          const m = new THREE.Mesh(geo, limbDarkMat);
          m.name = `${part}_mesh`;
          m.castShadow = true;
          m.receiveShadow = true;
          return m;
        }
        case 'shinL': case 'shinR': {
          const geo = taperedSegment(size.len, size.radius * 1.10, size.radius * 0.88, 20, { rise: size.len * 0.12 });
          const m = new THREE.Mesh(geo, limbDarkMat);
          m.name = `${part}_mesh`;
          m.castShadow = true;
          m.receiveShadow = true;
          return m;
        }
        case 'handL': case 'handR': {
          // The bun crown's own mushroom-cap profile (narrow cuff, bulging
          // "knuckle", rounded tip) doubles perfectly as a mitt shape — flip it
          // so the narrow end sits at the wrist and the bulge/tip hang down.
          // Rotating a wrapper GROUP (rather than the mesh alone, as before)
          // means a handful of sesame seeds can be placed in the same unflipped
          // local frame `crownSurface` expects and still end up correctly
          // oriented after the flip — without seeds, bun colour alone still read
          // as a plain blob at gameplay distance, indistinguishable from the
          // forearm above it.
          //
          // A 180°-about-X flip negates both Y and Z, so a seed placed at the
          // crown's own theta=0 (its FRONT, +Z) ends up facing -Z — away from
          // the camera — after the flip: round 1 of this fix placed seeds at
          // the crown's seed thetas verbatim and every one of them vanished
          // onto the mitt's hidden back face. `cos(theta) < 0` is what lands
          // camera-side post-flip, so every spot here is chosen near theta=π.
          const mittSize: CrownSize = { baseR: size.radius * 1.05, h: size.len * 0.86 };
          const g = new THREE.Group();
          const bun = new THREE.Mesh(bunDome(mittSize.baseR, mittSize.h, 14), mittMat);
          bun.name = `${part}_mesh`;
          bun.castShadow = true;
          bun.receiveShadow = true;
          g.add(bun);
          const mittSeedSpots: Array<[number, number]> = [
            [Math.PI, 0.30], [Math.PI - 0.5, 0.20], [Math.PI + 0.5, 0.20],
            [Math.PI - 1.0, 0.32], [Math.PI + 1.0, 0.32],
          ];
          for (const [theta, hf] of mittSeedSpots) {
            const { pos, normal } = crownSurface(mittSize, theta, hf);
            const seed = new THREE.Mesh(seedGeo, mittSeedMat);
            seed.name = 'mitt_seed';
            seed.position.copy(pos).addScaledVector(normal, 0.006);
            seed.quaternion.setFromUnitVectors(new THREE.Vector3(0, 0, 1), normal);
            seed.scale.set(0.016, 0.03, 0.007);
            seed.castShadow = true;
            g.add(seed);
          }
          g.rotation.x = Math.PI;
          return g;
        }
        case 'footL': case 'footR': {
          const g = new THREE.Group();
          const footR = size.radius * 1.55;
          const footH = size.len * 0.62;
          const foot = new THREE.Mesh(roundedPuck(footR, footH, footR * 0.32, 16), pattyDarkMat);
          // Seated on the floor via `size.groundY` (the joint-local y of the world
          // ground, new on `LimbSize`) rather than by eye. `types.ts` convention #1
          // is "feet at y=0" and the whole cast was 0.08-0.25 m under it; `Math.min`
          // keeps the authored droop as the floor for the value so this can only ever
          // raise a foot, never sink one.
          foot.position.set(0, Math.max(size.groundY, -footH), footR * 0.32);
          foot.name = `${part}_mesh`;
          foot.castShadow = true;
          foot.receiveShadow = true;
          g.add(foot);
          // Grill-mark echo — ties the foot back to the patty it's shaped after.
          const mark = new THREE.Mesh(new THREE.BoxGeometry(footR * 1.7, footR * 0.1, footR * 0.1), pattyMat);
          mark.position.set(0, -footH * 0.55, footR * 0.68);
          mark.userData.noOutline = true;
          g.add(mark);
          return g;
        }
        default:
          return null;
      }
    });

    // ── 🔴 THE SHOULDER BRIDGE IS THE PATTY, NOT THE ARM ──────────────────────
    // `ChibiRig.fitShoulders()` (de4bb11) builds a deltoid per side in `palette.limb`
    // — the UPPER ARM's own tone — because on most of the cast the bridge is the top
    // of the arm. On this character it is not: `SEAM_EMBED` (see the vertical layout
    // above) exists precisely so that *"the patty layer itself — not just its lower
    // edge — surrounds the arm's attachment point"*. The bridge therefore sits INSIDE
    // the patty band, under the cheese overhang, and `cf_ablate --names shoulder_bridge`
    // shows exactly that: two wedges between the cheese's underside and the arm mound,
    // **11,083 px at the lobby camera (0.880% of frame) and 7,374 px at the match
    // camera (0.585%)** — this character's largest single new surface in a generation.
    //
    // ── AND IT SHIPPED A REAL GATE FAILURE ────────────────────────────────────
    // `valuescan --mode gate`, paired on the same tree either side of the bridge:
    //
    //   hamburger    range   p05 (cap 0.180)   steps@10
    //   no bridge    0.7196  0.1581            7
    //   pal.limb     0.6828  0.1948  🔴 FAIL   6
    //
    // 7,374 px of `LIMB_TOAST` (#AD6C29, luma 0.459) landed in the one place this
    // character could least afford it. `p05` is the DARK ANCHOR, and hamburger's dark
    // budget is the third-thinnest in the cast: at pitch 58 the burger's whole filling
    // band is occluded by the crown, so the darks are the brows, the boots, the
    // forearms and nothing else. The tail is measurably that thin — p2.5 0.1364,
    // p05 0.1948, p7.5 0.2857 — so ~2% of the matte arriving above 0.40 moves `p05`
    // 0.037 on its own.
    //
    // ❌ THE TWO OBVIOUS LEVERS ARE ALREADY REFUTED WITH NUMBERS, DO NOT RE-DERIVE:
    //   · brightening `BUN_DARK` moves `p05` the WRONG WAY (+0.5 of p05 per unit of
    //     bun albedo — see that constant; #43220B -> #7B4415 gave 0.166 -> 0.238);
    //   · `bottomBun.receiveShadow = false` was ablated and the frame did not move.
    // And darkening the bridge inside `rig.ts` is not available either: the same
    // material serves sushi, where it would land at 0.088 against near-black nori.
    // The remedy has to come out of THIS file's dark budget, and it does.
    //
    // ── WHAT LANDS, AND IT IS A MATERIAL SWAP, NOT A NEW CONSTANT ─────────────
    // The bridge takes `pattyMat` — the material of the layer it is physically inside.
    // Rendered through the shipped path with no source edit (`cf_ablate --color`,
    // `shots/nm/probe/`), measured over the bridge's own magenta mask:
    //
    //   colour              bridge luma p10/p50/p90 @58     read at BOTH cameras
    //   #AD6C29 shipped     (0.459 albedo)                  a SECOND orange lobe
    //   #8A5220 LIMB_THIGH  0.281 / 0.364 / 0.460           soft, but p05 unmoved
    //   #6B3A14             0.182 / 0.246 / 0.336           p05 still ~0.19
    //   #4A2410 PATTY       0.114 / 0.159 / 0.250           <- ships
    //   #43220B BUN_DARK    0.105 / 0.149 / 0.241           same read, 0.01 darker
    //
    // Judged on the pictures first (`shots/nm/probe/sheet_shoulder_p20.png` and
    // `_p58.png`, six panels each: no-bridge / shipped / four candidates). The shipped
    // limb tone reads as a bulb duplicated beside the arm — two orange balls. At the
    // patty's own value the arm instead emerges from a SHADOWED SOCKET under the
    // cheese, which is what the geometry actually is, and the silhouette is untouched
    // because only the albedo moved. #43220B is a tie by eye and is not taken: the
    // patty is the layer the bridge occupies, so reusing its material keeps one fact
    // in one place instead of coupling the shoulder to the bottom bun's constant.
    //
    // ⚠️ NOT a `Material.clone()` — `docs/LESSONS.md`: `clone()` silently drops
    // `onBeforeCompile`, which cost 54 sites their Fresnel rim. The existing material
    // instance is reused, and the rig's now-orphaned one is disposed (it is built
    // locally in `fitShoulders()` and nothing else references it).
    {
      const bridges = [this.rig.shoulderBridge.L, this.rig.shoulderBridge.R]
        .filter((b): b is THREE.Mesh => b !== null);
      const orphan = bridges.length ? bridges[0].material : null;
      for (const bridge of bridges) bridge.material = pattyMat;
      if (orphan && !Array.isArray(orphan)) orphan.dispose();
    }

    // ── Spatula prop — gripped in the right fist ────────────────────────────
    // The roster's one distinctive silhouette landmark, and what a Patty Smash
    // swing actually reads as swinging. Attached to the rig's own `handR` joint
    // so it inherits the shared shoulder→elbow→hand animation for free instead
    // of needing its own bespoke arm.
    //
    // ── Round 5 rebuild: an independent art director flagged this prop as
    // illegible — "a gray wedge that could be a knife, a spork, or a modeling
    // error." The root causes: the blade was a plain flat rectangle with no
    // shape language distinguishing it from any other flat panel, there was no
    // visible connection between handle and blade (they just touched), and the
    // whole prop was small and tilted at an angle that foreshortened it in the
    // idle camera. Fixed with three changes that each target one of those:
    // (1) the blade is now a genuine turner silhouette — narrow at the neck,
    // flaring wide at the tip, with a gently curled-up leading edge, unmistakably
    // "flat tool for flipping food" rather than a generic panel; (2) a metal
    // ferrule collar visually welds the handle into the blade's neck, the exact
    // connective tissue a bare abutment was missing; (3) it's ~40% bigger overall
    // and held with the blade rotated more upright/outward so it reads as its own
    // silhouette instead of edge-on sliver at the default viewing angle.
    const spatula = new THREE.Group();
    spatula.name = 'spatula';
    // Held more UPRIGHT than the first pass. Angled out at -0.25 about Z the
    // blade swung across to the character's side and read — a critic's word —
    // as "a giant cleaver", because a broad flat head cantilevered sideways off
    // a short handle is a cleaver's silhouette, not a turner's. Standing it up
    // puts the handle visibly in the fist with the blade above it.
    //
    // ── 🚨 ROUND 6: THE OWNER STILL CANNOT TELL WHAT IT IS, AND HE SAID WHY ──────
    // Uri, DECISIONS §37: *"I don't understand what the silver/grey element that is
    // going IN AND OUT of the character."* Both halves are measurable and both were
    // true. Measured at HEAD, world boxes, `ch_hamburger_prop.mjs`:
    //
    //   spatula_blade   x  0.361 … 1.096      the cheese layer reaches x 0.560
    //                   -> 0.199 m OF THE BLADE WAS INSIDE THE FOOD MASS
    //   spatula (all)   1.20 m tall           = 47% of a 2.55 m character
    //   blade centre    y 1.349               the tomato/lettuce band, i.e. mid-burger
    //
    // "In and out" is not a figure of speech; it is a **0.199 m intersection**, and it
    // is the same class as `docs/LESSONS.md` §1 case 8, where Sushi's correctly-sized
    // blade spawned mid-torso and rendered as two disconnected shards. Round 5 fixed
    // the blade's SHAPE and never checked where the shape ended up.
    //
    // Three changes, measured rather than eyeballed:
    //   SCALE  0.66. Prop height 1.20 -> 0.79 m. A turner is a hand tool.
    //   OUT    px 0.06 -> 0.12 and rz -0.05 -> -0.66 (38 deg outboard). Blade x now
    //          0.79 … 1.36 against a food edge of 0.538 — **+0.25 m of clear air**,
    //          the whole blade outside the burger at every height it occupies.
    //   FWD    pz 0.10 -> 0.20, so the blade is read against the BACKGROUND at the
    //          lobby camera rather than against the burger behind it.
    // `rx`/`ry` open the broad face further toward camera; at -0.42/0.26 it presented
    // closer to edge-on, which is the other half of "unidentifiable".
    spatula.position.set(0.12, 0.00, 0.20);
    spatula.rotation.set(-0.28, 0.34, -0.66);
    spatula.scale.setScalar(0.66);
    this.rig.joints.handR.add(spatula);

    const handle = new THREE.Mesh(new THREE.CapsuleGeometry(0.062, 0.46, 4, 8), spatulaHandleMat);
    handle.name = 'spatula_handle';
    // Lowered so the handle's bottom end passes THROUGH the mitt rather than
    // beginning at its surface — that overlap is what sells the grip.
    handle.position.set(0, 0.17, 0);
    handle.castShadow = true;
    handle.receiveShadow = true;
    spatula.add(handle);

    // Ferrule — a metal collar wrapping the handle-to-blade joint. Without this
    // the two parts merely touch and can read as two separate props; the collar
    // makes the join unambiguous at a glance, the same trick a real kitchen tool
    // uses to visually (and physically) marry a wood handle to a steel head.
    const ferrule = new THREE.Mesh(new THREE.CylinderGeometry(0.082, 0.072, 0.09, 14), spatulaSlotMat);
    ferrule.name = 'spatula_ferrule';
    ferrule.position.set(0, 0.42, 0);
    ferrule.castShadow = true;
    ferrule.receiveShadow = true;
    spatula.add(ferrule);

    // Blade — a real turner outline: narrow neck at the ferrule, flaring to a
    // broad flat tip, with the leading edge curled gently upward (bent sheet
    // steel, not a straight-cut panel). Built as an extruded 2D shape so the
    // silhouette itself carries the "spatula" read even in solid shadow.
    const bladeShape = new THREE.Shape();
    bladeShape.moveTo(-0.135, 0);
    bladeShape.lineTo(0.135, 0);
    bladeShape.lineTo(0.30, 0.58);
    bladeShape.quadraticCurveTo(0.16, 0.72, 0, 0.66);
    bladeShape.quadraticCurveTo(-0.16, 0.72, -0.30, 0.58);
    bladeShape.lineTo(-0.135, 0);
    const bladeGeo = new THREE.ExtrudeGeometry(bladeShape, {
      depth: 0.032, bevelEnabled: true, bevelThickness: 0.012, bevelSize: 0.012, bevelSegments: 2, curveSegments: 10,
    });
    bladeGeo.translate(0, 0, -0.016);
    // ── The curl the comment above promised, actually built ────────────────────
    // Two independent blind critics called this object a "flat white unshaded
    // slab" / "flat untextured slab" — and they were describing geometry, not
    // material. An extruded 2D shape is PLANAR: every point on its broad face
    // shares one normal, so the whole blade resolves to exactly one shading value
    // no matter how it is lit. There is nothing a light can do about that, which
    // is why the earlier metalness pass did not help either.
    //
    // Bending the face progressively about X — more curl further from the ferrule,
    // like real pressed sheet steel — gives the normal somewhere to travel, so the
    // face carries a gradient and the leading edge catches a highlight the neck
    // does not. This is the same lesson as `docs/LESSONS.md` §1 case 16 (Taco's
    // front wall) read forwards instead of backwards: a large single-normal
    // surface renders as one flat value, and whether that value is near-black or
    // near-white it reads as a slab either way.
    //
    // The curl is a FUNCTION, not a loop body, because anything mounted on the blade
    // has to be curled by the same amount — see the slots below, which were not, and
    // drifted clean off the tool.
    /** Blade curl at local height `y`, radians. 0 at the neck, ~31 deg at the tip. */
    const bladeCurl = (y: number) => {
      const t = THREE.MathUtils.clamp(y / 0.66, 0, 1);
      return t * t * 0.55;
    };
    /** A point in the blade's PRE-curl space, moved to where the curl actually put it. */
    const onBlade = (y: number, z: number) => {
      const b = bladeCurl(y), c = Math.cos(b), s = Math.sin(b);
      return new THREE.Vector3(0, y * c - z * s, y * s + z * c);
    };
    {
      const pos = bladeGeo.attributes.position as THREE.BufferAttribute;
      const v = new THREE.Vector3();
      for (let i = 0; i < pos.count; i++) {
        v.fromBufferAttribute(pos, i);
        const p = onBlade(v.y, v.z);
        pos.setXYZ(i, v.x, p.y, p.z);
      }
      pos.needsUpdate = true;
    }
    bladeGeo.computeVertexNormals();
    const blade = new THREE.Mesh(bladeGeo, spatulaBladeMat);
    blade.name = 'spatula_blade';
    blade.position.set(0, 0.46, 0.02);
    blade.rotation.x = 0.55; // tips the broad face up toward camera instead of edge-on
    blade.castShadow = true;
    blade.receiveShadow = true;
    spatula.add(blade);

    // Slotted turner holes — three flush decal ovals climbing the blade's own
    // centreline, the detail that finishes selling "kitchen turner" up close.
    //
    // ── They were placed in the blade's PRE-CURL coordinates ──────────────────
    // The curl above was added later (to fix the "flat unshaded slab" critique) and
    // it moves the blade's own vertices without moving anything mounted on them. At
    // the top slot that is a 0.22 displacement in z — seven times the slot's own
    // radius — so the disc parted company with the tool entirely and rendered as a
    // grey circle floating in the background beside the character. It carries
    // `noOutline`, so it had no ink edge to give it away, and it is the whole of
    // hamburger's last remaining detachment: a **197 px connected component**, named
    // by ablating one mesh at a time out of the shipped render
    // (`tools/tmp/detach.mjs`). `tools/tmp/islands.mjs` had reported this same mesh
    // as ZERO-PIXEL, which is the ID-buffer trap in `docs/LESSONS.md` §12 pointing at
    // a real defect from the wrong end.
    //
    // `onBlade` is the same function the vertex loop uses, so the discs cannot drift
    // again if the curl is ever retuned, and `rotation.x` tilts each disc onto the
    // local surface tangent (the curl IS a rotation about X, applied about the
    // blade's own origin).
    const slotGeo = new THREE.CircleGeometry(0.032, 14);
    for (const sy of [0.22, 0.40, 0.56]) {
      const front = onBlade(sy, 0.017);
      const slot = new THREE.Mesh(slotGeo, spatulaSlotMat);
      slot.name = 'spatula_slot__no_outline';
      slot.userData.noOutline = true;
      slot.position.copy(front);
      slot.rotation.x = bladeCurl(sy);
      blade.add(slot);
      const back = onBlade(sy, -0.017);
      const slotBack = new THREE.Mesh(slotGeo, spatulaSlotMat);
      slotBack.name = 'spatula_slot__no_outline';
      slotBack.userData.noOutline = true;
      // Euler order is XYZ, i.e. v' = Rx * Ry * v — the flip happens FIRST and the
      // curl tilt is then applied about the blade's X, which is what is wanted.
      // (`docs/LESSONS.md` §12 warns about composing x-then-y on a flat plane; the
      // order here is deliberate and is the one that keeps the disc on the surface.)
      slotBack.rotation.set(bladeCurl(sy), Math.PI, 0);
      slotBack.position.copy(back);
      blade.add(slotBack);
    }

    this.buildSilhouetteEvents();

    // Outline: a whisper, per render/toon.ts — the reference bar carries almost
    // no ink line.
    outlineGroup(this.root, OUTLINE_THIN);
    this.collectFlashTargets();
    this.rig.restPose();
  }

  /**
   * SILHOUETTE EVENTS — two lettuce points and a diner pick.
   *
   * Hamburger measured **hull deficiency 0.1062 with ZERO appendages** at the
   * shipped facing — a stack of discs seen from above is a circle. It already
   * carries a spatula in `handR` and a lettuce frill inside the stack, and neither
   * registered: the frill is a continuous skirt, which the metric's morphological
   * opening keeps as CORE (it is not thin at its neck, it is thin all over and
   * attached along its whole length), and the spatula sits in front of the buns
   * where it overlaps them from this camera.
   *
   * Two distinct leaf POINTS instead of a continuous frill, aimed out along the
   * mass's own measured box, plus the pick that every diner burger is served with.
   * The pick is the one deliberately VERTICAL element in this pass: it earns only
   * cos 58 = 0.53 of a screen-metre, but it starts above the top bun where there is
   * nothing left to be occluded by, and it is the single most legible "this is a
   * served burger" mark available.
   */
  private buildSilhouetteEvents(): void {
    const head = this.rig.joints.head;
    const box = localBounds(head);
    const size = box.getSize(new THREE.Vector3());
    const rStack = Math.max(size.x, size.z) * 0.5;

    // ── Lettuce points ────────────────────────────────────────────────────────
    // At the frill's own height, angled out and slightly down so they read as
    // leaves flopping past the bun rather than as fins.
    // ROUND 2: THREE points, not two, and one of them is at the back. The first
    // pair sat at +-0.42/0.62 PI — the character's own left and right — which is
    // exactly the axis the top bun projects along at the shipped facing, and both
    // measured zero: hamburger's only appendage was the pick. The third leaf at
    // ~PI is on the free axis. They also flop UP-and-out now rather than down,
    // because down is into the bun's own projected shadow.
    //
    // ── 🚨 ROUND 3: TWO POINTED MASSES EITHER SIDE OF A HEAD ARE EARS. FIVE FOR FIVE.
    // Round 2's "up-and-out" is exactly the wrong instruction, and it took an owner
    // review of five characters to see why. Burrito's torn foil (*"looks a bit like a
    // goat"*), Egg's shell shards (*"the ears don't make sense"*), Pizza's cheese
    // strands (*"the ears are messy"*), Lollipop's cellophane cape petals (they read as
    // HORNS) — and this character's lettuce, which is the same construction and is
    // visible in Uri's own shot. **The signal overrides what the shape is made of.**
    // `rules.ts`'s rewritten hamburger spec now says it in one line: *"the lettuce must
    // read as a frill running CONTINUOUSLY around the whole stack; two leaf points
    // either side of the head is the ear signal."*
    //
    // Three changes, and each one attacks a different half of the signal:
    //   COUNT      3 -> 5, at irregular azimuths, so there is no MIRRORED PAIR left to
    //              read as a pair of anything. A ring of five is a frill; two is a face.
    //   DIRECTION  `lift` is now NEGATIVE on every leaf. A mass hanging DOWN off a
    //              collar is lettuce spilling out of a burger; the same mass angled UP
    //              beside a head is an ear, and that is the whole of the difference.
    //   SIZE       longest 1.22 -> 0.92 of `rStack`, fatter waist (1.35 -> 1.80) and a
    //              stronger curl. `blade()` tapers to a POINT by construction, so the
    //              only lever on "pointed" is how much mass sits behind the point.
    //
    // ⚠️ Round 2's own measurement is not forgotten: the leaves it placed on the
    // character's own left/right measured ZERO hull contribution at the match facing,
    // which is why one was moved to the back. The azimuths below keep three on that
    // free axis, and they are the LONG ones — deliberately, because a leaf pointing
    // -Z is behind the stack at the lobby camera (foreshortened, cannot read as an ear
    // or a cape) and broadside at the match camera (full hull contribution). The two
    // FRONT-quarter leaves are the short ones for the same reason read backwards.
    //
    // ⚠️ AND THE FIRST ATTEMPT AT THIS FIX WAS ITSELF FINDING 5. Five leaves at 0.92-1.22
    // `rStack` and `halfWidth` 0.30, all drooping, composed a GREEN CAPE: rendered, the
    // lower half of the character was one undifferentiated green mantle and the burger
    // stack it was meant to decorate had vanished behind it. `egg.ts:206` records the
    // same trade — *"the detail added to signal the subject destroyed the silhouette
    // that signalled it better"* — and I committed it inside the fix for it. Only the
    // PNG could see that; every number was fine. Lengths and `halfWidth` below are the
    // recovery. Hull deficiency, `ch_hamburger_sil.mjs`, HEAD -> cape -> shipped:
    //   lobby yaw 0   0.3026 -> 0.2687 -> 0.3110
    //   lobby yaw 22  0.2769 -> 0.2366 -> 0.2636
    //   match yaw 90  0.3025 -> 0.2594 -> 0.2841
    // islands 1 at all three views throughout, EXCEPT one intermediate where a single
    // `lettuce_frill` blob became a 197 px DETACHED ISLAND at the lobby the moment the
    // leaves stopped bridging it — `LETTUCE_BASE_R` 0.70R -> 0.74R closed it, which is
    // the same 877 px floating-pea defect this file already fixed once.
    const leafMat = toonMat({ color: LETTUCE_FRILL, roughness: 0.72 });
    const leaves: Array<[azimuth: number, len: number, lift: number]> = [
      [Math.PI * 1.00, 1.18, -0.30],
      [-Math.PI * 0.74, 1.02, -0.42],
      [Math.PI * 0.76, 0.96, -0.38],
      [-Math.PI * 0.33, 0.40, -0.60],
      [Math.PI * 0.22, 0.36, -0.66],
    ];
    for (const [azimuth, len, lift] of leaves) {
      const { at, out } = massAnchor(head, box, { azimuth, height01: 0.46, inset: 0.20 });
      const g = new THREE.Group();
      g.name = 'hamburger_lettuce_point';
      aim(g, at, out.clone().add(new THREE.Vector3(0, lift, 0)).normalize(), Math.PI * 0.5);
      // NAMED. `appendages.blade()` returns an unnamed mesh, and an unnamed mesh is
      // invisible to every diagnostic here: `rg_solid`'s occluder report lumped all
      // five of these plus the pick's rod and olive into one `(unnamed)` row that was
      // the single largest silhouette-edge owner on the character (327 px at the lobby
      // camera) and could not be attributed to any of them.
      const leaf = leafBlade(leafMat, {
        len: rStack * len, halfWidth: rStack * 0.21, thick: rStack * 0.032, curl: -0.45, waist: 1.80,
      });
      leaf.name = 'lettuce_leaf';
      g.add(leaf);
      head.add(g);
    }

    // ── The pick ──────────────────────────────────────────────────────────────
    const pick = new THREE.Group();
    pick.name = 'hamburger_pick';
    const { at } = massAnchor(head, box, { azimuth: -Math.PI * 0.35, height01: 0.93, inset: 0.62 });
    aim(pick, at, new THREE.Vector3(0.20, 1, 0.10).normalize());
    head.add(pick);
    const pickRod = rod(toonMat({ color: MITT_BUN, roughness: 0.55 }), {
      len: rStack * 0.52, rBase: rStack * 0.045, rTip: rStack * 0.038,
    });
    pickRod.name = 'pick_rod';
    pick.add(pickRod);
    const olive = knob(toonMat({ color: PALETTE.tomato, roughness: 0.34 }), rStack * 0.11);
    olive.name = 'pick_olive';
    olive.position.y = rStack * 0.52;
    pick.add(olive);
  }

  protected onUpdate(ctx: AnimContext): void {
    this.rig.animate({
      elapsed: this.elapsed,
      move01: ctx.moveSpeed01,
      attack01: this.attackT >= 0 ? this.attackT / this.attackDuration : -1,
      hit01: this.hitT >= 0 ? this.hitT / 0.26 : -1,
      dead01: this.deathT >= 0 ? this.deathT / 0.75 : -1,
    });
  }

  /**
   * The rig owns all body motion, so the base class's whole-body squash/lean
   * would fight it. Suppressed here; `onUpdate` drives the rig instead.
   */
  protected applyBaseMotion(): void {}
}
