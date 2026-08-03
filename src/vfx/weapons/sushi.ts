/**
 * Sushi weapon VFX — owned exclusively by whichever agent is assigned this file.
 *
 * Weapon keys available (`game/rules.ts` -> `CHARACTERS.sushi.weapons`): `'Rice'`
 * (Rice Spray — ranged, 5-pellet spread), `'Seaweed'` (Seaweed Bait — ranged, slow),
 * `'Fish'` (Fish Pile — melee, wide 150° cone), `'Catch'` (Big Catch — ranged,
 * 3-pellet homing spread, special).
 *
 * Add one entry per weapon key you want to give bespoke VFX, implementing only the
 * `WeaponVfx` hooks (`projectile` / `trail` / `impact` / `cast`) that weapon actually
 * needs — see `types.ts` for the full contract, and `hamburger.ts` /
 * `waterbottle.ts` in this same directory for two complete worked examples
 * (`hamburger.Tomato`, `waterbottle.Glass`).
 *
 * This file is currently an empty, valid stub: every Sushi weapon falls back to
 * `game/vfx.ts`'s generic projectile/impact/cast effects exactly as before.
 */

import type { CharacterWeaponVfxMap } from './types';

export const sushiWeaponVfx: CharacterWeaponVfxMap = {};
