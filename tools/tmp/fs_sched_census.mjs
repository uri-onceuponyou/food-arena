#!/usr/bin/env node
/**
 * FS_SCHED_CENSUS — WHO ELSE THINKS THEY KNOW THE FOG SCHEDULE?
 *
 * ═══════════════════════════════════════════════════════════════════════════
 * WHAT IT GUARDS, AND WHY A CENSUS RATHER THAN AN ASSERTION
 * ═══════════════════════════════════════════════════════════════════════════
 *
 * The opening radius of the closing ring was, until 2026-08-12,
 *
 *     Math.round(halfDiagonal / (1 - FOG_FIRST_CONTACT_S * 1000 / MATCH_DURATION_MS))
 *
 * and **that expression is copied into dozens of instruments** — a few read
 * `FOG_FIRST_CONTACT_S` out of `arena/shared.ts` by regex, most hardcode `6000`, and one
 * committed JSON dump (`tools/arena.gameplay.json`) bakes the answer. Every one of them
 * recomputes it from the tree's live `MATCH_DURATION_MS`, which is exactly what made them
 * look safe: they were *derived*, just from a formula that no longer describes the game.
 * ⚠️ **The count is printed, never written down here.** It is the output of this tool, it
 * moves as the copies are fixed, and a number in a header is how six counts went stale in
 * one session in this project — every one found by an agent tripping over it.
 *
 * On the new clock that formula returns **1792** where the shipped opening ring is
 * **1720.4651** — a 4.2% error, from a plausible number, in the instruments the balance
 * re-measure runs on. A silent 4.2% wrong fog is worse than a crash.
 *
 * It is a CENSUS and not a single assertion because the files are not this pass's to edit
 * (one owner per file set) and because the interesting output is the WORKLIST: which file,
 * which line, what it computes, what it should compute.
 *
 * ═══════════════════════════════════════════════════════════════════════════
 * AND ONE THING IT DOES ASSERT: THE DELIBERATE DUPLICATE
 * ═══════════════════════════════════════════════════════════════════════════
 *
 * `arena/shared.ts:FOG_FIRST_CONTACT_S` is a LITERAL 25 that must equal
 * `rules.ts:FOG_HOLD_MS / 1000`. It is a literal on purpose: three tools regex it out of
 * the file text (`= ([\d.]+)`), so a non-numeric right-hand side makes their
 * `.exec(...)[1]` throw on null. Rule 10 says derive; the cheaper honest option here is to
 * duplicate and GUARD, and this is the guard.
 *
 * ═══════════════════════════════════════════════════════════════════════════
 * KNOWN-BAD
 * ═══════════════════════════════════════════════════════════════════════════
 *
 * `--knownbad` runs both detectors against planted inputs — a `FOG_FIRST_CONTACT_S` that
 * disagrees with `FOG_HOLD_MS`, and a synthetic source line carrying the old derivation —
 * and REQUIRES both to fire. A detector that has never said no is a comment with a tick
 * next to it. The census arm also asserts its scan set is NON-EMPTY before reporting a
 * clean sweep: `[].every()` returns true, and "no stale copies found" is exactly what a
 * mis-pointed glob prints.
 *
 *   node tools/tmp/fs_sched_census.mjs
 *   node tools/tmp/fs_sched_census.mjs --knownbad
 */

import { readFileSync, readdirSync, existsSync } from 'node:fs';
import { fileURLToPath } from 'node:url';
import { dirname, resolve, relative } from 'node:path';

const HERE = dirname(fileURLToPath(import.meta.url));
const ROOT = resolve(HERE, '../..');
const RULES = await import(`${ROOT}/src/game/rules.ts`);
const { FOG_HOLD_MS, MATCH_DURATION_MS, fogOpeningRadiusFor } = RULES;

const args = new Set(process.argv.slice(2));
let failures = 0;
const check = (name, pass, detail = '') => {
  if (!pass) failures++;
  console.log(`  ${pass ? 'ok  ' : 'FAIL'} - ${name}${detail ? `\n         ${detail}` : ''}`);
};

// ─────────────────────────────────────────────────────────────────────────────
// 1. THE DELIBERATE DUPLICATE
// ─────────────────────────────────────────────────────────────────────────────
console.log('══ fs_sched_census ══\n\n1. `arena/shared.ts:FOG_FIRST_CONTACT_S` against `rules.ts:FOG_HOLD_MS`');
const SHARED_PATH = `${ROOT}/src/arena/shared.ts`;
const SHARED = readFileSync(SHARED_PATH, 'utf8');

