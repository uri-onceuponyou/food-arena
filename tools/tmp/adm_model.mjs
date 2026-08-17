/**
 * adm_model — the ADMIN PANEL'S MODEL, validated against a registry whose every value is
 * known in advance. `DECISIONS-FOR-URI.md` §76.
 *
 * ── WHY THIS EXISTS AT ALL ──────────────────────────────────────────────────────
 *
 * `CLAUDE.md` #6: *"VALIDATE EVERY INSTRUMENT AGAINST A KNOWN-BAD INPUT BEFORE BELIEVING
 * IT… a guard that has not been shown to FAIL on the bug it guards against is not a
 * guard."* The admin panel is an instrument: it will tell Uri that moving `PLAYER_SPEED`
 * to 0.09 makes some derived number 3800. If that arrow is wrong he tunes the game by it
 * and every measurement afterwards is attributed to the wrong cause.
 *
 * So every arm below is paired with something that MUST FAIL, and the pairs are the
 * point:
 *
 *   MOVES      the transitive walk gives a different answer from the one-level API on a
 *              two-deep chain — and the SAME answer on a one-deep chain, which is the
 *              control that stops "different" from meaning "broken".
 *   HOLDS      a field nothing derives from produces ZERO consequences. A panel that
 *              invented a line per field would pass every other arm here.
 *   REFUSES    the panel's validator and the registry's boot-time `checkOverride` agree
 *              on a table of illegal values — measured by actually BOOTING a registry
 *              with each one installed, in a fresh process, and requiring the throw.
 *   NON-EMPTY  every filtered set is asserted non-empty BEFORE anything runs `every()`
 *              over it. `CLAUDE.md` #6: that exact vacuity fired three times in three
 *              files in one session, always because a fix emptied the filtered set.
 *
 * ── THE ONE THING IT CANNOT TELL YOU ────────────────────────────────────────────
 *
 * ⚠️ It runs against `src/admin/selftest.ts`'s FIXTURE, not against `rules.ts`. As of this
 * writing `rules.ts` registers nothing at all, so there is no real registry to run
 * against; when there is, this file's value is unchanged — it proves the MACHINERY, and a
 * `--live` arm below reports what the real registry currently holds so a green run here
 * can never be read as "the game's constants are wired".
 *
 * Usage:  node tools/tmp/adm_model.mjs [--live]
 */

import { fileURLToPath } from 'node:url';
import { dirname, resolve } from 'node:path';
import { spawnSync } from 'node:child_process';

const HERE = dirname(fileURLToPath(import.meta.url));
const REPO = resolve(HERE, '../..');

let checks = 0;
let failures = 0;
const lines = [];

function ok(name, cond, detail = '') {
  checks++;
  if (!cond) failures++;
  lines.push(`${cond ? '  ok  ' : ' FAIL '} ${name}${detail ? `   ${detail}` : ''}`);
}

function eq(name, actual, expected, detail = '') {
  ok(name, Object.is(actual, expected), `${detail}${detail ? ' ' : ''}got ${actual}, want ${expected}`);
}

/**
 * Assert a set is non-empty BEFORE anything filters or `every()`s over it.
 *
 * 🚨 This is not defensive noise. `[].every()` returns `true`, and this repo has three
 * documented cases in one session of a guard going green because a fix emptied the set
 * the assertion ran over. Every arm below that reduces a collection calls this first.
 */
function nonEmpty(name, arr) {
  ok(`NON-EMPTY ${name}`, arr.length > 0, `${arr.length} item(s)`);
  return arr;
}

// ─────────────────────────────────────────────────────────────────────────────

const registry = await import(resolve(REPO, 'src/game/tuning/registry.ts'));
const store = await import(resolve(REPO, 'src/game/tuning/store.ts'));
const selftest = await import(resolve(REPO, 'src/admin/selftest.ts'));
const model = await import(resolve(REPO, 'src/admin/model.ts'));

// ── the real registry, reported BEFORE the fixture pollutes it ────────────────
//
// Deliberately first, and deliberately reported rather than asserted: a green run of this
// file must never be readable as "rules.ts is wired". It is the opposite — this number is
// how you find out that it is not.
let liveCount = 0;
try {
  liveCount = registry.allEntries().length;
} catch {
  liveCount = 0;
}
lines.push(`  ..   LIVE REGISTRY (rules.ts + economy/tuning.ts): ${liveCount} entr${liveCount === 1 ? 'y' : 'ies'}`);
if (liveCount === 0) {
  lines.push('  ..   ^ nothing in src/game/** has been declared through registry.ts:tune() yet.');
  lines.push('  ..     Everything below is measured on the selftest.ts FIXTURE.');
}

