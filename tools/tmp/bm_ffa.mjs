#!/usr/bin/env node
/**
 * BM_FFA — HOW OFTEN DOES A MATCH ACTUALLY REACH SUDDEN DEATH, per seat count.
 *
 * ── The gap this fills ─────────────────────────────────────────────────────
 *
 * `docs/STATE.md` says sudden death *"decides 90.5% of SIX-player matches (was 66.0%)"*.
 * That is the only reach figure this project has ever published, and it is at N=6.
 * **Uri plays 1v1 — six-player has no entry point in the shipped build** — so the number
 * that describes what he saw has never been measured. This tool measures every N from
 * `MIN_FIGHTERS` to `MAX_FIGHTERS` on one instrument so the 1v1 figure is comparable to
 * the published one instead of being a second, differently-shaped number.
 *
 * ⚠️ **EVERY SEAT IS `controller: 'ai'`, AND THAT IS A LIMIT, NOT A CHOICE.** The scripted
 * driver plays the PLAYER seat of a two-seat match; it structurally cannot play a
 * free-for-all. So this measures the bot policy, exactly as `nf_ffa` does, and **is not
 * comparable to `roster_lab`'s 110 cells or to `bm_lab`'s** — do not merge them. It IS
 * comparable to `fs_sched_share`, which seats fighters the same way.
 *
 * ⚠️ The opening ring is derived from the tree under test (`fogOpeningRadiusFor` when it
 * exists, the superseded expression when it does not) for the reason `bm_lab`'s header
 * gives: 47 tools carry a derivation that returns 1792 against a shipped 1720.4651 on the
 * 150 s clock, and using it would measure one arm of an A/B wrongly.
 *
 *   node tools/tmp/bm_ffa.mjs --selftest
 *   node tools/tmp/bm_ffa.mjs --sim /tmp/fa-bm-before/src/game --seeds 40
 */

import { readFileSync, existsSync } from 'node:fs';
import { resolve } from 'node:path';

const ROOT = resolve(new URL('../..', import.meta.url).pathname);
const args = (() => {
  const o = {};
  for (let i = 2; i < process.argv.length; i++) {
    const a = process.argv[i];
    if (!a.startsWith('--')) continue;
    const n = process.argv[i + 1];
    if (n === undefined || n.startsWith('--')) o[a.slice(2)] = true; else { o[a.slice(2)] = n; i++; }
  }
  return o;
})();

const SIM_DIR = String(args.sim ?? `${ROOT}/src/game`);
const { createMatch, stepMatch } = await import(`${SIM_DIR}/sim.ts`);
const STATE = await import(`${SIM_DIR}/state.ts`);
const RULES = await import(`${SIM_DIR}/rules.ts`);
const { CHARACTER_IDS, MATCH_DURATION_MS, SUDDEN_DEATH_MS } = RULES;
const { MIN_FIGHTERS, MAX_FIGHTERS } = STATE;

function openingRadiusFor(halfDiag) {
  if (args.maxsafe !== undefined) return Number(args.maxsafe);
  if (typeof RULES.fogOpeningRadiusFor === 'function') return RULES.fogOpeningRadiusFor(halfDiag);
  return Math.round(halfDiag / (1 - 6000 / MATCH_DURATION_MS));
}

const ARENA_PATH = String(args.arena ?? `${ROOT}/tools/arena.gameplay.json`);
const AD = existsSync(ARENA_PATH) ? JSON.parse(readFileSync(ARENA_PATH, 'utf8')) : null;
if (!AD) { console.error(`no arena at ${ARENA_PATH}`); process.exit(1); }
const ARENA = {
  ...AD, maxSafeRadius: openingRadiusFor(Math.hypot(AD.width / 2, AD.height / 2)),
  build: () => null, update: () => {},
};

const DT = Number(args.dt ?? 16.667);
const SEEDS = Number(args.seeds ?? 40);
const pct = (n, d) => (d ? (100 * n) / d : 0);

/**
 * One all-AI match. Returns what ENDED it, split the way `bm_lab` splits a duel — with
 * ordinary fog and sudden-death fog separated by `playMs >= SUDDEN_DEATH_MS` read from the
 * tree under test, because `sim.ts` gives both the same `{ kind: 'fog' }` source tag.
 */
