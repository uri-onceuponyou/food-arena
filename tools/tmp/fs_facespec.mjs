#!/usr/bin/env node
/**
 * fs_facespec — the guard on `CharacterDef.face`, the cast's FACE BRIEF.
 *
 *   node tools/tmp/fs_facespec.mjs             # 34 live assertions over the 11 shipped specs
 *   node tools/tmp/fs_facespec.mjs --selftest  # 22 known-bad-input + mutation proofs. RUN THIS FIRST.
 *   node tools/tmp/fs_facespec.mjs --json      # machine-readable
 *
 * ⚠️ IT EARNED ITS KEEP ON ITS FIRST LIVE RUN, ON THE SPECS ITS OWN AUTHOR HAD JUST
 * WRITTEN — 2 of 11 failed. `donut` never contained the word "open" (the single most
 * important instruction in the whole pass, absent from the character whose eyes Uri
 * ranked second-best), and `egg` — THE CAST REFERENCE — had no offset directive because
 * `egg.ts:1040` sets `pupil.position.x = 0`. The reference face stares dead ahead and
 * nobody had noticed. Neither would have been caught by reading the prose back.
 *
 * ─── WHY THIS EXISTS ────────────────────────────────────────────────────────
 * `rules.ts`'s one-line `face:` field WAS the cast's face defect. Uri ranked seven
 * characters without seeing any code and his ranking matched this field exactly: every
 * character he rated poorly was specified with CLOSED eyes or no eye spec at all, and
 * the one he rated best — egg — was the only one specified "open eyes with highlights".
 * Eleven agents implemented their line faithfully. See DECISIONS §37–§42.
 *
 * The rewrite that fixed it is PROSE, and prose rots. Nothing in `tsc`, `sim.test.mjs`
 * or `gatecount` reads this field — it is a build brief consumed by humans and agents —
 * so a future edit can quietly drop "sclera" from a spec and every gate in the repo
 * still passes. That is precisely the shape of the original bug: **every gate here
 * measures conformance, not whether the target was worth hitting.**
 *
 * ─── WHAT IT ASSERTS ────────────────────────────────────────────────────────
 * The four-element face standard, per character:
 *   1. a white SCLERA        (the brightest value on the character)
 *   2. a dark PUPIL, OFFSET  (a centred pupil reads dead)
 *   3. an explicit CATCHLIGHT
 *   4. an OPEN eye           (the whole finding)
 * plus a MOUTH with an INTERIOR value step (a throat), because "no mouth" is a defect
 * Uri rejected twice by name (taco, soup).
 *
 * ─── AND WHY THE CHECKS ARE ALL POSITIVE ────────────────────────────────────
 * ⚠️ A banned-phrase check was tried first and is WRONG here, which is worth recording.
 * The new specs deliberately NAME the defect they are removing — waterbottle's reads
 * "EYES ON THE BOTTLE, NEVER FLOATING ABOVE THE CAP", pizza's reads "The closed eyes
 * are the entirety of Uri's 'face is terrible'". A substring ban on "floating above" or
 * "closed" fails the corrected spec and passes a spec that never mentions the defect at
 * all — **it scores exactly backwards.** So every assertion here is a REQUIRED token,
 * and the negative half of the job is carried by the known-bad-input proof instead: all
 * eleven ORIGINAL strings are run through the same checks and all eleven must FAIL.
 *
 * ─── THE KNOWN-BAD-INPUT AND TAUTOLOGY PROOFS (`--selftest`) ────────────────
 * `docs/LESSONS.md` §13: a guard has two ways to be worthless. It can fail to fail on
 * the bug, or it can be phrased so that no implementation could ever fail it. Both are
 * closed here:
 *   · KNOWN-BAD  — the 11 pre-rewrite strings, verbatim, must every one be REFUSED.
 *   · MUTATION   — deleting any single required token from a passing spec must flip it
 *                  to a refusal. If a check cannot be made to fail, it is a comment
 *                  with a tick next to it.
 * `--selftest` exits non-zero if any proof does not hold, and a missing anchor THROWS
 * rather than skipping — a skipped mutation turns every refusal into a pass.
 */

import { CHARACTERS, CHARACTER_IDS } from '../../src/game/rules.ts';

const JSON_OUT = process.argv.includes('--json');
const SELFTEST = process.argv.includes('--selftest');

