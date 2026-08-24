#!/usr/bin/env node
/**
 * TROPHY ROAD — RENDERED, at the viewports Uri actually holds.
 *
 * The road went 34 nodes to 45 and its span went 3,200 to 10,000. Every structural
 * claim about that is asserted in `economy.test.mjs`, and **not one of those assertions
 * can see whether the screen still reads.** `CLAUDE.md` non-negotiable 3: judge rendered
 * pixels, and read the PNG with the Read tool.
 *
 * Three states, because the road looks completely different in each and only one of them
 * is what a test player sees first:
 *   fresh      0 trophies — 44 of 45 nodes unreachable, pin at the far left
 *   mid        2,400 trophies — the old road's ENTIRE length, now a quarter of the way
 *   late       9,200 trophies — the capstone bundle and the final chef in view
 *
 * Viewports are the shipped acceptance sets, not invented ones: portrait from
 * `menu_accept_portrait.mjs`, landscape from `menu_accept.mjs`.
 *
 * ⚠️ WAITS GO THROUGH `settle.mjs`. `window.__screenReady` is set in the same tick the
 * curtain drops, while `fa-screen-in` is still running — a screenshot on the flag alone
 * catches a screen mid-fade at `translateY(10px) scale(0.992)`.
 *
 * Usage:
 *   node tools/tmp/with_snapshot.mjs -- node tools/tmp/tr_road_shot.mjs --url '{URL}'
 */

import { chromium } from 'playwright';
import { mkdirSync } from 'node:fs';
import { settleScreen } from './settle.mjs';

const argv = process.argv;
const get = (k, d) => (argv.includes(k) ? argv[argv.indexOf(k) + 1] : d);
const BASE = process.env.PREVIEW_BASE ?? get('--url', null);
if (!BASE) { console.error('tr_road_shot: need PREVIEW_BASE or --url'); process.exit(2); }
const OUTDIR = get('--out', 'tools/tmp/tr_road_shots');
mkdirSync(OUTDIR, { recursive: true });

const GL = ['--use-gl=angle', '--use-angle=swiftshader', '--enable-unsafe-swiftshader',
  '--enable-webgl', '--ignore-gpu-blocklist', '--disable-gpu-sandbox'];

const VIEWPORTS = [
  { name: 'portrait-390x844', width: 390, height: 844 },   // iPhone 14/15/16
  { name: 'portrait-360x800', width: 360, height: 800 },   // narrowest common Android
  { name: 'landscape-844x390', width: 844, height: 390 },  // the same phone, turned
];

/**
 * The three standings. `claimed` is left EMPTY on purpose rather than back-filled:
 * that is exactly the state an existing save lands in after this reshape (every old
 * threshold moved, so `deserialize` drops every claim), so these captures are what a
 * real returning player sees — a road of claimable gold nodes behind the pin.
 */
const STATES = [
  { name: 'fresh', trophies: 0 },
  { name: 'mid', trophies: 2400 },
  { name: 'late', trophies: 9200 },
];

const STORAGE_KEY = 'food-arena.profile.v1';

