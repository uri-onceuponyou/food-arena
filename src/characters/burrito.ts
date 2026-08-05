/**
 * Burrito (Rare).
 *
 * Built on the shared ChibiRig — see `donut.ts` for the reference implementation of
 * this pattern. The rig supplies torso, arms, hands, legs, feet and all motion; this
 * file authors only the food mass on `rig.joints.head`, the face and a palette.
 *
 * Identity is fixed by `rules.ts`: Burrito, Rare rarity, Burrito Disc / Roll Stun /
 * Topping Swarm. The written description ("white wrap, stands upright, toppings
 * visible at the open end") is treated as a personality guide rather than a literal
 * spec, per the brief — but "open end with visible fillings" IS kept as the
 * silhouette landmark: a standing tortilla tube, cut open at the top, with a mound of
 * rice/meat/veg fillings spilling out. Read from the game's steeply pitched-down
 * camera, an UP-facing opening is far more legible than a forward-facing one would be,
 * so unlike Donut's hole (which faces +Z) this one faces +Y.
 *
 * The head+torso loop replaced the old decorated-barrel torso with a continuation of
 * the SAME tube (see `dressTorso`): head and torso are now one uncut ~2.5:1 vertical
 * cylinder, which is the one proportion nothing else in the cast has, with a torn foil
 * sleeve flared back over its lower half as the costume/silhouette break.
 */

import * as THREE from 'three';
import { BaseCharacter, type AnimContext } from './types';
import type { CharacterDef } from '../game/rules';
import { PALETTE } from '../game/rules';
import { toonMat, glossyMat, flatMat, outlineGroup } from '../render/toon';
import { ChibiRig } from './rig';
import { bodyType } from './bodies';
import { CHARACTER_HEIGHT } from '../units';
import { aim, blade as peelBlade, localBounds, massAnchor } from './appendages';

// ── Palette ──────────────────────────────────────────────────────────────────
/**
 * ── NEAR-WHITE CLIPPING, and this is a measured pixel defect rather than taste ──
 * `sepscan --mode chars` reports the share of a character above luma 0.94 at the
 * shipped camera and shipped facing, and the same code over the six hand-verified
 * Brawl Stars full-body plates gives the band: **0.0072-0.0929, median 0.0249**,
 * p95 0.805-0.9685. An independent critic audit measured the same thing on gameplay
 * plates and got even less headroom — Shelly 0.2%, Barley 0.0%, with empty-floor
 * controls at 0.0%, so it is the character and not the frame.
 *
 * This character measured **11.44%** clipped and p95 **0.9647**.
 *
 * It is the cost `docs/STATE.md` records as cast-mean p95 drifting 0.896 -> 0.923
 * during the value pass, seen at the pixel: the dark rung was won (p05 is now better
 * than both plates) and the light end went with it, onto exactly the top-facing
 * surfaces a 58deg camera sees most of. The fix is albedo, and it is NOT a
 * desaturation — scaling a warm off-white DOWN raises its chroma, which is the
 * direction `docs/LESSONS.md` records as falsified four times in the other one.
 */
const TORTILLA = '#DFD2B9';        // pale flour wrap (luma 0.921 -> 0.827)
const TORTILLA_SHADE = '#E4CFA0';  // toasted/shadow tone — rim, torso wrap-continuation
const WRAP_BAND = '#6A1C0C';       // paper wrapper band + hands — see THE DARK RUNG below
// Foil. Warm-NEUTRAL silver rather than either extreme, and the value is the
// load-bearing part: a first pass warmed this to #EFEBE0 to keep the character in
// the cast's warm half, and at that value it landed within 4% of the tortilla it
// wraps — the whole sleeve rendered, and was invisible, against the mass behind it.
// This is ~22% darker than TORTILLA. The scene is deliberately high-key and the
// contrast pass compresses the top end, so a gap that looks generous in the hex
// arrives much smaller on screen — measured by rendering, not by reading the values.
const FOIL = '#C4C0B5';
const BOOT = '#180E05';            // near-black toasted-tortilla boots, grounds the pale body
const RICE = '#E6D8BC';            // was `PALETTE.cream` #FFF3DE (luma 0.957 -> 0.850)
// ── THE DARK RUNG ────────────────────────────────────────────────────────────
// Measured against 18 Brawl Stars plates: their P05 is 0.097 and every one of the
// eighteen puts 5% of the character below 0.18. Burrito's was 0.285, and 53.3% of its
// part boundaries measured under 0.10 apart — the arm chain almost entirely
// (`elbowL|handL` 0.011 across 22 px, `elbowL|hipL` 0.028 across 35 px, `torso|handR`
// 0.043 across 38 px). One character, four masses, all within a third of a stop.
//
// The tortilla and the rice are the light rung and do not move — they are 44% of the
// character and they are already at the reference's light end. The FILLING is where
// the dark rung goes: meat, boots, wrapper band and the lower limb tone. That is 9.7%
// + 4.7% + 5.8% of the pixels, which is what a P05 costs in AREA. Measured at
// pot_south, shipped framing: range 0.678 -> 0.799, p05 0.291 -> 0.169, fg 0.304 -> 0.251.
//
// Local, not `PALETTE.patty` / `pattyDark` / `tomato`: those three are shared with
// Hamburger and Taco, `rules.ts` is not this file's to edit, and the right value for a
// filling depends on the wrap it is sitting in.
const MEAT = '#241205';
const MEAT_DARK = '#140A03';
const TOMATO = '#7A1620';
const CHEESE = PALETTE.cheese;
const LETTUCE = PALETTE.lettuce;
const SOUR_CREAM = '#EAE4D6';      // luma 0.992 -> 0.893
// Limb-only avocado-green family. A second independent art-director pass named
// Burrito, Egg and Lollipop as all converging on pale cream/white LIMBS with dark
// boots — the wrap itself stays this pale tortilla tone (that's the food read for
// the head/torso), but the arms and legs shift to a fresh guac-green so the body
// no longer reads as another undifferentiated cream mass.
const LIMB_AVOCADO = '#3E5A1C';
const LIMB_AVOCADO_DARK = '#16220A';