// ── The standard, as machine-checkable requirements ──────────────────────────
// Each is [label, /regex/i, why]. The regexes are deliberately loose on wording and
// strict on CONCEPT: an author may write "white sclera ovals" or "a real white sclera
// behind the pupil", but they may not omit the sclera.
const REQUIREMENTS = [
  ['sclera',    /sclera/i,
   'a white sclera with AREA — measured, 0% of our eye pixels clear 0.85 luma against the reference plates\' 31.1% / 34.1%'],
  ['pupil',     /pupil/i,
   'a dark pupil built as real geometry, not a painted dot'],
  ['offset',    /offset|gaze/i,
   'the pupil must be OFFSET from centre — a centred pupil reads dead even when everything else is right'],
  ['catchlight',/catchlight|glint|highlight/i,
   'an explicit catchlight MESH, not a specular hoped for from the material'],
  ['open',      /\bopen\b/i,
   'OPEN eyes. Every character Uri rated poorly was specified closed or unspecified; the one he rated best was the only one specified open'],
  ['mouth',     /\bmouth\b/i,
   'a mouth at all — "no mouth" was rejected by name on taco and on soup'],
  ['interior',  /interior|throat/i,
   'the mouth needs an INTERIOR value step so it reads as an opening rather than a painted curve'],
];

/** Every requirement a spec string fails. Empty array === conforms. */
function violations(spec) {
  if (typeof spec !== 'string') return REQUIREMENTS.map(([label]) => label);
  return REQUIREMENTS.filter(([, re]) => !re.test(spec)).map(([label]) => label);
}

// ─────────────────────────────────────────────────────────────────────────────
// THE KNOWN-BAD INPUT: the eleven specs exactly as they read before the rewrite.
// Copied from `436b477`'s tree. These are not illustrative — they are the strings
// that produced the faces Uri rejected, and this guard is worthless unless it
// refuses every one of them.
// ─────────────────────────────────────────────────────────────────────────────
const PRE_REWRITE = {
  hamburger:   'Closed happy eyes, small smile. Stacked bun/patty/lettuce/tomato silhouette.',
  donut:       'Crooked smile, sprinkles across a pink glaze torus.',
  taco:        'Trapezoid shell with a jagged crimped top edge; face floats completely outside the shell, to the side.',
  burrito:     'White wrap, stands upright, toppings visible at the open end.',
  egg:         'Open eyes with highlights, straight neutral mouth.',
  lollipop:    'Eyes on the stick, mouth on the candy. Concentric red/white swirl disc.',
  pizza:       'Closed eyes, smiling. Triangular slice with pepperoni and a crust base.',
  sushi:       'Wide eyes, puckered lips. Rice cylinder banded with nori, salmon centre.',
  soup:        'Gray steam-coloured eyes, no mouth. Wide bowl with rising steam.',
  waterbottle: 'Eyes floating above the cap, big smile. Translucent blue bottle with a darker cap.',
  hotdog:      'Sleepy half-closed eyes, small smile. Sausage in a bun with a mustard zigzag.',
};

// ⚠️ NOTE ON `egg` AND `burrito`, because they are the two that make this guard honest.
//
//   · egg's old string is the ONE that passes three of seven checks (open / highlights /
//     mouth). It was the best face in the cast and Uri said so. It still FAILS on sclera,
//     pupil, offset and interior — which is the measured finding: even egg has a
//     catchlight where a sclera belongs. A guard that passed egg's old line would be
//     asserting that the cast's ceiling is already the target, and it is not.
//   · burrito's old string contains the word "open" ("the open end") and nothing else.
//     A one-token check would have PASSED the only character in the cast with no face
//     spec at all. That is why there are seven requirements and not one.

let failures = 0;
const say = (ok, text) => {
  if (!ok) failures++;
  if (!JSON_OUT) console.log(`  ${ok ? 'ok  ' : 'FAIL'} - ${text}`);
};

