#!/usr/bin/env node
/**
 * BH_INPUT_PROBE — the INPUT & CONTROLS bug hunt (review phase, 2026-10-15, HEAD 1090046).
 *
 * One browser, five sessions, every arm paired with a CONTROL that must come out the other
 * way — so a red row means "the game did not do it" and never "the probe could not see it".
 *
 * ── THE ONE INSTRUMENT EVERY ARM SHARES ─────────────────────────────────────
 * An init script wraps `requestAnimationFrame`. After every callback it reads
 * `window.__matchDebug` (published by `match.ts:publishDebug` AFTER `stepMatch`, once per
 * loop frame, paused frames included) and, on each NEW loop frame, records:
 *   attack      what the sim was HANDED as `MatchInput.attack` that frame
 *   facing      what `applyAim` committed (`fighter.facing`, read after the step)
 *   move        `MatchInput.move`
 *   cooling     whether the SELECTED weapon slot's HUD timer is counting — `hud.ts` derives
 *               it from `fighter.lastUsed`, which only `combat.ts:attemptAttack` writes, so
 *               it is the observable a player has for "my weapon fired".
 * Nothing here is an instrumentation field this probe added to the game.
 *
 * ── SESSIONS ────────────────────────────────────────────────────────────────
 *   1  desktop 1280x800, 1v1, items        A hold-click (control) · B sub-frame click,
 *                                          synthetic · C sub-frame click, real CDP ·
 *                                          D item key Q · E AZERTY digit / AZERTY "Q" ·
 *                                          F pause chip (control) then Esc then Space
 *   2  desktop 1000x1000 (letterboxed), 6  G hold-click in the letterbox vs in the canvas ·
 *      seats                               H aim with the cursor in the letterbox
 *   3  touch 844x390, 1v1                  J first touch on a weapon slot · I quick tap vs
 *                                          held touch · K first shot of a drag-aim
 *   4  desktop, ?pointerLock=sim           L capture -> Esc -> click the pause chip ·
 *                                          M Fullscreen chip keeps focus, then Space
 *   5  settings -> match                   N rebind up->Q, left->Space accepted; M refused
 *                                          (control) · O in a match Q moves AND items ·
 *                                          P left=Space with a focused chip
 *
 *   node tools/tmp/sx_snap.mjs --root /private/tmp/fa-rv-head -- \
 *     node tools/tmp/bh_input_probe.mjs --url '{URL}' --label head
 *   --sessions 1,3   run a subset          --out <dir>   JSON destination
 *
 * Read-only on the game: it drives the shipped URL params (`screen`, `player`, `enemy`,
 * `seats`, `items`, `pointerLock`) and synthesises DOM events; it never patches a module.
 */

import { chromium } from 'playwright';
import { mkdirSync, writeFileSync } from 'node:fs';

const args = {};
for (let i = 2; i < process.argv.length; i++) {
  const a = process.argv[i];
  if (!a.startsWith('--')) continue;
  const v = process.argv[i + 1];
  if (v === undefined || v.startsWith('--')) args[a.slice(2)] = true;
  else { args[a.slice(2)] = v; i++; }
}
const BASE = String(args.url ?? process.env.PREVIEW_BASE ?? '').replace(/\/$/, '');
if (!BASE) { console.error('bh_input_probe: --url or PREVIEW_BASE required'); process.exit(2); }
const LABEL = String(args.label ?? 'run');
const OUT = String(args.out ?? 'shots/rv/bugs/input');
const ONLY = args.sessions ? String(args.sessions).split(',').map(Number) : [1, 2, 3, 4, 5];

const LAUNCH_ARGS = [
  '--use-gl=angle', '--use-angle=swiftshader', '--enable-unsafe-swiftshader',
  '--enable-webgl', '--ignore-gpu-blocklist', '--disable-gpu-sandbox',
];

