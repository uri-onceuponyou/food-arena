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

export const FOOD_ICONS: Record<string, string> = {
  /** Patty Smash. A grilled disc seen slightly from above: the visible edge is what
   *  stops it reading as a flat brown circle. */
  patty: `
<ellipse cx="12" cy="14.3" rx="8.5" ry="4.5" fill="${P.pattyDark}"/>
<ellipse cx="12" cy="11.5" rx="8.5" ry="4.5" fill="${P.patty}"/>
<path d="M6.8 10.4 10 12.3M10.9 9.2 14.1 11.1M15.2 10.1 17.8 11.6" stroke="${P.pattyDark}" stroke-width="1.5"/>`,

  /** Filling Toss. The BONE is the whole icon: without it a brown blob is
   *  indistinguishable from the brown disc above, and hamburger and taco both carry a
   *  brown weapon. */
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
   *  object, because the ability is the burrito spinning rather than a thing thrown. */
  swirl: `
<circle cx="12" cy="12" r="9" fill="${P.waterHi}"/>
<path d="M16.9 8.1c-2.7-2.5-7-1.7-8.7 1.4-1.3 2.5-.2 5.4 2.5 6.2 2.1.6 4.1-.6 4.5-2.5.3-1.5-.6-2.9-2.1-3.1-1-.2-2 .4-2.3 1.4" stroke="${P.cream}" stroke-width="2.1"/>`,

  /** Hatch!
   *
   *  TWO independent blind legibility tests failed this icon, and both named the same
   *  cause: a chick AND its shell is two objects, and two objects do not fit in 26px —
   *  they merged into one dark arch with a blob in it. So the shell is gone and the
   *  chick fills the whole grid. One subject, three features (eyes, beak, tuft). */
  chick: `
<path d="M12 3.6V1.6M9 4.2 7.8 2.4M15 4.2 16.2 2.4" stroke-width="1.7"/>
<circle cx="12" cy="12.4" r="8.3" fill="${P.mustardHi}"/>
<circle cx="9.4" cy="10.6" r="1.5" fill="${P.ink}" stroke="none"/>
<circle cx="14.6" cy="10.6" r="1.5" fill="${P.ink}" stroke="none"/>
<path d="M12 12.8 16.8 15.2 12 17.6z" fill="${P.gold}" stroke-width="1.4"/>`,

  /** Shell Shards / Double Toss — a generic impact star, correct for both. */
  burst: `<path d="${starPath(9, 10.2, 4.6)}" fill="${P.gold}"/>
<path d="${starPath(9, 5.6, 2.4)}" fill="${P.mustardHi}" stroke-width="1.3"/>`,

  /** Lollipop Smash. Round 1's head spanned the full grid and read as a plain T-bar;
   *  a narrower, deeper head with a visible striking face reads as a mallet. */
  hammer: `
<path d="M5.2 3.4h13.6a1.7 1.7 0 0 1 1.7 1.7v4.4a1.7 1.7 0 0 1-1.7 1.7H5.2a1.7 1.7 0 0 1-1.7-1.7V5.1a1.7 1.7 0 0 1 1.7-1.7z" fill="#C9B8DE"/>
<path d="M16.2 3.6v7.4" stroke-width="1.4"/>
<path d="M10.1 11h3.8v10.2h-3.8z" fill="${P.patty}"/>`,

  /** Dough Balls. */
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

  rice: `
<path d="M3.2 11.4h17.6c0 4.9-3.9 8.6-8.8 8.6s-8.8-3.7-8.8-8.6z" fill="${P.waterHi}"/>
<path d="M5.4 11.4a2.2 2.2 0 0 1 2.8-2 2.4 2.4 0 0 1 3.8-1.6 2.4 2.4 0 0 1 3.8 1.6 2.2 2.2 0 0 1 2.8 2z" fill="${P.white}"/>
<path d="M2.2 11.4h19.6" stroke-width="1.7"/>`,

  seaweed: `
<path d="M12 21.6V6" stroke="#2E6B3A" stroke-width="2.3"/>
<path d="M11.8 10c-4.6 0-7-2.6-7-6.8 4.6 0 7 2.6 7 6.8z" fill="#3E8B4A"/>
<path d="M12.2 15.4c4.6 0 7-2.6 7-6.8-4.6 0-7 2.6-7 6.8z" fill="#4E9B5A"/>
<path d="M11.8 20.8c-4.6 0-7-2.6-7-6.8 4.6 0 7 2.6 7 6.8z" fill="#3E8B4A"/>`,

  fish: `
<path d="M2.4 12.2c2.1-4 5.6-6.1 9.7-6.1 3.5 0 6 1.7 7.3 4.2-1.3 4.8-4.4 7.9-9 7.9-3.5 0-6-2.1-8-6z" fill="${P.water}"/>
<path d="M18.9 10.1 22.4 7v10.2l-3.5-3.4z" fill="${P.waterHi}"/>
<circle cx="7.1" cy="10.7" r="1.2" fill="${P.ink}" stroke="none"/>`,

  /** Big Catch. Fewer, fatter spines plus a tail — round 1's 13 even spikes read as a
   *  sun, which is the failure mode of any regular star. */
  /** Big Catch.
   *
   *  Sushi carries Fish Pile and Big Catch in the SAME four-slot bar, so these two
   *  cannot be one silhouette in two colours. Two spiky-ball drafts were both read as
   *  a SUN by two different blind tests — a radially symmetric spiked disc always is.
   *  So this is the ability rather than the animal: a fish on a hook. The line and
   *  barb above the body are the separator, and they are not hue. */
  puffer: `
<path d="M16.4 1.8v4.4a3.2 3.2 0 0 1-5.4 2.3" stroke-width="2"/>
<path d="M2.4 13.6c1.9-4.1 5.4-6.3 9.5-6.3 3.6 0 6.2 1.7 7.5 4.3-1.3 4.9-4.5 8.1-9.2 8.1-3.7 0-6.2-2.1-8.2-6.1z" fill="${P.gold}"/>
<path d="M19 11.8 22.4 8.6v8.8l-3.4-3z" fill="${P.mustard}"/>
<circle cx="6.8" cy="12.3" r="1.3" fill="${P.ink}" stroke="none"/>`,

  droplets: `
<path d="M8.4 20.6a4.9 4.9 0 0 1-4.9-4.9c0-2.9 4.9-8.4 4.9-8.4s4.9 5.5 4.9 8.4a4.9 4.9 0 0 1-4.9 4.9z" fill="${P.water}"/>
<path d="M17.6 13.6a3.3 3.3 0 0 1-3.3-3.3c0-2 3.3-5.7 3.3-5.7s3.3 3.7 3.3 5.7a3.3 3.3 0 0 1-3.3 3.3z" fill="${P.waterHi}"/>`,

  noodle: `
<path d="M3.2 11.2h17.6c0 4.9-3.9 8.7-8.8 8.7s-8.8-3.8-8.8-8.7z" fill="${P.ketchup}"/>
<path d="M2.2 11.2h19.6" stroke-width="1.7"/>
<path d="M4.8 11.2a2.1 2.1 0 0 1 2.3-2.2 2.4 2.4 0 0 1 3.1-2.4 2.6 2.6 0 0 1 4 .2 2.4 2.4 0 0 1 3.3 2.2 2.1 2.1 0 0 1 1.7 2.2z" fill="${P.mustardHi}"/>
<path d="M8.4 9.2c0-1.6.9-2.6 2-2.6M13.4 9.4c0-1.7.9-2.7 2-2.7" stroke="#D9A417" stroke-width="1.4"/>`,

  wave: `
<path d="M2.4 18.6C4 11 8.5 6.6 13.6 6.6c4.1 0 7 2.5 7 5.8 0 2.7-1.9 4.6-4.2 4.6-2.1 0-3.6-1.4-3.6-3.2 0-1.6 1.1-2.6 2.4-2.6.9 0 1.7.5 1.9 1.3-1.4-.3-2.3.5-2.3 1.4 0 1 .8 1.7 1.9 1.7 1.5 0 2.5-1.2 2.5-2.9 0-2.3-2.1-4.2-5.2-4.2-4.4 0-7.9 3.8-9.4 10.1z" fill="${P.water}"/>
<path d="M2 21c2.7-1.5 4.4 1 7.1-.4M11.9 20.6c2.7-1.5 4.4 1 7.1-.4" stroke="${P.waterHi}" stroke-width="1.7"/>`,

  /** Glass Shards. Angular on purpose — it is the deliberate opposite of the soft
   *  splatter language the wet weapons use. */
  shards: `
<path d="M2.2 3.4 12.6 8.8 6.6 18.2z" fill="${P.ice}"/>
<path d="M15.2 2.6 22 11.4 13.4 13.6z" fill="${P.iceHi}"/>
<path d="M12.4 16 20.8 15.4 17 21.8z" fill="${P.ice}"/>`,

  /** Cap Shot. Eight deep crimps, not fourteen shallow ones: at 26px a fine rim fills
   *  in and the whole thing reverts to a plain blue disc, which then collides with
   *  Roll Stun's cyclone. */
  cap: `<path d="${starPath(12, 9.8, 7.6)}" fill="${P.water}"/>
<circle cx="12" cy="12" r="7.3" fill="${P.water}"/>
<circle cx="12" cy="12" r="4.4" fill="${P.iceHi}" stroke-width="1.3"/>
<path d="M9.4 10a3.6 3.6 0 0 1 2-1.4" stroke="${P.white}" stroke-width="1.5"/>`,

  /** Mustard Blast — the mirror of `ketchupslip`, on purpose: hot dog carries both,
   *  and a matched pair of squeeze bottles reads as one weapon FAMILY where two
   *  identically-shaped droplets in different colours read as a mistake. */
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

  /** Bun Slash. A slash ARC, kept visually distinct from the crossed-swords `damage`
   *  annotation used on stat rows, which is a label rather than an ability. */
  /** Bun Slash. Steel rather than gold: hot dog's other two weapons are mustard and
   *  ketchup, so a gold crescent sat in the same colour channel as the mustard blast
   *  one slot away. */
  /** Bun Slash. Round 2's plain crescent was read as a banana, so the blade now has a
   *  hard chisel point at each end and two trailing streaks — the streaks are what
   *  say MOTION rather than FRUIT. */
  slash: `
<path d="M2.4 21.6C2 9 9 2 21.6 2.4 15 8 11 12 2.4 21.6z" fill="${P.steel}"/>
<path d="M20.4 3.6C13.4 7.4 8.2 12.4 4.4 18.8" stroke="${P.white}" stroke-width="2.2"/>
<path d="M8.6 21.4c3.4-2.8 6.2-5.6 8.4-8.6M14.4 21.6c2.4-2 4.4-4 6-6.2" stroke="#9C93B0" stroke-width="1.8"/>`,

  /** Burrito Disc — he throws himself, so this is a rolled wrap in flight, seen end-on
   *  so the spiral of the roll is what identifies it. */
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

  /** Sticky Trail. Round 2's jar was read as a beehive or a basket. A pot with honey
   *  visibly pouring OVER the rim states the ability (a trail left behind) as well as
   *  the substance, and the overflow tongue is a silhouette nothing else owns. */
  honey: `
<path d="M5.6 10.2h10.8l-.8 8.6a2.2 2.2 0 0 1-2.2 2H8.6a2.2 2.2 0 0 1-2.2-2z" fill="#C98A00"/>
<path d="M4 6.6h14v3.8H4z" fill="${P.gold}"/>
<path d="M16.4 10.4c0 4 .8 5.8 2.3 5.8s2.3-1.7 2.3-4c0-1.7-.8-3.3-2.3-5.6z" fill="${P.mustardHi}"/>
<circle cx="18.9" cy="19.8" r="1.9" fill="${P.mustardHi}"/>`,
};
