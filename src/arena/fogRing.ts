/**
 * The closing-fog boundary — the world-space visual for `MatchState.safeRadius`.
 *
 * ── Why this file exists ────────────────────────────────────────────────────────
 *
 * `sim.ts` applies `FOG_DAMAGE` (15) every `FOG_TICK_MS` (300) to any fighter whose
 * distance from `arena.center` exceeds `state.safeRadius` — 50 HP/s against 100-150
 * HP pools, i.e. death in 2-3 seconds. Until this module existed there was NO
 * renderer for `safeRadius` anywhere in the project: no ring, no wall, no HUD, no
 * tint. A player being killed by the fog saw only the generic violet impact burst,
 * which is indistinguishable from being shot, and had no way at all to tell where
 * the safe zone was. That is a gameplay bug, not a polish item.
 *
 * ── The read this has to deliver ────────────────────────────────────────────────
 *
 * 1. INSIDE vs OUTSIDE must be unambiguous from one frame, at gameplay distance.
 * 2. It must not be mistakable for a hazard puddle (small, orange/blue, flat) or for
 *    a cover prop (opaque, near-black plum plinth, hard silhouette).
 * 3. It must not read as decoration — it has to look lethal.
 *
 * So the boundary is drawn as THREE cooperating layers, not one ring:
 *
 *   A. CREST — a ground band (`GROUND_RINGS`, at `GROUND_Y`) whose inner edge sits
 *      exactly on `safeRadius`: the crisp bright line you must not cross, drawn on
 *      the floor where the line actually is.
 *   B. CURTAIN — a translucent, vertically-streaked wall standing on that same edge.
 *      Ground decals vanish at a 58-degree pitch the moment they are more than a
 *      couple of hundred world units away; a wall with real height keeps poking into
 *      frame from much further out, and gives the boundary a silhouette no flat
 *      hazard decal in this arena has.
 *   C. CANOPY — the danger field (`CANOPY_RINGS`, at `CANOPY_Y`), a horizontal plane
 *      ABOVE the props covering everything outside the boundary. This is what makes
 *      "outside" a PLACE rather than a line: you can be standing in the middle of a
 *      dimmed violet field with the boundary off screen and still know instantly that
 *      you are in the wrong half of the map. It is above the props rather than on the
 *      floor for a measured reason — read `CANOPY_Y`.
 *
 * Objective acceptance test this is tuned against (measured, not judged by eye —
 * shoot the same frame twice, once with `?fogRadius=` set and once with it far larger
 * than the map, and difference the two):
 *
 *   - every surface OUTSIDE the boundary, floor and raised prop alike, drops >= 30%
 *     in luminance and shifts toward one hue. Currently -39% (a bright cyan counter
 *     top) and -40% (pale floor pad).
 *   - every surface INSIDE the boundary is bit-for-bit unchanged. Currently 0.0%.
 *     The fog must never degrade the half of the map you are supposed to fight in.
 *
 * ── Traps this file is deliberately built around ────────────────────────────────
 *
 * - Floor pads/mats in `floor.ts` are opaque and depth-writing at y = 0.045-0.062,
 *   and `FLOOR_Y.decal`/`FLOOR_Y.fine` (0.15 / 0.25) sit above them. Anything drawn
 *   on the ground below those is invisible. The crest band therefore sits at
 *   `GROUND_Y = 0.34`, clear of every one of them.
 * - Transparent materials that do not set `depthWrite: false` still write depth and
 *   silently occlude whatever is behind them. Every material here sets it.
 * - Both fields are real annuli (a hole at `safeRadius`), never a full disc with a
 *   fade, so a fighter inside the zone is never tinted "a bit dangerous".
 * - No `rotation.x` + `rotation.y` composition anywhere: both ring meshes are authored
 *   directly in the XZ plane, so there is no Euler-order trap to fall into.
 * - A ground-plane tint reaches the FLOOR and nothing standing on it. That was this
 *   module's own first bug and it is the reason `CANOPY_Y` exists.
 */

import * as THREE from 'three';
import { wu, groundPos, CHARACTER_HEIGHT } from '../units';
import { ARENA_HALF_DIAGONAL, APRON_OUT } from './shared';

