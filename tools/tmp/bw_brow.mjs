#!/usr/bin/env node
/**
 * bw_brow — how far a BROW floats above the eye it belongs to, and how much of the eye
 * region is ink band, measured in RENDERED PIXELS at either shipped camera.
 *
 * THROWAWAY, read-only on src/. Measurement instrument; changes no game code.
 *
 * ── WHAT IT MEASURES, EXACTLY ────────────────────────────────────────────────
 * It does NOT measure pupils — `ey_pacman` does that and this tool must never be quoted
 * for it. It ablates three named parts through the SHIPPED render path and classifies
 * the drawing buffer by dominant channel:
 *
 *     BROW  -> magenta   (its inverted-hull ink too, matched as `<name>__outline`)
 *     LID   -> cyan      (ditto)
 *     EYE   -> green     (the sclera)
 *
 * and then, COLUMN BY COLUMN over the buffer:
 *
 *     gap(x)    = (bottom-most BROW row in column x) - (topmost EYE row in column x) - 1
 *     gapPx     = the MEDIAN of gap(x) over columns where both parts appear
 *     gapFrac   = gapPx / the sclera's own rendered height
 *     lidGap(x) = (bottom-most BROW row in column x) - (topmost LID row in column x) - 1
 *     lidGapPx  = the MEDIAN of that, and `lidGapFrac` it over the same sclera height
 *     spanFrac  = brow width in px / sclera width in px
 *     bandFrac  = (BROW + LID px) / (BROW + LID + EYE px)
 *
 * A column-wise gap is the point. A bounding-box gap says nothing when the brow sits
 * outboard of the eye's apex, which is where brows actually sit; `gap(x)` asks the
 * question a viewer asks — *is there bare wall between this stroke and this eye?*
 *
 * ⚠️ **`lidGap` IS THE MERGE STATISTIC AND `gap` IS NOT.** On any face whose lash sits
 * between the brow and the sclera, the thing a viewer calls "the brow has merged into the
 * eye" is the brow touching the **LASH**, not the sclera — the sclera is already several
 * pixels further down behind it. Steer on `lidGap`; `gap` is the wall to the white.
 *
 * ── 🚨 THE PART SPECS COLLIDED, AND THAT IS WHY `lid` READ 0 px ──────────────
 * Specs are SUBSTRING by default. Hamburger names its sclera exactly `eye` and its lash
 * `eye_lash`, so `--lid eye_lash --eye eye` made **both matchers claim `eye_lash`** — and
 * `eye` is painted LAST, so the lash was painted cyan and then repainted green. The tool
 * reported `lid = 0 px` on four runs and the reading taken from it was *"the lid mesh was
 * never found"*. It was found: `meshes.lid` was **2** the whole time, and it was never
 * printed outside `--selftest`, which is exactly how the wrong cause survived.
 * Worse than a missing number: `eyeTop` then meant *the top of the LASH*, so every
 * `gapPx` quoted for this character was a brow-to-**lash** gap under a brow-to-sclera
 * label. Two defects, one root, and both were silent.
 * → A mesh claimed by two parts is now **FATAL** (exit 4), a requested part that matches
 *   nothing is **FATAL**, and `meshes` is printed on every run.
 * → A spec may be written `=exact_name` to demand an exact match after hull-stripping,
 *   which is the only way to separate `eye` from `eye_lash` on this character.
 *
 * ⚠️ WHY PIXELS AND NOT ARITHMETIC. The authored numbers are in head radii and both
 * shipped cameras foreshorten differently; `rg_solid` is documented wrong at the lobby
 * camera by up to 35x, so a lobby claim has to come from ablation through the shipped
 * path. The ink OUTLINE is painted with the part on purpose: an inverted hull is part of
 * a brow's dark footprint and is exactly what makes a rod read as a strip of tape.
 *
 * ⚠️ THE ABLATION COLOURS ARE CHOSEN UNDER `stage.ts`'s 0.80 BLOOM THRESHOLD.
 * magenta 0.285 luma, green 0.715, cyan 0.710 — all below it, so no painted part blooms
 * into its neighbour and changes another part's measured edge. `--png` writes the
 * classified frame; look at it before believing any number off it.
 *
 * ── KNOWN-BADS. A guard not shown to FAIL is not a guard. `--selftest` runs eleven ──
 *   1 BASELINE      all three parts resolve and the gap is finite.
 *   2 MOVES (UP)    `--nudge 0.02` lifts the brow 0.02 m (a 2.1 m character) page-side.
 *                   `gapPx` MUST GROW. A metric that does not move on a known
 *                   displacement is measuring something else.
 *   3 MOVES (DOWN)  `--nudge -0.02` MUST SHRINK it...
 *   4 SYMMETRY      ...and by a comparable amount, or the column matching is one-sided.
 *   5 HOLDS         `--nudge 0` reproduces the baseline EXACTLY. The render is
 *                   deterministic, so this is an equality, not a tolerance.
 *   6 HIDDEN PART   `--hide brow` blanks the brow; the tool must report 0 px and refuse
 *                   to publish a gap, NOT report `gapPx = 0` (which reads as "seated").
 *   7 NON-EMPTY     the baseline's LID resolves to >=1 mesh AND draws >0 px. This arm
 *                   exists so 8-10 cannot pass vacuously: every one of them asserts
 *                   something about a lid, and `[].every()` is `true` (CLAUDE.md #6).
 *   8 UNMATCHED     `--lid =zz_no_such_mesh` must EXIT 4, not report `lid = 0 px`. A
 *                   part that was not found reports a 0-pixel footprint, which reads
 *                   exactly like a part that is hidden.
 *   9 SELF-PAIR     `--lid <the eye's own spec>` makes two parts claim the same meshes.
 *                   Must EXIT 4. This is the DEFECT THAT SHIPPED: it is what made
 *                   `lid = 0 px` on hamburger while the lash sat inside the eye's mass.
 *  10 HIDDEN LID    `--hide lid` blanks the lash; `lidGapPx` AND `bandFrac` must both be
 *                   REFUSED, because a band averaged over BROW+LID+EYE with no LID in it
 *                   is a three-term quantity computed over two terms.
 *  11 NO LID ASKED  with `--lid ''` the same `bandFrac` must be refused for the same
 *                   reason — the vacuity does not become acceptable by being requested.
 *
 *   PREVIEW_BASE=http://localhost:5301 node tools/tmp/bw_brow.mjs \
 *     --id lollipop --brow lollipop_brow --lid lollipop_lid --eye lollipop_sclera --pitch 20
 *   PREVIEW_BASE=... node tools/tmp/bw_brow.mjs --id hamburger \
 *     --brow =brow --lid =eye_lash --eye =eye --pitch 20      # EXACT: `eye` ⊂ `eye_lash`
 *
 * ⚠️ `--selftest` REQUIRES A LID and defaults it to `<id>_lid`; arms 7-11 are all about
 * lid handling and there is no honest way to run them on a character that has none. On
 * such a character it EXITS 2 with the reason rather than silently dropping four arms —
 * a skipped arm and a passing arm print the same colour at the bottom of a battery. The
 * old header example (`--selftest --id waterbottle`, which has no lid mesh) is therefore
 * gone; measure waterbottle without `--selftest`, or self-test on lollipop.
 */
