#!/usr/bin/env node
/**
 * pu_tune_e2e — does a config tuned in the §76 panel actually reach the GAME?
 *
 * Runs against the artefact Uri types one command for:
 *   node tools/tmp/playtest.mjs --admin
 * i.e. a REAL production bundle served on ONE origin, not a dev server and not a fixture.
 *
 * ── WHY THIS TOOL EXISTS AND `adm_model.mjs` DOES NOT COVER IT ──────────────────
 *
 * `adm_model.mjs` validates the panel's model against `src/admin/selftest.ts`'s synthetic
 * registry — the right instrument for "does the panel compute correctly". It says nothing
 * about whether a value applied in the panel is the value the GAME boots with, because the
 * fixture keys (`selftest.*`) are not read by anything in `src/game/`. `CLAUDE.md` #6:
 * *"`--selftest` validates a tool's LOGIC. It never validates where the tool is POINTED."*
 *
 * ── THE READ-BACK IS ON THE GAME'S OWN SCREEN, NOT THE PANEL'S ─────────────────
 *
 * The lever is `MATCH_DURATION_MS`, chosen because `ui/screens/home.ts:385` renders
 * `formatDuration(MATCH_DURATION_MS)` into `[data-el="modesub"]` on the HOME screen. So
 * the assertion is made on a string the PLAYER sees, on a page that never loads the admin
 * module — a different page load, reaching the same `localStorage` because it is the same
 * origin, which is the entire point of serving both from one command.
 *
 * ⚠️ Reading the panel's own LIVE column would be a weaker claim: the panel and the
 * registry are the same module instance, so "the panel agrees with the panel" is close to
 * tautological. The home screen imports `rules.ts` and knows nothing about any of this.
 *
 * ── THE KNOWN-BAD ARM ──────────────────────────────────────────────────────────
 *
 * `CLAUDE.md` #6: a guard not shown to FAIL is not a guard, and a filtered assertion must
 * be shown non-empty first. Three controls, all required:
 *
 *   CONTROL 1  before Apply, the home screen must read the STOCK duration. If it already
 *              read the tuned one the pass would mean nothing.
 *   CONTROL 2  `?tuning=off` after Apply must read the STOCK duration again — proves the
 *              string this tool watches can still MOVE BACK, i.e. that it is a live read
 *              and not a constant the bundler folded.
 *   CONTROL 3  the staged/live hash must LEAVE `stock` and land on the value the panel
 *              stamped. A tuned set that still hashes `stock` is §76 constraint 3's
 *              failure: a measurement stamped "tuned" whose numbers are not.
 *
 * Usage:  node tools/tmp/pu_tune_e2e.mjs [--url http://localhost:4321]
 */

import { chromium } from 'playwright';

const argv = process.argv.slice(2);
const at = (k, d) => { const i = argv.indexOf(k); return i >= 0 ? argv[i + 1] : d; };
const BASE = at('--url', 'http://localhost:4321').replace(/\/$/, '');

/** The lever, its stock value, and the value we tune it to. */
const KEY = 'MATCH_DURATION_MS';
const TUNED_MS = 90_000;

const results = [];
/**
 * Declared HERE, not beside the export step, because `report()` reads it and the early
 * refusal path calls `report()` first. It was a `let` further down and the known-bad arm —
 * a default build with no panel — died on a temporal-dead-zone ReferenceError instead of
 * printing the diagnosis it exists to print. Caught by running the known-bad, which is the
 * only thing that ever finds this class.
 */
let env = null;
const record = (ok, label, detail) => { results.push({ ok, label, detail }); };

const settle = async (page, name) => {
  await page.waitForFunction((n) => window.__screen === n, name, { timeout: 20_000 });
  await page.waitForTimeout(400);
};

/** The duration string the HOME screen prints, read from the game page. */
async function homeDuration(page, query = '') {
  await page.goto(`${BASE}/${query}`, { waitUntil: 'load' });
  await settle(page, 'home');
  // The subtitle is `${formatDuration(MATCH_DURATION_MS)} · last one standing`. Only the
  // leading clock is the constant; matching the whole string would couple this tool to
  // copy that has nothing to do with tuning.
  return page.evaluate(() => {
    const n = document.querySelector('[data-el="modesub"]');
    if (!n) return null;
    return /^\s*(\d+:\d{2})/.exec(n.textContent ?? '')?.[1] ?? `UNPARSED:${(n.textContent ?? '').trim()}`;
  });
}

const browser = await chromium.launch();
const ctx = await browser.newContext();
const page = await ctx.newPage();
const pageErrors = [];
page.on('pageerror', (e) => pageErrors.push(e.message.split('\n')[0]));

// ── 0. the panel is reachable at all on this build ────────────────────────────
await page.goto(`${BASE}/?screen=admin`, { waitUntil: 'load' });
let reached = true;
try { await settle(page, 'admin'); } catch { reached = false; }
record(reached, 'panel reachable on this build (?screen=admin)',
  reached ? '' : 'this build was not made with --admin — rerun `node tools/tmp/playtest.mjs --admin`');
