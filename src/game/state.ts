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

/**
 * A FIGHTER'S IDENTITY: its SLOT INDEX in `MatchState.fighters`.
 *
 * 🚨 `state.fighters[i].id === i` IS AN INVARIANT, not a convention. Every id in the sim —
 * a projectile's owner and target, a trail mark's owner, a `DamageSource`'s attacker, the
 * `sightings` matrix's row and column, the `damagedMask` bit — is an index into that one
 * array, so "who is this" and "where do I find them" are the same question with the same
 * answer. `sim.test.mjs` §27(a) asserts it rather than trusting it.
 *
 * A NUMBER and not a string, and an ARRAY INDEX and not a handle, because the alternative
 * costs determinism: a `Map`/`Record` keyed by name iterates in insertion order, and
 * insertion order is the classic lockstep-desync mechanism. Iteration order here is a pure
 * function of `createMatch`'s arguments.
 */
export type FighterId = number;

/**
 * WHO DECIDES THIS FIGHTER'S INPUTS. Split out of `FighterRole`, which fused three
 * separate concepts into one two-valued string:
 *
 *   1. WHICH SEAT this is            -> `FighterId` (the slot index)
 *   2. WHO DRIVES IT                 -> this type
 *   3. WHICH SPAWN / HP DIAL it got  -> `createMatch`'s arguments, and nothing else
 *
 * They were the same question only because there were exactly two fighters and exactly one
 * of them was a human. Uri's stated direction is *"the game eventually should be humans vs.
 * humans… AI players need to be adjusted to the player's level"* — i.e. any number of
 * either, in any slot. Nothing in the sim reads `role` to decide behaviour any more;
 * `sim.ts`'s fighter loop branches on THIS.
 */
export type Controller = 'human' | 'ai';

/**
 * @deprecated LEGACY SEAT NAME. Meaningful only while `fighters.length === 2`.
 *
 * Kept — deliberately, and not as an oversight — for two reasons that are both measurements
 * rather than preferences:
 *
 *   1. **`tsc` cannot see four fifths of the callers.** A grep over `src/` + `tools/` found
 *      **1,307 references to this refactor's surface, of which 1,089 (83%) are in `.mjs`
 *      files**, and **68 of 71 `createMatch` call sites are untyped**. Deleting this type
 *      would NOT produce a compile break that finds them; it would produce a silent runtime
 *      break in the instruments that measure the game.
 *   2. **Removing a field is a hard failure in the bit-identity differ** (`conceal_lab.mjs`
 *      `firstDiff`), by design — "tolerate a missing key" is a hole big enough to hide a
 *      deleted field in. A field that is added is declared and printed; a field that
 *      vanishes is a regression.
 *
 * So every `*Role` field below is now a MIRROR of the corresponding `*Id`, written at the
 * same moment and never read by gameplay logic. `ui/hud.ts`, `game/match.ts`, `game/vfx.ts`
 * and `audio/director.ts` still consume them, and none of those files was touched.
 */
export type FighterRole = 'player' | 'enemy';

/**
 * THE TWO-SEAT SEAM, in ONE place.
 *
 * The whole point of this refactor was to do the container, the identity, the iteration
 * order, the perception matrix, the target rule and the event protocol at N=2 — under the
 * differ, where the right answer is already known — and to raise the cap LAST. This is
 * the cap. Every place that still assumes exactly two fighters names this constant or
 * `opponentOf` below, so raising it is a search for two identifiers rather than a reading
 * of four files.
 */
export const MAX_FIGHTERS = 2;

/**
 * The legacy seat name for a slot. Only slots 0 and 1 have one; see `MAX_FIGHTERS`.
 * Exported so `createMatch` and `sim.test.mjs` state the mapping once instead of twice.
 */
export function roleOfSlot(id: FighterId): FighterRole {
  return id === 0 ? 'player' : 'enemy';
}

/**
 * The bit this fighter occupies in a per-victim mask (see `TrailMark.damagedMask`).
 *
 * ⚠️ 31 SLOTS MAX, because a JS bitwise operator coerces to int32. That is 5x the 4–6
 * fighters `DECISIONS §48` is sizing the arena for, and it is asserted rather than assumed:
 * `MAX_FIGHTERS` is checked against it in `sim.test.mjs` §27, so the day somebody types 32
 * the suite says so instead of the mask silently wrapping.
 */
