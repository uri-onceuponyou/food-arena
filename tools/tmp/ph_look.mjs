#!/usr/bin/env node
/**
 * ph_look.mjs — WHAT THE PHONE TIER ACTUALLY LOOKS LIKE, at the moment of a hit.
 *
 * Uri's first report was *"VFX looks clunky"*. He later revised the headline to the
 * browser chrome, but "clunky" was a VISUAL report and no frame-time number answers a
 * visual report (`docs/AGENT-BRIEF.md` §4.1 — read every PNG and look at it).
 *
 * There is a specific reason to suspect the picture rather than the pacing: `auto`
 * puts every phone on `low` (`src/render/quality.ts:333`), and `low` is the ONLY tier
 * with **`bloom: false`** and **`smaa: false`** at a **1.25 pixel-ratio cap**
 * (`quality.ts:209-221`). The game's impact VFX are authored as hot highlights, and
 * bloom is what makes a hot highlight read as light rather than as a bright polygon.
 * So a phone may be seeing a materially different image from the one every reference
 * plate and every critic round was scored on.
 *
 * ── The trigger ─────────────────────────────────────────────────────────────
 * Screenshots of live combat are a lottery. This waits for
 * `window.__feelDebug.hitStopBudgetMs > 0` — hit-stop is armed by `handleEvents` the
 * instant a hit lands — so every frame captured is a frame with an impact in it, by
 * construction rather than by timing luck.
 *
 * ⚠️ NOT a pixel A/B. Camera shake re-randomises per render (`AGENT-BRIEF` §3) and the
 * two arms are two different matches, so these are for LOOKING AT, never for diffing.
 *
 *   node tools/tmp/ph_look.mjs                    # low vs high, iPhone 15 landscape
 *   node tools/tmp/ph_look.mjs --shots 6
 */
import { chromium, devices } from 'playwright';
import { mkdirSync, readFileSync, existsSync } from 'node:fs';
import { tmpdir } from 'node:os';
import { join, resolve } from 'node:path';

const ROOT = resolve(new URL('../..', import.meta.url).pathname);
const argv = process.argv.slice(2);
const arg = (k, d) => (argv.includes(`--${k}`) ? argv[argv.indexOf(`--${k}`) + 1] : d);

// Session scratchpads are cleaned; `docs/AGENT-BRIEF.md` opens with a brief that
// silently vanished from one. So the state path is durable by default and the
// scratchpad is opt-in via PH_SCRATCH.
const SCRATCH = process.env.PH_SCRATCH ?? join(tmpdir(), 'fa-ph');
const STATE = join(SCRATCH, 'ph-serve.json');
const BASE = arg('url', null) ?? process.env.PREVIEW_BASE
  ?? (existsSync(STATE) ? JSON.parse(readFileSync(STATE, 'utf8')).url : null);
if (!BASE) { console.error('ph_look: run `node tools/tmp/ph_serve.mjs --start` first.'); process.exit(2); }

const OUT = join(ROOT, 'shots', 'ph');
mkdirSync(OUT, { recursive: true });
const DEV = arg('device', 'iPhone 15 landscape');
const SHOTS = Number(arg('shots', 4));

for (const tier of ['low', 'high']) {
  const browser = await chromium.launch({
    headless: true,
    args: ['--use-angle=metal', '--enable-gpu', '--ignore-gpu-blocklist', '--disable-gpu-sandbox'],
  });
  const ctx = await browser.newContext({ ...devices[DEV] });
  const page = await ctx.newPage();
  await page.goto(`${BASE}/?player=hamburger&enemy=donut&simSpeed=3&tier=${tier}`,
    { waitUntil: 'domcontentloaded' });
  await page.waitForFunction('window.__gameReady === true', null, { timeout: 120_000 });
  await page.waitForFunction(`document.querySelector('.hud-countdown')?.style.display === 'none'`,
    null, { timeout: 40_000 }).catch(() => {});

  let n = 0;
  const deadline = Date.now() + 60_000;
  while (n < SHOTS && Date.now() < deadline) {
    const hit = await page.waitForFunction(
      'window.__feelDebug && window.__feelDebug.hitStopBudgetMs > 0',
      null, { timeout: 20_000, polling: 16 },
    ).catch(() => null);
    if (!hit) break;
    const f = join(OUT, `look-${tier}-hit${n}.png`);
    await page.screenshot({ path: f });
    console.log(`${tier}  hit ${n}  ${f}`);
    n++;
    // Wait for hit-stop to clear so the next wait is a NEW hit, not the same one.
    await page.waitForFunction('window.__feelDebug.hitStopBudgetMs <= 0', null,
      { timeout: 5000, polling: 16 }).catch(() => {});
  }
  if (n === 0) console.log(`${tier}: no hit landed inside the window — nothing captured.`);
  await browser.close();
}
