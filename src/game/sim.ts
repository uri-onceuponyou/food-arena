/**
 * Match simulation entry point: `createMatch` + `stepMatch`.
 *
 * `stepMatch` is the single function a renderer calls once per frame with a `dt` in
 * milliseconds and this tick's input; it mutates `state` in place and returns the
 * list of events emitted during the step for a VFX layer to react to. The sim never
 * touches Three.js, the DOM, or wall-clock time — everything is driven by the `dt`
 * the caller supplies, which is what makes `sim.test.mjs` able to step it
 * deterministically.
 *
 * See the accompanying report for the full list of behaviours transcribed from
 * `reference/prototypes/kitchen-gameplay-prototype.html`, and for the handful of
 * places that prototype's behaviour was generalized or judged ambiguous.
 *
 * ── 2026-08-10: THE CONTAINER IS AN ARRAY, AT A CAP STILL PINNED TO 2 ───────
 *
 * `MatchState` had exactly `player: Fighter` and `enemy: Fighter`, which made this sim hard
 * 1v1 at the type level — and `DECISIONS §48` measured the consequence: a x4 arena costs
 * **+12.77 s to first contact** at 1v1 and therefore has to ship WITH more fighters, not
 * before them.
 *
 * What changed here, all of it at N=2 and all of it proven bit-identical over BOTH the
 * per-tick state and the per-tick `GameEvent[]`:
 *
 *   * `state.fighters: Fighter[]` — the container, walked in SLOT ORDER by the fighter loop
 *     in `stepMatch`, which branches on `Fighter.controller` and not on a seat name.
 *   * `state.sightings` — an N x N perception matrix; the old scalar `aiSighting` is one
 *     cell of it, aliased by reference.
 *   * ids on everything that names a fighter (projectiles, trail marks, damage sources,
 *     events), with the `*Role` seat names kept as mirrors.
 *   * `resolveTimeout` is a ranked sort rather than a two-way comparison.
 *   * `TrailMark.damagedMask` — per-victim and order-free, so the trail does not acquire a
 *     slot-order rule the day a third fighter exists.
 *
 * WHAT DID NOT CHANGE, deliberately: `createMatch`'s signature, `stepMatch`'s signature, and
 * every `*Role` field. **68 of 71 `createMatch` call sites in this repo are in `.mjs` files
 * that `tsc` cannot see**, so a signature change here fails silently at runtime in four
 * fifths of the instruments rather than loudly at compile time. Raising the cap is a
 * separate step and it visits `state.ts:MAX_FIGHTERS` and `state.ts:opponentOf`.
 *
 * ── 2026-08-11: THE CAP CAME OFF, AND THE PREDICTION ABOVE HELD ─────────────
 *
 * `MAX_FIGHTERS` is **6** (`DECISIONS §48`: the ×4 arena is sized for "4-6 players"). The
 * paragraph above forecast that raising it would visit `MAX_FIGHTERS` and `opponentOf` —
 * and it did, plus the two signatures that paragraph itself deferred:
 *
 *   * **`createMatch` takes a FIGHTER LIST**, with the 3-argument `(arena, playerId,
 *     enemyId, levels)` form kept as a compat OVERLOAD that delegates to it. Not one line of
 *     any of the 74 existing call sites changed.
 *   * **`stepMatch` takes ONE INPUT *OR* ONE PER SLOT** (`state.ts:MatchInputs`). A bare
 *     `MatchInput` broadcasts — exactly today's behaviour with one human seat — and an array
 *     is indexed by slot. **148 call sites, `tsc` sees 4** (grep over `src/` + `tools/`).
 *   * **`opponentOf` SPLIT BY ASKER.** "Who do I shoot" became `nearestLivingOpponent`; "who
 *     won" became `lastFighterStanding`; "who treads my trail" was already the fighter loop.
 *     They are three different questions that were indistinguishable at two fighters.
 *
 * Every one of those reduces EXACTLY to the previous behaviour at N=2, and that is a
 * measurement rather than an argument — `conceal_lab.mjs --bitid --sim-ref cdcdd65` over the
 * `normal` / `timeout` / `countdown` corpora at three level splits, compared per tick over
 * both the whole state and the returned `GameEvent[]` in order. The acceptance run is in the
 * commit message. `conceal_lab.mjs --nfighter` is the arm that only exists now: N=3..6 for
 * self-consistency (determinism, no NaN, every fighter stepped exactly once per tick, and
 * iteration order a pure function of `createMatch`'s argument order).
 */

import {
  CHARACTERS,
  COUNTDOWN_FROM,
  COUNTDOWN_START_FLASH_MS,
  ENEMY_MAX_HP,
  ENEMY_SIZE,
  FOG_DAMAGE,
  FOG_TICK_MS,
  HIT_RADIUS_VS_ENEMY,
  HIT_RADIUS_VS_PLAYER,
  HOMING_TURN_RATE,
  clampLevel,
  fogRadiusAt,
  LEVEL_MIN,
  MATCH_DURATION_MS,
  minSafeRadiusFor,
  maxHpFor,
  PLAYER_MAX_HP,
  PLAYER_SIZE,
  PLAYER_SPEED,
  PUDDLE_SLOW_FACTOR,
  projectileMaxAgeMs,
  REGEN_AMOUNT,
  REGEN_DELAY_MS,
  REGEN_TICK_MS,
  SLOW_MOVE_MULTIPLIER,
  speedFor,
  SPLAT_DURATION_MS,
  SPLAT_RADIUS,
  SUDDEN_DEATH_RADIUS,
  SUDDEN_DEATH_REMAINING_MS,
  suddenDeathActive,
  TRAIL,
  type CharacterId,
} from './rules.ts';
import type { ArenaDefinition } from '../arena/types.ts';
import type {
  Controller, Fighter, FighterId, GameEvent, MatchInput, MatchInputs, MatchState, Sighting, Splat,
  TrailMark, Vec2,
} from './state.ts';
import { createFighter, fighterBit, isCasting, MAX_FIGHTERS, MIN_FIGHTERS, movementLocked, sightingIndex } from './state.ts';
import { applyDamage, attemptAttack, isOnOwnTrail, resolveDueCast } from './combat.ts';
import { boxesOverlap, isHidden, isVisibleFrom, tryMove } from './movement.ts';
import { stepAI } from './ai.ts';

/**
 * Projectile-vs-cover collision box, in world units. NOT in `rules.ts` — the
 * prototype's projectile update loop hardcodes it inline
 * (`const box = {x:newX-6, y:newY-6, w:12, h:12}`), and there is no named constant
 * for it anywhere in the frozen design. Transcribed verbatim rather than invented;
 * flagged here (and in the report) as the one gameplay-shaped number this module
 * needed that the frozen rules didn't provide.
 */
const PROJECTILE_COVER_SIZE = 12;

/**
 * The fog's starting radius is read from `arena.maxSafeRadius`, NOT from
 * `rules.ts`'s `MAX_SAFE_RADIUS` (545) — arena geometry is the one sanctioned
 * exception to the frozen design, and `src/arena/types.ts` explicitly lists
 * `maxSafeRadius` as part of what the sim reads from the arena, alongside
 * `cover`/`hazards`/`center`/`width`/`height`. `rules.MAX_SAFE_RADIUS` is the
 * historical value for the prototype's original 900x600 arena; a redesigned,
 * larger arena supplies its own so the closing ring stays proportionate. The
 * *formula* (`safeRadius = max * (1 - matchProgress)`) is still exactly the
 * frozen one — only the max is arena-scoped now.
 */

/**
 * The two fighters' CHARACTER levels (`rules.ts` `LEVEL_MIN`..`LEVEL_MAX`).
 *
 * ── Both sides, one shape, deliberately ─────────────────────────────────────
 * Uri: *"The game eventually should be humans vs. humans. We will incorporate AI players
 * to enrich. They need to be adjusted to the player's level."* So this is a symmetric
 * pair, not a player level plus a difficulty knob: the caller decides what the opponent
 * is standing in for, and `economy/levels.ts:enemyLevelFor()` is the shipped answer
 * (mirror the player). Nothing in the sim treats the two fields differently.
 *
 * Optional, and defaulting to `LEVEL_MIN` on both sides, because `levelHealthMultiplier`
 * and `levelDamageMultiplier` are both exactly 1.0 there — so every caller written before
 * levels existed produces a bit-identical match.
 */
export interface MatchLevels {
  player?: number;
  enemy?: number;
}

