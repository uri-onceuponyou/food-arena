/**
 * UI symbols — the abstract half of the icon set.
 *
 * ── Why these are AUTHORED and not rendered ──────────────────────────────────
 * `icons/portraits.ts` takes the other route: it reuses the real 3D character
 * renders, which is strictly better whenever the subject exists in the game world,
 * because a render cannot drift from the thing it depicts. None of the symbols in
 * this file exist in the game world. There is no coin model, no gem model, no chest
 * model, no gear. Rendering them would mean AUTHORING eleven new 3D props purely to
 * photograph them at 24px, which is more work and a worse result than drawing them
 * flat — a 24px icon has no room for perspective, and every shipped brawler draws its
 * currency and container icons flat for exactly that reason.
 *
 * ── The two icons six critics named ─────────────────────────────────────────
 * `coin` and `chest` were called out by name: *"the coin reads as a moon, the chest
 * as a cardboard shipping box."* Both verdicts are about SILHOUETTE, and both are
 * fair criticisms of the emoji that were there:
 *
 *  * A moon and a coin have the same outline: a flat circle. So the coin below is not
 *    a circle. It is an ELLIPSE with a darker disc peeking out beneath it — a struck
 *    coin lying at a tilt, which no crescent-lit sphere ever looks like.
 *  * A shipping box and a treasure chest have the same outline too, and the emoji is
 *    literally a cardboard carton. The chest below has a DOMED lid, a gold band and a
 *    lock plate, so it is unmistakable at any size and it separates cleanly from the
 *    four purchasable BOXES, which keep the square silhouette on purpose (they are
 *    boxes; the free one is a chest — the model already names them that way).
 */

import { P, starPath } from './svg';

/** The four purchasable containers share one silhouette and differ by colourway plus
 *  a lid emblem, so they read as a family and as a ladder — which is what they are.
 *  Emoji made them four unrelated objects (a burger, a pineapple, a gift, a flame).
 *
 *  ── THE RIBBON CAME OFF, AND THAT IS THE WHOLE CHANGE ──────────────────────
 *  The third colour used to be a FULL-HEIGHT VERTICAL BAND — `M10.2 5.6h3.6v14.9h-3.6z`
 *  — running from the top of the lid to the bottom of the body. Kept here because the
 *  rule it encoded has been reversed rather than deleted.
 *
 *  Measured on the first both-families-on-one-plate round: `boxBurger`, `boxRed` and
 *  `boxFire` were each named **"a wrapped gift" 3 of 3**. Box-to-box confusion is by
 *  design and is exempted in `icon_score.mjs`; box-to-GIFT is not, because a gift is a
 *  different object the set also draws (`gift`, below) and because the four boxes are
 *  priced differently from each other in `tuning.ts`.
 *
 *  The cause is construction, not colour — a gold box and a dark purple box cannot both
 *  read as a red present because of hue. A lidded body with a contrasting band CROSSING
 *  THE LID from top to bottom is the universal wrapped-present construction, and at
 *  20 px it is the only thing on the tile with enough mass to carry a read. So the band
 *  becomes a CLASP straddling the lid seam, which is what `chest` already does two lines
 *  below and which no present has. Same three colours, same silhouette, same family; the
 *  wrapping is what goes.
 *
 *  It is deliberately WIDER than the ribbon it replaces (4.4 vs 3.6): the band was
 *  carrying the third colour's entire presence and a thin latch would have spent the
 *  colourway that separates the four boxes from each other.
 *
 *  ── MEASURED, paired on identical tile positions, 3 judges each side ────────
 *
 *      icon            ribbon (before)                 clasp (after)
 *      boxRed          0/3   "a wrapped gift" x3       **3/3**
 *      boxPineapple    1/3   "a wrapped gift" x2       **3/3**
 *      boxFire         0/3   gift x2, chest x1         0/3, "a purple loot box" x3
 *      boxBurger       1/3   "red loot box w/ bow" x2  1/3, "a wrapped gift" x2
 *      ------------------------------------------------------------------------
 *      a box named "a wrapped gift"   **7 of 12  ->  2 of 12**
 *      a box named correctly          **2 of 12  ->  7 of 12**
 *
 *  `boxFire`'s remaining miss is box-to-box, which is the exempt case — it stopped being
 *  a present and became the wrong rung of its own ladder. **`boxBurger` REGRESSED into
 *  the collision the other three left**, and the likely reason is stated rather than
 *  fixed: its clasp is `P.ketchup` on a `P.gold` body, so a small red mass centred on the
 *  lid of a gold box is a bow. That is one colour swap away from a test, and it is not
 *  taken here because the instrument cannot currently resolve it — see below.
 *
 *  ⚠️ **THE AGGREGATE IS NOT CLAIMED, AND THE REASON IS IN THIS RUN.** Judge totals were
 *  48/46/61 before and 63/49/46 after — a mean move of +1.0 inside a judge-to-judge
 *  spread of ~15 of 65, far wider than the ~4.0 `docs/DECISIONS-FOR-URI.md` §32 recorded.
 *  The built-in control for that is `chest`, whose art did NOT change and which moved
 *  1/3 -> 3/3 across the same two rounds. **Read the box-to-gift count, which is a paired
 *  directional count on identical tiles; do not read the totals.** */
