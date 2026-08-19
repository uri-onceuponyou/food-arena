#!/usr/bin/env node
/**
 * HALO LIGHTNESS SWEEP — what value should a PALE weapon's halo be, measured on BOTH
 * of the two surfaces the arena actually has, on one frozen frame, with a picture.
 *
 * ── WHY THIS EXISTS AND WHY `p2_bgcross` COULD NOT FINISH THE JOB ───────────────
 *
 * `p2_bgcross` proved the defect: `game/vfx.ts:PROJECTILE_HALO_L` is a lightness FLOOR
 * with no ceiling, so the eight weapons whose own colour is already above 0.82 get a
 * halo of their own pale colour and vanish on the cream concealment cloth `b9bc00e`
 * added (rendered luma ~0.81). It measured ONE candidate — a ceiling of 0.68 — at ONE
 * station (the cloth) and reported ~2.18x.
 *
 * 🚨 **AND ITS PNG EVIDENCE WAS TWO BIT-IDENTICAL FILES.** `shots/p2/clampshot/` and
 * `shots/p2/clampdark/` each contain `<weapon>.cloth.png` and
 * `<weapon>.cloth.haloL<x>.png` with the SAME md5 (3e9ba6d1… and a23fb422…). Both were
 * taken *after* an ablation, and `coreOf`'s last `grab()` is the frame with the
 * projectile **hidden** — visibility is restored but nothing re-renders. So the frame
 * that was "looked at" contains no projectile at all, and the conclusion drawn from it
 * — *"I looked at a split frozen frame and could not see the difference"* — was drawn
 * from a picture in which there was nothing to see. `docs/AGENT-BRIEF.md` §4.1 says read
 * the PNG; it now also has to say **render before you read it**, and prove you did.
 * `PIX` below is that proof: the two crops must differ, and both must differ from the
 * ablated frame.
 *
 * ── WHAT THIS ADDS ─────────────────────────────────────────────────────────────
 *
 *  1. **BOTH STATIONS FOR EVERY CANDIDATE.** Darkening a pale halo is only a fix if it
 *     does not cost the rose tile (rendered luma ~0.48), which is where the projectile
 *     spends most of its life. A candidate is scored on `min(home, cloth)`, never on
 *     the cloth alone — a treatment that trades one background for the other is not a
 *     treatment, it is a relocation of the bug.
 *  2. **A THRESHOLD, NOT A CLAMP.** `p2_bgcross`'s `Math.min(l0, lMax)` cannot express
 *     the fix, because the shipped rule is `Math.max(l0, 0.66)` and a ceiling below
 *     0.66 would drag EVERY weapon down to it — including the dark half the floor
 *     exists to rescue. The rule that can be true of both halves is
 *     **"a halo is the VALUE COUNTERPART of its sculpt, not a copy of it"**: below the
 *     split the weapon is dark and the halo goes light (the shipped floor, untouched);
 *     above it the weapon is its own light source and the halo goes dark. So this
 *     applies `l0 >= split ? target : unchanged`, which leaves a 15-weapon null control
 *     instead of 7.
 *  3. **AIM DIRECTION IS AN ARGUMENT.** `pj_probe` aims `at.x + 320` for all 23
 *     weapons, so every legibility number this project owns describes ONE trajectory.
 *     `--aimDx/--aimDy` fires the same weapon down a different lane; the surface is
 *     still moved under the shot, so the two knobs together separate "what it flies
 *     over" from "which way it flies".
 *
 * ── CONTROLS (an instrument not shown to FAIL on a known input is not an instrument)
 *
 *   N     >= 20 delivered px, or every column is edge pixels.
 *   A     projectile hidden -> the ablation finds 0 px.
 *   SWAP  at the cloth station the background under the shot's own mask must MEASURE
 *         as the cloth (hue within 12 deg, luma within 0.06 of the cloth's own
 *         rendered colour). Without it, a patch that silently failed to move produces
 *         a complete confident answer that reads exactly like a null result.
 *   DIFF  the same claim from the other side: it must no longer measure as `home`.
 *   PAIR  two measurements of one frozen station, identical to 0.000000.
 *   RESTORE  after every retarget the shipped material hexes are byte-identical.
 *   NULL  🚨 THE LOAD-BEARING ONE FOR THIS PASS. Every halo material BELOW the split
 *         must return its station dE **unchanged to four decimals**. A change that
 *         moves all 23 has broken something, and this is what says so.
 *   PIX   the crop with the retargeted halo must NOT be byte-identical to the crop
 *         without it, and neither may equal the ablated crop. This is the known-bad
 *         input for the failure described at the top of this file.
 *
 *   node tools/tmp/hl_sweep.mjs --url $U --chars pizza --weapon Dough --selftest
 *   node tools/tmp/hl_sweep.mjs --url $U --chars pizza,sushi --ls 0.68,0.52,0.40 --shots
 *   node tools/tmp/hl_sweep.mjs --url $U --pitch 20 --detectWidth 150 --chars pizza
 */

import { chromium } from 'playwright';
import { mkdir, writeFile, readFile } from 'node:fs/promises';
import { createHash } from 'node:crypto';
import { resolve } from 'node:path';

const LAUNCH_ARGS = ['--use-gl=angle', '--use-angle=swiftshader', '--enable-unsafe-swiftshader',
  '--enable-webgl', '--ignore-gpu-blocklist', '--disable-gpu-sandbox'];

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
const BASE = String(args.url ?? process.env.PREVIEW_BASE ?? 'http://localhost:5173').replace(/\/$/, '');
const OUT = String(args.out ?? 'shots/hl/sweep');
const W = Number(args.w ?? 1600);
const H = Number(args.h ?? 900);
const RW = Math.round(W / 2);
const RH = Math.round(H / 2);
/** Same 6 as `pj_probe`/`p2_bgcross`, so areas stay comparable to their records. */
const DELTA = Number(args.delta ?? 6);
const SIM_SPEED = String(args.simSpeed ?? '0.35');
const MIN_DIST = Number(args.minDist ?? 26);
/**
 * The HALO lightness above which `retarget` moves a material. **0.53 since 2026-08-11.**
 *
 * ══════════════════════════════════════════════════════════════════════════════
 *  🚨 THE FIX THIS TOOL MEASURED EMPTIED ITS OWN VALIDATOR'S CORPUS, AND THE ROOT
 *     CAUSE IS THAT TWO DIFFERENT QUANTITIES WERE WEARING ONE NUMBER
 * ══════════════════════════════════════════════════════════════════════════════
 *
 * THE OLD WORDING, kept because it was correct on the tree it was written for:
 *
 *   > *"The lightness above which a weapon is treated as ITS OWN LIGHT SOURCE and its
 *   > halo is driven DOWN instead of up. 0.75 is not a round number picked for tidiness:
 *   > the roster is bimodal with a 0.10 gap and nothing in it. Eight halo colours sit at
 *   > 0.829–1.000 (`#FFE9A8` 0.829, `#BFEFFF` 0.874, `#F4E9DA` 0.906, `#FFFFFF` 1.000)
 *   > and the next one down is 0.725 (`#FFD873`), then 0.718, 0.716."*
 *
 * Read that against `retarget` below: the shipped rule (`vfx.ts:haloColorFor`) splits on
 * **the WEAPON's own colour**, and `retarget` splits on **the HALO MATERIAL's colour**.
 * Those were the same number only while the bug was present — a pale weapon's halo *was*
 * its own pale colour, which is the defect. `50c5272` assigned those eight
 * `PROJECTILE_HALO_L_DARK`, so **the coincidence the split relied on is exactly what the
 * fix removed.**
 *
 * Re-measured over all 33 shipped halo colours (every ranged weapon of all 11 characters,
 * `haloColorFor` applied to each sculpt colour):
 *
 *     halo lightnesses present   0.4000 (10)  0.6600 (19)  0.6686  0.7157  0.7176  0.7255
 *     --split 0.75  ->  0 of 33 above ... PIX never sees a moved halo -> INSTRUMENT INVALID
 *     --split 0.70  ->  3 of 33 above
 *     --split 0.53  -> 23 of 33 above, 10 below   <- the only gap in the set, 0.40 -> 0.66
 *
 * So the corpus is NOT gone; the DEFAULT stopped partitioning it. 0.53 is the midpoint of
 * the one gap the shipped palette has, and it is insensitive over 0.41–0.65 — the same
 * property the old paragraph claimed for 0.75, re-derived on today's palette.
 *
 * ⚠️ **This is a re-aim, not a loosening.** At 0.75 the `PIX` control was VACUOUS — it
 * asserted nothing on any weapon. At 0.53 it is exercised on 23 of 33. Strictly more of
 * the instrument runs, and the selftest now *names the number* when the corpus stops
 * straddling the split instead of reporting a bare INVALID.
 */
