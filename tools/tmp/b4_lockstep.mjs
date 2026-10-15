#!/usr/bin/env node
/**
 * b4_lockstep — WHY did a `b3b_digest` cell move? Replays exactly the cells two digests disagree
 * on, on both trees in LOCKSTEP, and reports the first event that differs — and whether the cell
 * is identical once named fields are masked (`docs/REVAMP.md` §5 B4, 2026-10-15). `b4_` prefix.
 *
 * A digest says THAT a match moved; a fix that is meant to move only one field (the latched
 * chick's position, BH-12) or only one mechanism (a timer's cadence, move B3) has to show that
 * the move is exactly that and nothing else. So:
 *
 *   node tools/tmp/b4_lockstep.mjs --a <rootA> --b <rootB> --da a.json --db b.json \
 *        [--suite ai2] [--mask projectile-destroyed.x,projectile-destroyed.y] [--max 40]
 *
 * ⚠️ THE REPLAY IS A COPY OF `b3b_digest.mjs:runOne` — the harness that defines a cell (dt
 * 16.667, spawns, the scripted human, the tail) — and a copy of a harness is how an instrument
 * ends up measuring its own copy. So it is SELF-CHECKING: before diffing, each replayed cell is
 * re-digested exactly as `b3b_digest` digests it and must reproduce that tree's stored hash.
 * A replay that drifts from the harness FAULTS, it does not report.
 *
 *   node tools/tmp/b4_lockstep.mjs --selftest   # identical trees diff nothing; a planted event
 *                                               # change is found; a mask hides only its field
 */
import { createHash } from 'node:crypto';
import { readFileSync } from 'node:fs';
import { resolve } from 'node:path';
import { pathToFileURL } from 'node:url';
import { loadSim, kitchenArena } from './bh_combat_lib.mjs';

const IS_MAIN = process.argv[1] !== undefined && pathToFileURL(resolve(process.argv[1])).href === import.meta.url;
const arg = (n, d) => { const i = process.argv.indexOf(`--${n}`); return i < 0 ? d : process.argv[i + 1]; };

const DT = 16.667;   // b3b_digest's
const TAIL_MS = 1500;

/** b3b_digest's scripted human, verbatim. */
function humanInput(S, st, t) {
  const a = t * 0.0007;
  const m = t * 0.00035;
  const nW = S.rules.CHARACTERS[st.fighters[0].characterId].weapons.length;
  return { move: { x: Math.cos(m), y: Math.sin(m) }, aim: { x: Math.cos(a), y: Math.sin(a) },
    selectedWeapon: Math.floor(t / 2000) % nW, attack: true };
}

/** A generator over one cell's ticks: yields the tick's events, returns the digest hash. */
function* cell(S, arena, roster, human, items) {
  const N = roster.length;
  const CAP = S.rules.MATCH_DURATION_MS * 1.6 + 20000;
  const st = S.sim.createMatch(arena, roster.map((characterId, i) => ({
    characterId, controller: human && i === 0 ? 'human' : 'ai',
    spawn: N === 2 ? undefined : { x: arena.spawns[i].x, y: arena.spawns[i].y },
    items,
  })));
  const h = createHash('sha1');
  let ended = -1;
  while (st.elapsed < CAP) {
    const inputs = roster.map((_, i) => (human && i === 0 ? humanInput(S, st, st.elapsed) : null));
    const evs = S.sim.stepMatch(st, DT, inputs);
    h.update(JSON.stringify(evs));
    yield { evs, elapsed: st.elapsed };
    if (ended < 0 && st.phase === 'ended') ended = st.elapsed;
    if (ended >= 0 && st.elapsed - ended >= TAIL_MS) break;
  }
  h.update(JSON.stringify(st.fighters.map((f) => [f.x, f.y, f.hp, f.alive])));
  return h.digest('hex').slice(0, 16);
}

/** Mask `type.field` entries (e.g. `projectile-destroyed.x`) out of an event list. */
function masked(evs, mask) {
  if (mask.length === 0) return evs;
  return evs.map((e) => {
    const drop = mask.filter((m) => m.type === e.type).map((m) => m.field);
    if (drop.length === 0) return e;
    const c = { ...e };
    for (const f of drop) delete c[f];
    return c;
  });
}

/** Lockstep two trees over one cell. Returns { hashA, hashB, firstDiff, maskedIdentical, ticks }. */
function lockstep(SA, SB, arena, roster, human, items, mask) {
  const ga = cell(SA, arena, roster, human, items);
  const gb = cell(SB, arena, roster, human, items);
  let firstDiff = null, maskedDiff = null, ticks = 0;
  for (;;) {
    const ra = ga.next(), rb = gb.next();
    if (ra.done || rb.done) {
      // Drain whichever is left so both return their hash.
      let fa = ra, fb = rb;
      while (!fa.done) fa = ga.next();
      while (!fb.done) fb = gb.next();
      if (!ra.done || !rb.done) {
        const why = `one tree ended the cell at tick ${ticks}, the other ran on`;
        firstDiff ??= why; maskedDiff ??= why;
      }
      return { hashA: fa.value, hashB: fb.value, firstDiff, maskedIdentical: maskedDiff === null, maskedDiff, ticks };
    }
    ticks++;
    const ja = JSON.stringify(ra.value.evs), jb = JSON.stringify(rb.value.evs);
    if (ja !== jb && firstDiff === null) {
      const i = ra.value.evs.findIndex((e, k) => JSON.stringify(e) !== JSON.stringify(rb.value.evs[k]));
      const k = i < 0 ? Math.min(ra.value.evs.length, rb.value.evs.length) : i;
      firstDiff = `t=${ra.value.elapsed.toFixed(1)} event #${k}: A ${JSON.stringify(ra.value.evs[k]) ?? '(none)'} | B ${JSON.stringify(rb.value.evs[k]) ?? '(none)'}`;
    }
    if (maskedDiff === null && JSON.stringify(masked(ra.value.evs, mask)) !== JSON.stringify(masked(rb.value.evs, mask))) {
      maskedDiff = `t=${ra.value.elapsed.toFixed(1)} (masked)`;
    }
  }
}

