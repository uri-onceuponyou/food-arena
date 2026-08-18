#!/usr/bin/env node
/**
 * SDA_SCALE — plant a PURE UNIT RESCALE of the HP/damage system into a worktree.
 *
 * ── What "pure" means here, precisely ───────────────────────────────────────
 *
 * Multiply every quantity DENOMINATED IN HIT POINTS by one common factor `k`, and
 * nothing else. Not `range`, not `cone`, not `speed`, not a cooldown, not a fraction,
 * not the card's 0..10 `stats` bars. The whole design claim of the conservative
 * proposal is that this is a CHANGE OF UNITS, and a change of units is exactly the
 * operation that multiplies every HP-denominated quantity by one constant.
 *
 * 🚨 THE TRAP THIS TOOL EXISTS TO NOT FALL INTO: `stats: { damage: 10, ... }` and
 * `{ key: 'Smash', ..., damage: 12, ... }` are the SAME TOKEN `damage:` and are two
 * completely different quantities — one is a 0..10 display bar, one is HP. A regex
 * that scales both produces a tree that looks rescaled and has silently destroyed the
 * character card. So every edit class is counted and asserted, and the card class is
 * asserted to be UNTOUCHED by counting it before and after.
 *
 *   node tools/tmp/sda_scale.mjs --root /tmp/fa-sda-k --k 16
 *   node tools/tmp/sda_scale.mjs --root /tmp/fa-sda-k --k 16 --sabotage fog
 *   node tools/tmp/sda_scale.mjs --root <dir> --dry-run   # every count, nothing written
 *   node tools/tmp/sda_scale.mjs --selftest               # read-only, against this repo
 *
 * ── 🚨 §76 BROKE EVERY NAMED-CONSTANT PATTERN IN THIS FILE ──────────────────
 *
 * `c5b9754` routed constants through an override layer:
 *
 *     export const FOG_DAMAGE = 15;   ->   export const FOG_DAMAGE = tune('FOG_DAMAGE', 15, {…});
 *
 * so `/export const FOG_DAMAGE = (\d+);/` matched nothing and `named HP constants` reported
 * **1 / 4**. The tool REFUSED and wrote nothing, which is the behaviour that saved it — every
 * edit class here is counted against an expected number, so the breakage was loud. (Contrast
 * `tools/tmp/ssj_plant.mjs`, which counts the same edits and asserts NONE of the counts: its
 * `transform()` silently emitted x20 weapon damage against an unscaled 100 HP pool.)
 *
 * The patterns below now match BOTH forms and rebuild from a captured head, so the `tune(…)`
 * wrapper survives a rewrite that does not understand it. ⚠️ **That is a mitigation, not a
 * cure: a regex over `rules.ts` is a second copy of the constant and will go stale again.**
 * `crossCheck()` is the part that cannot fail silently — it IMPORTS each constant and refuses
 * if the number the regex scraped is not the number the sim runs on.
 *
 * `--sabotage <name>` plants a KNOWN-BAD on top of the rescale — a change that is NOT
 * a pure unit change — so the comparator downstream can be shown to FAIL. A rescale
 * comparator that cannot fail is worthless, and a scale-quotient comparator is the
 * easiest thing in this repo to write in a form that says "identical" to everything.
 */

import { readFileSync, writeFileSync } from 'node:fs';
import { resolve } from 'node:path';

const args = (() => {
  const o = {};
  for (let i = 2; i < process.argv.length; i++) {
    const a = process.argv[i];
    if (!a.startsWith('--')) continue;
    const n = process.argv[i + 1];
    if (n === undefined || n.startsWith('--')) o[a.slice(2)] = true;
    else { o[a.slice(2)] = n; i++; }
  }
  return o;
})();

/** This repo, derived. Only ever READ — `--selftest` and `--dry-run` never write. */
const REPO_ROOT = resolve(new URL('../..', import.meta.url).pathname);

const SELFTEST = !!args.selftest;
const DRY = SELFTEST || !!args['dry-run'];
const ROOT = String(args.root ?? (SELFTEST ? REPO_ROOT : ''));
const K = Number(args.k ?? 16);
const SABOTAGE = args.sabotage ? String(args.sabotage) : null;
const ROUND_POLICY = String(args['round-policy'] ?? 'native'); // native | preserve

if (!ROOT) { console.error('sda_scale: --root <worktree> is required'); process.exit(1); }
if (!Number.isFinite(K) || K <= 0) { console.error('sda_scale: --k must be a positive number'); process.exit(1); }

