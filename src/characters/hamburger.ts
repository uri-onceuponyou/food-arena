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
import { ChibiRig } from './rig';

// ─────────────────────────────────────────────────────────────────────────────
// Local geometry helpers — chunky rounded discs the shared kit doesn't provide.
// ─────────────────────────────────────────────────────────────────────────────

/** A rounded "hockey puck" — flat top/bottom with a filleted rim. Used for every
 * stacked layer (buns, patty, cheese, tomato, lettuce) so the whole stack reads as
 * one consistent chunky-food language. */
function roundedPuck(radius: number, height: number, edge: number, radialSegments = 24): THREE.BufferGeometry {
  const e = Math.min(edge, height / 2 - 0.001, radius * 0.9);
  const corner = 5;
  const pts: THREE.Vector2[] = [];
  pts.push(new THREE.Vector2(0, 0));
  pts.push(new THREE.Vector2(Math.max(radius - e, 0.001), 0));
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
 * A rounded limb segment, like a capsule but with INDEPENDENT top and bottom
 * radii, hanging DOWN from the joint origin (spans y=0..-len) — the orientation
 * `dressLimbs()` expects. Used so Hamburger's limbs read as tapered dough rather
 * than the rig's uniform-radius default capsule. Degenerates to a plain sphere
 * when rTop==rBot==len/2, which is exactly what the hand slot wants.
 */
function taperedSegment(len: number, rTop: number, rBot: number, radialSegments = 12): THREE.BufferGeometry {
  // Profile MUST be wound bottom-to-top (y increasing), matching the convention
  // every other lathe helper in this file (`roundedPuck`, `bunDome`) already
  // uses — LatheGeometry's face winding (and therefore `computeVertexNormals`'s
  // outward-vs-inward call) depends on point order, not just point position. An
  // earlier version of this function built the profile top-to-bottom for
  // convenience (it "hangs down", so starting at the joint origin felt natural)
  // and every limb using it rendered near-black: inverted normals facing away
  // from the light. Built the shape the same way round now; the y=0/y=-len
  // hang-down placement is unchanged.
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

export class HamburgerCharacter extends BaseCharacter {
  private rig: ChibiRig;

  constructor(def: CharacterDef) {
    super(def);

    this.rig = new ChibiRig({
      palette: {
        limb: PALETTE.bun,      // stubby bun-coloured arms, per the original design
        hand: PALETTE.cream,    // cream mitts
        foot: PALETTE.pattyDark, // dark little feet
        torso: PALETTE.bunDark,  // fallback only — dressTorso() replaces this mesh below
        limbRoughness: 0.85,     // dry, matte-baked crust, matching the bun layers
      },
      // Wide, squat, heavy, planted — broad shoulders and thick, short-reading legs so
      // the silhouette reads as "burger" even with the head covered. A second
      // independent art-director pass named identical body proportions across the cast
      // as the single biggest remaining "template" tell despite per-character limb
      // geometry; `height` is deliberately below the 2.1m cast norm (short/squat) while
      // radii and stance run well above it (thick/planted).
      proportions: {
        height: 1.95,
        headFraction: 0.50,
        armRadius: 0.172,
        handRadius: 0.195,
        legRadius: 0.185,
        shoulderWidth: 0.536,
        stanceWidth: 0.312,
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
    const bunDarkMat = toonMat({ color: PALETTE.bunDark, ramp: RAMP_CHARACTER(), roughness: 0.85 });
    const pattyMat = toonMat({ color: PALETTE.patty, ramp: RAMP_CHARACTER(), roughness: 0.55 }); // seared, faintly greasy meat
    const pattyDarkMat = toonMat({ color: PALETTE.pattyDark, ramp: RAMP_CHARACTER(), roughness: 0.55 });
    const cheeseMat = glossyMat({ color: PALETTE.cheese, roughness: 0.35 }); // soft melt sheen
    const tomatoMat = glossyMat({ color: PALETTE.tomato, roughness: 0.18 }); // wettest surface on the model
    const lettuceMatA = toonMat({ color: PALETTE.lettuce, ramp: RAMP_CHARACTER(), roughness: 0.6 }); // leafy, satin not shiny
    const lettuceMatB = toonMat({ color: new THREE.Color(PALETTE.lettuce).offsetHSL(0, -0.06, 0.05), ramp: RAMP_CHARACTER(), roughness: 0.6 });
    const seedMat = toonMat({ color: PALETTE.cream, ramp: RAMP_CHARACTER(), roughness: 0.75 }); // dry toasted sesame
    const faceMat = toonMat({ color: PALETTE.ink, ramp: RAMP_CHARACTER(), roughness: 0.42 });
    const blushMat = flatMat('#FF9EC4', { transparent: true, opacity: 0.45 });
    // Spatula — the held prop. Deliberately NOT a food material: brushed metal +
    // dark plastic reads as "tool", sells Patty Smash as an ability, and gives the
    // silhouette a landmark nothing else in a roster of round food blobs would have.
    const spatulaHandleMat = toonMat({ color: '#3B2A22', roughness: 0.55 });
    const spatulaBladeMat = toonMat({ color: '#CDD3DC', roughness: 0.28, metalness: 0.55 });

    // ── Vertical layout ──────────────────────────────────────────────────────
    // See the file-level comment for the full derivation. BASE_Y anchors the
    // patty's underside at the rig's own SHOULDER height (not the torso top) so
    // the arms emerge from the seam between the two buns. `torsoH`/`shoulderY`
    // mirror `rig.ts`'s own (private) constants — the same "recompute locally,
    // comment that it must match" convention `soup.ts`'s `dressTorsoAsSoup` and
    // `waterbottle.ts`'s `dressTorsoAsBottle` already use to stay in sync with
    // the rig without either file reaching into the other's internals.
    const rigHeight = 1.95; // must match `proportions.height` above
    const torsoH = rigHeight * 0.28;       // rig.ts: torsoH = height * 0.28
    const shoulderDrop = torsoH * 0.22;    // rig.ts: shoulderY = torsoH * 0.78, i.e. 0.22*torsoH below the top
    // headCentreY = torsoTopY + 0.86*R (rig.ts's own constant); solving
    // headCentreY + BASE_Y = torsoTopY - shoulderDrop for BASE_Y lands the
    // patty's BOTTOM edge exactly level with the shoulder joint. Rendered, that
    // wasn't enough: the shoulder joint is the TOP of the visible arm mound (the
    // arm mesh hangs DOWN from it), so the arm's own visible bulk still sat
    // entirely below the patty, reading as attached to the bottom bun rather than
    // to the seam. `SEAM_EMBED` pulls the patty (and everything above it) down
    // further so the patty layer itself — not just its lower edge — surrounds the
    // arm's attachment point, with the cheese poking out just above the arm mound.
    const SEAM_EMBED = 0.15;
    const BASE_Y = -R * 0.86 - shoulderDrop - SEAM_EMBED;
    const PATTY_H = 0.20;
    const CHEESE_H = 0.095;
    const TOMATO_H = 0.125;
    const LETTUCE_H = 0.14;
    const CROWN_H = 0.40;

    const PATTY_R = R * 0.60;
    const CHEESE_R = R * 0.72;
    const TOMATO_R = R * 0.64;
    const LETTUCE_BASE_R = R * 0.54;
    const LETTUCE_FRILL_R = R * 0.74;
    const CROWN_BASE_R = R * 0.66;

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
    const dripBottomY = BASE_Y - 0.09; // sinks past the patty's underside, into the arm mound
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
    const lettuceBaseH = LETTUCE_H * 0.48;
    const lettuceBase = new THREE.Mesh(roundedPuck(LETTUCE_BASE_R, lettuceBaseH, LETTUCE_BASE_R * 0.07), lettuceMatA);
    lettuceBase.name = 'lettuce_base';
    lettuceBase.position.y = lettuceY;
    lettuceBase.castShadow = true;
    lettuceBase.receiveShadow = true;
    head.add(lettuceBase);

    const frillCount = 16;
    const frillCenterY = lettuceY + LETTUCE_H * 0.62;
    const frillR = 0.1 * (LETTUCE_FRILL_R / 0.68);
    for (let i = 0; i < frillCount; i++) {
      const a = (i / frillCount) * Math.PI * 2;
      const wobble = ((i % 3) * 0.025 - 0.025) * (LETTUCE_FRILL_R / 0.68);
      const frill = new THREE.Mesh(new THREE.SphereGeometry(frillR, 8, 8), i % 2 === 0 ? lettuceMatA : lettuceMatB);
      frill.name = 'lettuce_frill';
      frill.position.set(Math.cos(a) * LETTUCE_FRILL_R, frillCenterY + wobble, Math.sin(a) * LETTUCE_FRILL_R);
      frill.scale.set(1, 0.5, 0.85);
      frill.rotation.y = a;
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
    const seedSpots: Array<[number, number]> = [
      [0.0, 0.82], [0.5, 0.76], [-0.5, 0.76], [1.0, 0.68], [-1.0, 0.68],
      [1.5, 0.56], [-1.5, 0.56], [2.1, 0.46], [-2.1, 0.46], [2.7, 0.55],
      [-2.7, 0.55], [3.1, 0.72], [Math.PI, 0.62], [2.4, 0.84], [-2.4, 0.84], [0.2, 0.6],
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

    // ── Face — closed happy eyes + small smile ──────────────────────────────
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

    for (const sx of [-1, 1]) {
      const faceSideG = addCrownDecal(face, CROWN, sx * 0.33, 0.5, 0.014 * faceScale);

      // Eye — closed happy "^" arc. Tube/curve radius held IDENTICAL between
      // sides so the two eyes carry equal visual weight; only the arc length
      // varies (right squints a touch tighter), reading as a deliberate
      // half-wink rather than one eye being malformed.
      const eyeArc = sx > 0 ? Math.PI * 0.66 : Math.PI * 0.74;
      const eyeG = new THREE.Group();
      eyeG.position.set(0, -0.125 * faceScale, 0);
      faceSideG.add(eyeG);
      const eye = new THREE.Mesh(faceArc(0.12 * faceScale, 0.028 * faceScale, eyeArc), faceMat);
      eye.name = 'eye';
      eye.rotation.z = Math.PI / 2; // bulge upward: closed happy "^" eye
      eye.castShadow = true;
      eye.receiveShadow = true;
      eyeG.add(eye);

      // Eyebrow — offset along the SAME local Y the eye is offset along, so the
      // gap between them is fixed and cannot collapse regardless of dome
      // curvature. Cocked higher on the right than the left for a
      // one-eyebrow-raised personality. Thickened and cocked further than the
      // original pass — a second independent art-director round named facial
      // acting as the single biggest appeal gap across the cast, and this face
      // was singled out as the one to keep rather than replace, so the brow gets
      // more read (bolder arc, stronger raise) without changing its shape language.
      const browG = new THREE.Group();
      browG.position.set(0, 0.13 * faceScale, 0.012 * faceScale);
      faceSideG.add(browG);
      const brow = new THREE.Mesh(faceArc(0.09 * faceScale, 0.026 * faceScale, Math.PI * 0.36), faceMat);
      brow.name = 'brow';
      brow.rotation.z = sx > 0 ? 0.32 : 0.05;
      brow.castShadow = true;
      brow.receiveShadow = true;
      browG.add(brow);

      const blushG = addCrownDecal(face, CROWN, sx * 0.6, 0.3, 0.004 * faceScale);
      const blush = new THREE.Mesh(new THREE.CircleGeometry(0.068 * faceScale, 16), blushMat);
      blush.name = 'blush__no_outline';
      blush.userData.noOutline = true;
      blushG.add(blush);
    }

    // Mouth — kept off-centre with the whole arc tilted, so the small closed
    // smile reads as a one-sided smirk (playful short-order cook) instead of a
    // perfectly symmetric "u".
    const mouthG = addCrownDecal(face, CROWN, -0.05, 0.25, 0.014 * faceScale);
    const mouth = new THREE.Mesh(faceArc(0.13 * faceScale, 0.028 * faceScale, Math.PI * 0.54), faceMat);
    mouth.name = 'mouth';
    mouth.rotation.z = -Math.PI / 2 + 0.16; // bulge down-and-tilted: smirk, not a flat "u"
    mouth.castShadow = true;
    mouth.receiveShadow = true;
    mouthG.add(mouth);

    // ── Body: dress the torso with the bottom bun ─────────────────────────────
    // The strongest characters in this cast extend their food mass down through
    // the body rather than perching a themed head on a generic one — Hamburger
    // is the character that proved that read richest in the first place (a real
    // stacked burger, not a food-headed mannequin), so its bottom bun becomes
    // the torso itself via the rig's own `dressTorso`.
    this.rig.dressTorso((size) => {
      const group = new THREE.Group();
      group.name = 'bottom_bun';
      const bunR = size.w * 0.58;
      const bunH = size.h * 1.02;
      const bottomBun = new THREE.Mesh(roundedPuck(bunR, bunH, bunR * 0.28), bunDarkMat);
      bottomBun.name = 'bottom_bun_mesh';
      bottomBun.position.y = size.h * 0.02;
      bottomBun.castShadow = true;
      bottomBun.receiveShadow = true;
      group.add(bottomBun);
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
    const mittMat = toonMat({ color: PALETTE.bun, roughness: 0.68 });
    const mittSeedMat = toonMat({ color: PALETTE.cream, roughness: 0.75 });
    this.rig.dressLimbs((part, size) => {
      switch (part) {
        case 'upperArmL': case 'upperArmR':
        case 'thighL': case 'thighR': {
          const geo = taperedSegment(size.len, size.radius * 1.2, size.radius * 0.84, 10);
          const m = new THREE.Mesh(geo, bunMat);
          m.name = `${part}_mesh`;
          m.castShadow = true;
          m.receiveShadow = true;
          return m;
        }
        case 'forearmL': case 'forearmR':
        case 'shinL': case 'shinR': {
          const geo = taperedSegment(size.len, size.radius * 0.84, size.radius * 0.64, 10);
          const m = new THREE.Mesh(geo, bunDarkMat);
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
          foot.position.set(0, -footH, footR * 0.32);
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

    // ── Spatula prop — gripped in the right fist ────────────────────────────
    // The roster's one distinctive silhouette landmark, and what a Patty Smash
    // swing actually reads as swinging. Attached to the rig's own `handR` joint
    // so it inherits the shared shoulder→elbow→hand animation for free instead
    // of needing its own bespoke arm.
    const spatula = new THREE.Group();
    spatula.name = 'spatula';
    // Offset toward the outer side of the mitt (sx-biased) rather than dead
    // centre through it — gripping through the palm's centre made the dark
    // handle cross straight over the pale mitt sphere, coincidentally reading
    // as a second, misplaced limb.
    // Offset only slightly from the palm centre. It was previously pushed 0.16 out
    // — about a full hand-radius — which worked against the old ball hand but left
    // the prop visibly floating in mid-air once the hand became a smaller bun-cap
    // mitt. A held prop must overlap the hand geometry, not merely start near it.
    spatula.position.set(0.05, -0.02, 0.06);
    spatula.rotation.set(-0.5, 0.35, -0.4);
    this.rig.joints.handR.add(spatula);

    const handle = new THREE.Mesh(new THREE.CapsuleGeometry(0.055, 0.42, 4, 8), spatulaHandleMat);
    handle.name = 'spatula_handle';
    // Lowered so the handle's bottom end passes THROUGH the mitt rather than
    // beginning at its surface — that overlap is what sells the grip.
    handle.position.set(0, 0.15, 0);
    handle.castShadow = true;
    handle.receiveShadow = true;
    spatula.add(handle);

    const blade = new THREE.Mesh(roundedBox(0.4, 0.05, 0.5, 0.09, 3), spatulaBladeMat);
    blade.name = 'spatula_blade';
    blade.position.set(0, 0.46, 0.06);
    blade.rotation.x = 0.3;
    blade.castShadow = true;
    blade.receiveShadow = true;
    spatula.add(blade);

    // Outline: a whisper, per render/toon.ts — the reference bar carries almost
    // no ink line.
    outlineGroup(this.root, OUTLINE_THIN);
    this.collectFlashTargets();
    this.rig.restPose();
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