// ─────────────────────────────────────────────────────────────────────────────
// Look
// ─────────────────────────────────────────────────────────────────────────────

/**
 * Violet, the one hue family nothing else in the arena uses.
 *
 * Deliberately matched to `match.ts`'s existing `case 'fog': '#B98CE6'` damage tint,
 * so the boundary, the damage feedback and the HUD all speak with one colour. It is
 * also maximally far from the two colours that already mean something on this floor:
 * hazard amber/black caution (`KPAL.hazard*`) and puddle blue (`KPAL.water`).
 * Authored as wanted, NOT pre-compensated: `stage.ts`'s grade (2026-08-04) now
 * reproduces hue within ~4 degrees and is monotone in saturation, so guessing against
 * the old clipping chain would put these somewhere nobody chose.
 *
 * ── Value direction is load-bearing ─────────────────────────────────────────────
 *
 * The first pass made the danger field a hot magenta, so the lethal half of the map
 * came out BRIGHTER than the safe half and the whole frame read as a colour filter
 * rather than as a place you must not stand. `FIELD_COLOR` is now near-black violet
 * at moderate alpha, so outside is DARK and inside stays the bright, legible,
 * inviting half — the same direction PUBG's blue wall and Fortnite's storm use, and
 * the only one that lets the arena's own colour survive underneath.
 */
const CREST_COLOR = 0xF7D3FF;
const CREST_INNER = 0xE07BF5;
const WALL_COLOR = 0xC46BEE;
const FIELD_COLOR = 0x2A0B47;

/** Ground annulus height, in metres. Clears every opaque floor pad and decal layer. */
const GROUND_Y = 0.34;

/**
 * Height of the DANGER CANOPY, in metres — the fix for the single worst finding of
 * the first blind critic round.
 *
 * A tint painted on the ground plane darkens the FLOOR of the lethal region and
 * nothing else. Every cover prop standing out there — and the arena's brightest,
 * most eye-catching object is one of them — kept rendering at full albedo inside the
 * kill zone. Measured: identical pixels at both ends of a 500 px span that was
 * supposed to be deep in the fog. A critic seeing that frame cold said the death zone
 * "renders as four unrelated colours" and could not tell safe ground from lethal
 * ground, which is precisely the acceptance test this whole module exists to pass.
 *
 * So the field is now a horizontal plane ABOVE the props instead of below them, and
 * the floor, the props and any fighter out there are all seen THROUGH one convergent
 * tint. 3.2 m clears every cover prop in the arena and every character (2.1 m).
 *
 * The catch a horizontal plane brings is parallax: at height h it projects h/tan(pitch)
 * off the ground point beneath it. That is corrected exactly, per frame, from the
 * rig's own pitch and yaw — see the offset in `update()`. It is the reason `update()`
 * takes the camera angles rather than assuming 58 degrees.
 */
const CANOPY_Y = 3.2;

/**
 * Curtain height in metres — a CEILING now, not a constant. See `curtainHeight()`.
 *
 * Tall enough to stay in frame from well outside the guaranteed view radius, faint
 * enough up top that it never hides a fighter.
 */
const WALL_HEIGHT_MAX_M = 6.5;

