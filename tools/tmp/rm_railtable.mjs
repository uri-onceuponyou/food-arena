#!/usr/bin/env node
/**
 * rm_railtable — print OLD vs NEW vs REFERENCE for every arena-scan rail and aggregate.
 *
 * WHY THIS EXISTS: `arena-scan --baseline` REFUSES to compare two baselines whose
 * station sets differ (exit 2), and the 36ee0a6 baseline was taken on the 1x map's
 * 18 stations while HEAD's are the x4 map's. That refusal is correct — same station
 * ID, different GROUND — but it also means the tool cannot render the comparison the
 * re-baseline exists to produce. This prints it, with the refusal's caveat attached to
 * every row rather than suppressed.
 *
 *   node tools/tmp/rm_railtable.mjs --old <a.json> --new <b.json>
 *   node tools/tmp/rm_railtable.mjs --selftest
 *
 * ── KNOWN-BAD CONTROLS (`--selftest`) ────────────────────────────────────────────
 * Every one of these is a way this script could print a confident wrong table, and
 * each must FAIL the assertion it guards:
 *   SELF-PAIR   a file against itself -> every delta EXACTLY 0, every verdict 'same'
 *   MOVED       a rail nudged below its band floor -> status must flip PASS -> FAIL
 *   BANDS       the two files carry DIFFERENT bands for one key -> must be REPORTED,
 *               not silently compared (a band change is an instrument change)
 *   NONEMPTY    the rail set is asserted non-empty BEFORE any .every()/.filter() runs
 *               over it -- `[].every()` returns true and that vacuity has fired three
 *               times in three files in this repo
 *   MISSING     a key present in OLD and absent in NEW must print as such, never as 0
 */
import { readFileSync } from 'node:fs';

const arg = (k, d) => { const i = process.argv.indexOf('--' + k); return i < 0 ? d : process.argv[i + 1]; };
const has = (k) => process.argv.includes('--' + k);

const f4 = (v) => (v === null || v === undefined || Number.isNaN(v) ? '  --  ' : Number(v).toFixed(4));

/** Re-derive PASS/FAIL/WARN from value+band rather than trusting the stored `status`
 *  string, so a file whose status was written by a different tool version cannot
 *  smuggle a stale verdict into the table.
 *
 * ⚠️ MIRRORS `railStatus()` in tools/arena-scan.mjs:1636 — band on BOTH sides, then
 * `advisory` rails downgraded FAIL -> WARN.
 *
 * 🚨 THIS FUNCTION SHIPPED WRONG AND ITS OWN SELFTEST CAUGHT IT. The first version read
 * `if (value > hi && !freeAbove) FAIL`, i.e. it let `freeAbove` free the band CEILING.
 * It does not. `freeAbove` is consumed at arena-scan.mjs:1682 by the DRIFT check only
 * (`onFreeSide = rail.freeAbove && n >= rail.target`) and never by `railStatus`; the
 * rail's own note says "Above target is free; the band ceiling still applies" and the
 * source comment at :806 says "The band ceiling (1.5x) still hard-fails, so this is
 * one-sided drift, not an unbounded licence." Kept as a comment because the wrong
 * version would have rated a runaway-cool arena PASS on the one rail built to bound it.
 *
 * ⚠️ `hardFloor` is NOT stored in the baseline JSON, so it cannot be re-derived here.
 * That is why every row is ALSO cross-checked against the stored `status` string: a
 * disagreement is reported rather than silently resolved in favour of either one. */
export function verdict(rail) {
  if (!rail || !Array.isArray(rail.band)) return { ok: null, why: 'no band', label: ' n/a ' };
  const [lo, hi] = rail.band;
  const advisory = /advisory/.test(rail.kind || '');
  let ok = true, why = '';
  if (rail.value < lo) { ok = false; why = `below band ${lo.toFixed(4)}`; }
  else if (rail.value > hi) { ok = false; why = `above band ${hi.toFixed(4)}`; }
  return { ok, why, label: ok ? 'PASS' : (advisory ? 'WARN' : 'FAIL') };
}

