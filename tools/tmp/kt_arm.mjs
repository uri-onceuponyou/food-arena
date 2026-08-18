#!/usr/bin/env node
/**
 * KT_ARM — stage ONE kit-composition arm into a detached worktree and PROVE the staging
 * landed, THROUGH THE MODULE LOADER, before anything is measured on it.
 *
 * ── WHY THIS EXISTS RATHER THAN `tools/tmp/u6_arm.mjs` ──────────────────────
 *
 * The brief said *"`u6_arm.mjs` and `lk_arm.mjs` both already stage a verified arm — reuse
 * one."* **Neither can stage THIS arm, and both reasons are facts about the tools rather
 * than complaints.** `DECISIONS §79` moves a weapon's `effect`, so:
 *
 *   u6_arm   its `--set` grammar is `<char>.<Weapon>.<field>=(-?[0-9.]+)` — a NUMBER — so
 *            `effect=null` does not parse at all. Worse, had it parsed: its whole
 *            verification is `castMap()`, which reads `w.castMs ?? 0`. An `effect` edit
 *            leaves `castMap` **BIT-IDENTICAL**, so `STAGING FAILED` cannot fire and
 *            `STAGING BLED` cannot fire, and an arm whose patch silently missed would be
 *            certified green. That is `AGENT-BRIEF §3`'s "the change did nothing" failure
 *            with a tick next to it.
 *   lk_arm   it copies a whole `combat.ts` between trees and verifies a CONTROL-FLOW term
 *            (does a mid-cast press fire?). It moves no field and has no field grammar.
 *
 * The DISCIPLINE is reused verbatim from both and the mechanism is not:
 *
 *   * exactly ONE textual match per edit, throw on 0 or 2+          (u6_arm)
 *   * re-import the patched tree and assert the edited field reads back as asked (u6_arm)
 *   * assert **every other field of every other weapon is unchanged** — widened here from
 *     `castMs` alone to the six fields a kit arm can plausibly disturb, because the field
 *     being moved must be inside the set the "nothing else moved" check can SEE
 *   * the two arms must DISAGREE on the probe                       (lk_arm)
 *
 * 🚨 **THE KNOWN-BAD IS THE POINT.** `--selftest` plants the exact failure `u6_arm` would
 * have passed — an `effect` edit that did not land — and requires this tool to FAIL it.
 * A guard that has not been shown to fail on the bug it guards against is not a guard.
 *
 *   node tools/tmp/kt_arm.mjs --selftest
 *   node tools/tmp/kt_arm.mjs --dir /tmp/fa-kt-cand --ref 48c8166 \
 *        --set waterbottle.Glass.effect=null --set waterbottle.Cap.effect=null
 *   node tools/tmp/kt_arm.mjs --dir /tmp/fa-kt-cand --ref 48c8166 --setconst SLOW_DURATION_MS=900
 *   node tools/tmp/kt_arm.mjs --dir /tmp/fa-kt-cand --show
 */
import { readFileSync, writeFileSync, existsSync } from 'node:fs';
import { execFileSync } from 'node:child_process';
import { resolve } from 'node:path';

const ROOT = resolve(new URL('../..', import.meta.url).pathname);

const args = (() => {
  const o = { set: [], setconst: [] };
  for (let i = 2; i < process.argv.length; i++) {
    const a = process.argv[i];
    if (!a.startsWith('--')) continue;
    const n = process.argv[i + 1];
    const v = n === undefined || n.startsWith('--') ? true : (i++, n);
    if (a === '--set') o.set.push(v);
    else if (a === '--setconst') o.setconst.push(v);
    else o[a.slice(2)] = v;
  }
  return o;
})();

/**
 * The six weapon fields a kit arm can move. `effect` is FIRST because it is the one this
 * pass exists to move and the one `u6_arm`'s verification is blind to.
 *
 * ⚠️ This list is what "nothing else moved" is able to SEE. A field outside it can be
 * disturbed silently — which is exactly the hole being closed here — so widening the arm
 * grammar without widening this list re-opens it.
 */
const WATCHED = ['effect', 'castMs', 'cooldown', 'damage', 'range', 'cone'];

/** Module-level scalars an arm may move. Each must be a `tune('NAME', <value>, {` site. */
const WATCHED_CONSTS = [
  'SLOW_DURATION_MS', 'SLOW_MOVE_MULTIPLIER', 'STUN_DURATION_MS',
  'SLOW_GRACE_MS', 'STUN_GRACE_MS', 'STATUS_DR_WINDOW_MS', 'PLAYER_SPEED',
];

/**
 * Replace `field: value` on the weapon record whose `key:` is `weaponKey`, inside the
 * `defineCharacter` block for `charId`. Lifted from `u6_arm.mjs:setWeaponField` — the
 * anchor logic is validated there and there is no reason to invent a second one — with
 * one change: the value is a STRING, not a number, so `null` and `'slow'` are expressible.
 */
