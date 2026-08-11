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
 *  * 🔴 REVERSED, AND THE ORIGINAL IS KEPT BECAUSE IT IS THE INSTRUCTIVE HALF. It read:
 *    *"A moon and a coin have the same outline: a flat circle. So the coin below is not
 *    a circle. It is an ELLIPSE with a darker disc peeking out beneath it — a struck
 *    coin lying at a tilt, which no crescent-lit sphere ever looks like."*
 *    The reasoning is sound and the premise was never checked: **there is no moon in
 *    this icon set, and there IS a bottle cap.** An ellipse with a same-shape darker
 *    ellipse under it is `cap`'s construction, and at the currency's smallest delivered
 *    size three blind judges named the shipped coin "a bottle cap" 3 of 3. The tilt is
 *    gone; see `coin` below for the paired measurement. **A defect avoided by argument
 *    is not a defect measured.**
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
  /* 🔴 THE TILT IS GONE, AND WITH IT THE ARGUMENT AT THE TOP OF THIS FILE.
     WAS: `<ellipse cy="14.2" fill="#7F4E00"/>` under `<ellipse cy="11.2" fill="#D98200"/>`
     with an ink-stroked cream star and a white 1.7-unit arc. Kept in words, because the
     rule it encoded has been REVERSED rather than deleted. This file's header says:

       *"A moon and a coin have the same outline: a flat circle. So the coin below is not
       a circle. It is an ELLIPSE with a darker disc peeking out beneath it."*

     That was reasoned from a MOON. It was never measured, and what it actually built is
     `cap`'s construction exactly — an ellipse with a same-shape darker ellipse offset
     downward — on the game's PRIMARY CURRENCY, at a delivered size nobody had measured.
     The moon it was avoiding is not in the icon set. The bottle cap is.

     ── MEASURED, PAIRED: one plate, one judge, both drawings, twin floor 0 of 9 ──
     11.03 px on rgb(253,233,212), the smallest of coin's 21 delivered sites:

         protocol            shipped ellipse    THIS       Δ (exact, same judge)
         one look, native    0/3  "a bottle cap" x3   3/3   **+3 of 3**
         judge may magnify   3/3                      3/3    +0 of 3

     Two things that only a paired plate could separate, and the second is the surprise:

      1. THE TILT IS THE DEFECT, NOT THE INK. A third arm kept the tilted ellipses and
         removed only the interior strokes: 2/3, still "a bottle cap" x1. Removing ink
         recovers most of it; removing the tilt recovers all of it.
      2. THE ZOOMED ARM CANNOT SEE THIS AT ALL — both drawings are 3/3 there. A blind
         judge allowed to magnify wrote of the shipped tile: *"the crimped-looking bottom
         band is genuinely readable as a bottle cap."* It is an ACUITY defect, so a round
         judged at magnification would have reported the currency as fine. `a77ff30`.

     So: a full disc, a goldDark rim, and a cream star with NO interior stroke. The star
     survives from the version above — it is the one part that measured well. Every
     interior outline is gone on purpose: at 11 px, 1.7 units of ink is 0.78 px drawn
     around each of three stacked shapes, and the gold never becomes a mass.
     ⚠️ Do not re-tilt this. It has been drawn, delivered and judged both ways. */
  coin: `
<circle cx="12" cy="12" r="9.5" fill="${P.goldDark}"/>
<circle cx="12" cy="12" r="7.6" fill="${P.gold}" stroke="none"/>
<path d="${starPath(5, 5.8, 2.5, 12, 12)}" fill="${P.cream}" stroke="none"/>`,

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
  /** UNCHANGED. Two arms were built, measured and NOT shipped, and between them they
   *  rule out both variables that live in this file — which makes the remaining one an
   *  out-of-set finding rather than a drawing problem.
   *
   *  This is the smallest glyph in the set: **11.03 px**, and the ONLY glyph delivered on
   *  the `tr-inv-empty` plate, rgb(228,91,51). Two things about it are arithmetic:
   *   * INK BUDGET — five separately ink-stroked shapes inside 8.6 x 8.0 delivered units.
   *     One viewBox unit is 0.46 px here, so the default 1.7-unit stroke is 0.78 px, drawn
   *     round five outlines, plus a 0.85-unit keyhole which is **0.39 px** and cannot
   *     resolve at all. That is `coin`'s disease, and `coin`'s interior-strokes-only arm
   *     recovered 2 of 3 on its own.
   *   * VALUE AGAINST THE PLATE — WCAG contrast of every fill this glyph uses, against
   *     its own plate: `P.wood` #8B4A22 **1.88:1**, `P.woodHi` #B4622A **1.24:1**,
   *     `P.gold` #F4A300 **1.73:1**, and the ink outline **5.05:1**. Not one fill clears
   *     2:1. The glyph is its OUTLINE and nothing else, which is the worst possible
   *     arrangement for a shape whose ink budget is already spent five times over.
   *
   *  Paired, 73 tiles, 3 judges per protocol, twins declared to bracket:
   *      arm                                          native        magnified
   *      A  shipped                                   0/3           3/3
   *      B  band + clasp lose their strokes, keyhole
   *         deleted; silhouette outlines kept         0/3  Δ +0     3/3  Δ +0
   *      C  B, plus body #8B4A22 -> #5A2E17 and dome
   *         #B4622A -> #8B4A22 (1.88:1 -> 3.18:1)     0/3  Δ +0     **1/3  Δ -2**
   *  ⚠️ C is a VALUE move and not a desaturation (61%->59% HSL saturation, 34%->22%
   *  lightness); desaturating has been falsified four times here and this was not that.
   *  It still lost 2 of 3 magnified — the darker body reads as a different object once you
   *  can see it — so the plate-contrast lever is spent as well as the ink one.
   *
   *  🔴 WHAT THE WRONG ANSWERS SAY IS THE FINDING, AND IT IS THE SAME FOR ALL THREE ARMS.
   *  Every native miss across all three was another CONTAINER: A -> boxFire x2 +
   *  boxBurger x1, B -> boxRed x2 + boxBurger x1, C -> boxFire x1 + boxRed x1 + rice x1.
   *  At 11 px the DOMED LID does not survive, so this is a rectangle with a horizontal
   *  band across it, which is exactly what `box()` draws four times. Nothing that stays
   *  inside a 24-unit box outline can separate them at 11 px.
   *
   *  🚨 AND IT IS NOW THE SECOND GLYPH WITH THIS SIGNATURE: **0/3 native on every arm ever
   *  drawn, 3/3 magnified**, which is what `boxBurger` has been recording for five rounds.
   *  Two glyphs failing identically at 11.0-11.8 px while passing at magnification is a
   *  DELIVERED SIZE result, not a drawing one. The third variable is the PLATE — the site
   *  itself — and `tr-inv-empty` lives in `src/ui/screens/`, outside this file set.
   *  → Reported, not attempted: this glyph needs more delivered pixels or a plate that is
   *    not saturated orange. Do not spend a fourth drawing variable on it from here. */
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
   *  not a redraw.
   *
   *  ── THE PAIRED PLATE WAS BUILT. COLOUR IS NOT THE LEVER, AND NEITHER IS THE LID. ──
   *  `a77ff30` ran the colourway question above: shipped 1/3, the goldDark candidate 1/3,
   *  clasp-only 1/3, **Δ = 0 of 3, twin floor clean**. Every judge gave all three the same
   *  answer. So the ratios in this comment are correct arithmetic about the wrong variable.
   *
   *  This pass then tested the GEOMETRY the ratios implied — an OVERHANGING FLAT LID,
   *  2.6 units wider than the body on each side, replacing the trapezoid, with the clasp
   *  straddling the seam evenly and the colours held fixed. It puts the lid in the
   *  SILHOUETTE, which is the channel that survives downscaling. Measured paired at the
   *  delivered 11.83 px, twin floor 0 of 9:
   *
   *      protocol            shipped   overhanging lid   Δ
   *      judge may magnify   1/3       1/3               +0 of 3   ("a treasure chest" x2 both)
   *      one look, native    0/3       0/3               +0 of 3
   *
   *  NOT SHIPPED. Three variables — front/lid ratio, clasp dominance, lid silhouette —
   *  have now each moved with no effect, so the next pass should not spend a fourth on
   *  the box's construction.
   *
   *  ⚠️ WHAT THE ZOOMED JUDGES ACTUALLY SAID IS THE LEAD, and it is about the EMBLEM:
   *      *"Read as a treasure chest rather than a loot box with a burger on it, because
   *      unlike [the other three] nothing sits ON TOP of the box."*
   *  `BURGER_EMBLEM` is stamped on the FRONT PANEL. `FLAME_EMBLEM`, `LEAF_EMBLEM` and
   *  `BOW_EMBLEM` all sit ABOVE THE LID, breaking the box's outline — and those three
   *  boxes are the ones that pass. That is a silhouette difference and it is the one
   *  structural asymmetry left in the family.
   *
   *  🔴 IT WAS TESTED, AND IT IS ALSO NOT THE LEVER. Shipped geometry, shipped colours,
   *  the burger moved above the lid so it breaks the outline like its three siblings.
   *  Paired, twin floor 0 of 9: **3/3 -> 3/3 magnified, 0/3 -> 0/3 native, Δ +0 at both.**
   *  It moved the native wrong answer from meat/cheese onto "a pot of honey" x2.
   *  ⚠️ THE CAUTION IS ABOUT THE EVIDENCE, NOT THE BOX. Two zoomed judges independently
   *  volunteered the "nothing sits on top" explanation, and it was a correct description
   *  of what they saw and a WRONG prediction of what would change it. **A judge's stated
   *  reason is an observation, not a lever.** Four variables have now each moved with no
   *  effect (colourway ×3, front/lid ratio, clasp dominance, lid silhouette, emblem
   *  placement). ⚠️ And `boxBurger` scored 1/3 magnified in one round and 3/3 in the
   *  next on UNCHANGED art, so its magnified number carries no information either.
   *  Nothing further should be spent here until there is a measurement that can resolve
   *  it — the native arm is 0/3 across every arm ever drawn, which is a legibility floor
   *  at 11.83 px rather than a drawing defect. */
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
  /* 🔴 …AND THE HANDS WERE NEVER GIVEN A COLOUR AT ALL, SO THEY FLIPPED WITH IT.
     WAS: `<path d="M12 9.4v4.3h3.3" stroke-width="1.9"/>`. Kept in words, because the
     comment above got the reasoning right and then guarded the wrong element. A path
     with no `stroke` attribute inherits `stroke:var(--fa-ic-ink)` from `index.ts`'s
     `OPEN` — the OUTLINE colour — which at this glyph's one delivered site is `#FFF3DE`.
     Cream on the `#C9B8DE` dial is **1.68:1 at 1.09 px**. The clock had no hands, and
     what was left is a pale round mass with a small thing on top: two blind native
     panels named it "an onion" x2 + "a lollipop", then "a bottle cap" x2 + "a purple
     loot box". `CLAUDE.md` #4 — it was rendering, and invisible.

     ── AND FIXING THAT ALONE MOVED NOTHING. Paired, one plate, 72 tiles, 3 judges ──
         arm                                              native
         A  shipped, inherited (invisible) hands          0/3
         C  SAME geometry, hands in P.ketchup at 2.4u —
            2.70:1 on the dial, 3.65:1 on the plate       0/3   Δ +0
         B  those hands, and the long one RUNS OUT TO
            r=11.3, projecting 3.6 units past the r=7.7
            dial                                          **2/3**  **Δ +2 of 3**
     C is the control that makes the finding, and it is `LESSONS.md` §6b in one row: the
     invisibility is real, measured and was worth fixing — and it is NOT what the viewer
     was reacting to. An onion and a lollipop are both symmetric about their stem, so the
     asymmetric spur at 1 o'clock is the one axis the wrong answers cannot follow.
     ⚠️ FLOOR: this round's twins split 3 of 9, all on `chest`, the plate's one ILLEGIBLE
     twin — so ±1 of 3 is noise for a failing subject here and only the +2 clears it.
     ⚠️ AND THE CONFUSION MOVED RATHER THAN VANISHING, on one judge of three: B's single
     miss is "a lightning bolt", i.e. `speed`, which ships on this same fact pill. It went
     from 3 of 3 wrong to 1 of 3, and what is left points at a sibling.
     ⚠️ Ketchup rather than ink or cream on purpose: it is the only value that survives
     BOTH polarities — an ink hand would vanish where the hand leaves the dial and crosses
     the ink pill, and a cream one vanishes on the dial, which is the bug being fixed. */
  timer: `
<circle cx="12" cy="13.6" r="7.7" fill="#C9B8DE"/>
<path d="M9.5 2.4h5" stroke-width="2.1"/>
<path d="M12 2.4v3.5" stroke-width="2.1"/>
<path d="M12 13.6V8.2" stroke="${P.ketchup}" stroke-width="2.4"/>
<path d="M12 13.6 21.4 7.4" stroke="${P.ketchup}" stroke-width="2.4"/>`,

  /* UNCHANGED, and the reason is about the INSTRUMENT rather than the art — the same
     caveat `egg` carries in `food.ts`, arrived at by a different route.

     One native panel had this **0/3, "a cut gemstone" x3**, while `gem` itself was 3/3:
     a one-way leak into a shipped icon. The cause looked measured rather than guessed.
     On this pill the outline flips to `#FFF3DE`, and the cross is ALSO `P.cream`, so
     cross and outline are one colour (16.5:1 against the plate, 2.26:1 against the green)
     and the mass is cut into four pips with pale seams between them — which is `gem`'s
     construction, a body split into panels by interior lines. And the shipped heart has
     no CLEFT: its two arcs meet at (12, 7.2) while the lobe apexes sit at y≈6.45, a
     0.75-unit notch = **0.43 px at 13.8**. A heart without a cleft is a wide-topped body
     ending in a point, i.e. a gemstone.

     Two arms were built and measured paired, 72 tiles, 3 judges:
         A  shipped                                        3/3   ← 🔴
         C  cross recoloured to #1F3D08 (4.90:1 on the
            green), geometry untouched                     3/3   Δ +0
         B  that cross, plus a 5.2-unit cleft against
            apexes at y≈5.2                                2/3   Δ −1
     🔴 THE SHIPPED ARM SCORED 3/3, so the defect did not reproduce and both Δs are
     measured against a ceiling. Across those two rounds 24 of 63 icons moved by ≥1 of 3
     on identical art and 13 by ≥2, `heal` among them (0/3 → 3/3) — a per-icon native
     score from one 3-judge panel is not a measurement. Nothing here is falsified and
     nothing is confirmed; re-measure on a round where arm A reproduces 0/3 before
     drawing anything new.
     ⚠️ Two further arms were drawn, rendered and REJECTED before any judge saw them, and
     both failures are properties of this pill rather than of this glyph: a CREAM cross
     grown until it projects past the heart becomes the mass and reads as `sparkle`
     (cream is the outline colour here, so a dominant cream element stops being a mark on
     the glyph and becomes the glyph); the same cross in #1F3D08 is dark-on-ink the moment
     it leaves the heart and simply is not there. Anything that breaks this silhouette has
     to read against BOTH the green and the ink — as `timer`'s ketchup hand does. */
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
  /* 🔴 IT COULD BE MISTAKEN FOR A COIN, WHICH IS WORSE, AND THE CAUSE WAS ALREADY
     WRITTEN DOWN ONE FILE OVER.
     WAS: `<circle r="9.1" fill="${P.gold}"/>` with the spiral above drawn INSIDE it.
     Kept in words. `food.ts`'s `swirl` comment says, of the identical construction:

       *"a spiral drawn INSIDE a filled disc is a disc, because at this size the disc is
       the mass and the spiral is a 1.7px scratch on it."*

     `swirl` was redrawn for exactly that and this glyph — the same drawing — was never
     revisited. At its one delivered site (13.8 px, the `chars-fact` INK pill, cream
     outline, 77 occurrences) three blind judges allowed to magnify scored it **1/3, "a
     gold coin" x2**.

     ── PAIRED, three arms on one plate, twin floor 0 of 9 ─────────────────────
         arm                                        zoom    native
         A  shipped disc + interior spiral          1/3     0/3
         C  SAME disc, spiral fattened to 2.8u and
            darkened to near-ink — contrast only    1/3     0/3   Δ +0
         B  this: the spiral BREAKS THE OUTLINE     **3/3**  0/3   **Δ +2 of 3**

     C is the control that matters: making the interior line as loud as it can be moved
     NOTHING. The silhouette is the whole lever, which is `food.ts`'s rule restated with
     a number. A blind judge, magnifying, put it plainly: *"only 44 shows the shell's
     pointed apex; 8 and 24 alone are weakly identifiable."*

     ⚠️ IT IS STILL WEAK AT NATIVE SIZE — 0/3 in the round that chose it, 1/3 in the
     next one. Shipped because +2 of 3 magnified and no loss anywhere is a strict
     improvement, but the low-acuity read is NOT solved.

     🔴 AND THE OBVIOUS NEXT MOVE WAS TRIED AND IS WRONG. This comment said, on one
     round's evidence, *"the remaining defect is measured and is HUE, not shape: at
     13.8 px a warm gold rounded mass is the currency, and ten glyphs in this set are
     gold."* That inference came from ONE round in which the native misreads were "a
     gold coin" x2. It is kept because it is exactly the mistake this file keeps making
     — reasoning from a misread instead of testing it. A second paired plate, twin floor
     0 of 9, same silhouette, one variable:

         arm                                    magnified   native
         A  gold (shipped)                      3/3         1/3
         D  `P.woodHi` brown, near-ink whorl    3/3         1/3   Δ +0
         E  `P.candy` pink, near-ink whorl      3/3         **0/3   Δ −1**

     Hue is not the lever, and the loudest separation available made it WORSE. What the
     second round also showed is why: with the shell shipped, nothing on the plate was
     named "a gold coin" except `coin` itself, and slow's wrong answers moved to "a
     rolled burrito" / "a hot dog with mustard" / "a tomato" / "a fish" — a DIFFERENT
     wrong answer every round. Unstable misreads are the signature of a LEGIBILITY
     failure, where nobody can name it, not a DISTINGUISHABILITY one where it collides
     with a neighbour (`LESSONS.md` §3), and those have opposite fixes. The next move is
     LESS DETAIL AND MORE MASS at 13.8 px — not another hue and not another silhouette.

     ⚠️ A spiral RIBBON was rejected on arithmetic, not taste: at 13.8 px one viewBox
     unit is 0.575 px, so two turns need a gap wider than the stroke and no pair of
     numbers under 24 units gives one.

     🔴 AND A THIRD NATIVE PANEL SAYS "LEGIBILITY FAILURE" IS NO LONGER THE RIGHT CALL.
     Unchanged art, fresh plate, fresh judges: **0/3, "a spinning cyclone or vortex" x3**
     — one answer, unanimous, and it names `swirl`, a shipped icon two files over. The
     apex-plus-300°-groove that fixed the coin reading is a vortex: an arc that nearly
     closes around a centre dot is the cyclone mark. So this is now a COLLISION and not a
     legibility failure, and the two want opposite fixes. ⚠️ ONE ROUND, and in that same
     round 24 of 63 icons moved by ≥1 of 3 on identical art, so do not act on it alone —
     but note it costs twice, because `cap` in that round went 0/3 naming **this** glyph
     ("a snail shell spiral" x3), making a three-link chain cap → slow → swirl. */
  slow: `
<path d="M13 7.6 21.8 3.6 18.4 13.2z" fill="${P.gold}"/>
<circle cx="10.6" cy="14.2" r="7.8" fill="${P.gold}"/>
<path d="M14.2 18.4a5 5 0 1 1 1-5.6" stroke="#5A3200" stroke-width="2.8" fill="none" stroke-linecap="round"/>
<circle cx="10.6" cy="14.2" r="1.7" fill="#5A3200" stroke="none"/>`,

  /* Win count. Exists purely so the trophy stops meaning two different quantities. */
  /* UNCHANGED, and the redraw that was built is recorded rather than shipped.
     At the delivered 11.19 px this is 3/3 when a judge may magnify and **0/3 at native
     size in two separate rounds** — but it fails DIFFERENTLY every round: "a trophy cup"
     x3 in one, "a chef's hat" x2 + "a party popper" x1 in the next. That is a LEGIBILITY
     failure (nobody can name it) rather than a DISTINGUISHABILITY one, and `LESSONS.md`
     §3 says those have opposite fixes.
     ⚠️ So the trophy↔medal mutual swap this icon exists to prevent — 3+3 in one round —
     did NOT reproduce: `trophy` scored 3/3 at native size on the next plate. Do not treat
     it as standing.
     The candidate: ONE wide ketchup ribbon with a V tail over a gold disc with a
     mustardHi hub, replacing the two thin splayed strips. Paired, twin floor 0 of 9:
     **3/3 -> 3/3 magnified, 0/3 -> 0/3 native, Δ +0 at both.** It moved the wrong answer
     onto "a lollipop" x3 — a band above a round mass is a lolly — which is a candidate no
     tile on the plate draws, i.e. it bought nothing and cost a new neighbour. Reverted. */
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
