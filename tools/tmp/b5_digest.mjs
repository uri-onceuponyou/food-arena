#!/usr/bin/env node
/**
 * b5_digest — BIT-IDENTITY digests of real matches, plus the FACTS that say WHY a cell moved
 * (`docs/REVAMP.md` §5, package B5 — the AI, 2026-10-15). Owner of the `b5_` prefix.
 *
 * Same cells and same digest as `tools/tmp/b3b_digest.mjs` (sha1 over every event of every tick
 * plus the final fighter state, whole matches on the shipped kitchen, no RNG — a cell either
 * moved or it did not), with three additions the AI fixes need:
 *
 *   * per-cell FACTS recorded on each tree — `sd` (the match reached sudden death), `hid` (some
 *     bot's target was concealed from it on at least one tick), `win` (winner slot) and `order`
 *     (the elimination order off the `death` event stream, which is where it lives — every loser
 *     ends bit-identical in state) — so a claim like "only matches that reach sudden death can
 *     move" is CHECKED cell by cell rather than inferred from a count;
 *   * `--compare a b` prints, for the moved cells, how many changed WINNER and how many changed
 *     the ELIMINATION ORDER (paired, identical inputs: EXACT, not a sample), and `--require-subset
 *     <fact>` exits 1 if any moved cell lacks that fact on the BASE tree (file `a`);
 *   * `hum3`, an N=3 suite with slot 0 the scripted human — B2/B4 first express at three seats.
 *
 *   node tools/tmp/b5_digest.mjs --root <tree> --suite ai2,ai6,hum2,hum6 --out a.json
 *   node tools/tmp/b5_digest.mjs --compare a.json b.json [--require-subset sd]
 *   node tools/tmp/b5_digest.mjs --selftest
 *
 * ⚠️ ALWAYS pass `--root`: the shared lib's default root is a detached worktree of another
 * commit (`bh_combat_lib.mjs:DEFAULT_ROOT`), and an A/B whose two arms read the same tree
 * reads exactly like "the change did nothing" (`docs/AGENT-BRIEF.md` §3).
 */
import { createHash } from 'node:crypto';
import { readFileSync, writeFileSync } from 'node:fs';
import { resolve } from 'node:path';
import { argv } from './bh_combat_lib.mjs';

const ARGS = process.argv.slice(2);
const IS_MAIN = process.argv[1] !== undefined && resolve(process.argv[1]) === resolve(new URL(import.meta.url).pathname);

export function compare(a, b) {
  const A = JSON.parse(readFileSync(a, 'utf8'));
  const B = JSON.parse(readFileSync(b, 'utf8'));
  const out = {};
  for (const suite of Object.keys(A.cells)) {
    const ca = A.cells[suite] ?? {};
    const cb = B.cells[suite] ?? {};
    const keys = Object.keys(ca);
    const moved = keys.filter((k) => cb[k] === undefined || cb[k].h !== ca[k].h);
    const missing = keys.filter((k) => cb[k] === undefined);
    const win = moved.filter((k) => cb[k] && cb[k].win !== ca[k].win);
    const order = moved.filter((k) => cb[k] && JSON.stringify(cb[k].order) !== JSON.stringify(ca[k].order));
    const facts = {};
    for (const f of ['sd', 'hid']) facts[f] = { moved: moved.filter((k) => ca[k][f]).length, all: keys.filter((k) => ca[k][f]).length };
    out[suite] = { cells: keys.length, identical: keys.length - moved.length, moved: moved.length, missing: missing.length,
      win: win.length, order: order.length, facts, movedKeys: moved, examples: moved.slice(0, 6) };
  }
  return out;
}

