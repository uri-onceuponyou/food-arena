/**
 * ITEM GLYPHS — one authored SVG per loadout item.
 *
 * Uri, verbatim: *"Add game items — Like Zooba has (up to 2 items per player, he sets it
 * up on the loby, which ones he wants to use out of what he has). **Figure out names and
 * looks for the items based on what they do**"*.
 *
 * The names, rarities, blurbs and per-item visual briefs are `rules.ts:ITEMS`. This file
 * is the 24×24 glyph half of "looks", and every drawing below is a reading of that item's
 * own `look` string — which is why `tenderiser` is a MALLET and not a pepper mill, and
 * `disposal` is a SINK DRAIN and not a black hole.
 *
 * ── 🚨 THE PROVENANCE, BECAUSE HALF OF THIS FILE IS SOMEBODY ELSE'S ─────────
 * Branch `items-groundwork` (`3c30a3b`) holds `src/ui/icons/items.ts` written by an
 * agent building on a contract that never landed. Four of its glyphs are carried here
 * essentially unchanged (`warm_milk`, `pompa`, `squid_ink`, `liquorice`) because they
 * were good and because they already match the landed `look`. **Six are re-drawn**, and
 * not for taste — the landed registry disagrees with that branch about what the object
 * IS:
 *
 *     branch drew          rules.ts:ITEMS.look says          so this file draws
 *     pepper mill          "a wooden meat mallet"            a mallet
 *     trampoline           "a springform cake tin"           a cake tin
 *     black hole           "a sink drain opening"            a drain
 *     mold cloud (green)   "blue-green haze"                 a blue-green haze
 *     shield + mushroom    "overlapping mushroom caps"       three caps
 *     zombie hand          "a fridge-light glow"             a fridge
 *
 * That is the exact failure `docs/ITEMS.md` records — three agents inventing the
 * foundation in parallel — caught here only because the registry landed first and this
 * file was written against it rather than against the branch.
 *
 * ── Why authored SVG, and not emoji or a render ─────────────────────────────
 * `index.ts`'s header settles it and nothing here re-litigates it. The one clause worth
 * repeating is the branch's, because it is the honest reason route 1 is unavailable:
 * **none of these ten items has a 3D counterpart today** — no mesh, no material, no
 * particle system — so `portraits.ts`'s "photograph the real thing" argument has nothing
 * to photograph. The day a Blue Cheese cloud exists in the world, these should be
 * re-derived from it.
 *
 * ── Three drawing rules that are LOAD-BEARING, all inherited ────────────────
 *  1. **24×24 viewBox, 1em square.** Sized from the call site's `font-size`, so the same
 *     body serves the equipped slot and the picker row with no second asset. Delivered
 *     sizes in this pass: **28 px** (slot chip) and **30 px** (picker row).
 *  2. **The outline colour is INHERITED, never authored.** `index.ts` puts
 *     `stroke:var(--fa-ic-ink,#1a1224)` on the `<svg>`; a path that sets its own `stroke`
 *     opts OUT and will not flip on a dark plate. This project has shipped the
 *     dark-on-dark bug three times. Where a glyph needs a COLOURED stroke (`liquorice`,
 *     `springform`'s arc) it draws an INK PATH UNDERNEATH at a wider width and the colour
 *     on top, so the outline is still the inherited ink.
 *  3. **Nothing thinner than ~1.5 units**, flat fills, one highlight, no gradients.
 *
 * ── ⚠️ WHAT HAS AND HAS NOT BEEN MEASURED ───────────────────────────────────
 * **Measured:** every glyph is drawn at its delivered size on its real surface and the
 * rendered pixels are checked for contrast against WCAG 2.1 SC 1.4.11's 3.0 floor —
 * `tools/tmp/il_accept.mjs` §C, with a planted 1.02:1 known-bad proving the row can go
 * red. That is the check that catches the class the match pause chip shipped in: a
 * control that works perfectly and cannot be seen.
 *
 * **NOT measured:** legibility. Nothing here has been through a blind naming round, and
 * `ui.ts`'s header is the standing warning about what that costs — its `coin` was redrawn
 * three times and the winner was found by a paired plate at the delivered size, where the
 * shipped glyph scored 0/3 and was named "a bottle cap" by three judges. `xr_repro.mjs`
 * also prices the round: a reproducible per-icon number is 6 panels / 18 judges for ±1
 * judge, and only 0-of-N and N-of-N verdicts are affordable at all. So the honest state
 * of this file is **drawn, contrast-checked, unjudged**.
 *
 * 🚨 **THE ONE COLLISION THAT IS FORESEEABLE AND IS CALLED OUT HERE RATHER THAN
 * DISCOVERED LATER:** `food.ts:hammer` is a wide pale-steel block on a brown handle, and
 * a meat mallet is the same object. `tenderiser` below is therefore drawn WOODEN rather
 * than steel, on a DIAGONAL rather than upright, and carries a dimple grid the hammer has
 * no reason to have — three separations, because `ui.ts`'s measured `chest`↔`boxBurger`
 * swap shows one is not enough. It is a prediction, not a measurement; a blind round is
 * the only thing that settles it.
 */

