#!/usr/bin/env node
/**
 * mg_fog.mjs — DOES THE BOUNDARY EXIST AT THE ONE RADIUS THAT MATTERS?
 *
 * `arena/fogRing.ts:update` opened with `const wanted = active && safeRadiusUnits > 0`
 * and ramped the WHOLE boundary out when that was false. Sudden death drives the ring
 * to exactly 0 — so the fog vanished at the instant it was supposed to swallow the
 * arena, while the HUD still read "OUTSIDE THE ZONE −50 HP/s". `match.ts` shipped a
 * presentation-layer workaround (`fogDisplayRadius()` hands the ring 1e-6 instead of 0)
 * and a QA escape hatch (`?fogRingRaw=1`) that hands it the sim's literal radius, so the
 * defect stays REPRODUCIBLE rather than merely described.
 *
 * This shoots the four cells that pin it down, on TWO builds:
 *
 *                          raw path (?fogRingRaw=1)      workaround path
 *   before the fix         BROKEN — no boundary          correct
 *   after  the fix         correct                       correct  (workaround now dead)
 *
 * ── VALIDATION ──────────────────────────────────────────────────────────────
 * The known-bad is not synthesised: it is the OLD BUILD on the raw path, and the
 * measurement is only believed because that cell reproduces the fault. A run in which
 * the known-bad cell renders correctly means the harness is not reaching the defect and
 * NOTHING else in the table may be quoted. `--baseline <url>` supplies it.
 *
 * Mean luma is the statistic because the fault is "a canopy over the whole screen is
 * missing", which is a whole-frame brightness question, and because it is what the
 * out-of-set report that found this quoted (130.6 broken / 132.3 no-fog / 72.0 correct).
 *
 * ── USAGE ───────────────────────────────────────────────────────────────────
 *   MG_SCRATCH=<dir> node tools/tmp/mg_fog.mjs --baseline http://127.0.0.1:PORT
 */
import { chromium } from 'playwright';
import { readFileSync, existsSync, mkdirSync, writeFileSync } from 'node:fs';
import { tmpdir } from 'node:os';
import { join } from 'node:path';
import sharp from 'sharp';

const argv = process.argv.slice(2);
const arg = (k, d) => (argv.includes(`--${k}`) ? argv[argv.indexOf(`--${k}`) + 1] : d);

const SCRATCH = process.env.MG_SCRATCH ?? join(tmpdir(), 'fa-mg');
const STATE = join(SCRATCH, 'mg-serve.json');
const FIXED = arg('url', existsSync(STATE) ? JSON.parse(readFileSync(STATE, 'utf8')).url : null);
const BASE = arg('baseline', null);
if (!FIXED) { console.error('mg_fog: no mg_serve running and no --url'); process.exit(2); }
const OUT = arg('out', 'shots/mg');
const UA = 'Mozilla/5.0 (iPhone; CPU iPhone OS 17_5 like Mac OS X) AppleWebKit/605.1.15'
  + ' (KHTML, like Gecko) Version/17.5 Mobile/15E148 Safari/604.1';

// ⚠️ `&simSpeed=0.05` IS LOAD-BEARING, NOT TIDINESS. Sudden death does 50 HP/s to
// everyone, so at real speed the lower-HP fighter is dead and `phase` is 'ended' within
// about two seconds — and `fogRing.update`'s `active` flag IS `phase === 'playing'`, so
// the boundary correctly fades out. The first run of this tool captured at 2 500 ms and
// measured SIX cells of an ended match: identical luma on both builds, both paths, and a
// PASS on the known-bad reproduction that was really "the fog is gone because the match
// is over". Slowing the sim 20x keeps the sudden-death frame on screen long enough to
// photograph the thing under test.
const CELLS = [
  { id: 'raw_r0', q: '&fogRadius=0&fogRingRaw=1&simSpeed=0.05' }, // the defect's own reproduction
  { id: 'wa_r0', q: '&fogRadius=0&simSpeed=0.05' },               // through match.ts's workaround
  { id: 'nofog', q: '&simSpeed=0.05' },                           // wide ring, the no-fog control
];

