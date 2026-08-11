/**
 * LOCKED-SURFACE SIMULATION.
 *
 * `arena-scan` says the arena's visual hierarchy is wrong. `matcover` says which
 * materials own the pixels. This answers the remaining question — WHAT WOULD FIXING
 * THEM BUY? — without editing another owner's file, by overriding materials in-page
 * at runtime (matched by name AND authored hex, so a `tinted()`/`.color.set()` clone
 * is targeted and its palette parent is not) and re-running arena-scan's own salience
 * analysis on the result.
 *
 * Usage:
 *   node tools/tmp/simfix.mjs --url http://localhost:5196 --label control
 *   node tools/tmp/simfix.mjs --url http://localhost:5196 --label caps \
 *        --fix "kpal:cabinet=#CE8C2E>#9A7742,kpal:butcherBlock=#C9AD7B>#A2957E"
 */
import { chromium } from 'playwright';
import sharp from 'sharp';
import { readFileSync } from 'node:fs';

const arg = (k, d) => { const i = process.argv.indexOf('--' + k); return i < 0 ? d : process.argv[i + 1]; };
const BASE = arg('url', 'http://localhost:5196');
const LABEL = arg('label', 'run');
const FIX = (arg('fix', '') || '').split(',').filter(Boolean).map((s) => {
  const [lhs, to] = s.split('>');
  const [name, from] = lhs.split('=');
  return { name, from: from.toUpperCase(), to };
});

/**
 * ── 🚨 THIS TABLE WAS THE 1× MAP, IN FULL, AND NOTHING EVER SAID SO ─────────────────
 *
 * WAS (every row, verbatim — kept because it is the known-bad `al_guard.mjs` is proved
 * against, and because the numbers are the only record of what was actually measured on
 * every run of this tool since `6631446`):
 *
 *   ['spawn_west', 160, 500, 890], ['west_lane', 340, 500, 890], ['west_choke', 400, 500, 890],
 *   ['pot_south', 700, 640, 890], ['pot_diagonal', 570, 430, 890], ['hub_north', 700, 320, 890],
 *   ['freezer_nw', 430, 240, 890], ['pantry_ne', 1150, 330, 890], ['pantry_sw', 270, 665, 890],
 *   ['freezer_se', 1000, 700, 890], ['fryer_south', 560, 790, 890], ['edge_west', 70, 500, 890],
 *   ['grease_near', 430, 805, 890], ['grease_in', 560, 900, 890], ['water_near', 970, 195, 890],
 *   ['fog_boundary', 1090, 500, 420], ['fog_inside', 1240, 500, 420], ['fog_late', 700, 340, 200],
 *
 * Measured on the shipped 2800×2000 map: quadrant coverage **NW 18 / NE 0 / SW 0 / SE 0**
 * — the entire sweep sat in one quarter of the arena — and **four stations were inside a
 * `CoverBox`**, where a fighter cannot stand at all. This file's whole purpose is to
 * re-run `arena-scan`'s salience analysis on a materially-overridden frame, so **every
 * A/B it has produced since the ×4 rebuild compared two pictures of the wrong quarter of
 * the map**. It is the twelfth instance of `6631446`'s literal-copy defect and, like
 * `valuescan`'s, it was never red — this tool has no selftest to be green.
 *
 * ── The migration, and why it is a COPY rather than an import ───────────────────────
 *
 * Re-aimed to `tools/arena-scan.mjs`'s current, validated station table, which is what
 * these ids were copied from in the first place and which that file's `--selftest` §F
 * now pins (legal ground, ≥4 stations per quadrant, every fog radius above the schedule's
 * floor). ⚠️ **A plain ×2 of the old coordinates was tried first and REJECTED on a
 * measurement**: the ×4 map is a re-layout, not a scaled copy, and ×2 puts **6 of 15**
 * stations inside a `CoverBox` (`pot_south`→fryer_counter, `hub_north`→sink_counter,
 * `fryer_south`/`grease_near`/`grease_in`/`water_near`→crates and counters).
 *
 * ⚠️ **And `import`ing arena-scan's table was rejected too, for a stated reason**:
 * `tools/arena-scan.mjs` has **no `IS_MAIN` guard**, so exporting anything from it would
 * make `import`ing it run the whole CLI — the exact trap `docs/AGENT-BRIEF.md` §3
 * records three instances of. So this stays a copy, and `assertStations()` below turns it
 * into a copy that **cannot go stale silently**, which is the achievable form of
 * derivation here.
 */