const INIT = `(() => {
  const rec = { frames: 0, attackFrames: 0, coolFrames: 0, firstAttack: null, last: null,
    lastF: -1, t0: performance.now() };
  window.__bhRec = rec;
  window.__bhReset = () => { rec.frames = 0; rec.attackFrames = 0; rec.coolFrames = 0;
    rec.firstAttack = null; rec.t0 = performance.now(); };
  const orig = window.requestAnimationFrame.bind(window);
  window.requestAnimationFrame = (cb) => orig((t) => {
    cb(t);
    const d = window.__matchDebug;
    if (!d || d.frames === rec.lastF) return;
    rec.lastF = d.frames;
    rec.frames++;
    const timers = [...document.querySelectorAll('.hud-weapon-slot .hud-weapon-timer')]
      .map((n) => n.textContent || '');
    const sel = d.selectedWeapon;
    const cooling = !!timers[sel];
    if (d.attack) {
      rec.attackFrames++;
      if (!rec.firstAttack) rec.firstAttack = { f: rec.frames, fx: d.facingX, fy: d.facingY };
    }
    if (cooling) rec.coolFrames++;
    rec.last = { attack: d.attack, fx: d.facingX, fy: d.facingY, mx: d.moveX, my: d.moveY,
      sel, paused: d.paused, phase: d.phase, timers };
  });
})();`;

const results = [];
const facts = {};
function row(id, pass, detail) {
  results.push({ id, pass: !!pass, detail });
  console.log(`  ${pass ? 'ok  ' : 'FAIL'} ${id}${detail ? `  — ${detail}` : ''}`);
}
const r2 = (n) => (typeof n === 'number' ? Math.round(n * 100) / 100 : n);

const browser = await chromium.launch({ args: LAUNCH_ARGS });
const pageErrors = [];

async function open(query, { viewport = { width: 1280, height: 800 }, touch = false, waitMatch = true, ctx = null } = {}) {
  const context = ctx ?? await browser.newContext({ viewport, deviceScaleFactor: 1, hasTouch: touch, isMobile: touch });
  if (!ctx) await context.addInitScript(INIT);
  const page = await context.newPage();
  page.on('pageerror', (e) => pageErrors.push(`${query}: ${String(e).slice(0, 200)}`));
  await page.goto(`${BASE}/?${query}`, { waitUntil: 'domcontentloaded', timeout: 180000 });
  if (waitMatch) {
    await page.waitForFunction(() => window.__gameReady === true, null, { timeout: 240000, polling: 250 });
    await page.waitForFunction(() => window.__matchDebug && window.__matchDebug.phase === 'playing',
      null, { timeout: 240000, polling: 250 });
    await waitFrames(page, 3);
  }
  return { context, page };
}

async function waitFrames(page, n, timeout = 180000) {
  const start = await page.evaluate(() => window.__bhRec ? window.__bhRec.frames : 0);
  await page.waitForFunction((s) => window.__bhRec && window.__bhRec.frames >= s, start + n,
    { timeout, polling: 60 });
}
const rec = (page) => page.evaluate(() => JSON.parse(JSON.stringify(window.__bhRec)));
const reset = (page) => page.evaluate(() => window.__bhReset());
/** Wait until the SELECTED weapon slot's HUD timer is empty, i.e. its cooldown is over. */
async function waitReady(page) {
  await page.waitForFunction(() => {
    const r = window.__bhRec; return r && r.last && !r.last.timers[r.last.sel];
  }, null, { timeout: 120000, polling: 60 });
}
const playerPt = (page) => page.evaluate(() => window.__vfxDebugScreen && window.__vfxDebugScreen.player);
const canvasRect = (page) => page.evaluate(() => {
  const r = document.querySelector('#game canvas').getBoundingClientRect();
  return { x: r.x, y: r.y, w: r.width, h: r.height };
});
const itemSlots = (page) => page.evaluate(() => [...document.querySelectorAll('.hud-item-slot')]
  .map((n) => ({ cls: n.className.replace('hud-item-slot', '').trim(),
    badge: (n.querySelector('.hud-item-badge') || {}).textContent || '' })));
const ui = (page) => page.evaluate(() => ({
  paused: window.__matchDebug ? window.__matchDebug.paused : null,
  sheetOpen: !!document.querySelector('.match-sheet.is-open'),
  plock: window.__plockDebug ? { ...window.__plockDebug } : null,
  active: document.activeElement ? `${document.activeElement.tagName}.${document.activeElement.className}` : null,
  chipLabel: (document.querySelector('.match-chip') || {}).getAttribute
    ? document.querySelector('.match-chip').getAttribute('aria-label') : null,
}));
const angleDeg = (fx, fy) => r2((Math.atan2(fy, fx) * 180) / Math.PI);

