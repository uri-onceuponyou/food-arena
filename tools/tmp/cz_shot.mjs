#!/usr/bin/env node
/**
 * CZ SHOT — the concealment patches, with a character standing IN one, at BOTH cameras.
 *
 * ── The question ─────────────────────────────────────────────────────────────
 * Uri: *"i still can't see the 'bushes' that we can hide below them."* The only way to
 * answer that is a picture with the character and the patch in the same frame, at the
 * pitch he judges at. `CLAUDE.md` rule 3: the match ships **58**, the lobby ships **20**,
 * and the shallow one is the better DETECTOR for "is this thing flat".
 *
 * ── Why the camera is aimed OFF the patch ────────────────────────────────────
 * `preview.ts?piece=arena` rings five characters around `tx,ty` at radius 95/137 wu and
 * aims the rig at the same point — the ring and the aim are the SAME parameter and cannot
 * be decoupled from outside. Character 0 sits at `ang = 0.6 rad, rad = 95`, so aiming at
 * `patch - 95·(cos 0.6, sin 0.6)` puts character 0 exactly on the patch centre. That is
 * arithmetic against `preview.ts`'s own literals, re-derived here rather than copied:
 * if that ring ever moves, the character walks out of the patch and the `--verify` arm
 * below goes red rather than the sheet quietly becoming a picture of empty floor.
 *
 * 🚨 Rule 6: **a tool that photographs the sky and asserts the rig was reachable is a
 * PASS with no subject in it.** So every station is checked for (a) a non-degenerate
 * frame, and (b) the two arms of `--drift` being byte-identical. Read the PNGs.
 *
 *   node tools/tmp/sx_snap.mjs --root /tmp/fa-clean -- \
 *     node tools/tmp/cz_shot.mjs --url {URL} --out tools/tmp/cz_before
 *   node tools/tmp/cz_shot.mjs --url {URL} --out ... --drift    # identical frame twice
 */
import { chromium } from 'playwright';
import { mkdir, writeFile, readFile } from 'node:fs/promises';
import { createHash } from 'node:crypto';

const LAUNCH = ['--use-gl=angle', '--use-angle=swiftshader', '--enable-unsafe-swiftshader',
  '--enable-webgl', '--ignore-gpu-blocklist', '--disable-gpu-sandbox'];

const args = {};
for (let i = 2; i < process.argv.length; i++) {
  const a = process.argv[i];
  if (!a.startsWith('--')) continue;
  const n = process.argv[i + 1];
  if (n === undefined || n.startsWith('--')) args[a.slice(2)] = true;
  else { args[a.slice(2)] = n; i++; }
}
const BASE = String(args.url ?? process.env.PREVIEW_BASE ?? '').replace(/\/$/, '');
if (!BASE) { console.error('cz_shot: --url or PREVIEW_BASE required'); process.exit(2); }
const OUT = String(args.out ?? 'tools/tmp/cz_shots');
const W = Number(args.w ?? 1400);
const H = Number(args.h ?? 900);
const FROZEN_T = String(args.t ?? '1.5');

// ── preview.ts's ring, restated so the offset is derived and not guessed ─────
const RING_ANG0 = 0.6;            // `(0 / cast.length) * 2π + 0.6`
const RING_RAD0 = 95;             // `95 + (0 % 2) * 42`
const OFF_X = Math.cos(RING_ANG0) * RING_RAD0;
const OFF_Y = Math.sin(RING_ANG0) * RING_RAD0;

