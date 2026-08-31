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
  GUARANTEED_VISIBLE_RADIUS,
  ITEM_TUNING,
  ITEMS,
  MEDIKIT,
  SLOW_DURATION_MS,
  SLOW_GRACE_MS,
  STATUS_DR_SCALES,
  STATUS_DR_WINDOW_MS,
  STUN_DURATION_MS,
  STUN_GRACE_MS,
  TRAIL,
  levelHealthMultiplier,
  type ItemId,
  type StatusEffect,
  type Weapon,
} from './rules.ts';
import type { DamageSource, Fighter, GameEvent, MatchState, Medikit, Vec2 } from './state.ts';
import {
  actionsLocked, hasItem, isLivingOpponentOf, lastFighterStanding, livingFighterCount,
  nearestLivingOpponent, NO_FIGHTER, weaponsLocked,
} from './state.ts';
import { boxesOverlap, breakConcealment, displaceFighter, placeFighterAt } from './movement.ts';

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
  reason: 'stun' | 'death' | 'sleep',
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
 * END `fighter`'s ITEM wind-up without firing it — `cancelCast`'s twin, and deliberately a
 * twin rather than a shared body: the two clear different fields and emit different events,
 * so "share the implementation" would mean a `kind` parameter and two branches inside one
 * function, which is the same two functions with a worse name. What they DO share is the
 * rule, and it is stated once here: the cooldown is not refunded.
 *
 * ⚠️ **THE COOLDOWN STAYS SPENT**, exactly as `cancelCast`'s does and for the identical
 * reason — `item.lastUsed[slot]` was stamped at the press, and interrupting a commitment has
 * to cost its owner the commitment or the wind-up is not a real cost. `ITEMS.shiitake` is the
 * only item this can reach, and it is the one whose whole price is the wait.
 */
function cancelItemCast(
  fighter: Fighter,
  reason: 'stun' | 'death' | 'sleep',
  events: GameEvent[],
): void {
  const c = fighter.itemCast;
  if (c === null) return;
  fighter.itemCast = null;
  events.push({
    type: 'item-cancelled',
    fighterRole: fighter.role,
    fighterId: fighter.id,
    itemId: c.itemId,
    slot: c.slot,
    reason,
  });
}

/**
 * ── WHAT A HIT DOES TO WHERE YOU STAND — `rules.ts:Weapon.knockback` / `lure` ──
 *
 * Both surfaces of the displacement primitive that are driven by a LANDED HIT. The third,
 * `selfLaunch`, is driven by the weapon GOING OFF and lives in `resolveWeapon`, because a
 * leap happens whether or not the swing connected.
 *
 * ⚠️ **THE WEAPON RECORD IS LOOKED UP FROM THE ATTACKER'S OWN KIT BY `key`, NOT THREADED
 * THROUGH `applyDamage`'s SIGNATURE.** Three call sites deliver weapon damage — the melee
 * loop in this file and BOTH projectile impact paths in `sim.ts` — and every one of them
 * already builds a `DamageSource` carrying `weaponKey` and `attackerId`. Adding a fourth
 * parameter would have made the record a thing three callers must remember to pass, which
 * is this file's most expensive recorded defect shape (*"a rule applied at four of the five
 * sites is a silent balance bug in the fifth"*, immediately above). The lookup is total:
 * `defineCharacter` binds the blurb link to the character's own weapon keys, so a key that
 * is not in the kit cannot be authored — and a `weaponKey` that resolves to nothing (several
 * `sim.test.mjs` fixtures spam a bare `{ kind: 'weapon', weaponKey: 'T' }`) simply displaces
 * nobody instead of throwing.
 *
 * ⚠️ `attacker != null`, NOT `!== null`, AND THAT IS NOT PEDANTRY. `state.fighters[
 * source.attackerId]` is `undefined` — not `null` — for a `weapon` source carrying no
 * `attackerId`, which those same fixtures deliberately construct. The `dealt` line above
 * already tolerates that through a truthiness test; a strict `!== null` here threw
 * `Cannot read properties of undefined` on the first run. Measured, not predicted.
 *
 * ⚠️ **`kind: 'weapon'` ONLY, AND THE OMISSIONS ARE DELIBERATE.** `fog` and `hazard` have no
 * attacker at all, so there is no bearing to displace along — the arena is not standing
 * anywhere. `trail` HAS an owner and is excluded on a design ground rather than a technical
 * one: a Sticky Trail mark damages on a per-tick cadence, so pushing off it would be a
 * continuous shove out of a stationary object, and it would make a trail a wall.
 *
 * ⚠️ **A CORPSE IS NEVER DISPLACED, AND IT COSTS NO BRANCH.** `sim.ts`'s fighter loop
 * `continue`s on `!fighter.alive` before `stepPush` is reached, so a displacement handed to
 * a fighter by its own killing blow is simply never spent. §39(g) asserts that rather than
 * leaving it to be re-derived from two files.
 */
function applyHitDisplacement(state: MatchState, attacker: Fighter, target: Fighter, w: Weapon): void {
  const knockback = w.knockback ?? 0;
  if (knockback > 0) {
    // Away from the attacker. At zero separation the vector points nowhere and
    // `displaceFighter` refuses it — the same rule the melee cone check applies to a
    // coincident swing, stated by the primitive so both readers share one answer.
    displaceFighter(target, target.x - attacker.x, target.y - attacker.y, knockback);
  }

  const lure = w.lure ?? 0;
  if (lure > 0) {
    // ── EVERY LIVING OPPONENT, TOWARD THE POINT OF IMPACT ────────────────────
    //
    // 🚨 **NOT THE VICTIM. THE CARD SAYS *"lures EVERY enemy toward it"*, AND AT TWO SEATS
    // THOSE ARE THE SAME SENTENCE** — `nearestLivingOpponent` returns the only opponent
    // there is, so a lure that moved only the fighter it struck would be indistinguishable
    // from this one in every two-seat fixture in the repo. That is the sixth defect of this
    // shape the project has paid for (the result card, corpse input, shake proximity, seat
    // order, the melee half of multi-target, the body-block); §39(c) drives it at N=6 and
    // its N=2 control is marked vacuous ON PURPOSE rather than omitted.
    //
    // The anchor is the VICTIM'S POSITION — the bait sticks to whoever it hit — which is the
    // same `x`/`y` this function publishes on `hit-landed` immediately below, so there is
    // exactly one answer to "where did this land". The victim is AT the anchor and is
    // therefore pulled nowhere: you are not lured toward yourself.
    //
    // ⚠️ **SLOT ORDER, AND DETERMINISM DEPENDS ON IT** — `state.fighters` is the sim's one
    // iteration order, exactly as `deliverWeapon`'s multi-victim melee loop argues.
    //
    // ⚠️ **CLAMPED TO EACH OPPONENT'S OWN SEPARATION**, so nobody is dragged THROUGH the
    // bait and out the far side. Un-clamped, a fighter standing 10 wu away would be yanked
    // 32 wu past it and a second application would yank it back — an oscillation that reads
    // on screen as the controls fighting the player.
    const ax = target.x;
    const ay = target.y;
    for (const victim of state.fighters) {
      if (!isLivingOpponentOf(victim, attacker)) continue;
      const dx = ax - victim.x;
      const dy = ay - victim.y;
      const sep = Math.hypot(dx, dy);
      displaceFighter(victim, dx, dy, lure < sep ? lure : sep);
    }
  }
}

/* ═══════════════════════════════════════════════════════════════════════════
   LOADOUT ITEMS — the pieces `applyDamage` needs. See the ITEM ACTIVATION block
   further down for the press half.
   ═══════════════════════════════════════════════════════════════════════════ */

/**
 * THE DAMAGE SOURCE FOR AN ITEM'S OWN DAMAGE, BUILT IN ONE PLACE.
 *
 * Two callers — Blue Cheese's cloud in `sim.ts:applyWorldTick`, and Shiitake's reflection a
 * few hundred lines below — and one shape, because `state.ts:DamageSource`'s header records
 * three separate rules that key on `itemId` being present (no level scaling, no Tenderiser
 * streak, no re-reflection). A source assembled at each site is two chances to omit the
 * field that turns all three off, and the failure would be silent in every direction: a
 * reflect that scales with level, a cloud that builds a streak, a mirror that rings.
 *
 * `weaponKey` carries the ITEM ID and `weaponName` its display name, so the four out-of-set
 * consumers that look a `Weapon` up by key MISS and fall back to their generic path — see
 * `DamageSource`. §42 asserts no item id can collide with a weapon key.
 */
export function itemDamageSource(owner: Fighter, itemId: ItemId): DamageSource {
  return {
    kind: 'weapon',
    weaponKey: itemId,
    weaponName: ITEMS[itemId].name,
    attackerId: owner.id,
    itemId,
  };
}