// ════════════════════════════════════════════════════════════════════════════
// SESSION 1 — desktop, 1v1, two items
// ════════════════════════════════════════════════════════════════════════════
if (ONLY.includes(1)) {
  console.log(`\n[${LABEL}] SESSION 1 — desktop 1280x800, 1v1, items=springform,warm_milk`);
  const { context, page } = await open('screen=match&pointerLock=0&player=hamburger&enemy=donut&items=springform,warm_milk');
  const p = await playerPt(page);
  const aim = { x: p.x + 160, y: p.y };
  await page.mouse.move(aim.x, aim.y);
  await waitFrames(page, 3);

  // A — CONTROL: a click held across frames fires.
  await waitReady(page); await reset(page);
  await page.mouse.down();
  await page.waitForFunction(() => window.__bhRec.attackFrames >= 1, null, { timeout: 120000, polling: 40 });
  await page.mouse.up();
  await waitFrames(page, 3);
  const A = await rec(page);
  const msPerFrame = (await page.evaluate(() => (performance.now() - window.__bhRec.t0) / Math.max(1, window.__bhRec.frames)));
  facts.s1_msPerLoopFrame = r2(msPerFrame);
  row('S1.A CONTROL held click reaches the sim and fires', A.attackFrames >= 1 && A.coolFrames >= 1,
    `attackFrames ${A.attackFrames}, coolingFrames ${A.coolFrames}, ~${r2(msPerFrame)} ms/loop frame`);

  // B — mousedown + mouseup inside ONE task: no rAF can run between them.
  await waitReady(page); await waitFrames(page, 2); await reset(page);
  await page.evaluate(({ x, y }) => {
    const c = document.querySelector('#game canvas');
    const o = { bubbles: true, cancelable: true, composed: true, clientX: x, clientY: y, button: 0, view: window };
    c.dispatchEvent(new MouseEvent('mousedown', { ...o, buttons: 1 }));
    c.dispatchEvent(new MouseEvent('mouseup', { ...o, buttons: 0 }));
  }, aim);
  await waitFrames(page, 8);
  const B = await rec(page);
  facts.s1_B = B;
  row('S1.B a click whose down+up land between two frames FIRES', B.attackFrames >= 1 && B.coolFrames >= 1,
    `attackFrames ${B.attackFrames}, coolingFrames ${B.coolFrames} over ${B.frames} frames`);

  // C — the same with real CDP input, back to back (no frame awaited between).
  const trials = [];
  for (let k = 0; k < 5; k++) {
    await waitReady(page); await waitFrames(page, 2); await reset(page);
    await page.mouse.down(); await page.mouse.up();
    await waitFrames(page, 8);
    const r = await rec(page);
    trials.push({ attackFrames: r.attackFrames, coolFrames: r.coolFrames });
  }
  const landed = trials.filter((t) => t.attackFrames > 0).length;
  facts.s1_C = trials;
  row('S1.C real CDP click (down/up back to back) fires every time', landed === trials.length,
    `${landed}/${trials.length} landed — ${trials.map((t) => t.attackFrames).join(',')}`);

  // D — the item key.
  const before = await itemSlots(page);
  row('S1.D0 item cluster exists with two READY slots (non-empty set before asserting)',
    before.length === 2 && before.every((s) => s.cls.includes('is-ready')), before.map((s) => s.cls).join(' | '));
  await page.keyboard.press('KeyQ');
  await waitFrames(page, 40);
  const afterQ = await itemSlots(page);
  facts.s1_D = { before, afterQ };
  row('S1.D Q fires item slot 0 (slot leaves READY)', afterQ[0] && !afterQ[0].cls.includes('is-ready'),
    `slot0 after 40 frames: "${afterQ[0] && afterQ[0].cls}" badge "${afterQ[0] && afterQ[0].badge}"`);

  // E — AZERTY. The number-row key cap printed "2" sends code Digit2 / key "é" unshifted;
  // the key printed "Q" on AZERTY is code KeyA. Both synthesised exactly as such a keyboard
  // sends them.
  const key = (code, k) => page.evaluate(([c, kk]) => {
    window.dispatchEvent(new KeyboardEvent('keydown', { code: c, key: kk, bubbles: true }));
    window.dispatchEvent(new KeyboardEvent('keyup', { code: c, key: kk, bubbles: true }));
  }, [code, k]);
  await key('Digit2', 'é'); await waitFrames(page, 2);
  const selAz = (await rec(page)).last.sel;
  await key('Digit2', '2'); await waitFrames(page, 2);
  const selUs = (await rec(page)).last.sel;
  await key('Digit1', '1'); await waitFrames(page, 2);
  row('S1.E CONTROL QWERTY "2" (code Digit2, key "2") selects slot 2', selUs === 1, `selectedWeapon ${selUs}`);
  row('S1.E AZERTY "2" (code Digit2, key "é") selects slot 2', selAz === 1, `selectedWeapon ${selAz}`);
  await page.evaluate(() => window.dispatchEvent(new KeyboardEvent('keydown', { code: 'KeyA', key: 'q', bubbles: true })));
  await waitFrames(page, 3);
  const azQ = (await rec(page)).last;
  await page.evaluate(() => window.dispatchEvent(new KeyboardEvent('keyup', { code: 'KeyA', key: 'q', bubbles: true })));
  await waitFrames(page, 2);
  const capQ = await page.evaluate(() => [...document.querySelectorAll('.hud-item-key')].map((n) => n.textContent));
  facts.s1_E = { selAz, selUs, azQ: { mx: azQ.mx, my: azQ.my }, capQ };
  row('S1.E the item cap the HUD prints ("Q") is not move-left on AZERTY', !(azQ.mx < 0),
    `HUD caps ${JSON.stringify(capQ)}; AZERTY "Q" key (code KeyA) gives moveX ${azQ.mx}`);

  // F — pause chip CONTROL, then resume with Esc, then an UNBOUND key.
  await page.click('.match-chip');
  await waitFrames(page, 2);
  const F1 = await ui(page);
  row('S1.F CONTROL clicking the pause chip opens the sheet and pauses', F1.sheetOpen && F1.paused === true,
    `sheetOpen ${F1.sheetOpen}, paused ${F1.paused}`);
  await page.keyboard.press('Escape');
  await waitFrames(page, 2);
  const F2 = await ui(page);
  row('S1.F0 Esc resumes from the sheet', !F2.sheetOpen && F2.paused === false,
    `sheetOpen ${F2.sheetOpen}, paused ${F2.paused}, focus ${F2.active}`);
  await page.keyboard.press('Space');
  await waitFrames(page, 2);
  const F3 = await ui(page);
  facts.s1_F = { F1, F2, F3 };
  row('S1.F Space (bound to nothing) leaves the match running', F3.paused === false && !F3.sheetOpen,
    `after Space: paused ${F3.paused}, sheetOpen ${F3.sheetOpen} (focus was ${F2.active})`);
  if (F3.sheetOpen) { await page.keyboard.press('Escape'); await waitFrames(page, 2); }
  await context.close();
}

