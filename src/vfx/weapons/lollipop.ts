/**
 * Lollipop weapon VFX.
 *
 * Weapon keys (`game/rules.ts` -> `CHARACTERS.lollipop.weapons`):
 *   `'Smash'` — Lollipop Smash, melee, `REACH.meleeStrong`, 80° cone. She swings
 *               herself like a hammer; the candy head is the business end.
 *   `'Giant'` — Giant Lollipop, melee, `REACH.ultimateSlam`, 360° cone,
 *               `giantSlam: true`. The ultimate.
 *
 * Neither weapon is `ranged`, so `projectile`/`trail` have nothing to attach to —
 * `cast`/`impact` are the only meaningful hooks here.
 *
 * ── 🚨 READ THIS FIRST. THE CONSTRAINT BELOW INVERTED ON 2026-08-21 (`afad1ca`). ──
 *
 * Everything from here to "VERIFIED, NOT ASSUMED" was written for a **400 wu** slam and
 * is kept verbatim, because the premise it records is exactly what Uri overruled:
 *
 *   > *"If the question is whether the giant should catch everything in the visible
 *   > screen, the answer is almost, but it shouldn't catch everything in the map."*
 *
 * `REACH.ultimateSlam` is now `GUARANTEED_VISIBLE_RADIUS - BODY_LENGTH` =
 * **157.22 wu (7.86 m)**, down from 400 (20 m). The consequence is not a smaller number;
 * it is the **reversal of this file's founding constraint**:
 *
 *      THE CASTER IS NOW ALWAYS ON SCREEN WHEN THE SLAM CAN REACH YOU.
 *
 * 157.22 < 199.22, and `FAIR_PLAY.radiusUnits` is *"the disc every supported device is
 * guaranteed to show around the player"* on every supported aspect ratio. So an opponent
 * close enough to hit you with this weapon is inside that disc **with exactly one body
 * length (42 wu) of margin** — that margin IS the derivation. The off-screen case this
 * file was built to survive can no longer occur.
 *
 * ⚠️ **NOTHING BELOW WAS EDITED TO ACHIEVE THAT, AND THAT IS THE POINT.** `afad1ca`
 * touched `rules.ts` and nothing else — `src/vfx/**` and `src/game/vfx.ts` are BYTE
 * IDENTICAL across it. The drawing followed on its own because the AOE reads
 * `const R = wu(ctx.weapon.range ?? 0)` and every element scales off `R`. Measured,
 * paired, on detached worktrees of `f11b6c6` and `afad1ca` (which differ only in
 * `rules.ts`), shipped `spawnWeaponCast` cast beat, 800x450 readback, delta >= 6:
 *
 *     pitch 58, SHIPPED match framing   260,963 px (72.5% of frame)  ->  115,635 (32.1%)
 *       painted bbox                    799x449 of 800x450           ->  499x359
 *     pitch 20 detector, 400 wu wide     66,296 px (18.4%)           ->    9,478  (2.8%)
 *
 * **At 400 wu the effect had NO EDGE ANYWHERE ON SCREEN. At 157.22 it has one on three
 * sides.** Five other weapon rows measured in the same runs are byte-identical across
 * the two arms (`hamburger.Smash` 6533, `.Tomato` 437, `.Lettuce` 702, `.Onion` 718,
 * `lollipop.Smash` 6988), which is the paired null control, and the absolute-px floor
 * from that run is **0.0%** — so the -55.7% is EXACT, not a move inside a floor. Drift
 * control (frozen frame vs itself, x3): 0, 0, 0 px. (`tools/tmp/wv_area.mjs`,
 * `tools/tmp/gv_slam.mjs`.)
 *
 * ⚠️ **WHAT THAT SLACKENS, NOT TAKEN HERE, AND PRICED SO NOBODY RE-DERIVES IT.** Three
 * numbers below were forced by the 20 m disc and are now merely CHOICES: the AOE fill's
 * `0.3` alpha and the swirl's `0.4` (cut because at 20 m the disc *"erased the arena
 * outright"* — at 7.86 m it repaints a third of the frame, not three quarters); the
 * sugar pops' retreat to the inner `POP_SPAN` 0.55 (its arithmetic — *"22 points over
 * 1257 m2 is one pop per 57 m2"* — is a 20 m calculation; the whole 157.22 wu disc is
 * 194 m2, so ten pops spread over ALL of it would now be one per 19 m2, three times
 * denser than the density that was rejected); and `FRONT_TIME` 0.46 s, which now carries
 * the rim 7.86 m instead of 20 m, i.e. at 17.1 m/s instead of 43.5. **All three are
 * legibility judgements, and this pass changed none of them** — a taste move without a
 * critic round is what `docs/LESSONS.md` exists to prevent. They are recorded as open.
 *
 * ── THE PROJECT-WIDE CONSTRAINT THIS FILE EXISTS TO SATISFY (⚠️ SUPERSEDED — see above)
 *
 * `REACH.ultimateSlam` is 400 wu — 2.0x `FAIR_PLAY.radiusUnits` (199.2 wu), the
 * radius the camera guarantees is visible in every direction on every aspect ratio.
 * `render/camera.ts` deliberately EXCLUDES `giantSlam` from that calculation
 * (covering it would demand a ~918 wu fair radius, pushing the camera so far out that
 * characters shrink to a speck and the whole weapon-range rebalance is undone). That
 * exclusion is only legitimate because of one promise:
 *
 *      THE GIANT SLAM TELL MUST BE READABLE WITH THE CASTER OFF SCREEN.
 *
 * So the tell here cannot be "something big happens at the caster". At 16:9 the
 * visible ground reaches 199 wu near/far and 289 wu to each side, while the caster
 * can legally be a full 400 wu away — comfortably outside the frame in every
 * direction. Everything anchored to the epicentre (the falling giant lollipop, and
 * `game/vfx.ts`'s own `spawnGiantSlamShockwave` flash/star-pop, which still fires
 * alongside this hook) is therefore a BONUS beat, not the tell.
 *
 * The tell is the three elements that reach the player wherever they are standing:
 *
 *   1. `AOE FILL` — a red/white candy SWIRL painted across the ability's true
 *      `weapon.range` radius (20 m). Its radius is twice the guaranteed view radius,
 *      so whenever the slam can legally reach you, a large fraction of your screen —
 *      all of it, if you are inside ~10 m — turns into a rotating lollipop swirl.
 *      Screen-filling by construction, not by being "big near the caster".
 *   2. `BOUNDARY` — a hard two-tone candy line at the disc's edge. This is the single
 *      strongest DIRECTIONAL cue in the whole effect and the reason the off-screen
 *      case works at all: a circular arc points at its own centre, so the player reads
 *      "it came from over there" off the curvature. A soft gradient does not.
 *   3. `RACING RIM` — a striped candy shock band expanding to that same radius, so
 *      the boundary sweeps THROUGH the player. Motion at the screen edge is what the
 *      eye actually catches when the thing causing it is off frame.
 *
 * plus `SUGAR POPS` near the epicentre, as texture on the centre of the effect only.
 *
 * ── VERIFIED, NOT ASSUMED (2026-08-04) — ⚠️ AND THE RECIPE IS NOW UNREACHABLE ──
 *
 * 🚨 The reproduction below is kept because the METHOD is still right and the VERDICT is
 * still the record of what a 400 wu slam looked like. **The STATE it reproduces can no
 * longer occur.** It works by letting the AI close until it is inside `range` and fire —
 * at 400 wu that put the caster at ~398 wu, off frame. At 157.22 wu the same procedure
 * fires the ultimate at ~157 wu, which is INSIDE the 199.22 wu disc the camera guarantees
 * around you. **There is no distance at which this weapon can be fired at you from off
 * screen any more.** Anyone re-running `lolliv.mjs --mode incoming` to re-check the
 * off-screen tell will get a caster in frame and should not read that as a regression.
 *
 * Everything above was authored without ever being rendered. It has now been driven
 * in the live game and looked at. The way to reproduce the off-screen case with no
 * scripted aiming at all is `?player=donut&enemy=lollipop`: `ai.ts` picks the
 * highest-damage weapon whose range covers the current distance, and since Smash
 * (11 dmg) only reaches 70 wu while Giant (10 dmg) reaches 400, the AI closes from
 * its 1080 wu spawn separation and fires the ultimate the first tick it is inside
 * 400 wu — 20 m, against a widest guaranteed view half-extent of 14.45 m at 16:9 and
 * 9.96 m at 4:3. The caster is off screen by construction. (`tools/tmp/lolliv.mjs`.)
 *
 * VERDICT: the tell passes. At 4:3, distance 398 wu, caster projecting to screen
 * x=1284 in a 1200 px viewport, the frame is more than half filled with a red-and-
 * white candy swirl whose boundary arc curves around the player, and the centre of
 * that arc is the direction the slam came from. What did NOT survive contact with a
 * render is recorded at each element below — the ink budget, the missing hard edge,
 * the epicentre prop, and the pops.
 *
 * ONE THING THIS FILE CANNOT FIX, for whoever owns it next: the slam RESOLVES on the
 * same sim tick it is cast (melee damage is instantaneous in `combat.ts`), so this is
 * not a warning you can dodge — it is an attribution cue that arrives with the damage.
 * The fairness argument in `render/camera.ts` reads as though the visual were a
 * warning. It is not, and cannot be, without a wind-up in the SIM. What it does
 * deliver is "something enormous just hit me, from over there", which is what an
 * off-screen attacker actually owes you.
 *
 * REPRODUCING ANY OF THIS: `node tools/tmp/lolliv.mjs --mode incoming|self`. It
 * replaces `performance.now` with a virtual clock (three's `Clock` reads it, and every
 * sim/VFX delta derives from that clock), so an effect can be frozen and hand-cranked
 * in exact millisecond slices. That matters more than it sounds: under the headless
 * software renderer at `simSpeed > 1`, ONE rendered frame can consume 50 ms * simSpeed
 * of effect time, and a 0.2 s effect then exists for a single frame. Sampling by
 * wall-clock timeout misses it entirely and it looks like the effect is not rendering
 * — which is exactly what happened here to `Smash.cast` before a garish-colour probe
 * proved the pipeline was fine and the SAMPLING was wrong.
 *
 * ── SCALE DISCIPLINE ──────────────────────────────────────────────────────────
 * The shared impact burst was recently rescaled after measuring 4.72 m of effect
 * against a 2.10 m character. Every ordinary-hit dimension below is expressed as a
 * fraction of `CHARACTER_HEIGHT` for the same reason `game/vfx.ts` now is: at shipped
 * framing a fighter is only ~13% of frame height, and an effect that hides the thing
 * it is reporting on has stopped being feedback. Impact debris here is 0.15-0.20 CH
 * per piece and the largest opaque element of an ordinary hit is ~0.8 CH; the
 * ground stamp deliberately sits on the FLOOR rather than at chest height, so the
 * character's silhouette is never painted over by its own hit.
 *
 * The ultimate is the one sanctioned exception, and only in AREA — it is 20 m of
 * translucent ground fill, not 20 m of opaque bloom.
 * ⚠️ **7.86 m since `afad1ca`, not 20** — the sentence's POINT (translucent, not opaque)
 * is unchanged and is now easier to honour, since the exception it asks for is a
 * quarter the size. The two `20 m` figures are kept as the record of what the rule was
 * written against.
 */

