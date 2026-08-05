#!/usr/bin/env node
/**
 * The contract a settings screen is about to depend on, exercised end to end.
 *
 * `src/ui/screens/settings.ts` ships no graphics row today, deliberately: its own rule
 * is that every control on it changes something, and the renderer exposed no tier. So
 * before that row is written, the API behind it has to be demonstrated doing four
 * things, not declared:
 *
 *   1. a fresh session with no stored preference resolves to a tier by detection;
 *   2. `setQualityChoice(t)` changes the LIVE renderer — pixel ratio, post passes and
 *      shadow map — with no reload and, critically, no new WebGL context (this project
 *      has already shipped a context leak that white-screened the game after ~8 menu
 *      round trips);
 *   3. the choice SURVIVES A RELOAD with nothing calling into the module at boot;
 *   4. `'auto'` puts detection back.
 *
 *   node tools/tmp/quality_api.mjs --url http://localhost:5188
 *
 * Exits 1 on the first broken expectation.
 */
import { chromium } from 'playwright';

const LAUNCH_ARGS = ['--use-gl=angle', '--use-angle=swiftshader', '--enable-unsafe-swiftshader',
  '--enable-webgl', '--ignore-gpu-blocklist', '--disable-gpu-sandbox'];
const a = process.argv;
const get = (k, d) => (a.includes(k) ? a[a.indexOf(k) + 1] : d);
const base = get('--url', 'http://localhost:5188').replace(/\/$/, '');

let failures = 0;
const check = (name, ok, detail) => {
  if (!ok) failures++;
  console.log(`${ok ? 'PASS' : 'FAIL'}  ${name.padEnd(46)} ${detail}`);
};

const browser = await chromium.launch({ args: LAUNCH_ARGS });
// deviceScaleFactor 3 — a phone's reported DPR, so the pixel-ratio cap is the thing
// under test and not a no-op against a DPR-1 desktop.
const ctx = await browser.newContext({ viewport: { width: 844, height: 390 }, deviceScaleFactor: 3 });
const page = await ctx.newPage();
page.on('pageerror', (e) => console.error('PAGEERROR', String(e)));
await page.route('**/@vite/client*', (r) => r.fulfill({
  status: 200, contentType: 'text/javascript',
  body: 'const noop=()=>{};export const createHotContext=()=>({accept:noop,acceptExports:noop,dispose:noop,prune:noop,invalidate:noop,on:noop,off:noop,send:noop,decline:noop,data:{}});export const injectQuery=(u)=>u;export const updateStyle=noop;export const removeStyle=noop;export const ErrorOverlay=class{};export default {};',
}));

// Count contexts the same way `perf --mode leak` does: wrap getContext before boot.
await page.addInitScript(`(() => {
  window.__ctxCount = 0;
  const o = HTMLCanvasElement.prototype.getContext;
  HTMLCanvasElement.prototype.getContext = function (t, ...r) {
    const c = o.call(this, t, ...r);
    if (/webgl/.test(t) && c) window.__ctxCount++;
    return c;
  };
})();`);

const boot = async () => {
  await page.goto(`${base}/?player=hamburger&enemy=donut&simSpeed=0.02&pointerLock=0`,
    { waitUntil: 'domcontentloaded', timeout: 90_000 });
  await page.waitForFunction('window.__gameReady === true', null, { timeout: 120_000 });
  await page.waitForTimeout(400);
};
const read = () => page.evaluate(() => {
  const s = window.__stage;
  return {
    tier: window.__quality.tier,
    choice: window.__quality.choice,
    detected: window.__quality.detected,
    forced: window.__quality.forced,
    signals: window.__quality.signals,
    ratio: s.renderer.getPixelRatio(),
    buffer: `${s.renderer.domElement.width}x${s.renderer.domElement.height}`,
    passes: s.composer ? s.composer.passes.length : 0,
    effects: s.composer ? s.composer.passes.flatMap((p) => (p.effects ?? []).map((e) => e.name)).join('+') : '',
    shadowMap: s.lighting.key.shadow.mapSize.x,
    contexts: window.__ctxCount,
  };
});
const setChoice = async (c) => {
  await page.evaluate((v) => window.__quality.set(v), c);
  await page.waitForTimeout(300);
};

// ── 1. fresh session, nothing stored ────────────────────────────────────────
await page.goto(`${base}/?screen=home`, { waitUntil: 'domcontentloaded', timeout: 90_000 });
await page.evaluate(() => localStorage.removeItem('food-arena.quality.v1'));
await boot();
const fresh = await read();
check('fresh session has no stored choice', fresh.choice === 'auto', `choice=${fresh.choice}`);
check('detection resolved a tier', ['high', 'medium', 'low'].includes(fresh.tier), `tier=${fresh.tier} detected=${fresh.detected}`);
check('no URL override in play', fresh.forced === null, `forced=${fresh.forced}`);
console.log(`      signals: coarsePointer=${fresh.signals.coarsePointer} touchPoints=${fresh.signals.maxTouchPoints} memGB=${fresh.signals.deviceMemoryGb} cores=${fresh.signals.hardwareConcurrency} dpr=${fresh.signals.devicePixelRatio} shortEdge=${fresh.signals.screenShortEdgeCssPx}`);
console.log(`      gpu: ${fresh.signals.gpu}`);
const ctx0 = fresh.contexts;

