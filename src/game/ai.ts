/**
 * Enemy AI controller.
 *
 * Transcribed from the prototype's inline AI block: chase the player, flee and
 * snipe below a flee-HP threshold, otherwise pick the highest-damage weapon that's
 * off cooldown and in range. Attacks are issued through `combat.ts`'s
 * `attemptAttack` — the same function the player uses — rather than a separate AI
 * firing path. That is a deliberate, low-risk deviation from the prototype, whose
 * `aiFireWeapon` skips the melee cone/facing check the player is subject to; see
 * the report for why unifying the two paths was judged safe (the AI always faces
 * the target it is about to melee, so the cone check is a no-op in every reachable
 * state — it only matters for defensive consistency).
 */

import {
  AI_CHASE_SPEED,
  AI_ESCAPE_PRIORITY,
  AI_FLEE_HP_FRACTION,
  AI_FLEE_SPEED,
  AI_HAZARD_MARGIN,
  AI_HAZARD_WEIGHT,
  AI_RING_MARGIN,
  AI_RING_WEIGHT,
  AI_SELF_HEAL_HP_FRACTION,
  AI_SLOW_MULTIPLIER,
  CHARACTERS,
} from './rules.ts';
import type { GameEvent, MatchState } from './state.ts';
import { attemptAttack } from './combat.ts';
import { moveToward } from './movement.ts';

/**
 * How far ahead a steered move aims. `moveToward` runs the flow field toward a TARGET
 * POINT, not a heading, so a blended direction has to be turned back into a point; 400 wu
 * is the same lead the flee branch has always used.
 */
const STEER_LEAD = 400;

/** Below this the two positions coincide and there is no direction between them. */
const EPS = 1e-6;

/**
 * A hazard is pushed away from along a vector that is part RADIAL (get out) and part
 * TANGENTIAL (go round), never purely radial — because a purely radial repulsion field
 * has a guaranteed local minimum, and it sits exactly where this AI spends its time.
 *
 * Proven, not assumed: with the pot between a chasing AI and the player, "toward the
 * player" and "away from the pot" are exactly antiparallel, so the two cancel and the AI
 * oscillates on the spot at whatever distance the weights balance — it never enters the
 * fire and it never arrives either, which is the AI-cannot-navigate bug in a new costume.
 * A sideways component makes the field flow AROUND the hazard instead of bouncing off it,
 * and the side is chosen by whichever perpendicular agrees with the fighter's own intent,
 * so it rounds the pot on the short side rather than picking one arbitrarily.
 *
 * 0.8 / 0.6 is a unit vector (0.8² + 0.6² = 1), so the blend changes the DIRECTION of the
 * push without changing its magnitude, and the radial share stays dominant — a fighter
 * already inside the burn ring still leaves it rather than orbiting inside it.
 */
const HAZARD_RADIAL = 0.8;
const HAZARD_TANGENT = 0.6;

/** Scratch, module-level so the per-tick steering allocates nothing. */
const DANGER = { x: 0, y: 0 };
const STEER = { dirX: 0, dirY: 0, navX: 0, navY: 0 };

/**
 * Accumulate a steering vector AWAY from every damaging hazard and BACK INSIDE the
 * closing ring into `DANGER`, and return the worst ENCROACHMENT.
 *
 * Two separate quantities, deliberately:
 *
 *   * ENCROACHMENT `t` — how far into the margin the fighter is, normalised: 0 at the
 *     outer edge of the margin, exactly **1 at the boundary itself** (the burn ring, the
 *     safe radius), 2 one full margin past it. It carries no weight and no units, so
 *     `t >= 1` means one thing only and means it for every hazard: *this fighter is
 *     already taking damage, or is about to on this tick*. That is what
 *     `AI_ESCAPE_PRIORITY` compares against, which is why the AI stops shooting exactly
 *     when it starts burning and not a step earlier.
 *   * The STEERING VECTOR — `t` scaled by the hazard's weight. The fighter's own intent
 *     always carries weight 1, so `AI_RING_WEIGHT` 2.0 means "at the ring edge, getting
 *     back inside matters twice as much as whatever I was doing".
 *
 * Only `kind: 'damage'` hazards are avoided. The two `slow` puddles are deliberately NOT
 * — they cost movement, never HP, and steering around them would push the AI off the
 * shortest route for a cost the fog and the pot do not share.
 */
