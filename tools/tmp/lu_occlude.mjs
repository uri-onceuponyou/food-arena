#!/usr/bin/env node
/**
 * LANDSCAPE OCCLUSION — how much of the CONTESTED frame does each control cover?
 *
 * ── Why this exists ─────────────────────────────────────────────────────────
 * Uri, from a landscape phone: *"the weapon choosing is on the most critical part of
 * the screen where most gameplay happens."* That is a claim about PIXELS, and this
 * project's most-repeated failure is answering a claim about pixels with a claim about
 * taste. A layout that merely looks tidier is not a deliverable — the number has to
 * fall.
 *
 * ── THE METRIC, stated before anything moved ────────────────────────────────
 * "Where gameplay happens" is not judged by eye and is not sampled from a fixture. It
 * is `render/camera.ts:FAIR_PLAY.radiusUnits` = **199.2 wu**, the radius around the
 * local fighter that every supported device is GUARANTEED to show, derived in that file
 * from `rules.ts`: longest ranged reach 140 + `HIT_RADIUS_VS_PLAYER` 25.2 + 34 wu of
 * reaction. The whole camera exists to honour it. Nothing else here has a better claim
 * to the phrase Uri used.
 *
 * So the probe unprojects every 4 px cell of the frame onto the ground plane, keeps the
 * cells whose ground point lies inside that disc, and weighs each by the GROUND AREA it
 * shows, in wu². A control's occlusion is the share of the guaranteed-visible arena it
 * hides. **Not a share of pixels** — a pixel at the bottom of a 58 degree frame shows a
 * fraction of the ground a pixel at the top does, so a pixel metric quietly flatters
 * every control parked along the bottom edge, which is where they all are.
 *
 * ── WHAT WAS BUILT, MEASURED AND WITHDRAWN ──────────────────────────────────
 * The first version sampled a live match instead: it drove the twin sticks over CDP for
 * 130 s per viewport and accumulated every fighter box and projectile into a heat map.
 * Three defects killed it, in order of discovery, and all three are worth keeping:
 *   1. `page.evaluate("() => {...}")` evaluates the string as an EXPRESSION, so it
 *      returned a Function, which does not serialise. Every control scored a confident
 *      **0.00%** — a silent zero that reads exactly like "nothing is occluded".
 *   2. With the shipped two-fighter spawn the opponent is 1080 wu away against a 199 wu
 *      guarantee, so it was **never in frame**: the field map came back byte-identical
 *      to the local fighter's own, and the "field" column was the "player" column under
 *      a second name.
 *   3. Fixed with `np_nfighter`'s four-seat ring it finally produced real numbers — and
 *      **zero contested mass in the right 35% of the frame**, because one scripted walk
 *      with three AI chasing it is not isotropic. That bias would have made a
 *      right-hand control look free and a left-hand one expensive, which is exactly the
 *      decision this pass exists to make.
 * The derived disc has none of those failure modes and needs no fixture at all.
 *
 * ⚠️ AND IT MEASURES WHAT IS HIDDEN, NOT WHAT IS UGLY. A control that hides 0% of the
 * disc can still be in the wrong place — sitting under the thumb that must never leave
 * the fire stick, or breaking the reference pattern of "corners for controls, centre
 * clear". This number is necessary, not sufficient.
 *
 * ── KNOWN-BAD INPUT (`CLAUDE.md` §6) ────────────────────────────────────────
 * `--selftest` drives the scorer against a synthetic disc whose cells have KNOWN and
 * UNEQUAL ground areas. Its last row is the tautology check: two rects of identical
 * pixel area over different ground must score differently, which a scorer returning
 * "rect area / frame area" cannot do.
 * `--known-bad` re-scores the live tree with the tray forced back to one row at
 * bottom-centre. If that does not come out WORSE than what shipped, the instrument is
 * not reading the rule that moved and the run exits non-zero.
 *
 *   node tools/tmp/headserve.mjs --ref <sha> -- node tools/tmp/lu_occlude.mjs --save shots/lu/before --known-bad
 *   node tools/tmp/headserve.mjs --ref <sha> --overlay src/ui/hud.ts -- \
 *     node tools/tmp/lu_occlude.mjs --save shots/lu/after --known-bad
 *   node tools/tmp/lu_occlude.mjs --selftest
 */
import { chromium } from 'playwright';
import { mkdir } from 'node:fs/promises';

const LAUNCH_ARGS = ['--use-gl=angle', '--use-angle=swiftshader', '--enable-unsafe-swiftshader',
  '--enable-webgl', '--ignore-gpu-blocklist', '--disable-gpu-sandbox'];