/**
 * Curtain height for a given ring radius, and the reason it stopped being a constant.
 *
 * `rules.ts` gained `MIN_SAFE_RADIUS = 140`, so the ring now STOPS at 7 m instead of
 * closing to nothing. This module was authored and measured when the ring spent every
 * match between 400 and 990 wu, and its header commits to an objective acceptance
 * test: *"every surface INSIDE the boundary is bit-for-bit unchanged. Currently
 * 0.0%."* Re-run across the ring's whole range (`tools/tmp/vfx_finalring.mjs`, which
 * toggles just the curtain and unprojects every changed pixel back onto the ground
 * plane to ask whether it landed inside the boundary):
 *
 *     safeRadius   curtain px   of which INSIDE the boundary
 *          990          0            0     ( 0.0% )
 *          600          0            0     ( 0.0% )
 *          400       5953           24     ( 0.4% )
 *          260      38631          249     ( 0.6% )
 *          180      55410         1593     ( 2.9% )
 *          140      57201        10307     (18.0% )   <-- MIN_SAFE_RADIUS
 *
 * After this function, same probe, same stations:
 *
 *     safeRadius   curtain px   INSIDE      change
 *          400       5948           25      cap still binds, untouched
 *          260      24032          263      ~flat
 *          180      14860          448      -72%
 *          140       8366         1306      -87%   (2.9% of frame -> 0.36%)
 *
 * **At the final ring the boundary repaints 10,307 pixels of SAFE GROUND** — 2.9% of
 * the whole frame. The test passes everywhere the ring used to go and fails at the
 * one radius that is new.
 *
 * The cause is proportion, not position, and it is geometry rather than taste: a
 * vertical wall of height h standing at radius r, seen from a camera pitched p, has
 * its top edge project INWARD by `h / tan(p)`. At p = 58 deg that is 0.625h — a fixed
 * 4.06 m for a 6.5 m wall. Against a 49.5 m radius that annulus is 8% of the safe
 * disc and invisible; against a 7 m radius it is 58% of it, so the wall swallows most
 * of the ground the player is supposed to be standing on.
 *
 * Tying the height to the radius holds that ratio constant instead. The floor is one
 * CHARACTER_HEIGHT: a barrier shorter than a fighter stops reading as a barrier, and
 * it is the natural unit for "how tall does a wall have to be to mean something in
 * this game". The 0.30 factor makes the ceiling bind at r >= 21.7 m (433 wu), so
 * **nothing changes for the first ~78% of a match** — this only ever engages in the
 * endgame the constant was never measured against.
 *
 * Nothing is lost by shortening it there, either. The curtain exists to give the
 * boundary a SILHOUETTE that survives at distance, when the crest band on the floor
 * has foreshortened away; at the final ring the whole boundary is on screen at once
 * and the crest is doing that job directly.
 */
function curtainHeight(radiusM: number): number {
  return THREE.MathUtils.clamp(radiusM * 0.30, CHARACTER_HEIGHT, WALL_HEIGHT_MAX_M);
}

/**
 * Seconds the whole boundary takes to fade out when it stops being active.
 *
 * It used to disappear in a single frame, because `update()`'s `active` flag is
 * `phase === 'playing'` and nothing interpolated it. That was fine when a match could
 * only end in a knockout at a wide radius, where the fog owned a sliver of the frame.
 * Two sim changes broke it together: `resolveTimeout` means a match can now end on the
 * clock with both fighters alive, and it ends at `MIN_SAFE_RADIUS` — where the
 * boundary is measured to be carrying **21.4% of the frame's luminance** (hide
 * `fog_boundary` and the frame brightens by that much; 12.7% at 180 wu, 1.4% at 260,
 * 0.0% at 600 and beyond, where the ring is off screen). Deleting a fifth of the
 * frame's light in a single frame reads as a rendering fault, not as a match ending.
 *
 * Deliberately asymmetric: the fade only applies on the way OUT. Fading the boundary
 * IN would mean the first moments of lethal ground are drawn as not-quite-lethal, and
 * a zone visual may never under-state danger.
 */
const FADE_OUT_SECONDS = 0.5;

/** Ring resolution. 128 keeps the inner edge visually smooth at r = 850 wu. */
const SEG = 128;

