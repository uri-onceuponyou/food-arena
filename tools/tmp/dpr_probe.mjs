#!/usr/bin/env node
/**
 * DPR cap probe — does the quality tier's `pixelRatioCap` actually bind, at the pixel
 * ratios real phones report?
 *
 * `docs/STATE.md` carried this as unbuilt with the exact complaint: *"Phones report DPR
 * 3-4; `maxPixelRatio` is 2."* A cap is only worth anything if it is a true `min`
 * against the DEVICE's ratio, so this drives Chromium at `deviceScaleFactor` 1, 2, 3
 * and 4 and reads what the renderer actually did — `renderer.getPixelRatio()` and the
 * real `canvas.width/height`, not the value we asked for.
 *
 * Everything printed is hardware-independent (`docs/LESSONS.md` §10): a drawing buffer
 * is the same number of pixels on an iPhone as it is under SwiftShader. No timings.
 *
 *   node tools/tmp/dpr_probe.mjs --url http://localhost:5188
 *   node tools/tmp/dpr_probe.mjs --url ... --json tools/tmp/tier/dpr.json
 *
 * Exits 1 if any measured ratio is not exactly `min(dpr, tierCap, callerCap)`.
 */
import { chromium } from 'playwright';
import { writeFile, mkdir } from 'node:fs/promises';
import { dirname } from 'node:path';

const LAUNCH_ARGS = ['--use-gl=angle', '--use-angle=swiftshader', '--enable-unsafe-swiftshader',
  '--enable-webgl', '--ignore-gpu-blocklist', '--disable-gpu-sandbox'];
const a = process.argv;
const get = (k, d) => (a.includes(k) ? a[a.indexOf(k) + 1] : d);
const base = get('--url', 'http://localhost:5188').replace(/\/$/, '');
const jsonOut = get('--json', null);

// The tier caps under test. Kept as a literal here ON PURPOSE: a probe that imports the
// table it is checking can only ever prove the code agrees with itself.
const EXPECTED_CAP = { high: 2, medium: 1.5, low: 1.25 };

/**
 * Routes to measure.
 *
 * `match` is the shipped game (no `maxPixelRatio` of its own — the tier is the only
 * cap). `characters` is the menu portrait, whose Stage passes `maxPixelRatio: 2`: it is
 * here to prove that a caller's own ceiling is a CEILING and not a floor, i.e. that a
 * review harness asking for 2 on a phone still gets the phone's cap.
 */
const ROUTES = [
  { name: 'match', path: '/?player=hamburger&enemy=donut', ready: 'window.__gameReady === true', callerCap: Infinity },
  { name: 'characters', path: '/?screen=characters', ready: "window.__screenReady === true && window.__screen === 'characters'", callerCap: 2 },
];

const browser = await chromium.launch({ args: LAUNCH_ARGS });
const rows = [];
let failures = 0;

for (const route of ROUTES) {
  for (const tier of ['high', 'medium', 'low']) {
    for (const dpr of [1, 2, 3, 4]) {
      // A phone in landscape, in CSS px — the same viewport `perf.mjs --device mobile`
      // uses, so the numbers here line up with its fill figures.
      const ctx = await browser.newContext({ viewport: { width: 844, height: 390 }, deviceScaleFactor: dpr });
      const page = await ctx.newPage();
      const errors = [];
      page.on('pageerror', (e) => errors.push(String(e)));
      await page.route('**/@vite/client*', (r) => r.fulfill({
        status: 200, contentType: 'text/javascript',
        body: 'const noop=()=>{};export const createHotContext=()=>({accept:noop,acceptExports:noop,dispose:noop,prune:noop,invalidate:noop,on:noop,off:noop,send:noop,decline:noop,data:{}});export const injectQuery=(u)=>u;export const updateStyle=noop;export const removeStyle=noop;export const ErrorOverlay=class{};export default {};',
      }));
      await page.goto(`${base}${route.path}&tier=${tier}`, { waitUntil: 'domcontentloaded', timeout: 90_000 });
      await page.waitForFunction(route.ready, null, { timeout: 120_000 });
      await page.waitForTimeout(500);

      const m = await page.evaluate(() => {
        const s = window.__stage;
        if (!s || s.disposed) return { error: 'no live Stage' };
        const cv = s.renderer.domElement;
        return {
          devicePixelRatio: window.devicePixelRatio,
          pixelRatio: s.renderer.getPixelRatio(),
          bufferW: cv.width,
          bufferH: cv.height,
          cssW: Math.round(cv.getBoundingClientRect().width),
          cssH: Math.round(cv.getBoundingClientRect().height),
          tier: window.__renderTier,
          shadowMap: s.lighting.key.shadow.mapSize.x,
          passes: s.composer ? s.composer.passes.length : 0,
        };
      });
      await ctx.close();

      const cap = Math.min(EXPECTED_CAP[tier], route.callerCap);
      const want = Math.min(dpr, cap);
      const ok = !m.error && m.pixelRatio === want && m.tier === tier;
      if (!ok) failures++;
      rows.push({
        route: route.name, tier, dpr,
        ratio: m.pixelRatio ?? null,
        want,
        buffer: m.error ? m.error : `${m.bufferW}x${m.bufferH}`,
        mpx: m.error ? null : +((m.bufferW * m.bufferH) / 1e6).toFixed(3),
        shadowMap: m.shadowMap ?? null,
        passes: m.passes ?? null,
        ok: ok ? 'PASS' : 'FAIL',
        errors: errors.length ? errors.slice(0, 2) : undefined,
      });
      console.log(`${ok ? 'PASS' : 'FAIL'}  ${route.name.padEnd(11)} tier=${tier.padEnd(6)} dpr=${dpr}  ->  pixelRatio ${String(m.pixelRatio).padEnd(5)} (want ${want})  buffer ${m.bufferW}x${m.bufferH}  shadow ${m.shadowMap}  passes ${m.passes}`);
    }
  }
}

await browser.close();
if (jsonOut) {
  await mkdir(dirname(jsonOut), { recursive: true });
  await writeFile(jsonOut, JSON.stringify({ expected: EXPECTED_CAP, rows }, null, 2));
  console.log(`wrote ${jsonOut}`);
}
console.log(failures ? `\n${failures} FAILURES` : `\nall ${rows.length} combinations correct`);
process.exit(failures ? 1 : 0);
