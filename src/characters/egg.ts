/**
 * Egg (Neon).
 *
 * Built on the shared ChibiRig per `donut.ts`. The rig supplies torso, arms,
 * hands, legs, feet and all motion; this file authors:
 *
 *   - a true ovoid shell (not a sphere) — fuller/rounded at the bottom, tapering
 *     to a narrower rounded crown at top, the classic egg silhouette
 *   - a zigzag crack running from the crown down the character's right side —
 *     her single unmistakable landmark, foreshadowing Hatch!/Shell Shards
 *   - a thin glowing seam inside that crack, the Neon-rarity accent, plus a
 *     small glossy peek of yolk at the crack's tip
 *   - open eyes with catchlights, worried brow creases, and a straight,
 *     deadpan mouth
 *
 * `shellPoint()`/`eggSurface()` are the one source of truth for the shell's
 * curved surface: the shell mesh is built by displacing a unit sphere through
 * `shellPoint`, and every decal (crack, eyes, brows, mouth, yolk peek) is placed
 * through the same function. That is what stops decals from floating off the
 * surface or sinking into it when the taper/bulge constants are retuned — the
 * same lesson `hamburger.ts`'s `crownSurface()` encodes for its bun dome.
 */

import * as THREE from 'three';
import { BaseCharacter, type AnimContext } from './types';
import type { CharacterDef } from '../game/rules';
import { PALETTE, RARITY_COLORS } from '../game/rules';
import { toonMat, glossyMat, flatMat, outlineGroup, roundedBox } from '../render/toon';
import { ChibiRig } from './rig';
import { bodyType } from './bodies';
import { CHARACTER_HEIGHT } from '../units';
import { aim, blade as shardBlade, localBounds, massAnchor } from './appendages';

const SHELL = PALETTE.egg;          // #FFF8EA — matte-ish porcelain. THE LID keeps this.
// ── Egg was the worst character in the cast on every value axis ──────────────
// Measured (`tools/tmp/valuescan.mjs`): range 0.401 — below the reference MINIMUM —
// steps@0.10 of 4 against a reference minimum of 5, P05 0.579 against a reference
// median of 0.097, and 73.8% of its part boundary under 0.10 apart. Its figure/ground
// was simultaneously the CAST'S BEST at +0.500. That combination has one meaning:
// perfect separation from the floor, zero internal structure. A white blob.
//
// It also has almost no room to fix that. The head is 93.7% of the character, so the
// only masses big enough to carry a P05 are the shell itself — and the shell being
// near-white IS the egg. So the shell SPLITS instead: the lifted lid keeps SHELL and
// stays the light rung (it is the piece the key light actually hits), the body drops
// one step into a warm shadowed eggshell, and everything that is not shell — limbs,
// boots, hands, brow shadow — goes near-black.
//
// Measured at pot_south, shipped framing: range 0.401 -> 0.643 (over the 0.636 floor),
// steps@0.10 4 -> 6, p05 0.579 -> 0.317, figure/ground 0.486 -> 0.416 — still by far
// the cast's largest, so this spent from the one budget Egg had a surplus of.
//
// ⚠️ P05 0.317 still FAILS the <= 0.18 gate and no albedo can fix it: with 90% of the
// character being one white ovoid, 5% of its pixels cannot be made near-black without
// deleting the character. Egg needs a dark GARMENT — geometry, not colour.
const SHELL_BODY = '#D6C098';       // the lower shell and the torso shell — one step down
const SHELL_SHADOW = '#A08B5C';     // brow-crease shadow — a real shadow now, not a tint
const CRACK_DARK = '#0E0916';       // the crack itself — needs real value contrast against
                                     // the pale shell or it reads as a stray highlight, not a break
const YOLK = '#FFC23C';             // glossy peek at the crack tip
const NEON_ACCENT = RARITY_COLORS.Neon; // #FF2FD0 — Egg's rarity accent, used ONLY on the crack seam
const INK = PALETTE.ink;
// Limb-only pale-lilac family. A second independent art-director pass named Egg,
// Burrito and Lollipop as all converging on pale cream/white limbs with dark
// boots — the shell itself stays near-white (that IS the egg read), but the limbs
// shift to a soft lilac tint of her own Neon accent so the body carries real hue
// distinct from the shell, instead of reading as one undifferentiated pale mass.
// …and the limbs are where the dark rung goes. They were pale lilac — a fifth
// near-white on a character that was already four near-whites — so `head|shoulderL`
// measured 0.080 across 74 px, the largest seam on the model. Deep plum instead: the
// hue is still a tint of Egg's own Neon accent, only the value moved.
const LIMB_LILAC = '#241A38';
// PASS 3 tried this at #4A3568 to open `kneeL|footL` (0.011). MEASURED WORSE on every
// axis at once — it closed `hipL|kneeL` (0.051) and `shoulderL|elbowL` (0.069) instead,
// weak boundary 60.4% -> 70.3%, range 0.701 -> 0.653, p05 0.279 -> 0.326. Reverted.
// Egg's limbs are ~1% of the character each; there is not enough room between the
// thigh, the shin and the boot to fit three 0.10 steps at 111 px. That is a geometry
// answer, not an albedo one.
const LIMB_LILAC_SHADOW = '#150E22';
/**
 * The cowl. Same plum family as the limbs so the costume reads as ONE garment,
 * one step darker than `LIMB_LILAC` so the limbs still separate from it where they
 * touch — the value pass's own rule that a chain has to ALTERNATE, not ramp.
 * `GARMENT_LIT` is the rolled rim, which is the piece the key light actually hits.
 *
 * ── #1A1228 -> #241A38, and the patch is narrowed: SOFTENED, not reverted ────
 * A blind critic named this garment as its second-biggest defect, unprompted and
 * without knowing it was new: *"a crushed near-black hemisphere with a hard
 * purple-rimmed edge cutting the body exactly in half"*. Rendered at match size
 * (`shots/limbmatch/before/chars/egg.yaw90.png`) that is exactly what it is — from
 * the shipped facing you are looking at the back of the head, so a patch spanning
 * 137 deg of azimuth from the crown to the equator IS half the circle.
 *
 * Reverting was the other option and it was rejected on arithmetic rather than
 * taste. `p05` is a PERCENTILE: it passes as long as 5% of the character's pixels
 * sit below luma 0.18, and the garment was covering far more than 5%. So the patch
 * can lose most of its area and lift a whole value step and still hold the gate
 * this character had no other way to pass (`p05` 0.270 -> 0.060 against <= 0.180,
 * on a head that is 93.7% of the character). Three changes, all in that direction:
 * the azimuth span 137 deg -> 101 deg, the top edge dropped off the crown
 * (`PHI_TOP` 0.16PI -> 0.30PI) so the egg's own dome stays pale and unbroken, and
 * the tone up one rung to sit WITH `LIMB_LILAC` instead of a step under it — the
 * limbs now separate from the garment by their shadow tone rather than by the
 * garment being the darkest thing on the model. Verified with
 * `valuescan --mode gate`, not assumed; the measured cost is in the report.
 */
const GARMENT = '#241A38';
const GARMENT_LIT = '#3E3157';
/** Yolk-gold hands, deepened. At #FFC23C they were a sixth light mass. */
const YOLK_HAND = '#3A2408';

