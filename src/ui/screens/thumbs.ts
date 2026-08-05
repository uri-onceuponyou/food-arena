/**
 * Roster card art — real character renders, not emoji.
 *
 * ── Why this exists ─────────────────────────────────────────────────────────
 * A blind critic put it best: a screen that renders a bespoke 3D character in its
 * preview panel and then represents that same roster with system emoji "is
 * announcing that the art pipeline stopped halfway". It was the single loudest
 * defect on character select, and it is also a real usability problem — the player
 * cannot see what anyone looks like until they tap them.
 *
 * ── How ─────────────────────────────────────────────────────────────────────
 * One short-lived offscreen `Stage` renders each of the eleven characters to a PNG
 * data URL, then disposes itself. Notes on the choices, because each one is load
 * bearing:
 *
 *  * **The same Stage the game uses.** Same toon materials, same lighting, same
 *    colour grade. A card and the hero preview beside it must not disagree about
 *    what a character looks like, and the only way to guarantee that is to not have
 *    a second renderer.
 *
 * ── What the perf pass found here, and what changed ─────────────────────────
 * This file was standing up a SECOND COMPLETE Stage — full post chain, IBL, and its
 * own 2048² (16 MB) shadow map — to make eleven 448px cards, and it was doing it on
 * HOME and on the TROPHY ROAD as well as on the roster screen. Measured:
 *
 *   home ....... 300 draws/frame (the menu portrait) PLUS 135 from this generator,
 *                across TWO live WebGL contexts at once
 *   home ....... 81 shader programs linked to show a MENU, against 32 for a whole
 *                match — and each link is a synchronous 10-60 ms stall on a mobile
 *                driver, i.e. seconds of jank to render art the screen may not use
 *   trophies ... this generator was the ONLY Stage on the route, and because it
 *                disposes itself it left `window.__stage` pointing at a dead object,
 *                which is what every QA probe on that route was measuring
 *
 * Three changes, in order of how much they buy:
 *
 *  1. **Only render what the screen actually asks for.** Home shows at most ONE
 *     portrait (the next trophy reward); the trophy road shows a handful. Rendering
 *     eleven for them was 10x the work for zero visible difference. The roster
 *     screen still gets all eleven, because it genuinely shows all eleven.
 *  2. **`postFx: 'grade'`, no shadows.** The grade is 99.99% of pixels for zero
 *     extra draws, so it stays and the cards keep the game's colour identity. Bloom
 *     and SMAA are 19 of the post chain's 20 draws and most of its fill, and a
 *     448px render downsampled into a 210px card cannot show either.
 *  3. **`offscreen: true`**, so this Stage never claims the `window.__stage` QA slot.
 *  * **Each character is rendered on its OWN rarity colour** (`RARITY_CARD_COLORS`),
 *    because `Stage` builds its renderer with `alpha: false` and there is therefore
 *    no transparent output to composite. Baking the card's own background into the
 *    image gives a seamless cut-out for free.
 *  * **Generated lazily and progressively.** The emoji stays as the immediate
 *    placeholder and each card upgrades itself as its render lands, so a slow device
 *    gets a usable screen instantly rather than a blank one eventually.
 *  * **Cached for the session.** Eleven renders happen once, not once per visit.
 */

import * as THREE from 'three';
import { Stage } from '../../render/stage';
import { createCharacter } from '../../characters/registry';
import { CHARACTER_IDS, CHARACTERS, RARITY_CARD_COLORS, type CharacterId } from '../../game/rules';

/**
 * ── The render is PORTRAIT now, and the framing is UPPER BODY ────────────────
 *
 * What was here before: a 448² square holding a whole standing figure at 80% of the
 * frame's long axis, dropped into the card with `object-fit: contain`. Measured, that
 * put the mean figure at **19.1% of the card at desktop and 14.3% in portrait** — the
 * rest was letterbox and sky. A blind critic named it as this screen's single fix
 * ("the figure floats small and centred with dead colour above and below it"), and an
 * independent measurement pass agreed after opening the sheets.
 *
 * Two things were wrong, and only one of them was the framing:
 *
 *  1. **A square source cannot fill a card that is never square.** Cards measure
 *     0.81 (desktop), 0.87 (portrait phone) and 1.17 (landscape phone) wide-over-tall.
 *     `contain` fits the LOOSER axis, so a square lost 40 px of a 218 px card at
 *     desktop and 41 px of a 106 px one in portrait before the character was even
 *     drawn. The source is now 416x496 (0.839) — within 4% of both portrait framings,
 *     so `cover` crops almost nothing there and crops the landscape phone vertically,
 *     which is exactly where a tighter head-and-shoulders crop is worth most.
 *  2. **Full body wastes the pixels on legs.** The crop now starts at the waist and
 *     runs to the top of the head.
 *
 * ⚠️ THE CROP CANNOT BE A FIXED FRACTION OF HEIGHT, and this is the whole reason the
 * rule below is face-aware rather than a constant. Donut's eyes and mouth sit at
 * y 0.61-1.46 on a ring whose top is at 2.23 — its face is in the LOWER HALF of its
 * own body — and Lollipop wears its eyes low on the stick with its mouth up on the
 * candy, spanning 0.66-1.65. A waist crop decapitates both. So the cut is the LOWER
 * of "waist" and "a margin below the bottom of the face", which leaves those two
 * characters wider and lets the other nine come in at ~1.9x. Getting a per-character
 * answer out of one rule is why the rig's own `face` joint is read here.
 */
