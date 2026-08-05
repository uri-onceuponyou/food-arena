#!/usr/bin/env node
/**
 * Does the weapon tray still FIT after the phone icon went 20px -> 24px?
 *
 * The change is one number in a media query, which is exactly the kind of change that
 * gets shipped unverified. The failure modes are all geometric, so all of them are
 * measurable: a glyph overflowing its 46px slot, the tray overflowing the viewport, the
 * page acquiring a horizontal scroll, or the tray colliding with the radar on a short
 * phone (there is a `max-height: 640px` rule that exists because of exactly that).
 *
 *   node tools/tmp/tray_fit.mjs --url http://localhost:5188 [--save shots/tier/tray]
 *
 * Exits 1 on any overflow or collision.
 */
import { chromium } from 'playwright';
import { mkdir } from 'node:fs/promises';

const LAUNCH_ARGS = ['--use-gl=angle', '--use-angle=swiftshader', '--enable-unsafe-swiftshader',
  '--enable-webgl', '--ignore-gpu-blocklist', '--disable-gpu-sandbox'];
const a = process.argv;
const get = (k, d) => (a.includes(k) ? a[a.indexOf(k) + 1] : d);
const base = get('--url', 'http://localhost:5188').replace(/\/$/, '');
const save = get('--save', null);

// The five `menu_accept` viewports, so a pass here is a pass on the same set the menus
// are held to. Three of them are under the 720px media query that carries the 24px.
const VIEWPORTS = [
  { name: 'desktop-16:9', width: 1600, height: 900 },
  { name: 'laptop-16:10', width: 1280, height: 800 },
  { name: 'tablet-4:3', width: 1024, height: 768 },
  { name: 'phone-19.5:9', width: 844, height: 390 },
  { name: 'phone-portrait', width: 390, height: 844 },
];

const browser = await chromium.launch({ args: LAUNCH_ARGS });
if (save) await mkdir(save, { recursive: true });
let failures = 0;

for (const v of VIEWPORTS) {
  const ctx = await browser.newContext({ viewport: { width: v.width, height: v.height } });
  const page = await ctx.newPage();
  page.on('pageerror', (e) => console.error('PAGEERROR', String(e)));
  await page.route('**/@vite/client*', (r) => r.fulfill({
    status: 200, contentType: 'text/javascript',
    body: 'const noop=()=>{};export const createHotContext=()=>({accept:noop,acceptExports:noop,dispose:noop,prune:noop,invalidate:noop,on:noop,off:noop,send:noop,decline:noop,data:{}});export const injectQuery=(u)=>u;export const updateStyle=noop;export const removeStyle=noop;export const ErrorOverlay=class{};export default {};',
  }));
  await page.goto(`${base}/?player=hamburger&enemy=donut&simSpeed=0.02&pointerLock=0`,
    { waitUntil: 'domcontentloaded', timeout: 90_000 });
  await page.waitForFunction('window.__gameReady === true', null, { timeout: 120_000 });
  await page.waitForTimeout(600);

  const m = await page.evaluate(() => {
    const tray = document.querySelector('.hud-weapons');
    const slots = [...document.querySelectorAll('.hud-weapon-slot')];
    const glyphs = [...document.querySelectorAll('.hud-weapon-emoji')];
    const radar = document.querySelector('.hud-radar');
    const t = tray.getBoundingClientRect();
    const r = radar?.getBoundingClientRect();
    let worst = 0;
    const per = slots.map((s, i) => {
      const sb = s.getBoundingClientRect();
      const g = glyphs[i]?.getBoundingClientRect();
      // Overflow of the glyph box out of the slot box, on any edge.
      const over = g ? Math.max(sb.left - g.left, sb.top - g.top, g.right - sb.right, g.bottom - sb.bottom) : 0;
      worst = Math.max(worst, over);
      return {
        slot: `${Math.round(sb.width)}x${Math.round(sb.height)}`,
        glyph: g ? `${Math.round(g.width)}x${Math.round(g.height)}` : 'none',
        fontPx: glyphs[i] ? parseFloat(getComputedStyle(glyphs[i]).fontSize) : 0,
        padPx: g ? +((sb.width - g.width) / 2).toFixed(1) : 0,
      };
    });
    return {
      slots: per,
      worstGlyphOverflow: +worst.toFixed(2),
      trayW: Math.round(t.width),
      trayLeft: Math.round(t.left),
      trayRight: Math.round(t.right),
      viewportW: window.innerWidth,
      viewportH: window.innerHeight,
      offLeft: +Math.max(0, -t.left).toFixed(1),
      offRight: +Math.max(0, t.right - window.innerWidth).toFixed(1),
      offBottom: +Math.max(0, t.bottom - window.innerHeight).toFixed(1),
      docScroll: document.documentElement.scrollWidth - document.documentElement.clientWidth,
      // Positive means the tray and the radar overlap.
      radarOverlap: r ? +Math.min(t.right - r.left, r.right - t.left).toFixed(1) : null,
      radarVertOverlap: r ? +Math.min(t.bottom - r.top, r.bottom - t.top).toFixed(1) : null,
    };
  });

  const overlaps = m.radarOverlap !== null && m.radarOverlap > 0 && m.radarVertOverlap > 0;
  const bad = m.worstGlyphOverflow > 0.5 || m.offLeft > 0 || m.offRight > 0 || m.offBottom > 0
    || m.docScroll > 0 || overlaps;
  if (bad) failures++;
  console.log(`${bad ? 'FAIL' : 'PASS'}  ${v.name.padEnd(15)} ${v.width}x${v.height}`);
  console.log(`        slot ${m.slots[0].slot}  glyph ${m.slots[0].glyph} @ ${m.slots[0].fontPx}px  padding ${m.slots[0].padPx}px/side  glyph overflow ${m.worstGlyphOverflow}px`);
  console.log(`        tray ${m.trayW}px at x ${m.trayLeft}..${m.trayRight} of ${m.viewportW}  off-screen L/R/B ${m.offLeft}/${m.offRight}/${m.offBottom}  doc h-scroll ${m.docScroll}px  radar overlap ${overlaps ? `${m.radarOverlap}x${m.radarVertOverlap}` : 'none'}`);

  if (save) await page.screenshot({ path: `${save}/${v.name}.png` });
  await ctx.close();
}

await browser.close();
console.log(failures ? `\n${failures} viewport(s) FAILED` : `\nall ${VIEWPORTS.length} viewports fit`);
process.exit(failures ? 1 : 0);
