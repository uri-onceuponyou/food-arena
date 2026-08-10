/**
 * Enemy AI controller.
 *
 * Transcribed from the prototype's inline AI block: chase the player, flee and
 * snipe below a flee-HP threshold, otherwise pick the best weapon that's off
 * cooldown and in range. Attacks are issued through `combat.ts`'s
 * `attemptAttack` — the same function the player uses — rather than a separate AI
 * firing path. That is a deliberate, low-risk deviation from the prototype, whose
 * `aiFireWeapon` skips the melee cone/facing check the player is subject to; see
 * the report for why unifying the two paths was judged safe (the AI always faces
 * the target it is about to melee, so the cone check is a no-op in every reachable
 * state — it only matters for defensive consistency).
 *
 * ── THIS FILE'S RECURRING DEFECT ────────────────────────────────────────────
 *
 * Sharing `attemptAttack` guarantees the two sides RESOLVE an attack identically. It
 * guarantees nothing about which attacks each side gets to attempt, and four times now
 * this file has quietly narrowed that on the AI's side alone:
 *
 *   * a heal that only the player could use, on the same character (`07a4e3a`);
 *   * a stun that also SILENCED the AI, where `rules.ts` and `sim.ts` agree it only
 *     roots — 11 of 11 characters, the stunned player firing 100% of its shots and the
 *     stunned AI 0%;
 *   * a flee branch that could select nothing at all for the one melee-only character;
 *   * and a flee branch that AIMED BACKWARDS, so 8 of 11 characters delivered zero
 *     damage from it. ✅ **CLOSED 2026-08-05, on Uri's answer to `DECISIONS §15`**, with
 *     `ENEMY_MAX_HP` 150 -> 90 landing beside it because the two are one decision — see
 *     the facing block in `stepAI` and AUTHORISED DEVIATION #9 in `rules.ts`.
 *
 * All four are now closed. The shape was always the same: a rule stated once in
 * `rules.ts` and implemented twice. Where this file must diverge from the player it says
 * so out loud, and `sim.test.mjs` §20 asserts the symmetry behaviourally rather than by
 * inspection — §20(d) in particular is now a guard on the FIXED behaviour, having been
 * written originally as a guard on the defect.
 *
 * ── THE FIFTH, FOUND 2026-08-05, MEASURED AND PARKED ────────────────────────
 *
 *   * TERRAIN SLOW REACHES THE PLAYER AND NOT THE ENEMY. `rules.ts` states it twice, in
 *     prose, and both times for *anyone* — `PUDDLE_SLOW_FACTOR` ("slows anyone inside
 *     it") and `SPLAT_DURATION_MS` ("slows anyone standing in it"). It is implemented
 *     once, in `sim.ts:movePlayer`, the only caller of `terrainSlowFactor()` that scales
 *     a speed. `aiSlowMult` below is built out of the STATUS slow alone, so the enemy
 *     crosses every puddle and every splat in the game at full speed.
 *
 *     Proven with a one-tick control rather than by reading the source (`sim.test.mjs`
 *     §25(a)): both fighters pinned 900 wu apart so the AI is in its chase-MOVE branch,
 *     flooded floor against dry floor, everything else byte-identical — **player ratio
 *     0.450000, enemy ratio 1.000000.**
 *
 *     NOT FIXED HERE, and the reason is a number rather than a preference: the three-line
 *     fix was staged and measured over 110 matchups x 32 seeds and it regresses the
 *     settled-matchup count 17 -> 19, which is a hard guard. The price and the two cells
 *     it costs are on the `SPLAT_DURATION_MS` block in `rules.ts`. §25(a) is a guard in
 *     BOTH directions, so landing the fix fails the test and forces the record to be
 *     re-read.
 *
 * ── THE SIXTH, FOUND BEFORE IT WAS WRITTEN, AND CLOSED BY CONSTRUCTION ──────
 *
 *   * CONCEALMENT REACHING SOME OF THE PLAYER-POSITION READS AND NOT OTHERS. A probe found
 *     this file read the player's TRUE position at three independent sites — `adx/ady`,
 *     `enemy.facing`, and the chase nav target — and that the third was a DIRECT read
 *     (`steer(..., player.x, player.y)`), not derived from the first. An implementation
 *     that replaced `adx/ady` and missed it would give an AI that FACES where it last saw
 *     you while WALKING to where you actually are: concealment dead content for the player,
 *     still working against the AI, and looking correct on screen.
 *
 *     This is the ONLY one of the six that was closed before it shipped, and only because
 *     it was PROBED rather than reviewed. All three sites now derive from `tx, ty` in the
 *     perception block of `stepAI`, `state.player` appears nowhere else in the function,
 *     and `sim.test.mjs` §26(e) pins all three behaviourally in ONE experiment with its
 *     ablation. There is a fourth reader OUTSIDE this file — homing projectiles re-aim
 *     every tick — handled at `sim.ts:stepProjectiles` through the same predicate and
 *     pinned by §26(g).
 *
 * ── AND THE SHAPE HAS LEFT THIS FILE ────────────────────────────────────────
 *
 * Defect 1 above — a heal only one side could reach — **recurred, mirrored, in the
 * instrument**: `tools/tmp/scripted_player.mjs:bestWeapon` carries `if (w.type ===
 * 'self') return;`, so the scripted PLAYER cannot press the roster's only heal while
 * this file's `rankHeal` presses it 1.08 times a match. Measured: Hamburger's role split
 * is 15.0% / 65.6%, and it is that line and nothing else — take the heal off this file
 * and the split goes to -3.7 pp; give it to the player and it goes to -10.0 pp. Defect 2
 * (ranking by the authored `damage` field) is also still live there, for Taco and
 * Burrito — `4105116`'s own message says *"BOTH drivers ranked weapons by authored
 * damage"*, and it fixed one of them.
 *
 * The generalisation is worth more than either fix: **"a rule stated once and implemented
 * twice" is not a property of this file. It is a property of having two drivers**, and one
 * of them is the thing that measures the other. See "THE HAMBURGER ROLE SPLIT" in
 * `rules.ts` and `sim.test.mjs` §25.
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
  CHARACTER_IDS,
  HIT_RADIUS_VS_PLAYER,
  speedFor,
  type Weapon,
  type WeaponType,
} from './rules.ts';
import type { GameEvent, MatchState } from './state.ts';
import { attemptAttack } from './combat.ts';
import { isVisibleFrom, moveToward } from './movement.ts';

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

// ─────────────────────────────────────────────────────────────────────────────
// WEAPON SELECTION — one function, and every caller names what it will consider
// ─────────────────────────────────────────────────────────────────────────────

/**
 * This file shipped the SAME defect three times, each as a separate helper that
 * silently excluded a weapon category:
 *
 *   1. `pickHighestDamageWeapon` skipped `type === 'self'`, so the AI never healed —
 *      unreachable code for the AI and usable by the player, on the same character
 *      (fixed in `07a4e3a`).
 *   2. `pickSniperWeapon` required `type === 'ranged'`, so the one character in the
 *      roster with no ranged weapon had NOTHING selectable in the flee branch and
 *      could not attack at all while fleeing (`sim.test.mjs` §19 names it, and
 *      `tools/tmp/flee_probe.mjs` measured it: 0 shots in 8 s at every separation).
 *   3. And both of them ranked by the authored `damage` field, which is per-PELLET and
 *      per-PECK and, for a combo weapon, zero — see `pressValue` below.
 *
 * Three helpers, three exclusions, none of them announced at the call site. So there
 * is now ONE selector, and `allow` is `Record<WeaponType, boolean>` rather than a
 * predicate: it is EXHAUSTIVE BY TYPE, so a fourth weapon category cannot be added to
 * `rules.ts` without `tsc` demanding that every selector in this file say what it does
 * with it. The compiler is the guard, because three code reviews were not.
 */
