#!/usr/bin/env node
/**
 * WHOLE-ARENA SCANNER — judge the arena as one artefact, the way a player sees it.
 *
 * ── Why this exists ──────────────────────────────────────────────────────────
 * This project decomposes everything into per-element critic loops: one agent owns
 * one element and loops until an independent critic scores it 7/10. That method has
 * a structural flaw recorded as a standing risk since day one:
 *
 *   Element scores read HIGHER than the whole, because a critic judging one barrel
 *   is not weighing composition, density, colour harmony or hierarchy. Optimising
 *   the easier metric is the standing risk of this entire working model.
 *
 * Nothing else in the toolchain checks that the parts add up. This does. It is
 * deliberately cheap enough to re-run after any element change — a one-off audit is
 * worth far less than a standing check.
 *
 * ── What it captures ─────────────────────────────────────────────────────────
 * The LIVE GAME, not `preview.html`. `preview.ts` reconstructs shipped framing from
 * `SHIPPED_SPAN`; the live match IS shipped framing, so there is nothing to get 18%
 * wrong (which is exactly how an earlier constant went wrong — `frameMode:'ground'`
 * frames `viewWidthUnits / sin(pitch)`, not `viewWidthUnits`). Verified against
 * `window.__fairView()`: at 16:9 the match camera shows halfWidth 289.4 wu and
 * near/far 199.2 wu, i.e. ~579 x 398 wu of ground centred on the PLAYER.
 *
 * Every station is PLAYER-CENTRED, never arena-centred. Centring on the pot once
 * filled the frame with the hazard and depressed several rounds of scores for
 * reasons that were purely framing.
 *
 * States covered: normal play, the closing-fog death zone (boundary / inside /
 * late), and both hazard puddles (approach and standing in).
 *
 * ── What it measures ─────────────────────────────────────────────────────────
 * Screenshots alone are a taste argument. Each station also gets objective numbers
 * so two runs are comparable without a critic:
 *
 *   playerRank    Where the player's own screen region ranks in a salience grid.
 *                 1 = the eye goes to the player. Anything else names what beat it.
 *                 This is the direct, measurable form of "visual hierarchy".
 *   topCells      The three loudest cells, with mean colour and grid position, so a
 *                 work-list can name the offender instead of gesturing at it.
 *   centreContrast  Player region mean luma vs the surrounding annulus. Low = the
 *                 hero and its ground share a value family and nothing separates.
 *   hueSpread     Saturation-weighted hue histogram (12 bins) + how much of the
 *                 frame sits in the single dominant bin. High = monochrome sludge.
 *   clipped       % of pixels with a channel pinned at 0 or 255. The colour grade
 *                 regression check — this was 9.39%/10.60% before `ToyGradeEffect`.
 *
 * Metrics run on the CANVAS ONLY (the DOM HUD would dominate every salience grid).
 * The sheet handed to a critic is the FULL composited frame, HUD included, because
 * that is the artefact a player actually reads under pressure.
 *
 * ── Repeatability ────────────────────────────────────────────────────────────
 * Default `--sim-speed 0.02` runs the match at 1/50th speed, so every capture lands
 * at sim elapsed ~0 with the same ambient phase, the same enemy position and the
 * same idle pose. Two runs a week apart are diffable. Pass `--sim-speed 1` for a
 * live look with moving AI, at the cost of repeatability.
 *
 * KNOWN GAP: this cannot reliably put COMBAT VFX in frame. The AI has to cross the
 * map to engage, and `--sim-speed 6 --settle 7000` still only advanced 19s of match
 * time on SwiftShader — not enough. So the "do the floor decals out-contrast combat
 * VFX" question is NOT answered here; it needs a driven-input probe of the
 * `tools/tmp/burstshot.mjs` family. What this DOES answer is the same question
 * against the player character, measured below, which is the stricter test anyway.
 *
 * ── Usage ────────────────────────────────────────────────────────────────────
 *   node tools/arena-scan.mjs                          # full sweep, default out dir
 *   node tools/arena-scan.mjs --out shots/scan/r2      # pin the output dir
 *   node tools/arena-scan.mjs --only west_lane,pot_lane,fog_boundary
 *   node tools/arena-scan.mjs --url http://localhost:5187   # your own vite, not :5173
 *   node tools/arena-scan.mjs --list                   # print the station table
 *
 * Outputs, per station <id>:
 *   <out>/<id>.png          full frame, HUD included  <- this is what critics see
 *   <out>/<id>.canvas.png   canvas only, no HUD       <- what the metrics run on
 *   <out>/<id>.marked.png   top-3 salience cells outlined, player region in green
 *   <out>/metrics.json      every number, machine-readable
 *   <out>/sheet_*.png       contact sheets, 6 stations each
 *   <out>/SUMMARY.txt       the table you read first
 *
 * NEVER run this against the shared :5173 dev server for a full sweep — start your
 * own (`npx vite --port 5187 --strictPort`) and pass `--url`.
 *
 * ── The critic half of the round ─────────────────────────────────────────────
 * The numbers say what changed; a blind critic says whether it is any good. After a
 * sweep, pick ONE representative frame and build THREE independent packets:
 *
 *   for i in 1 2 3; do
 *     node tools/review.mjs --ours shots/scan/<run>/pot_south.png \
 *       --category gameplay --out shots/review/scan-$i --n 2
 *   done
 *
 * Then spawn THREE FRESH critic subagents, one per packet, each told to judge the
 * frame as one artefact (composition / density / colour harmony / hierarchy / read
 * at a glance / do two elements fight) and forbidden from opening any `.key.json`.
 *
 * RECORD THE SCORE EACH CRITIC GIVES THE REFERENCE SIDE. One critic once scored the
 * shipped reference 4/10 while others gave the same plates 8-9/10. A round whose
 * reference control falls outside ~7-9 measured the critic, not the work, and must be
 * discarded. Three readings, not one — this instrument is noisy.
 *
 * ── Baseline, 2026-08-04, first ever whole-arena run (`shots/scan/run2`) ─────
 * Blind A/B, three fresh critics, `pot_south` vs the curated gameplay library:
 *
 *   ours       4 / 4.5 / 4        (mean 4.2, spread 0.5)
 *   reference  8+8 / 7.0+7.5 / 8  (all inside 7-9 -> all three rounds VALID)
 *
 * Metrics at that run: playerRank 4-88 of 144, median ~33 — the player was never in
 * the top three cells of any frame. |deltaLuma| <= 0.06 at 13 of 18 stations. Dominant
 * hue 0-30 deg holding 26-51% of frame chroma at 15 of 18. clipped 0.02-0.44 / 0.42-1.89%
 * (healthy; the colour grade is not regressing).
 *
 * All three critics independently named the SAME first fix: a saturation contract —
 * crush the static environment into one desaturated band and reserve chroma for
 * actors, threats and pickups.
 */