const SIZE_W = 416;
const SIZE_H = 496;
const ASPECT = SIZE_W / SIZE_H;

/** Where the crop starts, as a fraction of the model's own height, before the face
 *  constraint below is applied. 0.42 is roughly the waist across all four archetypes. */
const WAIST_FRAC = 0.42;
/** The crop never comes closer than this to the bottom of the face. Same units. */
const FACE_PAD = 0.07;
/** Empty frame above the top of the head, as a fraction of the visible height. Sized
 *  so the tightest card crop (landscape phone, which loses 28% of the height) still
 *  cannot reach the head. */
const TOP_PAD = 0.08;
/**
 * The bottom of the face must sit no lower than this fraction of the frame.
 *
 * A card puts its name and its rarity chip across the bottom ~26% of itself, and the
 * first version of this framing anchored purely on the top of the head — which put
 * LOLLIPOP'S EYES AT 91% OF THE FRAME, i.e. behind the nameplate. Measured as
 * FACE-OUT: none, because the eyes were inside the card; they were simply underneath
 * the type. The card that the critic singled out as having no readable face came back
 * with a mouth and no eyes, which is not a fix.
 */
const FACE_FLOOR = 0.66;
/** ...and this is what it is allowed to cost. Rather than zoom back out — which would
 *  have taken Lollipop from 1.9x to 1.2x and undone the whole point — the frame slides
 *  DOWN over the mass by up to this fraction. The characters whose faces sit low on their
 *  own bodies are the ones that pay it — two when this was written, four now that egg's
 *  and waterbottle's real face data exists — and they are round, so the top they lose
 *  reads as a crop rather than as damage.
 *
 *  ⚠️ THESE TWO ARE THE **ZOOM** TERM ONLY, and they are deliberately frozen at the
 *  values that produced the measured fill (mean 60.9% / 58.8% / 62.1%). Every character's
 *  `subjectHeight` is still solved from exactly these numbers, so the framing repair
 *  below cannot give any of that back by accident. Where the frame is finally PLACED is
 *  now decided by `FACE_FLOOR_PX` / `HEAD_CROP_MAX`. */
const HEAD_CROP = 0.08;

/**
 * ── The clamp above is solved in world Y, and the card crops PIXELS ──────────
 *
 * `FACE_FLOOR` constrains `faceBox.min.y` — a world height. What a card actually cuts is
 * the PROJECTED face rectangle, and the two are not the same thing, because the face box
 * has depth and this camera pitches 12 degrees. Measured across the cast, the projected
 * bottom of the face lands **4 to 21 points of frame height BELOW** where the world-Y
 * clamp believes it is:
 *
 *     world-Y floor          0.660 for everyone
 *     projected bottom       hotdog 0.489 · hamburger 0.607 · sushi 0.627 · burrito 0.699
 *                            lollipop 0.699 · taco 0.713 · donut 0.726 · soup 0.733
 *                            pizza 0.760 · waterbottle 0.778 · EGG 0.869
 *
 * The three worst crossed the card edge — egg, pizza and waterbottle were the FACE-OUT
 * failures — and the rule could not see it, because the quantity it checks was inside its
 * own limit the whole time. So the placement is now solved against the projected rect: it
 * is the only thing that answers the question the card asks.
 *
 * ── What the render must fit inside ─────────────────────────────────────────
 * `object-fit: cover` at three shipped card aspects (0.814 / 1.172 / 0.793) shows three
 * different windows of this 416x496 source. Their INTERSECTION is what every card is
 * guaranteed to show, measured off the real screen at the real viewports
 * (`tools/tmp/faceframe.mjs`, cached in `shots/roster/cards.json`):
 *
 *     desktop      x [0.015 .. 0.985]   y [0.000 .. 1.000]
 *     phone-land   x [0.000 .. 1.000]   y [0.028 .. 0.744]   <- the vertical crop
 *     portrait     x [0.027 .. 0.973]   y [0.000 .. 1.000]   <- the horizontal crop
 *     ---------------------------------------------------------------
 *     SAFE         x [0.027 .. 0.973]   y [0.028 .. 0.744]
 *
 * A face outside that box is a FACE-OUT at some viewport BY CONSTRUCTION — no render
 * required to know it. Kept a touch inside the measured window so a future 4px change to
 * a card's padding cannot silently start clipping faces.
 */