const STATIONS = [
  ['spawn_west', 300, 810, null], ['west_lane', 600, 1000, null], ['west_choke', 900, 1000, null],
  ['pot_south', 1400, 1200, null], ['pot_diagonal', 1140, 940, null], ['hub_north', 1400, 780, null],
  ['freezer_nw', 560, 400, null], ['pantry_ne', 2200, 500, null], ['pantry_sw', 650, 1700, null],
  ['freezer_se', 2240, 1600, null], ['fryer_south', 1400, 1450, null], ['edge_west', 70, 1000, null],
  ['grease_near', 1840, 970, null], ['grease_in', 1950, 1100, null], ['water_near', 940, 1030, null],
  // The three fog stations. ⚠️ Their radii are NOT `null` because the ring IS the subject,
  // and they are taken from `arena-scan.mjs:741-743` verbatim for the same reason as the
  // rest of the table. `match.ts:applyQaSetup` snaps any request at or below
  // `maxSafeRadius × (15/45)` = **661.67 wu** to sudden death — a full-arena violet wash,
  // not a ring — so the old 420/420/200 photographed the SAME frame three times.
  // The 5th field marks a station that is OUTSIDE its own ring **on purpose**:
  // `fog_inside` exists to photograph the death zone. Without that flag the validator
  // below would be right about the arithmetic and wrong about the intent — and a guard
  // that cannot express a deliberate exception gets switched off instead of obeyed.
  ['fog_boundary', 2210, 1000, 840], ['fog_inside', 2360, 1000, 840, 'outside-on-purpose'],
  ['fog_late', 740, 1000, 700],
];
/**
 * The fog radius for the "normal play" stations — the ring parked off the map so it is
 * not in frame.
 *
 * ⚠️ WAS `Number(arg('fog', '850'))`, with the note *"arena-scan uses MAX_SAFE_RADIUS 850
 * for its normal play stations; keep whatever number is passed so both tools frame the fog
 * identically."* **850 was the 1× `MAX_SAFE_RADIUS`.** The shipped one is **1985**, and at
 * 850 on the ×4 map the ring cuts the playfield: six of the fifteen re-aimed stations above
 * sit outside it and would be photographed through the violet death wash, taking 50 HP/s.
 * The comment's intent — *"frame the fog identically to arena-scan"* — is honoured by
 * tracking arena-scan's constant, not the number it used to hold.
 */
const MAX_SAFE_RADIUS = 1985;   // arena-scan.mjs:392; asserted against the dump below
const FOG_NORMAL = Number(arg('fog', String(MAX_SAFE_RADIUS)));

/**
 * 🚨 REFUSE TO RUN FROM A TABLE THAT DESCRIBES A MAP THAT DOES NOT EXIST.
 *
 * The reason this exists rather than a comment saying "keep these in sync": **four of the
 * eleven fixtures `6631446` broke were still PASSING at their 1× coordinates** while
 * testing something nobody chose, and `valuescan --selftest` was **105/105 green** with 14
 * of 18 stations in the wrong quadrant. A tool with no assertion about where it is pointed
 * cannot tell you it is pointed nowhere. This one now can.
 */