import { chromium } from 'playwright';
import sharp from 'sharp';
import { mkdir, writeFile } from 'node:fs/promises';
import { resolve, join } from 'node:path';
import { execFileSync } from 'node:child_process';

// ─────────────────────────────────────────────────────────────────────────────
// Map facts. Mirrors `src/arena/shared.ts` + `src/arena/kitchen.ts`. Kept here as
// plain numbers on purpose: this tool must keep working when `src/` is mid-edit by
// five other agents, so it imports nothing from the app.
// ─────────────────────────────────────────────────────────────────────────────
const ARENA_W = 1400, ARENA_H = 1000;
const CENTRE = { x: 700, y: 500 };
const MAX_SAFE_RADIUS = 850;      // fogRadius=850 => ring parked off the map corners
const GREASE = { x: 560, y: 900 };
const WATER = { x: 840, y: 100 };

/**
 * Every `CoverBox` in `kitchen.ts`, as {x, y, w, h} centre + full extent.
 *
 * Here for ONE reason: `?px=/?py=` write straight into `MatchState` with no collision
 * resolution, so a station placed on a prop puts the player INSIDE it. At the shipped
 * 58 deg pitch a freezer or a barrel then swallows the character completely — the
 * first draft of this file lost four of eighteen stations that way and the frames
 * looked like a rendering bug. `validate()` below turns that into a startup error.
 */
