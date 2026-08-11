#!/usr/bin/env node
/**
 * WHO CALLS `Math.random`, AND HOW OFTEN — the attribution half of `np_identity.mjs`.
 *
 * `np_identity` seeds `Math.random` so a rendered frame becomes a pure function of the
 * seed. That turns "the two builds differ" into "the two builds take a different NUMBER of
 * draws", which is a much sharper question — and a useless one until you know WHICH call
 * site moved. A stream that is 2,532 draws short produces a completely different frame
 * from the first shifted draw onward, so the pixel diff says nothing about magnitude.
 *
 * This tallies every draw by the SOURCE FILE at the top of its stack, so the answer is a
 * name rather than a number.
 *
 *   node tools/tmp/headserve.mjs --ref HEAD -- node tools/tmp/np_rng.mjs
 *   node tools/tmp/headserve.mjs --ref HEAD --overlay src/ui/hud.ts … -- node tools/tmp/np_rng.mjs
 */
import { chromium } from 'playwright';

const BASE = String(process.env.PREVIEW_BASE ?? 'http://localhost:5173').replace(/\/$/, '');
const argv = process.argv.slice(2);
const arg = (k, d = null) => { const i = argv.indexOf(k); return i >= 0 ? argv[i + 1] : d; };
const FRAMES = Number(arg('--frames', 60));
const LAUNCH = ['--use-gl=angle', '--use-angle=swiftshader', '--enable-unsafe-swiftshader',
  '--enable-webgl', '--ignore-gpu-blocklist', '--disable-gpu-sandbox'];

const b = await chromium.launch({ args: LAUNCH });
const page = await b.newPage({ viewport: { width: 1280, height: 720 } });
page.on('pageerror', (e) => console.log('PAGEERROR:', e.message));

await page.addInitScript(() => {
  const realNow = performance.now.bind(performance);
  let paused = true; let virt = 0; let base = realNow();
  performance.now = () => (paused ? virt : realNow() - base);
  window.__clk = { pause() { paused = true; }, advance(ms) { virt += ms; } };
  let seed = 0x9e3779b9 >>> 0;
  const tally = new Map();
  window.__rngTally = tally;
  window.__rngCalls = 0;
  Math.random = () => {
    window.__rngCalls++;
    // The first stack line below `Math.random` itself. `Error.stack` is expensive, which
    // is exactly why this lives in its own probe rather than in `np_identity`.
    const st = (new Error().stack ?? '').split('\n');
    const line = st.find((l, i) => i > 1 && l.includes('http')) ?? '?';
    const m = line.match(/\/(src\/[^?:)]+)/);
    const key = m ? m[1] : line.trim().slice(0, 80);
    tally.set(key, (tally.get(key) ?? 0) + 1);
    seed = (seed + 0x6d2b79f5) >>> 0;
    let t = seed;
    t = Math.imul(t ^ (t >>> 15), t | 1) >>> 0;
    t = (t ^ (t + Math.imul(t ^ (t >>> 7), t | 61))) >>> 0;
    return ((t ^ (t >>> 14)) >>> 0) / 4294967296;
  };
});

await page.goto(`${BASE}/?px=1070&py=610&fogRadius=900&simSpeed=1&player=hamburger&enemy=donut&pointerLock=0`,
  { waitUntil: 'networkidle' });
await page.waitForFunction(() => window.__gameReady === true, null, { timeout: 90000 });
await page.evaluate(async (frames) => {
  for (let i = 0; i < frames; i++) {
    window.__clk.advance(16.667);
    await new Promise((r) => requestAnimationFrame(() => r()));
  }
}, FRAMES);

const rows = await page.evaluate(() => ({
  total: window.__rngCalls,
  tally: [...window.__rngTally.entries()].sort((a, b) => b[1] - a[1]).slice(0, 25),
}));
console.log(JSON.stringify(rows));
await b.close();