const a = process.argv.slice(2);
const has = (k) => a.includes(k);
const get = (k, d) => (a.includes(k) ? a[a.indexOf(k) + 1] : d);
const BASE = (get('--url', process.env.PREVIEW_BASE) ?? 'http://localhost:5188').replace(/\/$/, '');
const SAVE = get('--save', null);
/** `--map` also writes a `-map.png` per viewport: the disc's ground-area density with
 *  every control stroked over it. Needs `--save`. */
const MAP = has('--map');
const CELL = 4; // px per grid cell — 4 is well below the smallest control (40px slot)

/**
 * Landscape phone viewports, CSS px at deviceScaleFactor 1.
 * 844x390 is the iPhone 14/15 landscape viewport with the toolbars collapsed, which is
 * the frame Uri photographed. 667x375 is the narrowest landscape phone this HUD's own
 * arithmetic is derived against (`hud.ts`'s chip-rail comment). 932x430 is the largest.
 */
const VIEWPORTS = [
  { tag: 'ph-844', width: 844, height: 390 },
  { tag: 'ph-667', width: 667, height: 375 },
  { tag: 'ph-932', width: 932, height: 430 },
];

/**
 * Every element a thumb-driven landscape player has drawn ON TOP of the world, as the
 * LEAVES THAT ACTUALLY PAINT.
 *
 * 🚨 A CONTAINER'S BOUNDING RECT IS NOT ITS INK, AND THE FIRST RUN QUOTED THE
 * CONTAINER. `.hud-topbar` is a full-width flex/grid row with a nameplate at each end
 * and the clock in the middle; its rect is 816x106 px of which the great majority is
 * empty gap that the world shows straight through. Scored that way it "covered" 39.6%
 * of the contested field at 844x390 — a number that is arithmetically correct, entirely
 * false, and would have sent this pass off to rebuild the nameplates. Every entry below
 * is a set of leaves whose union is taken; nothing here is a layout box.
 *
 * ⚠️ `.hud-topbar-scrim` is DELIBERATELY EXCLUDED and that is a judgement, stated so it
 * can be argued with: it is a gradient tint, not an opaque plate, so it darkens the
 * world under it rather than hiding it. Counting it would make the top bar dominate
 * every row here on the strength of pixels a player can see through.
 */
const CONTROLS = [
  { name: 'weapon tray', sel: ['.hud-weapon-slot'] },
  { name: 'radar card', sel: ['.hud-radar'] },
  { name: 'nameplates', sel: ['.hud-fighter'] },
  { name: 'clock + zone', sel: ['.hud-clock'] },
  // ⚠️ `.hud-clock` ABOVE IS A LAYOUT BOX, WHICH THIS FILE'S OWN HEADER FORBIDS —
  // added 2026-08-11 so the contradiction is measured rather than argued. It is a
  // centred flex COLUMN holding a narrow timer pill over a 196px zone plate, so its
  // rect carries a wedge of empty gap either side of the timer that the world shows
  // straight through. That row is KEPT unchanged so §62's published 13.12% still
  // reproduces from this tool; this row is the honest one, and the gap between them
  // is printed as `clock box - ink` below. Both are reported; neither is deleted.
  { name: 'clock INK', sel: ['.hud-timer', '.hud-zone'] },
  { name: 'stick hints', sel: ['.tch-hint-ring', '.tch-hint-label'] },
  { name: 'mute badge', sel: ['.hud-mute'] },
];
/** Rows that are a strict superset of another row — excluded from ALL (union) so the
 *  union is over INK, and from the per-row loop's `all` accumulator. */
const BOX_ROWS = new Set(['clock + zone']);

const sleep = (ms) => new Promise((r) => setTimeout(r, ms));

// ── THE PRIMARY METRIC: the fair-play disc, in world units ──────────────────
/**
 * 🚨 THE SAMPLED MAP IS FIXTURE-DEPENDENT AND THIS ONE IS NOT. Read both.
 *
 * The first empirical map came back with **zero contested mass in the right 35% of the
 * frame** — an artefact of one scripted walk with three AI chasing it, not a property
 * of the game. A metric whose answer depends on which way the fixture happened to run
 * would make a right-hand control look free and a left-hand one look expensive, which
 * is precisely the decision this pass has to make. So the number that governs is
 * derived, not sampled:
 *
 *   `render/camera.ts:FAIR_PLAY.radiusUnits` = **199.2 wu** is the radius around the
 *   local fighter that EVERY supported device is guaranteed to show, and it is derived
 *   from `rules.ts` — longest ranged reach (140) + hit radius (25.2) + a reaction
 *   allowance (34). It is the game's own written definition of "the region where
 *   gameplay happens". Nothing else on this project has a better claim to the phrase.
 *
 * So: unproject the screen onto the ground plane, keep the cells whose ground point
 * lies inside that disc, and weigh each one by the GROUND AREA it shows, in wu². A
 * control's occlusion is then the share of the guaranteed-visible ARENA it hides — not
 * a share of pixels, which would flatter anything parked at the bottom of a pitched
 * frame where a pixel shows the least ground.
 *
 * ⚠️ Both currencies are reported. `px` is what the eye sees; `wu2` is what the fight
 * loses. They differ by up to 3x across a 58° frame and quoting the wrong one is how a
 * bottom-edge control gets talked down.
 */
