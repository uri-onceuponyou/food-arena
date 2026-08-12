#!/usr/bin/env node
/**
 * wj_guard — the guard on the WEAPON/ABILITY JOIN.
 *
 *   node tools/tmp/wj_guard.mjs --selftest
 *
 * Offline, no browser, ~200ms. Exits non-zero on any fault.
 *
 * ── WHAT IT GUARDS ──────────────────────────────────────────────────────────
 * `CharacterDef.abilities[]` and `CharacterDef.weapons[]` used to be sibling arrays
 * with NO link: nothing said which weapon a blurb described, so a consumer had to
 * guess — by `name`, or by INDEX. Re-derived from the tree by `wj_audit.mjs`:
 *
 *   33 of 34 abilities join to a weapon by exact `name` (the 34th is Donut's passive)
 *   30 of 34 ALSO join by index
 *   `hamburger` is the ONLY character whose arrays are in a different order — 3 of 4 rows
 *
 * **A positional join is right for 10 of the 11 characters, which is exactly why it
 * survived**, and an auditor with a purpose-built instrument joined positionally and
 * produced a confidently false finding about hamburger. `AbilityBlurb.weapon` now names
 * the weapon's `key` and `defineCharacter()` makes a key that does not exist a COMPILE
 * error; this file guards everything the type system cannot see.
 *
 * ── WHAT IMPLEMENTATION WOULD FAIL EACH ARM ─────────────────────────────────
 * (`docs/AGENT-BRIEF.md` §4.4 — if you cannot name one, it is a comment with a tick.)
 *   §S  a roster that lost a character, a weapon or a blurb        — and it runs FIRST,
 *       because `[].every()` is `true` and that trap fired three times in one session
 *   §A  two weapons on one character sharing a `key` (`find` would become order-dependent)
 *   §B  a blurb naming a key that is not on the character
 *   §C  a weapon no blurb describes, or two blurbs claiming one weapon
 *   §D  a weapon renamed without its blurb (the `name` field is still duplicated)
 *   §E  a blurb's glyph drifting from its weapon's, beyond the ONE acknowledged case
 *   §F  ANY join that reads position — reversing `weapons[]` must change nothing
 *   §G  the KNOWN-BADS: §F/§B/§C/§D are each shown to FAIL on a deliberately broken input
 *   §H  a screen holding both arrays at once, which is the only way to join wrongly again
 */
import { readFileSync, readdirSync, statSync } from 'node:fs';
import { join as pathJoin } from 'node:path';
import { fileURLToPath } from 'node:url';
import {
  CHARACTERS, CHARACTER_IDS, abilityCards, weaponForAbility,
} from '../../src/game/rules.ts';

const ROOT = fileURLToPath(new URL('../..', import.meta.url));

let pass = 0;
const faults = [];
function ok(cond, label) {
  if (cond) pass++;
  else faults.push(label);
}

// ─────────────────────────────────────────────────────────────────────────────
// §S  NON-VACUITY AND SIZE, BEFORE ANY FILTER RUNS.
//
// 🔴 Every arm below filters something. `[].every()` returns `true`, and in one session
// that exact vacuity fired three times in three files — always because a fix EMPTIED the
// filtered set the assertion ran over. So the sizes are pinned here, first, and every
// later arm asserts its own subset is non-empty before asserting over it.
// ─────────────────────────────────────────────────────────────────────────────
const defs = CHARACTER_IDS.map((id) => CHARACTERS[id]);
const N_CHARACTERS = 11;
const N_WEAPONS = 33;
const N_ABILITIES = 34;
const N_PASSIVE = 1;          // Donut's Sticky Trail — the only `weapon: null` row

ok(defs.length === N_CHARACTERS, `§S roster is ${defs.length}, expected ${N_CHARACTERS}`);
ok(defs.every((d) => d), '§S a CHARACTER_ID resolves to no def');
const allWeapons = defs.flatMap((d) => d.weapons.map((w) => ({ d, w })));
const allAbilities = defs.flatMap((d) => d.abilities.map((a) => ({ d, a })));
ok(allWeapons.length === N_WEAPONS, `§S ${allWeapons.length} weapons, expected ${N_WEAPONS}`);
ok(allAbilities.length === N_ABILITIES, `§S ${allAbilities.length} abilities, expected ${N_ABILITIES}`);
const passives = allAbilities.filter(({ a }) => a.weapon === null);
ok(passives.length === N_PASSIVE, `§S ${passives.length} passive blurbs, expected ${N_PASSIVE}`);
const joined = allAbilities.filter(({ a }) => a.weapon !== null);
ok(joined.length === N_ABILITIES - N_PASSIVE, `§S ${joined.length} joined blurbs, expected ${N_ABILITIES - N_PASSIVE}`);
ok(joined.length > 0, '§S VACUOUS: nothing to join');

