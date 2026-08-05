#!/usr/bin/env node
// Lollipop VFX probe (agent-owned scratch tool).
//
//   --mode self      player=lollipop, we fire the weapon ourselves (caster ON screen)
//   --mode incoming  player=<other>, enemy=lollipop — the AI casts Giant Lollipop from
//                    ~400 wu away, i.e. the CASTER IS OFF SCREEN. This is the mode that
//                    tests the project-wide constraint.
//
// Freeze/unfreeze around each screenshot (borrowed from tools/tmp/vfx_burst.mjs) so a
// sub-second effect is sampled at true game time instead of screenshot latency.
import { chromium } from 'playwright';
import { mkdir } from 'node:fs/promises';

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
const mode = args.mode ?? 'self';
const outDir = args.outDir ?? `shots/vfx/lollipop/${mode}`;
const w = Number(args.w ?? 1600);
const h = Number(args.h ?? 900);
const frames = Number(args.frames ?? 8);
const frameGapMs = Number(args.frameGapMs ?? 55);
const weaponSlot = String(args.weapon ?? '2');
const advanceMs = Number(args.advanceMs ?? 2500);
const waitKey = args.waitFor ?? 'giantSlam';
const hideHud = args.hideHud === true || args.hideHud === 'true';

async function freezeFrame(page) {
  await page.evaluate(() => {
    if (!window.__origRAF) window.__origRAF = window.requestAnimationFrame.bind(window);
    window.__pendingRAF = null;
    window.requestAnimationFrame = (cb) => { window.__pendingRAF = cb; return 0; };
  });
}
async function unfreezeFrame(page) {
  await page.evaluate(() => {
    window.requestAnimationFrame = window.__origRAF;
    if (window.__pendingRAF) {
      const cb = window.__pendingRAF;
      window.__pendingRAF = null;
      window.__origRAF(cb);
    }
  });
}

async function main() {
  await mkdir(outDir, { recursive: true });
  const player = mode === 'incoming' ? (args.player ?? 'donut') : 'lollipop';
  const enemy = mode === 'incoming' ? 'lollipop' : (args.enemy ?? 'donut');

  const browser = await chromium.launch({ args: LAUNCH_ARGS });
  try {
    const page = await browser.newPage({ viewport: { width: w, height: h } });
    page.setDefaultTimeout(60000);
    page.on('pageerror', (err) => console.log('PAGEERROR:', err.message));
    page.on('console', (msg) => {
      if (msg.type() === 'error') console.log('CONSOLE error:', msg.text());
    });
    await page.goto(`${BASE}/?player=${player}&enemy=${enemy}`, { waitUntil: 'networkidle' });
    await page.waitForFunction(() => window.__gameReady === true, null, { timeout: 30000 });
    // Capture the real rAF up front — freeze/unfreeze below swaps it, and grabbing it
    // lazily is fragile if anything else has already touched it.
    await page.evaluate(() => { window.__origRAF ??= window.requestAnimationFrame.bind(window); });
    if (hideHud) {
      await page.addStyleTag({ content: '#hud, .hud, [data-hud] { display: none !important; }' });
    }

    if (mode === 'self') {
      await page.keyboard.press(weaponSlot);
      await page.mouse.move(w * 0.66, h * 0.44);
      // Walk east into the middle of the arena so the framing isn't half apron.
      await page.keyboard.down('KeyD');
      await page.waitForTimeout(advanceMs);
      await page.keyboard.up('KeyD');
      await page.mouse.down();
    } else {
      // Idle-ish: drift east a little so we meet nearer the arena centre, then stop
      // and let the AI close to its 400 wu Giant Lollipop range and fire.
      await page.keyboard.down('KeyD');
      await page.waitForTimeout(advanceMs);
      await page.keyboard.up('KeyD');
    }

    await page.waitForFunction(
      (key) => (window.__vfxQaCounts?.[key] ?? 0) > 0,
      waitKey,
      { timeout: 90000, polling: 25 },
    );

    const at = await page.evaluate(() => {
      const f = window.__vfxDebugFighters;
      if (!f) return null;
      const d = Math.hypot(f.player.x - f.enemy.x, f.player.y - f.enemy.y);
      return { player: { x: Math.round(f.player.x), y: Math.round(f.player.y) },
               enemy: { x: Math.round(f.enemy.x), y: Math.round(f.enemy.y) },
               distanceWU: Math.round(d) };
    });

    if (mode === 'self') await page.mouse.up();
    console.log('rafType at capture =', await page.evaluate(() => typeof window.requestAnimationFrame));

    for (let i = 0; i < frames; i++) {
      if (i > 0) await page.waitForTimeout(frameGapMs);
      await freezeFrame(page);
      await page.screenshot({ path: `${outDir}/f${String(i).padStart(2, '0')}.png`, timeout: 30000 });
      await unfreezeFrame(page);
    }

    const counts = await page.evaluate(() => window.__vfxQaCounts ?? null);
    console.log(JSON.stringify({ mode, player, enemy, at, counts }, null, 2));
  } finally {
    await browser.close();
  }
}

main().catch((err) => { console.error(err); process.exitCode = 1; });
