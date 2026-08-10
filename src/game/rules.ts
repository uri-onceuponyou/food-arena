/**
 * GAME DESIGN — single source of truth.
 *
 * Almost every number here is transcribed verbatim from the original 2D prototype
 * (`reference/prototypes/kitchen-gameplay-prototype.html`) and the roster screen
 * (`reference/prototypes/characters-screen.html`). Character identity, ability
 * behaviour, damage, cooldowns and match structure are unchanged.
 *
 * DO NOT tune these values for "game feel" on a hunch. If a value seems wrong, it is
 * still the spec until a deviation is deliberately authorised and recorded here.
 *
 * ── AUTHORISED DEVIATION #1 (2026-08-03): weapon REACH and projectile SPEED ──────
 *
 * Every weapon `range` and ranged `speed` below is now derived from the `REACH` and
 * `FLIGHT_MS` ladders instead of being a transcribed magic number. Uri's call; see
 * that section for the full rationale. Nothing else moved: damage, cooldown, cone,
 * pellet counts, effects, hit radii, movement speeds and arena geometry are all as
 * they were. `PROTOTYPE_VIEWPORT` below is kept as the historical record of WHY the
 * old ranges were what they were.
 *
 * The other sanctioned exception is arena geometry (see `arena.ts`), which the brief
 * explicitly opened up for redesign.
 */

// ─────────────────────────────────────────────────────────────────────────────
// World & match structure
// ─────────────────────────────────────────────────────────────────────────────

/**
 * Prototype world was 900x600 "world units" with a 360x240 scrolling viewport.
 * We keep this unit system, so every damage radius, hit radius and movement speed
 * below is numerically identical to the prototype's. (Weapon reach and projectile
 * speed are the one exception — see `REACH` for why and by how much.) The 3D arena
 * is authored in these same units; the brief allows the arena to grow, so WORLD_W/H
 * are overridden by the loaded arena, which is 1400x1000.
 */
export const PROTOTYPE_WORLD = { w: 900, h: 600 } as const;

/**
 * Prototype camera window, in world units. HISTORICAL RECORD, not a live input — the
 * 3D camera derives its framing from `FAIR_PLAY` in `render/camera.ts` instead.
 *
 * Kept because it is the evidence for the range retune: a 360 wu wide window paired
 * with a 260 wu weapon means the 2D design always allowed an attacker to shoot you
 * from off screen. See `REACH`.
 */
export const PROTOTYPE_VIEWPORT = { w: 360, h: 240 } as const;

/**
 * ── AUTHORISED DEVIATION #2 (2026-08-05): MATCH LENGTH ──────────────────────
 *
 * Was 180_000 (3:00), transcribed from the prototype. Measured against the shipped
 * arena with `tools/match-sim.mjs --all-matchups` (110 matchups, the real `sim.ts`,
 * the real cover layout):
 *
 *   mean match          19.6 s      = 10.9% of a 180 s clock
 *   longest of 110      28.8 s      = 16.0%
 *   matches that ever reached the clock                 0 / 110
 *   closing fog's share of ALL damage dealt             1.5%
 *   ring radius when the median match ended             797 wu of a 890 wu opening
 *
 * So the entire closing-zone system — the ring, its HUD readouts, the fog damage
 * model — was dead weight: it had barely started moving when every match was already
 * over. A clock nobody reaches is not a clock.
 *
 * ── How 45 s was chosen ─────────────────────────────────────────────────────
 *
 * Swept 25/30/35/40/45/50/60/90/180 s through the real sim (the emulator in
 * `tools/tmp/simlayer_clock_sweep.mjs` drives any schedule by writing the one field
 * the ring derives from, so nothing had to be edited to measure it):
 *
 *      T      fog share of all damage      ring R when the median match ends
 *     25 s          34.2%                             384 wu
 *     30 s          19.0%                             444 wu
 *     40 s           9.7%                             560 wu
 *     45 s           8.1%                             598 wu
 *     60 s           2.6%                             655 wu
 *    180 s           1.5%                             797 wu
 *
 * Three constraints decided it, in this order:
 *
 *  1. THE CLOCK MUST NOT TRUNCATE A REAL FIGHT. The scripted player takes a mean
 *     13.0 s just to reach contact (the arena's spawn separation — see
 *     `docs/STATE.md` PART 2 #11 — is a known, separate problem), and the fight
 *     itself then runs a mean 6.6 s. 45 s is 1.6x the longest natural match measured
 *     (28.8 s) and 2.3x the mean. At 25-30 s the clock would be cutting off fights,
 *     not stalemates — and the fog's damage share (19-34%) would make the zone a
 *     co-primary damage source rather than a positional pressure.
 *  2. THE RING MUST ACTUALLY BITE. At 45 s the fog goes from 1.5% to 8.1% of all
 *     damage — a 5.4x increase — and the ring is inside the arena's inscribed radius
 *     (500 wu, where it first starts cutting the playfield rather than the corners)
 *     from t = 22.3 s, which is inside the top ~20% of matches by length.
 *  3. IT MUST STILL BE OUTRUNNABLE. The ring's edge now sweeps at 22.1 wu/s against
 *     a player speed of 120 wu/s. Beating the zone is a matter of noticing it, never
 *     a footrace — which is the same property the 180 s clock had (4.9 wu/s).
 *
 * ⚠️ INTERLOCK: `src/arena/shared.ts` DERIVES the opening ring radius from this
 * constant, so shortening the clock GROWS the opening ring (890 -> 993 wu) to keep
 * the fog's first contact with the arena's corners pinned at t = 6 s. That is
 * deliberate. Anything reading `arena.maxSafeRadius` as a fixed 890, or normalising a
 * widget by a hardcoded arena size, will now be wrong — see the report.
 */
export const MATCH_DURATION_MS = 45_000; // 0:45

/**
 * ── AUTHORISED DEVIATION #8 (2026-08-05): COUNTDOWN_FROM 5 -> 3 ─────────────
 *
 * `COUNTDOWN_FROM * 1000 + COUNTDOWN_START_FLASH_MS` is the ONLY block of a match in
 * which the simulation is, by construction, incapable of doing anything: `stepMatch`
 * gates `applyAim`, `attemptAttack`, `movePlayer`, `stepAI` and `applyWorldTick` on
 * `phase === 'playing'`, so during the countdown the two fighters stand on their spawns
 * and no code path can change that. It was **5,700 ms**.
 *
 * ── What that was worth, measured ───────────────────────────────────────────
 *
 * `tools/tmp/pacing_ladder.mjs` (110 matchups x 8 seeds x 4 policies = 3,520 matches,
 * shipped arena) reports the shape of a match from the moment PLAY is pressed, against
 * a denominator that INCLUDES the countdown — which no instrument here did before, so
 * the number below had never been printed:
 *
 *                                          policy `smart2`      policy `chase`
 *   countdown                                 5.68 s               5.68 s
 *   then the approach                         5.33 s               5.31 s
 *   => FIRST CONTACT AT                      11.01 s              10.99 s
 *   engaged (either fighter can reach)        5.86 s               4.00 s
 *   disengagement after first contact         0.61 s               0.03 s
 *   DUTY CYCLE (engaged / session)            31.6%                26.3%
 *
 * So **62.6% of the session is dead time, and the countdown is 51.6% of that dead
 * time** — a larger block than the walk it precedes. It is also the only one of the
 * three with no mechanism behind it: the approach is where the flow field works and
 * where positioning happens; the countdown is a number going down.
 *
 * ── Why 3, and why nothing else in this block moved ─────────────────────────
 *
 * 3 is the genre's count, which is the brief's bar (Brawl Stars, Zooba). The 700 ms
 * "START!" hold is KEPT: it is the readable whistle, and cutting it buys 0.7 s of a
 * quantity already fixed by 2.0 s while making the one legible moment in the sequence
 * harder to see. `COUNTDOWN_START_FLASH_MS` is therefore deliberately untouched.
 *
 * ── What it costs: NOTHING, and that is proven rather than argued ───────────
 *
 * Nothing in `stepMatch` reads absolute `elapsed`. `lastUsed`, `lastDamagedAt` and both
 * status stamps are initialised to `-Infinity` in `state.ts:createFighter`; `fogTimer`,
 * `regenTimer`, `trailDropTimer` and `hazardTimers` are accumulators from 0; `expiresAt`
 * on splats and trail marks is always `elapsed + duration`. So the countdown can only
 * translate the clock, never change the match.
 *
 * Measured PAIRED on the ladder above — same arena, same seeds, same matchups:
 *
 *   policy    player win        per-matchup |Δ|        matchups moved
 *   smart2    27.2% -> 27.2%    max 0.0 pp             **0 of 110**
 *   chase     18.8% -> 18.8%    max 0.0 pp             **0 of 110**
 *   kite       0.0% ->  0.0%    max 0.0 pp             **0 of 110**
 *   survive    0.8% ->  0.8%    max 0.0 pp             **0 of 110**
 *
 * Every one of the 3,520 matches is bit-identical. This is the rare case where a
 * pacing change has a provable zero balance cost, and `sim.test.mjs` section 21 now
 * asserts the property that makes it so ("the countdown leaves no residue"), so a
 * future change that gives the countdown a side effect fails loudly instead of quietly
 * re-pricing the roster.
 *
 * ── What it buys ───────────────────────────────────────────────────────────
 *
 *   first contact, session clock   11.01 s -> **9.01 s**   (chase 10.99 -> 8.99)
 *   duty cycle                     31.6%   -> **35.8%**    (chase 26.3% -> 30.3%)
 *   session length                 17.46 s -> 15.46 s
 *
 * ⚠️ MAKES STALE: every figure quoted against the old 5.7 s pre-match. Named ones —
 * `tools/tmp/hudshot.mjs`'s "5,700 ms" comment, the HUD pass's "5.7 s = 31.8% of a
 * 17.9 s fight / 24.2% of the session", and the audio pass's 6.55 s whistle-to-first-
 * sound gap (that one is a MATCH-CLOCK figure and is unmoved; what changes is how much
 * silence precedes it). `src/audio/sounds.ts:countdownTick` indexes its pitch ladder as
 * `steps[5 - value]`, which still rises with three ticks (698/784/784 Hz) but now uses
 * only the top of a five-rung ladder — flagged to the audio owner, not changed here.
 */
export const COUNTDOWN_FROM = 3; // 3 → 2 → 1 → "START!"
export const COUNTDOWN_START_FLASH_MS = 700; // "START!" hold before play begins

/**
 * HISTORICAL RECORD, not a live input — and the doc comment here used to claim
 * otherwise. **Nothing imports this.** `sim.ts` reads `arena.maxSafeRadius` (see the
 * block comment above `createMatch`), `arena/shared.ts` exports its own
 * `MAX_SAFE_RADIUS` DERIVED from `MATCH_DURATION_MS` (993 at the 45 s clock), and
 * `arena/kitchen.ts` imports that one. 545 is the prototype's figure for its 900x600
 * arena; it has had no consumer since the arena grew to 1400x1000.
 *
 * The old comment also stated the formula wrong: the live one is
 * `max(MIN_SAFE_RADIUS, arena.maxSafeRadius * (1 - matchProgress))` — it has a FLOOR.
 * Kept, like `PROTOTYPE_VIEWPORT`, as the record of where the number came from.
 */
export const MAX_SAFE_RADIUS = 545;

/**
 * 15 HP per 300 ms = **50 HP/s** outside the ring. Deliberately left alone by the
 * 2026-08-05 constant audit: a damage RATE against an HP POOL is scale-invariant, so
 * the clock change cannot mistune it. What it does mean is that the pools are not
 * symmetric — 100 HP survives 2.0 s in the fog and 150 HP survives 3.0 s — which is
 * exactly the unfairness `MIN_SAFE_RADIUS` below exists to keep out of the endgame.
 */
export const FOG_TICK_MS = 300;
export const FOG_DAMAGE = 15;

/**
 * FLOOR on the closing ring: `safeRadius` never shrinks below this.
 *
 * Without it the ring reaches zero at the final whistle, which means the last seconds
 * of any match that goes the distance contain NO ground that costs 0 HP/s — and at
 * that point the outcome is pure arithmetic, not play: both fighters burn the same
 * FOG_DAMAGE per FOG_TICK_MS, so the one with the smaller HP pool dies first. That is
 * always the player when this floor was written (PLAYER_MAX_HP 100 vs ENEMY_MAX_HP 150):
 * measured on the real sim, with both fighters pinned and unable to attack, the player
 * died at 2.00 s and the enemy at 3.00 s. **Running the clock out was an arithmetically guaranteed loss**, and
 * it pre-empted the timeout rule below — the tiebreak could never fire because the fog
 * always resolved the match first.
 *
 * Value: the arena's central damage hazard (the boiling pot, `POT.dangerRadius` = 95)
 * sits ON the arena centre, so the ring must clear it or "safe" ground does not exist.
 * 95 + one body length (PLAYER_SIZE = 42) = 137, rounded to 140 — a 45 wu-wide safe
 * annulus around the pot. `sim.test.mjs` asserts that relationship so a bigger pot
 * cannot silently re-create the bug.
 *
 * This is the genre convention too: a battle-royale final circle is small, not empty.
 *
 * ⚠️ AUTHORISED DEVIATION #9 took `ENEMY_MAX_HP` to 90, so THE TWO POOLS HAVE INVERTED
 * and the fog now kills the ENEMY first (1.80 s against the player's 2.00 s). This floor
 * is unchanged and is if anything more clearly right for it: the argument was never
 * "protect the player", it was "the endgame must be decided by play and not by whichever
 * pool happens to be smaller", and that is symmetric in the pools by construction.
 */
export const MIN_SAFE_RADIUS = 140;

/**
 * Central hazard (the boiling pot in the prototype). 8 HP per 250 ms = 32 HP/s.
 *
 * ⚠️ MEASURED DEAD IN EFFECT, and NOT because of these numbers — do not "fix" it by
 * raising `damage`. `arena/hazards.ts` now registers the pot as a SOLID CoverBox of
 * `bodyRadius * 2` (104x104) because a fighter standing inside the mesh was 0.0%
 * visible. That fix is correct, and it silently ate the hazard: `movement.ts:tryMove`
 * refuses any destination whose 42 wu body overlaps the box, so a fighter's CENTRE can
 * never get closer than `bodyRadius + PLAYER_SIZE/2` = 73 wu. Measured
 * (`tools/tmp/pot_burn_area.mjs`):
 *
 *   standable share of the burn disc          26.2%
 *   burn band on axis (0 deg / 90 deg)        22.0 wu wide
 *   burn band on the diagonal (45 deg)        ZERO — nearest standable point is 103.3 wu
 *   matches that took ANY pot damage           1.0% (smart) · 0.6% (chase) · 0.0% (idle)
 *   pot share of all damage dealt              0.1%
 *
 * Widening it is a BALANCE change and it is BOXED IN at both ends: `dangerRadius` must
 * exceed 73 to burn anyone at all, and `MIN_SAFE_RADIUS` (140) must clear
 * `dangerRadius + PLAYER_SIZE/2`, so the usable window is 73 < dangerRadius <= 119.
 * `sim.test.mjs` section 17(c) asserts both ends. Parked for Uri.
 */
export const POT = {
  x: 450,
  y: 300,
  bodyRadius: 52,
  dangerRadius: 95,
  tickMs: 250,
  damage: 8,
} as const;

/**
 * Standing-water hazard: slows anyone inside it.
 *
 * ⚠️ Today it slows the PLAYER only — see the block on `SPLAT_DURATION_MS` below, which
 * carries the measurement, the price and the reason it is parked. The shipped arena has
 * two of these (r=50, at 560,900 and 840,100), so the defect is not confined to the
 * `splatter` weapons.
 */
export const PUDDLE_SLOW_FACTOR = 0.45;

// ─────────────────────────────────────────────────────────────────────────────
// Entities
// ─────────────────────────────────────────────────────────────────────────────

export const PLAYER_MAX_HP = 100;

/**
 * ── AUTHORISED DEVIATION #9 (2026-08-05): ENEMY_MAX_HP 150 -> 90 ────────────
 *
 * **Uri's dial, and Uri turned it.** `docs/DECISIONS-FOR-URI.md` §15 asked one question
 * — "should a fleeing enemy be able to shoot at you?" — and the answer came back as both
 * halves of the priced package: land the flee-aim fix in `ai.ts`, and take this constant
 * to 90 so the fix does not simply end the game. They are ONE decision and they land in
 * ONE commit, because either alone is a different game from the one he agreed to.
 *
 * ── Why the two are inseparable ─────────────────────────────────────────────
 *
 * The flee branch pointed `facing` directly AWAY from the player and fired along it, and
 * `combat.ts` resolves both the melee cone and the projectile heading off
 * `attacker.facing`. So 8 of 11 characters delivered ZERO from the branch called "flee
 * and snipe". Fixing it is a two-word deletion — and the mechanism is a THRESHOLD, not a
 * slope: AI damage per match crosses the player's 100 HP pool for every character at
 * once, so the whole roster tips together.
 *
 * ── RE-MEASURED, because everything under it had moved ──────────────────────
 *
 * The prices Uri was quoted (31.8% -> 5.9% -> 52.8%) were taken with the driver family
 * whose stuck detector runs during the countdown, before `COUNTDOWN_FROM` went 5 -> 3 in
 * `099119a` — and the size of that artefact is a function of `countdownMs mod ~1200`, so
 * it changed when the countdown did. Re-measured on the FIXED driver
 * (`tools/tmp/roster_lab.mjs`, 110 matchups x 32 seeds x 2 policies = 7,040 matches a
 * row, shipped arena, paired on identical seeds; its `--selftest` reproduces
 * `pacing_ladder.mjs`'s published 27.2% / 18.8% to the digit, which is what makes it the
 * same match as that tool's):
 *
 *   rung                                    smart2   chase   settled   strength sd
 *   shipped before this commit               27.4%   18.4%   70/110      20.5 pp
 *   + flee-aim fix alone                      5.0%    3.1%   91/110       6.2 pp
 * >>+ flee-aim fix, ENEMY_MAX_HP 90          52.2%   45.0%   43/110      24.7 pp
 *
 * Every quoted figure reproduces in SHAPE and lands inside this project's ~9 pp aggregate
 * resolution floor of the number Uri approved (52.2% against 52.8%). The absolute
 * baseline is 27.4% rather than 31.8% because the driver was fixed, not because the game
 * changed — that gap IS the instrument artefact, now measured.
 *
 * TWO THINGS THE MIDDLE ROW EARNS ITS PLACE FOR. At 5.0% the roster instrument saturates
 * (strength sd 20.5 -> 6.2 pp; the AI wins ~95% of everything and every character looks
 * identical), which would have blinded the balance pass that follows this one. And the
 * shipped row does the OPPOSITE: sd 24.7 pp is the widest this roster has ever measured,
 * so the instrument discriminates BETTER after the change than before it.
 *
 * ⚠️ AND A BONUS THAT IS NOT WHOLLY FREE: settled matchups — the 110 cells where one side
 * wins >=95% or <=5% across every seed, `DECISIONS §13(c)`'s headline — go **70 -> 43**.
 * Declared honestly: that metric is NOT independent of the aggregate. Any change that
 * moves the aggregate toward 50% de-settles cells mechanically, and this moved it 22.6 pp.
 * The honest quantity is the settled count AT a fixed aggregate, and that is what the
 * per-character work above this line has to be judged on.
 *
 * ── WHAT ELSE THIS CONSTANT WAS HOLDING UP ──────────────────────────────────
 *
 * ⚠️ **THE POOLS HAVE INVERTED.** The enemy pool was 1.5x the player's and is now 0.9x,
 * so three arguments written against "the enemy has more HP" now run the other way. None
 * of them needed a code change — every one was already written as a rule rather than as
 * an arithmetic accident — but they were checked, one at a time:
 *
 *   * `MIN_SAFE_RADIUS` existed because a ring that closes to nothing kills the SMALLER
 *     pool first, which was always the player's (2.00 s vs 3.00 s in the fog). It is now
 *     the enemy's (1.80 s vs 2.00 s). The floor is still exactly right and still needed:
 *     its job is that safe ground EXISTS, so the tiebreak below decides the match instead
 *     of the arithmetic — whichever way the arithmetic happens to point.
 *   * `resolveTimeout` ranks on HP **fraction**, not absolute HP, precisely so the pools
 *     may differ. That is pool-size independent and unchanged.
 *   * `sim.test.mjs` §10(c) constructed "absolute HP favours the enemy, the fraction
 *     favours the player" from two hardcoded numbers, which is only buildable while
 *     `ENEMY_MAX_HP > PLAYER_MAX_HP`. It now DERIVES the disagreement from the two
 *     constants and asserts it in whichever direction they imply, so it tests the rule
 *     rather than the era. §19(e)'s time-to-kill bound is calibrated against a 150 HP
 *     pool, so its fixture now pins one: a difficulty dial must not silently re-calibrate
 *     an output test.
 *
 * ── The dial, re-calibrated, so the next person does not have to re-sweep ───
 *
 * Against the tree this commit leaves behind, `smart2` aggregate player win:
 *
 *   ENEMY_MAX_HP    150     130     115     100    >>90<<     80
 *   player win     5.0%   13.7%   23.0%   34.3%    52.2%   68.0%
 *
 * ⚠️ Read that curve before turning the dial: it is NOT a slope. 100 -> 90 is worth
 * 17.9 pp and 90 -> 80 another 15.8 pp, against 8.7 pp for 150 -> 130. The pools are
 * crossing (PLAYER_MAX_HP is 100), and near the crossing every point of HP decides more
 * matches than it does anywhere else on the curve — which is exactly why the flee-aim
 * fix could not be landed without also choosing this number.
 *
 * `PLAYER_MAX_HP` is deliberately NOT the lever: it is the number every HUD bar, every
 * damage figure and every reference to "a 100 HP player" in this repo is written
 * against.
 */
export const ENEMY_MAX_HP = 90;
export const PLAYER_SIZE = 42;
export const ENEMY_SIZE = 42;

/** Base movement: px per ms. Prototype: `0.12 * dt * speedMult`. */
export const PLAYER_SPEED = 0.12;
/** AI chase / flee speeds. Prototype: `0.07 * dt` and `0.085 * dt`. */
export const AI_CHASE_SPEED = 0.07;
export const AI_FLEE_SPEED = 0.085;
/** AI retreats below this fraction of max HP. */
export const AI_FLEE_HP_FRACTION = 0.28;
/** Movement multiplier applied to a slowed AI. */
export const AI_SLOW_MULTIPLIER = 0.35;