function dangerSteer(state: MatchState, x: number, y: number, intentX: number, intentY: number): number {
  DANGER.x = 0;
  DANGER.y = 0;
  let worst = 0;

  for (const h of state.arena.hazards) {
    if (h.kind !== 'damage') continue;
    const dx = x - h.x;
    const dy = y - h.y;
    const d = Math.hypot(dx, dy);
    const trigger = h.radius + AI_HAZARD_MARGIN;
    if (d >= trigger) continue;
    // Coincident with the hazard centre: any direction is equally out, and picking one
    // arbitrarily is better than dividing by zero. +x is as good as any and unreachable
    // in practice (the pot's CoverBox stops a fighter 73 wu short of its centre).
    const ux = d > EPS ? dx / d : 1;
    const uy = d > EPS ? dy / d : 0;
    // Perpendicular, on whichever side agrees with where the fighter wanted to go. The
    // `>= 0` tiebreak matters: a head-on approach projects ZERO onto both perpendiculars,
    // which is exactly the case that stalls, so it must still resolve to a side.
    const side = -uy * intentX + ux * intentY >= 0 ? 1 : -1;
    const px = -uy * side;
    const py = ux * side;
    const t = Math.min(2, (trigger - d) / AI_HAZARD_MARGIN);
    const w = t * AI_HAZARD_WEIGHT;
    DANGER.x += (ux * HAZARD_RADIAL + px * HAZARD_TANGENT) * w;
    DANGER.y += (uy * HAZARD_RADIAL + py * HAZARD_TANGENT) * w;
    if (t > worst) worst = t;
  }

  const cx = state.arena.center.x;
  const cy = state.arena.center.y;
  const toCx = cx - x;
  const toCy = cy - y;
  const dc = Math.hypot(toCx, toCy);
  if (dc > EPS) {
    const margin = state.safeRadius - dc; // > 0 inside the safe disc
    if (margin < AI_RING_MARGIN) {
      const t = Math.min(2, (AI_RING_MARGIN - margin) / AI_RING_MARGIN);
      DANGER.x += (toCx / dc) * t * AI_RING_WEIGHT;
      DANGER.y += (toCy / dc) * t * AI_RING_WEIGHT;
      if (t > worst) worst = t;
    }
  }

  return worst;
}

/**
 * The AI's only defensive resource. Returns the index of a `self` heal worth using right
 * now, or null. See `rules.ts` AUTHORISED DEVIATION #7 — until today this was unreachable
 * code for the AI and usable by the player, on the same character.
 */
function pickSelfHealWeapon(state: MatchState): number | null {
  const enemy = state.enemy;
  const weapons = CHARACTERS[enemy.characterId].weapons;
  const now = state.elapsed;

  for (let i = 0; i < weapons.length; i++) {
    const w = weapons[i];
    if (w.type !== 'self') continue;
    const heal = w.healAmount ?? 0;
    if (heal <= 0) continue;
    if (now - enemy.lastUsed[i] < w.cooldown) continue;
    if (enemy.hp > enemy.maxHp * AI_SELF_HEAL_HP_FRACTION) continue; // not hurt enough to spend it
    if (enemy.maxHp - enemy.hp < heal) continue; // would overheal — wait
    return i;
  }
  return null;
}

function pickHighestDamageWeapon(state: MatchState, adist: number): number | null {
  const enemy = state.enemy;
  const weapons = CHARACTERS[enemy.characterId].weapons;
  const now = state.elapsed;

  let bestIndex: number | null = null;
  let bestDamage = -Infinity;
  weapons.forEach((w, i) => {
    if (w.type === 'self') return;
    if (now - enemy.lastUsed[i] < w.cooldown) return;
    if (adist > (w.range ?? Infinity)) return;
    const dmg = w.damage ?? 0;
    // Strict `>` (not `>=`) preserves "first weapon wins on a damage tie", matching
    // the prototype's stable `Array.sort` + take-first.
    if (dmg > bestDamage) {
      bestDamage = dmg;
      bestIndex = i;
    }
  });
  return bestIndex;
}

