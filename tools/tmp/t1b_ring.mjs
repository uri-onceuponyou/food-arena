#!/usr/bin/env node
/**
 * T1B_RING — THE OPENING RING AN INSTRUMENT HANDS THE SIM, READ IN ONE PLACE.
 *
 * ═══════════════════════════════════════════════════════════════════════════
 * WHY THIS FILE EXISTS
 * ═══════════════════════════════════════════════════════════════════════════
 *
 * Until 2026-08-12 the closing ring opened at
 *
 *     Math.round(halfDiagonal / (1 - FOG_FIRST_CONTACT_MS / MATCH_DURATION_MS))
 *
 * and that expression was COPIED into the balance instruments with `FOG_FIRST_CONTACT_MS`
 * hardcoded to 6000. `6d5c4d6` decoupled the ring from the clock: `rules.ts:
 * fogOpeningRadiusFor(halfDiagonal)` is the half-diagonal, unrounded, and `arena/shared.ts:
 * MAX_SAFE_RADIUS` is that, **1720.4650534085254** on the shipped 2800x2000 map. The copies
 * kept running and returned **1792** (the 6 s literal on the 150 s clock, 4.2% high) or
 * **2065** (`FOG_FIRST_CONTACT_S` = 25 read out of `shared.ts`, 20.0% high) — every balance
 * number they printed since rode a ring the game never had. Each copy carried a comment
 * saying it recomputed the ring "or this tool measures a different fog"; after the decoupling
 * the recompute WAS the different fog.
 *
 * `tools/tmp/fs_sched_census.mjs` is the census of the copies. This file is the one thing
 * the copies are replaced WITH, so the fix cannot itself be copied into fifty variants.
 *
 * ═══════════════════════════════════════════════════════════════════════════
 * THE RULE
 * ═══════════════════════════════════════════════════════════════════════════
 *
 *   1. The ring is the DUMP's `maxSafeRadius`. `tools/arena.gameplay.json` is written by the
 *      browser from the shipped arena (`tools/arena-dump.js`), so it carries the value the game
 *      opens at. It is READ, never re-derived — a re-derivation is a second copy of the rule,
 *      and a second copy is what agreed by construction until the rule moved.
 *   2. A dump WITHOUT a usable field is REFUSED, naming the file. Handing the sim `undefined`
 *      (or `NaN`, or 0) does not crash it — it silently plays a match with no fog.
 *   3. `--maxsafe <wu>` still overrides, and an override that is not a positive number is
 *      refused too (`--maxsafe` given bare parses as `true`, and `Number(true)` is a 1 wu ring).
 *   4. OPTIONAL cross-check: pass the tree's own `rules` module and, when it carries
 *      `fogOpeningRadiusFor`, the dump's ring must equal that rule applied to the dump's OWN
 *      half-diagonal. A dump regenerated before the rule moved fails here instead of feeding
 *      every fixture built from it. A tree that predates the rule (no `fogOpeningRadiusFor`)
 *      cannot be checked and is not: pass that tree's own dump, or `--maxsafe`.
 *
 *   import { ringOf, withShippedRing } from './t1b_ring.mjs';
 *   const arena = withShippedRing(ARENA_DATA, { override: args.maxsafe, rules: RULES, source: ARENA_PATH });
 *
 *   node tools/tmp/t1b_ring.mjs --selftest
 *
 * Offline, no browser, no git, < 1 s.
 */
import { readFileSync } from 'node:fs';
import { dirname, resolve } from 'node:path';
import { fileURLToPath } from 'node:url';

const ROOT = resolve(dirname(fileURLToPath(import.meta.url)), '../..');

/** Relative tolerance of the optional rule cross-check — the dump is JSON of the same double. */
const RULE_TOL = 1e-9;

const isPositive = (v) => typeof v === 'number' && Number.isFinite(v) && v > 0;
/** `JSON.stringify(NaN)` is `"null"`, which would name the wrong defect in a refusal. */
const show = (v) => (typeof v === 'number' ? String(v) : JSON.stringify(v));

/**
 * The opening ring for `dump`, in world units.
 * @param {object} dump      a parsed arena dump (`tools/arena.gameplay.json` shape)
 * @param {object} [opts]
 * @param {unknown} [opts.override]  `args.maxsafe` — undefined, a numeric string, or (bare flag) `true`
 * @param {object}  [opts.rules]     the tree's `rules.ts` module, for the cross-check
 * @param {string}  [opts.source]    the dump's path, for the refusal message
 */