function assertStations() {
  const dump = JSON.parse(readFileSync(new URL('../arena.gameplay.json', import.meta.url), 'utf8'));
  const P = 42;                                   // rules.ts PLAYER_SIZE — the collision box
  const faults = [];
  if (MAX_SAFE_RADIUS !== dump.maxSafeRadius) {
    faults.push(`MAX_SAFE_RADIUS ${MAX_SAFE_RADIUS} but the dump says ${dump.maxSafeRadius}`);
  }
  const quads = { NW: 0, NE: 0, SW: 0, SE: 0 };
  // ⚠️ Assert the set is NON-EMPTY before asserting over it. Three of tonight's seven
  // broken controls went vacuous because `[].every()` returns `true`.
  if (STATIONS.length === 0) faults.push('STATIONS is empty — every check below would pass vacuously');
  for (const [id, x, y, fogArg, intent] of STATIONS) {
    const fog = fogArg ?? FOG_NORMAL;
    if (x < 0 || y < 0 || x > dump.width || y > dump.height) faults.push(`${id} (${x},${y}) is outside the playfield`);
    const box = dump.cover.find((c) => Math.abs(x - c.x) <= c.w / 2 + P / 2 && Math.abs(y - c.y) <= c.h / 2 + P / 2);
    if (box) faults.push(`${id} (${x},${y}) is inside ${box.kind} at (${box.x},${box.y}) — no fighter can stand there`);
    const d = Math.hypot(x - dump.center.x, y - dump.center.y);
    if (d > fog && intent !== 'outside-on-purpose') {
      faults.push(`${id} (${x},${y}) is ${Math.round(d)} wu from centre but asks for fogRadius=${fog} — OUTSIDE the zone, −50 HP/s`);
    }
    // ...and the exception is itself checked, so it cannot be used to wave through a
    // station that is actually inside. A declared exception that never fires is a
    // comment with a tick next to it.
    if (d <= fog && intent === 'outside-on-purpose') {
      faults.push(`${id} (${x},${y}) is declared 'outside-on-purpose' but is ${Math.round(d)} wu from centre, INSIDE fogRadius=${fog}`);
    }
    quads[(y < dump.center.y ? 'N' : 'S') + (x < dump.center.x ? 'W' : 'E')]++;
  }
  const empty = Object.entries(quads).filter(([, n]) => n === 0).map(([q]) => q);
  if (empty.length) faults.push(`quadrant coverage ${JSON.stringify(quads)} — ${empty.join('/')} unsampled`);
  if (faults.length) {
    console.error(`\n🔴 simfix: ${faults.length} station fault(s) against the SHIPPED arena `
      + `(${dump.width}×${dump.height}, centre ${dump.center.x},${dump.center.y}):`);
    for (const f of faults) console.error(`   • ${f}`);
    console.error('   Refusing to measure. Re-derive STATIONS from tools/arena-scan.mjs.\n');
    process.exit(1);
  }
  console.log(`simfix: ${STATIONS.length} stations validated against the shipped arena `
    + `${dump.width}×${dump.height} — quadrants ${JSON.stringify(quads)}, all clear of cover, all inside their own ring.`);
}

const GRID_COLS = 16, GRID_ROWS = 9, SMALL_W = 320, SMALL_H = 180;
function rgbToHsl(r, g, b) {
  r /= 255; g /= 255; b /= 255;
  const mx = Math.max(r, g, b), mn = Math.min(r, g, b), l = (mx + mn) / 2;
  if (mx === mn) return { h: 0, s: 0, l };
  const d = mx - mn;
  const s = l > 0.5 ? d / (2 - mx - mn) : d / (mx + mn);
  let h = mx === r ? ((g - b) / d + (g < b ? 6 : 0)) : mx === g ? (b - r) / d + 2 : (r - g) / d + 4;
  return { h: h * 60, s, l };
}
/** Byte-identical to `tools/arena-scan.mjs`'s `analyse` — verified against its own
 *  metrics.json before this script was used for anything. */
