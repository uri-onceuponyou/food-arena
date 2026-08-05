/**
 * Economy — currency, chests, boxes, the trophy road, unlocks and the (not yet live)
 * real-money store.
 *
 * Pure logic in the spirit of `game/sim.ts`: no DOM, no Three.js, no wall clock, no
 * `Math.random` outside `randomSeed()`. Runs and is asserted under plain Node —
 * `node src/game/economy/economy.test.mjs`.
 *
 * ── Where to look ───────────────────────────────────────────────────────────
 *   * `tuning.ts`     EVERY NUMBER. Retune here and nowhere else.
 *   * `rng.ts`        seeded determinism.
 *   * `reward.ts`     the one payout shape.
 *   * `containers.ts` chest/box rolls AND the published odds, from one table.
 *   * `trophyRoad.ts` the curve and what a node is worth.
 *   * `levels.ts`     character levels 1-15: what one costs, and who the AI mirrors.
 *   * `store.ts`      real-money SKUs. Priced, fulfillable, deliberately not live.
 *   * `state.ts`      the persisted player state and every operation on it.
 */

export * from './tuning.ts';
export * from './rng.ts';
export * from './reward.ts';
export * from './containers.ts';
export * from './trophyRoad.ts';
export * from './levels.ts';
export * from './store.ts';
export * from './state.ts';
