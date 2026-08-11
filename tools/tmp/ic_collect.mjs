#!/usr/bin/env node
/**
 * Assemble a round's answer sheets into the `[{judge, plate, key, mode, lines}]` file
 * that `icon_score.mjs` and `ic_pair.mjs --score` both read.
 *
 * ── Why this is a tool and not a shell loop ─────────────────────────────────
 * The PROTOCOL is part of the measurement, and `a77ff30` found it is worth 29 points on
 * its own — the same 63 tiles scored 96.3% when the judge could magnify and 67.2% when
 * it could not. Every arm therefore has to be stamped with which one it was, at the
 * moment it is collected, or the two get pooled later by someone reading a filename.
 * This refuses to write a sheet without an explicit `--protocol`.
 *
 * It also validates each sheet against the key BEFORE scoring: a judge that answered 71
 * of 74 tiles, or numbered them 0..73, produces a plausible score rather than an error.
 *
 *   node tools/tmp/ic_collect.mjs --key shots/ic/d2/draft2.key.json \
 *     --protocol nozoom --judges P,Q,R --dir shots/ic/d2 --out shots/ic/d2/answers_nozoom.json
 *   node tools/tmp/ic_collect.mjs --selftest
 *
 * ── 🚨 THE ROW-SLIP GUARD, AND WHY IT EXISTS ────────────────────────────────
 * A judge names tile 33 while looking at tile 41. Every check this file had already
 * passed on such a sheet: 74 lines, numbered 1..74, no duplicates, every candidate
 * string valid. It scores as a plausible round — and it is one whole row of garbage.
 *
 * Measured on the r13 magnified plate, 8 columns, three judges:
 *
 *     aligned          shifted by +1 ROW (+8 tiles)
 *     M1  36 of 74     **22 of 66**   — slipped from tile 33 to tile 66
 *     M2  55 of 74      4 of 66       — a shorter slip, tiles 57..66
 *     M3  61 of 74      0 of 66       — clean
 *     N1  48 of 74      0 of 66  }  the NATIVE plate: not one row-slip in any of
 *     N2  46 of 74      0 of 66  }  three sheets, so this is a property of the
 *     N3  42 of 74      0 of 66  }  MAGNIFIED plate's caption layout, not of judges
 *
 * 🔴 AND THE TWIN CONTROL CANNOT TELL THIS APART FROM AN ILLEGIBLE GLYPH. That round's
 * magnified twins reported **8 of 12 pairs disagreeing**, including `tomato` and `gift`,
 * which are 3/3-legible with 0 splits in every round ever run. Read as acuity that says
 * "the floor is enormous"; read correctly it says "two sheets are misaligned". The twin
 * control is a floor, not an alignment check, and this file is where alignment belongs
 * because it is the only place that sees the raw sheet next to the key.
 *
 * The predicate is DELIBERATELY not a whole-sheet ratio: M2's slip is 10 tiles of 74 and
 * a whole-sheet test cannot see it. It slides a 16-tile window and refuses when, inside
 * any window, the sheet agrees with the key SHIFTED BY A ROW at least as often as with
 * the key itself. `--selftest` synthesises both real shapes — a 34-tile slip and a
 * 10-tile one inside an otherwise 60%-correct sheet — and requires BOTH to be refused,
 * plus four sheets that must NOT fire (normal, perfect, uniformly wrong, and two
 * coincidental neighbour matches) so the predicate cannot be tautological.
 * ⚠️ The six REAL r13 sheets run too, but only as an optional arm: `shots/` is
 * gitignored, so a selftest that required them would pass here and fail on a clean
 * checkout and under `verify-head.mjs`. They print SKIP when absent.
 */
import { readFileSync, writeFileSync, existsSync } from 'node:fs';
import { join } from 'node:path';
import { pathToFileURL } from 'node:url';
import { subjectOf, SUBJECT as SUBJECT_TEXT } from './icon_score.mjs';

/** True only when this file is the process entry point — `AGENT-BRIEF` §3: a module that
 *  exports anything must guard its CLI, or importing it runs the whole tool. */