async function analyse(buf) {
  const { data } = await sharp(buf).resize(SMALL_W, SMALL_H, { fit: 'fill' }).removeAlpha().raw().toBuffer({ resolveWithObject: true });
  const n = SMALL_W * SMALL_H;
  const luma = new Float32Array(n), sat = new Float32Array(n), hue = new Float32Array(n);
  let c0 = 0, c255 = 0;
  for (let i = 0; i < n; i++) {
    const r = data[i * 3], g = data[i * 3 + 1], b = data[i * 3 + 2];
    if (r === 0 || g === 0 || b === 0) c0++;
    if (r === 255 || g === 255 || b === 255) c255++;
    luma[i] = (0.2126 * r + 0.7152 * g + 0.0722 * b) / 255;
    const { h, s } = rgbToHsl(r, g, b); sat[i] = s; hue[i] = h;
  }
  const medianLuma = Float32Array.from(luma).sort()[Math.floor(n / 2)];
  const cellW = SMALL_W / GRID_COLS, cellH = SMALL_H / GRID_ROWS, cells = [];
  for (let cy = 0; cy < GRID_ROWS; cy++) for (let cx = 0; cx < GRID_COLS; cx++) {
    let sum = 0, sum2 = 0, satSum = 0, cnt = 0;
    const x0 = Math.round(cx * cellW), x1 = Math.round((cx + 1) * cellW);
    const y0 = Math.round(cy * cellH), y1 = Math.round((cy + 1) * cellH);
    for (let y = y0; y < y1; y++) for (let x = x0; x < x1; x++) {
      const i = y * SMALL_W + x; sum += luma[i]; sum2 += luma[i] * luma[i]; satSum += sat[i]; cnt++;
    }
    const mean = sum / cnt, sd = Math.sqrt(Math.max(0, sum2 / cnt - mean * mean)), meanSat = satSum / cnt;
    cells.push({ cx, cy, mean, sd, sat: meanSat,
      salience: 0.5 * Math.min(1, sd / 0.25) + 0.3 * meanSat + 0.2 * Math.min(1, Math.abs(mean - medianLuma) / 0.35) });
  }
  const inPlayer = (c) => c.cx >= 7 && c.cx <= 9 && c.cy >= 4 && c.cy <= 5;
  const pc = cells.filter(inPlayer), pSal = Math.max(...pc.map((c) => c.salience));
  const ranked = [...cells].sort((a, b) => b.salience - a.salience);
  const rank = ranked.findIndex((c) => inPlayer(c) && c.salience === pSal) + 1;
  const ring = cells.filter((c) => !inPlayer(c) && c.cx >= 5 && c.cx <= 11 && c.cy >= 2 && c.cy <= 7);
  const avg = (a, k) => a.reduce((s, c) => s + c[k], 0) / a.length;
  const bins = new Array(12).fill(0); let wsum = 0;
  for (let i = 0; i < n; i++) { if (sat[i] < 0.15) continue; bins[Math.floor((((hue[i] % 360) + 360) % 360) / 30) % 12] += sat[i]; wsum += sat[i]; }
  const hist = bins.map((v) => (wsum ? v / wsum : 0));
  return { rank, dSat: avg(pc, 'sat') - avg(ring, 'sat'), dLuma: avg(pc, 'mean') - avg(ring, 'mean'),
    bin0: hist[0], warm: hist[0] + hist[1], dom: Math.max(...hist), c0: (c0 / n) * 100, c255: (c255 / n) * 100 };
}

const HMR_STUB = `const noop=()=>{};
export const createHotContext=()=>({accept:noop,acceptExports:noop,dispose:noop,prune:noop,
  invalidate:noop,on:noop,off:noop,send:noop,decline:noop,data:{}});
export const injectQuery=(u)=>u; export const updateStyle=noop; export const removeStyle=noop;
export const ErrorOverlay=class{}; export default {};`;

assertStations();
// `--validate` is the offline half: prove the table is pointed somewhere real without
// spending a browser. It is what `al_guard.mjs` shells out to, and what a known-bad
// revert of STATIONS is demonstrated against.
if (process.argv.includes('--validate')) process.exit(0);