const browser = await chromium.launch({ args: GL });
const results = [];
try {
  for (const vp of VIEWPORTS) {
    for (const st of STATES) {
      const page = await browser.newPage({
        viewport: { width: vp.width, height: vp.height },
        deviceScaleFactor: 2,
      });
      // Seed BEFORE any app code runs. `addInitScript` rather than an `evaluate` after
      // load: `page.evaluate` grants transient user activation, and a probe that hands
      // the app a gesture it never received is how an audio no-tap control once reported
      // the theme playing with nothing tapped (`AGENT-BRIEF §3`).
      await page.addInitScript(([key, trophies]) => {
        localStorage.setItem(key, JSON.stringify({
          name: 'Chef', wins: 0, losses: 0, xp: 0, selected: 'hamburger',
          economy: { trophies, bestTrophies: trophies, coins: 3000, gems: 40, claimed: [] },
        }));
      }, [STORAGE_KEY, st.trophies]);
      await page.route('**/@vite/client', (r) => r.fulfill({
        status: 200,
        contentType: 'application/javascript',
        body: 'export const createHotContext=()=>({accept(){},dispose(){},on(){},off(){},'
          + 'send(){},invalidate(){},prune(){},acceptExports(){},data:{}});'
          + 'export const injectQuery=(u)=>u;export const updateStyle=()=>{};'
          + 'export const removeStyle=()=>{};export const ErrorOverlay=class{};export default {};',
      }));
      await page.goto(`${BASE}/?screen=trophies`, { waitUntil: 'load', timeout: 120000 });
      await page.waitForFunction(
        'window.__screen === "trophies" && window.__screenReady === true',
        null, { timeout: 180000 },
      );
      await settleScreen(page, { label: `trophies/${vp.name}/${st.name}`, timeout: 20000 });

      // Measure the road BEFORE the screenshot, page-side, one evaluate, last.
      const m = await page.evaluate(() => {
        const road = document.querySelector('.fa-tr [class*="road"], .tr-roadtrack')?.parentElement
          ?? document.querySelector('.tr-roadtrack')?.parentElement;
        const track = document.querySelector('.tr-roadtrack');
        const nodes = [...document.querySelectorAll('.tr-node')];
        const pin = document.querySelector('[data-el="pin"]');
        const r = (e) => { const b = e.getBoundingClientRect(); return [b.width, b.height, b.left, b.top]; };
        return {
          nodes: nodes.length,
          claimable: document.querySelectorAll('.tr-node.is-claimable').length,
          trackW: track ? track.scrollWidth : -1,
          scrollerW: road ? road.clientWidth : -1,
          scrollLeft: road ? road.scrollLeft : -1,
          pinLeft: pin ? pin.offsetLeft : -1,
          nodeBox: nodes.length ? r(nodes[0]) : null,
          minNodeW: nodes.length ? Math.min(...nodes.map((n) => n.getBoundingClientRect().width)) : -1,
          minNodeH: nodes.length ? Math.min(...nodes.map((n) => n.getBoundingClientRect().height)) : -1,
          docOverflowX: document.documentElement.scrollWidth - document.documentElement.clientWidth,
        };
      });
      const out = `${OUTDIR}/${vp.name}-${st.name}.png`;
      await page.screenshot({ path: out });
      results.push({ vp: vp.name, state: st.name, out, ...m });
      console.log(`${vp.name.padEnd(18)} ${st.name.padEnd(6)} nodes=${String(m.nodes).padStart(2)}`
        + ` claimable=${String(m.claimable).padStart(2)}`
        + ` track=${String(m.trackW).padStart(5)}px scroller=${String(m.scrollerW).padStart(4)}px`
        + ` pin@${String(m.pinLeft).padStart(5)} minNode=${m.minNodeW.toFixed(0)}x${m.minNodeH.toFixed(0)}`
        + ` pageOverflowX=${m.docOverflowX}`);
      await page.close();
    }
  }
} finally {
  await browser.close();
}

// ── The two things that would make this screen BROKEN rather than merely long ──
// Both are asserted rather than eyeballed, because both are invisible in a screenshot
// that only shows the left end of a 9,000-px track.
let bad = 0;
if (results.length === 0) { console.log('\nFAULT: no captures — nothing was measured'); bad++; }
for (const r of results) {
  if (r.docOverflowX > 0) { console.log(`FAULT ${r.vp}/${r.state}: the PAGE scrolls sideways by ${r.docOverflowX}px`); bad++; }
  if (r.nodes === 0) { console.log(`FAULT ${r.vp}/${r.state}: no nodes rendered`); bad++; }
  if (r.minNodeW < 44 || r.minNodeH < 44) {
    console.log(`FAULT ${r.vp}/${r.state}: a node is ${r.minNodeW.toFixed(0)}x${r.minNodeH.toFixed(0)}, under the 44px tap floor`);
    bad++;
  }
}
console.log(bad === 0 ? '\nNo layout faults.' : `\n${bad} layout fault(s).`);
process.exitCode = bad === 0 ? 0 : 1;
