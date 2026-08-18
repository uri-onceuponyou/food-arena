/**
 * adm_accept — the admin panel's acceptance battery, in a real browser.
 *
 * `DECISIONS-FOR-URI.md` §76. This is the screen's gate; it is deliberately NOT part of
 * `menu_accept`, and the reason is measured rather than assumed:
 *
 * ⚠️ **`tools/tmp/menu_accept.mjs:803` iterates a HARDCODED list of six screens** —
 * opening, home, characters, trophies, shop, settings. It does not contain `lobby`, which
 * shipped last session, so a new screen does not join that gate by existing and its
 * documented **361** does not move. Adding a row there means editing `menu_accept.mjs`
 * and `docs/TOOLS.md`'s gate table, neither of which is in this agent's owned file set.
 *
 * ⚠️ **SUPERSEDED 2026-08-18 — the paragraph above is kept because its OBSERVATION was
 * right and is what got this fixed.** `menu_accept`'s screen list is no longer typed: it
 * is DERIVED from the router (`tools/tmp/mc_routes.mjs`), so `lobby` and `admin` are both
 * in it, and in `menu_accept_portrait` too. `admin` is iterated there with one measured
 * exemption (the simulated notch cannot reach a screen that pads with raw `env()`), so
 * the sentence "a new screen does not join that gate by existing" no longer holds.
 * **This file is still the right gate for everything below** — none of it is expressible
 * as a menu-layout assertion.
 *
 * It would also be the wrong gate. `menu_accept` asserts a hero fills its panel, a WebGL
 * portrait is in frame, and the game's own safe-area contract — assertions about a GAME
 * screen. This one is a data table that is explicitly not the game, so it is measured on
 * the things that make a data table correct.
 *
 * ── WHAT IT MEASURES, AND THE KNOWN-BAD BESIDE EACH ─────────────────────────────
 *
 *   CONSEQUENCE    typing into a field changes the derived numbers rendered under it —
 *                  and the field that derives NOTHING renders nothing. A panel emitting
 *                  a line per field passes the first and fails the second.
 *   READ-ONLY      the derived section contains zero editable inputs. §76 constraint 2.
 *   REFUSAL        an out-of-band value paints the row red and DISABLES Apply, so a set
 *                  `registry.ts` would throw on at boot cannot be persisted from here.
 *   NOT-THE-GAME   Uri asked for this in words; it is checked in pixels. The panel's
 *                  computed font must not be the game's display face and its background
 *                  must not be the game's. A screen that imported `theme.ts` by accident
 *                  fails here rather than in code review.
 *   NO H-SCROLL    `index.html` forbids the page from scrolling. Checked at desktop AND
 *                  at Uri's real portrait viewport, 384x848 (§74).
 *   KEYBOARD       `/` focuses the filter and Alt+5 switches tab, because "keyboard-
 *                  usable" is a claim and claims get measured.
 *
 * Usage:
 *   node tools/tmp/with_snapshot.mjs -- node tools/tmp/adm_accept.mjs --url '{URL}'
 */

import { chromium } from 'playwright';
import { mkdir } from 'node:fs/promises';
import { dirname, resolve } from 'node:path';
import { fileURLToPath } from 'node:url';
import { settleScreen } from './settle.mjs';

const HERE = dirname(fileURLToPath(import.meta.url));
const OUT = resolve(HERE, 'adm_shots');

const argUrl = (() => {
  const i = process.argv.indexOf('--url');
  return i >= 0 ? process.argv[i + 1] : null;
})();
const BASE = argUrl ?? process.env.PREVIEW_BASE ?? 'http://localhost:5173';

const LAUNCH_ARGS = [
  '--use-gl=angle', '--use-angle=swiftshader', '--enable-unsafe-swiftshader',
  '--enable-webgl', '--ignore-gpu-blocklist', '--disable-gpu-sandbox',
];

let checks = 0;
let failures = 0;
const lines = [];

function ok(name, cond, detail = '') {
  checks++;
  if (!cond) failures++;
  lines.push(`${cond ? '  ok  ' : ' FAIL '} ${name}${detail ? `   ${detail}` : ''}`);
}
function eq(name, actual, expected) {
  ok(name, String(actual) === String(expected), `got ${JSON.stringify(actual)}, want ${JSON.stringify(expected)}`);
}
function nonEmpty(name, arr) {
  ok(`NON-EMPTY ${name}`, arr.length > 0, `${arr.length}`);
  return arr;
}