import * as THREE from 'three';
import { CHARACTER_HEIGHT, wu } from '../../units';
import type { CharacterWeaponVfxMap, WeaponVfxCtx } from './types';

// ─────────────────────────────────────────────────────────────────────────────
// Palette — matched to `characters/lollipop.ts` so the VFX reads as HER candy and
// not as generic red. Authored at the colour actually wanted: the post chain no
// longer clips channels (hue arrives within ~4°, saturation is monotone), so there
// is nothing to pre-compensate for.
// ─────────────────────────────────────────────────────────────────────────────

const CANDY_RED = '#E63946';   // == lollipop.ts CANDY_RED, == Weapon.color for both
const CANDY_WHITE = '#FFFDF9'; // == lollipop.ts CANDY_WHITE
const CANDY_MINT = '#00E5B0';  // == RARITY_COLORS.Cyber, her rarity trim. Accent only.
const SUGAR_GLOW = '#FFEAF1';  // warm pale pink for additive sugar dust

// ─────────────────────────────────────────────────────────────────────────────
// Ground-plane heights (metres).
//
// The ground layer stack is crowded and things have been silently buried in it
// repeatedly: floor pads 0.045-0.048, seams 0.062, baked contact shadows
// 0.068-0.070, prop kicks 0.080, arena decals 0.15-0.25, `game/vfx.ts`'s splats
// 0.17 / trail marks 0.19 / melee arcs + rings 0.24-0.26 / status rings 0.30.
// Everything flat this file draws therefore starts ABOVE 0.30, and every
// transparent material sets `depthWrite: false` — a `transparent: true` material
// still writes depth by THREE's default and will silently occlude whatever is
// behind it (that trap has cost this project a full round already).
// ─────────────────────────────────────────────────────────────────────────────

const AOE_FILL_Y = 0.32;
const AOE_SWIRL_Y = 0.34;
const AOE_RIM_Y = 0.36;
const STAMP_Y = 0.33;

/** How long the shock front takes to reach `weapon.range`, seconds. Sugar pops are
 * scheduled against this so the ground cracks open just as the rim arrives. */
const FRONT_TIME = 0.46;

// ─────────────────────────────────────────────────────────────────────────────
// Canvas textures — built once at module scope.
// ─────────────────────────────────────────────────────────────────────────────

function makeCanvasCtx(size: number): CanvasRenderingContext2D {
  const canvas = document.createElement('canvas');
  canvas.width = size;
  canvas.height = size;
  return canvas.getContext('2d')!;
}

function finishTex(ctx: CanvasRenderingContext2D): THREE.CanvasTexture {
  const tex = new THREE.CanvasTexture(ctx.canvas);
  // These are sampled at a grazing angle across most of the frame (58°-pitched
  // camera, and the AOE disc is 40 m across) — anisotropy 1 averages the swirl arms
  // into mush at the far edge before they ever reach a pixel.
  // ⚠️ **15.7 m across since `afad1ca`, not 40.** The grazing-angle argument is
  // unchanged (a 58° pitch does not care how wide the disc is) and 8 is now more
  // headroom than the case needs, so this is LEFT ALONE: lowering it would be a
  // micro-optimisation traded against a texture the whole ultimate's identity rests on.
  tex.anisotropy = 8;
  tex.needsUpdate = true;
  return tex;
}

/**
 * THE identity texture: a five-armed candy spiral, white on transparent, tinted by
 * whatever material carries it.
 *
 * This is what makes the ultimate say *Lollipop* rather than "a big red AOE". A
 * critic looking at a frame with the caster off screen has to be able to name the
 * ability from the ground alone, and a plain tinted circle cannot do that — the
 * spiral is the only element in the effect that is unambiguously a lollipop.
 * Constant ANGULAR arm width (not constant arc width) is what a real swirl does.
 */
function buildSwirlTexture(): THREE.CanvasTexture {
  const size = 512;
  const ctx = makeCanvasCtx(size);
  const c = size / 2;
  const R = c;
  const ARMS = 5;
  const TURNS = 1.15;
  const halfW = (Math.PI / ARMS) * 0.52;
  const STEPS = 56;

  ctx.fillStyle = '#ffffff';
  for (let k = 0; k < ARMS; k++) {
    const phase = (k / ARMS) * Math.PI * 2;
    ctx.beginPath();
    for (let i = 0; i <= STEPS; i++) {
      const r = (i / STEPS) * R;
      const th = phase + TURNS * Math.PI * 2 * (r / R) - halfW;
      const x = c + Math.cos(th) * r;
      const y = c + Math.sin(th) * r;
      if (i === 0) ctx.moveTo(x, y);
      else ctx.lineTo(x, y);
    }
    for (let i = STEPS; i >= 0; i--) {
      const r = (i / STEPS) * R;
      const th = phase + TURNS * Math.PI * 2 * (r / R) + halfW;
      ctx.lineTo(c + Math.cos(th) * r, c + Math.sin(th) * r);
    }
    ctx.closePath();
    ctx.fill();
  }

  // Feather the outer edge so the arms don't terminate on the polygon boundary.
  ctx.globalCompositeOperation = 'destination-out';
  const g = ctx.createRadialGradient(c, c, R * 0.9, c, c, R);
  g.addColorStop(0, 'rgba(0,0,0,0)');
  g.addColorStop(1, 'rgba(0,0,0,1)');
  ctx.fillStyle = g;
  ctx.fillRect(0, 0, size, size);
  ctx.globalCompositeOperation = 'source-over';

  return finishTex(ctx);
}

/**
 * The fill under the swirl: mostly-even alpha with a brighter lip right at the rim,
 * so the ability's true boundary reads as an EDGE. That edge is gameplay
 * information — it is the line between "the slam reaches here" and "it doesn't" —
 * and a soft radial falloff would erase it.
 */
function buildAoeFillTexture(): THREE.CanvasTexture {
  const size = 256;
  const ctx = makeCanvasCtx(size);
  const c = size / 2;
  const g = ctx.createRadialGradient(c, c, 0, c, c, c);
  g.addColorStop(0.0, 'rgba(255,255,255,0.62)');
  g.addColorStop(0.55, 'rgba(255,255,255,0.58)');
  g.addColorStop(0.88, 'rgba(255,255,255,0.8)');
  g.addColorStop(0.975, 'rgba(255,255,255,1)');
  g.addColorStop(1.0, 'rgba(255,255,255,0)');
  ctx.fillStyle = g;
  ctx.fillRect(0, 0, size, size);
  return finishTex(ctx);
}