function box(front: string, lid: string, band: string, emblem = ''): string {
  return `
<path d="M3.4 9.4h17.2v9.4a1.7 1.7 0 0 1-1.7 1.7H5.1a1.7 1.7 0 0 1-1.7-1.7z" fill="${front}"/>
<path d="M3.4 9.4 6.6 5.6h10.8l3.2 3.8z" fill="${lid}"/>
<path d="M9.8 7.0h4.4v5.6H9.8z" fill="${band}" stroke-width="1.3"/>
${emblem}`;
}

const FLAME_EMBLEM = `<path d="M12 0.6c2.6 2.2 3.7 3.9 3.2 5.5-.9-.8-1.6-1.1-2.3-.9.7 1.9.3 3.1-.9 4-1.2-.9-1.6-2.1-.9-4-.7-.2-1.4.1-2.3.9-.5-1.6.6-3.3 3.2-5.5z" fill="${P.flame}" stroke-width="1.3"/>`;
const LEAF_EMBLEM = `<path d="M12 0.4c2.4.8 3.6 2.4 3.6 4.6-2.4-.7-3.6-2.3-3.6-4.6zM12 0.4c-2.4.8-3.6 2.4-3.6 4.6C10.8 4.3 12 2.7 12 .4z" fill="${P.lettuce}" stroke-width="1.3"/>`;
const BOW_EMBLEM = `<path d="M12 5.6C9.2 1.6 4.8 2.8 6.2 5.6M12 5.6C14.8 1.6 19.2 2.8 17.8 5.6" fill="${P.mustard}" stroke-width="1.4"/>`;
/* A burger stamped on the front panel. The box is NAMED after it, and two critics
   objected that the mark said nothing about the name. */
const BURGER_EMBLEM = `<path d="M4.9 13.4a2.6 2.6 0 0 1 5.2 0z" fill="#B4622A" stroke-width="1.2"/>
<path d="M4.7 13.4h5.6v1.5H4.7z" fill="${P.lettuce}" stroke-width="1.2"/>
<path d="M4.9 15h5.2a2.2 2.2 0 0 1-5.2 0z" fill="#B4622A" stroke-width="1.2"/>`;

/* Gold, not grey. The gear ships in the same 34px chip row as the coin and the
   trophy, and a desaturated line-art gear beside two chunky gold objects reads as
   two icon sets glued together — a blind critic named exactly that. */
const gearTeeth = Array.from({ length: 8 }, (_, i) =>
  `<rect x="10.3" y="0.9" width="3.4" height="5.4" rx="1.2" fill="${P.gold}" transform="rotate(${i * 45} 12 12)"/>`).join('');