const COVER = [
  [525, 350, 170, 90], [875, 350, 170, 90], [525, 650, 170, 90], [875, 650, 170, 90], // stove islands
  [700, 258, 55, 55], [700, 742, 55, 55],                                             // lane pots
  [525, 500, 50, 50], [875, 500, 50, 50],                                             // spice carts
  [230, 190, 230, 190], [1170, 810, 230, 190],                                        // freezers
  [1120, 150, 90, 90], [280, 850, 90, 90],                                            // herb crates
  [1230, 140, 80, 80], [170, 860, 80, 80],                                            // tall crates
  [1175, 235, 110, 70], [225, 765, 110, 70],                                          // flour sacks
  [340, 420, 160, 55], [340, 580, 160, 55], [1060, 580, 160, 55], [1060, 420, 160, 55], // prep counters
  [250, 500, 60, 50], [460, 500, 48, 46], [1150, 500, 60, 50], [940, 500, 48, 46],    // supply barrels
  [700, 830, 150, 70], [700, 170, 150, 70],                                           // fryer / sink
];
/** Clearance a station must keep from every cover box, in world units. */
const CLEARANCE = 18;

function validate(stations) {
  const bad = [];
  for (const s of stations) {
    for (const [cx, cy, w, h] of COVER) {
      if (Math.abs(s.x - cx) < w / 2 + CLEARANCE && Math.abs(s.y - cy) < h / 2 + CLEARANCE) {
        bad.push(`${s.id} (${s.x},${s.y}) sits inside cover box centred (${cx},${cy}) ${w}x${h}`);
      }
    }
    if (s.x < 20 || s.x > ARENA_W - 20 || s.y < 20 || s.y > ARENA_H - 20) {
      bad.push(`${s.id} (${s.x},${s.y}) is outside the playfield`);
    }
  }
  return bad;
}

/**
 * The stations.
 *
 * `x`/`y` are where the PLAYER stands; the camera centres its ground window there.
 * At 16:9 each station shows ~579 x 398 wu, so the 1400x1000 playfield needs ~6
 * views to be covered once and these 17 oversample the lanes and hazards, which is
 * where a player actually spends the match.
 *
 * Hazard stations deliberately stand OFF the hazard, not on it, so the hazard sits
 * about a fifth of the frame off-centre instead of filling it.
 */
