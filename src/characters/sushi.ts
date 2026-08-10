/**
 * Sushi (Legendary).
 *
 * Built on the shared ChibiRig — see `donut.ts` for the reference implementation of
 * this pattern. The rig supplies torso, arms, hands, legs, feet and all motion; this
 * file authors only the food mass on `rig.joints.head`, the face and a palette.
 *
 * Identity is fixed by `rules.ts`: Sushi, Legendary rarity, Rice Spray / Seaweed Bait /
 * Fish Pile / Big Catch. The written description ("rice cylinder banded with nori,
 * salmon centre, wide eyes, puckered lips") is treated as a personality guide rather
 * than a literal spec, per the brief, but the nori-band-on-rice motif IS kept and
 * doubled down on as the character's silhouette landmark — it is the single strongest
 * high-contrast graphic read available (near-black on white) and Legendary is the
 * premium tier, so it earns the most craft in the cast.
 *
 * Read as classic salmon nigiri: a rounded rice mound, a glossy salmon slice DRAPED
 * over the top with its two ends hanging down past the rice, and a near-black nori
 * strap across the topping. That same rice + nori motif is carried down onto the torso
 * so the whole body reads as "made of sushi", not just the head.
 *
 * ── 2026-08-06: THE TOPPING HAD EATEN THE THING IT WAS TOPPING ───────────────
 * `docs/DECISIONS-FOR-URI.md` §40 finding 5: *a detail added to signal the subject can
 * destroy the silhouette that signalled it better.* Recorded on Egg. It was live here
 * too, and worse, because the offending detail was 57% of the head's pixels.
 *
 * The fish was an ELLIPSOID centred at h 0.80 with X and Z radii of 1.16 and 1.06
 * against the rice's own 1.00 — i.e. **wider than the rice at every height it
 * occupied**, spanning h 0.57 to 1.03. So it covered the entire crown and stood proud
 * of the rice all the way round at a constant height. Read off the render: a **cream
 * bucket with an orange beret on it**, which is also exactly the "Sushi and Soup are
 * the one confusable pair" note this file already carried, arriving through the topping
 * rather than through the rice.
 *
 * The mechanism is arithmetic, not taste, and it rules out the whole SHAPE FAMILY:
 * for any solid convex blob, the lower edge of the part that emerges from the rice is
 * y(x) = yc − ay·sqrt(1 − (x/ax)²) — **highest at the ends and lowest in the middle.**
 * That is the definition of a brim. A real slice draped over a loaf is the opposite: its
 * hem DIPS at the two ends and RIDES HIGH front and back. A saddle, not a circle.
 *
 * So the fish is now a SHELL with a saddle hem (`drapedSlice`), hem h 0.26 at the ends
 * and h 0.74 at the front — which is also what gives the face a clear rice field to sit
 * in. Both are one parameter pair, so the face zone and the drape cannot drift apart.
 */

import * as THREE from 'three';
import { BaseCharacter, type AnimContext } from './types';
import type { CharacterDef } from '../game/rules';
import { PALETTE, RARITY_COLORS } from '../game/rules';
import { toonMat, glossyMat, flatMat, outlineGroup, roundedBox } from '../render/toon';
import { ChibiRig, type LimbPart } from './rig';
import { bodyType } from './bodies';
import { aim, localBounds, massAnchor, rod } from './appendages';
import { CHARACTER_HEIGHT } from '../units';

/**
 * ── NEAR-WHITE CLIPPING, and this is a measured pixel defect rather than taste ──
 * `sepscan --mode chars` reports the share of a character above luma 0.94 at the
 * shipped camera and shipped facing, and the same code over the six hand-verified
 * Brawl Stars full-body plates gives the band: **0.0072-0.0929, median 0.0249**,
 * p95 0.805-0.9685. An independent critic audit measured the same thing on gameplay
 * plates and got even less headroom — Shelly 0.2%, Barley 0.0%, with empty-floor
 * controls at 0.0%, so it is the character and not the frame.
 *
 * This character measured **13.63%** clipped and p95 **0.9820**.
 *
 * It is the cost `docs/STATE.md` records as cast-mean p95 drifting 0.896 -> 0.923
 * during the value pass, seen at the pixel: the dark rung was won (p05 is now better
 * than both plates) and the light end went with it, onto exactly the top-facing
 * surfaces a 58deg camera sees most of. The fix is albedo, and it is NOT a
 * desaturation — scaling a warm off-white DOWN raises its chroma, which is the
 * direction `docs/LESSONS.md` records as falsified four times in the other one.
 */
const RICE = '#DCD3BD';        // sticky rice (luma 0.992 -> 0.829)
const RICE_SHADE = '#CFC6AE';  // grain shading, a touch deeper (luma 0.926 -> 0.777)
// Lifted off `PALETTE.nori`'s near-black #2B2B2B to a dark seaweed GREEN. Two
// measured reasons: (1) at near-black the torso sat about six value stops below
// the cream head and a blind critic read the character as "a floating head with a
// hole under it"; (2) real nori is green-black, and a hue there means the dark mass
// is a material rather than a hole. Still the darkest thing on the character, so it
// keeps its job as the high-contrast landmark.
// ── The dark rung ────────────────────────────────────────────────────────────
// Sushi's GLOBAL range already passed (0.670 against a 0.636 floor). Its problem was
// LOCAL: 68.8% of its part boundary was under 0.10 apart, and it was concentrated on
// the two biggest seams on the model — `head|torso` 0.091 across 119 px and
// `torso|shoulderL` 0.082 across 92 px. Both are the same fact: the salmon head, the
// salmon limbs and the belted torso were three tones inside a tenth of a stop.
//
// So the nori goes properly black. It dresses the maki wall, the maki rim, the boots,
// the head's base strip and (see `dressLimbs`) the limbs, which is ~16% of the
// character — enough AREA to be a P05 rather than a detail. Measured at pot_south,
// shipped framing: range 0.671 -> 0.800, p05 0.308 -> 0.179, steps@0.10 6 -> 7,
// figure/ground 0.237 -> 0.199. p50 is UNCHANGED at 0.618: this is a ladder, not a
// darkening.
const NORI = '#0E1712';
const NORI_DEEP = '#070C09';   // the maki's own rim, one step darker than the wall
// Pushed off `PALETTE.salmon` (#F4A261, a pale peach) to a genuinely saturated
// fish orange. Two reasons, both measured rather than aesthetic: the fish is now
// the largest single colour area on the character (see the PROFILE rewrite below),
// and the cast owns the warm half of the colour wheel unopposed since the arena was
// re-keyed cool — a pale peach spends that position for nothing.
const SALMON = '#E0722F';
/**
 * Salmon FAT — the pale marbling lines. Added because the fish's only marking used to
 * be three `SALMON_DARK` bars, which at the shipped head size read as scratches and
 * carried the wrong polarity: a slice of salmon is identified by PALE lines on orange,
 * not dark ones. They also do real metric work — the fish is the largest single colour
 * area on the character and it presented ONE value, so it contributed nothing to the
 * ladder.
 */
const SALMON_FAT = '#F6C9A6';
/**
 * The limbs, and ONLY the limbs. This partly reverses a documented earlier decision
 * ("the limbs move from nori-charcoal to the fish's own saturated orange") and the
 * reason is measured: with salmon limbs, `torso|shoulderL` was 0.082 across 92 px and
 * `head|torso` 0.091 across 119 px — the two largest seams on the character, both
 * invisible. The earlier revert was made because near-black on the limbs AND the torso
 * AND a head band left "most of the character one dark value"; that is checked here
 * rather than assumed, and it does not happen — the head's 57% of salmon is untouched,
 * p50 stays exactly 0.618, and figure/ground stays 0.199. See the NORI block above.
 */
const LIMB_NORI = '#0C1410';

// ── PASS 2: the limb CHAIN has to alternate, not ramp ────────────────────────
// The first value pass took both limb tones down together. That fixed range/P05 and
// BROKE the part boundary — measured, `shoulderL|elbowL` 0.044, `kneeL|footL` 0.035,
// because a chain of four segments each a shade darker than the last is one mass. The
// reference's grammar is alternation: mid sleeve, dark cuff, light glove. So the upper
// segment comes back UP, the lower segment holds the dark, and the boot takes its own
// darkest tone instead of sharing the shin's.
/** Upper arm / thigh. Nori stays on the forearm, shin and boots.
 *
 * ── Raised #8A3A18 -> #A85028, and `torso|shoulderL` is the reason ───────────
 * That pair is this character's LARGEST adjacency (95 contact pixels, more than the
 * next two together) and it measured `dLcontact` **0.0469** on HEAD — the arm and the
 * body it hangs on were a twentieth of a stop apart where they meet. `dressLimbs`
 * below records why: the Fresnel rim lifted the shoulder's contact band +0.093 straight
 * ONTO the torso's, and the note says plainly that it "is not tunable out" **with the
 * rim** — rimStrength would have to reach ~0.75. It is tunable out with ALBEDO, which
 * that note did not try. sRGB luma 0.284 -> 0.376, so the pair should clear the 0.10
 * standard on the albedo step alone, and every other pair this tone touches
 * (`shoulderL|elbowL`, `hipL|kneeL`) moves the same way because the segment below it is
 * nori-dark in both chains. */
const LIMB_SALMON_DEEP = '#A85028';
const SALMON_DARK = '#6A2208'; // fish striation lines — a real step under the flesh, not a tint
const LIP = '#E8798F';         // puckered-lip coral
const GOLD = RARITY_COLORS.Legendary; // #F4A300 — rarity accent, used sparingly

// ── Costume layer ────────────────────────────────────────────────────────────
// A fresh independent art director named the missing costume/accessory layer as
// the TOP gap in the whole cast: without one, characters read as "naked mascot
// body with a themed head glued on" no matter how good the body sculpt is. A
// tied hachimaki headband with trailing tails is Sushi's silhouette-breaking
// item — the tails project past the head's own round silhouette from the back/
// side the way a cape or backpack does on the reference roster — plus a pair of
// chopsticks tucked into the torso sash as a smaller detail prop.
const HEADBAND = '#4E1209';      // chef's-headband red, deep enough to be part of the dark rung
const HEADBAND_DARK = '#8A2A20'; // knot shading
const CHOPSTICK = '#5A4020';     // scorched bamboo

/** A profile curve as the two functions every mass on this head is solved against. */
interface Profile {
  /** Local radius (metres, BEFORE the SX/SZ ellipse) at a height fraction 0-1. */
  rAt: (h: number) => number;
  /** Local Y (metres) at a height fraction 0-1. */
  yAt: (h: number) => number;
}

/**
 * The outward unit normal of the profile curve in the (r, y) half-plane, by finite
 * difference on the curve itself rather than by a hand-differentiated formula — the
 * profile is edited often and a stale derivative is a silent error.
 *
 * The profile runs bottom -> top, so the tangent is (dr, dy) with dy > 0 and the
 * outward normal is that rotated by -90 degrees: (dy, -dr). Checked at the three places
 * it matters: at the widest point dr = 0 -> (1, 0), straight out; above it dr < 0 ->
 * (+, +), out and up; below it dr > 0 -> (+, -), out and down.
 */
function profileNormal(p: Profile, h: number): [nr: number, ny: number] {
  const e = 0.005;
  const h0 = Math.max(0, h - e), h1 = Math.min(1, h + e);
  const dr = p.rAt(h1) - p.rAt(h0);
  const dy = p.yAt(h1) - p.yAt(h0);
  const L = Math.hypot(dr, dy) || 1;
  return [dy / L, -dr / L];
}

/**
 * ── THE SALMON SLICE: a shell with a SADDLE HEM ──────────────────────────────
 *
 * See the file header for why no solid blob can do this job. The construction:
 *
 *   hem(θ) = hemMid − hemAmp·cos(2θ)      θ measured from +X, the head's long axis
 *
 * so the hem sits LOW at θ = 0 and π (the two ends of the nigiri, where the fish
 * droops over) and HIGH at θ = ±π/2 (front and back, where it rides up and leaves the
 * face a clear field of rice). One `cos(2θ)` is the entire difference between "a slice
 * laid over a loaf" and "a beret", and it is worth saying out loud because two previous
 * rewrites of this file tried to fix the beret by changing the blob's PROPORTIONS,
 * which cannot work — the note in `docs/LESSONS.md` §1 about re-deriving rather than
 * re-tuning is the same failure one level up.
 *
 * The shell is the rice's own surface offset outward along `profileNormal`, so it hugs
 * the mound exactly instead of being a second sphere near it (the "hard hat" failure
 * this file already recorded twice). `endBulge` thickens the offset toward the ends so
 * the drape genuinely OVERHANGS there — that overhang is the silhouette information —
 * and it tapers to zero at the crown so the apex is a single clean point rather than a
 * ragged ring of different offsets.
 *
 * ⚠️ WINDING IS CHECKED, NOT ASSUMED. `docs/LESSONS.md` §12: inverted lathe normals bit
 * six characters at once and render near-black. This geometry is hand-indexed, so the
 * same mistake is available; the outer hem vertex's computed normal is tested against
 * the outward radial direction and the index buffer is reversed if it disagrees.
 */
