#!/usr/bin/env node
/**
 * Q1_PUBLIC — the committable projection of the blind-critic ledger.
 *
 * ── WHY THIS EXISTS: TWO DOCUMENTED RULES POINTED IN OPPOSITE DIRECTIONS ───────
 *
 * `q1_ledger.mjs`'s header says the ledger lives under `tools/tmp/` rather than
 * `shots/` precisely so a weeks-long critic round **cannot vanish on a clean
 * checkout**. But every row carries a `referenceNote` — a critic's prose
 * description of a third-party reference plate — and `CLAUDE.md`'s security block
 * says *"prose derived from viewing a plate is derived from it"*, in a **PUBLIC**
 * repo. Committing the ledger satisfies durability and breaches security;
 * gitignoring it satisfies security and loses the round.
 *
 * Neither rule bends, so the RECORD is split instead. This writes
 * `q1_public.jsonl`: every score, every floor input, every sheet sha — and **no
 * `referenceNote` text at all**. The reference SCORE survives, because a number
 * discloses nothing and it is the control that makes the whole instrument
 * credible: rule 7 discards any round whose reference lands outside 7-9, and that
 * verdict has to be reproducible from the committed record.
 *
 * ── 🚨 AN ALLOWLIST, NOT A DENYLIST, AND THE REASON IS THE WHOLE POINT ─────────
 *
 * The obvious guard is a denylist of third-party proper nouns. **That would mean
 * writing those exact names into a file in a public repo** — the guard would
 * commit the breach it exists to prevent, permanently, in git history. This is
 * the same shape as `CLAUDE.md`'s note that a scrub was the proportionate remedy
 * *because nothing sensitive shipped*; a denylist ships it by construction.
 *
 * So: any Capitalised token in a note must appear in `ALLOWED`, which is built
 * from **this game's own vocabulary** — the character ids in `rules.ts` plus a
 * short list of sentence-start and technical words. Anything else and the export
 * REFUSES rather than filtering, because a filter that silently drops a word
 * leaves you unable to tell a clean run from a redacted one.
 *
 * ⚠️ This bounds ACCIDENTS, not intent. It cannot read meaning: a note saying
 * "the blue one with the hat" discloses without capitalising anything. The rule
 * `Describe the compositional ROLE, never the artwork` is still a thing humans and
 * agents must follow — this only closes the path where a proper noun rides along
 * unnoticed, which is exactly how the 2026-08-21 row got there.
 *
 * Usage:
 *   node tools/tmp/q1_public.mjs              # write the projection, refuse on a hit
 *   node tools/tmp/q1_public.mjs --check      # verify the committed file is current
 *   node tools/tmp/q1_public.mjs --selftest   # 8 arms, incl. three known-bads
 */

import { readFileSync, writeFileSync, existsSync } from 'node:fs';
import { resolve } from 'node:path';
import { fileURLToPath } from 'node:url';

const REPO = resolve(new URL('../..', import.meta.url).pathname);
const RAW = resolve(REPO, 'tools/tmp/q1_scores.jsonl');
const OUT = resolve(REPO, 'tools/tmp/q1_public.jsonl');
const SELF = 'q1_public.mjs';

