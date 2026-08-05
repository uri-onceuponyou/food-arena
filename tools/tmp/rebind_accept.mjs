#!/usr/bin/env node
/**
 * Acceptance test for KEY REBINDING — the settings row, and the sim on the other end.
 *
 * ── Why this is a separate file from `input_accept.mjs` ─────────────────────
 * `input_accept` proves the SHIPPED bindings reach the simulation, with 85 real CDP key
 * events asserted against sim state. It is a peer's gate and is not edited here. This
 * asserts the thing that did not exist until now: that a key the PLAYER chose on the
 * settings screen reaches the same place, that the one they replaced stops working, and
 * that neither of those facts is a repaint of the settings screen talking about itself.
 *
 * ── The rule every assertion here is built to ───────────────────────────────
 * **Read the answer off the SIM, never off the screen that drew it.** `docs/LESSONS.md`
 * §13: an instrument that reports the UI's own belief is not measuring the game. So the
 * settings caps are checked (they are the promise), and then the promise is cashed at
 * `window.__matchDebug.moveX/moveY` and at the fighter's own position, through real
 * `keyboard.down` events dispatched by the browser.
 *
 * ── What it covers ──────────────────────────────────────────────────────────
 *  1. THE CONTROL EXISTS AND IS HITTABLE. Four 44px buttons, and at 390x844 portrait
 *     each one's own centre point hit-tests back to itself — the failure mode a peer
 *     just measured on the match screen, where 83.3% of the thumb band belonged to
 *     something else.
 *  2. ARMING AND CAPTURE. Tap, press, and the cap is the new key.
 *  3. REFUSAL, WITH A REASON. A key that already mutes / picks a weapon / moves another
 *     direction is refused and says which. Refusal must be visible, because a silent
 *     one is indistinguishable from a broken control.
 *  4. THE SIM. The new key moves the fighter; the old key does NOT; the arrow key that
 *     was never rebindable still does. That third one is the safety property the whole
 *     design rests on — no reachable state can leave a player unable to move.
 *  5. PERSISTENCE ACROSS A RELOAD, into a match reached by the DIRECT route that never
 *     opens a menu. `shell.ts` calls `applyStoredSettings()` before the first screen
 *     mounts, and this is the assertion that says so.
 *  6. RESET. Back to the shipped keys, in the storage blob and in the sim.
 *  7. A CORRUPT BLOB CANNOT BRICK MOVEMENT. Storage is written by hand with a reserved
 *     key, a duplicate and a non-string, and WASD must still work.
 *
 * ── Usage ───────────────────────────────────────────────────────────────────
 *   node tools/tmp/with_snapshot.mjs -- node tools/tmp/rebind_accept.mjs
 *   PREVIEW_BASE=<snapshot-url> node tools/tmp/rebind_accept.mjs
 *
 * Measure on a frozen snapshot, never the shared dev server (`docs/LESSONS.md` §5).
 */

import { chromium } from 'playwright';

const BASE = process.env.PREVIEW_BASE ?? 'http://localhost:5173';
const QUIET = process.argv.includes('--quiet');
const LAUNCH = ['--use-gl=angle', '--use-angle=swiftshader', '--enable-unsafe-swiftshader',
  '--enable-webgl', '--ignore-gpu-blocklist', '--disable-gpu-sandbox'];

const SETTINGS_KEY = 'food-arena.settings.v1';

/** The key rebound to throughout. Chosen because nothing in the product listens for it:
 *  not `MOVE_KEYS`, not `MUTE_KEY` (KeyM), not `PAUSE_KEY` (Escape), not a weapon digit. */
const NEW_UP = 'KeyI';

/** Same floor `input_accept` uses: far below one held second and far above float noise. */
const MOVED_WU = 8;
/** Held for GAME FRAMES, not milliseconds — a slow harness fabricates false negatives. */
const HOLD_FRAMES = 12;

const results = [];
let failures = 0;
function record(group, check, ok, detail = '') {
  results.push({ group, check, ok, detail });
  if (!ok) failures++;
}

