/**
 * Soup weapon VFX — owned exclusively by whichever agent is assigned this file.
 *
 * Weapon keys available (`game/rules.ts` -> `CHARACTERS.soup.weapons`): `'Splash'`
 * (Soup Splash — ranged, 3-pellet spread), `'Noodle'` (Noodle Toss — ranged, slow),
 * `'Dump'` (Soup Dump — melee, 90° cone, slow, special).
 *
 * Add one entry per weapon key you want to give bespoke VFX, implementing only the
 * `WeaponVfx` hooks (`projectile` / `trail` / `impact` / `cast`) that weapon actually
 * needs — see `types.ts` for the full contract, and `hamburger.ts` /
 * `waterbottle.ts` in this same directory for two complete worked examples
 * (`hamburger.Tomato`, `waterbottle.Glass`).
 *
 * This file is currently an empty, valid stub: every Soup weapon falls back to
 * `game/vfx.ts`'s generic projectile/impact/cast effects exactly as before.
 */

import type { CharacterWeaponVfxMap } from './types';

export const soupWeaponVfx: CharacterWeaponVfxMap = {};