// ── 2. live change, no reload ───────────────────────────────────────────────
await setChoice('low');
const low = await read();
check('live: tier changed with no reload', low.tier === 'low', `${fresh.tier} -> ${low.tier}`);
check('live: pixel ratio re-capped', low.ratio === 1.25, `${fresh.ratio} -> ${low.ratio} (buffer ${fresh.buffer} -> ${low.buffer})`);
check('live: post chain rebuilt without bloom', !/Bloom/.test(low.effects), `${fresh.effects} -> ${low.effects}`);
check('live: shadow map re-resolutioned', low.shadowMap === 1024, `${fresh.shadowMap} -> ${low.shadowMap}`);
check('live: NO new GL context', low.contexts === ctx0, `${ctx0} -> ${low.contexts}`);

await setChoice('medium');
const med = await read();
check('live: medium keeps bloom, drops SMAA', /Bloom/.test(med.effects) && med.passes === 2, `passes=${med.passes} effects=${med.effects}`);
check('live: medium pixel ratio', med.ratio === 1.5, `ratio=${med.ratio} buffer=${med.buffer}`);
check('live: still no new GL context', med.contexts === ctx0, `${ctx0} -> ${med.contexts}`);

// ── 3. survives a reload, with nothing calling in at boot ───────────────────
await boot();
const reloaded = await read();
check('choice survived a reload', reloaded.choice === 'medium', `choice=${reloaded.choice} tier=${reloaded.tier}`);
check('renderer BUILT at the stored tier', reloaded.ratio === 1.5 && reloaded.shadowMap === 1536,
  `ratio=${reloaded.ratio} shadow=${reloaded.shadowMap} buffer=${reloaded.buffer}`);

// ── 4. auto puts detection back ─────────────────────────────────────────────
await setChoice('auto');
const auto = await read();
check('auto restores the detected tier', auto.tier === auto.detected, `tier=${auto.tier} detected=${auto.detected}`);
await boot();
const auto2 = await read();
check('auto persists as auto', auto2.choice === 'auto' && auto2.tier === auto2.detected, `choice=${auto2.choice} tier=${auto2.tier}`);

// ── 5. a URL override must lock the control ────────────────────────────────
await page.goto(`${base}/?player=hamburger&enemy=donut&simSpeed=0.02&pointerLock=0&tier=low`,
  { waitUntil: 'domcontentloaded', timeout: 90_000 });
await page.waitForFunction('window.__gameReady === true', null, { timeout: 120_000 });
const pinned = await read();
check('?tier= reports itself as forced', pinned.forced === 'low' && pinned.tier === 'low', `forced=${pinned.forced} choice=${pinned.choice}`);

// ── 6. what AUTO picks on a phone-shaped device ─────────────────────────────
//
// The claim under test is the whole point of auto-detection, and the desktop context
// above cannot make it: `pointer: coarse` is the gate, and a headless desktop is fine.
// Chromium's device emulation (`hasTouch` + `isMobile`) sets both the media query and
// `maxTouchPoints`, so this is the real detection path, not a stub.
for (const dev of [
  { name: 'phone landscape', width: 844, height: 390, dpr: 3, want: 'low' },
  { name: 'phone portrait', width: 390, height: 844, dpr: 3, want: 'low' },
  { name: 'tablet', width: 1024, height: 768, dpr: 2, want: 'medium' },
]) {
  const c = await browser.newContext({
    viewport: { width: dev.width, height: dev.height },
    deviceScaleFactor: dev.dpr,
    hasTouch: true,
    isMobile: true,
  });
  const p = await c.newPage();
  await p.route('**/@vite/client*', (r) => r.fulfill({
    status: 200, contentType: 'text/javascript',
    body: 'const noop=()=>{};export const createHotContext=()=>({accept:noop,acceptExports:noop,dispose:noop,prune:noop,invalidate:noop,on:noop,off:noop,send:noop,decline:noop,data:{}});export const injectQuery=(u)=>u;export const updateStyle=noop;export const removeStyle=noop;export const ErrorOverlay=class{};export default {};',
  }));
  await p.goto(`${base}/?player=hamburger&enemy=donut&simSpeed=0.02&pointerLock=0`,
    { waitUntil: 'domcontentloaded', timeout: 90_000 });
  await p.waitForFunction('window.__gameReady === true', null, { timeout: 120_000 });
  await p.waitForTimeout(300);
  const q = await p.evaluate(() => ({
    tier: window.__quality.tier,
    detected: window.__quality.detected,
    s: window.__quality.signals,
    ratio: window.__stage.renderer.getPixelRatio(),
    buffer: `${window.__stage.renderer.domElement.width}x${window.__stage.renderer.domElement.height}`,
  }));
  check(`auto on ${dev.name}`, q.tier === dev.want,
    `tier=${q.tier} (want ${dev.want}) ratio=${q.ratio} buffer=${q.buffer} · coarse=${q.s.coarsePointer} touch=${q.s.maxTouchPoints} mem=${q.s.deviceMemoryGb} cores=${q.s.hardwareConcurrency} shortEdge=${q.s.screenShortEdgeCssPx}`);
  await c.close();
}

await browser.close();
console.log(failures ? `\n${failures} FAILED` : '\nquality API contract: all checks passed');
process.exit(failures ? 1 : 0);