const dbg = (p) => p.evaluate(() => window.__matchDebug ?? null);
const fighters = (p) => p.evaluate(() => window.__vfxDebugFighters ?? null);

async function pollDbg(page, want, timeoutMs = 4000) {
  const deadline = Date.now() + timeoutMs;
  let last = await dbg(page);
  while (Date.now() < deadline) {
    if (last && want(last)) return last;
    await page.waitForTimeout(60);
    last = await dbg(page);
  }
  return last;
}

/**
 * Hold one key for `HOLD_FRAMES` game frames and report what reached the sim AND how far
 * the fighter travelled.
 *
 * Deliberately a small local implementation rather than a lift of `input_accept`'s: the
 * scripted-driver audit (`docs/LESSONS.md` §5) found ten tools carrying a copied driver
 * with a copied bug, and the lesson recorded there is that a copy is a liability. This
 * one has no policy in it at all — it presses a key and reads two numbers.
 */
async function holdKey(page, code) {
  await pollDbg(page, (d) => d.moveX === 0 && d.moveY === 0, 3000);
  const before = (await fighters(page)).player;
  const idle = await dbg(page);
  await page.keyboard.down(code);
  const during = await pollDbg(page, (d) => d.moveX !== 0 || d.moveY !== 0, 3000);
  await pollDbg(page, (d) => d.frames >= idle.frames + HOLD_FRAMES, 20000);
  await page.keyboard.up(code);
  await page.waitForTimeout(150);
  const after = (await fighters(page)).player;
  return { moveX: during.moveX, moveY: during.moveY, dx: after.x - before.x, dy: after.y - before.y };
}

/** A key that should do NOTHING. Asserted by waiting for the loop to advance and finding
 *  `move` still at rest — the opposite predicate to `holdKey`, so it cannot pass by the
 *  harness simply being slow. */
async function holdDeadKey(page, code) {
  await pollDbg(page, (d) => d.moveX === 0 && d.moveY === 0, 3000);
  const before = (await fighters(page)).player;
  const idle = await dbg(page);
  await page.keyboard.down(code);
  let sawMotion = false;
  const deadline = Date.now() + 20000;
  let last = idle;
  while (Date.now() < deadline) {
    last = await dbg(page);
    if (last.moveX !== 0 || last.moveY !== 0) { sawMotion = true; break; }
    if (last.frames >= idle.frames + HOLD_FRAMES) break;
    await page.waitForTimeout(60);
  }
  await page.keyboard.up(code);
  await page.waitForTimeout(150);
  const after = (await fighters(page)).player;
  return {
    sawMotion,
    frames: last.frames - idle.frames,
    moved: Math.hypot(after.x - before.x, after.y - before.y),
  };
}

async function openSettings(page, viewport) {
  if (viewport) await page.setViewportSize(viewport);
  await page.goto(`${BASE}/?screen=settings`, { waitUntil: 'networkidle', timeout: 60000 });
  await page.waitForFunction('window.__screen === "settings"', null, { timeout: 60000 });
  // Not `__screenReady`: measured opacity is 0.000 when that flag flips, and this suite
  // CLICKS — `menu_accept`'s round-trip flow once died on a 30 s timeout for exactly that
  // reason, on a screen still at translateY(10px) and moving. Waiting for the cluster to
  // be stable in the same place for two frames is the cheap local version of `settle.mjs`.
  await page.waitForSelector('[data-el="bind-up"]', { timeout: 30000 });
  await page.waitForFunction(() => {
    const el = document.querySelector('[data-el="bind-up"]');
    if (!el) return false;
    const a = el.getBoundingClientRect().top;
    return new Promise((res) => requestAnimationFrame(() => requestAnimationFrame(() => {
      res(Math.abs(el.getBoundingClientRect().top - a) < 0.01
        && getComputedStyle(el.closest('.fa-screen')).opacity === '1');
    })));
  }, null, { timeout: 30000 });
}

const capOf = (page, dir) =>
  page.evaluate((d) => document.querySelector(`[data-el="bind-${d}"]`)?.textContent.trim(), dir);