/**
 * ── AUTHORISED DEVIATION #6 (2026-08-05): THE AI CAN SEE HAZARDS ────────────
 *
 * `ai.ts` had NO term for the closing ring and NO term for the boiling pot. Its flee
 * vector pointed directly away from the player and its chase vector directly at them,
 * so it walked into the fog while retreating and stood in the fire while shooting.
 * The scripted player has explicit "leave the pot" and "stay inside the ring" clauses,
 * so this was not a difficulty setting — it was a one-sided handicap:
 *
 *                            (shipped layout, `smart2`, 110 matchups)
 *   pot damage                  5.2% player / 94.8% enemy
 *   fog damage                  0.0% player / 100.0% enemy
 *   killed by the zone          player 0.0%  ·  enemy 11.8% fog + 4.5% pot
 *
 * The pot only became load-bearing when the 2026-08-05 arena pass revived it (0.0% ->
 * 8.7% of all damage under `smart`, 24.6% under `chase`), and it is now the LARGER half
 * of the blind spot. Both are the same missing concept, so both are one steering term.
 *
 * ⚠️ Avoidance has to be a STEERING term, not a walk-out reaction. `arena/hazards.ts`
 * registers the pot as a solid CoverBox of `bodyRadius * 2`, so `tryMove` stops a
 * fighter's centre at 73 wu while the burn ring reaches 95 wu: a fighter that walks in
 * is PINNED INSIDE THE FIRE and cannot push through to the far side. The only exit is
 * back the way it came, which is exactly what a radial push produces — but it has to
 * start before entry, which is what the margins below are for.
 *
 * Margins are sized against reaction distance, not taste. The AI moves at
 * AI_CHASE_SPEED 70 wu/s (0.07 wu/ms) and AI_FLEE_SPEED 85; the ring's edge sweeps at
 * 22.1 wu/s on the 45 s clock. 140 wu is ~2.0 s of warning at flee speed and matches the
 * ring margin the scripted player's own `survive` policy uses, so the two sides now read
 * the zone the same way. 60 wu on the pot is a little over one body length (42) outside
 * the burn ring — enough to turn, not so much that the arena centre becomes a no-go area
 * once the ring closes past it.
 *
 * ── WHAT IT DELIVERS, and what it costs ─────────────────────────────────────
 *
 * 8,800 matches per side (110 matchups x 16 seeds x 5 policies, shipped arena), measured
 * TOGETHER with DEVIATION #5 because the two interact:
 *
 *                                    `smart`            `smart2`           `chase`
 *   pot damage to the enemy      7.8 -> 0.0 HP      18.0 -> 0.1 HP     15.8 -> 0.0 HP
 *   fog damage to the enemy      2.1 -> 0.0 HP       2.8 -> 0.1 HP       0.0 -> 0.0 HP
 *   enemy killed by the zone        6.5% -> 0.1%       9.1% -> 0.4%       0.0% -> 0.0%
 *   player win rate               52.8% -> 44.1%    62.1% -> 51.3%     25.5% -> 18.4%
 *
 * ⚠️ The SIGN of the win-rate change is not uniform, and the exception is instructive:
 * isolated, the hazard fix costs the player 4.9 pp under `smart2` and GIVES them 10.8 pp
 * under `chase`. Both are correct. Under `chase` the scripted player charges through the
 * pot and eats 49 HP a match from it against the enemy's 16 — so an AI that steers around
 * the fire also stops LEADING the player into it, and the 12 HP that saves a 100 HP
 * player is worth more than the 16 HP it stops costing a 150 HP enemy. A player who
 * already avoids hazards only ever sees the AI get better.
 */
export const AI_RING_MARGIN = 140;
export const AI_HAZARD_MARGIN = 60;
/**
 * Steering weights, relative to the fighter's own intent (which always has weight 1).
 * At the boundary the danger term equals its weight, and it grows to 2x that one full
 * margin past the boundary — so an AI already burning or already outside the ring is
 * steered by the hazard 4-5x more strongly than by the player.
 */
export const AI_RING_WEIGHT = 2.0;
export const AI_HAZARD_WEIGHT = 2.5;
/**
 * ENCROACHMENT at which SURVIVING OUTRANKS SHOOTING. `stepAI` fires OR moves in a given
 * tick, never both, so an AI with a weapon off cooldown simply stops moving — which is
 * how it came to stand inside the burn ring for whole seconds trading shots while the pot
 * did 32 HP/s to it. Steering cannot fix that on its own; it never gets to steer.
 *
 * The unit is `dangerSteer`'s normalised encroachment, NOT a weight: 0 at the outer edge
 * of the margin, **1 exactly at the boundary**, 2 a full margin past it. So 1.0 means
 * "the moment it is actually being damaged, and not a step before" — the AI keeps
 * shooting all the way up to the fire and through the whole warning band, and only then
 * prefers its feet. An earlier draft compared against the WEIGHTED value instead, which
 * silently put the no-shoot line 36 wu outside the burn ring and 70 wu inside the ring
 * edge, and cost the AI enough output to swing `chase` by +10 pp in the PLAYER's favour.
 */
export const AI_ESCAPE_PRIORITY = 1.0;

/**
 * ── AUTHORISED DEVIATION #7 (2026-08-05): THE AI CAN USE `self` WEAPONS ─────
 *
 * `pickHighestDamageWeapon` skipped `type === 'self'` and `pickSniperWeapon` required
 * `'ranged'`, so there was NO code path by which an enemy Hamburger ever healed:
 * measured 0 fires across 11 matchups / 17,677 ticks. The human player can use the same
 * slot (verified, 25 HP), so this was a live ASYMMETRY on the only `self` weapon in the
 * roster, not dead content.
 *
 * The AI now heals when BOTH hold: it is at or below this fraction of max HP, and it is
 * missing at least the full `healAmount` (so a heal is never partly wasted). 0.5 rather
 * than "whenever it is off cooldown" because the heal is the AI's only defensive
 * resource and burning it at 145/150 spends a 6 s cooldown to gain 5 HP; and rather than
 * AI_FLEE_HP_FRACTION (0.28) because at 42 of 150 HP a single Egg Tackle (16) or Mega
 * Splash (18) can outpace a 25 HP heal. Healing consumes the tick's ATTACK, exactly like
 * any other weapon — it is not free.
 *
 * Measured with `tools/tmp/selfheal_probe.mjs` (10 real matches, enemy Hamburger against a
 * chasing player): fires 0 -> 5, HP restored 0 -> 12.5 per match = 8.3% of the enemy pool,
 * mean HP at the moment it chose to heal 75.2 of 150 against a 75 threshold.
 *
 * ⚠️ `tools/tmp/selfweapon_probe.mjs` — the probe that FOUND this — still prints 0 after
 * the fix, and is right to: it drives an IDLE player, so the enemy kills a motionless
 * target without ever being damaged and a heal that correctly never triggers looks
 * identical to one that cannot. That is `docs/LESSONS.md` §13 exactly, which is why the
 * replacement probe puts a real hand on the controls.
 */
export const AI_SELF_HEAL_HP_FRACTION = 0.5;

// ─────────────────────────────────────────────────────────────────────────────
// Status effects
// ─────────────────────────────────────────────────────────────────────────────

/**
 * ⚠️ STILL NOT CHANGED, AND DELIBERATELY SO. The 2026-08-05 constant audit found a real
 * defect here, recorded it in full below, and left both numbers alone because every fix
 * available *to a duration* is a balance change. That defect is now FIXED — by the
 * re-application rule in AUTHORISED DEVIATION #5 immediately below, which is a different
 * lever. Everything in this comment is the evidence for why the duration was the wrong
 * one; read it before touching either value.
 *
 * **A weapon whose COOLDOWN is shorter than the status it applies holds that status up
 * by itself, indefinitely.** 4 of 5 stun weapons and 8 of 10 slow weapons do
 * (`tools/tmp/stunlock_probe.mjs`): Hamburger's Tomato Toss re-applies a 2500 ms slow
 * every 800 ms — 3.13x uptime — and Pizza's Cheese Blind re-applies a 2000 ms stun,
 * which locks movement to ZERO, every 1300 ms.
 *
 * Measured over 11,000 real matches (`tools/tmp/rules_census.mjs`):
 *
 *   share of ENGAGED time movement-locked      31.4% (smart) · 33.5% (chase)
 *   share of ENGAGED time slowed               47.4% (smart) · 45.6% (chase)
 *   stun applications landing on an ALREADY-stunned target   65.7%
 *   longest UNBROKEN movement lock             mean 1.74 s · p90 5.53 s · max 11.02 s
 *   longest UNBROKEN slow                      mean 2.77 s · p90 6.63 s · max 11.57 s
 *   matchups producing a >=4 s unbroken lock   47 of 110 (worst named case: Pizza's
 *                                              Cheese Blind holds an enemy for 10.37 s)
 *
 * against a mean engagement of 6.0 s. That is the Sticky Trail burst
 * (AUTHORISED DEVIATION #3) in slow motion: undodgeable by construction.
 *
 * ── Why the obvious fix is the wrong one ────────────────────────────────────
 *
 * Cutting `STUN_DURATION_MS` was swept and it is EXPENSIVE, because the 100 HP player
 * needs the lock against a 150 HP enemy more than the enemy needs it:
 *
 *      STUN_DURATION_MS   2000    1600    1300    1000     800
 *      player win rate   54.1%   52.5%   49.3%   43.5%   42.2%    (smart)
 *      stun-lock rate    65.7%   60.1%   34.3%    6.3%    0.9%
 *
 * -10.6 pp at 1000 ms. Cutting `SLOW_DURATION_MS` is cheaper (-0.9 pp at 900 ms) but
 * barely helps: slowed time only falls 2802 -> 2309 ms, because the binding constraint
 * is the APPLICATION RATE, not the duration.
 *
 * The genre fix is a re-application rule — diminishing returns or a brief immunity
 * window after a status expires — which lives in `combat.ts:applyDamage`, not here, and
 * removes the lock without removing the effect. ✅ **That is what DEVIATION #5 below now
 * does.** The largest `STUN_DURATION_MS` that would have made a solo lock impossible is
 * 1100 ms (the shortest stun-applying cooldown in the roster) and for slow 800 ms — both
 * recorded because they are the numbers a duration-based fix would have had to reach, and
 * both are far below what the sweep above shows the player can afford.
 */
export const SLOW_DURATION_MS = 2500;
export const SLOW_MOVE_MULTIPLIER = 0.45;
export const STUN_DURATION_MS = 2000; // stunned = movement locked to 0

/**
 * ── AUTHORISED DEVIATION #5 (2026-08-05): STATUS RE-APPLICATION IS NOW BOUNDED ──
 *
 * This is the fix for the defect documented immediately above. It changes the
 * RE-APPLICATION RULE and leaves both DURATIONS untouched, because the sweep in that
 * comment proved the duration is the wrong lever: -10.6 pp of player win rate to buy a
 * stun-lock reduction that a re-application rule buys for a fraction of that.
 *
 * ── THE RULE, in the words a player would use ───────────────────────────────
 *
 *   **"Stuns and slows never stack. While one is on you, more of the same does
 *     nothing extra — and once it wears off you shrug that effect off for a moment
 *     before it can touch you again."**
 *
 * Damage is completely unaffected. Every hit still hits, still deals full damage, still
 * knocks you about; only the STATUS is refused. Two halves, and both are load-bearing:
 *
 *  1. NO REFRESH WHILE ACTIVE. This is what makes the lock BOUNDED rather than merely
 *     shorter: the longest unbroken movement lock any weapon or combination of weapons
 *     can produce is now exactly `STUN_DURATION_MS`, by construction, at every tick
 *     rate, in every matchup. It was 11.02 s measured (Pizza's Cheese Blind), against a
 *     6.0 s mean engagement. Without this half, an immunity window alone caps nothing —
 *     the lock just extends through it.
 *  2. A GRACE PERIOD AFTER IT ENDS. This is what makes the gap between locks USABLE.
 *     Half 1 alone leaves Cheese Blind (1300 ms cooldown) re-landing 600 ms after each
 *     2000 ms stun expires — a 77% duty cycle in 0.6 s slices, which reads as one long
 *     lock with a stutter. The grace turns that into a window a player can act inside.
 *
 * ── The grace is stored in NO NEW STATE, deliberately ───────────────────────
 *
 * `status.stunnedUntil` / `slowedUntil` are absolute timestamps that persist after they
 * expire, so `elapsed < stunnedUntil + STUN_GRACE_MS` is exactly "stunned, or within the
 * grace after a stun". `combat.ts:applyDamage` is the only writer of either field, and
 * `state.ts` did not have to change. `combat.ts:statusReadyAt` exports the predicate so
 * the HUD/VFX can render the window without re-deriving it.
 *
 * ── How 500 was chosen ──────────────────────────────────────────────────────
 *
 * Swept on a staged copy of this file (`tools/tmp/status_grace_sweep.mjs`), shipped
 * arena, 110 matchups x 8 seeds = 880 matches per row, policy `smart2` (the corrected
 * scripted player — `smart` tests line of sight before range and therefore never closes):
 *
 *   stun/slow grace   stun %engaged   longest stun   slow %engaged   longest slow   p.win
 *      (before)           27.0%          10.62 s         43.6%          12.27 s      61.1%
 *        0 /   0          22.8%           4.00 s         35.8%           5.00 s      55.1%
 *      300 / 375          21.1%           2.00 s         33.3%           2.50 s      54.1%
 *   >> 500 / 500          19.8%           2.00 s         33.0%           2.50 s      53.9%
 *      500 / 625          20.0%           2.00 s         31.6%           2.50 s      53.9%
 *     1000 /1250          18.3%           2.00 s         29.6%           2.50 s      50.0%
 *     2000 /2500          15.3%           2.00 s         25.0%           2.50 s      48.1%
 *
 * Three things decided 500, in this order:
 *
 *  1. ANY POSITIVE GRACE BUYS THE BOUND; ZERO DOES NOT. At `0/0` the no-refresh half
 *     alone still leaves a 4.00 s stun, because a second application landing on the exact
 *     tick the first expires chains seamlessly. One tick of grace ends that, and every
 *     row from 300 ms up sits at exactly one application. **The bound is the fix; the
 *     size of the grace is only how big the gap between locks is.**
 *  2. THE GAP MUST BE LONG ENOUGH TO ACT IN. `EVADE_WINDOW` (see FLIGHT_MS) is 210 ms —
 *     the time to move your own hit radius out of a line of fire. 500 ms is 2.38 evade
 *     windows, which is precisely the dodgeability the game's workhorse projectile band
 *     (`FLIGHT_MS.normal`) is authored to, so the shrug-off window is exactly one full
 *     dodge of the most common shot in the game. That is where the number comes from; it
 *     is not a round-looking constant.
 *  3. IT MUST COST AS LITTLE BALANCE AS POSSIBLE. Every row above 500 buys a smaller
 *     share of locked time for a steeper win-rate price (1000/1250 costs 3.9 pp more for
 *     1.5 pp less locked time). This is the same judgement as `TRAIL.maxHitsPerTick`:
 *     keep the mechanic, cap the degenerate case, move the rate as little as possible.
 *
 * The grace is FLAT — the same half second for both effects — rather than a ratio of each
 * duration. `500/625` was measured alongside and is indistinguishable (53.9% either way),
 * and one number is one sentence.
 *
 * ⚠️ WHAT THIS COSTS, DECLARED. 8,800 matches per side, 110 matchups x 16 seeds x 5
 * policies, shipped arena, this change TOGETHER with DEVIATIONS #6/#7 (they interact —
 * an AI that stops walking into the fog lives longer, which changes how much of the match
 * is spent locked): player win rate `smart` 52.8% -> 44.1%, `smart2` 62.1% -> 51.3%,
 * `chase` 25.5% -> 18.4%. Isolated, the grace rule alone is -1.6 pp (`smart2`) and
 * -6.8 pp (`chase`); the rest is the AI fix. **This is a difficulty change and it is
 * flagged in `docs/DECISIONS-FOR-URI.md`** — the lever if it is too hard is
 * `ENEMY_MAX_HP` (measured: 140 -> 56.3%, 130 -> 62.3% under `smart2`), NOT re-opening
 * the lock.
 *
 * The reason it costs anything at all is the per-role split, which is the number the old
 * aggregate could not show: the ENEMY was locked roughly TWICE as much as the player
 * (33.9% of engaged time against 18.6%), so the lock was a player advantage and removing
 * it is a player cost. Concretely it was one character — **player-Pizza won 98.8% of its
 * 10 matchups on Cheese Blind alone, and now wins 63.1%.**
 *
 * `sim.test.mjs` section 17(d) now asserts the BOUND — spam either status every tick for
 * 20 s and it never exceeds one application — instead of merely ratcheting the count of
 * weapons that could break it. That ratchet is kept and TIGHTENED from `<=` to `==`,
 * because it no longer needs headroom.
 */
export const STUN_GRACE_MS = 500;
export const SLOW_GRACE_MS = 500;

/**
 * Out-of-combat regeneration.
 *
 * ── AUTHORISED DEVIATION #4 (2026-08-05): REGEN_DELAY_MS 10_000 -> 4_000 ────
 *
 * The delay was transcribed from the prototype against its 180 s clock and never
 * re-checked against a FIGHT. It is not the clock that has to contain it — it is the
 * gap between two hits, and that gap was never measured.
 *
 * Measured on the real sim (`tools/tmp/rules_census.mjs`, 11,000 matches: 110 matchups
 * x 25 seeds x 4 scripted policies, shipped arena, 45 s clock):
 *
 *                                    smart     chase     idle      kite
 *   fighters that EVER regenerated    1.9%      0.1%    0/5500    10.1%
 *   regen ticks / fighter / match     0.053     0.005     0.000    1.35
 *   HP regained / fighter / match      0.11      0.01      0.00     2.68
 *
 * The mechanic, the `heal` event it emits and the throttled rising triad
 * `audio/director.ts` plays for it were DEAD CONTENT. Nothing was broken; the trigger
 * was simply unreachable, because a 10 s stretch without taking a hit does not exist
 * inside a fight whose ENGAGED portion averages 6.0 s. Measured directly: the longest
 * out-of-combat gap a fighter achieves once it has been damaged at all is p50 0.93 s,
 * p90 5.85 s — so 10 s sits at the 97.7th percentile of the only distribution that
 * can ever fire it.
 *
 * ── How 4_000 was chosen ────────────────────────────────────────────────────
 *
 * Swept 10/6/5/4/3.5/3/2.5/2 s through the real sim on a staged copy of `rules.ts`
 * (`tools/tmp/rules_sweep.mjs`, 880 matches per row per policy):
 *
 *      delay   fighters that regen (smart/chase)   HP/fighter   Δ win rate, per matchup
 *     10_000            1.9%  /  0.1%                 0.12       — (baseline)
 *      6_000            9.1%  /  6.6%                 1.45       max 12.5pp, mean 0.11pp
 *      5_000           13.0%  / 12.7%                 2.33       max 12.5pp, mean 0.23pp
 *      4_000           21.9%  / 19.0%                 3.90       max  0.0pp, mean 0.00pp
 *      3_000           29.9%  / 24.5%                 5.90       max 12.5pp, mean 0.80pp
 *      2_000           39.2%  / 33.0%                 8.94       max 25.0pp, mean 1.48pp
 *
 * Two criteria, in this order:
 *
 *  1. IT MUST BE ABLE TO FIRE. Target: at least one fighter in five sees it in a
 *     match, so the mechanic and its sound are part of the game rather than trivia.
 *     4 s is the LONGEST delay that clears that bar (5 s reaches only 13%).
 *  2. IT MUST NOT REBALANCE ANYTHING. 4 s leaves all 110 per-matchup player win rates
 *     BIT-IDENTICAL on all three attacking policies (smart 54.1% -> 54.1%, chase
 *     49.5% -> 49.5%, kite 16.8% -> 16.8%). 3.9 HP per fighter per match is below the
 *     granularity that flips an outcome.
 *
 * ⚠️ THE RIGHT DENOMINATOR IS THE OUT-OF-COMBAT GAP, NOT THE CLOCK. `MATCH_DURATION_MS`
 * moved 180 s -> 45 s and play length barely moved with it (18.8 s -> 17.9 s), because
 * no match ever reached the old clock. This value is therefore NOT safe from the arena
 * work in flight (`docs/STATE.md` PART 2 #11: cut the 1,080 wu spawn gap). Re-measured
 * at 4_000 against synthetic shorter-gap arenas, fighters that ever regenerate:
 *
 *              spawn gap 1080 (shipped)   gap 801   gap 320
 *   smart              21.9%                58.1%     20.3%
 *   chase              19.0%                 5.8%      2.4%
 *
 * — it collapses under an aggressive player (the fight ends before any gap opens) and
 * can rise under a positional one. The direction is NOT monotone, so do not reason
 * about it: re-run `node tools/tmp/rules_sweep.mjs --vary REGEN_DELAY_MS --values ...`
 * after the layout lands and re-pick against criterion 1. The sweep is one command.
 *
 * `REGEN_TICK_MS` and `REGEN_AMOUNT` are UNCHANGED and must stay so: `audio/director.ts`
 * keys its heal throttle on both (`HEAL_MIN_INTERVAL_MS` = 2.6 x REGEN_TICK_MS, and the
 * regen-vs-deliberate-heal split is `amount <= REGEN_AMOUNT`), and `tools/audio-probe.mjs`
 * asserts that throttle.
 */
export const REGEN_DELAY_MS = 4_000; // since last damage taken
export const REGEN_TICK_MS = 200;
export const REGEN_AMOUNT = 2;

// ─────────────────────────────────────────────────────────────────────────────
// Ground effects
// ─────────────────────────────────────────────────────────────────────────────

/**
 * Splatter left by `splatter: true` weapons — slows anyone standing in it.
 *
 * ── ⚠️ "ANYONE" IS NOT TRUE TODAY, AND THE SAME IS TRUE OF `PUDDLE_SLOW_FACTOR` ──
 *
 * MEASURED AND PARKED, 2026-08-05. Both of this file's terrain-slow rules are stated
 * for *anyone*, and both are implemented ONCE — in `sim.ts:movePlayer`, which is the
 * only caller of `terrainSlowFactor()` that scales a speed. `ai.ts:stepAI` builds its
 * own `aiSlowMult` out of the STATUS slow alone. **The enemy walks through every puddle
 * and every splat in the game at full speed.**
 *
 * That is the fifth instance of `ai.ts`'s oldest shape — a rule stated once here and
 * implemented twice — and the first that nobody had counted. `Fighter.terrainSlowFactor`
 * makes it visible in the type: the sim computes the value for BOTH fighters every tick
 * and `state.ts` documents it as *"never read by gameplay logic"*, which is exactly true
 * and is exactly the problem.
 *
 * PROVEN WITH A ONE-TICK CONTROL, not by reading the source (`sim.test.mjs` §25(a), and
 * `tools/tmp/burger_lab.mjs --selftest`). Both fighters pinned 900 wu apart — past every
 * weapon in the roster, so the AI is in its chase-MOVE branch — one tick stepped, flooded
 * floor against dry floor, everything else byte-identical:
 *
 *     player   2.0000 -> 0.9000 wu/tick   ratio 0.450000 = PUDDLE_SLOW_FACTOR
 *     enemy    1.1667 -> 1.1667 wu/tick   ratio 1.000000
 *
 * ⚠️ THE OBVIOUS VERSION OF THAT CONTROL IS CONFOUNDED and was written first: two whole
 * matches, travel per tick, reads the enemy at **1.096** — above 1, which no movement rule
 * in this sim can produce. A flood slows the player, so the match it produces is a
 * different match. A two-run ratio is a speed measurement only if everything except speed
 * is held (`docs/LESSONS.md` §13).
 *
 * ── WHY IT IS PARKED RATHER THAN FIXED ──────────────────────────────────────
 *
 * The fix is three lines (a pure `terrainSlowAt()` here, imported by `ai.ts` into
 * `aiSlowMult`) and it was staged and measured — 110 matchups x 32 seeds, smart2, paired:
 *
 *     rung                       settled   tier spread   aggregate   cells moved
 *     shipped                    17/110      3.98 pp       49.5%          —
 *     AI obeys terrain slow      19/110      5.55 pp       50.9%     36/110, max 34.4 pp
 *
 * **It regresses the settled-matchup count, which is a hard guard.** The two new cells are
 * `lollipop>hamburger` 6.3 -> 0.0 and `lollipop>pizza` 65.6 -> 100.0 — the second because
 * Pizza's Tomato Splat finally does something in the PLAYER's hands (Pizza's role split
 * goes -23.1 -> -35.0 pp). The other guards hold: the tier spread stays inside the ~9 pp
 * noise floor and the aggregate moves 1.4 pp, inside its own.
 *
 * So it is a real defect with a real cost, and it is NOT the Hamburger role split it was
 * hunted for: it moves that split 50.6 -> 50.0 pp. Whoever owns `sim.ts` should land it
 * the moment the settled count can afford +2 — the honest place for it is
 * `sim.ts:movePlayer`'s own `terrainSlowFactor()` being shared with `ai.ts` through
 * `movement.ts`, which exists precisely so the two sides can share a movement rule
 * without an import cycle. `sim.test.mjs` §25(a) is a guard in BOTH directions, so
 * landing it fails the test and forces the record to be re-read.
 */
