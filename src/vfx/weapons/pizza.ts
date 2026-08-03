/**
 * Pizza weapon VFX — owned exclusively by whichever agent is assigned this file.
 *
 * Weapon keys available (`game/rules.ts` -> `CHARACTERS.pizza.weapons`): `'Dough'`
 * (Dough Balls — ranged, slow), `'Tomato'` (Tomato Splat — ranged, `splatter: true`;
 * NOTE this is a DIFFERENT weapon from `hamburger.Tomato` despite the shared key —
 * the registry namespaces by `${characterId}.${weaponKey}` specifically so these
 * never collide, and Pizza's tomato can look different from Hamburger's if you want
 * it to), `'Cheese'` (Cheese Blind — ranged, stun).
 *
 * Add one entry per weapon key you want to give bespoke VFX, implementing only the
 * `WeaponVfx` hooks (`projectile` / `trail` / `impact` / `cast`) that weapon actually
 * needs — see `types.ts` for the full contract, and `hamburger.ts` /
 * `waterbottle.ts` in this same directory for two complete worked examples
 * (`hamburger.Tomato`, `waterbottle.Glass`).
 *
 * This file is currently an empty, valid stub: every Pizza weapon falls back to
 * `game/vfx.ts`'s generic projectile/impact/cast effects exactly as before.
 */

import type { CharacterWeaponVfxMap } from './types';

export const pizzaWeaponVfx: CharacterWeaponVfxMap = {};
