#!/usr/bin/env node
/**
 * AS_COST — what "the AI has no search behaviour" actually COSTS, measured before
 * anybody writes a search behaviour.
 *
 * ── Why this exists, and why it is not "build search" ───────────────────────
 *
 * `src/arena/types.ts:95` records the constraint — `stepAI` walks to where it last saw
 * its target and stops, seeing `CONCEAL_REVEAL_RADIUS` (84 wu) from there — and three
 * decisions already pay for it:
 *
 *   `DECISIONS §29a`  concealment patches capped at ~168 wu so no patch has a core the
 *                     AI cannot see into. Six regions shipped at 110-130 wu BECAUSE of it.
 *   `DECISIONS §48`   a x4 arena costs +12.77 s to first contact, and one centre pot with
 *                     dense cover drove 542-801 of 880 matches to ZERO contact — traced to
 *                     "the AI stalled 50% of the match, longest unbroken stall 18.6 s".
 *   `DECISIONS §48`   *"an AI that searches is a separate feature with its own balance cost."*
 *
 * Every one of those is an argument for building search. **None of them measures what
 * search would BUY**, and two of them were measured on a map that had no concealment at
 * all (the six regions shipped 2026-08-11, after §48 was written). So this file measures
 * the thing first.
 *
 * ── THE DESIGN, AND WHY THE ORACLE IS THE RIGHT COUNTERFACTUAL ──────────────
 *
 * "No search" has to be priced against something. The honest counterfactual is not some
 * particular search behaviour — that would price one candidate, not the constraint — but
 * the BEST any perception-side behaviour could possibly do: an AI whose belief is never
 * stale. So:
 *
 *   SHIPPED   the working tree, unmodified.
 *   ORACLE    `visible` forced true in `ai.ts` and nothing else. The belief refreshes
 *             every tick, so the AI never has a last-seen point to walk to and stop at.
 *
 * **ORACLE - SHIPPED is a hard upper bound on what ANY search behaviour can buy**, because
 * a search behaviour is a rule for guessing where the target went and an oracle already
 * knows. If that gap is inside a metric's resolution floor, the answer to "should we build
 * search" is no, and no amount of candidate design changes it.
 *
 * ⚠️ THE ORACLE PATCHES `ai.ts` ONLY, DELIBERATELY. `sim.ts:stepProjectiles` re-aims homing
 * projectiles through the same `isVisibleFrom` predicate (§29c), and a search behaviour
 * could never change that, so leaving it alone is what keeps the bound honest rather than
 * generous.
 *
 * ── AND THE SPLIT THAT DECIDES THE SHAPE ────────────────────────────────────
 *
 * §48 read the x4 collapse as a search problem: *"the searchless AI is the binding
 * constraint."* That is a hypothesis about a mechanism, and the two mechanisms it conflates
 * are separable by measurement:
 *
 *   PERCEPTION STALL   the AI is standing still with a STALE belief — it arrived at the
 *                      last-seen point and has nothing left to do. Search would fix this.
 *   NAV STALL          the AI is standing still with a FRESH belief — it can see exactly
 *                      where the target is and cannot get there. Search would fix NOTHING;
 *                      this is `movement.ts` (and `NAV_MAX_CELLS` halving the grid
 *                      resolution at 2800x2000, which `git log -1 0206204` routed out).
 *
 * `--census` books every stalled tick to one or the other. That single split is the
 * deliverable: it says whether the x4 pacing collapse is a search problem at all.
 *
 * ── WHAT IT REUSES, AND THE TWO TRAPS IN REUSING THEM ───────────────────────
 *
 *   `tools/tmp/scripted_player.mjs`  the ONE driver, imported (`driver_guard`'s census
 *                                    fails a private copy). The census below reproduces
 *                                    `roster_lab.mjs`'s seed formula exactly, so a census
 *                                    row and a balance row are the SAME MATCH.
 *   `tools/tmp/ax_layout.mjs`        `scaleArena`, for the x4 fixtures.
 *   `tools/tmp/roster_lab.mjs`       the balance arms, as a subprocess, with `--baseline`
 *                                    so the paired per-matchup delta comes from the tool
 *                                    that already prints it correctly.
 *
 * 🚨 TRAP 1 — `ax_layout.mjs:scaleArena` SILENTLY DROPS `arena.concealment`. Its `out`
 * object never carries the field, in any mode, including `copy`. Its own selftest compares
 * `mode=copy` against a hand-built literal that omits the field too, so the assertion
 * "mode=copy is bit-identical to the shipped dump" passes on a dump that has LOST six
 * regions. That was harmless when it was written (no arena declared any) and is not
 * harmless now. Routed out of set, not fixed here; this file carries `concealment` itself
 * and `--selftest` asserts the drop so the workaround cannot rot silently.
 *
 * 🚨 TRAP 2 — `ax_layout.mjs` HAS NO `IS_MAIN` GUARD: importing it runs its CLI path, which
 * reads the IMPORTER's `process.argv`. This was not a theoretical risk — it fired on the
 * first run of this file. `node tools/tmp/as_cost.mjs --selftest` printed **ax_layout's**
 * selftest, all 22 assertions, and `process.exit(0)` before a single line of this file's
 * own selftest ran. A green wall of PASS from a tool you did not invoke, and an exit code
 * of 0. With `--out` in argv it would have WRITTEN A FILE instead.
 *
 * So the import is shielded: `process.argv` is blanked across it and restored after. That
 * is a workaround for a defect in a file this pass does not own, declared here and asserted
 * in `--selftest` with the unshielded import as its known-bad. Routed out of set.
 *
 * ⚠️ TIMING IS UNTOUCHED IN EVERY ARM. The scripted driver decides during the countdown and
 * draws from the seeded stream, so a change to ANY timing re-seeds every match (+0.01 s once
 * moved 38 of 110 matchups by up to 50 pp, entirely fictitiously). No arm here alters
 * `COUNTDOWN_FROM`, `dt`, cooldowns or the reaction cadence.
 *
 * ── Use ────────────────────────────────────────────────────────────────────
 *   node tools/tmp/as_cost.mjs --selftest
 *   node tools/tmp/as_cost.mjs --fixtures                     # write the arena fixtures
 *   node tools/tmp/as_cost.mjs --census --map 1x --seeds 8
 *   node tools/tmp/as_cost.mjs --arms shipped,oracle --map 1x --seeds 8
 *
 * ⚠️ RESOLUTION FLOORS, stated before any number is acted on: aggregate win rate ~9 pp;
 * pacing ~0.8 s of contact / ~4 pp dead time. A PAIRED per-matchup delta on identical
 * seeds is EXACT and is a DIFFERENT QUANTITY — never added to an aggregate.
 */

import { readFileSync, writeFileSync, existsSync, mkdirSync, rmSync } from 'node:fs';
import { execFileSync } from 'node:child_process';
import { tmpdir } from 'node:os';
import { join, resolve } from 'node:path';
import { createHash } from 'node:crypto';
import { createScriptedPlayer, rng, parseDriverFlags } from './scripted_player.mjs';

