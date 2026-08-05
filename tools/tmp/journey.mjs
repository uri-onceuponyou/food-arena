#!/usr/bin/env node
/**
 * END-TO-END JOURNEY — the whole shipped path, more than once, in one page session.
 *
 * ── Why this exists, given every gate in the repo is green ──────────────────
 * Every gate here is a UNIT gate. `menu_accept` checks screens, `sim.test` checks the
 * sim, `input_accept` checks input, `audio-probe` checks sounds — and this project's
 * own history says that is exactly the gap the expensive bugs live in: HEAD was
 * unbootable for 24 commits while every gate passed, and the two most valuable bug
 * reports ever received came from Uri simply *playing* the game.
 *
 * `tools/match-play.mjs` already drives ONE match end to end and is the parent of this
 * file — the policy, the `axesToward` quantiser, the HMR stub, the "read the HUD's own
 * DOM" rule and the sim-clock discipline are all lifted from it deliberately, so the
 * two cannot disagree about how the game is driven. What match-play cannot do is the
 * thing this run is *for*: **the second and third time round.** It boots, plays one
 * match and exits, so nothing it can ever report is about state LEAKING between a
 * match and the menus. This file keeps ONE page alive across three full
 * home -> select -> match -> result -> home round trips and asserts on what survives.
 *
 * ── What it asserts ─────────────────────────────────────────────────────────
 *   1. every screen reaches a ready state and none of them is blank (measured in
 *      pixels via sharp, not asserted from the DOM that claims to have drawn them);
 *   2. zero uncaught errors and zero unhandled rejections across the WHOLE journey —
 *      collected page-wide, reported verbatim, attributed to the leg that produced them;
 *   3. a match reaches a genuine terminal state, and both kinds are demanded: a
 *      knockout AND a timeout (see `--mode timeout` and `tools/tmp/e2e_timeout_finder.mjs`);
 *   4. live GL contexts stay flat across three round trips — six contexts once existed
 *      here with two leaked per trip and a white screen after ~8;
 *   5. the five headline claims of 2026-08-05 are true in the REAL game and not only
 *      in the probes that measured them: the match ends, the radar zone changes, the
 *      AI arrives, the pot does not swallow a fighter, the status lock is bounded.
 *
 * ── Measurement rules inherited from `docs/LESSONS.md` ──────────────────────
 *   * SwiftShader is a CPU rasteriser at ~9-10 fps. NOTHING here asserts on wall
 *     clock. Every time axis is the sim's own clock, read out of the game's HUD.
 *   * Roster thumbnails take ~29 s under SwiftShader; this waits on
 *     `window.__thumbsReady`, never on a timeout, because a fixed wait once produced a
 *     fake "blank roster card" that a critic then scored twice.
 *   * `window.__stage` is a single slot overwritten by the last `Stage` built, so GL
 *     contexts are counted by wrapping `HTMLCanvasElement.prototype.getContext`
 *     BEFORE any app code runs, not read off the renderer.
 *
 * ── Usage ───────────────────────────────────────────────────────────────────
 *   node tools/tmp/headserve.mjs -- node tools/tmp/journey.mjs --out shots/e2e/desktop
 *   node tools/tmp/headserve.mjs -- node tools/tmp/journey.mjs --viewport portrait --trips 1
 *   node tools/tmp/headserve.mjs -- node tools/tmp/journey.mjs --mode timeout
 *   node tools/tmp/headserve.mjs -- node tools/tmp/journey.mjs --mode idle
 *
 * Measure the COMMITTED tree (`headserve.mjs`), never the shared dev server and never
 * the working tree while peers are mid-edit — `docs/LESSONS.md` §5.
 */

import { chromium } from 'playwright';
import { mkdirSync, writeFileSync } from 'node:fs';
import { settleScreen, captureSettled, describe } from './settle.mjs';

const LAUNCH_ARGS = [
  '--use-gl=angle', '--use-angle=swiftshader', '--enable-unsafe-swiftshader',
  '--enable-webgl', '--ignore-gpu-blocklist', '--disable-gpu-sandbox',
];

const argv = process.argv.slice(2);
const arg = (k, d) => { const i = argv.indexOf(`--${k}`); return i >= 0 && argv[i + 1] && !argv[i + 1].startsWith('--') ? argv[i + 1] : (i >= 0 ? true : d); };
const BASE = String(arg('base', process.env.PREVIEW_BASE ?? 'http://localhost:5173')).replace(/\/$/, '');
const OUT = String(arg('out', 'shots/e2e/journey'));
const MODE = String(arg('mode', 'journey'));            // journey | timeout | idle | pot
const TRIPS = Number(arg('trips', 3));
const VIEWPORT_NAME = String(arg('viewport', 'desktop'));
const PLAYER = String(arg('player', 'hamburger'));
const TIMEOUT_ENEMY = String(arg('enemy', 'lollipop'));

const VIEWPORTS = {
  desktop: { width: 1440, height: 900, isMobile: false },
  portrait: { width: 390, height: 844, isMobile: true },
  'phone-landscape': { width: 844, height: 390, isMobile: true },
};
const VP = VIEWPORTS[VIEWPORT_NAME];
if (!VP) { console.error(`unknown --viewport ${VIEWPORT_NAME}; have ${Object.keys(VIEWPORTS)}`); process.exit(2); }

const ARENA = { cx: 700, cy: 500, potR: 95 };

// ─────────────────────────────────────────────────────────────────────────────
// results
// ─────────────────────────────────────────────────────────────────────────────
const checks = [];
let leg = 'boot';
function record(name, ok, detail = '') {
  checks.push({ leg, name, ok: !!ok, detail });
  console.log(`${ok ? 'PASS' : 'FAIL'}  ${String(leg).padEnd(16)} ${String(name).padEnd(34)} ${detail}`);
}
const notes = [];
function note(text) { notes.push({ leg, text }); console.log(`note  ${String(leg).padEnd(16)} ${text}`); }

// ─────────────────────────────────────────────────────────────────────────────
// the hands — lifted from `tools/match-play.mjs` so the two drive the game the
// same way. `axesToward` quantises to the 8 directions a keyboard can express;
// `sim.ts` does not normalise them, so diagonals are faster for the scripted
// player exactly as they are for a human.
// ─────────────────────────────────────────────────────────────────────────────
const KEYS = { up: 'KeyW', down: 'KeyS', left: 'KeyA', right: 'KeyD' };
const q = (v) => (v > 0.35 ? 1 : v < -0.35 ? -1 : 0);
function axesToward(px, py, tx, ty) {
  const dx = tx - px, dy = ty - py;
  const m = Math.max(Math.abs(dx), Math.abs(dy)) || 1;
  return { x: q(dx / m), y: q(dy / m) };
}

