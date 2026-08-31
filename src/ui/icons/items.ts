/**
 * ITEM GLYPHS — one authored SVG per loadout item.
 *
 * Uri, verbatim: *"Add game items — Like Zooba has (up to 2 items per player, he sets it
 * up on the loby, which ones he wants to use out of what he has). **Figure out names and
 * looks for the items based on what they do**"*.
 *
 * "Looks" is this file. The names, the rarities and the effect text are in
 * `src/ui/screens/loadout.ts`, which is also where the seam back to `rules.ts` is
 * documented.
 *
 * ── Why authored SVG and not emoji, renders, or a library ───────────────────
 * `index.ts`'s header settles it and nothing here re-litigates it: six blind critics
 * named emoji-as-icons the loudest remaining menu defect, and the two available routes
 * are *render it from the game's own 3D content* or *draw it*. **None of these ten items
 * has a 3D counterpart** — no mesh, no VFX, no material; the sim does not implement one
 * of them yet — so route 1 is not available for any of them and route 2 is not a
 * preference. The day a Mold Cloud exists as a particle system, `portraits.ts`'s
 * argument applies and these should be re-derived from it.
 *
 * ── Two drawing rules that are LOAD-BEARING here, both inherited ────────────
 *  1. **1em square.** Every glyph is sized from the `font-size` of its call site, so the
 *     same body serves a 20 px slot chip and a 40 px sheet row with no second asset.
 *     Delivered sizes in this pass: **26 px** (equipped slot), **34 px** (picker row).
 *  2. **The outline colour is inherited, never authored.** `index.ts` sets
 *     `stroke:var(--fa-ic-ink,#1a1224)` on the `<svg>`; a path that sets its own `stroke`
 *     opts OUT of that and will not flip on a dark plate. This project has shipped the
 *     dark-on-dark bug three times (`PROGRESS.md`), so the four glyphs below that need a
 *     coloured stroke (`licoriceRope`, `zombiePower`) draw an INK PATH UNDERNEATH at a
 *     wider stroke and the colour on top — the outline is then the inherited ink, the
 *     way a filled shape's outline would be, and it flips with everything else.
 *
 * ⚠️ **These are drawings, not measurements, and they have NOT been through a blind
 * legibility round.** `ui.ts`'s `coin` is the cautionary tale directly above: it was
 * redrawn three times and the version that finally worked was found by a PAIRED plate at
 * the delivered size (11.03 px), where the shipped one scored 0/3 and read as a bottle
 * cap. Nothing here has had that treatment. What HAS been checked is the thing that
 * silently kills a glyph regardless of how well it is drawn — that it is not invisible
 * against the surface it sits on. See `tools/tmp/il_contrast.mjs`.
 */

import { P } from './svg';

/**
 * Item id → SVG body, merged into the shared registry by `index.ts`.
 *
 * 🚨 **KEYS ARE PLAIN camelCase AND MUST STAY THAT WAY.** `icon()` writes the key into a
 * class name (`fa-ic--${name}`), so a dotted or namespaced key (`item.rope`) produces
 * `class="fa-ic--item.rope"` — legal in the attribute, and a class no CSS selector can
 * ever address without escaping. The registry is flat and shared with `ui.ts` and
 * `food.ts`; every key below was checked against both for collisions before it was
 * chosen (`node tools/tmp/il_seam.mjs` re-checks it, because the other two files are
 * owned elsewhere and grow).
 */