type Spot = readonly [angleDeg: number, radiusFrac: number];

/**
 * A rounded limb segment, like a capsule but with INDEPENDENT top and bottom
 * radii, hanging DOWN from the joint origin (spans y=0..-len) — the orientation
 * `dressLimbs()` expects. Local to this file; see `hamburger.ts` for the
 * reference copy. Burrito's own call sites keep top/bottom radii close together
 * — a rolled tortilla is close to a true cylinder, not a tapered dough limb.
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
 * It was the metre literal 2.05 until `CHARACTER_HEIGHT` moved. A literal here is
 * a silent opt-out of every cast-wide size decision: six of the eleven carried one,
 * so raising the cast height would have scaled five characters and left six behind.
 */
const H = CHARACTER_HEIGHT * 0.976;

export class BurritoCharacter extends BaseCharacter {
  private rig: ChibiRig;
  private toppings: THREE.Object3D[] = [];
  private toppingBaseRotZ: number[] = [];
  /** Head-local Y and radius where the food tube ends, so `dressTorso` can
   *  continue the SAME tube downward instead of guessing at a matching size. */
  private headTubeBottomY = 0;
  private headTubeBottomR = 0;

  constructor(def: CharacterDef) {
    super(def);

    this.rig = new ChibiRig({
      palette: {
        limb: LIMB_AVOCADO,
        hand: WRAP_BAND,
        foot: BOOT,
        torso: TORTILLA_SHADE,
        limbRoughness: 0.78,
      },
      // Body: LANKY archetype (see `bodies.ts`) — tall narrow torso, long thin
      // limbs, narrow stance. A burrito is a long vertical tube, so the archetype
      // IS the character's shape rather than a compromise with it.
      //
      // This replaces a hand-tuned `height: 2.35`, which was buying "tall" the
      // only way the old rig allowed: limb length was a fixed fraction of height,
      // so scaling the whole character was the sole route to longer legs. LANKY
      // has real `legFraction`/`armFraction` knobs, so height goes back near the
      // 2.1m cast norm and the tall read comes from proportion instead of size.
      // `shoulderWidth` is nudged out from LANKY's own 0.145H to 0.163H for one
      // measured reason: the food tube now runs the full height (see `dressTorso`)
      // and `bodies.ts` caps a torso's half-width below the shoulder pivot or the
      // arms sink into the mass. At the stock width the tube had to neck in to
      // 0.192m through the torso against 0.238m at the head, and that 20% step
      // rendered as a cone, not a roll. Everything else is stock LANKY.
      // ── The arms had gone all the way through the window and out the far side ─
      // `docs/STATE.md` Finding 7: the fix for a buried limb overshoots into a
      // DETACHED one, and Burrito is the clearest case in the cast. Its arms
      // delivered 0.93-1.01 of their own footprint — which reads as a triumph
      // until you measure WHY: an ID-buffer render (`tools/tmp/islands.mjs`) shows
      // both arms as their own connected components, 7,619 px and 7,454 px of limb
      // with visible background between them and the tortilla. Nothing was
      // occluding them because nothing was touching them.
      //
      // 0.163H -> 0.135H. The wrap is 0.239m half-wide at shoulder height and the
      // pivot sat at 0.340m with an 0.086m arm radius, so the arm's INNER edge was
      // still 0.015m clear of the body. 0.277m puts that inner edge inside the
      // wrap and leaves the outer edge proud of it — the straddle, not either edge
      // of the window.
      proportions: bodyType('lanky', {
        height: H,
        // 0.135H -> 0.115H. LANKY's torso is 0.167H wide, i.e. 0.171 m half-width,
        // and at 0.135H the arm's INNER edge sat at 0.189 m — outside the only mass
        // it can attach to. At the rearward extreme of the run the whole left arm
        // became its own connected component, 10,060 px. 0.115H puts the inner edge
        // at 0.148 m, inside the torso, while the outer edge is still 0.153 m proud
        // of it.
        shoulderWidth: H * 0.105,
        // 0.062H -> 0.087H. LANKY's stance is narrow on purpose — "the whole figure
        // reads as a vertical line" — and a vertical line is exactly the outline
        // this pass exists to break. Still the second-narrowest in the cast, so the
        // archetype's read survives; the splay above does most of the work.
        stanceWidth: H * 0.087,
      }),
      // Arms held CLEAR of the body, with a deliberate asymmetry.
      //
      // The signs are the fix, not the magnitudes. `restPose()` sets
      // `shoulderL.rotation.z = stance.shoulderL`, and `shoulderL` is the joint at
      // x = -shoulderWidth; a POSITIVE z-rotation there swings the elbow toward +X,
      // i.e. across the body. The old 0.62 / -0.60 pair was commented as "both arms
      // swing wide" and was doing the exact opposite — pinning both arms against the
      // tube. A blind critic reading the silhouette named the result directly: no
      // arm-to-body negative space anywhere, so the outline is one solid slab.
      // Negative-left / positive-right opens them.
      // Magnitudes cut hard for the same reason as `shoulderWidth` above: these
      // signs are correct (negative-left / positive-right opens the arms outward)
      // and were the right fix for the original burial, but -0.26 / +0.19 on top
      // of an already-wide pivot is what pushed the hands 0.27m clear of the body.
      stance: {
        shoulderL: -0.04, shoulderR: 0.03,
        elbowL: -0.34, elbowR: -0.20,
        twist: -0.04, headTilt: 0.03, headTurn: 0.08,
        hipSway: 0.02, lean: -0.05,
        // The largest single response in the cast: hull deficiency 0.178 -> 0.2189
        // at splay 0.5 at the shipped facing and 0.1451 -> 0.2894 head-on, both
        // from the splay alone, both with islands at 1. A tube on two narrow legs
        // has more to gain from the legs leaving the tube's shadow than anything
        // else here does.
        splay: 0.46,
      },
    });
    this.body.add(this.rig.joints.root);
    this.head = this.rig.joints.head;

    const R = this.rig.headRadius;
    const head = this.rig.joints.head;

    // ── Food mass: an upright rolled tortilla, cut open at the top ───────────
    // A barrel-bulged cylinder rather than a straight tube — real burritos bulge
    // where they're stuffed. Built by displacing a plain CylinderGeometry's vertices
    // radially, the same technique rig.ts uses for the torso taper.
    // Round 1 of the head+torso loop: the silhouette test called this a "generic
    // blob", and the measured reason was proportion, not detail. The old tube was
    // 1.35R tall by 1.39R wide — a barrel, i.e. as wide as it is tall — sitting on
    // a separate tapered-sphere torso, so the outline read as a pill with a waist.
    // A burrito's ONE non-negotiable property is that it is a long tube, so the
    // mass now runs uncut from the fillings down to the hips (see `dressTorso`,
    // which replaces the rig's barrel with a continuation of this same tube) and
    // the tube tapers UP — narrow at the folded base, fat at the stuffed open end,
    // which is what a real burrito does and what a plain cylinder never reads as.
    const botR = R * 0.58;
    const topR = R * 0.64;
    const bodyBottomY = -R * 1.00;
    const bodyTopY = R * 0.50;
    this.headTubeBottomY = bodyBottomY;
    this.headTubeBottomR = botR;
    const bodyH = bodyTopY - bodyBottomY;
    const bulgeAmt = 0.12;

    const wrapGeo = new THREE.CylinderGeometry(topR, botR, bodyH, 28, 8, false);
    {
      const pos = wrapGeo.attributes.position as THREE.BufferAttribute;
      for (let i = 0; i < pos.count; i++) {
        const gy = pos.getY(i);
        const t = gy / bodyH + 0.5; // 0 bottom .. 1 top
        const bulge = 1 + bulgeAmt * Math.sin(t * Math.PI);
        pos.setX(i, pos.getX(i) * bulge);
        pos.setZ(i, pos.getZ(i) * bulge);
      }
      wrapGeo.computeVertexNormals();
    }
    const wrap = new THREE.Mesh(wrapGeo, toonMat({ color: TORTILLA, roughness: 0.8 }));
    wrap.name = 'burrito_wrap';
    wrap.position.y = (bodyBottomY + bodyTopY) / 2;
    wrap.castShadow = true;
    wrap.receiveShadow = true;
    head.add(wrap);

    // Exact radius of the wrap's outer surface at a given head-local Y — mirrors the
    // bulge loop above exactly, so anything placed against "the surface" (the face,
    // decals) is solved against the real equation rather than a guessed constant.
    // This is the fix for the "decals floating above / buried inside the surface"
    // failure mode: a flat guess only ever matches the surface at one specific point.
    const wrapRadiusAt = (y: number): number => {
      const t = THREE.MathUtils.clamp((y - bodyBottomY) / bodyH, 0, 1);
      const base = THREE.MathUtils.lerp(botR, topR, t);
      return base * (1 + bulgeAmt * Math.sin(t * Math.PI));
    };
    // True surface Z at a given (x, y) on the tube, assuming a circular cross-section
    // at every height (true here since the bulge scales x/z uniformly together).
    const surfaceZ = (x: number, y: number): number => {
      const r = wrapRadiusAt(y);
      return Math.sqrt(Math.max(0, r * r - x * x));
    };

    // ── Open top: rim + a mound of fillings spilling out ──────────────────────
    // Faces +Y (up), not +Z — under this game's steeply pitched-down camera an
    // up-facing opening reads far better than a forward-facing one across every yaw
    // angle, which is exactly what the 4-angle screenshot review checks for.
    //
    // The whole opening is CUT ON A SLANT. A tube capped by a level dome is
    // symmetric in outline, and a symmetric outline is what the silhouette test
    // called a blob; a slanted cut gives the top an unmistakable diagonal — the
    // shape of a wrap sliced open — and it costs one group rotation. Everything
    // below is authored in the opening's own frame (origin at the cut), so the
    // rim, the mound and every topping tilt together and stay welded to each other.
    const openEnd = new THREE.Group();
    openEnd.name = 'burrito_open_end';
    openEnd.position.y = bodyTopY;
    openEnd.rotation.z = -0.30;
    openEnd.rotation.x = 0.10;
    head.add(openEnd);
    // The rim is now the tube's WIDEST point (1.02x the wall, plus its own tube
    // thickness) rather than tucked inside it at 0.92x. Round-1 silhouette read:
    // the open end has to be the landmark, and a rim narrower than the wall it
    // caps cannot be seen at all in outline — it just continues the cylinder.
    const rim = new THREE.Mesh(
      new THREE.TorusGeometry(topR * 1.02, R * 0.075, 10, 28),
      toonMat({ color: TORTILLA_SHADE, roughness: 0.8 })
    );
    rim.name = 'burrito_rim';
    rim.rotation.x = -Math.PI / 2; // torus hole (default +Z) now points +Y
    rim.castShadow = true;
    rim.receiveShadow = true;
    openEnd.add(rim);

    // Overstuffed on purpose: the mound is now WIDER than the tube that holds it
    // (1.04x the wall radius) and sits a little higher, so the fillings bulge out
    // past the rim and break the tube's outline instead of hiding inside it. This
    // is the whole reason for the open end — an opening you cannot see the edge of
    // is not a landmark.
    const domeCenterY = R * 0.05; // openEnd-local: the group already sits at bodyTopY
    const domeR = topR * 1.04;
    const mound = new THREE.Mesh(
      // A dome cap (theta 0..~0.48π from the +Y pole) rather than a full sphere —
      // just the top bulge, like donut's proud-glaze trick.
      new THREE.SphereGeometry(domeR, 24, 12, 0, Math.PI * 2, 0, Math.PI * 0.48),
      toonMat({ color: RICE, roughness: 0.62 })
    );
    mound.name = 'burrito_rice';
    mound.position.y = domeCenterY;
    mound.castShadow = true;
    mound.receiveShadow = true;
    openEnd.add(mound);

    // Toppings seated ON the dome — each position solved against the dome's own
    // sphere equation (y = domeCenterY + sqrt(domeR^2 - r^2)) rather than eyeballed,
    // same fix as the wrap surface above.
    const meatMat = toonMat({ color: MEAT, roughness: 0.55 });
    const meatDarkMat = toonMat({ color: MEAT_DARK, roughness: 0.5 });
    const tomatoMat = glossyMat({ color: TOMATO, roughness: 0.2 });
    const cheeseMat = glossyMat({ color: CHEESE, roughness: 0.3 });
    const lettuceMat = toonMat({ color: LETTUCE, roughness: 0.6 });
    const creamMat = glossyMat({ color: SOUR_CREAM, roughness: 0.15 });

    const placeOnDome = (
      spot: Spot,
      geo: THREE.BufferGeometry,
      mat: THREE.Material,
      name: string
    ): THREE.Mesh => {
      const a = THREE.MathUtils.degToRad(spot[0]);
      const r = spot[1] * domeR;
      const y = domeCenterY + Math.sqrt(Math.max(0, domeR * domeR - r * r)) * 0.96;
      const m = new THREE.Mesh(geo, mat);
      m.name = name;
      m.position.set(Math.cos(a) * r, y, Math.sin(a) * r);
      m.rotation.set(0.3, a, 0);
      m.castShadow = true;
      m.receiveShadow = true;
      openEnd.add(m);
      this.toppings.push(m);
      this.toppingBaseRotZ.push(m.rotation.z);
      return m;
    };

    // Sized up from round 1, where sparse small toppings left the pale rice mound
    // dominant and the whole thing read as ice-cream-with-sprinkles rather than a
    // packed burrito filling.
    //
    // Round 3 defect: each topping type had its own block of angles (all the meat
    // clustered in 0-150 deg, etc). From the front camera that meant one whole TYPE
    // dominated the visible half of the dome — a solid clump of meat with the cheese,
    // tomato and lettuce hidden behind/under it — rather than a mixed filling. Fixed
    // by interleaving all four types round-robin around the full circle, so every
    // angular slice the camera can see has a mix, never a monotone clump. Sizes also
    // trimmed down so adjacent pieces don't overlap into a single blob.
    // Sized up again in the head+torso round. A character is ~95px tall at shipped
    // framing, so this whole mound is ~14px across — pieces below ~0.16R simply do
    // not survive to the screen, and the "packed filling" read has to come from a
    // few big saturated lumps rather than many small ones.
    const meatGeo = new THREE.SphereGeometry(R * 0.25, 10, 8);
    const tomatoGeo = new THREE.BoxGeometry(R * 0.23, R * 0.23, R * 0.23);
    const cheeseGeo = new THREE.ConeGeometry(R * 0.115, R * 0.34, 6);
    const lettuceGeo = new THREE.CapsuleGeometry(R * 0.075, R * 0.26, 4, 6);
    const creamGeo = new THREE.SphereGeometry(R * 0.115, 10, 8);

    // Fewer, bigger pieces. At the size a player sees a character the whole mound is
    // ~14px across; sixteen pieces at that scale average into one mottled dome, which
    // is the "reads as ice cream" note. Eight big ones keep a readable lump-and-gap
    // rhythm. This is the same spatial-frequency lesson the floor learned: detail the
    // size of the thing carrying it reads as a flat tint.
    const KIND_COUNT = 8;
    const kinds = ['meat', 'tomato', 'cheese', 'lettuce'] as const;
    const spotsByKind: Record<(typeof kinds)[number], Spot[]> = { meat: [], tomato: [], cheese: [], lettuce: [] };
    for (let i = 0; i < KIND_COUNT; i++) {
      const deg = (i / KIND_COUNT) * 360 + ((i * 13) % 10); // near-even ring, deterministic jitter
      // Widened from 0.32..0.78 to reach the mound's own edge: the pieces that do
      // the silhouette work are the ones that hang OVER the rim, and the old range
      // stopped short of it so every topping stayed inside the tube's outline.
      const rFrac = 0.30 + (((i * 37) % 100) / 100) * 0.66; // 0.30..0.96
      spotsByKind[kinds[i % kinds.length]].push([deg, rFrac]);
    }
    const creamSpots: Spot[] = [[40, 0.18], [230, 0.20]];

    spotsByKind.meat.forEach((s, i) => {
      const m = placeOnDome(s, meatGeo, i % 3 === 0 ? meatDarkMat : meatMat, 'burrito_meat');
      m.scale.set(1.1, 0.8, 1.1);
    });
    spotsByKind.tomato.forEach((s) => {
      const m = placeOnDome(s, tomatoGeo, tomatoMat, 'burrito_tomato');
      m.rotation.z = 0.4;
    });
    spotsByKind.cheese.forEach((s) => placeOnDome(s, cheeseGeo, cheeseMat, 'burrito_cheese'));
    spotsByKind.lettuce.forEach((s) => {
      const m = placeOnDome(s, lettuceGeo, lettuceMat, 'burrito_lettuce');
      m.rotation.x += Math.PI / 2; // lay along the surface rather than poking straight up
    });
    creamSpots.forEach((s) => {
      const m = placeOnDome(s, creamGeo, creamMat, 'burrito_cream');
      m.scale.set(1, 0.5, 1);
    });

    // ── The fold seam ────────────────────────────────────────────────────────
    // A rolled tortilla has one overlapping edge running its whole length. Without
    // it the tube is a machined cylinder, which a blind critic named exactly ("an
    // untapered straight cylinder... reads as a rolled towel"). Placed off-centre so
    // it does not sit behind the face, and solved against `wrapRadiusAt` so it hugs
    // the bulge instead of floating off it at one height and sinking at another.
    {
      const seamMat = toonMat({ color: TORTILLA_SHADE, roughness: 0.82 });
      const seamTheta = -0.85; // to her right of the face, still on the visible front
      const steps = 7;
      for (let i = 0; i < steps; i++) {
        const t = i / (steps - 1);
        const y = THREE.MathUtils.lerp(bodyBottomY + R * 0.10, bodyTopY - R * 0.06, t);
        const rr = wrapRadiusAt(y) * 1.012;
        // Drifts slightly around the tube as it climbs — a wrapped edge spirals, it
        // does not run dead vertical.
        const a = seamTheta + t * 0.30;
        const lump = new THREE.Mesh(
          new THREE.CapsuleGeometry(R * 0.036, R * 0.14, 4, 8),
          seamMat
        );
        lump.name = 'burrito_fold_seam';
        lump.position.set(Math.sin(a) * rr, y, Math.cos(a) * rr);
        lump.rotation.z = 0.06;
        lump.castShadow = true;
        head.add(lump);
      }
    }

    // ── Foil wrap, cut on the diagonal ────────────────────────────────────────
    // The single most recognisable burrito image is a tortilla tube half out of its
    // foil, and the foil's torn edge running DIAGONALLY across the roll. In outline
    // the diagonal costs nothing on its own (it is a colour break), but the torn
    // tabs peeling off it do break the silhouette, and in the lit render the
    // diagonal is what stops a cream cylinder reading as a cream cylinder.
    //
    // Built by shearing an open cylinder's TOP ring only: every vertex above the
    // mid-plane gets `y += FOIL_SLANT * x`, so the wrap keeps a level bottom and a
    // slanted mouth. Radii are sampled off `wrapRadiusAt`, the same equation the
    // face and every decal use, plus a real 3% wall clearance so it can never
    // z-fight with the tortilla underneath.
    const FOIL_SLANT = 0.38;
    const foilBotY = bodyBottomY + R * 0.02;
    // ── This was NOT below the mouth, and it ate half the face ─────────────────
    // Measured: the `face` joint group delivers **0.465** of its own footprint —
    // 53.5% of every eye, brow and mouth pixel is drawn and then covered. The
    // arithmetic in the previous note stopped one term short. The foil sits at
    // 1.035x the tortilla radius while the face features are placed at 0.90-0.94x
    // (they hug the tube), so the foil is IN FRONT of the face everywhere the two
    // overlap on screen — and the mouth's torus (R*0.17 major + R*0.055 tube about
    // -0.22R) actually reaches down to -0.445R, not the -0.39R assumed here, while
    // the sheared edge climbs to foilTopY + 0.38 * maxRadius ~= foilTopY + 0.13R.
    //
    // -0.70R puts the highest point of the wrap at ~-0.57R, clear of the mouth's
    // true bottom with margin. The torn tabs are handled separately below, because
    // they stand proud of the edge and were the other half of the overlap.
    const foilTopY = -R * 0.70;
    const foilH = foilTopY - foilBotY;
    const foilGeo = new THREE.CylinderGeometry(
      wrapRadiusAt(foilTopY) * 1.035,
      wrapRadiusAt(foilBotY) * 1.035,
      foilH, 30, 1, true
    );
    {
      const pos = foilGeo.attributes.position as THREE.BufferAttribute;
      for (let i = 0; i < pos.count; i++) {
        if (pos.getY(i) > 0) pos.setY(i, pos.getY(i) + FOIL_SLANT * pos.getX(i));
      }
      foilGeo.computeVertexNormals();
    }
    const headFoilMat = toonMat({ color: FOIL, roughness: 0.22, metalness: 0.55, doubleSide: true });
    const headFoil = new THREE.Mesh(foilGeo, headFoilMat);
    headFoil.name = 'burrito_head_foil';
    headFoil.position.y = (foilTopY + foilBotY) / 2;
    headFoil.castShadow = true;
    headFoil.receiveShadow = true;
    head.add(headFoil);

    // Torn tabs riding the diagonal edge — the silhouette break. Each sits at the
    // sheared edge height for its own azimuth, so they trace the diagonal instead
    // of ringing the tube at one level.
    const tabMat = toonMat({ color: FOIL, roughness: 0.22, metalness: 0.55 });
    [10, 58, 122, 190, 250, 312].forEach((deg, i) => {
      const a = THREE.MathUtils.degToRad(deg);
      const rr = wrapRadiusAt(foilTopY) * 1.035;
      const x = Math.cos(a) * rr;
      const z = Math.sin(a) * rr;
      // Tab height now scales with how SIDE-ON the tab is, which serves both
      // masters at once: the tabs that actually break the SILHOUETTE are the ones
      // near +-X (they stick out past the body's outline), and the ones near +Z are
      // the ones that were climbing over the mouth while contributing nothing to
      // the outline. So the side tabs get taller than before and the front tabs get
      // shorter. `i` is kept only to keep the pattern from being perfectly regular.
      const h = R * (0.10 + 0.13 * Math.abs(Math.cos(a)) + 0.012 * (i % 3));
      const tab = new THREE.Mesh(new THREE.ConeGeometry(rr * 0.24, h, 3), tabMat);
      tab.name = 'burrito_foil_tab';
      tab.position.set(x, foilTopY + FOIL_SLANT * x + h * 0.30, z);
      tab.rotation.set(Math.sin(a) * 0.6, -a, -Math.cos(a) * 0.6);
      tab.castShadow = true;
      head.add(tab);
    });

    // ── Face: on the wrap's own front surface, mid-body ───────────────────────
    // `face` is reset to identity and every feature carries its own computed
    // (x, y, z) rather than relying on the rig's spherical-head default offset —
    // this body isn't spherical, so that default would float the eyes off the tube
    // wherever they're not dead-centre (verified: at the default x-offset the rig's
    // flat headRadius*0.82 constant sits ~0.09R proud of the tube's true surface).
    this.rig.joints.face.position.set(0, 0, 0);
    this.buildFace(R, surfaceZ);

    // ── Torso: dressed as a wrap continuation, foil peeling back at the base ──
    this.dressTorso(R);

    // ── Limbs: bespoke, not the shared rig defaults ───────────────────────────
    // An independent art director named the rig's identical capsule-arm/ball-hand/
    // wedge-foot kit as the single biggest "template" tell across the whole cast.
    // Burrito's limbs are rolled tortilla, close to true cylinders rather than
    // tapered dough, with a seam stripe echoing the roll; hands are twisted foil
    // nubs (the classic "twist the wrapper end" burrito silhouette) instead of a
    // generic mitt, and feet read as the wrap's own cut end.
    const limbWrapMat = toonMat({ color: LIMB_AVOCADO, roughness: 0.75 });
    const limbWrapShadeMat = toonMat({ color: LIMB_AVOCADO_DARK, roughness: 0.75 });
    const seamMat = toonMat({ color: LIMB_AVOCADO_DARK, roughness: 0.7 });
    const foilMatLimb = toonMat({ color: FOIL, roughness: 0.25, metalness: 0.5 });
    const bandMatLimb = toonMat({ color: WRAP_BAND, roughness: 0.72 });
    const bootMatLimb = toonMat({ color: BOOT, roughness: 0.75 });
    this.rig.dressLimbs((part, size) => {
      switch (part) {
        case 'upperArmL': case 'upperArmR':
        case 'thighL': case 'thighR': {
          const g = new THREE.Group();
          const m = new THREE.Mesh(taperedSegment(size.len, size.radius * 1.05, size.radius * 1.0, 12), limbWrapMat);
          m.name = `${part}_mesh`;
          m.castShadow = true;
          m.receiveShadow = true;
          g.add(m);
          const seam = new THREE.Mesh(new THREE.BoxGeometry(size.radius * 0.16, size.len * 0.94, size.radius * 0.05), seamMat);
          seam.position.set(0, -size.len * 0.5, size.radius * 0.98);
          seam.userData.noOutline = true;
          g.add(seam);
          return g;
        }
        case 'forearmL': case 'forearmR':
        case 'shinL': case 'shinR': {
          const g = new THREE.Group();
          const m = new THREE.Mesh(taperedSegment(size.len, size.radius * 1.0, size.radius * 0.92, 12), limbWrapShadeMat);
          m.name = `${part}_mesh`;
          m.castShadow = true;
          m.receiveShadow = true;
          g.add(m);
          // Wrapper-band cuff — same costume language as the torso's own sash.
          const cuff = new THREE.Mesh(new THREE.TorusGeometry(size.radius * 1.02, size.radius * 0.26, 8, 20), bandMatLimb);
          cuff.rotation.x = Math.PI / 2;
          cuff.position.y = -size.radius * 0.3;
          cuff.castShadow = true;
          g.add(cuff);
          return g;
        }
        case 'handL': case 'handR': {
          const g = new THREE.Group();
          const cuff = new THREE.Mesh(new THREE.TorusGeometry(size.radius * 0.7, size.radius * 0.22, 8, 16), bandMatLimb);
          cuff.rotation.x = Math.PI / 2;
          cuff.castShadow = true;
          g.add(cuff);
          // The classic twisted-foil wrapper end — a cone tapering to a point.
          // Blunted from a 0.62 x 1.5 spike. A pointed cone hanging off a short arm
          // reads as a stick, not a hand — and the arms are now held clear of the
          // body (see the stance note) so the hands are actually visible in outline
          // for the first time, which is what exposed it.
          const twist = new THREE.Mesh(new THREE.ConeGeometry(size.radius * 0.82, size.radius * 1.02, 8), foilMatLimb);
          twist.position.y = -size.radius * 0.72;
          twist.name = `${part}_mesh`;
          twist.castShadow = true;
          twist.receiveShadow = true;
          g.add(twist);
          return g;
        }
        case 'footL': case 'footR': {
          const g = new THREE.Group();
          const stub = new THREE.Mesh(
            new THREE.CylinderGeometry(size.radius * 1.1, size.radius * 1.02, size.len * 0.75, 16, 1, false),
            bootMatLimb
          );
          stub.position.set(0, -size.len * 0.42, size.radius * 0.3);
          stub.rotation.x = Math.PI * 0.06;
          stub.name = `${part}_mesh`;
          stub.castShadow = true;
          stub.receiveShadow = true;
          g.add(stub);
          const ring = new THREE.Mesh(new THREE.TorusGeometry(size.radius * 1.06, size.radius * 0.1, 6, 16), foilMatLimb);
          ring.rotation.x = Math.PI / 2;
          ring.position.set(0, -size.len * 0.1, size.radius * 0.3);
          ring.castShadow = true;
          g.add(ring);
          return g;
        }
        default:
          return null;
      }
    });

    this.buildSilhouetteEvents(R);

    outlineGroup(this.root);
    this.collectFlashTargets();
    this.rig.restPose();
  }