import { chromium } from 'playwright';
import { mkdir, writeFile } from 'node:fs/promises';
import { dirname } from 'node:path';

const a = process.argv;
const get = (k, d) => (a.includes(k) ? a[a.indexOf(k) + 1] : d);
const BASE = process.env.PREVIEW_BASE ?? get('--url', null);
const ID = get('--id', 'lollipop');
const BROW = get('--brow', `${ID}_brow`);
const EYE = get('--eye', `${ID}_sclera`);
const SELFTEST_EARLY = a.includes('--selftest');
// ⚠️ The default is EMPTY outside `--selftest` — a lid is genuinely optional for a
// measurement — but inside it the lid arms are four of the eleven, so it defaults to
// `<id>_lid` and the run REFUSES rather than quietly self-testing a two-part tool.
const LID = get('--lid', SELFTEST_EARLY ? `${ID}_lid` : '');
const PITCH = Number(get('--pitch', '20'));
const YAW = Number(get('--yaw', '0'));
const FILL = Number(get('--fill', '0.60'));
const NUDGE = Number(get('--nudge', '0'));
const HIDE = get('--hide', '');
const JSON_OUT = get('--json', '');
const PNG_OUT = get('--png', '');
const SELFTEST = SELFTEST_EARLY;

if (!BASE) { console.error('need PREVIEW_BASE or --url'); process.exit(2); }

const T = 1.5, ANIM = 'idle', BG = '000000';
const W = 900, H = 1400;

const LAUNCH_ARGS = ['--use-gl=angle', '--use-angle=swiftshader', '--enable-unsafe-swiftshader',
  '--enable-webgl', '--ignore-gpu-blocklist', '--disable-gpu-sandbox'];