const ROOT = resolve(new URL('../..', import.meta.url).pathname);

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

/**
 * `ax_layout.mjs` runs its whole CLI on import (no `IS_MAIN` guard) and reads OUR argv:
 * `--selftest` makes it print its own 22 assertions and EXIT, `--out` makes it write a
 * file. Blank the argv across the import and put it back. `--selftest` D-block proves the
 * shield is load-bearing by importing it unshielded in a child process.
 */
async function importShielded(spec) {
  const saved = process.argv;
  process.argv = [saved[0], saved[1]];
  try { return await import(spec); } finally { process.argv = saved; }
}

// ─────────────────────────────────────────────────────────────────────────────
// THE TREE CONTROL — per FILE, never per directory
// ─────────────────────────────────────────────────────────────────────────────
/**
 * `src/game/` is shared between owners, so a hash over the directory moves when a peer
 * commits something unrelated and says nothing about the files these numbers came from
 * (`1b506d6` discarded two whole batteries to learn that). Hash the seven, before and
 * after, and refuse to publish a number measured across a moving tree.
 */
const SIM_MODULES = ['sim.ts', 'ai.ts', 'movement.ts', 'combat.ts', 'state.ts', 'rules.ts'];
const CONTROL_FILES = [...SIM_MODULES.map((f) => `src/game/${f}`), 'src/arena/types.ts'];
const controlHashes = () => Object.fromEntries(CONTROL_FILES.map((f) =>
  [f, createHash('sha256').update(readFileSync(`${ROOT}/${f}`)).digest('hex').slice(0, 8)]));

// ─────────────────────────────────────────────────────────────────────────────
// ARENA FIXTURES — and the concealment `ax_layout` loses
// ─────────────────────────────────────────────────────────────────────────────

const { scaleArena, pointSymmetryFaults } = await importShielded(`${ROOT}/tools/tmp/ax_layout.mjs`);
const RULES = await import(`${ROOT}/src/game/rules.ts`);
const { MATCH_DURATION_MS, CONCEAL_REVEAL_RADIUS, concealmentKeepoutRadius } = RULES;

/**
 * Tile a concealment list the same way `ax_layout` tiles cover — k x k with odd tiles
 * mirrored — so patch COUNT scales with area and patch SIZE does not.
 *
 * That is §48 rule 5 stated as code: *"the concealment ceiling does NOT scale —
 * `CONCEAL_REVEAL_RADIUS` is fixed, so patches stay capped at ~168 wu however big the map
 * gets, and a 4x map wants ~4x the patch COUNT."* A tiling that scaled `w`/`h` instead
 * would build exactly the permanent AI-denial zone §29a exists to forbid, and the run
 * would then be measuring a layout defect and calling it a search cost.
 */
function tileConcealment(regions, srcW, srcH, k) {
  const out = [];
  for (let ix = 0; ix < k; ix++) {
    for (let iy = 0; iy < k; iy++) {
      const fx = ix % 2 === 1;
      const fy = iy % 2 === 1;
      for (const b of regions) {
        out.push({
          ...b,
          x: ix * srcW + (fx ? srcW - b.x : b.x),
          y: iy * srcH + (fy ? srcH - b.y : b.y),
        });
      }
    }
  }
  return out;
}

/** Regions whose NEAREST point reaches inside the endgame keepout — §29a's annulus rule. */
function keepoutViolations(arena) {
  const r = concealmentKeepoutRadius(arena.maxSafeRadius);
  return (arena.concealment ?? []).filter((b) => {
    const dx = Math.max(0, Math.abs(arena.center.x - b.x) - b.w / 2);
    const dy = Math.max(0, Math.abs(arena.center.y - b.y) - b.h / 2);
    return Math.hypot(dx, dy) < r;
  });
}

/** The §29a size ceiling: no interior point further than the reveal radius from an edge. */
function oversizedPatches(arena) {
  return (arena.concealment ?? []).filter((b) => Math.max(b.w, b.h) > 2 * CONCEAL_REVEAL_RADIUS);
}

/**
 * Every box's 180° partner about the map centre exists — the same fairness property
 * `ax_layout:pointSymmetryFaults` asserts for `cover`, which cannot see this list.
 */
function boxSymmetryFaults(boxes, center, tol = 1e-6) {
  return boxes.filter((b) => !boxes.some((o) =>
    Math.abs(o.x - (2 * center.x - b.x)) <= tol && Math.abs(o.y - (2 * center.y - b.y)) <= tol
    && Math.abs(o.w - b.w) <= tol && Math.abs(o.h - b.h) <= tol));
}

/**
 * Build a fixture. `k === 1` is the SHIPPED map, concealment included — which is the whole
 * point: §48's numbers predate the six regions, so a "before" taken on `ax_layout`'s output
 * would be a before on a map that no longer exists.
 */
function fixture(src, mode, k, onePot = false) {
  const a = scaleArena(src, { mode, k, matchDurationMs: MATCH_DURATION_MS, onePot });
  const regions = src.concealment ?? [];
  a.concealment = mode === 'copy' ? regions.map((b) => ({ ...b }))
    : tileConcealment(regions, src.width, src.height, k);
  /**
   * ⚠️ AND THE TILING CANNOT KEEP ALL 4k^2 OF THEM — the ENDGAME ANNULUS GREW.
   *
   * `concealmentKeepoutRadius` is `maxSafeRadius * 0.25`, and `maxSafeRadius` is derived
   * from the half-diagonal, so it DOUBLES with the map: 248.25 wu at 1400x1000, 496.25 at
   * 2800x2000. A tiling that holds patch density therefore drops 4 of 24 patches into the
   * hub's keep-out, where §29a forbids them. They are removed here, which is why the x4
   * fixture carries fewer than 4x the patches and why that is the right number rather than
   * a shortfall. Symmetric by construction — the shipped map is point-symmetric and the
   * mirror tiling preserves it, so a violating box's partner is the same distance out and
   * goes with it. Asserted, not assumed (`--selftest` B7).
   */
  a.concealment = a.concealment.filter((b) => !keepoutViolations({ ...a, concealment: [b] }).length);
  return a;
}

const FIXDIR = `${ROOT}/tools/tmp/as`;
const MAPS = {
  '1x': { file: `${FIXDIR}/arena_1x.json`, mode: 'copy', k: 1, label: 'shipped 1400x1000 + 6 concealment regions' },
  '2x': { file: `${FIXDIR}/arena_2x_hub.json`, mode: 'hub', k: 2, label: '2800x2000 §48 hub rules + concealment' },
  /**
   * §48's WORST arm, and the one it traced to the searchless AI: *"ONE pot at the exact
   * centre with dense cover: contact 36.6 s, duty 3.3%, 542-801 of 880 matches with ZERO
   * contact… Traced: AI stalled 50% of the match, longest unbroken stall 18.6 s."* It is a
   * `tile --one-pot`, NOT the `hub` arm, so measuring `hub` and concluding anything about
   * that sentence would be answering a different question.
   */
  '2x-onepot': { file: `${FIXDIR}/arena_2x_onepot.json`, mode: 'tile', k: 2, onePot: true, label: '2800x2000 uniform tiling, ONE centre pot — §48\'s worst arm' },
  '1x-noconceal': { file: `${FIXDIR}/arena_1x_noconceal.json`, mode: 'copy', k: 1, strip: true, label: 'shipped 1400x1000, concealment stripped' },
};

