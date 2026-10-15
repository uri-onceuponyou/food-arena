#!/usr/bin/env node
/**
 * b5_navcost — what bot PATHING costs per seat count, on the shipped kitchen (AI-B5,
 * `docs/REVAMP.md` §5 B5, 2026-10-15). Owner of the `b5_` prefix.
 *
 * `movement.ts` keeps ONE `NavGrid` per arena with ONE distance field keyed by the last goal
 * asked for, so bots with different goals evict each other's field and every such query floods a
 * fresh BFS. This counts it through `movement.ts:navStats` (integer counters the game never
 * reads), over whole all-bot matches — a fresh arena object per match, so every match starts with
 * a cold cache — and prints, per seat count:
 *
 *   field rebuilds per second of play · cells flooded per tick · nav queries per tick ·
 *   rebuilds per query · grid (passability) builds · wall ms per tick
 *
 * The first four are EXACT (deterministic sim, deterministic counters). WALL TIME IS NOT: it is
 * this machine, under whatever else is running, with no measured floor — read it as a ratio
 * between two arms run back to back, never as a number to quote across sessions.
 *
 *   node tools/tmp/b5_navcost.mjs --root <tree> [--n 2,3,4,6] [--rosters 11]
 *   node tools/tmp/b5_navcost.mjs --selftest   # a counter that never moves must FAIL
 *
 * `--root` is required for the same reason as `b5_digest.mjs`: an A/B whose two arms read one
 * tree reads exactly like "the change did nothing".
 */
import { readFileSync } from 'node:fs';
import { resolve } from 'node:path';

const ARGS = process.argv.slice(2);
const arg = (k, d) => { const i = ARGS.indexOf(`--${k}`); return i < 0 ? d : ARGS[i + 1]; };
const REPO = resolve(new URL('../..', import.meta.url).pathname);

export async function measure(root, ns = [2, 3, 4, 6], rosters = 11) {
  const g = `${root}/src/game`;
  const [{ createMatch, stepMatch }, R, M] = await Promise.all([import(`${g}/sim.ts`), import(`${g}/rules.ts`), import(`${g}/movement.ts`)]);
  const dump = JSON.parse(readFileSync(`${REPO}/tools/arena.gameplay.json`, 'utf8'));
  const ids = R.CHARACTER_IDS;
  const out = [];
  for (const n of ns) {
    let builds = 0, cells = 0, queries = 0, grids = 0, ticks = 0, playMs = 0, wall = 0;
    for (let ri = 0; ri < rosters; ri++) {
      const arena = { ...dump, build: () => null, update: () => {} };   // fresh object = cold cache
      const roster = Array.from({ length: n }, (_, j) => ids[(ri + j) % ids.length]);
      const st = createMatch(arena, roster.map((c, i) => ({ characterId: c, controller: 'ai', spawn: dump.spawns[i] })));
      const inputs = new Array(n).fill(null);
      M.navStats.reset();
      const t0 = performance.now();
      while (st.phase !== 'ended' && st.elapsed < 200_000) { stepMatch(st, 16.667, inputs); if (st.phase === 'playing') ticks++; }
      wall += performance.now() - t0;
      builds += M.navStats.fieldBuilds; cells += M.navStats.cellsVisited; queries += M.navStats.queries; grids += M.navStats.gridBuilds;
      playMs += R.MATCH_DURATION_MS - st.timeRemaining;
    }
    out.push({ n, rebuildsPerS: builds / (playMs / 1000), cellsPerTick: cells / ticks, queriesPerTick: queries / ticks,
      rebuildsPerQuery: builds / queries, gridBuilds: grids, msPerTick: wall / ticks, ticks });
  }
  return out;
}

const IS_MAIN = process.argv[1] !== undefined && resolve(process.argv[1]) === resolve(new URL(import.meta.url).pathname);
if (IS_MAIN) {
  if (ARGS.includes('--selftest')) {
    // The counters must MOVE with load: one seat-count arm with bots must flood cells and query,
    // and two seats must flood fewer cells per tick than six (the defect's own direction). A
    // measurement that read zero everywhere would otherwise "prove" there is no thrash.
    const r = await measure(REPO, [2, 6], 2);
    const [two, six] = r;
    const rows = [
      [two.queriesPerTick > 0 && six.queriesPerTick > 0, `nav queries counted at both seat counts (${two.queriesPerTick.toFixed(2)} / ${six.queriesPerTick.toFixed(2)} per tick)`],
      [six.cellsPerTick > 0, `cells flooded at six seats (${six.cellsPerTick.toFixed(0)} per tick)`],
      [two.ticks > 0 && six.ticks > 0, `matches actually played (${two.ticks} / ${six.ticks} ticks)`],
    ];
    for (const [ok, msg] of rows) console.log(`${ok ? 'PASS' : 'FAIL'}  ${msg}`);
    process.exit(rows.every(([ok]) => ok) ? 0 : 1);
  }
  const root = arg('root', null);
  if (!root) { console.error('b5_navcost: --root <tree> is required (see the header)'); process.exit(2); }
  const ns = String(arg('n', '2,3,4,6')).split(',').map(Number);
  const res = await measure(root, ns, Number(arg('rosters', 11)));
  for (const r of res) {
    console.log(`N=${r.n}: field rebuilds ${r.rebuildsPerS.toFixed(1)}/s of play · cells flooded ${r.cellsPerTick.toFixed(0)}/tick`
      + ` · nav queries ${r.queriesPerTick.toFixed(2)}/tick · rebuilds per query ${r.rebuildsPerQuery.toFixed(3)}`
      + ` · grid builds ${r.gridBuilds} · wall ${r.msPerTick.toFixed(3)} ms/tick (this box, no floor)`);
  }
}
