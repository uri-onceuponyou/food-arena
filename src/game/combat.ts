/**
 * Combat resolution: firing weapons, applying damage/status, spawning projectiles.
 *
 * `attemptAttack` is the single entry point for BOTH the player and the AI — the AI
 * (see `ai.ts`) calls it with `attackerRole: 'enemy'` and a weapon index it already
 * chose. Sharing one function is what guarantees the two sides play by identical
 * rules (cooldown consumption, melee cone check, projectile spawning) with no
 * special-casing between them.
 *
 * `applyDamage` is likewise the single place HP ever goes down, for every source:
 * weapon hits, Donut's trail, the central hazard, and the closing fog. Every one of
 * those updates `lastDamagedAt` (regen eligibility), clamps HP, and can end the
 * match — see the "resolved ambiguities" note in the top-level report for why this
 * is deliberately more symmetric than the two-body prototype was.
 */

import {
  CHARACTERS,
  SLOW_DURATION_MS,
  STUN_DURATION_MS,
  TRAIL,
  type StatusEffect,
  type Weapon,
} from './rules.ts';
import type { DamageSource, FighterRole, GameEvent, MatchState, Vec2 } from './state.ts';
import { otherRole } from './state.ts';

const RAD2DEG = 180 / Math.PI;
const DEG2RAD = Math.PI / 180;

/**
 * True if `role`'s character has a live Sticky Trail mark of its own underneath it.
 * Used both for the ranged trail-damage boost here and for the movement speed boost
 * in `sim.ts` (kept here so both call sites share one definition).
 */
export function isOnOwnTrail(state: MatchState, role: FighterRole): boolean {
  const fighter = state[role];
  if (!CHARACTERS[fighter.characterId].hasTrail) return false;
  return state.trailMarks.some(
    (mark) => mark.ownerRole === role && Math.hypot(fighter.x - mark.x, fighter.y - mark.y) < TRAIL.radius,
  );
}

/**
 * Apply `amount` damage to `targetRole`, optionally inflicting a status effect,
 * clamping HP, recording the hit for regen/VFX purposes, and ending the match if
 * this was the killing blow. This is the ONLY place fighter HP is reduced anywhere
 * in the sim — combat hits, trail damage, the central hazard, and fog all funnel
 * through here.
 */
export function applyDamage(
  state: MatchState,
  targetRole: FighterRole,
  amount: number,
  effect: StatusEffect,
  source: DamageSource,
  events: GameEvent[],
): void {
  const target = state[targetRole];
  if (!target.alive) return;

  target.hp = Math.max(0, target.hp - amount);
  target.lastDamagedAt = state.elapsed;

  if (effect === 'slow') {
    target.status.slowedUntil = state.elapsed + SLOW_DURATION_MS;
  } else if (effect === 'stun') {
    target.status.stunnedUntil = state.elapsed + STUN_DURATION_MS;
  }

  events.push({ type: 'hit-landed', targetRole, amount, effect, source, x: target.x, y: target.y });

  if (target.hp === 0) {
    target.alive = false;
    events.push({ type: 'death', fighterRole: targetRole });
    if (state.phase === 'playing') {
      state.phase = 'ended';
      state.winner = otherRole(targetRole);
      events.push({ type: 'match-ended', winner: state.winner });
    }
  }
}

function spawnProjectile(
  state: MatchState,
  ownerRole: FighterRole,
  targetRole: FighterRole,
  weapon: Weapon,
  angleOffsetDeg: number,
  damage: number,
  color: string | undefined,
  emoji: string | undefined,
  origin: Vec2,
  facing: Vec2,
  events: GameEvent[],
): void {
  const baseAngle = Math.atan2(facing.y, facing.x) + angleOffsetDeg * DEG2RAD;
  const dirX = Math.cos(baseAngle);
  const dirY = Math.sin(baseAngle);
  const speed = weapon.speed ?? 0;
  const resolvedColor = color ?? weapon.color;
  const resolvedEmoji = emoji ?? weapon.emoji;

  const id = state.nextId++;
  state.projectiles.push({
    id,
    ownerRole,
    targetRole,
    weapon,
    x: origin.x,
    y: origin.y,
    vx: dirX * speed,
    vy: dirY * speed,
    traveled: 0,
    damage,
    color: resolvedColor,
    emoji: resolvedEmoji,
  });

  events.push({
    type: 'projectile-spawned',
    id,
    ownerRole,
    weaponKey: weapon.key,
    x: origin.x,
    y: origin.y,
    color: resolvedColor,
    emoji: resolvedEmoji,
  });
}