const RULES = resolve(ROOT, 'src/game/rules.ts');
let src = readFileSync(RULES, 'utf8');

// A tree that has already been scaled must not be scaled twice.
if (src.includes('/* SDA_SCALED */')) { console.error('sda_scale: this tree is ALREADY scaled — refusing.'); process.exit(1); }

const report = [];
let fail = false;

/** Replace with an asserted count. `expect === null` means "must be > 0". */
function sub(label, re, fn, expect) {
  let n = 0;
  src = src.replace(re, (...m) => { n++; return fn(...m); });
  const ok = expect === null ? n > 0 : n === expect;
  report.push(`   ${ok ? 'OK  ' : 'FAIL'}  ${label.padEnd(38)} ${String(n).padStart(3)}${expect === null ? '' : ` / ${expect}`}`);
  if (!ok) fail = true;
  return n;
}

const scale = (v) => {
  const out = Number(v) * K;
  // A unit change must not introduce a fraction where there was an integer. Every
  // authored HP value in this file is an integer; `DPS_PER_DAMAGE_POINT` (3.5) is the
  // one non-integer and 3.5*k is exact for any even k.
  return Number.isInteger(out) ? String(out) : String(out);
};

/**
 * The declaration of `name`, in EITHER shipped form — bare literal or `tune('name', literal,`.
 *
 * Group 1 is everything up to the number and group 2 is the number, so a rewrite is
 * `head + f(n)` and CANNOT damage a wrapper it does not understand. `name` may be an
 * alternation; `\\2` then back-references the matched name inside the `tune()` arm, which is
 * what stops `tune('ENEMY_MAX_HP', …)` from satisfying a match that opened on `PLAYER_MAX_HP`.
 */
const declRe = (name) =>
  new RegExp(`^(export const (${name}) = (?:tune\\('\\2', )?)(\\d+(?:\\.\\d+)?)`, 'gm');

// ── 1. THE NAMED POOL AND ENVIRONMENT CONSTANTS ────────────────────────────
// ⚠️ The old single-form pattern is kept above its replacement because it is the evidence:
//     /export const (PLAYER_MAX_HP|ENEMY_MAX_HP|FOG_DAMAGE|REGEN_AMOUNT) = (\d+(?:\.\d+)?);/g
// reported 1 / 4 the moment §76 landed, and three of these four are tuned today.
sub('named HP constants',
  declRe('PLAYER_MAX_HP|ENEMY_MAX_HP|FOG_DAMAGE|REGEN_AMOUNT'),
  (_all, head, _name, v) => `${head}${scale(v)}`, 4);

// ── 2. THE CARD'S DAMAGE DIVISOR ───────────────────────────────────────────
// HP/s per bar point. NOT a fraction — it converts an HP-denominated rate into a
// 0..10 display integer, so it scales with HP or every character's damage bar
// saturates at 10 and the card becomes fiction again (`DECISIONS §13`).
// Still a BARE literal today. Matched dual-form anyway: it is a combat scalar, so it is a
// candidate for the registry, and the cost of being ready is zero.
sub('DPS_PER_DAMAGE_POINT',
  declRe('DPS_PER_DAMAGE_POINT'),
  (_all, head, _name, v) => `${head}${scale(v)}`, 1);

