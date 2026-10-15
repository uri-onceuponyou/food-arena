#!/usr/bin/env node
/**
 * B2_INPUT — the acceptance rows for wave 2's B2 package (input + the match screen),
 * `docs/REVAMP.md` §5. Every BUG row was RED on `8586f00` (the package's base) before its
 * fix landed; every CONTROL row is green on both trees and exists so a red bug row means
 * "the game did not do it", never "the probe could not see it".
 *
 *   §F2  a press shorter than one frame fires exactly once (mouse, touch); a held press is
 *        not double-fired; a countdown press does not fire at GO
 *   §F3  a mouse-clicked chip does not keep focus, so Space / Enter do not re-press it
 *   §F4  AZERTY: the number row selects a weapon by physical code
 *   §F5  letterboxed window: the mouse aims and fires in the bars
 *   §F6  with mouse capture on, the "Pause" chip opens the pause sheet (and Esc on the scrim)
 *   §F7  phone: the first touch of a match on a weapon slot selects it and fires nothing
 *   §F8  Q / E (item keys) and Space cannot be movement keys; Controls lists the item keys
 *   §PL  after the whistle, a window blur raises no scrim and nothing can re-capture the mouse;
 *        Play Again still re-captures
 *   §M9  `?items=constructor` is not an item (match.ts's loadout gate, an own-property test)
 *   §BC  a Blue Cheese aura tick (`itemId: 'blue_cheese'`) fires no hit-stop / kick / burst
 *
 * ── THE ONE INSTRUMENT MOST ROWS SHARE ──────────────────────────────────────
 * An init script wraps `requestAnimationFrame` and, after every callback that advanced
 * `window.__matchDebug.frames` (the game loop's own counter, published by `publishDebug`
 * after the step), records what the loop handed the sim that frame: `attack`, `phase`,
 * `paused`, `selectedWeapon`, `facing`, `move`. Nothing here is a field this probe added.
 * The live `MatchState` (for `lastUsed` / `item.equipped`) is reached the way `b1_match` does
 * it: by wrapping `VfxLayer.prototype.sync` through the snapshot's own module instance.
 *
 * ── KNOWN-BAD PLANTS (rows that guard a CHOICE, which the base cannot falsify) ──
 *   --plant short-circuit  `playing && (held || takeAttackPress())` — the press is not taken
 *                          during 3-2-1, so a countdown click fires at GO   → §F2 countdown red
 *   --plant held-latch     the latch is consumed only when not held — a held press leaves a
 *                          stale latch that fires one extra frame after release → §F2 held red
 *   --plant no-reactivate  spawnMatch() without its notifyPhase(), so restart()'s resume meets
 *                          engage()'s new !matchActive gate → §PL Play Again red
 * Each plant must MATCH the served source or the run is void (`plant hits` row).
 *
 *   node tools/tmp/sx_snap.mjs --root <worktree> -- node tools/tmp/b2_input.mjs --url '{URL}'
 *     --sections F2,F3,...   run a subset          --out <dir>   PNGs (default: a /tmp dir)
 *
 * Exit 0 iff every row passed. Read-only on the game: URL params, storage, synthetic DOM
 * events and CDP input; the plants rewrite the SERVED copy, never a file.
 *
 * ── REDS THESE FIXES CAUSE IN OTHER TOOLS, BY CONSTRUCTION (not edited — not B2's files) ──
 *   tools/tmp/touchprobe.mjs  'touch/no-fa-touch-before-a-real-finger' (fa-touch=true) and
 *                             'weapons/slots-inert-before-any-touch' (pointer-events=auto):
 *                             both assert the pre-F7 rule on an isMobile context. Measured
 *                             with --url on snapshots: green on 8586f00 in 2/2 runs, red on
 *                             the F7 tree in 2/2. ⚠️ touchprobe reads `--url` and NOT
 *                             PREVIEW_BASE — without the flag it silently measures :5173.
 *   tools/audio-probe.mjs     same trap with `--base`: under sx_snap it still loads :5173
 *                             unless `--base '{URL}'` is passed.
 */
import { chromium } from 'playwright';
import { mkdirSync } from 'node:fs';

const A = {};
for (let i = 2; i < process.argv.length; i++) {
  const k = process.argv[i];
  if (!k.startsWith('--')) continue;
  const v = process.argv[i + 1];
  if (v === undefined || v.startsWith('--')) A[k.slice(2)] = true; else { A[k.slice(2)] = v; i++; }
}
const BASE = String(A.url ?? process.env.PREVIEW_BASE ?? '').replace(/\/$/, '');
if (!BASE || /:5173(\/|$)/.test(BASE)) { console.error('b2_input: --url must be a SNAPSHOT (sx_snap), never :5173'); process.exit(2); }
const SECTIONS = String(A.sections ?? 'F2,F3,F4,F5,F6,F7,F8,PL,M9,BC').split(',');
const OUT = String(A.out ?? '/tmp/b2_input');
const PLANT = A.plant ? String(A.plant) : null;
mkdirSync(OUT, { recursive: true });

const LAUNCH_ARGS = ['--use-gl=angle', '--use-angle=swiftshader', '--enable-unsafe-swiftshader',
  '--enable-webgl', '--ignore-gpu-blocklist', '--disable-gpu-sandbox'];
const VITE_CLIENT_STUB = 'const noop=()=>{};export const createHotContext=()=>({accept:noop,acceptExports:noop,'
  + 'dispose:noop,prune:noop,invalidate:noop,on:noop,off:noop,send:noop,decline:noop,data:{}});'
  + 'export const injectQuery=(u)=>u;export const updateStyle=noop;export const removeStyle=noop;'
  + 'export const ErrorOverlay=class{};export default {};';
const SETTINGS_KEY = 'food-arena.settings.v1';

