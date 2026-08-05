#!/usr/bin/env node
/**
 * Why does a screen take as long as it does to settle?
 *
 * `settle_validate.mjs` measured trophies settling after 11873 ms and characters
 * after 7726 ms, against 23 ms for settings. A wait condition that is sometimes
 * 500x slower than at other times is either watching something real or spinning on
 * something it should not watch — and "it is probably fine" is how a slow instrument
 * gets adopted and then blamed for a flaky battery. This says which.
 *
 * It polls `paintState()` at a fixed cadence and prints the distinct NOT-PAINTED
 * reason-sets in order, with how long each one held. If the answer is a long finite
 * animation the page really runs, the wait is correct and the cost is the page's. If
 * the same reason holds forever, the predicate is wrong and this names it.
 *
 * Usage:
 *   node tools/tmp/with_snapshot.mjs -- node tools/tmp/settle_why.mjs --url {URL}
 */

import { chromium } from 'playwright';
import { paintState, describe } from './settle.mjs';

const LAUNCH_ARGS = [
  '--use-gl=angle', '--use-angle=swiftshader', '--enable-unsafe-swiftshader',
  '--enable-webgl', '--ignore-gpu-blocklist', '--disable-gpu-sandbox',
];

function parseArgs(argv) {
  const out = {};
  for (let i = 2; i < argv.length; i++) {
    const a = argv[i]; if (!a.startsWith('--')) continue;
    const k = a.slice(2); const n = argv[i + 1];
    if (n === undefined || n.startsWith('--')) out[k] = true; else { out[k] = n; i++; }
  }
  return out;
}
const args = parseArgs(process.argv);
const BASE = args.url ?? process.env.PREVIEW_BASE ?? 'http://localhost:5173';
const SCREENS = String(args.screens ?? 'settings,home,trophies,characters,shop').split(',');
const BUDGET = Number(args.budget ?? 40_000);

const browser = await chromium.launch({ args: LAUNCH_ARGS });
for (const screen of SCREENS) {
  const page = await browser.newPage({ viewport: { width: 1280, height: 720 }, deviceScaleFactor: 1 });
  await page.goto(`${BASE}/?screen=${screen}`, { waitUntil: 'domcontentloaded', timeout: 60_000 });

  const t0 = Date.now();
  const phases = [];
  let last = null;
  let settledAt = null;
  while (Date.now() - t0 < BUDGET) {
    // eslint-disable-next-line no-await-in-loop
    const st = await paintState(page).catch(() => null);
    if (!st) break;
    const key = st.ok ? 'PAINTED' : st.why.join(' | ');
    if (key !== last) { phases.push({ key, from: Date.now() - t0 }); last = key; }
    if (st.ok) { settledAt = Date.now() - t0; break; }
    // eslint-disable-next-line no-await-in-loop
    await page.waitForTimeout(60);
  }
  // Close out the last phase.
  for (let i = 0; i < phases.length; i++) {
    phases[i].to = phases[i + 1]?.from ?? (settledAt ?? BUDGET);
  }

  console.log(`\n══ ${screen} ══  ${settledAt === null ? `NEVER SETTLED within ${BUDGET}ms` : `settled at ${settledAt}ms`}`);
  for (const p of phases) {
    console.log(`   ${String(p.from).padStart(6)}..${String(p.to).padStart(6)}ms  (${String(p.to - p.from).padStart(6)}ms)  ${p.key}`);
  }
  const final = await paintState(page);
  console.log(`   final: ${describe(final)}`);
  await page.close();
}
await browser.close();