function writeFixtures() {
  /**
   * `--src` builds the fixtures from a DIFFERENT dump — `git show <sha>:tools/…` — which is
   * the only way to ask "was §48's result a property of the layout it was measured on?".
   * The layout moved on 2026-08-11 (`b9bc00e` closed 14 unreachable pockets and added the
   * six concealment regions), and §48 was measured the day before, so a re-run on today's
   * map is not a reproduction attempt.
   */
  const src = JSON.parse(readFileSync(String(args.src ?? `${ROOT}/tools/arena.gameplay.json`), 'utf8'));
  mkdirSync(FIXDIR, { recursive: true });
  for (const [name, m] of Object.entries(MAPS)) {
    const a = fixture(src, m.mode, m.k, !!m.onePot);
    if (m.strip) a.concealment = [];
    writeFileSync(m.file, JSON.stringify(a, null, 2));
    const dens = a.cover.reduce((s, c) => s + c.w * c.h, 0) / (a.width * a.height);
    console.log(`  ${name.padEnd(14)} ${a.width}x${a.height} · cover ${String(a.cover.length).padStart(3)} (${(dens * 100).toFixed(2)}%)`
      + ` · conceal ${String(a.concealment.length).padStart(2)} · hazards ${a.hazards.length} · msr ${a.maxSafeRadius}`
      + ` · keepout viol ${keepoutViolations(a).length} · oversize ${oversizedPatches(a).length}`
      + ` · symmetry faults ${pointSymmetryFaults(a).length}`);
  }
  console.log(`  wrote -> ${FIXDIR}`);
}

// ─────────────────────────────────────────────────────────────────────────────
// STAGED SIM ARMS — literal source edits, applied outside the repo
// ─────────────────────────────────────────────────────────────────────────────
/**
 * Every arm is a COPY of the working tree with a named edit applied, written to the OS
 * temp dir. Nothing under `src/` is touched, so a peer measuring on the same tree is
 * unaffected and the `shipped` arm is the working tree byte for byte — which is what makes
 * the SELF-PAIR below a real drift control rather than a tautology.
 *
 * `applied` is returned per edit so an arm whose anchor has drifted REPORTS A MISS instead
 * of quietly measuring the unpatched sim, which is the single likeliest way a source-patch
 * A/B lies (both arms come back byte-identical, which reads exactly like "the change did
 * nothing" — a normal outcome here, so nobody re-checks it).
 */
const ARM_EDITS = {
  shipped: [],
  /**
   * THE SELF-PAIR DRIFT CONTROL. A second staging of the same sim with a PROVABLY
   * non-behavioural edit — one character of whitespace inside a comment — run through the
   * whole pipeline (stage -> subprocess -> json -> paired diff) as if it were a candidate.
   * It must come back 0/110 on every policy. Without it, "0/110 bit-identical" for the real
   * arm is not evidence the arm did nothing; it is equally consistent with a harness that
   * cannot tell two arms apart, which is the failure `rg_lib`'s `--ref` bug produced and
   * which reads exactly like a null result.
   */
  'self-pair': [['ai.ts', ' * Enemy AI controller.', ' *  Enemy AI controller.']],
  /**
   * The belief never goes stale. `|| true` rather than a bare `true` so the predicate is
   * still CALLED — the arm is about the AI's decision, not about deleting a hypot from the
   * tick, and a tick-cost comparison against it would otherwise be measuring the wrong
   * thing.
   */
  oracle: [['ai.ts',
    'const visible = isVisibleFrom(self.x, self.y, target.x, target.y, state.arena, state, target);',
    'const visible = isVisibleFrom(self.x, self.y, target.x, target.y, state.arena, state, target) || true;']],
  /**
   * 🚨 THE ONLY ARM THAT TOUCHES A FILE OUTSIDE THIS PASS'S SET, AND IT IS A MEASUREMENT
   * ARM ONLY — nothing under `src/` is written, ever. `movement.ts` belongs to §48's owner.
   *
   * Why it has to exist: the residual stall at 2800x2000 is 5.16% of samples with a
   * FRESH belief, i.e. not a perception problem, and the leading hypothesis is already
   * written down — `git log -1 0206204` routed out that `NAV_MAX_CELLS` is 40,000 while
   * 2800x2000 at the shipped 10 wu cell needs 56,000, so `navGrid` doubles the cell to
   * 20 wu, and `NAV_CELL`'s own doc records that **cell 20 already failed the kitchen's
   * tightest legal gap**. A hypothesis with a one-constant test is worth one arm; reporting
   * "search will not fix the x4 stall" without saying what WILL is half an answer.
   *
   * The arm raises the ceiling so the x4 map keeps cell 10 (2800x2000/100 = 56,000). If the
   * stall collapses, the residual is grid RESOLUTION and belongs to §48. If it does not,
   * the hypothesis is dead and nobody has to spend a pass on it.
   */
  navcells: [['movement.ts', 'const NAV_MAX_CELLS = 40_000;', 'const NAV_MAX_CELLS = 160_000;']],
};

/**
 * 🚨 `--head` — AND IT IS NOT OPTIONAL POLISH, IT IS THE REASON THESE NUMBERS SURVIVED.
 *
 * `src/game/` is shared. Mid-pass, a peer saved `rules.ts` and `sim.ts` 21 seconds before a
 * gate run, and the working tree stopped compiling (`sim.ts` referencing a constant that had
 * been renamed). The per-run tree control below catches a tree that moves DURING a run; it
 * cannot catch one that was already someone else's half-finished edit when the run started.
 *
 * With `--head` every arm is extracted with `git show HEAD:` instead of read off disk, so an
 * arm is a property of a COMMIT. That is `CLAUDE.md` non-negotiable 1 applied to a
 * measurement rather than to a push: verify the committed tree, not your working tree.
 */
const HEAD_SIM = !!args.head;
function readSim(rel) {
  return HEAD_SIM
    ? execFileSync('git', ['show', `HEAD:${rel}`], { cwd: ROOT, encoding: 'utf8' })
    : readFileSync(`${ROOT}/${rel}`, 'utf8');
}

function stageArm(arm) {
  const edits = ARM_EDITS[arm];
  if (!edits) throw new Error(`unknown arm ${arm}`);
  const root = join(tmpdir(), `fa-as-${HEAD_SIM ? 'head-' : ''}${arm}`);
  const dir = join(root, 'game');
  rmSync(root, { recursive: true, force: true });
  mkdirSync(dir, { recursive: true });
  mkdirSync(join(root, 'arena'), { recursive: true });
  for (const f of SIM_MODULES) writeFileSync(join(dir, f), readSim(`src/game/${f}`));
  writeFileSync(join(root, 'arena', 'types.ts'), readSim('src/arena/types.ts'));
  const applied = [];
  for (const [file, from, to] of edits) {
    const before = readFileSync(join(dir, file), 'utf8');
    const after = before.split(from).join(to);
    applied.push(after !== before);
    writeFileSync(join(dir, file), after);
  }
  return { dir, applied, ok: applied.every(Boolean) };
}

