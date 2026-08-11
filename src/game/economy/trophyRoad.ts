/**
 * The trophy road: the curve, and what a node on it is worth.
 *
 * Pure queries over `TROPHY_ROAD` in `tuning.ts` plus the trophy arithmetic itself.
 * No numbers live here — every literal you might expect to find in this file is in
 * `tuning.ts`, because an economy you cannot retune from one place is an economy
 * nobody retunes.
 *
 * ── Claiming is manual, and that is a design decision ───────────────────────
 * The prototype auto-granted every milestone the instant you crossed it, queueing
 * reveal cards. Every shipped brawler makes you TAP the node instead, for two
 * reasons that both apply here: the reward lands when the player is looking at it
 * rather than in a modal stack after a match, and the road gets a real, satisfying
 * control on it instead of being a read-only chart. `claimed` therefore tracks
 * trophy THRESHOLDS, not indices — so inserting a milestone into the middle of the
 * table cannot silently re-lock or double-grant a player's existing progress.
 */

import type { CharacterId } from '../rules.ts';
import { CHARACTERS } from '../rules.ts';
// ⚠️ `../state.ts` is the SIM's state module, not `./state.ts` next door — two files, same
// name, and this is the only import in `economy/` that reaches for the sim's seat bounds.
// It is imported rather than restated for the same reason `levels.ts` imports `LEVEL_MAX`:
// a payout curve that admits a seat count the sim refuses is a number nobody can spend.
import { MAX_FIGHTERS, MIN_FIGHTERS } from '../state.ts';
import {
  CONTAINERS,
  MATCH_PAYOUT,
  ROSTER_GATED,
  TROPHY_ROAD,
  type Milestone,
  type MilestoneReward,
} from './tuning.ts';
import { duplicateValue } from './containers.ts';
import { emptyReward, mergeReward, pluralise, type Reward } from './reward.ts';

// ─────────────────────────────────────────────────────────────────────────────
// Trophy arithmetic
// ─────────────────────────────────────────────────────────────────────────────

/**
 * Trophies lost for a defeat at a given standing.
 *
 * The prototype's formula for last place, verbatim, plus the grace band from
 * `MATCH_PAYOUT` — see the comment there for why a new player must not go backwards.
 */
export function trophyLoss(trophies: number): number {
  if (trophies < MATCH_PAYOUT.trophyLossGraceBelow) return 0;
  return Math.min(
    MATCH_PAYOUT.trophyLossCap,
    MATCH_PAYOUT.trophyLossBase + Math.floor(trophies / MATCH_PAYOUT.trophyLossPer),
  );
}

/** Signed trophy change for one finished match. */
export function trophyDelta(trophies: number, won: boolean): number {
  return won ? MATCH_PAYOUT.trophiesWin : -trophyLoss(trophies);
}

// ─────────────────────────────────────────────────────────────────────────────
// PLACEMENT — what 3rd of six is worth (`DECISIONS §57`)
// ─────────────────────────────────────────────────────────────────────────────

/**
 * A finisher's NORMALISED rank: 0 for first, 1 for last, at every seat count.
 *
 * `place` is **0-based**, matching `net/lobby.ts:LeagueMatchResult.placements` (an array in
 * finishing order) and `sim.ts`'s slot indices. The UI shows 1-based; nothing here does.
 *
 * 🚨 **THIS FUNCTION IS THE ANSWER TO §57's THIRD QUESTION**, and the reason there is no
 * per-seat-count table anywhere. Indexing a curve on `place` makes 3rd of four and 3rd of six
 * the same payout, when one is the bottom half of its field and the other is the top half.
 * Indexing on `place / (seats - 1)` makes them 0.667 and 0.400 and prices them apart.
 *
 * Refuses rather than clamps, in the house style of `sim.ts:createMatch` and
 * `net/lobby.ts:toWireSeats`: a silently clamped placement is a payout nobody can trace.
 */
export function placementRank01(place: number, seats: number): number {
  if (!Number.isInteger(seats) || seats < MIN_FIGHTERS || seats > MAX_FIGHTERS) {
    throw new RangeError(
      `placementRank01: ${seats} seats; the sim seats ${MIN_FIGHTERS}..${MAX_FIGHTERS}`
      + ' (see game/state.ts MIN_FIGHTERS / MAX_FIGHTERS)',
    );
  }
  if (!Number.isInteger(place) || place < 0 || place >= seats) {
    throw new RangeError(`placementRank01: place ${place} is outside 0..${seats - 1}`);
  }
  return place / (seats - 1);
}

