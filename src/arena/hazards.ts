/**
 * Hazard visuals — this module owns everything drawn for the arena's three hazard
 * zones: the central boiling pot (body, broth, flame, steam wisps, bubbles — the
 * geometry only; their per-frame animation lives in `./ambient.ts`), its ground
 * marking (the scorched floor patch, the glow halo, and the black/amber caution-tape
 * ring traced exactly on the real damage boundary), and the grease/water slow-puddle
 * discs + their hazard-rim trim.
 *
 * None of these have a `CoverBox` — hazards are visual-only ground/area effects, not
 * collidable cover — so nothing here goes through `addCover`. The actual `HazardZone`
 * entries (radius, damage, slow factor) stay in `kitchen.ts`, which positions
 * everything this module builds to match those numbers exactly.
 */

import * as THREE from 'three';
import { flatMat, outlineGroup } from '../render/toon';
import { wu, groundPos } from '../units';
import { POT } from '../game/rules';
import { puck, mesh, noOutline, buildContactShadow, buildDirectionalShadowMesh, FLOOR_Y, KPAL, type Materials } from './shared';

// ─────────────────────────────────────────────────────────────────────────────
// Central pot assembly — the hazard's visual, kept separate from `addCover` since
// the pot has no collision box (matching the prototype: dangerRadius already keeps
// players well clear of the body before they'd ever touch it).
// ─────────────────────────────────────────────────────────────────────────────

export interface PotAssembly {
  group: THREE.Group;
  steam: THREE.Mesh[];
  bubbles: THREE.Mesh[];
  flame: THREE.Mesh;
  flameCore: THREE.Mesh;
}

export function buildPot(M: Materials): PotAssembly {
  const g = new THREE.Group();
  const bodyR = wu(POT.bodyRadius);
  const bodyH = bodyR * 0.95;

  const solid = new THREE.Group();
  solid.name = 'pot_solid';

  // Contact AO directly under the pot's own base — a tighter, darker ring than the
  // broad hazard scorch, so the heaviest object in the arena visibly presses into
  // the floor rather than floating on top of it.
  g.add(buildContactShadow(M.contactShadow, bodyR * 2.1, bodyR * 2.1, 1));
  // Baked directional shadow — the pot is the single tallest object in the arena and
  // has no CoverBox (so it never runs through `addCover`), but it's exactly the kind
  // of "hard geometry floating on the floor" prop the round-6 critic flagged, so it
  // gets the same treatment by hand. Never yawed, so no counter-rotation needed.
  g.add(buildDirectionalShadowMesh(M, Math.max(1.1, bodyH * 1.1), Math.max(0.6, bodyR * 0.85), 0, bodyR * 1.25));

  const base = mesh(puck(bodyR * 0.5, 0.06, 24), M.potMetalDark, 'pot_stove_base');
  base.position.y = 0.03;
  solid.add(base);

  const body = mesh(puck(bodyR, bodyH, 28), M.potMetal, 'pot_body');
  body.position.y = 0.06 + bodyH / 2;
  solid.add(body);

  const rim = mesh(new THREE.TorusGeometry(bodyR, bodyR * 0.06, 10, 28), M.potMetalDark, 'pot_rim');
  rim.rotation.x = Math.PI / 2;
  rim.position.y = 0.06 + bodyH;
  solid.add(rim);

  const broth = mesh(puck(bodyR * 0.88, 0.05, 28), M.broth, 'pot_broth');
  broth.position.y = 0.06 + bodyH + 0.01;
  noOutline(broth);
  solid.add(broth);

  for (const side of [-1, 1]) {
    const handle = mesh(new THREE.TorusGeometry(bodyR * 0.16, 0.025, 6, 12, Math.PI), M.potMetalDark, 'pot_handle');
    handle.rotation.set(0, side > 0 ? -Math.PI / 2 : Math.PI / 2, 0);
    handle.position.set(side * (bodyR + bodyR * 0.02), 0.06 + bodyH * 0.62, 0);
    solid.add(handle);
  }

  g.add(solid);

  // Flame licking out from under the rim — two overlapping unlit blobs, flicker
  // animated in update().
  const flameCore = mesh(new THREE.ConeGeometry(bodyR * 0.28, bodyR * 0.4, 10), M.flameCore, 'pot_flame_core__no_outline');
  flameCore.position.y = -0.02;
  noOutline(flameCore);
  g.add(flameCore);
  const flame = mesh(new THREE.ConeGeometry(bodyR * 0.42, bodyR * 0.6, 10), M.flame, 'pot_flame__no_outline');
  flame.position.y = -0.04;
  noOutline(flame);
  g.add(flame);

  // Steam — soft tapered blobs rising above the broth, reset by `update()`.
  const steam: THREE.Mesh[] = [];
  const steamMat = flatMat('#EDEDED', { transparent: true, opacity: 0.55 });
  const steamPositions: Array<[number, number]> = [
    [-bodyR * 0.4, 0], [0, bodyR * 0.05], [bodyR * 0.38, -bodyR * 0.05],
  ];
  for (const [sx, sz] of steamPositions) {
    const wisp = mesh(new THREE.ConeGeometry(bodyR * 0.16, bodyR * 0.5, 8, 1, true), steamMat, 'pot_steam__no_outline');
    noOutline(wisp);
    wisp.position.set(sx, 0.06 + bodyH + 0.2, sz);
    wisp.userData.baseY = wisp.position.y;
    g.add(wisp);
    steam.push(wisp);
  }

  // Bubbles on the broth surface.
  const bubbles: THREE.Mesh[] = [];
  const bubblePositions: Array<[number, number]> = [
    [-bodyR * 0.3, bodyR * 0.2], [bodyR * 0.15, bodyR * 0.35], [bodyR * 0.3, -bodyR * 0.15],
  ];
  for (const [sx, sz] of bubblePositions) {
    const bub = mesh(new THREE.SphereGeometry(bodyR * 0.08, 10, 8), M.broth, 'pot_bubble__no_outline');
    noOutline(bub);
    bub.position.set(sx, 0.06 + bodyH + 0.03, sz);
    g.add(bub);
    bubbles.push(bub);
  }

  outlineGroup(solid, 0.006);

  return { group: g, steam, bubbles, flame, flameCore };
}