/**
 * Aggressive — provokes a KNOCKOUT. `tools/match-play.mjs:makePolicy('smart')`, plus the
 * one thing match-play's hands never do: **pick a weapon.**
 *
 * `match-play.mjs` drives WASD and the mouse and leaves the weapon on slot 1 for the
 * whole match, while `match-sim.mjs`'s policy re-picks the highest-damage READY weapon
 * in range every decision. That is not a small difference: it is the difference between
 * a player who wins `hamburger vs pizza` with 59 HP left (the sim, over 110 matchups)
 * and one who loses it 0-54 (this harness, before this change). Ready-state is read off
 * the HUD's own weapon bar, so the hands only ever use information the player can see.
 */
function makeFightPolicy(weapons) {
  const usable = weapons.filter((w) => w.type !== 'self' && (w.range ?? 0) <= 140);
  const band = (usable.length ? usable.reduce((b, w) => ((w.damage ?? 0) > (b.damage ?? 0) ? w : b)).range ?? 100 : 100) * 0.85;
  const hist = [];
  let detourUntil = -1, detourSign = 1;
  return (s) => {
    const { p, e, t, R } = s;
    const d = Math.hypot(p.x - e.x, p.y - e.y);
    hist.push({ t, x: p.x, y: p.y });
    while (hist.length && t - hist[0].t > 1500) hist.shift();
    if (t > detourUntil && hist.length > 3 && t - hist[0].t > 1200
      && Math.hypot(p.x - hist[0].x, p.y - hist[0].y) < 45) { detourSign = -detourSign; detourUntil = t + 900; hist.length = 0; }
    const dc = Math.hypot(p.x - ARENA.cx, p.y - ARENA.cy);
    let target;
    if (dc > R - 30) target = { x: ARENA.cx, y: ARENA.cy };
    else if (d > band) target = { x: e.x, y: e.y };
    else if (d < band * 0.5) { const a = Math.atan2(p.y - e.y, p.x - e.x); target = { x: p.x + Math.cos(a) * 100, y: p.y + Math.sin(a) * 100 }; }
    else { const a = Math.atan2(p.y - e.y, p.x - e.x) + Math.PI / 2; target = { x: p.x + Math.cos(a) * 100, y: p.y + Math.sin(a) * 100 }; }
    if (t < detourUntil) { const a = Math.atan2(target.y - p.y, target.x - p.x) + detourSign * (Math.PI / 2); target = { x: p.x + Math.cos(a) * 150, y: p.y + Math.sin(a) * 150 }; }
    // Highest-damage weapon that is READY (per the HUD) and can reach.
    let weapon = null, bestDmg = -Infinity;
    weapons.forEach((w, i) => {
      if (w.type === 'self' || (s.ready && s.ready[i] === false)) return;
      if (d > (w.range ?? Infinity)) return;
      if ((w.damage ?? 0) > bestDmg) { bestDmg = w.damage ?? 0; weapon = i; }
    });
    return { move: axesToward(p.x, p.y, target.x, target.y), fire: d <= band * 1.3, weapon };
  };
}

/**
 * KITE — provokes a TIMEOUT, and it is a legal way to play rather than a patched
 * build. The safe band is an ANNULUS (fog outside `R`, pot inside 95 wu), so the
 * plan is stated in the arena's polar frame; and the run is TANGENTIAL rather than
 * toward the far side of the circle, because a fixed antipodal target is a point the
 * AI walks a chord to. `PLAYER_SPEED` 0.12 > `AI_CHASE_SPEED` 0.07, so the player
 * wins the angular race at any radius. Derived and swept over all 110 matchups by
 * `tools/tmp/e2e_timeout_finder.mjs` (29/110 reach the clock; this pairing is the
 * most robust at 35 HP of margin).
 */
function makeKitePolicy() {
  let spin = 1;
  const hist = [];
  return (s) => {
    const { p, e, t, R } = s;
    const cx = ARENA.cx, cy = ARENA.cy;
    const dc = Math.hypot(p.x - cx, p.y - cy);
    hist.push({ t, x: p.x, y: p.y });
    while (hist.length && t - hist[0].t > 1500) hist.shift();
    if (hist.length > 3 && t - hist[0].t > 1200 && Math.hypot(p.x - hist[0].x, p.y - hist[0].y) < 45) { spin = -spin; hist.length = 0; }
    const ringR = Math.min(340, Math.max(ARENA.potR + 25, (ARENA.potR + R) / 2));
    const pa = Math.atan2(p.y - cy, p.x - cx);
    const ea = Math.atan2(e.y - cy, e.x - cx);
    let sep = ea - pa;
    while (sep > Math.PI) sep -= 2 * Math.PI;
    while (sep < -Math.PI) sep += 2 * Math.PI;
    const ta = pa + (sep > 0 ? -1 : 1) * 1.1;
    let target = { x: cx + Math.cos(ta) * ringR, y: cy + Math.sin(ta) * ringR };
    if (dc > R - 40 || Math.hypot(p.x - cx, p.y - cy) < ARENA.potR + 10) {
      const a3 = Math.atan2(p.y - cy, p.x - cx);
      target = { x: cx + Math.cos(a3) * ringR, y: cy + Math.sin(a3) * ringR };
    }
    return { move: axesToward(p.x, p.y, target.x, target.y), fire: false };
  };
}

// ─────────────────────────────────────────────────────────────────────────────
// page plumbing
// ─────────────────────────────────────────────────────────────────────────────

const errors = [];      // uncaught exceptions + unhandled rejections + console errors

