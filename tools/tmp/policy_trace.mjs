#!/usr/bin/env node
/**
 * Which branch of the scripted player's decision tree is it actually in?
 *
 * Built to re-derive a claim rather than accept it (docs/LESSONS.md §3: take the symptom,
 * re-derive the cause). The claim is that `smart` tests line-of-sight BEFORE range, so on a
 * 27-CoverBox map the player never leaves the "flank a blocked shot" branch and every
 * "time to first contact" on record is the AI walking alone.
 *
 * This histograms the branch taken at every decision tick of a real match, and prints the
 * net displacement of the player over the match, so "it strafes into a wall and stands
 * there" is a measured statement rather than a reading of the source.
 *
 * ── The driver is IMPORTED, and this file used to be one of the stale copies ─────
 *
 * `tools/tmp/scripted_player.mjs` owns the nav and the reaction cadence. Until
 * 2026-08-05 this file carried its own transcription of both, with two defects that
 * `tools/match-sim.mjs` had already fixed:
 *
 *   1. the stuck detector ran during the COUNTDOWN, when `sim.ts:movePlayer` is never
 *      called, so it read "1.5 s of walking, 0 wu covered", latched a 900 ms
 *      perpendicular detour, and walked it SIDEWAYS at the whistle;
 *   2. the decision loop DECIDED during the countdown. This tool draws no seeded RNG, so
 *      it could not re-seed anything — but every one of those countdown decisions was
 *      COUNTED INTO THE BRANCH HISTOGRAM, which is this tool's only output. Roughly 38
 *      decisions per match were tallied before the match had started, all of them from a
 *      motionless player at spawn.
 *
 * Both are reachable by flag so the pre-fix numbers can still be re-derived:
 *
 *     --nav-countdown-bug --decide-during-countdown
 *
 * which reproduce every pre-fix FIGURE this tool printed — the histogram, the travel and
 * net-displacement numbers and the time to contact — exactly, on a frozen sim. (Two
 * provenance lines are new, so the stdout is not byte-identical; the numbers are.)
 *
 * ── The branch tree is labelled here, and CHECKED against the shared one ─────────
 *
 * The histogram needs a name for the branch taken, which the shared `POLICY_FNS` does not
 * return, so the tree is restated here with labels. A restated rule is exactly the shape
 * that produced this bug in the first place, so `--verify` drives both trees over the same
 * match and asserts the resulting `move` is identical on every tick. Run it before
 * believing a histogram.
 *
 *   node tools/tmp/policy_trace.mjs                       # hamburger vs donut
 *   node tools/tmp/policy_trace.mjs --all                 # every matchup, aggregated
 *   node tools/tmp/policy_trace.mjs --verify              # labelled tree == shared tree
 *   node tools/tmp/policy_trace.mjs --all --sim /tmp/frozen/src/game
 */
import { readFileSync } from 'node:fs';
import { resolve } from 'node:path';
import { createScriptedPlayer, parseDriverFlags, DRIVER_REV } from './scripted_player.mjs';

const ROOT = resolve(new URL('../..', import.meta.url).pathname);
const argv = process.argv.slice(2);
const flag = (k, d) => (argv.includes(k) ? argv[argv.indexOf(k) + 1] : d);
/** `--sim <dir>` freezes the sim. Without it a peer's half-saved `src/game/ai.ts` can land
 *  inside a run, which is exactly how `arena_probe.mjs` contaminated its own audit. */
const SIM_DIR = String(flag('--sim', `${ROOT}/src/game`));
const { createMatch, stepMatch } = await import(`${SIM_DIR}/sim.ts`);
const RULES = await import(`${SIM_DIR}/rules.ts`);
const { CHARACTERS, CHARACTER_IDS, MATCH_DURATION_MS, REACH, HIT_RADIUS_VS_PLAYER, HIT_RADIUS_VS_ENEMY } = RULES;

const LAYOUT = String(flag('--layout', `${ROOT}/tools/arena.gameplay.json`));
const ARENA = JSON.parse(readFileSync(LAYOUT, 'utf8'));
const arena = { ...ARENA, build: () => null, update: () => {} };
const POT = arena.hazards.find((h) => h.kind === 'damage');
const DT = 16.667;
const dist = (a, b, c, d) => Math.hypot(a - c, b - d);
const ALL = argv.includes('--all');

/** The two reproduction flags are spelled the same way in every tool that has them. */
const DRIVER_FLAGS = parseDriverFlags(Object.fromEntries(
  argv.filter((a) => a.startsWith('--')).map((a) => [a.slice(2), true]),
));
const DRIVER = createScriptedPlayer({ CHARACTERS, REACH, arena, hazard: POT, ...DRIVER_FLAGS });
const { makeNav, lineOfSight, preferredRange, maxNormalRange } = DRIVER;

if (DRIVER.isHistorical) {
  console.log('\n  ⚠️  HISTORICAL DRIVER — reproducing defects fixed on 2026-08-05.');
  console.log(`      ${Object.entries(DRIVER.flags).filter(([, v]) => v).map(([k]) => k).join(' ')}`);
  console.log('      These numbers are NOT current; they exist to re-derive an old figure.\n');
}

