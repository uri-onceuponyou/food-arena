#!/usr/bin/env node
/**
 * b3b_digest — BIT-IDENTITY digests of real matches, so a refactor can be A/B'd between two
 * trees on the thing it claims not to change (`docs/REVAMP.md` §5, package B3b, 2026-10-15).
 *
 * Every cell is one whole match on the shipped kitchen (`tools/arena.gameplay.json`), stepped at
 * 16.667 ms until `match-ended` plus a short tail, and digested as sha1 over EVERY event of EVERY
 * tick (JSON — shortest round-trip doubles, so the digest is bit-exact) and the final fighter
 * state. The sim has no RNG, so two trees agree on a cell iff they produced the identical stream.
 *
 * Suites (all EXACT, no sampling noise — a cell either moved or it did not):
 *   ai2    every ordered pair of the 11 characters, both seats `ai`   (110 cells)
 *   ai3    C(11,3) evenly subsampled, rotated, every seat `ai`        (--rosters, default 24)
 *   ai6    C(11,6) evenly subsampled, rotated, every seat `ai`        (--rosters, default 24)
 *   hum2   ai2's pairs with slot 0 a SCRIPTED HUMAN                    (110 cells)
 *   hum6   ai6's rosters with slot 0 a SCRIPTED HUMAN                  (--rosters)
 *   lure6  12 six-seat AI matches with THREE Sushis each (Seaweed + Big Catch lures)
 * The scripted human aims along a slowly rotating bearing, walks a slow circle and presses fire
 * every tick, cycling weapons every 2 s — deterministic, and deliberately NOT aimed at the
 * nearest opponent, so a rule that only reads a human's aim can be seen to move (or not).
 *
 *   node tools/tmp/b3b_digest.mjs --root <tree> --suite ai2,ai6 --out a.json
 *   node tools/tmp/b3b_digest.mjs --compare a.json b.json      # cells identical / moved, per suite
 *   node tools/tmp/b3b_digest.mjs --selftest                    # the comparer shown to FAIL on a planted change
 *
 * `--items x,y` gives EVERY seat those items (bots carry none in shipped play, DECISIONS §91h —
 * this is how an item rule is put in front of the AI corpus at all).
 */
import { createHash } from 'node:crypto';
import { readFileSync, writeFileSync } from 'node:fs';
import { resolve } from 'node:path';
import { argv } from './bh_combat_lib.mjs';

const ARGS = process.argv.slice(2);

function compare(a, b) {
  const A = JSON.parse(readFileSync(a, 'utf8'));
  const B = JSON.parse(readFileSync(b, 'utf8'));
  const out = {};
  for (const suite of Object.keys(A.cells)) {
    const ca = A.cells[suite] ?? {};
    const cb = B.cells[suite] ?? {};
    const keys = Object.keys(ca);
    const moved = keys.filter((k) => cb[k] === undefined || cb[k].h !== ca[k].h);
    const missing = keys.filter((k) => cb[k] === undefined);
    out[suite] = { cells: keys.length, identical: keys.length - moved.length, moved: moved.length, missing: missing.length, examples: moved.slice(0, 6) };
  }
  return out;
}

if (ARGS.includes('--compare')) {
  const i = ARGS.indexOf('--compare');
  const r = compare(ARGS[i + 1], ARGS[i + 2]);
  let anyEmpty = false;
  for (const [s, v] of Object.entries(r)) {
    if (v.cells === 0) anyEmpty = true;
    console.log(`${s.padEnd(6)} ${v.identical}/${v.cells} identical, ${v.moved} moved${v.missing ? ` (${v.missing} missing)` : ''}${v.moved ? `  e.g. ${v.examples.join(' · ')}` : ''}`);
  }
  // A comparison over zero cells is `[].every()` — it must not read as "identical".
  if (Object.keys(r).length === 0 || anyEmpty) { console.log('VACUOUS: a suite with zero cells'); process.exit(2); }
  process.exit(Object.values(r).some((v) => v.moved > 0) ? 1 : 0);
}

const { loadSim, kitchenArena } = await import('./bh_combat_lib.mjs');
const ROOT = argv('root', undefined);
// ⚠️ T1b 2026-10-16 — this was `loadSim(ROOT)`, and with no --root that falls through to
// bh_combat_lib's DEFAULT_ROOT, `/private/tmp/fa-rv-head`: a review-phase worktree (at 1090046 that
// day), so `--selftest` digested ANOTHER tree's sim — and would crash wherever that path is absent.
// b5_digest's rule, copied: --selftest runs on THIS tree; a measurement run must name its tree.
if (!ROOT && !ARGS.includes('--selftest')) { console.error('b3b_digest: --root <tree> is required (see the header)'); process.exit(2); }
const S = await loadSim(ROOT ?? resolve(new URL('../..', import.meta.url).pathname));
const { CHARACTER_IDS, MATCH_DURATION_MS } = S.rules;
const arena = kitchenArena();
const DT = 16.667;
const CAP = MATCH_DURATION_MS * 1.6 + 20000;
const TAIL_MS = 1500;
const ROSTERS = Number(argv('rosters', 24));
const ITEMS = argv('items', '') ? String(argv('items')).split(',') : undefined;

function rosters(N) {
  const ids = CHARACTER_IDS;
  if (N === 2) { const out = []; for (const a of ids) for (const b of ids) if (a !== b) out.push([a, b]); return out; }
  const combos = [];
  const rec = (start, acc) => {
    if (acc.length === N) { combos.push(acc.slice()); return; }
    for (let i = start; i < ids.length; i++) { acc.push(ids[i]); rec(i + 1, acc); acc.pop(); }
  };
  rec(0, []);
  const n = Math.min(ROSTERS, combos.length);
  const step = combos.length / n;
  const out = [];
  for (let r = 0; r < n; r++) { const c = combos[Math.floor(r * step)]; const rot = r % N; out.push(c.slice(rot).concat(c.slice(0, rot))); }
  return out;
}