export function ringOf(dump, { override, rules, source = 'the arena dump' } = {}) {
  if (override !== undefined && override !== null) {
    const v = typeof override === 'string' && override.trim() !== '' ? Number(override) : override;
    if (!isPositive(v)) {
      throw new Error(`t1b_ring: --maxsafe ${show(override)} is not a positive number of world units`);
    }
    return v;
  }
  const v = dump?.maxSafeRadius;
  if (!isPositive(v)) {
    throw new Error(`t1b_ring: ${source} carries no usable maxSafeRadius (${show(v)}). `
      + 'Regenerate the dump (tools/arena-dump.js) or pass --maxsafe <wu>; the ring is never re-derived here.');
  }
  if (rules && typeof rules.fogOpeningRadiusFor === 'function') {
    const halfDiag = Math.hypot(dump.width / 2, dump.height / 2);
    const want = rules.fogOpeningRadiusFor(halfDiag);
    if (!(Math.abs(v - want) <= RULE_TOL * Math.max(1, Math.abs(want)))) {
      throw new Error(`t1b_ring: ${source} says maxSafeRadius ${v}, but this tree's fogOpeningRadiusFor(`
        + `${halfDiag.toFixed(4)}) is ${want} — the dump is stale for this tree. Regenerate it, or pass --maxsafe.`);
    }
  }
  return v;
}

/** `dump` as the sim's arena argument: the dump's ring (see `ringOf`) and no-op render hooks. */
export function withShippedRing(dump, opts = {}) {
  return { ...dump, maxSafeRadius: ringOf(dump, opts), build: () => null, update: () => {} };
}

// ─────────────────────────────────────────────────────────────────────────────
// --selftest — every refusal shown to fire, and the accept path shown to accept
// ─────────────────────────────────────────────────────────────────────────────

