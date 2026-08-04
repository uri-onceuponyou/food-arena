/**
 * The bespoke-SFX registry: `${characterId}.${weaponKey} -> WeaponSfx`.
 *
 * Structured exactly like `src/vfx/weapons/index.ts`, for the same reason: one file
 * per character means N agents can author N voices in parallel and the only file any
 * of them shares is this one, where each adds a single import and a single spread.
 *
 * `getWeaponSfx()` returns `undefined` for every weapon with no bespoke entry — which
 * today is most of the roster — and `director.ts` falls back to the generic
 * cast/impact in `audio/sounds.ts`. That fallback is a finished sound, so an
 * unconverted character is fully playable and fully audible; converting it is a
 * quality upgrade, never a bug fix.
 *
 * ── Converted so far ────────────────────────────────────────────────────────────
 * Three, chosen to be maximally far apart in the sound space so the system's ability
 * to express identity is actually demonstrated rather than asserted:
 *   `soup`   wet, low, resonant, steaming
 *   `pizza`  a spinning plate — real amplitude modulation on the throw
 *   `taco`   brittle — a cloud of discrete high-frequency grains
 *
 * Remaining: burrito, donut, egg, hamburger, hotdog, lollipop, sushi, waterbottle.
 * `donut`, `hamburger`, `lollipop` and `waterbottle` already have bespoke VFX under
 * `src/vfx/weapons/` whose header comments name each weapon's physical identity —
 * start there, per the authoring pattern in `./types.ts`.
 */

import type { CharacterId } from '../../game/rules';
import type { CharacterWeaponSfxMap, WeaponSfx, WeaponSfxKey } from './types';

import { soupWeaponSfx } from './soup';
import { pizzaWeaponSfx } from './pizza';
import { tacoWeaponSfx } from './taco';

function namespaced(
  characterId: CharacterId,
  entries: CharacterWeaponSfxMap,
): Partial<Record<WeaponSfxKey, WeaponSfx>> {
  const out: Partial<Record<WeaponSfxKey, WeaponSfx>> = {};
  for (const [weaponKey, sfx] of Object.entries(entries)) {
    if (sfx) out[`${characterId}.${weaponKey}`] = sfx;
  }
  return out;
}

const REGISTRY: Partial<Record<WeaponSfxKey, WeaponSfx>> = {
  ...namespaced('soup', soupWeaponSfx),
  ...namespaced('pizza', pizzaWeaponSfx),
  ...namespaced('taco', tacoWeaponSfx),
};

/** Look up a bespoke voice. `undefined` means "use the generic sound". */
export function getWeaponSfx(characterId: CharacterId, weaponKey: string): WeaponSfx | undefined {
  return REGISTRY[`${characterId}.${weaponKey}` as WeaponSfxKey];
}

/** Every registered key. Used by the probe to enumerate what must be proven audible,
 * so a newly added voice cannot be forgotten by the verification pass. */
export function registeredSfxKeys(): string[] {
  return Object.keys(REGISTRY);
}
