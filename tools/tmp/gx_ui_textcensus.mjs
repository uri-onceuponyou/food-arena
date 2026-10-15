#!/usr/bin/env node
/**
 * GX_UI_TEXTCENSUS — how big is the type on the scored menu screens, really?
 *
 * Walks every visible text node on `home` and `characters` (1600x900, the canonical
 * scored size) and records computed font-size / weight / family and the painted box.
 * Prints the distribution: how many runs, how much of the frame is text, and what share
 * of runs sit at or under 14 px — the "nothing is big" question theme.ts's own type-ramp
 * note raises ("the defect is that nothing is big").
 *
 * Read-only; run through sx_snap against a detached worktree:
 *   node tools/tmp/sx_snap.mjs --root /private/tmp/fa-rv-head -- \
 *     node tools/tmp/gx_ui_textcensus.mjs --url '{URL}' --out shots/rv/audit/ui/text
 */
import { chromium } from 'playwright';
import { mkdirSync, writeFileSync } from 'node:fs';
import { resolve } from 'node:path';
import { settleScreen } from './settle.mjs';

const argv = process.argv.slice(2);
const arg = (k, d = null) => { const i = argv.indexOf(k); return i >= 0 ? argv[i + 1] : d; };
const BASE = String(arg('--url', process.env.PREVIEW_BASE ?? '')).replace(/\/$/, '');
const OUT = resolve(arg('--out', 'shots/rv/audit/ui/text'));
mkdirSync(OUT, { recursive: true });
const LAUNCH = ['--use-gl=angle', '--use-angle=swiftshader', '--enable-unsafe-swiftshader',
  '--enable-webgl', '--ignore-gpu-blocklist', '--disable-gpu-sandbox'];

const CENSUS = () => {
  const runs = [];
  const walker = document.createTreeWalker(document.body, NodeFilter.SHOW_TEXT);
  for (let n = walker.nextNode(); n; n = walker.nextNode()) {
    const t = n.textContent.replace(/\s+/g, ' ').trim();
    if (!t) continue;
    const el = n.parentElement;
    if (!el) continue;
    let hidden = false;
    for (let p = el; p && p.nodeType === 1; p = p.parentElement) {
      const s = getComputedStyle(p);
      if (s.display === 'none' || s.visibility === 'hidden' || Number(s.opacity) < 0.05) { hidden = true; break; }
    }
    if (hidden) continue;
    const range = document.createRange(); range.selectNodeContents(n);
    const r = range.getBoundingClientRect();
    if (r.width < 1 || r.height < 1 || r.right < 0 || r.bottom < 0 || r.left > innerWidth || r.top > innerHeight) continue;
    const s = getComputedStyle(el);
    runs.push({ t: t.slice(0, 40), px: parseFloat(s.fontSize), w: s.fontWeight, f: s.fontFamily.split(',')[0].replace(/['"]/g, ''),
      area: Math.round(r.width * r.height), x: Math.round(r.x), y: Math.round(r.y), wpx: Math.round(r.width), hpx: Math.round(r.height) });
  }
  return { w: innerWidth, h: innerHeight, runs };
};

const result = {};
if (BASE) {
  const browser = await chromium.launch({ args: LAUNCH });
  try {
    for (const screen of ['home', 'characters']) {
      const page = await browser.newPage({ viewport: { width: 1600, height: 900 } });
      await page.route('**/@vite/client*', (r) => r.fulfill({ status: 200, contentType: 'text/javascript',
        body: 'const noop=()=>{};export const createHotContext=()=>({accept:noop,acceptExports:noop,dispose:noop,prune:noop,invalidate:noop,on:noop,off:noop,send:noop,decline:noop,data:{}});export const injectQuery=(u)=>u;export const updateStyle=noop;export const removeStyle=noop;export const ErrorOverlay=class{};export default {};' }));
      await page.goto(`${BASE}/?screen=${screen}`, { waitUntil: 'domcontentloaded', timeout: 180_000 });
      await page.waitForFunction((n) => window.__screen === n, screen, { timeout: 180_000 });
      await settleScreen(page, { timeout: 60_000, soft: true });
      await page.waitForTimeout(5500);
      const c = await page.evaluate(CENSUS);
      const runs = c.runs;
      const frame = c.w * c.h;
      const textArea = runs.reduce((s, r) => s + r.area, 0);
      const sizes = runs.map((r) => r.px).sort((a, b) => a - b);
      const q = (p) => sizes[Math.min(sizes.length - 1, Math.floor(p * sizes.length))];
      const summary = {
        runs: runs.length,
        textAreaPctOfFrame: +(100 * textArea / frame).toFixed(2),
        medianPx: q(0.5), p90Px: q(0.9), maxPx: sizes[sizes.length - 1],
        runsAtOrUnder14px: runs.filter((r) => r.px <= 14).length,
        runsOver24px: runs.filter((r) => r.px > 24).length,
        families: Object.fromEntries([...new Set(runs.map((r) => r.f))].map((f) => [f, runs.filter((r) => r.f === f).length])),
        biggest: [...runs].sort((a, b) => b.px - a.px).slice(0, 6).map((r) => `${r.px}px ${r.t}`),
      };
      result[screen] = { summary, runs };
      console.log(screen, JSON.stringify(summary));
      await page.close();
    }
  } finally {
    writeFileSync(`${OUT}/textcensus.json`, JSON.stringify(result, null, 2));
    await browser.close().catch(() => {});
  }
}