  /**
   * SILHOUETTE EVENTS — three peeled corners of foil.
   *
   * Burrito already had the third-best outline in the cast at the shipped facing
   * (0.1717, one appendage), and the same shape head-on was 0.1354 with the wrap
   * reading as a plain cylinder. Foil peeled back off the top is the one thing a
   * wrapped burrito does that a cylinder does not, and the file already carries
   * `FOIL` for it.
   *
   * Three, at three lengths, curled out and up so each leaves the tube on the
   * horizontal — the direction worth 0.85-1.0 of a screen-metre at this camera
   * against a vertical element's 0.53 (`appendages.ts`).
   */
  private buildSilhouetteEvents(R: number): void {
    const head = this.rig.joints.head;
    const box = localBounds(head);
    const foilMat = glossyMat({ color: FOIL, roughness: 0.30, metalness: 0.25 });

    const spec = [
      { azimuth: Math.PI * 0.54, len: 0.78, lift: 0.55 },
      { azimuth: -Math.PI * 0.48, len: 0.62, lift: 0.34 },
      { azimuth: Math.PI * 0.96, len: 0.70, lift: 0.68 },
    ];
    for (const sp of spec) {
      const { at, out } = massAnchor(head, box, { azimuth: sp.azimuth, height01: 0.74, inset: 0.20 });
      const g = new THREE.Group();
      g.name = 'burrito_foil_peel';
      aim(g, at, out.clone().add(new THREE.Vector3(0, sp.lift, 0)).normalize(), Math.PI * 0.5);
      g.add(peelBlade(foilMat, {
        len: R * sp.len, halfWidth: R * 0.30, thick: R * 0.028, curl: 0.30, waist: 1.1,
      }));
      head.add(g);
    }
  }