const browser = await chromium.launch({ args: ['--use-gl=angle', '--use-angle=swiftshader',
  '--enable-unsafe-swiftshader', '--enable-webgl', '--ignore-gpu-blocklist', '--disable-gpu-sandbox'] });
const rows = [];
for (const [id, x, y, fogArg] of STATIONS) {
  // WAS `fogArg === 890 ? FOG_NORMAL : fogArg` — a sentinel that was itself the 1×
  // `MAX_SAFE_RADIUS`, so "this station wants the default" and "this station wants 890"
  // were the same request. `null` is the sentinel now and cannot collide with a radius.
  const fog = fogArg ?? FOG_NORMAL;
  const page = await browser.newPage({ viewport: { width: 1600, height: 900 }, deviceScaleFactor: 1 });
  await page.route('**/@vite/client*', (r) => r.fulfill({ status: 200, contentType: 'text/javascript', body: HMR_STUB }));
  try {
    await page.goto(`${BASE}/?player=hamburger&enemy=donut&px=${x}&py=${y}&fogRadius=${fog}&simSpeed=0.02&pointerLock=0`,
      { waitUntil: 'networkidle', timeout: 60000 });
    await page.waitForFunction('window.__gameReady === true', null, { timeout: 60000 });
    await page.waitForTimeout(900);
    const hits = await page.evaluate((fixes) => {
      if (!fixes.length) return 0;
      const seen = new Set(); let n = 0;
      window.__stage.scene.traverse((o) => {
        if (!o.isMesh) return;
        for (const m of (Array.isArray(o.material) ? o.material : [o.material])) {
          if (!m || !m.color || seen.has(m.uuid)) continue;
          seen.add(m.uuid);
          const hex = '#' + m.color.getHexString().toUpperCase();
          for (const f of fixes) if (m.name === f.name && hex === f.from) { m.color.set(f.to); n++; }
        }
      });
      return n;
    }, FIX);
    await page.waitForTimeout(250);
    const buf = await page.locator('canvas').first().screenshot({ timeout: 90000 });
    const m = await analyse(buf);
    rows.push({ id, hits, ...m });
    console.log(`${id.padEnd(14)} rank ${String(m.rank).padStart(3)}  dSat ${m.dSat.toFixed(3).padStart(6)}  bin0 ${m.bin0.toFixed(3)}  clip ${m.c0.toFixed(2)}/${m.c255.toFixed(2)}  (${hits} mats overridden)`);
  } catch (e) { console.error(`${id} FAILED ${e}`); }
  finally { await page.close(); }
}
await browser.close();
const med = (a) => { const s = [...a].sort((x, y) => x - y); const h = s.length >> 1; return s.length % 2 ? s[h] : (s[h - 1] + s[h]) / 2; };
const mean = (a) => a.reduce((x, y) => x + y, 0) / a.length;
const R = rows.map((r) => r.rank), D = rows.map((r) => r.dSat);
console.log(`\n### ${LABEL} (${rows.length} stations)`);
console.log(`A playerRank  median ${med(R)}  mean ${mean(R).toFixed(1)}  top6 ${R.filter((r) => r <= 6).length}/${rows.length}  top12 ${R.filter((r) => r <= 12).length}/${rows.length}`);
console.log(`B dSat        positive ${D.filter((d) => d > 0).length}/${rows.length}  mean ${mean(D).toFixed(3)}`);
console.log(`C hue         bin0 ${mean(rows.map((r) => r.bin0)).toFixed(3)}  warm ${mean(rows.map((r) => r.warm)).toFixed(3)}  dom ${mean(rows.map((r) => r.dom)).toFixed(3)}`);
console.log(`D clip        low ${Math.max(...rows.map((r) => r.c0)).toFixed(2)}%  high ${Math.max(...rows.map((r) => r.c255)).toFixed(2)}%`);