export const SPLAT_DURATION_MS = 4000;
export const SPLAT_RADIUS = 20;

/**
 * Donut's Sticky Trail (passive).
 *
 * ── AUTHORISED DEVIATION #3 (2026-08-05): the trail is now RATE-LIMITED ──────
 *
 * `dropIntervalMs` 160 against `durationMs` 4500 means up to 29 of one owner's marks
 * can be alive at once, and `radius` 22 is far larger than the ~11 wu a chasing AI
 * covers between drops — so a Donut that circles, or gets held against cover, piles
 * its whole trail onto one tile. Every mark then damaged INDEPENDENTLY, all in the
 * same tick, uncapped. Measured on the real sim: 29 marks stacked on one spot cost the
 * victim **87 HP in a single 16.67 ms tick, across 29 simultaneous hit events** — 87%
 * of a player's maximum HP, delivered inside one frame, with no possible reaction.
 *
 * The mechanic is kept and the *numbers below are unchanged*. What changed is in
 * `sim.ts`: at most `maxHitsPerTick` marks may DAMAGE a given victim per tick, and any
 * other mark the victim is standing in is consumed at the same time (you tread the
 * filling out of all of them; only one of them bites). That converts an unbounded
 * burst into a rate, without touching the trail's density, its look, or its total
 * output in ordinary play — see the measured before/after in the commit message.
 */
export const TRAIL = {
  dropIntervalMs: 160,
  durationMs: 4500,
  radius: 22,
  damage: 3,
  speedBoost: 1.35,
  damageBoost: 1.5,
  /**
   * Hard cap on trail damage instances applied to ONE victim in ONE tick. 1, so the
   * worst tick a Donut's trail can ever produce is exactly `damage` (3 HP) — down from
   * 87 HP. Raising it re-opens the burst proportionally; it is a cap, not a rate.
   */
  maxHitsPerTick: 1,
} as const;

/** Homing projectile steering. Prototype: `turnAmount = min(1, 0.006 * dt)`. */
export const HOMING_TURN_RATE = 0.006;

/** Projectile hit radii. */
export const HIT_RADIUS_VS_PLAYER = PLAYER_SIZE * 0.6; // 25.2
export const HIT_RADIUS_VS_ENEMY = 26;

// ─────────────────────────────────────────────────────────────────────────────
// WEAPON REACH — the range ladder
// ─────────────────────────────────────────────────────────────────────────────
//
// Ranges used to be 11 scattered magic numbers between 90 and 260 wu, transcribed
// from a 2D prototype that scrolled a 360x240 window. That pairing — a 260 wu weapon
// inside a 360 wu window — means the original design ALWAYS allowed an attacker to
// hit you from off screen. The 3D camera guarantees the opposite (`FAIR_PLAY` in
// `render/camera.ts` fits a square of radius `maxRange + HIT_RADIUS_VS_PLAYER +
// reaction` on every aspect ratio), and honouring the old 260 forced the camera out
// to ~43 m, shrinking characters to 8% of frame height — a third of the Brawl Stars /
// Zooba silhouette this project exists to hit.
//
// So the ranges were retuned for a camera that shows you your attacker.
//
// ── How the ladder was built ────────────────────────────────────────────────
//
// A uniform cut was rejected: it would have dragged melee down to ~49-65 wu, and a
// fighter is PLAYER_SIZE = 42 wu across, so two of them would have had to overlap to
// trade blows. Instead the ladder is anchored at BOTH ends and the old values were
// mapped onto it monotonically, preserving every ratio that makes a character feel
// different:
//
//   * MELEE is anchored to the BODY. Expressed in body-lengths (1 body = 42 wu),
//     the old melee band was 2.1-2.9 bl — which is not melee, it is short range with
//     a swing animation. The new band is 1.4-2.0 bl: genuine contact reach, the gap
//     between two hitboxes running from ~0.4 to ~1.0 of a body width.
//   * RANGED is anchored to the FAIR RADIUS. `rangedMax` is the single number that
//     sets how far the camera has to pull back, so it is the tightest constraint in
//     the file; everything else is spaced beneath it.
//   * The melee:ranged spread is PRESERVED. Old max-ranged / max-melee = 260/120 =
//     2.17; new = 140/84 = 1.67 against the heavy melee special and 140/70 = 2.00
//     against a standard swing (old equivalent: 260/110 = 2.36). The gap at the
//     BOUNDARY actually widens — shortest ranged / longest melee goes from 130/120 =
//     1.08 to 98/84 = 1.17 — so "brawler vs shooter" reads more clearly, not less.
//   * Per-character ORDER is preserved exactly. Where the naive band map collapsed
//     two of one character's weapons onto the same rung, the shorter one was pushed
//     down a rung (Taco's Onion Bomb, Burrito's Disc, Water Bottle's Spray and
//     Glass). Every character keeps as many distinct ranges as it had, except Taco's
//     Filling Toss and Double Toss, which were identical (220) in the original too.
//
// ── What this costs ─────────────────────────────────────────────────────────
//
// The longest weapon reaches 3.3 body-lengths instead of 6.2. That is the honest
// price and it is real: a sniper reads as "clearly out-ranges the brawler" rather
// than "shoots from across the room". Everything else about the fight is preserved,
// because shrinking reach by 0.54 while the camera closes in by 1/0.62 leaves the
// on-screen picture — how far a shot travels as a fraction of the frame, how long it
// takes to get there — very close to unchanged, with the characters ~60% larger.
// ─────────────────────────────────────────────────────────────────────────────

/** One body length, in world units. Every reach below is a multiple of this. */
export const BODY_LENGTH = PLAYER_SIZE; // 42

export const REACH = {
  /** 1.38 bl — fast utility melee (Burrito's Roll Stun). A body-check. */
  meleeQuick: 58,
  /** 1.67 bl — the standard brawler swing. */
  meleeStrong: 70,
  /** 2.00 bl — slow, telegraphed, high-damage melee specials. */
  meleeHeavy: 84,

  /** 2.33 bl — sprays and close lobs; the first rung clear of every melee. */
  rangedClose: 98,
  /** 2.76 bl — the workhorse mid-range shot. */
  rangedMid: 116,
  /** 3.05 bl — long pokes and heavy single throws. */
  rangedLong: 128,
  /**
   * 3.33 bl — the longest reach any weapon has, ultimates aside.
   *
   * THIS NUMBER SETS THE CAMERA. `FAIR_PLAY.radiusUnits` = this + 25.2 + 34.0 =
   * 199.2 wu, and the camera distance is directly proportional to that. Raising it
   * pushes the camera back and shrinks every character on screen; do not raise it
   * without re-shooting `node tools/aspect.mjs` and looking at the result.
   */
  rangedMax: 140,

  /**
   * Lollipop's Giant Lollipop, and nothing else. DELIBERATELY NOT ON THE LADDER: it
   * is anchored to the ARENA (1400x1000 wu, fog closing to r=545), not to the weapon
   * ladder, because its whole design is "hits the whole map". It is excluded from
   * the fair-play radius in `render/camera.ts` — covering it would demand a 918 wu
   * radius — so its warning has to be the screen-filling slam VISUAL rather than
   * sight of the caster.
   *
   * => CONSTRAINT ON THE VFX OWNER, and it got HEAVIER with this retune: the slam
   * now reaches 2.0x the guaranteed-visible radius, where it used to reach 1.25x.
   * The caster is off screen far more often, so the tell has to carry more weight.
   */
  ultimateSlam: 400,
} as const;

// ─────────────────────────────────────────────────────────────────────────────
// CONCEALMENT — walk-through cover, stated ONCE because it has four readers
// ─────────────────────────────────────────────────────────────────────────────
//
// ── WHAT IT IS ──────────────────────────────────────────────────────────────
//
// Uri, `docs/DECISIONS-FOR-URI.md` §18: *"add bushes — but make it relevant to kitchen.
// For example plates you can hide under."* The arena's cover density is roughly half the
// reference's, and it CANNOT be closed with more solid props: the layout's collision was
// just tuned so the closing ring stops herding fighters into furniture (occlusion falls
// 29.7% -> 25.2% as the zone shrinks). Walk-through concealment adds screen area without
// adding one world unit of collision — which is exactly why the reference genre uses it.
//
// A concealment region is an axis-aligned box (`movement.ts:ConcealBox`) on
// `arena.concealment`. It is a SEPARATE list from `arena.cover`: nothing in `tryMove`,
// `escapeCover`, `collidesWithCover`, the nav grid or `stepProjectiles`' wall test ever
// sees it, so "walk-through" is a property of the data model rather than a rule anyone
// has to remember. `sim.test.mjs` §26 proves it by walking a fighter across the centre of
// every box, and by asserting the nav grid's passable-cell count is unchanged.
//
// ── THE ONE RULE, AND WHY IT IS ONE RULE ────────────────────────────────────
//
//     WHILE YOU ARE CONCEALED, NOTHING THAT TRACKS YOU UPDATES.
//
// `ai.ts` has historically shipped FIVE defects of one shape — *a rule stated once in
// this file and implemented twice*. `tools/tmp/p4_coverdensity.mjs`'s probe report found
// the sixth already armed: `stepAI` reads the player's true position at three independent
// sites, and one of them (the chase nav target, `ai.ts:605`) was a DIRECT read rather than
// something derived from the other two. An implementation that reached two of the three
// would produce an AI that FACES where it last saw you while WALKING to where you actually
// are — which reads on screen as working, and is `docs/LESSONS.md` §1's plausible-and-wrong
// shape. There is a fourth reader outside `ai.ts` entirely: homing projectiles re-aim at
// `target.x/target.y` every tick (`sim.ts:stepProjectiles`), so a homing volley would curve
// into the bush after a target the shooter cannot see.
//
// So the rule is expressed as TWO exported predicates in `movement.ts` —
// `isConcealed(x, y, arena)` and `isVisibleFrom(ox, oy, tx, ty, arena)` — and all four
// readers call them. Nothing else in the sim tests concealment geometry.
//
// ── NO ROLL. NOT NEGOTIABLE ─────────────────────────────────────────────────
//
// `grep -rn 'Math.random' src/game/{sim,state,combat,ai,movement}.ts` returns NOTHING, and
// that is what underwrites every balance number in this project — `sim.test.mjs`'s seeded
// assertions, `roster_lab`'s 110x32 paired deltas, the settled-matchup guard. The obvious
// genre implementation of concealment ("shots at a hidden target have a miss chance") is
// therefore FORBIDDEN here. Region membership is the deterministic equivalent, and
// `sim.ts:terrainSlowFactor` is the working template for it.
//
// ── THE SECOND RULE: ATTACKING SPENDS THE COVER (DECISIONS §29c) ────────────
//
// ⚠️ THE OLD WORDING OF THIS BLOCK IS KEPT BELOW, because it stated a deliberate omission
// that Uri has now closed. It read:
//
//     "ATTACKING DOES NOT REVEAL YOU YET. The genre norm is that firing from a bush breaks
//      concealment for a moment. It needs a `revealedUntil` timestamp written in
//      `combat.ts:attemptAttack` and a second term in `isVisibleFrom` — a second rule, with
//      its own balance cost, and it cannot be measured until regions exist. Deferred, named."
//
// Uri, `docs/DECISIONS-FOR-URI.md` §30 answering §29c, verbatim: *"attacking from under it
// will break it and reveal you. You can also step out and attack."* That is STRONGER than
// the genre norm — in the reference game firing from a bush merely reveals you and the bush
// survives. Here the object is DESTROYED, so:
//
//   * concealment is a CONSUMABLE, PER-OBJECT RESOURCE — one ambush per plate, then it is
//     gone for the rest of the match; and
//   * there is a real tactical choice: ambush from under it and spend it, or step out,
//     attack, and keep it for later.
//
// Stated once, in two halves, because they answer two different questions:
//
//   1. DESTRUCTION — `movement.ts:breakConcealment` removes every STANDING region that
//      contains the attacker's centre. It is per-MATCH (`MatchState.brokenConcealment`),
//      never a mutation of `ArenaDefinition`: one arena object is shared by every match a
//      process runs — `match.ts` reuses `this.arena` across restarts and `roster_lab` steps
//      thousands of matches through one — so a broken plate on the arena would stay broken
//      for the rest of the session. It emits `concealment-broken` for the prop layer.
//   2. REVEAL — `Fighter.revealedUntil`, `CONCEAL_ATTACK_REVEAL_MS` below. Destruction
//      alone is NOT enough: the size constraint above puts many small patches close
//      together, so an attacker whose plate shattered could step 90 wu into the next one and
//      vanish inside a single tick. The reveal window is what makes "you are exposed" a
//      STATE rather than a frame's coincidence.
//
// ⚠️ A `self` weapon (Hamburger's Onion Ring, the roster's only heal) does NEITHER. Uri's
// word is *attacking*; a heal deals no damage, spawns no projectile, and leaks nothing. It
// is the one press that is not an attack, and `sim.test.mjs` §26(l) asserts both directions
// so the exemption cannot be widened or lost by accident.
//
// ── WHAT IS *STILL* DELIBERATELY NOT HERE ───────────────────────────────────
//
//   * ⚠️ `ui/hud.ts:enemyVisibleToPlayer` CALLS `isVisibleFrom` WITHOUT THE MATCH, so the
//     human's screen still resolves concealment against the arena's DECLARED regions rather
//     than the ones still standing. One line, in a file this owner does not have; routed,
//     and harmless while no arena declares a region. Both new arguments are OPTIONAL for
//     exactly that reason — the five-argument form keeps its old meaning instead of
//     becoming a type error in three files at once.
//   * THE PLAYER IS NEVER HIDDEN FROM THEMSELVES. `render/camera.ts` follows the player and
//     a concealed player is still drawn to their own client. Nothing to do.

/**
 * Separation at or inside which concealment does NOT hide you.
 *
 * DERIVED FROM THE REACH LADDER, not picked, and the derivation is the design rule:
 * **melee is a contact weapon, so anything inside every melee weapon's reach is inside
 * touching distance and cannot be hidden.** `REACH.meleeHeavy` is the longest melee rung
 * in the roster, so:
 *
 *   * no melee weapon can ever swing at a target its owner cannot see (asserted, §26) —
 *     which closes the "shooting at a ghost" hole before it opens; and
 *   * it sits strictly BELOW `REACH.rangedClose` (98), the first ranged rung, so
 *     concealment always denies at least one full rung of ranged fire. That is what makes
 *     it a mechanic rather than a rounding error.
 *
 * If the ladder moves, this moves with it. §26 asserts both inequalities rather than the
 * literal, so a rung change surfaces as a real failure instead of a stale constant.
 *
 * ⚠️ UNMEASURED IN PLAY. No arena ships a `concealment` list yet, so this number has never
 * been through a match. It is a stated rule with a derivation, not a tuned value; re-derive
 * it the first time regions exist (`tools/tmp/conceal_lab.mjs --occupancy`).
 *
 * ── ⚠️ IT ALSO SETS A HARD SIZE LIMIT ON THE REGIONS THEMSELVES ─────────────
 *
 * => **CONSTRAINT ON THE ARENA OWNER.** `stepAI` has no SEARCH behaviour: it walks to the
 * point where it last saw the player and stops there. From that point it can see
 * `CONCEAL_REVEAL_RADIUS`. So a player who can get FURTHER THAN THAT from where they
 * entered a region, while staying inside it, is invisible for the rest of the match — and
 * `sim.test.mjs` §26(f) measures exactly that, in both directions: at 0.5x the radius the
 * AI finds them again, at 2x it never does.
 *
 * The first draft of that assertion said *"it always re-acquires"* and FAILED. The
 * behaviour is real and it is not a bug to be fixed here — an AI that searches is a
 * separate feature with its own balance cost. What it means is that **concealment wants
 * MANY SMALL patches, not a few large blobs**: no interior point more than ~84 wu from a
 * plausible entry edge. That is the same conclusion the cover-density probe reached from
 * the opposite direction — the reference delivers its density as *"dozens of small tufts
 * in lane-aligned bands"* while ours is 2-3 huge blocks, with the top-2 cover kinds owning
 * 74.3% of all cover pixels. A single 300 wu bush is not more cover; it is a permanent
 * AI-denial zone that also fails the grain metric.
 */
export const CONCEAL_REVEAL_RADIUS = REACH.meleeHeavy;

/**
 * Match progress at which the arena stops being a hide-and-seek space and becomes a duel.
 *
 * `src/arena/kitchen.ts` states the layout's rule 1: cover density must FALL toward the
 * centre, *"because a closing ring that herds fighters into furniture is the inverse of
 * what a closing ring is for"* — measured occlusion once ROSE 30.6% -> 67.7% as the ring
 * shrank, and the whole layout was rebuilt to fix it. Concealment is subject to the same
 * rule and to a stronger version of it: geometry you cannot see through is worse in a
 * 140 wu final annulus than geometry you cannot walk through.
 *
 * ⚠️ AND THE GUARD THAT PROTECTS THAT RULE TODAY CANNOT SEE CONCEALMENT.
 * `tools/tmp/arena_probe.mjs --occl` computes its occlusion series from `arena.cover`
 * ONLY, and `--verify`'s normaliser compares `{w,h,c,msr,ps,es,cover,hz}` — a
 * `concealment` array is invisible to both, so a region placed in the hub would leave
 * every existing arena gate byte-identical while making the endgame a blind fight.
 * `concealmentKeepoutRadius` + `movement.ts:concealmentInsideRadius` are the sim-side
 * guard that CAN see it, and §26 shows them FAILING on a hub-placed box.
 */
export const CONCEAL_ENDGAME_PROGRESS = 0.75;

/**
 * The radius around `arena.center` that must contain NO concealment, for an arena whose
 * fog starts at `maxSafeRadius`.
 *
 * Derived from the same formula `sim.ts` closes the ring with —
 * `safeRadius = max(MIN_SAFE_RADIUS, maxSafeRadius * (1 - progress))` — evaluated at
 * `CONCEAL_ENDGAME_PROGRESS`. So the rule reads in words as *the last quarter of the match
 * is a visible duel*, and the number follows the arena rather than being re-picked when
 * the arena is redressed. On the shipped kitchen (`maxSafeRadius` 993) it is **248.25 wu**.
 *
 * The floor matters: an arena whose ring closes fast would otherwise compute a keepout
 * SMALLER than the annulus the ring actually stops at, and the final duel is fought inside
 * `MIN_SAFE_RADIUS` whatever the progress arithmetic says.
 *
 * The probe that raised this recommended *"r > ~300, on the lanes, never in the hub"* by
 * eye. 248.25 is the derived floor, deliberately looser than that advice — an arena agent
 * following the advice satisfies this constant with 52 wu to spare, and an arena agent who
 * ignores it still cannot put a bush in the hub.
 */
export function concealmentKeepoutRadius(maxSafeRadius: number): number {
  return Math.max(MIN_SAFE_RADIUS, maxSafeRadius * (1 - CONCEAL_ENDGAME_PROGRESS));
}

// ─────────────────────────────────────────────────────────────────────────────
// PROJECTILE FLIGHT — speed is derived, not authored
// ─────────────────────────────────────────────────────────────────────────────
//
// What a player actually perceives is TIME TO TARGET, not world units per second,
// and time to target is what decides whether a shot is dodgeable at all. So the
// authored number is the flight time and the speed falls out of it.
//
// This matters more than it looks: cutting range while holding speed fixed would
// have halved every flight time, dropping most shots to ~1.3 evade windows
// (EVADE_WINDOW = HIT_RADIUS_VS_PLAYER / PLAYER_SPEED = 210 ms — the time to move
// your own hit radius out of the line of fire). That would have quietly undone the
// very fairness the camera work exists to provide: seeing the shot is worthless if
// it lands before you can move. Deriving speed from a preserved flight time keeps
// every weapon exactly as dodgeable as it was, and — because the camera closed in by
// the same factor the ranges shrank — keeps its apparent on-screen speed too.
//
// The four bands are the clusters the prototype's 22 range/speed pairs already fell
// into (310, 381-447, 474-600, 813-867, 1733 ms). Every weapon keeps its band, so
// snappy weapons stay snappy and floaty ones stay floaty. Raw wu/s ordering can
// differ slightly from the old table where a weapon also changed rung — Taco's Onion
// Bomb and Pizza's Dough/Tomato are the only two cases — because speed now follows
// from reach x flight rather than being set by hand.
// ─────────────────────────────────────────────────────────────────────────────

export const FLIGHT_MS = {
  /** 1.67 evade windows. Sprays and quick lobs. */
  fast: 350,
  /** 2.38 evade windows. The workhorse. */
  normal: 500,
  /** 4.2 evade windows. Big, readable, telegraphed shots. */
  slow: 875,
  /** 8.3 evade windows. Egg's Hatch! — a chick that waddles at you. */
  drift: 1750,
} as const;

/** World units per second needed to cross `range` in `flightMs`. */
const projectileSpeed = (range: number, flightMs: number): number =>
  Math.round((range / flightMs) * 1000);

/**
 * The derived speed table. Named by the rung the weapon sits on, so a weapon's
 * `range` and `speed` can never drift out of sync.
 */
export const SPEED = {
  /** 280 wu/s */ closeFast: projectileSpeed(REACH.rangedClose, FLIGHT_MS.fast),
  /** 196 wu/s */ close: projectileSpeed(REACH.rangedClose, FLIGHT_MS.normal),
  /** 232 wu/s */ mid: projectileSpeed(REACH.rangedMid, FLIGHT_MS.normal),
  /** 256 wu/s */ long: projectileSpeed(REACH.rangedLong, FLIGHT_MS.normal),
  /** 160 wu/s */ maxSlow: projectileSpeed(REACH.rangedMax, FLIGHT_MS.slow),
  /**  80 wu/s */ maxDrift: projectileSpeed(REACH.rangedMax, FLIGHT_MS.drift),
} as const;

/**
 * How long an attack keeps you visible, whatever cover you are standing in.
 * **This constant belongs to the CONCEALMENT block above** and lives down here only
 * because it is DERIVED from `FLIGHT_MS`, which is declared below it — a `const` cannot be
 * read before its own initialiser runs.
 *
 * ── DERIVED FROM THE FLIGHT LADDER, NOT PICKED ──────────────────────────────
 *
 * The rule it has to satisfy is *"a fighter that has just fired is visible long enough to
 * be shot back at"*. The thing that decides how long that is, is not reaction time (the AI
 * has none — it re-decides every tick) and not the cooldown of the weapon that fired (which
 * would make the exposure a property of the ATTACKER's kit, so a fast weapon would be a
 * strictly safer ambush and Taco's 2.5 s combo the worst). It is **how long a shot takes to
 * arrive** — because a reveal shorter than that is a reveal you cannot punish.
 *
 * `FLIGHT_MS.normal` is that number: the band `SPEED.close`/`mid`/`long` are all authored
 * to, i.e. the flight time of the game's workhorse projectile across its own rung. So the
 * rule reads in words as **you stay lit for exactly as long as the return shot needs to
 * cross the ground between you**, and if the flight ladder moves this moves with it.
 *
 * It is the same derivation, from the same rung, that `STUN_GRACE_MS` (500) already uses —
 * "exactly one full dodge of the most common shot in the game" — which is a second reason
 * to reuse the rung rather than introduce a third timescale into the same fight.
 *
 * ⚠️ UNMEASURED IN PLAY, exactly like `CONCEAL_REVEAL_RADIUS`. No arena ships a
 * `concealment` list, so no reveal has ever happened in a real match. It is a stated rule
 * with a derivation, not a tuned value. `sim.test.mjs` §26 asserts the DERIVATION
 * (`=== FLIGHT_MS.normal`, and > 0) rather than the literal, so re-tuning the ladder
 * surfaces as a real change instead of a stale constant.
 */