type WeaponAllow = Readonly<Record<WeaponType, boolean>>;

/** Anything that can hurt the player. Heals are a separate decision, made separately. */
const ALLOW_OFFENSIVE: WeaponAllow = { melee: true, ranged: true, self: false };
/** The heal, and only the heal. */
const ALLOW_HEAL: WeaponAllow = { melee: false, ranged: false, self: true };

/**
 * Rank an eligible weapon. Higher wins; `-Infinity` means "not worth using right now"
 * and is skipped. Module-level function references, never per-tick closures — `stepAI`
 * runs every tick of every match and this file allocates nothing in the steady state.
 */
type WeaponRank = (state: MatchState, w: Weapon, index: number, adist: number) => number;

/**
 * ── WHAT A PRESS IS WORTH, AND WHY IT IS NOT `damage` ────────────────────────
 *
 * The authored `damage` field is not the damage a press delivers. It is the damage of
 * ONE PELLET, of ONE PECK, and for a combo weapon it is not the damage at all:
 *
 *   Burrito  Topping Swarm   5 x 4 homing pellets   = 20   ranked below Disc 10
 *   Taco     Double Toss     damage 0, parts 14 + 9 = 23   ranked below everything
 *   Egg      Hatch!          5 x 3 pecks            = 15
 *   Sushi    Big Catch       9 x 3 homing pellets   = 27
 *
 * Nor is it `pellets x damage`. `combat.ts` fans pellet `i` out at
 * `(i - (n-1)/2) * spreadDeg` and `sim.ts:stepProjectiles` only lands a hit inside
 * `HIT_RADIUS_VS_PLAYER`, so an off-axis pellet passes `d * sin(theta)` wide of a
 * target `d` away and MISSES once that exceeds the hit radius. Sushi's Rice Spray is
 * worth 6 at 40 wu and 2 at 58 — the same press, in the same weapon, two rungs apart.
 *
 * So each off-axis pellet has a RANGE AT WHICH IT STOPS LANDING, `hitRadius / |sin θ|`,
 * and press value is a step function of separation. That is what `PRESS_VALUE` holds,
 * precomputed once at module load: `always` (the on-axis pellet, a homing volley, a
 * melee swing, a lone projectile — times its peck count) plus the off-axis parts with
 * the distance each one dies at.
 *
 * NOT A MODEL — validated against the sim. `tools/tmp/press_value.mjs` fires every
 * weapon of every character through the real `attemptAttack` + `stepProjectiles` at
 * eight separations and compares: **183 of 183 cells exact**, worst error 0.0.
 *
 * Two things it deliberately does not price:
 *   * the melee cone. The AI faces the target it is about to attack in BOTH branches now
 *     (it did not in the flee branch until 2026-08-05, and while that was open this key
 *     overstated every directional weapon in it — pricing the cone here would have baked
 *     that defect into the ranking, so it was left exact and the aim was fixed instead).
 *     With the aim correct in both branches the cone check is a no-op wherever this key
 *     is consulted, so the key is exact.
 *   * Donut's `trailBoosted` Candy Barrage. Donut has exactly one offensive weapon, so
 *     the boost cannot re-order a kit of one.
 */
