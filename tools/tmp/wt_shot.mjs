#!/usr/bin/env node
/**
 * WT_SHOT — one arena frame framed on a PUDDLE, at a chosen camera pitch.
 *
 * ## Why this exists rather than an existing shot tool
 *
 * The puddles live at `kitchen.ts`'s `puddleSouth` / `puddleNorth`, which are 559 wu
 * out from centre — nothing in `shots/q1` or `arena-scan`'s battery frames one large
 * enough to judge a SILHOUETTE on. `preview.html?piece=arena&tx&ty` re-targets the
 * camera anywhere on the map at SHIPPED framing (`SHIPPED_SPAN`, 578 wu of ground),
 * and `?pitch=` reaches both of this project's two shipped angles:
 *
 *   58  `src/render/camera.ts`, `opts.pitchDeg ?? 58` — the MATCH camera.
 *   20  `src/ui/screens/charStage.ts`, `pitchDeg: 20` — the LOBBY camera. The lobby
 *       never shows the arena, but CLAUDE.md #3 is not about which screen: a shallow
 *       look is the better DETECTOR for a ground-plane defect, because 58 deg
 *       foreshortens a horizontal shape by sin(58) and hides its outline.
 *
 * ## `?t=` IS THE FREEZE, AND IT IS WHY THIS IS REPRODUCIBLE
 *
 * `src/preview.ts` advances animation in fixed 1/120 sub-steps to exactly `t`, then
 * renders with dt = 0 — so two loads of one URL are pixel-identical. The puddle's own
 * animation clock reads the same `?t=` (see `hazards.ts`, `puddleSeconds`), so a
 * moving puddle does NOT cost this tool its determinism. `--drift` proves it: two
 * independent page loads of the same URL, differing pixels must be EXACTLY ZERO.
 *
 * ## SUBJECT-IN-SHOT, because a rig that is reachable is not a subject that is framed
 *
 * `docs/AGENT-BRIEF.md` §6 / CLAUDE.md #6: an instrument here once photographed the
 * SKY and reported PASS, because it asserted the rig was up and never that the thing
 * it meant to measure was in the picture. So every capture classifies the centre box
 * by hue and refuses if the puddle is not there:
 *
 *   MOVES     the same box at a bare-floor control station must come back ~0, and the
 *             puddle station at least 20x it. Printed on every run, not just selftest.
 *   NON-EMPTY the classified set is asserted non-empty BEFORE any ratio is taken —
 *             `[].every()` is true and `0/0` is NaN, and both read as a pass.
 *
 * `--selftest` additionally exercises the classifier itself on planted pixels and
 * needs no browser.
 *
 * ## Use
 *
 *   node tools/tmp/wt_shot.mjs --selftest
 *   node tools/tmp/sx_snap.mjs --root /tmp/fa-wt-puddle -- \
 *     node tools/tmp/wt_shot.mjs --url '{URL}' --out tools/tmp/wt_before --tag before
 */
import { chromium } from 'playwright';
import { mkdir, writeFile } from 'node:fs/promises';
import { realpathSync } from 'node:fs';
import { fileURLToPath } from 'node:url';
import sharp from 'sharp';
import { frameStats, FRAME_FLOOR } from './settle.mjs';
import { readFileSync } from 'node:fs';

/** Decode to a flat RGBA raster. `sharp` is the only image dep this repo carries. */
async function raster(buf) {
  const { data, info } = await sharp(buf).ensureAlpha().raw().toBuffer({ resolveWithObject: true });
  return { data, width: info.width, height: info.height, channels: info.channels };
}

const argv = process.argv.slice(2);
const arg = (k, d = null) => { const i = argv.indexOf('--' + k); return i >= 0 ? argv[i + 1] : d; };
const has = (k) => argv.includes('--' + k);