const PLANTS = {
  // ⚠️ BOTH LINES. The first cut of this plant rewrote only the `attack` line and left
  // `const pressed = this.input.takeAttackPress();` above it, which spent the latch every
  // frame — so the planted variant never saw a press at all and the countdown row stayed
  // GREEN under it (the sub-frame rows went red instead). A plant that cannot express the
  // bug it names is the "known-bad planted where the bug cannot express itself" of CLAUDE.md
  // rule 6, caught here by running it rather than by reading it.
  'short-circuit': {
    from: /const pressed = this\.input\.takeAttackPress\(\);\s*const attack = playing && \(this\.input\.attackHeld \|\| pressed\);/,
    to: 'const attack = playing && (this.input.attackHeld || this.input.takeAttackPress());',
  },
  // §PL: `spawnMatch()` without the `notifyPhase()` that re-activates the pointer lock before
  // `restart()` resumes. ⚠️ The first cut of this plant removed a `setMatchActive(true)` added
  // to `restart()` — and the row stayed GREEN under it, because `spawnMatch()` already
  // re-activates synchronously: the added line was redundant and was taken back out.
  'no-reactivate': {
    from: /this\.lastPhase = null;\n(\s*)this\.notifyPhase\(\);/,
    to: 'this.lastPhase = null;',
  },
  'held-latch': {
    from: /const pressed = this\.input\.takeAttackPress\(\);/,
    to: 'const pressed = this.input.attackHeld ? false : this.input.takeAttackPress();',
  },
};
if (PLANT && !PLANTS[PLANT]) { console.error(`unknown --plant ${PLANT}`); process.exit(2); }
let plantHits = 0;

const rows = [];
function row(sec, name, pass, detail) {
  rows.push({ sec, name, pass: !!pass });
  const d = detail === undefined ? '' : `  — ${typeof detail === 'string' ? detail : JSON.stringify(detail)}`;
  console.log(`${pass ? 'PASS' : 'FAIL'}  §${sec} ${name}${d.length > 700 ? `${d.slice(0, 700)}…` : d}`);
}

/** Per-loop-frame record. See the header. */
const FRAME_RECORDER = () => {
  const R = (window.__b2 = { loop: [] });
  const orig = window.requestAnimationFrame.bind(window);
  window.requestAnimationFrame = (cb) => orig((t) => {
    const f0 = window.__matchDebug ? window.__matchDebug.frames : null;
    cb(t);
    const d = window.__matchDebug;
    if (!d || d.frames === f0) return;
    R.loop.push({ frame: d.frames, attack: d.attack, phase: d.phase, paused: d.paused,
      sel: d.selectedWeapon, fx: d.facingX, fy: d.facingY, mx: d.moveX, my: d.moveY });
    if (R.loop.length > 800) R.loop.splice(0, 200);
  });
};

const browser = await chromium.launch({ args: LAUNCH_ARGS });

async function open(ctxOpts = {}) {
  const ctx = await browser.newContext({ viewport: { width: 640, height: 400 }, deviceScaleFactor: 1, ...ctxOpts });
  await ctx.addInitScript(FRAME_RECORDER);
  const page = await ctx.newPage();
  const errors = [];
  page.on('pageerror', (e) => errors.push(String(e).slice(0, 300)));
  await page.route('**/@vite/client*', (r) => r.fulfill({ status: 200, contentType: 'text/javascript', body: VITE_CLIENT_STUB }));
  if (PLANT) {
    const P = PLANTS[PLANT];
    await page.route('**/src/game/match.ts*', async (route) => {
      const res = await route.fetch();
      let body = await res.text();
      if (P.from.test(body)) { body = body.replace(P.from, P.to); plantHits++; }
      await route.fulfill({ response: res, body });
    });
  }
  return { ctx, page, errors };
}
const wait = (page, fn, arg, ms = 300_000) => page.waitForFunction(fn, arg, { timeout: ms, polling: 50 });
const shot = (page, name) => page.screenshot({ path: `${OUT}/${name}.png` }).catch(() => {});
async function boot(page, query, phase = 'playing') {
  await page.goto(`${BASE}/?${query}`, { waitUntil: 'domcontentloaded', timeout: 180_000 });
  await wait(page, () => window.__gameReady === true);
  if (phase) await wait(page, (ph) => window.__matchDebug?.phase === ph, phase);
}
const frameNow = (page) => page.evaluate(() => window.__matchDebug.frames);
async function frames(page, n) {
  const f0 = await frameNow(page);
  await wait(page, (a) => window.__matchDebug.frames - a.f0 >= a.n, { f0, n });
  return f0;
}
const loopSince = (page, f) => page.evaluate((f) => window.__b2.loop.filter((r) => r.frame > f), f);
const dbg = (page) => page.evaluate(() => ({ ...window.__matchDebug }));
async function hookState(page) {
  await page.evaluate(async () => {
    const vfx = await import('/src/game/vfx.ts');
    const v = vfx.VfxLayer.prototype;
    if (!v.sync.__b2) {
      const orig = v.sync;
      const f = function (...args) { window.__b2State = args[0]; return orig.apply(this, args); };
      f.__b2 = true; v.sync = f;
    }
  });
  await wait(page, () => !!window.__b2State && Array.isArray(window.__b2State.fighters), null, 120_000);
}
const lastUsed0 = (page) => page.evaluate(() => {
  const f = window.__b2State.fighters[0];
  return f.lastUsed.map((t) => (Number.isFinite(t) ? Math.round(t) : null));
});
/** Same task, one frame boundary away: dispatched from a rAF callback that runs AFTER the
 *  game loop's own callback in that frame, so down and up both land between two samples. */