/**
 * ONE ENTRY IN `createMatch`'s FIGHTER LIST — what a slot needs, minus everything the seat
 * already implies.
 *
 * ⚠️ NOT the same type as `state.ts:FighterSpec`, deliberately. `FighterSpec` is what
 * `createFighter` needs and every field of it is REQUIRED, because that factory must never
 * guess. This is what a CALLER should have to know, and the answer is "which character, and
 * where" — the pools, the collision size and the hit radius are the seat's, not the
 * caller's, and a caller that had to pass `HIT_RADIUS_VS_ENEMY` by hand would eventually
 * pass `PLAYER_SIZE` into it (they are adjacent plain numbers; see `FighterSpec`'s own note
 * on why it stopped being positional).
 *
 * ── 🚨 THE DEFAULTS: A BOT-OPPONENT DIAL AT TWO SEATS, FLAT ABOVE (DECISIONS §49c) ──
 *
 * At N=2 the defaults reproduce the legacy 3-argument form EXACTLY — slot 0 gets the PLAYER
 * dial (`PLAYER_MAX_HP`, `PLAYER_SIZE`, `HIT_RADIUS_VS_PLAYER`, `arena.playerSpawn`, facing
 * +x) and slot 1 the ENEMY dial. That equivalence is measured, not asserted: the legacy form
 * is implemented BY calling this one, and `--bitid` compares the result against `cdcdd65`
 * tick for tick.
 *
 * ⚠️ **THIS BLOCK USED TO SAY**: *"Above two, every slot from 1 up gets the ENEMY dial, and
 * that is the smallest rule that reduces to today — but it is a CHOICE, not a derivation…
 * in a brawl it is a standing advantage to seat 0. **Parked for Uri as §49c.**"* It was
 * answered on 2026-08-11 and the answer is not one of the options it offered:
 *
 *   > *"AI player is currently only for testing the game. Later on when real PvP occurs
 *   > each player has it stats based on the level if their brawler"*
 *
 * So **above two fighters every slot gets the SAME dial** and the only things that separate
 * two fighters are `Fighter.level` and the character's card. `ENEMY_MAX_HP` is not a
 * balance dial for the shipped game at all — it is the difficulty dial for a BOT OPPONENT,
 * which exists only in the two-seat duel and in the measuring instruments. Its VALUE is
 * untouched (AUTHORISED DEVIATION #9 stands); its SCOPE is what moved. See
 * `createMatchFromList` for the one line that implements it.
 *
 * A caller that disagrees still passes `maxHp` / `size` / `hitRadius` explicitly — which is
 * how an INSTRUMENT keeps a 100/90 split above two seats if it wants one.
 */
export interface FighterConfig {
  characterId: CharacterId;
  /** Default: slot 0 is `'human'`, every other slot is `'ai'`. */
  controller?: Controller;
  /** `rules.ts` `LEVEL_MIN`..`LEVEL_MAX`; clamped. Default `LEVEL_MIN`, where every multiplier is 1.0. */
  level?: number;
  /**
   * Where this fighter starts.
   *
   * ⚠️ **REQUIRED FOR SLOT 2 AND UP, AND THAT IS THE POINT.** `ArenaDefinition` declares
   * exactly two spawns (`playerSpawn`, `enemySpawn`), so slots 0 and 1 default from the
   * arena and there is nothing for slot 2 to default FROM. `createMatch` throws rather than
   * inventing a ring of spawn points here: spawn placement is arena geometry, `src/arena/**`
   * owns it, and `DECISIONS §48` is explicit that the 2800x2000 layout — including where 4-6
   * fighters start on it, at true 180° point symmetry — is a layout pass with its own
   * fairness constraint. A default here would be a second, quieter source of truth for it,
   * and it would look like it worked.
   */
  spawn?: Vec2;
  /** Default: +x for slot 0, -x for slot 1 (the legacy pair), and "look at `arena.center`" above that. */
  facing?: Vec2;
  /** Default: `maxHpFor(characterId, <seat pool>, level)`. See the dial note above. */
  maxHp?: number;
  /** Collision AABB. Default `ENEMY_SIZE` for the DUEL's slot 1, `PLAYER_SIZE` everywhere else. */
  size?: number;
  /** Incoming-projectile hit radius. Default `HIT_RADIUS_VS_ENEMY` for the DUEL's slot 1, `..._VS_PLAYER` everywhere else. */
  hitRadius?: number;
}

/**
 * ⚠️ THE 3-ARGUMENT FORM IS A COMPAT OVERLOAD AND IT IS NOT GOING ANYWHERE SOON.
 *
 * **74 `createMatch` call sites live in this repo and `tsc` can see 2 of them** — everything
 * else is an untyped `.mjs` instrument. Replacing this signature would not produce a compile
 * break that finds them; it would produce a silent runtime break in the tools that measure
 * the game, which is the trap that decided the whole shape of this refactor. So the list
 * form is ADDITIVE, the legacy form is implemented by calling it, and both are pinned by
 * `sim.test.mjs` §28(b).
 */
export function createMatch(arena: ArenaDefinition, fighters: readonly FighterConfig[]): MatchState;
export function createMatch(
  arena: ArenaDefinition,
  playerCharacterId: CharacterId,
  enemyCharacterId: CharacterId,
  levels?: MatchLevels,
): MatchState;
export function createMatch(
  arena: ArenaDefinition,
  a: readonly FighterConfig[] | CharacterId,
  enemyCharacterId?: CharacterId,
  levels?: MatchLevels,
): MatchState {
  // The discriminator is the ARGUMENT'S SHAPE, not an options flag, because every one of the
  // 74 existing call sites passes a bare string here and none of them can be asked to
  // declare which form it meant. `Array.isArray` is total over both alternatives.
  if (Array.isArray(a)) {
    // ⚠️ THE MIXED CALL IS REFUSED RATHER THAN IGNORED. `createMatch(arena, [...], undefined,
    // { player: 15 })` would otherwise DROP the levels silently — a balance run at level 1
    // reported as level 15, which is precisely the class of defect the `--levels` arm of
    // `conceal_lab` exists to expose (at `LEVEL_MIN` every multiplier is 1.0, so the mistake
    // is invisible in the numbers). `tsc` refuses it for the 2 typed call sites and cannot
    // see the other 72, so it is a runtime throw as well.
    if (enemyCharacterId !== undefined || levels !== undefined) {
      throw new TypeError('createMatch: the fighter-list form takes no third or fourth argument;'
        + ' put `level` on each FighterConfig instead');
    }
    return createMatchFromList(arena, a);
  }
  const lv = levels ?? {};
  return createMatchFromList(arena, [
    { characterId: a as CharacterId, level: lv.player },
    { characterId: enemyCharacterId as CharacterId, level: lv.enemy },
  ]);
}