const STATIONS = [
  // ── normal play, the west half (player spawn side) ──────────────────────────
  { id: 'spawn_west',    x: 160,  y: 500, fog: MAX_SAFE_RADIUS, note: 'player spawn, looking down the west lane' },
  { id: 'west_lane',     x: 340,  y: 500, fog: MAX_SAFE_RADIUS, note: 'primary combat lane: barrels, prep counters, spill decals' },
  { id: 'west_choke',    x: 400,  y: 500, fog: MAX_SAFE_RADIUS, note: 'the mid-lane chokepoint between the two supply barrels' },
  // ── the hub. Never centred on the pot. ─────────────────────────────────────
  { id: 'pot_south',     x: 700,  y: 640, fog: MAX_SAFE_RADIUS, note: 'pot 140wu north of the player — hazard in frame, not filling it' },
  { id: 'pot_diagonal',  x: 570,  y: 430, fog: MAX_SAFE_RADIUS, note: 'hub diagonal: pot + stove island + spice cart + lane pots together' },
  { id: 'hub_north',     x: 700,  y: 320, fog: MAX_SAFE_RADIUS, note: 'north lane mouth, stacked pots, sink counter beyond' },
  // ── corners: the four landmark clusters ────────────────────────────────────
  { id: 'freezer_nw',    x: 430,  y: 240, fog: MAX_SAFE_RADIUS, note: 'NW walk-in freezer + exhaust pipe, seen from the lane' },
  { id: 'pantry_ne',     x: 1150, y: 330, fog: MAX_SAFE_RADIUS, note: 'NE pantry cluster: crates, herb crate, flour sacks, on its plank pad' },
  { id: 'pantry_sw',     x: 270,  y: 665, fog: MAX_SAFE_RADIUS, note: 'SW pantry cluster + a real prep counter in the same frame' },
  { id: 'freezer_se',    x: 1000, y: 700, fog: MAX_SAFE_RADIUS, note: 'SE walk-in freezer (mirror)' },
  // ── service counters + decoration density ──────────────────────────────────
  { id: 'fryer_south',   x: 560,  y: 790, fog: MAX_SAFE_RADIUS, note: 'fryer counter, chalkboard, stacked pots, south apron edge' },
  // ── map edge: does the apron hold the frame? ───────────────────────────────
  { id: 'edge_west',     x: 70,   y: 500, fog: MAX_SAFE_RADIUS, note: 'hard west edge — apron/kerb occupies a third of the frame' },
  // ── hazard puddles, approach framing ───────────────────────────────────────
  { id: 'grease_near',   x: GREASE.x - 130, y: GREASE.y - 95, fog: MAX_SAFE_RADIUS, note: 'grease puddle off-centre, as you approach it' },
  { id: 'grease_in',     x: GREASE.x, y: GREASE.y, fog: MAX_SAFE_RADIUS, note: 'STANDING IN the grease puddle — the slowed player read' },
  { id: 'water_near',    x: WATER.x + 130, y: WATER.y + 95, fog: MAX_SAFE_RADIUS, note: 'water puddle off-centre, as you approach it' },
  // ── the closing fog death zone ─────────────────────────────────────────────
  { id: 'fog_boundary',  x: 1090, y: 500, fog: 420, note: 'safe-zone wall ~30wu ahead of the player' },
  { id: 'fog_inside',    x: 1240, y: 500, fog: 420, note: 'standing INSIDE the death zone, 50 HP/s' },
  { id: 'fog_late',      x: 700,  y: 340, fog: 200, note: 'late match, ring closed to 200wu around the pot' },
];

// ─────────────────────────────────────────────────────────────────────────────
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

if (args.list) {
  console.log('id                x     y     fogRadius  note');
  for (const s of STATIONS) {
    console.log(`${s.id.padEnd(16)} ${String(s.x).padEnd(5)} ${String(s.y).padEnd(5)} ${String(s.fog).padEnd(10)} ${s.note}`);
  }
  process.exit(0);
}

const BASE = args.url ?? process.env.SCAN_BASE ?? 'http://localhost:5187';
const W = Number(args.w ?? 1600);
const H = Number(args.h ?? 900);
const PLAYER = args.player ?? 'hamburger';
const ENEMY = args.enemy ?? 'donut';
const SIM_SPEED = args['sim-speed'] ?? '0.02';
const SETTLE_MS = Number(args.settle ?? 900);
const OUT = resolve(args.out ?? `shots/scan/${new Date().toISOString().replace(/[:.]/g, '-').slice(0, 19)}`);

const wanted = args.only ? new Set(String(args.only).split(',').map((s) => s.trim())) : null;
const jobs = STATIONS.filter((s) => !wanted || wanted.has(s.id));
if (jobs.length === 0) { console.error('No stations matched --only'); process.exit(2); }

const invalid = validate(jobs);
if (invalid.length) {
  console.error('Station placement is invalid — the player would spawn inside a prop:');
  invalid.forEach((m) => console.error(`  ${m}`));
  process.exit(2);
}

