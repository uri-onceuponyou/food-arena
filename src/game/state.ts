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

import type { CharacterId, ItemId, StatusEffect, Weapon } from './rules.ts';
import { CHARACTERS, ITEM_SLOTS, ITEM_TUNING, ITEMS, LEVEL_MIN, clampLevel, levelDamageMultiplier } from './rules.ts';
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
 * THE SEAT CAP.
 *
 * ⚠️ **WAS `2`, AND THE WORDING BELOW IT USED TO READ:** *"THE TWO-SEAT SEAM, in ONE place…
 * Every place that still assumes exactly two fighters names this constant or `opponentOf`
 * below, so raising it is a search for two identifiers rather than a reading of four
 * files."* Kept, because that prediction is the record of what the container step bought
 * and it came true: raising the cap visited exactly those two identifiers, plus the two
 * signatures (`createMatch`, `stepMatch`) that were deliberately left alone at step 1.
 *
 * **6, because `DECISIONS §48` sizes the ×4 arena for "4-6 players"** and the top of that
 * range is the number the layout, the fog schedule and the concealment count were all
 * measured against. It is a CEILING, not a length: `fighters.length` is now anything from
 * `MIN_FIGHTERS` to this, and `createMatch`'s legacy 3-argument form still builds exactly
 * two. Nothing shipped calls the list form yet.
 *
 * ⚠️ The real ceiling above this one is `fighterBit`'s int32 coercion at 31 slots, which
 * `sim.test.mjs` §27(a) asserts rather than assumes.
 */
export const MAX_FIGHTERS = 6;

/**
 * THE FLOOR, and it is a real rule rather than a formality.
 *
 * A one-fighter match has no opponent, so `nearestLivingOpponent` returns null on tick 1 and
 * every branch below it becomes the "nothing to hit" path — a match that can only end on the
 * clock, with a `resolveTimeout` winner decided by a sort over one element. That is not a
 * game, and admitting it would mean every caller of `attemptAttack`/`stepAI` carrying a null
 * case that only a degenerate match can reach. `createMatch` refuses it instead.
 */
export const MIN_FIGHTERS = 2;

/**
 * The legacy seat name for a slot.
 *
 * ⚠️ **ONLY SLOTS 0 AND 1 HAVE A MEANINGFUL ONE, AND ABOVE `MIN_FIGHTERS` THIS IS A
 * DELIBERATE LIE.** Slot 4 is not "the enemy"; it is slot 4. The mapping stays TOTAL — every
 * slot gets a string — because `FighterRole` is a two-valued type consumed by four
 * out-of-set files (`ui/hud.ts`, `game/match.ts`, `game/vfx.ts`, `audio/director.ts`) and by
 * ~1,089 untyped `.mjs` references, and a `null` or a third value there is a runtime break
 * `tsc` cannot find. Every `*Role` field is a MIRROR that no gameplay decision reads
 * (`conceal_lab.mjs --ablate` measures that rather than asserting it), so the lie costs
 * nothing inside the sim and keeps every consumer compiling and running unchanged.
 *
 * => **A consumer that needs to tell slot 2 from slot 5 must read the `*Id`.** Every event
 * and every damage source carries one.
 *
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
  /**
   * DIMINISHING RETURNS bookkeeping — `rules.ts:STATUS_DR_SCALES`, `DECISIONS §75(a)`.
   *
   * `*AppliedAt` is the elapsed-ms of the last status that was actually APPLIED (never a
   * refused one — see the constant's header), and `*Stacks` indexes `STATUS_DR_SCALES`.
   *
   * 🚨 **THESE ARE REAL OWN ENUMERABLE PROPERTIES SEEDED IN `createFighter`, NOT OPTIONAL
   * FIELDS AND NOT GETTERS.** `conceal_lab --bitid` walks state with `Object.keys`/spread,
   * so an accessor or an `undefined`-until-first-use field is **silently dropped from the
   * differ** and a divergence in it would compare equal — the exact shape of the blinded
   * differ `nw_delta` exists to catch. Same reason `cast` is a real `null`, not absent.
   *
   * ⚠️ And they live on the FIGHTER, never on the weapon: `CHARACTERS` is a module-level
   * `Record` and `ai.ts:PRESS_VALUE` keys on **Weapon object identity**, so weapon records
   * are process-wide singletons shared by every match and every seat.
   */
  slowAppliedAt: number;
  slowStacks: number;
  stunAppliedAt: number;
  stunStacks: number;
}

/**
 * AN ATTACK THAT HAS BEEN PRESSED AND HAS NOT GONE OFF YET — the wind-up
 * (`rules.ts:Weapon.castMs`) that makes an ultimate something you can see coming and
 * move out of, which is the shape Uri chose: *"a telegraph you can dodge"*.
 *
 * ── TWO STATES, NOT FIVE ───────────────────────────────────────────────────
 * `cast === null` is idle and `cast !== null` is casting. There is deliberately no
 * `phase: 'winding' | 'channelling' | 'recovering'` enum: every richer state anyone
 * proposed turned out to be a second way of writing `elapsed >= resolvesAt`, and this
 * codebase's most expensive recorded defect is one rule stated in two places.
 *
 * ── AND NO `originX/Y`, NO `facingX/Y`, WHICH IS DERIVED RATHER THAN ECONOMISED ──
 * A cast ROOTS its caster and FREEZES its aim (`movementLocked` / `isCasting` below, read
 * by both `sim.ts` and `ai.ts`), and `x`/`y` are written only by `movement.ts:tryMove`
 * — reachable only from `moveFighter`/`moveToward`, both suppressed — while `facing` is
 * written only by `sim.ts:applyAim` and `ai.ts:stepAI`, both suppressed. So the origin
 * and the bearing of the effect are frozen BY CONSTRUCTION with no stored copy, and a
 * telegraph drawn where the caster stands at the press cannot lie about where the effect
 * lands. Storing them would create a second answer to "where is this going off", which
 * could then disagree with the first.
 *
 * ⚠️ IT LIVES ON THE FIGHTER, NOT ON THE WEAPON. `rules.ts:CHARACTERS` is a module-level
 * record and `ai.ts:PRESS_VALUE` is a `ReadonlyMap` keyed on **weapon object identity** —
 * the roster's `Weapon` objects are process-wide singletons by design. A `w.castStartedAt`
 * would therefore be shared by every seat of every match the process runs. `lastUsed[]`
 * already solved exactly this question the same way, and `cast` is index-aligned to it.
 */
export interface ActiveCast {
  /** Index into `CHARACTERS[characterId].weapons` — the SAME key `lastUsed[]` uses. */
  weaponIndex: number;
  /** Absolute `state.elapsed` at the press. The telegraph's clock starts here. */
  startedAt: number;
  /** Absolute `state.elapsed` at or after which the fighter loop resolves it. */
  resolvesAt: number;
}

/**
 * ── AN ITEM WIND-UP. THE SAME SHAPE AS `ActiveCast`, AND A SEPARATE FIELD. ───
 *
 * `ITEMS.shiitake` is *"long cooldown/windup"* (Uri) and `docs/ITEMS.md` says to build it
 * on the cast/telegraph system rather than a bespoke timer. It is a SECOND record rather
 * than a widened `ActiveCast`, and that is a measurement rather than tidiness:
 *
 * 🚨 **`ai.ts:castThreat`'s caller does `CHARACTERS[other.characterId].weapons[cast.weaponIndex]`.**
 * Putting an EQUIP-SLOT index into `ActiveCast.weaponIndex` would silently index the
 * caster's weapon list with 0 or 1 and hand the AI a real, wrong weapon to model a threat
 * from — a confident wrong answer in a file this pass does not own, produced by a field
 * whose name would have become a lie. Renaming `weaponIndex` instead is worse again: a
 * field that DISAPPEARS is a hard failure in the bit-identity differ, by design (see
 * `FighterRole`), and `ai.ts` is out of set.
 *
 * What the separate record still shares, by calling the same predicates rather than by
 * copying them: the movement root and the frozen aim (`movementLocked`, `isCasting`), and
 * cancellation on the two terminators that kill a weapon cast (an applied stun, and death).
 *
 * ⚠️ **A REAL, OWN, ENUMERABLE DATA PROPERTY INITIALISED TO `null`** — never `undefined`,
 * never a getter — for the reason `cast` carries above it: the bit-identity differs walk
 * `MatchState` with `Object.keys`/spread and an absent-until-first-use key is SILENTLY
 * DROPPED from the comparison.
 */
