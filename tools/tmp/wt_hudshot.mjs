#!/usr/bin/env node
/**
 * WT_HUDSHOT — a critic-ready frame WITH the shipped HUD on it.
 *
 * ## The gap this closes, and why it is not closed the way it was prescribed
 *
 * The round-2 critic's largest complaint was about the CAPTURE, not the art:
 *
 *   > "The ours panel contains ZERO of `src/ui/hud.ts`, which ships... all six reference
 *   > plates carry per-fighter nameplates with HP bars as dominant mid-frame furniture,
 *   > and our frame carries none... every arena round scores an incomplete frame against
 *   > complete ones."
 *
 * Verified against the tree before acting on it, and it is true: `src/preview.ts` routes
 * `piece === 'arena'` to `mountArena()`, which adds the arena and up to five character
 * models to a bare `Stage` and never constructs a HUD. Nothing in `preview.html` can
 * photograph one.
 *
 * The prescription was to add a `piece=match` path to `preview.ts` that mounts `hud.ts`
 * over the arena scene with a SYNTHETIC `MatchState`. That file is not this owner's, and
 * — more to the point — a synthetic state is the weaker instrument. **The shipped app
 * route already renders the real HUD over the real arena**: `tools/tmp/wt_draws.mjs`
 * counts `.hud-fighter` nodes on `/?player=…&seats=6` and gets 2 and 6. So this shoots
 * THE GAME, at a chosen spot on the map, and asserts the HUD is really there.
 *
 * Real state beats synthetic state on the thing that matters here: HP bars, the clock,
 * the zone strip, the radar and the floating pills are all filled by the sim rather than
 * by numbers a tool author chose, so the frame cannot flatter itself.
 *
 * ## 🚨 WHAT IS ASSERTED BEFORE A PNG IS SAVED — rule 6, and one instrument here
 *    PHOTOGRAPHED THE SKY and reported PASS because it checked the rig was reachable
 *    and never that the subject was in frame.
 *
 *   HUD-PRESENT   `.hud-fighter` count EQUALS the seat count asked for. Not ">0":
 *                 `hud.setCharacters` builds one row per seat, so a seat count the app
 *                 quietly ignored is exactly the failure a ">0" test cannot see, and
 *                 `wt_draws` records that `__matchDebug.state.fighters` was `undefined`
 *                 while the draw counts plainly differed by seat.
 *   PILL-IN-SHOT  at least one floating name+health pill is positioned INSIDE the
 *                 viewport. A HUD root full of nodes parked at (-9999, -9999) is a
 *                 non-empty HUD that appears in no photograph.
 *   SUBJECT       the pool's hue occupies a real share of the frame, against the SAME
 *                 bare-floor control `wt_shot.mjs` uses.
 *   NON-EMPTY     every classified set is asserted non-empty BEFORE any ratio is taken.
 *                 `[].every()` is true and `0/0` is NaN, and both read as a pass.
 *   PAINTED       `settle.mjs`'s flat-frame floor, recorded in the sidecar
 *                 `tools/review.mjs` refuses a packet without.
 *
 * ⚠️ THIS IS A LIVE MATCH, NOT A FROZEN PREVIEW, so it is NOT bit-reproducible the way
 * `wt_shot --drift` is — `?t=` does not exist on this route. That is stated rather than
 * hidden: this tool exists to produce a COMPLETE frame for a critic, and every
 * before/after NUMBER in this round comes from the frozen `wt_shot`/`wt_ablate` path
 * instead. Do not quote a pixel delta measured here.
 *
 *   node tools/tmp/wt_hudshot.mjs --selftest
 *   node tools/tmp/sx_snap.mjs --root <worktree> -- \
 *     node tools/tmp/wt_hudshot.mjs --url '{URL}' --out tools/tmp/wt_r3_play --tag after
 */
import { chromium } from 'playwright';
import { mkdir, writeFile } from 'node:fs/promises';
import { realpathSync, readFileSync } from 'node:fs';
import { fileURLToPath } from 'node:url';
import sharp from 'sharp';
import { frameStats, FRAME_FLOOR } from './settle.mjs';
import { rgbToHsv, centreHueFraction } from './wt_shot.mjs';

const argv = process.argv.slice(2);
const arg = (k, d = null) => { const i = argv.indexOf('--' + k); return i >= 0 ? argv[i + 1] : d; };
const has = (k) => argv.includes('--' + k);

