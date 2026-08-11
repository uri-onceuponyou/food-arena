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
// ⚠️ THE SEAT FLOOR IS IMPORTED, NOT WRITTEN AS `2`. `recordResult` is the duel, and the sim's
// own name for "a duel's seat count" is `MIN_FIGHTERS` — the same constant
// `economy/state.ts:applyMatchResult` passes. A literal here would be a second statement of it.
import { MIN_FIGHTERS } from '../../game/state';
import {
  adoptLegacyBalance,
  applyMatchPlacement,
  buyContainer,
  canLevelUp,
  characterLevel,
  levelUp,
  nextLevelPrice,
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
  placementRank01,
  placementWeight01,
  winsToNextChest,
  type ContainerKind,
  type ContainerResult,
  type EconomyState,
  type LastMatch,
  type LevelPrice,
  type Reward,
} from '../../game/economy';

const STORAGE_KEY = 'food-arena.profile.v1';

/** XP needed per level. Flat on purpose — a curve is a live-ops decision, not a
 *  menu-layer one, and the bar has to read the same either way. */
export const XP_PER_LEVEL = 250;
export const XP_WIN = 100;
export const XP_LOSS = 35;

/**
 * XP for one finisher, interpolated across the SAME normalised rank the trophy and coin curves
 * use — see `recordPlacement` for why this is interpolated rather than binary.
 *
 * It is `economy/trophyRoad.ts:placementCoins`'s body with the XP endpoints substituted, and it
 * lives here rather than there because `XP_WIN`/`XP_LOSS` are menu-layer numbers that
 * `game/economy/` deliberately does not own. **The SHAPE is imported, not copied**
 * (`placementWeight01`), so there is exactly one statement of the curve in the product and a
 * steepness retune moves XP, coins and trophies together.
 *
 * ⚠️ Endpoints are exact at every seat count: `w` is pinned to 0 at first place and 1 at last
 * by early returns inside `placementWeight01`, so first ALWAYS pays `XP_WIN` and last ALWAYS
 * pays `XP_LOSS` — including at two seats, where those are the only two ranks that exist.
 * `Math.round` matches `placementCoins`, so XP stays an integer and the level bar never shows a
 * fraction of a point.
 */
export function placementXp(place: number, seats: number): number {
  const w = placementWeight01(placementRank01(place, seats));
  return Math.round(XP_WIN - w * (XP_WIN - XP_LOSS));
}

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

export const DEFAULT_NAME = 'Chef';

/**
 * Longest player name, in code units.
 *
 * 16 is what the lobby badge holds: `home.ts` draws the name inside a `.fa-chip` in a
 * non-wrapping top bar, and that bar is the element `menu_accept_portrait.mjs` exists
 * because of — a single run that refuses to wrap sets the grid track and lays the
 * whole screen out wider than a 360px phone. So the cap is a LAYOUT constraint, not a
 * style preference, and it is enforced on the way in AND on the way out of storage.
 */
export const NAME_MAX = 16;

/**
 * ── The one free-text field in the product ──────────────────────────────────
 * Everything a player types here becomes displayed text, so it is normalised in
 * exactly one place and both entry points go through it: `setName()` for what is
 * typed, and `load()` for what comes back out of `localStorage` — a hand-edited or
 * migrated blob is user input too, and the old loader trusted it enough to run
 * `.slice(0, 16)` on whatever it found.
 *
 * What it does, in this order — and THE ORDER IS THE POINT:
 *
 *  1. Every run of whitespace collapses to ONE space. This runs first because `\n`
 *     and `\t` are control characters too, and stripping them before collapsing turns
 *     a pasted `"Chef\nBoyardee"` into `"ChefBoyardee"` — two words silently welded
 *     together. Collapsing first turns it into `"Chef Boyardee"`, which is what the
 *     player meant. (Caught by `tools/tmp/name_accept.mjs`, which had it the other
 *     way round and failed.) It also means a name cannot be padded out to 16 spaces
 *     and render as a blank badge.
 *  2. `\p{Cc}` control and `\p{Cf}` format characters are removed. The second class is
 *     the one that is not cosmetic: U+202E RIGHT-TO-LEFT OVERRIDE reverses the
 *     rendering of everything after it, so a name can rewrite the text NEXT to it on
 *     screen. Nothing here reaches `innerHTML` — `home.ts` writes `textContent` and
 *     the settings field is written through `.value`, both of which escape by
 *     construction — so this is not the XSS guard. It is the DISPLAY guard, which is
 *     the attack an escaped string still allows.
 *  3. Trim, cap at `NAME_MAX`, trim again — the second trim is for the case where the
 *     cap lands on a space.
 *
 * An empty result becomes `DEFAULT_NAME` rather than being rejected: a player who
 * clears the field has to end up with a legible badge either way, and "your name is
 * now Chef" is a better answer than a silent refusal or an empty pill.
 */