async function makePage(browser) {
  const page = await browser.newPage({ viewport: { width: VP.width, height: VP.height }, isMobile: VP.isMobile, hasTouch: VP.isMobile, deviceScaleFactor: 1 });
  page.setDefaultTimeout(180_000);

  // Counted BEFORE any app code runs. `window.__stage` is a single slot overwritten
  // by the last Stage built (on menus that is a throwaway thumbnail generator that
  // then disposes), so a renderer-side count cannot see a leak. Wrapping getContext
  // sees every context anyone ever asked for, and `webglcontextlost` marks the ones
  // actually released — `renderer.dispose()` does NOT release one.
  await page.addInitScript(() => {
    const W = window;
    W.__gl = { created: [], rejections: [] };
    const orig = HTMLCanvasElement.prototype.getContext;
    HTMLCanvasElement.prototype.getContext = function (kind, ...rest) {
      const ctx = orig.call(this, kind, ...rest);
      if (ctx && /webgl/i.test(String(kind))) {
        const rec = { kind: String(kind), lost: false, at: Date.now() };
        W.__gl.created.push(rec);
        this.addEventListener('webglcontextlost', () => { rec.lost = true; });
      }
      return ctx;
    };
    W.addEventListener('unhandledrejection', (ev) => {
      W.__gl.rejections.push(String(ev.reason && ev.reason.stack ? ev.reason.stack : ev.reason));
    });
  });

  // A peer's save triggers a Vite full reload that wipes in-page state mid-run.
  // Mandatory for anything holding state across steps (`docs/TOOLS.md`).
  await page.route('**/@vite/client*', (r) => r.fulfill({
    status: 200, contentType: 'text/javascript',
    body: `const noop=()=>{};
export const createHotContext=()=>({accept:noop,acceptExports:noop,dispose:noop,prune:noop,
  invalidate:noop,on:noop,off:noop,send:noop,decline:noop,data:{}});
export const injectQuery=(u)=>u; export const updateStyle=noop; export const removeStyle=noop;
export const ErrorOverlay=class{}; export default {};`,
  }));

  page.on('pageerror', (e) => errors.push({ leg, kind: 'pageerror', text: String(e.stack ?? e) }));
  page.on('console', (m) => {
    const t = m.type();
    if (t === 'error' || t === 'warning') errors.push({ leg, kind: `console.${t}`, text: m.text() });
  });
  page.on('requestfailed', (r) => {
    const f = r.failure();
    // `net::ERR_ABORTED` on teardown is not a defect; everything else is.
    if (f && !/ERR_ABORTED/.test(f.errorText)) errors.push({ leg, kind: 'requestfailed', text: `${r.url()} — ${f.errorText}` });
  });
  page.on('response', (r) => { if (r.status() >= 400) errors.push({ leg, kind: 'http', text: `${r.status()} ${r.url()}` }); });
  return page;
}

/**
 * Wait for the screen to be VISIBLE, which is not what `window.__screenReady` means.
 *
 * `shell.ts:navigate` sets `__screenReady = true` in the same tick it drops the
 * curtain, and `.fa-screen` then runs a 0.26 s `fa-screen-in` entry animation. **At the
 * instant the flag flips, `.fa-screen` opacity is 0** — first measured by THIS file
 * (commit `09af4d0`), then reproduced on a frozen snapshot by `settle_validate.mjs`,
 * which found the flag wrong on 2 of 2 CURTAINED navigations and on 5 of 9 first mounts.
 *
 * ── This used to be a local predicate, and it was not enough ────────────────────
 * The version here checked `.fa-stack > *` opacity and the curtain, then slept. It
 * missed four things `tools/tmp/settle.mjs` checks, and every one of them can produce a
 * frame this harness would then score as a screen:
 *
 *   * `#boot` — index.html's boot overlay is z-index 200, is never removed and only
 *     fades. A capture inside that window is the purple boot gradient over everything,
 *     at full screen opacity. This file's own comment admitted it did not check it.
 *   * running finite animations on the screen root / `.fa-stack` / `.fa-root`, which is
 *     what actually pins `fa-screen-in`, `fa-open-slam` and `fa-sheet-in` to completion.
 *   * transform identity. `getBoundingClientRect()` INCLUDES transforms and
 *     `fa-screen-in` starts at `translateY(10px) scale(0.992)` — a 0.352px error on a
 *     44px tap target, which flipped a real verdict in `menu_accept`.
 *   * two consecutive frames, so a value sampled on a keyframe boundary cannot pass.
 *
 * `settle.mjs` is now the single copy of that predicate. The `ms` floor stays, because
 * it covers TIMED CONTENT (hint fades, HUD tweens) that no paint condition can predict
 * — but it is a floor under a condition now, not the condition itself.
 */
async function settle(page, ms = 1200) {
  const state = await settleScreen(page, { label: String(leg), soft: true, timeout: 30_000 });
  if (!state?.ok) note(`screen never reached full paint within 30 s — ${describe(state)}`);
  await page.waitForTimeout(ms);
}

/**
 * Every capture in this harness, through the guard.
 *
 * `captureSettled` brackets the shutter with a paint check on BOTH sides (the shutter
 * is not instantaneous under SwiftShader, so the paint state and the pixels can
 * disagree), applies the flat-frame floor, and writes a `<png>.capture.json` sidecar so
 * `tools/review.mjs` can refuse a packet built from a washed frame.
 *
 * `enforce: false` is deliberate and is NOT a weakening: this file's contract is to
 * COMPLETE the journey and report everything it found, and a thrown `CaptureRefused`
 * two screens in would destroy the only end-to-end evidence in the repo. So the guard
 * still runs, still records, and an unsettled capture becomes a printed FINDING —
 * which is exactly what this harness is for.
 *
 * The condition is applied HERE rather than trusted from the caller: three of the six
 * capture sites (`countdown`, `result_*`, `home_after_reload`) are reached without a
 * preceding `settle()`, and `home_after_reload` in particular follows a full page
 * reload. `soft: true` so a screen that never settles is reported instead of throwing;
 * 15 s rather than 30 s because `settle()` has usually already paid the wait and this
 * is the backstop.
 */
let shotN = 0;
async function shoot(page, label) {
  const name = `${String(shotN++).padStart(2, '0')}_${VIEWPORT_NAME}_${label}.png`;
  const pre = await settleScreen(page, { label, soft: true, timeout: 15_000 });
  if (!pre?.ok) note(`capture ${name}: screen not settled before the shutter — ${describe(pre)}`);
  const cap = await captureSettled(page, {
    path: `${OUT}/${name}`, label, tool: 'journey', wait: false, enforce: false,
  });
  if (!cap.painted) note(`capture ${name} was taken UNSETTLED — ${describe(cap.before.ok ? cap.after : cap.before)}`);
  // "White screen" and "black screen" are both FLAT. A real screen of this game has
  // structure, so the honest test is variance, not a colour. 4 is this file's own
  // historical threshold and is kept; `settle.mjs`'s FRAME_FLOOR of 8.0 is stricter and
  // is recorded in the sidecar, so both are on the record without moving the verdict.
  return { name, stdev: cap.stats.stdev, mean: cap.stats.mean, blank: cap.stats.stdev < 4, painted: cap.painted };
}

const glCount = (page) => page.evaluate(() => ({
  created: window.__gl.created.length,
  live: window.__gl.created.filter((c) => !c.lost).length,
  canvases: document.querySelectorAll('canvas').length,
  inDom: [...document.querySelectorAll('canvas')].filter((c) => c.isConnected).length,
}));

const readProfile = (page) => page.evaluate(() => {
  try { return JSON.parse(localStorage.getItem('food-arena.profile.v1') ?? 'null'); } catch { return 'UNPARSEABLE'; }
});

