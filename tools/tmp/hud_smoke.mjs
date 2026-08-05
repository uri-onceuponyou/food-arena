#!/usr/bin/env node
/** Boots through the real menus into a live match, drives real input for a few
 *  seconds, and screenshots the HUD. Confirms the game still starts and plays. */
import { chromium } from 'playwright';

const browser = await chromium.launch();
const page = await browser.newPage({ viewport: { width: 1400, height: 840 }, deviceScaleFactor: 1 });
const errs = [];
page.on('console', (m) => { if (m.type() === 'error') errs.push(m.text()); });
page.on('pageerror', (e) => errs.push(String(e)));

await page.goto('http://localhost:5173/', { waitUntil: 'load' });
await page.waitForTimeout(1200);
await page.$eval('.fa-tab[data-go="characters"]', (el) => el.click());
await page.waitForFunction(() => window.__thumbsReady === true, null, { timeout: 40000 }).catch(() => {});
await page.waitForTimeout(500);
await page.$eval('[data-el="fight"]', (el) => el.click());
await page.waitForFunction(() => window.__gameReady === true, null, { timeout: 40000 });

// Real input: walk, aim, fire, switch weapons. The point is to prove the match runs,
// not to look pretty.
await page.mouse.move(900, 400);
for (const k of ['KeyW', 'KeyD', 'Digit2', 'Digit3', 'Digit4', 'Digit1']) {
  await page.keyboard.down(k);
  await page.waitForTimeout(180);
  await page.keyboard.up(k);
}
await page.mouse.click(960, 430);
await page.waitForTimeout(4200);
await page.mouse.move(1000, 380);
await page.mouse.down(); await page.waitForTimeout(500); await page.mouse.up();
await page.waitForTimeout(1500);

const state = await page.evaluate(() => {
  const slots = document.querySelectorAll('.hud-weapon-slot');
  return {
    phase: document.querySelector('.hud-countdown')?.style.display,
    slots: slots.length,
    slotIcons: [...slots].map((s) => !!s.querySelector('.hud-weapon-emoji svg')),
    badges: document.querySelectorAll('.hud-fighter-emoji .fa-ic-portrait.has-render').length,
    floats: document.querySelectorAll('.hud-float-emoji .fa-ic-portrait.has-render').length,
    hudPointerEvents: getComputedStyle(document.querySelector('.hud-root')).pointerEvents,
  };
});
console.log(JSON.stringify(state));
await page.screenshot({ path: 'shots/icons/screens/hud.png' });
if (errs.length) console.log('CONSOLE ERRORS:\n' + errs.join('\n'));
else console.log('no console errors');
await browser.close();