async function selftest() {
  let pass = 0, fail = 0;
  const check = (name, ok, detail = '') => {
    if (ok) pass++; else fail++;
    console.log(`  ${ok ? 'ok  ' : 'FAIL'} - ${name}${detail ? `\n         ${detail}` : ''}`);
  };
  const throws = (fn) => { try { fn(); return null; } catch (e) { return String(e.message ?? e); } };

  const DUMP_PATH = `${ROOT}/tools/arena.gameplay.json`;
  const DUMP = JSON.parse(readFileSync(DUMP_PATH, 'utf8'));
  const RULES = await import(`${ROOT}/src/game/rules.ts`);
  const halfDiag = Math.hypot(DUMP.width / 2, DUMP.height / 2);
  // The two dead rings, computed here ONLY as the known-bad they are (fs_sched_census exempts
  // a line under a KNOWN-BAD marker).
  // KNOWN-BAD: the superseded clock-coupled division, both spellings the copies used.
  const dead6 = Math.round(halfDiag / (1 - 6000 / RULES.MATCH_DURATION_MS));
  // KNOWN-BAD: the same division with FOG_FIRST_CONTACT_S (25) read out of shared.ts.
  const dead25 = Math.round(halfDiag / (1 - 25000 / RULES.MATCH_DURATION_MS));

  console.log(`══ t1b_ring --selftest ══  dump ${DUMP.width}x${DUMP.height}, ring ${DUMP.maxSafeRadius}`);
  console.log('\nA. the accept path');
  check('the shipped dump carries a positive maxSafeRadius (else every row below is vacuous)',
    isPositive(DUMP.maxSafeRadius), `${DUMP.maxSafeRadius}`);
  check('ringOf(shipped dump) returns the dump\'s own value, untouched (no rounding)',
    ringOf(DUMP) === DUMP.maxSafeRadius, `${ringOf(DUMP)}`);
  check('…and it is what this tree\'s fogOpeningRadiusFor derives for the dump\'s half-diagonal',
    ringOf(DUMP, { rules: RULES }) === RULES.fogOpeningRadiusFor(halfDiag),
    `${ringOf(DUMP, { rules: RULES })} vs ${RULES.fogOpeningRadiusFor(halfDiag)}`);
  check('KNOWN-BAD SEPARATES: the dead rings the copies computed are NOT the shipped one '
    + '(else replacing them changes nothing and this file proves nothing)',
    dead6 !== ringOf(DUMP) && dead25 !== ringOf(DUMP), `dead ${dead6} / ${dead25} vs shipped ${ringOf(DUMP)}`);
  const arena = withShippedRing(DUMP, { rules: RULES, source: DUMP_PATH });
  check('withShippedRing keeps every dump field, sets the ring, adds no-op build/update',
    arena.cover === DUMP.cover && arena.width === DUMP.width && arena.maxSafeRadius === DUMP.maxSafeRadius
      && arena.build() === null && arena.update() === undefined);
  check('it does not mutate the dump it was given', !('build' in DUMP));

  console.log('\nB. the override');
  check('--maxsafe 1500 (a string, as argv delivers it) overrides', ringOf(DUMP, { override: '1500' }) === 1500);
  check('--maxsafe as a number overrides', ringOf(DUMP, { override: 1234.5 }) === 1234.5);
  check('an override skips the rule cross-check (it is the escape hatch for an old dump)',
    ringOf({ ...DUMP, maxSafeRadius: dead6 }, { override: '1720', rules: RULES }) === 1720);
  for (const [what, bad] of [['bare `--maxsafe` (parses as true)', true], ['a non-number', 'abc'],
    ['an empty string', ''], ['zero', '0'], ['a negative', '-5'], ['NaN', NaN], ['Infinity', 'Infinity']]) {
    const why = throws(() => ringOf(DUMP, { override: bad }));
    check(`KNOWN-BAD: --maxsafe ${what} is REFUSED`, why !== null && /--maxsafe/.test(why), why ?? 'accepted');
  }

  console.log('\nC. the refusals — a dump without the field never reaches the sim');
  const { maxSafeRadius: _drop, ...noField } = DUMP;
  for (const [what, d] of [['the field deleted', noField], ['null', { ...DUMP, maxSafeRadius: null }],
    ['a string', { ...DUMP, maxSafeRadius: '1720.47' }], ['NaN (JSON cannot hold it; a bad merge can)', { ...DUMP, maxSafeRadius: NaN }],
    ['zero', { ...DUMP, maxSafeRadius: 0 }], ['negative', { ...DUMP, maxSafeRadius: -1 }], ['no dump at all', undefined]]) {
    const why = throws(() => ringOf(d, { source: 'kb.json' }));
    check(`KNOWN-BAD: a dump with maxSafeRadius ${what} is REFUSED, naming the file`,
      why !== null && why.includes('kb.json') && /no usable maxSafeRadius/.test(why), why ?? 'accepted');
  }
  check('KNOWN-BAD CONTROL: the same dump WITH the field is accepted (the refusal is about the field)',
    throws(() => ringOf(DUMP, { source: 'kb.json' })) === null);

  console.log('\nD. the cross-check — a stale dump is refused when the tree can say so');
  for (const [what, r] of [['the dead 6 s ring', dead6], ['the dead 25 s ring', dead25], ['the retired 1985', 1985],
    ['the half-diagonal ROUNDED (rules.ts: "DO NOT ROUND IT DOWN")', Math.round(halfDiag)]]) {
    const why = throws(() => ringOf({ ...DUMP, maxSafeRadius: r }, { rules: RULES, source: 'kb.json' }));
    check(`KNOWN-BAD: a dump carrying ${what} (${r}) is REFUSED against this tree's rule`,
      why !== null && /stale for this tree/.test(why), why ?? 'accepted');
    check('  CONTROL: …and accepted when no rules module is passed (the check is opt-in, not a guess)',
      throws(() => ringOf({ ...DUMP, maxSafeRadius: r })) === null);
  }
  const oldTree = { MATCH_DURATION_MS: 45000 };   // a pre-2026-08-12 tree: no fogOpeningRadiusFor
  check('a tree that predates fogOpeningRadiusFor is NOT cross-checked — it cannot be, and guessing '
    + 'its rule is the copy this file replaces', ringOf({ ...DUMP, maxSafeRadius: 1985 }, { rules: oldTree }) === 1985);
  const scaled = { ...DUMP, width: DUMP.width / 2, height: DUMP.height / 2, maxSafeRadius: halfDiag / 2 };
  check('a self-consistent dump of ANOTHER size passes the cross-check (it compares the dump to '
    + 'its own half-diagonal, not to the shipped map)', ringOf(scaled, { rules: RULES }) === halfDiag / 2);

  console.log(`\nt1b_ring --selftest: ${pass} passed, ${fail} failed`);
  return fail;
}

if (import.meta.main) {
  if (process.argv.includes('--selftest')) process.exitCode = (await selftest()) ? 1 : 0;
  else { console.error('usage: node tools/tmp/t1b_ring.mjs --selftest   (a library; import ringOf / withShippedRing)'); process.exitCode = 2; }
}
