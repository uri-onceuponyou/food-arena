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
  STATUS_DR_SCALES,
  STATUS_DR_WINDOW_MS,
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
 * How many applications deep the NEXT one would be — `rules.ts:STATUS_DR_SCALES`.
 *
 * Zero once `STATUS_DR_WINDOW_MS` has passed since the last APPLIED status, so a fighter
 * left alone recovers to full duration. Clamped at the last index so a long chain settles
 * on "immune" instead of running off the end of the table.
 *
 * ⚠️ **The window is measured from the last APPLIED status, never from the last hit.** If a
 * refused application refreshed `*AppliedAt`, an attacker who keeps firing into immunity
 * would keep the target immune for ever — the same defect with its sign flipped, and it is
 * silent because "nothing happens" looks identical either way.
 */
export function drNextStacks(fighter: Fighter, effect: 'slow' | 'stun', elapsed: number): number {
  const st = fighter.status;
  const appliedAt = effect === 'stun' ? st.stunAppliedAt : st.slowAppliedAt;
  const stacks = effect === 'stun' ? st.stunStacks : st.slowStacks;
  // ⚠️ `fresh` yields index 0 — FULL duration — not 1. A first-ever application must not
  // arrive already diminished, and `-Infinity` makes the very first call `fresh` by
  // construction. (Written as `fresh ? 1` first; the 100% rung would have been unreachable
  // and every status in the game would have been permanently half strength.)
  const fresh = elapsed - appliedAt >= STATUS_DR_WINDOW_MS;
  return Math.min(fresh ? 0 : stacks + 1, STATUS_DR_SCALES.length - 1);
}

/**
 * The duration the NEXT application of `effect` would have, in ms. **0 means immune.**
 *
 * Exported for the same reason `statusReadyAt` is — the HUD must be able to show the player
 * that the next one will be shorter, and `sim.test.mjs` must assert the predicate the sim
 * uses rather than a re-derived copy of it. `rules.ts` states five AI driver bugs that were
 * all one shape: *a rule stated once in `rules.ts` and implemented differently elsewhere.*
 */
export function drDurationFor(
  fighter: Fighter,
  effect: 'slow' | 'stun',
  elapsed: number,
  baseMs: number,
): number {
  return baseMs * STATUS_DR_SCALES[drNextStacks(fighter, effect, elapsed)];
}

/**
 * END `fighter`'s wind-up without firing it. The one statement of "a cast died", shared by
 * both cancelling terminators (an applied stun, and death) so the two cannot drift into
 * clearing different things or emitting different events.
 *
 * ⚠️ **THE COOLDOWN IS DELIBERATELY NOT REFUNDED.** `lastUsed[weaponIndex]` was stamped at
 * the press and stays stamped. That is the same line `attemptAttack` has always drawn —
 * "too far", "wrong direction" and "target already dead" all consume the press — and it is
 * what makes a stun a real counter rather than a free tempo trade: interrupting a 3.5 s
 * ultimate costs its owner the whole 3.5 s.
 *
 * Callers test `fighter.cast !== null` themselves rather than having this no-op, so that a
 * cancel site cannot silently become dead code without the reader noticing.
 */
