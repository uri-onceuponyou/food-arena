#!/usr/bin/env node
/**
 * DG_GRID — sweep `DECISIONS §80`'s THREE LEVERS and report, per cell, HOW MANY OF 36
 * BEARINGS ESCAPE the super. The output is a REGION, never a verdict.
 *
 * ── WHAT THIS IS AND WHY IT IS NOT A FOURTH ARM STAGER ──────────────────────
 *
 * It stages nothing and measures nothing itself. It COMPOSES the two instruments that
 * already exist and are already validated against known-bad inputs:
 *
 *   `kt_arm.mjs`      stages ONE arm into a detached worktree and reads the patched
 *                     fields back THROUGH THE MODULE LOADER. Its known-bad is a
 *                     silently-missed `effect` patch, which `u6_arm` would certify green.
 *   `kt_bearing.mjs`  runs `lk_dodge`'s fixture at all 36 run bearings. Its own selftest
 *                     requires bearing 0 to reproduce `lk_dodge`'s `open` row to the digit.
 *
 * The value this adds is the CROSS-CHECK BETWEEN THEM, which neither can perform alone:
 *
 * 🚨 **NEITHER TOOL CAN TELL YOU THAT THE TREE `kt_bearing` MEASURED IS THE TREE
 * `kt_arm` STAGED.** `kt_arm` proves the patch landed in `--dir`. `kt_bearing` reports a
 * number from `--sim`. Pass a stale `--sim`, or a `--sim` that silently falls back to the
 * repo, and **every cell returns the baseline** — which reads exactly like *"the lever
 * does nothing"*, `AGENT-BRIEF §3`'s most dangerous failure, because a null result is a
 * normal outcome in this search and nobody re-checks it. So every cell here asserts:
 *
 *   1. **FIELD POINTING** — `kt_bearing`'s own header prints the cast weapon's `castMs`,
 *      `range` and `cone`. Those three must equal what `kt_arm --show` reads back out of
 *      the staged worktree. A mis-aimed `--sim` fails this the moment a cell moves any of
 *      them, which is why the grid ALWAYS carries radius cells even when the axis under
 *      test is a duration.
 *   2. **CONST POINTING, BEHAVIOURALLY** — a constant is not in that header, so it gets a
 *      stronger check than a string compare: `combat.ts`'s no-refresh rule bounds one
 *      unbroken application to exactly `STUN_DURATION_MS` (`rules.ts`, DEVIATION #5), so
 *      the `stunned` column of the sweep MUST NOT EXCEED the staged constant. A
 *      `STUN_DURATION_MS=300` arm measured against an unpatched tree reports 1083 ms of
 *      stun and is caught. This asserts the SIM BEHAVED as the arm asked, not merely that
 *      a literal was rewritten.
 *   3. **NON-VACUITY** — a cell whose staging failed is an ERROR, never a number. `[]` and
 *      `null` do not become "0 of 36".
 *
 * ⚠️ **THE FIXTURE IS `kt_bearing`'s AND IT IS DELIBERATELY UNCHANGED**, so every number
 * below is directly comparable to the ones already recorded in `rules.ts:waterbottle` and
 * `DECISIONS §79/§80` (baseline 0 of 36 · drop-the-stun 23 of 36 · drop-all-three 36 of 36).
 * A different arena or separation would make this grid a second, incomparable corpus.
 * Separation and runner sensitivity is a SEPARATE question — see `dg_fix.mjs`.
 *
 *   node tools/tmp/dg_grid.mjs --selftest
 *   node tools/tmp/dg_grid.mjs --dir /private/tmp/fa-dg-a --ref a756cd0 --plan stun
 *   node tools/tmp/dg_grid.mjs --dir /private/tmp/fa-dg-a --cell 'STUN_DURATION_MS=700;waterbottle.Mega.range=70'
 */
import { execFileSync } from 'node:child_process';
import { existsSync } from 'node:fs';
import { resolve } from 'node:path';

const ROOT = resolve(new URL('../..', import.meta.url).pathname);
const TICK = 16.667;

const args = (() => {
  const o = { cell: [], axis: [] };
  for (let i = 2; i < process.argv.length; i++) {
    const a = process.argv[i];
    if (!a.startsWith('--')) continue;
    const n = process.argv[i + 1];
    const v = n === undefined || n.startsWith('--') ? true : (i++, n);
    if (a === '--cell') o.cell.push(v);
    else if (a === '--axis') o.axis.push(v);
    else o[a.slice(2)] = v;
  }
  return o;
})();

