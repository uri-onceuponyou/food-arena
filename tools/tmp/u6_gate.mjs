#!/usr/bin/env node
/**
 * U6_GATE — for a proposed weapon edit, print EXACTLY which `sim.test.mjs` rows it turns
 * red, and nothing else.
 *
 * ── WHY ─────────────────────────────────────────────────────────────────────
 *
 * `DECISIONS §77` authorises converting the five remaining ultimates to wind-ups and
 * redesigning a super where the number demands it. Measured here, **every single one of
 * those edits reddens `sim.test.mjs`** — a file the converting pass does not own — and the
 * rows are not one class:
 *
 *   * §33(o)'s ratchet asserts `castMs === roundUp50(range / slowestHuman + 300)`, the
 *     MELEE DISC closed form, for every cast weapon in the roster;
 *   * §33(l)/(n) assert a dodge that has to cross `range` wu;
 *   * a dozen §1/§20/§25 FIXTURES press a ranged special and read its projectiles on the
 *     SAME tick, which a wind-up moves to a later one;
 *   * §19/§29 rows key on `REACH.ultimateSlam` being 400.
 *
 * Handing that over as prose is how a routing note becomes a re-derivation. This turns it
 * into one command whose output is a list of row names.
 *
 * ⚠️ **IT IS A DIFF, NOT A RUN.** The tree already has pre-existing red rows from other
 * passes; printing a raw failure list would attribute them to the edit. So the baseline
 * ref is run FIRST, in the same worktree, and only rows that are green there and red here
 * are reported — plus, separately, any row that was red and went GREEN, because a fix that
 * silences a guard is the more dangerous direction (`CLAUDE.md` #6: a guard that has
 * nothing left to check passes).
 *
 *   node tools/tmp/u6_gate.mjs --selftest
 *   node tools/tmp/u6_gate.mjs --ref a06c0fd --dir /tmp/fa-u6-gate --set soup.Dump.castMs=600
 */
import { execFileSync } from 'node:child_process';
import { existsSync } from 'node:fs';
import { resolve } from 'node:path';

const ROOT = resolve(new URL('../..', import.meta.url).pathname);

const args = (() => {
  const o = { set: [] };
  for (let i = 2; i < process.argv.length; i++) {
    const a = process.argv[i];
    if (!a.startsWith('--')) continue;
    const n = process.argv[i + 1];
    const v = n === undefined || n.startsWith('--') ? true : (i++, n);
    if (a === '--set') o.set.push(v); else o[a.slice(2)] = v;
  }
  return o;
})();

/**
 * Run `sim.test.mjs` in `dir` and return `{ pass, fail, failures }`.
 *
 * ⚠️ The suite EXITS 1 when anything fails, so `execFileSync` throws and the output has to
 * be read off the error. Reading only the happy path here would report every red tree as
 * "no failures", which is the exact shape of a vacuous guard.
 */
function runSuite(dir) {
  let out;
  try {
    out = execFileSync(process.execPath, [`${dir}/src/game/sim.test.mjs`], { encoding: 'utf8', cwd: dir, stdio: ['ignore', 'pipe', 'pipe'] });
  } catch (e) {
    out = String(e.stdout ?? '') + String(e.stderr ?? '');
  }
  const m = /(\d+) passed, (\d+) failed/.exec(out);
  if (!m) throw new Error(`could not parse a tally out of sim.test.mjs:\n${out.slice(-800)}`);
  const failures = [];
  let inList = false;
  for (const line of out.split('\n')) {
    if (line.startsWith('Failed checks:')) { inList = true; continue; }
    if (!inList) continue;
    const f = /^ {2}- (.*)$/.exec(line);
    if (f) failures.push(f[1]);
  }
  return { pass: Number(m[1]), fail: Number(m[2]), failures };
}

