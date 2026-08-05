/**
 * Hazard visuals — this module owns everything drawn for the arena's three hazard
 * zones: the central boiling pot (body, broth, flame, steam wisps, bubbles — the
 * geometry only; their per-frame animation lives in `./ambient.ts`), its ground
 * marking (the scorched floor patch, the glow halo, and the black/amber caution-tape
 * ring traced exactly on the real damage boundary), and the grease/water slow-puddle
 * discs.
 *
 * The two slow puddles are deliberately NOT trying to look like a "hazard" the way
 * the pot's ring/glow do — see the design note above `buildPuddleVisual` for why.
 * They're drawn to read as plain substances (spilled grease, spilled water); the
 * "someone is standing in this and it's slowing them" feedback lives entirely on the
 * CHARACTER instead (see `game/vfx.ts`'s slow tint/ring/splash), driven by the
 * read-only `Fighter.terrainSlowFactor` the sim publishes each tick.
 *
 * The GROUND treatments here (scorch, glow, caution ring, puddles) have no `CoverBox`
 * — they are visual-only area effects and must stay walkable, which is the whole
 * point of a hazard you can step into. `buildPot` is the exception: the pot is a
 * 2.6m-radius, 2.53m-tall opaque vessel and it IS solid, so `kitchen.ts` builds it
 * through `addCover` like any other blocking prop (see the long note at that call
 * site for the measurements, and for why the damage ring still fires). Nothing in
 * this file registers collision itself; the actual `HazardZone` entries (radius,
 * damage, slow factor) and the pot's `CoverBox` all live in `kitchen.ts`, which
 * positions everything this module builds to match those numbers exactly.
 */

import * as THREE from 'three';
import { flatMat } from '../render/toon';
import { wu, groundPos } from '../units';
import { POT } from '../game/rules';
import { puck, mesh, noOutline, buildContactShadow, FLOOR_Y, KPAL, type Materials } from './shared';

