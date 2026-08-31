/**
 * Seeded, deterministic random numbers for the economy.
 *
 * ── Why this exists at all ──────────────────────────────────────────────────
 * `Math.random()` cannot be tested and cannot be balanced. A reward table whose
 * output you cannot reproduce is a table whose published odds you cannot verify,
 * whose "this chest feels stingy" bug report you cannot investigate, and whose
 * distribution you cannot assert — which matters here rather more than usual,
 * because once gems are purchasable the box odds are a legal disclosure (see the
 * warning on `ContainerEntry` in `tuning.ts`).
 *
 * So every roll in this module goes through an explicit `Rng` handed in by the
 * caller. `state.ts` derives one per roll from the player's persisted seed plus a
 * monotonic roll counter, so a player's sequence survives a reload and cannot be
 * re-rolled by refreshing the page; `economy.test.mjs` hands in a fixed seed and
 * gets the same sequence every run.
 *
 * mulberry32: 32-bit state, one multiply-xorshift round, passes gjrand's basic
 * suite. Chosen over an LCG (visible low-bit patterns at these tiny sample sizes)
 * and over anything cryptographic (pointless here, and 100x the cost).
 */

export interface Rng {
  /** Uniform in [0, 1). */
  next(): number;
  /** Uniform integer in [0, n). Returns 0 for n <= 0. */
  int(n: number): number;
  /** Uniform element, or `undefined` for an empty array. */
  pick<T>(items: readonly T[]): T | undefined;
}

/**
 * Mix an arbitrary integer into a well-distributed 32-bit seed.
 *
 * Load-bearing: seeds in practice are `playerSeed + rollIndex`, so consecutive rolls
 * differ by 1. Feeding near-identical seeds straight into mulberry32 correlates the
 * first output badly — chest #1 and chest #2 would open similarly. This is the
 * standard splitmix32 finaliser and it decorrelates them completely.
 */
function mixSeed(seed: number): number {
  let h = seed >>> 0;
  h = Math.imul(h ^ (h >>> 16), 0x21f0aaad);
  h = Math.imul(h ^ (h >>> 15), 0x735a2d97);
  return (h ^ (h >>> 15)) >>> 0;
}

export function createRng(seed: number): Rng {
  let state = mixSeed(Math.trunc(seed) || 0);

  const next = (): number => {
    state = (state + 0x6d2b79f5) >>> 0;
    let t = state;
    t = Math.imul(t ^ (t >>> 15), t | 1);
    t ^= t + Math.imul(t ^ (t >>> 7), t | 61);
    return ((t ^ (t >>> 14)) >>> 0) / 4294967296;
  };

  return {
    next,
    int(n) {
      return n > 0 ? Math.floor(next() * n) : 0;
    },
    pick(items) {
      return items.length > 0 ? items[Math.floor(next() * items.length)] : undefined;
    },
  };
}

/**
 * Pick an index from a weight list, weights summing to `total`.
 *
 * Split out from the container roller so it can be tested on its own, and so the
 * odds-disclosure code and the roller are provably reading the same array in the
 * same order. Falls through to the last index on floating-point shortfall rather
 * than returning -1 — a roll must always produce something.
 */
export function weightedIndex(rng: Rng, weights: readonly number[], total: number): number {
  if (weights.length === 0) return -1;
  const r = rng.next() * total;
  let acc = 0;
  for (let i = 0; i < weights.length; i++) {
    acc += weights[i];
    if (r < acc) return i;
  }
  return weights.length - 1;
}

/**
 * Pick an index from a weight list where the weights are ARBITRARY positive numbers
 * rather than percentages.
 *
 * `weightedIndex` above takes a pre-computed total because a container's weights are
 * asserted to sum to 100 and the disclosure code needs that same total. A trophy-road
 * surprise draws from a band whose membership depends on what the player already owns,
 * so there is no fixed total to hand in and computing it at the call site would be the
 * one number that could disagree with the array.
 *
 * Returns -1 for an empty list or a non-positive total, which the caller MUST handle —
 * both are reachable (an exhausted band) and neither may silently become index 0.
 */
export function weightedPick(rng: Rng, weights: readonly number[]): number {
  if (weights.length === 0) return -1;
  let total = 0;
  for (const w of weights) total += w > 0 ? w : 0;
  if (total <= 0) return -1;
  return weightedIndex(rng, weights, total);
}

/**
 * Offset that separates the trophy road's surprise-item stream from the container stream.
 *
 * ── WHY THE ROAD DOES NOT USE `rolls` ───────────────────────────────────────
 * Every container roll consumes `state.rolls`, so its outcome is fixed the moment the
 * container is held and cannot be re-rolled by reloading. A road node is different: it
 * sits there, claimable, next to six other claimable nodes, and **the player chooses the
 * order**. On the `seed + rolls` stream that ordering is a re-roll — claim 3,475 first
 * and 1,770 hands you a different item. So a road surprise is a function of the player's
 * seed and the node's THRESHOLD, and of nothing else that a player can move.
 *
 * ── AND THE TWO STREAMS MUST NOT COLLIDE ────────────────────────────────────
 * `createRng(seed + rolls)` and `createRng(seed + ROAD_SURPRISE_STREAM + threshold)`
 * produce the same sequence exactly when `rolls === ROAD_SURPRISE_STREAM + threshold`.
 * That condition does not mention the seed, so it is decidable rather than sampled:
 * with thresholds bounded by the road end (10,000) and this offset at one million, a
 * collision needs a player to have opened **1,000,030 containers**. `economy.test.mjs`
 * §14 asserts the arithmetic over every real threshold instead of trusting this comment.
 *
 * The `>>> 0` wraparound inside `mixSeed` does not widen that: it is applied to both
 * sides equally, so it maps colliding inputs to colliding inputs and nothing else.
 */
export const ROAD_SURPRISE_STREAM = 1_000_000;

/** The seed a given player's surprise at a given road threshold is drawn from. */
export function roadSurpriseSeed(playerSeed: number, threshold: number): number {
  return playerSeed + ROAD_SURPRISE_STREAM + threshold;
}

/**
 * A fresh, non-reproducible seed for a brand-new player.
 *
 * The only place in this module that is allowed to be non-deterministic, and it runs
 * exactly once per player, at profile creation. Everything downstream of it is a
 * pure function of this number.
 */
export function randomSeed(): number {
  return (Math.floor(Math.random() * 0xffffffff) >>> 0) || 1;
}