// ════════════════════════════════════════════════════════════════════════════
// SESSION 2 — a letterboxed desktop window, six seats
// ════════════════════════════════════════════════════════════════════════════
if (ONLY.includes(2)) {
  console.log(`\n[${LABEL}] SESSION 2 — desktop 1000x1000 (aspect 1.0 < 4:3 -> letterboxed), seats=6`);
  const { context, page } = await open('screen=match&pointerLock=0&player=hamburger&seats=6',
    { viewport: { width: 1000, height: 1000 } });
  const rect = await canvasRect(page);
  const p = await playerPt(page);
  facts.s2_rect = rect; facts.s2_player = p;
  row('S2.0 the canvas IS letterboxed (bar above it, non-empty)', rect.y >= 50, `canvas ${JSON.stringify(rect)}, player ${JSON.stringify(p)}`);
  const barY = Math.round(rect.y / 2);
  const inY = Math.round(rect.y + 40);

  // H — aim.
  await page.mouse.move(p.x - 220, p.y); await waitFrames(page, 4);
  const h1 = (await rec(page)).last;
  await page.mouse.move(p.x, barY); await waitFrames(page, 4);
  const h2 = (await rec(page)).last;
  await page.mouse.move(p.x, inY); await waitFrames(page, 4);
  const h3 = (await rec(page)).last;
  facts.s2_H = { left: angleDeg(h1.fx, h1.fy), bar: angleDeg(h2.fx, h2.fy), inCanvasUp: angleDeg(h3.fx, h3.fy) };
  row('S2.H CONTROL cursor left of the player, in the canvas -> facing ~180 deg', Math.abs(Math.abs(angleDeg(h1.fx, h1.fy)) - 180) < 15,
    `facing ${angleDeg(h1.fx, h1.fy)} deg`);
  row('S2.H CONTROL cursor above the player, in the canvas -> facing ~-90 deg', Math.abs(angleDeg(h3.fx, h3.fy) + 90) < 15,
    `facing ${angleDeg(h3.fx, h3.fy)} deg`);
  row('S2.H cursor above the player, IN THE BAR -> facing follows (~-90 deg)', Math.abs(angleDeg(h2.fx, h2.fy) + 90) < 15,
    `facing ${angleDeg(h2.fx, h2.fy)} deg (still the LEFT bearing if aim is dead in the bar)`);

  // G — fire.
  await page.mouse.move(p.x, barY); await waitFrames(page, 2);
  await waitReady(page); await reset(page);
  await page.mouse.down(); await waitFrames(page, 8); await page.mouse.up(); await waitFrames(page, 3);
  const G1 = await rec(page);
  await page.mouse.move(p.x, inY); await waitFrames(page, 2);
  await waitReady(page); await reset(page);
  await page.mouse.down();
  let gotControl = true;
  try {
    await page.waitForFunction(() => window.__bhRec.attackFrames >= 1, null, { timeout: 60000, polling: 40 });
  } catch { gotControl = false; }
  await page.mouse.up(); await waitFrames(page, 3);
  const G2 = await rec(page);
  facts.s2_G = { bar: G1, canvas: G2 };
  row('S2.G CONTROL a click held inside the canvas fires', gotControl && G2.attackFrames >= 1, `attackFrames ${G2.attackFrames}`);
  row('S2.G a click held IN THE BAR (8 frames) fires', G1.attackFrames >= 1,
    `attackFrames ${G1.attackFrames}, coolingFrames ${G1.coolFrames} over ${G1.frames} frames`);
  await context.close();
}

