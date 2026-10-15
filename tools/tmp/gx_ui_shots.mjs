#!/usr/bin/env node
/**
 * GX_UI_SHOTS — the UI/HUD/MENUS audit capture set for the graphics-revamp REVIEW phase.
 *
 * READ-ONLY on the game: it drives the shipped routes and screenshots them. Nothing here
 * writes a tracked file. Run it ONLY through a frozen snapshot of a detached worktree:
 *
 *   node tools/tmp/sx_snap.mjs --root /private/tmp/fa-rv-head -- \
 *     node tools/tmp/gx_ui_shots.mjs --url '{URL}' --out shots/rv/audit/ui/cap
 *
 * What it shoots, per viewport (D 1600x900 desktop · L 844x390 phone landscape, touch ·
 * P 390x844 phone portrait, touch):
 *   * every menu screen, reached by IN-APP navigation (so the roster's thumbnail cache is
 *     warmed exactly the way a player warms it, and the HUD later sees what they see);
 *   * a 1v1 match (D) reached in-app after the roster, countdown + action frames;
 *   * a six-seat match on the SHIPPED route (`seats: 6`), opening frame;
 *   * a six-seat ACTION frame on the QA ring roster (`?fighters=`, cold thumb cache);
 *   * the result card (`fogRadius=200` snaps to sudden death, so the match ends in seconds).
 *
 * Every action frame is bracketed by a page-side probe of the floating damage numbers
 * (playState + computed opacity of every `.hud-dmg`), because `.hud-dmg`'s plain COUNT is
 * the pool size (24) and can never say whether a number is on screen — see REPORT.md.
 *
 * Kill discipline: only the browser this process launched is closed; nothing by pattern.
 */
import { chromium } from 'playwright';
import { mkdirSync, writeFileSync } from 'node:fs';
import { resolve } from 'node:path';
import { captureSettled, waitForRoster } from './settle.mjs';

const argv = process.argv.slice(2);
const arg = (k, d = null) => { const i = argv.indexOf(k); return i >= 0 ? argv[i + 1] : d; };
const BASE = String(arg('--url', process.env.PREVIEW_BASE ?? '')).replace(/\/$/, '');
const OUT = resolve(arg('--out', 'shots/rv/audit/ui/cap'));
const ONLY = String(arg('--only', 'D,L,P')).split(',').filter(Boolean);
if (!BASE) { console.error('gx_ui_shots: --url (or PREVIEW_BASE) is required'); process.exitCode = 2; }
mkdirSync(OUT, { recursive: true });

const LAUNCH = ['--use-gl=angle', '--use-angle=swiftshader', '--enable-unsafe-swiftshader',
  '--enable-webgl', '--ignore-gpu-blocklist', '--disable-gpu-sandbox'];

const VIEWPORTS = {
  D: { viewport: { width: 1600, height: 900 }, deviceScaleFactor: 1 },
  L: { viewport: { width: 844, height: 390 }, deviceScaleFactor: 2, isMobile: true, hasTouch: true },
  P: { viewport: { width: 390, height: 844 }, deviceScaleFactor: 2, isMobile: true, hasTouch: true },
};
const MENUS = {
  D: ['home', 'characters', 'lobby', 'trophies', 'shop', 'settings'],
  L: ['home', 'characters', 'lobby', 'trophies', 'shop', 'settings'],
  P: ['home', 'characters', 'lobby'],
};

const report = { base: BASE, startedAt: new Date().toISOString(), shots: [], notes: [] };
const log = (...a) => { console.log(...a); };
const save = () => writeFileSync(`${OUT}/report.json`, JSON.stringify(report, null, 2));