const DISC_FN = `() => {
  const stage = window.__stage;
  const dbg = window.__vfxDebugFighters;
  if (!stage || !dbg || !window.__fairView) return null;
  const cam = stage.rig.camera;
  const rect = stage.canvas.getBoundingClientRect();
  const V = Object.getPrototypeOf(cam.position).constructor;
  const CELL = ${CELL};
  const S = 0.05;
  const R_WU = 199.2;               // camera.ts FAIR_PLAY.radiusUnits
  const me = (dbg.slots ? dbg.slots[0] : dbg.player);
  const px = me.x * S, pz = me.y * S;
  const vw = window.innerWidth, vh = window.innerHeight;
  const gw = Math.ceil(vw / CELL) + 1, gh = Math.ceil(vh / CELL) + 1;
  // Ground point for every CELL CORNER, in world units. null above the horizon.
  const gx = new Float64Array(gw * gh), gz = new Float64Array(gw * gh);
  const ok = new Uint8Array(gw * gh);
  const tmp = new V();
  for (let r = 0; r < gh; r++) {
    for (let c = 0; c < gw; c++) {
      const sx = c * CELL, sy = r * CELL;
      const nx = ((sx - rect.left) / rect.width) * 2 - 1;
      const ny = -(((sy - rect.top) / rect.height) * 2 - 1);
      tmp.set(nx, ny, 0.5).unproject(cam);
      const dx = tmp.x - cam.position.x, dy = tmp.y - cam.position.y, dz = tmp.z - cam.position.z;
      if (dy >= -1e-9) continue;                    // at or above the horizon
      const t = -cam.position.y / dy;
      if (!(t > 0) || !isFinite(t)) continue;
      const i = r * gw + c;
      gx[i] = (cam.position.x + dx * t) / S;
      gz[i] = (cam.position.z + dz * t) / S;
      ok[i] = 1;
    }
  }
  // Per CELL: ground area (wu^2) and whether its centre lies inside the fair disc.
  const cw = gw - 1, ch = gh - 1;
  const area = new Float64Array(cw * ch);
  const inDisc = new Uint8Array(cw * ch);
  let discArea = 0, discCells = 0;
  for (let r = 0; r < ch; r++) {
    for (let c = 0; c < cw; c++) {
      const a = r * gw + c, b = a + 1, d = a + gw, e = d + 1;
      if (!(ok[a] && ok[b] && ok[d] && ok[e])) continue;
      // Shoelace over the four ground corners.
      const A = Math.abs(
        (gx[a] * gz[b] - gx[b] * gz[a]) + (gx[b] * gz[e] - gx[e] * gz[b]) +
        (gx[e] * gz[d] - gx[d] * gz[e]) + (gx[d] * gz[a] - gx[a] * gz[d])
      ) / 2;
      const mx = (gx[a] + gx[b] + gx[d] + gx[e]) / 4 - me.x;
      const my = (gz[a] + gz[b] + gz[d] + gz[e]) / 4 - me.y;
      const i = r * cw + c;
      area[i] = A;
      if (mx * mx + my * my <= R_WU * R_WU) { inDisc[i] = 1; discArea += A; discCells++; }
    }
  }
  // 🚨 THE ONE NUMBER A LAYOUT DECISION NEEDS, AND A BINNED PROFILE CANNOT GIVE IT.
  // The guarantee is a DISC, so on screen it has a TOP ARC — above which the ground is
  // further than 199.2 wu and is worth exactly zero however many pixels it occupies.
  // A control that fits entirely above this line is free. Reported exactly (to the
  // 4 px cell) rather than as "somewhere in the first bin", because the whole point of
  // the number is to size a control against it.
  let discTopY = -1;
  for (let r = 0; r < ch && discTopY < 0; r++) {
    for (let c = 0; c < cw; c++) if (inDisc[r * cw + c]) { discTopY = r * CELL; break; }
  }
  return {
    cell: CELL, cw, ch, vw, vh, discArea, discCells, discTopY,
    area: Array.from(area), inDisc: Array.from(inDisc),
    view: window.__fairView(),
    canvas: { x: rect.left, y: rect.top, w: rect.width, h: rect.height },
    player: { x: me.x, y: me.y },
  };
}`;

