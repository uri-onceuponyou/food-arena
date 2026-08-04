#!/usr/bin/env node
/**
 * Radar zone-readability probe — the acceptance instrument for docs/STATE.md bug 5.
 *
 * WHY THIS EXISTS
 * ---------------
 * `hud.ts` renders the closing-fog safe zone as a disc sized `(2R / arena.width)` of the
 * radar box. `MAX_SAFE_RADIUS` is DERIVED as `halfDiagonal / (1 - firstContactS*1000/T)`
 * and is therefore ALWAYS larger than the arena's own half-diagonal — so at t=0 the disc
 * is wider than the widget, `overflow: hidden` clips it, and the whole card is a flat
 * cream rectangle. "How much has the zone closed" has no answer in pixels for the first
 * third of every match. Shortening the clock makes it WORSE, because R0 grows.
 *
 * It renders the HUD through `tools/tmp/hud_harness.html` — the radar is pure DOM/CSS,
 * so the pixels are identical to the game's, but a sample costs ~80 ms instead of ~40 s
 * of SwiftShader boot, and the schedule can be driven directly. That is what makes it
 * possible to verify at TWO different `MATCH_DURATION_MS` values without editing
 * `rules.ts`, which a peer agent owns.
 *
 * METRICS (per sample, measured on the rendered PNG at deviceScaleFactor 1)
 *   safeFrac  fraction of the card classified bright/safe (fighter dots excluded)
 *   edgePx    px from the card centre to the safe/lethal boundary along +x.
 *             `null` = the boundary is OFF THE CARD: the player cannot see where the
 *             zone edge is at all. THIS IS THE HEADLINE NUMBER.
 *   deltaPx   pixels whose class changed vs the previous sample — "does it move?"
 *
 * USAGE
 *   node tools/tmp/radar_probe.mjs --url <base> --dir <servedTree> \
 *        --out shots/radar/<tag> --label <tag> [--clock 180000]
 */
import { chromium } from 'playwright';
import sharp from 'sharp';
import { readFileSync, mkdirSync, writeFileSync } from 'node:fs';
import { join } from 'node:path';

const args = process.argv.slice(2);
const arg = (k, d = null) => {
  const i = args.indexOf(k);
  return i >= 0 ? args[i + 1] : d;
};

const BASE = arg('--url', 'http://localhost:5173');
const DIR = arg('--dir', process.cwd());
const OUT = arg('--out', 'shots/radar/probe');
const LABEL = arg('--label', 'run');
mkdirSync(OUT, { recursive: true });

// ── Constants, read from the SERVED tree ─────────────────────────────────────
// Never hardcoded: a peer changed MATCH_DURATION_MS 180_000 -> 45_000 mid-session and
// MAX_SAFE_RADIUS is DERIVED from it, so a literal here would measure a schedule that
// no longer exists.
const rules = readFileSync(join(DIR, 'src/game/rules.ts'), 'utf8');
const shared = readFileSync(join(DIR, 'src/arena/shared.ts'), 'utf8');
const num = (src, name) => {
  const m = src.match(new RegExp(`export const ${name}\\s*=\\s*([0-9_.]+)`));
  if (!m) throw new Error(`could not read ${name}`);
  return Number(m[1].replace(/_/g, ''));
};
const TREE_CLOCK = num(rules, 'MATCH_DURATION_MS');
const MIN_SAFE_RADIUS = num(rules, 'MIN_SAFE_RADIUS');
const ARENA_W = num(shared, 'ARENA_W');
const ARENA_H = num(shared, 'ARENA_H');
const FOG_FIRST_CONTACT_S = num(shared, 'FOG_FIRST_CONTACT_S');
const HALF_DIAG = Math.hypot(ARENA_W / 2, ARENA_H / 2);

const CLOCK = Number(arg('--clock', TREE_CLOCK));
const MAX_SAFE_RADIUS = Math.round(HALF_DIAG / (1 - (FOG_FIRST_CONTACT_S * 1000) / CLOCK));

console.log(
  `constants: clock=${CLOCK}ms (tree=${TREE_CLOCK}) ARENA=${ARENA_W}x${ARENA_H} ` +
    `halfDiag=${HALF_DIAG.toFixed(1)} R0=${MAX_SAFE_RADIUS} minR=${MIN_SAFE_RADIUS}`
);

// The sim's schedule, reproduced exactly (sim.ts:103).
const radiusAt = (ms) =>
  Math.max(MIN_SAFE_RADIUS, MAX_SAFE_RADIUS * (1 - Math.min(1, ms / CLOCK)));