if (IS_MAIN && ARGS.includes('--compare')) {
  const i = ARGS.indexOf('--compare');
  const a = ARGS[i + 1];
  const r = compare(a, ARGS[i + 2]);
  const need = ARGS.includes('--require-subset') ? ARGS[ARGS.indexOf('--require-subset') + 1] : null;
  const A = JSON.parse(readFileSync(a, 'utf8'));
  let anyEmpty = false;
  let subsetFault = 0;
  for (const [s, v] of Object.entries(r)) {
    if (v.cells === 0) anyEmpty = true;
    const f = Object.entries(v.facts).map(([k, x]) => `${k} ${x.moved}/${x.all}`).join(', ');
    console.log(`${s.padEnd(6)} ${v.identical}/${v.cells} identical, ${v.moved} moved${v.missing ? ` (${v.missing} missing)` : ''}`
      + ` · winner changed ${v.win} · elimination order changed ${v.order} · [base facts among moved/all: ${f}]`
      + `${v.moved ? `\n         e.g. ${v.examples.join(' · ')}` : ''}`);
    if (need) {
      const bad = v.movedKeys.filter((k) => !A.cells[s][k][need]);
      if (bad.length) { subsetFault += bad.length; console.log(`         ✗ ${bad.length} moved cell(s) WITHOUT base fact "${need}": ${bad.slice(0, 6).join(' · ')}`); }
    }
  }
  // A comparison over zero cells is `[].every()` — it must not read as "identical".
  if (Object.keys(r).length === 0 || anyEmpty) { console.log('VACUOUS: a suite with zero cells'); process.exit(2); }
  if (need) process.exit(subsetFault ? 1 : 0);
  process.exit(Object.values(r).some((v) => v.moved > 0) ? 1 : 0);
}

