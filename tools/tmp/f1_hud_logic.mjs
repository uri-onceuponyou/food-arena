#!/usr/bin/env node
/**
 * F1_HUD_LOGIC — the HUD bugs graphics-campaign package F1 owns, as tests that must go RED on
 * the base tree and GREEN on the fix. Owner of the `f1_` prefix.
 *
 * Every arm drives the REAL `createHud` against a REAL `MatchState` from `createMatch` (six
 * seats, the shipped arena's six spawns), loaded through the snapshot's Vite server on
 * `tools/tmp/f1_hud_harness.html` — the page only exposes the modules, it copies no logic.
 * Every arm is paired with a CONTROL that must come out the other way, so a red row means
 * "the HUD did not do it" and never "the test could not see it" (CLAUDE.md rule 6), and every
 * filtered set is asserted non-empty before anything is asserted over it.
 *
 *   U1    the weapon tray reads READY while the local fighter is clogged (Pompa) or asleep
 *         (Warm Milk) — `combat.ts:attemptAttack` refuses every press under
 *         `state.ts:weaponsLocked`, so a lit tray is a button that lies
 *   ML8   a spent Leftovers (revivesLeft 0) keeps its full-strength AUTO plate (six seats;
 *         the finder's minSeats is 4)
 *   UI01  portraits: `setCharacters` hydrates from the thumbnail cache ONCE, so a cache that
 *         fills after the match mounted leaves the generic mark on every plate for good
 *   UI02  damage numbers: a wall-clock CSS keyframe is either finished before a slow
 *         renderer's next frame (2 s between frames) or held at its 0% keyframe (opacity 0)
 *         by a capture that freezes CSS animations — the number never reaches a frame
 *   PLATE the brawler nameplate carries the fighter's NAME and its HP as a NUMBER (feature
 *         check, not a bug arm: no red-on-base requirement)
 *
 * Usage:
 *   node tools/tmp/sx_snap.mjs --root <tree> -- node tools/tmp/f1_hud_logic.mjs --url '{URL}'
 *   [--only U1,ML8] [--json out.json]
 * Exit 0 only if every arm and every control passed.
 */
import { chromium } from 'playwright';
import { writeFileSync } from 'node:fs';
import { resolve } from 'node:path';
import { fileURLToPath } from 'node:url';

const argv = process.argv.slice(2);
const arg = (k, d = null) => { const i = argv.indexOf(k); return i >= 0 ? argv[i + 1] : d; };
const BASE = String(arg('--url', process.env.PREVIEW_BASE ?? '')).replace(/\/$/, '');
const ONLY = arg('--only', null)?.split(',') ?? null;
const JSON_OUT = arg('--json', null);

const LAUNCH = { headless: true, args: ['--use-angle=metal', '--enable-gpu', '--ignore-gpu-blocklist', '--disable-gpu-sandbox'] };
const HMR_STUB = `const noop=()=>{};
export const createHotContext=()=>({accept:noop,acceptExports:noop,dispose:noop,prune:noop,
  invalidate:noop,on:noop,off:noop,send:noop,decline:noop,data:{}});
export const injectQuery=(u)=>u; export const updateStyle=noop; export const removeStyle=noop;
export const ErrorOverlay=class{}; export default {};`;

const rows = [];
const row = (id, name, ok, detail) => {
  rows.push({ id, name, ok, detail });
  console.log(`  ${ok ? 'ok  ' : 'FAIL'} ${id.padEnd(5)} ${name}   ${detail}`);
};

/** Page-side: build a six-seat match and a HUD over it. Returns nothing; leaves window.__t. */
const SETUP = async (cfg) => {
  const { createHud, createMatch, createKitchenArena } = window.__f1;
  const arena = createKitchenArena();
  const ids = ['hamburger', 'donut', 'taco', 'sushi', 'pizza', 'egg'];
  const state = createMatch(arena, ids.map((characterId, i) => ({
    characterId, spawn: arena.spawns[i], items: i === 0 ? cfg.items : undefined,
  })));
  state.phase = 'playing';
  state.elapsed = 20_000;
  const root = document.getElementById('hud');
  const hud = createHud(root, { onRestart() {}, onSelectWeapon() {}, onUseItem() {} });
  hud.setCharacters(ids);
  window.__t = { state, hud, root, ids, frame: { selectedWeapon: 0, observerSlot: 0 } };
};

