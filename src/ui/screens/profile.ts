/**
 * Persisted player state.
 *
 * The menus need something to be *about* — a name on a badge, a win count, a level
 * bar that moves, a character that stays equipped between sessions. This is the
 * smallest honest version of that: localStorage, one JSON blob, validated on read so
 * a stale or hand-edited blob can never crash the boot path.
 *
 * Nothing here is game balance. The roster, stats and weapons all live in
 * `game/rules.ts` and are read from there; this file only remembers *choices*.
 */

import { CHARACTER_IDS, type CharacterId } from '../../game/rules';

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
  coins: number;
  gems: number;
  selected: CharacterId;
}

const DEFAULTS: ProfileData = {
  name: 'Chef',
  wins: 0,
  losses: 0,
  xp: 0,
  coins: 500,
  gems: 25,
  selected: CHARACTER_IDS[0],
};

function isCharacterId(v: unknown): v is CharacterId {
  return typeof v === 'string' && (CHARACTER_IDS as readonly string[]).includes(v);
}

function num(v: unknown, fallback: number): number {
  return typeof v === 'number' && Number.isFinite(v) && v >= 0 ? v : fallback;
}

function load(): ProfileData {
  try {
    const raw = localStorage.getItem(STORAGE_KEY);
    if (!raw) return { ...DEFAULTS };
    const parsed = JSON.parse(raw) as Partial<ProfileData>;
    return {
      name: typeof parsed.name === 'string' && parsed.name.trim() ? parsed.name.slice(0, 16) : DEFAULTS.name,
      wins: Math.floor(num(parsed.wins, 0)),
      losses: Math.floor(num(parsed.losses, 0)),
      xp: Math.floor(num(parsed.xp, 0)),
      coins: Math.floor(num(parsed.coins, DEFAULTS.coins)),
      gems: Math.floor(num(parsed.gems, DEFAULTS.gems)),
      selected: isCharacterId(parsed.selected) ? parsed.selected : DEFAULTS.selected,
    };
  } catch {
    // Private-mode Safari throws on localStorage access. A menu must still boot.
    return { ...DEFAULTS };
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
  get coins(): number { return this.data.coins; }
  get gems(): number { return this.data.gems; }
  get selected(): CharacterId { return this.data.selected; }

  /** 1-based, so a brand-new player is "Lv 1" rather than "Lv 0". */
  get level(): number { return Math.floor(this.data.xp / XP_PER_LEVEL) + 1; }
  /** 0..1 progress toward the next level — what the home screen's bar renders. */
  get levelProgress01(): number { return (this.data.xp % XP_PER_LEVEL) / XP_PER_LEVEL; }

  select(id: CharacterId): void {
    if (this.data.selected === id) return;
    this.data.selected = id;
    this.commit();
  }

  recordResult(won: boolean): void {
    if (won) { this.data.wins++; this.data.xp += XP_WIN; }
    else { this.data.losses++; this.data.xp += XP_LOSS; }
    this.commit();
  }

  /** Subscribe to any change. Returns an unsubscribe function. */
  onChange(fn: () => void): () => void {
    this.listeners.add(fn);
    return () => this.listeners.delete(fn);
  }

  private commit(): void {
    try {
      localStorage.setItem(STORAGE_KEY, JSON.stringify(this.data));
    } catch {
      // Non-fatal: the session still works, it just won't survive a reload.
    }
    for (const fn of this.listeners) fn();
  }
}
