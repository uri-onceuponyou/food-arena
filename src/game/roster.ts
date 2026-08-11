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

// ⚠️ **`.ts` ON BOTH SPECIFIERS, AND IT IS NOT A STYLE CHANGE.** They used to be
// extension-less, which resolves only under Vite/tsc — so this file, alone among
// `src/game/**`, could not be imported by a plain-Node instrument, and
// `DECISIONS §61` records the consequence as a structural finding: *"no Node gate has
// ever reached the UI layer"*. `resolvePlaces` below is a payout rule, and a payout rule
// whose only possible test is a browser check is a payout rule nothing checks offline.
// Every sibling in this directory already writes `'./state.ts'` for exactly this reason
// (see `state.ts`'s header), and `tsconfig.json` accepts it — `sim.ts`, `combat.ts`,
// `ai.ts` and `movement.ts` are the proof, and `tsc --noEmit` is the gate.
import type { DamageSource, Fighter, FighterId, FighterRole, MatchState } from './state.ts';
import { otherRole } from './state.ts';

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

// ─────────────────────────────────────────────────────────────────────────────
// FINISHING ORDER
// ─────────────────────────────────────────────────────────────────────────────

/**
 * The one seat fact a placement is computed from. A structural subset of `Fighter`, so a
 * caller can hand in `state.fighters` directly and an instrument can hand in six literals.
 */
export interface PlacementSeat {
  readonly id: number;
  readonly alive: boolean;
  readonly hp: number;
  readonly maxHp: number;
  readonly x: number;
  readonly y: number;
  readonly deaths: number;
}

/** Everything `resolvePlaces` reads. See `MatchOutcome` in `game/match.ts` for the
 *  session-side producer, which is the only thing that can observe `eliminated`. */
export interface PlacementInput {
  /** One entry per seat, in SLOT ORDER — `seats[i].id === i`, as `state.fighters` is. */
  readonly seats: readonly PlacementSeat[];
  /** The arena centre in world units. `sim.ts:resolveTimeout`'s rung 2 measures against it. */
  readonly center: { readonly x: number; readonly y: number };
  /**
   * The slots KNOCKED OUT, EARLIEST FIRST — one entry per `death` event, in the order
   * `stepMatch` emitted them. `seats.length - 1` long for a knockout finish; anything from
   * zero up for a timeout.
   */
  readonly eliminated: readonly number[];
  /** The slot `sim.ts` declared the winner, or `null` if the match never resolved. */
  readonly winnerId: number | null;
}

/**
 * 🚨 EVERY SEAT RANKED, BEST FIRST. `resolvePlaces(o)[k]` is the SLOT that finished `k`th.
 *
 * ── WHY IT EXISTS ──────────────────────────────────────────────────────────
 *
 * `matchScreen.ts` banked `profile.recordResult(winner === 'player')` — a BOOLEAN, which
 * `profile.ts` forwards as `recordPlacement(won ? 0 : 1, MIN_FIGHTERS)`. So **every match
 * the product has ever played paid as a duel**, and the 3-6 seat curve built in
 * `DECISIONS §59` and wired through in `§61` was unreachable from the game. At 500
 * trophies a six-player match paid 2nd, 3rd, 4th AND 5th the LAST-PLACE rate
 * (-5 trophies / 20 coins / 35 XP) instead of 11/52/87, 7/44/74, 3/36/61 and -1/28/48.
 * `tools/tmp/mp_join.mjs` is the gate and it is RED on the code this replaces.
 *
 * ── 🚨 THE RANK IS NOT IN THE FINAL STATE. THIS WAS MEASURED, NOT ARGUED. ──
 *
 * The obvious resolver reads `state.fighters` at `phase === 'ended'` and sorts. It cannot
 * work, and `tools/tmp/mp_probe.mjs` — real matches, real `stepMatch`, the shipped
 * 2800x2000 kitchen — says why:
 *
 *     seats  matches  ended by knockout  alive at end  DISTINCT (hp, deaths) among LOSERS
 *     2      60       60                 1             1.000  (max 1)
 *     3      60       60                 1             1.000  (max 1)
 *     4      60       60                 1             1.000  (max 1)
 *     6      40       40                 1             1.000  (max 1)
 *
 * **Every loser is bit-identical**: `alive: false`, `hp: 0` (`combat.ts:applyDamage` clamps
 * with `Math.max(0, …)`), `deaths: 1` (nothing respawns). And `alive-at-end` is 1 in 220 of
 * 220, because `combat.ts` ends the match on the (N-1)th knockout through
 * `lastFighterStanding` — there is never a second survivor to separate. So a final-state
 * resolver ranks the losers by NOTHING and falls through to slot order, which is exactly
 * the defect `hud.ts`'s result card already had. Installing it in the money as well would
 * have been the *"one rule stated once and implemented twice"* shape this file exists to
 * prevent, with the wrong rule.
 *
 * The information exists only in the EVENT STREAM. `game/match.ts` records it, because it
 * is the only module that sees `GameEvent[]`. It is worth real trophies: reversed
 * elimination order agrees with slot order in **53.3% of three-seat, 26.7% of four-seat and
 * 0.0% of six-seat matches** — at six seats a slot-order fallback names the wrong runner-up
 * every single time.
 *
 * ── THE RUNGS ──────────────────────────────────────────────────────────────
 *
 *  1. **SURVIVORS ABOVE THE KNOCKED OUT.**
 *  2. **AMONG SURVIVORS: `sim.ts:resolveTimeout`'s comparator** — higher HP FRACTION, then
 *     nearer the arena centre, then fewest deaths (`DECISIONS §49a`), then the lower slot.
 *     This is the rung that answers a match ending with several fighters alive at different
 *     HP, which is what a `resolveTimeout` finish is. It is restated here rather than
 *     imported because `resolveTimeout` is private to `sim.ts` and sorts `Fighter`s; the
 *     gate is what keeps the two honest, by requiring this ranking's first element to equal
 *     the winner the SIM picked, on real matches, at every seat count.
 *  3. **AMONG THE KNOCKED OUT: REVERSE ELIMINATION ORDER.** Last one knocked out places
 *     best — the battle-royale rule, and the only one the data supports.
 *  4. Ties fall to `§49a`: fewest deaths, then the lower slot. TOTAL by construction — `id`
 *     is unique — so nothing here depends on `Array.prototype.sort` being stable.
 *
 * ⚠️ **DEDUPED KEEPING THE *LAST* KNOCKOUT, NOT THE FIRST.** `Fighter.deaths` is 0 or 1
 * today so `eliminated` cannot repeat — but `state.ts` is explicit that the counter exists
 * to stay correct *when respawns land*, and on that day the rung is "when were you last
 * knocked out", not "when were you first". It costs a `Map` now; it costs a session later.
 */