// ─────────────────────────────────────────────────────────────────────────────
// §A  WEAPON KEYS ARE UNIQUE WITHIN A CHARACTER.
// The join is `weapons.find(w => w.key === a.weapon)`. `find` returns the FIRST match,
// so a duplicated key would quietly reintroduce an order dependency — the whole thing
// this file exists to remove. Keys are deliberately reused ACROSS characters
// (`Onion`, `Smash`, `Tomato`), which is fine: the join is always per-character.
// ─────────────────────────────────────────────────────────────────────────────
for (const d of defs) {
  const keys = d.weapons.map((w) => w.key);
  ok(new Set(keys).size === keys.length, `§A ${d.id} has duplicate weapon keys: ${keys.join(', ')}`);
}

// ─────────────────────────────────────────────────────────────────────────────
// §B  EVERY BLURB RESOLVES, THROUGH THE SHIPPED FUNCTION.
// Uses `weaponForAbility` itself rather than a reimplementation — a second copy of a
// join is how `driver_guard`'s 13 copies of one driver happened.
// ─────────────────────────────────────────────────────────────────────────────
let resolved = 0;
for (const d of defs) {
  for (const a of d.abilities) {
    let w = null, threw = null;
    try { w = weaponForAbility(d, a); } catch (e) { threw = e; }
    ok(!threw, `§B ${d.id}/${a.name} threw: ${threw?.message}`);
    if (a.weapon === null) ok(w === null, `§B ${d.id}/${a.name} is passive but resolved to a weapon`);
    else { ok(w?.key === a.weapon, `§B ${d.id}/${a.name} resolved to ${w?.key}, wanted ${a.weapon}`); resolved++; }
  }
}
ok(resolved === N_ABILITIES - N_PASSIVE, `§B resolved ${resolved}, expected ${N_ABILITIES - N_PASSIVE}`);

// ─────────────────────────────────────────────────────────────────────────────
// §C  BIJECTION. Every weapon is described by exactly one blurb.
// The direction that matters most: a weapon NO blurb describes is a kit slot the player
// can press and the card never mentions.
// ─────────────────────────────────────────────────────────────────────────────
for (const d of defs) {
  const claimed = d.abilities.map((a) => a.weapon).filter((k) => k !== null);
  ok(new Set(claimed).size === claimed.length, `§C ${d.id} claims a weapon twice: ${claimed.join(', ')}`);
  const unclaimed = d.weapons.filter((w) => !claimed.includes(w.key)).map((w) => w.key);
  ok(unclaimed.length === 0, `§C ${d.id} has weapons no blurb describes: ${unclaimed.join(', ')}`);
}

// ─────────────────────────────────────────────────────────────────────────────
// §D / §E  THE DUPLICATED DISPLAY FIELDS.
//
// `name` and `emoji` still live on the blurb, and that is a MEASUREMENT: all 33 joined
// rows already carry the weapon's name verbatim, so deriving `name` would be
// text-neutral — but only 32 of 33 carry the weapon's emoji. `lollipop`'s Giant
// Lollipop blurb shows 💫 where its weapon shows 🍭, so deriving the glyph would have
// silently changed a rendered icon on that card. Duplication that cannot be removed is
// guarded instead: drift is a red gate rather than a silent mismatch.
//
// ⚠️ `EMOJI_ACK` IS A BUDGET THAT MAY ONLY SHRINK — the same rule `al_guard`'s ACK list
// runs under. Adding an entry to make this arm green is the failure mode it guards.
// ─────────────────────────────────────────────────────────────────────────────
const EMOJI_ACK = [['lollipop', 'Giant']];
let nameChecked = 0, emojiChecked = 0;
for (const d of defs) {
  for (const a of d.abilities) {
    if (a.weapon === null) continue;
    const w = weaponForAbility(d, a);
    ok(a.name === w.name, `§D ${d.id}/${a.weapon}: blurb name '${a.name}' != weapon name '${w.name}'`);
    nameChecked++;
    if (EMOJI_ACK.some(([id, k]) => id === d.id && k === a.weapon)) continue;
    ok(a.emoji === w.emoji, `§E ${d.id}/${a.weapon}: blurb emoji '${a.emoji}' != weapon emoji '${w.emoji}'`);
    emojiChecked++;
  }
}
ok(nameChecked === 33, `§D checked ${nameChecked} names, expected 33`);
ok(emojiChecked === 32, `§E checked ${emojiChecked} emojis, expected 32 (33 minus ${EMOJI_ACK.length} acknowledged)`);
ok(EMOJI_ACK.length === 1, `§E the emoji ACK budget is ${EMOJI_ACK.length}; it may only SHRINK`);