function createMatchFromList(arena: ArenaDefinition, configs: readonly FighterConfig[]): MatchState {
  if (configs.length < MIN_FIGHTERS || configs.length > MAX_FIGHTERS) {
    throw new RangeError(
      `createMatch: ${configs.length} fighters; the sim seats ${MIN_FIGHTERS}..${MAX_FIGHTERS}`
      + ' (see state.ts MIN_FIGHTERS / MAX_FIGHTERS)',
    );
  }

  // ── PER-CHARACTER POOLS, ON TOP OF THE ROLE DIAL (rules.ts DEVIATION #10) ──
  // `maxHpFor` multiplies the ROLE base by the character's own `stats.health`, so
  // `ENEMY_MAX_HP` keeps scaling the whole roster exactly as it did — a per-character
  // pool that replaced the role constant would have taken Uri's difficulty dial away.
  // The level term rides ALONGSIDE the character term inside `maxHpFor`, never instead
  // of it, so `maxHpFor` stays linear in its `roleBaseHp` at every level — which is what
  // `sim.test.mjs` §22(b) asserts and what keeps `ENEMY_MAX_HP` a working dial.
  //
  // ⚠️ `clampLevel` RUNS HERE AS WELL AS INSIDE `createFighter`, and the duplication is
  // load-bearing rather than sloppy: `maxHpFor` is handed the level too, so an out-of-range
  // level that was clamped only in the factory would bake a POOL from the raw number and a
  // `damageMul` from the clamped one. The legacy path clamped before calling `maxHpFor` for
  // exactly this reason; the list path has to as well or the compat overload stops being
  // one. `clampLevel` is idempotent, so the second application is free.
  //
  // ── 🚨 THE BOT-OPPONENT DIAL, AND WHY IT STOPS AT TWO SEATS (DECISIONS §49c) ──
  //
  // ⚠️ **THIS USED TO READ `seatIsPlayer = id === 0` AND DIAL EVERY SLOT ABOVE 0 AS "THE
  // ENEMY", AT EVERY MATCH SIZE.** That was the smallest rule that reduced to the duel, and
  // it was recorded as a CHOICE parked with Uri rather than a derivation. Uri answered it
  // on 2026-08-11 and the answer reframes the constant rather than picking an option:
  //
  //   > *"AI player is currently only for testing the game. Later on when real PvP occurs
  //   > each player has it stats based on the level if their brawler"*
  //
  // The AI opponent is a **test harness, not a design target**. So `ENEMY_MAX_HP` is not
  // the shipped game's balance dial at all — it is the difficulty dial **for a bot
  // opponent**, which is a two-seat single-player idea, and above two seats there is no
  // "the enemy" for it to describe. `isBotDuel` is therefore the ONLY gate on it:
  //
  //   * at two seats, slot 1 is the bot the duel is dialled against and keeps
  //     `ENEMY_MAX_HP` / `ENEMY_SIZE` / `HIT_RADIUS_VS_ENEMY` **unchanged** — AUTHORISED
  //     DEVIATION #9 (`ENEMY_MAX_HP` 150 -> 90) is NOT reversed by this, and this line is
  //     what keeps `--bitid` at N=2 exact;
  //   * above two seats **no slot gets a different dial because of its index**. Every
  //     fighter is built from the same role base, and the only things that separate two
  //     fighters are `Fighter.level` and the character's own card — which is what Uri's
  //     sentence says the shipped game is.
  //
  // ⛔ "Keep the seat dial" is RETIRED PERMANENTLY. Do not re-offer or re-derive it.
  //
  // ⚠️ The flat base is `PLAYER_MAX_HP`, not an average of the two, because 100 is the
  // number every HUD bar, every damage figure and every "a 100 HP player" in this repo is
  // written against (`rules.ts` says so at the constant). `PLAYER_SIZE === ENEMY_SIZE`
  // already, so the size dial moves nothing today — and `DECISIONS §52b` measured what it
  // WOULD cost if it ever did: `movement.ts:navGrid` keys its passability cache on the
  // requested size, so alternating sizes between consecutive seats produced **1,114 full
  // grid rebuilds over 680 playing ticks against 1**. Flattening the seats removes that
  // trap rather than merely not springing it.
  //
  // ⚠️ `controller` is NOT part of this and stays keyed on the slot: it says who supplies
  // the inputs, not what the fighter is made of, and slot 0 is still the local human seat.
  // The remaining bot asymmetry in the sim lives there and is correct under this same
  // answer — `ai.ts` moves at `AI_CHASE_SPEED` (0.07) where a human moves at `PLAYER_SPEED`
  // (0.12), a 1.71x gap that applies to whoever is driven by a bot at any match size, and
  // vanishes on its own when every seat is human.
  const isBotDuel = configs.length === MIN_FIGHTERS;
  const fighters: Fighter[] = configs.map((cfg, id) => {
    const lvl = clampLevel(cfg.level ?? LEVEL_MIN);
    const seatIsLocal = id === 0;
    // The seat this match's difficulty is dialled against: the duel's bot opponent, and
    // nothing else, ever. `false` for every seat of a 3..6 fighter brawl.
    const seatIsBotOpponent = isBotDuel && !seatIsLocal;
    const spawn = cfg.spawn ?? defaultSpawn(arena, id);
    return createFighter({
      id,
      controller: cfg.controller ?? (seatIsLocal ? 'human' : 'ai'),
      characterId: cfg.characterId,
      spawn,
      maxHp: cfg.maxHp ?? maxHpFor(cfg.characterId, seatIsBotOpponent ? ENEMY_MAX_HP : PLAYER_MAX_HP, lvl),
      size: cfg.size ?? (seatIsBotOpponent ? ENEMY_SIZE : PLAYER_SIZE),
      hitRadius: cfg.hitRadius ?? (seatIsBotOpponent ? HIT_RADIUS_VS_ENEMY : HIT_RADIUS_VS_PLAYER),
      facing: cfg.facing ?? defaultFacing(arena, id, spawn),
      level: lvl,
    });
  });

  /**
   * EVERY OBSERVER STARTS THE MATCH KNOWING WHERE EVERY FIGHTER SPAWNED.
   *
   * This GENERALISES the single seed line it replaces, and that line existed for a precise
   * reason: `stepAI`'s first read of the belief happens BEFORE anything has had a chance to
   * refresh it, so seeding with a "never seen" sentinel would have made tick 1 differ from
   * the pre-concealment sim. Seeding the whole square with each target's true spawn keeps
   * that property for every cell — including the `n` diagonal cells, which are never read
   * and are seeded anyway rather than left `undefined`, because a hole in a matrix is a
   * `NaN` waiting for the first person to index it.
   *
   * Allocated ONCE, here. Nothing pushes to or splices this array for the life of a match.
   */
  const n = fighters.length;
  const sightings: Sighting[] = new Array(n * n);
  for (let observer = 0; observer < n; observer++) {
    for (let target = 0; target < n; target++) {
      sightings[sightingIndex(observer, target, n)] = { x: fighters[target].x, y: fighters[target].y, at: 0 };
    }
  }

  return {
    phase: 'countdown',
    elapsed: 0,
    countdownValue: COUNTDOWN_FROM,
    countdownTick: 0,
    startFlashTimer: 0,
    timeRemaining: MATCH_DURATION_MS,
    safeRadius: arena.maxSafeRadius,
    fighters,
    // ⚠️ THE SAME OBJECTS, aliased by reference — own enumerable data properties, never
    // getters. See the field docs on `MatchState.player`: a getter is invisible to the
    // `Object.keys`/spread walk the bit-identity differ uses, so the proof would silently
    // stop comparing both fighters and still print PASS.
    player: fighters[0],
    enemy: fighters[1],
    projectiles: [],
    splats: [],
    trailMarks: [],
    winner: null,
    winnerId: null,
    arena,
    sightings,
    // The legacy name for the cell a two-fighter match reads: observer 1 on target 0. The
    // SAME object, not a copy.
    // ⚠️ IT IS STILL SLOT 1's BELIEF ABOUT SLOT 0 AND NOTHING MORE. This used to be
    // documented as "the one cell anything reads today", which was true at a cap of two and
    // is not a definition — with more seats, every AI-driven fighter writes its own row and
    // this name sees one of them. Kept because four out-of-set files and ~1,089 untyped
    // `.mjs` references read it, all of them in two-fighter matches.
    aiSighting: sightings[sightingIndex(1, 0, n)],
    // Every plate starts the match intact — a restart is a fresh set of cover, which is why
    // this is per-match state and not a mutation of the shared arena. See the field doc.
    brokenConcealment: [],
    nextId: 1,
  };
}

/**
 * WHERE SLOT `id` STARTS WHEN THE CALLER DID NOT SAY.
 *
 * 🚨 **IT THROWS ABOVE SLOT 1 RATHER THAN INVENTING A SPAWN, AND THAT IS THE WHOLE POINT.**
 * `ArenaDefinition` declares exactly two spawn points. A fallback here — a ring around
 * `arena.center`, a grid, anything — would be `sim.ts` authoring arena geometry, i.e. a
 * second source of truth for the one quantity `DECISIONS §48` is most explicit about:
 *
 *   > *"Preserve true 180 degree point symmetry … Every added prop needs its partner. **This
 *   > is competitive fairness, the same category as `aspect.mjs`**"*
 *
 * Spawn placement for 4-6 fighters is part of that layout pass and it belongs to
 * `src/arena/**`. An invented default would put fighters somewhere plausible, produce
 * balance numbers, and be wrong in a way no instrument here could see — which is exactly
 * the failure mode this project names "it looked like it worked".
 */
function defaultSpawn(arena: ArenaDefinition, id: FighterId): Vec2 {
  // ⚠️ Slots 0 and 1 read the NAMED fields, not `spawns[0]`/`[1]`, even though the arena
  // now publishes both and `kitchen.ts` makes them the same OBJECTS. The named path is
  // what 41,722,453 ticks of bit-identity were measured through, and routing the duel
  // through a new array would make that proof describe a different code path than the one
  // that ships. `sp_gate --selftest` pins the two to the same objects instead.
  if (id === 0) return arena.playerSpawn;
  if (id === 1) return arena.enemySpawn;
  // Slots 2+ now resolve if — and only if — the ARENA declares them. `0fffa1e` added
  // `spawns` to `ArenaDefinition` with three 180°-mirrored pairs, so the refusal below is
  // no longer reached on the shipped kitchen. It stays for every arena that has not done
  // the work: the throw is the thing that kept an invented default out of `sim.ts`.
  const declared = arena.spawns?.[id];
  if (declared) return { x: declared.x, y: declared.y };
  throw new RangeError(
    `createMatch: slot ${id} has no spawn. ArenaDefinition declares playerSpawn and enemySpawn only,`
    + ' so slots 2 and up must pass `spawn` explicitly — arena geometry is src/arena/**\'s to own'
    + ' (DECISIONS §48: spawn placement is part of the 180° point-symmetry fairness constraint).',
  );
}

/**
 * WHICH WAY SLOT `id` LOOKS ON TICK 0.
 *
 * Slots 0 and 1 keep the literal +x / -x the two-seat form has always used — the two shipped
 * spawns face each other across the map, so those literals ARE "look at the middle" and
 * changing them to the derived form would move the first tick of every recorded match.
 * Above that the derivation is the honest one: face `arena.center`, which the arena already
 * declares, so no new geometry is invented (see `defaultSpawn`).
 *
 * A spawn exactly ON the centre has no bearing to it — the same degeneracy `combat.ts`
 * answers for a coincident melee and `ai.ts` for a coincident aim — so it falls back to +x
 * rather than dividing by zero. `createFighter` must receive a non-zero facing: nothing else
 * in the sim ever writes a zero one, and `spawnProjectile`'s `atan2(0, 0)` is exactly 0,
 * which is how "a cornered AI fires due east" got into this project once already.
 */
function defaultFacing(arena: ArenaDefinition, id: FighterId, spawn: Vec2): Vec2 {
  if (id === 0) return { x: 1, y: 0 };
  if (id === 1) return { x: -1, y: 0 };
  const dx = arena.center.x - spawn.x;
  const dy = arena.center.y - spawn.y;
  const m = Math.hypot(dx, dy);
  return m > 1e-6 ? { x: dx / m, y: dy / m } : { x: 1, y: 0 };
}

/**
 * THE INPUT A SEAT GETS WHEN NOBODY IS DRIVING IT.
 *
 * Frozen, and shared rather than allocated per tick: `stepMatch` runs 60 times a second in
 * the game and ~26 million times in one `--bitid` run, and `tools/perf.mjs --mode alloc`
 * exists because this file's per-tick allocations are measured. Nothing writes through a
 * `MatchInput` — `applyAim` and `moveFighter` only read — so one shared object is safe, and
 * `Object.freeze` is what makes that a guarantee instead of a habit.
 */
const NEUTRAL_INPUT: MatchInput = Object.freeze({
  move: Object.freeze({ x: 0, y: 0 }),
  selectedWeapon: 0,
  attack: false,
}) as MatchInput;