// ── page-side probes ──────────────────────────────────────────────────────────────
const HUD_PROBE = () => {
  const dmg = [...document.querySelectorAll('.hud-dmg')].map((e) => {
    const a = e.getAnimations()[0];
    return {
      txt: e.textContent, cls: e.className,
      t: a && a.currentTime != null ? Math.round(Number(a.currentTime)) : null,
      ps: a ? a.playState : 'none',
      op: Number(getComputedStyle(e).opacity),
    };
  });
  const rect = (el) => { if (!el) return null; const r = el.getBoundingClientRect(); const s = getComputedStyle(el);
    if (s.display === 'none' || s.visibility === 'hidden' || r.width < 1 || r.height < 1) return null;
    return { x: Math.round(r.x), y: Math.round(r.y), w: Math.round(r.width), h: Math.round(r.height) }; };
  const all = (sel) => [...document.querySelectorAll(sel)].map(rect).filter(Boolean);
  const portraits = [...document.querySelectorAll('.hud-root [data-portrait]')];
  const f = window.__vfxDebugFighters;
  return {
    screen: window.__screen ?? null,
    dmgPool: dmg.length,
    dmgRunning: dmg.filter((d) => d.ps === 'running').length,
    dmgVisible: dmg.filter((d) => d.op > 0.15).length,
    dmgLive: dmg.filter((d) => d.ps === 'running' || d.op > 0.05),
    portraitsTotal: portraits.length,
    portraitsRendered: portraits.filter((p) => p.classList.contains('has-render')).length,
    thumbsReady: window.__thumbsReady ?? null,
    htmlClass: document.documentElement.className,
    fighters: f?.slots?.map((s) => ({ x: Math.round(s.x), y: Math.round(s.y), hp: Math.round(s.hp), alive: s.alive })) ?? null,
    rects: {
      topbar: rect(document.querySelector('.hud-topbar')),
      weapons: rect(document.querySelector('.hud-weapons')),
      items: rect(document.querySelector('.hud-items')),
      radar: rect(document.querySelector('.hud-radar')),
      clock: rect(document.querySelector('.hud-clock')),
      gameover: rect(document.querySelector('.hud-gameover-card')),
      floats: all('.hud-float'),
      chips: all('.hud-fighter--chip'),
      matchChips: all('.match-chip'),
      touch: all('[class*="tch-"]'),
    },
    texts: {
      timer: document.querySelector('.hud-timer')?.textContent ?? null,
      zone: document.querySelector('.hud-zone')?.textContent?.replace(/\s+/g, ' ').trim() ?? null,
      names: [...document.querySelectorAll('.hud-fighter-name')].map((e) => e.textContent),
      hp: [...document.querySelectorAll('.hud-healthbar-text')].map((e) => e.textContent),
      gameover: document.querySelector('.hud-gameover-card')?.innerText?.replace(/\s+/g, ' ').trim() ?? null,
    },
  };
};

async function shot(page, name, extra = {}) {
  const path = `${OUT}/${name}.png`;
  const before = await page.evaluate(HUD_PROBE).catch((e) => ({ err: String(e) }));
  const t0 = Date.now();
  await page.screenshot({ path, timeout: 180_000 });
  const ms = Date.now() - t0;
  const after = await page.evaluate(HUD_PROBE).catch((e) => ({ err: String(e) }));
  report.shots.push({ name, path, screenshotMs: ms, before, after, ...extra });
  save();
  log(`  shot ${name}  (${ms} ms)  dmg running ${before.dmgRunning ?? '?'}→${after.dmgRunning ?? '?'}`
    + `  visible ${before.dmgVisible ?? '?'}→${after.dmgVisible ?? '?'}  portraits ${before.portraitsRendered ?? '?'}/${before.portraitsTotal ?? '?'}`);
}

async function menuShot(page, vp, name) {
  const path = `${OUT}/${vp}_${name}.png`;
  try {
    const res = await captureSettled(page, { path, label: `${vp} ${name}`, tool: 'gx_ui_shots', enforce: false, settleTimeout: 45_000 });
    report.shots.push({ name: `${vp}_${name}`, path, painted: res.painted, stats: res.stats });
    log(`  menu ${vp}_${name} painted=${res.painted}`);
  } catch (e) {
    report.notes.push(`${vp}_${name}: captureSettled threw ${String(e).slice(0, 200)}; plain screenshot taken`);
    await page.screenshot({ path, timeout: 180_000 }).catch(() => {});
    report.shots.push({ name: `${vp}_${name}`, path, painted: null });
    log(`  menu ${vp}_${name} (fallback) ${String(e).slice(0, 120)}`);
  }
  save();
}