/** Everything the player is SHOWN, read off the HUD's own DOM — plus the sim mirror
 *  for positions. A HUD that stops updating shows up here as a flat trace. */
const READ = () => {
  const g = (s) => document.querySelector(s);
  const zoneBar = g('[data-el="zone-bar"]');
  const countdown = g('[data-el="countdown"]');
  const gameover = g('[data-el="gameover"]');
  const safe = g('[data-el="radar-safe"]');
  const radar = g('[data-el="radar-map"]');
  const sr = safe?.getBoundingClientRect();
  const rr = radar?.getBoundingClientRect();
  return {
    f: window.__vfxDebugFighters ?? null,
    scr: window.__vfxDebugScreen ?? null,
    dbg: window.__matchDebug ? { ...window.__matchDebug } : null,
    timer: g('[data-el="timer"]')?.textContent ?? null,
    zoneValue: g('[data-el="zone-value"]')?.textContent ?? null,
    zoneBar01: zoneBar ? parseFloat(zoneBar.style.width) / 100 : null,
    countdown: countdown && countdown.style.display !== 'none' ? countdown.textContent : null,
    ended: !!gameover && gameover.style.display === 'flex',
    result: g('[data-el="gameover-title"]')?.textContent ?? null,
    resultSub: g('[data-el="gameover-subtitle"]')?.textContent ?? null,
    playerHpText: g('[data-el="player-hp"]')?.textContent ?? null,
    // The radar's safe disc, in PIXELS, and whether it is on the card at all — the
    // fix's claim was not "too big", it was "off-card at t=0, t=6 and t=11.3".
    radarSafe: sr && rr ? {
      w: +sr.width.toFixed(1), h: +sr.height.toFixed(1),
      onCard: sr.left >= rr.left - 1 && sr.right <= rr.right + 1 && sr.top >= rr.top - 1 && sr.bottom <= rr.bottom + 1,
      overlapFrac: +(Math.max(0, Math.min(sr.right, rr.right) - Math.max(sr.left, rr.left))
        * Math.max(0, Math.min(sr.bottom, rr.bottom) - Math.max(sr.top, rr.top))
        / Math.max(1, sr.width * sr.height)).toFixed(3),
    } : null,
    ready: [...document.querySelectorAll('.hud-weapon')].map((w) => w.classList.contains('is-ready')),
    hudPresent: !!g('.hud-root') || !!g('[data-el="timer"]'),
    qa: window.__vfxQaCounts ? { ...window.__vfxQaCounts } : null,
  };
};

// ─────────────────────────────────────────────────────────────────────────────
// legs
// ─────────────────────────────────────────────────────────────────────────────

async function coldBoot(page) {
  leg = 'boot/opening';
  await page.goto(`${BASE}/`, { waitUntil: 'domcontentloaded', timeout: 180_000 });
  await page.waitForFunction('window.__screen === "opening"', null, { timeout: 180_000 })
    .then(() => record('opening-mounts', true, 'window.__screen === "opening"'))
    .catch((e) => record('opening-mounts', false, String(e).slice(0, 160)));
  await page.waitForFunction('window.__screenReady === true', null, { timeout: 120_000 }).catch(() => {});
  await settle(page);
  const s = await shoot(page, 'opening');
  record('opening-not-blank', !s.blank, `stdev ${s.stdev} mean ${s.mean} -> ${s.name}`);

  // A player taps "Play"; the card also auto-continues on its own timer, so this must
  // tolerate having already advanced.
  await page.click('.open-start, [data-el="start"]', { timeout: 8_000 }).catch(() => {});
  await page.waitForFunction('window.__screen === "home" && window.__screenReady === true', null, { timeout: 120_000 })
    .then(() => record('opening-to-home', true, 'reached home'))
    .catch((e) => record('opening-to-home', false, String(e).slice(0, 160)));
}

async function atHome(page, label) {
  leg = `home(${label})`;
  await page.waitForFunction('window.__screen === "home" && window.__screenReady === true', null, { timeout: 120_000 })
    .then(() => record('home-ready', true, '__screenReady')).catch((e) => record('home-ready', false, String(e).slice(0, 160)));
  await settle(page);
  const s = await shoot(page, `home_${label}`);
  record('home-not-blank', !s.blank, `stdev ${s.stdev} mean ${s.mean} -> ${s.name}`);
  // A HUD element that survives into the lobby is the exact class of bug this run is
  // for: it passes every unit gate because in isolation the HUD is never mounted.
  const stray = await page.evaluate(() => {
    const hud = document.querySelector('.hud-root');
    const vis = hud ? getComputedStyle(hud).display !== 'none' && hud.childElementCount > 0 : false;
    return {
      hudNodes: document.querySelectorAll('.hud-root, .hud-weapons .hud-weapon, .hud-radar, .hud-gameover').length,
      hudVisible: vis,
      gameCanvases: document.querySelectorAll('#game canvas').length,
      matchScreen: document.querySelectorAll('.fa-match').length,
      dmgNumbers: document.querySelectorAll('.hud-dmg').length,
    };
  });
  record('no-hud-in-lobby', !stray.hudVisible && stray.matchScreen === 0,
    `hud nodes ${stray.hudNodes} visible=${stray.hudVisible} matchScreen=${stray.matchScreen} dmg=${stray.dmgNumbers}`);
  const gl = await glCount(page);
  record('home-gl-live', gl.live <= 1, `live ${gl.live} / created ${gl.created} · canvases inDom ${gl.inDom}`);
  // "Audio does not resume after a match" is exactly the interaction class this run is
  // for, and it is invisible to `audio-probe.mjs`, which renders through
  // `OfflineAudioContext` and therefore can never observe a suspended live context.
  const a = await page.evaluate(() => (window.__audio ? window.__audio.stats() : null)).catch(() => null);
  if (a) {
    // 'idle' is legitimate before the first gesture; 'suspended' or 'failed' after a
    // match has already played is the failure mode ("the audio never came back").
    record('audio-context-not-stuck', a.state === 'running' || a.state === 'idle',
      `state=${a.state} voices started ${a.started} active ${a.activeVoices} droppedNotRunning ${a.droppedNotRunning} muted ${a.muted}`);
  } else note('window.__audio absent on this screen');
  return { ...gl, audio: a };
}

