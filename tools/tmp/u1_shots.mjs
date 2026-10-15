#!/usr/bin/env node
/**
 * u1_shots — look-at-it captures of home + character select for the U1 menu pass.
 *
 * NOT the scoring instrument (`rv_capture.mjs` is, and its frames are the before/after of
 * record). This is the fast loop: the same seeded profile (`q1_capture`'s SEEDED_PROFILE
 * through `rv_capture`'s exporter), at the scored phone geometry (852x393 @3), the desktop
 * frame (1600x900 @1) and the phone Uri actually plays on, in PORTRAIT (390x844 @3).
 *
 *   node tools/tmp/sx_snap.mjs --root <wt> -- node tools/tmp/u1_shots.mjs --url '{URL}' --out <dir>
 *     [--only home|characters] [--geo phone,desk,port] [--char <id>]
 */
import { chromium } from 'playwright';
import { mkdir } from 'node:fs/promises';
import { join, resolve } from 'node:path';
import { fileURLToPath } from 'node:url';
import { settleScreen, waitForRoster } from './settle.mjs';
import { q1SeededProfile } from './rv_capture.mjs';

const LAUNCH_ARGS = [
  '--use-gl=angle', '--use-angle=swiftshader', '--enable-unsafe-swiftshader',
  '--enable-webgl', '--ignore-gpu-blocklist', '--disable-gpu-sandbox',
];
const GEOS = {
  phone: { W: 852, H: 393, DSF: 3 },
  desk: { W: 1600, H: 900, DSF: 1 },
  port: { W: 390, H: 844, DSF: 3 },
};

async function main() {
  const argv = process.argv.slice(2);
  const arg = (k, d = null) => { const i = argv.indexOf(k); return i >= 0 ? argv[i + 1] : d; };
  const BASE = arg('--url', process.env.PREVIEW_BASE);
  if (!BASE || /:5173\b/.test(BASE)) { console.error('u1_shots: --url <snapshot> required — never :5173'); process.exit(2); }
  const out = arg('--out', null);
  if (!out) { console.error('u1_shots: --out <dir> required'); process.exit(2); }
  await mkdir(out, { recursive: true });
  const screens = arg('--only', null) ? [arg('--only')] : ['home', 'characters'];
  const geos = (arg('--geo', 'phone,desk,port')).split(',');
  const charId = arg('--char', null);
  const profile = q1SeededProfile();
  const browser = await chromium.launch({ args: LAUNCH_ARGS });
  try {
    for (const g of geos) {
      const geo = GEOS[g];
      if (!geo) throw new Error(`unknown --geo ${g}`);
      const ctx = await browser.newContext({ viewport: { width: geo.W, height: geo.H }, deviceScaleFactor: geo.DSF });
      await ctx.addInitScript((p) => { try { localStorage.setItem('food-arena.profile.v1', JSON.stringify(p)); } catch {} }, profile);
      const page = await ctx.newPage();
      for (const screen of screens) {
        await page.goto(`${BASE}/?screen=${screen}`, { waitUntil: 'networkidle', timeout: 60000 });
        await page.waitForFunction('window.__previewReady === true', null, { timeout: 60000 });
        await settleScreen(page, { label: `${g}/${screen}`, timeout: 90000 });
        if (screen === 'characters') {
          await waitForRoster(page, { timeout: 240000 });
          if (charId) await page.click(`.fa-chars .chars-card[data-char="${charId}"]`);
        }
        // let the hero's entrance pop finish and the sway reach a readable pose
        await page.waitForTimeout(1200);
        const file = join(out, `${screen}_${g}.png`);
        await page.screenshot({ path: file });
        console.log(`wrote ${file}`);
      }
      await ctx.close();
    }
  } finally {
    await browser.close();
  }
}

const isMain = (() => {
  try { return resolve(process.argv[1] ?? '') === fileURLToPath(import.meta.url); } catch { return false; }
})();
if (isMain) await main();
