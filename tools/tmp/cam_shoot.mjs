#!/usr/bin/env node
/**
 * cam_shoot — render OUR OWN geometry at a ladder of KNOWN camera pitches.
 *
 * This exists for one reason: `cam_ellipse.mjs` claims to recover a camera's pitch
 * from a circle lying on the ground, and **an instrument that has not been shown to
 * return the two angles we already know cannot be believed on a plate whose angle we
 * do not** (`CLAUDE.md` #6). Our two shipped cameras are `charStage.ts`'s lobby at
 * **pitchDeg 20** and `camera.ts`'s match at **58**, so those are the two the ladder
 * must hit — plus a HELD-OUT 40 that the calibration never sees, because two points
 * can be matched by a wrong model and three cannot as easily.
 *
 *   node tools/tmp/with_snapshot.mjs -- node tools/tmp/cam_shoot.mjs --url {URL}
 *
 * WHAT IT SHOOTS, and why each one
 *
 *  prop  — `piece=prop&kind=supply_barrel`. An upright cylinder prop whose TOP FACE is
 *          a circle in a horizontal plane. Deliberately the same KIND of target the
 *          reference measurement uses, so the two sides are the same quantity and not
 *          merely two numbers with the same units. `mountProp` fits the camera to the
 *          prop, which also makes the preview's fog gradient across the target
 *          negligible — a graded edge is the one thing a threshold cannot find, and it
 *          is why the preview's own 28 m ground disc was rejected as a target.
 *
 *  char  — `piece=character`, one render per pitch per character. The CHARACTER
 *          presentation statistic (`cam_face.mjs`) is measured on these. Fog is
 *          present but irrelevant: that statistic is positional, not photometric.
 *
 * ⚠️ Framing is NOT held constant across the ladder and cannot be. `frameMode:'ground'`
 * frames `viewWidthUnits / sin(pitch)`, so the prop is ~2.4x smaller at 20 deg than at
 * 58 deg. That is fine for an ANGLE — every statistic here is a ratio — and it is
 * stated because a pixel-count statistic measured off these frames would be wrong.
 */
import { chromium } from 'playwright';
import { mkdir } from 'node:fs/promises';
import { dirname } from 'node:path';

const LAUNCH_ARGS = ['--use-gl=angle', '--use-angle=swiftshader', '--enable-unsafe-swiftshader',
  '--enable-webgl', '--ignore-gpu-blocklist', '--disable-gpu-sandbox'];

const argv = process.argv.slice(2);
const arg = (k, d = null) => { const i = argv.indexOf(k); return i >= 0 ? argv[i + 1] : d; };
const BASE = arg('--url') ?? process.env.PREVIEW_BASE ?? 'http://localhost:5173';
const OUT = arg('--out-dir', 'shots/camangle');
const only = arg('--only');

/** The two SHIPPED pitches plus a held-out third. */
const PITCHES = (arg('--pitches') ?? '20,40,58').split(',').map(Number);
const CHARS = (arg('--chars') ?? 'egg,donut,hotdog,hamburger').split(',');

const jobs = [];
for (const p of PITCHES) {
  jobs.push({
    url: `${BASE}/preview.html?piece=prop&kind=supply_barrel&chars=0&pitch=${p}&shot=1`,
    out: `${OUT}/ours_prop_p${p}.png`, w: 1600, h: 1000, tag: 'prop',
  });
}
// ring — `piece=arena` centred on the boiling pot, whose danger stripe is a
// `RingGeometry(R-w, R+w, 96)` lying FLAT ON THE GROUND (`src/arena/hazards.ts:461`).
// 96 segments, so unlike the barrel's low-poly lid it is a circle to within 0.05%, and
// unlike the lid it is a GROUND circle — the same class of object as the plates'
// ground markers. This is the calibration target of record; the barrel is the control
// that proves the two target KINDS agree.
for (const p of PITCHES) {
  jobs.push({
    url: `${BASE}/preview.html?piece=arena&chars=0&pitch=${p}&shot=1`,
    out: `${OUT}/ours_ring_p${p}.png`, w: 1600, h: 1000, tag: 'ring',
  });
}
for (const p of PITCHES) {
  for (const id of CHARS) {
    jobs.push({
      url: `${BASE}/preview.html?piece=character&id=${id}&anim=idle&yaw=0&t=1.5&pitch=${p}&fill=0.72&shot=1`,
      out: `${OUT}/ours_char_${id}_p${p}.png`, w: 900, h: 1000, tag: 'char',
    });
  }
}

const run = jobs.filter((j) => !only || j.tag === only);
const browser = await chromium.launch({ args: LAUNCH_ARGS });
let bad = 0;
try {
  for (const job of run) {
    const scale = job.w * job.h > 1_100_000 ? 1 : 2;
    const page = await browser.newPage({ viewport: { width: job.w, height: job.h }, deviceScaleFactor: scale });
    const errors = [];
    page.on('pageerror', (e) => errors.push(String(e)));
    try {
      await page.goto(job.url, { waitUntil: 'networkidle', timeout: 60000 });
      await page.waitForFunction('window.__previewReady === true', null, { timeout: 60000 });
      await page.waitForTimeout(250);
      await mkdir(dirname(job.out), { recursive: true });
      await page.screenshot({ path: job.out, timeout: 90000 });
      console.log(`ok   ${job.out}`);
    } catch (e) {
      bad++;
      console.error(`FAIL ${job.out}: ${e.message}${errors.length ? ' | ' + errors[0] : ''}`);
    } finally { await page.close(); }
  }
} finally { await browser.close(); }
if (bad) process.exitCode = 1;
