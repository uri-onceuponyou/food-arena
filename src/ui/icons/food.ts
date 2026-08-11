/**
 * Ability / weapon glyphs — the HUD weapon bar and character select's ability list.
 *
 * ── Why these are AUTHORED, when the game has real 3D for some of them ───────
 * The default preference in this directory is to render from the game's own content
 * (`portraits.ts` does exactly that). It was measured against this set and rejected,
 * with a number:
 *
 *   `src/vfx/weapons/*` implements a bespoke `projectile()` hook for **16 of the 33
 *   weapons.** The other 17 are melee, self-buff, or still on the generic fallback —
 *   a melee weapon has no projectile object to photograph at all, and the generic
 *   fallback is a tinted sphere, i.e. the same coloured ball for every weapon that
 *   uses it.
 *
 * So route 1 would fill under half the bar with real renders and the rest with either
 * identical spheres or drawings, and a weapon bar is the one place in the game where
 * four icons sit side by side and are compared directly. A bar that mixes two visual
 * languages reads worse than either language used consistently — which is the same
 * argument that got the emoji removed in the first place. One language, all 33.
 *
 * ── What keeps them honest ──────────────────────────────────────────────────
 * `index.ts` looks these up by the `emoji` field already present on every weapon and
 * ability in `game/rules.ts`, so the mapping is data-driven off the file that owns the
 * design, and a weapon whose glyph is missing falls through to its emoji rather than
 * to a blank. Colours are drawn from the same palette the weapons' own `color` fields
 * use, so a red weapon has a red icon.
 */

import { P, starPath } from './svg';

/**
 * ── The identify-at-real-size pass, and what the instrument found ────────────
 *
 * `tools/tmp/icon_legibility.mjs` renders this set into the REAL shipped box at the REAL
 * shipped size and a blind judge names each tile; `tools/tmp/icon_score.mjs` scores it and
 * prints a CONFUSION MATRIX. Two things the earlier rounds had wrong:
 *
 *  * They measured at 26px. `hud.ts:1989` drops `.hud-weapon-emoji` to **20px** under
 *    `max-width: 720px` — every phone, i.e. the platform the touch pillar was built for.
 *    20px is the smallest shipped size and the only honest place to measure.
 *  * They reported a COUNT. A count cannot separate "two icons swap with each other"
 *    (a distinguishability defect) from "nobody can name this at all" (a legibility
 *    defect), and those have opposite fixes — one wants a different silhouette, the other
 *    wants less detail and more mass. Seven blind judges produced three mutual swaps:
 *    `cap <-> swirl` (both blue discs), `puffer <-> fish` (both fish), and
 *    `noodle <-> honey <-> rice` (three vessels).
 *
 * The rule that came out of it, and the one to apply to any new glyph here:
 * **one bold distinguishing mass, and break the silhouette.** Every icon that scored 7/7
 * owns a shape no other icon owns (cheese's wedge, the egg's oval, ketchup's bottle). Every
 * icon that failed either shared a silhouette with a neighbour or was assembled from
 * several small parts — and at 20px one viewBox unit is 0.83px, so a 2-unit feature is
 * 1.7px and simply is not there. `docs/LESSONS.md` §6, again.
 */