async function homeToSelect(page) {
  leg = 'character-select';
  await page.click('[data-el="start"]', { force: true });
  await page.waitForFunction('window.__screen === "characters" && window.__screenReady === true', null, { timeout: 120_000 })
    .then(() => record('select-ready', true, '__screenReady')).catch((e) => record('select-ready', false, String(e).slice(0, 160)));
  // NEVER a fixed wait: thumbnails take ~29 s under SwiftShader and a timeout here
  // once manufactured a "blank roster card" bug that a critic then scored twice.
  const t0 = Date.now();
  await page.waitForFunction('window.__thumbsReady === true', null, { timeout: 600_000 })
    .then(() => record('roster-thumbs-ready', true, `__thumbsReady after ${((Date.now() - t0) / 1000).toFixed(1)}s`))
    .catch((e) => record('roster-thumbs-ready', false, String(e).slice(0, 160)));
  const painted = await page.evaluate(() => ({
    cards: document.querySelectorAll('.chars-card[data-char]').length,
    rendered: document.querySelectorAll('.chars-card.has-render').length,
  }));
  record('roster-cards-rendered', painted.rendered === painted.cards && painted.cards === 11,
    `${painted.rendered}/${painted.cards} cards carry a render`);
  await settle(page);
  const s = await shoot(page, 'select');
  record('select-not-blank', !s.blank, `stdev ${s.stdev} mean ${s.mean} -> ${s.name}`);
}

async function selectToMatch(page) {
  leg = 'select->match';
  await page.click(`.chars-card[data-char="${PLAYER}"]`, { timeout: 20_000 }).catch(() => note(`no card for ${PLAYER}`));
  await page.waitForTimeout(600);
  await page.click('[data-el="fight"]', { force: true });
  await page.waitForFunction('window.__screen === "match"', null, { timeout: 120_000 })
    .then(() => record('match-mounts', true, '__screen === "match"')).catch((e) => record('match-mounts', false, String(e).slice(0, 160)));
  await page.waitForFunction('window.__gameReady === true', null, { timeout: 300_000 })
    .then(() => record('game-ready', true, '__gameReady')).catch((e) => record('game-ready', false, String(e).slice(0, 160)));
  const gl = await glCount(page);
  record('match-gl-live', gl.live <= 1, `live ${gl.live} / created ${gl.created}`);
  const who = await page.evaluate(() => ({
    p: document.querySelector('[data-el="player-name"]')?.textContent ?? '?',
    e: document.querySelector('[data-el="enemy-name"]')?.textContent ?? '?',
  }));
  note(`matchup off the HUD: ${who.p} vs ${who.e} (the menu route randomises the opponent)`);
  return who;
}

/** Watch the countdown actually count. Reads the HUD, not a screenshot. */
async function watchCountdown(page) {
  leg = 'countdown';
  const seen = new Set();
  const t0 = Date.now();
  while (Date.now() - t0 < 30_000) {
    const c = await page.evaluate(() => {
      const el = document.querySelector('[data-el="countdown"]');
      return el && el.style.display !== 'none' ? el.textContent : null;
    }).catch(() => null);
    if (c) seen.add(c.trim());
    else if (seen.size) break;
    await page.waitForTimeout(120);
  }
  record('countdown-counts', seen.size >= 2, `saw ${[...seen].join(' ')} (${seen.size} distinct)`);
  await shoot(page, 'countdown');
}

/**
 * Play the match. Returns the terminal state and everything sampled on the way.
 * Every time axis is the SIM's, read out of the HUD's mm:ss clock — SwiftShader's
 * frame rate is not a number this project is allowed to reason from.
 */