// ════════════════════════════════════════════════════════════════════════════
// SESSION 3 — touch, landscape phone
// ════════════════════════════════════════════════════════════════════════════
if (ONLY.includes(3)) {
  console.log(`\n[${LABEL}] SESSION 3 — touch 844x390 (hasTouch, isMobile), 1v1`);
  const { context, page } = await open('screen=match&player=hamburger&enemy=donut',
    { viewport: { width: 844, height: 390 }, touch: true });
  const client = await context.newCDPSession(page);
  const touch = (type, x, y) => client.send('Input.dispatchTouchEvent',
    { type, touchPoints: type === 'touchEnd' ? [] : [{ x, y, id: 7 }] });
  const env = await page.evaluate(() => ({ html: document.documentElement.className,
    mtp: navigator.maxTouchPoints, coarse: matchMedia('(pointer: coarse)').matches }));
  facts.s3_env = env;
  const slots = await page.evaluate(() => [...document.querySelectorAll('.hud-weapon-slot')].map((n) => {
    const r = n.getBoundingClientRect(); return { x: r.x + r.width / 2, y: r.y + r.height / 2,
      pe: getComputedStyle(n).pointerEvents }; }));
  row('S3.0 four weapon slots on screen (non-empty set)', slots.length === 4,
    `html "${env.html}", maxTouchPoints ${env.mtp}, coarse ${env.coarse}, slot3 pointer-events before any touch "${slots[2] && slots[2].pe}"`);

  // J — the first touch of the match, on weapon slot 3 (index 2), held for 4 frames.
  await reset(page);
  await touch('touchStart', slots[2].x, slots[2].y); await waitFrames(page, 4);
  await touch('touchEnd'); await waitFrames(page, 3);
  const J1 = await rec(page);
  await reset(page);
  await touch('touchStart', slots[2].x, slots[2].y); await waitFrames(page, 4);
  await touch('touchEnd'); await waitFrames(page, 3);
  const J2 = await rec(page);
  facts.s3_J = { first: { attack: J1.attackFrames, sel: J1.last.sel }, second: { attack: J2.attackFrames, sel: J2.last.sel } };
  row('S3.J CONTROL the SECOND touch on slot 3 selects it and does not fire', J2.last.sel === 2 && J2.attackFrames === 0,
    `selectedWeapon ${J2.last.sel}, attackFrames ${J2.attackFrames}`);
  row('S3.J the FIRST touch on slot 3 selects it and does not fire', J1.last.sel === 2 && J1.attackFrames === 0,
    `selectedWeapon ${J1.last.sel}, attackFrames ${J1.attackFrames}`);
  // back to slot 1
  await touch('touchStart', slots[0].x, slots[0].y); await waitFrames(page, 2); await touch('touchEnd'); await waitFrames(page, 2);

  // I — the aim half, clear of the weapon cluster.
  // CSS pixels on the canvas, NOT world units (al_guard read the old { x, y } as a map point
  // inside supply_barrel, 2026-10-15) — so the keys say what the numbers are.
  const tapPt = { clientX: 600, clientY: 140 };
  await waitReady(page); await reset(page);
  await page.evaluate(({ clientX: x, clientY: y }) => {
    const c = document.querySelector('#game canvas');
    const t = new Touch({ identifier: 901, target: c, clientX: x, clientY: y });
    c.dispatchEvent(new TouchEvent('touchstart', { touches: [t], targetTouches: [t], changedTouches: [t], bubbles: true, cancelable: true }));
    c.dispatchEvent(new TouchEvent('touchend', { touches: [], targetTouches: [], changedTouches: [t], bubbles: true, cancelable: true }));
  }, tapPt);
  await waitFrames(page, 8);
  const I1 = await rec(page);
  row('S3.I a tap whose start+end land between two frames FIRES ("quick tap to shoot")', I1.attackFrames >= 1,
    `attackFrames ${I1.attackFrames}, coolingFrames ${I1.coolFrames}`);
  const taps = [];
  for (let k = 0; k < 4; k++) {
    await waitReady(page); await waitFrames(page, 2); await reset(page);
    await page.touchscreen.tap(tapPt.clientX, tapPt.clientY);
    await waitFrames(page, 8);
    taps.push((await rec(page)).attackFrames);
  }
  row('S3.I real CDP taps (Playwright touchscreen.tap) fire every time', taps.every((a) => a > 0), `attackFrames per tap: ${taps.join(',')}`);
  await waitReady(page); await reset(page);
  await touch('touchStart', tapPt.clientX, tapPt.clientY);
  let held = true;
  try { await page.waitForFunction(() => window.__bhRec.attackFrames >= 1, null, { timeout: 60000, polling: 40 }); } catch { held = false; }
  await touch('touchEnd'); await waitFrames(page, 3);
  const I3 = await rec(page);
  row('S3.I CONTROL a touch held across frames fires', held && I3.attackFrames >= 1, `attackFrames ${I3.attackFrames}`);
  facts.s3_I = { synthetic: I1.attackFrames, cdpTaps: taps, held: I3.attackFrames };

  // K — drag-aim: plant, then drag LEFT; where did the first shot go? (DESIGN measurement)
  // First point the fighter RIGHT with a short drag that releases.
  await touch('touchStart', 600, 200); await touch('touchMove', 680, 200); await waitFrames(page, 3); await touch('touchEnd'); await waitFrames(page, 3);
  const k0 = (await rec(page)).last;
  await waitReady(page); await reset(page);
  await touch('touchStart', 640, 200);
  await page.waitForFunction(() => window.__bhRec.attackFrames >= 1, null, { timeout: 60000, polling: 40 }).catch(() => {});
  await touch('touchMove', 600, 200); await touch('touchMove', 560, 200); await waitFrames(page, 3);
  await touch('touchEnd'); await waitFrames(page, 2);
  const K = await rec(page);
  facts.s3_K = { before: angleDeg(k0.fx, k0.fy), firstShot: K.firstAttack && angleDeg(K.firstAttack.fx, K.firstAttack.fy),
    afterDrag: angleDeg(K.last.fx, K.last.fy) };
  console.log(`  info S3.K drag-aim: facing before ${facts.s3_K.before} deg, first shot at ${facts.s3_K.firstShot} deg, after the drag ${facts.s3_K.afterDrag} deg`);
  await context.close();
}

