#!/usr/bin/env node
/**
 * ir_ladder_anchors — WHICH RUNGS OF `ai_ladder.mjs` ARE REACHABLE, AGAINST WHICH TREE.
 *
 *   node tools/tmp/ir_ladder_anchors.mjs                 # the working tree
 *   node tools/tmp/ir_ladder_anchors.mjs --ref HEAD      # any git ref
 *   node tools/tmp/ir_ladder_anchors.mjs --ref 4105116   # the tree the ladder was built on
 *   node tools/tmp/ir_ladder_anchors.mjs --selftest
 *
 * ─── WHY THIS EXISTS ────────────────────────────────────────────────────────
 * `tools/tmp/ai_ladder.mjs` reconstructs V0–V5 of `src/game/ai.ts` by TEXTUAL edit, and
 * every rung's number is the price of one fix — numbers `docs/DECISIONS-FOR-URI.md` §15
 * rests on. It refuses to guess when an anchor does not match exactly once, which is
 * correct and is why it has produced no wrong answer.
 *
 * But it refuses on the FIRST failure and says nothing about the other twelve, so
 * "ai_ladder is broken" has been the whole diagnosis for days. This prints the full
 * picture in ~20 ms: every anchor, its match count, and — the part that decides whether a
 * rung may be re-anchored — whether the anchor is STALE-BUT-EQUIVALENT (the same code,
 * moved or renamed by a mechanical refactor) or STALE-AND-CHANGED (the code it selected
 * no longer exists as such).
 *
 * 🚨 IT DELIBERATELY REPAIRS NOTHING. Mis-editing a rung silently re-prices a decision
 * Uri has already taken, and a wrong price is indistinguishable from a right one in the
 * output. An unreachable rung is much better than a rung that quietly measures something
 * else. This tool exists so that judgement is made on a table instead of on a guess.
 */
import { readFileSync } from 'node:fs';
import { execFileSync } from 'node:child_process';
import { resolve } from 'node:path';
import { pathToFileURL } from 'node:url';

const ROOT = resolve(new URL('../..', import.meta.url).pathname);
const argv = process.argv.slice(2);
const get = (k, d) => (argv.includes(k) ? argv[argv.indexOf(k) + 1] : d);

function source(ref) {
  if (!ref) return readFileSync(`${ROOT}/src/game/ai.ts`, 'utf8');
  return execFileSync('git', ['show', `${ref}:src/game/ai.ts`], { cwd: ROOT, encoding: 'utf8', maxBuffer: 8e6 });
}

/**
 * Every anchor `ai_ladder.mjs` applies, in the order it applies them, with the RUNG it
 * belongs to and a `probe` — a shorter, refactor-tolerant pattern for the same code. When
 * the anchor misses and the probe hits, the code still exists and the anchor is merely
 * stale; when both miss, the code is gone and the rung must stay broken.
 *
 * ⚠️ The probes are REGEXES ON PURPOSE and they are looser than the anchors. A probe hit
 * is evidence that re-anchoring is POSSIBLE. It is not evidence that a given replacement
 * is CORRECT, and nothing here should be read as licence to write one.
 */
const FLEE_AIM = '    if (hasBearing) enemy.facing = { x: -adx / adist, y: -ady / adist };\n';
const FLEE_AIM_ABSENT = `    // ⚠️ NOTHING WRITES \`facing\` HERE ANY MORE. A line that pointed it directly away from
    // the player used to sit on exactly this spot, and \`attemptAttack\` below fired along
    // it. Aim is set once, at the player, in the facing block above — read it before
    // re-introducing anything that turns a retreating fighter's aim with its feet.
`;