/**
 * Cartesian product of `--axis 'NAME=v1,v2,…'`. A value equal to the shipped default must
 * be written as the empty string, because `kt_arm` refuses a textually no-op patch — that
 * refusal is its guard working and is not routed around here.
 */
export function crossAxes(specs) {
  let cells = [[]];
  for (const spec of specs) {
    const m = /^([A-Za-z_0-9.]+)=(.*)$/.exec(String(spec));
    if (!m) throw new Error(`--axis '${spec}' is not NAME=v1,v2,...`);
    const vals = m[2].split(',');
    if (vals.length === 0) throw new Error(`--axis '${spec}' has no values`);
    cells = cells.flatMap((c) => vals.map((v) => (v === '' ? c : [...c, `${m[1]}=${v}`])));
  }
  return cells.map((c) => c.join(';'));
}

/** A cell spec is `;`-separated assignments. `A.B.c=v` is a weapon field; `NAME=v` a const. */
export function parseCell(spec) {
  const set = []; const setconst = [];
  for (const part of String(spec).split(';').map((s) => s.trim()).filter(Boolean)) {
    if (/^[a-z]+\.[A-Za-z]+\.[A-Za-z]+=/.test(part)) set.push(part);
    else if (/^[A-Z_0-9]+=/.test(part)) setconst.push(part);
    else throw new Error(`cell '${spec}': '${part}' is neither <char>.<Weapon>.<field>= nor CONST=`);
  }
  return { set, setconst };
}

/**
 * Parse `kt_bearing --all`. Returns the header's staged-field readback, every row, and the
 * coverage. Throws on anything it cannot read rather than returning a partial answer — a
 * regex that silently matched 0 rows would report `0 of 0` as a clean escape-free sweep.
 */
export function parseBearing(out) {
  const txt = out.replace(/[^\x00-\x7F]/g, '~');
  const h = /(\w+)\.(\w+) castMs (\d+) . range ([\d.]+) . cone ([\d.]+) deg . runner (\w+) @ ([\d.]+) wu\/s/.exec(txt);
  if (!h) throw new Error('kt_bearing printed no parsable header');
  const rows = [];
  const re = /^\s+(\d+)~\s+([\d.]+)\s+([\d.]+)~\s+(\d+)ms\s+(\d+)ms\s+(ESCAPED|\*\* HIT \*\*)\s*$/gm;
  let m;
  while ((m = re.exec(txt)) !== null) {
    rows.push({ deg: +m[1], sep: +m[2], offAxisDeg: +m[3], slowMs: +m[4], stunMs: +m[5], escaped: m[6] === 'ESCAPED' });
  }
  const f = /(\d+) of (\d+) bearings escape/.exec(txt);
  if (!f) throw new Error('kt_bearing printed no coverage footer');
  if (rows.length !== Number(f[2])) throw new Error(`parsed ${rows.length} rows but the footer says ${f[2]} — the row regex has drifted`);
  const esc = rows.filter((r) => r.escaped).length;
  if (esc !== Number(f[1])) throw new Error(`parsed ${esc} escaping rows but the footer says ${f[1]}`);
  return {
    caster: h[1], weapon: h[2], castMs: +h[3], range: +h[4], cone: +h[5], runner: h[6], runnerSpeed: +h[7],
    rows, escaped: esc, total: rows.length,
  };
}

/**
 * The three pointing checks, isolated so `--selftest` can drive them on synthetic inputs.
 * Returns a list of complaints; empty means the measurement describes the staged tree.
 */
export function pointingFaults(bearing, fields, weaponKey) {
  const bad = [];
  const rec = fields.weapons[weaponKey];
  if (!rec) { bad.push(`POINTING: '${weaponKey}' is not in the staged roster`); return bad; }
  for (const f of ['castMs', 'range', 'cone']) {
    if (bearing[f] !== rec[f]) bad.push(`POINTING: kt_bearing read ${f}=${bearing[f]} but the staged tree holds ${rec[f]} — the sweep measured a DIFFERENT TREE`);
  }
  if (bearing.rows.length === 0) { bad.push('VACUOUS: zero bearing rows'); return bad; }
  const maxStun = Math.max(...bearing.rows.map((r) => r.stunMs));
  const maxSlow = Math.max(...bearing.rows.map((r) => r.slowMs));
  const W = bearing.castMs + TICK;
  for (const [label, dur, grace, seen] of [
    ['STUN_DURATION_MS', fields.consts.STUN_DURATION_MS, fields.consts.STUN_GRACE_MS, maxStun],
    ['SLOW_DURATION_MS', fields.consts.SLOW_DURATION_MS, fields.consts.SLOW_GRACE_MS, maxSlow],
  ]) {
    if (seen > ccBound(dur, grace, W) + TICK) {
      bad.push(`POINTING: measured ${seen} ms of ${label.slice(0, 4).toLowerCase()} inside a ${W.toFixed(0)} ms cast against a staged ${label} of ${dur} (bound ${ccBound(dur, grace, W).toFixed(0)}) — the sim did not run the staged constant`);
    }
  }
  return bad;
}