/**
 * The racing shock band, baked as an annulus into a full-disc texture (one shared
 * unit-disc geometry serves fill, swirl and rim — only the map and the scale
 * differ). Alternating radial stripes make it read as candy rather than as a
 * generic shockwave ring, and they give the band internal detail so its MOTION is
 * legible even when it is the only part of the effect on screen.
 */
function buildRimBandTexture(): THREE.CanvasTexture {
  const size = 512;
  const ctx = makeCanvasCtx(size);
  const c = size / 2;
  const R = c;
  const inner = R * 0.74;

  ctx.fillStyle = '#ffffff';
  ctx.beginPath();
  ctx.moveTo(c + R, c);
  ctx.arc(c, c, R, 0, Math.PI * 2, false);
  ctx.moveTo(c + inner, c);
  ctx.arc(c, c, inner, 0, Math.PI * 2, true);
  ctx.fill();

  ctx.globalCompositeOperation = 'destination-out';

  // Candy stripes — knocked back rather than punched out, so the band stays a
  // continuous wall of light with stripes IN it, not a dashed line.
  const STRIPES = 40;
  ctx.fillStyle = 'rgba(0,0,0,0.5)';
  for (let i = 0; i < STRIPES; i++) {
    const a0 = (i / STRIPES) * Math.PI * 2;
    const a1 = a0 + Math.PI / STRIPES;
    ctx.beginPath();
    ctx.moveTo(c, c);
    ctx.arc(c, c, R, a0, a1);
    ctx.closePath();
    ctx.fill();
  }

  const gOut = ctx.createRadialGradient(c, c, R * 0.96, c, c, R);
  gOut.addColorStop(0, 'rgba(0,0,0,0)');
  gOut.addColorStop(1, 'rgba(0,0,0,1)');
  ctx.fillStyle = gOut;
  ctx.fillRect(0, 0, size, size);

  const gIn = ctx.createRadialGradient(c, c, inner, c, c, inner * 1.22);
  gIn.addColorStop(0, 'rgba(0,0,0,1)');
  gIn.addColorStop(1, 'rgba(0,0,0,0)');
  ctx.fillStyle = gIn;
  ctx.fillRect(0, 0, size, size);

  ctx.globalCompositeOperation = 'source-over';
  return finishTex(ctx);
}

/**
 * A HARD, thin annulus at the very edge of the unit disc — the ability's boundary.
 *
 * The fill texture's own bright lip was supposed to do this job and does not: at 0.44
 * material alpha the lip is a soft value change inside a soft field, and the first
 * independent critic to see a render said so exactly — *"there is no outer boundary at
 * all, the lower-left just dissolves into haze, so I cannot tell where safe ground
 * begins"*, and named a crisp high-contrast rim arc as the single most valuable fix.
 *
 * That line is gameplay information, not decoration: it is the difference between
 * "the slam reaches here" and "it doesn't", and it is also the cue a player uses to
 * extrapolate the off-screen centre — a circular arc points at its own middle, a
 * gradient does not. Hard alpha, feathered only enough to hide the 96-gon facets.
 */
function buildEdgeRingTexture(): THREE.CanvasTexture {
  const size = 512;
  const ctx = makeCanvasCtx(size);
  const c = size / 2;
  const g = ctx.createRadialGradient(c, c, 0, c, c, c);
  g.addColorStop(0.0, 'rgba(255,255,255,0)');
  // Band width is a two-critic interpolation, not a guess. The first said there was no
  // edge at all; the second, shown this ring, called it "the single most legible thing
  // in the frame" and then said it was about twice as thick as it needs to be and was
  // starting to read as a painted racetrack line. Thinned ~a third from what that
  // second critic saw. Do not thin it further without re-rendering: at R = 20 m this
  // is a ~0.7 m band seen almost edge-on, and it turns into an aliasing generator well
  // before it looks elegant.
  g.addColorStop(0.966, 'rgba(255,255,255,0)');
  g.addColorStop(0.976, 'rgba(255,255,255,1)');
  g.addColorStop(0.991, 'rgba(255,255,255,1)');
  g.addColorStop(1.0, 'rgba(255,255,255,0)');
  ctx.fillStyle = g;
  ctx.fillRect(0, 0, size, size);
  return finishTex(ctx);
}

/** Soft radial dot for additive sugar dust. */
function buildSugarTexture(): THREE.CanvasTexture {
  const size = 64;
  const ctx = makeCanvasCtx(size);
  const c = size / 2;
  const g = ctx.createRadialGradient(c, c, 0, c, c, c);
  g.addColorStop(0, 'rgba(255,255,255,1)');
  g.addColorStop(0.35, 'rgba(255,255,255,0.8)');
  g.addColorStop(1, 'rgba(255,255,255,0)');
  ctx.fillStyle = g;
  ctx.fillRect(0, 0, size, size);
  return finishTex(ctx);
}

const swirlTex = buildSwirlTexture();
const aoeFillTex = buildAoeFillTexture();
const rimBandTex = buildRimBandTexture();
const edgeRingTex = buildEdgeRingTexture();
const sugarTex = buildSugarTexture();

// ─────────────────────────────────────────────────────────────────────────────
// Geometry — built once, scaled per spawn.
// ─────────────────────────────────────────────────────────────────────────────

/**
 * Unit disc lying in the XZ plane, shared by every flat element in this file.
 *
 * Baked flat with `geometry.rotateX` rather than `mesh.rotation.x = -PI/2` on
 * purpose: composing `rotation.x` and then `rotation.y` does NOT spin a flat plane
 * about world up (Euler angles are intrinsic and sequential — the plane tips
 * edge-on and vanishes from a top-down camera). With the flatten baked into the
 * geometry, `mesh.rotation.y` is a pure world-up spin and the swirl can rotate
 * safely.
 */
const unitDiscGeo = new THREE.CircleGeometry(1, 96);
unitDiscGeo.rotateX(-Math.PI / 2);

/**
 * A broken candy chip: a rounded BUTTON, not a sliver.
 *
 * Deliberately the opposite silhouette from `waterbottle.ts`'s Glass shards (a thin
 * stretched octahedron). Boiled sugar breaks into thick glossy chunks with rounded
 * faces; glass breaks into needles. The debris shape is most of what tells the two
 * apart at gameplay distance, where colour is half-lost to the bloom.
 */
const chipGeo = new THREE.CylinderGeometry(1, 1, 0.34, 12);

/** The giant lollipop's head, slammed flat onto the arena. */
const giantHeadGeo = new THREE.CylinderGeometry(1, 1, 0.22, 44);
/** ...and its stick, oriented by quaternion (see `spawnGiantLollipop`). */
const giantStickGeo = new THREE.CylinderGeometry(0.055, 0.055, 1, 10);

// ─────────────────────────────────────────────────────────────────────────────
// Material pools — same discipline as the two reference conversions: independently
// fading simultaneous pieces each need their own `opacity`, so a small round-robin
// pool avoids a `clone()` allocation per spawn.
// ─────────────────────────────────────────────────────────────────────────────

function materialPool<T extends THREE.Material>(size: number, build: () => T): () => T {
  const pool = Array.from({ length: size }, build);
  let i = 0;
  return () => pool[i++ % size];
}