export const CONCEAL_ATTACK_REVEAL_MS = FLIGHT_MS.normal;

// ─────────────────────────────────────────────────────────────────────────────
// Weapon / character types
// ─────────────────────────────────────────────────────────────────────────────

export type WeaponType = 'melee' | 'ranged' | 'self';
export type StatusEffect = 'slow' | 'stun' | null;
export type Rarity = 'Normal' | 'Rare' | 'Epic' | 'Legendary' | 'Neon' | 'Cyber';

export interface ComboPart {
  color: string;
  damage: number;
  angle: number;
  emoji: string;
}

export interface Weapon {
  /** Short key shown on the weapon slot. */
  key: string;
  name: string;
  type: WeaponType;
  /** Max travel distance (ranged) or reach (melee), in world units. */
  range?: number;
  damage: number;
  cooldown: number;
  /** Melee only: total arc width in degrees. 360 = omnidirectional. */
  cone?: number;
  /** Ranged only: world units per second. */
  speed?: number;
  color: string;
  effect: StatusEffect;
  emoji: string;

  /** Ranged: fire N pellets fanned across `spreadDeg`. */
  pellets?: number;
  spreadDeg?: number;
  pelletColors?: string[];
  pelletEmojis?: string[];

  /** Leaves a slowing floor splat on impact/expiry. */
  splatter?: boolean;
  /** Steers toward the target while in flight. */
  homing?: boolean;
  /** Fires all parts simultaneously as one combo special. */
  comboParts?: ComboPart[];
  /** Damage is multiplied when standing on own trail (Donut). */
  trailBoosted?: boolean;
  /** Arrives, then strikes repeatedly (Egg's Hatch!). */
  peckHits?: number;
  peckInterval?: number;
  /** Screen-filling AOE slam visual (Lollipop's Giant Lollipop). */
  giantSlam?: boolean;
  /** `self` type only. */
  healAmount?: number;
}

/**
 * The character card, on the roster screen's 0-10 scale.
 *
 * ⚠️ **THIS USED TO SAY "Not used in combat math", AND FOR TWO OF THE THREE AXES IT WAS
 * TRUE.** Every character had identical HP and identical movement speed; the card drew
 * three bars and two of them described nothing. As of AUTHORISED DEVIATION #10 all three
 * are real, and they run in two different directions:
 *
 *   `health`  AUTHORED here; the sim reads it (`maxHpFor`). Bigger bar, bigger pool.
 *   `speed`   AUTHORED here; the sim reads it (`speedFor`). Bigger bar, faster. Capped —
 *             `SPEED_TOP_STAT` maps to `PLAYER_SPEED` and nothing may exceed it.
 *   `damage`  DERIVED from the weapon table (`damageStatFor`), because `weapons` is and
 *             remains the single source of truth for damage. Do not hand-edit it: change
 *             a weapon and re-derive, or `sim.test.mjs` §22(f) fails.
 *
 * §22 asserts every one of those sentences against the real `createMatch` / `stepMatch` /
 * `stepAI`, so the card cannot quietly become fiction again.
 */
export interface DisplayStats {
  damage: number;
  health: number;
  speed: number;
}

export interface AbilityBlurb {
  emoji: string;
  name: string;
  desc: string;
}

export interface CharacterDef {
  id: CharacterId;
  name: string;
  emoji: string;
  rarity: Rarity;
  stats: DisplayStats;
  /** Passive: drops a damaging speed-boost trail while moving (Donut only). */
  hasTrail: boolean;
  weapons: Weapon[];
  abilities: AbilityBlurb[];
  /**
   * ⚠️ THE OLD WORDING OF THIS DOC COMMENT IS KEPT BELOW, BECAUSE IT WAS PART OF THE BUG.
   *
   * > "Personality reference for the 3D model. Per the brief these descriptions were
   * > written for flat 2D icons — they are a vibe guide, NOT a literal spec. Silhouette
   * > readability and holding up against the Brawl Stars / Zooba bar wins when the two
   * > pull in different directions. Identity (which food, which rarity) is fixed."
   *
   * That framing said "not a literal spec" and eleven agents implemented their line
   * literally anyway — `lollipop.ts:344` says so in as many words ("`rules.ts` puts the
   * eyes on the stick and the mouth on the candy"). Calling a spec a vibe guide does not
   * stop it being obeyed. **So the EYES/MOUTH half of every string below is now a HARD
   * SPEC.** The food-identity and silhouette half remains a guide, and identity (which
   * food, which rarity) is still fixed.
   *
   * ── WHY (DECISIONS §37–§42) ────────────────────────────────────────────────
   * Uri ranked seven characters without seeing any code and his ranking matched this
   * one field EXACTLY: every character he rated poorly was specified with **closed eyes
   * or no eye spec at all**, and the one he rated best — egg — was the only one specified
   * **"open eyes with highlights"**. The implementations were faithful. The spec was wrong.
   * This is the inverse of this project's most expensive defect shape: not "a rule stated
   * once and implemented differently elsewhere", but **a rule obeyed exactly that should
   * not have been written**. No gate could catch it, because every gate here measures
   * conformance rather than whether the target was worth hitting.
   *
   * ── THE FACE STANDARD — every character, no exceptions ─────────────────────
   * Measured, not asserted: **0% of our eye pixels are above 0.85 luma against the
   * reference plates' 31.1% and 34.1%.** Our faces carry TWO VALUES TOTAL. Four elements
   * fix that, and all four must be separate meshes:
   *
   *   1. **A WHITE SCLERA that is the brightest value anywhere on the character.**
   *      Not a highlight, not a specular — a white shape with area. This is the single
   *      largest, brightest, highest-contrast element of any reference face and it is
   *      currently absent from all eleven.
   *   2. **A DARK PUPIL, real geometry, OFFSET from centre** so the character has a gaze.
   *      A centred pupil reads dead even when everything else is right.
   *   3. **AN EXPLICIT CATCHLIGHT MESH** — small, `noOutline`, offset opposite the pupil.
   *   4. **AN UPPER LID / LASH LINE.** This is where the old "closed happy eyes" arc goes:
   *      **demoted from BEING the eye to BOUNDING it.** Removing "closed" is not removing
   *      character — the arc still carries the expression, it just stops being the whole eye.
   *
   *   The construction ladder Uri reproduced blind, worst to best, is exactly the geometry:
   *   a flattened arc (a stroke, hamburger) < a sphere with a specular (donut) < a sphere
   *   plus an explicit glint mesh (taco) < **open eyes with catchlights (egg)**. Egg is the
   *   cast reference. Copy it rather than inventing, then take all eleven past it.
   *
   *   **THE MOUTH NEEDS AN INTERIOR VALUE STEP** — a lip line with a genuinely darker
   *   throat plane behind it, so it reads as an OPENING rather than a painted curve. And a
   *   mouth must not sit adjacent to the character's darkest band: taco's mouth above its
   *   near-black neck collar fused into one mass and Uri read the pair as **a hat brim**.
   *
   *   **NOTHING FLOATS.** Every feature sits ON a surface, sharing one tangent frame with
   *   its neighbours (`egg.ts`'s `addShellDecal` is the pattern, and hamburger's shared
   *   crown frame is the reason its eyes and brows can never drift out of plane).
   *   A detached face was specified twice (taco "floats outside the shell", waterbottle
   *   "floating above the cap") and rejected both times.
   *
   * ── AND ONE SILHOUETTE RULE, BECAUSE IT OVERRIDES ANY FACE ─────────────────
   * 🚨 **A POINTED MASS EITHER SIDE OF A HEAD READS AS AN EAR OR A HORN. Five for five:**
   * burrito's torn foil ("looks like a goat"), egg's shell shards ("the ears don't make
   * sense"), hamburger's lettuce, lollipop's cellophane cape petals, pizza's cheese
   * strands. **It overrides what the shape is made of.** Re-place it (above, behind,
   * asymmetric) or re-shape it (rounded, drooping, continuous) — or the character reads as
   * an animal no matter how good its face is.
   *
   * ⚠️ And its converse: **detail added to signal the subject can destroy the silhouette
   * that signalled it better.** `egg.ts:206` calls the clean ovoid "the one thing Egg had
   * going for it in the silhouette test"; a lifted lid and shards broke it, and Uri says
   * "the egg lost the appearance of egg". Check your character for the same trade.
   *
   * ── SCOPE ─────────────────────────────────────────────────────────────────
   * Uri, 2026-08-06, verbatim: *"Do NOT see any description of any character as frozen.
   * If something needs changing cause it makes the character look weird or get a bad
   * score, change it."* Two lines were unfrozen by name — **lollipop** ("the mouth doesn't
   * have to be above the eyes" AND "more colors than red only") and **soup** ("no mouth"
   * is the same defect already rejected on taco). Everything else here is open on the same
   * terms: if the string is producing a bad character, change the string and say why.
   *
   * This field is a BUILD BRIEF. It is read by no UI and rendered nowhere — grep confirms
   * the only `.face` reads in `src/` are `rig.joints.face` and `thumbs.ts`'s joint bbox —
   * so it costs nothing to be long and precise, and precision here is the whole point.
   */
  face: string;
}

export const CHARACTER_IDS = [
  'hamburger', 'donut', 'taco', 'burrito', 'egg', 'lollipop',
  'pizza', 'sushi', 'soup', 'waterbottle', 'hotdog',
] as const;

export type CharacterId = (typeof CHARACTER_IDS)[number];

// ─────────────────────────────────────────────────────────────────────────────
// Shared palette (from the prototype's CSS custom properties)
// ─────────────────────────────────────────────────────────────────────────────

export const PALETTE = {
  ink: '#1a1224',
  bun: '#E8A33D', bunDark: '#D98E3D',
  patty: '#6B3E26', pattyDark: '#4E2C1B',
  tomato: '#E63946', lettuce: '#7CB518', onion: '#F4E9DA',
  mustard: '#FFC93C', ketchup: '#D62839', cream: '#FFF3DE',
  egg: '#FFF8EA', cheese: '#FFD873',
  rice: '#FFFFFF', nori: '#2B2B2B', salmon: '#F4A261',
  broth: '#E8792A', steam: '#C9C9C9',
  water: '#BFEFFF', waterCap: '#1E90D8',
  glaze: '#FF9EC4', sausage: '#B23A2E',
} as const;

export const RARITY_COLORS: Record<Rarity, string> = {
  Normal: '#9B9B9B',
  Rare: '#2E86D8',
  Epic: '#8B4FDE',
  Legendary: '#F4A300',
  Neon: '#FF2FD0',
  Cyber: '#00E5B0',
};

/** Card background colours behind the roster art. Neon/Cyber animate a black zigzag. */
export const RARITY_CARD_COLORS: Record<Rarity, string> = {
  Normal: '#BEBEBE',
  Rare: '#4A90D9',
  Epic: '#9B6FDE',
  Legendary: '#FFD84D',
  Neon: '#E63946',
  Cyber: '#3FD1E0',
};