function drapedSlice(p: Profile, o: {
  hemMid: number; hemAmp: number; thick: number; endBulge: number;
  segTheta?: number; segU?: number;
}): THREE.BufferGeometry {
  const NT = o.segTheta ?? 56;
  const NU = o.segU ?? 12;
  const hemAt = (t: number) => o.hemMid - o.hemAmp * Math.cos(2 * t);

  // rings[0] is the INNER hem (just under the rice's skin, so the slice has a visible
  // cut edge instead of a paper-thin border); rings[1..NU+1] are the outer shell.
  const pos: number[] = [];
  for (let k = 0; k <= NU + 1; k++) {
    for (let i = 0; i < NT; i++) {
      const th = (i / NT) * Math.PI * 2;
      const hem = hemAt(th);
      const inner = k === 0;
      const u = inner ? 0 : (k - 1) / NU;
      const h = hem + u * (1 - hem);
      const c = Math.cos(th);
      const t = inner ? -0.02 * p.rAt(h) : o.thick * (1 + o.endBulge * c * c * (1 - u));
      const [nr, ny] = profileNormal(p, h);
      const r = p.rAt(h) + t * nr;
      pos.push(r * c, p.yAt(h) + t * ny, r * Math.sin(th));
    }
  }

  const idx: number[] = [];
  for (let k = 0; k <= NU; k++) {
    for (let i = 0; i < NT; i++) {
      const a = k * NT + i, b = k * NT + ((i + 1) % NT);
      const c = (k + 1) * NT + i, d = (k + 1) * NT + ((i + 1) % NT);
      idx.push(a, c, b, b, c, d);
    }
  }

  const geo = new THREE.BufferGeometry();
  geo.setAttribute('position', new THREE.Float32BufferAttribute(pos, 3));
  geo.setIndex(idx);
  geo.computeVertexNormals();
  // The winding check: the outer-hem vertex at θ = 0 sits on the +X flank, so its
  // normal must have a positive X component. If it does not, every face is inside-out.
  const nrm = geo.attributes.normal as THREE.BufferAttribute;
  if (nrm.getX(NT) < 0) {
    idx.reverse();
    geo.setIndex(idx);
    geo.computeVertexNormals();
  }
  return sanitiseNormals(geo);
}

/**
 * 🚨 REPLACE ZERO-LENGTH VERTEX NORMALS. THIS ONE BLACKED THE WHOLE FRAME.
 *
 * `computeVertexNormals()` sums face normals as cross products, and a DEGENERATE
 * (zero-area) triangle contributes the zero vector. `Vector3.normalize()` divides by
 * `length() || 1`, so such a vertex ends up with a normal of exactly (0,0,0) — and
 * nothing on the CPU is NaN, so a NaN sweep over the buffers passes. In GLSL,
 * `normalize(vec3(0))` is NaN; the fragment goes NaN, the post chain's blur smears it,
 * and the ENTIRE CANVAS renders black.
 *
 * How it presented, because the symptom is nothing like the cause: a yaw-90 lobby
 * capture came back `stdev 0, mean 0` four times running, on this file and not on HEAD,
 * with no page error, no lost WebGL context, a correct camera and 131 healthy meshes.
 * Yaw 90 is the axis `crossStrap` EXTRUDES along, so it is the one camera that looks
 * straight into the degenerate end caps. `docs/LESSONS.md` §1 — "it isn't there" meaning
 * "it IS there and is invisible" — with the invisibility applied to the whole frame.
 *
 * The cause is fixed at source too (`crossStrap` now drops coincident shape points), but
 * this stays as the guarantee: a `Shape` is triangulated by a library routine, so
 * "there are no degenerate triangles" is not something this file can promise, and the
 * cost of being wrong is a black screen rather than a blemish. The replacement points
 * away from the geometry's own centroid, which is correct for every closed convex-ish
 * band here and is in any case only ever applied to vertices that had NO normal at all.
 *
 * Asserted by `tools/tmp/ch_sushi_geom.mjs`, which fails on a zero-length normal.
 */
function sanitiseNormals(geo: THREE.BufferGeometry): THREE.BufferGeometry {
  const nm = geo.attributes.normal as THREE.BufferAttribute | undefined;
  const pos = geo.attributes.position as THREE.BufferAttribute;
  if (!nm) return geo;
  geo.computeBoundingSphere();
  const c = geo.boundingSphere?.center ?? new THREE.Vector3();
  let fixed = 0;
  const v = new THREE.Vector3();
  for (let i = 0; i < nm.count; i++) {
    if (Math.hypot(nm.getX(i), nm.getY(i), nm.getZ(i)) >= 1e-6) continue;
    v.set(pos.getX(i) - c.x, pos.getY(i) - c.y, pos.getZ(i) - c.z);
    if (v.lengthSq() < 1e-12) v.set(0, 1, 0);
    v.normalize();
    nm.setXYZ(i, v.x, v.y, v.z);
    fixed++;
  }
  if (fixed) nm.needsUpdate = true;
  return geo;
}

/**
 * A band running FRONT-TO-BACK over the head at a fixed |x|: the nori strap that holds
 * the topping onto the rice, and the pale fat lines on the fish.
 *
 * The cross-section of a surface of revolution at |x| = x0 is z(h) = √(r(h)² − x0²),
 * which exists only where r(h) > x0 — so the band is built on that curve, offset
 * outward, and it automatically stops where the head narrows past it. `hLo` is where
 * the band's two ends stop, and it must be at or above the drape's own hem at that
 * azimuth or the band walks off the fish and onto the face.
 *
 * Built in the shape plane (x ↦ world Z, y ↦ world Y) and extruded along shape-Z, then
 * rotated so the extrusion lies along world X — the head's long axis. `rotateY(π/2)` is
 * an explicit single-axis geometry rotation, not composed Euler angles on a flat plane,
 * which is the trap `docs/LESSONS.md` §12 records for edge-on discs.
 */
function crossStrap(p: Profile, o: {
  x0: number; halfWidth: number; hLo: number;
  /**
   * Outward offset, as a FUNCTION of height rather than a constant — and that is not
   * generality for its own sake. A band riding on the drape has to clear a surface
   * whose own offset varies with `cos²θ` and with `u`, so a single number is either
   * buried at one end of the band or standing 3x too proud at the other. The first
   * version used a constant and the render came back with two beige BAND-AIDS taped to
   * an orange helmet.
   */
  thickAt: (h: number) => number;
}): THREE.BufferGeometry | null {
  const zAtH = (h: number) => Math.sqrt(Math.max(0, p.rAt(h) ** 2 - o.x0 ** 2));  // x0² — sign-free
  // The upper crossing where the head narrows to |x0|, searched DOWN from the apex so
  // the lower crossing (which exists too, near the base) cannot be picked by mistake.
  // ⚠️ `Math.abs`, because `x0` is SIGNED — the bands come in mirrored pairs. Without
  // it a negative `x0` makes this comparison true at the apex (radius 0 > a negative
  // number), `hHi` stays at 1, and the band is built over a cross-section that does not
  // exist. Caught by `tools/tmp/ch_sushi_geom.mjs`, not by looking at it.
  const ax = Math.abs(o.x0);
  let hHi = 1;
  for (let h = 1; h >= o.hLo; h -= 0.002) { if (p.rAt(h) > ax * 1.001) { hHi = h; break; } }
  if (hHi <= o.hLo + 0.02) return null;

  /** Coincidence threshold, scaled to the head rather than an absolute guess. */
  const EPS = p.rAt(0.30) * 0.004;
  const N = 14;
  const outer: Array<[number, number]> = [];
  for (let i = 0; i <= N; i++) {
    const h = o.hLo + (hHi - o.hLo) * (i / N);
    const z = zAtH(h);
    // Normal of the CROSS-SECTION curve (z(h), y(h)), same rotate-the-tangent rule.
    const e = 0.005;
    const h0 = Math.max(0, h - e), h1 = Math.min(1, h + e);
    const dz = zAtH(h1) - zAtH(h0), dy = p.yAt(h1) - p.yAt(h0);
    const L = Math.hypot(dz, dy) || 1;
    const th = o.thickAt(h);
    outer.push([z + th * (dy / L), p.yAt(h) + th * (-dz / L)]);
  }
  const inner: Array<[number, number]> = [];
  for (let i = 0; i <= N; i++) {
    const h = o.hLo + (hHi - o.hLo) * (i / N);
    inner.push([zAtH(h) * 0.985, p.yAt(h)]);
  }

  // The full boundary: outer curve up the +z side, over the apex, down the -z side;
  // then the inner curve back. ⚠️ COINCIDENT POINTS ARE DROPPED, and that is a bug fix,
  // not tidiness — at the apex `z(h)` has collapsed to nearly zero, so the four points
  // around the turn sit within a fraction of a millimetre of each other and the
  // triangulator emits zero-area faces there. See `sanitiseNormals` for what those cost.
  const ring: Array<[number, number]> = [];
  const push = (q: [number, number]) => {
    const last = ring[ring.length - 1];
    if (last && Math.hypot(q[0] - last[0], q[1] - last[1]) < EPS) return;
    ring.push(q);
  };
  for (let i = 0; i <= N; i++) push(outer[i]);
  for (let i = N; i >= 0; i--) push([-outer[i][0], outer[i][1]]);
  for (let i = 0; i <= N; i++) push([-inner[i][0], inner[i][1]]);
  for (let i = N; i >= 0; i--) push(inner[i]);
  while (ring.length > 3 && Math.hypot(ring[0][0] - ring[ring.length - 1][0], ring[0][1] - ring[ring.length - 1][1]) < EPS) ring.pop();
  if (ring.length < 4) return null;

  const s = new THREE.Shape();
  s.moveTo(ring[0][0], ring[0][1]);
  for (let i = 1; i < ring.length; i++) s.lineTo(ring[i][0], ring[i][1]);
  s.closePath();

  const bev = Math.min(o.thickAt((o.hLo + hHi) * 0.5) * 0.45, o.halfWidth * 0.5);
  const g = new THREE.ExtrudeGeometry(s, {
    depth: o.halfWidth * 2 - bev * 2, bevelEnabled: true,
    bevelSize: bev, bevelThickness: bev, bevelSegments: 2, curveSegments: 2,
  });
  g.translate(0, 0, -(o.halfWidth - bev));
  g.rotateY(Math.PI / 2);
  g.translate(o.x0, 0, 0);
  g.computeVertexNormals();
  return sanitiseNormals(g);
}

/**
 * Tapered limb segment: a flat cap at the joint origin (plugs flush into the
 * shoulder/hip, no gap) tapering down a straight wall to a rounded tip of radius
 * `rBot`. Reused per-character with different taper ratios so each cast member's
 * limbs read as their own shape rather than a shared uniform capsule.
 */
