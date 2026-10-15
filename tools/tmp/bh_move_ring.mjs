#!/usr/bin/env node
/**
 * BH_MOVE_RING — the closing ring on real N-seat matches, N = 2..6.
 * Review-phase probe (2026-10-15). READ-ONLY; imports `--src-root` (default: the clean
 * worktree of HEAD). Writes only under shots/rv/bugs/move/.
 *
 * Per N (all-AI seats on the shipped spawns, roster rotated, a mortal and an immortal run):
 *   * `state.safeRadius` sampled every tick: monotone non-increasing; equals the opening
 *     ring through FOG_HOLD_MS; equals minSafeRadiusFor(N) from FOG_CLOSE_MS until
 *     SUDDEN_DEATH_MS; 0 from SUDDEN_DEATH_MS on.
 *   * fog damage only ever lands on a fighter that is OUTSIDE the ring that tick;
 *   * at the collapse, every living fighter takes fog damage within one FOG_TICK_MS.
 * Known-bad (`--knownbad`): a scratch copy of sim.ts that passes the LIVING count to
 * minSafeRadiusFor — the monotonicity check must fire at N >= 5 in a mortal run.
 */
import { readFileSync, writeFileSync, mkdirSync, existsSync, readdirSync, copyFileSync } from 'node:fs';
import { resolve } from 'node:path';

const REPO = resolve(new URL('../..', import.meta.url).pathname);
const args = {};
for (let i = 2; i < process.argv.length; i++) { const a = process.argv[i]; if (!a.startsWith('--')) continue; const n = process.argv[i + 1]; if (n === undefined || n.startsWith('--')) args[a.slice(2)] = true; else { args[a.slice(2)] = n; i++; } }
const SRC_ROOT = resolve(String(args['src-root'] ?? (existsSync('/private/tmp/fa-rv-head/src/game/sim.ts') ? '/private/tmp/fa-rv-head' : REPO)));
const OUT_DIR = resolve(String(args.out ?? `${REPO}/shots/rv/bugs/move`));
const ARENA_PATH = resolve(String(args.arena ?? `${SRC_ROOT}/tools/arena.gameplay.json`));
mkdirSync(OUT_DIR, { recursive: true });

function stageKnownBad() {
  const dst = `${OUT_DIR}/knownbad_ring/src/game`;
  mkdirSync(dst, { recursive: true }); mkdirSync(`${OUT_DIR}/knownbad_ring/src/arena`, { recursive: true });
  for (const f of readdirSync(`${SRC_ROOT}/src/game`)) if (f.endsWith('.ts')) copyFileSync(`${SRC_ROOT}/src/game/${f}`, `${dst}/${f}`);
  copyFileSync(`${SRC_ROOT}/src/arena/types.ts`, `${OUT_DIR}/knownbad_ring/src/arena/types.ts`);
  let sim = readFileSync(`${dst}/sim.ts`, 'utf8');
  const a = 'minSafeRadiusFor(state.fighters.length))';
  if (!sim.includes(a)) throw new Error('known-bad anchor missing');
  sim = sim.replace(a, 'minSafeRadiusFor(state.fighters.filter((f) => f.alive).length))');
  writeFileSync(`${dst}/sim.ts`, sim);
  return `${OUT_DIR}/knownbad_ring`;
}
const ROOT = args.knownbad ? stageKnownBad() : SRC_ROOT;
const { createMatch, stepMatch } = await import(`${ROOT}/src/game/sim.ts`);
const R = await import(`${ROOT}/src/game/rules.ts`);
const { CHARACTER_IDS, MATCH_DURATION_MS, FOG_HOLD_MS, FOG_CLOSE_MS, SUDDEN_DEATH_MS, FOG_TICK_MS, minSafeRadiusFor, fogRadiusAt } = R;
const ARENA = { ...JSON.parse(readFileSync(ARENA_PATH, 'utf8')), build: () => null, update: () => {} };
const DT = 16.667;