const HMR_STUB = `const noop=()=>{};
export const createHotContext=()=>({accept:noop,acceptExports:noop,dispose:noop,prune:noop,
  invalidate:noop,on:noop,off:noop,send:noop,decline:noop,data:{}});
export const injectQuery=(u)=>u; export const updateStyle=noop; export const removeStyle=noop;
export const ErrorOverlay=class{}; export default {};`;

const browser = await chromium.launch({ args: LAUNCH_ARGS });

/**
 * One measurement, in its own page so nothing an earlier arm painted can leak into a
 * later one. `nudge` is in WORLD METRES on a ~2.1 m character; `hide` blanks a part.
 * Both exist so the instrument can be shown to move and to fail.
 */
async function measure(opts = {}) {
  const page = await browser.newPage({ viewport: { width: W, height: H }, deviceScaleFactor: 1 });
  await page.route('**/@vite/client', (r) => r.fulfill({ status: 200, contentType: 'application/javascript', body: HMR_STUB }));
  const errs = [];
  page.on('pageerror', (e) => errs.push(e.message));
  // ⚠️ bg=000000 ON PURPOSE, and it is half of the classifier. See `blackout` below.
  const url = `${BASE}/preview.html?piece=character&id=${ID}&pitch=${opts.pitch ?? PITCH}&yaw=${YAW}`
    + `&fill=${FILL}&t=${T}&anim=${ANIM}&shot=1&bg=${BG}`;
  await page.goto(url, { waitUntil: 'load', timeout: 120_000 });
  await page.waitForFunction('window.__previewReady === true && !!window.__stage', null, { timeout: 180_000 });

  const res = await page.evaluate(({ brow, lid, eye, nudge, hide }) => {
    const st = window.__stage;

    // The app does not put THREE on `window`. A `MeshBasicMaterial` is reached through an
    // object that already has one — every character in this cast builds its catchlights
    // with `flatMat`, which returns exactly that — so the ablation uses the SAME class
    // the renderer already compiled a program for. Two THREE copies would be two class
    // trees and `isMeshBasicMaterial` would be the only thing that still worked.
    let basicProto = null;
    st.scene.traverse((o) => {
      if (basicProto) return;
      if (o.isMesh && o.material && o.material.isMeshBasicMaterial) basicProto = o.material;
    });
    if (!basicProto) return { fatal: 'no MeshBasicMaterial anywhere in the scene to clone' };
    const flat = (hex) => { const m = basicProto.clone(); m.color.set(hex); m.transparent = false; m.opacity = 1; return m; };

    // ── BLACKOUT, and it is not optional ────────────────────────────────────
    // The first version of this tool classified by dominant channel over the LIT frame
    // and reported `lid = 101,125 px` on a character that has no lid mesh at all: a
    // pale-blue bottle is `G && B && !R` to within any tolerance worth having, so the
    // instrument was measuring the shell. It also survived its own hidden-brow known-bad
    // at 8 px of stray magenta. Everything in the scene is therefore painted FLAT BLACK
    // first, over a black clear colour, and only the parts get a colour — so a
    // classified pixel is one this tool put there. Depth is untouched, so occlusion is
    // still honest: a brow hidden behind the cap still measures as missing.
    st.scene.traverse((o) => {
      if (!o.isMesh || !o.material) return;
      const m = basicProto.clone();
      m.color.set('#000000');
      m.transparent = !!o.material.transparent;
      m.opacity = o.material.opacity ?? 1;
      m.side = o.material.side;
      o.material = m;
    });

    // 🚨 ASSERT THE SET IS NON-EMPTY BEFORE FILTERING OVER IT (CLAUDE.md #6). Every
    // loop below runs over `parts`, and an empty `parts` makes all of them succeed
    // while measuring nothing at all.
    const requested = [
      { key: 'brow', sub: brow, hex: '#ff00ff' },
      { key: 'lid', sub: lid, hex: '#00e6e6' },
      { key: 'eye', sub: eye, hex: '#00ff00' },
    ];
    const parts = requested.filter((p) => p.sub);
    if (!parts.length) return { fatal: 'NO PART SPECS AT ALL — every loop here would run over an empty set and pass', code: 4 };

    const counts = { brow: 0, lid: 0, eye: 0 };
    // WORLD-SPACE extents per part, per side, so the pixel answer can be checked against
    // the geometry that produced it. `gapPx` is the number to steer on — it is what a
    // viewer sees — but a pixel gap that disagrees with the world gap means the model in
    // your head is wrong about a transform, and that is worth knowing before the next
    // edit rather than after three of them.
    const world = {};
    const wbox = (o) => {
      const pos = o.geometry.attributes.position;
      o.updateMatrixWorld(true);
      const m = o.matrixWorld.elements;
      const b = { x0: 1e9, y0: 1e9, z0: 1e9, x1: -1e9, y1: -1e9, z1: -1e9 };
      for (let i = 0; i < pos.count; i++) {
        const lx = pos.getX(i), ly = pos.getY(i), lz = pos.getZ(i);
        const X = m[0] * lx + m[4] * ly + m[8] * lz + m[12];
        const Y = m[1] * lx + m[5] * ly + m[9] * lz + m[13];
        const Z = m[2] * lx + m[6] * ly + m[10] * lz + m[14];
        if (X < b.x0) b.x0 = X; if (X > b.x1) b.x1 = X;
        if (Y < b.y0) b.y0 = Y; if (Y > b.y1) b.y1 = Y;
        if (Z < b.z0) b.z0 = Z; if (Z > b.z1) b.z1 = Z;
      }
      return b;
    };

    // ── MATCH FIRST, PAINT LATER. The two used to be one loop, and that is the whole
    // bug: `eye` was matched and painted AFTER `lid`, so a mesh both specs claimed ended
    // up green with no trace that anything had been overwritten. Nothing is painted until
    // every spec has been resolved and the claims have been checked against each other.
    // `=name` means EXACT (after hull-stripping); anything else is a substring.
    const matched = {};
    for (const p of parts) {
      const exact = p.sub.startsWith('=');
      const want = exact ? p.sub.slice(1) : p.sub;
      const hits = [];
      st.scene.traverse((o) => {
        if (!o.isMesh || !o.name) return;
        const isHull = o.name.endsWith('__outline');
        const base = isHull ? o.name.slice(0, -'__outline'.length) : o.name;
        if (exact ? base !== want : !base.includes(want)) return;
        hits.push({ o, isHull });
      });
      counts[p.key] = hits.length;
      matched[p.key] = hits;
    }

    // ── 1. EVERY REQUESTED PART MUST RESOLVE ────────────────────────────────
    // Only `brow` and `eye` used to be checked, and only after the render, in the
    // non-selftest branch. A `--lid` that matched nothing produced `lid = 0 px`, which is
    // indistinguishable from a lid that is hidden or occluded — the same class of silent
    // zero this tool's own blackout note is about.
    const unresolved = parts.filter((p) => counts[p.key] === 0);
    if (unresolved.length) {
      return {
        code: 4, meshes: counts,
        fatal: `PART MATCHED NOTHING: ${unresolved.map((p) => `${p.key}="${p.sub}"`).join(', ')}`
          + ' — a part that was not found reports a 0-pixel footprint, which reads as a pass.',
      };
    }

    // ── 2. NO MESH MAY BE CLAIMED BY TWO PARTS ──────────────────────────────
    // The defect that shipped. `--lid eye_lash --eye eye` on hamburger: `eye_lash`
    // contains `eye`, so both specs matched it, `eye` painted last, and `lid` measured
    // 0 px of a mesh that was right there. Fatal, and it names the mesh and both claims.
    const owner = new Map();
    const clash = [];
    for (const p of parts) {
      for (const { o } of matched[p.key]) {
        const prev = owner.get(o);
        if (prev !== undefined && prev !== p.key) clash.push(`"${o.name}" claimed by BOTH ${prev} and ${p.key}`);
        else owner.set(o, p.key);
      }
    }
    if (clash.length) {
      return {
        code: 4, meshes: counts,
        fatal: `PART SPECS COLLIDE (${clash.length}): ${clash.slice(0, 6).join('; ')}`
          + ' — the last spec painted wins and the other measures 0 px. Use `=exact_name`.',
      };
    }

    for (const p of parts) {
      world[p.key] = matched[p.key].filter((x) => !x.isHull).map(({ o }) => {
        const b = wbox(o);
        return { name: o.name, ...b };
      });
      for (const { o, isHull } of matched[p.key]) {
        if (hide === p.key) { o.visible = false; continue; }
        if (nudge && p.key === 'brow') o.position.y += nudge;
        o.material = flat(p.hex);
        o.renderOrder = 500 + (isHull ? 0 : 1);
      }
    }
    st.renderer.render(st.scene, st.rig.camera);

    const gl = st.renderer.getContext();
    const cv = st.renderer.domElement;
    const w = cv.width, h = cv.height;
    const buf = new Uint8Array(w * h * 4);
    gl.readPixels(0, 0, w, h, gl.RGBA, gl.UNSIGNED_BYTE, buf);

    // Over a blacked-out scene the classifier is a channel test, not a hue guess.
    // ⚠️ `readPixels` rows run BOTTOM-UP. `browBot`/`eyeTop` are therefore stored in
    // bottom-up rows, where "the brow is above the eye" means a LARGER row index.
    const browBot = new Int32Array(w).fill(-1);
    const eyeTop = new Int32Array(w).fill(-1);
    const lidTop = new Int32Array(w).fill(-1);
    const px = { brow: 0, lid: 0, eye: 0 };
    let ex0 = w, ex1 = -1, ey0 = h, ey1 = -1, bx0 = w, bx1 = -1;
    for (let y = 0; y < h; y++) {
      for (let x = 0; x < w; x++) {
        const i = (y * w + x) * 4;
        const r = buf[i], g = buf[i + 1], b = buf[i + 2];
        const mx = Math.max(r, g, b);
        if (mx < 40) continue;
        const lo = mx * 0.4;
        let k = null;
        if (r >= lo && b >= lo && g < lo) k = 'brow';
        else if (g >= lo && b >= lo && r < lo) k = 'lid';
        else if (g >= lo && r < lo && b < lo) k = 'eye';
        if (!k) continue;
        px[k]++;
        if (k === 'brow') {
          if (browBot[x] < 0 || y < browBot[x]) browBot[x] = y;
          if (x < bx0) bx0 = x; if (x > bx1) bx1 = x;
        } else if (k === 'eye') {
          if (y > eyeTop[x]) eyeTop[x] = y;
          if (x < ex0) ex0 = x; if (x > ex1) ex1 = x;
          if (y < ey0) ey0 = y; if (y > ey1) ey1 = y;
        } else if (k === 'lid') {
          if (y > lidTop[x]) lidTop[x] = y;
        }
      }
    }

    // PER SIDE. Both eyes and both brows share a name, so a single bounding box spans
    // the pair and hides the per-eye asymmetry these two characters are built around.
    // The split is the midpoint of the sclera pair's own box — derived from the render,
    // not typed.
    const mid = ex1 >= ex0 ? (ex0 + ex1) / 2 : w / 2;
    const side = (x0, x1) => {
      const gaps = [], lidGaps = [];
      let bxa = w, bxb = -1, exa = w, exb = -1, eya = h, eyb = -1, bn = 0, en = 0;
      for (let x = x0; x <= x1; x++) {
        if (browBot[x] >= 0) { bn++; if (x < bxa) bxa = x; if (x > bxb) bxb = x; }
        if (eyeTop[x] >= 0) { en++; if (x < exa) exa = x; if (x > exb) exb = x; }
        if (browBot[x] >= 0 && eyeTop[x] >= 0) gaps.push(browBot[x] - eyeTop[x] - 1);
        if (browBot[x] >= 0 && lidTop[x] >= 0) lidGaps.push(browBot[x] - lidTop[x] - 1);
      }
      gaps.sort((p, q) => p - q);
      lidGaps.sort((p, q) => p - q);
      return { gaps, lidGaps, bn, en, bw: bxb >= bxa ? bxb - bxa + 1 : 0, ew: exb >= exa ? exb - exa + 1 : 0, eya, eyb };
    };
    // Per-side sclera HEIGHT needs its own vertical extent, so it is recomputed from the
    // columns rather than reused from the pair's box.
    const sideH = (x0, x1) => {
      let a = h, b = -1;
      for (let y = 0; y < h; y++) {
        for (let x = x0; x <= x1; x++) {
          const i = (y * w + x) * 4;
          const r = buf[i], g = buf[i + 1], bb = buf[i + 2];
          const mx = Math.max(r, g, bb);
          if (mx < 40) continue;
          const lo = mx * 0.4;
          if (g >= lo && r < lo && bb < lo) { if (y < a) a = y; if (y > b) b = y; break; }
        }
      }
      return b >= a ? b - a + 1 : 0;
    };

    const sides = {};
    for (const [key, x0, x1] of [['L', 0, Math.floor(mid)], ['R', Math.ceil(mid), w - 1]]) {
      const s = side(x0, x1);
      const hgt = sideH(x0, x1);
      const med = s.gaps.length ? s.gaps[Math.floor(s.gaps.length / 2)] : null;
      const lmed = s.lidGaps.length ? s.lidGaps[Math.floor(s.lidGaps.length / 2)] : null;
      sides[key] = {
        gapPx: med, gapMin: s.gaps.length ? s.gaps[0] : null, gapMax: s.gaps.length ? s.gaps[s.gaps.length - 1] : null,
        gapCols: s.gaps.length, scleraH: hgt, scleraW: s.ew, browW: s.bw,
        gapFrac: hgt && med !== null ? med / hgt : null,
        lidGapPx: lmed, lidGapCols: s.lidGaps.length,
        lidGapMin: s.lidGaps.length ? s.lidGaps[0] : null,
        lidGapMax: s.lidGaps.length ? s.lidGaps[s.lidGaps.length - 1] : null,
        lidGapFrac: hgt && lmed !== null ? lmed / hgt : null,
        spanFrac: s.ew ? s.bw / s.ew : null,
      };
    }

    const gaps = [], lidGaps = [];
    for (let x = 0; x < w; x++) {
      if (browBot[x] >= 0 && eyeTop[x] >= 0) gaps.push(browBot[x] - eyeTop[x] - 1);
      if (browBot[x] >= 0 && lidTop[x] >= 0) lidGaps.push(browBot[x] - lidTop[x] - 1);
    }
    gaps.sort((p, q) => p - q);
    lidGaps.sort((p, q) => p - q);
    const median = gaps.length ? gaps[Math.floor(gaps.length / 2)] : null;
    const lidMedian = lidGaps.length ? lidGaps[Math.floor(lidGaps.length / 2)] : null;
    const scleraH = ey1 >= ey0 ? ey1 - ey0 + 1 : 0;
    const scleraW = ex1 >= ex0 ? ex1 - ex0 + 1 : 0;
    const browW = bx1 >= bx0 ? bx1 - bx0 + 1 : 0;

    // ── bandFrac IS REFUSED UNLESS ALL THREE TERMS ARE PRESENT ──────────────
    // It was published whenever the denominator was non-zero, so a run with no `--lid`
    // at all printed a "BROW + LID over BROW + LID + EYE" that contained no lid, and a
    // run whose lid had been overpainted printed one too. Both are a three-term average
    // taken over two terms, and both looked like a measurement.
    const lidAsked = !!lid;
    const bandOk = lidAsked && px.lid > 0 && px.brow > 0 && px.eye > 0;
    const bandWhy = bandOk ? null
      : !lidAsked ? 'REFUSED: no --lid was given, so BROW+LID+EYE has no LID term in it'
        : px.lid === 0 ? 'REFUSED: the LID resolved but drew 0 px (hidden, occluded, or overpainted)'
          : 'REFUSED: a term of the band drew 0 px';

    return {
      meshes: counts, px, buffer: { w, h }, mid, sides, world,
      gapPx: median, gapMin: gaps.length ? gaps[0] : null, gapMax: gaps.length ? gaps[gaps.length - 1] : null,
      gapCols: gaps.length, scleraH, scleraW, browW,
      gapFrac: scleraH && median !== null ? median / scleraH : null,
      lidGapPx: lidMedian, lidGapCols: lidGaps.length,
      lidGapFrac: scleraH && lidMedian !== null ? lidMedian / scleraH : null,
      spanFrac: scleraW ? browW / scleraW : null,
      bandFrac: bandOk ? (px.brow + px.lid) / (px.brow + px.lid + px.eye) : null,
      bandWhy,
    };
  }, {
    brow: opts.browSpec ?? BROW,
    lid: opts.lidSpec !== undefined ? opts.lidSpec : LID,
    eye: opts.eyeSpec ?? EYE,
    nudge: opts.nudge ?? NUDGE,
    hide: opts.hide ?? HIDE,
  });

  // ⚠️ A fatal is RETURNED, not exited on. Arms 8 and 9 assert that specific fatals
  // FIRE, and a `process.exit()` here would make the known-bad kill the selftest that
  // is checking for it — the arm would be untestable and would look like it passed.
  if (res.fatal) { await page.close(); return res; }
  res.errs = errs;
  if (opts.png) {
    await mkdir(dirname(opts.png), { recursive: true });
    await page.locator('canvas').first().screenshot({ path: opts.png });
    console.log(`  wrote ${opts.png} (the CLASSIFIED frame — look at it)`);
  }
  await page.close();
  return res;
}

