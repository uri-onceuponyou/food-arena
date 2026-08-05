#!/usr/bin/env node
/**
 * Exploratory HUD capture — MID-FIGHT frames, at shipped framing, on a snapshot.
 *
 * The whole point is the state nothing else photographs: `docs/TOOLS.md`'s existing
 * match captures all use `simSpeed=0.02`, which freezes the sim on the COUNTDOWN
 * (`matchshot.mjs` does exactly that) — so every HUD frame this project has ever
 * looked at has a 140px orange "5" over the middle of it and no combat, no fog, no
 * damage numbers and no zone danger. That is not the screen the player looks at.
 *
 * `?fogRadius=` skips the countdown and rewinds the clock to the moment the ring is
 * that wide (match.ts:applyQaSetup), so a fight state is reachable in one navigation
 * instead of waiting out 5.7 s of countdown at SwiftShader's ~9 fps.
 *
 *   node tools/tmp/with_snapshot.mjs -- node tools/tmp/hudshot.mjs --url {URL} --out shots/hud/r0
 */
import { chromium } from 'playwright';
import { mkdirSync, writeFileSync } from 'node:fs';

const LAUNCH_ARGS = [
  '--use-gl=angle', '--use-angle=swiftshader', '--enable-unsafe-swiftshader',
  '--enable-webgl', '--ignore-gpu-blocklist', '--disable-gpu-sandbox',
];

function parseArgs(argv) {
  const out = {};
  for (let i = 2; i < argv.length; i++) {
    const a = argv[i];
    if (!a.startsWith('--')) continue;
    const k = a.slice(2);
    const n = argv[i + 1];
    if (n === undefined || n.startsWith('--')) out[k] = true; else { out[k] = n; i++; }
  }
  return out;
}

const args = parseArgs(process.argv);
const BASE = String(args.url ?? process.env.PREVIEW_BASE ?? '').replace(/\/$/, '');
const OUT = String(args.out ?? 'shots/hud/r0');
mkdirSync(OUT, { recursive: true });

/**
 * Each shot names a viewport, a URL state and how long to let the fight run before
 * the shutter. `wait` is REAL time with simSpeed 1, so effects (damage numbers, the
 * muzzle cone, hit sparks) are at their shipped durations rather than smeared.
 */
const SHOTS = [
  // The PRE-MATCH state. Deliberately no fogRadius, so the sim runs its real
  // COUNTDOWN_FROM (5) x 1000 + COUNTDOWN_START_FLASH_MS (700) = 5,700 ms. Captured
  // because that is 32% of the experience against a 17.9 s mean fight and the HUD is
  // the only thing on screen for it — see the report.
  { key: 'desk-countdown', w: 1600, h: 900, touch: false,
    q: 'player=hamburger&enemy=taco&pointerLock=0', wait: 2500 },
  // The RESULT card. simSpeed fast-forwards a whole match in a few seconds of wall
  // clock; the probe waits for phase === 'ended' rather than for a duration.
  { key: 'desk-ended', w: 1600, h: 900, touch: false,
    q: 'player=hamburger&enemy=taco&pointerLock=0&simSpeed=12', wait: 0, until: 'ended' },
  // Desktop, ordinary mid-fight: ring still wide, both fighters alive and shooting.
  { key: 'desk-mid', w: 1600, h: 900, touch: false,
    q: 'player=hamburger&enemy=taco&pointerLock=0&fogRadius=700', wait: 5000 },
  // Desktop, pointer-locked aim reticle is the one element that only exists under
  // lock; Playwright refuses requestPointerLock, so `aimMode=free` is the closest
  // reachable state. Captured separately because the reticle paints over everything.
  { key: 'desk-late', w: 1600, h: 900, touch: false,
    q: 'player=donut&enemy=pizza&pointerLock=0&fogRadius=260', wait: 5000 },
  // Player standing OUTSIDE the ring: edge burn, chevron, radar danger, zone alarm.
  { key: 'desk-danger', w: 1600, h: 900, touch: false,
    q: 'player=hamburger&enemy=taco&pointerLock=0&fogRadius=300&px=1180&py=820', wait: 3000 },
  // Landscape phone with the touch layout forced on (radar moves to the top right,
  // key badges disappear, 46px slots).
  { key: 'phone-mid', w: 844, h: 390, touch: true,
    q: 'player=sushi&enemy=egg&pointerLock=0&fogRadius=700', wait: 5000 },
  { key: 'phone-danger', w: 844, h: 390, touch: true,
    q: 'player=sushi&enemy=egg&pointerLock=0&fogRadius=300&px=1180&py=820', wait: 3000 },
  // Desktop portrait window — the framing the tray/radar overlap defect was found in.
  { key: 'portrait-mid', w: 430, h: 932, touch: false,
    q: 'player=hotdog&enemy=soup&pointerLock=0&fogRadius=700', wait: 5000 },
];

const browser = await chromium.launch({ args: LAUNCH_ARGS });
const report = [];
for (const s of SHOTS) {
  const page = await browser.newPage({ viewport: { width: s.w, height: s.h }, deviceScaleFactor: 1 });
  const errors = [];
  page.on('pageerror', (e) => errors.push(String(e)));
  await page.goto(`${BASE}/?screen=match&${s.q}`, { waitUntil: 'domcontentloaded', timeout: 120_000 });
  if (s.touch) await page.evaluate(() => document.documentElement.classList.add('fa-touch-capable', 'fa-touch'));
  await page.waitForFunction('window.__gameReady === true', null, { timeout: 180_000 });
  if (s.until) await page.waitForFunction(`window.__matchDebug?.phase === ${JSON.stringify(s.until)}`, null, { timeout: 300_000 });
  await page.waitForTimeout(s.wait);
  const state = await page.evaluate(() => ({
    phase: window.__matchDebug?.phase ?? null,
    fighters: window.__vfxDebugFighters ? JSON.parse(JSON.stringify(window.__vfxDebugFighters)) : null,
    hud: {
      timer: document.querySelector('[data-el="timer"]')?.textContent,
      zoneLabel: document.querySelector('[data-el="zone-label"]')?.textContent,
      zoneValue: document.querySelector('[data-el="zone-value"]')?.textContent,
      countdownShown: getComputedStyle(document.querySelector('[data-el="countdown"]')).display,
      radarDanger: document.querySelector('.hud-radar')?.classList.contains('is-danger'),
    },
  }));
  await page.screenshot({ path: `${OUT}/${s.key}.png`, timeout: 180_000 });
  report.push({ ...s, state, errors });
  console.log(`${s.key.padEnd(14)} phase=${state.phase} timer=${state.hud.timer} zone="${state.hud.zoneLabel} ${state.hud.zoneValue}" countdown=${state.hud.countdownShown} danger=${state.hud.radarDanger}${errors.length ? ` ERRORS ${errors[0]}` : ''}`);
  await page.close();
}
await browser.close();
writeFileSync(`${OUT}/shots.json`, JSON.stringify(report, null, 2));
console.log(`\nwrote ${SHOTS.length} frames to ${OUT}`);