function humanInput(st, t) {
  const a = t * 0.0007;                      // ~0.7 rad/s bearing
  const m = t * 0.00035;
  const nW = S.rules.CHARACTERS[st.fighters[0].characterId].weapons.length;
  return { move: { x: Math.cos(m), y: Math.sin(m) }, aim: { x: Math.cos(a), y: Math.sin(a) },
    selectedWeapon: Math.floor(t / 2000) % nW, attack: true };
}

function runOne(roster, human) {
  const N = roster.length;
  const st = S.sim.createMatch(arena, roster.map((characterId, i) => ({
    characterId, controller: human && i === 0 ? 'human' : 'ai',
    spawn: N === 2 ? undefined : { x: arena.spawns[i].x, y: arena.spawns[i].y },
    items: ITEMS,
  })));
  const h = createHash('sha1');
  let ended = -1;
  while (st.elapsed < CAP) {
    const inputs = roster.map((_, i) => (human && i === 0 ? humanInput(st, st.elapsed) : null));
    const evs = S.sim.stepMatch(st, DT, inputs);
    h.update(JSON.stringify(evs));
    if (ended < 0 && st.phase === 'ended') ended = st.elapsed;
    if (ended >= 0 && st.elapsed - ended >= TAIL_MS) break;
  }
  h.update(JSON.stringify(st.fighters.map((f) => [f.x, f.y, f.hp, f.alive])));
  return { h: h.digest('hex').slice(0, 16), ms: Math.round(st.elapsed) };
}

const SUITES = {
  ai2: () => rosters(2).map((r) => [r, false]),
  ai3: () => rosters(3).map((r) => [r, false]),
  ai6: () => rosters(6).map((r) => [r, false]),
  hum2: () => rosters(2).map((r) => [r, true]),
  hum6: () => rosters(6).map((r) => [r, true]),
  // LURE-HEAVY: three AI Sushis in every six-seat match (Seaweed + Big Catch), so a lure rule
  // is in front of the corpus often enough for "0 moved" to mean something (BH-09).
  lure6: () => {
    const others = CHARACTER_IDS.filter((i) => i !== 'sushi');
    return Array.from({ length: 12 }, (_, r) => [['sushi', others[r % others.length], 'sushi',
      others[(r + 3) % others.length], 'sushi', others[(r + 6) % others.length]], false]);
  },
};

if (ARGS.includes('--selftest')) {
  // The comparer is an instrument too: identical inputs must read identical, a planted change must
  // read MOVED, and an empty suite must read VACUOUS rather than identical.
  const { tmpdir } = await import('node:os');
  const { join } = await import('node:path');
  const { execFileSync } = await import('node:child_process');
  const cells = Object.fromEntries(rosters(2).slice(0, 3).map((r) => [r.join('>'), runOne(r, false)]));
  const a = join(tmpdir(), `b3bd-a-${process.pid}.json`), b = join(tmpdir(), `b3bd-b-${process.pid}.json`), e = join(tmpdir(), `b3bd-e-${process.pid}.json`);
  writeFileSync(a, JSON.stringify({ cells: { ai2: cells } }));
  const planted = JSON.parse(JSON.stringify(cells)); const k0 = Object.keys(planted)[0]; planted[k0].h = 'x' + planted[k0].h.slice(1);
  writeFileSync(b, JSON.stringify({ cells: { ai2: planted } }));
  writeFileSync(e, JSON.stringify({ cells: { ai2: {} } }));
  const run = (x, y) => { try { execFileSync('node', [process.argv[1], '--compare', x, y], { stdio: 'pipe' }); return 0; } catch (err) { return err.status; } };
  const same = run(a, a), moved = run(a, b), empty = run(e, e);
  const rerun = runOne(rosters(2)[0], false).h === cells[k0].h;
  console.log(`${same === 0 ? 'PASS' : 'FAIL'}  identical files compare identical (exit ${same})`);
  console.log(`${moved === 1 ? 'PASS' : 'FAIL'}  a planted change reads MOVED (exit ${moved})`);
  console.log(`${empty === 2 ? 'PASS' : 'FAIL'}  an empty suite reads VACUOUS, not identical (exit ${empty})`);
  console.log(`${rerun ? 'PASS' : 'FAIL'}  the same cell re-run digests identically (determinism)`);
  // A COUNT LINE (T1b, 2026-10-16): gatecount registers this selftest against it.
  const checks = [same === 0, moved === 1, empty === 2, rerun];
  console.log(`\nb3b_digest --selftest: ${checks.filter(Boolean).length} passed, ${checks.filter((c) => !c).length} failed`);
  process.exit(same === 0 && moved === 1 && empty === 2 && rerun ? 0 : 1);
}

const want = String(argv('suite', 'ai2')).split(',');
const out = { root: ROOT ?? '(default)', items: ITEMS ?? null, cells: {} };
for (const s of want) {
  if (!SUITES[s]) { console.error(`unknown suite ${s}`); process.exit(2); }
  const t0 = Date.now();
  out.cells[s] = {};
  for (const [r, human] of SUITES[s]()) out.cells[s][r.join('>')] = runOne(r, human);
  console.log(`${s.padEnd(6)} ${Object.keys(out.cells[s]).length} cells in ${((Date.now() - t0) / 1000).toFixed(1)} s`);
}
const OUT = argv('out', null);
if (OUT) writeFileSync(OUT, JSON.stringify(out));
