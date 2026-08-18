#!/usr/bin/env node
/**
 * KT_MATRIX — the §79 decision table: for each kit arm, BOTH counterplay measurements.
 *
 *   RADIAL   `lk_dodge`'s `open` row — the runner sprints straight away from the caster.
 *            This is §79's stated acceptance bar, and it is the WORST bearing (§78 measured
 *            radial escape at 601 ms against 134 ms for the cheapest angular one).
 *   BEARINGS `kt_bearing`'s sweep — how many of 36 run directions escape at all. This is
 *            "can the player dodge it", which is the question Uri asked; the radial row is
 *            "can the player dodge it while running in the single most expensive direction".
 *
 * 🚨 **REPORTING ONLY ONE OF THESE IS HOW THIS PASS OVER- OR UNDER-NERFS THE CHARACTER.**
 * A trim tuned to the radial row alone is the largest trim the roster can be asked for; a
 * trim tuned to the bearing count alone can pass while the natural player instinct — run
 * away — still never works. They are different quantities and this tool never merges them.
 *
 *   node tools/tmp/kt_matrix.mjs --selftest
 *   node tools/tmp/kt_matrix.mjs --dir /tmp/fa-kt-cand --ref 48c8166
 */
import { execFileSync } from 'node:child_process';
import { resolve } from 'node:path';
import { parseDodge } from './kt_sweep.mjs';

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

/** `N of 36 bearings escape` — parsed, never recomputed, so both tools agree by construction. */
export function parseBearings(out) {
  const m = /^\s+(\d+) of (\d+) bearings escape/m.exec(out);
  return m ? { escaped: Number(m[1]), total: Number(m[2]) } : null;
}

if (args.selftest) {
  let pass = 0; let fail = 0;
  const t = (n, ok, d = '') => { if (ok) { pass++; console.log(`  ok   ${n}`); } else { fail++; console.log(`  FAIL ${n} ${d}`); } };
  console.log('\n══ kt_matrix SELFTEST ══');
  t('parses a bearing summary', JSON.stringify(parseBearings('   23 of 36 bearings escape — cheapest 70째')) === '{"escaped":23,"total":36}');
  t('parses the all-fail form', JSON.stringify(parseBearings('   0 of 36 bearings escape — the wind-up is UNDODGEABLE AT EVERY BEARING')) === '{"escaped":0,"total":36}');
  // KNOWN-BAD: an unparseable summary must be null, so a row prints "??" rather than 0.
  // Returning 0 would read as "nothing escapes", which is a real and expected answer here
  // and would therefore never be questioned.
  t('KNOWN-BAD: an unreadable summary is null, NOT a plausible zero', parseBearings('bearings: none') === null);
  t('importing kt_sweep for parseDodge did not run its sweep', typeof parseDodge === 'function');
  console.log(`\n  ${pass}/${pass + fail} assertions passed\n`);
  process.exit(fail ? 1 : 0);
}

const DIR = String(args.dir ?? '/tmp/fa-kt-cand');
const REF = String(args.ref ?? 'HEAD');

/**
 * The arms worth a full matrix row. The power set of the three castless effects is already
 * swept by `kt_sweep`; what is added here is the set that separates "gives the player a
 * dodge" from "passes the radial bar", plus the two non-kit alternatives §77 permits so the
 * kit answer is never chosen against nothing.
 */
const ARMS = [
  ['baseline (shipped)', []],
  ['Glass stun -> none', ['--set', 'waterbottle.Glass.effect=null']],
  ['Glass stun -> slow', ['--set', "waterbottle.Glass.effect='slow'"]],
  ['Glass + Spray -> none', ['--set', 'waterbottle.Glass.effect=null', '--set', 'waterbottle.Spray.effect=null']],
  ['Glass + Cap -> none', ['--set', 'waterbottle.Glass.effect=null', '--set', 'waterbottle.Cap.effect=null']],
  ['ALL THREE -> none', ['--set', 'waterbottle.Glass.effect=null', '--set', 'waterbottle.Spray.effect=null', '--set', 'waterbottle.Cap.effect=null']],
  ['Glass -> none + Mega.range 84->70', ['--set', 'waterbottle.Glass.effect=null', '--set', 'waterbottle.Mega.range=70']],
  ['Glass -> none + Mega.range 84->58', ['--set', 'waterbottle.Glass.effect=null', '--set', 'waterbottle.Mega.range=58']],
  ['Glass+Spray -> none + Mega.range 70', ['--set', 'waterbottle.Glass.effect=null', '--set', 'waterbottle.Spray.effect=null', '--set', 'waterbottle.Mega.range=70']],
  ['Glass -> none + SLOW_DUR 2500->900', ['--set', 'waterbottle.Glass.effect=null', '--setconst', 'SLOW_DURATION_MS=900']],
  ['Glass -> none + SLOW_MULT .45->.6', ['--set', 'waterbottle.Glass.effect=null', '--setconst', 'SLOW_MOVE_MULTIPLIER=0.6']],
];

console.log(`\n══ KT_MATRIX ══  worktree ${DIR} @ ${REF}`);
console.log(`   RADIAL   = lk_dodge \`open\` row (§79's acceptance bar, and the WORST bearing)`);
console.log(`   BEARINGS = of 36 run directions, how many escape at all\n`);
console.log(`   ${'arm'.padEnd(36)}${'radial sep'.padStart(11)}${'radial'.padStart(10)}${'bearings'.padStart(11)}   kit after the trim`);

for (const [label, flags] of ARMS) {
  try {
    execFileSync(process.execPath, [`${ROOT}/tools/tmp/kt_arm.mjs`, '--dir', DIR, '--ref', REF, ...flags],
      { encoding: 'utf8', cwd: ROOT, stdio: ['ignore', 'pipe', 'inherit'] });
  } catch {
    console.log(`   ${label.padEnd(36)}   STAGING FAILED — row abandoned`);
    continue;
  }
  const dodge = parseDodge(execFileSync(process.execPath, [`${ROOT}/tools/tmp/lk_dodge.mjs`, '--sim', `${DIR}/src/game`],
    { encoding: 'utf8', cwd: ROOT, stdio: ['ignore', 'pipe', 'inherit'] }));
  const bOut = execFileSync(process.execPath, [`${ROOT}/tools/tmp/kt_bearing.mjs`, '--sim', `${DIR}/src/game`],
    { encoding: 'utf8', cwd: ROOT, stdio: ['ignore', 'pipe', 'inherit'] });
  const b = parseBearings(bOut);
  const kit = /^\s+kit: (.*)$/m.exec(bOut)?.[1] ?? '?';
  const o = dodge.open;
  if (!o) { console.log(`   ${label.padEnd(36)}   NO RADIAL ROW`); continue; }
  console.log(`   ${label.padEnd(36)}${o.sep.toFixed(2).padStart(11)}${(o.escaped ? 'ESCAPED' : 'HIT').padStart(10)}${(b ? `${b.escaped}/${b.total}` : '??').padStart(11)}   ${kit}`);
}
console.log('');