// ─────────────────────────────────────────────────────────────────────────────
// THE CENSUS — per tick, what the AI believes and whether it is moving
// ─────────────────────────────────────────────────────────────────────────────
/**
 * Reproduces `roster_lab.mjs:runMatch`'s seeding EXACTLY — same formula, same reaction
 * cadence, same `dt` — so a census row and a balance row are the same match and the two
 * tables can be read against each other. It measures things `roster_lab` does not: the
 * belief's age, and what the AI is doing while that age is non-zero.
 *
 * ⚠️ NOTHING HERE RE-DERIVES A PERCEPTION DECISION. `state.sightings[...]` is the cell
 * `stepAI` wrote this tick, so `elapsed - sighting.at` is the AI's belief age as the AI
 * itself computed it. A census that called `isVisibleFrom` again would be measuring a
 * second implementation of the rule — which is this project's oldest defect shape.
 */
async function census({ simDir, arena, seeds, policy, dt }) {
  const { createMatch, stepMatch } = await import(`${simDir}/sim.ts`);
  const R = await import(`${simDir}/rules.ts`);
  const S = await import(`${simDir}/state.ts`);
  const { CHARACTERS, CHARACTER_IDS, REACH } = R;
  const { nearestLivingOpponent, sightingIndex } = S;

  /**
   * ⚠️ `pressValue` AND `selfHealHpFraction` COME FROM THE ARM'S OWN SIM, NOT THE TREE'S.
   * `scripted_player.mjs` resolves them from `--sim` on argv or falls back to `src/game`;
   * this file stages arms in the OS temp dir and never puts them on argv, so an unqualified
   * call would rank a STAGED sim's kit with the WORKING TREE's ranking key. The driver
   * throws rather than ranking wrongly (its own known-bad check), which is how this was
   * caught — but the fix is to pass them, not to silence it.
   */
  /**
   * ── AND THE NAV COUNTERS, WHICH ARE HOW A SEARCH BEHAVIOUR GETS PRICED WITHOUT
   *    BEING WRITTEN ─────────────────────────────────────────────────────────
   *
   * `movement.ts:navSteer` rebuilds the whole BFS flow field whenever the requested GOAL
   * CELL changes (`if (g.requestedGoal !== goal …) navBuildField(g, goal)`), and there is
   * ONE grid per arena. So the cost of a goal is not "a path query" — it is a full flood,
   * amortised across every tick the goal stays put.
   *
   * That inverts the intuition about search. TODAY, a stale belief FREEZES the goal at the
   * last-seen point, which is the CHEAPEST state the pathfinder can be in. Every candidate
   * search behaviour — sweep the area, head for the nearest patch, widen a radius — MOVES
   * that goal, and each move is another flood. `navStats` is exported for exactly this kind
   * of question, so the price can be measured on the shipped AI instead of guessed at after
   * building a candidate.
   */
  const M = await import(`${simDir}/movement.ts`);
  M.navStats.reset();
  const A = await import(`${simDir}/ai.ts`);
  const driver = createScriptedPlayer({
    CHARACTERS, REACH, arena,
    pressValue: A.pressValue, selfHealHpFraction: R.AI_SELF_HEAL_HP_FRACTION,
    ...parseDriverFlags(args),
  });

  /**
   * "Standing still" has to be judged against the step the fighter WOULD have taken, not
   * against an absolute epsilon: `speedFor` differs per character, so a fixed threshold
   * would book a slow character's normal walk as a stall. 35% of the step is
   * `moveToward`'s own progress bar — the value it uses to decide a candidate move
   * counted as movement at all — so a tick below it is a tick `movement.ts` itself would
   * not call progress.
   */
  const stallFrac = 0.35;

  /**
   * ── AND THE SECOND STALL DEFINITION, WHICH IS THE ONE §48's NUMBER IS IN ────
   *
   * `tools/match-sim.mjs:625` is where *"the AI stalled 50% of the match, longest unbroken
   * stall 18.6 s"* comes from, and it does NOT mean "motionless". It means: sampled every
   * 100 ms, the AI's positional SPAN over a 3 s window is under 15 wu **while it is outside
   * its own reach and should therefore be closing**. A fighter sliding in circles inside a
   * pocket is stalled by that rule and moving by a per-tick one — which is exactly the
   * failure this instrument had on its first known-bad run, so both are kept and both are
   * reported. Reproducing the definition rather than the number is the point: the number is
   * from a different arena.
   */
  const SPAN_SAMPLE_MS = 100;
  const SPAN_WIN = Math.max(1, Math.round(3000 / SPAN_SAMPLE_MS));
  const SPAN_LIMIT = 15;

  const acc = {
    matches: 0, playTicks: 0, mobileTicks: 0,
    staleTicks: 0, stalledTicks: 0,
    stallStale: 0, stallFresh: 0,
    firedTicks: 0, parkedTicks: 0, rootedTicks: 0, deadTicks: 0,
    episodes: [], unresolvedEpisodes: 0,
    maxStaleMs: 0, maxStallMs: 0,
    beliefErrSum: 0, beliefErrN: 0,
    spanSamples: 0, spanStalled: 0, spanStale: 0, spanFresh: 0, maxSpanStallMs: 0,
  };

  for (const p of CHARACTER_IDS) {
    for (const e of CHARACTER_IDS) {
      if (p === e) continue;
      for (let s = 0; s < seeds; s++) {
        const rnd = rng(s * 7919 + p.length * 131 + e.length * 17 + policy.length);
        const state = createMatch(arena, p, e);
        const decide = driver.POLICY_FNS[policy](rnd);
        const loop = driver.createDecisionLoop({ decide, reactBase: 150, reactJit: s === 0 ? 0 : 60, rnd });
        const HARD_CAP = MATCH_DURATION_MS * 1.6 + 20000;
        // The seat this census is about is the one `stepMatch` drives with `stepAI`, and
        // that branch is on `controller`, never on the name `enemy` (`sim.ts:502`). Check
        // it rather than assume it: a census of the HUMAN seat's belief would be all zeros
        // and would read exactly like "search is free".
        if (state.enemy.controller !== 'ai') throw new Error('census: seat 1 is not AI-controlled');
        let prevX = state.enemy.x, prevY = state.enemy.y;
        let staleRun = 0, stallRun = 0;
        acc.matches++;
        const eReach = driver.maxNormalRange(e) + R.HIT_RADIUS_VS_PLAYER;
        const samples = [];
        let sinceSample = SPAN_SAMPLE_MS;
        let spanRun = 0;
        while (state.phase !== 'ended' && state.elapsed < HARD_CAP) {
          const evs = stepMatch(state, dt, loop.next(state, dt));
          if (state.phase !== 'playing') { prevX = state.enemy.x; prevY = state.enemy.y; continue; }
          acc.playTicks++;
          const ai = state.enemy;
          const target = nearestLivingOpponent(state, ai);
          if (target === null) { prevX = ai.x; prevY = ai.y; continue; }
          const sight = state.sightings[sightingIndex(ai.id, target.id, state.fighters.length)];
          const staleMs = state.elapsed - sight.at;
          const stale = staleMs > 0;
          const moved = Math.hypot(ai.x - prevX, ai.y - prevY);
          /**
           * ⚠️ THE EXPECTED STEP IS THE ONE THIS FIGHTER WOULD HAVE TAKEN, SLOW INCLUDED.
           * `speedFor` differs per character and `AI_SLOW_MULTIPLIER` applies while a status
           * slow is live, so a fixed threshold books a slowed heavy's normal walk as a
           * stall. `stallFrac` is `moveToward`'s own progress bar — below it is a tick
           * `movement.ts` itself would not count as progress.
           */
          const slowed = state.elapsed < ai.status.slowedUntil;
          const step = R.speedFor(ai.characterId, R.AI_CHASE_SPEED) * dt * (slowed ? R.AI_SLOW_MULTIPLIER : 1);
          const stalled = moved < step * stallFrac;
          const fired = evs.some((v) => v.type === 'weapon-fired' && v.fighterId === ai.id);
          /**
           * A DEAD or STUNNED fighter is standing still BY RULE, and booking either as a
           * stall would indict `movement.ts` for `sim.ts`'s behaviour. `rooted` is exactly
           * `stepAI`'s own name and test for the stun; a dead AI is still stepped for the
           * ticks between the death and `match-ended`.
           */
          const dead = ai.hp <= 0;
          const rooted = state.elapsed < ai.status.stunnedUntil;
          if (dead) acc.deadTicks++;
          else if (rooted) acc.rootedTicks++;
          else acc.mobileTicks++;

          if (stale) {
            acc.staleTicks++;
            staleRun += dt;
            if (staleRun > acc.maxStaleMs) acc.maxStaleMs = staleRun;
            acc.beliefErrSum += Math.hypot(sight.x - target.x, sight.y - target.y);
            acc.beliefErrN++;
            // "Walked to the last-seen point and stopped" — the literal §29a/§48 failure.
            if (stalled && Math.hypot(ai.x - sight.x, ai.y - sight.y) < 40) acc.parkedTicks++;
          } else {
            if (staleRun > 0) acc.episodes.push(staleRun);
            staleRun = 0;
          }
          if (fired) acc.firedTicks++;
          // A fighter that is FIRING is standing still on purpose — the chase branch fires
          // OR moves, never both — so booking that as a stall would indict engagement.
          if (stalled && !fired && !dead && !rooted) {
            acc.stalledTicks++;
            stallRun += dt;
            if (stallRun > acc.maxStallMs) acc.maxStallMs = stallRun;
            if (stale) acc.stallStale++; else acc.stallFresh++;
          } else stallRun = 0;
          prevX = ai.x; prevY = ai.y;

          // ── match-sim's span rule, at its own 100 ms sampling ──────────────
          sinceSample += dt;
          if (sinceSample >= SPAN_SAMPLE_MS) {
            sinceSample = 0;
            samples.push({ x: ai.x, y: ai.y, d: Math.hypot(ai.x - target.x, ai.y - target.y), stale });
            if (samples.length > SPAN_WIN) {
              acc.spanSamples++;
              const w = samples.slice(-SPAN_WIN - 1);
              const xs = w.map((s) => s.x), ys = w.map((s) => s.y);
              const span = Math.hypot(Math.max(...xs) - Math.min(...xs), Math.max(...ys) - Math.min(...ys));
              if (span < SPAN_LIMIT && w[w.length - 1].d > eReach) {
                acc.spanStalled++;
                spanRun += SPAN_SAMPLE_MS;
                if (spanRun > acc.maxSpanStallMs) acc.maxSpanStallMs = spanRun;
                if (w[w.length - 1].stale) acc.spanStale++; else acc.spanFresh++;
              } else spanRun = 0;
            }
          }
        }
        if (staleRun > 0) { acc.episodes.push(staleRun); acc.unresolvedEpisodes++; }
      }
    }
  }
  acc.nav = {
    cell: M.navStats.cellSize, cols: M.navStats.cols, rows: M.navStats.rows,
    fieldBuilds: M.navStats.fieldBuilds, cellsVisited: M.navStats.cellsVisited,
    queries: M.navStats.queries, gridBuilds: M.navStats.gridBuilds,
  };
  return acc;
}

