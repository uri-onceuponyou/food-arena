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
 *
 * ── 🚨 2026-08-17: SOME LITERALS BELOW ARE NOW READ THROUGH `tune()` ────────
 *
 * `DECISIONS-FOR-URI.md` §76 — Uri: *"All game and character constants should be manageable
 * through admin. Nothing lives in code."* **That sentence collides head-on with the heading
 * of this file**, and §76 constraint 1 resolves the collision in this file's favour:
 *
 *   > *"The panel must not become the second place. `rules.ts` stays authoritative; the panel
 *   > edits an OVERRIDE LAYER that `rules.ts` itself reads, so there is still exactly one
 *   > read path."*
 *
 * So nothing moved. `export const PLAYER_SPEED = 0.12` became
 * `export const PLAYER_SPEED = tune('PLAYER_SPEED', 0.12, {…})` — **the literal is still on
 * its own line, under its own block comment, and it is still the only statement of the
 * default anywhere in the repo.** `src/game/tuning/registry.ts` LEARNS the default by being
 * handed it; there is no table of constants in that directory and there must never be one.
 * A registry that repeated `PLAYER_SPEED: 0.12` would be the second place, with the added
 * cruelty that it would agree on the day it was written.
 *
 * ⚠️ **WITH NO OVERRIDE SET INSTALLED, `tune()` RETURNS ITS SECOND ARGUMENT AND NOTHING
 * ELSE HAPPENS.** That is not a claim, it is measured: `tools/tmp/tun_bitid.mjs` runs the
 * whole 110-matchup corpus in lockstep against a detached worktree of the pre-change commit
 * and requires every match to be bit-identical — **with a positive-control arm under a real
 * override that must DIVERGE**, because a null result on its own is exactly what a layer
 * that silently did nothing would produce.
 *
 * ⚠️ **AND THE COST TO THE TYPE SYSTEM IS REAL AND IS DECLARED**: an `export const` that was
 * a literal type (`150000`) is now `number`. Nothing in the tree narrowed on those literal
 * types — `tsc --noEmit` is the check and it is clean — but a future `as const`-style
 * dependency on one of them will not compile, and that is the trade §76 constraint 1 buys.
 */

import { deriveFns, deriveds, registerCharacterFields, tune } from './tuningRegistry.ts';

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
 *
 * ── 🚨 2026-08-12: 45 s IS REVERSED BY URI. THE CLOCK IS 150 s. ─────────────
 *
 * **Everything above is kept verbatim and none of it is deleted, because the measurements
 * are still true measurements — of a game that answered a different question.** The 45 s
 * sweep optimised ONE quantity: *given that the ring is welded to the clock, how short can
 * the clock be before the fog becomes a co-primary damage source?* Uri's answer removes the
 * premise. The ring is no longer welded to the clock (see `FOG_HOLD_MS` / `FOG_CLOSE_MS`),
 * so "the clock" and "the fog schedule" are two decisions now, not one.
 *
 * ── WHAT MADE HIM CHANGE IT: HE PLAYED IT, AND HE WAS RIGHT ────────────────
 *
 *   > *"It start decreasing my HP before it reaches me… it does seem like sudden death,
 *   > it's also written and the entire screen becomes purple. **It happens before the fog
 *   > reaches the center.**"*
 *
 * That is the defect `minSafeRadiusFor` below had ALREADY written down and nobody had
 * connected to play: at 45 s / 30 s, `SUDDEN_DEATH_MS` deleted the last third of the ring
 * schedule, so the ring never arrived and the collapse read as an unexplained burn. A
 * documented dead branch was a player-visible bug. **`DECISIONS §58` is answered — option
 * (c), lengthen the match — and `DECISIONS §1`'s 45 s is reversed.**
 *
 * ── URI'S SCHEDULE, VERBATIM ───────────────────────────────────────────────
 *
 *     0:00 ────────────────────────────── 2:00 ──── 2:15 ─ 2:30
 *          ring shrinking (centre reached)  small   SUDDEN
 *                                           circle  DEATH
 *
 *   * a **~25 s HOLD** at the opening radius before the ring closes at all — *"a grace
 *     period to find a weapon and an opponent"* on a 2800x2000 map. The old schedule bit
 *     the corners at 6 s, 13% into a 45 s match and 4% into this one.
 *   * the ring reaches `minSafeRadiusFor(N)` — the small final circle — at **120 s**.
 *   * sudden death **15 s after that**, at 135 s. Not before.
 *   * clock ceiling **150 s**.
 *
 * ⚠️ **EVERY BALANCE NUMBER IN THIS PROJECT WAS MEASURED AT 45 s AND IS NOW UNPRICED.**
 * A 3.3x clock is not a constant change. Named, so nobody quotes them as current: the fog's
 * **8.1% damage share**, the **15.5 s** session in `economy/tuning.ts:MATCH_PACING` (and
 * therefore every "hours to unlock" figure derived from it), the **52.2%** difficulty dial,
 * and the whole `roster_table` / `pacing_ladder` corpus. Out-of-combat regen is the one to
 * watch: `REGEN_AMOUNT / REGEN_TICK_MS` is 10 HP/s, so 150 s of disengagement is 1,500 HP
 * against a 100 HP pool where 45 s was 410. Re-measure, do not reason.
 */
export const MATCH_DURATION_MS = tune('MATCH_DURATION_MS', 150_000, { // 2:30 — Uri's ceiling, DECISIONS §58(c)
  group: 'arena', unit: 'ms', min: 30_000, max: 600_000, int: true,
  doc: 'Match clock. Uri moved this 45 s → 150 s by playing (§72), and every balance number in the repo predates it.',
});

/**
 * ── THE RING SCHEDULE, DECOUPLED FROM THE CLOCK (Uri, 2026-08-12) ──────────
 *
 * Until today the ring WAS the clock: `sim.ts` closed it as
 * `maxSafeRadius * (1 - elapsed / MATCH_DURATION_MS)`, so the opening radius, the sweep
 * rate, the arrival time and the whistle were one number wearing four hats. Uri's schedule
 * needs the ring to finish at 120 s while the clock runs to 150 s, so they cannot be the
 * same number any more.
 *
 * Two constants replace the weld, and `fogRadiusAt` below is the only place they are read:
 *
 *     t <= FOG_HOLD_MS                 R = openingRadius        (the grace period)
 *     FOG_HOLD_MS < t < FOG_CLOSE_MS   R linear opening -> floor
 *     t >= FOG_CLOSE_MS                R = floor                (the small final circle)
 *
 * ── WHY A HOLD RATHER THAN A LARGER OPENING RING ───────────────────────────
 *
 * The old trick for "nothing burns for the first t seconds" was to start the ring LARGER
 * THAN THE MAP and let it decay in — `arena/shared.ts` solved
 * `R0 = halfDiagonal / (1 - t/T)` for exactly that. It works, and it couples three things
 * that have no business being coupled: move the clock and the opening radius moves, which
 * moves the sweep rate, which moves first contact. **With an explicit hold the opening
 * radius has exactly one job — contain the playfield at t=0 — and the answer is
 * `ARENA_HALF_DIAGONAL`, no division and nothing to be ill-conditioned.** First contact is
 * then `FOG_HOLD_MS` by construction rather than by arithmetic. `arena/shared.ts` carries
 * the consequence.
 *
 * ── THE ARRIVAL IS THE POINT, AND IT IS ASSERTED, NOT EYEBALLED ────────────
 *
 * `fogRadiusAt` interpolates TO the floor, so the ring reaches `minSafeRadiusFor(N)` at
 * exactly `FOG_CLOSE_MS` **at every N and on every arena size** — which is precisely what
 * the old schedule could not do (it reached the floor at a time that depended on the
 * opening radius, and `SUDDEN_DEATH_MS` arrived 9.6-11.8 s before that time at every N).
 * `sim.test.mjs` §29 and §11 assert the arrival on the live sim; `tools/tmp/fs_sched_ring.mjs`
 * asserts it on real matches at N=2..6 and carries the OLD constants as its known-bad.
 */
export const FOG_HOLD_MS = tune('FOG_HOLD_MS', 25_000, {
  group: 'arena', unit: 'ms', min: 0, max: 120_000, int: true,
  doc: 'The ring does not move at all before this. Uri: "a grace period to find a weapon and an opponent".',
});
export const FOG_CLOSE_MS = tune('FOG_CLOSE_MS', 120_000, {
  group: 'arena', unit: 'ms', min: 5_000, max: 600_000, int: true,
  doc: 'When the ring ARRIVES at minSafeRadiusFor(N). SUDDEN_DEATH_MS is derived from this, so they cannot drift apart again.',
});

/**
 * ── AUTHORISED DEVIATION #8 (2026-08-05): COUNTDOWN_FROM 5 -> 3 ─────────────
 *
 * `COUNTDOWN_FROM * 1000 + COUNTDOWN_START_FLASH_MS` is the ONLY block of a match in
 * which the simulation is, by construction, incapable of doing anything: `stepMatch`
 * gates `applyAim`, `attemptAttack`, `moveFighter` (named `movePlayer` until 2026-08-10),
 * `stepAI` and `applyWorldTick` on
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
export const FOG_TICK_MS = tune('FOG_TICK_MS', 300, {
  group: 'arena', unit: 'ms', min: 50, max: 5_000, int: true,
  doc: 'How often a fighter outside the ring is burned. With FOG_DAMAGE this is a RATE, and a rate against a pool is scale-invariant — the clock change could not mistune it.',
});
export const FOG_DAMAGE = tune('FOG_DAMAGE', 15, {
  group: 'arena', unit: 'hp', min: 0, max: 200,
  doc: 'HP per fog tick. Tune the PAIR, not this alone — FOG_DPS below is the quantity that matters and it is derived from both.',
});

/**
 * The fog's damage RATE, in HP per second — the same 15/300 the two constants above
 * state, expressed once so nobody writes `15 / 300` again.
 *
 * It exists because `ai.ts` needs it: a fighter that opens a `castMs` cast during sudden
 * death is rooted for the whole of it while the fog burns at this rate over the WHOLE
 * arena (`SUDDEN_DEATH_RADIUS` is 0), so "will this cast kill me before it resolves" is
 * `hp <= castMs * FOG_DPS / 1000`. Writing that arithmetic in `ai.ts` would be a second
 * statement of the fog — the one defect shape this codebase has recorded most often —
 * so the rate is stated HERE, beside the two numbers it is derived from.
 *
 * ⚠️ It is DERIVED, not authored. Moving `FOG_DAMAGE` or `FOG_TICK_MS` moves this, which
 * is the point; do not replace it with a literal — and since 2026-08-17 the registry
 * ENFORCES that: `deriveds()` puts it in the `DerivedKey` union, so an override naming it
 * is a compile error as well as a runtime refusal. §76 constraint 2.
 */
const FOG_DERIVED = deriveds({
  FOG_DPS: {
    group: 'arena', unit: 'hp/s', inputs: { FOG_DAMAGE, FOG_TICK_MS },
    formula: '(FOG_DAMAGE / FOG_TICK_MS) * 1000',
    doc: 'Fog burn rate. 50 HP/s today: a 100 HP pool survives 2.0 s outside the ring, a 150 HP pool 3.0 s.',
    f: (i) => (i.FOG_DAMAGE / i.FOG_TICK_MS) * 1000,
  },
});
/** See `DerivedScheduleKey`. Same rule, second block. */
export type DerivedFogKey = keyof typeof FOG_DERIVED;
export const FOG_DPS = FOG_DERIVED.FOG_DPS;

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
 *
 * ── 🚨 2026-08-11: THIS IS NO LONGER "THE" FLOOR. IT IS THE FLOOR AT N <= 4 ──
 *
 * **The value is unchanged and the reasoning above is unchanged.** What moved is its
 * SCOPE. Everything above describes it as the floor, full stop, as though a match had two
 * seats forever — and the sentence *"a 45 wu-wide safe annulus around the pot"* is true at
 * every fighter count, which is precisely the defect `DECISIONS §53b` names: six fighters
 * finished the match standing on a one-body-wide ring, already inside each other's range.
 *
 * `minSafeRadiusFor(n)` below is what `sim.ts` reads now. It returns **exactly this
 * constant for n <= 4** — so the duel and the four-player match are bit-identical to the
 * shipped game — and a larger, derived radius at 5 and 6. This constant keeps its own job:
 * it is the POT term of that maximum, the radius below which "safe ground" does not exist
 * at any fighter count. Nothing here is reversed; a second term was added beside it.
 */
export const MIN_SAFE_RADIUS = tune('MIN_SAFE_RADIUS', 140, {
  group: 'arena', unit: 'wu', min: 0, max: 1_000,
  doc: 'The POT term of the ring floor — the radius below which safe ground does not exist at any fighter count. Binds at N ≤ 4, where the SPACING term binds at N ≥ 5.',
  simClamp: { lo: 0, where: 'rules.ts:minSafeRadiusFor' },
});

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

export const PLAYER_MAX_HP = tune('PLAYER_MAX_HP', 100, {
  group: 'combat', unit: 'hp', min: 10, max: 1000, int: true,
  doc: 'The player pool every fighter above two seats is built from. Character cards scale it by healthMultiplier.',
});

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
 *
 * ── 🚨 2026-08-11: THE VALUE IS UNCHANGED; ITS SCOPE IS NOT (DECISIONS §49c) ──
 *
 * **AUTHORISED DEVIATION #9 IS NOT REVERSED. 90 STAYS, AND THE CURVE ABOVE STAYS TRUE.**
 * What moved is what this constant *is*. Everything above describes it as **the difficulty
 * dial** (`DECISIONS §12`, `§15`) — full stop, as though the game had one enemy forever.
 * Uri, answering the "which dial does seat 2 and up get" question:
 *
 *   > *"AI player is currently only for testing the game. Later on when real PvP occurs
 *   > each player has it stats based on the level if their brawler"*
 *
 * The AI opponent is a **test harness, not a design target**. So this is the difficulty
 * dial **FOR A BOT OPPONENT** — a TESTING constant — and it means something in exactly two
 * places:
 *
 *   1. today's **single-player duel**, where slot 1 is a bot and turning this is still how
 *      the game gets easier or harder. `sim.ts:createMatchFromList` gates it on
 *      `configs.length === MIN_FIGHTERS` and nothing else;
 *   2. the **measuring instruments** — `roster_lab`, `kit_lab`, `match-sim`,
 *      `pacing_ladder`, `roster_table`, `level_lab`, `burger_lab`, `selfheal_probe`,
 *      `e2e_timeout_finder` — which encode the 100/90 split as the world because a 1v1
 *      matchup grid IS their world. **They may keep it. Nothing that SHIPS may.**
 *
 * Above two fighters **no slot gets a different pool because of its index**: every fighter
 * is built from `PLAYER_MAX_HP` and separated only by `Fighter.level` and its character's
 * card. ⛔ "Keep the seat dial" is retired permanently — do not re-offer it.
 *
 * ⚠️ Read this before quoting the curve: every number in it was measured in a **1v1 against
 * a bot**, which is now the only configuration this constant describes. It is not a
 * free-for-all balance figure and there is no instrument in this repo that produces one.
 */
export const ENEMY_MAX_HP = tune('ENEMY_MAX_HP', 90, {
  group: 'combat', unit: 'hp', min: 10, max: 1000, int: true,
  doc: 'The BOT-opponent pool in a 1v1 only (§49c flattened it above two seats). The difficulty dial: 140 → 56.3%, 130 → 62.3% player win under smart2.',
});
export const PLAYER_SIZE = 42;
export const ENEMY_SIZE = 42;

/**
 * Base movement: px per ms.
 *
 * ── ✅ LANDED 2026-08-21. `0.12 -> 0.09`, AND THE BOTS CAME WITH IT AT THE SAME RATE. ──
 *
 * The block below is kept ENTIRE, in the present tense it was written in, because it is
 * the record of what was measured, what was refused, and — in its last paragraph — the
 * one question that was blocking it. **Uri answered that question:**
 *
 *   > *"75 - drop the bots as well. same rate."*
 *
 * So all three movement constants were multiplied by **0.75** and every ratio between them
 * is preserved: `PLAYER_SPEED / AI_CHASE_SPEED` stays 1.714…x and `AI_FLEE_SPEED /
 * AI_CHASE_SPEED` stays 1.214…x. The paragraph below that says *"Do not land either one
 * from a brief. Let him move the sliders"* was RIGHT and is now SPENT: he moved them.
 *
 * ⚠️ **THE RATIOS ARE PRESERVED TO 1e-12, NOT TO THE BIT, AND THAT IS ARITHMETIC RATHER
 * THAN SLOPPINESS.** `0.07 * 0.75` is `0.052500000000000005`, so the authored value is the
 * clean decimal `0.0525` — which is what a tuning panel must show — and `0.12/0.07` and
 * `0.09/0.0525` differ in the last ulp (1.714285714285714 vs 1.7142857142857142).
 * `sim.test.mjs` §38 asserts the ratios with a relative tolerance and says why.
 *
 * ⚠️ **AND THE CONSEQUENCE THE BLOCK BELOW PREDICTED IS REAL AND WAS PAID:**
 * `waterbottle.Mega.castMs` is DERIVED from the slowest human's speed (`sim.test.mjs`
 * §33(o) asserts the derivation, it is not a taste call), so 1100 -> **1400** followed
 * automatically. It is a wind-up getting LONGER, i.e. MORE dodgeable, which is the
 * direction `DECISIONS §80` asks for — and it is a nerf to the roster's weakest character,
 * which is reported rather than compensated (`§77`). The five rows this block warned about
 * were REVERSED with their old wording kept, exactly as it said they would have to be.
 *
 * ── 🔴 THE ORIGINAL ENTRY, UNCHANGED BELOW THIS LINE ────────────────────────
 *
 * ── 🔴 `DECISIONS §75(b)` IS ANSWERED (0.12 -> 0.09) AND DELIBERATELY **NOT LANDED HERE** ──
 *
 * Uri answered; this constant did not move, and the reason is recorded so nobody lands it
 * as a one-line edit. **Implemented, measured, reverted:** at 0.09 the derived cast window
 * moves with it — `escapeBoundaryMs` 795 -> **1060.61 ms**, so `waterbottle.Mega`'s
 * geometry-derived `castMs` becomes **1400**, and at 1400 an AI **can** clear
 * `REACH.meleeHeavy` from separation 0 (**98.00 wu of travel against 84 needed**). Five
 * `sim.test.mjs` rows encode the opposite and would have to be REVERSED, not retuned.
 *
 * 🚨 **AND IT SURFACED A QUESTION THAT IS URI'S, NOT A TUNING DETAIL: `AI_CHASE_SPEED` IS
 * A SEPARATE CONSTANT AND DID NOT MOVE.** Dropping only the player takes the gap from
 * **1.71x to 1.29x** — bots close on you more easily and flee more effectively. *"All
 * characters are moving too fast"* plausibly means both should move; the option he was
 * shown was priced in terms of the PLAYER closing weapon range, so it does not settle it.
 * **Answer that first**; changing one without the other is a balance change wearing a
 * feel change's clothes.
 *
 * The measurement below stands and is why the answer is 0.09 when it lands:
 *
 * ⚠️ **`0.12` — "Prototype: `0.12 * dt * speedMult`" — kept because the prototype value
 * is the reason it was never questioned.** Uri played and reported *"all characters are
 * moving too fast"*. Measured against the reach table rather than argued:
 *
 *   at 120 wu/s   close `rangedMax` 140 wu in **1.17 s** · `rangedMid` 116 in 0.97 s
 *                 cross your own 42 wu body in **0.35 s** · cross the 2800 wu map in 23.3 s
 *   at  90 wu/s   `rangedMax` **1.56 s** · `rangedMid` 1.29 s · map 31.1 s
 *
 * **A ranged weapon whose maximum reach is closed in 1.17 s is not a ranged weapon**, and
 * 0.35 s per body length is the twitchiness the report is about.
 *
 * 🚨 **THIS IS AFFORDABLE ONLY BECAUSE OF `§72`.** Map crossing 23.3 s -> 31.1 s is 20.7% of
 * the 150 s clock; on the 45 s clock it would have been **69%**, and `DECISIONS §1` already
 * recorded that **13.0 s of a 19.6 s match was spent walking to contact**. The two changes
 * are one decision made twice — do not move this constant without re-reading the clock.
 *
 * ── 🔴 THIS IS THE FIELD THE ADMIN PANEL EXISTS FOR (§76 / §75(b)) ─────────
 *
 * The answer above (0.09) is parked because **nobody knows whether `AI_CHASE_SPEED` should
 * move with it**, and that is a question only Uri can answer and only by FEEL. The panel is
 * how he answers it: both constants are registered, side by side, in the same group, so the
 * **ratio** is the thing being tuned rather than either number. Dropping only the player
 * takes the gap 1.71x → 1.29x; dropping both together holds it at 1.71x. **Do not land
 * either one from a brief. Let him move the sliders.**
 */
export const PLAYER_SPEED = tune('PLAYER_SPEED', 0.09, {
  group: 'combat', unit: 'wu/ms', min: 0.01, max: 0.5,
  doc: 'Player base movement. §75(b) LANDED 2026-08-21: 0.12 -> 0.09 with AI_CHASE_SPEED and AI_FLEE_SPEED scaled by the same 0.75, so every ratio is preserved ("drop the bots as well, same rate").',
});
/** AI chase / flee speeds. Prototype: `0.07 * dt` and `0.085 * dt`, both x0.75 since §75(b). */
export const AI_CHASE_SPEED = tune('AI_CHASE_SPEED', 0.0525, {
  group: 'combat', unit: 'wu/ms', min: 0.01, max: 0.5,
  doc: 'Bot chase speed. PLAYER_SPEED / this is 1.71x and §75(b) held it there on purpose. Move only this and the game gets harder, move only the player and it gets harder too.',
});
export const AI_FLEE_SPEED = tune('AI_FLEE_SPEED', 0.06375, {
  group: 'combat', unit: 'wu/ms', min: 0.01, max: 0.5,
  doc: 'Bot flee speed — deliberately ABOVE the chase speed (1.21x), so disengaging is faster than closing.',
});
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
export const SLOW_DURATION_MS = tune('SLOW_DURATION_MS', 2500, {
  group: 'combat', unit: 'ms', min: 0, max: 20_000, int: true,
  doc: 'How long a slow lasts before diminishing returns scale it. Cutting it is CHEAP (−0.9 pp at 900 ms) and barely helps — the binding constraint is the application rate.',
});
export const SLOW_MOVE_MULTIPLIER = tune('SLOW_MOVE_MULTIPLIER', 0.45, {
  group: 'combat', unit: 'x', min: 0, max: 1,
  doc: 'Movement multiplier while slowed. 0 would make a slow into a stun, and 1 would delete the effect.',
});
export const STUN_DURATION_MS = tune('STUN_DURATION_MS', 2000, { // stunned = movement locked to 0
  group: 'combat', unit: 'ms', min: 0, max: 20_000, int: true,
  doc: 'Movement locked to zero for this long. EXPENSIVE to cut: −10.6 pp of player win rate at 1000 ms. The re-application rule below is the cheaper lever.',
});

/**
 * ── 2026-08-19: TWO ABILITY CARDS PROMISED "a few seconds" OF THIS. THE CARDS MOVED. ──
 *
 * `hamburger.Lettuce` and `burrito.Roll` both read *"for a few seconds"*. This constant
 * is **2000 ms and it is GLOBAL to all 11 characters**, so both cards were false, and
 * `tools/tmp/wm_gate.mjs` scored them WRONG-VALUE against a 3000 ms reading of *"a few"*.
 *
 * 🔴 **THE NUMBER WAS THE WRONG THING TO MOVE, IN BOTH AVAILABLE DIRECTIONS.**
 *
 *  1. **Raising it to 3000 to make the cards true is the reverse of Uri's own answer.**
 *     `DECISIONS §80` (2026-08-18) names *"reduce the stun time"* as one of three levers
 *     for making a super dodgeable, and `§80`'s arithmetic is that `STUN_DURATION_MS`
 *     2000 already **exceeds an 1100 ms wind-up**, so one application covers an entire
 *     cast. 3000 would widen the gap the lever exists to close.
 *  2. **And DEVIATION #5 immediately below caps the longest unbroken movement lock at
 *     exactly this constant, by construction.** The census in the comment above measured
 *     a **6.0 s mean engagement**. 2000 ms is 33% of one; 3000 ms would be 50%. The
 *     defect DEVIATION #5 was built to fix is the one a longer stun re-opens.
 *  3. Lowering the gate's 3000 ms threshold instead would have turned both cards green in
 *     one character, with nothing in the game changing. That is the goalpost move
 *     `CLAUDE.md` rule 6 exists to refuse.
 *
 * → **Both blurbs now say "for a moment"**, which is TRUE at 2000 ms and stays true if
 *   `§80`'s lever 3 shortens it. The gate's `stun-brief` term (< 3000 ms) asserts it, and
 *   `stun-few-seconds` (>= 3000 ms) is kept beside it as the catcher: the two are exact
 *   complements, so a stun card cannot be made true by DELETING its duration clause.
 *   **Raise this constant past 3000 and BOTH cards go red the same minute.** DECISIONS §81.
 */

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
export const STUN_GRACE_MS = tune('STUN_GRACE_MS', 500, {
  group: 'combat', unit: 'ms', min: 0, max: 10_000, int: true,
  doc: 'Immunity window after a stun expires. ANY positive value buys the bound, and the size only sets how big the usable gap is. 500 ms = 2.38 evade windows.',
});
export const SLOW_GRACE_MS = tune('SLOW_GRACE_MS', 500, {
  group: 'combat', unit: 'ms', min: 0, max: 10_000, int: true,
  doc: 'Immunity window after a slow expires. Flat rather than a ratio of the duration — 500/625 measured indistinguishable, and one number is one sentence.',
});

/**
 * DIMINISHING RETURNS — `DECISIONS §75(a)`, and the grace above was NOT enough.
 *
 * ⚠️ **The block above says the grace "bounds the longest unbroken movement lock to exactly
 * `STUN_DURATION_MS`". That is TRUE and it was the wrong bound.** It bounds one *unbroken*
 * application; it says nothing about the *duty cycle* of a chain. Uri played and reported
 * being held in place — measured, `duration / (ceil((duration + grace) / cooldown) * cooldown)`:
 *
 *     Noodle  cd 1000  slow  **83.3%**      Cheese  cd 1300  stun  **76.9%**
 *     Tomato  cd  800  slow    78.1%        Roll    cd 1400  stun    71.4%
 *     Glass   cd 1100  stun    60.6%
 *
 * 🚨 **THREE FACTS THAT RULE OUT THE OBVIOUS FIXES, AND THE FIRST IS THE IMPORTANT ONE:**
 *
 * 1. **The duty cycle is a SAWTOOTH in cooldown, so a LONGER cooldown can be WORSE.** Cheese
 *    at 1300 ms locks **76.9%** while Glass at 1100 ms locks **60.6%** — 2x1300 lands just
 *    past the 2500 ms cycle, 3x1100 overshoots it by 800. **"Lengthen the cooldowns" could
 *    have worsened the exact complaint**, and no gate here would have shown it.
 * 2. **`Noodle`'s 1000 ms cooldown divides the 3000 ms cycle EXACTLY**, re-applying on the
 *    frame the guard opens, indefinitely. That is a RESONANCE, not a tuning miss — and it is
 *    why raising the grace only moves which cooldowns resonate.
 * 3. **`statusReadyAt` is PER-EFFECT**, so slow and stun immunity are independent timers and
 *    a character carrying one of each runs BOTH locks at once.
 *
 * So the scale is applied to the DURATION, which no cooldown can divide its way around:
 * each application inside `STATUS_DR_WINDOW_MS` of the previous one is shorter than the last,
 * and the fourth is refused outright. Being chain-targeted still hurts and always ends.
 *
 * ⚠️ **The window is measured from the last APPLIED status, not from the last hit** — a
 * refused application must not extend the punishment, or immunity becomes self-sustaining
 * and the fighter is permanently immune (which is the same defect wearing the other sign).
 */
