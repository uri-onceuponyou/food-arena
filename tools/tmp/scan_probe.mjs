#!/usr/bin/env node
/** One-off: what does the live match camera actually frame at shipped 16:9? */
import { chromium } from 'playwright';

const BASE = process.env.BASE ?? 'http://localhost:5187';
const LAUNCH_ARGS = [
  '--use-gl=angle', '--use-angle=swiftshader', '--enable-unsafe-swiftshader',
  '--enable-webgl', '--ignore-gpu-blocklist', '--disable-gpu-sandbox',
];

const browser = await chromium.launch({ args: LAUNCH_ARGS });
const page = await browser.newPage({ viewport: { width: 1600, height: 900 }, deviceScaleFactor: 1 });
await page.addInitScript(() => {
  // Stub Vite's HMR client: another agent's save must not reload us mid-capture.
  Object.defineProperty(window, '__vite_plugin_react_preamble_installed__', { value: true });
});
const errs = [];
page.on('pageerror', (e) => errs.push(String(e)));
page.on('console', (m) => { if (m.type() === 'error') errs.push(m.text()); });

const url = `${BASE}/?player=hamburger&enemy=donut&px=340&py=500&fogRadius=850&pointerLock=0`;
await page.goto(url, { waitUntil: 'networkidle', timeout: 60000 });
await page.waitForFunction('window.__gameReady === true', null, { timeout: 60000 });
await page.waitForTimeout(600);

const info = await page.evaluate(() => {
  const gw = window.__fairView ? window.__fairView() : null;
  return { gw, dpr: window.devicePixelRatio, canvas: document.querySelector('canvas')?.getBoundingClientRect() };
});
console.log(JSON.stringify(info, null, 2));
console.log('errors:', errs.slice(0, 5));
await page.screenshot({ path: 'shots/scan/probe.png' });
await browser.close();