selftest.installSelftestRegistry();

// ── 1. the registry populated, and the fixture is shaped as documented ────────

const entries = nonEmpty('registry entries', registry.allEntries());
const fixture = nonEmpty('selftest.* entries', entries.filter((e) => e.key.startsWith('selftest.')));

const authored = nonEmpty('fixture authored', fixture.filter((e) => e.kind === 'authored'));
const derived = nonEmpty('fixture derived', fixture.filter((e) => e.kind === 'derived'));
const derivedFn = nonEmpty('fixture derived-fn', fixture.filter((e) => e.kind === 'derived-fn'));

eq('paceMs authored literal is learned from selftest.ts, not restated',
  registry.entryFor('selftest.paceMs').authored, 2000);
eq('total = pace + grace', registry.entryFor('selftest.total').value, 2500);
eq('cycles = total / lockedInt', registry.entryFor('selftest.cycles').value, 2500 / 3);

// ── 2. THE TRANSITIVE ARM — the reason resolveValue exists ────────────────────
//
// `previewDerived` substitutes DIRECT inputs only. `selftest.cycles` reads
// `selftest.total`, which reads `selftest.paceMs`. So a candidate on paceMs is INVISIBLE
// to previewDerived('cycles', …) and it returns the live number — a plausible wrong
// answer, which is the failure mode this whole file exists to catch.

const graph = model.buildGraph(entries);
const affectsPace = nonEmpty('paceMs affects', [...(graph.affects.get('selftest.paceMs') ?? [])]);

ok('graph: paceMs reaches total (depth 1)', affectsPace.includes('selftest.total'));
ok('graph: paceMs reaches cycles (depth 2, TRANSITIVE)', affectsPace.includes('selftest.cycles'));
ok('graph: paceMs reaches the derived FUNCTION', affectsPace.includes('selftest.radiusFor'));

const cand = new Map([['selftest.paceMs', 4000]]);

// depth 1 — the CONTROL. If these ever disagree, the walk is broken, not clever.
eq('depth 1: resolveValue agrees with previewDerived',
  model.resolveValue('selftest.total', cand),
  registry.previewDerived('selftest.total', { 'selftest.paceMs': 4000 }));
eq('depth 1: and the number is right', model.resolveValue('selftest.total', cand), 4500);

// ⚠️ REVERSED BY `c5b9754`, AND THE OLD WORDING IS KEPT BECAUSE THESE TWO ROWS ARE WHY THE
// BUG GOT FIXED RATHER THAN LIVED WITH:
//
//   > *"depth 2 — the KNOWN-BAD. `previewDerived` must be STALE here, and it must be stale
//   > in the specific way predicted: it returns the LIVE value because nothing in its direct
//   > input list moved."*
//   > `eq('depth 2: previewDerived is STALE …', oneLevel, 2500 / 3);`
//   > `ok('depth 2: the two DISAGREE — if they ever agree the fixture has gone vacuous', …)`
//
// Both were correct when written and both PINNED THE DEFECT IN PLACE. `previewDerived` now
// walks the chain transitively, so the two agree — and agreement is the RESULT, not a
// regression. The old body survives as `tun_gate`'s own known-bad, which goes 87/90 when
// reverted, so the bug is still guarded from the other side.
//
// 🚨 THE ANTI-VACUITY GUARD HAD TO BE REBUILT, NOT DELETED. "They agree" is satisfied
// trivially by a fixture that is only one level deep, which is exactly what the old
// DISAGREE row was protecting against. So the depth itself is now asserted first.
const walked = model.resolveValue('selftest.cycles', cand);
const oneLevel = registry.previewDerived('selftest.cycles', { 'selftest.paceMs': 4000 });
// ⚠️ Written first as `registry.get(...).inputs.some(...)`. **There is no `get`** — the
// accessor is `entryFor`, and the list APIs are `derivedKeys`/`derivedEntries`. It threw
// rather than passing, which is the good failure; a guard that silently returned
// `undefined` here would have gone vacuous on its first run.
const dk = registry.derivedKeys();
ok('depth 2: the fixture really is TWO deep — else agreement below is vacuous',
  dk.includes('selftest.cycles') && dk.includes('selftest.total'),
  `derived keys: ${JSON.stringify(dk.filter((k) => k.startsWith('selftest.')))}`);