/**
 * The most CC time one fighter can accumulate inside a window of `W` ms, derived from the
 * sim's own re-application rule rather than typed.
 *
 * ⚠️ **THE FIRST VERSION OF THIS WAS `seen <= duration` AND IT WAS WRONG — IT FIRED ON A
 * CORRECT MEASUREMENT.** `rules.ts` DEVIATION #5 bounds *one unbroken* application to the
 * duration, and `kt_bearing`'s `slowed`/`stunned` columns are **tick TOTALS, not longest
 * runs**. At `SLOW_DURATION_MS=400` the slow expires at 400, the 500 ms grace opens at 900,
 * and a second Spray/Cap lands before the 1100 ms cast resolves: 567 ms measured against a
 * "bound" of 400. That is the sim obeying its rule, and the guard called it a staging
 * failure — a guard that has not been shown to PASS on a correct input is as dangerous as
 * one never shown to fail.
 *
 * So the real bound is `applications × duration`, with the application count set by the
 * no-refresh + grace cycle. Diminishing returns (`STATUS_DR_SCALES`) only ever SHORTENS a
 * repeat, so ignoring it keeps this conservative in the safe direction.
 *
 * It stays non-vacuous where it matters: any duration with `duration + grace < W` bounds
 * the total strictly below `W`, so an arm measured against an unpatched tree — which
 * reports the full cast window — is still caught.
 */
export function ccBound(duration, grace, W) {
  if (duration <= 0) return 0;
  return (Math.floor(W / (duration + grace)) + 1) * duration;
}

const DIR = String(args.dir ?? '/private/tmp/fa-dg-a');
const REF = String(args.ref ?? 'a756cd0');

function stage(cell) {
  const { set, setconst } = parseCell(cell);
  const a = ['--dir', DIR, '--ref', REF];
  for (const s of set) a.push('--set', s);
  for (const s of setconst) a.push('--setconst', s);
  execFileSync(process.execPath, [`${ROOT}/tools/tmp/kt_arm.mjs`, ...a], { cwd: ROOT, stdio: ['ignore', 'ignore', 'inherit'] });
}

const showFields = (dir) => JSON.parse(execFileSync(process.execPath,
  [`${ROOT}/tools/tmp/kt_arm.mjs`, '--dir', dir, '--show'], { cwd: ROOT, encoding: 'utf8', stdio: ['ignore', 'pipe', 'inherit'] }));

const sweep = (dir) => parseBearing(execFileSync(process.execPath,
  [`${ROOT}/tools/tmp/kt_bearing.mjs`, '--sim', `${dir}/src/game`, '--all'], { cwd: ROOT, encoding: 'utf8', stdio: ['ignore', 'pipe', 'inherit'] }));

/** Measure ONE cell end to end. Throws — a cell never degrades into a plausible number. */
export function measure(cell) {
  stage(cell);
  const fields = showFields(DIR);
  const b = sweep(DIR);
  const faults = pointingFaults(b, fields, `${b.caster}.${b.weapon}`);
  if (faults.length) throw new Error(`cell '${cell}':\n    ${faults.join('\n    ')}`);
  const r0 = b.rows.find((r) => r.deg === 0);
  return {
    cell, escaped: b.escaped, total: b.total,
    range: b.range, castMs: b.castMs,
    stun: fields.consts.STUN_DURATION_MS, slow: fields.consts.SLOW_DURATION_MS,
    slowMul: fields.consts.SLOW_MOVE_MULTIPLIER,
    radialSep: r0.sep, radialEscaped: r0.escaped,
    maxStunMs: Math.max(...b.rows.map((x) => x.stunMs)),
    maxSlowMs: Math.max(...b.rows.map((x) => x.slowMs)),
    maxSep: Math.max(...b.rows.map((x) => x.sep)),
    cooldown: fields.weapons[`${b.caster}.${b.weapon}`].cooldown,
  };
}

