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
 *     once, in `sim.ts:moveFighter` (named `movePlayer` until 2026-08-10), the only caller
 *     of `terrainSlowFactor()` that scales
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
 *     perception block of `stepAI`, the TARGET is read nowhere else in the function, and
 *     `sim.test.mjs` §26(e) pins all three behaviourally in ONE experiment with its
 *     ablation. There is a fourth reader OUTSIDE this file — homing projectiles re-aim
 *     every tick — handled at `sim.ts:stepProjectiles` through the same predicate and
 *     pinned by §26(g).
 *
 * ── AND `stepAI` NOW TAKES THE FIGHTER IT IS DRIVING (2026-08-10) ───────────
 *
 * `stepAI(state, self, dt, events)`. It used to read `state.enemy` and `state.player`, which
 * made "the AI" A PLACE rather than a fighter — two AI-controlled fighters would have shared
 * one seat and driven each other. Its target comes from the single target rule — since
 * 2026-08-11 `state.ts:nearestLivingOpponent`, the same function `combat.ts:attemptAttack`
 * calls, so aim and shot cannot land on different fighters — and its belief from one cell of
 * `MatchState.sightings` addressed by `sightingIndex(self.id, target.id, n)` rather than
 * from a match-wide `aiSighting`. Proven bit-identical at N=2 over state AND events; see the
 * acceptance runs in the two commit messages.
 *
 * ⚠️ NOTHING IN THIS FILE IS A SEARCH BEHAVIOUR, AND THE CAP COMING OFF DID NOT ADD ONE.
 * `stepAI` walks to where it last saw its target and stops (the claim is at
 * `src/arena/types.ts:95`, not at `rules.ts:1034`).
 *
 * WAS: *"…which `DECISIONS §48` measures as the binding constraint on the ×4 arena — 12.00 s
 * to first contact at 27 props, 21.09 s at 108, monotone in prop count."* The prop-count
 * numbers are correct and unchanged. **THE ATTRIBUTION IS FALSIFIED**, and it is kept above
 * rather than deleted because it is quoted in three documents and a reader will find it.
 *
 * ── WHAT WAS MEASURED, 2026-08-11, `tools/tmp/as_cost.mjs` (32) ─────────────
 *
 * The counterfactual is an ORACLE arm — `visible` forced true here and nothing else changed —
 * which is a hard UPPER BOUND on what any search behaviour could ever buy, since a search
 * behaviour guesses where the target went and an oracle already knows. 110 matchups × 8 seeds
 * × 2 policies per arm, identical seeds, timing untouched, self-pair drift control 0/110:
 *
 *   map                      aggregate win        first contact    PAIRED matchups moved
 *   1400×1000 (shipped)      57.6% -> 57.6%       5.67 -> 5.67 s   2 of 110, max 12.5 pp
 *   2800×2000 (§48 hub)      42.7% -> 42.7%      18.45 -> 18.45 s  **0 of 110, BIT-IDENTICAL**
 *
 * And §48's *"traced: AI stalled 50% of the match, longest unbroken stall 18.6 s"* was traced
 * to the wrong cause. Re-run on the layout §48 was measured on (`git show b9bc00e~1`), which
 * reproduces its published table to the digit: `match-sim`'s stall rule reads **51.45% of
 * samples, longest 22.50 s** — and the belief was stale for **0 of 2,020,248 playing ticks**,
 * because that map declared no concealment at all, so `isVisibleFrom` returned true
 * unconditionally. **100% of that stall was an AI that could see exactly where its target was
 * and could not get there.** It was navigation, and `b9bc00e` — which closed 14 unreachable
 * pockets — fixed it: on today's layout the same fixture goes from 542/801 of 880 matches
 * with zero contact to 26/45, contact 36.60 s -> 22.29 s, duty 3.3% -> 16.6%.
 *
 * So the ×4 pacing cost is real and this file is not where it lives. More fighters shortens
 * the expected distance to the NEAREST one, which helps; it is not the fix either, and
 * claiming it would be attributing a pacing result to a change measured for bit-identity.
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
  FOG_DPS,
  HIT_RADIUS_VS_PLAYER,
  speedFor,
  suddenDeathActive,
  TRAIL,
  type Weapon,
  type WeaponType,
} from './rules.ts';
import type { Fighter, GameEvent, MatchState } from './state.ts';
import { isCasting, movementLocked, nearestLivingOpponent, sightingIndex } from './state.ts';
import { attemptAttack, isOnOwnTrail } from './combat.ts';
import { isVisibleFrom, moveToward, terrainSlowAt } from './movement.ts';

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

/** Degrees to radians. One statement, read by the fan geometry and by `PRESS_VALUE`. */
const DEG2RAD = Math.PI / 180;

/** The single on-axis ray a weapon that fans nothing puts metal along. Shared, never rebuilt. */
const ON_AXIS: readonly number[] = [0];

/**
 * ── THE FAN, STATED ONCE: WHICH BEARINGS A PRESS PUTS METAL ALONG ───────────
 *
 * `combat.ts:deliverWeapon` spawns a combo part at its authored `angle` and pellet `i` of
 * `n` at `(i - (n-1)/2) * spreadDeg`, both measured off the caster's `facing` at the
 * instant the weapon goes off. That arithmetic already exists twice in the repo — there,
 * and in `PRESS_VALUE`'s builder below, which turns each offset into `hitRadius / |sin θ|`,
 * the separation at which that part stops landing. A THIRD copy inside the threat geometry
 * is exactly the defect this file is named for, so both readers here take their angles from
 * this one function, and `sim.test.mjs` §33(m) pins it against the bearings the REAL
 * `combat.ts` spawns rather than against another copy of the formula.
 *
 * A weapon that fans nothing returns the single on-axis ray, which is the correct
 * description of a lone projectile and of a melee swing alike.
 */
function fanOffsetsDeg(w: Weapon): readonly number[] {
  if (w.comboParts) return w.comboParts.map((p) => p.angle);
  const n = w.pellets ?? 1;
  if (n <= 1) return ON_AXIS;
  const spread = w.spreadDeg ?? 0;
  const out: number[] = [];
  for (let i = 0; i < n; i++) out.push((i - (n - 1) / 2) * spread);
  return out;
}

/**
 * Precomputed at module load for the same reason `PRESS_VALUE` is: `dangerSteer` runs
 * every tick of every match and this file allocates nothing in the steady state. Keyed on
 * Weapon OBJECT IDENTITY, which is safe here and stated in `DECISIONS §75` — `CHARACTERS`
 * is a module-level `Record`, so weapon records are process-wide singletons.
 */
const FAN_OFFSETS: ReadonlyMap<Weapon, readonly number[]> = (() => {
  const m = new Map<Weapon, readonly number[]>();
  for (const id of CHARACTER_IDS) for (const w of CHARACTERS[id].weapons) m.set(w, fanOffsetsDeg(w));
  return m;
})();

