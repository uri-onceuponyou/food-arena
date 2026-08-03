/**
 * Donut weapon VFX — owned exclusively by whichever agent is assigned this file.
 *
 * Weapon keys available (`game/rules.ts` -> `CHARACTERS.donut.weapons`): `'Candy'`
 * (Candy Barrage — ranged, 3-pellet fanned spread, speeds/damages up while standing
 * on Donut's own Sticky Trail).
 *
 * Add one entry per weapon key you want to give bespoke VFX, implementing only the
 * `WeaponVfx` hooks (`projectile` / `trail` / `impact` / `cast`) that weapon actually
 * needs — see `types.ts` for the full contract, and `hamburger.ts` /
 * `waterbottle.ts` in this same directory for two complete worked examples
 * (`hamburger.Tomato`, `waterbottle.Glass`).
 *
 * This file is currently an empty, valid stub: every Donut weapon falls back to
 * `game/vfx.ts`'s generic projectile/impact/cast effects exactly as before.
 */

import type { CharacterWeaponVfxMap } from './types';

export const donutWeaponVfx: CharacterWeaponVfxMap = {};