export interface ItemCast {
  /** Index into `ItemState.equipped` — the SAME key `ItemState.lastUsed[]` uses. */
  slot: number;
  /**
   * Which item is winding up. Stored beside the slot rather than derived from it because a
   * cancel has to NAME the item in its event, and re-reading `equipped[slot]` at the cancel
   * would be a second answer to "what is this" that could disagree with the first.
   */
  itemId: ItemId;
  /** Absolute `state.elapsed` at the press. The telegraph's clock starts here. */
  startedAt: number;
  /** Absolute `state.elapsed` at or after which the fighter loop resolves it. */
  resolvesAt: number;
}

/**
 * ── EVERYTHING A LOADOUT DOES TO ONE FIGHTER, IN ONE OBJECT ──────────────────
 *
 * `rules.ts:ITEMS` is the registry; this is the per-match state that registry needs. Uri:
 * *"up to 2 items per player, he sets it up on the loby, which ones he wants to use out of
 * what he has"*.
 *
 * 🚨 **EVERY FIELD HERE IS A REAL, OWN, ENUMERABLE DATA PROPERTY SEEDED IN
 * `createFighter`** — not optional, not a getter, not undefined-until-first-use. That rule
 * is stated four times already on this file's other per-fighter records (`cast`, `push`,
 * the DR counters) and it is the same rule for the same reason: `conceal_lab --bitid` and
 * `nw_delta` walk the state with `Object.keys`/spread, so a field that only appears once it
 * has been written is a field a divergence can hide in while the differ prints PASS.
 *
 * ⚠️ **AND THE WHOLE OBJECT IS SEEDED FOR A FIGHTER WITH NO ITEMS.** `equipped` is `[]`,
 * every deadline is `-Infinity`, every counter is its identity. That is what makes a match
 * with an empty loadout BIT-IDENTICAL in behaviour to the sim before items existed —
 * proven by `tools/tmp/is_bitid.mjs` against a detached worktree of the parent commit
 * rather than asserted here.
 *
 * ── ABSOLUTE DEADLINES, NEVER PER-TICK BOOLEANS ─────────────────────────────
 *
 * Exactly the idiom `StatusTimers` uses, and for the reason `Fighter.revealedUntil` records
 * at length: a recomputed flag is written at ONE point in the tick and its readers sit
 * either side of that point, so it is fresh for some of them and stale for others in an
 * order nobody can see from the call sites. A timestamp compared against `state.elapsed`
 * has no such window.
 */
export interface ItemState {
  /**
   * The ids this fighter took into the match, in LOBBY SLOT ORDER. At most `ITEM_SLOTS`,
   * no duplicates — `createFighter` refuses both rather than silently truncating, because a
   * loadout screen that over-filled would otherwise ship a third item that simply never
   * fired.
   *
   * ⚠️ AN ARRAY AND NOT A `Set`, for the reason `MatchState.fighters` is an array: iteration
   * order must be a pure function of the caller's arguments. A `Set` traverses in insertion
   * order, which is the same thing today and stops being the same thing the first time
   * anything rebuilds one.
   */
  equipped: ItemId[];
  /** Per-SLOT last-activation timestamp, index-aligned with `equipped`. `-Infinity` = never. */
  lastUsed: number[];
  /** Warm Milk. Movement AND actions locked until this. See `movementLocked` / `actionsLocked`. */
  sleepUntil: number;
  /** Pompa. Weapons refused until this; movement and items unaffected — Uri: *"clogs their weapons"*. */
  clogUntil: number;
  /** Liquorice Rope. Movement locked until this; the victim can still act. */
  rootUntil: number;
  /**
   * Squid Ink. **A SIM-SIDE FLAG AND NOTHING ELSE.** The blots are screen-space and belong
   * to the VFX layer, which reads this deadline off the state exactly as `vfx.ts` already
   * reads `status.stunnedUntil` to decide whether to draw a stun ring. Nothing in the sim
   * branches on it: impairing a HUMAN'S VIEW cannot be a sim input or the sim would stop
   * being a pure function of the inputs, and a bot's sight is `movement.ts:isVisibleFrom`.
   */
  blotUntil: number;
  /** Shiitake Shield. Attackers take back what they deal until this. */
  shieldUntil: number;
  /**
   * TENDERISER, AND IT IS THE **ATTACKER'S** STREAK, NOT THE VICTIM'S.
   *
   * Uri: *"each consecutive attack on the same character increases the damage by 1.3"* —
   * "consecutive" is a statement about the sequence of attacks THIS fighter makes, so the
   * cell belongs to the attacker and names the target. Slot of the fighter this streak is
   * running against, or `NO_FIGHTER` when there is none.
   */
  streakTarget: FighterId;
  /** How many consecutive hits have already landed on `streakTarget`. Clamped at `maxStacks`. */
  streakCount: number;
  /** `state.elapsed` of the last hit that fed the streak. `-Infinity` = never. */
  streakAt: number;
  /**
   * BLUE CHEESE, AND IT IS THE **VICTIM'S** ACCUMULATOR, INDEXED BY THE OWNER'S SLOT.
   *
   * One cloud can be standing on several fighters at once and several clouds can be
   * standing on one, so "how long have I been in it" is a property of the PAIR. Indexed by
   * owner slot for the same reason `hazardTimers` is indexed by hazard: `state.fighters` is
   * fixed for the life of a match, so the index is stable and iteration order is not
   * involved.
   *
   * ⚠️ Sparse and grown lazily, exactly like `hazardTimers` — a fighter only ever gets a
   * cell for an owner whose cloud has actually touched it — and read through `?? 0`.
   */
  auraTimers: number[];
  /**
   * LEFTOVERS: the slot of whoever last knocked this fighter out, or `NO_FIGHTER`.
   *
   * 🚨 **THE DEATH ORDER LIVES IN THE EVENT STREAM, NOT IN THE FINAL STATE** — every loser
   * ends bit-identical, and an orchestrator claim to the contrary was falsified once
   * already. So the killer is recorded at the instant of the kill, by the one function that
   * knows it (`combat.ts:applyDamage`, which holds the `DamageSource`), and never
   * reconstructed afterwards from a state that no longer contains the answer.
   */
  killerId: FighterId;
  /** Uri: *"Works once per match."* Seeded to `ITEM_TUNING.leftovers.usesPerMatch` iff equipped. */
  revivesLeft: number;
}

/**
 * "NO FIGHTER" for the two `FighterId`-valued cells in `ItemState`.
 *
 * ⚠️ A NUMBER AND NOT `null`, because both cells are compared against a live `FighterId` on
 * a hot path and `-1` can never collide with one: `state.fighters[i].id === i` is an
 * invariant and array indices are non-negative. `null` would have made every read a
 * two-branch test for a value that is never reachable, and `-1` indexes `state.fighters` as
 * `undefined` rather than as somebody else — which is the failure mode a plausible sentinel
 * like `0` would have had, and `0` is the human seat.
 */
export const NO_FIGHTER = -1;

