/**
 * Character levels 1-15: what a level costs, what the player owns, and who the opponent
 * is levelled to.
 *
 * Uri, verbatim: *"I want the ability to improve characters in levels. 1-15, each level
 * improves damage and HP. To increase levels you need to spend coins/anything else."*
 *
 * ── The split, and it is the same split the rest of this module already makes ─
 *
 *   `rules.ts`   what a level DOES — `levelHealthMultiplier`, `levelDamageMultiplier`,
 *                `maxHpFor(id, base, level)`. That is BALANCE, and `rules.ts` is the
 *                single source of truth for balance.
 *   `tuning.ts`  what a level COSTS — `LEVEL_UP`. That is PROGRESSION, and `tuning.ts` is
 *                the single source of truth for progression.
 *   here         the pure functions over the two, and the player state that carries them.
 *
 * There is not one numeric literal in this file, exactly as in every other module under
 * `economy/`. `LEVEL_MAX` is imported from `rules.ts` rather than restated, because the
 * simulation's clamp and the shop's "MAX" badge disagreeing is a defect nobody would see
 * until a player paid for a sixteenth level that the sim ignored.
 */

import { CHARACTERS, LEVEL_MAX, LEVEL_MIN, clampLevel, type CharacterId } from '../rules.ts';
import { ENEMY_LEVEL_MODE, LEVEL_UP } from './tuning.ts';

/** What one upgrade costs. A full price, not a number — see `LEVEL_UP`'s reversibility note. */
export interface LevelPrice {
  coins: number;
  gems: number;
}

/**
 * The coin price of the upgrade FROM `fromLevel` TO `fromLevel + 1`.
 *
 * Returns `null` — not zero — at `LEVEL_MAX` and above. Zero is a price, and a caller that
 * treats "free" and "unavailable" as the same value ends up rendering a live BUY button on
 * a maxed character, which is the exact class of dead control both menu critics punished.
 *
 * The shape is `(id, fromLevel)` rather than `(rarity, fromLevel)` deliberately: rarity is
 * the only thing read off `id` today, and keeping the id in the signature means a
 * per-character price — or a per-character resource — is a change to this function's body
 * and to nothing else in the codebase.
 */
export function levelUpCost(id: CharacterId, fromLevel: number): LevelPrice | null {
  const level = clampLevel(fromLevel);
  if (level >= LEVEL_MAX) return null;
  const steps = level - LEVEL_MIN;
  const raw = LEVEL_UP.baseCoins
    * Math.pow(LEVEL_UP.growth, steps)
    * LEVEL_UP.rarityCostMultiplier[CHARACTERS[id].rarity];
  return { coins: Math.round(raw / LEVEL_UP.roundTo) * LEVEL_UP.roundTo, gems: 0 };
}

/**
 * The total price of walking a character from `fromLevel` to `toLevel`.
 *
 * Summed over `levelUpCost` rather than closed-form, because the closed form of a rounded
 * geometric series is not the sum of the rounded terms and the player pays the terms. A
 * "total" that the individual purchases do not add up to is a number the model does not
 * compute — `DECISIONS §13`'s defect in miniature.
 */
export function totalLevelCost(id: CharacterId, fromLevel: number, toLevel: number): LevelPrice {
  const out: LevelPrice = { coins: 0, gems: 0 };
  const from = clampLevel(fromLevel);
  const to = clampLevel(toLevel);
  for (let level = from; level < to; level++) {
    const step = levelUpCost(id, level);
    if (!step) break;
    out.coins += step.coins;
    out.gems += step.gems;
  }
  return out;
}

/** The full 1 -> `LEVEL_MAX` bill for one character. The headline number for the UI. */
export function costToMax(id: CharacterId): LevelPrice {
  return totalLevelCost(id, LEVEL_MIN, LEVEL_MAX);
}

/**
 * The level the OPPONENT fights at, given the player's.
 *
 * Uri: *"The game eventually should be humans vs. humans. We will incorporate AI players to
 * enrich. They need to be adjusted to the player's level."* So the shipped mode is
 * `'mirror'` — the bot is a stand-in for a human at the same investment, and it gets a
 * human's stats through the same `(characterId, level)` function rather than a bot table.
 *
 * ⚠️ This function is the ONLY place that decision is expressed. `sim.ts` takes two levels
 * and treats them symmetrically; it has no idea one of them belongs to an AI.
 */
export function enemyLevelFor(playerLevel: number): number {
  return ENEMY_LEVEL_MODE === 'mirror' ? clampLevel(playerLevel) : LEVEL_MIN;
}
