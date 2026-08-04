/**
 * Persisted player state.
 *
 * The menus need something to be *about* — a name on a badge, a win count, a level
 * bar that moves, a character that stays equipped between sessions. This is the
 * smallest honest version of that: localStorage, one JSON blob, validated on read so
 * a stale or hand-edited blob can never crash the boot path.
 *
 * ── This file is a THIN WRAPPER over `game/economy/`, on purpose ────────────
 * Nothing here is game balance and nothing here is economy logic. The roster, stats
 * and weapons live in `game/rules.ts`; every currency amount, reward table, trophy
 * threshold and drop rate lives in `game/economy/tuning.ts`. This file only does the
 * two things the economy module deliberately refuses to do — touch `localStorage`
 * and notify listeners — plus it remembers the handful of choices (name, equipped
 * fighter) that were never part of the economy.
 *
 * That split is what lets `economy.test.mjs` run the entire progression system under
 * plain Node with no browser, and it is why every method below is three lines.
 */

import { CHARACTER_IDS, type CharacterId } from '../../game/rules';
import {
  adoptLegacyBalance,
  applyMatchResult,
  buyContainer,
  claimAll,
  claimMilestone,
  claimableMilestones,
  createEconomy,
  deserialize as deserializeEconomy,
  isUnlocked,
  openContainer,
  ownedSet,
  serialize as serializeEconomy,
  totalContainers,
  winsToNextChest,
  type ContainerKind,
  type ContainerResult,
  type EconomyState,
  type LastMatch,
  type Reward,
} from '../../game/economy';

const STORAGE_KEY = 'food-arena.profile.v1';

/** XP needed per level. Flat on purpose — a curve is a live-ops decision, not a
 *  menu-layer one, and the bar has to read the same either way. */
export const XP_PER_LEVEL = 250;
export const XP_WIN = 100;
export const XP_LOSS = 35;

export interface ProfileData {
  name: string;
  wins: number;
  losses: number;
  xp: number;
  selected: CharacterId;
  /**
   * Trophies, currency, unlocks, unopened containers, claimed milestones and the
   * RNG stream. Owned by `game/economy/state.ts`, which also owns its validation.
   */
  economy: EconomyState;
}

const DEFAULT_NAME = 'Chef';

function isCharacterId(v: unknown): v is CharacterId {
  return typeof v === 'string' && (CHARACTER_IDS as readonly string[]).includes(v);
}

function num(v: unknown, fallback: number): number {
  return typeof v === 'number' && Number.isFinite(v) && v >= 0 ? v : fallback;
}

function defaults(): ProfileData {
  return {
    name: DEFAULT_NAME,
    wins: 0,
    losses: 0,
    xp: 0,
    selected: CHARACTER_IDS[0],
    economy: createEconomy(),
  };
}

function load(): ProfileData {
  try {
    const raw = localStorage.getItem(STORAGE_KEY);
    if (!raw) return defaults();
    const parsed = JSON.parse(raw) as Record<string, unknown>;

    const economy = deserializeEconomy(parsed.economy);
    // Blobs written before the economy existed carried `coins` and `gems` at the top
    // level. Anyone who has already played this build has one, and silently resetting
    // their balance is trivially avoidable now and impossible to apologise for later.
    if (parsed.economy === undefined) adoptLegacyBalance(economy, parsed);

    return {
      name: typeof parsed.name === 'string' && parsed.name.trim()
        ? parsed.name.slice(0, 16) : DEFAULT_NAME,
      wins: Math.floor(num(parsed.wins, 0)),
      losses: Math.floor(num(parsed.losses, 0)),
      xp: Math.floor(num(parsed.xp, 0)),
      selected: isCharacterId(parsed.selected) ? parsed.selected : CHARACTER_IDS[0],
      economy,
    };
  } catch {
    // Private-mode Safari throws on localStorage access. A menu must still boot.
    return defaults();
  }
}

export class PlayerProfile {
  private data: ProfileData;
  private readonly listeners = new Set<() => void>();

  constructor(data?: Partial<ProfileData>) {
    this.data = data ? { ...load(), ...data } : load();
  }

  get name(): string { return this.data.name; }
  get wins(): number { return this.data.wins; }
  get losses(): number { return this.data.losses; }
  get xp(): number { return this.data.xp; }
  get selected(): CharacterId { return this.data.selected; }