// ── 3. THE TWO ENVIRONMENT DAMAGE OBJECTS ──────────────────────────────────
// Matched by their surrounding object so that no other `damage:` can be caught.
sub('POT.damage',
  /(export const POT = \{[\s\S]*?)\bdamage: (\d+(?:\.\d+)?),/g,
  (_all, head, v) => `${head}damage: ${scale(v)},`, 1);
sub('TRAIL.damage',
  /(export const TRAIL = \{[\s\S]*?)\bdamage: (\d+(?:\.\d+)?),/g,
  (_all, head, v) => `${head}damage: ${scale(v)},`, 1);

// ── 4. EVERY WEAPON ROW ────────────────────────────────────────────────────
// Anchored on `key: '...'` so the card's `stats: { damage: n, health: n, speed: n }`
// cannot match: a weapon row always carries a `key:` and the stat block never does.
sub('weapon damage (anchored on key:)',
  /(key: '[^']+',[\s\S]{0,220}?)\bdamage: (\d+(?:\.\d+)?),/g,
  (_all, head, v) => `${head}damage: ${scale(v)},`, 33);

// ── 5. COMBO PARTS — the damage a combo weapon actually delivers ───────────
// Taco's Double Toss is authored `damage: 0` and delivers 23 through these.
sub('comboParts damage',
  /(\{ color: '#[0-9A-Fa-f]+', )damage: (\d+(?:\.\d+)?),/g,
  (_all, head, v) => `${head}damage: ${scale(v)},`, 2);

// ── 6. THE HEAL ────────────────────────────────────────────────────────────
sub('healAmount',
  /healAmount: (\d+(?:\.\d+)?),/g,
  (_all, v) => `healAmount: ${scale(v)},`, 1);

// ── 7. OPTIONAL: make the pool ROUNDING scale-exact ────────────────────────
// `maxHpFor` is `Math.round(base * hMul * lMul)`, and `Math.round` is the ONE
// non-linear operation in the HP path — `round(k*v) !== k*round(v)` in general. Under
// `--round-policy preserve` the rounding is done at the OLD scale and then multiplied
// up, which makes the rescale exactly k-proportional at every level and buys zero new
// resolution. Under `native` (the default) the rounding happens at the new scale,
// which recovers the old remainder and is the only place a pure rescale changes a
// number the sim reads.
if (ROUND_POLICY === 'preserve') {
  sub('maxHpFor rounding pinned to the old scale',
    /return Math\.round\(roleBaseHp \* healthMultiplier\(id\) \* levelHealthMultiplier\(level\)\);/g,
    () => `return ${K} * Math.round((roleBaseHp / ${K}) * healthMultiplier(id) * levelHealthMultiplier(level));`, 1);
}

// ── 8. THE KNOWN-BADS ──────────────────────────────────────────────────────
// Each is a change that is NOT a pure unit change, planted ON TOP of a correct
// rescale. Downstream, the scale-quotient comparator MUST report a divergence for
// every one of these, or it is not a comparator.
if (SABOTAGE) {
  const bad = {
    // The fog burns 10% harder in the new units — a real balance change wearing a
    // renumbering. This is the exact failure mode of "HP x20, damage x10".
    fog: [declRe('FOG_DAMAGE'),
      (_a, head, _n, v) => `${head}${Number(v) * 1.1}`, 1],
    // ONE weapon, ONE point of new-scale damage. The smallest expressible change in
    // the new unit system — the thing the whole proposal claims to have made visible.
    onepoint: [/(key: 'Rice',[\s\S]{0,220}?)\bdamage: (\d+(?:\.\d+)?),/g,
      (_a, head, v) => `${head}damage: ${Number(v) + 1},`, 1],
    // HP x2k while damage stays xk — the asymmetric-magnitude reading of Uri's words.
    ratio: [declRe('PLAYER_MAX_HP|ENEMY_MAX_HP'),
      (_a, head, _n, v) => `${head}${Number(v) * 2}`, 2],
    // The card divisor left un-scaled: every character's damage bar saturates at 10.
    cardsat: [declRe('DPS_PER_DAMAGE_POINT'),
      (_a, head, _n, v) => `${head}${Number(v) / K}`, 1],
  }[SABOTAGE];
  if (!bad) { console.error(`sda_scale: unknown --sabotage ${SABOTAGE}`); process.exit(1); }
  sub(`SABOTAGE ${SABOTAGE}`, bad[0], bad[1], bad[2]);
}

// ── 9. THE CARD MUST NOT HAVE MOVED ────────────────────────────────────────
// Counted, not asserted by reading the regex. `stats: { damage: 10, health: 3, speed: 5 }`
// — eleven of them, and every one must be byte-identical to what it was.
{
  const orig = readFileSync(RULES, 'utf8');
  const cardRe = /stats: \{ damage: \d+, health: \d+, speed: \d+ \}/g;
  const before = orig.match(cardRe) ?? [];
  const after = src.match(cardRe) ?? [];
  const ok = before.length === 11 && after.length === 11 && before.join('|') === after.join('|');
  report.push(`   ${ok ? 'OK  ' : 'FAIL'}  ${'card stats UNTOUCHED'.padEnd(38)} ${after.length} / 11`);
  if (!ok) fail = true;

  // …and so must every non-HP weapon field. `range`, `cone`, `speed`, `cooldown`,
  // `spreadDeg`, `pellets`, `peckHits` are all in the same object literal as `damage`
  // and a greedy regex eats them.
  const otherRe = /\b(range|cooldown|cone|spreadDeg|pellets|peckHits|peckInterval|speed): [A-Za-z0-9_.]+/g;
  const ob = orig.match(otherRe) ?? [];
  const oa = src.match(otherRe) ?? [];
  const ok2 = ob.length > 0 && ob.join('|') === oa.join('|');
  report.push(`   ${ok2 ? 'OK  ' : 'FAIL'}  ${'range/cone/speed/cd UNTOUCHED'.padEnd(38)} ${oa.length} sites`);
  if (!ok2) fail = true;
}

// ── 10. THE CROSS-CHECK: the SCRAPE must agree with the IMPORT ─────────────
//
// 🚨 THIS IS THE ONLY CHECK HERE THAT CANNOT GO STALE SILENTLY, AND IT IS THE ONE THIS FILE
// SHIPPED WITHOUT. Every assertion above compares the file against a NUMBER TYPED IN THIS
// FILE (`4`, `33`, `11`) — a second copy in exactly the sense `CLAUDE.md` warns about, and
// four of those five counts stayed perfectly green while `named HP constants` collapsed to
// 1/4. A count is evidence that the regex matched something; it is never evidence that it
// matched the RIGHT something. `sp_place.mjs` scraped `PLAYER_SPEED` out of a COMMENT for a
// whole session, matched every time, and never threw (`fcf6da7`).
//
// So: import each named constant from the tree being rewritten and require the number the
// regex found to be the number the sim runs on. Registered keys are compared against the
// registry's `authored` default, because `FA_TUNING` overrides the export at import time and
// would otherwise manufacture a disagreement that is not one.
const NAMED = ['PLAYER_MAX_HP', 'ENEMY_MAX_HP', 'FOG_DAMAGE', 'REGEN_AMOUNT', 'DPS_PER_DAMAGE_POINT'];
{
  const orig = readFileSync(RULES, 'utf8');
  let rows = [];
  try {
    const R = await import(`${resolve(ROOT)}/src/game/rules.ts`);
    const T = await import(`${resolve(ROOT)}/src/game/tuning/index.ts`);
    const authored = new Map(T.authoredEntries().filter((e) => !e.key.includes('.')).map((e) => [e.key, e.authored]));
    rows = NAMED.map((n) => {
      const m = declRe(n).exec(orig);
      const scraped = m ? Number(m[3]) : null;
      const live = authored.has(n) ? authored.get(n) : R[n];
      return { n, scraped, live, form: m ? (/tune\(/.test(m[1]) ? 'tune()' : 'bare') : 'NOT FOUND', agree: scraped !== null && live !== undefined && scraped === live };
    });
  } catch (e) {
    report.push(`   FAIL  ${'cross-check could not IMPORT rules.ts'.padEnd(38)} ${String(e.message).slice(0, 60)}`);
    fail = true;
  }
  // NON-EMPTY FIRST — `[].every()` returns true, and an import failure above would otherwise
  // let the row below pass over nothing at all (`CLAUDE.md` #6, the vacuity class).
  if (rows.length !== NAMED.length) {
    report.push(`   FAIL  ${'cross-check ran over an EMPTY set'.padEnd(38)} ${rows.length} / ${NAMED.length}`);
    fail = true;
  } else {
    const bad = rows.filter((r) => !r.agree);
    report.push(`   ${bad.length === 0 ? 'OK  ' : 'FAIL'}  ${'scrape == import (cross-check)'.padEnd(38)} ${rows.length - bad.length} / ${rows.length}`);
    if (bad.length) fail = true;
    for (const r of rows) report.push(`           ${r.agree ? '  ' : '!!'} ${r.n.padEnd(22)} scraped=${r.scraped} import=${r.live}  [${r.form}]`);
  }
}

console.log(`\n══ SDA_SCALE ══  k=${K}  root=${ROOT}  round-policy=${ROUND_POLICY}${SABOTAGE ? `  SABOTAGE=${SABOTAGE}` : ''}${DRY ? '  DRY-RUN' : ''}\n`);
console.log(report.join('\n'));

if (fail) { console.log('\n   >> REFUSED — an edit class did not match its expected count. Nothing written.\n'); process.exit(1); }

if (DRY) { console.log(`\n   >> DRY RUN — every class matched. NOTHING WRITTEN to ${RULES}\n`); process.exit(0); }

src = src.replace('/**\n * GAME DESIGN', `/* SDA_SCALED k=${K} policy=${ROUND_POLICY}${SABOTAGE ? ` SABOTAGE=${SABOTAGE}` : ''} */\n/**\n * GAME DESIGN`);
writeFileSync(RULES, src);
console.log(`\n   >> WROTE ${RULES}\n`);
