/**
 * Match simulation state.
 *
 * Pure data + factories. No gameplay math lives here (see `combat.ts`, `ai.ts`,
 * `movement.ts`, `sim.ts`) — this module only describes the shape of a match and
 * how to create the initial state for one.
 *
 * All timers/timestamps here are expressed on `MatchState.elapsed`, a match-local
 * clock in milliseconds that starts at 0 when `createMatch` runs (see `sim.ts`) and
 * only ever increases. This makes stepping fully deterministic and independent of
 * wall-clock time, which is what lets `sim.test.mjs` drive the simulation with
 * exact, reproducible `dt` values.
 *
 * NOTE on module extensions: files under `src/game/` import each other with an
 * explicit `.ts` extension (e.g. `./rules.ts`) rather than the extension-less style
 * used elsewhere in this codebase (e.g. `../game/rules`). Both resolve fine under
 * Vite/tsc (bundler resolution + `allowImportingTsExtensions`), but only the
 * explicit form resolves under Node's native TypeScript support, which is what lets
 * `sim.test.mjs` import these modules directly with zero build step.
 */

import type { CharacterId, StatusEffect, Weapon } from './rules.ts';
import { CHARACTERS, LEVEL_MIN, clampLevel, levelDamageMultiplier } from './rules.ts';
import type { ArenaDefinition } from '../arena/types.ts';
// TYPE ONLY, and the direction matters: `movement.ts` imports nothing from this file, so
// there is no cycle to reason about at runtime or at build time. `ConcealBox` is declared
// there because that file owns concealment GEOMETRY; `MatchState` merely holds a list of
// which ones this match has destroyed.
import type { ConcealBox } from './movement.ts';

export type FighterRole = 'player' | 'enemy';

export interface Vec2 {
  x: number;
  y: number;
}

export interface StatusTimers {
  /** Match-elapsed-ms timestamp until which movement speed is multiplied by SLOW_MOVE_MULTIPLIER. */
  slowedUntil: number;
  /** Match-elapsed-ms timestamp until which movement is locked to zero. */
  stunnedUntil: number;
}

