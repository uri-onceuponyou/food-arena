/**
 * Lollipop weapon VFX — owned exclusively by whichever agent is assigned this file.
 *
 * Weapon keys available (`game/rules.ts` -> `CHARACTERS.lollipop.weapons`):
 * `'Smash'` (Lollipop Smash — melee), `'Giant'` (Giant Lollipop — melee, 360° cone,
 * `giantSlam: true`; this is Lollipop's ultimate, and `game/vfx.ts` already layers a
 * dedicated racing-shockwave/flash on top of the generic melee-arc sweep for it via
 * `spawnGiantSlamShockwave` — that call site is untouched by this system, so a
 * `cast`/`impact` hook here would ADD to, not replace, that shockwave).
 *
 * Neither Lollipop weapon is a `ranged` projectile, so `projectile`/`trail` hooks
 * have nothing to attach to for this character — `cast`/`impact` are the relevant
 * hooks here.
 *
 * Add one entry per weapon key you want to give bespoke VFX, implementing only the
 * `WeaponVfx` hooks that weapon actually needs — see `types.ts` for the full
 * contract, and `hamburger.ts` / `waterbottle.ts` in this same directory for two
 * complete worked examples (`hamburger.Tomato`, `waterbottle.Glass`).
 *
 * This file is currently an empty, valid stub: every Lollipop weapon falls back to
 * `game/vfx.ts`'s generic impact/cast effects exactly as before.
 */

import type { CharacterWeaponVfxMap } from './types';

export const lollipopWeaponVfx: CharacterWeaponVfxMap = {};