function setWeaponField(src, charId, weaponKey, field, value) {
  const charAt = src.indexOf(`id: '${charId}',`);
  if (charAt < 0) throw new Error(`no character block for '${charId}'`);
  const nextChar = src.indexOf('defineCharacter({', charAt + 1);
  const end = nextChar < 0 ? src.length : nextChar;
  const block = src.slice(charAt, end);

  const keyRe = new RegExp(`key: '${weaponKey}',`, 'g');
  const hits = block.match(keyRe) ?? [];
  if (hits.length !== 1) throw new Error(`'${charId}.${weaponKey}': ${hits.length} matches for the key anchor, want exactly 1`);
  const keyAt = block.search(keyRe);

  const emojiAt = block.indexOf('emoji:', keyAt);
  if (emojiAt < 0) throw new Error(`'${charId}.${weaponKey}': no emoji: terminator`);
  const record = block.slice(keyAt, emojiAt);

  const fieldRe = new RegExp(`${field}: [^,]+, `);
  let patched;
  if (fieldRe.test(record)) patched = record.replace(fieldRe, `${field}: ${value}, `);
  else patched = `${record}${field}: ${value}, `;
  if (patched === record) throw new Error(`'${charId}.${weaponKey}.${field}': patch was a no-op`);

  return src.slice(0, charAt) + block.slice(0, keyAt) + patched + block.slice(emojiAt) + src.slice(end);
}

/**
 * Replace the default of a registered tunable.
 *
 * ⚠️ **THE ANCHOR IS PINNED TO THE START OF A LINE, AND THE FIRST VERSION WAS NOT.**
 * `tune('NAME', ` alone matches **twice** for `PLAYER_SPEED`: `rules.ts:35` is a doc
 * comment reading ``* `export const PLAYER_SPEED = tune('PLAYER_SPEED', 0.12, {…})` `` —
 * prose that quotes the declaration verbatim, so even `export const NAME = tune(` matches
 * it. This is `u6_arm`'s own recorded trap ("a whole-file search can never go clean",
 * because `rules.ts:3715` is a comment reading `castMs: 1100`) in a second disguise.
 * `^export const` is the one form a `*`-prefixed comment line cannot wear.
 *
 * The exactly-one-match rule is what caught it: the tool REFUSED rather than patching the
 * comment, or — much worse — patching both and leaving prose that no longer parses.
 */
function setConst(src, name, value) {
  const re = new RegExp(`^export const ${name} = tune\\('${name}', [^,]+,`, 'gm');
  const hits = src.match(re) ?? [];
  if (hits.length !== 1) throw new Error(`'${name}': ${hits.length} matches for the tune() anchor, want exactly 1`);
  const out = src.replace(re, `export const ${name} = tune('${name}', ${value},`);
  if (out === src) throw new Error(`'${name}': patch was a no-op`);
  return out;
}

/**
 * The whole watched surface of a tree, READ THROUGH THE MODULE LOADER the measurement
 * will use — never off the text this tool just wrote. Reading back the text would certify
 * a patch that landed in a comment, in a dead branch, or in the wrong character block.
 */
function fieldMap(dir) {
  const out = execFileSync(process.execPath, ['-e', `
    import('${dir}/src/game/rules.ts').then((m) => {
      const o = { weapons: {}, consts: {} };
      for (const id of m.CHARACTER_IDS) for (const w of m.CHARACTERS[id].weapons) {
        const rec = {};
        for (const f of ${JSON.stringify(WATCHED)}) rec[f] = w[f] === undefined ? null : w[f];
        o.weapons[id + '.' + w.key] = rec;
      }
      for (const c of ${JSON.stringify(WATCHED_CONSTS)}) o.consts[c] = m[c] === undefined ? null : m[c];
      console.log(JSON.stringify(o));
    }).catch((e) => { console.error(e); process.exit(1); });
  `], { encoding: 'utf8', cwd: ROOT, stdio: ['ignore', 'pipe', 'inherit'] });
  return JSON.parse(out);
}

/** `<char>.<Weapon>.<field>=<value>` — value may be `null`, `'slow'`, `750`, `0.45`. */
const SET_RE = /^([a-z]+)\.([A-Za-z]+)\.([A-Za-z]+)=(null|'[a-z]+'|-?[0-9.]+)$/;
const CONST_RE = /^([A-Z_0-9]+)=(-?[0-9._]+)$/;

/** What the loader should report for a staged literal. `null` stays null; `'slow'` unquotes. */
const expected = (literal) => (literal === 'null' ? null
  : literal.startsWith("'") ? literal.slice(1, -1)
  : Number(literal.replace(/_/g, '')));