const LAUNCH_ARGS = [
  '--use-gl=angle', '--use-angle=swiftshader', '--enable-unsafe-swiftshader',
  '--enable-webgl', '--ignore-gpu-blocklist', '--disable-gpu-sandbox',
];

/** Vite HMR client stub. Five agents edit `src/` live; every save full-reloads the
 *  page and wipes a capture mid-flight. Pattern lifted from `tools/tmp/rake.mjs`. */
const HMR_STUB = `const noop=()=>{};
export const createHotContext=()=>({accept:noop,acceptExports:noop,dispose:noop,prune:noop,
  invalidate:noop,on:noop,off:noop,send:noop,decline:noop,data:{}});
export const injectQuery=(u)=>u; export const updateStyle=noop; export const removeStyle=noop;
export const ErrorOverlay=class{}; export default {};`;

// ─────────────────────────────────────────────────────────────────────────────
// Metrics
// ─────────────────────────────────────────────────────────────────────────────
const GRID_COLS = 16, GRID_ROWS = 9;
const SMALL_W = 320, SMALL_H = 180;   // grid cell = 20x20 px

function rgbToHsl(r, g, b) {
  r /= 255; g /= 255; b /= 255;
  const mx = Math.max(r, g, b), mn = Math.min(r, g, b);
  const l = (mx + mn) / 2;
  if (mx === mn) return { h: 0, s: 0, l };
  const d = mx - mn;
  const s = l > 0.5 ? d / (2 - mx - mn) : d / (mx + mn);
  let h;
  if (mx === r) h = ((g - b) / d + (g < b ? 6 : 0));
  else if (mx === g) h = (b - r) / d + 2;
  else h = (r - g) / d + 4;
  return { h: (h * 60), s, l };
}

/**
 * Salience grid.
 *
 * Deliberately crude and deliberately fixed: this is not a model of human
 * attention, it is a REPEATABLE proxy that answers one question — is the player the
 * loudest thing on screen, and if not, what is? Weighting is local contrast first
 * (edges catch the eye hardest at speed), then saturation, then deviation from the
 * frame's own median value.
 */