// ─────────────────────────────────────────────────────────────────────────────
// The roster — 11 characters
// ─────────────────────────────────────────────────────────────────────────────
//
// ── AUTHORISED DEVIATION #8 (2026-08-05): LOLLIPOP ──────────────────────────
//
// THE ROSTER HAD NEVER BEEN MEASURED PER CHARACTER. Every instrument on this
// project reports the AGGREGATE player win rate or a flat 110-entry matchup map,
// and neither can answer the only question a roster has: is any character out of
// the game? `tools/tmp/roster_table.mjs` was built to ask it — 110 matchups x 32
// seeds per policy (3,520 matches a row), reporting each character's win rate in
// the PLAYER's hands and in the AI's, because the two are the same matches read
// from opposite ends and a character that is simply good moves both.
//
// One character was out of the game, and only one:
//
//   strength = (win rate in player hands + win rate in AI hands) / 2, shipped tree
//
//     hamburger 86.6  waterbottle 75.5  burrito 69.1  taco  66.3  sushi 62.2
//     donut     54.1  pizza       38.6  egg     37.8  hotdog 34.8  soup  16.3
//     LOLLIPOP   8.9   <- last, by 7.4 pp, under `smart2`
//
// and it is not a policy artefact. Lollipop is LAST OF ELEVEN in six independent
// measurements — `smart2` and `chase`, against the shipped sim, against the
// PRE-status-lock sim (`eaede1d`), and against a staged sim with the AI stun
// asymmetry removed. Under `chase` it lost 10 of its 10 matchups at <= 3%. The
// cleanest evidence that it is the KIT and not the driver is the AI column: all
// eleven characters share one driver (`ai.ts`), and in AI hands Lollipop wins
// 10.6% against a next-worst of 20.9%.
//
// ── The two things that were actually wrong ─────────────────────────────────
//
// 1. ITS SPECIAL WAS WEAKER THAN ITS OWN BASIC ATTACK. Giant Lollipop dealt 10
//    against Lollipop Smash's 11 — the only special in the roster with that
//    property (Taco's Double Toss delivers 23 against 12 and 7). BOTH drivers
//    pick a weapon the same way: `ai.ts:pickHighestDamageWeapon` and the scripted
//    player's `bestWeapon` each take the highest `damage` that is ready and in
//    range. So an 8 s cooldown ability whose whole design is "grows huge and hits
//    the whole map" was NEVER CHOSEN inside melee range, by anybody. Measured, and
//    this is the part that proves the mechanism rather than asserting it: cutting
//    its cooldown 8000 -> 5000 made Lollipop WORSE (8.9% -> 8.1%), because more
//    presses of a below-par weapon is a worse rotation, not a better one.
//
// 2. THE ONLY CHARACTER WITH NO RANGED WEAPON HAD THE ROSTER'S WORST SWING.
//    Sustained output from a basic swing (melee, cooldown <= 1 s):
//
//      hamburger Patty Smash   12 / 650 ms = 18.5 HP/s   + 2 ranged + a 25 HP heal
//      hotdog    Bun Slash     11 / 650 ms = 16.9 HP/s   + 2 ranged
//      lollipop  Lollipop Smash 11 / 750 ms = 14.7 HP/s   + nothing
//
//    Lollipop was strictly Hot Dog's swing with a longer cooldown and none of the
//    rest of the kit — on the character whose own roster card claims the
//    joint-highest damage in the game (8) and whose rarity is the rarest tier.
//    Consequence, measured: 5.9 weapon presses per match against Pizza's 28.8 and
//    Burrito's 20.9, and 63.4 HP of damage dealt per match against a roster median
//    of 141.9.
//
// ── How 16 and 17 were chosen ───────────────────────────────────────────────
//
// Swept on staged copies of this file (`tools/tmp/stage_weapon.mjs` +
// `tools/tmp/roster_sweep.mjs`), shipped arena, 110 matchups x 32 seeds, both
// `smart2` and `chase`. Single levers first, then packages:
//
//   candidate                    lollipop strength   roster RANGE   agg. win
//                                smart2 / chase      smart2/chase   smart2
//   shipped                        8.9  /  9.5       77.7 / 57.0     53.4%
//   Smash range 70 -> 84           11.6 / —          73.8 / —        52.6%   (+1.9: reach is not the constraint)
//   Giant cooldown 8000 -> 5000     8.1 / —          76.9 / —        53.5%   (WORSE — see mechanism 1)
//   Smash effect -> 'slow'          5.3 / —          80.0 / —        53.7%   (WORSE)
//   Smash 15 · Giant 16            25.9 / 26.9       73.9 / 38.8     51.2%
// >>Smash 16 · Giant 17            27.0 / 28.3       74.1 / 37.3     51.2%
//   Smash 15/700ms · Giant 16      28.9 / 29.1       73.9 / 36.6     50.7%
//   Smash 18 · Giant 19            35.5 / 35.8       76.1 / 29.7     50.8%   (REFUSED — see ceiling below)
//
// Three constraints decided it, in this order:
//
//  1. THE SWING HAS TO BE THE BEST SWING, BECAUSE IT IS ALL SHE HAS. 16 is the
//     roster's heavy-melee damage number (Egg's Tackle and Soup's Dump are both
//     16) delivered on a basic-swing cooldown: 21.3 HP/s, +15% on Hamburger's
//     18.5 and the roster's best. That margin is the compensation for carrying no
//     ranged option at all, and it is a margin rather than a blowout — Smash 18
//     would be 24.0 HP/s, +30%.
//  2. THE SPECIAL MUST BE THE BIGGEST PRESS IN ITS OWN KIT. That forces
//     Giant > Smash, so Giant >= 17.
//  3. AN UNDODGEABLE HIT MAY NOT EXCEED THE BIGGEST DODGEABLE ONE. A `giantSlam`
//     has `cone: 360` and resolves ON THE TICK IT IS CAST, from up to
//     `REACH.ultimateSlam` (400 wu) = 2.0x the radius `render/camera.ts`
//     guarantees is on screen. It cannot be dodged, aimed away from, or broken
//     line of sight with (`docs/DECISIONS-FOR-URI.md` §9 has already parked its
//     missing wind-up for a human to judge, and this change RAISES the stake on
//     that question). So it is capped by the largest single hit the roster can
//     produce that a player CAN do something about — Water Bottle's Mega Splash,
//     18. That caps Smash at 17 and kills the 18/19 row outright. 2 and 3
//     together pin Giant to exactly 17 once Smash is 16; it is not a taste pick.
//
// This project has had to bound three undodgeable bursts already (the Sticky
// Trail's 87 HP in one tick, the 11.02 s status lock, melee at zero separation).
// `sim.test.mjs` section 19 asserts constraints 1, 2 and 3 so the fourth cannot
// arrive by a damage tweak.
//
// ── WHAT IT DELIVERS, AND WHAT IT COSTS ─────────────────────────────────────
//
//                                          smart2            chase
//   Lollipop strength                   8.9 -> 27.0%      9.5 -> 28.3%
//   Lollipop in AI hands               10.6 -> 40.9%     18.8 -> 54.4%
//   Lollipop in player hands            7.2 -> 13.1%      0.3 ->  2.2%
//   opponents beating AI-Lollipop >=95%   5/10 -> 2/10      2/10 -> 0/10
//   roster RANGE (max-min strength)    77.7 -> 74.1pp    57.0 -> 37.3pp
//   roster sd                          23.6 -> 22.2pp    14.7 -> 10.6pp
//   aggregate player win rate          53.4 -> 51.2%     16.8 -> 13.8%
//
// THE CHANGE IS SURGICAL, and this is the number that shows it rather than the
// per-character deltas: PAIRED against the same seeds, same arena, same matchups,
// **14 of 110 matchups moved under `smart2` and 11 of 110 under `chase`, and every
// single one of them has Lollipop on one side.** No matchup between two other
// characters changed at all. The strength shifts the table shows for Donut (-3.4),
// Egg (-4.5), Soup (-3.8) and Hot Dog (-2.8) are ENTIRELY their own Lollipop
// matchups being averaged back in — Lollipop is 1 of the 10 opponents in each of
// their two role columns, so a +18 pp move in the target arithmetically moves every
// other character by ~2 pp and there is no way to buff anybody without it.
//
// ⚠️ THE AGGREGATE MOVED 2.2 pp AND THAT IS DECLARED, NOT SMUGGLED. It is well
// inside the ~9 pp band this project treats as unresolvable for an aggregate, and
// it is the arithmetic of a symmetric character change: buffing a character makes
// the player stronger in 10 of 110 matchups and the AI stronger in 10 others, and
// the AI's 150 HP pool converts extra damage slightly better than the player's 100,
// so the residual is negative. `ENEMY_MAX_HP` is the difficulty dial and is
// UNTOUCHED — it is parked for Uri in `DECISIONS §12`.
//
// ⚠️ THE PLAYER-SIDE HALF OF LOLLIPOP WAS NOT FIXED HERE, AND THE LEVER IT ASKED
// FOR NOW EXISTS. Player-Lollipop went 7.2% -> 13.1% for a 45% damage increase and
// still lost 8 of its 10 matchups at <=5%. Its problem was never output: it was
// CROSSING 1,080 wu WITH 100 HP TO REACH 70 wu, absorbing 102.4 HP of weapon damage
// per match against a 100 HP pool. This comment then said "the lever would be
// per-character health or movement speed — and `CharacterDef.stats` is display-only,
// so no such lever exists."
//
// ✅ AUTHORISED DEVIATION #10 BUILT IT. Lollipop is authored `health: 8` — a 120 HP
// pool against the roster's 70 — and measures 45.9% strength, up 24.8 pp, without a
// single weapon number changing. That is the shape of the whole roster now: the kit
// says what a character DOES and the vitals say how long it gets to do it.
//
// ── WHAT WAS DELIBERATELY LEFT ALONE ────────────────────────────────────────
//
// Nine of eleven characters were measured and not touched. The two that look like
// outliers and are not this file's problem:
//
//   * PIZZA, the character `07a4e3a` named as the exposed question. It splits
//     66.9% in the player's hands against 10.3% in the AI's — the widest role gap
//     in the roster — and the cause is NOT its kit. `sim.ts` implements this
//     file's stun rule as written ("stunned = movement locked to 0"): a stunned
//     player is rooted and keeps shooting. `ai.ts:stepAI` gates its weapon choice
//     on `aiFrozen`, so a stunned AI is rooted AND SILENCED. Measured over one
//     full 2000 ms stun with both fighters pinned in range
//     (`tools/tmp/stun_symmetry.mjs`): the stunned player fires 100% of its shots
//     and the stunned AI fires 0%, for 11 of 11 characters. Pizza applies the most
//     status in the roster (3.61 stuns + 3.23 slows a match), so it is the
//     character that asymmetry flatters most. Priced on a staged sim: removing it
//     costs the player 9.5 pp of aggregate win rate and moves single matchups by
//     up to 84.4 pp — and it makes Pizza WORSE (38.6 -> 27.5), which is exactly why
//     retuning Pizza here would have been tuning around a driver bug.
//   * HAMBURGER, the top outlier at 86.6% and first in every measurement. There is
//     no mistuned number to point at: it has the roster's highest kit DPS (34.5
//     HP/s), the joint-longest reach, both status effects, and the only heal. It is
//     the best kit, and it is the Normal-tier starter. That is a design question
//     (should the free starter be the strongest?), not a defect, and it goes to Uri
//     with the rarity roll-up in the report.
//     ⚠️ See "THE HAMBURGER ROLE SPLIT" immediately below. That paragraph turned out
//     to be right for a reason nobody had measured, and the number it quotes was
//     being produced by an instrument that cannot play the character.
//
// ─────────────────────────────────────────────────────────────────────────────
// THE HAMBURGER ROLE SPLIT (2026-08-05) — it is the INSTRUMENT, and behind it is a
// real balance problem pointing the other way. NO BALANCE CHANGE IS MADE HERE.
// ─────────────────────────────────────────────────────────────────────────────
//
// `6447a68` closed the kit-distinctiveness question and handed over one finding: **8 of
// the 17 remaining settled matchups involve Hamburger**, whose halves are 15.0% in the
// player's hands against 65.6% in the AI's — **a 50.6 pp role split, twice the next
// largest in the roster** — and six of the eight are the same cell shape,
// *"player-Hamburger loses >= 95%"*. It called that *"a vitals/driver interaction"*.
//
//   `tools/tmp/burger_lab.mjs` (--selftest 16/16) · `tools/tmp/stage_sim.mjs`
//   110 matchups x 32 seeds, policy smart2, shipped arena, paired on identical seeds.
//   VALIDATED FIRST: `--roster` reproduces `roster_lab.mjs` **110 of 110 cells
//   bit-identical** and its three guards to the digit — settled 17/110, rarity tier
//   spread 3.98 pp, aggregate 49.5%. The guards and the finding come out of the SAME
//   run, so they can never be taken from two different measurements.
//
// ── WHERE THE TWO HALVES ACTUALLY DIVERGE ───────────────────────────────────
//
// Nine realised quantities, both halves, side by side. One row is not like the others:
//
//     quantity                    PLAYER hands    AI hands
//     win rate                          15.0%       65.6%
//     damage dealt / match               85.2       106.5
//     damage taken / match               74.0        83.4
//     HP fraction left                  0.011       0.130
//  >> SELF-HEAL HP / match               0.0        27.0   <<
//     mean separation wu                433.5       394.6
//     time to first damage s             6.39        6.43
//     stuns started on opponent          1.17        1.44
//     slows started on opponent          1.07        1.40
//
// Engagement distance, opening, status application and damage taken are all within a
// few percent. The AI restores **27.0 HP a match** and the player restores **zero**.
//
// ── PROVEN FROM BOTH ENDS, BECAUSE ONE END IS A CORRELATION ─────────────────
//
//     rung                                        player   AI    split
//     shipped                                      15.0%  65.6%  +50.6 pp
//     CONTROL: the AI cannot heal (`ALLOW_HEAL`)   15.0%  11.3%   -3.7 pp
//     the PLAYER heals, on `ai.ts:rankHeal`'s
//       own three conditions                       75.6%  65.6%  -10.0 pp
//
// Take the heal off the AI and the split inverts. Give it to the player and the split
// inverts the other way. **The split is the self-heal, and nothing else measured moves
// it** — the terrain-slow defect recorded on `SPLAT_DURATION_MS` is worth 0.6 pp of it.
//
// ── AND THE DRIVER THAT CANNOT PRESS IT IS THE SCRIPTED PLAYER ──────────────
//
// `tools/tmp/scripted_player.mjs:bestWeapon` opens with `if (w.type === 'self') return;`.
// Every shipped measurement policy except `kite` therefore cannot press a heal, and
// Hamburger owns the roster's ONLY `self` weapon.
//
// **That is the exact mirror of the FIRST defect in `ai.ts`'s list** (`07a4e3a`:
// `pickHighestDamageWeapon` skipped `type === 'self'`, so the AI could never heal on the
// same character the player healed with). Same weapon, same character, same one-line
// category exclusion, other side of the match. The shape has left `ai.ts` and moved into
// the instrument that judges `ai.ts`.
//
// It costs 50.6 pp on exactly one character for two reasons, both asserted in
// `sim.test.mjs` §25(c): Hamburger is the only owner of a `self` weapon, and it has the
// roster's SMALLEST pool (70 HP as player, 63 as AI), so 25 HP on a 6 s cooldown is a
// third of the pool per press and a measured 32% effective-HP increase.
//
// AND THE SIM IS NOT AT FAULT: §25(d) drives a hurt player Hamburger's Onion Ring through
// the ordinary input path and it heals, and `match.ts` calls
// `setWeaponCount(weapons.length)`, so the slot is bound to key `4` and to the HUD weapon
// bar. **A human can press it. Only the measurement cannot.**
//
// ── A SECOND STALE EXCLUSION, IN THE SAME SIX-LINE FUNCTION ─────────────────
//
// `4105116` proved the authored `damage` field is not what a press delivers, and its own
// commit message says *"both drivers ranked weapons by authored damage"*. It fixed `ai.ts`
// (`pressValue`, checked against the sim in all 183 weapon-band cells by `sim.test.mjs`
// §20(b)) and the fix never crossed to `bestWeapon`, which still ranks by `w.damage`.
//
// ⚠️ THE OLD WORDING, KEPT BECAUSE IT PASSED A TEST AND WAS STILL WRONG: *"the two
// drivers rank the same kit differently today, for exactly the two characters that commit
// named — Taco's Double Toss (authored 0, delivers 23) and Burrito's Topping Swarm
// (authored 5, delivers 20) — at 5 of 8 separation bands."*
//
// **It is FIVE characters, not two, and the missing dimension is COOLDOWNS.** "Exactly
// two" is what you get from a model in which every weapon is eligible at every band. On a
// live tick the eligible set is a SUBSET, and three more characters flip inside a subset.
// Measured on real playing ticks across the roster (`tools/tmp/p3_rankdiv.mjs`, 8 seeds x
// 110 matchups, player side, with a self-comparison control at 0 divergent ticks):
// taco 3.7% of ticks (Onion/Filling -> Double), burrito 0.9% (Disc -> Swarm), soup 0.6%
// (Noodle -> Splash), waterbottle 0.6% (Cap/Glass -> Spray), sushi 0.1% (Fish/Seaweed ->
// Rice); hamburger/donut/egg/lollipop/pizza/hotdog are 0. `sim.test.mjs` §25(e) now
// enumerates ELIGIBLE SUBSETS and pins all five, keeping the old assertion above it.
//
// ── ⚠️ THE FINDING BEHIND THE FINDING, AND IT IS THE EXPENSIVE ONE ──────────
//
// Fixing the instrument does not just close the split. It reveals what the split was
// hiding, and this is the number that matters:
//
//     rung                        settled   tier spread   aggregate   hamburger strength
//     shipped                     17/110      3.98 pp       49.5%          40.3%
//     player presses the heal     14/110    **16.56 pp**     55.1%        **70.6%**
//
// Only 10 of 110 cells move (all of them Hamburger's player half — the counterfactual is
// inert for every character with no `self` weapon, asserted in the tool's selftest), and
// four of the six *"player-Hamburger loses >= 95%"* cells stop being settled. **Settled
// falls 17 -> 14, which is the thing the pass was for.**
//
// But played with its own heal, Hamburger is the strongest character in the game by 14 pp,
// and it is Normal tier with only one tier-mate, so the Normal roll-up goes 48.4% -> 62.0%
// and the rarity tier spread goes **3.98 pp -> 16.56 pp — nearly double the ~9 pp noise
// floor, and four times the guard Uri drove to 4.0 pp in `§24b`.**
//
// `docs/LESSONS.md` §13 in its purest form: *"AI stalled: 0.0%" was true for months.*
// "Hamburger wins 15% in the player's hands" is true of the instrument and false of the
// game, and the roster's balance has been fitted for two passes against a measurement that
// under-plays exactly one character — the one `DECISIONS §13` had already flagged as the
// strongest in the game before any of this.
//
// ── ✅ BOTH DONE. THE OLD PLAN, KEPT SO THE SEQUENCE IS LEGIBLE ─────────────
//
// The block below said *"NOT the driver … NOT Hamburger's vitals … so the sequence is:
// land the driver fix, re-measure, and THEN decide what Hamburger should be."* That was
// right, and both halves have now been done, in that order:
//
//   * The driver: `bestWeapon` ranks by `ai.ts:pressValue` and presses the heal on
//     `ai.ts:rankHeal`'s three conditions (driver rev 4, `driver_guard.mjs` 86
//     assertions, `--no-player-heal` / `--damage-ranking-key` reproduce the old figures
//     BYTE-IDENTICALLY — verified 110/110 cells on both policies before anything else).
//   * The vitals: `healAmount` 25 -> 18, below. NOT `stats.health` — the heal IS the
//     character, and it is the only lever that reaches it without moving the vitals that
//     `6447a68` measured at 7-12 pp of rarity guard per point. (⚠️ That per-point figure
//     is stale — the fixed driver reads **13.5-27.9 pp**, see `HEALTH_PER_STAT` — which
//     makes the choice to move the heal rather than the vitals more right, not less.)
//   * STILL NOT the terrain-slow fix. Priced on the block at `SPLAT_DURATION_MS`; it
//     regresses the settled count 17 -> 19 and is worth 0.6 pp of this split.
//
// ── THE LADDER `healAmount: 18` WAS PICKED OFF ──────────────────────────────
//
// `tools/tmp/stage_weapon.mjs` + `roster_lab.mjs --seeds 32 --policies smart2`, shipped
// arena, fixed driver, paired on identical seeds. VALIDATED FIRST with a NO-OP STAGING
// CONTROL: an unchanged staged copy reproduces the unstaged run **110/110 cells
// bit-identical** (settled 14, aggregate 56.7898%), so nothing in the harness is moving.
//
//     healAmount   hamburger strength   TIER SPREAD   settled   aggregate
//        25 (was)        70.9%            15.94 pp      14        56.8%
//        22              63.1%            12.34 pp      14        56.5%
//        20              60.6%            11.25 pp      15        56.7%
//     >> 18              53.4%           **8.05 pp**    14        57.6%   <<
//        15              40.3%             9.53 pp      13        57.9%
//
// ⚠️ HOW MUCH OF THAT IS RESOLVED, STATED BEFORE IT IS USED. Strength, tier spread,
// settled and aggregate are all AGGREGATES with a **~9 pp floor**, so NO SINGLE ADJACENT
// RUNG IS RESOLVED (18 vs 20 is 2.8 pp of strength and 3.2 pp of spread — inside it).
// The evidence is the MONOTONE five-point ladder spanning 30.6 pp, whose slope is
// **3.06 pp of strength per 1 HP** — so `healAmount` is resolvable to about **±3 HP** and
// no finer. 18 is the argmin of the spread ladder and the only rung whose spread clears
// the floor; the exact integer inside 15..21 is a judgement call, and it is logged as one.
// The PAIRED per-matchup delta is a DIFFERENT, EXACT quantity: 25 -> 18 moves **13 of 110
// cells, max |Δ| 62.5 pp**, and every one of the 13 involves Hamburger (6 as player, 7 as
// AI) — which is what a change to one character's only heal must look like.
//
// Two levers deliberately NOT reached for, both measured and both dead ends:
//   * COOLDOWN IS INERT. 6000 -> 12000 ms moves Hamburger 70.9 -> 70.5% and the spread
//     15.94 -> 15.62 pp, because a match is only ~11.9 s of play and it is the FIRST
//     press that decides.
//   * THE KIT IS VIOLENT. Patty Smash 12 -> 9 damage costs **34 pp of strength**
//     (70.9 -> 36.9%), i.e. ~11 pp per point of authored damage. Not a tuning knob.
//
// ── 🚨 AND THE BINDING CONSTRAINT HAS NOW MOVED OFF HAMBURGER ───────────────
//
// This block, `docs/STATE.md` and the tier-spread guard all framed the spread as a
// HAMBURGER problem. **That framing expired the moment the fix landed.** At
// `healAmount: 18` the tiers read:
//
//     Normal 53.0 · Rare 52.3 · Epic 53.0 · Legendary **45.0** · Neon 49.5 · Cyber 48.7
//
// The 8.05 pp spread is set by **LEGENDARY AT THE BOTTOM** — Sushi 43.8%, Water Bottle
// 46.3% — not by Normal at the top. Sushi is the weakest character in the game in every
// driver variant measured (43.6-45.2% across six), and it is the ONLY tier now more than
// a floor away from the mean. The next balance pass is a SUSHI/LEGENDARY pass, not a
// Hamburger one, and lowering `healAmount` further makes the spread WORSE (15 -> 9.53 pp),
// because Normal then falls past Legendary on the other side.
//
// Separately, the fixed driver re-based DIFFICULTY: aggregate player win 49.5% -> 56.8%,
// consistently across every heal-capable variant. The game did not change; the
// measurement of it did. **Every past "aggregate ~= 50%" statement now reads ~= 57% for a
// competent player** — which puts `DECISIONS §12`'s parked difficulty dial back in play.
//
// ── 🚨 THE SUSHI/LEGENDARY PASS WAS RUN. IT IS REFUSED, AND HERE IS WHY ─────
//
// The paragraph above ends "the next balance pass is a SUSHI/LEGENDARY pass ... and it has
// to push Legendary UP". It was run, on the same instrument, and the answer is that
// **there is no admissible lever finer than the band it would have to land inside.**
//
// Speed is inert (see `SPEED_PER_STAT`) and Sushi is already at the `SPEED_TOP_STAT` cap,
// so the only per-character lever is the card's integer `health` bar. Measured with
// `stage_kit.mjs --stat <id>.health=<n>` + `roster_lab.mjs --seeds 32`, shipped arena,
// fixed driver, paired on identical seeds, and VALIDATED FIRST with a NO-OP STAGING
// CONTROL — an unchanged staged copy reproduces the unstaged run **220/220 cells
// bit-identical across both policies**, so nothing in the harness is moving. Admissibility
// against `sim.test.mjs` §22's structural bounds was checked before any match was run, by
// `tools/tmp/bl_vitals_gate.mjs` (5/5 selftest, every bound shown to FAIL on a known-bad
// roster); all six candidates below are admissible, so §22 is not what refuses them.
//
//   SUSHI         health      4        5 (ship)     6         7
//     strength             30.3%       43.8%      59.8%     73.9%   steps +13.5/+16.0/+14.1
//     TIER SPREAD          14.69 pp  **8.05 pp** **7.03 pp** 14.77 pp
//
//   WATER BOTTLE  health      5        6 (ship)     7
//     strength             27.5%       46.3%      74.2%           steps +18.8/+27.9
//     TIER SPREAD          18.20 pp  **8.05 pp**   9.53 pp
//
// Both ladders are MONOTONE, so this is a slope and not a threshold artefact. The slope is
// **13.5 to 27.9 pp of strength per ONE card point** — see the correction at
// `HEALTH_PER_STAT`, whose "7-12 pp" was measured on the PRE-FIX driver and is stale by
// about 2x.
//
// ── THE ARITHMETIC THAT DECIDES IT ──────────────────────────────────────────
//
// The band to be closed is **8.05 pp wide and already clears the ~9 pp aggregate floor.**
// The finest step available is **13.5 pp**. The lever is **1.7x to 3.5x coarser than the
// defect**, so every rung either leaves Legendary where it is or throws it past the top:
// of the six candidates measured, exactly ONE lowers the spread at all.
//
//   sushi health 6:  spread 8.05 -> 7.03 pp · settled 14/110 (UNCHANGED) · aggregate
//                    57.6 -> 56.3% · on `chase`, 35.78 -> 32.97 pp.
//
// **That 1.02 pp is INSIDE the ~9 pp floor and is not a resolved improvement.** What it
// costs IS resolved, and it is bigger:
//
//   roster strength sd      3.0 -> 4.2 pp
//   roster strength range   9.7 -> **16.6 pp**          (+6.9 pp — 6.8x what was bought)
//   Sushi                   43.8% (roster MINIMUM) -> 59.8% (roster MAXIMUM)
//   Cyber                   48.7 -> 45.5%, and becomes the new BOTTOM tier
//   Lollipop                47.7 -> **43.3%**, the new roster minimum
//
// 🚨 **The roster's floor does not come up. It goes DOWN by 0.5 pp** — Sushi at 43.8% is
// replaced by Lollipop at 43.3% — while the ceiling rises 6.4 pp. The outlier is not
// removed; it changes sign and grows, and the bottom tier moves from Legendary to Cyber.
// That is the same shape the kit sweep already refused under "DISTINCTIVENESS AND POWER
// ARE THE SAME LEVER": *a compensating lever quantised as coarsely as the thing it has to
// cancel.* Two-character moves are worse, not better — `sushi 6 + waterbottle 7` reads
// **20.23 pp**, and any compensating cut on another tier is the same 13.5-27.9 pp step
// pointed the other way.
//
// ── AND THERE IS NO SUB-POINT LEVER, FOR A REASON IN A DIFFERENT SECTION ────
//
// `HEALTH_PER_STAT` is the one continuous knob on the durability axis, so shrinking it
// would shrink the step. It **cannot go below ~0.0933**, and the bound is NOT §22(h)'s
// durability-range floor (that binds only at ~0.067) — it is `sim.test.mjs` §25(c), which
// requires Hamburger's heal to restore over a QUARTER of its pool. Hamburger holds the
// roster's minimum health stat, so its pool GROWS as the scale shrinks:
// `100*(1 - 3p) < 4*healAmount` gives `p > (100 - 4*healAmount)/300`, i.e. **0.0933** at
// `healAmount: 18`. The shipped 0.10 clears it by 0.0067 — about 7%. So the knob can only
// go UP, which makes the step coarser still.
//
// 🚨 **AND THE SAME INEQUALITY READ THE OTHER WAY IS A LIVE HAZARD IN `DECISIONS §28`,**
// which offers Uri any integer in **15..21** for `healAmount`. At the shipped `p = 0.10`
// Hamburger's pool is 70, so §25(c) needs `healAmount > 17.5`: **15, 16 and 17 turn that
// gate RED.** The MEASURED range and the ADMISSIBLE range are not the same range, and
// nothing said so. If Uri picks one of the three, the threshold is what moves — keeping
// the old wording with the reason, exactly as it already did once at 1/3 -> 1/4 — not the
// heal, and not this constant.
//
// ── WHAT IS ACTUALLY TRUE OF THE ROSTER, STATED PLAINLY ─────────────────────
//
// Nothing here needs fixing. On `smart2` the roster reads settled **14/110**, sd **3.0
// pp**, range **9.7 pp**, tier spread **8.05 pp** — every one of them the best this
// project has measured, and the tier spread is inside Uri's guard. "Legendary is at the
// bottom" is a true statement about an 8 pp band, not a defect, and no instrument here can
// resolve it. (`chase` reads 35.78 pp, but it never has been inside the floor and is
// dominated by Pizza at 9.4% — 0.0% as player across all 320 of its matches.)
//
// ⚠️ The one quantity here that IS outside every floor, and it is NOT a stats problem:
// **Sushi's role split is +30.7 pp** — asPlayer 59.1% against asAI **28.4%**, the roster's
// worst AI half (next worst Taco 34.1%) under an above-average player half. Legendary is
// not weak; the AI cannot play it. Water Bottle is the same shape at +15.7 pp. That is
// `ai.ts`, which this pass does not own, and it is the only lead left worth pulling.
//
// ─────────────────────────────────────────────────────────────────────────────

