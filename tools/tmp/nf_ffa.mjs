#!/usr/bin/env node
/**
 * NF-FFA — THE 4–6 FIGHTER BALANCE INSTRUMENT.
 *
 * `roster_lab`, `kit_lab`, `match-sim`, `pacing_ladder` and `roster_table` all encode a
 * **110-cell 1v1 matchup grid** and every published balance number in this project comes
 * out of one of them. `DECISIONS §49b` and `§49c` both say, verbatim:
 *
 *   > *"a 4–6 fighter balance number is a DIFFERENT QUANTITY and the instrument for it does
 *   > not exist yet. Whoever prices this builds that first."*
 *
 * This is that instrument. It is built **alongside** those tools and changes none of them.
 *
 * ═══════════════════════════════════════════════════════════════════════════
 * 1. THE FINDING THAT DECIDED THE SHAPE: WHO PLAYS THE MATCH
 * ═══════════════════════════════════════════════════════════════════════════
 *
 * 🚨 **`tools/tmp/scripted_player.mjs` CANNOT PLAY A FREE-FOR-ALL, AND IT NEVER WILL BE
 * ABLE TO WITHOUT BEING REWRITTEN.** Every one of its six policies opens
 * `const p = state.player, e = state.enemy;` — the two LEGACY SEAT ALIASES, i.e.
 * `fighters[0]` and `fighters[1]`. At six seats:
 *
 *   * seat 0 would chase **seat 1 and only seat 1**, forever, while four other fighters
 *     shoot it in the back, and
 *   * seats 2–5 could not be driven by it **at all** — it has no way to express "I am
 *     fighter 4"; it reads `state.player` unconditionally.
 *
 * `conceal_lab.mjs` states this ("a deterministic STIMULUS, not a model of how a human
 * would play a six-way brawl") and it is correct. **A balance number measured through it
 * above N=2 would be meaningless.**
 *
 * ✅ **BUT THE SIM'S OWN AI IS N-AWARE, AND IT IS SYMMETRIC ACROSS EVERY SEAT.**
 * `1b506d6` split `opponentOf` into `nearestLivingOpponent` / `lastFighterStanding`, and
 * `ai.ts:stepAI` was rewritten to take `self` as an argument and resolve its target through
 * `nearestLivingOpponent` — *"at six it is the difference between an AI that fights whoever
 * is nearest and an AI that stares at slot 0 forever."* `sim.ts`'s fighter loop branches on
 * `Fighter.controller`, not on a seat name.
 *
 * So this tool seats **every fighter as `controller: 'ai'`** and supplies **no human input
 * at all** (a per-slot array of `null`, which `stepMatch` reads as frozen NEUTRAL for any
 * seat that were human — it asserts there are none). The scripted driver is not imported,
 * not constructed, and not reachable from this file.
 *
 * ⚠️ **THAT IS A REAL LIMIT AND IT IS DECLARED, NOT PAPERED OVER.** This measures character
 * fairness **under the shipped bot policy**. It is the same class of caveat every number in
 * this repo already carries — `roster_lab`'s 110 cells are measured under `smart2`-vs-
 * `stepAI` — but it is a *different* caveat, so a figure from here is **not comparable to a
 * figure from there** and this file never prints one next to the other.
 *
 * ⚠️ AND IT IS THE **RIGHT** ASYMMETRY TO REMOVE. In a duel, "player character X vs AI
 * character Y" is a real, ordered question, which is why `roster_lab` reports `asPlayer` and
 * `asAI` separately. In a free-for-all **there is no "the enemy"** (`DECISIONS §49c`, Uri's
 * own answer) — so every seat must be driven by the same policy or the measurement is of the
 * policy split and not of the characters. `3ae6749` already flattened the HP dial above two
 * seats for exactly this reason; flattening the *driver* is the same argument.
 *
 * ═══════════════════════════════════════════════════════════════════════════
 * 2. THE QUANTITY: **MEAN PLACEMENT**. STATED BEFORE IT IS MEASURED.
 * ═══════════════════════════════════════════════════════════════════════════
 *
 * A free-for-all has **no matchup**. 110 cells is `11 x 10` ORDERED PAIRS and win rate is
 * binary; at six seats the space is `C(11,6) = 462` unordered rosters times a seat
 * assignment, and "who won" throws away five sixths of what the match said.
 *
 * The candidates, and why each is or is not the answer to *"is this character fair"*:
 *
 *   PLACEMENT (1..N)   ✅ **CHOSEN.** It is the outcome the game itself produces, it uses
 *                      every fighter's result rather than one bit, and it **reduces exactly
 *                      to the 1v1 quantity**: at N=2, `meanPlace === 2 - winRate`
 *                      identically (asserted in `--selftest` §C, not assumed). Fair = the
 *                      uniform mean `(N+1)/2` = **3.50** at six seats. It is also what the
 *                      reference genre balances on — a battle-royale mode is scored on
 *                      average finish, never on wins alone.
 *   1ST-PLACE RATE     Reported as a column, never as the verdict. It is the N-seat
 *                      generalisation of win rate and it is unambiguous (`match-ended`
 *                      always names a winner) — but it collapses 2nd through 6th into one
 *                      bucket, so for the same corpus its resolution is far worse.
 *                      🚨 **AND MEASURED, THE TWO RANKINGS BARELY AGREE: Spearman rho =
 *                      0.282** over 11,088 matches. Hamburger is **2nd by win rate and 9th
 *                      by placement**; Taco is 5th and 11th; Waterbottle 1st and 5th. A
 *                      six-seat balance pass steered by win rate would name a nearly
 *                      different roster from one steered by placement, so the choice above
 *                      is not a refinement — it is the whole answer.
 *   SURVIVAL TIME      Reported as a column. It is continuous and low-variance, but it
 *                      rewards **hiding**: the closing fog decides who dies last as much as
 *                      the kit does, so a character that never contests anything scores
 *                      well. It answers "who lives longest", not "who is fair".
 *   DAMAGE DEALT/TAKEN ✅ Reported as columns, and they are the DIAGNOSTIC pair — they say
 *                      *why* a placement moved. They are not the verdict: a high-damage
 *                      character that dies second is not balanced.
 *   KILLS              Reported. A credit metric, and at N=6 it is heavily confounded by
 *                      last-hitting a fighter the fog already brought to 8 HP.
 *
 * ── ⚠️ THE ONE PLACE PLACEMENT IS NOT FULLY DEFINED, AND IT IS DECLARED ─────
 *
 * A match that reaches the 45 s whistle can end with **several fighters still standing**.
 * `sim.ts:resolveTimeout` ranks them internally (HP fraction -> zone control -> fewest
 * deaths -> lower slot, `DECISIONS §49a`) but **it only emits the winner** — `match-ended`
 * carries one `winnerId` and nothing else. So:
 *
 *   * every fighter that DIED is placed by **elimination order** — the first to die is Nth;
 *   * the declared winner is **1st**;
 *   * the remaining `k-1` survivors are **TIED** and share places `2..k` at their mean.
 *
 * 🚨 The tie rule is **fractional ranking**, and the alternative was rejected on purpose:
 * re-deriving the survivors' order from HP fraction here would be *"a rule stated once in
 * the sim and implemented differently in the instrument"* — the exact shape of four separate
 * defects in this repo's history, including both `bestWeapon` faults. The sim does not
 * publish that order, so this tool does not invent it. **The tie rate is printed on every
 * run** (`ties/match`), so a corpus where the ambiguity dominates says so out loud.
 * The tie is symmetric across characters, so it costs variance and adds no bias — and the
 * SUM INVARIANT `sum(place) === N(N+1)/2` holds for **every** match regardless, which is
 * what `--selftest` §A checks it on.
 *
 * ⚠️ **AND THERE IS A THIRD ENDING THAT DOES NOT EXIST IN THE 110-CELL WORLD: THE TOTAL
 * WIPE — a declared winner who is DEAD.** Found by this file's own `--selftest` §G on its
 * first run (`soup` x6), and it is 17% of a mirror corpus, not a curiosity. See
 * `placementsOf` for the mechanism and why it needs no tie rule.
 *
 * ═══════════════════════════════════════════════════════════════════════════
 * 3. THE DESIGN: ENUMERATIVE, AND BALANCED BY CONSTRUCTION
 * ═══════════════════════════════════════════════════════════════════════════
 *
 * **ALL `C(11,N)` ROSTERS x `N` CYCLIC SEAT ROTATIONS.** Nothing is sampled.
 *
 *   * `C(11,6) = 462` rosters, in lexicographic order over `CHARACTER_IDS`.
 *   * rotation `r` seats `roster[(seat + r) mod N]` at seat `seat`, so over `r = 0..N-1`
 *     **every character in a roster occupies every seat exactly once.**
 *   * => every character appears in `C(10,5) = 252` rosters, `1,512` matches, and **exactly
 *     252 in each of the six seats.** `--selftest` §F asserts that count table is flat, and
 *     it has a known-bad (`--rotations 5`) that must make it NOT flat.
 *
 * That balance is load-bearing, because **the seat is not neutral**: seats differ by spawn
 * point and by turn order inside the tick (`sim.ts`'s fighter loop is slot order, and
 * `DECISIONS §49a` calls seat 0's tiebreak advantage *"a standing positional advantage"*).
 * `--mirror` measures exactly how big that is, by running rosters of **six copies of one
 * character** — where every fighter is identical and any spread between seats is pure seat
 * effect. That is the "two identical characters in different seats must come out equal"
 * validation, generalised to six.
 *
 * ── 🚨 MEASURED 2026-08-11, AND IT IS A SPAWN EFFECT, NOT A TURN-ORDER EFFECT ──
 *
 * `--mirror --phases 12` (132 matches, six identical fighters every time):
 *
 *     seat            0     1     2     3     4     5
 *     mean placement 3.86  3.66  3.09  3.81  3.75  2.83      (flat would be 3.50)
 *
 * ~1.0 place between the best and worst seat, on identical fighters — so seat is worth
 * about a third of the whole live roster's spread, and a design that did not balance it
 * would be measuring the spawn ring.
 *
 * **WHICH HALF IS IT?** Rotating the ring by EXACTLY `2*pi/6` moves seat `i` onto seat
 * `i+1`'s old spawn while leaving slot order untouched, so the two hypotheses make
 * different predictions and they can be told apart. Six single-phase mirror runs at
 * `k * 60°`, each compared with the k-shifted phase-0 profile:
 *
 *     mean |Δ| vs "the profile FOLLOWS THE SPAWN"  (shift by k)   0.424   <- this one
 *     mean |Δ| vs "the profile FOLLOWS THE SLOT"   (no shift)     1.424
 *     mean |Δ| vs an arbitrary wrong shift (the null)             1.632
 *
 * => **the seat advantage travels with the SPAWN POINT.** It is a property of where you
 * start on a 27-cover arena that is not rotationally symmetric, not of who moves first in
 * the fighter loop. That is a §48 question (spawn placement, the 180°/60° point-symmetry
 * fairness constraint) and NOT an argument about §49a's tiebreak rung.
 *
 *     for k in 0 1 2 3 4 5; do P=$(node -e "console.log($k*2*Math.PI/6)");
 *       node tools/tmp/nf_ffa.mjs --mirror --n 6 --phase "$P" | grep "seat mean"; done
 *
 * ── SPAWNS (`DECISIONS §49d`) ──────────────────────────────────────────────
 *
 * `createMatch` **throws** for slot 2+ without an explicit spawn, deliberately: spawn
 * placement is `src/arena/**`'s and part of §48's point-symmetry fairness constraint.
 * ⚠️ **THIS TOOL THEREFORE PASSES SPAWNS EXPLICITLY**, and it does so with the *same* ring
 * `conceal_lab.mjs:ringConfigs` already uses — `N` points evenly spaced on the circle
 * through `arena.playerSpawn`, centred on `arena.center`. It carries **no placement policy**
 * and nothing shipped reads it; the day the arena pass lands six real spawns, this becomes
 * `--spawns arena` and every number here needs re-measuring.
 *
 * ═══════════════════════════════════════════════════════════════════════════
 * 4. THE RESOLUTION FLOOR — MEASURED, NEVER PICKED
 * ═══════════════════════════════════════════════════════════════════════════
 *
 * 🚨 **A METRIC WITHOUT A FLOOR HAS COST THIS PROJECT REAL TIME** — a whole character
 * programme was steered by blind-critic moves of 0.25–1.0 inside a ±1.4 floor. Known floors
 * here: aggregate 1v1 win rate **~9 pp**, pacing **~0.8 s of contact**, the blind critic
 * **±1.4**, `dLcontact` **0.0039**, `playerRankMedian` **±1.5 places**.
 *
 * ⚠️ **RE-RUNNING THIS TOOL ON AN IDENTICAL CONFIGURATION IS NOT A FLOOR PROBE.** The sim
 * has no RNG (`grep Math.random src/game/*.ts` — nothing but `vfx.ts`, which is not stepped
 * here) and every seat is a bot, so an identical configuration returns a **bit-identical**
 * answer. Spread 0.0 measures determinism, not resolution, and quoting it as a floor would
 * be the most confident wrong number this tool could produce.
 *
 * So the floor is derived from a **NUISANCE PERTURBATION THAT PROVABLY CANNOT CHANGE ANY
 * CHARACTER'S TRUE STRENGTH**: the **phase of the spawn ring**. Rotating all `N` spawn
 * points by one angle `phi` preserves the ring's own `2*pi/N` symmetry exactly — every seat
 * moves identically, no character is touched, no rule changes — while landing the whole
 * match on a different part of an arena whose 27 cover boxes are NOT rotationally symmetric.
 * **Any movement in a character's mean placement across phases is, by construction, noise.**
 *
 * `--floor` runs the identical design at `--phases` sub-sector angles (`j * (2*pi/N)/phases`,
 * so no two are related by the ring's own symmetry) and reports the per-character spread.
 * **THE FLOOR IS THE MAX SPREAD, and it is printed as the headline of that mode.**
 * Do not act on a difference smaller than it.
 *
 * ── 🚨 THE MEASURED FLOOR, N=6, 2026-08-11 ─────────────────────────────────
 *
 * `--floor --n 6 --phases 4 --jobs 6`, 11,088 matches, shipped `tools/arena.gameplay.json`:
 *
 *   **ONE PHASE (2,772 matches — the full 462x6 design): 0.978 PLACES.**
 *     max per-character spread over 4 replicates (worst: hotdog 2.852..3.830);
 *     median spread 0.780, rms 0.717, pooled sd across phases 0.320.
 *   **POOLED OVER 4 PHASES (11,088 matches): ~0.32 places**, i.e. `2 * 0.320 / sqrt(4)`.
 *
 * ⚠️ **QUOTE THE ONE THAT MATCHES YOUR CORPUS SIZE.** The two differ by 3x and the smaller
 * one is only earned by actually running four phases. ⚠️ And the RANGE of 4 replicates
 * UNDERSTATES a 95% band (`E[range of 4] ~ 2.06 sd`), so where the two disagree, take the
 * larger — both are printed on every `--floor` run so neither can be quoted alone.
 *
 * ⚠️ **THE FLOOR IS OF THE SAME ORDER AS THE WHOLE ROSTER'S SPREAD (1.159 places at N=6).**
 * That is the single most important thing to know before using this tool: **a single-phase
 * run cannot separate the middle of the roster at all.** Eight of eleven characters sit
 * inside one floor of each other. Only the extremes are resolvable, and only pooled.
 *
 * ── AND THE MECHANISM BEHIND THAT FLOOR IS WORTH MORE THAN THE NUMBER ──────
 *
 * The four phases are not four noisy samples of one game. They are four DIFFERENT GAMES.
 * Deaths with **no attributable hit at all** — a fighter that burned in the closing fog
 * having never been touched by a weapon or a trail — per phase, same 2,772 matches each:
 *
 *     phase 0   30 of 13,523   0.22%
 *     phase 1  5,529 of 13,386  41.30%      <- two thirds of the fighters never made contact
 *     phase 2  3,025 of 13,448  22.49%
 *     phase 3   26 of 13,472   0.19%
 *
 * A 15° rotation of the spawn ring takes the corpus from "essentially every death is a
 * kill" to "two fifths of them are the fog". That is `DECISIONS §48.1`'s searchless-AI
 * finding showing up as a **balance** quantity: on this map, whether fighters find each
 * other at all is decided by where they start. It is why the floor is 0.978 places rather
 * than the ~0.09 a 2,772-match binomial would suggest, and it is why `--floor` exists at
 * all instead of a `sqrt(n)` formula.
 *
 * ⚠️ **Read it as a warning about the ARENA, not about the metric.** Every corpus here is
 * seat-balanced and phase-averaged, so the character numbers survive it — but any single
 * run of anything on this map is one draw from a very wide distribution.
 *
 * ⚠️ **AND A PAIRED PER-CONFIG DELTA ON IDENTICAL SEEDS IS EXACT — A DIFFERENT QUANTITY.**
 * `--baseline` pairs match-for-match on `(n, phase, roster, rotation)` and reports how many
 * configs moved and by how much. An aggregate once moved 0.8 pp — inside its floor — while
 * 58 of 110 matchups moved, max 34.4 pp. **The two are printed in separate blocks, labelled,
 * and never added.**
 *
 * ═══════════════════════════════════════════════════════════════════════════
 * 5. VALIDATION — `--selftest`
 * ═══════════════════════════════════════════════════════════════════════════
 *
 * 🚨 *"They came out the same"* is also true of a tool that measures nothing, and nineteen
 * instruments were caught returning confident wrong answers here in one session. Every
 * assertion below has a named implementation that would FAIL it:
 *
 *   A  placement arithmetic on hand-built inputs, incl. the sum invariant  <- a mis-ordered
 *      or off-by-one placement rule
 *   B  determinism: the same config twice is bit-identical                 <- hidden state
 *   C  at N=2, `meanPlace === 2 - winRate` exactly                         <- a placement
 *      rule that does not reduce to the quantity the 110-cell grid measures
 *   D  🚨 THE KNOWN-BAD. One character given a **large, unambiguous** advantage
 *      (`maxHp` x8) must come out **rank 1**; the same character given `maxHp` x0.15 must
 *      come out **rank last**; and BOTH are re-run through an INVERTED placement rule which
 *      must get them **backwards** — a guard not shown to fail is not a guard.
 *   E  non-vacuity: the boosted corpus's per-config placement vectors must actually DIFFER
 *      from the flat corpus's                                             <- a tool that
 *      ignores its inputs and returns 3.5 for everyone passes A, B, C and F
 *   F  the design is balanced: roster count `=== C(11,N)`, and every character's per-seat
 *      match count is flat — with the known-bad that `rotations != N` makes it NOT flat
 *   G  seat symmetry: the mirror-roster sum invariant, and the seat profile is REPORTED
 *
 * ⚠️ **THIS TOOL IS NOT IN `tools/tmp/gatecount.mjs`'S REGISTRY.** That registry lives in
 * `gatecount.mjs` and the count lives in `docs/TOOLS.md`'s gate table; **neither file is in
 * this pass's owned set** (`tools/tmp/nf_*.mjs`), and `docs/AGENT-BRIEF.md` §1 is explicit
 * that a gate-table row is *executable* and is not covered by the additive release valve.
 * So `--selftest` is **not run by the gate sweep** — said out loud here, exactly as
 * `s49_mutants.mjs` says it, so the next agent does not assume otherwise. Registering it is
 * a one-line job for whoever owns those two files.
 *
 * ═══════════════════════════════════════════════════════════════════════════
 * 6. COST
 * ═══════════════════════════════════════════════════════════════════════════
 *
 * `stepAI` is **99.2% of the tick at N=6** (`navBuildField` visits ~22,736 BFS cells/tick),
 * so a six-bot match is ~150x dearer per tick than a six-human one. Measured here: ~2,900
 * ticks and **~0.6–0.9 s per match**, i.e. ~30 min for the full N=6 design single-threaded.
 * `--jobs` shards the config list across forked children of this same file (config `i` ->
 * shard `i % jobs`), which is deterministic and order-independent. ⚠️ Peers are on this box:
 * the default is deliberately low.
 *
 *   node tools/tmp/nf_ffa.mjs --selftest
 *   node tools/tmp/nf_ffa.mjs --n 6 --jobs 6                      # the full 462x6 design
 *   node tools/tmp/nf_ffa.mjs --n 6 --rosters 60 --jobs 6         # a fast reconnaissance
 *   node tools/tmp/nf_ffa.mjs --floor --n 6 --phases 4 --jobs 6   # THE RESOLUTION FLOOR
 *   node tools/tmp/nf_ffa.mjs --mirror --n 6 --phases 6           # seat bias, isolated
 *   node tools/tmp/nf_ffa.mjs --n 6 --jobs 6 --json /tmp/a.json
 *   node tools/tmp/nf_ffa.mjs --n 6 --jobs 6 --baseline /tmp/a.json
 */