/** Ground area (wu^2) and cell count of the fair disc that a set of rects hides. */
function discUnder(disc, rects) {
  const seen = new Uint8Array(disc.cw * disc.ch);
  let wu2 = 0, cells = 0;
  for (const rect of rects) {
    if (!rect || rect.width <= 0 || rect.height <= 0) continue;
    const c0 = Math.max(0, Math.floor(rect.x / disc.cell));
    const c1 = Math.min(disc.cw - 1, Math.ceil((rect.x + rect.width) / disc.cell) - 1);
    const r0 = Math.max(0, Math.floor(rect.y / disc.cell));
    const r1 = Math.min(disc.ch - 1, Math.ceil((rect.y + rect.height) / disc.cell) - 1);
    for (let r = r0; r <= r1; r++) {
      for (let c = c0; c <= c1; c++) {
        const i = r * disc.cw + c;
        if (seen[i] || !disc.inDisc[i]) continue;
        seen[i] = 1;
        wu2 += disc.area[i];
        cells++;
      }
    }
  }
  return { wu2, cells };
}

/**
 * WHERE THE EXPENSIVE GROUND IS, BY SCREEN BAND.
 *
 * 🚨 THIS IS THE ROW THAT EXPLAINS EVERY OTHER ROW, AND IT WAS MISSING. The headline
 * numbers say a top-centre control is expensive and a bottom-corner one is free, and
 * that reads as an assertion about taste unless you can see the density that produces
 * it. A pixel at the top of a 58 degree frame shows several times the ground a pixel at
 * the bottom does — but only up to the point where the ground it shows has left the
 * 199.2 wu disc entirely, after which it is worth exactly ZERO. So the profile is not
 * monotonic in screen height and cannot be reasoned about from the pitch alone:
 * the mass sits in a band, and moving a control ABOVE that band is as good as moving it
 * below it. Printed for every viewport so a layout decision can name the band it moved
 * a control out of.
 */
function bandProfile(disc, nBands = 10) {
  const rowsPerBand = Math.max(1, Math.ceil(disc.ch / nBands));
  const out = [];
  for (let b = 0; b * rowsPerBand < disc.ch; b++) {
    const r0 = b * rowsPerBand, r1 = Math.min(disc.ch, r0 + rowsPerBand);
    let wu2 = 0, cells = 0;
    for (let r = r0; r < r1; r++) {
      for (let c = 0; c < disc.cw; c++) {
        const i = r * disc.cw + c;
        if (!disc.inDisc[i]) continue;
        wu2 += disc.area[i];
        cells++;
      }
    }
    out.push({
      y0: r0 * disc.cell, y1: r1 * disc.cell, wu2, cells,
      perPx: cells > 0 ? wu2 / (cells * disc.cell * disc.cell) : 0,
    });
  }
  return out;
}

/**
 * The page-side overlay, so the numbers above can be LOOKED AT (`CLAUDE.md` §3).
 * Each in-disc cell is tinted by its ground area relative to the frame's own maximum —
 * cyan is cheap ground, magenta is expensive — and every control's rect is stroked. A
 * band that is black is ground the guarantee does not cover, and a control sitting on
 * black costs nothing however large it is.
 */
const MAP_FN = `(disc, groups) => {
  const old = document.getElementById('lu-map');
  if (old) old.remove();
  const cv = document.createElement('canvas');
  cv.id = 'lu-map';
  cv.width = disc.vw; cv.height = disc.vh;
  cv.style.cssText = 'position:fixed;left:0;top:0;width:100%;height:100%;z-index:2147483646;pointer-events:none';
  document.body.appendChild(cv);
  const g = cv.getContext('2d');
  let max = 0;
  for (let i = 0; i < disc.area.length; i++) if (disc.inDisc[i] && disc.area[i] > max) max = disc.area[i];
  for (let r = 0; r < disc.ch; r++) {
    for (let c = 0; c < disc.cw; c++) {
      const i = r * disc.cw + c;
      if (!disc.inDisc[i]) continue;
      const t = max > 0 ? disc.area[i] / max : 0;
      g.fillStyle = 'rgba(' + Math.round(60 + 195 * t) + ',' + Math.round(230 - 200 * t) + ',255,0.42)';
      g.fillRect(c * disc.cell, r * disc.cell, disc.cell, disc.cell);
    }
  }
  g.lineWidth = 2;
  g.font = '11px monospace';
  for (const g2 of groups) {
    g.strokeStyle = g2.color; g.fillStyle = g2.color;
    for (const r of g2.rects) { g.strokeRect(r.x + 1, r.y + 1, r.width - 2, r.height - 2); }
    if (g2.rects[0]) g.fillText(g2.name, g2.rects[0].x + 3, g2.rects[0].y - 3);
  }
}`;