// ─────────────────────────────────────────────────────────────────────────────
// Shell surface — single source of truth for both the mesh and every decal.
// ─────────────────────────────────────────────────────────────────────────────

/** How sharply the crown narrows toward the top pole. */
const TOP_TAPER = 0.42;
/** How much the shell bulges below the equator — the "fuller at the bottom" read. */
const BOTTOM_BULGE = 0.16;
/** Overall vertical elongation, taller than it is wide like a real egg. Kept modest —
 * an earlier pass at 1.08 pushed idle height to 2.26m, visibly off the 2.1m cast norm. */
const VERT_SCALE = 1.04;

/** Unit direction from spherical angles. theta=0 is character-front (+Z),
 * increasing toward +X (her right). phi=0 is the top pole, phi=PI the bottom. */
function dirFromAngles(theta: number, phi: number): THREE.Vector3 {
  const s = Math.sin(phi);
  return new THREE.Vector3(s * Math.sin(theta), Math.cos(phi), s * Math.cos(theta));
}

/** Maps a unit sphere direction to the actual egg-shell point at that direction,
 * scaled to radius R. Narrows above the equator, bulges below it. */
function shellPoint(dir: THREE.Vector3, R: number): THREE.Vector3 {
  const ny = dir.y;
  const scaleXZ = ny >= 0
    ? 1 - TOP_TAPER * Math.pow(ny, 1.7)
    : 1 + BOTTOM_BULGE * Math.sin(Math.PI * Math.min(1, -ny));
  return new THREE.Vector3(dir.x * scaleXZ, ny * VERT_SCALE, dir.z * scaleXZ).multiplyScalar(R);
}

/** Exact surface point + outward normal at (theta, phi), via finite differences
 * of `shellPoint` — the curved-surface analogue of `hamburger.ts`'s crownSurface. */
function eggSurface(theta: number, phi: number, R: number): { pos: THREE.Vector3; normal: THREE.Vector3 } {
  const d = 0.015;
  const p0 = shellPoint(dirFromAngles(theta, phi), R);
  const pT = shellPoint(dirFromAngles(theta + d, phi), R);
  const pP = shellPoint(dirFromAngles(theta, phi + d), R);
  const normal = pT.clone().sub(p0).cross(pP.clone().sub(p0)).normalize();
  if (normal.dot(p0) < 0) normal.negate();
  return { pos: p0, normal };
}

/** A group flush against the shell surface at (theta, phi), pushed out along the
 * normal by `embed` so a decal sits just proud of the surface. Local +Z is the
 * outward normal — used for compact, roughly front-facing features (eyes, brow
 * creases, mouth) where the residual twist from `setFromUnitVectors` is invisible. */
function addShellDecal(parent: THREE.Object3D, theta: number, phi: number, embed: number, R: number): THREE.Group {
  const { pos, normal } = eggSurface(theta, phi, R);
  const g = new THREE.Group();
  g.position.copy(pos).addScaledVector(normal, embed);
  g.quaternion.setFromUnitVectors(new THREE.Vector3(0, 0, 1), normal);
  parent.add(g);
  return g;
}

/**
 * ── The hatching split ───────────────────────────────────────────────────────
 * The shell is cut in two along a sawtooth rim and the top piece is lifted clear,
 * with the yolk glowing in the gap.
 *
 * This replaced a knit cap. The cap was a lilac dome perched off-centre near the
 * crown, and at the size a player actually sees a character (~95px tall, so this
 * dome was ~12px) it did not read as a hat — it read as a lump, and it broke the
 * one thing Egg had going for it in the silhouette test, which is a clean ovoid.
 * A sawtooth split is the opposite trade: it breaks the outline with a shape that
 * only an egg has, and it is the character's own ability (`Hatch!`) made visible.
 *
 * `phiEdge` is the single source of truth for the rim. Both halves are clamped to
 * it — the lower shell from below, the cap from above — so the teeth interlock
 * exactly by construction rather than by two hand-tuned constants that drift.
 */
const RIM_PHI = 0.32 * Math.PI;   // how far down the crown the split runs
// Tooth depth. At the size a player sees a character (~95px tall, so this head is
// ~55px) a 0.075rad tooth was under two pixels and the rim read as a smooth line.
// 0.14rad is ~4px of zigzag, which is the minimum that survives.
const RIM_AMP = 0.14;
const RIM_TEETH = 7;

/** Triangle wave in [-1, 1] — the sawtooth rim, as a function of azimuth. */
function rimEdge(theta: number): number {
  const u = ((theta * RIM_TEETH) / (Math.PI * 2)) % 1;
  const t = u < 0 ? u + 1 : u;
  return RIM_PHI + RIM_AMP * (4 * Math.abs(t - 0.5) - 1);
}

/**
 * A piece of eggshell: a sphere section pushed through `shellPoint`, with its
 * boundary snapped to the sawtooth rim. `side` picks which half — `'lower'`
 * clamps phi UP to the rim (the body of the egg), `'upper'` clamps it DOWN (the
 * lifted lid).
 */
function shellPiece(R: number, side: 'lower' | 'upper', widthSeg = 64): THREE.BufferGeometry {
  const phiMin = RIM_PHI - RIM_AMP;
  const phiMax = RIM_PHI + RIM_AMP;
  const geo = side === 'lower'
    ? new THREE.SphereGeometry(1, widthSeg, 40, 0, Math.PI * 2, phiMin, Math.PI - phiMin)
    : new THREE.SphereGeometry(1, widthSeg, 18, 0, Math.PI * 2, 0, phiMax);
  const pos = geo.attributes.position as THREE.BufferAttribute;
  const v = new THREE.Vector3();
  for (let i = 0; i < pos.count; i++) {
    v.fromBufferAttribute(pos, i).normalize();
    const phi = Math.acos(THREE.MathUtils.clamp(v.y, -1, 1));
    const theta = Math.atan2(v.x, v.z);
    const edge = rimEdge(theta);
    const newPhi = side === 'lower' ? Math.max(phi, edge) : Math.min(phi, edge);
    const p = shellPoint(dirFromAngles(theta, newPhi), R);
    pos.setXYZ(i, p.x, p.y, p.z);
  }
  geo.computeVertexNormals();
  return geo;
}

/**
 * A curved patch of the shell surface, pushed OUTWARD by `offset(u, v)`.
 *
 * Built from `eggSurface` rather than a THREE primitive so it hugs the ovoid
 * exactly at any taper/bulge setting — the same single-source-of-truth rule the
 * crack, the eyes and the mouth already follow. `u` runs `thetaA -> thetaB` and
 * `v` runs `phiA -> phiB` (0 = toward the crown).
 *
 * Deliberately DOUBLE-SIDED. `docs/LESSONS.md` §12: a lathe/patch whose profile
 * runs the wrong way inverts its normals and renders near-black, and it has bitten
 * six characters at once on this project. A cloth shell has no inside worth
 * defending, so the whole failure class is designed out instead of being got right.
 */