import { readFileSync, writeFileSync, existsSync, rmSync } from 'node:fs';
import { fork } from 'node:child_process';
import { tmpdir } from 'node:os';
import { fileURLToPath, pathToFileURL } from 'node:url';
import { join, resolve } from 'node:path';

const SELF = fileURLToPath(import.meta.url);
const ROOT = resolve(new URL('../..', import.meta.url).pathname);

// A tool that exports nothing still gets an explicit main guard: `docs/AGENT-BRIEF.md` §3
// records three tools here whose CLI path ran on import, one of which would have killed
// every snapshot server on the box.
const IS_MAIN = process.argv[1] !== undefined
  && pathToFileURL(resolve(process.argv[1])).href === import.meta.url;

const args = (() => {
  const o = {};
  for (let i = 2; i < process.argv.length; i++) {
    const a = process.argv[i];
    if (!a.startsWith('--')) continue;
    const n = process.argv[i + 1];
    if (n === undefined || n.startsWith('--')) o[a.slice(2)] = true;
    else { o[a.slice(2)] = n; i++; }
  }
  return o;
})();

const SIM_DIR = String(args.sim ?? `${ROOT}/src/game`);
const { createMatch, stepMatch } = await import(`${SIM_DIR}/sim.ts`);
const RULES = await import(`${SIM_DIR}/rules.ts`);
const { CHARACTERS, CHARACTER_IDS, MATCH_DURATION_MS, LEVEL_MIN, LEVEL_MAX } = RULES;
const STATE = await import(`${SIM_DIR}/state.ts`);
const { MAX_FIGHTERS, MIN_FIGHTERS } = STATE;