import type { ItemId } from '../../game/rules';
import { P } from './svg';

/**
 * Colours the shared palette does not carry, kept LOCAL rather than added to `svg.ts:P`.
 *
 * `P` is imported by `hud.ts` as well as by every icon file, so it is a shared surface
 * and three items' worth of blue-green does not belong in it. Both are picked to sit in
 * the same value band as `P.lettuce`/`P.leafDark`, which is what keeps the haze reading
 * as one object at 28 px.
 */
const IP = {
  /** Blue-green, per `ITEMS.blue_cheese.look`: "a low, slowly-churning blue-green haze". */
  haze: '#5FBFA8',
  hazeDark: '#2E7C6B',
  /** The shiitake cap. Warmer and darker than `P.wood` so cap and stem separate. */
  cap: '#7A4A34',
  capHi: '#A9694A',
} as const;

/**
 * Item id → SVG body, merged into the shared registry by `index.ts`.
 *
 * 🚨 **KEYED BY `ItemId` ITSELF, AND THE TYPE IS THE POINT.** `Record<ItemId, string>`
 * with a type-only import means renaming or adding an item in `rules.ts` is a **tsc
 * error here**, not a silently missing glyph on a screen nobody was looking at. The
 * branch this file inherits from used its own camelCase names and that is precisely how
 * it ended up drawing six objects the contract does not contain.
 *
 * ⚠️ The keys go into a class name (`fa-ic--${name}`), so they must be CSS-identifier
 * safe. Underscores are; dots are not. `warm_milk` → `.fa-ic--warm_milk` is addressable.
 * The registry is FLAT and shared with `ui.ts` and `food.ts`, both owned by other passes
 * and both growing, so "I checked for collisions once" is a property of the day it was
 * checked — `node tools/tmp/il_seam.mjs` re-derives all three key sets from source and
 * fails on any intersection.
 */