const IS_MAIN = process.argv[1] ? import.meta.url === pathToFileURL(process.argv[1]).href : false;

/** How many columns the plate was drawn with. Read off the key's own URL, which
 *  `ic_pair.mjs` records verbatim, so it cannot be transcribed wrong. */
export function colsOf(key) {
  const m = String(key.url ?? '').match(/[?&]cols=(\d+)/);
  return m ? Number(m[1]) : null;
}

/**
 * Does this answer sheet track the key, or a row of it?
 *
 * `answers` is Map<tileIndex, rawAnswerText>; `byI` is Map<tileIndex, iconName>.
 * Returns the offending windows. Empty means aligned.
 */
export function slipWindows(answers, byI, cols, win = 16) {
  const n = byI.size;
  const hit = (i, off) => {
    const want = byI.get(i + off);
    return want !== undefined && subjectOf(answers.get(i)) === want;
  };
  const out = [];
  for (let start = 1; start + win - 1 <= n; start += win / 2) {
    let aligned = 0, shifted = 0;
    for (let i = start; i < start + win; i++) {
      if (hit(i, 0)) aligned++;
      if (hit(i, cols) || hit(i, -cols)) shifted++;
    }
    // ≥ 3 shifted matches rules out coincidence (two icons that happen to agree);
    // `shifted >= aligned` is the actual signal — inside a slipped window the sheet
    // tracks the neighbouring row BETTER than its own.
    if (shifted >= 3 && shifted >= aligned) out.push({ start, end: start + win - 1, aligned, shifted });
  }
  return out;
}

const a = {};
for (let i = 2; i < process.argv.length; i++) {
  if (process.argv[i].startsWith('--')) a[process.argv[i].slice(2)] = process.argv[i + 1];
}

