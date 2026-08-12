/**
 * WHO ELSE IS IN THE MATCH — the seat count and the field, in ONE place.
 *
 * 🚨 **THIS FILE IS A DESIGN DEFAULT STANDING IN FOR AN ANSWER URI HAS NOT GIVEN.**
 * `DECISIONS §66` asks three questions and none of them is plumbing:
 *
 *   1. **Where does the affordance live?** There is no mode selector in the game.
 *   2. **How are the other five chosen?** There is no matchmaking.
 *   3. **What level are five bots?**
 *
 * Question 3 was already answered and the answer is in the codebase, not here:
 * `economy/levels.ts:enemyLevelFor()` — *"AI players need to be adjusted to the player's
 * level"* — and `match.ts` applies it to every non-local seat. **This file deliberately
 * does not touch levels**, because a second place that could set them would be a place
 * that could silently un-answer that question (`GameSessionOptions.playerLevel` says so).
 *
 * Questions 1 and 2 are still open, so this file answers **only 2**, as narrowly as it
 * can, and **nothing here builds an affordance**: no tile, no button, no screen. The flag
 * is a route field plus a QA URL parameter, exactly like `?player=` / `?screen=`. When Uri
 * answers question 1, the affordance navigates with `seats` set and this file does not
 * change.
 *
 * ── ✅ URI ANSWERED QUESTION 1 ON 2026-08-12 (`DECISIONS §74`) ───────────────
 * > *"We need the lobby where the gameplay is set, to be able to choose how many players,
 * > and assign bots to the one who plays locally."*
 *
 * `screens/lobby.ts` is that affordance and **the paragraph above held**: it navigates
 * with `seats` set and calls `brawlRoster` to RENDER the field it is about to seat. The
 * one thing it needed that did not exist was the seat-count predicate as a function
 * rather than as three lines inside a query parser — `seatCountFor` below — because a
 * screen with its own opinion about which counts are legal is a second copy of this
 * file's policy. `seatsFromParams` now delegates to it, so `?seats=` and the lobby's
 * Start button cannot disagree about what `2` means.
 *
 * ── Why a separate module rather than a block inside `matchScreen.ts` ────────
 * Two reasons, and the second is the one that matters.
 *   * Two callers already: `main.ts` reads the seat count off the URL, `matchScreen.ts`
 *     builds the field. A third (the affordance, wherever it lands) is coming.
 *   * **It is the only shape a NODE gate can reach.** Every other file in `src/ui/**`
 *     imports extension-less and transitively drags in Three.js and a module-scope
 *     `document.createElement('canvas')`, so `node` cannot load it at all — measured, not
 *     assumed (`docs/TOOLS.md`'s `nw_profile` row is the standing note on this, and the
 *     esbuild bridge it describes dies here with `ReferenceError: document is not
 *     defined`). This module imports `rules.ts` and `state.ts` with **explicit `.ts`
 *     extensions**, which is the same trick `src/game/**` uses so `sim.test.mjs` runs with
 *     no build step. `tools/tmp/sp6_seats.mjs` imports it directly because of that.
 *
 * Nothing here is random. See `brawlRoster`.
 */

import { CHARACTER_IDS, type CharacterId } from '../../game/rules.ts';
import { MAX_FIGHTERS, MIN_FIGHTERS } from '../../game/state.ts';

/**
 * The seat count a URL asks for, or `undefined` for "the shipped duel".
 *
 * `?seats=6` is the **flag**, and it is default-OFF in the only sense that matters: absent,
 * malformed, or a seat count the sim would not seat, and this returns `undefined`, which is
 * what `Route.seats` carries on every shipped navigation today. `matchScreen.ts` then takes
 * the two-seat path with not one branch changed.
 *
 * ⚠️ **`?seats=2` IS REFUSED RATHER THAN HONOURED, and that is deliberate.**
 * `match.ts:fightersFromQuery` refuses a two-entry `?fighters=` list for exactly this reason
 * and states it: *"at two seats the legacy form is the measured-identical path and there is
 * no reason for a QA parameter to route around it."* Honouring `?seats=2` would send the
 * duel down the fighter-LIST form — which `sim.ts` implements the legacy form in terms of,
 * so it would almost certainly be identical, and "almost certainly" is the whole thing the
 * identity battery exists to not have to say. One path to two seats.
 *
 * ⚠️ **`MIN_FIGHTERS`/`MAX_FIGHTERS` ARE IMPORTED, NEVER RETYPED.** `state.ts` owns the
 * range; a literal `3` and `6` here would be two more numbers to go stale the day the sim
 * seats eight — the same class as the 1× map coordinates that stayed *legal* while being
 * wrong (`DECISIONS §67`).
 */
export function seatsFromParams(params: URLSearchParams): number | undefined {
  const raw = params.get('seats');
  if (raw === null) return undefined;
  return seatCountFor(Number(raw));
}

/**
 * THE SEAT-COUNT PREDICATE, as a function, so every caller shares one answer.
 *
 * `n` in and `n` out, or `undefined` for "the shipped duel" — which is what `Route.seats`
 * carries on every shipped navigation. It is **the same three lines `seatsFromParams` used
 * to inline**, lifted verbatim, and that function now delegates to it. Three callers today:
 *
 *   * `seatsFromParams` — `?seats=` (above).
 *   * `screens/lobby.ts` — the Start button. **This is why it exists.** A lobby offering
 *     `2 3 4 5 6` has to map its own `2` to `undefined` rather than to `2`, and a screen
 *     that decided that for itself would be a second place the duel's one path could be
 *     routed around. `seatCountFor(2) === undefined` is that rule, in this file, once.
 *   * `screens/shell.ts` — validating a `seats` off `history.state`, which outlives the
 *     build that wrote it and can carry anything at all.
 *
 * ⚠️ **The two guards below are byte-for-byte the ones `sp6_seats.mjs --selftest` mutates**
 * (`nofloor` replaces the range line with `if (n < 0) return undefined;`). Moving them here
 * keeps that known-bad pointed at live code: mutate this and `seatsFromParams` still breaks,
 * because it has no range check of its own any more.
 */