async function playMatch(page, { policy = 'fight', maxWallMs = 600_000, tag = 'ko' } = {}) {
  leg = `match(${tag})`;
  const weapons = await page.evaluate(async () => {
    const m = await import('/src/game/rules.ts');
    const name = document.querySelector('[data-el="player-name"]')?.textContent ?? '';
    const id = Object.keys(m.CHARACTERS).find((k) => m.CHARACTERS[k].name === name) ?? 'hamburger';
    return m.CHARACTERS[id].weapons.map((w) => ({ key: w.key, type: w.type, range: w.range ?? null, damage: w.damage }));
  }).catch(() => []);
  const decide = policy === 'kite' ? makeKitePolicy()
    : policy === 'idle' ? (() => ({ move: { x: 0, y: 0 }, fire: false }))
      : makeFightPolicy(weapons.length ? weapons : [{ type: 'ranged', range: 120, damage: 10 }]);

  const samples = [];
  const held = new Set();
  let firing = false, ended = false, r = null, selectedWeapon = 0;
  const t0 = Date.now();
  const setKeys = async (move) => {
    const want = new Set();
    if (move.x < 0) want.add(KEYS.left);
    if (move.x > 0) want.add(KEYS.right);
    if (move.y < 0) want.add(KEYS.up);
    if (move.y > 0) want.add(KEYS.down);
    for (const k of held) if (!want.has(k)) { await page.keyboard.up(k).catch(() => {}); held.delete(k); }
    for (const k of want) if (!held.has(k)) { await page.keyboard.down(k).catch(() => {}); held.add(k); }
  };
  const clock = (t) => { const m = /^(\d+):(\d\d)$/.exec(String(t ?? '').trim()); return m ? Number(m[1]) * 60 + Number(m[2]) : null; };

  while (Date.now() - t0 < maxWallMs && !ended) {
    try { r = await page.evaluate(READ); } catch { break; }
    if (!r.f) { await page.waitForTimeout(120); continue; }
    const p = r.f.player, e = r.f.enemy;
    // ── `safeRadius`, derived from the CLOCK rather than the zone bar ─────────
    // `rules.ts`: safeRadius = max(MIN_SAFE_RADIUS 140, MAX_SAFE_RADIUS 545 * (1 -
    // progress)) — it has a FLOOR. Reading it off the bar's width instead (which is
    // what `match-play.mjs` does) under-reads it badly in the endgame: measured 77
    // against a true 140 with four seconds left, which made the kite policy's
    // "get back inside the ring" branch fire permanently from ~20 s in, stop the
    // tangential run, and hand the chasing AI a stationary target. That cost the
    // timeout run its last four seconds — a harness fault, not the game's.
    const remS = clock(r.timer);
    const R = Math.max(140, 545 * ((remS ?? 45) / 45));
    samples.push({
      wall: Date.now() - t0, rem: clock(r.timer), timer: r.timer,
      px: Math.round(p.x), py: Math.round(p.y), php: p.hp,
      ex: Math.round(e.x), ey: Math.round(e.y), ehp: e.hp,
      d: Math.round(Math.hypot(p.x - e.x, p.y - e.y)), R: Math.round(R),
      radarSafe: r.radarSafe, countdown: r.countdown,
      moveX: r.dbg?.moveX ?? null, moveY: r.dbg?.moveY ?? null, paused: r.dbg?.paused ?? null,
      qa: r.qa,
    });
    if (r.ended) { ended = true; break; }
    if (r.countdown === null) {
      const act = decide({ p, e, t: Date.now() - t0, R, ready: r.ready });
      await setKeys(act.move);
      if (act.weapon != null && act.weapon !== selectedWeapon) {
        await page.keyboard.press(String(act.weapon + 1)).catch(() => {});
        selectedWeapon = act.weapon;
      }
      if (r.scr?.enemy) {
        await page.mouse.move(Math.max(2, Math.min(VP.width - 2, r.scr.enemy.x)), Math.max(2, Math.min(VP.height - 2, r.scr.enemy.y))).catch(() => {});
      }
      if (act.fire && !firing) { await page.mouse.down().catch(() => {}); firing = true; }
      else if (!act.fire && firing) { await page.mouse.up().catch(() => {}); firing = false; }
    }
    await page.waitForTimeout(80);
  }
  for (const k of held) await page.keyboard.up(k).catch(() => {});
  if (firing) await page.mouse.up().catch(() => {});

  const last = samples[samples.length - 1] ?? {};
  const kind = !ended ? 'NONE'
    : (last.php <= 0 || last.ehp <= 0) ? 'knockout' : 'timeout';
  record('match-reaches-terminal-state', ended,
    ended ? `${kind}: "${r?.result}" — player ${last.php} enemy ${last.ehp}, clock ${last.timer}` : `gave up after ${((Date.now() - t0) / 1000).toFixed(0)}s wall`);
  if (ended) {
    record('result-card-has-a-verdict', !!r.result && r.result.trim().length > 0, `title "${r.result}" · sub "${r.resultSub}"`);
    await page.waitForTimeout(1200);
    const s = await shoot(page, `result_${tag}`);
    record('result-not-blank', !s.blank, `stdev ${s.stdev} mean ${s.mean} -> ${s.name}`);
  }

  // ── the headline claims, measured off this match ─────────────────────────
  const fight = samples.filter((s) => s.countdown === null && s.radarSafe);
  if (fight.length > 4) {
    const first = fight[0].radarSafe, lastR = fight[fight.length - 1].radarSafe;
    const widths = fight.map((s) => s.radarSafe.w);
    record('radar-zone-changes', Math.abs(lastR.w - first.w) > 2,
      `safe disc ${first.w}px -> ${lastR.w}px (min ${Math.min(...widths)}, max ${Math.max(...widths)})`);
    // SIX SIM SECONDS, not six wall seconds — the recorded defect was "zero pixels
    // changing over the first six seconds of a 19.6 s mean match", and under
    // SwiftShader six wall seconds can be a third of one sim second.
    const rem0 = fight[0].rem ?? 0;
    const early = fight.filter((s) => (s.rem ?? 0) > rem0 - 6).map((s) => s.radarSafe.w);
    record('radar-zone-changes-in-first-6-SIM-s', early.length > 2 && Math.max(...early) - Math.min(...early) > 1,
      `first 6 sim s: ${early.length ? `${Math.min(...early)}..${Math.max(...early)}px over ${early.length} samples` : 'no samples'}`);
    const offCard = fight.filter((s) => !s.radarSafe.onCard).length;
    record('radar-zone-stays-on-card', offCard === 0 || fight.every((s) => s.radarSafe.overlapFrac > 0.05),
      `${offCard}/${fight.length} samples not fully inside the card; min overlap ${Math.min(...fight.map((s) => s.radarSafe.overlapFrac))}`);
    const minD = Math.min(...fight.map((s) => s.d));
    record('ai-arrives', minD <= 170, `closest approach ${minD} wu`);
    // Status lock, as an OBSERVABLE: input non-zero and the fighter not moving. Cover
    // collisions produce short spans of this too, so only the LONGEST run is judged,
    // against the 11.02 s freeze that 07a4e3a says it fixed.
    //
    // ⚠️ MEASURED IN SIM SECONDS, off the HUD's own mm:ss clock. The first version of
    // this accumulated WALL milliseconds and reported 7.80 s for a span that was 0.8 s
    // of match time — under SwiftShader with peers contending, this run put ~80 s of
    // wall clock through 8 s of sim. Comparing a wall-clock span against an 11.02 s
    // SIM-clock bug is exactly the false negative `docs/LESSONS.md` §10 warns about.
    // Resolution is 1 s (the clock only shows mm:ss), so this can only ever bound the
    // span, not measure it precisely — which is all a "is it still 11 s?" test needs.
    let run = 0, worst = 0;
    for (let i = 1; i < fight.length; i++) {
      const a = fight[i - 1], b = fight[i];
      if (a.rem === null || b.rem === null) { run = 0; continue; }
      const dSim = Math.max(0, a.rem - b.rem);
      const wanted = (b.moveX ?? 0) !== 0 || (b.moveY ?? 0) !== 0;
      const moved = Math.hypot(b.px - a.px, b.py - a.py) > 0.5;
      if (wanted && !moved && !b.paused) { run += dSim; worst = Math.max(worst, run); } else run = 0;
    }
    const simSpan = (fight[0].rem ?? 0) - (fight[fight.length - 1].rem ?? 0);
    record('no-multi-second-movement-freeze', worst <= 3,
      `longest span with input held and zero displacement: ${worst} SIM s of ${simSpan} s played (the bug was 11.02 s; clock resolution 1 s)`);
  } else {
    note('too few in-fight samples to judge the radar/AI/status claims');
  }
  return { ended, kind, samples, last, result: r?.result ?? null };
}

async function matchToHome(page) {
  leg = 'match->home';
  // The post-match Menu button is the shipped exit. It sits on top of the game-over
  // scrim by z-order (screen layer 40 vs the card's 20), which is exactly what "match
  // end -> back to menu" needs.
  await page.click('[data-el="exit"]', { force: true, timeout: 30_000 })
    .then(() => record('exit-button-clicks', true, '[data-el="exit"]'))
    .catch((e) => record('exit-button-clicks', false, String(e).slice(0, 160)));
  await page.waitForFunction('window.__screen === "home" && window.__screenReady === true', null, { timeout: 120_000 })
    .then(() => record('match-to-home', true, 'back at home')).catch((e) => record('match-to-home', false, String(e).slice(0, 160)));
}

// ─────────────────────────────────────────────────────────────────────────────