const nextFillMat = materialPool(3, () => new THREE.MeshBasicMaterial({
  map: aoeFillTex, color: CANDY_RED, transparent: true, opacity: 0.6, depthWrite: false,
}));
// Each swirl consumer gets its OWN pool. They were sharing one pool of 6 and setting
// `color` per spawn: two Smash casts (4 materials each) inside the ultimate's 1.0 s
// life wrapped the ring and recoloured the live AOE swirl mid-flight, which would have
// shown up as the ultimate turning red and blinking. Verified-by-rendering effects
// should not be able to corrupt each other from a neighbouring weapon.
const nextAoeSwirlMat = materialPool(2, () => new THREE.MeshBasicMaterial({
  map: swirlTex, color: CANDY_WHITE, transparent: true, opacity: 0.5, depthWrite: false,
}));
const nextGiantSwirlMat = materialPool(2, () => new THREE.MeshBasicMaterial({
  map: swirlTex, color: CANDY_RED, transparent: true, opacity: 0.9, depthWrite: false,
}));
const nextSwingMat = materialPool(6, () => new THREE.MeshBasicMaterial({
  map: swirlTex, color: CANDY_WHITE, transparent: true, opacity: 0.9, depthWrite: false,
}));
const nextRimMat = materialPool(3, () => new THREE.MeshBasicMaterial({
  map: rimBandTex, color: CANDY_WHITE, transparent: true, opacity: 1, depthWrite: false,
  blending: THREE.AdditiveBlending,
}));
// Two boundary rings, one saturated and one pale. Neither colour alone survives both
// backgrounds this ability lands on — red carries the edge over the arena's pale tile
// and white carries it over the effect's own red fill — so the boundary is authored as
// a candy TWO-TONE line rather than betting on one of them.
const nextEdgeRedMat = materialPool(4, () => new THREE.MeshBasicMaterial({
  map: edgeRingTex, color: CANDY_RED, transparent: true, opacity: 1, depthWrite: false,
}));
const nextEdgeWhiteMat = materialPool(2, () => new THREE.MeshBasicMaterial({
  map: edgeRingTex, color: CANDY_WHITE, transparent: true, opacity: 1, depthWrite: false,
}));
const nextStampMat = materialPool(10, () => new THREE.MeshBasicMaterial({
  map: swirlTex, color: CANDY_RED, transparent: true, opacity: 0.9, depthWrite: false,
}));
const nextChipRedMat = materialPool(14, () => new THREE.MeshBasicMaterial({ color: CANDY_RED, transparent: true, opacity: 1 }));
const nextChipWhiteMat = materialPool(14, () => new THREE.MeshBasicMaterial({ color: CANDY_WHITE, transparent: true, opacity: 1 }));
const nextSugarMat = materialPool(24, () => new THREE.SpriteMaterial({
  map: sugarTex, color: SUGAR_GLOW, transparent: true, opacity: 1, depthWrite: false,
  blending: THREE.AdditiveBlending,
}));
const nextMintMat = materialPool(12, () => new THREE.SpriteMaterial({
  map: sugarTex, color: CANDY_MINT, transparent: true, opacity: 1, depthWrite: false,
  blending: THREE.AdditiveBlending,
}));
// The ultimate's pops are NOT additive. They sit on top of the ultimate's own white
// candy fill, and additive white-on-white is arithmetically invisible — the same
// "rendering correctly, perfectly invisible" failure as a cyan ring on a cyan puddle.
// Normal-blended saturated candy is the only thing that can read against that ground.
const nextPopRedMat = materialPool(12, () => new THREE.SpriteMaterial({
  map: sugarTex, color: CANDY_RED, transparent: true, opacity: 1, depthWrite: false,
}));
const nextPopMintMat = materialPool(5, () => new THREE.SpriteMaterial({
  map: sugarTex, color: CANDY_MINT, transparent: true, opacity: 1, depthWrite: false,
}));
const nextGiantHeadMat = materialPool(2, () => new THREE.MeshBasicMaterial({ color: CANDY_WHITE, transparent: true, opacity: 1 }));
const nextGiantStickMat = materialPool(2, () => new THREE.MeshBasicMaterial({ color: '#FBF7EE', transparent: true, opacity: 1 }));

// ─────────────────────────────────────────────────────────────────────────────
// Shared spawn helpers
// ─────────────────────────────────────────────────────────────────────────────

/**
 * One flat swirl "stamp" on the ground — the mark a candy head leaves where it hit.
 * `radiusM` is a RADIUS: a 0.42 CH stamp is 0.84 CH across.
 */
function spawnSwirlStamp(
  ctx: WeaponVfxCtx,
  x: number,
  z: number,
  radiusM: number,
  life: number,
  peakOpacity: number,
): void {
  const mat = nextStampMat();
  const mesh = new THREE.Mesh(unitDiscGeo, mat);
  mesh.position.set(x, STAMP_Y, z);
  mesh.rotation.y = Math.random() * Math.PI * 2;
  mesh.renderOrder = 12;
  const spin = (Math.random() < 0.5 ? -1 : 1) * (2.4 + Math.random() * 1.2);
  const startY = mesh.rotation.y;
  mesh.scale.setScalar(radiusM * 0.35);
  ctx.spawnTransient(mesh, life, (t) => {
    // Snaps open, then eases — a stamp lands, it does not inflate.
    const grow = 1 - Math.pow(1 - Math.min(1, t * 3.2), 3);
    mesh.scale.setScalar(radiusM * (0.35 + 0.65 * grow));
    mesh.rotation.y = startY + spin * t * 0.35;
    mat.opacity = peakOpacity * (1 - Math.pow(t, 1.6));
  });
}

/** A single tumbling candy chip, launched ballistically. */
function spawnCandyChip(
  ctx: WeaponVfxCtx,
  origin: { x: number; y: number; z: number },
  dirX: number,
  dirZ: number,
  speed: number,
  scale: number,
  life: number,
): void {
  const mat = Math.random() < 0.45 ? nextChipRedMat() : nextChipWhiteMat();
  const chip = new THREE.Mesh(chipGeo, mat);
  chip.scale.setScalar(scale);
  chip.position.set(origin.x, origin.y, origin.z);
  chip.rotation.set(Math.random() * Math.PI, Math.random() * Math.PI, Math.random() * Math.PI);
  const ox = origin.x;
  const oy = origin.y;
  const oz = origin.z;
  const vy = 1.5 + Math.random() * 1.9;
  const gravity = -9.4;
  const spinX = (Math.random() - 0.5) * 16;
  const spinZ = (Math.random() - 0.5) * 16;
  ctx.spawnTransient(chip, life, (t, elapsed) => {
    chip.position.set(
      ox + dirX * speed * elapsed,
      Math.max(0.08, oy + vy * elapsed + 0.5 * gravity * elapsed * elapsed),
      oz + dirZ * speed * elapsed,
    );
    chip.rotation.x += spinX * 0.016;
    chip.rotation.z += spinZ * 0.016;
    mat.opacity = 1 - Math.pow(t, 2.2);
  });
}

/** A puff of additive sugar dust. `nextMat` picks the palette (sugar vs mint). */
function spawnSugarMote(
  ctx: WeaponVfxCtx,
  x: number,
  y: number,
  z: number,
  startScale: number,
  endScale: number,
  life: number,
  rise: number,
  nextMat: () => THREE.SpriteMaterial = nextSugarMat,
  delay = 0,
): void {
  const mat = nextMat();
  const sprite = new THREE.Sprite(mat);
  sprite.position.set(x, y, z);
  sprite.scale.set(startScale, startScale, 1);
  sprite.renderOrder = 14;
  sprite.visible = delay <= 0;
  const drift = (Math.random() - 0.5) * 0.5;
  ctx.spawnTransient(sprite, life + delay, (t, elapsed) => {
    if (elapsed < delay) {
      sprite.visible = false;
      return;
    }
    sprite.visible = true;
    const u = Math.min(1, (elapsed - delay) / life);
    const s = THREE.MathUtils.lerp(startScale, endScale, u);
    sprite.scale.set(s, s, 1);
    sprite.position.y = y + rise * u;
    sprite.position.x = x + drift * u;
    mat.opacity = 1 - Math.pow(u, 1.5);
    void t;
  });
}

/**
 * The epicentre beat: the actual GIANT LOLLIPOP, dropping onto the arena and lying
 * there face-up for a moment. Explicitly a bonus, not the tell — it is only ever on
 * screen when the caster is, which is exactly the case the constraint at the top of
 * this file says we cannot rely on.
 *
 * 🚨 **AND THAT DEMOTION EXPIRED ON 2026-08-21 — THIS PROP IS NOW PART OF THE TELL FOR
 * FREE.** The sentence above is exactly right and its conclusion has flipped: at
 * `REACH.ultimateSlam` 157.22 wu the caster is inside the 199.22 wu guaranteed-visible
 * disc **whenever the slam can reach you**, so "only ever on screen when the caster is"
 * now means "always". Nothing here changed and nothing needs to; it is stated because
 * the next agent to read the demotion would otherwise budget for a bonus beat that is
 * in fact reliable. See the header for the measurement.
 *
 * ⚠️ Its GROUND COVERAGE is unchanged and is still an under-claim, but by far less:
 * `headRadius` 1.785 m = 35.7 wu at `fwd` 2.835 m = 56.7 wu reaches **92.4 wu** of
 * ground against a **157.22 wu** hitbox — **1.70x short, where `rules.ts` records it as
 * 4.3x short against the old 400.** `rules.ts` calls hitbox-and-prop *"one rule stated
 * in two places"*; that gap is now small enough that closing it is a real option rather
 * than an impossible one. NOT taken here — the prop's size is a silhouette decision
 * measured against `CHARACTER_HEIGHT` (see below), not a hitbox indicator.
 *
 * SIZED AND PLACED SO IT DOES NOT EAT THE CASTER. Measured at shipped framing on the
 * first render of this file: at 1.15 CH radius, centred on the cast point, the head
 * plus its swirl covered Lollipop completely for the whole 0.75 s — she was not
 * merely hard to find, she was absent, and so was anything standing next to her. It
 * now lands a body-length IN FRONT of her, at 0.66 CH, so the beat still reads as a
 * giant candy slammed into the floor while the fighter it belongs to stays on screen.
 *
 * The stick is oriented with a QUATERNION rather than composed Euler angles: laying
 * a Y-axis cylinder down along an arbitrary ground direction with `rotation.z` then
 * `rotation.y` is the same intrinsic-rotation trap that has already made one flat
 * plane vanish in this project.
 */
