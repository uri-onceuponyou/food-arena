#!/usr/bin/env node
/**
 * qx_look — LOOK at the in-match exit affordance. Exploration, not a gate.
 *
 * Boots a SIX-seat match (CLAUDE.md / AGENT-BRIEF §4b: two seats cannot express this
 * project's dominant defect class) at phone portrait and phone landscape, waits for the
 * match to actually be PLAYING, and captures:
 *   1-live    the live frame, chip in place
 *   2-paused  after one tap on the chip
 *   3-home    after Quit to Home
 *
 * Insets are injected the way menu_accept_portrait.mjs injects them, because a
 * desktop Chromium reports env(safe-area-inset-*) = 0 and the chip is positioned off
 * --fa-safe-t.
 */
import { chromium } from 'playwright';
import { mkdir } from 'node:fs/promises';

const A = process.argv.slice(2);
const get = (k, d) => (A.includes(k) ? A[A.indexOf(k) + 1] : d);
const base = get('--url', process.env.PREVIEW_BASE ?? 'http://localhost:5173');
const out = get('--out', 'tools/tmp/qx_shots');
const LAUNCH = ['--use-gl=angle','--use-angle=swiftshader','--enable-unsafe-swiftshader','--enable-webgl','--ignore-gpu-blocklist','--disable-gpu-sandbox'];

const VPS = [
  { name: 'portrait-390x844', w: 390, h: 844, safe: { t: 47, r: 0, b: 34, l: 0 }, touch: true },
  { name: 'land-844x390', w: 844, h: 390, safe: { t: 0, r: 44, b: 21, l: 44 }, touch: true },
];

const URLQ = 'screen=match&player=hamburger&enemy=donut&seats=6';

await mkdir(out, { recursive: true });
const browser = await chromium.launch({ args: LAUNCH });

for (const vp of VPS) {
  const ctx = await browser.newContext({
    viewport: { width: vp.w, height: vp.h },
    deviceScaleFactor: 2,
    hasTouch: vp.touch,
    isMobile: false,
  });
  const page = await ctx.newPage();
  await page.addInitScript(({ s }) => {
    const st = document.createElement('style');
    st.textContent = `:root{--fa-safe-t:${s.t}px;--fa-safe-r:${s.r}px;--fa-safe-b:${s.b}px;--fa-safe-l:${s.l}px;}`;
    document.addEventListener('DOMContentLoaded', () => document.head.appendChild(st));
  }, { s: vp.safe });
  page.on('pageerror', (e) => console.log(`  [pageerror ${vp.name}] ${e.message}`));

  await page.goto(`${base}?${URLQ}`, { waitUntil: 'domcontentloaded' });
  // Wait for the match to be PLAYING, not merely mounted.
  await page.waitForFunction(() => window.__matchDebug?.phase === 'playing', null, { timeout: 60_000 });
  await page.waitForTimeout(1200);

  const dbg = await page.evaluate(() => ({
    phase: window.__matchDebug?.phase,
    paused: window.__matchDebug?.paused,
    frames: window.__matchDebug?.frames,
    fighters: window.__matchDebug?.fighters?.length ?? null,
    chip: (() => { const b = document.querySelector('.match-chip')?.getBoundingClientRect(); return b && { x: Math.round(b.x), y: Math.round(b.y), w: Math.round(b.width), h: Math.round(b.height) }; })(),
    touchClass: document.documentElement.classList.contains('fa-touch-capable'),
  }));
  console.log(`${vp.name}: ${JSON.stringify(dbg)}`);
  await page.screenshot({ path: `${out}/${vp.name}-1-live.png` });

  await page.click('.match-chip');
  await page.waitForTimeout(500);
  const paused = await page.evaluate(() => ({
    paused: window.__matchDebug?.paused,
    sheetOpen: document.querySelector('.match-sheet')?.classList.contains('is-open'),
  }));
  console.log(`  after chip tap: ${JSON.stringify(paused)}`);
  await page.screenshot({ path: `${out}/${vp.name}-2-paused.png` });

  await page.click('[data-el="quit"]');
  await page.waitForTimeout(400);
  const conf = await page.evaluate(() => {
    const r = (s) => { const b = document.querySelector(s); if (!b) return null; const x = b.getBoundingClientRect(); return { x: Math.round(x.x), y: Math.round(x.y), w: Math.round(x.width), h: Math.round(x.height) }; };
    return { quit: r('[data-el="quit"]'), leave: r('[data-el="leave"]'), keep: r('[data-el="keep"]'),
             card: r('.match-sheet-card'), pauseHidden: document.querySelector('[data-el="pane-pause"]').hidden };
  });
  console.log(`  confirm: ${JSON.stringify(conf)}`);
  await page.screenshot({ path: `${out}/${vp.name}-2b-confirm.png` });

  await page.click('[data-el="leave"]');
  await page.waitForTimeout(900);
  const after = await page.evaluate(() => ({
    screen: document.querySelector('[class*="fa-screen"]')?.className,
    matchDebug: window.__matchDebug === undefined ? 'deleted' : 'STILL PRESENT',
    canvases: document.querySelectorAll('canvas').length,
    matchRoot: document.querySelectorAll('.fa-match').length,
    hud: document.querySelectorAll('.hud-root, .hud-topbar').length,
  }));
  console.log(`  after quit: ${JSON.stringify(after)}`);
  await page.screenshot({ path: `${out}/${vp.name}-3-home.png` });

  await ctx.close();
}
await browser.close();
console.log('done');
