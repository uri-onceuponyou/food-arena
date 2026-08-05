#!/usr/bin/env node
/** Drives the real menu flow and captures each screen, waiting on the roster
 *  portrait cache so an icon plate is never shot mid-upgrade. */
import { chromium } from 'playwright';
import { mkdir } from 'node:fs/promises';

const args = Object.fromEntries(
  process.argv.slice(2).reduce((acc, v, i, a) => (v.startsWith('--') ? [...acc, [v.slice(2), a[i + 1]]] : acc), []),
);
const dir = args.out ?? 'shots/icons/screens';
const w = Number(args.w ?? 1400);
const h = Number(args.h ?? 840);
await mkdir(dir, { recursive: true });

const browser = await chromium.launch();
const page = await browser.newPage({ viewport: { width: w, height: h }, deviceScaleFactor: 1 });
const errs = [];
page.on('console', (m) => { if (m.type() === 'error') errs.push(m.text()); });
page.on('pageerror', (e) => errs.push(String(e)));

// Seed a profile with trophies/currency so the road has claimed, claimable and
// locked nodes on screen at once.
await page.addInitScript(() => {
  localStorage.setItem('food-arena.profile.v1', JSON.stringify({
    name: 'Chef', wins: 14, losses: 6, xp: 940, selected: 'hamburger',
    economy: {
      trophies: 620, bestTrophies: 620, coins: 4820, gems: 143,
      containers: { chest: 3, hamburgerBox: 1, pineappleBox: 2, redBox: 0, fireBox: 0 },
      claimed: [10, 25, 50, 75, 100, 150, 200, 260, 320, 390],
      unlocked: ['hamburger', 'donut', 'taco', 'burrito'],
      winsTowardChest: 2,
      lastMatch: { trophies: 8, seen: false, won: true },
      seed: 12345, rolls: 4,
    },
  }));
});

await page.goto('http://localhost:5173/', { waitUntil: 'load' });
await page.waitForTimeout(1500);
await page.screenshot({ path: `${dir}/home.png` });

// Character select — wait for the roster renders so the portrait route is visible.
await page.click('[data-go="characters"]');
await page.waitForFunction(() => window.__thumbsReady === true, null, { timeout: 30000 }).catch(() => {});
await page.waitForTimeout(700);
await page.screenshot({ path: `${dir}/characters.png` });

// Home again (portraits now cached), then trophy road.
await page.click('[data-el="back"]');
await page.waitForTimeout(600);
await page.screenshot({ path: `${dir}/home2.png` });
await page.click('[data-go="trophies"]');
await page.waitForTimeout(1200);
await page.screenshot({ path: `${dir}/road.png` });

// Open a chest for the reveal card.
const open = await page.$('[data-open]');
if (open) { await open.click(); await page.waitForTimeout(900); await page.screenshot({ path: `${dir}/reveal.png` }); }

// ── HUD ────────────────────────────────────────────────────────────────────
// Reached through the menus on purpose: that is the only flow a player has, and it
// is what warms the shared portrait cache the HUD badges read from.
await page.goto('http://localhost:5173/', { waitUntil: 'load' });
await page.waitForTimeout(800);
await page.$eval('.fa-tab[data-go="characters"]', (el) => el.click());
await page.waitForFunction(() => window.__thumbsReady === true, null, { timeout: 30000 }).catch(() => {});
await page.waitForTimeout(400);
await page.$eval('[data-el="fight"]', (el) => el.click());
await page.waitForFunction(() => window.__gameReady === true, null, { timeout: 30000 }).catch(() => {});
await page.waitForTimeout(5200);
await page.screenshot({ path: `${dir}/hud.png` });
await page.evaluate(() => { const c = document.querySelector('canvas'); if (c) c.style.visibility = 'hidden'; });
await page.screenshot({ path: `${dir}/hud_bare.png` });

if (errs.length) console.log('CONSOLE ERRORS:\n' + errs.join('\n'));
console.log('done', dir);
await browser.close();