// ════════════════════════════════════════════════════════════════════════════
// SESSION 4 — pointer lock, simulated (Playwright's Chromium refuses the real API)
// ════════════════════════════════════════════════════════════════════════════
if (ONLY.includes(4)) {
  console.log(`\n[${LABEL}] SESSION 4 — desktop, ?pointerLock=sim`);
  const { context, page } = await open('screen=match&pointerLock=sim&player=hamburger&enemy=donut');
  await page.click('[data-el="capture"]'); await waitFrames(page, 2);
  const L0 = await ui(page);
  row('S4.L0 capture chip captures', L0.plock && L0.plock.locked === true, `plock ${JSON.stringify(L0.plock)}`);
  await page.keyboard.press('Escape'); await waitFrames(page, 2);
  const L1 = await ui(page);
  row('S4.L1 Esc drops capture, pauses, shows the resume scrim', L1.plock.state === 'lost' && L1.paused === true,
    `state ${L1.plock.state}, paused ${L1.paused}, sheetOpen ${L1.sheetOpen}, chip says "${L1.chipLabel}"`);
  await page.click('.match-chip'); await waitFrames(page, 3);
  const L2 = await ui(page);
  facts.s4_L = { L0, L1, L2 };
  row('S4.L clicking the chip labelled "Pause" opens the pause sheet (match stays paused)',
    L2.sheetOpen && L2.paused === true,
    `after click: sheetOpen ${L2.sheetOpen}, paused ${L2.paused}, locked ${L2.plock && L2.plock.locked}, state ${L2.plock && L2.plock.state}`);

  // M — "Play without capture" puts the chip bar back; Fullscreen chip then keeps focus.
  if (!L2.paused) { await page.keyboard.press('Escape'); await waitFrames(page, 2); }
  const lostNow = (await ui(page)).plock.state === 'lost';
  if (lostNow) { await page.click('[data-el="free"]'); await waitFrames(page, 2); }
  const M0 = await ui(page);
  await page.evaluate(() => { window.__fsClicks = 0;
    document.querySelector('[data-el="fs"]').addEventListener('click', () => { window.__fsClicks++; }); });
  await page.click('[data-el="fs"]'); await waitFrames(page, 2);
  const afterClick = await page.evaluate(() => ({ n: window.__fsClicks, active: document.activeElement && document.activeElement.dataset.el,
    fs: !!document.fullscreenElement }));
  await page.keyboard.press('Space'); await waitFrames(page, 2);
  const afterSpace = await page.evaluate(() => ({ n: window.__fsClicks, fs: !!document.fullscreenElement }));
  facts.s4_M = { M0: M0.plock && M0.plock.state, afterClick, afterSpace };
  row('S4.M Space (bound to nothing) does not re-press the Fullscreen chip', afterSpace.n === afterClick.n,
    `chip clicks ${afterClick.n} -> ${afterSpace.n} (focus "${afterClick.active}"), fullscreen ${afterClick.fs} -> ${afterSpace.fs}`);
  await context.close();
}