export function stepMatch(state: MatchState, dt: number, input: MatchInputs): GameEvent[] {
  const events: GameEvent[] = [];
  state.elapsed += dt;

  stepCountdown(state, dt, events);

  if (state.phase === 'playing') {
    state.timeRemaining = Math.max(0, state.timeRemaining - dt);
    // ⚠️ THIS LINE USED TO READ `const progress = 1 - state.timeRemaining / MATCH_DURATION_MS`
    // and the ring was `maxSafeRadius * (1 - progress)` — **the ring WAS the clock.** Uri
    // reversed that on 2026-08-12 (`rules.ts:FOG_HOLD_MS`): the ring holds for 25 s, closes,
    // and arrives at its floor at 120 s, while the clock runs to 150 s. A single normalised
    // `progress` cannot express a schedule with three phases, so the schedule is a function
    // now and this is the only site that evaluates it.
    const playMs = MATCH_DURATION_MS - state.timeRemaining;
    // The floor is what makes the timeout rule below reachable at all: without it the
    // ring reaches 0, nowhere costs 0 HP/s for the last seconds, and the smaller HP
    // pool (always the player's) dies before the whistle. See `MIN_SAFE_RADIUS`.
    //
    // ── ⚠️ THE FLOOR IS A FUNCTION OF THE SEAT COUNT NOW (DECISIONS §53b) ─────
    //
    // This line used to read `Math.max(MIN_SAFE_RADIUS, …)` — a 140 wu CONSTANT, which
    // made the final 0 HP/s annulus 45 wu wide (1.07 body widths) at every fighter count
    // and every arena size, so six fighters finished the match standing on a one-body ring
    // already inside each other's range. `minSafeRadiusFor` carries the whole derivation;
    // it returns exactly `MIN_SAFE_RADIUS` for n <= 4, which is what keeps the shipped
    // duel bit-identical.
    //
    // `state.fighters.length` is the SEATED count and is fixed for the life of a match
    // (nothing pushes to or splices that array). The LIVING count would make the ring GROW
    // as fighters die — a fog that recedes — and `safeRadius` being monotone non-increasing
    // is relied on by `audio/director.ts`'s one-shot floor latch and by `ui/hud.ts`'s
    // inversion of this very formula.
    //
    // Called per tick rather than cached on the state: `MatchState` is `state.ts`'s to
    // shape, and a copy of a fairness derivation stored beside the thing it constrains is
    // how a second, quieter source of truth gets born. At two seats the call is one
    // comparison and a constant return — no `Math.sin` is evaluated — so the shipped duel's
    // hot path is unchanged as well as its output.
    //
    // ── 🚨 AND SUDDEN DEATH IS A CAP THAT DOMINATES THAT FLOOR (DECISIONS §2) ──
    //
    // Uri, 2026-08-11: *"after 30 seconds reduce the fog to all screen and the one who
    // has more HP wins."* So from `SUDDEN_DEATH_MS` there is no safe ground at all.
    //
    // ⚠️ IT IS A TERNARY AND NOT A THIRD TERM IN A `Math.max`, AND THAT IS THE WHOLE
    // ARITHMETIC. `Math.max(0, R)` is R for every R the schedule produces, so a floor of
    // zero would change nothing and the collapse would silently not happen. Sudden death
    // REPLACES the schedule; the schedule floors itself while it is still running.
    // `rules.ts:ringFloorFor` is the same fact for the three READERS of the floor, which
    // do want a `max`-shaped answer; this is the one site that needs the cap.
    //
    // ⚠️ THIS COMMENT USED TO CARRY THE NUMBER THAT MADE THE CAP LOOK NECESSARY:
    //
    //   > *"`Math.max(0, 661.67)` is 661.67 — at the 30 s trigger the scheduled radius is
    //   > still 661.67 wu on the 2800x2000 map (4.73x the N<=4 floor)"*
    //
    // That 4.73x gap WAS the bug. At the 135 s trigger the scheduled radius is now exactly
    // `minSafeRadiusFor(N)` — the ring has been sitting on its floor for 15 s — so the
    // collapse is a step from the final circle to nothing, which is what `DECISIONS §2`'s
    // "the one who has more HP wins" was always meant to be stepping from.
    //
    // Monotonicity survives: 0 is below every value the branch above can produce, so
    // `safeRadius` is still non-increasing for the life of a match — which is what
    // `audio/director.ts`'s one-shot latch and `ui/hud.ts`'s `msUntilEdge` inversion are
    // both built on.
    state.safeRadius = suddenDeathActive(state.timeRemaining)
      ? SUDDEN_DEATH_RADIUS
      : fogRadiusAt(playMs, state.arena.maxSafeRadius, minSafeRadiusFor(state.fighters.length));
  }

  // Ground-effect expiry runs unconditionally, matching the prototype (it is never
  // gated on gameState).
  expireGroundEffects(state);

  if (state.phase === 'playing') {
    /**
     * ── THE FIGHTER LOOP. IN SLOT ORDER, ALWAYS. ─────────────────────────────
     *
     * This replaces a hardcoded player-then-enemy sequence with a walk over
     * `state.fighters`, and at N=2 it produces the identical sequence of calls:
     *
     *   slot 0 (human)  applyAim -> attemptAttack -> moveFighter -> applyWorldTick
     *   slot 1 (ai)     stepAI (which faces, fires OR moves) -> applyWorldTick
     *
     * Two properties are load-bearing and neither is an implementation detail:
     *
     *   * ORDER IS SLOT ORDER, and slot order is a pure function of `createMatch`'s
     *     arguments. Who acts first inside a tick decides who fires first, and whose trail
     *     mark exists before the other walks over it. See `MatchState.fighters`.
     *   * THE BRANCH IS ON `controller`, NOT ON `role`. A seat name said three things at
     *     once (which slot, who drives it, which HP dial); only the middle one belongs in
     *     this decision, and Uri's stated direction is humans in any number of slots.
     *
     * ── ⚠️ AND THE INPUT IS PER SLOT NOW. IT USED TO SAY: ─────────────────────
     *
     *   > *"ONE `MatchInput` FOR THE WHOLE MATCH IS THE REMAINING TWO-SEAT ASSUMPTION HERE.
     *   > With one human it is unambiguous. A second human seat needs an input PER SLOT,
     *   > which is a `stepMatch` signature change and therefore reaches all 71 call sites —
     *   > it is step 1b, deliberately not this change."*
     *
     * That is this change. `perSlot` is non-null only when the caller passed an ARRAY;
     * otherwise every human seat is handed the same object, which with one human seat is
     * bit-for-bit what the loop did before. The branch is hoisted out of the loop because
     * `Array.isArray` per fighter per tick is a type check in the hot path for a question
     * that cannot change inside one call. See `state.ts:MatchInputs` for why the compat
     * shim exists at all (148 call sites; `tsc` sees 4).
     */
    const perSlot = Array.isArray(input) ? (input as readonly (MatchInput | null | undefined)[]) : null;
    for (const fighter of state.fighters) {
      let moved: boolean;
      // ── TERMINATOR 1: A DUE WIND-UP GOES OFF AT THE TOP OF ITS OWN TURN ────
      //
      // Before anything else this fighter DOES, and before either controller branch, so a
      // cast lands at exactly the point in the tick the press that bought it would have
      // landed — same slot order, same position relative to the other seats, the same
      // projectile step and fog pass afterwards. `resolveDueCast` owns the whole rule
      // (is it due, clear the record, fire it, re-read the phase); this line owns only
      // WHEN it is asked. It is called for humans and AI alike, from one site, which is
      // the same reason `attemptAttack` is shared: two sides, one resolution.
      //
      // ⚠️ It runs for a fighter of EITHER controller and is not inside the `human`
      // branch — a casting AI that never got a resolve would stand rooted forever, which
      // is exactly the shape of the recorded stun-silence bug.
      //
      // 🚨 **IT SITS BELOW `let moved`, NOT ABOVE IT, AND THAT IS NOT STYLE.**
      // `tools/tmp/conceal_lab.mjs`'s N-fighter battery instruments the turn order by
      // TEXT-PATCHING this loop, and its `FIGHTER_LOOP_ANCHOR` is the two literal lines
      // `for (const fighter of state.fighters) {` + `let moved: boolean;`. Landing
      // anything between them — including a comment — makes the patch match nothing, and
      // the recorder then reports an EMPTY visit list for every tick. Measured, not
      // predicted: this call was written above the declaration first and took
      // `conceal_lab --selftest` from 80/80 to 71/80, including its own known-bad and both
      // differ arms. `combat.ts` carries the identical warning about `target.deaths++`
      // for the identical reason. The declaration has no side effect, so below it is
      // free; above it costs a peer's instrument.
      resolveDueCast(state, fighter, events);
      if (fighter.controller === 'human') {
        // A hole in the array — a shorter list, an explicit null, a seat nobody is sitting
        // in — is NEUTRAL, never the previous slot's input. `?? NEUTRAL_INPUT` rather than a
        // length check, so `[a, , c]` and `[a, null, c]` and a 2-long array all mean the
        // same thing.
        const fi = perSlot === null ? (input as MatchInput) : (perSlot[fighter.id] ?? NEUTRAL_INPUT);
        applyAim(fighter, fi);
        if (fi.attack) attemptAttack(state, fighter, fi.selectedWeapon, events);
        moved = moveFighter(state, fighter, dt, fi);
      } else {
        moved = stepAI(state, fighter, dt, events);
      }
      applyWorldTick(state, fighter, dt, moved, events);
    }
    // The fog is applied OUT OF the fighter loop during sudden death, and only then.
    // See `applySuddenDeathFog` — the ordering inside that pass is the whole reason
    // "the one who has more HP wins" is a true sentence rather than a nearly-true one.
    // Placed here, before `stepProjectiles`, so the fog keeps its existing position in
    // the tick relative to shots already in the air.
    if (suddenDeathActive(state.timeRemaining)) applySuddenDeathFog(state, dt, events);
  }

  // Projectiles update every tick regardless of match phase — faithfully
  // reproducing the prototype, whose projectile loop is never gated by gameState
  // either (see the report: projectiles keep flying and can still land damage for
  // one extra tick after a match technically ends).
  stepProjectiles(state, dt, events);

  // Time limit. Resolved AFTER everything else in the tick, so a killing blow — or a
  // projectile that was already in the air — landing on the final tick still decides
  // the match as a knockout rather than being overridden by the clock.
  //
  // ⚠️ **AND SINCE DECISIONS §2 THIS IS UNREACHABLE IN A REAL MATCH.** Sudden death
  // abolishes safe ground at 30 s and the fog burns the biggest pool in the game down in
  // 4.8 s, so the clock cannot reach 0 with anyone alive: 10.2 s of headroom, asserted
  // from the constants in `sim.test.mjs` §30. It is NOT dead code and must not be
  // deleted — it stays the resolver of record, it is what an INSTRUMENT that pins HP (the
  // forced-immortal corpus) still reaches, and it comes straight back into reach if
  // `SUDDEN_DEATH_MS`, `FOG_DAMAGE` or the level cap moves. §30 measures the
  // unreachability on real matches AND is shown to fail on a sudden-death-disabled sim
  // (`tools/tmp/sd_lab.mjs --selftest`), because an unreachability assertion that cannot
  // fail is decoration.
  if (state.phase === 'playing' && state.timeRemaining <= 0) {
    resolveTimeout(state, events);
  }

  return events;
}

