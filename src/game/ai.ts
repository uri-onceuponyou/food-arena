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
 *   * and a flee branch that AIMS BACKWARDS, so 8 of 11 characters deliver zero damage
 *     from it. Still open — measured, priced at -25.9 pp of player win rate, and parked
 *     for Uri rather than smuggled in. See `stepAI`'s facing block.
 *
 * The shape is always the same: a rule stated once in `rules.ts` and implemented twice.
 * Where this file must diverge from the player it now says so out loud, and
 * `sim.test.mjs` §20 asserts the symmetry behaviourally rather than by inspection.
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
  type Weapon,
  type WeaponType,
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
 *   * the melee cone. In the CHASE branch the AI faces the target it is about to attack,
 *     so the cone check is a no-op. ⚠️ In the FLEE branch it does not — see the facing
 *     block in `stepAI` — and there this key OVERSTATES every directional weapon,
 *     because the swing cannot connect at all. That is a property of the open aim
 *     defect, not of the key: the moment the aim is fixed the key becomes exact again,
 *     and pricing the cone here would bake the defect into the ranking.
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
   * ⚠️ THE FLEE BRANCH BELOW THEN OVERWRITES THIS WITH "DIRECTLY AWAY", AND FIRES ALONG
   * IT. `combat.ts` resolves both the melee cone and the projectile heading off
   * `attacker.facing`, so every straight shot a retreating enemy takes flies AWAY from
   * the target. Measured (`tools/tmp/flee_probe.mjs`, 8 s held below the flee threshold,
   * three separations): 8 of 11 characters deliver ZERO damage from the branch whose own
   * name is "flee and snipe", and the only damage in the whole table comes from the three
   * HOMING weapons, which curve back on their own.
   *
   * NOT FIXED HERE, and that is a decision rather than an oversight. Deleting the line is
   * a two-word patch and it is priced: paired on the same seeds, aggregate player win
   * 31.8% -> 5.9% under `smart2` (-25.9 pp, on top of -19.3 pp for the three fixes that
   * did land), because it takes every character in the roster over the 100 HP the player
   * has — AI damage per match goes 59.7-111.0 to 98.1-113.5, and a win rate measured
   * against a fixed pool is a step function of that, not a slope. At 5.9% the roster
   * table itself stops working (strength sd collapses 20.6 -> 6.8 pp because the AI wins
   * ~97% of everything), so landing it would also blind the instrument the next balance
   * pass needs. It is written up for Uri with the patch and the `ENEMY_MAX_HP` dial
   * re-calibrated against it — `docs/DECISIONS-FOR-URI.md` §12 is where difficulty of
   * this size is decided, and it is not decided here.
   *
   * `sim.test.mjs` §20(d) pins the diagnosis behaviourally, so this cannot be resolved by
   * accident in either direction.
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
    // ⚠️ THE ONE LINE. Aim, not travel — and it is what sends the shot below in the wrong
    // direction. Left in place deliberately; the facing block above carries the
    // measurement, the price and why this is Uri's call and not this file's.
    if (hasBearing) enemy.facing = { x: -adx / adist, y: -ady / adist };
    if (!rooted) {
      const step = AI_FLEE_SPEED * dt * aiSlowMult;
      // Flee target is directly away from the player, so slide around cover toward
      // that point rather than pinning against it — now bent back inside the ring, which
      // is the whole reason a retreating AI used to run itself into the fog. At zero
      // separation "directly away" is not a direction, and `hasBearing` is false, so the
      // branch below is only reachable with a real bearing.
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
    // ⚠️ While the aim defect above is open, a directional melee chosen here CANNOT
    // connect, so a heavy swing spends a 3.5 s cooldown on nothing (measured: Water
    // Bottle takes 3 Mega Splashes in 8 s and deals 0 with them). Ranking around that
    // would bake the defect into the driver; it resolves the moment the aim does.
    const shotIndex = healIndex ?? pickWeapon(state, adist, ALLOW_OFFENSIVE, rankPressValue);
    if (shotIndex !== null) attemptAttack(state, 'enemy', shotIndex, events);
  } else {
    const chosenIndex = escaping ? null : (healIndex ?? pickWeapon(state, adist, ALLOW_OFFENSIVE, rankPressValue));
    if (chosenIndex !== null) {
      attemptAttack(state, 'enemy', chosenIndex, events);
    } else if (!rooted) {
      const step = AI_CHASE_SPEED * dt * aiSlowMult;
      steer(adx / adist, ady / adist, player.x, player.y);
      moveToward(enemy, STEER.dirX, STEER.dirY, step, state.arena, STEER.navX, STEER.navY);
      attemptedMove = true;
    }
  }

  return attemptedMove;
}