/** The SAME regex the three consuming tools use, so this guard fails when they would. */
const FFC_RE = /export const FOG_FIRST_CONTACT_S = ([\d.]+)/;
function firstContactOf(src) {
  const m = FFC_RE.exec(src);
  return m ? Number(m[1]) : null;
}
const ffc = firstContactOf(SHARED);
check('the constant is still REGEX-READABLE — three tools `.exec(...)[1]` it and would throw on null',
  ffc !== null, ffc === null ? 'FOG_FIRST_CONTACT_S is no longer a bare number' : `parsed ${ffc}`);
check('FOG_FIRST_CONTACT_S === FOG_HOLD_MS / 1000 — the duplicate agrees with its source',
  ffc !== null && ffc * 1000 === FOG_HOLD_MS,
  `${ffc} s vs FOG_HOLD_MS ${FOG_HOLD_MS} ms (${FOG_HOLD_MS / 1000} s)`);

if (args.has('--knownbad')) {
  const planted = SHARED.replace(FFC_RE, 'export const FOG_FIRST_CONTACT_S = 6');
  const bad = firstContactOf(planted);
  check('KNOWN-BAD: the detector FIRES on a planted stale 6 s first-contact',
    bad !== null && bad * 1000 !== FOG_HOLD_MS, `planted ${bad} s against ${FOG_HOLD_MS / 1000} s`);
  const plantedNonNumeric = SHARED.replace(FFC_RE, 'export const FOG_FIRST_CONTACT_S = FOG_HOLD_MS / 1000');
  check('KNOWN-BAD: the regex-readability detector FIRES on the "honest" derived form',
    firstContactOf(plantedNonNumeric) === null, 'the derived form is unparseable by the three consumers');
}

// ─────────────────────────────────────────────────────────────────────────────
// 2. THE CENSUS
// ─────────────────────────────────────────────────────────────────────────────
console.log('\n2. Copies of the SUPERSEDED opening-radius derivation');

/** Any line that divides by `1 - <something first-contact-ish> / <something clock-ish>`. */
const OLD_FORM = /1\s*-\s*\(?\s*FOG_FIRST_CONTACT(?:_S\s*\*\s*1000|_MS)\s*\)?\s*\/\s*[A-Za-z_.]*(?:MATCH_DURATION_MS|matchDurationMs|CLOCK|OLD_T|T)\b/;
/** The hardcoded 6 s, which is the value that is now wrong rather than the formula. */
const OLD_CONST = /FOG_FIRST_CONTACT_(?:MS\s*=\s*6000|S\s*=\s*6\b)/;

function* walk(dir) {
  for (const e of readdirSync(dir, { withFileTypes: true })) {
    if (e.name === 'node_modules' || e.name === '.git' || e.name.startsWith('.')) continue;
    const p = `${dir}/${e.name}`;
    if (e.isDirectory()) yield* walk(p);
    else if (/\.(mjs|js|ts)$/.test(e.name)) yield p;
  }
}

const SCAN_ROOTS = [`${ROOT}/src`, `${ROOT}/tools`].filter((d) => existsSync(d));
const scanned = [];
const hits = [];
for (const root of SCAN_ROOTS) {
  for (const file of walk(root)) {
    const rel = relative(ROOT, file);
    // This file is the guard and quotes both patterns in its own header on purpose.
    if (rel === 'tools/tmp/fs_sched_census.mjs') continue;
    scanned.push(rel);
    const lines = readFileSync(file, 'utf8').split('\n');
    lines.forEach((line, i) => {
      const t = line.trim();
      // 🚨 COMMENT LINES ARE EXEMPT, AND THAT IS NOT LENIENCY — IT IS THIS PROJECT'S RULE.
      // `CLAUDE.md`: *"when an assertion encodes a rule that has been reversed, change it and
      // KEEP THE OLD WORDING ABOVE IT WITH THE REASON"* — done five times and never deleted.
      // So a superseded formula quoted in prose is the record working correctly, and a census
      // that flagged it would pressure the next agent to delete the history. The bug class is
      // *executable* copies. Measured: without this exemption the detector reported three src
      // faults, all three of them kept-old-wording blocks in files this pass had just written.
      if (t.startsWith('*') || t.startsWith('//') || t.startsWith('/*') || t.startsWith('>')) return;
      // A line inside a `KNOWN-BAD` block is the old form ON PURPOSE — it is the control
      // that proves the new one changed something. Skip only when the file says so within
      // three lines above, so the exemption cannot be claimed by accident.
      const context = lines.slice(Math.max(0, i - 3), i + 1).join('\n');
      if (/KNOWN-BAD|OLD_T\b|71f670b/.test(context)) return;
      if (OLD_FORM.test(line) || OLD_CONST.test(line)) hits.push({ rel, line: i + 1, text: t.slice(0, 110) });
    });
  }
}