/** Wait for the ADMIN screen by NAME, then for it to be genuinely painted. */
async function atAdmin(page) {
  await page.waitForFunction('window.__screen === "admin"', null, { timeout: 30000 });
  return settleScreen(page, { label: 'admin', timeout: 30000 });
}

await mkdir(OUT, { recursive: true });
const browser = await chromium.launch({ args: LAUNCH_ARGS });

// ══ DESKTOP ══════════════════════════════════════════════════════════════════
{
  const page = await browser.newPage({ viewport: { width: 1600, height: 900 } });
  const errors = [];
  page.on('pageerror', (e) => errors.push(String(e.message)));

  await page.goto(`${BASE}/?screen=admin&admin=selftest`, { waitUntil: 'load', timeout: 45000 });
  const state = await atAdmin(page);
  ok('the admin screen mounts and PAINTS', state.ok === true, state.why?.join('; ') ?? '');
  eq('window.__screen names it', await page.evaluate(() => window.__screen), 'admin');
  ok('the QA handle is published', await page.evaluate(() => typeof window.__admin === 'object'));

  // ── tabs ───────────────────────────────────────────────────────────────────
  const tabs = nonEmpty('tabs', await page.$$eval('.adm-tab', (ns) => ns.map((n) => n.textContent.trim())));
  eq('five tabs', tabs.length, 5);
  ok('the five tabs Uri asked for, in order',
    tabs[0].startsWith('Combat') && tabs[1].startsWith('Characters')
    && tabs[2].startsWith('Arena & Schedule') && tabs[3].startsWith('Economy')
    && tabs[4].startsWith('Analytics'), tabs.join(' | '));
  ok('the placeholder tabs are LABELLED as such rather than looking broken',
    tabs[3].includes('partial') && tabs[4].includes('soon'), `${tabs[3]} / ${tabs[4]}`);

  // ── NOT THE GAME — measured, not intended ──────────────────────────────────
  const look = await page.evaluate(() => {
    const root = document.querySelector('.adm');
    const row = document.querySelector('.adm-row .adm-key');
    const cs = getComputedStyle(root);
    return {
      font: getComputedStyle(row ?? root).fontFamily,
      bg: cs.backgroundColor,
      radius: getComputedStyle(document.querySelector('.adm-btn')).borderRadius,
      hasGameScreenClass: !!document.querySelector('.fa-stack > .fa-screen'),
    };
  });
  ok('the panel does NOT use the game display faces (Rubik/Heebo)',
    !/Rubik|Heebo/i.test(look.font), look.font);
  ok('the panel does NOT paint the game background', look.bg !== 'rgb(22, 16, 31)', look.bg);
  ok('the buttons are not the game 999px pills', !look.radius.startsWith('999'), look.radius);
  ok('the screen root does not adopt .fa-screen', look.hasGameScreenClass === false);

  // ── rows: the four columns a row must say ──────────────────────────────────
  const row = await page.evaluate(() => {
    const n = document.querySelector('.adm-row[data-key="selftest.paceMs"]');
    if (!n) return null;
    const cells = [...n.querySelectorAll('.adm-cell')].map((c) => c.textContent.trim());
    return { authored: cells[0], live: cells[1], input: n.querySelector('.adm-input')?.value };
  });
  ok('the tunable row exists', row !== null);
  eq('AUTHORED column shows the literal', row?.authored, '2000');
  eq('LIVE column shows what the sim is running', row?.live, '2000');
  eq('the input shows what it will boot as', row?.input, '2000');

  // ── THE CONSEQUENCE COLUMN, and its known-bad ──────────────────────────────
  const before = await page.evaluate(() => window.__admin.consequences('selftest.paceMs'));
  nonEmpty('consequences before the edit', before);
  ok('an unchanged field shows the live derived values without an arrow',
    before.every((l) => !l.includes('→')), before.join(' | '));

  await page.evaluate(() => window.__admin.stage('selftest.paceMs', 4000));
  const after = nonEmpty('consequences after the edit',
    await page.evaluate(() => window.__admin.consequences('selftest.paceMs')));
  ok('depth 1 consequence updates (total 2500 → 4500)',
    after.some((l) => l.includes('selftest.total') && l.includes('2500') && l.includes('4500')),
    after.join(' | '));
  ok('DEPTH 2 consequence updates (cycles 833.3 → 1500) — the transitive case',
    after.some((l) => l.includes('selftest.cycles') && l.includes('1500')),
    after.join(' | '));
  ok('the derived FUNCTION is named as moving, with no invented number',
    after.some((l) => l.includes('selftest.radiusFor') && l.includes('selftest:radiusFor')),
    after.join(' | '));

  // KNOWN-BAD: a panel that emitted a consequence line per field passes everything above.
  eq('ORPHAN: a field nothing derives from renders NO consequence numbers',
    (await page.evaluate(() => window.__admin.consequences('selftest.orphan')))
      .filter((l) => /\d/.test(l)).length, 0);
  ok('…and says so in words rather than rendering blank',
    (await page.evaluate(() => window.__admin.consequences('selftest.orphan')))
      .some((l) => l.includes('nothing derives from this')));

  // ── the staged/live distinction ────────────────────────────────────────────
  eq('the LIVE column did not move when the field did',
    await page.$eval('.adm-row[data-key="selftest.paceMs"] .adm-cell.is-live', (n) => n.textContent.trim()),
    '2000');
  eq('one field staged', await page.evaluate(() => window.__admin.stagedCount()), 1);
  const stagedHash = await page.evaluate(() => window.__admin.stagedHash());
  const liveHash = await page.evaluate(() => window.__admin.liveHash());
  ok('the staged set carries a tun1- hash', stagedHash.startsWith('tun1-'), stagedHash);
  eq('the live set is still stock', liveHash, 'stock');
  ok('§76 c3: the two hashes DIFFER, so a measurement cannot be misattributed',
    stagedHash !== liveHash, `${liveHash} vs ${stagedHash}`);

  // ── REFUSAL ────────────────────────────────────────────────────────────────
  await page.evaluate(() => window.__admin.stage('selftest.lockedInt', 7));
  const badKeys = await page.evaluate(() => window.__admin.badKeys());
  ok('an out-of-band value is refused by the panel', badKeys.includes('selftest.lockedInt'), badKeys.join(','));
  ok('…the row is painted as bad',
    await page.$eval('.adm-row[data-key="selftest.lockedInt"]', (n) => n.classList.contains('is-bad')));
  ok('…and Apply is DISABLED, so an illegal set cannot be persisted',
    await page.$eval('.adm-btn--primary', (n) => n.disabled === true));
  // 🚨 A BAD VALUE FILTERED OUT OF VIEW MUST NOT LEAVE APPLY DEAD. An illegal value lives
  // only as text in a DOM input — it is never staged — so destroying the row destroys it.
  // The first version of the panel kept the key in its `bad` set anyway: Apply stayed
  // disabled forever with the offending row nowhere on screen. This arm fails against
  // that version and passes against the fix.
  await page.evaluate(() => {
    const s = document.querySelector('.adm-search');
    s.value = 'orphan';
    s.dispatchEvent(new Event('input', { bubbles: true }));
  });
  await page.waitForTimeout(120);
  eq('a refused row filtered out of view stops blocking Apply',
    (await page.evaluate(() => window.__admin.badKeys())).length, 0);
  ok('…so Apply is live again rather than dead with no visible cause',
    await page.$eval('.adm-btn--primary', (n) => n.disabled === false));
  await page.evaluate(() => {
    const s = document.querySelector('.adm-search');
    s.value = '';
    s.dispatchEvent(new Event('input', { bubbles: true }));
  });
  await page.waitForTimeout(120);
  eq('…and the field came back at its legal value, not the refused text',
    await page.$eval('.adm-row[data-key="selftest.lockedInt"] .adm-input', (n) => n.value), '3');

  await page.evaluate(() => window.__admin.stage('selftest.lockedInt', 7));
  await page.evaluate(() => window.__admin.stage('selftest.lockedInt', 3));
  ok('a legal value clears the refusal',
    (await page.evaluate(() => window.__admin.badKeys())).length === 0);
  ok('…and Apply comes back',
    await page.$eval('.adm-btn--primary', (n) => n.disabled === false));

  // ── READ-ONLY DERIVED, §76 constraint 2 ────────────────────────────────────
  //
  // ⚠️ The expected count is 2, not 3, and getting that wrong is worth recording: the
  // fixture's third derived entry (`selftest.radiusFor`) is registered in the ARENA group,
  // so it is not on this tab at all. The first version of this file asserted `>= 3` on the
  // combat tab and went red against correct code — a wrong expectation, not a bug. The
  // arm below now checks the arena tab explicitly instead of guessing a floor.
  const readDerived = () => page.evaluate(() => {
    const rows = [...document.querySelectorAll('.adm-drow')];
    return {
      count: rows.length,
      keys: rows.map((r) => r.dataset.key),
      inputs: rows.reduce((n, r) => n + r.querySelectorAll('input,textarea,select').length, 0),
      locks: rows.filter((r) => r.querySelector('.adm-lock')).length,
      namesInputs: rows.filter((r) => (r.querySelector('.adm-from')?.textContent ?? '').includes('from')).length,
    };
  });
  const derived = await readDerived();
  eq('the combat tab shows both of its derived scalars', derived.count, 2);
  ok('…and they are the two the fixture declared',
    derived.keys.includes('selftest.total') && derived.keys.includes('selftest.cycles'),
    derived.keys.join(','));
  eq('NO editable control anywhere in the derived section', derived.inputs, 0);
  eq('every derived row is visibly marked derived', derived.locks, derived.count);
  eq('every derived row names what it is derived FROM', derived.namesInputs, derived.count);

  await page.evaluate(() => window.__admin.setTab('arena'));
  const arena = await readDerived();
  eq('the derived FUNCTION lives on the arena tab, read-only', arena.count, 1);
  ok('…and it is the one the fixture declared', arena.keys[0] === 'selftest.radiusFor', arena.keys.join(','));
  eq('…with no editable control either', arena.inputs, 0);
  await page.evaluate(() => window.__admin.setTab('combat'));

  // ── placeholders ───────────────────────────────────────────────────────────
  await page.evaluate(() => window.__admin.setTab('analytics'));
  const analytics = await page.$eval('.adm-placeholder', (n) => n.textContent);
  ok('Analytics is a deliberate placeholder that says what will live there',
    analytics.includes('placeholder') && /reserved for|what this tab/i.test(analytics));
  ok('…and explains why it is empty rather than showing a chart of nothing',
    /no telemetry|nothing is collected/i.test(analytics));
  eq('a placeholder tab renders no editable field',
    await page.$$eval('.adm-input', (ns) => ns.length), 0);

  await page.evaluate(() => window.__admin.setTab('economy'));
  ok('Economy is a labelled placeholder too',
    (await page.$eval('.adm-placeholder', (n) => n.textContent)).includes('placeholder'));

  // ── keyboard ───────────────────────────────────────────────────────────────
  await page.evaluate(() => window.__admin.setTab('combat'));
  await page.keyboard.press('/');
  ok('"/" focuses the filter',
    await page.evaluate(() => document.activeElement?.classList.contains('adm-search') === true));
  await page.keyboard.type('orphan');
  await page.waitForTimeout(120);
  const filtered = await page.evaluate(() => window.__admin.rowKeys());
  ok('the filter narrows the table', filtered.length >= 1 && filtered.every((k) => k.includes('orphan')),
    filtered.join(','));
  // 🚨 The filter is cleared through the input's own event, NOT with Control+a/Backspace.
  // On this platform that chord left the box holding "orphan", the assertion above still
  // passed, and every screenshot after it photographed a one-row table — which is how a
  // capture labelled "combat" came to show a filtered view. Only reading the PNG caught
  // it (`CLAUDE.md` #3); no assertion here was capable of noticing.
  await page.evaluate(() => {
    const s = document.querySelector('.adm-search');
    s.value = '';
    s.dispatchEvent(new Event('input', { bubbles: true }));
  });
  await page.waitForTimeout(120);
  // ⚠️ 6, not 4: `rowKeys()` reports every REFRESHABLE row, and the derived rows are
  // refreshable too. Asserting 4 here was a second wrong expectation of the same kind as
  // the derived-count one above, so the check now names the four editable keys instead of
  // trusting a total.
  const restored = await page.evaluate(() => window.__admin.rowKeys());
  eq('clearing the filter restores the whole group (4 tunable + 2 derived)', restored.length, 6);
  ok('…including every editable field',
    ['paceMs', 'graceMs', 'lockedInt', 'orphan'].every((k) => restored.includes(`selftest.${k}`)),
    restored.join(','));
  ok('the filter box is genuinely empty afterwards',
    (await page.$eval('.adm-search', (n) => n.value)) === '');
  await page.evaluate(() => document.activeElement.blur());
  await page.keyboard.press('Alt+5');
  eq('Alt+5 switches to the fifth tab', await page.evaluate(() => window.__admin.tab()), 'analytics');
  await page.evaluate(() => window.__admin.setTab('combat'));

  // ── layout ─────────────────────────────────────────────────────────────────
  const scroll = await page.evaluate(() => ({
    pageW: document.documentElement.scrollWidth,
    innerW: window.innerWidth,
    pageH: document.documentElement.scrollHeight,
    innerH: window.innerHeight,
    bodyScrolls: document.body.scrollHeight > window.innerHeight + 1,
  }));
  ok('the PAGE does not scroll horizontally', scroll.pageW <= scroll.innerW + 1,
    `${scroll.pageW} vs ${scroll.innerW}`);
  ok('the PAGE does not scroll vertically (index.html forbids it)', !scroll.bodyScrolls,
    `${scroll.pageH} vs ${scroll.innerH}`);
  ok('…and the table scrolls inside its own box instead',
    await page.$eval('.adm-body', (n) => getComputedStyle(n).overflowY !== 'visible'));

  ok('no page errors', errors.length === 0, errors.slice(0, 2).join(' | '));

  await page.screenshot({ path: `${OUT}/desktop-combat.png` });
  await page.evaluate(() => window.__admin.setTab('analytics'));
  await page.waitForTimeout(150);
  await page.screenshot({ path: `${OUT}/desktop-analytics.png` });
  await page.close();
}