const DT = Number(args.dt ?? 16.667);
const N = Number(args.n ?? 6);

// ─────────────────────────────────────────────────────────────────────────────
// THE ARENA. `maxSafeRadius` is DERIVED from MATCH_DURATION_MS in `arena/shared.ts`, so a
// cached dump goes stale the moment the clock moves — recompute it, exactly as
// `roster_lab.mjs` and `conceal_lab.mjs` do, or this tool measures a different fog.
// ─────────────────────────────────────────────────────────────────────────────
const ARENA_PATH = String(args.arena ?? `${ROOT}/tools/arena.gameplay.json`);
const FOG_FIRST_CONTACT_MS = 6000; // arena/shared.ts FOG_FIRST_CONTACT_S
function loadArena() {
  if (!existsSync(ARENA_PATH)) return null;
  const d = JSON.parse(readFileSync(ARENA_PATH, 'utf8'));
  const halfDiag = Math.hypot(d.width / 2, d.height / 2);
  return {
    ...d,
    maxSafeRadius: Number(args.maxsafe ?? Math.round(halfDiag / (1 - FOG_FIRST_CONTACT_MS / MATCH_DURATION_MS))),
    build: () => null,
    update: () => {},
  };
}
const ARENA = loadArena();

/**
 * THE SPAWN RING — `DECISIONS §49d`, and the same construction `conceal_lab:ringConfigs`
 * uses so two instruments do not disagree about where a six-way starts. `n` points evenly
 * spaced on the circle through `arena.playerSpawn`, centred on `arena.center`, rotated by
 * `phase`.
 *
 * ⚠️ `phase` IS THE NUISANCE PARAMETER THE FLOOR IS DERIVED FROM. It moves every seat by the
 * same angle, so it preserves the ring's `2*pi/n` symmetry exactly and cannot advantage any
 * character. See §4 of the header.
 */
function spawnRing(arena, n, phase = 0) {
  const cx = arena.center.x, cy = arena.center.y;
  const r = Math.hypot(arena.playerSpawn.x - cx, arena.playerSpawn.y - cy);
  const a0 = Math.atan2(arena.playerSpawn.y - cy, arena.playerSpawn.x - cx);
  return Array.from({ length: n }, (_, i) => {
    const a = a0 + phase + (i * 2 * Math.PI) / n;
    return { x: cx + Math.cos(a) * r, y: cy + Math.sin(a) * r };
  });
}

/**
 * ── `--spawns arena` — THE SHIPPED SIX, WHICH LANDED MID-MEASUREMENT (`0fffa1e`) ──
 *
 * `ArenaDefinition.spawns` now exists, so §49d's "the arena pass owns this" has an owner and
 * this tool no longer has to be the only source of a six-way start. **The default is still
 * the RING, and that is a measurement choice rather than inertia:**
 *
 *   * the ring is `2*pi/n`-symmetric BY CONSTRUCTION, so it contributes no per-seat
 *     advantage of its own and a character's number is not confounded by where it sat;
 *   * the ring admits the PHASE nuisance, which is the only thing this tool can derive a
 *     resolution floor from. ⚠️ **`--spawns arena` has no nuisance parameter at all** — the
 *     sim is deterministic and there is exactly one shipped layout — so with it, an
 *     AGGREGATE has no floor and only a PAIRED `--baseline` delta (exact) is quotable.
 *     `--floor` refuses it rather than printing a spread of 0.000.
 *
 * Use `--spawns arena` to price THE MAP; use the ring to price THE CHARACTERS.
 */
function spawnsFor(arena, n, phase) {
  if (String(args.spawns ?? 'ring') !== 'arena') return spawnRing(arena, n, phase);
  if (!Array.isArray(arena.spawns) || arena.spawns.length < n) {
    throw new Error(`nf_ffa --spawns arena: the arena declares ${arena.spawns?.length ?? 0} spawns, need ${n}`);
  }
  return arena.spawns.slice(0, n).map((s) => ({ x: s.x, y: s.y }));
}

// ─────────────────────────────────────────────────────────────────────────────
// PLACEMENT — the quantity. See §2 of the header for why it is this and not win rate.
// ─────────────────────────────────────────────────────────────────────────────

/**
 * @param n           seats
 * @param deathOrder  slot ids in the order `death` events fired
 * @param winnerId    `match-ended.winnerId`, or null if the match never ended
 * @param invert      🚨 KNOWN-BAD ONLY. Reverses the ranking, so `--selftest` §D can prove
 *                    its own assertion is capable of failing. Never set in a real run.
 */
function placementsOf(n, deathOrder, winnerId, { invert = false } = {}) {
  const place = new Array(n).fill(null);
  deathOrder.forEach((id, i) => { place[id] = n - i; });
  const survivors = [];
  for (let i = 0; i < n; i++) if (place[i] === null) survivors.push(i);
  const k = survivors.length;
  const done = (fault, tied, wipe = false) => {
    if (fault) return { place: null, fault, tied: 0, wipe };
    if (invert) for (let i = 0; i < n; i++) place[i] = n + 1 - place[i];
    return { place, fault: null, tied, wipe };
  };
  if (winnerId === null) return done('no match-ended', 0);

  /**
   * ── 🚨 THE TOTAL WIPE. MEASURED IN THE WILD ON THE FIRST RUN OF `--selftest` §G. ──
   *
   * `soup` x6 on the shipped arena ends with **zero fighters standing and a declared
   * winner who is dead**: the fighter loop's last kill leaves slot 5 alone,
   * `combat.ts:applyDamage` fires `match-ended` through `lastFighterStanding`, and then
   * `sim.ts:stepProjectiles` — which runs AFTER the fighter loop and is deliberately never
   * gated on phase ("projectiles keep flying and can still land damage for one extra tick
   * after a match technically ends") — lands an already-airborne shot on the winner.
   * `state.ts:lastFighterStanding` predicted exactly this state and recorded it as *"a
   * defensible outcome rather than a designed one"*.
   *
   * It needs NO tie rule: with nobody left, the elimination order is COMPLETE and
   * `n - i` has already placed every fighter, last-to-die 1st. The only thing worth
   * asserting is that the sim and the elimination order AGREE about who won — if they ever
   * disagree, the placement is not a reading of the match and the row is dropped rather
   * than scored.
   */
  if (k === 0) {
    if (winnerId !== deathOrder[deathOrder.length - 1]) {
      return done(`total wipe, but the declared winner ${winnerId} is not the last to die`, 0, true);
    }
    return done(null, 0, true);
  }

  if (!survivors.includes(winnerId)) return done(`winner ${winnerId} is not a survivor`, 0);
  place[winnerId] = 1;
  const rest = survivors.filter((i) => i !== winnerId);
  // Fractional ranking over the places the sim declines to order: 2..k.
  const shared = (2 + k) / 2;
  for (const i of rest) place[i] = shared;
  return done(null, rest.length);
}

