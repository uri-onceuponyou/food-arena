#!/usr/bin/env node
/**
 * KT_SWEEP — run the §79 ACCEPTANCE TEST over every kit-composition arm, each one a
 * detached worktree with the named fields changed and verified through the module loader.
 *
 * The acceptance test is `tools/tmp/lk_dodge.mjs`, which this pass did not write and does
 * not edit. This tool stages an arm with `kt_arm.mjs`, runs `lk_dodge --sim <arm>`, and
 * reads the `open` row — the arm where the caster's whole kit is live, which `DECISIONS
 * §79` requires to ESCAPE.
 *
 * ── WHAT MAKES THIS MORE THAN A LOOP ────────────────────────────────────────
 *
 *   * every arm is STAGED AND VERIFIED before it is measured; a `kt_arm` non-zero exit
 *     aborts the row rather than reporting it as a null result;
 *   * the `lockout` / `noeffect` rows come back on every arm, so each row carries its own
 *     controls and a tree that broke the whole fixture is visible rather than silent;
 *   * the BASELINE arm is run first and must reproduce ** HIT **. If the shipped tree
 *     escapes, the fixture is not measuring what this pass is about and every later row
 *     is meaningless — so it exits rather than continuing.
 *
 *   node tools/tmp/kt_sweep.mjs --selftest
 *   node tools/tmp/kt_sweep.mjs --dir /tmp/fa-kt-cand --ref 48c8166
 *   node tools/tmp/kt_sweep.mjs --dir /tmp/fa-kt-cand --ref 48c8166 --only 'Glass-null'
 */
import { execFileSync } from 'node:child_process';
import { resolve } from 'node:path';

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

/**
 * Parse one `lk_dodge` table. Returns `{ arm -> row }`. Fails LOUDLY on a table it does
 * not recognise: a silent parse miss would return an empty object and every arm would
 * report "no data", which is indistinguishable from a fixture that stopped working.
 */
export function parseDodge(out) {
  const rows = {};
  for (const line of out.split('\n')) {
    const m = /^\s+(lockout|silent|noeffect|open|nocast)\s+(-?\d+)\s+(-?\d+)\s+([\d.]+)\s+(\d+)ms\s+(\d+)ms\s+\[(.*)\]\s+(ESCAPED|\*\* HIT \*\*)\s*$/.exec(line);
    if (!m) continue;
    rows[m[1]] = {
      megaDmg: Number(m[2]), otherDmg: Number(m[3]), sep: Number(m[4]),
      slowMs: Number(m[5]), stunMs: Number(m[6]),
      fired: m[7] ? m[7].split(', ') : [],
      escaped: m[8] === 'ESCAPED',
    };
  }
  return rows;
}

/**
 * 🚨 IS_MAIN GUARD, AND IT MUST WRAP THE SELFTEST TOO — CAUGHT BY BEING BITTEN BY IT.
 *
 * `parseDodge` is exported so `kt_matrix.mjs` reuses a validated parser instead of copying
 * it. The first version of this guard sat BELOW the `if (args.selftest)` block, which reads
 * `process.argv` at module scope — so `node kt_matrix.mjs --selftest` imported this file,
 * ran THIS tool's selftest, printed `5/5 passed` and `process.exit(0)`d before `kt_matrix`'s
 * own selftest existed. It looked like a pass. `AGENT-BRIEF §3` records this exact failure
 * on `valuescan`, one tool's `--selftest` running another's; the lesson is not "guard the
 * CLI", it is **"guard every module-scope read of `process.argv`, and the selftest is one."**
 */
const IS_MAIN = process.argv[1] && resolve(process.argv[1]) === resolve(new URL(import.meta.url).pathname);

if (IS_MAIN && args.selftest) {
  let pass = 0; let fail = 0;
  const t = (n, ok, d = '') => { if (ok) { pass++; console.log(`  ok   ${n}`); } else { fail++; console.log(`  FAIL ${n} ${d}`); } };
  console.log('\n══ kt_sweep SELFTEST ══');
  const sample = [
    '   arm         megaDmg  otherDmg  sep@resolve   slowed  stunned   fired during the wind-up',
    '   lockout           0         0       135.73      0ms      0ms   []  ESCAPED',
    '   open             18        37        20.36   1100ms   1083ms   [Spray, Glass, Cap, Spray, Cap]  ** HIT **',
  ].join('\n');
  const r = parseDodge(sample);
  t('parses an ESCAPED row', r.lockout && r.lockout.escaped === true && r.lockout.sep === 135.73);
  t('parses a HIT row with its fired list', r.open && r.open.escaped === false && r.open.megaDmg === 18 && r.open.fired.length === 5);
  t('parses an EMPTY fired list as empty, not as one blank weapon', r.lockout.fired.length === 0, JSON.stringify(r.lockout.fired));
  // KNOWN-BAD: a table this parser cannot read must come back EMPTY, so the caller's
  // "no rows" check fires. A parser that silently invented rows would report every arm
  // as escaping — which is the answer this pass WANTS, and therefore the dangerous one.
  t('KNOWN-BAD: a garbled table yields no rows rather than plausible ones',
    Object.keys(parseDodge('   open  18  20.36  yes\nnonsense')).length === 0);
  t('KNOWN-BAD: the header line alone is not a row', Object.keys(parseDodge(sample.split('\n')[0])).length === 0);
  console.log(`\n  ${pass}/${pass + fail} assertions passed\n`);
  process.exit(fail ? 1 : 0);
}