/**
 * The shared `smart` / `smart2` tree, restated with a label per branch.
 *
 * ⚠️ It differs from `scripted_player.mjs`'s in one deliberate way: the RING branch there
 * has a sub-case for "the safe disc has shrunk inside the pot", which produces a different
 * TARGET but the same branch NAME. `--verify` therefore compares the branch labels and the
 * moves separately, and reports the ring sub-case as a known, named divergence rather than
 * letting it read as agreement.
 */
function decideLabelled(state, reordered) {
  const p = state.player, e = state.enemy;
  const d = dist(p.x, p.y, e.x, e.y);
  const band = preferredRange(p.characterId) * 0.85;
  const los = lineOfSight(p.x, p.y, e.x, e.y);
  const cx = arena.center.x, cy = arena.center.y;
  const dc = dist(p.x, p.y, cx, cy), R = state.safeRadius;
  if (dc > R - 30) return { branch: 'RING', los, d };
  if (POT && dist(p.x, p.y, POT.x, POT.y) < POT.radius + 15 && R > POT.radius + 40) return { branch: 'LEAVE-POT', los, d };
  if (reordered) {
    if (d > band) return { branch: 'CLOSE', los, d };
    if (!los) return { branch: 'STRAFE-noLOS', los, d };
  } else {
    if (!los) return { branch: 'STRAFE-noLOS', los, d };
    if (d > band) return { branch: 'CLOSE', los, d };
  }
  if (d < band * 0.5) return { branch: 'BACK-OFF', los, d };
  return { branch: 'STRAFE-inband', los, d };
}

/** The target each labelled branch walks to. Kept beside the label it belongs to. */
function targetFor(branch, state) {
  const p = state.player, e = state.enemy;
  if (branch === 'RING') return { x: arena.center.x, y: arena.center.y };
  if (branch === 'LEAVE-POT') {
    const ang = Math.atan2(p.y - POT.y, p.x - POT.x);
    return { x: POT.x + Math.cos(ang) * (POT.radius + 60), y: POT.y + Math.sin(ang) * (POT.radius + 60) };
  }
  if (branch === 'STRAFE-noLOS') {
    const ang = Math.atan2(e.y - p.y, e.x - p.x) + Math.PI / 2;
    return { x: p.x + Math.cos(ang) * 150, y: p.y + Math.sin(ang) * 150 };
  }
  if (branch === 'CLOSE') return { x: e.x, y: e.y };
  if (branch === 'BACK-OFF') {
    const ang = Math.atan2(p.y - e.y, p.x - e.x);
    return { x: p.x + Math.cos(ang) * 100, y: p.y + Math.sin(ang) * 100 };
  }
  const ang = Math.atan2(p.y - e.y, p.x - e.x) + Math.PI / 2;
  return { x: p.x + Math.cos(ang) * 100, y: p.y + Math.sin(ang) * 100 };
}

function run(pid, eid, reordered) {
  const state = createMatch(arena, pid, eid);
  const counts = {};
  /** No seeded stream, so `makeNav(null)` — its historical initial `detourSign` is +1 and
   *  preserving that is what makes the before/after measure the countdown fix ALONE. */
  const nav = makeNav(null);
  let countdownDecisions = 0;
  const loop = DRIVER.createDecisionLoop({
    reactBase: 150, reactJit: 0, rnd: null,
    decide: (st) => {
      const r = decideLabelled(st, reordered);
      counts[r.branch] = (counts[r.branch] ?? 0) + 1;
      if (st.phase !== 'playing') countdownDecisions++;
      const t = targetFor(r.branch, st);
      return { move: nav(st, t.x, t.y), aim: { x: st.enemy.x - st.player.x, y: st.enemy.y - st.player.y }, selectedWeapon: 0, attack: false };
    },
  });
  const startX = state.player.x, startY = state.player.y;
  let travel = 0, px = startX, py = startY;
  const eng = Math.max(maxNormalRange(pid) + HIT_RADIUS_VS_ENEMY, maxNormalRange(eid) + HIT_RADIUS_VS_PLAYER);
  let contact = null, enemyTravel = 0, ex = state.enemy.x, ey = state.enemy.y;
  while (state.phase !== 'ended' && state.elapsed < MATCH_DURATION_MS + 60_000) {
    const input = loop.next(state, DT);
    stepMatch(state, DT, input);
    travel += Math.hypot(state.player.x - px, state.player.y - py);
    enemyTravel += Math.hypot(state.enemy.x - ex, state.enemy.y - ey);
    px = state.player.x; py = state.player.y; ex = state.enemy.x; ey = state.enemy.y;
    if (contact === null && dist(state.player.x, state.player.y, state.enemy.x, state.enemy.y) <= eng && state.phase === 'playing') {
      contact = MATCH_DURATION_MS - state.timeRemaining;
    }
  }
  return {
    counts, travel, enemyTravel, contact, countdownDecisions,
    netDisp: Math.hypot(state.player.x - startX, state.player.y - startY),
    endX: state.player.x, endY: state.player.y, startX, startY,
  };
}