const FACE_SAFE = { x0: 0.035, x1: 0.965, y0: 0.045, y1: 0.725 };
/** Where the projected bottom of the face is AIMED. Paid for by sliding the frame down
 *  (free) and never by zooming out (not free) — `FACE_SAFE.y1` is the hard backstop that
 *  may spend zoom, and across all eleven it never has to. */
const FACE_FLOOR_PX = 0.70;
/**
 * How far the frame may slide down over the mass, 0.08 -> 0.18.
 *
 * This is the clamp that had to widen, and the reason is arithmetic rather than taste.
 * From the top of the head to the bottom of the projected face measures 0.846 of the
 * frame on egg and 0.858 on waterbottle. A frame can hold that and still land the face at
 * `FACE_FLOOR_PX` only if it may slide by span - FACE_FLOOR_PX, i.e. 0.146 and 0.158.
 * At the old 0.08 cap the only remaining currency is zoom, and zoom was priced:
 *
 *     to reach the HARD bound (0.725) at HEAD_CROP 0.08
 *       egg          x1.051 zoom-out  ->  fill 70.4% -> 63.7%
 *       waterbottle  x1.066 zoom-out  ->  fill 60.5% -> 53.2%
 *
 * Both of those are below the floor this framing is required to hold, so the slide is the
 * only affordable currency and the cap simply had to be wide enough to buy the fix. At
 * 0.18 nothing in the cast reaches the zoom path at all, and `subjectHeight` is
 * bit-identical to before for all eleven.
 *
 * What it costs is the top of the head, and on the two that pay it the top of the head is
 * blank shell (egg's crown) and a bottle cap. What it ALSO costs is `TOP_PAD`'s promise
 * that the top corners of the frame stay clear — which is why `thumbMeta.bg` exists.
 */
const HEAD_CROP_MAX = 0.18;
/** How much of the frame height the framed band occupies. */
const FILL_V = 0.92;
/**
 * The subject may be this much wider than the frame. A little bleed is what a portrait
 * crop IS — but only a little, and the first attempt at this file proves why.
 *
 * At 1.5 the vertical band always won and every character was fitted on height alone.
 * On the wide half of the cast that cut a quarter off each side: Soup became a bowl rim
 * with two eyes in the bottom corner, Taco a shell with no taco in it, Hamburger a bun.
 * The faces were enormous and the CHARACTERS were gone — the wrong trade on the one
 * screen whose whole job is telling eleven of them apart.
 *
 * At 1.15 the width binds for the wide ones instead, and that produces the right answer
 * without needing a second rule: a wide character is fitted across, so its frame comes
 * out taller than the band asked for, and — because the head stays pinned TOP_PAD below
 * the frame top — every extra millimetre goes downward into body. Soup and Egg end up
 * near full-figure and full-bleed, while Hot Dog, Burrito, Lollipop and Pizza, which are
 * narrow and were the ones with unreadable faces, still get the full ~1.9x. One rule,
 * sorted by what each character actually needed.
 */
const WIDTH_ALLOW = 1.15;

const cache = new Map<CharacterId, string>();
/** Post-grade background, keyed by the AUTHORED card colour — six entries, not eleven.
 *  Sampled once per colour from a background-only frame; see `ThumbMeta.bg`. */
const gradedBg = new Map<string, [number, number, number]>();
/** Every listener waiting on the batch in flight. Cleared when it finishes. */
const pending: Array<(id: CharacterId, url: string) => void> = [];
let generating = false;

/**
 * Mean colour of the rendered frame, via an 8x8 downsample.
 *
 * Not one pixel: the grade lays a gentle falloff across the frame (~5/255 corner to
 * corner), so any single sample is a corner of a gradient rather than the colour. Not
 * `toDataURL` either — that PNG-encodes 206k pixels to read three numbers. `drawImage`
 * into an 8x8 makes the driver do the filtering, and the renderer is built with
 * `preserveDrawingBuffer: true`, which is what makes the canvas readable at all.
 */