async function analyse(canvasPng) {
  const { data } = await sharp(canvasPng)
    .resize(SMALL_W, SMALL_H, { fit: 'fill' })
    .removeAlpha().raw().toBuffer({ resolveWithObject: true });

  const n = SMALL_W * SMALL_H;
  const luma = new Float32Array(n);
  const sat = new Float32Array(n);
  const hue = new Float32Array(n);
  let clipped0 = 0, clipped255 = 0;

  for (let i = 0; i < n; i++) {
    const r = data[i * 3], g = data[i * 3 + 1], b = data[i * 3 + 2];
    if (r === 0 || g === 0 || b === 0) clipped0++;
    if (r === 255 || g === 255 || b === 255) clipped255++;
    luma[i] = (0.2126 * r + 0.7152 * g + 0.0722 * b) / 255;
    const { h, s } = rgbToHsl(r, g, b);
    sat[i] = s; hue[i] = h;
  }

  const sorted = Float32Array.from(luma).sort();
  const medianLuma = sorted[Math.floor(n / 2)];

  const cellW = SMALL_W / GRID_COLS, cellH = SMALL_H / GRID_ROWS;
  const cells = [];
  for (let cy = 0; cy < GRID_ROWS; cy++) {
    for (let cx = 0; cx < GRID_COLS; cx++) {
      let sum = 0, sum2 = 0, satSum = 0, cnt = 0, rs = 0, gs = 0, bs = 0;
      const x0 = Math.round(cx * cellW), x1 = Math.round((cx + 1) * cellW);
      const y0 = Math.round(cy * cellH), y1 = Math.round((cy + 1) * cellH);
      for (let y = y0; y < y1; y++) for (let x = x0; x < x1; x++) {
        const i = y * SMALL_W + x;
        sum += luma[i]; sum2 += luma[i] * luma[i]; satSum += sat[i]; cnt++;
        rs += data[i * 3]; gs += data[i * 3 + 1]; bs += data[i * 3 + 2];
      }
      const mean = sum / cnt;
      const sd = Math.sqrt(Math.max(0, sum2 / cnt - mean * mean));
      const meanSat = satSum / cnt;
      const salience = 0.5 * Math.min(1, sd / 0.25) + 0.3 * meanSat + 0.2 * Math.min(1, Math.abs(mean - medianLuma) / 0.35);
      cells.push({
        cx, cy, mean: +mean.toFixed(3), sd: +sd.toFixed(3), sat: +meanSat.toFixed(3),
        salience: +salience.toFixed(4),
        rgb: [Math.round(rs / cnt), Math.round(gs / cnt), Math.round(bs / cnt)],
      });
    }
  }

  // The player. `camera.ts` aims PAST the player by `lookAhead` so the GROUND window
  // is centred on him; the character himself therefore sits a little below frame
  // centre. Measured off a 1600x900 live frame: body spans y ~430-580, i.e. rows 4-5
  // of 9, centre column. So the player region is the 3x2 block cols 7-9, rows 4-5.
  const inPlayer = (c) => c.cx >= 7 && c.cx <= 9 && c.cy >= 4 && c.cy <= 5;
  const playerCells = cells.filter(inPlayer);
  const playerSalience = Math.max(...playerCells.map((c) => c.salience));

  const ranked = [...cells].sort((a, b) => b.salience - a.salience);
  const playerRank = ranked.findIndex((c) => inPlayer(c) && c.salience === playerSalience) + 1;
  // Loudest cells that are NOT the player — the things stealing the read.
  const topOther = ranked.filter((c) => !inPlayer(c)).slice(0, 3);

  // Player region vs the annulus around it: does the hero separate from his ground?
  const ring = cells.filter((c) => !inPlayer(c) && c.cx >= 5 && c.cx <= 11 && c.cy >= 2 && c.cy <= 7);
  const pMean = playerCells.reduce((s, c) => s + c.mean, 0) / playerCells.length;
  const rMean = ring.reduce((s, c) => s + c.mean, 0) / ring.length;
  const pSat = playerCells.reduce((s, c) => s + c.sat, 0) / playerCells.length;
  const rSat = ring.reduce((s, c) => s + c.sat, 0) / ring.length;

  // Saturation-weighted hue histogram: 12 bins of 30 deg.
  const bins = new Array(12).fill(0);
  let wsum = 0;
  for (let i = 0; i < n; i++) {
    if (sat[i] < 0.15) continue;              // greys carry no hue opinion
    const b = Math.floor(((hue[i] % 360) + 360) % 360 / 30) % 12;
    bins[b] += sat[i]; wsum += sat[i];
  }
  const hueHist = bins.map((v) => +(wsum ? v / wsum : 0).toFixed(3));
  const dominantBin = hueHist.indexOf(Math.max(...hueHist));

  return {
    playerRank,
    playerSalience: +playerSalience.toFixed(4),
    topOther: topOther.map((c) => ({ cell: `${c.cx},${c.cy}`, salience: c.salience, rgb: c.rgb, sat: c.sat, sd: c.sd })),
    centreContrast: { playerLuma: +pMean.toFixed(3), ringLuma: +rMean.toFixed(3), deltaLuma: +(pMean - rMean).toFixed(3), playerSat: +pSat.toFixed(3), ringSat: +rSat.toFixed(3) },
    medianLuma: +medianLuma.toFixed(3),
    hueHist,
    dominantHueDeg: dominantBin * 30,
    dominantHueShare: hueHist[dominantBin],
    clippedLowPct: +((clipped0 / n) * 100).toFixed(2),
    clippedHighPct: +((clipped255 / n) * 100).toFixed(2),
    _cells: cells,
  };
}