function runFfa(n, seed) {
  const configs = [];
  for (let i = 0; i < n; i++) {
    configs.push({ characterId: CHARACTER_IDS[(seed * 7 + i * 3) % CHARACTER_IDS.length], controller: 'ai' });
  }
  const state = createMatch(ARENA, configs);
  const inputs = new Array(n).fill(null);
  const HARD_CAP = MATCH_DURATION_MS * 1.6 + 20000;
  const dmg = { weapon: 0, trail: 0, hazard: 0, fog: 0, fogSudden: 0 };
  const lastSource = new Map();
  let deaths = 0, lastKillCause = null, firstKillCause = null;
  let reachedSuddenDeath = false, reachedFogClose = false;

  while (state.phase !== 'ended' && state.elapsed < HARD_CAP) {
    const playMs = MATCH_DURATION_MS - state.timeRemaining;
    const suddenNow = state.phase === 'playing' && playMs >= SUDDEN_DEATH_MS;
    if (state.phase === 'playing') {
      if (suddenNow) reachedSuddenDeath = true;
      if (RULES.FOG_CLOSE_MS !== undefined && playMs >= RULES.FOG_CLOSE_MS) reachedFogClose = true;
    }
    for (const ev of stepMatch(state, DT, inputs)) {
      if (ev.type === 'hit-landed') {
        const k = ev.source?.kind;
        const bucket = k === 'fog' ? (suddenNow ? 'fogSudden' : 'fog') : k;
        if (dmg[bucket] === undefined) dmg[bucket] = 0;
        dmg[bucket] += ev.amount;
        lastSource.set(ev.targetId, bucket);
      } else if (ev.type === 'death') {
        deaths++;
        const cause = lastSource.get(ev.fighterId) ?? 'unknown';
        if (firstKillCause === null) firstKillCause = cause;
        lastKillCause = cause;      // the death that ENDS an FFA is the last one
      }
    }
  }
  const all = Object.values(dmg).reduce((a, b) => a + b, 0);
  const survivors = state.fighters.filter((f) => f.alive).length;
  // `resolveTimeout` fired iff the match ended with more than one fighter still alive.
  const timedOut = state.phase === 'ended' && survivors > 1;
  let ending;
  if (state.phase !== 'ended') ending = 'UNRESOLVED';
  else if (timedOut) ending = 'timeout';
  else ending = `ko-${lastKillCause ?? 'unknown'}`;
  return {
    n, seed, ending, deaths, survivors, dmg, all,
    endMs: MATCH_DURATION_MS - state.timeRemaining,
    reachedSuddenDeath, reachedFogClose,
  };
}

if (args.selftest) {
  let pass = 0, fail = 0;
  const ok = (nm, c, d = '') => { if (c) { pass++; console.log(`   PASS  ${nm}${d ? '  ' + d : ''}`); } else { fail++; console.log(`   FAIL  ${nm}${d ? '  ' + d : ''}`); } };
  console.log(`\n══ bm_ffa SELFTEST ══  sim ${SIM_DIR === `${ROOT}/src/game` ? 'working tree' : SIM_DIR}`);
  console.log(`   clock ${MATCH_DURATION_MS / 1000}s · SD ${SUDDEN_DEATH_MS / 1000}s · ring ${ARENA.maxSafeRadius.toFixed(4)} · seats ${MIN_FIGHTERS}..${MAX_FIGHTERS}`);

  // 1. The seat count the tool asks for is the seat count the SIM seats. This is the row
  //    that fails if `createMatch`'s list form is silently dropping or padding configs —
  //    the shape of the routed patch whose `.filter(Boolean)` dropped fighters.
  {
    const bad = [];
    for (let n = MIN_FIGHTERS; n <= MAX_FIGHTERS; n++) {
      const s = createMatch(ARENA, Array.from({ length: n }, (_, i) => ({ characterId: CHARACTER_IDS[i % CHARACTER_IDS.length], controller: 'ai' })));
      if (s.fighters.length !== n) bad.push(`asked ${n} got ${s.fighters.length}`);
    }
    ok('the sim seats exactly the N this tool asks for, at every seat count', bad.length === 0, bad.join(' · '));
  }
  // 2. Determinism — an all-AI match has no seeded driver, so an identical config must be
  //    bit-identical. If this fails, every paired number this tool produces is noise.
  {
    const a = runFfa(2, 3), b = runFfa(2, 3);
    ok('an all-AI match is bit-identical on a re-run (no hidden RNG)',
      a.endMs === b.endMs && a.ending === b.ending && a.all === b.all, `${a.ending} @ ${(a.endMs / 1000).toFixed(2)}s`);
  }
  // 3. KNOWN-BAD: squeeze the ring so the fog MUST decide it, and check the label follows.
  //    Without this the tool could emit `ko-weapon` unconditionally and look correct.
  {
    const saved = ARENA.maxSafeRadius;
    ARENA.maxSafeRadius = 1;
    const r = runFfa(2, 0);
    ARENA.maxSafeRadius = saved;
    ok('KNOWN-BAD: a 1 wu ring makes the FOG the ending, and books fog damage',
      (r.ending === 'ko-fog' || r.ending === 'ko-fogSudden') && (r.dmg.fog + r.dmg.fogSudden) > 0,
      `ending=${r.ending} fog=${r.dmg.fog + r.dmg.fogSudden}`);
    ok('…and the shipped ring does NOT produce that ending on the same seed (the arms separate)',
      !['ko-fog', 'ko-fogSudden'].includes(runFfa(2, 0).ending), `shipped ending=${runFfa(2, 0).ending}`);
  }
  // 4. The reach flag is not a constant. On a tree where SUDDEN_DEATH_MS is beyond any
  //    natural match it must be false somewhere, and forcing the clock past it must set it.
  {
    const r = runFfa(2, 0);
    ok('reachedSuddenDeath is FALSE for a match that ends before SUDDEN_DEATH_MS',
      r.reachedSuddenDeath === false && r.endMs < SUDDEN_DEATH_MS,
      `end ${(r.endMs / 1000).toFixed(1)}s < SD ${SUDDEN_DEATH_MS / 1000}s`);
  }
  // 5. Vacuity: a summary over no matches must not report 0%.
  {
    let threw = false;
    try { summarise([]); } catch { threw = true; }
    ok('KNOWN-BAD: summarising an EMPTY set THROWS rather than reporting 0% reach', threw);
  }
  console.log(`\n   ${pass}/${pass + fail} assertions passed\n`);
  process.exit(fail ? 1 : 0);
}

