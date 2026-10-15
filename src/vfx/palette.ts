/**
 * THE CAST'S SIGNATURE COLOURS, AS THE VFX LAYER KEYS THEM.
 *
 * Graphics campaign C1a (`f0de367`) re-keyed every character from pastel to one saturated
 * signature hue on its largest top-visible mass, and named it beside a `Signature hue:` line in
 * each `src/characters/<id>.ts`. Effects tied to a CHARACTER (rather than to an ingredient — a
 * tomato toss stays tomato red whoever throws it) were still keyed to the old pastels: Donut's
 * Sticky Trail drew from a per-SLOT palette (slot 0 rose `#F5475E`, whoever sat there), and
 * Donut's own glaze effects were pink `#FF6FA5` — the floor's hue, which is exactly why C1a moved
 * the donut to violet.
 *
 * ⚠️ COPIED AS DATA, NOT IMPORTED. `src/characters/**` has another owner (C1b, in the same wave),
 * and an effect should not change colour because a character file renamed or re-valued a PART
 * constant. The hex is the signature constant each file names today; if a character's signature
 * hue moves, this table is the one place the effects follow it.
 */

import type { CharacterId } from '../game/rules';

export const VFX_SIGNATURE: Readonly<Record<CharacterId, string>> = {
  hotdog: '#D63D26',      // SAUSAGE — red ~8°
  sushi: '#EE672C',       // SALMON — salmon ~18°
  hamburger: '#D36A15',   // BUN — orange ~30°
  pizza: '#BD7F15',       // CRUST — golden orange ~35°
  taco: '#BA9400',        // SHELL — corn gold ~45°
  soup: '#8A8107',        // BROTH — gold broth ~46° (the bowl is blue; seen from above it is broth)
  burrito: '#5E9222',     // RICE (guacamole) — green
  lollipop: '#48B990',    // CANDY_WHITE — mint-teal ~160°
  egg: '#33AFAF',         // SHELL — robin's-egg teal-blue ~185°
  waterbottle: '#388AE9', // WATER — blue ~212°
  donut: '#A65FE5',       // GLAZE — violet ~270° (was glaze pink #FF9EC4, the floor's own hue)
};