export function fighterBit(id: FighterId): number {
  return 1 << id;
}

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
  /**
   * This fighter's SLOT INDEX. `state.fighters[i].id === i` — see `FighterId`.
   *
   * ⚠️ **LIVE, NOT DEAD, AND THE FIRST DRAFT OF THIS COMMENT CLAIMED THE OPPOSITE.** It
   * said the field was "deliberately unread by gameplay in the hot path", which read
   * plausibly and was false: `opponentOf`, `sightingIndex`, `fighterBit`, `spawnProjectile`
   * and `applyDamage` all read it, so swapping the two ids makes a fighter its own
   * opponent. `conceal_lab.mjs --ablate` catches it on the FIRST match it runs, which is
   * what the ablation is FOR — the design defended its new fields with "unread state cannot
   * change behaviour", an argument from code reading, and `CLAUDE.md` #6 says not to trust
   * those. This one was wrong.
   */
  id: FighterId;
  /** Who supplies this fighter's inputs. `sim.ts`'s fighter loop branches on this. */
  controller: Controller;
  /** @deprecated LEGACY SEAT NAME — mirrors `roleOfSlot(id)`. See `FighterRole`. */
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
  /**
   * The radius inside which a projectile aimed at THIS fighter counts as a hit
   * (`rules.ts` `HIT_RADIUS_VS_PLAYER` / `HIT_RADIUS_VS_ENEMY`).
   *
   * ── IT MOVED HERE FROM A TERNARY, AND THE TERNARY WAS THE BUG SHAPE ─────────
   *
   * `sim.ts:stepProjectiles` used to read
   * `p.targetRole === 'player' ? HIT_RADIUS_VS_PLAYER : HIT_RADIUS_VS_ENEMY`. That is a
   * property of the TARGET expressed as a two-way branch on a seat name: correct at N=2,
   * meaningless at N=3, and exactly the "a rule stated once and implemented twice" shape
   * `ai.ts`'s header documents six instances of. A fighter now carries its own hit radius
   * and the projectile loop reads it, so a third fighter needs no third branch.
   *
   * ⚠️ THIS ONE IS *LIVE*, unlike `id` and `controller` — `conceal_lab.mjs --ablate` is
   * REQUIRED to see a divergence when it is perturbed. That is what proves the field is
   * actually wired to the projectile path rather than a copy the ternary still shadows;
   * it is the positive control that makes the dead-field results mean something.
   */
  hitRadius: number;
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

/**
 * Everything a slot needs to become a fighter.
 *
 * A NAMED OBJECT rather than the seven positional arguments this used to take, and the
 * reason is the same one that motivates the whole refactor: the old signature began
 * `(role, characterId, spawn, maxHp, size, ...)` — a seat name first, then five values
 * whose meaning depended on it. Adding `id`, `controller` and `hitRadius` to that list
 * would have produced a ten-positional call in which `PLAYER_SIZE` and
 * `HIT_RADIUS_VS_PLAYER` sit adjacent and are both plain numbers. Transposing them
 * compiles, and `tsc` sees only 3 of the 71 call sites in this repo.
 */
export interface FighterSpec {
  id: FighterId;
  controller: Controller;
  characterId: CharacterId;
  spawn: Vec2;
  maxHp: number;
  /** Collision AABB size (PLAYER_SIZE / ENEMY_SIZE). */
  size: number;
  /** Incoming-projectile hit radius (HIT_RADIUS_VS_PLAYER / HIT_RADIUS_VS_ENEMY). */
  hitRadius: number;
  facing: Vec2;
  level?: number;
}

