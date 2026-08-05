/**
 * Is the character-select roster genuinely missing portraits at HEAD, or did my
 * capture just race the progressive thumbnail upgrade?
 *
 * `thumbs.ts` exposes `window.__thumbsReady` precisely so a review plate is never
 * shot mid-upgrade. My menus packet waited on a fixed timeout instead, so before
 * reporting a defect I have to find out whether the flag ever flips.
 */
import { chromium } from 'playwright';
import { mkdir } from 'node:fs/promises';

const ARGS = ['--use-gl=angle', '--use-angle=swiftshader', '--enable-unsafe-swiftshader',
  '--enable-webgl', '--ignore-gpu-blocklist', '--disable-gpu-sandbox'];
const BASE = process.env.PREVIEW_BASE;
const HMR_STUB = 'export const createHotContext=()=>({accept(){},dispose(){},prune(){},invalidate(){},on(){},send(){}});'
  + 'export function injectQuery(u){return u} export function removeStyle(){} export function updateStyle(){}';

await mkdir('shots/critic-r6/menus', { recursive: true });
const b = await chromium.launch({ args: ARGS });
const p = await b.newPage({ viewport: { width: 1600, height: 900 }, deviceScaleFactor: 1 });
await p.route('**/@vite/client*', (r) => r.fulfill({ status: 200, contentType: 'text/javascript', body: HMR_STUB }));
const errs = [];
p.on('pageerror', (e) => errs.push('pageerror: ' + String(e)));
p.on('console', (m) => { if (m.type() === 'error') errs.push('console: ' + m.text()); });

const t0 = Date.now();
await p.goto(`${BASE}/?screen=characters`, { waitUntil: 'domcontentloaded', timeout: 90000 });
let ready = false;
try {
  await p.waitForFunction('window.__thumbsReady === true', null, { timeout: 180000 });
  ready = true;
} catch { ready = false; }
const ms = Date.now() - t0;
console.log(`__thumbsReady = ${ready} after ${ms} ms`);

const cards = await p.evaluate(() => [...document.querySelectorAll('.chars-card')].map((c) => {
  const img = c.querySelector('img');
  return { id: c.getAttribute('data-char'), hasSrc: !!(img && img.getAttribute('src')), ok: !!(img && img.complete && img.naturalWidth > 0) };
}));
console.log(cards.map((c) => `${c.id}:${c.ok ? 'OK' : 'MISSING'}`).join('  '));
await p.waitForTimeout(600);
await p.screenshot({ path: 'shots/critic-r6/menus/characters_thumbsready.png', timeout: 120000 });
if (errs.length) { console.log('ERRORS:'); errs.slice(0, 15).forEach((e) => console.log('  ' + e)); }
await b.close();