interface PressProfile {
  /** Damage that lands at any separation the weapon reaches at all. */
  always: number;
  /** Off-axis parts: this one lands while the target is nearer than `maxDist`. */
  offAxis: readonly { maxDist: number; damage: number }[];
}

const PRESS_VALUE: ReadonlyMap<Weapon, PressProfile> = (() => {
  const DEG2RAD = Math.PI / 180;
  const m = new Map<Weapon, PressProfile>();
  /** How close the target must be for a part fanned `deg` off the axis to still land. */
  const reachOfAngle = (deg: number): number => {
    const s = Math.abs(Math.sin(deg * DEG2RAD));
    return s < 1e-9 ? Infinity : HIT_RADIUS_VS_PLAYER / s;
  };
  for (const id of CHARACTER_IDS) {
    for (const w of CHARACTERS[id].weapons) {
      let always = 0;
      const offAxis: { maxDist: number; damage: number }[] = [];
      if (w.type === 'self') {
        // Never ranked offensively; `ALLOW_HEAL` + `rankHeal` decide a heal.
      } else if (w.comboParts) {
        for (const p of w.comboParts) {
          const maxDist = reachOfAngle(p.angle);
          if (maxDist === Infinity) always += p.damage;
          else offAxis.push({ maxDist, damage: p.damage });
        }
      } else {
        const per = w.damage * (w.peckHits ?? 1);
        const n = w.pellets ?? 1;
        if (w.type === 'melee' || n <= 1 || w.homing) {
          // A melee swing, a single projectile, and a HOMING volley all land whole: the
          // homing term steers every pellet back onto the target, measured and confirmed
          // (Burrito's 4-pellet 55° fan delivers its full 20 at all eight separations).
          always = per * n;
        } else {
          const spread = w.spreadDeg ?? 0;
          for (let i = 0; i < n; i++) {
            const maxDist = reachOfAngle((i - (n - 1) / 2) * spread);
            if (maxDist === Infinity) always += per;
            else offAxis.push({ maxDist, damage: per });
          }
        }
      }
      m.set(w, { always, offAxis });
    }
  }
  return m;
})();