// ─────────────────────────────────────────────────────────────────────────────
// ONE MATCH
// ─────────────────────────────────────────────────────────────────────────────

const HARD_CAP = MATCH_DURATION_MS * 1.6 + 20000;

function runMatch(arena, configs, { invert = false } = {}) {
  const state = createMatch(arena, configs);
  const n = state.fighters.length;
  // 🚨 NO HUMAN SEAT, ASSERTED. The whole shape of this tool rests on it — see §1.
  const human = state.fighters.filter((f) => f.controller !== 'ai').map((f) => f.id);
  if (human.length) throw new Error(`nf_ffa: slot(s) ${human} are not 'ai'; this instrument supplies no human input`);
  // An ARRAY, not a bare input: `state.ts:MatchInputs`'s broadcast form is a DIFFERENT rule
  // and above one human seat it is the wrong one. A hole reads as frozen NEUTRAL.
  const inputs = new Array(n).fill(null);

  const deathOrder = [];
  const deathMs = new Array(n).fill(null);
  const dealt = new Array(n).fill(0);
  const taken = new Array(n).fill(0);
  const kills = new Array(n).fill(0);
  const lastHitBy = new Array(n).fill(null);
  let winnerId = null, zoneDeaths = 0, playTicks = 0, ticks = 0, startedAt = null;

  while (state.phase !== 'ended' && state.elapsed < HARD_CAP) {
    const wasPlaying = state.phase === 'playing';
    const evs = stepMatch(state, DT, inputs);
    ticks++;
    if (wasPlaying) playTicks++;
    for (const ev of evs) {
      switch (ev.type) {
        case 'match-started': startedAt = state.elapsed; break;
        case 'hit-landed': {
          taken[ev.targetId] += ev.amount;
          const s = ev.source;
          const att = s.kind === 'weapon' ? s.attackerId : s.kind === 'trail' ? s.ownerId : null;
          // 🚨 `ev.amount > 0` GATES THE *ATTRIBUTION*, AND IT IS NOT DEFENSIVE PADDING.
          // Measured 2026-08-11 while pricing §49b: a sim with `TRAIL.damage = 0` still
          // emits `hit-landed` with `amount: 0` on every trail contact. Those zero hits
          // overwrote `lastHitBy`, so a fighter that later burned to death in the fog was
          // credited to whoever's harmless trail it had last brushed — and the ablated arm
          // reported **6 fog deaths where the control had ~656**, a 100x swing produced
          // entirely by the instrument. The shipped sim emits no zero-amount hits (measured:
          // 0 in a full match), so this changes nothing on a real corpus — but a balance
          // ablation is exactly when a constant gets set to 0, which is exactly when this
          // fires. `dealt`/`taken` are unaffected either way: they add zero.
          if (att !== null && att !== ev.targetId) { dealt[att] += ev.amount; if (ev.amount > 0) lastHitBy[ev.targetId] = att; }
          else if (att === null && ev.amount > 0) lastHitBy[ev.targetId] = -1;   // fog/hazard: nobody is credited
          break;
        }
        case 'death': {
          deathOrder.push(ev.fighterId);
          deathMs[ev.fighterId] = state.elapsed;
          const by = lastHitBy[ev.fighterId];
          // `applyDamage` pushes `hit-landed` then `death`, so the last hit on this target
          // seen in stream order IS the fatal one. Read in order, never re-derived.
          if (by !== null && by >= 0) kills[by]++; else zoneDeaths++;
          break;
        }
        case 'match-ended': winnerId = ev.winnerId; break;
        default: break;
      }
    }
  }

  const p = placementsOf(n, deathOrder, winnerId, { invert });
  const endMs = state.elapsed;
  const playMs = startedAt === null ? 0 : endMs - startedAt;
  const survivalFrac = Array.from({ length: n }, (_, i) => {
    if (playMs <= 0) return 0;
    const died = deathMs[i];
    return died === null ? 1 : Math.max(0, Math.min(1, (died - startedAt) / playMs));
  });
  return {
    place: p.place, fault: p.fault, tied: p.tied, wipe: !!p.wipe,
    winnerId, deaths: deathOrder.length, survivors: n - deathOrder.length,
    ending: state.phase !== 'ended' ? 'UNRESOLVED' : (state.timeRemaining > 0 ? 'knockout' : 'timeout'),
    dealt, taken, kills, zoneDeaths, survivalFrac,
    ticks, playTicks, playMs,
  };
}

// ─────────────────────────────────────────────────────────────────────────────
// THE DESIGN — enumerative and balanced by construction. See §3 of the header.
// ─────────────────────────────────────────────────────────────────────────────

/** Lexicographic k-subsets of `arr`. Deterministic: the shard split depends on it. */
function combinations(arr, k) {
  const out = [];
  const idx = Array.from({ length: k }, (_, i) => i);
  const n = arr.length;
  if (k > n) return out;
  for (;;) {
    out.push(idx.map((i) => arr[i]));
    let i = k - 1;
    while (i >= 0 && idx[i] === n - k + i) i--;
    if (i < 0) break;
    idx[i]++;
    for (let j = i + 1; j < k; j++) idx[j] = idx[j - 1] + 1;
  }
  return out;
}

/**
 * The flat config list. `rotations` defaults to `n` because that is the value — and the
 * ONLY value — for which every character occupies every seat the same number of times.
 * `--selftest` §F has the known-bad for it.
 */
function buildDesign({ arena, n, chars, rotations, phases, rosterLimit, mirror }) {
  const out = [];
  const rosters = mirror
    ? chars.map((c) => new Array(n).fill(c))
    : combinations(chars, n);
  const used = rosterLimit ? rosters.slice(0, rosterLimit) : rosters;
  const rots = mirror ? 1 : rotations;   // a roster of one character is seat-rotation-invariant
  for (let pi = 0; pi < phases.length; pi++) {
    // 🚨 THE SPAWNS ARE BAKED INTO THE DESIGN, NOT RECOMPUTED IN THE WORKER. `--spawns` is
    // read from argv, and the worker is deliberately given a fixed flag list — so a mode
    // resolved at run time in the child would silently split `--spawns arena` across two
    // different starts. Same reasoning as shipping the design itself; see `runDesign`.
    const spawns = spawnsFor(arena, n, phases[pi]);
    for (let ri = 0; ri < used.length; ri++) {
      for (let r = 0; r < rots; r++) {
        out.push({
          key: `${n}|${pi}|${ri}|${r}`,
          n, phaseIndex: pi, phase: phases[pi], rosterIndex: ri, rotation: r, spawns,
          ids: Array.from({ length: n }, (_, seat) => used[ri][(seat + r) % used[ri].length]),
        });
      }
    }
  }
  return out;
}

/**
 * ── PRICING A RULE: `--sim <patched>` + `--baseline`, WHICH IS HOW §49b WAS ANSWERED ──
 *
 * This tool never patches a sim itself. It takes `--sim <dir>` like every other Node balance
 * tool here, so an ablation is: copy `src/`, edit one constant, ASSERT the edit landed
 * (anchor-miss must be fatal — `docs/AGENT-BRIEF.md`), import BOTH and print the constant
 * from each, then run the patched arm at the SAME phase as a baseline JSON and pair with
 * `--baseline`. The paired delta is EXACT and needs no floor.
 *
 *     cp -R src /tmp/abl/src && <patch /tmp/abl/src/game/rules.ts, assert>
 *     node tools/tmp/nf_ffa.mjs --n 6 --phase 0 --jobs 6 \
 *          --sim /tmp/abl/src/game --baseline /tmp/nf_floor.json
 *
 * ⚠️ **PAIR AGAINST THE SAME PHASE, NOT AGAINST A POOLED BASELINE.** The `--baseline` block
 * pairs on `n|phase|roster|rotation`, so it does this correctly — but the printed CORPUS
 * lines of a one-phase arm are not comparable to a four-phase pool's, and comparing them
 * cost a real detour here (0.26% uncredited deaths against a pooled 16.0% looked like a
 * 60x instrument bug; phase 0 of the baseline is 0.22%, and nothing was wrong).
 *
 * `boost` gives ONE character an unambiguous, non-subtle advantage through the PUBLIC
 * `FighterConfig` surface — `maxHp` and `level`, both first-class fields — so `--selftest`
 * §D never has to patch a sim. `{ id, hp, level }`.
 */
function configsFor(cfg, spawns, boost) {
  return cfg.ids.map((characterId, seat) => {
    const c = { characterId, controller: 'ai', spawn: spawns[seat], level: LEVEL_MIN };
    if (boost && characterId === boost.id) {
      if (boost.level !== undefined) c.level = boost.level;
      if (boost.hp !== undefined) c.maxHp = RULES.maxHpFor(characterId, RULES.PLAYER_MAX_HP, c.level) * boost.hp;
    }
    return c;
  });
}

function runShard(arena, design, shard, shards, boost, invert, onRow) {
  const rows = [];
  for (let i = 0; i < design.length; i++) {
    if (shards > 1 && i % shards !== shard) continue;
    const cfg = design[i];
    const r = runMatch(arena, configsFor(cfg, cfg.spawns, boost), { invert });
    const row = { key: cfg.key, i, ids: cfg.ids, ...r };
    rows.push(row);
    if (onRow) onRow(rows.length, row);
  }
  return rows;
}

