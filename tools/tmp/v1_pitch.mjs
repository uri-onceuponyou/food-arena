#!/usr/bin/env node
/**
 * V1_PITCH — the floor at BOTH cameras, plus the drift control that licenses every
 * non-zero number in this round.
 *
 * ## Two cameras, and a floor change is exactly the case they disagree about
 *
 * `CLAUDE.md` rule 3: the match camera is `render/camera.ts`'s `opts.pitchDeg ?? 58` and
 * the lobby is `charStage.ts`'s `pitchDeg: 20`. **The lobby does NOT show this floor** —
 * `charStage` builds its own cyclorama (a teal `0B3F63` cove, no arena geometry at all),
 * so nothing in `src/arena/**` can reach it and "verify at both cameras" cannot mean
 * "open the lobby". Checked rather than assumed: `grep buildFloor src/ui/screens/charStage.ts`
 * returns nothing.
 *
 * What the rule is FOR still applies, and it is the shallow angle, not the screen: a
 * shallow look is the better DETECTOR because foreshortening at 58 deg hides defects that
 * a low angle shows. For a ground layer the shallow arm is `preview.html?piece=floor`
 * with `&pitch=20`, which `mountFloorOnly` already honours. Both are rendered here and
 * both PNGs are meant to be READ, not summarised.
 *
 * ## The drift control (rule 4), and what it has to still first
 *
 * Every capture is taken TWICE and the two must be **byte-identical**. Not "close" — a
 * tolerance guessed instead of measured is how a 15.65-luma context restoration passed
 * for a session. Two things routinely break identity here and both are handled rather
 * than hoped about:
 *
 *   * **Camera shake re-randomises on every `render()`** (`CameraRig.update` multiplies
 *     the DECAY by `dtSeconds` but not the re-randomisation), so a frozen frame is not a
 *     frozen camera. `preview.html` never raises shake, and the control below is what
 *     PROVES that rather than assuming it — if shake were live, this arm goes red.
 *   * **CSS keyframes run on the document timeline, not rAF.** `preview.html` has no HUD,
 *     and again the control is the proof.
 *
 * ⚠️ A drift control that passes because both captures failed the same way is worthless,
 * so the arm also requires the frame to be NON-TRIVIAL: a minimum unique-colour count and
 * a non-degenerate luma spread. Two identical black frames are byte-identical too.
 *
 *   node tools/tmp/sx_snap.mjs --root /tmp/fa-v1-after -- \
 *     node tools/tmp/v1_pitch.mjs --url '{URL}' --tag after --out tools/tmp/v1_pitch
 */
import { chromium } from 'playwright';
import sharp from 'sharp';
import { createHash } from 'node:crypto';
import { mkdirSync, writeFileSync, readFileSync } from 'node:fs';
import { resolve, join } from 'node:path';

const argv = process.argv.slice(2);
const arg = (k, d = null) => { const i = argv.indexOf('--' + k); return i >= 0 ? argv[i + 1] : d; };
const ROOT = resolve(new URL('../..', import.meta.url).pathname);
const BASE = String(arg('url', process.env.PREVIEW_BASE ?? 'http://localhost:5173')).replace(/\/$/, '');
const TAG = String(arg('tag', 'run'));
const OUT = resolve(arg('out', 'tools/tmp/v1_pitch'));
const W = 1600, H = 900;
const LAUNCH = ['--use-gl=angle', '--use-angle=swiftshader', '--enable-unsafe-swiftshader',
  '--enable-webgl', '--ignore-gpu-blocklist', '--disable-gpu-sandbox'];

const A = JSON.parse(readFileSync(join(ROOT, 'tools/arena.gameplay.json'), 'utf8'));
const POT = A.hazards.find((h) => h.kind === 'damage');
/** Derived, never typed: the pot apron (a zone this round creates) and a wall run. */
const STATIONS = [
  { id: 'pot_apron', x: Math.round(A.center.x + POT.radius * 1.9), y: A.center.y },
  { id: 'wall_south', x: Math.round(A.width * 0.62), y: Math.round(A.height - 90) },
  { id: 'open_mid', x: Math.round(A.width * 0.44), y: Math.round(A.height * 0.29) },
];

const sha = (b) => createHash('sha256').update(b).digest('hex').slice(0, 12);

async function shoot(page, s, pitch) {
  await page.goto(`${BASE}/preview.html?piece=floor&tx=${s.x}&ty=${s.y}&pitch=${pitch}&t=0&shot=1`,
    { waitUntil: 'networkidle', timeout: 120_000 });
  await page.waitForFunction(() => window.__previewReady === true, null, { timeout: 120_000 });
  await page.waitForTimeout(400);
  return page.locator('canvas').screenshot();
}

/** Non-degeneracy: a frame that is one flat colour is byte-identical to itself too. */
async function nonTrivial(buf) {
  const { data, info } = await sharp(buf).removeAlpha().raw().toBuffer({ resolveWithObject: true });
  const seen = new Set();
  let lo = 1, hi = 0;
  for (let i = 0; i < info.width * info.height; i += 7) {
    seen.add((data[i * 3] << 16) | (data[i * 3 + 1] << 8) | data[i * 3 + 2]);
    const L = (0.2126 * data[i * 3] + 0.7152 * data[i * 3 + 1] + 0.0722 * data[i * 3 + 2]) / 255;
    if (L < lo) lo = L; if (L > hi) hi = L;
  }
  return { colours: seen.size, lumaSpread: +(hi - lo).toFixed(4) };
}

const browser = await chromium.launch({ args: LAUNCH });
mkdirSync(OUT, { recursive: true });
let pass = 0, fail = 0;
const ck = (n, ok, d = '') => { if (ok) { pass++; console.log(`  ok   ${n}  ${d}`); } else { fail++; console.log(`  FAIL ${n}  ${d}`); } };
const rows = [];
try {
  const page = await browser.newPage({ viewport: { width: W, height: H } });
  await page.goto(`${BASE}/preview.html?piece=floor&t=0&shot=1`, { waitUntil: 'domcontentloaded' }).catch(() => {});
  for (const pitch of [58, 20]) {
    for (const s of STATIONS) {
      const a = await shoot(page, s, pitch);
      const b = await shoot(page, s, pitch);
      const nt = await nonTrivial(a);
      const ha = sha(a), hb = sha(b);
      const file = `${TAG}_p${pitch}_${s.id}.png`;
      writeFileSync(join(OUT, file), a);
      rows.push({ pitch, ...s, sha: ha, identical: ha === hb, ...nt, file });
      ck(`DRIFT p${pitch} ${s.id}: two captures byte-identical`, ha === hb, `${ha} / ${hb}`);
      ck(`  ...and the frame is non-trivial (identical black is identical too)`,
        nt.colours > 500 && nt.lumaSpread > 0.15, `${nt.colours} colours, luma spread ${nt.lumaSpread}`);
    }
  }
} finally { await browser.close(); }
writeFileSync(join(OUT, `${TAG}.json`), JSON.stringify({ tag: TAG, base: BASE, rows }, null, 2));
console.log(`\n  ${pass} pass  ${fail} fail   ->  ${OUT}`);
process.exit(fail === 0 ? 0 : 1);