if (IS_MAIN && !ARGS.includes('--compare')) {
  const { loadSim, kitchenArena } = await import('./bh_combat_lib.mjs');
  const ROOT = argv('root', undefined);
  if (!ROOT && !ARGS.includes('--selftest')) { console.error('b5_digest: --root <tree> is required (see the header)'); process.exit(2); }
  const S = await loadSim(ROOT ?? resolve(new URL('../..', import.meta.url).pathname));
  const { CHARACTER_IDS, MATCH_DURATION_MS, suddenDeathActive } = S.rules;
  const arena = kitchenArena();
  const DT = 16.667;
  const CAP = MATCH_DURATION_MS * 1.6 + 20000;
  const TAIL_MS = 1500;
  const ROSTERS = Number(argv('rosters', 24));

  const rosters = (N) => {
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
  };

  // Identical to `b3b_digest.mjs:humanInput` — deliberately NOT aimed at the nearest opponent.
  const humanInput = (st, t) => {
    const a = t * 0.0007;
    const m = t * 0.00035;
    const nW = S.rules.CHARACTERS[st.fighters[0].characterId].weapons.length;
    return { move: { x: Math.cos(m), y: Math.sin(m) }, aim: { x: Math.cos(a), y: Math.sin(a) },
      selectedWeapon: Math.floor(t / 2000) % nW, attack: true };
  };

  const runOne = (roster, human) => {
    const N = roster.length;
    const st = S.sim.createMatch(arena, roster.map((characterId, i) => ({
      characterId, controller: human && i === 0 ? 'human' : 'ai',
      spawn: N === 2 ? undefined : { x: arena.spawns[i].x, y: arena.spawns[i].y },
    })));
    const h = createHash('sha1');
    let ended = -1;
    let sd = false;
    let hid = false;
    const order = [];
    while (st.elapsed < CAP) {
      const inputs = roster.map((_, i) => (human && i === 0 ? humanInput(st, st.elapsed) : null));
      const evs = S.sim.stepMatch(st, DT, inputs);
      h.update(JSON.stringify(evs));
      for (const e of evs) if (e.type === 'death') order.push(e.fighterId);
      if (st.phase === 'playing') {
        if (!sd && suddenDeathActive(st.timeRemaining)) sd = true;
        if (!hid) {
          for (const f of st.fighters) {
            if (f.controller !== 'ai' || !f.alive) continue;
            const t = S.state.nearestLivingOpponent(st, f);
            if (t && !S.movement.isVisibleFrom(f.x, f.y, t.x, t.y, st.arena, st, t)) { hid = true; break; }
          }
        }
      }
      if (ended < 0 && st.phase === 'ended') ended = st.elapsed;
      if (ended >= 0 && st.elapsed - ended >= TAIL_MS) break;
    }
    h.update(JSON.stringify(st.fighters.map((f) => [f.x, f.y, f.hp, f.alive])));
    return { h: h.digest('hex').slice(0, 16), ms: Math.round(st.elapsed), sd, hid, win: st.winnerId, order };
  };

  const SUITES = {
    ai2: () => rosters(2).map((r) => [r, false]),
    ai3: () => rosters(3).map((r) => [r, false]),
    ai6: () => rosters(6).map((r) => [r, false]),
    hum2: () => rosters(2).map((r) => [r, true]),
    hum3: () => rosters(3).map((r) => [r, true]),
    hum6: () => rosters(6).map((r) => [r, true]),
  };

  if (ARGS.includes('--selftest')) {
    // The comparer is an instrument too: identical inputs must read identical, a planted change
    // must read MOVED, a moved cell lacking a required base fact must FAIL the subset check, and
    // an empty suite must read VACUOUS rather than identical.
    const { tmpdir } = await import('node:os');
    const { join } = await import('node:path');
    const { execFileSync } = await import('node:child_process');
    const cells = Object.fromEntries(rosters(2).slice(0, 3).map((r) => [r.join('>'), runOne(r, false)]));
    const p = (n) => join(tmpdir(), `b5d-${n}-${process.pid}.json`);
    writeFileSync(p('a'), JSON.stringify({ cells: { ai2: cells } }));
    const planted = JSON.parse(JSON.stringify(cells));
    const k0 = Object.keys(planted)[0];
    planted[k0].h = `x${planted[k0].h.slice(1)}`;
    planted[k0].win = planted[k0].win === 0 ? 1 : 0;
    writeFileSync(p('b'), JSON.stringify({ cells: { ai2: planted } }));
    writeFileSync(p('e'), JSON.stringify({ cells: { ai2: {} } }));
    const run = (...a) => { try { execFileSync('node', [process.argv[1], '--compare', ...a], { stdio: 'pipe' }); return 0; } catch (err) { return err.status; } };
    const same = run(p('a'), p('a'));
    const moved = run(p('a'), p('b'));
    const empty = run(p('e'), p('e'));
    const noSd = cells[k0].sd === false;
    const subset = run(p('a'), p('b'), '--require-subset', 'sd');
    const cmp = compare(p('a'), p('b')).ai2;
    const rerun = runOne(rosters(2)[0], false).h === cells[k0].h;
    const rows = [
      [same === 0, `identical files compare identical (exit ${same})`],
      [moved === 1, `a planted change reads MOVED (exit ${moved})`],
      [cmp.win === 1 && cmp.moved === 1, `…and a planted winner change is COUNTED (${cmp.win} of ${cmp.moved})`],
      [noSd && subset === 1, `a moved cell whose base never reached sudden death FAILS --require-subset sd (exit ${subset})`],
      [empty === 2, `an empty suite reads VACUOUS, not identical (exit ${empty})`],
      [rerun, 'the same cell re-run digests identically (determinism)'],
    ];
    for (const [ok, msg] of rows) console.log(`${ok ? 'PASS' : 'FAIL'}  ${msg}`);
    // A COUNT LINE (T1b, 2026-10-16): gatecount registers this selftest against it.
    console.log(`\nb5_digest --selftest: ${rows.filter(([ok]) => ok).length} passed, ${rows.filter(([ok]) => !ok).length} failed`);
    process.exit(rows.every(([ok]) => ok) ? 0 : 1);
  }

  const want = String(argv('suite', 'ai2')).split(',');
  const out = { root: ROOT, cells: {} };
  for (const s of want) {
    if (!SUITES[s]) { console.error(`unknown suite ${s}`); process.exit(2); }
    const t0 = Date.now();
    out.cells[s] = {};
    for (const [r, human] of SUITES[s]()) out.cells[s][r.join('>')] = runOne(r, human);
    const c = Object.values(out.cells[s]);
    console.log(`${s.padEnd(6)} ${c.length} cells in ${((Date.now() - t0) / 1000).toFixed(1)} s · reached sudden death ${c.filter((x) => x.sd).length} · a bot's target hidden ${c.filter((x) => x.hid).length}`);
  }
  const OUT = argv('out', null);
  if (OUT) writeFileSync(OUT, JSON.stringify(out));
}
