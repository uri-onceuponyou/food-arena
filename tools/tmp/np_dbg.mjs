#!/usr/bin/env node
/**
 * Scratch diagnostic for `np_identity.mjs`'s boot path — kept rather than deleted because
 * "the game never reported ready" is indistinguishable from "the server is dead", "the
 * page threw", and "this URL does not start a match", and telling those apart cost a run.
 *
 *   node tools/tmp/headserve.mjs --ref HEAD -- node tools/tmp/np_dbg.mjs
 */
import { chromium } from 'playwright';

const BASE = String(process.env.PREVIEW_BASE ?? 'http://localhost:5173').replace(/\/$/, '');
const LAUNCH = ['--use-gl=angle', '--use-angle=swiftshader', '--enable-unsafe-swiftshader',
  '--enable-webgl', '--ignore-gpu-blocklist', '--disable-gpu-sandbox'];

const b = await chromium.launch({ args: LAUNCH });
const page = await b.newPage({ viewport: { width: 1280, height: 720 } });
page.on('pageerror', (e) => console.log('PAGEERROR:', e.message));
page.on('console', (m) => console.log('CONSOLE', m.type(), m.text().slice(0, 300)));
await page.goto(`${BASE}/?px=1120&py=610&fogRadius=900&simSpeed=1&player=hamburger&enemy=donut&pointerLock=0`,
  { waitUntil: 'domcontentloaded' });
for (let i = 0; i < 12; i++) {
  await page.waitForTimeout(2500);
  const st = await page.evaluate(() => ({
    ready: window.__gameReady === true,
    screenReady: window.__screenReady ?? null,
    screenName: window.__screenName ?? null,
    hud: !!document.querySelector('.hud-root'),
    stage: !!window.__stage,
    canvases: document.querySelectorAll('canvas').length,
    buttons: [...document.querySelectorAll('button')].map((e) => e.textContent?.trim()).slice(0, 10),
  }));
  console.log(i, JSON.stringify(st));
  if (st.ready) break;
}
await page.screenshot({ path: 'shots/np/np_dbg.png' });
await b.close();