function shellPatch(
  thetaA: number, thetaB: number, phiA: number, phiB: number, R: number,
  offset: (u: number, v: number) => number,
  segT = 40, segP = 16
): THREE.BufferGeometry {
  const pos: number[] = [];
  const idx: number[] = [];
  for (let j = 0; j <= segP; j++) {
    const v = j / segP;
    const phi = phiA + (phiB - phiA) * v;
    for (let i = 0; i <= segT; i++) {
      const u = i / segT;
      const theta = thetaA + (thetaB - thetaA) * u;
      const s = eggSurface(theta, phi, R);
      const o = offset(u, v);
      pos.push(s.pos.x + s.normal.x * o, s.pos.y + s.normal.y * o, s.pos.z + s.normal.z * o);
    }
  }
  for (let j = 0; j < segP; j++) {
    for (let i = 0; i < segT; i++) {
      const a = j * (segT + 1) + i;
      const b = a + 1;
      const c = a + segT + 1;
      const d = c + 1;
      idx.push(a, c, b, b, c, d);
    }
  }
  const g = new THREE.BufferGeometry();
  g.setAttribute('position', new THREE.Float32BufferAttribute(pos, 3));
  g.setIndex(idx);
  g.computeVertexNormals();
  return g;
}

/** Path (theta, phi-as-fraction-of-PI) for the crack landmark: a short, bold
 * zigzag on the temple/cheek, well clear of the eyes (theta ±0.50) and mouth
 * (theta 0) so it reads as a distinct scar rather than crowding the face.
 *
 * Two defects compounded here. First, this originally ran theta 1.20-1.48 —
 * nearly 90° round from front (the profile edge). At that theta the surface
 * normal is almost perpendicular to the default camera, so the curved shading
 * cue that makes every other decal (eyes, brows, mouth) read as "sitting on a
 * dome" disappears: the segments render against the flat, blown-out rim-light
 * band with no surrounding shell context, which read as a stray stick floating
 * beside the head rather than a crack IN it. Second, only 3 long segments with
 * large (~0.27 rad) theta swings drew one bold "V"/lightning-bolt shape, not a
 * crack — real fractures are made of several SHORT irregular jags, not two
 * long straight strokes. Fixed both: pulled in to theta 0.66-0.86 (clearly on
 * the visible frontal dome, still outside the eyes' ±0.50 clear zone) and
 * split into 5 short segments with small (~0.12-0.18 rad) alternating jags. */
const CRACK_PATH: Array<[theta: number, phiFrac: number]> = [
  [0.74, 0.13], [0.86, 0.19], [0.68, 0.24], [0.84, 0.30], [0.70, 0.36], [0.83, 0.41],
];

/** Continuation of the crack onto the torso shell, same side (character's right
 * front), near the top where it emerges from under the neck. `eggSurface` and
 * `buildCrackLine` are both already generic in R, so this reuses them verbatim
 * against the torso's own smaller shell radius. Theta band matches the
 * repositioned `CRACK_PATH` above so the two segments read as one continuous
 * crack running from head to torso instead of jumping sideways at the neck. */
const TORSO_CRACK_PATH: Array<[theta: number, phiFrac: number]> = [
  [0.80, 0.05], [0.68, 0.10], [0.82, 0.16],
];

/**
 * A jagged crack line: a chain of thin boxes, each built its own oriented basis
 * from the tangent between consecutive surface points and the averaged normal,
 * so every segment sits flush against the curved shell instead of floating off
 * it or clipping through it — the failure mode explicitly flagged in review.
 */
function buildCrackLine(
  head: THREE.Group,
  R: number,
  path: Array<[number, number]>,
  opts: { thickness: number; embed: number; color: string; roughness: number; emissive?: string; emissiveIntensity?: number }
): void {
  const mat = toonMat({ color: opts.color, roughness: opts.roughness, emissive: opts.emissive, emissiveIntensity: opts.emissiveIntensity });
  const pts = path.map(([theta, phiFrac]) => eggSurface(theta, phiFrac * Math.PI, R));

  for (let i = 0; i < pts.length - 1; i++) {
    const a = pts[i];
    const b = pts[i + 1];
    const mid = a.pos.clone().add(b.pos).multiplyScalar(0.5);
    const normal = a.normal.clone().add(b.normal).normalize();
    const dirVec = b.pos.clone().sub(a.pos);
    const length = dirVec.length();
    dirVec.normalize();
    const xAxis = dirVec.clone().sub(normal.clone().multiplyScalar(dirVec.dot(normal))).normalize();
    const yAxis = normal.clone().cross(xAxis).normalize();
    const quat = new THREE.Quaternion().setFromRotationMatrix(new THREE.Matrix4().makeBasis(xAxis, yAxis, normal));

    // Taper the two end segments so the crack fades rather than stopping abruptly.
    const taper = i === 0 || i === pts.length - 2 ? 0.65 : 1;
    // Kept deliberately flat (shallow Z/normal depth) — an earlier pass used a
    // near-cubic cross-section whose own proud depth was enough to bury the
    // thinner glow line laid on top of it, so the "glow" never actually showed.
    const seg = new THREE.Mesh(
      new THREE.BoxGeometry(length * 1.2, opts.thickness * taper, opts.thickness * 0.16),
      mat
    );
    seg.position.copy(mid).addScaledVector(normal, opts.embed);
    seg.quaternion.copy(quat);
    seg.userData.noOutline = true; // thin decal — an inverted-hull outline would read as a chunky sticker
    seg.castShadow = true;
    head.add(seg);
  }
}

/**
 * A rounded limb segment, like a capsule but with INDEPENDENT top and bottom
 * radii, hanging DOWN from the joint origin (spans y=0..-len) — the orientation
 * `dressLimbs()` expects. Local to this file; see `hamburger.ts` for the
 * reference copy. Egg's own call sites pass radii noticeably SMALLER than
 * `size.radius` — she is a small, delicate character, and the rig's default
 * limb thickness read as too stocky for that.
 */
function taperedSegment(len: number, rTop: number, rBot: number, radialSegments = 12): THREE.BufferGeometry {
  // Profile MUST be wound bottom-to-top (y increasing), matching every other
  // lathe helper in this cast (`bunDome`, `roundedPuck` in `hamburger.ts`) —
  // LatheGeometry's face winding (and therefore `computeVertexNormals`'s
  // outward-vs-inward call) depends on point order, not just point position. An
  // earlier version of this function built the profile top-to-bottom and every
  // limb using it rendered near-black: inverted normals facing away from the
  // light. The y=0/y=-len hang-down placement is unchanged.
  const capSegs = 5;
  const pts: THREE.Vector2[] = [new THREE.Vector2(0, -len)];
  for (let i = 1; i <= capSegs; i++) {
    const a = (Math.PI / 2) * (i / capSegs);
    pts.push(new THREE.Vector2(Math.sin(a) * rBot, -len + rBot - Math.cos(a) * rBot));
  }
  const yBotCap = -len + rBot;
  const yTopCap = -rTop;
  if (yTopCap >= yBotCap) {
    const sideSteps = 3;
    for (let i = 1; i <= sideSteps; i++) {
      const t = i / sideSteps;
      pts.push(new THREE.Vector2(THREE.MathUtils.lerp(rBot, rTop, t), THREE.MathUtils.lerp(yBotCap, yTopCap, t)));
    }
  }
  const yTopSafe = Math.max(yTopCap, yBotCap);
  for (let i = 1; i <= capSegs; i++) {
    const a = (Math.PI / 2) * (i / capSegs);
    pts.push(new THREE.Vector2(Math.cos(a) * rTop, yTopSafe + Math.sin(a) * rTop));
  }
  const geo = new THREE.LatheGeometry(pts, radialSegments);
  geo.computeVertexNormals();
  return geo;
}

