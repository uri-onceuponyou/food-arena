#!/usr/bin/env node
/**
 * Drive the LIVE game with Playwright, steer the player into the grease puddle
 * (world (560, 900), radius 50 — `kitchen.ts`'s `puddleSouth`) while dodging the AI
 * enemy (spawns clear across the map, and simply beelining toward the puddle walks
 * straight into its effective weapon range and gets the player killed before arrival
 * — verified: a naive "hold right+down the whole way" run died at match-time 0:13
 * every time), then screenshot the exact frame the "standing in a puddle and moving"
 * QA counter (`window.__vfxQaCounts.puddleSplash`, added alongside the new splash
 * VFX in `src/game/vfx.ts`) first flips.
 *
 * Steering reads `window.__vfxDebugFighters` (also added to `vfx.ts` for this
 * purpose — a QA-only per-tick snapshot of both fighters' real x/y/hp, never read by
 * game logic) each poll and picks a movement direction: flee directly away from the
 * enemy when it's within `DANGER_DIST`, otherwise head for the puddle; once within
 * `ARRIVE_DIST` of the puddle centre, orbit slowly to stay inside it (so distance
 * keeps accumulating for the splash counter) rather than drifting back out.
 *
 * Same "freeze rAF the instant the event fires, THEN screenshot" trick as
 * `tools/tmp/vfx_capture.mjs` — screenshot readback under this environment's
 * SwiftShader software renderer can take real seconds, long enough for a short-lived
 * effect to have already decayed by the time pixels are actually read back.
 *
 * Usage:
 *   node tools/tmp/slow_capture.mjs --out shots/slow/r1/character_slowed.png \
 *     [--simSpeed 1] [--holdMs 60000] [--player hamburger] [--enemy donut]
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
const out = args.out ?? 'shots/slow/tmp.png';
const simSpeed = Number(args.simSpeed ?? 1);
const holdMs = Number(args.holdMs ?? 60000);
const w = Number(args.w ?? 1300);
const h = Number(args.h ?? 820);

const PUDDLE = { x: 560, y: 900 };
const DANGER_DIST = 260;
const ARRIVE_DIST = 35;
const POLL_MS = 120;

async function freezeFrame(page) {
  await page.evaluate(() => {
    window.requestAnimationFrame = () => 0;
  });
}

async function main() {
  await mkdir(dirname(out), { recursive: true });
  const browser = await chromium.launch({ args: LAUNCH_ARGS });
  try {
    await run(browser);
  } finally {
    await browser.close();
  }
}

/** Track which movement keys are currently held so we only send the DIFF each poll
 * (repeated keydown on an already-down key is harmless but noisy). */
class Keys {
  constructor(page) { this.page = page; this.held = new Set(); }
  async set(codes) {
    const want = new Set(codes);
    for (const c of this.held) if (!want.has(c)) await this.page.keyboard.up(c);
    for (const c of want) if (!this.held.has(c)) await this.page.keyboard.down(c);
    this.held = want;
  }
  async releaseAll() { await this.set([]); }
}

async function run(browser) {
  const page = await browser.newPage({ viewport: { width: w, height: h } });
  page.on('pageerror', (e) => console.error('page error:', String(e)));

  const url = `${BASE}/?simSpeed=${simSpeed}&player=${player}&enemy=${enemy}`;
  await page.goto(url, { waitUntil: 'networkidle' });
  await page.waitForFunction(() => window.__gameReady === true, null, { timeout: 15000 });

  const keys = new Keys(page);
  let orbitAngle = 0;
  const start = Date.now();
  let fired = false;
  let dead = false;

  while (Date.now() - start < holdMs) {
    const snap = await page.evaluate(() => ({
      fighters: window.__vfxDebugFighters ?? null,
      splash: window.__vfxQaCounts?.puddleSplash ?? 0,
      deathCount: window.__vfxQaCounts?.death ?? 0,
    }));
    if (snap.splash > 0) { fired = true; break; }
    if (snap.deathCount > 0 || (snap.fighters && !snap.fighters.player.alive)) { dead = true; break; }

    if (snap.fighters) {
      const { player: p, enemy: e } = snap.fighters;
      const toPuddleX = PUDDLE.x - p.x;
      const toPuddleY = PUDDLE.y - p.y;
      const distToPuddle = Math.hypot(toPuddleX, toPuddleY);
      const awayX = p.x - e.x;
      const awayY = p.y - e.y;
      const distToEnemy = Math.hypot(awayX, awayY) || 1;

      let mx, my;
      if (distToPuddle < ARRIVE_DIST) {
        // Already inside — orbit slowly around the centre so we KEEP moving (and
        // accumulating splash distance) without drifting back out of the slow zone.
        orbitAngle += 0.9;
        mx = Math.cos(orbitAngle);
        my = Math.sin(orbitAngle);
      } else if (distToEnemy < DANGER_DIST) {
        // Blend "flee the enemy" with "still make progress toward the puddle" —
        // pure fleeing would never arrive, pure beelining is what got the player
        // killed in the very first attempt at this script.
        const fleeX = awayX / distToEnemy;
        const fleeY = awayY / distToEnemy;
        const towardX = toPuddleX / (distToPuddle || 1);
        const towardY = toPuddleY / (distToPuddle || 1);
        const bias = 1 - Math.min(1, distToEnemy / DANGER_DIST); // closer -> more flee
        mx = fleeX * (0.55 + 0.4 * bias) + towardX * (0.45 - 0.4 * bias);
        my = fleeY * (0.55 + 0.4 * bias) + towardY * (0.45 - 0.4 * bias);
      } else {
        mx = toPuddleX / (distToPuddle || 1);
        my = toPuddleY / (distToPuddle || 1);
      }

      const codes = [];
      if (mx > 0.3) codes.push('KeyD');
      if (mx < -0.3) codes.push('KeyA');
      if (my > 0.3) codes.push('KeyS');
      if (my < -0.3) codes.push('KeyW');
      await keys.set(codes);
    }

    await page.waitForTimeout(POLL_MS);
  }

  const elapsed = Date.now() - start;

  // Stop input, then IMMEDIATELY freeze the canvas before the slow screenshot
  // readback gets a chance to let the effect decay (see the file header).
  await keys.releaseAll();
  await freezeFrame(page);
  await page.screenshot({ path: out });

  const finalSnap = await page.evaluate(() => ({
    counts: window.__vfxQaCounts ?? null,
    fighters: window.__vfxDebugFighters ?? null,
  }));

  console.log(JSON.stringify({ out, fired, dead, elapsedMs: elapsed, ...finalSnap }, null, 2));
  if (!fired) process.exitCode = 1;
}

main().catch((err) => {
  console.error(err);
  process.exitCode = 1;
});
