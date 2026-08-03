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

import { AI_CHASE_SPEED, AI_FLEE_HP_FRACTION, AI_FLEE_SPEED, AI_SLOW_MULTIPLIER, CHARACTERS } from './rules.ts';
import type { GameEvent, MatchState } from './state.ts';
import { attemptAttack } from './combat.ts';
import { moveToward } from './movement.ts';

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
  const adist = Math.hypot(adx, ady) || 1;
  const now = state.elapsed;

  const fleeing = enemy.hp < enemy.maxHp * AI_FLEE_HP_FRACTION;
  const aiSlowMult = now < enemy.status.slowedUntil ? AI_SLOW_MULTIPLIER : 1;
  const aiFrozen = now < enemy.status.stunnedUntil;

  if (!aiFrozen) {
    enemy.facing = { x: adx / adist, y: ady / adist };
  }

  let attemptedMove = false;

  if (fleeing) {
    if (!aiFrozen) {
      enemy.facing = { x: -adx / adist, y: -ady / adist };
      const step = AI_FLEE_SPEED * dt * aiSlowMult;
      // Flee target is directly away from the player, so slide around cover toward
      // that point rather than pinning against it.
      moveToward(enemy, -adx / adist, -ady / adist, step, state.arena,
        enemy.x - (adx / adist) * 400, enemy.y - (ady / adist) * 400);
      attemptedMove = true;

      const sniperIndex = pickSniperWeapon(state, adist);
      if (sniperIndex !== null) attemptAttack(state, 'enemy', sniperIndex, events);
    }
  } else {
    const chosenIndex = aiFrozen ? null : pickHighestDamageWeapon(state, adist);
    if (chosenIndex !== null) {
      attemptAttack(state, 'enemy', chosenIndex, events);
    } else if (!aiFrozen) {
      const step = AI_CHASE_SPEED * dt * aiSlowMult;
      moveToward(enemy, adx / adist, ady / adist, step, state.arena, player.x, player.y);
      attemptedMove = true;
    }
  }

  return attemptedMove;
}