/**
 * How far out the danger field is drawn, in world units.
 *
 * ⚠️ **THIS WAS `const FIELD_OUTER_UNITS = 1500` AND ITS OWN COMMENT SAID WHY IT WAS
 * WRONG. The old wording, kept because it was TRUE when it was written and quietly stopped
 * being true:**
 *
 *   > *"How far out the danger field is drawn, in world units. The arena's half-diagonal
 *   > is ~860, so this covers every corner plus the cosmetic-bleed apron beyond it."*
 *
 * **860.2 is the 1400×1000 half-diagonal.** The arena went ×4 in area on 2026-08-11
 * (`DECISIONS §48`) and the half-diagonal doubled to **1720.47** — so a literal 1500 stopped
 * covering the corners the sentence promised, while the sentence itself still read as a
 * justification. 🚨 **`779dc62`'s commit message repeats the false claim** — *"the canopy's
 * outer ring is `max(FIELD_OUTER_UNITS, r + 200)` = 1500 wu, so the danger field still
 * covers every corner of a 2800×2000 map"* — so the log is wrong too, and the correction
 * lives in the commit that carries this change rather than being made silently.
 *
 * ── What it cost, measured rather than reasoned about (`sx_fog.mjs`) ────────────
 *
 * **7,413 of 228,319 standable cells (3.25%) sat outside the canopy** — 3.25% of the map on
 * which sudden death is **100% lethal and looks completely safe**. Mean canvas luma, sudden
 * death against a wide ring at the same position: centre **120.0 → 42.9** (−77.1) · mid
 * **136.8 → 74.3** (−62.6) · **corner 77.8 → 64.9 (−12.9)**. The centre drop is the positive
 * control that proves the instrument sees the canopy at all. The corner frame was
 * `f87d407`'s own defect signature back again: HUD reading *"▲ OUTSIDE THE ZONE −50 HP/s"*,
 * a "RUN TO THE ZONE" arrow, the radar saying "GET INSIDE" — and the fighter standing on
 * bright, fully-lit floor.
 *
 * ── DERIVED, because a literal 1721 is the same bug one map change later ────────
 *
 * The requirement is not "reach the corners", it is **"reach past everything the camera can
 * show"**, and both terms of that are already named constants that move with the map:
 *
 *   `ARENA_HALF_DIAGONAL`  the furthest point of the playfield (1720.47).
 *   `APRON_OUT`            how far the apron's service floor runs past every bound (760),
 *                          itself solved from `camera.ts`'s worst-case ground reach of
 *                          470 wu with margin. Nothing is ever drawn beyond it.
 *
 * So `ARENA_HALF_DIAGONAL + APRON_OUT` = **2480.47 wu** is the radius that contains every
 * drawn surface in every direction. It DOMINATES the true worst case with room to spare:
 * the furthest a fighter can stand is `hypot(W/2 − 21, H/2 − 21)` = **1691.2 wu** (the
 * bounds clamp is half a body), and the camera reaches at most 470 wu past them, so no
 * ground pixel outside **2161.2 wu** can ever be on screen — 319 wu of margin.
 *
 * ⚠️ **Widening the annulus costs no vertices and no draw calls.** `SEG × rings` is
 * unchanged, the outer band is a single flat-alpha ring, and fragments outside the viewport
 * are clipped by the rasteriser — so this is the same mesh reaching further, not more mesh.
 * `setRadius` already computes `max(FIELD_OUTER_UNITS, safeRadius + 200)`, so at the opening
 * ring (1985) the field was ALREADY 2185 wu wide; only the small-radius end was short, which
 * is why nothing caught it until sudden death made radius 0 reachable.
 */
const FIELD_OUTER_UNITS = ARENA_HALF_DIAGONAL + APRON_OUT;

/**
 * One ring of an annulus profile, ordered inner to outer, positioned in world units
 * RELATIVE to `safeRadius` (`absolute` overrides that — used only for the outer rim
 * of the danger field). RGBA is per-ring and constant, so only positions are
 * rewritten per frame.
 */
interface RingSpec {
  /** Offset from `safeRadius`, world units. `absolute` overrides it. */
  offset: number;
  absolute?: number;
  color: number;
  alpha: number;
}

/**
 * GROUND band, at `GROUND_Y`. Carries the EDGE — the crisp bright line you must not
 * cross — plus a light floor stain that hides the seam where the canopy above it
 * starts. It deliberately does NOT carry the bulk of the darkening any more; that is
 * the canopy's job, because a ground tint cannot reach anything standing up off the
 * ground.
 */
const GROUND_RINGS: RingSpec[] = [
  // Ring 0 sits slightly INSIDE the boundary at zero alpha: it gives the crest
  // something to fade out of on the safe side, so the band reads as a glow riding the
  // line rather than as a second, softer line of its own.
  { offset: -14, color: CREST_COLOR, alpha: 0.0 },
  { offset: -1, color: CREST_COLOR, alpha: 0.9 },
  { offset: 7, color: CREST_INNER, alpha: 0.85 },
  { offset: 34, color: 0x5A1E8C, alpha: 0.3 },
  { offset: 150, color: FIELD_COLOR, alpha: 0.18 },
  { offset: 0, absolute: FIELD_OUTER_UNITS, color: FIELD_COLOR, alpha: 0.18 },
];