/**
 * This character's own height, as a multiple of the cast's.
 *
 * It was the metre literal 2.02 until `CHARACTER_HEIGHT` moved. A literal here is
 * a silent opt-out of every cast-wide size decision: six of the eleven carried one,
 * so raising the cast height would have scaled five characters and left six behind.
 */
const H = CHARACTER_HEIGHT * 0.962;

export class EggCharacter extends BaseCharacter {
  private rig: ChibiRig;

  constructor(def: CharacterDef) {
    super(def);

    this.rig = new ChibiRig({
      palette: {
        limb: LIMB_LILAC,
        // Hand/foot were both pale near-whites barely a shade off the shell —
        // the exact "one undifferentiated mass" failure called out in review.
        // Hands now take the same saturated yolk used for the crack-tip peek,
        // feet take the crack's own dark caramel, so extremities carry real
        // value AND hue contrast against the shell.
        hand: YOLK_HAND,
        foot: CRACK_DARK,
        torso: SHELL,
        limbRoughness: 0.5,
      },
      // Body: STUB archetype (see `bodies.ts`) — no torso, head on the hips,
      // very short thick limbs. An egg's silhouette IS its shell; it has no
      // waist and never did, and the old body was a torso invented purely
      // because the rig insisted on one.
      //
      // `height` still sits under the 2.1m cast norm — she is the smallest
      // character — and `shoulderWidth` is a STUB hand-fit: the shell is unusually
      // wide at shoulder height (~0.96R, thanks to `BOTTOM_BULGE`), so the stock
      // 0.32H would bury the upper arms inside it.
      proportions: bodyType('stub', {
        height: H,
        // ── The arms were INSIDE the shell ──────────────────────────────────
        // Measured: at the stock STUB `shoulderFraction` of 0.12 the shoulder
        // pivot lands ~0.59 of the way down the ovoid, where `BOTTOM_BULGE`
        // widens the shell to 1.15R = 0.83m — while `shoulderWidth` was 0.61m.
        // Both arms were buried in the food mass, and a blind critic reading the
        // silhouette reported flatly that this character "has no arms". It is the
        // project's most-repeated failure (rendering, and invisible) wearing yet
        // another costume.
        //
        // Fixed on both axes: raise the pivot to the ovoid's equator, where the
        // shell is narrowest above the bulge, and widen the span past the shell
        // there. `bodies.ts` says this per-character fit is expected on STUB
        // rather than a failure of the preset — "an egg is 0.96R" is its own
        // worked example, and that figure is for the equator, not the bulge.
        shoulderFraction: 0.30,
        // Settled by measurement, not arithmetic: removing the knit cap took ~0.15m
        // off, raising the lid put some back, and `shoot.mjs --char egg` prints the
        // real bounding height. 0.71 lands at ~2.2m, inside the cast's 2.2-2.35.
        headFraction: 0.71,
        // 0.44H, not 0.40H: at 0.40 the pivot cleared the shell but the upper arm's
        // INNER half was still buried, so only the hands showed. The shell is 0.753m
        // at the raised pivot height and the arm radius is 0.103m, so the span has to
        // be at least 0.856m for the whole limb to sit outside the food.
        // 0.44H -> 0.395H. The previous fix over-corrected: measured, the left arm
        // sat as its own connected component, 4,494 px of limb with background
        // between it and the shell (`shots/probe/front/egg.png` shows it plainly),
        // and its inner edge was 0.101m clear of the food. This is the far side of
        // the same window the 0.40H note below is reasoning about — the arm has to
        // OVERLAP the shell at the pivot to read as attached, not merely avoid it.
        // 0.798m puts the upper arm's inner edge inside the shell while its outer
        // edge stays proud.
        shoulderWidth: H * 0.395,
        // The shell reaches almost to the floor, so at STUB's 0.225H stance the
        // thighs and shins measured 0.000 delivery — completely inside the food.
        // Widened here rather than in the archetype because no other STUB mass is
        // this deep.
        stanceWidth: H * 0.275,
      }),
      // Timid, closed-in — elbows pulled tight against the body, shoulders barely
      // lifted, head ducked and turned away shyly. An art director's second pass
      // named the cast's identical dead-front symmetric pose as a top gap; Egg's
      // read is the cast's most defensive/withdrawn stance, distinct from every
      // other character's more open posture in this file.
      // Still timid — elbows bent, head ducked and turned away — but the arms now
      // hang CLEAR of the shell. `restPose` maps `shoulderL` onto the rotation of
      // the joint at x = -shoulderWidth, and a positive value there swings the arm
      // ACROSS the body; the old +0.06 / -0.06 pair was closing what little gap
      // there was. Negative-left / positive-right opens it.
      // Magnitudes reduced with `shoulderWidth` above: the signs stay (they are
      // what opened the arms in the first place) but -0.22 / +0.18 on a pivot that
      // was already outside the shell is what detached them.
      stance: {
        shoulderL: -0.14, shoulderR: 0.18,
        elbowL: -0.80, elbowR: -0.76,
        twist: 0.05, headTilt: 0.16, headTurn: 0.32,
        hipSway: 0.01, lean: 0.10,
        // Splay ONLY, and the stance is deliberately left alone. Egg is the one
        // character whose `stanceWidth` cannot be widened at all: measured
        // (`limbmatch --mode proto --spec plant`) it goes to TWO islands at x1.2,
        // because the shell reaches almost to the floor and moving the hip pivot
        // out takes the thigh off the only mass it can attach to. Splay moves the
        // FOOT and leaves the pivot where it is, and islands stayed at 1 all the
        // way to 0.5 rad. Hull deficiency 0.107 -> 0.1351 on splay alone.
        splay: 0.42,
      },
    });
    this.body.add(this.rig.joints.root);
    this.head = this.rig.joints.head;

    const R = this.rig.headRadius;
    const head = this.rig.joints.head;

    // ── Shell: a true ovoid, split along a sawtooth hatching rim ─────────────
    const shell = new THREE.Mesh(shellPiece(R, 'lower'), toonMat({ color: SHELL_BODY, roughness: 0.35 }));
    shell.name = 'egg_shell';
    shell.castShadow = true;
    shell.receiveShadow = true;
    head.add(shell);

    // Yolk filling the shell, sitting just inside the wall so it is only visible
    // through the gap the lifted lid opens. This is the character's only warm,
    // saturated area and the one that carries the Neon rarity — a pale shell on a
    // pale limb set had no chroma anywhere, on a cast that owns the warm half of
    // the wheel.
    const yolkGeo = new THREE.SphereGeometry(1, 40, 20, 0, Math.PI * 2, 0, Math.PI * 0.58);
    {
      const pos = yolkGeo.attributes.position as THREE.BufferAttribute;
      const v = new THREE.Vector3();
      for (let i = 0; i < pos.count; i++) {
        v.fromBufferAttribute(pos, i).normalize();
        // Pulled in from 0.965R: at the previous inset the yolk poked through the
        // shell wall on the side the lid tips toward, which a critic read as a
        // separate yellow card intersecting the surface.
        const p = shellPoint(v, R * 0.935);
        pos.setXYZ(i, p.x, p.y, p.z);
      }
      yolkGeo.computeVertexNormals();
    }
    const yolkFill = new THREE.Mesh(
      yolkGeo,
      glossyMat({ color: YOLK, roughness: 0.18, emissive: YOLK, emissiveIntensity: 0.30 })
    );
    yolkFill.name = 'egg_yolk_fill';
    yolkFill.castShadow = true;
    yolkFill.receiveShadow = true;
    head.add(yolkFill);

    // The lid: the same shell surface, same rim, lifted and tipped back so the
    // teeth separate. Kept small — a lid that lifts too far stops reading as
    // "cracking" and starts reading as a hat, which is the failure this replaced.
    const lid = new THREE.Group();
    lid.name = 'egg_shell_lid';
    // Lift and tilt are deliberately small. A blind critic reported "a detached
    // shell shard floating clear of the head at upper-left" — at 0.215R of lift the
    // far teeth cleared the lower rim entirely and read as debris rather than as a
    // lid. Half that keeps every tooth overlapping its neighbour while still
    // opening a visible gap on the near side.
    lid.position.set(-R * 0.035, R * 0.105, -R * 0.015);
    lid.rotation.set(-0.07, 0, 0.14);
    head.add(lid);
    const lidMesh = new THREE.Mesh(shellPiece(R, 'upper'), toonMat({ color: SHELL, roughness: 0.35 }));
    lidMesh.name = 'egg_shell_lid_mesh';
    lidMesh.castShadow = true;
    lidMesh.receiveShadow = true;
    lid.add(lidMesh);

    // ── Crack: the silhouette landmark ────────────────────────────────────────
    // Bold caramel-brown fracture line — high contrast against the pale shell,
    // the way a real cracked eggshell darkens along the break. The Neon accent
    // is deliberately NOT smeared along the whole seam (that read as a blown-out
    // glow stripe on the first pass); instead it's one small, hot ember at the
    // crack's widest gap, right where the yolk peeks through.
    buildCrackLine(head, R, CRACK_PATH, {
      thickness: R * 0.05, embed: R * 0.010, color: CRACK_DARK, roughness: 0.55,
    });
    buildCrackLine(head, R, [CRACK_PATH[4], CRACK_PATH[5]], {
      thickness: R * 0.024, embed: R * 0.017, color: NEON_ACCENT, roughness: 0.3,
      emissive: NEON_ACCENT, emissiveIntensity: 1.0,
    });

    // A glossy sliver of yolk peeking through the widest point of the crack —
    // wet where the shell is matte, and a quiet nod to Hatch!.
    const tip = CRACK_PATH[CRACK_PATH.length - 1];
    const tipSurface = eggSurface(tip[0], tip[1] * Math.PI, R);
    const yolk = new THREE.Mesh(new THREE.SphereGeometry(R * 0.065, 12, 10), glossyMat({ color: YOLK, roughness: 0.2 }));
    yolk.scale.set(1, 1, 0.4);
    yolk.position.copy(tipSurface.pos).addScaledVector(tipSurface.normal, R * 0.003);
    yolk.quaternion.setFromUnitVectors(new THREE.Vector3(0, 0, 1), tipSurface.normal);
    yolk.userData.noOutline = true;
    head.add(yolk);

    // ── Costume: oversized scarf + knit cap ───────────────────────────────────
    // A second independent art-director pass named the total absence of any worn
    // costume/accessory layer as the cast's single biggest remaining gap. An
    // oversized scarf wound around the neck, its tails hanging past the shell's
    // own front, is the single most legible costume for a timid character: it
    // reads as "bundled up, hiding a little" and breaks the ovoid silhouette with
    // real hanging cloth. The knit cap perched near the crown is the smaller worn
    // detail, tucked well clear of the crack landmark's own theta band.
    //
    // Round 1 defect: attached to `rig.joints.neck`. Egg's head is BOTH unusually
    // large (headFraction 0.46) and bulges wider below its own equator
    // (BOTTOM_BULGE), so the shell's lowest point actually sits BELOW the neck
    // joint's own world Y — the neck is entirely swallowed inside the shell
    // volume, not in a visible gap above the torso. Anything hung off it renders
    // fully hidden. Fixed by anchoring the scarf to the SHELL's own surface via
    // `eggSurface` (the same source of truth the crack and face already use)
    // near the bottom of the head, where the bulge gives it real radius to wrap.
    const scarfMat = toonMat({ color: LIMB_LILAC, roughness: 0.6 });
    const scarfDarkMat = toonMat({ color: LIMB_LILAC_SHADOW, roughness: 0.6 });
    // ── The scarf, not the shell, was burying this character's legs ─────────────
    // Measured with `tools/tmp/masssit.mjs`: the wrap sat 0.627 m half-wide at the
    // HIP LINE against a 0.549 m stance, and its tassels hung all the way to
    // y = 0.022 m — the floor. The shell itself is only 0.509 m half-wide there, i.e.
    // INSIDE the stance and not the problem at all. It showed up as `hipR`
    // overlapping the mass by **1.000 at every stride phase** while delivering 0.000
    // px. The costume was burying the legs, not the egg.
    //
    // **Do not fix it by raising `scarfPhi`.** Tried and measured: `BOTTOM_BULGE`
    // peaks at ny = -0.5, i.e. phi = 0.667π, so lifting the wrap moves it to the
    // WIDEST band on the ovoid — 0.66π took the wasted-limb figure from 27.9% to
    // 55.9% and put `hipL`, `hipR` and `elbowR` all on 0.000. 0.80π is near the
    // narrowest the wrap can sit and still read as a scarf; the fix is to stop the
    // wrap and its tails being oversized THERE.
    const scarfPhi = 0.80 * Math.PI;
    const scarfPt = eggSurface(Math.PI / 2, scarfPhi, R);
    const scarfRadius = Math.hypot(scarfPt.pos.x, scarfPt.pos.z);
    const scarfY = scarfPt.pos.y;

    // 1.08 / 0.13R -> 0.96 / 0.10R: outer edge 0.63 m -> 0.51 m, inside the 0.549 m
    // stance instead of 0.078 m outside it.
    const scarfWrap = new THREE.Mesh(new THREE.TorusGeometry(scarfRadius * 0.96, R * 0.10, 10, 24), scarfMat);
    scarfWrap.name = 'egg_scarf_wrap';
    scarfWrap.rotation.x = Math.PI / 2;
    scarfWrap.position.y = scarfY;
    scarfWrap.castShadow = true;
    scarfWrap.receiveShadow = true;
    head.add(scarfWrap);

    for (const sx of [-1, 1] as const) {
      const tail = new THREE.Mesh(new THREE.CapsuleGeometry(R * 0.085, R * 0.30, 4, 8), sx > 0 ? scarfMat : scarfDarkMat);
      tail.name = 'egg_scarf_tail';
      tail.position.set(sx * R * 0.16, scarfY - R * 0.26, scarfRadius * 0.92);
      tail.rotation.x = 0.22;
      tail.rotation.z = sx * 0.08;
      tail.castShadow = true;
      tail.receiveShadow = true;
      head.add(tail);

      const tassel = new THREE.Mesh(new THREE.SphereGeometry(R * 0.07, 8, 6), scarfDarkMat);
      tassel.name = 'egg_scarf_tassel';
      tassel.position.set(sx * R * 0.16, scarfY - R * 0.44, scarfRadius * 0.98);
      tassel.castShadow = true;
      head.add(tassel);
    }

    this.buildCowl(R);

    // ── Body: dress the torso ─────────────────────────────────────────────────
    // Two independent builder rounds both named the same gap: a themed head on a
    // generic body. Egg's body is a second, smaller shell built from the exact
    // same `shellPoint` surface as the head — literally the same ovoid language,
    // just scaled down — with the crack motif continuing a short way down onto
    // it, so the identity runs the full height of the model instead of stopping
    // dead at the neck.
    // NOTE: a no-op under the STUB archetype, which has no torso — the head
    // shell is the whole body. Kept intact because switching archetype is a
    // supported one-line fix (see `bodies.ts`) and this is Egg's body the moment
    // she has a torso again.
    this.rig.dressTorso((size) => {
      const torsoR = size.w * 0.5;
      const halfH = 1.04 * torsoR;
      const bottomY = size.h * 0.05;
      const centerY = bottomY + halfH;

      const group = new THREE.Group();
      group.name = 'egg_torso_shell_group';
      group.position.y = centerY;

      const shellGeo = new THREE.SphereGeometry(1, 28, 20);
      {
        const posAttr = shellGeo.attributes.position as THREE.BufferAttribute;
        const dir = new THREE.Vector3();
        for (let i = 0; i < posAttr.count; i++) {
          dir.fromBufferAttribute(posAttr, i).normalize();
          const p = shellPoint(dir, torsoR);
          posAttr.setXYZ(i, p.x, p.y, p.z);
        }
        shellGeo.computeVertexNormals();
      }
      const torsoShell = new THREE.Mesh(shellGeo, toonMat({ color: SHELL_BODY, roughness: 0.35 }));
      torsoShell.name = 'egg_torso_shell';
      torsoShell.castShadow = true;
      torsoShell.receiveShadow = true;
      group.add(torsoShell);

      // The crack carries on down from the neck — same helper, same colour, just
      // a shorter path against the torso's own (smaller) shell radius.
      buildCrackLine(group, torsoR, TORSO_CRACK_PATH, {
        thickness: torsoR * 0.075, embed: torsoR * 0.008, color: CRACK_DARK, roughness: 0.55,
      });

      return group;
    });

    // ── Limbs: bespoke, not the shared rig defaults ───────────────────────────
    // An independent art director named the rig's identical capsule-arm/ball-hand/
    // wedge-foot kit as the single biggest "template" tell across the whole cast.
    // Egg is small and delicate, so her limbs are noticeably thinner than the
    // rig's own default thickness, glossy porcelain like the shell; hands taper
    // to a glossy yolk-coloured teardrop (a quiet echo of the crack-tip yolk
    // peek) and feet are small dark shell-chip wedges, echoing the crack motif
    // instead of a generic block.
    const limbShellMat = toonMat({ color: LIMB_LILAC, roughness: 0.4 });
    const limbShellShadowMat = toonMat({ color: LIMB_LILAC_SHADOW, roughness: 0.42 });
    const yolkHandMat = glossyMat({ color: YOLK_HAND, roughness: 0.2 }); // deepened — see YOLK_HAND
    const crackFootMat = toonMat({ color: CRACK_DARK, roughness: 0.5 });
    this.rig.dressLimbs((part, size) => {
      switch (part) {
        case 'upperArmL': case 'upperArmR':
        case 'thighL': case 'thighR': {
          const m = new THREE.Mesh(taperedSegment(size.len, size.radius * 0.82, size.radius * 0.6, 12), limbShellMat);
          m.name = `${part}_mesh`;
          m.castShadow = true;
          m.receiveShadow = true;
          return m;
        }
        case 'forearmL': case 'forearmR':
        case 'shinL': case 'shinR': {
          const m = new THREE.Mesh(taperedSegment(size.len, size.radius * 0.6, size.radius * 0.42, 12), limbShellShadowMat);
          m.name = `${part}_mesh`;
          m.castShadow = true;
          m.receiveShadow = true;
          return m;
        }
        case 'handL': case 'handR': {
          const drop = new THREE.Mesh(new THREE.SphereGeometry(size.radius * 0.5, 14, 12), yolkHandMat);
          drop.position.y = -size.radius * 0.62;
          drop.scale.set(1, 1.5, 1);
          drop.name = `${part}_mesh`;
          drop.castShadow = true;
          drop.receiveShadow = true;
          return drop;
        }
        case 'footL': case 'footR': {
          // A flattened, rounded chip rather than a cone — a cone tip reads as a
          // sharp spike once the run cycle's own foot rotation combines with a
          // static tilt (verified against a render: it looked like she was
          // standing on a dagger mid-stride). Same "broken shell fragment" idea,
          // safe under animation.
          const chip = new THREE.Mesh(
            roundedBox(size.radius * 1.7, size.len * 0.5, size.radius * 1.15, size.radius * 0.3, 3),
            crackFootMat
          );
          // Seated on the floor via `size.groundY` (the joint-local y of the world
          // ground, new on `LimbSize`) rather than by eye. `types.ts` convention #1
          // is "feet at y=0" and the whole cast was 0.08-0.25 m under it; `Math.min`
          // keeps the authored droop as the floor for the value so this can only ever
          // raise a foot, never sink one.
          chip.position.set(0, Math.max(size.groundY + size.len * 0.25, -size.len * 0.36), size.radius * 0.25);
          chip.rotation.y = Math.PI / 5;
          chip.name = `${part}_mesh`;
          chip.castShadow = true;
          chip.receiveShadow = true;
          return chip;
        }
        default:
          return null;
      }
    });

    this.buildFace(R);
    this.buildSilhouetteEvents(R);

    outlineGroup(this.root);
    this.collectFlashTargets();
    this.rig.restPose();
  }

