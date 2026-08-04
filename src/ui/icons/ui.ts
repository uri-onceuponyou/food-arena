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
 *  Emoji made them four unrelated objects (a burger, a pineapple, a gift, a flame). */
function box(front: string, lid: string, band: string, emblem = ''): string {
  return `
<path d="M3.4 9.4h17.2v9.4a1.7 1.7 0 0 1-1.7 1.7H5.1a1.7 1.7 0 0 1-1.7-1.7z" fill="${front}"/>
<path d="M3.4 9.4 6.6 5.6h10.8l3.2 3.8z" fill="${lid}"/>
<path d="M10.2 5.6h3.6v14.9h-3.6z" fill="${band}" stroke-width="1.3"/>
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
  coin: `
<ellipse cx="12" cy="14.2" rx="9" ry="7" fill="#7F4E00"/>
<ellipse cx="12" cy="11.2" rx="9" ry="7" fill="#D98200"/>
<ellipse cx="12" cy="11.2" rx="5.9" ry="4.4" fill="#FFEFC0" stroke-width="1.4"/>
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