export function createFighter(spec: FighterSpec): Fighter {
  const { id, controller, characterId, spawn, maxHp, size, hitRadius, facing: initialFacing } = spec;
  const weaponCount = CHARACTERS[characterId].weapons.length;
  const lvl = clampLevel(spec.level ?? LEVEL_MIN);
  return {
    id,
    controller,
    // The legacy mirror, derived HERE and nowhere else, so no call site can hand in a role
    // that disagrees with its own slot.
    role: roleOfSlot(id),
    characterId,
    level: lvl,
    damageMul: levelDamageMultiplier(lvl),
    x: spawn.x,
    y: spawn.y,
    hp: maxHp,
    maxHp,
    size,
    hitRadius,
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
 *
 * ⚠️ THAT SECOND OBSERVER NOW EXISTS AS A ROW RATHER THAN AS A COPY — see
 * `MatchState.sightings`, of which the old single `aiSighting` is one cell.
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
  /** Slot of the fighter that fired it. Authoritative; `ownerRole` mirrors it. */
  ownerId: FighterId;
  /**
   * Slot of the only fighter this projectile can hit. Authoritative; `targetRole` mirrors
   * it, and `sim.ts:stepProjectiles` resolves the victim through `state.fighters[targetId]`
   * rather than through a seat name.
   */
  targetId: FighterId;
  /** @deprecated legacy mirror of `ownerId`. */
  ownerRole: FighterRole;
  /** @deprecated legacy mirror of `targetId`. */
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
  /** Slot of the fighter that dropped it. Authoritative; `ownerRole` mirrors it. */
  ownerId: FighterId;
  /** @deprecated legacy mirror of `ownerId`. */
  ownerRole: FighterRole;
  x: number;
  y: number;
  expiresAt: number;
  /**
   * WHICH FIGHTERS THIS MARK HAS ALREADY BITTEN — one bit per slot (`fighterBit`).
   *
   * ── WHY A MASK AND NOT A BOOLEAN, AT A CAP OF TWO ──────────────────────────
   *
   * `damaged: boolean` below means "this mark has been spent". With exactly two fighters
   * that is unambiguous: a mark has exactly one possible victim, so "spent" and "spent on
   * X" are the same statement. With three it is not, and the boolean silently picks a
   * rule: **the first victim in slot order consumes the mark and everyone else walks
   * through it free.** That is a slot advantage — the same category as the timeout
   * tiebreak's rung 3 — introduced by a field that was never meant to express a policy.
   *
   * A per-victim mask has no such rule to get wrong: each fighter is bitten at most once by
   * each mark, independently, in any iteration order. It is ORDER-FREE, which is the
   * property that matters, because the alternative would make the trail's damage depend on
   * the order `fighters` happens to be walked in.
   *
   * At N=2 it is exactly equivalent, and that is not an argument either: it is the
   * `--bitid` result. The one victim's bit is set on exactly the ticks the boolean was set.
   */
  damagedMask: number;
  /**
   * @deprecated LEGACY MIRROR of `damagedMask !== 0`. Kept because a field that DISAPPEARS
   * is a hard failure in the bit-identity differ, deliberately — see `FighterRole`. Nothing
   * reads it; `sim.ts` writes it beside the mask.
   */
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
  /**
   * 🚨 THE CONTAINER. EVERY FIGHTER IN THE MATCH, IN SLOT ORDER, AND `fighters[i].id === i`.
   *
   * ── AN ARRAY. NEVER A `Map`, `Set`, `Record` OR OBJECT-KEY WALK ────────────
   *
   * Iteration order must be a pure function of `createMatch`'s arguments and of nothing
   * else. A `Map` traverses in INSERTION order and a plain object in a key order that
   * depends on whether a key parses as an integer — so either one makes "who acts first"
   * an emergent property of how the container was built. That is the classic lockstep
   * desync mechanism, and this sim's determinism is what underwrites every balance number
   * in the project (`roster_lab`, `match-sim`, `conceal_lab --bitid`, the whole of §22).
   *
   * ── THE ORDER IS ITSELF A GAME RULE, NOT AN IMPLEMENTATION DETAIL ──────────
   *
   * Slot order decides who fires first inside a tick, whose trail mark is dropped before
   * the other walks onto it, and — at N>2 — who a shared resource goes to. It is stated
   * once, here, and `sim.ts`'s fighter loop is the only place it is consumed.
   */
  fighters: Fighter[];
  /**
   * @deprecated LEGACY SEAT ALIAS. `player` IS `fighters[0]` and `enemy` IS `fighters[1]` —
   * the SAME OBJECTS, aliased by reference.
   *
   * ⚠️ REAL, OWN, ENUMERABLE PROPERTIES, NOT GETTERS, AND THAT IS LOAD-BEARING. The
   * bit-identity proof (`conceal_lab.mjs --bitid`) walks the state with
   * `Object.keys`/spread; a getter is not an own enumerable data property, so defining
   * these as accessors would silently drop both fighters out of the comparison and the
   * differ would print PASS while comparing nothing. The differ would also see a REMOVED
   * field, which it treats as a hard failure — correctly.
   *
   * They cost one reference each and they are why ~1,089 untyped `.mjs` references and
   * four out-of-set consumers (`ui/hud.ts`, `game/match.ts`, `game/vfx.ts`,
   * `audio/director.ts`) needed zero changes.
   */
  player: Fighter;
  /** @deprecated LEGACY SEAT ALIAS — the same object as `fighters[1]`. */
  enemy: Fighter;
  projectiles: Projectile[];
  splats: Splat[];
  trailMarks: TrailMark[];
  /** @deprecated legacy mirror of `winnerId`. */
  winner: FighterRole | null;
  /** Slot of the winning fighter, or null while the match is undecided. */
  winnerId: FighterId | null;
  arena: ArenaDefinition;
  /**
   * THE PERCEPTION MATRIX: what every observer believes about every target.
   *
   * Row-major and SQUARE — `sightings[observer * fighters.length + target]` — allocated
   * once in `createMatch`, never resized, never reordered, never reallocated. Three
   * properties, each deliberate:
   *
   *   * SQUARE, INCLUDING THE DIAGONAL. `sightings[i * n + i]` exists and is never read: a
   *     fighter does not need to remember where it saw itself. Keeping it square is what
   *     keeps the index ONE arithmetic expression with no conditional in it, and a branch
   *     in an index is a place for an off-by-one to hide. The cost is `n` unread cells and
   *     it is measured, not argued: `conceal_lab.mjs --ablate` perturbs the diagonal at
   *     tick 0 over the whole corpus and requires zero differing ticks.
   *   * FLAT, NOT NESTED. One array, no per-row allocation, no per-tick indirection.
   *   * ALLOCATED ONCE. `stepAI` mutates a cell in place; nothing ever pushes or splices,
   *     so the container's identity and length are constant for the life of a match.
   *
   * ⚠️ TODAY EXACTLY ONE CELL IS EVER WRITTEN OR READ — `[1 * 2 + 0]`, the enemy's belief
   * about the player, which is what `aiSighting` below aliases. There is deliberately no
   * mirror for a human: a human already knows where they are, and the scripted player in
   * `tools/tmp/scripted_player.mjs` is a measuring instrument with perfect information BY
   * DESIGN (see its header) — giving it perception would change every recorded balance
   * number in the project for a reason that has nothing to do with the game.
   */
  sightings: Sighting[];
  /**
   * @deprecated LEGACY ALIAS — THE SAME `Sighting` OBJECT as `sightings[1 * 2 + 0]`.
   *
   * THE AI's BELIEF about where the player is.
   *
   * `ai.ts:stepAI` derives every one of its decisions from this and never from
   * `state.player.x/y`: the separation that gates weapon range, the facing it aims and
   * fires along, and the nav target it walks to. It is refreshed to the player's true
   * position on every tick the enemy can SEE the player (`movement.ts:isVisibleFrom`), so
   * with no concealment regions in the arena it is the true position on every tick and the
   * AI is bit-identical to the one that read the player directly.
   *
   * An alias by REFERENCE, not a copy: `stepAI` mutates the cell and this name sees it,
   * because they are one object. A copy would be a second statement of the same belief and
   * the two would drift the first time anyone forgot to write both.
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

/**
 * @deprecated The legacy two-seat opponent rule, on seat NAMES. Still exported and still
 * correct at N=2; `game/match.ts` and `audio/director.ts` both use it and neither was
 * touched. Inside the sim, use `opponentOf`.
 */
export function otherRole(role: FighterRole): FighterRole {
  return role === 'player' ? 'enemy' : 'player';
}

/**
 * 🚨 THE TARGET RULE, AND THE ONLY PLACE THE SIM ASSUMES THERE ARE TWO FIGHTERS.
 *
 * "Who is my opponent" is asked in five places — the melee/ranged target in
 * `combat.ts:attemptAttack`, the attacker behind a weapon hit in `combat.ts:applyDamage`,
 * the winner on a knockout, the AI's perception target in `ai.ts:stepAI`, and the trail's
 * victim list in `sim.ts:applyWorldTick`. Before this refactor each one answered it for
 * itself with `otherRole(...)` or with a literal `'player'`/`'enemy'`, which is five copies
 * of a rule that is about to stop being true.
 *
 * ⚠️ AT N>2 THIS IS NOT A FUNCTION OF ONE FIGHTER AT ALL — it becomes "nearest living
 * fighter that is not me", or a team rule, and it needs the asker's intent. That is exactly
 * why it is one named function with one call site per question rather than a `!==`
 * scattered through four files: the N>2 change is a rewrite of THIS, plus a decision about
 * what each caller wants, and nothing else.
 *
 * Throws nothing and asserts nothing at N=2 by design — it is on the per-tick path. The
 * invariant it rests on (`fighters.length === MAX_FIGHTERS`) is asserted once, in
 * `sim.test.mjs` §27, and once per match by `createMatch`'s construction.
 */
export function opponentOf(state: MatchState, fighter: Fighter): Fighter {
  return state.fighters[fighter.id === 0 ? 1 : 0];
}

/**
 * `sightings[observer * n + target]` — the perception matrix's index, stated ONCE.
 *
 * Inlined by V8 to a multiply-add; it is a function rather than an expression at each call
 * site because a row-major index written twice is a row-major index written differently
 * twice, and the second one is a transposition nobody can see from the call site.
 */
export function sightingIndex(observer: FighterId, target: FighterId, n: number): number {
  return observer * n + target;
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

/**
 * ── THE EVENT PROTOCOL NAMES FIGHTERS BY SLOT, AND MIRRORS THE SEAT NAME ────
 *
 * Every member of `GameEvent` and of `DamageSource` that identifies a fighter now carries
 * BOTH a `*Id` (authoritative) and the legacy `*Role` (a mirror, written at the same
 * moment). Nothing in `src/game/` reads the role half.
 *
 * Additive rather than a replacement, and that was a measurement rather than taste. The
 * consumers of this stream are `game/match.ts`, `game/vfx.ts`, `ui/hud.ts` and
 * `audio/director.ts` — none of them in this refactor's file set — plus every `.mjs`
 * instrument in `tools/`, which `tsc` cannot see at all. Three of those consumers recover
 * the ATTACKER with `otherRole(ev.targetRole)`, a two-seat rule living outside the sim;
 * `hit-landed` now states it as `attackerId` so they will not have to keep deriving it,
 * and `applyDamage` no longer derives it either.
 */
export type DamageSource =
  /** `attackerId` is the slot that fired it. A weapon hit ALWAYS has an attacker. */
  | { kind: 'weapon'; weaponKey: string; weaponName: string; attackerId: FighterId }
  /** A Sticky Trail mark outlives the tick that dropped it, so it carries its own owner. */
  | { kind: 'trail'; ownerId: FighterId; ownerRole: FighterRole }
  | { kind: 'hazard' }
  | { kind: 'fog' };

export type GameEvent =
  | { type: 'countdown-tick'; value: number }
  | { type: 'match-started' }
  | { type: 'match-ended'; winner: FighterRole; winnerId: FighterId }
  | { type: 'weapon-fired'; fighterRole: FighterRole; fighterId: FighterId; weaponKey: string }
  | {
      type: 'projectile-spawned';
      id: number;
      ownerRole: FighterRole;
      ownerId: FighterId;
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
      targetId: FighterId;
      amount: number;
      effect: StatusEffect;
      source: DamageSource;
      x: number;
      y: number;
    }
  | { type: 'heal'; fighterRole: FighterRole; fighterId: FighterId; amount: number }
  | { type: 'death'; fighterRole: FighterRole; fighterId: FighterId }
  | { type: 'splat-created'; x: number; y: number }
  | { type: 'trail-mark-created'; ownerRole: FighterRole; ownerId: FighterId; x: number; y: number }
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
  | { type: 'concealment-broken'; ownerRole: FighterRole; ownerId: FighterId; x: number; y: number; w: number; h: number; kind?: string };