// ─────────────────────────────────────────────────────────────────────────────
// §F  ORDER INDEPENDENCE — the defect itself, measured rather than argued.
//
// Reordering `weapons[]` must not change a single rendered pairing. Reordering
// `abilities[]` must not change any PAIRING either — only the sequence in which the
// rows are listed, which is authored presentation order and is what `home.ts` draws.
// ─────────────────────────────────────────────────────────────────────────────
const sig = (def) => abilityCards(def).map((c) => `${c.name}|${c.weapon?.key ?? '-'}`);

for (const d of defs) {
  const base = sig(d);
  ok(base.length === d.abilities.length && base.length > 0, `§F ${d.id} produced ${base.length} cards`);
  // (a) weapons reversed — the pairing must be BYTE-IDENTICAL, order included.
  ok(JSON.stringify(sig({ ...d, weapons: [...d.weapons].reverse() })) === JSON.stringify(base),
    `§F ${d.id}: reversing weapons[] changed the join`);
  // (b) abilities reversed — the SET of pairings must be identical (the list order
  //     legitimately follows the authored ability order, and only that).
  ok(JSON.stringify(sig({ ...d, abilities: [...d.abilities].reverse() }).slice().reverse()) === JSON.stringify(base),
    `§F ${d.id}: reversing abilities[] changed a pairing`);
}