if (args.selftest) {
  let pass = 0; let fail = 0;
  const t = (name, ok, detail = '') => { if (ok) { pass++; console.log(`  ok   ${name}`); } else { fail++; console.log(`  FAIL ${name} ${detail}`); } };

  // 1. THE PARSER SEES A GREEN TREE AS GREEN. The working tree is the control.
  const green = runSuite(ROOT);
  t(`the working tree parses (${green.pass} passed, ${green.fail} failed)`, green.pass > 0 && green.fail === green.failures.length,
    `${green.fail} vs ${green.failures.length} names`);

  // 2. 🚨 KNOWN-BAD: A RED TREE MUST BE READ AS RED. `sim.test.mjs` exits 1, so a harness
  //    that only reads `execFileSync`'s return value sees an exception and — if it caught
  //    it and moved on — would report ZERO failures for the reddest tree there is. That is
  //    the failure this row exists for, and it is planted rather than argued: a temporary
  //    worktree with a `castMs` the ratchet refuses.
  const dir = String(args.dir ?? '/tmp/fa-u6-gate');
  const ref = String(args.ref ?? 'HEAD');
  if (!existsSync(`${dir}/src/game/rules.ts`)) {
    execFileSync('git', ['-C', ROOT, 'worktree', 'add', '--detach', dir, ref], { stdio: 'inherit' });
    execFileSync('ln', ['-sfn', `${ROOT}/node_modules`, `${dir}/node_modules`]);
    execFileSync('ln', ['-sfn', `${ROOT}/reference`, `${dir}/reference`]);
  }
  execFileSync(process.execPath, [`${ROOT}/tools/tmp/u6_arm.mjs`, '--ref', ref, '--dir', dir, '--set', 'soup.Dump.castMs=600'],
    { stdio: ['ignore', 'ignore', 'inherit'] });
  const red = runSuite(dir);
  t(`a planted castMs is READ as red (${red.pass} passed, ${red.fail} failed)`, red.fail > 0 && red.failures.length === red.fail,
    JSON.stringify(red.failures));

  // 3. AND THE DIFF ATTRIBUTES IT. The planted edit must add rows, not merely coexist with
  //    the pre-existing ones.
  const base = runSuite(`${ROOT}`);
  const added = red.failures.filter((f) => !base.failures.includes(f));
  t(`the diff attributes ${added.length} NEW red rows to the plant`, added.length > 0, JSON.stringify(added));

  console.log(`\n${pass} passed, ${fail} failed`);
  process.exit(fail === 0 ? 0 : 1);
}

const DIR = String(args.dir ?? '/tmp/fa-u6-gate');
const REF = String(args.ref ?? 'HEAD');
if (!existsSync(`${DIR}/src/game/rules.ts`)) {
  execFileSync('git', ['-C', ROOT, 'worktree', 'add', '--detach', DIR, REF], { stdio: 'inherit' });
  execFileSync('ln', ['-sfn', `${ROOT}/node_modules`, `${DIR}/node_modules`]);
  execFileSync('ln', ['-sfn', `${ROOT}/reference`, `${DIR}/reference`]);
}

// BASELINE first, in the SAME worktree, so the comparison holds everything but the edit.
execFileSync(process.execPath, [`${ROOT}/tools/tmp/u6_arm.mjs`, '--ref', REF, '--dir', DIR], { stdio: ['ignore', 'ignore', 'inherit'] });
const before = runSuite(DIR);

execFileSync(process.execPath, [`${ROOT}/tools/tmp/u6_arm.mjs`, '--ref', REF, '--dir', DIR, ...args.set.flatMap((s) => ['--set', s])],
  { stdio: ['ignore', 'inherit', 'inherit'] });
const after = runSuite(DIR);

const added = after.failures.filter((f) => !before.failures.includes(f));
const silenced = before.failures.filter((f) => !after.failures.includes(f));

console.log(`\n${REF} baseline: ${before.pass} passed, ${before.fail} failed`);
console.log(`with ${args.set.join(' ')}: ${after.pass} passed, ${after.fail} failed\n`);
console.log(`ROWS THIS EDIT TURNS RED — ${added.length}:`);
for (const f of added) console.log(`  - ${f}`);
if (silenced.length) {
  console.log(`\n⚠️ ROWS THIS EDIT SILENCES — ${silenced.length} (a guard that stops firing is the dangerous direction):`);
  for (const f of silenced) console.log(`  - ${f}`);
}
process.exit(added.length === 0 ? 0 : 1);