// ══ PORTRAIT — Uri's real phone viewport, §74 ════════════════════════════════
{
  const page = await browser.newPage({ viewport: { width: 384, height: 848 } });
  await page.goto(`${BASE}/?screen=admin&admin=selftest`, { waitUntil: 'load', timeout: 45000 });
  await atAdmin(page);

  const p = await page.evaluate(() => {
    const inputs = [...document.querySelectorAll('.adm-input')];
    const btns = [...document.querySelectorAll('.adm-btn')];
    const short = (ns) => ns.filter((n) => n.getBoundingClientRect().height < 44).length;
    return {
      pageW: document.documentElement.scrollWidth,
      innerW: window.innerWidth,
      inputs: inputs.length,
      shortInputs: short(inputs),
      btns: btns.length,
      shortBtns: short(btns),
      hiddenCols: getComputedStyle(document.querySelector('.adm-hrow')).display,
    };
  });
  ok('PORTRAIT: the page still does not scroll horizontally', p.pageW <= p.innerW + 1,
    `${p.pageW} vs ${p.innerW}`);
  nonEmpty('portrait inputs', new Array(p.inputs));
  eq('PORTRAIT: every field input is a 44px tap target', p.shortInputs, 0);
  eq('PORTRAIT: every button is a 44px tap target', p.shortBtns, 0);
  eq('PORTRAIT: the six-column header collapses rather than squeezing', p.hiddenCols, 'none');

  await page.screenshot({ path: `${OUT}/portrait-combat.png` });
  await page.close();
}