const FRACTIONS = [0, 0.25, 0.5, 0.75, 1];
const samples = FRACTIONS.map((p) => ({
  key: `p${String(Math.round(p * 100)).padStart(3, '0')}`,
  note: `${(p * 100).toFixed(0)}% (t=${((p * CLOCK) / 1000).toFixed(1)}s)`,
  ms: p * CLOCK,
}));
// Plus the wall-clock moment the ring first touches the arena's corners. On any clock
// this is the first instant the OLD widget could show anything at all.
samples.splice(1, 0, {
  key: `tfc`,
  note: `first contact (t=${FOG_FIRST_CONTACT_S}s)`,
  ms: FOG_FIRST_CONTACT_S * 1000,
});

// ── Pixel classification ─────────────────────────────────────────────────────
// safe disc  #F2E0BE (242,224,190) luma ~224
// lethal     #2A0B47 ( 42, 11, 71) luma ~ 24
// ring/glow  #E9A6FF                     -> counted safe (it IS the boundary)
// dots       green #16C46F / red #E6493F -> excluded, they are not zone information
const luma = (r, g, b) => 0.2126 * r + 0.7152 * g + 0.0722 * b;
const isDot = (r, g, b) =>
  g - Math.max(r, b) > 30 || (r - g > 60 && r - b > 40 && r > 120) || (r > 205 && g > 205 && b > 205);

function analyse(raw, w, h, chan) {
  let safe = 0;
  let counted = 0;
  const cls = new Uint8Array(w * h); // 0 lethal, 1 safe, 2 excluded
  for (let y = 0; y < h; y++) {
    for (let x = 0; x < w; x++) {
      const i = (y * w + x) * chan;
      const r = raw[i], g = raw[i + 1], b = raw[i + 2];
      if (isDot(r, g, b)) { cls[y * w + x] = 2; continue; }
      counted++;
      if (luma(r, g, b) > 140) { safe++; cls[y * w + x] = 1; }
    }
  }
  const cx = Math.floor(w / 2);
  const cy = Math.floor(h / 2);
  let edgePx = null;
  let run = 0;
  for (let x = cx; x < w; x++) {
    const c = cls[cy * w + x];
    if (c === 0) { run++; if (run >= 3) { edgePx = x - 2 - cx; break; } }
    else if (c === 1) run = 0;
  }
  return { safeFrac: safe / counted, edgePx, cls };
}

// ── Capture ──────────────────────────────────────────────────────────────────
const browser = await chromium.launch();
const page = await browser.newPage({
  viewport: { width: Number(arg('--vw', 1000)), height: Number(arg('--vh', 700)) },
  deviceScaleFactor: 1,
});
const errs = [];
page.on('pageerror', (e) => errs.push(String(e)));
page.on('console', (m) => { if (m.type() === 'error') errs.push(m.text()); });

await page.goto(`${BASE}/tools/tmp/hud_harness.html${args.includes('--touch') ? '?touch=1' : ''}`, { waitUntil: 'load' });
await page.waitForFunction(() => window.__harnessReady === true, null, { timeout: 30000 });

const results = [];
let prevCls = null;
let prevDims = null;

for (const s of samples) {
  const radius = radiusAt(s.ms);
  // Dots OFF for the geometry samples. Their 2px near-black borders are ~350 dark px
  // and sit on the scan row, which both floors `safeFrac` at 0.979 when the card is in
  // fact 100% cream and gives a false "boundary" at 62px. The zone read is measured on
  // its own; dot legibility is checked separately in the `outside` frame below.
  await page.evaluate(
    (o) => window.__hudSet(o),
    { safeRadius: radius, maxSafeRadius: MAX_SAFE_RADIUS, arenaW: ARENA_W, arenaH: ARENA_H, timeRemaining: CLOCK - s.ms, elapsed: s.ms, php: 0, ehp: 0 }
  );
  // The disc has a 0.2s width/height transition; wait it out so a still frame is the
  // settled state and not a tween.
  await page.waitForTimeout(320);

  const el = await page.$('.hud-radar-map');
  if (!el) throw new Error('no .hud-radar-map');
  const file = join(OUT, `${LABEL}-${s.key}.png`);
  await el.screenshot({ path: file });

  const geom = await page.evaluate(() => {
    const map = document.querySelector('.hud-radar-map');
    const safe = document.querySelector('.hud-radar-safe');
    const mb = map.getBoundingClientRect();
    const sb = safe ? safe.getBoundingClientRect() : null;
    return { mapW: mb.width, mapH: mb.height, safeW: sb ? sb.width : null, cap: document.querySelector('.hud-radar-cap')?.textContent ?? null };
  });

  const img = sharp(file);
  const meta = await img.metadata();
  const { data, info } = await img.raw().toBuffer({ resolveWithObject: true });
  const B = 3; // strip the card's 3px border, which the element screenshot includes
  const w = info.width - 2 * B;
  const h = info.height - 2 * B;
  const inner = Buffer.alloc(w * h * info.channels);
  for (let y = 0; y < h; y++) {
    data.copy(
      inner,
      y * w * info.channels,
      ((y + B) * info.width + B) * info.channels,
      ((y + B) * info.width + B + w) * info.channels
    );
  }
  const a = analyse(inner, w, h, info.channels);

  let deltaPx = null;
  if (prevCls && prevDims && prevDims.w === w && prevDims.h === h) {
    let d = 0;
    for (let i = 0; i < a.cls.length; i++) if (a.cls[i] !== prevCls[i]) d++;
    deltaPx = d;
  }
  prevCls = a.cls;
  prevDims = { w, h };

  results.push({
    key: s.key, note: s.note, ms: Math.round(s.ms), safeRadiusWu: Math.round(radius),
    png: file, pngSize: `${meta.width}x${meta.height}`, innerSize: `${w}x${h}`,
    safeFrac: Number(a.safeFrac.toFixed(4)), edgePx: a.edgePx, deltaPx,
    cssMapW: Number(geom.mapW.toFixed(1)), cssMapH: Number(geom.mapH.toFixed(1)), cap: geom.cap,
  });
  console.log(
    `${s.key.padEnd(6)} ${s.note.padEnd(24)} R=${String(Math.round(radius)).padStart(5)}wu  ` +
      `safeFrac=${a.safeFrac.toFixed(4)}  edgePx=${a.edgePx === null ? 'OFF-CARD' : String(a.edgePx).padStart(3) + '     '}  ` +
      `delta=${deltaPx === null ? '    -' : String(deltaPx).padStart(5)}`
  );
}