const SUITE_SHAPE = { ai2: { human: false }, ai3: { human: false }, ai6: { human: false }, hum2: { human: true }, hum6: { human: true }, lure6: { human: false } };

async function main() {
  const SA = await loadSim(resolve(arg('a')));
  const SB = await loadSim(resolve(arg('b')));
  const DA = JSON.parse(readFileSync(arg('da'), 'utf8'));
  const DB = JSON.parse(readFileSync(arg('db'), 'utf8'));
  if (JSON.stringify(DA.items) !== JSON.stringify(DB.items)) { console.log('FAULT: the two digests were run with different --items'); process.exit(2); }
  const items = DA.items ?? undefined;
  const mask = String(arg('mask', '')).split(',').filter(Boolean).map((s) => { const [type, field] = s.split('.'); return { type, field }; });
  const MAX = Number(arg('max', 40));
  const arena = kitchenArena();
  const only = arg('suite', null);
  let faults = 0, explained = 0, unexplained = 0;
  for (const suite of Object.keys(DA.cells)) {
    if (only && suite !== only) continue;
    const ca = DA.cells[suite], cb = DB.cells[suite] ?? {};
    const moved = Object.keys(ca).filter((k) => cb[k] !== undefined && cb[k].h !== ca[k].h);
    console.log(`\n== ${suite}: ${moved.length} of ${Object.keys(ca).length} cells moved${moved.length > MAX ? ` (replaying the first ${MAX})` : ''}`);
    for (const key of moved.slice(0, MAX)) {
      const r = lockstep(SA, SB, arena, key.split('>'), SUITE_SHAPE[suite].human, items, mask);
      const repro = r.hashA === ca[key].h && r.hashB === cb[key].h;
      if (!repro) { faults++; console.log(`  FAULT ${key}: the replay does not reproduce the stored digests (${r.hashA}/${ca[key].h}, ${r.hashB}/${cb[key].h})`); continue; }
      if (mask.length && r.maskedIdentical) explained++; else unexplained++;
      console.log(`  ${mask.length ? (r.maskedIdentical ? 'MASKED-SAME' : 'MOVED     ') : 'MOVED     '} ${key}  first diff ${r.firstDiff}`);
    }
  }
  console.log(`\nb4_lockstep: ${explained} cell(s) identical under the mask, ${unexplained} not, ${faults} replay fault(s)`);
  process.exitCode = faults ? 2 : unexplained && mask.length ? 1 : 0;
}

if (IS_MAIN) {
  if (process.argv.includes('--selftest')) {
    // The differ is an instrument: identical trees must diff nothing, a planted change must be
    // found at its tick, and a mask must hide exactly its field and nothing else.
    const S = await loadSim(resolve(new URL('../..', import.meta.url).pathname));
    const arena = kitchenArena();
    const roster = ['egg', 'sushi'];
    const same = lockstep(S, S, arena, roster, false, undefined, []);
    // A tree whose stepMatch nudges every `projectile-destroyed` x by 1 — a field-level change.
    const nudged = { ...S, sim: { ...S.sim, stepMatch: (st, dt, inp) => S.sim.stepMatch(st, dt, inp).map((e) => (e.type === 'projectile-destroyed' ? { ...e, x: e.x + 1 } : e)) } };
    const planted = lockstep(S, nudged, arena, roster, false, undefined, []);
    const hidden = lockstep(S, nudged, arena, roster, false, undefined, [{ type: 'projectile-destroyed', field: 'x' }]);
    const wrongMask = lockstep(S, nudged, arena, roster, false, undefined, [{ type: 'projectile-destroyed', field: 'y' }]);
    const rows = [
      [same.firstDiff === null && same.maskedIdentical && same.hashA === same.hashB, `identical trees: no diff over ${same.ticks} ticks`],
      [planted.firstDiff !== null && planted.hashA !== planted.hashB, `a planted field change is FOUND: ${planted.firstDiff?.slice(0, 80)}`],
      [hidden.maskedIdentical && hidden.firstDiff !== null, 'masking exactly that field makes the cell identical (and the raw diff is still reported)'],
      [!wrongMask.maskedIdentical, 'masking a DIFFERENT field does not hide it'],
    ];
    for (const [ok, what] of rows) console.log(`${ok ? 'PASS' : 'FAIL'}  ${what}`);
    process.exit(rows.every(([ok]) => ok) ? 0 : 1);
  }
  await main();
}
