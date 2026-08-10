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
  LEVEL_MIN,
  MATCH_DURATION_MS,
  MIN_SAFE_RADIUS,
  maxHpFor,
  PLAYER_MAX_HP,
  PLAYER_SIZE,
  PLAYER_SPEED,
  PUDDLE_SLOW_FACTOR,
  REGEN_AMOUNT,
  REGEN_DELAY_MS,
  REGEN_TICK_MS,
  SLOW_MOVE_MULTIPLIER,
  speedFor,
  SPLAT_DURATION_MS,
  SPLAT_RADIUS,
  TRAIL,
  type CharacterId,
} from './rules.ts';
import type { ArenaDefinition } from '../arena/types.ts';
import type { Fighter, GameEvent, MatchInput, MatchState, Sighting, Splat, TrailMark } from './state.ts';
import { createFighter, fighterBit, sightingIndex } from './state.ts';
import { applyDamage, attemptAttack, isOnOwnTrail } from './combat.ts';
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

export function createMatch(
  arena: ArenaDefinition,
  playerCharacterId: CharacterId,
  enemyCharacterId: CharacterId,
  levels: MatchLevels = {},
): MatchState {
  const playerLevel = clampLevel(levels.player ?? LEVEL_MIN);
  const enemyLevel = clampLevel(levels.enemy ?? LEVEL_MIN);

  // ── PER-CHARACTER POOLS, ON TOP OF THE ROLE DIAL (rules.ts DEVIATION #10) ──
  // `maxHpFor` multiplies the ROLE base by the character's own `stats.health`, so
  // `ENEMY_MAX_HP` keeps scaling the whole roster exactly as it did — a per-character
  // pool that replaced the role constant would have taken Uri's difficulty dial away.
  // The level term rides ALONGSIDE the character term inside `maxHpFor`, never instead
  // of it, so `maxHpFor` stays linear in its `roleBaseHp` at every level — which is what
  // `sim.test.mjs` §22(b) asserts and what keeps `ENEMY_MAX_HP` a working dial.
  //
  // ⚠️ THE SIGNATURE IS STILL `(arena, playerId, enemyId, levels)` AND THAT IS DELIBERATE.
  // 68 of the 71 `createMatch` call sites in this repo are in `.mjs` files that `tsc`
  // cannot see. Widening this to take a fighter LIST is the step-1b change; doing it here
  // would have broken four fifths of the instruments silently, at runtime, with no compile
  // error anywhere — which is exactly the trap that decided this design.
  const fighters: Fighter[] = [
    createFighter({
      id: 0,
      controller: 'human',
      characterId: playerCharacterId,
      spawn: arena.playerSpawn,
      maxHp: maxHpFor(playerCharacterId, PLAYER_MAX_HP, playerLevel),
      size: PLAYER_SIZE,
      hitRadius: HIT_RADIUS_VS_PLAYER,
      facing: { x: 1, y: 0 },
      level: playerLevel,
    }),
    createFighter({
      id: 1,
      controller: 'ai',
      characterId: enemyCharacterId,
      spawn: arena.enemySpawn,
      maxHp: maxHpFor(enemyCharacterId, ENEMY_MAX_HP, enemyLevel),
      size: ENEMY_SIZE,
      hitRadius: HIT_RADIUS_VS_ENEMY,
      facing: { x: -1, y: 0 },
      level: enemyLevel,
    }),
  ];

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
    // The legacy name for the one cell anything reads today: observer 1 (the AI) on
    // target 0 (the human). The SAME object, not a copy.
    aiSighting: sightings[sightingIndex(1, 0, n)],
    // Every plate starts the match intact — a restart is a fresh set of cover, which is why
    // this is per-match state and not a mutation of the shared arena. See the field doc.
    brokenConcealment: [],
    nextId: 1,
  };
}

export function stepMatch(state: MatchState, dt: number, input: MatchInput): GameEvent[] {
  const events: GameEvent[] = [];
  state.elapsed += dt;

  stepCountdown(state, dt, events);

  if (state.phase === 'playing') {
    state.timeRemaining = Math.max(0, state.timeRemaining - dt);
    const progress = 1 - state.timeRemaining / MATCH_DURATION_MS;
    // The floor is what makes the timeout rule below reachable at all: without it the
    // ring reaches 0, nowhere costs 0 HP/s for the last seconds, and the smaller HP
    // pool (always the player's) dies before the whistle. See `MIN_SAFE_RADIUS`.
    state.safeRadius = Math.max(MIN_SAFE_RADIUS, state.arena.maxSafeRadius * (1 - progress));
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
     * ⚠️ ONE `MatchInput` FOR THE WHOLE MATCH IS THE REMAINING TWO-SEAT ASSUMPTION HERE.
     * With one human it is unambiguous. A second human seat needs an input PER SLOT, which
     * is a `stepMatch` signature change and therefore reaches all 71 call sites — it is
     * step 1b, deliberately not this change. Nothing else in this loop assumes N=2.
     */
    for (const fighter of state.fighters) {
      let moved: boolean;
      if (fighter.controller === 'human') {
        applyAim(fighter, input);
        if (input.attack) attemptAttack(state, fighter, input.selectedWeapon, events);
        moved = moveFighter(state, fighter, dt, input);
      } else {
        moved = stepAI(state, fighter, dt, events);
      }
      applyWorldTick(state, fighter, dt, moved, events);
    }
  }

  // Projectiles update every tick regardless of match phase — faithfully
  // reproducing the prototype, whose projectile loop is never gated by gameState
  // either (see the report: projectiles keep flying and can still land damage for
  // one extra tick after a match technically ends).
  stepProjectiles(state, dt, events);

  // Time limit. Resolved AFTER everything else in the tick, so a killing blow — or a
  // projectile that was already in the air — landing on the final tick still decides
  // the match as a knockout rather than being overridden by the clock.
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
 *  3. ⚠️ THE LOWER SLOT. **THIS RUNG CHANGED MEANING WITHOUT CHANGING VALUE.**
 *     It used to read "THE HUMAN" — two fighters identical on both measures are
 *     indistinguishable by every quantity the sim has, so the tie went to the player,
 *     deliberately the opposite of the behaviour it replaced (where the tie went to the
 *     enemy by arithmetic). The human is slot 0, so at N=2 "the human" and "the lower
 *     slot" are the same fighter and the outcome is bit-identical.
 *
 *     At N>2 THEY ARE NOT THE SAME RULE. "The lower slot" hands a standing, permanent
 *     advantage to whoever `createMatch` happened to list first — which is exactly the
 *     kind of unearned edge rung 1 exists to refuse: *"most HP left" hands whoever owns the
 *     bigger pool a head start on a criterion it did nothing to earn.* It is recorded here
 *     rather than fixed because ANY replacement changes the N=2 answer or invents a
 *     tiebreak the sim has no quantity for, and this change is required to be
 *     bit-identical. => **This is the one line in `sim.ts` where slot advantage re-enters
 *     at N>2, and it needs a decision before the cap is raised.**
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
 * recording, audio director) all key off `match-ended`, which does fire.
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
    return a.id - b.id;                         // rung 3: the lower slot — see above
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
  const frozen = now < fighter.status.stunnedUntil;

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
    p.traveled += Math.hypot(moveX, moveY);
    p.x = newX;
    p.y = newY;

    if (hitWall || p.traveled >= (w.range ?? Infinity)) {
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