function reportCensus(name, a) {
  const pc = (n, d = a.playTicks) => `${((n / d) * 100).toFixed(2)}%`;
  const eps = a.episodes;
  const mean = (x) => (x.length ? x.reduce((s, v) => s + v, 0) / x.length : 0);
  console.log(`\n── CENSUS ${name} ── ${a.matches} matches · ${a.playTicks.toLocaleString()} playing ticks`
    + ` (${a.mobileTicks.toLocaleString()} with the AI alive and un-stunned)`);
  console.log(`   belief STALE                 ${pc(a.staleTicks).padStart(8)}   (${a.staleTicks.toLocaleString()} ticks)`);
  console.log(`   lost-target episodes         ${String(eps.length).padStart(8)}   mean ${(mean(eps) / 1000).toFixed(2)}s · max ${(a.maxStaleMs / 1000).toFixed(2)}s · never re-acquired ${a.unresolvedEpisodes}`);
  console.log(`   mean belief ERROR when stale ${a.beliefErrN ? (a.beliefErrSum / a.beliefErrN).toFixed(1) : '—'} wu   (how wrong the AI's map of its target is)`);
  console.log(`   AI still, not firing/stunned/dead  ${pc(a.stalledTicks, a.mobileTicks).padStart(7)} of mobile ticks · longest unbroken ${(a.maxStallMs / 1000).toFixed(2)}s`);
  console.log(`     ├─ with a STALE belief     ${pc(a.stallStale, a.mobileTicks).padStart(8)}   <- SEARCH would fix this`);
  console.log(`     └─ with a FRESH belief     ${pc(a.stallFresh, a.mobileTicks).padStart(8)}   <- search fixes NOTHING here (movement.ts)`);
  console.log(`   parked ON the last-seen point${pc(a.parkedTicks).padStart(8)}   (stale, still, within 40 wu of the belief)`);
  console.log(`   AI firing ${pc(a.firedTicks).padStart(8)} · stunned ${pc(a.rootedTicks).padStart(8)} · dead-but-stepped ${pc(a.deadTicks).padStart(8)}`);
  console.log(`   §48 STALL (match-sim's rule: <15 wu span over 3 s while outside its own reach)`);
  console.log(`     stalled                    ${pc(a.spanStalled, a.spanSamples).padStart(8)} of ${a.spanSamples.toLocaleString()} samples · longest unbroken ${(a.maxSpanStallMs / 1000).toFixed(2)}s`);
  console.log(`     ├─ with a STALE belief     ${pc(a.spanStale, a.spanSamples).padStart(8)}   <- SEARCH would fix this`);
  console.log(`     └─ with a FRESH belief     ${pc(a.spanFresh, a.spanSamples).padStart(8)}   <- search fixes NOTHING here (movement.ts)`);
  if (a.nav) {
    const n = a.nav;
    console.log(`   NAV — the price tag on any behaviour that MOVES the goal`);
    console.log(`     grid ${n.cols}x${n.rows} @ cell ${n.cell} wu (${n.gridBuilds} grid build(s))`);
    console.log(`     flow-field REBUILDS ${n.fieldBuilds.toLocaleString()} = ${(n.fieldBuilds / a.playTicks).toFixed(4)}/tick · BFS cells visited ${(n.cellsVisited / a.playTicks).toFixed(0)}/tick`);
  }
}