export interface Fighter {
  role: FighterRole;
  characterId: CharacterId;
  /**
   * This fighter's CHARACTER level, 1-15 (`rules.ts` `LEVEL_MIN`..`LEVEL_MAX`).
   *
   * Role-agnostic on purpose: Uri's answer to the enemy-scaling question is *"the game
   * eventually should be humans vs. humans… AI players need to be adjusted to the
   * player's level"*, so a bot standing in for a level-8 human carries a level-8 human's
   * level here and there is no bot-only path anywhere.
   *
   * It is stored rather than re-derived because `maxHp` is already baked from it at
   * spawn: keeping the input next to the output is what lets an instrument assert the
   * two agree instead of trusting that they do.
   */
  level: number;
  /**
   * Every point of damage this fighter DEALS is multiplied by this before it lands —
   * `combat.ts:applyDamage` is the only reader, which is the same single-choke-point
   * doctrine that file already applies to HP.
   *
   * Exactly 1.0 at `LEVEL_MIN`, so a level-1 match is bit-identical to a pre-levels one.
   */
  damageMul: number;
  x: number;
  y: number;
  hp: number;
  maxHp: number;
  /** Full width/height of the AABB used for movement collision (PLAYER_SIZE / ENEMY_SIZE). */
  size: number;
  facing: Vec2;
  status: StatusTimers;
  alive: boolean;
  /** Per-weapon cooldown tracking. Index-aligned with CHARACTERS[characterId].weapons. */
  lastUsed: number[];
  /** Per-hazard damage-tick accumulator. Index-aligned with arena.hazards (sparse; grows lazily). */
  hazardTimers: number[];
  fogTimer: number;
  regenTimer: number;
  trailDropTimer: number;
  /**
   * Which way this fighter is currently going AROUND an obstacle: +1, -1, or 0 for
   * "not detouring". Persisted BETWEEN ticks, which is the whole point.
   *
   * `moveToward` re-decides its detour direction every tick from local geometry. When
   * the local geometry flips — which it does constantly while sliding along a corner —
   * the decision flips with it and the mover alternates between two headings forever
   * instead of getting anywhere. That is exactly what was measured: the enemy wedged in
   * the 0.5wu notch between `stacked_pots` and `sink_counter` at ~(749,227), alternating
   * N and SE for the entire match, unable to reach 52% of the map.
   *
   * Committing to a side and HOLDING it until real progress resumes is what makes going
   * around something work at all. Not gameplay-visible; pure movement state.
   */
  detourSign: number;
  /** Match-elapsed-ms timestamp of the last time this fighter took damage. -Infinity if never. */
  lastDamagedAt: number;
  /**
   * Read-only OBSERVATION of the strongest terrain slow currently affecting this
   * fighter — the exact same movement-speed multiplier `sim.ts`'s own
   * `terrainSlowFactor()` already computes each tick (1 = unaffected, e.g. 0.45 while
   * standing in a grease/water puddle or a Sticky Trail splat). Published purely so a
   * renderer (see `game/vfx.ts`) can react to "this fighter is standing in a puddle"
   * without recomputing hazard geometry itself. Never read by gameplay logic — the
   * sim's actual movement math still calls `terrainSlowFactor()` directly, this field
   * is a side-channel copy of that same result, not a new input to it.
   */
  terrainSlowFactor: number;
  /**
   * Read-only OBSERVATION of whether this fighter is standing inside a walk-through
   * concealment region this tick — the exact same predicate `movement.ts:isConcealed()`
   * answers, published in the same idiom as `terrainSlowFactor` immediately above and for
   * the same consumers.
   *
   * ⚠️ **GAMEPLAY MUST NOT READ THIS FIELD, AND DOES NOT.** `ai.ts` and
   * `sim.ts:stepProjectiles` both call `isVisibleFrom()` directly. The distinction is not
   * pedantry: this field is written once per fighter per tick from `applyWorldTick`, which
   * runs only while `phase === 'playing'` and returns early for a dead fighter, so it is
   * STALE in exactly the states a decision-maker would most like to trust it. Reading a
   * published observation as an input is how `rules.ts`'s "stated once, implemented twice"
   * defects get built; the predicate is the single statement of the rule.
   *
   * It exists for the two one-line changes the sim cannot make itself, both in file sets
   * owned elsewhere: `ui/hud.ts:757` (drop the enemy blip off the radar) and
   * `game/match.ts:1191` (drop the enemy's floating HP bar). Both already receive the whole
   * `MatchState`, so neither needs any new plumbing — see `rules.ts` under "CONCEALMENT".
   *
   * ⚠️ SINCE DECISIONS §29c THIS MEANS *HIDDEN*, NOT MERELY *INSIDE A BOX*. It is written
   * from `movement.ts:isHidden`, so a region that has been DESTROYED by its occupant's own
   * attack conceals nobody, and a fighter inside its own `revealedUntil` window is not
   * concealed even while standing in one. The old wording said "standing inside a
   * concealment region this tick", which is now the narrower `isConcealed()` and is not
   * what any consumer wants: a plate that has shattered is not cover.
   */
  concealed: boolean;
  /**
   * Match-elapsed-ms timestamp until which this fighter is EXPOSED by its own last attack,
   * whatever cover it is standing in. `-Infinity` for a fighter that has never attacked —
   * the same idiom, and the same sentinel, as `lastDamagedAt` above and as
   * `StatusTimers`' two absolute deadlines.
   *
   * Uri, `DECISIONS §29c`: *"attacking from under it will break it and reveal you."* The
   * DESTRUCTION half of that is `MatchState.brokenConcealment`; this is the REVEAL half,
   * and it is a separate quantity rather than a consequence of the first because the
   * regions are deliberately small and close together (`rules.ts:CONCEAL_REVEAL_RADIUS`
   * caps them at ~168 wu) — an attacker whose plate shattered is one step from the next
   * one, and without a window it would vanish again in a single tick. Duration and its
   * derivation: `rules.ts:CONCEAL_ATTACK_REVEAL_MS`.
   *
   * A deadline rather than a per-tick boolean, deliberately. A recomputed flag would be
   * written in `applyWorldTick`, which runs at ONE point in the tick, and the four readers
   * of concealment sit either side of it (`stepAI` fires mid-tick, `stepProjectiles` after
   * everything). A flag would therefore be fresh for some readers and stale for others, in
   * an order nobody could see from the call sites — the exact hazard `concealed`'s own doc
   * above describes. An absolute timestamp compared against `state.elapsed` has no such
   * window.
   *
   * ⚠️ Written by `combat.ts:attemptAttack` and by nothing else, for `melee`/`ranged` only.
   * A `self` press (the heal) is not an attack; see `rules.ts` under "CONCEALMENT".
   */
  revealedUntil: number;
}

export function createFighter(
  role: FighterRole,
  characterId: CharacterId,
  spawn: Vec2,
  maxHp: number,
  size: number,
  initialFacing: Vec2,
  level: number = LEVEL_MIN,
): Fighter {
  const weaponCount = CHARACTERS[characterId].weapons.length;
  const lvl = clampLevel(level);
  return {
    role,
    characterId,
    level: lvl,
    damageMul: levelDamageMultiplier(lvl),
    x: spawn.x,
    y: spawn.y,
    hp: maxHp,
    maxHp,
    size,
    facing: { x: initialFacing.x, y: initialFacing.y },
    status: { slowedUntil: -Infinity, stunnedUntil: -Infinity },
    alive: true,
    lastUsed: new Array(weaponCount).fill(-Infinity),
    hazardTimers: [],
    fogTimer: 0,
    regenTimer: 0,
    trailDropTimer: 0,
    detourSign: 0,
    lastDamagedAt: -Infinity,
    terrainSlowFactor: 1,
    concealed: false,
    revealedUntil: -Infinity,
  };
}

