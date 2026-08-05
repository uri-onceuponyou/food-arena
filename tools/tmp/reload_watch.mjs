#!/usr/bin/env node
/**
 * RELOAD WATCH — "the game crashes mid-match and starts over from the home screen".
 *
 * ── Why this exists ─────────────────────────────────────────────────────────
 * Uri reported: "Many times the game is crashing mid flight and starting over from
 * homescreen." Two facts pin the mechanism down before any measurement:
 *
 *   1. NOTHING in `src/` navigates to home on an error. Every `navigate({name:'home'})`
 *      is a button click handler. The only route that reaches home from a *fresh*
 *      state is boot -> opening -> home (`main.ts:bootRoute` + `opening.ts:123`).
 *   2. NOTHING in `src/` ever calls `history.pushState`/`replaceState`. The URL never
 *      changes as you navigate, so a page RELOAD from any screen re-derives the boot
 *      route from the ORIGINAL url. For a human playing at a bare `http://host/`,
 *      that is `opening` -> (auto-continue) -> `home`.
 *
 * So "starting over from homescreen" is the signature of a PAGE RELOAD, and this tool
 * exists to catch reloads in the act and name who ordered them.
 *
 * ── Why the existing e2e harness cannot see this ────────────────────────────
 * `tools/tmp/journey.mjs:224` deliberately `page.route()`s `@vite/client` to a no-op
 * stub, because a peer's save reloading the page wipes in-page state mid-run. That is
 * correct for a measurement harness and makes it STRUCTURALLY BLIND to the exact
 * failure Uri is reporting. This tool does the opposite: it leaves the real Vite HMR
 * client in place and instruments it.
 *
 * ── What it records ─────────────────────────────────────────────────────────
 * Everything is written to `sessionStorage`, so the record SURVIVES the reload it is
 * trying to catch (an in-page array would be destroyed by the very event of interest):
 *
 *   LOAD    every document load, with `performance.navigation.type` and the url
 *   WS      every Vite HMR websocket frame, verbatim (`full-reload`, `update`, `error`)
 *   UNLOAD  beforeunload / pagehide
 *   GL      webgl context creation, and `webglcontextlost` (the app has NO handler)
 *   ERR     window.onerror + unhandledrejection
 *   SCREEN  `window.__screen` sampled once the screen is ready after each load
 *
 * ── Modes ───────────────────────────────────────────────────────────────────
 *   --base <url>        server to drive (default the SHARED dev server, on purpose:
 *                       that is what Uri plays on)
 *   --watch <seconds>   sit in the match this long, doing nothing, and count reloads
 *   --touch <path>      after reaching the match, append a whitespace-only comment to
 *                       this file to trigger one HMR update. ONLY EVER point this at a
 *                       file inside a snapshot copy you own — touching the shared tree
 *                       reloads every peer's page and contaminates their measurements.
 *   --no-drive          skip the click-through; just sit on `/` (cheap smoke test)
 *
 * ── Usage ───────────────────────────────────────────────────────────────────
 *   # in the wild: are peers' saves reloading Uri's match right now?
 *   node tools/tmp/reload_watch.mjs --base http://localhost:5173 --watch 240
 *
 *   # controlled, harms nobody: private snapshot + touch a file inside it
 *   node tools/tmp/reload_watch.mjs --base $SNAP_URL --touch $SNAP_DIR/src/render/stage.ts
 */

import { chromium } from 'playwright';
import { appendFileSync, mkdirSync, writeFileSync } from 'node:fs';

const LAUNCH_ARGS = [
  '--use-gl=angle', '--use-angle=swiftshader', '--enable-unsafe-swiftshader',
  '--enable-webgl', '--ignore-gpu-blocklist', '--disable-gpu-sandbox',
];

const argv = process.argv.slice(2);
const arg = (k, d) => {
  const i = argv.indexOf(`--${k}`);
  return i >= 0 && argv[i + 1] && !argv[i + 1].startsWith('--') ? argv[i + 1] : (i >= 0 ? true : d);
};
const BASE = String(arg('base', process.env.PREVIEW_BASE ?? 'http://localhost:5173')).replace(/\/$/, '');
const WATCH_S = Number(arg('watch', 120));
const TOUCH = arg('touch', null);
const TOUCH_AFTER_MS = Number(arg('touch-after', 3000));
const NO_DRIVE = argv.includes('--no-drive');
const TRIPS = Number(arg('trips', 0));
const OUT = String(arg('out', 'shots/crash/reload_watch'));
const PLAYER = String(arg('player', 'hamburger'));