async function withPage(browser, fn) {
  const context = await browser.newContext({ viewport: { width: 1600, height: 900 } });
  const page = await context.newPage();
  await page.route('**/@vite/client*', (r) => r.fulfill({ status: 200, contentType: 'text/javascript', body: HMR_STUB }));
  const errors = [];
  page.on('pageerror', (e) => errors.push(String(e).slice(0, 300)));
  page.setDefaultTimeout(180_000);
  await page.goto(`${BASE}/tools/tmp/f1_hud_harness.html`, { waitUntil: 'networkidle' });
  await page.waitForFunction(() => window.__f1ready === true);
  try { return await fn(page, context); } finally {
    if (errors.length) console.log(`   page errors: ${errors.join(' | ')}`);
    await context.close();
  }
}

// ── U1 ──────────────────────────────────────────────────────────────────────────
async function testU1(browser) {
  await withPage(browser, async (page) => {
    await page.evaluate(SETUP, { items: [] });
    const r = await page.evaluate(() => {
      const { state, hud, root, frame } = window.__t;
      const me = state.fighters[0];
      for (let i = 0; i < me.lastUsed.length; i++) me.lastUsed[i] = -1e9;   // every cooldown long done
      const read = () => {
        hud.update(state, frame);
        const slots = [...root.querySelectorAll('.hud-weapon-slot')];
        return { n: slots.length, ready: slots.filter((s) => s.classList.contains('is-ready')).length,
          locked: root.querySelector('.hud-weapons')?.classList.contains('is-locked') ?? false };
      };
      const free = read();
      me.item.clogUntil = state.elapsed + 3000;
      const clog = read();
      me.item.clogUntil = -Infinity;
      me.item.sleepUntil = state.elapsed + 3000;
      const sleep = read();
      me.item.sleepUntil = -Infinity;
      const back = read();
      return { free, clog, sleep, back };
    });
    row('U1', 'CONTROL the tray has slots and reads ready when nothing locks it', r.free.n >= 1 && r.free.ready === r.free.n, `${r.free.ready}/${r.free.n} ready`);
    row('U1', 'clogged (Pompa): no slot reads ready', r.clog.n >= 1 && r.clog.ready === 0, `${r.clog.ready}/${r.clog.n} ready, tray is-locked ${r.clog.locked}`);
    row('U1', 'asleep (Warm Milk): no slot reads ready', r.sleep.n >= 1 && r.sleep.ready === 0, `${r.sleep.ready}/${r.sleep.n} ready, tray is-locked ${r.sleep.locked}`);
    row('U1', 'CONTROL the lock lifts: ready again', r.back.ready === r.back.n && !r.back.locked, `${r.back.ready}/${r.back.n} ready, is-locked ${r.back.locked}`);
  });
}

// ── ML-8 ────────────────────────────────────────────────────────────────────────
async function testML8(browser) {
  await withPage(browser, async (page) => {
    await page.evaluate(SETUP, { items: ['leftovers'] });
    const r = await page.evaluate(() => {
      const { state, hud, root, frame } = window.__t;
      const me = state.fighters[0];
      const read = () => {
        hud.update(state, frame);
        const slots = [...root.querySelectorAll('.hud-item-slot')];
        const s = slots.find((x) => !x.classList.contains('is-empty'));
        return { n: slots.length, cls: s?.className ?? null, badge: s?.querySelector('[data-role="badge"]')?.textContent ?? null };
      };
      const live = read();
      const before = me.item.revivesLeft;
      me.item.revivesLeft = 0;
      const spent = read();
      return { live, spent, before, seats: state.fighters.length, equipped: me.item.equipped.slice() };
    });
    const fullAuto = (x) => !!x.cls && /\bis-auto\b/.test(x.cls) && x.badge === 'AUTO' && !/\bis-spent\b/.test(x.cls);
    row('ML8', `CONTROL six seats, Leftovers equipped and unspent (revivesLeft ${r.before}) reads AUTO`, r.seats === 6 && r.live.n >= 1 && fullAuto(r.live), `seats ${r.seats}, equipped ${r.equipped}, "${r.live.cls}" badge ${r.live.badge}`);
    row('ML8', 'spent (revivesLeft 0) does NOT keep the full-strength AUTO plate', r.spent.n >= 1 && !fullAuto(r.spent), `"${r.spent.cls}" badge ${r.spent.badge}`);
  });
}