export interface Fighter {
  /**
   * This fighter's SLOT INDEX. `state.fighters[i].id === i` — see `FighterId`.
   *
   * ⚠️ **LIVE, NOT DEAD, AND THE FIRST DRAFT OF THIS COMMENT CLAIMED THE OPPOSITE.** It
   * said the field was "deliberately unread by gameplay in the hot path", which read
   * plausibly and was false. `conceal_lab.mjs --ablate` catches a swap on the FIRST match it
   * runs, which is what the ablation is FOR — the design defended its new fields with "unread
   * state cannot change behaviour", an argument from code reading, and `CLAUDE.md` #6 says not
   * to trust those. This one was wrong.
   *
   * The readers, and the list is checked rather than remembered — ⚠️ it named `opponentOf`
   * first until 2026-08-11, and `opponentOf` is no longer called by the sim at all (the
   * target rule split; `nearestLivingOpponent` compares POSITIONS and object identity, never
   * ids). A comment that lists call sites goes stale exactly when the code is refactored,
   * which is when someone is most likely to read it:
   *
   *   `sim.ts:stepMatch`         `perSlot[fighter.id]` — which input this seat gets
   *   `sim.ts:applyWorldTick`    `fighterBit(victim.id)`, and `mark.ownerId !== fighter.id`
   *   `sim.ts:stepProjectiles`   `state.fighters[p.targetId]` — the victim, by slot
   *   `sim.ts:resolveTimeout`    `a.id - b.id` — the timeout tiebreak's rung 3
   *   `ai.ts:stepAI`             `sightingIndex(self.id, target.id, n)` — the belief cell
   *   `combat.ts:spawnProjectile` the projectile's `ownerId` / `targetId`
   *   `combat.ts:applyDamage`    `state.fighters[source.attackerId]` — whose `damageMul`
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
  /**
   * HOW MANY TIMES THIS FIGHTER HAS BEEN KNOCKED OUT THIS MATCH — `sim.ts:resolveTimeout`'s
   * rung 3, and its only reader.
   *
   * `DECISIONS §49a`, answered by Uri 2026-08-11: *"Fewest deaths, then lower slot"*. The
   * tiebreak needed a quantity that belongs to the FIGHTER rather than to `createMatch`'s
   * argument order, and the sim did not track one.
   *
   * ⚠️ **A STORED COUNTER, NOT `alive ? 0 : 1`, AND THE DIFFERENCE IS THE WHOLE POINT.**
   * With no respawn anywhere in the sim this field is 0 or 1 and `deaths === 1` iff
   * `hp === 0` — so today a derivation would compute the identical number, and rung 3 is
   * inert because rung 1 has already sorted every corpse below every survivor. The counter
   * exists because it is the shape that stays CORRECT when respawns land: a derived
   * `alive ? 0 : 1` would silently reset to 0 the moment a respawn set `alive = true`, and
   * "fewest deaths" would quietly become "who is standing right now" with no compile error
   * and no test failure. Recording the count is cheap; re-deriving it later is not.
   *
   * Written at exactly one place — `combat.ts:applyDamage`, beside `alive = false`, which
   * is the sim's only writer of `alive` and returns early for an already-dead target, so
   * the counter cannot double-count a corpse. `resolveTimeout` never writes it: a timeout
   * is not a knockout.
   */
  deaths: number;
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
  /**
   * The attack this fighter has pressed and not yet landed, or `null`. See `ActiveCast`.
   *
   * ⚠️ **A REAL, OWN, ENUMERABLE DATA PROPERTY, INITIALISED TO `null` — NOT `undefined`,
   * NOT A GETTER.** `tools/tmp/conceal_lab.mjs --bitid` walks `MatchState` with
   * `Object.keys`/spread; an accessor or an absent key is silently DROPPED from the
   * differ, which then prints PASS while comparing nothing. Same trap `sim.ts`'s N-fighter
   * fields hit. `createFighter` seeds it, and it is the only place any field is seeded.
   */
  cast: ActiveCast | null;
  /**
   * SIM-SIDE DISPLACEMENT IN FLIGHT — the primitive that lets the sim move a fighter that
   * did not ask to move. `rules.ts:Weapon.knockback` / `lure` / `selfLaunch` are its three
   * authored surfaces; `movement.ts:displaceFighter` writes it and `movement.ts:stepPush`
   * spends it.
   *
   * `x`/`y` are a UNIT direction and `remaining` is the world-unit distance still owed.
   * `remaining === 0` means nothing is in flight **and the direction is zeroed with it**,
   * so two behaviourally identical states are also BIT-identical — a lingering direction
   * would make `conceal_lab --bitid` report a divergence that is not one.
   *
   * ── WHY IT IS STATE AND NOT AN IMMEDIATE MOVE ──────────────────────────────
   *
   * `movement.ts:escapeCover` carried the sentence *"knockback is visual-only … it becomes
   * reachable the moment anyone adds sim-side knockback, a dash, or a pull"* for months,
   * and it was true: `game/match.ts:applyKnockback` nudges a THREE.js model root and never
   * reaches `Fighter.x/y`. An instantaneous positional jump would be a TELEPORT on screen
   * (`syncModelTransform` writes the sim position straight through), so the impulse is
   * spent over ticks at a bounded speed instead. That bound is also the safety argument:
   * see `movement.ts:MAX_PUSH_DISTANCE`.
   *
   * 🚨 **A REAL, OWN, ENUMERABLE DATA PROPERTY SEEDED IN `createFighter` — NOT `undefined`,
   * NOT A GETTER**, for the reason `cast` and the DR fields above both carry: the bit-id
   * differs walk `MatchState` with `Object.keys`/spread and an accessor or an
   * absent-until-first-use key is SILENTLY DROPPED, so a divergence in it compares equal.
   *
   * ⚠️ **NOTHING IN THE SIM READS THIS TO DECIDE ANYTHING.** It is written by
   * `movement.ts:displaceFighter` and consumed by `movement.ts:stepPush`, and it is not an
   * input to weapon choice, to steering or to the AI's belief — see `terrainSlowFactor`'s
   * and `concealed`'s notes above for why a published observation must not become a
   * decision input.
   */
  push: PushState;
  /**
   * THIS FIGHTER'S LOADOUT AND EVERYTHING IT HAS DONE OR HAD DONE TO IT. See `ItemState`.
   *
   * ⚠️ Always present, always fully seeded, `equipped: []` for a fighter that brought
   * nothing — which is every fighter every existing caller builds, and is what makes the
   * feature inert rather than merely small.
   */
  item: ItemState;
  /**
   * The ITEM this fighter has pressed and not yet resolved, or `null`. See `ItemCast`, and
   * note it is deliberately NOT the same field as `cast`: `ai.ts` indexes a weapon list
   * with `cast.weaponIndex`.
   */
  itemCast: ItemCast | null;
}

/**
 * See `Fighter.push`. A unit direction plus the world-unit distance still owed.
 *
 * ⚠️ Three numbers rather than a `Vec2` plus a scalar, because `Vec2` is spread and cloned
 * in a dozen places and a displacement is not a position: nothing may `{ ...fighter.push }`
 * into a coordinate slot by accident.
 */
export interface PushState {
  x: number;
  y: number;
  remaining: number;
  /**
   * WORLD UNITS PER MILLISECOND THIS DISPLACEMENT IS SPENT AT, or **`0` for "no rate of its
   * own"** — which `movement.ts:stepPush` reads as `PLAYER_SPEED`, the rate it hard-coded
   * before this field existed.
   *
   * ⚠️ **THE SENTINEL IS `0`, NOT `PLAYER_SPEED`, AND THAT IS WHAT KEEPS THE STATE
   * BIT-IDENTICAL.** Every weapon-driven displacement writes `0` here, so the whole shipped
   * roster produces a state digest indistinguishable from the one before the field existed
   * except for the field itself — which the differs report as an ADDED key, the one kind of
   * schema change they treat as declared rather than as a regression (see `FighterRole`).
   * Seeding it with `PLAYER_SPEED` would have written a live number into every fighter of
   * every match and made "nothing is in flight" two different states.
   *
   * Written only by `movement.ts:displaceFighter` and `placeFighterAt`, zeroed with `x`,
   * `y` and `remaining` the moment the impulse is spent, for the reason those three are:
   * two behaviourally identical states must also be BIT-identical.
   */
  speed: number;
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
  /**
   * The loadout this fighter takes into the match — up to `ITEM_SLOTS` ids, in lobby slot
   * order. Optional and defaulting to NOTHING, on the same precedent `level` sets: a caller
   * that says nothing gets the sim that existed before this field, bit for bit.
   */
  items?: readonly ItemId[];
}

/**
 * VALIDATE A LOADOUT, ONCE, WHERE A FIGHTER IS BUILT.
 *
 * 🚨 **IT THROWS RATHER THAN TRUNCATING, AND THAT IS THE WHOLE POINT.** Silently dropping a
 * third item would ship a loadout screen whose third pick simply never fires — a promise on
 * screen the game does not keep, which is this project's named failure mode ("it looked
 * like it worked"). Silently de-duplicating is the same defect wearing a different hat: two
 * copies of Blue Cheese would occupy both slots and behave as one, so the player has paid a
 * slot for nothing and nothing says so.
 *
 * ⚠️ The unknown-id check is not decoration either. `ItemId` is a union `tsc` enforces for
 * the 2 typed `createMatch` call sites in this repo and CANNOT enforce for the ~72 `.mjs`
 * instruments — the same measurement that decided `createMatch`'s compat overload — so a
 * typo in a tool would otherwise equip a ghost that never fires and quietly change nothing.
 */