/**
 * End a match that ran out of clock.
 *
 * Until this existed, `stepMatch` decremented `timeRemaining` to 0 and then simply
 * kept going: measured on the real sim, 110 of 110 forced-immortal matchups were
 * still `phase: 'playing'`, `winner: null` after 360 s of a 180 s match. The clock
 * ended nothing. In an ordinary match it *looked* decided only because the ring had
 * closed to nothing and the fog had killed someone — which is the fairness half of
 * the same bug, since the fog kills the SMALLER HP pool first whoever owns it — measured
 * when this was written, the 100 HP player at 2.00 s against the 150 HP enemy at 3.00 s.
 * (`ENEMY_MAX_HP` is 90 as of AUTHORISED DEVIATION #9, so that ordering has inverted; the
 * floor's job is symmetric in the pools and did not change with it.) `MIN_SAFE_RADIUS`
 * removes that, and this decides what is left.
 *
 * ── 🚨 SUPERSEDED FOR THE 1v1 TIMEOUT BY DECISIONS §2 — AND STILL IMPLEMENTED ──
 *
 * Uri, 2026-08-11: *"no. after 30 seconds reduce the fog to all screen and the one who
 * has more HP wins."* That answers the question §2 asked (draw, or ties to the human?)
 * by removing it: with the ring abolished at 30 s the whistle is 10.2 s further away than
 * the fog needs to kill the largest pool in the game, so **this function no longer decides
 * a real match at all.** The rungs below stay exactly as they are, for three reasons —
 * they remain the resolver of record if the clock ever does run out; a forced-immortal
 * instrument corpus still reaches them; and the unreachability is a property of three
 * constants that can move. It is ASSERTED rather than assumed (`sim.test.mjs` §30).
 *
 * ⚠️ **AND THE TWO RESOLVERS DISAGREE ABOUT RUNG 1 ON PURPOSE.** This one ranks by HP
 * FRACTION; sudden death ranks by ABSOLUTE HP, because a flat 50 HP/s drain against
 * unequal pools is exactly "who has more HP" and that is the quantity Uri named. The
 * fraction argument below is still right about a WHISTLE — it just is not what was asked
 * for about a fog. The one case both can reach — two fighters level on everything — is
 * resolved the same way by both, to the LOWER SLOT (see `applySuddenDeathFog`'s sort).
 *
 * ── The tiebreak, and why each rung ─────────────────────────────────────────
 *
 *  1. HIGHER HP **FRACTION**. Not absolute HP: the two pools are different sizes, so
 *     "most HP left" hands whoever owns the bigger one a head start on a criterion it
 *     did nothing to earn. The fraction is what "who is winning" means when the pools
 *     differ, and it is the same rule whichever way round they are — which is why this
 *     rung needed no change when `ENEMY_MAX_HP` went 150 -> 90 and the head start
 *     changed hands (it was a 50 HP gift to the enemy; it is now a 10 HP gift to the
 *     player). A tiebreak that compared raw HP would have silently flipped sides.
 *  2. ZONE CONTROL — nearer the ring's centre wins. A real, earned signal (holding the
 *     middle is contested ground), deterministic, and it is what separates two
 *     fighters who are level on HP.
 *  3. ⚠️ **FEWEST DEATHS — `DECISIONS §49a`, ANSWERED BY URI 2026-08-11.** ⚠️ THIS RUNG
 *     USED TO BE "THE LOWER SLOT", AND THAT WORDING IS KEPT IMMEDIATELY BELOW because the
 *     rung it describes did not disappear — it MOVED DOWN to rung 4 and still decides
 *     every case this one cannot.
 *
 *     Uri's answer, verbatim: *"Fewest deaths, then lower slot"*. So the first thing that
 *     separates two fighters who are level on pool AND on ground is **how many times each
 *     has been knocked out** — an earned signal in exactly the sense rung 1 demands, and
 *     the LAST rung that is a property of the FIGHTER at all: everything below it is
 *     `createMatch`'s argument order.
 *
 *     🚨 **AND IT IS INERT TODAY, PROVABLY, AT EVERY N — MEASURE IT DO NOT ASSUME IT.**
 *     `Fighter.deaths` is incremented at the single `combat.ts:applyDamage` choke point
 *     that is also the only writer of `alive`, and that function returns early for a dead
 *     target. There is **no respawn**, so `deaths` is 0 or 1 and `deaths === 1` iff
 *     `hp === 0`. Rung 1 already ranks every `hp === 0` fighter last (fraction 0 against
 *     any survivor's > 0), so two fighters that reach rung 3 are either both alive
 *     (0 == 0) or both dead (1 == 1) and this rung ties. The one exception is the
 *     degenerate `maxHp <= 0` seat, where the `f.maxHp > 0 ?` guard hands a LIVING fighter
 *     fraction 0 and it can meet a corpse here — and there the rung fires and is right.
 *     => **This changes no reachable outcome at N=2** (a knockout ends a duel before the
 *     clock can, so a two-seat timeout has two living fighters and two zeroes), which is
 *     what keeps the `--bitid` acceptance intact. It is a rung that becomes LOAD-BEARING
 *     the day respawns exist, and a counter is the only shape that survives that day; a
 *     `f.alive ? 0 : 1` derivation would have been a restatement of rung 1 forever.
 *  4. ⚠️ THE LOWER SLOT. **THIS RUNG CHANGED MEANING WITHOUT CHANGING VALUE** (and has
 *     since changed NUMBER without changing either — it was rung 3 until §49a landed).
 *     It used to read "THE HUMAN" — two fighters identical on both measures are
 *     indistinguishable by every quantity the sim has, so the tie went to the player,
 *     deliberately the opposite of the behaviour it replaced (where the tie went to the
 *     enemy by arithmetic). The human is slot 0, so at N=2 "the human" and "the lower
 *     slot" are the same fighter and the outcome is bit-identical.
 *
 *     At N>2 THEY ARE NOT THE SAME RULE. "The lower slot" hands a standing, permanent
 *     advantage to whoever `createMatch` happened to list first — which is exactly the
 *     kind of unearned edge rung 1 exists to refuse: *"most HP left" hands whoever owns the
 *     bigger pool a head start on a criterion it did nothing to earn.*
 *
 *     ⚠️ **IT IS STILL THE LAST RUNG AND IT IS STILL THAT UNEARNED EDGE.** §49a did not
 *     remove slot advantage; it put one earned quantity in front of it. The paragraph this
 *     replaces said the rung *"needs a decision before the cap is raised"* and that
 *     *"ANY replacement changes the N=2 answer or invents a tiebreak the sim has no
 *     quantity for"* — the second half turned out to be the interesting one, and the answer
 *     was to ADD the quantity (`Fighter.deaths`) rather than to replace the rung. Kept as
 *     the floor because the comparator must be TOTAL: `id` is unique, so this line is what
 *     makes the sort independent of `Array.prototype.sort`'s stability.
 *
 * ── AND IT IS A RANKED SORT NOW, NOT A TWO-WAY COMPARISON ───────────────────
 *
 * The comparator is TOTAL — it ends on `id`, which is unique — so the result does not
 * depend on `Array.prototype.sort` being stable, and it sorts a copy of the INDEX LIST
 * rather than `state.fighters` itself. Reordering the fighter array would reorder the whole
 * game: `MatchState.fighters` is the iteration order for the fighter loop, and a match that
 * quietly permuted its own turn order on the last tick would be a desync that only ever
 * appeared in the final frame.
 *
 * Note there is no `death` event and both fighters stay `alive` — a timeout is not a
 * knockout, and consumers that read `state.winner` (HUD game-over card, trophy
 * recording, audio director) all key off `match-ended`, which does fire. It follows that
 * this function never increments `deaths` either: it READS the rung it added and writes
 * nothing, so losing on the whistle is not a knockout for the purposes of the next match
 * any more than it is for this one.
 */
