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

import { CHARACTER_IDS, CHARACTERS, LEVEL_MAX, LEVEL_MIN, clampLevel, type CharacterId } from '../rules.ts';
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
// ⚠️ `../state.ts` is the SIM's state module, not this file. Two files, same name.
import { MAX_FIGHTERS, MIN_FIGHTERS } from '../state.ts';
import { createRng, randomSeed } from './rng.ts';
import { rollContainer, type ContainerResult } from './containers.ts';
import {
  claimable, placementBanksChestWin, placementCoins, placementTrophyDelta, resolveReward,
} from './trophyRoad.ts';
import { levelUpCost, type LevelPrice } from './levels.ts';
import { emptyReward, mergeReward, type Reward } from './reward.ts';

// ─────────────────────────────────────────────────────────────────────────────
// Shape
// ─────────────────────────────────────────────────────────────────────────────

/** What the last finished match paid, so the trophy road can celebrate it once. */
export interface LastMatch {
  /**
   * First place. **Not "top half"** — at six seats 2nd is a good result and still not a win,
   * which is what every screen reading this field already means by the word.
   */
  won: boolean;
  trophies: number;
  coins: number;
  chests: number;
  /**
   * 0-based finishing position, and `seats` is how many finished.
   *
   * ⚠️ **ADDITIVE, AND OLD BLOBS PREDATE THEM.** `deserialize` fills them from `won`
   * (`place = won ? 0 : 1`, `seats = 2`), which is exactly what a stored two-outcome result
   * meant — so a save written before the curve reads back as the 1v1 it was, rather than as a
   * defaulted 1st place. Every screen that only reads `won` keeps working untouched.
   */
  place: number;
  seats: number;
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
  /**
   * Character levels the player has PAID FOR, 2..`LEVEL_MAX`.
   *
   * Sparse on purpose — a character at level 1 is absent rather than stored as 1. Two
   * reasons, and the second is the one that matters: the blob stays small, and
   * `characterLevel()` returns `LEVEL_MIN` for anything it has never heard of, so a
   * character added to `rules.ts` tomorrow reads as level 1 today with no migration.
   */
  levels: Partial<Record<CharacterId, number>>;
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
    levels: {},
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
 * Bank one finished match at a known PLACE in a field of `seats`.
 *
 * Trophies, coins and the win-count toward a free chest, all in one call, returning what
 * changed so a screen can animate it. Milestones are NOT auto-granted — see the claiming note
 * in `trophyRoad.ts`.
 *
 * ── 🚨 THE 1v1 PATH RUNS THROUGH HERE, AND THAT IS THE POINT ────────────────
 *
 * `applyMatchResult(state, won)` is now `applyMatchPlacement(state, won ? 0 : 1, MIN_FIGHTERS)`
 * — **one code path, not two.** The alternative (keep the old body, add a parallel placement
 * body) is the shape `rules.ts` documents six defects of: *a rule stated once and implemented
 * twice*. Two bodies would let a future retune move the six-seat curve and leave the duel
 * behind, and nothing would go red.
 *
 * ⚠️ **The cost of that choice is that "N=2 is unchanged" becomes true BY CONSTRUCTION, and a
 * test which asserts it against this same code would be tautological.** So it is not asserted
 * here: `economy.test.mjs` section 3b proves it against a FROZEN ORACLE — the pre-curve body
 * transcribed from `MATCH_PAYOUT` and `trophyLoss` alone, replayed match-for-match over a
 * seeded career and compared on the whole serialised state. See the header there for what that
 * proof holds over and what it deliberately excludes.
 */
export function applyMatchPlacement(
  state: EconomyState,
  place: number,
  seats: number,
): LastMatch {
  const delta = placementTrophyDelta(place, seats, state.trophies);
  state.trophies = Math.max(0, state.trophies + delta);
  state.bestTrophies = Math.max(state.bestTrophies, state.trophies);

  const coins = placementCoins(place, seats);
  state.coins += coins;

  let chests = 0;
  if (placementBanksChestWin(place, seats)) {
    state.winsTowardChest++;
    while (state.winsTowardChest >= MATCH_PAYOUT.winsPerChest) {
      state.winsTowardChest -= MATCH_PAYOUT.winsPerChest;
      chests++;
    }
    state.containers.chest += chests;
  }

  const result: LastMatch = { won: place === 0, trophies: delta, coins, chests, place, seats, seen: false };
  state.lastMatch = result;
  return result;
}

/**
 * Bank one finished DUEL. The two-outcome form every shipped call site still uses.
 *
 * Kept as its own exported function rather than folded into an optional argument, for the same
 * reason `sim.ts:createMatch` kept its legacy 3-argument form: 1v1 is not going away, `won` is
 * what `profile.ts:recordResult` and `matchScreen.ts` actually have, and a boolean that has to
 * be translated into a placement at every call site is a translation that will eventually be
 * done backwards somewhere.
 */
export function applyMatchResult(state: EconomyState, won: boolean): LastMatch {
  return applyMatchPlacement(state, won ? 0 : 1, MIN_FIGHTERS);
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
// Character levels
// ─────────────────────────────────────────────────────────────────────────────

/**
 * This character's level for this player. `LEVEL_MIN` for anything never upgraded.
 *
 * Clamped on the way OUT as well as on the way in. That is not belt-and-braces: it is the
 * property that lets the UI and the sim be handed the same number and be unable to
 * disagree about it, even if a future migration writes something odd into the blob.
 */
export function characterLevel(state: EconomyState, id: CharacterId): number {
  return clampLevel(state.levels[id] ?? LEVEL_MIN);
}

/** What the next level costs, or `null` when this character is already maxed. */
export function nextLevelPrice(state: EconomyState, id: CharacterId): LevelPrice | null {
  return levelUpCost(id, characterLevel(state, id));
}

/**
 * Whether the player could level this character right now. Maxed, broke and NOT OWNED are
 * all the same answer.
 *
 * ⚠️ Ownership goes through `isUnlocked`, never through `ROSTER_GATED` directly. That is
 * the standing rule for this module: availability is DERIVED, so flipping the flag turns
 * the level ladder into an owned-characters-only feature with no edit here and no edit in
 * `characterSelect.ts`. While the flag is false `isUnlocked` is true for everything, so
 * this clause costs nothing today and is correct the moment it does not.
 */
export function canLevelUp(state: EconomyState, id: CharacterId): boolean {
  if (!isUnlocked(state, id)) return false;
  const price = nextLevelPrice(state, id);
  return price !== null && state.coins >= price.coins && state.gems >= price.gems;
}

/**
 * Buy one level for one character.
 *
 * Returns the new level and what it cost, or `null` if it did not happen — maxed out, or
 * not affordable. Both are the same answer to a click handler ("no"), which is what lets
 * `characterSelect.ts` call this optimistically, exactly as the road screen already calls
 * `claimMilestone`.
 *
 * ⚠️ THE SPEND AND THE GRANT ARE ONE OPERATION AND CANNOT SEPARATE. `spend()` is
 * all-or-nothing and is checked BEFORE the level is written, so there is no ordering in
 * which a player is charged for a level they did not receive. This matters more than usual
 * here: the router writes `?screen=<name>` and a mid-match reload restarts the match, so
 * an upgrade bought between matches has to be atomic against a page load that can arrive
 * at any moment. It is, because the only durable record is the blob `serialize()` writes
 * after this returns — either both halves are in it or neither is.
 */
export function levelUp(
  state: EconomyState,
  id: CharacterId,
): { level: number; spent: LevelPrice } | null {
  if (!isUnlocked(state, id)) return null;
  const price = nextLevelPrice(state, id);
  if (!price) return null;
  if (!spend(state, price.coins, price.gems)) return null;
  const level = clampLevel(characterLevel(state, id) + 1);
  state.levels[id] = level;
  return { level, spent: price };
}

/**
 * Total coins the player has ever sunk into levels, reconstructed from the levels they
 * hold rather than tracked as a counter.
 *
 * Derived on purpose. A counter can drift from the thing it counts (that is the whole
 * shape of `DECISIONS §13`); this cannot, because it is computed from the same table the
 * purchase reads. Used by the economy audit to close the sources-and-sinks loop.
 */
export function coinsSpentOnLevels(state: EconomyState): number {
  let total = 0;
  for (const id of CHARACTER_IDS) {
    const level = characterLevel(state, id);
    for (let n = LEVEL_MIN; n < level; n++) total += levelUpCost(id, n)?.coins ?? 0;
  }
  return total;
}

/** How far the whole roster is levelled, 0..1 — one number for a progression readout. */
export function rosterLevelProgress01(state: EconomyState): number {
  const span = (LEVEL_MAX - LEVEL_MIN) * CHARACTER_IDS.length;
  if (span <= 0) return 1;
  let gained = 0;
  for (const id of CHARACTER_IDS) gained += characterLevel(state, id) - LEVEL_MIN;
  return gained / span;
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
    levels: {},
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

  // Levels are the one persisted field a player PAYS for, so the validation is stricter
  // than "is it a number": an out-of-range value is clamped into 1..LEVEL_MAX rather than
  // discarded (a blob written by a build with a longer ladder must not silently reset a
  // paid-for character to 1), and a level of exactly LEVEL_MIN is dropped so the sparse
  // representation has exactly one spelling. An unknown character id is dropped entirely —
  // same rule `unlocked` already uses.
  if (o.levels && typeof o.levels === 'object') {
    const held = o.levels as Record<string, unknown>;
    for (const id of CHARACTER_IDS) {
      const raw = held[id];
      if (typeof raw !== 'number' || !Number.isFinite(raw)) continue;
      const level = clampLevel(raw);
      if (level > LEVEL_MIN) state.levels[id] = level;
    }
  }

  if (o.lastMatch && typeof o.lastMatch === 'object') {
    const lm = o.lastMatch as Record<string, unknown>;
    const won = lm.won === true;
    // ── The pre-curve blob has no `place`/`seats`, and the fallback is not a default ──
    // A stored two-outcome result MEANT first-or-second of two, so that is what it reads back
    // as. Defaulting to `{ place: 0, seats: 2 }` would silently promote every stored loss to a
    // win on the results card. `seats` is validated against the sim's own bounds and `place`
    // against `seats`, because a blob claiming 4th of 2 would make `placementRank01` throw
    // inside a screen render — and this module's whole contract is that a bad blob is a data
    // problem solved here, never a crash the boot path discovers.
    const seats = Number.isInteger(lm.seats)
      && (lm.seats as number) >= MIN_FIGHTERS && (lm.seats as number) <= MAX_FIGHTERS
      ? lm.seats as number
      : MIN_FIGHTERS;
    const place = Number.isInteger(lm.place)
      && (lm.place as number) >= 0 && (lm.place as number) < seats
      ? lm.place as number
      : (won ? 0 : seats - 1);
    state.lastMatch = {
      // DERIVED from `place`, never copied from the blob: `won` and `place` are two spellings
      // of one fact, and a hand-edited blob claiming a win at 4th of six must resolve to one
      // answer rather than render a victory card over a fourth-place payout.
      won: place === 0,
      trophies: typeof lm.trophies === 'number' && Number.isFinite(lm.trophies) ? Math.trunc(lm.trophies) : 0,
      coins: num(lm.coins, 0),
      chests: num(lm.chests, 0),
      place,
      seats,
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
    levels: { ...state.levels },
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