// ════════════════════════════════════════════════════════════════════════════
// SESSION 5 — the settings screen's rebind, then a match
// ════════════════════════════════════════════════════════════════════════════
if (ONLY.includes(5)) {
  console.log(`\n[${LABEL}] SESSION 5 — settings rebind, then a match`);
  const { context, page } = await open('screen=settings', { waitMatch: false });
  await page.waitForSelector('[data-el="bind-up"]', { timeout: 180000 });
  const stored = () => page.evaluate(() => { try { return JSON.parse(localStorage.getItem('food-arena.settings.v1') || '{}').moveKeys || {}; } catch { return 'ERR'; } });
  const note = () => page.evaluate(() => (document.querySelector('[data-el="bindnote"]') || {}).textContent || '');
  await page.click('[data-el="bind-down"]'); await page.keyboard.press('KeyM');
  const nM = await note(); const sM = await stored();
  if (!/mutes/i.test(nM)) { /* left listening? */ }
  await page.keyboard.press('Escape');
  row('S5.N CONTROL binding "down" to M is REFUSED with the reason', !sM.down && /mute/i.test(nM), `note "${nM}", stored ${JSON.stringify(sM)}`);
  await page.click('[data-el="bind-up"]'); await page.keyboard.press('KeyQ');
  const nQ = await note(); const sQ = await stored();
  row('S5.N binding "up" to Q (an ITEM key) is refused', sQ.up !== 'KeyQ', `note "${nQ}", stored ${JSON.stringify(sQ)}`);
  if (sQ.up !== 'KeyQ') { await page.keyboard.press('Escape'); }
  await page.click('[data-el="bind-left"]'); await page.keyboard.press('Space');
  const nS = await note(); const sS = await stored();
  row('S5.N binding "left" to Space (activates a focused button) is refused', sS.left !== 'Space', `note "${nS}", stored ${JSON.stringify(sS)}`);
  if (sS.left !== 'Space') { await page.keyboard.press('Escape'); }
  const keysRow = await page.evaluate(() => (document.querySelector('[data-el="keys"]') || {}).textContent || '');
  facts.s5_controlsList = keysRow.replace(/\s+/g, ' ').trim();
  row('S5.N the Controls list mentions the item keys the HUD prints', /\bQ\b/.test(keysRow) && /\bE\b/.test(keysRow),
    `controls list: "${facts.s5_controlsList}"`);

  // O/P — the bindings that were accepted, in a match.
  await page.goto(`${BASE}/?screen=match&pointerLock=0&player=hamburger&enemy=donut&items=springform,warm_milk`,
    { waitUntil: 'domcontentloaded', timeout: 180000 });
  await page.waitForFunction(() => window.__gameReady === true, null, { timeout: 240000, polling: 250 });
  await page.waitForFunction(() => window.__matchDebug && window.__matchDebug.phase === 'playing', null, { timeout: 240000, polling: 250 });
  await waitFrames(page, 3);
  const items0 = await itemSlots(page);
  await page.keyboard.down('KeyQ'); await waitFrames(page, 4);
  const o1 = (await rec(page)).last;
  await page.keyboard.up('KeyQ'); await waitFrames(page, 40);
  const items1 = await itemSlots(page);
  facts.s5_O = { boundUp: sQ.up, moveY: o1.my, items0, items1 };
  console.log(`  info S5.O with up=${sQ.up || 'W'}: holding Q gives moveY ${o1.my}; item slot0 "${items0[0] && items0[0].cls}" -> "${items1[0] && items1[0].cls}"`);
  row('S5.O one key does not both MOVE and spend an ITEM', !(o1.my < 0 && items1[0] && !items1[0].cls.includes('is-ready')),
    `moveY ${o1.my}, slot0 ${items1[0] && items1[0].cls}`);
  // P — chip focus + Space bound to "left".
  await page.click('.match-chip'); await waitFrames(page, 2);
  await page.keyboard.press('Escape'); await waitFrames(page, 2);
  const p0 = await ui(page);
  await page.keyboard.down('Space'); await waitFrames(page, 3);
  const p1 = (await rec(page)).last;
  await page.keyboard.up('Space'); await waitFrames(page, 3);
  const p2 = await ui(page);
  facts.s5_P = { boundLeft: sS.left, focus: p0.active, moveXWhileHeld: p1.mx, pausedAfter: p2.paused, sheetAfter: p2.sheetOpen };
  row('S5.P pressing the bound movement key never pauses the match', p2.paused === false,
    `left=${sS.left || 'A'}; holding Space moveX ${p1.mx}; after release paused ${p2.paused}, sheet ${p2.sheetOpen} (focus ${p0.active})`);
  await context.close();
}

await browser.close();
const failed = results.filter((r) => !r.pass);
console.log(`\n[${LABEL}] ${results.length - failed.length} ok, ${failed.length} FAIL`);
if (pageErrors.length) console.log(`  page errors: ${pageErrors.length}\n   ${pageErrors.slice(0, 5).join('\n   ')}`);
try {
  mkdirSync(OUT, { recursive: true });
  writeFileSync(`${OUT}/probe_${LABEL}.json`, JSON.stringify({ label: LABEL, base: BASE, results, facts, pageErrors }, null, 2));
  console.log(`  wrote ${OUT}/probe_${LABEL}.json`);
} catch (e) { console.log(`  could not write JSON: ${e}`); }
process.exit(0);
