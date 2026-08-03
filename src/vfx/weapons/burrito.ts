/**
 * Burrito weapon VFX — owned exclusively by whichever agent is assigned this file.
 *
 * Weapon keys available (`game/rules.ts` -> `CHARACTERS.burrito.weapons`):
 * `'Disc'` (Burrito Disc — ranged, self-thrown-disc), `'Roll'` (Roll Stun — melee,
 * stun), `'Swarm'` (Topping Swarm — ranged, 4-pellet homing spread).
 *
 * Add one entry per weapon key you want to give bespoke VFX, implementing only the
 * `WeaponVfx` hooks (`projectile` / `trail` / `impact` / `cast`) that weapon actually
 * needs — see `types.ts` for the full contract, and `hamburger.ts` /
 * `waterbottle.ts` in this same directory for two complete worked examples
 * (`hamburger.Tomato`, `waterbottle.Glass`).
 *
 * This file is currently an empty, valid stub: every Burrito weapon falls back to
 * `game/vfx.ts`'s generic projectile/impact/cast effects exactly as before.
 */

import type { CharacterWeaponVfxMap } from './types';

export const burritoWeaponVfx: CharacterWeaponVfxMap = {};