const SUBFRAME_MOUSE = () => new Promise((res) => requestAnimationFrame(() => {
  const c = document.querySelector('#game canvas') || document.querySelector('canvas');
  const r = c.getBoundingClientRect();
  const x = r.left + r.width * 0.7, y = r.top + r.height * 0.5;
  const at = window.__matchDebug.frames;
  c.dispatchEvent(new MouseEvent('mousedown', { button: 0, bubbles: true, cancelable: true, clientX: x, clientY: y }));
  window.dispatchEvent(new MouseEvent('mouseup', { button: 0, bubbles: true, cancelable: true, clientX: x, clientY: y }));
  res({ at, after: window.__matchDebug.frames });
}));
const SUBFRAME_TOUCH = () => new Promise((res) => requestAnimationFrame(() => {
  const c = document.querySelector('#game canvas') || document.querySelector('canvas');
  const x = window.innerWidth * 0.75, y = window.innerHeight * 0.45;
  const t = new Touch({ identifier: 41, target: c, clientX: x, clientY: y });
  const at = window.__matchDebug.frames;
  c.dispatchEvent(new TouchEvent('touchstart', { touches: [t], targetTouches: [t], changedTouches: [t], bubbles: true, cancelable: true }));
  c.dispatchEvent(new TouchEvent('touchend', { touches: [], targetTouches: [], changedTouches: [t], bubbles: true, cancelable: true }));
  res({ at, after: window.__matchDebug.frames });
}));
const centre = (page, sel) => page.evaluate((s) => {
  const e = document.querySelector(s); if (!e) return null;
  const r = e.getBoundingClientRect(); return { x: r.left + r.width / 2, y: r.top + r.height / 2, w: r.width, h: r.height };
}, sel);
const sheetOpen = (page) => page.evaluate(() => document.querySelector('.match-sheet')?.classList.contains('is-open') ?? false);
const plock = (page) => page.evaluate(() => ({ ...(window.__plockDebug ?? {}) }));
const DUEL = 'player=hamburger&enemy=donut';
/** Decide a 1v1 for the local seat: the sim's own `combat.applyDamage` on the live state, its
 *  events through `window.__feelEvent` (= `GameSession.handleEvents`) — `b1_match`'s method. */
async function endMatch(page) {
  await hookState(page);
  await page.evaluate(async () => {
    const combat = await import('/src/game/combat.ts');
    const rules = await import('/src/game/rules.ts');
    const st = window.__b2State;
    const w = rules.CHARACTERS[st.fighters[0].characterId].weapons[0];
    const evs = [];
    combat.applyDamage(st, st.fighters[1], 9999, null, { kind: 'weapon', weaponKey: w.key, weaponName: w.name, attackerId: 0 }, evs);
    for (const ev of evs) window.__feelEvent(ev);
  });
  await wait(page, () => window.__matchDebug?.phase === 'ended');
  await frames(page, 2);
}