export const ANCHORS = [
  { rung: 'V3', label: 'flee aims away again',
    anchor: FLEE_AIM_ABSENT,
    probe: /NOTHING WRITES `facing` HERE ANY MORE/, appliesTo: 'shipped',
    note: 'the anchor is a COMMENT. It still matches — but the text it inserts writes `enemy.facing`, and `enemy` is not a binding in the refactored `stepAI`. A matching anchor is not a working rung.' },
  { rung: 'V5', label: 'flee fires or moves',
    anchor: `  if (fleeing) {\n${FLEE_AIM_ABSENT}    if (!rooted) {`,
    probe: /if \(fleeing\) \{[\s\S]{0,600}?if \(!rooted\) \{/, appliesTo: 'shipped',
    note: 'the flee branch head' },
  { rung: 'V5', label: 'the fire-and-move shot removed',
    anchor: "    const shotIndex = healIndex ?? pickWeapon(state, adist, ALLOW_OFFENSIVE, rankPressValue);\n    if (shotIndex !== null) attemptAttack(state, 'enemy', shotIndex, events);\n",
    probe: /const shotIndex = healIndex \?\?[\s\S]{0,200}?attemptAttack\(state, \w+, shotIndex, events\);/, appliesTo: 'shipped',
    note: 'THREE independent drifts on one line: `pickWeapon` gained a `self` parameter, the concealment pass wrapped it in `(visible ? … : null)`, and the N-fighter refactor replaced the literal \'enemy\'' },
  { rung: 'V2', label: 'ranged-only defs',
    anchor: 'const rankPressValue: WeaponRank',
    probe: /const rankPressValue: WeaponRank/, appliesTo: 'shipped',
    note: 'an insertion point, not a selection — it names a declaration that still exists' },
  { rung: 'V2', label: 'flee picks ranged only',
    anchor: 'healIndex ?? pickWeapon(state, adist, ALLOW_OFFENSIVE, rankPressValue);\n    if (shotIndex !== null)',
    probe: /healIndex \?\? \(?visible \? pickWeapon\(state, \w+, adist, ALLOW_OFFENSIVE, rankPressValue\)/, appliesTo: 'shipped',
    note: 'same three drifts as the V5 shot line' },
  { rung: 'V1', label: 'rank by authored damage (insertion point)',
    anchor: 'export function pressValue(w: Weapon, adist: number): number {',
    probe: /export function pressValue\(w: Weapon, adist: number\): number \{/, appliesTo: 'shipped',
    note: 'the estimator signature is untouched by the refactor' },
  { rung: 'V1', label: 'rank by authored damage (the swap)',
    anchor: 'const rankPressValue: WeaponRank = (_state, w, _index, adist) => pressValue(w, adist);',
    probe: /const rankPressValue: WeaponRank = \(_state, _?\w+,? ?w, _index, adist\) => pressValue\(w, adist\);/, appliesTo: 'shipped',
    note: '`WeaponRank` gained a `self` parameter. ⚠️ THIS ONE IS APPLIED WITH `.replace`, NOT `edit` — see the finding below' },
  { rung: 'V0', label: 'facing re-gated on stun',
    anchor: '  if (hasBearing) {\n    enemy.facing = { x: adx / adist, y: ady / adist };\n  }',
    probe: /if \(hasBearing\) \{\s*\n\s*\w+\.facing = \{ x: adx \/ adist, y: ady \/ adist \};/, appliesTo: 'shipped',
    note: '`enemy` -> `self`' },
  { rung: 'V0', label: 'escape re-gated on stun',
    anchor: 'const escaping = urgent && !rooted;',
    probe: /const escaping = urgent && !rooted;/, appliesTo: 'shipped',
    note: 'untouched by the refactor' },
  { rung: 'V0', label: 'flee aim back inside the movement guard',
    anchor: `${FLEE_AIM}    if (!rooted) {`,
    probe: /if \(hasBearing\) \w+\.facing = \{ x: -adx \/ adist, y: -ady \/ adist \};/, appliesTo: 'derived',
    note: 'the aim-away line was DELETED from the shipped file, so this anchor exists only in V3\'s output — it is stale only if V3 is' },
  { rung: 'V0', label: 'flee shot re-gated on stun',
    anchor: 'const shotIndex = healIndex ?? pickWeapon(state, adist, ALLOW_RANGED_ONLY, rankFirstRanged);',
    probe: /const shotIndex = healIndex \?\? pickWeapon\(state, adist, ALLOW_RANGED_ONLY/, appliesTo: 'derived',
    note: 'operates on V2\'s OUTPUT, not on the shipped file — reachable iff V2 is' },
  { rung: 'V1b', label: 'chase weapon choice un-gated only',
    anchor: 'const chosenIndex = escaping ? null :',
    probe: /const chosenIndex = escaping \? null :/, appliesTo: 'shipped',
    note: 'untouched by the refactor' },
];

/**
 * Classify every anchor against one source. Pure — `--selftest` drives it on fixtures.
 *
 * ⚠️ `appliesTo: 'derived'` rows are checked against the SHIPPED file here even though the
 * ladder applies them to a rung's OUTPUT, so an `ABSENT` on one of those is EXPECTED and
 * says nothing. They are printed rather than hidden, because a row silently excluded from
 * a table is how a coverage gap becomes invisible.
 */
export function classify(src) {
  return ANCHORS.map((a) => {
    const n = src.split(a.anchor).length - 1;
    const p = a.probe.test(src);
    // `edit()` demands EXACTLY ONE — zero and two are equally fatal.
    const verdict = n === 1 ? 'OK' : p ? 'STALE-BUT-PRESENT' : 'ABSENT';
    return { ...a, n, probeHit: p, verdict };
  });
}

/** The rows a caller holding the SHIPPED file may act on. */
export function preflight(src) {
  return classify(src).filter((r) => r.appliesTo === 'shipped' && r.verdict !== 'OK');
}

function report(src, refLabel) {
  console.log(`\nai_ladder anchors vs ${refLabel}  (${src.split('\n').length} lines)\n`);
  console.log('rung  anchor                                       against    n   probe  verdict');
  const rows = classify(src);
  for (const r of rows) {
    console.log(`${r.rung.padEnd(5)} ${r.label.slice(0, 43).padEnd(44)} ${r.appliesTo.padEnd(9)} ${String(r.n).padStart(2)}   ${r.probeHit ? 'hit ' : 'miss'}   ${r.verdict}`);
  }
  const shipped = rows.filter((r) => r.appliesTo === 'shipped');
  const broken = shipped.filter((r) => r.verdict !== 'OK');
  console.log(`\n${shipped.length - broken.length}/${shipped.length} anchors that are applied to the SHIPPED file select exactly once.`);
  console.log(`(${rows.length - shipped.length} more are applied to a RUNG'S OUTPUT, so their row above is not a verdict.)`);
  if (broken.length) {
    console.log('\nWHY EACH BROKEN ANCHOR IS BROKEN:');
    for (const r of broken) console.log(`  ${r.rung} "${r.label}"\n      ${r.note}`);
  }
  // `edit` aborts the PROCESS, so the first failure kills every rung below it too.
  // Stated explicitly, because "V2's anchors are fine" is worthless if V5 aborts first.
  const firstBad = rows.findIndex((r) => r.appliesTo === 'shipped' && r.verdict !== 'OK');
  if (firstBad >= 0) {
    console.log(`\n⚠️ \`edit()\` calls process.exit(2) on the FIRST bad anchor, so the ladder dies at`);
    console.log(`   "${rows[firstBad].label}" (${rows[firstBad].rung}) and NO rung after it is written,`);
    console.log('   whether or not its own anchor is fine. The table above is what a repaired ladder');
    console.log('   would face, not what the current one reports.');
  }
  return rows;
}

function selftest() {
  let pass = 0, fail = 0;
  const check = (name, got, want) => {
    const ok = JSON.stringify(got) === JSON.stringify(want);
    if (ok) { pass++; console.log(`  ✓ ${name.padEnd(64)} ${JSON.stringify(got)}`); }
    else { fail++; console.log(`  ✗ ${name.padEnd(64)} got ${JSON.stringify(got)}  want ${JSON.stringify(want)}`); }
  };
  console.log('\nSELFTEST — the classifier, on inputs whose answer is not in dispute\n');
  // A. Every anchor is a non-empty string and every probe a regex. A table entry that is
  //    silently undefined would classify everything as ABSENT and read as a finding.
  check('every anchor is a non-empty string', ANCHORS.every((a) => typeof a.anchor === 'string' && a.anchor.length > 4), true);
  check('every probe is a RegExp', ANCHORS.every((a) => a.probe instanceof RegExp), true);
  // B. THE KNOWN-BAD INPUT for the classifier: a source in which an anchor appears TWICE.
  //    `edit()` refuses that as loudly as zero, and a classifier that only tested
  //    "n === 0" would call it OK.
  {
    const a = ANCHORS.find((x) => x.label === 'escape re-gated on stun');
    const twice = `x\n${a.anchor}\ny\n${a.anchor}\nz`;
    check('an anchor appearing TWICE is not OK', (twice.split(a.anchor).length - 1) === 1, false);
    const once = `x\n${a.anchor}\ny`;
    check('its PAIR — the same anchor appearing once IS ok', (once.split(a.anchor).length - 1) === 1, true);
  }
  // C. The probe must be LOOSER than the anchor, or STALE-BUT-PRESENT can never be
  //    reported and the tool degrades to "broken/not broken" — which is what it replaces.
  {
    const drifted = "    const shotIndex = healIndex ?? (visible ? pickWeapon(state, self, adist, ALLOW_OFFENSIVE, rankPressValue) : null);\n    if (shotIndex !== null) attemptAttack(state, self, shotIndex, events);\n";
    const a = ANCHORS.find((x) => x.label === 'the fire-and-move shot removed');
    check('the drifted shot line does NOT match the anchor', drifted.split(a.anchor).length - 1, 0);
    check('…and DOES match the probe, so it classifies as STALE-BUT-PRESENT', a.probe.test(drifted), true);
    check('a source with neither classifies as ABSENT', a.probe.test('const shotIndex = 0;'), false);
  }
  // D. NOT TAUTOLOGICAL: run the real table over the real trees and require the verdicts
  //    to DIFFER. If every ref gave the same answer the tool would be a constant.
  {
    const now = source(null);
    const nOk = ANCHORS.filter((a) => now.split(a.anchor).length - 1 === 1).length;
    check('the working tree does NOT satisfy every anchor (else there is nothing to report)', nOk < ANCHORS.length, true);
    check('…and does satisfy at least one (else the table is pointing at the wrong file)', nOk > 0, true);
    const shipped = classify(now).filter((r) => r.appliesTo === 'shipped');
    check('the shipped-file rows are not all one verdict', new Set(shipped.map((r) => r.verdict)).size > 1, true);
  }
  // E. 🚨 THIS TABLE IS A SECOND COPY OF `ai_ladder.mjs`'s ANCHOR STRINGS, and a second
  //    copy is how six documented counts went stale in one session. It cannot be collapsed
  //    into one — `ai_ladder` needs a `from` AND a `to` and its `to` is the rung itself —
  //    so the duplication is GUARDED instead: every anchor string here must appear
  //    literally in `ai_ladder.mjs`'s source. An anchor edited there and not here would
  //    make this tool confidently report on a pattern nobody applies.
  {
    // Compared LINE BY LINE against a de-escaped `ai_ladder.mjs`, because three of the
    // anchors are COMPOSED at run time out of `FLEE_AIM`/`FLEE_AIM_ABSENT` and never exist
    // as one literal, and because `ai_ladder` writes `\'enemy\'` where the anchor holds
    // `'enemy'`. A whole-string `includes` was tried first and reported three false
    // missings, which is the same "confident wrong answer" this file exists to prevent —
    // one level up.
    const deEscape = (s) => s.replace(/\\n/g, '\n').replace(/\\'/g, "'").replace(/\\`/g, '`').replace(/\\\$\{/g, '${');
    const ladder = deEscape(readFileSync(`${ROOT}/tools/tmp/ai_ladder.mjs`, 'utf8'));
    const linesOf = (s) => s.split('\n').map((l) => l.trim()).filter((l) => l.length > 3);
    const missing = ANCHORS.flatMap((a) => linesOf(a.anchor).filter((l) => !ladder.includes(l)).map((l) => `${a.rung}:${l.slice(0, 50)}`));
    check('every anchor line in this table also appears in ai_ladder.mjs', missing, []);
    // The pair: a line that is NOT in ai_ladder must be reported, or the check above is
    // satisfied by an empty search rather than by agreement.
    check('its PAIR — a fabricated anchor line IS detected as missing',
      ladder.includes('const rankFabricated: NeverExisted = 1;'), false);
    // THE KNOWN-BAD INPUT, on the REAL file mutated in memory: someone re-anchors
    // `ai_ladder` and forgets this table. The check must catch it. A guard validated only
    // on fixtures can be satisfied by a fixture world that is itself wrong.
    const mutated = ladder.replace('const escaping = urgent && !rooted;', 'const escaping = urgent && !stunned;');
    check('the mutation actually changed the file (else the next line proves nothing)', mutated !== ladder, true);
    const missingAfter = ANCHORS.flatMap((a) => linesOf(a.anchor).filter((l) => !mutated.includes(l)));
    check('THE BUG — an anchor re-worded in ai_ladder and NOT here is CAUGHT', missingAfter.length > 0, true);
  }
  console.log(`\n${pass} passed, ${fail} failed`);
  return fail === 0 ? 0 : 1;
}

// ⚠️ THE CLI IS BEHIND THE main-MODULE TEST, AND IT WAS NOT ON THE FIRST TRY. `ai_ladder`
// imports `preflight` from here; without this guard the import printed the whole table and
// — worse — `ai_ladder --selftest` would have matched `--selftest` HERE and exited with a
// different tool's verdict. That is the second time in one session an importable probe in
// this directory did exactly this, so it is worth saying plainly: **a module that anyone
// may import must not read `process.argv` at module scope.**
if (import.meta.url === pathToFileURL(process.argv[1] ?? '').href) {
  if (argv.includes('--selftest')) process.exit(selftest());
  const ref = get('--ref', null);
  report(source(ref), ref ? `git ${ref}` : 'the WORKING TREE');
}