// ─────────────────────────────────────────────────────────────────────────────
// SHARDING. Config `i` -> shard `i % jobs`; deterministic, order-independent, and the
// parent re-sorts by `i` so a merged run is byte-identical to a single-process one.
// ⚠️ Peers are on this box (`docs/AGENT-BRIEF.md`): the default is deliberately low.
//
// ── 🚨 THE SHARDS RETURN THROUGH FILES, NOT THROUGH IPC, AND THAT COST 28 MINUTES ──
//
// The first version did `process.send({ rows }); process.exit(0)`. `process.send` is
// ASYNCHRONOUS, so `process.exit` on the next line races the flush — and the race is
// decided by PAYLOAD SIZE. A 132-match `--mirror` run (~26 rows per child, ~10 KB)
// delivered perfectly and looked like proof the mechanism worked. The 11,088-match floor
// run (~2,218 rows per child, ~900 KB) delivered **ZERO** messages: five children burned
// 100% CPU for 28 minutes and the parent received nothing.
//
// ⚠️ **THE ONLY REASON THAT DID NOT BECOME A PUBLISHED FLOOR OF 0.000 IS THE COUNT CHECK
// BELOW.** `out.length !== design.length` threw instead of summarising an empty corpus into
// a confident, beautifully formatted, entirely fictitious table — where every character
// would have tied at exactly `NaN` or, with one row surviving, at a real-looking number.
// That is `docs/LESSONS.md`'s standing rule ("a guard not shown to fail is not a guard")
// paying out on the very first long run of a new tool. **The check stays, and it stays
// even though the transport it was guarding has been replaced**, because the next
// transport will have its own way of returning a short answer.
//
// A file has none of that failure mode: `writeFileSync` is a syscall that has completed by
// the time it returns, the parent reads only after `exit`, and the row count is checked
// per shard as well as in total.
// ─────────────────────────────────────────────────────────────────────────────
async function runDesign(arena, design, { jobs = 1, boost = null, invert = false, progress = false } = {}) {
  if (jobs <= 1 || design.length < jobs * 2) {
    let last = Date.now();
    return runShard(arena, design, 0, 1, boost, invert, progress ? (done) => {
      if (Date.now() - last > 15000) { last = Date.now(); process.stderr.write(`   … ${done}/${design.length}\n`); }
    } : null);
  }
  // 🚨 THE DESIGN IS SHIPPED TO THE CHILD, NOT RE-DERIVED IN IT. The first draft passed the
  // parent's argv through and had the worker call `buildDesign` again — which is "a rule
  // stated once and implemented twice", this repo's most expensive defect shape, and it was
  // already wrong: `--selftest` §H builds its design from LITERALS, so the child would have
  // re-derived a completely different corpus from `--n`/`--rotations` and returned confident
  // rows for matches the parent never asked for. The child now runs exactly the configs it
  // is handed and cannot disagree about what they are.
  const stamp = `${process.pid}_${Date.now()}`;
  const jobFile = join(tmpdir(), `nf_ffa_job_${stamp}.json`);
  const files = Array.from({ length: jobs }, (_, s) => join(tmpdir(), `nf_ffa_shard_${stamp}_${s}.json`));
  const out = [];
  try {
    // The ARENA travels too, for the same reason the design does: a child that re-read
    // `--arena` off its own argv could measure a different map, and `maxSafeRadius` is
    // DERIVED, so "the same file" is not the same object. `build`/`update` are the only
    // non-serialisable keys and the sim never calls them.
    writeFileSync(jobFile, JSON.stringify({
      design, boost, invert, simDir: SIM_DIR, dt: DT,
      arena: Object.fromEntries(Object.entries(arena).filter(([, v]) => typeof v !== 'function')),
    }));
    // 🚨 `--sim` AND `--dt` ARE READ AT MODULE SCOPE, SO THEY MUST BE FORWARDED BY HAND —
    // and forwarding them is not enough, because forgetting one is silent. Caught here
    // before it ran: the child list was reduced to a fixed set of flags and `--sim` fell
    // off it, so an A/B against a PATCHED sim would have run the parent on the patch and
    // every child on the WORKING TREE — returning "the change did nothing", which is a
    // normal outcome for a balance ablation and which nobody re-checks.
    // `docs/AGENT-BRIEF.md` §3 records the same shape in `rg_lib.loadCast` and calls it
    // "the most dangerous possible failure". The child therefore also ASSERTS that its own
    // resolved sim and dt equal the parent's, so a future missed flag is loud.
    await Promise.all(Array.from({ length: jobs }, (_, s) => new Promise((res, rej) => {
      const child = fork(SELF, [
        '--worker', '--job', jobFile, '--shard', String(s), '--shards', String(jobs), '--out', files[s],
        '--sim', SIM_DIR, '--dt', String(DT),
      ], { stdio: ['ignore', 'inherit', 'inherit', 'ipc'] });
      child.on('error', rej);
      child.on('exit', (code) => (code === 0 ? res() : rej(new Error(`shard ${s} exited ${code}`))));
    })));
    for (let s = 0; s < jobs; s++) {
      if (!existsSync(files[s])) throw new Error(`nf_ffa: shard ${s} wrote no result file`);
      const rows = JSON.parse(readFileSync(files[s], 'utf8'));
      const want = design.filter((_, i) => i % jobs === s).length;
      if (rows.length !== want) throw new Error(`nf_ffa: shard ${s} returned ${rows.length} of ${want} matches`);
      out.push(...rows);
    }
  } finally {
    // ⚠️ NOT inside a `try` that can `process.exit` — `docs/AGENT-BRIEF.md` §3 records a
    // probe that leaked a frozen tree on every run for exactly that reason.
    for (const f of [...files, jobFile]) { try { rmSync(f, { force: true }); } catch { /* best effort */ } }
  }
  out.sort((a, b) => a.i - b.i);
  if (out.length !== design.length) throw new Error(`nf_ffa: shards returned ${out.length} of ${design.length} matches`);
  return out;
}

// ─────────────────────────────────────────────────────────────────────────────
// AGGREGATION
// ─────────────────────────────────────────────────────────────────────────────

function summarise(rows, n) {
  const per = new Map();
  const seat = Array.from({ length: n }, () => ({ sum: 0, matches: 0 }));
  const faults = [];
  let ties = 0, knockouts = 0, timeouts = 0, unresolved = 0, survivorsSum = 0, deathsSum = 0, zoneDeaths = 0, wipes = 0;
  for (const r of rows) {
    if (r.fault) { faults.push(`${r.key}: ${r.fault}`); continue; }
    ties += r.tied;
    if (r.wipe) wipes++;
    survivorsSum += r.survivors;
    deathsSum += r.deaths;
    zoneDeaths += r.zoneDeaths;
    if (r.ending === 'knockout') knockouts++; else if (r.ending === 'timeout') timeouts++; else unresolved++;
    for (let s = 0; s < n; s++) {
      const id = r.ids[s];
      let a = per.get(id);
      if (!a) { a = { matches: 0, place: 0, wins: 0, surv: 0, dealt: 0, taken: 0, kills: 0, seats: new Array(n).fill(0) }; per.set(id, a); }
      a.matches++;
      a.place += r.place[s];
      if (r.place[s] === 1) a.wins++;
      a.surv += r.survivalFrac[s];
      a.dealt += r.dealt[s];
      a.taken += r.taken[s];
      a.kills += r.kills[s];
      a.seats[s]++;
      seat[s].sum += r.place[s];
      seat[s].matches++;
    }
  }
  const table = [...per.entries()].map(([id, a]) => ({
    id,
    matches: a.matches,
    meanPlace: a.place / a.matches,
    winRate: a.wins / a.matches,
    survival: a.surv / a.matches,
    dealt: a.dealt / a.matches,
    taken: a.taken / a.matches,
    kills: a.kills / a.matches,
    seats: a.seats,
  })).sort((x, y) => x.meanPlace - y.meanPlace);
  const scored = rows.length - faults.length;
  return {
    table, faults, n,
    matches: rows.length, scored,
    ties, tiesPerMatch: scored ? ties / scored : 0,
    knockouts, timeouts, unresolved, wipes,
    meanSurvivors: scored ? survivorsSum / scored : 0,
    deaths: deathsSum, zoneDeaths,
    seatMean: seat.map((s) => (s.matches ? s.sum / s.matches : 0)),
    spread: table.length ? table[table.length - 1].meanPlace - table[0].meanPlace : 0,
  };
}

const f2 = (x) => x.toFixed(2);
const f3 = (x) => x.toFixed(3);

function printTable(s, { title }) {
  const fair = (s.n + 1) / 2;
  console.log(`\n   ${title}`);
  console.log('   char            matches  meanPlace   Δfair    win%   surv%    dealt    taken   kills');
  for (const r of s.table) {
    const d = r.meanPlace - fair;
    console.log(`   ${r.id.padEnd(14)} ${String(r.matches).padStart(7)}   ${f3(r.meanPlace).padStart(8)}  ${(d >= 0 ? '+' : '') + f3(d).padStart(6)}  `
      + `${(r.winRate * 100).toFixed(1).padStart(5)}   ${(r.survival * 100).toFixed(1).padStart(5)}  `
      + `${r.dealt.toFixed(1).padStart(7)}  ${r.taken.toFixed(1).padStart(7)}  ${r.kills.toFixed(2).padStart(5)}`);
  }
  console.log(`   ── spread (best..worst) ${f3(s.spread)} places · fair = ${f2(fair)}`);
  console.log(`   corpus  ${s.scored}/${s.matches} scored · endings ko ${s.knockouts} / timeout ${s.timeouts} / UNRESOLVED ${s.unresolved}`);
  console.log(`           mean survivors at end ${f2(s.meanSurvivors)} · ties/match ${f2(s.tiesPerMatch)} `
    + `· deaths ${s.deaths} (${s.zoneDeaths} to fog/hazard, uncredited) · ${s.wipes} total wipes`);
  console.log(`   seat mean placement  ${s.seatMean.map((x) => f2(x)).join('  ')}   (flat would be ${f2(fair)})`);
  if (s.faults.length) console.log(`   ⚠️ ${s.faults.length} FAULTED matches: ${s.faults.slice(0, 3).join(' · ')}`);
}

