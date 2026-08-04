#!/usr/bin/env node
/**
 * Does the zone pill's `is-imminent` alarm cry wolf?
 *
 * The threshold used to be a flat 12_000 ms, calibrated when the ring crept at
 * 4.9 wu/s. `MATCH_DURATION_MS` is now 45 s and `MAX_SAFE_RADIUS` derives from it, so
 * the ring sweeps 22.1 wu/s and that same 12 s becomes 265 wu of grace — most of the
 * standing positions inside the opening ring, and 33% wider than the radius the camera
 * guarantees the player can see (FAIR_PLAY.radiusUnits). A warning about an invisible
 * curtain, running most of the match.
 *
 * This sweeps the player's distance from the ring centre through the REAL hud.ts and
 * reads `is-imminent` off the DOM, so it measures the shipped rule rather than
 * re-implementing it. It reports:
 *
 *   graceWu     the largest (safeRadius - dist) at which the alarm is still on
 *   alarmShare  fraction of the ring's AREA that alarms, at several ring radii
 *   holdsBelow  the distance under which the readout stops predicting an arrival
 *               (should equal MIN_SAFE_RADIUS: the ring floors and never gets there)
 *
 * PASS = graceWu <= FAIR_PLAY.radiusUnits, i.e. the pill never warns about an edge
 * the player is not even guaranteed to be able to see.
 *
 *   node tools/tmp/zone_warn.mjs --url <base> --maxr 993
 */
import { chromium } from 'playwright';

const args = process.argv.slice(2);
const arg = (k, d = null) => { const i = args.indexOf(k); return i >= 0 ? args[i + 1] : d; };
const BASE = arg('--url', 'http://localhost:5173');
const MAXR = Number(arg('--maxr', 993));

const browser = await chromium.launch();
const page = await browser.newPage({ viewport: { width: 1280, height: 720 }, deviceScaleFactor: 1 });
await page.goto(`${BASE}/tools/tmp/hud_harness.html`, { waitUntil: 'load' });
await page.waitForFunction(() => window.__harnessReady === true, null, { timeout: 30000 });

const { clock, fair } = await page.evaluate(() => ({
  clock: window.__matchDurationMs,
  fair: window.__fairRadiusUnits,
}));
const sweep = MAXR / clock; // wu per ms
console.log(`clock=${clock}ms  maxSafeRadius=${MAXR}wu  sweep=${(sweep * 1000).toFixed(1)} wu/s  fairRadius=${fair.toFixed(1)}wu`);

async function probe(safeRadius, dist) {
  return page.evaluate(
    (o) => {
      window.__hudSet({ safeRadius: o.safeRadius, maxSafeRadius: o.maxR, px: 700 + o.dist, py: 500, timeRemaining: 1000, elapsed: 1000 });
      const z = document.querySelector('.hud-zone');
      return {
        imminent: z.classList.contains('is-imminent'),
        danger: z.classList.contains('is-danger'),
        value: document.querySelector('[data-el="zone-value"]').textContent,
      };
    },
    { safeRadius, dist, maxR: MAXR }
  );
}

let graceWu = 0;
let holdsBelow = null;
console.log('\n  ringR   alarmFrom   graceWu   alarmShareOfArea');
for (const R of [MAXR, MAXR * 0.75, MAXR * 0.5, MAXR * 0.25]) {
  let firstAlarmDist = null;
  for (let d = 0; d <= R; d += 2) {
    const r = await probe(R, d);
    if (r.value === 'FINAL RING' && holdsBelow === null) holdsBelow = null; // recorded below
    if (r.imminent && firstAlarmDist === null) firstAlarmDist = d;
  }
  const g = firstAlarmDist === null ? 0 : R - firstAlarmDist;
  graceWu = Math.max(graceWu, g);
  const share = firstAlarmDist === null ? 0 : 1 - (firstAlarmDist / R) ** 2;
  console.log(
    `  ${String(Math.round(R)).padStart(5)}   ${String(firstAlarmDist === null ? '-' : Math.round(firstAlarmDist)).padStart(9)}   ` +
      `${String(Math.round(g)).padStart(7)}   ${(share * 100).toFixed(1)}%`
  );
}

// Where does the readout stop predicting an arrival? Should be MIN_SAFE_RADIUS.
let holds = null;
for (let d = 0; d <= MAXR; d += 1) {
  const r = await probe(MAXR, d);
  if (r.value !== 'FINAL RING') { holds = d - 1; break; }
}
console.log(`\n  "FINAL RING" shown for dist <= ${holds}wu  (should be MIN_SAFE_RADIUS)`);
console.log(`  worst graceWu = ${Math.round(graceWu)}  vs fairRadius ${fair.toFixed(1)}  -> ${graceWu <= fair + 2 ? 'PASS' : 'FAIL'}`);

await browser.close();
process.exit(graceWu <= fair + 2 ? 0 : 1);