/**
 * ⚠️ **NOT REGISTERED AS A TUNABLE, AND THE REASON IS A TYPE.** `combat.ts:drNextStacks`
 * clamps to `STATUS_DR_SCALES.length - 1` and `state.ts`'s `*Stacks` fields INDEX this array,
 * so its LENGTH is a schema, not a number: a panel that let Uri add or drop a rung would move
 * a bound that four files read and two of them store. The individual scales could be
 * registered without that risk — the length is what is load-bearing — but a half-tunable
 * array whose length is frozen and whose contents are not is exactly the surface §76
 * constraint 4 is about, so it is left whole and named here rather than left silent.
 */
export const STATUS_DR_SCALES = [1, 0.5, 0.25, 0] as const;
export const STATUS_DR_WINDOW_MS = tune('STATUS_DR_WINDOW_MS', 8_000, {
  group: 'combat', unit: 'ms', min: 0, max: 60_000, int: true,
  doc: 'Applications within this of the last APPLIED status are scaled down by STATUS_DR_SCALES. Measured from the last applied, never the last hit — the other way round makes immunity self-sustaining.',
});

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
 * for *anyone*, and both are implemented ONCE — in `sim.ts:moveFighter` (named
 * `movePlayer` until 2026-08-10), which is the
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
 * `sim.ts:moveFighter`'s own `terrainSlowFactor()` being shared with `ai.ts` through
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

/**
 * Homing projectile steering. Prototype: `turnAmount = min(1, 0.006 * dt)`.
 *
 * ── ⚠️ IT IS AN ANGULAR RATE, SO THE TURNING RADIUS SCALES WITH SPEED ───────
 *
 * `sim.ts:stepProjectiles` lerps the DIRECTION vector by `min(1, rate * dt)` and then
 * renormalises it to `w.speed`. Nothing in that expression mentions speed, so the turn
 * costs the same milliseconds however fast the projectile is going — which means a faster
 * homing shot sweeps a WIDER arc getting onto its target.
 *
 * => **RAISING A HOMING WEAPON'S `speed` BUYS LONG RANGE AND CAN SPEND CLOSE RANGE**, and
 * the cost scales with `spreadDeg`, because a fan is exactly a set of pellets that begin
 * off-axis and have to turn back. Measured on a STATIONARY target, where a hole cannot be
 * a lost race (`tools/tmp/hm_audit.mjs --minrange`, selftest 12):
 *
 *   weapon                fan   at the shipped speed        at SPEED.max (280 wu/s)
 *   sushi/Big Catch       40°   100% at every separation    100% at every separation
 *   burrito/Topping Swarm 55°   100% at every separation    50% at 30-60 wu and 130-140
 *   egg/Hatch!             0°   100% at every separation    100% (nothing to turn)
 *
 * That is why `0558bc5` was safe on Sushi and why **the same rung is NOT transferable to
 * Burrito on the strength of it**: at `SPEED.max` Topping Swarm loses half its delivery
 * inside 60 wu, and `roster_lab` reads the buff as a **-11.9 pp** hit to Burrito's strength
 * (asAI 40.0% -> 20.0%). A weapon buff that makes the character weaker is the shape this
 * constant produces, and no instrument here looked for it before 2026-08-11.
 */
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

/**
 * `REACH.rangedMax`, HOISTED OUT OF THE OBJECT LITERAL so `ultimateSlam` can be derived
 * from it. An object literal cannot reference its own sibling, and the alternative —
 * retyping 140 inside the slam's expression — is the exact thing `CLAUDE.md` forbids
 * (*"Derive from `shared.ts`. Never retype a coordinate"*, and the reach ladder is a
 * coordinate system). This const and `REACH.rangedMax` are one value with one name.
 */
const RANGED_MAX = 140;

/**
 * ── THE DISC EVERY SUPPORTED ASPECT RATIO IS GUARANTEED TO SHOW AROUND YOU. 199.22 wu. ──
 *
 * 🚨 **THIS IS A SECOND STATEMENT OF `render/camera.ts:FAIR_PLAY.radiusUnits`, AND THAT IS
 * THIS PROJECT'S MOST EXPENSIVE DEFECT SHAPE — SO IT IS ASSERTED, NOT TRUSTED.** It exists
 * here because `REACH.ultimateSlam` below is now DERIVED from it (Uri, §81/§80: *"the giant
 * should catch almost everything in the visible screen, but it shouldn't catch everything
 * in the map"*) and `rules.ts` is the frozen design layer — it may not import from `render/`,
 * which imports IT. `sim.test.mjs` §37 source-scans `render/camera.ts` for the three terms,
 * and `tools/tmp/bb_slam.mjs --agree` imports BOTH modules and requires the two numbers to
 * be equal to the bit. The right end state is `camera.ts` importing this constant; that is a
 * one-line hunk in a file this pass does not own, and it is routed rather than taken.
 *
 * ── WHY `PLAYER_SPEED` APPEARS AND THEN CANCELS ─────────────────────────────
 *
 * `camera.ts` builds the reaction term as `MAX_CLOSING_SPEED * EVADE_WINDOW_MS` =
 * `(PLAYER_SPEED * TRAIL.speedBoost) * (HIT_RADIUS_VS_PLAYER / PLAYER_SPEED)`. `PLAYER_SPEED`
 * cancels ALGEBRAICALLY — the term is just `TRAIL.speedBoost * HIT_RADIUS_VS_PLAYER` — and
 * writing the short form would be tidier and WRONG. Measured: the two forms are bit-equal at
 * `PLAYER_SPEED` 0.12 and differ by **7.105e-15** at 0.09, so a global speed change would
 * silently split this constant from the camera's in the last ulp and the equality gate would
 * go red on a float artefact rather than on a real disagreement. The expression is therefore
 * written in the camera's own shape, cancelling term included.
 *
 * ⚠️ **AND THAT CANCELLATION IS ITSELF A DESIGN FACT WORTH KNOWING: THE CAMERA DOES NOT MOVE
 * WHEN THE GAME GETS SLOWER.** A slower fighter needs proportionally longer to cross its own
 * hit radius, so the reaction distance it must be shown is unchanged.
 */
export const GUARANTEED_VISIBLE_RADIUS =
  RANGED_MAX + HIT_RADIUS_VS_PLAYER
  + (PLAYER_SPEED * TRAIL.speedBoost) * (HIT_RADIUS_VS_PLAYER / PLAYER_SPEED);

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
  rangedMax: RANGED_MAX,

  /**
   * Lollipop's Giant Lollipop, and nothing else. DELIBERATELY NOT ON THE LADDER: it
   * is anchored to the ARENA, not to the weapon ladder, because its whole design is
   * "the biggest area in the game".
   *
   * ⚠️ WAS: *"anchored to the ARENA (1400x1000 wu, fog closing to r=545) ... because its
   * whole design is 'hits the whole map'"*. **BOTH halves went stale.** The arena is
   * **2800x2000** since `6631446` (`src/arena/shared.ts` is the only source of truth for
   * that), and the live fog opening is `arena/shared.ts:MAX_SAFE_RADIUS`, derived from
   * `ARENA_HALF_DIAGONAL`; `rules.ts:MAX_SAFE_RADIUS = 545` is a dead historical constant
   * with no consumer, as its own doc comment says. And *"hits the whole map"* was a quote
   * of an ability blurb that was **false** — 400 wu is 14% of the map's width — and that
   * blurb was corrected on 2026-08-19. A comment quoting a card is a second source of
   * truth for the card; it is kept in the past tense here for that reason. It is excluded from
   * the fair-play radius in `render/camera.ts` — covering it would demand a 918 wu
   * radius — so its warning has to be the screen-filling slam VISUAL rather than
   * sight of the caster.
   *
   * => CONSTRAINT ON THE VFX OWNER, and it got HEAVIER with this retune: the slam
   * now reaches 2.0x the guaranteed-visible radius, where it used to reach 1.25x.
   * The caster is off screen far more often, so the tell has to carry more weight.
   *
   * ── 🚨 REVERSED 2026-08-21 BY URI. 400 -> 157.22, AND IT IS NO LONGER AUTHORED. ──
   *
   * Everything above this line described a 400 wu constant *"anchored to the ARENA, not to
   * the weapon ladder"*. **It is now anchored to the CAMERA**, and the paragraphs are kept
   * because the reasoning they record is exactly what Uri overruled:
   *
   *   > *"If the question is whether the giant should catch everything in the visible
   *   > screen, the answer is almost, but it shouldn't catch everything in the map."*
   *
   * `GUARANTEED_VISIBLE_RADIUS` (199.22 wu) is *"the disc every supported aspect ratio is
   * guaranteed to show around you"*, so *"everything in the visible screen"* is that number
   * and *"almost"* is a margin off it.
   *
   * **THE MARGIN IS ONE BODY LENGTH, AND THAT IS THE LADDER'S OWN UNIT.** `BODY_LENGTH`
   * opens this block — *"Every reach below is a multiple of this"* — and every rung is
   * quoted in bl (58 = 1.38 bl … 140 = 3.33 bl). So the slam is `3.74 bl`, and the margin
   * is the width of the fighter you are looking at: at the edge of the slam you can see a
   * whole body's clearance between yourself and the guaranteed frame. That is what makes
   * *"almost"* legible rather than notional — a catch at the exact frame boundary is
   * indistinguishable from one that reached off screen, which is the failure the margin
   * exists to prevent.
   *
   * ⚠️ **WHAT WAS REJECTED, so nobody re-opens it as a new idea.**
   *   * **A percentage (0.95 x 199.22 = 189.26).** A tuned number wearing a derivation;
   *     nothing else in this design is 5% of anything.
   *   * **Minus `HIT_RADIUS_VS_PLAYER` (174.02).** A category error — the hit radius is a
   *     PROJECTILE's tolerance and a melee swing has no hit-radius term at all
   *     (`combat.ts:deliverWeapon` compares centre-to-centre against `range`). It also
   *     lands 0.8 wu the WRONG side of the standoff bound below, so it buys nothing.
   *   * **Rounding to an integer.** The ladder's rungs are authored integers; this one is
   *     derived, and rounding it would re-introduce exactly the literal the derivation
   *     exists to remove.
   *
   * ── ⚠️ THE EXEMPTIONS ARE **NOT** DELETED, AND ONE OF THEM STRUCTURALLY CANNOT BE ──
   *
   * 1. **`render/camera.ts:MAX_WEAPON_RANGE` skips `giantSlam`, and that skip is now
   *    LOAD-BEARING RATHER THAN A CONCESSION.** Deriving the slam FROM the guaranteed
   *    radius while the guaranteed radius is computed FROM the longest weapon range is a
   *    fixed-point equation: including it gives `R = 0.79 R + 59.22`, i.e. R = 282 and a
   *    slam of 240, and every further iteration pushes the camera further back. The skip
   *    is what makes this derivation well defined. **It must stay.**
   * 2. **`ENDGAME_STANDOFF` still excludes it — but its stated cost is now STALE.** That
   *    block says covering the slam *"would demand a 500 wu final ring"*; that was the
   *    price of covering 400. At 157.22 the standoff would be `157.22 + 26 = 183.22`,
   *    which sits INSIDE `GUARANTEED_VISIBLE_RADIUS` — so the design rule it protects
   *    (*"every neighbour is out of reach and still on screen"*) would survive, and the
   *    exemption is deletable for the first time. **It is deliberately NOT deleted here:**
   *    166 -> 183.22 moves `minSafeRadiusFor(N)`, and N=4 clears its floor by **0.17 wu**
   *    (that razor is stated in the block below), so the duel and the four-player match
   *    would stop being bit-identical and the ring would move at N=4/5/6. That is Uri's
   *    §53b ring, not this pass's constant. **Parked for him, priced in the report.**
   */
  ultimateSlam: GUARANTEED_VISIBLE_RADIUS - BODY_LENGTH,
} as const;

// ─────────────────────────────────────────────────────────────────────────────
// THE ENDGAME RING SCALES WITH FIGHTER COUNT — DECISIONS §53b
// ─────────────────────────────────────────────────────────────────────────────
//
// Uri, 2026-08-11, answering §53b: *"Scale the radius with player count"*.
//
// ── THE DEFECT, AND WHY A BIGGER ARENA DOES NOT FIX IT ──────────────────────
//
// `MIN_SAFE_RADIUS` was 140 wu and CONSTANT, while `POT.dangerRadius` burns out to 95 and
// the pot's solid box (`POT.bodyRadius * 2`, registered by `arena/hazards.ts`) blocks a
// fighter's CENTRE inside 73. So the ground that costs 0 HP/s at the end of every match
// was an annulus **45 wu wide — 1.07 body widths — at every fighter count and at every
// arena size.** ⚠️ `MAX_SAFE_RADIUS` never enters that expression, so doubling the map
// changes nothing about it. That is why §53b is answered here and not inside §48.
//
// ── WHERE A FIGHTER ACTUALLY STANDS, AND WHY THE CHORD IS MEASURED THERE ────
//
// The safe annulus runs from the pot's burn ring (`POT.dangerRadius`) out to the fog
// (`safeRadius`). BOTH edges cost HP. The one circle inside it adjacent to neither is
//
//     rStand = (POT.dangerRadius + safeRadius) / 2
//
// so that is where the endgame is fought and that is where spacing has to be measured.
// N fighters spread evenly on it stand one chord apart:
//
//     chord = 2 * rStand * sin(pi/N) = (POT.dangerRadius + safeRadius) * sin(pi/N)
//
// The 2 and the /2 cancel — which is why the POT radius appears in the answer at all. A
// derivation that "simplifies" it away is not tidier, it is a different (and wrong) rule:
// it re-creates the annulus by pricing the ring as though the middle of it were standable.
// ⚠️ And this is the CONSERVATIVE circle: N points on the OUTER edge of the annulus are
// strictly further apart, so any real placement only gains room over this bound.
//
// ── THE BAND: THE TOP OF THE LADDER, PLUS THE HIT RADIUS ────────────────────
//
// The rule is that **no fighter is inside any weapon's reach of a neighbour while
// standing still**, so closing to a fight is a decision rather than the starting state.
//
// That is `ENDGAME_STANDOFF` below, and each half of it is forced:
//
//   * `REACH.rangedMax` (140) is the ladder's ceiling — the longest reach any weapon has,
//     ultimates aside. Any shorter rung leaves live weapons on the ring: at
//     `REACH.meleeHeavy` (84) every one of the four ranged rungs still reaches.
//   * `+ max(HIT_RADIUS_VS_PLAYER, HIT_RADIUS_VS_ENEMY)` because a projectile's usable
//     reach is `range + the TARGET's hit radius`: `sim.ts:stepProjectiles` expires it at
//     `traveled >= w.range` and connects it inside `target.hitRadius`. `render/camera.ts`
//     computes the same quantity as `MAX_THREAT_REACH` and calls it "the attacker's usable
//     reach". The MAX over the two constants rather than the player's alone is deliberate:
//     `Fighter.hitRadius` is per-fighter (25.2 for every seat of a 3-6 brawl, 26 for the
//     bot in a duel), the bound must hold for the larger, and taking the max makes this
//     independent of `DECISIONS §49c`'s seat dial — which has already changed once.
//
// 🚨 AND THE MAX EARNS ITS 0.8 wu FOR A SECOND, MEASURED REASON: **the exact boundary is
// not a miss, it is a coin flip in the last ulp.** `traveled` is a running SUM of per-tick
// step lengths, so 874 additions of 0.16 reach 139.99999999999773 rather than 140, the
// expiry does not fire, and the hit test runs once more at 25.99999999999 against a 26 wu
// radius. The distance is computed on ABSOLUTE coordinates, so the same shot at the same
// separation resolves differently depending on where on the map it is taken — measured, it
// lands in a 3000 wu arena and misses in a 4000 wu one. `sim.test.mjs` §29(d) runs that
// sweep and asserts the INDETERMINACY rather than a direction. Taking the max puts the
// binding chord (166.00) 0.8 wu clear of a brawl's real 165.2 wu reach — ~5e15 ulps —
// instead of exactly on it. The 0.8 is spent out of N=4's headroom and leaves 0.17 wu
// there, which is enough: no seat count moves for it.
//
// ⚠️ `REACH.ultimateSlam` (400) is EXCLUDED, exactly as `render/camera.ts` excludes it from
// `FAIR_PLAY.radiusUnits` and for the same reason: it is an 8 s map-scale ultimate whose
// tell is the screen-filling slam. Covering it would demand a 500 wu final ring.
//
// ── AND THE UPPER BOUND THIS LANDS INSIDE, WHICH IS THE PART THAT MAKES IT A DESIGN ──
//
// `FAIR_PLAY.radiusUnits` = `REACH.rangedMax + HIT_RADIUS_VS_PLAYER + 34.0` = **199.2 wu**
// is the disc every supported aspect ratio is guaranteed to show around you. 166 sits
// inside it. So the final ring is exactly: **every neighbour is out of reach and still on
// screen** — you can see the fighter you cannot yet hit. A longer band would push the
// fighter who is about to shoot you off camera, which is the failure the whole `REACH`
// retune exists to remove.
//
// ── WHAT IT PRODUCES ───────────────────────────────────────────────────────
//
//     N   floor    binds     rStand   chord      vs the shipped 140
//     2   140.00   pot       117.50   235.00     unchanged
//     3   140.00   pot       117.50   203.52     unchanged
//     4   140.00   pot       117.50   166.17     unchanged  <-- 0.17 wu of margin
//     5   187.42   spacing   141.21   166.00     +47.42
//     6   237.00   spacing   166.00   166.00     +97.00
//
// The threshold sits between 4 and 5, which is exactly what §53b's own table says: N=4's
// 166 wu chord is *"outside every reach — fine"*, N=5's 138 is inside `rangedMax` and
// N=6's 117 is inside `rangedLong`. The derivation reproduces that verdict rather than
// being fitted to it — the two floors were derived independently and N=4 fell out.
//
// ⚠️ **N=4 CLEARS BY 0.17 wu AND THAT RAZOR IS STATED, NOT SMOOTHED.** It is the reason
// the duel and the four-player match stay bit-identical. A one-unit move in
// `POT.dangerRadius`, in `PLAYER_SIZE` (via `HIT_RADIUS_VS_PLAYER`) or in
// `REACH.rangedMax` takes N=4 off 140, so `sim.test.mjs` §29(b) PRINTS the per-N margin
// instead of only asserting the sign — the day it flips should be visible in the run that
// flips it, not in the balance table three passes later.
//
// ── THE FOG SCHEDULE IS DERIVED FROM THIS. NEVER PIN IT. ───────────────────
//
// ⚠️ **THE COUPLING BELOW WAS REVERSED ON 2026-08-12 AND THE OLD WORDING IS KEPT BECAUSE
// ITS ARITHMETIC IS THE REASON THE SCHEDULE HAD TO BE DECOUPLED.** It used to read:
//
//   > `sim.ts` closes the ring as `max(minSafeRadiusFor(N), maxSafeRadius * (1 - progress))`,
//   > so the floor decides the moment the ring STOPS:
//   >
//   >     tFloor = MATCH_DURATION_MS * (1 - floor / arena.maxSafeRadius)
//   >
//   > Both terms are read at run time; neither is a literal. §48 measured the endgame window
//   > at N=2 as **6.4 s on the shipped map and 3.2 s on the x4 map** — this formula gives
//   > 6.34 s and 3.17 s, which is what says the schedule model here is the shipped one. At
//   > N=6 it gives **10.74 s** and **5.37 s**: scaling the floor with N gives back part of
//   > what the bigger arena costs, which was one of §48's two named scale-only defects.
//
// **Every one of those numbers is a symptom of the same defect: the ARENA SIZE was deciding
// when the endgame started.** A x4 map halved the endgame window (6.34 -> 3.17 s) without
// anyone choosing that, and the floor scaling with N was giving part of it back by
// accident. `fogRadiusAt` makes the arrival a SCHEDULE constant: `tFloor` is `FOG_CLOSE_MS`
// at every N and every arena size, and the endgame window is `SUDDEN_DEATH_GRACE_MS`.
// The floor still decides WHERE the ring stops; it no longer decides WHEN.
// ⚠️ Pinning a literal here is a MEASURED failure mode, not a hypothetical — the 1x
// literal 993 carried onto a 2x map put both spawns OUTSIDE the opening ring: 880/880 no
// contact, every match over in 2.03 s.
//
// ── THE SEATED COUNT, NOT THE LIVING ONE ───────────────────────────────────
//
// `sim.ts` passes `state.fighters.length`, which never changes for the life of a match.
// Reading the LIVING count would make the ring GROW as fighters die — a fog that recedes,
// un-lethalling ground someone is already burning on, and breaking the monotonicity that
// `audio/director.ts`'s one-shot floor latch and `ui/hud.ts`'s `msUntilEdge` inversion are
// both built on. A closing ring is a SCHEDULE, and a schedule is known at the whistle.
// ─────────────────────────────────────────────────────────────────────────────

/**
 * The separation at which one fighter standing still cannot be touched by another
 * standing still: the longest weapon `range` in the game plus the largest hit radius a
 * target can carry. **166 wu.** Derived, never authored — see the block above for why
 * each half is forced and why `REACH.ultimateSlam` is excluded.
 */
export const ENDGAME_STANDOFF = REACH.rangedMax + Math.max(HIT_RADIUS_VS_PLAYER, HIT_RADIUS_VS_ENEMY);

/**
 * The floor on the closing ring for a match of `fighterCount` fighters — the radius the
 * fog stops at, and the only thing `sim.ts` clamps `safeRadius` with.
 *
 * `max` of two independently derived terms, each binding in its own regime:
 *
 *   * `MIN_SAFE_RADIUS` — the POT term. Safe ground must exist at all. Binds at N <= 4.
 *   * `ENDGAME_STANDOFF / sin(pi/N) - POT.dangerRadius` — the SPACING term, the smallest
 *     radius whose mid-annulus chord reaches `ENDGAME_STANDOFF`. Binds at N >= 5.
 *
 * It returns the SMALLEST radius satisfying both, deliberately: a larger ring would also
 * satisfy the spacing rule and would spend endgame seconds buying room nobody asked for.
 * The genre convention at the top of `MIN_SAFE_RADIUS` still holds — a final circle is
 * small, not empty — it just is not the same "small" for two fighters and for six.
 */
export function minSafeRadiusFor(fighterCount: number): number {
  // ⚠️ THIS COMMENT USED TO READ — and it was TRUE, and it was the bug Uri hit:
  //
  //   > *"AT THE SHIPPED CONSTANTS THIS FUNCTION'S RESULT IS NEVER REACHED — see
  //   > `SUDDEN_DEATH_MS` below, which collapses the ring 9.6-11.8 s before the schedule
  //   > would arrive here."*
  //
  // 🚨 **REVERSED 2026-08-12.** `fogRadiusAt` interpolates TO this value and lands on it at
  // `FOG_CLOSE_MS` (120 s), and sudden death is 15 s LATER (135 s). The ring now arrives —
  // at every N, on every arena size — and stands on this radius for a full 15 s of play
  // before the collapse. That a documented dead branch was a player-visible defect is the
  // whole reason this pass exists; see `MATCH_DURATION_MS`.
  const n = Math.floor(fighterCount);
  // ⚠️ Below three there is no "evenly spaced neighbour" to be spaced FROM: at two the
  // chord is the diameter, and at one it does not exist — `Math.sin(Math.PI / 1)` is
  // 1.22e-16 rather than 0, so an unguarded formula would return 1.4e18 instead of
  // throwing, and a degenerate one-fighter state would silently get an infinite safe zone.
  //
  // The guard is not hiding a discontinuity: at n = 2 the spacing term is 166 - 95 = 71 wu,
  // far below the floor, so both paths give `MIN_SAFE_RADIUS` and `sim.test.mjs` §29(a)
  // asserts they agree. It also means the SHIPPED DUEL evaluates no `Math.sin` at all —
  // one comparison and a constant return — which is what keeps `--bitid` at N=2 free of
  // any question about libm reproducibility, and keeps the hot path's cost unchanged.
  if (!Number.isFinite(n) || n < 3) return MIN_SAFE_RADIUS;
  return Math.max(MIN_SAFE_RADIUS, ENDGAME_STANDOFF / Math.sin(Math.PI / n) - POT.dangerRadius);
}

/**
 * The opening radius of the closing ring, for a playfield whose furthest point is
 * `halfDiagonal` from its centre. **It is the half-diagonal**, and the identity is named
 * rather than inlined because it is a RULE, not an accident: *the ring at t=0 contains
 * every point a fighter can stand on, and nothing more.*
 *
 * ⚠️ **IT USED TO BE A DIVISION, AND THAT DIVISION IS WHY THE NUMBER MOVED FOUR TIMES.**
 * `arena/shared.ts` solved `halfDiagonal / (1 - FOG_FIRST_CONTACT_S * 1000 / T)` to place
 * first contact at 6 s by starting the ring OUTSIDE the map — 890, then 993 when the clock
 * went 180 s -> 45 s, then 1985 when the arena went x4. With `FOG_HOLD_MS` doing that job
 * explicitly the division is redundant, and the redundant part was the part that coupled
 * the opening radius to the clock.
 *
 * ⚠️ **DO NOT ROUND IT DOWN.** `Math.round(1720.465…)` is 1720, which puts the four corners
 * 0.47 wu OUTSIDE the ring at t=0 — a miniature of the exact "corners fogged from birth"
 * bug `arena/shared.ts` documents. No fighter can reach one (`movement.ts` clamps to half a
 * body inside each bound, so the furthest reachable point on the shipped map is 1691.28 wu
 * from centre, 29.19 wu of margin), but the FLOOR and the props out there are drawn, and a
 * corner that is inside the fog wall cannot be judged for hue or value.
 */
export function fogOpeningRadiusFor(halfDiagonal: number): number {
  return halfDiagonal;
}

/**
 * **THE RING SCHEDULE. The one implementation, and the reason it is a function.**
 *
 * @param playMs   milliseconds of PLAY elapsed — `MATCH_DURATION_MS - state.timeRemaining`.
 *                 NOT `state.elapsed`, which includes the countdown; keying the ring off
 *                 `elapsed` would move it whenever `COUNTDOWN_FROM` moved and re-seed every
 *                 balance number in the project. Same property `SUDDEN_DEATH_MS` has.
 * @param openingRadius `arena.maxSafeRadius`.
 * @param floorRadius   `minSafeRadiusFor(state.fighters.length)` — the SEATED count.
 *
 * Hold, then close, then hold at the floor. Reaches `floorRadius` **exactly** at
 * `FOG_CLOSE_MS`, which is the assertion `sim.test.mjs` §29 makes and the property the old
 * schedule did not have.
 *
 * ── ⚠️ THE MONOTONICITY TRAP, WHICH THIS SHAPE MAKES WORSE, NOT BETTER ─────
 *
 * The old expression was `max(floor, opening * (1 - progress))`, and `sim.ts` already
 * warned that a RISING floor (`minSafeRadiusFor` rises with N, so reading the LIVING count
 * would raise it as fighters die) makes `safeRadius` rise — a fog that recedes, which
 * breaks `audio/director.ts`'s one-shot floor latch and `ui/hud.ts`'s `msUntilEdge`
 * inversion. **Here the floor is INTERPOLATED TOWARD, not clamped with, so a floor that
 * rises mid-match lifts the radius at every t in the close, not only at the end.** The
 * defence is unchanged and is the caller's: pass the SEATED count, which is fixed for the
 * life of a match. `sim.test.mjs` §29(d) is the row that fails if anyone changes it.
 *
 * Monotone non-increasing requires `openingRadius >= floorRadius`. On any real arena that
 * is 1720.47 against at most 237.00, but a fixture can violate it (`sim.test.mjs` uses
 * `maxSafeRadius: 100_000` and `500` both), so the interpolation is clamped rather than
 * trusted: an opening radius BELOW the floor yields the floor from t=0 and never rises.
 */
