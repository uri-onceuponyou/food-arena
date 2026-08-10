/**
 * Combat resolution: firing weapons, applying damage/status, spawning projectiles.
 *
 * `attemptAttack` is the single entry point for BOTH the player and the AI — the AI
 * (see `ai.ts`) hands it the fighter it is driving and a weapon index it already
 * chose, exactly as `sim.ts` hands it the human's.
 *
 * Sharing one function is what guarantees the two sides play by identical rules (cooldown
 * consumption, melee cone check, projectile spawning) with no special-casing between them.
 *
 * ⚠️ IT TAKES A `Fighter`, NOT A SEAT NAME. It used to take `attackerRole: FighterRole` —
 * a two-valued string, so `attemptAttack(state, 'enemy', ...)` was the only way to say
 * "this one" and there could only ever be two of them.
 *
 * `applyDamage` is likewise the single place HP ever goes down, for every source:
 * weapon hits, Donut's trail, the central hazard, and the closing fog. Every one of
 * those updates `lastDamagedAt` (regen eligibility), clamps HP, and can end the
 * match — see the "resolved ambiguities" note in the top-level report for why this
 * is deliberately more symmetric than the two-body prototype was.
 */

import {
  CHARACTERS,
  CONCEAL_ATTACK_REVEAL_MS,
  SLOW_DURATION_MS,
  SLOW_GRACE_MS,
  STUN_DURATION_MS,
  STUN_GRACE_MS,
  TRAIL,
  levelHealthMultiplier,
  type StatusEffect,
  type Weapon,
} from './rules.ts';
import type { DamageSource, Fighter, GameEvent, MatchState, Vec2 } from './state.ts';
import { lastFighterStanding, nearestLivingOpponent } from './state.ts';
import { breakConcealment } from './movement.ts';

const RAD2DEG = 180 / Math.PI;
const DEG2RAD = Math.PI / 180;

/**
 * Separation below which two fighters count as COINCIDENT and there is no bearing
 * between them. See the melee block in `attemptAttack` for what that means.
 *
 * Deliberately a true-degeneracy epsilon rather than a play-scale distance: at any
 * separation above it the bearing is a well-defined direction and the cone check does
 * its normal job, so this rule governs exactly the case where the maths has no answer
 * — not a "too close to swing" band, which would be a design change rather than a fix.
 */
const MELEE_COINCIDENT_EPS = 1e-6;

/**
 * True if `fighter`'s character has a live Sticky Trail mark of its own underneath it.
 * Used both for the ranged trail-damage boost here and for the movement speed boost
 * in `sim.ts` (kept here so both call sites share one definition).
 */
export function isOnOwnTrail(state: MatchState, fighter: Fighter): boolean {
  if (!CHARACTERS[fighter.characterId].hasTrail) return false;
  return state.trailMarks.some(
    (mark) => mark.ownerId === fighter.id && Math.hypot(fighter.x - mark.x, fighter.y - mark.y) < TRAIL.radius,
  );
}

/**
 * The earliest `elapsed` at which `effect` may next be applied to `fighter`.
 *
 * A status is refused while it is ACTIVE and for a grace period after it expires — see
 * `rules.ts` AUTHORISED DEVIATION #5 for the rule and why it exists. Because
 * `slowedUntil` / `stunnedUntil` are absolute timestamps that survive their own expiry,
 * "active OR in grace" is a single comparison against `until + grace` and needs no extra
 * state; `applyDamage` below is the only writer of either field.
 *
 * Exported so the HUD/VFX layers can render the shrug-off window (a player who cannot
 * see the rule cannot learn it) without re-deriving the arithmetic, and so
 * `sim.test.mjs` asserts the same predicate the sim uses rather than a copy of it.
 * Returns `-Infinity` for a fighter that has never had the status.
 */
export function statusReadyAt(fighter: Fighter, effect: 'slow' | 'stun'): number {
  return effect === 'stun'
    ? fighter.status.stunnedUntil + STUN_GRACE_MS
    : fighter.status.slowedUntil + SLOW_GRACE_MS;
}

/**
 * Apply `amount` damage to `target`, optionally inflicting a status effect,
 * clamping HP, recording the hit for regen/VFX purposes, and ending the match if
 * this was the killing blow. This is the ONLY place fighter HP is reduced anywhere
 * in the sim — combat hits, trail damage, the central hazard, and fog all funnel
 * through here.
 *
 * ⚠️ The status half of this function is RATE-LIMITED and the damage half is not. A hit
 * whose status is refused still lands, still deals full damage, and still emits the same
 * `hit-landed` event carrying the weapon's authored `effect` — the event describes what
 * the weapon DOES, and whether the target happened to be immune is read off the target's
 * own timers (which is where `vfx.ts` already reads it from, so a refused stun correctly
 * draws no stun ring with no change to that layer).
 */