const num = (v, d = 4) => (v === null || v === undefined ? 'n/a' : v.toFixed(d));
const side = (s) => `gap=${String(s.gapPx).padStart(4)} (${s.gapMin}..${s.gapMax}, ${s.gapCols}c) gapFrac=${num(s.gapFrac)}  `
  + `lidGap=${String(s.lidGapPx).padStart(4)} (${s.lidGapMin}..${s.lidGapMax}, ${s.lidGapCols}c) lidGapFrac=${num(s.lidGapFrac)}  `
  + `spanFrac=${num(s.spanFrac, 3)}`;
// `meshes=` is printed on EVERY line on purpose. `lid = 0 px` with `meshes.lid = 2`
// means overpainted; with `meshes.lid = 0` it means unfound; and for four runs nobody
// could tell the two apart because this count only ever appeared inside `--selftest`.
const fmt = (r) => (r.fatal ? `FATAL: ${r.fatal}`
  : `meshes b/l/e=${r.meshes.brow}/${r.meshes.lid}/${r.meshes.eye}  `
  + `brow=${String(r.px.brow).padStart(6)}px lid=${String(r.px.lid).padStart(6)}px `
  + `eye=${String(r.px.eye).padStart(6)}px bandFrac=${r.bandFrac === null ? r.bandWhy : num(r.bandFrac)}\n`
  + `         L: ${side(r.sides.L)}\n         R: ${side(r.sides.R)}`);