export function fogRadiusAt(playMs: number, openingRadius: number, floorRadius: number): number {
  const open = Math.max(openingRadius, floorRadius);
  if (!(playMs > FOG_HOLD_MS)) return open; // `!(… > …)` so NaN holds rather than closing
  if (playMs >= FOG_CLOSE_MS) return floorRadius;
  const closed = (playMs - FOG_HOLD_MS) / (FOG_CLOSE_MS - FOG_HOLD_MS);
  return open + (floorRadius - open) * closed;
}

/**
 * The inverse of `fogRadiusAt`: the play-clock reading at which the ring's edge arrives at
 * `radius`. **Exported because two files outside the sim invert this schedule by hand and
 * both were written against the old linear-in-the-clock one:**
 *
 *   * `ui/hud.ts` computes `shrinkPerMs = maxSafeRadius / MATCH_DURATION_MS` twice
 *     (`imminentMs`, `zoneInfo.msUntilEdge`). On this schedule that is wrong in two
 *     directions at once — it reports a countdown DURING the hold, when the edge is not
 *     moving at all, and once the close starts it understates the sweep by 45%
 *     (11.47 wu/s against the real 16.64).
 *   * `game/match.ts:applyQaSetup` solves `timeRemaining = MATCH_DURATION_MS * (R / maxR)`
 *     for `?fogRadius=`.
 *
 * Neither file is this pass's to edit; the correct one-line replacement is
 * `MATCH_DURATION_MS - fogReachesRadiusAt(R, maxR, floor)` for the clock reading, and
 * `fogReachesRadiusAt(dist, …) - playMs` for "ms until the edge reaches me".
 *
 * Returns `FOG_HOLD_MS` for any radius at or above the opening ring (the edge is already
 * there and starts moving then) and `FOG_CLOSE_MS` for anything at or below the floor (the
 * ring never goes lower — a caller wanting "and then?" wants `SUDDEN_DEATH_MS`).
 */
export function fogReachesRadiusAt(radius: number, openingRadius: number, floorRadius: number): number {
  const open = Math.max(openingRadius, floorRadius);
  if (radius >= open) return FOG_HOLD_MS;
  if (radius <= floorRadius) return FOG_CLOSE_MS;
  const closed = (open - radius) / (open - floorRadius);
  return FOG_HOLD_MS + closed * (FOG_CLOSE_MS - FOG_HOLD_MS);
}

// ─────────────────────────────────────────────────────────────────────────────
// SUDDEN DEATH — DECISIONS §2, answered by Uri 2026-08-11
// ─────────────────────────────────────────────────────────────────────────────
//
//   > *"no. after 30 seconds reduce the fog to all screen and the one who has more HP
//   > wins. (Sudden Death)"*
//
// The "no." answers the question §2 actually asked — *is a draw preferable to "ties go
// to the human"?* — and replaces the whole question: there is no tie to break, because
// the fog resolves the match before the whistle can.
//
// ── THE STEP, AND WHY IT IS NOT A FAST SWEEP ────────────────────────────────
//
// Two readings of *"reduce the fog to all screen"* were available and they are NOT
// equivalent. A ramp — sweep the ring from wherever it is down to zero over a few
// seconds — is the gentler one, and it is WRONG, because of Uri's SECOND clause. Under a
// ramp the fighter nearer the centre is engulfed LAST, so the match is decided by
// POSITION and only tie-broken by HP. Under a step every fighter is outside at the same
// instant, burning at the same flat 50 HP/s, so time-to-death is a strictly increasing
// function of HP alone. **The step is the only reading under which "the one who has more
// HP wins" is a true sentence**, so the step is what ships.
//
// Note this also makes the resolution ABSOLUTE HP, not the HP FRACTION `resolveTimeout`
// rung 1 uses. That is a deliberate, stated change of rule and it is Uri's words: a flat
// drain against unequal pools is exactly "who has more HP", and the fraction argument
// (*"the bigger pool did nothing to earn a head start"*) does not survive an answer that
// names the raw quantity.
//
// ── WHERE 30 s SITS IN THE FOG SCHEDULE — MEASURED, AND IT CONTRADICTS §53b ──
//
// 🚨 **THIS WHOLE TABLE IS THE BUG URI PLAYED INTO. KEPT VERBATIM BELOW, BECAUSE IT IS THE
// RECORD OF A DEFECT THAT WAS WRITTEN DOWN, ARGUED FOR, AND SHIPPED.** It was reported
// rather than resolved, on the reasoning quoted at the end of it — and the thing that
// reasoning missed is that a player does not experience "the spacing floor is superseded".
// He experiences *"it start decreasing my HP before it reaches me."* The lever named in the
// last paragraph as the one that would fix it — **the TRIGGER, not the floor** — is exactly
// the lever Uri pulled. What follows is the old block, unedited:
//
//   > `arena/shared.ts` derives `maxSafeRadius = halfDiagonal / (1 - 6000/T)` = **1985 wu**
//   > on the 2800x2000 map (`DECISIONS §48`). `sim.ts` closes the ring linearly, so at the
//   > 30 s trigger the scheduled radius is
//   >
//   >     R(30 s) = 1985 * (1 - 30/45) = 661.67 wu
//   >
//   > while `minSafeRadiusFor` returns 140 (N<=4), 187.42 (N=5), 237.00 (N=6). So:
//   >
//   >     N     floor    tFloor     endgame window   SD fires BEFORE tFloor by   R(30)/floor
//   >     2-4   140.00   41.826 s   3.174 s          11.826 s                    4.73x
//   >     5     187.42   40.751 s   4.249 s          10.751 s                    3.53x
//   >     6     237.00   39.627 s   5.373 s           9.627 s                    2.79x
//   >
//   > 🚨 **THE RING NEVER REACHES `minSafeRadiusFor(N)` IN A SHIPPED MATCH.** §53b's floor
//   > — answered by Uri in the same message, and derived from the reach ladder in the block
//   > above — governs a radius the schedule is cut off 9.6-11.8 s short of. To reach it
//   > first, the trigger would have to be >= 41.83 s (N<=4) or >= 39.63 s (N=6), i.e. sudden
//   > death would fire inside the last 3.2-5.4 s. **That is not what was asked for.**
//   >
//   > ⚠️ **This is REPORTED, not resolved by substituting a different number.** Uri gave
//   > 30 s; the assumption under which it ships is stated here: *the endgame spacing rule is
//   > what the ring is FOR while it is closing, and sudden death is the deliberate abolition
//   > of safe ground — so the spacing floor is superseded rather than violated.* If the two
//   > are ever wanted to coexist, the lever is the TRIGGER, not the floor.
//
// ── WHAT THE SAME TABLE READS NOW (2026-08-12) ─────────────────────────────
//
// The opening radius is `ARENA_HALF_DIAGONAL` = 1720.47 wu and the ring reaches its floor
// at `FOG_CLOSE_MS` at EVERY N, because `fogRadiusAt` interpolates to the floor instead of
// decaying past it:
//
//     N     floor    tFloor     SD fires AFTER tFloor by   R at the trigger
//     2-4   140.00   120.000 s  15.000 s                   140.00
//     5     187.42   120.000 s  15.000 s                   187.42
//     6     237.00   120.000 s  15.000 s                   237.00
//
// **The endgame window is now the 15 s the fighters spend STANDING ON the final circle**,
// not the sliver of schedule between the floor and the whistle — which is what makes §53b's
// spacing derivation govern something for the first time. The two rules no longer conflict;
// they compose. Nothing here is pinned: every column is `FOG_CLOSE_MS`,
// `SUDDEN_DEATH_GRACE_MS`, `POT` and the `REACH` ladder read at run time.
//
// ── WHY THE CLOCK STILL HAS TO BE 15 s LONGER THAN THIS ─────────────────────
//
// (Header was *"WHY THE 45 s CLOCK…"*. The clock is 150 s since 2026-08-12; the inequality
// below is unchanged because both terms moved together — see `SUDDEN_DEATH_MS`.)
//
// The sudden-death window has to be long enough to actually kill the biggest pool in the
// game, or the collapse would resolve nothing and the whistle would decide after all:
//
//     worst pool anywhere   maxHpFor('pizza', PLAYER_MAX_HP, LEVEL_MAX) = 238 HP
//     fog burn-down         ceil(238 / FOG_DAMAGE) = 16 ticks * FOG_TICK_MS = 4 800 ms
//     window                MATCH_DURATION_MS - SUDDEN_DEATH_MS          = 15 000 ms
//     headroom                                                            10 200 ms
//
// `sim.test.mjs` §30 asserts that inequality from the constants rather than from 4800,
// so raising a health card, the level cap or `SUDDEN_DEATH_MS` cannot quietly put the
// timeout back in reach.
// ─────────────────────────────────────────────────────────────────────────────

/**
 * How long after the ring ARRIVES the collapse is. **Uri's number, 2026-08-12: fifteen
 * seconds** — *"sudden death starts 15 s after that"*, "that" being the small final circle.
 *
 * It is a GRACE PERIOD MEASURED FROM THE RING, and that is the whole point of naming it:
 * the rule is *"the players get 15 s on the final circle"*, and a rule stated as a
 * subtraction between two absolute times is a rule nobody can move safely.
 */
export const SUDDEN_DEATH_GRACE_MS = tune('SUDDEN_DEATH_GRACE_MS', 15_000, {
  group: 'arena', unit: 'ms', min: 0, max: 120_000, int: true,
  doc: 'How long the players get to stand on the final circle before the collapse. Uri\'s number, verbatim: "sudden death starts 15 s after that".',
});

/**
 * How far into a match sudden death begins. **135 s = `FOG_CLOSE_MS + SUDDEN_DEATH_GRACE_MS`.**
 *
 * ⚠️ **IT USED TO BE A LITERAL `30_000` — "Uri's number, verbatim: 30 seconds" — AND THAT
 * IS THE DEFECT, NOT THE VALUE.** A literal cannot express *"after the ring closes"*, so
 * when the ring's schedule moved the trigger did not move with it and sudden death overtook
 * the ring by 9.6-11.8 s. See the block above for what that felt like to play.
 *
 * ⚠️ **AND `MATCH_DURATION_MS - SUDDEN_DEATH_MS` WOULD BE THE WRONG DERIVATION TODAY EVEN
 * THOUGH IT GIVES THE RIGHT NUMBER.** At 150 s / 135 s the sudden-death window is exactly
 * 15 000 ms, the same value as the grace period, so both derivations agree — by arithmetic
 * accident, on two quantities that mean different things ("how long the collapse gets to
 * kill" vs "how long the final circle lasts"). Deriving from the CLOCK would silently move
 * the collapse the next time anyone lengthens the match. Deriving from `FOG_CLOSE_MS` keeps
 * the sentence Uri actually said. `sim.test.mjs` §30 asserts the coincidence is a
 * coincidence, so it cannot be mistaken for a definition later.
 *
 * Measured in PLAY time — the clock `MATCH_DURATION_MS` counts down — not in `elapsed`,
 * which includes the countdown. `state.timeRemaining` is the only quantity the sim has
 * that starts at a known value and is unaffected by `COUNTDOWN_FROM`, which is exactly
 * the property `driver_guard.mjs` exists to protect: a sudden death keyed off `elapsed`
 * would move with the countdown and re-seed every balance number in the project.
 *
 * ── 🚨 REGISTERED WITH `deriveds()`, WHICH IS WHAT MAKES IT UNTYPEABLE ─────
 *
 * §76 constraint 2, verbatim: *"a panel that let you type `SUDDEN_DEATH_MS` would un-fix the
 * exact bug he found by playing."* So this is not a text box that the panel merely renders
 * read-only — `keys.ts` intersects `OverrideSet` with `{ [K in DerivedKey]?: never }`, so
 * `{ SUDDEN_DEATH_MS: 5 }` is a **COMPILE ERROR**, and `validate.ts` refuses it again at run
 * time because JSON arriving from localStorage has no types. The recompute below is the
 * formula's only copy: the panel previews it by calling it, and knows no arithmetic of its own.
 */
const SCHEDULE_DERIVED = deriveds({
  SUDDEN_DEATH_MS: {
    group: 'arena', unit: 'ms', inputs: { FOG_CLOSE_MS, SUDDEN_DEATH_GRACE_MS },
    formula: 'FOG_CLOSE_MS + SUDDEN_DEATH_GRACE_MS',
    doc: 'When the ring is abolished. Derived BECAUSE a literal 30_000 let the collapse overtake the ring by 9.6–11.8 s — the bug Uri found by playing.',
    f: (i) => i.FOG_CLOSE_MS + i.SUDDEN_DEATH_GRACE_MS,
  },
});

export const SUDDEN_DEATH_MS = SCHEDULE_DERIVED.SUDDEN_DEATH_MS;

/**
 * The clock reading at which sudden death starts — **15 000 ms**, derived, never typed.
 * `state.timeRemaining <= this` is the predicate, and it is the one `suddenDeathActive`
 * implements so the comparison exists once.
 *
 * ⚠️ Numerically unchanged by the 2026-08-12 reschedule (45/30 and 150/135 both leave
 * 15 000 ms), so `suddenDeathActive`'s FORM did not have to change. That invariance is a
 * convenience and not a law — see `SUDDEN_DEATH_MS` for why the two 15 s figures are
 * different quantities that happen to agree.
 *
 * ⚠️ **WAS `MATCH_DURATION_MS - SUDDEN_DEATH_MS` WRITTEN HERE**; it is the same expression,
 * registered rather than merely evaluated. Kept identical to the token.
 *
 * ⚠️ **THE TWO-DEEP LINK, AND IT IS LOAD-BEARING FOR AN INSTRUMENT.** This reads
 * `SUDDEN_DEATH_MS`, which reads `FOG_CLOSE_MS` — so a candidate on `FOG_CLOSE_MS` reaches
 * this value only through a WALK. `tuningRegistry.ts:previewDerived` used to substitute DIRECT
 * inputs only and returned a silently stale number here; it now recurses, and
 * `tools/tmp/tun_gate.mjs` uses **this exact chain** as its fixture with the old direct-only
 * body kept as the known-bad mutant.
 *
 * ⚠️ It is a SECOND `deriveds()` call rather than a second key in the block above, and that is
 * forced: the declaration passes each input as the IDENTIFIER holding it, so `SUDDEN_DEATH_MS`
 * has to be a `const` before it can be named — which it is, one statement up. Two calls, one
 * union, no value stated twice.
 */
const SCHEDULE_DERIVED_2 = deriveds({
  SUDDEN_DEATH_REMAINING_MS: {
    group: 'arena', unit: 'ms', inputs: { MATCH_DURATION_MS, SUDDEN_DEATH_MS },
    formula: 'MATCH_DURATION_MS - SUDDEN_DEATH_MS',
    doc: 'The clock reading at which sudden death starts. Derived, never typed — see above for why the coincidence with the grace is a coincidence.',
    f: (i) => i.MATCH_DURATION_MS - i.SUDDEN_DEATH_MS,
  },
});

/**
 * The derived-key union for the schedule — **`keyof typeof`, never a hand-written list.**
 * `tuning/keys.ts` folds it into `DerivedKey`, which `OverrideSet` refuses. Adding a key to
 * either block extends the refusal automatically; that is the entire reason the block form
 * exists rather than bare `derive()` calls.
 */
export type DerivedScheduleKey = keyof typeof SCHEDULE_DERIVED | keyof typeof SCHEDULE_DERIVED_2;

export const SUDDEN_DEATH_REMAINING_MS = SCHEDULE_DERIVED_2.SUDDEN_DEATH_REMAINING_MS;

/**
 * The safe radius during sudden death: **zero. There is no safe ground.**
 *
 * Named rather than written as `0` at the two sites that need it, because "the ring is
 * at its floor" and "the ring has been abolished" are different statements that would
 * otherwise both read as a bare literal.
 *
 * ⚠️ At exactly 0 the only point costing 0 HP/s is the arena centre itself, and
 * `sim.ts`'s fog test is `dist > safeRadius` — a strict inequality. On the shipped
 * kitchen that point is unreachable anyway (`arena/hazards.ts` registers the pot as a
 * solid `bodyRadius * 2` box, so `movement.ts:tryMove` keeps every fighter's CENTRE at
 * least `POT.bodyRadius + PLAYER_SIZE / 2` = 73 wu out), but the sim does not depend on
 * that: `sim.test.mjs` §30 asserts that every living fighter takes fog damage within one
 * `FOG_TICK_MS` of the collapse, on a real match, rather than assuming the geometry.
 */
export const SUDDEN_DEATH_RADIUS = 0;

/**
 * Has sudden death begun? **Takes `MatchState.timeRemaining`, not `elapsed`.**
 *
 * A predicate rather than an inlined comparison because it has five readers across four
 * files — `sim.ts` (the ring and the fog pass), `ui/hud.ts` (the zone readout's `holds`),
 * `audio/director.ts` (the floor latch) and `game/match.ts` (the QA fog override) — and a
 * rule stated once and implemented differently elsewhere is the single defect shape this
 * codebase has recorded most often (five AI driver bugs, all of it).
 *
 * `phase` is deliberately NOT consulted: `timeRemaining` is `MATCH_DURATION_MS` for the
 * whole countdown and is never rewound, so this is false until the match is genuinely
 * 30 s old and stays true afterwards. Callers that care about the phase already have it.
 */
export function suddenDeathActive(timeRemaining: number): boolean {
  return timeRemaining <= SUDDEN_DEATH_REMAINING_MS;
}

/**
 * The lowest radius the closing ring can be at, **at this instant of this match** —
 * `SUDDEN_DEATH_RADIUS` once sudden death has begun, `minSafeRadiusFor(n)` before it.
 *
 * This is what every READER of the ring's floor wants, and until 2026-08-11 all three of
 * them compared against the bare `MIN_SAFE_RADIUS` constant: `audio/director.ts`'s
 * one-shot "the ring has stopped" latch, `ui/hud.ts`'s `holds` ("the edge will never
 * reach you"), and `game/match.ts`'s QA clamp. Each was a no-op at N<=4 and WRONG above
 * it — and each becomes wrong again, at every N, the moment the ring can collapse: a HUD
 * that says *"the edge will never reach you"* to a fighter standing 100 wu from the
 * centre while the fog burns them at 50 HP/s is the exact class of defect `DECISIONS §13`
 * names (a screen showing a number the model does not compute).
 *
 * ⚠️ It is a FLOOR, not the radius. `sim.ts` does not clamp with it during sudden death —
 * `max(0, 661.67)` is 661.67, which is the ring the collapse exists to abolish. Sudden
 * death is a CAP that dominates the floor, and the one place that arithmetic lives is
 * `sim.ts`'s ternary. See there.
 */
export function ringFloorFor(fighterCount: number, timeRemaining: number): number {
  return suddenDeathActive(timeRemaining) ? SUDDEN_DEATH_RADIUS : minSafeRadiusFor(fighterCount);
}

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
 *
 * ⚠️ **THIS STILL FLOORS ON `MIN_SAFE_RADIUS`, NOT ON `minSafeRadiusFor(MAX_FIGHTERS)`,
 * AND THAT IS A CHOICE.** `state.ts` imports this file, so `MAX_FIGHTERS` cannot be read
 * here without a cycle — and coupling them would MOVE the keepout silently rather than
 * surface a conflict, which is the wrong failure mode for a competitive-fairness rule.
 * The relationship is asserted instead: on the shipped kitchen the keepout is 248.25
 * against a **237 wu six-fighter ring** (11.25 wu of margin) and on the x4 map 496.25, so
 * no concealment can sit inside the final ring at any seat count today.
 * `sim.test.mjs` §29(e) is that row, and it is the one that fails first if
 * `ENDGAME_STANDOFF` is ever derived upward.
 *
 * ── 🚨 2026-08-12: THE FORMULA IS UNCHANGED AND ITS RATIONALE IS NOW HISTORICAL ──
 *
 * The sentence *"derived from the same formula `sim.ts` closes the ring with, evaluated at
 * `CONCEAL_ENDGAME_PROGRESS`"* stopped being true when the ring stopped being linear in the
 * clock (`FOG_HOLD_MS`). **The expression was deliberately NOT re-derived, and the three
 * candidates were priced rather than argued:**
 *
 *     anchor                                                   shipped x4 map   1x map
 *     `maxSafeRadius * (1 - 0.75)`            (kept, as-is)         430.12       215.06
 *     `fogRadiusAt(0.75 * MATCH_DURATION_MS)` (honest re-derive)    264.87       196.81
 *     `fogRadiusAt(0.75 of the CLOSE)`        (re-anchored)         535.12       320.06
 *
 * The honest re-derivation **LOOSENS a competitive-fairness bound by 165 wu** for no
 * benefit — nothing is asking to put concealment nearer the middle — and the re-anchored
 * one **TIGHTENS it past r=500, where `kitchen.ts` says all 20 shipped patches sit**, i.e.
 * it could make the shipped arena illegal. Keeping the expression keeps the most
 * conservative of the three and changes no arena. **What it costs is that this is now a
 * BOUND, not a derivation**, and the doc says so instead of implying a schedule it no
 * longer matches.
 *
 * ⚠️ The VALUE still moved, because `maxSafeRadius` did: **496.25 -> 430.12** on the shipped
 * map. That is a loosening and it cannot invalidate an existing patch (all sit past r=500).
 * ⚠️ AND THE 1x SIX-SEAT GUARANTEE IS GONE: 215.06 against a 237.00 six-fighter ring. Not
 * live — `DECISIONS §53a` is *"6 players only on the x4 map"* — and `sim.test.mjs` §29(e)
 * now asserts each map size against the seat count it actually ships, plus a known-bad row
 * that states the lost guarantee out loud rather than letting it disappear into a weaker
 * assertion.
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

