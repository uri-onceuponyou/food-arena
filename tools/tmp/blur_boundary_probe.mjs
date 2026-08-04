#!/usr/bin/env node
/**
 * BOUNDARY PROBE — can this harness make a page lose focus?
 *
 * `src/game/input.ts` clears every held key on `window` `blur`, because the browser
 * stops delivering `keyup` once the window is no longer focused; without it a fighter
 * with a key held when the player alt-tabs runs into a wall until they come back.
 * `src/game/pointerLock.ts` pauses the match on the same signal.
 *
 * Neither can be tested with a REAL focus change, and this is the measurement that
 * says so. Three mechanisms, on a page with nothing in it:
 *
 *     same-context tab switch (page.bringToFront)      blur events: 0, hasFocus: true
 *     cross-context bringToFront                       blur events: 0, hasFocus: true
 *     CDP Emulation.setFocusEmulationEnabled:false     blur events: 0, hasFocus: true
 *
 * Playwright's Chromium gives every page permanent focus. This is the sibling of the
 * pointer-lock refusal in `docs/LESSONS.md` §10 — a capability the harness simply does
 * not have — and it is why `tools/tmp/input_accept.mjs` dispatches the blur event
 * rather than provoking one, and says so in its own output.
 *
 * Run: node tools/tmp/blur_boundary_probe.mjs
 */
import { chromium } from 'playwright';

const LAUNCH = ['--use-gl=angle', '--use-angle=swiftshader', '--enable-unsafe-swiftshader',
  '--enable-webgl', '--ignore-gpu-blocklist', '--disable-gpu-sandbox'];

const b = await chromium.launch({ args: LAUNCH });
const ctx = await b.newContext({ viewport: { width: 800, height: 500 } });
const p1 = await ctx.newPage();
await p1.goto('data:text/html,<h1>one</h1>');
await p1.evaluate(() => {
  window.__b = 0;
  window.addEventListener('blur', () => window.__b++);
});
const state = async (label) =>
  console.log(`${label.padEnd(46)} blur events: ${await p1.evaluate('window.__b')}, ` +
    `hasFocus: ${await p1.evaluate('document.hasFocus()')}, ` +
    `visibility: ${await p1.evaluate('document.visibilityState')}`);

await state('baseline');

const p2 = await ctx.newPage();
await p2.goto('data:text/html,<h1>two</h1>');
await p2.bringToFront();
await p1.waitForTimeout(500);
await state('same-context tab switch');
await p2.close();

const ctx2 = await b.newContext();
const p3 = await ctx2.newPage();
await p3.goto('data:text/html,<h1>three</h1>');
await p3.bringToFront();
await p1.waitForTimeout(500);
await state('cross-context bringToFront');

const cdp = await ctx.newCDPSession(p1);
await cdp.send('Emulation.setFocusEmulationEnabled', { enabled: false }).catch((e) => console.log('  cdp:', e.message));
await p1.waitForTimeout(400);
await state('Emulation.setFocusEmulationEnabled:false');

await b.close();
