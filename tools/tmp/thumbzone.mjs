#!/usr/bin/env node
/**
 * Does the match screen's pause chip sit where a thumb lives?
 *
 * STATE.md carries this as a known defect ("matchScreen.ts pause chip sits in the left
 * thumb zone") and `matchScreen.ts`'s own header recorded it as a trade to revisit
 * when touch controls landed. Touch controls have landed: `game/touch.ts` ships twin
 * FLOATING sticks, so the move stick spawns wherever a thumb touches down anywhere in
 * `x < innerWidth * ZONE_SPLIT` (0.5). A control parked in the bottom-left corner is
 * therefore inside the move stick's resting position.
 *
 * "Sits in the thumb zone" is not a measurement, so this makes it one. The zone is
 * defined from touch.ts's own constants plus the reach a thumb actually sweeps from
 * the bottom edge of a phone held in landscape — taken as the lower 45% of the frame,
 * which is where `touch.ts` already places its own move HINT (bottom + 22%, i.e. the
 * middle of that band). Any control overlapping that rectangle fails.
 *
 * Run against a snapshot, on the real match route, with the real HUD mounted:
 *   node tools/tmp/with_snapshot.mjs -- node tools/tmp/thumbzone.mjs --url {URL}
 */

import { chromium } from 'playwright';

const LAUNCH_ARGS = [
  '--use-gl=angle', '--use-angle=swiftshader', '--enable-unsafe-swiftshader',
  '--enable-webgl', '--ignore-gpu-blocklist', '--disable-gpu-sandbox',
];

/** From `src/game/touch.ts`. */
const ZONE_SPLIT = 0.5;
/** How far up the frame a thumb resting on the bottom edge reaches. */
const THUMB_BAND = 0.45;

const args = Object.fromEntries(
  process.argv.slice(2).filter((a) => a.startsWith('--')).map((a, i, all) => {
    const k = a.slice(2);
    const n = process.argv[process.argv.indexOf(a) + 1];
    return [k, n && !n.startsWith('--') ? n : true];
  }),
);
const base = args.url ?? process.env.PREVIEW_BASE ?? 'http://localhost:5173';

const VIEWPORTS = [
  { name: 'phone-land', w: 844, h: 390 },
  { name: 'tablet', w: 1024, h: 768 },
];

const browser = await chromium.launch({ args: LAUNCH_ARGS });
let fails = 0;

for (const vp of VIEWPORTS) {
  for (const touch of [false, true]) {
    const page = await browser.newPage({ viewport: { width: vp.w, height: vp.h }, deviceScaleFactor: 1 });
    await page.goto(`${base}/?screen=match&player=hamburger&enemy=taco&pointerLock=0&simSpeed=0.02`,
      { waitUntil: 'domcontentloaded', timeout: 90000 });
    await page.waitForFunction('window.__gameReady === true', null, { timeout: 120000 });
    // The class hud.ts and matchScreen.ts both key their touch layouts on. Set by
    // capability in the app; forced here because a desktop Chromium reports none.
    if (touch) await page.evaluate(() => document.documentElement.classList.add('fa-touch-capable'));
    await page.waitForTimeout(700);

    const out = await page.evaluate(({ ZONE_SPLIT, THUMB_BAND }) => {
      const W = innerWidth, H = innerHeight;
      const zone = { x0: 0, x1: W * ZONE_SPLIT, y0: H * (1 - THUMB_BAND), y1: H };
      const rectOf = (sel) => {
        const n = document.querySelector(sel);
        if (!n) return null;
        const r = n.getBoundingClientRect();
        return { x: r.x, y: r.y, w: r.width, h: r.height, right: r.right, bottom: r.bottom };
      };
      const overlap = (r) => r && r.right > zone.x0 && r.x < zone.x1 && r.bottom > zone.y0 && r.y < zone.y1;
      const chip = rectOf('.fa-match .match-chip');
      const radar = rectOf('.hud-radar');
      return {
        W, H, zone,
        chip, chipInZone: overlap(chip),
        radar, radarInZone: overlap(radar),
        // Both must still be reachable and inside the frame.
        chipOnScreen: !!chip && chip.x >= 0 && chip.y >= 0 && chip.right <= W && chip.bottom <= H,
        chipSize: chip ? `${Math.round(chip.w)}x${Math.round(chip.h)}` : null,
      };
    }, { ZONE_SPLIT, THUMB_BAND });

    const label = `${vp.name} touch=${touch}`;
    const ok = touch ? !out.chipInZone && out.chipOnScreen : out.chipOnScreen;
    if (!ok) fails++;
    console.log(
      `${ok ? 'PASS' : 'FAIL'}  ${label.padEnd(22)} chip ${out.chipSize} at (${Math.round(out.chip?.x ?? -1)},${Math.round(out.chip?.y ?? -1)})`
      + `  left-thumb-zone x<${Math.round(out.zone.x1)} y>${Math.round(out.zone.y0)}`
      + `  -> ${out.chipInZone ? 'INSIDE THE ZONE' : 'clear'}`
      + `  | radar ${out.radarInZone ? 'in zone' : 'clear'}`,
    );
    await page.close();
  }
}

await browser.close();
console.log(fails ? `\n${fails} failing` : '\nthumb zone clear');
process.exit(fails ? 1 : 0);