const noteOf = (page) =>
  page.evaluate(() => document.querySelector('[data-el="bindnote"]')?.textContent.trim() ?? '');
const storedBindings = (page, key) =>
  page.evaluate((k) => {
    try { return JSON.parse(localStorage.getItem(k) ?? '{}').moveKeys ?? null; } catch { return null; }
  }, key);

async function enterMatch(page) {
  await page.goto(`${BASE}/?player=hamburger&enemy=donut`, { waitUntil: 'networkidle', timeout: 90000 });
  await page.waitForFunction('window.__gameReady === true', null, { timeout: 120000 });
  await page.waitForFunction(() => window.__matchDebug?.phase === 'playing', null, { timeout: 120000 });
  await page.waitForTimeout(250);
}

const browser = await chromium.launch({ args: LAUNCH });
const page = await browser.newPage({ viewport: { width: 1000, height: 620 }, deviceScaleFactor: 1 });
const errs = [];
page.on('pageerror', (e) => errs.push(String(e).slice(0, 160)));

try {
  // ── 1. The control exists, is hittable, and starts on the shipped keys ─────
  await openSettings(page);
  await page.evaluate((k) => localStorage.removeItem(k), SETTINGS_KEY);
  await openSettings(page);

  const caps0 = {};
  for (const d of ['up', 'left', 'down', 'right']) caps0[d] = await capOf(page, d);
  record('ui', 'defaults-are-the-shipped-keys',
    caps0.up === 'W' && caps0.left === 'A' && caps0.down === 'S' && caps0.right === 'D',
    JSON.stringify(caps0));

  const geom = await page.evaluate(() => ['up', 'left', 'down', 'right'].map((d) => {
    const el = document.querySelector(`[data-el="bind-${d}"]`);
    const r = el.getBoundingClientRect();
    const hit = document.elementFromPoint(r.left + r.width / 2, r.top + r.height / 2);
    return { d, w: Math.round(r.width), h: Math.round(r.height), own: hit === el || el.contains(hit) };
  }));
  record('ui', 'tap-targets>=44', geom.every((g) => g.w >= 44 && g.h >= 44),
    geom.map((g) => `${g.d} ${g.w}x${g.h}`).join(' '));
  record('ui', 'reset-control-is-hidden-while-nothing-to-reset',
    await page.evaluate(() => document.querySelector('[data-el="bindreset"]').hidden === true));

  // The same geometry at a portrait phone, where the peer's touch pass measured 83.3% of
  // the thumb band hit-testing to something other than the thing drawn on it.
  await openSettings(page, { width: 390, height: 844 });
  const portraitGeom = await page.evaluate(() => ['up', 'left', 'down', 'right'].map((d) => {
    const el = document.querySelector(`[data-el="bind-${d}"]`);
    el.scrollIntoView({ block: 'center' });
    const r = el.getBoundingClientRect();
    const hit = document.elementFromPoint(r.left + r.width / 2, r.top + r.height / 2);
    return { d, w: Math.round(r.width), h: Math.round(r.height), own: hit === el || el.contains(hit) };
  }));
  record('portrait', 'tap-targets>=44', portraitGeom.every((g) => g.w >= 44 && g.h >= 44),
    portraitGeom.map((g) => `${g.d} ${g.w}x${g.h}`).join(' '));
  record('portrait', 'each-key-hit-tests-to-itself', portraitGeom.every((g) => g.own),
    portraitGeom.map((g) => `${g.d}:${g.own}`).join(' '));
  await page.setViewportSize({ width: 1000, height: 620 });

  // ── 2. Arm and capture ────────────────────────────────────────────────────
  await openSettings(page);
  await page.click('[data-el="bind-up"]');
  record('capture', 'tapping-a-key-arms-it',
    await page.evaluate(() => document.querySelector('[data-el="bind-up"]').classList.contains('is-listening')));
  await page.keyboard.press(NEW_UP);
  await page.waitForTimeout(120);
  record('capture', 'the-cap-becomes-the-new-key', (await capOf(page, 'up')) === 'I', await capOf(page, 'up'));
  record('capture', 'it-disarms-itself',
    await page.evaluate(() => !document.querySelector('[data-el="bind-up"]').classList.contains('is-listening')));
  record('capture', 'it-is-persisted', (await storedBindings(page, SETTINGS_KEY))?.up === NEW_UP,
    JSON.stringify(await storedBindings(page, SETTINGS_KEY)));
  record('capture', 'the-reset-control-appears',
    await page.evaluate(() => document.querySelector('[data-el="bindreset"]').hidden === false));

  // ── 3. Refusal, with the reason said out loud ─────────────────────────────
  //
  // ⚠️ INSTRUMENT NOTE, and it cost four false FAILs on this suite's first run. A
  // refusal deliberately KEEPS LISTENING, so the cap reads '…' rather than the key it
  // is still on, and asserting the cap is asserting the arming animation. The thing
  // that must not have changed is the BINDING, so that is what is read — off storage,
  // which is also what the game reloads from. `docs/LESSONS.md` §13: validate the
  // instrument against a known input before believing it on an unknown one.
  const leftUnbound = async () => ((await storedBindings(page, SETTINGS_KEY)) ?? {}).left === undefined;

  await page.click('[data-el="bind-left"]');
  await page.keyboard.press('KeyM');
  await page.waitForTimeout(120);
  record('refuse', 'the-mute-key-is-not-bound', await leftUnbound(),
    JSON.stringify(await storedBindings(page, SETTINGS_KEY)));
  record('refuse', 'and-says-why', /mute/i.test(await noteOf(page)), await noteOf(page));
  record('refuse', 'a-refusal-keeps-listening',
    await page.evaluate(() => document.querySelector('[data-el="bind-left"]').classList.contains('is-listening')));

  await page.keyboard.press('Digit1');
  await page.waitForTimeout(120);
  record('refuse', 'a-weapon-digit-is-not-bound', await leftUnbound(), await noteOf(page));
  record('refuse', 'and-says-why-weapon', /weapon/i.test(await noteOf(page)), await noteOf(page));

  await page.keyboard.press(NEW_UP);
  await page.waitForTimeout(120);
  record('refuse', 'a-key-another-direction-owns-is-not-bound', await leftUnbound(),
    JSON.stringify(await storedBindings(page, SETTINGS_KEY)));
  record('refuse', 'and-names-that-direction', /move up/i.test(await noteOf(page)), await noteOf(page));

  await page.keyboard.press('ArrowRight');
  await page.waitForTimeout(120);
  record('refuse', 'a-fixed-arrow-is-not-bound', await leftUnbound(), await noteOf(page));
  record('refuse', 'and-names-the-arrow-owner', /move right/i.test(await noteOf(page)), await noteOf(page));

  await page.keyboard.press('Escape');
  await page.waitForTimeout(120);
  record('refuse', 'escape-cancels', (await capOf(page, 'left')) === 'A'
    && await page.evaluate(() => !document.querySelector('[data-el="bind-left"]').classList.contains('is-listening')),
  await noteOf(page));
  record('refuse', 'escape-was-not-bound', (await storedBindings(page, SETTINGS_KEY))?.left === undefined,
    JSON.stringify(await storedBindings(page, SETTINGS_KEY)));

  // ── 4. THE SIM. The whole point of the feature. ───────────────────────────
  await enterMatch(page);
  const newKey = await holdKey(page, NEW_UP);
  record('sim', 'the-new-key-reaches-the-sim', newKey.moveX === 0 && newKey.moveY === -1,
    `MatchInput.move = (${newKey.moveX}, ${newKey.moveY}), want (0, -1)`);
  record('sim', 'the-new-key-moves-the-fighter', newKey.dy <= -MOVED_WU, `dy = ${newKey.dy.toFixed(1)} wu`);

  const oldKey = await holdDeadKey(page, 'KeyW');
  record('sim', 'the-replaced-key-does-nothing', !oldKey.sawMotion && oldKey.moved < 1,
    `after ${oldKey.frames} frames: motion=${oldKey.sawMotion} drift=${oldKey.moved.toFixed(2)} wu`);

  const arrow = await holdKey(page, 'ArrowUp');
  record('sim', 'the-fixed-arrow-still-works', arrow.moveY === -1 && arrow.dy <= -MOVED_WU,
    `move=(${arrow.moveX}, ${arrow.moveY}) dy=${arrow.dy.toFixed(1)} wu`);

  // ── 5. Persistence, through a reload, on the route that never opens a menu ─
  await enterMatch(page);
  const afterReload = await holdKey(page, NEW_UP);
  record('persist', 'a-rebind-survives-a-reload', afterReload.moveY === -1 && afterReload.dy <= -MOVED_WU,
    `move=(${afterReload.moveX}, ${afterReload.moveY}) dy=${afterReload.dy.toFixed(1)} wu`);

  // ── 6. Reset ──────────────────────────────────────────────────────────────
  await openSettings(page);
  record('reset', 'the-rebind-is-still-shown-after-a-reload', (await capOf(page, 'up')) === 'I',
    await capOf(page, 'up'));
  await page.click('[data-el="bindreset"]');
  await page.waitForTimeout(120);
  record('reset', 'the-caps-go-back', (await capOf(page, 'up')) === 'W', await capOf(page, 'up'));
  record('reset', 'storage-goes-back',
    Object.keys((await storedBindings(page, SETTINGS_KEY)) ?? {}).length === 0,
    JSON.stringify(await storedBindings(page, SETTINGS_KEY)));
  record('reset', 'the-control-hides-itself-again',
    await page.evaluate(() => document.querySelector('[data-el="bindreset"]').hidden === true));

  await enterMatch(page);
  const restored = await holdKey(page, 'KeyW');
  record('reset', 'the-shipped-key-works-again', restored.moveY === -1 && restored.dy <= -MOVED_WU,
    `move=(${restored.moveX}, ${restored.moveY}) dy=${restored.dy.toFixed(1)} wu`);

  // ── 7. A hostile blob cannot brick movement ───────────────────────────────
  // Every one of these is a value the UI can never produce, which is the point: storage
  // is user input (`profile.ts` says so about the name field for the same reason) and it
  // is read straight into the table the game matches key events against.
  await page.evaluate((k) => localStorage.setItem(k, JSON.stringify({
    reduceMotion: false,
    moveKeys: { up: 'KeyM', left: 'KeyQ', down: 'KeyQ', right: 42 },
  })), SETTINGS_KEY);
  await enterMatch(page);
  const hostile = await holdKey(page, 'KeyW');
  record('hostile', 'a-reserved-key-in-storage-is-dropped', hostile.moveY === -1,
    `KeyW after a blob claiming up=KeyM -> move=(${hostile.moveX}, ${hostile.moveY})`);
  const dup = await holdKey(page, 'KeyQ');
  record('hostile', 'a-duplicate-binds-once', dup.moveX === -1 && dup.moveY === 0,
    `KeyQ claimed by BOTH left and down -> move=(${dup.moveX}, ${dup.moveY}), want (-1, 0)`);
  const bad = await holdKey(page, 'KeyD');
  record('hostile', 'a-non-string-is-dropped', bad.moveX === 1 && bad.moveY === 0,
    `KeyD after a blob claiming right=42 -> move=(${bad.moveX}, ${bad.moveY})`);
  await page.evaluate((k) => localStorage.removeItem(k), SETTINGS_KEY);

  record('-', 'no-page-errors', errs.length === 0, errs.slice(0, 3).join(' | '));
} catch (err) {
  record('-', 'suite-completed', false, String(err).split('\n')[0]);
} finally {
  await browser.close();
}

let group = '';
for (const r of results) {
  if (r.group !== group) { group = r.group; if (!QUIET) console.log(`\n── ${group} ──`); }
  if (!QUIET || !r.ok) {
    console.log(`${r.ok ? 'PASS' : 'FAIL'}  ${r.check.padEnd(46)} ${r.detail}`);
  }
}
console.log(`\n${results.length - failures}/${results.length} checks passed`);
process.exit(failures ? 1 : 0);