// ── ⚠️ A RUNG OF THIS LADDER IS ALSO A REACH TAX, AND THAT HALF WAS NEVER WRITTEN ──
//
// Everything above is about DODGEABILITY and is right. It is half the consequence. Reduce
// the geometry of a shot chasing a target that is running away and the range CANCELS:
//
//     reach = range x (1 - S/v) + hitRadius     and    v = range / flight
//           = range - S x flight + hitRadius
//
// The penalty is `S x flight` AND NOTHING ELSE. It does not depend on how far the weapon
// reaches — only on how long the shot is in the air. So a rung of this table is a reach
// tax in world units, identical for every weapon on it, and the same number that makes a
// shot fair to dodge is the number that decides how much ground a runner steals from it.
//
// Against the roster's fastest human (120 wu/s) the tax by rung is:
//
//     fast   350ms ->  42 wu      slow   875ms -> 105 wu
//     normal 500ms ->  60 wu      drift 1750ms -> 210 wu   <-- more than REACH.rangedMax
//
// Measured, not just derived: `tools/tmp/hm_audit.mjs --ladder` prints the closed form for
// all 23 ranged weapons and `--selftest` pins it against the real sim on the one weapon
// with no fan to explain away (58 wu measured, 58.2 predicted). **23 of 23 ranged weapons
// cannot connect at their own press gate against a fleeing human** — `ai.ts:pickWeapon`
// gates on `adist > w.range`, so `range` is simultaneously the separation a fighter
// BELIEVES the weapon works at and the path budget it actually gets, and the two coincide
// only when the target is standing still. Every one of `press_value.mjs`'s 183 validated
// cells is a stationary target.
//
// That is a fact about the whole ladder and it is recorded, not fixed: it is bounded and
// symmetric everywhere except `drift`. See `SPEED.maxDrift` for the one weapon it breaks
// outright, and `docs/DECISIONS-FOR-URI.md` §50 for the sim-level alternative and its price.
export const FLIGHT_MS = {
  /** 1.67 evade windows. Sprays and quick lobs. Reach tax vs a fleeing human: 42 wu. */
  fast: 350,
  /** 2.38 evade windows. The workhorse. Reach tax vs a fleeing human: 60 wu. */
  normal: 500,
  /** 4.2 evade windows. Big, readable, telegraphed shots. Reach tax: 105 wu. */
  slow: 875,
  /**
   * 8.3 evade windows. 🚨 **AN ORPHAN RUNG — NOTHING MAY SIT HERE. DO NOT AUTHOR A WEAPON
   * ONTO IT.**
   *
   * ⚠️ THE OLD WORDING, KEPT ABOVE ITS REVERSAL AS THIS FILE'S HOUSE RULE REQUIRES:
   *
   * > *"8.3 evade windows. Egg's Hatch! — a chick that waddles at you."*
   * > *"**THE WADDLE IS THE INTENT AND IT IS ALSO THE DEFECT.** The tax at this rung is
   * > **210 wu against a fleeing human**, which is more than `REACH.rangedMax` (140) — so a
   * > weapon on this rung has NEGATIVE reach at every range on the ladder. It is not that
   * > `Hatch!` is slow; it is that at 80 wu/s the chick is slower than **every fighter in
   * > the game** (105.6-120 wu/s in the human role, 61.6-70 in the AI's), so there is no
   * > separation at which it catches anyone who is walking away."*
   *
   * **THE WADDLE IS OVERRULED. `DECISIONS §50a` — Uri: *"chick is faster than the egg."***
   * That reads as flavour and is a derivable constraint: a projectile slower than its own
   * owner cannot catch anything in either role, so the weapon is not weak, it is INERT.
   * `Hatch!` moved to `SPEED.maxSlow` and this rung now carries no weapon.
   *
   * It is kept rather than deleted because the arithmetic above is the whole derivation of
   * why, and because deleting the rung would delete the warning with it. The guard that
   * actually stops a weapon landing here is not this comment: `sim.test.mjs` §31(g) fails
   * if ANY ranged weapon in the roster is authored slower than `FLEE_REFERENCE_SPEED`.
   */
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
  /**
   * 280 wu/s. Added 2026-08-10 for Sushi's Big Catch, and the reason is a rung that was
   * MISSING rather than a number that was wrong: `rangedMax` existed only at `slow` and
   * `drift`, so a weapon that had to reach the fair radius could not do it in a normal
   * flight time. See `maxSlow` below for the failure that exposed the gap.
   *
   * ⚠️ This is numerically equal to `closeFast` (280) TODAY and they must not be conflated.
   * `closeFast` is `rangedClose / fast`; this is `rangedMax / normal`. They coincide only
   * because 98/350 happens to equal 140/500. Point a weapon at the rung that describes its
   * REACH — that is the whole purpose of this table, which says so above: *"so a weapon's
   * `range` and `speed` can never drift out of sync."*
   */
  /** 280 wu/s */ max: projectileSpeed(REACH.rangedMax, FLIGHT_MS.normal),
  /**
   * 160 wu/s.
   *
   * ── ⚠️ A HOMING PROJECTILE ON THIS RUNG CANNOT CATCH A FLEEING HUMAN ─────────
   *
   * `stepProjectiles` retires a projectile at `traveled >= range` — CUMULATIVE PATH
   * LENGTH, not displacement. At this rung Big Catch gets 875 ms and 140 wu of path.
   * Against a target receding at `AI_CHASE_SPEED` (70) the closing rate is 90 and it
   * arrives; against one receding at `PLAYER_SPEED` (120) the closing rate is 40 and it
   * EXPIRES IN FLIGHT.
   *
   * `speedFor` applies both role constants, so **the human always shoots at the slow one
   * and `stepAI` always shoots at the fast one.** Measured: every homing weapon is worth
   * **1.89-2.14x more in the player's hands, with no decision differing** — both sides
   * press Big Catch 2.02x/match from the same separation for the same authored 27; the
   * player collects 26.48 and the AI collects 12.65.
   *
   * This is a ROLE ASYMMETRY IN THE SIM, not an AI defect, and it is why Sushi looked like
   * the character `stepAI` could not play. See `tools/tmp/ac_homing.mjs`.
   */
  /** 160 wu/s */ maxSlow: projectileSpeed(REACH.rangedMax, FLIGHT_MS.slow),
  /**
   * 80 wu/s. 🚨 **AN ORPHAN RUNG SINCE `DECISIONS §50a`. NOTHING SITS HERE AND NOTHING MAY.**
   *
   * ⚠️ THE OLD FIRST LINE, KEPT ABOVE ITS REVERSAL: *"80 wu/s. Egg's Hatch!, and nothing
   * else."* Uri's answer to §50a — *"chick is faster than the egg"* — moved `Hatch!` to
   * `maxSlow`, for the reasons the whole of the rest of this comment already gave. The
   * derivation below is not history: it is why nothing may come back to this rung, and
   * `sim.test.mjs` §31(g) is the guard that enforces it against every ranged weapon in the
   * roster rather than against this one constant.
   *
   * ── 🚨 THIS RUNG IS SLOWER THAN EVERY FIGHTER IN THE GAME ───────────────────
   *
   * `maxSlow` above records a homing shot that cannot catch a fleeing HUMAN. This one
   * cannot catch ANYBODY. Fighter speeds run 105.6-120 wu/s in the human role and
   * 61.6-70 in the AI's chase; a projectile at 80 is below the whole human band, so
   * against a human the closing rate is NEGATIVE and no `range` can pay for it.
   *
   * Measured (`tools/tmp/hm_audit.mjs`, selftest 12) — the largest separation at which one
   * press still delivers its full authored 15, against a target walking straight away:
   *
   *     gate `pickWeapon` presses from    140 wu
   *     vs a fleeing AI                    58 wu   (41% of the gate)
   *     vs a fleeing HUMAN                 27 wu   (19% — and `HIT_RADIUS_VS_ENEMY` is 26,
   *                                                 so that is "already touching you")
   *
   * Egg's own **Egg Tackle is a MELEE weapon with 84 wu of reach**. The game's longest
   * authored ranged weapon connects at a third of its owner's punching distance.
   *
   * ── WHY THIS DID NOT SHOW UP IN ANY BALANCE NUMBER ──────────────────────────
   *
   * Because it is broken SYMMETRICALLY. `c786fd7` found homing weapons are worth
   * 1.89x-2.14x more in a human's hands than the AI's, because `speedFor` applies
   * `PLAYER_SPEED` 120 to one role and `AI_CHASE_SPEED` 70 to the other. Hatch! is at
   * 2.00x — the worst ratio in the roster — and Egg's role split is only **+1.6 pp**,
   * because 40% and 20% of nothing are the same nothing. **A weapon that misses both
   * roles equally looks balanced**, and that is why no instrument flagged it for a year.
   *
   * ── AND IT IS NOT FIXED HERE, DELIBERATELY. THREE LEVERS, TWO REFUTED ───────
   *
   *  * HOMING STRENGTH — refuted, provably. Hatch! is the roster's ONLY single-projectile
   *    homing weapon, so it spends ZERO path on turning: measured, a displacement-based
   *    retirement rule leaves its straight-flee reach at 27 wu, unchanged to the digit.
   *    A better turn rate cannot buy a weapon that never turns.
   *  * REACH — refuted. `REACH.rangedMax` is already the longest rung AND IT SETS THE
   *    CAMERA (`FAIR_PLAY.radiusUnits`); and since reach = range - S x flight, at 1750 ms
   *    you would need range > 210 wu just to break even. That is a 50% camera pull-back.
   *  * SPEED — the only lever that works, and it costs the authored character. Priced at
   *    8 seeds against a detached worktree of `5f40b2b`, with a no-op staging control
   *    reproduced bit-identically first:
   *
   *      candidate                     egg strength   roster range   roster min   tier spread
   *      shipped (80 wu/s)                    46.9%         8.8 pp       46.3%        6.9 pp
   *      speed 280                            70.6%        27.5 pp       43.1%       15.3 pp
   *      speed 160                            63.7%        20.6 pp       43.1%       11.9 pp
   *      speed 280 + damage 5->4              47.5%         9.4 pp       45.0%        6.2 pp
   *      speed 160 + damage 5->4              46.3%         9.4 pp       45.0%        6.9 pp
   *      speed 280 + damage 5->3              35.0%        21.9 pp       43.1%       13.1 pp
   *
   *    Uncompensated it is a **+23.8 pp** buff — the tell that the character's numbers
   *    were authored around a weapon delivering 20-40%. Compensated it lands, but the
   *    damage lever is **~17.8 pp per point** (5 -> 70.6%, 4 -> 47.5%, 3 -> 35.0%), the
   *    same coarseness that got the vitals pass refused in `6cc2438` (13.5-27.9 pp/point)
   *    and far too coarse for an 8.8 pp band — so "damage 4 lands" is integer luck, not a
   *    tuned result. Every roster quantity in both landing rows moves INSIDE the ~9 pp
   *    aggregate floor, so the balance neither argues for the change nor against it.
   *
   * ⚠️ THE PARAGRAPH THAT USED TO CLOSE THIS COMMENT, KEPT ABOVE ITS REVERSAL:
   *
   * > *"=> It is a TASTE call between two feels — a chick that waddles, versus a weapon
   * > that works — and it is parked in `docs/DECISIONS-FOR-URI.md` §50 rather than decided
   * > here. ⚠️ If it is ever taken, `drift` becomes an ORPHAN RUNG with no weapon on it."*
   *
   * ── ✅ DECIDED. URI: *"chick is faster than the egg."* ──────────────────────
   *
   * It was NOT a taste call. A projectile slower than its own owner catches nothing in
   * either role, so the character was carrying an INERT weapon, not a slow one — and `drift`
   * is indeed an orphan rung now. `Hatch!` sits on `maxSlow`: 160 wu/s is the SMALLEST rung
   * clearing both constraints at once (1.52x Egg's own delivered 105.6 wu/s, and above the
   * 120 wu/s `FLEE_REFERENCE_SPEED` that `projectileMaxAgeMs` needs for the shot to be able
   * to close at all).
   *
   * ⚠️ **THE TABLE ABOVE IS PRE-§50b AND MUST NOT BE READ AS A PREDICTION OF TODAY.** It was
   * measured under path-length retirement, where a raised speed bought reach only by
   * shortening the flight; under the target-frame budget the same rung buys the WHOLE gate.
   * Re-measured on the shipped rule — `roster_lab --seeds 32`, 3520 matches per row, paired
   * on identical seeds against the tree immediately before §50a (`af35362`):
   *
   *      candidate                    egg strength  smart2 / chase    roster range   settled
   *      pre-§50a (80 wu/s, damage 5)        44.5%  /  54.8%              28.1 pp    28/110
   *      160 wu/s, damage 5                  65.6%  /  59.2%              27.3 pp    27/110
   *      160 wu/s, damage 4  <-- SHIPPED     45.5%  /  40.9%              27.8 pp    29/110
   *      160 wu/s, damage 3                  29.8%  /  24.7%              37.2 pp    33/110
   *
   * ⚠️ **THREE POINTS, NOT TWO, BECAUSE A SLOPE THROUGH TWO POINTS IS A LINE THROUGH TWO
   * POINTS.** 5 -> 4 is **20.1 pp** and 4 -> 3 is **15.7 pp** (smart2); the mean **17.9 pp per
   * point** reproduces the pre-§50b table's 17.8 almost exactly. The lever did NOT get finer
   * when the weapon started working, so §50a's warning stands unchanged: one point of damage
   * is 64% of the entire roster band and no integer lands a character on a mean.
   *
   * 🚨 **AND THE TWO DRIVERS DISAGREE ABOUT WHICH INTEGER IS THE NO-OP — BY MORE THAN A WHOLE
   * POINT OF DAMAGE. NO SINGLE-PARAMETER COMPENSATION CAN HOLD BOTH.** Against the pre-§50a
   * baseline, `damage 4` is **+0.9 pp on smart2 (inside the ~9 pp floor) and −13.9 on chase
   * (outside it)**, while `damage 5` is the mirror image: **+21.1 on smart2, +4.4 on chase**.
   * The mechanism is not mysterious — a CHASING opponent was always reachable by an 80 wu/s
   * chick (a closing target needs no reach at all), so on that policy the speed fix is worth
   * ~nothing and only the damage cut lands. A cooldown raise from `damage 5` cannot square it
   * either: it would have to cost smart2 4.8x what it costs chase, and press-rate scales both
   * together. **This is not a tuning failure; it is the measurement.**
   *
   * **Damage 4 ships because it holds the CHARACTER still on the stronger driver while the
   * WEAPON is repaired** — 44.5% -> 45.5% on a run where **90 of 110 matchups moved** (paired,
   * exact, max |Δ| 34.4 pp). Uri asked for a chick faster than the egg, not for a stronger
   * Egg. Damage 3 also drops the card's derived `damage` bar 7 -> 6 (`damageStatFor`), so it
   * is not a free integer either; damage 4 and 5 both leave the bar at 7.
   *
   * ⚠️ NO THIRD CONSTANT WAS TOUCHED, DELIBERATELY. Egg sits 4.5 pp under a mean that is 50%
   * by construction — inside the ~9 pp floor. Reaching for the cooldown to close THAT would be
   * steering inside a resolution floor, which `CLAUDE.md` #10 exists to forbid, and it would
   * put a third simultaneous constant on one character in a session where 110 matchups are
   * already moving for a different reason.
   */
  /**  80 wu/s */ maxDrift: projectileSpeed(REACH.rangedMax, FLIGHT_MS.drift),
} as const;

// ─────────────────────────────────────────────────────────────────────────────
// PROJECTILE RETIREMENT — the budget is denominated in the TARGET'S FRAME
// ─────────────────────────────────────────────────────────────────────────────
//
// ── AUTHORISED DEVIATION #12 (2026-08-11): `range` MEANS ONE THING NOW ───────
//
// Uri, on `DECISIONS §50b`: *"do what is needed."* The price was stated before he
// answered and is paid in full here: a new age cap, every ranged weapon meaningfully
// stronger, all 110 matchups moving at once.
//
// ── THE DEFECT, WHICH WAS NEVER A BALANCE PROBLEM ───────────────────────────
//
// `range` was doing two jobs and one of them was a lie:
//
//   * `ai.ts:pickWeapon` refuses to press past `w.range`, so `range` is the SEPARATION a
//     fighter believes the weapon works at. Both drivers share that line.
//   * `sim.ts:stepProjectiles` used to retire a shot at `traveled >= range` where
//     `traveled` was CUMULATIVE PATH LENGTH, so `range` was also the PATH BUDGET.
//
// Those coincide only when the target is standing still, and every one of the 183 cells
// that validated `pressValue` is a stationary target. Measured (`tf_reach.mjs`, on the
// tree before this deviation): **23 of 23 ranged weapons cannot connect at their own
// press gate against a fleeing human, and 23 of 23 cannot against a fleeing AI.**
// Hamburger's Lettuce Fling gates at 140 and reached **62**.
//
// ── WHY IT IS FIXED HERE AND NOT WITH A NUMBER ──────────────────────────────
//
// Two cheaper levers were measured and REFUTED, and they are recorded so nobody
// re-derives them (`SPEED.maxDrift` carries the long version):
//
//   * MORE RANGE cannot pay for it. `reach = range − S·flight + hitRadius`, so the tax is
//     `S·flight` and the range CANCELS. And `REACH.rangedMax` also sets the camera.
//   * RETIRING ON DISPLACEMENT refunds only the path a shot spends TURNING. A straight
//     chase has no turn, so it refunds nothing: measured on Egg, **27 wu -> 27 wu**.
//
// What is left is the frame the budget is measured in. `stepProjectiles` now charges a
// tick with the ground the shot GAINED on its target — the projectile's step minus the
// target's motion along the projectile's own heading, refunded only when the target is
// receding (a target running INTO a shot does not extend it). On a stationary target the
// refund is exactly zero and the arithmetic is bit-identical to the shipped rule, which
// is why `press_value.mjs`'s 183 cells, `sim.test.mjs` §29's chord rows and every reach
// ever published against a still target all still hold to the digit.
//
// ── THE TWO NUMBERS ARE NOW THE SAME QUANTITY, AND THAT IS THE POINT ────────
//
// In the target's rest frame the target does not move, so the separation `pickWeapon`
// gates on IS the distance the shot has to cross, and `traveled` IS that distance being
// crossed. A press admitted at `adist <= range` therefore has budget `range >= adist` for
// a crossing that costs `adist` — with `hitRadius` to spare, because the hit test fires
// at `hitRadius` and not at zero. The belief and the budget cannot diverge again without
// one of them changing units.
//
// ⚠️ **THE PRICE, STATED: EVERY RANGED WEAPON GETS STRONGER AND THE WHOLE ROSTER MOVES.**
// That is not a side effect; it is what fixing this means. Do not try to hold the roster
// still — measure where it lands. See the commit message for the paired per-matchup
// table, which is the real result (the aggregate is inside its own ~9 pp floor by
// construction, because every matchup moves in both directions at once).

/**
 * The fastest a fighter RUNS, wu/s — the reference speed the retirement budget is
 * guaranteed against.
 *
 * `PLAYER_SPEED` is a CAP, not a centre (see `SPEED_TOP_STAT`): `speedFor` only ever
 * scales it DOWN, so 120 wu/s is the fastest anything in the roster moves under its own
 * legs, in either role. `sim.test.mjs` asserts that against the live roster rather than
 * trusting this sentence.
 *
 * ⚠️ **ONE THING IN THE GAME EXCEEDS IT, DELIBERATELY, AND THAT IS WHY THE AGE CAP
 * EXISTS.** `TRAIL.speedBoost` (1.35) is applied in `sim.ts:moveFighter` to a fighter
 * standing on its own Sticky Trail — 152.28 wu/s for Donut, the only character with
 * `hasTrail`. That is **faster than `SPEED.maxSlow` (160) can close on with any margin
 * worth the name**, and it is the single case in the shipped game where a shot can be
 * outrun. Getting away from a slow shot is what the boost is FOR, so the rule is not
 * "guarantee delivery against it" — it is "make sure the shot still dies".
 */
export const FLEE_REFERENCE_SPEED = PLAYER_SPEED * 1000;

/**
 * The hard age cap for one shot, in ms: how long its budget can possibly take to spend.
 *
 * ── DERIVED FROM THE LADDER, NOT PICKED ─────────────────────────────────────
 *
 * A shot fired at the press gate has to cross `range` in the target's frame, and against
 * a target receding at `FLEE_REFERENCE_SPEED` it closes at `speed − FLEE_REFERENCE_SPEED`.
 * So `range / (speed − FLEE_REFERENCE_SPEED)` is not a taste call — it is the exact time
 * the budget takes to run out at the worst legal flee. Two properties follow, and both
 * are asserted rather than asserted-in-prose:
 *
 *   1. **IT NEVER TRUNCATES A LEGAL SHOT.** For any target moving at `S <= FLEE_REFERENCE_
 *      SPEED` the budget accrues at `>= speed − S >= speed − FLEE_REFERENCE_SPEED` per
 *      unit time, so the BUDGET always retires the shot at or before this cap. Against
 *      every fighter running under its own legs the cap is provably unreachable, and the
 *      whole of §50b's guarantee comes from the budget rule alone.
 *   2. **IT IS THE ONLY THING THAT KILLS A SHOT THAT CANNOT GAIN GROUND.** A trail-boosted
 *      Donut (152.28 wu/s) outruns `SPEED.maxSlow` (160) to within 7.72 wu/s: without a
 *      cap that shot would chase for 18 seconds. This is the case the cap exists for and
 *      it is the ONLY one in the shipped roster.
 *
 * ⚠️ **THE FALLBACK IS NOT A DEFAULT, IT IS THE OLD RULE.** A weapon slower than
 * `FLEE_REFERENCE_SPEED` can never close on the fastest runner at all, so
 * `range / (speed − FLEE_REFERENCE_SPEED)` is meaningless (negative or infinite) and the
 * cap falls back to the authored flight time `range / speed` — which is exactly when the
 * SHIPPED path-length rule retired it. So this deviation is a **no-op for any weapon that
 * cannot outrun the roster**, which is why Egg's `Hatch!` needed `DECISIONS §50a` as a
 * SEPARATE change and did not get better for free. `sim.test.mjs` asserts that no such
 * weapon is authored — that assertion is §50a generalised to the whole roster.
 */