/**
 * ── TENDERISER: HOW MUCH HARDER THIS HIT LANDS, AND WHY THE STREAK IS THE ATTACKER'S ──
 *
 * Uri: *"Stacking up damage — each consecutive attack on the same character increases the
 * damage by 1.3 up to x6 time (6x1.3)"*.
 *
 * 🔴 **TWO THINGS IN THAT SENTENCE ARE READINGS, NOT FACTS, AND BOTH ARE PARKED FOR URI IN
 * `docs/ITEMS.md`. THEY ARE STATED HERE BECAUSE THIS IS WHERE THEY ARE IMPLEMENTED:**
 *
 *   1. **"up to x6 time (6x1.3)"** is read as SIX COMPOUNDING APPLICATIONS —
 *      `1.3^6 = 4.827x` — and not as `6 x 1.3 = 7.8x` flat. It is the smaller of the two and
 *      the one that makes "x6 time" a stack COUNT. `rules.ts:ITEM_TUNING.tenderiser` holds
 *      both numbers; §41(f) pins the ceiling.
 *   2. **WHAT BREAKS A STREAK IS NOT IN HIS SENTENCE AT ALL, AND ONE IS STRUCTURALLY
 *      REQUIRED** — without it a stack laid at second ten is still live at the death of the
 *      match. Two breakers, and both are the plain reading of "consecutive":
 *        * **HITTING SOMEBODY ELSE.** The streak names one target; landing on another is not
 *          a consecutive hit on the first one, so the count restarts on the new victim.
 *        * **A LAPSE OF `ITEM_TUNING.tenderiser.decayMs`** (one Super floor, 2,500 ms) since
 *          the last hit that fed it. Silence ends a streak.
 *      ⚠️ **BEING HIT DOES NOT BREAK IT**, deliberately: "consecutive attack" is a statement
 *      about the sequence of attacks the HOLDER makes, and a defensive breaker would make an
 *      offensive item depend on what everyone else is doing.
 *
 * The first hit is unmultiplied — `stackMul ** 0` — and the Nth consecutive hit carries
 * `stackMul ** min(N-1, maxStacks)`, so the ceiling is reached on hit 7 and held. That is
 * what makes `1.3^6` the CAP rather than the value of the sixth hit.
 *
 * ⚠️ **READ BEFORE WRITE, AND THE TWO HALVES ARE SEPARATE FUNCTIONS FOR THAT REASON.** The
 * multiplier this hit gets is a function of the streak BEFORE it; folding the update into
 * the same expression is how the first hit ends up already multiplied.
 */
function tenderiserMultiplier(attacker: Fighter, target: Fighter, elapsed: number): number {
  const st = attacker.item;
  if (st.streakTarget !== target.id) return 1;
  if (elapsed - st.streakAt >= ITEM_TUNING.tenderiser.decayMs) return 1;
  const stacks = st.streakCount < ITEM_TUNING.tenderiser.maxStacks
    ? st.streakCount
    : ITEM_TUNING.tenderiser.maxStacks;
  return ITEM_TUNING.tenderiser.stackMul ** stacks;
}