/** Outline the three loudest non-player cells in red and the player block in green. */
async function annotate(srcPng, outPng, m) {
  const cw = W / GRID_COLS, ch = H / GRID_ROWS;
  const rects = m.topOther.map((c, i) => {
    const [cx, cy] = c.cell.split(',').map(Number);
    return `<rect x="${cx * cw}" y="${cy * ch}" width="${cw}" height="${ch}" fill="none" stroke="#ff2d55" stroke-width="4"/>
            <text x="${cx * cw + 8}" y="${cy * ch + 28}" font-family="Helvetica" font-size="22" font-weight="700" fill="#ff2d55">#${i + 1}</text>`;
  }).join('');
  const player = `<rect x="${7 * cw}" y="${4 * ch}" width="${3 * cw}" height="${2 * ch}" fill="none" stroke="#31ff8f" stroke-width="4" stroke-dasharray="10 6"/>
                  <text x="${7 * cw + 8}" y="${4 * ch + 28}" font-family="Helvetica" font-size="22" font-weight="700" fill="#31ff8f">player rank ${m.playerRank}</text>`;
  const svg = Buffer.from(`<svg width="${W}" height="${H}" xmlns="http://www.w3.org/2000/svg">${rects}${player}</svg>`);
  await sharp(srcPng).composite([{ input: svg, top: 0, left: 0 }]).png().toFile(outPng);
}