function selftest() {
  let pass = 0, fail = 0;
  const t = (name, ok, detail = '') => {
    if (ok) { pass++; console.log(`  ok   ${name}`); }
    else { fail++; console.log(`  FAIL ${name}  ${detail}`); }
  };
  // A 5x4 grid of 4px cells. Every cell is 1 wu² of ground EXCEPT column 3, which is
  // 10 wu² — the perspective case: a control parked over the cheap cells must not score
  // the same as one over the expensive ones. Row 3 is outside the disc entirely.
  const cw = 5, ch = 4;
  const area = new Array(cw * ch).fill(1);
  const inDisc = new Array(cw * ch).fill(1);
  for (let r = 0; r < ch; r++) area[r * cw + 3] = 10;
  for (let c = 0; c < cw; c++) inDisc[3 * cw + c] = 0;
  const disc = { cell: 4, cw, ch, area, inDisc, discArea: area.reduce((s, v, i) => s + (inDisc[i] ? v : 0), 0) };

  t('the denominator is the IN-DISC area only, not the whole grid',
    disc.discArea === 3 * (4 * 1 + 10), `discArea=${disc.discArea}`);
  const one = discUnder(disc, [{ x: 0, y: 0, width: 4, height: 4 }]);
  t('a rect over one cheap cell hides 1 wu²', one.wu2 === 1 && one.cells === 1, JSON.stringify(one));
  const rich = discUnder(disc, [{ x: 12, y: 0, width: 4, height: 4 }]);
  t('the SAME rect over an expensive cell hides 10 wu² — pixels are not the currency',
    rich.wu2 === 10, JSON.stringify(rich));
  const outside = discUnder(disc, [{ x: 0, y: 12, width: 20, height: 4 }]);
  t('a rect entirely outside the disc hides nothing', outside.wu2 === 0, JSON.stringify(outside));
  const dup = discUnder(disc, [{ x: 0, y: 0, width: 8, height: 4 }, { x: 4, y: 0, width: 8, height: 4 }]);
  t('overlapping rects are a UNION, not a sum', dup.wu2 === 3 && dup.cells === 3, JSON.stringify(dup));
  const clipped = discUnder(disc, [{ x: 16, y: 0, width: 400, height: 4 }]);
  t('a rect running off the right edge does not wrap onto the next row',
    clipped.wu2 === 1 && clipped.cells === 1, JSON.stringify(clipped));
  const zero = discUnder(disc, [{ x: 0, y: 0, width: 0, height: 0 }]);
  t('a zero-area rect (a hidden control) hides nothing', zero.wu2 === 0, JSON.stringify(zero));
  const none = discUnder(disc, []);
  t('no rects at all hides nothing', none.wu2 === 0, JSON.stringify(none));
  // 🚨 THE TAUTOLOGY CHECK. A scorer that returned `rect area / grid area` would pass
  // several of the rows above. This is the row it cannot pass: two rects of IDENTICAL
  // pixel area over different ground must score differently.
  const cheap = discUnder(disc, [{ x: 0, y: 0, width: 4, height: 4 }]).wu2;
  const dear = discUnder(disc, [{ x: 12, y: 0, width: 4, height: 4 }]).wu2;
  t('two rects of identical PIXEL area score differently — the metric is not px in disguise',
    cheap !== dear && dear === 10 * cheap, `${cheap} vs ${dear}`);

  // ── bandProfile, against a disc whose bands are DELIBERATELY UNEQUAL ────────
  // Four rows of four 4px cells. Row r is worth (r+1) wu² per cell, and the last row is
  // outside the disc. A profile that reported "pixels per band" — the obvious wrong
  // implementation, and the one a pixel metric would give — passes none of the last two.
  const bw = 4, bh = 4;
  const barea = new Array(bw * bh);
  const bin = new Array(bw * bh).fill(1);
  for (let r = 0; r < bh; r++) for (let c = 0; c < bw; c++) barea[r * bw + c] = r + 1;
  for (let c = 0; c < bw; c++) bin[3 * bw + c] = 0;
  const bdisc = { cell: 4, cw: bw, ch: bh, area: barea, inDisc: bin };
  const prof = bandProfile(bdisc, 4);
  t('the profile has one band per requested split', prof.length === 4, `got ${prof.length}`);
  t('the bands SUM to the whole in-disc area — nothing is dropped or double-counted',
    prof.reduce((s, b) => s + b.wu2, 0) === 4 * (1 + 2 + 3), JSON.stringify(prof.map((b) => b.wu2)));
  t('a band whose ground is outside the disc scores 0 however many pixels it holds',
    prof[3].wu2 === 0 && prof[3].cells === 0, JSON.stringify(prof[3]));
  t('two bands of identical PIXEL count report different wu² per px — the profile is not a pixel histogram',
    prof[0].cells === prof[2].cells && prof[0].perPx * 3 === prof[2].perPx,
    `${prof[0].perPx} vs ${prof[2].perPx}`);

  // ⚠️ THE SUMMARY LINE'S SHAPE IS A CONTRACT, NOT A STYLE. gatecount's OFFLINE probe
  // matches /^\s*(\d+) passed, \d+ failed\s*$/m — the count must START the line. A first
  // draft printed "lu_occlude --selftest  9 passed, 0 failed", which that regex cannot
  // see, so the gate would have registered green while measuring nothing.
  console.log(`\n${pass} passed, ${fail} failed`);
  process.exit(fail ? 1 : 0);
}

