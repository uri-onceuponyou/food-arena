#!/usr/bin/env node
/**
 * `window.__feelEvent` — DOES EACH OF THE FOUR DAMAGE-SOURCE KINDS SURVIVE THE HOOK?
 *
 * The hook is the only way to put a VFX event in a frame on demand, and on the 2800x2000
 * arena that is not a convenience: the camera follows the local seat, the opponent starts
 * ~2,500 wu away and first contact is 18.4 s, so a probe watching a real match has no hit
 * on screen to measure at all. One of its four kinds faulted —
 * `{ source: { kind: 'trail' } }` threw `TypeError: Cannot read properties of undefined
 * (reading 'x')` — and a VFX pass aimed at Uri's *"VFX looks clunky"* came back
 * unresolved because of it.
 *
 * ⚠️ **THE POINT OF THIS FILE IS THE THREE THAT ALREADY WORKED, NOT THE ONE THAT DID NOT.**
 * A fix asserted only on `trail` proves nothing about whether it broke `weapon`, `hazard`
 * or `fog` on the way past. All four are driven, and each one has to move the renderer's
 * own bookkeeping (`window.__feelDebug`) rather than merely not throw — an event that is
 * swallowed silently is the same picture as one that never arrived, which is the exact
 * failure `FeelDebug` was built for.
 *
 *   node tools/tmp/with_snapshot.mjs -- node tools/tmp/sd_feelevent.mjs --url {URL}
 */

import { chromium } from 'playwright';

const args = (() => {
  const o = {};
  for (let i = 2; i < process.argv.length; i++) {
    const a = process.argv[i];
    if (!a.startsWith('--')) continue;
    const n = process.argv[i + 1];
    if (n === undefined || n.startsWith('--')) o[a.slice(2)] = true;
    else { o[a.slice(2)] = n; i++; }
  }
  return o;
})();

const BASE = String(args.url ?? process.env.PREVIEW_BASE ?? 'http://localhost:5173');

const LAUNCH_ARGS = [
  '--use-gl=angle', '--use-angle=swiftshader', '--enable-unsafe-swiftshader',
  '--enable-webgl', '--ignore-gpu-blocklist', '--disable-gpu-sandbox',
];

/**
 * The four payloads, written the way a PROBE would write them — the minimum a caller
 * should have to know. Everything absent here is an identity field the sim always fills
 * and a hand-written event never does; that asymmetry is the whole defect.
 */
const CASES = [
  { kind: 'weapon', source: { kind: 'weapon', weaponKey: 'Smash', attackerId: 0 } },
  { kind: 'hazard', source: { kind: 'hazard' } },
  { kind: 'fog', source: { kind: 'fog' } },
  { kind: 'trail', source: { kind: 'trail' } },
];

const browser = await chromium.launch({ args: LAUNCH_ARGS });
const page = await browser.newPage({ viewport: { width: 1200, height: 900 } });
await page.goto(
  `${BASE}/?player=hamburger&enemy=donut&px=1400&py=1500&fogRadius=900&simSpeed=0.02&pointerLock=0`,
  { waitUntil: 'networkidle', timeout: 120_000 },
);
await page.waitForFunction(() => typeof window.__feelEvent === 'function', { timeout: 120_000 });

const results = await page.evaluate((cases) => {
  const out = [];
  for (const c of cases) {
    // `vfx` is the channel every one of the four is expected to move; the fog branch is
    // deliberately different in WHICH channels it fires, so the sum over all channels is
    // what is compared rather than any single one.
    const before = { ...window.__feelDebug.responses };
    const beforeEvents = Object.values(window.__feelDebug.events).reduce((a, b) => a + b, 0);
    let error = null;
    try {
      window.__feelEvent({
        type: 'hit-landed',
        amount: 12,
        source: c.source,
        x: 1400,
        y: 1500,
      });
    } catch (e) {
      error = String(e && e.message ? e.message : e);
    }
    const after = { ...window.__feelDebug.responses };
    const afterEvents = Object.values(window.__feelDebug.events).reduce((a, b) => a + b, 0);
    const moved = Object.keys(after).reduce((n, k) => n + (after[k] - before[k]), 0);
    out.push({ kind: c.kind, error, responsesMoved: moved, eventsMoved: afterEvents - beforeEvents });
  }
  return out;
}, CASES);

await browser.close();

let fail = 0;
console.log('window.__feelEvent — all four damage-source kinds\n');
for (const r of results) {
  const ok = r.error === null && r.eventsMoved === 1 && r.responsesMoved > 0;
  if (!ok) fail++;
  console.log(`  ${ok ? 'ok  ' : 'FAIL'} - ${r.kind.padEnd(7)} `
    + `events +${r.eventsMoved}  responses +${r.responsesMoved}`
    + (r.error ? `  THREW: ${r.error}` : ''));
}
console.log(`\n${results.length - fail} passed, ${fail} failed`);
process.exit(fail ? 1 : 0);
