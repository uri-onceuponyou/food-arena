#!/usr/bin/env node
/**
 * b7_knownbad — every B7 fix, REVERTED (or replaced by a plausible wrong fix) on a scratch copy of
 * `src/`, must turn its own `sim.test.mjs` §49 rows red while its controls stay green
 * (`docs/REVAMP.md` §5, B7, 2026-10-16). Owner of the `b7_` prefix.
 *
 * `CLAUDE.md` #6: *"A guard that has not been shown to FAIL on the bug it guards against is not a
 * guard."* Each 🔴 row in §49 went red on `7360289` before its fix landed and the commits say so;
 * this makes that claim re-runnable. The engine is `tools/tmp/b3_knownbad.mjs:runArm` (imported,
 * not copied — the `b4_knownbad` pattern): one textual substitution per arm, asserted to match
 * EXACTLY ONCE, the real suite run against the copy, rows matched by name PREFIX.
 *
 *   * REVERT — the shipped bug, put back. Its 🔴 rows must go red.
 *   * WRONG FIX — a plausible fix that is not this one. Each must be caught by a row the right fix
 *     passes — otherwise that row is decoration.
 *
 *   node tools/tmp/b7_knownbad.mjs                 # every arm (~30 s each — the whole suite runs)
 *   node tools/tmp/b7_knownbad.mjs --arm nav-shared-field
 *   node tools/tmp/b7_knownbad.mjs --list
 *   node tools/tmp/b7_knownbad.mjs --selftest      # the rig shown to fail: a no-op revert, a drifted anchor
 */
import { resolve } from 'node:path';
import { pathToFileURL } from 'node:url';
import { runArm } from './b3_knownbad.mjs';

const ROOT = resolve(new URL('../..', import.meta.url).pathname);

export const ARMS = [
  // ── (a) AI-B5 — the flow field ────────────────────────────────────────────────
  {
    name: 'nav-shared-field',
    bug: 'AI-B5 REVERT — one field per GRID, shared by every fighter (the shipped thrash)',
    file: 'game/movement.ts',
    find: '  const field = navFieldOf(g, fighter);\n',
    repl: '  const field = navFieldOf(g, g);\n',
    mustFail: ['(a) 🔴 TWO bots with fixed', '(a) 🔴 …and SIX bots', '(a) 🔴 goals that JUMP', '(a) 🔴 a whole all-bot match'],
    mustPass: ['(a) NON-VACUITY: every steer', '(a) CONTROL: ONE bot', '(a) CONTROL: the cache is TRANSPARENT'],
  },
  // ⚠️ The obvious STALE-field wrong fix — "a fighter keeps its first field and never re-floods
  // when its own goal moves" (`g.requestedGoal !== goal` -> `g.requestedGoal < 0`) — CANNOT be
  // staged: it breaks every bot's pathing, and an earlier section (§27's `corpse.deaths` row,
  // outside B7's set) throws a TypeError on the missing kill, ending the suite before §49 prints.
  // The stale direction is shown instead by `nav-field-outlives-grid` below, which goes stale
  // only where §49's cover swap puts it.
  {
    name: 'nav-no-writeback',
    bug: 'AI-B5 WRONG FIX — a field per fighter, but the goal it was flooded for is never stored back: every query floods',
    file: 'game/movement.ts',
    find: '  field.requestedGoal = g.requestedGoal;\n',
    repl: '',
    mustFail: ['(a) CONTROL: ONE bot', '(a) 🔴 TWO bots with fixed', '(a) 🔴 …and SIX bots', '(a) 🔴 goals that JUMP', '(a) 🔴 a whole all-bot match'],
    mustPass: ['(a) NON-VACUITY: every steer', '(a) CONTROL: the cache is TRANSPARENT'],
  },
  {
    name: 'nav-field-outlives-grid',
    bug: 'AI-B5 WRONG FIX — a fighter\'s field survives a rebuilt grid (new cover): it routes over the old floor',
    file: 'game/movement.ts',
    find: '  if (field === undefined || field.grid !== g) {\n',
    repl: '  if (field === undefined) {\n',
    mustFail: ['(a) CONTROL: the cache is TRANSPARENT'],
    mustPass: ['(a) 🔴 TWO bots with fixed', '(a) 🔴 …and SIX bots', '(a) 🔴 goals that JUMP', '(a) CONTROL: ONE bot'],
  },
  // ── (b) SPLAT-OWNER ────────────────────────────────────────────────────────────
  {
    name: 'splat-no-owner',
    bug: 'SPLAT-OWNER REVERT — the splat records no owner, so every ground mark falls back to the splatter hue',
    file: 'game/sim.ts',
    find: '  const splat: Splat = { id: state.nextId++, ownerId, x, y, expiresAt: state.elapsed + SPLAT_DURATION_MS };\n',
    repl: '  const splat: Splat = { id: state.nextId++, x, y, expiresAt: state.elapsed + SPLAT_DURATION_MS };\n',
    mustFail: ['(b) 🔴 a splat left where a shot HITS', '(b) 🔴 …and so does one left where a shot ENDS'],
    mustPass: ['(b) NON-VACUITY: every splatter weapon'],
  },
  {
    name: 'splat-owner-is-victim',
    bug: 'SPLAT-OWNER WRONG FIX — the HIT site stamps the body struck (`p.targetId`, retargeted onto the victim)',
    file: 'game/sim.ts',
    find: '      if (w.splatter) spawnSplat(state, p.ownerId, p.x, p.y, events);\n      if (w.peckHits) {\n',
    repl: '      if (w.splatter) spawnSplat(state, p.targetId, p.x, p.y, events);\n      if (w.peckHits) {\n',
    mustFail: ['(b) 🔴 a splat left where a shot HITS'],
    mustPass: ['(b) 🔴 …and so does one left where a shot ENDS', '(b) NON-VACUITY: every splatter weapon'],
  },
  {
    name: 'splat-owner-two-seat',
    bug: 'SPLAT-OWNER WRONG FIX — the END site maps the seat NAME to a slot (player 0, enemy 1): right at two seats, slot 1 for slot 3 at six',
    file: 'game/sim.ts',
    find: "projectileMaxAgeMs(w)) {\n      if (w.splatter) spawnSplat(state, p.ownerId, p.x, p.y, events);\n",
    repl: "projectileMaxAgeMs(w)) {\n      if (w.splatter) spawnSplat(state, p.ownerRole === 'player' ? 0 : 1, p.x, p.y, events);\n",
    mustFail: ['(b) 🔴 …and so does one left where a shot ENDS'],
    mustPass: ['(b) 🔴 a splat left where a shot HITS', '(b) NON-VACUITY: every splatter weapon'],
  },
  // ── (c) Egg's peck clock ───────────────────────────────────────────────────────
  // One arm: the revert. B4's other shape question — `t -= period` without the `%` — is identical
  // whenever a step is shorter than the period, which every shipped step is (the 50 ms clamp vs
  // 500 ms), so no row can tell them apart and none pretends to.
  {
    name: 'peck-resets',
    bug: 'PECK REVERT — the peck clock drops its overshoot (540 ms at a 45 ms frame, 533.33 at 30 fps)',
    file: 'game/sim.ts',
    find: '        p.peckTimer = (p.peckTimer - peckInterval) % peckInterval;\n',
    repl: '        p.peckTimer = 0;\n',
    mustFail: ['(c) 🔴 every peck of a real Hatch!', '(c) 🔴 a chick that pecks TWELVE times'],
    mustPass: ['(c) NON-VACUITY: Hatch! struck', '(c) CONTROL: at the corpus'],
  },
];