mkdirSync(OUT, { recursive: true });

const navs = [];   // node-side cross-check of main-frame navigations
const t0 = Date.now();
const el = () => `${((Date.now() - t0) / 1000).toFixed(1)}s`;
const say = (...a) => console.log(`[${el()}]`, ...a);

const INIT = () => {
  const KEY = '__rw_log';
  const read = () => { try { return JSON.parse(sessionStorage.getItem(KEY) || '[]'); } catch { return []; } };
  const write = (a) => { try { sessionStorage.setItem(KEY, JSON.stringify(a.slice(-800))); } catch { /* quota */ } };
  const loads = Number(sessionStorage.getItem('__rw_loads') || 0) + 1;
  sessionStorage.setItem('__rw_loads', String(loads));
  const log = (kind, detail) => {
    const a = read();
    a.push({ t: Date.now(), load: loads, kind, detail: String(detail).slice(0, 400) });
    write(a);
  };
  window.__rwLog = log;
  window.__rwRead = read;
  window.__rwLoads = loads;

  const navType = (() => {
    try { return performance.getEntriesByType('navigation')[0]?.type ?? '?'; } catch { return '?'; }
  })();
  log('LOAD', `#${loads} type=${navType} url=${location.href}`);

  // ---- Vite HMR websocket, verbatim -------------------------------------------------
  const NativeWS = window.WebSocket;
  const Wrapped = function (url, protocols) {
    const ws = protocols === undefined ? new NativeWS(url) : new NativeWS(url, protocols);
    log('WS', `open ${url} proto=${protocols}`);
    ws.addEventListener('message', (ev) => {
      const d = typeof ev.data === 'string' ? ev.data : '[binary]';
      // `update` payloads for CSS are noisy but harmless; keep everything, truncated.
      log('WS', d.length > 380 ? `${d.slice(0, 380)}…` : d);
    });
    ws.addEventListener('close', () => log('WS', `close ${url}`));
    ws.addEventListener('error', () => log('WS', `error ${url}`));
    return ws;
  };
  Wrapped.prototype = NativeWS.prototype;
  Wrapped.CONNECTING = 0; Wrapped.OPEN = 1; Wrapped.CLOSING = 2; Wrapped.CLOSED = 3;
  window.WebSocket = Wrapped;

  // ---- unload ----------------------------------------------------------------------
  window.addEventListener('beforeunload', () => log('UNLOAD', `beforeunload screen=${window.__screen} ready=${window.__screenReady}`));
  window.addEventListener('pagehide', () => log('UNLOAD', `pagehide screen=${window.__screen}`));
  document.addEventListener('visibilitychange', () => log('VIS', document.visibilityState));

  // ---- GL contexts, and the loss the app has no handler for -------------------------
  const origGet = HTMLCanvasElement.prototype.getContext;
  window.__rwGl = { created: 0, lost: 0, restored: 0 };
  HTMLCanvasElement.prototype.getContext = function (kind, ...rest) {
    const ctx = origGet.call(this, kind, ...rest);
    if (ctx && /webgl/i.test(String(kind))) {
      window.__rwGl.created++;
      log('GL', `getContext ${kind} #${window.__rwGl.created}`);
      this.addEventListener('webglcontextlost', (e) => {
        window.__rwGl.lost++;
        log('GL', `*** webglcontextlost *** default-prevented=${e.defaultPrevented} total-lost=${window.__rwGl.lost}`);
      });
      this.addEventListener('webglcontextrestored', () => { window.__rwGl.restored++; log('GL', 'webglcontextrestored'); });
    }
    return ctx;
  };

  // ---- errors ----------------------------------------------------------------------
  window.addEventListener('error', (ev) => log('ERR', `${ev.message} @ ${ev.filename}:${ev.lineno}`));
  window.addEventListener('unhandledrejection', (ev) => log('ERR', `rejection ${ev.reason && ev.reason.stack ? ev.reason.stack : ev.reason}`));
};

async function dump(page, label) {
  const rows = await page.evaluate(() => (window.__rwRead ? window.__rwRead() : [])).catch(() => []);
  const gl = await page.evaluate(() => window.__rwGl ?? null).catch(() => null);
  const loads = await page.evaluate(() => Number(sessionStorage.getItem('__rw_loads') || 0)).catch(() => 0);
  return { label, rows, gl, loads };
}