function samplePixel(canvas: HTMLCanvasElement): [number, number, number] {
  const N = 8;
  const c = document.createElement('canvas');
  c.width = N; c.height = N;
  const g = c.getContext('2d', { willReadFrequently: true });
  if (!g) return [0, 0, 0];
  g.drawImage(canvas, 0, 0, N, N);
  const d = g.getImageData(0, 0, N, N).data;
  let r = 0, gg = 0, b = 0;
  for (let i = 0; i < d.length; i += 4) { r += d[i]; gg += d[i + 1]; b += d[i + 2]; }
  const n = d.length / 4;
  return [Math.round(r / n), Math.round(gg / n), Math.round(b / n)];
}

declare global {
  interface Window {
    /** QA-only: true once every portrait THIS SCREEN asked for has been rendered
     *  and cached. A screenshot driver waits on this so a review plate is never
     *  captured half-way through the progressive upgrade from mark to portrait.
     *
     *  On the roster screen that is still all eleven; on home and the trophy road it
     *  is the handful those screens actually display — see `demandedIds`. */
    __thumbsReady?: boolean;
    /** QA-only: where the subject, its HEAD and its FACE landed inside each generated
     *  PNG, in source-image pixels, plus the world-space landmarks the framing was
     *  solved from. A probe can key the flat background out of the PNG to find the
     *  subject, but nothing in the pixels says which part of it is a face — and
     *  "is the face legible at thumbnail size" is the acceptance test this screen is
     *  judged on. The FACE joint is the landmark that matters, not the head: Lollipop
     *  wears its eyes low on the stick and its mouth up on the candy, so its head mass
     *  and its face are in two different places. Recorded at generation time, where
     *  the camera and the rig's own joints are both in hand. */
    __thumbMeta?: Record<string, ThumbMeta>;
  }
}

/** Pixel rect inside a generated portrait PNG. */
export interface ThumbRect { x: number; y: number; w: number; h: number }
export interface ThumbMeta {
  /** Width and height of the render, in pixels. */
  size: { w: number; h: number };
  /** The whole model's projected bounds. */
  subject: ThumbRect;
  /** The rig's head joint subtree, or `null` if there is no joint named `head`. */
  head: ThumbRect | null;
  /** The rig's face joint subtree, or `null` if the model mounts its face elsewhere. */
  face: ThumbRect | null;
  /**
   * The card's baked background, AFTER the colour grade, as `[r, g, b]` 0-255.
   *
   * ⚠️ Read this rather than guessing where the background is. `chars_metrics.mjs` used to
   * key it off the 1px border ring, which broke the moment art bled off the card (zero
   * figure pixels for four of eleven), and then off the TOP CORNER STRIPS, which relied on
   * `TOP_PAD` keeping them clear — an assumption `HEAD_CROP_MAX` deliberately breaks, and
   * which was ALREADY broken before it: waterbottle's cap reached x=326 in the top rows,
   * taking the strip's std to 46.4 and the key's threshold to 139.9 against everyone
   * else's 26. That is `docs/LESSONS.md` §13 twice over — an instrument reporting a
   * catastrophe that is really its own precondition failing.
   *
   * The generator does not have to guess: it renders one background-only frame per card
   * colour (six, reusing the composer warm-up frame that already existed) and reads the
   * result. Exact, location-free, and it cannot be broken by any future framing change.
   */
  bg: [number, number, number] | null;
  /** World-space landmarks, so a framing rule can be designed against real numbers. */
  world: {
    minY: number; maxY: number; halfWidth: number;
    hipsY: number | null; shoulderY: number | null;
    headY: [number, number] | null; faceY: [number, number] | null;
    /** Where the crop started, and the half-width that was fitted above it. */
    yCut: number; upperHalfWidth: number;
  };
  /** What the camera was actually set to. `headroom` is the clear air above the top of
   *  the head as a fraction of the frame (negative = the head is cropped, capped at
   *  `HEAD_CROP_MAX`); `pan` is the lateral slide in metres, non-zero only where a face
   *  would otherwise leave the card. */
  frame: {
    subjectHeight: number; subjectFill: number; targetHeight: number;
    headroom: number; pan: number;
  };
}

export function getCachedThumb(id: CharacterId): string | undefined {
  return cache.get(id);
}

/**
 * Which portraits does the screen that is up right now actually show?
 *
 * The roster grid shows all eleven and builds its own cards, so it is named by
 * route. Every other screen writes `portraitMarkup()` into the DOM, which stamps a
 * `data-portrait` attribute per portrait — so the DOM *is* the demand list, and it
 * is exact: home asks for one, the trophy road for its character rewards.
 *
 * The contract with `src/ui/icons/portraits.ts` is unchanged. `generate: false`
 * (used by the HUD mid-match) still never reaches this module, and a portrait that
 * has not been rendered still falls back to the neutral fighter mark, which that
 * file documents as a fine resting state.
 */