eq('depth 2: resolveValue walks the chain', walked, 4500 / 3);
eq('depth 2: previewDerived now walks it too (was STALE at 2500/3 — `c5b9754`)',
  oneLevel, 4500 / 3);
ok('depth 2: the two AGREE — the transitive fix, from both directions',
  Math.abs(walked - oneLevel) < 1e-9, `${walked} vs ${oneLevel}`);

// ── 3. CONSEQUENCES — including the field that must produce none ──────────────

const staged = new Map();
const cq = nonEmpty('consequences of paceMs',
  model.consequencesFor('selftest.paceMs', 4000, staged, graph));
eq('paceMs consequence count', cq.length, 3);

const total = cq.find((c) => c.key === 'selftest.total');
ok('paceMs → total is reported as MOVED', total?.moved === true);
eq('paceMs → total live', total?.live, 2500);
eq('paceMs → total next', total?.next, 4500);

const cycles = cq.find((c) => c.key === 'selftest.cycles');
eq('paceMs → cycles next is the TRANSITIVE number', cycles?.next, 4500 / 3);

const fn = cq.find((c) => c.key === 'selftest.radiusFor');
eq('a derived FUNCTION reports no scalar', fn?.next, null);
ok('a derived FUNCTION still names where it lives', String(fn?.formula).includes('selftest:radiusFor'));

// HOLDS: the field nothing derives from. A panel that emitted a line per field — the
// obvious way to write this and a very plausible one — passes everything above and fails
// here.
eq('ORPHAN: a field nothing derives from has ZERO consequences',
  model.consequencesFor('selftest.orphan', 0.5, staged, graph).length, 0);
ok('ORPHAN: and the graph agrees it affects nothing',
  graph.affects.get('selftest.orphan') === undefined);

// A consequence must not move when the edit does not move it.
const still = model.consequencesFor('selftest.paceMs', 2000, staged, graph)
  .filter((c) => c.kind === 'derived');
nonEmpty('unchanged-edit consequences', still);
ok('an edit back to the live value reports NOTHING moved', still.every((c) => c.moved === false),
  still.map((c) => `${c.key}:${c.moved}`).join(' '));

// ── 4. THE VALIDATOR, against the registry's own boot-time refusal ────────────
//
// 🚨 The panel's `validateCandidate` and `registry.ts`'s private `checkOverride` are two
// implementations of one rule — §76 constraint 1's own defect, in miniature. They are not
// merged because `checkOverride` is not exported and this agent does not own that file. So
// they are MEASURED to agree instead: each case below is installed as a real override in a
// FRESH PROCESS (the store seals on first read, so it cannot be done in-process) and the
// registry is required to throw exactly when the panel says it should.

const CASES = [
  { key: 'selftest.lockedInt', v: 3, legal: true, why: 'in band, integer' },
  { key: 'selftest.lockedInt', v: 1, legal: true, why: 'lower bound is inclusive' },
  { key: 'selftest.lockedInt', v: 6, legal: true, why: 'upper bound is inclusive' },
  { key: 'selftest.lockedInt', v: 7, legal: false, why: 'above max' },
  { key: 'selftest.lockedInt', v: 0, legal: false, why: 'below min' },
  { key: 'selftest.lockedInt', v: 2.5, legal: false, why: 'int:true refuses a fraction' },
  { key: 'selftest.orphan', v: 0.5, legal: true, why: 'non-integer is fine where int is unset' },
  { key: 'selftest.orphan', v: 1.5, legal: false, why: 'above max' },
  { key: 'selftest.paceMs', v: 0, legal: true, why: 'zero is in band' },
  { key: 'selftest.paceMs', v: -1, legal: false, why: 'negative is below min' },
];

const CHILD = `
import { installSelftestRegistry } from ${JSON.stringify(resolve(REPO, 'src/admin/selftest.ts'))};
try { installSelftestRegistry(); console.log('ACCEPTED'); }
catch (err) { console.log('REFUSED ' + String(err && err.message).slice(0, 120)); }
`;