export function projectileMaxAgeMs(w: Weapon): number {
  const speed = w.speed ?? 0;
  const range = w.range ?? 0;
  if (speed <= 0) return 0;
  const closing = speed - FLEE_REFERENCE_SPEED;
  return (range / (closing > 0 ? closing : speed)) * 1000;
}

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

  /**
   * ── WIND-UP: how long this weapon takes to GO OFF after it is pressed, in ms ──
   *
   * Absent or 0 — every weapon in the roster but one — means the press and the effect
   * happen in the same `stepMatch` call, which is what the sim did before this field
   * existed. `combat.ts:attemptAttack` therefore takes exactly the same path for them
   * and the whole sim is bit-identical without it.
   *
   * Above 0 the press only OPENS the attack (`Fighter.cast`); `sim.ts`'s fighter loop
   * resolves it `castMs` later through `combat.ts:resolveDueCast`, and the caster is
   * ROOTED and its AIM IS FROZEN for the whole window (`state.ts:movementLocked` /
   * `isCasting`). `weapon-fired` — the event every presentation layer draws the swing
   * off — is emitted at the RESOLVE, not at the press, so the animation and the damage
   * describe the same instant.
   *
   * ── WHY IT IS A SEPARATE FIELD AND NOT A SECOND MEANING OF ANYTHING ─────────
   *
   * `range` is on record in this file as *"two quantities wearing one number"* —
   * `ai.ts:pickWeapon` gates on it while `sim.ts:stepProjectiles` retires on it — and
   * `damage` cost 50.6 pp on Hamburger by being per-PELLET where two readers assumed
   * per-press. So this deliberately does NOT reuse `cooldown`. The two are independent
   * and both are live:
   *
   *     press -> effect        castMs      (this field; the telegraph)
   *     press -> next press    cooldown    (unchanged)
   *
   * `Fighter.lastUsed[i]` is still stamped at the PRESS, so press-to-press throughput is
   * `max(cooldown, castMs)` and at 1100/3500 it is exactly the 3500 it always was.
   * 🚨 **DO NOT "PAY THE WIND-UP BACK" WITH `cooldown -= castMs`.** Throughput did not
   * move, so that would be a straight buff on top of a nerf that was the point.
   *
   * ── THE NUMBER, AND WHERE IT COMES FROM ────────────────────────────────────
   *
   * Uri authorised the mechanic with a stated goal: *"a telegraph you can dodge"*. That
   * makes the duration a MEASURED quantity, not a taste one — the target must be able to
   * leave the effect by moving during the window.
   *
   * 🚨 **AND THE QUANTITY UNDERNEATH IT WAS MEASURED IN THE WRONG DIRECTION. THE OLD
   * PARAGRAPH IS KEPT VERBATIM BELOW BECAUSE THE SHIPPED 1100 IS ITS OUTPUT.** It read:
   *
   *   > *"For a melee weapon the effect is a disc of `range` around a caster who cannot
   *   > move, so from separation 0 the escape costs `range / speedFor(character,
   *   > PLAYER_SPEED)`:*
   *   >
   *   >     REACH.meleeHeavy 84 wu     fastest human 700.00 ms · slowest human 795.45 ms
   *   >
   *   > *Below 700 ms nobody escapes and it is a wind-up, not counterplay; above 795.45 ms
   *   > everybody escapes on reflex and it is a dead button. Both ends are failures.
   *   > Adding a human reaction to a sudden onset (~300 ms) puts the first duration that
   *   > is a real decision for the WHOLE roster at ~1100 ms: a player who reacts inside
   *   > 304.55 ms escapes, a player who does not is hit. That 304.55 ms is the counterplay
   *   > window and it is the number this feature is judged on."*
   *
   * **`combat.ts:deliverWeapon` does not implement a disc.** Three lines below its range
   * test it runs `angleTo > cone / 2 → "wrong direction"` against `attacker.facing` — and
   * `sim.ts:applyAim` and `ai.ts`'s facing block BOTH refuse to update `facing` while
   * `isCasting`. So the threatened set of a melee cast with `cone < 360` is a **frozen
   * WEDGE**, and the cheapest way out of a wedge is to leave the ARC, not to outrun the
   * RADIUS. `Mega` is a 100° cone; `Dump` is 90°. Neither is a disc.
   *
   * MEASURED — `tools/tmp/u6_escape.mjs`, which sweeps 36 RUN BEARINGS × 7 separations and
   * bisects `castMs` through the real `stepMatch`, against `u5_derive.mjs`, which sweeps
   * bearing 0 only (that is not a defect in `u5_derive`: bearing 0 is the whole answer for
   * a 360° weapon, and it is the tool's published contract):
   *
   *     waterbottle.Mega    radial escape (bearing 0)   601 ms @ sep 20   ← the shipped 1100's input
   *                         CHEAPEST escape             134 ms @ sep 20, bearing 130°
   *                         escape WINDOW (max over separations of min over bearings)
   *                                                     284 ms slowest human · 251 ms fastest
   *                         → castMs = roundUp50(284 + 300) = **600**, not 1100
   *
   * The shipped 1100 is therefore **1.83× the duration its own rule returns**, and the
   * excess is 500 ms of a mechanic whose price is measured in §(2)-(3) below: it is worth
   * **+16.1 pp of Water Bottle** to give it back, on a character currently sitting 40 pp
   * below the roster.
   *
   * ⚠️ **AND IT FALSIFIES THIS FILE'S OWN CONTROL ARM.** The decomposition below says
   * *"300 ms costs 13.8 pp and NOBODY CAN DODGE IT — 300 is below the 700.00 ms floor at
   * which the fastest human first escapes"*. The real escape from Mega's cone is **251 ms
   * for the fastest human and 284 ms for the SLOWEST** — both under 300. So **the dodge was
   * already ON in that arm, for every character in the roster**, and its 13.8 pp is not
   * "the ROOT and the INTERRUPT alone": it is root + interrupt + a dodge with 16-49 ms of
   * reaction. The arm that genuinely switches the dodge off by arithmetic is **150 ms**,
   * and it is measured on `soup.Dump` at the weapon itself.
   *
   * ⚠️ A `cone: 360` melee (`lollipop.Giant`) IS the disc the old paragraph describes, and
   * `u6_escape` reproduces bearing 0 as the cheapest bearing for it — 3584 ms, identical to
   * `u5_derive`'s radial. The old form is not wrong everywhere; it is wrong for every
   * weapon that carries a `cone`, which is five of the six candidates.
   *
   * ⚠️ **AND IT IS UNDODGEABLE AGAINST A SLOWED TARGET** — 1767.68 ms at
   * `SLOW_MOVE_MULTIPLIER` — which matters because Water Bottle's own Spray applies
   * `slow`. Spray -> Mega is a two-press combo on one character. `DECISIONS §74(c)`.
   *
   * ── 🚨 WHAT A WIND-UP COSTS, DECOMPOSED — AND IT IS NOT WHAT I FIRST REPORTED ──
   *
   * `roster_lab --seeds 32`, four arms, each a full 3520-match corpus paired on identical
   * seeds against a worktree of `2f907a7`. Water Bottle's strength, `smart2`:
   *
   *     arm                                   strength    delta   matchups moved   roster sd
   *     baseline (no cast system at all)        48.1%        —          —            3.1 pp
   *     the system, castMs 0                    48.1%      +0.0        0/110         3.1 pp
   *     castMs 300  (BELOW the dodge floor)     34.4%     -13.8       19/110         6.0 pp
   *     castMs 1100 (SHIPPED)                   13.1%     -35.0       19/110        11.9 pp
   *     Mega deleted from the AI entirely       12.2%     -35.9       20/110        12.3 pp
   *
   * Read the rows in order, because each one is the control for the next:
   *
   *   * **The scaffolding is exactly inert.** `castMs 0` moved 0 of 110 matchups and 0.0 pp
   *     on every character. Whatever the wind-up costs, none of it is the refactor.
   *   * **300 ms costs 13.8 pp and NOBODY CAN DODGE IT** — 300 is below the 700.00 ms floor
   *     at which the fastest human first escapes. So that 13.8 pp is the ROOT and the
   *     INTERRUPT alone, with the dodge switched off by arithmetic rather than by a flag.
   *   * **The last row is the one that mattered and it refuted my own commit message.** I
   *     had written that the cost was `ai.ts:pressValue` being blind to this field, so the
   *     driver over-used a rooted, dodgeable 18 over an instant 9 — the file's oldest defect
   *     shape, and a tidy story. **Suppressing the cast entirely is WORSE (-35.9), not
   *     better.** The AI is not making a mistake by pressing it; there is nothing to fix in
   *     the ranking key, and a discount factor there would have been a fabricated fix to a
   *     fabricated cause.
   *
   * The real finding is simpler and it is about THIS WEAPON, not about the mechanic:
   * **Mega is worth ~36 pp of Water Bottle's entire strength** (48.1 with it, 12.2 without),
   * and an 1100 ms root removes 35.0 of those 36 — **97% of its contribution**. The
   * telegraph works exactly as designed (35.9% of resolved casts are dodged, measured on
   * play by `tools/tmp/csx_castcost.mjs`); what fails is that 18 damage in an 84 wu / 100°
   * cone was authored for an INSTANT press and does not justify standing still for 1.1 s.
   *
   * → **The follow-on pass prices the ULTIMATE, not the telegraph.** Its own card promises
   * *"huge damage"* and *"one giant bottle"*; the numbers do not say that yet. Shortening
   * `castMs` to buy the winrate back would spend the one property Uri asked for.
   * ⚠️ And do NOT pay it back with `cooldown` — see the throughput note above.
   *
   * ── 🚨 THE ROSTER-WIDE RULE, AND THE FOUR SPECIALS IT REFUSES ──────────────
   *
   * Everything above derives ONE weapon. Extending it needed the rule stated as a function,
   * and stating it exposed that the melee closed form above is not the general case:
   *
   *     castMs = roundUp50( escapeWindow(slowest human) + REACTION_MS )      REACTION_MS = 300
   *
   * `escapeWindow` is *"how long the target must run, from separation 0, before this weapon
   * can no longer put damage on it"* — the quantity Uri's *"a telegraph you can dodge"*
   * actually names. It reproduces the shipped 1100 from Mega's own 795.45, which is why it
   * is trusted on the others. It is MEASURED per weapon by `tools/tmp/u5_derive.mjs`, which
   * bisects the smallest `castMs` at which a runner takes zero, driving the real
   * `stepMatch` — because for four of these six the closed form is wrong:
   *
   *     weapon             type    shape              escape ms  fast/slow    castMs    verdict
   *     waterbottle.Mega   melee   84 wu disc             683.67 /  790.39      1100    SHIPPED 16b635d
   *     soup.Dump          melee   84 wu disc             683.67 /  790.39     (1100)   REFUSED — balance
   *     taco.Double        ranged  ±10° fan, 128 wu       667.67 /  823.39     (1150)   REFUSED — ai.ts
   *     burrito.Swarm      ranged  homing, 140 wu        1350.67 / 1523.39     (1850)   REFUSED — ai.ts + cycle
   *     sushi.Catch        ranged  homing, 140 wu        1350.67 / 1540.39     (1850)   REFUSED — ai.ts + cycle
   *     lollipop.Giant     melee   360°, 400 wu          3317.67 / 3773.39     (4100)   REFUSED — arithmetic
   *
   * 🚨 **ONE OF SIX SHIPS, AND FIVE REFUSALS EACH HAVE A NUMBER RATHER THAN AN OPINION.**
   * Every parenthesised value above is DERIVED and MEASURED, so lifting any of these is one
   * edit and not a re-derivation.
   *
   *   * **`soup.Dump` is the only one the geometry accepts, and the BALANCE measurement
   *     killed it: -49.7 pp (smart2) and -71.1 pp (chase), to a strength of 0.6% / 2.8%.**
   *     Implemented, gated, measured on 3520 paired matches per policy, reverted. The full
   *     table and the un-run ablation are recorded at the weapon itself.
   *
   *   * **`lollipop.Giant` IS REFUSED BY THE NUMBER ALONE, AND THIS IS THE ANSWER TO
   *     `DECISIONS §9`'s parked question.** A 360° slam at `REACH.ultimateSlam` threatens a
   *     400 wu disc, so the slowest human needs **3773.39 ms** of running to leave it and the
   *     rule returns a **4100 ms** wind-up — **59% of its own 7000 ms cooldown spent rooted**,
   *     against 31% for Mega. There is no duration at which this weapon is both dodgeable and
   *     pressable: below ~3.3 s NOBODY escapes, so a wind-up here buys the ROOT and the
   *     INTERRUPT and calls them a telegraph. §19(b) already caps its damage precisely
   *     BECAUSE it cannot be dodged, and a wind-up does not change that fact — it is the same
   *     undodgeable 18 arriving later. `ai.ts:dangerSteer` independently agrees, in code: its
   *     *"only run from a telegraph you can actually clear"* gate names this exact weapon as
   *     the case it exists for. **If Uri wants a tell on Giant it is an INTERRUPT window, not
   *     a dodge, and that is a different feature with a different justification.**
   *   * **THE THREE RANGED SPECIALS ARE BLOCKED ON A FILE THIS PASS DOES NOT OWN.**
   *     `ai.ts:dangerSteer` steers away from an incoming cast with `if (w.type !== 'melee')
   *     continue;` — deliberately, and its comment says so: *"There are no ranged casts
   *     today; this refuses them explicitly rather than by accident."* So a ranged `castMs`
   *     shipped today is a telegraph **no AI can ever react to**, which is exactly the
   *     asymmetry that comment exists to prevent, pointed at the other seat. The numbers are
   *     derived and the values are parenthesised above so the routing is one edit, not a
   *     re-derivation. `sim.test.mjs` §33(m) is the ratchet: it FAILS the moment a ranged
   *     weapon grows a `castMs` while that refusal stands.
   *   * ⚠️ **AND THE `ai.ts` COMMENT'S REASON IS HALF WRONG, WHICH CHANGES THE FIX.** It says
   *     a ranged `range` is *"how far the projectile TRAVELS, not an area around the caster,
   *     and reading it as a radius here would make an AI flee a circle that does not exist."*
   *     That was true under path-length retirement. Under AUTHORISED DEVIATION #12 `traveled`
   *     is charged with the ground GAINED on the target, so for a HOMING shot the circle is
   *     exactly real: the threatened set is a disc of `range + hitRadius` = 165.20 wu, and
   *     the measured 1523.39 ms is 165.20/105.60 to three figures. For a NON-HOMING fan
   *     (`taco.Double`) it is not a disc — 823.39 ms is the ±10° fan walking off the target,
   *     not the 1450.76 ms the disc would predict. **Two answers, and the file needs both.**
   *     ⚠️ **THAT LAST IDENTITY IS ARITHMETICALLY FALSE AND IS KEPT BECAUSE IT WAS QUOTED
   *     INTO `ai.ts`.** `165.20 / 105.60 = 1564.39 ms`, not 1523.39 — and 1564.39 is printed
   *     one column to the LEFT of 1523.39 in `u5_derive`'s own output, under `pred@0 slow`.
   *     A MEASURED number was equated with the arithmetic of the PREDICTED one beside it.
   *     The disc SHAPE is right (`ai.ts:castThreat`'s bearing sweep puts the real edge at
   *     160 wu, bearing-independent); the identity is not. `a06c0fd` found it.
   *
   * ── 🚨 THE BLOCK ABOVE IS THE RECORD. THE RULE IT STATES IS FALSIFIED. ──────
   *
   * `DECISIONS §77` lifted the two refusals that were *"the number says no"* and `a06c0fd`
   * lifted the `ai.ts` block, so all five were re-derived and all five were MEASURED on
   * balance. **Both halves of the table above move, and one of them moves the shipped
   * weapon.** Everything below is 3,520 paired matches per policy per arm,
   * `roster_lab --seeds 32`, every arm a detached worktree of `a06c0fd` with one field
   * changed by `tools/tmp/u6_arm.mjs` (which verifies the staging through the module loader
   * and refuses an arm whose edit did not land — a textual patch that silently misses reads
   * exactly like "the change did nothing").
   *
   * ── (1) THE ESCAPE WINDOWS, RE-MEASURED IN THE CHEAPEST DIRECTION ──────────
   *
   * `tools/tmp/u6_escape.mjs`, 36 run bearings × 7 separations, bisect to 1 ms:
   *
   *     weapon             shape                 radial@20   WINDOW slow (sep,bearing)  DERIVED
   *     waterbottle.Mega   melee 100° cone, 84         601      284  ( 40, 130°)          600
   *     soup.Dump          melee  90° cone, 84         601      267  ( 40, 120°)          600
   *     taco.Double        ranged ±10° fan, 128        634      201  ( 20,  70°)          550
   *     burrito.Swarm      ranged homing, 140         1334     1334  ( 20,   0°)         1650
   *     sushi.Catch        ranged homing, 140         1351      784  ( 80,   0°)         1100
   *     lollipop.Giant     melee 360°, 400            3584     3584  ( 20,   0°)         3900
   *
   * Only `burrito.Swarm` keeps its old number — a homing volley really is a bearing-free
   * disc, so the two sweeps agree, which is the cross-check that the new sweep is not just
   * returning something smaller. `sushi.Catch` is the one non-monotone row: its cheapest
   * escape at 20 wu is to run THROUGH the caster (bearing 180°, 384 ms), because pellets
   * that overshoot cannot turn back inside `HOMING_TURN_RATE` — so its worst separation is
   * 80 wu, not 20, and a tool that sampled one separation would have priced it wrong in the
   * other direction.
   *
   * Every derived value is confirmed against BOTH failure modes, not one: the escape window
   * is the largest over separations (so the slowest human can always get out), and a
   * STANDING target still takes the full press at that `castMs` at every separation the
   * weapon reaches (so it is not a dead button). `u6_escape` prints the standing-target
   * damage beside every row for exactly that reason.
   *
   * ── (2) 🚨 AND EVERY ONE OF THEM IS A LARGE NERF, INCLUDING THE CORRECTED ONES ──
   *
   * Character STRENGTH, `smart2`, against the `a06c0fd` baseline. ⚠️ The aggregate moved
   * -0.8 to -2.7 pp in every arm — inside the ~9 pp floor, context and not a result. The
   * PAIRED per-matchup count is EXACT and is quoted separately; the two are never added.
   *
   * ✅ **NULL ARM FIRST**, because a null result is the normal outcome here and it is the
   * one nobody re-checks: the baseline tree re-staged through `u6_arm` and re-measured
   * against its own JSON moves **0 of 110 matchups on both policies**, aggregate +0.0 pp,
   * sd and settled identical. Whatever the rows below are, the rig did not manufacture
   * them.
   *
   *     arm                                    the character   Δ strength   paired moved
   *     waterbottle.Mega 1100 -> 600           9.8% -> 25.9%      +16.1      16/110  max 78.1
   *     waterbottle.Mega 1100 -> 450           9.8% -> 31.1%      +21.2      18/110  max 81.3
   *     soup.Dump        0 -> 150             47.2% -> 33.0%      -14.2      19/110  max 59.4
   *     soup.Dump        0 -> 600             47.2% ->  7.0%      -40.2      19/110  max 87.5
   *     soup.Dump        0 -> 1100            47.2% ->  0.2%      -47.0      19/110  max 100.0
   *     soup.Dump        REMOVED FROM PLAY    47.2% -> 13.1%      -34.1      18/110  max 78.1
   *     taco.Double      0 -> 300             51.9% -> 41.6%      -10.3   } one arm, three
   *     burrito.Swarm    0 -> 850             55.2% -> 25.2%      -30.0   } weapons:
   *     sushi.Catch      0 -> 550             54.1% -> 26.3%      -27.8   } 50/110 max 90.6
   *     taco.Double      0 -> 550             51.9% -> 23.0%      -28.9   } one arm, three
   *     burrito.Swarm    0 -> 1650            55.2% -> 12.7%      -42.5   } weapons:
   *     sushi.Catch      0 -> 1100            54.1% -> 10.0%      -44.1   } 50/110 max 96.9
   *     lollipop.Giant   range 400 -> 200     59.2% -> 32.8%      -26.4      20/110  max 62.5
   *     lollipop.Giant   range 200 + cast 2050 59.2% ->  1.4%     -57.8      20/110  max 100.0
   *
   * 🚨 **THE ABLATION `soup.Dump` SAYS WAS NEVER RUN HAS NOW BEEN RUN, AND IT INVERTS THE
   * QUESTION.** Removing Dump from play entirely (`cooldown` 999999, so it is pressed at
   * most once a match) leaves Soup at **13.1%**. A wind-up leaves it at **7.0% (600 ms)**
   * and **0.2% (1100 ms)**. **A telegraphed Dump is WORSE THAN NO DUMP AT ALL** — by 6.1 pp
   * at the corrected duration and 12.9 pp at the reverted one. That is not a weapon that
   * needs a shorter tell or more damage; a telegraphed press is a net LIABILITY to its
   * owner.
   *
   * The standing hypothesis at the weapon — `ai.ts:pressValue` ranking a 16 above a 9 and
   * spending the window on a whiff — is refuted by the same measurement, in the same way
   * `3f28b39` refuted it for Mega: if the AI were merely mis-choosing, taking the choice
   * away would HELP. It helps by 6.1 pp, which is the wrong sign for that story. What the
   * right sign points AT is §(3), and it is not what I expected either.
   *
   * ── (3) WHY IT COSTS THAT MUCH — FOUR TERMS, MEASURED BY ABLATION, AND MY OWN
   *        HYPOTHESIS WAS REFUTED BY THE ARM I RAN TO CONFIRM IT ─────────────
   *
   * ⚠️ **THIS SECTION FIRST READ "THE COST IS THE ROOT" AND THAT IS FALSE. THE WORDING IS
   * KEPT BECAUSE IT IS THE OBVIOUS STORY AND THE NEXT READER WILL REACH FOR IT TOO:**
   *
   *   > *"Nothing in the six is priced by the dodge; everything is priced by the 0.15-2.05 s
   *   > the caster spends unable to move. So the thing §77 authorises redesigning is not
   *   > five abilities. It is the CAST — `state.ts:movementLocked`'s `|| f.cast !== null`
   *   > is the entire cost."*
   *
   * A wind-up does four separable things to its caster. Each was removed ON ITS OWN in a
   * detached worktree of `a06c0fd` and measured over the same 3,520 paired matches
   * (`waterbottle.Mega` held at its shipped 1100 throughout, so the column below is the
   * price of the MECHANIC, not of a duration):
   *
   *     term removed                          site                        waterbottle (smart2)
   *     — (the shipped mechanic)              —                                   9.8%
   *     the ATTACK LOCKOUT                    combat.ts:attemptAttack            29.5%  +19.7
   *     the FROZEN AIM                        sim.ts:applyAim + ai.ts facing     10.5%   +0.6
   *     the MOVEMENT ROOT                     state.ts:movementLocked             3.3%   -6.6
   *
   * ⚠️ **THE AIM ROW HAD TO BE RE-RUN, AND THE FIRST VERSION OF IT READ +8.8.** That arm
   * carried `soup.Dump.castMs = 600` as well, and `strength` is normalised so the roster
   * mean is exactly 50% — so Soup collapsing 40 pp lifts every other character by
   * construction. The `soup.Dump 600` arm ALONE moves Water Bottle +7.2 pp for that reason
   * and nothing else. **A single-variable arm is not optional in a normalised metric**, and
   * the confound was in the direction that flattered the hypothesis.
   *
   * 🚨 **REMOVING THE ROOT MAKES IT WORSE.** An unrooted caster walks while its aim stays
   * frozen, so it drifts off its own committed bearing and misses more. The root is not the
   * cost; it is partly a *subsidy*, because standing still keeps the swing pointed where
   * the telegraph said it would land. And the FROZEN AIM is very nearly free: **1 of 110
   * matchups moved**, max 12.5 pp, and the character rate shifted +0.6 pp — so the one
   * property that makes the telegraph honest costs almost nothing to keep. (At N=2 a caster
   * is already facing its target when it presses, so there is little aim left to update.)
   *
   * 🚨 **AND THE +19.7 IS NOT FREE EITHER — IT IS THE COUNTERPLAY, SOLD.** With the lockout
   * gone, Water Bottle fires **Spray, Glass, Cap, Spray, Cap** during its own 1100 ms
   * wind-up (measured, not reasoned), and Spray/Cap carry `slow` while Glass carries
   * `stun`. A target that ran the whole window ends **1.46 wu** from the caster against an
   * 84 wu reach: it did not move. `sim.test.mjs` §33(l)'s three dodge rows go red on that
   * arm and they are RIGHT to — the wind-up stops being dodgeable at all. The lockout is
   * what makes "Spray -> Mega is a two-press combo" (see below) a decision instead of an
   * automatic execute.
   *
   * **So three of the four terms are load-bearing and the fourth is a subsidy. There is no
   * cheaper wind-up available; the only non-load-bearing lever is the DURATION** — and the
   * shipped duration is 1.83x the value its own rule returns, because the rule reads a cone
   * as a disc. That is the whole recommendation, and it is one field.
   *
   * The residual — delay per se — is what remains and it is the dominant term on Soup:
   * removing any single side-effect there recovers only 1.0-3.6 pp of a 40.2 pp loss, and a
   * `castMs` of **150 ms** (below BOTH of Dump's cone escape windows, 267 slowest / 234
   * fastest, so no dodge exists at all) already costs **14.2 pp**. A press whose effect
   * arrives 150 ms late lands on ground the target has left, and that is charged before any
   * telegraph, root or lockout is involved.
   *
   * ── (4) WHAT IS BLOCKING THE CONVERSION, EXACTLY ───────────────────────────
   *
   * Not `ai.ts` any more, and not the numbers: **`sim.test.mjs`**. Measured with
   * `tools/tmp/u6_gate.mjs`, which stages one edit into a worktree, runs the suite before
   * and after, and reports only the rows the edit turns red (a raw failure list would
   * attribute other passes' reds to the edit):
   *
   *     edit                            rows turned red   what they encode
   *     waterbottle.Mega.castMs=600            5          §33(l)/(n)/(o): the melee DISC
   *     soup.Dump.castMs=600                   2          §33(o) only
   *     taco.Double.castMs=550                 9          §1 coincident fixtures + §33(o)
   *     burrito.Swarm.castMs=1650              6          §20/§25 press-gate fixtures
   *     sushi.Catch.castMs=1100                6          §20/§25 press-gate fixtures
   *     lollipop.Giant.range=200               2          §19 reach + §33(o)'s Giant row
   *
   * §33(o) is the ratchet, and it asserts `castMs === roundUp50(range/slowestHuman + 300)` —
   * the melee **disc** closed form, for every cast weapon in the roster. It is green today
   * only because the roster's one cast weapon is priced by that same falsified form. The
   * dozen fixture rows are a different class entirely: they press a special and read its
   * projectiles on the SAME tick, which is what a wind-up moves. **Every conversion in the
   * table above reddens rows in a file this pass does not own, so none of them ships here.**
   */
  castMs?: number;

  /**
   * ── DISPLACEMENT: THE THREE WEAPONS-CAN-MOVE-YOU FIELDS ────────────────────
   *
   * All three are world-unit DISTANCES, all three are **absent on 29 of the roster's 33
   * weapons**, and absent means the sim is bit-identical to the one before they existed —
   * exactly the property `castMs` has and for exactly the same reason. `sim.test.mjs`
   * §39(g) asserts that inertness on a real match rather than reasoning about it.
   *
   * 🚨 **THE SHAPE OF THESE FIELDS IS A MEASUREMENT, NOT A PREFERENCE.** `6ea35f5` built
   * the same primitive with the magnitude DERIVED — `PLAYER_SIZE * dealt / maxRosterDamage`,
   * i.e. every weapon in the game pushes, priced off its own damage — precisely to avoid
   * asking `rules.ts` for a field. Measured end to end through the real `stepMatch`, it
   * **deleted melee**: a kit firing three pushing weapons stacks three shoves, the sustained
   * push rate beat the attacker's own chase speed (hamburger **1.66x** on today's
   * constants), and a passive immortal target was shoved from separation 30 to **90.86 wu
   * in 1,100 ms by the bot trying to reach it**. The commit's own verdict:
   *
   *   > *"The scale is not the problem; the SURFACE is. It has to be authored PER WEAPON
   *   > and ABSENT BY DEFAULT, exactly like `castMs`."*
   *
   * So there is no global dial here and none in `movement.ts`. Reproduce the refusal with
   * `node tools/tmp/mv_push.mjs --refuse`; §39(f) keeps it as a standing roster guard, so a
   * future authored number cannot walk back into it unseen.
   *
   * ⚠️ **THE UNIT IS A BODY LENGTH, LIKE `REACH`.** `BODY_LENGTH` is `PLAYER_SIZE`, the
   * reach ladder is denominated in it, and `movement.ts:MAX_PUSH_DISTANCE` — the cap ALL
   * pending displacement accumulates into — is exactly one of them. Writing `21` instead of
   * `BODY_LENGTH / 2` would be a literal that stops meaning "half a body" the moment
   * `PLAYER_SIZE` moves, which is the drift `REACH`'s own header exists to refuse.
   *
   * ── THE PRICE, MEASURED — `roster_lab --seeds 16`, 1,760 matches per policy ─
   *
   * Paired on identical seeds against `0c98cae`, so each column is EXACT for those matches.
   * ⚠️ Aggregate player win moved **-0.6 pp (smart2) / +1.0 pp (chase)** — inside the ~9 pp
   * aggregate floor — while **40 of 110 matchups moved, mean |Δ| 8.2 pp**. Those are two
   * different quantities and this table never adds them.
   *
   *     Δ character strength      smart2    chase      kept?
   *     hotdog   (knockback)       -2.5     -9.4       KEPT — the policies disagree in sign
   *     egg      (selfLaunch)      +3.4     -6.6       KEPT — same, and inside the floor
   *     sushi    (lure)            +1.6     +0.6       KEPT — and see the caveat below
   *     waterbottle (selfLaunch)   -9.0    -11.2       🚨 REVERTED. Both policies, both
   *                                                    outside the floor, on the character
   *                                                    §77 calls the roster's weakest.
   *
   * 🚨 **AND THE SUSHI ROW IS NOT WHAT IT LOOKS LIKE: `lure` IS BIT-IDENTICAL AT TWO SEATS,
   * SO NO 110-CELL INSTRUMENT IN THIS REPO CAN PRICE IT AT ALL.** The anchor is the victim's
   * own position, and at N=2 the victim IS the only opponent — so `displaceFighter` is handed
   * a zero separation and returns without writing anything. Verified rather than reasoned:
   * all **20 sushi matchups ran BIT-IDENTICAL** (full state digest + event stream, 3,000
   * ticks) against a lure-ablated tree, while **3 of 11 six-seat rosters diverged** — the
   * control that stops "inert" meaning "the instrument is blind". The lure's price lives in
   * `nf_ffa` at N=6 and nowhere else.
   *
   * ⚠️ **AND BOTH KEPT LOSSES POINT THE SAME WAY: A DISPLACEMENT COSTS ITS OWNER.** A
   * knockback pushes the target out of your own melee reach (`6ea35f5`'s refusal, at 0.42x
   * instead of 1.66x) and a self-launch carries you PAST the fighter you just hit. Neither is
   * a bug; both are what the cards promise. Clamping a launch to the separation to the
   * nearest opponent — the clamp `lure` already has — is the obvious next experiment.
   *
   * ⚠️ **AND `DECISIONS §80` BOUNDS EVERY NUMBER AUTHORED HERE.** A super must be
   * DODGEABLE. Displacement is spent at `PLAYER_SPEED`, the roster CAP, so a fighter
   * walking straight into it is moved at most `PLAYER_SPEED - speedFor(c)` = **5.04 wu over
   * a maximum displacement, 12% of one body** — against a `STUN_DURATION_MS` that denies
   * 180 wu. `movement.ts:displaceFighter` carries the derivation and both signs of it.
   */
  /**
   * How far a HIT from this weapon shoves its victim, directly away from the attacker.
   *
   * `hotdog.Ketchup`'s card — *"Makes enemies slide and lose control"* — is the only one in
   * the roster that promises this, and it is the whole of `wm_gate`'s `control-loss` claim.
   * Applied in `combat.ts:applyDamage`, the single choke point every weapon damage path
   * already funnels through (melee, and BOTH projectile impact paths), because a rule
   * applied at two of the three is a silent balance bug in the third.
   *
   * ⚠️ Away from the ATTACKER, not from the projectile: a homing shot curves, so "away from
   * where the bullet came from" is not a well-defined bearing for it, and the shooter's own
   * position is the one every reader can see on screen.
   */
  knockback?: number;

  /**
   * How far a HIT from this weapon pulls **every living opponent of the attacker** toward
   * the point of impact.
   *
   * ⚠️ **EVERY OPPONENT, NOT THE VICTIM — AND THAT IS THE CLAIM, NOT A GENERALISATION.**
   * `sushi.Seaweed`'s card is *"Seaweed lures **every enemy** toward it while he shoots
   * them"*, and `wm_claims.json` puts the whole quantifier inside the `lure` span. A pull
   * that moved only the fighter the projectile struck would leave that card false while the
   * gate went green, which is the "term wider than the sim / narrower than the card" failure
   * `wm_vocab.mjs` exists to refuse. 🚨 **It is therefore UNTESTABLE AT TWO SEATS**, where
   * "the victim" and "every enemy" name the same fighter — the sixth defect class of that
   * shape this repo has paid for. §39(c) drives it at **N=6**.
   *
   * ⚠️ **THE ANCHOR IS THE VICTIM'S POSITION AT THE MOMENT OF THE HIT** — the bait sticks to
   * whoever it hit — which is the same `x`/`y` `applyDamage` already publishes on
   * `hit-landed`, so there is no second answer to "where did this land". The victim itself
   * is AT the anchor, so it is pulled nowhere: you are not lured toward yourself. And the
   * pull is CLAMPED to each opponent's own separation, so nobody is dragged through the
   * bait and out the far side, where a repeat application would yank them back.
   */
  lure?: number;

  /**
   * How far the CASTER is displaced along its own frozen facing when this weapon goes off.
   *
   * **`egg.Tackle` is the only weapon that authors one** — *"Launches herself at the enemy"*.
   * Applied in `combat.ts:resolveWeapon`, after the weapon has been delivered.
   *
   * 🚨 **`waterbottle.Mega` — *"launches himself up"* — AUTHORED ONE ON 2026-08-21 AND IT WAS
   * REVERTED THE SAME DAY, MEASURED.** It cost that character **-9.0 pp (smart2) / -11.2 pp
   * (chase)** in a single-variable ablation, halving the distance did not rescue it, and it
   * landed on the roster's weakest character while `DECISIONS §79`/`§80` are an in-flight
   * programme to fix exactly that. Its `wm_gate` `self-launch` claim therefore stays MISSING
   * ON PURPOSE — the weapon record carries the whole measurement, and re-adding it needs the
   * clamp described there, not a smaller number.
   *
   * 🔴 **A SELF-LAUNCH NEVER EXTENDS THE REACH OF ITS OWN WEAPON**, which is what keeps it out
   * of `DECISIONS §80` — Uri's answer that a super must be dodgeable, whose lever 1 is to
   * SHRINK the effect radius. `waterbottle.Mega` is the exact weapon whose dodgeability is a
   * live acceptance test (`tools/tmp/lk_dodge.mjs`, `kt_bearing.mjs`), so a launch that added
   * `selfLaunch` to `range` would be a radius increase hidden in a field nobody reads as a
   * reach. §39(h) bisects the real hit/miss boundary and requires it on `range` exactly.
   * ⚠️ **The guarantee is the DEFERRAL, not the statement order** — displacement is queued and
   * spent by `sim.ts`'s loop on LATER ticks, never inside the tick that queued it. An earlier
   * draft of this paragraph claimed the order was load-bearing and that was false; see
   * `combat.ts:resolveWeapon`, where the old wording is kept with the correction.
   *
   * ⚠️ **NOT AT THE PRESS, EVEN THOUGH `waterbottle.Mega`'s CARD READS THAT WAY** (*"launches
   * himself up (takes a few seconds)"*). A cast ROOTS its caster, and `movement.ts:stepPush`
   * refuses to move a fighter that `movementLocked` denies — so a press-time launch on a
   * cast weapon would be burned entirely by its own root and the field would be decoration.
   * One site, at the going-off, is the same rule for a castless tackle and a 1,400 ms slam.
   *
   * ⚠️ **AND THE SIM HAS NO VERTICAL AXIS, WHICH IS WHY *"launches himself UP"* WAS ALWAYS
   * THE WEAKEST OF THE FIVE FITS.** A 2D top-down sim can only express a launch as a ground
   * displacement, so that card was being read as *"he ends up on the enemy he dumps water
   * on"* — defensible, and flagged as a judgement call before it was measured rather than
   * after. `giantSlam` is the precedent for a term whose sim half is deliberately partial.
   * The measurement then refused it independently, which is the more interesting reason.
   */
  selfLaunch?: number;
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

/**
 * The prose half of a weapon — what the character card and the home kit grid show.
 *
 * ⚠️ THE OLD SHAPE IS KEPT HERE, BECAUSE THE MISSING FIELD *IS* THE BUG:
 *
 * > `interface AbilityBlurb { emoji: string; name: string; desc: string; }`
 *
 * `abilities[]` and `weapons[]` were SIBLING ARRAYS WITH NO LINK. Nothing in the type
 * system and nothing in any gate said which weapon a blurb described, so the only join
 * available to a consumer was a guess — by `name`, or by INDEX.
 *
 * ── WHY THAT WAS DANGEROUS RATHER THAN MERELY UNTIDY (measured, `wj_audit.mjs`) ──
 *   33 of 34 abilities join to a weapon by exact `name`  (the 34th is Donut's passive)
 *   30 of 34 ALSO join by index
 *   `hamburger` is the ONLY character whose two arrays are in a different order, and
 *   3 of its 4 rows disagree.
 * **A positional join is correct for 10 of the 11 characters, which is exactly why it
 * survived** — and an auditor with a purpose-built instrument joined positionally and
 * produced a confidently false finding about hamburger's cards. The audit reproduced
 * the very defect class it was auditing.
 *
 * ── WHERE THE SHAPE CAME FROM ───────────────────────────────────────────────
 * In the 2D prototype the prose and the weapon records lived in two standalone HTML
 * files that **could not import each other** — one carried 34 `desc:` and no `effect:`,
 * the other 33 `effect:` and no `desc:`. The rebuild merged them into this file as two
 * sibling arrays and did not add the link, so it inherited the structure that made the
 * mismatch possible along with the data.
 *
 * ── THE LINK ────────────────────────────────────────────────────────────────
 * `weapon` is the `key` of the entry in this character's own `weapons[]` that the blurb
 * describes, or `null` for a passive with no weapon slot (Donut's Sticky Trail — the
 * one and only such row today). It is **required**, so a new ability cannot be authored
 * without saying what it describes, and `defineCharacter()` binds `K` to that
 * character's actual weapon keys, so a key that does not exist is a COMPILE ERROR.
 *
 * 🔴 **Consumers must go through `abilityCards()` / `weaponForAbility()`.** Both join on
 * `key`, never on position, and `abilityCards()` returns one card per ability — it can
 * neither reorder nor drop a row. Do not reach for `def.weapons` beside `def.abilities`
 * in a screen; `wj_guard.mjs` asserts that no file outside this one holds both.
 *
 * ⚠️ `name` AND `emoji` STAY ON THIS RECORD AND ARE **NOT** DERIVED FROM THE WEAPON, and
 * that is a measurement, not laziness. All 33 joined rows already carry the weapon's
 * name verbatim, so deriving `name` would be text-neutral — but only **32 of 33** carry
 * the weapon's emoji: `lollipop`'s *Giant Lollipop* blurb shows 💫 where its weapon
 * shows 🍭. Deriving the glyph would have silently changed a rendered icon on that card.
 * The duplication that remains is guarded instead: `wj_guard.mjs` asserts name equality
 * on all 33 and emoji equality on all but that one acknowledged divergence, so drift is
 * a red gate rather than a silent mismatch.
 */