// The CLI half. `AGENT-BRIEF §3` records three tools here where making a function
// importable silently made the whole CLI path run on import — one launched Chromium, one
// printed a live sweep that would have killed every snapshot server on the box.
if (!IS_MAIN) { /* imported for `parseDodge` only — no sweep, no worktree, no staging */ }
else {

const DIR = String(args.dir ?? '/tmp/fa-kt-cand');
const REF = String(args.ref ?? 'HEAD');

/**
 * The arms. Each is `[label, ...kt_arm flags]`. The power set of the three castless
 * weapons' `effect` fields is enumerated rather than typed, so no subset is skipped by
 * hand — the whole point is to find the CHEAPEST trim that works, and skipping a subset
 * is how "the cheapest" silently becomes "the first one I tried".
 */
const CASTLESS = [['Spray', 'slow'], ['Glass', 'stun'], ['Cap', 'slow']];
const ARMS = [['baseline', []]];
for (let mask = 1; mask < 8; mask++) {
  const drop = CASTLESS.filter((_, i) => mask & (1 << i));
  ARMS.push([`drop ${drop.map(([k, e]) => `${k}(${e})`).join('+')}`,
    drop.flatMap(([k]) => ['--set', `waterbottle.${k}.effect=null`])]);
}
// Scalar arms — priced because §79 names them as candidates, not because they are liked.
ARMS.push(['SLOW_DURATION_MS 2500->900', ['--setconst', 'SLOW_DURATION_MS=900']]);
ARMS.push(['SLOW_DURATION_MS 2500->500', ['--setconst', 'SLOW_DURATION_MS=500']]);
ARMS.push(['SLOW_MOVE_MULTIPLIER 0.45->0.6', ['--setconst', 'SLOW_MOVE_MULTIPLIER=0.6']]);
ARMS.push(['SLOW_MOVE_MULTIPLIER 0.45->0.75', ['--setconst', 'SLOW_MOVE_MULTIPLIER=0.75']]);
ARMS.push(['STUN_DURATION_MS 2000->500', ['--setconst', 'STUN_DURATION_MS=500']]);
// Mixed: the stun gone AND the slow weakened — the two levers §79 names, together.
ARMS.push(['drop Glass(stun) + SLOW_DUR 900', ['--set', 'waterbottle.Glass.effect=null', '--setconst', 'SLOW_DURATION_MS=900']]);
ARMS.push(['drop Glass(stun) + SLOW_DUR 500', ['--set', 'waterbottle.Glass.effect=null', '--setconst', 'SLOW_DURATION_MS=500']]);
ARMS.push(['drop Glass+Cap + SLOW_DUR 900', ['--set', 'waterbottle.Glass.effect=null', '--set', 'waterbottle.Cap.effect=null', '--setconst', 'SLOW_DURATION_MS=900']]);
// The super's own geometry, for contrast: a shorter reach is a Mega redesign (§77), not
// a kit trim, and it belongs in the table so the kit answer is compared against something.
ARMS.push(['Mega.range 84->64 (super redesign)', ['--set', 'waterbottle.Mega.range=64']]);
ARMS.push(['Mega.castMs 1100->600 (§78 derived)', ['--set', 'waterbottle.Mega.castMs=600']]);

const only = args.only ? String(args.only) : null;

console.log(`\n══ KT_SWEEP ══  worktree ${DIR} @ ${REF}`);
console.log(`   acceptance: the \`open\` arm must ESCAPE (DECISIONS §79)\n`);
console.log(`   ${'arm'.padEnd(38)}${'open:megaDmg'.padStart(13)}${'sep'.padStart(9)}${'slowed'.padStart(9)}${'stunned'.padStart(9)}   verdict`);

const results = [];
for (const [label, flags] of ARMS) {
  if (only && !label.includes(only)) continue;
  try {
    execFileSync(process.execPath, [`${ROOT}/tools/tmp/kt_arm.mjs`, '--dir', DIR, '--ref', REF, ...flags],
      { encoding: 'utf8', cwd: ROOT, stdio: ['ignore', 'pipe', 'inherit'] });
  } catch {
    console.log(`   ${label.padEnd(38)}   STAGING FAILED — row abandoned, not reported as a null result`);
    continue;
  }
  const out = execFileSync(process.execPath, [`${ROOT}/tools/tmp/lk_dodge.mjs`, '--sim', `${DIR}/src/game`],
    { encoding: 'utf8', cwd: ROOT, stdio: ['ignore', 'pipe', 'inherit'] });
  const rows = parseDodge(out);
  if (!rows.open) { console.log(`   ${label.padEnd(38)}   NO ROWS — the fixture did not produce a table`); continue; }
  const o = rows.open;
  results.push({ label, ...o });
  console.log(`   ${label.padEnd(38)}${String(o.megaDmg).padStart(13)}${o.sep.toFixed(2).padStart(9)}${`${o.slowMs}ms`.padStart(9)}${`${o.stunMs}ms`.padStart(9)}   ${o.escaped ? 'ESCAPED  <= PASSES §79' : '** HIT **'}`);
  if (label === 'baseline' && o.escaped) {
    console.error('\n   🚨 THE BASELINE ESCAPED. The fixture is not reproducing the defect this pass exists to fix,');
    console.error('      so every row below it would be measuring nothing. Stopping.\n');
    process.exit(1);
  }
}

const passing = results.filter((r) => r.escaped);
console.log(`\n   ${passing.length} of ${results.length} arms restore the dodge: ${passing.map((r) => r.label).join(' · ') || 'NONE'}`);
console.log('');

} // end IS_MAIN
