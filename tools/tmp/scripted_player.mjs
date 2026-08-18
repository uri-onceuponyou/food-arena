/**
 * THE SCRIPTED PLAYER — one implementation, imported by every Node-side balance tool.
 *
 * ── Why this file exists ────────────────────────────────────────────────────
 *
 * It did not exist, and that was the bug. `tools/match-sim.mjs` fixed a real driver
 * defect on 2026-08-05 (the stuck detector ran during the COUNTDOWN, so every match
 * began with up to 900 ms of latched sideways walking). The fix never reached
 * `tools/tmp/arena_probe.mjs`, and `status_census.mjs` / `roster_table.mjs` each
 * lifted the driver VERBATIM from there — `roster_sweep.mjs` and
 * `status_grace_sweep.mjs` then shell out to those two. Five instruments, one stale
 * copy of a driver whose defect was known and already fixed elsewhere.
 *
 * `docs/LESSONS.md` records this exact shape — *"a rule stated once and implemented
 * twice"* — as the origin of three separate AI bugs. A fifth verbatim copy, even a
 * CORRECT one, would have been the same bug with a different date on it. So the
 * driver is stated once, here, and the tools import it.
 *
 * ── The two faults this file is the fix for ─────────────────────────────────
 *
 * **1. THE STUCK DETECTOR MUST NOT RUN DURING THE COUNTDOWN.**
 * `sim.ts:movePlayer` is only called while `phase === 'playing'`, so for the first
 * `COUNTDOWN_FROM * 1000 + COUNTDOWN_START_FLASH_MS` ms of every match the player is
 * motionless BY CONSTRUCTION. The detector saw "1.5 s of walking has covered 0 wu",
 * concluded it was jammed, flipped `detourSign` and latched a 900 ms perpendicular
 * detour — repeatedly, once every ~1.2 s of countdown. Whatever was still latched at
 * the whistle was walked SIDEWAYS at the start of the match. Measured on the
 * derivable arena: contact at 5850 ms against a correct 5283 ms, i.e. **+567 ms**.
 *
 * **2. THE DRIVER MUST NOT DECIDE DURING THE COUNTDOWN**, and this one is worse,
 * because it produces no wrong number — only a wrong PAIRING. `sim.ts` ignores
 * `input` entirely while `phase === 'countdown'`, but the decision loop still ran:
 * every ~150 ms it called `decide()` and drew a fresh `rnd()` for the next reaction
 * interval. A 5.7 s countdown burns ~38 draws from the seeded stream before the
 * whistle and a 3.7 s countdown burns ~25, so **changing the countdown re-seeds every
 * match** and a paired before/after stops being paired. Measured in
 * `tools/tmp/pacing_ladder.mjs`: with the loop live, `COUNTDOWN_FROM` 5 -> 3 moved
 * **38 of 110 matchups, max |Δ| 50.0 pp**, while the approach itself moved +0.01 s.
 * Held at the whistle it moves **0 of 110**, which is what the arithmetic demands —
 * nothing in `stepMatch` reads absolute `elapsed` (`sim.test.mjs` §21 asserts exactly
 * that on the sim side; this file is the instrument side of the same claim).
 *
 * That is a mechanism by which ANY pacing or timing change can manufacture a
 * completely fictitious balance result: large, consistent, reproducible, and entirely
 * an artefact of RNG alignment. `docs/LESSONS.md` §13 in its purest form.
 *
 * ── The two faults in `bestWeapon`, landed together on 2026-08-05 ───────────
 *
 * Both live in the same six-line function, both are *"a rule stated once in the codebase
 * and implemented differently in the instrument"*, and landing one without the other
 * would have re-based the roster twice. Measured, 32 seeds x 110 matchups, `smart2`,
 * shipped arena, PAIRED on identical seeds (an exact quantity — not the ~9 pp aggregate
 * floor):
 *
 * **3. THE PLAYER COULD NOT PRESS A HEAL.** `bestWeapon` opened with
 * `if (w.type === 'self') return;` — the exact mirror of the defect `07a4e3a` fixed in
 * `ai.ts` (`pickHighestDamageWeapon` skipped `'self'`, so the AI could never heal on the
 * same character the player healed with). Same weapon, same character, same one-line
 * exclusion, other side of the match. Hamburger owns the roster's only `self` weapon and
 * its smallest pool, so it cost **50.6 pp of role split on exactly one character** and
 * **8 of the 17 settled matchups**. `docs/LESSONS.md` §15 is this bug.
 *
 * ⚠️ **AND THE ONE-LINE DELETION IS A DIFFERENT, WORSE FIX.** `docs/STATE.md` used to
 * say *"one line … worth settled 17 -> 14"*. Deleting the exclusion ALONE measures
 * settled **13**, tier spread **9.14 pp**, Hamburger **53.9%** — not 14/16.56/70.6 — and
 * **wastes 66.5% of every heal**: Onion Ring is authored `damage: 0`, so a damage-ranked
 * `bestWeapon` reaches it whenever every offensive weapon is on cooldown or out of range,
 * *including at full HP*. Measured over 3,520 matches: 484 presses for 4,051 HP (8.37 HP
 * per 25 HP press) against the gated version's 332 presses for 8,254 HP (24.86 HP per
 * press, 99.4% efficient). **Fewer presses, twice the healing.**
 * So the heal is a branch AHEAD of the offensive ranking, gated on `ai.ts:rankHeal`'s own
 * three conditions — off cooldown, at or below `AI_SELF_HEAL_HP_FRACTION`, would not
 * overheal — rather than an entry in it. The rule is stated once, in `ai.ts`, and this
 * file now spells the player's half of it the same way.
 *
 * **4. IT RANKED BY AUTHORED `damage`, WHICH IS PER-PELLET.** `4105116` proved this and
 * fixed `ai.ts` (`pressValue`, validated against the real combat path in all 183
 * weapon-band cells by `sim.test.mjs` §20(b)); the fix never crossed to `bestWeapon`.
 * **This is the BIGGER of the two by matchup count** — on its own it moves **40 of 110
 * matchups, max |Δ| 46.9 pp** (`taco>donut` 9.4% -> 56.3%) against the heal's 10 — and
 * **it names the wrong characters.** `rules.ts` and `sim.test.mjs` §25(e) said "exactly
 * Taco and Burrito"; that is true only of a kit with every weapon off cooldown. On a live
 * tick the eligible set is a SUBSET, and over eligible subsets the two keys disagree for
 * **five** characters: taco (Filling/Onion->Double), burrito (Disc->Swarm),
 * sushi (Fish/Seaweed->Rice), soup (Noodle->Splash), waterbottle (Cap/Glass->Spray).
 *
 * ── The two faults the WIND-UP made visible, landed 2026-08-18 ──────────────
 *
 * Both are the same shape as fault 3 — *a rule the AI already obeys and the player's
 * half of it was never written* — and they were invisible until a weapon grew a
 * `castMs`, because until then there was nothing for either half to be about.
 *
 * **5. THE DRIVER COULD NOT DODGE A TELEGRAPH.** Before this, `grep -c cast` on this
 * file returned **0**. `a06c0fd` gave the AI `ai.ts:castThreat` + `dangerSteer`'s third
 * loop, so a bot steers out of an incoming wind-up; the human seat had nothing. That is
 * the recorded stun-silence asymmetry pointed the other way — *"it would have measured as
 * 'the ultimate is fine' on every AI-vs-AI corpus in the repo, which is every corpus in
 * the repo"* (`ai.ts:dangerSteer`) — and here it measured as the opposite, because the
 * one shipped wind-up sits on the seat the driver was OPPOSITE. **Every `waterbottle.Mega`
 * figure in `DECISIONS §77–79` — the −35.0 pp, the +19.7 pp, the 9.8% — was measured
 * against an opponent that could not react to the mechanic being measured.**
 *
 * **6. THE DRIVER OPENED A WIND-UP IT COULD NOT FINISH.** `ai.ts:pickWeapon` takes a
 * `castBudgetMs` — *"the question is never 'may I cast' but 'may I stand still for THIS
 * long'"* — and refuses a `castMs` at or above it. `bestWeapon` had no such question, so
 * the scripted player rooted itself for 1100 ms inside a hazard, or with less fog life
 * left than the wind-up costs, where the AI would not have.
 *
 * ── WHAT IS BORROWED, AND WHAT IS DELIBERATELY NOT ──────────────────────────
 *
 * `castThreat` is IMPORTED from the caller's `ai.ts`, never re-derived: it carries three
 * geometries (melee disc, homing disc, non-homing wedge) and *"five AI driver bugs on
 * record all had one shape — a rule stated once and implemented differently elsewhere"*.
 * `AI_HAZARD_MARGIN`, `AI_HAZARD_WEIGHT`, `AI_ESCAPE_PRIORITY` and `FOG_DPS` come from
 * the caller's `rules.ts` for the same reason. The counterfactual encoded is exactly the
 * one fault 3 encodes: **the player dodges exactly as well as the AI already does.** A
 * hand-tuned dodge would make every number below a tuning artefact instead of a
 * measurement of the game.
 *
 * 🚨 **BUT THE ATTACK SUPPRESSION IS NOT BORROWED, AND THAT IS A DERIVATION, NOT AN
 * OMISSION.** `stepAI` computes `escaping = urgent && !rooted` and passes `null` for the
 * weapon, because *"the CHASE branch fires OR moves, never both, so an AI with a weapon
 * ready simply stops moving"*. **The scripted player has no such trade**: one
 * `MatchInput` carries `move` AND `attack`, and `sim.ts` applies both on the same tick,
 * so withholding the shot costs the tick and buys nothing. That is the stun-silence bug
 * again — `ai.ts`'s own flee branch declines to suppress its shot for precisely this
 * reason. **The dodge therefore changes MOVEMENT ONLY.**
 *
 * ⚠️ **AND THE POT AND THE RING ARE DELIBERATELY NOT ADDED.** `dangerSteer` blends three
 * hazards; only the wind-up term is mirrored here. The driver has its own ring/pot ladder
 * and re-stating them as a blend would move **every** figure this driver has printed —
 * which is exactly the arm that proves this pass changed nothing it should not have. The
 * cast term cannot reach a castless roster BY CONSTRUCTION (`hasCastWeapon` below), which
 * is a stronger statement than a measured null.
 *
 * ⚠️ **SCOPE, and it is split by what each half IS.** The dodge is a MOVEMENT rule, so it
 * lands in `smart`/`smart2`'s decision tree and nowhere else: `chase` is the naive-player
 * control whose *"numbers are only meaningful as a continuous series"*, and `survive` and
 * `kite` are passivity controls with their own stated meanings. The budget is a WEAPON
 * SELECTION rule, so it lands in `bestWeapon`, which `chase` shares — the same place
 * `ai.ts` puts it, and it can only ever refuse a weapon carrying a `castMs`.
 *
 * ── What is DELIBERATELY not fixed: `preferredRange` ────────────────────────
 *
 * `preferredRange` (below) carries the SAME damage-ranking key and sets `band`, which
 * decides close/strafe/back-off in `smart`/`smart2` — i.e. the movement target. It is left
 * on the authored key ON PURPOSE: every figure in the pass that landed the two fixes above
 * holds `band` at its shipped value, so changing it here would invalidate all of them at
 * once. It is an unmeasured third rung, and it should be measured before it is moved.
 * (The `type !== 'self'` exclusion there is CORRECT — a `self` weapon has no `range` and
 * must not set the band.)
 *
 * ── Reproducing the historical driver ───────────────────────────────────────
 *
 * Every fault stays reachable BY FLAG, never by default, so any figure recorded before
 * the fix can still be reproduced BYTE-IDENTICALLY and shown to be what it is:
 *
 *     --nav-countdown-bug          fault 1 (the latched sideways detour)
 *     --decide-during-countdown    fault 2 (the re-seeding decision loop)
 *     --no-player-heal             fault 3 (the player cannot press a heal)
 *     --damage-ranking-key         fault 4 (rank by authored per-pellet `damage`)
 *     --no-player-dodge            fault 5 (the player cannot dodge a telegraph)
 *     --no-player-cast-budget      fault 6 (the player opens a wind-up it cannot finish)
 *
 * `parseDriverFlags(args)` reads all six, so every tool spells them the same way, and
 * any of them sets `isHistorical`.
 *
 * ── Guard ───────────────────────────────────────────────────────────────────
 *
 * `node tools/tmp/driver_guard.mjs` fails if a SIXTH copy of this driver appears, if
 * a tool that carries its own copy loses the countdown guard, if the decision stream at
 * the whistle ever becomes a function of countdown length again, or if either
 * `bestWeapon` fault comes back — and each of those checks is ALSO run against the
 * historical driver and must FAIL there.
 */

