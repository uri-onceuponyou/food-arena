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

/** Square, and big enough that a 210px card at 2x DPR is still sharp. */
const SIZE = 448;
/** Fraction of the frame the character fills on its long axis. */
const FILL = 0.80;

const cache = new Map<CharacterId, string>();
/** Every listener waiting on the batch in flight. Cleared when it finishes. */
const pending: Array<(id: CharacterId, url: string) => void> = [];
let generating = false;

declare global {
  interface Window {
    /** QA-only: true once every portrait THIS SCREEN asked for has been rendered
     *  and cached. A screenshot driver waits on this so a review plate is never
     *  captured half-way through the progressive upgrade from mark to portrait.
     *
     *  On the roster screen that is still all eleven; on home and the trophy road it
     *  is the handful those screens actually display — see `demandedIds`. */
    __thumbsReady?: boolean;
  }
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
  host.style.cssText = `position:fixed;left:-9999px;top:0;width:${SIZE}px;height:${SIZE}px;pointer-events:none;`;
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
        subjectFill: FILL,
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
    stage.canvas.style.cssText = `display:block;width:${SIZE}px;height:${SIZE}px;`;
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

async function renderOne(stage: Stage, id: CharacterId): Promise<void> {
  const model = createCharacter(id);
  stage.scene.add(model.root);
  model.play('idle');
  // Settle the idle pose off its zero-crossing so the portrait has a little life
  // in it, then measure and frame.
  model.update({ dt: 0.4, elapsed: 0.4, moveSpeed01: 0, health01: 1 });

  const box = new THREE.Box3().setFromObject(model.root);
  const h = Math.max(0.5, box.max.y - box.min.y);
  const w = 2 * Math.max(0.25, Math.abs(box.min.x), Math.abs(box.max.x));
  // Square frame, so whichever axis is larger is the one that sets the fit.
  stage.rig.subjectHeight = Math.max(h, w);
  stage.rig.subjectFill = FILL;
  stage.rig.targetHeight = (box.min.y + box.max.y) / 2;
  stage.rig.snapTo(0, 0);

  stage.scene.background = new THREE.Color(RARITY_CARD_COLORS[CHARACTERS[id].rarity]);
  stage.lighting.focus(0, 0, 4);

  // Two frames: the first one warms the post chain's buffers, and reading back a
  // half-initialised composer target gives a black card.
  stage.render(0);
  stage.render(0);
  const url = stage.canvas.toDataURL('image/png');

  stage.scene.remove(model.root);
  model.dispose();

  cache.set(id, url);
  for (const fn of pending) fn(id, url);

  // Yield between characters so a slow (software-rendered) device keeps its menu
  // responsive instead of locking up for the whole batch.
  await new Promise((r) => setTimeout(r, 0));
}