try {
  // ── §F2 SUB-FRAME PRESSES ─────────────────────────────────────────────────────
  if (SECTIONS.includes('F2')) {
    {
      const { ctx, page, errors } = await open();
      try {
        await boot(page, `screen=match&${DUEL}&pointerLock=0&fogRadius=900`);
        await hookState(page);
        await frames(page, 2);
        const before = await lastUsed0(page);
        const sub = await page.evaluate(SUBFRAME_MOUSE);
        await frames(page, 4);
        const after = await loopSince(page, sub.at);
        const atk = after.filter((r) => r.attack).length;
        const lu = await lastUsed0(page);
        row('F2', 'NON-VACUITY: the mouse press was sub-frame (down and up inside one task, no loop frame between)', sub.after === sub.at, sub);
        row('F2', 'BUG: a sub-frame CLICK reaches the sim on EXACTLY one frame', atk === 1, { attackFrames: atk, frames: after.map((r) => r.frame) });
        row('F2', 'BUG: …and the local weapon really FIRED (lastUsed stamped)', before[0] === null && lu[0] !== null, { before, after: lu });

        // CONTROL + guard: a press HELD for >= 3 frames fires every held frame, and the first
        // frame after the release hands the sim nothing (no stale latch, no double fire).
        await frames(page, 3);
        const box = await page.evaluate(() => { const r = document.querySelector('#game canvas').getBoundingClientRect(); return { x: r.left + r.width * 0.3, y: r.top + r.height * 0.5 }; });
        await page.mouse.move(box.x, box.y);
        const h0 = await frameNow(page);
        await page.mouse.down();
        await wait(page, (f) => window.__matchDebug.frames - f >= 3, h0);
        await page.mouse.up();
        const hUp = await frameNow(page);
        await frames(page, 3);
        const held = await loopSince(page, h0);
        const during = held.filter((r) => r.frame <= hUp && r.attack).length;
        // `hUp` is the last COMPLETED loop frame when the release had already been dispatched,
        // so frame hUp+1 is the first frame that samples after it. ⚠️ The first cut skipped
        // it (`> hUp + 1`, "the boundary frame") — and that is exactly the frame a stale latch
        // fires on: `--plant held-latch` stayed GREEN with "20:1" at hUp=19 in its own log.
        const firstAfter = held.find((r) => r.frame > hUp);
        row('F2', 'CONTROL: a press held >= 3 frames reaches the sim on >= 3 frames', during >= 3, { during, hUp, held: held.map((r) => `${r.frame}:${r.attack ? 1 : 0}`).join(' ') });
        row('F2', 'GUARD (plant held-latch): the frame after the release hands the sim NO attack', firstAfter && firstAfter.attack === false, firstAfter);
        row('F2', 'page errors (mouse)', errors.length === 0, errors);
      } catch (e) { row('F2', 'mouse section completed', false, String(e).split('\n')[0]); }
      await ctx.close();
    }
    {
      const { ctx, page, errors } = await open({ hasTouch: true });
      try {
        await boot(page, `screen=match&${DUEL}&fogRadius=900`);
        await hookState(page);
        await frames(page, 2);
        const before = await lastUsed0(page);
        const sub = await page.evaluate(SUBFRAME_TOUCH);
        await frames(page, 4);
        const after = await loopSince(page, sub.at);
        const atk = after.filter((r) => r.attack).length;
        const lu = await lastUsed0(page);
        row('F2', 'NON-VACUITY: the touch was sub-frame', sub.after === sub.at, sub);
        row('F2', 'BUG: a sub-frame TAP reaches the sim on EXACTLY one frame', atk === 1, { attackFrames: atk });
        row('F2', 'BUG: …and the local weapon really FIRED (lastUsed stamped)', before[0] === null && lu[0] !== null, { before, after: lu });
        row('F2', 'page errors (touch)', errors.length === 0, errors);
      } catch (e) { row('F2', 'touch section completed', false, String(e).split('\n')[0]); }
      await ctx.close();
    }
    {
      // A click during 3-2-1 must not fire at GO. `simSpeed=4` only shortens the countdown.
      const { ctx, page, errors } = await open();
      try {
        await boot(page, `screen=match&${DUEL}&pointerLock=0&simSpeed=4`, 'countdown');
        await hookState(page);
        const sub = await page.evaluate(SUBFRAME_MOUSE);
        const inCountdown = (await dbg(page)).phase === 'countdown';
        await wait(page, () => window.__matchDebug?.phase === 'playing');
        await frames(page, 3);
        const play = (await loopSince(page, sub.at)).filter((r) => r.phase === 'playing');
        const lu = await lastUsed0(page);
        row('F2', 'NON-VACUITY: the press landed during the countdown', inCountdown, sub);
        row('F2', 'GUARD (plant short-circuit): a countdown click does NOT fire at GO', play.length >= 3 && play.every((r) => !r.attack) && lu[0] === null,
          { playingFrames: play.length, attackFrames: play.filter((r) => r.attack).length, lastUsed: lu });
        row('F2', 'page errors (countdown)', errors.length === 0, errors);
      } catch (e) { row('F2', 'countdown section completed', false, String(e).split('\n')[0]); }
      await ctx.close();
    }
  }

  // ── §F3 FOCUS ─────────────────────────────────────────────────────────────────
  if (SECTIONS.includes('F3')) {
    for (const key of ['Space', 'Enter']) {
      const { ctx, page, errors } = await open();
      try {
        await boot(page, `screen=match&${DUEL}&pointerLock=0&fogRadius=900`);
        await page.evaluate(() => {
          window.__b2chip = 0;
          document.addEventListener('click', (e) => { if (e.target.closest?.('.match-chip')) window.__b2chip++; }, true);
        });
        const chip = await centre(page, '.match-chip');
        await page.mouse.click(chip.x, chip.y);
        await frames(page, 1);
        const opened = await sheetOpen(page);
        await page.keyboard.press('Escape');
        await frames(page, 1);
        const closed = !(await sheetOpen(page));
        const clicks0 = await page.evaluate(() => window.__b2chip);
        await page.keyboard.press(key);
        await frames(page, 2);
        const after = { clicks: await page.evaluate(() => window.__b2chip), open: await sheetOpen(page), paused: (await dbg(page)).paused,
          focus: await page.evaluate(() => document.activeElement?.className || document.activeElement?.tagName) };
        row('F3', `NON-VACUITY: a MOUSE click on the chip opened the sheet and Escape closed it (${key})`, opened && closed && clicks0 === 1, { opened, closed, clicks0 });
        row('F3', `BUG: ${key} after that does NOT re-press the chip (no pause)`, after.clicks === 1 && !after.open && !after.paused, after);
        row('F3', `page errors (${key})`, errors.length === 0, errors);
      } catch (e) { row('F3', `${key} section completed`, false, String(e).split('\n')[0]); }
      await ctx.close();
    }
    {
      // CONTROL: a KEYBOARD user who focuses the chip can still toggle pause with Enter.
      const { ctx, page, errors } = await open();
      try {
        await boot(page, `screen=match&${DUEL}&pointerLock=0&fogRadius=900`);
        await page.evaluate(() => document.querySelector('.match-chip').focus());
        await page.keyboard.press('Enter');
        await frames(page, 1);
        const open1 = await sheetOpen(page);
        await page.keyboard.press('Enter');
        await frames(page, 1);
        const open2 = await sheetOpen(page);
        row('F3', 'CONTROL: keyboard focus on the chip + Enter opens the sheet, Enter again closes it', open1 && !open2, { open1, open2 });
        // ...and once the match is running again, the keyboard is the GAME's: the chip a
        // keyboard player Tabbed to must not be re-pressed by the next (unbound) Space.
        await page.keyboard.press('Space');
        await frames(page, 2);
        const kSpace = { open: await sheetOpen(page), paused: (await dbg(page)).paused,
          focus: await page.evaluate(() => document.activeElement?.className || document.activeElement?.tagName) };
        row('F3', 'BUG: after a keyboard resume, Space does NOT re-press the chip', !kSpace.open && !kSpace.paused, kSpace);
        row('F3', 'page errors (keyboard)', errors.length === 0, errors);
      } catch (e) { row('F3', 'keyboard section completed', false, String(e).split('\n')[0]); }
      await ctx.close();
    }
    {
      // The result card's Play Again (hud.ts builds it; GameSession.restart answers it).
      const { ctx, page, errors } = await open();
      try {
        await boot(page, `screen=match&${DUEL}&pointerLock=0&fogRadius=900`);
        await endMatch(page);
        await page.evaluate(() => {
          window.__b2again = 0;
          document.addEventListener('click', (e) => { if (e.target.closest?.('[data-el="gameover-btn"]')) window.__b2again++; }, true);
        });
        await page.waitForTimeout(800); // the card's entry animation
        const btn = await centre(page, '[data-el="gameover-btn"]');
        await page.mouse.click(btn.x, btn.y);
        await frames(page, 2);
        const a0 = { clicks: await page.evaluate(() => window.__b2again), phase: (await dbg(page)).phase,
          focus: await page.evaluate(() => document.activeElement?.dataset?.el || document.activeElement?.tagName) };
        await page.keyboard.press('Space');
        await frames(page, 2);
        const a1 = { clicks: await page.evaluate(() => window.__b2again), phase: (await dbg(page)).phase };
        row('F3', 'NON-VACUITY: a MOUSE click on Play Again restarted the match', a0.clicks === 1 && a0.phase !== 'ended', a0);
        // ⚠️ NOT A BUG ON 8586f00, AND LABELLED SO: this arm was written expecting the result
        // card's button to keep focus the way the pause chip does, and it went GREEN on the
        // base — the card hides on restart and Chromium moves focus to BODY with it. Kept as a
        // GUARD for the F3 fix, which must not start handing that focus back.
        row('F3', 'GUARD (green on 8586f00 too): Space after Play Again does NOT press it a second time', a1.clicks === 1, { before: a0, after: a1 });
        row('F3', 'page errors (play again)', errors.length === 0, errors);
      } catch (e) { row('F3', 'play-again section completed', false, String(e).split('\n')[0]); }
      await ctx.close();
    }
    {
      // The capture bar's Fullscreen chip (pointerLock.ts), in its shipped default state.
      const { ctx, page, errors } = await open();
      try {
        await boot(page, `screen=match&${DUEL}&fogRadius=900`);
        await page.evaluate(() => {
          window.__b2fs = 0;
          document.addEventListener('click', (e) => { if (e.target.closest?.('[data-el="fs"]')) window.__b2fs++; }, true);
        });
        const fs = await centre(page, '[data-el="fs"]');
        const visible = !!fs && fs.w > 0;
        if (visible) await page.mouse.click(fs.x, fs.y);
        await page.waitForTimeout(400);
        const c0 = await page.evaluate(() => window.__b2fs);
        await page.keyboard.press('Space');
        await page.waitForTimeout(400);
        const c1 = await page.evaluate(() => window.__b2fs);
        row('F3', 'NON-VACUITY: the Fullscreen chip is on screen and a mouse click reached it', visible && c0 === 1, { fs, c0 });
        row('F3', 'BUG: Space after clicking Fullscreen does NOT re-press it', c1 === 1, { before: c0, after: c1 });
        row('F3', 'page errors (fullscreen chip)', errors.length === 0, errors);
      } catch (e) { row('F3', 'fullscreen section completed', false, String(e).split('\n')[0]); }
      await ctx.close();
    }
  }

  // ── §F4 AZERTY DIGITS ─────────────────────────────────────────────────────────
  if (SECTIONS.includes('F4')) {
    const { ctx, page, errors } = await open();
    try {
      await boot(page, `screen=match&${DUEL}&pointerLock=0&fogRadius=900`);
      const press = async (init) => {
        await page.evaluate((i) => {
          window.dispatchEvent(new KeyboardEvent('keydown', { ...i, bubbles: true, cancelable: true }));
          window.dispatchEvent(new KeyboardEvent('keyup', { ...i, bubbles: true, cancelable: true }));
        }, init);
        await frames(page, 1);
        return (await dbg(page)).selectedWeapon;
      };
      const qwerty = await press({ code: 'Digit3', key: '3' });
      row('F4', 'CONTROL: QWERTY "3" (code Digit3) selects slot 3', qwerty === 2, { selected: qwerty });
      const azerty = await press({ code: 'Digit2', key: 'é' });
      row('F4', 'BUG: AZERTY "é" on the number row (code Digit2) selects slot 2', azerty === 1, { selected: azerty });
      const azerty4 = await press({ code: 'Digit4', key: "'" });
      row('F4', 'BUG: AZERTY "\'" (code Digit4) selects slot 4', azerty4 === 3, { selected: azerty4 });
      const before = (await dbg(page)).selectedWeapon;
      const ctrl = await press({ code: 'Digit1', key: '&', ctrlKey: true });
      row('F4', 'GUARD: a modified digit (Ctrl+&) is a shortcut, not a weapon pick', ctrl === before, { before, selected: ctrl });
      row('F4', 'page errors', errors.length === 0, errors);
    } catch (e) { row('F4', 'section completed', false, String(e).split('\n')[0]); }
    await ctx.close();
  }

  // ── §F5 LETTERBOX ─────────────────────────────────────────────────────────────
  if (SECTIONS.includes('F5')) {
    const { ctx, page, errors } = await open({ viewport: { width: 600, height: 600 } });
    try {
      await boot(page, `screen=match&${DUEL}&pointerLock=0&fogRadius=900`);
      const g = await page.evaluate(() => {
        const c = document.querySelector('#game canvas'); const r = c.getBoundingClientRect();
        const x = r.left + r.width / 2;
        const barY = (r.bottom + window.innerHeight) / 2;
        const hit = document.elementFromPoint(x, barY);
        return { canvas: { top: r.top, bottom: r.bottom, h: r.height }, vh: window.innerHeight, x, barY,
          leftX: r.left + r.width * 0.12, midY: r.top + r.height / 2, hit: hit ? (hit.id || hit.tagName) : null, parent: c.parentElement?.id };
      });
      const barH = g.vh - g.canvas.bottom;
      row('F5', 'NON-VACUITY: the 600x600 window is letterboxed and the bar point hit-tests to the canvas host, not the canvas',
        barH >= 40 && g.hit === g.parent, g);
      // CONTROL first, and pointed somewhere the shipped spawn facing is NOT: a point in the
      // canvas's LEFT third turns the fighter left, which proves a canvas move aims at all.
      await page.mouse.move(g.leftX, g.midY);
      await frames(page, 2);
      const left = await dbg(page);
      row('F5', 'CONTROL: the cursor inside the canvas aims (left third of the frame -> facing left)', left.facingX < -0.5,
        { facing: [left.facingX, left.facingY] });
      await page.mouse.move(g.x, g.barY);
      await frames(page, 2);
      const bar = await dbg(page);
      row('F5', 'BUG: moving the cursor into the BAR below the frame turns the fighter toward it (facing down)', bar.facingY > 0.5,
        { left: [left.facingX, left.facingY], bar: [bar.facingX, bar.facingY] });
      const f0 = await frameNow(page);
      await page.mouse.down();
      await wait(page, (f) => window.__matchDebug.frames - f >= 3, f0);
      await page.mouse.up();
      const fired = (await loopSince(page, f0)).filter((r) => r.attack).length;
      row('F5', 'BUG: a press held in the BAR reaches the sim', fired >= 1, { attackFrames: fired });
      await shot(page, 'F5_letterbox');
      row('F5', 'page errors', errors.length === 0, errors);
    } catch (e) { row('F5', 'section completed', false, String(e).split('\n')[0]); }
    await ctx.close();
  }

  // ── §F6 CAPTURED PAUSE ────────────────────────────────────────────────────────
  if (SECTIONS.includes('F6')) {
    {
      const { ctx, page, errors } = await open();
      try {
        await boot(page, `screen=match&${DUEL}&pointerLock=sim&fogRadius=900`);
        await page.click('[data-el="capture"]');
        await frames(page, 1);
        const cap = await plock(page);
        await page.keyboard.press('Escape');
        await frames(page, 1);
        const lost = { ...(await plock(page)), paused: (await dbg(page)).paused };
        row('F6', 'NON-VACUITY: captured, then Escape drops to the paused scrim', cap.locked === true && lost.state === 'lost' && lost.paused === true, { cap, lost });
        const chip = await centre(page, '.match-chip');
        await page.mouse.click(chip.x, chip.y);
        await frames(page, 1);
        const after = { open: await sheetOpen(page), paused: (await dbg(page)).paused, locked: (await plock(page)).locked,
          scrim: await page.evaluate(() => { const s = document.querySelector('.plk-scrim'); return s ? getComputedStyle(s).display : null; }) };
        await shot(page, 'F6_chip_on_scrim');
        row('F6', 'BUG: the chip labelled Pause OPENS THE PAUSE SHEET (paused, mouse not re-captured)', after.open && after.paused && after.locked === false, after);
        row('F6', 'the scrim is not drawn under the open sheet (one PAUSED card, not two)', after.open && after.scrim === 'none', after);
        if (after.open) {
          // By coordinates, like a player: the primary button idles in a CSS animation, so
          // Playwright's "stable" actionability check never passes on it (`page.click` timed
          // out at 30 s on a correct tree — "element is not stable").
          const res0 = await centre(page, '.match-sheet [data-el="resume"]');
          await page.mouse.click(res0.x, res0.y);
          await frames(page, 2);
          const res = { open: await sheetOpen(page), paused: (await dbg(page)).paused, ...(await plock(page)) };
          row('F6', "the sheet's Resume re-captures the mouse and runs the match", !res.open && !res.paused && res.locked === true && res.state !== 'lost', res);
        } else row('F6', "the sheet's Resume re-captures the mouse and runs the match", false, 'sheet never opened');
        row('F6', 'page errors (chip)', errors.length === 0, errors);
      } catch (e) { row('F6', 'chip section completed', false, String(e).split('\n')[0]); }
      await ctx.close();
    }
    {
      const { ctx, page, errors } = await open();
      try {
        await boot(page, `screen=match&${DUEL}&pointerLock=sim&fogRadius=900`);
        await page.click('[data-el="capture"]');
        await frames(page, 1);
        await page.keyboard.press('Escape');
        await frames(page, 1);
        const lost = await plock(page);
        await page.keyboard.press('Escape');
        await frames(page, 1);
        const after = { open: await sheetOpen(page), paused: (await dbg(page)).paused, locked: (await plock(page)).locked };
        row('F6', 'NON-VACUITY: Escape released the capture to the scrim', lost.state === 'lost', lost);
        row('F6', 'BUG: Escape ON the scrim opens the pause sheet (no re-capture without a click)', after.open && after.paused && after.locked === false, after);
        row('F6', 'page errors (Esc)', errors.length === 0, errors);
      } catch (e) { row('F6', 'Esc section completed', false, String(e).split('\n')[0]); }
      await ctx.close();
    }
  }

  // ── §F7 PHONE: FIRST TOUCH ON A WEAPON SLOT ───────────────────────────────────
  if (SECTIONS.includes('F7')) {
    for (const target of ['slot', 'canvas']) {
      const { ctx, page, errors } = await open({ viewport: { width: 844, height: 390 }, isMobile: true, hasTouch: true });
      try {
        await boot(page, `screen=match&${DUEL}&fogRadius=900`);
        const cdp = await ctx.newCDPSession(page);
        const pt = target === 'slot'
          ? await page.evaluate(() => { const s = document.querySelectorAll('.hud-weapon-slot')[1]; const r = s.getBoundingClientRect(); return { x: r.left + r.width / 2, y: r.top + r.height / 2 }; })
          : { x: 844 * 0.62, y: 390 * 0.4 };
        const sel0 = (await dbg(page)).selectedWeapon;
        const f0 = await frameNow(page);
        await cdp.send('Input.dispatchTouchEvent', { type: 'touchStart', touchPoints: [{ x: pt.x, y: pt.y, id: 1 }] });
        await wait(page, (f) => window.__matchDebug.frames - f >= 3, f0);
        await cdp.send('Input.dispatchTouchEvent', { type: 'touchEnd', touchPoints: [] });
        await frames(page, 2);
        const rec = await loopSince(page, f0);
        const atk = rec.filter((r) => r.attack).length;
        const sel = (await dbg(page)).selectedWeapon;
        if (target === 'slot') {
          await shot(page, 'F7_first_touch_slot');
          row('F7', 'BUG: the FIRST touch of the match on weapon slot 2 SELECTS it', sel0 === 0 && sel === 1, { sel0, sel });
          row('F7', 'BUG: …and fires nothing', atk === 0, { attackFrames: atk, frames: rec.length });
        } else {
          row('F7', 'CONTROL: a first touch on open ground in the aim half fires', atk >= 1 && sel === sel0, { attackFrames: atk, sel });
        }
        row('F7', `page errors (${target})`, errors.length === 0, errors);
      } catch (e) { row('F7', `${target} section completed`, false, String(e).split('\n')[0]); }
      await ctx.close();
    }
  }

  // ── §F8 RESERVED KEYS ─────────────────────────────────────────────────────────
  if (SECTIONS.includes('F8')) {
    {
      const { ctx, page, errors } = await open();
      try {
        await page.goto(`${BASE}/`, { waitUntil: 'domcontentloaded' });
        await page.evaluate((k) => localStorage.setItem(k, JSON.stringify({ reduceMotion: false, moveKeys: { up: 'KeyQ', left: 'Space', down: 'KeyJ' } })), SETTINGS_KEY);
        await boot(page, `${DUEL}&pointerLock=0&fogRadius=900`);
        const hold = async (code) => {
          await page.keyboard.down(code);
          const f0 = await frameNow(page);
          await wait(page, (f) => window.__matchDebug.frames - f >= 3, f0);
          const rec = await loopSince(page, f0);
          await page.keyboard.up(code);
          await frames(page, 2);
          return { moved: rec.some((r) => r.mx !== 0 || r.my !== 0), mx: rec.at(-1)?.mx, my: rec.at(-1)?.my };
        };
        const j = await hold('KeyJ');
        row('F8', 'CONTROL: a stored binding on a FREE key (down = J) is honoured', j.moved && j.my === 1, j);
        const q = await hold('KeyQ');
        row('F8', 'BUG: a stored "up = Q" is DROPPED — Q is item 1, it does not also move', !q.moved, q);
        const sp = await hold('Space');
        row('F8', 'BUG: a stored "left = Space" is DROPPED', !sp.moved, sp);
        row('F8', 'page errors (storage)', errors.length === 0, errors);
      } catch (e) { row('F8', 'storage section completed', false, String(e).split('\n')[0]); }
      await ctx.close();
    }
    {
      const { ctx, page, errors } = await open({ viewport: { width: 900, height: 700 } });
      try {
        await page.goto(`${BASE}/?screen=settings`, { waitUntil: 'domcontentloaded' });
        await wait(page, () => !!document.querySelector('[data-el="bind-up"]'));
        const tryBind = async (dir, code) => {
          await page.click(`[data-el="bind-${dir}"]`);
          await page.keyboard.press(code);
          await page.waitForTimeout(200);
          return page.evaluate((d) => ({ cap: document.querySelector(`[data-el="bind-${d}"]`).textContent, note: document.querySelector('[data-el="bindnote"]').textContent }), dir);
        };
        const ok = await tryBind('down', 'KeyJ');
        row('F8', 'CONTROL: the screen accepts a free key (down = J)', ok.cap === 'J', ok);
        // A refusal keeps the capture ARMED for another key (the cap reads "…"), so "refused"
        // is: the cap never became the new key, the note says why, and nothing was stored.
        // ⚠️ The first cut asserted the cap was back to "W" and went red on a correct refusal.
        const e = await tryBind('up', 'KeyE');
        const sp = await tryBind('left', 'Space');
        const stored = await page.evaluate((k) => JSON.parse(localStorage.getItem(k) ?? '{}').moveKeys ?? {}, SETTINGS_KEY);
        row('F8', 'BUG: binding "up" to E is REFUSED, with the reason', e.cap !== 'E' && /already/.test(e.note) && /item/i.test(e.note) && !stored.up, { ...e, stored });
        row('F8', 'BUG: binding "left" to Space is REFUSED', sp.cap !== 'Space' && /already/.test(sp.note) && !stored.left, { ...sp, stored });
        const rowsTxt = await page.evaluate(() => [...document.querySelectorAll('[data-el="keys"] .set-key-row')].map((r) => ({
          action: r.querySelector('.set-key-action')?.textContent ?? '', caps: [...r.querySelectorAll('kbd')].map((k) => k.textContent) })));
        const item = rowsTxt.find((r) => /item/i.test(r.action));
        row('F8', 'BUG: the Controls list names the item keys Q and E', !!item && item.caps.join(' ') === 'Q E', { item, rows: rowsTxt.map((r) => r.action) });
        await shot(page, 'F8_settings');
        row('F8', 'page errors (settings)', errors.length === 0, errors);
      } catch (e) { row('F8', 'settings section completed', false, String(e).split('\n')[0]); }
      await ctx.close();
    }
  }

  // ── §PL POINTER LOCK AFTER THE WHISTLE ────────────────────────────────────────
  if (SECTIONS.includes('PL')) {
    {
      const { ctx, page, errors } = await open();
      try {
        await boot(page, `screen=match&${DUEL}&pointerLock=sim&fogRadius=900`);
        await page.click('[data-el="capture"]');
        await frames(page, 1);
        const cap = await plock(page);
        await endMatch(page);
        const ended = await plock(page);
        row('PL', 'NON-VACUITY: captured, then the whistle released the mouse', cap.locked === true && ended.locked === false && ended.state === 'hidden', { cap, ended });
        await page.evaluate(() => window.dispatchEvent(new Event('blur')));
        await frames(page, 1);
        const blur = { ...(await plock(page)), paused: (await dbg(page)).paused };
        row('PL', 'BUG: a window blur on the result card raises NO scrim and pauses nothing', blur.state !== 'lost' && blur.paused === false, blur);
        // A point on open frame, never on a control: the card's own buttons are centred, and
        // Play Again would restart (and re-capture, correctly) — a false red for this row.
        const pt = await page.evaluate(() => {
          for (const [fx, fy] of [[0.93, 0.55], [0.93, 0.3], [0.07, 0.3], [0.5, 0.08]]) {
            const x = innerWidth * fx, y = innerHeight * fy;
            const e = document.elementFromPoint(x, y);
            if (e && !e.closest('button, a, [role="button"], .hud-gameover-card, .match-corner')) return { x, y, el: e.className || e.tagName };
          }
          return null;
        });
        if (pt) await page.mouse.click(pt.x, pt.y);
        await frames(page, 1);
        const click = { ...(await plock(page)), pt };
        await shot(page, 'PL_after_blur_click');
        row('PL', 'BUG: nothing on the result card re-captures the mouse', !!pt && click.locked === false, click);
        row('PL', 'page errors (blur)', errors.length === 0, errors);
      } catch (e) { row('PL', 'blur section completed', false, String(e).split('\n')[0]); }
      await ctx.close();
    }
    {
      const { ctx, page, errors } = await open();
      try {
        await boot(page, `screen=match&${DUEL}&pointerLock=sim&fogRadius=900`);
        await page.click('[data-el="capture"]');
        await frames(page, 1);
        await endMatch(page);
        await page.click('[data-el="gameover-btn"]');
        await frames(page, 2);
        const again = { ...(await plock(page)), phase: (await dbg(page)).phase };
        row('PL', 'CONTROL: Play Again re-captures the mouse (a restart is a new match)', again.locked === true && again.phase !== 'ended', again);
        row('PL', 'page errors (again)', errors.length === 0, errors);
      } catch (e) { row('PL', 'again section completed', false, String(e).split('\n')[0]); }
      await ctx.close();
    }
  }

  // ── §BC THE BLUE CHEESE TICK IS QUIET ─────────────────────────────────────────
  // B3 (merged on main after this package's base) built the Blue Cheese aura: once a second,
  // each victim inside the wearer's radius takes a `hit-landed` whose source is
  // `combat.ts:itemDamageSource` — `kind: 'weapon'` with `itemId: 'blue_cheese'`. That shape
  // exists on 8586f00, so the feel path can be driven with it through `__feelEvent`
  // (= `GameSession.handleEvents`), synchronously, and read off `__feelDebug.responses`.
  // The victim is the LOCAL seat, which is always on screen, so the hit-stop / kick gates
  // ("can any screen see it", proximity) cannot be what silences a row.
  if (SECTIONS.includes('BC')) {
    const { ctx, page, errors } = await open();
    try {
      await boot(page, `screen=match&${DUEL}&pointerLock=0&fogRadius=900`);
      await frames(page, 2);
      const feed = (source, amount) => page.evaluate(({ source, amount }) => {
        const before = { ...window.__feelDebug.responses };
        const me = window.__vfxDebugFighters.player;
        window.__feelEvent({ type: 'hit-landed', targetRole: 'player', targetId: 0, amount, effect: null, x: me.x, y: me.y, source });
        const after = { ...window.__feelDebug.responses };
        const d = {};
        for (const k of Object.keys(after)) d[k] = after[k] - before[k];
        return d;
      }, { source, amount });
      const ctl = await feed({ kind: 'weapon', weaponKey: 'Ring', weaponName: 'Ring Spin', attackerId: 1 }, 9);
      row('BC', 'CONTROL: a donut Ring Spin hit on the local seat bursts, kicks and freezes', ctl.vfx >= 1 && ctl.shake >= 1 && ctl.hitStop >= 1, ctl);
      const tick = await feed({ kind: 'weapon', weaponKey: 'blue_cheese', weaponName: 'Blue Cheese', attackerId: 1, itemId: 'blue_cheese' }, 2);
      row('BC', 'BUG: a Blue Cheese tick fires NO hit-stop, NO camera kick, NO burst and NO knockback',
        tick.hitStop === 0 && tick.shake === 0 && tick.vfx === 0 && tick.knockback === 0, tick);
      row('BC', '…and at most one (small) damage number', tick.damageNumber <= 1, tick);
      row('BC', 'page errors', errors.length === 0, errors);
    } catch (e) { row('BC', 'section completed', false, String(e).split('\n')[0]); }
    await ctx.close();
  }

  // ── §M9 LOADOUT GATE ──────────────────────────────────────────────────────────
  if (SECTIONS.includes('M9')) {
    for (const [items, want] of [['springform,warm_milk', 'springform,warm_milk'], ['constructor,springform', 'springform']]) {
      const { ctx, page, errors } = await open();
      try {
        await boot(page, `screen=match&${DUEL}&pointerLock=0&fogRadius=900&items=${items}`);
        await hookState(page);
        const eq = await page.evaluate(() => window.__b2State.fighters[0].item?.equipped ?? null);
        const ok = Array.isArray(eq) && eq.join(',') === want;
        row('M9', `${want === items ? 'CONTROL' : 'BUG'}: ?items=${items} equips [${want}]`, ok, { equipped: eq });
        row('M9', `page errors (${items})`, errors.length === 0, errors);
      } catch (e) { row('M9', `${items} section completed`, false, String(e).split('\n')[0]); }
      await ctx.close();
    }
  }
} finally {
  await browser.close();
}

if (PLANT) row('-', `plant ${PLANT} applied to the served match.ts`, plantHits > 0, { plantHits });
const failed = rows.filter((r) => !r.pass);
console.log(`\n${rows.length - failed.length}/${rows.length} rows passed${PLANT ? ` (plant ${PLANT})` : ''}`);
process.exit(failed.length ? 1 : 0);