if (args.selftest) {
  let pass = 0; let fail = 0;
  const t = (name, ok, detail = '') => { if (ok) { pass++; console.log(`  ok   ${name}`); } else { fail++; console.log(`  FAIL ${name} ${detail}`); } };
  const src = readFileSync(`${ROOT}/src/game/rules.ts`, 'utf8');
  console.log('\n══ kt_arm SELFTEST ══');

  // 1. REPLACE a string field with `null` — the edit this pass is built for.
  const a = setWeaponField(src, 'waterbottle', 'Glass', 'effect', 'null');
  const glass = a.split('\n').find((l) => l.includes(`key: 'Glass',`));
  t('replaces a status effect with null', glass.includes('effect: null,') && !glass.includes("'stun'"), glass?.trim().slice(0, 90));

  // 2. …and only on the character asked for. `Glass` is unique to waterbottle today but
  //    the bound is what makes that safe rather than lucky.
  const others = a.split('\n').filter((l, i) => l !== src.split('\n')[i]);
  t('one edit changes exactly one line', others.length === 1, `changed ${others.length}`);

  // 3. A scalar arm.
  const b = setConst(src, 'SLOW_DURATION_MS', 900);
  t('replaces a registered tunable default', /tune\('SLOW_DURATION_MS', 900,/.test(b));
  t('…and the tunable anchor is not fooled by the name in prose',
    (src.match(/SLOW_DURATION_MS/g) ?? []).length > 1 && (b.match(/tune\('SLOW_DURATION_MS', 900,/g) ?? []).length === 1,
    `${(src.match(/SLOW_DURATION_MS/g) ?? []).length} textual mentions in the file`);
  // 🚨 KNOWN-BAD, AND IT IS A REAL ONE THAT BIT THIS TOOL. `rules.ts:35` is a doc comment
  //    quoting `export const PLAYER_SPEED = tune('PLAYER_SPEED', 0.12, {…})` verbatim, so
  //    an unanchored `tune('NAME',` matches TWICE and so does `export const NAME = tune(`.
  //    Only a line-start anchor separates the declaration from prose about it.
  t('KNOWN-BAD: a doc comment quoting the declaration does not become a second match',
    (src.match(/tune\('PLAYER_SPEED', /g) ?? []).length === 2
    && (setConst(src, 'PLAYER_SPEED', 0.09).match(/tune\('PLAYER_SPEED', 0\.09,/g) ?? []).length === 1,
    `${(src.match(/tune\('PLAYER_SPEED', /g) ?? []).length} textual sites, 1 declaration`);
  t('…and the prose site is left EXACTLY as it was',
    setConst(src, 'PLAYER_SPEED', 0.09).split('\n')[34] === src.split('\n')[34],
    src.split('\n')[34].trim().slice(0, 80));

  // 4. KNOWN-BAD: an anchor that matches nothing must THROW, never return the input.
  let threw = false;
  try { setWeaponField(src, 'waterbottle', 'NoSuchWeapon', 'effect', 'null'); } catch { threw = true; }
  t('KNOWN-BAD: an unmatched weapon key throws rather than no-opping', threw);
  let threw2 = false;
  try { setConst(src, 'NO_SUCH_CONSTANT', 1); } catch { threw2 = true; }
  t('KNOWN-BAD: an unmatched constant throws rather than no-opping', threw2);
  let threw3 = false;
  try { setWeaponField(src, 'waterbottle', 'Cheese', 'effect', 'null'); } catch { threw3 = true; }
  t("KNOWN-BAD: another character's weapon key is not reachable from this block", threw3);

  // 5. 🚨 THE KNOWN-BAD THIS TOOL EXISTS FOR — the one `u6_arm` would have certified.
  //    An `effect` edit that silently missed leaves `castMs` bit-identical, so a
  //    castMs-only verifier reports a clean staging on an arm identical to its baseline.
  //    Here the same miss must be VISIBLE. Simulated on the maps directly, because the
  //    real thing would require staging a deliberately broken worktree.
  const base = { weapons: { 'waterbottle.Glass': { effect: 'stun', castMs: 0, cooldown: 1100, damage: 7, range: 116, cone: null } }, consts: {} };
  const missed = JSON.parse(JSON.stringify(base));                 // the patch did not land
  const landed = JSON.parse(JSON.stringify(base)); landed.weapons['waterbottle.Glass'].effect = null;
  const castOnly = (m) => JSON.stringify(Object.fromEntries(Object.entries(m.weapons).map(([k, v]) => [k, v.castMs])));
  t('KNOWN-BAD: a castMs-only verifier CANNOT see a missed `effect` patch (this is the hole)',
    castOnly(missed) === castOnly(landed));
  t('…and the widened field map CAN — it reports the miss',
    verify(base, missed, { 'waterbottle.Glass': { effect: null } }, {}).length > 0
    && verify(base, landed, { 'waterbottle.Glass': { effect: null } }, {}).length === 0);

  // 6. NON-VACUOUS: the watched field list must actually contain `effect`, or every row
  //    above is checking a set that cannot express this pass's change.
  t('NON-VACUOUS: `effect` is inside the watched field set', WATCHED.includes('effect'), WATCHED.join(','));

  console.log(`\n  ${pass}/${pass + fail} assertions passed\n`);
  process.exit(fail === 0 ? 0 : 1);
}

/** Diff two field maps against what was ASKED for. Returns a list of complaints. */
function verify(before, after, wantW, wantC) {
  const bad = [];
  for (const [wk, fields] of Object.entries(wantW)) {
    for (const [f, v] of Object.entries(fields)) {
      if (!after.weapons[wk]) { bad.push(`STAGING FAILED: ${wk} is not in the roster`); continue; }
      if (after.weapons[wk][f] !== v) bad.push(`STAGING FAILED: ${wk}.${f} reads ${JSON.stringify(after.weapons[wk][f])}, asked for ${JSON.stringify(v)}`);
    }
  }
  for (const [c, v] of Object.entries(wantC)) {
    if (after.consts[c] !== v) bad.push(`STAGING FAILED: ${c} reads ${after.consts[c]}, asked for ${v}`);
  }
  for (const wk of Object.keys(before.weapons)) {
    for (const f of WATCHED) {
      if (wantW[wk] && f in wantW[wk]) continue;
      if (!after.weapons[wk]) { bad.push(`STAGING BLED: ${wk} vanished`); break; }
      if (after.weapons[wk][f] !== before.weapons[wk][f]) {
        bad.push(`STAGING BLED: ${wk}.${f} moved ${JSON.stringify(before.weapons[wk][f])} -> ${JSON.stringify(after.weapons[wk][f])}`);
      }
    }
  }
  for (const c of Object.keys(before.consts)) {
    if (c in wantC) continue;
    if (after.consts[c] !== before.consts[c]) bad.push(`STAGING BLED: ${c} moved ${before.consts[c]} -> ${after.consts[c]}`);
  }
  return bad;
}

const DIR = String(args.dir ?? '/tmp/fa-kt-cand');
if (!existsSync(`${DIR}/src/game/rules.ts`)) { console.error(`no worktree at ${DIR}`); process.exit(1); }
if (args.show) { console.log(JSON.stringify(fieldMap(DIR), null, 2)); process.exit(0); }

const REF = String(args.ref ?? 'HEAD');
// Restore the arm tree to the reference commit first, so arms never stack silently.
execFileSync('git', ['-C', DIR, 'checkout', '--detach', REF], { stdio: ['ignore', 'ignore', 'inherit'] });
execFileSync('git', ['-C', DIR, 'checkout', '--', 'src/game/rules.ts'], { stdio: ['ignore', 'ignore', 'inherit'] });
const before = fieldMap(DIR);

let src = readFileSync(`${DIR}/src/game/rules.ts`, 'utf8');
const wantW = {}; const wantC = {};
for (const spec of args.set) {
  const m = SET_RE.exec(String(spec));
  if (!m) throw new Error(`--set '${spec}' is not <char>.<Weapon>.<field>=<null|'str'|number>`);
  const [, charId, key, field, literal] = m;
  if (!WATCHED.includes(field)) throw new Error(`--set '${spec}': '${field}' is outside the watched set [${WATCHED.join(', ')}], so "nothing else moved" could not see it`);
  src = setWeaponField(src, charId, key, field, literal);
  (wantW[`${charId}.${key}`] ??= {})[field] = expected(literal);
}
for (const spec of args.setconst) {
  const m = CONST_RE.exec(String(spec));
  if (!m) throw new Error(`--setconst '${spec}' is not NAME=<number>`);
  const [, name, literal] = m;
  if (!WATCHED_CONSTS.includes(name)) throw new Error(`--setconst '${spec}': '${name}' is outside the watched set`);
  src = setConst(src, name, literal);
  wantC[name] = expected(literal);
}
if (args.set.length === 0 && args.setconst.length === 0) console.log('(baseline arm — no edits)');
writeFileSync(`${DIR}/src/game/rules.ts`, src);

const after = fieldMap(DIR);
const bad = verify(before, after, wantW, wantC);
for (const b of bad) console.error(b);
if (bad.length) process.exit(1);

const label = [
  ...Object.entries(wantW).flatMap(([k, f]) => Object.entries(f).map(([n, v]) => `${k}.${n}=${JSON.stringify(v)}`)),
  ...Object.entries(wantC).map(([k, v]) => `${k}=${v}`),
].join(' ') || '(none)';
console.log(`staged ${DIR} @ ${REF}: ${label}`);
