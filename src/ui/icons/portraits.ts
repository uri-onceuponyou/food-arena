/**
 * Character icons — RENDERED, not drawn.
 *
 * ── Why this is the preferred route ─────────────────────────────────────────
 * Every character exists as a real 3D model that the game already renders. An icon
 * taken from that model is guaranteed to match what the player sees in the match, and
 * cannot drift from it when a character loop re-shapes a head next week. A drawing
 * would have to be re-drawn eleven times every time that happens, and in practice
 * would not be — which is precisely how an art set rots.
 *
 * ── Cost: zero new renders ──────────────────────────────────────────────────
 * `src/ui/screens/thumbs.ts` already renders all eleven roster portraits through the
 * real `Stage`, progressively, off an idle callback, into a session cache. This module
 * adds no second renderer and no second cache — it is a formatter over that one.
 *
 * The one thing it adds is `generate: false`, used by the HUD. The HUD is on screen
 * during a live match, and standing up an offscreen `WebGLRenderer` mid-fight to make
 * a 24px badge would be a hitch for no gain. With `generate: false` the HUD consumes
 * whatever is already cached and never triggers a render. In the real flow that is
 * always everything: character select mounts before any match can start and warms the
 * cache there. Boot straight into `/?player=..&enemy=..` and the badges show the
 * neutral fighter mark below instead, which is a fine resting state and not a bug.
 */

import { RARITY_CARD_COLORS, CHARACTERS, type CharacterId } from '../../game/rules';
import { getCachedThumb, requestThumbnails } from '../screens/thumbs';

/** Stand-in shown until a render lands: a chibi head-and-shoulders on the character's
 *  own rarity colour. Deliberately generic — it reads as "a fighter", never as a
 *  wrong fighter. */
const FIGHTER_MARK =
  '<circle cx="12" cy="9" r="5.6" fill="#FFF3DE"/>' +
  '<path d="M5.2 21.6c0-3.5 3-5.6 6.8-5.6s6.8 2.1 6.8 5.6z" fill="#FFF3DE"/>';

export interface PortraitOpts {
  /** Extra class names on the wrapper. */
  class?: string;
  /**
   * `head` zooms into the character's head.
   *
   * Use it anywhere the portrait ships below ~32px. `thumbs.ts` frames the WHOLE body
   * because the roster card wants that, and a whole body scaled to a 24px HUD badge is
   * six pixels of head — while the silhouette test in `PROGRESS.md` found that
   * essentially all of a character's identifying information IS the head. Cropping to
   * it is also what the shipped reference does with its own nameplate portraits.
   */
  crop?: 'full' | 'head';
}

/**
 * Markup for one character icon.
 *
 * The wrapper carries the rarity colour, which is also the colour `thumbs.ts` bakes
 * behind the render — so the placeholder, the letterboxing and the portrait all sit on
 * one continuous field and the swap from mark to portrait is invisible apart from the
 * character appearing.
 */
export function portraitMarkup(id: CharacterId, opts: PortraitOpts = {}): string {
  const bg = RARITY_CARD_COLORS[CHARACTERS[id].rarity];
  const cached = getCachedThumb(id);
  const cls = [
    'fa-ic-portrait',
    opts.crop === 'head' ? 'fa-ic-portrait--head' : '',
    cached ? 'has-render' : '',
    opts.class ?? '',
  ].filter(Boolean).join(' ');
  const src = cached ? ` src="${cached}"` : '';
  return (
    `<span class="${cls}" data-portrait="${id}" style="--pc:${bg}">` +
    `<img alt=""${src}/>` +
    `<svg class="fa-ic" viewBox="0 0 24 24" fill="none" style="stroke:var(--fa-ic-ink,#1a1224)" stroke-width="1.7" ` +
    `stroke-linejoin="round" stroke-linecap="round" aria-hidden="true" focusable="false">${FIGHTER_MARK}</svg>` +
    '</span>'
  );
}

/**
 * Fill in every `[data-portrait]` under `root` and keep filling as renders land.
 *
 * Call it after writing markup that contains `portraitMarkup()`. Idempotent, and safe
 * to call on a subtree that has already been hydrated.
 *
 * `generate` defaults to true (ask `thumbs.ts` to render anything missing). Pass false
 * from anything that runs during a live match — see the file header.
 */
export function hydratePortraits(root: ParentNode, opts: { generate?: boolean } = {}): void {
  const paint = (id: CharacterId, url: string): void => {
    for (const host of root.querySelectorAll<HTMLElement>(`[data-portrait="${id}"]`)) {
      const img = host.querySelector('img');
      if (!img) continue;
      if (img.getAttribute('src') !== url) img.setAttribute('src', url);
      host.classList.add('has-render');
    }
  };
  if (opts.generate === false) {
    for (const host of root.querySelectorAll<HTMLElement>('[data-portrait]')) {
      const id = host.dataset.portrait as CharacterId;
      const hit = getCachedThumb(id);
      if (hit) paint(id, hit);
    }
    return;
  }
  requestThumbnails(paint);
}