function pickSniperWeapon(state: MatchState, adist: number): number | null {
  const enemy = state.enemy;
  const weapons = CHARACTERS[enemy.characterId].weapons;
  const now = state.elapsed;

  for (let i = 0; i < weapons.length; i++) {
    const w = weapons[i];
    if (w.type !== 'ranged') continue;
    if (now - enemy.lastUsed[i] < w.cooldown) continue;
    if (adist > (w.range ?? Infinity)) continue;
    return i;
  }
  return null;
}

/**
 * Advance the enemy's decision-making for one tick: face the player, chase or
 * flee-and-snipe, and fire when a usable weapon is chosen. Movement is resolved
 * with the same `tryMove` collision rule the player uses.
 *
 * Returns whether the AI *attempted* to move this tick (regardless of whether
 * collision actually let it move) — `sim.ts` needs this to drive the enemy's own
 * Sticky Trail drop, exactly mirroring how the prototype's trail-drop condition is
 * "keys were pressed", not "position changed".
 */
export function stepAI(state: MatchState, dt: number, events: GameEvent[]): boolean {
  if (state.phase !== 'playing') return false;

  const enemy = state.enemy;
  const player = state.player;
  if (enemy.hp <= 0 || player.hp <= 0) return false;

  const adx = player.x - enemy.x;
  const ady = player.y - enemy.y;
  const separation = Math.hypot(adx, ady);
  // `|| 1` keeps the historical range-check behaviour at zero separation (0 and 1 are
  // both inside every weapon's range), but it must NOT be used to derive a direction —
  // see `hasBearing`.
  const adist = separation || 1;
  const now = state.elapsed;

  /**
   * COINCIDENT FIGHTERS HAVE NO BEARING, so there is nothing to face.
   *
   * This used to be decided by a floating-point accident rather than by a rule. With
   * `adist = hypot(0,0) || 1 === 1`, `facing = {x: 0/1, y: 0/1}` is the ZERO VECTOR, and
   * `combat.ts:spawnProjectile` turns that into an angle with `Math.atan2(0, 0)` — which
   * is exactly 0, so every ranged shot a cornered AI fired at a perfectly overlapping
   * player flew DUE EAST. Not toward the player, not in the direction the AI had been
   * moving: east, because that is what `atan2` returns for the origin.
   *
   * `combat.ts` already answers the melee half of this deliberately (a directional swing
   * misses at zero separation because it is aimed and there is nothing to aim along; an
   * omnidirectional one still lands). The ranged half gets the matching rule here, and it
   * is the same rule `sim.ts:applyAim` has always applied to the PLAYER: a zero-length
   * aim vector leaves the previous facing untouched. So a coincident AI keeps pointing
   * wherever it last genuinely faced, and its shot goes there. Defined, deterministic,
   * consistent with the player, and — unlike due east — not a lie about where it aimed.
   *
   * `createFighter` seeds a unit facing, and nothing else in the sim ever writes a zero
   * one, so `facing` is now non-zero for the whole life of a match by construction.
   */
  const hasBearing = separation > 1e-6;

  const fleeing = enemy.hp < enemy.maxHp * AI_FLEE_HP_FRACTION;
  const aiSlowMult = now < enemy.status.slowedUntil ? AI_SLOW_MULTIPLIER : 1;
  const aiFrozen = now < enemy.status.stunnedUntil;

  if (!aiFrozen && hasBearing) {
    enemy.facing = { x: adx / adist, y: ady / adist };
  }

  let attemptedMove = false;

  /**
   * ── HAZARD AWARENESS ─────────────────────────────────────────────────────
   *
   * `dangerSteer` blends the fighter's own intent (weight 1) with a push out of the
   * boiling pot and back inside the closing ring. Two properties are deliberate:
   *
   *   * IT IS INERT WHEN NOTHING IS WRONG. Away from both hazards `danger` is 0 and
   *     `steer()` returns the caller's direction and the caller's nav target unchanged,
   *     so the chase still routes to the PLAYER through the flow field exactly as it did
   *     before. Only inside a margin does the target become a steered point, which is
   *     the only form a blended heading can take (`moveToward` steers to a point, not a
   *     heading — see STEER_LEAD).
   *   * SURVIVING OUTRANKS SHOOTING, but only at the boundary. `stepAI` fires OR moves,
   *     never both, so an AI with a weapon ready simply stops moving — which is how it
   *     came to stand inside the burn ring trading shots while the pot did 32 HP/s to it.
   *     Past AI_ESCAPE_PRIORITY it moves instead of firing. Below it, nothing changes.
   */
  // The steering needs to know where the fighter WANTED to go, so it can round a hazard
  // on the side that still makes progress. That is `fleeing` ? away : toward.
  const intentSign = fleeing ? -1 : 1;
  const danger = dangerSteer(state, enemy.x, enemy.y,
    (intentSign * adx) / adist, (intentSign * ady) / adist);
  const urgent = danger >= AI_ESCAPE_PRIORITY;
  /**
   * Blend `DANGER` into a desired heading and nav target, in place. Writes `STEER` rather
   * than returning a fresh object, and is a module function rather than a per-tick
   * closure, for the same reason `movement.ts:collidesWithCover` is a plain loop: this
   * runs every tick of every match and shows up in `tools/perf.mjs --mode alloc` without
   * ever showing up in a profile.
   */
  const steer = (dirX: number, dirY: number, navX: number, navY: number): void => {
    STEER.dirX = dirX; STEER.dirY = dirY; STEER.navX = navX; STEER.navY = navY;
    if (danger <= 0) return;
    const bx = dirX + DANGER.x;
    const by = dirY + DANGER.y;
    const m = Math.hypot(bx, by);
    if (m < EPS) return;
    STEER.dirX = bx / m;
    STEER.dirY = by / m;
    STEER.navX = enemy.x + STEER.dirX * STEER_LEAD;
    STEER.navY = enemy.y + STEER.dirY * STEER_LEAD;
  };

  // The heal is chosen before the flee/chase split because it is worth the same in both,
  // and it consumes the tick's ATTACK exactly like any other weapon — never both.
  const healIndex = aiFrozen || urgent ? null : pickSelfHealWeapon(state);

  if (fleeing) {
    if (!aiFrozen) {
      // Same rule as above: at zero separation "directly away from the player" is not a
      // direction either, so keep the facing rather than manufacture one.
      if (hasBearing) enemy.facing = { x: -adx / adist, y: -ady / adist };
      const step = AI_FLEE_SPEED * dt * aiSlowMult;
      // Flee target is directly away from the player, so slide around cover toward
      // that point rather than pinning against it — now bent back inside the ring, which
      // is the whole reason a retreating AI used to run itself into the fog.
      steer(-adx / adist, -ady / adist,
        enemy.x - (adx / adist) * STEER_LEAD, enemy.y - (ady / adist) * STEER_LEAD);
      moveToward(enemy, STEER.dirX, STEER.dirY, step, state.arena, STEER.navX, STEER.navY);
      attemptedMove = true;

      const shotIndex = healIndex ?? pickSniperWeapon(state, adist);
      if (shotIndex !== null) attemptAttack(state, 'enemy', shotIndex, events);
    }
  } else {
    const chosenIndex = aiFrozen || urgent ? null : (healIndex ?? pickHighestDamageWeapon(state, adist));
    if (chosenIndex !== null) {
      attemptAttack(state, 'enemy', chosenIndex, events);
    } else if (!aiFrozen) {
      const step = AI_CHASE_SPEED * dt * aiSlowMult;
      steer(adx / adist, ady / adist, player.x, player.y);
      moveToward(enemy, STEER.dirX, STEER.dirY, step, state.arena, STEER.navX, STEER.navY);
      attemptedMove = true;
    }
  }

  return attemptedMove;
}
