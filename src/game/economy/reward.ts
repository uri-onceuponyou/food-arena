/**
 * `Reward` — the one shape everything in the economy pays out in.
 *
 * A trophy-road milestone, an opened chest, a purchased box and a (future) store
 * purchase all produce exactly this. That is what lets the reveal card, the claim
 * animation and the persistence layer be written once instead of four times, and it
 * is why `grantProduct` (the function a payment webhook would eventually call) is a
 * two-line wrapper rather than its own subsystem.
 *
 * Pure data, no methods: a `Reward` is describable, mergeable and serialisable, and
 * `state.ts` is the only thing that ever applies one to a player.
 */

import type { CharacterId, ItemId } from '../rules.ts';
import { CHARACTERS, ITEMS } from '../rules.ts';
import { CONTAINERS, type ContainerKind } from './tuning.ts';

export interface Reward {
  coins: number;
  gems: number;
  /** Unopened containers granted, by kind. */
  containers: Partial<Record<ContainerKind, number>>;
  /** Characters newly unlocked. Never contains one the player already owned — a
   *  duplicate is converted to `coins` before it gets here. */
  characters: CharacterId[];
  /**
   * Loadout items newly owned. Same contract as `characters` and for the same reason:
   * a duplicate is converted to `coins` by whatever produced the reward
   * (`rollContainer`, `resolveReward`), so this array never carries one the player
   * already had.
   *
   * ── 🚨 THIS FIELD IS WHY THE FEATURE WAS RED, AND THE SHAPE OF THAT BUG ─────
   * `tuning.ts` declared item rows in every container, `ITEMS_BY_RARITY` existed, and
   * the trophy road carried seven `itemSurprise` nodes — while this interface had no
   * items field and `rollContainer` had no item branch, so **nothing in the economy
   * could award an item**. The first attempted fix taught `containerOdds()` to PUBLISH
   * the item rows without teaching the roller to produce one, which is worse than the
   * omission: a paid box whose disclosure sheet promises a drop that cannot occur.
   * The rule that came out of it, and it governs every edit to this file:
   * **publish an outcome only once something can genuinely produce it.**
   */
  items: ItemId[];
}

export function emptyReward(): Reward {
  return { coins: 0, gems: 0, containers: {}, characters: [], items: [] };
}

export function isEmptyReward(r: Reward): boolean {
  return r.coins === 0 && r.gems === 0 && r.characters.length === 0 && r.items.length === 0
    && Object.values(r.containers).every((n) => !n);
}

/** "Box" -> "Boxes", "Chest" -> "Chests". Every container name in `tuning.ts` ends
 *  in one or the other, so the sibilant rule covers all of them. */
export function pluralise(name: string, n: number): string {
  if (n === 1) return name;
  return /[sxz]$/i.test(name) ? `${name}es` : `${name}s`;
}

/** Fold `b` into `a` in place and return it. */
export function mergeReward(a: Reward, b: Reward): Reward {
  a.coins += b.coins;
  a.gems += b.gems;
  for (const [kind, n] of Object.entries(b.containers) as [ContainerKind, number][]) {
    a.containers[kind] = (a.containers[kind] ?? 0) + n;
  }
  for (const id of b.characters) if (!a.characters.includes(id)) a.characters.push(id);
  for (const id of b.items) if (!a.items.includes(id)) a.items.push(id);
  return a;
}

/**
 * Human-readable lines for a reward, in the order a reveal card should show them.
 *
 * Built here rather than in the screen so the trophy road, the (future) shop and any
 * test can describe a payout identically — and so a new reward type is one case
 * here instead of a bug in three renderers.
 *
 * ── 🚨 ITEMS ARE EMITTED LAST, AND THE POSITION IS LOAD-BEARING ─────────────
 * `ui/screens/trophyRoad.ts:rewardIcons()` builds its icon array POSITIONALLY — "in
 * exactly the order `describeReward()` emits them: characters, then containers, then
 * coins, then gems" — and pairs `marks[i]` with `lines[i]`. Inserting items anywhere
 * but the end would silently shift every icon after them onto the wrong label: a
 * Hamburger Box icon captioned "Squid Ink". Appending instead runs off the end of
 * `marks`, where that renderer already falls back to `emojiIcon(line.emoji)` — so the
 * item line draws its own glyph and every other row stays paired.
 *
 * That file is a different owner's, which is why this is a constraint honoured here
 * rather than a fix made there. 🔴 REPORTED: `rewardIcons` should learn the real item
 * icons in `ui/icons/items.ts`; until it does, an item reveal shows 🎁.
 *
 * ⚠️ And 🎁 is `milestoneFace`'s glyph for an UNREVEALED road surprise. Reusing it for
 * the revealed item is deliberate — one mark means "loadout item" everywhere — but it
 * is a placeholder for a real icon, not a considered piece of art direction. `ItemDef`
 * has no `emoji` field (characters and containers both do) and `rules.ts` is not this
 * file set's to edit, so the alternative was inventing a per-item emoji map here: a
 * second registry of the same ten things, in the file least likely to be updated when
 * an eleventh arrives.
 */
export function describeReward(r: Reward): { emoji: string; label: string }[] {
  const out: { emoji: string; label: string }[] = [];
  for (const id of r.characters) {
    out.push({ emoji: CHARACTERS[id].emoji, label: CHARACTERS[id].name });
  }
  for (const [kind, n] of Object.entries(r.containers) as [ContainerKind, number][]) {
    if (!n) continue;
    const def = CONTAINERS[kind];
    out.push({ emoji: def.emoji, label: n > 1 ? `${n} ${pluralise(def.name, n)}` : def.name });
  }
  if (r.coins > 0) {
    out.push({ emoji: '🪙', label: `${r.coins.toLocaleString()} ${pluralise('Coin', r.coins)}` });
  }
  if (r.gems > 0) {
    out.push({ emoji: '💎', label: `${r.gems.toLocaleString()} ${pluralise('Gem', r.gems)}` });
  }
  // LAST. See the header — `trophyRoad.ts:rewardIcons` pairs icons with these lines by
  // index and only degrades gracefully past the end of its own array.
  for (const id of r.items) {
    out.push({ emoji: ITEM_EMOJI, label: ITEMS[id].name });
  }
  return out;
}

/** The one glyph that means "loadout item". Shared with `milestoneFace`'s road node so
 *  the surprise and the thing it turns into are visibly the same kind of reward. */
export const ITEM_EMOJI = '🎁';
