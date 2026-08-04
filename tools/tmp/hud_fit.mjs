#!/usr/bin/env node
/**
 * Does the top-centre zone pill actually CONTAIN its own text, on every supported
 * viewport and in every state it can be in?
 *
 * Found by looking at a rendered danger frame: "-50 HP/s" sits partly OUTSIDE the
 * pill's rounded plate, on raw world pixels. That plate was made opaque on purpose
 * (hud.ts: a translucent one let the boiling pot's hazard ring read through a zone
 * readout) and text that overflows it defeats exactly that fix.
 *
 * Reports, per viewport and state: the row's overflow in px, and the horizontal gap
 * from the pill to each nameplate — because the obvious fix is to let the pill grow,
 * and growth is only safe if there is room.
 *
 *   node tools/tmp/hud_fit.mjs --url <base>
 */
import { chromium } from 'playwright';

const args = process.argv.slice(2);
const arg = (k, d = null) => { const i = args.indexOf(k); return i >= 0 ? args[i + 1] : d; };
const BASE = arg('--url', 'http://localhost:5173');

const VIEWPORTS = [
  { name: 'desktop-16:9', width: 1600, height: 900 },
  { name: 'laptop-16:10', width: 1280, height: 800 },
  { name: 'tablet-4:3', width: 1024, height: 768 },
  { name: 'phone-19.5:9', width: 844, height: 390 },
  { name: 'ultrawide-21:9', width: 2560, height: 1080 },
];

// px,py chosen against the 45 s schedule: centre = inside and "FINAL RING",
// mid-radius = a live countdown, far corner = the danger state.
const STATES = [
  { name: 'inside/countdown', px: 700, py: 900, safeRadius: 745 },
  { name: 'inside/final-ring', px: 700, py: 500, safeRadius: 140 },
  { name: 'outside/danger', px: 120, py: 120, safeRadius: 497 },
];

const browser = await chromium.launch();
let worst = 0;
for (const vp of VIEWPORTS) {
  const page = await browser.newPage({ viewport: { width: vp.width, height: vp.height }, deviceScaleFactor: 1 });
  await page.goto(`${BASE}/tools/tmp/hud_harness.html`, { waitUntil: 'load' });
  await page.waitForFunction(() => window.__harnessReady === true, null, { timeout: 30000 });
  for (const st of STATES) {
    await page.evaluate((o) => window.__hudSet(o), { ...st, maxSafeRadius: 993, arenaW: 1400, arenaH: 1000, timeRemaining: 20000, elapsed: 25000 });
    const m = await page.evaluate(() => {
      const row = document.querySelector('.hud-zone-row');
      const pill = document.querySelector('.hud-zone');
      const p = document.querySelector('.hud-fighter--player').getBoundingClientRect();
      const e = document.querySelector('.hud-fighter--enemy').getBoundingClientRect();
      const z = pill.getBoundingClientRect();
      return {
        overflow: row.scrollWidth - row.clientWidth,
        pillW: Math.round(z.width),
        gapL: Math.round(z.left - p.right),
        gapR: Math.round(e.left - z.right),
        label: document.querySelector('[data-el="zone-label"]').textContent,
        value: document.querySelector('[data-el="zone-value"]').textContent,
      };
    }, st);
    worst = Math.max(worst, m.overflow);
    console.log(
      `${vp.name.padEnd(15)} ${st.name.padEnd(18)} overflow=${String(m.overflow).padStart(3)}px  ` +
        `pill=${String(m.pillW).padStart(3)}px  gapL=${String(m.gapL).padStart(4)}  gapR=${String(m.gapR).padStart(4)}  ` +
        `"${m.label}" / "${m.value}"`
    );
  }
  await page.close();
}
console.log(`\nworst overflow = ${worst}px  (0 required)`);
await browser.close();
process.exit(worst > 0 ? 1 : 0);