// ─────────────────────────────────────────────────────────────────────────────
async function run() {
  await mkdir(OUT, { recursive: true });
  const browser = await chromium.launch({ args: LAUNCH_ARGS });
  const results = [];
  let failures = 0;

  console.log(`arena-scan · ${jobs.length} stations · ${W}x${H} · base ${BASE}`);
  console.log(`out: ${OUT}\n`);

  try {
    for (const s of jobs) {
      const page = await browser.newPage({ viewport: { width: W, height: H }, deviceScaleFactor: 1 });
      await page.route('**/@vite/client*', (r) => r.fulfill({ status: 200, contentType: 'text/javascript', body: HMR_STUB }));

      const errors = [];
      page.on('pageerror', (e) => errors.push(String(e)));
      page.on('console', (m) => { if (m.type() === 'error') errors.push(m.text()); });

      const url = `${BASE}/?player=${PLAYER}&enemy=${ENEMY}&px=${s.x}&py=${s.y}` +
                  `&fogRadius=${s.fog}&simSpeed=${SIM_SPEED}&pointerLock=0`;
      const full = join(OUT, `${s.id}.png`);
      const canvasPng = join(OUT, `${s.id}.canvas.png`);

      try {
        await page.goto(url, { waitUntil: 'networkidle', timeout: 60000 });
        await page.waitForFunction('window.__gameReady === true', null, { timeout: 60000 });
        await page.waitForTimeout(SETTLE_MS);

        const view = await page.evaluate(() => (window.__fairView ? window.__fairView() : null));
        await page.screenshot({ path: full, timeout: 90000 });
        await page.locator('canvas').first().screenshot({ path: canvasPng, timeout: 90000 });

        const m = await analyse(canvasPng);
        await annotate(full, join(OUT, `${s.id}.marked.png`), m);
        const { _cells, ...clean } = m;
        results.push({ ...s, url, view, ok: true, errors, metrics: clean });

        console.log(
          `✓ ${s.id.padEnd(14)} playerRank ${String(m.playerRank).padStart(3)}/${GRID_COLS * GRID_ROWS}` +
          `  ΔL ${String(m.centreContrast.deltaLuma).padStart(6)}` +
          `  domHue ${String(m.dominantHueDeg).padStart(3)}° ${(m.dominantHueShare * 100).toFixed(0)}%` +
          `  clip ${m.clippedLowPct}/${m.clippedHighPct}%`
        );
      } catch (err) {
        failures++;
        results.push({ ...s, url, ok: false, error: String(err), errors });
        console.error(`✗ ${s.id}\n  ${err}`);
        if (errors.length) console.error(`  page errors: ${errors.slice(0, 3).join(' | ')}`);
      } finally {
        await page.close();
      }
    }
  } finally {
    await browser.close();
  }

  await writeFile(join(OUT, 'metrics.json'), JSON.stringify({
    base: BASE, viewport: [W, H], player: PLAYER, enemy: ENEMY, simSpeed: SIM_SPEED,
    generated: new Date().toISOString(), stations: results,
  }, null, 2));

  // Contact sheets, 6 per sheet, so the whole map is one glance.
  const ok = results.filter((r) => r.ok);
  for (let i = 0; i < ok.length; i += 6) {
    const chunk = ok.slice(i, i + 6);
    try {
      execFileSync('node', [
        'tools/compare.mjs',
        '--tile', chunk.map((c) => join(OUT, `${c.id}.png`)).join(','),
        '--labels', chunk.map((c) => c.id).join(','),
        '--cols', '3', '--height', '420',
        '--out', join(OUT, `sheet_${Math.floor(i / 6) + 1}.png`),
      ], { stdio: 'inherit' });
    } catch { /* sheet is a convenience, never a gate */ }
  }

  // SUMMARY.txt — the thing you read first.
  const lines = [];
  lines.push(`WHOLE-ARENA SCAN  ${new Date().toISOString()}`);
  lines.push(`${BASE}  ${W}x${H}  player=${PLAYER} enemy=${ENEMY} simSpeed=${SIM_SPEED}`);
  lines.push('');
  lines.push('station          rank  pLuma  ringLuma   dL   pSat ringSat  domHue share  clip0 clip255  loudest (cell rgb)');
  for (const r of results) {
    if (!r.ok) { lines.push(`${r.id.padEnd(16)} FAILED  ${r.error}`); continue; }
    const m = r.metrics, c = m.centreContrast, t = m.topOther[0];
    lines.push(
      `${r.id.padEnd(16)} ${String(m.playerRank).padStart(4)}  ` +
      `${c.playerLuma.toFixed(3)}  ${c.ringLuma.toFixed(3)}  ${String(c.deltaLuma).padStart(6)}  ` +
      `${c.playerSat.toFixed(2)}   ${c.ringSat.toFixed(2)}   ` +
      `${String(m.dominantHueDeg).padStart(4)}° ${(m.dominantHueShare * 100).toFixed(0).padStart(3)}%  ` +
      `${m.clippedLowPct.toFixed(2)}  ${m.clippedHighPct.toFixed(2)}   ` +
      `${t.cell} rgb(${t.rgb.join(',')})`
    );
  }
  lines.push('');
  lines.push('HOW TO READ IT');
  lines.push('  rank      player region\'s place in a 16x9 salience grid. 1 = the eye goes to the hero.');
  lines.push('            Worse than ~6 means static decoration is out-shouting the player.');
  lines.push('  dL        player luma minus surrounding-ring luma. |dL| < 0.05 = the hero has no');
  lines.push('            value separation from his own ground.');
  lines.push('  domHue    hue bin holding the largest saturation-weighted share of the frame.');
  lines.push('            share > ~45% means the frame is one hue family and nothing reads as');
  lines.push('            "different kind of thing".');
  lines.push('  clip      % pixels with a channel at 0 / 255. The colour-grade regression check.');
  lines.push('            Was 9.39 / 10.60 before ToyGradeEffect; a jump means the grade broke again.');
  lines.push('  loudest   the top non-player cell as "col,row" in the 16x9 grid + its mean colour.');
  lines.push('            Open <id>.marked.png to see it outlined.');
  await writeFile(join(OUT, 'SUMMARY.txt'), lines.join('\n'));

  console.log(`\n${lines.slice(3, 3 + results.length + 1).join('\n')}`);
  console.log(`\nwrote ${OUT}/SUMMARY.txt, metrics.json, ${ok.length} frames + marked + sheets`);
  if (failures) process.exit(1);
}

run().catch((e) => { console.error(e); process.exit(1); });
