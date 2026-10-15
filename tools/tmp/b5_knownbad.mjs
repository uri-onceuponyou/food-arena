#!/usr/bin/env node
/**
 * b5_knownbad — every B5 fix, REVERTED on a scratch copy of `src/`, must turn its own
 * `sim.test.mjs` §48 rows red while its controls stay green (`docs/REVAMP.md` §5, B5 — the AI,
 * 2026-10-15). Owner of the `b5_` prefix.
 *
 * `CLAUDE.md` #6: *"A guard that has not been shown to FAIL on the bug it guards against is not
 * a guard."* Each 🔴 row in §48 went red on `a53d8b0` before its fix landed and the commits say
 * so; this makes that claim re-runnable. The engine is B3's `tools/tmp/b3_knownbad.mjs:runArm`
 * (imported, not copied): one textual substitution per arm, asserted to match EXACTLY ONCE, the
 * real suite run against the copy, rows matched by name prefix.
 *
 * Every fix also gets an OVER-FIX arm where one is plausible — the broader change that would pass
 * every 🔴 row — and that arm must turn a CONTROL row red. A guard that only asks "is the bug
 * gone?" cannot tell a fix from a demolition.
 *
 *   node tools/tmp/b5_knownbad.mjs                 # every arm (~15 s each)
 *   node tools/tmp/b5_knownbad.mjs --arm sd-ring
 *   node tools/tmp/b5_knownbad.mjs --list
 *   node tools/tmp/b5_knownbad.mjs --selftest      # the rig shown to fail: a no-op revert, a drifted anchor
 */
import { resolve } from 'node:path';
import { runArm } from './b3_knownbad.mjs';

const ROOT = resolve(new URL('../..', import.meta.url).pathname);

const A_RED = [
  '(a) 🔴 two seats: a chase-branch bot KEEPS PRESSING',
  '(a) 🔴 two seats: …and is not walked into the pot',
  '(a) 🔴 six seats: EVERY bot keeps pressing',
  '(a) 🔴 six seats: no bot spends a second of sudden death inside the burn',
  '(a) 🔴 six seats: the wind-up is back',
  '(a) 🔴 …and so does the BOT',
];
const A_CONTROL = [
  '(a) CONTROL: in the final circle BEFORE the trigger',
  '(a) CONTROL: six seats — every bot presses before the trigger',
  '(a) CONTROL: a HUMAN Hamburger at 40% heals in sudden death',
];
const A_OVERFIX = '(a) CONTROL: before the collapse a bot in the fog still walks IN';
const B_BELIEF = '(b) 🔴 three seats: the belief about an opponent the bot never targeted';
const B_FIND = '(b) 🔴 three seats: …so when its fight ends it finds the hider';
const B_SIX = '(b) 🔴 six seats: every bot\'s belief about every opponent it can see';
const B_CONTROL = ['(b) NON-VACUITY: the hider walked in the bot\'s sight', '(b) CONTROL: two seats — the hider was the target all along'];
const D_THREE = '(d) 🔴 three seats: the bot shoots back';
const D_SIX = '(d) 🔴 six seats: the bot turns on the NEAREST visible opponent';
const D_NONVAC = ['(d) NON-VACUITY: three seats', '(d) NON-VACUITY: six seats'];
const D_OVERFIX = '(d) CONTROL: a visible opponent OUT of reach';

export const ARMS = [
  // ── AI-B1 ──────────────────────────────────────────────────────────────────────
  {
    name: 'sd-ring',
    bug: 'AI-B1 — the ring term reads sudden death\'s radius 0 as "outside the ring" (the shipped bug)',
    file: 'game/ai.ts',
    find: '  if (dc > EPS && !suddenDeathActive(state.timeRemaining)) {',
    repl: '  if (dc > EPS) {',
    mustFail: A_RED,
    mustPass: [...A_CONTROL, A_OVERFIX],
  },
  {
    name: 'ring-off',
    bug: 'AI-B1 over-fix — the ring term deleted outright (passes every sudden-death row)',
    file: 'game/ai.ts',
    find: '  if (dc > EPS && !suddenDeathActive(state.timeRemaining)) {',
    repl: '  if (false) {',
    mustFail: [A_OVERFIX],
    mustPass: [...A_RED, ...A_CONTROL],
  },
  // ── AI-B2 ──────────────────────────────────────────────────────────────────────
  {
    name: 'target-only-belief',
    bug: 'AI-B2 — only the current target\'s cell is refreshed; everyone else stays at their spawn (the shipped bug)',
    file: 'game/ai.ts',
    find: '      if (other === target) { visible = seen; continue; }\n      if (!seen) continue;',
    repl: '      if (other === target) { visible = seen; continue; }\n      continue;',
    mustFail: [B_BELIEF, B_FIND, B_SIX],
    mustPass: B_CONTROL,
  },
  {
    name: 'belief-omniscient',
    bug: 'AI-B2 over-fix — every opponent\'s cell refreshed whether or not it can be SEEN (concealment broken)',
    file: 'game/ai.ts',
    find: '      if (other === target) { visible = seen; continue; }\n      if (!seen) continue;',
    repl: '      if (other === target) { visible = seen; continue; }',
    mustFail: [B_BELIEF],
    mustPass: [B_SIX, ...B_CONTROL],
  },
  // ── AI-B4 ──────────────────────────────────────────────────────────────────────
  {
    name: 'hidden-lock',
    bug: 'AI-B4 — the target stays the hidden nearest; a visible shooter in reach is never shot back (the shipped bug)',
    file: 'game/ai.ts',
    find: '  if (!visible && inReach !== null) {\n    target = inReach;',
    repl: '  if (false) {\n    target = inReach;',
    mustFail: [D_THREE, D_SIX],
    mustPass: [...D_NONVAC, D_OVERFIX],
  },
  {
    name: 'prefer-visible',
    bug: 'AI-B4 over-fix — any visible opponent, at any distance, replaces a hidden nearest one',
    file: 'game/ai.ts',
    find: '      if (d <= reach && d < inReachD) { inReach = other; inReachD = d; }',
    repl: '      if (d < inReachD) { inReach = other; inReachD = d; }',
    mustFail: [D_OVERFIX],
    mustPass: [D_THREE, D_SIX, ...D_NONVAC],
  },
  {
    name: 'farthest-in-reach',
    bug: 'AI-B4 wrong pick — the FARTHEST visible opponent in reach, not the nearest',
    file: 'game/ai.ts',
    find: '      if (d <= reach && d < inReachD) { inReach = other; inReachD = d; }',
    repl: '      if (d <= reach && (inReach === null || d > inReachD)) { inReach = other; inReachD = d; }',
    mustFail: [D_SIX],
    mustPass: [D_THREE, ...D_NONVAC, D_OVERFIX],
  },
];

const IS_MAIN = process.argv[1] !== undefined && resolve(process.argv[1]) === resolve(new URL(import.meta.url).pathname);
if (IS_MAIN) {
  const argv = process.argv.slice(2);
  if (argv.includes('--list')) {
    for (const a of ARMS) console.log(`${a.name.padEnd(16)} ${a.bug}`);
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
    console.log(`${r.ok ? 'CAUGHT' : 'FAULT '}  ${a.name.padEnd(16)} ${a.bug}  — ${r.failed.length} row(s) red`);
    for (const f of r.faults) console.log(`          ${f}`);
  }
  console.log(`\nb5_knownbad: ${arms.length - bad}/${arms.length} arms caught by their own rows`);
  process.exitCode = bad ? 1 : 0;
}