// ── KNOWN-BAD INPUT ─────────────────────────────────────────────────────────
// `CLAUDE.md` #6 — a guard that has not been shown to FAIL on the bug it guards against
// is not a guard, and a guard that refuses EVERYTHING is not one either. Both halves are
// required below: two slipped sheets that must be refused, four honest ones that must not.
// ⚠️ `'selftest' in a`, NOT `a.selftest !== undefined`: the parser above writes
// `a[flag] = argv[i+1]`, so a trailing boolean flag stores the value `undefined` and the
// obvious test is false for the one call that has to work.
if (IS_MAIN && 'selftest' in a) {
  let pass = 0, fail = 0;
  const check = (name, got, want) => {
    const ok = JSON.stringify(got) === JSON.stringify(want);
    ok ? pass++ : fail++;
    console.log(`  ${ok ? 'ok  ' : 'FAIL'}  ${name}  got ${JSON.stringify(got)}`);
  };

  // 🔴 THE FIXTURES ARE SYNTHESISED HERE AND NOT READ FROM `shots/`. The first cut of
  // this selftest drove the predicate from the six real r13 answer sheets, which is the
  // better evidence — and `shots/` IS GITIGNORED, so on a fresh checkout, and under
  // `verify-head.mjs`, every one of those arms would have vanished. A gate that cannot
  // run on the committed tree is not a gate. The real sheets are kept as an OPTIONAL
  // arm at the bottom, which reports SKIP when they are absent.
  const TEXT_OF = new Map(Object.entries(
    // A stable name -> candidate-string map is what turns a synthetic key into sheets a
    // real judge could have written; `subjectOf` is the only thing the predicate reads.
    Object.fromEntries(Object.entries(SUBJECT_TEXT).map(([t, n]) => [n, t]))));
  const COLS = 8, N = 74;
  const POOL = [...TEXT_OF.keys()];
  const synthKey = {
    url: `http://localhost:1/tools/tmp/icon_legibility.html?set=all&seed=1&cols=${COLS}&cell=92`,
    plan: Array.from({ length: N }, (_, k) => ({ i: k + 1, name: POOL[k % POOL.length] })),
  };
  const byI = new Map(synthKey.plan.map((p) => [p.i, p.name]));
  const cols = colsOf(synthKey);
  check('cols are read off the key\'s own URL, not passed in', cols, COLS);

  /** A judge who is right about 60% of the time — the real native rate is 55–65%. */
  const correctAt = (i) => (i * 7) % 10 < 6;
  const wrongFor = (i) => TEXT_OF.get(POOL[(i * 13 + 5) % POOL.length]);
  const clean = new Map();
  for (let i = 1; i <= N; i++) clean.set(i, correctAt(i) ? TEXT_OF.get(byI.get(i)) : wrongFor(i));
  check('a normal 60%-correct sheet is ACCEPTED', slipWindows(clean, byI, cols), []);

  // ── REQUIRED FAILURE 1: M1's shape — the judge drops one row at tile 33 and never
  //    recovers. 34 of 74 tiles name the tile below.
  const bigSlip = new Map(clean);
  for (let i = 33; i <= 66; i++) bigSlip.set(i, clean.get(i + COLS) ?? wrongFor(i));
  check('a whole-row slip from tile 33 onward is REFUSED', slipWindows(bigSlip, byI, cols).length > 0, true);

  // ── REQUIRED FAILURE 2: M2's shape, and the one that matters. Ten tiles only, inside
  //    an otherwise clean sheet. A whole-sheet ratio scored the real M2 at 55/74 aligned
  //    against 4/66 shifted and saw nothing at all; the sliding window is the reason
  //    this arm exists, so if the window is ever widened this check must fail.
  const smallSlip = new Map(clean);
  for (let i = 57; i <= 66; i++) smallSlip.set(i, clean.get(i + COLS) ?? wrongFor(i));
  check('a TEN-TILE slip inside a clean sheet is REFUSED', slipWindows(smallSlip, byI, cols).length > 0, true);

  // ── The three ways this could be tautological, each shown NOT to fire. A predicate
  //    that refused everything would pass both checks above and be worthless.
  const junk = new Map();
  for (let i = 1; i <= N; i++) junk.set(i, 'a padlock');
  check('a uniformly WRONG sheet is not a slip', slipWindows(junk, byI, cols), []);
  const perfect = new Map();
  for (let i = 1; i <= N; i++) perfect.set(i, TEXT_OF.get(byI.get(i)));
  check('a PERFECT sheet is not a slip', slipWindows(perfect, byI, cols), []);
  const coincidence = new Map(clean);          // 2 neighbours matched by chance, rest clean
  for (const i of [12, 20]) coincidence.set(i, TEXT_OF.get(byI.get(i + COLS)));
  check('two coincidental neighbour matches are not a slip', slipWindows(coincidence, byI, cols), []);

  // ── OPTIONAL: the REAL sheets, when this working tree still has the round. These are
  //    the inputs the predicate was actually built from, so they are worth running when
  //    present — but they can never be required, because `shots/` is gitignored.
  const K = 'shots/ic/r13/r13.key.json';
  if (existsSync(K)) {
    const rk = JSON.parse(readFileSync(K, 'utf8'));
    const rBy = new Map(rk.plan.map((p) => [p.i, p.name]));
    const rc = colsOf(rk);
    const sheet = (j) => {
      const m = new Map();
      for (const line of readFileSync(`shots/ic/r13/ans_${j}.txt`, 'utf8').split('\n')) {
        const mm = line.match(/^\s*(\d+)\s*[.):]\s*(.+?)\s*$/);
        if (mm) m.set(Number(mm[1]), mm[2]);
      }
      return m;
    };
    check('REAL M1 (slipped from tile 33) is REFUSED', slipWindows(sheet('M1'), rBy, rc).length > 0, true);
    check('REAL M2 (slipped tiles 57..66 only) is REFUSED', slipWindows(sheet('M2'), rBy, rc).length > 0, true);
    check('REAL M3 (clean, same plate and protocol) is ACCEPTED', slipWindows(sheet('M3'), rBy, rc), []);
    for (const j of ['N1', 'N2', 'N3']) check(`REAL ${j} (native plate, clean) is ACCEPTED`, slipWindows(sheet(j), rBy, rc), []);
  } else {
    console.log(`  SKIP  the 6 real r13 sheets (${K} absent — shots/ is gitignored)`);
  }

  console.log(`\nic_collect selftest ${pass} pass / ${fail} fail`);
  process.exit(fail ? 1 : 0);
}

