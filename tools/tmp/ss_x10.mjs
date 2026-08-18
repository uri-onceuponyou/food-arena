#!/usr/bin/env node
/**
 * ss_x10 — plant a KNOWN-BAD input and see which gates notice.
 *
 * Multiplies every HP and damage magnitude in `rules.ts` by a factor (default 10) inside a
 * DETACHED WORKTREE, so the whole offline gate battery can be run against a rescaled roster.
 * This is the only honest way to answer "would anything go RED if a site were left
 * un-scaled?" — reading the source tells you where the literals are, not which assertion
 * fires. A guard that has not been shown to FAIL on the bug it guards against is not a guard.
 *
 * ⚠️ IT DELIBERATELY DOES NOT TOUCH THE DISPLAY/FEEL LAYER (`hud.ts`, `match.ts`, `vfx.ts`,
 * `audio/sounds.ts`). Those hold absolute damage thresholds too, and leaving them alone is
 * the point: the experiment is "a designer rescales rules.ts and ships" — what breaks
 * loudly, and what breaks silently.
 *
 *   node tools/tmp/ss_x10.mjs --root <worktree> [--factor 10]
 *   node tools/tmp/ss_x10.mjs --selftest    # proves the rewriter actually rewrites
 *
 * Writes in place. NEVER point it at the real repo — it refuses a path that is a git
 * worktree's main checkout.
 */

import fs from 'node:fs';
import path from 'node:path';
import { fileURLToPath } from 'node:url';

const IS_MAIN = (() => {
  try { return fs.realpathSync(fileURLToPath(import.meta.url)) === fs.realpathSync(process.argv[1]); }
  catch { return false; }
})();

const argv = process.argv.slice(2);
const arg = (n, d) => { const i = argv.indexOf(n); return i >= 0 ? argv[i + 1] : d; };

/** This repo, derived — never retyped. Read-only paths only; `main()` refuses to write here. */
const REPO_ROOT = path.resolve(path.dirname(fileURLToPath(import.meta.url)), '../..');

/**
 * Every top-level magnitude that is denominated in HP. Each must be found EXACTLY ONCE at a
 * declaration. Finding it zero or twice is a hard error: a rewriter that silently no-ops is
 * the vacuous-guard failure this file exists to avoid.
 *
 * ── 🚨 §76 BROKE THIS AND THE FIX IS A DUAL-FORM MATCHER, NOT A NEW LITERAL ──────────────
 *
 * `c5b9754` routed constants through an override layer, so
 *
 *     export const PLAYER_MAX_HP = 100;                       became
 *     export const PLAYER_MAX_HP = tune('PLAYER_MAX_HP', 100, { … });
 *
 * and `/export const PLAYER_MAX_HP = (\d+);/` matched nothing. Three of the four names below
 * (`PLAYER_MAX_HP`, `ENEMY_MAX_HP`, `FOG_DAMAGE`) are registered today; `REGEN_AMOUNT` is
 * still a bare literal. **The one thing that saved this tool was the `!== 1` assertion**: it
 * threw `expected exactly 1 declaration, found 0` instead of quietly rescaling the roster and
 * leaving the pools alone. Compare `tools/tmp/ssj_plant.mjs`, which has no such assertion and
 * whose `transform()` silently produced x20 damage against a 100 HP pool (see the report).
 *
 * ⚠️ **A REGEX OVER `rules.ts` IS A SECOND COPY OF THE CONSTANT AND WILL GO STALE AGAIN.**
 * It cannot be replaced by an import here — the tool's whole job is to rewrite the DECLARATION
 * TEXT, and a value tells you nothing about where the text is. So the coupling stays, and the
 * two defences against it are:
 *   1. the dual-form pattern below, which matches whichever form is shipped, and
 *   2. `crossCheck()`, which IMPORTS the constant and refuses if the number the regex scraped
 *      disagrees with the number the sim actually runs on.
 * (2) is the part that cannot go stale silently: if a third declaration form appears, the
 * scrape either misses (count assertion fires) or reads the wrong number (cross-check fires).
 */
export const SCALAR_NAMES = ['PLAYER_MAX_HP', 'ENEMY_MAX_HP', 'FOG_DAMAGE', 'REGEN_AMOUNT'];

/**
 * The declaration of `name`, in EITHER shipped form. Group 1 is everything up to the number,
 * group 2 is the number — so a rewrite reconstructs `head + n*k` and can never damage the
 * `tune(...)` wrapper it does not understand.
 */
