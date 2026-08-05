#!/usr/bin/env node
/**
 * NAV probe helper — is an `aspect.mjs` failure MINE?
 *
 * `tools/aspect.mjs` died with `window.__fairView is not a function`, which means the
 * camera rig was never constructed, which means the game route did not boot. Five agents
 * are editing this tree, `src/arena/*` is dirty in six files, and a snapshot freezes the
 * WORKING tree — peers' half-finished edits included. So the failure is as likely to be
 * someone else's as mine, and guessing is how `docs/LESSONS.md` S5 gets paid for twice.
 *
 * This answers it: take a snapshot, revert ONLY my two files inside the frozen copy (the
 * working tree is never touched), and re-run. Same failure => not mine. Also dumps the
 * page's own errors, which is the actual diagnosis rather than a symptom.
 */

import { spawn, execFileSync } from 'node:child_process';
import { writeFileSync } from 'node:fs';
import { resolve } from 'node:path';

const ROOT = resolve(new URL('../..', import.meta.url).pathname);
const revert = process.argv.includes('--revert-mine');

const snap = spawn('node', [`${ROOT}/tools/snapshot.mjs`, '--json'], {
  cwd: ROOT, stdio: ['ignore', 'pipe', 'inherit'],
});
let buf = '';
const info = await new Promise((res, rej) => {
  const t = setTimeout(() => rej(new Error('no URL in 180s')), 180_000);
  snap.stdout.on('data', (c) => {
    buf += c.toString();
    const line = buf.split('\n').find((l) => l.trim().startsWith('{'));
    if (line) { clearTimeout(t); res(JSON.parse(line)); }
  });
  snap.on('exit', (code) => { clearTimeout(t); rej(new Error(`snapshot exited ${code}`)); });
});
console.log(`snapshot ${info.url}${revert ? '  (movement.ts + ai.ts REVERTED to HEAD inside the copy)' : '  (working tree as-is)'}`);

if (revert) {
  for (const rel of ['src/game/movement.ts', 'src/game/ai.ts']) {
    writeFileSync(`${info.dir}/${rel}`, execFileSync('git', ['show', `HEAD:${rel}`], { cwd: ROOT, encoding: 'utf8' }));
  }
}

try {
  const { chromium } = await import('playwright');
  const browser = await chromium.launch({
    args: ['--use-gl=angle', '--use-angle=swiftshader', '--enable-unsafe-swiftshader',
      '--enable-webgl', '--ignore-gpu-blocklist', '--disable-gpu-sandbox'],
  });
  const page = await browser.newPage({ viewport: { width: 1280, height: 720 } });
  const errors = [];
  page.on('pageerror', (e) => errors.push(`PAGEERROR ${String(e).split('\n')[0]}`));
  page.on('console', (m) => { if (m.type() === 'error') errors.push(`CONSOLE ${m.text().split('\n')[0]}`); });
  page.on('response', async (r) => {
    if (r.status() < 400) return;
    let body = '';
    try { body = (await r.text()).split('\n').slice(0, 6).join(' | ').slice(0, 600); } catch { /* ignore */ }
    errors.push(`HTTP ${r.status()} ${r.url().replace(info.url, '')}\n      ${body}`);
  });
  await page.goto(`${info.url}/?player=hamburger&enemy=donut&pointerLock=0`, { waitUntil: 'load', timeout: 90_000 });
  await page.waitForTimeout(12_000);
  const probe = await page.evaluate(() => ({
    gameReady: !!window.__gameReady,
    fairView: typeof window.__fairView,
    stage: typeof window.__stage,
  }));
  console.log(`  __gameReady=${probe.gameReady}  typeof __fairView=${probe.fairView}  typeof __stage=${probe.stage}`);
  console.log(`  page errors (${errors.length}):`);
  for (const e of errors.slice(0, 12)) console.log(`    ${e}`);
  await browser.close();
} finally {
  snap.kill('SIGTERM');
}
process.exit(0);
