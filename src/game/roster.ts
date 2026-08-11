/**
 * HOW THE PRESENTATION LAYERS RESOLVE "WHICH FIGHTER" — stated ONCE, for all four.
 *
 * `cdcdd65` + `1b506d6` made the sim seat up to `MAX_FIGHTERS` fighters: `state.fighters`
 * is the container, `fighters[i].id === i`, and every event that names a fighter carries a
 * `*Id` alongside its legacy `*Role` mirror. The four presentation modules — `ui/hud.ts`,
 * `game/match.ts`, `game/vfx.ts`, `audio/director.ts` — all had to stop reconstructing
 * "the other one" from a two-valued string. They all need the same three rules, and this
 * project's oldest and most expensive defect shape is one rule stated once and implemented
 * twice (`ai.ts`'s header documents six instances). So they are here, once.
 *
 * ── 🚨 WHY EVERY RESOLVER HAS A ROLE FALLBACK, AND WHY THAT IS NOT DEFENSIVE CODING ──
 *
 * These modules are driven by INSTRUMENTS as well as by the sim, and the instruments hand
 * in states and events that the sim would never produce. Measured, not assumed — grep over
 * `tools/` at the time of writing:
 *
 *   * `tools/audio-probe.mjs` (a shipped gate) duck-types `MatchState` to exactly the
 *     fields `director.ts` reads: `{ elapsed, phase?, safeRadius?, player, enemy }`.
 *     **There is no `fighters` array on it at all**, and `--mode dispatch`'s whole design
 *     is that a field it does not model must mean "cannot tell", never a wrong answer.
 *   * every synthetic `hit-landed` in `tools/` — `audio-probe.mjs` ×6,
 *     `tools/tmp/feel_probe.mjs`, `tools/tmp/audio_mix.mjs` — carries `targetRole` and a
 *     `source: { kind: 'weapon', weaponKey, weaponName }` with **no `targetId` and no
 *     `attackerId`**, because those events were written before the ids existed.
 *
 * `tsc` sees none of it: 1,089 of 1,307 references to this surface are in `.mjs`. A
 * resolver that read `state.fighters[ev.targetId]` and stopped there would compile clean
 * and return `undefined` in four fifths of the instruments that measure this game —
 * exactly the silent runtime break `state.ts` refuses to accept for `createMatch` and
 * `stepMatch`. So: **the id when it is there, the seat name when it is not**, and the two
 * agree by construction at two fighters.
 *
 * Nothing here is gameplay. It reads state and never writes it.
 */

import type { DamageSource, Fighter, FighterId, FighterRole, MatchState } from './state';
import { otherRole } from './state';

/**
 * WHICH SLOT THIS CLIENT'S HUMAN IS SITTING IN.
 *
 * ⚠️ **A RENDERER ASYMMETRY, NOT A SIM ONE, AND IT USED TO BE SPELLED `state.player`.**
 * The sim is symmetric — every fighter is a peer, and `MatchState.player` is documented as
 * "slot 0", not as "the human". The RENDERER is not symmetric: it is one human's client,
 * the camera follows one fighter, the weapon tray shows one fighter's cooldowns, and the
 * result card says VICTORY or DEFEAT from one fighter's point of view.
 *
 * 0 because that is exactly what ships today: `createMatch`'s legacy 3-argument form seats
 * the human in slot 0, and `Fighter.controller` is `'human'` there and `'ai'` everywhere
 * else. It is a CONSTANT rather than a search for `controller === 'human'` on purpose —
 * above one human seat "which human is *this screen*" is a session question that no amount
 * of looking at `MatchState` can answer, and a search would silently pick the lowest-numbered
 * human and look like it worked. When a second human seat ships, this becomes a parameter
 * of the session and every reader below already goes through it.
 */
export const LOCAL_SLOT: FighterId = 0;

/**
 * EVERY FIGHTER IN THE MATCH, IN SLOT ORDER.
 *
 * `state.fighters` when the state has one (everything `createMatch` builds), and the
 * `[player, enemy]` pair otherwise — see the header for the duck-typed instrument states
 * that reach these modules. The fallback is built fresh rather than cached: these states
 * are constructed per call by the probes that use them.
 */