function taperedLimb(
  len: number, rTop: number, rBot: number, mat: THREE.Material, segs = 12,
  capBotFrac = 0.45,
): THREE.Mesh {
  // Points MUST run bottom → top for LatheGeometry's automatic normals to face
  // outward (this file's own PROFILE lathe follows the same rule). Getting it
  // backwards was a round 1 defect: the real mesh got face-culled invisible and
  // its outline shell rendered as a solid dark wedge instead of a thin line.
  // Bottom tip is a full rounded hemisphere; the TOP is a shallow dome rather than
  // a hard flat disc — round 2 found that a flat cap, at the angle the rig's rest
  // pose rotates the shoulder/hip to, reads as a flat flag/wing sticking out of
  // the joint rather than blending into it. The dome keeps almost the whole
  // length budget for the actual tapered shaft.
  // ── `capBotFrac` IS AN ARGUMENT, AND IT IS THE BEAD FIX ─────────────────────
  // The bottom tip is a full rounded hemisphere, which is right at the WRIST and at
  // the ANKLE and wrong at the ELBOW and the KNEE. At an interior joint the segment
  // tapers to a point and the next one flares back out from the same point, so the
  // limb pinches to zero width there — and `outlineGroup` gives every mesh its own
  // inverted hull, so the pinch is traced in ink. A chain of segments that each
  // pinch to nothing and each carry their own outline is a string of beads, which is
  // what `donut.ts` and `egg.ts` were rebuilt this pass to stop being. Here the top
  // cap is already a shallow dome, so only the BOTTOM needed to become a caller's
  // choice: interior ends pass ~0.10 and abut cleanly, exterior ends keep 0.45.
  const capBot = Math.min(rBot, len * capBotFrac);
  const capTopH = Math.min(rTop * 0.42, len * 0.16);
  const wallBotY = -(len - capBot);
  const wallTopY = -capTopH;
  const CAP = 5;
  const pts: THREE.Vector2[] = [];
  for (let i = CAP; i >= 0; i--) {
    const a = (i / CAP) * Math.PI * 0.5;
    pts.push(new THREE.Vector2(capBot * Math.cos(a), wallBotY - capBot * Math.sin(a)));
  }
  pts.push(new THREE.Vector2(rTop, wallTopY));
  const TCAP = 4;
  for (let i = 1; i <= TCAP; i++) {
    const a = (i / TCAP) * Math.PI * 0.5;
    pts.push(new THREE.Vector2(rTop * Math.cos(a), wallTopY + capTopH * Math.sin(a)));
  }
  const m = new THREE.Mesh(new THREE.LatheGeometry(pts, segs), mat);
  m.castShadow = true;
  m.receiveShadow = true;
  return m;
}

/** A thin ring cinched around a limb at local Y `y` — the nori-band motif echoed
 * down onto the limbs as a wrist/ankle wrap. */
function cuffRing(y: number, radius: number, thickness: number, mat: THREE.Material): THREE.Mesh {
  const ring = new THREE.Mesh(new THREE.TorusGeometry(radius, thickness, 8, 20), mat);
  ring.name = 'limb_cuff';
  ring.rotation.x = Math.PI / 2;
  ring.position.y = y;
  ring.castShadow = true;
  ring.receiveShadow = true;
  return ring;
}

/**
 * A smooth, closed rice-ball fist — no knuckle bumps (that read as too rustic for a
 * Legendary-tier character) — wrapped with a thin nori ribbon and a small gold stud,
 * echoing the head's own nori-band + gold-clasp motif at hand scale.
 */
function buildRiceFist(R: number, side: 1 | -1, mat: THREE.Material, noriMat: THREE.Material, goldMat: THREE.Material): THREE.Group {
  const g = new THREE.Group();
  const palm = new THREE.Mesh(new THREE.SphereGeometry(R * 0.92, 16, 14), mat);
  palm.scale.set(1.0, 0.94, 1.08);
  palm.castShadow = true;
  palm.receiveShadow = true;
  g.add(palm);

  const ribbon = new THREE.Mesh(new THREE.TorusGeometry(R * 0.72, R * 0.09, 8, 20), noriMat);
  ribbon.name = 'fist_ribbon';
  ribbon.rotation.z = side * 0.35;
  ribbon.position.set(0, -R * 0.05, 0);
  ribbon.castShadow = true;
  ribbon.receiveShadow = true;
  g.add(ribbon);

  const stud = new THREE.Mesh(new THREE.SphereGeometry(R * 0.13, 10, 8), goldMat);
  stud.name = 'fist_stud';
  stud.position.set(side * R * 0.55, R * 0.18, R * 0.55);
  stud.castShadow = true;
  g.add(stud);

  return g;
}

/**
 * A low, elegant lacquered boot — flatter and more slipper-like than a chunky wedge,
 * with a thin gold ankle strap in place of a thick rolled cuff, and a pale rice-shade
 * sole strip breaking up the near-black nori body.
 */
function buildLacqueredBoot(fw: number, bodyMat: THREE.Material, soleMat: THREE.Material, strapMat: THREE.Material): THREE.Group {
  const g = new THREE.Group();
  const body = new THREE.Mesh(roundedBox(fw * 0.90, fw * 0.46, fw * 1.42, fw * 0.20, 3), bodyMat);
  body.position.set(0, -fw * 0.20, fw * 0.26);
  body.castShadow = true;
  body.receiveShadow = true;
  g.add(body);

  const sole = new THREE.Mesh(roundedBox(fw * 0.98, fw * 0.14, fw * 1.60, fw * 0.06, 2), soleMat);
  sole.position.set(0, -fw * 0.44, fw * 0.30);
  sole.castShadow = true;
  sole.receiveShadow = true;
  g.add(sole);

  const strap = new THREE.Mesh(new THREE.TorusGeometry(fw * 0.38, fw * 0.028, 8, 18), strapMat);
  strap.name = 'boot_strap';
  strap.rotation.x = Math.PI / 2;
  strap.position.set(0, fw * 0.06, fw * 0.06);
  strap.castShadow = true;
  strap.receiveShadow = true;
  g.add(strap);

  return g;
}

export class SushiCharacter extends BaseCharacter {
  private rig: ChibiRig;
  private riceGrains: THREE.Object3D[] = [];