// One extra frame: player standing OUTSIDE the zone, mid-match. Used for the
// "can a viewer tell inside from outside at real size, with no label" read.
{
  const radius = radiusAt(CLOCK * 0.5);
  await page.evaluate(
    (o) => window.__hudSet(o),
    { safeRadius: radius, maxSafeRadius: MAX_SAFE_RADIUS, arenaW: ARENA_W, arenaH: ARENA_H, px: 120, py: 120, timeRemaining: CLOCK * 0.5, elapsed: CLOCK * 0.5 }
  );
  await page.waitForTimeout(320);
  await (await page.$('.hud-radar')).screenshot({ path: join(OUT, `${LABEL}-outside.png`) });
  const cap = await page.$eval('.hud-radar-cap', (e) => e.textContent);
  console.log(`outside  player at (120,120), R=${Math.round(radius)}wu, caption="${cap}"`);
}

// Contact sheets: one at REAL pixel size (the only honest read — docs/LESSONS.md §3)
// and one at 4x for inspecting the geometry.
for (const zoom of [1, 4]) {
  const tiles = await Promise.all(
    results.map((r) => sharp(r.png).resize({ width: Math.round(Number(r.pngSize.split('x')[0]) * zoom), kernel: 'nearest' }).toBuffer({ resolveWithObject: true }))
  );
  const gap = 8 * zoom;
  const tw = tiles[0].info.width;
  const th = tiles[0].info.height;
  const sheetW = tiles.length * tw + (tiles.length + 1) * gap;
  const sheetH = th + 2 * gap;
  await sharp({ create: { width: sheetW, height: sheetH, channels: 3, background: { r: 24, g: 16, b: 30 } } })
    .composite(tiles.map((t, i) => ({ input: t.data, left: gap + i * (tw + gap), top: gap })))
    .png()
    .toFile(join(OUT, `${LABEL}-sheet-${zoom}x.png`));
}

writeFileSync(
  join(OUT, `${LABEL}-metrics.json`),
  JSON.stringify({ clock: CLOCK, treeClock: TREE_CLOCK, ARENA_W, ARENA_H, FOG_FIRST_CONTACT_S, MAX_SAFE_RADIUS, MIN_SAFE_RADIUS, results }, null, 2)
);

const edges = results.map((r) => r.edgePx);
const offCard = edges.filter((e) => e === null).length;
let mono = true;
let minStep = Infinity;
for (let i = 1; i < edges.length; i++) {
  if (edges[i] === null || edges[i - 1] === null) { mono = false; continue; }
  if (edges[i] >= edges[i - 1]) mono = false;
  minStep = Math.min(minStep, edges[i - 1] - edges[i]);
}
console.log(`\nVERDICT clock=${CLOCK}ms`);
console.log(`  offCardSamples   ${offCard}/${edges.length}   (0 required)`);
console.log(`  edgePx series    ${edges.map((e) => (e === null ? 'OFF' : e)).join(' -> ')}`);
console.log(`  strictly decreasing = ${mono}   min step = ${minStep === Infinity ? 'n/a' : minStep}px`);
console.log(`  safeFrac series  ${results.map((r) => r.safeFrac.toFixed(3)).join(' -> ')}`);
console.log(`  deltaPx series   ${results.slice(1).map((r) => r.deltaPx).join(' -> ')}`);
if (errs.length) console.log('PAGE ERRORS:\n' + errs.join('\n'));
await browser.close();