function header(arena, design, n, phases) {
  console.log(`   arena ${arena.id} ${arena.width}x${arena.height}, ${arena.cover.length} cover, `
    + `${arena.hazards.length} hazards, ring ${arena.maxSafeRadius}, `
    + `${(arena.concealment ?? []).length} concealment`);
  const mode = String(args.spawns ?? 'ring');
  const r = Math.hypot(arena.playerSpawn.x - arena.center.x, arena.playerSpawn.y - arena.center.y);
  console.log(mode === 'arena'
    ? `   spawns: THE SHIPPED ${arena.spawns?.length ?? 0} (arena.spawns, 0fffa1e) — no phase nuisance, so NO FLOOR;`
      + ' only a paired --baseline delta is quotable here'
    : `   spawns: FAIR RING r=${r.toFixed(1)} phases [${phases.map((p) => p.toFixed(4)).join(', ')}] `
      + '— 2π/n-symmetric by construction, so it adds no per-seat advantage of its own');
  console.log(`   ${design.length} matches · N=${n} · every seat controller 'ai' (stepAI) · dt ${DT}`);
  console.log('   QUANTITY: MEAN PLACEMENT, 1 = won .. N = died first. Fair = (N+1)/2.');
}

// ═════════════════════════════════════════════════════════════════════════════
// WORKER
// ═════════════════════════════════════════════════════════════════════════════
if (IS_MAIN && args.worker) {
  // The worker RE-DERIVES NOTHING. It reads the exact config list the parent enumerated and
  // runs its slice of it — see `runDesign` for why that is not a style choice.
  const job = JSON.parse(readFileSync(String(args.job), 'utf8'));
  // 🚨 THE CHILD PROVES IT IS MEASURING THE PARENT'S SIM. `--sim` and `--dt` are resolved at
  // module scope from argv, so a forwarding mistake would silently split an A/B across two
  // different sims and return a confident null. See `runDesign`.
  if (job.simDir !== SIM_DIR || job.dt !== DT) {
    throw new Error(`nf_ffa worker: sim/dt mismatch — parent ${job.simDir} @${job.dt}, child ${SIM_DIR} @${DT}`);
  }
  const arena = { ...job.arena, build: () => null, update: () => {} };
  const rows = runShard(arena, job.design, Number(args.shard), Number(args.shards), job.boost, !!job.invert, null);
  // A FILE, not `process.send` — see `runDesign` for the 28 minutes that decided this.
  writeFileSync(String(args.out), JSON.stringify(rows));
  process.exit(0);
}

function phaseList() {
  if (args.phase !== undefined) return [Number(args.phase)];
  const k = Number(args.phases ?? 1);
  const sector = (2 * Math.PI) / N;
  return Array.from({ length: k }, (_, j) => (j * sector) / k);
}

function parseBoost() {
  if (!args.boost) return null;
  const b = { id: String(args.boost) };
  if (args['boost-level'] !== undefined) b.level = Number(args['boost-level']);
  if (args['boost-hp'] !== undefined) b.hp = Number(args['boost-hp']);
  if (b.level === undefined && b.hp === undefined) b.level = LEVEL_MAX;
  return b;
}