function spawnGiantLollipop(ctx: WeaponVfxCtx, x: number, z: number, dirX: number, dirZ: number): void {
  const headRadius = CHARACTER_HEIGHT * 0.85; // 1.79 m radius = 3.6 m across, vs a 2.1 m fighter
  const stickLen = CHARACTER_HEIGHT * 1.7;

  const group = new THREE.Group();
  // Push the whole prop clear of the caster along her facing. `ctx.position` is
  // already 0.7 m ahead of her; this puts the head's NEAR edge roughly at her front.
  const fwdLen = Math.hypot(dirX, dirZ) || 1;
  const fwd = headRadius + CHARACTER_HEIGHT * 0.5;
  group.position.set(x + (dirX / fwdLen) * fwd, 0, z + (dirZ / fwdLen) * fwd);

  // A saturated rim just proud of the head. The head is red-and-white candy sitting
  // inside a field of red-and-white candy, and the first critic to see it named that
  // camouflage: the prop is the frame's most explicit pointer at where the slam came
  // from, and it was disappearing into the stripes behind it. One flat ring separates
  // it from anything.
  const rimMat = nextEdgeRedMat();
  const rim = new THREE.Mesh(unitDiscGeo, rimMat);
  rim.scale.setScalar(headRadius * 1.16);
  rim.position.y = 0.115;
  rim.renderOrder = 12;
  group.add(rim);

  const headMat = nextGiantHeadMat();
  const head = new THREE.Mesh(giantHeadGeo, headMat);
  head.scale.set(headRadius, 1, headRadius);
  group.add(head);

  const swirlMat = nextGiantSwirlMat();
  const swirl = new THREE.Mesh(unitDiscGeo, swirlMat);
  swirl.scale.setScalar(headRadius * 0.99);
  swirl.position.y = 0.13;
  swirl.renderOrder = 13;
  group.add(swirl);

  const stickMat = nextGiantStickMat();
  const stick = new THREE.Mesh(giantStickGeo, stickMat);
  stick.scale.set(1, stickLen, 1);
  // Lay the +Y cylinder along the ground, pointing back behind the caster.
  const axis = new THREE.Vector3(-dirX, 0, -dirZ);
  if (axis.lengthSq() < 1e-6) axis.set(0, 0, -1);
  axis.normalize();
  stick.quaternion.setFromUnitVectors(new THREE.Vector3(0, 1, 0), axis);
  stick.position.set(axis.x * (headRadius + stickLen * 0.5) * 0.92, 0.05, axis.z * (headRadius + stickLen * 0.5) * 0.92);
  group.add(stick);

  const DROP_FROM = 5.2;
  const DROP_TIME = 0.09;
  const life = 0.75;
  ctx.spawnTransient(group, life, (t, elapsed) => {
    if (elapsed < DROP_TIME) {
      const u = elapsed / DROP_TIME;
      group.position.y = DROP_FROM * (1 - u * u); // accelerating fall
      group.scale.set(1, 1, 1);
    } else {
      // Land, squash, settle.
      const u = Math.min(1, (elapsed - DROP_TIME) / 0.16);
      group.position.y = 0;
      const squash = 1 - 0.55 * (1 - u) * Math.cos(u * Math.PI * 1.2);
      group.scale.set(1 + (1 - squash) * 0.22, Math.max(0.25, squash), 1 + (1 - squash) * 0.22);
    }
    const fade = t < 0.45 ? 1 : 1 - (t - 0.45) / 0.55;
    headMat.opacity = fade;
    stickMat.opacity = fade;
    swirlMat.opacity = 0.9 * fade;
    rimMat.opacity = fade;
  });
}

// ─────────────────────────────────────────────────────────────────────────────
// Giant Lollipop — THE WIND-UP, and it is the ONLY telegraph this weapon gets
//
// 🚨 READ `game/vfx.ts:spawnCastTelegraph`'s stand-down block before touching this.
// `Giant` is `giantSlam`, and the generic two-tone footprint DELIBERATELY REFUSES to
// draw for it: at `REACH.ultimateSlam` 400 wu / 360° the hitbox measured **259,315 px
// — 64.0% of the frame — held for the whole 1.5 s, 15 of 16 slices above 259,000**
// (`tools/tmp/tg_tele.mjs`). That shape has no edge on screen (400 wu is twice the
// radius the camera guarantees is visible) and no direction (360°), so it cannot tell
// anyone where to run; it just erases the arena. That refusal left this weapon with
// **no telegraph at all**, which the block names as a gap someone must close.
//
// This is that closure, and it inherits the refusal's reasoning:
//
//   * **The drawn footprint is NOT the hitbox, and says so.** It is the ground the
//     giant candy `spawnGiantLollipop` actually drops at the resolve — same forward
//     offset, same radius, derived from the same two expressions — so the wind-up
//     points at the object that is about to appear. It UNDER-claims the danger, which
//     is the safe direction: it reads "she is charging, here" and never "you are safe
//     outside this line" about a hit that reaches the whole map.
//   * **The two-tone construction is `game/vfx.ts`'s, reused rather than reinvented.**
//     A dark base at constant area answers WHERE and guarantees the sustain floor at
//     every slice; a bright fill scaling 0->1 answers WHEN; a rim carries the edge.
//     That is the measured shape, at a radius the camera can actually show.
//   * **And the card gets drawn.** *"Grows huge"* — the candy itself swells overhead
//     across the whole wind-up, which is the one clause no footprint can say.
//
// 🚨 AND IT IS DORMANT TODAY — WHICH IS THE SAME FINDING FROM THE OTHER SIDE.
// `edadf78` ("five specials, five REFUSALS") priced every remaining ultimate's wind-up
// and shipped none, and `sim.test.mjs` now asserts *"`lollipop.Giant` has NO wind-up,
// and the rule says why"*: its derived escape window exceeds half its own 7,000 ms
// cooldown. With `castMs` 0 the sim never emits `cast-started`, so nothing below runs.
// It is the drawn half, held ready and measured, against a decision that could move —
// and it is what closes `spawnCastTelegraph`'s routed gap the day it does.
//
// ⚠️ STILL OPEN, and deliberately not guessed at here: `spawnCastTelegraph` routes a
// SECOND shape — the escapable band, `range - slowestSpeed * castSec` (241.6 wu at
// castMs 1500) — as the line a dodging player is actually reading. At 241.6 wu that
// circle is 12.08 m, against the ~10 m the camera guarantees, so it is partly off
// frame by construction and pricing it needs a camera-framing read this file cannot
// do. Reported, not shipped.
//
// ── 🚨 EVERY BLOCKER IN THE FOUR PARAGRAPHS ABOVE WAS ARITHMETIC ON 400 wu, AND THE
//    SLAM IS 157.22 wu SINCE `afad1ca`. THEY ARE KEPT; HERE IS WHAT SURVIVES. ────────
//
//   * **"NO EDGE ON SCREEN" IS FALSE NOW, AND IT IS MEASURED.** 157.22 wu is 7.86 m
//     against the 9.96 m the camera guarantees, so the hitbox circle is INSIDE the
//     guaranteed disc. `tools/tmp/wv_area.mjs` on detached worktrees of `f11b6c6` and
//     `afad1ca` (which differ only in `rules.ts`): the shipped cast's painted bbox went
//     **799x449 of an 800x450 readback — literally the whole frame — to 499x359**, and
//     the area from **260,963 px (72.5%) to 115,635 (32.1%)**. The generic footprint's
//     refusal was priced at *"259,315 px, 64.0% of the frame"*; the shape it refused is
//     now less than half that. **The refusal became a CHOICE for the first time.**
//   * **THE ESCAPABLE BAND IS NOW ON SCREEN TOO.** `range - slowestSpeed * castSec` at
//     castMs 1500 is `157.22 - 79.20 x 1.5` = **38.42 wu = 1.92 m**, not 241.6 wu /
//     12.08 m. It is comfortably inside the frame, so the "partly off frame by
//     construction" objection has evaporated and the shape is drawable.
//   * **AND AT THE RULE'S OWN DERIVED WIND-UP THE BAND IS EMPTY — WHICH IS §80's
//     REQUIREMENT MET, NOT A DEFECT.** `sim.test.mjs` §33(o) derives **2300 ms** on HEAD
//     (32.9% of the 7000 ms cooldown). At 2300 ms the band is `157.22 - 79.20 x 2.3` =
//     **-24.94 wu**: the slowest fighter in the roster clears the entire disc inside the
//     wind-up, i.e. the whole thing becomes dodgeable.
//     ⚠️ **2300 ms is a HEAD number and it is NOT the 1800 ms `afad1ca`'s message
//     records.** That commit was right when written; `fd83a5c` then dropped
//     `PLAYER_SPEED` 0.12 -> 0.09 and the derivation moved with it. The wind-up is a
//     function of the global speed, so quote it from `sim.test.mjs`, never from a commit.
//   * **WHAT DOES NOT CHANGE:** the footprint below still marks the PROP, at 92.4 wu of
//     ground against a 157.22 wu hitbox — 1.70x short, where `rules.ts` prices it at
//     4.3x short against 400. Under-claiming is still the safe direction and this pass
//     did not move it: the hook is DORMANT (`castMs` 0, so `cast-started` never fires),
//     so there is no rendered frame to judge a change by, and marking the true hitbox is
//     a design call rather than a consequence of a radius. **Recorded as open, priced,
//     not taken** — the same disposition `rules.ts` gave `ENDGAME_STANDOFF`.
// ─────────────────────────────────────────────────────────────────────────────