async function freshPage(ctx) {
  const page = await ctx.newPage();
  page.on('pageerror', (e) => report.notes.push(`pageerror: ${String(e.message).slice(0, 200)}`));
  await page.route('**/@vite/client*', (r) => r.fulfill({
    status: 200, contentType: 'text/javascript',
    body: 'const noop=()=>{};export const createHotContext=()=>({accept:noop,acceptExports:noop,dispose:noop,prune:noop,invalidate:noop,on:noop,off:noop,send:noop,decline:noop,data:{}});export const injectQuery=(u)=>u;export const updateStyle=noop;export const removeStyle=noop;export const ErrorOverlay=class{};export default {};',
  }));
  return page;
}

async function gotoRetry(page, url) {
  for (let i = 0; i < 3; i++) {
    try { await page.goto(url, { waitUntil: 'domcontentloaded', timeout: 120_000 }); return; }
    catch (e) { log(`  goto retry ${i + 1}: ${String(e).slice(0, 120)}`); await page.waitForTimeout(1500); }
  }
  throw new Error(`could not load ${url}`);
}

async function nav(page, route) {
  await page.evaluate((r) => window.__shell.navigate(r), route);
  await page.waitForFunction((n) => window.__screen === n, route.name, { timeout: 60_000 });
}

async function waitGame(page) {
  await page.waitForFunction(() => window.__gameReady === true, null, { timeout: 180_000 });
}

// Wait until slot 0 and some other living slot are within `dWu`, and a hit has landed.
async function waitContact(page, dWu, timeoutMs) {
  const t0 = Date.now();
  while (Date.now() - t0 < timeoutMs) {
    const s = await page.evaluate(() => window.__vfxDebugFighters?.slots ?? null).catch(() => null);
    if (s && s.length > 1 && s[0].alive) {
      const near = s.slice(1).some((o) => o.alive && Math.hypot(o.x - s[0].x, o.y - s[0].y) < dWu);
      if (near) return Date.now() - t0;
    }
    await page.waitForTimeout(300);
  }
  return null;
}

async function waitDmgVisible(page, timeoutMs) {
  const t0 = Date.now();
  while (Date.now() - t0 < timeoutMs) {
    const n = await page.evaluate(() => [...document.querySelectorAll('.hud-dmg')]
      .filter((e) => Number(getComputedStyle(e).opacity) > 0.3).length).catch(() => 0);
    if (n > 0) return Date.now() - t0;
    await page.waitForTimeout(80);
  }
  return null;
}

async function waitGameover(page, timeoutMs) {
  try {
    await page.waitForFunction(() => {
      const el = document.querySelector('.hud-gameover');
      return !!el && getComputedStyle(el).display !== 'none';
    }, null, { timeout: timeoutMs, polling: 250 });
    return true;
  } catch { return false; }
}

const CAST6 = ['donut', 'taco', 'hamburger', 'egg', 'sushi', 'pizza'];