export interface AbilityBlurb<K extends string = string> {
  emoji: string;
  name: string;
  desc: string;
  /**
   * THE JOIN. The `key` of the weapon in THIS character's `weapons[]` that this blurb
   * describes, or `null` for a passive with no weapon slot. Never an index.
   */
  weapon: K | null;
}

/**
 * One rendered ability row: the blurb's own fields, already paired with the weapon it
 * describes. **This is the only supported way to read the two arrays together.**
 */
export interface AbilityCard {
  emoji: string;
  name: string;
  desc: string;
  /** `null` only for a passive (`weapon: null`); never null because a lookup failed. */
  weapon: Weapon | null;
}

/**
 * Resolve one blurb to its weapon, by `key`.
 *
 * 🚨 THROWS on a key that resolves to nothing rather than returning `null`. This repo
 * shipped a `.map(s => roster[s]).filter(Boolean)` that **silently dropped fighters** and
 * listed 3 of 5; a join that quietly returns nothing is the same defect wearing a
 * different hat. The state is unreachable by construction — `defineCharacter` will not
 * compile a key that is not on the character — so the throw is a backstop for a hand-cast
 * or a runtime-built def, not an expected path.
 */
export function weaponForAbility(def: CharacterDef, ability: AbilityBlurb): Weapon | null {
  if (ability.weapon === null) return null;
  const w = def.weapons.find((x) => x.key === ability.weapon);
  if (!w) {
    throw new Error(
      `rules: ${def.id} ability '${ability.name}' names weapon key '${ability.weapon}', which does not exist`,
    );
  }
  return w;
}

/**
 * Every ability of a character, in authored order, each already joined to its weapon.
 *
 * Order-independent in `weapons[]` by construction (it looks up by `key`), and it emits
 * **exactly one card per ability** — `abilities.map`, never a `filter` — so no row can
 * be dropped on the way to a screen.
 */