async function main() {
  const browser = await chromium.launch({ args: LAUNCH_ARGS });
  const page = await browser.newPage({ viewport: { width: 1440, height: 900 }, deviceScaleFactor: 1 });
  page.setDefaultTimeout(180_000);
  await page.addInitScript(INIT);

  page.on('framenavigated', (f) => {
    if (f === page.mainFrame()) { navs.push({ at: Date.now() - t0, url: f.url() }); say(`NAVIGATED -> ${f.url()}`); }
  });
  page.on('pageerror', (e) => say('pageerror:', String(e).slice(0, 200)));
  page.on('console', (m) => { if (m.type() === 'error') say('console.error:', m.text().slice(0, 200)); });
  page.on('crash', () => say('*** PAGE CRASHED (renderer) ***'));

  say(`goto ${BASE}/  (bare url — exactly what a human types)`);
  await page.goto(`${BASE}/`, { waitUntil: 'domcontentloaded', timeout: 180_000 });

  // ── the click-through a human actually performs ────────────────────────────
  async function toHomeFromBoot() {
    await page.waitForFunction('window.__screen === "opening" || window.__screen === "home"', null, { timeout: 120_000 }).catch(() => {});
    await page.click('.open-start, [data-el="start"]', { timeout: 8_000 }).catch(() => {});
    await page.waitForFunction('window.__screen === "home" && window.__screenReady === true', null, { timeout: 180_000 });
  }
  async function homeToMatch() {
    await page.click('[data-el="start"]', { force: true });
    await page.waitForFunction('window.__screen === "characters" && window.__screenReady === true', null, { timeout: 180_000 });
    // Thumbnails are ~29s under SwiftShader the first time; never a fixed wait.
    await page.waitForFunction('window.__thumbsReady === true', null, { timeout: 300_000 }).catch(() => say('no __thumbsReady; continuing'));
    await page.click(`.chars-card[data-char="${PLAYER}"]`, { timeout: 30_000 }).catch(() => say(`no card for ${PLAYER}`));
    await page.click('[data-el="fight"]', { force: true });
    await page.waitForFunction('window.__gameReady === true', null, { timeout: 300_000 });
  }
  async function matchToHome() {
    // The pause chip, then quit — the same two controls a player uses.
    // `[data-el="exit"]` is the game-over "Menu" button and is hidden mid-match; the
    // live route is the pause chip, which opens the sheet holding "Quit to Home".
    await page.click('[data-el="pause"]', { force: true, timeout: 20_000 }).catch(() => say('no pause chip'));
    await page.click('[data-el="quit"]', { force: true, timeout: 20_000 }).catch(() => say('no quit button'));
    await page.waitForFunction('window.__screen === "home" && window.__screenReady === true', null, { timeout: 180_000 });
  }

  if (!NO_DRIVE) {
    await toHomeFromBoot();
    say('home ready');
    await homeToMatch();
    say(`MATCH LIVE — __screen=${await page.evaluate(() => window.__screen)}`);
  }

  // ── hypothesis 2/4: resource exhaustion across MANY round trips ────────────
  // The e2e run did three. A player does far more, and creation churn was 2 contexts
  // per trip when the leak that white-screened after ~8 was live.
  const trips = [];
  if (TRIPS > 0) {
    const cdp = await page.context().newCDPSession(page).catch(() => null);
    if (cdp) await cdp.send('Performance.enable').catch(() => {});
    const metric = async (name) => {
      if (!cdp) return null;
      const m = await cdp.send('Performance.getMetrics').catch(() => null);
      return m ? (m.metrics.find((x) => x.name === name)?.value ?? null) : null;
    };
    for (let i = 1; i <= TRIPS; i++) {
      await matchToHome();
      await homeToMatch();
      const gl = await page.evaluate(() => window.__rwGl).catch(() => ({}));
      const canvases = await page.evaluate(() => document.querySelectorAll('canvas').length).catch(() => -1);
      const domNodes = await metric('Nodes');
      const listeners = await metric('JSEventListeners');
      const heap = await metric('JSHeapUsedSize');
      const errs = await page.evaluate(() => (window.__rwRead ? window.__rwRead().filter((r) => r.kind === 'ERR').length : -1)).catch(() => -1);
      const row = {
        trip: i, at: Math.round((Date.now() - t0) / 1000),
        glCreated: gl.created, glLost: gl.lost, glLive: (gl.created ?? 0) - (gl.lost ?? 0),
        canvases, domNodes, listeners, heapMB: heap ? +(heap / 1048576).toFixed(1) : null, errors: errs,
      };
      trips.push(row);
      say(`trip ${i}/${TRIPS}: glCreated=${row.glCreated} glLive=${row.glLive} canvases=${canvases} nodes=${domNodes} listeners=${listeners} heap=${row.heapMB}MB errors=${errs}`);
      await page.screenshot({ path: `${OUT}/trip-${String(i).padStart(2, '0')}.png` }).catch(() => {});
    }
  }

  const beforeScreen = await page.evaluate(() => window.__screen).catch(() => null);
  await page.screenshot({ path: `${OUT}/before.png` }).catch(() => {});

  if (TOUCH) {
    await page.waitForTimeout(TOUCH_AFTER_MS);
    say(`touching ${TOUCH} (one whitespace-only comment append)`);
    appendFileSync(String(TOUCH), `\n// reload_watch touch ${new Date().toISOString()}\n`);
  }

  // ---- the watch ---------------------------------------------------------------------
  const deadline = Date.now() + WATCH_S * 1000;
  let lastLoads = await page.evaluate(() => Number(sessionStorage.getItem('__rw_loads') || 0)).catch(() => 1);
  const reloads = [];
  while (Date.now() < deadline) {
    await page.waitForTimeout(1000);
    const loads = await page.evaluate(() => Number(sessionStorage.getItem('__rw_loads') || 0)).catch(() => lastLoads);
    if (loads > lastLoads) {
      // Name the FIRST screen it lands on, then follow it to rest. `opening`
      // auto-continues, so a single sample right after the reload under-reports where
      // the player actually ends up — which is the whole claim being tested.
      await page.waitForFunction('window.__screen', null, { timeout: 60_000 }).catch(() => {});
      await page.waitForTimeout(1500);
      const firstScreen = await page.evaluate(() => window.__screen).catch(() => null);
      await page.waitForFunction('window.__screen === "home" && window.__screenReady === true', null, { timeout: 60_000 })
        .catch(() => say('did not reach home within 60s of the reload'));
      // `__screenReady` fires while the screen is still at opacity 0 (`docs/RESUME.md`),
      // so settle past the 0.26s fade before judging the pixels.
      await page.waitForTimeout(2500);
      const screen = await page.evaluate(() => window.__screen).catch(() => null);
      const url = page.url();
      reloads.push({ at: Math.round((Date.now() - t0) / 1000), loads, firstScreen, screen, url });
      say(`*** RELOAD #${loads} — first screen="${firstScreen}" -> settled on "${screen}" url=${url} ***`);
      await page.screenshot({ path: `${OUT}/after-reload-${loads}.png` }).catch(() => {});
      lastLoads = loads;
      if (TOUCH) break;   // controlled test: one reload is the whole experiment
    }
  }

  const d = await dump(page, 'final');
  const report = {
    base: BASE, watchSeconds: WATCH_S, touched: TOUCH || null, roundTrips: TRIPS,
    screenBeforeWatch: beforeScreen,
    loads: d.loads, gl: d.gl, reloads, trips, navigations: navs,
    log: d.rows,
  };
  writeFileSync(`${OUT}/report.json`, JSON.stringify(report, null, 2));

  console.log('\n================ RELOAD WATCH ================');
  console.log(`base                ${BASE}`);
  console.log(`screen before watch ${beforeScreen}`);
  console.log(`document loads      ${d.loads}   (1 = never reloaded)`);
  console.log(`gl contexts         created=${d.gl?.created} lost=${d.gl?.lost} restored=${d.gl?.restored}`);
  console.log(`reloads observed    ${reloads.length}`);
  for (const r of reloads) console.log(`   +${r.at}s  load#${r.loads}  first "${r.firstScreen}" -> settled "${r.screen}"  ${r.url}`);
  if (trips.length) {
    console.log(`\nmenu<->match round trips (${trips.length}):`);
    for (const t of trips) console.log(`   trip ${String(t.trip).padStart(2)}  +${t.at}s  glCreated=${t.glCreated} glLost=${t.glLost} live=${t.glLive}  heapMB=${t.heapMB}  listeners=${t.listeners}  domNodes=${t.domNodes}  canvases=${t.canvases}  errors=${t.errors}`);
  }
  const ws = d.rows.filter((r) => r.kind === 'WS');
  console.log(`\nvite websocket frames (${ws.length}):`);
  for (const r of ws.slice(-40)) console.log(`   load#${r.load}  ${r.detail}`);
  const other = d.rows.filter((r) => r.kind !== 'WS');
  console.log(`\nother events (${other.length}):`);
  for (const r of other.slice(-60)) console.log(`   load#${r.load}  ${r.kind}  ${r.detail}`);
  console.log(`\nwrote ${OUT}/report.json`);

  await browser.close();
}

main().catch((e) => { console.error(e); process.exit(1); });