function validateLoadout(items: readonly ItemId[], id: FighterId): ItemId[] {
  if (items.length > ITEM_SLOTS) {
    throw new RangeError(
      `createFighter: slot ${id} was handed ${items.length} items and the game has ${ITEM_SLOTS} equip slots`
      + ' (rules.ts:ITEM_SLOTS — Uri: "up to 2 items per player")',
    );
  }
  for (const it of items) {
    if (!(it in ITEMS)) {
      throw new RangeError(`createFighter: slot ${id} was handed an unknown item id "${it}" (see rules.ts:ITEMS)`);
    }
  }
  if (new Set(items).size !== items.length) {
    throw new RangeError(`createFighter: slot ${id} equipped a duplicate item [${items.join(', ')}]`);
  }
  return items.slice();
}

export function createFighter(spec: FighterSpec): Fighter {
  const { id, controller, characterId, spawn, maxHp, size, hitRadius, facing: initialFacing } = spec;
  const weaponCount = CHARACTERS[characterId].weapons.length;
  const lvl = clampLevel(spec.level ?? LEVEL_MIN);
  const equipped = validateLoadout(spec.items ?? [], id);
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
    status: {
      slowedUntil: -Infinity,
      stunnedUntil: -Infinity,
      slowAppliedAt: -Infinity,
      slowStacks: 0,
      stunAppliedAt: -Infinity,
      stunStacks: 0,
    },
    alive: true,
    deaths: 0,
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
    cast: null,
    // Seeded here and only here — see `Fighter.push`. A fighter that has never been shoved
    // holds `{0,0,0}`, which is the identity for `stepPush` and is what makes a roster with
    // no authored displacement bit-identical to the sim before this field existed.
    push: { x: 0, y: 0, remaining: 0, speed: 0 },
    // ── THE LOADOUT, SEEDED WHOLE, EVEN WHEN IT IS EMPTY — see `ItemState` ───
    //
    // Every field is written here and nowhere else, exactly as `push` and `cast` are, so
    // there is no state a fighter can reach in which one of these keys does not exist. A
    // fighter with `equipped: []` holds the identity for every rule below: no deadline is
    // ever in the future, no streak has a target, no cloud has a timer and no resurrection
    // is owed.
    item: {
      equipped,
      lastUsed: new Array(equipped.length).fill(-Infinity),
      sleepUntil: -Infinity,
      clogUntil: -Infinity,
      rootUntil: -Infinity,
      blotUntil: -Infinity,
      shieldUntil: -Infinity,
      streakTarget: NO_FIGHTER,
      streakCount: 0,
      streakAt: -Infinity,
      auraTimers: [],
      killerId: NO_FIGHTER,
      // Uri: *"Works once per match."* Zero for everyone who did not bring it, which is what
      // makes `revivesLeft > 0` the whole of the "may this fire" test — the equip check and
      // the once-per-match check are ONE comparison rather than two that can disagree.
      revivesLeft: equipped.includes('leftovers') ? ITEM_TUNING.leftovers.usesPerMatch : 0,
    },
    itemCast: null,
  };
}

/**
 * Is `id` in this fighter's two slots? The ONE statement of "did they bring it".
 *
 * Trivial by design, exactly as `isCasting` is: the value is having one place that asks.
 * Every rule below — the streak multiplier, the aura, the shield, the resurrection — is
 * gated on this, and a `.includes` written at each site is how a rule stated once ends up
 * implemented five times, which is this codebase's most expensive recorded defect class.
 */
export function hasItem(f: Fighter, id: ItemId): boolean {
  return f.item.equipped.includes(id);
}

/**
 * Is this fighter mid-wind-up? The ONE statement of "a cast is running".
 *
 * Trivial by design — the value is having exactly one place that asks. Its three readers
 * sit in three different files (`sim.ts:applyAim`, `ai.ts:stepAI`'s facing block, and
 * `combat.ts:attemptAttack`'s refusal to press over a live cast), which is precisely the
 * shape that produced five recorded AI defects when each site answered for itself.
 */
export function isCasting(f: Fighter): boolean {
  return f.cast !== null;
}

/**
 * ── EVERY REASON A FIGHTER CANNOT MOVE, IN ONE PLACE ────────────────────────
 *
 * 🚨 **THIS FUNCTION EXISTS BECAUSE THE STUN RULE WAS ALREADY STATED TWICE.**
 * `sim.ts:moveFighter` read `now < fighter.status.stunnedUntil` and `ai.ts:stepAI` read
 * `now < self.status.stunnedUntil` — one constant, two implementations, in the two files
 * whose disagreement is this project's most expensive recorded defect class (five AI
 * driver bugs, all of it; the worst was a stun that silenced the AI's shooting while the
 * stunned player fired 100% of its shots).
 *
 * Adding the cast root to one of those sites and not the other would have produced the
 * SIXTH instance, in the exact mirror of the recorded one: a casting human rooted, a
 * casting AI walking away from its own telegraph. So both sites call this, and
 * `sim.test.mjs` §33(e) SOURCE-SCANS `src/game/*.ts` to assert that a comparison against
 * `status.stunnedUntil` appears in exactly one file — this one.
 *
 * ⚠️ MOVEMENT ONLY, EXACTLY LIKE THE STUN IT GENERALISES. A stunned fighter still aims
 * and still fires (`rules.ts:STUN_DURATION_MS` — *"stunned = movement locked to 0"*), and
 * this predicate must never grow into "the fighter's turn does not happen": that reading
 * is the recorded bug. What a CAST additionally suppresses — aim, and opening a second
 * attack — is stated separately, by `isCasting`, at the sites that own those rules.
 */
export function movementLocked(f: Fighter, elapsed: number): boolean {
  return elapsed < f.status.stunnedUntil
    || f.cast !== null
    // An ITEM wind-up roots exactly as a weapon wind-up does — see `ItemCast`. It is a
    // second term rather than a second predicate for the reason this whole function
    // exists: `sim.ts:moveFighter`, `ai.ts:stepAI` and `movement.ts:stepPush` all ask
    // "may this fighter move", and a lock added to one of the three is the sixth
    // instance of the defect class named above.
    || f.itemCast !== null
    // Uri: *"put someone to sleep"* / *"tie an opponent"*. Both deny MOVEMENT and they
    // are not the same state — `actionsLocked` below is what separates them, and it is
    // stated there rather than here so this predicate keeps meaning exactly one thing.
    || elapsed < f.item.sleepUntil
    || elapsed < f.item.rootUntil;
}

/**
 * ── CAN THIS FIGHTER ACT AT ALL? SLEEP, AND ONLY SLEEP. ──────────────────────
 *
 * 🚨 **A SEPARATE PREDICATE FROM `movementLocked` BECAUSE THE TWO ARE NOT THE SAME
 * QUESTION, AND THIS FILE ALREADY PAID FOR ANSWERING THEM WITH ONE.** `movementLocked`'s
 * own header records the rule: *"this predicate must never grow into 'the fighter's turn
 * does not happen': that reading is the recorded bug"* — the stun that silenced the AI's
 * shooting while the stunned player fired 100% of its shots. So the wider lock gets its
 * own name and its own call sites (`combat.ts:attemptAttack` and `combat.ts:attemptItem`),
 * which are shared by the human and the AI alike, and neither side can play by a different
 * rule.
 *
 * ⚠️ **ROOT IS NOT HERE, DELIBERATELY, AND `ITEMS.liquorice.look` IS WHERE THAT PROMISE IS
 * MADE:** *"It must read as ROOTED rather than STUNNED — the victim can still act, they
 * just cannot move, and those are different states."* A tied fighter keeps shooting.
 */
export function actionsLocked(f: Fighter, elapsed: number): boolean {
  return elapsed < f.item.sleepUntil;
}

/**
 * ── CAN THIS FIGHTER FIRE A WEAPON? ─────────────────────────────────────────
 *
 * Uri: *"pompa — clogs their weapons for 5 secons"*. **WEAPONS, and nothing else** — a
 * clogged fighter still walks, still presses its other item, still finishes a wind-up it
 * had already opened. That is the narrowest reading of his sentence and it is the one that
 * makes Pompa a distinct item rather than a second stun.
 *
 * Sleep is included because a sleeping fighter does nothing at all; stating it as
 * `actionsLocked(...) ||` rather than as a second deadline comparison is what stops the two
 * from drifting apart the day sleep grows a second effect.
 */
export function weaponsLocked(f: Fighter, elapsed: number): boolean {
  return actionsLocked(f, elapsed) || elapsed < f.item.clogUntil;
}

