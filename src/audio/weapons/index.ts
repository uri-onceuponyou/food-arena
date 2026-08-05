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
 * Measured after the roster-wide top-end pass (mean of 6 seeds per weapon, mean over a
 * character's weapons). Every rung moved UP, because the mix measurement said the whole
 * game lived in 80-650 Hz; the ORDER moved in two places and both are consequences of
 * that pass rather than of taste, noted below.
 *
 * | character     | ladder    | device nobody else uses                           | its top end |
 * |---------------|-----------|---------------------------------------------------|-------------|
 * | `hamburger`   |   936 Hz  | 24 dB/oct damping + the shortest decays            | grease sizzle (a band, never grains) |
 * | `pizza`       |  1791 Hz  | real amplitude modulation at the disc's spin rate  | flour puff / SPLASH / sticky peel |
 * | `hotdog`      |  2072 Hz  | a NON-MONOTONIC pitch contour (a squeeze), + a CLAP | condiment jet + bread crumb |
 * | `soup`        |  2414 Hz  | upward-chirping droplets + a steam tail            | FINER droplets, an octave and a half up |
 * | `egg`         |  2705 Hz  | a GAP — crack, silence, then spill                 | shell air, an open 24 dB/oct corner |
 * | `waterbottle` |  3092 Hz  | a damped hollow CAVITY (modal, irrational, short)  | an atomiser + pitched plastic/glass |
 * | `burrito`     |  3639 Hz  | a grain cloud whose band WALKS (`freqShift`)       | foil crinkle to 11 kHz |
 * | `taco`        |  4151 Hz  | a dense cloud of discrete broadband transients     | shell DUST — a wash, not a cloud |
 * | `donut`       |  4701 Hz  | near-harmonic modal RINGING, plus echoes           | sugar glaze — PITCHED (`glint()`) |
 * | `sushi`       |  5526 Hz  | a NARROW high-Q resonance that stops dead          | a third blade resonance, TONAL |
 * | `lollipop`    |  6335 Hz  | RING MODULATION — genuinely inharmonic partials    | candy shards to 14 kHz + a shiver |
 *
 * Closest pair **1.121x** against a 1.08x floor (was 1.096x) and the span **6.77x** (was
 * 6.60x): a roster-wide pass is the only kind that can IMPROVE a relative ladder, because
 * it is the only one that can move both sides of a tight pair.
 *
 * TWO ORDERS CHANGED, and neither is a preference:
 *   * **Pizza moved above Hotdog.** Uri asked for a splash when a tomato hits, by name.
 *     `pizza.Tomato`'s impact went 1267 -> 2683 Hz, which is most of Pizza's mean, and a
 *     bursting tomato IS brighter than mustard hitting a wall.
 *   * **Soup moved above... nothing, but Egg moved above Soup**, which is the same
 *     statement: a cracking shell has more top end than hot broth, and it took the pass
 *     for either of them to have any.
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