function resolveTimeout(state: MatchState, events: GameEvent[]): void {
  const { arena } = state;
  const hpFraction = (f: Fighter): number => (f.maxHp > 0 ? f.hp / f.maxHp : 0);
  const toCentre = (f: Fighter): number => Math.hypot(f.x - arena.center.x, f.y - arena.center.y);

  const ranked = state.fighters.slice().sort((a, b) => {
    const fa = hpFraction(a);
    const fb = hpFraction(b);
    if (fa !== fb) return fb - fa;              // rung 1: higher HP FRACTION
    const da = toCentre(a);
    const db = toCentre(b);
    if (da !== db) return da - db;              // rung 2: nearer the ring's centre
    if (a.deaths !== b.deaths) return a.deaths - b.deaths; // rung 3: FEWEST DEATHS (§49a)
    return a.id - b.id;                         // rung 4: the lower slot — see above
  });

  const winner = ranked[0];
  state.phase = 'ended';
  state.winner = winner.role;
  state.winnerId = winner.id;
  events.push({ type: 'match-ended', winner: winner.role, winnerId: winner.id });
}

// ─────────────────────────────────────────────────────────────────────────────
// Countdown
// ─────────────────────────────────────────────────────────────────────────────

function stepCountdown(state: MatchState, dt: number, events: GameEvent[]): void {
  if (state.phase !== 'countdown') return;

  state.countdownTick += dt;
  if (state.countdownTick >= 1000) {
    state.countdownTick -= 1000;
    state.countdownValue -= 1;
    if (state.countdownValue > 0) {
      events.push({ type: 'countdown-tick', value: state.countdownValue });
    } else {
      state.startFlashTimer = COUNTDOWN_START_FLASH_MS;
      events.push({ type: 'countdown-tick', value: 0 });
    }
  }

  if (state.countdownValue <= 0) {
    state.startFlashTimer -= dt;
    if (state.startFlashTimer <= 0) {
      state.phase = 'playing';
      state.timeRemaining = MATCH_DURATION_MS;
      state.safeRadius = state.arena.maxSafeRadius;
      events.push({ type: 'match-started' });
    }
  }
}

// ─────────────────────────────────────────────────────────────────────────────
// Ground effects
// ─────────────────────────────────────────────────────────────────────────────

function expireGroundEffects(state: MatchState): void {
  for (let i = state.splats.length - 1; i >= 0; i--) {
    if (state.elapsed >= state.splats[i].expiresAt) state.splats.splice(i, 1);
  }
  for (let i = state.trailMarks.length - 1; i >= 0; i--) {
    if (state.elapsed >= state.trailMarks[i].expiresAt) state.trailMarks.splice(i, 1);
  }
}

/** Strongest (smallest) terrain slow multiplier affecting `fighter` right now, or 1 if none applies. */
function terrainSlowFactor(state: MatchState, fighter: Fighter): number {
  let factor = 1;
  for (const hz of state.arena.hazards) {
    if (hz.kind !== 'slow') continue;
    if (Math.hypot(fighter.x - hz.x, fighter.y - hz.y) < hz.radius) {
      factor = Math.min(factor, hz.slowFactor ?? PUDDLE_SLOW_FACTOR);
    }
  }
  for (const s of state.splats) {
    if (Math.hypot(fighter.x - s.x, fighter.y - s.y) < SPLAT_RADIUS) {
      factor = Math.min(factor, PUDDLE_SLOW_FACTOR);
    }
  }
  return factor;
}

// ─────────────────────────────────────────────────────────────────────────────
// Player facing + movement
// ─────────────────────────────────────────────────────────────────────────────

/** Point `fighter`'s aim at this tick's input vector. Takes the FIGHTER, not the state:
 *  a second human seat is a second caller, not a second branch. */
function applyAim(fighter: Fighter, input: MatchInput): void {
  // ── A WIND-UP FREEZES THE AIM, AND THAT IS THE PROPERTY THE FEATURE RESTS ON ──
  //
  // `ActiveCast` stores no `facingX/Y` precisely because this line makes one unnecessary:
  // `facing` has exactly two writers in the sim — this function and `ai.ts:stepAI`'s
  // facing block — and both refuse while a cast is running, so the bearing at the press
  // survives to the resolve BY CONSTRUCTION. A telegraph drawn where the caster was
  // pointing when the button went down therefore cannot lie about where the effect lands,
  // which is what makes the wind-up dodgeable rather than merely slow.
  //
  // ⚠️ It is `isCasting`, NOT `movementLocked`. A STUNNED fighter still aims and still
  // fires — `rules.ts:STUN_DURATION_MS` says *"stunned = movement locked to 0"* and
  // nothing more, and `ai.ts`'s header records what it cost when one file read that flag
  // as "this fighter's turn does not happen". The cast lock is wider than the stun lock,
  // so the two predicates are deliberately separate and this site takes the wider one.
  if (isCasting(fighter)) return;
  if (!input.aim) return;
  const mag = Math.hypot(input.aim.x, input.aim.y);
  if (mag > 1e-6) {
    fighter.facing = { x: input.aim.x / mag, y: input.aim.y / mag };
  }
}

/**
 * Move one HUMAN-CONTROLLED fighter from this tick's input.
 *
 * Was `movePlayer`, and the rename is the point: nothing here is about being *the* player.
 * It reads `PLAYER_SPEED` because that is the roster-wide speed CAP (`rules.ts`
 * `SPEED_TOP_STAT`), scaled per character by `speedFor` — the same constant the AI's own
 * `AI_CHASE_SPEED` sits below, not a seat-specific dial.
 *
 * Returns whether movement was *attempted* this tick (input non-zero), for trail-drop
 * purposes.
 */
function moveFighter(state: MatchState, fighter: Fighter, dt: number, input: MatchInput): boolean {
  const now = state.elapsed;

  // onOwnTrail is evaluated against the marks that exist BEFORE this tick's
  // movement/drop — matching the prototype, where `onOwnTrail` is computed once at
  // the top of the frame, before any new mark from this same frame is pushed.
  let speedMult = terrainSlowFactor(state, fighter);
  if (isOnOwnTrail(state, fighter)) speedMult *= TRAIL.speedBoost;
  if (now < fighter.status.slowedUntil) speedMult *= SLOW_MOVE_MULTIPLIER;
  // ⚠️ **WAS `now < fighter.status.stunnedUntil`, AND THAT WORDING IS KEPT HERE BECAUSE
  // THE RULE IT STATED IS NOT REVERSED — IT IS NOW STATED SOMEWHERE ELSE.** The identical
  // comparison also lived in `ai.ts:stepAI`, so one constant had two implementations in
  // the two files whose disagreement is this project's most expensive recorded defect
  // class. Adding the cast root to one of them and not the other would have been the sixth
  // instance. Both now call `state.ts:movementLocked`, and `sim.test.mjs` §33(e)
  // source-scans `src/game/*.ts` to assert the comparison survives in exactly one file.
  const frozen = movementLocked(fighter, now);

  // `speedFor` scales `PLAYER_SPEED` by this character's own `stats.speed` — and it can
  // only scale DOWN (rules.ts `SPEED_TOP_STAT` is a cap, not a centre), so
  // `render/camera.ts`'s "nothing in rules.ts moves faster than PLAYER_SPEED *
  // TRAIL.speedBoost" — the claim its whole fair-play radius rests on — stays true.
  const speed = frozen ? 0 : speedFor(fighter.characterId, PLAYER_SPEED) * dt * speedMult;
  // Deliberately NOT normalized as a vector — each axis scales independently, so
  // diagonal movement is faster than cardinal movement, exactly like the
  // prototype's raw WASD handling.
  const mdx = input.move.x * speed;
  const mdy = input.move.y * speed;

  tryMove(fighter, mdx, mdy, state.arena);

  return mdx !== 0 || mdy !== 0;
}

// ─────────────────────────────────────────────────────────────────────────────
// Per-fighter world tick: Sticky Trail, central hazard, regen, fog.
// ─────────────────────────────────────────────────────────────────────────────

