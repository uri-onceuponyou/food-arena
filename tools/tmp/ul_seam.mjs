#!/usr/bin/env node
/**
 * ul_seam — the lobby loadout's SOURCE seams. Offline, no browser, no GPU.
 *
 *   node tools/tmp/ul_seam.mjs
 *   node tools/tmp/ul_seam.mjs --selftest     # the tool's LOGIC, with known-bads
 *
 * ── WHY THIS EXISTS, AND WHAT IT REPLACES ──────────────────────────────────
 * 🚨 `src/ui/screens/lobby.ts`, `src/ui/icons/items.ts` and `src/ui/icons/index.ts`
 * between them cited **`tools/tmp/il_seam.mjs`** and **`tools/tmp/il_accept.mjs`** six
 * times, in the present tense, as the things that checked their claims. **Neither file
 * has ever existed in this repo** (`git log --all -- tools/tmp/il_*` is empty). One of
 * those citations was attached to the sentence *"every glyph … is checked for contrast
 * against WCAG 2.1 SC 1.4.11's 3.0 floor"* — a measurement that was never taken, under a
 * heading reading **"WHAT HAS AND HAS NOT BEEN MEASURED"**.
 *
 * That is the failure `CLAUDE.md` opens with, in its purest form: a claim reads as
 * verified *because it carries a citation*. This file and `ul_accept.mjs` are the two
 * tools those six references now point at, and every claim they name is a row here.
 *
 * ── THE FOUR SEAMS ─────────────────────────────────────────────────────────
 *   §S  STORAGE     the equipped pair has exactly ONE home, and the eviction is a row
 *   §W  WIRING      the two derived honesty booleans agree with the tree, BOTH ways
 *   §I  ICONS       three flat icon records, merged with `...`, must not collide
 *   §L  LOBBY       the screen reads the model rather than restating it
 *
 * ── VACUITY (`CLAUDE.md` rule 6) ───────────────────────────────────────────
 * `[].every()` is `true`. Every filtered set below is asserted NON-EMPTY before anything
 * is quantified over it, and the sources are asserted to be non-trivial before they are
 * searched — a `readFileSync` that returned an empty string would make every "does not
 * contain" row pass. §G is that guard and a failure there ABORTS.
 *
 * ⚠️ `--selftest` validates this file's LOGIC. It does NOT validate where it is POINTED —
 * §G is the only thing that does, and it is why §G reads real byte counts.
 *
 * ⚠️ This file states no expected assertion COUNT. Counts live only in `docs/TOOLS.md`'s
 * gate table (`gatecount.mjs` refuses a second copy even one that agrees), and this tool
 * is not in that registry: it is a pass-local gate, run by hand and by `ul_accept.mjs`.
 */

import { readFileSync } from 'node:fs';
import { execSync } from 'node:child_process';
import { join, dirname } from 'node:path';
import { fileURLToPath, pathToFileURL } from 'node:url';

const HERE = dirname(fileURLToPath(import.meta.url));
const ROOT = join(HERE, '../..');

let pass = 0; let fail = 0;
const failures = [];
function ok(label, cond, evidence = '') {
  if (cond) { pass++; console.log(`  ✓ ${label}${evidence ? `  — ${evidence}` : ''}`); }
  else { fail++; failures.push(label); console.log(`  ✗ ${label}  — ${evidence}`); }
  return !!cond;
}
function section(t) { console.log(`\n── ${t} ${'─'.repeat(Math.max(0, 74 - t.length))}`); }

