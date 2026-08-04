/**
 * `EconomyState` — everything the economy remembers about one player, and every
 * operation that changes it.
 *
 * ── Shape of this module ────────────────────────────────────────────────────
 * Same contract as `game/sim.ts`: plain data, mutated in place by functions that
 * take it as their first argument, returning the EVENTS that happened rather than a
 * new state. No DOM, no localStorage, no Three.js, no `Math.random`, no
 * `Date.now()`. That is what makes the whole thing runnable and assertable under
 * plain Node (`economy.test.mjs`) with no browser and no test framework.
 *
 * `src/ui/screens/profile.ts` is the only thing that knows this state is persisted,
 * and it persists it by handing the blob from `serialize()` to localStorage. The
 * validation on the way back in lives HERE, next to the shape it is validating, so a
 * hand-edited or stale blob is a data problem this module solves once rather than a
 * crash the boot path discovers.
 *
 * ── Determinism, and why the seed is persisted ─────────────────────────────
 * Every random outcome comes from `createRng(seed + rolls)` and `rolls` only ever
 * increases. Two consequences, both deliberate: a player's reward sequence survives a
 * reload, and it cannot be re-rolled by refreshing the page before opening a chest —
 * which is the oldest exploit in the genre and is free to prevent here.
 */

import { CHARACTER_IDS, type CharacterId } from '../rules.ts';
import {
  CONTAINERS,
  CONTAINER_KINDS,
  MATCH_PAYOUT,
  ROSTER_GATED,
  TROPHY_ROAD,
  STARTER_CHARACTER,
  STARTING_BALANCE,
  type ContainerKind,
} from './tuning.ts';
import { createRng, randomSeed } from './rng.ts';
import { rollContainer, type ContainerResult } from './containers.ts';
import { claimable, resolveReward, trophyDelta } from './trophyRoad.ts';
import { emptyReward, mergeReward, type Reward } from './reward.ts';

// ─────────────────────────────────────────────────────────────────────────────
// Shape
// ─────────────────────────────────────────────────────────────────────────────

/** What the last finished match paid, so the trophy road can celebrate it once. */
export interface LastMatch {
  won: boolean;
  trophies: number;
  coins: number;
  chests: number;
  /** Set true the first time a screen has shown it. */
  seen: boolean;
}

export interface EconomyState {
  trophies: number;
  /** High-water mark. Trophies can go down; this cannot, so a player's best run is
   *  still theirs after a losing streak. */
  bestTrophies: number;
  coins: number;
  gems: number;
  /** Unopened containers, by kind. */
  containers: Record<ContainerKind, number>;
  /** Trophy THRESHOLDS already claimed — see the note in `trophyRoad.ts`. */
  claimed: number[];
  unlocked: CharacterId[];
  /** Wins banked toward the next free chest. */
  winsTowardChest: number;
  lastMatch: LastMatch | null;
  /** Per-player RNG stream. */
  seed: number;
  rolls: number;
}

function emptyContainers(): Record<ContainerKind, number> {
  const out = {} as Record<ContainerKind, number>;
  for (const kind of CONTAINER_KINDS) out[kind] = 0;
  return out;
}

export function createEconomy(seed = randomSeed()): EconomyState {
  return {
    trophies: 0,
    bestTrophies: 0,
    coins: STARTING_BALANCE.coins,
    gems: STARTING_BALANCE.gems,
    containers: emptyContainers(),
    claimed: [],
    // A brand-new player owns exactly the starter. While `ROSTER_GATED` is false
    // this list is informational rather than restrictive — see `ownedSet`.
    unlocked: [STARTER_CHARACTER],
    winsTowardChest: 0,
    lastMatch: null,
    seed,
    rolls: 0,
  };
}

/**
 * The set every reward path tests against.
 *
 * ⚠️ While `ROSTER_GATED` is false this returns the WHOLE roster, not `unlocked`.
 * That single line is what keeps the game honest in its current state: nothing can
 * "unlock" a character that character select already lets you play, so every
 * character-shaped reward correctly resolves to its duplicate value instead. Flip
 * `ROSTER_GATED` and every one of them starts granting fighters, with no other edit.
 */
export function ownedSet(state: EconomyState): ReadonlySet<CharacterId> {
  return ROSTER_GATED ? new Set(state.unlocked) : new Set(CHARACTER_IDS);
}

export function isUnlocked(state: EconomyState, id: CharacterId): boolean {
  return ROSTER_GATED ? state.unlocked.includes(id) : true;
}

// ─────────────────────────────────────────────────────────────────────────────
// Applying a reward
// ─────────────────────────────────────────────────────────────────────────────