// ── UI-01 ───────────────────────────────────────────────────────────────────────
async function testUI01(browser) {
  await withPage(browser, async (page) => {
    await page.evaluate(SETUP, { items: [] });
    const r0 = await page.evaluate(() => {
      const { root } = window.__t;
      const all = root.querySelectorAll('[data-portrait]').length;
      const done = root.querySelectorAll('[data-portrait].has-render').length;
      return { all, done };
    });
    row('UI01', 'CONTROL the HUD carries portraits, and none is rendered yet (cache empty)', r0.all > 0 && r0.done === 0, `${r0.done}/${r0.all}`);
    // Fill the cache AFTER the HUD mounted — what character select's generation landing late does.
    const filled = await page.evaluate(async () => {
      const { thumbs } = window.__f1;
      const { ids } = window.__t;
      thumbs.requestThumbnails(() => {});
      const t0 = performance.now();
      while (!ids.every((id) => thumbs.getCachedThumb(id)) && performance.now() - t0 < 150_000) await new Promise((res) => setTimeout(res, 100));
      return ids.filter((id) => thumbs.getCachedThumb(id)).length;
    });
    row('UI01', 'CONTROL the cache filled after mount (six of six heads)', filled === 6, `${filled}/6 cached`);
    const r1 = await page.evaluate(async () => {
      const { state, hud, root, frame } = window.__t;
      for (let i = 0; i < 90; i++) { hud.update(state, frame); await new Promise((res) => setTimeout(res, 16)); }
      return { all: root.querySelectorAll('[data-portrait]').length, done: root.querySelectorAll('[data-portrait].has-render').length };
    });
    row('UI01', 'after ~1.5 s of HUD frames every portrait shows the render, not the generic mark', r1.all > 0 && r1.done === r1.all, `${r1.done}/${r1.all}`);
  });
}

// ── UI-02 ───────────────────────────────────────────────────────────────────────
async function testUI02(browser) {
  // (a) a capture that freezes CSS animations (r1_probe / gx_gap_cap set the rate to 0)
  await withPage(browser, async (page, context) => {
    await page.evaluate(SETUP, { items: [] });
    const cdp = await context.newCDPSession(page);
    await cdp.send('Animation.enable');
    await cdp.send('Animation.setPlaybackRate', { playbackRate: 0 });
    const r = await page.evaluate(async () => {
      const { state, hud, root, frame } = window.__t;
      hud.update(state, frame);
      hud.spawnDamageNumber({ x: 800, y: 450 }, 18, {});
      const op = () => {
        const live = [...root.querySelectorAll('.hud-dmg')].filter((e) => e.textContent === '-18');
        return live.length ? Math.max(...live.map((e) => +getComputedStyle(e).opacity)) : -1;
      };
      for (let i = 0; i < 8; i++) { await new Promise((res) => setTimeout(res, 20)); hud.update(state, frame); }
      return { op: op(), n: root.querySelectorAll('.hud-dmg').length };
    });
    row('UI02', 'CSS animations frozen (as a capture does): a fresh -18 is visible after 8 frames', r.n > 0 && r.op >= 0.5, `opacity ${r.op.toFixed(3)} (pool ${r.n})`);
  });
  // (b) a slow renderer: 2 s of wall clock between two frames
  await withPage(browser, async (page) => {
    await page.evaluate(SETUP, { items: [] });
    const r = await page.evaluate(async () => {
      const { state, hud, root, frame } = window.__t;
      hud.update(state, frame);
      hud.spawnDamageNumber({ x: 800, y: 450 }, 18, {});
      hud.update(state, frame);
      await new Promise((res) => setTimeout(res, 2000));
      hud.update(state, frame);
      const live = [...root.querySelectorAll('.hud-dmg')].filter((e) => e.textContent === '-18');
      const opSlow = live.length ? Math.max(...live.map((e) => +getComputedStyle(e).opacity)) : -1;
      // CONTROL: it must still END — 60 more frames ~16 ms apart (~1 s of frames)
      for (let i = 0; i < 60; i++) { await new Promise((res) => setTimeout(res, 16)); hud.update(state, frame); }
      const live2 = [...root.querySelectorAll('.hud-dmg')].filter((e) => e.textContent === '-18');
      const opEnd = live2.length ? Math.max(...live2.map((e) => +getComputedStyle(e).opacity)) : 0;
      return { opSlow, opEnd };
    });
    row('UI02', 'slow renderer (2 s between frames): the -18 is still on screen at the next frame', r.opSlow >= 0.5, `opacity ${r.opSlow.toFixed(3)}`);
    row('UI02', 'CONTROL ~1 s of frames later the number has finished (opacity 0)', r.opEnd <= 0.02, `opacity ${r.opEnd.toFixed(3)}`);
  });
}