// ─────────────────────────────────────────────────────────────────────────────
// §H  SOURCE CENSUS — no screen may hold both arrays.
//
// The strongest form of "no consumer can join positionally by accident" is that no
// consumer HAS both arrays to join. `rules.ts` is the only file allowed to name both;
// every screen goes through `abilityCards()`. Comments are stripped first, because the
// migrated `characterSelect.ts` quotes the old join in a comment — house style keeps
// reversed wording — and a census that cannot tell code from prose would flag it.
// ─────────────────────────────────────────────────────────────────────────────
function stripComments(src) {
  return src.replace(/\/\*[\s\S]*?\*\//g, ' ').replace(/(^|[^:])\/\/[^\n]*/g, '$1');
}
function walk(dir, out = []) {
  for (const e of readdirSync(dir)) {
    const p = pathJoin(dir, e);
    if (statSync(p).isDirectory()) walk(p, out);
    else if (p.endsWith('.ts')) out.push(p);
  }
  return out;
}
/** The census predicate, factored out so §G can run it on a known-bad string. */
export function holdsBothArrays(src) {
  const code = stripComments(src);
  return /\.abilities\b/.test(code) && /\.weapons\b/.test(code);
}
const files = walk(pathJoin(ROOT, 'src'));
ok(files.length > 50, `§H census swept only ${files.length} files — is it pointed at src/?`);
const abilityFiles = files.filter((f) => /\.abilities\b/.test(stripComments(readFileSync(f, 'utf8'))));
ok(abilityFiles.length > 0, '§H VACUOUS: no file in src/ reads .abilities');
for (const f of abilityFiles) {
  const rel = f.slice(ROOT.length);
  if (rel === 'src/game/rules.ts') continue;
  ok(!holdsBothArrays(readFileSync(f, 'utf8')),
    `§H ${rel} holds BOTH .abilities and .weapons — it can join them itself; go through abilityCards()`);
}

// ─────────────────────────────────────────────────────────────────────────────
// §G  KNOWN-BAD INPUTS. A guard that has not been shown to FAIL is not a guard.
// Every arm above is re-run against an input that breaks exactly what it checks, and
// each must be caught. A known-bad that is NOT caught is a fault here.
// ─────────────────────────────────────────────────────────────────────────────
function caught(fn) { try { fn(); return false; } catch { return true; } }

// §G1 THE HEADLINE KNOWN-BAD: the positional join, which is what a consumer reaches for
//     when there is no link. It must differ from the real join on hamburger and ONLY on
//     hamburger — which is simultaneously a re-derivation of the audit's C3.
const positional = (def) => def.abilities.map((a, i) => `${a.name}|${def.weapons[i]?.key ?? '-'}`);
const movedBy = defs
  .map((d) => ({ id: d.id, n: positional(d).filter((s, i) => s !== sig(d)[i]).length }))
  .filter((r) => r.n > 0);
ok(movedBy.length === 1 && movedBy[0].id === 'hamburger',
  `§G1 the positional join differs on ${JSON.stringify(movedBy)}; expected hamburger alone`);
ok(movedBy[0]?.n === 3, `§G1 hamburger's positional join moves ${movedBy[0]?.n} rows, expected 3`);
// …and the §F arm must be the thing that catches it: a def whose join is positional
// fails §F(a), because reversing `weapons[]` then reorders every row.
const posSig = (def) => positional(def);
const hb = CHARACTERS.hamburger;
ok(JSON.stringify(posSig({ ...hb, weapons: [...hb.weapons].reverse() })) !== JSON.stringify(posSig(hb)),
  '§G1 §F(a) would NOT catch a positional join — the arm is tautological');

// §G2 a dangling key must THROW, not return null and silently drop the row.
ok(caught(() => weaponForAbility({ ...hb, weapons: [] }, hb.abilities[0])),
  '§G2 a blurb naming a missing weapon did not throw');
ok(caught(() => abilityCards({ ...hb, weapons: hb.weapons.filter((w) => w.key !== 'Tomato') })),
  '§G2 abilityCards survived a missing weapon — a row would be silently wrong');

// §G3 §D must fail on a renamed weapon.
{
  const bad = { ...hb, weapons: hb.weapons.map((w) => (w.key === 'Smash' ? { ...w, name: 'Patty Pat' } : w)) };
  const a = bad.abilities.find((x) => x.weapon === 'Smash');
  ok(a.name !== weaponForAbility(bad, a).name, '§G3 §D would not catch a renamed weapon');
}

// §G4 §C must fail on an unclaimed weapon and on a double claim.
{
  const dropped = { ...hb, abilities: hb.abilities.filter((a) => a.weapon !== 'Onion') };
  const claimed = dropped.abilities.map((a) => a.weapon).filter((k) => k !== null);
  ok(dropped.weapons.some((w) => !claimed.includes(w.key)), '§G4 §C would not catch an undescribed weapon');
  const dup = [...hb.abilities.map((a) => a.weapon), 'Onion'].filter((k) => k !== null);
  ok(new Set(dup).size !== dup.length, '§G4 §C would not catch a doubly-claimed weapon');
}

// §G5 §H must fail on the REAL pre-change line, re-injected verbatim. This is the
//     historical defect, not a synthetic one: it is what `characterSelect.ts` shipped.
ok(holdsBothArrays("for (const ability of def.abilities) {\n  const weapon = def.weapons.find((w) => w.name === ability.name);\n}"),
  '§G5 §H would not catch the historical characterSelect join');
// …and its POSITIVE CONTROL: the migrated form must NOT be flagged, or §H would scream
// at everything and "pass" every refusal test in the file.
ok(!holdsBothArrays("for (const ability of abilityCards(def)) {\n  const weapon = ability.weapon;\n}"),
  '§G5 §H flags the MIGRATED form — the census is not discriminating, it is just loud');
// …and a comment quoting the old join must NOT be flagged, which is why comments are
// stripped: `characterSelect.ts` keeps the reversed wording above the new code.
ok(!holdsBothArrays("// > `const weapon = def.weapons.find((w) => w.name === ability.name);`\nconst x = abilityCards(def);"),
  '§G5 §H flags a QUOTED join in a comment');

// ─────────────────────────────────────────────────────────────────────────────
const total = pass + faults.length;
for (const f of faults) console.log('  FAULT ' + f);
console.log(`wj_guard: ${pass}/${total} checks passed`);
process.exit(faults.length ? 1 : 0);