/**
 * 1 = pre-2026-08-05. 2 = range-before-LOS (`match-sim.mjs` rev 2). 3 = + both countdown
 * guards. 4 = + `bestWeapon` ranks by delivered press value and can press the heal.
 * 5 = + the driver can SEE a wind-up: it dodges an incoming telegraph and declines to open
 * one it cannot finish.
 *
 * ⚠️ REV 4 RE-BASES EVERY BALANCE FIGURE THIS DRIVER HAS EVER PRINTED that involves
 * Hamburger, Taco, Burrito, Sushi, Soup or Water Bottle. That is the point of the pass,
 * not a side effect — but a rev-3 baseline JSON is not comparable to a rev-4 run.
 *
 * ⚠️ **REV 5 RE-BASES EXACTLY THE FIGURES THAT INVOLVE A `castMs` WEAPON, AND NOTHING
 * ELSE.** Both new terms are unreachable on a roster with no wind-up — not by measurement
 * but by construction (`hasCastWeapon`) — so a rev-4 baseline stays comparable for every
 * matchup that contains no caster, and is NOT comparable for one that does.
 * `tools/tmp/dv_bitid.mjs` is the two-armed proof of exactly that sentence.
 */
export const DRIVER_REV = 5;

/** mulberry32. Identical stream to the copies this file replaces — do not "improve" it. */
export function rng(seed) {
  let a = seed >>> 0;
  return () => {
    a = (a + 0x6D2B79F5) >>> 0;
    let t = Math.imul(a ^ (a >>> 15), 1 | a);
    t = (t + Math.imul(t ^ (t >>> 7), 61 | t)) ^ t;
    return ((t ^ (t >>> 14)) >>> 0) / 4294967296;
  };
}