// ── 🚨 THE CLI BODY IS GUARDED BECAUSE THIS FILE NOW EXPORTS. ───────────────
// `AGENT-BRIEF` §3: making a function importable — the right instinct, so `ic_pair` and
// any future scorer share ONE alignment predicate instead of copying it — silently makes
// the whole CLI path run on import. Three tools in this repo had exactly that bug; here
// it would fire `process.exit(2)` inside somebody else's process, on THEIR argv.
if (!IS_MAIN) { /* imported: expose colsOf/slipWindows and do nothing else */ }
else {

const PROTOCOLS = new Set(['zoom', 'nozoom']);
if (!a.key || !a.judges || !a.out || !PROTOCOLS.has(a.protocol)) {
  console.error('usage: ic_collect.mjs --key <k.json> --protocol zoom|nozoom --judges P,Q --dir <d> --out <o.json>');
  console.error('  ⚠️ --protocol is REQUIRED. A score quoted without it is not a number.');
  process.exit(2);
}
const dir = a.dir ?? '.';
const key = JSON.parse(readFileSync(a.key, 'utf8'));
const n = key.tiles.length;

const runs = [];
const faults = [];
for (const j of a.judges.split(',').map((s) => s.trim()).filter(Boolean)) {
  const path = join(dir, `ans_${j}.txt`);
  const lines = readFileSync(path, 'utf8').split('\n').map((s) => s.trim()).filter(Boolean);
  const seen = new Map();
  for (const line of lines) {
    const m = line.match(/^\s*(\d+)\s*[.):]\s*(.+?)\s*$/);
    if (!m) { faults.push(`${j}: unparseable line "${line}"`); continue; }
    const i = Number(m[1]);
    if (seen.has(i)) faults.push(`${j}: tile ${i} answered twice`);
    seen.set(i, m[2]);
  }
  const missing = [];
  for (let i = 1; i <= n; i++) if (!seen.has(i)) missing.push(i);
  const extra = [...seen.keys()].filter((i) => i < 1 || i > n);
  if (missing.length) faults.push(`${j}: ${missing.length} of ${n} tiles UNANSWERED (${missing.slice(0, 12).join(',')}${missing.length > 12 ? '…' : ''})`);
  if (extra.length) faults.push(`${j}: answered tiles outside 1..${n}: ${extra.join(',')}`);
  // ── ROW-SLIP. See the header. A sheet that tracks the neighbouring row is not a
  //    low score, it is a different question answered — and nothing downstream can
  //    tell the two apart, least of all the twin control.
  const cols = colsOf(key);
  if (cols && key.plan) {
    const w = slipWindows(seen, new Map(key.plan.map((p) => [p.i, p.name])), cols);
    if (w.length) {
      faults.push(`${j}: ROW-SLIP — the sheet tracks the key shifted by ${cols} (one plate row) in `
        + `${w.length} window(s): ` + w.map((x) => `${x.start}..${x.end} aligned ${x.aligned} vs shifted ${x.shifted}`).join('; ')
        + `. The sheet is not scoreable; re-judge that arm.`);
    }
  }
  runs.push({
    judge: j, plate: key.plate ?? a.key, key: a.key, mode: 'forced',
    protocol: a.protocol, lines,
  });
}

if (faults.length) {
  console.log('🔴 ANSWER SHEETS INVALID:\n  ' + faults.join('\n  '));
  process.exit(1);
}
writeFileSync(a.out, JSON.stringify(runs, null, 1) + '\n');
console.log(`wrote ${a.out}  ${runs.length} judge(s) x ${n} tiles  protocol=${a.protocol}`);

} // ← end of the IS_MAIN guard