/** Character ids, read from `rules.ts` — never retyped. The roster is the vocabulary. */
function rosterWords() {
  const src = readFileSync(resolve(REPO, 'src/game/rules.ts'), 'utf8');
  const ids = [...src.matchAll(/^ {2}(\w+): (?:\w+\()?\{$/gm)].map((m) => m[1]);
  // Same accept-both-spellings pattern as `pj_probe`: `9cb34ab` changed `soup: {`
  // to `soup: defineCharacter({` and three tools silently matched nothing for a
  // week. Assert non-empty rather than trusting the regex.
  if (ids.length === 0) {
    throw new Error(`${SELF}: parsed ZERO character ids out of rules.ts. The roster spelling ` +
      'has changed under this regex. Refusing: an empty allowlist would reject every note, ' +
      'and an empty DENYlist would accept every one — this one fails safe, but fix the regex.');
  }
  return ids.map((s) => s[0].toUpperCase() + s.slice(1));
}

/**
 * Words a critic or operator legitimately capitalises that disclose nothing.
 *
 * ⚠️ **PRICED BEFORE IT WAS ACCEPTED, because a guard that cries wolf gets switched
 * off.** `gatecount` measured the adjacent idea — matching bare tool names — at **16
 * false positives for 1 true positive** on this repo's documents and rejected it for
 * exactly that. The first run of THIS scan over the real 18-row ledger fired **13
 * times, and all 13 were ours**: `CONTROL`, `SKIPPED`, `DRIFT`, `MUST`, `Controls`,
 * `Separation`, `Reversible`, `Biggest`, `Panel`, `Fresh`, `MOST OF FRAME IS EMPTY
 * FLOOR`. **Zero true positives.** Shipping it at that rate would have made the
 * refusal noise and the next agent would have deleted the arm.
 */
const NEUTRAL = [
  'A', 'An', 'The', 'This', 'That', 'These', 'Those', 'It', 'Its', 'There',
  'Both', 'Each', 'Every', 'No', 'Not', 'Our', 'Ours', 'B', 'I',
  'HP', 'UI', 'HUD', 'VFX', 'FX', 'AI', 'RGB', 'HSL',
  // Operator + critic vocabulary observed in the real corpus, all ours.
  'Controls', 'Separation', 'Reversible', 'Biggest', 'Panel', 'Fresh', 'Floor',
  'Frame', 'Score', 'Reference', 'Drift', 'Control', 'Round', 'Sheet',
];

/**
 * ALL-CAPS tokens are exempt STRUCTURALLY, not by enumeration.
 *
 * In this corpus every all-caps run is emphasis or an operator marker (`CONTROL`,
 * `SKIPPED`, `MUST`, `DRIFT`), while the class this scan exists to catch —
 * third-party character, costume and prop names — is **Titlecase**. Exempting the
 * shape rather than listing the words is what keeps the arm from needing a new
 * entry every time somebody shouts in a note, which is how an exemption list
 * becomes a rubber stamp.
 *
 * ⚠️ The cost is real and stated: a third-party name WRITTEN IN CAPS would pass.
 * That is accepted — this bounds accidents, and an accidental disclosure does not
 * arrive in caps. `AGENT-BRIEF`'s rule (describe the ROLE, never the artwork) is
 * still the actual protection; §D's known-bad guards this arm's half of it.
 */
const isShout = (t) => /^[A-Z][A-Z'’-]*$/.test(t);

function allowed() {
  return new Set([...NEUTRAL, ...rosterWords()].map((w) => w.toLowerCase()));
}

/** Capitalised tokens in `text` that are not in `ok`. Mid-sentence only is NOT assumed. */
export function foreignProperNouns(text, ok) {
  if (!text) return [];
  const toks = String(text).match(/\b[A-Z][A-Za-z'’-]{1,}\b/g) ?? [];
  return [...new Set(toks.filter((t) => !isShout(t) && !ok.has(t.toLowerCase())))];
}

/** The fields that may be published. `referenceNote` is absent BY CONSTRUCTION, not filtered. */
const PUBLIC_FIELDS = ['id', 'arm', 'element', 'at', 'ours', 'reference', 'panelOurs', 'oursNote', 'note'];

function project(rows) {
  const ok = allowed();
  const faults = [];
  const out = rows.map((r) => {
    for (const field of ['oursNote', 'note']) {
      const bad = foreignProperNouns(r[field], ok);
      if (bad.length) faults.push(`${r.id}.${field}: unrecognised capitalised token(s) ${JSON.stringify(bad)}`);
    }
    const p = {};
    for (const f of PUBLIC_FIELDS) if (r[f] !== undefined) p[f] = r[f];
    return p;
  });
  return { out, faults };
}

function readRows(path) {
  const rows = readFileSync(path, 'utf8').split('\n').filter((l) => l.trim()).map((l) => JSON.parse(l));
  // Rule 6: assert the set is NON-EMPTY before asserting anything over it. An empty
  // ledger would export cleanly and prove nothing — `[].every()` returns true, and
  // that vacuity has fired at least seven times in this repo.
  if (rows.length === 0) throw new Error(`${SELF}: ${path} has ZERO rows. Refusing to export an empty projection.`);
  return rows;
}

// ─────────────────────────────────────────────────────────────────────────────
/**
 * 🚨 IS_MAIN GUARD — MISSING until 2026-08-21, in a file that EXPORTS.
 *
 * `foreignProperNouns` is exported so the scan can be reused and tested rather than
 * copied — the right instinct, and without this line it silently makes the whole CLI
 * path below run at module scope. Measured, not theorised: `await import()` of this
 * file from a one-liner PRINTED `wrote 23 rows to q1_public.jsonl` and rewrote the
 * committed projection. The refusal path is worse — a ledger carrying an unrecognised
 * capitalised token would `process.exit(1)` inside its importer, which reads as the
 * IMPORTING tool failing. `AGENT-BRIEF` §3 lists three tools that shipped with this
 * same defect (importing `snapsweep.mjs` printed a live sweep; `da_census.mjs` fell
 * through into `runCapture`); this is the fourth, found by an agent that imported the
 * file to read its allowlist while scoring a blind panel.
 *
 * Shown able to FAIL before it was believed — rule 6 — in BOTH directions:
 *   node -e "await import('<abs>')"                      -> no output, no write
 *   node -e "process.argv[1]='<abs>'; await import(...)"  -> writes, exactly as the
 *                                                           unguarded file did
 * The second arm defeats the guard by construction, so it reproduces the bug and proves
 * the first arm is measuring the guard rather than measuring nothing.
 *
 * ⚠️ NOT registered as a `--selftest` arm. The arm COUNT is published in
 * `docs/TOOLS.md`'s gate table and `gatecount` enforces it; that table is executable
 * and outside this agent's owned file set, so adding an arm here would break the gate
 * it cannot legally update. Routed to the orchestrator instead.
 *
 * Block form copied from `bm_ab.mjs`: guarding without re-indenting keeps the diff to
 * the guard itself instead of burying it in a whitespace change.
 */
const IS_MAIN = process.argv[1] !== undefined
  && resolve(process.argv[1]) === resolve(fileURLToPath(import.meta.url));

if (!IS_MAIN) { /* imported for `foreignProperNouns` only — the CLI path must not run */ }
else {
const argv = process.argv.slice(2);

if (argv.includes('--selftest')) {
  const ok = allowed();
  let pass = 0, fail = 0;
  const t = (name, cond) => { if (cond) { pass++; console.log(`  PASS  ${name}`); } else { fail++; console.log(`  FAIL  ${name}`); } };

  t('A roster parsed non-empty', rosterWords().length > 0);
  t('B our own character names are allowed', foreignProperNouns('Hamburger looks flat', ok).length === 0);
  t('C sentence-start words are allowed', foreignProperNouns('The frame reads well. Both fighters are clear.', ok).length === 0);
  // KNOWN-BAD 1: an invented third-party-shaped proper noun must be REFUSED. The
  // fixture is deliberately a made-up word — putting a real one here would be the
  // denylist mistake this file exists to avoid.
  t('D KNOWN-BAD an unknown Titlecase proper noun is caught', foreignProperNouns('the Zarblax plate is brighter', ok).length === 1);
  // G. The ALL-CAPS exemption must be REAL (an operator shout passes) and BOUNDED
  //    (it must not swallow the Titlecase class §D guards). Both directions, because
  //    an exemption asserted in only one direction is indistinguishable from a hole.
  t('G ALL-CAPS operator vocabulary is exempt', foreignProperNouns('CONTROL arm SKIPPED, DRIFT within floor', ok).length === 0);
  t('G2 the exemption does NOT swallow Titlecase', foreignProperNouns('CONTROL says the Zarblax is bright', ok).length === 1);
  // KNOWN-BAD 2: the projection must DROP referenceNote by construction, not filter it.
  const { out } = project([{ id: 'x', ours: 4, reference: 8, referenceNote: 'SHOULD NEVER APPEAR', oursNote: 'flat' }]);
  t('E KNOWN-BAD referenceNote is absent from the projection', !('referenceNote' in out[0]));
  t('F the reference SCORE survives (it is the 7-9 control)', out[0].reference === 8);

  console.log(`\n  ${pass} passed, ${fail} failed`);
  process.exit(fail ? 1 : 0);
}

if (!existsSync(RAW)) {
  console.error(`${SELF}: ${RAW} not found. It is gitignored by design — this projection is the committed half.`);
  process.exit(2);
}

const rows = readRows(RAW);
const { out, faults } = project(rows);

if (faults.length) {
  console.error(`${SELF}: REFUSING to export — ${faults.length} note(s) carry an unrecognised capitalised token:\n`);
  for (const f of faults) console.error('  ' + f);
  console.error('\nRewrite the note to describe the compositional ROLE, never the artwork.');
  console.error('If the token is legitimate game vocabulary, add it to NEUTRAL — never add a third-party name.');
  process.exit(1);
}

const text = out.map((r) => JSON.stringify(r)).join('\n') + '\n';

if (argv.includes('--check')) {
  const cur = existsSync(OUT) ? readFileSync(OUT, 'utf8') : '';
  if (cur !== text) {
    console.error(`${SELF}: ${OUT} is STALE — ${rows.length} raw rows do not match it. Re-run without --check.`);
    process.exit(1);
  }
  console.log(`${SELF}: q1_public.jsonl is current (${out.length} rows).`);
  process.exit(0);
}

writeFileSync(OUT, text);
console.log(`${SELF}: wrote ${out.length} rows to q1_public.jsonl — scores kept, referenceNote absent by construction.`);
}