/** The 8-direction keyboard quantisation the shipped `input.ts` produces. */
export function axesToward(fromX, fromY, toX, toY) {
  const dx = toX - fromX, dy = toY - fromY;
  const m = Math.max(Math.abs(dx), Math.abs(dy)) || 1;
  const q = (v) => (v > 0.35 ? 1 : v < -0.35 ? -1 : 0);
  return { x: q(dx / m), y: q(dy / m) };
}

/** Every tool spells the four reproduction flags the same way, or the flags are useless. */
export function parseDriverFlags(args) {
  return {
    navCountdownBug: !!args['nav-countdown-bug'],
    decideDuringCountdown: !!args['decide-during-countdown'],
    noPlayerHeal: !!args['no-player-heal'],
    damageRankingKey: !!args['damage-ranking-key'],
    noPlayerDodge: !!args['no-player-dodge'],
    noPlayerCastBudget: !!args['no-player-cast-budget'],
  };
}

/**
 * ── RESOLVING `pressValue` WITHOUT HARD-IMPORTING THE SHIPPED TREE ──────────
 *
 * `pressValue` is keyed on weapon OBJECT IDENTITY (`ai.ts`'s `PRESS_VALUE` is a
 * `Map<Weapon, PressProfile>` built from its own `CHARACTERS` import), and it falls back
 * to `w.damage` for a weapon it does not recognise. So a driver that hard-imported
 * `src/game/ai.ts` while the CALLER handed it a `--sim <staged>` `CHARACTERS` would
 * silently rank the staged kit by the authored key — which is precisely fault 4, restored
 * by accident, with nothing printed. That is the same shape as every bug this file exists
 * to prevent, so it is resolved the same way `CHARACTERS` and `REACH` are: from the
 * caller's sim, not from the shared tree.
 *
 * Every Node balance tool in `tools/` spells the sim dir identically —
 * `const SIM_DIR = String(args.sim ?? \`${ROOT}/src/game\`)` — so the dir is read off
 * `process.argv` here and the matching `ai.ts` / `rules.ts` are loaded once, at module
 * load, in the same process. A tool that needs something else (two staged sims in one
 * process, as `driver_guard.mjs`'s E2E does) passes `pressValue` and
 * `selfHealHpFraction` explicitly, which always wins.
 *
 * ⚠️ AND THE FALLBACK IS NOT TRUSTED: `createScriptedPlayer` VALIDATES the resolved key
 * against the caller's own kit and THROWS if it does not recognise it (see
 * `assertRankKeyKnowsKit`). A silent degradation to the authored key is exactly the
 * failure mode, so it is made loud instead of likely.
 */
const SIM_DIR_ON_ARGV = (() => {
  const i = process.argv.indexOf('--sim');
  const v = i >= 0 ? process.argv[i + 1] : null;
  return v && !v.startsWith('--') ? v : null;
})();
const RESOLVED_SIM_DIR = SIM_DIR_ON_ARGV
  ? new URL(SIM_DIR_ON_ARGV.startsWith('/') ? SIM_DIR_ON_ARGV : `${process.cwd()}/${SIM_DIR_ON_ARGV}`, 'file://').href
  : new URL('../../src/game', import.meta.url).href;

let RESOLVED_PRESS_VALUE = null;
let RESOLVED_SELF_HEAL_FRACTION = null;
try {
  ({ pressValue: RESOLVED_PRESS_VALUE } = await import(`${RESOLVED_SIM_DIR}/ai.ts`));
  ({ AI_SELF_HEAL_HP_FRACTION: RESOLVED_SELF_HEAL_FRACTION } = await import(`${RESOLVED_SIM_DIR}/rules.ts`));
} catch {
  // Left null. A caller that never ranks a compound weapon does not need it; one that
  // does gets a thrown error naming the fix, never a quietly wrong ranking.
}

/**
 * ── THE CAST TERMS, RESOLVED FROM THE SAME PLACE AND FOR THE SAME REASON ────
 *
 * Faults 5 and 6. `castThreat` is the AI's threat geometry — three shapes, a signed
 * margin and the cheapest exit direction — and it is IMPORTED rather than re-derived
 * because *"a rule stated once and implemented differently elsewhere"* is the origin of
 * five recorded AI driver bugs and of this whole file. The four AI constants come from
 * the caller's `rules.ts` for the same reason `AI_SELF_HEAL_HP_FRACTION` does.
 *
 * ⚠️ **A PARTIAL RESOLVE IS TREATED AS NO RESOLVE.** Reading nine names off two modules
 * and keeping whichever ones happened to exist is the silent-degradation shape
 * `assertRankKeyKnowsKit` exists to refuse — an older sim missing `AI_HAZARD_WEIGHT`
 * would otherwise produce a dodge with weight `undefined`, i.e. `NaN` steering, which
 * `axesToward` quantises to a perfectly plausible `{x: 0, y: 0}`. Any missing name nulls
 * the whole record and `assertCastAwarenessKnowsKit` then throws — but ONLY for a kit
 * that actually carries a wind-up, so every pre-cast sim (`099119a` and every tool that
 * pins to it) still binds exactly as before.
 */
let RESOLVED_CAST = null;
let RESOLVED_CAST_MISSING = ['ai.ts / rules.ts / state.ts did not load'];
try {
  const ai = await import(`${RESOLVED_SIM_DIR}/ai.ts`);
  const rules = await import(`${RESOLVED_SIM_DIR}/rules.ts`);
  const st = await import(`${RESOLVED_SIM_DIR}/state.ts`);
  const need = {
    castThreat: ai.castThreat,
    hazardMargin: rules.AI_HAZARD_MARGIN,
    hazardWeight: rules.AI_HAZARD_WEIGHT,
    escapePriority: rules.AI_ESCAPE_PRIORITY,
    slowMultiplier: rules.SLOW_MOVE_MULTIPLIER,
    playerSpeed: rules.PLAYER_SPEED,
    speedFor: rules.speedFor,
    fogDps: rules.FOG_DPS,
    suddenDeathActive: rules.suddenDeathActive,
    movementLocked: st.movementLocked,
  };
  RESOLVED_CAST_MISSING = Object.keys(need).filter((k) => need[k] === undefined || need[k] === null);
  RESOLVED_CAST = RESOLVED_CAST_MISSING.length ? null : { ...need, source: RESOLVED_SIM_DIR };
} catch (e) {
  RESOLVED_CAST_MISSING = [`import failed: ${String(e).split('\n')[0]}`];
}

