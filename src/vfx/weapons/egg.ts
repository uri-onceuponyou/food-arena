/**
 * Egg weapon VFX — owned exclusively by whichever agent is assigned this file.
 *
 * Weapon keys available (`game/rules.ts` -> `CHARACTERS.egg.weapons`): `'Tackle'`
 * (Egg Tackle — melee), `'Hatch'` (Hatch! — homing ranged that arrives and pecks
 * repeatedly in place; see `Projectile.arrived`/`peckTimer` in `game/state.ts` if a
 * `trail()` hook wants to react to the "landed and pecking" phase differently from
 * "still flying"), `'Shards'` (Shell Shards — ranged, 3-pellet spread, slow).
 *
 * Add one entry per weapon key you want to give bespoke VFX, implementing only the
 * `WeaponVfx` hooks (`projectile` / `trail` / `impact` / `cast`) that weapon actually
 * needs — see `types.ts` for the full contract, and `hamburger.ts` /
 * `waterbottle.ts` in this same directory for two complete worked examples
 * (`hamburger.Tomato`, `waterbottle.Glass`).
 *
 * This file is currently an empty, valid stub: every Egg weapon falls back to
 * `game/vfx.ts`'s generic projectile/impact/cast effects exactly as before.
 */

import type { CharacterWeaponVfxMap } from './types';

export const eggWeaponVfx: CharacterWeaponVfxMap = {};