export const CHARACTERS: Record<CharacterId, CharacterDef> = {
  hamburger: {
    id: 'hamburger', name: 'Hamburger', emoji: '🍔', rarity: 'Normal',
    stats: { damage: 10, health: 3, speed: 5 }, hasTrail: false,
    // WAS: 'Closed happy eyes, small smile. Stacked bun/patty/lettuce/tomato silhouette.'
    //   Uri, blind to the code: "the face is the WORST PART in the character… drawn lines and
    //   not an actual face" (DECISIONS §37). Per-part scored `face-overall` 3.5 vs 9 and `eyes`
    //   3 vs 8.5 from the opposite direction on the same day. The eyes were built as a flattened
    //   arc — a stroke — which is precisely what "drawn lines" means, and CLOSED eyes are the
    //   bottom rung of the ladder in the doc comment above. Kept here because the old wording is
    //   what the existing geometry was authored against.
    face: 'EYES: open and eager. White sclera ovals — on the orange bun they will be the brightest value on the character, which is the point — with dark pupils offset up-and-forward, a catchlight in each, and the old closed-happy arc kept ONLY as the upper lash line above them. The existing shared tangent frame on the curved crown is right and must be kept: it is why the eyes and brows can never drift out of plane. MOUTH: a broad open grin with a dark throat behind the lip and a visible lower lip — not a flat dark shape, which is what the per-part pass named ("no lip thickness or interior value step"). SILHOUETTE: the stacked bottom-bun/patty/cheese/tomato/lettuce/top-bun tower, every layer owning real height and its own substance — the richest food mass in the cast and worth protecting. But the lettuce must read as a frill running CONTINUOUSLY around the whole stack; two leaf points either side of the head is the ear signal (five for five). PERSONALITY: hearty, greedy, good-natured heavy.',
    weapons: [
      { key: 'Smash', name: 'Patty Smash', type: 'melee', range: REACH.meleeStrong, damage: 12, cooldown: 650, cone: 80, color: '#FFC93C', effect: null, emoji: '🍖' },
      { key: 'Tomato', name: 'Tomato Toss', type: 'ranged', range: REACH.rangedClose, damage: 8, cooldown: 800, speed: SPEED.closeFast, color: '#E63946', effect: 'slow', splatter: true, emoji: '🍅' },
      { key: 'Lettuce', name: 'Lettuce Fling', type: 'ranged', range: REACH.rangedMax, damage: 6, cooldown: 1100, speed: SPEED.maxSlow, color: '#7CB518', effect: 'stun', emoji: '🥬' },
      // ✅ THE ONLY `self` WEAPON IN THE ROSTER, and until 2026-08-05 the AI could not
      // use it: `ai.ts` reached weapons only through `pickHighestDamageWeapon` (which
      // skips `type === 'self'`) and `pickSniperWeapon` (which requires `'ranged'`), so
      // there was no code path by which an enemy Hamburger ever healed — 0 fires across
      // 11 matchups / 17,677 ticks — while the human player used the same slot for 25 HP.
      // A live ASYMMETRY, not dead content. Fixed in `ai.ts` (`pickSelfHealWeapon`); see
      // AUTHORISED DEVIATION #7 above for the threshold and what it measured.
      //
      // ⚠️ AND IT CAME BACK, MIRRORED, IN THE INSTRUMENT. `scripted_player.mjs:bestWeapon`
      // carries the same one-line exclusion on the PLAYER's side, so every balance figure
      // in this repo has been measured with this weapon pressed 0 times by the player and
      // 1.08 times a match by the AI. That is the whole of Hamburger's 50.6 pp role split
      // and 8 of the 17 settled matchups — see "THE HAMBURGER ROLE SPLIT" above before
      // touching any number on this character.
      // ⚠️ `healAmount` WAS 25 AND IS NOW 18. The heal is the whole character: priced at
      // **3.06 pp of strength per 1 HP** on a monotone five-point ladder (25 -> 70.9%,
      // 22 -> 63.1, 20 -> 60.6, 18 -> 53.4, 15 -> 40.3). 18 is the only rung whose rarity
      // tier spread clears the ~9 pp floor (8.05 pp) and it holds settled at 14/110.
      // Resolvable to ±3 HP and no finer — see the ladder above before moving it, and do
      // NOT reach for the cooldown (measured inert) or Patty Smash (measured violent).
      { key: 'Onion', name: 'Onion Ring', type: 'self', damage: 0, cooldown: 6000, healAmount: 18, color: '#F4E9DA', effect: null, emoji: '🧅' },
    ],
    abilities: [
      { emoji: '🍅', name: 'Tomato Toss', desc: 'Slows enemies down' },
      { emoji: '🥬', name: 'Lettuce Fling', desc: 'Stuns enemies for a few seconds' },
      { emoji: '🍖', name: 'Patty Smash', desc: 'Deals heavy damage' },
      { emoji: '🧅', name: 'Onion Ring', desc: 'Heals himself' },
    ],
  },

  donut: {
    id: 'donut', name: 'Donut', emoji: '🍩', rarity: 'Normal',
    stats: { damage: 4, health: 7, speed: 6 }, hasTrail: true,
    // WAS: 'Crooked smile, sprinkles across a pink glaze torus.'
    //   Uri: "better than the burger — the eyes have more depth, but can be taken deeper, and the
    //   mouth is deeper than burger but still missing details" (DECISIONS §38). This is the one
    //   old line with nothing wrong in it, only something MISSING: it specified a mouth and no
    //   eyes at all, and the sphere-with-a-specular the file chose is rung two of four. The
    //   crooked smile is genuine personality and is carried forward verbatim.
    face: 'EYES: OPEN, and KEEP THE SPHERE — ADD THE WHITE. Donut already has real 3D eye geometry catching a specular — that is exactly why Uri ranked it above hamburger — but a highlight is not a sclera, and a dark bead with a glint is not an open eye. Build white sclera spheres as the brightest value on the character, a dark pupil offset toward the smile\'s high side so the gaze and the grin agree, and an explicit catchlight mesh on top of the specular rather than instead of it. MOUTH: the crooked, lopsided smile stays — it is the personality and Uri named it as the better half of this face — but it needs an INTERIOR: a lip line with a darker throat plane behind it. "Deeper than burger but still missing details" is a request for a value step inside the silhouette, not a bigger curve. SILHOUETTE: sprinkles across a pink glaze torus, chocolate-dipped feet holding the value drop. ⚠️ Donut is a STUB body — there is genuinely no torso between the limbs, so the chain sprouts from the ring edge and reads detached. Do NOT swap the archetype (it would cost the silhouette Uri just called better than the burger\'s); build a visible attachment mass where each limb meets the ring instead. PERSONALITY: sweet, chaotic, slightly smug.',
    weapons: [
      { key: 'Candy', name: 'Candy Barrage', type: 'ranged', range: REACH.rangedLong, damage: 4, cooldown: 900, speed: SPEED.long, color: '#FF6FA5', effect: null, pellets: 3, spreadDeg: 14, trailBoosted: true, emoji: '🍬' },
    ],
    abilities: [
      { emoji: '🍬', name: 'Candy Barrage', desc: 'Throws candies that chip away health' },
      { emoji: '🍯', name: 'Sticky Trail', desc: 'Leaves a filling trail - hurts enemies, speeds him up' },
    ],
  },

  taco: {
    id: 'taco', name: 'Taco', emoji: '🌮', rarity: 'Rare',
    stats: { damage: 9, health: 4, speed: 5 }, hasTrail: false,
    // WAS: 'Trapezoid shell with a jagged crimped top edge; face floats completely outside the
    //       shell, to the side.'
    //   All three clauses were implemented literally once and all three were wrong on screen
    //   (`taco.ts:10-27` records it): the trapezoid read as a paper bag, the jagged crimp read as
    //   a crown because tall spikes are the loudest thing in any silhouette, and the FLOATING
    //   FACE read as a second head — a pale ball with eyes beside a brown mass, so the eye picked
    //   the ball as the character and the shell as scenery. The file fixed all three and the spec
    //   still said the opposite, which is exactly the trap §42 describes: the next agent to read
    //   it re-implements the rejected version faithfully. Uri's own reject — "no mouth, seems
    //   like a hat or something… looks like fruit, not taco add-ons" (DECISIONS §39) — is folded
    //   in below. The old wording is kept because it explains why the file departs from it.
    face: 'EYES: the best construction in the cast after egg — a sphere PLUS an explicit white glint mesh, which is why Uri ranked taco third of three blind — and it needs one thing: a real white sclera behind the pupil, sized as the brightest mass on the face rather than a glint on a dark bead. Dark pupil offset for gaze, catchlight kept. MOUTH: a wide open cheeky smile with a BRIGHT interior, and it must sit CLEAR of the neck column and collar, which `taco.ts:216` names as this character\'s darkest band. A dark opening immediately above the darkest band merges into one mass and reads as a HAT BRIM — that is exactly what Uri saw, and it is a fusion, not a missing mouth. Lift the mouth, or lighten the interior, or both. FACE PLACEMENT: front and centre on the near shell wall, sharing one tangent frame. Never floating beside the shell. SILHOUETTE: a crescent — a U wall with two soft horns and a dipped mouth — with a small crimped ripple, not a trapezoid and not tall spikes. FILLINGS: shredded, diced and crumbled. The palette (TOMATO #E63946, LETTUCE, ONION) is correct and the SHAPES are the bug: spheres read as berries and purple rings read as grapes, which is Uri\'s "looks like fruit". PERSONALITY: crisp, quick, cheeky.',
    weapons: [
      { key: 'Filling', name: 'Filling Toss', type: 'ranged', range: REACH.rangedLong, damage: 12, cooldown: 900, speed: SPEED.long, color: '#6B3E26', effect: null, emoji: '🥩' },
      // Onion Bomb sits one rung below Filling/Double so Taco keeps two distinct
      // ranges, exactly as it did at 200 vs 220.
      { key: 'Onion', name: 'Onion Bomb', type: 'ranged', range: REACH.rangedMid, damage: 7, cooldown: 750, speed: SPEED.mid, color: '#B497D6', effect: null, emoji: '🧅' },
      {
        key: 'Double', name: 'Double Toss', type: 'ranged', range: REACH.rangedLong, damage: 0, cooldown: 2500, speed: SPEED.long, color: '#6B3E26', effect: null, emoji: '💥',
        comboParts: [
          { color: '#6B3E26', damage: 14, angle: -10, emoji: '🥩' },
          { color: '#B497D6', damage: 9, angle: 10, emoji: '🧅' },
        ],
      },
    ],
    abilities: [
      { emoji: '🥩', name: 'Filling Toss', desc: 'Throws his filling for heavy damage' },
      { emoji: '🧅', name: 'Onion Bomb', desc: 'Throws onion for damage' },
      { emoji: '💥', name: 'Double Toss', desc: 'Special: throws filling and onion together for massive damage' },
    ],
  },

  burrito: {
    id: 'burrito', name: 'Burrito', emoji: '🌯', rarity: 'Rare',
    stats: { damage: 6, health: 7, speed: 7 }, hasTrail: false,
    // WAS: 'White wrap, stands upright, toppings visible at the open end.'
    //   ⚠️ NO FACE SPEC AT ALL — and Uri's verdict was "face is not good" (DECISIONS §39). This
    //   is the strongest single datum behind §42: the one character whose `face:` field never
    //   mentioned a face is the one whose face he rejected without being able to say why. The old
    //   wording is kept because "open end with visible fillings" is still the silhouette landmark.
    face: 'EYES: this character had NO EYE SPEC AND NO MOUTH SPEC, which is the defect. Open eyes, three elements: a white sclera, a dark pupil offset for gaze, a catchlight. ⚠️ The wrap is TORTILLA #DFD2B9, a pale cream — so an off-white sclera will dissolve into it. The sclera must be genuinely white AND carry a strong dark lash/lid line to hold its edge against a low-contrast ground; this is the one character where the eye needs a drawn boundary to survive its own background. MOUTH: real, with a dark interior behind the lip. PLACEMENT IS THE REAL FIX: set the face HIGH and WIDE on the tube. A small face low on a long narrow head reads as a MUZZLE, and that is half of why Uri said "looks a bit like a goat". 🚨 SILHOUETTE — THE GOAT. Every part of this character is individually a correct burrito and together they compose an animal: two upright torn-foil peaks on top read as EARS, LANKY proportions read as animal proportions, pale cream reads as fur, small low face reads as a muzzle. Improving the face alone will not fix it — the silhouette is read first. Fold the foil peaks BACK over the crown, round them, or make them asymmetric; do not leave two points either side of the head. The uncut ~2.5:1 vertical tube is the one proportion nothing else in the cast has and is worth keeping. PERSONALITY: wound-up, fast, over-stuffed.',
    weapons: [
      // Disc sits one rung below Swarm so Burrito keeps its 240-vs-260 ordering.
      { key: 'Disc', name: 'Burrito Disc', type: 'ranged', range: REACH.rangedLong, damage: 10, cooldown: 850, speed: SPEED.long, color: '#F4E9DA', effect: null, emoji: '🌯' },
      { key: 'Roll', name: 'Roll Stun', type: 'melee', range: REACH.meleeQuick, damage: 4, cooldown: 1400, cone: 100, color: '#FFC93C', effect: 'stun', emoji: '🌀' },
      {
        key: 'Swarm', name: 'Topping Swarm', type: 'ranged', range: REACH.rangedMax, damage: 5, cooldown: 3000, speed: SPEED.maxSlow, color: '#7CB518', effect: null,
        pellets: 4, spreadDeg: 55, homing: true,
        pelletColors: ['#7CB518', '#E63946', '#FFC93C', '#F4E9DA'],
        pelletEmojis: ['🥬', '🍅', '🧀', '🧅'],
        emoji: '✨',
      },
    ],
    abilities: [
      { emoji: '🌯', name: 'Burrito Disc', desc: 'Throws himself like a flying disc for damage' },
      { emoji: '🌀', name: 'Roll Stun', desc: 'Rolls up and freezes enemies in place for a few seconds' },
      { emoji: '✨', name: 'Topping Swarm', desc: 'Special: squeezes out all his toppings, which fly everywhere and chase enemies dealing damage - the flying toppings can be destroyed' },
    ],
  },

  egg: {
    id: 'egg', name: 'Egg', emoji: '🥚', rarity: 'Neon',
    stats: { damage: 7, health: 8, speed: 4 }, hasTrail: false,
    // WAS: 'Open eyes with highlights, straight neutral mouth.'
    //   ✅ THE ONLY LINE IN THIS FILE THAT WAS RIGHT, and the reason egg's face is the best in
    //   the cast. It is EXTENDED below, not replaced. Uri's egg reject was about the SHAPE —
    //   "the ears don't make sense, the egg lost the appearance of egg" (DECISIONS §40) — not
    //   about the face. Kept verbatim so it is obvious what the other ten are being raised to.
    face: 'EYES: open eyes with catchlights — sclera, pupil and highlight built as three separate meshes. ⭐ THIS IS THE CAST REFERENCE; the other ten are being brought up to it, so changes here propagate. What it still needs, and there are two things: (a) the sclera must become the BRIGHTEST VALUE ANYWHERE ON THE CHARACTER — measured, even egg has 0% of its eye pixels above 0.85 luma against the reference plates\' 31.1% and 34.1%, because what it has today is a catchlight where a sclera belongs; and (b) THE PUPIL IS CENTRED. `egg.ts` sets it to x = 0, so egg stares dead ahead and has no gaze — offset it horizontally like every other character in this brief. A centred pupil reads dead even when everything else is right, and it is the one element of the standard the cast reference itself does not meet. MOUTH: straight and deadpan — KEEP THE DEADPAN, it is the whole personality and nothing else in the cast has it — but give it an interior value step behind the lip so it reads as an opening. The worried brow creases are correct: an egg has no hair, so worry reads as a raised shell ridge rather than eyebrows, and the asymmetric inner-end lift is what makes it a raised eyebrow instead of two symmetric worry lines. 🚨 SILHOUETTE — THE THING TO ACTUALLY FIX. A clean uncut TRUE OVOID (fuller at the bottom, tapering) is recorded at `egg.ts:206` as "the one thing Egg had going for it in the silhouette test". The lifted lid broke the crown and the flanking shell shards read as EARS, and both were added to signal "egg" while destroying the shape that signalled it better. Restore the ovoid; move any cracking cue onto the surface as a decal rather than into the outline. PERSONALITY: deadpan, stoic, slightly anxious under it.',
    weapons: [
      { key: 'Tackle', name: 'Egg Tackle', type: 'melee', range: REACH.meleeHeavy, damage: 16, cooldown: 2200, cone: 70, color: '#FFF8EA', effect: null, emoji: '🥚' },
      { key: 'Hatch', name: 'Hatch!', type: 'ranged', range: REACH.rangedMax, damage: 5, cooldown: 2600, speed: SPEED.maxDrift, color: '#FFE9A8', effect: null, homing: true, peckHits: 3, peckInterval: 500, emoji: '🐣' },
      { key: 'Shards', name: 'Shell Shards', type: 'ranged', range: REACH.rangedMid, damage: 4, cooldown: 1000, speed: SPEED.mid, color: '#F4E9DA', effect: 'slow', pellets: 3, spreadDeg: 30, emoji: '💥' },
    ],
    abilities: [
      { emoji: '🥚', name: 'Egg Tackle', desc: 'Launches herself at the enemy for big damage - slow to charge up' },
      { emoji: '🐣', name: 'Hatch!', desc: 'She cracks open and a chick bursts out, pecking for damage' },
      { emoji: '💥', name: 'Shell Shards', desc: 'Broken shell pieces slow enemies and chip away their health' },
    ],
  },

  lollipop: {
    id: 'lollipop', name: 'Lollipop', emoji: '🍭', rarity: 'Cyber',
    stats: { damage: 7, health: 8, speed: 7 }, hasTrail: false,
    // WAS: 'Eyes on the stick, mouth on the candy. Concentric red/white swirl disc.'
    //   🚨 THE CLEAREST CASE IN THE FILE, AND BOTH HALVES WERE UNFROZEN BY URI BY NAME:
    //   "Unfreeze the structure — the mouth doesn't have to be above the eyes" and "the candy
    //   should have more colors than red only, make it colorful" (DECISIONS §41). The
    //   implementation was CORRECT — `lollipop.ts:344` cites this exact line — and the
    //   SPECIFICATION was wrong. It is also the reason the eyes came out ~3 px at the size a
    //   player actually sees: the stick is thin, so eyes sized to it are invisible, while the huge
    //   disc carried nothing but a small mouth arc. Kept because it explains the existing layout.
    face: 'EYES AND MOUTH BOTH ON THE CANDY DISC, MOUTH BELOW THE EYES like every other character. The split face is retired by Uri directly. Big open eyes sized to the DISC, not to the stick — white sclera as the brightest value on the character, dark pupils offset for gaze, an explicit catchlight each. MOUTH: an open smile with a dark interior, below the eyes, on the same disc face. This also solves the ~3 px eye problem by construction: the disc is the largest flat frontal surface in the cast and a face built for it can be genuinely large. 🎨 THE DISC MUST BE MULTI-COLOUR — Uri: "more colors than red only, make it colorful". Keep it a genuine Archimedean spiral ribbon rather than a bullseye of concentric rings (that part is right and is the landmark), but run at least three candy hues through it. LIMB_TEAL #8FE0C9 is already in this character\'s own palette, so a colourful disc starts from something authored rather than invented. It also pays twice: lollipop is the WORST figure/ground character in the cast — 12 of 18 stations below the 0.10 standard, `fig` pinned at 0.497 against a ground at 0.40–0.48, so dL sits at 0.02–0.10 BY CONSTRUCTION — and more hue on the disc is the cheapest lever on that number. 🚨 The near-black cellophane cape petals either side of the disc read as HORNS (pattern 1, four for four at the time it was found). Re-place or round them. And keep the limbs and torso from crossing the disc: on this character interpenetration hides the FACE, not just a limb. PERSONALITY: bright, hyperactive, sugar-manic.',
    weapons: [
      // ── AUTHORISED DEVIATION #8 (2026-08-05): LOLLIPOP — see the block above
      //    `CHARACTERS` for the full measurement. damage 11 -> 16 and 10 -> 17.
      { key: 'Smash', name: 'Lollipop Smash', type: 'melee', range: REACH.meleeStrong, damage: 16, cooldown: 750, cone: 80, color: '#E63946', effect: null, emoji: '🔨' },
      { key: 'Giant', name: 'Giant Lollipop', type: 'melee', range: REACH.ultimateSlam, damage: 17, cooldown: 8000, cone: 360, color: '#E63946', effect: 'stun', giantSlam: true, emoji: '🍭' },
    ],
    abilities: [
      { emoji: '🔨', name: 'Lollipop Smash', desc: 'Swings herself like a hammer for heavy damage' },
      { emoji: '💫', name: 'Giant Lollipop', desc: 'Grows huge and hits the whole map, making everyone dizzy' },
    ],
  },

  pizza: {
    id: 'pizza', name: 'Pizza', emoji: '🍕', rarity: 'Neon',
    stats: { damage: 4, health: 10, speed: 5 }, hasTrail: false,
    // WAS: 'Closed eyes, smiling. Triangular slice with pepperoni and a crust base.'
    //   Uri: "face is TERRIBLE" (DECISIONS §42) — the second-harshest verdict in the cast, and
    //   the second character specified with CLOSED eyes. The correlation with the closed-eye
    //   family is the whole finding. Kept because the triangle clause still governs the model.
    face: 'EYES: OPEN. The closed eyes are the entirety of Uri\'s "face is terrible" and they are removed — this was the second-worst-rated face in the cast and the second one specified shut. White sclera as the brightest value on the character (the slice is tan-on-tan, so the eye whites will be the only real value anchor on it), dark pupils offset for gaze, a catchlight each, and the old closed-smiling arc demoted to the upper lash line. MOUTH: a wide confident grin with a dark throat and a visible lower lip. SILHOUETTE: a triangular slice with pepperoni and a crust base — the triangle is the protected landmark here, unlike the rest of the cast\'s shapes, because it is the whole read at gameplay distance. ⚠️ But the melted cheese strands must not hang as two points either side of the head — Uri named that construction on four other characters and it reads as ears whatever it is made of. Drape them across the FRONT of the slice or run them continuously round the edge. ⚠️ And watch the tan-on-tan trap this file already records: slice, torso and limbs were literally the same constant, putting head, arms, legs and body inside a third of a stop. The face is where the missing value range gets paid back first. PERSONALITY: broad, loud, confident tank.',
    weapons: [
      { key: 'Dough', name: 'Dough Balls', type: 'ranged', range: REACH.rangedLong, damage: 5, cooldown: 850, speed: SPEED.long, color: '#FFE9A8', effect: 'slow', emoji: '⚪' },
      { key: 'Tomato', name: 'Tomato Splat', type: 'ranged', range: REACH.rangedMid, damage: 6, cooldown: 900, speed: SPEED.mid, color: '#E63946', effect: null, splatter: true, emoji: '🍅' },
      { key: 'Cheese', name: 'Cheese Blind', type: 'ranged', range: REACH.rangedClose, damage: 4, cooldown: 1300, speed: SPEED.close, color: '#FFD873', effect: 'stun', emoji: '🧀' },
    ],
    abilities: [
      { emoji: '⚪', name: 'Dough Balls', desc: 'Throws dough balls that slow enemies down' },
      { emoji: '🍅', name: 'Tomato Splat', desc: 'Tomatoes stick to the floor, damaging and slowing anyone who steps on them' },
      { emoji: '🧀', name: 'Cheese Blind', desc: "Cheese sticks to an enemy's face and blocks their vision until someone hits them" },
    ],
  },

  sushi: {
    id: 'sushi', name: 'Sushi', emoji: '🍣', rarity: 'Legendary',
    stats: { damage: 9, health: 5, speed: 8 }, hasTrail: false,
    // WAS: 'Wide eyes, puckered lips. Rice cylinder banded with nori, salmon centre.'
    //   Not one of the seven Uri reviewed, and the only old line that already said "wide" rather
    //   than "closed" — so the instinct was right and the construction still carries no white.
    //   §42 predicts the whole cast moves, not only the seven with rejects on file. Kept because
    //   the nori-band-on-rice clause is the character's silhouette landmark.
    face: 'EYES: wide and open — the old line already had the right instinct and is extended, not reversed. Build the three elements: a white sclera as the brightest value on the character, a dark pupil offset for gaze, an explicit catchlight. Rice is near-white, so the sclera needs a dark lid line and a dark pupil to separate from it — the SEPARATION here comes from the pupil and lash, not from the white. ⚠️ BOTH EYES MUST CARRY THE SAME ROLL. `setFromUnitVectors` picks the shortest arc and leaves a different residual roll per side, and that is the recorded cause of this character reading as having a LAZY EYE (LESSONS §12). Use an explicit shared tangent frame or matched quaternions, not per-eye `setFromUnitVectors`. MOUTH: keep the pucker — it is the personality — but a pucker still needs an INTERIOR: a dark opening ringed by a lighter lip, not a painted O. SILHOUETTE: classic salmon nigiri — a rounded rice mound, a near-black nori belt around its lower half, a glossy salmon slice draped over the top, the emoji read exactly. The rice-and-nori motif carried down onto the torso so the whole body reads as made of sushi. Legendary is the premium tier and this is the strongest high-contrast graphic in the cast (near-black on white); it earns the most craft. PERSONALITY: fast, precise, a little haughty.',
    weapons: [
      { key: 'Rice', name: 'Rice Spray', type: 'ranged', range: REACH.rangedClose, damage: 2, cooldown: 700, speed: SPEED.closeFast, color: '#FFFFFF', effect: null, pellets: 5, spreadDeg: 35, emoji: '🍚' },
      { key: 'Seaweed', name: 'Seaweed Bait', type: 'ranged', range: REACH.rangedMid, damage: 5, cooldown: 1000, speed: SPEED.mid, color: '#7CB518', effect: 'slow', emoji: '🌿' },
      { key: 'Fish', name: 'Fish Pile', type: 'melee', range: REACH.meleeStrong, damage: 6, cooldown: 1200, cone: 150, color: '#F4A261', effect: null, emoji: '🐟' },
      { key: 'Catch', name: 'Big Catch', type: 'ranged', range: REACH.rangedMax, damage: 9, cooldown: 3200, speed: SPEED.maxSlow, color: '#FF8C42', effect: null, pellets: 3, spreadDeg: 40, homing: true, emoji: '🐡' },
    ],
    abilities: [
      { emoji: '🍚', name: 'Rice Spray', desc: 'Throws a spray of rice grains - each one chips away a little health' },
      { emoji: '🌿', name: 'Seaweed Bait', desc: 'Seaweed lures every enemy toward it while he shoots them' },
      { emoji: '🐟', name: 'Fish Pile', desc: 'Turns into a pile of fish that attack for small damage' },
      { emoji: '🐡', name: 'Big Catch', desc: 'Special: throws seaweed with fish - the fish grow huge and the seaweed scatters across the map, pulling enemies everywhere' },
    ],
  },

  soup: {
    id: 'soup', name: 'Soup', emoji: '🍲', rarity: 'Epic',
    stats: { damage: 6, health: 9, speed: 4 }, hasTrail: false,
    // WAS: 'Gray steam-coloured eyes, no mouth. Wide bowl with rising steam.'
    //   🚨 UNFROZEN BY URI. "No mouth" is the same defect he already rejected by name on taco
    //   ("no mouth, seems like a hat"), and §42 predicted this reject before it arrived. The
    //   `soup.ts` header currently says the no-mouth grey-eyed blank stare is "EXPLICITLY kept";
    //   THAT NOTE IS NOW VOID and the file must be updated with it. "Grey steam-coloured eyes"
    //   is also the direct cause of this face carrying no value range at all: it specifies the
    //   eyes to be the SAME family as the steam behind them. Kept because it is why soup looks
    //   the way it does today.
    face: 'GIVE IT A MOUTH. Uri rejected "no mouth" on taco and the same complaint lands here — a small, calm, slightly open mouth with a dark interior behind the lip. Soup can stay the unsettling-calm one in the cast without being featureless: CALM IS AN EXPRESSION, NOT AN ABSENCE, and a blank face reads as unfinished rather than eerie. EYES: open, and NOT grey. A white sclera as the brightest value on the character, dark pupils offset for gaze, a catchlight each. Grey-on-grey was the old spec and it is why this face has no value range — it put the irises in the same family as the steam behind them. ⚠️ CLIPPING BUDGET, and it is real: `sepscan --mode chars` measures this character at 16.23% above luma 0.94 with p95 0.9753, against a reference band of 0.72–9.29% (median 2.49%). Soup is ALREADY the cast\'s worst near-white offender, so do NOT pay for the sclera by adding white. Pay for it by taking the CERAMIC bowl albedo (#DCD3C2, luma 0.947) DOWN — the bowl is where the 16.23% lives, it is a large area, and the eyes are a few dozen pixels. That trade improves both numbers at once: the sclera only reads as the brightest value if the bowl stops competing with it. And per LESSONS, scaling a warm off-white down is NOT a desaturation. SILHOUETTE: a wide bowl with rising steam, a ladle held in handR nodding at Splash/Toss/Dump, grey stoneware sleeves, cream mitts, dark boots, the near-black RIM_TRIM band carrying the dark rung. PERSONALITY: slow, heavy, eerily serene — serene WITH a face.',
    weapons: [
      { key: 'Splash', name: 'Soup Splash', type: 'ranged', range: REACH.rangedClose, damage: 3, cooldown: 750, speed: SPEED.closeFast, color: '#E8792A', effect: null, pellets: 3, spreadDeg: 25, emoji: '💦' },
      { key: 'Noodle', name: 'Noodle Toss', type: 'ranged', range: REACH.rangedLong, damage: 5, cooldown: 1000, speed: SPEED.long, color: '#FFE9A8', effect: 'slow', emoji: '🍜' },
      { key: 'Dump', name: 'Soup Dump', type: 'melee', range: REACH.meleeHeavy, damage: 16, cooldown: 3000, cone: 90, color: '#E8792A', effect: 'slow', emoji: '🌊' },
    ],
    abilities: [
      { emoji: '💦', name: 'Soup Splash', desc: 'Throws his soup liquid - each splash chips away a little health' },
      { emoji: '🍜', name: 'Noodle Toss', desc: 'Throws noodles that slow enemies down' },
      { emoji: '🌊', name: 'Soup Dump', desc: 'Special: tips himself over onto an enemy, pouring all his soup and noodles - big damage and a heavy slow' },
    ],
  },

  waterbottle: {
    id: 'waterbottle', name: 'Water Bottle', emoji: '💧', rarity: 'Legendary',
    stats: { damage: 8, health: 6, speed: 6 }, hasTrail: false,
    // WAS: 'Eyes floating above the cap, big smile. Translucent blue bottle with a darker cap.'
    //   §42 flagged "eyes floating above the cap" as a predicted reject before Uri sent one: it
    //   is the same detached-feature construction he rejected on taco ("the face floats completely
    //   outside the shell" read as a second head). A spec that says FLOATING will get floating.
    //   Kept because the translucency clauses still govern the model.
    face: 'EYES ON THE BOTTLE, NEVER FLOATING ABOVE THE CAP. Detached features were the old spec and floating is a defect already rejected on taco — a face with nothing under it reads as a separate object. Set the eyes on the SHOULDER of the bottle where the shell curves, sharing one tangent frame, so they sit on a surface. Open eyes, three elements: a white sclera as the brightest value on the character, a dark pupil offset for gaze, an explicit catchlight. ⚠️ THE FACE MUST BE OPAQUE AND MOUNTED ON THE OUTER SURFACE. This is the one genuinely transmissive character in the cast; a feature placed inside or on the inner wall gets eaten by the transmission pass, and the sclera in particular will vanish into whatever is behind the bottle. MOUTH: keep the big smile — it is the most extrovert face in the cast and worth protecting — with a dark throat behind the lip. SILHOUETTE: translucent blue bottle, darker cap, water fill kept NON-transmissive (an opaque glossy liquid seen through a transmissive shell; nesting two transmissive materials makes the transmission snapshot incoherent and one of them flattens). PERSONALITY: cheerful, splashy, unbothered.',
    weapons: [
      // Water Bottle is the only four-weapon fighter with three ranged slots, so
      // Spray and Glass each drop a rung to keep all four reaches distinct.
      { key: 'Spray', name: 'Water Spray', type: 'ranged', range: REACH.rangedClose, damage: 3, cooldown: 850, speed: SPEED.close, color: '#BFEFFF', effect: 'slow', pellets: 3, spreadDeg: 30, emoji: '💦' },
      { key: 'Glass', name: 'Glass Shards', type: 'ranged', range: REACH.rangedMid, damage: 7, cooldown: 1100, speed: SPEED.mid, color: '#BFEFFF', effect: 'stun', emoji: '🧊' },
      { key: 'Cap', name: 'Cap Shot', type: 'ranged', range: REACH.rangedLong, damage: 6, cooldown: 900, speed: SPEED.long, color: '#1E90D8', effect: 'slow', emoji: '🔵' },
      { key: 'Mega', name: 'Mega Splash', type: 'melee', range: REACH.meleeHeavy, damage: 18, cooldown: 3500, cone: 100, color: '#1E90D8', effect: 'slow', emoji: '🌊' },
    ],
    abilities: [
      { emoji: '💦', name: 'Water Spray', desc: 'Sprays water that slows enemies down a lot' },
      { emoji: '🧊', name: 'Glass Shards', desc: 'Shoots glass shards that deal damage and freeze enemies' },
      { emoji: '🔵', name: 'Cap Shot', desc: 'Fires his cap - enemies slip when it hits' },
      { emoji: '🌊', name: 'Mega Splash', desc: 'Special: launches himself up (takes a few seconds), his cap becomes a second bottle, and together they become one giant bottle that dumps water on an enemy for huge damage and a heavy slow' },
    ],
  },

  // ⚠️ THE PLAINEST KIT IN THE ROSTER, AND IT IS THE RAREST TIER. Every one of these
  // three weapons is `plain` — the only character with no pellets, homing, peck, combo,
  // splatter, slam, trail or heal anywhere in its kit (`kitSignature`, asserted in
  // `sim.test.mjs` §24(c)). Measured over 3,520 matches it also sits below the roster's
  // mean behavioural distinctiveness (1.17 against 1.36), and the nearest neighbour the
  // fingerprint gives it — Sushi, at 0.62 — is the same character its static kit
  // signature shares two of three weapon shapes with.
  //
  // ⚠️ **EIGHT REPLACEMENT KITS WERE MEASURED AND ALL EIGHT WERE REFUSED.** Read the
  // "KIT DISTINCTIVENESS" section at the bottom of this file BEFORE retuning this
  // character: not one of them raised matchup-profile divergence, six of eight blew the
  // rarity tier-spread guard past 10 pp at constant kit output, and the one that held the
  // guard bought +0.046 of behavioural spread against a 0.030 noise floor. The reason is
  // not this character; it is that the roster's behavioural space is already full.
  hotdog: {
    id: 'hotdog', name: 'Hot Dog', emoji: '🌭', rarity: 'Cyber',
    stats: { damage: 9, health: 6, speed: 8 }, hasTrail: false,
    // WAS: 'Sleepy half-closed eyes, small smile. Sausage in a bun with a mustard zigzag.'
    //   §42 predicted this reject: "sleepy half-closed" is the closed-eye family again, and
    //   `hotdog.ts` implemented it as "a thick lid stroke over a small peeking pupil" — which is
    //   the exact drawn-line construction Uri called "the worst part" on hamburger. Kept because
    //   the lid stroke and the mustard zigzag are both authored against this wording.
    face: 'EYES OPEN, NOT SLEEPY. Half-closed is the closed-eye family that Uri ranked bottom without seeing any code, and the current build is "a thick lid stroke over a small peeking pupil" — a stroke, which is what "drawn lines and not an actual face" means. Keep the laid-back personality by DROOPING the upper lid a little over a FULL open eye: RELAXED IS A LID ANGLE, NOT A MISSING EYE. Under that lid, all three elements — a white sclera as the brightest value on the character, a dark pupil offset for gaze (offset DOWN and to the side reads as bored far better than a closed eye does), and a catchlight. The old lid stroke survives as the lash line above the sclera, which is where it belonged all along. MOUTH: a small easy smile with a dark interior behind the lip. SILHOUETTE: a plump sausage nestled in a split bun, long axis along local X so the full length reads broadside at the shipped camera instead of foreshortening down its own length; a bold mustard zigzag along the sausage ridge as the one unmistakable landmark; small emissive Cyber end caps in the exposed sausage tips, gently pulsing — energised food, not a glow stick. PERSONALITY: fast, unbothered, permanently half-awake — and now half-awake with EYES.',
    weapons: [
      { key: 'Mustard', name: 'Mustard Blast', type: 'ranged', range: REACH.rangedLong, damage: 7, cooldown: 900, speed: SPEED.long, color: '#FFC93C', effect: null, emoji: '💛' },
      { key: 'Ketchup', name: 'Ketchup Slip', type: 'ranged', range: REACH.rangedMid, damage: 5, cooldown: 950, speed: SPEED.mid, color: '#D62839', effect: 'slow', emoji: '🔴' },
      { key: 'Slash', name: 'Bun Slash', type: 'melee', range: REACH.meleeStrong, damage: 11, cooldown: 650, cone: 75, color: '#FFC93C', effect: null, emoji: '⚔️' },
    ],
    abilities: [
      { emoji: '💛', name: 'Mustard Blast', desc: 'Burns enemies from a distance' },
      { emoji: '🔴', name: 'Ketchup Slip', desc: 'Makes enemies slide and lose control' },
      { emoji: '⚔️', name: 'Bun Slash', desc: 'Powerful close-range strike' },
    ],
  },
};

