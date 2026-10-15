#!/usr/bin/env node
/**
 * bh_meta_dbg — why did `page.click` time out on the lobby swap / trophy-road odds / road
 * node / match chip in bh_meta_browser's second batch? Prints what is AT each control's
 * centre and Playwright's full actionability log. Read-only; writes PNGs to shots/rv/bugs/meta.
 *   node tools/tmp/sx_snap.mjs --root /private/tmp/fa-rv-head -- node tools/tmp/bh_meta_dbg.mjs --url '{URL}'
 */
import { chromium } from 'playwright';

const A = process.argv.slice(2);
const BASE = (A.includes('--url') ? A[A.indexOf('--url') + 1] : process.env.PREVIEW_BASE ?? '').replace(/\/$/, '');
const OUT = 'shots/rv/bugs/meta';
const LAUNCH_ARGS = ['--use-gl=angle', '--use-angle=swiftshader', '--enable-unsafe-swiftshader',
  '--enable-webgl', '--ignore-gpu-blocklist', '--disable-gpu-sandbox'];
const STUB = 'const noop=()=>{};export const createHotContext=()=>({accept:noop,acceptExports:noop,'
  + 'dispose:noop,prune:noop,invalidate:noop,on:noop,off:noop,send:noop,decline:noop,data:{}});'
  + 'export const injectQuery=(u)=>u;export const updateStyle=noop;export const removeStyle=noop;'
  + 'export const ErrorOverlay=class{};export default {};';

const browser = await chromium.launch({ args: LAUNCH_ARGS });
const ctx = await browser.newContext({ viewport: { width: 1280, height: 720 }, deviceScaleFactor: 1 });
await ctx.addInitScript(() => {
  if (!localStorage.getItem('food-arena.profile.v1')) {
    localStorage.setItem('food-arena.profile.v1', JSON.stringify({
      name: 'DBG', wins: 0, losses: 0, xp: 0, selected: 'hamburger',
      economy: { trophies: 70, bestTrophies: 70, coins: 880, gems: 15,
        containers: { chest: 0, hamburgerBox: 0, pineappleBox: 0, redBox: 0, fireBox: 0 },
        claimed: [], unlocked: ['hamburger'], items: ['springform'], winsTowardChest: 0,
        lastMatch: null, levels: {}, seed: 4242, rolls: 0 },
    }));
  }
});
const page = await ctx.newPage();
await page.route('**/@vite/client*', (r) => r.fulfill({ status: 200, contentType: 'text/javascript', body: STUB }));

async function probe(label, url, ready, sel) {
  console.log(`\n── ${label}`);
  await page.goto(`${BASE}/${url}`, { waitUntil: 'domcontentloaded', timeout: 180_000 });
  await page.waitForFunction(ready, null, { timeout: 180_000 });
  await page.waitForTimeout(1500);
  const info = await page.evaluate((s) => {
    const el = document.querySelector(s);
    if (!el) return { found: false };
    const r = el.getBoundingClientRect();
    const cx = r.x + r.width / 2; const cy = r.y + r.height / 2;
    const top = document.elementFromPoint(cx, cy);
    const cs = getComputedStyle(el);
    const chain = [];
    for (let n = top; n && chain.length < 6; n = n.parentElement) chain.push(`${n.tagName.toLowerCase()}.${[...n.classList].join('.')}`);
    return { found: true, rect: [r.x, r.y, r.width, r.height].map(Math.round), disabled: el.disabled ?? null,
      pe: cs.pointerEvents, vis: cs.visibility, op: cs.opacity, hitIsSelf: top === el || el.contains(top), topChain: chain,
      winW: innerWidth, winH: innerHeight };
  }, sel);
  console.log(`   ${sel}: ${JSON.stringify(info)}`);
  await page.screenshot({ path: `${OUT}/dbg_${label}.png` });
  try {
    await page.click(sel, { timeout: 8000 });
    console.log('   click OK');
  } catch (e) {
    console.log(`   click FAILED:\n${String(e).split('\n').slice(0, 14).map((l) => `     ${l}`).join('\n')}`);
  }
}

await probe('trophies-odds', '?screen=trophies', () => window.__screen === 'trophies', '[data-el="oddsbtn"]');
await probe('trophies-node30', '?screen=trophies', () => window.__screen === 'trophies', '.tr-node.is-claimable[data-trophies="30"]');
await probe('lobby-swap', '?screen=lobby', () => window.__screen === 'lobby', '[data-el="swap"]');
await browser.close();