// ─────────────────────────────────────────────────────────────────────────────
// Hazard ground treatment — the pot's danger radius, drawn as a scorched floor
// patch + a bright glow ring + drifting heat wisps, NOT a flat opaque disc. Every
// measurement is driven off `POT.dangerRadius` (the actual gameplay hazard radius
// from `game/rules.ts`), so the visual always matches exactly what hurts the player —
// only the drawing changed, not the hazard.
// ─────────────────────────────────────────────────────────────────────────────

/** Soft, organic dark wash + irregular char blotches — reads as scorched concrete,
 * not a coloured lid, and lets the tile pattern show through almost everywhere. */
function makeScorchTexture(): THREE.CanvasTexture {
  const size = 256;
  const canvas = document.createElement('canvas');
  canvas.width = canvas.height = size;
  const ctx = canvas.getContext('2d')!;
  const cx = size / 2, cy = size / 2;

  const base = ctx.createRadialGradient(cx, cy, 0, cx, cy, size * 0.5);
  base.addColorStop(0, 'rgba(58,26,14,0.5)');
  base.addColorStop(0.5, 'rgba(66,32,16,0.26)');
  base.addColorStop(0.78, 'rgba(74,38,18,0.08)');
  base.addColorStop(1, 'rgba(74,38,18,0)');
  ctx.fillStyle = base;
  ctx.fillRect(0, 0, size, size);

  let seed = 907;
  const rand = () => { seed = (seed * 48271) % 2147483647; return seed / 2147483647; };
  for (let i = 0; i < 16; i++) {
    const a = rand() * Math.PI * 2;
    const r = rand() * size * 0.42;
    const bx = cx + Math.cos(a) * r;
    const by = cy + Math.sin(a) * r;
    const br = size * (0.03 + rand() * 0.08);
    const g = ctx.createRadialGradient(bx, by, 0, bx, by, br);
    const alpha = 0.14 + rand() * 0.2;
    g.addColorStop(0, `rgba(32,16,9,${alpha})`);
    g.addColorStop(1, 'rgba(32,16,9,0)');
    ctx.fillStyle = g;
    ctx.beginPath();
    ctx.arc(bx, by, br, 0, Math.PI * 2);
    ctx.fill();
  }

  const tex = new THREE.CanvasTexture(canvas);
  tex.needsUpdate = true;
  return tex;
}