/** The giant candy's head radius and forward offset at the resolve. Both are copied
 * from `spawnGiantLollipop` ON PURPOSE and must move with it: the wind-up's whole
 * claim is that it marks the ground that prop lands on. */
const GIANT_HEAD_R = CHARACTER_HEIGHT * 0.85;  // 1.79 m radius = 3.6 m across
const GIANT_FWD = GIANT_HEAD_R + CHARACTER_HEIGHT * 0.5;
const GIANT_STICK_LEN = CHARACTER_HEIGHT * 1.7;

/**
 * The two-tone ramp, mixed in sRGB against `CANDY_RED` #E63946 exactly as
 * `game/vfx.ts:spawnCastTelegraph` documents for the generic footprint — `scaleSRGB(c,
 * 0.26)` for the base, `mixSRGB(c, WHITE, 0.22)` for the fill, `0.60` for the rim.
 * Written out as literals because those two helpers are private to `game/vfx.ts`;
 * the ARITHMETIC is theirs, so this weapon's telegraph sits on the same luma ladder
 * as every other one rather than on a hand-picked pair.
 *
 * ⚠️ The white-mix numbers are the ones `game/vfx.ts` ALREADY came down to after its
 * first rendered sheet: a heavier mix produced one pale film, and *"do not fix
 * anything by desaturating"* is falsified four times in this project.
 */
const TELE_BASE = '#3C0F12';
const TELE_FILL = '#EC656F';
const TELE_RIM = '#F5B0B5';

/** Dedicated pools — one user each per gesture, so nothing here can round-robin onto
 * a live material the way `waterbottle.ts` records its bottles' fill doing. */
const nextTeleBaseMat = materialPool(2, () => new THREE.MeshBasicMaterial({
  map: aoeFillTex, color: TELE_BASE, transparent: true, opacity: 0, depthWrite: false,
}));
const nextTeleFillMat = materialPool(2, () => new THREE.MeshBasicMaterial({
  map: aoeFillTex, color: TELE_FILL, transparent: true, opacity: 0, depthWrite: false,
}));
const nextTeleRimMat = materialPool(2, () => new THREE.MeshBasicMaterial({
  map: edgeRingTex, color: TELE_RIM, transparent: true, opacity: 0, depthWrite: false,
}));
const nextTeleHeadMat = materialPool(2, () => new THREE.MeshBasicMaterial({
  color: CANDY_WHITE, transparent: true, opacity: 1, depthWrite: false,
}));
const nextTeleHeadSwirlMat = materialPool(2, () => new THREE.MeshBasicMaterial({
  map: swirlTex, color: CANDY_RED, transparent: true, opacity: 0.95, depthWrite: false,
}));
const nextTeleStickMat = materialPool(2, () => new THREE.MeshBasicMaterial({
  color: '#FBF7EE', transparent: true, opacity: 1, depthWrite: false,
}));