  /**
   * ── THE DARK GARMENT: a hood pushed back off the crown, and its cape ─────────
   *
   * Two separate measurements asked for this and neither could be answered with
   * albedo.
   *
   * 1. VALUE. `valuescan --mode gate` wants P05 <= 0.180; Egg sits at 0.279, the
   *    only character in the cast that the albedo pass could not close. The
   *    reason is arithmetic, recorded at `SHELL_BODY` above: the head is 93.7% of
   *    the character and the shell being near-white IS the egg, so the only masses
   *    left to carry a dark rung are the limbs — ~1% of the silhouette each, with
   *    no room for three 0.10 steps at 111 px. A dark rung needs AREA, and the
   *    only area available is area that does not exist yet.
   *
   * 2. SILHOUETTE. Measured in the LIVE MATCH at the match camera and the shipped
   *    spawn facing (`tools/tmp/limbmatch.mjs`), Egg is the worst-reading shape in
   *    the cast: hull deficiency **0.0986** against a floor of **0.2007** taken
   *    from the weakest of six hand-verified Brawl Stars plates, and only **4.4%**
   *    of its on-screen pixels are anything other than the food mass. Rendered and
   *    looked at, it is a pale boulder with two dark stubs under it.
   *
   * ── Why a hood, and why PUSHED BACK ────────────────────────────────────────
   * The match camera pitches **58 degrees**, so the surface it sees most of is the
   * TOP of the mass — which on this character is the lifted lid, the crack and the
   * face, i.e. the entire identity. Anything laid over the crown buys value by
   * deleting the character. The back hemisphere above the equator is the one large
   * area this camera sees a lot of and the design needs none of, so that is where
   * the garment goes: `theta 0.55PI .. 1.45PI`, which leaves the front 0.55PI clear
   * on both sides of the face.
   *
   * The hood STANDS OFF the shell — 0.028R at the crown opening out to 0.11R at
   * the rim — and carries a DROOPING POINT off the back of the crown. The point is
   * the silhouette half of the job and it is not decoration: measured, a hood that
   * merely hugs the ovoid moved hull deficiency 0.0986 -> 0.0992, i.e. nothing at
   * all. The outline of a sphere with a dark patch painted on it is still the
   * outline of a sphere. Only geometry that leaves the surface changes the shape.
   *
   * ── Egg already HAD a dark garment, and it delivered nothing ────────────────
   * The scarf above is `LIMB_LILAC` (#241A38, near-black) and has been since the
   * value pass. It sits at `phi 0.80PI` — near the bottom pole, where the ovoid's
   * radius has collapsed — and under a camera looking DOWN at 58 degrees it is
   * almost entirely behind the shell's own bulge. `docs/LESSONS.md` §1 for the
   * seventeenth time: the fix is not "add a dark garment", it is "put the dark
   * garment where pixels reach the screen". The scarf is kept (it is the front
   * half of the costume and reads at character-select framing) and the cowl is the
   * half that reaches the match.
   */
  /**
   * SILHOUETTE EVENTS — three shell shards, mid-hatch.
   *
   * Egg has the worst outline in the cast at BOTH facings: hull deficiency 0.0995
   * at the shipped facing and **0.0613** head-on, against a six-plate Brawl Stars
   * floor of 0.2007. Read the mask in `shots/limbmatch/before/chars/egg.yaw0.png`
   * and there is nothing to interpret — it is a disc.
   *
   * The previous pass established what does NOT work here, and the reason is worth
   * keeping in front of whoever reads this next: a drooping hood point on the back
   * of the CROWN moved hull deficiency by 0.0003, because at the crown the convex
   * hull is already generous and an addition reaching 0.7R along the surface normal
   * is still inside it. The place where that stops being true is the EQUATOR — the
   * ovoid is at its widest there, so the hull is tight against the shell and a
   * horizontal protrusion leaves it on its first millimetre. That is a property of
   * the shape, not of the ornament, and it is why these are shards at the shoulder
   * line rather than anything on top.
   *
   * Three, at three different lengths and azimuths, so no two merge into one
   * component under the metric's opening. `rules.ts` gives this character Shell
   * Shards and Hatch! — a shell mid-break is the read the kit already asked for.
   */
  private buildSilhouetteEvents(R: number): void {
    const head = this.rig.joints.head;
    const box = localBounds(head);

    const shardMat = toonMat({ color: SHELL, roughness: 0.4 });
    const shardShadeMat = toonMat({ color: SHELL_BODY, roughness: 0.42 });
    // ROUND 3: four, half again as long, half again as wide, and much closer to
    // HORIZONTAL. The first version aimed them out-and-UP at up to 0.75 of vertical,
    // which on an ovoid means climbing along a surface that is curving away — the
    // tips stayed inside the hull and the whole set was worth 0.1662 at the shipped
    // facing against a 0.2007 floor. Lift is now 0.20-0.55 and the fourth sits at
    // the crack, where the shell is genuinely coming apart.
    const spec = [
      { azimuth: Math.PI * 0.50, height01: 0.74, len: 0.90, lift: 0.40, mat: shardMat },
      { azimuth: -Math.PI * 0.50, height01: 0.66, len: 0.74, lift: 0.22, mat: shardShadeMat },
      { azimuth: Math.PI * 0.97, height01: 0.70, len: 0.86, lift: 0.34, mat: shardMat },
      { azimuth: Math.PI * 0.10, height01: 0.90, len: 0.66, lift: 0.55, mat: shardShadeMat },
    ];
    for (const sp of spec) {
      const { at, out } = massAnchor(head, box, { azimuth: sp.azimuth, height01: sp.height01, inset: 0.20 });
      const g = new THREE.Group();
      g.name = 'egg_shell_shard';
      aim(g, at, out.clone().add(new THREE.Vector3(0, sp.lift, 0)).normalize(), Math.PI * 0.5);
      // `waist: 0.75` keeps the sides nearly straight, so it reads as a snapped
      // plate of shell rather than as a leaf.
      g.add(shardBlade(sp.mat, {
        len: R * sp.len, halfWidth: R * 0.36, thick: R * 0.050, waist: 0.75,
      }));
      head.add(g);
    }
  }