/**
 * Attempt one attack with `weapons[weaponIndex]` for `attackerRole`. Returns false
 * only when the attack could not even be attempted (unknown weapon slot, or still
 * on cooldown) — everything else (too far, wrong facing for a melee cone, target
 * already dead) still returns true and still consumes the cooldown, because that is
 * exactly what the prototype does: `w.lastUsed = now` is set unconditionally, before
 * any range/cone/target checks run. Whether the attack actually connected is only
 * observable via a `hit-landed`/`projectile-spawned` event in `events`.
 */
export function attemptAttack(
  state: MatchState,
  attackerRole: FighterRole,
  weaponIndex: number,
  events: GameEvent[],
): boolean {
  if (state.phase !== 'playing') return false;

  const attacker = state[attackerRole];
  const targetRole = otherRole(attackerRole);
  const target = state[targetRole];
  const weapons = CHARACTERS[attacker.characterId].weapons;
  const w = weapons[weaponIndex];
  if (!w) return false;

  const now = state.elapsed;
  if (now - attacker.lastUsed[weaponIndex] < w.cooldown) return false;
  attacker.lastUsed[weaponIndex] = now;
  events.push({ type: 'weapon-fired', fighterRole: attackerRole, weaponKey: w.key });

  if (w.type === 'self') {
    const healAmount = w.healAmount ?? 0;
    const healed = Math.min(healAmount, attacker.maxHp - attacker.hp);
    attacker.hp = Math.min(attacker.maxHp, attacker.hp + healAmount);
    if (healed > 0) events.push({ type: 'heal', fighterRole: attackerRole, amount: healed });
    return true;
  }

  if (w.type === 'melee') {
    if (target.hp <= 0) return true; // attempted, cooldown consumed, nothing to hit
    const toTargetX = target.x - attacker.x;
    const toTargetY = target.y - attacker.y;
    const dist = Math.hypot(toTargetX, toTargetY);
    if (dist > (w.range ?? 0)) return true; // "too far"

    const cone = w.cone ?? 360;
    // Deliberately not divide-by-zero-guarded: at dist === 0 this produces NaN, and
    // `NaN > cone/2` is false, so a melee hit on a perfectly overlapping target
    // always lands regardless of facing — matching the prototype's literal math.
    const dot = (attacker.facing.x * toTargetX + attacker.facing.y * toTargetY) / dist;
    const angleTo = Math.acos(Math.max(-1, Math.min(1, dot))) * RAD2DEG;
    if (angleTo > cone / 2) return true; // "wrong direction"

    applyDamage(state, targetRole, w.damage, w.effect, { kind: 'weapon', weaponKey: w.key, weaponName: w.name }, events);
    return true;
  }

  // ranged
  const origin: Vec2 = { x: attacker.x, y: attacker.y };
  const facing = attacker.facing;

  if (w.comboParts) {
    for (const part of w.comboParts) {
      spawnProjectile(state, attackerRole, targetRole, w, part.angle, part.damage, part.color, part.emoji, origin, facing, events);
    }
    return true;
  }

  const boosted = !!w.trailBoosted && isOnOwnTrail(state, attackerRole);
  const dmg = boosted ? Math.round(w.damage * TRAIL.damageBoost) : w.damage;

  if (w.pellets && w.pellets > 1) {
    const spread = w.spreadDeg ?? 0;
    for (let i = 0; i < w.pellets; i++) {
      const offset = (i - (w.pellets - 1) / 2) * spread;
      const color = w.pelletColors ? w.pelletColors[i % w.pelletColors.length] : undefined;
      const emoji = w.pelletEmojis ? w.pelletEmojis[i % w.pelletEmojis.length] : undefined;
      spawnProjectile(state, attackerRole, targetRole, w, offset, dmg, color, emoji, origin, facing, events);
    }
  } else {
    spawnProjectile(state, attackerRole, targetRole, w, 0, dmg, undefined, undefined, origin, facing, events);
  }
  return true;
}