async function main() {
  mkdirSync(OUT, { recursive: true });
  const browser = await chromium.launch({ args: LAUNCH_ARGS });
  const page = await makePage(browser);
  const out = { base: BASE, viewport: VIEWPORT_NAME, size: VP, mode: MODE, trips: TRIPS };
  console.log(`\n══ journey  mode=${MODE}  viewport=${VIEWPORT_NAME} ${VP.width}x${VP.height}  base=${BASE} ══\n`);

  try {
    if (MODE === 'timeout') {
      // The menu route picks the opponent at random, so the one matchup proven to
      // reach the clock cannot be requested through it. `__shell.navigate` is the
      // IDENTICAL call `characterSelect.ts`'s Fight! button makes — same screen, same
      // session, same code path, minus the coin flip.
      await coldBoot(page);
      await atHome(page, 'boot');
      leg = 'timeout-setup';
      await page.evaluate(([p, e]) => window.__shell.navigate({ name: 'match', player: p, enemy: e }), [PLAYER, TIMEOUT_ENEMY]);
      await page.waitForFunction('window.__gameReady === true', null, { timeout: 300_000 });
      note(`forced matchup ${PLAYER} vs ${TIMEOUT_ENEMY} via the shell's own navigate()`);
      await watchCountdown(page);
      // A timeout needs the WHOLE 45 s clock. SwiftShader has been observed here
      // putting 8 s of sim through 152 s of wall with peers contending, so the cap has
      // to be generous or the run reports "no terminal state" for a harness reason.
      const m = await playMatch(page, { policy: 'kite', tag: 'timeout', maxWallMs: 2_400_000 });
      leg = 'timeout';
      record('ends-on-the-clock-not-a-knockout', m.kind === 'timeout',
        `terminal kind = ${m.kind} (player ${m.last.php}, enemy ${m.last.ehp}, clock ${m.last.timer})`);
      out.timeout = { kind: m.kind, last: m.last, result: m.result };
      writeFileSync(`${OUT}/samples_timeout.json`, JSON.stringify(m.samples, null, 2));
    } else if (MODE === 'win') {
      // Every match the journey played was a LOSS, so the win side of progression —
      // trophies, the win reward, `winsToNextChest`, an actual container landing in
      // the profile — was never exercised. `hamburger vs pizza` is the roster's most
      // robust player win in the committed sim (59 HP left of 100, decided in ~10 s of
      // play, swept over all 110 matchups), and the menu route cannot request it
      // because `characterSelect.ts:pickOpponent` is `Math.random()`.
      //
      // `--simSpeed` is the shipped QA parameter (`match.ts`), and it is the honest way
      // to close the one gap between these hands and `match-sim.mjs`'s: AIM. The sim
      // policy aims exactly at the enemy every decision; this one moves a real mouse to
      // the enemy's PROJECTED screen position, one frame stale, and every projectile
      // that misses is damage the sim's player lands. Slowing the sim relative to the
      // wall clock multiplies the scripted player's effective reaction rate without
      // changing a single rule — measured cost: two straight losses at 0-54 and 0-78 in
      // a matchup the committed sim says the player wins with 59 HP of 100 left.
      const SIM_SPEED = arg('simSpeed', null);
      let before = null;
      if (SIM_SPEED) {
        leg = 'win-setup';
        const qs = new URLSearchParams({ player: PLAYER, enemy: TIMEOUT_ENEMY, simSpeed: String(SIM_SPEED), pointerLock: '0' });
        await page.goto(`${BASE}/?${qs}`, { waitUntil: 'domcontentloaded', timeout: 180_000 });
        await page.waitForFunction('window.__gameReady === true', null, { timeout: 300_000 });
        before = await readProfile(page);
        note(`forced matchup ${PLAYER} vs ${TIMEOUT_ENEMY} at simSpeed=${SIM_SPEED} on the direct route`);
      } else {
      await coldBoot(page);
      await atHome(page, 'boot');
      before = await readProfile(page);
      leg = 'win-setup';
      await page.evaluate(([p, e]) => window.__shell.navigate({ name: 'match', player: p, enemy: e }), [PLAYER, TIMEOUT_ENEMY]);
      await page.waitForFunction('window.__gameReady === true', null, { timeout: 300_000 });
      note(`forced matchup ${PLAYER} vs ${TIMEOUT_ENEMY} via the shell's own navigate()`);
      }
      await watchCountdown(page);
      const m = await playMatch(page, { tag: 'win', maxWallMs: 1_200_000 });
      leg = 'win';
      record('player-actually-wins', m.result === 'VICTORY!', `result card says "${m.result}" (player ${m.last.php}, enemy ${m.last.ehp})`);
      await matchToHome(page);
      const after = await readProfile(page);
      record('win-banked', (after?.wins ?? 0) === (before?.wins ?? 0) + 1, `wins ${before?.wins} -> ${after?.wins}`);
      record('trophies-moved-on-a-win', (after?.economy?.trophies ?? 0) > (before?.economy?.trophies ?? 0),
        `trophies ${before?.economy?.trophies} -> ${after?.economy?.trophies}`);
      record('coins-moved-on-a-win', (after?.economy?.coins ?? 0) > (before?.economy?.coins ?? 0),
        `coins ${before?.economy?.coins} -> ${after?.economy?.coins}`);
      note(`containers after the win: ${JSON.stringify(after?.economy?.containers)}`);
      const snapshot = JSON.stringify(after);
      await page.reload({ waitUntil: 'domcontentloaded', timeout: 180_000 });
      await page.waitForFunction('window.__screen && window.__screenReady === true', null, { timeout: 180_000 }).catch(() => {});
      const reloaded = await readProfile(page);
      record('win-survives-reload', JSON.stringify(reloaded) === snapshot,
        `wins ${reloaded?.wins} trophies ${reloaded?.economy?.trophies} coins ${reloaded?.economy?.coins} containers ${JSON.stringify(reloaded?.economy?.containers)}`);
      const shown = await page.evaluate(() => ({
        wins: document.querySelector('[data-el="wins"]')?.textContent ?? null,
        trophies: document.querySelector('[data-el="trophies"]')?.textContent ?? null,
        coins: document.querySelector('[data-el="coins"]')?.textContent ?? null,
        chestsub: document.querySelector('[data-el="chestsub"]')?.textContent ?? null,
      }));
      record('home-shows-the-win-after-reload', String(shown.wins) === String(reloaded?.wins) && String(shown.trophies) === String(reloaded?.economy?.trophies),
        `home reads wins=${shown.wins} trophies=${shown.trophies} coins=${shown.coins} chest="${shown.chestsub}"`);
      out.win = { before, after, reloaded, shown };
    } else if (MODE === 'idle') {
      // The AI-arrival claim, stated as an OUTCOME rather than a symptom
      // (`docs/LESSONS.md` §13): does an idle player get reached at all?
      leg = 'idle';
      await page.goto(`${BASE}/?player=${PLAYER}&enemy=${TIMEOUT_ENEMY}&pointerLock=0`, { waitUntil: 'domcontentloaded', timeout: 180_000 });
      await page.waitForFunction('window.__gameReady === true', null, { timeout: 300_000 });
      const m = await playMatch(page, { policy: 'idle', tag: 'idle' });
      const minD = Math.min(...m.samples.filter((s) => s.countdown === null).map((s) => s.d));
      leg = 'idle';
      record('idle-player-is-reached', minD <= 140, `closest approach to a motionless player: ${minD} wu`);
      out.idle = { minD, kind: m.kind, last: m.last };
    } else {
      await coldBoot(page);
      const profile0 = await readProfile(page);
      const glHome = [];
      for (let trip = 1; trip <= TRIPS; trip++) {
        glHome.push({ trip, before: await atHome(page, `t${trip}`) });
        await homeToSelect(page);
        await selectToMatch(page);
        await watchCountdown(page);
        const m = await playMatch(page, { tag: `t${trip}` });
        out[`trip${trip}`] = { kind: m.kind, result: m.result, last: m.last };
        writeFileSync(`${OUT}/samples_trip${trip}.json`, JSON.stringify(m.samples, null, 2));
        await matchToHome(page);
        glHome[glHome.length - 1].after = await glCount(page);
      }
      const final = await atHome(page, 'final');
      leg = 'round-trips';
      const lives = glHome.map((g) => g.after.live);
      record('gl-contexts-flat-across-trips', new Set([...lives, final.live]).size === 1 && final.live <= 1,
        `live after each trip: ${lives.join(', ')} · final ${final.live} · ever created ${final.created}`);
      out.gl = { perTrip: glHome, final };

      // ── progression ─────────────────────────────────────────────────────
      leg = 'progression';
      const profile1 = await readProfile(page);
      record('profile-persisted-a-result', !!profile1 && (profile1.wins + profile1.losses) >= TRIPS,
        `wins ${profile1?.wins} losses ${profile1?.losses} (was ${profile0?.wins ?? 0}/${profile0?.losses ?? 0}) after ${TRIPS} matches`);
      record('profile-banked-once-per-match', !!profile1 && (profile1.wins + profile1.losses) === TRIPS,
        `${(profile1?.wins ?? 0) + (profile1?.losses ?? 0)} results banked for ${TRIPS} matches played`);
      const before = JSON.stringify(profile1);
      // ── A RELOAD DOES NOT LAND ON HOME, AND THIS BLOCK ASSUMED IT DID ─────────
      // `main.ts` DERIVES the boot route, and a reload of a bare `/` re-derives it from
      // scratch: opening -> home. `window.__screen && __screenReady === true` is
      // therefore satisfied by the OPENING screen, which carries none of home's DOM — so
      // the four `querySelector` calls below returned null and
      // `home-shows-the-persisted-record` failed a claim about PERSISTENCE with a fact
      // about ROUTING. Pre-existing; found by the capture sidecar this pass added, which
      // recorded `"screen": "opening"` inside a PNG labelled `home_after_reload`, i.e.
      // provenance caught a probe bug the pixels looked fine for. (It is the same
      // mechanism `docs/TOOLS.md` records for Uri's "the game crashed and started over":
      // a reload re-derives the route from the original bare `/`.)
      //
      // Fixed by driving opening -> home the way `coldBoot` already does, and waiting on
      // the screen NAME rather than on "some screen is ready".
      await page.reload({ waitUntil: 'domcontentloaded', timeout: 180_000 });
      await page.waitForFunction('window.__screen === "opening" || window.__screen === "home"', null, { timeout: 180_000 }).catch(() => {});
      await page.click('.open-start, [data-el="start"]', { timeout: 8_000 }).catch(() => { /* auto-continued */ });
      await page.waitForFunction('window.__screen === "home" && window.__screenReady === true', null, { timeout: 180_000 })
        .catch(() => note('never reached home after the reload — the record check below is measuring some other screen'));
      await settle(page);
      const profile2 = await readProfile(page);
      record('profile-survives-reload', JSON.stringify(profile2) === before,
        `wins ${profile2?.wins} losses ${profile2?.losses} trophies ${profile2?.economy?.trophies} coins ${profile2?.economy?.coins} ` +
        `containers ${Array.isArray(profile2?.economy?.containers) ? profile2.economy.containers.length : JSON.stringify(profile2?.economy?.containers)}`);
      const shown = await page.evaluate(() => ({
        wins: document.querySelector('[data-el="wins"]')?.textContent ?? null,
        losses: document.querySelector('[data-el="losses"]')?.textContent ?? null,
        trophies: document.querySelector('[data-el="trophies"]')?.textContent ?? null,
        coins: document.querySelector('[data-el="coins"]')?.textContent ?? null,
      }));
      record('home-shows-the-persisted-record',
        String(shown.wins) === String(profile2?.wins) && String(shown.losses) === String(profile2?.losses),
        `home reads wins=${shown.wins} losses=${shown.losses} trophies=${shown.trophies} coins=${shown.coins}; storage says ${profile2?.wins}/${profile2?.losses}`);
      out.profile = { before: profile0, afterMatches: profile1, afterReload: profile2, shownOnHome: shown };
      const s = await shoot(page, 'home_after_reload');
      record('home-after-reload-not-blank', !s.blank, `stdev ${s.stdev} mean ${s.mean} -> ${s.name}`);
    }
  } catch (e) {
    record('harness-completed', false, String(e).slice(0, 400));
  }

  leg = 'errors';
  const uncaught = errors.filter((e) => e.kind === 'pageerror');
  const rejections = await page.evaluate(() => window.__gl?.rejections ?? []).catch(() => []);
  record('zero-uncaught-exceptions', uncaught.length === 0, `${uncaught.length}`);
  record('zero-unhandled-rejections', rejections.length === 0, `${rejections.length}`);
  const consoleErr = errors.filter((e) => e.kind === 'console.error');
  record('zero-console-errors', consoleErr.length === 0, `${consoleErr.length}`);

  const pass = checks.filter((c) => c.ok).length;
  console.log(`\n${pass}/${checks.length} checks passed  (viewport ${VIEWPORT_NAME})`);
  if (errors.length) {
    console.log(`\n── console / network, verbatim (${errors.length}) ──`);
    for (const e of errors) console.log(`  [${e.leg}] ${e.kind}: ${e.text.slice(0, 400)}`);
  }
  if (rejections.length) { console.log(`\n── unhandled rejections ──`); for (const r of rejections) console.log(`  ${String(r).slice(0, 400)}`); }

  writeFileSync(`${OUT}/report.json`, JSON.stringify({ ...out, checks, errors, rejections, notes }, null, 2));
  await browser.close();
  process.exitCode = checks.every((c) => c.ok) ? 0 : 1;
}

main().catch((e) => { console.error(e); process.exitCode = 1; });