/** Soft halo centred exactly on the hazard boundary — bright, defined edge with a
 * falloff on either side, instead of a hard-edged disc. `ringNorm` here must match
 * `glowPlaneR`'s derivation in `buildHazardGround` below. */
function makeHazardGlowTexture(): THREE.CanvasTexture {
  const size = 256;
  const canvas = document.createElement('canvas');
  canvas.width = canvas.height = size;
  const ctx = canvas.getContext('2d')!;
  const cx = size / 2, cy = size / 2, R = size * 0.5;
  const ringNorm = 0.84;

  // Round-5: re-tinted hotter and more saturated. The old peak (`255,240,195` —
  // effectively pale near-white) is exactly what let this glow disappear into a
  // near-white tile under additive blending; a saturated hot red-orange peak still
  // reads as heat even where the additive sum lifts the floor's own bright channels.
  const g = ctx.createRadialGradient(cx, cy, 0, cx, cy, R);
  g.addColorStop(0, 'rgba(255,90,30,0)');
  g.addColorStop(Math.max(0, ringNorm - 0.22), 'rgba(255,70,20,0)');
  g.addColorStop(ringNorm - 0.07, 'rgba(255,80,25,0.3)');
  g.addColorStop(ringNorm - 0.02, 'rgba(255,110,20,0.7)');
  g.addColorStop(ringNorm, 'rgba(255,60,10,1.0)');
  g.addColorStop(ringNorm + 0.025, 'rgba(230,35,15,0.6)');
  g.addColorStop(ringNorm + 0.09, 'rgba(190,20,10,0.22)');
  g.addColorStop(1, 'rgba(160,15,10,0)');
  ctx.fillStyle = g;
  ctx.fillRect(0, 0, size, size);

  const tex = new THREE.CanvasTexture(canvas);
  tex.needsUpdate = true;
  return tex;
}

/**
 * Tileable black/amber diagonal "caution tape" stripe — the hazard boundary's new
 * hard edge. The old crisp ring used a flat pale-gold fill (`#FFDCA0`) composited
 * with normal alpha blending at 0.8 opacity, which is nearly the SAME hue+value as
 * the tile itself (`tileLight` is `#EAD3A8`) — that near-match, not the blend mode,
 * is why it vanished into the floor ("faint warm glow, low-contrast against
 * near-white tile"). A black/amber stripe pattern can't blend into a warm pale
 * floor no matter how it's composited, which is the actual fix; the wide value gap
 * (near-black stripes next to saturated amber ones) is what "unmissable" requires.
 */
function makeHazardStripeTexture(): THREE.CanvasTexture {
  const w = 128, h = 32;
  const canvas = document.createElement('canvas');
  canvas.width = w;
  canvas.height = h;
  const ctx = canvas.getContext('2d')!;
  ctx.fillStyle = KPAL.hazardStripeDark;
  ctx.fillRect(0, 0, w, h);
  ctx.fillStyle = KPAL.hazardStripeBright;
  const stripeW = 20;
  ctx.save();
  ctx.beginPath();
  ctx.rect(0, 0, w, h);
  ctx.clip();
  for (let x = -h; x < w + h; x += stripeW * 2) {
    ctx.beginPath();
    ctx.moveTo(x, h);
    ctx.lineTo(x + h, 0);
    ctx.lineTo(x + h + stripeW, 0);
    ctx.lineTo(x + stripeW, h);
    ctx.closePath();
    ctx.fill();
  }
  ctx.restore();

  const tex = new THREE.CanvasTexture(canvas);
  tex.wrapS = THREE.RepeatWrapping;
  tex.wrapT = THREE.ClampToEdgeWrapping;
  tex.needsUpdate = true;
  return tex;
}

export interface HazardGround {
  group: THREE.Group;
  glowMat: THREE.MeshBasicMaterial;
  wisps: THREE.Mesh[];
}