// ── PLATE ───────────────────────────────────────────────────────────────────────
async function testPlate(browser) {
  await withPage(browser, async (page) => {
    await page.evaluate(SETUP, { items: [] });
    const r = await page.evaluate(() => {
      const { state, hud, root, frame } = window.__t;
      state.fighters[1].hp = 37;
      hud.update(state, frame);
      hud.updateFloatingBars(state.fighters.map((f, i) => ({ x: 200 + i * 220, y: 500 })), state.fighters.map((f) => f.hp / f.maxHp));
      const floats = [...root.querySelectorAll('.hud-float')];
      return floats.map((f) => ({ text: f.textContent.replace(/\s+/g, ' ').trim(), name: f.querySelector('.hud-float-name')?.textContent ?? null, hp: f.querySelector('.hud-float-hp')?.textContent ?? null, cls: f.className, w: Math.round(f.getBoundingClientRect().width), h: Math.round(f.getBoundingClientRect().height) }));
    });
    row('PLATE', 'six plates, each naming its fighter', r.length === 6 && ['HAMBURGER', 'DONUT', 'TACO', 'SUSHI', 'PIZZA', 'EGG'].every((n, i) => r[i].text.toUpperCase().includes(n)), r.map((x) => x.text).join(' | '));
    row('PLATE', 'the HP is printed as a number (slot 1 at 37)', r.length === 6 && r[1].hp === '37', `hp element "${r[1]?.hp}" (text "${r[1]?.text ?? '-'}")`);
    row('PLATE', 'plate size at 900 px (w x h)', true, r.map((x) => `${x.w}x${x.h}`).join(' '));
  });
}

async function main() {
  if (!BASE || BASE.includes(':5173')) { console.error('f1_hud_logic: need --url of a FROZEN snapshot (never :5173)'); process.exit(2); }
  const browser = await chromium.launch(LAUNCH);
  const T = { U1: testU1, ML8: testML8, UI01: testUI01, UI02: testUI02, PLATE: testPlate };
  try {
    for (const [k, fn] of Object.entries(T)) {
      if (ONLY && !ONLY.includes(k)) continue;
      console.log(`── ${k}`);
      try { await fn(browser); } catch (e) { row(k, 'arm crashed', false, String(e).slice(0, 300)); }
    }
  } finally { await browser.close(); }
  const fails = rows.filter((r) => !r.ok).length;
  console.log(`\n${rows.length - fails} passed, ${fails} failed`);
  if (JSON_OUT) writeFileSync(JSON_OUT, JSON.stringify({ base: BASE, rows }, null, 1));
  process.exitCode = fails ? 1 : 0;
}

const isMain = (() => { try { return resolve(process.argv[1] ?? '') === fileURLToPath(import.meta.url); } catch { return false; } })();
if (isMain) await main();