function applyWorldTick(state: MatchState, fighter: Fighter, dt: number, attemptedMove: boolean, events: GameEvent[]): void {
  if (!fighter.alive) return;

  // Publish this tick's terrain slow strength for the renderer (see the field doc on
  // `Fighter.terrainSlowFactor`). Purely an observation — same `terrainSlowFactor()`
  // read `moveFighter` already uses to scale a human fighter's own speed; storing its result
  // doesn't change what it returns or who calls it for movement.
  fighter.terrainSlowFactor = terrainSlowFactor(state, fighter);
  // Same idiom, same contract: an OBSERVATION for the HUD and the renderer, published
  // from the one predicate the gameplay readers call. See `Fighter.concealed` for why
  // nothing in the sim reads this field back.
  //
  // ⚠️ `isHidden`, NOT `isConcealed`. Since DECISIONS §29c there are two ways to be inside
  // a box and hidden by nothing — the box has been destroyed, or you have just attacked —
  // and a published observation that ignored either would be a second, quieter statement
  // of the rule for the renderer to disagree with. `state` and `fighter` supply the two
  // per-match facts geometry cannot; see `movement.ts:ConcealMatch`.
  fighter.concealed = isHidden(fighter.x, fighter.y, state.arena, state, fighter);

  const def = CHARACTERS[fighter.characterId];

  // Sticky Trail: drop a mark while moving.
  if (def.hasTrail && attemptedMove) {
    fighter.trailDropTimer += dt;
    if (fighter.trailDropTimer >= TRAIL.dropIntervalMs) {
      fighter.trailDropTimer = 0;
      const mark: TrailMark = {
        id: state.nextId++,
        ownerId: fighter.id,
        ownerRole: fighter.role,
        x: fighter.x,
        y: fighter.y,
        expiresAt: state.elapsed + TRAIL.durationMs,
        damagedMask: 0,
        damaged: false,
      };
      state.trailMarks.push(mark);
      events.push({ type: 'trail-mark-created', ownerRole: fighter.role, ownerId: fighter.id, x: fighter.x, y: fighter.y });
    }
  } else {
    fighter.trailDropTimer = 0;
  }

  // Sticky Trail: opponent standing on one of THIS fighter's marks takes a
  // one-time hit. Runs after this fighter's own drop above, so a mark dropped this
  // very tick can immediately damage an opponent already standing on it.
  //
  // ── The per-tick cap, and why marks are consumed either way ────────────────
  // This loop used to apply damage once PER MARK, for every overlapping mark, in the
  // same tick, with no cap. `TRAIL.radius` (22) is roughly double the ~11 wu a chasing
  // AI covers between drops and up to 29 marks live at once, so a Donut that circles
  // or gets held against cover stacks its entire trail onto one tile: measured, 29
  // marks on one spot cost 87 HP in a single 16.67 ms tick across 29 simultaneous hit
  // events. Undodgeable by construction — there is no reaction inside one frame.
  //
  // At most `TRAIL.maxHitsPerTick` marks may now damage a given victim per tick, so
  // the worst tick the trail can produce is exactly `TRAIL.damage`. Every other mark
  // the victim is standing in is still marked spent FOR THAT VICTIM — you tread the
  // filling out of all of them, only one of them bites. That is what stops the cap from
  // turning a dense pile into a slow drip that costs the same 87 HP over the next 29
  // ticks; the stack is spent, not queued.
  //
  // ── PER-VICTIM, AND THE CAP IS PER-VICTIM TOO ──────────────────────────────
  //
  // The victim loop and `damagedMask` are one change: see `TrailMark.damagedMask` for why
  // a boolean would have silently legislated "the first victim in slot order consumes the
  // mark and everyone else walks through free". `hitsThisTick` is declared INSIDE the
  // victim loop for the same reason — a shared counter would make the trail's damage to
  // one fighter depend on how many other fighters happened to be standing in it, and on
  // the order they were walked in. Both are no-ops at N=2 and both are the rule at N>2.
  for (const victim of state.fighters) {
    if (victim === fighter || !victim.alive) continue;
    const vbit = fighterBit(victim.id);
    let hitsThisTick = 0;
    for (const mark of state.trailMarks) {
      if (mark.ownerId !== fighter.id || (mark.damagedMask & vbit) !== 0) continue;
      if (Math.hypot(victim.x - mark.x, victim.y - mark.y) >= TRAIL.radius) continue;
      mark.damagedMask |= vbit;
      mark.damaged = true; // legacy mirror; see TrailMark.damaged
      if (hitsThisTick >= TRAIL.maxHitsPerTick) continue;
      hitsThisTick++;
      applyDamage(state, victim, TRAIL.damage, null, { kind: 'trail', ownerId: fighter.id, ownerRole: fighter.role }, events);
      if (!victim.alive) break;
    }
  }

  // Central damage hazard(s) — any arena hazard of kind 'damage'.
  state.arena.hazards.forEach((hazard, idx) => {
    if (hazard.kind !== 'damage') return;
    const dist = Math.hypot(fighter.x - hazard.x, fighter.y - hazard.y);
    if (dist < hazard.radius) {
      const t = (fighter.hazardTimers[idx] ?? 0) + dt;
      if (t >= (hazard.tickMs ?? Infinity)) {
        fighter.hazardTimers[idx] = 0;
        applyDamage(state, fighter, hazard.damage ?? 0, null, { kind: 'hazard' }, events);
      } else {
        fighter.hazardTimers[idx] = t;
      }
    } else {
      fighter.hazardTimers[idx] = 0;
    }
  });

  // Out-of-combat regen.
  if (state.elapsed - fighter.lastDamagedAt > REGEN_DELAY_MS && fighter.hp < fighter.maxHp && fighter.hp > 0) {
    fighter.regenTimer += dt;
    if (fighter.regenTimer >= REGEN_TICK_MS) {
      fighter.regenTimer = 0;
      const before = fighter.hp;
      fighter.hp = Math.min(fighter.maxHp, fighter.hp + REGEN_AMOUNT);
      if (fighter.hp > before) {
        events.push({ type: 'heal', fighterRole: fighter.role, fighterId: fighter.id, amount: fighter.hp - before });
      }
    }
  } else {
    fighter.regenTimer = 0;
  }

  // Closing fog.
  //
  // ⚠️ NOT DURING SUDDEN DEATH. `stepMatch` runs `applySuddenDeathFog` after the whole
  // fighter loop instead, and leaving this branch live as well would burn everyone twice
  // per tick. The guard is the predicate rather than `safeRadius === 0` so that the two
  // sites cannot disagree about what "sudden death" means.
  if (suddenDeathActive(state.timeRemaining)) return;
  const distFromCenter = Math.hypot(fighter.x - state.arena.center.x, fighter.y - state.arena.center.y);
  if (distFromCenter > state.safeRadius && fighter.hp > 0) {
    fighter.fogTimer += dt;
    if (fighter.fogTimer >= FOG_TICK_MS) {
      fighter.fogTimer = 0;
      applyDamage(state, fighter, FOG_DAMAGE, null, { kind: 'fog' }, events);
    }
  } else {
    fighter.fogTimer = 0;
  }
}

/**
 * SUDDEN DEATH's fog — DECISIONS §2, and the half of it that is not the radius.
 *
 * Uri's rule has two clauses and the second one is a CLAIM ABOUT THE OUTCOME: *"the one
 * who has more HP wins."* Collapsing the ring is necessary for it and **it is not
 * sufficient**, for two measured reasons, both of which this function exists to remove.
 *
 * ── 1. THE FOG IS QUANTISED, SO SLOT ORDER WAS DECIDING IT ──────────────────
 *
 * The fog deals `FOG_DAMAGE` (15) every `FOG_TICK_MS`, so a fighter dies after
 * `ceil(hp / 15)` ticks. Two fighters land in the SAME bucket whenever their HP differs
 * by less than 15 — 100 against 91 is one bucket — and in the ordinary per-fighter path
 * the tick that kills both walks `state.fighters` in SLOT order. `combat.ts:applyDamage`
 * ends the match the instant `lastFighterStanding` returns non-null, so the fighter
 * processed FIRST dies first and the other is declared the winner. **A 100 HP fighter in
 * slot 0 therefore lost to a 91 HP fighter in slot 1** — the unearned slot advantage
 * `resolveTimeout`'s rung 1 exists to refuse, arriving through the back door.
 *
 * Fixed by ordering the pass ASCENDING BY HP, so the weakest is always eliminated first
 * and the survivor is always the strongest. The tie-break inside equal HP is DESCENDING
 * id, which makes the LOWEST slot the last one processed and therefore the winner — the
 * same direction as `resolveTimeout`'s rung 4 (*"the lower slot"*, `DECISIONS §49a`), so
 * the two resolvers agree about the one case neither can separate on merit.
 *
 * ── 2. THE FOG CLOCK WAS PER FIGHTER, SO IT WAS NOT A COMMON DRAIN ──────────
 *
 * `Fighter.fogTimer` accumulates only while that fighter is outside the ring, so at the
 * collapse a fighter already in the fog carries an advanced timer and burns EARLIER than
 * a fighter who was safe — with more HP and still dying first. So the cadence here is
 * derived from the match clock instead, which is common to everyone by construction:
 * the tick fires on the boundary crossing of
 *
 *     ticksSinceCollapse = floor((SUDDEN_DEATH_REMAINING_MS - timeRemaining) / FOG_TICK_MS)
 *
 * `fogTimer` is neither read nor written here — nothing else reads it, and rewriting it
 * would be a second statement of the same schedule.
 *
 * ── WHAT THIS DOES *NOT* PROMISE ────────────────────────────────────────────
 *
 * The guarantee is stated exactly, because an over-stated one is worse than none:
 * **absent damage from any source other than the fog, the fighter with the most HP when
 * sudden death begins is the last one standing.** Weapons, the trail and the pot all keep
 * working during sudden death — Uri asked for a fog, not for a ceasefire — so a fighter
 * who is shot, or who stands in the pot, can still lose from ahead. That is play
 * deciding the match, which is the outcome every rung of `resolveTimeout` also prefers.
 */
