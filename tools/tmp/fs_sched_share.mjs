#!/usr/bin/env node
/**
 * FS_SCHED_SHARE — THE PAIRED A/B THE RESCHEDULE NEEDS, AND THE ONLY ONE IT CAN HAVE.
 *
 * `DECISIONS §1` published *"the fog goes from 1.5% to 8.1% of all damage"* as the number
 * that justified the 45 s clock. Uri's 150 s schedule moves it, and quoting a new figure
 * against that 8.1% would be **conflating two instruments**: 8.1% came out of the 110-cell
 * `roster_lab` grid driven by `scripted_player`, and this file drives every seat with the
 * sim's own AI. Different driver, different corpus, not comparable.
 *
 * So this tool is written to be run **TWICE, IN TWO TREES**, and the only thing that differs
 * between the arms is `rules.ts`:
 *
 *     git worktree add --detach /tmp/fa-base <old-sha>
 *     ln -s "$PWD/node_modules" /tmp/fa-base/node_modules
 *     cp tools/tmp/fs_sched_share.mjs /tmp/fa-base/tools/tmp/
 *     node /tmp/fa-base/tools/tmp/fs_sched_share.mjs --json /tmp/A.json
 *     node        tools/tmp/fs_sched_share.mjs        --json /tmp/B.json
 *     node        tools/tmp/fs_sched_share.mjs --diff /tmp/A.json /tmp/B.json
 *
 * ⚠️ **RESOLUTION FLOOR.** The sim is deterministic and both arms run identical seeds,
 * characters, spawns and arena, so a **per-cell delta is EXACT** — a match that differs at
 * all differs because of the constants. The AGGREGATE across cells is *not* an independent
 * sample mean and this tool never attaches a standard error to it; it reports the paired
 * per-cell distribution alongside it, because `roster_table`'s aggregate once moved 0.8 pp
 * (inside its floor) while 58 of 110 individual matchups moved by up to 34.4 pp.
 *
 * ⚠️ **EACH ARM DERIVES THE OPENING RING THE WAY ITS OWN TREE DOES.** That is the point: the
 * old tree opens at `round(halfDiag / (1 - 6000/T))`, the new one at the half-diagonal. Using
 * one tree's radius in both arms would measure the clock alone and hide half the change.
 * Which branch ran is printed and stored in the JSON, so a run cannot be mistaken for the
 * other arm later.
 */

import { readFileSync, writeFileSync, existsSync } from 'node:fs';
import { fileURLToPath } from 'node:url';
import { dirname, resolve } from 'node:path';

const HERE = dirname(fileURLToPath(import.meta.url));
const ROOT = resolve(HERE, '../..');

const args = (() => {
  const o = { _: [] };
  const a = process.argv.slice(2);
  for (let i = 0; i < a.length; i++) {
    if (!a[i].startsWith('--')) { o._.push(a[i]); continue; }
    const next = a[i + 1];
    if (next === undefined || next.startsWith('--')) o[a[i].slice(2)] = true;
    else { o[a[i].slice(2)] = next; i++; }
  }
  return o;
})();

// ── --diff: compare two stored arms. No sim, no tree, so it can run anywhere. ──
if (args.diff) {
  const [pa, pb] = args._.length >= 2 ? args._ : [args.diff, args._[0]];
  const A = JSON.parse(readFileSync(String(pa), 'utf8'));
  const B = JSON.parse(readFileSync(String(pb), 'utf8'));
  console.log(`A: clock ${A.clock} ms · ring ${A.opening.toFixed(2)} wu · ${A.openingSource}`);
  console.log(`B: clock ${B.clock} ms · ring ${B.opening.toFixed(2)} wu · ${B.openingSource}`);
  if (A.cells.length !== B.cells.length) { console.error('arms have different corpora — not paired'); process.exit(1); }
  let moved = 0, maxShare = 0, maxEnd = 0;
  for (let i = 0; i < A.cells.length; i++) {
    const a = A.cells[i], b = B.cells[i];
    if (a.key !== b.key) { console.error(`cell ${i} is not the same match: ${a.key} vs ${b.key}`); process.exit(1); }
    const dShare = Math.abs(b.fogShare - a.fogShare);
    const dEnd = Math.abs(b.endMs - a.endMs);
    if (dShare > 0 || dEnd > 0) moved++;
    maxShare = Math.max(maxShare, dShare);
    maxEnd = Math.max(maxEnd, dEnd);
  }
  const agg = (X) => ({
    share: X.cells.reduce((s, c) => s + c.fog, 0) / Math.max(1, X.cells.reduce((s, c) => s + c.all, 0)),
    end: X.cells.reduce((s, c) => s + c.endMs, 0) / X.cells.length,
    timeouts: X.cells.filter((c) => c.timedOut).length,
    unresolved: X.cells.filter((c) => !c.ended).length,
  });
  const a = agg(A), b = agg(B);
  console.log(`\nPAIRED, ${A.cells.length} identical cells — EXACT, not an aggregate with a floor:`);
  console.log(`  cells that moved at all        ${moved} of ${A.cells.length}`);
  console.log(`  max per-cell fog-share delta   ${(100 * maxShare).toFixed(2)} pp`);
  console.log(`  max per-cell match-length      ${(maxEnd / 1000).toFixed(2)} s`);
  console.log(`\nAGGREGATE (reported separately, and it is a DIFFERENT QUANTITY):`);
  console.log(`  fog share of all damage        ${(100 * a.share).toFixed(2)}%  ->  ${(100 * b.share).toFixed(2)}%`);
  console.log(`  mean match length              ${(a.end / 1000).toFixed(1)}s  ->  ${(b.end / 1000).toFixed(1)}s`);
  console.log(`  resolveTimeout fired           ${a.timeouts}  ->  ${b.timeouts}`);
  console.log(`  never resolved (hit the cap)   ${a.unresolved}  ->  ${b.unresolved}`);
  process.exit(0);
}