/** Rarity display order, lowest → highest. */
export const RARITY_ORDER: Rarity[] = ['Normal', 'Rare', 'Epic', 'Legendary', 'Neon', 'Cyber'];

// ─────────────────────────────────────────────────────────────────────────────
// VITALS — the character card, made real
// ─────────────────────────────────────────────────────────────────────────────
//
// ── AUTHORISED DEVIATION #10 (2026-08-05): PER-CHARACTER HEALTH AND SPEED ────
//
// **`CharacterDef.stats` used to say "Not used in combat math", and it was telling the
// truth about two of its three axes.** Every character in this game had identical HP and
// identical movement speed; the only per-character movement difference in the whole roster
// was Donut's `TRAIL.speedBoost`. The card on character select drew three bars, and two of
// them described nothing.
//
// This section is Uri's answer to `DECISIONS §13`: **rarity means power, so build real
// stats.** Three things had to be true at once and they pull against each other.
//
// ── 1. THE CARD IS NOW THE SOURCE, NOT A DESCRIPTION ────────────────────────
//
// `health` and `speed` are AUTHORED here and the SIM READS THEM. That direction matters:
// a display value derived from the sim can still drift into meaninglessness (it did — see
// the structural argument below), whereas a sim driven BY the display value cannot
// disagree with it, ever, by construction. `damage` runs the other way — the weapon table
// is and stays the source of truth for damage, so the card's damage bar is DERIVED from
// the kit by `kitDps` below. `sim.test.mjs` §22 asserts all three directions, so the card
// cannot become fiction again without a red gate.
//
// ⚠️ THE OLD EVIDENCE THAT IT WAS FICTION IS ITSELF WITHDRAWN, and the replacement is
// better. `DECISIONS §13(b)` recorded ρ = 0.327 between the card's stat total and measured
// strength; the driver audit (`d9753ff`) could not reproduce it — same tool, same seeds,
// same commit gives 0.395, and today's tree gives 0.462. Do not quote 0.327. The claim
// survives on an argument that does not depend on a number that moves: **the card's stat
// total took only FIVE distinct values across eleven characters, with FIVE of them tied at
// 19.** With n = 11 significance needs ρ ≈ 0.62. A statistic with five levels and a
// five-way tie in the middle cannot discriminate the roster *even in principle*, whatever
// its correlation happens to measure this week.
//
// ── 2. THE ROLE DIAL HAD TO SURVIVE ─────────────────────────────────────────
//
// `PLAYER_MAX_HP` / `ENEMY_MAX_HP` were per-ROLE constants, and `ENEMY_MAX_HP` is Uri's
// difficulty dial — he had just turned it to 90 (DEVIATION #9). So per-character health is
// a MULTIPLIER ON the role base, never a replacement for it: the dial still scales the
// whole roster exactly as it did, and `maxHpFor` is the only place the two combine.
//
// ── 3. NOTHING MAY GO FASTER THAN THE CAMERA THINKS IT CAN ──────────────────
//
// `render/camera.ts` derives the fair-play radius partly from
// `MAX_CLOSING_SPEED = PLAYER_SPEED * TRAIL.speedBoost`, commented **"nothing in rules.ts
// moves faster"** — and that guarantee (you always see the fighter who is shooting you) is
// the reason the whole weapon-range ladder was retuned in the first place. A speed
// multiplier above 1 would have quietly falsified it, in a file this pass does not own.
//
// So the speed scale is anchored at the TOP: `SPEED_TOP_STAT` maps to exactly 1.0 and
// every slower character scales DOWN. `PLAYER_SPEED` stops being "the speed" and becomes
// "the speed cap", the camera's claim stays literally true, `FAIR_PLAY.radiusUnits` does
// not move, and `tools/aspect.mjs` still passes at 0.00 wu spread. `sim.test.mjs` §22
// asserts the cap directly, because a comment in another file is not a guard.
//
// ⚠️ IT IS NOT FREE, AND THE BILL IS PACING — but the bill was paid twice over. Anchoring
// at the top means the roster MEAN speed falls, and `099119a` had just spent a whole
// commit buying 2.0 s of dead time back. Measured on that same instrument
// (`tools/tmp/pacing_ladder.mjs`, paired against the pre-vitals tree, 880 matches):
//
//                            smart2              chase
//   the approach          +0.35 s            +0.35 s     <- what speed costs
//   engaged time          +0.95 s            +0.40 s     <- what health buys
//   DUTY CYCLE            +2.1 pp            +1.1 pp     <- the net, and it is POSITIVE
//
// Bigger pools mean longer fights, and longer fights are more fight per session even
// though the walk to them got 0.35 s longer. The one figure that got worse is the
// approach, which is inside the ~0.8 s the project treats as the pacing resolution floor.
//
// ── WHAT THIS DELIVERED, measured (110 matchups x 32 seeds, paired) ─────────
//
//                              before        after
//   SETTLED matchups (smart2)  43/110      **22/110**    `DECISIONS §13(c)`'s headline
//   roster strength sd          24.7 pp       12.4 pp
//   rarity monotonic?             NO          **YES**    40.4 / 41.7 / 46.3 / 50.0 /
//                                                        58.7 / 61.1 across the six tiers
//   aggregate player win        52.2%         51.8%      Uri's difficulty, untouched
//
// ⚠️ TWO HONEST CAVEATS, both stated rather than buried:
//   * The ramp was fitted on `smart2`, the corrected skilled player. Under `chase` — the
//     naive charge-straight-in policy — the roster is FLATTER (settled 71 -> 57, sd
//     27.6 -> 18.1) but the rarity ramp is NOT monotone. Pizza is why and it cannot be
//     fixed from here: it is already at `health: 10`, the top of the card's own scale.
//   * `chase` aggregate falls 45.0% -> 36.6%. That is 8.4 pp, just inside the ~9 pp band
//     this project treats as unresolvable for an aggregate, and it is one policy of two.
//
// ─────────────────────────────────────────────────────────────────────────────

/** The 0-10 scale the character card draws its bars on. `src/ui` renders `value / 10`. */
export const STAT_MAX_DISPLAY = 10;

/**
 * The `health` stat that means "the role's base pool, unmodified". A character authored
 * at exactly this value has `maxHp === PLAYER_MAX_HP` (or `ENEMY_MAX_HP`), so the roster
 * still has a defined centre and `ENEMY_MAX_HP` still means what its own comment says.
 */
export const HEALTH_BASELINE_STAT = 6;

/**
 * How much one point of the card's `health` bar is worth, as a fraction of the role pool.
 *
 * MEASURED, not picked. `tools/tmp/vitals_probe.mjs` holds the whole roster at neutral and
 * moves one character's one stat: at the first value tried (0.14) a single point was worth
 * **9 to 17 pp of that character's strength**, which is far too coarse to shape a six-tier
 * ramp out of eleven characters — the fit could not place a tier without overshooting the
 * one below it. 0.10 halves that and lets the roster use the card's FULL 1-10 range
 * (authored 3..10 = 70% to 140% of the role pool) instead of huddling around the middle.
 *
 * ⚠️ IT IS FAR COARSER THAN THIS COMMENT SAID, AND THE OLD WORDING IS KEPT BECAUSE FOUR
 * OTHER PLACES QUOTE IT. It read:
 *
 *     "⚠️ It is still coarse. One point moves a character 7-12 pp, so the tier ramp cannot
 *      be tuned finer than about 10 pp per character."
 *
 * That figure came from `vitals_probe.mjs` on the PRE-FIX driver — the one that could not
 * press a heal and ranked weapons by authored `damage` (`docs/LESSONS.md` §5/§15). Re-run
 * on the fixed driver as a full monotone ladder (`stage_kit.mjs --stat <id>.health=<n>` +
 * `roster_lab.mjs --seeds 32`, 32 seeds x 110 matchups, paired, with a no-op staging
 * control at 220/220 cells bit-identical), one point is worth:
 *
 *     SUSHI         h4 30.3% -> h5 43.8% -> h6 59.8% -> h7 73.9%   (+13.5 / +16.0 / +14.1)
 *     WATER BOTTLE  h5 27.5% -> h6 46.3% -> h7 74.2%               (+18.8 / +27.9)
 *
 * **13.5 to 27.9 pp per point, not 7-12** — stale by about 2x. The conclusion the old
 * wording drew is not weakened by that, it is doubled: an integer display scale that is
 * the source of truth cannot tune anything finer than one point, and one point is now
 * measured at 1.7x to 3.5x the width of the entire rarity band it would have to land
 * inside. The full arithmetic, and the pass it refuses, is recorded above `CHARACTERS`
 * under "THE SUSHI/LEGENDARY PASS WAS RUN".
 *
 * ⚠️ And this constant has a HARD FLOOR at **~0.0933**, which is not obvious from here:
 * `sim.test.mjs` §25(c) requires Hamburger's heal to clear a quarter of its pool, and
 * Hamburger's pool GROWS as this shrinks. See the same record for the derivation.
 */
export const HEALTH_PER_STAT = 0.10;

/**
 * The `speed` stat that means `PLAYER_SPEED` exactly. **This is a CAP, not a centre** —
 * see point 3 above. Nothing in the roster may be authored above it, and `sim.test.mjs`
 * §22 fails if anything is.
 */
export const SPEED_TOP_STAT = 8;

/**
 * How much one point of the card's `speed` bar costs, as a fraction of `PLAYER_SPEED`.
 *
 * ── SPEED IS A NEARLY INERT BALANCE LEVER, AND THAT IS A MEASUREMENT ────────
 *
 * This was expected to be the second axis that breaks the settled matchups. It is not.
 * `tools/tmp/vitals_probe.mjs`, one character at a time on a neutral roster, cutting that
 * character's speed by 20% (stat 8 -> 4):
 *
 *   hamburger -2.5pp   taco -3.1   burrito -5.6   sushi  0.0   waterbottle +1.2
 *   pizza     -3.7     hotdog -4.4  |  egg -10.0   soup +3.2   lollipop -0.6
 *   donut    -26.9  <- and this one is not speed, it is the Sticky Trail
 *
 * **Nine of eleven move by under 6 pp, and the response is not even monotone**: two get
 * BETTER at a 20% cut (Soup +3.2, Water Bottle +1.2) and four get better at a 10% one
 * (Lollipop +7.5, Soup, Egg, Water Bottle). Being slower is worth something to a fighter
 * the scripted player has to walk to. Only Donut responds strongly, and Donut is the
 * character whose damage and whose own `TRAIL.speedBoost` are both functions of movement:
 * that is the trail responding, not speed as a stat.
 *
 * ── So why keep the axis at all, and why this size ──────────────────────────
 *
 * Because a bar that moves nothing is the defect this whole deviation exists to fix, and
 * because "how fast does this character feel" is exactly the kind of question
 * `docs/LESSONS.md` §10 says an instrument cannot answer. The axis is kept, honestly
 * scaled, and sized by the one cost that IS measurable: every point below
 * `SPEED_TOP_STAT` lengthens the approach for both fighters in every matchup that
 * character appears in. 0.03 across the authored 4..8 band puts the roster mean
 * multiplier at 0.94, which measures **+0.35 s of approach** — inside the ~0.8 s this
 * project treats as the pacing resolution floor, and repaid with interest by the extra
 * engaged time the bigger pools buy (see the duty-cycle table above).
 *
 * Do not raise it hoping for balance. It was tried at 0.05 and the roster did not care.
 */
export const SPEED_PER_STAT = 0.03;

/** This character's HP as a fraction of its role's base pool. */
export function healthMultiplier(id: CharacterId): number {
  return 1 + (CHARACTERS[id].stats.health - HEALTH_BASELINE_STAT) * HEALTH_PER_STAT;
}

/** This character's movement as a fraction of the speed cap. Always <= 1 — see point 3. */
export function speedMultiplier(id: CharacterId): number {
  return 1 - (SPEED_TOP_STAT - CHARACTERS[id].stats.speed) * SPEED_PER_STAT;
}