  constructor(def: CharacterDef) {
    super(def);

    this.rig = new ChibiRig({
      palette: {
        // A fresh independent art director named the exact failure: Soup, Water Bottle
        // and Sushi all ended up with cream/white tapered limbs and dark boots, reading
        // as the same parts reskinned. The rice-mound HEAD stays white (that's not the
        // problem, and it's the character's own landmark shape) but the BODY moves to a
        // glossy nori-charcoal "wetsuit" — echoing the head's own nori band at body
        // scale — with pale rice-white boots inverting the old dark-boot convention.
        // Head+torso round: the limbs move from nori-charcoal to the fish's own
        // saturated orange, and the boots invert to nori. The previous split put
        // near-black on the limbs AND the torso AND a band across the head, so the
        // silhouette test's "generic blob" was partly literal — most of the
        // character was one dark value. Nothing else in the cast is orange-limbed,
        // and it keeps this character firmly in the warm half of the wheel.
        limb: LIMB_SALMON_DEEP,  // joint balls take the UPPER-limb tone; nori is the cuff/shin
        hand: RICE,        // rice-ball fists, the head's own other material
        foot: NORI,        // lacquered near-black boots ground the warm limbs
        torso: NORI,       // carries the maki cut-face on the chest — see dressTorsoAsSushi
        limbRoughness: 0.42,
      },
      // A fresh independent art director scored the cast 4/10 and named the body plan
      // directly: every character took the rig's defaults, so the bodies read as
      // identical parts under different heads. Sushi is written as compact and stout
      // with thick short limbs and a low wide stance, so shoulders pull IN (compact)
      // while the stance and limb thickness both go up (stout, planted).
      // Body: STANDARD archetype — the neutral chibi baseline (see `bodies.ts`).
      // A nigiri is a compact block that still needs a waist under it, so the
      // middle body suits it; the tweaks below keep Sushi's own "arms held close
      // in, feet planted wide" read on top of the baseline.
      proportions: bodyType('standard', {
        // `headFraction` up from STANDARD's 0.46: the nigiri is now a WIDE, LOW
        // bed rather than a tall lathe (see the PROFILE rewrite), so it needs more
        // radius to reach the same top-of-head. Measured with
        // `shoot.mjs --char sushi`, which prints the real bounding height.
        headFraction: 0.65,
        // Two knobs nudged off STANDARD, and only because the head is flat. The rig
        // sizes the whole character assuming a head ~2R tall; this one is 1.2R, so
        // ~0.5m of nominal height simply does not exist and Sushi came out the
        // shortest in the cast by a visible margin. Raising the hip and shoulder
        // lines puts the same flat head back at ~2.1m top-of-head without inflating
        // it into a dinner plate. Verified with `shoot.mjs --char sushi`.
        // (`legFraction` used to be overridden to 0.29 for the same reason;
        // STANDARD is now 0.30 and the override is gone.)
        torsoFraction: 0.31,
        // `headMount` is the fix for the trap `rig.ts` documents: the rig places
        // the head centre `headRadius * headMount` above the torso top ASSUMING a
        // mass that extends ~±R about its origin. This mass extends ±0.67R, so at
        // the stock 0.86 the head floated a visible 0.14m clear of the body — which
        // is exactly what the first render of this rewrite showed. 0.62 seats the
        // rice bed's underside just inside the torso top.
        headMount: 0.50,
        // Out from 0.16H: the nigiri bed is now ~1.5x wider than the shoulders, and
        // the maki-roll torso (see `dressTorsoAsSushi`) needs radius that
        // `bodies.ts`'s "torso half-width must stay inside the shoulder pivot" rule
        // only allows if the pivot moves out with it.
        // 0.19H -> 0.225H. Both forearms measure 0.489 / 0.493 delivered — on the
        // wrong side of the 0.50 floor by a hair, with 0.21-0.23 of each covered by
        // the nigiri bed. The elbow tuck was already relaxed (see `stance` below);
        // this is the remaining 0.03-0.04m the measurement asks for.
        shoulderWidth: CHARACTER_HEIGHT * 0.225,
        // 0.15H -> 0.21H — "low, wide stance", now measured rather than asserted.
        stanceWidth: CHARACTER_HEIGHT * 0.19,
        armRadius: CHARACTER_HEIGHT * 0.068,     // thick
        // 0.088H -> 0.078H. At 0.088 the rice fist was **1.29x the arm's own radius**,
        // and read off the lobby render it is a ping-pong ball on a stick: the eye
        // reads a ball that much larger than the limb feeding it as a separate object,
        // which is the "limbs disattached" half of Uri's note showing up as a SIZE
        // problem rather than a gap. Still the largest hand ratio in this file's own
        // history, because the rice-ball fist is a real read and a small one is not.
        // (0.078 on the first cut, then back to 0.082: the fists are also two of the
        // three pale masses on the body, and 0.078 took pale AREA out at the same moment
        // the sash shrink did — see `beltRadius`, where the two together cost 0.07 of
        // figure/ground. 0.082 keeps most of the size fix and gives the area back.)
        handRadius: CHARACTER_HEIGHT * 0.082,
        // 0.078H -> 0.064H. Still the thickest leg on a STANDARD body (the
        // archetype is 0.056H) so the "thick, stout" read survives, but 0.078
        // made the shin 0.207 m long against a 0.147 m radius — a sphere, per
        // `bodies.ts`'s leg note — and `kneeL` measured 0.000 delivered at run.
        legRadius: CHARACTER_HEIGHT * 0.064,     // thick, stout
      }),
      // Poised and refined — arms held close in rather than out, a slight
      // aloof over-the-shoulder glance. Distinct from every other stance in
      // this file's own cast slice: the only near-symmetric, closed-arm pose.
      stance: {
        // Elbows -0.58 -> -0.40. Both forearms delivered 0.466 / 0.452 at idle and
        // 0.189 / 0.176 at run — under the floor in both states, tucked in behind
        // the nigiri. The shoulders are already correct (near-zero, so the arms
        // hang where the rig puts them); it was only the elbow tuck.
        // REVERTED to +-0.04 after measuring. Both signs are inward per §12, and on this
        // character that is load-bearing: opening them to -+0.12 detached 12,499 px of
        // limb at run. The nigiri bed is 1.5x wider than the shoulders, so the arms
        // hang past the body and only the inward tuck keeps them on it.
        shoulderL: 0.04, shoulderR: -0.04,
        elbowL: -0.40, elbowR: -0.40,
        twist: -0.07, headTilt: 0.11, headTurn: -0.22,
        hipSway: 0.02, lean: -0.02,
        // Measured at the shipped facing: 0.1475 base -> 0.1811 at splay alone ->
        // 0.2057 with the wider stance under it, which is the first time this
        // character clears the six-plate reference floor of 0.2007 on proportions
        // alone. Islands stayed at 1 throughout, which matters here: the arms are
        // held by an INWARD elbow tuck (see above) and opening them detaches
        // 12,499 px, so the legs were the only span left to spend.
        splay: 0.38,
      },
    });
    this.body.add(this.rig.joints.root);
    this.head = this.rig.joints.head;

    const R = this.rig.headRadius;
    const head = this.rig.joints.head;

    // ── Materials ────────────────────────────────────────────────────────────
    // ⚠️ `rim: true` ON EVERY `glossyMat` IN THIS FILE, and it is the ONLY change of
    // its kind here. `toonMat` applies the Fresnel rim by default; `glossyMat` gained
    // an OPT-IN `rim` in `aeee0b9` and **not one of its 69 call sites passed it**, so
    // the eighteen `MeshPhysicalMaterial`s in the cast — precisely the wet surfaces
    // that most want an edge — were the only materials in the game with no edge
    // response at all, and the flag was pixel-neutral.
    //
    // It was gated, not merged blind, because the four characters whose near-white
    // clipping was hardest won (lollipop 0.1610 -> 0.0175, sushi, soup, egg) are the
    // same four that are mostly glossy. The per-character `clipShare` run says:
    // lollipop / sushi / hamburger ON; **egg SKIP** (worth 0.33/255 over 1.67% of its
    // matte — it does nothing); **soup DO NOT** (it ships a `valuescan` failure,
    // clipping 0.0883 -> 0.0976 past the reference band max of 0.0929).
    // `docs/LESSONS.md` §7: a local optimum that pays for itself somewhere else.
    const riceMat = toonMat({ color: RICE, roughness: 0.76 });        // matte sticky rice — pushed further from the glossy nori/salmon for real contrast
    const noriMat = glossyMat({ color: NORI, roughness: 0.3, rim: true });       // glossy seaweed sheen
    const salmonMat = glossyMat({ color: SALMON, roughness: 0.2, rim: true });   // wet fish

    // ── THE RICE MOUND: a loaf, and the visible band has to CURVE ────────────
    // The old profile held r within 0.03 of full width across h 0.30-0.64 — a
    // straight wall — and the topping covered everything above 0.57. So the only rice
    // a player ever saw was a cylinder with a dark ring round its foot and an orange
    // disc on top, which is a BUCKET. That is what put this character next to Soup on
    // the confusable-pair sheet, and it is a property of the visible band, not of the
    // whole mass: the mound WAS round, above where anyone could see it.
    //
    // So the widest point moves down to h 0.28 and the curve falls continuously from
    // there. The band the drape leaves exposed (h 0.10-0.74 at the front) now runs
    // 0.85 -> 1.00 -> 0.83, a real barrel, and the crown is a proper dome because the
    // drape hugs it rather than replacing it.
    const PROFILE: Array<[h: number, r: number]> = [
      [0.00, 0.00], [0.04, 0.62], [0.10, 0.85], [0.18, 0.97], [0.28, 1.00],
      [0.42, 0.98], [0.56, 0.93], [0.70, 0.84], [0.82, 0.70], [0.92, 0.46], [1.00, 0.00],
    ];
    const SCALE_R = R * 0.50;
    const SCALE_H = R * 1.06;
    /** Horizontal ellipse: a nigiri is long across and shallow front-to-back. */
    // Widened and flattened after a blind critic flagged Sushi and Soup as the one
    // confusable pair on the silhouette sheet — "both a wide flat-topped dome on a
    // squat two-legged body". Soup's bowl is a truncated cone that OPENS upward with a
    // concave lip; the way to stop reading like it is to be a genuine slab.
    // ⚠️ 1.72 -> 1.62. The bed measured 1.5x wider than the shoulders, and the file's
    // own accessory block records the consequence: at 58 deg the bed projects straight
    // down over the whole torso, which is why the belt chopsticks scored ZERO
    // appendages and why the rig's new pelvis delivers **1 pixel** on this character
    // against a 2219-pixel footprint. The drape's drooping ends now carry the width
    // information the raw bed used to, so the bed itself can give some back.
    const SX = 1.62;
    const SZ = 0.88;

    /** Linear-interpolated radius FRACTION (0-1) at a given height fraction. */
    const radiusFracAt = (hFrac: number): number => {
      for (let i = 0; i < PROFILE.length - 1; i++) {
        const [h0, r0] = PROFILE[i];
        const [h1, r1] = PROFILE[i + 1];
        if (hFrac >= h0 && hFrac <= h1) {
          const t = h1 > h0 ? (hFrac - h0) / (h1 - h0) : 0;
          return r0 + (r1 - r0) * t;
        }
      }
      return PROFILE[PROFILE.length - 1][1];
    };
    /** Actual local Y (metres) for a height fraction — content spans ±SCALE_H/2. */
    const yAt = (hFrac: number): number => hFrac * SCALE_H - SCALE_H / 2;
    /** Actual local radius (metres) at a height fraction, BEFORE the SX/SZ ellipse. */
    const rAt = (hFrac: number): number => radiusFracAt(hFrac) * SCALE_R;
    const prof: Profile = { rAt, yAt };
    /**
     * Exact front-surface Z for a given local X at a height fraction.
     *
     * The masses live inside a group scaled (SX, 1, SZ), so a horizontal slice is an
     * ELLIPSE with semi-axes (rAt*SX, rAt*SZ), not the circle the old one-line
     * version assumed. Anything placed with the circle equation would have floated
     * a long way off the front of the widened head.
     */
    const zAt = (x: number, hFrac: number): number => {
      const a = rAt(hFrac) * SX;
      const b = rAt(hFrac) * SZ;
      if (a <= 1e-6) return 0;
      const t = 1 - (x * x) / (a * a);
      return t > 0 ? b * Math.sqrt(t) : 0;
    };
    /**
     * ⚠️ THE OUTWARD NORMAL OF THIS SURFACE, AND IT IS NOT `(x, 0, z)`.
     *
     * Every decal on this head — both eyes, every rice grain — was oriented with
     * `new Vector3(x, 0, z).normalize()`, which is the outward normal of a SPHERE.
     * This head is an ellipse of semi-axes (r·SX, r·SZ) with SX/SZ = 1.84, and the
     * true horizontal normal is proportional to `(x/a², z/b²)` — so the ratio z:x in
     * the normal is wrong by a factor of **(SX/SZ)² = 3.4**. The eyes were therefore
     * rotated far more OUTWARD than the surface they sit on actually faces: a fish's
     * eyes, on the sides of the head, which is precisely the "googly / one iris jammed
     * into the corner / lazy eye" note this file already carried and had tried to fix
     * twice at the level of the quaternion basis. The basis was right; the vector
     * handed to it was not.
     *
     * Derived rather than guessed, because the surface also varies with height:
     * P(θ,h) = (r·SX·cosθ, y(h), r·SZ·sinθ), N = ∂P/∂θ × ∂P/∂h, giving
     *   N = ( B·c·y′ ,  −(B·r′·SX·c² + A·r′·SZ·s²) ,  A·s·y′ )
     * with A = r·SX, B = r·SZ. At the widest point r′ = 0 and it collapses to the flat
     * horizontal ellipse normal, which is the check that it is the right expression.
     */
    const normalAt = (theta: number, hFrac: number): THREE.Vector3 => {
      const e = 0.005;
      const h0 = Math.max(0, hFrac - e), h1 = Math.min(1, hFrac + e);
      const dr = rAt(h1) - rAt(h0), dy = yAt(h1) - yAt(h0);
      const c = Math.cos(theta), s = Math.sin(theta);
      const A = rAt(hFrac) * SX, B = rAt(hFrac) * SZ;
      return new THREE.Vector3(
        B * c * dy,
        -(B * dr * SX * c * c + A * dr * SZ * s * s),
        A * s * dy,
      ).normalize();
    };

    // The food masses sit inside one scaled group so they can be authored in a plain
    // circular frame; the face and every decal stay on `head` and use `zAt` above.
    // Scaling a GROUP rather than each geometry also keeps the eyes, brows and lips
    // perfectly round instead of stretching them with the rice.
    const mass = new THREE.Group();
    mass.name = 'sushi_mass';
    mass.scale.set(SX, 1, SZ);
    head.add(mass);

    const rice = new THREE.Mesh(
      new THREE.LatheGeometry(PROFILE.map(([h, r]) => new THREE.Vector2(r * SCALE_R, yAt(h))), 32),
      riceMat,
    );
    rice.name = 'sushi_rice';
    rice.castShadow = true;
    rice.receiveShadow = true;
    mass.add(rice);

    // ── The fish: a DRAPED SHELL with a saddle hem ───────────────────────────
    // See `drapedSlice` and the file header.
    //
    // ── ROUND 2, off the render, and it changed a READ rather than a number ──
    // hem 0.26/0.74 -> 0.38/0.78, thickness 0.105 -> 0.155, endBulge 0.60 -> 0.85.
    // The saddle worked — the beret is gone — but the drape then hugged the mound over
    // roughly two thirds of the head's profile at 3 mm of standoff, and a thin smooth
    // shell that follows a skull's curve exactly IS A HELMET. Read off the lobby and
    // side plates as an orange bob wig. A fish slice is not a shell: it is a SLAB with
    // its own thickness that a cook laid on top, so it stands off, and it does not
    // reach as far down. Both numbers move together for that one reason.
    const HEM_MID = 0.58, HEM_AMP = 0.20;
    const DRAPE_T = SCALE_R * 0.155, DRAPE_BULGE = 0.85;
    /** The drape's hem height at an azimuth — the face zone's ceiling, shared so the
     *  two cannot drift apart. theta = 0 is +X (the ends), theta = pi/2 is +Z (front). */
    const hemAt = (theta: number) => HEM_MID - HEM_AMP * Math.cos(2 * theta);
    /** The drape's own outward offset at a point on it — the surface anything riding on
     *  the topping has to clear. Same expression `drapedSlice` uses internally, so a
     *  band placed against it is flush by construction rather than by a tuned constant. */
    const drapeT = (theta: number, h: number) => {
      const hem = hemAt(theta);
      const u = Math.min(1, Math.max(0, (h - hem) / Math.max(1e-6, 1 - hem)));
      return DRAPE_T * (1 + DRAPE_BULGE * Math.cos(theta) ** 2 * (1 - u));
    };
    /** The same offset for a band running front-to-back at a fixed |x|: the azimuth is
     *  recovered from the cross-section, `cos(theta) = x0 / r(h)`. */
    const drapeTAtX = (x0: number, h: number, eps: number) =>
      drapeT(Math.acos(Math.max(-1, Math.min(1, x0 / Math.max(1e-6, rAt(h))))), h) + eps;

    const salmon = new THREE.Mesh(
      drapedSlice(prof, { hemMid: HEM_MID, hemAmp: HEM_AMP, thick: DRAPE_T, endBulge: DRAPE_BULGE }),
      salmonMat,
    );
    salmon.name = 'sushi_salmon';
    salmon.castShadow = true;
    salmon.receiveShadow = true;
    mass.add(salmon);

    // ── Salmon fat: three PALE bands over the topping ────────────────────────
    // The old marking was three `SALMON_DARK` bars solved against the slab's surface.
    // They were the right idea with the wrong polarity — salmon is read by its pale
    // marbling — and the fish, the largest single colour area on the character,
    // presented exactly one value.
    //
    // ⚠️ Round 2: FLUSH, and this is what `thickAt` exists for. At a constant offset
    // they stood up to 3x their own thickness proud of a surface whose offset varies,
    // and the render showed two beige band-aids. Now they ride the drape at a fixed
    // small epsilon, and they are wider, shallower and no longer mirror-symmetric —
    // three lines at uneven spacing, because real marbling is not a pair of stripes.
    const fatMat = toonMat({ color: SALMON_FAT, roughness: 0.45 });
    for (const [fx, halfW] of [[-0.52, 0.058], [-0.04, 0.048], [0.42, 0.066]] as const) {
      // ⚠️ THE SIGNED x0 IS BUILT IN, NOT MIRRORED IN AFTERWARDS. The first version
      // built the +x band and applied `geometry.scale(-1, 1, 1)` to get the other, which
      // is a REFLECTION: it reverses triangle winding, so the left-hand band's normals
      // all pointed inward and it would have rendered near-black — `docs/LESSONS.md`
      // §12's inverted-lathe failure arriving through a different door. Caught offline
      // by `tools/tmp/ch_sushi_geom.mjs`'s signed-volume check (-1.298e-3), which is the
      // whole reason that probe exists; nothing in a render would have named the cause.
      const x0 = fx * SCALE_R;
      const g = crossStrap(prof, {
        x0, halfWidth: SCALE_R * halfW, hLo: 0.80,
        thickAt: (h) => drapeTAtX(x0, h, SCALE_R * 0.008),
      });
      if (!g) continue;
      const band = new THREE.Mesh(g, fatMat);
      band.name = 'sushi_salmon_fat';
      band.userData.noOutline = true;
      band.castShadow = true;
      mass.add(band);
    }

    // ── Nori strap ──────────────────────────────────────────────────────────
    // The nori MOVED, and the old placement was doing active harm. It used to be a
    // lathe band at h 0.04-0.20 — the very bottom of the head — where it produced a
    // hard dark ring round the foot of a straight wall, i.e. the rim of a pot, and it
    // sat directly under the mouth alongside a gold clasp that read as a chin bead.
    // It is also invisible from the match camera: at 58 deg you see the crown of this
    // head and almost nothing of its underside, so the character's single strongest
    // high-contrast graphic was spent on the one surface the game does not show.
    //
    // A strap ACROSS the topping is the real fixture on a piece of nigiri, it is the
    // same near-black-on-warm read, and it is on the crown — visible at 58 deg and at
    // the lobby's 20 deg both. `hLo` is set from `hemAt(pi/2)`, the drape's own front
    // hem, so the strap can never walk off the fish and onto the face.
    // Round 2: wider and flush (0.155 halfWidth at a constant 0.115 offset read as a
    // black BOX bolted to the crown; a strap is a wrap, so it follows the surface).
    const strapGeo = crossStrap(prof, {
      // ── WIDE AND ALMOST FLUSH, and the camera is the reason ──────────────────
      // 0.155 -> 0.185 -> 0.26 -> 0.34 half-width, standoff 0.012 -> 0.005. At every
      // narrower size the lobby plate showed a black BOX bolted to the crown — a
      // battery, a hair clip — and the mechanism is projection, not proportion: this
      // band runs FRONT-TO-BACK, and the lobby camera is at 20 deg, so the crown is
      // foreshortened to almost nothing and a band of any reasonable length projects to
      // a short wide rectangle. The only variables left are width and standoff, so it
      // becomes a broad flat stripe on the fish rather than a small proud block.
      // ⚠️ Recorded because the next person to look at this will reach for LENGTH, and
      // length is the one dimension the camera has already taken away.
      x0: 0, halfWidth: SCALE_R * 0.34, hLo: hemAt(Math.PI / 2) + 0.02,
      thickAt: (h) => drapeTAtX(0, h, SCALE_R * 0.005),
    });
    if (strapGeo) {
      // ── A SECOND MECHANISM I NAMED AND THE PIXELS REFUSED ────────────────────
      // In the lobby head crop this strap reads as a SLAB — a dark rectangle with a
      // broad soft specular, i.e. a screen or a visor. Three rounds of geometry (wider,
      // flatter, flush) moved it from "a battery" to "a slab" and no further, so the
      // next hypothesis was the MATERIAL: near-black at roughness 0.3 is glass, and real
      // nori is matte. Tried `toonMat({ color: '#14211A', roughness: 0.66 })`:
      //
      //   glossy (kept)   figure/ground dL 0.1231   range 0.842   p50 0.47
      //   matte           figure/ground dL 0.0912   range 0.821   p50 0.43
      //
      // and the two head crops are, side by side, INDISTINGUISHABLE. The gloss was not
      // the cause either. It cost 0.032 of figure/ground — enough to take `pot_south`
      // from over the 0.10 standard to under it, on a gate that allows exactly one
      // failing station — for no visible gain, so it is reverted.
      //
      // What is left is the shape, and specifically the CAMERA: this band arches over a
      // crown that is steep at the front, so at the lobby's 20 deg it presents a large
      // near-planar face. At the match's 58 deg the same geometry reads correctly as a
      // nori strap across the fish, which is why it is kept. ⚠️ That is a genuine split
      // between the two shipped cameras rather than a defect with a known fix, and it is
      // flagged for Uri rather than iterated on further.
      const strap = new THREE.Mesh(strapGeo, noriMat);
      strap.name = 'sushi_nori_strap';
      strap.castShadow = true;
      strap.receiveShadow = true;
      mass.add(strap);
    }

    // The gold pin that used to sit here is GONE. It moved off the head's base (where
    // it read as a chin bead under the mouth) onto the strap, and on the strap it read
    // as a SCREW — a small bright metal circle centred on a dark rectangle is a fixing,
    // which is the one thing a piece of nigiri must not look like. The Legendary gold
    // accent is still carried by the torso clasp and the boot straps, which are on
    // costume rather than on food.

    // ── Rice grains ──────────────────────────────────────────────────────────
    // Small pressed grains seated on the rice's surface, on the sides and back so they
    // never compete with the face. Two fixes: they are oriented by `normalAt` (they
    // used to use the sphere normal and stuck out at up to 30 degrees off the surface,
    // which is what made them read as blisters rather than as pressed rice), and they
    // are flattened along their own normal so they sit IN the mound.
    const grainMat = toonMat({ color: RICE_SHADE, roughness: 0.7 });
    const grainSpots: Array<[thetaFrac: number, h: number]> = [
      [0.62, 0.30], [0.78, 0.34], [1.22, 0.30], [1.38, 0.36],
      [0.70, 0.48], [1.30, 0.46], [0.94, 0.40], [1.06, 0.44],
    ];
    for (const [tf, gh] of grainSpots) {
      if (gh > hemAt(tf * Math.PI) - 0.06) continue;   // never under the drape
      const theta = tf * Math.PI;
      const grain = new THREE.Mesh(new THREE.CapsuleGeometry(R * 0.024, R * 0.046, 3, 6), grainMat);
      const n = normalAt(theta, gh);
      grain.position.set(
        rAt(gh) * SX * Math.cos(theta), yAt(gh), rAt(gh) * SZ * Math.sin(theta),
      ).addScaledVector(n, R * 0.004);
      grain.quaternion.setFromUnitVectors(new THREE.Vector3(0, 1, 0), n);
      grain.rotateX(Math.PI / 2);
      grain.scale.set(1, 1, 0.55);
      grain.castShadow = true;
      head.add(grain);
      this.riceGrains.push(grain);
    }

    this.buildFace(R, { yAt, zAt, normalAt, hemAt, SX, SZ });
    this.dressTorsoAsSushi();
    this.dressLimbs();
    this.buildAccessories(R, { yAt, zAt, hemAt });
    this.buildSilhouetteEvents(R);

    outlineGroup(this.root);
    this.collectFlashTargets();
    this.rig.restPose();
  }

