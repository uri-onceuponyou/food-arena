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

import type { CharacterId } from '../rules.ts';
import { CHARACTERS } from '../rules.ts';
import { CONTAINERS, type ContainerKind } from './tuning.ts';

export interface Reward {
  coins: number;
  gems: number;
  /** Unopened containers granted, by kind. */
  containers: Partial<Record<ContainerKind, number>>;
  /** Characters newly unlocked. Never contains one the player already owned — a
   *  duplicate is converted to `coins` before it gets here. */
  characters: CharacterId[];
}

export function emptyReward(): Reward {
  return { coins: 0, gems: 0, containers: {}, characters: [] };
}

export function isEmptyReward(r: Reward): boolean {
  return r.coins === 0 && r.gems === 0 && r.characters.length === 0
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
  return a;
}

/**
 * Human-readable lines for a reward, in the order a reveal card should show them.
 *
 * Built here rather than in the screen so the trophy road, the (future) shop and any
 * test can describe a payout identically — and so a new reward type is one case
 * here instead of a bug in three renderers.
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
  return out;
}