/** Record that a hit landed on `target`, extending or restarting the streak. See above. */
function feedTenderiserStreak(attacker: Fighter, target: Fighter, elapsed: number): number {
  const st = attacker.item;
  const continues = st.streakTarget === target.id
    && elapsed - st.streakAt < ITEM_TUNING.tenderiser.decayMs;
  // Clamped at the cap on the way IN, so the stored count cannot run away over a long fight
  // and the number an event publishes is the number the multiplier actually used.
  st.streakCount = continues
    ? Math.min(st.streakCount + 1, ITEM_TUNING.tenderiser.maxStacks)
    : 1;
  st.streakTarget = target.id;
  st.streakAt = elapsed;
  return st.streakCount;
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
  //
  // ── ⚠️ AND AN ITEM'S OWN DAMAGE IS NOT ON THE CHARACTER LADDER AT ALL ─────
  //
  // `source.itemId` is set for exactly two things: Blue Cheese's cloud and Shiitake's
  // reflection (`itemDamageSource`). Neither is a rung of the character's kit — the cloud's
  // `dps` is the roster's floor unit and the mirror's `reflect` is **1.0**, Uri's *"damage
  // on EVERY damage they do"*, which a level-15 wearer returning 1.70x would not be. The
  // whole argument is on `state.ts:DamageSource`.
  const isItemDamage = source.kind === 'weapon' && source.itemId !== undefined;
  const attacker = source.kind === 'weapon' ? state.fighters[source.attackerId]
    : source.kind === 'trail' ? state.fighters[source.ownerId]
    : null;
  // ── TENDERISER, AT THE SAME SINGLE CHOKE POINT THE LEVEL TERM USES ────────
  //
  // Uri's item, and it multiplies the number the victim actually loses — so it is here,
  // beside `damageMul`, for the reason that block gives at length: five damage call sites,
  // and a multiplier applied at four of them is a silent balance bug in the fifth.
  //
  // 🚨 **THE GUARD IS WHAT MAKES IT INERT, AND THE SHAPE OF THE ARITHMETIC IS WHAT MAKES IT
  // BIT-IDENTICAL.** `stackMul` is exactly `1` for every fighter that did not equip the item
  // — which is every fighter every existing caller of `createMatch` builds — and the `!== 1`
  // guard means the `dealt` line those matches execute is the line that was here before,
  // character for character. Writing `amount * damageMul * stackMul` instead would have been
  // arithmetically identical in exact reals and NOT in IEEE-754 doubles, which is the
  // difference between a bit-identity proof and a nearly-identical one.
  //
  // ⚠️ **WEAPON HITS ONLY, AND NOT AN ITEM'S OWN DAMAGE.** The trail is a mark you tread on
  // rather than an attack, the hazard and the fog have no attacker, and a cloud that fed the
  // streak would build six stacks by standing still. *"Each consecutive ATTACK"*.
  const streaks = attacker != null && !isItemDamage && source.kind === 'weapon'
    && attacker !== target && hasItem(attacker, 'tenderiser');
  const stackMul = streaks ? tenderiserMultiplier(attacker as Fighter, target, state.elapsed) : 1;
  let dealt = attacker && !isItemDamage ? amount * attacker.damageMul : amount;
  if (stackMul !== 1) dealt *= stackMul;
  // Read, THEN write — see `tenderiserMultiplier`. The count this returns is the one the
  // NEXT hit will use and the one the VFX layer draws, which is why it is published rather
  // than left to be re-derived from a field the renderer would have to poll.
  const stacks = streaks ? feedTenderiserStreak(attacker as Fighter, target, state.elapsed) : 0;

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

  // ── EVERY AUTHORED HIT CARRIES WEIGHT — see `applyHitDisplacement` above ───
  //
  // HERE, because this is the single choke point the level multiplier's block above makes
  // the same argument for: five damage call sites, three of them weapon hits, and a
  // displacement applied at two of the three is a silent balance bug in the third.
  //
  // ⚠️ ABOVE the `hit-landed` push and ABOVE the death block, and both matter. Above the
  // event because the anchor a `lure` uses IS the `x`/`y` that event publishes, and the two
  // must not be able to disagree; above the death block because `combat.ts`'s three
  // terminators own everything under it and `conceal_lab --selftest`'s event-order known-bad
  // anchors on three literal lines there (see `target.deaths++`). Nothing is inserted
  // between them.
  //
  // ⚠️ INERT FOR 29 OF THE ROSTER'S 33 WEAPONS. `knockback`/`lure`/`selfLaunch` are absent
  // on all but four, absence is `?? 0`, and `displaceFighter` refuses a non-positive
  // distance — so `Fighter.push` is never written and the sim is bit-identical to the one
  // before this existed. §39(g) proves that on a real match instead of asserting it here.
  // ⚠️ `!isItemDamage` is stated rather than left to the lookup. An item source carries the
  // ITEM ID in `weaponKey`, so `find` would miss and displace nobody anyway — but relying on
  // a miss is relying on two id namespaces never colliding, and "they never collide" is a
  // claim about people. §42 asserts the namespaces are disjoint AND this line refuses.
  if (attacker != null && source.kind === 'weapon' && !isItemDamage) {
    const w = CHARACTERS[attacker.characterId].weapons.find((x) => x.key === source.weaponKey);
    if (w !== undefined) applyHitDisplacement(state, attacker, target, w);
  }

  // `amount` on the event is what the target actually LOST, not what the weapon table
  // says — otherwise the floating damage number and the health bar would disagree by the
  // level multiplier, which is precisely the class of defect (`DECISIONS §13`) where a
  // screen shows a number the model does not compute. `hud.ts` already rounds it for
  // display and `setBar` already ceils HP, so a continuous term needs nothing downstream.
  events.push({ type: 'hit-landed', targetRole: target.role, targetId: target.id, amount: dealt, effect, source, x: target.x, y: target.y });

  // ── THE STACK, PUBLISHED, BECAUSE THE COUNT *IS* THE MECHANIC ─────────────
  //
  // `ITEMS.tenderiser.look`: *"a short compression ring on the VICTIM … brightening per
  // stack so the sixth is unmistakable — the stack count is the whole mechanic and it must
  // be readable at the match camera."* A renderer cannot get that off `hit-landed`, whose
  // `amount` conflates the stack with the weapon, the level and the trail boost; and polling
  // `attacker.item.streakCount` would read a value that has already moved on by the time the
  // frame draws. So the count that priced THIS hit rides with it.
  //
  // ⚠️ AFTER `hit-landed` and never before it: the hit is the fact, the stack is a
  // qualifier on it, and a consumer that reads them in order sees the damage first.
  if (stacks > 0 && attacker != null) {
    events.push({
      type: 'item-hit', itemId: 'tenderiser',
      ownerRole: attacker.role, ownerId: attacker.id,
      targetRole: target.role, targetId: target.id,
      durationMs: ITEM_TUNING.tenderiser.decayMs, stacks,
      fromX: target.x, fromY: target.y, x: target.x, y: target.y,
    });
  }

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
    // ── WHO KILLED YOU — RECORDED AT THE INSTANT, BECAUSE IT IS NOT RECOVERABLE LATER ──
    //
    // `ITEMS.leftovers` — Uri: *"If someone kills you and than he dies (not the last in the
    // game) that causes you to resurrect."*
    //
    // 🚨 **THE DEATH ORDER LIVES IN THE EVENT STREAM, NOT IN THE FINAL STATE.** Every loser
    // ends `alive: false, hp: 0` and is bit-identical to every other loser, so "who killed
    // me" cannot be reconstructed from a `MatchState` at all — an orchestrator claim to the
    // contrary was falsified once already. This function is the only place in the sim that
    // holds both the `DamageSource` and the death, so it is the only place the answer
    // exists. Written for EVERY death, whether or not the victim brought the item: a field
    // populated only for equipped fighters is a field whose correctness nobody exercises,
    // and it costs one assignment.
    //
    // ⚠️ Only a fighter can be a killer. The fog, the pot and a trail mark whose owner is
    // gone are not *"someone"*, so they leave `NO_FIGHTER` and no resurrection is owed —
    // which also means a fighter the ring killed can never come back, and that is the
    // reading of Uri's sentence rather than an omission.
    target.item.killerId = attacker != null && attacker !== target ? attacker.id : NO_FIGHTER;
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
    // TERMINATOR 3's twin: an item wind-up dies with its owner, on the same argument and in
    // the same place, so a corpse can never hold either kind of open commitment.
    if (target.itemCast !== null) {
      cancelItemCast(target, 'death', events);
    }
    // ── THE BODY DROPS ITS KITS ───────────────────────────────────────────────
    //
    // BELOW every terminator and ABOVE the victor block, and both edges are deliberate.
    // Below the terminators because they own the corpse's own bookkeeping and this is a
    // statement about the WORLD, not about the fighter. Above the victor block because
    // `match-ended` should stay the last event of the tick it fires on — several consumers
    // read it as a terminator of the stream, and `medikit-dropped` arriving after it would
    // make the death that ended the match the one death whose kits are announced out of
    // order.
    //
    // ⚠️ UNGATED ON PHASE, matching the `death` event immediately above it: a kit dropped by
    // a final knockout is drawn, is never collectable (`sim.ts:stepMedikits` runs only while
    // `playing`), and expires. Gating it here would make the last body in a match the one
    // body that leaves nothing behind, which reads on screen as a bug.
    dropMedikits(state, target, events);
    // ── LEFTOVERS: WHOEVER THIS FIGHTER KILLED MAY NOW GET UP ─────────────────
    //
    // BELOW the kits and ABOVE the victor block, and both edges decide behaviour rather
    // than reading order. Below the kits because a resurrection is a statement about
    // somebody ELSE and the corpse's own bookkeeping comes first. Above the victor block
    // because a fighter who stands back up is not a corpse the match can be won over —
    // `lastFighterStanding` must count them.
    //
    // ⚠️ **THAT ORDERING IS SAFE RATHER THAN LUCKY, AND IT IS AN ARITHMETIC FACT.** The gate
    // below is `livingFighterCount >= ITEM_TUNING.leftovers.minAliveAfterKillerDies` (2), and
    // two or more standing is exactly the condition under which `lastFighterStanding` returns
    // `null`. So on every tick a resurrection fires, the victor block was going to decide
    // nothing anyway; and on every tick the victor block decides something, the gate has
    // already refused. The two can never disagree — which is Uri's *"(not the last in the
    // game)"* falling out of the count rather than being enforced twice.
    //
    // ⚠️ 🚨 **AND IT IS STRUCTURALLY INVISIBLE AT TWO SEATS.** It needs a killer who then
    // dies WHILE THE MATCH CONTINUES, and at N=2 the killer's death is the end of the match
    // by construction. The 110-cell two-seat corpus every balance number in this repo rests
    // on cannot see one line of this — `docs/ITEMS.md` says so, and §42 drives it at N=6.
    reviveThoseKilledBy(state, target, events);
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

  // ── SHIITAKE SHIELD: WHAT THE ATTACKER TAKES BACK ─────────────────────────
  //
  // Uri: *"it created a fungas shield arround the character causing the enemies attacking
  // him get damage on every damage they do."* Every point, not a fraction —
  // `ITEM_TUNING.shiitake.reflect` is 1.0 and is applied to `dealt`, the number the victim
  // ACTUALLY lost, so the mirror cannot disagree with the health bar it is mirroring.
  //
  // 🚨 **LAST IN THE FUNCTION, AFTER THE VICTIM'S ENTIRE DEATH BLOCK, AND THAT IS AN EVENT
  // ORDER DECISION.** A reflection can kill the attacker, and `applyDamage` is re-entered to
  // do it — so the stream reads: the victim's `hit-landed`, the victim's death and kits, and
  // only then the attacker's `hit-landed` and its own death. Reflecting earlier would
  // interleave two fighters' death sequences inside one call and no consumer could tell
  // which corpse a `medikit-dropped` belonged to without tracking the recursion depth.
  //
  // 🚨 **AND IT TERMINATES AT EXACTLY ONE BOUNCE, BY CONSTRUCTION RATHER THAN BY A DEPTH
  // COUNTER.** The reflected damage carries `itemDamageSource`, whose `itemId` is set;
  // `isItemDamage` is therefore true on re-entry and this block is not reached again. Two
  // shielded fighters hitting each other resolve in one level. §42 plants exactly that —
  // both shields up, both hitting — and asserts the call does not recur.
  //
  // ⚠️ **A HIT FROM A LOADOUT ITEM DOES NOT REFLECT**, which is the same clause doing the
  // same job for a different reason: a cloud you are standing in is not an attacker
  // "attacking him", and a mirror that bounced a mirror would be the recursion above.
  //
  // ⚠️ **THE SHIELD DOES NOT REDUCE THE INCOMING HIT.** Uri described a retaliation, not
  // armour, and reading it as damage reduction would be inventing a second effect he did
  // not ask for. The wearer takes the blow and the attacker takes it too.
  if (!isItemDamage && source.kind === 'weapon' && attacker != null && attacker !== target
      && dealt > 0 && state.elapsed < target.item.shieldUntil) {
    applyDamage(
      state, attacker, dealt * ITEM_TUNING.shiitake.reflect, null,
      itemDamageSource(target, 'shiitake'), events,
    );
  }
}

/**
 * ── LEFTOVERS, RESOLVED: EVERYONE `killer` PUT DOWN GETS UP ──────────────────
 *
 * Called from the death block above, with the fighter that has just died. Uri: *"If someone
 * kills you and than he dies (not the last in the game) that causes you to resurrect. Works
 * once per match."*
 *
 * ── THE FOUR CONDITIONS, AND WHERE EACH ONE COMES FROM ──────────────────────
 *
 *   1. **`revivesLeft > 0`** — one comparison that answers BOTH "did they equip it" and "have
 *      they used it", because `createFighter` seeds the counter to zero for anyone who did
 *      not bring the item. Two separate tests could disagree; one cannot.
 *   2. **`item.killerId === killer.id`** — recorded at the kill by `applyDamage`, because it
 *      is not recoverable from a final state (see the note there).
 *   3. **Still down.** A fighter already back on its feet is not resurrected again, and this
 *      also covers the ordinary case where the corpse is somebody the killer never killed.
 *   4. **`livingFighterCount(state) >= minAliveAfterKillerDies`** — Uri's *"(not the last in
 *      the game)"*, counted AFTER the killer fell and BEFORE anyone stands up, so a
 *      resurrection can never happen into a match that is already decided.
 *
 * ⚠️ **SLOT ORDER, AND DETERMINISM DEPENDS ON IT.** Two fighters can share a killer, so two
 * can rise on one tick; `state.fighters` is the sim's one iteration order (see
 * `MatchState.fighters`), which makes "who stood up first" a pure function of
 * `createMatch`'s arguments. The living count is read ONCE, before the loop, so the second
 * resurrection cannot be authorised by the first one — otherwise the rule would silently
 * become "the first revive is gated, the rest are free".
 *
 * ── WHAT COMING BACK MEANS, STATED RATHER THAN INHERITED ────────────────────
 *
 * `ITEM_TUNING.leftovers.hp` — *"one corpse's worth of medikits"* — and **where the body
 * fell**, which is a standable point by proof rather than by argument: a fighter was
 * standing on it one tick ago (the same reasoning `dropMedikits` uses for its fallback).
 *
 * Every lock and every accumulator is cleared, and that list is a decision, not tidiness: a
 * fighter that came back stunned, slept, rooted, mid-fog-tick or owing a knockback from
 * where its body used to lie would be answering for a life it is no longer living. What is
 * NOT cleared is `deaths` — the count is the record that this happened, and
 * `sim.ts:resolveTimeout`'s rung 3 is *"fewest deaths"*.
 *
 * 🚨 **AND THAT RUNG STOPS BEING INERT TODAY.** Its own doc says it *"is a rung that becomes
 * LOAD-BEARING the day respawns exist, and a counter is the only shape that survives that
 * day; a `f.alive ? 0 : 1` derivation would have been a restatement of rung 1 forever."*
 * This is that day: a resurrected fighter is alive with `deaths === 1`, so a timeout can now
 * separate two survivors on it. The prediction was written before the quantity had a second
 * reader, and it held.
 */
