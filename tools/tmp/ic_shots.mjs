#!/usr/bin/env node
/**
 * The DELIVERED CONTEXT, photographed. Not an instrument — evidence.
 *
 * `ic_delivered.mjs` says `range` ships at 12.8 CSS px and `shards` at 21.6. A number
 * that size is easy to believe and easy to be wrong about, so this writes the actual
 * region of the actual screen at 1:1 and again at 6x, and CLAUDE.md non-negotiable #3
 * applies: read the PNG and look at it.
 *
 * 1:1 is the judgement plate. The 6x is for diagnosis ONLY — it is exactly the mistake
 * this task is about (judging authored pixels), so it is written to a `zoom/` subdir and
 * is never the thing a verdict is quoted from.
 *
 *   node tools/tmp/with_snapshot.mjs -- node tools/tmp/ic_shots.mjs --url {URL}
 */
import { chromium } from 'playwright';
import { mkdirSync } from 'node:fs';
import { join } from 'node:path';
import { settleScreen } from './settle.mjs';

const a = {};
for (let i = 2; i < process.argv.length; i++) {
  if (process.argv[i].startsWith('--')) a[process.argv[i].slice(2)] = process.argv[i + 1];
}
const BASE = (a.url ?? 'http://localhost:5173').replace(/\/$/, '');
const OUT = a.out ?? 'shots/ic/context';
mkdirSync(join(OUT, 'zoom'), { recursive: true });

const browser = await chromium.launch();

/** Shoot a clip at 1:1 and at 6x, from two independently-built pages — a CSS zoom on
 *  one page would change layout and therefore change what is being photographed. */
async function shoot(tag, vp, build, clip) {
  for (const [suffix, dsf] of [['', 1], ['-6x', 6]]) {
    const page = await browser.newPage({ viewport: vp, deviceScaleFactor: dsf });
    try {
      const box = await build(page);
      const c = clip ? clip(box) : box;
      const path = suffix ? join(OUT, 'zoom', `${tag}${suffix}.png`) : join(OUT, `${tag}.png`);
      await page.screenshot({ path, clip: c });
      if (!suffix) console.log(`${tag}  clip ${Math.round(c.width)}x${Math.round(c.height)} @${dsf}x`);
    } catch (e) { console.log(`${tag}${suffix}  FAILED: ${e.message}`); }
    await page.close();
  }
}

const pad = (b, p = 10) => ({ x: Math.max(0, b.x - p), y: Math.max(0, b.y - p), width: b.width + 2 * p, height: b.height + 2 * p });

async function at(page, screen, extra = '') {
  await page.goto(`${BASE}/?screen=${screen}${extra}`, { waitUntil: 'networkidle', timeout: 60000 });
  await page.waitForFunction(`window.__screen === ${JSON.stringify(screen)}`, null, { timeout: 60000 });
  try { await settleScreen(page, { label: screen, timeout: 60000 }); } catch { /* shoot anyway */ }
  await page.waitForTimeout(400);
}

const DESK = { width: 1280, height: 800 };
const PHONE = { width: 390, height: 844 };

// 1. The ability pill that holds BOTH colliding glyphs — `shards` in `.chars-ability-em`
//    and `range` in `.chars-fact`, inches apart in one box.
for (const [tag, vp] of [['pill-waterbottle-desk', DESK], ['pill-waterbottle-phone', PHONE]]) {
  await shoot(tag, vp, async (page) => {
    await at(page, 'characters');
    await page.click('.chars-card[data-char="waterbottle"]');
    await page.waitForTimeout(600);
    const els = await page.$$('.chars-ability');
    for (const el of els) {
      const t = await el.textContent();
      if (/Glass Shards/.test(t)) return pad(await el.boundingBox(), 8);
    }
    throw new Error('no Glass Shards pill');
  });
}

// 2. The whole ability column, so the pills can be compared with each other.
await shoot('abilities-waterbottle-desk', DESK, async (page) => {
  await at(page, 'characters');
  await page.click('.chars-card[data-char="waterbottle"]');
  await page.waitForTimeout(600);
  return pad(await (await page.$('.chars-abilities, .chars-ability')).boundingBox(), 8);
});

// 3. The HUD weapon bar — the one place `shards` is delivered with NO adjacent text.
for (const [tag, vp] of [['hud-waterbottle-desk', DESK], ['hud-waterbottle-phone', PHONE]]) {
  await shoot(tag, vp, async (page) => {
    await page.goto(`${BASE}/?screen=match&player=waterbottle&enemy=pizza`, { waitUntil: 'networkidle', timeout: 60000 });
    await page.waitForFunction('window.__screen === "match"', null, { timeout: 60000 });
    await page.waitForFunction('window.__gameReady === true', null, { timeout: 60000 }).catch(() => {});
    await page.waitForTimeout(3000);
    return pad(await (await page.$('.hud-weapons, .hud-weapon-bar, [class*="hud-weapon"]')).boundingBox(), 8);
  });
}

// 4. The shop cards — all four boxes, side by side, at their largest delivered size.
await shoot('shop-boxes-desk', DESK, async (page) => {
  await at(page, 'shop');
  const b = await (await page.$('.shop-grid, .fa-shop')).boundingBox();
  return { x: b.x, y: b.y, width: b.width, height: Math.min(b.height, 640) };
});

// 5. The home track strip — where `gift` and a container icon can appear together.
await shoot('home-track-desk', DESK, async (page) => {
  await at(page, 'home');
  const b = await (await page.$('.home-track, [class*="home-track"]')).boundingBox();
  return pad(b, 8);
});

// 6. The odds sheet — the boxes at their SMALLEST delivered size (11.8-15 px).
await shoot('odds-titles-desk', DESK, async (page) => {
  await at(page, 'trophies');
  await page.click('[data-el="oddsbtn"]');
  await page.waitForTimeout(800);
  const b = await (await page.$('.tr-sheet')).boundingBox();
  return { x: b.x, y: b.y, width: b.width, height: Math.min(b.height, 700) };
});

await browser.close();
console.log(`\nwrote ${OUT}`);
