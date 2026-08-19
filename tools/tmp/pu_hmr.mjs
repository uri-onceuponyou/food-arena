#!/usr/bin/env node
/**
 * pu_hmr — does an HMR update re-evaluate `rules.ts` and re-claim registry keys?
 *
 * KNOWN-BAD / CONTROL: the cold load is the control arm. If the cold load is clean and the
 * post-touch arm throws, the fault is HMR re-evaluation, not the import graph.
 *
 * Usage: node tools/tmp/pu_hmr.mjs <url> <repo-root-to-touch> <file...>
 */
import { chromium } from 'playwright';
import { utimesSync } from 'node:fs';
import { join } from 'node:path';

const [url, root, ...files] = process.argv.slice(2);
const b = await chromium.launch();
const pg = await b.newPage();
const errs = [];
const reloads = [];
pg.on('pageerror', (e) => errs.push('PAGEERROR: ' + e.message.split('\n').slice(0, 3).join(' | ')));
pg.on('console', (m) => {
  const t = m.text();
  if (m.type() === 'error') errs.push('CONSOLE: ' + t.slice(0, 300));
  if (/vite/i.test(t)) reloads.push(t.slice(0, 120));
});
pg.on('framenavigated', (f) => { if (f === pg.mainFrame()) reloads.push('NAVIGATED ' + f.url()); });

await pg.goto(url, { waitUntil: 'load' });
await pg.waitForTimeout(5000);
console.log(`COLD  __screen=${await pg.evaluate(() => window.__screen ?? null)}  errors=${errs.length}`);
const coldErrs = errs.length;

for (const f of files) {
  const p = join(root, f);
  const now = new Date();
  utimesSync(p, now, now);
  console.log(`touched ${f}`);
  await pg.waitForTimeout(3500);
  console.log(`  after ${f}: __screen=${await pg.evaluate(() => window.__screen ?? null).catch(() => 'EVAL-FAILED')}  errors=${errs.length}`);
}
await pg.waitForTimeout(2000);
console.log('--- vite/console traffic ---');
for (const r of reloads.slice(0, 12)) console.log('  ' + r);
console.log('--- errors ---');
if (!errs.length) console.log('  none');
for (const e of errs.slice(0, 8)) console.log('  ' + e);
console.log(`VERDICT cold=${coldErrs} total=${errs.length}`);
await b.close();