/**
 * Where `(x, y)` stands relative to the set of points an OPEN CAST can put damage on, and
 * the cheapest way out of it.
 *
 * `margin` is a signed distance in world units: **negative inside** the threatened set and
 * equal to how far the fighter must travel to leave it, **positive outside** and equal to
 * the clearance it has. `outX/outY` is the unit direction along which `margin` grows
 * fastest — the shortest way out, which is not always "straight away from the caster".
 * `null` means this weapon threatens nothing at all.
 *
 * ⚠️ It returns a FRESH object rather than writing a module-level scratch the way `DANGER`
 * and `STEER` do, and that is a deliberate departure from this file's no-allocation rule:
 * it allocates only while a wind-up is actually open — at most one per living fighter per
 * tick, for the ~1 s a cast lasts, and never in the steady state — and a shared mutable
 * return is exactly the footgun that has cost this project a differ, an accessor and a
 * getter. Correctness at the call site is worth more than an allocation nobody can measure.
 *
 * ⚠️ **THIS IS A PREDICTION, NOT A SECOND COPY OF THE RESOLUTION RULE.** The authoritative
 * answer to "does this connect" lives in `combat.ts:deliverWeapon` and
 * `sim.ts:stepProjectiles` and stays there. What this returns is a CONSERVATIVE BOUND on
 * it — it may call a fighter threatened that would in fact have been missed; it must never
 * call one safe that would have been hit. It is exported for the reason `pressValue` above
 * it is exported: `sim.test.mjs` §33(m) checks this bound against the damage the REAL
 * combat path delivers over a swept grid of bearings and separations, and a copy of the
 * arithmetic in the test would only have tested the copy.
 */
export interface CastThreat {
  /** Signed wu to the boundary of the threatened set. < 0 inside (= the escape distance). */
  margin: number;
  /** Unit direction in which `margin` grows fastest. */
  outX: number;
  outY: number;
}

/**
 * ── ⚠️ THE OLD REFUSAL, KEPT VERBATIM, BECAUSE IT WAS RIGHT FOR MELEE ──────
 *
 * This function replaces a line that read `if (w === undefined || w.type !== 'melee')
 * continue;`, under this reasoning:
 *
 *   > *"A melee weapon resolves on `range` alone from the caster's frozen position (there
 *   > is no `hitRadius` term — that is projectiles), so the threatened set is a disc of
 *   > `w.range` centred on the caster. A CONE weapon threatens only a wedge of that disc;
 *   > fleeing the whole disc is conservative in the safe direction and needs no bearing.
 *   > ⚠️ A RANGED cast would need a different answer entirely — a ranged `range` is how
 *   > far the projectile TRAVELS, not an area around the caster, and reading it as a
 *   > radius here would make an AI flee a circle that does not exist. There are no ranged
 *   > casts today; this refuses them explicitly rather than by accident."*
 *
 * **The melee half of that is exactly right and is reproduced below unchanged.** The
 * refusal was also right on the day it was written: a ranged cast read as a disc of
 * `w.range` IS a circle that does not exist for a fan. What made it wrong to KEEP is that
 * it made a ranged wind-up a telegraph no bot can ever react to, which fails Uri's
 * *"a telegraph you can dodge"* from the other seat — `DECISIONS §77`.
 *
 * ⚠️ **AND ITS STATED REASON IS HALF WRONG, WHICH IS WHY THE FIX IS THREE SHAPES AND NOT
 * ONE FORMULA.** Under AUTHORISED DEVIATION #12 `Projectile.traveled` is charged with the
 * ground GAINED on the target, not with path length — so for a HOMING volley the circle is
 * real: the shot dies once it has closed `range` of separation and connects inside
 * `hitRadius`, which is a disc of `range + hitRadius` centred on the caster and carries no
 * bearing at all. For a NON-HOMING fan it is not a disc: the pellets fly the frozen
 * bearings `fanOffsetsDeg` returns and never turn, so the threatened set is the union of
 * their `hitRadius` tubes — a wedge — and the cheapest exit from a wedge is SIDEWAYS, not
 * outward. One disc law would make a bot flee 153 wu of open ground to dodge something a
 * 43 wu sidestep clears, and would flee a fan aimed 90° away from it.
 *
 * ── WHY `hitRadius` IS THE VICTIM'S AND NOT A CONSTANT ────────────────────
 *
 * `sim.ts:stepProjectiles` reads `target.hitRadius` — a property of whoever is being shot
 * at, not of the shooter and not of a seat. `PRESS_VALUE` above uses the constant
 * `HIT_RADIUS_VS_PLAYER` because it ranks a press before a target is known; this is asked
 * about ONE named fighter, so it takes that fighter's own number and cannot drift from the
 * sim the way a seat-name branch did (`sim.ts:1184`).
 *
 * ── WHAT THIS DELIBERATELY OVER-APPROXIMATES, AND IN WHICH DIRECTION ──────
 *
 *   * **A cast hits ONE fighter — `nearestLivingOpponent` AT THE RESOLVE** — so at N>2
 *     everyone else inside the set is fleeing a shot that was never theirs. That is
 *     already true of the melee term and is left alone deliberately: predicting who will
 *     be nearest 1.1 s from now is a second, quieter statement of the target rule, and at
 *     N=2 — every corpus in this repo — the two answers are identical.
 *   * **A melee `cone` is treated as the whole disc**, unchanged from the line above.
 *   * **A fan is bounded at `range + hitRadius` along the beam**, which is the homing
 *     bound; a straight pellet chasing a receding target drifts off its own axis and dies
 *     sooner, so the real wedge is shorter. Over-approximating length is safe; the test
 *     measures how much.
 */
