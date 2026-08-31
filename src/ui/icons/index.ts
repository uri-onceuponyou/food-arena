/**
 * The icon set. One import for every screen and for the HUD.
 *
 * ── Why this directory exists ───────────────────────────────────────────────
 * Six independent blind critics named emoji-as-icons the loudest remaining defect on
 * the menus and the trophy road, three of them calling it disqualifying, with the
 * currency and the containers singled out by name. Emoji are also the one art asset in
 * this project that is not ours: they are drawn by the reader's operating system, so
 * they change shape between a Mac, a phone and a Windows PC, they carry no outline
 * (which is why they smear on the HUD's dark plates), and they cannot be tinted,
 * cooled down or greyed out with the rest of a control.
 *
 * ── The two routes, and how each icon was assigned ──────────────────────────
 * There is no icon library available and none can be sourced, exactly as with audio.
 * So, per icon:
 *
 *  1. **Rendered from the game's own 3D content** — `portraits.ts`. Used for all
 *     eleven characters, because they exist as real models and a render cannot drift
 *     from the model. Zero new cost: it reuses the roster renders `screens/thumbs.ts`
 *     already makes.
 *  2. **Authored SVG** — `ui.ts` and `food.ts`. Used for everything with no 3D
 *     counterpart (coin, gem, trophy, chest, gear, mute, ...) and, after measuring,
 *     for the weapon glyphs too. `food.ts`'s header carries that measurement: only 16
 *     of 33 weapons have a bespoke projectile object to photograph, and a four-slot
 *     weapon bar that mixed renders with drawings would read worse than either alone.
 *
 * ── Sizing ──────────────────────────────────────────────────────────────────
 * Every icon is `1em` square, so it inherits the `font-size` the emoji it replaced was
 * already using and no call site has to re-do its layout. That is also why the shipped
 * sizes are so varied — 12px in a floating health pill, 26px in a weapon slot, up to
 * 48px on a trophy-road medal — and why `svg.ts` keeps the outline weight fixed in
 * viewBox units rather than in pixels.
 */

import { FOOD_ICONS } from './food';
import { ITEM_ICONS } from './items';
import { UI_ICONS } from './ui';

export { portraitMarkup, hydratePortraits } from './portraits';
export { ITEM_ICONS } from './items';

/**
 * ⚠️ **THE SPREAD IS A SILENT LAST-ONE-WINS, AND THAT IS THE ONLY HAZARD OF ADDING A
 * THIRD SOURCE.** Three flat records merged with `...` means a key present in two of them
 * resolves to whichever spread is later, with no error and no warning — the glyph simply
 * becomes a different drawing on a screen nobody was looking at. `ui.ts` and `food.ts` are
 * owned by other passes and both grow, so "I checked for collisions once" is a property of
 * the day it was checked. `node tools/tmp/il_seam.mjs` re-derives the three key sets from
 * source and fails on any intersection, and its own known-bad arm plants a collision and
 * requires the row to go red.
 *
 * The wording of this note is inherited verbatim from branch `items-groundwork`
 * (`3c30a3b`), which reached it independently. It was right.
 */
const REGISTRY: Record<string, string> = { ...UI_ICONS, ...FOOD_ICONS, ...ITEM_ICONS };

export type IconName = string;

export interface IconOpts {
  /** Extra class names. */
  class?: string;
  /** Override the `1em` default — a CSS length. */
  size?: string;
  /** Accessible label. Omit for decorative icons, which is nearly all of them. */
  label?: string;
}

/**
 * The outline colour is an INLINE STYLE reading a custom property, not a presentation
 * attribute.
 *
 * That is load bearing. These icons are outlined in the same ink as the surfaces, which
 * is right on cream and invisible on the project's dark pills — and this project has
 * shipped the dark-on-dark bug three separate times already (see PROGRESS.md). Any
 * container can now set `--fa-ic-ink` once and every icon inside it flips, including
 * icons it does not know about. Paths that set their own `stroke` attribute keep it;
 * everything else inherits.
 */