/**
 * HOW MANY FIGHTERS ARE STILL UP. The quantity `ItemDef.minAlive` is compared against, and
 * the one `lastFighterStanding` answers a yes/no question about.
 *
 * ⚠️ **A COUNT AND NOT `lastFighterStanding(state) === null`.** Uri gated one item on
 * *"only two players left"* and `ITEM_TUNING.leftovers` on *"the killer's death must leave
 * at least 2 alive"* — those are three different thresholds (3, 2, and "more than one"),
 * and expressing them through a boolean that only knows about one of them is how a declared
 * rule becomes an inferred one. `alive && hp > 0` for the reason `isLivingOpponentOf` gives:
 * instruments pin `hp` directly and the conjunction is the one that cannot be surprised.
 */
export function livingFighterCount(state: MatchState): number {
  let n = 0;
  for (const f of state.fighters) if (f.alive && f.hp > 0) n++;
  return n;
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
   * Slot of the fighter this projectile is AIMED at — its homing target, and the frame
   * `traveled` is denominated in.
   *
   * ── ⚠️ IT USED TO SAY, AND THE OLD WORDING IS KEPT BECAUSE IT WAS TRUE OF THE SIM IT
   * DESCRIBED: ──────────────────────────────────────────────────────────────────
   *
   *   > *"Slot of the ONLY fighter this projectile can hit. Authoritative; `targetRole`
   *   > mirrors it, and `sim.ts:stepProjectiles` resolves the victim through
   *   > `state.fighters[targetId]` rather than through a seat name."*
   *
   * It was, literally: a projectile flew through every other body in the arena. **At two
   * seats that is invisible** — the only living opponent IS the target — and at six it is
   * the reason you could not body-block a shot. `sim.ts:projectileVictim` now decides who
   * is struck, from geometry, over every living opponent of the OWNER; this field kept its
   * name because the two jobs it still does are both about aim, not about damage.
   *
   * ⚠️ **AND IT IS NOW WRITABLE MID-FLIGHT.** A projectile that strikes a fighter it was
   * not aimed at retargets to it (with `targetRole`, which `net/wire.ts` asserts mirrors
   * `roleOfSlot(targetId)`), so `peckHits` keeps pecking the body it actually hit. That
   * write is unreachable at two seats, which is what keeps the N=2 state digest identical.
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
  /**
   * Budget spent, in world units — and **it is denominated in the TARGET'S FRAME**, not
   * in the projectile's own path.
   *
   * ⚠️ IT USED TO BE CUMULATIVE PATH LENGTH AND THE OLD NAME STILL FITS THE NEW RULE ONLY
   * BECAUSE THE TWO COINCIDE ON A STATIONARY TARGET. `sim.ts:stepProjectiles` now charges
   * a tick with the ground it GAINED on its target and refunds the ground the target gave
   * back, so `range` means the same thing here as it does at `ai.ts:pickWeapon`'s press
   * gate — a separation. See `rules.ts:projectileMaxAgeMs` and `DECISIONS §50b`.
   */
  traveled: number;
  /**
   * The target's position when this projectile last stepped, i.e. the origin of the frame
   * `traveled` is measured in. `undefined` on the first step (and for a projectile built
   * by a fixture rather than by `combat.ts:spawnProjectile`), which charges that tick at
   * the full path length — the shipped rule, and the conservative direction.
   */
  tx?: number;
  ty?: number;
  /**
   * Milliseconds since spawn. The termination guarantee: a shot whose target outruns it
   * gains no ground, so it would never spend its budget. See `rules.ts:projectileMaxAgeMs`.
   */
  age?: number;
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

/**
 * A MEDIKIT lying on the floor. Dropped by `combat.ts:dropMedikits` when a fighter dies,
 * expired and collected by `sim.ts:stepMedikits`. `rules.ts:MEDIKIT` holds every number.
 *
 * ── 🚨 `x`/`y` IS WHERE IT LANDS, NOT WHERE IT IS RIGHT NOW ──────────────────
 *
 * There is no "right now" in this object, and that is the design. The sim decides the
 * landing point at the instant of death and never moves the kit again; `fromX`/`fromY` is
 * the death point and `armsAt` is when the pop is over, and those two exist ONLY so the
 * presentation layer can draw an arc between them. **The arc is cosmetic.** Nothing in the
 * sim reads a position other than `x`/`y`, so a kit cannot be taken in mid-air and the
 * renderer cannot change where it lands.
 *
 * That is a stated choice with a hard reason behind it: `rules.ts` records that
 * `grep -rn 'Math.random' src/game/{sim,state,combat,ai,movement}.ts` returns NOTHING and
 * that the sim carries no RNG of any kind, seeded or otherwise. A simulated tumble would
 * have needed one, or a physics integrator and a second source of truth about where things
 * are. A computed landing point needs neither and replays exactly.
 *
 * ⚠️ **NO `role` MIRROR, DELIBERATELY.** `Projectile` and `TrailMark` both carry a
 * `@deprecated` role beside their slot id, and `net/wire.ts:validateMatchState` checks both
 * mirrors on every tick it inspects. A third mirror is a third thing that can go stale, in
 * a file this owner does not have. The slot is authoritative and it is the only copy; the
 * `medikit-dropped` event carries the role for the presentation layers that key on it,
 * derived once at emit time.
 */
export interface Medikit {
  id: number;
  /** Slot of the fighter whose death dropped it. Not a claim on it — anyone may take it. */
  sourceId: FighterId;
  /** WHERE IT LANDS. The only position the sim reads. */
  x: number;
  y: number;
  /** The death point. Cosmetic: one end of the arc the renderer draws. */
  fromX: number;
  fromY: number;
  /** `state.elapsed` at which the pop finishes and the kit becomes takeable. */
  armsAt: number;
  /** `state.elapsed` at which it vanishes. `armsAt + MEDIKIT.durationMs`. */
  expiresAt: number;
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
   * ⚠️ **ABOVE TWO FIGHTERS `enemy` IS NOT "THE OPPONENT", IT IS SLOT 1.** The alias is
   * defined by its INDEX and always has been; at N=2 the two readings coincide and there was
   * nothing to distinguish. `createMatch`'s legacy 3-argument form still builds exactly two
   * fighters, so every shipped caller keeps the reading it has. A consumer that wants "the
   * fighter my player is fighting" must ask `nearestLivingOpponent`, and one that wants a
   * particular seat must index `fighters`.
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
  /**
   * Medikits on the floor, in DROP ORDER — `combat.ts` pushes, `sim.ts` splices, nothing
   * sorts. `stepMedikits` walks it front to back, so when two kits could go to the same
   * fighter on the same tick the older one goes first. Order-dependent by construction and
   * deterministic because the order is.
   */
  medikits: Medikit[];
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
   * ⚠️ **WHICH CELLS ARE LIVE IS NOW A FUNCTION OF THE ROSTER, NOT A CONSTANT.** This used
   * to read *"TODAY EXACTLY ONE CELL IS EVER WRITTEN OR READ — `[1 * 2 + 0]`"*, and that was
   * true while every match had one human in slot 0 and one AI in slot 1. With the cap raised
   * it is one cell PER AI-CONTROLLED FIGHTER — row `self.id`, column whichever fighter
   * `nearestLivingOpponent` returned this tick, so an AI that switches targets leaves a
   * stale belief behind in the column it left. That is correct and intended: the belief
   * belongs to the PAIR, which is the whole reason the scalar became a matrix.
   *
   * There is still deliberately no mirror for a human: a human already knows where they are,
   * and the scripted player in `tools/tmp/scripted_player.mjs` is a measuring instrument
   * with perfect information BY DESIGN (see its header) — giving it perception would change
   * every recorded balance number in the project for a reason that has nothing to do with
   * the game.
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
 * touched. ⚠️ Said "inside the sim, use `opponentOf`" until 2026-08-11; the sim now asks
 * `nearestLivingOpponent` (who do I hit) or `lastFighterStanding` (who won), because those
 * were two questions wearing one name.
 */
export function otherRole(role: FighterRole): FighterRole {
  return role === 'player' ? 'enemy' : 'player';
}

/**
 * 🚨 THE TARGET RULE — **AND IT SPLIT IN TWO WHEN THE CAP CAME OFF, BECAUSE IT WAS TWO
 * QUESTIONS WEARING ONE NAME.**
 *
 * ── WHAT THIS FUNCTION USED TO SAY, AND WHY IT IS KEPT ──────────────────────
 *
 * At `MAX_FIGHTERS === 2` this was the whole rule, and its own doc predicted its end:
 *
 *   > *"AT N>2 THIS IS NOT A FUNCTION OF ONE FIGHTER AT ALL — it becomes 'nearest living
 *   > fighter that is not me', or a team rule, and it needs the asker's intent. That is
 *   > exactly why it is one named function with one call site per question rather than a
 *   > `!==` scattered through four files: the N>2 change is a rewrite of THIS, plus a
 *   > decision about what each caller wants, and nothing else."*
 *
 * That is exactly what happened. The five askers wanted three different answers:
 *
 *   asker                                    wants                       now calls
 *   `combat.ts:attemptAttack`  (who do I hit) nearest LIVING, not me      `nearestLivingOpponent`
 *   `ai.ts:stepAI`             (who do I watch) the same fighter, always  `nearestLivingOpponent`
 *   `combat.ts:applyDamage`    (who won)      the LAST ONE STANDING       `lastFighterStanding`
 *   `sim.ts:applyWorldTick`    (who treads it) ALL others                 the fighter loop
 *   this function              — the N=2 identity all three collapse to —
 *
 * ⚠️ **IT IS NO LONGER CALLED BY THE SIM, AND IT IS NOT DEAD.** It is the ORACLE the split
 * is checked against: `sim.test.mjs` §28(a) requires `nearestLivingOpponent` and
 * `lastFighterStanding` to agree with this function on a live two-fighter match, tick by
 * tick, which is the machine-checked form of *"every split reduces exactly to today's
 * behaviour at N=2"*. A test that re-derived the two-seat answer inline would only ever be
 * testing its own copy of it.
 *
 * @deprecated Two-seat only. Returns garbage above `MIN_FIGHTERS` by construction — slot 4
 * asks for its opponent and gets slot 0 — which is why nothing in the sim calls it.
 */
export function opponentOf(state: MatchState, fighter: Fighter): Fighter {
  return state.fighters[fighter.id === 0 ? 1 : 0];
}

/**
 * WHO THIS FIGHTER IS AIMING AT: the nearest fighter that is not itself and is still up.
 *
 * ── WHY "NEAREST", AND WHY IT IS ONE FUNCTION AND NOT TWO ───────────────────
 *
 * `combat.ts:attemptAttack` and `ai.ts:stepAI` must resolve the SAME fighter or the AI aims
 * at one opponent and hits another: `stepAI` picks a weapon by `pressValue(w, separation)`
 * against its target, points `facing` at it, and then hands `attemptAttack` a weapon index
 * — which resolves its own target a few lines later. Two rules there is a mis-aimed melee
 * cone and a projectile whose `targetId` is not the fighter its damage was priced against.
 * So there is one rule, stated here, called by both, on the same tick with nothing moving
 * in between.
 *
 * "Nearest" rather than "lowest slot" for the reason rung 1 of the timeout tiebreak exists:
 * a slot-ordered rule hands seat 0 a standing, unearned advantage (it would be attacked by
 * everyone, always). "Nearest" is earned, symmetric, and it is the rule a player would state.
 *
 * ⚠️ TIES BREAK ON THE LOWER SLOT — `<` and not `<=`, so the first fighter found at the
 * minimum distance keeps it. Two opponents at EXACTLY equal distance is a measure-zero case
 * in a float world, and picking arbitrarily on it would be non-determinism smuggled into a
 * sim whose determinism underwrites every balance number in the project. That is the one
 * place slot order survives in this rule, it is stated out loud, and it is unreachable in
 * practice rather than merely rare.
 *
 * ⚠️ RETURNS `null` WHEN NOTHING IS LEFT TO SHOOT AT, and both callers handle it as the
 * "attempted, nothing to hit" outcome the melee branch already had. At N=2 that null is
 * exactly `opponentOf(...).hp <= 0`, which is the condition both callers already tested for
 * — see `combat.ts:attemptAttack` for why the state is unreachable while `phase` is
 * `'playing'` at all.
 *
 * `alive && hp > 0` rather than either alone: `alive` is written only by `applyDamage` at
 * the instant `hp` reaches 0, so the two agree for any state the sim itself produces — but
 * instruments pin `hp` directly (`match-sim.mjs:768`'s forced-immortal idiom is the shipped
 * example) and the conjunction is the one that cannot be surprised by that.
 */
/**
 * IS `candidate` SOMEBODY `fighter` MAY HIT — not itself, and still up.
 *
 * ── WHY THIS IS A FUNCTION AND NOT AN INLINE `continue` ─────────────────────
 *
 * It was inline, once, inside `nearestLivingOpponent` below and nowhere else. It stopped
 * being "nowhere else" when `combat.ts:deliverWeapon`'s melee branch grew a loop over
 * EVERY opponent in the arc rather than resolving against the single nearest one — two
 * loops, two `continue`s, one rule. That is `ai.ts`'s oldest and most expensive defect
 * shape (a rule stated once in `rules.ts` and implemented twice), and the version of it
 * that would have hurt here is specific: a swing that hit a corpse, or hit its own
 * attacker, because one of the two copies forgot a clause.
 *
 * `alive && hp > 0` rather than either alone, for the reason `nearestLivingOpponent`'s own
 * doc gives: `alive` is written only by `applyDamage` at the instant `hp` reaches 0, so the
 * two agree for any state the SIM produces — but instruments pin `hp` directly
 * (`match-sim.mjs`'s forced-immortal idiom) and the conjunction is the one that cannot be
 * surprised by that.
 *
 * ⚠️ IDENTITY (`===`), NOT `id`, for "not me" — the same choice `nearestLivingOpponent`
 * made and for the same reason: a fighter object is the identity the sim moves around, and
 * two `MatchState`s never share one.
 */
export function isLivingOpponentOf(candidate: Fighter, fighter: Fighter): boolean {
  return candidate !== fighter && candidate.alive && candidate.hp > 0;
}

/**
 * ⚠️ **`except` IS AN OPTIONAL THIRD EXCLUSION AND IT IS NOT A SECOND TARGET RULE.**
 *
 * `ITEMS.disposal` — Uri: *"Black hole — throws him nearby a DIFFERENT enemy"* — has to
 * name a third fighter that is neither the caster nor the victim. That is this same rule
 * asked from the victim's position with one more body taken off the board, so it is one
 * more clause in the ONE implementation rather than a `disposalDestination()` next door
 * with its own tie-break, its own `alive` test and its own chance of forgetting one. The
 * alternative is exactly the shape `isLivingOpponentOf` was extracted to prevent.
 *
 * Omitted (`undefined`) it is bit-for-bit the two-argument function every existing caller
 * has: `other !== undefined` is true for every fighter, so the added test can never reject
 * one. §28(a) still checks the whole thing against `opponentOf` on a live two-fighter match.
 */
export function nearestLivingOpponent(
  state: MatchState,
  fighter: Fighter,
  except?: Fighter,
): Fighter | null {
  let best: Fighter | null = null;
  let bestDist = Infinity;
  for (const other of state.fighters) {
    if (!isLivingOpponentOf(other, fighter)) continue;
    if (other === except) continue;
    const d = Math.hypot(other.x - fighter.x, other.y - fighter.y);
    if (d < bestDist) {
      bestDist = d;
      best = other;
    }
  }
  return best;
}

/**
 * THE KNOCKOUT WINNER: the only fighter left standing, or `null` while more than one is.
 *
 * ⚠️ A DIFFERENT QUESTION FROM `nearestLivingOpponent`, AND AT N=2 THE SAME ANSWER — which
 * is exactly why they were one function and had to stop being one. "The other one" is the
 * survivor only while there are two; at six, a knockout is one death among five survivors
 * and the match keeps going. `combat.ts:applyDamage` therefore ends the match on this
 * returning non-null rather than on a death happening.
 *
 * Returns `null` for zero survivors too, which is not the same statement as "nobody won" and
 * is deliberately not resolved here: at N=2 the first death sets `phase = 'ended'`, so the
 * second death in the same tick never reaches this at all (`applyDamage` gates the whole
 * winner block on `phase === 'playing'`). Above N=2 a simultaneous last-two wipe would leave
 * the match `'playing'` with nobody in it and the clock would resolve it through
 * `resolveTimeout` — which is a ranked sort over the fighter list and has an answer for
 * every fighter, alive or not. That is a defensible outcome rather than a designed one, and
 * it is recorded here so whoever meets it knows it was seen.
 */
export function lastFighterStanding(state: MatchState): Fighter | null {
  let survivor: Fighter | null = null;
  for (const f of state.fighters) {
    if (!f.alive || f.hp <= 0) continue;
    if (survivor !== null) return null; // two or more up: nobody has won yet
    survivor = f;
  }
  return survivor;
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
  /**
   * ONE ITEM ACTIVATION THIS TICK: the EQUIP SLOT to press, or `null`/absent for none.
   *
   * ⚠️ **AN OPTIONAL FIELD RATHER THAN A `useItem: boolean` BESIDE `selectedItem: number`,
   * AND NEITHER HALF OF THAT IS AN ACCIDENT.** `attack` + `selectedWeapon` is two fields
   * because a weapon slot is a persistent SELECTION the player scrolls through and the HUD
   * draws; an item is two buttons on a phone, so the press names its own slot and there is
   * no selection to hold. One field also means there is no state in which a press and a
   * selection can disagree.
   *
   * ⚠️ **OPTIONAL, SO EVERY ONE OF THE 148 `stepMatch` CALL SITES IS UNCHANGED** — `tsc`
   * sees 4 of them (`state.ts:MatchInputs` records the measurement). `NEUTRAL_INPUT` does
   * not carry the key at all, which is the same statement as `null`, and both are read
   * through `?? null` at the single site that consumes it.
   *
   * ⚠️ It is INDEXED INTO `Fighter.item.equipped`, not an `ItemId`. A press names a button,
   * and which item is on that button is the loadout's business — passing an id would let a
   * caller fire an item the fighter never equipped, which is a rule the sim would then have
   * to state a second time.
   */
  useItem?: number | null;
}

/**
 * 🚨 WHAT `stepMatch` TAKES FOR ITS THIRD ARGUMENT — **ONE INPUT, OR ONE PER SLOT.**
 *
 * ── WHY A UNION RATHER THAN A NEW SIGNATURE ─────────────────────────────────
 *
 * A second human seat needs an input PER FIGHTER. `stepMatch(state, dt, input)` has **148
 * call sites in this repo and `tsc` can see 4 of them** — the rest are `.mjs` instruments
 * and the compiler is blind to every one. A third parameter, or a required array, would
 * therefore not produce a compile break that finds them; it would produce a SILENT RUNTIME
 * break in four fifths of the surface that measures this game. That is the same measurement
 * that decided `createMatch`'s compat overload and it is not a style preference.
 *
 * So the parameter WIDENS instead:
 *
 *   * a bare `MatchInput` **BROADCASTS** — every human-controlled fighter is handed the same
 *     object, which at one human seat is bit-for-bit what the sim already did. Every
 *     existing caller is in this case and none of them changed.
 *   * an ARRAY is **PER SLOT**: `inputs[fighter.id]`. A hole (`null`/`undefined`/short
 *     array) is `NEUTRAL_INPUT` — a seat with nobody in it stands still rather than
 *     inheriting its neighbour's controls.
 *
 * ⚠️ AN ARRAY, INDEXED BY SLOT — never a `Map`, `Record` or object keyed by name, for the
 * same reason `MatchState.fighters` is an array: a keyed container's traversal order depends
 * on insertion order, and a sim whose determinism underwrites every balance number in the
 * project cannot take an input whose association depends on how the caller built it.
 *
 * ⚠️ AND BROADCAST IS NOT "THE DEFAULT" — IT IS A DIFFERENT RULE, and above one human seat
 * it is the WRONG one: two humans handed one `MatchInput` move in lockstep. It is kept
 * because it is exactly today's behaviour and today's behaviour has 148 callers, not because
 * it generalises. `sim.test.mjs` §28(c) pins both readings, including that they DIVERGE the
 * moment a second slot is human — a compat shim nobody can tell from the real thing is a
 * compat shim that will be used by mistake.
 */
export type MatchInputs = MatchInput | readonly (MatchInput | null | undefined)[];

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
  /**
   * `attackerId` is the slot that fired it. A weapon hit ALWAYS has an attacker.
   *
   * ── 🚨 `itemId` — AND WHY A LOADOUT ITEM IS NOT A FIFTH `kind` ─────────────
   *
   * Blue Cheese's cloud and Shiitake's reflection are damage one fighter deliberately does
   * to another with something they brought, so they arrive on THIS member with `itemId`
   * set. **The first implementation added a fifth `kind: 'item'` and it broke `tsc` in
   * `src/audio/director.ts` — measured, not predicted.** That file narrows the union by
   * ELIMINATION (`hazard`, then `fog`, then `trail`, then "the rest is a weapon") and hands
   * the residual to `roster.ts:weaponAttackerOf`, whose parameter is
   * `Extract<DamageSource, { kind: 'weapon' }>`. A new member therefore does not extend
   * that file's switch — it invalidates the assumption underneath it, in a file this pass
   * does not own and may not edit. `match.ts:colorForDamageSource` survives only because it
   * happens to carry a `default:`.
   *
   * **An OPTIONAL PROPERTY on an existing member breaks no narrowing anywhere**, which is
   * what makes this shape landable while four out-of-set consumers stay untouched — and it
   * is the same measurement (`tsc` cannot see the consumers that matter) that decided
   * `createMatch`'s compat overload and `stepMatch`'s widened input.
   *
   * It is also an honest reading rather than a workaround: this member already means "a
   * fighter deliberately hurt you with something they brought", and `itemId` says which of
   * the two kinds of thing it was. `weaponKey` carries the ITEM ID for such a hit and
   * `weaponName` its display name, so the four consumers that look a `Weapon` up by key
   * MISS and fall back — a path every one of them already has, because `sim.test.mjs`
   * fixtures have always spammed bare `{ kind: 'weapon', weaponKey: 'T' }`. §42 asserts no
   * item id can ever collide with a real weapon key rather than trusting the casing.
   *
   * ⚠️ **AND THE SIM READS `itemId`, NOT THE KEY, AT THE THREE PLACES IT MATTERS:** item
   * damage is NOT multiplied by the owner's `damageMul` (`ITEM_TUNING.shiitake.reflect` is
   * exactly 1.0 — *"damage on EVERY damage they do"* — and a level-15 mirror returning
   * 1.70x is not that number; `blue_cheese.dps` is the roster's floor unit, not a rung on
   * the character ladder), it does NOT feed a Tenderiser streak, and it does NOT reflect —
   * which is what makes the mirror TERMINATE at one bounce instead of ringing forever
   * between two shielded fighters.
   */
  | { kind: 'weapon'; weaponKey: string; weaponName: string; attackerId: FighterId; itemId?: ItemId }
  /** A Sticky Trail mark outlives the tick that dropped it, so it carries its own owner. */
  | { kind: 'trail'; ownerId: FighterId; ownerRole: FighterRole }
  | { kind: 'hazard' }
  | { kind: 'fog' };

export type GameEvent =
  | { type: 'countdown-tick'; value: number }
  | { type: 'match-started' }
  | { type: 'match-ended'; winner: FighterRole; winnerId: FighterId }
  /**
   * THE WEAPON WENT OFF. For a weapon with no `castMs` — every weapon in the roster but
   * one — this is emitted on the tick it was pressed, exactly as it always was.
   *
   * ⚠️ **FOR A CAST WEAPON IT IS EMITTED AT THE RESOLVE, NOT AT THE PRESS**, because that
   * is the instant it describes: `match.ts` plays the attack animation off it, `vfx.ts`
   * draws the swing arc off it, and `audio/director.ts` voices the swing off it. Emitting
   * it at the press would put all three 1100 ms before the damage they are describing —
   * which is the mirror of the defect this feature fixes (`vfx.ts` already calls its
   * generic flash a *"melee wind-up"* and fires it AFTER the hit has landed).
   * `cast-started` below is the press-time event those layers should telegraph off.
   */
  | { type: 'weapon-fired'; fighterRole: FighterRole; fighterId: FighterId; weaponKey: string }
  /**
   * A WIND-UP HAS BEGUN: this fighter pressed a `castMs` weapon and is now rooted, aim
   * frozen, until `castMs` from now. Carries the duration so a telegraph can size itself
   * without importing the roster or re-reading the weapon table.
   *
   * 🚨 **AN OPPONENT-FACING TELEGRAPH DRAWN OFF THIS MUST RIDE THE SAME VISIBILITY NULL
   * CHANNEL AS THE HP PILL** (`movement.ts:isVisibleFrom` / `hud.ts:fighterVisibleTo`).
   * A cast bar over a concealed enemy's head leaks its position — a third surface asking
   * one question, which is exactly the shape §26(m) source-scans for.
   */
  | { type: 'cast-started'; fighterRole: FighterRole; fighterId: FighterId; weaponKey: string; castMs: number }
  /**
   * A WIND-UP DIED BEFORE IT LANDED. The cooldown was consumed at the press and is NOT
   * refunded — the press is spent exactly as a melee swing that misses is spent.
   *
   * `reason` is the terminator that fired, and the two are ordered: `applyDamage` applies
   * the stun before it tests for death, so a blow that both stuns and kills reports
   * `'stun'`. `RESOLVE` is not a reason here — that path emits `weapon-fired`.
   *
   * ⚠️ There is deliberately no `'match-end'` reason. A match ending mid-cast leaves the
   * record ALONE and the phase gate simply never resolves it; see `sim.test.mjs` §33(i)
   * for why clearing it in `applyDamage`'s victor block AND in `resolveTimeout` would be
   * two statements of one rule.
   */
  /**
   * ⚠️ `reason` GAINED `'sleep'` WITH THE LOADOUT ITEMS. `ITEMS.warm_milk` denies a fighter
   * its whole turn, so a wind-up it had already opened must die exactly as a stun kills one
   * — and calling that `'stun'` would have been a lie in the one field whose job is to say
   * which terminator fired. Additive: `combat.ts` is the only emitter and nothing in `src/`
   * consumes this event yet, so the widening reaches no consumer today (`vfx.ts`'s
   * `cancelCastTelegraph` takes its own separate `'stun' | 'death' | 'resolved'` and is
   * called from `match.ts`, which does not route this event at all — reported, not fixed
   * here: a cast telegraph that is never cancelled outlives the cast it draws).
   */
  | { type: 'cast-cancelled'; fighterRole: FighterRole; fighterId: FighterId; weaponKey: string; reason: 'stun' | 'death' | 'sleep' }
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
   * A MEDIKIT POPPED OUT OF A BODY. Emitted once per kit, `MEDIKIT.count` times per death,
   * immediately after the `death` event that caused it and before any `match-ended`.
   *
   * Carries BOTH ends of the arc and its duration, so the presentation layer can draw the
   * pop without importing `rules.ts` or re-reading the kit every frame: the kit leaves
   * (`fromX`, `fromY`) at the tick this fires and is on the ground at (`x`, `y`) `popMs`
   * later. ⚠️ **THAT ARC IS ENTIRELY THE RENDERER'S.** The sim never places the kit
   * anywhere but `x`/`y` — see `Medikit` — so a layer that draws a different curve, or
   * none, changes nothing about who gets the kit. It is a decoration over a decided fact,
   * which is the same contract `concealment-broken` and `splat-created` already have.
   */
  | {
      type: 'medikit-dropped';
      id: number;
      sourceRole: FighterRole;
      sourceId: FighterId;
      fromX: number;
      fromY: number;
      x: number;
      y: number;
      popMs: number;
    }
  /**
   * SOMEBODY PICKED ONE UP. `amount` is what the fighter actually GAINED — capped at its
   * own deficit and already scaled by its level, exactly as `hit-landed.amount` is what the
   * target actually lost — so a card, a number or a sound driven off it cannot disagree
   * with the health bar.
   *
   * 🚨 **A `heal` EVENT IS EMITTED ALONGSIDE THIS ONE, AND THAT IS NOT REDUNDANCY.**
   * `audio/director.ts` already voices `heal`, and splits regen from a deliberate heal on
   * `amount <= REGEN_AMOUNT` (2). A kit heals 9 before level scaling, so it lands on the
   * deliberate side of that existing split and the audio layer needs no change to sound
   * right. This event is the kit-SPECIFIC beat — the pickup flash, the tick on the HUD —
   * for a layer that wants to distinguish "healed" from "healed BY A KIT". A consumer must
   * pick one; voicing both would double.
   */
  | {
      type: 'medikit-taken';
      id: number;
      fighterRole: FighterRole;
      fighterId: FighterId;
      x: number;
      y: number;
      amount: number;
    }
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
  | { type: 'concealment-broken'; ownerRole: FighterRole; ownerId: FighterId; x: number; y: number; w: number; h: number; kind?: string }
  /* ── LOADOUT ITEMS ─────────────────────────────────────────────────────────
   *
   * Four members, and the split is by WHO NEEDS TO KNOW rather than by which item fired.
   * The VFX track builds ten world effects plus the screen-space ink off this stream and
   * off `Fighter.item`'s deadlines; the sim states what happened and never what it looks
   * like, which is the contract every other member of this union already has.
   *
   * 🚨 **DAMAGE IS NOT HERE.** Blue Cheese's tick and Shiitake's reflection are ordinary
   * `hit-landed` events carrying `DamageSource { kind: 'item' }`, so every consumer that
   * already draws a hit — the damage number, the flash, the shake, the audio — works on
   * them with no change. A second damage channel would be a second answer to "how much did
   * that cost", and `DECISIONS §13` is the record of what that costs.
   */
  /**
   * AN ITEM WAS ACTIVATED. Emitted at the PRESS, for actives only, once the press has
   * cleared every gate (`combat.ts:itemUsable`) and consumed its cooldown.
   *
   * `windupMs` is 0 for the nine items that resolve on the press and
   * `ITEM_TUNING.shiitake.windupMs` for the one that does not — so a telegraph can size
   * itself from this event alone, exactly as `cast-started` lets one size itself without
   * re-reading the weapon table. **A non-zero `windupMs` means the effect has NOT happened
   * yet**; `item-resolved` is the beat where it does.
   */
  | { type: 'item-used'; fighterRole: FighterRole; fighterId: FighterId; itemId: ItemId; slot: number; x: number; y: number; windupMs: number }
  /**
   * AN ITEM WITH A WIND-UP WENT OFF. Emitted for that item and no other, at the resolve, in
   * the same position in the tick a castless press would have landed. Nine of the ten items
   * therefore emit `item-used` alone and one emits both — which is the identical shape
   * `weapon-fired` and `cast-started` already have, deliberately.
   */
  | { type: 'item-resolved'; fighterRole: FighterRole; fighterId: FighterId; itemId: ItemId; slot: number; x: number; y: number }
  /**
   * AN ITEM WIND-UP DIED BEFORE IT LANDED. The cooldown is NOT refunded — the press is
   * spent exactly as `cancelCast`'s is, and for the same reason: interrupting a commitment
   * has to cost its owner the commitment.
   */
  | { type: 'item-cancelled'; fighterRole: FighterRole; fighterId: FighterId; itemId: ItemId; slot: number; reason: 'stun' | 'death' | 'sleep' }
  /**
   * AN ITEM LANDED ON SOMEBODY. One member for all six items that do something TO another
   * fighter (Warm Milk, Pompa, Squid Ink, Liquorice, Disposal, and Tenderiser's stack), so
   * a consumer subscribes once and switches on `itemId`.
   *
   * `durationMs` is how long the state it applied lasts, 0 for an instantaneous one.
   * `stacks` is Tenderiser's count and 0 for everything else.
   *
   * ⚠️ **`fromX`/`fromY` AND `x`/`y` ARE BOTH THE VICTIM'S, BEFORE AND AFTER.** They differ
   * for exactly one item — Disposal, which MOVES the victim — and the pair is what lets the
   * drain open where they were and the spit-out land where they went. Identical for the
   * other five, which is the honest way to say "nobody moved". Same contract, and the same
   * two-ended shape, as `medikit-dropped`.
   */
  | {
      type: 'item-hit';
      itemId: ItemId;
      ownerRole: FighterRole;
      ownerId: FighterId;
      targetRole: FighterRole;
      targetId: FighterId;
      durationMs: number;
      stacks: number;
      fromX: number;
      fromY: number;
      x: number;
      y: number;
    }
  /**
   * LEFTOVERS FIRED: a fighter is back on its feet because whoever killed it has died while
   * the match goes on. Carries the killer, because *"your killer died"* is the whole story
   * and reconstructing it downstream would mean reading a death order out of a final state
   * that does not contain one.
   */
  | { type: 'item-revived'; fighterRole: FighterRole; fighterId: FighterId; killerRole: FighterRole; killerId: FighterId; hp: number; x: number; y: number };