// ─────────────────────────────────────────────────────────────────────────────
// Central pot assembly.
//
// This block used to say the pot deliberately had no collision box, "matching the
// prototype: dangerRadius already keeps players well clear of the body before they'd
// ever touch it". That was false and it was the bug: `POT.dangerRadius` only makes
// `sim.ts` apply damage, it never pushes anybody out, so fighters walked into the
// body and vanished — 0.0% of the silhouette visible at the pot centre, head
// included, measured at shipped framing. `kitchen.ts` now registers a
// `POT.bodyRadius * 2` CoverBox for this group via `addCover`; the derivation and
// the proof that the damage ring still fires are at that call site.
//
// Two consequences for the geometry below:
//   - the group is a child of `propsGroup`, so it takes the arena's 0.016 BLOCKING
//     ink line along with every other cover prop. It must not ink itself as well.
//   - `addCover` adds its own rounded, direction-offset grounding decal, exactly as
//     it does for the spice carts and barrels, which also keep their own tighter
//     contact ring. Both are kept here for the same reason (see below).
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
  // ⚠️ `scale` was 1, and 1 is the one value that makes this decal invisible. The plane
  // is `bodyR * 2.1` across, so at scale 1 its half-width is 1.05 * bodyR against a pot
  // of radius `bodyR` — the decal peeks out by **5%** of its own radius, and the only
  // part of a radial gradient that reaches the screen is its outermost twentieth, where
  // alpha is ~0.03. A blind critic reading the frame cold said the pot "meets the floor
  // with no contact shadow at all"; it had one and it was delivering a 3% wash. See the
  // stop-placement note on `makeContactShadowTexture`, which is the other half of this.
  // 1.45 puts the visible annulus at u 0.66..1.00, in the band the stops now carry.
  g.add(buildContactShadow(M.contactShadow, bodyR * 2.1, bodyR * 2.1, 1.45));
  // The pot used to also get a hand-placed BAKED directional shadow here, because it is
  // the tallest object in the arena and had no CoverBox (so it never ran through
  // `addCover`). That whole system is retired: ablation measured the baked cast decals at
  // mean 0.127/255 over 0.75% of pixels — five faint slivers, most of them underneath the
  // prop that cast them — while the real shadow map now does the job properly. Removing
  // them is also what freed the key azimuth, which was pinned to `SHADOW_DIR` so that
  // real and baked shadows would agree.
  //
  // The contact ring above is deliberately kept and is NOT part of that retirement: it is
  // worth 17-30x the cast blob, and it got stronger once the cast decals stopped
  // overdrawing it (2.25 -> 2.98/255). Removing contact rings makes props float.

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

  // No `outlineGroup(solid, 0.006)` here any more. 0.006 is decoration weight — it
  // is the exact line `kitchen.ts` calls "invisible at gameplay camera distance" —
  // and the pot now BLOCKS, so it has to carry the arena's reserved blocking ink.
  // `kitchen.ts` adds this group to `propsGroup` and inks the whole set at 0.016 in
  // one pass; inking here as well would just stack a second, thinner hull inside it
  // (`outlineGroup` skips `*__outline` meshes, so the two do not cancel).

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

  // Round 11: same alphas, same luma band, MORE chroma (HSL 0.61 -> 0.85 on the core
  // stop). This apron is one of the two surfaces the saturation contract explicitly
  // lets the arena spend warm chroma on — it is the hazard's own burn mark — and it is
  // where the budget freed by taking warm hue off the counter rim trim, the plank pads
  // and the brass pot stack is re-spent, so the whole-frame warm rail holds flat
  // instead of dropping while 19.1% of environment chroma leaves the cast's band.
  // Nothing about the mark's VALUE moves, so it still cannot be mistaken for a shadow.
  const base = ctx.createRadialGradient(cx, cy, 0, cx, cy, size * 0.5);
  base.addColorStop(0, 'rgba(66,22,6,0.70)');
  base.addColorStop(0.5, 'rgba(76,28,8,0.40)');
  base.addColorStop(0.78, 'rgba(86,34,9,0.14)');
  base.addColorStop(1, 'rgba(86,34,9,0)');
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
    g.addColorStop(0, `rgba(40,13,4,${alpha})`);
    g.addColorStop(1, 'rgba(40,13,4,0)');
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
  // ── Round 11: the INSIDE of the ring stopped being empty ────────────────────
  // The ring marked the damage boundary and the disc it encloses — the ground that
  // actually hurts you — was drawn at alpha 0. So the hazard's area read as a line,
  // not as a region, which is the opposite of every telegraph convention in the genre.
  // Filling it with a low, soft warm wash costs almost nothing in the salience grid
  // (that metric weights LOCAL CONTRAST at 0.5, and a wide gradient has none) while
  // making the damage footprint legible as a footprint.
  //
  // It also pays for itself in the colour budget. This arena's warm chroma had to come
  // back up after 19.1% of environment chroma left the cast's hue band, and the
  // saturation contract is explicit that 0-60 deg belongs to *the cast, the hazards and
  // the VFX* — so a hazard is the one place the environment may spend warm freely, and
  // the one place spending it improves readability rather than costing it.
  const g = ctx.createRadialGradient(cx, cy, 0, cx, cy, R);
  g.addColorStop(0, 'rgba(255,110,35,0.09)');
  g.addColorStop(Math.max(0, ringNorm - 0.42), 'rgba(255,95,28,0.13)');
  g.addColorStop(Math.max(0, ringNorm - 0.22), 'rgba(255,80,22,0.20)');
  g.addColorStop(ringNorm - 0.07, 'rgba(255,80,25,0.38)');
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
  // Every material built outside `buildMaterials` reaches `tools/tmp/matcover.mjs` as
  // `(unnamed)` and — because that tool keys its rows on name+hex — the whole family
  // below collapsed into ONE row reading `(unnamed) #FFFFFF`, measured at 7.5% of
  // frame at hue 20 deg. That is the third-largest surface in the game sitting inside
  // the cast's own hue band, and no report named it; `tools/tmp/whomat.mjs` had to be
  // written to break the row apart. Naming them costs one string each and has no
  // rendering effect (`THREE.Material.name`), and it makes the hazard's contribution
  // to the arena's colour budget attributable on the next run instead of the one after.
  const scorchMat = new THREE.MeshBasicMaterial({ map: makeScorchTexture(), transparent: true, depthWrite: false });
  scorchMat.name = 'hazard:scorch';
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
  glowMat.name = 'hazard:glow';
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
  const stripeMat = new THREE.MeshBasicMaterial({ map: stripeTex });
  stripeMat.name = 'hazard:stripe';
  const crisp = mesh(
    new THREE.RingGeometry(R - stripeHalfWidth, R + stripeHalfWidth, 96),
    stripeMat,
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
    const wispMat = flatMat('#FFCE7A', { transparent: true, opacity: 0.30 });
    wispMat.name = 'hazard:wisp';
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
// Slowing hazard visual — grease/water puddle discs.
//
// ── Design change: puddles stopped trying to LOOK dangerous ────────────────────
// Five critic rounds in a row plateaued at 6/10 chasing a colour that could mean
// "this slows you" without colliding with an existing genre convention: magenta
// reads as lethal, violet as loot, green as heal/toxic, yellow as ordinary floor,
// cyan was already water. Every accent hue this file tried (see git history) ran
// into one of those. The palette for a secondary non-lethal hazard is genuinely
// exhausted — no hue was ever going to solve this.
//
// Uri's fix dissolves the problem instead of fighting it: the puddle's COLOUR
// doesn't have to carry the "you'll be slowed here" meaning at all. A puddle now
// only has to look like a puddle — plainly water or plainly grease. The "you are
// currently slowed" feedback moved onto the CHARACTER instead (a cool tint, a
// telegraph ring, splash particles at the feet — see `game/vfx.ts`), driven by the
// `Fighter.terrainSlowFactor` observation `sim.ts` publishes each tick. That's where
// a player is already looking when it matters, and it works identically whether the
// slow came from this puddle or a weapon effect, so nothing about "which hazard is
// this" needs to be decoded from hue at a glance.
//
// What's left below is only what makes a disc read as a SUBSTANCE rather than a
// painted decal: a dark contact-AO halo grounding it against the floor (puddles
// used to have none at all — a real fix, kept as-is), a per-kind surface texture
// (an oily sheen for grease, ripples/caustics for water, so the disc is never a
// single dead-flat colour fill), and a thin wet rim tracing the real edge so it
// doesn't dissolve into the tile. No glow halo, no bold accent ring, no warning
// icons, no full-disc accent tint — that entire "make this shout HAZARD" layer is
// gone; it was fighting a battle the character-side feedback wins instead.
//
// ── The half of that rework that did not land, and why ──────────────────────
// This header used to claim the "bold accent ring" was gone. It was not. The pass
// that wrote this owned `hazards.ts` but NOT `shared.ts`, and the ring's colours
// (`KPAL.greaseRim` = neon lime, `KPAL.waterRim` = electric cyan) live there — so
// `buildPuddleVisual` kept drawing `puddle_wet_rim` in exactly the material the
// change was written to retire, and the single loudest element of the layer outlived
// the note announcing its removal. Both files now have one owner and it is finished:
// those two colours are muted wet-edge tones (see the KPAL note on `greaseRim`), and
// the puddle bodies came down with them.
//
// Worth remembering as a pattern, not just an incident: a file-scoped rework can
// silently no-op when the thing it is removing is DEFINED outside its scope. The
// header describing the change is not evidence the change happened — the render is.
// ─────────────────────────────────────────────────────────────────────────────

/** Parses a `#rrggbb` hex string into a 0-255 RGB triple via `THREE.Color`, so these
 * canvas gradients use the same colour-space handling as the renderer itself. */
function hexToRgb(hex: string): [number, number, number] {
  const c = new THREE.Color(hex);
  return [Math.round(c.r * 255), Math.round(c.g * 255), Math.round(c.b * 255)];
}

// ─────────────────────────────────────────────────────────────────────────────
// THE GREASE POOL'S VALUE — the one arena number that costs nine characters their
// worst station
// ─────────────────────────────────────────────────────────────────────────────
//
// `tools/tmp/valuescan.mjs --mode dl` measured all 11 characters at all 18
// `arena-scan` stations, on each character's EXACT matte rather than on a salience
// block. 187 of 198 readings clear the project's own >= 0.10 figure/ground standard,
// mean +0.27 — and the failures do not scatter. They pile onto one station:
//
//     grease_in      mean dL 0.082      9 of 11 characters below 0.10
//     grease_near    mean dL 0.254      0 of 11 below
//
// Standing IN the pool is the only place in the arena where the hero stops separating
// from the ground, and it is the same place for nine different characters. That makes
// it an ARENA fact wearing a character costume — `valuescan.mjs`'s own gate says so
// out loud, allowing exactly one failing station per character *because* this one
// "fails for 9 of 11 and is an ARENA fix". Repainting eleven characters for one disc
// is the local-optimum trap in `docs/LESSONS.md` §7.
//
// Measured with `tools/tmp/greasekey.mjs` (one page load per character at grease_in,
// sim frozen, the disc's colour driven live, the puddle's own pixels attributed by
// frontmost surface). Mean over the four WORST characters — hotdog, waterbottle,
// taco, lollipop:
//
//   L (HSL)   hex        mean dL   n >= 0.10   ground L   puddle L   puddle HSV S   puddle-vs-tile
//   0.431 *   #B0802C     0.014       0/4       0.621      0.539        0.921           +0.128
//   0.381     #9C7127     0.057       0/4       0.577      0.488        0.910           +0.077
//   0.351     #8F6824     0.083       2/4       0.551      0.456        0.900           +0.046
//   0.321     #835F21     0.108       2/4       0.526      0.427        0.887           +0.016
//   0.291     #77561E     0.131       3/4       0.502      0.398        0.869           -0.013
//   0.261     #6B4E1B     0.151       4/4       0.481      0.372        0.847           -0.039   <- chosen
//   0.231     #5E4518     0.173       4/4       0.459      0.346        0.812           -0.065
//
// ⚠️ THE LEVER IS VALUE, NOT SATURATION. `docs/LESSONS.md` §8, now falsified four
// times: the arena measures mean saturation 0.4272 against a reference 0.493 and the
// cast is 1.8x more saturated than its environment (0.765 vs 0.425). There is nothing
// here to desaturate, and the table above is the proof that this change does not —
// HSV saturation moves 0.921 -> 0.847 as a *consequence* of the darkening (delivered,
// after lighting and grade), while the authored HSL saturation is held EXACTLY at
// `KPAL.grease`'s own 0.600. Only L moves.
//
// ⚠️ AND IT MUST STILL READ AS A SPILL. `PUDDLE_SLOW_FACTOR` is 0.45 and terrain slow
// is 14.6-17.2% of play; a puddle that has dissolved into the tile is a mechanic the
// player cannot see. The last column is that check, and it is why this stops at 0.261
// rather than continuing to 0.231: the pool goes from +0.128 ABOVE the tile to -0.039
// BELOW it — it does not pass through the tile's value and vanish, it crosses to the
// other side and reads as a dark oily pool, which is what spilled grease looks like.
// Its boundary is still carried by a VALUE step (0.039, plus the wet rim, plus the
// contact-AO halo) and not by hue alone, which is the failure mode `docs/LESSONS.md`
// §1 case 11 records ("slow-effect ring in the same cyan as the puddle it sits on").
//
// AS SHIPPED, all eleven characters, HEAD and this change driven on the SAME frozen
// frame (`tools/tmp/postablate.mjs --pair --station grease_in`), so the two rows differ
// by one material colour and four grade uniforms and by nothing else:
//
//   grease_in dL >= 0.10   BEFORE 1 of 11      AFTER 11 of 11      mean 0.066 -> 0.234
//
// and the attribution inside that: the puddle alone takes the mean to 0.210, the grade's
// new shadow toe alone takes it to 0.068. This is the puddle's fix, not the grade's.
// Per character, before -> after: hotdog -0.019 -> 0.124, waterbottle -0.020 -> 0.157,
// lollipop 0.043 -> 0.172, taco 0.048 -> 0.228, soup 0.060 -> 0.251, pizza 0.062 -> 0.201,
// donut 0.064 -> 0.240, burrito 0.077 -> 0.214, sushi 0.081 -> 0.248, hamburger 0.099 ->
// 0.298, egg 0.233 -> 0.436.
//
// ⚠️ ONE AUTHORED RELATIONSHIP IS INVERTED BY THIS AND IT IS DELIBERATE, SO SAY SO.
// `KPAL.greaseRim` (#8A6A22, HSL L 0.335) was authored as the DARKER meniscus below the
// pool body's 0.431 — "well down in value ... so the boundary comes from a VALUE step
// against the tile". With the body at 0.261 the rim is now the LIGHTER of the two, and
// it reads as a wet edge catching the key rather than as a dark trough (rendered and
// looked at: `shots/ship/grease_in.png`). That is arguably the better read on a pool
// that is now darker than its floor — a dark ring around a dark disc is how the "is
// that a hole?" complaint in `docs/DECISIONS-FOR-URI.md` §5 gets re-earned — but it is
// `shared.ts`'s value to set, not this file's. If the palette owner disagrees, dropping
// `KPAL.greaseRim` by the same 0.17 restores the original ordering in one line.
//
// WHY IT IS DONE HERE AND NOT IN `KPAL`. `shared.ts` has a different owner this
// session, and one-owner-per-file-set is the hardest constraint on this project
// (CLAUDE.md §8). More importantly this is not a palette fact, it is a FIGURE/GROUND
// fact about the one surface a fighter stands on top of: `KPAL.grease` is still the
// pool's hue and chroma, and this is the pool's own value key relative to it. Derived
// at runtime from whatever `KPAL.grease` currently is, so a future palette move
// carries this with it instead of silently stranding a hardcoded hex.
//
// `M.grease` reaches exactly one call site (`kitchen.ts` -> `buildPuddleVisual`), so
// the clone below cannot affect anything else in the arena; `floor.ts`'s stove-grease
// splats use `M.floorGrime`/`stainRim` and are untouched.
const GREASE_BODY_L_DROP = 0.17;

/**
 * `mat` with its HSL lightness pulled down by `drop`, hue and saturation held.
 *
 * ⚠️ `THREE.ColorManagement` is ENABLED (three r180), so `new Color('#B0802C')` stores
 * LINEAR-sRGB and a bare `getHSL()` would report the lightness of the linear value,
 * not of the authored swatch — a silently different number, and the darkening would
 * land somewhere other than where it was measured. Both calls therefore name
 * `SRGBColorSpace` explicitly, which is the space `greasekey.mjs` drove the sweep in.
 */
function darkenedBody(mat: THREE.Material, drop: number): THREE.Material {
  const src = mat as THREE.MeshStandardMaterial;
  if (!src.color) return mat;
  const out = src.clone() as THREE.MeshStandardMaterial;
  const hsl = { h: 0, s: 0, l: 0 };
  out.color.getHSL(hsl, THREE.SRGBColorSpace);
  out.color.setHSL(hsl.h, hsl.s, Math.max(0.02, hsl.l - drop), THREE.SRGBColorSpace);
  return out;
}

/** Oily-sheen surface detail for the grease puddle — dark pooled blotches, a couple
 * of bright diagonal sheen streaks (tinted toward `highlightHex`, a warm light-catch
 * colour — never plain white), and a few trapped air bubbles — so the disc reads as
 * a THICK, VISCOUS liquid instead of a flat colour fill. Alpha-blended on top of the
 * base disc. `highlightHex` drives ONLY the sheen streak tint (a light-catching
 * highlight, same job `KPAL.rimLight` does on counter edges elsewhere in this arena
 * — not a hazard accent) — the dark pooled blotches stay neutral regardless, since
 * those are about VALUE contrast, not hue. */
function makeGreaseSurfaceTexture(highlightHex: string): THREE.CanvasTexture {
  const size = 256;
  const canvas = document.createElement('canvas');
  canvas.width = canvas.height = size;
  const ctx = canvas.getContext('2d')!;
  const cx = size / 2, cy = size / 2;

  let seed = 5171;
  const rand = () => { seed = (seed * 48271) % 2147483647; return seed / 2147483647; };

  for (let i = 0; i < 6; i++) {
    const a = rand() * Math.PI * 2;
    const r = rand() * size * 0.4;
    const bx = cx + Math.cos(a) * r, by = cy + Math.sin(a) * r;
    const br = size * (0.1 + rand() * 0.16);
    const grad = ctx.createRadialGradient(bx, by, 0, bx, by, br);
    grad.addColorStop(0, `rgba(24,16,4,${0.28 + rand() * 0.16})`);
    grad.addColorStop(1, 'rgba(24,16,4,0)');
    ctx.fillStyle = grad;
    ctx.beginPath();
    ctx.arc(bx, by, br, 0, Math.PI * 2);
    ctx.fill();
  }

  const [lr, lg, lb] = hexToRgb(highlightHex);
  ctx.strokeStyle = `rgba(${lr},${lg},${lb},0.28)`;
  ctx.lineWidth = size * 0.05;
  ctx.lineCap = 'round';
  for (const off of [-0.22, 0.18]) {
    ctx.beginPath();
    ctx.moveTo(size * (0.15 + off * 0.4), size * (0.82 + off * 0.3));
    ctx.lineTo(size * (0.78 + off * 0.4), size * (0.2 + off * 0.3));
    ctx.stroke();
  }

  for (let i = 0; i < 5; i++) {
    const bx = rand() * size, by = rand() * size;
    const br = size * (0.02 + rand() * 0.025);
    ctx.beginPath();
    ctx.arc(bx, by, br, 0, Math.PI * 2);
    ctx.fillStyle = 'rgba(10,7,2,0.35)';
    ctx.fill();
    ctx.beginPath();
    ctx.arc(bx - br * 0.3, by - br * 0.3, br * 0.35, 0, Math.PI * 2);
    ctx.fillStyle = 'rgba(255,255,255,0.5)';
    ctx.fill();
  }

  const tex = new THREE.CanvasTexture(canvas);
  tex.needsUpdate = true;
  return tex;
}

/** Ripple + caustic surface detail for the water puddle — concentric rings radiating
 * from an off-centre "drip point" plus a couple of bright caustic patches, so the
 * disc reads as disturbed liquid rather than a painted circle. */
function makeWaterSurfaceTexture(): THREE.CanvasTexture {
  const size = 256;
  const canvas = document.createElement('canvas');
  canvas.width = canvas.height = size;
  const ctx = canvas.getContext('2d')!;
  const cx = size * 0.46, cy = size * 0.52;

  let seed = 6421;
  const rand = () => { seed = (seed * 48271) % 2147483647; return seed / 2147483647; };

  // Four evenly-spaced, equally-bright, perfectly concentric white rings at 0.4 alpha
  // is not what a ripple looks like — it is what a RADAR SWEEP or a targeting reticle
  // looks like, and on a 5m disc it was a big part of why this puddle read as a
  // gameplay pad rather than a spill. Same shapes, but the alpha is now low and
  // UNEVEN ring to ring (a real disturbance loses energy outward and never produces
  // four identical crests), which leaves surface movement without drawing a target.
  for (const [rr, alpha] of [[0.14, 0.2], [0.24, 0.13], [0.35, 0.17], [0.46, 0.09]] as const) {
    ctx.strokeStyle = `rgba(255,255,255,${alpha})`;
    ctx.lineWidth = size * (0.012 + rr * 0.01);
    ctx.beginPath();
    ctx.arc(cx, cy, size * rr, 0, Math.PI * 2);
    ctx.stroke();
  }

  for (let i = 0; i < 3; i++) {
    const bx = rand() * size, by = rand() * size;
    const br = size * (0.1 + rand() * 0.14);
    const grad = ctx.createRadialGradient(bx, by, 0, bx, by, br);
    // Caustic patches pulled down from 0.35 for the same reason as the base colour
    // (see `KPAL.water`): stacked on an already near-clipping blue they were pushing
    // pixels to flat white, so the disc had no surface read left at its brightest.
    grad.addColorStop(0, 'rgba(255,255,255,0.2)');
    grad.addColorStop(1, 'rgba(255,255,255,0)');
    ctx.fillStyle = grad;
    ctx.beginPath();
    ctx.arc(bx, by, br, 0, Math.PI * 2);
    ctx.fill();
  }

  const tex = new THREE.CanvasTexture(canvas);
  tex.needsUpdate = true;
  return tex;
}

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
  const R = wu(radius);
  // Identity check, not a new prop: `mat`/`rimMat` are literally `M.grease`/
  // `M.greaseRim` or `M.water`/`M.waterRim` at every real call site (see
  // `kitchen.ts`) — comparing object identity against the same `M` the caller
  // already handed in picks the right per-kind surface texture without a new
  // parameter, which would mean editing `kitchen.ts`'s call sites (out of bounds
  // for this file).
  const isGrease = mat === M.grease;
  // The pool's own value key. See the `GREASE_BODY_L_DROP` note above: grease only —
  // the water pool is the north hazard, no character fails a station on it (mean dL
  // +0.274 at `water_near`), and it is already the darker of the two after the round
  // that pulled both bodies down.
  const bodyMat = isGrease ? darkenedBody(mat, GREASE_BODY_L_DROP) : mat;

  // Grounding — puddles previously had NO contact shadow at all, so they floated
  // free with no dark boundary separating them from the floor.
  //
  // It has to be positioned EXPLICITLY. Every other layer in this function writes
  // absolute world coordinates into its own mesh (`gp.x`/`gp.z`) and the group this
  // all goes into is never moved by the caller (see `kitchen.ts`: `puddleGroup` sits
  // at the origin), so a child that relies on the group's transform lands at world
  // (0,0) — the map's SW corner. That is exactly what happened here: BOTH puddles'
  // contact shadows were being drawn stacked on top of each other in the corner of
  // the map, and neither actual puddle had any grounding shadow at all. Same class of
  // bug as everything in PROGRESS.md's "rendering and INVISIBLE" list — the layer was
  // built, added and drawn every frame, just nowhere near the thing it belonged to.
  const shadow = buildContactShadow(M.contactShadow, R * 2, R * 2, 1.35);
  shadow.position.x = gp.x;
  shadow.position.z = gp.z;
  g.add(shadow);

  const disc = mesh(new THREE.CircleGeometry(R, 32), bodyMat, 'puddle');
  disc.rotation.x = -Math.PI / 2;
  disc.position.set(gp.x, FLOOR_Y.decal, gp.z);
  noOutline(disc);
  g.add(disc);

  // Per-kind surface detail — an independent alpha-blended overlay, so the base
  // `mat` instance handed in by the caller is never touched. This is what makes the
  // disc read as an actual SUBSTANCE (thick pooled grease with an oily sheen, or
  // disturbed water with ripples/caustics) rather than a flat colour fill — the only
  // job this layer has now is "look like a puddle," not "signal danger."
  // Round 11: this used to read `KPAL.rimLight`, on the (correct at the time) logic
  // that the sheen streak is the same "edge catching a warm light" job the counter
  // trim does. `rimLight` has since moved to cool steel — it was the single loudest
  // non-player cell in the arena and it wore the cast's own hue — and a COOL sheen on
  // a grease pool would read as water, i.e. it would tell the player the wrong thing
  // about which hazard he is standing in. Pinned to `flameCore` instead, which is the
  // warm light-catch this puddle is actually lit by and is reserved chroma, so the
  // link is to a colour that cannot drift out from under it for hierarchy reasons.
  const surfTex = isGrease ? makeGreaseSurfaceTexture(KPAL.flame) : makeWaterSurfaceTexture();
  const surf = new THREE.Mesh(
    new THREE.CircleGeometry(R * 0.97, 32),
    new THREE.MeshBasicMaterial({ map: surfTex, transparent: true, depthWrite: false })
  );
  surf.name = isGrease ? 'puddle_grease_surface__no_outline' : 'puddle_water_surface__no_outline';
  surf.rotation.x = -Math.PI / 2;
  surf.position.set(gp.x, FLOOR_Y.decal + 0.01, gp.z);
  surf.renderOrder = 2;
  noOutline(surf);
  g.add(surf);

  // Thin wet rim tracing the real edge, in the caller's own material (`M.greaseRim`/
  // `M.waterRim`, now muted wet-edge tones — see the KPAL note in `shared.ts`). Just
  // enough of a boundary line that the puddle's edge doesn't dissolve into the tile —
  // the same "wet edge" a real spill leaves, not a hazard marking; there is
  // deliberately no second bold accent band, glow halo or icon ring on top of it.
  const trimW = R * 0.045;
  const trim = mesh(
    new THREE.RingGeometry(R - trimW, R + trimW, 40),
    rimMat,
    'puddle_wet_rim'
  );
  trim.rotation.x = -Math.PI / 2;
  trim.position.set(gp.x, FLOOR_Y.fine, gp.z);
  noOutline(trim);
  g.add(trim);

  return g;
}