export function fightersOf(state: MatchState): readonly Fighter[] {
  const list = (state as { fighters?: readonly Fighter[] }).fighters;
  if (Array.isArray(list) && list.length > 0) return list;
  return [state.player, state.enemy].filter(Boolean) as Fighter[];
}

/** The fighter this client's human is. Never null for any state either the sim or an
 * instrument produces — `LOCAL_SLOT` is 0 and slot 0 is the one seat everything has. */
export function localFighter(state: MatchState): Fighter {
  return fightersOf(state)[LOCAL_SLOT] ?? state.player;
}

/**
 * THE FIGHTER AN EVENT NAMES: by SLOT when the event carries one, by SEAT NAME when it
 * does not. See the header for why the second half is load-bearing rather than paranoid.
 *
 * ⚠️ `id` is typed as possibly-undefined even though `GameEvent` declares it required.
 * That is not a `tsc` weakness being worked around — it is the honest type for a value
 * that arrives from `.mjs` at runtime, and writing it as required would make the fallback
 * look like dead code to the next reader and invite its deletion.
 */
export function fighterOf(
  state: MatchState,
  id: FighterId | undefined,
  role: FighterRole,
): Fighter {
  if (typeof id === 'number') {
    const f = fightersOf(state)[id];
    if (f) return f;
  }
  return state[role];
}

/**
 * WHO SWUNG. The one reconstruction this refactor exists to delete.
 *
 * `match.ts` did this three times and `audio/director.ts` once, all four spelled
 * `state[otherRole(ev.targetRole)]` — "the other one", a two-seat rule living outside the
 * sim, which at three fighters attributes every hit to the wrong attacker while still
 * returning a real fighter and a real weapon colour. `DamageSource` now carries
 * `attackerId` for exactly this; `otherRole` survives here as the pre-id fallback and
 * nowhere else in the presentation layers.
 */
export function weaponAttackerOf(
  state: MatchState,
  source: Extract<DamageSource, { kind: 'weapon' }>,
  targetRole: FighterRole,
): Fighter {
  return fighterOf(state, source.attackerId, otherRole(targetRole));
}

/** Who dropped a trail mark. Same rule as `weaponAttackerOf`, on the source that carries
 * its owner directly because a mark outlives the tick that dropped it. */
export function trailOwnerOf(
  state: MatchState,
  source: Extract<DamageSource, { kind: 'trail' }>,
): Fighter {
  return fighterOf(state, source.ownerId, source.ownerRole);
}

/**
 * A SLOT INDEX for anything the presentation keys per fighter — knockback offsets, the
 * per-target hit colour, the audio director's status snapshots.
 *
 * Same rule as `fighterOf`, returning the INDEX rather than the fighter, because those
 * three consumers key arrays and never need the object. Falls back to the two-seat mapping
 * `state.ts:roleOfSlot` inverts: `player` is 0, `enemy` is 1.
 */
export function slotOf(id: FighterId | undefined, role: FighterRole): number {
  return typeof id === 'number' ? id : role === 'player' ? 0 : 1;
}

/**
 * The legacy seat name for a slot — the presentation-side copy of `state.ts:roleOfSlot`.
 *
 * ⚠️ Imported rather than re-derived would be better, and it is NOT imported: `roleOfSlot`
 * returns `FighterRole`, and every consumer here wants a DOM/CSS/debug KEY that must stay
 * distinct above slot 1 (`slot2`, `slot3`, …) where `roleOfSlot` deliberately collapses
 * every one of them to `'enemy'`. Two different questions; see `state.ts`'s own note that
 * above `MIN_FIGHTERS` the seat name is "a deliberate lie".
 *
 * 🚨 SLOTS 0 AND 1 MUST KEEP THESE EXACT STRINGS. `data-el="player-name"`,
 * `data-el="enemy-hp"`, `.hud-fighter--player`, `.hud-radar-dot--enemy`,
 * `[data-el="float-enemy"]` and friends are selected by name from **at least ten**
 * instruments, two of which are shipped gates (`menu_accept_portrait`, `cw_conceal_view`).
 * A guard that silently stops matching is this project's most expensive recurring failure,
 * so these two names are a compatibility contract and not a naming choice.
 */
export function slotKey(slot: number): string {
  return slot === 0 ? 'player' : slot === 1 ? 'enemy' : `slot${slot}`;
}