export const UI_ICONS: Record<string, string> = {
  // ── Currency ───────────────────────────────────────────────────────────────
  /* Round 1 drew this face-on with a same-tone bevel and it read as concentric rings
     on the gold trophy-road medallion — a variant of the exact "reads as a moon"
     complaint it was fixed for. Two changes: the disc is an ELLIPSE, so it is a struck
     coin lying at a tilt rather than any flat circle, and the bevel now steps through
     three clearly separated tones so the face reads as raised metal. */
  /* ⚠️ THE CREAM INSET IS NOW A STAR, AND THAT IS THE THIRD TIME THIS FACE HAS MOVED.
     The first CROSS-FAMILY blind round — the one `DECISIONS-FOR-URI.md` §10 recorded as
     never having been run — put all 65 icons on one plate, and the currency lost:

       coin  0/3, and all three judges answered "A POT OF HONEY".
       honey 2/3, and the miss answered "a gold coin".

     That is a MUTUAL SWAP between the game's primary currency and a weapon glyph, at
     20px, and neither family measured alone could ever have found it — a judge shown
     only food icons cannot answer "coin", and a judge shown only UI icons cannot answer
     "honey". It is a worse defect than any single unreadable glyph, because a coin and a
     Sticky Trail carry opposite meanings on the same screen.

     Hue cannot fix it: the currency must be gold and honey must look like honey. What
     collided was the CONSTRUCTION — both were a gold rounded mass with a pale horizontal
     band across the middle (`honey`'s mustardHi belly band, this coin's cream ellipse).
     A five-pointed star is the same amount of ink in a shape no vessel can have, and it
     says "currency" rather than "concentric", which is also the fault the round-1 bevel
     was rewritten for. A COIN STACK was drawn and rendered first and was WORSE — three
     stacked ellipses at 20px are a stack of pancakes, i.e. nearer to `honey`'s banded jar
     than the single coin was. Rejected before any judge saw it. */
  coin: `
<ellipse cx="12" cy="14.2" rx="9" ry="7" fill="#7F4E00"/>
<ellipse cx="12" cy="11.2" rx="9" ry="7" fill="#D98200"/>
<path d="${starPath(5, 5.6, 2.4, 12, 11.4)}" fill="#FFEFC0" stroke-width="1.4"/>
<path d="M8.2 8.6a7 5.4 0 0 1 3.4-2.3" stroke="${P.white}" stroke-width="1.7"/>`,

  gem: `
<path d="M6.6 3.9h10.8l3.6 5.3L12 20.4 3 9.2z" fill="${P.water}"/>
<path d="M6.6 3.9 8.9 9.2h6.2l2.3-5.3z" fill="${P.ice}" stroke-width="1.3"/>
<path d="M3 9.2h18" stroke-width="1.3"/>
<path d="M8.9 9.2 12 20.4l3.1-11.2" stroke-width="1.3"/>`,

  // ── Progression ────────────────────────────────────────────────────────────
  trophy: `
<path d="M7.1 3.3h9.8v5a4.9 4.9 0 0 1-9.8 0z" fill="${P.gold}"/>
<path d="M7.1 4.9H4.3a3.3 3.3 0 0 0 3.3 4.3" stroke-width="1.8"/>
<path d="M16.9 4.9h2.8a3.3 3.3 0 0 1-3.3 4.3" stroke-width="1.8"/>
<path d="M12 13.1v3.3" stroke-width="2.2"/>
<path d="M7.9 20.7h8.2l-.8-2.6a1.2 1.2 0 0 0-1.2-.9h-4.2a1.2 1.2 0 0 0-1.2.9z" fill="${P.mustard}"/>
<path d="M9.6 5.1a3.4 3.4 0 0 0 .5 4.5" stroke="${P.cream}" stroke-width="1.4"/>`,

  star: `<path d="${starPath(5, 9.4, 4.1)}" fill="${P.mustard}"/>
<path d="M12 4.6 10.6 9" stroke="${P.mustardHi}" stroke-width="1.4"/>`,

  sparkle: `
<path d="M10.4 1.8c1.5 5.4 2.9 6.8 8.3 8.3-5.4 1.5-6.8 2.9-8.3 8.3-1.5-5.4-2.9-6.8-8.3-8.3 5.4-1.5 6.7-2.9 8.3-8.3z" fill="${P.mustard}"/>
<path d="M18.6 14.4c.7 2.6 1.4 3.3 4 4-2.6.7-3.3 1.4-4 4-.7-2.6-1.4-3.3-4-4 2.6-.7 3.3-1.4 4-4z" fill="${P.mustardHi}" stroke-width="1.5"/>`,

  flag: `
<path d="M5.6 21.2V3.2" stroke-width="2.2"/>
<path d="M5.6 4h13.6v9.2H5.6z" fill="${P.cream}"/>
<path d="M5.6 4h3.4v3.06H5.6zM12.4 4h3.4v3.06h-3.4zM9 7.06h3.4v3.07H9zM15.8 7.06h3.4v3.07h-3.4zM5.6 10.13h3.4v3.07H5.6zM12.4 10.13h3.4v3.07h-3.4z" fill="${P.ink}" stroke="none"/>`,

  pin: `
<path d="M12 21.4s6.7-6.5 6.7-11.1a6.7 6.7 0 1 0-13.4 0c0 4.6 6.7 11.1 6.7 11.1z" fill="${P.ketchup}"/>
<circle cx="12" cy="10.2" r="2.6" fill="${P.cream}"/>`,

  // ── Containers ─────────────────────────────────────────────────────────────
  chest: `
<path d="M3.1 11.6h17.8v6.7a1.7 1.7 0 0 1-1.7 1.7H4.8a1.7 1.7 0 0 1-1.7-1.7z" fill="${P.wood}"/>
<path d="M3.1 11.6a8.9 8.9 0 0 1 17.8 0z" fill="${P.woodHi}"/>
<path d="M2.6 10.2h18.8v3H2.6z" fill="${P.gold}" stroke-width="1.4"/>
<path d="M10.3 9.8h3.4v5.4h-3.4z" fill="${P.mustard}" stroke-width="1.4"/>
<circle cx="12" cy="12.9" r="0.85" fill="${P.wood}" stroke="none"/>`,

  /** ── boxBurger's COLOURWAY, and why it alone kept reading as a present ──────
   *
   *  The clasp above fixed three boxes of four and this one REGRESSED; the block above
   *  named the likely cause (`P.ketchup` on `P.gold` is a red bow on a gold lid) and
   *  said it was "one colour swap away from a test". Re-measured at the DELIVERED size
   *  — 14.4 CSS px on white in the drop-rates sheet, which is where the four boxes
   *  actually ship smallest, not the 20 px the plate harness assumed — it is still
   *  **0/3, "a wrapped gift" x2 + "a treasure chest" x1**, while `boxRed` and
   *  `boxPineapple` are 3/3 and `gift` itself is 3/3.
   *
   *  ⚠️ THE CAUSE IS NOT THE HUE. `boxRed` is red-and-gold, `gift` is red-and-gold, and
   *  the two separate perfectly. What separates them is that a box has a LID and a
   *  present has a RIBBON, so the reader has to be able to see the lid seam. Contrast
   *  ratios, front vs lid, across the family:
   *
   *      boxPineapple  1.53      boxRed  1.40      boxFire  1.64      boxBurger  1.36
   *
   *  boxBurger is the only one below 1.40: `P.gold` and `P.mustard` are a third of a
   *  stop apart, so at 14 px it has no visible lid at all — it is one flat gold mass
   *  with a coloured block on it, which is a present.
   *
   *  And there is a second inversion, which is the sharper of the two. In all three
   *  boxes that pass, the clasp contrasts MORE with the front than with the lid, so it
   *  reads as an object sitting ON the box:
   *
   *      box            clasp/front   clasp/lid
   *      boxPineapple      3.77          2.45
   *      boxRed            3.24          2.31
   *      boxFire           3.65          2.22
   *      boxBurger         2.39          3.24   <- inverted
   *
   *  boxBurger's clasp is the only one that is LID-dominant, and its clasp/lid ratio of
   *  **3.24 is exactly `gift`'s ribbon-against-body ratio, to two decimal places**. A
   *  dark block laid across a light lid at a present's own contrast is a present, and no
   *  amount of clasp geometry undoes that.
   *
   *  ── THE FIX THOSE RATIOS IMPLY WAS BUILT, MEASURED AND REVERTED ────────────
   *  WAS: `box(P.goldDark, P.gold, P.cream, BURGER_EMBLEM)` — body darkened so it could
   *  carry a light clasp like its three siblings. On paper it lands inside the passing
   *  family's envelope: front/lid **1.82**, clasp/front **3.45**, clasp/lid **1.90**,
   *  front-dominant. Kept here because the numbers are right and the *outcome* was not.
   *
   *  Measured on the same delivered-size plate, same seed, identical tile positions,
   *  three fresh judges each side:
   *
   *      answer given to boxBurger      before            after
   *      "a wrapped gift"               2/3               **0/3**
   *      "a treasure chest"             1/3               **3/3**
   *      correct                        0/3               0/3
   *
   *  The gift read WAS killed, exactly as the ratios predicted. It simply moved onto
   *  `chest`, which is the other container the set draws, is not exempt, and is the FREE
   *  rung against boxBurger's 900 coins — so the new collision is no cheaper than the
   *  old one. `chest` is a brown body under a gold band; `P.goldDark` is brown enough at
   *  14 px to be one.
   *
   *  ⚠️ AND THE CONTROL MOVED, WHICH IS THE REAL REASON THIS IS A REVERT AND NOT A
   *  REGRESSION. `boxRed`'s art did not change by one byte and it went **3/3 -> 0/3**
   *  across the same two rounds ("a treasure chest" x2, "a wrapped gift" x1), and
   *  box-named-"a wrapped gift" across all four boxes sat at **2 of 12 before and 2 of
   *  12 after**. A three-judge panel cannot resolve a single icon in this family: the
   *  panel-to-panel swing on FIXED art is the full 0/3-to-3/3 range, which is wider than
   *  any effect being looked for. So the honest statement is not "this made boxBurger
   *  worse" — it is **"this round could not tell, and the aggregate did not move."**
   *  CLAUDE.md #10: state the resolution floor before acting on a change inside it.
   *
   *  What that costs to settle is a PAIRED plate — the before-art and after-art tiles on
   *  ONE plate seen by ONE judge in ONE round, so the panel's chest-happiness cancels the
   *  way identical seeds cancel in a matchup delta. That is the next move here, and it is
   *  not a redraw. */
  boxBurger: box(P.gold, P.mustard, P.ketchup, BURGER_EMBLEM),
  boxPineapple: box(P.grape, P.grapeHi, P.mustard, LEAF_EMBLEM),
  boxRed: box(P.ketchup, '#E9536A', P.mustard, BOW_EMBLEM),
  boxFire: box(P.grapeDark, P.grape, P.flame, FLAME_EMBLEM),

  gift: `
<path d="M4 10.4h16v8.2a1.6 1.6 0 0 1-1.6 1.6H5.6A1.6 1.6 0 0 1 4 18.6z" fill="${P.ketchup}"/>
<path d="M2.6 6.4h18.8v4H2.6z" fill="#E9536A"/>
<path d="M10.2 6.4h3.6v13.8h-3.6z" fill="${P.mustard}" stroke-width="1.3"/>
<path d="M12 6.2c-2.6-3.4-6.2-2.4-5 .2M12 6.2c2.6-3.4 6.2-2.4 5 .2" fill="${P.mustard}" stroke-width="1.4"/>`,

  // ── Chrome ─────────────────────────────────────────────────────────────────
  gear: `${gearTeeth}
<circle cx="12" cy="12" r="7.4" fill="${P.gold}"/>
<circle cx="12" cy="12" r="3.3" fill="${P.cream}"/>`,

  lock: `
<path d="M7.5 10.4V7.9a4.5 4.5 0 0 1 9 0v2.5" stroke-width="1.9"/>
<path d="M4.4 10.2h15.2a1.9 1.9 0 0 1 1.9 1.9v6.6a1.9 1.9 0 0 1-1.9 1.9H4.4a1.9 1.9 0 0 1-1.9-1.9v-6.6a1.9 1.9 0 0 1 1.9-1.9z" fill="${P.gold}"/>
<circle cx="12" cy="14.4" r="1.7" fill="${P.ink}" stroke="none"/>
<path d="M12 15.4v2.6" stroke-width="1.9"/>`,

  /* These five are monochrome chrome, so their FILL follows the same `--fa-ic-ink`
     variable the outline does. Without that, inverting a dark container flips the
     outline to cream and leaves an ink-filled triangle invisible inside it — which is
     exactly how the pause chip sat on its own dark plate in round 1. */
  play: `<path d="M7.6 4.2 19.4 12 7.6 19.8z" fill="var(--fa-ic-ink,#1a1224)" stroke-width="1.6"/>`,
  pause: `
<path d="M6.4 4.4h4.2v15.2H6.4z" fill="var(--fa-ic-ink,#1a1224)" stroke-width="1.6"/>
<path d="M13.4 4.4h4.2v15.2h-4.2z" fill="var(--fa-ic-ink,#1a1224)" stroke-width="1.6"/>`,
  back: `<path d="M15.2 4.4 7.4 12l7.8 7.6" stroke-width="2.8"/>`,
  close: `<path d="M6.2 6.2 17.8 17.8M17.8 6.2 6.2 17.8" stroke-width="2.8"/>`,
  check: `<path d="M4.6 12.4 9.4 17.4 19.4 6.8" stroke-width="3"/>`,

  home: `
<path d="M3 11.6 12 3.4l9 8.2" stroke-width="2.1"/>
<path d="M5.4 10.6h13.2v9.8H5.4z" fill="${P.gold}"/>
<path d="M9.6 14h4.8v6.4H9.6z" fill="${P.wood}"/>`,

  swap: `
<path d="M4.6 10.2a7.4 7.4 0 0 1 12.6-3.6" stroke-width="2.2"/>
<path d="M17.6 2.9v4.2h-4.2" stroke-width="2.2"/>
<path d="M19.4 13.8a7.4 7.4 0 0 1-12.6 3.6" stroke-width="2.2"/>
<path d="M6.4 21.1v-4.2h4.2" stroke-width="2.2"/>`,

  mute: `
<path d="M3.4 9.2h3.6L12 4.8v14.4L7 14.8H3.4z" fill="${P.cream}"/>
<path d="M15.4 9.4 20.6 14.6M20.6 9.4 15.4 14.6" stroke="${P.tomato}" stroke-width="2.4"/>`,
  sound: `
<path d="M3.4 9.2h3.6L12 4.8v14.4L7 14.8H3.4z" fill="${P.cream}"/>
<path d="M15.2 9a4.2 4.2 0 0 1 0 6" stroke-width="1.9"/>
<path d="M18 6.4a8 8 0 0 1 0 11.2" stroke-width="1.9"/>`,

  cone: `
<path d="M12 3 18.8 18.6H5.2z" fill="${P.gold}"/>
<path d="M9.3 11.4h5.4M8 15h8" stroke="${P.cream}" stroke-width="2.1"/>
<path d="M3.2 18.4h17.6a1.2 1.2 0 0 1 1.2 1.2v.2a1.2 1.2 0 0 1-1.2 1.2H3.2A1.2 1.2 0 0 1 2 19.8v-.2a1.2 1.2 0 0 1 1.2-1.2z" fill="${P.ketchup}"/>`,

  chefhat: `
<path d="M6.6 12.4a3.9 3.9 0 1 1 1.6-7.4 4.3 4.3 0 0 1 7.6 0 3.9 3.9 0 1 1 1.6 7.4z" fill="${P.cream}"/>
<path d="M6.6 12.2h10.8v6a1.4 1.4 0 0 1-1.4 1.4H8a1.4 1.4 0 0 1-1.4-1.4z" fill="${P.cream}"/>
<path d="M6.6 15.4h10.8" stroke-width="1.4"/>`,

  /* Head and shoulders under a chef's toque — bigger masses than round 1, because at
     13px in the name chip the previous version read as thin line art. */
  avatar: `
<path d="M3.4 21.2a8.6 8.6 0 0 1 17.2 0z" fill="${P.gold}"/>
<circle cx="12" cy="11.6" r="5" fill="${P.mustard}"/>
<path d="M7.2 8.4a2.9 2.9 0 1 1 1.6-5.3 3.6 3.6 0 0 1 6.4 0 2.9 2.9 0 1 1 1.6 5.3z" fill="${P.cream}"/>
<path d="M7.2 8.2h9.6v2.2H7.2z" fill="${P.cream}"/>`,

  // ── Stat / ability annotations ─────────────────────────────────────────────
  /* ONE sword, not two crossed.
     This ships at ~11px in the ability fact chips, and a crossed pair merged there
     into a small ink X that a blind legibility test could not tell apart from the
     close button. A single fat diagonal blade keeps a readable silhouette all the way
     down, and the hilt gives it an unambiguous top and bottom. */
  damage: `
<path d="M20.6 1.6 21.4 6.6 9.8 18.2 6.4 14.8z" fill="${P.steel}"/>
<path d="M20.6 1.6 15.6 2.4 4 14l3.4 3.4z" fill="#B7AFC7" stroke="none"/>
<path d="M20.6 1.6 6.4 14.8" stroke-width="1.4"/>
<path d="M3.6 15.2 8.8 20.4" stroke="${P.ketchup}" stroke-width="3.4"/>
<path d="M1.8 20.2 5.4 16.6" stroke-width="2.4"/>`,

  health: `<path d="M12 20.9 4.3 13.4a4.95 4.95 0 0 1 7.7-6.2 4.95 4.95 0 0 1 7.7 6.2z" fill="${P.ketchup}"/>
<path d="M7.2 10.4a2.6 2.6 0 0 1 2-1.6" stroke="${P.cream}" stroke-width="1.5"/>`,

  speed: `<path d="M13.8 2.2 5.6 13.4h4.8l-1.6 8.4 8.8-11.6h-5z" fill="${P.mustard}"/>`,

  range: `
<path d="M3.4 12h17.2" stroke-width="2.3"/>
<path d="M7.2 8.1 3.2 12l4 3.9" stroke-width="2.3"/>
<path d="M16.8 8.1 20.8 12l-4 3.9" stroke-width="2.3"/>`,

  /* The dial is deliberately NOT cream.
     Icons on the project's ink pills flip their outline to cream (see `--fa-ic-ink`),
     and a cream-filled dial under a cream outline collapses into one solid blob with
     no hands. A mid-tone dial keeps its internal structure whichever way the outline
     goes. */
  timer: `
<circle cx="12" cy="13.6" r="7.7" fill="#C9B8DE"/>
<path d="M9.5 2.4h5" stroke-width="2.1"/>
<path d="M12 2.4v3.5" stroke-width="2.1"/>
<path d="M12 9.4v4.3h3.3" stroke-width="1.9"/>`,

  heal: `
<path d="M12 20.9 4.3 13.4a4.95 4.95 0 0 1 7.7-6.2 4.95 4.95 0 0 1 7.7 6.2z" fill="${P.lettuce}"/>
<path d="M12 9.6v5.6M9.2 12.4h5.6" stroke="${P.cream}" stroke-width="2.1"/>`,

  /* ONE five-pointed star, plus a satellite.
     Deliberately five points, not four: `sparkle` is the four-point mark, and two
     critics found the two glyphs interchangeable — one of them meaning "stun" on the
     roster and "rewards to claim" on the lobby, which is a semantic collision, not a
     drawing problem. */
  stun: `<path d="${starPath(5, 8.6, 3.7, 10.2, 10.6)}" fill="${P.mustard}"/>
<path d="${starPath(5, 4.2, 1.8, 19.2, 18)}" fill="${P.mustardHi}" stroke-width="1.4"/>`,

  /* A bare spiral shell.
     The snail this replaces had legs and antennae that closed up at 11px into a brown
     blob, and a blind critic read that blob as the SPEED bolt sitting two chips away —
     the worst possible confusion for a slow debuff. A spiral is one stroke, survives
     any size, and cannot be mistaken for a bolt. */
  slow: `
<circle cx="12" cy="12" r="9.1" fill="${P.gold}"/>
<path d="M12 12a2.9 2.9 0 1 0 2.9 2.9c0-3.4-3.2-5.3-6.3-4.1-3.4 1.3-4.6 5.3-2.6 8.2" stroke-width="2.1"/>`,

  /* Win count. Exists purely so the trophy stops meaning two different quantities. */
  medal: `
<path d="M8.4 2.2 11 8.6H7L4.4 2.2z" fill="${P.ketchup}"/>
<path d="M15.6 2.2 13 8.6h4l2.6-6.4z" fill="${P.water}"/>
<circle cx="12" cy="15.2" r="6.6" fill="${P.gold}"/>
<circle cx="12" cy="15.2" r="3.4" fill="${P.mustard}" stroke-width="1.3"/>`,

  // ── Misc ───────────────────────────────────────────────────────────────────
  party: `
<path d="M3.4 20.9 9 8.2l6.8 6.8z" fill="${P.ketchup}"/>
<path d="M9 8.2 15.8 15" stroke-width="1.4"/>
<circle cx="18.7" cy="5.5" r="1.6" fill="${P.mustard}"/>
<circle cx="14.2" cy="3.4" r="1.3" fill="${P.lettuce}"/>
<circle cx="20.8" cy="10.4" r="1.3" fill="${P.water}"/>
<path d="M16.2 8.8 18.6 6.4" stroke-width="1.4"/>`,
};