/** Compare two baselines rail-by-rail. Returns rows + a list of structural problems
 *  that must be surfaced rather than folded into a number. */
export function compare(oldJson, newJson) {
  const oRails = oldJson.rails || [];
  const nRails = newJson.rails || [];
  // NONEMPTY: assert BEFORE filtering anything. `[].every()` is true.
  if (oRails.length === 0) throw new Error('OLD carries no rails — refusing to print a vacuous table');
  if (nRails.length === 0) throw new Error('NEW carries no rails — refusing to print a vacuous table');

  const problems = [];
  const byKey = (arr) => new Map(arr.map((r) => [r.key, r]));
  const O = byKey(oRails), N = byKey(nRails);
  const keys = [...new Set([...O.keys(), ...N.keys()])];

  const rows = keys.map((key) => {
    const o = O.get(key), n = N.get(key);
    if (!o) problems.push(`rail ${key} is NEW-only — no old value to compare`);
    if (!n) problems.push(`rail ${key} vanished from NEW — reported, not scored 0`);
    if (o && n && JSON.stringify(o.band) !== JSON.stringify(n.band)) {
      problems.push(`rail ${key} BAND MOVED ${JSON.stringify(o.band)} -> ${JSON.stringify(n.band)} `
        + '— that is an INSTRUMENT change, the two verdicts are not comparable');
    }
    const ov = o ? verdict(o) : { ok: null, label: ' n/a ' }, nv = n ? verdict(n) : { ok: null, label: ' n/a ' };
    // Cross-check the re-derived verdict against the one the tool stored. `hardFloor`
    // is not in the JSON, so a disagreement is possible and must be SURFACED.
    for (const [side, r, v] of [['OLD', o, ov], ['NEW', n, nv]]) {
      if (r && r.status && r.status !== 'SKIP' && r.status !== v.label) {
        problems.push(`rail ${key} ${side}: stored status "${r.status}" but band re-derives to "${v.label}" `
          + '— one of the two is stale (hardFloor is not stored and cannot be re-derived)');
      }
    }
    return {
      key,
      label: (n || o).label,
      target: (n || o).target,
      band: (n || o).band,
      kind: (n || o).kind,
      oldV: o ? o.value : null,
      newV: n ? n.value : null,
      delta: o && n ? +(n.value - o.value).toFixed(4) : null,
      oldOk: ov.ok, newOk: nv.ok, oldWhy: ov.why, newWhy: nv.why,
      oldLabel: ov.label, newLabel: nv.label,
      flip: o && n && ov.ok !== nv.ok ? (nv.ok ? `${ov.label}->${nv.label}` : `${ov.label}->${nv.label}`) : '',
    };
  });
  return { rows, problems };
}

function fmt(rows, problems, oldName, newName) {
  const out = [];
  out.push('');
  out.push(`  RAILS   OLD = ${oldName}   NEW = ${newName}`);
  out.push('');
  out.push('  rail                         OLD    verdict     NEW    verdict     delta   target   band                  flip');
  out.push('  ' + '-'.repeat(118));
  for (const r of rows) {
    out.push('  ' + r.key.padEnd(22)
      + f4(r.oldV).padStart(8) + '  ' + r.oldLabel.padEnd(9)
      + f4(r.newV).padStart(8) + '  ' + r.newLabel.padEnd(9)
      + (r.delta === null ? '  --  ' : (r.delta > 0 ? '+' : '') + r.delta.toFixed(4)).padStart(8) + '  '
      + f4(r.target).padStart(7) + '  '
      + (r.band ? `[${r.band[0].toFixed(4)}, ${r.band[1].toFixed(4)}]` : '').padEnd(20)
      + '  ' + r.flip);
  }
  if (problems.length) {
    out.push('');
    out.push('  STRUCTURAL PROBLEMS (not folded into any number above):');
    for (const p of problems) out.push('    ! ' + p);
  }
  return out.join('\n');
}