// ═════════════════════════════════════════════════════════════════════════════
// --selftest
// ═════════════════════════════════════════════════════════════════════════════
if (IS_MAIN && args.selftest) {
  let pass = 0, fail = 0;
  const ok = (name, cond, detail = '') => {
    if (cond) { pass++; console.log(`   PASS  ${name}${detail ? `  ${detail}` : ''}`); }
    else { fail++; console.log(`   FAIL  ${name}${detail ? `  ${detail}` : ''}`); }
  };
  const t0 = Date.now();
  console.log(`\n══ nf_ffa SELFTEST ══  sim ${SIM_DIR === `${ROOT}/src/game` ? 'working tree' : SIM_DIR}`);
  console.log('   Every row names an implementation that would FAIL it. See header §5.\n');

  // ── A. PLACEMENT ARITHMETIC, on hand-built inputs. Would fail: any off-by-one, any
  //       mis-ordering, any tie rule that does not conserve the total.
  console.log('   A · placement arithmetic');
  {
    // 6 seats, a clean knockout: 0,4,3,1,5 die in that order, 2 survives and wins.
    const a = placementsOf(6, [0, 4, 3, 1, 5], 2);
    ok('a knockout places by elimination order, survivor 1st',
      JSON.stringify(a.place) === JSON.stringify([6, 3, 1, 4, 5, 2]), JSON.stringify(a.place));
    ok('a knockout has no ties', a.tied === 0);
    // A timeout with 3 survivors {1,2,5}: deaths 0,4,3 -> places 6,5,4; winner 2 -> 1;
    // 1 and 5 share places 2..3 -> 2.5 each.
    const b = placementsOf(6, [0, 4, 3], 2);
    ok('a timeout ranks the DECLARED winner 1st and TIES the other survivors',
      JSON.stringify(b.place) === JSON.stringify([6, 2.5, 1, 4, 5, 2.5]), JSON.stringify(b.place));
    ok('the tie count is reported', b.tied === 2, `tied=${b.tied}`);
    // 🚨 THE SUM INVARIANT. Holds for EVERY death count, which is what makes mean placement
    // comparable across matches that ended differently.
    let bad = null;
    for (let d = 0; d <= 5 && !bad; d++) {
      const order = [0, 4, 3, 1, 5].slice(0, d);
      const alive = [0, 1, 2, 3, 4, 5].filter((i) => !order.includes(i));
      const p = placementsOf(6, order, alive[0]);
      const sum = p.place.reduce((x, y) => x + y, 0);
      if (Math.abs(sum - 21) > 1e-12) bad = `d=${d} sum ${sum}`;
    }
    ok('sum(place) === N(N+1)/2 for every death count 0..N-1', bad === null, bad ?? '21 in all 6 cases');
    ok('a match with no `match-ended` FAULTS rather than scoring',
      placementsOf(6, [0], null).place === null);
    // 🚨 THE TOTAL WIPE — found by this selftest's own §G on its first run, not constructed.
    // A knockout winner killed by an already-airborne projectile in the same tick.
    const w = placementsOf(6, [3, 0, 4, 1, 2, 5], 5);
    ok('a TOTAL WIPE places purely by elimination order, last-to-die 1st, no ties',
      JSON.stringify(w.place) === JSON.stringify([5, 3, 2, 6, 4, 1]) && w.tied === 0 && w.wipe,
      JSON.stringify(w.place));
    ok('KNOWN-BAD: a wipe whose declared winner is NOT the last to die FAULTS',
      placementsOf(6, [3, 0, 4, 1, 2, 5], 2).place === null,
      placementsOf(6, [3, 0, 4, 1, 2, 5], 2).fault ?? '');
    ok('the INVERT known-bad really does reverse the ranking',
      JSON.stringify(placementsOf(6, [0, 4, 3, 1, 5], 2, { invert: true }).place)
        === JSON.stringify([1, 4, 6, 3, 2, 5]));
  }

  if (!ARENA) { console.log('\n   no arena — the match arms are SKIPPED'); process.exit(fail ? 1 : 0); }

  // ── F. THE DESIGN IS BALANCED. Would fail: any rotation count other than N.
  console.log('\n   F · the design');
  {
    const d6 = buildDesign({ arena: ARENA, n: 6, chars: CHARACTER_IDS, rotations: 6, phases: [0], rosterLimit: 0, mirror: false });
    ok('roster count === C(11,6) = 462 and every roster is enumerated, none sampled',
      d6.length === 462 * 6, `${d6.length} configs`);
    const seatCount = new Map();
    for (const c of d6) c.ids.forEach((id, s) => {
      const a = seatCount.get(id) ?? new Array(6).fill(0);
      a[s]++; seatCount.set(id, a);
    });
    const flat = [...seatCount.values()].every((a) => a.every((x) => x === a[0]));
    ok('every character occupies every seat the SAME number of times',
      flat && seatCount.size === 11, `${[...seatCount.values()][0].join(',')}`);
    // 🚨 THE KNOWN-BAD FOR IT: rotations != N cannot balance the seats.
    const bad = buildDesign({ arena: ARENA, n: 6, chars: CHARACTER_IDS, rotations: 5, phases: [0], rosterLimit: 0, mirror: false });
    const sc2 = new Map();
    for (const c of bad) c.ids.forEach((id, s) => {
      const a = sc2.get(id) ?? new Array(6).fill(0); a[s]++; sc2.set(id, a);
    });
    ok('KNOWN-BAD: `--rotations 5` is NOT seat-balanced, and the check says so',
      ![...sc2.values()].every((a) => a.every((x) => x === a[0])), `${[...sc2.values()][0].join(',')}`);
  }

  // ── B/C/D/E: real matches. Kept to a small fixed corpus — a six-bot match is ~0.6 s.
  const chars6 = CHARACTER_IDS.slice(0, 6);
  const BOOSTED = chars6[0];

  console.log('\n   B · determinism');
  {
    const design = buildDesign({ arena: ARENA, n: 6, chars: chars6, rotations: 6, phases: [0], rosterLimit: 1, mirror: false });
    const a = runShard(ARENA, design.slice(0, 2), 0, 1, null, false, null);
    const b = runShard(ARENA, design.slice(0, 2), 0, 1, null, false, null);
    ok('the same configuration twice is bit-identical (no hidden state, no RNG)',
      JSON.stringify(a.map((r) => r.place)) === JSON.stringify(b.map((r) => r.place)));
    ok('…and that is DETERMINISM, not a resolution floor — the floor needs `--floor`', true,
      'stated so it cannot be misquoted');
  }

  console.log('\n   C · reduction to the 1v1 quantity');
  {
    const chars2 = CHARACTER_IDS.slice(0, 5);
    const design = buildDesign({ arena: ARENA, n: 2, chars: chars2, rotations: 2, phases: [0], rosterLimit: 0, mirror: false });
    const rows = runShard(ARENA, design, 0, 1, null, false, null);
    const s = summarise(rows, 2);
    const bad = s.table.filter((r) => Math.abs(r.meanPlace - (2 - r.winRate)) > 1e-12);
    ok('at N=2, meanPlace === 2 - winRate EXACTLY — the new quantity reduces to the old one',
      bad.length === 0 && s.table.length === 5, `${s.table.length} chars, ${rows.length} matches`);
    ok('…and N=2 is a real corpus, not a degenerate one', s.scored === rows.length && s.deaths > 0,
      `${s.deaths} deaths in ${rows.length} matches`);
  }

  console.log('\n   D · 🚨 THE KNOWN-BAD: a large unambiguous advantage must rank FIRST');
  {
    const design = buildDesign({ arena: ARENA, n: 6, chars: chars6, rotations: 6, phases: [0], rosterLimit: 0, mirror: false });
    const flat = summarise(runShard(ARENA, design, 0, 1, null, false, null), 6);
    const up = runShard(ARENA, design, 0, 1, { id: BOOSTED, hp: 8 }, false, null);
    const down = runShard(ARENA, design, 0, 1, { id: BOOSTED, hp: 0.15 }, false, null);
    const sUp = summarise(up, 6), sDown = summarise(down, 6);
    console.log(`      flat: ${flat.table.map((r) => `${r.id} ${f2(r.meanPlace)}`).join(' · ')}`);
    console.log(`      x8  : ${sUp.table.map((r) => `${r.id} ${f2(r.meanPlace)}`).join(' · ')}`);
    console.log(`      x.15: ${sDown.table.map((r) => `${r.id} ${f2(r.meanPlace)}`).join(' · ')}`);
    ok(`a fighter with 8x HP is ranked BEST of ${sUp.table.length}`,
      sUp.table[0].id === BOOSTED, `1st = ${sUp.table[0].id} at ${f3(sUp.table[0].meanPlace)}`);
    ok('a fighter with 0.15x HP is ranked WORST',
      sDown.table[sDown.table.length - 1].id === BOOSTED,
      `last = ${sDown.table[sDown.table.length - 1].id} at ${f3(sDown.table[sDown.table.length - 1].meanPlace)}`);
    const mFlat = flat.table.find((r) => r.id === BOOSTED).meanPlace;
    const mUp = sUp.table.find((r) => r.id === BOOSTED).meanPlace;
    const mDown = sDown.table.find((r) => r.id === BOOSTED).meanPlace;
    ok('…and the two moves are in OPPOSITE directions from flat, by a wide margin',
      mUp < mFlat - 0.5 && mDown > mFlat + 0.5, `flat ${f2(mFlat)} -> x8 ${f2(mUp)} / x.15 ${f2(mDown)}`);
    // 🚨 A GUARD NOT SHOWN TO FAIL IS NOT A GUARD. Re-score the identical matches through
    // the inverted placement rule: both assertions above must come out BACKWARDS.
    const iUp = summarise(runShard(ARENA, design, 0, 1, { id: BOOSTED, hp: 8 }, true, null), 6);
    const iDown = summarise(runShard(ARENA, design, 0, 1, { id: BOOSTED, hp: 0.15 }, true, null), 6);
    ok('KNOWN-BAD: through an INVERTED placement rule the 8x fighter ranks LAST',
      iUp.table[iUp.table.length - 1].id === BOOSTED);
    ok('KNOWN-BAD: …and the 0.15x fighter ranks FIRST — so §D is capable of failing',
      iDown.table[0].id === BOOSTED);

    // ── E. NON-VACUITY. A tool that ignored its inputs and returned 3.5 for everyone would
    //       pass A, B, C and F. It cannot pass this.
    console.log('\n   E · non-vacuity');
    const flatRows = runShard(ARENA, design, 0, 1, null, false, null);
    let moved = 0;
    for (let i = 0; i < flatRows.length; i++) {
      if (JSON.stringify(flatRows[i].place) !== JSON.stringify(up[i].place)) moved++;
    }
    ok('the boost changes the PER-CONFIG placement vector in most configs (paired, exact)',
      moved >= flatRows.length * 0.5, `${moved}/${flatRows.length} configs moved`);
    ok('the flat corpus is not a single repeated outcome',
      new Set(flatRows.map((r) => JSON.stringify(r.place))).size > 3,
      `${new Set(flatRows.map((r) => JSON.stringify(r.place))).size} distinct placement vectors`);
  }

  // ── H. THE SHARDED PATH RETURNS THE SAME CORPUS AS THE SINGLE-PROCESS PATH. ────
  //       🚨 THIS ROW EXISTS BECAUSE THE FIRST FLOOR RUN LOST 28 MINUTES: five children
  //       computed 11,088 matches correctly and the parent received ZERO, because
  //       `process.send` was raced by `process.exit` at ~900 KB while the same code had
  //       delivered a 10 KB payload perfectly. See `runDesign`. Would fail: any transport
  //       that drops, reorders, duplicates or truncates rows.
  console.log('\n   H · the sharded path');
  {
    const design = buildDesign({ arena: ARENA, n: 2, chars: CHARACTER_IDS.slice(0, 6), rotations: 2, phases: [0], rosterLimit: 0, mirror: false });
    const solo = runShard(ARENA, design, 0, 1, null, false, null);
    const shared = await runDesign(ARENA, design, { jobs: 3 });
    // ⚠️ AND IT IS A STRONGER GUARD THAN IT WAS BUILT TO BE. A shard runs a DIFFERENT
    // SUBSET in a DIFFERENT SEQUENCE (`i % jobs`), in a fresh process, so byte-identity
    // here also proves that a match leaves nothing behind for the next one — no mutated
    // `arena` object (one instance is shared by every match in a shard), no module-level
    // accumulator. §B's re-run cannot show that: it replays the same order twice.
    ok('a 3-way sharded run returns EVERY match, in the single-process order, identically',
      JSON.stringify(solo) === JSON.stringify(shared),
      `${solo.length} vs ${shared.length} rows`);
    ok('…and the corpus is big enough for the merge to be a real merge', design.length >= 30,
      `${design.length} configs across 3 shards`);
  }

  console.log('\n   G · seat symmetry (identical fighters, different seats)');
  {
    const design = buildDesign({ arena: ARENA, n: 6, chars: CHARACTER_IDS, rotations: 6, phases: [0], rosterLimit: 0, mirror: true });
    const rows = runShard(ARENA, design, 0, 1, null, false, null);
    const s = summarise(rows, 6);
    ok('11 mirror rosters (six copies of one character) all score', s.scored === 11, `${s.scored}/11`);
    console.log(`      seat mean placement ${s.seatMean.map((x) => f2(x)).join('  ')}  (flat = 3.50)`);
    const dev = Math.max(...s.seatMean.map((x) => Math.abs(x - 3.5)));
    console.log(`      max deviation from 3.50: ${f3(dev)} places  — this is SEAT BIAS, and it is`);
    console.log('      why the design averages every character over every seat. Run `--mirror`');
    console.log('      with more phases for the real number; 11 matches is not one.');
    ok('the seat means sum to N(N+1)/2 = 21 (the invariant survives aggregation)',
      Math.abs(s.seatMean.reduce((a, b) => a + b, 0) - 21) < 1e-9);
  }

  console.log(`\n   ${pass} passed, ${fail} failed   wall ${((Date.now() - t0) / 1000).toFixed(1)}s`);
  process.exit(fail > 0 ? 1 : 0);
}

