#!/usr/bin/env node
/**
 * U6_ARM — stage ONE balance arm of the wind-up conversion into a detached worktree and
 * PROVE the staging landed before anything is measured on it.
 *
 * ── WHY IT EXISTS ───────────────────────────────────────────────────────────
 *
 * Every arm here is "the tree at <sha>, with N weapon fields changed". Editing the
 * working tree and running `roster_lab` against it is wrong twice over: peers are editing
 * files this sim imports (`ai.ts` is another pass's), and `snapshot.mjs`-style freezing
 * stops changes DURING a run without removing the ones already there. So each arm is a
 * `git worktree --detach` of a named commit with the arm's edits applied textually.
 *
 * 🚨 **AND A TEXTUAL PATCH THAT SILENTLY MISSES IS THE WHOLE RISK.** `rules.ts` is 4.5k
 * lines and a weapon record is one line inside a character block; a regex that matches
 * nothing produces an arm that is byte-identical to the baseline, which measures as
 * "the change did nothing" — a normal outcome here, and the one nobody re-checks
 * (`AGENT-BRIEF` §3). So this tool:
 *
 *   * requires EXACTLY ONE match per edit and throws on 0 or 2+;
 *   * re-IMPORTS the patched `rules.ts` in a child process and asserts the field reads
 *     back as the value asked for — the tree is verified through the module loader the
 *     measurement will use, not through the text it just wrote;
 *   * asserts every OTHER weapon's `castMs` is unchanged from the reference tree, which
 *     is `WHAT MUST BE TRUE` #4 ("weapons with no `castMs` stay bit-identical") checked
 *     at the source rather than downstream.
 *
 *   node tools/tmp/u6_arm.mjs --selftest
 *   node tools/tmp/u6_arm.mjs --ref a06c0fd --dir /tmp/fa-u6-cand \
 *        --set waterbottle.Mega.castMs=600 --set soup.Dump.castMs=600
 *   node tools/tmp/u6_arm.mjs --dir /tmp/fa-u6-cand --show
 */
import { readFileSync, writeFileSync, existsSync } from 'node:fs';
import { execFileSync } from 'node:child_process';
import { resolve } from 'node:path';

const ROOT = resolve(new URL('../..', import.meta.url).pathname);

const args = (() => {
  const o = { set: [] };
  for (let i = 2; i < process.argv.length; i++) {
    const a = process.argv[i];
    if (!a.startsWith('--')) continue;
    const n = process.argv[i + 1];
    const v = n === undefined || n.startsWith('--') ? true : (i++, n);
    if (a === '--set') o.set.push(v); else o[a.slice(2)] = v;
  }
  return o;
})();

/**
 * Replace or INSERT `field: value` on the weapon record whose `key:` is `weaponKey`,
 * inside the `defineCharacter` block for `charId`.
 *
 * A weapon record may be one line or a multi-line object literal (`taco.Double` is the
 * latter), so the anchor is the `key: '<k>'` token and the write goes immediately before
 * the record's own `emoji:` — which every record in the roster carries exactly once, and
 * which `sim.test.mjs` §24 already relies on. Bounded by the NEXT `id:` declaration so a
 * key that repeats across characters (`Cheese`, `Roll`) cannot be matched on the wrong
 * one.
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

  // The record ends at its own `emoji:`; find the first one at or after the key anchor.
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

/** Every `<char>.<weapon> -> castMs` in a tree, read through the module loader. */
function castMap(dir) {
  const out = execFileSync(process.execPath, ['-e', `
    import('${dir}/src/game/rules.ts').then((m) => {
      const o = {};
      for (const id of m.CHARACTER_IDS) for (const w of m.CHARACTERS[id].weapons) o[id + '.' + w.key] = w.castMs ?? 0;
      console.log(JSON.stringify(o));
    }).catch((e) => { console.error(e); process.exit(1); });
  `], { encoding: 'utf8', cwd: ROOT, stdio: ['ignore', 'pipe', 'inherit'] });
  return JSON.parse(out);
}