/**
 * The curve's shape, as a weight in 0..1 that scales the whole win-to-loss span.
 *
 * 🚨 **THE ENDPOINTS ARE PINNED STRUCTURALLY, NOT ARITHMETICALLY.** The two early returns
 * run BEFORE `Math.pow`, so `w(0) === 0` and `w(1) === 1` hold for **every** exponent —
 * including 0 (where `Math.pow(0, 0)` is 1 in JS and would otherwise pay first place the
 * loser's rate), including Infinity, including NaN. Since a two-seat match only ever produces
 * `r ∈ {0, 1}`, **that is what makes the 1v1 payout unreachable from the steepness dial**, and
 * it is asserted against exactly those adversarial exponents rather than assumed.
 *
 * `steepness` is a parameter with the shipped default rather than a direct constant read, so
 * the tests and `tools/tmp/pc_lab.mjs` can drive alternative shapes through the SAME code the
 * game runs. A test that reimplements the shape it is checking cannot fail on a broken one.
 */
export function placementWeight01(
  rank01: number,
  steepness: number = MATCH_PAYOUT.placementSteepness,
): number {
  if (rank01 <= 0) return 0;
  if (rank01 >= 1) return 1;
  return Math.pow(rank01, steepness);
}

/**
 * Signed trophy change for one finisher.
 *
 * `trophies` is the finisher's CURRENT standing, because the loss term is a function of it —
 * the grace band and the escalating penalty are both properties of where the player already
 * is, and that does not change just because there are six of them.
 *
 * At `seats === MIN_FIGHTERS` this is `trophyDelta(trophies, place === 0)` exactly, and that
 * is proven against a frozen oracle rather than asserted (`economy.test.mjs` 3b).
 */
export function placementTrophyDelta(
  place: number,
  seats: number,
  trophies: number,
  steepness?: number,
): number {
  const w = placementWeight01(placementRank01(place, seats), steepness);
  const span = MATCH_PAYOUT.trophiesWin + trophyLoss(trophies);
  return Math.round(MATCH_PAYOUT.trophiesWin - w * span);
}

/**
 * Coins for one finisher. Never below `coinsLoss`, never above `coinsWin`, at any seat count.
 *
 * The floor is the endpoint pinning again rather than a `Math.max`: `w` is bounded in 0..1, so
 * the interpolation cannot leave the shipped pair. **Every finisher is paid**, which is the
 * participation rule `MATCH_PAYOUT` already states for the 1v1 loser, extended by construction
 * rather than by a new decision.
 */
export function placementCoins(place: number, seats: number, steepness?: number): number {
  const w = placementWeight01(placementRank01(place, seats), steepness);
  return Math.round(MATCH_PAYOUT.coinsWin - w * (MATCH_PAYOUT.coinsWin - MATCH_PAYOUT.coinsLoss));
}

/**
 * Whether this finish banks one win toward the free chest.
 *
 * ⚠️ **THE ONE PLACE THE CURVE IS A STEP RATHER THAN A RAMP, AND IT IS A COST.** `winsPerChest`
 * counts WINS, and `EconomyState.winsTowardChest` is an integer that `deserialize` floors — so
 * paying fractional chest credit would silently discard a player's progress on every reload.
 * A points-based faucet (credit `6 * (1 - r)` against an 18-point chest) IS exactly EV-neutral
 * and is the loosening path if Uri wants it, but it changes the meaning of a persisted field
 * and therefore needs a versioned migration. That is more than a payout curve should cost, so
 * the default takes the step and states its price instead:
 *
 *   for the 60%-strength player `pc_lab` simulates, chests per match run
 *   **0.600 (2 seats) · 0.429 (3) · 0.618 (4) · 0.515 (5) · 0.627 (6)** — flat to +-4.5% except
 *   at three seats, where it is **28.5% slower** because r = 0.5 falls exactly on 2nd of 3.
 *
 * The comparison is **strict**, which is what puts that odd-seat-count coin flip on the
 * conservative side: 2nd of three banks nothing. `<=` would have made it +28.5% instead —
 * the same magnitude in the direction that cannot be walked back.
 */
export function placementBanksChestWin(place: number, seats: number): boolean {
  return placementRank01(place, seats) < 0.5;
}

/**
 * The whole field's trophy deltas, best first — the array `net/lobby.ts:PlacementCurve` takes.
 *
 * That module documents the seam precisely: *"the curve comes in from the caller, `tuning.ts`
 * owns it when it exists, and this function does the arithmetic and nothing else."* This is it
 * existing. `net/lobby.ts:twoSeatCurve(loss)` is `placementCurve(2, standing)` and can be
 * replaced by it — 🔴 that patch is reported rather than made, because `src/net/` is not this
 * file set's to edit.
 *
 * ⚠️ **Every entry is priced at the SAME standing**, which is a real simplification and is
 * stated rather than hidden: the loss term depends on the loser's own trophy count, so a field
 * whose members sit at different standings needs one call per finisher
 * (`placementTrophyDelta`), not one curve. This form exists for the league's single-standing
 * case and for display; the per-player path is the function above.
 */
export function placementCurve(seats: number, trophies: number, steepness?: number): number[] {
  placementRank01(0, seats); // validate `seats` once, with the same message everything else uses
  return Array.from({ length: seats }, (_, place) =>
    placementTrophyDelta(place, seats, trophies, steepness));
}

