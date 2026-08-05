#!/usr/bin/env node
/**
 * Which HUD element is spending the cast's hue band?
 *
 * ── Why this exists ─────────────────────────────────────────────────────────
 * The arena was re-keyed onto three disjoint hue families — walkable rose-mauve
 * (~334 deg), blocking violet, and **0-60 deg reserved for the cast** — and a colour
 * pass then measured the DOM HUD supplying ~9% of the frame's total warm chroma, with
 * the ability tray occupying the two loudest cells of the 16x9 salience grid. A blind
 * critic had already reported "the golden donut prop at bottom-center" stealing
 * attention from the player. There is no such prop. It was the tray.
 *
 * Guessing which rule to change from a stylesheet is exactly how this project has
 * previously "fixed" the wrong thing, so this ablates: hide one element, re-shoot,
 * and measure what the frame's warm chroma does. Net of whatever the element was
 * covering up, which is the only number that means anything.
 *
 * Metric is `tools/tmp/chroma.mjs`'s, verbatim — HSL saturation, hue binned 0-30 and
 * 30-60, pixels below s=0.15 ignored — so a figure here is comparable to every colour
 * number recorded on this project.
 *
 *   node tools/tmp/hud_hue.mjs --url http://localhost:5188
 *   node tools/tmp/hud_hue.mjs --url ... --save shots/tier/hud
 */
import { chromium } from 'playwright';
import sharp from 'sharp';
import { mkdir } from 'node:fs/promises';

const LAUNCH_ARGS = ['--use-gl=angle', '--use-angle=swiftshader', '--enable-unsafe-swiftshader',
  '--enable-webgl', '--ignore-gpu-blocklist', '--disable-gpu-sandbox'];
const a = process.argv;
const get = (k, d) => (a.includes(k) ? a[a.indexOf(k) + 1] : d);
const base = get('--url', 'http://localhost:5188').replace(/\/$/, '');
const save = get('--save', null);

/** Everything on screen during play that could plausibly carry chroma. */
const TARGETS = [
  '.hud-root',
  '.hud-weapons',
  '.hud-weapon-slot',
  '.hud-weapon-key',
  '.hud-radar',
  '.hud-radar-map',
  '.hud-zone',
  '.hud-fighters',
  '.hud-timer',
];

async function stats(buf) {
  const { data, info } = await sharp(buf).resize(320, 180, { fit: 'fill' }).removeAlpha()
    .raw().toBuffer({ resolveWithObject: true });
  const n = info.width * info.height;
  let sat = 0, b0 = 0, b1 = 0, cool = 0, chroma = 0, luma = 0;
  for (let i = 0; i < n; i++) {
    const r = data[i * 3], g = data[i * 3 + 1], b = data[i * 3 + 2];
    const mx = Math.max(r, g, b), mn = Math.min(r, g, b), d = mx - mn;
    const l = (mx + mn) / 2 / 255;
    const s = d === 0 ? 0 : (l > 0.5 ? d / (510 - mx - mn) : d / (mx + mn));
    sat += s; chroma += d / 255; luma += (0.2126 * r + 0.7152 * g + 0.0722 * b) / 255;
    if (s < 0.15) continue;
    let h = mx === r ? ((g - b) / d + (g < b ? 6 : 0)) : mx === g ? (b - r) / d + 2 : (r - g) / d + 4;
    h = ((h * 60) % 360 + 360) % 360;
    if (h < 30) b0 += s; else if (h < 60) b1 += s; else cool += s;
  }
  return { sat: sat / n, warm: (b0 + b1) / n, b0: b0 / n, b1: b1 / n, cool: cool / n, chroma: chroma / n, luma: luma / n };
}

const browser = await chromium.launch({ args: LAUNCH_ARGS });
const page = await browser.newPage({ viewport: { width: 1300, height: 740 }, deviceScaleFactor: 1 });
page.on('pageerror', (e) => console.error('PAGEERROR', String(e)));
await page.route('**/@vite/client*', (r) => r.fulfill({
  status: 200, contentType: 'text/javascript',
  body: 'const noop=()=>{};export const createHotContext=()=>({accept:noop,acceptExports:noop,dispose:noop,prune:noop,invalidate:noop,on:noop,off:noop,send:noop,decline:noop,data:{}});export const injectQuery=(u)=>u;export const updateStyle=noop;export const removeStyle=noop;export const ErrorOverlay=class{};export default {};',
}));
// A mid-lane station, sim effectively frozen, ring parked off the map — the same setup
// `arena-scan` uses for byte-comparable runs.
await page.goto(`${base}/?player=hamburger&enemy=donut&px=340&py=500&fogRadius=850&simSpeed=0.02&pointerLock=0`,
  { waitUntil: 'networkidle', timeout: 90_000 });
