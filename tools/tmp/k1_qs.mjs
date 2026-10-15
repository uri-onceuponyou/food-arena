/**
 * K1_QS — run ANY Playwright tool with extra query parameters on every page it opens.
 *
 *   K1_QS='camPitch=50&camAim=centred' K1_LOG=<file.jsonl> \
 *     node --import ./tools/tmp/k1_qs.mjs tools/tmp/rv_capture.mjs --url '{URL}' ...
 *
 * ── WHY A PRELOAD, AND NOT A FLAG ON THE TOOLS ───────────────────────────────────────
 * `rv_capture`, `aspect.mjs` and `np_nfighter` build their URLs from a fixed base plus their
 * own fixed parameters (`${base}/?screen=home&pointerLock=0`, `${BASE}/?player=…`), so a
 * `--url '{URL}/?camPitch=50'` produces `/?camPitch=50/?screen=home…` — a broken query, not
 * an override. The K1 brief says add the smallest flag to a `k1_` wrapper rather than edit
 * `rv_capture`; this is that wrapper, and it serves all three without touching any of them.
 *
 * ── HOW ──────────────────────────────────────────────────────────────────────────────
 * It patches `chromium.launch` (the one entry point all three use) so every context / page
 * gets an init script that `history.replaceState`s K1_QS into the document URL BEFORE any
 * page script runs. `shell.ts:routeUrl` preserves every query parameter it does not own, so
 * the parameters survive home -> lobby -> match (rv_capture's arena6 route).
 *
 * ── THE READBACK (an override that is not read back is an assumption) ────────────────
 * Before any page or context closes, the LIVE rig is read: `__stage.rig.pitchDeg`, `.aim`,
 * `.frameMode`, the document's `location.search`. One JSON line per page to K1_LOG, and a
 * console line. A menu page reads its own stage (the lobby's pitch 20) — which is the proof
 * that the override reaches the match camera and nothing else.
 *
 * ⚠️ The readback is a `page.evaluate`, which grants transient user activation
 * (AGENT-BRIEF §3). It runs only at close, after the tool's last measurement.
 */
import { chromium } from 'playwright';
import { appendFileSync } from 'node:fs';

const QS = process.env.K1_QS ?? '';
const LOG = process.env.K1_LOG ?? null;

const INIT = (qs) => {
  try {
    if (!/^https?:$/.test(location.protocol)) return;
    const u = new URL(location.href);
    let changed = false;
    for (const [k, v] of new URLSearchParams(qs)) {
      if (u.searchParams.get(k) !== v) { u.searchParams.set(k, v); changed = true; }
    }
    if (changed) history.replaceState(history.state, '', `${u.pathname}${u.search}${u.hash}`);
  } catch { /* never break the page under test */ }
};

const READ = () => {
  const r = window.__stage?.rig;
  return {
    search: location.search,
    rig: r ? { pitchDeg: r.pitchDeg, aim: r.aim ?? null, frameMode: r.frameMode } : null,
    screen: window.__screen ?? null,
  };
};

async function readback(page, why) {
  try {
    if (page.isClosed()) return;
    const url = page.url();
    if (!/^https?:/.test(url)) return;
    const r = await page.evaluate(READ);
    const line = { at: new Date().toISOString(), why, qs: QS, url, ...r };
    console.log(`[k1_qs] ${why}: rig ${JSON.stringify(r.rig)} screen=${r.screen} search=${r.search}`);
    if (LOG) appendFileSync(LOG, `${JSON.stringify(line)}\n`);
  } catch (e) {
    console.log(`[k1_qs] ${why}: readback failed — ${String(e).slice(0, 160)}`);
  }
}

function hookPage(page) {
  // `browser.newPage` may route through the patched `newContext`; hook each page once.
  if (page.__k1Hooked) return;
  page.__k1Hooked = true;
  const close = page.close.bind(page);
  page.close = async (...a) => { await readback(page, 'page.close'); return close(...a); };
}

function hookContext(ctx) {
  const close = ctx.close.bind(ctx);
  ctx.close = async (...a) => {
    for (const p of ctx.pages()) await readback(p, 'context.close');
    return close(...a);
  };
  const newPage = ctx.newPage.bind(ctx);
  ctx.newPage = async (...a) => { const p = await newPage(...a); hookPage(p); return p; };
}

if (QS) {
  console.log(`[k1_qs] injecting ?${QS} into every page`);
  const launch = chromium.launch.bind(chromium);
  chromium.launch = async (...args) => {
    const browser = await launch(...args);
    const newContext = browser.newContext.bind(browser);
    browser.newContext = async (...a) => {
      const ctx = await newContext(...a);
      await ctx.addInitScript(INIT, QS);
      hookContext(ctx);
      return ctx;
    };
    const newPage = browser.newPage.bind(browser);
    browser.newPage = async (...a) => {
      const page = await newPage(...a);
      await page.addInitScript(INIT, QS);
      hookPage(page);
      return page;
    };
    return browser;
  };
}