// ─────────────────────────────────────────────────────────────────────────────
// --selftest — every assertion names an implementation that would FAIL it
// ─────────────────────────────────────────────────────────────────────────────
if (args.selftest) {
  let pass = 0, fail = 0;
  const ok = (n, c, d = '') => { if (c) { pass++; console.log(`   PASS  ${n}${d ? `  ${d}` : ''}`); } else { fail++; console.log(`   FAIL  ${n}${d ? `  ${d}` : ''}`); } };
  console.log('\n══ as_cost SELFTEST ══');

  const src = JSON.parse(readFileSync(`${ROOT}/tools/arena.gameplay.json`, 'utf8'));

  // ── A. The two `ax_layout` traps, asserted so the workaround cannot rot ──
  {
    const raw = scaleArena(src, { mode: 'copy', k: 1, matchDurationMs: MATCH_DURATION_MS });
    ok('A1 ax_layout:scaleArena DROPS arena.concealment (the trap this file works around)',
      !('concealment' in raw) && (src.concealment ?? []).length > 0,
      `shipped dump declares ${(src.concealment ?? []).length} regions; scaleArena returns ${'concealment' in raw ? 'them' : 'NONE'}`);
    const fixed = fixture(src, 'copy', 1);
    ok('A2 …and this file\'s fixture carries every one of them, unmodified',
      JSON.stringify(fixed.concealment) === JSON.stringify(src.concealment));
    // KNOWN-BAD: the check must fail on a fixture builder that forgot the field.
    const bad = { ...fixed, concealment: [] };
    ok('A3 KNOWN-BAD: a fixture with the field emptied is caught by that same comparison',
      JSON.stringify(bad.concealment) !== JSON.stringify(src.concealment));
  }
  {
    // A4 IS THE KNOWN-BAD FOR THE SHIELD ITSELF. Import ax_layout the obvious way, in a
    // child, with THIS tool's own flag in argv — and show it hijacks the process. Without
    // this assertion the shield looks like defensive noise; with it, deleting the shield
    // fails the gate. (Run as a child because the hijack calls `process.exit`.)
    const probe = join(tmpdir(), 'fa-as-axprobe.mjs');
    writeFileSync(probe, `await import(${JSON.stringify(`${ROOT}/tools/tmp/ax_layout.mjs`)});\nconsole.log('IMPORTER_STILL_ALIVE');\n`);
    let out = '';
    try { out = execFileSync(process.execPath, [probe, '--selftest'], { encoding: 'utf8' }); }
    catch (e) { out = String(e.stdout ?? ''); }
    ok('A4 KNOWN-BAD: importing ax_layout UNSHIELDED with --selftest in argv hijacks the process and exits',
      out.includes('ax_layout SELFTEST') && !out.includes('IMPORTER_STILL_ALIVE'),
      `child printed ${out.split('\n').filter(Boolean).length} lines and ${out.includes('IMPORTER_STILL_ALIVE') ? 'survived' : 'never returned'}`);
    ok('A5 …and the shielded import in THIS file survived it — these assertions are running',
      typeof scaleArena === 'function' && typeof pointSymmetryFaults === 'function');
  }

  // ── B. The x4 fixture honours §29a and §48 rule 5 ────────────────────────
  {
    const two = fixture(src, 'hub', 2);
    const tiled = tileConcealment(src.concealment ?? [], src.width, src.height, 2);
    ok('B1 the x4 fixture tiles to 4x the concealment PATCHES before the keepout takes its cut',
      tiled.length === (src.concealment ?? []).length * 4
      && two.concealment.length === tiled.length - keepoutViolations({ ...two, concealment: tiled }).length,
      `${(src.concealment ?? []).length} -> ${tiled.length} tiled -> ${two.concealment.length} legal`);
    ok('B2 …and NOT 4x the patch SIZE — §29a\'s ceiling does not scale with the map',
      two.concealment.every((b) => (src.concealment ?? []).some((o) => o.w === b.w && o.h === b.h))
      && oversizedPatches(two).length === 0,
      `largest span ${Math.max(...two.concealment.map((b) => Math.max(b.w, b.h)))} wu vs ceiling ${2 * CONCEAL_REVEAL_RADIUS}`);
    ok('B3 KNOWN-BAD: a patch scaled with the map IS caught by the ceiling test',
      oversizedPatches({ ...two, concealment: [{ x: 100, y: 100, w: 300, h: 300 }] }).length === 1);
    ok('B4 no region reaches inside the endgame keepout, at EITHER size',
      keepoutViolations(fixture(src, 'copy', 1)).length === 0 && keepoutViolations(two).length === 0,
      `keepout r=${concealmentKeepoutRadius(two.maxSafeRadius).toFixed(2)} at x4`);
    ok('B5 KNOWN-BAD: a region placed at the centre IS caught by the keepout test',
      keepoutViolations({ ...two, concealment: [{ x: two.center.x, y: two.center.y, w: 100, h: 100 }] }).length === 1);
    ok('B6 the x4 fixture keeps true 180° point symmetry (competitive fairness, §48 rule 3)',
      pointSymmetryFaults(two).length === 0, pointSymmetryFaults(two).slice(0, 1).join(''));
    ok('B7 …and the CONCEALMENT list is point-symmetric too, at both sizes, AFTER the keepout cut',
      boxSymmetryFaults(two.concealment, two.center).length === 0
      && boxSymmetryFaults(fixture(src, 'copy', 1).concealment, src.center).length === 0,
      `${two.concealment.length} regions at x4`);
    ok('B8 KNOWN-BAD: dropping ONE region without its partner IS caught by B7\'s check',
      boxSymmetryFaults(two.concealment.slice(1), two.center).length > 0);
    ok('B9 the endgame keepout GREW with the map — which is why the cut exists at all',
      concealmentKeepoutRadius(two.maxSafeRadius) > 1.9 * concealmentKeepoutRadius(src.maxSafeRadius),
      `${concealmentKeepoutRadius(src.maxSafeRadius).toFixed(2)} -> ${concealmentKeepoutRadius(two.maxSafeRadius).toFixed(2)} wu`);
  }

  // ── C. The staging is real, and a missed anchor REPORTS a miss ───────────
  {
    const shipped = stageArm('shipped');
    const same = SIM_MODULES.every((f) =>
      readFileSync(join(shipped.dir, f), 'utf8') === readFileSync(`${ROOT}/src/game/${f}`, 'utf8'));
    ok('C1 the `shipped` arm is the working tree byte for byte', same && shipped.ok);
    const oracle = stageArm('oracle');
    ok('C2 the `oracle` arm actually patched ai.ts', oracle.applied[0] === true);
    const diff = readFileSync(join(oracle.dir, 'ai.ts'), 'utf8') !== readFileSync(`${ROOT}/src/game/ai.ts`, 'utf8');
    ok('C3 …and the patched file differs from the original', diff);
    const others = SIM_MODULES.filter((f) => f !== 'ai.ts').every((f) =>
      readFileSync(join(oracle.dir, f), 'utf8') === readFileSync(`${ROOT}/src/game/${f}`, 'utf8'));
    ok('C4 …and NOTHING but ai.ts moved (sim.ts\'s homing re-aim stays belief-gated on purpose)', others);
    // KNOWN-BAD: an anchor that no longer exists must report a MISS, not a silent no-op.
    ARM_EDITS.__probe = [['ai.ts', 'THIS_ANCHOR_DOES_NOT_EXIST', 'x']];
    ok('C5 KNOWN-BAD: a stale anchor reports applied=false rather than measuring the unpatched sim',
      stageArm('__probe').applied[0] === false);
    delete ARM_EDITS.__probe;
  }

  // ── D. The census instrument, on inputs whose answer is derivable ────────
  {
    const arena1 = { ...fixture(src, 'copy', 1), build: () => null, update: () => {} };
    const noConceal = { ...arena1, concealment: [] };
    const A = await census({ simDir: `${ROOT}/src/game`, arena: noConceal, seeds: 1, policy: 'smart2', dt: 16.667 });
    ok('D1 with NO concealment the belief is never stale — 0 ticks, 0 episodes, by construction',
      A.staleTicks === 0 && A.episodes.length === 0,
      `${A.staleTicks} stale of ${A.playTicks.toLocaleString()} ticks`);
    const B = await census({ simDir: `${ROOT}/src/game`, arena: arena1, seeds: 1, policy: 'smart2', dt: 16.667 });
    ok('D2 KNOWN-BAD for D1: the SAME instrument on the shipped map DOES find stale ticks — so D1 is a measurement, not a broken counter',
      B.staleTicks > 0, `${B.staleTicks} stale of ${B.playTicks.toLocaleString()} ticks`);
    ok('D3 every stalled tick is booked to exactly one of STALE / FRESH (the split is a partition)',
      B.stallStale + B.stallFresh === B.stalledTicks);
    ok('D4 the census reaches the same corpus size roster_lab does at these seeds',
      A.matches === 110 && B.matches === 110, `${B.matches} matches`);
    // The oracle must reproduce the no-concealment run's PERCEPTION exactly: same map,
    // regions present, belief forced fresh. If it does not, `visible` is not the only
    // thing gating the belief and every bound below is wrong.
    const O = await census({ simDir: stageArm('oracle').dir, arena: arena1, seeds: 1, policy: 'smart2', dt: 16.667 });
    ok('D5 the ORACLE arm has zero stale ticks ON the concealment map — the bound is a bound',
      O.staleTicks === 0, `${O.staleTicks} stale`);

    /**
     * D6/D7 — THE STALL COUNTER'S KNOWN-BAD, AND IT IS THE ONE THAT MATTERS.
     *
     * The headline of this pass is a number that is close to ZERO ("the AI does not stall on
     * the x4 map"), and a counter that is simply broken also reports zero. So build an arena
     * on which a stall is CERTAIN — the AI walled into a sealed box it cannot leave, with the
     * player outside it — and require the counter to fire. Only then does the zero mean
     * something.
     */
    /**
     * ⚠️ THE FIRST CAGE FAILED, AND THE FAILURE IS THE REASON BOTH RULES ARE KEPT. A 7x7 pen
     * of 40 wu blocks left the AI a ~280 wu courtyard: `moveToward`'s detour block slid it
     * around the inner wall forever, so the per-tick counter read **0.0% stalled** on an AI
     * that had provably not closed a single wu. "Stalled" is not "motionless". The pen is
     * now sized so the interior is 52 wu against a 42 wu body — 10 wu of slack, under
     * match-sim's 15 wu span — and BOTH counters have to fire.
     */
    const B0 = 100, OFF = 76;   // 100x100 blocks, centres 76 wu out: a 52 wu interior
    const pen = [];
    for (const dx of [-1, 0, 1]) for (const dy of [-1, 0, 1]) {
      if (dx === 0 && dy === 0) continue;
      pen.push({ kind: 'wall', x: 1000 + dx * OFF, y: 500 + dy * OFF, w: B0, h: B0 });
    }
    const caged = {
      ...arena1, cover: pen, hazards: [], concealment: [],
      playerSpawn: { x: 200, y: 500 }, enemySpawn: { x: 1000, y: 500 },
      maxSafeRadius: 100000,   // park the fog so nothing but the cage decides the match
    };
    const C = await census({ simDir: `${ROOT}/src/game`, arena: caged, seeds: 1, policy: 'smart2', dt: 16.667 });
    ok('D6 KNOWN-BAD: an AI sealed in a 52 wu pocket IS counted as stalled by §48\'s own rule — so a 0% elsewhere is a measurement',
      C.spanStalled / C.spanSamples > 0.15 && C.maxSpanStallMs > 10000,
      `§48-rule ${((C.spanStalled / C.spanSamples) * 100).toFixed(1)}% of samples · longest ${(C.maxSpanStallMs / 1000).toFixed(1)}s`);
    ok('D7 …and that stall is booked to FRESH belief, not to perception — the split points the right way',
      C.spanFresh > 100 * Math.max(1, C.spanStale),
      `fresh ${C.spanFresh} vs stale ${C.spanStale}`);
    /**
     * D8 — THE PER-TICK COUNTER'S OWN KNOWN-BAD, AND IT IS A **NEGATIVE** RESULT KEPT ON
     * PURPOSE. On the same caged arena the per-tick "motionless" rule reads 0.0% while the
     * span rule reads 20.7% and 42 s. So the per-tick number CANNOT be quoted as a stall
     * figure and is reported only as "is the fighter physically still". Pinning it here
     * means a future reader who quotes the wrong one fails a gate instead of publishing.
     */
    ok('D8 …and the per-tick "motionless" counter is BLIND to that same stall — which is why it is not the headline',
      C.stalledTicks / C.mobileTicks < 0.05,
      `per-tick ${((C.stalledTicks / C.mobileTicks) * 100).toFixed(1)}% on an AI that never left a 52 wu pocket`);
  }

  // ── E. Timing is untouched, which is what keeps every comparison valid ───
  {
    // E1 IS THE RE-SEEDING TRAP, CHECKED AGAINST THE OTHER TOOL RATHER THAN ASSERTED.
    // The scripted driver decides during the countdown and draws from the seeded stream, so
    // any timing difference between this census and `roster_lab`'s matches would make the
    // two tables describe DIFFERENT matches while looking like one experiment (+0.01 s once
    // moved 38 of 110 matchups by up to 50 pp, fictitiously). So read roster_lab's own
    // source and require the seed formula and the cadence to be character-identical.
    const rl = readFileSync(`${ROOT}/tools/tmp/roster_lab.mjs`, 'utf8');
    const self = readFileSync(new URL(import.meta.url).pathname, 'utf8');
    const SEED_FORM = 'seed * 7919 + playerId.length * 131 + enemyId.length * 17 + policy.length';
    const MY_FORM = 's * 7919 + p.length * 131 + e.length * 17 + policy.length';
    const CADENCE = "reactBase: 150, reactJit: seed === 0 ? 0 : 60";
    const MY_CADENCE = "reactBase: 150, reactJit: s === 0 ? 0 : 60";
    ok('E1 the census reproduces roster_lab\'s SEED FORMULA term for term (same match, not a similar one)',
      rl.includes(SEED_FORM) && self.includes(MY_FORM));
    ok('E2 …and its reaction CADENCE — the quantity the countdown re-seeding trap acts through',
      rl.includes(CADENCE) && self.includes(MY_CADENCE));
    // WAS: "E3 no arm edits anything but ai.ts". REVERSED DELIBERATELY when the `navcells`
    // arm was added: the residual x4 stall is 100% fresh-belief, so answering "is it the
    // 20 wu grid?" requires staging `movement.ts`, which this pass does not own. The rule
    // that actually matters is unchanged and is now stated directly — a STAGED COPY IN THE
    // OS TEMP DIR IS NOT AN EDIT, and no arm may name a file outside the sim module list.
    ok('E3 every arm patches a staged copy only, from the sim module list, with no timing constant in it',
      Object.values(ARM_EDITS).every((es) => es.every(([f, , to]) =>
        SIM_MODULES.includes(f) && !/COUNTDOWN|cooldown|elapsed\s*=|dt\s*=/.test(to ?? ''))));
    ok('E4 …and NOTHING under src/ is written by any code path in this file',
      !/writeFileSync\([^)]*ROOT\s*\}?\s*\/?\s*`?\s*\/?src/.test(readFileSync(new URL(import.meta.url).pathname, 'utf8')));
    ok('E5 the out-of-set `navcells` arm is a MEASUREMENT arm and patches exactly one constant',
      ARM_EDITS.navcells.length === 1 && ARM_EDITS.navcells[0][0] === 'movement.ts'
      && stageArm('navcells').applied[0] === true);
  }

  console.log(`\n   ${pass}/${pass + fail} assertions passed\n`);
  process.exit(fail ? 1 : 0);
}

// ─────────────────────────────────────────────────────────────────────────────
// run
// ─────────────────────────────────────────────────────────────────────────────
const before = controlHashes();

if (args.fixtures) {
  console.log('\n══ as_cost FIXTURES ══');
  writeFixtures();
}

const MAP = String(args.map ?? '1x');
const SEEDS = Number(args.seeds ?? 8);
const DT = Number(args.dt ?? 16.667);
const POLICY = String(args.policy ?? 'smart2');

function mapFile(name) {
  const m = MAPS[name];
  if (!m) throw new Error(`unknown map ${name} (have ${Object.keys(MAPS).join(', ')})`);
  if (!existsSync(m.file)) writeFixtures();
  return m;
}

if (args.census) {
  // `--arena <path>` overrides the named map, so a fixture built from a HISTORICAL dump
  // (`--src` + `git show`) can be censused without pretending it is one of the maps above.
  const m = args.arena ? { file: String(args.arena), label: `explicit: ${args.arena}` } : mapFile(MAP);
  const data = JSON.parse(readFileSync(m.file, 'utf8'));
  const arena = { ...data, build: () => null, update: () => {} };
  console.log(`\n══ as_cost CENSUS ══ map ${MAP} (${m.label}) · ${SEEDS} seeds · policy ${POLICY}`);
  for (const arm of String(args.arms ?? 'shipped').split(',')) {
    const st = stageArm(arm);
    if (!st.ok) { console.log(`  ⚠️ arm ${arm} DID NOT PATCH — reporting nothing rather than a number from an unpatched sim.`); continue; }
    const a = await census({ simDir: st.dir, arena, seeds: SEEDS, policy: POLICY, dt: DT });
    reportCensus(`${arm} @ ${MAP}`, a);
  }
}

if (args.arms && !args.census) {
  const m = mapFile(MAP);
  const arms = String(args.arms).split(',');
  mkdirSync(`${ROOT}/tools/tmp/as`, { recursive: true });
  console.log(`\n══ as_cost ARMS ══ map ${MAP} (${m.label}) · ${SEEDS} seeds`);
  let baseline = null;
  for (const arm of arms) {
    const st = stageArm(arm);
    if (!st.ok) { console.log(`  ⚠️ arm ${arm} DID NOT PATCH — skipped.`); continue; }
    const jsonPath = `${FIXDIR}/rl_${MAP}_${arm}.json`;
    const argv = [`${ROOT}/tools/tmp/roster_lab.mjs`, '--seeds', String(SEEDS),
      '--policies', String(args.policies ?? 'smart2,chase'),
      '--sim', st.dir, '--arena', m.file, '--json', jsonPath];
    if (baseline) argv.push('--baseline', baseline);
    console.log(`\n──────── ARM ${arm.toUpperCase()} ────────`);
    const out = execFileSync(process.execPath, argv, { cwd: ROOT, encoding: 'utf8', maxBuffer: 64 * 1024 * 1024 });
    console.log(out.split('\n').filter((l) => /POLICY |first contact|never contacted|SETTLED|PAIRED|max \|Δ\||BIT-IDENTICAL|roster strength/.test(l)).join('\n'));
    baseline ??= jsonPath;
  }
}

const after = controlHashes();
const moved = CONTROL_FILES.filter((f) => before[f] !== after[f]);
console.log(moved.length
  ? `\n  🚨 TREE MOVED UNDER THIS RUN (${moved.join(', ')}) — the numbers above are NOT one tree.`
  : '\n  tree control: all 7 sim files identical before and after. Numbers are on one tree.');
// …AND WHETHER THAT ONE TREE IS A COMMIT. `--head` makes it one; without it, name the files
// that differ from HEAD, because "identical before and after" is satisfied by a peer's
// half-finished edit that simply sat still.
{
  const dirty = CONTROL_FILES.filter((f) => createHash('sha256')
    .update(execFileSync('git', ['show', `HEAD:${f}`], { cwd: ROOT })).digest('hex').slice(0, 8) !== after[f]);
  console.log(HEAD_SIM
    ? `  --head: every arm was extracted from HEAD (${execFileSync('git', ['rev-parse', '--short', 'HEAD'], { cwd: ROOT, encoding: 'utf8' }).trim()}); the working tree was not read.`
    : dirty.length
      ? `  ⚠️ WORKING TREE ≠ HEAD in ${dirty.join(', ')} — re-run with --head before quoting these numbers.`
      : '  working tree == HEAD for all 7 sim files.');
}
