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
   *  next pass does not spend the same budget again. */
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
   *  a bow tie. */
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
   *  measurement's leniency, not in the glyph. */
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
   *  the icon to raise with Uri, because the remaining move is to change what it depicts. */
  cap: `
<path d="M3.4 9h17.2v5.6L18.4 17.8 16.2 14.6 14 17.8 11.8 14.6 9.6 17.8 7.4 14.6 5.2 17.8 3.4 14.6z" fill="${P.water}"/>
<ellipse cx="12" cy="9" rx="8.6" ry="4.6" fill="${P.water}"/>
<ellipse cx="12" cy="8.8" rx="4.4" ry="2.3" fill="${P.iceHi}" stroke-width="1.4"/>`,

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
   *  than a drawing decision. */
  mustardblast: `
<g transform="rotate(38 13 14)">
<path d="M10 8.8h7.4a2.1 2.1 0 0 1 2.1 2.1v8.4a2.1 2.1 0 0 1-2.1 2.1H10a2.1 2.1 0 0 1-2.1-2.1v-8.4A2.1 2.1 0 0 1 10 8.8z" fill="${P.mustard}"/>
<path d="M11.9 3.4h3.6v5.4h-3.6z" fill="${P.mustard}"/>
<path d="M12.5 1.6h2.4v1.9h-2.4z" fill="#C98A00"/>
<path d="M8.8 12.6h9.8" stroke="${P.ink}" stroke-width="2"/>
</g>
<path d="M2 8.2 5.4 6.4 2.6 4 6.2 2.2" stroke="${P.mustard}" stroke-width="2.4"/>`,

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
   *  free-form gap closed too. Reverted. */
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
   *  is not what is failing. */
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
   *  bar needs its own value edge. */
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
   *  behind), and it now reads against the jar rather than against the rim. */
  honey: `
<path d="M5.4 3.4h13.2v3.4H5.4z" fill="${P.gold}"/>
<path d="M8.2 6.6h7.6v2.6H8.2z" fill="#C98A00"/>
<path d="M6.6 9c-.9 2.6-1.3 4.9-1.3 7 0 3.3 2.2 5.2 6.7 5.2s6.7-1.9 6.7-5.2c0-2.1-.4-4.4-1.3-7z" fill="#C98A00"/>
<path d="M6.6 12.8h10.8v3.6H6.6z" fill="${P.mustardHi}" stroke-width="1.4"/>
<path d="M18.3 9.2c1.7 2.4 2.5 4.2 2.5 5.5 0 1.5-.9 2.5-2.2 2.5s-2.2-1-2.2-2.5c0-1.3.6-3 1.9-5.5z" fill="${P.mustardHi}"/>`,
};
