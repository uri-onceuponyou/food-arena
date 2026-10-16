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

/**
 * Any line that divides by `1 - <something first-contact-ish> / <something clock-ish>`.
 *
 * ⚠️ OLD PATTERN, KEPT WITH THE REASON (T1b, 2026-10-16) — it read
 *     /1\s*-\s*\(?\s*FOG_FIRST_CONTACT(?:_S\s*\*\s*1000|_MS)\s*\)?\s*\/\s*[A-Za-z_.]*(?:MATCH_DURATION_MS|…|T)\b/
 * and so it could only see a copy whose NUMERATOR was spelled with the constant's name. The
 * copies are not that disciplined, and on `a878534` it reported 52 while missing 13 executable
 * lines, every one of them the same superseded ring:
 *   - a LITERAL numerator, `(1 - 6000 / MATCH_DURATION_MS)` — `p3_bestweapon:70`, `p3_rankdiv:29`,
 *     `sda_why:56`, `bm_ffa:54`, `bm_lab:93,308`, `cn_reveal:101`, `fs_sched_share:108`;
 *   - a literal numerator over a QUALIFIED clock, `6000 / R.MATCH_DURATION_MS` — `selfheal_probe:31`;
 *   - a literal over a LITERAL clock, `6000 / 45000` and `6000 / 150000` — `cv_sheet:53` (both
 *     the dead formula AND the dead 45 s clock), `bh_match_maxsafe_ab:13`;
 *   - the RECIPROCAL, `halfDiag * (T / (T - FOG_FIRST_CONTACT_MS))` — `nc_measure:182`, a
 *     registered gate, algebraically identical and invisible to a pattern anchored on `1 -`;
 *   - a parameterised copy, `1 - firstContactMs / matchDurationMs` — `ax_layout:116`.
 * Five of those thirteen turn out to be DELIBERATE (an old-tree arm, or a named known-bad), which
 * is what `classifyLine` below now decides by structure rather than by the line's spelling.
 */
const FFC_NUM = String.raw`(?:FOG_FIRST_CONTACT(?:_S\s*\*\s*1000|_MS)|firstContact(?:Ms|_ms|MS)?|6_?000|6e3)`;
const CLOCK_DEN = String.raw`(?:(?:[A-Za-z_$][\w$]*\.)*(?:MATCH_DURATION_MS|matchDurationMs|CLOCK|OLD_T|T)\b|\d[\d_]{4,}\b)`;
const OLD_FORM = new RegExp(String.raw`1\s*-\s*\(?\s*${FFC_NUM}\s*\)?\s*\/\s*${CLOCK_DEN}`);
/** The reciprocal spelling: `T / (T - first-contact)`. Same ring, no `1 -` to anchor on. */
const RECIP_FORM = new RegExp(String.raw`(?:[\w$]+\.)*(?:MATCH_DURATION_MS|matchDurationMs|CLOCK)\s*\/\s*\(\s*${CLOCK_DEN}\s*-\s*\(?\s*${FFC_NUM}`);
/** The hardcoded 6 s, which is the value that is now wrong rather than the formula. */
const OLD_CONST = /FOG_FIRST_CONTACT_(?:MS\s*=\s*6000|S\s*=\s*6\b)/;
const isOldShape = (line) => OLD_FORM.test(line) || RECIP_FORM.test(line) || OLD_CONST.test(line);

/** How many lines above a superseded expression its exemption may sit. */
const KNOWN_BAD_WINDOW = 3;
const OLD_ARM_WINDOW = 5;
/**
 * The OLD-TREE ARM: `if (typeof RULES.fogOpeningRadiusFor === 'function') … else <old formula>`.
 * A tool that A/Bs across 2026-08-12 must reproduce what a pre-change tree SHIPPED, and on
 * such a tree the superseded division IS the shipped ring — so this is the one place the old
 * form is correct, and it is recognisable by STRUCTURE: the feature test for the new rule sits
 * on a CODE line within a few lines above. Prose cannot claim it — a comment line quoting the
 * guard is ignored (`isProse`) — and the known-bads below delete the guard, move it out of the
 * window, and demote it to a comment, and require the same line to fire each time.
 */