const IS_MAIN = process.argv[1] !== undefined && pathToFileURL(resolve(process.argv[1])).href === import.meta.url;
if (IS_MAIN) {
  const argv = process.argv.slice(2);
  if (argv.includes('--list')) {
    for (const a of ARMS) console.log(`${a.name.padEnd(26)} ${a.bug}`);
    process.exit(0);
  }
  if (argv.includes('--selftest')) {
    const noop = runArm({ ...ARMS[0], name: 'selftest-noop', repl: ARMS[0].find }, ROOT);
    const drift = runArm({ ...ARMS[0], name: 'selftest-drift', find: 'THIS ANCHOR EXISTS NOWHERE' }, ROOT);
    const okNoop = !noop.ok && noop.faults.some((f) => f.startsWith('known-bad NOT CAUGHT'));
    const okDrift = !drift.ok && drift.faults.some((f) => f.startsWith('anchor matched 0 times'));
    console.log(`${okNoop ? 'PASS' : 'FAIL'}  a no-op revert is reported NOT CAUGHT  (${noop.faults.length} faults)`);
    console.log(`${okDrift ? 'PASS' : 'FAIL'}  a drifted anchor FAULTS instead of running  (${drift.faults.join('; ')})`);
    process.exit(okNoop && okDrift ? 0 : 1);
  }
  const only = argv.includes('--arm') ? argv[argv.indexOf('--arm') + 1] : null;
  const arms = only ? ARMS.filter((a) => a.name === only) : ARMS;
  if (arms.length === 0) { console.log(`no arm named ${only}`); process.exit(2); }
  let bad = 0;
  for (const a of arms) {
    const r = runArm(a, ROOT);
    if (!r.ok) bad++;
    console.log(`${r.ok ? 'CAUGHT' : 'FAULT '}  ${a.name.padEnd(26)} ${a.bug}  — ${r.failed.length} row(s) red`);
    for (const f of r.faults) console.log(`          ${f}`);
  }
  console.log(`\nb7_knownbad: ${arms.length - bad}/${arms.length} arms caught by their own rows`);
  process.exitCode = bad ? 1 : 0;
}