// ── selftest ────────────────────────────────────────────────────────────────────
function selftest() {
  let pass = 0, fail = 0;
  const check = (name, got, want) => {
    const ok = JSON.stringify(got) === JSON.stringify(want);
    console.log(`  ${ok ? 'PASS' : 'FAIL'}  ${name}  ${ok ? '' : `got ${JSON.stringify(got)} want ${JSON.stringify(want)}`}`);
    ok ? pass++ : fail++;
  };
  const mk = (v) => ({
    rails: [
      { key: 'warmChroma', label: 'w', value: v, target: 0.145, band: [0.0725, 0.2175], kind: 'chosen band' },
      { key: 'coolChroma', label: 'c', value: 0.40, target: 0.343, band: [0.1715, 0.5145], kind: 'chosen band, freeAbove' },
    ],
  });

  // SELF-PAIR — a file against itself must move nothing and flip nothing.
  {
    const { rows } = compare(mk(0.0596), mk(0.0596));
    check('SELF-PAIR every delta exactly 0', rows.every((r) => r.delta === 0), true);
    check('SELF-PAIR no flips', rows.every((r) => r.flip === ''), true);
    check('SELF-PAIR rail set non-empty (guards [].every vacuity)', rows.length, 2);
  }
  // MOVED — the known-bad the whole table exists to catch.
  {
    const { rows } = compare(mk(0.0596), mk(0.1600));
    const w = rows.find((r) => r.key === 'warmChroma');
    check('MOVED warmChroma 0.0596 verdict FAIL (below floor 0.0725)', w.oldOk, false);
    check('MOVED warmChroma 0.1600 verdict PASS', w.newOk, true);
    check('MOVED reports the flip', w.flip, 'FAIL->PASS');
    check('MOVED delta is exact', w.delta, 0.1004);
  }
  // freeAbove — cool at 0.55 is ABOVE its 0.5145 ceiling but freeAbove; must still
  // FAIL, because freeAbove is consumed by the DRIFT check only, never by railStatus.
  // 🚨 THIS ASSERTION CAUGHT THE REAL BUG in the first version of `verdict()`, which
  // applied freeAbove to the band ceiling and rated this PASS.
  {
    const a = mk(0.1); a.rails[1].value = 0.5500;
    const { rows } = compare(mk(0.1), a);
    check('freeAbove does NOT free the band CEILING', rows.find((r) => r.key === 'coolChroma').newOk, false);
    const b = mk(0.1); b.rails[1].value = 0.4500;
    check('freeAbove above TARGET but inside band = PASS',
      compare(mk(0.1), b).rows.find((r) => r.key === 'coolChroma').newOk, true);
  }
  // advisory — an out-of-band ADVISORY rail is WARN, not FAIL (arena-scan.mjs:1645).
  // The CONTROL below is what stops this being vacuous: the same value on a
  // non-advisory rail must still read FAIL, so the downgrade is doing real work.
  {
    const a = mk(0.1); a.rails[0].kind = 'HUD-free, advisory'; a.rails[0].value = 0.0100;
    const r = compare(mk(0.1), a).rows.find((x) => x.key === 'warmChroma');
    check('advisory out-of-band reads WARN', r.newLabel, 'WARN');
    const b = mk(0.0100);
    check('CONTROL non-advisory at the SAME value reads FAIL',
      compare(mk(0.1), b).rows.find((x) => x.key === 'warmChroma').newLabel, 'FAIL');
  }
  // STORED-STATUS CROSS-CHECK — a file whose stored `status` disagrees with its own
  // band must be reported, never silently trusted or silently overridden.
  {
    const a = mk(0.0596); a.rails[0].status = 'PASS';   // 0.0596 is BELOW the 0.0725 floor
    const { problems } = compare(a, mk(0.0596));
    check('STORED-STATUS a lying status string is reported',
      problems.some((p) => /stored status/.test(p)), true);
    const b = mk(0.0596); b.rails[0].status = 'FAIL'; b.rails[1].status = 'PASS';
    check('CONTROL an honest status string raises nothing',
      compare(b, b).problems.length, 0);
  }
  // BANDS — a band change is an instrument change and must be REPORTED.
  {
    const b = mk(0.0596); b.rails[0].band = [0.0800, 0.2175];
    const { problems } = compare(mk(0.0596), b);
    check('BANDS a moved band is reported', problems.some((p) => /BAND MOVED/.test(p)), true);
  }
  // CONTROL: the band check does not fire when bands agree.
  {
    const { problems } = compare(mk(0.0596), mk(0.0596));
    check('CONTROL identical bands raise no band problem', problems.length, 0);
  }
  // MISSING — a vanished rail prints as missing, never as 0.
  {
    const b = mk(0.0596); b.rails = [b.rails[1]];
    const { rows, problems } = compare(mk(0.0596), b);
    check('MISSING vanished rail reported', problems.some((p) => /vanished/.test(p)), true);
    check('MISSING vanished rail newV is null not 0', rows.find((r) => r.key === 'warmChroma').newV, null);
  }
  // NONEMPTY — an empty rail set must THROW, not print a clean empty table.
  {
    let threw = false;
    try { compare({ rails: [] }, mk(0.1)); } catch { threw = true; }
    check('NONEMPTY empty OLD throws rather than printing a vacuous PASS', threw, true);
  }
  console.log(`\n  rm_railtable selftest: ${pass} pass, ${fail} fail`);
  process.exit(fail ? 1 : 0);
}