if (has('--selftest')) selftest();

async function readFrame(browser, vp, { save = null, knownBad = false, clockBad = false, tag = '' } = {}) {
  const context = await browser.newContext({
    viewport: { width: vp.width, height: vp.height }, hasTouch: true, isMobile: true, deviceScaleFactor: 1,
  });
  const page = await context.newPage();
  const errs = [];
  page.on('pageerror', (e) => errs.push(String(e)));
  // A mid-lane station with the sim effectively frozen and the ring parked off the map —
  // the same setup `hud_hue` and `arena-scan` use, so the frame is comparable to theirs.
  await page.goto(`${BASE}/?player=hamburger&enemy=donut&px=340&py=500&fogRadius=850&simSpeed=0.02&pointerLock=0`,
    { waitUntil: 'domcontentloaded', timeout: 90_000 });
  await page.waitForFunction('window.__gameReady === true', null, { timeout: 120_000 });
  await page.waitForFunction(() => window.__matchDebug?.phase === 'playing', null, { timeout: 120_000 });
  // ⚠️ BOTH FLAGS, AND ON PURPOSE. `fa-touch-capable` is set by the module itself on a
  // coarse pointer, but `fa-touch` waits for a REAL finger — and a landscape phone
  // player has always already touched the glass by the time they can see the tray, so
  // the layout to measure is the one AFTER first touch. Forcing it here rather than
  // dispatching a touch keeps this frame free of a planted stick, which would otherwise
  // paint a 156 px ring over the very region being measured.
  await page.evaluate(() => document.documentElement.classList.add('fa-touch-capable', 'fa-touch'));
  await sleep(600);
  if (knownBad) {
    // ── The known-bad input (`CLAUDE.md` §6) ────────────────────────────────
    // The PRE-PASS geometry, reinstated as an inline style: one row, bottom-centre.
    // If the shipped tray does not score BETTER than this, the instrument is not reading
    // the rule that moved and every number above it is decoration.
    await page.evaluate(() => {
      const el = document.querySelector('.hud-weapons');
      if (!el) return;
      el.setAttribute('style', 'position:absolute;left:50%;right:auto;top:auto;bottom:18px;'
        + 'transform:translateX(-50%);display:flex;flex-direction:row;flex-wrap:nowrap;gap:10px;width:auto;height:auto;');
    });
    await sleep(250);
  }
  if (clockBad) {
    // ── The SECOND known-bad, for the clock column (`CLAUDE.md` §6) ──────────
    //
    // 🚨 THE FIRST VERSION OF THIS FAILED ITS OWN TEST AND THE FAILURE IS THE LESSON.
    // It restated the DESKTOP plate (196px, 22px timer) as inline styles and called
    // that the known-bad — but on the tree it was measuring, the desktop plate WAS
    // what shipped at 844 and 932, so the arm reproduced the shipped layout and came
    // back "NOT WORSE" at two of three viewports. A known-bad has to be the state the
    // change LEAVES, not a state guessed at; and because the pre-change layout came
    // from a max-width:720px block, that state is DIFFERENT at 667 than at 844/932.
    // Restated below as exactly that: undo the landscape rule, and let the width
    // decide which of the two pre-change layouts is restored. (`CLAUDE.md` §6 —
    // "a guard that has not been shown to FAIL on the bug it guards against is not a
    // guard", and this one had to be shown to fail before it was one.)
    //
    // ⚠️ IT RESTORES THE GEOMETRY, NOT THE POSITION. `h49_chips` asserts the clock is
    // centred to within 2px above two seats, so a known-bad that moved it sideways
    // would be testing a change nobody is allowed to make.
    await page.evaluate(() => {
      const narrow = window.innerWidth <= 720;   // the max-width:720px block
      const set = (sel, css) => { const e = document.querySelector(sel); if (e) e.setAttribute('style', css); };
      set('.hud-topbar', 'top: calc(var(--fa-safe-t, 0px) + 14px);');
      set('.hud-clock', 'flex-direction: column; align-items: center; gap: 5px;');
      set('.hud-timer', narrow ? 'font-size:16px;padding:4px 12px;' : 'font-size:22px;padding:6px 16px;');
      set('.hud-zone', narrow ? 'width:156px;padding:3px 7px 5px;' : 'width:196px;padding:4px 8px 6px;');
      const danger = document.querySelector('.hud-zone')?.classList.contains('is-danger');
      set('.hud-zone-label', narrow
        ? `font-size:${danger ? 10 : 9}px;letter-spacing:0.08em;`
        : `font-size:${danger ? 11 : 9.5}px;letter-spacing:0.1em;`);
      set('.hud-zone-value', narrow ? 'font-size:12.5px;' : 'font-size:15px;');
    });
    await sleep(250);
  }
  const out = await page.evaluate((groups) => {
    const res = {};
    for (const g of groups) {
      const rects = [];
      for (const sel of g.sel) {
        for (const el of document.querySelectorAll(sel)) {
          const r = el.getBoundingClientRect();
          if (r.width > 0 && r.height > 0) rects.push({ x: r.x, y: r.y, width: r.width, height: r.height });
        }
      }
      res[g.name] = rects;
    }
    res.__capable = document.documentElement.classList.contains('fa-touch-capable');
    res.__touch = document.documentElement.classList.contains('fa-touch');
    return res;
  }, CONTROLS);
  const disc = await page.evaluate(`(${DISC_FN})()`);
  if (!disc) throw new Error(`lu_occlude: the fair-disc probe returned null at ${vp.tag}`);
  const suffix = `${tag}${knownBad ? '-knownbad' : ''}${clockBad ? '-clockbad' : ''}`;
  if (save) {
    await mkdir(save, { recursive: true });
    await page.screenshot({ path: `${save}/${vp.tag}${suffix}.png` });
    if (MAP) {
      // Invoked the same way `DISC_FN` is — an explicit call inside the evaluated
      // string — so there is no dependence on how Playwright treats a string that
      // happens to resolve to a function. `area` is rounded to 2dp purely to keep the
      // payload small; the map is a picture, and nothing is scored off it.
      const palette = ['#FF3B30', '#00E5FF', '#FFD400', '#7CFF4F', '#FF8AF0', '#FFFFFF', '#9AA0FF'];
      const payload = JSON.stringify({
        cell: disc.cell, cw: disc.cw, ch: disc.ch, vw: disc.vw, vh: disc.vh,
        area: disc.area.map((v) => Math.round(v * 100) / 100), inDisc: disc.inDisc,
      });
      const groups = JSON.stringify(CONTROLS
        .map((g, i) => ({ name: g.name, color: palette[i % palette.length], rects: out[g.name] ?? [] }))
        .filter((g) => g.rects.length));
      await page.evaluate(`(${MAP_FN})(${payload}, ${groups})`);
      await sleep(120);
      await page.screenshot({ path: `${save}/${vp.tag}${suffix}-map.png` });
    }
  }
  await context.close();
  return { rects: out, disc, errs };
}