function run(n, seed, immortal) {
  const ids = CHARACTER_IDS.slice(seed % CHARACTER_IDS.length).concat(CHARACTER_IDS).slice(0, n);
  const st = createMatch(ARENA, ids.map((c, k) => ({ characterId: c, controller: 'ai', spawn: { ...ARENA.spawns[k] }, ...(immortal ? { maxHp: 1e7 } : {}) })));
  const inputs = new Array(n).fill(null);
  const v = { n, seed, immortal, monotoneBreaks: 0, scheduleMismatches: 0, fogOnInside: 0, sdFirstBurnLagMs: null, sdUnburned: 0, maxRise: 0, ending: null };
  let prevR = Infinity, sdAt = null; const burnedAfterSd = new Set();
  const floor = minSafeRadiusFor(n);
  while (st.phase !== 'ended' && st.elapsed < MATCH_DURATION_MS * 3) {
    const before = st.fighters.map((f) => ({ x: f.x, y: f.y, alive: f.alive }));
    const evs = stepMatch(st, DT, inputs);
    if (st.phase !== 'playing' && st.phase !== 'ended') continue;
    const play = MATCH_DURATION_MS - st.timeRemaining;
    const r = st.safeRadius;
    if (r > prevR + 1e-9) { v.monotoneBreaks++; v.maxRise = Math.max(v.maxRise, r - prevR); }
    prevR = r;
    const expect = play >= SUDDEN_DEATH_MS ? 0 : fogRadiusAt(play, ARENA.maxSafeRadius, floor);
    if (st.phase === 'playing' && Math.abs(r - expect) > 1e-6) v.scheduleMismatches++;
    if (play >= SUDDEN_DEATH_MS && sdAt === null) sdAt = st.elapsed;
    for (const e of evs) if (e.type === 'hit-landed' && e.source.kind === 'fog') {
      const f = st.fighters[e.targetId];
      const d = Math.hypot(f.x - ARENA.center.x, f.y - ARENA.center.y);
      if (!(d > r)) v.fogOnInside++;
      if (sdAt !== null) { burnedAfterSd.add(e.targetId); if (v.sdFirstBurnLagMs === null) v.sdFirstBurnLagMs = +(st.elapsed - sdAt).toFixed(1); }
    }
    if (sdAt !== null && st.elapsed - sdAt >= FOG_TICK_MS + DT && v.sdUnburned === 0) {
      v.sdUnburned = st.fighters.filter((f, k) => f.alive && !burnedAfterSd.has(k)).length;
      v.sdCheckedAlive = st.fighters.filter((f) => f.alive).length;
    }
  }
  v.ending = st.timeRemaining > 0 ? 'knockout' : 'timeout';
  v.durationS = +((MATCH_DURATION_MS - st.timeRemaining) / 1000).toFixed(1);
  v.reachedSd = sdAt !== null;
  return v;
}

console.log(`sim ${ROOT}${args.knownbad ? '  (KNOWN-BAD: living count)' : ''}`);
const rows = [];
for (let n = 2; n <= 6; n++) for (const immortal of [false, true]) for (const seed of [0, 1, 2]) {
  const v = run(n, seed, immortal); rows.push(v);
  console.log(`N=${n} ${immortal ? 'immortal' : 'mortal  '} seed ${seed}: ${v.ending} @${v.durationS}s · monotone breaks ${v.monotoneBreaks} (max rise ${v.maxRise.toFixed(2)}) · schedule mismatches ${v.scheduleMismatches} · fog on a fighter INSIDE ${v.fogOnInside} · SD reached ${v.reachedSd}${v.reachedSd ? ` · first SD burn +${v.sdFirstBurnLagMs} ms · alive-but-unburned after one fog tick ${v.sdUnburned}/${v.sdCheckedAlive ?? '—'}` : ''}`);
}
writeFileSync(`${OUT_DIR}/ring${args.knownbad ? '_knownbad' : ''}.json`, JSON.stringify({ root: ROOT, rows }, null, 2));