// ── PLANS ───────────────────────────────────────────────────────────────────
// Ranges are DERIVED, not picked. See the header of each.
const PLANS = {
  // Lever 1 alone. Floor 42 = REACH.meleeQuick − 16; above 84 is the shipped rung.
  radius: [84, 76, 70, 64, 58, 50, 42].map((v) => `waterbottle.Mega.range=${v}`),
  // Lever 3 alone. 2000 shipped down to 0 (= the effect deleted), through 1100 — the
  // shortest stun-applying cooldown in the roster, which `rules.ts:791` names as the
  // largest value that makes a SOLO lock impossible.
  // ⚠️ The shipped value is the EMPTY cell, not `STUN_DURATION_MS=2000`: `kt_arm` refuses
  //    a patch that is textually a no-op, which is its guard working, not a limitation.
  stun: ['', ...[1600, 1300, 1100, 900, 700, 500, 300, 150, 0].map((v) => `STUN_DURATION_MS=${v}`)],
  // Lever 3's other half. 800 is `rules.ts:791`'s named solo-lock bound for slow.
  slow: ['', ...[2000, 1500, 1100, 800, 600, 400, 200, 0].map((v) => `SLOW_DURATION_MS=${v}`)],
  // Both durations together, held at the shipped 2000/2500 ratio.
  both: ['', ...[[1600, 2000], [1300, 1600], [1100, 1400], [900, 1100], [700, 900], [500, 600], [300, 400], [150, 200], [0, 0]]
    .map(([s, w]) => `STUN_DURATION_MS=${s};SLOW_DURATION_MS=${w}`)],

  /**
   * 🔴 THE HEADLINE, IN ONE COMMAND — `STUN_DURATION_MS` IS A GATE, AND EVERY OTHER LEVER
   * IS INERT BEHIND IT. Every row below holds the shipped 2000 ms stun and moves ONE of
   * the other four candidate levers to a value far past anything shippable. All of them
   * report 0 of 36, because a stunned runner never leaves 20.36 wu and every geometry
   * lever is measured against that separation:
   *
   *   radius   84 -> 34   (below `REACH.meleeQuick` 58, i.e. shorter than a body-check)
   *   cone    100 -> 15   (a 15 degree wedge, no longer a slam)
   *   slow    2500 -> 0   (the slow effect deleted outright)
   *   castMs  1100 -> 2200 and 600 (both ends of §78's argument)
   *   cooldown 3500 -> 10000 (`§80`'s POWER lever, which it says is not a dodge lever)
   *
   * The last two rows are the NON-VACUITY control: the same grid with the stun moved
   * DOES open bearings, so the zeros above are a fact about the stun and not about the
   * fixture being unable to report anything else.
   */
  gate: ['', 'waterbottle.Mega.range=34', 'waterbottle.Mega.cone=15', 'SLOW_DURATION_MS=0',
    'waterbottle.Mega.castMs=2200', 'waterbottle.Mega.castMs=600', 'waterbottle.Mega.cooldown=10000',
    'waterbottle.Glass.cooldown=5000', 'STATUS_DR_WINDOW_MS=0',
    'STUN_DURATION_MS=700', 'STUN_DURATION_MS=700;waterbottle.Mega.castMs=2200'],
};