function cancelCast(
  fighter: Fighter,
  reason: 'stun' | 'death',
  events: GameEvent[],
): void {
  const c = fighter.cast;
  if (c === null) return;
  fighter.cast = null;
  events.push({
    type: 'cast-cancelled',
    fighterRole: fighter.role,
    fighterId: fighter.id,
    weaponKey: CHARACTERS[fighter.characterId].weapons[c.weaponIndex].key,
    reason,
  });
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
      const ms = drDurationFor(target, 'slow', state.elapsed, SLOW_DURATION_MS);
      if (ms > 0) {
        target.status.slowStacks = drNextStacks(target, 'slow', state.elapsed);
        target.status.slowAppliedAt = state.elapsed;
        target.status.slowedUntil = state.elapsed + ms;
      }
    }
  } else if (effect === 'stun') {
    const stunMs = state.elapsed >= statusReadyAt(target, 'stun')
      ? drDurationFor(target, 'stun', state.elapsed, STUN_DURATION_MS)
      : 0;
    if (stunMs > 0) {
      target.status.stunStacks = drNextStacks(target, 'stun', state.elapsed);
      target.status.stunAppliedAt = state.elapsed;
      target.status.stunnedUntil = state.elapsed + stunMs;
      // ── TERMINATOR 2: AN APPLIED STUN CANCELS A WIND-UP ────────────────────
      //
      // 🚨 **INSIDE THE `statusReadyAt` GUARD, NOT BESIDE THE `hit-landed` EVENT, AND THE
      // DIFFERENCE IS INVISIBLE FROM OUTSIDE.** This function emits `hit-landed` carrying
      // the weapon's authored `effect` EVEN WHEN THE STUN WAS REFUSED — the event
      // describes what the weapon does, and immunity is read off the target's own timers
      // (see this function's own header). A cancel driven off the event would therefore
      // break casts on stuns that never happened, and nothing downstream could tell:
      // both versions emit the same `cast-cancelled`. `sim.test.mjs` §33(g) plants a
      // grace-refused stun for exactly this and requires the cast to SURVIVE it.
      //
      // ── WHY A STUN AND *ONLY* A STUN, WHICH IS A BALANCE DECISION ─────────
      //
      // Measured by `tools/tmp/cst_interrupt.mjs` over 880 real matches, 1171 distinct
      // press opportunities: if ANY damage cancelled, only 24.8% of ultimates would
      // survive a 900 ms wind-up — three in four dying on a 3.5 s cooldown, which is a
      // dead button, not counterplay. Stun-only leaves 84.1%. The gap is 59.3 pp against
      // a ±2.86 pp floor. Parked as `DECISIONS §74(a)` with stun-only IN FORCE.
      //
      // The cooldown is NOT refunded: `lastUsed[]` was stamped at the press and stays
      // stamped, exactly as a melee swing that misses stays spent.
      if (target.cast !== null) {
        cancelCast(target, 'stun', events);
      }
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
    // `DECISIONS §49a` — the timeout tiebreak's rung 3 is "fewest deaths", so the count has
    // to exist. It is incremented HERE and nowhere else, for the reason this whole function
    // exists: `applyDamage` is the single choke point for HP reduction, its
    // `if (!target.alive) return` guard makes a second entry on a corpse impossible, and a
    // counter maintained anywhere else would be a second statement of "this fighter went
    // down". It sits immediately under the `death` event it must always agree with.
    //
    // 🚨 **AND IT IS BELOW THAT EVENT RATHER THAN BESIDE `alive = false` FOR A REASON THAT
    // IS NOT STYLE.** `conceal_lab.mjs --selftest`'s event-ORDER known-bad anchors on the
    // literal three lines `if (target.hp === 0) { / target.alive = false; / events.push({
    // type: 'death',` and rewrites them; its second edit then references a `const` the first
    // one declares. Landing anything — including a comment — between those lines makes edit
    // 1 miss while edit 2 still applies, and the patched sim dies with a ReferenceError
    // instead of failing that tool's own `applied[0]` assertion cleanly. Measured, not
    // predicted: this line was written beside `alive = false` first and `--selftest` crashed.
    // **Do not move it back up, and do not put a comment between those three lines.**
    target.deaths++;
    // ── TERMINATOR 3: A CORPSE DOES NOT FINISH ITS WIND-UP ────────────────────
    //
    // 🚨 **BELOW `target.deaths++`, AND THE POSITION IS LOAD-BEARING FOR THE SAME REASON
    // THAT COUNTER'S IS.** `conceal_lab.mjs --selftest`'s event-ORDER known-bad anchors on
    // the three literal lines `if (target.hp === 0) { / target.alive = false; / events.push({
    // type: 'death',` and its SECOND edit references a `const` its FIRST one declares.
    // Landing anything between those lines — including a comment — makes edit 1 miss while
    // edit 2 applies, and the patched sim dies with a `ReferenceError` instead of failing
    // that tool's assertion cleanly. This block is therefore below the counter, which is
    // itself below the event, for exactly the reason recorded above it.
    //
    // Ordered AFTER terminator 2: `applyDamage` writes the status before it tests for
    // death, so a blow that both stuns and kills has already cancelled with reason
    // `'stun'` and this finds `cast === null`. That ordering is stated in the
    // `cast-cancelled` event doc rather than left to be re-derived from this file.
    if (target.cast !== null) {
      cancelCast(target, 'death', events);
    }
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
    // The origin of the frame `traveled` is denominated in — see `Projectile.traveled` and
    // `rules.ts` AUTHORISED DEVIATION #12. Captured HERE rather than defaulted on the first
    // step so the shot's very first tick is charged in the same units as every later one;
    // a shot that spent one tick on the shipped path-length rule would silently overpay by
    // ~2 wu, which is inside nothing and is exactly the kind of seam that survives a decade.
    tx: target.x,
    ty: target.y,
    age: 0,
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
 * ── ATTACKING SPENDS YOUR COVER (DECISIONS §29c) ─────────────────────────────
 *
 * Lifted out of `attemptAttack` verbatim when the cast split landed, and lifted rather
 * than copied for the reason the whole file is arranged this way: there are now TWO
 * moments at which a fighter has attacked — a castless weapon going off, and a cast
 * BEGINNING — and a rule applied at one of them is a silent bug at the other. One
 * function body, two call sites, one rule.
 *
 * ── WHY A CAST SPENDS IT AT THE PRESS ──────────────────────────────────────
 *
 * The original comment's own argument decides this: the reveal *"sits after the cooldown
 * gate and before range, cone, target-alive and every other outcome test, so the reveal
 * follows THE ACT OF ATTACKING and not its success."* Opening a 1100 ms wind-up is
 * unambiguously the act of attacking — it is the loudest thing a fighter can do — so
 * staying hidden through it would be exactly the asymmetry that rule exists to refuse.
 * It is spent AGAIN at the resolve, which is not a second rule but the same one firing on
 * the second act: `breakConcealment` is idempotent (`broken.includes(b)` refuses a plate
 * already spent, "by this fighter or the other one") so no second `concealment-broken`
 * event can be emitted, and `revealedUntil` correctly re-arms from the later instant so
 * the caster is not hidden again the moment its slam lands.
 *
 * ── AND WHY A `self` PRESS DOES NEITHER ────────────────────────────────────
 *
 * Uri's word is *attacking*. The heal is the roster's only `self` weapon; it deals no
 * damage, spawns no projectile, and leaks nothing about where its caster is — it is
 * exactly the press `ai.ts` already exempts from the sight gate ("it targets the caster,
 * needs no sight of anyone"), and making concealment treat it as an attack here while
 * that file treats it as not-an-attack there would be this project's oldest defect shape
 * in a new place. §26(l) asserts BOTH directions, so the exemption cannot silently widen
 * to `ranged` nor silently vanish.
 *
 * ⚠️ INERT WHERE NO ARENA DECLARES A REGION: `breakConcealment` walks an empty list and
 * `revealedUntil` is read only through `movement.ts:isHidden`, which returns false either
 * way when nothing conceals. `tools/tmp/conceal_lab.mjs --bitid` is the proof, not this
 * paragraph.
 */
function spendCover(state: MatchState, attacker: Fighter, w: Weapon, events: GameEvent[]): void {
  if (w.type === 'self') return;
  attacker.revealedUntil = state.elapsed + CONCEAL_ATTACK_REVEAL_MS;
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

/**
 * ── THE WEAPON ACTUALLY GOING OFF ────────────────────────────────────────────
 *
 * Everything from `weapon-fired` down: the heal, the melee cone, the projectile spawns.
 * Was the tail of `attemptAttack` and is unchanged line for line; it is a separate
 * function because a `castMs` weapon reaches it on a LATER TICK than the press that
 * bought it (`resolveDueCast` below), and the alternative — a flag threaded through
 * `attemptAttack` — would make the press path and the resolve path two implementations
 * of one resolution rule, which is the defect shape this file's header is about.
 *
 * 🚨 **`weapon-fired` IS PUSHED HERE, WHICH IS WHAT MOVES IT TO THE RESOLVE.** For every
 * weapon with no `castMs` this function is called synchronously from `attemptAttack` on
 * the press tick, in the same position in the tick, before `spendCover` and before any
 * outcome test — so the emitted stream is byte-identical to the pre-cast sim. That
 * inertness on day one is what makes this landable while `match.ts`, `vfx.ts` and
 * `audio/director.ts` are owned by other agents: they need no change, and they get the
 * correct behaviour for free the moment a weapon grows a wind-up.
 *
 * Returns what `attemptAttack` always returned: false only for "could not be attempted",
 * which at this point can only be an unknown weapon slot.
 */
function resolveWeapon(
  state: MatchState,
  attacker: Fighter,
  weaponIndex: number,
  events: GameEvent[],
): boolean {
  const weapons = CHARACTERS[attacker.characterId].weapons;
  const w = weapons[weaponIndex];
  if (!w) return false;

  events.push({ type: 'weapon-fired', fighterRole: attacker.role, fighterId: attacker.id, weaponKey: w.key });
  spendCover(state, attacker, w, events);
  return deliverWeapon(state, attacker, w, events);
}

/**
 * RESOLVE `fighter`'s wind-up if it is due — terminator 1 of `ActiveCast`, and the only
 * one that is not a cancellation.
 *
 * Called once, from the top of that fighter's turn in `sim.ts`'s fighter loop, so the
 * effect lands at the same point in the tick a press would have landed it and nothing
 * downstream (projectiles, fog, the clock) has to know casts exist.
 *
 * ⚠️ **THE PHASE IS RE-READ HERE AND THAT IS NOT REDUNDANT.** The loop's own gate was
 * evaluated before the loop began, and `applyDamage` can flip `phase` to `'ended'`
 * mid-loop when slot 0's blow is the last one — after which slot 1 must not resolve a
 * slam out of a finished match. Every other entry point in the sim re-reads the phase for
 * the same reason (`attemptAttack` at its top, `stepAI` at its top); this is that rule,
 * not a new one.
 *
 * ⚠️ **A MATCH THAT ENDS MID-CAST LEAVES THE RECORD ALONE.** There is no
 * "clear every cast" statement anywhere, deliberately: `phase` leaves `'playing'` in two
 * places (`applyDamage`'s victor block and `sim.ts:resolveTimeout`) and clearing it in
 * both would be two statements of one rule. Doing nothing is one rule in one place — this
 * gate — and every renderer already gates on phase. `sim.test.mjs` §33(i) pins it so
 * nobody tidies it away.
 *
 * The record is cleared BEFORE the resolution runs, so a resolution that reaches
 * `applyDamage` cannot find its own caster mid-cast and cancel what it is delivering.
 */
export function resolveDueCast(state: MatchState, fighter: Fighter, events: GameEvent[]): boolean {
  if (state.phase !== 'playing') return false;
  const c = fighter.cast;
  if (c === null || state.elapsed < c.resolvesAt) return false;
  fighter.cast = null;
  return resolveWeapon(state, fighter, c.weaponIndex, events);
}

/**
 * Attempt one attack with `weapons[weaponIndex]` for `attacker`. Returns false
 * only when the attack could not even be attempted (unknown weapon slot, still
 * on cooldown, or a wind-up already running) — everything else (too far, wrong facing
 * for a melee cone, target already dead) still returns true and still consumes the
 * cooldown, because that is exactly what the prototype does: `w.lastUsed = now` is set
 * unconditionally, before any range/cone/target checks run. Whether the attack actually
 * connected is only observable via a `hit-landed`/`projectile-spawned` event in `events`.
 *
 * ── ⚠️ IT IS NOW THE *PRESS*, AND FOR ONE WEAPON THE PRESS IS NOT THE ATTACK ──
 *
 * `rules.ts:Weapon.castMs` above 0 makes this open an `ActiveCast` and return, leaving
 * the caster rooted with its aim frozen until `resolveDueCast` fires the attack `castMs`
 * later. Everything the press half does — the cooldown gate, stamping `lastUsed`, and
 * spending cover — is unchanged and happens at the PRESS in both paths, because all three
 * are consequences of pressing rather than of connecting. That is the same line this
 * function has always drawn: "too far", "wrong direction" and "target already dead" all
 * still consume the press.
 *
 * 🚨 **A FIGHTER MID-CAST CANNOT PRESS ANYTHING.** Without that gate a caster could stack
 * a second cast over the first (the second press would overwrite `cast` and the first
 * weapon's cooldown would be spent on nothing) or interleave a cheap ranged shot into a
 * window it has committed to standing still in. One `ActiveCast` per fighter, and the
 * refusal is stated once, here, for the human and the AI alike — they share this function
 * precisely so the two sides cannot play by different rules.
 */
export function attemptAttack(
  state: MatchState,
  attacker: Fighter,
  weaponIndex: number,
  events: GameEvent[],
): boolean {
  if (state.phase !== 'playing') return false;

  const w = CHARACTERS[attacker.characterId].weapons[weaponIndex];
  if (!w) return false;

  const now = state.elapsed;
  // The wind-up gate sits ABOVE the cooldown gate deliberately: a fighter mid-cast is not
  // "on cooldown for this slot", it is busy for every slot, and asking the narrower
  // question first would let a second weapon's ready cooldown answer the wider one.
  if (attacker.cast !== null) return false;
  if (now - attacker.lastUsed[weaponIndex] < w.cooldown) return false;
  attacker.lastUsed[weaponIndex] = now;

  const castMs = w.castMs ?? 0;
  if (castMs > 0) {
    attacker.cast = { weaponIndex, startedAt: now, resolvesAt: now + castMs };
    events.push({
      type: 'cast-started',
      fighterRole: attacker.role,
      fighterId: attacker.id,
      weaponKey: w.key,
      castMs,
    });
    spendCover(state, attacker, w, events);
    return true;
  }

  // Castless: the press IS the attack, resolved synchronously, in the same position in the
  // tick and emitting the same events in the same order as before this field existed.
  return resolveWeapon(state, attacker, weaponIndex, events);
}

/**
 * The outcome half: who this connects with and what it does to them. Reached from the
 * press tick for a castless weapon and from the resolve tick for a cast one, through
 * `resolveWeapon` in both cases, so there is exactly one implementation of "what this
 * weapon does".
 */
function deliverWeapon(
  state: MatchState,
  attacker: Fighter,
  w: Weapon,
  events: GameEvent[],
): boolean {
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
  //
  // ⚠️ **AND FOR A CAST WEAPON THIS IS ASKED AT THE RESOLVE, NOT AT THE PRESS.** That is
  // the right instant and it is deliberate: a slam that goes off 1100 ms after the button
  // hits whoever is nearest WHEN IT LANDS. Freezing the target at the press would make the
  // caster's aim a lie in the other direction — it would track a fighter who had walked
  // out of the disc — and it would need a stored `targetId` on `ActiveCast`, i.e. a second
  // answer to "who is this hitting" that could disagree with the first.
  const target = nearestLivingOpponent(state, attacker);

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