/**
 * WHERE AN OBSERVER LAST ACTUALLY SAW ITS TARGET.
 *
 * On `MatchState` rather than on `Fighter`, and the reason is a rule rather than a
 * preference: this is the OBSERVER'S MEMORY, not a property of the observed. Hanging it on
 * the player would make "where the player was last seen" look like something the player
 * owns, and the next observer that needs one (the radar; a second AI when this becomes 1v1
 * human-vs-human with bots, which is Uri's stated direction) would either share it wrongly
 * or grow a second copy.
 */
export interface Sighting {
  /** The target's position at the last tick on which the observer could see it. */
  x: number;
  y: number;
  /**
   * `MatchState.elapsed` at that sighting. Equal to `elapsed` exactly while the target is
   * visible, so `at === state.elapsed` is a precise "the belief is current" test and
   * `elapsed - at` is how long the observer has been acting on stale information — which is
   * the quantity `tools/tmp/conceal_lab.mjs` measures to decide whether concealment is a
   * mechanic or decoration.
   */
  at: number;
}

// ─────────────────────────────────────────────────────────────────────────────
// Ground effects & projectiles
// ─────────────────────────────────────────────────────────────────────────────

export interface Projectile {
  id: number;
  ownerRole: FighterRole;
  /** The only fighter this projectile can hit (the owner's opponent). */
  targetRole: FighterRole;
  weapon: Weapon;
  x: number;
  y: number;
  vx: number;
  vy: number;
  traveled: number;
  /** Resolved per-shot damage (pellet/comboPart/trail-boost already applied). */
  damage: number;
  /** Resolved per-shot color/emoji, for a VFX layer — not authoritative gameplay data. */
  color: string;
  emoji: string;
  /** peckHits state machine. */
  arrived?: boolean;
  peckTimer?: number;
  hitsSoFar?: number;
}

export interface Splat {
  id: number;
  x: number;
  y: number;
  expiresAt: number;
}

export interface TrailMark {
  id: number;
  ownerRole: FighterRole;
  x: number;
  y: number;
  expiresAt: number;
  /** Each mark can damage the opponent at most once. */
  damaged: boolean;
}

// ─────────────────────────────────────────────────────────────────────────────
// Match
// ─────────────────────────────────────────────────────────────────────────────

export type MatchPhase = 'countdown' | 'playing' | 'ended';

export interface MatchState {
  phase: MatchPhase;
  /** Match-local clock, ms, monotonically increasing from 0. Drives every timer in the sim. */
  elapsed: number;
  countdownValue: number;
  countdownTick: number;
  startFlashTimer: number;
  timeRemaining: number;
  safeRadius: number;
  player: Fighter;
  enemy: Fighter;
  projectiles: Projectile[];
  splats: Splat[];
  trailMarks: TrailMark[];
  winner: FighterRole | null;
  arena: ArenaDefinition;
  /**
   * THE AI's BELIEF about where the player is — the only perception state in the sim.
   *
   * `ai.ts:stepAI` derives every one of its decisions from this and never from
   * `state.player.x/y`: the separation that gates weapon range, the facing it aims and
   * fires along, and the nav target it walks to. It is refreshed to the player's true
   * position on every tick the enemy can SEE the player (`movement.ts:isVisibleFrom`), so
   * with no concealment regions in the arena it is the true position on every tick and the
   * AI is bit-identical to the one that read the player directly.
   *
   * There is deliberately no mirror for the player: a human already knows where they are,
   * and the scripted player in `tools/tmp/scripted_player.mjs` is a measuring instrument
   * with perfect information by design (see its header) — giving it perception would change
   * every recorded balance number for a reason that has nothing to do with the game.
   */
  aiSighting: Sighting;
  /**
   * THE CONCEALMENT REGIONS THIS MATCH HAS DESTROYED — Uri's §29c, the half of it that is
   * about the OBJECT rather than about the fighter.
   *
   * ⚠️ ON `MatchState` AND NOT ON THE ARENA, AND THIS IS NOT A STYLE CHOICE. One
   * `ArenaDefinition` object is shared by every match a process runs: `match.ts` keeps
   * `this.arena` across restarts and hands the same object to `createMatch` each time
   * (`window.__matchArena` is that same reference, by design), and `roster_lab.mjs` /
   * `conceal_lab.mjs` step thousands of matches through one. Splicing a destroyed plate out
   * of `arena.concealment` would therefore leave it destroyed for the whole session — a
   * fresh match starting with somebody else's broken cover, on a field nothing compares.
   *
   * Holds the BOXES BY REFERENCE rather than indices into `arena.concealment`, so it stays
   * correct if that list is replaced mid-match — which is exactly what `match.ts`'s
   * `window.__matchArena.concealment = [...]` QA hook does, and it is the only way anything
   * renders concealment today.
   *
   * Empty for every match on every arena that ships today, which is what makes the whole
   * feature inert: `movement.ts:isConcealed` skips a region only if it is in here, and
   * nothing gets in here unless a fighter attacked from inside one.
   */
  brokenConcealment: ConcealBox[];
  /** Monotonic id generator, so a VFX layer can correlate spawn/destroy events. */
  nextId: number;
}

