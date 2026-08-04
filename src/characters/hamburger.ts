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
import { bodyType } from './bodies';

/**
 * Limb-only toasted-crust tones, a genuine value step below the bun.
 *
 * Kept out of `PALETTE` on purpose: this is a per-character separation between
 * the FOOD MASS and the BODY carrying it, not a shared ingredient colour. See
 * the palette block in the constructor for the defect that forced it.
 */
const LIMB_TOAST = '#B26E2A';
const LIMB_TOAST_DARK = '#8E5320';

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
      // Body: STOUT archetype (see `bodies.ts`) — short wide torso, thick short
      // limbs, low centre of mass, widest stance in the cast. Exactly the read
      // this character was hand-tuning toward before archetypes existed, so the
      // preset replaces those numbers rather than fighting them.
      //
      // `headFraction` runs high because the whole burger stack is sized off R
      // (see the vertical layout below): the food mass IS most of this character,
      // and the stack is what has to reach the cast's standard height.
      proportions: bodyType('stout', { height: 2.05, headFraction: 0.68 }),
      // Grill-master swagger: weight planted and leaning in over the flat-top,
      // one arm cocked back with the spatula ready, the other tucked in tight —
      // an art director's second pass named the cast's identical dead-front
      // symmetric pose as a top gap, and Hamburger's read (short-order cook,
      // mid-flip) is the most physically confident stance in this file's cast.
      stance: {
        shoulderL: 0.46, shoulderR: -0.58,
        elbowL: -0.95, elbowR: -0.22,
        twist: -0.12, headTilt: -0.07, headTurn: 0.20,
        hipSway: 0.06, lean: 0.06,
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
    // Metalness was 0.55 and the blade rendered as a near-BLACK wedge in every
    // shot — a metal with no strong environment reflection has almost no diffuse
    // term left to light, so the one prop that is supposed to be the roster's
    // silhouette landmark read as an axe head cut out of the sky. This is the
    // "rendering but invisible" failure in its dark-on-light costume. Steel is
    // now carried by a bright albedo and a tight specular, not by metalness.
    const spatulaBladeMat = toonMat({ color: '#E9EEF5', roughness: 0.3, metalness: 0.06 });
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
    const LETTUCE_BASE_R = R * 0.56;
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
    const lettuceBaseH = LETTUCE_H * 0.48;
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
      // Narrower than the crown above it, so the stack steps IN at the waist and
      // back OUT at the bottom bun instead of running straight down.
      const bunR = size.w * 0.53;
      const bunH = size.h * 1.02;
      const bottomBun = new THREE.Mesh(roundedPuck(bunR, bunH, bunR * 0.28), bunDarkMat);
      bottomBun.name = 'bottom_bun_mesh';
      bottomBun.position.y = size.h * 0.02;
      bottomBun.castShadow = true;
      bottomBun.receiveShadow = true;
      group.add(bottomBun);

      // ── Apron: the costume layer ─────────────────────────────────────────
      // Narrower and shorter than the first pass: the bib now covers the front
      // of the bun instead of wrapping most of its circumference, so the bun's
      // own gold reads at both sides and along the bottom and the burger keeps
      // its lowest layer.
      const apronR = bunR * 1.05;
      const apronArc = Math.PI * 0.50;
      const apronH = bunH * 0.70;
      const apronY = size.h * 0.02 + bunH * 0.06;
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
      for (const sx of [-1, 1] as const) {
        const strap = new THREE.Mesh(new THREE.CapsuleGeometry(apronR * 0.075, apronH * 0.5, 4, 8), apronMat);
        strap.name = 'apron_strap';
        const baseTheta = sx * apronArc * 0.42;
        strap.position.set(Math.sin(baseTheta) * apronR, apronY + apronH * 0.62, Math.cos(baseTheta) * apronR);
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
      const tieBase = new THREE.Vector3(Math.sin(tieTheta) * apronR * 1.03, apronY - apronH * 0.2, Math.cos(tieTheta) * apronR * 1.03);
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
    const mittMat = toonMat({ color: PALETTE.bun, roughness: 0.68 });
    const mittSeedMat = toonMat({ color: PALETTE.cream, roughness: 0.75 });
    const limbMat = toonMat({ color: LIMB_TOAST, ramp: RAMP_CHARACTER(), roughness: 0.85 });
    const limbDarkMat = toonMat({ color: LIMB_TOAST_DARK, ramp: RAMP_CHARACTER(), roughness: 0.85 });
    this.rig.dressLimbs((part, size) => {
      switch (part) {
        case 'upperArmL': case 'upperArmR':
        case 'thighL': case 'thighR': {
          const geo = taperedSegment(size.len, size.radius * 1.2, size.radius * 0.84, 10);
          const m = new THREE.Mesh(geo, limbMat);
          m.name = `${part}_mesh`;
          m.castShadow = true;
          m.receiveShadow = true;
          return m;
        }
        case 'forearmL': case 'forearmR':
        case 'shinL': case 'shinR': {
          const geo = taperedSegment(size.len, size.radius * 0.84, size.radius * 0.64, 10);
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
    spatula.position.set(0.06, -0.02, 0.10);
    spatula.rotation.set(-0.42, 0.26, -0.05);
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
    const slotGeo = new THREE.CircleGeometry(0.032, 14);
    for (const sy of [0.22, 0.40, 0.56]) {
      const slot = new THREE.Mesh(slotGeo, spatulaSlotMat);
      slot.name = 'spatula_slot__no_outline';
      slot.userData.noOutline = true;
      slot.position.set(0, sy, 0.017);
      blade.add(slot);
      const slotBack = new THREE.Mesh(slotGeo, spatulaSlotMat);
      slotBack.name = 'spatula_slot__no_outline';
      slotBack.userData.noOutline = true;
      slotBack.rotation.y = Math.PI;
      slotBack.position.set(0, sy, -0.017);
      blade.add(slotBack);
    }

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
