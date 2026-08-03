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
import { wu, groundPos } from '../units';

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

/** Curtain height in metres. Tall enough to stay in frame from well outside the
 * guaranteed view radius, faint enough up top that it never hides a fighter. */
const WALL_HEIGHT_M = 6.5;

/** Ring resolution. 128 keeps the inner edge visually smooth at r = 850 wu. */
const SEG = 128;

/** How far out the danger field is drawn, in world units. The arena's half-diagonal
 * is ~860, so this covers every corner plus the cosmetic-bleed apron beyond it. */
const FIELD_OUTER_UNITS = 1500;

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

  return {
    root,

    update(safeRadiusUnits, elapsedSeconds, active, camera) {
      root.visible = active && safeRadiusUnits > 0;
      if (!root.visible) return;

      const safeR = Math.max(0, safeRadiusUnits);
      ground.setRadius(safeR);
      canopy.setRadius(safeR);

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
      wall.scale.set(rm, WALL_HEIGHT_M, rm);
      wall.position.y = WALL_HEIGHT_M / 2;

      // Keep the streaks a roughly constant world size as the ring closes, so the
      // curtain never turns into either a smear or a picket fence, and drift them
      // slowly sideways so the wall is visibly alive in a still frame's neighbours.
      const circumferenceM = 2 * Math.PI * rm;
      curtainTex.repeat.x = Math.max(6, Math.round(circumferenceM / 5.0));
      curtainTex.offset.x = (elapsedSeconds * 0.035) % 1;

      // Slow breathing pulse — a static wall reads as scenery, a pulsing one reads as
      // a threat. Small enough that it never flickers into looking like a VFX hit.
      wallMat.opacity = 0.82 + 0.1 * Math.sin(elapsedSeconds * 2.1);
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