/** Add a reward to a player. The single mutation point for balances. */
export function grantReward(state: EconomyState, reward: Reward): void {
  state.coins += reward.coins;
  state.gems += reward.gems;
  for (const [kind, n] of Object.entries(reward.containers) as [ContainerKind, number][]) {
    state.containers[kind] = (state.containers[kind] ?? 0) + (n ?? 0);
  }
  for (const id of reward.characters) {
    if (!state.unlocked.includes(id)) state.unlocked.push(id);
  }
}

/** Spend, if affordable. Returns whether it happened — never goes negative. */
export function spend(state: EconomyState, coins: number, gems: number): boolean {
  if (state.coins < coins || state.gems < gems) return false;
  state.coins -= coins;
  state.gems -= gems;
  return true;
}

// ─────────────────────────────────────────────────────────────────────────────
// Match results
// ─────────────────────────────────────────────────────────────────────────────

/**
 * Bank one finished match.
 *
 * Trophies, coins and the win-count toward a free chest, all in one call, returning
 * what changed so a screen can animate it. Milestones are NOT auto-granted — see the
 * claiming note in `trophyRoad.ts`.
 */
export function applyMatchResult(state: EconomyState, won: boolean): LastMatch {
  const delta = trophyDelta(state.trophies, won);
  state.trophies = Math.max(0, state.trophies + delta);
  state.bestTrophies = Math.max(state.bestTrophies, state.trophies);

  const coins = won ? MATCH_PAYOUT.coinsWin : MATCH_PAYOUT.coinsLoss;
  state.coins += coins;

  let chests = 0;
  if (won) {
    state.winsTowardChest++;
    while (state.winsTowardChest >= MATCH_PAYOUT.winsPerChest) {
      state.winsTowardChest -= MATCH_PAYOUT.winsPerChest;
      chests++;
    }
    state.containers.chest += chests;
  }

  const result: LastMatch = { won, trophies: delta, coins, chests, seen: false };
  state.lastMatch = result;
  return result;
}

/** Wins still needed for the next free chest. */
export function winsToNextChest(state: EconomyState): number {
  return Math.max(0, MATCH_PAYOUT.winsPerChest - state.winsTowardChest);
}

// ─────────────────────────────────────────────────────────────────────────────
// Trophy road
// ─────────────────────────────────────────────────────────────────────────────

export function claimableMilestones(state: EconomyState) {
  return claimable(state.trophies, state.claimed);
}

/**
 * Claim one milestone by its trophy threshold.
 *
 * Returns null — and changes nothing — if the threshold is unknown, not yet reached,
 * or already claimed. All three are the same answer to the caller ("no"), and making
 * them one return value rather than three exceptions is what lets the road screen
 * call this optimistically from a click handler.
 */
export function claimMilestone(state: EconomyState, threshold: number): Reward | null {
  const milestone = claimable(state.trophies, state.claimed)
    .find((m) => m.trophies === threshold);
  if (!milestone) return null;

  const reward = resolveReward(milestone.reward, ownedSet(state));
  state.claimed.push(threshold);
  state.claimed.sort((a, b) => a - b);
  grantReward(state, reward);
  return reward;
}

/** Claim everything available, newest last. Used by "Claim All". */
export function claimAll(state: EconomyState): Reward {
  const out = emptyReward();
  for (const m of claimableMilestones(state)) {
    const got = claimMilestone(state, m.trophies);
    if (got) mergeReward(out, got);
  }
  return out;
}

// ─────────────────────────────────────────────────────────────────────────────
// Containers
// ─────────────────────────────────────────────────────────────────────────────

/**
 * Open one held container.
 *
 * The roll consumes `rolls`, which is persisted, so the outcome is fixed the moment
 * the container is held rather than the moment the button is pressed. Returns null
 * if the player holds none of that kind.
 */
export function openContainer(state: EconomyState, kind: ContainerKind): ContainerResult | null {
  if ((state.containers[kind] ?? 0) <= 0) return null;
  state.containers[kind]--;
  const rng = createRng(state.seed + state.rolls);
  state.rolls++;
  const result = rollContainer(kind, rng, ownedSet(state));
  grantReward(state, result.reward);
  return result;
}

/** Total unopened containers, for the inventory badge. */
export function totalContainers(state: EconomyState): number {
  return CONTAINER_KINDS.reduce((sum, kind) => sum + (state.containers[kind] ?? 0), 0);
}

/**
 * Buy a box with in-game currency.
 *
 * Earned currency only — this is not the real-money path (see `store.ts`), and a
 * container with `price: null` (every chest) is unbuyable by construction rather
 * than by a check someone can forget to write.
 */