  /**
   * ── THE FACE, rebuilt to the `rules.ts` spec of 2026-08-06 ──────────────────
   *
   * `docs/DECISIONS-FOR-URI.md` §42: Uri ranked seven faces without seeing any code and
   * his ranking reproduces the one-line `face:` field exactly — every character he rated
   * poorly was specified with CLOSED eyes; the one he rated best was specified with open
   * eyes and highlights. Sushi's old line said *"wide eyes"*, so the instinct here was
   * already right and this is an extension of it, not a reversal. Four things change.
   *
   *  1. THE EYES WERE AIMED WITH A SPHERE'S NORMAL AT AN ELLIPSE. See `normalAt` in
   *     the constructor. `(x, 0, z).normalize()` gets the z:x ratio wrong by (SX/SZ)**2
   *     = 3.4 on this head, which rotated both eyes far more OUTWARD than the surface
   *     they sit on actually faces — eyes on the SIDES of the head. That is the
   *     recorded "googly / lazy eye" defect, and it had already survived two fixes
   *     aimed at the quaternion basis. The basis was correct. Its input was not.
   *  2. A DARK LID LINE, which on this character is the load-bearing element and not a
   *     detail. The spec says so and the measurement agrees: rice is near-white, so a
   *     white sclera on it is invisible — `face|head` measured `dLcontact` **0.0395**,
   *     a tenth of the 0.10 standard, because the outermost pixel of the eye and the
   *     rice it is drawn against were the same value. The separation has to come from
   *     the PUPIL and the LASH, exactly as `rules.ts` now says.
   *  3. THE SCLERA IS INSET, not stuck on. The old one was a sphere at 0.5 depth scale
   *     pushed 0.02R proud of the surface, and from profile it stood out as a ball on
   *     a stalk. It is flatter and seated now, with the lash ring reading as the socket.
   *  4. THE MOUTH HAS AN INTERIOR. The old dark disc sat 0.004R IN FRONT of the lip
   *     ring — a dark dot painted on top of a pink bead, which is precisely the
   *     "painted curve rather than an opening" §42 names. The throat is now BEHIND the
   *     ring's plane and recessed into the head, so the value step is a real one.
   *
   * ── Mounted on `rig.joints.face`, re-anchored at the head origin ─────────────
   * `face` carries the rig's generic forward offset tuned for a plain sphere; this
   * model's surface is authored in exact head-local coords instead, so the offset is
   * zeroed and the features are parented to `face` ANYWAY. With the offset cleared
   * `face` is a direct child of `head` with an identity transform, so this is a pure
   * reparent and not one vertex moves (proved by `tools/tmp/facemove.mjs`, which hashes
   * every mesh's world matrix). It is not cosmetic: `thumbs.ts`'s character-select
   * framing rule reads this joint and falls back to a guess when it is empty, and
   * `tools/tmp/chars_metrics.mjs` cannot assert a face it cannot find.
   */
  private buildFace(R: number, s: {
    yAt: (h: number) => number;
    zAt: (x: number, h: number) => number;
    normalAt: (theta: number, h: number) => THREE.Vector3;
    hemAt: (theta: number) => number;
    SX: number; SZ: number;
  }): void {
    const face = this.rig.joints.face;
    face.position.set(0, 0, 0);
    const ink = PALETTE.ink;

    // The face zone, derived from the drape rather than asserted. The eyes used to sit
    // at h 0.44 with a brow 0.165R above them, against a topping whose lower edge was
    // at h 0.57 — 0.02 of clearance, which is what a hardcoded pair of numbers gets you
    // when the mass above them is edited by someone else. The hem is a function now.
    const EYE_H = 0.42;
    const EYE_X = R * 0.345;
    const eyeY = s.yAt(EYE_H);
    const lashMat = toonMat({ color: ink, roughness: 0.4 });
    const browMat = toonMat({ color: SALMON_DARK, roughness: 0.35 }); // ties the brow to the fish accent

    for (const sx of [-1, 1] as const) {
      const ex = sx * EYE_X;
      const ez = s.zAt(ex, EYE_H);
      // The azimuth of this point on the head's own ellipse, which is what `normalAt`
      // is parameterised by. `atan2(ez, ex)` on the SCALED coordinates would reintroduce
      // the sphere answer, so the ellipse's semi-axes are divided out first.
      const theta = Math.atan2(ez / s.SZ, ex / s.SX);
      const outward = s.normalAt(theta, EYE_H);
      const eye = new THREE.Group();
      eye.position.set(ex, eyeY, ez);
      // AN EXPLICIT SHARED FRAME, NOT `setFromUnitVectors` PER EYE. `rules.ts` calls
      // this out by name for this character: the shortest-arc quaternion leaves a
      // DIFFERENT residual roll on each side, so every offset inside the eye group
      // (pupil, glint, brow) is rotated by a different amount per eye and the pair
      // reads as a lazy eye (`docs/LESSONS.md` §12). Pinning local up to world up makes
      // the two sides exact mirrors by construction.
      {
        const fwd = outward.clone();
        const worldUp = new THREE.Vector3(0, 1, 0);
        const right = new THREE.Vector3().crossVectors(worldUp, fwd).normalize();
        const up = new THREE.Vector3().crossVectors(fwd, right).normalize();
        eye.quaternion.setFromRotationMatrix(new THREE.Matrix4().makeBasis(right, up, fwd));
      }
      face.add(eye);

      // Sclera. Still the brightest albedo on the character (#FFFFFF against the rice's
      // #DCD3BD), but on THIS character that is not what makes it read — see point 2.
      // Seated, not stuck on: depth scale 0.50 -> 0.42, and the group sits ON the
      // surface rather than 0.02R proud of it.
      const white = new THREE.Mesh(
        new THREE.SphereGeometry(R * 0.142, 20, 16),
        toonMat({ color: '#FFFFFF', roughness: 0.22 }),
      );
      white.position.set(0, 0, R * 0.006);
      white.scale.set(1, 1.06, 0.42);
      white.castShadow = true;
      eye.add(white);

      // The lid line: a near-black ring around the sclera, OPEN AT THE BOTTOM so the
      // eye reads as an open eye with a lash above it rather than as a monocle. The arc
      // runs from just below +X, over the top, to just below -X: 1.30pi from -0.15pi.
      const lash = new THREE.Mesh(
        new THREE.TorusGeometry(R * 0.146, R * 0.026, 8, 26, Math.PI * 1.30),
        lashMat,
      );
      lash.name = 'sushi_lash';
      lash.rotation.z = -Math.PI * 0.15;
      lash.position.set(0, 0, R * 0.030);
      lash.scale.set(1, 1.06, 0.55);
      lash.castShadow = true;
      eye.add(lash);

      // Upper lid: a dark crescent overlapping the top of the sclera, so the eye is not
      // a full circle. That overlap is most of the difference between an eye and a ball.
      // Round 2: lifted 0.098 -> 0.112 and thinned 0.62 -> 0.50. At the first sizing the
      // lid and the pupil merged into one black mass in the head crop and the sclera
      // read as two crescents rather than as an eye — which is the opposite of the
      // "the sclera is the brightest value on the face" target it exists to serve.
      const lid = new THREE.Mesh(new THREE.SphereGeometry(R * 0.132, 16, 12), lashMat);
      lid.position.set(0, R * 0.112, R * 0.040);
      lid.scale.set(1.02, 0.50, 0.30);
      lid.castShadow = true;
      eye.add(lid);

      // Pupil, offset for GAZE — the same local direction on BOTH sides (not mirrored),
      // so the two eyes look at one thing. Mirroring it is what makes a pair read as
      // cross-eyed, and it is the easy mistake because everything else here mirrors.
      const pupil = new THREE.Mesh(
        new THREE.SphereGeometry(R * 0.068, 16, 14),
        toonMat({ color: ink, roughness: 0.25 }),
      );
      pupil.position.set(R * 0.016, R * 0.012, R * 0.058);
      pupil.scale.set(1, 1, 0.55);
      pupil.castShadow = true;
      eye.add(pupil);

      // Catchlights: a main one on the pupil's upper-outer edge and a small secondary
      // one opposite it. Two is what a reference eye carries, and the second is what
      // stops the first reading as a printed dot.
      const glint = new THREE.Mesh(new THREE.SphereGeometry(R * 0.028, 10, 8), flatMat('#ffffff'));
      glint.position.set(-R * 0.014, R * 0.048, R * 0.088);
      glint.userData.noOutline = true;
      eye.add(glint);
      const glint2 = new THREE.Mesh(new THREE.SphereGeometry(R * 0.013, 8, 6), flatMat('#ffffff'));
      glint2.position.set(R * 0.048, -R * 0.032, R * 0.082);
      glint2.userData.noOutline = true;
      eye.add(glint2);

      // Brow, held clear of the drape's hem at this azimuth by construction rather than
      // by a hardcoded height — `hemAt` is the same function the topping is built from.
      const room = Math.max(0, s.hemAt(theta) - 0.055 - EYE_H) * R * 1.06;
      const brow = new THREE.Mesh(new THREE.CapsuleGeometry(R * 0.018, R * 0.135, 4, 8), browMat);
      brow.name = 'sushi_brow';
      brow.rotation.z = Math.PI / 2 + sx * 0.10;
      brow.position.set(0, Math.min(R * 0.190, room), R * 0.030);
      brow.castShadow = true;
      eye.add(brow);
    }

    // Puckered "o" lips, with a real interior. The pucker is the personality and
    // `rules.ts` keeps it; what it lacked was an opening. A plump ring of coral, and
    // BEHIND it — recessed into the head, not stacked in front of it — a dark throat
    // that fills the hole.
    const MOUTH_H = 0.245;
    const mouthY = s.yAt(MOUTH_H);
    const mouthZ = s.zAt(0, MOUTH_H);
    const lips = new THREE.Mesh(
      new THREE.TorusGeometry(R * 0.052, R * 0.027, 12, 22),
      toonMat({ color: LIP, roughness: 0.36 }),
    );
    lips.name = 'sushi_lips';
    lips.position.set(0, mouthY, mouthZ + R * 0.008);
    lips.castShadow = true;
    face.add(lips);

    const throat = new THREE.Mesh(
      new THREE.SphereGeometry(R * 0.040, 12, 10),
      toonMat({ color: '#3A1018', roughness: 0.6 }),
    );
    throat.name = 'sushi_throat';
    throat.position.set(0, mouthY, mouthZ - R * 0.020);
    throat.scale.set(1, 0.92, 0.7);
    face.add(throat);

    // One specular bead on the lower lip — the same trick as the eye catchlight, and
    // the reason the mouth reads as wet rather than as a printed shape.
    const lipGlint = new THREE.Mesh(new THREE.SphereGeometry(R * 0.011, 8, 6), flatMat('#ffffff'));
    lipGlint.position.set(-R * 0.020, mouthY - R * 0.040, mouthZ + R * 0.030);
    lipGlint.userData.noOutline = true;
    face.add(lipGlint);
  }