export function applyDamage(
  state: MatchState,
  target: Fighter,
  amount: number,
  effect: StatusEffect,
  source: DamageSource,
  events: GameEvent[],
): void {
  if (!target.alive) return;

  // ── THE LEVEL TERM IS APPLIED HERE, AND ONLY HERE ──────────────────────────
  //
  // Damage scaling has to live at the same single choke point HP reduction already does,
  // for the same reason: there are FIVE call sites (melee, two projectile impact paths,
  // trail marks, and the environment) and a multiplier applied at four of them is a
  // silent balance bug in the fifth.
  //
  // ⚠️ IT KEYS OFF THE SOURCE, NOT OFF THE ROLE. A fighter's own level must not scale
  // the fog or the central hazard — those are the ARENA hitting you, and making them
  // scale with your level would mean levelling up made the map more dangerous. So:
  //
  //   'weapon'  the source carries `attackerId` explicitly. ⚠️ IT USED TO SAY *"the
  //             attacker is the target's opponent, ALWAYS — a weapon can only ever be
  //             aimed at the other fighter"* and DERIVE it with `otherRole(targetRole)`.
  //             That was true, and it is the first sentence in this file that stops being
  //             true at three fighters: a hit would then be scaled by the level of whoever
  //             happened not to be the victim. The rule is now STATED by the thing that
  //             knows it — `attemptAttack` for a melee swing, the projectile's own
  //             `ownerId` for a shot that outlives the tick that fired it.
  //   'trail'   the source carries `ownerId` explicitly, because a Sticky Trail mark
  //             outlives the tick that dropped it.
  //   'fog' / 'hazard'  no attacker, no scaling.
  //
  // `damageMul` is exactly 1.0 at LEVEL_MIN, so every pre-levels match is bit-identical.
  const attacker = source.kind === 'weapon' ? state.fighters[source.attackerId]
    : source.kind === 'trail' ? state.fighters[source.ownerId]
    : null;
  const dealt = attacker ? amount * attacker.damageMul : amount;

  target.hp = Math.max(0, target.hp - dealt);
  target.lastDamagedAt = state.elapsed;

  // Refuse a status that is already running or still inside its grace window. This is
  // what bounds the longest unbroken movement lock to exactly STUN_DURATION_MS — the
  // measured worst case before it was 11.02 s against a 6.0 s mean engagement, held up
  // by ONE weapon whose cooldown outran its own stun.
  if (effect === 'slow') {
    if (state.elapsed >= statusReadyAt(target, 'slow')) {
      target.status.slowedUntil = state.elapsed + SLOW_DURATION_MS;
    }
  } else if (effect === 'stun') {
    if (state.elapsed >= statusReadyAt(target, 'stun')) {
      target.status.stunnedUntil = state.elapsed + STUN_DURATION_MS;
    }
  }

  // `amount` on the event is what the target actually LOST, not what the weapon table
  // says — otherwise the floating damage number and the health bar would disagree by the
  // level multiplier, which is precisely the class of defect (`DECISIONS §13`) where a
  // screen shows a number the model does not compute. `hud.ts` already rounds it for
  // display and `setBar` already ceils HP, so a continuous term needs nothing downstream.
  events.push({ type: 'hit-landed', targetRole: target.role, targetId: target.id, amount: dealt, effect, source, x: target.x, y: target.y });

  if (target.hp === 0) {
    target.alive = false;
    events.push({ type: 'death', fighterRole: target.role, fighterId: target.id });
    if (state.phase === 'playing') {
      // ── ⚠️ A KNOCKOUT IS NO LONGER THE END OF THE MATCH. IT USED TO SAY: ─────
      //
      //   > *"THE KNOCKOUT WINNER IS THE TARGET RULE'S ANSWER, not `otherRole`. At N=2 they
      //   > are the same fighter. At N>2 'the other one' does not exist and this becomes
      //   > 'the last one standing', which is a check on `fighters`, not on this target —
      //   > one of the two identifiers (`opponentOf`, `MAX_FIGHTERS`) that raising the cap
      //   > has to visit."*
      //
      // That is what it is now. The block is gated on a SURVIVOR COUNT rather than on a
      // death: `lastFighterStanding` returns non-null only when exactly one fighter is up,
      // so at two seats the death that just happened ends the match (identical), and at six
      // it is one knockout among four survivors and the clock keeps running.
      //
      // ⚠️ The gate moved from "somebody died" to "only one is left", and those are the same
      // sentence only at N=2. Reading it the other way — end the match on the first death —
      // is the single most natural way to write this, and it would turn a six-player brawl
      // into a first-blood race that no instrument in this repo measures.
      const victor = lastFighterStanding(state);
      if (victor !== null) {
        state.phase = 'ended';
        state.winner = victor.role;
        state.winnerId = victor.id;
        events.push({ type: 'match-ended', winner: victor.role, winnerId: victor.id });
      }
    }
  }
}