if (!reached) { report(); await browser.close(); process.exit(1); }

const stockHash = await page.evaluate(() => window.__admin.liveHash());
record(stockHash === 'stock', 'live hash starts at "stock"', `liveHash=${stockHash}`);

// ── CONTROL 1: the game reads the STOCK duration before anything is applied ───
const before = await homeDuration(page);
record(before === '2:30', 'CONTROL 1 — home reads the stock duration before Apply',
  `modesub="${before}" (expected 2:30 for ${KEY}=150000)`);

// ── 1. stage + apply in the panel ─────────────────────────────────────────────
await page.goto(`${BASE}/?screen=admin`, { waitUntil: 'load' });
await settle(page, 'admin');
const staged = await page.evaluate(([key, v]) => {
  const a = window.__admin;
  for (const tab of ['combat', 'characters', 'arena', 'economy']) {
    a.setTab(tab);
    if (a.rowKeys().includes(key)) { a.stage(key, v); return { tab, hash: a.stagedHash(), count: a.stagedCount() }; }
  }
  return { tab: null, hash: a.stagedHash(), count: a.stagedCount() };
}, [KEY, TUNED_MS]);
record(staged.tab !== null && staged.count === 1,
  `${KEY} is an editable row and stages`, `tab=${staged.tab} stagedCount=${staged.count}`);
record(staged.hash !== 'stock' && staged.hash.startsWith('tun1-'),
  'CONTROL 3 — the staged hash LEAVES "stock"', `stagedHash=${staged.hash}`);

// Export BEFORE applying — the sheet stamps the staged set, which is what §76 asks travel
// with any number measured from it.
const envelope = await page.evaluate(() => {
  const btn = [...document.querySelectorAll('button')].find((b) => b.textContent.trim() === 'Export');
  btn.click();
  const ta = document.querySelector('.adm-sheet textarea');
  const text = ta.value;
  [...document.querySelectorAll('.adm-sheet button')].find((b) => b.textContent.trim() === 'Close').click();
  return text;
});
try { env = JSON.parse(envelope); } catch { /* recorded below */ }
record(!!env && env.tuningHash === staged.hash && env.overrides?.[KEY] === TUNED_MS,
  'Export writes a STAMPED envelope carrying the staged hash',
  env ? `tuningHash=${env.tuningHash} overrides.${KEY}=${env.overrides?.[KEY]}` : 'export was not JSON');

const applyText = await page.evaluate(() => {
  const b = [...document.querySelectorAll('button')].find((x) => /^Apply\b/.test(x.textContent.trim()));
  return { text: b.textContent.trim(), disabled: b.disabled };
});
record(!applyText.disabled && /Apply 1 change/.test(applyText.text),
  'Apply is enabled and counts exactly one change', `button="${applyText.text}"`);

await Promise.all([
  page.waitForNavigation({ waitUntil: 'load' }),
  page.evaluate(() => {
    [...document.querySelectorAll('button')].find((x) => /^Apply\b/.test(x.textContent.trim())).click();
  }),
]);
await settle(page, 'admin');

// ── 2. it SURVIVED THE RELOAD and the live hash moved ─────────────────────────
const after = await page.evaluate(() => ({
  liveHash: window.__admin.liveHash(),
  stagedHash: window.__admin.stagedHash(),
}));
record(after.liveHash === staged.hash,
  'the applied set survived the reload and is LIVE', `liveHash=${after.liveHash} (staged was ${staged.hash})`);

// ── 3. THE GAME — a different page, same origin — honours it ──────────────────
const tuned = await homeDuration(page);
record(tuned === '1:30', `the GAME reads the tuned ${KEY}`,
  `modesub="${tuned}" (expected 1:30 for ${TUNED_MS})`);

// ── CONTROL 2: ?tuning=off must put it back ───────────────────────────────────
const off = await homeDuration(page, '?tuning=off');
record(off === '2:30', 'CONTROL 2 — ?tuning=off reads the stock duration again',
  `modesub="${off}"`);

record(pageErrors.length === 0, 'zero page errors across every navigation',
  pageErrors.length ? pageErrors.slice(0, 3).join(' | ') : '');

report();
await browser.close();
process.exit(results.every((r) => r.ok) ? 0 : 1);

function report() {
  console.log('');
  for (const r of results) {
    console.log(` ${r.ok ? ' ok ' : 'FAIL'}  ${r.label.padEnd(58)} ${r.detail}`);
  }
  const pass = results.filter((r) => r.ok).length;
  console.log(`\npu_tune_e2e: ${pass}/${results.length} checks — `
    + (pass === results.length
      ? 'a set tuned in the panel is the set the GAME boots with'
      : 'NOT PROVEN — see the FAIL rows above'));
  if (env) console.log(`  exported envelope hash: ${env.tuningHash}`);
}