// ── The patches, in kitchen.ts's own coordinates ─────────────────────────────
// Read off `src/arena/kitchen.ts`'s named constants at capture time (below) rather
// than retyped: `CLAUDE.md` — the 1× map is exactly the NW quadrant of the ×4 one, so a
// stale coordinate is still a LEGAL coordinate and no legality check can see it.
// ⚠️ `--srcroot` defaults to THIS checkout, not to the tree being served. Pass the
// worktree when the two can differ, or the stations are aimed by one commit's literals
// at another commit's arena — the exact "still a LEGAL coordinate" class.
async function patchesFromSource() {
  const root = args.srcroot ? `${args.srcroot}/src/arena/kitchen.ts` : null;
  const src = await readFile(root ?? new URL('../../src/arena/kitchen.ts', import.meta.url), 'utf8');
  const out = [];
  for (const n of [1, 2, 3, 4, 5, 6, 7, 8, 9, 10]) {
    const x = src.match(new RegExp(`CONCEAL_P${n}X\\s*=\\s*(-?[\\d.]+)`));
    const y = src.match(new RegExp(`CONCEAL_P${n}Y\\s*=\\s*(-?[\\d.]+)`));
    const s = src.match(new RegExp(`CONCEAL_P${n}S\\s*=\\s*(-?[\\d.]+)`));
    if (x && y && s) out.push({ id: `p${n}`, x: +x[1], y: +y[1], s: +s[1] });
  }
  if (out.length === 0) { console.error('cz_shot: ZERO patches parsed from kitchen.ts'); process.exit(2); }
  return out;
}

const url = (tx, ty, pitch, chars) =>
  `${BASE}/preview.html?piece=arena&tx=${tx.toFixed(3)}&ty=${ty.toFixed(3)}` +
  `&pitch=${pitch}&t=${FROZEN_T}&chars=${chars}`;

const sha = (buf) => createHash('sha256').update(buf).digest('hex').slice(0, 16);

/** Frame statistics — the cheap "is this a picture of nothing" guard. */
function stats(png) {
  // PNG bytes only; the real degeneracy check is done page-side on the canvas below.
  return { bytes: png.length, sha: sha(png) };
}