function spawnProjectile(
  state: MatchState,
  owner: Fighter,
  target: Fighter,
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
    ownerId: owner.id,
    targetId: target.id,
    ownerRole: owner.role,
    targetRole: target.role,
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
    ownerRole: owner.role,
    ownerId: owner.id,
    weaponKey: weapon.key,
    x: origin.x,
    y: origin.y,
    color: resolvedColor,
    emoji: resolvedEmoji,
  });
}

/**
 * Attempt one attack with `weapons[weaponIndex]` for `attacker`. Returns false
 * only when the attack could not even be attempted (unknown weapon slot, or still
 * on cooldown) — everything else (too far, wrong facing for a melee cone, target
 * already dead) still returns true and still consumes the cooldown, because that is
 * exactly what the prototype does: `w.lastUsed = now` is set unconditionally, before
 * any range/cone/target checks run. Whether the attack actually connected is only
 * observable via a `hit-landed`/`projectile-spawned` event in `events`.
 */
export function attemptAttack(
  state: MatchState,
  attacker: Fighter,
  weaponIndex: number,
  events: GameEvent[],
): boolean {
  if (state.phase !== 'playing') return false;

  // ── ⚠️ THE TARGET RULE, AND IT IS THE SPLIT NOW. IT USED TO SAY: ───────────
  //
  //   > *"THE TARGET RULE, ASKED ONCE. Was `otherRole(attackerRole)` — see
  //   > `state.ts:opponentOf` for why the five places that asked this question now share one
  //   > answer, and for what has to change at N>2 (this caller wants 'nearest living fighter
  //   > that is not me'; the knockout winner wants 'the last one standing'; they are not the
  //   > same generalisation)."*
  //
  // Both of those exist now and this caller takes the first. `ai.ts:stepAI` calls the SAME
  // function on the SAME tick with nothing moved in between, which is what keeps an AI's aim
  // and its shot on one fighter — see `nearestLivingOpponent`.
  //
  // ⚠️ `null` MEANS NOTHING IS LEFT TO HIT, AND IT IS UNREACHABLE WHILE `phase === 'playing'`.
  // `applyDamage` is the only writer of `hp`, it sets `hp` to exactly 0 and `alive` to false
  // together, and it ends the match in the same statement — so a fighter at 0 HP implies the
  // match is over, and the guard at the top of this function has already returned. The null
  // branch below is therefore what the melee branch's old `if (target.hp <= 0) return true;`
  // was: a spent attempt with nothing to connect with. It is written for every weapon type
  // rather than melee alone because "there is nobody to shoot at" is not a melee-shaped fact,
  // and because at six seats it stops being unreachable the moment somebody removes the
  // phase gate. `sim.test.mjs` §28(d) pins the unreachability rather than assuming it.
  const target = nearestLivingOpponent(state, attacker);
  const weapons = CHARACTERS[attacker.characterId].weapons;
  const w = weapons[weaponIndex];
  if (!w) return false;

  const now = state.elapsed;
  if (now - attacker.lastUsed[weaponIndex] < w.cooldown) return false;
  attacker.lastUsed[weaponIndex] = now;
  events.push({ type: 'weapon-fired', fighterRole: attacker.role, fighterId: attacker.id, weaponKey: w.key });

  // ── ATTACKING SPENDS YOUR COVER (DECISIONS §29c) ───────────────────────────
  //
  // Uri: *"attacking from under it will break it and reveal you. You can also step out and
  // attack."* Both halves, at the one point in the sim where "a fighter attacked" is a
  // fact — the same single-choke-point doctrine `applyDamage` applies to HP and to the
  // level multiplier, and for the same reason: there are two attack paths below (melee and
  // ranged, the second with three spawn shapes) and a rule applied in some of them is a
  // silent bug in the rest.
  //
  // ── WHY *HERE*, ABOVE EVERY OUTCOME TEST ───────────────────────────────────
  //
  // This sits after the cooldown gate and before range, cone, target-alive and every other
  // outcome test, so the reveal follows THE ACT OF ATTACKING and not its success. That is
  // the same line this function already draws for the cooldown — "too far", "wrong
  // direction" and "target already dead" all still consume the press — and it is the only
  // version that is symmetric: an attacker cannot learn whether it connected before
  // deciding whether it was seen, and neither can the fighter watching it.
  //
  // ── AND WHY A `self` PRESS DOES NEITHER ────────────────────────────────────
  //
  // Uri's word is *attacking*. The heal is the roster's only `self` weapon; it deals no
  // damage, spawns no projectile, and leaks nothing about where its caster is — it is
  // exactly the press `ai.ts` already exempts from the sight gate ("it targets the caster,
  // needs no sight of anyone"), and making concealment treat it as an attack here while
  // that file treats it as not-an-attack there would be this project's oldest defect shape
  // in a new place. §26(l) asserts BOTH directions, so the exemption cannot silently widen
  // to `ranged` nor silently vanish.
  //
  // ⚠️ INERT WHERE NO ARENA DECLARES A REGION: `breakConcealment` walks an empty list and
  // `revealedUntil` is read only through `movement.ts:isHidden`, which returns false either
  // way when nothing conceals. `tools/tmp/conceal_lab.mjs --bitid` is the proof, not this
  // paragraph.
  if (w.type !== 'self') {
    attacker.revealedUntil = now + CONCEAL_ATTACK_REVEAL_MS;
    for (const box of breakConcealment(attacker.x, attacker.y, state.arena, state.brokenConcealment)) {
      events.push({
        type: 'concealment-broken',
        ownerRole: attacker.role,
        ownerId: attacker.id,
        x: box.x,
        y: box.y,
        w: box.w,
        h: box.h,
        kind: box.kind,
      });
    }
  }

  if (w.type === 'self') {
    // ── THE HEAL SCALES WITH LEVEL, AND ON THE *HEALTH* LADDER ────────────────
    //
    // Until 2026-08-05 this applied `w.healAmount` RAW. Every damage path
    // multiplies by `attacker.damageMul` (see `applyDamage`) and the pool itself
    // scales via `maxHpFor` — so the self-heal was THE ONLY FIGHTER RESOURCE IN
    // THE GAME THAT DID NOT SCALE WITH LEVEL. Same shape as the five AI bugs: a
    // rule stated once and implemented differently elsewhere.
    //
    // The arithmetic, measured: at L15 the pool is 1.70x and the heal was 1.00x,
    // so 18 HP at L15 bought what ~10.6 buys at L1, and Hamburger collapsed at
    // levels 12-15. `hamburger>pizza` MIRRORED at L15 read 25.0% against 87.5%
    // at L1 — a mirrored pairing is supposed to be FLAT, and `level_lab
    // --selftest` was 6/7 on exactly that assertion. The threshold sat sharply
    // between healAmount 22 (passed) and 20 (failed), which is why the 25 -> 18
    // rebalance is what exposed it.
    //
    // ⚠️ WHY `levelHealthMultiplier` AND NOT `attacker.damageMul`. Today they are
    // numerically identical — LEVEL_HEALTH_PER_LEVEL and LEVEL_DAMAGE_PER_LEVEL
    // are both 0.05 — so `damageMul` would pass every test now. But they are
    // SEPARATELY DECLARED constants, i.e. separable by design, and a heal refills
    // the POOL. The invariant that makes a mirrored level curve flat is
    // heal-as-a-FRACTION-OF-POOL held constant, and only the health ladder does
    // that. Using `damageMul` would silently make the heal track damage the first
    // time someone moves one constant and not the other.
    //
    // Exactly 1.0 at LEVEL_MIN, so every level-1 match — including the entire
    // `healAmount` 25 -> 18 ladder, which was measured at level 1 — is
    // bit-identical to before this change.
    const healAmount = (w.healAmount ?? 0) * levelHealthMultiplier(attacker.level);
    const healed = Math.min(healAmount, attacker.maxHp - attacker.hp);
    attacker.hp = Math.min(attacker.maxHp, attacker.hp + healAmount);
    if (healed > 0) events.push({ type: 'heal', fighterRole: attacker.role, fighterId: attacker.id, amount: healed });
    return true;
  }

  // WAS `if (target.hp <= 0) return true;` INSIDE THE MELEE BRANCH — "attempted, cooldown
  // consumed, nothing to hit". Hoisted above every branch and re-expressed as "no living
  // opponent", which is the same statement at two seats and the correct one at six. The
  // `self` branch above deliberately runs FIRST and is exempt: a heal targets its caster, so
  // it works in an empty arena, and gating it here would be `ai.ts`'s oldest defect shape
  // (a rule stated once and implemented twice) reintroduced in the shared path — §26(l)
  // already asserts both directions of that exemption for the concealment reveal.
  if (target === null) return true;

  if (w.type === 'melee') {
    const toTargetX = target.x - attacker.x;
    const toTargetY = target.y - attacker.y;
    const dist = Math.hypot(toTargetX, toTargetY);
    if (dist > (w.range ?? 0)) return true; // "too far"

    const cone = w.cone ?? 360;

    // ── WHAT FACING MEANS AT ZERO SEPARATION ──────────────────────────────────
    //
    // This used to be an unguarded division. At `dist === 0` it produced NaN, and
    // `NaN > cone / 2` is false, so the cone check could not reject anything: a melee
    // swing on a perfectly overlapping target landed regardless of where the attacker
    // was pointing. The old comment called that prototype fidelity, and it is — but the
    // AI closes to LITERALLY zero separation (measured: 1,582 of 160,642 ticks across
    // 110 real matches sit at dist exactly 0, and 39 of 510 melee hits land inside
    // 1 wu), so aim stopped being load-bearing at precisely the range where the fight
    // is closest. An outcome decided by IEEE-754 NaN comparison semantics is not a
    // rule; it is the absence of one.
    //
    // THE DEFINED ANSWER: two coincident fighters have no bearing between them — the
    // vector from one to the other is the zero vector, which points nowhere, and no
    // amount of facing can aim a swing along it. So:
    //
    //   * a DIRECTIONAL swing (cone < 360°) MISSES. It is aimed, and there is nothing
    //     to aim at; the attempt is spent and the cooldown consumed, exactly like the
    //     existing "too far" and "wrong direction" outcomes.
    //   * an OMNIDIRECTIONAL swing (cone >= 360°, i.e. Lollipop's Giant Lollipop)
    //     still LANDS. It needs no bearing by definition, so the degeneracy that stops
    //     the others never arises for it.
    //
    // This is symmetric — the AI's own melee misses at zero separation too, so walking
    // into the player is no longer free damage — and it restores the property that
    // above the epsilon everything is continuous: approach from inside the cone and
    // the swing lands right up to the last representable distance, approach from
    // outside and it misses.
    if (cone < 360) {
      if (dist < MELEE_COINCIDENT_EPS) return true; // "coincident: no bearing to swing along"
      const dot = (attacker.facing.x * toTargetX + attacker.facing.y * toTargetY) / dist;
      const angleTo = Math.acos(Math.max(-1, Math.min(1, dot))) * RAD2DEG;
      if (angleTo > cone / 2) return true; // "wrong direction"
    }

    applyDamage(state, target, w.damage, w.effect, { kind: 'weapon', weaponKey: w.key, weaponName: w.name, attackerId: attacker.id }, events);
    return true;
  }

  // ranged
  const origin: Vec2 = { x: attacker.x, y: attacker.y };
  const facing = attacker.facing;

  if (w.comboParts) {
    for (const part of w.comboParts) {
      spawnProjectile(state, attacker, target, w, part.angle, part.damage, part.color, part.emoji, origin, facing, events);
    }
    return true;
  }

  const boosted = !!w.trailBoosted && isOnOwnTrail(state, attacker);
  const dmg = boosted ? Math.round(w.damage * TRAIL.damageBoost) : w.damage;

  if (w.pellets && w.pellets > 1) {
    const spread = w.spreadDeg ?? 0;
    for (let i = 0; i < w.pellets; i++) {
      const offset = (i - (w.pellets - 1) / 2) * spread;
      const color = w.pelletColors ? w.pelletColors[i % w.pelletColors.length] : undefined;
      const emoji = w.pelletEmojis ? w.pelletEmojis[i % w.pelletEmojis.length] : undefined;
      spawnProjectile(state, attacker, target, w, offset, dmg, color, emoji, origin, facing, events);
    }
  } else {
    spawnProjectile(state, attacker, target, w, 0, dmg, undefined, undefined, origin, facing, events);
  }
  return true;
}
