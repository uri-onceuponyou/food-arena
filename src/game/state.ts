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
  };
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
  | { type: 'trail-mark-created'; ownerRole: FighterRole; x: number; y: number };
