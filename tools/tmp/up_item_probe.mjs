#!/usr/bin/env node
/**
 * BASELINE GEOMETRY for the item-button pass — what boxes already occupy the corners
 * a new control could go in, MEASURED rather than predicted.
 *
 * Three predictions in a row is how this project ships a collision, so this reads the
 * real rects at the real viewports before anything is placed.
 *
 *   node tools/tmp/with_snapshot.mjs -- node tools/tmp/up_item_probe.mjs --url '{URL}'
 */
import { chromium } from 'playwright';

const a = {};
for (let i = 2; i < process.argv.length; i++) {
  if (process.argv[i].startsWith('--')) a[process.argv[i].slice(2)] = process.argv[i + 1] ?? true;
}
const BASE = (a.url ?? process.env.PREVIEW_BASE ?? 'http://localhost:5173').replace(/\/$/, '');

const LAUNCH_ARGS = [
  '--use-gl=angle', '--use-angle=swiftshader', '--enable-unsafe-swiftshader',
  '--enable-webgl', '--ignore-gpu-blocklist', '--disable-gpu-sandbox',
];

const VIEWPORTS = [
  { name: 'land-844', w: 844, h: 390, touch: true },
  { name: 'land-667', w: 667, h: 375, touch: true },
  { name: 'land-932', w: 932, h: 430, touch: true },
  { name: 'port-390', w: 390, h: 844, touch: true },
  { name: 'desk-1280', w: 1280, h: 800, touch: false },
];

const SELECTORS = [
  '.hud-weapons', '.hud-radar', '.hud-spectate', '.hud-topbar', '.hud-mute',
  '.tch-hint--aim', '.tch-hint--move', '.hud-weapon-slot',
];

const browser = await chromium.launch({ args: LAUNCH_ARGS });
const out = {};
for (const vp of VIEWPORTS) {
  const page = await browser.newPage({ viewport: { width: vp.w, height: vp.h }, deviceScaleFactor: 1 });
  await page.goto(`${BASE}/?screen=match&seats=6&player=hamburger&items=disposal,tenderiser&pointerLock=0&simSpeed=0.2`,
    { waitUntil: 'domcontentloaded', timeout: 90000 });
  await page.waitForFunction('window.__gameReady === true', null, { timeout: 120000 });
  if (vp.touch) await page.evaluate(() => document.documentElement.classList.add('fa-touch-capable'));
  await page.waitForTimeout(900);
  out[vp.name] = await page.evaluate((sels) => {
    const r = {};
    for (const s of sels) {
      const els = [...document.querySelectorAll(s)];
      r[s] = els.map((n) => {
        const b = n.getBoundingClientRect();
        return { x: Math.round(b.x), y: Math.round(b.y), w: Math.round(b.width), h: Math.round(b.height),
                 right: Math.round(b.right), bottom: Math.round(b.bottom) };
      });
    }
    r.__vp = { W: innerWidth, H: innerHeight };
    r.__loadouts = JSON.stringify(window.__matchDebug?.loadouts ?? null);
    return r;
  }, SELECTORS);
  await page.close();
}
await browser.close();
for (const [k, v] of Object.entries(out)) {
  console.log(`\n── ${k}  ${v.__vp.W}x${v.__vp.H}   loadouts=${v.__loadouts}`);
  for (const [sel, list] of Object.entries(v)) {
    if (sel.startsWith('__')) continue;
    if (!list.length) { console.log(`   ${sel.padEnd(20)} —`); continue; }
    for (const b of list) console.log(`   ${sel.padEnd(20)} x${b.x} y${b.y} ${b.w}x${b.h} -> r${b.right} b${b.bottom}`);
  }
}
