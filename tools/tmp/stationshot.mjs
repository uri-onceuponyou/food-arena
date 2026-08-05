#!/usr/bin/env node
/**
 * THROWAWAY — renders the shipped frame at named `valuescan --mode dl` stations and
 * SAVES THE PNG, because a figure/ground number is meaningless if the figure is not
 * on screen.
 *
 * ── Why this exists ──────────────────────────────────────────────────────────
 * Running `--mode dl` twice — once on HEAD, once on HEAD + a cast-wide albedo change
 * — produced dL values IDENTICAL TO FOUR DECIMAL PLACES at four of the eighteen
 * stations (`pantry_ne`, `pantry_sw`, `freezer_se`, and `freezer_nw` to within
 * 0.0002) while every other station moved by 0.03–0.04. A character metric that does
 * not respond to the character is not measuring the character.
 *
 * Rendered and looked at (`CLAUDE.md` non-negotiable 3), the cause is immediate: at
 * those stations **the player is not visible at all** — it is behind/inside a pantry
 * counter, and the only thing on screen belonging to it is its floating HP bar.
 *
 * `valuescan` takes its MASK from a render with the environment hidden (correct, and
 * deliberately colour-independent) but reads its LUMA from the shipped post-processed
 * frame. Where a prop occludes the character those two disagree: the mask says
 * "character here", the frame shows the counter, and the tool reports **the counter's
 * luma as the character's**. Hence a reading no albedo can ever move.
 *
 * This matters beyond the instrument: `dlBelow10` (max 1 of 18) is a gate key, and
 * three to four of the eighteen stations are prop readings. After the post chain took
 * `shadowToe` to 0.28 those prop readings fell under the 0.10 floor, so the key is now
 * unsatisfiable by any character work — it fails identically before and after.
 *
 * Open question for whoever owns `src/arena/`: are those station coordinates inside a
 * prop's footprint (a probe-configuration bug — the stations were never collision
 * validated) or can a player genuinely stand there and see nothing but its own HP bar
 * (a gameplay bug)? Either answer is actionable; the metric is invalid regardless.
 *
 *   node tools/tmp/headserve.mjs -- node tools/tmp/stationshot.mjs
 */
import { chromium } from 'playwright';

const BASE = process.env.PREVIEW_BASE ?? process.env.HEADSERVE_URL ?? 'http://localhost:5173';
const LAUNCH = ['--use-gl=angle', '--use-angle=swiftshader', '--enable-unsafe-swiftshader',
  '--enable-webgl', '--ignore-gpu-blocklist', '--disable-gpu-sandbox'];
const a = process.argv;
const get = (k, d) => (a.includes(k) ? a[a.indexOf(k) + 1] : d);
const ID = get('--id', 'taco');
const OUT = get('--out', '/tmp');

/** Copied verbatim from `valuescan.mjs`'s STATIONS so the two tools name the same place. */
const STN = {
  pot_south: [700, 640],      // the ladder station — player clearly visible, the control
  pantry_sw: [270, 665],
  pantry_ne: [1150, 330],
  freezer_se: [1000, 700],
  freezer_nw: [430, 240],
};

const b = await chromium.launch({ args: LAUNCH });
try {
  for (const [name, [x, y]] of Object.entries(STN)) {
    const p = await b.newPage({ viewport: { width: 1600, height: 900 } });
    try {
      await p.goto(`${BASE}/?player=${ID}&enemy=donut&px=${x}&py=${y}&fogRadius=850&simSpeed=0.02&pointerLock=0`,
        { waitUntil: 'networkidle', timeout: 120000 });
      await p.waitForFunction('window.__gameReady === true', null, { timeout: 120000 });
      await p.waitForTimeout(900);
      await p.screenshot({ path: `${OUT}/stn_${name}.png` });
      console.log('shot', name);
    } finally { await p.close(); }
  }
} finally { await b.close(); }