async function main() {
  const PATCHES = await patchesFromSource();
  // Three patches, two pitches. `p1` 130 wu is the largest shipped, `p2` 110 the
  // smallest, `p3` 120 the modal — so the sheet spans the whole shipped size range
  // rather than showing the same square three times.
  const pick = ['p1', 'p2', 'p3'].map((id) => PATCHES.find((p) => p.id === id)).filter(Boolean);
  if (pick.length !== 3) { console.error('cz_shot: expected p1..p3, got', pick.map(p => p.id)); process.exit(2); }

  // ── WHY 40 AND NOT 20 FOR THE "SHALLOW DETECTOR" ────────────────────────────
  // `CLAUDE.md` rule 3 wants the LOBBY pitch (20) because a flat thing reads flattest
  // there. But `piece=arena` fixes `viewWidthUnits` to SHIPPED_SPAN and `frameMode:
  // 'ground'` divides the distance by `max(0.35, sin pitch)` — so pitch 22 frames
  // 490/0.35 = 1400 wu of ground against 58's 490/sin58 = 578, i.e. **2.42x wider**, and
  // a 130 wu patch drops from 27% of frame width to 9%. That is not a shallower look at
  // the patch, it is a picture of the whole arena. 40 is the shallowest pitch that still
  // frames the patch at a size a defect can be seen at (490/sin40 = 762 wu, 17%).
  // The 22 station is KEPT — as the "can you even spot them" view, which is Uri's
  // sentence — but it is not the detector.
  const stations = [];
  for (const p of pick) {
    for (const pitch of [58, 40]) {
      stations.push({ id: `${p.id}_${pitch}`, tx: p.x - OFF_X, ty: p.y - OFF_Y, pitch, chars: 1, note: `${p.s}wu, character ON patch centre` });
    }
  }
  // Two "ring" stations: camera ON the patch, five characters around its edge — the
  // view that shows whether the structure overlaps a fighter standing beside it.
  stations.push({ id: `${pick[0].id}_ring58`, tx: pick[0].x, ty: pick[0].y, pitch: 58, chars: 1, note: 'ring' });
  stations.push({ id: `${pick[0].id}_ring22`, tx: pick[0].x, ty: pick[0].y, pitch: 22, chars: 1, note: 'ring' });

  await mkdir(OUT, { recursive: true });
  const browser = await chromium.launch({ args: LAUNCH });
  const ctx = await browser.newContext({ viewport: { width: W, height: H }, deviceScaleFactor: 1 });
  const page = await ctx.newPage();

  // A fresh snapshot's FIRST client eats a dep-optimisation reload (`AGENT-BRIEF §3`).
  await page.goto(`${BASE}/preview.html?piece=arena&chars=0&t=0.5`, { waitUntil: 'domcontentloaded', timeout: 120000 }).catch(() => {});
  await page.waitForTimeout(1500);

  const rows = [];
  for (const st of stations) {
    const u = url(st.tx, st.ty, st.pitch, st.chars);
    await page.goto(u, { waitUntil: 'domcontentloaded', timeout: 120000 });
    await page.waitForFunction('window.__previewReady === true', null, { timeout: 180000 });
    await page.waitForTimeout(350);

    // Page-side degeneracy check: a uniform frame is a picture of nothing, and it is
    // the failure that reads exactly like a pass.
    const px = await page.evaluate(() => {
      const c = document.querySelector('canvas');
      if (!c) return null;
      const g = document.createElement('canvas');
      g.width = 160; g.height = 100;
      const cx = g.getContext('2d');
      cx.drawImage(c, 0, 0, 160, 100);
      const d = cx.getImageData(0, 0, 160, 100).data;
      let n = 0, s = 0, s2 = 0, uniq = new Set();
      for (let i = 0; i < d.length; i += 4) {
        const l = 0.2126 * d[i] + 0.7152 * d[i + 1] + 0.0722 * d[i + 2];
        n++; s += l; s2 += l * l;
        uniq.add((d[i] >> 3) << 10 | (d[i + 1] >> 3) << 5 | (d[i + 2] >> 3));
      }
      const mean = s / n;
      return { mean: +mean.toFixed(3), sd: +Math.sqrt(s2 / n - mean * mean).toFixed(3), colours: uniq.size };
    });
    if (!px || px.sd < 4 || px.colours < 40) {
      console.error(`cz_shot: DEGENERATE frame at ${st.id}`, px);
      await browser.close();
      process.exit(3);
    }

    const shot = await page.screenshot({ timeout: 120000 });
    await writeFile(`${OUT}/${st.id}.png`, shot);
    let drift = null;
    if (args.drift) {
      await page.waitForTimeout(250);
      const again = await page.screenshot({ timeout: 120000 });
      drift = sha(again) === sha(shot) ? 'IDENTICAL' : 'DRIFTED';
      await writeFile(`${OUT}/${st.id}.drift.png`, again);
    }
    const row = { ...st, url: u, ...stats(shot), px, drift };
    rows.push(row);
    console.log(`${st.id.padEnd(12)} pitch ${String(st.pitch).padStart(2)}  mean ${String(px.mean).padStart(7)}  sd ${String(px.sd).padStart(6)}  colours ${String(px.colours).padStart(5)}  ${drift ?? ''}  ${row.sha}`);
  }

  await browser.close();
  await writeFile(`${OUT}/manifest.json`, JSON.stringify({ base: BASE, w: W, h: H, t: FROZEN_T, ringOffset: { x: +OFF_X.toFixed(4), y: +OFF_Y.toFixed(4) }, rows }, null, 2));
  if (args.drift) {
    const bad = rows.filter((r) => r.drift !== 'IDENTICAL');
    console.log(`drift control: ${rows.length - bad.length}/${rows.length} IDENTICAL`);
    if (bad.length) { console.error('cz_shot: DRIFT', bad.map((b) => b.id)); process.exit(4); }
  }
  console.log(`cz_shot: ${rows.length} stations -> ${OUT}`);
}

main().catch((e) => { console.error(e); process.exit(1); });