const OLD_ARM_GUARD = /typeof\s+[\w$.]+\.fogOpeningRadiusFor\s*===?\s*['"]function['"]/;
const isProse = (line) => {
  const t = line.trim();
  return t.startsWith('*') || t.startsWith('//') || t.startsWith('/*') || t.startsWith('>');
};

/**
 * One line's verdict, from its own text and the lines above it. Returned rather than inlined
 * so `--knownbad` can drive the SAME decision on synthetic files — an exemption that is only
 * exercised on the real tree is an exemption nobody has watched say no.
 * @returns {null | 'hit' | 'prose' | 'known-bad' | 'old-tree-arm'}
 */
function classifyLine(lines, i) {
  const line = lines[i];
  if (!isOldShape(line)) return null;
  // 🚨 COMMENT LINES ARE EXEMPT, AND THAT IS NOT LENIENCY — IT IS THIS PROJECT'S RULE.
  // `CLAUDE.md`: *"when an assertion encodes a rule that has been reversed, change it and
  // KEEP THE OLD WORDING ABOVE IT WITH THE REASON"* — done five times and never deleted.
  // So a superseded formula quoted in prose is the record working correctly, and a census
  // that flagged it would pressure the next agent to delete the history. The bug class is
  // *executable* copies. Measured: without this exemption the detector reported three src
  // faults, all three of them kept-old-wording blocks in files this pass had just written.
  if (isProse(line)) return 'prose';
  // A line inside a `KNOWN-BAD` block is the old form ON PURPOSE — it is the control
  // that proves the new one changed something. Skip only when the file says so within
  // three lines above, so the exemption cannot be claimed by accident.
  const context = lines.slice(Math.max(0, i - KNOWN_BAD_WINDOW), i + 1).join('\n');
  if (/KNOWN-BAD|OLD_T\b|71f670b/.test(context)) return 'known-bad';
  const armCode = lines.slice(Math.max(0, i - OLD_ARM_WINDOW), i).filter((l) => !isProse(l));
  if (armCode.some((l) => OLD_ARM_GUARD.test(l))) return 'old-tree-arm';
  return 'hit';
}

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
/** Deliberate copies, by reason — printed, so an exemption is never invisible. */
const exempt = { 'known-bad': [], 'old-tree-arm': [] };
for (const root of SCAN_ROOTS) {
  for (const file of walk(root)) {
    const rel = relative(ROOT, file);
    // This file is the guard and quotes both patterns in its own header on purpose.
    if (rel === 'tools/tmp/fs_sched_census.mjs') continue;
    scanned.push(rel);
    const lines = readFileSync(file, 'utf8').split('\n');
    lines.forEach((line, i) => {
      const verdict = classifyLine(lines, i);
      const row = { rel, line: i + 1, text: line.trim().slice(0, 110) };
      if (verdict === 'hit') hits.push(row);
      else if (verdict && exempt[verdict]) exempt[verdict].push(row);
    });
  }
}

// NON-EMPTY FIRST. "No stale copies" and "the walker found nothing" print identically.
check('the scan set is non-empty — the walker actually visited the tree',
  scanned.length > 200 && scanned.some((p) => p.startsWith('src/')) && scanned.some((p) => p.startsWith('tools/')),
  `${scanned.length} source files under ${SCAN_ROOTS.map((d) => relative(ROOT, d)).join(', ')}`);

// The map, read from `shared.ts` rather than retyped — this line said `Math.hypot(2800 / 2,
// 2000 / 2)`, a map literal in the one tool whose subject is copies that stopped tracking
// their source.
const dimOf = (name) => Number(new RegExp(`export const ${name}\\s*=\\s*(\\d+)`).exec(SHARED)?.[1]);
const [ARENA_W, ARENA_H] = [dimOf('ARENA_W'), dimOf('ARENA_H')];
check('ARENA_W / ARENA_H are readable out of `arena/shared.ts`',
  Number.isFinite(ARENA_W) && Number.isFinite(ARENA_H), `${ARENA_W}x${ARENA_H}`);
const halfDiag = Math.hypot(ARENA_W / 2, ARENA_H / 2);
const shippedOpening = fogOpeningRadiusFor(halfDiag);
const staleOpening = Math.round(halfDiag / (1 - 6000 / MATCH_DURATION_MS));
const staleOpeningByName = Math.round(halfDiag / (1 - (ffc ?? NaN) * 1000 / MATCH_DURATION_MS));
console.log(`\n     shipped opening ring ${shippedOpening.toFixed(4)} wu · the superseded formula now returns ${staleOpening} `
  + `(${(100 * (staleOpening - shippedOpening) / shippedOpening).toFixed(1)}% high) with the literal 6 s, `
  + `${staleOpeningByName} (${(100 * (staleOpeningByName - shippedOpening) / shippedOpening).toFixed(1)}% high) `
  + 'with `FOG_FIRST_CONTACT_S` read out of shared.ts');
if (hits.length) {
  console.log(`     ${hits.length} live copies:`);
  for (const h of hits) console.log(`       ${h.rel}:${h.line}  ${h.text}`);
} else {
  console.log('     none.');
}
for (const [why, rows] of Object.entries(exempt)) {
  console.log(`     ${rows.length} exempt as ${why}${rows.length ? ':' : '.'}`);
  for (const h of rows) console.log(`       ${h.rel}:${h.line}  ${h.text}`);
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
  const verdictOf = (src, i) => classifyLine(src.split('\n'), i);
  const planted = [
    'const derivedMaxSafe = Math.round(HALF_DIAG / (1 - FOG_FIRST_CONTACT_MS / MATCH_DURATION_MS));',
    'const FOG_FIRST_CONTACT_MS = 6000; // arena/shared.ts FOG_FIRST_CONTACT_S',
    'const FOG_FIRST_CONTACT_S = 6;',
  ];
  check('KNOWN-BAD: the census detector FIRES on all three shapes the copies actually take',
    planted.every((l) => verdictOf(l, 0) === 'hit'),
    planted.map((l, i) => `${i}:${verdictOf(l, 0)}`).join(' '));
  // The shapes the ORIGINAL pattern missed on `a878534` — each copied from a real line it
  // walked past (file:line in the header). Every one must fire on its own, with no context.
  const missed = [
    ['literal numerator', 'const arena = { ...A, maxSafeRadius: Math.round(HALF / (1 - 6000 / MATCH_DURATION_MS)), build: () => null };'],
    ['literal over a QUALIFIED clock', '  maxSafeRadius: Math.round(HALF / (1 - 6000 / R.MATCH_DURATION_MS)),'],
    ['literal over a literal 45 s clock', '  const maxSafe = Math.round(halfDiag / (1 - 6000 / 45000));'],
    ['literal over a literal 150 s clock', 'const instr = Math.round(halfDiag / (1 - 6000 / 150_000));'],
    ['the RECIPROCAL', '    maxSafeRadius: halfDiag * (MATCH_DURATION_MS / (MATCH_DURATION_MS - FOG_FIRST_CONTACT_MS)),'],
    ['the reciprocal, literal', '    maxSafeRadius: halfDiag * (MATCH_DURATION_MS / (MATCH_DURATION_MS - 6000)),'],
    ['a parameterised copy', '  return Math.round(Math.hypot(width / 2, height / 2) / (1 - firstContactMs / matchDurationMs));'],
    ['the 2065 spelling (named 25 s)', 'const MAX_SAFE_RADIUS = Math.round(HALF_DIAG / (1 - (FOG_FIRST_CONTACT_S * 1000) / CLOCK));'],
  ];
  for (const [shape, line] of missed) {
    check(`KNOWN-BAD: the detector FIRES on ${shape}`, verdictOf(line, 0) === 'hit', `${verdictOf(line, 0)} ← ${line.trim()}`);
  }
  // The other direction. `MATCH_DURATION_MS + 6000` is a match BUDGET in five tools, and a
  // detector widened to literal 6000s that fired on it would bury the worklist in noise —
  // the price `gatecount` paid for bare names (16 false positives to 1 true one).
  const clean = [
    'const OPENING = fogOpeningRadiusFor(Math.hypot(w / 2, h / 2));',
    'maxSafeRadius: arena.maxSafeRadius,',
    'const arena = withShippedRing(ARENA_DATA, { override: args.maxsafe, rules: RULES, source: ARENA_PATH });',
    "      while (st.elapsed < MATCH_DURATION_MS + 6000 && st.phase !== 'ended') {",
    "  const control = multiTargetRun('lollipop', 'Smash', { presses: [0, 2], durationMs: 6000 });",
    'const mins = totals.durationMs / 60000;',
    'const progress = 1 - state.timeRemaining / MATCH_DURATION_MS;',
    'const holdFrac = 1 - FOG_HOLD_MS / MATCH_DURATION_MS;',
  ];
  check('KNOWN-BAD CONTROL: it does NOT fire on the correct form, or on a 6000 that is not a ring (a detector that flags everything flags nothing)',
    clean.every((l) => verdictOf(l, 0) === null),
    clean.map((l, i) => `${i}:${verdictOf(l, 0)}`).join(' '));
  // 🚨 THE COMMENT EXEMPTION IS ITSELF A HOLE, SO IT GETS ITS OWN KNOWN-BAD: an executable
  // line must still fire even when the file is full of exempt prose. Without this row the
  // exemption above could be widened to "everything" and every check here would stay green.
  const executable = 'const derivedMaxSafe = Math.round(HALF_DIAG / (1 - FOG_FIRST_CONTACT_MS / MATCH_DURATION_MS));';
  const commented = ` * ${executable}`;
  check('KNOWN-BAD: the comment exemption is line-scoped — the SAME text fires as code and is exempt as prose',
    verdictOf(executable, 0) === 'hit' && verdictOf(commented, 0) === 'prose',
    `code -> ${verdictOf(executable, 0)} · prose -> ${verdictOf(commented, 0)}`);
  // 🚨 AND SO DOES THE OLD-TREE ARM. The same function four ways: as `bm_lab` ships it (exempt),
  // with the feature test deleted, with it pushed out of the window, and with it demoted to a
  // comment — each of the last three must turn the SAME return line back into a hit.
  const arm = (guard, filler = 0) => [
    'function openingRadiusFor(halfDiag) {',
    guard,
    ...Array.from({ length: filler }, (_, k) => `  const pad${k} = ${k};`),
    '  return Math.round(halfDiag / (1 - 6000 / MATCH_DURATION_MS));',
    '}',
  ].join('\n');
  const GUARD = "  if (typeof RULES.fogOpeningRadiusFor === 'function') return RULES.fogOpeningRadiusFor(halfDiag);";
  const at = (src) => src.split('\n').findIndex((l) => l.includes('1 - 6000'));
  const cases = [
    ['as shipped (bm_lab / bm_ffa / cn_reveal / fs_sched_share)', arm(GUARD), 'old-tree-arm'],
    ['feature test DELETED', arm('  // (no feature test)'), 'hit'],
    [`feature test ${OLD_ARM_WINDOW + 1} lines above (out of the window)`, arm(GUARD, OLD_ARM_WINDOW), 'hit'],
    ['feature test demoted to a COMMENT', arm(`  // ${GUARD.trim()}`), 'hit'],
  ];
  for (const [what, src, want] of cases) {
    const got = verdictOf(src, at(src));
    check(`KNOWN-BAD: the old-tree-arm exemption — ${what} → ${want}`, got === want, `got ${got}`);
  }
  const kb = (gap) => ['// KNOWN-BAD: the superseded ring, kept to prove the new one separates', ...Array.from({ length: gap }, () => 'const x = 1;'),
    'const superseded = Math.round(halfDiag / (1 - 6000 / MATCH_DURATION_MS));'].join('\n');
  check('KNOWN-BAD: the KNOWN-BAD marker exempts within its window and NOT beyond it',
    verdictOf(kb(1), 2) === 'known-bad' && verdictOf(kb(KNOWN_BAD_WINDOW), KNOWN_BAD_WINDOW + 1) === 'hit',
    `gap 1 -> ${verdictOf(kb(1), 2)} · gap ${KNOWN_BAD_WINDOW} -> ${verdictOf(kb(KNOWN_BAD_WINDOW), KNOWN_BAD_WINDOW + 1)}`);
}

console.log(`\n${failures ? `${failures} FAILED` : 'all rows passed'}`);
process.exit(failures ? 1 : 0);