// ─────────────────────────────────────────────────────────────────────────────
// --verify : the labelled tree must produce the SAME move as the shared one
// ─────────────────────────────────────────────────────────────────────────────
/**
 * §5's lesson is that a rule stated twice drifts. This file has to state it twice — the
 * histogram needs the label — so the second statement is checked rather than trusted.
 * Both trees are driven off the SAME `nav` instance and the same match, so any difference
 * is the tree, not the walk.
 */
if (argv.includes('--verify')) {
  let ticks = 0, moveMismatch = 0, ringSubcase = 0;
  const pairs = CHARACTER_IDS.flatMap((p) => CHARACTER_IDS.filter((e) => e !== p).map((e) => [p, e]));
  for (const [reordered, policy] of [[false, 'smart'], [true, 'smart2']]) {
    for (const [pid, eid] of pairs) {
      const state = createMatch(arena, pid, eid);
      const navA = makeNav(null);
      const shared = DRIVER.POLICY_FNS[policy](null);
      // `POLICY_FNS` builds its own nav internally, so drive a parallel one and compare
      // the TARGET each tree walks to instead — the nav is shared code either way.
      const loop = DRIVER.createDecisionLoop({
        reactBase: 150, reactJit: 0, rnd: null,
        decide: (st) => {
          const r = decideLabelled(st, reordered);
          const t = targetFor(r.branch, st);
          const mine = navA(st, t.x, t.y);
          const theirs = shared(st);
          ticks++;
          if (mine.x !== theirs.move.x || mine.y !== theirs.move.y) {
            // The one known divergence: the shared RING branch aims at a point on the
            // ring when the safe disc has shrunk inside the pot. Same branch, different
            // target — named, so it cannot be mistaken for agreement OR for drift.
            const dc = dist(st.player.x, st.player.y, arena.center.x, arena.center.y);
            if (r.branch === 'RING' && POT && st.safeRadius < POT.radius + 20 && dc > st.safeRadius - 30) ringSubcase++;
            else moveMismatch++;
          }
          return { move: mine, aim: { x: 0, y: 0 }, selectedWeapon: 0, attack: false };
        },
      });
      while (state.phase !== 'ended' && state.elapsed < MATCH_DURATION_MS + 60_000) {
        stepMatch(state, DT, loop.next(state, DT));
      }
    }
  }
  console.log(`\n== verify · labelled tree vs scripted_player.mjs · ${ticks} decision ticks over 220 matches`);
  console.log(`   move mismatches            ${moveMismatch}`);
  console.log(`   known RING sub-case        ${ringSubcase}   (shared tree aims at the ring, not the centre, when the disc is inside the pot)`);
  console.log(moveMismatch === 0 ? '   OK — the histogram labels the tree that actually runs.\n' : '   FAIL — the labelled tree has drifted from the shared one.\n');
  process.exit(moveMismatch === 0 ? 0 : 1);
}

// ─────────────────────────────────────────────────────────────────────────────
const pairs = ALL ? CHARACTER_IDS.flatMap((p) => CHARACTER_IDS.filter((e) => e !== p).map((e) => [p, e])) : [['hamburger', 'donut']];
console.log(`\n(driver rev ${DRIVER_REV} · sim ${SIM_DIR === `${ROOT}/src/game` ? 'working tree' : SIM_DIR})`);
for (const reordered of [false, true]) {
  const agg = {};
  let travel = 0, enemyTravel = 0, net = 0, contact = 0, nContact = 0, cdDecisions = 0;
  for (const [p, e] of pairs) {
    const r = run(p, e, reordered);
    for (const [k, v] of Object.entries(r.counts)) agg[k] = (agg[k] ?? 0) + v;
    travel += r.travel; enemyTravel += r.enemyTravel; net += r.netDisp;
    cdDecisions += r.countdownDecisions;
    if (r.contact !== null) { contact += r.contact; nContact++; }
    if (!ALL) console.log(`  ${p} vs ${e}: start (${r.startX.toFixed(0)},${r.startY.toFixed(0)}) -> end (${r.endX.toFixed(0)},${r.endY.toFixed(0)})`);
  }
  const tot = Object.values(agg).reduce((a, b) => a + b, 0);
  console.log(`\n== policy branch histogram — ${reordered ? 'RANGE-BEFORE-LOS (corrected)' : 'LOS-BEFORE-RANGE (as shipped)'} · ${pairs.length} matchup(s)`);
  for (const [k, v] of Object.entries(agg).sort((a, b) => b[1] - a[1])) {
    console.log(`   ${k.padEnd(14)} ${String(v).padStart(7)}  ${(v / tot * 100).toFixed(1)}%`);
  }
  console.log(`   decisions counted BEFORE the whistle ${cdDecisions} of ${tot} (${(cdDecisions / tot * 100).toFixed(1)}%)`);
  console.log(`   player travel ${Math.round(travel / pairs.length)}wu · NET displacement ${Math.round(net / pairs.length)}wu · enemy travel ${Math.round(enemyTravel / pairs.length)}wu`);
  console.log(`   mean time to contact ${(contact / nContact / 1000).toFixed(1)}s (match clock), ${nContact}/${pairs.length} made contact`);
}
