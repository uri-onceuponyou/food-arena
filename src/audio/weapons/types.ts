/**
 * Per-weapon SFX contract — the authoring surface for giving a weapon its own voice.
 *
 * This is a deliberate mirror of `src/vfx/weapons/types.ts`, hook for hook and
 * ownership boundary for ownership boundary, because the two systems have the same
 * shape of problem and the same shape of solution: a generic recipe that works for
 * everything, plus one file per character that can override it, plus one registry
 * file that is the only thing anybody shares.
 *
 * ── THE AUTHORING PATTERN (read this before adding a character) ─────────────────
 *
 * 1. Create `src/audio/weapons/<characterId>.ts` exporting
 *    `export const <characterId>WeaponSfx: CharacterWeaponSfxMap = { ... }`, keyed by
 *    the SHORT `Weapon.key` from `game/rules.ts` (`'Splash'`, `'Tomato'`, ...) — NOT
 *    prefixed with the character id; `index.ts` namespaces it centrally.
 * 2. Implement only the hooks that weapon actually needs. An omitted hook falls back
 *    to `audio/sounds.ts`'s generic cast/impact, which is a complete shipped sound,
 *    not a placeholder. An empty map is a legal, working file.
 * 3. Add two lines to `index.ts` (import + spread). That is the only shared edit, and
 *    it is the same two lines `vfx/weapons/index.ts` needs.
 * 4. **Match the VFX that already exists.** Seven characters have bespoke VFX under
 *    `src/vfx/weapons/`, and each of those files opens with a paragraph naming that
 *    weapon's physical identity — a soup splash spreads and steams, a pizza slice is
 *    a flat spinning plate, a taco shell breaks into brittle fragments. That
 *    paragraph is the sound design brief. Audio and VFX disagreeing about what an
 *    object IS is worse than either being plain.
 * 5. **Then prove it.** Add the weapon to `tools/audio-probe.mjs`'s catalogue table
 *    with the acceptance numbers you expect (RMS floor, duration, spectral centroid
 *    band) and run it. A hook that is registered but silent is the single most likely
 *    way to fail here, and it is invisible without a measurement.
 *
 * ── What makes a voice distinct ─────────────────────────────────────────────────
 * Not loudness, and not EQ alone. The three worked examples separate along axes the
 * ear resolves independently, and each is measurable:
 *   * `soup.ts`   — LOW spectral centroid, upward-chirping droplets, a steam tail.
 *   * `pizza.ts`  — a whoosh with real amplitude modulation on it (the disc spins).
 *   * `taco.ts`   — HIGH spectral centroid built from a cloud of discrete grains.
 * Pick an axis before you pick a filter frequency.
 */

import type { CharacterId, Weapon } from '../../game/rules';
import type { SynthCtx } from '../synth';

/** Everything a weapon hook gets. `SynthCtx` (ctx/dest/when/rng) plus the same
 * gameplay facts `vfx/weapons` hooks receive, so the two layers key off identical
 * inputs — notably `weapon`, which is the live `rules.ts` object and must never be
 * mutated. */
export interface WeaponSfxCtx extends SynthCtx {
  /** `Weapon.color` from `rules.ts`. Rarely useful to a sound directly, but present
   * so a voice CAN key off the same single source of truth the VFX does. */
  color: string;
  /** Damage carried by this instance — `Weapon.damage` for `cast`, the resolved
   * per-hit amount for `impact`. */
  damage: number;
  weapon: Weapon;
  characterId: CharacterId;
}

export interface WeaponSfx {
  /** Fired once per `weapon-fired` event. Omit for the generic cast (`sounds.ts`
   * `castRanged`/`castMelee`/`castSelf`, chosen by `Weapon.type`). */
  cast?(c: WeaponSfxCtx): number;
  /** Fired once per `hit-landed` event this weapon caused. Omit for the generic
   * three-layer impact burst. */
  impact?(c: WeaponSfxCtx): number;
}

/** `${characterId}.${weapon.key}` — the registry's lookup key. */
export type WeaponSfxKey = `${CharacterId}.${string}`;

/** What each per-character file exports: its own weapons only, keyed by the short
 * `Weapon.key`. An empty object is valid. */
export type CharacterWeaponSfxMap = Partial<Record<string, WeaponSfx>>;