function applySuddenDeathFog(state: MatchState, dt: number, events: GameEvent[]): void {
  // The boundary crossing, on the match clock. `timeRemaining` was decremented by exactly
  // `dt` at the top of this tick and is nowhere near its `Math.max(0, …)` clamp (sudden
  // death starts at 15 000 ms), so `+ dt` recovers the previous reading exactly.
  const since = SUDDEN_DEATH_REMAINING_MS - state.timeRemaining;
  if (Math.floor(since / FOG_TICK_MS) === Math.floor((since - dt) / FOG_TICK_MS)) return;

  // A sorted COPY of the index list, never `state.fighters` itself: that array is the
  // iteration order for the whole game (see the fighter loop), and a match that permuted
  // its own turn order on the tick the fog closed in would be a desync visible only in
  // the final frame. Same reasoning, and same shape, as `resolveTimeout`.
  const order = state.fighters.slice().sort((a, b) => (a.hp !== b.hp ? a.hp - b.hp : b.id - a.id));
  for (const fighter of order) {
    // 🚨 STOP THE MOMENT THE MATCH IS DECIDED — MEASURED, NOT DEFENSIVE. With every fighter
    // inside one fog tick of each other they all die on the SAME tick, so without this the
    // pass walks past `combat.ts`'s `lastFighterStanding` and kills the fighter it has just
    // declared the winner: 6 deaths out of 6 seats, `state.winner` naming a corpse for the
    // victory screen to draw. The ordinary fighter loop deliberately does NOT stop on a
    // phase change (the prototype's projectile loop keeps running for one more tick and
    // `stepMatch` reproduces that), but a fog that keeps burning after the whistle is a
    // different thing: it damages a fighter for whom the match is over.
    if (state.phase !== 'playing') break;
    if (!fighter.alive || fighter.hp <= 0) continue;
    // ⚠️ THE SAME PREDICATE THE ORDINARY FOG USES — `dist > safeRadius` — AND NOT AN
    // UNCONDITIONAL BURN. This pass differs from the per-fighter path in its CLOCK and
    // its ORDER, in nothing else, so there is still exactly one statement of "who is in
    // the fog" and every consumer that reads `state.safeRadius` (the HUD's `outside`, the
    // 3D boundary, every instrument) stays in agreement with the damage.
    //
    // At `SUDDEN_DEATH_RADIUS` the one point this exempts is the arena centre itself, to
    // the last bit. On the shipped kitchen it is unreachable — `arena/hazards.ts`
    // registers the pot as a solid `POT.bodyRadius * 2` box, so `movement.ts:tryMove`
    // holds every fighter's centre at least `POT.bodyRadius + PLAYER_SIZE / 2` = 73 wu
    // out — and `sim.test.mjs` §30 asserts that on a real match rather than assuming it.
    // A synthetic arena with no hazard CAN park a fighter there, which is why several of
    // §10's timeout fixtures still work: they sit on the centre on purpose.
    const dist = Math.hypot(fighter.x - state.arena.center.x, fighter.y - state.arena.center.y);
    if (dist <= state.safeRadius) continue;
    applyDamage(state, fighter, FOG_DAMAGE, null, { kind: 'fog' }, events);
  }
}

// ─────────────────────────────────────────────────────────────────────────────
// Projectiles
// ─────────────────────────────────────────────────────────────────────────────

function removeProjectile(state: MatchState, index: number, reason: 'hit-target' | 'hit-cover' | 'expired', events: GameEvent[]): void {
  const p = state.projectiles[index];
  events.push({ type: 'projectile-destroyed', id: p.id, reason, x: p.x, y: p.y });
  state.projectiles.splice(index, 1);
}

function spawnSplat(state: MatchState, x: number, y: number, events: GameEvent[]): void {
  const splat: Splat = { id: state.nextId++, x, y, expiresAt: state.elapsed + SPLAT_DURATION_MS };
  state.splats.push(splat);
  events.push({ type: 'splat-created', x, y });
}

function stepProjectiles(state: MatchState, dt: number, events: GameEvent[]): void {
  for (let i = state.projectiles.length - 1; i >= 0; i--) {
    const p = state.projectiles[i];
    const w = p.weapon;
    // ⚠️ RESOLVED BY SLOT, AND THE HIT RADIUS COMES OFF THE TARGET. This used to be
    // `state[p.targetRole]` plus `p.targetRole === 'player' ? HIT_RADIUS_VS_PLAYER :
    // HIT_RADIUS_VS_ENEMY` — a property of the target expressed as a two-way branch on a
    // seat name, correct at N=2 and meaningless at N=3. See `Fighter.hitRadius`.
    const target = state.fighters[p.targetId];
    const hitRadius = target.hitRadius;

    // Egg's Hatch!: once arrived, strikes repeatedly at peckInterval instead of
    // continuing to travel.
    if (w.peckHits && p.arrived) {
      if (target.hp <= 0) {
        removeProjectile(state, i, 'expired', events);
        continue;
      }
      p.peckTimer = (p.peckTimer ?? 0) + dt;
      if (p.peckTimer >= (w.peckInterval ?? 500)) {
        p.peckTimer = 0;
        applyDamage(state, target, p.damage, w.effect, { kind: 'weapon', weaponKey: w.key, weaponName: w.name, attackerId: p.ownerId }, events);
        p.hitsSoFar = (p.hitsSoFar ?? 1) + 1;
        if (p.hitsSoFar >= w.peckHits) {
          removeProjectile(state, i, 'expired', events);
        }
      }
      continue;
    }

    // ── THE FOURTH READER OF A TARGET'S TRUE POSITION ─────────────────────────
    //
    // `ai.ts` has three (separation, facing, nav target) and they are named there. This is
    // the one OUTSIDE that file, and it is the one an implementation of concealment would
    // most naturally miss: a homing volley re-aims every tick, so without this condition
    // Burrito's Topping Swarm and Sushi's Big Catch would curve into a bush after a target
    // their owner cannot see — concealment visibly working for the melee half of the roster
    // and visibly not for the homing half.
    //
    // The observer is the PROJECTILE, not its owner. A projectile is not a mind and has no
    // memory: it simply flies its last heading while the target is hidden from where the
    // projectile now is, and re-acquires if it gets inside `CONCEAL_REVEAL_RADIUS`. That is
    // deterministic, it is symmetric between the two sides (which is the property the five
    // recorded `ai.ts` defects all lacked), and it is the deterministic form of "shooting
    // at a concealed target is less accurate" — with no roll anywhere near it.
    //
    // `state, target` carry the two §29c facts: a plate the target shattered by attacking
    // from under it stops hiding it from an incoming volley, and so does the reveal window
    // its own shot bought. That is the honest reading of Uri's answer — the volley you fired
    // BACK at a shooter who just gave itself away should track it, and it does.
    if (w.homing && target.hp > 0 && isVisibleFrom(p.x, p.y, target.x, target.y, state.arena, state, target)) {
      const hx = target.x - p.x;
      const hy = target.y - p.y;
      const hmag = Math.hypot(hx, hy) || 1;
      const targetDirX = hx / hmag;
      const targetDirY = hy / hmag;
      const curMag = Math.hypot(p.vx, p.vy) || 1;
      const curDirX = p.vx / curMag;
      const curDirY = p.vy / curMag;
      const turnAmount = Math.min(1, HOMING_TURN_RATE * dt);
      const newDirX = curDirX + (targetDirX - curDirX) * turnAmount;
      const newDirY = curDirY + (targetDirY - curDirY) * turnAmount;
      const newMag = Math.hypot(newDirX, newDirY) || 1;
      const speed = w.speed ?? 0;
      p.vx = (newDirX / newMag) * speed;
      p.vy = (newDirY / newMag) * speed;
    }

    const moveX = (p.vx * dt) / 1000;
    const moveY = (p.vy * dt) / 1000;
    const newX = p.x + moveX;
    const newY = p.y + moveY;
    const hitWall = state.arena.cover.some((o) =>
      boxesOverlap(newX, newY, PROJECTILE_COVER_SIZE, PROJECTILE_COVER_SIZE, o.x, o.y, o.w, o.h),
    );
    // ── THE BUDGET IS DENOMINATED IN THE TARGET'S FRAME ──────────────────────
    //
    // `rules.ts` AUTHORISED DEVIATION #12 carries the derivation and the price; this is
    // the whole of the implementation. `traveled` is charged with the ground this step
    // GAINED on the target, not with the ground it covered:
    //
    //     gained = |move| − (targetMove · moveHat)      refunded only when positive
    //
    // so `range` means a SEPARATION here exactly as it does at `ai.ts:pickWeapon`'s press
    // gate, and the two can no longer diverge. Three properties, in the order they matter:
    //
    //   * A STATIONARY TARGET IS BIT-IDENTICAL to the shipped rule. `target.x - p.tx` is
    //     exactly 0, so `refund` is exactly 0 and this reduces to `+= Math.hypot(...)` —
    //     which is why §29's chord rows, `press_value.mjs`'s 183 cells and every reach
    //     ever published against a still target reproduce to the digit. The refund is
    //     subtracted from the TARGET'S displacement rather than recomputed from absolute
    //     positions for exactly this reason: `(a + m − t) − (a − t)` is not `m` in floats.
    //   * A TARGET RUNNING INTO THE SHOT IS NOT CHARGED TO IT. `refund > 0` clamps that
    //     side: a closing target would otherwise EXTEND the shot's reach past its gate.
    //   * A SHOT THAT CANNOT GAIN GROUND SPENDS NOTHING, so the budget alone would never
    //     retire it. `projectileMaxAgeMs` is the termination guarantee, and it is derived
    //     rather than picked — see its own doc comment for why it is provably unreachable
    //     for every fighter running under its own legs.
    const step = Math.hypot(moveX, moveY);
    let gained = step;
    if (step > 0 && p.tx !== undefined && p.ty !== undefined) {
      const refund = ((target.x - p.tx) * moveX + (target.y - p.ty) * moveY) / step;
      if (refund > 0) gained = step - refund;
    }
    p.tx = target.x;
    p.ty = target.y;
    p.age = (p.age ?? 0) + dt;
    p.traveled += gained > 0 ? gained : 0;
    p.x = newX;
    p.y = newY;

    if (hitWall || p.traveled >= (w.range ?? Infinity) || p.age >= projectileMaxAgeMs(w)) {
      if (w.splatter) spawnSplat(state, p.x, p.y, events);
      removeProjectile(state, i, hitWall ? 'hit-cover' : 'expired', events);
      continue;
    }

    if (target.hp > 0 && Math.hypot(p.x - target.x, p.y - target.y) < hitRadius) {
      applyDamage(state, target, p.damage, w.effect, { kind: 'weapon', weaponKey: w.key, weaponName: w.name, attackerId: p.ownerId }, events);
      if (w.splatter) spawnSplat(state, p.x, p.y, events);
      if (w.peckHits) {
        p.arrived = true;
        p.peckTimer = 0;
        p.hitsSoFar = 1;
        continue;
      }
      removeProjectile(state, i, 'hit-target', events);
      continue;
    }
  }
}
