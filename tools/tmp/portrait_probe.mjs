#!/usr/bin/env node
/**
 * THROWAWAY probe — what actually overflows a PORTRAIT phone on the menus?
 *
 * `tools/tmp/menu_accept.mjs`'s five viewports are all LANDSCAPE, which is exactly why
 * a portrait defect survived 315 assertions. This reports, per screen at 430x932: the
 * document's scroll overflow, and every element whose box crosses the viewport edge,
 * innermost first — the innermost one is the thing that is actually too wide, and its
 * ancestors are just being dragged along by it.
 */
import { chromium } from 'playwright';

const LAUNCH_ARGS = ['--use-gl=angle', '--use-angle=swiftshader', '--enable-unsafe-swiftshader',
  '--enable-webgl', '--ignore-gpu-blocklist', '--disable-gpu-sandbox'];
const argv = process.argv;
const get = (k, d) => (argv.includes(k) ? argv[argv.indexOf(k) + 1] : d);
const BASE = get('--url', process.env.PREVIEW_BASE ?? 'http://localhost:5173');
const SCREENS = get('--screens', 'home,characters,trophies,settings,opening').split(',');
const W = Number(get('--w', 430));
const H = Number(get('--h', 932));

const REPORT = () => {
  const de = document.documentElement;
  const vw = de.clientWidth;
  const vh = de.clientHeight;
  const bad = [];
  for (const el of document.querySelectorAll('.fa-root *')) {
    const r = el.getBoundingClientRect();
    if (r.width < 2 && r.height < 2) continue;
    const overR = r.right - vw;
    const overL = -r.left;
    const overB = r.bottom - vh;
    if (overR > 1 || overL > 1 || overB > 1) {
      bad.push({
        cls: (typeof el.className === 'string' ? el.className : '').slice(0, 46),
        tag: el.tagName.toLowerCase(),
        text: (el.textContent || '').trim().slice(0, 22),
        w: Math.round(r.width), h: Math.round(r.height),
        overR: Math.round(overR), overL: Math.round(overL), overB: Math.round(overB),
        depth: (() => { let d = 0, n = el; while (n.parentElement) { d++; n = n.parentElement; } return d; })(),
      });
    }
  }
  bad.sort((a, b) => b.depth - a.depth);
  // Controls under the 44px tap minimum, since a squeezed portrait is where that breaks.
  const small = [...document.querySelectorAll('.fa-root button:not([disabled])')]
    .map((el) => ({ el, r: el.getBoundingClientRect() }))
    .filter(({ r }) => r.width > 0 && r.height > 0 && (r.width < 43.5 || r.height < 43.5))
    .map(({ el, r }) => `${(typeof el.className === 'string' ? el.className : '').split(' ')[0]} ${Math.round(r.width)}x${Math.round(r.height)}`);
  return {
    scroll: `${de.scrollWidth}x${de.scrollHeight} vs ${vw}x${vh}`,
    overflowX: de.scrollWidth > vw + 1,
    overflowY: de.scrollHeight > vh + 1,
    bad: bad.slice(0, 12),
    small,
  };
};

const browser = await chromium.launch({ args: LAUNCH_ARGS });
for (const screen of SCREENS) {
  const page = await browser.newPage({ viewport: { width: W, height: H }, deviceScaleFactor: 1 });
  try {
    await page.goto(`${BASE}/?screen=${screen}`, { waitUntil: 'networkidle', timeout: 120000 });
    await page.waitForFunction(`window.__screen === "${screen}" && window.__screenReady === true`, null, { timeout: 120000 });
    await page.waitForTimeout(1500);
    const r = await page.evaluate(REPORT);
    console.log(`\n── ${screen} @ ${W}x${H} ── scroll ${r.scroll}  overflowX=${r.overflowX} overflowY=${r.overflowY}`);
    for (const b of r.bad) {
      console.log(`   ${b.tag}.${b.cls.padEnd(30)} ${String(b.w).padStart(4)}x${String(b.h).padStart(3)}`
        + `  R+${b.overR} L+${b.overL} B+${b.overB}  "${b.text}"`);
    }
    if (r.small.length) console.log(`   tap<44: ${r.small.join(' | ')}`);
    if (!r.bad.length && !r.small.length) console.log('   clean');
  } catch (e) {
    console.error(`✗ ${screen}: ${e}`);
  } finally {
    await page.close();
  }
}
await browser.close();