/**
 * DANGER CANOPY, at `CANOPY_Y`. One convergent tint over everything outside the
 * boundary — floor, cover props, fighters.
 *
 * The alpha ramp starts 12 wu OUTSIDE the boundary and needs ~30 wu to reach full,
 * on purpose: the parallax correction is exact only for a camera at infinity, so a
 * few world units of residual misregistration exist near the bottom of the frame.
 * A soft ramp puts that error inside a gradient instead of on a hard edge, and
 * starting outside the line guarantees the error can only ever under-tint lethal
 * ground, never tint SAFE ground.
 */
const CANOPY_RINGS: RingSpec[] = [
  { offset: 12, color: FIELD_COLOR, alpha: 0.0 },
  { offset: 44, color: FIELD_COLOR, alpha: 0.6 },
  { offset: 140, color: FIELD_COLOR, alpha: 0.72 },
  { offset: 0, absolute: FIELD_OUTER_UNITS, color: FIELD_COLOR, alpha: 0.72 },
];

// ─────────────────────────────────────────────────────────────────────────────
// Curtain texture
// ─────────────────────────────────────────────────────────────────────────────

/**
 * Vertical-streak curtain: opaque along the ground, fading to nothing overhead.
 *
 * The alpha ramp is the whole point. A uniformly translucent 8 m wall would grey out
 * a third of the frame and hide fighters standing beyond it; a wall that is dense in
 * its bottom ~2 m and a whisper above that still reads as a solid barrier from a
 * pitched camera (the dense part is what the eye tracks) while leaving the upper
 * frame legible.
 *
 * The streaks are pure high-frequency alpha noise in `u` only — no landmark, nothing
 * recognisable, because ANY recognisable mark in a tiling texture becomes a visible
 * repeat, and this texture repeats ~50 times around the circumference.
 */
function makeCurtainTexture(): THREE.CanvasTexture {
  const W = 64;
  const H = 256;
  const canvas = document.createElement('canvas');
  canvas.width = W;
  canvas.height = H;
  const ctx = canvas.getContext('2d')!;
  const img = ctx.createImageData(W, H);

  // Deterministic streak weights, so the wall looks identical run to run.
  let seed = 0x9e3779b9;
  const rnd = () => {
    seed = (seed * 1664525 + 1013904223) >>> 0;
    return seed / 0xffffffff;
  };
  // Wide contrast range on purpose: at 0.55-1.0 the streaks were measured invisible
  // at gameplay distance and the curtain read as a flat gradient, which is exactly
  // the "it IS rendering, it is just not readable" failure this project keeps hitting.
  const streak = new Float32Array(W);
  for (let x = 0; x < W; x++) streak[x] = 0.18 + 0.82 * rnd();

  for (let y = 0; y < H; y++) {
    // CanvasTexture flips Y, so canvas row 0 lands at v = 1 = the TOP of the cylinder.
    const v = 1 - y / (H - 1);
    // Dense base, fast falloff, long faint haze: 1.0 at the floor, ~0.45 at 2 m,
    // ~0.12 at 4 m, 0 at the top.
    const ramp = Math.pow(1 - v, 2.6);
    for (let x = 0; x < W; x++) {
      // Slow vertical wobble so the streaks are not perfect columns.
      const wobble = 0.85 + 0.15 * Math.sin(x * 0.9 + v * 5.0);
      const a = Math.max(0, Math.min(1, ramp * streak[x] * wobble));
      const i = (y * W + x) * 4;
      // Whiter toward the base, so the wall's foot reads as the hottest part of it.
      const heat = Math.pow(1 - v, 3);
      img.data[i] = 255;
      img.data[i + 1] = Math.round(190 + 65 * heat);
      img.data[i + 2] = 255;
      img.data[i + 3] = Math.round(a * 255);
    }
  }
  ctx.putImageData(img, 0, 0);

  const tex = new THREE.CanvasTexture(canvas);
  tex.wrapS = THREE.RepeatWrapping;
  tex.wrapT = THREE.ClampToEdgeWrapping;
  tex.needsUpdate = true;
  return tex;
}