// ═════════════════════════════════════════════════════════════════════════════
// --floor : THE RESOLUTION FLOOR. See header §4 for why re-running is NOT this.
// ═════════════════════════════════════════════════════════════════════════════
if (IS_MAIN && args.floor) {
  if (!ARENA) { console.error(`no arena at ${ARENA_PATH}`); process.exit(1); }
  const phases = phaseList();
  if (phases.length < 2) { console.error('nf_ffa --floor needs --phases 2 or more'); process.exit(1); }
  // ⚠️ REFUSED, NOT SILENTLY DEGRADED. With the shipped spawns there is exactly one layout
  // and no RNG, so every "replicate" would be the same match and the tool would print a
  // spread of 0.000 — a confident, beautiful, entirely fictitious floor.
  if (String(args.spawns ?? 'ring') === 'arena') {
    console.error('nf_ffa --floor: `--spawns arena` has NO nuisance parameter — the phase does');
    console.error('  nothing, every replicate is the same match, and the spread would be 0.000.');
    console.error('  Price the SHIPPED spawns with a PAIRED --baseline delta (exact) instead.');
    process.exit(1);
  }
  const chars = args.chars ? String(args.chars).split(',') : CHARACTER_IDS;
  const rotations = Number(args.rotations ?? N);
  const rosterLimit = args.rosters ? Number(args.rosters) : 0;
  const design = buildDesign({ arena: ARENA, n: N, chars, rotations, phases, rosterLimit, mirror: !!args.mirror });

  console.log('\n══ nf_ffa RESOLUTION FLOOR ══');
  header(ARENA, design, N, phases);
  console.log('   The nuisance is the SPAWN-RING PHASE. It rotates every seat by one angle, so it');
  console.log('   preserves the ring\'s own symmetry and CANNOT change any character\'s strength —');
  console.log('   every move it produces is noise BY CONSTRUCTION.');
  console.log('   ⚠️ Re-running an identical configuration would return a BIT-IDENTICAL answer');
  console.log('      (no RNG, no human seat). Spread 0.0 there is determinism, not a floor.\n');

  const t0 = Date.now();
  const rows = await runDesign(ARENA, design, { jobs: Number(args.jobs ?? 1), progress: true });
  const byPhase = phases.map((_, pi) => summarise(rows.filter((r) => r.key.split('|')[1] === String(pi)), N));
  const ids = byPhase[0].table.map((r) => r.id);
  console.log('\n   char           ' + phases.map((_, i) => `phase${i}`.padStart(8)).join('') + '    spread     sd');
  const spreads = [];
  for (const id of ids) {
    const v = byPhase.map((s) => s.table.find((r) => r.id === id).meanPlace);
    const sp = Math.max(...v) - Math.min(...v);
    const m = v.reduce((a, b) => a + b, 0) / v.length;
    const sd = Math.sqrt(v.reduce((a, b) => a + (b - m) ** 2, 0) / (v.length - 1));
    spreads.push({ id, sp, sd });
    console.log(`   ${id.padEnd(14)} ${v.map((x) => f3(x).padStart(8)).join('')}   ${f3(sp).padStart(7)}  ${f3(sd).padStart(5)}`);
  }
  spreads.sort((a, b) => b.sp - a.sp);
  const rms = Math.sqrt(spreads.reduce((a, b) => a + b.sp * b.sp, 0) / spreads.length);
  const sdPool = Math.sqrt(spreads.reduce((a, b) => a + b.sd * b.sd, 0) / spreads.length);
  console.log(`\n   🚨 RESOLUTION FLOOR = ${f3(spreads[0].sp)} places  (max per-character spread, on ${spreads[0].id})`);
  console.log(`      median spread ${f3(spreads[Math.floor(spreads.length / 2)].sp)} · rms ${f3(rms)}`);
  console.log(`      pooled sd across phases ${f3(sdPool)} -> a 2-sd band is ${f3(2 * sdPool)} places.`);
  console.log(`      ⚠️ THE RANGE OF ${phases.length} REPLICATES UNDERSTATES A 95% BAND (E[range of 4] ~ 2.06 sd).`);
  console.log('         Quote the LARGER of the two and say which. Both are printed so neither');
  console.log('         can be quoted without the other being visible.');
  console.log(`      ⚠️ DO NOT ACT ON A MEAN-PLACEMENT DIFFERENCE SMALLER THAN THE MAX.`);
  console.log(`      ⚠️ A PAIRED per-config delta on identical phases is EXACT and is a DIFFERENT`);
  console.log('         quantity — use --baseline for that, and never add the two.');
  // The pooled table costs nothing extra — the matches are already run — and it is the
  // BEST estimate this corpus supports. ⚠️ Its own floor is SMALLER than the number above,
  // which is measured on one phase's worth of matches. Labelled, never conflated.
  printTable(summarise(rows, N), {
    title: `POOLED over all ${phases.length} phases (${rows.length} matches) — best estimate;`
      + ` ⚠️ the floor above is for ONE phase (${rows.length / phases.length} matches)`,
  });
  console.log(`\n   ${design.length} matches over ${phases.length} phases · wall ${((Date.now() - t0) / 1000).toFixed(1)}s`);
  if (args.json) writeFileSync(String(args.json), JSON.stringify({ mode: 'floor', n: N, phases, rows }, null, 0));
  process.exit(0);
}

// ═════════════════════════════════════════════════════════════════════════════
// DEFAULT: the sweep (and --mirror, which is the same sweep on mirror rosters)
// ═════════════════════════════════════════════════════════════════════════════
if (IS_MAIN) {
  if (!ARENA) { console.error(`no arena at ${ARENA_PATH}`); process.exit(1); }
  if (N < MIN_FIGHTERS || N > MAX_FIGHTERS) {
    console.error(`nf_ffa: N=${N}; the sim seats ${MIN_FIGHTERS}..${MAX_FIGHTERS}`); process.exit(1);
  }
  const phases = phaseList();
  const chars = args.chars ? String(args.chars).split(',') : CHARACTER_IDS;
  const rotations = Number(args.rotations ?? N);
  const rosterLimit = args.rosters ? Number(args.rosters) : 0;
  const boost = parseBoost();
  const design = buildDesign({ arena: ARENA, n: N, chars, rotations, phases, rosterLimit, mirror: !!args.mirror });

  console.log(`\n══ nf_ffa — ${args.mirror ? 'SEAT BIAS (mirror rosters)' : 'FREE-FOR-ALL BALANCE'} ══  N=${N}`);
  header(ARENA, design, N, phases);
  if (args.mirror) {
    console.log('   MIRROR: every roster is six copies of ONE character, so every fighter in a match');
    console.log('   is identical and ALL spread between seats is seat effect — spawn point and the');
    console.log('   fighter loop\'s slot order. This is the "identical fighters must come out equal"');
    console.log('   validation, and the number it prints is why the design averages over seats.');
  } else {
    console.log(`   design: ${args.rosters ? `${rosterLimit} of ` : 'ALL '}C(${chars.length},${N}) rosters x ${rotations} cyclic seat rotations`
      + ` x ${phases.length} ring phase${phases.length > 1 ? 's' : ''}`);
  }
  if (boost) console.log(`   ⚠️ BOOST ACTIVE — ${boost.id}`
    + `${boost.hp !== undefined ? ` maxHp x${boost.hp}` : ''}${boost.level !== undefined ? ` level ${boost.level}` : ''}`
    + '. This is a KNOWN-BAD stimulus, not a balance run.');
  console.log('   ⚠️ Measured under the SHIPPED BOT POLICY on every seat (`ai.ts:stepAI`). NOT');
  console.log('      comparable to roster_lab / match-sim, whose 110 cells are scripted-vs-bot.');

  const t0 = Date.now();
  const rows = await runDesign(ARENA, design, { jobs: Number(args.jobs ?? 1), boost, progress: true });
  const s = summarise(rows, N);
  printTable(s, { title: args.mirror ? 'per-character (each row is a six-copy mirror roster)' : 'per-character, over every roster it appears in' });

  if (!args.mirror) {
    const seatsFlat = s.table.every((r) => r.seats.every((x) => x === r.seats[0]));
    console.log(`   seat balance  ${seatsFlat ? 'FLAT' : '⚠️ NOT FLAT'} — every character ${s.table[0].seats.join('/')} per seat`);
  }
  console.log(`\n   wall ${((Date.now() - t0) / 1000).toFixed(1)}s`);

  if (args.json) {
    writeFileSync(String(args.json), JSON.stringify({
      tool: 'nf_ffa', n: N, phases, rotations, rosterLimit, boost, dt: DT,
      arena: { id: ARENA.id, w: ARENA.width, h: ARENA.height, maxSafeRadius: ARENA.maxSafeRadius },
      summary: { table: s.table, seatMean: s.seatMean, tiesPerMatch: s.tiesPerMatch, knockouts: s.knockouts, timeouts: s.timeouts },
      rows,
    }, null, 0));
    console.log(`   wrote ${args.json}`);
  }

  if (args.baseline) {
    const base = JSON.parse(readFileSync(String(args.baseline), 'utf8'));
    const byKey = new Map(base.rows.map((r) => [r.key, r]));
    let paired = 0, movedConfigs = 0, mismatched = 0;
    const perChar = new Map();
    for (const r of rows) {
      const b = byKey.get(r.key);
      if (!b || r.fault || b.fault) continue;
      // 🚨 THE KEY IS `n|phase|roster|rotation` — it identifies the DESIGN CELL, not the
      // roster contents. If the character list or the enumeration order moved between the
      // two runs, the same key holds different fighters and the "paired" delta would be a
      // comparison of two different matches wearing one label. Checked, not assumed.
      if (JSON.stringify(r.ids) !== JSON.stringify(b.ids)) { mismatched++; continue; }
      paired++;
      if (JSON.stringify(r.place) !== JSON.stringify(b.place)) movedConfigs++;
      for (let seat = 0; seat < N; seat++) {
        const id = r.ids[seat];
        const a = perChar.get(id) ?? { n: 0, d: 0, maxAbs: 0 };
        const d = r.place[seat] - b.place[seat];
        a.n++; a.d += d; a.maxAbs = Math.max(a.maxAbs, Math.abs(d));
        perChar.set(id, a);
      }
    }
    if (mismatched) console.log(`   ⚠️ ${mismatched} keys held a DIFFERENT roster in the baseline and were DROPPED — the design moved.`);
    console.log('\n   ── PAIRED PER-CONFIG DELTA (identical rosters, seats and phases) ──');
    console.log('   ⚠️ EXACT. A DIFFERENT QUANTITY from the aggregate table above. Never added to it.');
    console.log(`   ${movedConfigs} of ${paired} configs moved`);
    console.log('   char            Δ meanPlace   max |Δ| in one match');
    for (const [id, a] of [...perChar.entries()].sort((x, y) => x[1].d / x[1].n - y[1].d / y[1].n)) {
      console.log(`   ${id.padEnd(14)}  ${((a.d / a.n) >= 0 ? '+' : '') + f3(a.d / a.n).padStart(7)}          ${f2(a.maxAbs)}`);
    }
  }
  process.exit(0);
}