await page.waitForFunction('window.__gameReady === true', null, { timeout: 90_000 });
await page.waitForFunction("document.querySelector('.hud-countdown')?.style.display === 'none'", null, { timeout: 120_000 }).catch(() => {});
await page.waitForTimeout(600);
await page.evaluate(() => { window.requestAnimationFrame = () => 0; });
await page.waitForTimeout(200);

if (save) await mkdir(save, { recursive: true });
const shoot = async (name) => {
  const buf = await page.screenshot(save ? { path: `${save}/${name}.png` } : {});
  return buf;
};

const baseStats = await stats(await shoot('base'));
console.log(`FRAME (HUD on)   meanSat ${baseStats.sat.toFixed(4)}  warm(0-60) ${baseStats.warm.toFixed(4)}  cool ${baseStats.cool.toFixed(4)}  luma ${baseStats.luma.toFixed(4)}`);
console.log('');
console.log('hidden element        area px    warm delta   % of frame warm   sat delta   cool delta');

for (const sel of TARGETS) {
  const area = await page.evaluate((s) => {
    const nodes = [...document.querySelectorAll(s)];
    return nodes.reduce((acc, n) => {
      const r = n.getBoundingClientRect();
      return acc + Math.max(0, r.width) * Math.max(0, r.height);
    }, 0);
  }, sel);
  await page.evaluate((s) => {
    for (const n of document.querySelectorAll(s)) n.style.visibility = 'hidden';
  }, sel);
  await page.waitForTimeout(80);
  const off = await stats(await shoot(`off_${sel.replace(/[^a-z]/g, '')}`));
  await page.evaluate((s) => {
    for (const n of document.querySelectorAll(s)) n.style.visibility = '';
  }, sel);
  const dWarm = baseStats.warm - off.warm;
  console.log(`${sel.padEnd(20)} ${String(Math.round(area)).padStart(7)}    ${dWarm >= 0 ? '+' : ''}${dWarm.toFixed(4)}       ${(100 * dWarm / baseStats.warm).toFixed(1)}%            ${(baseStats.sat - off.sat >= 0 ? '+' : '') + (baseStats.sat - off.sat).toFixed(4)}     ${(baseStats.cool - off.cool >= 0 ? '+' : '') + (baseStats.cool - off.cool).toFixed(4)}`);
}

// The tray's own pixels, sampled straight out of the screenshot, so the plate colour
// that a salience grid actually averages is a measurement and not a stylesheet value.
const trayBox = await page.evaluate(() => {
  const r = document.querySelector('.hud-weapons')?.getBoundingClientRect();
  return r ? { x: Math.round(r.x), y: Math.round(r.y), w: Math.round(r.width), h: Math.round(r.height) } : null;
});
if (trayBox) {
  const buf = await page.screenshot({ clip: { x: trayBox.x, y: trayBox.y, width: trayBox.w, height: trayBox.h } });
  const s = await stats(buf);
  const { data, info } = await sharp(buf).removeAlpha().raw().toBuffer({ resolveWithObject: true });
  let r = 0, g = 0, b = 0;
  const n = info.width * info.height;
  for (let i = 0; i < n; i++) { r += data[i * 3]; g += data[i * 3 + 1]; b += data[i * 3 + 2]; }
  console.log(`\nTRAY box ${trayBox.w}x${trayBox.h} at ${trayBox.x},${trayBox.y}`);
  console.log(`  mean colour rgb(${Math.round(r / n)},${Math.round(g / n)},${Math.round(b / n)})  meanSat ${s.sat.toFixed(3)}  warm ${s.warm.toFixed(3)}  cool ${s.cool.toFixed(3)}  luma ${s.luma.toFixed(3)}`);
}

await browser.close();