let code = 0;
if (SELFTEST) {
  let pass = 0, n = 0;
  const chk = (label, ok, detail) => {
    n++; if (ok) pass++; else code = 1;
    console.log(`${ok ? ' ok ' : 'FAIL'} ${n}. ${label}${detail ? `  — ${detail}` : ''}`);
  };

  const base = await measure();
  // ⚠️ A fatal baseline is not a failed arm, it is a selftest that cannot run. Exit 2 —
  // never 0, and never a green 10/11 with the four lid arms quietly dropped.
  if (base.fatal) {
    console.error(`!! the BASELINE itself is fatal: ${base.fatal}`);
    console.error(`   specs were brow="${BROW}" lid="${LID}" eye="${EYE}" on --id ${ID}.`);
    console.error('   arms 7-11 are all about lid handling, so --selftest requires a lid that resolves.');
    console.error('   Pass --lid <a real mesh name on this character>, or self-test on one that has a lid.');
    await browser.close();
    process.exit(2);
  }
  console.log(`base   ${fmt(base)}`);
  chk('BASELINE resolves brow + eye and produces a finite gap',
    base.meshes.brow > 0 && base.meshes.eye > 0 && base.gapPx !== null,
    `brow meshes=${base.meshes.brow} eye meshes=${base.meshes.eye} gapPx=${base.gapPx}`);

  const up = await measure({ nudge: 0.02 });
  console.log(`up     ${fmt(up)}`);
  chk('MOVES: +0.02 m lifts the brow -> gapPx GROWS', up.gapPx > base.gapPx, `${base.gapPx} -> ${up.gapPx}`);

  const down = await measure({ nudge: -0.02 });
  console.log(`down   ${fmt(down)}`);
  chk('MOVES: -0.02 m drops the brow -> gapPx SHRINKS', down.gapPx < base.gapPx, `${base.gapPx} -> ${down.gapPx}`);
  chk('SYMMETRY: the two displacements are comparable in size',
    Math.abs((up.gapPx - base.gapPx) - (base.gapPx - down.gapPx)) <= Math.max(4, 0.5 * Math.abs(up.gapPx - base.gapPx)),
    `up +${up.gapPx - base.gapPx}  down -${base.gapPx - down.gapPx}`);

  const zero = await measure({ nudge: 0 });
  chk('HOLDS: nudge 0 reproduces the baseline EXACTLY (the render is deterministic)',
    zero.gapPx === base.gapPx && zero.px.brow === base.px.brow,
    `gap ${base.gapPx}/${zero.gapPx}  brow ${base.px.brow}/${zero.px.brow}`);

  const hidden = await measure({ hide: 'brow' });
  chk('HIDDEN PART: an invisible brow reports 0 px and NO gap, not gapPx = 0',
    hidden.px.brow === 0 && hidden.gapPx === null,
    `browPx=${hidden.px.brow} gapPx=${hidden.gapPx}`);

  // ── 7. THE NON-EMPTY ARM, AND IT GOES FIRST OF THE LID FOUR ────────────────
  // 8, 10 and 11 all assert something about a lid. If the baseline's lid resolved to
  // nothing they would still pass — `[].every()` is `true`, and a fatal-on-unresolved
  // tool would have turned three of them green by never reaching the assertion at all.
  // This arm is what stops that: it demands the lid be REAL before the others run.
  chk('NON-EMPTY: the baseline LID resolves to >=1 mesh AND draws pixels (arms 8-11 assert over it)',
    base.meshes.lid > 0 && base.px.lid > 0 && base.lidGapPx !== null,
    `lid meshes=${base.meshes.lid} lidPx=${base.px.lid} lidGapPx=${base.lidGapPx}`);

  // ── 8. AN UNMATCHED PART IS FATAL, NOT A CONFIDENT ZERO ────────────────────
  const nomatch = await measure({ lidSpec: '=zz_no_such_mesh_anywhere' });
  chk('UNMATCHED: a --lid that matches nothing EXITS 4, it does not report lid = 0 px',
    nomatch.fatal !== undefined && nomatch.code === 4 && /MATCHED NOTHING/.test(nomatch.fatal),
    nomatch.fatal ? `code=${nomatch.code} ${nomatch.fatal.slice(0, 70)}` : `NO FATAL — lidPx=${nomatch.px?.lid}`);

  // ── 9. SELF-PAIR. THIS IS THE DEFECT THAT ACTUALLY SHIPPED ─────────────────
  // Point `--lid` at the eye's own spec and both matchers claim the same meshes. The
  // pre-fix tool painted them cyan, then green, and printed `lid = 0 px` — which was
  // read as "the lid mesh does not exist" for four runs on hamburger. Pointing a spec
  // at itself is the strongest available form of that bug and needs no character.
  const selfpair = await measure({ lidSpec: EYE });
  chk('SELF-PAIR: two specs claiming the same mesh EXIT 4 (the overpaint that read as lid = 0 px)',
    selfpair.fatal !== undefined && selfpair.code === 4 && /COLLIDE/.test(selfpair.fatal),
    selfpair.fatal ? `code=${selfpair.code} ${selfpair.fatal.slice(0, 70)}` : `NO FATAL — lidPx=${selfpair.px?.lid}`);

  // ── 10 + 11. THE BAND IS A THREE-TERM QUANTITY ─────────────────────────────
  const lidHidden = await measure({ hide: 'lid' });
  chk('HIDDEN LID: 0 lid px REFUSES both lidGap and bandFrac, rather than averaging over 2 of 3 terms',
    lidHidden.px.lid === 0 && lidHidden.lidGapPx === null && lidHidden.bandFrac === null,
    `lidPx=${lidHidden.px.lid} lidGapPx=${lidHidden.lidGapPx} bandFrac=${lidHidden.bandFrac} (${lidHidden.bandWhy})`);

  const noLid = await measure({ lidSpec: '' });
  chk('NO LID ASKED: bandFrac is REFUSED when --lid is empty, not printed over BROW+EYE alone',
    !noLid.fatal && noLid.bandFrac === null && noLid.gapPx !== null,
    `bandFrac=${noLid.bandFrac} (${noLid.bandWhy}) gapPx=${noLid.gapPx}`);

  console.log(`\nbw_brow --selftest: ${pass}/${n}`);
} else {
  const r = await measure({ png: PNG_OUT || undefined });
  if (r.fatal) {
    console.error(`!! ${r.fatal}`);
    code = r.code ?? 5;
  } else if (!r.px.brow) {
    console.error('!! BROW MATCHED MESHES BUT DREW NO PIXELS — invisible, occluded, or off-frame.');
    code = 4;
  } else {
    console.log(`${ID.padEnd(12)} p${String(PITCH).padStart(2)}  ${fmt(r)}`);
    if (a.includes('--geo')) {
      for (const k of ['eye', 'lid', 'brow']) {
        for (const b of r.world[k] ?? []) {
          console.log(`         world ${k.padEnd(4)} ${b.name.padEnd(22)} `
            + `x ${b.x0.toFixed(4)}..${b.x1.toFixed(4)}  y ${b.y0.toFixed(4)}..${b.y1.toFixed(4)}  z ${b.z0.toFixed(4)}..${b.z1.toFixed(4)}`);
        }
      }
    }
    if (JSON_OUT) {
      await mkdir(dirname(JSON_OUT), { recursive: true });
      await writeFile(JSON_OUT, JSON.stringify({ tool: 'bw_brow.mjs', id: ID, pitch: PITCH, brow: BROW, lid: LID, eye: EYE, ...r }, null, 2));
      console.log(`wrote ${JSON_OUT}`);
    }
  }
}

await browser.close();
process.exit(code);
