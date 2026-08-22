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
import { puck, mesh, noOutline, buildContactShadow, applyContactRamp, FLOOR_Y, KPAL, type Materials } from './shared';

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
  //
  // ── ROUND 12: IT WAS UNDER THE HAZARD'S OWN GLOW, AND THAT IS ARITHMETIC ────
  //
  // The previous pass fixed both ends of this decal (scale 1 -> 1.45, gradient stops
  // outward) and `ao_ab` did not move. Rendered and looked at, the reason was that the
  // pot's contact annulus is owned by the hazard's own bright halo. The numbers, from
  // `buildHazardGround` below: the glow plane is `R/0.84*1.02` = 5.767 m in radius and
  // ADDITIVELY blended, so at the pot's own edge (bodyR = 2.6 m, u = 0.451) it lays
  // down alpha ~0.141 of rgb(255,92,26) — a luma LIFT of +0.070, right where a decal
  // is trying to deliver -0.05. It cannot win, and no amount of darkening it would
  // have changed that.
  //
  // Two independent fixes, because either alone leaves the trap open:
  //   * this decal now draws AFTER the glow (renderOrder 3 against the glow's 2).
  //   * the glow's inner wash is faded out under the pot — see `makeHazardGlowTexture`.
  //
  // ⚠️ It is the RENDER ORDER that moves, not the height. Raising the plane to sit
  // physically above the glow (`FLOOR_Y.fine` + 4 mm) also works and was tried first —
  // and it costs 8.6 px of parallax. At this 58 deg camera a point 18 cm off the floor
  // projects 0.18/tan(58) = 0.156 m toward the viewer, which at 55.4 px/m displaces the
  // whole contact shadow away from the base it is supposed to be pinned to. That is
  // peter-panning, manufactured to fix an occlusion problem that is not an occlusion
  // problem: the glow and the scorch are both `depthWrite: false`, so nothing about
  // this decal's HEIGHT was ever what hid it. Only the order was.
  //
  // The general form is worth keeping: an alpha-blended dark decal drawn BEFORE an
  // additive plane covering the same pixels is invisible whatever its own alpha says
  // (`docs/LESSONS.md` §1), and the fix for a draw-order bug is draw order.
  const potContact = buildContactShadow(M.contactShadow, bodyR * 2.1, bodyR * 2.1, 1.45);
  potContact.renderOrder = 3;
  g.add(potContact);
  applyContactRamp(g);
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
  //
  // 🔴 IT CANNOT LICK OUT FROM ANYWHERE. THE BURNER IS SEALED INSIDE THE POT.
  // Reported, not "fixed": what to do about it is a design call, and this is the
  // measurement that call needs. Bounding boxes read off the LIVE scene, not from the
  // constructor arguments above (`tools/tmp/hw_burner.mjs` prints them):
  //
  //     flame           r 1.092   y -0.692 .. 0.612
  //     flameCore       r 0.728   y -0.490 .. 0.450
  //     pot_stove_base  r 1.300   y  0.000 .. 0.060    OPAQUE, depth-writing
  //     pot_body        r 2.600   y  0.060 .. 2.530    OPAQUE, depth-writing
  //
  // Both cones are narrower than the pot at every height they share, everything above
  // y = 0.06 is INSIDE the body, and everything below y = 0 is under the floor. There is
  // no camera angle that sees either one; this is containment, not 58-degree
  // foreshortening, so the shallow lobby camera would not rescue it either.
  //
  // ⚠️ AND 0 PX IS ALSO WHAT A BROKEN PROBE RETURNS, so this has a POSITIVE CONTROL —
  // the same ablation with `pot_solid` hidden. Self-pair 0 px and RETURN drift 0 px at
  // both stations:
  //
  //     station        ablate to #FF00FF @ opacity 1     ...with the opaque shell hidden
  //     pot_south                     0 px                          1,126 px
  //     pot_diagonal                  0 px                          2,296 px
  //
  // So the burner IS drawn, the ablation DOES work on these two materials, and the pot
  // eats every pixel. `docs/LESSONS.md` §1 exactly: built, named, animated every frame
  // by `createAmbientUpdate` (`pot.flame.scale`, `pot.flameCore.scale`, a two-term
  // flicker at 18 and 41 rad/s), and reaching the screen never. Rendered and looked at:
  // `shots/hw/trip_burner.png` — shipped | shell hidden | shell hidden + ablated, where
  // the burner is the small blob at the pot's centre that turns magenta.
  //
  // NOT changed here, because all three answers are design decisions and Uri is asleep:
  // raise the cones so they clear y 0.06 and widen them past `bodyR`; move them out to
  // the stove base's rim; or delete them and the flicker with them. The last is not
  // obviously wrong — the pot already reads as hot from the hazard glow, the scorch
  // patch, the steam and the boil. Routed to `docs/DECISIONS-FOR-URI.md` (owned by a
  // peer this session, so it is in the report rather than in that file).
  //
  // WHAT *IS* FIXED HERE is the flag, which is a bug independent of the visibility
  // question: `M.flame`/`M.flameCore` are `transparent: true` at opacity 0.92/0.95 with
  // `depthWrite` left true, so they are the same silent-occluder class as the hazard
  // wisps below and `tools/tmp/hc_occluders.mjs` names them. Today they bury nothing
  // (they are behind an opaque cylinder, so their own fragments fail the depth test and
  // write nothing) — but "harmless because it is invisible" stops being true the moment
  // anyone acts on the paragraph above, and that is the worst time to discover it.
  // `nonOccluding` clones rather than mutating `M.*`: both materials reach exactly one
  // call site each today (grep: this file, these two lines), and a shared material
  // mutated by a builder is a booby trap for the second call site.
  const flameCore = mesh(new THREE.ConeGeometry(bodyR * 0.28, bodyR * 0.4, 10), nonOccluding(M.flameCore), 'pot_flame_core__no_outline');
  flameCore.position.y = -0.02;
  noOutline(flameCore);
  g.add(flameCore);
  const flame = mesh(new THREE.ConeGeometry(bodyR * 0.42, bodyR * 0.6, 10), nonOccluding(M.flame), 'pot_flame__no_outline');
  flame.position.y = -0.04;
  noOutline(flame);
  g.add(flame);

  // Steam — soft tapered blobs rising above the broth, reset by `update()`.
  //
  // ⚠️ ONE MATERIAL PER WISP. It was ONE material shared by all three meshes, while
  // `createAmbientUpdate` writes `wisp.material.opacity` per wisp off a per-wisp phase
  // offset (`(elapsed + i * 0.5) % cycle`). Three writes to the same uniform per frame:
  // the LAST one wins and all three plumes fade in lockstep on wisp 2's phase, so the
  // offset that exists to stagger them was computed, assigned, and thrown away — the
  // pot pulsed as one blob instead of breathing. The classic pooled-material bug, and
  // the reason it survives review is that the code READS as if it works: every wisp does
  // get its own `t`, its own y, and its own scale, and only the opacity is shared.
  // (`wisp.scale` and `wisp.position` are per-OBJECT and were always correct — this is
  // specifically the one property that lives on the material.)
  //
  // ⚠️ AND THE STANDING TRAP THAT COMES WITH IT: never read initial state off a pooled
  // material. A helper that did `opacity: steamMat.opacity` here would have inherited
  // whatever the last plume had faded to, not the 0.55 authored two lines up.
  //
  // Cost: 2 extra `MeshBasicMaterial`s, no extra draw call, no extra program (identical
  // type and defines). `flatMat` is called per iteration for exactly the same reason the
  // hazard ring's wisps call it per iteration — see `buildHazardGround`.
  const steam: THREE.Mesh[] = [];
  const steamPositions: Array<[number, number]> = [
    [-bodyR * 0.4, 0], [0, bodyR * 0.05], [bodyR * 0.38, -bodyR * 0.05],
  ];
  for (const [sx, sz] of steamPositions) {
    const steamMat = flatMat('#EDEDED', { transparent: true, opacity: 0.55 });
    steamMat.name = 'pot:steam';
    // Not an occluder today — the plumes float at y 2.28..3.74, clear of everything in
    // the ground stack, which is why `hc_occluders` reports the class and gates only on
    // what is ROOTED at or below y 0.60. Cleared anyway: it is the same authoring
    // mistake, three plumes overlap each other, and a depth write between two 20%-alpha
    // cones is never what was wanted.
    steamMat.depthWrite = false;
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
  // ── Round 12: the inner wash now STARTS outside the pot's own base ──────────
  // The wash above was added to make the damage footprint legible as a footprint, and
  // that argument holds for the ground a fighter can stand on. It does not hold for
  // the disc under the pot itself. `POT.bodyRadius` is 52 wu against a `dangerRadius`
  // of 95, and this plane's radius is `dangerRadius/0.84*1.02`, so the pot's own edge
  // sits at u = 0.451 of it — where the old stops were already laying +0.070 of
  // additive luma onto the exact annulus the pot's contact shadow needs. Collision
  // stops a fighter's CENTRE at 73 wu (u = 0.633), so nothing inside u ~ 0.5 is ever
  // stood on, is mostly occluded by the pot, and telegraphs nothing: the whole of that
  // wash was cost. It now ramps from zero at u = 0.42 (just outside the pot at 0.451
  // once the pot's own base flare is allowed for) instead of starting at 0.09 in the
  // middle.
  //
  // ── AND THE WASH ITSELF IS A WHITEOUT, WHICH IS MEASURED, NOT JUDGED ────────
  // Sampled off the shipped frame at `570:430`, on the SAME teal service mat inside
  // and outside the caution ring:
  //
  //                        luma     HSV saturation
  //     mat, outside      0.446         0.695
  //     mat, inside       0.698         0.391      <- +0.25 luma, saturation HALVED
  //
  // This is billed as a "scorched floor patch" and it is the BRIGHTEST large surface
  // in the frame — brighter than the pink tile at 0.425 — and the most desaturated. The
  // scorch texture underneath is a dark warm brown at up to 0.70 alpha and none of it
  // survives, for the third time in this one file: an ADDITIVE plane over an
  // alpha-blended dark one wins outright, so the dark layer is present, correct and
  // invisible (`docs/LESSONS.md` §1). At 0.20-0.38 alpha of rgb(255,80,22) the wash
  // alone lifts luma +0.10 to +0.19 before the post chain's bloom touches it.
  //
  // Halved inside u = 0.80 (0.20 -> 0.09, 0.38 -> 0.17) so the lift lands at +0.045 to
  // +0.085: a warm tint over a surface whose own material still reads, instead of a
  // veil that erases it. Every stop from `ringNorm - 0.02` outward — the peak, the
  // boundary itself and the outer falloff — is untouched to the digit, because that is
  // the part that does the telegraphing, and the black/amber caution ring traced
  // exactly on the damage radius is untouched as well. The region stays legible as a
  // region; it stops being a hole in the frame.
  const g = ctx.createRadialGradient(cx, cy, 0, cx, cy, R);
  g.addColorStop(0, 'rgba(255,110,35,0.0)');
  g.addColorStop(0.42, 'rgba(255,105,32,0.0)');
  g.addColorStop(Math.max(0, ringNorm - 0.22), 'rgba(255,80,22,0.09)');
  g.addColorStop(ringNorm - 0.07, 'rgba(255,80,25,0.17)');
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
  // A repeating pattern on a ring seen at 58 deg is minified hard on the far arc and
  // barely at all on the near one, which is the exact case isotropic mip filtering
  // cannot serve: the level that stops the far side crawling over-blurs the near side.
  // three clamps this to the device maximum, so 8 is a request, not an assumption.
  tex.anisotropy = 8;
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
  // ── Round 12: one repeat per 2 m, not per 1 m ───────────────────────────────
  // A blind critic reading this frame cold: *"the hazard ring has visibly stair-stepped
  // diagonal stripes — hard aliasing on a fully opaque coplanar decal. It reads as UI
  // pasted onto the world."* Correct, and the mechanism is spatial frequency rather
  // than the compositing it was attributed to. Measured off the shipped frame at
  // native pixels (`/tmp/ring_zoom.png`, 4x nearest-neighbour): the ring's on-screen
  // circumference is ~1630 px and this repeat put 96 stripe pairs around it, i.e.
  // **~17 px per pair and ~2 px of dark stripe**. Two pixels is not a marking, it is
  // hatching — and hatching at the display's own frequency limit is what a UI overlay
  // looks like, which is precisely what the critic reported. The 32-px-tall texture
  // also squashes the authored diagonal to near-vertical on a band that is only ~26 px
  // deep on screen, so the "diagonal caution tape" reads as a picket fence.
  //
  // Halving the repeat doubles every stripe to ~4 px of dark against ~8 px of amber,
  // out of the aliasing band and into a mark the eye resolves as a shape. Nothing else
  // moves: same colours, same width, same radius, same `R`, so the hazard's reserved
  // hard edge still lands exactly on the damage boundary and the telegraph is
  // untouched. `docs/LESSONS.md` §6: a texture feature smaller than a few pixels at
  // shipped framing is an aliasing generator, not detail.
  const stripeRepeat = Math.max(8, Math.round((2 * Math.PI * R) / 2.0));
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
  //
  // ── THE WISPS WERE OPAQUE GREY SLABS THAT DELETED THE RING BEHIND THEM ──────
  // `transparent: true` with `depthWrite` left true. `docs/LESSONS.md` §1's "also,
  // adjacent" paragraph, and the second pass in this file caught by it: the wisp
  // draws at renderOrder 0, i.e. FIRST in the transparent pass, stamps depth at its own
  // surface, and every transparent surface drawn after it and behind it fails the depth
  // test across the cone's whole screen footprint. The wisp is 30% opaque, so what
  // survives is the *shading* of a solid cone with nothing behind it.
  //
  // RENDERED AND LOOKED AT (`shots/hw/trip_wisp5.png`, 3x, the cone that crosses the
  // caution ring at `pot_south`): shipped draws a DULL BLUE-GREY TRIANGLE that has
  // erased the yellow/black stripes and the pink halo underneath it. With the flag
  // cleared it is warm amber shimmer and the stripes read straight through. There was
  // never a design intent here to argue about — a "heat shimmer" that is opaque is a
  // bug, at every camera angle.
  //
  // MEASURED — `tools/tmp/gl_occl_ab.mjs`, HEAD @ 2f05202, one page load with
  // `requestAnimationFrame` frozen, station `pot_south` (700:640), 2 loads. Per-block
  // self-pair **0 px** and per-block RETURN drift **0 px**, so nothing below is quoted
  // against a guessed tolerance. What the depth write buries, summed across the seven:
  //
  //     1,834 delivered px, 96,474 summed channel delta, meanD 4.7..73.6, maxD 132
  //
  // and the verdict is "clearing the flag is closer to correct" on 7 of 7 wisps on both
  // loads. Against the `M.dust` field the SAME sweep deliberately LEFT ALONE (6-12 px,
  // 82-126 summed, and there the obvious fix was backwards) that is **153x by delivered
  // pixels and 766x by summed delta** — quoted both ways on purpose, because the two
  // ratios differ by 5x and this instrument has already been caught getting a verdict
  // backwards by using the first one. Opposite verdicts out of one tool is why the
  // sweep prices every hit instead of gating on the flag alone.
  //
  // ── THE ORDER IS A SEPARATE JUDGEMENT FROM THE FLAG, AND IT IS 8% OF IT ─────
  // `tools/tmp/hw_ord.mjs`, same freeze, distance to a reference arm that both clears
  // the flag AND draws above the whole ground stack, as SUMMED delta — NEVER pixel
  // count. Wisp #5 alone is the demonstration: 814 px shipped-vs-flag and 837 px
  // flag-vs-correct, so by AREA the flag barely helps, while the mean deltas are 73.6
  // and 2.4. Count says where; total says how much:
  //
  //     shipped                              92,689     <- 100%
  //     depthWrite:false alone                 7,268     <- 7.8% left over
  //     depthWrite:false + renderOrder             0
  //
  // So the flag is 92% of the fix and the order is the remaining 8% — real, and small.
  // It is NOT the dust's situation, where clearing the flag alone was a REGRESSION
  // (3.4x-5.4x further from correct than shipped) because a 5 cm mote at renderOrder 0
  // with no depth write is simply painted over by the decal drawn after it. A 1.7 m cone
  // is overdrawn at its base, not erased: the flag-only arm is already 92% of the way
  // there, which is why the order is a refinement here and was the whole fix there.
  //
  // ⚠️ 3 AND NOT THE PROBE'S DEFAULT 8, AND PIXELS CANNOT MAKE THIS CALL. At
  // `pot_south` with no VFX, renderOrder 3 and renderOrder 8 are **pixel-identical —
  // 0 px, 0 summed** (`hw_ord` prints that comparison on its own line precisely so a
  // station that cannot tell two candidates apart says so). The choice is made on the
  // layer census instead: `src/arena/fogRing.ts` puts the fog CURTAIN at renderOrder 7
  // and the fog CANOPY at **8**. A wisp at 8 would be composited on top of the fog of
  // war and leak the arena's central hazard through a curtain whose whole job is to
  // hide it — trading a 3-level compositing artefact for a visibility bug. 3 is the
  // smallest value that clears the ground stack (`PUDDLE_RENDER_ORDER` tops out at 1.6,
  // the character contact decal and `hazard:glow` are both 2) while staying under every
  // VFX layer (3/4 status rings, 5 wedges, 6 rings, 10/11 sprites) and under the fog.
  const HAZARD_WISP_RENDER_ORDER = 3;
  const wisps: THREE.Mesh[] = [];
  const wispCount = 7;
  for (let i = 0; i < wispCount; i++) {
    const a = (i / wispCount) * Math.PI * 2 + 0.35;
    // ⚠️ ONE MATERIAL PER WISP, AND THAT IS LOAD-BEARING, NOT WASTE. `createAmbientUpdate`
    // writes `wisp.material.opacity` per wisp off a per-wisp phase, so seven meshes
    // sharing one material would collapse to whatever the last one wrote — which is
    // exactly what the pot's steam was doing until this pass (see `buildPot`).
    const wispMat = flatMat('#FFCE7A', { transparent: true, opacity: 0.30 });
    wispMat.name = 'hazard:wisp';
    wispMat.depthWrite = false;
    const wisp = mesh(new THREE.ConeGeometry(R * 0.1, R * 0.36, 8, 1, true), wispMat, 'hazard_wisp__no_outline');
    noOutline(wisp);
    wisp.position.set(Math.cos(a) * R * 0.96, 0.04, Math.sin(a) * R * 0.96);
    wisp.renderOrder = HAZARD_WISP_RENDER_ORDER;
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

  // The sheen streaks were TWO HARD-EDGED BARS at a single width and alpha, running
  // corner to corner — which at match framing reads as paint on a road, not as light
  // caught on a viscous surface, and which the lobed outline made worse by clipping
  // them dead against the new edge (`tools/tmp/wt_iter1/iter1_grease_p58.png`).
  // Same two streaks, same colour, same angle: three passes at falling width and
  // rising alpha give a feathered core instead of a step, and they stop well short of
  // the rim so the outline is never what ends them.
  const [lr, lg, lb] = hexToRgb(highlightHex);
  ctx.lineCap = 'round';
  for (const off of [-0.22, 0.18]) {
    for (const [wMul, alpha] of [[2.6, 0.05], [1.6, 0.08], [0.9, 0.13]] as const) {
      ctx.strokeStyle = `rgba(${lr},${lg},${lb},${alpha})`;
      ctx.lineWidth = size * 0.05 * wMul;
      ctx.beginPath();
      ctx.moveTo(size * (0.26 + off * 0.4), size * (0.72 + off * 0.3));
      ctx.lineTo(size * (0.70 + off * 0.4), size * (0.30 + off * 0.3));
      ctx.stroke();
    }
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

// ─────────────────────────────────────────────────────────────────────────────
// THE PUDDLE WAS DEPTH-REJECTING THE CHARACTER'S CONTACT SHADOW
// ─────────────────────────────────────────────────────────────────────────────
//
// `src/render/stage.ts` landed a per-fighter contact decal at y = 0.09 (48e5f6c). It
// works: `tools/tmp/cs_charcontact.mjs --ours` measures the OPPOSITE flank — the one a
// directional cast shadow can never darken — going 0.000 -> 0.137 / 0.074 / 0.144 of
// the floor's own value at three open-floor stations.
//
// `grease_in` was the ONLY one of `arena-scan`'s 18 stations whose dL and rank did not
// move at all when that decal landed (-0.050 -> -0.050, rank 7 -> 7) while the other
// seventeen moved -0.024 +/- 0.003. That uniformity is what made it a finding rather
// than noise, and the cause is one flag:
//
//     name         mat            y      renderOrder  transparent  depthWrite
//     contact:decal              0.090       2            true        false
//     puddle       kpal:grease   0.150       0            true        TRUE     <-
//     puddle_wet_rim greaseRim   0.250       0           false        true     <-
//
// `docs/LESSONS.md` §1, "also, adjacent": **a transparent material without
// `depthWrite: false` still writes depth and silently occludes.** The body draws first
// (renderOrder 0), stamps depth at y = 0.15, and the decal at y = 0.09 fails its depth
// test over the whole disc. The opaque wet rim does the same in a ring at y = 0.25.
//
// MEASURED, not reasoned about (`tools/tmp/hc_probe.mjs`, the §1 unmissable-probe
// technique — the decal's texture forced to a magenta multiply, which kills the floor's
// green channel outright, and the frame required to MOVE):
//
//     pixels changed inside the puddle's own screen disc, n = 57807 px
//       magenta decal, shipped                       1238   ( 2.1%)   <- the sliver
//       magenta decal, puddle depthWrite:false      48619   (84.1%)      that escapes
//
// Rendered and looked at (`shots/hc/z_probe_magenta.png`): the magenta quad is plainly
// there on the tile and stops DEAD on the puddle's edge.
//
// ── WHY THIS IS FIXED HERE AND NOT BY RAISING THE DECAL ─────────────────────
// Raising `CONTACT_Y` past 0.25 would put the character's shadow over every prop kick
// and plinth in the arena, and at the match camera's 58 deg pitch a decal 16 cm higher
// projects 0.10 m toward the viewer — peter-panning, manufactured to fix an occlusion
// problem. The pot's own contact ring records the identical lesson twenty lines up:
// **the fix for a draw-order bug is draw order.**
//
// ── AND A FIGHTER IN WATER GENUINELY DOES CAST — the physics agrees ─────────
// The alternative honest answer was "a puddle SHOULD occlude it, because a fighter
// standing in water grounds differently". It should not. These are films a few
// millimetres deep on the same floor: the light the fighter's body blocks never reaches
// the liquid either, so the darkening belongs ON the puddle surface, not underneath it.
// The grease pool is also the arena's worst figure/ground station by a distance (see
// the `GREASE_BODY_L_DROP` note above) — deleting the one grounding cue that reaches it
// is the opposite of what that finding asks for.
//
// ── WHAT IT DELIVERED. Paired, identical stations, HEAD vs HEAD+this file ───
// `cs_charcontact --ours`, the DECAL's own contribution isolated by a third render with
// the contact group hidden, as a fraction of the floor's own value:
//
//   station                       opposite flank        shade flank
//   560:900  standing in grease   0.000 -> 0.141      0.000 -> 0.084
//   840:100  standing in water    0.000 -> 0.153      0.000 -> 0.114
//   570:430  open floor, CONTROL  0.137 -> 0.137      0.086 -> 0.086
//
// The control is unchanged to three decimals across two independent servers, which is
// what says the move is this file and not a peer. The open-floor band this had to reach
// was 0.074-0.144; grease lands inside it and water 0.009 above its top.
//
// `valuescan --mode dl --only grease_in`, all ELEVEN characters, the same pairing:
// mean hero-vs-ground dL 0.1601 -> 0.2173 (+0.0572, spread +0.046..+0.063), and the
// last character below this project's 0.10 standard (hotdog, 0.0835) clears it at
// 0.1405 — 11 of 11. Its `gridDL` moves -0.044 -> -0.070, i.e. by -0.026: the station
// that would not move now moves by the same -0.024 +/- 0.003 its seventeen peers did.
//
// ⚠️ ONE THING GOT SLIGHTLY DARKER AND IT IS NOT THE SHADOW. The pool's own AO halo
// was ALSO being depth-rejected by the pool, and now leaks through the body's 0.15-0.18
// of transmission. Mean luma inside the disc, contact decals hidden, against a
// HEAD-to-HEAD drift control of 0.0001: grease 0.42550 -> 0.42291, water 0.59320 ->
// 0.58977. Attributed by hiding the halo as well, at which point the two trees agree to
// 0.0003. That is 0.6% of the pool's value — 26x the drift floor, so it is real, and
// ~3% of one step of the `GREASE_BODY_L_DROP` sweep, so it is not worth a counter-move.
//
// ── THE ORDER, STATED RATHER THAN INFERRED FROM Y ───────────────────────────
// With the depth write gone, draw order is all that decides who covers whom, and three
// of the four layers here need a specific place in it. `renderOrder` is compared
// numerically, so fractions are legal and are used deliberately: every value below is
// strictly less than the character decal's 2, and their internal order is unchanged
// from what the depth buffer used to enforce.
//
//   halo 1.0   the puddle's own grounding AO. FIRST, and that is load-bearing: its
//              texture is DARK IN THE MIDDLE (alpha 0.58 at u=0 falling to 0 at u=1),
//              a density that was invisible only because the body's depth write hid
//              it. Drawn after the body it would repaint the whole pool indigo.
//   body 1.2   the pool itself.
//   surf 1.4   the oily sheen / ripples. Was 2 — an exact TIE with the character
//              decal, broken by three's back-to-front depth sort in the wrong
//              direction, so the sheen streaks drew OVER the shadow. Visible in
//              `shots/hc/z_probe_magenta_nodepthwrite.png`: two orange streaks
//              crossing an otherwise magenta pool.
//   rim  1.6   the wet edge. Opaque today, so it lives in the OPAQUE queue and its
//              depth write cannot be removed on its own — an opaque mesh that writes
//              no depth is overdrawn by the tile field, which sorts after it
//              front-to-back. It is moved into the transparent queue at opacity 1
//              instead, where `src*1 + dst*0` is bit-identical compositing.
// ─────────────────────────────────────────────────────────────────────────────
const PUDDLE_RENDER_ORDER = { halo: 1.0, body: 1.2, surf: 1.4, rim: 1.6 } as const;

// ─────────────────────────────────────────────────────────────────────────────
// ONE PLANE FOR ALL THREE LAYERS — a 10 cm stack is 27 cm of parallax at pitch 20
// ─────────────────────────────────────────────────────────────────────────────
//
// The pool used to be built on three heights: body at `FLOOR_Y.decal` (0.15), surface
// at 0.16, wet rim at `FLOOR_Y.fine` (0.25). That was correct while the DEPTH BUFFER
// decided who covered whom. It stopped being correct the moment `PUDDLE_RENDER_ORDER`
// took that job over, and it left a defect that the match camera hides and the shallow
// camera does not:
//
//   a layer h above the ground projects h * cot(pitch) toward the viewer.
//     pitch 58   0.10 m of stack -> 0.062 m of slide     (invisible at framing)
//     pitch 20   0.10 m of stack -> 0.275 m of slide     (11% of the pool's radius)
//
// So at a shallow angle the rim slides toward the camera and tears away from the far
// edge of the body, and the gap fills with the pool's own dark AO halo: a hard reddish
// contour hugging the far shoreline. It is plainly there in the SHIPPED build —
// `tools/tmp/wt_before/before_water_p20.png`, which is HEAD, not this change — and it
// is exactly CLAUDE.md #3's point. The shallow view did not make the pool wrong; it
// made a wrongness visible. A film of water a few millimetres deep has no business
// being built on 10 cm of stack at any angle.
//
// Fixed as geometry, not as appearance: all three layers move to ONE y and the draw
// order that was already deciding the result keeps deciding it. Both `nonOccluding`
// materials have `depthWrite: false` and the surface overlay never wrote depth, so
// coplanar layers cannot z-fight — nothing here writes a depth value for another to
// tie with, and `LessEqualDepth` passes them all against the floor's.
const PUDDLE_PLANE_Y = FLOOR_Y.decal;

/**
 * A clone of `mat` that no longer writes depth.
 *
 * A CLONE rather than a mutation: `M.grease`/`M.water`/`M.greaseRim`/`M.waterRim` are
 * built once in `shared.ts` and reach exactly one call site each today, but a shared
 * material mutated by a builder is a booby trap for the second call site, and this
 * file has already been burned once by editing something whose definition lives in
 * another file (see the "half of that rework that did not land" note above).
 * `Material.clone()` copies `name`, so `tools/tmp/matcover.mjs` and `whomat.mjs` still
 * attribute these surfaces to `kpal:grease` / `kpal:greaseRim` rather than to
 * `(unnamed)` — the exact regression the naming note on `buildHazardGround` records.
 */
function nonOccluding(mat: THREE.Material): THREE.Material {
  const out = mat.clone();
  // Opacity is untouched. `transparent` is forced on only because a material has to be
  // in the transparent queue for `depthWrite: false` to mean "draws over the floor
  // without stamping depth"; at opacity 1 the blend is an exact passthrough.
  out.transparent = true;
  out.depthWrite = false;
  return out;
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

  // 🚨 THE CONCENTRIC RINGS ARE GONE, AND THE PREVIOUS ATTEMPT TO SAVE THEM IS WHY.
  //
  // Old wording, kept per the reversal rule: *"Four evenly-spaced, equally-bright,
  // perfectly concentric white rings at 0.4 alpha is not what a ripple looks like — it
  // is what a RADAR SWEEP or a targeting reticle looks like... Same shapes, but the
  // alpha is now low and UNEVEN ring to ring, which leaves surface movement without
  // drawing a target."*
  //
  // Unevening the alpha did not work, and the render says so plainly
  // (`tools/tmp/wt_before/before_water_p20.png`, and the same object at the match
  // camera): it still reads as a dartboard. The reticle read never came from the rings
  // being EVEN. It came from their being CIRCLES ABOUT ONE CENTRE, which is the exact
  // thing Uri named — *"the water should look like water. not circles"* — and a circle
  // drawn inside the pool is as much a circle as the outline was.
  //
  // Surface movement is now the shader's job and it runs on `vShore`, so its crests
  // follow the pool's own edge instead of a circle. What stays in the canvas is the
  // part a shader is bad at: a few irregular, hand-placed caustic patches.

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


// ─────────────────────────────────────────────────────────────────────────────
// A PUDDLE IS NOT A CIRCLE — the outline, the motion and the reflection
// ─────────────────────────────────────────────────────────────────────────────
//
// Uri, on the shipped pools: *"water paddels, the water should look like water. not
// circles. add some dynamics and reflection from the water paddels so they look
// better."*
//
// He is describing the SILHOUETTE, and the silhouette is what the eye resolves first
// on a 2.5 m shape at 578 wu of framing. Everything above this line is surface
// TREATMENT — blotches, streaks, ripple rings, a wet meniscus — layered on three
// concentric perfect circles:
//
//     disc   CircleGeometry(R, 32)
//     surf   CircleGeometry(R * 0.97, 32)
//     trim   RingGeometry(R - 0.045R, R + 0.045R, 40)
//
// Verified before acting on it (`shots` in `tools/tmp/wt_before/`): at the match
// camera the water pool reads as a flat cyan disc with four concentric rings — the
// exact "radar sweep / targeting reticle" the `makeWaterSurfaceTexture` note above
// says it fixed by unevening the alpha. Unevening the alpha did not fix it, because
// the reticle read never came from the rings' evenness. It came from the fact that
// every contour in the object, including its outer edge, is a circle about one centre.
//
// ── WHAT MUST NOT MOVE ───────────────────────────────────────────────────────
//
// 🚨 THE SIM COLLIDES ON A RADIUS AND THAT IS NOT NEGOTIABLE.
// `src/game/movement.ts` — `Math.hypot(x - hz.x, y - hz.y) < hz.radius` — a centre
// test against the scalar `kitchen.ts` registers. Nothing here reaches it: this file
// registers no collision at all (see the module header). So the outline below is a
// VISUAL boundary over an unchanged circular one, which is the correct shape of the
// change and the only one in scope for a rendering pass.
//
// The two are therefore reconciled on AREA rather than on radius. `puddleProfile`
// normalises so that the enclosed area equals the circle it replaces to within 0.1%,
// which keeps "how big is this hazard" honest on average; individual angles run
// under and over. Measured on the shipped profiles, in units of R = 50 wu:
//
//     kind     min r    max r    area / circle    coefficient of variation
//     water    0.803    1.143        0.9991              0.1025
//     grease   0.879    1.108        0.9992              0.0617
//
// ⚠️ THAT TABLE IS FOUR COUNTS AND COUNTS GO STALE HERE AT ROUGHLY COIN-FLIP RATE.
// `tools/tmp/wt_probe.mjs` §D parses the lobes, the seeds and this table out of THIS
// FILE, re-runs `puddleProfile`'s arithmetic and requires them to agree to 0.001 —
// with a MOVES arm that bumps an amplitude and demands the table go red, so it cannot
// pass by comparing nothing to nothing. Change a lobe and §D tells you which line to
// rewrite.
//
// So the visual edge disagrees with the slow field by at most 0.143 R = 7.2 wu
// (0.36 m) outward and 0.197 R = 9.9 wu inward. For scale, a fighter is 42 wu across.
// The shipped wet rim ALREADY overshot the collision circle by 0.045 R = 2.3 wu, so
// this is a widening of an existing mismatch, not a new class of one — and the pool's
// own AO halo has always feathered out to R * 2, far past either. Stated rather than
// buried, because it is the one thing in this change a player could in principle feel.
//
// Grease is deliberately the ROUNDER of the two (cv 0.0617 against water's 0.1025,
// a factor of 1.66). That is the same distinction the surface overlays already make
// and the module header insists on: grease is viscous and pools into a fat blob;
// water is thin and sprawls. **Do not make grease look like water** — it is the one
// thing a player reads to know which hazard he is standing in.

/** Outline samples per pool. 96 rather than the old 32: at 32 a lobe of order 5
 * is only six segments wide and reads as a polygon, which is a different wrong
 * shape rather than a right one. Cost is 64 vertices per mesh and zero draw calls. */
const PUDDLE_SEGMENTS = 96;

/** `[harmonic order, amplitude]`. Low orders only — a real pool's edge is smooth
 * curvature, not noise, and anything above ~8 turns into a gear. */
type Lobes = ReadonlyArray<readonly [number, number]>;

const WATER_LOBES: Lobes = [[2, 0.115], [3, 0.075], [5, 0.042], [7, 0.020]];
const GREASE_LOBES: Lobes = [[2, 0.070], [3, 0.048], [5, 0.020]];

/**
 * A closed radial profile — `PUDDLE_SEGMENTS` unit radii — normalised so the enclosed
 * area is exactly that of the unit circle.
 *
 * AREA-preserving, not max-preserving. Normalising the maximum to 1 (so the visual can
 * never over-promise the slow field) costs the water pool 23.5% of its area, i.e. the
 * hazard visibly shrinks; that trades a boundary error nobody can see for a size error
 * everybody can. The area constraint is `sum(r^2) == n`, straight out of the polar
 * area integral, so the scale is `sqrt(n / sum(r^2))` in one line rather than a solve.
 *
 * Deterministic from `seed` — a fixed LCG, the same one the surface textures above use
 * — so the two pools have different outlines and each pool has the SAME outline on
 * every load. `Math.random` here would make every capture in this repo unreproducible.
 */
function puddleProfile(seed: number, lobes: Lobes): number[] {
  let s = seed;
  const rand = () => { s = (s * 48271) % 2147483647; return s / 2147483647; };
  const phase = lobes.map(() => rand() * Math.PI * 2);
  const r: number[] = [];
  for (let i = 0; i < PUDDLE_SEGMENTS; i++) {
    const th = (i / PUDDLE_SEGMENTS) * Math.PI * 2;
    let v = 1;
    for (let k = 0; k < lobes.length; k++) v += lobes[k][1] * Math.sin(lobes[k][0] * th + phase[k]);
    r.push(v);
  }
  let sq = 0;
  for (const v of r) sq += v * v;
  const k = Math.sqrt(PUDDLE_SEGMENTS / sq);
  return r.map((v) => v * k);
}

/**
 * A triangle fan on `profile`, authored in the XY plane with +Z normals — exactly
 * `CircleGeometry`'s own convention, so the caller's `rotation.x = -PI/2` and every
 * existing y-offset keep working unchanged.
 *
 * ⚠️ UVs are normalised against `radius * max(profile)`, NOT against `radius`.
 * `CircleGeometry` maps `u = x / radius / 2 + 0.5`, which puts the rim exactly on the
 * texture edge; with lobes running past 1.0 that same formula walks off the texture
 * and `ClampToEdgeWrapping` smears the last row of pixels down the longest lobes. The
 * cost is that the authored detail sits at 1/max(profile) of its old scale — 87.5% on
 * water — which is a size change to the blotches, not a mapping error.
 *
 * ── `aShore`, and why the shader needs it ────────────────────────────────────
 * A float per vertex: 0 at the centre, 1 on the outline, whatever the local radius
 * is. A triangle fan interpolates it linearly along each spoke, so `vShore` is a
 * distance field whose ISO-CONTOURS FOLLOW THE SHORE rather than being circles about
 * the centre — one attribute, no branching. That is the whole fix for the defect the
 * first render of this change exposed (`tools/tmp/wt_iter1/`): shore-parallel
 * contours read as a shallow pool, and contours that are circles inside a lobed
 * outline read as a TARGET PAINTED ON one.
 */
function lobedDiscGeometry(radius: number, profile: readonly number[]): THREE.BufferGeometry {
  const n = profile.length;
  let mx = 0;
  for (const v of profile) mx = Math.max(mx, v);
  const uvR = radius * mx * 2;
  const pos = new Float32Array((n + 1) * 3);
  const nor = new Float32Array((n + 1) * 3);
  const uv = new Float32Array((n + 1) * 2);
  const shore = new Float32Array(n + 1);
  nor[2] = 1; uv[0] = 0.5; uv[1] = 0.5; shore[0] = 0;
  for (let i = 0; i < n; i++) {
    const th = (i / n) * Math.PI * 2;
    const r = radius * profile[i];
    const x = Math.cos(th) * r, y = Math.sin(th) * r;
    pos[(i + 1) * 3] = x; pos[(i + 1) * 3 + 1] = y;
    nor[(i + 1) * 3 + 2] = 1;
    uv[(i + 1) * 2] = x / uvR + 0.5;
    uv[(i + 1) * 2 + 1] = y / uvR + 0.5;
    shore[i + 1] = 1;
  }
  const idx: number[] = [];
  for (let i = 0; i < n; i++) idx.push(0, i + 1, ((i + 1) % n) + 1);
  const g = new THREE.BufferGeometry();
  g.setAttribute('position', new THREE.BufferAttribute(pos, 3));
  g.setAttribute('normal', new THREE.BufferAttribute(nor, 3));
  g.setAttribute('uv', new THREE.BufferAttribute(uv, 2));
  g.setAttribute('aShore', new THREE.BufferAttribute(shore, 1));
  g.setIndex(idx);
  return g;
}

/** The wet meniscus as a strip of constant width tracing the SAME profile — so the
 * edge line and the body edge are one contour, which is the whole point. */
function lobedRingGeometry(radius: number, halfWidth: number, profile: readonly number[]): THREE.BufferGeometry {
  const n = profile.length;
  const pos = new Float32Array(n * 2 * 3);
  const nor = new Float32Array(n * 2 * 3);
  const uv = new Float32Array(n * 2 * 2);
  for (let i = 0; i < n; i++) {
    const th = (i / n) * Math.PI * 2;
    const c = Math.cos(th), s = Math.sin(th);
    const ri = radius * profile[i] - halfWidth;
    const ro = radius * profile[i] + halfWidth;
    pos[i * 6] = c * ri; pos[i * 6 + 1] = s * ri;
    pos[i * 6 + 3] = c * ro; pos[i * 6 + 4] = s * ro;
    nor[i * 6 + 2] = 1; nor[i * 6 + 5] = 1;
    uv[i * 4] = i / n; uv[i * 4 + 1] = 0;
    uv[i * 4 + 2] = i / n; uv[i * 4 + 3] = 1;
  }
  const idx: number[] = [];
  for (let i = 0; i < n; i++) {
    const a = i * 2, b = i * 2 + 1;
    const c = ((i + 1) % n) * 2, d = ((i + 1) % n) * 2 + 1;
    idx.push(a, b, d, a, d, c);
  }
  const g = new THREE.BufferGeometry();
  g.setAttribute('position', new THREE.BufferAttribute(pos, 3));
  g.setAttribute('normal', new THREE.BufferAttribute(nor, 3));
  g.setAttribute('uv', new THREE.BufferAttribute(uv, 2));
  g.setIndex(idx);
  return g;
}

// ─────────────────────────────────────────────────────────────────────────────
// DYNAMICS AND REFLECTION — and the clock that keeps a capture reproducible
// ─────────────────────────────────────────────────────────────────────────────
//
// 🚨 THE SIM IS SEEDED AND DETERMINISTIC AND THAT UNDERWRITES EVERY BALANCE NUMBER
// IN THIS PROJECT. Nothing below reaches sim state, reads a `Fighter`, or is read by
// anything that does. It is a render-clock animation on two decorative overlays.
//
// ⚠️ AND A RENDER-CLOCK ANIMATION IS A TRAP FOR EVERY INSTRUMENT IN THIS REPO.
// `docs/AGENT-BRIEF.md` §3 records the camera shake re-randomising on every
// `render()`, so 344 of 344 "frozen" frames drifted — a moving puddle would do the
// same to `arena-scan`, to `q1_capture` and to any A/B taken through `preview.html`.
// Two things stop it:
//
//   - the app's own freeze already works. Every capture tool here replaces
//     `requestAnimationFrame` with a stub, and with no rAF there is no `render()`, so
//     `onBeforeRender` never fires and the phase cannot advance.
//   - `preview.html?t=` is honoured DIRECTLY. `src/preview.ts` steps animation to
//     exactly `t` in 1/120 sub-steps and then renders with dt = 0; reading the same
//     `t` here means the pool's phase is a function of the URL, so two loads of one
//     URL are byte-identical even though three `render()` calls happen between them.
//     Measured with `tools/tmp/wt_shot.mjs --drift`: two independent page loads,
//     **0 differing pixels of 962,000**.
//
// `window.__puddleTime` overrides both, for a tool that wants to drive the phase.
const PUDDLE_FROZEN_T: number | null = (() => {
  try {
    if (typeof location === 'undefined') return null;
    if (!/preview\.html$/.test(location.pathname)) return null;
    const raw = new URLSearchParams(location.search).get('t');
    if (raw === null) return null;
    const n = Number(raw);
    return Number.isFinite(n) ? n : null;
  } catch { return null; }
})();

function puddleSeconds(): number {
  const forced = (globalThis as unknown as { __puddleTime?: unknown }).__puddleTime;
  if (typeof forced === 'number' && Number.isFinite(forced)) return forced;
  if (PUDDLE_FROZEN_T !== null) return PUDDLE_FROZEN_T;
  return performance.now() / 1000;
}

interface PuddleSurfaceUniforms {
  uPTime: { value: number };
  /** Where the ripples come from, in the disc's own UV space. Matches the drip point
   * `makeWaterSurfaceTexture` already draws its rings around, so the authored rings
   * and the shader's travelling crests are concentric with each other. */
  uPDrip: { value: THREE.Vector2 };
  /** x frequency · y speed · z radial falloff · w amplitude. */
  uPRipple: { value: THREE.Vector4 };
  /** x axis angle (rad) · y drift speed · z travel · w half-width. */
  uPBand: { value: THREE.Vector4 };
  /** x sky strength · y Fresnel exponent · z band strength · w crest gain. */
  uPFres: { value: THREE.Vector4 };
  /** What the pool mirrors. */
  uPSky: { value: THREE.Color };
}

/**
 * ⚠️ ONE SHADER PROGRAM FOR BOTH POOLS, VIA A PINNED CACHE KEY.
 *
 * `Material.customProgramCacheKey()` returns `onBeforeCompile.toString()` by default
 * (`three/src/materials/Material.js:541`, read in the installed 0.180.0), so two
 * materials carrying two closures compile two IDENTICAL programs. Pinning the key to
 * a constant collapses that to one. Uniform VALUES stay per material regardless:
 * `WebGLRenderer` assigns `materialProperties.uniforms = parameters.uniforms` per
 * material, after calling that material's own `onBeforeCompile` (`WebGLRenderer.js`
 * `:2084` / `:2091`).
 *
 * 🚨 A PINNED KEY IS A PROMISE THAT THE SOURCE IS THE SAME. It is kept by
 * construction: both patches below are pure module-level string transforms with no
 * per-kind branching — everything that differs between grease and water is a UNIFORM.
 * If a `#define` ever enters this shader, the key has to carry it or the second pool
 * silently renders with the first pool's program. `tools/tmp/wt_probe.mjs` asserts the
 * two patched sources are byte-identical, so that stops being a comment.
 */
const PUDDLE_PROGRAM_KEY = 'fa_puddle_surface_v1';

function patchPuddleVertex(src: string): string {
  return src
    .replace('#include <common>', '#include <common>\nvarying vec3 vFaWorld;\nvarying float vShore;\nvarying vec2 vLocal;\nattribute float aShore;')
    .replace('#include <begin_vertex>', '#include <begin_vertex>\n\tvShore = aShore;\n\tvLocal = position.xy;')
    // AFTER `project_vertex`, where `transformed` is still in scope. Deliberately not
    // `worldpos_vertex`: that chunk is compiled in only when shadows/fog/envmap ask
    // for it, so depending on it would make this silently vary with lighting settings.
    .replace('#include <project_vertex>', '#include <project_vertex>\n\tvFaWorld = ( modelMatrix * vec4( transformed, 1.0 ) ).xyz;');
}

function patchPuddleFragment(src: string): string {
  return src
    .replace('#include <common>', `#include <common>
varying vec3 vFaWorld;
varying float vShore;
varying vec2 vLocal;
uniform float uPTime;
uniform vec2  uPDrip;
uniform vec4  uPRipple;
uniform vec4  uPBand;
uniform vec4  uPFres;
uniform vec3  uPSky;`)
    .replace('#include <map_fragment>', `#include <map_fragment>
{
	// DYNAMICS — and the FIRST version of this was a defect, not a feature.
	// It ran \`sin( length( vMapUv - drip ) * k - t )\`: crests on circles about one
	// point, stacked on the four concentric rings the canvas already drew. The render
	// is kept at \`tools/tmp/wt_iter1/\` — a lobed outline with a BULLSEYE inside it,
	// which is a WORSE read than the plain disc it replaced, because the outline says
	// "pool" and the interior says "target". Uri's note is *"not circles"*, and a circle
	// drawn INSIDE the pool is still a circle.
	//
	// Two changes fix it and both are geometric rather than cosmetic:
	//   - the wave travels on \`vShore\`, so its crests run PARALLEL TO THE SHORE. A
	//     shallow pool's own shading does exactly that; the contours are the depth.
	//   - a second wave carries an ANGULAR term, so the two never resolve into a clean
	//     ring anywhere in the pool. Interference, not concentricity.
	// ⚠️ \`atan\` IS UNDEFINED AT THE FAN'S CENTRE VERTEX AND IT SHOWED. Every spoke of
	// the fan meets at vShore = 0, so the angular wave's phase is discontinuous exactly
	// there and rendered as a small dark curl pinned to the pool's middle
	// (\`tools/tmp/wt_iter4/iter4_water_p58.png\`, dead centre). Ramping the angular term
	// in from the middle removes the singularity instead of hiding it: at vShore = 0 the
	// wave is purely radial, where an angle has no meaning anyway.
	float faAng = atan( vLocal.y, vLocal.x );
	float faMix = 0.45 * smoothstep( 0.03, 0.34, vShore );
	float faW1  = sin( vShore * uPRipple.x - uPTime * uPRipple.y );
	float faW2  = sin( vShore * uPRipple.x * 0.62 + faAng * 2.0 + uPTime * uPRipple.y * 0.55 );
	float faWave = ( faW1 * ( 1.0 - faMix ) + faW2 * faMix ) * exp( -vShore * uPRipple.z );
	// CRESTS, not a sinusoid. A raw sine spends most of its range near zero and reads
	// as a soft haze; raising the positive half to a power leaves thin bright lines
	// where the surface is actually tilted toward the light, with flat water between
	// them. That is what the eye uses to call something a liquid surface.
	// The same fan singularity, one term further on: EVERY spoke meets at vShore = 0,
	// so any crest that survives to the middle collapses into a single lit pixel there
	// (\`wt_iter5\`, a white dot dead centre where \`wt_iter4\` had a dark one). Faded out
	// over the innermost 12% rather than reshaped — a pool's deepest point is the one
	// place with no surface tilt to catch anything.
	float faRip = pow( max( faWave, 0.0 ), 2.4 ) * uPRipple.w * smoothstep( 0.0, 0.12, vShore );

	// A soft specular band drifting across the pool — the highlight a liquid surface
	// throws as it rocks. Tight and quick on water, broad and crawling on grease.
	vec2  faP    = vMapUv - uPDrip;
	vec2  faDir  = vec2( cos( uPBand.x ), sin( uPBand.x ) );
	float faOff  = sin( uPTime * uPBand.y ) * uPBand.z;
	float faBand = smoothstep( uPBand.w, 0.0, abs( dot( faP, faDir ) - faOff ) ) * uPFres.z;

	// REFLECTION, and it is not a probe. On a flat pool the GRAZING half is the
	// reflective half — the far edge of a real puddle mirrors the sky while the near
	// edge shows what is under the water — so the whole effect is the view vector's own
	// elevation. It is therefore right at BOTH shipped pitches by construction rather
	// than tuned at one: a shallower camera grazes more and reflects more, which is the
	// direction physics asks for. ~16 ALU on two small discs, zero draw calls; an env
	// probe would have cost a render target and fought the flat-shaded art direction.
	//
	// ⚠️ The exponent is LOW on purpose. At the match camera's 58 deg the view vector is
	// 0.848 up, so \`1 - v.y\` is 0.152 and a CUBE of that is 0.0035 — the first version
	// used 3.0 and the reflection was invisible at the only camera anyone plays at. The
	// base term keeps it present everywhere and the grazing term makes it GROW as the
	// camera drops. It is that behaviour, not the magnitude, that reads as water.
	vec3  faV = normalize( cameraPosition - vFaWorld );
	float faF = pow( 1.0 - clamp( faV.y, 0.0, 1.0 ), uPFres.y );
	// A crest tilts toward the sky and reflects harder; a trough tilts away. This is
	// what makes a shimmer instead of a wash — a CONSTANT reflection just pales the
	// pool out, which is exactly what the first render did.
	// DEEP IN THE MIDDLE, THIN AT THE SHORE. A pool is a lens: the middle holds enough
	// liquid to mirror, the edge is a film over the floor. Riding the reflection on
	// \`vShore\` is what gives the pool an interior at all — without it the whole disc
	// lifts by one constant and the render is a flat blob with a good outline
	// (\`tools/tmp/wt_iter2/\`), which is a different failure from the bullseye and just
	// as dead.
	float faDepth = 1.0 - 0.62 * pow( vShore, 1.6 );
	float faSky = uPFres.x * ( 0.34 + 0.66 * faF ) * faDepth * ( 0.62 + 0.38 * faWave * uPFres.w );

	// The pool THINS at its edge, and thin liquid is bright liquid. One band just
	// inside the shoreline, riding the same \`vShore\` the crests do, so it follows every
	// lobe instead of being a ring. It is the last thing standing between "a coloured
	// shape with a rim" and "a shallow pool with a shore".
	float faShore = smoothstep( 0.74, 0.99, vShore ) * uPBand.w * 1.15;

	float faL = clamp( faBand + faSky + faRip + faShore, 0.0, 1.0 );

	// Source-over of the sky layer ON TOP of the authored texel, in un-premultiplied
	// space. \`diffuseColor.rgb += sky * l\` with \`a += l\` is the obvious version and it
	// DARKENS: the blend is \`rgb * a + dst * (1 - a)\`, so a lift of l contributes l^2
	// while opening 1 - l of the pool underneath.
	float faA = faL + diffuseColor.a * ( 1.0 - faL );
	diffuseColor.rgb = ( uPSky * faL + diffuseColor.rgb * diffuseColor.a * ( 1.0 - faL ) ) / max( faA, 1e-4 );
	diffuseColor.a = faA;
}`);
}

/** Sky the water mirrors — `lighting.ts`'s hemisphere SKY endpoint, `0xd8ecff`.
 * Copied rather than imported: `src/render/lighting.ts` builds it inline in a
 * constructor and exports nothing, and it is not this file's to edit. If the rig's
 * sky moves, this is the line that has to move with it. Lifted from 0xd8ecff toward
 * white because it is composited at a low alpha over an already-blue pool: the
 * hemisphere's own value could not separate a crest from the water under it. */
const PUDDLE_SKY_HEX = 0xeaf6ff;

/**
 * The surface overlay's material: the authored per-kind texture, plus the shader
 * above. Was a bare `MeshBasicMaterial`; it still IS one, so whatever the render
 * pipeline does to basic materials keeps happening to it — which is the reason this
 * is an `onBeforeCompile` patch and not a `ShaderMaterial`, with a peer live in
 * `src/render/**` as it lands.
 */
function puddleSurfaceMaterial(isGrease: boolean, map: THREE.Texture): { mat: THREE.MeshBasicMaterial; uniforms: PuddleSurfaceUniforms } {
  const m = new THREE.MeshBasicMaterial({ map, transparent: true, depthWrite: false });
  m.name = isGrease ? 'puddle_grease_surface' : 'puddle_water_surface';
  const uniforms: PuddleSurfaceUniforms = isGrease ? {
    uPTime: { value: 0 },
    uPDrip: { value: new THREE.Vector2(0.5, 0.5) },
    // Grease at a THIRD of water's wave frequency, a fifth of its amplitude and a
    // fifth of its speed, with a broad slow sheen instead of a tight quick one. It is
    // viscous: it swells, it does not ripple. Keeping these two apart is not a taste
    // call — the module header records that the substance read is how a player knows
    // which hazard he is standing in.
    uPRipple: { value: new THREE.Vector4(4.6, 0.30, 0.40, 0.16) },
    uPBand: { value: new THREE.Vector4(2.2, 0.06, 0.14, 0.20) },
    uPFres: { value: new THREE.Vector4(0.17, 2.2, 0.13, 0.6) },
    // Grease does not mirror the sky, it catches the burner. `KPAL.flameCore` is the
    // warm light-catch this pool is actually lit by and is reserved chroma, so the
    // link cannot drift out from under it — the same argument the sheen streak above
    // already makes for pinning to `KPAL.flame`.
    uPSky: { value: new THREE.Color().setStyle(KPAL.flameCore, THREE.SRGBColorSpace) },
  } : {
    uPTime: { value: 0 },
    // The drip point `makeWaterSurfaceTexture` draws its rings around, in UV.
    uPDrip: { value: new THREE.Vector2(0.46, 0.52) },
    uPRipple: { value: new THREE.Vector4(16.0, 1.7, 0.35, 0.46) },
    uPBand: { value: new THREE.Vector4(0.9, 0.30, 0.25, 0.075) },
    uPFres: { value: new THREE.Vector4(0.34, 1.4, 0.34, 1.0) },
    uPSky: { value: new THREE.Color().setHex(PUDDLE_SKY_HEX, THREE.SRGBColorSpace) },
  };
  m.onBeforeCompile = (shader) => {
    Object.assign(shader.uniforms, uniforms);
    shader.vertexShader = patchPuddleVertex(shader.vertexShader);
    shader.fragmentShader = patchPuddleFragment(shader.fragmentShader);
  };
  m.customProgramCacheKey = () => PUDDLE_PROGRAM_KEY;
  return { mat: m, uniforms };
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
  // The pool's own outline. Seeded per kind, so the two pools are different shapes
  // and each is the SAME shape on every load — see `puddleProfile`.
  const profile = puddleProfile(isGrease ? 51712026 : 20260812, isGrease ? GREASE_LOBES : WATER_LOBES);
  // The pool's own value key. See the `GREASE_BODY_L_DROP` note above: grease only —
  // the water pool is the north hazard, no character fails a station on it (mean dL
  // +0.274 at `water_near`), and it is already the darker of the two after the round
  // that pulled both bodies down.
  // `nonOccluding` is what stops the pool depth-rejecting the fighter's own contact
  // decal — see the long note on `PUDDLE_RENDER_ORDER`.
  const bodyMat = nonOccluding(isGrease ? darkenedBody(mat, GREASE_BODY_L_DROP) : mat);

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
  // Same value `buildContactShadow` already sets, restated here because it is now
  // ORDER and not the depth buffer that keeps this underneath the pool.
  shadow.renderOrder = PUDDLE_RENDER_ORDER.halo;
  g.add(shadow);
  // This group is never yawed (see the positioning note above), so the world shadow
  // direction is also the local one.
  applyContactRamp(shadow);

  // Was `new THREE.CircleGeometry(R, 32)`. Kept in the record per the reversal rule:
  // a 32-segment disc is a perfect circle, and Uri read the pool as a circle because
  // it WAS one — at every contour, not just this one.
  const disc = mesh(lobedDiscGeometry(R, profile), bodyMat, 'puddle');
  disc.rotation.x = -Math.PI / 2;
  disc.position.set(gp.x, PUDDLE_PLANE_Y, gp.z);
  disc.renderOrder = PUDDLE_RENDER_ORDER.body;
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
  const { mat: surfMat, uniforms: surfUniforms } = puddleSurfaceMaterial(isGrease, surfTex);
  const surf = new THREE.Mesh(lobedDiscGeometry(R * 0.97, profile), surfMat);
  // THE ONE PER-FRAME HOOK, and it is entirely inside this file. three calls
  // `onBeforeRender` on each drawable immediately before submitting it
  // (`WebGLRenderer.renderObject`), so the phase advances exactly when the pool is
  // drawn and stops dead when it is not — which is what makes every existing
  // rAF-freezing capture tool in this repo still reproducible without being told
  // anything. `ambient.ts` drives the pot the other way, through `arena.update`, and
  // that file is not this owner's to edit; this needs nobody's cooperation.
  surf.onBeforeRender = () => { surfUniforms.uPTime.value = puddleSeconds(); };
  surf.name = isGrease ? 'puddle_grease_surface__no_outline' : 'puddle_water_surface__no_outline';
  surf.rotation.x = -Math.PI / 2;
  surf.position.set(gp.x, PUDDLE_PLANE_Y, gp.z);
  // Was 2 — a tie with the character contact decal, and the tie-break is a depth sort
  // that put the sheen ON TOP of the shadow. See `PUDDLE_RENDER_ORDER`.
  surf.renderOrder = PUDDLE_RENDER_ORDER.surf;
  noOutline(surf);
  g.add(surf);

  // Thin wet rim tracing the real edge, in the caller's own material (`M.greaseRim`/
  // `M.waterRim`, now muted wet-edge tones — see the KPAL note in `shared.ts`). Just
  // enough of a boundary line that the puddle's edge doesn't dissolve into the tile —
  // the same "wet edge" a real spill leaves, not a hazard marking; there is
  // deliberately no second bold accent band, glow halo or icon ring on top of it.
  const trimW = R * 0.045;
  const trim = mesh(
    // Was `new THREE.RingGeometry(R - trimW, R + trimW, 40)` — a perfect annulus, so
    // the pool's sharpest contour was the roundest thing in it. Same width, same
    // material, traced on the body's own outline instead.
    lobedRingGeometry(R, trimW, profile),
    // Opaque at y = 0.25, so it stamped depth 16 cm above the character's contact
    // decal and cut a hard ring through it for any fighter standing near the pool's
    // edge. See `PUDDLE_RENDER_ORDER`: opacity is untouched, only the queue moves.
    nonOccluding(rimMat),
    'puddle_wet_rim'
  );
  trim.rotation.x = -Math.PI / 2;
  trim.position.set(gp.x, PUDDLE_PLANE_Y, gp.z);
  trim.renderOrder = PUDDLE_RENDER_ORDER.rim;
  noOutline(trim);
  g.add(trim);

  return g;
}
