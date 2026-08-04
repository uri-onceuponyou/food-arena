/**
 * The bespoke-SFX registry: `${characterId}.${weaponKey} -> WeaponSfx`.
 *
 * Structured exactly like `src/vfx/weapons/index.ts`, for the same reason: one file
 * per character means N agents can author N voices in parallel and the only file any
 * of them shares is this one, where each adds a single import and a single spread.
 *
 * `getWeaponSfx()` returns `undefined` for every weapon with no bespoke entry, and
 * `director.ts` falls back to the generic cast/impact in `audio/sounds.ts`. That
 * fallback is a finished sound, so an unconverted weapon is fully playable and fully
 * audible; converting it is a quality upgrade, never a bug fix.
 *
 * ── ALL ELEVEN CHARACTERS ARE CONVERTED (2026-08-04) ────────────────────────────
 *
 * They were not, and that single fact was most of Uri's complaint that the SFX are
 * *"very shallow and similar"*. Three characters had voices; the other EIGHT fell
 * through to the same generic catalogue entry, so the majority of the roster was
 * genuinely playing the same sound. No amount of synthesis work fixes that — it is an
 * authoring gap, and closing it is the entire "similar" half of the problem.
 *
 * ── The separation axes, and why they are not all "brightness" ──────────────────
 *
 * Eleven characters cannot be told apart on one dimension. Each owns a POSITION on
 * the spectral-centroid ladder AND a DEVICE that nobody else uses, so two characters
 * that happen to sit near each other in brightness are still separated by something
 * the ear resolves independently. `--mode identity` prints the full 11x11 pairwise
 * separation table and fails if any pair converges.
 *
 * | character     | ladder     | device nobody else uses                          |
 * |---------------|------------|--------------------------------------------------|
 * | `hamburger`   | darkest    | 24 dB/oct damping + the shortest decays           |
 * | `hotdog`      | low-mid    | a NON-MONOTONIC pitch contour (a squeeze), + a CLAP |
 * | `pizza`       | mid-low    | real amplitude modulation at the disc's spin rate |
 * | `soup`        | mid        | upward-chirping droplets + a steam tail           |
 * | `waterbottle` | mid-high   | a damped hollow CAVITY (modal, irrational, short) |
 * | `egg`         | high-mid   | a GAP — crack, silence, then spill                |
 * | `burrito`     | high-mid   | a grain cloud whose band WALKS (`freqShift`)      |
 * | `taco`        | high       | a dense cloud of discrete broadband transients    |
 * | `donut`       | high       | near-harmonic modal RINGING, plus echoes          |
 * | `sushi`       | brightest- | a NARROW high-Q resonance that stops dead         |
 * | `lollipop`    | brightest  | RING MODULATION — genuinely inharmonic partials   |
 *
 * The two pairs that share a rung are deliberately the two pairs separated hardest on
 * the second axis: Taco vs Sushi are both bright and are opposite in spectral
 * FLATNESS (noise vs near-pitch), and Donut vs Lollipop are both resonant and are
 * opposite in HARMONICITY (near-integer ratios vs ring-modulated inharmonic ones).
 * Both of those contrasts are asserted, not asserted-to-taste.
 */

import type { CharacterId } from '../../game/rules';
import type { CharacterWeaponSfxMap, WeaponSfx, WeaponSfxKey } from './types';

import { burritoWeaponSfx } from './burrito';
import { donutWeaponSfx } from './donut';
import { eggWeaponSfx } from './egg';
import { hamburgerWeaponSfx } from './hamburger';
import { hotdogWeaponSfx } from './hotdog';
import { lollipopWeaponSfx } from './lollipop';
import { pizzaWeaponSfx } from './pizza';
import { soupWeaponSfx } from './soup';
import { sushiWeaponSfx } from './sushi';
import { tacoWeaponSfx } from './taco';
import { waterbottleWeaponSfx } from './waterbottle';

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
  ...namespaced('burrito', burritoWeaponSfx),
  ...namespaced('donut', donutWeaponSfx),
  ...namespaced('egg', eggWeaponSfx),
  ...namespaced('hamburger', hamburgerWeaponSfx),
  ...namespaced('hotdog', hotdogWeaponSfx),
  ...namespaced('lollipop', lollipopWeaponSfx),
  ...namespaced('pizza', pizzaWeaponSfx),
  ...namespaced('soup', soupWeaponSfx),
  ...namespaced('sushi', sushiWeaponSfx),
  ...namespaced('taco', tacoWeaponSfx),
  ...namespaced('waterbottle', waterbottleWeaponSfx),
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