export const declRe = (name, flags = 'm') =>
  new RegExp(`^(export const ${name} = (?:tune\\('${name}', )?)(\\d+(?:\\.\\d+)?)`, flags);

/**
 * Does the number this file SCRAPES equal the number the sim IMPORTS?
 *
 * Read-only, and the reason the scrape is allowed to exist at all. `root` must be the same
 * tree the rewrite will be applied to, or this is checking a different file — the
 * "a passing test is not evidence the thing it points at is right" class (`CLAUDE.md` #6).
 *
 * Registered constants are compared against the registry's `authored` default rather than the
 * exported value, because `FA_TUNING` overrides the export at import time and would otherwise
 * manufacture a disagreement that is not one.
 */
export async function crossCheck(root) {
  const src = fs.readFileSync(path.join(root, 'src/game/rules.ts'), 'utf8');
  const R = await import(`${path.resolve(root)}/src/game/rules.ts`);
  const T = await import(`${path.resolve(root)}/src/game/tuning/index.ts`);
  const authored = new Map(T.authoredEntries().filter((e) => !e.key.includes('.')).map((e) => [e.key, e.authored]));
  const rows = [];
  for (const name of SCALAR_NAMES) {
    const m = declRe(name).exec(src);
    const scraped = m ? Number(m[2]) : null;
    const live = authored.has(name) ? authored.get(name) : R[name];
    rows.push({
      name, scraped, live,
      form: m ? (/tune\(/.test(m[1]) ? 'tune()' : 'bare') : 'NOT FOUND',
      agree: scraped !== null && live !== undefined && scraped === live,
    });
  }
  return rows;
}

export function rescale(src, factor, careful = false) {
  const notes = [];
  let out = src;

  for (const what of SCALAR_NAMES) {
    const hits = out.match(declRe(what, 'gm')) ?? [];
    if (hits.length !== 1) throw new Error(`${what}: expected exactly 1 declaration, found ${hits.length}`);
    out = out.replace(declRe(what), (_m, head, n) => {
      notes.push(`${what} ${n} -> ${Number(n) * factor}  [${/tune\(/.test(head) ? 'tune()' : 'bare'} form]`);
      return `${head}${Number(n) * factor}`;
    });
  }

  // POT.damage and TRAIL.damage — both are `damage: N,` inside an object literal ABOVE the
  // CHARACTERS block. Scoped by line number so the weapon table below is handled separately.
  const charsAt = out.indexOf('export const CHARACTERS');
  if (charsAt < 0) throw new Error('CHARACTERS block not found — the rewriter is pointed at the wrong file');
  let head = out.slice(0, charsAt);
  const tail = out.slice(charsAt);

  let headHits = 0;
  head = head.replace(/^(\s*)damage: (\d+),$/gm, (_m, ws, n) => {
    headHits++; notes.push(`(pre-CHARACTERS) damage ${n} -> ${n * factor}`);
    return `${ws}damage: ${Number(n) * factor},`;
  });
  if (headHits !== 2) throw new Error(`expected POT.damage + TRAIL.damage = 2 pre-roster damage fields, found ${headHits}`);

  // The weapon table. `damage:` (per-pellet/per-peck/combo-part) and `healAmount:`.
  //
  // 🚨 `careful` EXISTS BECAUSE THE NAIVE PASS IS A REAL TRAP, NOT A TOOL BUG.
  // `DisplayStats.damage` is a field literally called `damage`, holding a small integer,
  // in the same object graph as the weapon table — `stats: { damage: 10, health: 3, ... }`.
  // Any bulk rewrite (sed, regex, an agent editing in bulk) scales the CARD'S 0-10 BAR
  // along with the weapons, and the card's damage bar is DERIVED (`damageStatFor`), so the
  // authored copy going to 100 is a silent lie on a 0-10 scale. Both arms are kept:
  //   naive   — what an implementer actually types. Shows which gate catches the collateral.
  //   careful — weapons only. Shows what breaks even when the rescale is done RIGHT.
  const skipStats = (s) => s.replace(/stats: \{ damage: (\d+)/g, (_m, n) => `stats: { damageSTAT_KEEP: ${n}`);
  const restoreStats = (s) => s.replace(/stats: \{ damageSTAT_KEEP: (\d+)/g, (_m, n) => `stats: { damage: ${n}`);

  let wepHits = 0, healHits = 0;
  let work = careful ? skipStats(tail) : tail;
  work = work
    .replace(/damage: (\d+)/g, (_m, n) => { wepHits++; return `damage: ${Number(n) * factor}`; })
    .replace(/healAmount: (\d+)/g, (_m, n) => { healHits++; return `healAmount: ${Number(n) * factor}`; });
  const newTail = careful ? restoreStats(work) : work;
  if (wepHits === 0) throw new Error('no weapon damage fields rewritten — VACUOUS');
  if (healHits === 0) throw new Error('no healAmount fields rewritten — VACUOUS');
  notes.push(`mode: ${careful ? 'careful (card stats preserved)' : 'naive (bulk)'}`,
    `damage fields rewritten: ${wepHits}`, `healAmount fields: ${healHits}`);

  return { text: head + newTail, notes };
}

async function selftest() {
  let pass = 0, fail = 0;
  const ck = (n, ok, extra = '') => { console.log(`${ok ? 'PASS' : 'FAIL'}  ${n}${extra ? '  ' + extra : ''}`); ok ? pass++ : fail++; };
  // `rescale()` is PURE and `crossCheck()` is read-only, so the selftest may run against the
  // live repo; only `main()` writes, and only `main()` refuses a main checkout. Defaulting to
  // the repo means the selftest cannot pass vacuously because a scratch worktree went missing.
  const root = arg('--root', REPO_ROOT);
  const src = fs.readFileSync(path.join(root, 'src/game/rules.ts'), 'utf8');
  const { text, notes } = rescale(src, 10, true);
  // KNOWN-BAD: if the rewriter no-ops, the output equals the input. Assert it does NOT.
  ck('rewriter changed the file', text !== src);
  // ⚠️ THESE ROWS ONCE HARD-CODED THE BARE DECLARATION FORM AND THAT MADE THEM A THIRD COPY.
  // They read `/export const PLAYER_MAX_HP = 1000;/` — so after §76 wrapped the constant in
  // `tune()` they went red on a rewriter that was working, and the last one
  // (`no stale PLAYER_MAX_HP = 100`) went GREEN BY VACUITY, because the pattern it negates can
  // no longer match anything at all. Kept here as the old wording, because a negative control
  // that cannot match is the exact failure this file exists to demonstrate:
  //     ck('no stale `PLAYER_MAX_HP = 100`', !/export const PLAYER_MAX_HP = 100;/.test(text));
  // Every row below now reads the value THROUGH `declRe`, the same matcher the rewriter used,
  // so form and value are asserted once each instead of being entangled in one regex.
  const declOf = (t, n) => { const m = declRe(n).exec(t); return m ? Number(m[2]) : null; };
  ck('PLAYER_MAX_HP became 1000', declOf(text, 'PLAYER_MAX_HP') === 1000, `= ${declOf(text, 'PLAYER_MAX_HP')}`);
  ck('ENEMY_MAX_HP became 900', declOf(text, 'ENEMY_MAX_HP') === 900, `= ${declOf(text, 'ENEMY_MAX_HP')}`);
  ck('FOG_DAMAGE became 150', declOf(text, 'FOG_DAMAGE') === 150, `= ${declOf(text, 'FOG_DAMAGE')}`);
  ck('REGEN_AMOUNT became 20', declOf(text, 'REGEN_AMOUNT') === 20, `= ${declOf(text, 'REGEN_AMOUNT')}`);
  ck('POT.damage became 80', /damage: 80,/.test(text));
  ck('TRAIL.damage became 30', /damage: 30,/.test(text));
  ck('healAmount 18 became 180', /healAmount: 180/.test(text));
  // NEGATIVE CONTROL, rebuilt so it CAN fail: the declaration must not still read 100, and the
  // input must have read 100 in the first place — otherwise "it changed" is unfalsifiable.
  ck('NEGATIVE CONTROL: the input DID read 100 and the output does NOT',
    declOf(src, 'PLAYER_MAX_HP') === 100 && declOf(text, 'PLAYER_MAX_HP') !== 100,
    `${declOf(src, 'PLAYER_MAX_HP')} -> ${declOf(text, 'PLAYER_MAX_HP')}`);
  // And the rewrite must be counted, not assumed.
  const wep = notes.find((n) => n.startsWith('damage fields rewritten:'));
  ck('damage fields were counted and non-zero', !!wep && Number(wep.split(': ')[1]) > 30, wep ?? '');
  // KNOWN-BAD for the `careful` arm itself: the card's 0-10 damage bar must NOT move.
  ck('careful mode leaves the card stat alone', /stats: \{ damage: 10, health: 3/.test(text));
  const naive = rescale(src, 10, false).text;
  ck('and the NAIVE arm DOES move it (control is not vacuous)', /stats: \{ damage: 100, health: 3/.test(naive));

  // ── §76: THE DUAL-FORM MATCHER, AND A KNOWN-BAD THAT RE-PLANTS THE EXACT REGRESSION ──────
  //
  // The rows above all pass on a `rules.ts` where every constant is a bare literal — which is
  // precisely why they went GREEN in a tree the rewriter could no longer rescale. They assert
  // the OUTPUT and never assert that the INPUT was recognised in the form it actually ships in.
  //
  // ⚠️ The known-bad here is the OLD PATTERN, not a doctored file: `/export const NAME = (\d+);/`
  // is exactly what this tool shipped before `tune()` landed. If a future edit ever makes the
  // old pattern match again, this row goes red and says so — it is not a test of the tool, it
  // is a test of the CLAIM that the two forms differ, and it must not be able to pass by
  // agreeing with itself (`CLAUDE.md` #6, the vacuity class).
  {
    const forms = SCALAR_NAMES.map((n) => {
      const m = declRe(n).exec(src);
      return { n, ok: !!m, form: m ? (/tune\(/.test(m[1]) ? 'tune()' : 'bare') : 'NOT FOUND' };
    });
    ck('every named constant is FOUND in whatever form it ships in',
      forms.every((f) => f.ok), forms.map((f) => `${f.n}=${f.form}`).join(' '));
    const tuned = forms.filter((f) => f.form === 'tune()');
    ck('…and at least one ships in the `tune()` form, so the dual arm is not decorative',
      tuned.length > 0, `${tuned.length}/${forms.length} tuned`);
    const oldPattern = tuned.filter((f) => new RegExp(`export const ${f.n} = (\\d+);`).test(src));
    ck('KNOWN-BAD: the PRE-§76 single-form pattern MISSES every tuned constant',
      tuned.length > 0 && oldPattern.length === 0,
      oldPattern.length ? `still matched by the old regex: ${oldPattern.map((f) => f.n).join(',')}` : `0 of ${tuned.length} matched`);
  }

  // ── THE CROSS-CHECK: the scrape must agree with the IMPORT ───────────────────────────────
  // The scrape is the second copy; this is the only thing that keeps it honest. A pattern can
  // match the wrong number as easily as no number — `sp_place.mjs` scraped PLAYER_SPEED out of
  // a COMMENT for a whole session and never threw (`fcf6da7`).
  {
    const rows = await crossCheck(root);
    for (const r of rows) console.log(`      ${r.agree ? '  ' : '!!'} ${r.name.padEnd(22)} scraped=${r.scraped} import=${r.live}  [${r.form}]`);
    ck('CROSS-CHECK: every scraped literal equals the value the sim imports',
      rows.length === SCALAR_NAMES.length && rows.every((r) => r.agree),
      `${rows.filter((r) => r.agree).length}/${rows.length} agree`);
    // NON-EMPTY FIRST: `[].every()` is `true`. Assert the set the row above filters over exists.
    ck('…and that check ran over a NON-EMPTY set', rows.length === SCALAR_NAMES.length, `${rows.length} rows`);
  }

  console.log(`\n${pass} pass, ${fail} fail`);
  process.exitCode = fail ? 1 : 0;
}

async function main() {
  if (argv.includes('--selftest')) return selftest();
  const root = arg('--root', null);
  const factor = Number(arg('--factor', '10'));
  if (!root) { console.error('--root <worktree> required'); process.exit(2); }
  const real = fs.realpathSync(root);
  if (!fs.existsSync(path.join(real, '.git'))) { console.error('not a worktree'); process.exit(2); }
  if (fs.statSync(path.join(real, '.git')).isDirectory()) {
    console.error('REFUSING: that is a main checkout (.git is a directory), not a detached worktree');
    process.exit(2);
  }
  const f = path.join(real, 'src/game/rules.ts');
  const { text, notes } = rescale(fs.readFileSync(f, 'utf8'), factor, argv.includes('--careful'));
  fs.writeFileSync(f, text);
  console.log(`rescaled x${factor} in ${f}`);
  for (const n of notes) console.log('  ' + n);
}

if (IS_MAIN) main().catch((e) => { console.error(e); process.exit(1); });