// ─────────────────────────────────────────────────────────────────────────────
// Annulus builder — one dynamic ring mesh, shared by the ground band and the canopy
// ─────────────────────────────────────────────────────────────────────────────

interface Annulus {
  mesh: THREE.Mesh;
  setRadius(safeRadiusUnits: number): void;
  /** Scale every baked per-vertex alpha by `k` — the material `opacity` uniform
   * multiplies `vColor.a` under `USE_COLOR_ALPHA`, so one number fades the whole
   * band without rewriting the colour attribute. Used by the end-of-match fade. */
  setOpacity(k: number): void;
  dispose(): void;
}

/**
 * A concentric ring-strip mesh whose radii are rewritten every frame from
 * `safeRadius`. Colour and alpha are per-ring and baked once (itemSize-4 colour
 * attribute => three.js `USE_COLOR_ALPHA`), so the per-frame cost is a few hundred
 * floats.
 */
function buildAnnulus(specs: RingSpec[], y: number, renderOrder: number, name: string): Annulus {
  const vertCount = specs.length * SEG;
  const positions = new Float32Array(vertCount * 3);
  const colors = new Float32Array(vertCount * 4);
  const indices: number[] = [];

  const cosT = new Float32Array(SEG);
  const sinT = new Float32Array(SEG);
  for (let i = 0; i < SEG; i++) {
    const t = (i / SEG) * Math.PI * 2;
    cosT[i] = Math.cos(t);
    sinT[i] = Math.sin(t);
  }

  const tmp = new THREE.Color();
  for (let r = 0; r < specs.length; r++) {
    tmp.setHex(specs[r].color);
    for (let i = 0; i < SEG; i++) {
      const v = r * SEG + i;
      positions[v * 3 + 1] = 0; // height lives on the mesh, not the vertices
      colors[v * 4] = tmp.r;
      colors[v * 4 + 1] = tmp.g;
      colors[v * 4 + 2] = tmp.b;
      colors[v * 4 + 3] = specs[r].alpha;
    }
  }
  for (let r = 0; r < specs.length - 1; r++) {
    for (let i = 0; i < SEG; i++) {
      const j = (i + 1) % SEG;
      indices.push(r * SEG + i, (r + 1) * SEG + i, r * SEG + j);
      indices.push(r * SEG + j, (r + 1) * SEG + i, (r + 1) * SEG + j);
    }
  }

  const geo = new THREE.BufferGeometry();
  const posAttr = new THREE.BufferAttribute(positions, 3);
  posAttr.setUsage(THREE.DynamicDrawUsage);
  geo.setAttribute('position', posAttr);
  geo.setAttribute('color', new THREE.BufferAttribute(colors, 4));
  geo.setIndex(indices);
  // Hand-authored: positions are rewritten every frame, so an auto-computed sphere
  // would be sized to whatever radius happened to be there on the first frame.
  geo.boundingSphere = new THREE.Sphere(new THREE.Vector3(), wu(FIELD_OUTER_UNITS) * 1.2);

  const mat = new THREE.MeshBasicMaterial({
    vertexColors: true,
    transparent: true,
    depthWrite: false, // MUST stay false — see the header note.
    side: THREE.DoubleSide,
    toneMapped: false,
  });

  const mesh = new THREE.Mesh(geo, mat);
  mesh.name = `${name}__no_outline`;
  mesh.userData.noOutline = true;
  mesh.renderOrder = renderOrder;
  mesh.frustumCulled = false;
  mesh.castShadow = false;
  mesh.receiveShadow = false;
  mesh.position.y = y;

  return {
    mesh,
    setRadius(safeRadiusUnits: number) {
      for (let r = 0; r < specs.length; r++) {
        const spec = specs[r];
        const ru = spec.absolute !== undefined
          ? Math.max(spec.absolute, safeRadiusUnits + 200)
          : Math.max(0, safeRadiusUnits + spec.offset);
        const rm = wu(ru);
        const base = r * SEG;
        for (let i = 0; i < SEG; i++) {
          const v = (base + i) * 3;
          positions[v] = cosT[i] * rm;
          positions[v + 2] = sinT[i] * rm;
        }
      }
      posAttr.needsUpdate = true;
    },
    setOpacity(k: number) {
      mat.opacity = k;
    },
    dispose() {
      geo.dispose();
      mat.dispose();
    },
  };
}