const pct = (n, d) => (d > 0 ? (100 * n / d) : 0);

async function main() {
  const browser = await chromium.launch({ args: LAUNCH_ARGS });
  const summary = [];
  console.log(`[lu_occlude] tree = ${process.env.HEADSERVE_SHA || '(worktree)'}`
    + `${process.env.HEADSERVE_OVERLAY ? ` + overlay ${process.env.HEADSERVE_OVERLAY}` : ''}`);
  console.log('');

  for (const vp of VIEWPORTS) {
    const { rects, disc, errs } = await readFrame(browser, vp, { save: SAVE });
    if (errs.length) console.log(`  ⚠️ page errors: ${errs.slice(0, 3).join(' | ')}`);
    // The guarantee is a DISC of 199.2 wu, so its area is pi*R^2 = 124,660 wu^2 if the
    // whole of it is on screen. Printing the ratio is the instrument checking the
    // camera's own promise rather than assuming it — `aspect.mjs` owns that assertion,
    // this just refuses to divide by a denominator it has not looked at.
    const ideal = Math.PI * 199.2 * 199.2;
    console.log(`── ${vp.tag}  ${vp.width}x${vp.height}   fa-touch=${rects.__touch}   `
      + `fair disc on screen: ${Math.round(disc.discArea).toLocaleString()} of ${Math.round(ideal).toLocaleString()} wu² `
      + `(${pct(disc.discArea, ideal).toFixed(1)}%) ────`);
    console.log('   control        rects  screen px            hides wu²      % of the guaranteed view');
    const all = [];
    const score = {};
    for (const g of CONTROLS) {
      const rs = rects[g.name] ?? [];
      if (!rs.length) { console.log(`   ${g.name.padEnd(14)} (absent)`); continue; }
      // ⚠️ A LAYOUT BOX IS EXCLUDED FROM THE UNION, NOT FROM THE TABLE. `clock + zone`
      // is `.hud-clock`'s rect and it CONTAINS `clock INK`, so adding both to `all`
      // would let the container's empty gap into the "every control together" row —
      // the exact overcount this file's header records for `.hud-topbar`.
      if (!BOX_ROWS.has(g.name)) all.push(...rs);
      const d = discUnder(disc, rs);
      score[g.name] = pct(d.wu2, disc.discArea);
      const px = rs.reduce((s, r) => s + r.width * r.height, 0);
      console.log(`   ${g.name.padEnd(14)} ${String(rs.length).padStart(5)}  ${String(Math.round(px)).padStart(7)} px  `
        + `${' '.repeat(6)}${String(Math.round(d.wu2)).padStart(8)}      ${pct(d.wu2, disc.discArea).toFixed(2).padStart(6)}%`
        + (BOX_ROWS.has(g.name) ? '   ← layout box, not ink; excluded from the union' : ''));
    }
    const u = discUnder(disc, all);
    console.log(`   ${'ALL (union)'.padEnd(14)} ${String(all.length).padStart(5)}  ${' '.repeat(10)}  `
      + `${' '.repeat(6)}${String(Math.round(u.wu2)).padStart(8)}      ${pct(u.wu2, disc.discArea).toFixed(2).padStart(6)}%`);
    if (score['clock + zone'] != null && score['clock INK'] != null) {
      console.log(`   clock box − ink = ${(score['clock + zone'] - score['clock INK']).toFixed(2)} pp `
        + '— the wedge either side of the timer pill that the world shows straight through');
    }
    console.log(`   the disc's TOP ARC is at y = ${disc.discTopY}px (${pct(disc.discTopY, disc.vh).toFixed(1)}% down the frame) `
      + '— everything above that line is ground the guarantee does not cover, and is free');
    console.log('   band profile (top → bottom of the frame): share of the disc, and wu² per screen px');
    for (const b of bandProfile(disc)) {
      const share = pct(b.wu2, disc.discArea);
      console.log(`     y ${String(b.y0).padStart(4)}–${String(b.y1).padStart(4)}  `
        + `${share.toFixed(2).padStart(6)}%  ${b.perPx.toFixed(3).padStart(7)} wu²/px  `
        + '█'.repeat(Math.round(share * 1.5)));
    }
    const tray = discUnder(disc, rects['weapon tray'] ?? []);
    console.log('');
    summary.push({
      tag: vp.tag, tray: pct(tray.wu2, disc.discArea), all: pct(u.wu2, disc.discArea),
      clockBox: score['clock + zone'] ?? 0, clockInk: score['clock INK'] ?? 0, disc,
    });
  }

  if (has('--known-bad')) {
    console.log('── KNOWN-BAD ARM: the tray forced back to one row, bottom-centre ────');
    for (const vp of VIEWPORTS) {
      const { rects, disc } = await readFrame(browser, vp, { save: SAVE, knownBad: true });
      const d = discUnder(disc, rects['weapon tray'] ?? []);
      const bad = pct(d.wu2, disc.discArea);
      const s = summary.find((x) => x.tag === vp.tag);
      const worse = bad > (s?.tray ?? 0) + 1e-9;
      console.log(`   ${vp.tag}  forced bottom-centre hides ${bad.toFixed(2)}% of the guaranteed view, `
        + `shipped hides ${s ? s.tray.toFixed(2) : '?'}%   ${worse ? 'KNOWN-BAD IS WORSE ✓' : 'NOT WORSE ✗ — the instrument is not reading the rule that moved'}`);
      if (!worse) process.exitCode = 1;
    }
    console.log('');
  }

  if (has('--known-bad-clock')) {
    console.log('── KNOWN-BAD ARM: the clock column forced back to its full-size plate ────');
    for (const vp of VIEWPORTS) {
      const { rects, disc } = await readFrame(browser, vp, { save: SAVE, clockBad: true });
      const d = discUnder(disc, rects['clock INK'] ?? []);
      const bad = pct(d.wu2, disc.discArea);
      const s = summary.find((x) => x.tag === vp.tag);
      const worse = bad > (s?.clockInk ?? 0) + 1e-9;
      console.log(`   ${vp.tag}  the full-size plate hides ${bad.toFixed(2)}% of the guaranteed view, `
        + `shipped hides ${s ? s.clockInk.toFixed(2) : '?'}%   ${worse ? 'KNOWN-BAD IS WORSE ✓' : 'NOT WORSE ✗ — the instrument is not reading the rule that moved'}`);
      if (!worse) process.exitCode = 1;
    }
    console.log('');
  }

  console.log('HEADLINE — share of the 199.2 wu guaranteed-visible arena hidden by a control');
  for (const s of summary) {
    console.log(`  ${s.tag}: weapon tray ${s.tray.toFixed(2)}%   ·   clock ink ${s.clockInk.toFixed(2)}% `
      + `(box ${s.clockBox.toFixed(2)}%)   ·   every control together ${s.all.toFixed(2)}%`);
  }
  await browser.close();
}

await main();