if (args.selftest) {
  let pass = 0; let fail = 0;
  const t = (n, c, d = '') => { if (c) { pass++; console.log(`  ok   ${n}${d ? `  ${d}` : ''}`); } else { fail++; console.log(`  FAIL ${n}  ${d}`); } };
  console.log(`\n== dg_grid SELFTEST ==  dir ${DIR} @ ${REF}`);
  if (!existsSync(`${DIR}/src/game/rules.ts`)) { console.error(`no worktree at ${DIR}`); process.exit(1); }

  // 0. The axis product, including the empty-string convention for "leave it shipped".
  t('--axis takes a cartesian product and the empty value means SHIPPED',
    crossAxes(['A.B.c=1,2', 'D=,9']).join(' | ') === 'A.B.c=1 | A.B.c=1;D=9 | A.B.c=2 | A.B.c=2;D=9',
    crossAxes(['A.B.c=1,2', 'D=,9']).join(' | '));

  // 1. The parser must refuse a truncated report rather than reading it as a clean sweep.
  let threw = false;
  try { parseBearing('   waterbottle.Mega castMs 1100 - range 84 - cone 100 deg - runner egg @ 105.60 wu/s\n\n   0 of 36 bearings escape\n'); } catch { threw = true; }
  t('KNOWN-BAD: 0 parsed rows against a footer of 36 THROWS, it does not report 0 of 36', threw);

  // 2. 🚨 THE POINTING KNOWN-BAD, ON A CONST. This is the failure the whole tool exists
  //    for: an arm asks for a 300 ms stun, the sweep is pointed at an unpatched tree, and
  //    every cell returns the baseline. Synthesised on the real shapes.
  const G = { STUN_GRACE_MS: 500, SLOW_GRACE_MS: 500 };
  const shipped = { weapons: { 'waterbottle.Mega': { castMs: 1100, range: 84, cone: 100, cooldown: 3500 } }, consts: { ...G, STUN_DURATION_MS: 2000, SLOW_DURATION_MS: 2500 } };
  const asked300 = { weapons: shipped.weapons, consts: { ...G, STUN_DURATION_MS: 300, SLOW_DURATION_MS: 2500 } };
  const shippedSweep = { caster: 'waterbottle', weapon: 'Mega', castMs: 1100, range: 84, cone: 100, rows: [{ deg: 0, sep: 20.36, stunMs: 1083, slowMs: 1100, escaped: false }], escaped: 0, total: 1 };
  t('KNOWN-BAD: a 300 ms stun arm measured on an UNPATCHED tree is caught by the stun bound',
    pointingFaults(shippedSweep, asked300, 'waterbottle.Mega').length > 0,
    pointingFaults(shippedSweep, asked300, 'waterbottle.Mega')[0]?.slice(0, 72));
  t('...and the SAME sweep against the tree it really describes is clean',
    pointingFaults(shippedSweep, shipped, 'waterbottle.Mega').length === 0);

  // 3. THE POINTING KNOWN-BAD, ON A FIELD.
  const asked58 = { weapons: { 'waterbottle.Mega': { castMs: 1100, range: 58, cone: 100, cooldown: 3500 } }, consts: shipped.consts };
  t('KNOWN-BAD: a range 58 arm measured on an 84 tree is caught by the header cross-check',
    pointingFaults(shippedSweep, asked58, 'waterbottle.Mega').some((s) => s.includes('range')));

  // 4. NON-VACUOUS: the bound must be able to PASS as well as fail, or row 2 is a
  //    tautology that would fire on a correct measurement too.
  const real300 = { ...shippedSweep, rows: [{ deg: 0, sep: 44.0, stunMs: 300, slowMs: 1100, escaped: false }] };
  t('NON-VACUOUS: a correctly-staged 300 ms stun measurement passes the same bound',
    pointingFaults(real300, asked300, 'waterbottle.Mega').length === 0);

  // 4b. 🚨 THE FALSE POSITIVE THIS BOUND ALREADY PRODUCED ONCE, PINNED. The first version
  //     asserted `seen <= duration` and REFUSED a correct `SLOW_DURATION_MS=400` cell that
  //     measured 567 ms — the slow expired at 400, the 500 ms grace opened at 900, and a
  //     second Spray landed before the 1100 ms cast resolved. A guard never shown to PASS
  //     on a correct input is as dangerous as one never shown to fail.
  const asked400 = { weapons: shipped.weapons, consts: { ...G, STUN_DURATION_MS: 2000, SLOW_DURATION_MS: 400 } };
  const real400 = { ...shippedSweep, rows: [{ deg: 0, sep: 20.36, stunMs: 1083, slowMs: 567, escaped: false }] };
  t('KNOWN-GOOD: two applications of a 400 ms slow inside one cast (567 ms) is LEGAL and passes',
    pointingFaults(real400, asked400, 'waterbottle.Mega').length === 0, `bound ${ccBound(400, 500, 1116.667).toFixed(0)} ms`);
  t('...and the same 567 ms against a staged 200 ms slow is still CAUGHT',
    pointingFaults(real400, { weapons: shipped.weapons, consts: { ...G, STUN_DURATION_MS: 2000, SLOW_DURATION_MS: 200 } }, 'waterbottle.Mega').some((s) => s.includes('SLOW')),
    `bound ${ccBound(200, 500, 1116.667).toFixed(0)} ms`);
  t('the bound is DERIVED, not typed: halving the grace admits more applications',
    ccBound(400, 100, 1116.667) > ccBound(400, 500, 1116.667), `grace 100 -> ${ccBound(400, 100, 1116.667)} ms, grace 500 -> ${ccBound(400, 500, 1116.667)} ms`);

  // 5. END TO END, against the two numbers already published for this fixture. If either
  //    moves, this grid is not the corpus `rules.ts:waterbottle` and §79 recorded.
  const base = measure('');
  t('the shipped tree reproduces the RECORDED baseline: 0 of 36', base.escaped === 0 && base.total === 36, `${base.escaped} of ${base.total}, radial sep ${base.radialSep}`);
  const noCC = measure('STUN_DURATION_MS=0;SLOW_DURATION_MS=0');
  t('NON-VACUOUS: the grid can express a POSITIVE — all CC off escapes at every bearing',
    noCC.escaped === 36, `${noCC.escaped} of 36, radial sep ${noCC.radialSep.toFixed(2)}`);
  t('...and that arm really ran with no CC (stun and slow columns both 0 ms)',
    noCC.maxStunMs === 0 && noCC.maxSlowMs === 0, `stun ${noCC.maxStunMs} slow ${noCC.maxSlowMs}`);

  // 6. THE POINTING CHECK, LIVE — not synthesised. Stage a radius the baseline cannot
  //    wear and require the reported header to follow it.
  const r42 = measure('waterbottle.Mega.range=42');
  t('LIVE POINTING: a staged radius is what kt_bearing reports measuring', r42.range === 42, `header range ${r42.range}`);
  t('...and the arm is restored between cells (a re-measured baseline is 84 again)', measure('').range === 84);

  console.log(`\n  ${pass}/${pass + fail} assertions passed\n`);
  process.exit(fail ? 1 : 0);
}

