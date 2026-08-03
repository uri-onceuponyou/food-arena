#!/usr/bin/env node
/**
 * Drive the live game with Playwright and grab a screenshot on the EXACT frame a
 * named VFX event fires, using the `window.__vfxQaCounts` hook added to
 * `src/game/vfx.ts` for this purpose. Static/randomly-timed screenshots miss brief
 * effects (impact bursts, melee arcs, the giant slam) entirely — this waits on the
 * counter instead of guessing.
 *
 * Usage:
 *   node tools/tmp/vfx_capture.mjs --player lollipop --enemy hamburger \
 *     --weapon 1 --waitFor meleeArc --out shots/vfx/r1/melee.png [--simSpeed 4] \
 *     [--holdMs 4000] [--settleMs 0]
 *
 * `--waitFor` is one of: cast | meleeArc | impact | death | heal | giantSlam
 * `--weapon` is the 1-based weapon slot to select (matches the in-game hotkeys).
 */
import { chromium } from 'playwright';
import { mkdir } from 'node:fs/promises';
import { dirname } from 'node:path';

const LAUNCH_ARGS = [
  '--use-gl=angle', '--use-angle=swiftshader', '--enable-unsafe-swiftshader',
  '--enable-webgl', '--ignore-gpu-blocklist', '--disable-gpu-sandbox',
];

function parseArgs(argv) {
  const out = {};
  for (let i = 2; i < argv.length; i++) {
    const a = argv[i];
    if (!a.startsWith('--')) continue;
    const key = a.slice(2);
    const next = argv[i + 1];
    if (next === undefined || next.startsWith('--')) out[key] = true;
    else { out[key] = next; i++; }
  }
  return out;
}

const args = parseArgs(process.argv);
const BASE = process.env.PREVIEW_BASE ?? 'http://localhost:5173';
const player = args.player ?? 'hamburger';
const enemy = args.enemy ?? 'donut';
const weapon = Number(args.weapon ?? 1);
const waitFor = args.waitFor ?? 'impact';
const out = args.out ?? 'shots/vfx/tmp.png';
const simSpeed = Number(args.simSpeed ?? 3);
const holdMs = Number(args.holdMs ?? 20000);
const w = Number(args.w ?? 1300);
const h = Number(args.h ?? 820);

async function main() {
  await mkdir(dirname(out), { recursive: true });
  const browser = await chromium.launch({ args: LAUNCH_ARGS });
  try {
    await run(browser);
  } finally {
    await browser.close();
  }
}

// Screenshotting under this environment's software (SwiftShader) WebGL renderer can
// take anywhere from ~300ms to several REAL seconds per call (visible as "GPU stall
// due to ReadPixels" in the page's own console). Short-lived VFX (a melee arc is
// ~300ms of SIM time, scaled down further in real time by --simSpeed) are routinely
// already-decayed by the time a screenshot's pixel readback finishes, even when the
// screenshot is requested the instant the QA counter flips. The fix: neuter
// `requestAnimationFrame` the moment we detect the event, which freezes the canvas
// at whatever was already drawn — the frame where the counter just flipped — so the
// screenshot (however long it takes) captures exactly that frame, not whatever the
// live game has moved on to by the time pixels are actually read back.
async function freezeFrame(page) {
  await page.evaluate(() => {
    window.requestAnimationFrame = () => 0;
  });
}

async function run(browser) {
  const page = await browser.newPage({ viewport: { width: w, height: h } });

  const url = `${BASE}/?simSpeed=${simSpeed}&player=${player}&enemy=${enemy}`;
  await page.goto(url, { waitUntil: 'networkidle' });
  await page.waitForFunction(() => window.__gameReady === true, null, { timeout: 15000 });

  // Select weapon slot via keyboard (1-based hotkeys, matches InputController), aim
  // roughly at screen centre-right (toward where the AI enemy usually sits) and hold
  // the attack button down for the whole window. Fired immediately — buildInput() in
  // match.ts only forwards attack/move once state.phase === 'playing', so this just
  // sits harmlessly idle through the ~5.7s (match-local) countdown; the swiftshader
  // software renderer can run well under real-time even with --simSpeed applied
  // (its dt is clamped per frame), so we don't try to precompute a countdown wait —
  // `waitFor`'s own timeout below covers however long that actually takes.
  await page.keyboard.down(String(weapon));
  await page.keyboard.up(String(weapon));
  await page.mouse.move(w * 0.62, h * 0.42);
  await page.mouse.down();
  // The AI enemy often kites at range rather than closing to melee reach on its own
  // (it prefers to keep firing its ranged kit) — hold move-toward-enemy (player
  // spawns facing +x/enemy is further along +x per sim.ts's createMatch) so we
  // actually converge into hit range instead of the two sides whiffing forever.
  if (args.move !== '0') {
    await page.keyboard.down('KeyD');
    await page.keyboard.down('KeyW');
  }

  const start = Date.now();
  let fired = false;
  try {
    await page.waitForFunction(
      (key) => (window.__vfxQaCounts?.[key] ?? 0) > 0,
      waitFor,
      { timeout: holdMs, polling: 16 },
    );
    fired = true;
  } catch {
    fired = false;
  }
  const elapsed = Date.now() - start;

  // Stop input, then IMMEDIATELY freeze the canvas (see freezeFrame's comment above)
  // before the slow screenshot readback gets a chance to let the effect decay.
  await page.mouse.up();
  await page.keyboard.up('KeyD');
  await page.keyboard.up('KeyW');
  await freezeFrame(page);
  await page.screenshot({ path: out });

  const counts = await page.evaluate(() => window.__vfxQaCounts ?? null);

  console.log(JSON.stringify({ out, fired, elapsedMs: elapsed, counts }, null, 2));
  if (!fired) process.exitCode = 1;
}

main().catch((err) => {
  console.error(err);
  process.exitCode = 1;
});
