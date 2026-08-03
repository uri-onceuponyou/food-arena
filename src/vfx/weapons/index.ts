/**
 * The bespoke-VFX registry: `${characterId}.${weaponKey} -> WeaponVfx`.
 *
 * Every character owns exactly one file under this directory. That file-per-
 * character split is the whole point: eleven agents can each author their
 * character's weapon VFX in parallel without ever touching a file another agent
 * owns — the only shared file is this one, and the only edit it ever needs for a
 * NEW character is the two lines (import + spread) that character's own agent adds
 * for itself.
 *
 * `getWeaponVfx()` is the only export `game/vfx.ts` calls into this module for. It
 * returns `undefined` for any weapon with no bespoke entry — including every hook of
 * every weapon in every still-empty character file — and every caller in
 * `game/vfx.ts` falls back to the existing generic effect in that case. See
 * `types.ts` for the `WeaponVfx` contract itself.
 */

import type { CharacterId } from '../../game/rules';
import type { CharacterWeaponVfxMap, WeaponVfx, WeaponVfxKey } from './types';

import { hamburgerWeaponVfx } from './hamburger';
import { donutWeaponVfx } from './donut';
import { tacoWeaponVfx } from './taco';
import { burritoWeaponVfx } from './burrito';
import { eggWeaponVfx } from './egg';
import { lollipopWeaponVfx } from './lollipop';
import { pizzaWeaponVfx } from './pizza';
import { sushiWeaponVfx } from './sushi';
import { soupWeaponVfx } from './soup';
import { waterbottleWeaponVfx } from './waterbottle';
import { hotdogWeaponVfx } from './hotdog';

function namespaced(characterId: CharacterId, entries: CharacterWeaponVfxMap): Partial<Record<WeaponVfxKey, WeaponVfx>> {
  const out: Partial<Record<WeaponVfxKey, WeaponVfx>> = {};
  for (const [weaponKey, vfx] of Object.entries(entries)) {
    if (vfx) out[`${characterId}.${weaponKey}`] = vfx;
  }
  return out;
}

const REGISTRY: Partial<Record<WeaponVfxKey, WeaponVfx>> = {
  ...namespaced('hamburger', hamburgerWeaponVfx),
  ...namespaced('donut', donutWeaponVfx),
  ...namespaced('taco', tacoWeaponVfx),
  ...namespaced('burrito', burritoWeaponVfx),
  ...namespaced('egg', eggWeaponVfx),
  ...namespaced('lollipop', lollipopWeaponVfx),
  ...namespaced('pizza', pizzaWeaponVfx),
  ...namespaced('sushi', sushiWeaponVfx),
  ...namespaced('soup', soupWeaponVfx),
  ...namespaced('waterbottle', waterbottleWeaponVfx),
  ...namespaced('hotdog', hotdogWeaponVfx),
};

/** Look up bespoke VFX for one weapon. Returns `undefined` when this weapon (or this
 * whole character) has no entry yet — the standard "no bespoke VFX, use the generic
 * path" signal every spawn site in `game/vfx.ts` checks for. */
export function getWeaponVfx(characterId: CharacterId, weaponKey: string): WeaponVfx | undefined {
  return REGISTRY[`${characterId}.${weaponKey}` as WeaponVfxKey];
}
