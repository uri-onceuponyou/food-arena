#!/usr/bin/env node
/**
 * Shoot the game-over card in both of its endings.
 *
 * `sim.ts` now ends a match that runs out of clock, WITHOUT a death — `resolveTimeout`
 * picks a winner and leaves both fighters `alive`. The card used to read "X defeated Y"
 * either way, which is untrue of the timeout. Driving a real timeout through the game
 * needs immortal fighters and a whole clock; the card is pure DOM, so the harness
 * reaches both endings in ~2 s.
 *
 *   node tools/tmp/goshot.mjs <snapshot-url>
 */
import { chromium } from 'playwright';
const BASE = process.argv[2];
const b = await chromium.launch();
const p = await b.newPage({ viewport: { width: 1280, height: 720 }, deviceScaleFactor: 1 });
await p.goto(`${BASE}/tools/tmp/hud_harness.html`, { waitUntil: 'load' });
await p.waitForFunction(() => window.__harnessReady === true, null, { timeout: 30000 });
for (const [tag, o] of [
  ['ko',      { phase: 'ended', winner: 'player', safeRadius: 300, maxSafeRadius: 993, php: 42, ehp: 0,   timeRemaining: 21000 }],
  ['timeout', { phase: 'ended', winner: 'player', safeRadius: 140, maxSafeRadius: 993, php: 61, ehp: 74,  timeRemaining: 0 }],
]) {
  await p.evaluate((x) => window.__hudSet(x), o);
  await p.waitForTimeout(250);
  const el = await p.$('.hud-gameover-card');
  await el.screenshot({ path: `shots/radar/gameover-${tag}.png` });
  console.log(tag, JSON.stringify(await p.evaluate(() => ({
    sub: document.querySelector('[data-el="gameover-subtitle"]').textContent,
    stats: document.querySelector('[data-el="gameover-stats"]').textContent,
  }))));
}
await b.close();