function reviveThoseKilledBy(state: MatchState, killer: Fighter, events: GameEvent[]): void {
  const living = livingFighterCount(state);
  if (living < ITEM_TUNING.leftovers.minAliveAfterKillerDies) return;
  for (const f of state.fighters) {
    if (f.item.revivesLeft <= 0) continue;
    if (f.item.killerId !== killer.id) continue;
    if (f.alive || f.hp > 0) continue;
    f.item.revivesLeft--;
    f.item.killerId = NO_FIGHTER;
    f.alive = true;
    f.hp = Math.min(f.maxHp, ITEM_TUNING.leftovers.hp);
    // Every deadline back to "never", every accumulator back to its identity. See above.
    f.status.slowedUntil = -Infinity;
    f.status.stunnedUntil = -Infinity;
    f.item.sleepUntil = -Infinity;
    f.item.clogUntil = -Infinity;
    f.item.rootUntil = -Infinity;
    f.item.blotUntil = -Infinity;
    f.item.shieldUntil = -Infinity;
    f.push.x = 0;
    f.push.y = 0;
    f.push.remaining = 0;
    f.push.speed = 0;
    f.fogTimer = 0;
    f.regenTimer = 0;
    f.hazardTimers.length = 0;
    // The regen delay starts now rather than from whenever the body last took a hit, so
    // coming back does not immediately tick health up out of a corpse's stale timestamp.
    f.lastDamagedAt = state.elapsed;
    events.push({
      type: 'item-revived',
      fighterRole: f.role, fighterId: f.id,
      killerRole: killer.role, killerId: killer.id,
      hp: f.hp, x: f.x, y: f.y,
    });
  }
}

/**
 * ── THE POP. `MEDIKIT.count` KITS OUT OF ONE BODY, COMPUTED ──────────────────
 *
 * Called from the death block above, once per death, and it is the ONLY place a medikit is
 * created. `rules.ts:MEDIKIT` carries every number and the whole design argument; this
 * function is the geometry.
 *
 * 🚨 **THERE IS NO ROLL HERE AND THERE CANNOT BE ONE.** `rules.ts` records the rule under
 * CONCEALMENT — *"NO ROLL. NOT NEGOTIABLE"* — and it is not a preference:
 * `grep -rn 'Math.random' src/game/{sim,state,combat,ai,movement}.ts` returns NOTHING, and
 * the sim carries no seeded generator either. The "seeds" every paired balance delta in this
 * repo is measured on belong to `tools/tmp/scripted_player.mjs`, the DRIVER. So a scattered
 * drop is not a thing this simulation can express, and the fan below is what replaces it:
 *
 *   * `count` bearings **evenly spaced around the full circle**, so no direction is
 *     favoured and no fighter gains from where the body happened to fall;
 *   * **phase-locked to the victim's own `facing`**, which is a fact about the fighter that
 *     died rather than about whoever killed it, and is a unit vector for the whole life of a
 *     match by construction (`ai.ts:hasBearing`, `sim.ts:applyAim` — both refuse to write a
 *     zero one, and `createFighter` seeds one);
 *   * at `MEDIKIT.popDistance`, so with the shipped `count: 2` the pair straddles the corpse
 *     `2 × 70 = 140 wu` apart — exactly `REACH.rangedMax`.
 *
 * ⚠️ **THE FALLBACK MATTERS MORE THAN IT LOOKS.** A bearing can put a kit inside a crate or
 * through a wall, and a kit nobody can reach is worse than no kit — it is a promise on
 * screen the game will not keep. Both are answered by falling back to the DEATH POINT, which
 * is standable by proof rather than by argument: a fighter was standing on it one tick ago.
 * (Two kits can therefore land on the same spot in a tight corner. Deterministic, rare, and
 * the honest outcome — you got both because there was nowhere for the second one to go.)
 */