if (args.selftest) {
  let pass = 0; let fail = 0;
  const t = (name, ok, detail = '') => { if (ok) { pass++; console.log(`  ok   ${name}`); } else { fail++; console.log(`  FAIL ${name} ${detail}`); } };
  const src = readFileSync(`${ROOT}/src/game/rules.ts`, 'utf8');

  // 1. REPLACE an existing field. Mega is the roster's only `castMs` today.
  //    ⚠️ The "no 1100 anywhere" form of this assertion FAILED and was right to: `rules.ts`
  //    line 3715 is a COMMENT in soup's block reading "`castMs: 1100` WAS DERIVED …
  //    REVERTED", so a whole-file search can never go clean. Asserting on the RECORD is
  //    the thing that was meant; asserting on the file would have made this row
  //    unsatisfiable by any correct implementation.
  const a = setWeaponField(src, 'waterbottle', 'Mega', 'castMs', 600);
  const megaLine = a.split('\n').find((l) => l.includes(`key: 'Mega',`));
  t('replaces an existing castMs', megaLine.includes('castMs: 600,') && !megaLine.includes('1100'), megaLine);

  // 2. INSERT a field the record does not have.
  const b = setWeaponField(src, 'soup', 'Dump', 'castMs', 600);
  t('inserts a castMs onto a record without one', /effect: 'slow', castMs: 600, emoji: '🌊' \}/.test(b));

  // 3. A MULTI-LINE record. `taco.Double`'s object literal spans six lines and its
  //    `emoji:` sits on the FIRST of them, before `comboParts`.
  const c = setWeaponField(src, 'taco', 'Double', 'castMs', 550);
  t('patches a multi-line record', /castMs: 550, emoji: '💥'/.test(c));

  // 4. KNOWN-BAD: an anchor that matches nothing must THROW, never return the input.
  //    A silent no-op here is an arm identical to its baseline, which reads exactly like
  //    "the change did nothing" and is the failure this whole file exists to refuse.
  let threw = false;
  try { setWeaponField(src, 'waterbottle', 'NoSuchWeapon', 'castMs', 600); } catch { threw = true; }
  t('KNOWN-BAD: an unmatched weapon key throws rather than no-opping', threw);

  // 5. KNOWN-BAD: a key that exists on ANOTHER character must not be reachable from this
  //    character's block. `Cheese` is pizza's; asking waterbottle for it must throw.
  let threw2 = false;
  try { setWeaponField(src, 'waterbottle', 'Cheese', 'castMs', 600); } catch { threw2 = true; }
  t("KNOWN-BAD: another character's weapon key is not reachable", threw2);

  // 6. NOTHING ELSE MOVES. One edit changes one record; every other line is untouched.
  const diff = a.split('\n').filter((l, i) => l !== src.split('\n')[i]).length;
  t(`one edit changes exactly one line (changed ${diff})`, diff === 1);

  console.log(`\n${pass} passed, ${fail} failed`);
  process.exit(fail === 0 ? 0 : 1);
}

const DIR = String(args.dir ?? '/tmp/fa-u6-cand');
if (!existsSync(`${DIR}/src/game/rules.ts`)) { console.error(`no worktree at ${DIR}`); process.exit(1); }

if (args.show) { console.log(JSON.stringify(castMap(DIR), null, 2)); process.exit(0); }

const REF = String(args.ref ?? 'HEAD');
// Restore the arm tree to the reference commit first, so arms never stack silently.
execFileSync('git', ['-C', DIR, 'checkout', '--detach', REF], { stdio: 'inherit' });
execFileSync('git', ['-C', DIR, 'checkout', '--', 'src/game/rules.ts'], { stdio: 'inherit' });
const before = castMap(DIR);

let src = readFileSync(`${DIR}/src/game/rules.ts`, 'utf8');
const want = {};
for (const spec of args.set) {
  const m = /^([a-z]+)\.([A-Za-z]+)\.([A-Za-z]+)=(-?[0-9.]+)$/.exec(String(spec));
  if (!m) throw new Error(`--set '${spec}' is not <char>.<Weapon>.<field>=<number>`);
  const [, charId, key, field, value] = m;
  src = setWeaponField(src, charId, key, field, value);
  if (field === 'castMs') want[`${charId}.${key}`] = Number(value);
}
writeFileSync(`${DIR}/src/game/rules.ts`, src);

// ── the staging is VERIFIED through the loader, not through the text ────────
const after = castMap(DIR);
let bad = 0;
for (const [k, v] of Object.entries(want)) {
  if (after[k] !== v) { console.error(`STAGING FAILED: ${k} reads ${after[k]}, asked for ${v}`); bad++; }
}
for (const k of Object.keys(before)) {
  if (k in want) continue;
  if (after[k] !== before[k]) { console.error(`STAGING BLED: ${k} moved ${before[k]} -> ${after[k]}`); bad++; }
}
if (bad > 0) process.exit(1);
console.log(`staged ${DIR} @ ${REF}: ${Object.entries(want).map(([k, v]) => `${k}=${v}`).join(' ') || '(no castMs edits)'}`);
console.log(`castMs now: ${Object.entries(after).filter(([, v]) => v > 0).map(([k, v]) => `${k}=${v}`).join(' ') || 'none'}`);
