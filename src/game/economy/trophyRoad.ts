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