function dropMedikits(state: MatchState, victim: Fighter, events: GameEvent[]): void {
  const base = Math.atan2(victim.facing.y, victim.facing.x);
  const r = MEDIKIT.pickupRadius;
  for (let i = 0; i < MEDIKIT.count; i++) {
    const angle = base + (i * 2 * Math.PI) / MEDIKIT.count;
    // Clamp into the arena FIRST, then test cover on the clamped point — the other order
    // would test a point the kit is not going to end up on.
    let x = Math.min(state.arena.width - r, Math.max(r, victim.x + Math.cos(angle) * MEDIKIT.popDistance));
    let y = Math.min(state.arena.height - r, Math.max(r, victim.y + Math.sin(angle) * MEDIKIT.popDistance));
    // The kit as an `r × r` box against `arena.cover`, i.e. the same predicate
    // `movement.ts:collidesWithCover` runs for a fighter, through the exported primitive it
    // is built out of. `collidesWithCover` itself is module-private; `boxesOverlap` is the
    // shared rule, and calling it here rather than re-deriving the AABB test is the same
    // choice `terrainSlowAt` records — one implementation, several callers.
    for (const box of state.arena.cover) {
      if (boxesOverlap(x, y, r, r, box.x, box.y, box.w, box.h)) { x = victim.x; y = victim.y; break; }
    }
    const kit: Medikit = {
      id: state.nextId++,
      sourceId: victim.id,
      x, y,
      fromX: victim.x,
      fromY: victim.y,
      armsAt: state.elapsed + MEDIKIT.popMs,
      expiresAt: state.elapsed + MEDIKIT.popMs + MEDIKIT.durationMs,
    };
    state.medikits.push(kit);
    events.push({
      type: 'medikit-dropped', id: kit.id,
      sourceRole: victim.role, sourceId: victim.id,
      fromX: kit.fromX, fromY: kit.fromY,
      x: kit.x, y: kit.y,
      popMs: MEDIKIT.popMs,
    });
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
  const delivered = deliverWeapon(state, attacker, w, events);

  // ── SELF-LAUNCH — `rules.ts:Weapon.selfLaunch` ─────────────────────────────
  //
  // 🔴 **A LAUNCH NEVER EXTENDS THE REACH OF ITS OWN WEAPON**, which is what keeps it out of
  // `DECISIONS §80` — Uri's answer that a super must be dodgeable, whose lever 1 is to SHRINK
  // the effect radius. `waterbottle.Mega` authors a launch and is the one weapon in the game
  // whose dodgeability is a standing acceptance test (`tools/tmp/lk_dodge.mjs`,
  // `kt_bearing.mjs`), so a launch that added 42 wu to `REACH.meleeHeavy` would be a radius
  // increase hidden in a field nobody reads as a reach. `sim.test.mjs` §39(h) bisects the real
  // hit/miss boundary and requires it to sit exactly on `range`.
  //
  // ⚠️ **AND THE GUARANTEE IS THE DEFERRAL, NOT THE STATEMENT ORDER. THIS COMMENT CLAIMED THE
  // OPPOSITE AND THE CLAIM WAS FALSE — THE OLD WORDING IS KEPT BECAUSE IT IS THE INSTRUCTIVE
  // HALF.** It read: *"AFTER `deliverWeapon`, SO a launch can never extend the reach … §39(h)
  // shows the row red when the order is swapped."* It does not: `displaceFighter` only WRITES
  // `Fighter.push`, and `deliverWeapon` reads `attacker.x`/`y`, which no queued displacement
  // has moved yet — **so swapping these two statements is behaviourally a NO-OP and §39(h)
  // would stay green.** What actually protects the reach is that displacement is spent by
  // `sim.ts`'s loop on LATER ticks, never inside the tick that queued it. The order is kept as
  // defence in depth against a future edit that made displacement instantaneous, and because
  // it is the honest reading of both cards — it is not the thing doing the work. Caught by
  // asking §39(h) what implementation would fail it, which is `CLAUDE.md` #6 exactly.
  //
  // ⚠️ IT FIRES WHETHER OR NOT THE SWING CONNECTED, on the line this function has always
  // drawn: "too far", "wrong direction" and "target already dead" all still consume the
  // press. *"Launches herself at the enemy"* is a leap, and a leap that missed still happened.
  //
  // ⚠️ ALONG THE CASTER'S OWN `facing`, WHICH FOR A CAST WEAPON IS FROZEN AT THE PRESS
  // (`state.ts:ActiveCast`). So the launch runs down the bearing the telegraph was drawn on,
  // and it cannot be steered mid-wind-up to land somewhere the player was not shown.
  //
  // ⚠️ ONE SITE, REACHED BY BOTH PATHS — `attemptAttack` for a castless tackle and
  // `resolveDueCast` for a 1,400 ms slam — for the reason this function exists at all: a
  // rule stated on the press path and on the resolve path would be two implementations of
  // one resolution rule.
  const launch = w.selfLaunch ?? 0;
  if (launch > 0) displaceFighter(attacker, attacker.facing.x, attacker.facing.y, launch);

  return delivered;
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
 * on cooldown, or a SECOND wind-up while one is already running) — everything else (too far, wrong facing
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
 * 🚨 **A FIGHTER MID-CAST CANNOT OPEN A SECOND CAST. IT MAY PRESS EVERYTHING ELSE.**
 *
 * ⚠️ **THIS PARAGRAPH IS REVERSED AND THE OLD WORDING IS KEPT, because it is the sentence
 * `DECISIONS §78` overturned.** It read, verbatim:
 *
 *   > *"🚨 **A FIGHTER MID-CAST CANNOT PRESS ANYTHING.** Without that gate a caster could
 *   > stack a second cast over the first (the second press would overwrite `cast` and the
 *   > first weapon's cooldown would be spent on nothing) or interleave a cheap ranged shot
 *   > into a window it has committed to standing still in. One `ActiveCast` per fighter,
 *   > and the refusal is stated once, here, for the human and the AI alike — they share
 *   > this function precisely so the two sides cannot play by different rules."*
 *
 * **Half of that survives and is now the whole rule: one `ActiveCast` per fighter.** The
 * other half — "or interleave a cheap ranged shot" — was the *lockout*, and Uri's answer
 * on 2026-08-18 is that **a wind-up costs POSITION, not SILENCE**: the root and the frozen
 * aim stay (they are what make the telegraph tell the truth about where the effect lands,
 * and the arm run to confirm the opposite story REFUTED it — removing the root costs its
 * owner 6.6 pp), and the attack lockout goes. See the gate below for what that measured.
 *
 * The refusal is still stated once, here, for the human and the AI alike — they share this
 * function precisely so the two sides cannot play by different rules.
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
  const castMs = w.castMs ?? 0;

  // ── 🚨 POMPA CLOGS THE WEAPON, AND WARM MILK STOPS THE TURN ────────────────
  //
  // Uri: *"pompa — clogs their weapons for 5 secons"* and *"You can put someone to sleep"*.
  // `state.ts:weaponsLocked` is the one statement of both, and it is asked HERE — in the
  // function the human and the AI share — for the reason this file's header gives: the
  // recorded stun-silence defect was one rule stated on one side of a `controller` branch,
  // where the stunned player fired 100% of its shots and the stunned bot fired 0%. A clog
  // enforced in `sim.ts` alone would be that defect rebuilt, exactly.
  //
  // ⚠️ **ABOVE THE COOLDOWN STAMP, SO A REFUSED PRESS COSTS NOTHING.** The line this
  // function has always drawn is that a press which was ATTEMPTED is spent — "too far",
  // "wrong direction", "target already dead". A clogged weapon was never attempted; the
  // plunger is in the way. Refusing after the stamp would have made Pompa silently steal
  // five seconds of cooldown as well as five seconds of fire, i.e. two effects from one
  // sentence.
  //
  // ⚠️ **IT DOES NOT TOUCH A WIND-UP ALREADY OPEN.** A clog stops you STARTING something;
  // `resolveDueCast` is a commitment already paid for. Sleep is different and says so
  // separately — it cancels, through `cancelCast`, because a sleeping fighter is not
  // finishing anything.
  if (weaponsLocked(attacker, now)) return false;

  // ── 🚨 THE SECOND-CAST GATE. IT USED TO BE THE ATTACK LOCKOUT. ──────────────
  //
  // It still sits ABOVE the cooldown gate deliberately: "am I already committed to a
  // wind-up" is a wider question than "is THIS slot ready", and asking the narrower one
  // first would let a second weapon's ready cooldown answer the wider one. A press this
  // line refuses consumes nothing — `lastUsed` is stamped below it — which is what stops a
  // refused second press from laundering the first cast's cooldown.
  //
  // IT USED TO READ, and this is the term `DECISIONS §78` removed:
  //
  //   > `if (attacker.cast !== null) return false;`
  //
  // ── WHY THE OLD LINE WAS THERE, AND WHAT OF IT SURVIVES ────────────────────
  //
  // Two refusals were bundled into one comparison:
  //
  //   1. **NO SECOND CAST.** A second press would overwrite `cast`, and the first weapon's
  //      cooldown — already stamped — would be spent on a wind-up that never resolved.
  //      **This half is kept**, and it is why the test is `&& castMs > 0` rather than a
  //      deletion. It also refuses re-pressing the SAME ultimate mid-cast, which would be a
  //      free reset of `resolvesAt` on a weapon whose whole cost is the wait.
  //   2. **NO OTHER WEAPON EITHER** — the attack lockout. **This half is gone.**
  //
  // ── WHAT THE LOCKOUT COST, MEASURED BEFORE IT WAS REMOVED ──────────────────
  //
  // 2026-08-18 (`DECISIONS §78`), three single-variable ablations at `a06c0fd`,
  // `Mega` held at 1100 throughout, `roster_lab --seeds 32` = 3,520 paired matches:
  //
  //     term removed      site                        waterbottle (smart2)
  //     -- (shipped)      --                                9.8%
  //     ATTACK LOCKOUT    this line                        29.5%   +19.7
  //     FROZEN AIM        sim.ts:applyAim + ai.ts          10.5%    +0.6
  //     MOVEMENT ROOT     state.ts:movementLocked           3.3%    -6.6
  //
  // The obvious story — "the cost is the root" — is FALSE: an unrooted caster walks off its
  // own frozen bearing and misses. **The root and the frozen aim stay.** A super is a
  // commitment of POSITION, not a period of SILENCE.
  //
  // ⚠️ **AND THE PRICE IS REAL AND IS NOT HIDDEN HERE.** The same arm that buys the
  // +19.7 pp lets Water Bottle spend its own wind-up applying `slow` and `stun`, which is
  // the counterplay the telegraph exists for. `sim.test.mjs` §33(p) measures exactly that
  // — the dodge under a caster that is now shooting back — and is the row to read before
  // anyone concludes this was free.
  if (attacker.cast !== null && castMs > 0) return false;
  if (now - attacker.lastUsed[weaponIndex] < w.cooldown) return false;
  attacker.lastUsed[weaponIndex] = now;

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
    // ── 🚨 A SWING HITS EVERY OPPONENT INSIDE ITS ARC, NOT THE NEAREST ONE ────
    //
    // IT USED TO READ, and the whole branch below resolved against this one fighter:
    //
    //   > `const toTargetX = target.x - attacker.x;` … `applyDamage(state, target, …)`
    //
    // **AT TWO SEATS THAT IS THE SAME SENTENCE AND THE BUG CANNOT EXPRESS ITSELF.**
    // `nearestLivingOpponent` returns the only opponent there is, so "hit the nearest" and
    // "hit everyone in the arc" name the identical fighter and emit the identical events.
    // `MAX_FIGHTERS` is 6, Uri plays six-player, and above two seats the two sentences come
    // apart: `lollipop.Giant` is `cone: 360`, `range: 400`, `giantSlam: true` and its card
    // promises *"hits the whole map, making everyone dizzy"* — it hit exactly one fighter.
    // Same class as the four other six-seat defects this repo has already paid for (the
    // result card, corpse input, shake proximity, the seat-order bug): correct at N=2,
    // silent at N=6, invisible to every N=2 instrument in the tree.
    //
    // ⚠️ **THE GEOMETRY IS UNCHANGED, LINE FOR LINE — ONLY THE VICTIM SET GREW.** Range
    // test, coincident-epsilon test and cone test are the same three comparisons in the
    // same order against the same frozen `facing`; `return true` became `continue` so a
    // miss on one opponent stops rejecting the swing for all of them. That is what makes
    // the N=2 stream bit-identical rather than merely equivalent, and `sim.test.mjs`
    // §35(a) asserts the bit-identity over a real match rather than reasoning about it.
    //
    // ⚠️ **SLOT ORDER, AND DETERMINISM DEPENDS ON IT.** `state.fighters` is the sim's one
    // iteration order (see `MatchState.fighters`); resolving victims in it makes "who was
    // stunned first" a pure function of `createMatch`'s arguments. A distance sort would be
    // a second ordering rule, and ties in it would be decided by `Array.prototype.sort`.
    //
    // ⚠️ **THE LOOP DOES NOT STOP WHEN THE MATCH ENDS MID-SWING, DELIBERATELY.** One swing
    // is one instant: every fighter inside the arc is hit by it, and `applyDamage`'s own
    // `phase === 'playing'` gate already stops a second `match-ended` from being emitted
    // (and its `!target.alive` guard stops a corpse being hit twice). Breaking out would
    // make the last two victims' fate depend on their slot index, which is the unearned
    // seat advantage `nearestLivingOpponent`'s "nearest, not lowest slot" rule exists to
    // refuse.
    //
    // ⚠️ **NO NEW `rules.ts` FIELD, AND THAT WAS CHECKED RATHER THAN ASSUMED.** `cone` and
    // `range` already say exactly which ground a swing threatens; a `multiTarget` flag would
    // be a second statement of the same geometry, and the first weapon whose flag and cone
    // disagreed would be a silent balance bug. `giantSlam` stays what its own vocabulary
    // entry says it is — a map-scale VISUAL — and is read by nothing here.
    const cone = w.cone ?? 360;
    const range = w.range ?? 0;

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
    for (const victim of state.fighters) {
      if (!isLivingOpponentOf(victim, attacker)) continue;
      const toVictimX = victim.x - attacker.x;
      const toVictimY = victim.y - attacker.y;
      const dist = Math.hypot(toVictimX, toVictimY);
      if (dist > range) continue; // "too far"

      if (cone < 360) {
        if (dist < MELEE_COINCIDENT_EPS) continue; // "coincident: no bearing to swing along"
        const dot = (attacker.facing.x * toVictimX + attacker.facing.y * toVictimY) / dist;
        const angleTo = Math.acos(Math.max(-1, Math.min(1, dot))) * RAD2DEG;
        if (angleTo > cone / 2) continue; // "wrong direction"
      }

      applyDamage(state, victim, w.damage, w.effect, { kind: 'weapon', weaponKey: w.key, weaponName: w.name, attackerId: attacker.id }, events);
    }
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

/* ═══════════════════════════════════════════════════════════════════════════
   ITEM ACTIVATION — the press half, and the ten effects
   ═══════════════════════════════════════════════════════════════════════════

   `rules.ts:ITEMS` is the registry, `rules.ts:ITEM_TUNING` every number,
   `docs/ITEMS.md` the contract. This block is what happens when a button is
   pressed, and it is deliberately shaped exactly like `attemptAttack` above it:

     * ONE ENTRY POINT FOR BOTH DRIVERS. `attemptItem` is what `sim.ts`'s human
       branch calls and what `ai.ts` will call in phase 3. Sharing it is what
       guarantees a bot and a player pay the same cooldown, respect the same
       `minAlive` and are refused by the same lock — the alternative is this
       file's most expensive recorded defect class, five AI driver bugs whose
       common shape was one rule implemented twice.
     * THE USABILITY RULE IS EXPORTED, NOT BURIED. `itemUsable` answers "may this
       button be pressed right now" for the HUD, for the loadout screen and for
       the AI, and `attemptItem` is defined as "if `itemUsable`, spend it". A
       button that greys itself out on a copy of the rule is a button that will
       one day disagree with the sim.

   ── 🚨 THERE IS NO ROLL IN ANY OF THIS ──────────────────────────────────────

   `grep -rn 'Math.random' src/game/{sim,state,combat,ai,movement}.ts` returns
   NOTHING and the sim carries no seeded generator either — the seeds every
   balance number in this project rests on belong to the DRIVER. Every effect
   below is a pure function of the match state at the instant it fires. The one
   item that looks like it wants a roll is Disposal's destination, and the rule
   there is an ORDERING over a set the sim already holds (`nearestLivingOpponent`,
   the same rule every weapon aims with) rather than a choice.

   ── ⚠️ WHAT THIS BLOCK ASSUMES BECAUSE THE REGISTRY DOES NOT SAY ────────────

   `ITEM_TUNING` declares a `range` for exactly one thrown item (`warm_milk`,
   where the range IS the mechanic). Pompa, Squid Ink, Liquorice and Disposal are
   thrown too and declare none. Rather than type four numbers into the sim —
   which would put four tuning values outside the file that owns tuning — every
   throw that does not declare its own reach uses `ITEM_THROW_RANGE` below, and
   the gap is REPORTED to whoever owns `rules.ts` rather than papered over.
   ═══════════════════════════════════════════════════════════════════════════ */

/**
 * HOW FAR A THROWN ITEM REACHES WHEN `ITEM_TUNING` DOES NOT SAY.
 *
 * `GUARANTEED_VISIBLE_RADIUS` — the disc EVERY supported aspect ratio shows around you, so
 * its edge is the furthest point a player can be certain is on their screen. It is the same
 * constant `ITEM_TUNING.warm_milk.range` is derived from, which is the argument for it: Uri
 * described one of these five items as reaching *"up to half a screen away"* and did not
 * describe the other four as reaching further, so "as far as you can see" is the honest
 * default and it is DERIVED rather than typed.
 *
 * 🔴 **THIS IS A GAP IN THE PHASE-1 CONTRACT AND IT IS REPORTED, NOT PATCHED.** The right
 * end state is `ITEM_TUNING.pompa.range` / `.squid_ink.range` / `.liquorice.range` /
 * `.disposal.range`, four one-line hunks in `rules.ts`, which this pass does not own. A
 * constant living here instead of there is a second, quieter source of truth for tuning —
 * `CLAUDE.md`'s named defect shape — and it is written down so nobody mistakes it for a
 * decision that was made on purpose in the right place.
 */
const ITEM_THROW_RANGE = GUARANTEED_VISIBLE_RADIUS;

/**
 * ONE SECOND, FOR THE ONE ITEM WHOSE NUMBER IS DENOMINATED IN SECONDS.
 *
 * `ITEM_TUNING.blue_cheese.dps` is damage per SECOND. The second is the unit that number is
 * quoted in, not a cadence somebody chose — so it is written once, here, rather than as a
 * bare `1000` in `sim.ts`'s aura loop where it would read as a tuning knob. §42 asserts the
 * relationship (one tick per second, `dps` damage per tick) rather than the number.
 */
export const ITEM_AURA_TICK_MS = 1000;

/**
 * ── MAY THIS BUTTON BE PRESSED RIGHT NOW? ───────────────────────────────────
 *
 * Exported for the same reason `statusReadyAt` and `drDurationFor` are: the HUD must be able
 * to grey a button out, the AI must be able to decide whether pressing is worth a tick, and
 * both have to ask the question the sim will actually answer. A copy of this rule anywhere
 * else is a button that lies.
 *
 * The gates, in order, and the order is not arbitrary:
 *
 *   1. **PHASE.** Nothing is usable outside `'playing'`.
 *   2. **THE SLOT HOLDS AN ACTIVE ITEM.** `passive` and `triggered` items have no button at
 *      all — `ITEMS[id].cooldownMs` is `null` for exactly those, and §41(g) already pins
 *      that correspondence, so this test and that one cannot drift.
 *   3. **THE FIGHTER IS AWAKE.** `actionsLocked`, not `movementLocked`: a ROOTED fighter may
 *      still press (`ITEMS.liquorice.look` — *"the victim can still act, they just cannot
 *      move"*), a SLEEPING one may not. A CLOGGED one may — Uri's plunger clogs weapons.
 *   4. **`minAlive`.** Uri, of Disposal: *"If there are only two players left, it's not
 *      available."* 🚨 **READ FROM THE REGISTRY FOR EVERY ITEM, NEVER SPECIAL-CASED HERE.**
 *      `ItemDef.minAlive`'s own header says why the field exists: hard-coding the check
 *      inside Disposal's handler would make it invisible to the loadout screen, to the AI
 *      and to any test that wants to enumerate what is usable right now.
 *   5. **NO SECOND WIND-UP.** One `ItemCast` per fighter, exactly as `attemptAttack` allows
 *      only one `ActiveCast` — a second press would overwrite the record and spend the
 *      first item's cooldown on a wind-up that never resolved.
 *   6. **COOLDOWN.**
 *
 * ⚠️ **A WEAPON WIND-UP DOES NOT REFUSE AN ITEM, AND THAT IS `DECISIONS §78` APPLIED RATHER
 * THAN OVERLOOKED:** a cast costs POSITION, not SILENCE. The consequence is stated where it
 * bites — `resolveItem`'s Springform branch — because a fighter that may not MOVE is one
 * `movement.ts:stepPush` will not displace.
 */
export function itemUsable(state: MatchState, fighter: Fighter, slot: number): boolean {
  if (state.phase !== 'playing') return false;
  const id = fighter.item.equipped[slot];
  if (id === undefined) return false;
  const def = ITEMS[id];
  if (def.kind !== 'active') return false;
  if (actionsLocked(fighter, state.elapsed)) return false;
  if (livingFighterCount(state) < def.minAlive) return false;
  if (fighter.itemCast !== null) return false;
  const cooldown = def.cooldownMs ?? 0;
  return state.elapsed - fighter.item.lastUsed[slot] >= cooldown;
}

/**
 * PRESS THE ITEM IN EQUIP SLOT `slot`. Returns false only when the press could not be
 * attempted at all — which is exactly `!itemUsable`.
 *
 * Everything a press COSTS happens here and at the press, whether or not the effect finds
 * anybody: the cooldown is stamped, and `item-used` is emitted. That is the same line
 * `attemptAttack` has always drawn — *"too far", "wrong direction" and "target already dead"
 * all consume the press* — and it is what stops an item being a free scan of the arena.
 *
 * ⚠️ **THE ONE ITEM WITH A WIND-UP RETURNS HERE AND RESOLVES LATER**, through
 * `resolveDueItemCast` at the top of its owner's next qualifying turn, exactly as a `castMs`
 * weapon does. `ITEMS.shiitake.look`: *"The WIND-UP MUST BE VISIBLE TO OPPONENTS — that is
 * what makes it counterable rather than a coin flip."* The telegraph a renderer draws off
 * `item-used`'s `windupMs` is therefore describing an effect that has not happened yet, and
 * the fighter is rooted and its aim frozen for the whole of it (`state.ts:movementLocked`,
 * `sim.ts:applyAim`) — the same three properties that make a weapon cast dodgeable.
 */
export function attemptItem(
  state: MatchState,
  fighter: Fighter,
  slot: number,
  events: GameEvent[],
): boolean {
  if (!itemUsable(state, fighter, slot)) return false;
  const id = fighter.item.equipped[slot];
  const def = ITEMS[id];
  const now = state.elapsed;
  fighter.item.lastUsed[slot] = now;

  const windupMs = id === 'shiitake' ? ITEM_TUNING.shiitake.windupMs : 0;
  events.push({
    type: 'item-used',
    fighterRole: fighter.role, fighterId: fighter.id,
    itemId: id, slot, x: fighter.x, y: fighter.y, windupMs,
  });

  if (windupMs > 0) {
    fighter.itemCast = { slot, itemId: id, startedAt: now, resolvesAt: now + windupMs };
    return true;
  }

  resolveItem(state, fighter, slot, id, events);
  return true;
}

/**
 * RESOLVE `fighter`'s item wind-up if it is due — the item twin of `resolveDueCast`, called
 * from the same place in `sim.ts`'s fighter loop and for the same reason: the effect must
 * land at the point in the tick a press would have landed it, so nothing downstream has to
 * know wind-ups exist.
 *
 * ⚠️ **THE PHASE IS RE-READ AND THAT IS NOT REDUNDANT** — the loop's gate was evaluated
 * before the loop began and `applyDamage` can end the match mid-loop. ⚠️ **THE RECORD IS
 * CLEARED BEFORE THE RESOLUTION RUNS**, so a resolution that reaches `applyDamage` cannot
 * find its own owner mid-cast. Both are `resolveDueCast`'s rules, stated once there and
 * followed here rather than re-argued.
 *
 * ⚠️ A match that ends mid-wind-up leaves the record ALONE: the gate simply never resolves
 * it. `resolveDueCast`'s header records why clearing it in two places would be two
 * statements of one rule.
 */
export function resolveDueItemCast(state: MatchState, fighter: Fighter, events: GameEvent[]): boolean {
  if (state.phase !== 'playing') return false;
  const c = fighter.itemCast;
  if (c === null || state.elapsed < c.resolvesAt) return false;
  fighter.itemCast = null;
  events.push({
    type: 'item-resolved',
    fighterRole: fighter.role, fighterId: fighter.id,
    itemId: c.itemId, slot: c.slot, x: fighter.x, y: fighter.y,
  });
  resolveItem(state, fighter, c.slot, c.itemId, events);
  return true;
}

/**
 * WHO A THROWN ITEM LANDS ON: the nearest living opponent, if it is inside `range`.
 *
 * 🚨 **`nearestLivingOpponent` AND NOT A SECOND TARGET RULE.** `state.ts` records that this
 * question split into three when the seat cap came off and that every asker now shares one
 * answer — `combat.ts:deliverWeapon` and `ai.ts:stepAI` both take this one, on the same tick,
 * with nothing moving in between, precisely so an aim and a shot cannot name different
 * fighters. An item that picked "the one I am pointing at" would be a fourth rule, and the
 * first fighter it disagreed with a weapon about would be a bug nobody could see from either
 * call site.
 *
 * ⚠️ **THE RANGE TEST IS SEPARATE FROM THE PICK, AND THE ORDER MATTERS.** The nearest
 * opponent is chosen first and THEN tested, so a throw whose nearest target is out of reach
 * MISSES rather than skipping past them to somebody further away. Uri's *"up to half a
 * screen away"* is a maximum reach, not a search radius — and the alternative would let a
 * player hit a distant fighter through a nearer one, which no other weapon in this game does.
 */
function itemTargetInRange(state: MatchState, user: Fighter, range: number): Fighter | null {
  const t = nearestLivingOpponent(state, user);
  if (t === null) return null;
  return Math.hypot(t.x - user.x, t.y - user.y) <= range ? t : null;
}

/** The four deadline fields an item status can write. Named so the writer below is total. */
type ItemStatusField = 'sleepUntil' | 'clogUntil' | 'rootUntil' | 'blotUntil';

/**
 * ── APPLY A TIMED ITEM STATUS, AND REFUSE ONE THAT IS ALREADY RUNNING ────────
 *
 * One writer for all four of Uri's timed states, so "what happens when it is applied twice"
 * is answered once instead of four times.
 *
 * **THE RULE: A STATUS THAT IS ALREADY RUNNING IS NOT RE-APPLIED.** It is the same shape as
 * `applyDamage`'s refusal for slow and stun (`statusReadyAt`), minus the grace window, and
 * it is the minimum that stops two holders of one item chaining a lock nobody can answer —
 * `DECISIONS §75` is the record of what that costs when it is missed: *"you essentially lock
 * him to place"*.
 *
 * 🔴 **AND IT IS NOT SUFFICIENT ON TODAY'S NUMBERS — REPORTED, NOT SILENTLY FIXED.**
 * `ITEMS.warm_milk.cooldownMs` is `SUPER_MIN_COOLDOWN_MS * 2` = 5,000 and
 * `ITEM_TUNING.warm_milk.maxMs` is `ITEM_STATUS_MS` = 5,000, so a single holder throwing at
 * maximum range can re-apply the instant the previous sleep expires and hold one fighter
 * asleep for the whole match. The same arithmetic is exactly level for Pompa and Liquorice
 * (5,000 cooldown against a 5,000 state). The fix is a cooldown or a grace window in
 * `rules.ts`, which this pass does not own; the refusal here is the half that belongs in the
 * sim. §42 measures the gap rather than describing it.
 *
 * ⚠️ **SLEEP KILLS BOTH KINDS OF WIND-UP.** Uri's sleep denies a fighter its whole turn, so
 * a commitment it had already opened dies exactly as a stun kills one — `cast-cancelled` and
 * `item-cancelled` both gain the reason `'sleep'` rather than borrowing `'stun'`, because
 * the one job of that field is to say which terminator fired.
 */
function applyItemStatus(
  state: MatchState,
  owner: Fighter,
  target: Fighter,
  itemId: ItemId,
  field: ItemStatusField,
  ms: number,
  events: GameEvent[],
): boolean {
  if (ms <= 0) return false;
  if (state.elapsed < target.item[field]) return false;   // already running: refused
  target.item[field] = state.elapsed + ms;
  if (field === 'sleepUntil') {
    if (target.cast !== null) cancelCast(target, 'sleep', events);
    if (target.itemCast !== null) cancelItemCast(target, 'sleep', events);
  }
  events.push({
    type: 'item-hit', itemId,
    ownerRole: owner.role, ownerId: owner.id,
    targetRole: target.role, targetId: target.id,
    durationMs: ms, stacks: 0,
    fromX: target.x, fromY: target.y, x: target.x, y: target.y,
  });
  return true;
}

/**
 * ── WHAT EACH ACTIVE ITEM DOES. ONE SWITCH, REACHED BY BOTH PATHS. ───────────
 *
 * `attemptItem` for the nine that resolve on the press, `resolveDueItemCast` for the one
 * that does not — the same two-callers-one-implementation shape `resolveWeapon` has, and for
 * the same reason: a rule stated on the press path and again on the resolve path is two
 * implementations of one resolution.
 *
 * The three non-active items are unreachable here by construction (`itemUsable` refuses
 * anything whose `kind` is not `'active'`), and they are listed in the switch anyway rather
 * than left to `default`, so that adding an eleventh item is a compile error in this file
 * instead of a silent no-op in the game.
 */
function resolveItem(
  state: MatchState,
  user: Fighter,
  slot: number,
  id: ItemId,
  events: GameEvent[],
): void {
  switch (id) {
    // ── SPRINGFORM — Uri: *"Trampoline — use to jump further towards or away from the
    // enemy"* ────────────────────────────────────────────────────────────────
    //
    // ALONG THE FIGHTER'S OWN `facing`, which is the whole of "towards or away": you point
    // where you want to go and press. No target, no aim assist, nothing to resolve — which
    // also makes it the one active item that works in an empty arena.
    //
    // ⚠️ It uses the displacement primitive with an explicit cap and rate, and
    // `movement.ts:displaceFighter`'s `opts` block is the measurement of why it had to grow
    // them: the shipped cap is 42 wu against this item's authored 99.61, and the shipped
    // rate would have taken 1,107 ms against an authored 350.
    //
    // ⚠️ **IT IS A JUMP THAT COLLIDES.** The impulse is spent through `tryMove`, so a
    // trampoline into a wall stops at the wall rather than passing through it. That is the
    // conservative reading and it is deliberate: the alternative — a positional write, as
    // Disposal takes — would let a fighter cross cover the nav grid and every weapon still
    // treats as solid.
    //
    // ⚠️ **A FIGHTER THAT MAY NOT MOVE IS NOT LAUNCHED, AND ITS PRESS IS STILL SPENT.**
    // `stepPush` refuses to displace a `movementLocked` fighter and burns the budget anyway,
    // so pressing this while rooted, slept, stunned or mid-wind-up wastes it. That is not a
    // new rule and it is not this item's: it is `stepPush`'s stated *"the sim never moves a
    // fighter it has denied the ability to move"*, and a root you can trampoline out of is
    // not a root. `attemptItem` does NOT gate on it, because `attemptAttack` does not gate a
    // stunned fighter's press either and one of the two would then be lying.
    case 'springform': {
      displaceFighter(user, user.facing.x, user.facing.y, ITEM_TUNING.springform.distance, {
        cap: ITEM_TUNING.springform.distance,
        // Distance over time, so the authored `travelMs` is what the jump actually takes.
        speed: ITEM_TUNING.springform.distance / ITEM_TUNING.springform.travelMs,
      });
      return;
    }

    // ── WARM MILK — Uri: *"You can put someone to sleep up to half a screen away, the
    // farther he is, the longer it puts him to sleep"* ────────────────────────
    //
    // The one item whose duration is a function of the geometry, so the arithmetic is the
    // mechanic: LINEAR from `minMs` at zero separation to `maxMs` at the edge of `range`.
    // Linear rather than any curve because his sentence states a monotone relation and
    // nothing more, and a curve would be a tuning decision invented in the sim.
    //
    // ⚠️ `range` is `GUARANTEED_VISIBLE_RADIUS` — *"half a screen"* derived from the disc
    // every supported aspect ratio guarantees, never typed. `rules.ts` owns that derivation
    // and §41(d) asserts it.
    case 'warm_milk': {
      const t = itemTargetInRange(state, user, ITEM_TUNING.warm_milk.range);
      if (t === null) return;
      const sep = Math.hypot(t.x - user.x, t.y - user.y);
      const frac = ITEM_TUNING.warm_milk.range > 0
        ? Math.min(1, Math.max(0, sep / ITEM_TUNING.warm_milk.range))
        : 0;
      const ms = ITEM_TUNING.warm_milk.minMs
        + (ITEM_TUNING.warm_milk.maxMs - ITEM_TUNING.warm_milk.minMs) * frac;
      applyItemStatus(state, user, t, id, 'sleepUntil', ms, events);
      return;
    }

    // ── POMPA — Uri: *"pompa — clogs their weapons for 5 secons"* ─────────────
    //
    // WEAPONS, and nothing else: the victim still walks, still presses its other item, still
    // finishes a wind-up it had already bought. `state.ts:weaponsLocked` is where that
    // narrowness is stated and `attemptAttack` is the single site that reads it.
    case 'pompa': {
      const t = itemTargetInRange(state, user, ITEM_THROW_RANGE);
      if (t === null) return;
      applyItemStatus(state, user, t, id, 'clogUntil', ITEM_TUNING.pompa.clogMs, events);
      return;
    }

    // ── SQUID INK — Uri: *"Ink spray that blots their screen"* ────────────────
    //
    // 🚨 **THE SIM HALF IS A FLAG WITH A DURATION AND NOTHING ELSE, AND THAT IS THE WHOLE
    // OF THIS ITEM HERE.** The blots are screen-space and belong to the VFX track; the sim
    // renders nothing and — importantly — DECIDES nothing on it. Impairing a human's view
    // cannot be a sim input without the sim ceasing to be a pure function of its inputs, and
    // a bot's sight is `movement.ts:isVisibleFrom`, which is geometry. So a slate-blind
    // fighter behaves identically to a sighted one INSIDE the simulation, and the entire
    // effect is what the player can see. §42 asserts that inertness rather than assuming it.
    case 'squid_ink': {
      const t = itemTargetInRange(state, user, ITEM_THROW_RANGE);
      if (t === null) return;
      applyItemStatus(state, user, t, id, 'blotUntil', ITEM_TUNING.squid_ink.blotMs, events);
      return;
    }

    // ── LIQUORICE ROPE — Uri: *"Rope — you can use it to tie an opponent for 5 seconds"* ──
    //
    // ROOTED, NOT STUNNED. `ITEMS.liquorice.look` makes the promise explicitly — *"the victim
    // can still act, they just cannot move, and those are different states"* — so the root
    // is a term in `movementLocked` and is deliberately absent from `actionsLocked`.
    case 'liquorice': {
      const t = itemTargetInRange(state, user, ITEM_THROW_RANGE);
      if (t === null) return;
      applyItemStatus(state, user, t, id, 'rootUntil', ITEM_TUNING.liquorice.rootMs, events);
      return;
    }

    // ── SHIITAKE SHIELD — Uri: *"attackers … get damage on every damage they do. Lasts for
    // 5 seconds"* ─────────────────────────────────────────────────────────────
    //
    // Reached ONLY from `resolveDueItemCast`, one full `windupMs` after the press. The
    // reflection itself is at the bottom of `applyDamage`, because that is the single choke
    // point every point of damage in the game passes through; all this does is open the
    // window.
    //
    // ⚠️ **THE WINDOW IS SET FROM *NOW*, WHICH IS THE RESOLVE AND NOT THE PRESS.** Uri's
    // five seconds are five seconds of shield, not five seconds minus a wind-up.
    case 'shiitake': {
      user.item.shieldUntil = state.elapsed + ITEM_TUNING.shiitake.durationMs;
      // The wearer is both owner and target: this is the one item that lands on nobody else,
      // and publishing it as a hit on yourself is what lets one subscription draw all ten.
      events.push({
        type: 'item-hit', itemId: id,
        ownerRole: user.role, ownerId: user.id,
        targetRole: user.role, targetId: user.id,
        durationMs: ITEM_TUNING.shiitake.durationMs, stacks: 0,
        fromX: user.x, fromY: user.y, x: user.x, y: user.y,
      });
      return;
    }

    // ── DISPOSAL — Uri: *"Black hole — throws him nearby a different enemy. If there are
    // only two players left, it's not available"* ─────────────────────────────
    //
    // Three fighters, resolved by the sim's ONE target rule asked twice:
    //
    //   VICTIM       `nearestLivingOpponent(state, user)`          — inside the throw's reach
    //   DESTINATION  `nearestLivingOpponent(state, victim, user)`  — nearest to the VICTIM,
    //                                                                excluding the thrower
    //
    // Nearest-to-the-victim rather than nearest-to-the-thrower because the sentence is about
    // where the victim ENDS UP, and because it is the reading a player can predict from what
    // is on screen: they go to whoever they were already closest to. Ties break on the lower
    // slot, inside `nearestLivingOpponent`, which is where every other tie in the sim breaks.
    //
    // ⚠️ **THE `minAlive: 3` GATE IS NOT HERE.** It is declared on `ITEMS.disposal` and
    // enforced by `itemUsable`, so the loadout screen and the AI can see it — that field's
    // header is the argument. This branch may still find no destination (all other fighters
    // out of the world, an instrument's fixture), and then nothing happens and the press is
    // spent, exactly as a missed swing is.
    //
    // ⚠️ **THE DESTINATION IS A POSITIONAL WRITE, NOT A SHOVE.** `movement.ts:placeFighterAt`
    // carries the measurement: an impulse across a 2800x2000 arena is nearly eight seconds of
    // sliding at the primitive's spend rate. The drain and the spit-out are the VFX track's,
    // drawn between the two ends this event publishes.
    case 'disposal': {
      const victim = itemTargetInRange(state, user, ITEM_THROW_RANGE);
      if (victim === null) return;
      const dest = nearestLivingOpponent(state, victim, user);
      if (dest === null) return;
      const fromX = victim.x;
      const fromY = victim.y;
      // The bearing from the destination BACK TOWARD where the victim was, so they are spat
      // out on the side they came from rather than through the fighter they are thrown at.
      // Coincident fighters have no bearing between them — the same degeneracy the melee cone
      // and `displaceFighter` both answer — so it falls back to the destination's own facing,
      // which `createFighter` seeds non-zero and nothing in the sim ever zeroes.
      let dx = fromX - dest.x;
      let dy = fromY - dest.y;
      const mag = Math.hypot(dx, dy);
      if (mag < 1e-6) { dx = dest.facing.x; dy = dest.facing.y; }
      else { dx /= mag; dy /= mag; }
      const d = ITEM_TUNING.disposal.dropDistance;
      placeFighterAt(victim, dest.x + dx * d, dest.y + dy * d, state.arena);
      events.push({
        type: 'item-hit', itemId: id,
        ownerRole: user.role, ownerId: user.id,
        targetRole: victim.role, targetId: victim.id,
        durationMs: 0, stacks: 0,
        fromX, fromY, x: victim.x, y: victim.y,
      });
      return;
    }

    // ── THE THREE THAT HAVE NO BUTTON ────────────────────────────────────────
    //
    // `itemUsable` refuses anything whose `kind` is not `'active'`, so these are unreachable
    // from both call sites. They are named rather than swept into a `default` so that the
    // eleventh item added to `ItemId` fails to compile HERE — a `default: return;` would have
    // made a new item a silent no-op in the game and green in every test that did not know to
    // look for it.
    case 'tenderiser':   // passive: `applyDamage`'s streak block
    case 'blue_cheese':  // passive: `sim.ts:applyWorldTick`'s aura block
    case 'leftovers':    // triggered: `reviveThoseKilledBy`, off a death rather than a press
      return;
  }
}