function demandedIds(): CharacterId[] {
  const all = [...CHARACTER_IDS];
  if (typeof document === 'undefined') return all;
  if (typeof window !== 'undefined' && window.__screen === 'characters') return all;
  const want = new Set<CharacterId>();
  for (const host of document.querySelectorAll<HTMLElement>('[data-portrait]')) {
    const id = host.dataset.portrait as CharacterId;
    if ((CHARACTER_IDS as readonly string[]).includes(id)) want.add(id);
  }
  // Nothing asked for and no route to go on — a preview harness or a test, not a
  // screen. Fall back to the old behaviour rather than silently rendering nothing.
  if (!want.size && (typeof window === 'undefined' || !window.__screen)) return all;
  return [...want];
}

/**
 * Render any roster art this screen needs and that is not cached yet, calling
 * `onReady` per character.
 *
 * Safe to call on every mount: already-cached entries are replayed immediately, a
 * generation pass already in flight is not started twice, and a caller that arrives
 * mid-batch (navigating home -> roster while home's single portrait is rendering)
 * is served by the same batch rather than dropped, which the previous `if
 * (generating) return` did silently.
 */
export function requestThumbnails(onReady: (id: CharacterId, url: string) => void): void {
  for (const id of CHARACTER_IDS) {
    const hit = cache.get(id);
    if (hit) onReady(id, hit);
  }
  // DEMAND IS NOT EVALUATED HERE, and that is the whole trick. A screen calls this
  // from its constructor, which `shell.ts` runs BEFORE it sets `window.__screen` and
  // before the screen's DOM is attached — so at this moment the demand list still
  // describes the screen we are leaving. Evaluating it now made the roster screen
  // inherit home's single portrait and render nothing. Only the whole-cache check,
  // which is route-independent, is safe to make eagerly.
  if (CHARACTER_IDS.every((id) => cache.has(id))) { window.__thumbsReady = true; return; }
  pending.push(onReady);
  if (generating) return;
  generating = true;
  window.__thumbsReady = false;

  // Deferred so the screen paints, and the player can read and tap it, before the
  // GPU is asked for any renders at all.
  const start = () => void generate().finally(() => {
    generating = false;
    pending.length = 0;
    window.__thumbsReady = demandedIds().every((id) => cache.has(id));
  });
  if (typeof requestIdleCallback === 'function') requestIdleCallback(start, { timeout: 600 });
  else setTimeout(start, 120);
}

async function generate(): Promise<void> {
  // Evaluated HERE, one idle callback after the request, by which time `shell.ts`
  // has set `window.__screen` and attached the screen's DOM. If the screen that is
  // now up needs nothing, no Stage — and therefore no second WebGL context, no
  // second shadow map and no program links — is ever created.
  if (!demandedIds().some((id) => !cache.has(id))) return;

  const host = document.createElement('div');
  // Off-screen but LAID OUT: `display:none` would give the Stage a 0x0 container and
  // it would size its buffer to the window instead.
  host.style.cssText = `position:fixed;left:-9999px;top:0;width:${SIZE_W}px;height:${SIZE_H}px;pointer-events:none;`;
  document.body.appendChild(host);

  let stage: Stage | null = null;
  try {
    stage = new Stage({
      container: host,
      background: 0x000000,
      fog: null,
      camera: {
        // A touch of yaw and a low pitch: a dead-front orthographic-looking portrait
        // flattens every character, and three-quarter is what the reference roster
        // grids use.
        pitchDeg: 12,
        yawDeg: 24,
        frameMode: 'subject',
        subjectHeight: 2.1,
        // 1, always. `subjectHeight` below is the VISIBLE height in metres, solved per
        // character; splitting the same quantity across two knobs is how a framing
        // ends up tuned in one place and overridden in another.
        subjectFill: 1,
        targetHeight: 1.05,
        followLerp: 1,
      },
      // No ground plane at all, so these are clean cut-outs on flat colour rather
      // than eleven tiny dioramas fighting the card's own frame.
      shadows: false,
      // The grade, and nothing else — see the note in the file header.
      postFx: 'grade',
      offscreen: true,
      maxPixelRatio: 1,
    });
    stage.canvas.style.cssText = `display:block;width:${SIZE_W}px;height:${SIZE_H}px;`;
    stage.resize();

    // Re-read demand every round: the player can navigate mid-batch, and a roster
    // screen mounted while home's single portrait was rendering must not be left
    // with ten missing cards.
    const attempted = new Set<CharacterId>();
    for (;;) {
      const todo = demandedIds().filter((id) => !cache.has(id) && !attempted.has(id));
      if (!todo.length) break;
      for (const id of todo) {
        attempted.add(id);
        await renderOne(stage, id);
      }
    }
  } catch {
    // Non-fatal by design: the neutral fighter mark is already on screen and stays.
  } finally {
    stage?.dispose();
    host.remove();
  }
}