  /** Eager, open-mouthed grin — a Rare brawler ready to roll into a fight. */
  private buildFace(R: number, surfaceZ: (x: number, y: number) => number): void {
    const face = this.rig.joints.face;
    const ink = PALETTE.ink;
    const eyeMat = toonMat({ color: ink, roughness: 0.25 });
    const eyeY = R * 0.10;

    for (const sx of [-1, 1]) {
      // Right eye (sx>0) winks — noticeably squashed and its brow cocked hard above
      // it — while the left stays wide open with a low, relaxed brow. A second
      // independent art-director pass named matched, mirrored brows/eyes across the
      // cast as the biggest reason facial acting wasn't landing; "ready to roll into
      // a fight" now reads as one deliberate wink-and-grin rather than a symmetric
      // eager stare.
      const wink = sx > 0 ? 0.34 : 1.15;
      const ex = sx * R * 0.30;
      const ez = surfaceZ(ex, eyeY) * 0.94;
      const eye = new THREE.Mesh(new THREE.SphereGeometry(R * 0.125, 16, 14), eyeMat);
      eye.position.set(ex, eyeY, ez);
      eye.scale.set(1, wink, 0.55);
      eye.castShadow = true;
      face.add(eye);

      const glint = new THREE.Mesh(new THREE.SphereGeometry(R * 0.04, 8, 8), flatMat('#ffffff'));
      glint.position.set(ex - R * 0.03, eyeY + R * 0.045 * wink, ez + R * 0.05);
      glint.userData.noOutline = true;
      face.add(glint);

      // Brows — placed against the SAME `surfaceZ` equation as the eye it sits above
      // so it can't sink into or float off the tube regardless of where sx pushes it.
      // Genuinely asymmetric now: cocked hard over the winking eye, low and level
      // over the open one.
      const bx = ex;
      const by = eyeY + (sx > 0 ? R * 0.205 : R * 0.135);
      const bz = surfaceZ(bx, by) * 0.95;
      const brow = new THREE.Mesh(
        new THREE.CapsuleGeometry(R * 0.022, R * 0.15, 4, 8),
        toonMat({ color: PALETTE.ink, roughness: 0.4 })
      );
      brow.position.set(bx, by, bz);
      brow.rotation.z = Math.PI / 2 - sx * (sx > 0 ? 0.40 : 0.10);
      brow.castShadow = true;
      face.add(brow);
    }

    const mouthY = -R * 0.22;
    const mouth = new THREE.Mesh(
      new THREE.TorusGeometry(R * 0.17, R * 0.055, 8, 20, Math.PI * 0.85),
      toonMat({ color: ink, roughness: 0.3 })
    );
    mouth.position.set(0, mouthY, surfaceZ(0, mouthY) * 0.9);
    mouth.rotation.z = Math.PI * 1.08;
    mouth.castShadow = true;
    face.add(mouth);

    // Hoisted and given `depthWrite: false` — a transparent material that still
    // writes depth is a silent occluder (`docs/LESSONS.md` §1), and every
    // transparent material in the cast carried the default `true`.
    const blushMat = flatMat('#FF9EC4', { transparent: true, opacity: 0.5 });
    blushMat.depthWrite = false;
    for (const sx of [-1, 1]) {
      const cx = sx * R * 0.44;
      const cy = -R * 0.08;
      const cheek = new THREE.Mesh(
        new THREE.SphereGeometry(R * 0.06, 10, 8),
        blushMat
      );
      cheek.position.set(cx, cy, surfaceZ(cx, cy) * 0.92);
      cheek.scale.set(1, 0.7, 0.3);
      cheek.userData.noOutline = true;
      face.add(cheek);
    }
  }