const SPLIT = Number(args.split ?? 0.53);
const LS = String(args.ls ?? '0.68,0.60,0.52,0.46,0.40,0.34').split(',').map(Number).filter((x) => x > 0);
/** Which candidate gets photographed. Defaults to the darkest asked for. */
const SHOT_L = Number(args.shotL ?? LS[LS.length - 1]);
const SHOTS = !!args.shots;
const PITCH = Number(args.pitch ?? 58);
/** Visible world width for the shallow LOBBY-ANALOGUE detector. Only read when PITCH != 58. */
const DETECT_WIDTH = Number(args.detectWidth ?? 150);
const AIM_DX = Number(args.aimDx ?? 320);
const AIM_DY = Number(args.aimDy ?? 0);
/** Half-width of the photographed crop, in full-resolution page px. */
const CROP = Number(args.crop ?? 150);
const SELF = new URL(import.meta.url).pathname.split('/').pop();

// 🚨 THE SERVED TREE, NOT THIS ONE. `with_snapshot`/`sx_snap` copy the repo, serve the
// copy, and export `SNAPSHOT_DIR`; every tool here then parsed `rules.ts` out of its OWN
// checkout and labelled the run with it. On 2026-08-19 that printed `soup.Splash #E8792A`
// while measuring a worktree where the weapon is `#CC9F0D` — the NUMBERS were of the
// served tree and the LABEL was of another, which is the worst way for an A/B to be wrong,
// because both halves look right in isolation. Prefer the snapshot; print which won.
const LOCAL_REPO = resolve(new URL('../..', import.meta.url).pathname);
const REPO = process.env.SNAPSHOT_DIR
  ? resolve(process.env.SNAPSHOT_DIR)
  : LOCAL_REPO;
if (REPO !== LOCAL_REPO) console.log(`[${SELF}] parsing rules.ts from the SERVED tree: ${REPO}`);

const log = (...a) => console.log(...a);
const pad = (s, n) => String(s).padEnd(n);
const md5 = (buf) => createHash('md5').update(buf).digest('hex').slice(0, 12);

/** sRGB HSL lightness of a `#rrggbb`, the same way `retarget` computes it page-side. */
function lightnessOf(hex) {
  const n = parseInt(String(hex).replace('#', ''), 16);
  if (!Number.isFinite(n)) return NaN;
  const r = ((n >> 16) & 255) / 255, g = ((n >> 8) & 255) / 255, b = (n & 255) / 255;
  return (Math.max(r, g, b) + Math.min(r, g, b)) / 2;
}

/**
 * The widest gap in a set of halo lightnesses, and its midpoint.
 *
 * 🚨 This is the answer to "my corpus does not straddle the split" — the question that cost
 * this file a full INVALID run on 2026-08-11 and had to be diagnosed by hand from
 * `rules.ts`. `null` means the palette has collapsed to ONE lightness, and then no split
 * partitions it and INVALID is the honest verdict rather than a fixable default.
 */
function widestGap(lightnesses) {
  const d = [...new Set(lightnesses.filter(Number.isFinite).map((x) => +x.toFixed(4)))].sort((a, b) => a - b);
  if (d.length < 2) return null;
  let best = null;
  for (let i = 1; i < d.length; i++) {
    const gap = +(d[i] - d[i - 1]).toFixed(4);
    if (!best || gap > best.gap) best = { gap, lo: d[i - 1], hi: d[i], mid: +(((d[i - 1] + d[i]) / 2).toFixed(4)) };
  }
  return { ...best, distinct: d };
}