  /** 1-based, so a brand-new player is "Lv 1" rather than "Lv 0". */
  get level(): number { return Math.floor(this.data.xp / XP_PER_LEVEL) + 1; }
  /** 0..1 progress toward the next level — what the home screen's bar renders. */
  get levelProgress01(): number { return (this.data.xp % XP_PER_LEVEL) / XP_PER_LEVEL; }

  // ── Economy, read-only ────────────────────────────────────────────────────
  // Deliberately a façade rather than an exposed mutable object: every write goes
  // through a method below that commits and notifies, so no screen can change a
  // balance without the save and the re-render happening.

  /** The live economy state. Read freely; mutate only through the methods below. */
  get economy(): EconomyState { return this.data.economy; }

  get coins(): number { return this.data.economy.coins; }
  get gems(): number { return this.data.economy.gems; }
  get trophies(): number { return this.data.economy.trophies; }
  get bestTrophies(): number { return this.data.economy.bestTrophies; }
  get containers(): Readonly<Record<ContainerKind, number>> { return this.data.economy.containers; }
  get containerCount(): number { return totalContainers(this.data.economy); }
  get winsToNextChest(): number { return winsToNextChest(this.data.economy); }
  get lastMatch(): LastMatch | null { return this.data.economy.lastMatch; }

  /** Characters the player may equip. See `ROSTER_GATED` in `economy/tuning.ts` —
   *  while that is false this is the whole roster, which is why character select
   *  currently needs no gate. */
  get unlocked(): ReadonlySet<CharacterId> { return ownedSet(this.data.economy); }
  isUnlocked(id: CharacterId): boolean { return isUnlocked(this.data.economy, id); }

  /** Milestones reached but not yet claimed — the road's call-to-action badge. */
  get claimable() { return claimableMilestones(this.data.economy); }

  // ── Mutations ─────────────────────────────────────────────────────────────

  select(id: CharacterId): void {
    if (this.data.selected === id) return;
    this.data.selected = id;
    this.commit();
  }

  /**
   * Bank a finished match: win/loss record, XP, trophies, coins and progress toward
   * the next free chest, in one write.
   *
   * Returns what the match paid so a caller can celebrate it. `matchScreen.ts` calls
   * this and ignores the return value, which is fine — the trophy road picks the
   * same payout back up off `lastMatch` the next time it is opened.
   */
  recordResult(won: boolean): LastMatch {
    if (won) { this.data.wins++; this.data.xp += XP_WIN; }
    else { this.data.losses++; this.data.xp += XP_LOSS; }
    const paid = applyMatchResult(this.data.economy, won);
    this.commit();
    return paid;
  }

  /** Mark the last match's payout as already celebrated, so it shows once. */
  markLastMatchSeen(): void {
    const last = this.data.economy.lastMatch;
    if (!last || last.seen) return;
    last.seen = true;
    this.commit();
  }

  /** Claim one trophy-road milestone by threshold. Null if it is not claimable. */
  claimMilestone(threshold: number): Reward | null {
    const reward = claimMilestone(this.data.economy, threshold);
    if (reward) this.commit();
    return reward;
  }

  /** Claim everything currently available, as one merged reward. */
  claimAllMilestones(): Reward {
    const reward = claimAll(this.data.economy);
    this.commit();
    return reward;
  }

  /** Open one held container. Null if the player holds none of that kind. */
  openContainer(kind: ContainerKind): ContainerResult | null {
    const result = openContainer(this.data.economy, kind);
    if (result) this.commit();
    return result;
  }

  /** Buy a box with EARNED currency. Never a real-money path — see `economy/store.ts`. */
  buyContainer(kind: ContainerKind, currency: 'coins' | 'gems'): boolean {
    const ok = buyContainer(this.data.economy, kind, currency);
    if (ok) this.commit();
    return ok;
  }

  /** Subscribe to any change. Returns an unsubscribe function. */
  onChange(fn: () => void): () => void {
    this.listeners.add(fn);
    return () => this.listeners.delete(fn);
  }

  private commit(): void {
    try {
      localStorage.setItem(STORAGE_KEY, JSON.stringify({
        name: this.data.name,
        wins: this.data.wins,
        losses: this.data.losses,
        xp: this.data.xp,
        selected: this.data.selected,
        economy: serializeEconomy(this.data.economy),
      }));
    } catch {
      // Non-fatal: the session still works, it just won't survive a reload.
    }
    for (const fn of this.listeners) fn();
  }
}
