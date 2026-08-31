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

import type { CharacterId, ItemId, Rarity } from '../rules.ts';
import { CHARACTERS, ITEMS } from '../rules.ts';
import {
  CHARACTERS_BY_RARITY,
  CONTAINERS,
  DUPLICATE_COINS,
  ITEMS_BY_RARITY,
  ITEM_DUPLICATE_COINS,
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
  /** Set when the row is a character OR an item pull, so the sheet can colour the tier. */
  rarity?: Rarity;
  /** The characters this row can produce — the pool the player is drawing from. */
  pool?: CharacterId[];
  /**
   * The loadout items this row can produce.
   *
   * ⚠️ **A SEPARATE FIELD, NOT `pool` REUSED, AND THAT IS NOT TIDINESS.** Two shipped
   * renderers do `row.pool!.map((id) => CHARACTERS[id].name)` — `ui/screens/shop.ts`
   * and `ui/screens/trophyRoad.ts`. An `ItemId` in `pool` type-checks nowhere and
   * reads `CHARACTERS['squid_ink'].name` at runtime, which is a TypeError inside a
   * screen render. Both of those filter on `pool`, so an item row is simply skipped by
   * a renderer that has not been taught about items — the safe direction.
   * 🔴 REPORTED: `trophyRoad.ts:showOdds` names the character pools and not the item
   * pools; `shop.ts` (this file set's) names both.
   */
  itemPool?: ItemId[];
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
    } else if (entry.itemRarity) {
      // ── 🚨 THE ROW THAT MUST NOT LIE, AND ONCE DID ────────────────────────
      // Before the roller could grant an item this branch did not exist, so an item
      // entry fell through to the currency branch below with no `coins` and no `gems`
      // and was published to the player as the literal string **"Nothing"**. The first
      // repair wrote the honest label while `rollContainer` still could not produce an
      // item — trading a missing disclosure for a FALSE one, on the single surface in
      // this product that is a legal disclosure, for a container gems can buy. It was
      // reverted for that reason and rewritten here only alongside the roller below.
      // **The two halves of this file ship together or not at all.**
      const itemPool = ITEMS_BY_RARITY[entry.itemRarity] ?? [];
      if (itemPool.length === 0) {
        // A tier with no items cannot pay one out to ANYBODY — not "not to this
        // player", which is what an owned-everything pool means. `rollContainer` pays
        // this row's floor value in coins instead, so that is what is published. This
        // is unreachable while `rules.ts` ships ten items across six tiers; it is
        // written rather than asserted-away because `ITEMS_BY_RARITY`'s own header
        // states deleting one item empties a tier, and the failure mode of getting it
        // wrong is a published outcome that cannot occur.
        rows.push({
          label: `${ITEM_DUPLICATE_COINS[entry.itemRarity].toLocaleString()} coins`,
          percent,
        });
      } else {
        rows.push({
          label: `${entry.itemRarity} item`,
          percent,
          rarity: entry.itemRarity,
          itemPool,
        });
      }
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
 * `ownedItems` is the same idea one tier down, and it is the field that is genuinely
 * gated today: **there is no `ROSTER_GATED` for items and there must not be one.** A
 * new player owns exactly `STARTER_ITEM` — one of ten — so an item row hands over real,
 * unowned content from the very first chest, which is the entire reason a box is worth
 * opening while the roster gate is off.
 *
 * Pure: takes an `Rng`, mutates nothing, returns what was won.
 */
export interface ContainerResult {
  kind: ContainerKind;
  reward: Reward;
  /** Set when the roll produced a character the player already owned. */
  duplicateOf?: CharacterId;
  /** Set when the roll produced a loadout ITEM the player already owned. */
  duplicateItemOf?: ItemId;
}

/**
 * ── ⚠️ `ownedItems` IS REQUIRED, DELIBERATELY, AND A DEFAULT WOULD HAVE BEEN A BUG ──
 *
 * The obvious kindness here is `ownedItems: ReadonlySet<ItemId> = new Set()`, so the
 * three existing call sites keep compiling. That default reads "owns nothing", so a
 * caller that forgot to pass the player's set would hand out items the player already
 * has — silently, correctly-shaped, and only visible as a second copy of Squid Ink in
 * a loadout screen. Making it required turns every one of those into a `tsc` error,
 * which is the only class of check in this repo that cannot be forgotten. There are
 * exactly three call sites (`state.ts:openContainer` and two in `economy.test.mjs`)
 * and `tsc --noEmit` enumerates them for free.
 */
export function rollContainer(
  kind: ContainerKind,
  rng: Rng,
  owned: ReadonlySet<CharacterId>,
  ownedItems: ReadonlySet<ItemId>,
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

  // ── ITEMS: the same three rules as a fighter, on the same ladder ───────────
  // Prefer unowned · a duplicate converts to coins at `ITEM_DUPLICATE_COINS` (which IS
  // `DUPLICATE_COINS`, one ladder, see `tuning.ts`) · a row that cannot pay an item to
  // anybody pays that floor in coins instead. Uniform within the tier, because a
  // container row names exactly ONE tier — `ITEM_DROP_WEIGHT` only enters where a draw
  // spans a band, which is the trophy road's surprise and nothing here.
  if (entry.itemRarity) {
    const pool = ITEMS_BY_RARITY[entry.itemRarity] ?? [];
    const wanted = pool.filter((id) => !ownedItems.has(id));
    if (wanted.length > 0) {
      const id = rng.pick(wanted)!;
      reward.items.push(id);
    } else {
      // Empty tier and fully-owned tier are the same payout and NOT the same event:
      // only the second one has an item to name as the duplicate. `containerOdds`
      // publishes the first as coins and the second as an item row, and this is the
      // branch that makes both of those true.
      const id = rng.pick(pool);
      reward.coins += ITEM_DUPLICATE_COINS[entry.itemRarity];
      if (id) return { kind, reward, duplicateItemOf: id };
    }
  }

  return { kind, reward };
}

/** Coins a character-shaped reward is worth when it cannot be granted. */
export function duplicateValue(id: CharacterId): number {
  return DUPLICATE_COINS[CHARACTERS[id].rarity];
}

/** Coins an ITEM-shaped reward is worth when it cannot be granted. Same ladder as
 *  `duplicateValue` by construction — `ITEM_DUPLICATE_COINS` is `DUPLICATE_COINS`. */
export function itemDuplicateValue(id: ItemId): number {
  return ITEM_DUPLICATE_COINS[ITEMS[id].rarity];
}