/** `rules.ts` parsed, not imported — same reason `pj_probe` gives: it is TypeScript. */
async function rangedWeapons() {
  const src = await readFile(resolve(REPO, 'src/game/rules.ts'), 'utf8');
  const out = new Map();
  // 🚨 `defineCharacter(` IS NOT OPTIONAL SUGAR HERE — IT IS WHY THIS TOOL MEASURED
  // NOTHING FOR A WEEK. On 2026-08-12 (`9cb34ab`) the roster changed from `soup: {` to
  // `soup: defineCharacter({`. The old pattern `/^ {2}(\w+): \{$/gm` then matched SIX
  // blocks, none of them a character and none carrying `weapons: [`, so the table came
  // back EMPTY and every per-character loop below iterated zero times — silently, at
  // exit 0. Accept both spellings, because the next refactor will invent a third.
  const charRe = /^ {2}(\w+): (?:\w+\()?\{$/gm;
  const chars = [];
  let m;
  while ((m = charRe.exec(src))) chars.push({ id: m[1], at: m.index });
  for (let i = 0; i < chars.length; i++) {
    const body = src.slice(chars[i].at, i + 1 < chars.length ? chars[i + 1].at : src.length);
    const wStart = body.indexOf('weapons: [');
    if (wStart < 0) continue;
    const weapons = [];
    const keyRe = /key: '([^']+)',\s*name: '([^']+)',\s*type: '(\w+)'/g;
    const seg = body.slice(wStart);
    let k;
    while ((k = keyRe.exec(seg))) {
      const after = seg.slice(k.index, k.index + 700);
      const c = /color: '(#[0-9A-Fa-f]{6})'/.exec(after);
      weapons.push({ key: k[1], name: k[2], type: k[3], color: c ? c[1].toUpperCase() : null });
      if (weapons.length >= 4) break;
    }
    if (weapons.length) out.set(chars[i].id, weapons);
  }
  // ── 🚨 A PARSE THAT FINDS NOTHING MUST THROW, NOT RETURN EMPTY ────────────────
  // The comment at the top of this function guards against a STALE weapon table —
  // "exactly how a probe measures a game that no longer exists". It had no guard
  // against an ABSENT one, which is the same failure with none of the symptoms:
  // `for (const x of [])` runs zero times and `[].every()` returns TRUE, so an empty
  // table reads as a clean pass in every consumer. That is `CLAUDE.md` rule 6's
  // vacuity class, and it took out THREE tools at once (`pj_probe`, `p2_bgcross`,
  // `hl_sweep`) because they share this parser by copy.
  //
  // The cross-check is INDEPENDENT of the regex above on purpose: `weapons: [` is
  // counted straight out of the source, so a regex that silently stops matching
  // cannot also silently move the expectation. Assert NON-EMPTY first, then equal —
  // an equality check alone would pass 0 === 0 if the file were ever unreadable.
  const expected = (src.match(/weapons: \[/g) ?? []).length;
  if (out.size === 0) {
    throw new Error(
      `${SELF}: parsed ZERO characters out of src/game/rules.ts (expected ${expected}). ` +
      'The roster spelling has changed under this regex. Refusing to run: an empty table ' +
      'makes every check below pass vacuously. Fix `charRe`, do not delete this guard.');
  }
  if (out.size !== expected) {
    throw new Error(
      `${SELF}: parsed ${out.size} characters but rules.ts has ${expected} \`weapons: [\` ` +
      'blocks. A character is being silently dropped.');
  }
  return out;
}

async function boot(page) {
  page.setDefaultTimeout(180000);
  page.on('pageerror', (e) => log('PAGEERROR:', String(e)));
  page.on('console', (m) => { if (m.type() === 'error') log('CONSOLE error:', m.text()); });
  await page.route('**/@vite/client*', (r) => r.fulfill({
    status: 200, contentType: 'text/javascript',
    body: `const noop=()=>{};
export const createHotContext=()=>({accept:noop,acceptExports:noop,dispose:noop,prune:noop,
  invalidate:noop,on:noop,off:noop,send:noop,decline:noop,data:{}});
export const injectQuery=(u)=>u; export const updateStyle=noop; export const removeStyle=noop;
export const ErrorOverlay=class{}; export default {};`,
  }));
  await page.addInitScript(() => {
    const realNow = performance.now.bind(performance);
    let paused = false; let virt = 0; let base = realNow();
    performance.now = () => (paused ? virt : realNow() - base);
    window.__clk = {
      pause() { if (!paused) { virt = realNow() - base; paused = true; } },
      resume() { if (paused) { base = realNow() - virt; paused = false; } },
    };
    const rafReal = window.requestAnimationFrame.bind(window);
    let held = null;
    window.requestAnimationFrame = (cb) => {
      if (held !== null) { held = cb; return -1; }
      return rafReal(cb);
    };
    window.__raf = {
      stop() { if (held === null) held = false; },
      start() { const cb = held; held = null; if (typeof cb === 'function') rafReal(cb); },
    };
  });
}

/* eslint-disable */
async function installHarness(page) {
  await page.evaluate(([rw, rh, delta, fullW]) => {
    const stage = window.__stage;
    const cv = document.createElement('canvas');
    cv.width = rw; cv.height = rh;
    const c2d = cv.getContext('2d', { willReadFrequently: true });
    const SCALE = fullW / rw;

    const stillCamera = () => {
      const rig = stage.rig;
      if (!rig) return;
      rig.shakeAmount = 0;
      if (rig.shakeOffset && rig.shakeOffset.set) rig.shakeOffset.set(0, 0, 0);
    };
    const grab = () => {
      stillCamera();
      stage.render(0);
      c2d.clearRect(0, 0, rw, rh);
      c2d.drawImage(stage.canvas, 0, 0, rw, rh);
      return c2d.getImageData(0, 0, rw, rh).data;
    };

    const hsl = (r, g, b) => {
      r /= 255; g /= 255; b /= 255;
      const mx = Math.max(r, g, b), mn = Math.min(r, g, b), d = mx - mn;
      let h = 0;
      if (d > 1e-6) {
        if (mx === r) h = ((g - b) / d) % 6;
        else if (mx === g) h = (b - r) / d + 2;
        else h = (r - g) / d + 4;
        h *= 60; if (h < 0) h += 360;
      }
      const l = (mx + mn) / 2;
      const s = d < 1e-6 ? 0 : d / (1 - Math.abs(2 * l - 1));
      return [h, s, l];
    };
    const oklab = (r, g, b) => {
      const lin = (c) => { c /= 255; return c <= 0.04045 ? c / 12.92 : Math.pow((c + 0.055) / 1.055, 2.4); };
      const R = lin(r), G = lin(g), B = lin(b);
      const l = Math.cbrt(0.4122214708 * R + 0.5363325363 * G + 0.0514459929 * B);
      const m = Math.cbrt(0.2119034982 * R + 0.6806995451 * G + 0.1073969566 * B);
      const s = Math.cbrt(0.0883024619 * R + 0.2817188376 * G + 0.6299787005 * B);
      return [
        0.2104542553 * l + 0.7936177850 * m - 0.0040720468 * s,
        1.9779984951 * l - 0.2428592205 * m + 0.4505937099 * s,
        0.0259040371 * l + 0.7827717662 * m - 0.8086757660 * s,
      ];
    };
    const stats = (img, idx) => {
      let sx = 0, sy = 0, ssum = 0, lsum = 0;
      for (const p of idx) {
        const i = p * 4;
        const [h, s, l] = hsl(img[i], img[i + 1], img[i + 2]);
        const a = (h * Math.PI) / 180;
        sx += Math.cos(a) * s; sy += Math.sin(a) * s;
        ssum += s; lsum += l;
      }
      const n = idx.length || 1;
      let hm = (Math.atan2(sy, sx) * 180) / Math.PI; if (hm < 0) hm += 360;
      return { n: idx.length, hue: +hm.toFixed(1), sat: +(ssum / n).toFixed(3), luma: +(lsum / n).toFixed(4) };
    };
    const maskOf = (a, b) => {
      const idx = [];
      for (let i = 0, p = 0; i < a.length; i += 4, p++) {
        const d = Math.max(Math.abs(a[i] - b[i]), Math.abs(a[i + 1] - b[i + 1]), Math.abs(a[i + 2] - b[i + 2]));
        if (d >= delta) idx.push(p);
      }
      return idx;
    };
    const toSet = (idx) => { const s = new Uint8Array(rw * rh); for (const p of idx) s[p] = 1; return s; };

    const localDelta = (imgOn, imgOff, idx) => {
      const inSet = toSet(idx);
      const R = 5;
      const lVals = [], eVals = [];
      for (const p of idx) {
        const x = p % rw, y = (p / rw) | 0;
        let sr = 0, sg = 0, sb = 0, n = 0;
        for (let dy = -R; dy <= R; dy++) {
          const yy = y + dy; if (yy < 0 || yy >= rh) continue;
          for (let dx = -R; dx <= R; dx++) {
            const xx = x + dx; if (xx < 0 || xx >= rw) continue;
            const q = yy * rw + xx;
            if (inSet[q]) continue;
            const j = q * 4;
            sr += imgOff[j]; sg += imgOff[j + 1]; sb += imgOff[j + 2]; n++;
          }
        }
        if (!n) continue;
        const i = p * 4;
        const a = oklab(imgOn[i], imgOn[i + 1], imgOn[i + 2]);
        const b = oklab(sr / n, sg / n, sb / n);
        eVals.push(Math.hypot(a[0] - b[0], a[1] - b[1], a[2] - b[2]));
        lVals.push(Math.abs(hsl(imgOn[i], imgOn[i + 1], imgOn[i + 2])[2] - hsl(sr / n, sg / n, sb / n)[2]));
      }
      if (!eVals.length) return { mean: 0, p90: 0, deMean: 0, deP90: 0, deMed: 0 };
      const q = (arr, f) => { const s = [...arr].sort((a, b) => a - b); return s[Math.min(s.length - 1, Math.floor(s.length * f))]; };
      const avg = (arr) => arr.reduce((a, b) => a + b, 0) / arr.length;
      return {
        mean: +avg(lVals).toFixed(4), p90: +q(lVals, 0.9).toFixed(4),
        deMean: +avg(eVals).toFixed(4), deP90: +q(eVals, 0.9).toFixed(4), deMed: +q(eVals, 0.5).toFixed(4),
      };
    };

    const projRoots = () => {
      const layer = window.__vfxLayer;
      if (!layer || !layer.projectilePool) return [];
      const out = [...layer.projectilePool.values()].filter((o) => o.visible);
      const seen = new Set(out);
      let layerRoot = null;
      stage.scene.traverse((o) => { if (o.name === 'vfx_layer') layerRoot = o; });
      if (layerRoot) {
        layerRoot.traverse((o) => {
          if (typeof o.name === 'string' && o.name.startsWith('projectile') && o.visible && !seen.has(o)) {
            if (!seen.has(o.parent) && (!o.parent || !String(o.parent.name || '').startsWith('projectile'))) {
              seen.add(o); out.push(o);
            }
          }
        });
      }
      return out;
    };
    const sculptRoots = () => projRoots().filter((o) => !String(o.name || '').startsWith('projectile_shell'));

    /** Every distinct halo SpriteMaterial currently in the air, by uuid. */
    const haloMats = () => {
      const mats = [];
      const seen = new Set();
      for (const root of projRoots()) {
        root.traverse((o) => {
          if (!o.isSprite || !String(o.name || '').startsWith('projectile_halo')) return;
          const m = o.material;
          if (m && m.color && !seen.has(m.uuid)) { seen.add(m.uuid); mats.push(m); }
        });
      }
      return mats;
    };

    const coreOf = (roots) => {
      if (!roots.length) return { n: 0 };
      const on = grab();
      for (const o of roots) o.visible = false;
      const off = grab();
      for (const o of roots) o.visible = true;
      const idx = maskOf(on, off);
      if (!idx.length) return { n: 0 };
      const proj = stats(on, idx);
      const bg = stats(off, idx);
      const lc = localDelta(on, off, idx);
      let x0 = 1e9, y0 = 1e9, x1 = -1e9, y1 = -1e9;
      for (const p of idx) {
        const x = p % rw, y = (p / rw) | 0;
        if (x < x0) x0 = x; if (x > x1) x1 = x;
        if (y < y0) y0 = y; if (y > y1) y1 = y;
      }
      return {
        n: idx.length, proj, bg,
        dL: +Math.abs(proj.luma - bg.luma).toFixed(4),
        dHue: +(() => { const d = Math.abs(proj.hue - bg.hue) % 360; return d > 180 ? 360 - d : d; })().toFixed(1),
        deMean: lc.deMean, deP90: lc.deP90, deMed: lc.deMed, contrastP90: lc.p90,
        box: { x: Math.round(((x0 + x1) / 2) * SCALE), y: Math.round(((y0 + y1) / 2) * SCALE) },
      };
    };

    const concealGroups = () => {
      const out = [];
      stage.scene.traverse((o) => { if (typeof o.name === 'string' && o.name.startsWith('conceal:')) out.push(o); });
      return out;
    };

    let moved = null;
    let held = null;   // halo materials saved while a retargeted frame is on screen

    /**
     * The halo colour transform under test, applied to LIVE materials.
     *
     * ⚠️ A THRESHOLD, NOT A CLAMP, and the difference is the whole null control.
     * `Math.min(l, target)` with a target below the shipped 0.66 floor would drag every
     * halo in the game down to it. This touches a material only if its OWN lightness is
     * at or above `split`, so every weapon the shipped floor rescued is provably
     * untouched — `NULL` asserts that from the pixels rather than from this comment.
     *
     * ⚠️ Read and written as sRGB hex, never through `THREE.Color.getHSL`: three
     * converts a hex to LINEAR sRGB on construction, and `vfx.ts:haloColorFor` records
     * at length that mixing the two spaces is how a measured threshold quietly stops
     * being the thing that was measured.
     * ⚠️ Saved per MATERIAL uuid: one material per weapon COLOUR is shared by every
     * pellet of a volley, so a per-sprite save reads back the previous sprite's write.
     */
    const retarget = (split, target) => {
      const mats = haloMats();
      if (!mats.length) return null;
      const saved = mats.map((m) => ({ m, hex: m.color.getHexString() }));
      const moves = [];
      for (const s of saved) {
        const n = parseInt(s.hex, 16);
        const r = ((n >> 16) & 255) / 255, g = ((n >> 8) & 255) / 255, b = (n & 255) / 255;
        const mx = Math.max(r, g, b), mn = Math.min(r, g, b), d = mx - mn;
        let h = 0;
        if (d > 1e-6) {
          if (mx === r) h = ((g - b) / d) % 6;
          else if (mx === g) h = (b - r) / d + 2;
          else h = (r - g) / d + 4;
          h *= 60; if (h < 0) h += 360;
        }
        const l0 = (mx + mn) / 2;
        const s0 = d < 1e-6 ? 0 : d / (1 - Math.abs(2 * l0 - 1));
        if (l0 < split) { moves.push({ from: '#' + s.hex, to: '#' + s.hex, l0: +l0.toFixed(4), moved: false }); continue; }
        const l = target;
        const c = (1 - Math.abs(2 * l - 1)) * s0;
        const x = c * (1 - Math.abs(((h / 60) % 2) - 1));
        const o = l - c / 2;
        let rr = 0, gg = 0, bb = 0;
        if (h < 60) { rr = c; gg = x; } else if (h < 120) { rr = x; gg = c; }
        else if (h < 180) { gg = c; bb = x; } else if (h < 240) { gg = x; bb = c; }
        else if (h < 300) { rr = x; bb = c; } else { rr = c; bb = x; }
        const to = (v) => Math.round((v + o) * 255).toString(16).padStart(2, '0');
        const hex = '#' + to(rr) + to(gg) + to(bb);
        moves.push({ from: '#' + s.hex, to: hex, l0: +l0.toFixed(4), l: +l.toFixed(4), moved: true });
        s.m.color.set(hex);
      }
      return { saved, moves };
    };
    const putBack = (saved) => {
      for (const s of saved) s.m.color.set('#' + s.hex);
      return saved.every((s) => s.m.color.getHexString() === s.hex);
    };

    window.__hl = {
      census() {
        const roots = projRoots();
        const f = window.__vfxDebugFighters && window.__vfxDebugFighters.player;
        return {
          roots: roots.length,
          names: roots.map((o) => o.name || '(unnamed)'),
          conceal: concealGroups().map((o) => o.name),
          haloHex: haloMats().map((m) => '#' + m.color.getHexString()),
          distUnits: roots.map((o) => {
            if (!f) return null;
            const dx = o.position.x / 0.05 - f.x, dz = o.position.z / 0.05 - f.y;
            return +Math.sqrt(dx * dx + dz * dz).toFixed(1);
          }),
        };
      },
      measure() { return coreOf(projRoots()); },
      controlHidden() {
        const roots = projRoots();
        for (const o of roots) o.visible = false;
        const r = coreOf(projRoots());
        for (const o of roots) o.visible = true;
        return r;
      },
      backgroundUnder() {
        const roots = projRoots();
        if (!roots.length) return null;
        const on = grab();
        for (const o of roots) o.visible = false;
        const off = grab();
        const idx = maskOf(on, off);
        const s = idx.length ? stats(off, idx) : null;
        for (const o of roots) o.visible = true;
        return s;
      },
      /**
       * ONE CANDIDATE, MEASURED AND PUT BACK.
       *
       * Returns the measurement AND the per-material moves, so `NULL` can be asserted
       * on the materials that did not move rather than inferred from the aggregate.
       */
      probe(split, target) {
        const rt = retarget(split, target);
        if (!rt) return null;
        const after = coreOf(projRoots());
        const restored = putBack(rt.saved);
        return { target, moves: rt.moves, ...after, restoredSame: restored };
      },
      /** Hold a retargeted state so the caller can photograph it. */
      hold(split, target) {
        if (held) return { ok: false, why: 'already held' };
        const rt = retarget(split, target);
        if (!rt) return { ok: false, why: 'no halo materials' };
        held = rt.saved;
        return { ok: true, moves: rt.moves };
      },
      release() {
        if (!held) return { ok: false, why: 'nothing held' };
        const same = putBack(held);
        held = null;
        return { ok: true, restoredSame: same };
      },
      /**
       * 🚨 RENDER WITH THE PROJECTILE VISIBLE, THEN AND ONLY THEN SCREENSHOT.
       *
       * The failure this whole file exists to correct: `coreOf`'s final `grab()` draws
       * the ABLATED frame, and restoring `visible` does not redraw. Every screenshot
       * taken after an ablation is therefore a picture with no projectile in it, and
       * two such pictures are byte-identical however different the projectile was.
       */
      draw() { stillCamera(); stage.render(0); },
      /** Same, with the projectile deliberately absent — the known-bad for `PIX`. */
      drawAblated() {
        const roots = projRoots();
        for (const o of roots) o.visible = false;
        stillCamera(); stage.render(0);
        for (const o of roots) o.visible = true;
      },
      moveClothUnderProjectile() {
        if (moved) return { ok: false, why: 'a group is already moved' };
        const roots = sculptRoots().length ? sculptRoots() : projRoots();
        if (!roots.length) return { ok: false, why: 'no live projectile' };
        const groups = concealGroups();
        if (!groups.length) return { ok: false, why: 'this arena declares no concealment' };
        const at = roots[0].getWorldPosition(new roots[0].position.constructor());
        let best = null, bestD = Infinity;
        for (const g of groups) {
          const p = g.getWorldPosition(new g.position.constructor());
          const d = Math.hypot(p.x - at.x, p.z - at.z);
          if (d < bestD) { bestD = d; best = g; }
        }
        const before = best.getWorldPosition(new best.position.constructor());
        const saved = { x: best.position.x, y: best.position.y, z: best.position.z };
        const local = best.parent
          ? best.parent.worldToLocal(new best.position.constructor(at.x, before.y, at.z))
          : { x: at.x, y: before.y, z: at.z };
        best.position.set(local.x, local.y, local.z);
        best.updateMatrixWorld(true);
        moved = { obj: best, saved };
        return { ok: true, name: best.name, distanceM: +bestD.toFixed(2) };
      },
      restoreCloth() {
        if (!moved) return { ok: false, why: 'nothing moved' };
        moved.obj.position.set(moved.saved.x, moved.saved.y, moved.saved.z);
        moved.obj.updateMatrixWorld(true);
        moved = null;
        return { ok: true };
      },
      clothColor() {
        if (!moved) return null;
        const on = grab();
        moved.obj.visible = false;
        const off = grab();
        moved.obj.visible = true;
        const idx = maskOf(on, off);
        if (idx.length < 200) return null;
        return { ...stats(on, idx), px: idx.length };
      },
      /**
       * PER-FRAME COST, READ OFF THE SAME FROZEN MID-FLIGHT FRAME.
       *
       * 🚨 `tools/perf.mjs --mode counts --scene match-vfx` CANNOT PRICE THIS. Its
       * scene is `player=lollipop`, the one character with no ranged weapon at all, so
       * both arms sample a frame containing ZERO projectiles and return byte-identical
       * counts — a true and useless answer that prices the change where it costs
       * nothing by construction.
       *
       * ⚠️ `info.autoReset` is TRUE by default and three resets at the START of every
       * `renderer.render()`. The post chain is three passes, so a naive read after
       * `stage.render()` returns the LAST pass alone (1 draw, 1 triangle) and looks
       * like an empty scene.
       */
      counts() {
        const r0 = stage.renderer;
        const prevAuto = r0.info.autoReset;
        r0.info.autoReset = false;
        r0.info.reset();
        stillCamera();
        stage.render(0);
        const info = r0.info;
        const out = {
          liveProjectiles: projRoots().length,
          calls: info.render.calls, triangles: info.render.triangles,
          programs: r0.info.programs ? r0.info.programs.length : -1,
          geometries: info.memory.geometries, textures: info.memory.textures,
        };
        r0.info.autoReset = prevAuto;
        return out;
      },
      /** Re-pitch the shipped match rig — `pj_probe`'s LOBBY-ANALOGUE detector. */
      setPitch(deg, widthUnits) {
        const rig = stage.rig;
        if (!rig) return null;
        const saved = { pitch: rig.pitchDeg, mode: rig.frameMode, width: rig.viewWidthUnits };
        rig.pitchDeg = deg;
        if (deg !== 58) { rig.frameMode = 'ground'; rig.viewWidthUnits = widthUnits; }
        rig.apply();
        return saved;
      },
    };
  }, [RW, RH, DELTA, W]);
}
/* eslint-enable */

async function poll(page, fn, ms = 4000, every = 60) {
  const t0 = Date.now();
  let last = null;
  while (Date.now() - t0 < ms) {
    last = await page.evaluate(fn);
    if (last) return last;
    await page.waitForTimeout(every);
  }
  return last;
}

async function selectWeapon(page, slot) {
  for (let tries = 0; tries < 4; tries++) {
    await page.keyboard.press(String(slot));
    const ok = await poll(page, `window.__matchDebug && window.__matchDebug.selectedWeapon === ${slot - 1}`, 1500);
    if (ok) return true;
  }
  return false;
}

const DIST_EXPR = `(() => { const l = window.__vfxLayer, f = window.__vfxDebugFighters && window.__vfxDebugFighters.player;
  if (!l || !f || !l.projectilePool.size) return -1;
  const o = [...l.projectilePool.values()][0];
  return Math.hypot(o.position.x / 0.05 - f.x, o.position.z / 0.05 - f.y); })()`;

async function fireAndFreeze(page) {
  await poll(page, 'window.__vfxLayer && window.__vfxLayer.projectilePool.size === 0', 15000, 120);
  const at = await page.evaluate(() => (window.__vfxDebugScreen && window.__vfxDebugScreen.player) || null);
  if (!at) return { ok: false, why: 'no __vfxDebugScreen.player' };
  await page.mouse.move(
    Math.max(4, Math.min(W - 4, Math.round(at.x + AIM_DX))),
    Math.max(4, Math.min(H - 4, Math.round(at.y + AIM_DY))),
  );
  await page.mouse.down();
  await poll(page, 'window.__matchDebug && window.__matchDebug.attack === true', 4000);
  const spawned = await poll(page, 'window.__vfxLayer && window.__vfxLayer.projectilePool.size > 0', 6000);
  await page.mouse.up();
  if (!spawned) return { ok: false, why: 'pool never non-empty' };
  const cleared = await poll(page, `(${DIST_EXPR}) > ${MIN_DIST}`, 9000, 40);
  if (!cleared) return { ok: false, why: `never cleared ${MIN_DIST} wu before expiring` };
  await page.evaluate(() => { window.__clk.pause(); window.__raf.stop(); });
  await page.waitForTimeout(60);
  await page.evaluate(() => { window.__hl.draw(); window.__hl.draw(); });
  return { ok: true };
}

/** Photograph a crop centred on the projectile — full-res page px, so it is readable. */
async function crop(page, path, centre) {
  const x = Math.max(0, Math.min(W - 2 * CROP, Math.round(centre.x - CROP)));
  const y = Math.max(0, Math.min(H - 2 * CROP, Math.round(centre.y - CROP)));
  return page.screenshot({ path, clip: { x, y, width: 2 * CROP, height: 2 * CROP } });
}

const hueDist = (a, b) => { const d = Math.abs(a - b) % 360; return d > 180 ? 360 - d : d; };

/**
 * ── SWAP, AS A DISCRIMINATIVE TEST. THE ABSOLUTE ONE WAS MEASURING TWO DIFFERENT
 *    QUANTITIES AND CALLING THEM ONE. ─────────────────────────────────────────────
 *
 * WAS:
 *   SWAP: !!(cloth && cloth.bg && clothColor
 *     && hueDist(cloth.bg.hue, clothColor.hue) < 12
 *     && Math.abs(cloth.bg.luma - clothColor.luma) < 0.06),
 *
 * 🚨 **12 of 22 FAIL, AND 11 OF THE 12 FAIL ON THE LUMA ARM ALONE, ALL WITH THE SAME
 * SIGN.** Re-read off the completed 23-weapon run (`shots/hl/sweep/hl_sweep.p58.json`,
 * 2.9 h on a snapshot of `af35362`):
 *
 *   * hue passes on **22 of 23** — worst 4.3° against a 12° tolerance;
 *   * `bg.luma − clothColor.luma` is **positive on 21 of 23**, spread **+0.029 … +0.074**,
 *     median +0.047. It is ONE continuous population and the 0.06 threshold cuts through
 *     the middle of it. Rows landed either side by as little as 0.001.
 *
 * The cause is that the two numbers are not comparable: `cloth.bg.luma` is measured off
 * the **rendered frame** — lit, tone-mapped, with the rim term — while `clothColor()`
 * returns the **material's own colour**. A lit surface reads brighter than its base
 * colour, by an amount that depends on how much of the patch the mask happens to cover.
 * The old test therefore asked "is the render equal to the material?", which is false by
 * construction, and its threshold was a bias-bracket rather than a decision boundary.
 *
 * ⚠️ **AND IT WAS NEVER TESTING WHAT ITS OWN DOC SAYS IT TESTS** — *"a patch that silently
 * failed to move produces a complete confident answer"*. That is a question about WHICH of
 * two known surfaces the background is, and the answer to it is a **nearest-match**, not a
 * tolerance: the background must be closer to the cloth than to `home`. Both candidates
 * are then measured through the same rendered pipeline, so the lit-surface offset cancels
 * instead of being budgeted for.
 *
 * Replayed over the same 23 recorded rows (`--replay`, which is how this claim is checked
 * without spending 2.9 h of browser): **12 fail → 1**, and the margin stops being marginal
 * — the tightest passing row is **7.0×** and the one remaining failure is 3.1× the other
 * way with a 23.6° hue error. A threshold that separated its population by 0.001 now
 * separates it by a factor of seven.
 *
 * 🔴 **THE SURVIVOR IS REAL AND IS NOT WAVED THROUGH: `waterbottle.Cap`.** dHue **23.6°**,
 * and it is the only sizeable NEGATIVE luma delta (−0.0845) — the opposite sign from every
 * other row, so it is not the bias this fix removes. Its own numbers say why: `dist` is
 * **104.5 wu** against 28.4 for the next weapon and it flies **4 live pellets**, while the
 * patch it is moved onto is a 130 wu `plate_stack`. The mask overruns the patch and part
 * of it samples floor. That is a COVERAGE defect in the harness, not in the fix, and
 * closing it needs a browser run to verify — so it is left red and named.
 *
 * `axisScale` normalises each axis by its own historical tolerance so hue and luma are
 * comparable, and the two constants are the very ones the old test used.
 */
const HUE_TOL = 12, LUMA_TOL = 0.06;
const colourDist = (bg, ref) =>
  Math.hypot(hueDist(bg.hue, ref.hue) / HUE_TOL, (bg.luma - ref.luma) / LUMA_TOL);

/**
 * @returns {{ok: boolean, why: string}} — `why` is printed on failure, because "FAIL" on
 * a control that has been wrong once already is not a useful thing to hand the next agent.
 */
export function swapControl(clothBg, clothColor, homeBg) {
  if (!clothBg || !clothColor || !homeBg) return { ok: false, why: 'no cloth station measured' };
  const hue = hueDist(clothBg.hue, clothColor.hue);
  if (hue >= HUE_TOL) return { ok: false, why: `bg hue ${clothBg.hue.toFixed(1)}° is ${hue.toFixed(1)}° from the cloth's ${clothColor.hue.toFixed(1)}° (tol ${HUE_TOL}°)` };
  const dc = colourDist(clothBg, clothColor), dh = colourDist(clothBg, homeBg);
  if (!(dc < dh)) return { ok: false, why: `bg is nearer HOME than the cloth (d_cloth ${dc.toFixed(2)} vs d_home ${dh.toFixed(2)}) — the patch did not take` };
  return { ok: true, why: `d_cloth ${dc.toFixed(2)} vs d_home ${dh.toFixed(2)} — ${(dh / dc).toFixed(1)}× nearer the cloth` };
}

/** One station: baseline + every candidate + the pictures. */
async function station(page, tag, ctx) {
  const base = await page.evaluate(() => window.__hl.measure());
  const pair = await page.evaluate(() => window.__hl.measure());
  const bg = await page.evaluate(() => window.__hl.backgroundUnder());
  const hidden = await page.evaluate(() => window.__hl.controlHidden());
  const cands = [];
  for (const L of LS) {
    const r = await page.evaluate(([s, t]) => window.__hl.probe(s, t), [SPLIT, L]);
    if (r) cands.push(r);
  }
  const pics = {};
  if (SHOTS && base.box) {
    await page.evaluate(() => window.__hl.draw());
    await crop(page, `${ctx.dir}/${ctx.name}.${tag}.base.png`, base.box);
    const h = await page.evaluate(([s, t]) => window.__hl.hold(s, t), [SPLIT, SHOT_L]);
    await page.evaluate(() => window.__hl.draw());
    await crop(page, `${ctx.dir}/${ctx.name}.${tag}.L${SHOT_L}.png`, base.box);
    const rel = await page.evaluate(() => window.__hl.release());
    await page.evaluate(() => window.__hl.drawAblated());
    await crop(page, `${ctx.dir}/${ctx.name}.${tag}.ablated.png`, base.box);
    // Put the canvas back to a truthful frame before anything else looks at it.
    await page.evaluate(() => window.__hl.draw());
    pics.held = h.ok;
    pics.released = rel.ok && rel.restoredSame;
  }
  return { base, pair, bg, hidden, cands, pics };
}

async function runWeapon(page, charId, w, dir) {
  const fired = await fireAndFreeze(page);
  if (!fired.ok) return { char: charId, weapon: w.key, color: w.color, error: fired.why };
  const census = await page.evaluate(() => window.__hl.census());
  const counts = await page.evaluate(() => window.__hl.counts());
  // The DISCARDED settling frame — `p2_bgcross` records why: the first ablation after
  // a freeze is a post-chain transient, and the honest fix is to throw it away rather
  // than to widen the tolerance PAIR is allowed.
  const settle = await page.evaluate(() => { window.__hl.draw(); window.__hl.draw(); return window.__hl.measure(); });

  const name = `${charId}.${w.key}`;
  const home = await station(page, 'home', { dir, name });

  const mv = await page.evaluate(() => window.__hl.moveClothUnderProjectile());
  let clothColor = null, cloth = null;
  if (mv.ok) {
    clothColor = await page.evaluate(() => window.__hl.clothColor());
    cloth = await station(page, 'cloth', { dir, name });
  }
  await page.evaluate(() => window.__hl.restoreCloth());
  const homeAgain = await page.evaluate(() => window.__hl.measure());
  await page.evaluate(() => { window.__raf.start(); window.__clk.resume(); });

  const nullRows = [];
  for (const st of [home, cloth]) {
    if (!st) continue;
    for (const c of st.cands) {
      if (c.moves.every((m) => !m.moved)) nullRows.push({ target: c.target, deMed: c.deMed, base: st.base.deMed });
    }
  }
  const controls = {
    N: home.base.n >= 20,
    A: home.hidden.n === 0 && (!cloth || cloth.hidden.n === 0),
    SWAP: swapControl(cloth?.bg, clothColor, home.bg).ok,
    DIFF: !!(cloth && cloth.bg && home.bg
      && (hueDist(cloth.bg.hue, home.bg.hue) > 8 || Math.abs(cloth.bg.luma - home.bg.luma) > 0.05)),
    PAIR: home.base.n >= 20 && home.pair.n === home.base.n && home.pair.deMed === home.base.deMed,
    // Every candidate AND every photographed hold must put the shipped material hexes
    // back byte-identically. These are module-scope singletons shared by every pellet of
    // every volley of that colour for the life of the page — a failed restore silently
    // repaints the game, and the NEXT station's baseline would be measured through it.
    RESTORE: home.base.n >= 20 && homeAgain.n === home.base.n && homeAgain.deMed === home.base.deMed
      && [home, cloth].filter(Boolean).every((st) => st.cands.every((c) => c.restoredSame === true))
      && [home, cloth].filter(Boolean).every((st) => st.pics.released !== false),
    // Every candidate that moved NOTHING must return the station's own dE bit-for-bit.
    NULL: nullRows.every((r) => r.deMed === r.base),
    PIX: true,   // filled in by the caller from the file hashes
  };
  return {
    char: charId, weapon: w.key, name: w.name, color: w.color,
    pitch: PITCH, aim: { dx: AIM_DX, dy: AIM_DY }, split: SPLIT,
    dist: census.distUnits[0], haloHex: census.haloHex, concealCount: census.conceal.length, counts,
    move: mv, clothColor,
    swapWhy: swapControl(cloth?.bg, clothColor, home.bg).why,
    settleDrift: { dn: settle.n - home.base.n, dde: +((settle.deMed ?? 0) - (home.base.deMed ?? 0)).toFixed(6) },
    pairDrift: { dn: home.pair.n - home.base.n, dde: +(home.pair.deMed - home.base.deMed).toFixed(6) },
    restoreDrift: { dn: homeAgain.n - home.base.n, dde: +(homeAgain.deMed - home.base.deMed).toFixed(6) },
    home: { n: home.base.n, deMed: home.base.deMed, deP90: home.base.deP90, dL: home.base.dL, dHue: home.base.dHue, bg: home.bg },
    cloth: cloth ? { n: cloth.base.n, deMed: cloth.base.deMed, deP90: cloth.base.deP90, dL: cloth.base.dL, dHue: cloth.base.dHue, bg: cloth.bg } : null,
    cands: {
      home: home.cands.map((c) => ({ target: c.target, n: c.n, deMed: c.deMed, deP90: c.deP90, dL: c.dL, moved: c.moves.filter((m) => m.moved).length, moves: c.moves })),
      cloth: cloth ? cloth.cands.map((c) => ({ target: c.target, n: c.n, deMed: c.deMed, deP90: c.deP90, dL: c.dL, moved: c.moves.filter((m) => m.moved).length })) : null,
    },
    nullRows,
    controls,
  };
}

/**
 * PIX — the known-bad input for the bug at the top of this file, asserted on BYTES.
 *
 * ⚠️ IT IS TWO-SIDED ON PURPOSE, AND THE SECOND SIDE IS THE STRONGER ONE.
 *   * `base !== ablated` always: the photographed frame must actually contain the
 *     projectile. This is the assertion whose absence let two identical PNGs be
 *     reported as "I looked at it and cannot see a difference".
 *   * if the candidate moved a material, `base !== cand` — the treatment must be
 *     visible in the picture, not only in the number.
 *   * if it moved NOTHING, `base === cand` **byte for byte** — the null control
 *     restated on pixels rather than on a median, which no rounding can launder.
 * Ask what implementation fails this (`docs/AGENT-BRIEF.md` §4.4): a screenshot taken
 * after an ablation fails side one; a transform that ignores its own threshold and
 * repaints every halo fails side three.
 */
async function pixControl(dir, name, movedByTag) {
  const read = async (f) => { try { return md5(await readFile(`${dir}/${f}`)); } catch { return null; } };
  const out = {};
  for (const tag of ['home', 'cloth']) {
    const b = await read(`${name}.${tag}.base.png`);
    const c = await read(`${name}.${tag}.L${SHOT_L}.png`);
    const a = await read(`${name}.${tag}.ablated.png`);
    if (!b || !c || !a) continue;
    const moved = movedByTag[tag] ?? 0;
    const ok = b !== a && (moved > 0 ? b !== c : b === c);
    out[tag] = { base: b, cand: c, ablated: a, moved, ok };
  }
  return out;
}

async function main() {
  await mkdir(OUT, { recursive: true });
  const table = await rangedWeapons();
  const wantChars = args.chars ? String(args.chars).split(',') : [...table.keys()];
  const ONLYW = args.weapon ? String(args.weapon) : null;

  const browser = await chromium.launch({ args: LAUNCH_ARGS });
  const results = [];
  let failures = 0;
  try {
    for (const charId of wantChars) {
      const weapons = table.get(charId);
      if (!weapons) continue;
      const ranged = weapons.map((x, i) => ({ ...x, slot: i + 1 }))
        .filter((x) => x.type === 'ranged' && (!ONLYW || x.key === ONLYW));
      if (!ranged.length) { log(`  ${charId}: no ranged weapon`); continue; }

      const page = await browser.newPage({ viewport: { width: W, height: H } });
      try {
        await boot(page);
        const enemy = charId === 'donut' ? 'hamburger' : 'donut';
        await page.goto(`${BASE}/?player=${charId}&enemy=${enemy}&simSpeed=${SIM_SPEED}&pointerLock=0&aimMode=free`, { waitUntil: 'networkidle' });
        await page.waitForFunction(() => window.__gameReady === true, null, { timeout: 120000 });
        await page.waitForFunction(() => window.__matchDebug?.phase === 'playing', null, { timeout: 240000 });
        await installHarness(page);
        if (PITCH !== 58) await page.evaluate(([p, wd]) => window.__hl.setPitch(p, wd), [PITCH, DETECT_WIDTH]);

        for (const w of ranged) {
          if (!(await selectWeapon(page, w.slot))) {
            log(`  ⚠️ ${charId}.${w.key}: weapon select refused — SKIPPED`);
            failures++;
            continue;
          }
          const r = await runWeapon(page, charId, w, OUT);
          if (!r.error && SHOTS) {
            const movedByTag = {
              home: (r.cands.home.find((c) => c.target === SHOT_L) || {}).moved ?? 0,
              cloth: (r.cands.cloth ? (r.cands.cloth.find((c) => c.target === SHOT_L) || {}) : {}).moved ?? 0,
            };
            const pix = await pixControl(OUT, `${charId}.${w.key}`, movedByTag);
            r.pix = pix;
            const tags = Object.keys(pix);
            r.controls.PIX = tags.length > 0 && tags.every((t) => pix[t].ok);
          }
          results.push(r);
          if (r.error) { log(`  ⚠️ ${pad(charId + '.' + w.key, 22)}${r.error}`); failures++; continue; }
          const bad = Object.entries(r.controls).filter(([, v]) => !v).map(([k]) => k);
          if (bad.length) failures++;
          const line = (st, arr) => arr ? arr.map((c) => `${c.target}:${c.deMed}`).join(' ') : '-';
          log(`  ${pad(charId + '.' + w.key, 20)}${pad(r.color ?? '-', 9)}halo ${pad((r.haloHex || []).join(','), 26)}`);
          log(`      HOME  base ${pad(r.home.deMed, 8)}| ${line('home', r.cands.home)}`);
          log(`      CLOTH base ${pad(r.cloth ? r.cloth.deMed : '-', 8)}| ${line('cloth', r.cands.cloth)}`);
          log(`      counts mid-flight: ${r.counts.liveProjectiles} live · draws ${r.counts.calls}`
            + ` · tris ${r.counts.triangles} · programs ${r.counts.programs}`
            + ` · geometries ${r.counts.geometries} · textures ${r.counts.textures}`);
          log(`      ${bad.length ? `⚠️ CONTROLS FAILED: ${bad.join(',')}` : 'controls OK'}`);
        }
      } catch (e) {
        log(`  🚨 ${charId}: page failed — ${String(e).split('\n')[0]}`);
        results.push({ char: charId, weapon: null, error: `page: ${String(e).split('\n')[0]}` });
        failures++;
      } finally {
        await page.close().catch(() => {});
        await writeFile(`${OUT}/hl_sweep.p${PITCH}.json`,
          JSON.stringify({ base: BASE, pitch: PITCH, split: SPLIT, ls: LS, aim: { dx: AIM_DX, dy: AIM_DY }, w: W, h: H, delta: DELTA, results }, null, 2));
      }
    }
    await writeFile(`${OUT}/hl_sweep.p${PITCH}.json`,
      JSON.stringify({ base: BASE, pitch: PITCH, split: SPLIT, ls: LS, aim: { dx: AIM_DX, dy: AIM_DY }, w: W, h: H, delta: DELTA, results }, null, 2));
    log(`\njson -> ${OUT}/hl_sweep.p${PITCH}.json`);
    summary(results);
  } finally {
    await browser.close();
  }

  if (args.selftest) {
    const rows = results.filter((x) => !x.error);
    if (!rows.length) { log('\n  → INSTRUMENT INVALID — no weapon produced a measurement'); process.exit(1); }
    /**
     * ⚠️ THE SELFTEST IS AGGREGATE, BECAUSE NO SINGLE WEAPON CAN EXERCISE BOTH SIDES.
     * A weapon above the split moves its halo — so PIX's "the picture changed" side is
     * live and NULL has nothing to assert. A weapon below it moves nothing — so NULL is
     * live and PIX asserts the pixels are byte-identical instead. Validating on the
     * first row alone would have declared the instrument sound while half of it was
     * vacuous, which is exactly the failure `docs/AGENT-BRIEF.md` §4.4 names.
     */
    const anyNull = rows.some((x) => x.nullRows.length > 0);
    const anyMoved = rows.some((x) => x.cands.home.some((c) => c.moved > 0));
    const r = rows.find((x) => x.cands.home.some((c) => c.moved > 0)) ?? rows[0];
    log(`\n══ INSTRUMENT VALIDATION — ${rows.length} weapon(s), detail on ${r.char}.${r.weapon} ═══════`);
    log(`  halo materials in the air      ${(r.haloHex || []).join(', ')}   split ${SPLIT}`);
    log(`  moved ${r.move.ok ? `${r.move.name} ${r.move.distanceM} m -> under the shot` : r.move.why}`);
    log(`  cloth's OWN rendered colour    hue ${r.clothColor?.hue} luma ${r.clothColor?.luma} sat ${r.clothColor?.sat}`);
    log(`  background under the shot      HOME  hue ${pad(r.home.bg?.hue, 8)}luma ${r.home.bg?.luma}`);
    log(`                                 CLOTH hue ${pad(r.cloth?.bg?.hue, 8)}luma ${r.cloth?.bg?.luma}`);
    log(`  NULL rows (candidates that moved nothing): ${r.nullRows.length}`
      + (r.nullRows.length ? ` — dE ${r.nullRows.map((x) => `${x.deMed}==${x.base}`).join(' ')}` : ' — none, so NULL is VACUOUS here'));
    log(`  drift, the tool's own units:`);
    log(`      settling frame (discarded)  dn ${pad(r.settleDrift.dn, 8)}dde ${r.settleDrift.dde}`);
    log(`      PAIR    (want 0 exactly)    dn ${pad(r.pairDrift.dn, 8)}dde ${r.pairDrift.dde}`);
    log(`      RESTORE (want 0 exactly)    dn ${pad(r.restoreDrift.dn, 8)}dde ${r.restoreDrift.dde}`);
    for (const x of rows) {
      if (!x.pix) continue;
      for (const [t, p] of Object.entries(x.pix)) {
        log(`  PIX ${pad(x.char + '.' + x.weapon, 18)}${pad(t, 6)}moved ${p.moved}  base ${p.base} cand ${p.cand} ablated ${p.ablated}  ${p.ok ? 'OK' : '⚠️ FAIL'}`);
      }
    }
    const order = ['N', 'A', 'SWAP', 'DIFF', 'PAIR', 'RESTORE', 'NULL', 'PIX'];
    for (const x of rows) {
      log(`  ${pad(x.char + '.' + x.weapon, 20)}${order.map((k) => `${k} ${x.controls[k] ? 'PASS' : 'FAIL'}`).join(' · ')}`);
    }
    /**
     * 🚨 THE CORPUS CENSUS, PRINTED EVERY RUN — and it is the half that was missing.
     *
     * On 2026-08-11 this file reported a bare `PIX never saw a moved halo` and the reason
     * took a separate offline derivation to find: `50c5272` had moved every halo to one
     * side of the then-default 0.75 (see `SPLIT`'s block). A validator that knows its
     * corpus emptied should say WHICH split would refill it, not leave that to the reader.
     */
    const census = rows.flatMap((x) => (x.haloHex || []).map(lightnessOf));
    const gap = widestGap(census);
    const counts = new Map();
    for (const l of census) { const k = (+l.toFixed(4)).toFixed(4); counts.set(k, (counts.get(k) ?? 0) + 1); }
    log(`  halo-lightness CENSUS over ${census.length} material(s) in ${rows.length} weapon page(s):`);
    log(`      ${[...counts.entries()].sort((a, b) => Number(a[0]) - Number(b[0])).map(([k, n]) => `${k}×${n}`).join('  ')}`);
    log(`      above --split ${SPLIT}: ${census.filter((l) => l >= SPLIT).length}   below: ${census.filter((l) => l < SPLIT).length}`);
    if (gap) log(`      widest gap ${gap.lo} → ${gap.hi} (${gap.gap}), midpoint ${gap.mid}`);
    else log('      🔴 ONE distinct lightness only — NO split can partition this palette');
    if (!anyNull) {
      log(`  ⚠️ NULL was VACUOUS on every weapon run — no halo sits below --split ${SPLIT}.`);
      log(gap ? `      → the palette DOES straddle ${gap.mid}; re-run with --split ${gap.mid}.`
        : '      → the palette has collapsed to one lightness; this instrument cannot be made valid on it.');
    }
    if (!anyMoved) {
      log(`  ⚠️ PIX never saw a moved halo — no halo sits at or above --split ${SPLIT}.`);
      log(gap ? `      → the palette DOES straddle ${gap.mid}; re-run with --split ${gap.mid}.`
        : '      → the palette has collapsed to one lightness; this instrument cannot be made valid on it.');
    }
    const ok = rows.every((x) => order.every((k) => x.controls[k])) && anyNull && anyMoved;
    log(ok ? `  → INSTRUMENT VALID (${order.length}/${order.length} controls, both sides exercised)`
      : '  → INSTRUMENT INVALID — nothing above is trustworthy');
    process.exit(ok ? 0 : 1);
  }
  process.exit(failures ? 1 : 0);
}

function summary(results) {
  const live = results.filter((r) => !r.error && r.cands && r.cands.home);
  if (!live.length) return;
  log(`\n══ HALO LIGHTNESS SWEEP — pitch ${PITCH}, split ${SPLIT} ═══════════════════════`);
  log(`  dE is OKLab distance from the LOCAL background, median over the projectile's`);
  log(`  own pixels. A candidate is scored on min(HOME, CLOTH): a value that wins on`);
  log(`  the cream cloth by losing the rose tile has moved the bug, not fixed it.\n`);
  const cols = LS.map((l) => pad(String(l), 9)).join('');
  log(`  ${pad('weapon', 20)}${pad('station', 8)}${pad('base', 9)}${cols}`);
  for (const r of live) {
    const row = (tag, base, arr) => {
      if (!arr) return;
      log(`  ${pad(tag === 'home' ? r.char + '.' + r.weapon : '', 20)}${pad(tag, 8)}${pad(base, 9)}`
        + LS.map((l) => { const c = arr.find((x) => x.target === l); return pad(c ? c.deMed : '-', 9); }).join(''));
    };
    row('home', r.home.deMed, r.cands.home);
    row('cloth', r.cloth ? r.cloth.deMed : '-', r.cands.cloth);
    if (r.cands.cloth) {
      const worst = LS.map((l) => {
        const a = r.cands.home.find((x) => x.target === l), b = r.cands.cloth.find((x) => x.target === l);
        return a && b ? Math.min(a.deMed, b.deMed) : null;
      });
      log(`  ${pad('', 20)}${pad('min', 8)}${pad(Math.min(r.home.deMed, r.cloth.deMed).toFixed(4), 9)}`
        + worst.map((v) => pad(v === null ? '-' : v.toFixed(4), 9)).join(''));
    }
  }
}

/**
 * ── `--replay <run.json>` — RE-JUDGE A RECORDED RUN, OFFLINE, IN A SECOND ──────────
 *
 * This tool is **~7 min per weapon under SwiftShader, ~2.9 h for all 23**, and its own
 * history is a sequence of claims made from partial reads of long runs: a *"6 of the
 * first 6"* that turned out to be five of the twelve, and *"the corpus is empty"* when it
 * was merely unpartitioned. **A partial read of a long run is a different quantity from
 * the run**, and the fix for that is not discipline, it is a mode that re-evaluates the
 * *whole* recorded run in a second.
 *
 * Every control that is a pure function of what the row already stores is recomputed
 * here, so a change to a predicate can be judged against **the same 23 rows** the old one
 * was judged on, before anyone spends the 2.9 h.
 *
 *   node tools/tmp/hl_sweep.mjs --replay shots/hl/sweep/hl_sweep.p58.json
 */
async function replay(file) {
  const raw = JSON.parse(await readFile(resolve(file), 'utf8'));
  const rows = (Array.isArray(raw) ? raw : (raw.rows ?? raw.results ?? Object.values(raw)))
    .filter((r) => r && r.controls && r.cloth && r.home);
  // ⚠️ Assert the set is NON-EMPTY before asserting over it — `[].every()` is `true`, and
  // three controls in this repo went vacuous through exactly that door in one session.
  if (rows.length === 0) {
    console.error(`hl_sweep --replay: ${file} holds no rows with a cloth station. Nothing to judge.`);
    process.exitCode = 1;
    return;
  }
  let was = 0, now = 0;
  console.log(`\n── SWAP replayed over ${rows.length} recorded rows from ${file}\n`);
  for (const r of rows) {
    const v = swapControl(r.cloth.bg, r.clothColor, r.home.bg);
    if (r.controls.SWAP) was++;
    if (v.ok) now++;
    const changed = r.controls.SWAP !== v.ok ? (v.ok ? '  ← FIXED' : '  ← REGRESSED') : '';
    console.log(`  ${(v.ok ? 'PASS' : 'FAIL').padEnd(5)}${pad(`${r.char}.${r.weapon}`, 22)}`
      + `was ${r.controls.SWAP ? 'PASS' : 'FAIL'}   ${v.why}${changed}`);
  }
  console.log(`\n  SWAP: recorded ${was}/${rows.length} pass → replayed ${now}/${rows.length} pass`);

  /**
   * 🚨 THE KNOWN-BAD, ON EVERY ROW, BECAUSE A CONTROL THAT ONLY EVER PASSES IS NOT A
   * CONTROL — and the failure mode this arm exists for is *"the patch silently failed to
   * move"*. So feed it exactly that: the cloth station's background replaced by the HOME
   * background, which is what would be measured if `moveClothUnderProjectile` no-opped.
   * ⚠️ The old absolute test would have passed several of these outright, because it never
   * looked at `home` at all — it asked only whether the reading was near the cloth's
   * material colour, and a `home` reading that happened to be within 0.06 luma of it
   * satisfied that. The nearest-match formulation cannot: `d(home, home)` is zero.
   */
  const kb = rows.map((r) => swapControl(r.home.bg, r.clothColor, r.home.bg));
  const kbPass = kb.filter((v) => v.ok).length;
  console.log(`  KNOWN-BAD  the patch never moved (cloth bg := home bg): `
    + `${kbPass === 0 ? `all ${rows.length} rows go RED ✅` : `🔴 ${kbPass} of ${rows.length} STILL PASS`}`);
  if (kbPass) process.exitCode = 1;
  // ...and the paired positive control, so "everything fails" cannot masquerade as rigour.
  const posPass = rows.filter((r) => swapControl(r.cloth.bg, r.clothColor, r.home.bg).ok).length;
  console.log(`  CONTROL    the real cloth reading still passes on ${posPass} of ${rows.length} `
    + `— the arm discriminates rather than rejecting everything`);
  if (posPass === 0) process.exitCode = 1;
  // The controls that are not being changed must replay IDENTICALLY. Without this the
  // replay could "fix" SWAP by having quietly re-read a different file.
  const others = ['N', 'A', 'DIFF', 'PAIR', 'RESTORE', 'NULL', 'PIX'];
  for (const k of others) {
    const n = rows.filter((r) => r.controls[k]).length;
    console.log(`  ${k.padEnd(8)} ${n}/${rows.length} (unchanged by this pass)`);
  }
  process.exitCode = now === rows.length ? 0 : 1;
}

/** IS_MAIN guard — `docs/AGENT-BRIEF.md` §3. */
const IS_MAIN = process.argv[1] && resolve(process.argv[1]) === resolve(new URL(import.meta.url).pathname);
if (IS_MAIN) {
  if (args.replay) await replay(String(args.replay));
  else await main();
}