/**
 * A world-space box, as the pixel rect it occupies in a `w`x`h` render.
 *
 * ⚠️ THE OBVIOUS VERSION OF THIS IS WRONG, and it was wrong here first: projecting all
 * eight corners of the box straight through the camera reported Hamburger's head as
 * 96% of its whole body. A perspective camera magnifies the four NEAR corners, so an
 * unflattened projection measures the box's DEPTH as if it were height — a cube one
 * head wide projects roughly its own diagonal. That is not what a viewer sees.
 *
 * So every corner is first pushed to the box centre's depth in camera space, and only
 * then projected: the result is the extent of the mass AT ITS OWN DISTANCE, which is
 * the thing a card is either big enough to show or is not. Instrument validated
 * against the keyed pixel bbox — see `chars_metrics.mjs`, which prints both.
 */
function projectBox(box: THREE.Box3, camera: THREE.Camera, w: number, h: number): ThumbRect {
  const v = new THREE.Vector3();
  const centreZ = box.getCenter(v.clone()).applyMatrix4(camera.matrixWorldInverse).z;
  let x0 = Infinity, y0 = Infinity, x1 = -Infinity, y1 = -Infinity;
  for (let i = 0; i < 8; i++) {
    v.set(
      i & 1 ? box.max.x : box.min.x,
      i & 2 ? box.max.y : box.min.y,
      i & 4 ? box.max.z : box.min.z,
    ).applyMatrix4(camera.matrixWorldInverse);
    v.z = centreZ;
    v.applyMatrix4(camera.projectionMatrix);
    const px = (v.x * 0.5 + 0.5) * w;
    const py = (1 - (v.y * 0.5 + 0.5)) * h;
    x0 = Math.min(x0, px); x1 = Math.max(x1, px);
    y0 = Math.min(y0, py); y1 = Math.max(y1, py);
  }
  return { x: +x0.toFixed(1), y: +y0.toFixed(1), w: +(x1 - x0).toFixed(1), h: +(y1 - y0).toFixed(1) };
}

/** Box3 of a named rig joint's subtree, or `null` when it holds no geometry. */
function jointBox(root: THREE.Object3D, name: string): THREE.Box3 | null {
  const j = root.getObjectByName(name);
  if (!j) return null;
  const b = new THREE.Box3().setFromObject(j);
  return b.isEmpty() ? null : b;
}

/**
 * Half-width of everything above `yCut`, measured ALONG THE CAMERA'S RIGHT AXIS.
 *
 * Not `Box3.max.x`, and not the whole-model box: both answer a different question.
 * The camera yaws 24 degrees, so a character's screen width is part of its world X and
 * part of its world Z, and a full-body box is set by the feet on half this cast. Real
 * vertices, filtered by height, projected onto the axis the frame is actually measured
 * in. ~30k vertices per character, once per session.
 */
function halfWidthAbove(root: THREE.Object3D, yCut: number, right: THREE.Vector3): number {
  const v = new THREE.Vector3();
  let maxAbs = 0;
  root.traverse((o) => {
    const m = o as THREE.Mesh;
    if (!m.isMesh || !m.visible) return;
    const pos = m.geometry?.getAttribute('position');
    if (!pos) return;
    for (let i = 0; i < pos.count; i++) {
      v.fromBufferAttribute(pos as THREE.BufferAttribute, i).applyMatrix4(m.matrixWorld);
      if (v.y < yCut) continue;
      const a = Math.abs(v.dot(right));
      if (a > maxAbs) maxAbs = a;
    }
  });
  return maxAbs;
}