  /**
   * Carries the sushi motif down onto the body — and gives the dark torso the one
   * thing it was missing.
   *
   * The rig's torso is nori-charcoal, which on its own is a large low-chroma mass
   * on a cast that owns the warm half of the wheel. A MAKI ROLL solves both
   * problems at once: it is the other universally-recognised sushi form, so the
   * character reads as "made of sushi" from head to hips rather than "a nigiri
   * wearing a wetsuit", and its cut face is a bullseye of white rice around a hot
   * salmon centre inside a dark nori ring — a big, high-contrast, warm graphic
   * sitting at chest height, which is where the eye goes.
   *
   * It is a torso DRESSING, not a body: the archetype still owns every joint,
   * limb length and stance. The roll's radius is capped at
   * `shoulderWidth - armRadius * 1.15` for the reason `bodies.ts` spells out — a
   * torso whose half-width reaches the shoulder pivot swallows the arms and the
   * character reads as a pile of overlapping dough balls.
   */
  private dressTorsoAsSushi(): void {
    // Read off the rig, never hand-mirrored: body proportions come from an
    // archetype (`bodies.ts`) now, so a hardcoded copy of a rig constant goes
    // silently wrong the moment the archetype changes.
    const m = this.rig.metrics;
    if (!m.hasTorso) return;
    const torsoH = m.torsoHeight;
    const taperMid = 0.86 + 0.30 * Math.sin(0.5 * Math.PI * 0.85); // rig.ts's taper at t=0.5
    const torsoHalfWidthMid = m.torsoWidth * 0.5 * taperMid;
    // ⚠️ 1.18 -> 1.03, AND THIS ONE BURIED THE RIG'S NEW PELVIS.
    // `fc4d9ad` added a pelvis on `hips` to answer Uri's "the legs are disconnected
    // from the body" on three sheets running, and its own table records what this
    // character got out of it: **footprint 2219 px, DELIVERED 1** — the worst ratio in
    // the cast by two orders of magnitude, and the only one where the joint was present
    // and still invisible. The sash is why. At 1.18x the tapered waist it stood proud of
    // every part of the body, spanned `torsoH * 0.08 .. 0.24` — i.e. sat exactly over
    // the hip line — and carried two solid `CircleGeometry` caps, so it was a filled
    // white DISC around the character's waist. From profile it read as a tutu; from
    // above it read as the pelvis's ceiling.
    //
    // Hugging (1.07), raised clear of the hip line, and the caps replaced by thin edge
    // tori so it is a rolled sash rather than a plate.
    //
    // ⚠️ AND IT CAME BACK UP FROM 1.03 x 0.11h, BECAUSE THE FIRST CUT OVERSHOT INTO A
    // FAILURE THIS FILE HAS ALREADY RECORDED. Measured at the shipped facing, where the
    // cut face is edge-on and the sash is the only pale thing on the body: **torso p50
    // 0.4507 -> 0.1446** and torso pixels 3082 -> 1965. The `NORI` block at the top of
    // this file says what that costs in words — "at near-black the torso sat about six
    // value stops below the cream head and a blind critic read the character as a
    // FLOATING HEAD WITH A HOLE UNDER IT" — and the number agrees: figure/ground dL at
    // `pot_south` fell 0.0985 -> 0.0309 in the same step. Wider and much taller (an obi
    // rather than a ribbon) restores the pale mass at profile; still 10% narrower than
    // the 1.18 that buried the pelvis, and lifted from spanning 0.08-0.24 of the torso
    // to 0.205-0.395, which is what keeps the hip line clear.
    const beltRadius = torsoHalfWidthMid * 1.07;

    const riceMat = toonMat({ color: RICE, roughness: 0.72 });
    const noriMat = glossyMat({ color: NORI, roughness: 0.3, rim: true });
    const salmonMat = glossyMat({ color: SALMON, roughness: 0.2, rim: true });
    const goldMat = toonMat({ color: GOLD, roughness: 0.3, metalness: 0.35 });

    // ── Maki roll, lying on its side with the cut face forward ────────────────
    // It has to REPLACE the rig's default torso, not sit inside it. A first pass
    // added the roll alongside the stock tapered barrel (half-width 0.22m) at a
    // radius of 0.17m and the whole thing rendered perfectly, entirely inside the
    // barrel, invisible — the project's most-repeated failure, now instance
    // fifteen. `rig.dressTorso` removes the default mesh, which is the only reason
    // this is visible at all.
    const rollR = Math.min(torsoH * 0.46, m.shoulderWidth - m.armRadius * 1.15);
    const rollD = rollR * 1.34;                 // front-to-back length of the roll
    // A perfectly round roll of this radius is shorter than the torso it stands in
    // for, so the group is stretched along its own local Z — which the quaternion
    // below maps to WORLD Y — until the roll fills the torso's height. The cut face
    // becomes a slight upright oval, which still reads as maki.
    const rollStretch = Math.min(1.35, (torsoH * 0.92) / (2 * rollR));

    const roll = new THREE.Group();
    roll.name = 'sushi_maki_roll';
    roll.position.set(0, torsoH * 0.5, 0);
    // Axis along Z so the cut face points at the camera. Set as an explicit
    // quaternion rather than composed Euler angles — composing rotation.x then
    // rotation.y on a disc is what has tipped planes edge-on elsewhere in this
    // project and made them vanish from a top-down camera.
    // ⚠️ AND IT IS YAWED 0.22 rad OFF DEAD-ON, which is not decoration. Square to the
    // camera, a pale disc with two dots centred inside a dark ring on a dark barrel
    // reads as a WASHING-MACHINE DOOR — a perfectly circular bullseye is the strongest
    // porthole cue there is, and this file has already had to answer "a single orange
    // disc in a white ring is a fried egg" once. Off-axis the disc projects as an
    // ellipse, which restores the cylinder read the roll is supposed to have.
    // Composed as two quaternions rather than Euler angles: `docs/LESSONS.md` §12,
    // rotation.x then rotation.y on a disc tips it edge-on and it vanishes.
    roll.quaternion
      .setFromAxisAngle(new THREE.Vector3(0, 1, 0), 0.32)
      .multiply(new THREE.Quaternion().setFromAxisAngle(new THREE.Vector3(1, 0, 0), Math.PI / 2));
    // The stretch runs along the group's local Z, which the pitch above maps to world
    // -Y; the yaw is about world Y and therefore leaves that mapping untouched, so the
    // roll still fills the torso's height exactly.
    roll.scale.set(1, 1, rollStretch);

    this.rig.dressTorso(() => roll);

    // ── I NAMED A MECHANISM AND THE MEASUREMENT REFUSED IT. KEPT, BECAUSE THE
    //    NUMBER IS WORTH MORE THAN THE ATTEMPT ─────────────────────────────────
    // `torso|shoulderL` is this character's largest adjacency and its last weak one:
    // `dLcontact` 0.0384 on HEAD, 0.0192 after the upper-limb albedo lift (which raised
    // the shoulder's contact band 0.3669 -> 0.4877 and carried it straight THROUGH the
    // torso's rather than away from it). The torso's own contact band reads 0.4685 on a
    // NEAR-BLACK albedo (#0E1712), so the obvious conclusion is that essentially all of
    // it is the Fresnel rim firing on the barrel's grazing silhouette — which is exactly
    // where this seam is measured. `dressLimbs` had already priced dropping the rim from
    // `upperLimbMat` (restores this pair to 0.1186, kills two others), but dropping it
    // from the TORSO WALL — the only surface on the other side of this seam, so nothing
    // else can pay — had never been tried.
    //
    // MEASURED, paired, same frozen tree, `--overlay` on this file alone:
    //
    //   rim ON   torso|shoulderL 0.0192   cA 0.4685  cB 0.4877   weighted-weak 15.8%
    //   rim OFF  torso|shoulderL 0.0329   cA 0.4539  cB 0.4868   weighted-weak 15.8%
    //
    // The rim is worth **0.0146 of the torso's contact band**, not the ~0.06 the
    // reasoning above predicts — 3.7x the 8-bit floor, so it is real, and nowhere near
    // enough to matter. Whatever is holding that band at 0.45 is not the rim. REVERTED:
    // a 0.0137 gain on one pair does not buy a deviation from a file-wide material
    // policy that was itself gated on `clipShare`, and the weighted-weak share does not
    // move at all. `docs/LESSONS.md` §7 — take the symptom, re-derive the cause — with
    // the correction landing on my own hypothesis this time.
    const wall = new THREE.Mesh(new THREE.CylinderGeometry(rollR, rollR, rollD, 30, 1, true), noriMat);
    wall.name = 'sushi_maki_wall';
    wall.castShadow = true;
    wall.receiveShadow = true;
    roll.add(wall);

    // Cut face: rice disc, salmon core, nori rim. Built as real discs stepped
    // forward in Z rather than one textured plane — a flat card would go edge-on
    // and vanish under this game's pitched-down camera.
    const faceY = rollD * 0.5;
    // 0.94 -> 0.86 of the roll's radius: the nori rim below gets correspondingly bolder,
    // which is the half of the graphic that says "a slice of something" rather than
    // "a hole in something".
    const riceFace = new THREE.Mesh(new THREE.CircleGeometry(rollR * 0.91, 30), riceMat);
    riceFace.name = 'sushi_maki_rice_face';
    riceFace.rotation.x = -Math.PI / 2;
    riceFace.position.y = faceY + 0.001;
    riceFace.castShadow = true;
    roll.add(riceFace);

    // Two fillings, not one. A single orange disc centred in a white ring on a dark
    // ground is a fried egg — a blind critic named exactly that — and the difference
    // between a fried egg and a maki cut face is that maki has SEVERAL fillings
    // packed off-centre inside the rice.
    // Round 2: 0.30 -> 0.40 of the roll's radius, and the others up with it. Three SMALL
    // dots on a large pale field is a control panel; a maki cut face is mostly FILLING
    // with rice packed round it, and the difference between those two pictures is the
    // fraction of the disc the fillings occupy, not their number.
    const core = new THREE.Mesh(new THREE.CylinderGeometry(rollR * 0.40, rollR * 0.40, rollR * 0.10, 22), salmonMat);
    core.name = 'sushi_maki_core';
    core.position.set(rollR * 0.20, faceY + rollR * 0.04, -rollR * 0.10);
    core.castShadow = true;
    roll.add(core);

    const core2 = new THREE.Mesh(
      new THREE.CylinderGeometry(rollR * 0.28, rollR * 0.28, rollR * 0.10, 18),
      toonMat({ color: '#7FBF4A', roughness: 0.45 })   // cucumber
    );
    core2.name = 'sushi_maki_core2';
    core2.position.set(-rollR * 0.32, faceY + rollR * 0.04, rollR * 0.20);
    core2.castShadow = true;
    roll.add(core2);

    // A third, smaller one — tamago. Two fillings still sit as a PAIR, which is a face
    // (and, on a circle, two eyes); three break the symmetry that was reading as one.
    const core3 = new THREE.Mesh(
      new THREE.CylinderGeometry(rollR * 0.22, rollR * 0.22, rollR * 0.10, 16),
      toonMat({ color: '#F2C24B', roughness: 0.42 }),
    );
    core3.name = 'sushi_maki_core3';
    core3.position.set(rollR * 0.06, faceY + rollR * 0.04, rollR * 0.42);
    core3.castShadow = true;
    roll.add(core3);

    // Thicker nori rim — on a real cut roll the seaweed is a bold ring, and a bold
    // ring is also what tells the eye this is a slice of something.
    // ⚠️ Round 2: tube 0.125 -> 0.070 of the roll's radius. A BOLD ring is right for a
    // cut roll; a ring this thick, perfectly circular and near-black on a dark barrel
    // with a pale disc inside it, is a WASHING-MACHINE DOOR, which is what the lobby
    // plate showed. The yaw above and this are the same fix from two directions.
    const rim = new THREE.Mesh(new THREE.TorusGeometry(rollR * 0.93, rollR * 0.070, 8, 30), toonMat({ color: NORI_DEEP, roughness: 0.4 }));
    rim.name = 'sushi_maki_rim';
    rim.rotation.x = Math.PI / 2;
    rim.position.y = faceY;
    rim.castShadow = true;
    roll.add(rim);

    // Back cap, so the roll is closed from behind.
    const backCap = new THREE.Mesh(new THREE.CircleGeometry(rollR, 30), noriMat);
    backCap.name = 'sushi_maki_back__no_outline';
    backCap.userData.noOutline = true;
    backCap.rotation.x = Math.PI / 2;
    backCap.position.y = -faceY;
    roll.add(backCap);

    // ── Rice sash across the roll's lower edge ────────────────────────────────
    // See `beltRadius` above for why this moved. Height 0.16 -> 0.11 of the torso and
    // the low edge from 0.08 to 0.20, so the sash clears the hip line entirely.
    const beltH = torsoH * 0.19;
    const beltLowY = torsoH * 0.30;
    const belt = new THREE.Mesh(new THREE.CylinderGeometry(beltRadius, beltRadius, beltH, 24, 1, true), riceMat);
    belt.name = 'sushi_torso_belt';
    belt.position.y = beltLowY;
    belt.castShadow = true;
    belt.receiveShadow = true;
    this.rig.joints.torso.add(belt);
    // Edge tori, not `CircleGeometry` caps. The caps made this a solid disc seen from
    // any angle above the horizon, which is every angle this game ships.
    for (const dy of [-beltH * 0.5, beltH * 0.5]) {
      const edge = new THREE.Mesh(
        new THREE.TorusGeometry(beltRadius, beltH * 0.16, 8, 24), riceMat,
      );
      edge.name = 'sushi_torso_belt_edge';
      edge.rotation.x = Math.PI / 2;
      edge.position.y = beltLowY + dy;
      edge.castShadow = true;
      this.rig.joints.torso.add(edge);
    }

    const clasp = new THREE.Mesh(
      // Narrow: at 0.30 x 1.05 it was a wide orange plate across the belly, which on a
      // pale sash reads as a buckle on a weightlifting belt rather than as a small
      // Legendary accent. The gold is meant to be quiet — see the file's own convention.
      new THREE.BoxGeometry(beltRadius * 0.17, beltH * 0.62, beltRadius * 0.13),
      goldMat
    );
    clasp.name = 'sushi_torso_clasp';
    clasp.position.set(0, beltLowY, beltRadius + torsoH * 0.015);
    clasp.castShadow = true;
    this.rig.joints.torso.add(clasp);
  }