/**
 * A weapon whose ONE PRESS delivers something other than its authored `damage`: a combo,
 * a multi-pellet fan, or a multi-peck swing. This reads the weapon's own fields — it does
 * not re-implement `pressValue`'s arithmetic, which is stated once in `ai.ts`.
 */
const isCompoundWeapon = (w) => !!w.comboParts || (w.pellets ?? 1) > 1 || (w.peckHits ?? 1) > 1;

/**
 * KNOWN-BAD-INPUT VALIDATION for the ranking key itself.
 *
 * `pressValue` returns exactly `w.damage` for a weapon it has never seen. For a weapon it
 * HAS seen, a compound weapon's value at separation 0 is strictly greater than its
 * authored damage (every part lands). So: if the kit has compound weapons and the key
 * agrees with the authored damage on ALL of them, the key is looking at a different
 * `CHARACTERS` than the caller is, and every ranking it produces is fault 4 wearing the
 * fix's name. One compound weapon that disagrees is proof the map is the right one.
 */
function assertRankKeyKnowsKit(rankKey, CHARACTERS) {
  const compound = [];
  for (const id of Object.keys(CHARACTERS)) {
    for (const w of CHARACTERS[id].weapons) if (w.type !== 'self' && isCompoundWeapon(w)) compound.push(w);
  }
  if (!compound.length) return;                       // no compound weapon: the two keys are identical
  if (compound.some((w) => rankKey(w, 0) !== (w.damage ?? 0))) return;
  throw new Error(
    'createScriptedPlayer: the press-value ranking key does not recognise this kit '
    + `(${compound.length} compound weapons, every one of them reading back its authored damage). `
    + `Resolved from ${RESOLVED_SIM_DIR}. Pass \`pressValue\` (and \`selfHealHpFraction\`) from the same `
    + 'sim your `CHARACTERS` came from, or run with `--damage-ranking-key` if you meant the historical driver.',
  );
}

/**
 * KNOWN-BAD-INPUT VALIDATION for the cast terms — `assertRankKeyKnowsKit`'s argument one
 * level out, and it returns the fact both terms are gated on.
 *
 * Returns TRUE when this kit carries a wind-up. When it does not, both terms are
 * unreachable BY CONSTRUCTION rather than by measurement, which is the property
 * `dv_bitid.mjs`'s null arm rests on — and it is why a missing `castThreat` is not an
 * error there: there is nothing for it to be wrong about.
 *
 * When the kit DOES carry one and the terms did not resolve, this throws. The failure it
 * refuses is precise and it is the same one `pressValue` has: the caller hands a
 * `--sim <staged>` kit whose `Mega` has a `castMs`, the driver silently has no way to see
 * it, and the run reports `castMs`'s balance cost measured against a driver that ignored
 * it — a wrong number with nothing printed. Loud beats likely.
 */
function assertCastAwarenessKnowsKit(CHARACTERS, cast, reproducingBothFaults) {
  const casters = [];
  for (const id of Object.keys(CHARACTERS)) {
    for (const w of CHARACTERS[id].weapons) if ((w.castMs ?? 0) > 0) casters.push(`${id}.${w.key}`);
  }
  if (!casters.length) return false;
  if (cast || reproducingBothFaults) return true;
  throw new Error(
    'createScriptedPlayer: this kit carries a wind-up '
    + `(${casters.length}: ${casters.join(', ')}) but the cast terms did not resolve `
    + `(missing: ${RESOLVED_CAST_MISSING.join(', ')}; tried ${RESOLVED_SIM_DIR}). `
    + 'Pass `castDeps` from the same sim your `CHARACTERS` came from, or run with both '
    + '`--no-player-dodge --no-player-cast-budget` if you meant the pre-rev-5 driver.',
  );
}

/**
 * Bind the driver to one sim's rules and one arena.
 *
 * `CHARACTERS` / `REACH` come from the CALLER's `rules.ts`, not from a hard import —
 * `--sim <dir>` points these tools at a `stage_rules.mjs` copy, and a driver that
 * imported the shared tree would silently measure the shipped constants against a
 * staged sim.
 */
