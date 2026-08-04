/**
 * Opening a chest or a box, and publishing what is inside one.
 *
 * ── The two functions here read the SAME array ──────────────────────────────
 * `rollContainer()` and `containerOdds()` both walk `CONTAINERS[kind].entries`. That
 * is the entire point of this file. Once gems are purchasable with real money, boxes
 * become transitively real-money randomised purchases, and both major app stores —
 * plus consumer law in several markets — require the drop rates to be disclosed to
 * the player. A hand-written odds string next to a separately-authored weight table
 * is a disclosure that *will* drift, and a drift there is a compliance problem, not
 * a cosmetic one.
 *
 * So there is no second copy. The odds sheet is computed, and `economy.test.mjs`
 * closes the loop by rolling tens of thousands of seeded containers and asserting
 * the empirical distribution matches the published percentages.
 */

import type { CharacterId, Rarity } from '../rules.ts';
import { CHARACTERS } from '../rules.ts';
import {
  CHARACTERS_BY_RARITY,
  CONTAINERS,
  DUPLICATE_COINS,
  type ContainerDef,
  type ContainerEntry,
  type ContainerKind,
} from './tuning.ts';
import { weightedIndex, type Rng } from './rng.ts';
import { emptyReward, type Reward } from './reward.ts';

/** Sum of an entry list's weights. Asserted to be 100 for every shipped container. */
export function totalWeight(entries: readonly ContainerEntry[]): number {
  return entries.reduce((sum, e) => sum + e.weight, 0);
}

/** One published row of a container's drop table. */
export interface OddsRow {
  /** What the player would receive. */
  label: string;
  /** Percent, already normalised so the column sums to 100. */
  percent: number;
  /** Set when the row is a character pull, so the sheet can name the pool. */
  rarity?: Rarity;
  /** The characters this row can produce — the pool the player is drawing from. */
  pool?: CharacterId[];
}

/**
 * The published drop table for a container.
 *
 * Rows are merged by outcome and sorted rarest-last, which is how every shipped
 * odds sheet reads. Percentages are normalised against the actual weight total, so
 * a table whose weights do not sum to 100 still discloses truthfully rather than
 * lying by exactly the amount it is misconfigured.
 */
export function containerOdds(kind: ContainerKind): OddsRow[] {
  const def = CONTAINERS[kind];
  const total = totalWeight(def.entries);
  if (total <= 0) return [];

  const rows: OddsRow[] = [];
  for (const entry of def.entries) {
    const percent = (entry.weight / total) * 100;
    if (entry.characterRarity) {
      const pool = CHARACTERS_BY_RARITY[entry.characterRarity] ?? [];
      rows.push({
        label: `${entry.characterRarity} fighter`,
        percent,
        rarity: entry.characterRarity,
        pool,
      });
    } else {
      const parts: string[] = [];
      if (entry.coins) parts.push(`${entry.coins.toLocaleString()} coins`);
      if (entry.gems) parts.push(`${entry.gems.toLocaleString()} gems`);
      rows.push({ label: parts.join(' + ') || 'Nothing', percent });
    }
  }

  // Merge duplicate labels (a table may legitimately list the same payout twice).
  const merged = new Map<string, OddsRow>();
  for (const row of rows) {
    const hit = merged.get(row.label);
    if (hit) hit.percent += row.percent;
    else merged.set(row.label, { ...row });
  }
  return [...merged.values()].sort((a, b) => b.percent - a.percent);
}

/** The published odds as one line, for a card that has no room for a table. */
export function containerOddsLine(kind: ContainerKind): string {
  return containerOdds(kind)
    .map((r) => `${r.label} ${formatPercent(r.percent)}`)
    .join(' · ');
}

/**
 * Percent with just enough precision to be honest.
 *
 * Deliberately NOT `toFixed(1)`. The Big Smile Box's Cyber row is 0.01%, which one
 * decimal publishes as "0.0%" — not a rounding error but a false statement about the
 * odds of a paid randomised item. So the value is rendered at full four-decimal
 * precision and only trailing ZEROS are removed: 94.5 stays "94.5%", 89.49 stays
 * "89.49%", 0.01 stays "0.01%", 89 collapses to "89%".
 */
export function formatPercent(percent: number): string {
  const shown = percent.toFixed(4);
  return `${shown.replace(/0+$/, '').replace(/\.$/, '')}%`;
}

/**
 * Open one container.
 *
 * `owned` is the player's unlocked set. A character pull that lands on someone the
 * player already has converts to `DUPLICATE_COINS[rarity]` — which, while
 * `ROSTER_GATED` is false and therefore *everyone* counts as owned, is every
 * character pull. That is deliberate: the reward is always real, and flipping the
 * gate switches the same code path from coins to fighters with no other change.
 *
 * Pure: takes an `Rng`, mutates nothing, returns what was won.
 */
export interface ContainerResult {
  kind: ContainerKind;
  reward: Reward;
  /** Set when the roll produced a character the player already owned. */
  duplicateOf?: CharacterId;
}

export function rollContainer(
  kind: ContainerKind,
  rng: Rng,
  owned: ReadonlySet<CharacterId>,
): ContainerResult {
  const def: ContainerDef = CONTAINERS[kind];
  const total = totalWeight(def.entries);
  const entry = def.entries[weightedIndex(rng, def.entries.map((e) => e.weight), total)];
  const reward = emptyReward();

  if (!entry) return { kind, reward };

  if (entry.coins) reward.coins += entry.coins;
  if (entry.gems) reward.gems += entry.gems;

  if (entry.characterRarity) {
    const pool = CHARACTERS_BY_RARITY[entry.characterRarity] ?? [];
    // Prefer someone the player does NOT have. Rolling blind and then converting
    // would mean a Fire Box could hand you a duplicate while an unowned Legendary
    // sat in the same pool — technically "fair", and universally read as a bug.
    const wanted = pool.filter((id) => !owned.has(id));
    if (wanted.length > 0) {
      const id = rng.pick(wanted)!;
      reward.characters.push(id);
    } else {
      const id = rng.pick(pool);
      reward.coins += DUPLICATE_COINS[entry.characterRarity];
      if (id) return { kind, reward, duplicateOf: id };
    }
  }

  return { kind, reward };
}

/** Coins a character-shaped reward is worth when it cannot be granted. */
export function duplicateValue(id: CharacterId): number {
  return DUPLICATE_COINS[CHARACTERS[id].rarity];
}