  private buildCowl(R: number): void {
    const head = this.rig.joints.head;
    const cloth = toonMat({ color: GARMENT, roughness: 0.62, doubleSide: true });
    const clothLit = toonMat({ color: GARMENT_LIT, roughness: 0.58, doubleSide: true });

    // Back hemisphere only — the front stays bare, so the lid, the crack and the
    // face are untouched.
    //
    // ── SIZED BY MEASUREMENT, and the first size was a disaster ────────────────
    // Pass 1 ran the hood from `phi 0.15PI` to `0.60PI` standing 0.085R -> 0.34R
    // proud, with a scalloped cape under it down to `0.80PI`. Rendered and looked
    // at (non-negotiable #3), that is not a hood — it is a black dome that
    // swallowed the entire character, legs included. Measured at the match camera
    // and the shipped facing it made every single number WORSE: hull deficiency
    // 0.0986 -> 0.0532, wasted limb footprint 53.8% -> 89.9%, and the share of the
    // silhouette that is anything other than the food mass 4.4% -> 0.7%. A garment
    // big enough to guarantee a dark rung is big enough to BE the character.
    //
    // The working size is roughly a third of that, and the cape is gone: it was
    // the piece reaching down over the legs, which is the scarf's own recorded
    // mistake (`scarfPhi`, above) repeated one layer up.
    // Narrowed and dropped off the crown after a blind critic called the result a
    // near-black hemisphere cutting the body in half — see the note on `GARMENT`
    // for why softening rather than reverting still holds the p05 gate.
    const T0 = 0.72 * Math.PI;
    const T1 = 1.28 * Math.PI;
    const PHI_TOP = 0.30 * Math.PI;
    const PHI_RIM = 0.50 * Math.PI;   // the equator — the garment never reaches the legs

    // ── The hood ──────────────────────────────────────────────────────────────
    const hood = new THREE.Mesh(
      shellPatch(T0, T1, PHI_TOP, PHI_RIM, R, (_u, v) => {
        const s = v * v * (3 - 2 * v);          // smoothstep: hugs the crown, lifts at the rim
        return R * (0.028 + 0.082 * s);
      }),
      cloth
    );
    hood.name = 'egg_hood';
    hood.castShadow = true;
    hood.receiveShadow = true;
    // Thin double-sided cloth: an inverted-hull outline on a shell with no interior
    // renders as a black slab rather than an edge.
    hood.userData.noOutline = true;
    head.add(hood);

    // ── The rolled rim ────────────────────────────────────────────────────────
    // A real tube, not a patch, so the opening has a solid edge to catch the key
    // light — and so ONE piece of this costume carries an ink outline. It stands
    // slightly PROUDER than the hood it closes, which is the whole silhouette
    // contribution: a lip on the outline instead of a smooth arc.
    {
      const pts: THREE.Vector3[] = [];
      const N = 26;
      for (let i = 0; i <= N; i++) {
        const t = T0 + (T1 - T0) * (i / N);
        const s = eggSurface(t, PHI_RIM, R);
        pts.push(s.pos.clone().addScaledVector(s.normal, R * 0.085));
      }
      const rim = new THREE.Mesh(
        new THREE.TubeGeometry(new THREE.CatmullRomCurve3(pts), 40, R * 0.042, 8, false),
        clothLit
      );
      rim.name = 'egg_hood_rim';
      rim.castShadow = true;
      rim.receiveShadow = true;
      head.add(rim);
    }

    // ── The drooping hood point: BUILT, MEASURED, REMOVED ─────────────────────
    // A tapered drooping tube off the back of the crown with a pale bobble on the
    // tip, added to buy the silhouette half of this garment's job. It moved hull
    // deficiency at the shipped facing by **0.0003** (0.0992 -> 0.0989) — nothing —
    // and rendered, from behind, as a lump in the middle of the hood. Both facts
    // are recorded here rather than the code being quietly deleted, because the
    // reason it failed is the finding: at the match camera Egg's ovoid is 1.16R
    // wide at its bulge and any addition that starts on the shell and reaches
    // 0.7R along the surface normal is still INSIDE that hull. Egg's outline
    // cannot be fixed by bolting a landmark onto the egg; it needs the egg to stop
    // being the whole character. See `tools/tmp/limbmatch.mjs` and the report.

    // ── The clasp ─────────────────────────────────────────────────────────────
    // One small saturated landmark at each end of the rim, so the garment reads as
    // WORN rather than as a shadow. Neon, because that is Egg's rarity accent and
    // the crack seam is the only other place it appears.
    for (const sx of [-1, 1] as const) {
      const p = eggSurface(sx * 0.72 * Math.PI, PHI_RIM - 0.02, R);
      const clasp = new THREE.Mesh(new THREE.SphereGeometry(R * 0.05, 12, 10), glossyMat({ color: NEON_ACCENT, roughness: 0.25 }));
      clasp.position.copy(p.pos).addScaledVector(p.normal, R * 0.085);
      clasp.name = 'egg_cowl_clasp';
      clasp.castShadow = true;
      head.add(clasp);
    }
  }