  /**
   * The torso IS the burrito — one uncut tube from the fillings down to the hips.
   *
   * ── Why this replaced a decorated barrel ────────────────────────────────────
   * The cast-wide silhouette test named Burrito as one of three characters that
   * "collapse into a generic blob", and the measurement says why. The food mass
   * used to stop dead at the neck: a 1.35R-tall by 1.39R-wide tube (as wide as it
   * is tall — a barrel, not a tube) perched on the rig's own tapered-sphere torso.
   * Two round masses with a waist between them is a pill, and a pill is exactly
   * what the black-on-white render showed.
   *
   * A burrito's single non-negotiable property is that it is LONG. Continuing the
   * head's own tube through the torso gives a ~2.5:1 vertical cylinder — the one
   * proportion no other character in the cast has — and it costs nothing in body
   * plan, because the archetype still owns every joint, limb length and stance.
   * `rig.dressTorso` exists for precisely this ("the strongest characters extend
   * their food mass down through the BODY").
   *
   * The costume layer moves with it. A striped poncho over the tube was actively
   * fighting the read — five horizontal colour bands across the middle of the one
   * shape that has to read as continuous — so it is replaced by the thing a
   * burrito actually wears: a foil sleeve over the lower half, torn open and
   * flared back at its top edge, with the takeaway paper band around it. That is a
   * real garment-scale silhouette break (the flare projects past the tube from
   * every yaw) that also happens to be the character's own identity cue.
   *
   * Sizing rules obeyed here:
   *  - the tube's radius is capped so it stays clear INSIDE the arms
   *    (`shoulderWidth - armRadius * 1.28`); `bodies.ts` warns that a torso whose
   *    half-width reaches the shoulder pivot turns the character into a pile of
   *    overlapping dough balls, and this file has to respect that cap because it
   *    is deliberately making the torso wider than the rig's own default.
   *  - the tube's TOP is solved from `metrics.headCentreY` + the head tube's own
   *    bottom, not from a hardcoded fraction, so an archetype change moves the
   *    join rather than opening a gap.
   */
  private dressTorso(R: number): void {
    const m = this.rig.metrics;
    // STUB has no torso (`bodies.ts`); `rig.dressTorso` no-ops there and every
    // offset below would collapse onto the hip line, so bail before measuring.
    if (!m.hasTorso) return;

    const wrapMat = toonMat({ color: TORTILLA, roughness: 0.8 });
    const foilMat = toonMat({ color: FOIL, roughness: 0.25, metalness: 0.5 });
    const foilShellMat = toonMat({ color: FOIL, roughness: 0.25, metalness: 0.5, doubleSide: true });
    const bandMat = toonMat({ color: WRAP_BAND, roughness: 0.72 });

    // Where the head's tube ends, in TORSO-LOCAL space (the torso joint's origin
    // is the hip pivot, so subtract hipY from the world height).
    const headBottomLocal = m.headCentreY + this.headTubeBottomY - m.hipY;
    const maxR = Math.max(m.shoulderWidth - m.armRadius * 1.28, R * 0.34);
    const tubeTopR = Math.min(this.headTubeBottomR, maxR);
    const tubeBotR = tubeTopR * 0.82;   // the folded, tucked end
    const yBot = -R * 0.16;             // dips below the hip pivot so no seam shows
    const yTop = headBottomLocal + R * 0.12; // overlaps up into the head mass

    this.rig.dressTorso(() => {
      const g = new THREE.Group();
      g.name = 'burrito_torso_tube';

      // Lathe, wound bottom → top. Getting this backwards inverts the normals and
      // the mesh renders near-black — the trap that bit six characters at once.
      const pts: THREE.Vector2[] = [
        new THREE.Vector2(0, yBot),
        new THREE.Vector2(tubeBotR * 0.52, yBot + R * 0.045),
        new THREE.Vector2(tubeBotR * 0.90, yBot + R * 0.14),
        new THREE.Vector2(tubeBotR, yBot + R * 0.26),
        new THREE.Vector2(tubeTopR * 0.99, (yBot + yTop) * 0.5),
        new THREE.Vector2(tubeTopR, yTop),
      ];
      const tube = new THREE.Mesh(new THREE.LatheGeometry(pts, 28), wrapMat);
      tube.name = 'burrito_torso_wrap';
      tube.castShadow = true;
      tube.receiveShadow = true;
      g.add(tube);

      // The tuck: a short diagonal fold across the base, the seam a real burrito
      // shows where the tortilla is folded under. Cheap, and it stops the bottom
      // of the tube reading as a machined cylinder.
      const foldMat = toonMat({ color: TORTILLA_SHADE, roughness: 0.82 });
      const fold = new THREE.Mesh(
        new THREE.CapsuleGeometry(tubeBotR * 0.13, tubeBotR * 1.5, 4, 10),
        foldMat
      );
      fold.name = 'burrito_tuck_fold';
      fold.position.set(0, yBot + R * 0.30, tubeBotR * 0.90);
      fold.rotation.z = Math.PI * 0.5 - 0.34;
      fold.castShadow = true;
      g.add(fold);

      return g;
    });

    // ── Foil sleeve over the whole torso tube ────────────────────────────────
    // A first pass ended the sleeve half way up and flared it into a torn collar.
    // The render killed it: the flare sat exactly where the arms hang, so it read
    // as a small grey ruffle rather than a silhouette break, and cool grey is the
    // worst colour to spend at the character's widest point on a cast that owns
    // the warm half of the wheel. The flare moved up to the HEAD tube's diagonal
    // edge instead (where nothing occludes it), and down here the foil simply runs
    // the full height, so head-foil and torso-foil read as one continuous wrap
    // with one diagonal mouth.
    const torso = this.rig.joints.torso;
    const sleeve = new THREE.Mesh(
      new THREE.CylinderGeometry(tubeTopR * 1.035, tubeBotR * 1.05, yTop - (yBot + R * 0.14), 28, 1, true),
      foilShellMat
    );
    sleeve.name = 'burrito_foil_sleeve';
    sleeve.position.y = (yTop + yBot + R * 0.14) * 0.5;
    sleeve.castShadow = true;
    sleeve.receiveShadow = true;
    torso.add(sleeve);

    // Takeaway paper band around the sleeve — the one hot, saturated ring on an
    // otherwise pale character, and the cast owns the warm half of the wheel.
    const band = new THREE.Mesh(
      new THREE.CylinderGeometry(tubeTopR * 1.10, tubeTopR * 1.12, R * 0.34, 26, 1, true),
      bandMat
    );
    band.name = 'burrito_band';
    band.position.y = yBot + (yTop - yBot) * 0.30;
    band.castShadow = true;
    band.receiveShadow = true;
    torso.add(band);
  }


  protected onUpdate(ctx: AnimContext): void {
    this.rig.animate({
      elapsed: this.elapsed,
      move01: ctx.moveSpeed01,
      attack01: this.attackT >= 0 ? this.attackT / this.attackDuration : -1,
      hit01: this.hitT >= 0 ? this.hitT / 0.26 : -1,
      dead01: this.deathT >= 0 ? this.deathT / 0.75 : -1,
    });

    // A faint jiggle through the loose toppings while running, same cadence rig.ts
    // uses for the run bounce (10.5 rad/s) — cheap life, relative to each topping's
    // OWN rest rotation so it settles cleanly rather than drifting.
    const move = THREE.MathUtils.clamp(ctx.moveSpeed01, 0, 1);
    const wobble = Math.sin(this.elapsed * 10.5) * 0.06 * move;
    for (let i = 0; i < this.toppings.length; i++) {
      this.toppings[i].rotation.z = this.toppingBaseRotZ[i] + wobble * (i % 2 === 0 ? 1 : -1);
    }
  }

  /** The rig owns all body motion; the base class's whole-body pass would fight it. */
  protected applyBaseMotion(): void {}
}