  /**
   * Costume layer: a tied hachimaki, and it moved to where a headband on this shape
   * can actually be one.
   *
   * ── THE RING IS GONE, and the ring was the problem ──────────────────────────
   * It was a full cylinder at h 0.13 — the foot of the head — riding directly on top
   * of the old nori base band. Two dark rings stacked at the bottom of a cream mass,
   * read off the render: a CHIN STRAP, with the gold clasp under the mouth completing
   * it as a beard. Neither ring survives. The nori's job moved onto the topping (see
   * the strap in the constructor, which is both the real fixture on a piece of nigiri
   * and the only one of the two placements visible from the 58 deg match camera), and
   * the hachimaki keeps the part of itself that was always doing the work: the KNOT
   * and the two trailing tails at the back.
   *
   * The tails are the character's only rear silhouette break, and they are safe under
   * `docs/DECISIONS-FOR-URI.md` §40 pattern 1 (five for five: any pointed mass either
   * side of a head reads as an ear or a horn) because they are behind the head, not
   * beside it, and they DROOP rather than point.
   */
  private buildAccessories(R: number, s: {
    yAt: (h: number) => number;
    zAt: (x: number, h: number) => number;
    hemAt: (theta: number) => number;
  }): void {
    const head = this.rig.joints.head;
    const bandMat = toonMat({ color: HEADBAND, roughness: 0.55 });
    const knotMat = toonMat({ color: HEADBAND_DARK, roughness: 0.55 });

    // The knot ties the nori strap off at the back, so it is placed against the strap's
    // own rear hem rather than at a hardcoded height — one function, one truth.
    const knotH = s.hemAt(-Math.PI / 2) - 0.03;
    const knotY = s.yAt(knotH);
    const backZ = -s.zAt(0, knotH) * 1.02;

    const knot = new THREE.Mesh(new THREE.SphereGeometry(R * 0.105, 14, 12), knotMat);
    knot.name = 'sushi_headband_knot';
    knot.position.set(0, knotY, backZ);
    knot.scale.set(1.15, 0.82, 0.78);
    knot.castShadow = true;
    head.add(knot);

    for (const sx of [-1, 1] as const) {
      // Asymmetric on purpose: `docs/LESSONS.md` on facial acting, and the same
      // argument applies to a pair of ribbons — two identical tails at identical
      // angles is the "matched, no personality" pattern. The far tail is longer and
      // swings wider.
      const len = sx > 0 ? R * 0.46 : R * 0.36;
      const tail = new THREE.Mesh(roundedBox(R * 0.115, len, R * 0.028, R * 0.02, 2), bandMat);
      tail.name = 'sushi_headband_tail';
      tail.position.set(sx * R * 0.11, knotY - len * 0.58, backZ - R * 0.045);
      tail.rotation.set(0.28, 0, sx * (sx > 0 ? 0.30 : 0.18));
      tail.castShadow = true;
      tail.receiveShadow = true;
      head.add(tail);
    }
  }