export const lollipopWeaponVfx: CharacterWeaponVfxMap = {
  /**
   * Lollipop Smash — she swings herself like a hammer. The cast is the candy head
   * whipping through the swing on its stick; `game/vfx.ts` still draws the real
   * cone/range wedge underneath (this hook only replaces the generic pale circular
   * cast FLASH), so the hitbox telegraph is unchanged and this is pure character on
   * top of it.
   *
   * Was four discs — a lead plus three motion-blur ghosts — at a 0.72 CH swing
   * radius. Rendered at shipped framing that swept the SAME screen pixels as her own
   * attack animation, in her own two colours: her model already whips a big red/white
   * candy head through the swing, so the ghosts were invisible as separate objects and
   * the whole loop bought nothing. Cut to a lead + one ghost, and pushed out to a
   * radius that clears her silhouette, so the swing arc is somewhere her body is not.
   */
  Smash: {
    cast(ctx) {
      const dirX = ctx.direction.x;
      const dirZ = ctx.direction.z;
      // Pivot roughly at the body, so the head arcs OUT from her rather than
      // appearing at a detached point in front.
      const px = ctx.position.x - dirX * 0.75;
      const pz = ctx.position.z - dirZ * 0.75;
      const baseAng = Math.atan2(dirZ, dirX);
      const swingRadius = CHARACTER_HEIGHT * 1.15;
      // Half the weapon's REAL cone, so the swing matches the hitbox it telegraphs.
      const halfCone = THREE.MathUtils.degToRad((ctx.weapon.cone ?? 80) / 2);
      const headRadius = CHARACTER_HEIGHT * 0.34; // 0.71 m radius = 1.43 m head

      // Head + one ghost trailing behind it along the arc.
      for (let g = 0; g < 2; g++) {
        const lead = g * 0.05;
        const mat = nextSwingMat();
        mat.color.set(g === 0 ? CANDY_WHITE : CANDY_RED);
        const disc = new THREE.Mesh(unitDiscGeo, mat);
        disc.scale.setScalar(headRadius * (1 - g * 0.16));
        disc.renderOrder = 13;
        const peak = g === 0 ? 0.95 : 0.42;
        ctx.spawnTransient(disc, 0.2, (t) => {
          const u = THREE.MathUtils.clamp((t * 0.2 - lead) / 0.2, 0, 1);
          const e = 1 - Math.pow(1 - u, 2);
          const ang = baseAng - halfCone + e * halfCone * 2;
          disc.position.set(
            px + Math.cos(ang) * swingRadius,
            THREE.MathUtils.lerp(CHARACTER_HEIGHT * 0.8, 0.4, e),
            pz + Math.sin(ang) * swingRadius,
          );
          disc.rotation.y = ang * 1.6;
          mat.opacity = peak * (u <= 0 ? 0 : 1 - Math.pow(t, 2.4));
        });
      }

      // Two sugar sparks flicked off the head as it comes round.
      for (let i = 0; i < 2; i++) {
        const a = baseAng + (Math.random() - 0.5) * halfCone * 1.4;
        spawnSugarMote(
          ctx,
          px + Math.cos(a) * swingRadius * 1.05,
          CHARACTER_HEIGHT * 0.5,
          pz + Math.sin(a) * swingRadius * 1.05,
          CHARACTER_HEIGHT * 0.13, CHARACTER_HEIGHT * 0.03, 0.2, 0.25,
        );
      }
    },

    /**
     * Hard candy CRACKING: a short sugar-white pop, a swirl chip-mark on the floor,
     * and thick candy buttons flung outward. No rings, no star decal — the generic
     * burst's whole shape vocabulary is deliberately absent.
     *
     * Sized against `CHARACTER_HEIGHT`: largest element ~0.8 CH, debris 0.16 CH a
     * piece, and the biggest opaque shape sits on the FLOOR — the character stays
     * readable through its own hit.
     */
    impact(ctx) {
      const { x, z } = ctx.position;
      const sizeFactor = THREE.MathUtils.clamp(0.85 + ctx.damage * 0.03, 0.85, 1.6);

      spawnSugarMote(ctx, x, ctx.position.y, z,
        CHARACTER_HEIGHT * 0.3 * sizeFactor, CHARACTER_HEIGHT * 0.6 * sizeFactor, 0.15, 0.1);

      spawnSwirlStamp(ctx, x, z, CHARACTER_HEIGHT * 0.32 * sizeFactor, 0.5, 0.85);

      const chips = 6;
      for (let i = 0; i < chips; i++) {
        const ang = (i / chips) * Math.PI * 2 + Math.random() * 0.7;
        spawnCandyChip(
          ctx, { x, y: ctx.position.y * 0.8, z },
          Math.cos(ang), Math.sin(ang),
          (1.7 + Math.random() * 1.9) * sizeFactor,
          CHARACTER_HEIGHT * (0.065 + Math.random() * 0.03),
          0.42 + Math.random() * 0.18,
        );
      }

      for (let i = 0; i < 3; i++) {
        const ang = Math.random() * Math.PI * 2;
        spawnSugarMote(
          ctx,
          x + Math.cos(ang) * 0.3, ctx.position.y + 0.1, z + Math.sin(ang) * 0.3,
          CHARACTER_HEIGHT * 0.14, CHARACTER_HEIGHT * 0.04, 0.34, 0.5,
        );
      }
    },
  },

  /**
   * GIANT LOLLIPOP — the ultimate, and the reason this file carries a project-wide
   * constraint. Read the header before changing any of the three numbered elements
   * below; the shape of this effect is what keeps `FAIR_PLAY.radiusUnits` at 199.2
   * instead of ~918.
   *
   * This hook ADDS to `game/vfx.ts`'s `spawnGiantSlamShockwave` (epicentre star pop,
   * flash, streaks, shards) and its 360° melee wedge — neither is replaced, both
   * still fire. Both of those are epicentre-anchored, which is precisely why the
   * off-screen case needed something else.
   *
   * 🚨 **THAT PARAGRAPH IS FALSE TODAY AND WAS FALSIFIED BY MEASUREMENT, NOT BY
   * READING.** It is kept because it describes the ink budget this effect's alphas were
   * tuned against, and because "both still fire" is exactly the assumption that produced
   * the three-overlapping-washes defect `game/vfx.ts:spawnWeaponCast` was built to
   * arbitrate. What that arbitration actually does now, from its own source:
   *
   *   - **THE 360° MELEE WEDGE DOES NOT FIRE.** `spawnWeaponCast` guards it with
   *     `if (!(weapon.giantSlam && bespokeCast))`, and this hook IS `bespokeCast`. So
   *     the *"20 m red disc at 0.88 opacity"* the AOE FILL's ink-budget note below says
   *     it is competing with has not been on screen since that guard landed.
   *   - **THE STAR POP, FLASH AND STREAKS DO NOT FIRE EITHER.** The same call passes
   *     `{ bespokeOwnsGround: bespokeCast }`, and everything except the shards sits
   *     inside `if (!bespokeOwnsGround)`. Measured (`tools/tmp/gv_slam.mjs`, pitch 58,
   *     800x450 readback, same seed both arms, at `REACH.ultimateSlam`, on a detached
   *     worktree of `f8d2756`): the generic pass delivers **96,577 px** with the flag
   *     off and **1,877 px** with it on — **98.1% of it stands down.** What survives is
   *     `burst(…, 3.2, 14, …)`, whose `sizeFactor` is a literal and correctly does NOT
   *     scale with range: those are epicentre debris, not a reach indicator.
   *
   * So this hook does not ADD to two other full-frame passes; **it is very nearly the
   * whole cast** — the shipped sum is **115,671 px, 32.1% of the frame**, and 1,877 of
   * that is everything `game/vfx.ts` contributes. **~94,700 px of frame that this note
   * assumes is already spent is in fact free**, and that is a second, independent reason
   * the alphas below are open rather than settled.
   */
  Giant: {
    cast(ctx) {
      const { x, z } = ctx.position;
      // The ability's REAL reach, straight out of `rules.ts` (`REACH.ultimateSlam`
      // via `Weapon.range`) — never a hardcoded radius, so if the ladder moves the
      // tell moves with it and stays exactly as big as the hitbox.
      //
      // ✅ **AND THE LADDER MOVED, SO THIS LINE HAS NOW BEEN CASHED IN.** `afad1ca` took
      // the slam 400 -> 157.22 wu without touching a byte of `src/vfx/**`, and measured
      // on detached worktrees either side of it the shipped cast went **260,963 px ->
      // 115,635** at pitch 58 while five other weapons' rows stayed byte-identical.
      // The `?? 0` matters too and is not defensive noise: a missing range draws NOTHING
      // here, where a `?? 400` would draw a stale hitbox — which is exactly the defect
      // `game/vfx.ts:2488` still carries on its QA path.
      const R = wu(ctx.weapon.range ?? 0);

      // ── 1. AOE FILL — the screen-filling half of the tell ────────────────────
      //
      // THE INK BUDGET. This layer is not alone: `game/vfx.ts` independently draws
      // this weapon's real 360° melee wedge — a 20 m red disc at 0.88 opacity — over
      // the same ground for the first 0.3 s. Rendered, the original 0.72 fill + 0.95
      // white swirl stacked on that erased the arena outright: at the epicentre the
      // caster, the target, the floor and the cover were all gone for half a second,
      // and a tell that hides the fighters it is reporting on has stopped being
      // feedback. Alpha here is now set so a fighter standing anywhere inside the
      // disc still reads THROUGH it — that is the constraint, not a taste call.
      const fillMat = nextFillMat();
      const fill = new THREE.Mesh(unitDiscGeo, fillMat);
      fill.position.set(x, AOE_FILL_Y, z);
      fill.renderOrder = 10;
      fill.scale.setScalar(R * 0.12);
      ctx.spawnTransient(fill, 1.0, (t) => {
        const grow = 1 - Math.pow(1 - Math.min(1, t / 0.26), 3);
        fill.scale.setScalar(R * (0.12 + 0.88 * grow));
        // Punch, then decay. The original held peak alpha to t=0.45 of a 1.15 s life,
        // which rendered as ~500 ms of a completely static frame — it read as a state
        // the arena was now in, not as an event that had just happened.
        fillMat.opacity = 0.3 * (t < 0.2 ? 1 : Math.pow(1 - (t - 0.2) / 0.8, 1.5));
      });

      // ...and its EDGE, as a hard two-tone candy line rather than a soft lip. See
      // `buildEdgeRingTexture`. Both rings ride the fill's own growth curve, so the
      // boundary is correct on every frame instead of only once the front lands, and
      // the white one is inset so the pair reads as one striped border.
      for (const [ringMat, inset, peak, order] of [
        [nextEdgeRedMat(), 1.0, 0.95, 16],
        [nextEdgeWhiteMat(), 0.974, 0.9, 17],
      ] as const) {
        const ring = new THREE.Mesh(unitDiscGeo, ringMat);
        ring.position.set(x, AOE_RIM_Y + 0.01, z);
        ring.renderOrder = order;
        ring.scale.setScalar(R * 0.12 * inset);
        ctx.spawnTransient(ring, 1.0, (t) => {
          const grow = 1 - Math.pow(1 - Math.min(1, t / 0.26), 3);
          ring.scale.setScalar(R * (0.12 + 0.88 * grow) * inset);
          ringMat.opacity = peak * (t < 0.42 ? 1 : Math.pow(1 - (t - 0.42) / 0.58, 1.4));
        });
      }

      // ...with HER swirl on top of it. This is the element that makes the frame
      // say "Lollipop's ultimate" rather than "a large red circle", which is the
      // whole difference between a readable tell and a coloured warning.
      const swirlMat = nextAoeSwirlMat();
      const swirl = new THREE.Mesh(unitDiscGeo, swirlMat);
      swirl.position.set(x, AOE_SWIRL_Y, z);
      swirl.renderOrder = 11;
      swirl.scale.setScalar(R * 0.12);
      ctx.spawnTransient(swirl, 1.0, (t) => {
        const grow = 1 - Math.pow(1 - Math.min(1, t / 0.26), 3);
        swirl.scale.setScalar(R * (0.12 + 0.88 * grow));
        // Eases to a stop rather than spinning at constant rate — a spin-down reads
        // as something enormous coming to rest.
        swirl.rotation.y = (1 - Math.pow(1 - t, 2)) * 1.5;
        swirlMat.opacity = 0.4 * (t < 0.22 ? 1 : Math.pow(1 - (t - 0.22) / 0.78, 1.5));
      });

      // ── 2. RACING RIM — the half that reaches a player at the edge ───────────
      const rimMat = nextRimMat();
      const rim = new THREE.Mesh(unitDiscGeo, rimMat);
      rim.position.set(x, AOE_RIM_Y, z);
      rim.renderOrder = 15;
      rim.scale.setScalar(R * 0.05);
      ctx.spawnTransient(rim, FRONT_TIME + 0.22, (t, elapsed) => {
        const u = Math.min(1, elapsed / FRONT_TIME);
        const e = 1 - Math.pow(1 - u, 2.2);
        rim.scale.setScalar(R * (0.05 + 0.98 * e));
        rim.rotation.y = e * 0.5;
        rimMat.opacity = 0.95 * (1 - Math.pow(t, 2.4));
      });

      // ── 3. SUGAR POPS around the epicentre, fired as the front reaches them ──
      //
      // These used to be 22 pops spread by area over the WHOLE 20 m disc, on the
      // claim that they guarantee a local beat at the player's own feet wherever they
      // are standing. Rendered, that claim is arithmetically false and looked it: 22
      // points over 1257 m² is one pop per 57 m², so the nearest one to a victim at
      // the rim is metres away and reads as a lone speck. What actually sweeps past
      // the player's feet is the RIM BAND, which is 5 m thick and unmissable — so the
      // pops are now spent where their density is high enough to read at all, close
      // in, supporting the epicentre beat rather than pretending to cover the disc.
      const POPS = 10;
      const POP_SPAN = 0.55; // fraction of R the pops occupy
      const GOLDEN = Math.PI * (3 - Math.sqrt(5));
      for (let i = 0; i < POPS; i++) {
        // sqrt() spacing = uniform by AREA within that inner disc.
        const rad = R * POP_SPAN * Math.sqrt((i + 0.6) / POPS);
        const ang = i * GOLDEN;
        const px = x + Math.cos(ang) * rad;
        const pz = z + Math.sin(ang) * rad;
        const delay = (rad / R) * FRONT_TIME;
        spawnSugarMote(ctx, px, 0.55, pz,
          CHARACTER_HEIGHT * 0.2, CHARACTER_HEIGHT * 0.68, 0.3, 0.55, nextPopRedMat, delay);
        if (i % 3 === 0) {
          spawnSugarMote(ctx, px, 0.5, pz,
            CHARACTER_HEIGHT * 0.12, CHARACTER_HEIGHT * 0.34, 0.34, 0.7, nextPopMintMat, delay + 0.03);
        }
      }

      // ── Epicentre bonus: the giant lollipop itself ───────────────────────────
      spawnGiantLollipop(ctx, x, z, ctx.direction.x, ctx.direction.z);
    },

    /**
     * GIANT LOLLIPOP — the wind-up. See the block above this export for why this is
     * the only telegraph the weapon has and why its footprint is the PROP's, not the
     * hitbox's.
     *
     * ── The beats, as fractions of `castMs` ───────────────────────────────────
     *
     *     0.00 - 1.00   THE CLOCK   the bright fill sweeps 0.12 -> 1.0 of the base
     *                               disc; full means now. Constant-area dark base
     *                               underneath, so every 100 ms slice has area.
     *     0.00 - 0.78   GROWS HUGE  the candy swells 0.28 -> 1.0 of the head it
     *                               lands at, rising and spinning up
     *     0.78 - 1.00   THE RAISE   it lifts and cocks back for the drop
     *
     * ⚠️ Everything is a fraction of `ctx.castMs`, never a fixed number of seconds:
     * `castMs` is per weapon and a hook that hard-codes "0.3 s of rising" is silently
     * wrong the moment anything retunes it.
     */
    telegraph(ctx) {
      const T = ctx.THREE;
      const castSec = Math.max(0.2, (ctx.castMs ?? 1500) / 1000);

      const root = new T.Group();
      root.name = 'teleLolliRoot';
      const feet = ctx.position.clone();
      feet.y -= CHARACTER_HEIGHT * 0.55; // `ctx.position` arrives at muzzle height
      root.position.copy(feet);
      root.rotation.y = Math.atan2(ctx.direction.x, ctx.direction.z);

      // ── The ground half: `game/vfx.ts`'s two-tone footprint at the prop's radius.
      const baseMat = nextTeleBaseMat();
      const base = new T.Mesh(unitDiscGeo, baseMat);
      base.name = 'teleLolliBase';
      base.scale.setScalar(GIANT_HEAD_R);
      base.position.set(0, 0.02, GIANT_FWD);
      base.renderOrder = 5;
      root.add(base);

      const fillMat = nextTeleFillMat();
      const fill = new T.Mesh(unitDiscGeo, fillMat);
      fill.name = 'teleLolliFill';
      fill.position.set(0, 0.032, GIANT_FWD);
      fill.renderOrder = 5.01;
      root.add(fill);

      const rimMat = nextTeleRimMat();
      const rim = new T.Mesh(unitDiscGeo, rimMat);
      rim.name = 'teleLolliRim';
      rim.scale.setScalar(GIANT_HEAD_R * 1.06);
      rim.position.set(0, 0.044, GIANT_FWD);
      rim.renderOrder = 5.02;
      root.add(rim);

      // ── The card's own clause: it GROWS. ────────────────────────────────────
      const candy = new T.Group();
      candy.name = 'teleLolliCandy';
      root.add(candy);

      const headMat = nextTeleHeadMat();
      const head = new T.Mesh(giantHeadGeo, headMat);
      head.name = 'teleLolliHead';
      head.scale.set(GIANT_HEAD_R, 1, GIANT_HEAD_R);
      candy.add(head);

      const swirlMat = nextTeleHeadSwirlMat();
      const swirl = new T.Mesh(unitDiscGeo, swirlMat);
      swirl.name = 'teleLolliSwirl';
      swirl.scale.setScalar(GIANT_HEAD_R * 0.99);
      swirl.position.y = 0.13;
      swirl.renderOrder = 13;
      candy.add(swirl);

      const stickMat = nextTeleStickMat();
      const stick = new T.Mesh(giantStickGeo, stickMat);
      stick.name = 'teleLolliStick';
      stick.scale.set(1, GIANT_STICK_LEN, 1);
      // `giantStickGeo` is a +Y cylinder; rotating -90° about X sends +Y to -Z, i.e.
      // lays the stick down pointing BEHIND her, the same way `spawnGiantLollipop`
      // lays it at the resolve. A quaternion is only needed when the axis is
      // arbitrary (as it is there, in world space); inside this yawed root it is not.
      stick.rotation.x = -Math.PI / 2;
      stick.position.z = -(GIANT_HEAD_R + GIANT_STICK_LEN * 0.5) * 0.92;
      candy.add(stick);

      const beat = (t: number, a: number, b: number): number => {
        const k = T.MathUtils.clamp((t - a) / (b - a), 0, 1);
        return k * k * (3 - 2 * k);
      };

      const drive = (_p: number, elapsed: number): void => {
        const t = T.MathUtils.clamp(elapsed / castSec, 0, 1);
        const grow = beat(t, 0.0, 0.78);
        const raise = beat(t, 0.78, 1.0);

        // ── THE CLOCK ────────────────────────────────────────────────────────
        // A heartbeat that ACCELERATES, expressed in cycles-of-the-whole-cast rather
        // than in Hz — the same curve `game/vfx.ts` uses, so 1100 ms and 1500 ms read
        // with identical urgency instead of differing for no design reason.
        const pulse = 0.5 + 0.5 * Math.sin(Math.PI * 2 * (2 * t + 3 * t * t));
        baseMat.opacity = 0.60 + 0.14 * pulse;
        // Never literally zero area: a first slice worth a few pixels is the
        // invisible-sculpt failure wearing a good peak.
        const s = GIANT_HEAD_R * (0.12 + 0.88 * t);
        fill.scale.setScalar(s);
        fillMat.opacity = 0.70 + 0.22 * t;
        rimMat.opacity = 0.62 + 0.36 * t * t;

        // ── GROWS HUGE ───────────────────────────────────────────────────────
        const g = 0.28 + 0.72 * grow;
        candy.scale.setScalar(g);
        // Rides above the ground mark it is about to fall onto, so the two halves of
        // the telegraph are visibly the same event. Held inside ~2 character heights
        // of her: at 58° vertical distance becomes screen distance fast, and
        // `waterbottle.ts` records a beat that strayed further reading as an
        // unrelated object floating over the arena.
        candy.position.set(
          0,
          CHARACTER_HEIGHT * (0.55 + 1.05 * grow + 0.55 * raise),
          GIANT_FWD * (0.35 + 0.65 * grow) - GIANT_STICK_LEN * 0.10 * raise,
        );
        // A YAW, not a tumble: the head is a flat disc and its swirl is the read, so
        // spinning it about world up keeps the face presented at 58°. Accelerates
        // into the raise, which is the "about to come down" cue.
        candy.rotation.y = t * (2.2 + 5.5 * t);
        // ...and it tilts back as she cocks it, which is the only frame that says
        // DOWNWARD is next.
        candy.rotation.x = -0.55 * raise;

        const outline = 0.85 + 0.15 * pulse;
        headMat.opacity = outline;
        stickMat.opacity = outline;
        swirlMat.opacity = 0.95 * outline;
      };

      // Posed before the layer sees it — the meshes are built at their authoring
      // transform, and whether the first `updateEffects` tick beats the first
      // `render` is a `match.ts` call-order detail this file must not depend on.
      drive(0, 0);
      ctx.spawnTransient(root, castSec + 0.06, drive);
    },

    /**
     * The giant candy actually connecting. Bigger than Smash's hit because it is an
     * 8-second ultimate, but still governed by the same rule: the ground carries the
     * mass, the character keeps its silhouette. Mint sparkles rise off the target as
     * the `effect: 'stun'` cue — `game/vfx.ts`'s orbiting stun stars run on top of
     * this untouched, so this only has to sell the MOMENT of going dizzy.
     */
    impact(ctx) {
      const { x, z } = ctx.position;
      const sizeFactor = THREE.MathUtils.clamp(0.9 + ctx.damage * 0.035, 0.9, 1.7);

      spawnSugarMote(ctx, x, ctx.position.y, z,
        CHARACTER_HEIGHT * 0.34 * sizeFactor, CHARACTER_HEIGHT * 0.62 * sizeFactor, 0.18, 0.12);

      spawnSwirlStamp(ctx, x, z, CHARACTER_HEIGHT * 0.42 * sizeFactor, 0.62, 0.9);

      const chips = 8;
      for (let i = 0; i < chips; i++) {
        const ang = (i / chips) * Math.PI * 2 + Math.random() * 0.6;
        spawnCandyChip(
          ctx, { x, y: ctx.position.y * 0.85, z },
          Math.cos(ang), Math.sin(ang),
          (2.1 + Math.random() * 2.2) * sizeFactor,
          CHARACTER_HEIGHT * (0.07 + Math.random() * 0.035),
          0.48 + Math.random() * 0.2,
        );
      }

      for (let i = 0; i < 4; i++) {
        const ang = (i / 4) * Math.PI * 2 + Math.random();
        spawnSugarMote(
          ctx,
          x + Math.cos(ang) * 0.34, ctx.position.y + 0.15, z + Math.sin(ang) * 0.34,
          CHARACTER_HEIGHT * 0.11, CHARACTER_HEIGHT * 0.04, 0.42, 0.85, nextMintMat,
        );
      }
    },
  },
};