// ─────────────────────────────────────────────────────────────────────────────
// CHARACTER LEVELS 1-15 — the second power axis
// ─────────────────────────────────────────────────────────────────────────────
//
// ── AUTHORISED DEVIATION #11 (2026-08-05): PER-CHARACTER LEVELS ─────────────
//
// Uri, verbatim: *"I want the ability to improve characters in levels. 1-15, each level
// improves damage and HP."* The COST side of that lives in `economy/tuning.ts` (it is
// progression, not balance); what lives here is the only thing the simulation needs to
// know — how much bigger a level makes a fighter.
//
// ── FOUR CONSTRAINTS, and every one of them is somebody else's measurement ──
//
// 1. **A LEVEL IS NOT A CARD POINT.** `sim.test.mjs` §22(a)/(f) assert that the card's
//    `health` bar IS the pool and its `damage` bar IS `damageStatFor(id)`. A level system
//    that wrote into `CharacterDef.stats` would either turn those gates red or re-create
//    the exact defect DEVIATION #10 exists to have fixed — a card that lies. So the level
//    is a SEPARATE, CONTINUOUS term multiplied in at the sim, and the card keeps
//    describing the base character. It also has to be continuous for a second reason:
//    one card point is worth 7-12 pp of measured strength, so a 0-10 integer scale cannot
//    express fifteen steps even in principle.
//    ⚠️ "7-12 pp" IS STALE — it was measured on the pre-fix driver, and the fixed one reads
//    **13.5-27.9 pp** (see `HEALTH_PER_STAT`). The argument is not weakened, it is doubled:
//    the integer step is even further from what fifteen levels need.
//
// 2. **IT IS ROLE-AGNOSTIC, BY CONSTRUCTION.** Uri: *"The game eventually should be humans
//    vs. humans. We will incorporate AI players to enrich. They need to be adjusted to the
//    player's level."* So there is ONE function of `(characterId, level)` and both sides
//    call it. There is deliberately no enemy-level table and no bot-only path: a bot
//    standing in for a level-8 human has a level-8 human's stats, and difficulty is a
//    property of how well it THINKS, not of how much paper it is made of.
//
//    ⚠️ `PLAYER_MAX_HP` (100) vs `ENEMY_MAX_HP` (90) is a pre-existing ROLE asymmetry and
//    Uri's live difficulty dial. It is left exactly alone — but nothing here depends on
//    the two bases differing, so deleting that asymmetry for PvP is a deletion rather than
//    a refactor.
//
// 3. **SPEED IS NOT ON THE LADDER, AND THAT IS DELIBERATE.** `render/camera.ts` derives
//    the fair-play radius — the guarantee that you can always see the fighter shooting you
//    — from `PLAYER_SPEED * TRAIL.speedBoost` on the explicit claim that "nothing in
//    rules.ts moves faster". §22(d) is the only guard on it and `aspect.mjs` would still
//    read PASS while a level quietly falsified it. Uri asked for damage and HP; speed was
//    also measured to be a nearly inert lever (nine of eleven characters move under 6 pp
//    on a 20% cut, non-monotonically). Two reasons, same answer.
//
// 4. **`maxHpFor` STAYS LINEAR IN ITS BASE.** §22(b) asserts that, so the role dial keeps
//    scaling the whole roster. The level term multiplies alongside the character term
//    rather than replacing either, which preserves the property rather than working
//    around it.
//
// ── SIZING: THIS GAME STACKS TWO POWER AXES WHERE THE GENRE STACKS ONE ──────
//
// Uri: *"I think that level 15 normal should be able to beat level 1 cyber. Understand the
// logic of how this works in common games and do the same."*
//
// In Brawl Stars (power 1-11) and Clash Royale (card levels 1-14) the level ladder applies
// roughly +5% to +10% of HP and damage per level — a 1.5x-2.5x total swing — and a maxed
// Common beats a fresh Legendary for one simple structural reason: **at equal level, rarity
// grants no power at all.** Rarity there governs ACQUISITION and UPGRADE COST. The level
// range wins because the rarity range is zero.
//
// ⚠️ THIS GAME HAS ALREADY CHOSEN OTHERWISE, DELIBERATELY, ONE COMMIT AGO. `DECISIONS
// §13`/§21 made rarity monotonic in MEASURED STRENGTH — Normal 40.4 -> Cyber 61.1, a
// **20.7 pp** spread at equal footing. So levels are a second power axis on top of a first
// one, and the two answers only coexist under one condition:
//
//   **the level span must comfortably exceed the rarity span, and rarity must pay for its
//   power somewhere other than in power — namely in what a level COSTS.**
//
// ⚠️ CORRECTED 2026-08-06 — THAT SECOND HALF NO LONGER EXISTS, and the old wording is
// kept here because it was wrong on BOTH of its claims and someone will otherwise
// re-derive it. It read: "That second half lives in
// `economy/tuning.ts:LEVEL_UP.rarityCostMultiplier`, which is Clash Royale's
// rarity-scaled upgrade cost transplanted onto a game where rarity also grants base
// power. The trade it makes legible: a rare character is the better long-run investment,
// a common one is far cheaper to max."
//
//   1. Rarity does NOT grant base power — DEVIATION #12 flattened it (DECISIONS §24b),
//      tier spread 20.7 pp -> 4.0 pp, below the ~9 pp noise floor.
//   2. Rarity does NOT scale upgrade cost — `rarityCostMultiplier` is 1.0 across every
//      tier (`68cac7a`, DECISIONS §26). Every character costs 44,770 coins to max.
//
// So there is no trade to make legible: rarity is ACQUISITION RARITY ONLY, which is what
// Uri asked for ("it means nothing besides the rarity to obtain it") and is the genre
// norm. §22's answer stands untouched — investment overcomes rarity, now trivially,
// because rarity costs nothing extra to invest in.

/** A brand-new character. Levels are 1-based so "Lv 1" is the floor, never "Lv 0". */
export const LEVEL_MIN = 1;

/** Uri's number, verbatim: levels 1-15. */
export const LEVEL_MAX = 15;

/**
 * Fraction of the fighter's own pool added per level above `LEVEL_MIN`.
 *
 * 0.05 is the genre's step (Brawl Stars is ~+5%/level of base) and over the 14 steps of a
 * 1-15 ladder it compounds to **1.70x HP**. Sized against the 20.7 pp rarity spread rather
 * than adopted: `tools/tmp/level_lab.mjs` measures the actual crossover through the real
 * `stepMatch`, and the acceptance test is Uri's sentence — a level-15 Normal must beat a
 * level-1 Cyber, while a level-matched Cyber must still beat a level-matched Normal.
 */
export const LEVEL_HEALTH_PER_LEVEL = 0.05;

/**
 * Fraction of a hit's damage added per level above `LEVEL_MIN`.
 *
 * Deliberately the SAME size as the health step, which is also what the reference games do.
 * Equal steps mean a level-N fighter versus a level-N fighter has an unchanged
 * time-to-kill RATIO — exactly the property Uri's "AI players adjust to the player's level"
 * answer needs, and the reason the win-rate curve across 1->15 can be flat at all rather
 * than drifting as the pools outgrow the guns.
 *
 * ⚠️ HP and damage are multiplicative in combat power, so 1.70x each is **2.89x effective
 * power against an unlevelled opponent.** That is the number that has to clear 20.7 pp of
 * rarity, and it is why nothing smaller was viable.
 */
export const LEVEL_DAMAGE_PER_LEVEL = 0.05;

/** Any level, from anywhere, forced into 1..15 as an integer. */
export function clampLevel(level: number): number {
  if (!Number.isFinite(level)) return LEVEL_MIN;
  return Math.max(LEVEL_MIN, Math.min(LEVEL_MAX, Math.floor(level)));
}

/** This level's HP multiplier. Exactly 1.0 at `LEVEL_MIN`, by construction. */
export function levelHealthMultiplier(level: number): number {
  return 1 + (clampLevel(level) - LEVEL_MIN) * LEVEL_HEALTH_PER_LEVEL;
}

/** This level's damage multiplier. Exactly 1.0 at `LEVEL_MIN`, by construction. */
export function levelDamageMultiplier(level: number): number {
  return 1 + (clampLevel(level) - LEVEL_MIN) * LEVEL_DAMAGE_PER_LEVEL;
}

/**
 * The HP pool a `role` fighter of this character starts with, at `level`.
 *
 * `roleBaseHp` is passed in rather than looked up so this function has no idea which role
 * it is serving: `sim.ts` supplies `PLAYER_MAX_HP` or `ENEMY_MAX_HP` and the difficulty
 * dial keeps working unchanged, on top of the per-character multiplier rather than
 * instead of it. Rounded, because HP is displayed and a fighter on 68.4 HP reads as a bug.
 *
 * `level` defaults to `LEVEL_MIN`, whose multiplier is exactly 1.0 — so every caller that
 * predates levels keeps its exact previous answer, and §22(b)'s linearity in `roleBaseHp`
 * holds at every level rather than only at level 1.
 */
export function maxHpFor(id: CharacterId, roleBaseHp: number, level: number = LEVEL_MIN): number {
  return Math.round(roleBaseHp * healthMultiplier(id) * levelHealthMultiplier(level));
}

/**
 * The movement speed (wu/ms) a fighter of this character moves at, given the base speed
 * for what it is doing — `PLAYER_SPEED` for a human, `AI_CHASE_SPEED` / `AI_FLEE_SPEED`
 * for the driver.
 *
 * ⚠️ IT SCALES THE AI TOO, DELIBERATELY. A speed stat that only applied in the player's
 * hands would make `strength` — the role-symmetric index the roster is judged on — respond
 * at half rate to half the roster's stats, and would be exactly the asymmetry `ai.ts` has
 * had to have surgically removed four times.
 */
export function speedFor(id: CharacterId, roleBaseSpeed: number): number {
  return roleBaseSpeed * speedMultiplier(id);
}

/**
 * SUSTAINED KIT OUTPUT, HP/s, with everything cycling off cooldown at a range where every
 * part lands. This is what the card's `damage` bar is derived from, and it is the one axis
 * that runs sim -> card rather than card -> sim, because `weapons` is and remains the
 * single source of truth for damage.
 *
 * It prices a PRESS, not the authored `damage` field, and those are different numbers:
 * `damage` is per-PELLET and per-PECK, and for a combo weapon it is 0 (Taco's Double Toss
 * is authored 0 and delivers 23). `ai.ts:pressValue` is the exact, sim-validated version
 * of the same idea — 183 of 183 weapon-band cells exact — but it is a function of
 * SEPARATION and lives downstream of this file, so what is used here is its `always` term:
 * the damage a press lands at any range the weapon reaches at all. `sim.test.mjs` §22
 * asserts this against `pressValue` at point-blank so the two cannot drift apart.
 *
 * Heals are excluded: a heal is not damage, and the one `self` weapon in the roster is
 * already visible on the card as an ability.
 */
export function kitDps(id: CharacterId): number {
  let dps = 0;
  for (const w of CHARACTERS[id].weapons) {
    if (w.type === 'self') continue;
    const perPress = w.comboParts
      ? w.comboParts.reduce((sum, p) => sum + p.damage, 0)
      : w.damage * (w.peckHits ?? 1) * (w.pellets ?? 1);
    dps += (perPress / w.cooldown) * 1000;
  }
  return dps;
}

/**
 * HP/s per point on the card's `damage` bar.
 *
 * Set so the roster spans the whole top of the scale without clipping: the strongest kit
 * (Hamburger, 33.9 HP/s) lands on 9.69 and rounds to exactly 10, and the weakest (Donut,
 * 13.3) lands on 4. A coarser divisor compresses the roster into fewer bar heights, and
 * the card having too few distinct values is precisely the defect §22(g) exists to catch.
 */
export const DPS_PER_DAMAGE_POINT = 3.5;

/** The card's `damage` bar for this character, derived from its kit. 1-10. */
export function damageStatFor(id: CharacterId): number {
  return Math.max(1, Math.min(STAT_MAX_DISPLAY, Math.round(kitDps(id) / DPS_PER_DAMAGE_POINT)));
}

/**
 * "How much fight is in this character" as ONE number: offence × durability. `kitDps` is
 * the HP/s the kit can put out; `healthMultiplier` is how long it lasts while doing it.
 * The product is the quantity that actually decides an exchange, and it is what the
 * trophy road is selling when it sells a rarer character.
 *
 * ⚠️ **IT IS A MODEL, AND IT IS STATED AS ONE.** The measurement is
 * `tools/tmp/roster_lab.mjs`'s `strength` — 7,040 matches through the real `stepMatch`,
 * which cannot live in a unit test. This exists so `sim.test.mjs` §22(h) can assert the
 * INPUT to the rarity promise even though the outcome has to be measured elsewhere. When
 * the two disagree, the measurement is right and this is the thing that needs fixing.
 *
 * Speed is deliberately NOT a term. Measured one character at a time on a neutral roster
 * (`tools/tmp/vitals_probe.mjs`), a 20% speed cut moves most of the roster by under 3 pp
 * of strength and moves several of them the WRONG WAY — being slower is worth something
 * to a fighter the scripted player has to walk to. A near-inert, non-monotone term would
 * make this index worse, not more complete.
 *
 * ⚠️ **AND `kitDps` IS A WEAKER PROXY FOR POWER THAN IT LOOKS — MEASURED 2026-08-05.**
 * The distinctiveness sweep below (`tools/tmp/kit_lab.mjs`) built eight Hot Dog kits that
 * all hold `kitDps` inside 29.8–31.0 (shipped: 29.96) and therefore all render the SAME
 * `damage` bar of 9 on the card. Measured strength across them ran **33.1% to 75.2%** —
 * a 42 pp span at constant modelled output. What moved it was REACH and press CADENCE,
 * neither of which this index or `kitDps` contains. Do not treat either as a balance
 * gate; they are a card derivation and a sketch, in that order.
 */
export function powerIndex(id: CharacterId): number {
  return kitDps(id) * healthMultiplier(id);
}

// ─────────────────────────────────────────────────────────────────────────────
// KIT DISTINCTIVENESS — measured, and why NOTHING in this file changed for it
// ─────────────────────────────────────────────────────────────────────────────
//
// ── CONSIDERED AND REFUSED (2026-08-05): "rarity buys DISTINCTIVENESS" ──────
//
// `DECISIONS §24b` took rarity's power away (tier spread 20.7 pp -> 4.0 pp) and §26 asked
// the obvious follow-up: if rarity no longer buys power, and it costs 4.5x to level, let
// it buy CHARACTER instead — "the rarest brawlers are not stronger, they are weirder".
// This section is the measurement that came back, and it says do not do it here.
//
// The instrument is `tools/tmp/kit_lab.mjs` (`--selftest` 10/10). It scores two things on
// the same 3,520 matches that produce the balance guard, so a distinctiveness number and
// the tier spread it must not move can never come from two different runs:
//
//   MATCHUP-PROFILE DIVERGENCE  each character's role-symmetric win vector against the
//                               other ten, MEAN-CENTRED (so "stronger" is not "more
//                               distinctive"), compared pairwise as an RMSD in pp.
//   BEHAVIOURAL FINGERPRINT     nine realised quantities — engagement distance, melee
//                               share, damage per press, press rate, stun/slow share,
//                               single-weapon focus, mobility, time to first damage.
//
// ── IT WAS CALIBRATED AGAINST KNOWN INPUTS FIRST, AND THAT CHANGED THE ANSWER ──
//
//   a LITERAL clone   (`stage_kit.mjs --clone hamburger:hotdog`)   2.10 pp
//   a UNIFORM roster  (all eleven given one character's kit)       2.58 pp roster mean
//   the SHIPPED roster                                           25.42 pp roster mean
//   the noise floor   (same character, disjoint seed halves)       6.04 pp
//
// The clone is what corrected the floor: the first derivation divided the split-half
// figure by 2 instead of sqrt(2), which would have reported two characters that are
// IDENTICAL BY CONSTRUCTION as 4.6 pp apart. `docs/LESSONS.md` §13, paid for again.
//
// ── FINDING 1: THE ROSTER IS ALREADY WELL SPREAD, AND IT IS NOT CLOSE ───────
//
// Mean pairwise correlation between matchup profiles is **-0.026**: knowing how one
// character does against the roster tells you nothing about how any other does. **0 of 55
// pairs are indistinguishable**, and the closest genuine pair (Donut ~ Lollipop, 11.65 pp)
// sits 5.5x further apart than the measured clone. A roster of eleven copies of one
// character reads 2.58 pp on the same instrument. There are no clones here.
//
// ── FINDING 2: THE SETTLED MATCHUPS ARE KIT-DRIVEN, BUT NOT BY SIMILARITY ───
//
// The uniform roster settles **0 of 110** cells. So a settled matchup is not something the
// arena, the clock or the player/enemy pool asymmetry produces on its own — it needs two
// DIFFERENT characters, which is the case for acting on the roster rather than the map.
//
// But the differences that produce them are concentrated, not distributed: **8 of the 17
// involve Hamburger**, whose halves are 15.0% in the player's hands against 65.6% in the
// AI's — a 50.6 pp role split, twice the next largest in the roster. Six of its eight are
// the same cell shape, "player-Hamburger loses >= 95%". That is one 70 HP glass cannon
// meeting the scripted driver, and making some OTHER character weirder cannot reach it.
//
// ── FINDING 3: DISTINCTIVENESS IS NOT ALIGNED WITH RARITY ───────────────────
//
//   tier        Normal  Rare  Epic  Legendary  Neon  Cyber
//   divergence   23.4   25.8  25.5     27.8    26.8  **23.3**   <- rarest is LOWEST
//   behaviour     1.48   1.12  1.24     1.30    1.20   **1.76**  <- rarest is HIGHEST
//
// The two axes disagree, and neither is monotone in rarity. Cyber's behavioural lead is
// Lollipop alone — 2.35 against Hot Dog's 1.17, which is what averages to the tier's 1.76.
// Hot Dog sits below the roster mean of 1.36, and its nearest behavioural neighbour is
// Sushi at 0.62.
//
// **And Hot Dog is structurally the plainest kit in the game**, which needs no simulation
// at all: `kitSignature` below shows it is the ONLY character whose every weapon is
// `plain` — no pellets, no homing, no peck, no combo, no splatter, no slam, no trail, no
// heal. It shares two of its three weapon signatures with Sushi, which is exactly the pair
// the 3,520-match fingerprint independently names. A static property of this file and a
// behavioural measurement converged on the same character; `sim.test.mjs` §24 pins it.
//
// ── FINDING 4: AND IT CANNOT BE FIXED CHEAPLY, BECAUSE DISTINCTIVENESS AND ──
//              POWER ARE THE SAME LEVER
//
// Eight Hot Dog kits, every one holding `kitDps` at the shipped card value (damage bar 9,
// 29.8–31.0 HP/s), 110 matchups x 32 seeds each, paired:
//
//   candidate          hotdog  tierSPREAD  settled   rosterDiv  rosterBehaviour
//   shipped             51.2%    3.98 pp    17/110     25.42 pp      1.361
//   long-range Mustard  72.2%   12.66 pp    17/110     24.55 pp      1.340
//   …bigger + slower    72.5%   12.81 pp    18/110     24.46 pp      1.345
//   …both guns at max   66.4%   10.08 pp    17/110     24.27 pp      1.341
//   fast gun            33.1%   13.13 pp    18/110     25.36 pp      1.416
//   long-range + hp 4   41.1%   11.25 pp    16/110     24.78 pp      1.347
//   fast gun  + hp 8    75.2%   15.62 pp    21/110     24.56 pp      1.408
//   fast gun  + hp 7    58.0%  **5.86 pp**  18/110     24.83 pp      1.408
//   fast gun, half dose 46.1%    6.64 pp    17/110     25.08 pp      1.378
//
// Three things in that table decided it:
//
//  1. **NOT ONE CANDIDATE RAISES MATCHUP-PROFILE DIVERGENCE.** All eight lower it, and all
//     eight lower Hot Dog's own. Every corner it can be moved to is already occupied —
//     the long-range builds land at engagement distance 70 wu, in the middle of Taco 65,
//     Pizza 66, Burrito 67 and Sushi 69; the fast gun lands at 4.78 damage per press,
//     next to Pizza's 4.68. With eleven characters over six real behavioural axes, the
//     space is full. That is the same conclusion Finding 1 reaches from the other side.
//  2. **THE GUARD MOVES FIRST AND MOVES MOST.** Six of eight leave the tier spread at
//     10–16 pp, outside the ~9 pp aggregate floor — at CONSTANT modelled kit output. The
//     only compensating lever is the card's integer `health` bar, worth 7–12 pp a point
//     (see `HEALTH_PER_STAT`), and for Hot Dog some of its values are not even available:
//     health 5 puts its stat total on 22, which Lollipop and Sushi already hold, dropping
//     the roster to FIVE distinct totals — below the >= 6 `sim.test.mjs` §22(g) requires.
//     So the finest admissible step either side of the shipped 6 is +-1 point = 7-12 pp of
//     one character = 3.5-6 pp of its two-character tier, against a window of about 5 pp.
//     A compensating lever quantised as coarsely as the thing it has to cancel.
//     ⚠️ "7-12 pp" IS STALE and this finding gets STRONGER, not weaker: re-measured on the
//     fixed driver the step is **13.5-27.9 pp** of one character = 6.8-14 pp of its tier
//     (see `HEALTH_PER_STAT`). The Legendary pass above hit exactly this wall independently
//     and refused for the same reason, which is now two elements agreeing.
//  3. **THE ONE CANDIDATE THAT LANDS THE GUARD BUYS ALMOST NOTHING.** `fast gun + hp 7`
//     holds 5.86 pp and raises roster behavioural spread +0.046 against a measured floor
//     of 0.030 — resolvable, and 1.5x its own noise. It pays for that with -0.59 pp of
//     profile divergence, +1 settled matchup, a 47% increase in the guard Uri had just
//     driven to 4.0 pp, and a Hot Dog whose new identity is "presses 37% faster and hits
//     34% softer". That is `DECISIONS §26`'s own definition of a wash ("distinctiveness up
//     and settled up is a wash"), so it is recorded here rather than shipped.
//
// ── ONE CHANGE THAT LOOKED FREE AND IS NOT ──────────────────────────────────
//
// Hot Dog's Ketchup Slip already draws a floor slick in `src/vfx/weapons/hotdog.ts`, so
// `splatter: true` looked like a mechanic the art was already promising. It is not: that
// file explicitly designs the slick as a 0.8 s hard-cornered POLYLINE so it cannot be
// confused with "the hazard puddles that slow fighters", and `splatter` would spawn the
// generic 2.0 m round splat the same comment names as the thing to avoid. Checked in the
// peer's file rather than assumed.
//
// ── WHAT THIS MEANS FOR `DECISIONS §26` ────────────────────────────────────
//
// Rarity cannot be given a distinctiveness job in this roster at a price worth paying.
// The variety is already there — it simply is not where rarity is, and rarity is fixed
// identity (`CharacterDef.face`: "which food, which rarity" is not ours to move).
//
// ✅ RESOLVED 2026-08-06 — Uri took the FLATTEN branch. The paragraph above used to end
// "So §26 resolves on one of its other two branches ... and that call is Uri's", which
// presented this as an open choice. It is not: `LEVEL_UP.rarityCostMultiplier` is 1.0
// across every tier (`68cac7a`), so every character costs an identical 44,770 coins to
// max, and rarity is ACQUISITION RARITY ONLY. Uri: "as far as i understand in all other
// games it means nothing besides the rarity to obtain it."
//
// The measurement above is what made that answer cheap to give, so it is kept in full:
// the distinctiveness branch was tested and REJECTED — eight candidate kits, 0 of 55
// pairs indistinguishable, no balance change shipped. Anyone tempted to revive "make
// rarer kits weirder" should read it first.
//
// **Do not re-derive this.** `node tools/tmp/kit_lab.mjs --seeds 32 --json <out>` is the
// whole measurement and `tools/tmp/stage_kit.mjs` is how a candidate roster is built.

/**
 * The mechanics the weapon model offers beyond damage/cooldown/range, for one weapon.
 *
 * Exported so `sim.test.mjs` §24 asserts the roster's variety against the SAME derivation
 * the record above quotes, rather than against a second copy of it that can drift.
 */
export function weaponMechanics(w: Weapon): string[] {
  const out: string[] = [];
  if (w.pellets !== undefined && w.pellets > 1) out.push('pellets');
  if (w.homing) out.push('homing');
  if (w.peckHits !== undefined) out.push('peck');
  if (w.comboParts !== undefined) out.push('combo');
  if (w.splatter) out.push('splatter');
  if (w.giantSlam) out.push('slam');
  if (w.trailBoosted) out.push('trailBoost');
  if (w.healAmount !== undefined) out.push('heal');
  return out;
}

/** Every mechanic `weaponMechanics` can name. The roster is asserted to use all of them. */
export const WEAPON_MECHANICS = [
  'pellets', 'homing', 'peck', 'combo', 'splatter', 'slam', 'trailBoost', 'heal',
] as const;

/**
 * A character's kit as a set of SHAPES rather than numbers: for each weapon, its type, the
 * named `REACH` rung it sits on, the status it applies, and which mechanics it uses.
 *
 * This is the part of "how distinctive is this character" that a unit test can reach.
 * Damage and cooldown are deliberately excluded — two characters differing only in those
 * are the same character with different numbers, which is exactly what this is for.
 * Sorted, so weapon ORDER is not mistaken for a difference.
 */
export function kitSignature(id: CharacterId): string[] {
  const rungs = Object.keys(REACH) as (keyof typeof REACH)[];
  return CHARACTERS[id].weapons
    .map((w) => {
      const rung = rungs.find((k) => REACH[k] === w.range) ?? 'none';
      const mech = weaponMechanics(w).join('+') || 'plain';
      return `${w.type}:${rung}:${w.effect ?? 'none'}:${mech}`;
    })
    .sort();
}