if (has('selftest')) selftest();

const oldPath = arg('old'), newPath = arg('new');
if (!oldPath || !newPath) {
  console.error('usage: node tools/tmp/rm_railtable.mjs --old <a.json> --new <b.json>');
  process.exit(2);
}
const A = JSON.parse(readFileSync(oldPath, 'utf8'));
const B = JSON.parse(readFileSync(newPath, 'utf8'));
const { rows, problems } = compare(A, B);
console.log(fmt(rows, problems, `${A.provenance?.shaShort || '?'} (${oldPath})`, `${B.provenance?.shaShort || '?'} (${newPath})`));

// ── aggregates: every stored value, not just the ones promoted to rails ──────────
const oa = A.aggregate?.values || {}, na = B.aggregate?.values || {};
const akeys = [...new Set([...Object.keys(oa), ...Object.keys(na)])];
if (akeys.length === 0) throw new Error('no aggregate values on either side — refusing a vacuous table');
console.log('\n  AGGREGATES (all stored values)\n');
console.log('  key                          OLD       NEW     delta');
console.log('  ' + '-'.repeat(52));
for (const k of akeys) {
  const o = oa[k], n = na[k];
  const d = (typeof o === 'number' && typeof n === 'number') ? (n - o) : null;
  console.log('  ' + k.padEnd(24) + f4(o).padStart(8) + '  ' + f4(n).padStart(8) + '  '
    + (d === null ? '  --  ' : (d > 0 ? '+' : '') + d.toFixed(4)).padStart(8));
}

// ── provenance, printed side by side, because a baseline IS a measurement ────────
const pv = (j) => {
  const p = j.provenance || {};
  return `sha=${p.shaShort || '(none)'} trust=${p.trust || '?'} stillHud=${p.stillHud} `
    + `srcDirty=${p.srcDirtyFiles} tool=${(p.tool?.blob || '').slice(0, 7)} committed=${p.tool?.committed} gen=${p.generated}`;
};
console.log('\n  PROVENANCE');
console.log('    OLD  ' + pv(A));
console.log('    NEW  ' + pv(B));
const ok = A.aggregate?.stationKeys || [], nk = B.aggregate?.stationKeys || [];
const moved = ok.filter((k, i) => k !== nk[i]);
console.log(`\n  STATIONS: ${ok.length} old, ${nk.length} new, ${moved.length} keys differ`
  + (moved.length ? '  -> `arena-scan --baseline` REFUSES this pair (same IDs, different GROUND)' : ''));
