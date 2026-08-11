#!/usr/bin/env node
/**
 * LANDSCAPE MENU PLATES — home / characters / trophies / shop / settings at phone
 * landscape viewports, with `fa-touch-capable` forced.
 *
 * Uri: *"See example of homescreen, it seems like it was designed for vertical and not
 * horizontal. its the same of all game menus."* This exists to put that claim in front
 * of an eye rather than in front of an assertion — and to print, per screen, the two
 * numbers a portrait-first layout gives itself away with: how much of the frame WIDTH
 * the content column actually uses, and whether the screen SCROLLS vertically at a
 * viewport that is only ~390 px tall.
 */
import { chromium } from 'playwright';
import { mkdir } from 'node:fs/promises';

const LAUNCH = ['--use-gl=angle', '--use-angle=swiftshader', '--enable-unsafe-swiftshader',
  '--enable-webgl', '--ignore-gpu-blocklist', '--disable-gpu-sandbox'];
const a = process.argv.slice(2);
const get = (k, d) => (a.includes(k) ? a[a.indexOf(k) + 1] : d);
const BASE = (get('--url', process.env.PREVIEW_BASE) ?? 'http://localhost:5188').replace(/\/$/, '');
const OUT = get('--save', 'shots/lu/menus');
const VPS = [{ tag: 'ph-844', w: 844, h: 390 }, { tag: 'ph-667', w: 667, h: 375 }];
const SCREENS = ['home', 'characters', 'trophies', 'shop', 'settings'];

const browser = await chromium.launch({ args: LAUNCH });
await mkdir(OUT, { recursive: true });
for (const vp of VPS) {
  const ctx = await browser.newContext({ viewport: { width: vp.w, height: vp.h }, hasTouch: true, isMobile: true, deviceScaleFactor: 1 });
  for (const s of SCREENS) {
    const page = await ctx.newPage();
    const errs = [];
    page.on('pageerror', (e) => errs.push(String(e)));
    await page.goto(`${BASE}/?screen=${s}`, { waitUntil: 'domcontentloaded', timeout: 90_000 });
    await page.waitForFunction('window.__screenReady === true', null, { timeout: 90_000 }).catch(() => {});
    await page.waitForTimeout(1400);
    const m = await page.evaluate(() => {
      const doc = document.documentElement;
      // The widest painted run on the screen, and the frame it sits in.
      let minX = Infinity, maxX = -Infinity, maxBottom = 0;
      for (const el of document.querySelectorAll('body *')) {
        const st = getComputedStyle(el);
        if (st.visibility === 'hidden' || st.display === 'none' || st.opacity === '0') continue;
        const r = el.getBoundingClientRect();
        if (r.width < 4 || r.height < 4) continue;
        const paints = st.backgroundColor !== 'rgba(0, 0, 0, 0)' || st.borderTopWidth !== '0px'
          || (el.childElementCount === 0 && (el.textContent ?? '').trim().length > 0);
        if (!paints) continue;
        if (r.width >= window.innerWidth - 1 && r.height >= window.innerHeight - 1) continue; // full-bleed backdrop
        minX = Math.min(minX, r.left); maxX = Math.max(maxX, r.right);
        maxBottom = Math.max(maxBottom, r.bottom);
      }
      return {
        vw: window.innerWidth, vh: window.innerHeight,
        contentL: Math.round(minX), contentR: Math.round(maxX),
        scrollH: doc.scrollHeight, clientH: doc.clientHeight,
        scrollers: [...document.querySelectorAll('body *')]
          .filter((e) => e.scrollHeight > e.clientHeight + 2 && /auto|scroll/.test(getComputedStyle(e).overflowY))
          .map((e) => `${e.className || e.tagName}:${e.clientHeight}/${e.scrollHeight}`).slice(0, 4),
      };
    });
    const used = m.contentR - m.contentL;
    console.log(`${vp.tag} ${s.padEnd(11)} content x ${String(m.contentL).padStart(4)}..${String(m.contentR).padStart(4)} `
      + `= ${String(used).padStart(4)} px of ${m.vw} (${(100 * used / m.vw).toFixed(1)}% of width)   `
      + `page ${m.scrollH}/${m.clientH}${m.scrollH > m.clientH + 2 ? '  ⚠️ PAGE SCROLLS' : ''}`
      + `${m.scrollers.length ? `   inner scrollers: ${m.scrollers.join(', ')}` : ''}`
      + `${errs.length ? `   ERR ${errs[0]}` : ''}`);
    await page.screenshot({ path: `${OUT}/${vp.tag}-${s}.png` });
    await page.close();
  }
  await ctx.close();
}
await browser.close();