if (!existsSync(`${DIR}/src/game/rules.ts`)) { console.error(`no worktree at ${DIR}`); process.exit(1); }

const cells = args.plan ? (PLANS[String(args.plan)] ?? (() => { throw new Error(`no plan '${args.plan}' — have ${Object.keys(PLANS).join(', ')}`); })())
  : args.axis.length ? crossAxes(args.axis)
  : args.cell.length ? args.cell : [''];

console.log(`\n== DG_GRID ==  ${DIR} @ ${REF} - ${cells.length} cells - fixture: kt_bearing (sep 20, runner = slowest)`);
console.log(`   ${'cell'.padEnd(52)}${'stun'.padStart(6)}${'slow'.padStart(6)}${'rad'.padStart(5)}${'cd'.padStart(6)}${'stunMs'.padStart(8)}${'slowMs'.padStart(8)}${'radSep'.padStart(9)}   bearings`);
const out = [];
for (const c of cells) {
  const r = measure(c);
  out.push(r);
  const bar = '#'.repeat(Math.round((r.escaped / r.total) * 24)).padEnd(24, '.');
  console.log(`   ${(c || '(shipped baseline)').padEnd(52)}${String(r.stun).padStart(6)}${String(r.slow).padStart(6)}${String(r.range).padStart(5)}${String(r.cooldown).padStart(6)}${String(r.maxStunMs).padStart(8)}${String(r.maxSlowMs).padStart(8)}${r.radialSep.toFixed(2).padStart(9)}   ${String(r.escaped).padStart(2)}/${r.total} ${bar}${r.radialEscaped ? ' RADIAL' : ''}`);
}
// With exactly two axes the table above is a matrix; print it as one. `-` marks a cell
// where no bearing escapes, so the shape of the DODGEABLE REGION is readable at a glance.
if (args.axis.length === 2) {
  const axName = (s) => /^([A-Za-z_0-9.]+)=/.exec(String(s))[1];
  const axVals = (s) => String(s).slice(axName(s).length + 1).split(',');
  const [rn, cn] = args.axis.map(axName);
  const [rv, cv] = args.axis.map(axVals);
  console.log(`   rows ${rn} x cols ${cn}   (cell = bearings escaping of 36; "-" = none)\n`);
  console.log(`   ${''.padEnd(10)}${cv.map((v) => (v === '' ? 'shipped' : v).padStart(9)).join('')}`);
  for (let i = 0; i < rv.length; i++) {
    const cells = cv.map((_, j) => {
      const r = out[i * cv.length + j];
      return (r.escaped === 0 ? '-' : `${r.escaped}`).padStart(9);
    });
    console.log(`   ${(rv[i] === '' ? 'shipped' : rv[i]).padEnd(10)}${cells.join('')}`);
  }
}
if (args.json) execFileSync('/bin/sh', ['-c', `cat > ${JSON.stringify(String(args.json))}`], { input: JSON.stringify(out, null, 2) });
console.log('');