export const ITEM_ICONS: Record<ItemId, string> = {
  // ── Tenderiser — each hit on the same target hits harder ───────────────────
  // A wooden mallet on a diagonal, dimpled face, with two rising chevrons for the stack.
  // The chevrons are half the meaning: a mallet alone says "hit", not "hit HARDER each
  // time". See the header for why this is wood and not steel.
  tenderiser: `
<path d="M4.6 20.4 10.2 14.8" stroke-width="3.4"/>
<path d="M4.6 20.4 10.2 14.8" stroke="${P.patty}" stroke-width="1.9"/>
<path d="M11.6 8.2 17.4 14l-3.9 3.9L7.7 12.1z" fill="${P.wood}"/>
<path d="M13.1 6.7 18.9 12.5 17.4 14l-5.8-5.8z" fill="${P.woodHi}"/>
<circle cx="12.4" cy="12.4" r="0.75" fill="${P.pattyDark}" stroke="none"/>
<circle cx="14.6" cy="10.2" r="0.75" fill="${P.pattyDark}" stroke="none"/>
<circle cx="14.7" cy="14.6" r="0.75" fill="${P.pattyDark}" stroke="none"/>
<path d="M16.6 5.6 19 3.2l2.4 2.4M16.6 9.4 19 7l2.4 2.4" stroke="${P.gold}" stroke-width="1.9" fill="none"/>`,

  // ── Springform — bounce a long way, toward a fight or out of one ───────────
  // The ARC is the glyph; the tin is the punchline. A cake tin drawn alone is a saucepan
  // with no handle, so the launch arc carries the meaning and takes the top half.
  springform: `
<path d="M3.4 15.6C5 8.2 9.2 4.6 14.4 4.6" fill="none" stroke-width="4.4"/>
<path d="M3.4 15.6C5 8.2 9.2 4.6 14.4 4.6" fill="none" stroke="${P.mustard}" stroke-width="2.2"/>
<path d="M11.6 2.2 15 4.6l-3.2 2.6" stroke-width="3.6" fill="none"/>
<path d="M11.6 2.2 15 4.6l-3.2 2.6" stroke="${P.mustard}" stroke-width="1.8" fill="none"/>
<path d="M4.2 16.4h15.6v3.1a1.9 1.9 0 0 1-1.9 1.9H6.1a1.9 1.9 0 0 1-1.9-1.9z" fill="${P.steel}"/>
<path d="M3.2 15.2h17.6v1.9H3.2z" fill="${P.white}"/>
<path d="M18.1 17.2v3.4" stroke-width="1.4"/>
<circle cx="19.6" cy="18.9" r="1.4" fill="${P.gold}"/>`,

  // ── Warm Milk — sleep, longer the further away they were ───────────────────
  // Carried from `items-groundwork` unchanged in construction. Mug plus Z: a mug with
  // steam alone is "hot drink", so the Z is the whole meaning and it lives INSIDE the
  // vessel where a tight bounding box cannot crop it off.
  warm_milk: `
<path d="M4.7 9.4h10.7v6.9a3.3 3.3 0 0 1-3.3 3.3H8a3.3 3.3 0 0 1-3.3-3.3z" fill="${P.cream}"/>
<path d="M15.4 11h1.5a2.3 2.3 0 0 1 0 4.6h-1.5"/>
<path d="M7.6 12.2h4.8l-4.8 4.2h4.8" stroke="${P.grape}" stroke-width="1.9" fill="none"/>
<path d="M8.6 2.8c1.3 1 1.3 2.2 0 3.2" stroke-width="1.4"/>
<path d="M12.2 2.4c1.3 1 1.3 2.2 0 3.2" stroke-width="1.4"/>`,

  // ── Pompa — clogs a weapon for five seconds ────────────────────────────────
  // Uri's own word, and a plunger. Carried from `items-groundwork` unchanged: the cup is
  // the silhouette and nothing else in either registry is a red dome on a stick.
  pompa: `
<path d="M11.1 3.2h1.8v9.3h-1.8z" fill="${P.wood}"/>
<path d="M6.5 12.5h11c0 4.2-2.2 7.4-5.5 8.4-3.3-1-5.5-4.2-5.5-8.4z" fill="${P.ketchup}"/>
<path d="M5.5 12.5h13" stroke-width="2"/>`,

  // ── Squid Ink — blots the victim's own screen ──────────────────────────────
  // Carried from `items-groundwork`. The blot is `grapeDark` rather than ink so it keeps
  // an inherited ink OUTLINE; drawn in ink itself it would be the one shape in the set
  // with no edge, i.e. the one that cannot flip onto a dark plate.
  squid_ink: `
<path d="M12 3.3c3.5 0 6.4 2.3 6.4 5.4 0 1.9-1 3.1-1 4.6 0 1.9 1.8 2.5 1.8 4.1 0 1.4-1.2 2.4-2.7 2.4-1.4 0-2.1-.8-3.3-.8-1.4 0-2 1.2-3.7 1.2-2 0-3.3-1.4-3.3-3.1 0-1.6 1-2.4 1-3.7 0-1.6-1.6-2.6-1.6-4.7 0-3.1 2.9-5.4 6.4-5.4z" fill="${P.grapeDark}"/>
<circle cx="20.6" cy="6.2" r="1.5" fill="${P.grapeDark}"/>
<circle cx="3.5" cy="18.4" r="1.2" fill="${P.grapeDark}"/>`,

  // ── Disposal — drops an enemy beside a different enemy ─────────────────────
  // A sink drain, per the landed `look`. The cross grate is what separates it from every
  // other ring in the set (`cap`, `coin`, `swirl`); the swirl inside is what says the
  // hole GOES somewhere.
  disposal: `
<ellipse cx="12" cy="12" rx="9.3" ry="8.6" fill="${P.steel}"/>
<ellipse cx="12" cy="12" rx="6" ry="5.4" fill="${P.grapeDark}"/>
<path d="M12 6.9c2.9 0 5.2 2.1 5.2 4.6" stroke="${P.grapeHi}" stroke-width="1.8" fill="none"/>
<path d="M6.6 12.5c0-2.2 1.9-4 4.4-4.3" stroke="${P.grapeHi}" stroke-width="1.6" fill="none"/>
<path d="M12 6.6v10.8M6.9 12h10.2" stroke-width="1.7"/>`,

  // ── Blue Cheese — a permanent stink cloud, small damage per second ─────────
  // The one effect that is on screen ALL MATCH, so `look` requires it to read by motion
  // and boundary rather than by chroma. The glyph follows: a low haze with spore dots,
  // in the blue-green the world effect uses, not at accent saturation.
  blue_cheese: `
<path d="M6.9 17.8h10.3a3.9 3.9 0 0 0 .4-7.8 4.8 4.8 0 0 0-8.9-2.3 4 4 0 0 0-1.8 10.1z" fill="${IP.haze}"/>
<circle cx="9.7" cy="13.4" r="1.15" fill="${IP.hazeDark}" stroke="none"/>
<circle cx="13.4" cy="11.3" r="1" fill="${IP.hazeDark}" stroke="none"/>
<circle cx="15.7" cy="14.4" r="0.9" fill="${IP.hazeDark}" stroke="none"/>
<circle cx="8.6" cy="20.6" r="1.1" fill="${IP.haze}"/>
<circle cx="14.4" cy="20.8" r="0.9" fill="${IP.haze}"/>`,

  // ── Shiitake Shield — attackers take back what they deal ───────────────────
  // Three overlapping caps in a fan, per `look`. The ketchup chevron on the centre cap is
  // the REFLECT: three mushrooms alone are an ingredient, not a defence.
  shiitake: `
<path d="M2.9 15.4c0-3 2.2-5.4 5-5.4s5 2.4 5 5.4z" fill="${IP.cap}"/>
<path d="M11.6 14.2c0-3.2 2.4-5.8 5.3-5.8s5.3 2.6 5.3 5.8z" fill="${IP.cap}"/>
<path d="M5.6 12.6c0-3.9 2.9-7 6.4-7s6.4 3.1 6.4 7z" fill="${IP.capHi}"/>
<path d="M5.6 12.6h12.8v1.5a1.6 1.6 0 0 1-1.6 1.6H7.2a1.6 1.6 0 0 1-1.6-1.6z" fill="${P.cream}"/>
<path d="M9.4 20.4 12 17.6l2.6 2.8" stroke="${P.ketchup}" stroke-width="2.2" fill="none"/>`,

  // ── Liquorice Rope — roots an enemy for five seconds ───────────────────────
  // Carried from `items-groundwork`, recoloured to the landed `look`'s "black-red": ink
  // under-stroke with `ketchup` on top, so the outline is still the inherited ink and the
  // rope still flips onto a dark plate. A LOOP plus a tail, because a plain coil is a
  // spring and a plain line is a whip.
  liquorice: `
<ellipse cx="11" cy="8.6" rx="6.4" ry="4.3" fill="none" stroke-width="5"/>
<ellipse cx="11" cy="8.6" rx="6.4" ry="4.3" fill="none" stroke="${P.ketchup}" stroke-width="2.4"/>
<path d="M16.4 11.6c2.4 2.3 2 5.6-1.2 8.2" fill="none" stroke-width="5"/>
<path d="M16.4 11.6c2.4 2.3 2 5.6-1.2 8.2" fill="none" stroke="${P.ketchup}" stroke-width="2.4"/>`,

  // ── Leftovers — your killer dies, you come back ────────────────────────────
  // A fridge with the door ajar and its light spilling out, per `look`. The rarest item
  // in the game and the only one that fires with no press, so the glyph is the MOMENT
  // rather than the object: the wedge of light and the chevron rising in it.
  leftovers: `
<path d="M4.6 2.9h9.9a1.8 1.8 0 0 1 1.8 1.8v14.6a1.8 1.8 0 0 1-1.8 1.8H4.6a1.8 1.8 0 0 1-1.8-1.8V4.7a1.8 1.8 0 0 1 1.8-1.8z" fill="${P.steel}"/>
<path d="M2.8 8.8h13.5" stroke-width="1.6"/>
<path d="M13.1 5.2v2.2M13.1 10.6v2.6" stroke-width="1.6"/>
<path d="M16.3 4.9 21.6 3v18l-5.3-1.9z" fill="${P.mustardHi}"/>
<path d="M17.4 16.2 19.2 14l1.8 2.2" stroke-width="1.9" fill="none"/>`,
};