export const FOOD_ICONS: Record<string, string> = {
  /** Patty Smash. A grilled disc seen slightly from above: the visible edge is what
   *  stops it reading as a flat brown circle. */
  patty: `
<ellipse cx="12" cy="14.3" rx="8.5" ry="4.5" fill="${P.pattyDark}"/>
<ellipse cx="12" cy="11.5" rx="8.5" ry="4.5" fill="${P.patty}"/>
<path d="M6.8 10.4 10 12.3M10.9 9.2 14.1 11.1M15.2 10.1 17.8 11.6" stroke="${P.pattyDark}" stroke-width="1.5"/>`,

  /** Filling Toss. The BONE is the whole icon: without it a brown blob is
   *  indistinguishable from the brown disc above, and hamburger and taco both carry a
   *  brown weapon.
   *
   *  **5/7**, and both misses said BOMB — a dark round mass with a small pale thing poking
   *  out of its top-right corner is a cartoon bomb with a fuse, and that is exactly what
   *  it was.
   *
   *  UNCHANGED, deliberately, and this is the interesting entry. The "bomb" reading came
   *  from the free-form and one-to-one arms, and two redraws were built on it: standing the
   *  bone at 45°, then moving it to the mid-line. Both were **worse** — 3/3 to 1/3 on the
   *  low-variance arm, swapping with `wrap` and then with `cap`. On that arm this drawing
   *  was never broken at all; the "bomb" answers came from arms that were also mis-scoring
   *  icons nobody has ever complained about. Reverted, with the measurement kept so the
   *  next pass does not spend the same budget again.
   *
   *  ── STILL UNCHANGED, AND THIS TIME IT IS THE FLOOR THAT STOPS IT, NOT THE ARM ──
   *  The mass is 14.5 x 16.3, i.e. a near-circle, and the only thing about this glyph that
   *  is not a circle is one cream bone end at the UPPER RIGHT. A bone that enters a mass
   *  has to LEAVE it. One variable — a second knob-pair at the lower left, mirrored through
   *  the mass so the two ends are roughly collinear through its centre, everything else
   *  byte-identical. Paired, 73 tiles, 3 judges per protocol:
   *      A  shipped, one bone end     0/3 native   2/3 magnified
   *      B  two bone ends             1/3  Δ +1    3/3  Δ +1
   *  ⚠️ NOT SHIPPED. The native floor in this round is **1 of 3** — `boxFire`, the declared
   *  ILLEGIBLE twin, split on 3 of 3 judges — so a +1 on a subject sitting at 0/3 is inside
   *  the noise by construction, and `CLAUDE.md` #10 is explicit that a metric's floor is
   *  stated before acting rather than after. It is the strongest of this pass's parked arms:
   *  +1 in the SAME direction at both protocols, no loss anywhere, single variable, named
   *  mechanism. It wants one more paired plate, not a redraw. Arm [B] of `meat` in
   *  `ic_mkvariants.mjs` is the drawing.
   *  ⚠️ Worth recording separately: A's native misreads this round were **"a snail shell
   *  spiral" x2**, i.e. `slow` — a collision neither glyph's notes have ever mentioned, and
   *  both are a warm round mass with a small appendage off one side.
   *
   *  ── 🚨 IT GOT ITS SECOND PLATE, AND ARM B IS **DISPROVEN**. DO NOT RE-RUN IT. ──
   *  r13, seed 23, 74 tiles, twins `stun`/`chest` (failing) + `tomato`/`gift` (passing),
   *  which BRACKETED: the passing pair split 0 of 3 each, the failing pair 2 of 3 and
   *  1 of 3, so the native floor for a failing subject is 1–2 of 3. One plate, one round,
   *  one set of pixels, and THE TWO PROTOCOLS CAME BACK AT OPPOSITE EXTREMES:
   *
   *      arm                   native                    magnified
   *      A  one bone end       **3/3** (its best ever)    **0/3**  "a pot of honey" x3
   *      B  two bone ends      **0/3   Δ -3**             **3/3   Δ +3**
   *
   *  B's three native misses ARE the mechanism, verbatim: "dough balls", "a chef's hat",
   *  "a party popper" — every one of them SEVERAL SMALL PALE ROUND THINGS. That is
   *  exactly what a second knob-pair delivers at 22.72 px: a knob is r 1.9, i.e. 3.8
   *  units = 3.6 px, and the inherited 1.7-unit outline eats 1.6 px of it, so four knobs
   *  are four ~2 px cream dots scattered round a brown mass. At 5x they resolve into two
   *  bone ends and the drawing is unambiguous — which is the +3.
   *  → **B IS A BETTER DRAWING AND A WORSE ICON.** This is the cleanest evidence in this
   *    file that the magnified arm is not the decision arm. The standing complaint about
   *    it was that it sits at a CEILING and carries no information (`13fb98c`, `620bf7f`,
   *    `d7af2e0`); here it carries the maximum possible information and points **the
   *    other way at full amplitude**. A ceiling can be argued with. This cannot.
   *  → And the parked arm was the best-placed one in the whole file — "+1 in the SAME
   *    direction at both protocols, no loss anywhere, single variable, named mechanism".
   *    It was noise. **A second panel was the entire difference**, which is `CLAUDE.md`
   *    #10 costing nothing for once, because the arm was parked rather than shipped.
   *  ⚠️ A's magnified "a pot of honey" x3 is a NEW and unrecorded collision, and it is the
   *    same sentence `honey`'s own notes use for its collision with `chest`: a warm
   *    rounded mass with a light horizontal band. `P.meatHi`'s 1.8-unit arc is that band.
   *    Nothing is owed to it — A scores 3/3 where it ships — but it is where a future
   *    magnified round's confusion will come from. */
  meat: `
<path d="M2.6 12.8c0-4.6 3.4-7.6 7.6-7.6 4.3 0 6.9 2.9 6.9 6.5 0 4.9-3.4 8.7-7.6 8.7-4.1 0-6.9-3.2-6.9-7.6z" fill="${P.meat}"/>
<path d="M6.8 9.8c2.6-.8 4.5.2 5.5 2.5" stroke="${P.meatHi}" stroke-width="1.8"/>
<path d="M14.4 7.6h4.8a1.5 1.5 0 0 1 0 3h-4.8a1.5 1.5 0 0 1 0-3z" fill="${P.cream}"/>
<circle cx="19.6" cy="7.2" r="1.9" fill="${P.cream}"/>
<circle cx="19.6" cy="10.6" r="1.9" fill="${P.cream}"/>`,

  tomato: `
<circle cx="12" cy="13.7" r="7.6" fill="${P.tomato}"/>
<path d="M12 7.2c-1.5-1.4-3.1-1.8-4.4-1.4.1 1.5.9 2.7 2.1 3.4M12 7.2c1.5-1.4 3.1-1.8 4.4-1.4-.1 1.5-.9 2.7-2.1 3.4z" fill="${P.leafDark}" stroke-width="1.4"/>
<path d="M12 3.4v3.6" stroke="${P.leafDark}" stroke-width="1.9"/>
<path d="M8.5 11a4.4 4.4 0 0 1 2.4-2.3" stroke="${P.tomatoHi}" stroke-width="1.7"/>`,

  /** UNCHANGED. A "lime slice" reading was reported twice and a deeper-ruffled, vein-free
   *  redraw measured **flat** — 3/3 both ways on the low-variance arm, and its new wrong
   *  answers ("green pea") were no better than its old ones. No measured gain, so no
   *  change: churn on a glyph that is not moving is how an icon set loses coherence. */
  lettuce: `
<path d="M12 20.8c-5.4 0-8.9-3.5-8.9-7.6 0-1.7 1.1-2.3 2.1-1.7.4-1.9 1.9-2.5 2.9-1.4.6-1.9 2.3-2.5 3.3-1.3.9-1.9 2.7-2.1 3.7-.6 1.2-1.1 2.9-.2 2.9 1.4 1.5-.2 2.7.9 2.5 2.3.6 3.9-2.7 8.2-8.2 8.2z" fill="${P.lettuce}"/>
<path d="M12 20.2v-8.4" stroke="${P.leafDark}" stroke-width="1.6"/>`,

  onion: `
<path d="M12 20.8c-4.1 0-6.8-2.7-6.8-6.4 0-3.5 2.7-6.6 6.8-8.6 4.1 2 6.8 5.1 6.8 8.6 0 3.7-2.7 6.4-6.8 6.4z" fill="#F4E6F7"/>
<path d="M12 6.2v14.6" stroke="${P.violet}" stroke-width="1.4"/>
<path d="M8.4 8.6c-1.1 2.5-1.3 5.6 0 9.1M15.6 8.6c1.1 2.5 1.3 5.6 0 9.1" stroke="${P.violet}" stroke-width="1.4"/>
<path d="M12 6.4c.4-2.1 1.9-3.2 3.6-3.4-.4 2.1-1.7 3.2-3.6 3.4z" fill="${P.lettuce}" stroke-width="1.3"/>`,

  /** UNCHANGED, and this entry is mostly about what CANNOT be drawn at this size.
   *
   *  The standing diagnosis was a collision: delivered ink 17.61 x 9.09 (1.94:1) against
   *  `range`'s 10.12 x 4.48 (2.26:1), i.e. a flat lozenge with two outward triangles is a
   *  double-headed arrow. ⚠️ THE DATA DOES NOT SUPPORT IT. Across two earlier native
   *  panels the wrong answers were flag x2, range x1, mustardblast x1, meat x2 — a
   *  DIFFERENT answer nearly every round, which is a legibility failure and not a
   *  collision (`LESSONS.md` §3), and those have opposite fixes.
   *
   *  🚨 THREE CANDIDATES WERE DRAWN AND ALL THREE WERE REJECTED ON RENDER, BEFORE ANY
   *  JUDGE, FOR ONE ARITHMETIC REASON. At the delivered 22.72 px one viewBox unit is
   *  0.947 px and the inherited outline is 1.7 units, i.e. **0.85 units of ink inset on
   *  each side of every path**. A wrapper twist pinched to a 2.2-unit waist therefore has
   *  0.5 units of fill left at its neck; widened to 4.2 it has 2.5; and a two-lobed fan
   *  notched from x 2.7 to x 4.9 leaves 1.9 units between the notch apex and the body.
   *  All three rendered as a DARK X with a pink dot in it — `close` or `sparkle` —
   *  strictly worse than the arrow they were meant to fix, and **every numeric control
   *  passed on all three**. Only reading the PNG caught it (CLAUDE.md #3).
   *  → **Nothing narrower than about 5 units shows fill in this icon system at 22.72 px.**
   *    That rules out every twist geometry that works by REMOVING area, which is the whole
   *    family "pinch the wrapper concave" belongs to. Recorded in `ic_mkvariants.mjs`.
   *
   *  What was measurable instead was the AXIS — byte-identical geometry inside a
   *  `rotate(-20 12 12)`, costing no ink at all, on the theory that `range` is strictly
   *  horizontal and cannot follow a tilt. Paired, 73 tiles, 3 judges per protocol:
   *      A  shipped, horizontal    **3/3** native   2/3 magnified
   *      C  the same art at -20    3/3  Δ +0        3/3  Δ +1
   *  🔴 THE SHIPPED ARM SCORED 3/3 AT NATIVE SIZE, so the defect did not reproduce and
   *  the native Δ is measured against a ceiling the round supplied. Not shipped: the only
   *  non-zero number is +1 at the protocol that is explicitly not the decision arm, and a
   *  "never worse in one round" is exactly the reasoning `boxBurger` burned six variables
   *  on. The tilt is drawn and kept as arm [C] for a plate where [A] reproduces 0/3.
   *
   *  ── 🔴 THAT PLATE WAS RUN AND [A] DID NOT FAIL AGAIN. THIS GLYPH IS CLOSED. ──
   *  r13, seed 23, fresh plate, fresh judges, a third arm, and a round whose twins
   *  bracketed at both protocols:
   *      A  shipped                  2/3 native   3/3 magnified
   *      C  the -20 degree tilt      2/3  Δ +0    3/3  Δ +0
   *      D  the cream highlight arc
   *         DELETED (ink budget)     2/3  Δ +0    3/3  Δ +0
   *  Identical at both protocols on all three arms — and the single native miss was the
   *  SAME judge giving the SAME wrong answer ("a fish caught on a hook") to all three
   *  tiles, i.e. one reader's reading of a shape rather than a property of any arm.
   *  Pooled over the two rounds that carried it as a subject the shipped arm is 3/3 and
   *  2/3 native. **The legibility failure this glyph was dispatched for does not
   *  reproduce**, and a subject sitting at 2–3 of 3 cannot show a gain.
   *  → Five arms have now been drawn for `candy`: three rejected on render by the outline
   *    arithmetic, two measured at Δ +0 twice each. It is CLOSED, not parked. The next
   *    variable spent here needs a round in which [A] actually fails first — and the
   *    older "double-headed arrow / `range` collision" story is dead twice over, since
   *    `range` scored 3/3 in this round while every candy tile kept its own answer. */
  candy: `
<ellipse cx="12" cy="12" rx="5.3" ry="4.7" fill="${P.candy}"/>
<path d="M6.8 10.1 2.7 7.2v9.6l4.1-2.9z" fill="${P.candyHi}"/>
<path d="M17.2 10.1 21.3 7.2v9.6l-4.1-2.9z" fill="${P.candyHi}"/>
<path d="M9.7 10.4a3 3 0 0 1 2-1.5" stroke="${P.cream}" stroke-width="1.6"/>`,

  /** Roll Stun — a cyclone, the one weapon whose icon is a MOTION rather than an
   *  object, because the ability is the burrito spinning rather than a thing thrown.
   *
   *  Scored **2/7**, and it swapped with `cap` three times: a spiral drawn INSIDE a filled
   *  disc is a disc, because at 20px the disc is the mass and the spiral is a 1.7px
   *  scratch on it. Judges called it a bottle cap, a clock face and a donut — all discs.
   *  The disc is gone. Two fat teardrop arms make a two-bladed pinwheel whose silhouette
   *  is a pinwheel, which nothing else here owns, and the spiral is now the OUTLINE rather
   *  than an interior line. Three arms rather than two: two make an S, and an S at 20px is
   *  a bow tie.
   *
   *  ── UNCHANGED AGAIN, AND THIS TIME IT IS THE ROUND THAT FAILED, NOT THE ARMS ──────
   *  A native panel had it **0/3, "seaweed" x3** at the delivered 22.72 px, and `seaweed`
   *  is a stem with three lobes of exactly this shape — so the pinwheel above is a THREE-
   *  LEAF SPRIG, each blade pointed at the hub and convex on both edges. The hue is as far
   *  apart as this palette goes (`P.water` #1E90D8 against #3E8B4A) and three judges still
   *  said seaweed, which is `slow`'s arms D/E again: hue does not carry a native read.
   *  Two arms, paired, 72 tiles, 3 judges, `--twins chest,tomato,gift`:
   *      A  shipped three convex blades                       2/3   ← 🔴
   *      C  the same radial composition, blades hooked into
   *         commas so the outline spirals                     2/3   Δ +0
   *      B  a TORNADO: four stacked lozenges of decreasing
   *         width, radial composition abandoned entirely      1/3   Δ −1
   *  🔴 THE SHIPPED ARM SCORED 2/3, so the "seaweed" defect did not reproduce and both Δs
   *  sit inside a round whose twin floor was 3 of 9. Note where the seaweed reading went
   *  instead: in that round `lettuce` and `seaweed` swapped with each other 3/3 in BOTH
   *  directions — the first full mutual swap this instrument has produced — so the green
   *  leaf answers were occupied elsewhere and this tile was never offered them.
   *  The tornado is drawn and rendered (`tools/tmp/ic_mkvariants.mjs`, arm B) and is worth
   *  re-running on a plate where arm A reproduces 0/3; it is not worth redrawing. */
  swirl: `
<g fill="${P.water}">
<path d="M12 12C13.4 7 16.2 3.6 19.6 2.6a2.7 2.7 0 0 1 2 3.6C20.2 9.2 17.2 11 12 12z"/>
<path d="M12 12C13.4 7 16.2 3.6 19.6 2.6a2.7 2.7 0 0 1 2 3.6C20.2 9.2 17.2 11 12 12z" transform="rotate(120 12 12)"/>
<path d="M12 12C13.4 7 16.2 3.6 19.6 2.6a2.7 2.7 0 0 1 2 3.6C20.2 9.2 17.2 11 12 12z" transform="rotate(240 12 12)"/>
</g>
<circle cx="12" cy="12" r="1.8" fill="${P.cream}" stroke-width="1.4"/>`,

  /** Hatch!
   *
   *  TWO independent blind legibility tests failed this icon, and both named the same
   *  cause: a chick AND its shell is two objects, and two objects do not fit in 26px —
   *  they merged into one dark arch with a blob in it. So the shell is gone and the
   *  chick fills the whole grid. One subject, three features (eyes, beak, tuft).
   *
   *  ... and then it scored **4/7**, answered "coin", "bear face cookie" and "face with
   *  eyes". A single circle filling the grid with three small marks inside it is a COIN at
   *  20px, because the marks are 4-unit features (3.3px) and the circle is the mass. The
   *  fix is not bigger marks, it is a broken silhouette: an overlapping head and body, and
   *  a beak that sticks OUT past the outline. Nothing round has a corner. */
  chick: `
<path d="M10.4 4.4 11 1.8 12.8 4.2" stroke-width="1.8"/>
<ellipse cx="11.4" cy="15.8" rx="7.2" ry="6" fill="${P.mustardHi}"/>
<circle cx="11.6" cy="9.4" r="5.4" fill="${P.mustardHi}"/>
<path d="M16.6 8.2 22.2 10.2 16.6 12.2z" fill="${P.gold}"/>
<circle cx="13.4" cy="8.2" r="1.4" fill="${P.ink}" stroke="none"/>
<path d="M8.4 15a4 4 0 0 0 4.6 4.4" stroke="${P.gold}" stroke-width="1.9"/>`,

  /** Shell Shards / Double Toss — a generic impact star, correct for both. */
  burst: `<path d="${starPath(9, 10.2, 4.6)}" fill="${P.gold}"/>
<path d="${starPath(9, 5.6, 2.4)}" fill="${P.mustardHi}" stroke-width="1.3"/>`,

  /** Lollipop Smash. Round 1's head spanned the full grid and read as a plain T-bar;
   *  a narrower, deeper head with a visible striking face reads as a mallet. */
  hammer: `
<path d="M5.2 3.4h13.6a1.7 1.7 0 0 1 1.7 1.7v4.4a1.7 1.7 0 0 1-1.7 1.7H5.2a1.7 1.7 0 0 1-1.7-1.7V5.1a1.7 1.7 0 0 1 1.7-1.7z" fill="#C9B8DE"/>
<path d="M16.2 3.6v7.4" stroke-width="1.4"/>
<path d="M10.1 11h3.8v10.2h-3.8z" fill="${P.patty}"/>`,

  /** Dough Balls. **4/7** — called bubbles, soap bubbles and grapes. THREE equal circles
   *  in a triangle is the grape/bubble cluster, whatever colour it is wearing.
   *
   *  Cutting it to two of clearly different sizes scored **2/6** and both misses said "two
   *  eggs" — which is worse, because `egg` is in the same set and a wrong answer that names
   *  another icon is a swap waiting to happen, where "bubbles" at least names nothing. So
   *  three it is: measured, the grape read costs less than the egg read. The third ball is
   *  cheap insurance and this is a 4/7 glyph that is not worth more of the budget than
   *  that. */
  dough: `
<circle cx="8" cy="15.4" r="5.1" fill="#E6D4B0"/>
<circle cx="16.4" cy="14.6" r="4.3" fill="#EFE0C4"/>
<circle cx="12.6" cy="7.4" r="4.6" fill="#F7ECD6"/>
<path d="M10.8 5.9a2.6 2.6 0 0 1 1.8-1.4" stroke="${P.white}" stroke-width="1.5"/>`,

  /** Cheese Blind. A true wedge — round 1's shallow slab read as a boat. The holes are
   *  oversized on purpose: at 26px anything under ~1.6 units closes up. */
  cheese: `
<path d="M2.4 17.4 20.4 5.6a1.4 1.4 0 0 1 1.2 1.4v10.4a1.4 1.4 0 0 1-1.4 1.4H3.8a1.4 1.4 0 0 1-1.4-1.4z" fill="${P.mustard}"/>
<circle cx="9.4" cy="15.2" r="1.9" fill="#DE9A12" stroke="none"/>
<circle cx="16.2" cy="12.2" r="1.6" fill="#DE9A12" stroke="none"/>
<circle cx="17.6" cy="16.6" r="1.3" fill="#DE9A12" stroke="none"/>`,

  /** Fish Pile's rice bowl. **3/7**, and part of a three-way vessel collision: `rice`,
   *  `noodle` and `honey` were all "a rounded container with something in it", and judges
   *  answered "bowl" with no qualifier. A bowl is not a distinguishing mass when three
   *  icons are bowls. Two chopsticks were tried here first and **made it worse, 3/7 to
   *  1/6** — every wrong answer named noodles ("a bowl of noodles", "noodle bowl with
   *  chopsticks"). Chopsticks are not a generic "eating" mark; they specifically mean
   *  noodles, so they moved to `noodle` where that association is the right answer.
   *
   *  Which leaves this one to be separated by the two things it already had and the other
   *  two vessels no longer do: it is the only OPEN bowl in the set now (`honey` gained a
   *  lid, `noodle` gained chopsticks), and its mound is white against `noodle`'s mustard
   *  in a bowl that is cool where `noodle`'s is hot. */
  rice: `
<path d="M3.4 13.4h17.2c0 4.6-3.8 8-8.6 8s-8.6-3.4-8.6-8z" fill="${P.waterHi}"/>
<path d="M5.6 13.4a2.2 2.2 0 0 1 2.8-2 2.4 2.4 0 0 1 3.6-1.6 2.4 2.4 0 0 1 3.6 1.6 2.2 2.2 0 0 1 2.8 2z" fill="${P.white}"/>
<path d="M2.4 13.4h19.2" stroke-width="1.8"/>`,

  /** UNCHANGED. It was redrawn as broad kelp blades to kill a "sprout / seedling" reading,
   *  measured **flat** (3/3 both ways), and its new wrong answers were WORSE in kind: one
   *  judge called the kelp version "noodles", which is another icon in this same set. A
   *  wrong answer that names a neighbour is a swap forming; a wrong answer that names
   *  nothing ("seedling") costs one point and stops there. Reverted on that basis. */
  seaweed: `
<path d="M12 21.6V6" stroke="#2E6B3A" stroke-width="2.3"/>
<path d="M11.8 10c-4.6 0-7-2.6-7-6.8 4.6 0 7 2.6 7 6.8z" fill="#3E8B4A"/>
<path d="M12.2 15.4c4.6 0 7-2.6 7-6.8-4.6 0-7 2.6-7 6.8z" fill="#4E9B5A"/>
<path d="M11.8 20.8c-4.6 0-7-2.6-7-6.8 4.6 0 7 2.6 7 6.8z" fill="#3E8B4A"/>`,

  fish: `
<path d="M2.4 12.2c2.1-4 5.6-6.1 9.7-6.1 3.5 0 6 1.7 7.3 4.2-1.3 4.8-4.4 7.9-9 7.9-3.5 0-6-2.1-8-6z" fill="${P.water}"/>
<path d="M18.9 10.1 22.4 7v10.2l-3.5-3.4z" fill="${P.waterHi}"/>
<circle cx="7.1" cy="10.7" r="1.2" fill="${P.ink}" stroke="none"/>`,

  /** Big Catch.
   *
   *  Sushi carries Fish Pile and Big Catch in the SAME four-slot bar, so these two cannot
   *  be one silhouette in two colours. Two spiky-ball drafts were read as a SUN (any
   *  radially symmetric spiked disc is), and the fish-on-a-hook that replaced them scored
   *  **2/7** — named plain "fish" by five of seven judges, i.e. it swapped straight into
   *  `fish`. The hook was a 2-unit stroke above a fish that filled the grid, so the fish
   *  WAS the mass and the hook was a hairline.
   *
   *  Inverted: the hook is now the subject and fills two thirds of the grid at 2.8 units
   *  (2.3px at 20px), and the fish is a small catch hanging off it. Same idea, opposite
   *  mass budget — which is the whole lesson. */
  puffer: `
<path d="M11 1.8v6.8a4.1 4.1 0 1 1-8.2 0v-1.2" stroke-width="2.8"/>
<path d="M2.8 8.2 5.4 11.6" stroke-width="2.2"/>
<path d="M10.4 17.4c1.2-2.2 3.1-3.4 5.4-3.4 2 0 3.4 1 4.2 2.4-.8 2.7-2.6 4.5-5.2 4.5-2 0-3.4-1.2-4.4-3.5z" fill="${P.gold}"/>
<path d="M19.8 16.4 22.4 14.6v5.9l-2.6-1.9z" fill="${P.mustard}"/>
<circle cx="13.2" cy="16.9" r="1.1" fill="${P.ink}" stroke="none"/>`,

  droplets: `
<path d="M8.4 20.6a4.9 4.9 0 0 1-4.9-4.9c0-2.9 4.9-8.4 4.9-8.4s4.9 5.5 4.9 8.4a4.9 4.9 0 0 1-4.9 4.9z" fill="${P.water}"/>
<path d="M17.6 13.6a3.3 3.3 0 0 1-3.3-3.3c0-2 3.3-5.7 3.3-5.7s3.3 3.7 3.3 5.7a3.3 3.3 0 0 1-3.3 3.3z" fill="${P.waterHi}"/>`,

  /** **2/7**, and it swapped with `honey` — two judges called this bowl a pot of honey and
   *  a third called it soup. A single fat noodle lifted clear of the bowl was tried as the
   *  bold mass and scored **0/6** — the worst result of the whole pass. It was read as a
   *  cherry, a red bird and a ladle, because a curl above a bowl is a handle, and a handle
   *  belongs to the bowl rather than to what is in it.
   *
   *  What works is a mark that is ABOUT noodles rather than a drawing of one: chopsticks.
   *  A blind judge, unprompted, wrote "noodle bowl with chopsticks" for the RICE bowl when
   *  the chopsticks were on that one — so the association is doing the work, and it should
   *  be spent on the bowl that means noodles. Two long marks, 5.6 units apart, out of the
   *  top-right: the same construction rice was carrying, moved to where it earns its keep. */
  noodle: `
<path d="M16.4 2 13 11.4" stroke="${P.woodHi}" stroke-width="2.6"/>
<path d="M21.7 3.9 18.3 13.3" stroke="${P.wood}" stroke-width="2.6"/>
<path d="M3.2 13.2h17.6c0 4.8-3.9 8.4-8.8 8.4s-8.8-3.6-8.8-8.4z" fill="${P.ketchup}"/>
<path d="M5.6 13.2a2.1 2.1 0 0 1 2.3-2.2 2.4 2.4 0 0 1 3.1-2.3 2.6 2.6 0 0 1 4 .2 2.4 2.4 0 0 1 3.3 2.1 2.1 2.1 0 0 1 1.5 2.2z" fill="${P.mustardHi}"/>
<path d="M8.8 11.2c0-1.6.9-2.6 2-2.6M13.6 11.4c0-1.7.9-2.7 2-2.7" stroke="#D9A417" stroke-width="1.4"/>
<path d="M2.2 13.2h19.6" stroke-width="1.8"/>`,

  wave: `
<path d="M2.4 18.6C4 11 8.5 6.6 13.6 6.6c4.1 0 7 2.5 7 5.8 0 2.7-1.9 4.6-4.2 4.6-2.1 0-3.6-1.4-3.6-3.2 0-1.6 1.1-2.6 2.4-2.6.9 0 1.7.5 1.9 1.3-1.4-.3-2.3.5-2.3 1.4 0 1 .8 1.7 1.9 1.7 1.5 0 2.5-1.2 2.5-2.9 0-2.3-2.1-4.2-5.2-4.2-4.4 0-7.9 3.8-9.4 10.1z" fill="${P.water}"/>
<path d="M2 21c2.7-1.5 4.4 1 7.1-.4M11.9 20.6c2.7-1.5 4.4 1 7.1-.4" stroke="${P.waterHi}" stroke-width="1.7"/>`,

  /** Glass Shards. Angular on purpose — the deliberate opposite of the soft splatter
   *  language the wet weapons use.
   *
   *  **4/7**, misread as a paper airplane, a cursor and arrows. Three similar triangles of
   *  similar size at similar angles are read as a SET of arrows, because nothing tells the
   *  eye which one to look at. One dominant pane plus one chip fixes the hierarchy — and
   *  the pane must be CONCAVE. A convex quadrilateral reads as a kite or a flag whatever
   *  you fill it with (the first repair did, on render, before any judge saw it); a
   *  re-entrant vertex is the only thing in the drawing that says "this was broken off
   *  something" rather than "this was folded".
   *
   *  Then the concave pane rendered as a CURSOR, and the convex one before it as a kite —
   *  which between them say the real rule: any single four-or-more-sided pale shape gets
   *  read as one recognisable object, and the reader will find one. Three-sided pieces
   *  cannot be anything but pieces. So: three scalene triangles at three unrelated angles
   *  and three clearly different sizes. The earlier three-triangle draft failed only
   *  because its three were the same size and roughly parallel, which is an arrow set.
   *
   *  UNCHANGED in the end. Four redraws were built — one dominant pane, a concave pane, a
   *  scalene scatter, and two panes either side of a crack — and every one of them was
   *  read as a different single object (a kite, a cursor, an arrow, a torn sheet). On the
   *  low-variance arm the original was already **3/3** and the best redraw was 2/3. The
   *  "paper airplane / arrows" answers came only from the free-form arm, where naming
   *  loose pieces at 20px is hard for any drawing. Reverted; the failure was in the
   *  measurement's leniency, not in the glyph.
   *
   *  ── ⚠️ AND THAT 3/3 DID NOT HOLD. THREE MORE DRAFTS, ALL REVERTED. ────────
   *  Re-measured on the same forced-choice arm with three fresh judges: **0/3** —
   *  "an impact burst / explosion star" x2, "a sword slash" x1. On the both-families
   *  plate it collides with the UI `range` chip, which ships on the SAME character-select
   *  row as this glyph ("a double-headed arrow" / "two circling swap arrows" / "a back
   *  arrow", 3/3 wrong across two rounds). And in the other direction, `wrap` was named
   *  "glass shards" 3/3. **The number the previous revert was justified by is not
   *  reproducible**, which is worth more than the glyph: a per-icon score taken once and
   *  treated as durable is exactly the trap `docs/LESSONS.md` warns about.
   *
   *  Three further drafts were built and judged against this one on a single plate,
   *  three fresh judges, real 20px, the full 65-candidate list:
   *
   *      draft                                        what judges called it
   *      the shipped three triangles (control)        swap arrows x2, sparkle x1   0/3
   *      a big broken tumbler, V-notch rim            **a chef's hat x3**          0/3
   *      three co-directional clustered fragments     arrows x2, sparkle x1        0/3
   *      a small tumbler + a flying chip              chest, honey, party popper   0/3
   *
   *  **All four score 0/3, so nothing here beats the shipped art and every draft is
   *  reverted** — and the broken tumbler is strictly worse in KIND, because "a chef's
   *  hat" is a UI icon in the same registry, i.e. it traded an intra-family miss for a
   *  cross-family collision. `docs/DECISIONS-FOR-URI.md` §10's history holds: 8 of 14
   *  redraws measured worse, and this is now 3 more.
   *
   *  ⚠️ **The remaining move is not a drawing.** Every failure is the same failure and
   *  this file already wrote it down two paragraphs up — *"any single four-or-more-sided
   *  pale shape gets read as one recognisable object, and the reader will find one"* —
   *  and the conclusion drawn from it ("three-sided pieces cannot be anything but
   *  pieces") is falsified: a scatter of pale triangles is ALSO one recognisable object.
   *  It is an explosion, and two of them pointing apart is an arrow. Loose fragments have
   *  no silhouette of their own, which is what killed `mustardblast` and `cap`; both were
   *  fixed by drawing the OBJECT the weapon is about rather than the effect it produces
   *  (§32). Doing that here means changing what Glass Shards IS, and every object in that
   *  neighbourhood is taken: radial belongs to `burst`/`star`/`sparkle`/`swirl`/`gear`, a
   *  blue faceted crystal is the game's own premium CURRENCY (`gem` — the §32 defect in
   *  reverse), a cube is the four loot boxes, a disc is `cap`, a drop is `droplets`, and
   *  a vessel is a chef's hat 3/3 as measured above. **That is a design call, not a
   *  drawing one, and it is parked for Uri.**
   *
   *  ── ⚠️ RE-MEASURED AT THE SIZE IT ACTUALLY SHIPS AT. IT HOLDS, 6 OF 6. ──────
   *  Every round above was judged at **20 px, dark-on-cream**, because that is what the
   *  plate harness draws. `tools/tmp/ic_delivered.mjs` walked the real screens and that
   *  is not a condition this game has. Delivered, measured off the rendered DOM:
   *
   *      glyph    where it ships                     box        plate
   *      shards   `.chars-ability-em`, char select   23.2 px    WHITE, ink outline
   *      shards   `.hud-weapon-emoji`, match HUD     24-26 px   #EFEAF7, ink outline
   *      range    `.chars-fact`, char select         13.8 px    INK PILL, CREAM outline
   *
   *  So the plate drew `range` **56% too large with its polarity inverted**, and drew
   *  `shards` 14% too small. Re-run at those measured conditions, two independent
   *  three-judge panels, 65 forced-choice candidates:
   *
   *      shards -> "a double-headed arrow"   3/3 and 3/3   = **6 of 6**
   *      range  -> named correctly           3/3 and 3/3   = **6 of 6**
   *
   *  The collision is one-directional and total. It is not an artefact of the harness,
   *  it survives the correction, and it is the most reproducible result in the set.
   *  ⚠️ Note the two glyphs also ship IN THE SAME BOX: Water Bottle's Glass Shards pill
   *  carries this icon at 23.2 px and the `range` chip 40 px below it.
   *
   *  🚨 AND THE INSTRUMENT WAS SHOWN THE ANSWER FIRST. A control plate was rendered with
   *  `range`'s ARTWORK substituted into the `shards` tile — identical pixels under two
   *  names, a collision by construction. Judges named the forged tile "a double-headed
   *  arrow" 3/3: **exactly the same answer, at the same rate, as the real glyph.** To a
   *  blind reader at the delivered size, the shipped `shards` is indistinguishable from
   *  literally pasting the `range` icon into its place. The same control proves the
   *  method has teeth rather than crying collision at everything: forging `boxRed`'s art
   *  into `gift`'s tile produced a mutual `gift <-> boxRed` swap that does NOT appear on
   *  the real plate, where both score 3/3.
   *
   *  ⚠️ THE SHARPENED DIAGNOSIS, and it is narrower than "fragments have no silhouette".
   *  The two dominant fragments have apexes pointing in roughly OPPOSITE directions along
   *  one diagonal. That is not *like* a double-headed arrow; it is the construction of
   *  one. With the drafts above, all three arrangements are now measured: **opposed = a
   *  double arrow, co-directional = arrows, scattered = arrows.** A pale triangle is an
   *  arrowhead at every size and in every arrangement, so no rearrangement of triangles
   *  can pass. That is precisely why this stays a subject question and not a drawing one.
   *
   *  ⚠️ **AND DO NOT FIX IT FROM THE `range` SIDE.** It is the obvious move — `range` is
   *  the generic glyph and `shards` has eight failed drafts — and it is refused on the
   *  same measurement that refused the droplet-with-a-spin-arc for `cap` (§10): `range`
   *  scores **6/6**. Spending one of the set's strongest glyphs to repair one of its
   *  weakest has been tried in this file before and it cost both. */
  shards: `
<path d="M2.2 3.4 12.6 8.8 6.6 18.2z" fill="${P.ice}"/>
<path d="M15.2 2.6 22 11.4 13.4 13.6z" fill="${P.iceHi}"/>
<path d="M12.4 16 20.8 15.4 17 21.8z" fill="${P.ice}"/>`,

  /** Cap Shot.
   *
   *  Scored **1/7** — the worst icon in the set. It was a blue disc with a crimped rim
   *  and concentric fill, and every failure mode of that is radial: judges named it a
   *  cyclone (twice, swapping it with `swirl`), a gear (three times) and an onion. Making
   *  the crimps deeper does not help, because the defect is not the crimps — it is that a
   *  RADIALLY SYMMETRIC disc has no distinguishing mass at all, and three other icons in
   *  this set are also discs.
   *
   *  A first repair — a dome with deep teeth along the bottom — was rendered and rejected
   *  at real size before any judge saw it: it read as a JELLYFISH, which is the trap this
   *  file keeps falling into, i.e. fixing the stated fault (teeth too shallow) rather than
   *  the actual one (no distinguishing mass).
   *
   *  A cap ON THE BOTTLE NECK in side elevation came next — a T has an axis, which no gear
   *  or cyclone has. It scored **1/6**: a fluted blue block over a stub reads as a crate, a
   *  grill grate and bacon. Four drafts, and the honest reading of all four is that a
   *  bottle cap has no distinguishing mass at 20px; it is a small round object whose only
   *  feature is a rim too fine to survive.
   *
   *  So this one is drawn as the object it is when you can SEE it is a cap: three-quarter
   *  view, lying down, with a visible skirt. The top ellipse and the skirt together give it
   *  depth and an up-direction; the notches are cut into the skirt's silhouette at 2.8
   *  units rather than into a rim at 1.8; and the cream inset on the top face is a large
   *  mass rather than a ring, so it cannot read as concentric. If this still fails it is
   *  the icon to raise with Uri, because the remaining move is to change what it depicts.
   *
   *  ── IT DID STILL FAIL, IT WAS RAISED, AND URI ANSWERED "do it" ──────────────
   *  `DECISIONS-FOR-URI.md` §10/§30. That five-draft version measured **2/6** across two
   *  fresh blind plates (0/3 on the 28-icon food plate, 2/3 on the 65-icon cross-family
   *  plate) and its wrong answers were "a pot of honey", "water droplets", "an onion",
   *  "a play button triangle" — three of which are other icons in the same registry.
   *
   *  ⚠️ §10's PARKED RECOMMENDATION WAS A WATER DROPLET WITH A SPIN ARC, AND IT IS
   *  REFUSED HERE ON MEASUREMENT. Two reasons, both new since §10 was written:
   *   1. `rules.ts:1800-1807` — Cap Shot ships in Water Bottle's FOUR-SLOT BAR beside
   *      Water Spray, whose glyph is `droplets`. So the recommendation puts two droplets
   *      side by side in one bar, which is precisely the construction that collapsed
   *      `mustardblast`/`ketchupslip` from 7/7 + 4/7 to 1/6 + 1/6.
   *   2. It was BUILT AND RENDERED (a single fat droplet with a spin arc) and at 20px the
   *      arc vanished: the tile is a droplet. `droplets` currently scores **6/6** — the
   *      trade would spend one of the set's strongest glyphs to repair one of its weakest.
   *
   *  What ships instead is the cap IN FLIGHT, edge-on: a very flat disc (rx 8.4, ry 2.9 —
   *  aspect 2.9, against `coin`'s 1.3 and every other disc in the set) with a visible
   *  skirt, tilted 13°, plus two motion strokes. The flat horizontal LENS is the point.
   *  Every failed draft — face-on disc, ¾ crown, dome-with-teeth, cap-on-neck — kept the
   *  round mass that `coin`, `gear`, `slow`, `patty` and `lollipop` already own, and the
   *  measured misreads followed the mass every time. Nothing in either icon family is a
   *  flat lens, so this cannot swap into anything even when it is not named.
   *
   *  ⚠️ Judge this on SWAPS, not on the name. §10 pre-authorised "or accept 1/3": a bottle
   *  cap has no nameable mass at 20px and six drafts say so. What the four-slot bar
   *  actually needs is that it not read as one of its neighbours.
   *
   *  ── THE MOTION STROKES WERE BUILT, MEASURED AND REMOVED ─────────────────────
   *  The first flat-lens draft carried two short `waterHi` strokes off its trailing edge
   *  to say "in flight". Three blind judges named it **"a fish" 3 of 3** — a flat blue
   *  body with two small strokes off one end is a fish with a tail, and `fish` is in this
   *  same registry. That is strictly worse than the drawing it replaced, whose 0/3
   *  misreads at least scattered across three different subjects; a UNANIMOUS misread
   *  onto one neighbour is a swap forming, which is this file's oldest rule.
   *  Removed. The lens carries no appendage of any kind now, and the pale inset is a wide
   *  BAND rather than a small ellipse — the small ellipse was reading as an eye, which is
   *  the other half of what made a fish. Tilt is +9° rather than -13° for the same reason:
   *  a blue body angled down-left is a fish swimming.
   *  ⚠️ Do not add a motion mark back to this glyph. It has been tried and measured. */
  cap: `
<g transform="rotate(9 12 12.4)">
<ellipse cx="12" cy="15" rx="9.2" ry="3.2" fill="#12669E"/>
<path d="M2.8 12h18.4v3H2.8z" fill="#12669E" stroke="none"/>
<ellipse cx="12" cy="12" rx="9.2" ry="3.2" fill="${P.water}"/>
<ellipse cx="12" cy="11.8" rx="5.6" ry="1.5" fill="${P.iceHi}" stroke-width="1.3"/>
</g>`,

  /** Mustard Blast — the mirror of `ketchupslip`, on purpose: hot dog carries both, and a
   *  matched pair of squeeze bottles reads as one weapon FAMILY where two identically
   *  shaped droplets in different colours read as a mistake.
   *
   *  `ketchupslip` scored **7/7** and this scored **4/7**, named a paintbrush or a basting
   *  brush three times — and the only difference between them was that this one was rotated
   *  38°. So it was un-rotated into a true mirror of the icon that already worked, and
   *  **that made both of them worse: 7/7 and 4/7 became 1/6 and 1/6, swapping with each
   *  other twice.** Two squeeze bottles that differ only in chirality and hue are one icon
   *  drawn twice — hue is a tint at 20px, exactly as `docs/LESSONS.md` §6 says, and
   *  chirality is not a mass at all. This is the single most useful thing the confusion
   *  matrix found, because a bare count would have shown "no change" while one icon rose
   *  and its neighbour collapsed.
   *
   *  So the rotation is back, unchanged — it is the only thing stopping the pair being one
   *  shape. Replacing its thin zigzag emission with a fat splat was tried, to kill the
   *  "paintbrush" reading, and that made the swap WORSE (1+1 becomes 2+1) because ketchup's
   *  mark is also a splat. Reverted to the zigzag.
   *
   *  **This pair is the one unresolved defect in the set and it needs a decision, not
   *  another redraw.** Two squeeze bottles cannot be told apart at 20px by hue, chirality
   *  or emission shape; four attempts say so. The fix is to stop drawing two bottles — give
   *  Mustard Blast a different object (the hot dog itself, with a mustard stripe, is the
   *  obvious candidate) — and that changes what an icon DEPICTS, which is Uri's call rather
   *  than a drawing decision.
   *
   *  ── URI ANSWERED "do it" (DECISIONS-FOR-URI.md §30) ─────────────────────────
   *  The bottle scored **0/6** on two fresh blind plates — the worst glyph in either
   *  family, and worse than the 4/7 §10 recorded. It was named "a hammer or mallet" x3,
   *  "a sword slash", "a fish caught on a hook", "a chunk of meat on the bone". Note what
   *  that is NOT: it is no longer swapping with `ketchupslip` (3/3 and 2/3 in the same
   *  runs). The bottle stopped being confusable and became simply unreadable — a rotated
   *  bottle with a thin zigzag is a stick with a blob on it, and at 20px a stick with a
   *  blob on it is a mallet.
   *
   *  So: the hot dog itself. Three horizontal bands of maximally separated hue and value —
   *  tan bun, red-brown sausage, saturated mustard zigzag — in a silhouette nothing else
   *  in either family owns. The specific choices, each against a measured failure:
   *   * HORIZONTAL, and the only horizontal-elongated glyph in the set. `wrap` is the
   *     one neighbouring elongated mass and it sits at 45°; `wrap` was read as "a sword
   *     slash" 3/3 and "a hammer or mallet" 2/3 in these same runs, i.e. the diagonal bar
   *     is already spoken for.
   *   * The SAUSAGE PROTRUDES past the bun at both ends. `chick`'s lesson — a shape whose
   *     outline is broken by something sticking out past it cannot read as a plain blob.
   *   * The mustard is a ZIGZAG at 2.8 units, not a stripe. `slash`'s lesson: parallel
   *     repetition survives any pixel budget because it does not depend on resolving any
   *     one stroke. A straight stripe would be a 2.3px line and would vanish.
   *  ⚠️ It deliberately echoes Hot Dog's own face (`rules.ts`: "Sausage in a bun with a
   *  mustard zigzag"). That is a feature — the weapon bar's first slot showing the
   *  character's signature — and the two never share a screen at this size: portraits are
   *  round 3D renders on the roster, this is a flat glyph in the HUD. */
  /*  🔴 …AND THE PROTRUSION ABOVE WAS 1.5 PX. The intent was right and the number was
   *  never checked. WAS: `M7.2 11.4h9.6a4.3 4.3 0 0 1 0 8.6H7.2a4.3 4.3 0 0 1 0-8.6z`,
   *  a bun stadium spanning x 2.9..21.1 under a sausage stadium spanning x 1.3..22.7 —
   *  so "the sausage PROTRUDES past the bun at both ends" cleared it by **1.6 units,
   *  which at the delivered 22.72 px is 1.5 px**, i.e. one antialiased edge. What ships
   *  at that clearance is one wide two-tone horizontal lozenge, and `patty` is two
   *  stacked flat ellipses of identical width. Both native panels said so: "a grilled
   *  burger patty" x3 and x2.
   *
   *  ── ONE VARIABLE: THE BUN IS NARROWER. Paired, 73 tiles, 3 judges per protocol ──
   *      arm                                          native        magnified
   *      A  shipped, 1.6 units of clearance           0/3           2/3
   *         ("a grilled burger patty" x3)
   *      B  bun 2.9..21.1 -> 5.4..18.6, so the
   *         sausage clears it by 4.1 units = 3.9 px   **2/3  Δ +2**  2/3  Δ +0
   *  Nothing else moved: same sausage, same bun height, same zigzag, same colours.
   *  ⚠️ FLOOR: this round's twins were declared to BRACKET and did — `tomato` (legible)
   *  split 0 of 3, `gift` 1 of 3, `boxFire` (illegible) **3 of 3**. So ±1 of 3 is noise
   *  for a failing subject here and only the +2 clears it.
   *  ⚠️ WHERE THE CONFUSION WENT: REDUCED, not moved. "a grilled burger patty" went
   *  3 of 3 -> 1 of 3 and the freed judge answered CORRECTLY rather than picking a new
   *  neighbour — the first time this instrument has produced that. `patty` itself was
   *  unchanged on the plate and scored 1/3, so the answer was never taken from it.
   *  ⚠️ Δ +0 magnified, at 2/3 both ways: a judge that can resolve 1.5 px of clearance
   *  never had the defect. The gap between the two rows IS the defect.
   *
   *  ── ⚠️ AND THE ABSOLUTE DID NOT HOLD, WHICH IS RECORDED RATHER THAN EXPLAINED AWAY ──
   *  On the r13 plate this glyph — the SHIPPED, post-fix art, unchanged by one byte —
   *  scored **0/3 native, "a grilled burger patty" x2** and "a rolled burrito" x1. That
   *  is the same wrong answer the +2 was bought to remove, from a fresh panel four days
   *  later, as a distractor rather than a subject.
   *  It does NOT retract the +2: a paired Δ inside one round is exact, and 0/3 here is an
   *  ABSOLUTE from a different round, which `ic_pair.mjs`'s own header measured as
   *  swinging the full range on byte-identical art (24 of 63 icons moved by >=1 of 3
   *  across two panels). But it is the fourth glyph in this file to show it, and it means
   *  the honest claim for `mustardblast` is *"the narrow bun beat the wide bun by 2 of 3
   *  on one plate"* and NOT *"the patty collision is fixed"*. If it is ever a subject
   *  again, the paired arm to run against is the shipped one, not the retired one. */
  mustardblast: `
<path d="M9.7 11.4h4.6a4.3 4.3 0 0 1 0 8.6H9.7a4.3 4.3 0 0 1 0-8.6z" fill="#E8B15C"/>
<path d="M5 6.6h14a3.7 3.7 0 0 1 0 7.4H5a3.7 3.7 0 0 1 0-7.4z" fill="#C2452F"/>
<path d="M5.6 12 9 8.8 12.4 12 15.8 8.8 19.2 12" stroke="${P.mustard}" stroke-width="2.8"/>`,

  /** Ketchup Slip. A round red mass is just Tomato Toss with its leaf removed, which
   *  a blind legibility test duly confused. A squeeze bottle with a squirt is a
   *  silhouette nothing else in the set owns. */
  ketchupslip: `
<path d="M4.6 8.6h7.6a2.1 2.1 0 0 1 2.1 2.1v8.6a2.1 2.1 0 0 1-2.1 2.1H4.6a2.1 2.1 0 0 1-2.1-2.1v-8.6a2.1 2.1 0 0 1 2.1-2.1z" fill="${P.tomato}"/>
<path d="M6.6 3.2h3.6v5.4H6.6z" fill="${P.tomato}"/>
<path d="M7.2 1.4h2.4v1.9H7.2z" fill="#9E1B27"/>
<path d="M3.4 12.4h10" stroke="${P.cream}" stroke-width="2"/>
<path d="M18.4 8.6c2.4 0 3.6 1.5 3.4 3-.2 1.4-1.5 1.4-1.5 2.6 0 1.4-1.5 2.3-2.8 1.7-1.2-.6-2.4.3-3-.9-.6-1.2.3-1.9-.3-3 -.6-1.2.6-2.4 2-2.4 1 0 1.2-1 2.2-1z" fill="${P.tomato}"/>`,

  /** Bun Slash. Steel rather than gold: hot dog's other two weapons are mustard and
   *  ketchup, so a gold crescent sat in the same colour channel as the mustard blast one
   *  slot away.
   *
   *  Three drafts of ONE crescent all failed for the same reason and it took the confusion
   *  matrix to see it: round 2's plain crescent was called a banana, and round 3's chisel-
   *  pointed crescent with two trailing streaks scored **4/7** and was called a feather or
   *  a quill twice. A single tapered curved mass with a line down it IS a quill — adding
   *  detail to it could only ever make a better quill.
   *
   *  So there is no single mass any more. Three parallel tapered strokes are the universal
   *  slash mark, and "parallel repetition" is a cue that survives any pixel budget because
   *  it does not depend on resolving any one stroke.
   *
   *  ...and the three-stroke version measured **3/3 to 2/3** on the low-variance arm, i.e.
   *  worse than the crescent it replaced. The quill/feather answers were free-form only,
   *  and once the scorer stopped counting "claw slash mark" and "scratch marks" as wrong —
   *  which they plainly are not, for a glyph whose job is to say *slash* — most of the
   *  free-form gap closed too. Reverted.
   *
   *  ── DIAGNOSED, NOT REDRAWN. THE MECHANISM IS CONTRAST, AND IT IS MEASURABLE. ──
   *  This glyph has sat at 1/3, 1/3, 0/3 across three native panels with no named cause.
   *  It has one: **it is white on white.** WCAG contrast of each element against this
   *  glyph's own delivered plate, rgb(255,255,255):
   *      `P.steel` #DCD6E8 crescent      **1.42:1**
   *      `P.white` #FFFFFF highlight     **1.00:1**  ← literally invisible, and it is
   *                                                     2.2 units wide across the mass
   *      #9C93B0 trailing strokes         2.91:1
   *  So at 22.72 px on white the only things a reader gets are the ink OUTLINE of the
   *  crescent and two thin grey strokes — a set of thin curved lines with no mass at all.
   *  That predicts the misreads exactly, and they are what three panels gave: swirl,
   *  "a breaking wave" x2, "glass shards" x2, "seaweed" x2. **Every one of those is
   *  another set of curved marks**, and which one is free varies by round, which is why
   *  this reads as an unstable legibility failure rather than a collision.
   *  → The fix is a VALUE, not another silhouette: this is the one glyph in the set whose
   *    main mass is lighter than its plate. `CLAUDE.md` also has warm chroma as the scarce
   *    budget right now, and steel is the coldest thing in the palette. Untested.
   *
   *  ── 🔴 IT WAS TESTED. THE VALUE FIX IS A REVERT, AND THE PREMISE WAS ALSO WRONG ──
   *  The paragraph above is kept verbatim because every number in it is a correct pixel
   *  measurement — and it is `docs/LESSONS.md` §6b in its purest form so far: **a probe told
   *  me what was broken and did not tell me that fixing it was what the viewer reacts to.**
   *  Paired, 70 tiles, seed 53, twins tomato/gift/stun, 3 native + 3 magnified judges:
   *
   *      arm                                            native            magnified
   *      A  shipped: steel 1.42:1, white highlight
   *         1.00:1, #9C93B0 trail 2.91:1               **3/3**            3/3
   *      B  the MASS gets a value — crescent and trail
   *         both #5B2E8C, 1.42 -> 9.48:1, geometry
   *         byte-identical, the invisible white
   *         highlight deleted                          1/3  **Δ -2**      3/3  Δ +0
   *         wrong: "a lettuce leaf" x2
   *      C  the CONTROL — mass untouched at 1.42:1, the
   *         invisible highlight made as loud as it can
   *         be (#FFFFFF -> #5B2E8C at 2.2u, 6.70:1 on
   *         the steel), same trail as B                2/3  Δ -1          3/3  Δ +0
   *
   *  🚨 AND THE PREMISE — "0/3 across three native panels" — DID NOT REPRODUCE. Identical
   *  art, three native rounds: **1/3 (r8), 0/3 (r9), 3/3 (r10).** That is the full range on
   *  byte-identical artwork, the same swing `ic_pair.mjs`'s header measured across 24 of 63
   *  icons, and it means the standing story that this glyph "sits at 0/3 with no named
   *  cause" was one reading repeated. ⚠️ Nor is A's 3/3 a claim that this glyph is fine:
   *  `swirl`, `wave` and `shards` were ALL 0/3 in this round and churning among each other,
   *  so "a sword slash" was uncontested. **The paired Δ is exact; the absolute is not.**
   *
   *  ── WHY MASS MAKES IT WORSE, WHICH IS THE REUSABLE PART ────────────────────
   *  A SLASH IS A MARK, NOT AN OBJECT. Filling the crescent turns a motion mark into a
   *  solid tapered blade with two veins beside it, and that is a leaf. This is not the
   *  wrong answer being dumped somewhere free: `lettuce` scored 3/3 on the same plate, so
   *  three judges who had already named the real leaf still preferred "a lettuce leaf" for
   *  the filled arm. And C, which is half the mass change, took half the loss.
   *  ⚠️ So "SILHOUETTE BEATS INTERIOR DETAIL" — true for `slow`, `timer` and `chest` — has a
   *  boundary: it applies to glyphs that depict an OBJECT. For a glyph that depicts an
   *  ACTION, the thin open outline IS the reading, and giving it mass names it as a thing.
   *  Both arms reverted. Do not spend the next variable on this glyph's value or its
   *  interior; if it is spent at all, it belongs on the TRAIL, which is the only part of
   *  this drawing that says "motion" rather than "shape".
   *
   *  ── 🔴 THE TRAIL WAS SPENT AT r13 AND IT IS WORTH NOTHING. THE SENTENCE ABOVE IS
   *     NOW ANSWERED RATHER THAN OUTSTANDING. ────────────────────────────────────
   *  Two one-variable arms, seed 23, twins bracketing at both protocols:
   *      A  shipped                              0/3 native   1/3 magnified
   *      D  INK BUDGET — the 1.00:1 white
   *         highlight DELETED, nothing else      0/3  Δ +0     2/3  Δ +1 (floor 1)
   *      E  THE TRAIL ALONE — #9C93B0 -> #5B2E8C,
   *         2.91:1 -> 9.48:1, geometry identical  0/3  Δ +0     1/3  Δ +0
   *  [E] is the one that settles something. Recolouring the trail was the ONE component
   *  [B] and [C] shared, so it was the standing suspect for carrying part of their loss.
   *  **Alone it is worth exactly zero**, which means [B]'s -2 and [C]'s -1 belong to the
   *  CRESCENT — where this note already put them. `coin`'s ink-budget move ([D]) is also
   *  worth zero here, so the invisible highlight was neither helping nor hurting.
   *  ⚠️ THE ABSOLUTE ACROSS FOUR INDEPENDENT NATIVE PANELS ON BYTE-IDENTICAL ART IS NOW
   *  **1/3 (r8), 0/3 (r9), 3/3 (r10), 0/3 (r13)** — the full range, twice over.
   *  ⚠️ AND THE REUSABLE PART IS A FIELD PROPERTY, NOT A DRAWING ONE. In r13 `shards`
   *  itself scored **0/3** (a fish / a breaking wave / swap arrows), so "glass shards"
   *  was UNCLAIMED and all three slash tiles took it — [E] unanimously. In r10, where
   *  slash scored 3/3, it was `swirl`/`wave`/`shards` that were churning instead.
   *  **`slash`, `shards`, `swirl` and `wave` are one pool of curved-mark answers, and
   *  which of them scores is largely which of them got there first.** That is why five
   *  arms on this glyph have produced four Δ +0s and two reverts and no gain, and it is
   *  an argument for changing what one of the FOUR depicts rather than redrawing this
   *  one a sixth time. Do not spend another variable on `slash` alone. */
  slash: `
<path d="M2.4 21.6C2 9 9 2 21.6 2.4 15 8 11 12 2.4 21.6z" fill="${P.steel}"/>
<path d="M20.4 3.6C13.4 7.4 8.2 12.4 4.4 18.8" stroke="${P.white}" stroke-width="2.2"/>
<path d="M8.6 21.4c3.4-2.8 6.2-5.6 8.4-8.6M14.4 21.6c2.4-2 4.4-4 6-6.2" stroke="#9C93B0" stroke-width="1.8"/>`,

  /** Burrito Disc — he throws himself, so this is a rolled wrap in flight.
   *
   *  **2/7.** The old draft was a slim rounded bar at 45° with two hairline fold marks, and
   *  every wrong answer was another slim rounded bar: a pencil, a skewer, a baguette, a
   *  bread stick, a mallet. Aspect ratio was the whole defect — 4.6 units thick over 16
   *  long. It is now 7.6 over 15 (1:2 rather than 1:3.5, and a pencil is never that fat),
   *  and half of it is FOIL in a cool grey against the warm tortilla. That value-and-hue
   *  split across the long axis is the bold mass; the fold lines are secondary and are
   *  allowed to disappear.
   *
   *  The first attempt at that made it a PILL: a fat two-tone bar with a straight split
   *  across the middle and two rounded ends is a capsule, exactly. Two changes take it
   *  back — and neither was enough. A fat rounded bar with a straight seam across it is a
   *  capsule no matter which way the seam leans; it rendered as a pill twice.
   *
   *  Standing it up under a torn foil band rendered as a GHOST, and a tapered truncated
   *  cone — the version that finally got a blind judge to write "burrito" — measured
   *  **3/3 down to 1/3** on the low-variance arm, swapping with `meat` and then with
   *  `ketchupslip`. Three redraws, all worse. Reverted.
   *
   *  Standing note for whoever picks this up: the original scores fine when each tile is
   *  judged on its own and poorly when judges are asked to *name* it, which is the
   *  signature of a glyph that is DISTINCT but not DESCRIPTIVE. That is a real weakness and
   *  it is not fixed here; it is also not worth another silhouette, because the silhouette
   *  is not what is failing.
   *
   *  ── 🔴 THAT LAST SENTENCE IS NOW FALSIFIED, AND SO IS ITS REPLACEMENT. ────────
   *  Two independent native panels named this glyph **"a sword" 3 of 3**, i.e. `damage`,
   *  which ships in the same fact rows. It is a ONE-WAY COLLISION, not the legibility
   *  failure recorded above: `damage` is a pale steel bar running SW->NE with a red-wrapped
   *  grip at its SW end, and this is a pale cream bar running SW->NE with a gold stub
   *  BEYOND its NE end — same axis, same direction, same pale-on-white value, and the stub
   *  is exactly where a pommel goes. Three earlier redraws all kept the 45 degrees.
   *  Paired, 73 tiles, 3 judges per protocol, twins bracketed (`boxFire` illegible split
   *  3 of 3 native, so the native floor for a failing subject is 1):
   *
   *      arm                                    native                    magnified
   *      A  shipped                             0/3  "a sword" x3         3/3
   *      C  SAME 45-degree bar, the same gold
   *         foil moved from a stub past the
   *         upper end to a BAND across the
   *         middle                              0/3  "a sword" x3  Δ +0   3/3  Δ +0
   *      B  the diagonal LOST — upright, warm
   *         tan, folded flap, lettuce ruffle    0/3  Δ +0                 **0/3  Δ -3**
   *
   *  🔴 C IS THE CONTROL AND IT SETTLES THE CAUSE: with the hilt removed and the axis
   *  kept, the sword answer is UNANIMOUS AND UNCHANGED. With the axis removed, it is
   *  GONE — zero of three. **The 45-degree diagonal is the sword; the foil position is
   *  not.** That is the transferable result of this pass and it is exact and paired.
   *
   *  ⚠️ AND B IS STILL A REVERT, DECISIVELY, because losing the collision is not the
   *  same as gaining the read. B's native misreads were "an onion" x2 + "a chunk of meat
   *  on the bone" x1, and MAGNIFIED it was **"a pot of honey" 3 of 3** against 3/3 for
   *  both diagonal arms. Both wrong answers are the same object and both are shipped
   *  icons: `onion` is a pale vertical ovoid with a GREEN SPROUT ON TOP and `honey` is a
   *  vertical vessel with a lid — so an upright tan mass with a green ruffle spilling out
   *  of its top is one of those two at every acuity. **The lettuce, which was added to
   *  break the silhouette, is what named it.** A -3 at the protocol that can actually see
   *  the drawing is a strictly worse drawing, whatever the native row says.
   *  → The next arm is upright WITHOUT anything green on top: the outline break has to
   *    come from the tortilla itself (an open spiral end), not from a garnish that two
   *    neighbours already own. Do NOT re-test the mid-band; C answered it.
   *
   *  ── 🚨 r13 RAN BOTH REMAINING VARIABLES AND CLOSED ALL THREE AXES. NOTHING SHIPS,
   *     AND WHAT IS LEFT IS NOT A DRAWING DECISION. ───────────────────────────────
   *      A  shipped                            0/3 native (shards/hammer/sword)  1/3 mag
   *      D  THE OTHER DIAGONAL — byte-identical
   *         art mirrored about x=12, so the bar
   *         runs NW-SE and `damage` runs NE-SW  0/3  Δ +0   **"a sword slash" x3**  1/3 +0
   *      G  THE VALUE — tortilla #EFE0C4 (1.30:1
   *         against its own white plate) and
   *         foil exchange roles, -> #E2A94E
   *         (2.10:1). Geometry untouched.       0/3  Δ +0                          1/3 +0
   *
   *  🔴 [D] SHARPENS `7f71f20`'s FINDING AND MAKES IT WORSE. Mirrored onto the opposite
   *  diagonal the glyph did not stop being a blade — it changed WHICH blade, from
   *  `damage` ("a sword", 1 of 3 on the shipped arm) to `slash` ("a sword slash", **3 of
   *  3, unanimous**). So "the 45 degree diagonal IS the sword" was too specific: **it is
   *  not the sword's diagonal, it is ANY diagonal.** A pale elongated bar at 45 degrees
   *  is a bladed-weapon gesture and this set already ships two of those. A scattered
   *  wrong answer becoming a unanimous one is the confusion CONCENTRATING, which is the
   *  exact opposite of what `mustardblast`'s fix did, so [D] is a revert on kind even at
   *  Δ +0 on score.
   *  🔴 [G] IS A PERFECT NULL, AND STRONGER THAN ITS Δ: all three native judges gave [A]
   *  and [G] the SAME answer as each other — shards / hammer / sword, in that order —
   *  across artwork differing in 4.02% of plate pixels. `a77ff30` measured colour at Δ 0
   *  on `boxBurger`; this repeats it with the WRONG ANSWERS held fixed too.
   *  🔴 AND THE UPRIGHT FAMILY IS CLOSED BY ARITHMETIC, NOT BY A JUDGE. The arm this note
   *  asked for above — upright, nothing green, an open mouth instead of a folded flap —
   *  was drawn, and so was a 22-degree leaning version of it. **Both render as a GOLD TIN
   *  CAN** and were rejected before any judge saw them (`shots/ic/d13/big.png`, tiles 6
   *  and 10, beside `honey` at tile 12). The reason is the same one that killed `candy`'s
   *  concave twists: at 22.72 px the inherited outline is 1.7 units, so an upright tube
   *  delivers two heavy vertical ink rails plus a heavy ink ellipse at the top, and that
   *  IS a cylinder — the mouth is indistinguishable from a rim whatever angle it is cut
   *  at, and leaning it only leans the can.
   *  → **All three axes are now spent: 45 degrees is a blade, EITHER way; upright is a
   *    vessel; horizontal is `mustardblast` and `patty`.** Four redraws, a mirror and a
   *    colourway have all returned Δ +0. This is the same place `boxBurger` and `stun`
   *    reached, and it has the same answer: the remaining move is a SUBJECT change, which
   *    is Uri's call (`DECISIONS-FOR-URI` §30 is the precedent — the mustard bottle became
   *    a hot dog and gained +2). Do not spend a seventh variable on the drawing.
   *  ⚠️ CAVEAT ON THE ABSOLUTE, NOT ON THE PAIRED Δ: `damage` scored 0/3 in this round
   *  ("seaweed" x2) and `slash` 0/3, so both blade answers were unclaimed and every wrap
   *  tile could take one. The Δs are exact; "a sword" being available is a property of
   *  this plate. */
  wrap: `
<path d="M4.4 17.6 15.6 6.4a4.4 4.4 0 0 1 3.6 3.6L8 21.2a4.4 4.4 0 0 1-3.6-3.6z" fill="#EFE0C4"/>
<path d="M15.6 6.4a4.4 4.4 0 0 1 3.6 3.6l2.8-2.8a4.4 4.4 0 0 0-3.6-3.6z" fill="#E9B44C"/>
<path d="M8.4 13.6 11.2 16.4M11.6 10.4 14.4 13.2" stroke="#CBB289" stroke-width="1.8"/>`,

  lollipop: `
<path d="M12 21.4v-6.6" stroke-width="2.3"/>
<circle cx="12" cy="9" r="6.3" fill="${P.candy}"/>
<path d="M12 9a2.1 2.1 0 1 0 2.1 2.1c0-2.3-2.3-3.7-4.6-2.9" stroke="${P.cream}" stroke-width="1.9"/>`,

  /** The fill is a warm off-white, NOT `P.cream`: cream is exactly the weapon slot's
   *  own plate colour, and round 1 shipped a cream egg on a cream plate that a blind
   *  legibility test read as an empty slot. Anything light that lands in the weapon
   *  bar needs its own value edge.
   *
   *  UNCHANGED, and the reason is a caveat about the INSTRUMENT rather than about the art.
   *  One round had this **0/3 at native size, named "a gold coin" x3** — a cross-family
   *  leak from a weapon glyph onto the primary currency, and the cause looked obvious: a
   *  symmetric ellipse whose right half is a whole value darker is a struck coin seen
   *  edge-lit. A true OVOID (1:1.44, narrow at the top) with the shading moved to a
   *  bottom crescent was drawn and measured paired, twin floor 0 of 9:
   *  **3/3 -> 3/3 magnified, 3/3 -> 3/3 native, Δ +0 at both.**
   *
   *  ⚠️ THE SHIPPED EGG SCORED 3/3 ON THAT PLATE, so the defect did not reproduce and the
   *  Δ is measured against a ceiling. The likely reason is worth writing down because it
   *  is a property of the harness: that plate also carried a REDRAWN COIN that is
   *  unmistakably a coin. In a forced-choice round, "a gold coin" is only available as a
   *  wrong answer while no tile has claimed it. **A paired plate cancels the judge, not
   *  the plate's own composition** — putting several subjects on one plate can remove a
   *  wrong answer from circulation. Re-measure `egg` on a plate whose coin is unchanged
   *  before concluding anything about it. */
  egg: `
<ellipse cx="12" cy="13.1" rx="6.7" ry="8.3" fill="#E4CFA6"/>
<path d="M12 4.8a6.7 8.3 0 0 1 0 16.6z" fill="#C9AE7C" stroke="none"/>
<ellipse cx="12" cy="13.1" rx="6.7" ry="8.3" fill="none"/>
<path d="M8.4 15.4a3.6 3.6 0 0 0 1.9 3.8" stroke="#FFF8EA" stroke-width="2"/>`,

  /** Sticky Trail. Round 2's jar read as a beehive or a basket; the open-topped pot that
   *  replaced it scored **2/7** and was named a bowl of noodles, a cup, a paper bag and a
   *  popcorn box — because an open-topped vessel is exactly what `rice` and `noodle` are,
   *  and this set cannot afford three of them.
   *
   *  So it is closed now. A LID wider than the neck is the one silhouette feature no bowl
   *  can have, and it sits at the top of the grid where nothing occludes it. The drip runs
   *  down the outside, which is still the statement of the ability (something left
   *  behind), and it now reads against the jar rather than against the rim.
   *
   *  ── DIAGNOSED, NOT REDRAWN, AND THE DIAGNOSIS IS "IT IS NOT ACTUALLY FAILING". ──
   *  Listed as a reproducing failure at 1/3, 1/3; a third native panel put it at **2/3**.
   *  Pooled over three panels its answers are: correct x4, `chest` x2, `patty` x1,
   *  `cap` x1, `dough` x1 — mid-table, and unstable in the way that means nobody is
   *  colliding with it. The one repeat is worth writing down because it points at a
   *  glyph that IS failing: **honey -> `chest` twice**, and both are a rounded container
   *  with a horizontal light band across the middle. `chest` is 0/3 on every arm ever
   *  drawn (see `ui.ts`), so the shared reading is that glyph's problem, not this one's.
   *  ⚠️ One measurement to keep for whoever does redraw it: `P.mustardHi` #FFDD6B is
   *  **1.33:1 against this glyph's white plate** and 2.22:1 against the #C98A00 jar. The
   *  belly band and the drip are therefore interior-only marks — the drip's protrusion
   *  past the jar is carried by ink alone. Do not spend a variable on either of them
   *  expecting the silhouette to change. */
  honey: `
<path d="M5.4 3.4h13.2v3.4H5.4z" fill="${P.gold}"/>
<path d="M8.2 6.6h7.6v2.6H8.2z" fill="#C98A00"/>
<path d="M6.6 9c-.9 2.6-1.3 4.9-1.3 7 0 3.3 2.2 5.2 6.7 5.2s6.7-1.9 6.7-5.2c0-2.1-.4-4.4-1.3-7z" fill="#C98A00"/>
<path d="M6.6 12.8h10.8v3.6H6.6z" fill="${P.mustardHi}" stroke-width="1.4"/>
<path d="M18.3 9.2c1.7 2.4 2.5 4.2 2.5 5.5 0 1.5-.9 2.5-2.2 2.5s-2.2-1-2.2-2.5c0-1.3.6-3 1.9-5.5z" fill="${P.mustardHi}"/>`,
};
