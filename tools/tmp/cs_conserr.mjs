#!/usr/bin/env node
/**
 * COUNT CONSOLE ERRORS IN A LIVE MATCH — the isolation, not an assertion.
 *
 * Warms the snapshot with a cheap load first: a fresh Vite snapshot's FIRST client
 * eats a dependency-optimisation full reload, which presents as "execution context
 * was destroyed" and as a discarded perf run.
 *
 *   node tools/tmp/cs_conserr.mjs --url $URL
 */
import { chromium } from 'playwright';
const arg = (k, d) => { const i = process.argv.indexOf('--' + k); return i < 0 ? d : process.argv[i + 1]; };
const BASE = arg('url', process.env.PREVIEW_BASE ?? 'http://localhost:5173');
const HMR_STUB = `const noop=()=>{};export const createHotContext=()=>({accept:noop,acceptExports:noop,dispose:noop,prune:noop,invalidate:noop,on:noop,off:noop,send:noop,decline:noop,data:{}});export const injectQuery=(u)=>u;export const updateStyle=noop;export const removeStyle=noop;export const ErrorOverlay=class{};export default {};`;
const b = await chromium.launch({ args: ['--use-gl=angle', '--use-angle=swiftshader', '--enable-unsafe-swiftshader', '--enable-webgl', '--ignore-gpu-blocklist', '--disable-gpu-sandbox'] });
// warm-up: absorb the dep-optimisation reload on a throwaway page
{
  const w = await b.newPage({ viewport: { width: 400, height: 300 } });
  await w.route('**/@vite/client*', (r) => r.fulfill({ status: 200, contentType: 'text/javascript', body: HMR_STUB }));
  await w.goto(`${BASE}/`, { waitUntil: 'networkidle', timeout: 90000 }).catch(() => {});
  await w.waitForTimeout(1500);
  await w.close();
}
for (const [label, url] of [
  ['MATCH', `${BASE}/?player=hamburger&enemy=donut&px=340&py=500&fogRadius=993&simSpeed=0.02&pointerLock=0`],
  ['MATCH live sim', `${BASE}/?player=hamburger&enemy=donut&px=570&py=430&fogRadius=993&pointerLock=0`],
  ['HOME', `${BASE}/`],
]) {
  const p = await b.newPage({ viewport: { width: 1300, height: 740 }, deviceScaleFactor: 1 });
  const errs = new Map();
  p.on('console', (m) => { if (m.type() === 'error') errs.set(m.text().slice(0, 120), (errs.get(m.text().slice(0, 120)) ?? 0) + 1); });
  p.on('pageerror', (e) => errs.set('PAGEERROR ' + String(e).slice(0, 120), (errs.get('PAGEERROR ' + String(e).slice(0, 120)) ?? 0) + 1));
  await p.route('**/@vite/client*', (r) => r.fulfill({ status: 200, contentType: 'text/javascript', body: HMR_STUB }));
  await p.goto(url, { waitUntil: 'networkidle', timeout: 90000 });
  await p.waitForTimeout(6000);
  console.log(`\n${label}: ${errs.size} distinct console errors`);
  for (const [t, n] of errs) console.log(`   x${n}  ${t}`);
  const multiply = [...errs].filter(([t]) => t.includes('MultiplyBlending')).reduce((a, [, n]) => a + n, 0);
  console.log(`   MultiplyBlending occurrences: ${multiply}`);
  await p.close();
}
await b.close();