nonEmpty('validator cases', CASES);
let agreements = 0;
for (const c of CASES) {
  const panelSays = model.validateCandidate(registry.entryFor(c.key), c.v);
  const child = spawnSync(process.execPath, ['--input-type=module', '-e', CHILD], {
    cwd: REPO,
    encoding: 'utf8',
    env: { ...process.env, FA_TUNING: JSON.stringify({ [c.key]: c.v }) },
  });
  const out = `${child.stdout}${child.stderr}`;
  const registryAccepted = out.includes('ACCEPTED');
  const panelAccepted = panelSays === null;
  const agree = registryAccepted === panelAccepted && panelAccepted === c.legal;
  if (agree) agreements++;
  ok(`REFUSAL AGREES  ${c.key}=${c.v} (${c.why})`, agree,
    `panel=${panelAccepted ? 'accept' : `refuse:${panelSays}`} registry=${registryAccepted ? 'accept' : 'refuse'} expected=${c.legal ? 'accept' : 'refuse'}`);
}
// The vacuity guard on the guard: a table that only contained legal values would prove
// nothing about refusal, and a bug that made the child throw unconditionally would look
// like a perfect score on the illegal half alone.
ok('the refusal table exercises BOTH outcomes',
  CASES.some((c) => c.legal) && CASES.some((c) => !c.legal));
eq('every case agreed', agreements, CASES.length);

// ── 5. THE STAGED-SET SEMANTICS — absence means AUTHORED, not LIVE ────────────
//
// The trap `model.ts:pendingCandidates` exists for. In the staged set a missing key means
// "no override, boot the authored literal". In the candidate map a missing key means
// "unchanged, use the live value". They coincide only while nothing is overridden, which
// is exactly the state a test written carelessly would be in.

const authoredEntries = nonEmpty('authored entries for candidates',
  registry.allEntries().filter((e) => e.kind === 'authored'));

const emptyStaged = new Map();
eq('nothing staged, nothing overridden → no candidates',
  model.pendingCandidates(emptyStaged, authoredEntries).size, 0);

const stagedOne = new Map([['selftest.paceMs', 4000]]);
const c1 = model.pendingCandidates(stagedOne, authoredEntries);
eq('one staged field → one candidate', c1.size, 1);
eq('…and it carries the staged value', c1.get('selftest.paceMs'), 4000);

const noop = new Map([['selftest.paceMs', 2000]]);
eq('a field staged AT its authored value is not a candidate',
  model.pendingCandidates(noop, authoredEntries).size, 0);
eq('…and canonicalises out of the set entirely', model.canonicalise(noop).size, 0);
eq('…so the hash is the distinguished STOCK string, not a hex digest',
  model.stagedHash(noop), store.STOCK_HASH);

const h = model.stagedHash(stagedOne);
ok('a real set hashes with the tun1- prefix', h.startsWith(store.HASH_PREFIX), h);
eq('the panel hash IS the store hash — not a second implementation',
  h, store.hashOfPairs([['selftest.paceMs', 4000]]));

// ── 6. IMPORT REFUSES WHAT THE SIM WOULD REFUSE ──────────────────────────────

const IMPORTS = [
  ['a good set', '{"selftest.paceMs": 3000}', true],
  ['the exported envelope form', '{"tuningHash":"x","overrides":{"selftest.paceMs":3000}}', true],
  ['an unknown key', '{"nope.nothing": 1}', false],
  ['a DERIVED key', '{"selftest.total": 9999}', false],
  ['an out-of-band value', '{"selftest.lockedInt": 99}', false],
  ['a non-integer where int is set', '{"selftest.lockedInt": 2.5}', false],
  ['a string value', '{"selftest.paceMs": "3000"}', false],
  ['not JSON', 'not json at all', false],
  ['an array', '[1,2,3]', false],
  ['an empty object', '{}', false],
];
nonEmpty('import cases', IMPORTS);
for (const [name, text, shouldPass] of IMPORTS) {
  const r = model.parseImported(text);
  ok(`IMPORT ${shouldPass ? 'accepts' : 'refuses'}: ${name}`,
    ('staged' in r) === shouldPass, 'error' in r ? r.error : `${r.staged.size} key(s)`);
}
ok('the import table exercises BOTH outcomes',
  IMPORTS.some((c) => c[2]) && IMPORTS.some((c) => !c[2]));

// ── 7. fmt() must not alter a value it round-trips ────────────────────────────
//
// A display artefact that changed a number would change the SET HASH, and §76 constraint
// 3's whole job is that a measurement can be attributed to a constant set.
const ROUND = [0.12, 0.09, 2000, 237, 1.71, 1.29, 0.5, 3500, 0.053, 0.427];
nonEmpty('round-trip values', ROUND);
for (const v of ROUND) eq(`fmt round-trips ${v}`, Number(model.fmt(v)), v);

// ─────────────────────────────────────────────────────────────────────────────

console.log(lines.join('\n'));
console.log('─'.repeat(78));
console.log(`adm_model: ${checks - failures}/${checks} checks passed${failures ? `  — ${failures} FAILURE(S)` : ''}`);
process.exit(failures ? 1 : 0);
