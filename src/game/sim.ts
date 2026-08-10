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
import type { Fighter, FighterRole, GameEvent, MatchInput, MatchState, Splat, TrailMark } from './state.ts';
import { createFighter, otherRole } from './state.ts';
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
  return {
    phase: 'countdown',
    elapsed: 0,
    countdownValue: COUNTDOWN_FROM,
    countdownTick: 0,
    startFlashTimer: 0,
    timeRemaining: MATCH_DURATION_MS,
    safeRadius: arena.maxSafeRadius,
    // ── PER-CHARACTER POOLS, ON TOP OF THE ROLE DIAL (rules.ts DEVIATION #10) ──
    // `maxHpFor` multiplies the ROLE base by the character's own `stats.health`, so
    // `ENEMY_MAX_HP` keeps scaling the whole roster exactly as it did — a per-character
    // pool that replaced the role constant would have taken Uri's difficulty dial away.
    // The level term rides ALONGSIDE the character term inside `maxHpFor`, never instead
    // of it, so `maxHpFor` stays linear in its `roleBaseHp` at every level — which is what
    // `sim.test.mjs` §22(b) asserts and what keeps `ENEMY_MAX_HP` a working dial.
    player: createFighter('player', playerCharacterId, arena.playerSpawn, maxHpFor(playerCharacterId, PLAYER_MAX_HP, playerLevel), PLAYER_SIZE, { x: 1, y: 0 }, playerLevel),
    enemy: createFighter('enemy', enemyCharacterId, arena.enemySpawn, maxHpFor(enemyCharacterId, ENEMY_MAX_HP, enemyLevel), ENEMY_SIZE, { x: -1, y: 0 }, enemyLevel),
    projectiles: [],
    splats: [],
    trailMarks: [],
    winner: null,
    arena,
    // The AI starts the match knowing where the player spawned. Seeding this with the
    // player's true spawn rather than with a "never seen" sentinel is what makes the
    // no-concealment case bit-identical from the very first tick: `stepAI`'s first read of
    // the belief happens before anything has had a chance to refresh it.
    aiSighting: { x: arena.playerSpawn.x, y: arena.playerSpawn.y, at: 0 },
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
    applyAim(state, input);
    if (input.attack) {
      attemptAttack(state, 'player', input.selectedWeapon, events);
    }

    const playerMoved = movePlayer(state, dt, input, events);
    applyWorldTick(state, 'player', dt, playerMoved, events);

    const enemyMoved = stepAI(state, dt, events);
    applyWorldTick(state, 'enemy', dt, enemyMoved, events);
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
 *  3. THE HUMAN. Two fighters identical on both measures are indistinguishable by
 *     every quantity the sim has; the tie goes to the player. Deliberately the
 *     opposite of the behaviour this replaces, where the tie went to the enemy by
 *     arithmetic.
 *
 * Note there is no `death` event and both fighters stay `alive` — a timeout is not a
 * knockout, and consumers that read `state.winner` (HUD game-over card, trophy
 * recording, audio director) all key off `match-ended`, which does fire.
 */
function resolveTimeout(state: MatchState, events: GameEvent[]): void {
  const { player, enemy, arena } = state;
  const playerFraction = player.maxHp > 0 ? player.hp / player.maxHp : 0;
  const enemyFraction = enemy.maxHp > 0 ? enemy.hp / enemy.maxHp : 0;

  let winner: FighterRole;
  if (playerFraction !== enemyFraction) {
    winner = playerFraction > enemyFraction ? 'player' : 'enemy';
  } else {
    const playerToCentre = Math.hypot(player.x - arena.center.x, player.y - arena.center.y);
    const enemyToCentre = Math.hypot(enemy.x - arena.center.x, enemy.y - arena.center.y);
    winner = playerToCentre <= enemyToCentre ? 'player' : 'enemy';
  }

  state.phase = 'ended';
  state.winner = winner;
  events.push({ type: 'match-ended', winner });
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

function applyAim(state: MatchState, input: MatchInput): void {
  if (!input.aim) return;
  const mag = Math.hypot(input.aim.x, input.aim.y);
  if (mag > 1e-6) {
    state.player.facing = { x: input.aim.x / mag, y: input.aim.y / mag };
  }
}

/** Returns whether movement was *attempted* this tick (input non-zero), for trail-drop purposes. */
function movePlayer(state: MatchState, dt: number, input: MatchInput, _events: GameEvent[]): boolean {
  const player = state.player;
  const now = state.elapsed;

  // onOwnTrail is evaluated against the marks that exist BEFORE this tick's
  // movement/drop — matching the prototype, where `onOwnTrail` is computed once at
  // the top of the frame, before any new mark from this same frame is pushed.
  let speedMult = terrainSlowFactor(state, player);
  if (isOnOwnTrail(state, 'player')) speedMult *= TRAIL.speedBoost;
  if (now < player.status.slowedUntil) speedMult *= SLOW_MOVE_MULTIPLIER;
  const frozen = now < player.status.stunnedUntil;

  // `speedFor` scales `PLAYER_SPEED` by this character's own `stats.speed` — and it can
  // only scale DOWN (rules.ts `SPEED_TOP_STAT` is a cap, not a centre), so
  // `render/camera.ts`'s "nothing in rules.ts moves faster than PLAYER_SPEED *
  // TRAIL.speedBoost" — the claim its whole fair-play radius rests on — stays true.
  const speed = frozen ? 0 : speedFor(player.characterId, PLAYER_SPEED) * dt * speedMult;
  // Deliberately NOT normalized as a vector — each axis scales independently, so
  // diagonal movement is faster than cardinal movement, exactly like the
  // prototype's raw WASD handling.
  const mdx = input.move.x * speed;
  const mdy = input.move.y * speed;

  tryMove(player, mdx, mdy, state.arena);

  return mdx !== 0 || mdy !== 0;
}

// ─────────────────────────────────────────────────────────────────────────────
// Per-fighter world tick: Sticky Trail, central hazard, regen, fog.
// ─────────────────────────────────────────────────────────────────────────────

function applyWorldTick(state: MatchState, role: FighterRole, dt: number, attemptedMove: boolean, events: GameEvent[]): void {
  const fighter = state[role];
  if (!fighter.alive) return;

  // Publish this tick's terrain slow strength for the renderer (see the field doc on
  // `Fighter.terrainSlowFactor`). Purely an observation — same `terrainSlowFactor()`
  // read `movePlayer` already uses to scale the player's own speed; storing its result
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
  const opponentRole = otherRole(role);
  const opponent = state[opponentRole];

  // Sticky Trail: drop a mark while moving.
  if (def.hasTrail && attemptedMove) {
    fighter.trailDropTimer += dt;
    if (fighter.trailDropTimer >= TRAIL.dropIntervalMs) {
      fighter.trailDropTimer = 0;
      const mark: TrailMark = {
        id: state.nextId++,
        ownerRole: role,
        x: fighter.x,
        y: fighter.y,
        expiresAt: state.elapsed + TRAIL.durationMs,
        damaged: false,
      };
      state.trailMarks.push(mark);
      events.push({ type: 'trail-mark-created', ownerRole: role, x: fighter.x, y: fighter.y });
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
  // the victim is standing in is still marked `damaged` — you tread the filling out of
  // all of them, only one of them bites. That is what stops the cap from turning a
  // dense pile into a slow drip that costs the same 87 HP over the next 29 ticks; the
  // stack is spent, not queued.
  if (opponent.alive) {
    let hitsThisTick = 0;
    for (const mark of state.trailMarks) {
      if (mark.ownerRole !== role || mark.damaged) continue;
      if (Math.hypot(opponent.x - mark.x, opponent.y - mark.y) >= TRAIL.radius) continue;
      mark.damaged = true;
      if (hitsThisTick >= TRAIL.maxHitsPerTick) continue;
      hitsThisTick++;
      applyDamage(state, opponentRole, TRAIL.damage, null, { kind: 'trail', ownerRole: role }, events);
      if (!opponent.alive) break;
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
        applyDamage(state, role, hazard.damage ?? 0, null, { kind: 'hazard' }, events);
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
      if (fighter.hp > before) events.push({ type: 'heal', fighterRole: role, amount: fighter.hp - before });
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
      applyDamage(state, role, FOG_DAMAGE, null, { kind: 'fog' }, events);
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
    const target = state[p.targetRole];
    const hitRadius = p.targetRole === 'player' ? HIT_RADIUS_VS_PLAYER : HIT_RADIUS_VS_ENEMY;

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
        applyDamage(state, p.targetRole, p.damage, w.effect, { kind: 'weapon', weaponKey: w.key, weaponName: w.name }, events);
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
      applyDamage(state, p.targetRole, p.damage, w.effect, { kind: 'weapon', weaponKey: w.key, weaponName: w.name }, events);
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