// ─────────────────────────────────────────────────────────────────────────────

export interface FogRing {
  /** Add this to the scene once. */
  readonly root: THREE.Group;
  /**
   * Drive the boundary from the sim.
   *
   * @param safeRadiusUnits `MatchState.safeRadius`, world units.
   * @param elapsedSeconds  wall-clock seconds, for the curtain drift/pulse.
   * @param active          false during countdown / after the match ends, which hides
   *                        the whole thing rather than showing a boundary that is not
   *                        yet dealing damage.
   * @param camera          the rig's current pitch/yaw in DEGREES. Required, not
   *                        optional: the canopy's alignment is a function of them
   *                        (see `CANOPY_Y`), so a stale angle silently mis-registers
   *                        the whole danger field against its own boundary line.
   */
  update(
    safeRadiusUnits: number,
    elapsedSeconds: number,
    active: boolean,
    camera: { pitchDeg: number; yawDeg: number },
  ): void;
  dispose(): void;
}

export function createFogRing(centerUnits: { x: number; y: number }): FogRing {
  const root = new THREE.Group();
  root.name = 'fog_boundary';
  const c = groundPos(centerUnits.x, centerUnits.y);
  root.position.set(c.x, 0, c.z);
  // Map-scale and always relevant; never let a stale bounding sphere cull it.
  root.frustumCulled = false;

  const ground = buildAnnulus(GROUND_RINGS, GROUND_Y, 6, 'fog_edge');
  const canopy = buildAnnulus(CANOPY_RINGS, CANOPY_Y, 8, 'fog_canopy');
  root.add(ground.mesh);

  // ── The curtain ────────────────────────────────────────────────────────────
  const curtainTex = makeCurtainTexture();
  const wallGeo = new THREE.CylinderGeometry(1, 1, 1, SEG, 1, true);
  const wallMat = new THREE.MeshBasicMaterial({
    map: curtainTex,
    color: WALL_COLOR,
    transparent: true,
    opacity: 0.82,
    depthWrite: false, // MUST stay false — see the header note.
    side: THREE.DoubleSide,
    toneMapped: false,
  });
  const wall = new THREE.Mesh(wallGeo, wallMat);
  wall.name = 'fog_curtain__no_outline';
  wall.userData.noOutline = true;
  wall.renderOrder = 7;
  wall.frustumCulled = false;
  wall.castShadow = false;
  wall.receiveShadow = false;
  root.add(wall);

  root.add(canopy.mesh);

  // End-of-match fade state — see `FADE_OUT_SECONDS`. `lastElapsed` tracks the real
  // clock `update()` is handed so the ramp is time-based rather than frame-based
  // (SwiftShader runs at a few fps here and a real device at 60; a per-frame decrement
  // would fade over wildly different durations on the two).
  let fade = 0;
  let lastElapsed = 0;

  return {
    root,

    update(safeRadiusUnits, elapsedSeconds, active, camera) {
      // Clamp the delta: the first call after a match starts, and any tab-visibility
      // stall, hands over a huge jump. (`docs/LESSONS.md` §12 records a negative first
      // rAF delta NaN-ing the portrait camera permanently — same class of trap.)
      const dt = Math.min(0.25, Math.max(0, elapsedSeconds - lastElapsed));
      lastElapsed = elapsedSeconds;

      // ⚠️ WAS `safeRadiusUnits > 0`, AND THAT TEST WAS A SHIPPED DEFECT.
      // It read as a guard against a degenerate radius. It is not: radius ZERO is the
      // one radius at which this boundary matters MOST — sudden death drives the ring
      // to exactly 0 and the canopy is then supposed to cover the whole arena. The old
      // test ramped the entire boundary OUT at that instant, so the fog disappeared at
      // the moment it was meant to swallow the screen, while the HUD still read
      // "OUTSIDE THE ZONE −50 HP/s". Measured on the shipped build, not inferred:
      // `?fogRadius=0&fogRingRaw=1` renders at mean luma 130.6 against a no-fog frame's
      // 132.3 — statistically the same picture — and 72.0 with the boundary actually
      // drawn. Before sudden death landed, radius 0 was unreachable in a real match,
      // which is why a wrong test survived: `MIN_SAFE_RADIUS` never let it fire.
      //
      // Zero is well-defined the whole way down and was checked rather than assumed:
      // `curtainHeight(0)` clamps to `CHARACTER_HEIGHT` (no NaN, no zero-height wall),
      // `setRadius(0)` writes a degenerate inner edge with no division anywhere, and the
      // canopy's outer ring is `max(FIELD_OUTER_UNITS, r + 200)`.
      //
      // 🚨 **THE SENTENCE THAT STOOD HERE WAS FALSE AND IS KEPT, BECAUSE IT IS THE SECOND
      // HALF OF THE SAME BUG:** *"= 1500 wu, so the danger field still covers every corner
      // of a 2800x2000 map."* It does not — that map's half-diagonal is 1720.47 and its
      // furthest standable cell is 1691.2 wu out, so **7,413 of 228,319 standable cells
      // (3.25%) were outside the canopy and lethal while looking safe.** The arithmetic was
      // done against the OLD map's 860 and never re-done; see `FIELD_OUTER_UNITS`, which is
      // now derived and is 2480.47 on this map. A NEGATIVE radius remains refused, which is
      // what a guard here should ever have meant.
      const wanted = active && safeRadiusUnits >= 0;
      // Snap ON, ramp OFF — a zone visual may never under-state danger, so it is only
      // ever allowed to be late to leave, never late to arrive.
      fade = wanted ? 1 : Math.max(0, fade - dt / FADE_OUT_SECONDS);

      root.visible = fade > 0.002;
      if (!root.visible) return;

      const safeR = Math.max(0, safeRadiusUnits);
      ground.setRadius(safeR);
      canopy.setRadius(safeR);
      ground.setOpacity(fade);
      canopy.setOpacity(fade);

      // Slide the canopy directly AWAY from the camera by height / tan(pitch), which
      // is exactly the amount that makes a point at `CANOPY_Y` project onto the same
      // screen pixel as the ground point below it. Without this the danger field's
      // inner edge lands metres away from the boundary line the player is actually
      // judged against — on the near side it would darken SAFE ground, which is the
      // one error a zone visual must never make.
      const pitch = THREE.MathUtils.degToRad(camera.pitchDeg);
      const yaw = THREE.MathUtils.degToRad(camera.yawDeg);
      const back = CANOPY_Y / Math.max(0.2, Math.tan(pitch));
      canopy.mesh.position.set(-Math.sin(yaw) * back, CANOPY_Y, -Math.cos(yaw) * back);

      const rm = wu(safeR);
      // Height is a function of the radius now — see `curtainHeight()` for the
      // measured reason (18% of the curtain's own pixels landed on SAFE ground at
      // MIN_SAFE_RADIUS with the old constant).
      const wallH = curtainHeight(rm);
      wall.scale.set(rm, wallH, rm);
      wall.position.y = wallH / 2;

      // Keep the streaks a roughly constant world size as the ring closes, so the
      // curtain never turns into either a smear or a picket fence, and drift them
      // slowly sideways so the wall is visibly alive in a still frame's neighbours.
      const circumferenceM = 2 * Math.PI * rm;
      curtainTex.repeat.x = Math.max(6, Math.round(circumferenceM / 5.0));
      curtainTex.offset.x = (elapsedSeconds * 0.035) % 1;

      // Slow breathing pulse — a static wall reads as scenery, a pulsing one reads as
      // a threat. Small enough that it never flickers into looking like a VFX hit.
      wallMat.opacity = (0.82 + 0.1 * Math.sin(elapsedSeconds * 2.1)) * fade;
    },

    dispose() {
      ground.dispose();
      canopy.dispose();
      wallGeo.dispose();
      wallMat.dispose();
      curtainTex.dispose();
      root.clear();
    },
  };
}