  /**
   * SILHOUETTE EVENTS — the chopstick pair, stood up in the rice.
   *
   * Sushi measured **hull deficiency 0.1420 with ZERO appendages** at the shipped
   * facing. The nigiri is a smooth wide dome on a smooth barrel: two convex shapes
   * stacked, which is the definition of a mask with nothing in it.
   *
   * A chopstick is the ideal appendage for this metric and it is not a coincidence:
   * the metric counts what survives an opening at 0.045 of the subject's height, so
   * it is looking for things that are LONG and THIN, and a chopstick is nothing else.
   *
   * ── 🚨 THE TAIL FIN IS REMOVED. §40 PATTERN 1, AND IT WAS THE SIXTH ─────────
   * `docs/DECISIONS-FOR-URI.md` §40/§41: **a pointed mass either side of a head reads
   * as an ear or a horn whatever it is made of** — burrito's torn foil ("looks like a
   * goat"), egg's shell shards ("the ears don't make sense"), hamburger's lettuce,
   * pizza's cheese strands, lollipop's cellophane petals ("horns"). Five for five when
   * the brief was written. This was the sixth: a flat pointed blade, `halfWidth 0.34R`,
   * leaving the head sideways at exactly head height, and it is plainly an ear in the
   * before render. It was added for the hull metric, which is a real need — but the
   * fix for "the mask has nothing in it" cannot be a shape that changes what the
   * character IS, and §40's own instruction is to re-place or re-shape rather than to
   * keep it because a number likes it.
   *
   * Its metric job passes to the drape's two drooping ends, which reach past the rice
   * at the head's widest points and leave a genuine notch between hem and mound —
   * information the old lens shape could not produce, because its hem was a horizontal
   * circle. ⚠️ Those ends are part of the head mesh and will NOT be counted as
   * appendages by a tool that counts separate objects; the hull number is the one to
   * read, and it is reported rather than assumed.
   *
   * The sticks also rake much further back (lean 0.62/0.44 -> 1.05/0.80) and drop from
   * height01 0.86 to 0.68. At the old angle they stood near-vertical over the crown and
   * read as ANTENNAE — two thin rods rising off a head is its own animal signal, and it
   * is the same family of error as the fin.
   */
  private buildSilhouetteEvents(R: number): void {
    const head = this.rig.joints.head;
    const box = localBounds(head);

    const stickMat = toonMat({ color: CHOPSTICK, roughness: 0.5 });
    const tipMat = toonMat({ color: '#6E5228', roughness: 0.55 });  // a shade, not a filter tip: #8E6C39 read as a cigarette
    // Round 3: length 0.86/0.72 -> 1.00/0.84 and height01 0.68 -> 0.74. Raking them back
    // off the crown cost real SIZE — the character's projected height in the ladder crop
    // fell 15.44% -> 13.89% of the frame — and on a roster of eleven, reading smaller
    // than the others is its own defect. The lean is unchanged, so they still rake rather
    // than stand up as antennae; the length is what comes back.
    //
    // ── 🚨 "THEY STILL RAKE RATHER THAN STAND UP AS ANTENNAE" WAS FALSE AT THE ───
    // ── CAMERA THAT MATTERS, AND THE REASON IS PROJECTION, NOT ANGLE ────────────
    // The sentence above is kept because the mistake in it is instructive. The rake
    // was real: `lean` 1.05 is `atan(1.05)` = **46 degrees off vertical**, measured in
    // three dimensions, and nobody mis-derived it. But both azimuths — `-0.76pi` and
    // `-0.94pi` — point almost straight BACKWARD, so the rake is almost entirely in
    // −z. At the lobby camera (`charStage.ts`, pitch 20, yaw 0) a backward rake
    // projects to very nearly VERTICAL: 46 degrees of real lean survives as about 15
    // on screen. Rendered (`shots/cb/before/sushi.png`) they are two thin rods
    // standing off the crown, which is `DECISIONS-FOR-URI` §40 pattern 1 — the sixth
    // instance in this file alone — still live after the round that claimed to fix it.
    // ⚠️ The general form: **an angle chosen in 3D is not an angle the player sees.
    // A silhouette fix has to be verified in the PROJECTION it is a fix for.**
    //
    // Three changes, none of which give back the size round 3 bought:
    // ── ⚠️ AND CROSSING THEM WAS TRIED FIRST AND MADE IT WORSE ──────────────────
    // Round 4a kept one anchor on each side of the back and aimed each stick with a
    // lateral component opposite to its own anchor, so the pair crossed. Rendered
    // (`shots/cb/a2/sushi.png`) that is **more** antenna-like, not less: crossing
    // moved the sticks apart in x, which turned a back-raked pair into a
    // LEFT-AND-RIGHT pair — one rod above each side of the head, mirrored. The read
    // is not caused by the angle between two sticks. It is caused by BILATERAL
    // SYMMETRY: one long thin thing above each side of a head is an antenna, an ear
    // or a horn, and §40 is five-for-five on that whatever the thing is made of.
    //
    // So the fix is asymmetry, and both sticks move to ONE side:
    //   · both anchors sit back-LEFT, close together, so there is nothing above the
    //     right side of the head at all and no pair for the eye to mirror;
    //   · the aim is set EXPLICITLY and is dominated by +x. It is not derived from
    //     `out` any more, and that is the point — `out` at a back azimuth is nearly
    //     all −z, so every lean built from it rakes BACKWARD, which is the direction
    //     the camera cannot see. The two directions here are 56 and 48 degrees off
    //     vertical IN THE IMAGE PLANE, so the lean survives projection.
    //   · they open into a shallow V from a common origin, which is the shape of two
    //     sticks pushed into a bun — a carried object, not a body part.
    // ⚠️ VERIFY THIS AT THE LOBBY CAMERA, not in the numbers: the defect it fixes is
    // invisible to every metric this repo produces, and the round that thought it had
    // already fixed it is the paragraph above.
    for (const [azimuth, len, dir] of [
      // ── LENGTH 1.00/0.86 -> 1.30/1.10, AND IT IS PAYING BACK A MEASURED COST ──
      // Moving both sticks to one side cost real silhouette: `limbmatch --mode chars`
      // hullDef **0.3175 -> 0.2230** at yaw 90 and **0.3513 -> 0.2725** at yaw 0, and
      // appendages 2 -> 1. That is the number the sticks were added for in the first
      // place, so it has to be paid rather than waved through — but it is paid in
      // LENGTH, which the antenna read does not care about, and not in symmetry,
      // which is the only thing it does care about. ⚠️ Length is also what round 3
      // spent to buy projected SIZE (15.44% -> 13.89% of the ladder crop when they
      // were raked back); this gets it back on the axis the camera can see.
      [-Math.PI * 0.80, 1.30, new THREE.Vector3(1.45, 1.0, -0.35)],
      [-Math.PI * 0.92, 1.10, new THREE.Vector3(0.95, 1.0, -0.55)],
    ] as const) {
      const { at } = massAnchor(head, box, { azimuth, height01: 0.62, inset: 0.30 });
      const g = new THREE.Group();
      g.name = 'sushi_chopstick';
      aim(g, at, dir.clone().normalize());
      g.add(rod(stickMat, { len: R * len, rBase: R * 0.062, rTip: R * 0.034, seg: 7 }));
      // The pale lacquered butt — a real chopstick's one marking, and the thing that
      // stops a plain brown rod reading as a twig or an antenna.
      const butt = rod(tipMat, { len: R * len * 0.13, rBase: R * 0.058, rTip: R * 0.052, seg: 7 });
      butt.position.y = R * len * 0.87;
      g.add(butt);
      head.add(g);
    }
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
   * Bespoke limbs — an independent art director named the shared snowman-body
   * capsule arms and ball hands as the biggest cast-wide tell. Sushi gets slender
   * rice-white tapered limbs, a smooth rice-ball fist wrapped in a nori ribbon
   * with a small gold stud (Legendary accent, used sparingly per the file's own
   * convention), and a low lacquered boot with a thin gold ankle strap — reading
   * as refined rather than chunky, matching this character's premium tier.
   *
   * A previous pass also added a near-black `cuffRing` at every shoulder/elbow/
   * hip break. Nori against white rice is already this character's highest-
   * contrast pairing (the file header calls it out as the landmark read), so a
   * thick nori ring at every joint was the single worst offender in the whole
   * cast for the "bolted-together action figure" note — removed here. The fist's
   * own ribbon and the boot's own strap now carry the nori/gold accent instead,
   * trimmed down so they read as garment details rather than hardware.
   */
  private dressLimbs(): void {
    // Head+torso round: the limbs are the FISH's orange, not nori charcoal. The
    // rig palette above already says so; this block was still overriding it with
    // near-black, which is why the first render of the rewrite still came back as a
    // mostly-dark character with an orange hat. Nori is now confined to the maki
    // torso, the head's base strip and the boots, where it works as an accent
    // instead of as the character's dominant value.
    // ── THE RIM EARNS THE MOST HERE, AND IT IS ALSO THE ONE PLACE IT COSTS ────────
    // `shoulderL|elbowL` measured `dLcontact` **0.0080** against a floor of 0.0039 and
    // a target of 0.15 — the upper arm and the forearm were within TWO 8-BIT STEPS of
    // each other at the boundary where they meet, i.e. the elbow did not exist. A
    // Fresnel term fires on the front segment's grazing edge and not on the flatter
    // surface behind it, which is exactly the polarity a limb-on-limb seam needs.
    // Measured, paired, on a frozen tree:
    //
    //   pair               before -> after     contacts
    //   shoulderL|elbowL   0.0080 -> 0.2107      31 -> 23   past the 0.15 target
    //   hipL|kneeL         0.0394 -> 0.2015      30 -> 24   past the 0.15 target
    //   kneeL|footL        0.0695 -> 0.1294      42 -> 39
    //   torso|shoulderL    0.1079 -> 0.0181      86 -> 98   🚨 THE COST
    //   face|head          0.0476 -> 0.0307      57 -> 55
    //
    // 🚨 `torso|shoulderL` IS A REAL REGRESSION AND IT WAS CHOSEN, NOT OVERLOOKED.
    // `cA`/`cB` say exactly what happened: the torso's band did not move (0.3798 ->
    // 0.3825) and the shoulder's rose +0.093, from 0.2719 to **0.3645** — it walked
    // onto the torso's own value rather than past it. It is not tunable out: at
    // rimStrength 0.28 the shoulder gains 0.093, so clearing 0.15 on the far side
    // would need ~0.75, and `toon.ts` is explicit that an overdone rim is its own
    // species of amateur.
    //
    // Taken anyway, on the count and on the weight. Seams under 0.10 go **4 -> 2**
    // (shoulderL|elbowL, hipL|kneeL, face|head, kneeL|footL  ->  torso|shoulderL,
    // face|head) while the contact-WEIGHTED share of weak seams is flat: 39.5% ->
    // 38.7%, inside the noise. Two seams that were invisible by construction become
    // visible; one marginal seam is lost.
    //
    // THE ALTERNATIVE WAS MEASURED, NOT ASSUMED. Dropping `rim` from `upperLimbMat`
    // alone (everything else unchanged) restores `torso|shoulderL` to 0.1186 and puts
    // `shoulderL|elbowL` at **0.0038** and `hipL|kneeL` at **0.0063** — i.e. it buys
    // the marginal seam back by making the two dead ones deader than they started.
    // That is the one-word revert if this trade is ever reversed; the number is here so
    // it does not have to be re-measured.
    const noriLimbMat = glossyMat({ color: LIMB_NORI, roughness: 0.34, rim: true });
    const upperLimbMat = glossyMat({ color: LIMB_SALMON_DEEP, roughness: 0.34, rim: true });
    const noriAccentMat = glossyMat({ color: NORI, roughness: 0.3, rim: true });
    const salmonMat = glossyMat({ color: SALMON, roughness: 0.2, rim: true });
    const goldMat = toonMat({ color: GOLD, roughness: 0.3, metalness: 0.35 });
    const riceMat = toonMat({ color: RICE, roughness: 0.6 });

    this.rig.dressLimbs((part: LimbPart, size) => {
      switch (part) {
        case 'upperArmL':
        case 'upperArmR':
          // 1.10/0.82 -> 1.02/0.90. A 34% taper over a segment this short is a
          // MEGAPHONE, not an arm — it is the shape that made the shoulders read as
          // funnels in the lobby render, and it also widened the joint ball's own
          // footprint at the torso, which is the seam that measures worst here.
          // ── 🚨 1.02/0.90 -> 0.88/0.78, BECAUSE THE ARM AND THE LEG WERE THE SAME ──
          // `upperArm` and `thigh` shared `upperLimbMat` AND were 1.02 against 1.05 —
          // three percent apart. `forearm` and `shin` shared `noriLimbMat` and were
          // 0.80 against 0.88. So an arm and a leg were the same mass in the same two
          // materials, and the character read as four legs under a rice dome.
          //
          // The split is PROPORTION ONLY, and that is forced rather than chosen: this
          // file's value ladder is the most expensively-bought in the cast (see the
          // rim table above — `torso|shoulderL` was knowingly spent to buy
          // `shoulderL|elbowL` and `hipL|kneeL`), and sushi's `minDL` is 0.079 with
          // one pair already under 0.10. Moving any limb albedo to separate the pairs
          // would spend a seam that has already been paid for once. Arms go to 0.88
          // and legs to 1.16 — 32% apart in multiplier and 0.1257 m against 0.1559 m
          // in metres — which is a difference at 250 px and 3% was not.
          return taperedLimb(size.len, size.radius * 0.88, size.radius * 0.78, upperLimbMat, 12, 0.10);
        case 'forearmL':
        case 'forearmR':
          // ── AND THE ELBOW HAD A STEP IN IT, WHICH IS ITS OWN BEAD ─────────────
          // The rig hands the forearm a smaller base radius (`armRadius * 0.92`), so
          // equal-looking multipliers are NOT equal diameters: 0.80 * 0.1314 = 0.1051
          // against an upper arm ending at 0.90 * 0.1428 = 0.1285 — the forearm was
          // **18% narrower than the arm it hangs off**, a visible shoulder-of-mutton
          // step at the elbow. Matched in metres instead: 0.848 * 0.1314 = 0.1114
          // against 0.78 * 0.1428 = 0.1114.
          return taperedLimb(size.len, size.radius * 0.848, size.radius * 0.60, noriLimbMat);
        case 'handL':
        case 'handR': {
          // Rice-ball fists: white against the orange forearm, so the hands read as
          // separate shapes at gameplay distance instead of merging into the limb.
          const side = part === 'handL' ? 1 : -1;
          return buildRiceFist(size.radius, side, riceMat, noriAccentMat, goldMat);
        }
        case 'thighL':
        case 'thighR':
          // The heavier pair — see the note on `upperArm`. `capBotFrac` 0.10 because
          // this end is the KNEE and is covered by the shin.
          return taperedLimb(size.len, size.radius * 1.16, size.radius * 1.00, upperLimbMat, 12, 0.10);
        case 'shinL':
        case 'shinR':
          // Continuity in metres, as at the elbow: 1.111 * 0.1210 = 0.1344 against
          // the thigh's 1.00 * 0.1344 = 0.1344.
          return taperedLimb(size.len, size.radius * 1.111, size.radius * 0.86, noriLimbMat);
        case 'footL':
        case 'footR':
          // Lacquered nori boots with a rice-pale sole — the dark value moves to
          // the base of the figure, which is where it grounds rather than muddies.
          return buildLacqueredBoot(size.len, noriAccentMat, riceMat, goldMat);
        default:
          return null;
      }
    });
  }

  /** The rig owns all body motion; the base class's whole-body pass would fight it. */
  protected applyBaseMotion(): void {}
}