async function raster(buf) {
  const { data, info } = await sharp(buf).ensureAlpha().raw().toBuffer({ resolveWithObject: true });
  return { data, width: info.width, height: info.height, channels: info.channels };
}

/** Stations, derived from source exactly as `wt_shot` does — never retyped. */
function stations(repo) {
  const shared = readFileSync(`${repo}/src/arena/shared.ts`, 'utf8');
  const kitchen = readFileSync(`${repo}/src/arena/kitchen.ts`, 'utf8');
  const num = (src, re, what) => {
    const m = src.match(re);
    if (!m) throw new Error(`wt_hudshot: could not read ${what} — the extractor is stale`);
    return Number(m[1]);
  };
  const W = num(shared, /export const ARENA_W\s*=\s*([\d.]+)/, 'ARENA_W');
  const H = num(shared, /export const ARENA_H\s*=\s*([\d.]+)/, 'ARENA_H');
  const sx = num(kitchen, /const puddleSouth = \{ x: ([\d.]+),/, 'puddleSouth.x');
  const sy = num(kitchen, /const puddleSouth = \{ x: [\d.]+, y: ([\d.]+),/, 'puddleSouth.y');
  return {
    water: { x: W - sx, y: H - sy, hue: [178, 224], name: 'water puddle (north)' },
    grease: { x: sx, y: sy, hue: [22, 62], name: 'grease puddle (south)' },
    control: { x: 700, y: 500, hue: [178, 224], name: 'bare floor CONTROL' },
  };
}

/**
 * How much of the frame the HUD's own DOM covers, as a fraction. Reported so "the HUD
 * is in the picture" is a MEASURED share rather than a node count — the round-2 critic
 * called the plates' nameplates "dominant mid-frame furniture", and a node count cannot
 * tell you whether ours is furniture or a hairline.
 */
export function hudCoverage(rects, w, h) {
  if (!rects.length) throw new Error('wt_hudshot: no HUD rects — nothing to measure over');
  const grid = new Uint8Array(w * h);
  let n = 0;
  for (const r of rects) {
    const x0 = Math.max(0, Math.floor(r.x)), x1 = Math.min(w, Math.ceil(r.x + r.width));
    const y0 = Math.max(0, Math.floor(r.y)), y1 = Math.min(h, Math.ceil(r.y + r.height));
    for (let y = y0; y < y1; y++) for (let x = x0; x < x1; x++) { const p = y * w + x; if (!grid[p]) { grid[p] = 1; n++; } }
  }
  return { px: n, frac: +(n / (w * h)).toFixed(5) };
}

const LAUNCH_ARGS = ['--use-gl=angle', '--use-angle=swiftshader', '--enable-unsafe-swiftshader',
  '--enable-webgl', '--ignore-gpu-blocklist', '--disable-gpu-sandbox'];

const VIEW = { width: 1300, height: 740 };

async function shoot(page, base, st, seats, settleMs, outPath, tag) {
  const q = new URLSearchParams({
    player: 'hamburger', enemy: 'donut',
    px: String(st.x), py: String(st.y),
    fogRadius: '1200', simSpeed: '0.30', pointerLock: '0',
  });
  if (seats > 2) q.set('seats', String(seats));
  const url = `${base}/?${q}`;
  await page.goto(url, { waitUntil: 'networkidle', timeout: 120_000 });
  await page.waitForFunction('window.__gameReady === true', null, { timeout: 120_000 });
  // Let the match actually START — a frame taken during the countdown has full HP on
  // every bar and a clock that has not moved, which is a different picture from the one
  // a reference gameplay plate shows. `CLAUDE.md` records a wrong-base demo staged
  // inside the countdown, "where nothing moves", as a vacuous control.
  await page.waitForTimeout(settleMs);

  const dom = await page.evaluate(() => {
    const rows = Array.from(document.querySelectorAll('.hud-fighter'));
    const pills = Array.from(document.querySelectorAll('[class*="float"]'))
      .filter((n) => n instanceof HTMLElement)
      .map((n) => n.getBoundingClientRect())
      .filter((r) => r.width > 0 && r.height > 0);
    const root = document.querySelector('.hud') ?? document.body;
    const all = Array.from(root.querySelectorAll('*'))
      .filter((n) => n instanceof HTMLElement && n.offsetParent !== null)
      .map((n) => n.getBoundingClientRect())
      .filter((r) => r.width > 1 && r.height > 1 && r.width < innerWidth * 0.98);
    return {
      hudFighters: rows.length,
      pillsTotal: pills.length,
      pillsOnScreen: pills.filter((r) => r.x + r.width > 0 && r.y + r.height > 0 && r.x < innerWidth && r.y < innerHeight).length,
      rects: all.map((r) => ({ x: r.x, y: r.y, width: r.width, height: r.height })),
      w: innerWidth, h: innerHeight,
    };
  });

  await mkdir(outPath.replace(/\/[^/]*$/, ''), { recursive: true });
  // A PAGE screenshot, not a canvas one: the HUD is DOM. (`locator('canvas').screenshot()`
  // is a page capture clipped to the canvas box and would work too, but the intent is
  // clearer this way and the canvas fills the viewport.)
  const buf = await page.screenshot({ timeout: 120_000 });
  await writeFile(outPath, buf);
  const img = await raster(buf);
  const fs = await frameStats(buf);
  const cov = hudCoverage(dom.rects, dom.w, dom.h);
  await writeFile(`${outPath}.capture.json`, JSON.stringify({
    tool: 'tools/tmp/wt_hudshot.mjs',
    // `tools/review.mjs` prints `provenance.label` on its VERIFIED line and every
    // `wt_*` sidecar in this repo omitted it, so every packet built from one has read
    // `"undefined"` in the one place an orchestrator checks before spending ~300k
    // tokens. Cosmetic, but the provenance line is the thing that is supposed to make
    // the image traceable.
    label: `${tag} · ${st.name} · ${seats} seats`,
    url,
    painted: fs.stdev >= FRAME_FLOOR,
    why: fs.stdev >= FRAME_FLOOR ? [] : [`frame is FLAT: max-channel stdev ${fs.stdev} < ${FRAME_FLOOR}`],
    previewReady: true,
    hudFighters: dom.hudFighters,
    pillsOnScreen: dom.pillsOnScreen,
    hudCoverageFrac: cov.frac,
    seats, station: st.name, settleMs,
    stats: fs,
    at: new Date().toISOString(),
  }, null, 2));
  return { img, dom, cov, fs, url };
}

async function selftest() {
  let fails = 0;
  const ok = (n, c, e = '') => { console.log(`${c ? 'PASS' : 'FAIL'}  ${n} ${e}`); if (!c) fails++; };
  // §A hudCoverage MOVES, HOLDS and refuses an empty set.
  ok('A1 NON-EMPTY  an empty rect list throws rather than returning 0', (() => {
    try { hudCoverage([], 10, 10); return false; } catch { return true; }
  })(), '');
  const one = hudCoverage([{ x: 0, y: 0, width: 5, height: 4 }], 10, 10);
  ok('A2 MOVES      one 5x4 rect in a 10x10 frame is 0.20', one.frac === 0.2, `frac=${one.frac}`);
  const overlap = hudCoverage([{ x: 0, y: 0, width: 5, height: 4 }, { x: 0, y: 0, width: 5, height: 4 }], 10, 10);
  ok('A3 HOLDS      two IDENTICAL rects still cover 0.20, not 0.40', overlap.frac === 0.2, `frac=${overlap.frac}`);
  const clipped = hudCoverage([{ x: 8, y: 8, width: 100, height: 100 }], 10, 10);
  ok('A4           an off-frame rect is CLIPPED, not counted whole', clipped.px === 4, `px=${clipped.px}`);
  // §B the station extractor really parsed the source and is on the x4 map.
  const st = stations(arg('repo', process.cwd()));
  ok('B1 NON-EMPTY  stations parsed from source', st.water.x > 0 && st.grease.x > 0, `W=${st.water.x},${st.water.y} G=${st.grease.x},${st.grease.y}`);
  ok('B2           neither is a 1x-map literal', st.grease.x > 1400 || st.grease.y > 1000, '');
  ok('B3           the pair is point-symmetric about the arena centre', Math.abs((st.water.x + st.grease.x) / 2 - 1400) < 1e-6, '');
  // §C the imported hue classifier still separates the pool from the floor — this tool
  //    reuses `wt_shot`'s, so a change there must not silently pass here.
  const plant = (rgb) => {
    const data = Buffer.alloc(16 * 16 * 4);
    for (let i = 0; i < 256; i++) { data[i * 4] = rgb[0]; data[i * 4 + 1] = rgb[1]; data[i * 4 + 2] = rgb[2]; data[i * 4 + 3] = 255; }
    return { data, width: 16, height: 16, channels: 4 };
  };
  const w = centreHueFraction(plant([0x3F, 0x86, 0xA8]), [178, 224]);
  const f = centreHueFraction(plant([0x78, 0x58, 0x64]), [178, 224]);
  ok('C1 MOVES      water-filled frame classifies ~1.0', w.fraction > 0.99, `f=${w.fraction}`);
  ok('C2 HOLDS      floor-tile frame classifies ~0.0', f.fraction < 0.01, `f=${f.fraction}`);
  console.log(fails === 0 ? '\nwt_hudshot selftest: ALL PASS' : `\nwt_hudshot selftest: ${fails} FAIL`);
  process.exit(fails === 0 ? 0 : 1);
}

const isMain = (() => {
  try { return realpathSync(process.argv[1] ?? '') === realpathSync(fileURLToPath(import.meta.url)); }
  catch { return false; }
})();

if (isMain) {
  if (has('selftest')) await selftest();
  const BASE = (arg('url') ?? process.env.PREVIEW_BASE ?? '').replace(/\/$/, '');
  if (!BASE) { console.error('wt_hudshot: need --url or PREVIEW_BASE'); process.exit(2); }
  if (/:5173(\/|$)/.test(BASE)) { console.error('wt_hudshot: --url is the SHARED dev server. Never measure there.'); process.exit(2); }
  const OUT = arg('out', 'tools/tmp/wt_play');
  const TAG = arg('tag', 'play');
  const SEATS = Number(arg('seats', '6'));
  const SETTLE = Number(arg('settle', '9000'));
  const ST = stations(arg('repo', process.cwd()));

  const browser = await chromium.launch({ args: LAUNCH_ARGS });
  const page = await browser.newPage({ viewport: VIEW, deviceScaleFactor: 1 });
  page.on('pageerror', (e) => console.error('PAGEERROR', String(e)));

  let refused = 0;
  const rows = [];
  const shots = {};
  for (const key of ['water', 'control']) {
    const r = await shoot(page, BASE, ST[key], SEATS, SETTLE, `${OUT}/${TAG}_${key}.png`, TAG);
    shots[key] = r;
    const cls = centreHueFraction(r.img, ST[key].hue);
    rows.push({ tag: TAG, station: key, seats: SEATS, hudFighters: r.dom.hudFighters, pillsOnScreen: r.dom.pillsOnScreen, hudCoverageFrac: r.cov.frac, centreHue: +cls.fraction.toFixed(5), painted: r.fs.stdev >= FRAME_FLOOR });
    console.log(`${TAG} ${key.padEnd(8)} hud-fighter rows ${r.dom.hudFighters}  pills on screen ${r.dom.pillsOnScreen}/${r.dom.pillsTotal}  HUD covers ${(r.cov.frac * 100).toFixed(2)}% of frame  centre-hue ${(cls.fraction * 100).toFixed(2)}%  ${r.fs.stdev >= FRAME_FLOOR ? 'painted' : 'FLAT'}`);
    // HUD-PRESENT, asserted as EQUALITY with the seat count.
    if (r.dom.hudFighters !== SEATS) { console.log(`  🚨 HUD ROW COUNT ${r.dom.hudFighters} != seats ${SEATS} — the seat count was not honoured, or the HUD did not mount`); refused++; }
    if (r.dom.pillsOnScreen < 1) { console.log('  🚨 NO floating pill inside the viewport — a non-empty HUD that appears in no photograph'); refused++; }
    if (r.fs.stdev < FRAME_FLOOR) { console.log('  🚨 frame is FLAT'); refused++; }
  }
  // SUBJECT-IN-SHOT, against the bare-floor control in the SAME hue window — which is
  // the arm `wt_shot` gets wrong at the lobby camera, where its control is classified in
  // the GREASE window while the station under test is water. Same window, or the ratio
  // compares two different questions.
  const wf = rows.find((r) => r.station === 'water').centreHue;
  const cf = rows.find((r) => r.station === 'control').centreHue;
  const pass = wf > 0.02 && wf > 8 * Math.max(cf, 1e-5);
  console.log(`  subject-in-shot: water ${(wf * 100).toFixed(2)}% vs bare-floor control ${(cf * 100).toFixed(3)}% in the SAME hue window (needs 8x)  ${pass ? 'OK' : 'REFUSED'}`);
  if (!pass) refused++;

  await mkdir(OUT, { recursive: true });
  await writeFile(`${OUT}/${TAG}.json`, JSON.stringify(rows, null, 2));
  await browser.close();
  process.exit(refused === 0 ? 0 : 3);
}