/**
 * Delivered damage for one press of `w` against a target `adist` away.
 *
 * Exported for the same reason `combat.ts` exports `statusReadyAt`: `sim.test.mjs` §20
 * asserts this against the damage the REAL combat path delivers, weapon by weapon and
 * band by band, so the driver's ranking key cannot silently drift away from the sim it
 * is trying to predict. A copy of the arithmetic in the test would only test the copy.
 */
export function pressValue(w: Weapon, adist: number): number {
  const p = PRESS_VALUE.get(w);
  if (!p) return w.damage; // unreachable for a weapon in CHARACTERS; fail to the old key
  let v = p.always;
  for (const o of p.offAxis) if (adist < o.maxDist) v += o.damage;
  return v;
}

const rankPressValue: WeaponRank = (_state, w, _index, adist) => pressValue(w, adist);

/**
 * The AI's only defensive resource. See `rules.ts` AUTHORISED DEVIATION #7 — until
 * `07a4e3a` this was unreachable code for the AI and usable by the player, on the same
 * character. `-Infinity` for a heal that is not worth spending yet, which is how the
 * "not hurt enough" and "would overheal" rules reach the one selector.
 */
const rankHeal: WeaponRank = (state, w) => {
  const enemy = state.enemy;
  const heal = w.healAmount ?? 0;
  if (heal <= 0) return -Infinity;
  if (enemy.hp > enemy.maxHp * AI_SELF_HEAL_HP_FRACTION) return -Infinity; // not hurt enough
  if (enemy.maxHp - enemy.hp < heal) return -Infinity; // would overheal — wait
  return heal;
};

/**
 * The index of the best weapon the enemy may use right now, or null.
 *
 * Eligibility is the same three questions for every caller — is this a category I will
 * consider, is it off cooldown, does it reach — and only the RANK differs. A `self`
 * weapon has no `range`, so `range ?? Infinity` makes the reach test a no-op for it
 * rather than a special case.
 */