export const ITEM_ICONS: Record<string, string> = {
  // ── Pepper Mill — consecutive hits on one target grind harder ──────────────
  // A grinder plus flakes leaving it to the right. The flakes are what make it a MILL
  // rather than a bottle: a tapered wooden body with a knob is also a chess piece.
  pepperMill: `
<path d="M9.4 12.3h5.2l1.2 8.3H8.2z" fill="${P.wood}"/>
<path d="M9.9 8.3h4.2l.5 4H9.4z" fill="${P.woodHi}"/>
<path d="M11.2 5.4h1.6v2.9h-1.6z" fill="${P.woodHi}"/>
<circle cx="12" cy="4.3" r="1.9" fill="${P.gold}"/>
<circle cx="18.7" cy="14.3" r="1.05" fill="${P.ink}" stroke="none"/>
<circle cx="20.4" cy="17.6" r="0.9" fill="${P.ink}" stroke="none"/>
<circle cx="17.5" cy="19.4" r="0.8" fill="${P.ink}" stroke="none"/>`,

  // ── Trampoline — jump further, toward or away ──────────────────────────────
  // The arrow is half the glyph on purpose. A mat on two legs alone is a table.
  trampoline: `
<path d="M12 2.6v6.2" stroke-width="2.2"/>
<path d="M9.4 5.4 12 2.6l2.6 2.8" stroke-width="2.2"/>
<ellipse cx="12" cy="14.2" rx="8.4" ry="3.1" fill="${P.water}"/>
<ellipse cx="12" cy="13.5" rx="6.2" ry="2" fill="${P.waterHi}" stroke-width="1.3"/>
<path d="M4.8 15.6 6.6 20.6M19.2 15.6 17.4 20.6" stroke-width="2"/>`,

  // ── Warm Milk — sleep, longer the further away they are ────────────────────
  // Mug + Z. A mug with steam alone is "hot drink"; the Z is the whole meaning, so it
  // is INSIDE the vessel where it cannot be cropped off by a tight bounding box.
  warmMilk: `
<path d="M4.7 9.4h10.7v6.9a3.3 3.3 0 0 1-3.3 3.3H8a3.3 3.3 0 0 1-3.3-3.3z" fill="${P.cream}"/>
<path d="M15.4 11h1.5a2.3 2.3 0 0 1 0 4.6h-1.5"/>
<path d="M7.6 12.2h4.8l-4.8 4.2h4.8" stroke="${P.grape}" stroke-width="1.9" fill="none"/>
<path d="M8.6 2.8c1.3 1 1.3 2.2 0 3.2" stroke-width="1.4"/>
<path d="M12.2 2.4c1.3 1 1.3 2.2 0 3.2" stroke-width="1.4"/>`,

  // ── Plunger — clogs their weapon ───────────────────────────────────────────
  plunger: `
<path d="M11.1 3.2h1.8v9.3h-1.8z" fill="${P.wood}"/>
<path d="M6.5 12.5h11c0 4.2-2.2 7.4-5.5 8.4-3.3-1-5.5-4.2-5.5-8.4z" fill="${P.ketchup}"/>
<path d="M5.5 12.5h13" stroke-width="2"/>`,

  // ── Squid Ink — blots the screen of whoever it hits ────────────────────────
  // The blot is grapeDark rather than ink so it keeps an inherited ink OUTLINE. Drawn in
  // ink itself it would be a silhouette with no edge, i.e. the one shape in this set that
  // cannot flip onto a dark plate.
  squidInk: `
<path d="M12 3.3c3.5 0 6.4 2.3 6.4 5.4 0 1.9-1 3.1-1 4.6 0 1.9 1.8 2.5 1.8 4.1 0 1.4-1.2 2.4-2.7 2.4-1.4 0-2.1-.8-3.3-.8-1.4 0-2 1.2-3.7 1.2-2 0-3.3-1.4-3.3-3.1 0-1.6 1-2.4 1-3.7 0-1.6-1.6-2.6-1.6-4.7 0-3.1 2.9-5.4 6.4-5.4z" fill="${P.grapeDark}"/>
<circle cx="20.6" cy="6.2" r="1.5" fill="${P.grapeDark}"/>
<circle cx="3.5" cy="18.4" r="1.2" fill="${P.grapeDark}"/>`,

  // ── Black Hole — throws them next to a different enemy ─────────────────────
  blackHole: `
<circle cx="12" cy="12" r="9" fill="${P.grapeDark}"/>
<circle cx="12" cy="12" r="3.8" fill="${P.ink}" stroke-width="1.3"/>
<path d="M12 3.4a8.6 8.6 0 0 1 6 14.6" stroke="${P.grapeHi}" stroke-width="2" fill="none"/>
<path d="M12 20.6a8.6 8.6 0 0 1-6-14.6" stroke="${P.grapeHi}" stroke-width="2" fill="none"/>`,

  // ── Mold Cloud — a permanent aura that hurts anyone standing in it ─────────
  moldCloud: `
<path d="M7 18.2h10.2a4 4 0 0 0 .4-8 4.9 4.9 0 0 0-9-2.3A4.1 4.1 0 0 0 7 18.2z" fill="${P.lettuce}"/>
<circle cx="9.6" cy="13.6" r="1.15" fill="${P.leafDark}" stroke="none"/>
<circle cx="13.3" cy="11.5" r="1" fill="${P.leafDark}" stroke="none"/>
<circle cx="15.7" cy="14.6" r="0.9" fill="${P.leafDark}" stroke="none"/>
<circle cx="10.4" cy="20.6" r="0.85" fill="${P.lettuce}"/>
<circle cx="15.6" cy="20.4" r="0.7" fill="${P.lettuce}"/>`,

  // ── Fungus Shield — attackers take damage back for 5 s ─────────────────────
  fungusShield: `
<path d="M12 2.8 19.8 5.5v6.1c0 4.6-3.1 7.6-7.8 9.4-4.7-1.8-7.8-4.8-7.8-9.4V5.5z" fill="${P.lettuceHi}"/>
<path d="M12 7.2c2.6 0 4.7 1.7 4.7 3.5H7.3c0-1.8 2.1-3.5 4.7-3.5z" fill="${P.ketchup}"/>
<path d="M10.4 10.7h3.2v4.6a1.6 1.6 0 0 1-3.2 0z" fill="${P.cream}"/>
<circle cx="10.2" cy="9.2" r="0.7" fill="${P.cream}" stroke="none"/>
<circle cx="13.7" cy="9.4" r="0.6" fill="${P.cream}" stroke="none"/>`,

  // ── Zombie Power — you come back when your killer dies ─────────────────────
  // Ink under-strokes first, colour on top: see the header. Three separated fingers, not
  // a hand silhouette — a filled hand at 26 px is a mitten.
  zombiePower: `
<path d="M8.3 18.6V8.4M12 18.6V5.6M15.7 18.6V8" stroke-width="4.8" stroke-linecap="round"/>
<path d="M8.3 18.6V8.4M12 18.6V5.6M15.7 18.6V8" stroke="${P.lettuce}" stroke-width="2.6" stroke-linecap="round"/>
<path d="M5.2 20.4c1.5-2.1 3.8-3.1 6.8-3.1s5.3 1 6.8 3.1z" fill="${P.wood}"/>
<path d="M2.8 20.5h18.4" stroke-width="2.2"/>`,

  // ── Licorice Rope — ties an opponent for 5 s ───────────────────────────────
  licoriceRope: `
<ellipse cx="11" cy="8.6" rx="6.4" ry="4.3" fill="none" stroke-width="4.8"/>
<ellipse cx="11" cy="8.6" rx="6.4" ry="4.3" fill="none" stroke="${P.candy}" stroke-width="2.4"/>
<path d="M16.4 11.6c2.4 2.3 2 5.6-1.2 8.2" fill="none" stroke-width="4.8"/>
<path d="M16.4 11.6c2.4 2.3 2 5.6-1.2 8.2" fill="none" stroke="${P.candy}" stroke-width="2.4"/>`,
};