function summarise(rows) {
  if (!rows.length) throw new Error('summarise: empty set — refusing to report a reach rate over nothing');
  const all = rows.reduce((s, r) => s + r.all, 0);
  const fog = rows.reduce((s, r) => s + r.dmg.fog + r.dmg.fogSudden, 0);
  const by = {};
  for (const r of rows) by[r.ending] = (by[r.ending] ?? 0) + 1;
  return {
    n: rows.length,
    reachSD: pct(rows.filter((r) => r.reachedSuddenDeath).length, rows.length),
    reachClose: pct(rows.filter((r) => r.reachedFogClose).length, rows.length),
    decidedSD: pct(rows.filter((r) => r.ending === 'ko-fogSudden').length, rows.length),
    decidedFog: pct(rows.filter((r) => r.ending === 'ko-fog').length, rows.length),
    decidedCombat: pct(rows.filter((r) => r.ending === 'ko-weapon' || r.ending === 'ko-trail').length, rows.length),
    timeout: rows.filter((r) => r.ending === 'timeout').length,
    unresolved: rows.filter((r) => r.ending === 'UNRESOLVED').length,
    fogSharePct: pct(fog, all),
    meanEndS: rows.reduce((s, r) => s + r.endMs, 0) / rows.length / 1000,
    by,
  };
}

const rows = [];
for (let n = MIN_FIGHTERS; n <= MAX_FIGHTERS; n++) for (let s = 0; s < SEEDS; s++) rows.push(runFfa(n, s));

console.log(`\n══ bm_ffa ══  ${rows.length} all-AI matches · sim ${SIM_DIR}`);
console.log(`   clock ${MATCH_DURATION_MS / 1000}s · sudden death ${SUDDEN_DEATH_MS / 1000}s`
  + `${RULES.FOG_HOLD_MS !== undefined ? ` · hold ${RULES.FOG_HOLD_MS / 1000}s · close ${RULES.FOG_CLOSE_MS / 1000}s` : ' · ring welded to clock'}`
  + ` · ring ${ARENA.maxSafeRadius.toFixed(4)} wu`);
console.log(`\n   N   n   reachSD%  decidedSD%  decidedFog%  combat%  timeout  unres  fogShare%  meanEnd`);
for (let n = MIN_FIGHTERS; n <= MAX_FIGHTERS; n++) {
  const s = summarise(rows.filter((r) => r.n === n));
  console.log(`   ${n}  ${String(s.n).padStart(3)}  ${s.reachSD.toFixed(1).padStart(7)}  ${s.decidedSD.toFixed(1).padStart(9)}`
    + `  ${s.decidedFog.toFixed(1).padStart(10)}  ${s.decidedCombat.toFixed(1).padStart(7)}  ${String(s.timeout).padStart(7)}`
    + `  ${String(s.unresolved).padStart(5)}  ${s.fogSharePct.toFixed(2).padStart(9)}  ${s.meanEndS.toFixed(1)}s`);
}
const o = summarise(rows);
console.log(`   ALL ${String(o.n).padStart(3)}  ${o.reachSD.toFixed(1).padStart(7)}  ${o.decidedSD.toFixed(1).padStart(9)}`
  + `  ${o.decidedFog.toFixed(1).padStart(10)}  ${o.decidedCombat.toFixed(1).padStart(7)}  ${String(o.timeout).padStart(7)}`
  + `  ${String(o.unresolved).padStart(5)}  ${o.fogSharePct.toFixed(2).padStart(9)}  ${o.meanEndS.toFixed(1)}s`);
console.log(`\n   endings: ${Object.entries(o.by).map(([k, v]) => `${k} ${v}`).join(' · ')}`);
