#!/usr/bin/env node
/**
 * TUN_SCRAPES — which tools read `rules.ts` as TEXT, and which of them §76 just broke.
 *
 *   node tools/tmp/tun_scrapes.mjs            # the collision table
 *   node tools/tmp/tun_scrapes.mjs --all      # every scrape, registered or not
 *   node tools/tmp/tun_scrapes.mjs --selftest # the known-bad arm
 *
 * ── WHY THIS EXISTS ───────────────────────────────────────────────────────
 *
 * `DECISIONS-FOR-URI.md` §76 routes constants through an override layer, so
 *
 *     export const MIN_SAFE_RADIUS = 140;
 *
 * became
 *
 *     export const MIN_SAFE_RADIUS = tune('MIN_SAFE_RADIUS', 140, { … });
 *
 * **Seven tools do not import that constant. They regex it out of the source file.**
 * `/export const MIN_SAFE_RADIUS = ([\d.]+)/` no longer matches anything, and the tool dies on
 * `Cannot read properties of null (reading '1')` — or, in the tools that guard the exec, on a
 * message naming a constant that is still very much there.
 *
 * 🚨 **THIS IS THE REPO'S MOST-RECORDED DEFECT SHAPE WEARING AN UNUSUAL COSTUME.** `CLAUDE.md`:
 * *"this project's most-repeated defect, by a wide margin, is one rule stated in two places"* —
 * five AI driver bugs, `range` as two quantities in one number, the 1× map literals, a fog
 * formula duplicated so it *"AGREED BY CONSTRUCTION"*. A regex over `rules.ts` is a second copy
 * of the constant that agrees by construction **until the declaration is reformatted**, which
 * is exactly what happened. Nobody had written the coupling down, so nothing could warn.
 *
 * The fix is the same everywhere and is strictly better than what is there:
 *
 *     -const MIN_SAFE_RADIUS = num(/export const MIN_SAFE_RADIUS = ([\d.]+)/, 'MIN_SAFE_RADIUS');
 *     +import { MIN_SAFE_RADIUS } from '../../src/game/rules.ts';
 *
 * Every one of these already runs under Node with `.ts` imports — that is why `src/game/` files
 * carry explicit `.ts` extensions at all — so the import costs nothing and cannot go stale.
 *
 * ⚠️ **THIS TOOL IS A LOCATOR, NOT A GATE, AND IT DOES NOT EXIT 1 ON A COLLISION.** The tools
 * it names are outside the §76 pass's owned file set (`CLAUDE.md` #9), so it reports rather
 * than fails: turning it red would only add an eleventh red row to a battery that already has
 * ten. Once they are fixed, `--strict` is the flag that makes it a guard.
 */

import { readFileSync, readdirSync, existsSync } from 'node:fs';
import { resolve, join } from 'node:path';

const ROOT = resolve(new URL('../..', import.meta.url).pathname);
const args = new Set(process.argv.slice(2));

/**
 * Every `export const <KEY> = ` that appears inside a REGEX LITERAL or a string in a tool.
 *
 * ⚠️ Deliberately loose. A tighter pattern would have to model every way a regex can be built
 * — `new RegExp('export const ' + k + ' = …')` is in the tree too — and a locator that misses
 * a caller is worse than one that names an extra file: the whole point is that nobody knew the
 * coupling existed. Each hit prints its line, so a false positive costs one glance.
 */
const SCRAPE = /export const\s+\\?\{?\s*([A-Z][A-Z0-9_]*)\s*\\?\}?\s*=/g;

function toolFiles() {
  const out = [];
  for (const dir of ['tools', 'tools/tmp']) {
    const abs = join(ROOT, dir);
    if (!existsSync(abs)) continue;
    for (const f of readdirSync(abs)) {
      if (f.endsWith('.mjs') || f.endsWith('.js')) out.push(join(dir, f));
    }
  }
  return out.sort();
}

/**
 * Blank out comments, keeping line numbering intact.
 *
 * 🚨 **WITHOUT THIS THE LOCATOR REPORTS ITSELF, AND IT DID.** The first draft flagged
 * `tun_gate.mjs:368` and `tun_scrapes.mjs:20` — both of which are PROSE *about* scraping,
 * inside `//` and `/* *\/` blocks. A locator whose output includes its own documentation is
 * one nobody reads twice, and the negative-control row caught it on the first run, which is
 * the whole argument for having one: the two positive rows passed happily either way.
 */
