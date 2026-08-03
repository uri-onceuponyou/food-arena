#!/usr/bin/env node
// TEMP: verify the bespoke WeaponVfx hooks actually fire on a REAL connecting hit
// (not just that spawnCastFlash/spawnImpactBurst were CALLED, which the QA counters
// track regardless of generic-vs-bespoke, and regardless of which fighter got hit).
// Actively chases the enemy toward weapon range using `__vfxDebugFighters` world
// positions (move axes are world-space x/y directly, per `input.ts`/`movement.ts` —
// no camera-relative transform), since a fixed diagonal hold can drift away from a
// kiting ranged AI enemy.
import { chromium } from 'playwright';

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
const weapon = Number(args.weapon ?? 2);
const simSpeed = Number(args.simSpeed ?? 2);
const holdMs = Number(args.holdMs ?? 45000);

async function main() {
  const browser = await chromium.launch({ args: LAUNCH_ARGS });
  try {
    const page = await browser.newPage({ viewport: { width: 1300, height: 820 } });
    await page.goto(`${BASE}/?simSpeed=${simSpeed}&player=${player}&enemy=${enemy}`, { waitUntil: 'networkidle' });
    await page.waitForFunction(() => window.__gameReady === true, null, { timeout: 15000 });

    await page.keyboard.down(String(weapon));
    await page.keyboard.up(String(weapon));
    await page.mouse.down();

    const held = new Set();
    async function setKeys(wantX, wantY) {
      const want = new Set();
      if (wantX < 0) want.add('KeyA'); if (wantX > 0) want.add('KeyD');
      if (wantY < 0) want.add('KeyW'); if (wantY > 0) want.add('KeyS');
      for (const k of held) if (!want.has(k)) { await page.keyboard.up(k); held.delete(k); }
      for (const k of want) if (!held.has(k)) { await page.keyboard.down(k); held.add(k); }
    }

    const start = Date.now();
    let landedOwnHit = false;
    while (Date.now() - start < holdMs) {
      const fighters = await page.evaluate(() => window.__vfxDebugFighters ?? null);
      if (fighters) {
        const dx = fighters.enemy.x - fighters.player.x;
        const dy = fighters.enemy.y - fighters.player.y;
        await setKeys(dx, dy);
        // Keep aim roughly pointed at the enemy's on-screen-ish direction too —
        // simplest reliable proxy: move the mouse toward the side the enemy is on.
        await page.mouse.move(650 + Math.sign(dx || 1) * 300, 344 + Math.sign(dy || 1) * 150);
      }
      const enemyHp = fighters?.enemy.hp;
      if (enemyHp !== undefined && enemyHp < 150) { landedOwnHit = true; break; }
      await page.waitForTimeout(120);
    }

    await setKeys(0, 0);
    await page.mouse.up();

    const debug = await page.evaluate(() => ({
      qa: window.__vfxQaCounts ?? null,
      bespokeProjectile: window.__bespokeVfxDebug ?? 0,
      bespokeCast: window.__bespokeVfxDebugCast ?? 0,
      bespokeImpact: window.__bespokeVfxDebugImpact ?? 0,
      fighters: window.__vfxDebugFighters ?? null,
    }));
    console.log(JSON.stringify({ player, enemy, weapon, landedOwnHit, debug }, null, 2));
  } finally {
    await browser.close();
  }
}

main().catch((err) => { console.error(err); process.exitCode = 1; });