async function runViewport(browser, vp) {
  log(`\n=== viewport ${vp}`);
  const ctx = await browser.newContext(VIEWPORTS[vp]);
  let center = null;
  try {
    // ── menus, in-app ───────────────────────────────────────────────────────────
    let page = await freshPage(ctx);
    await gotoRetry(page, `${BASE}/`);
    await page.waitForFunction(() => window.__screen === 'opening' || window.__screen === 'home', null, { timeout: 180_000 });
    const first = await page.evaluate(() => window.__screen);
    if (first === 'opening' && vp !== 'P') await menuShot(page, vp, 'opening');
    await page.waitForFunction(() => window.__screen === 'home', null, { timeout: 60_000 }).catch(async () => {
      await nav(page, { name: 'home' });
    });
    for (const name of MENUS[vp]) {
      if (name !== 'home') await nav(page, { name });
      if (name === 'characters') {
        const r = await waitForRoster(page, { timeout: 120_000 }).catch((e) => ({ err: String(e).slice(0, 160) }));
        report.notes.push(`${vp} roster wait: ${JSON.stringify(r)}`);
      }
      if (name === 'home') await page.waitForTimeout(5200);   // the taunt hint fades on a 4.2 s timer
      await menuShot(page, vp, name);
    }

    // ── 1v1 in-app (warm thumbnail cache), D only ─────────────────────────────────
    if (vp === 'D') {
      await nav(page, { name: 'match', player: 'donut', enemy: 'taco' });
      await waitGame(page);
      center = await page.evaluate(() => window.__matchArena?.center ? { ...window.__matchArena.center } : null);
      await page.waitForTimeout(700);
      await shot(page, `${vp}_m1_countdown`);
      const c = await waitContact(page, 170, 150_000);
      report.notes.push(`${vp} 1v1 contact after ${c} ms wall`);
      if (c !== null) {
        const v = await waitDmgVisible(page, 20_000);
        report.notes.push(`${vp} 1v1 first visible dmg after ${v} ms`);
        await shot(page, `${vp}_m1_fight_a`);
        await page.waitForTimeout(400);
        await shot(page, `${vp}_m1_fight_b`);
        await page.waitForTimeout(400);
        await shot(page, `${vp}_m1_fight_c`);
      }
    }

    // ── six seats, SHIPPED route, in-app ──────────────────────────────────────────
    await nav(page, { name: 'match', player: 'donut', enemy: 'taco', seats: 6 });
    await waitGame(page);
    if (!center) center = await page.evaluate(() => window.__matchArena?.center ? { ...window.__matchArena.center } : null);
    await page.waitForTimeout(600);
    await shot(page, `${vp}_m6_countdown`);
    await page.waitForTimeout(4500);
    await shot(page, `${vp}_m6_open`);
    await page.close();

    // ── six seats, ACTION on the QA ring (cold cache), D and L ────────────────────
    if (vp !== 'P' && center) {
      page = await freshPage(ctx);
      const RING = 150;
      const roster = CAST6.map((id, i) => {
        const a = (i / 6) * Math.PI * 2;
        return `${id}@${Math.round(center.x + Math.cos(a) * RING)},${Math.round(center.y + Math.sin(a) * RING)}`;
      }).join(';');
      await gotoRetry(page, `${BASE}/?fighters=${encodeURIComponent(roster)}&pointerLock=0`);
      await waitGame(page);
      await page.waitForTimeout(3600);
      const v = await waitDmgVisible(page, 60_000);
      report.notes.push(`${vp} ring first visible dmg after ${v} ms`);
      await shot(page, `${vp}_m6_fight_a`);
      await page.waitForTimeout(500);
      await shot(page, `${vp}_m6_fight_b`);
      await page.close();
    }

    // ── result card: six seats, shipped route via URL, sudden death ──────────────
    page = await freshPage(ctx);
    await gotoRetry(page, `${BASE}/?screen=match&player=donut&enemy=taco&seats=6&fogRadius=200&pointerLock=0`);
    await waitGame(page);
    const ok = await waitGameover(page, 150_000);
    report.notes.push(`${vp} six-seat gameover reached: ${ok}`);
    await page.waitForTimeout(1200);
    await shot(page, `${vp}_m6_result`);
    await page.close();

    if (vp === 'D') {
      page = await freshPage(ctx);
      await gotoRetry(page, `${BASE}/?screen=match&player=donut&enemy=taco&fogRadius=200&pointerLock=0`);
      await waitGame(page);
      const ok2 = await waitGameover(page, 150_000);
      report.notes.push(`${vp} 1v1 gameover reached: ${ok2}`);
      await page.waitForTimeout(1200);
      await shot(page, `${vp}_m1_result`);
      await page.close();
    }
  } catch (e) {
    report.notes.push(`${vp} ABORTED: ${String(e).slice(0, 300)}`);
    log(`  ${vp} ABORTED: ${String(e).slice(0, 300)}`);
  } finally {
    save();
    await ctx.close().catch(() => {});
  }
}

if (BASE) {
  const browser = await chromium.launch({ args: LAUNCH });
  try {
    for (const vp of ONLY) {
      // eslint-disable-next-line no-await-in-loop
      await runViewport(browser, vp);
    }
  } finally {
    report.finishedAt = new Date().toISOString();
    save();
    await browser.close().catch(() => {});
  }
  log(`\nwrote ${OUT}/report.json`);
}