const RULES = await import(`${ROOT}/src/game/rules.ts`);
const { createMatch, stepMatch } = await import(`${ROOT}/src/game/sim.ts`);
const { MAX_FIGHTERS } = await import(`${ROOT}/src/game/state.ts`);
const { MATCH_DURATION_MS, CHARACTER_IDS } = RULES;

const ARENA_PATH = String(args.arena ?? `${ROOT}/tools/arena.gameplay.json`);
if (!existsSync(ARENA_PATH)) { console.error(`no arena dump at ${ARENA_PATH}`); process.exit(1); }
const DUMP = JSON.parse(readFileSync(ARENA_PATH, 'utf8'));
const HALF_DIAG = Math.hypot(DUMP.width / 2, DUMP.height / 2);

// 🚨 EACH TREE'S OWN RULE. `fogOpeningRadiusFor` does not exist before 2026-08-12, and its
// absence is the signal that this is the OLD arm — not a reason to fall back silently.
let opening, openingSource;
if (typeof RULES.fogOpeningRadiusFor === 'function') {
  opening = RULES.fogOpeningRadiusFor(HALF_DIAG);
  openingSource = 'rules.ts:fogOpeningRadiusFor (post-2026-08-12 arm)';
} else {
  opening = Math.round(HALF_DIAG / (1 - 6000 / MATCH_DURATION_MS));
  openingSource = 'round(halfDiag / (1 - 6000/T)) (pre-2026-08-12 arm)';
}
const ARENA = { ...DUMP, maxSafeRadius: opening, build: () => null, update: () => {} };

const DT = Number(args.dt ?? 100);
const SEEDS = Number(args.seeds ?? 40);
const HARD_CAP = MATCH_DURATION_MS * 1.6 + 20000;

function spawnRing(n) {
  const cx = ARENA.center.x, cy = ARENA.center.y;
  const r = Math.hypot(ARENA.playerSpawn.x - cx, ARENA.playerSpawn.y - cy);
  const a0 = Math.atan2(ARENA.playerSpawn.y - cy, ARENA.playerSpawn.x - cx);
  return Array.from({ length: n }, (_, i) => {
    const a = a0 + (i * 2 * Math.PI) / n;
    return { x: cx + Math.cos(a) * r, y: cy + Math.sin(a) * r };
  });
}

const cells = [];
for (let n = 2; n <= MAX_FIGHTERS; n++) {
  const spawns = spawnRing(n);
  for (let seed = 0; seed < SEEDS; seed++) {
    const configs = spawns.map((s, i) => ({
      characterId: CHARACTER_IDS[(seed * 7 + i * 3) % CHARACTER_IDS.length],
      spawn: s,
      controller: 'ai',
    }));
    const state = createMatch(ARENA, configs);
    const inputs = new Array(n).fill(null);
    let fog = 0, all = 0;
    while (state.phase !== 'ended' && state.elapsed < HARD_CAP) {
      for (const ev of stepMatch(state, DT, inputs)) {
        if (ev.type !== 'hit-landed') continue;
        all += ev.amount;
        if (ev.source && ev.source.kind === 'fog') fog += ev.amount;
      }
    }
    cells.push({
      key: `N${n}s${seed}`, n, seed, fog, all,
      fogShare: fog / (all || 1),
      endMs: MATCH_DURATION_MS - state.timeRemaining,
      ended: state.phase === 'ended',
      timedOut: state.phase === 'ended' && state.fighters.every((f) => f.alive),
    });
  }
}

const share = cells.reduce((s, c) => s + c.fog, 0) / Math.max(1, cells.reduce((s, c) => s + c.all, 0));
console.log(`fs_sched_share · clock ${MATCH_DURATION_MS} ms · ring ${opening.toFixed(4)} wu · ${openingSource}`);
console.log(`${cells.length} matches (N=2..${MAX_FIGHTERS} x ${SEEDS} seeds, every seat AI)`);
console.log(`  fog share of all damage   ${(100 * share).toFixed(2)}%`);
console.log(`  mean match length         ${(cells.reduce((s, c) => s + c.endMs, 0) / cells.length / 1000).toFixed(1)}s`);
console.log(`  resolveTimeout fired      ${cells.filter((c) => c.timedOut).length} of ${cells.length}`);
console.log(`  never resolved            ${cells.filter((c) => !c.ended).length} of ${cells.length}`);
for (let n = 2; n <= MAX_FIGHTERS; n++) {
  const g = cells.filter((c) => c.n === n);
  const s = g.reduce((a, c) => a + c.fog, 0) / Math.max(1, g.reduce((a, c) => a + c.all, 0));
  console.log(`    N=${n}  fog ${(100 * s).toFixed(2)}%  mean end ${(g.reduce((a, c) => a + c.endMs, 0) / g.length / 1000).toFixed(1)}s`);
}

if (args.json) {
  writeFileSync(resolve(String(args.json)), JSON.stringify({
    clock: MATCH_DURATION_MS, opening, openingSource, halfDiag: HALF_DIAG,
    arena: { w: DUMP.width, h: DUMP.height }, dt: DT, seeds: SEEDS, cells,
  }, null, 2));
  console.log(`  -> ${args.json}`);
}