export function createScriptedPlayer({
  CHARACTERS, REACH, arena, hazard = null,
  navCountdownBug = false, decideDuringCountdown = false,
  noPlayerHeal = false, damageRankingKey = false,
  noPlayerDodge = false, noPlayerCastBudget = false,
  pressValue = null, selfHealHpFraction = null, castDeps = null,
}) {
  if (!CHARACTERS || !REACH) throw new Error('createScriptedPlayer: CHARACTERS and REACH are required');
  if (!arena) throw new Error('createScriptedPlayer: arena is required');
  const HAZ = hazard ?? (arena.hazards ?? []).find((h) => h.kind === 'damage') ?? null;
  const dist = (ax, ay, bx, by) => Math.hypot(ax - bx, ay - by);

  /**
   * THE RANKING KEY — fault 4.
   *
   * `pressValue(w, adist)` is what ONE PRESS delivers from here, and it is validated
   * against the real combat path in all 183 weapon-band cells by `sim.test.mjs` §20(b).
   * The authored `damage` field is per-PELLET, per-PECK, and for a combo weapon is not
   * the damage at all — Taco's Double Toss is authored 0 and delivers 23.
   */
  const press = pressValue ?? RESOLVED_PRESS_VALUE;
  const rankKey = damageRankingKey
    ? (w) => w.damage ?? 0
    : (w, d) => {
      if (!press) {
        throw new Error('createScriptedPlayer: no `pressValue` available — pass one, or use `--damage-ranking-key`.');
      }
      return press(w, d);
    };
  if (!damageRankingKey) assertRankKeyKnowsKit(rankKey, CHARACTERS);

  // ───────────────────────────────────────────────────────────────────────────
  // FAULTS 5 & 6 — the wind-up, from the human seat
  // ───────────────────────────────────────────────────────────────────────────

  const CAST = castDeps ?? RESOLVED_CAST;
  /**
   * ⚠️ THE GATE BOTH TERMS HANG ON, AND IT IS A CONSTRUCTION AND NOT A MEASUREMENT.
   * False for a roster with no `castMs`, and then neither term below reads one byte of
   * `state` — so a castless corpus is bit-identical to rev 4 because the code cannot run,
   * not because it ran and returned the same answer. That distinction is the whole reason
   * `dv_bitid.mjs`'s null arm is worth running: it checks the construction is what I say
   * it is, against a positive control that must move.
   */
  const HAS_CAST_WEAPON = assertCastAwarenessKnowsKit(
    CHARACTERS, CAST, noPlayerDodge && noPlayerCastBudget,
  );

  /**
   * The speed this fighter will ACTUALLY move at this tick, in wu/ms — the player-seat
   * mirror of `stepAI`'s `ownSpeed`, and it is passed to the same test for the same
   * reason: *"a conservative guess there would be a second, quieter statement of the
   * speed"*. `PLAYER_SPEED` where the AI reads `AI_CHASE_SPEED`, and
   * `SLOW_MOVE_MULTIPLIER` (0.45) where it reads `AI_SLOW_MULTIPLIER` (0.35) — the
   * asymmetry `DECISIONS §75` records, taken from the side this seat is actually on.
   *
   * ⚠️ It ignores the trail boost and the terrain slow, EXACTLY as `stepAI` does. Those
   * are `sim.ts:moveFighter`'s terms and neither seat's decision layer reads them; adding
   * them here would make the human dodge better than the bot for a reason that is not
   * this pass. `movementLocked` — stunned OR casting — is 0, which is what makes a
   * stunned fighter correctly stop attempting an escape it cannot make.
   */
  function ownSpeed(state, f) {
    if (CAST.movementLocked(f, state.elapsed)) return 0;
    const mult = state.elapsed < f.status.slowedUntil ? CAST.slowMultiplier : 1;
    return CAST.speedFor(f.characterId, CAST.playerSpeed) * mult;
  }

  /**
   * WHAT IS WINDING UP AT THIS FIGHTER, and where the cheapest way out points.
   *
   * The player-seat copy of `ai.ts:dangerSteer`'s third loop — the same three questions
   * in the same order, with the geometry deferred to the same imported `castThreat`:
   *
   *   1. is the fighter inside the threatened set, or within `AI_HAZARD_MARGIN` of it;
   *   2. **can it actually clear the escape distance before `resolvesAt`** — a range
   *      test is BINARY, so 90% of the way out is worth exactly zero and a hopeless flee
   *      is strictly worse than ignoring the cast;
   *   3. how hard to push — `t`, normalised identically: 0 at the outer edge of the
   *      margin, exactly 1 at the boundary, 2 one full margin inside it.
   *
   * Returns `null` when there is nothing to do about anything, which is every tick of
   * every match on a roster with no wind-up.
   *
   * ⚠️ `state.fighters` absent is answered NULL rather than guarded against: a hand-built
   * partial fixture (`driver_guard.mjs`'s `at()`) has no fighters, so nobody in it is
   * casting, so "no incoming telegraph" is the true answer and not a degradation. The
   * degradation that WOULD be dangerous — a real kit whose `castThreat` never resolved —
   * is refused at bind time, loudly, by `assertCastAwarenessKnowsKit`.
   */
  function incomingCast(state) {
    // `!CAST` is reachable in exactly one situation and it is not a degradation: a driver
    // built with BOTH cast faults flagged binds on a wind-up kit without resolving the
    // terms (that is what `--damage-ranking-key` does for the ranking key, and for the
    // same reason). Nothing on the shipped path can reach here with a null.
    if (!HAS_CAST_WEAPON || !CAST) return null;
    const others = state.fighters;
    if (!Array.isArray(others)) return null;
    const p = state.player;
    const own = ownSpeed(state, p);
    let worst = 0;
    let dx = 0;
    let dy = 0;
    for (const other of others) {
      if (other === p || !other.alive) continue;
      const c = other.cast;
      if (c === null || c === undefined) continue;
      const w = CHARACTERS[other.characterId].weapons[c.weaponIndex];
      if (w === undefined) continue;
      // `p.hitRadius`, not a constant: `stepProjectiles` reads the VICTIM's number and
      // this is asked about one named fighter.
      const threat = CAST.castThreat(other, w, p.x, p.y, p.hitRadius);
      if (threat === null) continue;
      const margin = threat.margin;
      if (margin >= CAST.hazardMargin) continue;
      const remainingMs = Math.max(0, c.resolvesAt - state.elapsed);
      if (margin < 0 && -margin > own * remainingMs) continue;
      const t = Math.min(2, (CAST.hazardMargin - margin) / CAST.hazardMargin);
      dx += threat.outX * t * CAST.hazardWeight;
      dy += threat.outY * t * CAST.hazardWeight;
      if (t > worst) worst = t;
    }
    if (worst <= 0) return null;
    return { x: dx, y: dy, t: worst, urgent: worst >= CAST.escapePriority };
  }

  /**
   * FAULT 6 — `ai.ts:pickWeapon`'s `castBudgetMs`, from the human seat.
   *
   * The longest wind-up this fighter may commit to right now, in ms. `Infinity` is the
   * ordinary case and refuses nothing. It drops in the same two situations `stepAI`
   * derives it from, and both are *"a cast I open now will not be alive to resolve"*:
   *
   *   1. **STANDING IN SOMETHING THAT HURTS** — here, scoped to an incoming telegraph.
   *      `stepAI` reads its own `urgent`, which also covers the pot and the closing ring;
   *      this driver has its own ladder for those two and re-stating them would move
   *      every castless figure it has ever printed. **The scoping is the price of the
   *      null arm and it is declared, not hidden.**
   *   2. **SUDDEN DEATH** — `SUDDEN_DEATH_RADIUS` is 0, so surviving a wind-up costs
   *      `castMs * FOG_DPS / 1000` HP flat and `hp * 1000 / FOG_DPS` is how many ms of
   *      standing is left. `FOG_DPS` is imported, never written as `15 / 300`.
   */
  function castBudgetFor(state) {
    if (noPlayerCastBudget || !HAS_CAST_WEAPON || !CAST) return Infinity;
    const inc = incomingCast(state);
    if (inc !== null && inc.urgent) return 0;
    // A partial fixture with no clock is not in sudden death; a real `MatchState` always
    // carries one.
    if (typeof state.timeRemaining === 'number' && CAST.suddenDeathActive(state.timeRemaining)) {
      return (state.player.hp * 1000) / CAST.fogDps;
    }
    return Infinity;
  }

  /** `ai.ts:AI_SELF_HEAL_HP_FRACTION` — the same threshold, read from the same sim. */
  const HEAL_HP_FRACTION = selfHealHpFraction ?? RESOLVED_SELF_HEAL_FRACTION;

  const maxNormalRange = (id) =>
    Math.max(...CHARACTERS[id].weapons.filter((w) => (w.range ?? 0) <= REACH.rangedMax).map((w) => w.range ?? 0), 0);

  /**
   * ⚠️ STILL ON THE AUTHORED `damage` KEY, DELIBERATELY. See the header: this sets `band`,
   * i.e. the MOVEMENT target, and every figure in the pass that fixed `bestWeapon` holds
   * `band` at its shipped value. Moving it is an unmeasured third rung — measure it, then
   * move it, in that order. (`type !== 'self'` here is correct: a `self` weapon has no
   * `range` and must not set the band.)
   */
  function preferredRange(id) {
    const ws = CHARACTERS[id].weapons.filter((w) => w.type !== 'self' && (w.range ?? 0) <= REACH.rangedMax);
    if (!ws.length) return maxNormalRange(id);
    return ws.reduce((best, w) => ((w.damage ?? 0) > (best.damage ?? 0) ? w : best)).range ?? 0;
  }

  /**
   * FAULT 3, FIXED — the player's half of `ai.ts:rankHeal`, and only that.
   *
   * The counterfactual this encodes is precisely *"the player uses the heal exactly as
   * well as the AI already does"*: `ai.ts:rankHeal`'s OWN three conditions, on the player's
   * hp instead of the enemy's. It is deliberately NOT a hand-tuned policy — a new policy's
   * result would be a tuning artefact rather than a measurement of the game.
   *
   * ⚠️ AND IT IS A BRANCH, NOT AN ENTRY IN THE RANKING. Onion Ring is authored `damage: 0`,
   * so simply making `self` eligible for the offensive ranking presses it whenever nothing
   * else is available — at ANY hp, including full — and throws away 66.5% of the healing.
   * The three conditions are what make one press worth 24.86 HP instead of 8.37.
   */
  function healWeapon(state) {
    if (noPlayerHeal) return null;
    const p = state.player;
    const ws = CHARACTERS[p.characterId].weapons;
    const slot = ws.findIndex((w) => w.type === 'self');
    if (slot < 0) return null;
    const w = ws[slot];
    const heal = w.healAmount ?? 0;
    if (heal <= 0) return null;
    if (state.elapsed - p.lastUsed[slot] < w.cooldown) return null;              // on cooldown
    if (HEAL_HP_FRACTION === null || HEAL_HP_FRACTION === undefined) {
      throw new Error('createScriptedPlayer: no `AI_SELF_HEAL_HP_FRACTION` available — pass `selfHealHpFraction`.');
    }
    if (p.hp > p.maxHp * HEAL_HP_FRACTION) return null;                          // not hurt enough
    if (p.maxHp - p.hp < heal) return null;                                      // would overheal
    return slot;
  }

  /**
   * The heal if `ai.ts:rankHeal` would take it; otherwise the highest DELIVERED press value
   * that is off cooldown and in range. Never picks an offensive weapon for its STATUS.
   */
  function bestWeapon(state, d) {
    const p = state.player;
    const ws = CHARACTERS[p.characterId].weapons;
    const healSlot = healWeapon(state);
    if (healSlot !== null) return healSlot;
    let best = null, bestScore = -Infinity;
    /**
     * FAULT 6. Computed AT MOST ONCE, and only once a wind-up has survived the three
     * eligibility tests above it — so on a kit with no `castMs`, and on every tick where
     * the wind-up is on cooldown or out of range, this line never runs and `state` is
     * never read. That is what keeps a hand-built fixture (and a castless roster) on
     * exactly the rev-4 code path.
     */
    let budget;
    ws.forEach((w, i) => {
      if (w.type === 'self') return;                  // ranked by `healWeapon`, never offensively
      if (state.elapsed - p.lastUsed[i] < w.cooldown) return;
      if (d > (w.range ?? Infinity)) return;
      const castMs = w.castMs ?? 0;
      if (castMs > 0) {
        if (budget === undefined) budget = castBudgetFor(state);
        // Strict `>=`, matching `pickWeapon`: a wind-up that finishes exactly when the
        // budget runs out has not finished in time. The budget is a deadline.
        if (castMs >= budget) return;
      }
      const s = rankKey(w, d);
      if (s > bestScore) { bestScore = s; best = i; }
    });
    return best;
  }

  /** The same 12x12-vs-CoverBox test `stepProjectiles` runs. */
  function lineOfSight(x0, y0, x1, y1) {
    const d = Math.hypot(x1 - x0, y1 - y0);
    const n = Math.max(1, Math.ceil(d / 4));
    for (let i = 1; i <= n; i++) {
      const x = x0 + ((x1 - x0) * i) / n;
      const y = y0 + ((y1 - y0) * i) / n;
      if (arena.cover.some((o) => Math.abs(x - o.x) < (12 + o.w) / 2 && Math.abs(y - o.y) < (12 + o.h) / 2)) return false;
    }
    return true;
  }

  /**
   * Walk toward a point the way a person does: straight at it, and when the wall says
   * no, sidestep and keep sidestepping until the wall is behind you.
   *
   * `rnd` may be null. `arena_probe.mjs` drives this without a seeded stream and its
   * historical initial `detourSign` is **+1**; preserving that is what makes its
   * before/after measure the countdown fix ALONE rather than the fix plus a re-roll.
   */
  function makeNav(rnd = null, { countdownStuckBug = navCountdownBug } = {}) {
    /** NET displacement over ~1.5 s, not per-tick movement: a fighter pinned on a corner
     *  still jitters, and a per-tick test reads that as walking. */
    const hist = [];
    let detourUntil = -1;
    let detourSign = rnd ? (rnd() < 0.5 ? 1 : -1) : 1;

    return function walk(state, targetX, targetY) {
      const p = state.player;

      // ── FAULT 1, FIXED. A stuck detector must only run while movement is possible.
      if (!countdownStuckBug && state.phase !== 'playing') {
        hist.length = 0; detourUntil = -1;
        return axesToward(p.x, p.y, targetX, targetY);
      }

      hist.push({ t: state.elapsed, x: p.x, y: p.y });
      while (hist.length && state.elapsed - hist[0].t > 1500) hist.shift();
      if (state.elapsed > detourUntil && hist.length > 4 && state.elapsed - hist[0].t > 1200) {
        if (Math.hypot(p.x - hist[0].x, p.y - hist[0].y) < 45) {   // ~1.5 s should cover ~180 wu
          detourSign = -detourSign; detourUntil = state.elapsed + 900; hist.length = 0;
        }
      }
      let tx = targetX, ty = targetY;
      if (state.elapsed < detourUntil) {
        const ang = Math.atan2(targetY - p.y, targetX - p.x) + detourSign * (Math.PI / 2);
        tx = p.x + Math.cos(ang) * 150; ty = p.y + Math.sin(ang) * 150;
      }
      return axesToward(p.x, p.y, tx, ty);
    };
  }

  const POLICY_FNS = {
    /** Nothing at all. The control: what does the AI do to a target that never acts? */
    idle: () => () => ({ move: { x: 0, y: 0 }, selectedWeapon: 0, attack: false }),

    /**
     * Run at the enemy **with the trigger held down**. The naive human's first 30 seconds.
     *
     * ⚠️ THE DOC USED TO SAY "and hold fire", AND THE CODE HAS ALWAYS SAID `attack: true`.
     * The comment was transcribed from `rules_census.mjs` when this file was extracted and
     * was wrong there too, so **every `chase` figure in this project's history was measured
     * with the trigger down** — including the ladders in `4105116` and `d9753ff`.
     *
     * No behaviour is changed here and none should be: `chase` is the naive-player control
     * and its numbers are only meaningful as a continuous series. Firing constantly IS the
     * naive hand. The comment was the defect, and a comment that contradicts its own code is
     * exactly the class `docs/LESSONS.md` §9 keeps paying for — a peer quoted a broken
     * instrument's number in `hud.ts` as proof only hours ago.
     */
    chase: (rnd = null) => {
      const nav = makeNav(rnd);
      return (state) => {
        const p = state.player, e = state.enemy;
        const d = dist(p.x, p.y, e.x, e.y);
        return {
          move: nav(state, e.x, e.y),
          aim: { x: e.x - p.x, y: e.y - p.y },
          selectedWeapon: bestWeapon(state, d) ?? 0,
          attack: true,
        };
      };
    },

    /**
     * REV 1 ORDERING — line of sight tested BEFORE range. Kept ONLY so a figure recorded
     * before 2026-08-05 can be reproduced. Across 1,100 wu of a 27-box arena something is
     * nearly always in the line, so it takes the no-LOS branch at ANY distance, strafes
     * into a prop and never closes. Do not steer by it.
     */
    smart: (rnd = null) => makeDecisionTree(rnd, { losBeforeRange: true }),

    /** REV 2 — range tested BEFORE line of sight. The corrected scripted player. */
    smart2: (rnd = null) => makeDecisionTree(rnd, { losBeforeRange: false }),

    /**
     * SURVIVE — the ceiling on human passivity: circle inside the safe disc at max speed,
     * stay outside the pot, never let the AI (70 wu/s chase against the player's 120)
     * close. ANALOG axes, not the 8-direction quantisation — the shipped twin sticks are
     * analog, so this is a real input a real player can produce. No `nav` either: its
     * stuck detector fights a policy whose whole job is to keep moving.
     */
    survive: (rnd = null) => {
      let jitter = (rnd ? rnd() : 0) * Math.PI * 2;
      return (state) => {
        const p = state.player, e = state.enemy;
        const cx = arena.center.x, cy = arena.center.y;
        const R = state.safeRadius;
        const potR = HAZ ? HAZ.radius : 0;
        let vx = 0, vy = 0;
        // 1. away from the enemy, hardest when close
        const de = Math.hypot(p.x - e.x, p.y - e.y) || 1;
        const wEnemy = Math.min(3, 260 / de);
        vx += ((p.x - e.x) / de) * wEnemy;
        vy += ((p.y - e.y) / de) * wEnemy;
        // 2. toward the ring centre, hardest near the edge
        const dc = Math.hypot(p.x - cx, p.y - cy) || 1;
        const margin = R - dc;
        const wRing = margin < 140 ? 4 * (1 - Math.max(0, margin) / 140) : 0;
        vx += ((cx - p.x) / dc) * wRing;
        vy += ((cy - p.y) / dc) * wRing;
        // 3. out of the pot
        if (HAZ) {
          const dp = Math.hypot(p.x - HAZ.x, p.y - HAZ.y) || 1;
          if (dp < potR + 45) { const w = 3; vx += ((p.x - HAZ.x) / dp) * w; vy += ((p.y - HAZ.y) / dp) * w; }
        }
        // 4. a tangential component so "away from the enemy" does not walk into a wall
        jitter += 0.03;
        vx += Math.cos(jitter) * 0.5; vy += Math.sin(jitter) * 0.5;
        const m = Math.max(Math.abs(vx), Math.abs(vy)) || 1;
        return {
          move: { x: Math.max(-1, Math.min(1, vx / m)), y: Math.max(-1, Math.min(1, vy / m)) },
          aim: { x: e.x - p.x, y: e.y - p.y },
          selectedWeapon: 0,
          attack: false,
        };
      };
    },

    /**
     * KITE — never close, always retreat, use the self-heal, keep the ring at arm's
     * length. Answers "dead against the script, or dead against a human?" for the
     * regen / timeout / final-ring family. A human who is losing plays roughly this.
     */
    kite: (rnd = null) => {
      const nav = makeNav(rnd);
      return (state) => {
        const p = state.player, e = state.enemy;
        const cx = arena.center.x, cy = arena.center.y;
        const R = state.safeRadius;
        const dc = dist(p.x, p.y, cx, cy);
        const away = Math.hypot(p.x - e.x, p.y - e.y) || 1;
        const wRing = dc > R - 90 ? 2.2 : 0.6;
        const fx = ((p.x - e.x) / away) * 1.4 + ((cx - p.x) / 600) * wRing;
        const fy = ((p.y - e.y) / away) * 1.4 + ((cy - p.y) / 430) * wRing;
        const selfSlot = CHARACTERS[p.characterId].weapons.findIndex((w) => w.type === 'self');
        const canSelf = selfSlot >= 0
          && state.elapsed - p.lastUsed[selfSlot] >= CHARACTERS[p.characterId].weapons[selfSlot].cooldown;
        return {
          move: nav(state, p.x + fx * 200, p.y + fy * 200),
          aim: { x: e.x - p.x, y: e.y - p.y },
          selectedWeapon: canSelf ? selfSlot : 0,
          attack: canSelf,
        };
      };
    },
  };

  /** `smart` and `smart2` differ by ONE clause. Writing the tree twice is how they drifted. */
  function makeDecisionTree(rnd, { losBeforeRange }) {
    const nav = makeNav(rnd);
    return (state) => {
      const p = state.player, e = state.enemy;
      const d = dist(p.x, p.y, e.x, e.y);
      const idx = bestWeapon(state, d);
      const band = preferredRange(p.characterId) * 0.85;
      const los = lineOfSight(p.x, p.y, e.x, e.y);
      const cx = arena.center.x, cy = arena.center.y;
      const dc = dist(p.x, p.y, cx, cy);
      const R = state.safeRadius;

      /** In range but shooting a counter: flank, don't empty cooldowns into furniture. */
      const flank = () => {
        const ang = Math.atan2(e.y - p.y, e.x - p.x) + Math.PI / 2;
        return { x: p.x + Math.cos(ang) * 150, y: p.y + Math.sin(ang) * 150 };
      };

      let target;
      // 1. Ring first: get inside, with margin, before anything else.
      if (dc > R - 30) {
        target = { x: cx, y: cy };
        // 2. …but if the safe disc has shrunk INSIDE the pot's ring there is nowhere
        //    safe left; sit on the least-bad radius, just inside the ring.
        if (HAZ && R < HAZ.radius + 20) {
          const ang = Math.atan2(p.y - cy, p.x - cx);
          const r = Math.max(0, R - 10);
          target = { x: cx + Math.cos(ang) * r, y: cy + Math.sin(ang) * r };
        }
      } else if (HAZ && dist(p.x, p.y, HAZ.x, HAZ.y) < HAZ.radius + 15 && R > HAZ.radius + 40) {
        // 3. Standing in the boiling pot with somewhere better to be: leave.
        const ang = Math.atan2(p.y - HAZ.y, p.x - HAZ.x);
        target = { x: HAZ.x + Math.cos(ang) * (HAZ.radius + 60), y: HAZ.y + Math.sin(ang) * (HAZ.radius + 60) };
      } else if (losBeforeRange && !los) {
        target = flank();                                   // ← REV 1's defect, kept verbatim
      } else if (d > band) {
        target = { x: e.x, y: e.y };                        // close
      } else if (!los) {
        target = flank();                                   // ← REV 2: in range AND blocked
      } else if (d < band * 0.5) {
        const ang = Math.atan2(p.y - e.y, p.x - e.x);       // back off
        target = { x: p.x + Math.cos(ang) * 100, y: p.y + Math.sin(ang) * 100 };
      } else {
        const ang = Math.atan2(p.y - e.y, p.x - e.x) + Math.PI / 2;   // strafe
        target = { x: p.x + Math.cos(ang) * 100, y: p.y + Math.sin(ang) * 100 };
      }

      /**
       * FAULT 5 — the incoming telegraph, blended in exactly as `stepAI`'s `steer` does:
       * the ladder's choice becomes a UNIT intent of weight 1 and the escape is added at
       * `AI_HAZARD_WEIGHT`. A blend rather than a branch, for `dangerSteer`'s own stated
       * reason — *"a branch would be a fourth thing competing with the pot, the ring and
       * the fighter's own intent, arbitrated by whichever `if` came first"*.
       *
       * ⚠️ NO LEAD DISTANCE IS INVENTED. `ai.ts` re-projects the blended heading through
       * `STEER_LEAD` because `moveToward` takes a POINT; `axesToward` reads only the
       * DIRECTION from `(p → target)`, so the un-normalised blend vector is the same
       * input, and a second copy of a constant that changes nothing here is a liability.
       *
       * ⚠️ AND IT STILL GOES THROUGH `nav`. The alternative — bypassing it the way
       * `survive` does — would drop the wall sidestep for the one second a fighter most
       * needs it, and the stuck detector cannot latch on a fighter that is moving. Zero
       * intent (the ladder targeting the fighter's own feet) degrades to the pure escape
       * rather than to a normalisation of `0/0`.
       */
      const inc = noPlayerDodge ? null : incomingCast(state);
      let navX = target.x, navY = target.y;
      if (inc !== null) {
        const ix = target.x - p.x, iy = target.y - p.y;
        const im = Math.hypot(ix, iy);
        // 1e-6 is `ai.ts`'s own EPS, which is module-private there. Same guard, same job:
        // a zero-length blend must leave the target alone rather than become NaN.
        const bx = (im > 1e-6 ? ix / im : 0) + inc.x;
        const by = (im > 1e-6 ? iy / im : 0) + inc.y;
        if (Math.hypot(bx, by) > 1e-6) { navX = p.x + bx; navY = p.y + by; }
      }

      return {
        move: nav(state, navX, navY),
        aim: { x: e.x - p.x, y: e.y - p.y },
        selectedWeapon: idx ?? 0,
        // Don't spend cooldowns on shots that cannot reach OR cannot arrive. A `self`
        // weapon travels nowhere, so line of sight is not one of its preconditions —
        // gating the heal on LOS would be a second, invented rule.
        attack: idx !== null
          && (los || CHARACTERS[p.characterId].weapons[idx].type === 'melee'
            || CHARACTERS[p.characterId].weapons[idx].type === 'self'),
      };
    };
  }

  /**
   * The reaction cadence, WITH THE COUNTDOWN GUARD — fault 2.
   *
   * Stated once so it cannot be half-copied. `stats` is what `driver_guard.mjs`
   * asserts on: a decision or a reaction draw during the countdown means the seeded
   * stream at the whistle is a function of countdown length, which is exactly the
   * mechanism that manufactured a 38-of-110 balance result out of nothing.
   *
   * `sinceDecision` starts at `Infinity`, so the first decision lands on the first
   * PLAYING tick regardless of how long the countdown was.
   */
  function createDecisionLoop({ decide, reactBase = 150, reactJit = 0, rnd = null }) {
    if (typeof decide !== 'function') throw new Error('createDecisionLoop: decide is required');
    let input = { move: { x: 0, y: 0 }, selectedWeapon: 0, attack: false };
    let sinceDecision = Infinity;
    let nextReact = reactBase;
    const stats = { decisions: 0, decisionsInCountdown: 0, reactDraws: 0, reactDrawsInCountdown: 0 };

    return {
      stats,
      /** Call once per tick, BEFORE `stepMatch`. Returns the input for this tick. */
      next(state, dt) {
        const playing = state.phase === 'playing';
        const canAct = decideDuringCountdown || playing;
        if (canAct && sinceDecision >= nextReact) {
          input = decide(state);
          sinceDecision = 0;
          stats.decisions++;
          if (!playing) stats.decisionsInCountdown++;
          if (rnd && reactJit) {
            nextReact = reactBase + (rnd() * 2 - 1) * reactJit;
            stats.reactDraws++;
            if (!playing) stats.reactDrawsInCountdown++;
          }
        }
        if (canAct) sinceDecision += dt;
        return input;
      },
    };
  }

  return {
    DRIVER_REV,
    POLICY_FNS,
    POLICY_NAMES: Object.keys(POLICY_FNS),
    makeNav, lineOfSight, bestWeapon, healWeapon, rankKey, preferredRange, maxNormalRange, axesToward,
    createDecisionLoop,
    /** Faults 5 and 6, exported for the same reason `bestWeapon` and `healWeapon` are:
     *  a guard that re-implemented either would be testing its own copy. */
    incomingCast, castBudgetFor, ownSpeed,
    /** Whether the bound kit carries a wind-up at all — the gate both terms hang on. */
    hasCastWeapon: HAS_CAST_WEAPON,
    /** Which sim the ranking key and the heal threshold were resolved from. */
    rankKeySource: pressValue ? 'injected' : RESOLVED_SIM_DIR,
    /** …and the cast terms. `null` means they did not resolve, which is only legal on a
     *  kit with no wind-up. */
    castSource: castDeps ? 'injected' : (RESOLVED_CAST ? RESOLVED_CAST.source : null),
    selfHealHpFraction: HEAL_HP_FRACTION,
    flags: {
      navCountdownBug, decideDuringCountdown, noPlayerHeal, damageRankingKey,
      noPlayerDodge, noPlayerCastBudget,
    },
    /** True when this driver is reproducing a historical defect and its numbers are NOT current. */
    isHistorical: navCountdownBug || decideDuringCountdown || noPlayerHeal || damageRankingKey
      || noPlayerDodge || noPlayerCastBudget,
  };
}
