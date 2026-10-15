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

/**
 * WEAPON COLOURS THAT WERE A CHARACTER'S OLD IDENTITY, re-keyed for EFFECTS only.
 *
 * `rules.ts` gives every weapon one `color` and every consumer reads it: the VFX, the HUD's
 * damage numbers (`match.ts:colorForDamageSource`), the screen flash. Most are INGREDIENTS and
 * stay right whoever is on screen — a tomato is red. Two characters' weapons instead carried the
 * character's pre-C1a BODY colour, so after C1a they draw an identity the fighter no longer has:
 *
 *   donut  `#FF6FA5` Ring Spin / Candy Barrage — the old glaze pink, i.e. the FLOOR's own hue,
 *          which is exactly why C1a moved the donut to violet; `#FFF3DE` Glaze Bomb — the glaze.
 *   egg    `#FFF8EA` Egg Tackle — the old egg white; `#F4E9DA` Shell Shards — the old shell.
 *          The shell is robin's-egg teal now (`SHELL #33AFAF`).
 *
 * Re-keyed HERE rather than in `rules.ts` because `rules.ts` is not this owner's, and because a
 * weapon colour also drives HUD numbers that have their own legibility rules (light, over the
 * whole arena). ⚠️ So the HUD half is NOT re-keyed by this — routed in V1's report.
 *
 * Effect values are LIGHT versions of the signature hue: a transient must clear the cast's luma
 * UPWARD (`vfx.ts` hue contract rule 1), and nothing may sit in BLOCKING violet 258–268 (rule 4)
 * — `#C48CFF` is HSL 269, `#EFDBFF` 273.
 */
const IDENTITY_REKEY: Readonly<Partial<Record<CharacterId, Readonly<Record<string, string>>>>> = {
  donut: { '#FF6FA5': '#C48CFF', '#FFF3DE': '#EFDBFF' },
  egg: { '#FFF8EA': '#9BE9E4', '#F4E9DA': '#7FD6D3' },
};

/** The colour an effect of `characterId`'s should draw for a weapon colour `hex`. */
export function effectColor(characterId: CharacterId | undefined, hex: string): string {
  if (!characterId) return hex;
  const table = IDENTITY_REKEY[characterId];
  return table?.[hex.toUpperCase()] ?? hex;
}