// ── Stations. DERIVED, never retyped: `al_guard` records that the 1x playfield is
// exactly the NW quadrant of the x4 one, so a stale coordinate is still a LEGAL one
// and no legality check can see it. ARENA_W / ARENA_H and the puddle centres are read
// out of the source that owns them.
function stationsFromSource(repo) {
  const shared = readFileSync(`${repo}/src/arena/shared.ts`, 'utf8');
  const kitchen = readFileSync(`${repo}/src/arena/kitchen.ts`, 'utf8');
  const num = (src, re, what) => {
    const m = src.match(re);
    if (!m) throw new Error(`wt_shot: could not read ${what} from source — the extractor is stale`);
    return Number(m[1]);
  };
  const W = num(shared, /export const ARENA_W\s*=\s*([\d.]+)/, 'ARENA_W');
  const H = num(shared, /export const ARENA_H\s*=\s*([\d.]+)/, 'ARENA_H');
  const sx = num(kitchen, /const puddleSouth = \{ x: ([\d.]+),/, 'puddleSouth.x');
  const sy = num(kitchen, /const puddleSouth = \{ x: [\d.]+, y: ([\d.]+),/, 'puddleSouth.y');
  const sr = num(kitchen, /const puddleSouth = \{ x: [\d.]+, y: [\d.]+, radius: ([\d.]+)/, 'puddleSouth.radius');
  return {
    grease: { x: sx, y: sy, radius: sr, hue: [22, 62], name: 'grease puddle (south)' },
    water: { x: W - sx, y: H - sy, radius: sr, hue: [178, 224], name: 'water puddle (north)' },
    // The CONTROL. Open floor, no puddle, no hazard — the known-bad this tool's
    // "subject is in shot" claim is measured against.
    control: { x: 700, y: 500, radius: sr, hue: [22, 62], name: 'bare floor CONTROL' },
  };
}

/** sRGB byte triple -> HSV, h in degrees. */
export function rgbToHsv(r, g, b) {
  const R = r / 255, G = g / 255, B = b / 255;
  const mx = Math.max(R, G, B), mn = Math.min(R, G, B), d = mx - mn;
  let h = 0;
  if (d > 1e-6) {
    if (mx === R) h = 60 * (((G - B) / d) % 6);
    else if (mx === G) h = 60 * ((B - R) / d + 2);
    else h = 60 * ((R - G) / d + 4);
  }
  if (h < 0) h += 360;
  return { h, s: mx <= 1e-6 ? 0 : d / mx, v: mx };
}

/**
 * Fraction of the centre box whose hue lands inside `[lo,hi]` at real saturation.
 * The box is centred because `mountArena` does `stage.rig.snapTo(tx, tz)` — the
 * station IS the frame centre by construction. Returned as a fraction so viewport
 * changes cannot silently move the number.
 */
export function centreHueFraction(png, hue, box = 0.42, satFloor = 0.24, valFloor = 0.14) {
  const w = png.width, h = png.height, ch = png.channels ?? 4;
  const x0 = Math.round(w * (0.5 - box / 2)), x1 = Math.round(w * (0.5 + box / 2));
  const y0 = Math.round(h * (0.5 - box / 2)), y1 = Math.round(h * (0.5 + box / 2));
  let hit = 0, total = 0;
  for (let y = y0; y < y1; y++) {
    for (let x = x0; x < x1; x++) {
      const i = (y * w + x) * ch;
      const { h: hh, s, v } = rgbToHsv(png.data[i], png.data[i + 1], png.data[i + 2]);
      total++;
      if (s >= satFloor && v >= valFloor && hh >= hue[0] && hh <= hue[1]) hit++;
    }
  }
  // NON-EMPTY FIRST. `0/0` is NaN and NaN fails every comparison silently.
  if (total === 0) throw new Error('wt_shot: centre box is empty — the classifier ran over nothing');
  return { fraction: hit / total, hit, total };
}

const LAUNCH_ARGS = ['--use-gl=angle', '--use-angle=swiftshader', '--enable-unsafe-swiftshader',
  '--enable-webgl', '--ignore-gpu-blocklist', '--disable-gpu-sandbox'];

/**
 * ⚠️ `frameMode: 'ground'` frames `viewWidthUnits / sin(pitch)`, NOT `viewWidthUnits`
 * (`src/preview.ts`'s SHIPPED_SPAN note records an 18% error from getting this wrong).
 * So a ground span held constant across a pitch ladder needs `span * sin(pitch)` — and
 * without that, `piece=arena` at pitch 20 frames 1433 wu instead of 578 and the puddle
 * is 30 px across. Measured, not reasoned about: the first run of this tool at p20
 * returned 27.85% warm-hue on the BARE FLOOR CONTROL, because the frame was mostly sky
 * and props. `mountArena` has no zoom parameter, so the rig is driven page-side.
 */
async function shoot(page, base, st, pitch, t, outPath, chars, span) {
  const q = new URLSearchParams({
    piece: 'arena', tx: String(st.x), ty: String(st.y),
    pitch: String(pitch), t: String(t), chars: chars ? '1' : '0', shot: '1',
  });
  await page.goto(`${base}/preview.html?${q}`, { waitUntil: 'networkidle', timeout: 120_000 });
  await page.waitForFunction('window.__previewReady === true', null, { timeout: 120_000 });
  const applied = await page.evaluate(({ span, pitch }) => {
    const s = window.__stage;
    if (!s || !s.rig) return null;
    s.rig.viewWidthUnits = span * Math.sin((pitch * Math.PI) / 180);
    s.rig.apply();
    // The preview's `?t=` path renders three times and stops; a rig change after that
    // needs its own draws. Post FX (SMAA/bloom) want a couple of settled frames.
    s.render(0); s.render(0); s.render(0);
    return s.rig.viewWidthUnits;
  }, { span, pitch });
  if (applied === null) throw new Error('wt_shot: window.__stage.rig not reachable — the rig override did not run');
  await page.waitForTimeout(150);
  await mkdir(outPath.replace(/\/[^/]*$/, ''), { recursive: true });
  const buf = await page.locator('canvas').first().screenshot({ timeout: 120_000 });
  await writeFile(outPath, buf);
  // ── THE CAPTURE SIDECAR `tools/review.mjs` REFUSES A PACKET WITHOUT ────────
  // Written from evidence, not from optimism: `painted` is the AND of three things
  // this function actually observed — the preview declared itself ready, the rig
  // override ran (it throws otherwise), and the frame clears `settle.mjs`'s flat-frame
  // floor. A sidecar that says `painted: true` unconditionally is worse than no
  // sidecar, because `--allow-unverified` at least tells the reader nothing is known.
  const fs = await frameStats(buf);
  await writeFile(`${outPath}.capture.json`, JSON.stringify({
    tool: 'tools/tmp/wt_shot.mjs',
    url: `${base}/preview.html?${q}`,
    painted: fs.stdev >= FRAME_FLOOR,
    why: fs.stdev >= FRAME_FLOOR ? [] : [`frame is FLAT: max-channel stdev ${fs.stdev} < ${FRAME_FLOOR}`],
    previewReady: true,
    viewWidthUnits: applied,
    pitchDeg: pitch,
    frozenT: t,
    stats: fs,
    at: new Date().toISOString(),
  }, null, 2));
  return raster(buf);
}

async function selftest() {
  let fails = 0;
  const ok = (name, cond, extra = '') => { console.log(`${cond ? 'PASS' : 'FAIL'}  ${name} ${extra}`); if (!cond) fails++; };

  // §A  the hue conversion, against values a human can check
  const g = rgbToHsv(0xB0, 0x80, 0x2C);   // KPAL.grease
  const w = rgbToHsv(0x3F, 0x86, 0xA8);   // KPAL.water
  const tile = rgbToHsv(0x78, 0x58, 0x64); // KPAL.tileLight
  ok('A1 grease hue in the grease window', g.h > 22 && g.h < 62, `h=${g.h.toFixed(1)}`);
  ok('A2 water hue in the water window', w.h > 178 && w.h < 224, `h=${w.h.toFixed(1)}`);
  ok('A3 floor tile is in NEITHER window', !(tile.h > 22 && tile.h < 62) && !(tile.h > 178 && tile.h < 224), `h=${tile.h.toFixed(1)}`);
  // ⚠️ This arm ORIGINALLY read "floor tile is BELOW the saturation floor" and it was
  // FALSE — `KPAL.tileLight` sits at s = 0.267, ABOVE the 0.24 floor. The tile is
  // excluded by HUE (A3), never by saturation, and asserting the wrong mechanism would
  // have left the saturation floor untested. Kept per the reversal rule. What the
  // saturation floor actually buys is the desaturated warm greys — shadowed floor,
  // scorch, wood — which land INSIDE the grease hue window and must still be rejected.
  const warmGrey = rgbToHsv(0x6B, 0x60, 0x55);
  ok('A4 a desaturated warm grey is IN the grease hue window', warmGrey.h > 22 && warmGrey.h < 62, `h=${warmGrey.h.toFixed(1)}`);
  ok('A5 ...and the SATURATION floor is what rejects it', warmGrey.s < 0.24 && tile.s > 0.24,
    `grey s=${warmGrey.s.toFixed(3)}  tile s=${tile.s.toFixed(3)}`);

  // §B  MOVES / HOLDS on planted images — a classifier that always answers the same
  //     thing passes A and fails here.
  const plant = (rgb) => {
    const data = Buffer.alloc(40 * 40 * 4);
    for (let i = 0; i < 40 * 40; i++) {
      data[i * 4] = rgb[0]; data[i * 4 + 1] = rgb[1]; data[i * 4 + 2] = rgb[2]; data[i * 4 + 3] = 255;
    }
    return { data, width: 40, height: 40, channels: 4 };
  };
  const win = [22, 62];
  const hot = centreHueFraction(plant([0xB0, 0x80, 0x2C]), win);
  const cold = centreHueFraction(plant([0x78, 0x58, 0x64]), win);
  ok('B1 MOVES  a grease-filled frame classifies ~1.0', hot.fraction > 0.99, `f=${hot.fraction.toFixed(4)}`);
  ok('B2 HOLDS  a tile-filled frame classifies ~0.0', cold.fraction < 0.01, `f=${cold.fraction.toFixed(4)}`);
  ok('B3 NON-EMPTY guard fires on a zero-area box', (() => {
    try { centreHueFraction({ data: Buffer.alloc(0), width: 0, height: 0, channels: 4 }, win); return false; } catch { return true; }
  })(), '');

  // §C  the extractor. A station table typed from memory is the `al_guard` class of
  //     bug; assert the source really was parsed and lands on the x4 map.
  const st = stationsFromSource(process.cwd());
  ok('C1 puddle centres parsed from source', st.grease.x > 0 && st.water.x > 0, `S=${st.grease.x},${st.grease.y}  N=${st.water.x},${st.water.y}`);
  ok('C2 the pair is point-symmetric about the arena centre', Math.abs((st.grease.x + st.water.x) / 2 - 1400) < 1e-6, '');
  ok('C3 neither centre is a 1x-map literal', st.grease.x > 1400 || st.grease.y > 1000, '');

  console.log(fails === 0 ? '\nwt_shot selftest: ALL PASS' : `\nwt_shot selftest: ${fails} FAIL`);
  process.exit(fails === 0 ? 0 : 1);
}

// 🚨 IS-MAIN GUARD (AGENT-BRIEF §3): three tools here launched Chromium on import.
// ⚠️ AND THE GUARD ITSELF THREW ON A LEGITIMATE IMPORT. `node -e "import(...)"` has no
// `process.argv[1]`, so `realpathSync(undefined)` raised
// `ENOENT: lstat '<cwd>/undefined'` — a tool that cannot be imported from a scratch
// one-liner, reported as a missing file in the repo root. Wrapped rather than
// rearranged: the guard's ANSWER is unchanged, it just no longer throws when asked.
const isMain = (() => {
  try { return realpathSync(process.argv[1] ?? '') === realpathSync(fileURLToPath(import.meta.url)); }
  catch { return false; }
})();
if (isMain) {
  if (has('selftest')) await selftest();

  const BASE = (arg('url') ?? process.env.PREVIEW_BASE ?? '').replace(/\/$/, '');
  if (!BASE) { console.error('wt_shot: need --url or PREVIEW_BASE'); process.exit(2); }
  if (/:5173(\/|$)/.test(BASE)) { console.error('wt_shot: --url is the SHARED dev server. Never measure there.'); process.exit(2); }
  const OUT = arg('out', 'tools/tmp/wt_shots');
  const TAG = arg('tag', 'shot');
  const T = Number(arg('t', '6.5'));
  const PITCHES = (arg('pitches') ?? '58,20').split(',').map(Number);
  // Ground span in WORLD UNITS, held constant across the pitch ladder so the two
  // cameras show the SAME ground and only the angle differs. 578 is shipped match
  // framing (`preview.ts` SHIPPED_SPAN); 260 puts the 100 wu puddle across 38% of the
  // frame, which is the "diagnose UP CLOSE" half of CLAUDE.md #3.
  const SPAN = Number(arg('span', '260'));
  const CHARS = has('chars');
  const DRIFT = has('drift');

  const repo = arg('repo', process.cwd());
  const ST = stationsFromSource(repo);

  const browser = await chromium.launch({ args: LAUNCH_ARGS });
  const page = await browser.newPage({ viewport: { width: 1300, height: 740 }, deviceScaleFactor: 1 });
  page.on('pageerror', (e) => console.error('PAGEERROR', String(e)));
  // A fresh snapshot's FIRST client eats a dep-optimisation reload that presents as
  // "execution context was destroyed" (AGENT-BRIEF §3). Warm it cheaply.
  await page.goto(`${BASE}/preview.html?piece=arena&chars=0&t=0.1`, { waitUntil: 'networkidle', timeout: 120_000 }).catch(() => {});

  const rows = [];
  for (const pitch of PITCHES) {
    for (const key of ['grease', 'water', 'control']) {
      const st = ST[key];
      const path = `${OUT}/${TAG}_${key}_p${pitch}.png`;
      const png = await shoot(page, BASE, st, pitch, T, path, CHARS, SPAN);
      const cls = centreHueFraction(png, st.hue);
      rows.push({ tag: TAG, pitch, span: SPAN, station: key, path, fraction: +cls.fraction.toFixed(5), hit: cls.hit, total: cls.total });
      console.log(`${TAG} p${pitch} ${key.padEnd(8)} centre-hue ${(cls.fraction * 100).toFixed(2)}%  ${path}`);
    }
  }

  // SUBJECT-IN-SHOT, asserted rather than assumed.
  let refused = 0;
  for (const pitch of PITCHES) {
    const ctrl = rows.find((r) => r.pitch === pitch && r.station === 'control').fraction;
    for (const key of ['grease', 'water']) {
      const f = rows.find((r) => r.pitch === pitch && r.station === key).fraction;
      // ⚠️ THE 20x RATIO IS CALIBRATED AT ONE FRAMING AND IT SILENTLY WAS NOT SAID.
      // The pool covers a fixed patch of GROUND, so its share of the centre box falls
      // with the square of the ground span: at the shipped 578 wu framing it is
      // (260/578)^2 = 0.202 of what it is at this tool's default 260, and the guard
      // REFUSED a frame with the pool plainly centred in it (water 21.80% against a
      // 1.463% control — 14.9x, under a flat 20x bar). The threshold is now scaled by
      // the same geometry, so the guard means the same thing at every framing instead
      // of being quietly wrong away from one. The ABSOLUTE floor is untouched, and at
      // span 260 the requirement is still exactly 20x.
      const need = 20 * Math.pow(260 / SPAN, 2);
      const pass = f > 0.02 && f > need * Math.max(ctrl, 1e-5);
      console.log(`  subject-in-shot p${pitch} ${key}: ${(f * 100).toFixed(2)}% vs control ${(ctrl * 100).toFixed(3)}%  (needs ${need.toFixed(1)}x at span ${SPAN})  ${pass ? 'OK' : 'REFUSED'}`);
      if (!pass) refused++;
    }
  }

  if (DRIFT) {
    // Rule 4's drift control — and it is run REPEATEDLY on purpose.
    //
    // 🚨 A SINGLE ZERO IS NOT A FLOOR. The first three pairs this tool took came back
    // at exactly 0 differing pixels and that number went into a commit message as if
    // it were a property of the capture path. The fourth came back at 20 px, in a 5x4
    // box at the TOP of the frame, 300 px from the pool — an ambient element the
    // preview's `?t=` freeze does not reach. So the honest report is a DISTRIBUTION
    // over n pairs plus the number that actually governs an A/B on this subject: the
    // same diff restricted to the centre box the classifier already uses.
    const reps = Number(arg('drift-reps', '4'));
    const full = [], subj = [], pool = [], flipped = [], poolClean = [];
    for (let i = 0; i < reps; i++) {
      const a = await shoot(page, BASE, ST.water, 58, T, `${OUT}/${TAG}_drift_a.png`, CHARS, SPAN);
      const p2 = await browser.newPage({ viewport: { width: 1300, height: 740 }, deviceScaleFactor: 1 });
      const b = await shoot(p2, BASE, ST.water, 58, T, `${OUT}/${TAG}_drift_b.png`, CHARS, SPAN);
      await p2.close();
      const ch = a.channels, w = a.width, h = a.height;
      const bx0 = Math.round(w * 0.29), bx1 = Math.round(w * 0.71);
      const by0 = Math.round(h * 0.29), by1 = Math.round(h * 0.71);
      // THREE numbers, because the first two answered the wrong question. A whole-frame
      // count is dominated by ambient debris the freeze does not reach (a warm speck
      // that exists in one load and not the other — cropped and LOOKED AT, it is a
      // floating particle, not the pool). What an A/B on this subject needs is whether
      // THE POOL'S OWN PIXELS moved, so the third arm diffs only pixels the classifier
      // calls water in BOTH frames, and reports the classification flips separately so
      // the exclusion is visible rather than quietly generous.
      let d = 0, ds = 0, dp = 0, flips = 0;
      const flipPts = [];
      const diffPts = [];
      const isPool = (buf, i) => {
        const { h: hh, s: ss, v } = rgbToHsv(buf[i], buf[i + 1], buf[i + 2]);
        return ss >= 0.24 && v >= 0.14 && hh >= ST.water.hue[0] && hh <= ST.water.hue[1];
      };
      for (let y = 0; y < h; y++) {
        for (let x = 0; x < w; x++) {
          const i = (y * w + x) * ch;
          const inA = isPool(a.data, i), inB = isPool(b.data, i);
          if (inA !== inB) { flips++; flipPts.push(x, y); }
          if (a.data[i] !== b.data[i] || a.data[i + 1] !== b.data[i + 1] || a.data[i + 2] !== b.data[i + 2]) {
            d++;
            if (x >= bx0 && x < bx1 && y >= by0 && y < by1) ds++;
            if (inA && inB) { dp++; diffPts.push(x, y); }
          }
        }
      }
      // A pixel next to something that moved IN FRONT of the pool is that object's
      // antialiased fringe, not the pool's own surface. Excluded within 4 px and
      // reported separately, so the exclusion is a stated policy and not a fudge: if
      // the pool itself ever moves, `poolClean` is nowhere near a flip and stays red.
      let clean = 0;
      for (let k = 0; k < diffPts.length; k += 2) {
        let near = false;
        for (let j = 0; j < flipPts.length && !near; j += 2) {
          if (Math.abs(diffPts[k] - flipPts[j]) <= 4 && Math.abs(diffPts[k + 1] - flipPts[j + 1]) <= 4) near = true;
        }
        if (!near) clean++;
      }
      full.push(d); subj.push(ds); pool.push(dp); flipped.push(flips); poolClean.push(clean);
    }
    console.log(`  DRIFT CONTROL ${reps} independent pairs, water p58, full frame: [${full.join(', ')}] px of ${1300 * 740}`);
    console.log(`  DRIFT CONTROL ${reps} pairs, SUBJECT window (the centre box): [${subj.join(', ')}] px  ${subj.every((v) => v === 0) ? 'EXACTLY ZERO on the subject' : 'NON-ZERO ON THE SUBJECT — this capture cannot carry an A/B'}`);
    console.log(`  DRIFT CONTROL ${reps} pairs, THE POOL'S OWN PIXELS: [${pool.join(', ')}] px  ${pool.every((v) => v === 0) ? 'EXACTLY ZERO — the puddle is frozen' : 'NON-ZERO — the puddle animation is not reproducible'}`);
    console.log(`     (pixels that changed CLASSIFICATION, i.e. something moved in front of the pool: [${flipped.join(', ')}])`);
    console.log(`  DRIFT CONTROL ${reps} pairs, POOL PIXELS >4 px FROM ANY SUCH OCCLUDER: [${poolClean.join(', ')}] px  ${poolClean.every((v) => v === 0) ? 'EXACTLY ZERO — the puddle surface itself is frozen' : 'NON-ZERO — the puddle animation is not reproducible'}`);
    rows.push({ tag: TAG, driftFull: full, driftSubject: subj, driftPool: pool, driftPoolClean: poolClean, classFlips: flipped, of: 1300 * 740 });
  }

  if (has('clock')) {
    // 🚨 THE ARM THAT ACTUALLY SETTLES IT. "Five of six pairs came back zero" is not
    // proof a clock is frozen — it is consistent with a clock that is frozen AND with
    // one that is live but sampled at nearly the same instant. So: MOVES and HOLDS.
    //
    //   HOLDS  two loads at the SAME `?t=` must be ~0 on the pool's own pixels.
    //   MOVES  two loads at DIFFERENT `?t=` must be LARGE on the same pixels.
    //
    // If `puddleSeconds()` ever stops honouring `?t=` and falls back to
    // `performance.now()`, HOLDS goes large. If the animation is dead — a uniform that
    // never reaches the shader, which is the failure this repo calls "rendering and
    // INVISIBLE" — MOVES goes to zero. One arm cannot fail for the other's reason.
    const poolPx = (a, b) => {
      const ch = a.channels; let n = 0;
      for (let i = 0; i < a.data.length; i += ch) {
        const A = rgbToHsv(a.data[i], a.data[i + 1], a.data[i + 2]);
        const B = rgbToHsv(b.data[i], b.data[i + 1], b.data[i + 2]);
        const inA = A.s >= 0.24 && A.v >= 0.14 && A.h >= ST.water.hue[0] && A.h <= ST.water.hue[1];
        const inB = B.s >= 0.24 && B.v >= 0.14 && B.h >= ST.water.hue[0] && B.h <= ST.water.hue[1];
        if (inA && inB && (a.data[i] !== b.data[i] || a.data[i + 1] !== b.data[i + 1] || a.data[i + 2] !== b.data[i + 2])) n++;
      }
      return n;
    };
    const h0 = await shoot(page, BASE, ST.water, 58, T, `${OUT}/${TAG}_clock_t0a.png`, CHARS, SPAN);
    const h1 = await shoot(page, BASE, ST.water, 58, T, `${OUT}/${TAG}_clock_t0b.png`, CHARS, SPAN);
    const m1 = await shoot(page, BASE, ST.water, 58, T + 0.37, `${OUT}/${TAG}_clock_t1.png`, CHARS, SPAN);
    const holds = poolPx(h0, h1);
    const moves = poolPx(h0, m1);
    console.log(`  CLOCK HOLDS  t=${T} vs t=${T}      pool pixels changed: ${holds}`);
    console.log(`  CLOCK MOVES  t=${T} vs t=${(T + 0.37).toFixed(2)}   pool pixels changed: ${moves}  ${moves > 200 * Math.max(holds, 1) ? 'the puddle clock IS ?t=' : 'INCONCLUSIVE'}`);
    rows.push({ tag: TAG, clockHolds: holds, clockMoves: moves });
  }

  await writeFile(`${OUT}/${TAG}.json`, JSON.stringify(rows, null, 2));
  await browser.close();
  process.exit(refused === 0 ? 0 : 3);
}