const OPEN =
  'viewBox="0 0 24 24" fill="none" style="stroke:var(--fa-ic-ink,#1a1224)" stroke-width="1.7" ' +
  'stroke-linejoin="round" stroke-linecap="round"';

/** Inline SVG markup for one icon. Returns an empty string for an unknown name, so a
 *  typo degrades to "no icon" rather than to a broken tag in the middle of a card. */
export function icon(name: IconName, opts: IconOpts = {}): string {
  const body = REGISTRY[name];
  if (!body) return '';
  const cls = ['fa-ic', `fa-ic--${name}`, opts.class ?? ''].filter(Boolean).join(' ');
  const size = opts.size ?? '1em';
  const a11y = opts.label ? `role="img" aria-label="${opts.label}"` : 'aria-hidden="true" focusable="false"';
  return `<svg class="${cls}" ${OPEN} width="${size}" height="${size}" ${a11y}>${body}</svg>`;
}

/**
 * ── The emoji translation tables ────────────────────────────────────────────
 *
 * `game/rules.ts` and `game/economy/` both carry an `emoji` field on their data —
 * weapons, abilities, containers, store SKUs, milestone faces. Those files are owned
 * elsewhere and are NOT edited here: the emoji stays in the model as a stable token,
 * and the UI translates it on the way to the screen. Anything untranslated falls
 * through to the emoji itself, so a reward type added tomorrow renders as it does
 * today instead of rendering as nothing.
 *
 * Left as a debt for the model's owner: a real `iconId` field would remove the
 * translation entirely. It is deliberately not a blocker — the table below is fifty
 * lines and the alternative was editing three files this agent does not own.
 */
const EMOJI_TO_ICON: Record<string, string> = {
  // Currency, progression, chrome.
  '🪙': 'coin', '💎': 'gem', '🏆': 'trophy', '⭐': 'star', '✨': 'sparkle',
  '🏁': 'flag', '📍': 'pin', '🎉': 'party', '🎁': 'gift', '🧑‍🍳': 'chefhat',
  '⚙️': 'gear', '⚙': 'gear', '🔒': 'lock', '▶': 'play', '⏸': 'pause', '◀': 'back',
  '🙂': 'avatar', '🚧': 'cone', '🔇': 'mute', '🔊': 'sound', '🏠': 'home', '🍟': 'swap',
  '❤️': 'health', '❤': 'health', '💨': 'speed', '↔': 'range', '⏱': 'timer',
  '💚': 'heal', '💫': 'stun', '🐌': 'slow',
  // Weapons and abilities.
  '🍖': 'patty', '🍅': 'tomato', '🥬': 'lettuce', '🧅': 'onion', '🍬': 'candy',
  '🥩': 'meat', '🌯': 'wrap', '🌀': 'swirl', '🥚': 'egg', '🐣': 'chick',
  '💥': 'burst', '🔨': 'hammer', '🍭': 'lollipop', '⚪': 'dough', '🧀': 'cheese',
  '🍚': 'rice', '🌿': 'seaweed', '🐟': 'fish', '🐡': 'puffer', '💦': 'droplets',
  '🍜': 'noodle', '🌊': 'wave', '🧊': 'shards', '🔵': 'cap', '💛': 'mustardblast',
  '🔴': 'ketchupslip', '⚔️': 'slash', '⚔': 'damage', '🍯': 'honey', '💧': 'droplets',
};

/**
 * Containers are keyed by KIND, never by emoji.
 *
 * Deliberate: `CONTAINERS.hamburgerBox.emoji` is the same burger as
 * `CHARACTERS.hamburger.emoji`, so an emoji lookup cannot tell a box from a fighter.
 * Every call site knows which it has, so it passes the kind.
 *
 * The four purchasable boxes share one silhouette and differ by colourway, because
 * they are one ladder of the same object. The free `chest` keeps its own shape — it is
 * earned rather than bought, and the model names it differently for that reason.
 */
