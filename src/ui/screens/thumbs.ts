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
let generating = false;

declare global {
  interface Window {
    /** QA-only: true once every roster portrait has been rendered and cached. A
     *  screenshot driver waits on this so a review plate is never captured
     *  half-way through the progressive upgrade from emoji to portrait. */
    __thumbsReady?: boolean;
  }
}

export function getCachedThumb(id: CharacterId): string | undefined {
  return cache.get(id);
}

/**
 * Render any roster art that is not cached yet, calling `onReady` per character.
 *
 * Safe to call on every mount: already-cached entries are replayed immediately and
 * a generation pass already in flight is not started twice.
 */
export function requestThumbnails(onReady: (id: CharacterId, url: string) => void): void {
  for (const id of CHARACTER_IDS) {
    const hit = cache.get(id);
    if (hit) onReady(id, hit);
  }
  if (cache.size === CHARACTER_IDS.length) { window.__thumbsReady = true; return; }
  if (generating) return;
  generating = true;
  window.__thumbsReady = false;

  // Deferred so the screen paints, and the player can read and tap it, before the
  // GPU is asked to do eleven renders.
  const start = () => void generate(onReady).finally(() => {
    generating = false;
    window.__thumbsReady = cache.size === CHARACTER_IDS.length;
  });
  if (typeof requestIdleCallback === 'function') requestIdleCallback(start, { timeout: 600 });
  else setTimeout(start, 120);
}

async function generate(onReady: (id: CharacterId, url: string) => void): Promise<void> {
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
      maxPixelRatio: 1,
    });
    stage.canvas.style.cssText = `display:block;width:${SIZE}px;height:${SIZE}px;`;
    stage.resize();

    for (const id of CHARACTER_IDS) {
      if (cache.has(id)) continue;
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

      // Two frames: the post chain (SMAA in particular) needs one settled frame
      // before the buffer is worth reading back.
      stage.render(0);
      stage.render(0);
      const url = stage.canvas.toDataURL('image/png');

      stage.scene.remove(model.root);
      model.dispose();

      cache.set(id, url);
      onReady(id, url);

      // Yield between characters so a slow (software-rendered) device keeps its menu
      // responsive instead of locking up for the whole batch.
      await new Promise((r) => setTimeout(r, 0));
    }
  } catch {
    // Non-fatal by design: the emoji placeholder is already on screen and stays.
  } finally {
    stage?.dispose();
    host.remove();
  }
}