async function renderOne(stage: Stage, id: CharacterId): Promise<void> {
  const model = createCharacter(id);
  stage.scene.add(model.root);
  model.play('idle');
  // Settle the idle pose off its zero-crossing so the portrait has a little life
  // in it, then measure and frame.
  model.update({ dt: 0.4, elapsed: 0.4, moveSpeed01: 0, health01: 1 });

  const box = new THREE.Box3().setFromObject(model.root);
  const headBox = jointBox(model.root, 'head');
  const faceBox = jointBox(model.root, 'face');
  const H = Math.max(0.5, box.max.y - box.min.y);
  const yTop = box.max.y;

  // Where to cut. The waist, unless the face reaches lower — see the file header for
  // why Donut and Lollipop make that not a hypothetical. Four characters mount their
  // features straight onto the head group rather than onto `face`, so the head's own
  // bottom is the fallback, and the raw fraction is the floor under both.
  const faceBottom = (faceBox ?? headBox)?.min.y ?? (box.min.y + 0.45 * H);
  const yCut = Math.max(box.min.y, Math.min(box.min.y + WAIST_FRAC * H, faceBottom - FACE_PAD * H));
  const framedH = Math.max(0.4, yTop - yCut);

  const cam = stage.rig.camera;
  /** Camera right axis. Horizontal by construction (`lookAt` with world up), and
   *  constant — only the rig's DISTANCE changes between passes, never its rotation. */
  const right = new THREE.Vector3();

  /**
   * Point the rig at a frame `visibleH` metres tall whose top edge is at `frameTop`,
   * shifted `pan` metres along the camera's right axis.
   *
   * `pan` translates the look-at point and the camera together, so it is a pure lateral
   * slide of the frame — no orbit, no change of scale, and therefore free. `snapTo`
   * takes a point on the ground plane and `targetHeight` supplies the height, which is
   * why the pan only has to fill in x and z.
   */
  const place = (visibleH: number, frameTop: number, pan: number): void => {
    stage.rig.subjectFill = 1;
    stage.rig.subjectHeight = visibleH;
    stage.rig.targetHeight = frameTop - visibleH / 2;
    stage.rig.snapTo(pan * right.x, pan * right.z);
    // What `WebGLRenderer.render` will do anyway. Done here because the framing solve
    // below projects through these matrices BEFORE anything is rendered, and a stale
    // `matrixWorldInverse` silently measures the previous character's camera.
    cam.updateMatrixWorld(true);
    cam.matrixWorldInverse.copy(cam.matrixWorld).invert();
  };

  // Two passes to find the ZOOM, because the width has to be measured along an axis the
  // camera decides and the camera's DISTANCE then depends on that width. Only the
  // distance changes between the passes — pitch and yaw are fixed — so the right axis
  // read after pass 1 is the one pass 2 renders with.
  place(framedH / FILL_V, yTop + TOP_PAD * (framedH / FILL_V), 0);
  right.setFromMatrixColumn(cam.matrixWorld, 0).normalize();
  const upperHalfW = halfWidthAbove(model.root, yCut, right);
  // Whichever of the three binds. UNCHANGED, deliberately: this is the only expression
  // that sets scale, so freezing it is what guarantees the framing repair below cannot
  // hand back any of the measured fill. The third term is the zoom backstop for a face
  // that will not clear the nameplate even at the full slide.
  const visibleH = Math.max(
    framedH / FILL_V,
    (2 * upperHalfW) / (ASPECT * WIDTH_ALLOW),
    faceBox ? (yTop - faceBox.min.y) / (FACE_FLOOR + HEAD_CROP) : 0,
  );

  /**
   * Place the frame so the PROJECTED face lands inside `FACE_SAFE`.
   *
   * Two free knobs and one expensive one, tried in that order:
   *   1. slide DOWN (`frameTop`), up to `HEAD_CROP_MAX` — buys vertical headroom for the
   *      face by spending the top of the head;
   *   2. slide SIDEWAYS (`pan`) — buys horizontal room by spending nothing at all, since
   *      the subject is wider than the frame on everyone it fires for;
   *   3. zoom out — the backstop, and the only one that costs fill. Across all eleven
   *      characters it never fires; it exists so the guarantee is a guarantee.
   *
   * Iterative rather than closed-form because moving the camera changes the projection
   * that decided to move it (parallax on a box with real depth). Three passes converge to
   * well under a pixel; the loop is bounded so a pathological rig cannot hang the menu.
   */
  let frameTop = yTop + TOP_PAD * visibleH;
  let pan = 0;
  let zoom = visibleH;
  if (faceBox) {
    const slideFloor = () => yTop - HEAD_CROP_MAX * zoom;
    for (let pass = 0; pass < 4; pass++) {
      // (1) Vertical. Aim the projected bottom of the face at FACE_FLOOR_PX, sliding the
      //     frame down over the mass and stopping at the cap.
      frameTop = yTop + TOP_PAD * zoom;
      for (let i = 0; i < 3; i++) {
        place(zoom, frameTop, pan);
        const f = projectBox(faceBox, cam, SIZE_W, SIZE_H);
        const over = (f.y + f.h) / SIZE_H - FACE_FLOOR_PX;
        if (over <= 0) break;
        // Two floors under the slide, and the second one is not optional: sliding far
        // enough carries the TOP of the face off the top edge, which is a FACE-OUT in the
        // other direction. A sweep at HEAD_CROP_MAX 0.26 produced exactly that on egg
        // (FACE-OUT T2 at the landscape phone) before this guard existed.
        const room = Math.max(0, (f.y / SIZE_H - FACE_SAFE.y0) * zoom);
        const next = Math.max(slideFloor(), frameTop - Math.min(over * zoom, room));
        if (Math.abs(next - frameTop) < 1e-4) break;
        frameTop = next;
      }
      place(zoom, frameTop, pan);
      const f = projectBox(faceBox, cam, SIZE_W, SIZE_H);

      // (2) Horizontal. The minimum shift that brings the face inside the safe window;
      //     zero for ten of eleven. Egg pays it because its head is turned 30 degrees in
      //     the idle pose sampled here and its face is 0.83 of the frame wide, so the
      //     turn alone carries the far eye off the right edge.
      const overR = (f.x + f.w) - FACE_SAFE.x1 * SIZE_W;
      const overL = FACE_SAFE.x0 * SIZE_W - f.x;
      const metresPerPx = (zoom * ASPECT) / SIZE_W;
      if (overR > 0 && overL < 0) pan += Math.min(overR, -overL) * metresPerPx;
      else if (overL > 0 && overR < 0) pan -= Math.min(overL, -overR) * metresPerPx;

      // (3) Zoom, only for what neither slide can reach.
      const tooWide = f.w / ((FACE_SAFE.x1 - FACE_SAFE.x0) * SIZE_W);
      const bottom = (f.y + f.h) / SIZE_H;
      const tooLow = bottom > FACE_SAFE.y1
        ? (bottom + HEAD_CROP_MAX) / (FACE_SAFE.y1 + HEAD_CROP_MAX)
        : 1;
      const grow = Math.max(tooWide, tooLow);
      if (grow <= 1.001) break;
      zoom *= grow;
    }
  }
  place(zoom, frameTop, pan);

  const cardHex = RARITY_CARD_COLORS[CHARACTERS[id].rarity];
  stage.scene.background = new THREE.Color(cardHex);
  stage.lighting.focus(0, 0, 4);

  // The card colour AFTER the grade, sampled from a frame with nothing in it but the
  // background — see `ThumbMeta.bg`. This reuses the composer warm-up render rather than
  // adding one (reading back a half-initialised composer target gives a black card), so
  // it costs one extra frame per CARD COLOUR, six in the whole batch.
  if (!gradedBg.has(cardHex)) {
    model.root.visible = false;
    stage.render(0);
    gradedBg.set(cardHex, samplePixel(stage.canvas));
    model.root.visible = true;
  }

  // Two frames: the first one warms the post chain's buffers, and reading back a
  // half-initialised composer target gives a black card.
  stage.render(0);
  stage.render(0);
  const url = stage.canvas.toDataURL('image/png');

  // QA metadata, after the render so the camera matrices are the ones that drew it.
  const hips = model.root.getObjectByName('hips');
  const shoulder = model.root.getObjectByName('shoulderL');
  const wv = new THREE.Vector3();
  (window.__thumbMeta ??= {})[id] = {
    size: { w: SIZE_W, h: SIZE_H },
    subject: projectBox(box, cam, SIZE_W, SIZE_H),
    head: headBox ? projectBox(headBox, cam, SIZE_W, SIZE_H) : null,
    face: faceBox ? projectBox(faceBox, cam, SIZE_W, SIZE_H) : null,
    bg: gradedBg.get(cardHex) ?? null,
    world: {
      minY: +box.min.y.toFixed(4), maxY: +box.max.y.toFixed(4),
      halfWidth: +Math.max(Math.abs(box.min.x), Math.abs(box.max.x)).toFixed(4),
      hipsY: hips ? +hips.getWorldPosition(wv).y.toFixed(4) : null,
      shoulderY: shoulder ? +shoulder.getWorldPosition(wv).y.toFixed(4) : null,
      headY: headBox ? [+headBox.min.y.toFixed(4), +headBox.max.y.toFixed(4)] : null,
      faceY: faceBox ? [+faceBox.min.y.toFixed(4), +faceBox.max.y.toFixed(4)] : null,
      yCut: +yCut.toFixed(4),
      upperHalfWidth: +upperHalfW.toFixed(4),
    },
    frame: {
      subjectHeight: +stage.rig.subjectHeight.toFixed(4),
      subjectFill: +stage.rig.subjectFill.toFixed(4),
      targetHeight: +stage.rig.targetHeight.toFixed(4),
      headroom: +((frameTop - yTop) / zoom).toFixed(4),
      pan: +pan.toFixed(4),
    },
  };

  stage.scene.remove(model.root);
  model.dispose();

  cache.set(id, url);
  for (const fn of pending) fn(id, url);

  // Yield between characters so a slow (software-rendered) device keeps its menu
  // responsive instead of locking up for the whole batch.
  await new Promise((r) => setTimeout(r, 0));
}