export function buildHazardGround(M: Materials): HazardGround {
  const g = new THREE.Group();
  noOutline(g);

  const R = wu(POT.dangerRadius);

  // Scorched floor patch — organic, mostly transparent, sits at the same layer as
  // every other floor decal (puddles, wood pads).
  const scorchMat = new THREE.MeshBasicMaterial({ map: makeScorchTexture(), transparent: true, depthWrite: false });
  const scorch = new THREE.Mesh(new THREE.PlaneGeometry(R * 2.15, R * 2.15), scorchMat);
  scorch.rotation.x = -Math.PI / 2;
  scorch.position.y = FLOOR_Y.decal;
  scorch.renderOrder = 1;
  g.add(scorch);

  // Bright glow halo, centred exactly on the real hazard boundary.
  const ringNorm = 0.84;
  const glowPlaneR = R / ringNorm * 1.02;
  const glowMat = new THREE.MeshBasicMaterial({
    map: makeHazardGlowTexture(),
    transparent: true,
    depthWrite: false,
    blending: THREE.AdditiveBlending,
  });
  const glow = new THREE.Mesh(new THREE.PlaneGeometry(glowPlaneR * 2, glowPlaneR * 2), glowMat);
  glow.rotation.x = -Math.PI / 2;
  glow.position.y = FLOOR_Y.fine;
  glow.renderOrder = 2;
  g.add(glow);

  // HAZARD's reserved hard edge: a black/amber caution-tape ring traced EXACTLY on
  // the real damage boundary (same `R` the gameplay hazard uses — see the file
  // header on `buildHazardGround`). Opaque, normally-blended (not additive like
  // `glow` above), roughly 8x wider than the old crisp line, so it cannot wash out
  // against the pale floor the way the additive glow's near-white peak did.
  const stripeHalfWidth = Math.max(0.09, R * 0.05);
  const stripeTex = makeHazardStripeTexture();
  const stripeRepeat = Math.max(8, Math.round((2 * Math.PI * R) / 1.0));
  stripeTex.repeat.set(stripeRepeat, 1);
  const crisp = mesh(
    new THREE.RingGeometry(R - stripeHalfWidth, R + stripeHalfWidth, 96),
    new THREE.MeshBasicMaterial({ map: stripeTex }),
    'hazard_ring_crisp'
  );
  crisp.rotation.x = -Math.PI / 2;
  crisp.position.y = FLOOR_Y.fine + 0.002;
  noOutline(crisp);
  g.add(crisp);

  // Heat-shimmer wisps drifting up off the boundary — cheap stand-in for real
  // screen-space refraction, animated (rise + fade, looping) in the arena's update().
  const wisps: THREE.Mesh[] = [];
  const wispCount = 7;
  for (let i = 0; i < wispCount; i++) {
    const a = (i / wispCount) * Math.PI * 2 + 0.35;
    const wispMat = flatMat('#FFE6B8', { transparent: true, opacity: 0.28 });
    const wisp = mesh(new THREE.ConeGeometry(R * 0.1, R * 0.36, 8, 1, true), wispMat, 'hazard_wisp__no_outline');
    noOutline(wisp);
    wisp.position.set(Math.cos(a) * R * 0.96, 0.04, Math.sin(a) * R * 0.96);
    wisp.userData.baseY = wisp.position.y;
    wisp.userData.phase = i * 0.7;
    g.add(wisp);
    wisps.push(wisp);
  }

  return { group: g, glowMat, wisps };
}

// ─────────────────────────────────────────────────────────────────────────────
// Slowing hazard visual — grease/water puddle disc + a hard hazard-rim ring traced
// exactly on the real slow radius. Same "hard bright edge" hazard grammar as the pot
// (see `KPAL.greaseRim`/`KPAL.waterRim`), so a puddle never reads as just another
// softly-shaded floor decal.
// ─────────────────────────────────────────────────────────────────────────────

export function buildPuddleVisual(
  M: Materials,
  px: number,
  py: number,
  radius: number,
  mat: THREE.Material,
  rimMat: THREE.Material
): THREE.Group {
  const g = new THREE.Group();
  const gp = groundPos(px, py);

  const disc = mesh(new THREE.CircleGeometry(wu(radius), 32), mat, 'puddle');
  disc.rotation.x = -Math.PI / 2;
  disc.position.set(gp.x, FLOOR_Y.decal, gp.z);
  noOutline(disc);
  g.add(disc);

  const rimW = wu(radius) * 0.14;
  const rim = mesh(
    new THREE.RingGeometry(wu(radius) - rimW, wu(radius) + rimW * 0.3, 40),
    rimMat,
    'puddle_hazard_rim'
  );
  rim.rotation.x = -Math.PI / 2;
  rim.position.set(gp.x, FLOOR_Y.fine, gp.z);
  noOutline(rim);
  g.add(rim);

  return g;
}