export function buyContainer(
  state: EconomyState,
  kind: ContainerKind,
  currency: 'coins' | 'gems',
): boolean {
  const price = CONTAINERS[kind].price;
  if (!price) return false;
  const paid = currency === 'coins' ? spend(state, price.coins, 0) : spend(state, 0, price.gems);
  if (!paid) return false;
  state.containers[kind]++;
  return true;
}

// ─────────────────────────────────────────────────────────────────────────────
// Persistence
// ─────────────────────────────────────────────────────────────────────────────

/**
 * Validate an arbitrary parsed blob into a usable state.
 *
 * Every field is checked and defaulted independently. The failure mode this is
 * guarding is not malice, it is a shipped build reading a blob written by an earlier
 * one: an economy that throws on load takes the whole menu down, and a player who
 * loses their progress to a schema change never comes back.
 */
export function deserialize(raw: unknown): EconomyState {
  const base = createEconomy();
  if (!raw || typeof raw !== 'object') return base;
  const o = raw as Record<string, unknown>;

  const num = (v: unknown, fallback: number): number =>
    typeof v === 'number' && Number.isFinite(v) && v >= 0 ? Math.floor(v) : fallback;

  const state: EconomyState = {
    trophies: num(o.trophies, 0),
    bestTrophies: num(o.bestTrophies, 0),
    coins: num(o.coins, base.coins),
    gems: num(o.gems, base.gems),
    containers: emptyContainers(),
    claimed: [],
    unlocked: [STARTER_CHARACTER],
    winsTowardChest: num(o.winsTowardChest, 0),
    lastMatch: null,
    seed: num(o.seed, base.seed) || base.seed,
    rolls: num(o.rolls, 0),
  };

  if (o.containers && typeof o.containers === 'object') {
    const held = o.containers as Record<string, unknown>;
    for (const kind of CONTAINER_KINDS) state.containers[kind] = num(held[kind], 0);
  }

  if (Array.isArray(o.claimed)) {
    // Only thresholds that still exist on the road survive. A milestone removed from
    // `TROPHY_ROAD` must not linger as an unclaimable ghost, and a threshold that
    // MOVED is correctly treated as a new, claimable node — which is the forgiving
    // direction to be wrong in, since the alternative is a player who retuned into a
    // reward they can see and can never collect.
    const onRoad = new Set(TROPHY_ROAD.map((m) => m.trophies));
    const valid = new Set(
      (o.claimed as unknown[]).filter((t): t is number => typeof t === 'number' && onRoad.has(t)),
    );
    state.claimed = [...valid].sort((a, b) => a - b);
  }

  if (Array.isArray(o.unlocked)) {
    for (const id of o.unlocked as unknown[]) {
      if (typeof id === 'string'
        && (CHARACTER_IDS as readonly string[]).includes(id)
        && !state.unlocked.includes(id as CharacterId)) {
        state.unlocked.push(id as CharacterId);
      }
    }
  }

  if (o.lastMatch && typeof o.lastMatch === 'object') {
    const lm = o.lastMatch as Record<string, unknown>;
    state.lastMatch = {
      won: lm.won === true,
      trophies: typeof lm.trophies === 'number' && Number.isFinite(lm.trophies) ? Math.trunc(lm.trophies) : 0,
      coins: num(lm.coins, 0),
      chests: num(lm.chests, 0),
      seen: lm.seen === true,
    };
  }

  state.bestTrophies = Math.max(state.bestTrophies, state.trophies);
  return state;
}

/** The plain object to persist. Identity: `deserialize(serialize(s))` equals `s`. */
export function serialize(state: EconomyState): Record<string, unknown> {
  return {
    trophies: state.trophies,
    bestTrophies: state.bestTrophies,
    coins: state.coins,
    gems: state.gems,
    containers: { ...state.containers },
    claimed: [...state.claimed],
    unlocked: [...state.unlocked],
    winsTowardChest: state.winsTowardChest,
    lastMatch: state.lastMatch ? { ...state.lastMatch } : null,
    seed: state.seed,
    rolls: state.rolls,
  };
}

/**
 * Fold a pre-economy profile blob's loose currency fields in.
 *
 * `PlayerProfile` used to store `coins` and `gems` at the top level. Anyone who has
 * played this build already has such a blob in localStorage, and silently resetting
 * their balance to the default is the kind of thing that is trivially avoidable now
 * and impossible to apologise for later.
 */
export function adoptLegacyBalance(state: EconomyState, legacy: Record<string, unknown>): void {
  if (typeof legacy.coins === 'number' && Number.isFinite(legacy.coins) && legacy.coins >= 0) {
    state.coins = Math.floor(legacy.coins);
  }
  if (typeof legacy.gems === 'number' && Number.isFinite(legacy.gems) && legacy.gems >= 0) {
    state.gems = Math.floor(legacy.gems);
  }
}