  /**
   * Open eyes with catchlights, thin shell-toned brow creases (an egg has no hair,
   * so "worry" reads as a raised ridge, not eyebrows), and a small worried mouth.
   *
   * ── Mounted on `rig.joints.face`, re-anchored at the head origin ─────────────
   * Every feature here is authored in EXACT head-local surface coordinates by
   * `eggSurface()`, so it cannot inherit `face`'s built-in forward offset (which is
   * tuned for a plain sphere and would double up against this ovoid). The offset is
   * therefore zeroed and the features are parented to `face` anyway, which is a pure
   * reparent: `face` is a direct child of `head` with an identity transform once the
   * offset is cleared, so not one vertex moves.
   *
   * It is not cosmetic. `thumbs.ts`'s character-select framing rule is FACE-AWARE —
   * it crops to the lower of the waist and a margin below the bottom of the face,
   * read from this joint — and it falls back to the whole head box when the joint is
   * empty, which is a guess. `tools/tmp/chars_metrics.mjs` likewise cannot assert a
   * face it cannot find, and four of eleven characters were outside that test.
   * Verified with `tools/tmp/facemove.mjs`: the world matrix of every mesh in the
   * model hashes identically before and after.
   */
  private buildFace(R: number): void {
    const face = this.rig.joints.face;
    face.position.set(0, 0, 0);
    const EYE_THETA = 0.50;
    const EYE_PHI = 0.43 * Math.PI;
    // At the old sizing every feature here (eyes, brows, mouth) sat well under
    // half the size of the equivalent feature on any other character in the
    // cast, and against a head this large and this plain (no shell texture,
    // no costume) that read as a sparse, half-finished face rather than a
    // deliberately minimal one. FS scales every feature up ~35% uniformly;
    // positions are untouched, and the eyes stay well clear of collapsing
    // into each other at this size (see the round-2 note below).
    const FS = 1.35;

    for (const sx of [-1, 1] as const) {
      const eye = addShellDecal(face, sx * EYE_THETA, EYE_PHI, R * 0.012, R);

      const white = new THREE.Mesh(new THREE.SphereGeometry(R * 0.125 * FS, 16, 14), toonMat({ color: '#FFFFFF', roughness: 0.3 }));
      white.scale.set(1, 1.08, 0.55);
      white.castShadow = true;
      eye.add(white);

      const pupil = new THREE.Mesh(new THREE.SphereGeometry(R * 0.062 * FS, 14, 12), toonMat({ color: INK, roughness: 0.25 }));
      pupil.position.set(0, -R * 0.01, R * 0.06 * FS);
      pupil.scale.set(1, 1, 0.55);
      pupil.castShadow = true;
      eye.add(pupil);

      const glint = new THREE.Mesh(new THREE.SphereGeometry(R * 0.028 * FS, 8, 8), flatMat('#ffffff'));
      glint.position.set(-sx * R * 0.03, R * 0.045, R * 0.10 * FS);
      glint.userData.noOutline = true;
      eye.add(glint);

      // Worry crease: a raised shell ridge, inner end lifted, above each eye. A
      // second independent art-director pass named facial acting as the cast's
      // biggest remaining gap, and a mirrored crease on both sides (identical
      // height/tilt) was exactly the "matched, no personality" pattern it flagged —
      // so the right crease now sits higher and cocks harder than the left, one
      // genuinely raised eyebrow rather than two symmetric worry lines.
      const browPhi = sx > 0 ? EYE_PHI - 0.205 : EYE_PHI - 0.135;
      const brow = addShellDecal(face, sx * EYE_THETA * 0.92, browPhi, R * 0.010, R);
      const creaseMesh = new THREE.Mesh(
        roundedBox(R * 0.20 * FS, R * 0.040 * FS, R * 0.028 * FS, R * 0.018, 2),
        toonMat({ color: SHELL_SHADOW, roughness: 0.45 })
      );
      // (sign verified against a render: the naive -sx tilt read as angry —
      // inner end low, outer high — so this is flipped to lift the inner end.)
      creaseMesh.rotation.z = sx * (sx > 0 ? 0.52 : 0.30);
      creaseMesh.castShadow = true;
      brow.add(creaseMesh);
    }

    // Mouth: a small worried "o" rather than a flat dash — a flat bar barely reads
    // as a mouth shape at all at gameplay distance, and a second independent
    // art-director pass named a real mouth shape as required across the whole
    // cast. A small open ring pairs naturally with the raised-crease worry above
    // it (about to hatch, bracing for a hit) while staying dainty/deadpan rather
    // than a wide cartoon gasp.
    const mouth = addShellDecal(face, 0, 0.505 * Math.PI, R * 0.010, R);
    const mouthMesh = new THREE.Mesh(
      new THREE.TorusGeometry(R * 0.052 * FS, R * 0.019 * FS, 10, 16),
      toonMat({ color: INK, roughness: 0.3 })
    );
    mouthMesh.castShadow = true;
    mouth.add(mouthMesh);
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

  /** The rig owns all body motion; the base class's whole-body pass would fight it. */
  protected applyBaseMotion(): void {}
}