export function abilityCards(def: CharacterDef): AbilityCard[] {
  return def.abilities.map((a) => ({
    emoji: a.emoji,
    name: a.name,
    desc: a.desc,
    weapon: weaponForAbility(def, a),
  }));
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
  // ⚠️ `broth` IS THE ARENA POT'S BROTH, NOT SOUP THE CHARACTER'S. Consumed by
  // `arena/shared.ts` -> `arena/hazards.ts` (`pot_broth`, `pot_bubble`) and by nothing
  // else. It stays `#E8792A` on purpose while soup's own liquid moved to `#CC9F0D`.
  //
  // MEASURED before deciding, because "it probably delivers no pixels" was the guess:
  // magenta-ablated at the two pot stations it is **10,769 px / 1.119% of frame** at
  // `pot_south` and 8,155 px / 0.848% at `pot_diagonal`, self-pair 0 both times. It is a
  // large unobstructed ellipse, not a hidden one. AND the direction is wrong twice over:
  // recolouring it would drag a 1.1%-of-frame ARENA element from hue 24.9 into the cast's
  // own band, which `DECISIONS §73` wants vacated, to fix a character that does not read
  // this constant at all.
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

/**
 * Card background colours behind the roster art. Neon/Cyber animate a black zigzag.
 *
 * ONE HUE FAMILY, RARITY BY VALUE AND CHROMA — not by hue. Uri, item 3: "muted
 * desaturated base, small number of accents, reserve high saturation for characters".
 *
 * ⚠️ THE OLD PALETTE IS KEPT BELOW because it is the measurement, not a relic:
 *
 *     Normal '#BEBEBE'  Rare '#4A90D9'  Epic  '#9B6FDE'
 *     Legendary '#FFD84D'  Neon '#E63946'  Cyber '#3FD1E0'
 *
 * Six fills over eleven cards, five of them chromatic, at 211/264/47/355/186 degrees
 * — spread almost evenly around the wheel, so the grid had no family at all. What it
 * cost, measured on the shipped roster (`tools/tmp/chars_metrics.mjs`, desktop, the
 * baked `ThumbMeta.bg` and the keyed figure pixels of all eleven cards):
 *
 *   - MEAN FIGURE/GROUND POLARITY -0.156. SEVEN of eleven cards drew the character
 *     DARKER than the backdrop presenting it: sushi -0.398, waterbottle -0.389,
 *     hotdog -0.341, hamburger -0.289, lollipop -0.267, donut -0.243, burrito -0.019.
 *   - THE BACKDROP OUT-CHROMAED THE CHARACTER ON NINE OF ELEVEN. Mean figure chroma
 *     0.370; the fills graded to 0.827 (Rare), 0.886 (Legendary, Neon), 0.961 (Cyber).
 *
 * That is the same defect `b945147` fixed in the lobby — "the character was the LEAST
 * saturated thing in its own frame" — left standing on the roster grid, which is the
 * screen whose entire job is presenting characters.
 *
 * 🚨 AND THE AUTHORED HEX IS NOT THE COLOUR ON THE CARD. `thumbs.ts` sets this as
 * `stage.scene.background` and renders the thumbnail THROUGH the post chain, so the
 * grade gets it: measured, it moves HSV saturation by up to +0.261 and luma by up to
 * +0.138 (Cyber #3FD1E0 landed on screen as `#05EAFA`). Authoring against the hex is
 * authoring against the wrong number. Every value below was solved for its GRADED
 * result by `tools/tmp/rg_cardgrade.mjs`, which ports `ToyGradeEffect` at the SHIPPED
 * uniforms and reproduces all six old readbacks to within 1/255.
 *
 *   tier        authored -> ON CARD    hue  chroma   luma   white-contrast
 *   Normal      #80888D     #758B99    203   0.141   0.245   3.55:1
 *   Rare        #7A828C     #6B819D    214   0.196   0.213   4.00:1
 *   Epic        #737C88     #5F7798    215   0.224   0.179   4.59:1
 *   Legendary   #6F7487     #5C699D    228   0.255   0.148   5.30:1
 *   Neon        #676C83     #4F5C9A    230   0.294   0.116   6.31:1
 *   Cyber       #5B647B     #3A518C    223   0.322   0.087   7.68:1
 *
 * Rarity is now THREE monotone ramps inside one family — value down, chroma up, hue
 * leaning teal->indigo — instead of six unordered hues. Rarity is an ORDERED concept
 * (the drop tables in `tuning.ts` are ordered) and six scattered hues could not express
 * order at all; a value ladder can. ⚠️ It says RARER, not STRONGER — `DECISIONS §26`
 * has rarity granting no power and that is Uri's open question, not something this
 * palette may quietly answer.
 *
 * Why THIS family: it is not a new one. The lobby stage was made cool at 180-210 in
 * `b945147` so the warm hero reads against it, and the hero plate beside this grid is
 * already deep navy. The cast is overwhelmingly warm — eleven yellow/orange/tan foods —
 * so a cool ground is the same figure/ground trade the lobby already paid for, and
 * these fills land in the band that family already occupies rather than opening a third.
 *
 * Every graded chroma is below the 0.370 mean figure chroma, and every graded luma is
 * below the LOWEST per-card figure luma (soup, 0.240), so polarity is positive on all
 * eleven cards with margin rather than on four.
 *
 * ⚠️ THE SIX-WAY DISTINCTION IS NOT CARRIED BY THIS CONSTANT ALONE and must not be.
 * `.chars-card-rarity` paints `RARITY_COLORS` — a separate, still-six-hue palette — as
 * a chip with an ink stroke, and that is the accent budget Uri's "small number of
 * accents" allows. The chip is dropped only on landscape phone, where this ladder's
 * 0.0297 minimum luma step is what keeps the tiers apart; that step is 1.5x the old
 * palette's own worst gap (Epic 0.236 vs Neon 0.215 = 0.0204), so the tell got BETTER
 * on the exact viewport that has to rely on it.
 */
export const RARITY_CARD_COLORS: Record<Rarity, string> = {
  Normal: '#80888D',
  Rare: '#7A828C',
  Epic: '#737C88',
  Legendary: '#6F7487',
  Neon: '#676C83',
  Cyber: '#5B647B',
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

/**
 * The one constructor for a `CharacterDef`, and the reason `AbilityBlurb.weapon` is a
 * COMPILE error rather than a runtime one.
 *
 * `const W` captures each character's weapon `key`s as literal types (`'Smash' |
 * 'Tomato' | …`), and `AbilityBlurb<W[number]['key']>` then constrains every blurb's
 * `weapon` field to that exact union. Author `weapon: 'Tomatoe'` and `tsc` says
 * *"Type '\"Tomatoe\"' is not assignable to type '\"Smash\" | \"Tomato\" | …'"* at the
 * line that has the typo.
 *
 * ⚠️ THE SHAPE OF THE SIGNATURE IS LOAD-BEARING AND THE OBVIOUS ALTERNATIVE IS SILENT.
 * Writing it as `<const K extends string>` with `weapons: readonly (Weapon & { key: K })[]`
 * reads better and **does not work**: `abilities` is then a SECOND inference site for `K`,
 * so a typo widens the union to include itself and type-checks clean. Measured both forms
 * side by side on a fixture — the `W[number]['key']` form rejects the typo, the `K` form
 * accepts it. `K` has to be COMPUTED from the weapons array, never inferred alongside it.
 *
 * At runtime this is the identity function; `const` inference only marks the argument's
 * literal positions readonly, which is a type-level artefact of inference and not a
 * property of the object, hence the cast. (Nested mutable arrays such as `comboParts`
 * opt out of `const` inference automatically because their declared type is mutable.)
 */
function defineCharacter<const W extends readonly Weapon[]>(
  def: Omit<CharacterDef, 'weapons' | 'abilities'> & {
    weapons: W;
    abilities: AbilityBlurb<W[number]['key']>[];
  },
): CharacterDef {
  return def as unknown as CharacterDef;
}

export const CHARACTERS: Record<CharacterId, CharacterDef> = {
  hamburger: defineCharacter({
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
    // 🚨 THE ONE CHARACTER WHOSE TWO ARRAYS ARE IN A DIFFERENT ORDER — weapons run
    // Smash / Tomato / Lettuce / Onion and the blurbs run Tomato / Lettuce / Smash /
    // Onion, so 3 of these 4 rows would join to the WRONG weapon by index. It is the
    // known-bad `wj_guard.mjs` is validated against, and the only reason the rest of
    // the roster could tolerate a positional join for as long as it did.
    abilities: [
      { emoji: '🍅', name: 'Tomato Toss', desc: 'Slows enemies down', weapon: 'Tomato' },
      // WAS: 'Stuns enemies for a few seconds' — false against a GLOBAL 2000 ms
      // `STUN_DURATION_MS`. See the block beside that constant for why the constant was
      // the wrong thing to move. DECISIONS §81.
      { emoji: '🥬', name: 'Lettuce Fling', desc: 'Stuns enemies for a moment', weapon: 'Lettuce' },
      { emoji: '🍖', name: 'Patty Smash', desc: 'Deals heavy damage', weapon: 'Smash' },
      { emoji: '🧅', name: 'Onion Ring', desc: 'Heals himself', weapon: 'Onion' },
    ],
  }),

  donut: defineCharacter({
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
      { emoji: '🍬', name: 'Candy Barrage', desc: 'Throws candies that chip away health', weapon: 'Candy' },
      // `weapon: null` — THE ONE PASSIVE IN THE ROSTER. It is `hasTrail` above, not a
      // weapon slot, which is why this character has 2 blurbs against 1 weapon and why
      // the join has to admit a null rather than assume a 1:1 array pairing.
      { emoji: '🍯', name: 'Sticky Trail', desc: 'Leaves a filling trail - hurts enemies, speeds him up', weapon: null },
    ],
  }),

  taco: defineCharacter({
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
      // ── THE WIND-UP: DERIVED 550 ms, MEASURED, NOT APPLIED (2026-08-18) ──────
      //
      // `a06c0fd` lifted the `ai.ts` block that refused ranged casts, so `DECISIONS §77`'s
      // first blocker is gone. The value moves too: `u5_derive` sweeps RADIAL escape and
      // returns 1150, but a ±10° fan is a WEDGE and the cheapest exit is sideways —
      // `u6_escape` measures the window at **201 ms** (slowest human, bearing 70°, worst
      // separation 20 wu) against the 823.39 ms of running straight away, so the rule
      // returns **550**. `damage: 0` is not a problem for the cast path: `deliverWeapon`'s
      // combo branch reads `part.damage` and never `w.damage`, and `resolveWeapon` calls
      // the same function, so the wind-up delivers the full 23 (measured through
      // `stepMatch`, not read off the source).
      //
      // ⚠️ **AND IT COSTS TACO 28.9 pp.** `roster_lab --seeds 32`, paired: 51.9% -> 23.0%
      // at 550 and 51.9% -> 41.6% at 300 (aggregate -2.0 pp, inside the ~9 pp floor; PAIRED
      // 50/110 moved in both arms, max 96.9 / 90.6 pp, EXACT). It is roughly linear in
      // `castMs`, and it is NOT the root — see `Weapon.castMs` §(3), where removing the
      // root measures WORSE. It also turns **9** rows red in `sim.test.mjs`, seven of them
      // §1 fixtures that press this weapon and read its projectiles on the same tick.
      {
        key: 'Double', name: 'Double Toss', type: 'ranged', range: REACH.rangedLong, damage: 0, cooldown: 2500, speed: SPEED.long, color: '#6B3E26', effect: null, emoji: '💥',
        comboParts: [
          { color: '#6B3E26', damage: 14, angle: -10, emoji: '🥩' },
          { color: '#B497D6', damage: 9, angle: 10, emoji: '🧅' },
        ],
      },
    ],
    abilities: [
      { emoji: '🥩', name: 'Filling Toss', desc: 'Throws his filling for heavy damage', weapon: 'Filling' },
      { emoji: '🧅', name: 'Onion Bomb', desc: 'Throws onion for damage', weapon: 'Onion' },
      { emoji: '💥', name: 'Double Toss', desc: 'Special: throws filling and onion together for massive damage', weapon: 'Double' },
    ],
  }),

  burrito: defineCharacter({
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
      // 4 -> 6 with the Swarm nerf below, and the two are ONE change: DEVIATION #13 moves
      // power out of the max-reach homing swarm and into the weapon at 58 wu, because 58 wu
      // is exactly where `af35362` changed nothing. Measured on the shipped constants, one
      // knob at a time from HEAD (`roster_lab --seeds 8`, paired): Roll 4->5 is worth
      // **+10.6 pp smart2 / +5.6 chase**, 4->6 **+10.6 / +14.4**, 4->7 **+11.9 / +20.0** —
      // i.e. its smart2 response SATURATES at 5 while its chase response keeps climbing.
      // That makes it the only lever found in this pass that moves the two policies by
      // materially different amounts, and it is the reason Burrito's chase cost is -14.8 pp
      // here instead of the -23.4 the swarm nerf alone produces.
      { key: 'Roll', name: 'Roll Stun', type: 'melee', range: REACH.meleeQuick, damage: 6, cooldown: 1400, cone: 100, color: '#FFC93C', effect: 'stun', emoji: '🌀' },
      // ⚠️ THE SECOND HOMING WEAPON IN THE RACE `SPEED.maxSlow` DOCUMENTS, AND THE ONE
      //   THE SUSHI FIX DOES NOT TRANSFER TO.
      //
      //   🚨 THE REACH FIGURES BELOW ARE PRE-`af35362` AND ARE KEPT ONLY AS THE RECORD OF
      //   WHY THIS WEAPON WAS PRICED AS IT WAS. They read:
      //
      //     > "Effective reach against a fleeing human is 51 wu against a 140 wu press gate
      //     >  (36%); against a fleeing AI 92 wu (66%), so it is worth 1.89x more in a
      //     >  human's hands with no decision differing."
      //
      //   `af35362` (DECISIONS §50b) denominated the retirement budget in the TARGET'S
      //   frame, and this weapon went **48 wu -> 140 wu against a fleeing human** — the
      //   largest reach gain in the roster. Nothing about the weapon changed; it simply
      //   started arriving. So its damage had been set against a delivery of roughly a
      //   third of a press, and at full delivery Burrito measured **+13.3 pp**, the biggest
      //   winner of that commit, and the roster spread doubled (14.2 -> 28.1 pp).
      //
      //   => DEVIATION #13: 5 -> 4 per pellet AND 3000 -> 3600 ms. Sustained output
      //   6.67 -> 4.44 HP/s (-33%), which is about the reciprocal of the reach it gained.
      //   `pellets: 4` is deliberately UNTOUCHED — `src/vfx/weapons/burrito.ts` builds one
      //   distinct silhouette per `pelletColors` slot, so dropping to 3 orphans a topping
      //   form; it measured 1.4 pp better on smart2 range and was refused for that reason.
      //
      //   `sushi.Catch`'s one-token fix (`maxSlow` -> `max`) was STAGED AND MEASURED here
      //   and REFUSED: this is the roster's WIDEST FAN at 55°, and `HOMING_TURN_RATE` is
      //   angular, so at 280 wu/s the outer pellets cannot turn back inside 60 wu. Half
      //   the delivery is lost at 30-60 wu AGAINST A STATIONARY TARGET, and `roster_lab`
      //   reads the buff as **-11.9 pp** to Burrito (asAI 40.0% -> 20.0%). A buff that
      //   makes the character weaker. See `HOMING_TURN_RATE` and DECISIONS §50 — the only
      //   lever that helps this weapon without a close-range cost is the retirement rule,
      //   which lives in `sim.ts` and is priced there rather than guessed at here.
      // ── THE WIND-UP: 1650 ms, AND IT IS THE ONE ROW BOTH SWEEPS AGREE ON ─────
      //
      // A homing volley really is a bearing-free disc of `range + hitRadius`, so
      // `u6_escape`'s 36-bearing sweep returns the SAME 1334 ms as `u5_derive`'s radial one
      // at every separation, and both give `roundUp50(1334 + 300)` = **1650**. That
      // agreement is the cross-check that the new sweep is not simply returning something
      // smaller. Per-press damage is `damage x pellets` = 4 x 4 = **16**, not 4.
      //
      // ⚠️ **AND IT COSTS BURRITO 42.5 pp — to 12.7%, with `asAI` at 0.0%.** At half the
      // value (850 ms) it still costs 30.0. `roster_lab --seeds 32`, paired: aggregate
      // -2.0 pp (inside the ~9 pp floor), PAIRED 50/110 moved in both arms, max 96.9 / 90.6
      // pp, EXACT. 1650 is 46% of this weapon's own 3600 ms cooldown spent mid-cast,
      // against 31% for the shipped Mega. Not applied; 6 rows red in `sim.test.mjs`. See
      // `Weapon.castMs` §(2)-(4).
      {
        key: 'Swarm', name: 'Topping Swarm', type: 'ranged', range: REACH.rangedMax, damage: 4, cooldown: 3600, speed: SPEED.maxSlow, color: '#7CB518', effect: null,
        pellets: 4, spreadDeg: 55, homing: true,
        pelletColors: ['#7CB518', '#E63946', '#FFC93C', '#F4E9DA'],
        pelletEmojis: ['🥬', '🍅', '🧀', '🧅'],
        emoji: '✨',
      },
    ],
    abilities: [
      { emoji: '🌯', name: 'Burrito Disc', desc: 'Throws himself like a flying disc for damage', weapon: 'Disc' },
      // WAS: '...freezes enemies in place for a few seconds' — the second of the two cards
      // that promised more stun than the GLOBAL 2000 ms constant delivers. DECISIONS §81.
      { emoji: '🌀', name: 'Roll Stun', desc: 'Rolls up and freezes enemies in place for a moment', weapon: 'Roll' },
      { emoji: '✨', name: 'Topping Swarm', desc: 'Special: squeezes out all his toppings, which fly everywhere and chase enemies dealing damage - the flying toppings can be destroyed', weapon: 'Swarm' },
    ],
  }),

  egg: defineCharacter({
    id: 'egg', name: 'Egg', emoji: '🥚', rarity: 'Neon',
    stats: { damage: 7, health: 8, speed: 4 }, hasTrail: false,
    // WAS: 'Open eyes with highlights, straight neutral mouth.'
    //   ✅ THE ONLY LINE IN THIS FILE THAT WAS RIGHT, and the reason egg's face is the best in
    //   the cast. It is EXTENDED below, not replaced. Uri's egg reject was about the SHAPE —
    //   "the ears don't make sense, the egg lost the appearance of egg" (DECISIONS §40) — not
    //   about the face. Kept verbatim so it is obvious what the other ten are being raised to.
    face: 'EYES: open eyes with catchlights — sclera, pupil and highlight built as three separate meshes. ⭐ THIS IS THE CAST REFERENCE; the other ten are being brought up to it, so changes here propagate. What it still needs, and there are two things: (a) the sclera must become the BRIGHTEST VALUE ANYWHERE ON THE CHARACTER — measured, even egg has 0% of its eye pixels above 0.85 luma against the reference plates\' 31.1% and 34.1%, because what it has today is a catchlight where a sclera belongs; and (b) THE PUPIL IS CENTRED. `egg.ts` sets it to x = 0, so egg stares dead ahead and has no gaze — offset it horizontally like every other character in this brief. A centred pupil reads dead even when everything else is right, and it is the one element of the standard the cast reference itself does not meet. MOUTH: straight and deadpan — KEEP THE DEADPAN, it is the whole personality and nothing else in the cast has it — but give it an interior value step behind the lip so it reads as an opening. The worried brow creases are correct: an egg has no hair, so worry reads as a raised shell ridge rather than eyebrows, and the asymmetric inner-end lift is what makes it a raised eyebrow instead of two symmetric worry lines. 🚨 SILHOUETTE — THE THING TO ACTUALLY FIX. A clean uncut TRUE OVOID (fuller at the bottom, tapering) is recorded at `egg.ts:206` as "the one thing Egg had going for it in the silhouette test". The lifted lid broke the crown and the flanking shell shards read as EARS, and both were added to signal "egg" while destroying the shape that signalled it better. Restore the ovoid; move any cracking cue onto the surface as a decal rather than into the outline. PERSONALITY: deadpan, stoic, slightly anxious under it.',
    weapons: [
      // `selfLaunch` — *"Launches herself at the enemy"*, and the leap is spent AFTER the
      // swing has already resolved, so it adds nothing to the 84 wu reach. Sustained
      // mobility it buys if Tackle is pressed on cooldown: **42 / 2.2 s = 19.09 wu/s**
      // against Egg's own 79.20 wu/s walk — a 24% add, and 0.41x its own chase speed.
      // See `Weapon.selfLaunch`; the roster-wide bound is `sim.test.mjs` §39(f).
      { key: 'Tackle', name: 'Egg Tackle', type: 'melee', range: REACH.meleeHeavy, damage: 16, cooldown: 2200, cone: 70, color: '#FFF8EA', effect: null, selfLaunch: BODY_LENGTH, emoji: '🥚' },
      // ⚠️ WAS `speed: SPEED.maxDrift` (80 wu/s) — DECISIONS §50a, Uri: *"chick is faster
      // than the egg."* That is a derivable constraint rather than a taste call, and
      // `SPEED.maxSlow` is the SMALLEST rung that satisfies both halves of it: 160 wu/s is
      // 1.52x Egg's own delivered 105.6 and 1.33x the roster's 120 wu/s movement cap, which
      // is also the minimum `rules.ts:projectileMaxAgeMs` needs for the shot to close at
      // all. Two independent constraints, one rung. `sim.test.mjs` §31(g) asserts the
      // derivation, never the number.
      { key: 'Hatch', name: 'Hatch!', type: 'ranged', range: REACH.rangedMax, damage: 4, cooldown: 2600, speed: SPEED.maxSlow, color: '#FFE9A8', effect: null, homing: true, peckHits: 3, peckInterval: 500, emoji: '🐣' },
      { key: 'Shards', name: 'Shell Shards', type: 'ranged', range: REACH.rangedMid, damage: 4, cooldown: 1000, speed: SPEED.mid, color: '#F4E9DA', effect: 'slow', pellets: 3, spreadDeg: 30, emoji: '💥' },
    ],
    abilities: [
      { emoji: '🥚', name: 'Egg Tackle', desc: 'Launches herself at the enemy for big damage - slow to charge up', weapon: 'Tackle' },
      { emoji: '🐣', name: 'Hatch!', desc: 'She cracks open and a chick bursts out, pecking for damage', weapon: 'Hatch' },
      { emoji: '💥', name: 'Shell Shards', desc: 'Broken shell pieces slow enemies and chip away their health', weapon: 'Shards' },
    ],
  }),

  lollipop: defineCharacter({
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
      // ── DEVIATION #13 (2026-08-11): 17 -> 18 and 8000 -> 7000 ms.
      //
      //   Lollipop is the roster's ONLY kit with no `ranged` weapon, so `af35362`'s reach
      //   fix — which made every ranged weapon in the game connect at its own press gate —
      //   was worth exactly nothing to it while ten other kits got better around it. It
      //   fell to LAST on `smart2` (40.3%) with the roster mean pinned at 50.0 by
      //   construction. The repair is put entirely on the SPECIAL rather than on the swing,
      //   for two reasons that are both already stated in `sim.test.mjs` §19:
      //     * §19(a) requires a special to be the biggest press its owner has. Raising the
      //       SWING to 17 measured slightly better on Burrito's chase number but left
      //       Smash and Giant TIED at 17 — and a tie is exactly the defect §19(a) exists
      //       to stop, because both drivers take the first strictly-greatest press value
      //       and the special stops being chosen inside melee range.
      //     * §19(b) caps an undodgeable slam at the biggest DODGEABLE hit in the roster,
      //       which is Water Bottle's Mega Splash at 18. **18 sits exactly on that ceiling
      //       and nothing may go past it** — if Mega Splash ever drops, this must drop with
      //       it, and §19(b) will say so.
      //   Measured (32 seeds x 110 matchups, paired): lollipop 40.3% -> 54.8% on `smart2`
      //   and 37.3% -> 45.8% on `chase`. It is the only change in DEVIATION #13 that moves
      //   the same character the same way on BOTH policies.
      //
      // ── 🚨 THE REDESIGN `DECISIONS §77` AUTHORISES WAS PRICED 2026-08-18 AND REFUSED
      //    ON A NUMBER, AND THE SHAPE PROBLEM IS REAL AND STILL OPEN ────────────
      //
      // §77: *"the 400 wu disc is a choice, not a constraint"*. Three independent readings
      // agree the choice is wrong, and the balance measurement says every fix is too big:
      //
      //   * **The hitbox is undrawable, MEASURED IN PIXELS.** `game/vfx.ts:spawnCastTelegraph`
      //     REFUSES to draw the generic footprint for `giantSlam`: at 400 wu / 360° it is
      //     **259,315 px, 64.0% of the frame, held for the whole wind-up** (`tg_tele.mjs`).
      //     `REACH.ultimateSlam`'s own comment hands that problem to the VFX owner —
      //     *"its warning has to be the screen-filling slam VISUAL"* — and the VFX owner
      //     came back with a number: it *"has no edge on screen and no direction, so it
      //     cannot tell anyone where to run; it just erases the arena."*
      //   * **The art has been drawing a different weapon all along.** `spawnGiantLollipop`
      //     drops a candy of `CHARACTER_HEIGHT * 0.85` (1.785 m = **35.7 wu** radius) offset
      //     `+ CHARACTER_HEIGHT * 0.5` ahead of her (2.835 m = **56.7 wu**), so the prop
      //     covers ground out to **92.4 wu** — one rung above `REACH.meleeHeavy` (84) and
      //     **4.3x short of the 400 wu hitbox**. Hitbox and prop are one rule stated in two
      //     places, and the shipped telegraph marks the SMALL one: its own comment says it
      //     *"points at the object that is about to appear"* and *"UNDER-claims the danger"*.
      //   * **`FAIR_PLAY.radiusUnits` is 199.2 wu** — the disc every supported aspect ratio
      //     is guaranteed to show. 400 is 2.0x it, so half the threatened ground is off
      //     camera BY CONSTRUCTION, which is what makes the tell impossible rather than
      //     merely hard.
      //
      // Both repairs were staged and measured (`roster_lab --seeds 32`, paired, one field
      // per arm, detached worktrees of `a06c0fd`) — lollipop's strength on `smart2`:
      //
      //     range 400 -> 200 (= FAIR_PLAY, no wind-up)     59.2% -> 32.8%   -26.4
      //     range 200 + castMs 2050 (the derived tell)     59.2% ->  1.4%   -57.8
      //
      // ⚠️ Aggregate -1.2 / -1.3 pp, inside the ~9 pp floor. PAIRED 20/110 moved, max 62.5
      // and 100.0 pp — EXACT. So the ability is worth ~26 pp of its owner in AREA alone,
      // and a wind-up on top removes the character. **Shrinking the disc is a redesign the
      // roster cannot absorb unhandled, and pairing it with a wind-up is not a redesign, it
      // is a deletion.** §19(b)'s cap exists because this hit cannot be dodged; the way out
      // is to make the AREA dodgeable and pay the 26 pp back somewhere Uri chooses, which is
      // a roster decision and not this pass's (§77 explicitly withholds it).
      //
      // ⚠️ AND THE CARD IS STILL FALSE EITHER WAY. *"hits the whole map"* is 400 wu on a
      // 2800x2000 arena — 14% of its width — and `ui/screens/characterSelect.ts:73` prints
      // *"Whole map"* off `range >= REACH.ultimateSlam`. A genuinely map-wide effect is one
      // of the three separate projects §77 names, not a constant.
      { key: 'Giant', name: 'Giant Lollipop', type: 'melee', range: REACH.ultimateSlam, damage: 18, cooldown: 7000, cone: 360, color: '#E63946', effect: 'stun', giantSlam: true, emoji: '🍭' },
    ],
    abilities: [
      { emoji: '🔨', name: 'Lollipop Smash', desc: 'Swings herself like a hammer for heavy damage', weapon: 'Smash' },
      // WAS: 'Grows huge and hits the whole map, making everyone dizzy'.
      //
      // *"hits the whole map"* was **400 wu against a 3440.93 wu arena diagonal** — 14% of
      // the map's width. Both ways of closing it were considered and the NUMBER is the
      // wrong one to move: typing the diagonal in here would make this a single melee that
      // reaches every fighter everywhere, the exact opposite of `DECISIONS §80`, where Uri
      // answered *"you should be able to dodge a super"* and named **reducing** the effect
      // radius as lever 1. The comment above prices the shrink at **−26.4 pp paired** and
      // says plainly it is a redesign the roster cannot absorb unhandled — out of this
      // pass's reach, and parked in DECISIONS §81 rather than guessed at.
      //
      // So the CARD moved, and it moved to a RELATIVE claim on purpose: 400 wu is the
      // largest `range` in the roster by 2.86x (next is `REACH.rangedMax` 140), and
      // *"the widest area in the game"* survives §80's lever 1 being taken later while
      // still going red the moment some other weapon out-reaches this one.
      // ⚠️ WAS, and it was true for about an hour: *"making everyone dizzy" is UNCHANGED and
      // is STILL FALSE — `multi-target` is a MISSING MECHANIC (measured: one press damages
      // exactly 1 fighter)"*. **`3483d23` BUILT IT** — a melee swing now resolves against
      // every opponent inside `cone`/`range` instead of `nearestLivingOpponent` — and the
      // census went **1 victim -> 5**. So the whole card is TRUE today.
      // 🚨 That is exactly why the phrase was not reworded away when the reach claim beside
      // it was fixed: §74/§77 chose BUILD over reword for the MISSING class, and deleting
      // the sentence would have retired the roadmap item three hours before it landed.
      { emoji: '💫', name: 'Giant Lollipop', desc: 'Grows huge and slams the widest area in the game, making everyone dizzy', weapon: 'Giant' },
    ],
  }),

  pizza: defineCharacter({
    id: 'pizza', name: 'Pizza', emoji: '🍕', rarity: 'Neon',
    // ⚠️ `damage` WAS 4 AND IS NOW 5, AND IT WAS NOT HAND-EDITED. It is DERIVED
    // (`damageStatFor`) from the kit below, whose Tomato Splat went 6 -> 7 in
    // DEVIATION #13: `kitDps` 15.63 -> 16.74 HP/s, and 16.74 / 3.5 rounds to 5.
    // `sim.test.mjs` §22(f) fails if this line and the weapon table ever disagree.
    stats: { damage: 5, health: 10, speed: 5 }, hasTrail: false,
    // WAS: 'Closed eyes, smiling. Triangular slice with pepperoni and a crust base.'
    //   Uri: "face is TERRIBLE" (DECISIONS §42) — the second-harshest verdict in the cast, and
    //   the second character specified with CLOSED eyes. The correlation with the closed-eye
    //   family is the whole finding. Kept because the triangle clause still governs the model.
    face: 'EYES: OPEN. The closed eyes are the entirety of Uri\'s "face is terrible" and they are removed — this was the second-worst-rated face in the cast and the second one specified shut. White sclera as the brightest value on the character (the slice is tan-on-tan, so the eye whites will be the only real value anchor on it), dark pupils offset for gaze, a catchlight each, and the old closed-smiling arc demoted to the upper lash line. MOUTH: a wide confident grin with a dark throat and a visible lower lip. SILHOUETTE: a triangular slice with pepperoni and a crust base — the triangle is the protected landmark here, unlike the rest of the cast\'s shapes, because it is the whole read at gameplay distance. ⚠️ But the melted cheese strands must not hang as two points either side of the head — Uri named that construction on four other characters and it reads as ears whatever it is made of. Drape them across the FRONT of the slice or run them continuously round the edge. ⚠️ And watch the tan-on-tan trap this file already records: slice, torso and limbs were literally the same constant, putting head, arms, legs and body inside a third of a stop. The face is where the missing value range gets paid back first. PERSONALITY: broad, loud, confident tank.',
    weapons: [
      { key: 'Dough', name: 'Dough Balls', type: 'ranged', range: REACH.rangedLong, damage: 5, cooldown: 850, speed: SPEED.long, color: '#FFE9A8', effect: 'slow', emoji: '⚪' },
      // ── DEVIATION #13 (2026-08-11): 6 -> 7, and it moves the CARD BAR 4 -> 5.
      //
      //   Pizza is the roster's designated wall — the biggest pool (140) carrying the
      //   weakest kit — and `§22(h)`'s "health COMPENSATES the kit" is the design rule that
      //   makes that legitimate. `af35362` broke the compensation from the other side: it
      //   made every ranged kit in the game land at its own press gate, and Pizza's three
      //   short weapons gained least of anyone's, so it fell to 39.5% on `smart2` while the
      //   mean stayed pinned at 50.0. One point on ONE of its three weapons was the finest
      //   step available and it was still worth **+9.2 pp** — the card's integer scale
      //   cannot be tuned finer than this, which is `HEALTH_PER_STAT`'s lesson on the other
      //   axis. Tomato Splat rather than Dough Balls because Dough measured **+19.4 pp** at
      //   the same +1, i.e. more than twice the gap that needed closing.
      { key: 'Tomato', name: 'Tomato Splat', type: 'ranged', range: REACH.rangedMid, damage: 7, cooldown: 900, speed: SPEED.mid, color: '#E63946', effect: null, splatter: true, emoji: '🍅' },
      { key: 'Cheese', name: 'Cheese Blind', type: 'ranged', range: REACH.rangedClose, damage: 4, cooldown: 1300, speed: SPEED.close, color: '#FFD873', effect: 'stun', emoji: '🧀' },
    ],
    abilities: [
      { emoji: '⚪', name: 'Dough Balls', desc: 'Throws dough balls that slow enemies down', weapon: 'Dough' },
      { emoji: '🍅', name: 'Tomato Splat', desc: 'Tomatoes stick to the floor, damaging and slowing anyone who steps on them', weapon: 'Tomato' },
      { emoji: '🧀', name: 'Cheese Blind', desc: "Cheese sticks to an enemy's face and blocks their vision until someone hits them", weapon: 'Cheese' },
    ],
  }),

  sushi: defineCharacter({
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
      // `lure` — *"Seaweed lures EVERY enemy toward it"*, so this pulls every living
      // opponent toward the bait, not the fighter it struck. Half a body per hit on a
      // 1,000 ms cooldown = **21.00 wu/s** of sustained pull, against the roster's SLOWEST
      // walk of 79.20 wu/s: a fighter running from the bait still nets 58 wu/s away. That
      // margin is the `DECISIONS §80` argument for a PULL, whose sign is the opposite of a
      // knockback's — see `movement.ts:displaceFighter` property 3.
      { key: 'Seaweed', name: 'Seaweed Bait', type: 'ranged', range: REACH.rangedMid, damage: 5, cooldown: 1000, speed: SPEED.mid, color: '#7CB518', effect: 'slow', lure: BODY_LENGTH / 2, emoji: '🌿' },
      { key: 'Fish', name: 'Fish Pile', type: 'melee', range: REACH.meleeStrong, damage: 6, cooldown: 1200, cone: 150, color: '#F4A261', effect: null, emoji: '🐟' },
      // ── AUTHORISED DEVIATION #12 (2026-08-10): SUSHI — `speed` SPEED.maxSlow -> SPEED.max
      //    (160 -> 280 wu/s). Not a strength tune. At `maxSlow` this homing shot EXPIRED IN
      //    FLIGHT against a fleeing human and ARRIVED against a fleeing AI, because
      //    `stepProjectiles` retires on cumulative path length and PLAYER_SPEED (120) is
      //    1.71x AI_CHASE_SPEED (70). Both roles press it 2.02x/match from the same
      //    separation for the same authored 27; the player collected 26.48, the AI 12.65.
      //    Same rung, same reach, normal flight time instead of slow. See `SPEED.maxSlow`.
      // ── THE WIND-UP: 1100 ms, AND ITS WORST SEPARATION IS NOT THE NEAREST ────
      //
      // The only non-monotone escape curve in the six. `u6_escape` (36 bearings x 7
      // separations): the cheapest dodge at 20 wu is to run THROUGH the caster —
      // bearing 180°, **384 ms** — because `SPEED.max` pellets that overshoot cannot turn
      // back inside `HOMING_TURN_RATE`. The window therefore PEAKS at 80 wu (**784 ms**),
      // not at contact, and the rule returns **1100** rather than `u5_derive`'s radial 1850.
      // A tool that sampled one separation would have priced this weapon wrong in the
      // opposite direction from `taco.Double`. Per-press damage is 9 x 3 pellets = **27**.
      //
      // ⚠️ **AND IT COSTS SUSHI 44.1 pp — to 10.0%.** At half (550 ms) it still costs 27.8.
      // `roster_lab --seeds 32`, paired: aggregate -2.0 pp (inside the ~9 pp floor), PAIRED
      // 50/110 moved in both arms, max 96.9 / 90.6 pp, EXACT. Not applied; 6 rows red in
      // `sim.test.mjs`.
      // `lure` — *"pulling enemies"*. ⚠️ THREE HOMING PELLETS, SO ONE PRESS CAN APPLY THIS
      // THREE TIMES, and that is exactly why `movement.ts:MAX_PUSH_DISTANCE` caps ACCUMULATED
      // displacement at one body rather than capping each application: 3 x 42 would be a
      // launch, and the cap makes it 42 however many pellets connect. 42 / 3.2 s = 13.13 wu/s.
      { key: 'Catch', name: 'Big Catch', type: 'ranged', range: REACH.rangedMax, damage: 9, cooldown: 3200, speed: SPEED.max, color: '#FF8C42', effect: null, pellets: 3, spreadDeg: 40, homing: true, lure: BODY_LENGTH, emoji: '🐡' },
    ],
    abilities: [
      { emoji: '🍚', name: 'Rice Spray', desc: 'Throws a spray of rice grains - each one chips away a little health', weapon: 'Rice' },
      { emoji: '🌿', name: 'Seaweed Bait', desc: 'Seaweed lures every enemy toward it while he shoots them', weapon: 'Seaweed' },
      { emoji: '🐟', name: 'Fish Pile', desc: 'Turns into a pile of fish that attack for small damage', weapon: 'Fish' },
      // WAS: '...the seaweed scatters across the map, pulling enemies everywhere'.
      // *"scatters across the map"* was **140 wu** (`REACH.rangedMax`) against a 3440.93 wu
      // arena diagonal — 5% of the map's width, and the most over-claimed span in the cast.
      // Replaced with what the record actually does: `pellets: 3, spreadDeg: 40`, i.e. a
      // fan. ONE span changed; the rest of this line is byte-identical on purpose, because
      // `projectile-grows`, `lure` and `multi-target` are MISSING MECHANICS on the §77
      // roadmap and rewording them away would retire them silently. DECISIONS §81.
      { emoji: '🐡', name: 'Big Catch', desc: 'Special: throws seaweed with fish - the fish grow huge and the seaweed scatters in a fan, pulling enemies everywhere', weapon: 'Catch' },
    ],
  }),

  soup: defineCharacter({
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
      { key: 'Splash', name: 'Soup Splash', type: 'ranged', range: REACH.rangedClose, damage: 3, cooldown: 750, speed: SPEED.closeFast, color: '#CC9F0D', effect: null, pellets: 3, spreadDeg: 25, emoji: '💦' },
      { key: 'Noodle', name: 'Noodle Toss', type: 'ranged', range: REACH.rangedLong, damage: 5, cooldown: 1000, speed: SPEED.long, color: '#FFE9A8', effect: 'slow', emoji: '🍜' },
      // ── 🚨 `castMs: 1100` WAS DERIVED, IMPLEMENTED, MEASURED AND REVERTED. DO NOT RE-ADD IT ──
      //
      // This is the ONE remaining special whose geometry says yes. It is `melee` at
      // `REACH.meleeHeavy` — byte-for-byte the shape `waterbottle.Mega` is — so
      // `Weapon.castMs`'s roster rule returns the same 1100, and that is a derivation rather
      // than a copy: `tools/tmp/u5_derive.mjs` drives the real `stepMatch` with real
      // `MatchInput` and finds the escape boundary at **790.39 ms** (slowest human) /
      // **683.67 ms** (fastest), inside one tick of the 795.45 closed form. Two weapons land
      // on one number because they have one geometry.
      //
      // **AND THE BALANCE MEASUREMENT KILLED IT.** `roster_lab --seeds 32`, 3520 matches per
      // policy, paired on identical seeds against a detached worktree of `2d4840e`:
      //
      //     policy   soup strength      Δ        roster sd        settled     paired
      //     smart2   50.3% ->  0.6%   -49.7   11.9 -> 18.9 pp   30 -> 43    20/110 moved
      //     chase    73.9% ->  2.8%   -71.1   19.1 -> 21.8 pp   48 -> 50    19/110 moved
      //
      // ⚠️ THE AGGREGATE IS THE WRONG NUMBER AND IT SAYS THE WRONG THING — smart2 -3.2 pp and
      // chase +0.9 pp are both inside the ~9 pp floor while a character LEFT THE GAME. Read
      // the paired column; they are never added.
      //
      // 0.6% is not "out of band", it is a character that loses every match, and on `chase`
      // Soup was the roster's STRONGEST at 73.9%. `16b635d` shipped Mega's -35.0 pp because
      // the SYSTEM was the deliverable and had to land somewhere; here the system already
      // exists and only a value is being applied, so shipping a second character into the
      // floor buys nothing that this comment does not.
      //
      // ⚠️ AND THE CAUSE IS NOT PROVEN, WHICH IS WHY NOTHING WAS TUNED. Dump is ~5.3 HP/s of a
      // kit that also carries 12 HP/s of Splash, so a straight throughput loss does not
      // explain -49.7 pp. `csx_castcost --seeds 8` says only **18.4% of RESOLVED Dumps land**
      // against Mega's 64.1% (by subtraction on one corpus: 383 opened, 282 resolved, 52
      // landed — contaminated only by the 16 soup-vs-waterbottle matches where both casts are
      // live). The standing hypothesis is `ai.ts:pressValue` ranking a 16 above a 9 at melee
      // range and so spending the window on a whiff instead of the pokes — but `3f28b39`
      // REFUTED that exact story for Mega by ablation (suppressing the cast was WORSE), so it
      // is a hypothesis and not a finding. The ablation for Soup was not run.
      //
      // → What this weapon needs is what `3f28b39` already concluded for Mega: **price the
      //   ULTIMATE, not the telegraph.** That is `DECISIONS §68`'s pass and it is not
      //   authorised here. Shortening `castMs` to buy the win rate back spends the one
      //   property the feature exists for, and `cooldown` is barred outright (`lastUsed` is
      //   stamped at the PRESS, so throughput never moved).
      //
      // ── 🚨 2026-08-18, `DECISIONS §77`: THE ABLATION ABOVE HAS NOW BEEN RUN, AND IT
      //    ANSWERS THE QUESTION IN THE DIRECTION NOBODY PROPOSED ────────────────
      //
      // Four arms, `roster_lab --seeds 32`, 3,520 paired matches each, every arm a detached
      // worktree of `a06c0fd` differing by ONE field. Soup's strength:
      //
      //     arm                                              smart2            chase
      //     baseline (no wind-up)                            47.2%             73.4%
      //     castMs 150   — below BOTH cone escape windows    33.0%  -14.2      47.0%  -26.4
      //     castMs 600   — the CORRECTED derivation           7.0%  -40.2      17.2%  -56.3
      //     castMs 1100  — the value `edadf78` reverted       0.2%  -47.0       3.3%  -70.2
      //     Dump REMOVED from play (`cooldown` 999999)       13.1%  -34.1      25.5%  -47.9
      //
      // ✅ **THE 1100 ROW REPRODUCES THE PUBLISHED REVERT**, which is what says this harness
      // is measuring the same thing `edadf78` did: it recorded -49.7 / -71.1 pp to 0.6% /
      // 2.8% against a worktree of `2d4840e`; this reads -47.0 / -70.2 to 0.2% / 3.3%
      // against `a06c0fd`. Different baseline, same weapon, same answer.
      //
      // ⚠️ Aggregate moved -0.8 to -2.7 pp across those arms, INSIDE the ~9 pp floor, while
      // a character left the game — the same trap this block already names. Read the paired
      // column: 18-19 of 110 matchups moved, max 59.4-100.0 pp, EXACT on identical seeds.
      // And containment is measured rather than assumed: in every single-weapon arm, **0 of
      // the 90 matchups that do not involve the changed character moved on either policy**,
      // which is `Weapon.castMs`'s "weapons with no `castMs` stay bit-identical" checked on
      // `matchupRates` rather than argued.
      //
      // 🚨 **A TELEGRAPHED DUMP IS WORSE THAN NO DUMP AT ALL.** 7.0% with the corrected
      // wind-up against 13.1% with the weapon deleted. So the standing hypothesis in the
      // block above — `pressValue` spending the window on a whiff — is REFUTED by the same
      // test that refuted it for Mega, and for the same reason: if the AI were merely
      // mis-choosing, taking the choice away would help, and it helps by 6.1 pp. The cost
      // is not the choice and it is not the dodge.
      //
      // ⚠️ **AND IT IS NOT ANY ONE SIDE-EFFECT OF THE CAST EITHER — THREE MORE ABLATIONS
      // SAY SO.** Against the 7.0% this weapon reaches at `castMs 600`, removing the attack
      // lockout gives 10.6%, removing the frozen aim 8.0%, removing the movement root
      // 10.0%. **Every one is still below the 13.1% of not having the weapon**, so no
      // single term explains Dump the way the lockout explains Mega (`Weapon.castMs` §(3)).
      // What is left is the DELAY itself: `castMs 150` buys no dodge whatsoever — the cone
      // escape is 267 ms slowest / 234 fastest, measured by `u6_escape` — and still costs
      // **14.2 pp**, because a press whose effect arrives 150 ms late lands on ground a
      // moving target has already left.
      //
      // Soup is a 9-health tank with `speed: 4`, the roster's slowest, and its kit is one
      // melee dump plus two short pokes — Dump is 34.1 of its 47.2 pp, i.e. 72% of the
      // character. The honest answer to *"can a telegraphed melee dump work on a slow
      // character"* is **no, not on a kit this concentrated**: a delay costs a fraction of
      // the press, and here the press is nearly the whole character. Nothing is changed:
      // the corrected 600 is recorded so the next pass does not re-derive it, and it is not
      // applied because it measures worse than deleting the weapon.
      { key: 'Dump', name: 'Soup Dump', type: 'melee', range: REACH.meleeHeavy, damage: 16, cooldown: 3000, cone: 90, color: '#CC9F0D', effect: 'slow', emoji: '🌊' },
    ],
    abilities: [
      { emoji: '💦', name: 'Soup Splash', desc: 'Throws his soup liquid - each splash chips away a little health', weapon: 'Splash' },
      { emoji: '🍜', name: 'Noodle Toss', desc: 'Throws noodles that slow enemies down', weapon: 'Noodle' },
      { emoji: '🌊', name: 'Soup Dump', desc: 'Special: tips himself over onto an enemy, pouring all his soup and noodles - big damage and a heavy slow', weapon: 'Dump' },
    ],
  }),

  waterbottle: defineCharacter({
    id: 'waterbottle', name: 'Water Bottle', emoji: '💧', rarity: 'Legendary',
    stats: { damage: 8, health: 6, speed: 6 }, hasTrail: false,
    // WAS: 'Eyes floating above the cap, big smile. Translucent blue bottle with a darker cap.'
    //   §42 flagged "eyes floating above the cap" as a predicted reject before Uri sent one: it
    //   is the same detached-feature construction he rejected on taco ("the face floats completely
    //   outside the shell" read as a second head). A spec that says FLOATING will get floating.
    //   Kept because the translucency clauses still govern the model.
    face: 'EYES ON THE BOTTLE, NEVER FLOATING ABOVE THE CAP. Detached features were the old spec and floating is a defect already rejected on taco — a face with nothing under it reads as a separate object. Set the eyes on the SHOULDER of the bottle where the shell curves, sharing one tangent frame, so they sit on a surface. Open eyes, three elements: a white sclera as the brightest value on the character, a dark pupil offset for gaze, an explicit catchlight. ⚠️ THE FACE MUST BE OPAQUE AND MOUNTED ON THE OUTER SURFACE. This is the one genuinely transmissive character in the cast; a feature placed inside or on the inner wall gets eaten by the transmission pass, and the sclera in particular will vanish into whatever is behind the bottle. MOUTH: keep the big smile — it is the most extrovert face in the cast and worth protecting — with a dark throat behind the lip. SILHOUETTE: translucent blue bottle, darker cap, water fill kept NON-transmissive (an opaque glossy liquid seen through a transmissive shell; nesting two transmissive materials makes the transmission snapshot incoherent and one of them flattens). PERSONALITY: cheerful, splashy, unbothered.',
    // ── 🚨 §79's KIT TRIM WAS MEASURED AND IS **NOT APPLIED**. THE PRICE ENDS THE
    //    CHARACTER, AND THE PREMISE UNDER IT IS FALSIFIED BY THE ROSTER. 2026-08-18. ──
    //
    // `DECISIONS §79` reasoned: Water Bottle carries slow on three of four weapons plus a
    // stun, *"that composition is what turns a telegraph into theatre"*, so trim the kit
    // until a 1100 ms wind-up is survivable. Acceptance test `tools/tmp/lk_dodge.mjs`: the
    // `open` arm must ESCAPE. Every arm below is a detached worktree with the named fields
    // changed and READ BACK THROUGH THE MODULE LOADER (`tools/tmp/kt_arm.mjs`) — `u6_arm`
    // could not stage these, because its verification is `castMs`-only and an `effect` edit
    // leaves that map bit-identical, so a patch that silently missed would certify green.
    //
    // ── (1) THE PREMISE IS WRONG: COMPOSITION IS NOT THE VARIABLE ──────────
    //
    // `tools/tmp/kt_census.mjs`, over the whole roster: **9 of 11 characters would lock a
    // 1100 ms wind-up with their CASTLESS KIT ALONE**, and four of those nine (egg, sushi,
    // soup, hotdog) hold exactly **ONE** slow weapon. Only donut and taco — the two with
    // ZERO CC — would not. So the answer to §79's own question, *"how many CC weapons may
    // one character hold?"*, is **zero**, and Water Bottle's three is not what makes it
    // special. `SLOW_DURATION_MS` is 2500 against a 1100 ms cast, so the FIRST application
    // covers the whole wind-up and the second adds nothing (`statusReadyAt` refuses it).
    // Measured, not argued: dropping TWO of the three CC weapons moves the radial escape by
    // **0.00 wu** and the bearing coverage by **0 of 36**.
    //
    // ── (2) THE STUN IS THE WHOLE MECHANISM, AND IT DEFEATS EVERY BEARING ──
    //
    // A stun is movement locked to zero, so no run direction helps. `kt_bearing.mjs` sweeps
    // 36 bearings on the same fixture (`lk_dodge` drives only bearing 0, which §78 measured
    // as the MOST expensive escape — 601 ms radial against 134 ms angular):
    //
    //     arm                          radial sep   radial    bearings escaping
    //     baseline (shipped)                20.36      HIT      0 of 36   <- no bearing works
    //     drop Spray(slow) only             21.33      HIT      0 of 36
    //     drop Cap(slow) only               20.36      HIT      0 of 36
    //     drop Glass(STUN) only             71.84      HIT     23 of 36   <- counterplay returns
    //     Glass 'stun' -> 'slow'            71.84      HIT     23 of 36   <- IDENTICAL to removing it
    //     drop all three                   135.73  ESCAPED     36 of 36
    //
    // Downgrading the stun to a slow measures **identically** to deleting it, because the
    // surviving slows already cover the window — so "weaken rather than remove" is not a
    // third option here, it is the same option.
    //
    // ── (3) THE PRICE. `roster_lab --seeds 32`, 3,520 paired matches per policy ──
    //
    //     arm                                        wb smart2    Δ      roster range
    //     baseline 48c8166                              26.6%     —         37.0 pp
    //     drop Glass(stun) only                         11.1%  -15.5        52.7 pp
    //     Glass 'stun' -> 'slow'                        10.9%  -15.7        52.8 pp
    //     drop Glass + Mega.castMs 1100 -> 1400         12.8%  -13.8        50.9 pp   ESCAPES
    //     drop ALL THREE effects (§79 as written)        5.2%  -21.4        58.6 pp   ESCAPES
    //     drop Glass + Mega.range 84 -> 70               3.8%  -22.8        59.5 pp   ESCAPES
    //     drop Glass + Mega.range 84 -> 58               2.7%  -23.9        61.2 pp   ESCAPES
    //
    // ⚠️ The aggregate floor is ~9 pp, so every row above clears it; the 5.2 -> 12.8 gap
    // between the two cheapest ESCAPING arms is 7.6 pp and does **NOT**. Separately, and
    // EXACTLY: **0 of 90 matchups not involving Water Bottle moved in any arm** — the
    // change is confined to one character, which is what `§77`'s "do not re-tune the roster"
    // asks for. (`kt_paired.mjs`; and note `matchupRates` is keyed `PLAYER>ENEMY`, so
    // averaging a character's 20 keys cancels the sign to ~0 and hides a 21 pp move.)
    //
    // ── (4) THE ONE CONSTRUCTIVE RESULT, AND IT REVERSES §78's DIRECTION ───
    //
    // A **LONGER** wind-up is more dodgeable, not less: the runner escapes iff it clears the
    // reach BEFORE the cast resolves. Against a one-slow kit the radial clear time is
    // `esc/mult` = **1347 ms**, and the sim crosses exactly there — `castMs` 1300 HIT,
    // 1350 ESCAPED. So `drop Glass(stun)` + `castMs 1100 -> 1400` reaches §79's bar
    // touching ONE weapon's effect, and the lengthening is **FREE in win rate** (11.1% ->
    // 12.8%, inside the floor). The entire −15.5 pp is the stun; the wind-up buys the
    // radial case for nothing. ⚠️ **`§78` wanted 1100 -> 600 for +16.1 pp — that was
    // measured with the stun still live, where no cast length works at all** (controls at
    // 1400 / 1800 / 2200 all HIT, 0 of 36 bearings, because the 2000 ms stun outlasts them).
    //
    // ── (5) WHY NOTHING IS APPLIED ────────────────────────────────────────
    //
    //   * Every arm above turns rows RED in `src/game/sim.test.mjs`, which is not this
    //     pass's file: at minimum §17(d)'s hard-coded CC census at `sim.test.mjs:1699`
    //     (*"the roster still has exactly the 4-of-5 stun and 8-of-10 slow cooldown
    //     overlaps"*) — it counts `effect` across the whole roster, so **any** CC edit on
    //     **any** character moves it, by design — and for any
    //     escaping arm §33(p.3)'s **⚠️ THE PRICE** row, which asserts `open.dealt ===
    //     MEGA.damage` — the exact logical NEGATION of §79's acceptance test. That row's own
    //     comment anticipates this: *"a future change that made it get away again would be a
    //     real change to this feature and must show up here."* It must be REVERSED, keeping
    //     the old wording above it, by whoever owns that file.
    //   * The reach-cut arms are also FRAGILE against a decision that is already answered:
    //     at `§75(b)`'s `PLAYER_SPEED` 0.09 the runner is slower, and `Mega.range 70` flips
    //     back to HIT while `range 58` survives by **0.33 wu**. `drop all three` survives at
    //     both speeds (135.73 / 106.25 wu).
    //   * Removing an `effect` makes this character's `abilities[]` blurbs FALSE — *"slows
    //     enemies down a lot"*, *"freeze enemies"*, *"enemies slip when it hits"*. Any trim
    //     must rewrite them in the same edit or it ships the §74 false-card defect.
    //
    // **§79 permits this outcome explicitly** — *"if Water Bottle ends up unplayable, that
    // is a REPORT, and the honest answer may be that it needs a different super rather than
    // a smaller kit."* At 26.6% it is already the roster's weakest; −15.5 pp is the cheapest
    // counterplay this kit sells, and it is a redesign question, not a tuning one.
    //
    // ── 🚨 §80's THREE LEVERS WERE SWEPT AND PRICED 2026-08-18 AND NOTHING IS APPLIED.
    //    THE DODGEABLE REGION IS **NOT EMPTY** — AND EVERY POINT IN IT COSTS THIS
    //    CHARACTER 16–24 pp ON THE SEAT A HUMAN PLAYS. ─────────────────────────
    //
    // `DECISIONS §80`, Uri: *"You should be able to dodge a super. Now that the map is
    // bigger, we can do a few things: 1. reduce the effect radius of the super. 2. increase
    // the cooldown time, reduce the stun time."* Coverage is `kt_bearing`'s 36-bearing
    // sweep on `lk_dodge`'s fixture (sep 20, slowest runner); the acceptance bar §80 states
    // is that **`lk_dodge`'s `open` arm ESCAPES**, i.e. the RADIAL bearing, which §78
    // measured as the most expensive one. Baseline reproduced at **0 of 36**.
    //
    // ── (1) LEVER 1 IS INERT ACROSS THE WHOLE STUN AXIS, NOT MERELY BEHIND THE SHIPPED
    //        STUN — which is a wider claim than `eff6390`'s search made, and it is the
    //        plane that search never swept (it moved radius only at stun 2000) ───
    //
    //     bearings escaping of 36        Mega.range  84    70    58    42
    //     STUN_DURATION_MS 2000 (shipped)             -     -     -     -
    //                      1600 / 1400 / 1100 / 900   -     -     -     -
    //                       700                      17    17    17    17
    //                       500                      19    19    19    32
    //
    // **Halving the radius changes NOTHING at six of the seven stun levels**, because the
    // runner's separation at resolve (20.36 wu stunned, 39.37 at stun 700) is already below
    // every radius worth shipping. Radius is not a dodge lever at any stun this roster can
    // wear; it becomes one only at stun 500 AND range 42, which is half a body-check.
    //
    // ── (2) THE ARMS THAT DO REACH THE BAR, AND THE TWO FACTS THE SEARCH DID NOT MEASURE ──
    //
    // `DECISIONS §75(b)` — **ANSWERED and NOT YET APPLIED** — takes `PLAYER_SPEED` 0.12 →
    // 0.09. A dodge that exists only at today's speed is a dodge that a decision already on
    // the books silently deletes. And a telegraph answerable at 75–95% elapsed is `§77`'s
    // *"a super nobody presses"*, which is why the reaction deadline is measured at all
    // (`tools/tmp/dl_land.mjs`, new; 6/6, known-bad = the same stationary target outside the
    // reach must NOT be hit, so the control cannot pass by measuring nothing).
    //
    //     arm                            0.12 shipped   0.09 §75(b)   radial reaction deadline
    //     baseline                        0/36  HIT      —            never
    //     drop Glass(stun)               23/36  HIT      —            never
    //       + Mega.castMs 1500           36/36  ESC     23/36  HIT     142 ms   ( 9% of cast)
    //       + Mega.castMs 1800           36/36  ESC     26/36  ESC     440 ms   (24%)
    //     Mega.castMs 3000  (the search) 36/36  ESC     23/36  HIT    2239 ms   (75%)
    //     Mega.castMs 3400                —           36/36  ESC       —        (97% of cooldown)
    //     STUN 400 + SLOW 400 (global)   36/36  ESC     23/36  HIT     480 ms   (44%)
    //
    // 🔴 **`eff6390`'s recommended point, `Mega.castMs 3000`, FAILS §80's own acceptance
    // test under §75(b)** — the radial bearing goes back to HIT — **and at 0.12 it is
    // already a dead button**: the target may ignore the telegraph until 2239 ms of 3000
    // (75%) radially and 2757–2840 ms (92–95%) at every other bearing and still get away.
    // Making the full kit robust needs `castMs` **3400 = 97% of its own cooldown**, and
    // `§77` flagged lollipop's 59% as a problem. **The only arm that clears the bar at BOTH
    // speeds is the kit trim at `castMs` 1800** — and it is the most expensive arm measured.
    //
    // ── (3) THE PRICE. `roster_lab --seeds 32`, 3,520 paired matches per policy, driver
    //        rev 5 (`c441ac2`), `smart2`. Base wb 26.6% aggregate / 32.2% player seat ───
    //
    // ⚠️ **AGGREGATE AND PLAYER SEAT MOVE DIFFERENT AMOUNTS AND THE AGGREGATE IS THE
    // FLATTERING ONE** — `roster_lab`'s strength averages both seats, and this character's
    // ENEMY seat RISES in every arm below (79.1% → 84.7–95.3%). A human only ever plays the
    // player seat.
    //
    //     arm                       wb agg    Δagg   wb seat   Δseat   range    non-wb moved
    //     drop Glass(stun)           11.1%   -15.5     17.5%   -14.7   52.7 pp     0 of 90
    //       + Mega.castMs 1500       12.7%   -13.9     15.9%   -16.3   51.2 pp     0 of 90
    //       + Mega.castMs 1800        8.9%   -17.7      8.1%   -24.1   55.0 pp     0 of 90
    //     Mega.castMs 3000           13.1%   -13.4     10.9%   -21.3   50.8 pp     0 of 90
    //     STUN 400 + SLOW 400        11.4%   -15.2     15.6%   -16.6   68.3 pp    77 of 90
    //
    // The per-weapon arms are **CONFINED** — 0 of 90 matchups not involving this character
    // move, `§77`'s property, and that includes the kit arms, which the search priced only
    // for the `castMs` ones. The global arm is not: it moves 77 of 90 and takes **three
    // other characters past the ~9 pp aggregate floor** (hamburger −21.1, donut +23.4,
    // egg +9.2). ⚠️ `drop Glass(stun)` reproduces §79's rev-4 −15.5 pp **to the digit under
    // rev 5**, so that one figure was not role-dependent after all — but `castMs` 1800 on
    // top of it costs a further −9.4 on the seat while the aggregate says −2.2, so §79's
    // *"the lengthening is FREE in win rate"* is true at 1400 and false by 1800.
    //
    // ── (4) THE CONTROL: EVERY ARM STILL LANDS ON A TARGET THAT DOES NOT RUN ────
    //
    // 18 of 18 damage on all five arms, at every starting separation from 5 to 80 wu. So
    // none of these is refused for being a whiffing button; they are refused on price.
    // ⚠️ Separately, and pre-existing on the SHIPPED tree: at separation **exactly 0** the
    // slam deals 0 — degenerate cone geometry in `deliverWeapon`, unchanged by every arm
    // here, measure-zero, and not this file's to fix.
    //
    // ── (5) WHY NOTHING IS APPLIED, AND WHAT WOULD CHANGE THE ANSWER ────────────
    //
    //   * Every point that meets the bar puts the roster's already-weakest character at
    //     **8–16% on the player seat** and widens the roster range from 37.0 pp to 51–68.
    //     `§79` refused at −15.5 (`f3bdeaf`); every arm here is at least that expensive.
    //   * **`§80`'s lever 2 cannot pay it back.** Cooldown: `eff6390` measured `Mega.damage`
    //     18 → 34 (+89%) buying **+0.3 pp** and a longer cooldown COSTING 0.6. And damage is
    //     not even confined: `sim.test.mjs` §19(b) caps the roster's undodgeable slam at
    //     `dodgeableMax`, whose **unique argmax is this weapon at 18** — `lollipop.Giant`
    //     sits exactly on it, so raising `Mega.damage` hands Giant headroom and LOWERING it
    //     turns §19(b) red. Lever 2 is confined only while it does nothing.
    //   * 🚨 **And §19(b)'s justification is falsified by §80's own baseline**: it caps the
    //     undodgeable slam at *"the biggest **DODGEABLE** hit in the roster"* — and that hit
    //     is `Mega`, measured **undodgeable at 0 of 36 bearings**. The anchor of the
    //     undodgeable ceiling is itself undodgeable. Nothing is red today; the reasoning is.
    //   * The `sim.test.mjs` reversals §80 asks for are CONTINGENT on a behavioural change
    //     and are correctly NOT made: §33(p.3)'s *"⚠️ THE PRICE"* row asserts `open.dealt
    //     === MEGA.damage`, which remains TRUE while nothing lands. Measured red-row counts
    //     if one ever does: `castMs 3000` reds **4**, `drop Glass + castMs 1800` reds **7**
    //     (§17(d)'s roster CC census and §33(p.3)'s status-free-carve-out row are the two
    //     the kit route adds, and both are genuine reversals, not breakage).
    //
    // **What would change the answer is a mechanism, not a constant.** Every zero in (1) is
    // the same fact — *the target is crowd-controlled while somebody is casting* — and every
    // constant that fixes it also removes that CC from normal play, which is where the
    // 16–24 pp lives. A rule that suppresses CC only on a fighter inside a cast's threat
    // window buys the dodge without touching the kit anywhere else; that is `combat.ts`, and
    // it is a design question for Uri rather than a tuning point.
    weapons: [
      // Water Bottle is the only four-weapon fighter with three ranged slots, so
      // Spray and Glass each drop a rung to keep all four reaches distinct.
      { key: 'Spray', name: 'Water Spray', type: 'ranged', range: REACH.rangedClose, damage: 3, cooldown: 850, speed: SPEED.close, color: '#BFEFFF', effect: 'slow', pellets: 3, spreadDeg: 30, emoji: '💦' },
      { key: 'Glass', name: 'Glass Shards', type: 'ranged', range: REACH.rangedMid, damage: 7, cooldown: 1100, speed: SPEED.mid, color: '#BFEFFF', effect: 'stun', emoji: '🧊' },
      { key: 'Cap', name: 'Cap Shot', type: 'ranged', range: REACH.rangedLong, damage: 6, cooldown: 900, speed: SPEED.long, color: '#1E90D8', effect: 'slow', emoji: '🔵' },
      // 🌊 THE ROSTER'S ONLY CAST WEAPON, AND THE ONLY CARD THAT NAMES ITS OWN WIND-UP.
      // Its blurb says *"takes a few seconds"* and the record had `castMs` 0 — 3500 was
      // the COOLDOWN, which is a different quantity and is not visible to the player.
      // 1100 ms is derived in `Weapon.castMs` from `REACH.meleeHeavy` and the roster's
      // slowest human speed; it leaves a 304.55 ms reaction window against the slowest
      // character and 400.00 ms against the fastest. See `DECISIONS §74`.
      //
      // ── 🚨 THE 1100 IS 1.83x ITS OWN RULE, AND WATER BOTTLE IS THE ROSTER'S WORST
      //    CHARACTER BY 37 pp BECAUSE OF IT. MEASURED 2026-08-18, NOT CHANGED HERE. ──
      //
      // `Weapon.castMs`'s derivation reads a melee cast as a DISC of `range`. `deliverWeapon`
      // resolves this one against a FROZEN 100° cone, so the escape is angular, not radial:
      // `u6_escape` measures the window at **284 ms** (slowest human) against the 795.45 ms
      // the disc form predicts, and the rule therefore returns **600**, not 1100.
      //
      //     arm (roster_lab --seeds 32, paired on a06c0fd)   waterbottle strength   roster sd   range   settled
      //     baseline, castMs 1100 (SHIPPED)                        9.8%              13.6 pp   53.9 pp   28/110
      //     castMs 600  (the corrected derivation)                25.9%  +16.1         9.7 pp   36.1 pp   21/110
      //     castMs 450  (the most the geometry allows)            31.1%  +21.2         8.5 pp   30.8 pp   20/110
      //
      // Every roster-health number improves together, which is what separates this from a
      // tune: sd, range and settled all fall, and the 94 of 110 matchups that do not involve
      // Water Bottle are BIT-IDENTICAL in both arms (0 moved — checked on `matchupRates`,
      // not asserted). ⚠️ 450 measures better and is NOT the recommendation: it leaves only
      // 166 ms of reaction over the 284 ms window, against the 300 ms the rule budgets. 600
      // is the derived value; 450 is the sensitivity beside it.
      //
      // 🚨 **AND IT IS NOT APPLIED, BECAUSE THE 9.8% IS ALSO THE NUMBER `DECISIONS §77`
      // QUOTES AS THE ROSTER RANGE.** The range at `a06c0fd` is **53.9 pp**; 9.8 pp was
      // measured at `33318a1`, BEFORE `16b635d` shipped this field. Two live decisions rest
      // on that stale figure. Changing `castMs` here turns 5 rows red in `sim.test.mjs`
      // (§33(l)/(n)/(o), all of which encode the disc) and that file is not this pass's.
      //
      // ── 🚨 `castMs` 1100 -> 1400 ON 2026-08-21, AND IT WAS NOT A TUNING DECISION ──
      //
      // `sim.test.mjs` §33(o) asserts this field is DERIVED, not authored:
      // `roundUp50(range / slowestHumanSpeed * 1000 + REACTION_MS)`. `DECISIONS §75(b)`
      // landed in the same session — `PLAYER_SPEED` 0.12 -> 0.09 with the bot speeds scaled
      // by the same 0.75 — so the slowest human went 105.6 -> **79.2 wu/s**, the escape
      // boundary went 795.45 -> **1060.61 ms**, and the SAME rule returns **1400**. The
      // input moved; the derived value followed. `PLAYER_SPEED`'s own block predicted this
      // number, by name, before the speed change was authorised.
      //
      // ⚠️ **IT IS A NERF TO THE ROSTER'S WEAKEST CHARACTER AND IT IS REPORTED, NOT PAID
      // BACK.** A longer wind-up is a MORE dodgeable one (`DECISIONS §80`'s own constructive
      // finding, and the direction Uri asked for), which is right for a super and expensive
      // for Water Bottle. `§77` withholds permission to re-tune five other characters to
      // hide it. The price is in the commit that landed it.
      // 🚨 **`selfLaunch: BODY_LENGTH` WAS AUTHORED HERE ON 2026-08-21, MEASURED, AND
      // REVERTED THE SAME DAY. THE FIELD IS RIGHT; THIS WEAPON IS THE WRONG PLACE FOR IT.**
      // The card says *"launches himself up"*, so `wm_gate`'s `self-launch` claim is STILL
      // MISSING for `waterbottle.Mega` and that is deliberate — see `Weapon.selfLaunch`.
      //
      // Single-variable ablation, `roster_lab --seeds 16` (1,760 matches per policy), paired
      // on identical seeds against `0c98cae`, with the other four displacement numbers held:
      //
      //     waterbottle strength      smart2    chase
      //     with    selfLaunch 42      24.1%    27.2%
      //     with    selfLaunch 21      23.4%    28.4%   <- HALVING DOES NOT RESCUE IT
      //     WITHOUT selfLaunch         33.1%    38.4%
      //     cost of the field         -9.0pp  -11.2pp   BOTH policies, same sign
      //
      // It is the only one of the five authored numbers where both driver policies agree in
      // sign AND the magnitude reaches the ~9 pp aggregate floor — and it lands on the
      // character `DECISIONS §77` records as **already 37 pp below its nearest neighbour**,
      // while `§79`/`§80` are an in-flight programme to fix exactly that. Adding a mobility
      // field to the one weapon whose dodgeability is a standing acceptance test
      // (`lk_dodge`, `kt_bearing`) would also have changed that fixture underneath them.
      // §77 forbids paying a price like this back by re-tuning other characters, so the
      // choice was ship-and-report or revert; the measurement chose.
      //
      // ⚠️ **AND THE LIKELY MECHANISM IS WORTH MORE THAN THE NUMBER.** A launch spent along
      // a frozen facing carries the caster PAST a target it has just hit, and the bot then
      // spends the next second turning around. `egg.Tackle` shows the same sign on `chase`
      // (-4.7 pp) with the opposite sign on `smart2` (+5.3), which is why it was kept. If
      // this is re-attempted, clamp the launch to the separation to the nearest opponent —
      // the same clamp `Weapon.lure` already applies — so a tackle CLOSES instead of
      // overshooting. That is a design change, it is measurable, and it is not this pass.
      { key: 'Mega', name: 'Mega Splash', type: 'melee', range: REACH.meleeHeavy, damage: 18, cooldown: 3500, cone: 100, color: '#1E90D8', effect: 'slow', castMs: 1400, emoji: '🌊' },
    ],
    abilities: [
      { emoji: '💦', name: 'Water Spray', desc: 'Sprays water that slows enemies down a lot', weapon: 'Spray' },
      { emoji: '🧊', name: 'Glass Shards', desc: 'Shoots glass shards that deal damage and freeze enemies', weapon: 'Glass' },
      { emoji: '🔵', name: 'Cap Shot', desc: 'Fires his cap - enemies slip when it hits', weapon: 'Cap' },
      { emoji: '🌊', name: 'Mega Splash', desc: 'Special: launches himself up (takes a few seconds), his cap becomes a second bottle, and together they become one giant bottle that dumps water on an enemy for huge damage and a heavy slow', weapon: 'Mega' },
    ],
  }),

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
  hotdog: defineCharacter({
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
      // `knockback` — *"Makes enemies slide and lose control"*, and it is the ONLY weapon in
      // the roster that authors one. 🚨 THAT IS THE WHOLE ANSWER TO `6ea35f5`'s REFUSAL: with
      // knockback derived from damage, all 33 weapons pushed and Hamburger's kit shoved its
      // victim 1.66x faster than it could chase. Here: half a body on a 950 ms cooldown =
      // **22.11 wu/s against Hot Dog's own 52.5 wu/s chase, 0.42x** — so Hot Dog's `Slash`
      // can still close on whatever its Ketchup pushed. §39(f) holds that ratio for the roster.
      { key: 'Ketchup', name: 'Ketchup Slip', type: 'ranged', range: REACH.rangedMid, damage: 5, cooldown: 950, speed: SPEED.mid, color: '#D62839', effect: 'slow', knockback: BODY_LENGTH / 2, emoji: '🔴' },
      { key: 'Slash', name: 'Bun Slash', type: 'melee', range: REACH.meleeStrong, damage: 11, cooldown: 650, cone: 75, color: '#FFC93C', effect: null, emoji: '⚔️' },
    ],
    abilities: [
      { emoji: '💛', name: 'Mustard Blast', desc: 'Burns enemies from a distance', weapon: 'Mustard' },
      { emoji: '🔴', name: 'Ketchup Slip', desc: 'Makes enemies slide and lose control', weapon: 'Ketchup' },
      { emoji: '⚔️', name: 'Bun Slash', desc: 'Powerful close-range strike', weapon: 'Slash' },
    ],
  }),
};