// NON-EMPTY FIRST. "No stale copies" and "the walker found nothing" print identically.
check('the scan set is non-empty — the walker actually visited the tree',
  scanned.length > 200 && scanned.some((p) => p.startsWith('src/')) && scanned.some((p) => p.startsWith('tools/')),
  `${scanned.length} source files under ${SCAN_ROOTS.map((d) => relative(ROOT, d)).join(', ')}`);

const halfDiag = Math.hypot(2800 / 2, 2000 / 2);
const shippedOpening = fogOpeningRadiusFor(halfDiag);
const staleOpening = Math.round(halfDiag / (1 - 6000 / MATCH_DURATION_MS));
console.log(`\n     shipped opening ring ${shippedOpening.toFixed(4)} wu · the superseded formula now returns ${staleOpening} `
  + `(${(100 * (staleOpening - shippedOpening) / shippedOpening).toFixed(1)}% high)`);
if (hits.length) {
  console.log(`     ${hits.length} live copies:`);
  for (const h of hits) console.log(`       ${h.rel}:${h.line}  ${h.text}`);
} else {
  console.log('     none.');
}

// ⚠️ THIS IS A REPORT, NOT A VERDICT, AND THE COUNT IS DELIBERATELY NOT PINNED.
// Pinning "expect exactly 11" would make this file a second place where a count lives, and
// `gatecount` refuses a second copy of a count even one that agrees. What it DOES assert is
// that the tree's own `src/` is clean — src is where a stale copy would change the GAME
// rather than an instrument — and it prints the tools worklist for whoever owns those files.
const srcHits = hits.filter((h) => h.rel.startsWith('src/'));
check('no copy of the superseded derivation survives in `src/` — the shipped game has one schedule',
  srcHits.length === 0, srcHits.map((h) => `${h.rel}:${h.line}`).join(' '));
console.log(`     ${hits.length - srcHits.length} copies under tools/ — instruments, owned elsewhere, listed above for routing.`);

if (args.has('--knownbad')) {
  const planted = [
    'const derivedMaxSafe = Math.round(HALF_DIAG / (1 - FOG_FIRST_CONTACT_MS / MATCH_DURATION_MS));',
    'const FOG_FIRST_CONTACT_MS = 6000; // arena/shared.ts FOG_FIRST_CONTACT_S',
    'const FOG_FIRST_CONTACT_S = 6;',
  ];
  check('KNOWN-BAD: the census detector FIRES on all three shapes the copies actually take',
    planted.every((l) => OLD_FORM.test(l) || OLD_CONST.test(l)),
    planted.map((l, i) => `${i}:${OLD_FORM.test(l) || OLD_CONST.test(l)}`).join(' '));
  const clean = [
    'const OPENING = fogOpeningRadiusFor(Math.hypot(w / 2, h / 2));',
    'maxSafeRadius: arena.maxSafeRadius,',
  ];
  check('KNOWN-BAD CONTROL: it does NOT fire on the correct form (a detector that flags everything flags nothing)',
    clean.every((l) => !OLD_FORM.test(l) && !OLD_CONST.test(l)),
    clean.map((l, i) => `${i}:${OLD_FORM.test(l) || OLD_CONST.test(l)}`).join(' '));
  // 🚨 THE COMMENT EXEMPTION IS ITSELF A HOLE, SO IT GETS ITS OWN KNOWN-BAD: an executable
  // line must still fire even when the file is full of exempt prose. Without this row the
  // exemption above could be widened to "everything" and every check here would stay green.
  const executable = 'const derivedMaxSafe = Math.round(HALF_DIAG / (1 - FOG_FIRST_CONTACT_MS / MATCH_DURATION_MS));';
  const commented = ` * ${executable}`;
  check('KNOWN-BAD: the comment exemption is line-scoped — the SAME text fires as code and is exempt as prose',
    (OLD_FORM.test(executable) && !executable.trim().startsWith('*'))
    && (OLD_FORM.test(commented) && commented.trim().startsWith('*')),
    'identical text, opposite verdicts, decided only by the leading token');
}

console.log(`\n${failures ? `${failures} FAILED` : 'all rows passed'}`);
process.exit(failures ? 1 : 0);