// ─────────────────────────────────────────────────────────────────────────────
// Road queries
// ─────────────────────────────────────────────────────────────────────────────

/** Every milestone, in ascending trophy order. */
export function milestones(): readonly Milestone[] {
  return TROPHY_ROAD;
}

/** The highest trophy threshold on the road — where the pin stops moving. */
export function roadEnd(): number {
  return TROPHY_ROAD.length > 0 ? TROPHY_ROAD[TROPHY_ROAD.length - 1].trophies : 0;
}

/** Milestones the player has reached but not yet claimed. */
export function claimable(trophies: number, claimed: readonly number[]): Milestone[] {
  return TROPHY_ROAD.filter((m) => trophies >= m.trophies && !claimed.includes(m.trophies));
}

/** The next milestone not yet reached, or null once the road is complete. */
export function nextMilestone(trophies: number): Milestone | null {
  return TROPHY_ROAD.find((m) => trophies < m.trophies) ?? null;
}

/**
 * Progress toward the next node, for the hero bar.
 *
 * `from` is the previous node's threshold rather than zero, so the bar measures the
 * gap the player is actually crossing — a bar running 0..4000 barely moves in a
 * session and reads as broken.
 */
export function roadProgress(trophies: number): {
  from: number;
  to: number;
  progress01: number;
  next: Milestone | null;
} {
  const next = nextMilestone(trophies);
  if (!next) return { from: roadEnd(), to: roadEnd(), progress01: 1, next: null };
  const idx = TROPHY_ROAD.indexOf(next);
  const from = idx > 0 ? TROPHY_ROAD[idx - 1].trophies : 0;
  const span = next.trophies - from;
  const progress01 = span > 0 ? Math.min(1, Math.max(0, (trophies - from) / span)) : 0;
  return { from, to: next.trophies, progress01, next };
}

// ─────────────────────────────────────────────────────────────────────────────
// What a node is actually worth
// ─────────────────────────────────────────────────────────────────────────────

/**
 * Turn a milestone's authored reward into the concrete payout this player gets.
 *
 * The one interesting case is a CHARACTER node the player cannot receive — either
 * because they already own that character, or because `ROSTER_GATED` is false and
 * therefore everyone counts as owned. Rather than grant nothing (a road node that
 * pays nothing is worse than a road with no node there), it resolves to the
 * character's duplicate value in coins, exactly as a box does.
 *
 * That substitution is why the road is honest today and why flipping `ROSTER_GATED`
 * is a one-line change: the same table, the same claim path, a different payout.
 */
export function resolveReward(reward: MilestoneReward, owned: ReadonlySet<CharacterId>): Reward {
  const out = emptyReward();
  switch (reward.type) {
    case 'coins':
      out.coins += reward.amount;
      break;
    case 'gems':
      out.gems += reward.amount;
      break;
    case 'container':
      out.containers[reward.kind] = (out.containers[reward.kind] ?? 0) + reward.count;
      break;
    case 'character':
      if (ROSTER_GATED && !owned.has(reward.id)) out.characters.push(reward.id);
      else out.coins += duplicateValue(reward.id);
      break;
    case 'bundle':
      for (const part of reward.parts) mergeReward(out, resolveReward(part, owned));
      break;
  }
  return out;
}

/**
 * How a node draws on the road — icon, headline, and whether it is a character node.
 *
 * A character node keeps its character face and name even when it will pay out in
 * coins: the road is a map of what the game HAS, and redrawing "Sushi" as "900
 * Coins" would hide the roster ladder that is the whole point of the track. The
 * substitution is disclosed on the node itself instead (`payoutNote`), which is the
 * honest version — the player is told both what the milestone is and what they will
 * actually receive.
 */
export interface MilestoneFace {
  emoji: string;
  title: string;
  isCharacter: boolean;
  /** Set only when the payout differs from the title. */
  payoutNote?: string;
}

export function milestoneFace(reward: MilestoneReward, owned: ReadonlySet<CharacterId>): MilestoneFace {
  switch (reward.type) {
    case 'coins':
      return { emoji: '🪙', title: `${reward.amount.toLocaleString()} Coins`, isCharacter: false };
    case 'gems':
      return { emoji: '💎', title: `${reward.amount.toLocaleString()} Gems`, isCharacter: false };
    case 'container': {
      const def = CONTAINERS[reward.kind];
      return {
        emoji: def.emoji,
        title: reward.count > 1
          ? `${reward.count} ${pluralise(def.name, reward.count)}`
          : def.name,
        isCharacter: false,
      };
    }
    case 'character': {
      const def = CHARACTERS[reward.id];
      const grantable = ROSTER_GATED && !owned.has(reward.id);
      return {
        emoji: def.emoji,
        title: def.name,
        isCharacter: true,
        payoutNote: grantable
          ? undefined
          : `owned · 🪙 ${duplicateValue(reward.id).toLocaleString()}`,
      };
    }
    case 'bundle':
      return { emoji: '🎉', title: 'Grand Prize', isCharacter: false };
  }
}
