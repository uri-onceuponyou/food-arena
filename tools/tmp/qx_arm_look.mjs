#!/usr/bin/env node
/** qx_arm_look — LOOK at the confirm during and after the 350ms arming window.
 *  A safety that reads as a broken button is a bug report, so this has to be seen. */
import { chromium } from 'playwright';
import { mkdir } from 'node:fs/promises';
const A = process.argv.slice(2);
const g = (k, d) => (A.includes(k) ? A[A.indexOf(k) + 1] : d);
const base = g('--url', process.env.PREVIEW_BASE);
const out = g('--out', 'tools/tmp/qx_shots');
await mkdir(out, { recursive: true });
const b = await chromium.launch({ args: ['--use-gl=angle','--use-angle=swiftshader','--enable-unsafe-swiftshader','--enable-webgl','--ignore-gpu-blocklist','--disable-gpu-sandbox'] });
for (const vp of [{ n: 'portrait-390x844', w: 390, h: 844, s: { t: 47, r: 0, b: 34, l: 0 } },
                  { n: 'land-844x390', w: 844, h: 390, s: { t: 0, r: 44, b: 21, l: 44 } }]) {
  const ctx = await b.newContext({ viewport: { width: vp.w, height: vp.h }, deviceScaleFactor: 2, hasTouch: true });
  const page = await ctx.newPage();
  await page.addInitScript((s) => {
    const st = document.createElement('style');
    st.textContent = `:root{--fa-safe-t:${s.t}px;--fa-safe-r:${s.r}px;--fa-safe-b:${s.b}px;--fa-safe-l:${s.l}px;}`;
    document.addEventListener('DOMContentLoaded', () => document.head.appendChild(st));
  }, vp.s);
  await page.goto(`${base}?screen=match&player=hamburger&enemy=donut&seats=6&pointerLock=0`, { waitUntil: 'domcontentloaded' });
  await page.waitForFunction(() => window.__matchDebug?.phase === 'playing', null, { timeout: 90000 });
  await page.waitForTimeout(800);
  await page.click('.fa-match .match-chip');
  await page.waitForFunction(() => document.querySelector('.match-sheet')?.classList.contains('is-open'), null, { timeout: 8000 });
  // Freeze the arming timer so the DISABLED frame can be captured deterministically.
  await page.evaluate(() => { window.__qxFreeze = window.setTimeout; window.setTimeout = () => 0; });
  await page.click('[data-el="quit"]');
  await page.waitForTimeout(180);
  console.log(`${vp.n} disabled=${await page.evaluate(() => document.querySelector('[data-el="leave"]').disabled)}`);
  await page.screenshot({ path: `${out}/${vp.n}-arming-disabled.png` });
  await page.evaluate(() => { document.querySelector('[data-el="leave"]').disabled = false; });
  await page.waitForTimeout(400);
  await page.screenshot({ path: `${out}/${vp.n}-arming-live.png` });
  await ctx.close();
}
await b.close();
console.log('done');