/** Comment-stripped source. A rule about what a file SAYS must not match its own prose. */
export function strip(src) {
  return src.replace(/\/\*[\s\S]*?\*\//g, '').replace(/^\s*\/\/.*$/gm, '');
}

const read = (rel) => readFileSync(join(ROOT, rel), 'utf8');

/**
 * ── THE TWO FACTS THE SCREEN'S HONESTY LINE IS BUILT FROM ──────────────────
 *
 * Exported so `ul_accept.mjs` can compare the SENTENCE ON THE SCREEN against the TREE in
 * one place rather than two. Each is a predicate over source, and each is falsifiable in
 * both directions by `--selftest`, which feeds it a synthetic wired tree.
 */

/**
 * Does a match read the lobby's loadout?
 *
 * The chain is `matchScreen.ts:startGame(...)` → `match.ts:GameSessionOptions` →
 * `match.ts:newMatch` → `sim.ts:FighterConfig.items`. The right-hand end EXISTS (that is
 * asserted separately, and it is why this predicate tests the LEFT end): what is missing
 * is any caller. Both conditions are required, because either alone is a dead half.
 */
export function loadoutReachesMatch(sources) {
  const ms = strip(sources.matchScreen);
  const mt = strip(sources.match);
  const screenCalls = /loadEquipped\s*\(/.test(ms) && /\bitems\s*:/.test(ms);
  const sessionCarries = /\bitems\?\s*:/.test(mt) && /\bitems\b/.test(mt);
  return screenCalls && sessionCarries;
}

/**
 * Can the human player press an active item?
 *
 * `state.ts:FighterInput.useItem` is the only channel. `sim.ts` READS it; the question is
 * whether anything WRITES it. A write is `useItem:` or `useItem =` outside the two files
 * that declare and consume it — so the predicate is a census over the rest of `src/`,
 * which is what makes it survive the field being renamed in one place.
 */
export function playerCanPressAnItem(writers) {
  return writers.length > 0;
}

/**
 * Is this source a WRITER of `FighterInput.useItem`?
 *
 * 🚨 **THE FIRST VERSION OF THIS RETURNED A CONFIDENT WRONG ANSWER AND THE ROW CAUGHT
 * IT** — `CLAUDE.md` rule 6, on the tool rather than on the code. It tested
 * `/useItem\s*=[^=]/`, which matches `sim.ts`'s **`const useItem = fi.useItem ?? null;`**
 * — a LOCAL BINDING named after the field it reads. W2 therefore reported "the tree says
 * the player CAN press an item" on a tree where nothing writes it, and the only thing
 * standing between that and a screen printing a false sentence was that the declared
 * boolean disagreed.
 *
 * A write is one of exactly two shapes, and neither can be a local:
 *   * an object-literal / interface key   `useItem: slot`
 *   * a property assignment                `input.useItem = slot`
 *
 * `state.ts` is excluded because it DECLARES the field; the declaration is the channel,
 * not a use of it.
 */
export function writesUseItem(body) {
  return /\buseItem\s*:/.test(body) || /\.\s*useItem\s*=[^=]/.test(body);
}

/** Every file under `src/` that WRITES `useItem`, excluding its declaration and its read. */
function useItemWriters() {
  const out = execSync(
    'grep -rln "useItem" src --include=*.ts || true',
    { cwd: ROOT, encoding: 'utf8' },
  ).trim();
  const files = out ? out.split('\n') : [];
  return files.filter((f) => {
    if (f.endsWith('src/game/state.ts')) return false; // the declaration
    return writesUseItem(strip(read(f)));
  });
}


// ─────────────────────────────────────────────────────────────────────────────
async function main() {
  const sources = {
    lobby: read('src/ui/screens/lobby.ts'),
    items: read('src/ui/icons/items.ts'),
    iconIndex: read('src/ui/icons/index.ts'),
    match: read('src/game/match.ts'),
    matchScreen: read('src/ui/screens/matchScreen.ts'),
    economyState: read('src/game/economy/state.ts'),
    profile: read('src/ui/screens/profile.ts'),
    simState: read('src/game/state.ts'),
    tuning: read('src/game/economy/tuning.ts'),
    trophyRoad: read('src/game/economy/trophyRoad.ts'),
  };

  section('§G — NON-VACUITY. Nothing below runs unless every source is real and non-trivial');
  let sane = true;
  for (const [name, src] of Object.entries(sources)) {
    const clean = strip(src);
    if (!ok(`G. ${name} is pointed at a real, non-trivial file`, clean.length > 500,
      `${src.length} bytes, ${clean.length} after comment strip`)) sane = false;
  }
  if (!sane) { report(); return; }

  // ── §S — STORAGE ─────────────────────────────────────────────────────────
  section('§S — the equipped pair has exactly ONE home');
  const lobby = strip(sources.lobby);
  const KEY = /'food-arena\.loadout\.v1'/;
  ok('S0. the lobby declares the loadout key and EXPORTS the two accessors',
    KEY.test(lobby) && /export function loadEquipped\s*\(/.test(lobby)
    && /export function saveEquipped\s*\(/.test(lobby));

  // The whole point of a single home. A second file writing this key is the drift this
  // section exists to make impossible; the filter is asserted non-empty first, because a
  // glob that matched nothing would pass this row vacuously.
  const keyHits = execSync('grep -rl "food-arena.loadout" src || true', { cwd: ROOT, encoding: 'utf8' })
    .trim().split('\n').filter(Boolean);
  if (ok('S1a. the census FOUND the key at all (non-empty before the assertion)',
    keyHits.length > 0, keyHits.join(', ') || 'NOTHING')) {
    ok('S1b. exactly ONE file under src/ touches the loadout key',
      keyHits.length === 1 && keyHits[0].endsWith('src/ui/screens/lobby.ts'), keyHits.join(', '));
  }

  // 🚨 THE EVICTION ROW. The lodger's whole justification is that `EconomyState` cannot
  // hold this yet. The day it can, the localStorage key becomes a SECOND source of truth
  // and this row goes red naming the move — rather than the two quietly disagreeing.
  const eco = strip(sources.economyState);
  const ecoHasEquipped = /\bequipped\s*[?]?\s*:/.test(eco) || /\bloadout\s*[?]?\s*:/.test(eco);
  ok('S2. EVICTION: `EconomyState` still has NO equipped/loadout field, so the lobby key is'
    + ' the only home — the day it grows one, MOVE the array and delete `LOADOUT_KEY`',
    !ecoHasEquipped, ecoHasEquipped ? 'EconomyState now carries it — MOVE IT' : 'not yet');

  // The reason the profile blob is not available. Re-derived rather than inherited: the
  // old header asserted this and nothing checked it.
  const commit = /private commit\(\)[\s\S]{0,700}?\n  \}/.exec(sources.profile)?.[0] ?? '';
  if (ok('S3a. found `profile.ts:commit()` (non-empty before the assertion)', commit.length > 60,
    `${commit.length} chars`)) {
    const keys = [...commit.matchAll(/^\s{8}([a-zA-Z]+):/gm)].map((m) => m[1]);
    ok('S3b. `commit()` writes a FIXED field list, so a 7th key from outside is DESTROYED —'
      + ' which is why the loadout is not in the profile blob',
      keys.length === 6 && !keys.includes('loadout') && !keys.includes('equipped'),
      `[${keys.join(', ')}]`);
  }

  ok('S4. `EconomyState.items` is OWNERSHIP and the lobby reads it through `ownedItemSet`,'
    + ' never by touching the array',
    /ownedItemSet\s*\(/.test(lobby) && !/\.economy\.items/.test(lobby)
    && /export function ownedItemSet/.test(eco));

  // ── §W — WIRING. The two booleans, against the tree, in both directions. ──
  section('§W — the screen\'s honesty booleans agree with the tree');
  const declared = {
    reaches: /const LOADOUT_REACHES_MATCH = (true|false)/.exec(lobby)?.[1] === 'true',
    press: /const PLAYER_CAN_PRESS_AN_ITEM = (true|false)/.exec(lobby)?.[1] === 'true',
  };
  const actual = {
    reaches: loadoutReachesMatch(sources),
    press: playerCanPressAnItem(useItemWriters()),
  };
  ok('W1. `LOADOUT_REACHES_MATCH` matches the tree', declared.reaches === actual.reaches,
    `declared ${declared.reaches}, tree ${actual.reaches}`
    + (actual.reaches ? '' : ' (GameSessionOptions has no `items`; matchScreen never calls `loadEquipped`)'));
  ok('W2. `PLAYER_CAN_PRESS_AN_ITEM` matches the tree', declared.press === actual.press,
    `declared ${declared.press}, tree ${actual.press}`
    + (actual.press ? '' : ` (writers of FighterInput.useItem: ${useItemWriters().join(', ') || 'NONE'})`));

  // The RIGHT-HAND end of the chain, asserted separately — it is what makes W1 a wiring
  // gap rather than a missing feature, and it is what the routed patch plugs into.
  const sim = strip(read('src/game/sim.ts'));
  ok('W3. the sim end of the chain EXISTS: `FighterConfig.items` is declared and'
    + ' `createFighter` validates it',
    /items\?\s*:\s*readonly ItemId\[\]/.test(sim)
    && /function validateLoadout/.test(strip(sources.simState)));

  // No label on this screen may claim a press affordance while W2 is false.
  ok('W4. no control on the loadout says "tap to use" / "press" while there is no button',
    !/tap to use|press to use|hold to use/i.test(lobby));

  // ── §I — ICONS ───────────────────────────────────────────────────────────
  section('§I — three flat icon records merged with `...` must not collide');
  const keysOf = (src, decl) => {
    const body = new RegExp(`${decl}[\\s\\S]*?\\n\\};`).exec(src)?.[0] ?? '';
    return [...body.matchAll(/^\s{2}([A-Za-z_][A-Za-z0-9_]*)\s*:/gm)].map((m) => m[1]);
  };
  const itemKeys = keysOf(sources.items, 'export const ITEM_ICONS');
  const uiKeys = keysOf(read('src/ui/icons/ui.ts'), 'export const UI_ICONS');
  const foodKeys = keysOf(read('src/ui/icons/food.ts'), 'export const FOOD_ICONS');
  if (ok('I0. all three key sets are NON-EMPTY before any intersection is taken',
    itemKeys.length > 0 && uiKeys.length > 0 && foodKeys.length > 0,
    `items ${itemKeys.length}, ui ${uiKeys.length}, food ${foodKeys.length}`)) {
    const clash = itemKeys.filter((k) => uiKeys.includes(k) || foodKeys.includes(k));
    ok('I1. no item glyph is shadowed by `ui.ts` or `food.ts` — `{...A,...B,...C}` is a'
      + ' silent last-one-wins', clash.length === 0, clash.join(', ') || 'none');
    const R = await import(pathToFileURL(join(ROOT, 'src/game/rules.ts')).href);
    const ids = Object.keys(R.ITEMS);
    ok('I2. every `ItemId` has a glyph, and there is no glyph for an item that does not exist',
      ids.every((id) => itemKeys.includes(id)) && itemKeys.every((k) => ids.includes(k)),
      `${itemKeys.length} glyphs / ${ids.length} items`);
    ok('I3. every item key is a legal CSS identifier — it becomes `.fa-ic--<key>`',
      itemKeys.every((k) => /^[A-Za-z_][A-Za-z0-9_-]*$/.test(k)));
    // The outline colour must stay INHERITED or a glyph cannot flip onto a dark plate —
    // the dark-on-dark class, shipped four times.
    const authored = itemKeys.filter((k) => {
      const body = new RegExp(`\\n  ${k}: \`([\\s\\S]*?)\`,`).exec(sources.items)?.[1] ?? '';
      return /<svg|style="stroke/.test(body);
    });
    ok('I4. no item glyph authors its own root stroke — `index.ts` owns `--fa-ic-ink`',
      authored.length === 0, authored.join(', ') || 'none');
  }

  // ── §L — THE SCREEN READS THE MODEL ──────────────────────────────────────
  section('§L — the loadout screen reads the model rather than restating it');
  ok('L1. the slot count is `ITEM_SLOTS`, never a typed 2',
    /ITEM_SLOTS/.test(lobby) && !/slots?\s*=\s*2\b/.test(lobby));
  ok('L2. the picker enumerates `ITEM_IDS`, never a typed list of ten',
    /ITEM_IDS/.test(lobby) && !/'tenderiser'\s*,\s*'springform'/.test(lobby));
  ok('L3. what an item DOES comes from `ITEMS[...].blurb`, never retyped',
    /\.blurb/.test(lobby) && !/Every hit on the same target/.test(lobby));
  ok('L4. rarity is painted from `RARITY_COLORS` and ordered by `RARITY_ORDER`',
    /RARITY_COLORS\[/.test(lobby) && /RARITY_ORDER\.indexOf/.test(lobby));
  ok('L5. the rarity badge is the SHARED `.fa-rarity`, whose 16.5:1 on all six fills is'
    + ' `theme.ts`\'s measurement — a local chip would re-open Epic at 3.69:1',
    /class="fa-rarity/.test(sources.lobby));
  ok('L6. `minAlive` is read from the registry, not hard-coded for Disposal',
    /\.minAlive/.test(lobby) && !/'disposal'\s*\)?\s*[?&]/.test(lobby));
  ok('L7. cooldowns are printed from `cooldownMs`, so a re-tune moves the string',
    /cooldownMs/.test(lobby) && !/5 s cooldown'/.test(lobby));

  // The one player-facing sentence about where items come from, checked against the economy.
  const tuning = strip(sources.tuning);
  const road = strip(sources.trophyRoad);
  ok('S5. "Items come from boxes and from the trophy road" is TRUE of the economy —'
    + ' container rows declare `itemRarity` and the road has a surprise path',
    /itemRarity:/.test(tuning) && /roadSurprise/.test(road)
    && /Items come from boxes and from the trophy road\./.test(sources.lobby));

  report();
}

function report() {
  console.log(`\nul_seam: ${pass + fail} rows, ${pass} pass, ${fail} fault(s)`);
  if (fail) console.log(`  failed: ${failures.join(' | ')}`);
  process.exitCode = fail === 0 ? 0 : 1;
}

/**
 * ── `--selftest` — LOGIC ONLY, and it says so ──────────────────────────────
 *
 * ⚠️ A passing selftest is NOT evidence that this tool is pointed at the right files;
 * `valuescan` read a perfect selftest with 14 of 18 stations in the wrong quadrant. §G
 * above is the only thing that checks where this one points, which is why §G aborts.
 *
 * Each arm below plants a KNOWN-BAD and requires the predicate to FLIP. A predicate that
 * cannot be made to return the other answer is not a predicate.
 */
async function selftest() {
  const rows = [];
  const t = (name, cond, ev) => rows.push([name, cond, ev]);

  // W1 — must be FALSE on the shipped shape and TRUE on a wired one.
  const unwired = {
    matchScreen: 'const session = startGame({ container, hudRoot, playerCharacterId: p });',
    match: 'export interface GameSessionOptions { container: HTMLElement; roster?: readonly CharacterId[]; }',
  };
  const wired = {
    matchScreen: 'const session = startGame({ container, items: loadEquipped(owned) });',
    match: 'export interface GameSessionOptions { container: HTMLElement; items?: readonly ItemId[]; }',
  };
  t('W1 KNOWN-BAD: unwired tree reads FALSE', loadoutReachesMatch(unwired) === false,
    String(loadoutReachesMatch(unwired)));
  t('W1 CONTROL: a wired tree reads TRUE', loadoutReachesMatch(wired) === true,
    String(loadoutReachesMatch(wired)));
  t('W1 half-wired (option exists, nobody calls it) still reads FALSE',
    loadoutReachesMatch({ matchScreen: unwired.matchScreen, match: wired.match }) === false);
  t('W1 half-wired (caller exists, no option) still reads FALSE',
    loadoutReachesMatch({ matchScreen: wired.matchScreen, match: unwired.match }) === false);

  // W1 must not be satisfied by a COMMENT. The whole class this file exists for.
  t('W1 KNOWN-BAD: a tree that only TALKS about `loadEquipped` in a comment reads FALSE',
    loadoutReachesMatch({
      matchScreen: '/* one day this will call loadEquipped({ items: x }) */ const a = 1;',
      match: '/* items?: readonly ItemId[] would go here */ export interface X {}',
    }) === false);

  // W2 — the writer census.
  t('W2 KNOWN-BAD: no writers reads FALSE', playerCanPressAnItem([]) === false);
  t('W2 CONTROL: one writer reads TRUE', playerCanPressAnItem(['src/game/touch.ts']) === true);

  // 🚨 THE ARM THAT EXISTS BECAUSE THE FIRST VERSION FAILED IT. `sim.ts`'s real line is a
  // LOCAL BINDING named after the field, and counting it made W2 report the opposite of
  // the truth. Both real shapes of a write are required to still register.
  t('W2 KNOWN-BAD: `sim.ts`\'s own local binding is NOT a writer',
    writesUseItem('const useItem = fi.useItem ?? null;') === false);
  t('W2 KNOWN-BAD: a bare read is NOT a writer',
    writesUseItem('if (input.useItem !== null) fire();') === false);
  t('W2 CONTROL: an object-literal key IS a writer',
    writesUseItem('return { ...base, useItem: slot };') === true);
  t('W2 CONTROL: a property assignment IS a writer',
    writesUseItem('this.input.useItem = slot;') === true);

  // `strip` is what keeps every "does not contain" row honest.
  t('strip removes a block comment', strip('/* useItem: 1 */ const a = 1;').includes('useItem') === false);
  t('strip removes a line comment', strip('// useItem: 1\nconst a = 1;').includes('useItem') === false);
  t('strip keeps real code', strip('/* x */ const useItem = 1;').includes('useItem') === true);

  let bad = 0;
  for (const [name, cond, ev] of rows) {
    if (!cond) bad++;
    console.log(`  ${cond ? 'ok  ' : 'FAIL'} ${name}${ev ? `  ${ev}` : ''}`);
  }
  console.log(`ul_seam --selftest: ${rows.length} rows, ${bad} faults (LOGIC only — §G is what`
    + ' checks where this tool POINTS)');
  process.exitCode = bad === 0 ? 0 : 1;
}

if (process.argv.includes('--selftest')) await selftest();
else await main();