export function sanitizeName(raw: unknown): string {
  if (typeof raw !== 'string') return DEFAULT_NAME;
  const clean = raw
    .replace(/\s+/g, ' ')
    .replace(/[\p{Cc}\p{Cf}]/gu, '')
    .trim()
    .slice(0, NAME_MAX)
    .trim();
  return clean.length > 0 ? clean : DEFAULT_NAME;
}

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
      name: sanitizeName(parsed.name),
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
   * Rename the player.
   *
   * Takes RAW input and returns the name that was actually stored, so a caller can
   * put the canonical value back in its field without re-implementing the rules —
   * see `sanitizeName` for what those are. No-ops (and still returns the name) when
   * the sanitised value is unchanged, so holding a key down does not write
   * `localStorage` once per repeat or notify every listener for nothing.
   */
  setName(raw: string): string {
    const next = sanitizeName(raw);
    if (next === this.data.name) return next;
    this.data.name = next;
    this.commit();
    return next;
  }

  /**
   * Bank a finished match at a known PLACE in a field of `seats`. 0-based, best first.
   *
   * Win/loss record, XP, trophies, coins and progress toward the next free chest, in one write.
   * Returns what the match paid so a caller can celebrate it.
   *
   * ── 🚨 THE `wins` COUNTER FOLLOWS `LastMatch.won`, IT DOES NOT RE-DERIVE IT ──
   *
   * `applyMatchPlacement` runs FIRST and the counter reads `paid.won` off it, rather than
   * testing `place === 0` here. Both would give the same answer today; only one of them stays
   * right when the economy changes its mind about what a win is. That is not hypothetical —
   * the economy already holds TWO different answers on purpose:
   *
   *   * `LastMatch.won` is `place === 0` — the displayed W/L record, "did you win it";
   *   * `placementBanksChestWin` is `rank01 < 0.5` — the chest faucet, "did you do well".
   *
   * Third of six banks chest credit and is not a win. Re-deriving either one here would make
   * this file a second, quieter source of truth for a question `trophyRoad.ts` has answered
   * twice deliberately.
   *
   * ── 🚨 XP IS INTERPOLATED ON THE SAME NORMALISED RANK. THIS WAS A DECISION. ──
   *
   * `XP_WIN`/`XP_LOSS` were a SECOND two-outcome ladder that nobody had noticed, sitting
   * outside `game/economy/`'s file set and therefore outside the pass that priced placements
   * (`721ce3c`). Two answers were available and the binary one was rejected:
   *
   *   * **binary** (`place === 0 ? XP_WIN : XP_LOSS`) pays 2nd of six and 6th of six the same
   *     100-vs-35 cliff. That is *exactly* the defect `placementRank01` exists to remove —
   *     re-installed in a second ladder, one commit after the first was fixed. A stopgap whose
   *     cost is a known bug is not a stopgap, it is the bug with a comment on it.
   *   * **interpolated** — `placementXp` below — is the identical shape as `placementCoins`,
   *     costs one import and no new constant, and `XP_WIN`/`XP_LOSS` stay the only XP numbers
   *     in the product.
   *
   * ⚠️ **And it is a NO-OP AT TWO SEATS BY CONSTRUCTION, not by tuning.**
   * `placementWeight01` pins its endpoints with early returns *before* `Math.pow`, so
   * `w(0) === 0` and `w(1) === 1` for every exponent; a two-seat match only ever produces
   * `r ∈ {0, 1}`; so `placementXp(0, 2) === XP_WIN` and `placementXp(1, 2) === XP_LOSS`
   * exactly. `tools/tmp/nw_profile.mjs` proves the whole delegation below against a FROZEN
   * ORACLE of the pre-change body over a seeded career rather than asserting it.
   *
   * ⚠️ **What it does NOT decide:** whether 100/35 are the right endpoints at all, and whether
   * the account-level curve should stay flat (`XP_PER_LEVEL`). Both are live-ops calls and both
   * are untouched. This changes only how the span between the two shipped numbers is divided
   * among more than two finishers.
   */
  recordPlacement(place: number, seats: number): LastMatch {
    const paid = applyMatchPlacement(this.data.economy, place, seats);
    if (paid.won) this.data.wins++;
    else this.data.losses++;
    this.data.xp += placementXp(place, seats);
    this.commit();
    return paid;
  }

  /**
   * Bank a finished DUEL. The two-outcome form every shipped call site still uses.
   *
   * ⚠️ **IT DELEGATES, AND THAT IS DELIBERATE RATHER THAN TIDY.** The body used to be three
   * lines of its own:
   *
   *     if (won) { this.data.wins++; this.data.xp += XP_WIN; }
   *     else { this.data.losses++; this.data.xp += XP_LOSS; }
   *     const paid = applyMatchResult(this.data.economy, won);
   *
   * Keeping that alongside `recordPlacement` would be two bodies for one rule — the shape
   * `rules.ts` documents six defects of, and the exact reason `economy/state.ts` routed
   * `applyMatchResult` through `applyMatchPlacement` rather than keeping a parallel one. Two
   * bodies let a future XP retune move the six-seat path and leave the duel behind, with
   * nothing red anywhere.
   *
   * The signature, the return value and every number are unchanged, and that is measured, not
   * claimed: `tools/tmp/nw_profile.mjs` replays a 2,000-match seeded career through a frozen
   * transcription of the old body and compares the WHOLE serialised profile.
   */
  recordResult(won: boolean): LastMatch {
    return this.recordPlacement(won ? 0 : 1, MIN_FIGHTERS);
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

  // ── Character levels (rules.ts DEVIATION #11) ─────────────────────────────
  //
  // ⚠️ NOT the same thing as `level` above. That one is the ACCOUNT level, derived from
  // XP, and it is what the home screen's bar draws. These are per-CHARACTER levels 1-15,
  // bought with coins, and they are what the simulation reads. The two are deliberately
  // spelled differently at every call site for that reason; `characterLevel(id)` takes an
  // argument and `level` does not, so they cannot be confused by autocomplete either.

  /** This character's level, 1-15. `LEVEL_MIN` for anything never upgraded. */
  characterLevel(id: CharacterId): number {
    return characterLevel(this.data.economy, id);
  }

  /** What this character's next level costs, or null when it is already maxed. */
  nextLevelPrice(id: CharacterId): LevelPrice | null {
    return nextLevelPrice(this.data.economy, id);
  }

  /** Whether the next level is available AND affordable right now. */
  canLevelUp(id: CharacterId): boolean {
    return canLevelUp(this.data.economy, id);
  }

  /**
   * Buy one level. Null — and no write at all — when it did not happen.
   *
   * The commit is what makes the purchase durable, and it happens in the same turn of the
   * event loop as the spend: `levelUp` in the model is all-or-nothing, so there is no
   * point at which a reload could observe a charged player without their level.
   */
  levelUp(id: CharacterId): { level: number; spent: LevelPrice } | null {
    const got = levelUp(this.data.economy, id);
    if (got) this.commit();
    return got;
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