// ─────────────────────────────────────────────────────────────────────────────
if (SELFTEST) {
  let n = 0;
  if (!JSON_OUT) console.log('\nfs_facespec --selftest — known-bad-input and tautology proofs\n');

  // ── PROOF 1: the eleven pre-rewrite strings must every one be REFUSED ──────
  if (!JSON_OUT) console.log('  KNOWN-BAD — the specs that produced the faces Uri rejected');
  for (const id of CHARACTER_IDS) {
    const bad = PRE_REWRITE[id];
    // A missing anchor THROWS rather than skipping. A skipped mutation turns every
    // refusal into a pass — the `driver_guard` shape whose coverage shrank when a bug
    // was fixed. See LESSONS §13.
    if (bad === undefined) throw new Error(`fs_facespec: no pre-rewrite anchor for '${id}' — refusing to skip it`);
    const v = violations(bad);
    n++;
    say(v.length > 0, `pre-rewrite '${id}' is REFUSED (missing: ${v.join(', ') || 'NOTHING — the guard is blind'})`);
  }

  // ── PROOF 2: MUTATION. Each requirement must be individually falsifiable ──
  // Ask of every assertion: what implementation would FAIL this? If the answer cannot
  // be produced mechanically, the assertion is a comment with a tick next to it.
  if (!JSON_OUT) console.log('\n  MUTATION — deleting one required token must flip a PASS to a REFUSAL');
  for (const [label, re] of REQUIREMENTS) {
    // Build a minimal string that satisfies everything, then strike out this one token.
    const full = 'Open eyes: white sclera, dark pupil offset for gaze, a catchlight. Mouth with a dark interior throat.';
    if (violations(full).length !== 0) {
      throw new Error(`fs_facespec: the mutation base does not itself pass (${violations(full).join(', ')}) — the harness is broken, not the spec`);
    }
    const mutated = full.replace(new RegExp(re.source, 'gi'), 'xxxx');
    const v = violations(mutated);
    n++;
    say(v.includes(label), `striking '${label}' is DETECTED (violations: ${v.join(', ') || 'none — this check cannot fail'})`);
  }

  // ── PROOF 3: the unmutated base must reproduce a clean pass ───────────────
  // When a harness rebuilds an instrument to break it, the UNMUTATED rebuild must be
  // asserted to reproduce the original exactly, or a broken harness reads as a pass.
  n++;
  say(violations('Open eyes: white sclera, dark pupil offset for gaze, a catchlight. Mouth with a dark interior throat.').length === 0,
      'the unmutated base still PASSES (the harness did not break the instrument)');

  // ── PROOF 4: a non-string spec is refused, not crashed on ─────────────────
  n++;
  say(violations(undefined).length === REQUIREMENTS.length, 'a missing spec is refused on every requirement rather than throwing');
  n++;
  say(violations('').length === REQUIREMENTS.length, 'an empty spec is refused on every requirement');

  // ── PROOF 5: the guard is not satisfiable by the word "open" alone ────────
  // Burrito's old string passed exactly this way and had no face spec whatsoever.
  n++;
  say(violations('White wrap, stands upright, toppings visible at the open end.').length === REQUIREMENTS.length - 1,
      "burrito's old line is refused on 6 of 7 — the lone 'open' in 'the open end' is not an eye spec");

  if (!JSON_OUT) console.log(`\n  ${n} selftest assertions, ${failures} failed\n`);
  if (JSON_OUT) console.log(JSON.stringify({ mode: 'selftest', assertions: n, failures }, null, 2));
  process.exit(failures ? 1 : 0);
}

// ─────────────────────────────────────────────────────────────────────────────
// LIVE: the eleven shipped specs
// ─────────────────────────────────────────────────────────────────────────────
if (!JSON_OUT) console.log('\nfs_facespec — the eleven shipped face specs against the four-element standard\n');

const rows = [];
let n = 0;

n++;
say(CHARACTER_IDS.length === 11, `the roster is 11 characters (got ${CHARACTER_IDS.length})`);

for (const id of CHARACTER_IDS) {
  const spec = CHARACTERS[id]?.face;
  const v = violations(spec);
  rows.push({ id, chars: typeof spec === 'string' ? spec.length : 0, violations: v });
  n++;
  say(v.length === 0, `${id.padEnd(12)} conforms${v.length ? ` — MISSING: ${v.join(', ')}` : ''}`);
}

// A spec long enough to be a brief. The pre-rewrite strings ran 39–104 chars — a single
// clause each, which is how eleven agents each read a different thing into them. This is
// a floor on SPECIFICITY, not a style rule, and it is set well under the shortest new
// spec so it flags a reversion rather than policing prose.
if (!JSON_OUT) console.log('');
for (const r of rows) {
  n++;
  say(r.chars >= 300, `${r.id.padEnd(12)} is a brief, not a clause (${r.chars} chars, floor 300)`);
}

// The pre-rewrite wording must survive somewhere readable. CLAUDE.md: "when an assertion
// encodes a rule that has been reversed, change it and keep the old wording above it with
// the reason." The rewrite is only auditable if the thing it replaced is still on the page.
const src = await (await import('node:fs/promises')).readFile(new URL('../../src/game/rules.ts', import.meta.url), 'utf8');
if (!JSON_OUT) console.log('');
for (const id of CHARACTER_IDS) {
  n++;
  const old = PRE_REWRITE[id];
  // Compare on collapsed whitespace: the kept wording is wrapped across comment lines.
  const flat = src.replace(/\s*\n\s*\/\/\s*/g, ' ').replace(/\s+/g, ' ');
  say(flat.includes(old), `${id.padEnd(12)} keeps its pre-rewrite wording in the file, with the reason`);
}

if (!JSON_OUT) {
  console.log(`\n  ${n} assertions, ${failures} failed`);
  console.log(`  spec lengths: ${rows.map((r) => r.chars).join(' ')}\n`);
}
if (JSON_OUT) console.log(JSON.stringify({ mode: 'live', assertions: n, failures, rows }, null, 2));
process.exit(failures ? 1 : 0);