export function otherRole(role: FighterRole): FighterRole {
  return role === 'player' ? 'enemy' : 'player';
}

// ─────────────────────────────────────────────────────────────────────────────
// Input
// ─────────────────────────────────────────────────────────────────────────────

export interface MatchInput {
  /**
   * Movement axes, each independently in [-1, 1]. Deliberately NOT normalized as a
   * vector — this mirrors the prototype's WASD handling exactly, where holding two
   * keys moves diagonally at up to ~1.41x a single cardinal direction's speed. If a
   * caller wants normalized 8-way movement they must normalize before passing it in.
   */
  move: Vec2;
  /**
   * World-space aim/facing direction. Any vector with non-negligible magnitude
   * re-points the fighter's facing (normalized internally). Omit, or pass a
   * zero-length vector, to keep the previous facing untouched. The prototype
   * derived this from mouse position via a screen-space transform; that conversion
   * is a rendering/input concern and belongs upstream of this pure sim.
   */
  aim?: Vec2;
  /** Weapon slot index (0-based) to use if `attack` is true this tick. */
  selectedWeapon: number;
  /**
   * One attack attempt this tick, gated by the weapon's own cooldown — analogous to
   * a single prototype `mousedown`. Passing `true` on consecutive ticks is fine and
   * naturally rate-limits to the weapon's cooldown (a reasonable "held fire button"
   * interpretation of an original that only ever fired on a discrete click event).
   */
  attack: boolean;
}

// ─────────────────────────────────────────────────────────────────────────────
// Events — the VFX/observation surface
// ─────────────────────────────────────────────────────────────────────────────

export type DamageSource =
  | { kind: 'weapon'; weaponKey: string; weaponName: string }
  | { kind: 'trail'; ownerRole: FighterRole }
  | { kind: 'hazard' }
  | { kind: 'fog' };

export type GameEvent =
  | { type: 'countdown-tick'; value: number }
  | { type: 'match-started' }
  | { type: 'match-ended'; winner: FighterRole }
  | { type: 'weapon-fired'; fighterRole: FighterRole; weaponKey: string }
  | {
      type: 'projectile-spawned';
      id: number;
      ownerRole: FighterRole;
      weaponKey: string;
      x: number;
      y: number;
      color: string;
      emoji: string;
    }
  | { type: 'projectile-destroyed'; id: number; reason: 'hit-target' | 'hit-cover' | 'expired'; x: number; y: number }
  | {
      type: 'hit-landed';
      targetRole: FighterRole;
      amount: number;
      effect: StatusEffect;
      source: DamageSource;
      x: number;
      y: number;
    }
  | { type: 'heal'; fighterRole: FighterRole; amount: number }
  | { type: 'death'; fighterRole: FighterRole }
  | { type: 'splat-created'; x: number; y: number }
  | { type: 'trail-mark-created'; ownerRole: FighterRole; x: number; y: number }
  /**
   * A concealment region was DESTROYED by the fighter hiding under it attacking from it
   * (`DECISIONS §29c`). Carries the box's own geometry, not an index, for the same reason
   * `MatchState.brokenConcealment` stores references: the arena's list can be replaced
   * under a running match by the `__matchArena` QA hook, and an index into a list that has
   * changed identifies the wrong plate.
   *
   * ⚠️ NOBODY LISTENS TO THIS YET, AND THAT IS THE POINT OF PUBLISHING IT. The prop that
   * draws a plate lives in `src/arena/`, which the sim does not own and which does not
   * declare a `concealment` list yet either — so this event can never fire today. It exists
   * so that when the plates are placed, "make it shatter" is a subscription rather than a
   * second traversal of the region list in the renderer. Same contract as every other
   * member of this union: the sim states what happened, the presentation layers decide what
   * that looks like and what it sounds like.
   */
  | { type: 'concealment-broken'; ownerRole: FighterRole; x: number; y: number; w: number; h: number; kind?: string };