export function resolvePlaces(input: PlacementInput): number[] {
  const { seats, center, eliminated, winnerId } = input;
  const seatOf = (id: number): PlacementSeat | undefined => seats.find((f) => f.id === id);

  const hpFraction = (f: PlacementSeat): number => (f.maxHp > 0 ? f.hp / f.maxHp : 0);
  const toCentre = (f: PlacementSeat): number => Math.hypot(f.x - center.x, f.y - center.y);

  /** `sim.ts:resolveTimeout`'s four rungs, in order. */
  const byTimeoutRungs = (a: PlacementSeat, b: PlacementSeat): number => {
    const fa = hpFraction(a);
    const fb = hpFraction(b);
    if (fa !== fb) return fb - fa;
    const da = toCentre(a);
    const db = toCentre(b);
    if (da !== db) return da - db;
    if (a.deaths !== b.deaths) return a.deaths - b.deaths;
    return a.id - b.id;
  };

  const survivors = seats
    .filter((f) => f.alive && f.hp > 0)
    .slice()
    .sort(byTimeoutRungs)
    .map((f) => f.id);
  const survivorSet = new Set(survivors);

  /** Slot -> the index of its LAST knockout in `eliminated`. */
  const lastKo = new Map<number, number>();
  eliminated.forEach((id, i) => { if (seatOf(id) !== undefined) lastKo.set(id, i); });

  const knockedOut = [...lastKo.keys()]
    .filter((id) => !survivorSet.has(id))
    .sort((a, b) => {
      const ka = lastKo.get(a) ?? -1;
      const kb = lastKo.get(b) ?? -1;
      if (ka !== kb) return kb - ka;                        // knocked out LATER places BETTER
      const fa = seatOf(a);
      const fb = seatOf(b);
      if (fa && fb && fa.deaths !== fb.deaths) return fa.deaths - fb.deaths;  // §49a rung 1
      return a - b;                                         // §49a rung 2: the lower slot
    });

  // A seat that is neither standing nor in `eliminated`. No state the sim produces has one
  // — a fighter is dead if and only if `applyDamage` pushed its `death` event — but a
  // duck-typed instrument state can, and dropping a seat here would shorten the list and
  // shift every place below it. §49a orders them.
  const placed = new Set([...survivors, ...knockedOut]);
  const unaccounted = seats
    .filter((f) => !placed.has(f.id))
    .slice()
    .sort((a, b) => (a.deaths !== b.deaths ? a.deaths - b.deaths : a.id - b.id))
    .map((f) => f.id);

  const places = [...survivors, ...knockedOut, ...unaccounted];

  /**
   * 🚨 THE SIM'S DECLARED WINNER IS FIRST, ALWAYS.
   *
   * The victory card, the audio sting and the W/L record all read `state.winner`. A payout
   * that ranked somebody else first would hand runner-up money to the fighter the game has
   * just congratulated, silently.
   *
   * ⚠️ **THIS BRANCH IS DEAD ON EVERY MATCH THE SIM CAN PRODUCE, AND IS KEPT ANYWAY.**
   * A knockout leaves exactly one survivor, so rung 1 already puts them first; a timeout
   * leaves at least one alive and rung 2 IS `resolveTimeout`. The only shape that reaches
   * here is a TOTAL WIPE — every seat dead with the match still `'playing'` — which
   * `state.ts:lastFighterStanding` documents as reachable in principle and which
   * `mp_join.mjs` §D constructs by hand, because a branch nothing has executed is a branch
   * nobody has tested. The gate asserts it fires **zero** times across the real-match
   * corpus, so it is a guard and not a fixup.
   */
  if (winnerId !== null && places[0] !== winnerId && seatOf(winnerId) !== undefined) {
    return [winnerId, ...places.filter((id) => id !== winnerId)];
  }
  return places;
}

/**
 * Where slot `slot` finished, ZERO-BASED — 0 is first place, `seats.length - 1` is last.
 *
 * ⚠️ **ZERO-BASED, BECAUSE `profile.recordPlacement(place, seats)` IS.** `hud.ts` renders
 * *"4th of 6"* and is ONE-based; the two are one `+ 1` apart at the one call site that
 * needs the human form, and mixing them silently pays 6th place a 5th-place cheque.
 *
 * `-1` when the slot is not in the roster at all, which no sim-built state can produce.
 */
export function placeOf(input: PlacementInput, slot: number): number {
  return resolvePlaces(input).indexOf(slot);
}
