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
 * 4. **Match the VFX that already exists.** Every character has bespoke VFX under
 *    `src/vfx/weapons/`, and each of those files opens with a paragraph naming that
 *    weapon's physical identity — a soup splash spreads and steams, a pizza slice is
 *    a flat spinning plate, a taco shell breaks into brittle fragments, a burrito is
 *    a ribbon that unrolls. That paragraph is the sound design brief. Do not invent a
 *    separate identity: audio and VFX disagreeing about what an object IS is worse
 *    than either being plain.
 * 5. **Then prove it.** `tools/audio-probe.mjs --mode identity` discovers every
 *    registered impact from this registry automatically, so a new voice is measured
 *    the moment it is added — but it also has to EARN A RUNG on the roster ladder
 *    (below), and `--mode depth` will hold it to the layer contract. A hook that is
 *    registered but silent is the single most likely way to fail here, and it is
 *    invisible without a measurement.
 *
 * ── ALL ELEVEN ARE NOW CONVERTED. Adding a weapon means finding a GAP. ──────────
 *
 * When only three characters had voices this section could say "pick an axis". It no
 * longer can: every rung of the spectral-centroid ladder is occupied and every device
 * is spoken for. See `./index.ts` for the full table of who owns what. A new weapon
 * has to fit inside its character's existing rung — Sushi's fourth weapon must still
 * sound like Sushi — and the probe's 55-pair separation check is what enforces that.
 *
 * ── What makes a voice distinct ─────────────────────────────────────────────────
 *
 * Not loudness, and not EQ alone. Every character owns a POSITION on the ladder AND a
 * DEVICE nobody else uses, because eleven things cannot be separated on one axis. The
 * two pairs that sit closest in brightness are deliberately the two separated hardest
 * on a second axis the ear resolves independently:
 *   * Taco vs Sushi — both bright; NOISE versus near-PITCH (spectral structure).
 *   * Donut vs Lollipop — both resonant; near-HARMONIC versus RING-MODULATED.
 * Pick an axis before you pick a filter frequency, and check `index.ts` first to see
 * which axes are already taken.
 *
 * ── THE LAYER CONTRACT: every hit owes four layers ──────────────────────────────
 *
 * Uri played the game and said the SFX were *"very shallow and similar"*. "Similar"
 * was the authoring gap above. "Shallow" was synthesis, and `--mode depth` now holds
 * every hit to a floor that a single layer cannot reach, however rich that layer is:
 *
 *   1. A TRANSIENT — `transient()`. Tick AND pitched snap; a tick alone is a hiss.
 *   2. A BODY with a real PITCH ENVELOPE — measured at >= 1.25x from onset to 30%
 *      through. A static-frequency tone scores exactly 1.00 and fails.
 *   3. HARMONIC CONTENT — >= 3 discrete partials. Use `drive` (saturation),
 *      `voices`/`detuneCents`, `ring`, or `modes()`. A bare sine scores 1; the same
 *      sine at drive 2.5 scores 7.
 *   4. LOW END — the sub-300 Hz band must peak at >= 25% of the loudest band on
 *      anything doing 8 damage or more. Short is fine; absent is not. A hit with no
 *      low layer is inaudible as a hit on a phone speaker.
 *
 * Plus the room, which you get for free: pass `wet` on any layer and it goes to the
 * shared reverb send. 0.05-0.12 for a transient, 0.12-0.25 for a body, 0.25-0.5 for
 * something wet or distant.
 *
 * The one thing to know before writing a number: the probe measures layer structure on
 * a DRY render and the room on an A/B, so a heavy `wet` will not fake any of the four.
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