export function seatCountFor(n: number): number | undefined {
  if (!Number.isInteger(n)) return undefined;
  if (n <= MIN_FIGHTERS || n > MAX_FIGHTERS) return undefined;
  return n;
}

/**
 * Every seat count the lobby may offer, low to high — `MIN_FIGHTERS..MAX_FIGHTERS`.
 *
 * ⚠️ **DERIVED, so it survives the day the sim seats eight.** A hand-typed `[2,3,4,5,6]` in
 * a screen is the same class as the 1× map literals that stayed *legal* while being wrong
 * (`DECISIONS §67`) — nothing would fail, the lobby would simply stop offering a seat count
 * the sim supports. Note the range starts at `MIN_FIGHTERS` while `seatCountFor` refuses it:
 * that is not a contradiction, it is the two halves of "one path to two seats" — the lobby
 * OFFERS 2 and expresses it as an absent flag.
 */
export const SEAT_CHOICES: readonly number[] =
  Array.from({ length: MAX_FIGHTERS - MIN_FIGHTERS + 1 }, (_, i) => MIN_FIGHTERS + i);

/**
 * THE FIELD, given the two fighters a route already names and how many seats to fill.
 *
 * ── 🚨 THE RULE, WRITTEN DOWN BECAUSE IT IS A DEFAULT URI MAY WANT TO OVERRULE ──
 *
 * > **Seat 0 is the player. Seat 1 is the opponent the route already picked. Seats 2 and up
 * > are taken from `CHARACTER_IDS` in declaration order, starting at the entry AFTER the
 * > player's, wrapping, skipping anyone already seated.**
 *
 * So `brawlRoster('hamburger', 'donut', 6)` is
 * `[hamburger, donut, taco, burrito, egg, lollipop]`, and picking a different character
 * changes the field rather than always meeting the top of the list.
 *
 * 🚨 **NO `Math.random()`, AND THAT IS A HARD CONSTRAINT, NOT A PREFERENCE.** The sim
 * contains zero randomness and that is what underwrites every balance number in this project
 * — 110 matchups, the pacing ladder, `roster_table`, `kx_seatfair`'s 600-match seat spread.
 * A random field would make a six-player match unreproducible and every one of those numbers
 * unrepeatable at six seats. `characterSelect.ts:pickOpponent` **is** random and is the one
 * source of variation that reaches here; it arrives as the `enemy` argument, pre-existing and
 * untouched, and `?enemy=` pins it for any measurement that needs pinning.
 *
 * ⚠️ **THE SEAT ORDER IS NOT COSMETIC AND MUST NOT BE "TIDIED".** Slot *i* takes
 * `arena.spawns[i]` (`sim.ts:defaultSpawn`), and `kitchen.ts` interleaves that array so that
 * N=2, N=4 and N=6 are each a complete set of 180°-mirrored pairs. Reordering the roster
 * re-seats the map and can silently revert the 2.680 → 0.342 places of seat advantage
 * `kx_seatfair` bought — a revert that printed ✅ EVERY CHECK PASSED on the layout tool.
 * **Legality is not fairness.** This function therefore chooses *characters*, never
 * positions, and passes no spawn at all.
 *
 * ⚠️ **AND IT VALIDATES A PERMUTATION RATHER THAN INDEXING HOPEFULLY.** A routed patch in
 * exactly this area used `.map(s => roster[s]).filter(Boolean)` and **silently dropped
 * fighters** — a 3-entry order listed 3 of 5 losers. `filter(Boolean)` turns "I built the
 * wrong list" into "I built a shorter list", which is a bug that looks like data. So the
 * result is asserted to be the right LENGTH and free of duplicates before it is returned,
 * and a failure throws.
 *
 * @param player the local seat's character — `Route.player`
 * @param enemy  seat 1 — `Route.enemy`, so `brawlRoster(p, e, MIN_FIGHTERS)` is exactly the
 *               pair the shipped duel plays, which is what makes this additive
 * @param seats  `MIN_FIGHTERS`..`MAX_FIGHTERS`
 */
export function brawlRoster(
  player: CharacterId,
  enemy: CharacterId,
  seats: number,
): readonly CharacterId[] {
  if (!Number.isInteger(seats) || seats < MIN_FIGHTERS || seats > MAX_FIGHTERS) {
    throw new RangeError(
      `brawlRoster: ${seats} seats; the sim seats ${MIN_FIGHTERS}..${MAX_FIGHTERS}`
      + ' (see state.ts MIN_FIGHTERS / MAX_FIGHTERS)',
    );
  }
  const out: CharacterId[] = [player];
  // Seat 1 is the route's own opponent. It may equal `player` only if a caller asked for a
  // mirror match, which nothing shipped does; the duplicate check below is what catches it
  // rather than a silent third seat quietly becoming the second.
  if (seats > 1) out.push(enemy);
  const start = CHARACTER_IDS.indexOf(player);
  for (let step = 1; out.length < seats && step <= CHARACTER_IDS.length; step++) {
    const id = CHARACTER_IDS[(start + step) % CHARACTER_IDS.length];
    if (!out.includes(id)) out.push(id);
  }
  if (out.length !== seats || new Set(out).size !== seats) {
    throw new RangeError(
      `brawlRoster: built ${out.length} seats (${new Set(out).size} distinct) for ${seats}`
      + ` from ${CHARACTER_IDS.length} characters — [${out.join(', ')}]`,
    );
  }
  return out;
}