// ─────────────────────────────────────────────────────────────────────────────
// THE ROSTER JOINS THE REGISTRY — §76, and the placement is load-bearing
// ─────────────────────────────────────────────────────────────────────────────
//
// 🚨 **THIS CALL MUST SIT HERE, IMMEDIATELY AFTER THE OBJECT LITERAL ABOVE, AND THE REASON
// IS `ai.ts:PRESS_VALUE`.** That map is `ReadonlyMap<Weapon, PressProfile>` keyed on weapon
// **OBJECT IDENTITY**, and it is built in a module-level IIFE that reads `w.damage`,
// `w.pellets`, `w.spreadDeg` and `w.comboParts[i].angle` at `ai.ts` evaluation time. Two
// distinct ways to break it, and only one of them is obvious:
//
//   1. REPLACING a weapon object would make every `PRESS_VALUE.get(w)` miss and every ranked
//      press silently fall back to `w.damage` (`pressValue`'s "unreachable" branch). So
//      `registerCharacterFields` **mutates in place** — `owner[field] = value`, never a new
//      object, never a new array — and mutates ONLY when the value actually changed.
//   2. Registering LATER than `ai.ts`'s IIFE would leave the profiles computed from the
//      AUTHORED numbers while the sim ran the OVERRIDDEN ones — a driver ranking weapons by
//      a table that no longer describes them, which is this repo's five-times-recorded
//      "one rule stated in two places" with a tuning panel attached.
//
// Ordering is guaranteed, not hoped for: `ai.ts` imports `rules.ts` and `rules.ts` imports
// nothing from `src/game/` except `tuning/registry.ts`, so there is no cycle and ESM fully
// evaluates this module — including this line — before `ai.ts`'s body runs. **`rules.ts` has
// no other module-scope reader of `CHARACTERS`**: `healthMultiplier`, `speedMultiplier`,
// `kitDps` and `kitSignature` are all functions, evaluated on call.
// `tools/tmp/tun_gate.mjs` asserts the identity property directly (every weapon object in
// `ai.ts`'s map is `===` the one in `CHARACTERS`) rather than trusting this comment.
registerCharacterFields(
  CHARACTERS as unknown as Readonly<Record<string, { stats: Record<string, number>; weapons: Array<Record<string, unknown>> }>>,
  // The ladder rungs, flattened, so the panel can WARN that overriding a weapon's `range`
  // pins it off `REACH` / `SPEED`. Passed rather than imported by the registry, because the
  // registry must not know what a ladder is.
  {
    ...Object.fromEntries(Object.entries(REACH).map(([k, v]) => [`REACH.${k}`, v])),
    ...Object.fromEntries(Object.entries(SPEED).map(([k, v]) => [`SPEED.${k}`, v])),
    ...Object.fromEntries(Object.entries(FLIGHT_MS).map(([k, v]) => [`FLIGHT_MS.${k}`, v])),
  },
);

/**
 * The three schedule FUNCTIONS, registered read-only.
 *
 * §76 constraint 2 names them: they are values of run-time arguments, not of constants
 * alone, so there is no scalar for a text box to hold. The registry "records nothing
 * executable" for these — the panel renders the signature and calls the real export — and
 * `registry.ts:valuesOf` refuses to use one as a derived input from the other side.
 *
 * Their `inputs` are what makes them useful rather than decorative: `model.ts:buildGraph`
 * walks them, so moving `FOG_HOLD_MS` in the panel lists `fogRadiusAt` as a consequence
 * without the panel knowing the fog exists.
 */
const SCHEDULE_FNS = {
  minSafeRadiusFor: {
    group: 'arena', unit: 'wu', inputs: ['MIN_SAFE_RADIUS'],
    where: 'rules.ts:minSafeRadiusFor', args: ['fighterCount'],
    doc: 'The ring floor at N fighters. MIN_SAFE_RADIUS binds at N ≤ 4, and the evenly-spaced-chord term binds at N ≥ 5 (237.00 at N=6).',
  },
  fogRadiusAt: {
    group: 'arena', unit: 'wu', inputs: ['FOG_HOLD_MS', 'FOG_CLOSE_MS'],
    where: 'rules.ts:fogRadiusAt', args: ['playMs', 'openingRadius', 'floorRadius'],
    doc: 'Where the ring is at a given moment of PLAY. Holds, then interpolates to the floor, then stays — the only reader of the two schedule constants.',
  },
  fogReachesRadiusAt: {
    group: 'arena', unit: 'ms', inputs: ['FOG_HOLD_MS', 'FOG_CLOSE_MS'],
    where: 'rules.ts:fogReachesRadiusAt', args: ['radius', 'openingRadius', 'floorRadius'],
    doc: 'The inverse of fogRadiusAt — when the ring arrives at a radius. Exists so nothing solves the schedule by hand.',
  },
} as const;
/** See `DerivedScheduleKey`. Same rule, third block — a FUNCTION is no more overridable. */
export type DerivedFnKey = keyof typeof SCHEDULE_FNS;
deriveFns(SCHEDULE_FNS);

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
  // A wind-up is a KIT SHAPE, not a number: it changes what pressing the weapon commits
  // you to (rooted, aim frozen, dodgeable) in a way `damage`/`cooldown` cannot express.
  // Named here so the distinctiveness instruments can see it — an unnamed mechanic is
  // invisible to `kitSignature` and therefore to every measurement built on it.
  if (w.castMs !== undefined && w.castMs > 0) out.push('cast');
  return out;
}

/** Every mechanic `weaponMechanics` can name. The roster is asserted to use all of them. */
export const WEAPON_MECHANICS = [
  'pellets', 'homing', 'peck', 'combo', 'splatter', 'slam', 'trailBoost', 'heal', 'cast',
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
