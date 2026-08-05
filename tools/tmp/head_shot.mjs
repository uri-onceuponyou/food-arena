#!/usr/bin/env node
/**
 * One canvas frame from a frozen station, for a HEAD-vs-working-tree image diff.
 *
 * The question it answers: is the `high` render tier a genuine no-op against the
 * pre-refactor pipeline? Counters already say yes to the byte (draw calls, triangles,
 * fill, program links, texture bytes all identical), but every arena colour figure
 * recorded this session was measured THROUGH this pipeline, so it is worth closing at
 * the pixel level too.
 *
 * Design: run this three times against ONE snapshot — twice on the working tree, then
 * once after `tier_revert.mjs` puts `src/render/**` back to HEAD inside that snapshot.
 * The first pair is the noise floor of two page loads (idle animation phase is not
 * perfectly reproducible), and the treatment has to sit inside it to mean anything.
 *
 *   node tools/tmp/head_shot.mjs --url {URL} --out shots/tier/noop/mine1.png
 */
import { chromium } from 'playwright';
import { mkdir } from 'node:fs/promises';
import { dirname } from 'node:path';

const LAUNCH_ARGS = ['--use-gl=angle', '--use-angle=swiftshader', '--enable-unsafe-swiftshader',
  '--enable-webgl', '--ignore-gpu-blocklist', '--disable-gpu-sandbox'];
const a = process.argv;
const get = (k, d) => (a.includes(k) ? a[a.indexOf(k) + 1] : d);
const base = get('--url', 'http://localhost:5188').replace(/\/$/, '');
const out = get('--out', 'shots/tier/noop/frame.png');

const browser = await chromium.launch({ args: LAUNCH_ARGS });
const page = await browser.newPage({ viewport: { width: 1300, height: 740 }, deviceScaleFactor: 1 });
page.on('pageerror', (e) => console.error('PAGEERROR', String(e)));
await page.route('**/@vite/client*', (r) => r.fulfill({
  status: 200, contentType: 'text/javascript',
  body: 'const noop=()=>{};export const createHotContext=()=>({accept:noop,acceptExports:noop,dispose:noop,prune:noop,invalidate:noop,on:noop,off:noop,send:noop,decline:noop,data:{}});export const injectQuery=(u)=>u;export const updateStyle=noop;export const removeStyle=noop;export const ErrorOverlay=class{};export default {};',
}));
// simSpeed 0.02 and a pinned position: `arena-scan`'s own recipe for a byte-comparable
// run. The countdown wait matters — it is the one thing that makes two loads start
// their idle animation from the same place.
await page.goto(`${base}/?player=hamburger&enemy=donut&px=340&py=500&fogRadius=850&simSpeed=0.02&pointerLock=0`,
  { waitUntil: 'networkidle', timeout: 90_000 });
await page.waitForFunction('window.__gameReady === true', null, { timeout: 90_000 });
await page.waitForFunction("document.querySelector('.hud-countdown')?.style.display === 'none'", null, { timeout: 120_000 }).catch(() => {});
await page.waitForTimeout(1200);
await page.evaluate(() => { window.requestAnimationFrame = () => 0; });
await page.waitForTimeout(200);

const info = await page.evaluate(() => {
  const s = window.__stage;
  return {
    tier: window.__renderTier ?? null,
    ratio: s.renderer.getPixelRatio(),
    buffer: [s.renderer.domElement.width, s.renderer.domElement.height],
    passes: s.composer ? s.composer.passes.map((p) => p.constructor.name).join(',') : 'none',
    shadowMap: s.lighting.key.shadow.mapSize.x,
  };
});
await mkdir(dirname(out), { recursive: true });
await page.locator('canvas').first().screenshot({ path: out, timeout: 90_000 });
console.log(`${out}  tier=${info.tier} ratio=${info.ratio} buffer=${info.buffer.join('x')} shadow=${info.shadowMap} passes=${info.passes}`);
await browser.close();