const CONTAINER_ICON: Record<string, string> = {
  chest: 'chest',
  hamburgerBox: 'boxBurger',
  pineappleBox: 'boxPineapple',
  redBox: 'boxRed',
  fireBox: 'boxFire',
};

/** Translate any model-supplied emoji. Falls back to the emoji when unmapped. */
export function emojiIcon(emoji: string, opts: IconOpts = {}): string {
  const name = EMOJI_TO_ICON[emoji];
  return name ? icon(name, opts) : emoji;
}

/** A container's icon, by kind. */
export function containerIcon(kind: string, opts: IconOpts = {}): string {
  return icon(CONTAINER_ICON[kind] ?? 'chest', opts);
}

/** A weapon's or ability's icon, from the `emoji` field `rules.ts` already carries. */
export function abilityIcon(emoji: string, opts: IconOpts = {}): string {
  return emojiIcon(emoji, opts);
}

// ── Styles ───────────────────────────────────────────────────────────────────

const STYLE_ID = 'fa-icon-styles';

/** Idempotent style injection, the same pattern `hud.ts` and `theme.ts` use. Called by
 *  every module that emits icons, so no caller has to remember an init order. */
export function ensureIconStyles(): void {
  if (document.getElementById(STYLE_ID)) return;
  const style = document.createElement('style');
  style.id = STYLE_ID;
  style.textContent = ICON_CSS;
  document.head.appendChild(style);
}

const ICON_CSS = `
/* The icon itself. Inline-block rather than inline so it never picks up a line box's
   descender gap, and shrink-proof so a flex row cannot squash it into a sliver — which
   is what happens to an SVG in a flex container with no basis. */
.fa-ic {
  display: inline-block;
  flex: 0 0 auto;
  vertical-align: -0.15em;
}

/* Rendered character portrait. The wrapper carries the rarity colour that thumbs.ts
   also bakes behind the render, so the placeholder mark, the letterboxing and the
   portrait all sit on one continuous field. */
.fa-ic-portrait {
  position: relative;
  display: inline-block;
  flex: 0 0 auto;
  width: 1em;
  height: 1em;
  vertical-align: -0.15em;
  border-radius: 50%;
  overflow: hidden;
  background: var(--pc, #C9B8DE);
}
.fa-ic-portrait img {
  position: absolute;
  inset: 0;
  width: 100%;
  height: 100%;
  object-fit: cover;
  display: none;
}
.fa-ic-portrait .fa-ic {
  position: absolute;
  inset: 0;
  width: 100%;
  height: 100%;
  vertical-align: baseline;
}
.fa-ic-portrait.has-render img { display: block; }
/* Head crop for badge-sized portraits — see PortraitOpts.crop in portraits.ts.
   ⚠️ THIS RULE IS A FUNCTION OF HOW 'thumbs.ts' FRAMES, and it was retuned when that
   changed. It used to read scale(1.8) / origin 50% 31%, sized against a source that
   held a WHOLE STANDING BODY. thumbs.ts now frames the upper body, and 1.8x on top of
   that showed a slice of Hot Dog's bun with no face in it and one of Egg's eyes —
   measured by cropping the trophy road's own character nodes at 8x
   ('tools/tmp/portrait_crop_check.mjs').
   Retuned by measurement, not by eye: 'thumbs.ts' publishes every character's face
   rect in source pixels on 'window.__thumbMeta', and across the seven characters that
   carry a 'face' joint those rects span source y 0.166-0.760 and x 0.157-0.842. A
   square badge's own 'object-fit: cover' already trims the 416x496 source to
   y 0.081-0.919, and scale(1.2) at origin 14% then shows y 0.100-0.799, x 0.083-0.917
   — the whole envelope, with margin on all four sides. scale(1.3) clips Pizza. */
.fa-ic-portrait--head img { transform: scale(1.2); transform-origin: 50% 14%; }
.fa-ic-portrait.has-render .fa-ic { display: none; }
`;