function pickWeapon(state: MatchState, adist: number, allow: WeaponAllow, rank: WeaponRank): number | null {
  const enemy = state.enemy;
  const weapons = CHARACTERS[enemy.characterId].weapons;
  const now = state.elapsed;

  let bestIndex: number | null = null;
  let bestScore = -Infinity;
  for (let i = 0; i < weapons.length; i++) {
    const w = weapons[i];
    if (!allow[w.type]) continue;
    if (now - enemy.lastUsed[i] < w.cooldown) continue;
    if (adist > (w.range ?? Infinity)) continue;
    const score = rank(state, w, i, adist);
    // Strict `>` (not `>=`) preserves "first weapon wins on a tie", matching the
    // prototype's stable `Array.sort` + take-first. It is also what excludes a
    // `-Infinity` rank without a second test.
    if (score > bestScore) {
      bestScore = score;
      bestIndex = i;
    }
  }
  return bestIndex;
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

  const now = state.elapsed;

  /**
   * ── PERCEPTION: THE ONE PLACE THIS FILE LOOKS AT THE PLAYER ────────────────
   *
   * Everything below is derived from `tx, ty` — WHERE THE ENEMY BELIEVES THE PLAYER IS —
   * and `state.player.x/y` appears nowhere else in `stepAI` after these five lines. That
   * is the entire point of the block, and it is a guard rather than a tidy-up.
   *
   * `tools/tmp/p4_coverdensity.mjs`'s probe report found that this function read the
   * player's TRUE position at three independent sites, and that they were not all derived
   * from one another:
   *
   *   1. `adx/ady` here             — separation, weapon-range gating, press value, intent
   *   2. `enemy.facing` below       — aim; `combat.ts` resolves the melee cone AND the
   *                                   projectile heading off it, `match.ts` rotates the
   *                                   model by it (derived from 1, so it followed for free)
   *   3. the CHASE NAV TARGET       — `steer(..., player.x, player.y)` passed the player's
   *                                   coordinates LITERALLY to `moveToward`. A DIRECT read,
   *                                   not derived from 1.
   *
   * Route 1 and 2 and miss 3 and you get an AI that FACES where it last saw you while
   * WALKING to where you actually are — an AI that never loses you, so concealment is dead
   * content for the player while still working against the AI. That asymmetry is precisely
   * the shape of the stun-silence defect above (stunned player fires 100% of its shots,
   * stunned AI 0%), and it would have been the SIXTH instance in this file. All three now
   * read `tx, ty`; site 3 is `steer(adx / adist, ady / adist, tx, ty)` in the chase branch.
   *
   * (There is a FOURTH reader outside this file — homing projectiles re-aim at
   * `target.x/target.y` every tick. It is handled at `sim.ts:stepProjectiles`, through the
   * same `isVisibleFrom` predicate, and is commented there.)
   *
   * ⚠️ INERT BY CONSTRUCTION WHEN NO ARENA SUPPLIES CONCEALMENT. `isVisibleFrom` returns
   * `true` unconditionally for an empty region list, so `sighting` is refreshed to the
   * player's exact position on every tick and `tx, ty === player.x, player.y` identically.
   * That is not an argument, it is the acceptance test: `tools/tmp/conceal_lab.mjs --bitid`
   * runs 110 matchups x 32 seeds against a `--sim-ref` extraction of the previous commit
   * and requires ZERO differing ticks.
   */
  // ⚠️ `state, player` ARE THE §29c ARGUMENTS, AND THIS ONE CALL IS WHY THE RULE REACHES
  // ALL THREE SITES. Destroyed cover (`MatchState.brokenConcealment`) and the reveal window
  // a fighter's own attack buys (`Fighter.revealedUntil`) are per-MATCH facts that
  // `ArenaDefinition` cannot carry — it is one shared object across every match a process
  // runs. Because the perception block below derives `tx, ty` from this single boolean, and
  // `state.player` appears nowhere else in `stepAI`, adding them here routes the reveal to
  // the separation, the facing AND the nav target in one edit. Route it to two of the three
  // and you get the sixth instance of this file's oldest defect; `sim.test.mjs` §26(k)
  // pins all three behaviourally in one experiment, with its ablation.
  const visible = isVisibleFrom(enemy.x, enemy.y, player.x, player.y, state.arena, state, player);
  const sighting = state.aiSighting;
  if (visible) {
    sighting.x = player.x;
    sighting.y = player.y;
    sighting.at = now;
  }
  const tx = sighting.x;
  const ty = sighting.y;

  const adx = tx - enemy.x;
  const ady = ty - enemy.y;
  const separation = Math.hypot(adx, ady);
  // `|| 1` keeps the historical range-check behaviour at zero separation (0 and 1 are
  // both inside every weapon's range), but it must NOT be used to derive a direction —
  // see `hasBearing`.
  const adist = separation || 1;

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

  /**
   * ── WHAT A STUN LOCKS ────────────────────────────────────────────────────
   *
   * `rules.ts` states the rule once — `STUN_DURATION_MS`, "stunned = movement locked
   * to 0" — and `sim.ts:movePlayer` implements exactly that and nothing more: a
   * stunned player still aims (`applyAim` is unconditional) and still fires
   * (`attemptAttack` is called before the movement ever runs). Only `speed` goes to 0.
   *
   * This file used to read the same flag as "the enemy's turn does not happen": it
   * gated the facing, the heal, the whole flee branch and the chase branch's weapon
   * choice on it. Measured with `tools/tmp/stun_symmetry.mjs` over one full 2000 ms
   * stun with both fighters pinned in range: the stunned PLAYER fired 100% of its
   * shots and the stunned AI fired 0%, for 11 of 11 characters. Same rule, same
   * constant, two different meanings depending on which end of the match you are.
   *
   * `rooted` is therefore named for what it does. It suppresses MOVEMENT — and, via
   * `attemptedMove`, the Sticky Trail drop that movement earns, exactly as a stunned
   * player's zeroed `mdx/mdy` does. It suppresses nothing else.
   */
  const rooted = now < enemy.status.stunnedUntil;

  /**
   * FACING IS AIM, NOT TRAVEL. It is read by `combat.ts` for the melee cone and the
   * projectile heading, and by `match.ts` for the model's rotation; no movement in
   * this file goes through it (`moveToward` takes its own direction). The player's aim
   * is independent of the player's movement — mouse and WASD — so the enemy's is too,
   * and it survives a stun for the same reason `applyAim` does.
   *
   * ── THIS IS NOW THE ONLY PLACE FACING IS WRITTEN, AND THAT IS THE FIX ──────
   *
   * The flee branch below used to overwrite this with "directly away" and then fire along
   * it. `combat.ts` resolves BOTH the melee cone and the projectile heading off
   * `attacker.facing`, so every straight shot a retreating enemy took flew away from the
   * target: measured (`tools/tmp/flee_probe.mjs`, 8 s held below the flee threshold, three
   * separations) **8 of 11 characters delivered ZERO** from the branch whose own name is
   * "flee and snipe", and every point of damage in the table came from the three HOMING
   * weapons, which curve back on their own.
   *
   * The line is gone. A fleeing enemy now BACKPEDALS FACING YOU — aim and travel are
   * separate quantities here, exactly as they are for the player (mouse + WASD), and
   * `moveToward` takes its own direction and never reads `facing`. ⚠️ It is visible:
   * `match.ts` rotates the model to `facing`, so a retreating enemy no longer turns its
   * back. That is the genre norm and it is what the player already does; it was flagged
   * to Uri before he took the change.
   *
   * WHAT IT COST, paired on the same 32 seeds through the FIXED driver
   * (`tools/tmp/roster_lab.mjs`, 110 matchups x 32 seeds, shipped arena):
   *
   *   rung                                   smart2   chase   settled   strength sd
   *   shipped before this                     27.4%   18.4%   70/110      20.5 pp
   *   + this fix alone                         5.0%    3.1%   91/110       6.2 pp
   *   + `ENEMY_MAX_HP` 150 -> 90  (SHIPPED)   52.2%   45.0%   43/110      24.7 pp
   *
   * The middle row is why this could not land alone: the mechanism is a THRESHOLD, not a
   * slope — every character in the roster crosses the player's pool at once — and at 5.0%
   * the roster instrument saturates (sd 6.2 pp) and the next balance pass goes blind. The
   * HP dial is `DECISIONS §12`'s and Uri answered both together, so both land together.
   *
   * `sim.test.mjs` §20(d) was written as a guard on the DEFECT and is now a guard on the
   * FIX — same device, opposite direction, so neither can be undone by accident.
   */
  if (hasBearing) {
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
   *   * SURVIVING OUTRANKS SHOOTING, but only at the boundary. The CHASE branch fires
   *     OR moves, never both, so an AI with a weapon ready simply stops moving — which
   *     is how it came to stand inside the burn ring trading shots while the pot did
   *     32 HP/s to it. Past AI_ESCAPE_PRIORITY it moves instead of firing. Below it,
   *     nothing changes. (The FLEE branch has always done both in one tick, so it has
   *     nothing to trade and `escaping` does not suppress its shot — only its heal,
   *     which is what it did before.)
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

  /**
   * "Surviving outranks shooting" is a trade — spend the tick moving instead of firing
   * — and a trade needs both sides. A ROOTED fighter cannot move, so refusing it the
   * shot costs it the tick and buys it nothing: it is the stun silence again, one
   * branch deeper, and it would have survived the acceptance test because
   * `stun_symmetry.mjs`'s fixture has no hazards. Escape outranks shooting only when
   * escape is possible.
   */
  const escaping = urgent && !rooted;

  // The heal is chosen before the flee/chase split because it is worth the same in both,
  // and it consumes the tick's ATTACK exactly like any other weapon — never both.
  const healIndex = escaping ? null : pickWeapon(state, adist, ALLOW_HEAL, rankHeal);

  if (fleeing) {
    // ⚠️ NOTHING WRITES `facing` HERE ANY MORE. A line that pointed it directly away from
    // the player used to sit on exactly this spot, and `attemptAttack` below fired along
    // it. Aim is set once, at the player, in the facing block above — read it before
    // re-introducing anything that turns a retreating fighter's aim with its feet.
    if (!rooted) {
      const step = speedFor(enemy.characterId, AI_FLEE_SPEED) * dt * aiSlowMult;
      // Flee target is directly away from the player, so slide around cover toward
      // that point rather than pinning against it — now bent back inside the ring, which
      // is the whole reason a retreating AI used to run itself into the fog. At zero
      // separation `adx`/`ady` are both 0, so "directly away" is not a direction: the
      // heading degenerates to zero and the nav target lands on the fighter's own feet.
      // That is unchanged by the aim fix and is the movement half of the same degeneracy
      // `hasBearing` answers for the aim — see the facing block.
      steer(-adx / adist, -ady / adist,
        enemy.x - (adx / adist) * STEER_LEAD, enemy.y - (ady / adist) * STEER_LEAD);
      moveToward(enemy, STEER.dirX, STEER.dirY, step, state.arena, STEER.navX, STEER.navY);
      attemptedMove = true;
    }
    // Fires whether or not it managed to move: the flee branch has always done both in
    // the same tick, and a rooted fighter that cannot retreat has all the more reason to
    // shoot. `ALLOW_OFFENSIVE` rather than "ranged only" is what lets the one melee-only
    // character in the roster attack from a branch it can plainly enter.
    //
    // A directional melee chosen here now CONNECTS, because the aim points at the target:
    // while the aim defect was open a heavy swing spent a 3.5 s cooldown on nothing
    // (measured: Water Bottle took 3 Mega Splashes in 8 s and dealt 0 with them). That is
    // what makes `rankPressValue` the right key in this branch as well as the chase one.
    //
    // ⚠️ `visible`, NOT `adist`, IS WHAT GATES THE SHOT — and without it the belief is a
    // DEADLOCK rather than a mechanic. An AI that walks to the last-seen point arrives with
    // a believed separation of ~0, so every weapon in its kit passes the range test, so
    // `pickWeapon` returns an index, so the CHASE branch fires instead of moving —
    // permanently, at an empty patch of floor, burning cooldowns. It would register as
    // "the AI stalled" on no instrument in the repo (`match-sim`'s stall detector wants a
    // 15 wu span and this stands perfectly still, which reads as *engaged*).
    //
    // The rule it encodes is also the one a player would state: you do not shoot into a
    // bush you cannot see into. The HEAL is deliberately exempt — it targets the caster,
    // needs no sight of anyone, and gating it here would be the "a rule stated once and
    // implemented twice" defect this file is named for, one branch deeper.
    const shotIndex = healIndex ?? (visible ? pickWeapon(state, adist, ALLOW_OFFENSIVE, rankPressValue) : null);
    if (shotIndex !== null) attemptAttack(state, 'enemy', shotIndex, events);
  } else {
    const chosenIndex = escaping ? null : (healIndex ?? (visible ? pickWeapon(state, adist, ALLOW_OFFENSIVE, rankPressValue) : null));
    if (chosenIndex !== null) {
      attemptAttack(state, 'enemy', chosenIndex, events);
    } else if (!rooted) {
      const step = speedFor(enemy.characterId, AI_CHASE_SPEED) * dt * aiSlowMult;
      // ⚠️ `tx, ty`, NOT `player.x, player.y`. This is site 3 of the three named in the
      // perception block above, and it was the DIRECT read — the one an implementation
      // that only replaced `adx/ady` would have left pointing at the truth.
      steer(adx / adist, ady / adist, tx, ty);
      moveToward(enemy, STEER.dirX, STEER.dirY, step, state.arena, STEER.navX, STEER.navY);
      attemptedMove = true;
    }
  }

  return attemptedMove;
}