// ══ THE ROUND TRIP — §76 constraint 4: a displayed field must be WIRED ═══════
//
// 🚨 **EVERY CHECK ABOVE COULD PASS ON A PANEL THAT WRITES NOWHERE.** The staged column,
// the hash, the consequence arrows and the refusal are all in-page state; a panel whose
// Apply button did nothing at all would score 60/60. This arm is the one that says the
// edit reaches the SIM'S OWN READ PATH: it applies, reloads, and requires that the value
// `store.ts:bootstrap` installed and `registry.ts:register` handed back is the new one —
// and that the tuning stamp stopped saying `stock`, because a number measured under this
// build must be attributable to a constant set.
//
// A FRESH CONTEXT, because localStorage is shared and a leftover set would make the
// "before" arm start tuned — a baseline is itself a measurement (`AGENT-BRIEF` §4.7).
{
  const ctx = await browser.newContext({ viewport: { width: 1400, height: 900 } });
  const page = await ctx.newPage();
  const url = `${BASE}/?screen=admin&admin=selftest`;

  await page.goto(url, { waitUntil: 'load', timeout: 45000 });
  await atAdmin(page);
  eq('ROUND TRIP: a clean context boots STOCK', await page.evaluate(() => window.__admin.liveHash()), 'stock');
  eq('ROUND TRIP: …and the live value is the authored literal',
    await page.$eval('.adm-row[data-key="selftest.paceMs"] .adm-cell.is-live', (n) => n.textContent.trim()),
    '2000');

  await page.evaluate(() => window.__admin.stage('selftest.paceMs', 4000));
  await page.evaluate(() => document.querySelector('.adm-btn--primary').click());
  await page.waitForTimeout(400);
  await page.waitForFunction('window.__screen === "admin"', null, { timeout: 30000 });
  await atAdmin(page);

  const after = await page.evaluate(() => ({
    hash: window.__admin.liveHash(),
    live: document.querySelector('.adm-row[data-key="selftest.paceMs"] .adm-cell.is-live')?.textContent.trim(),
    input: document.querySelector('.adm-row[data-key="selftest.paceMs"] .adm-input')?.value,
    pending: window.__admin.stagedCount(),
    stored: JSON.parse(localStorage.getItem('fa.tuning.v1') ?? 'null'),
  }));
  eq('ROUND TRIP: the SIM now reports the tuned value as LIVE', after.live, '4000');
  ok('ROUND TRIP: the live set is no longer stock', after.hash.startsWith('tun1-'), after.hash);
  eq('ROUND TRIP: nothing is left pending after the reload', after.pending, 0);
  eq('ROUND TRIP: the persisted envelope carries the override',
    after.stored?.overrides?.['selftest.paceMs'], 4000);
  eq('ROUND TRIP: …stamped with the hash that produced it', after.stored?.tuningHash, after.hash);

  // ── and back out again, which is the half a tuning session needs most ──────
  await page.evaluate(() => document.querySelector('.adm-btn--danger').click());
  await page.waitForTimeout(150);
  await page.reload({ waitUntil: 'load' });
  await atAdmin(page);
  const reset = await page.evaluate(() => ({
    hash: window.__admin.liveHash(),
    live: document.querySelector('.adm-row[data-key="selftest.paceMs"] .adm-cell.is-live')?.textContent.trim(),
    stored: localStorage.getItem('fa.tuning.v1'),
  }));
  eq('RESET: the sim is back on the authored literal', reset.live, '2000');
  eq('RESET: …and the set hashes to stock again', reset.hash, 'stock');
  eq('RESET: …with nothing left in storage', reset.stored, null);

  // ── the escape hatch, which is the only way back in from a bad set ─────────
  await page.evaluate(() => localStorage.setItem('fa.tuning.v1', JSON.stringify({ overrides: { 'selftest.paceMs': 4000 } })));
  await page.goto(`${url}&tuning=off`, { waitUntil: 'load', timeout: 45000 });
  await atAdmin(page);
  eq('?tuning=off boots STOCK even with a set in storage',
    await page.evaluate(() => window.__admin.liveHash()), 'stock');
  ok('…and storage is left alone, so the set is recoverable',
    (await page.evaluate(() => localStorage.getItem('fa.tuning.v1'))) !== null);

  await page.evaluate(() => localStorage.removeItem('fa.tuning.v1'));
  await ctx.close();
}

await browser.close();

console.log(lines.join('\n'));
console.log('─'.repeat(78));
console.log(`adm_accept: ${checks - failures}/${checks} checks passed${failures ? `  — ${failures} FAILURE(S)` : ''}`);
console.log(`shots: ${OUT}`);
process.exit(failures ? 1 : 0);