async function shoot(browser, base, q) {
  const ctx = await browser.newContext({
    viewport: { width: 844, height: 390 }, deviceScaleFactor: 3,
    isMobile: true, hasTouch: true, userAgent: UA,
  });
  const page = await ctx.newPage();
  const logs = [];
  page.on('console', (m) => { if (/QA|fog/i.test(m.text())) logs.push(m.text().slice(0, 160)); });
  await page.goto(base + '/?player=hamburger&enemy=donut' + q, { waitUntil: 'domcontentloaded' });
  await page.waitForFunction('window.__gameReady === true', null, { timeout: 180_000 });
  await page.waitForFunction(`document.querySelector('.hud-countdown')?.style.display === 'none'`,
    null, { timeout: 60_000 }).catch(() => {});
  await page.waitForTimeout(900);
  const info = await page.evaluate(`(() => {
    const st = (window.__stages ? [...window.__stages].find((s) => !s.offscreen) : null) || window.__stage;
    let fog = null; st.scene.traverse((o) => { if (!fog && o.name === 'fog_boundary') fog = o; });
    const d = window.__matchDebug;
    if (d) d.paused = true;   // hold the frame before sudden death resolves the match
    return {
      safeRadius: fog ? Math.round((fog.children.find((c) => c.name && c.name.indexOf('curtain') >= 0) || { scale: { x: -1 } }).scale.x * 100) / 100 : null,
      phase: d ? d.phase : null,
      fogVisible: fog ? fog.visible : 'no fog_boundary in scene',
      fogChildren: fog ? fog.children.filter((c) => c.visible).length : -1,
      hud: (document.querySelector('.hud-zone-warning') || {}).textContent || null,
    };
  })()`);
  const png = Buffer.from((await page.evaluate(`(() => {
    const st = (window.__stages ? [...window.__stages].find((s) => !s.offscreen) : null) || window.__stage;
    return st.renderer.domElement.toDataURL('image/png');
  })()`)).split(',')[1], 'base64');
  await ctx.close();
  return { info, png, logs };
}

async function luma(buf) {
  const { data, info } = await sharp(buf).ensureAlpha().raw().toBuffer({ resolveWithObject: true });
  let s = 0;
  const px = info.width * info.height;
  for (let i = 0; i < px; i++) s += 0.2126 * data[i * 4] + 0.7152 * data[i * 4 + 1] + 0.0722 * data[i * 4 + 2];
  return s / px;
}

const browser = await chromium.launch({
  headless: true,
  args: ['--use-angle=metal', '--enable-gpu', '--ignore-gpu-blocklist', '--disable-gpu-sandbox'],
});
mkdirSync(OUT, { recursive: true });
const rows = [];
try {
  for (const [armLabel, url] of [['BEFORE (known-bad build)', BASE], ['AFTER  (>= 0)', FIXED]]) {
    if (!url) continue;
    for (const c of CELLS) {
      const r = await shoot(browser, url, c.q);
      const L = await luma(r.png);
      const file = join(OUT, `fog_${armLabel.startsWith('BEFORE') ? 'before' : 'after'}_${c.id}.png`);
      writeFileSync(file, r.png);
      rows.push({ arm: armLabel, cell: c.id, luma: L, ...r.info, file });
    }
  }
} finally {
  await browser.close();
}
console.log('\n══ mg_fog — mean luma of the whole frame, sudden-death radius ══');
for (const r of rows) {
  console.log(`   ${r.arm.padEnd(24)} ${r.cell.padEnd(8)} luma ${r.luma.toFixed(1).padStart(6)}`
    + `   safeRadius ${String(r.safeRadius).padStart(8)}   phase ${String(r.phase).padEnd(9)}`
    + `   fog_boundary.visible ${String(r.fogVisible).padEnd(5)} (${r.fogChildren} visible children)`);
}
const g = (arm, cell) => rows.find((r) => r.arm.startsWith(arm) && r.cell === cell);
if (BASE) {
  const bad = g('BEFORE', 'raw_r0'), ctrl = g('BEFORE', 'nofog'), fix = g('AFTER', 'raw_r0');
  const reproduced = Math.abs(bad.luma - ctrl.luma) < 5;
  console.log(`\n   KNOWN-BAD REPRODUCES: ${reproduced ? '✅' : '🚨'} the old build on the raw path renders at luma `
    + `${bad.luma.toFixed(1)} against a no-fog control of ${ctrl.luma.toFixed(1)} — ${reproduced ? 'the same picture' : 'NOT the same picture, do not quote this table'}`);
  console.log(`   FIX HOLDS:            ${fix.luma < ctrl.luma - 20 ? '✅' : '🚨'} the new build on the SAME url renders at luma ${fix.luma.toFixed(1)}`);
}
console.log(`\n   PNGs in ${OUT}/fog_*.png — read them.`);