function stripComments(text) {
  const noBlocks = text.replace(/\/\*[\s\S]*?\*\//g, (m) => m.replace(/[^\n]/g, ' '));
  return noBlocks
    .split('\n')
    .map((line) => {
      const i = line.indexOf('//');
      // ⚠️ Only a line-leading `//` is treated as a comment. A `//` mid-line is far more often
      // an empty regex or a URL here than a trailing comment, and over-stripping would hide a
      // real scrape — which is the failure that matters. Under-stripping costs a false line.
      return /^\s*\/\//.test(line) ? '' : (i > 0 && /^\s*$/.test(line.slice(0, i)) ? '' : line);
    })
    .join('\n');
}

/** Scrapes found in one tool: key -> [line numbers]. */
function scrapesIn(rel) {
  const text = stripComments(readFileSync(join(ROOT, rel), 'utf8'));
  const found = new Map();
  const lines = text.split('\n');
  lines.forEach((line, i) => {
    // Only lines that look like they are MATCHING source, not lines that ARE source.
    if (!/\/.*export const|RegExp\(|includes\('export const|indexOf\('export const/.test(line)) return;
    for (const m of line.matchAll(SCRAPE)) {
      const k = m[1];
      if (!found.has(k)) found.set(k, []);
      found.get(k).push(i + 1);
    }
  });
  return found;
}

// ═════════════════════════════════════════════════════════════════════════════
// --selftest — a locator that cannot find a known scrape is worthless
// ═════════════════════════════════════════════════════════════════════════════
if (args.has('--selftest')) {
  let pass = 0; let fail = 0;
  const ok = (name, cond, detail = '') => {
    if (cond) { pass++; console.log(`   PASS  ${name}${detail ? `  ${detail}` : ''}`); }
    else { fail++; console.log(`   FAIL  ${name}${detail ? `  ${detail}` : ''}`); }
  };
  console.log('\n══ tun_scrapes SELFTEST ══\n');

  // 🚨 THE POSITIVE CONTROL IS A REAL FILE IN THE TREE, NOT A FIXTURE. A locator validated
  // only against a string it was handed proves it can read that string.
  const known = 'tools/tmp/sp_place.mjs';
  const hits = existsSync(join(ROOT, known)) ? scrapesIn(known) : new Map();
  ok('KNOWN SCRAPE: sp_place.mjs is caught reading MIN_SAFE_RADIUS out of rules.ts',
    hits.has('MIN_SAFE_RADIUS'), `line ${(hits.get('MIN_SAFE_RADIUS') ?? []).join(',')}`);
  ok('…and PLAYER_SPEED in the same file, so it finds MORE THAN ONE per tool',
    hits.has('PLAYER_SPEED'), `line ${(hits.get('PLAYER_SPEED') ?? []).join(',')}`);

  // The negative control. Without it, a matcher that returned every key on every line would
  // pass the row above and be useless.
  const clean = scrapesIn('tools/tmp/tun_gate.mjs');
  ok('NEGATIVE CONTROL: a tool that IMPORTS rather than scrapes is not flagged',
    clean.size === 0, `${clean.size} scrape(s) found`);

  // …and the registry has to be readable, or the collision table below is empty for the wrong
  // reason — the vacuity class (`CLAUDE.md` #6).
  const T = await import(`${ROOT}/src/game/tuning/index.ts`);
  const keys = T.authoredEntries().filter((e) => !e.key.includes('.')).map((e) => e.key);
  ok('NON-EMPTY registered scalar keys, so an empty table means "no collisions"',
    keys.length > 0, `${keys.length} keys`);

  console.log(`\n   ${pass}/${pass + fail} assertions passed\n`);
  process.exit(fail ? 1 : 0);
}

// ═════════════════════════════════════════════════════════════════════════════
// the report
// ═════════════════════════════════════════════════════════════════════════════
const T = await import(`${ROOT}/src/game/tuning/index.ts`);
const registered = new Set(T.authoredEntries().filter((e) => !e.key.includes('.')).map((e) => e.key));

const rows = [];
for (const rel of toolFiles()) {
  let hits;
  try { hits = scrapesIn(rel); } catch { continue; }
  for (const [key, lines] of hits) {
    const collides = registered.has(key);
    if (collides || args.has('--all')) rows.push({ rel, key, lines, collides });
  }
}

const collisions = rows.filter((r) => r.collides);
const byKey = new Map();
for (const r of collisions) {
  if (!byKey.has(r.key)) byKey.set(r.key, []);
  byKey.get(r.key).push(r);
}

console.log('\n══ TUN_SCRAPES ══  tools that read `rules.ts` as TEXT rather than importing it\n');
console.log(`   registered top-level constants   ${registered.size}`);
console.log(`   scrape sites found               ${rows.length}`);
console.log(`   COLLISIONS (scraped AND routed through tune())  ${collisions.length}\n`);

if (collisions.length === 0) {
  console.log('   none — every scraped constant is still a bare literal.\n');
} else {
  for (const [key, list] of [...byKey.entries()].sort()) {
    console.log(`   ${key}`);
    for (const r of list) console.log(`     ${r.rel}:${r.lines.join(',')}`);
    console.log(`     FIX  import { ${key} } from '../../src/game/rules.ts';`);
    console.log('');
  }
  console.log('   ⚠️ These files are outside the §76 pass\'s owned file set and are REPORTED, not');
  console.log('      edited. Every fix is one import replacing one regex, and the import cannot');
  console.log('      go stale the way the regex just did.\n');
}

// ═════════════════════════════════════════════════════════════════════════════
// FAMILY 2 — tools that STAGE an explicit list of `src/game` modules
// ═════════════════════════════════════════════════════════════════════════════
//
// 🚨 **THE SAME SIX-ELEMENT ARRAY IS COPY-PASTED INTO TEN TOOLS**:
//
//     ['sim.ts', 'ai.ts', 'movement.ts', 'combat.ts', 'state.ts', 'rules.ts']
//
// It is the transitive closure of `sim.ts`'s imports, written out by hand, in ten places, with
// nothing keeping any copy honest. §76 added `tuningRegistry.ts` + `tuningStore.ts` to that
// closure, so all ten stage a `rules.ts` whose import cannot resolve and die on
// `ERR_MODULE_NOT_FOUND`. Only four are in `gatecount`'s registry, so only four went red —
// **the other six are broken and silent**, including `roster_lab` (the roster balance tool)
// and `rg2_mutants` (the §29 known-bad battery, which `docs/TOOLS.md` notes is NOT run by
// `gatecount`). A red gate you can see is the lucky half of this.
//
// One-token fix per file. The better fix is to derive the closure rather than type it.

const STAGE_LIST = /\[\s*'sim\.ts'\s*,[^\]]*'rules\.ts'\s*\]/;
const stagers = [];
for (const rel of toolFiles()) {
  let text;
  try { text = readFileSync(join(ROOT, rel), 'utf8'); } catch { continue; }
  const stripped = stripComments(text);
  if (!STAGE_LIST.test(stripped)) continue;
  const line = stripped.split('\n').findIndex((l) => STAGE_LIST.test(l)) + 1;
  const patched = /tuningRegistry\.ts/.test(stripped);
  stagers.push({ rel, line, patched });
}

const broken = stagers.filter((s) => !s.patched);
console.log('══ FAMILY 2 ══  tools staging a HAND-WRITTEN list of `src/game` modules\n');
console.log(`   tools carrying the list          ${stagers.length}`);
console.log(`   MISSING the tuning modules       ${broken.length}\n`);
for (const s of broken) console.log(`     ${s.rel}:${s.line}`);
if (broken.length) {
  console.log('\n     FIX  add \'tuningRegistry.ts\', \'tuningStore.ts\' to the list — or derive the');
  console.log('          closure instead of typing it, which is why ten copies drifted at once.\n');
}

// Locator, not a gate — see the header. `--strict` is for after both families are fixed.
process.exit(args.has('--strict') && (collisions.length || broken.length) ? 1 : 0);