export function castThreat(
  caster: Fighter,
  w: Weapon,
  x: number,
  y: number,
  hitRadius: number,
): CastThreat | null {
  const range = w.range ?? 0;
  if (range <= 0) return null;

  const dx = x - caster.x;
  const dy = y - caster.y;
  const d = Math.hypot(dx, dy);
  // Coincident with the caster: any direction is equally out. +x, matching the pot's own
  // degeneracy answer in `dangerSteer` — and reachable (measured: 1,582 of 160,642 ticks
  // across 110 real matches sit at separation exactly 0).
  const ux = d > EPS ? dx / d : 1;
  const uy = d > EPS ? dy / d : 0;

  switch (w.type) {
    // A heal targets its caster. There is nothing to stand outside of.
    case 'self':
      return null;

    // UNCHANGED, ARITHMETIC AND ALL: `margin = d - radius`, radial exit. Every castless
    // weapon and every melee cast therefore produce the identical steering they did
    // before this function existed, which is the claim `csx_bitid` measures.
    case 'melee':
      return { margin: d - range, outX: ux, outY: uy };

    case 'ranged': {
      // The shot dies once it has GAINED `range` on its target (AUTHORISED DEVIATION #12)
      // and connects inside `hitRadius`, so `range + hitRadius` is the separation past
      // which it cannot arrive. For a homing volley that is the whole answer.
      const reach = range + hitRadius;
      const radial = d - reach;
      if (w.homing) return { margin: radial, outX: ux, outY: uy };

      // ── THE WEDGE ───────────────────────────────────────────────────────
      //
      // The beam axis is the caster's FROZEN facing — `sim.ts:applyAim` and this file's
      // own facing block are the sim's only two writers of `facing` and both refuse while
      // a cast runs, so the bearing at the press survives to the resolve by construction.
      // A caster with no bearing cannot happen (`sim.ts:defaultFacing` never writes a zero
      // one) but a zero axis would silently make every wedge point due east, which is how
      // "a cornered AI fires due east" got into this project once already — so it falls
      // back to the disc rather than to a direction it invented.
      const am = Math.hypot(caster.facing.x, caster.facing.y);
      if (am < EPS) return { margin: radial, outX: ux, outY: uy };
      const fx = caster.facing.x / am;
      const fy = caster.facing.y / am;
      // Coordinates in the beam's frame: `along` down the axis, `perp` 90° to its left.
      const along = dx * fx + dy * fy;
      const perp = -dx * fy + dy * fx;

      // How far this fighter would have to travel PERPENDICULAR to the beam — left
      // (`needLeft`) or right (`needRight`) — before every pellet misses it. In pellet
      // `j`'s own frame the fighter sits `a` down its ray and `s` to its left; the pellet
      // misses once |s| >= hitRadius, and a step of Δ to the beam's left moves `s` by
      // `Δ·cos θ`. The binding pellet is the one that needs the LARGEST step, which is why
      // this is a max and not a min: leaving one tube by entering another is not an escape.
      //
      // 🚨 **A RAY IS NOT A LINE, AND THE FIRST DRAFT OF THIS FUNCTION USED THE LINE.**
      // `|s|` is the distance to the pellet's INFINITE line, which is small directly BEHIND
      // the caster as well as in front of it — so the wedge ran out of the muzzle in both
      // directions and the model called a fighter standing 100 wu behind a Taco threatened
      // by a fan pointing away from it. Caught by `tools/tmp/ub_threat.mjs`'s bearing sweep
      // (over-reach 130.00 wu at β=180°, against a sim that hits nothing past 20 wu there),
      // and it is exactly the class this project keeps paying for: an assertion I could not
      // have talked myself out of, from a grid I did not choose to flatter the model.
      // A pellet with `a < 0` has the fighter behind its muzzle and cannot reach it by
      // flying forwards, so it constrains nothing.
      //
      // NEITHER TERM IS CLAMPED AT ZERO, deliberately — a negative `need` is the clearance
      // an already-safe fighter has, and clamping it would report every fighter in the
      // arena as sitting exactly on the boundary of every fan.
      let needLeft = -Infinity;
      let needRight = -Infinity;
      let anyForward = false;
      let lateral = true;
      for (const deg of FAN_OFFSETS.get(w) ?? fanOffsetsDeg(w)) {
        const r = deg * DEG2RAD;
        const c = Math.cos(r);
        const sn = Math.sin(r);
        const a = along * c + perp * sn;
        if (a < 0) continue;
        // A part fanned 90° or more off the beam cannot be escaped by a lateral step —
        // stepping left carries you ACROSS it. There is no such part in the roster today
        // (the widest is Topping Swarm's ±82.5°, and it homes), and rather than invent a
        // rule for one, the whole weapon falls back to the disc bound, which is the
        // conservative direction.
        if (c <= EPS) { lateral = false; break; }
        anyForward = true;
        const s = perp * c - along * sn;
        const l = (hitRadius - s) / c;
        const rr = (hitRadius + s) / c;
        if (l > needLeft) needLeft = l;
        if (rr > needRight) needRight = rr;
      }
      if (!lateral) return { margin: radial, outX: ux, outY: uy };
      // EVERY pellet has already gone past this fighter, so the only thing that can still
      // touch it is the muzzle itself: a projectile spawns AT the caster and the hit test
      // runs from the first tick, so anything inside `hitRadius` of a firing caster is hit
      // whatever the bearing. Measured: the sim lands Double Toss at 20 wu and β=180°.
      // Straight out is the exit, and `d - hitRadius` is nearer than `d - reach`, so this
      // is the larger margin and returning it is still "the cheapest way out".
      if (!anyForward) return { margin: d - hitRadius, outX: ux, outY: uy };

      // The cheaper of the two sideways exits, as a signed margin on the same scale as
      // `radial`: leaving the wedge costs `need` wu, so the margin is `-need`.
      //
      // ⚠️ THE TIE GOES LEFT, AND IT IS A TIE OFTEN — a fighter standing exactly on the
      // beam is equidistant from both edges, and that is the commonest case there is,
      // because the caster was aiming AT it when it pressed. `dangerSteer`'s pot tiebreak
      // resolves the same degeneracy with the fighter's own intent; this one cannot see
      // it, and reaching for anything less deterministic than "left" is out of the
      // question — **the sim contains zero randomness and that underwrites every balance
      // number in the project** (`DECISIONS §77`). Fixed left is the honest answer: it is
      // deterministic, it is symmetric between the two seats, and the fighter's own intent
      // is still blended in one line later, which is what actually bends the dodge.
      const left = needLeft <= needRight;
      const sideways = left ? -needLeft : -needRight;
      // Outrunning the beam and stepping out of it are two ways to be safe, so the fighter
      // needs whichever is nearer — the LARGER signed margin. A fan is a wedge, so far
      // enough down the axis the radial exit is the cheap one and this picks it up without
      // a second branch.
      if (radial >= sideways) return { margin: radial, outX: ux, outY: uy };
      return { margin: sideways, outX: left ? -fy : fy, outY: left ? fx : -fx };
    }
  }
  // `WeaponType` is a closed union, so a fourth weapon category cannot be added to
  // `rules.ts` without `tsc` demanding an answer here — the same compiler-as-guard device
  // `WeaponAllow` uses below, and for the same reason: three code reviews were not enough.
  const exhaustive: never = w.type;
  return exhaustive;
}

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
 *
 * ── ⚠️ AND AN INCOMING WIND-UP IS THE THIRD HAZARD, NOT A FOURTH BRANCH ──────
 *
 * `ownSpeed` (wu/ms, including this tick's slow multiplier) is here for that third loop
 * and for nothing else: a telegraph is the only hazard with a DEADLINE, so it is the only
 * one where "can I actually clear this?" has an answer. See the loop for why the question
 * has to be asked.
 */
function dangerSteer(
  state: MatchState,
  self: Fighter,
  intentX: number,
  intentY: number,
  ownSpeed: number,
): number {
  const x = self.x;
  const y = self.y;
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

  // ── AN INCOMING WIND-UP IS A HAZARD THAT HAS NOT HAPPENED YET ──────────────
  //
  // This is the whole AI half of `Weapon.castMs`, and it is deliberately a third term in
  // an existing function rather than a dodge BRANCH in `stepAI`. A branch would be a
  // fourth thing competing with the pot, the ring and the fighter's own intent, arbitrated
  // by whichever `if` came first; a term is arbitrated by the blend that already exists,
  // and it inherits `AI_ESCAPE_PRIORITY` unchanged — *"surviving outranks shooting when
  // t >= 1"* is exactly the sentence a telegraph wants, already written, already tested.
  //
  // 🚨 **AND IT IS WHAT MAKES THE FEATURE SYMMETRIC.** Without it the counterplay Uri
  // asked for exists only for the bot: a human is 1.71x AI chase speed and `stepAI` has no
  // dodge of any kind, so a human's telegraph would be a free execute while the AI's is
  // dodgeable on reflex. That asymmetry is the same shape as the recorded stun-silence
  // bug (the stunned player fired 100% of its shots, the stunned AI 0%) pointed the other
  // way, and it would have measured as "the ultimate is fine" on every AI-vs-AI corpus in
  // the repo — which is every corpus in the repo.
  //
  // ── THE GEOMETRY IS PER SHAPE, AND IT LIVES IN `castThreat` ──────────────
  //
  // WAS `if (w === undefined || w.type !== 'melee') continue;`, with a comment giving the
  // reason. **That comment is kept verbatim on `castThreat`**, because it was a deliberate
  // decision and it was right for melee — and because half of its stated reason turned out
  // to be false, which is what decided the shape of the replacement. Read it there.
  //
  // What is left in this loop is the part that was never about shape: how far into the
  // threatened set this fighter is, whether it can get out before `resolvesAt`, and how
  // hard to push. All three are unchanged, arithmetic included, which is why every melee
  // cast and every castless weapon steers bit-identically to before.
  for (const other of state.fighters) {
    if (other === self || !other.alive) continue;
    const cast = other.cast;
    if (cast === null) continue;
    const w = CHARACTERS[other.characterId].weapons[cast.weaponIndex];
    if (w === undefined) continue;
    // `self.hitRadius`, not a constant: it is the VICTIM's number that `stepProjectiles`
    // reads, and this is asked about one named fighter.
    const threat = castThreat(other, w, x, y, self.hitRadius);
    if (threat === null) continue;
    const margin = threat.margin; // > 0 = already outside the threatened set and safe
    if (margin >= AI_HAZARD_MARGIN) continue;

    // ⚠️ **ONLY RUN FROM A TELEGRAPH YOU CAN ACTUALLY CLEAR.** Without this the AI flees
    // Lollipop's 400 wu slam for the whole 1.5 s, gets nowhere near the edge, and eats it
    // anyway — having spent the window not shooting. A range test is BINARY: escaping 90%
    // of the way out is worth exactly zero, so a hopeless flee is strictly worse than
    // ignoring the cast. Same arithmetic as the caster's own "do not open what you cannot
    // land", pointed the other way, which is why they are stated in the same units.
    //
    // ⚠️ **AND IT IS THE ESCAPE DISTANCE FOR *THIS* SHAPE, NOT A RADIUS.** For a wedge
    // that is a sideways step of tens of wu where the disc reading would have demanded
    // hundreds — so a bot that would correctly refuse a hopeless disc now correctly
    // ATTEMPTS a dodgeable fan. One quantity, three geometries, one test.
    const remainingMs = Math.max(0, cast.resolvesAt - state.elapsed);
    if (margin < 0 && -margin > ownSpeed * remainingMs) continue;

    // Same normalisation every other hazard uses: 0 at the outer edge of the margin,
    // exactly 1 at the boundary, 2 one full margin inside it.
    const t = Math.min(2, (AI_HAZARD_MARGIN - margin) / AI_HAZARD_MARGIN);
    // PURE ESCAPE, with no tangential term. WAS "PURE RADIAL", and the argument is
    // unchanged: the pot gets `HAZARD_TANGENT` because it is a fixed obstacle the fighter
    // wants to get PAST; a cast is transient and there is nothing on the far side of it to
    // reach. The shortest path out is the only thing that matters — `castThreat` now says
    // which way that is, and for a wedge it is across the beam rather than away from it.
    DANGER.x += threat.outX * t * AI_HAZARD_WEIGHT;
    DANGER.y += threat.outY * t * AI_HAZARD_WEIGHT;
    if (t > worst) worst = t;
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
type WeaponRank = (state: MatchState, self: Fighter, w: Weapon, index: number, adist: number) => number;

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
 *
 * ── ⚠️ WHAT THIS KEY STILL DOES NOT PRICE: THE TARGET IS MOVING ─────────────
 *
 * `pressValue` is validated to the digit — `press_value.mjs` 183 of 183 cells exact,
 * `sim.test.mjs` §20(b) against the real combat path. **Every one of those cells is
 * measured against a STATIONARY target.** `press_value.mjs` sweeps eight SEPARATIONS;
 * until 2026-08-10 nothing in the repo had ever fired a weapon at a target with a
 * velocity, so the key is exact for the geometry it was validated on and silent about
 * the one that decides half the roster's matchups.
 *
 * It matters for HOMING weapons and it is not small. `sim.ts:stepProjectiles` retires a
 * projectile at `p.traveled >= w.range`, and `traveled` is CUMULATIVE PATH LENGTH, not
 * displacement — so a curve spends budget without spending separation, and a homing
 * volley is in a RACE it can lose. Big Catch has `range` 140 and `speed` 160 wu/s: it
 * exists for 875 ms and 140 wu of path, whichever ends first. Against a target receding
 * at `AI_CHASE_SPEED` (70 wu/s) the closing rate is 90 and it always arrives. Against
 * one receding at `PLAYER_SPEED` (120) the closing rate is 40 and it expires in flight.
 *
 * `tools/tmp/ac_homing.mjs` measures exactly that — one press, one separation, a target
 * on a prescribed constant velocity, delivered HP off `hit-landed`. At 95 wu, as a
 * fraction of what THIS KEY promises (selftest 11, and the rig reproduces `pressValue`
 * exactly at speed 0 for all five weapons it calibrates on):
 *
 *   weapon               speed  lifetime   vs a CHASE-speed target   vs a PLAYER-speed one
 *   burrito/Topping Swarm  160     875ms                      85%                     45%
 *   egg/Hatch!              80    1750ms                      40%                     20%
 *   sushi/Big Catch        160     875ms                     100%                     47%
 *
 * ⚠️ **AND THE TWO ROLES NEVER SHOOT AT THE SAME TARGET.** `PLAYER_SPEED` is 0.12 wu/ms
 * and `AI_CHASE_SPEED` is 0.07 — a fixed 1.71x that `speedFor` applies to both roles, so
 * the human ALWAYS shoots at the slow one and this file ALWAYS shoots at the fast one.
 * Every homing weapon in the roster is therefore worth **1.89x to 2.14x more in the
 * player's hands than in the AI's, with no decision differing anywhere.**
 *
 * ── WHY THAT IS RECORDED HERE AND NOT FIXED HERE ────────────────────────────
 *
 * It is the whole of the Sushi role split, and it is NOT a defect in this file.
 * `tools/tmp/ac_engage.mjs --mirror` puts one character on both sides of a match with
 * `smart2` driving one and `stepAI` the other — same kit, same pool ratio, same speed
 * ratio, same arena, so the ONLY difference is the driver. Sushi comes back at **99.2%**
 * to the scripted player, the roster's largest driver gap by 30 pp, and the per-weapon
 * breakdown localises **96.5% of the entire damage gap to one press**:
 *
 *   sushi mirror, 128 seeds   P press  P dmg  P d/press  |  A press  A dmg  A d/press
 *   Big Catch                    2.02   53.6      26.48  |     2.02   25.6      12.65
 *
 * Both sides press it the SAME 2.02 times a match, from the same separation (93 vs 97 wu),
 * for the same authored 27. `ac_homing` predicts 47% against a player-speed target; the
 * mirror measures 12.65/27 = 47%. Two instruments that share no code agree to the digit.
 *
 * So there is no decision for this file to make better. Everything `stepAI` chooses on
 * Sushi is already at least as good as the scripted player's — measured, not assumed:
 * it presses from CLOSER (69 wu vs 90), which for a monotone-decreasing kit curve is
 * strictly better (kit EXPRESSION 65% against the player's 50%), its blind-fire rate is
 * 0.4% of ranged presses, and its press-value efficiency is within 2 pp. The gap is
 * entirely in what the projectile does after release, and the variable that decides it —
 * the target's speed — is the one thing an AI cannot change about its opponent.
 *
 * A velocity-aware rank was considered and refused: at 47% Big Catch is still worth 12.65
 * against Seaweed's 5, so the CHOICE does not change and the fix is worth exactly zero on
 * the character that has the problem. (It would re-order Burrito's Swarm 20 -> 9.0 below
 * Disc 10, and Egg's Hatch! 15 -> 3.0 below Shards 4 — neither of which has the problem
 * badly, and both of which are a new behaviour with its own balance cost.)
 *
 * The lever that DOES work is one token in `rules.ts`, priced and handed over rather than
 * taken: `sushi.Catch.speed` 160 -> 280 (`rangedMax` at `FLIGHT_MS.normal`, already on the
 * ladder — no new constant). `roster_lab.mjs --seeds 32`, staged, against a no-op staging
 * control that reproduced the unstaged run **110/110 cells bit-identical**:
 *
 *   quantity                        shipped   speed 280   floor
 *   settled matchups                 14/110      12/110   a count, exact
 *   roster strength range             9.7pp       7.3pp   improved
 *   roster MINIMUM                    43.8%       45.9%   RAISED
 *   rarity tier spread               8.05pp       5.9pp   improved
 *   aggregate player win              57.6%       57.8%   ~9pp — INSIDE the floor
 *   sushi role split                 +30.7pp    +32.5pp   ~9pp — INSIDE the floor
 *
 * PAIRED per-matchup delta (a different, EXACT quantity): **15 of 110 cells moved, max
 * |Δ| 18.8 pp, and every single one involves Sushi.** Nothing else in the roster is
 * touched. Contrast `6cc2438`'s refused vitals candidate, which moved 17 cells at max
 * 65.6 pp, widened the roster range 9.7 -> 16.6 pp and LOWERED the roster minimum to
 * 43.3% — this raises the floor instead, which is what that pass could not buy at any
 * rung. ⚠️ **It does NOT close the role split**, which stays inside the aggregate floor:
 * it fixes the roster-balance half of the finding and leaves the fairness half open.
 *
 * ⚠️ The comparison is NOT void under the re-seeding trap. That trap is about the
 * DRIVER's decision cadence being a function of countdown length; `w.speed` is read by
 * `stepProjectiles` and by nothing in `scripted_player.mjs`, `COUNTDOWN_FROM` is
 * untouched, and the seeded stream at the whistle is therefore identical. The matches
 * diverge downstream because the physics differs, which is the effect being measured.
 */
interface PressProfile {
  /** Damage that lands at any separation the weapon reaches at all. */
  always: number;
  /** Off-axis parts: this one lands while the target is nearer than `maxDist`. */
  offAxis: readonly { maxDist: number; damage: number }[];
}

const PRESS_VALUE: ReadonlyMap<Weapon, PressProfile> = (() => {
  // WAS a local `const DEG2RAD = Math.PI / 180;`. Hoisted to module scope when the threat
  // geometry became a second reader of the same conversion — one statement, same value, so
  // every cell of `press_value.mjs`'s 183 is unchanged.
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
          // WAS: "A melee swing, a single projectile, and a HOMING volley all land whole:
          //   the homing term steers every pellet back onto the target, measured and
          //   confirmed (Burrito's 4-pellet 55° fan delivers its full 20 at all eight
          //   separations)." TRUE AT ALL EIGHT SEPARATIONS AND FALSE AT SPEED — kept
          //   because the melee/single-projectile half is still exactly right, and
          //   because the homing half was correctly measured against the only geometry
          //   anyone had ever varied. See "WHAT THIS KEY STILL DOES NOT PRICE" below.
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

const rankPressValue: WeaponRank = (_state, _self, w, _index, adist) => pressValue(w, adist);

/**
 * The AI's only defensive resource. See `rules.ts` AUTHORISED DEVIATION #7 — until
 * `07a4e3a` this was unreachable code for the AI and usable by the player, on the same
 * character. `-Infinity` for a heal that is not worth spending yet, which is how the
 * "not hurt enough" and "would overheal" rules reach the one selector.
 */
const rankHeal: WeaponRank = (_state, self, w) => {
  const heal = w.healAmount ?? 0;
  if (heal <= 0) return -Infinity;
  if (self.hp > self.maxHp * AI_SELF_HEAL_HP_FRACTION) return -Infinity; // not hurt enough
  if (self.maxHp - self.hp < heal) return -Infinity; // would overheal — wait
  return heal;
};

/**
 * The index of the best weapon the enemy may use right now, or null.
 *
 * Eligibility is the same three questions for every caller — is this a category I will
 * consider, is it off cooldown, does it reach — and only the RANK differs. A `self`
 * weapon has no `range`, so `range ?? Infinity` makes the reach test a no-op for it
 * rather than a special case.
 *
 * ── `castBudgetMs` — THE FOURTH QUESTION, AND IT IS "DO NOT OPEN WHAT YOU CANNOT FINISH" ──
 *
 * The longest wind-up (`rules.ts:Weapon.castMs`) this fighter may commit to right now.
 * `Infinity` is the ordinary case and refuses nothing, so every castless weapon and every
 * caller that has nothing to say about wind-ups is unaffected — which is all of them
 * today, because the budget only drops below `Infinity` in the two situations `stepAI`
 * derives it from.
 *
 * ⚠️ It is a BUDGET IN MILLISECONDS rather than an `allowCasts` boolean deliberately. The
 * question is never "may I cast" but "may I stand still for THIS long", and the two
 * answers differ per weapon the moment a second cast weapon exists with a different
 * duration. A boolean would have to be recomputed by the caller per weapon, i.e. here,
 * i.e. twice. See `range`, which this file's own history records as *"two quantities
 * wearing one number"* — the fix for that is not to add a third.
 */
function pickWeapon(
  state: MatchState,
  self: Fighter,
  adist: number,
  allow: WeaponAllow,
  rank: WeaponRank,
  castBudgetMs: number,
): number | null {
  const weapons = CHARACTERS[self.characterId].weapons;
  const now = state.elapsed;

  let bestIndex: number | null = null;
  let bestScore = -Infinity;
  for (let i = 0; i < weapons.length; i++) {
    const w = weapons[i];
    if (!allow[w.type]) continue;
    if (now - self.lastUsed[i] < w.cooldown) continue;
    if (adist > (w.range ?? Infinity)) continue;
    // Strict `>=`: a wind-up that finishes exactly when the budget runs out has not
    // finished in time. The budget is a deadline, not an allowance.
    if ((w.castMs ?? 0) > 0 && (w.castMs ?? 0) >= castBudgetMs) continue;
    const score = rank(state, self, w, i, adist);
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
export function stepAI(state: MatchState, self: Fighter, dt: number, events: GameEvent[]): boolean {
  if (state.phase !== 'playing') return false;

  // ⚠️ `self` AND `target`, NOT `state.enemy` AND `state.player`. This function used to
  // read both seats off the match by name, which made "the AI" a place rather than a
  // fighter: two AI-controlled fighters would have shared one `state.enemy` and driven each
  // other. `sim.ts`'s fighter loop now hands it whichever slot it is stepping, and the
  // target comes from the one target rule.
  //
  // ── ⚠️ AND IT IS `nearestLivingOpponent` NOW, NOT `opponentOf` ─────────────
  //
  // Was `const target = opponentOf(state, self); if (self.hp <= 0 || target.hp <= 0) return
  // false;` — EXACTLY equivalent at two seats, because `opponentOf`'s answer with `hp <= 0`
  // is precisely this function's `null` (`alive` is written only where `hp` reaches 0). At
  // six it is the difference between an AI that fights whoever is nearest and an AI that
  // stares at slot 0 forever.
  //
  // 🚨 IT MUST BE THE SAME FUNCTION `combat.ts:attemptAttack` CALLS, and this is the reason:
  // everything below prices a weapon against THIS target's separation (`pressValue(w,
  // adist)`), points `facing` at it, and then hands `attemptAttack` a weapon INDEX — which
  // resolves the target again. Two rules there and the AI ranks its kit against one fighter
  // while swinging at another, which is not a bug any balance instrument in this repo could
  // localise. Same call, same tick, nothing moves in between. See `state.ts`.
  //
  // ⚠️ The target is chosen on TRUE positions while everything below acts on the BELIEF. That
  // is deliberate and it is the same split `isVisibleFrom` already draws: WHO you are
  // fighting is not a perception question (you know who hit you), WHERE they are is. Making
  // the choice belief-based would let a fighter forget an opponent exists by walking behind
  // a plate, which is a design change, not a generalisation.
  const target = nearestLivingOpponent(state, self);
  if (self.hp <= 0 || target === null) return false;

  const now = state.elapsed;

  /**
   * ── PERCEPTION: THE ONE PLACE THIS FILE LOOKS AT ITS TARGET ────────────────
   *
   * Everything below is derived from `tx, ty` — WHERE THIS FIGHTER BELIEVES ITS TARGET IS —
   * and `target.x/y` appears nowhere else in `stepAI` after these five lines. That is the
   * entire point of the block, and it is a guard rather than a tidy-up.
   *
   * ⚠️ It used to say `state.player.x/y`, because there was one AI and one human and the
   * function read both seats off the match by name. The GUARD is unchanged — one read, three
   * derived sites — but the quantity it is about is now the fighter this call was handed
   * and the fighter the target rule returned, not two properties of `MatchState`.
   *
   * `tools/tmp/p4_coverdensity.mjs`'s probe report found that this function read the
   * player's TRUE position at three independent sites, and that they were not all derived
   * from one another:
   *
   *   1. `adx/ady` here             — separation, weapon-range gating, press value, intent
   *   2. `self.facing` below        — aim; `combat.ts` resolves the melee cone AND the
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
   * target's exact position on every tick and `tx, ty === target.x, target.y` identically.
   * That is not an argument, it is the acceptance test: `tools/tmp/conceal_lab.mjs --bitid`
   * runs 110 matchups x 32 seeds against a `--sim-ref` extraction of the previous commit
   * and requires ZERO differing ticks.
   *
   * ⚠️ AND IT IS STRONGER THAN "INERT": `conceal_lab.mjs --ablate` perturbs THIS CELL on
   * EVERY TICK of its whole corpus on the shipped arena and finds **zero** difference in
   * state or events, because the refresh above happens before the read below. The same
   * perturbation on an arena that HAS regions diverges. The belief is not merely equal to
   * the truth with no cover — it is causally unreachable. (No count here on purpose: the
   * corpus size is `--seeds`, and the tool prints what it actually ran.)
   */
  // ⚠️ `state, target` ARE THE §29c ARGUMENTS, AND THIS ONE CALL IS WHY THE RULE REACHES
  // ALL THREE SITES. Destroyed cover (`MatchState.brokenConcealment`) and the reveal window
  // a fighter's own attack buys (`Fighter.revealedUntil`) are per-MATCH facts that
  // `ArenaDefinition` cannot carry — it is one shared object across every match a process
  // runs. Because the perception block below derives `tx, ty` from this single boolean, and
  // `target` is read nowhere else in `stepAI`, adding them here routes the reveal to
  // the separation, the facing AND the nav target in one edit. Route it to two of the three
  // and you get the sixth instance of this file's oldest defect; `sim.test.mjs` §26(k)
  // pins all three behaviourally in one experiment, with its ablation.
  const visible = isVisibleFrom(self.x, self.y, target.x, target.y, state.arena, state, target);
  // THIS OBSERVER'S ROW, THIS TARGET'S COLUMN. One cell of `MatchState.sightings`, mutated
  // in place — the belief belongs to the pair, not to the match, which is why the single
  // `state.aiSighting` became an N x N matrix. At N=2 the index is 1 * 2 + 0 = 2, which is
  // exactly the cell `aiSighting` aliases, so this reads and writes the same object it
  // always did.
  const sighting = state.sightings[sightingIndex(self.id, target.id, state.fighters.length)];
  if (visible) {
    sighting.x = target.x;
    sighting.y = target.y;
    sighting.at = now;
  }
  const tx = sighting.x;
  const ty = sighting.y;

  const adx = tx - self.x;
  const ady = ty - self.y;
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

  const fleeing = self.hp < self.maxHp * AI_FLEE_HP_FRACTION;
  /**
   * ── 🚨 TERRAIN IS IN HERE NOW, AND ITS ABSENCE WAS THE FIFTH DEFECT ────────
   *
   * IT USED TO READ, and the wording is kept because the rule it states is NOT reversed —
   * the STATUS half is exactly as it was:
   *
   *   > `const aiSlowMult = now < self.status.slowedUntil ? AI_SLOW_MULTIPLIER : 1;`
   *
   * `rules.ts` states the terrain rule twice, in prose, and both times for *anyone*:
   * `PUDDLE_SLOW_FACTOR` (*"slows anyone inside it"*) and `SPLAT_DURATION_MS` (*"slows
   * anyone standing in it"*). It was implemented ONCE, in `sim.ts:moveFighter`, which moves
   * HUMAN-controlled fighters — so **every bot walked through every puddle and every splat
   * at full speed while the human seat crawled.** Measured with a one-tick control rather
   * than read off the source (`sim.test.mjs` §25(a)): player ratio 0.450000, enemy ratio
   * 1.000000. That is a permanent handicap on the only seat a person ever occupies, and Uri
   * has been playing this build.
   *
   * ⚠️ **THE TWO TERMS MULTIPLY, THEY DO NOT `Math.min`.** `moveFighter` has always
   * multiplied its terrain factor by `SLOW_MOVE_MULTIPLIER` (and by `TRAIL.speedBoost`), so
   * a slowed player standing in a puddle is 0.45 x 0.45. Taking the strongest of the two
   * instead would make the AI's stacking rule differ from the player's, which is the very
   * shape being closed here — one rule, two implementations.
   *
   * ⚠️ **`terrainSlowAt` IS IMPORTED, NEVER RE-DERIVED.** `movement.ts` exists so this file
   * and `sim.ts` can share a movement rule without an import cycle; a private copy of the
   * hazard/splat geometry here would be the defect back the day either radius moved.
   *
   * ⚠️ The two multipliers are NOT the same constant and that is deliberate:
   * `AI_SLOW_MULTIPLIER` (0.35) is harsher than the player's `SLOW_MOVE_MULTIPLIER` (0.45)
   * — `DECISIONS §75` records it as a live asymmetry in the STATUS effect. Terrain has one
   * factor for everybody, because a floor does not know who is standing on it.
   */
  /**
   * ── 🚨 THE STICKY TRAIL IS IN HERE NOW, AND ITS ABSENCE WAS THE SEVENTH DEFECT ──
   *
   * ⚠️ **AND IT SURVIVED THE PASS THAT FIXED THE SIXTH**, three paragraphs up, which is
   * the part worth reading: `b2be2f7` added the TERRAIN term to this exact expression,
   * measured it with a one-tick control, and did not look for the other multiplier
   * sitting beside it in `sim.ts:moveFighter`. One rule stated in `rules.ts` and
   * implemented twice is this file's oldest and most expensive shape, and fixing one
   * instance of it is not evidence about the next line.
   *
   * `rules.ts:TRAIL.speedBoost` (1.35) is applied in `sim.ts:moveFighter` — which moves
   * HUMAN-controlled fighters — and was applied nowhere else, so **a Donut bot got no
   * speed from its own trail while a Donut player got 35%.** Measured with the same
   * one-tick control that caught the terrain defect (`tools/tmp/bb_probe.mjs --trail`,
   * 12 ticks, a mark injected under the fighter each tick): **player ratio 1.350000,
   * enemy ratio 1.000000.** Donut is the roster's only `hasTrail: true` character, so
   * this is one character's passive reaching one seat.
   *
   * ⚠️ **`wm_gate` PASSES `trail-speed-boost` AND ALWAYS WOULD HAVE.** That term is read
   * off a FIELD — `def.hasTrail === true && TRAIL.speedBoost > 1` — and never measured on
   * a bot, which is the identical blind spot that hid `splat-slows-anyone` until it was
   * made a MEASURED term. A vocabulary term that reads a constant cannot see who the
   * constant reaches. The hunk that would fix it is routed to that file's owner.
   *
   * ⚠️ **IT MULTIPLIES, IT DOES NOT `Math.min`/`Math.max`** — same rule as the terrain
   * term above. `moveFighter` has always written `terrain * boost * slow`, so a boosted
   * Donut standing in a puddle is 0.45 x 1.35, and taking the strongest term instead
   * would make the AI's stacking rule differ from the player's — the very shape being
   * closed here.
   *
   * ⚠️ **`isOnOwnTrail` IS IMPORTED FROM `combat.ts`, NEVER RE-DERIVED.** That function's
   * own header says it lives there *"so both call sites share one definition"*; this is
   * the third, and a private copy of the `ownerId` + radius test here would be the defect
   * back the day `TRAIL.radius` moved. This file already imports `attemptAttack` from the
   * same module, so no new dependency edge exists.
   *
   * ⚠️ **WAS `aiSlowMult`, AND THE OLD NAME IS RECORDED BECAUSE IT STOPPED BEING TRUE.**
   * The expression can now be greater than 1, so a name that says "slow" would mislead
   * the next reader at exactly the line where the boost has to be noticed.
   */
  const aiSpeedMult = (now < self.status.slowedUntil ? AI_SLOW_MULTIPLIER : 1)
    * terrainSlowAt(self.x, self.y, state.arena, state.splats)
    * (isOnOwnTrail(state, self) ? TRAIL.speedBoost : 1);

  /**
   * ── WHAT A STUN LOCKS ────────────────────────────────────────────────────
   *
   * `rules.ts` states the rule once — `STUN_DURATION_MS`, "stunned = movement locked
   * to 0" — and `sim.ts:moveFighter` (was `movePlayer`) implements exactly that and
   * nothing more: a
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
  //
  // ── ⚠️ AND IT IS NO LONGER JUST THE STUN. IT USED TO READ: ────────────────
  //
  //   > `const rooted = now < self.status.stunnedUntil;`
  //
  // The rule that wording stated is NOT reversed — it is now stated somewhere else.
  // `sim.ts:moveFighter` carried the identical comparison, so one constant had two
  // implementations in the two files whose disagreement is the defect class this header
  // is about. `state.ts:movementLocked` is the single statement, and it adds the one other
  // thing that locks movement: an open `ActiveCast`. Putting the cast root in one of the
  // two sites and not the other would have produced the SIXTH instance of this file's
  // oldest bug, in the exact mirror of the recorded one — a casting human rooted while a
  // casting AI walked away from its own telegraph. `sim.test.mjs` §33(e) source-scans for
  // it rather than trusting this paragraph.
  const rooted = movementLocked(self, now);

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
  //
  // ⚠️ **AND A WIND-UP FREEZES IT.** `isCasting`, not `rooted`: a stunned fighter still
  // aims (that is the paragraph above, and undoing it is the recorded bug), while a
  // casting one must not, because `ActiveCast` stores no bearing and relies on this site
  // and `sim.ts:applyAim` — the sim's only two writers of `facing` — both refusing. A
  // caster that could re-aim mid-cast would make the telegraph a lie about where the
  // effect lands, which is the one property the whole feature rests on.
  if (hasBearing && !isCasting(self)) {
    self.facing = { x: adx / adist, y: ady / adist };
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
  // The speed this fighter will ACTUALLY move at this tick, in wu/ms — the branch it is
  // about to take (`fleeing` decides that, and it is already known) times this tick's slow
  // multiplier. Passed in rather than re-derived inside `dangerSteer` so the "can I clear
  // this telegraph in time?" test uses the same number the movement below will use; a
  // conservative guess there would be a second, quieter statement of the AI's own speed.
  const ownSpeed = speedFor(self.characterId, fleeing ? AI_FLEE_SPEED : AI_CHASE_SPEED) * aiSpeedMult;
  const danger = dangerSteer(state, self,
    (intentSign * adx) / adist, (intentSign * ady) / adist, ownSpeed);
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
    STEER.navX = self.x + STEER.dirX * STEER_LEAD;
    STEER.navY = self.y + STEER.dirY * STEER_LEAD;
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

  /**
   * ── HOW LONG THIS FIGHTER MAY COMMIT TO STANDING STILL, IN MS ──────────────
   *
   * `Infinity` — the ordinary case — refuses nothing, so nothing about weapon selection
   * changes for a roster with no wind-ups. It drops in exactly two situations, and both
   * are "a cast I open now will not be alive to resolve", which is the concrete form of
   * *"the AI must not begin a cast it cannot land"*.
   *
   *   1. **STANDING IN SOMETHING THAT HURTS.** `urgent` is this file's existing sentence
   *      for *"this fighter is already taking damage, or is about to on this tick"* — the
   *      pot, the closing ring, or (new) an incoming telegraph. Rooting yourself there for
   *      the length of a wind-up is strictly dominated by moving. ⚠️ `urgent`, NOT
   *      `escaping`: `escaping` is false for a fighter that cannot move anyway, and the
   *      point here is that opening a cast is a CHOICE to stop moving, which a rooted
   *      fighter is not making. The FLEE branch deliberately still shoots while escaping —
   *      an instant press costs it nothing — and this is the line between the two.
   *
   *   2. **SUDDEN DEATH.** `SUDDEN_DEATH_RADIUS` is 0, so the fog burns the whole arena at
   *      `FOG_DPS` and there is nowhere to stand. Surviving a cast therefore costs
   *      `castMs * FOG_DPS / 1000` HP flat, and `hp * 1000 / FOG_DPS` is how many ms of
   *      standing this fighter has left. `pickWeapon`'s test is `castMs >= budget`, so a
   *      wind-up that finishes exactly as the fighter dies is refused.
   *
   *      ⚠️ **AND THERE IS NO SIM-SIDE SUDDEN-DEATH RULE, WHICH IS A DECISION.** A cast
   *      opened before the collapse still resolves inside it. Cancelling on the trigger
   *      would make the moment a hidden coin-flip on when the button happened to be
   *      pressed. The flat drain also cannot change the HP ORDER — the only thing sudden
   *      death resolves on — so casting costs the caster nothing RELATIVE to its target;
   *      what it costs is the rest of the match, and that is a judgement the AI makes here
   *      rather than a rule the sim imposes on the player.
   *
   * ⚠️ `FOG_DPS` is imported, never written as `15 / 300`. The fog is stated once, in
   * `rules.ts`, beside the two constants it comes from.
   */
  const castBudgetMs = urgent ? 0
    : suddenDeathActive(state.timeRemaining) ? (self.hp * 1000) / FOG_DPS
    : Infinity;

  // The heal is chosen before the flee/chase split because it is worth the same in both,
  // and it consumes the tick's ATTACK exactly like any other weapon — never both.
  const healIndex = escaping ? null : pickWeapon(state, self, adist, ALLOW_HEAL, rankHeal, castBudgetMs);

  if (fleeing) {
    // ⚠️ NOTHING WRITES `facing` HERE ANY MORE. A line that pointed it directly away from
    // the player used to sit on exactly this spot, and `attemptAttack` below fired along
    // it. Aim is set once, at the player, in the facing block above — read it before
    // re-introducing anything that turns a retreating fighter's aim with its feet.
    if (!rooted) {
      const step = speedFor(self.characterId, AI_FLEE_SPEED) * dt * aiSpeedMult;
      // Flee target is directly away from the player, so slide around cover toward
      // that point rather than pinning against it — now bent back inside the ring, which
      // is the whole reason a retreating AI used to run itself into the fog. At zero
      // separation `adx`/`ady` are both 0, so "directly away" is not a direction: the
      // heading degenerates to zero and the nav target lands on the fighter's own feet.
      // That is unchanged by the aim fix and is the movement half of the same degeneracy
      // `hasBearing` answers for the aim — see the facing block.
      steer(-adx / adist, -ady / adist,
        self.x - (adx / adist) * STEER_LEAD, self.y - (ady / adist) * STEER_LEAD);
      moveToward(self, STEER.dirX, STEER.dirY, step, state.arena, STEER.navX, STEER.navY);
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
    const shotIndex = healIndex ?? (visible ? pickWeapon(state, self, adist, ALLOW_OFFENSIVE, rankPressValue, castBudgetMs) : null);
    if (shotIndex !== null) attemptAttack(state, self, shotIndex, events);
  } else {
    const chosenIndex = escaping ? null : (healIndex ?? (visible ? pickWeapon(state, self, adist, ALLOW_OFFENSIVE, rankPressValue, castBudgetMs) : null));
    if (chosenIndex !== null) {
      attemptAttack(state, self, chosenIndex, events);
    } else if (!rooted) {
      const step = speedFor(self.characterId, AI_CHASE_SPEED) * dt * aiSpeedMult;
      // ⚠️ `tx, ty`, NOT `player.x, player.y`. This is site 3 of the three named in the
      // perception block above, and it was the DIRECT read — the one an implementation
      // that only replaced `adx/ady` would have left pointing at the truth.
      steer(adx / adist, ady / adist, tx, ty);
      moveToward(self, STEER.dirX, STEER.dirY, step, state.arena, STEER.navX, STEER.navY);
      attemptedMove = true;
    }
  }

  return attemptedMove;
}
