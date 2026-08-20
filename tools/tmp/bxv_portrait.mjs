#!/usr/bin/env node
/**
 * bxv_portrait — the brow/lash separation ON THE SCREEN URI ACTUALLY LOOKED AT,
 * at the device he actually used.
 *
 * THROWAWAY, READ-ONLY on `src/`. Measurement instrument; changes no game code.
 *
 * ── WHY IT EXISTS ────────────────────────────────────────────────────────────
 * `569354e` moved `hamburger.ts`'s `browG.y` 0.092 -> 0.120 and justified it with a
 * brow-to-lash gap of 10 px -> 22 px measured by `bw_brow.mjs` at a **900x1400**
 * offscreen render of `preview.html`. Its own commit message says, correctly, that the
 * step from there to *"the character screen looks lower-resolution"* is
 *
 *   > "ARITHMETIC ON A SCALE FACTOR, not a measurement at the shipped portrait size.
 *   >  Nobody has yet measured this at the size Uri actually saw."
 *
 * This measures it there: the REAL `?screen=characters` route, the REAL
 * `MenuCharacterStage` (`charStage.ts`, `pitchDeg: 20`, `subjectFill` solved by
 * `applyFraming()` from the canvas aspect — NOT the preview's flat 0.60), on an
 * iPhone 15 Pro's CSS box and device pixel ratio: **393 x 852 CSS, deviceScaleFactor 3**.
 *
 * 🚨 WHAT IS AND IS NOT QUOTABLE FROM IT. SwiftShader is not an A17 GPU. The
 * DRAWING-BUFFER INTEGER, the CSS box, `Stage`'s effective pixel ratio and the
 * PROJECTED SEPARATION IN DEVICE PIXELS are decided by CSS layout, `charStage`'s
 * framing solve and the projection matrix — all engine-independent, all quotable.
 * Perceived sharpness and frame time are NOT, and this tool reports neither.
 *
 * ── WHAT IT MEASURES ─────────────────────────────────────────────────────────
 * The ablation classifier from `bw_brow.mjs`, pointed at the menu portrait's own
 * `window.__stage` instead of `preview.html`'s: everything flat black over a black
 * clear colour, then BROW magenta / LASH cyan / SCLERA green, one `renderer.render`,
 * one `gl.readPixels`, and column-wise
 *
 *     lidGap(x) = (bottom-most BROW row in column x) - (topmost LASH row in column x) - 1
 *
 * median over the columns where both appear, per side, split at the sclera pair's own
 * midpoint. Reported in DEVICE px and in CSS px (device / effective ratio) — the CSS
 * number is the one that answers "is this separation resolvable at all", because a
 * separation under ~1 CSS px cannot survive the display's own filtering.
 *
 * ⚠️ Specs are `bw_brow`'s grammar: `=name` is EXACT after `__outline` stripping.
 * On this character `eye` is a SUBSTRING of `eye_lash` and of `eye_glint__no_outline`,
 * so `--eye eye` claims all three and the lash measures 0 px. That is the defect
 * `569354e` fixed in `bw_brow`; arm 2 below re-fires it here so this tool cannot
 * inherit it silently.
 *
 * ── KNOWN-BADS (`--selftest`). A guard not shown to FAIL is not a guard. ──────
 *   1 PAINTED     the LIT drawing buffer's luma stdev exceeds 0.02 BEFORE anything is
 *                 ablated. `__screenReady` is a flag and a flag is not a paint.
 *   2 NON-EMPTY   all three parts resolve to >=1 mesh AND draw >0 px, on BOTH sides,
 *                 and `lidGapPx` is finite — asserted BEFORE arms 3-5, every one of
 *                 which asserts over that lid. `[].every()` is `true` (CLAUDE.md #6).
 *   3 COLLIDE     substring specs (`--eye eye`) must be FATAL here, not a confident
 *                 `lid = 0 px`. The bug that shipped, re-fired on this tool.
 *   4 MOVES       `--nudge 0.02` lifts the brow page-side; `lidGapPx` MUST GROW. A
 *                 statistic that does not move on a known displacement is measuring
 *                 something else.
 *   5 HOLDS       ⚠️ REVERSED ONCE, AND THE OLD WORDING IS KEPT HERE WITH THE REASON.
 *                 WAS: "an identical second run reproduces `lidGapPx` and EVERY PIXEL
 *                 COUNT exactly. The render is deterministic." It is NOT: this screen
 *                 is not `preview.html?shot=1`. The menu portrait animates on the wall
 *                 clock (idle + `charStage`'s intro), so two identical runs differ by a
 *                 frame or two of pose and the ANTIALIASED EDGE COUNT moves with it —
 *                 measured `browPx 110 -> 112`. The MEDIANS did hold, so the arm now
 *                 asserts what this tool QUOTES (per-side `lidGapPx`, buffer integer)
 *                 and prints the pixel counts as data. `--repeat N` measures the null
 *                 on those medians directly; that spread is the resolution floor for
 *                 any A/B taken off this tool, and it must be stated before acting on
 *                 a difference (CLAUDE.md #10).
 *   6 BLANK       `--knownbad blank` clears the buffer before it is read; the PAINTED
 *                 floor MUST then fail. A floor never shown to fail is decoration.
 *
 * ── WHAT IT MEASURED, 2026-08-20 ─────────────────────────────────────────────
 * Detached worktrees of each SHA, `node_modules` + `reference` symlinked, served
 * through `sx_snap.mjs`. `?screen=characters`, hamburger EQUIPPED, 393x852 @ dSF 3.
 *
 *   the canvas is NOT the phone's: `chars-hero-3d` is 367 x 162 CSS and `charStage`
 *   sets `maxPixelRatio: 2`, so at `devicePixelRatio` 3 the drawing buffer is
 *   **734 x 324** and the effective ratio is **2.000** — the hero portrait is rendered
 *   at two thirds of the display's native resolution. Long-standing, NOT the deploy
 *   regression, but it is why the numbers below are so small.
 *
 *   browG.y            lidGap DEVICE px L/R    lidGap CSS px    null over N runs
 *   0.112 (eeced49)          7-8 / 7            3.50 / 3.50     L 7..8 R 7..7  (3)
 *   0.092 (0beebb5)            1 / 1            0.50 / 0.50     L 1..1 R 1..1  (6)
 *   0.120 (569354e)            3 / 3            1.50 / 1.50     L 3..3 R 3..3  (6)
 *
 * 🚨 RESOLUTION FLOOR, MEASURED, NOT ASSUMED (CLAUDE.md #10): the null spread over
 * identical runs is **0 device px on both candidate arms** and **1 device px on one
 * arm of the historical control**, so the floor is <= 1 device px. The 0.092 -> 0.120
 * delta is +2 device px on BOTH sides — twice the largest observed null, and
 * corroborated qualitatively by the captures (`bxv_shots/hero_a092.png` vs
 * `hero_b120.png`): at 0.092 the brow and lash are ONE fused black mass, at 0.120 they
 * are two shapes with bun between them.
 *
 * So `062513c` (0.112 -> 0.092) took the finest structure on this face from ~3.5 CSS px
 * to **0.50 CSS px** on the screen Uri named, inside the window he complained about.
 * That is sub-pixel: unresolvable, i.e. merged. `569354e` puts it back to 1.50.
 *
 *   node tools/tmp/bxv_portrait.mjs --url <snapshot>              # measure
 *   node tools/tmp/bxv_portrait.mjs --url <snapshot> --repeat 6  # the NULL, per side
 *   node tools/tmp/bxv_portrait.mjs --url <snapshot> --selftest   # 6 known-bads
 */
import { chromium } from 'playwright';
import { mkdir, writeFile } from 'node:fs/promises';
import { dirname } from 'node:path';

const a = process.argv;
const get = (k, d) => (a.includes(k) ? a[a.indexOf(k) + 1] : d);
const BASE = process.env.PREVIEW_BASE ?? get('--url', null);
const ID = get('--id', 'hamburger');
const BROW = get('--brow', '=brow');
const LID = get('--lid', '=eye_lash');
const EYE = get('--eye', '=eye');
const LABEL = get('--label', 'unlabelled');
const JSON_OUT = get('--json', '');
const PNG_OUT = get('--png', '');
const SELFTEST = a.includes('--selftest');
const REPEAT = Number(get('--repeat', '1'));

// Uri's device, stated rather than defaulted: iPhone 15 Pro, iOS 26.5.2.
const W = Number(get('--w', '393'));
const H = Number(get('--h', '852'));
const DSF = Number(get('--dsf', '3'));

if (!BASE) { console.error('need PREVIEW_BASE or --url'); process.exit(2); }

const LAUNCH_ARGS = ['--use-gl=angle', '--use-angle=swiftshader', '--enable-unsafe-swiftshader',
  '--enable-webgl', '--ignore-gpu-blocklist', '--disable-gpu-sandbox'];
const HMR_STUB = `const noop=()=>{};
export const createHotContext=()=>({accept:noop,acceptExports:noop,dispose:noop,prune:noop,
  invalidate:noop,on:noop,off:noop,send:noop,decline:noop,data:{}});
export const injectQuery=(u)=>u; export const updateStyle=noop; export const removeStyle=noop;
export const ErrorOverlay=class{}; export default {};`;

const browser = await chromium.launch({ args: LAUNCH_ARGS });

async function measure(opts = {}) {
  const page = await browser.newPage({ viewport: { width: W, height: H }, deviceScaleFactor: DSF });
  await page.route('**/@vite/client', (r) => r.fulfill({ status: 200, contentType: 'application/javascript', body: HMR_STUB }));
  const errs = [];
  page.on('pageerror', (e) => errs.push(e.message));
  await page.goto(`${BASE}/?screen=characters`, { waitUntil: 'load', timeout: 120_000 });
  await page.waitForFunction('window.__screen === "characters" && window.__screenReady === true', null, { timeout: 180_000 });
  // The roster card, not a URL param: `?screen=characters` shows the PROFILE's
  // `selected`, which is `CHARACTER_IDS[0]` on a fresh storage. `card.dataset.char`
  // is the screen's own handle on a character (`characterSelect.ts`).
  await page.waitForSelector(`[data-char="${ID}"]`, { timeout: 60_000 });
  await page.click(`[data-char="${ID}"]`);
  await page.waitForFunction(`window.__charStage && window.__charStage() && window.__charStage().id === "${ID}"`, null, { timeout: 60_000 });
  // The portrait cross-fades its model in; wait for the stage to have drawn the new
  // one rather than for a flag. Two rAFs plus a settle beat, then assert on pixels.
  await page.waitForTimeout(1500);

  const res = await page.evaluate(({ brow, lid, eye, nudge, blank }) => {
    const st = window.__stage;
    if (!st) return { fatal: 'no window.__stage on the characters route', code: 5 };
    const gl = st.renderer.getContext();
    const cv = st.renderer.domElement;
    const w = cv.width, h = cv.height;
    const cssBox = cv.getBoundingClientRect();
    const ratio = cssBox.width > 0 ? w / cssBox.width : 0;

    // ── THE PAINT FLOOR, ON THE LIT FRAME, BEFORE ANYTHING IS ABLATED ───────
    if (blank) { gl.clearColor(0, 0, 0, 1); gl.clear(gl.COLOR_BUFFER_BIT | gl.DEPTH_BUFFER_BIT); }
    const lit = new Uint8Array(w * h * 4);
    gl.readPixels(0, 0, w, h, gl.RGBA, gl.UNSIGNED_BYTE, lit);
    let s = 0, s2 = 0;
    const n = w * h;
    for (let i = 0; i < lit.length; i += 4) {
      const L = (0.2126 * lit[i] + 0.7152 * lit[i + 1] + 0.0722 * lit[i + 2]) / 255;
      s += L; s2 += L * L;
    }
    const mean = s / n;
    const stdev = Math.sqrt(Math.max(0, s2 / n - mean * mean));

    let basicProto = null;
    st.scene.traverse((o) => {
      if (basicProto) return;
      if (o.isMesh && o.material && o.material.isMeshBasicMaterial) basicProto = o.material;
    });
    if (!basicProto) return { fatal: 'no MeshBasicMaterial in the portrait scene to clone', code: 5 };
    // 🚨 THE CLONE INHERITS EVERY FLAG ON WHATEVER MATERIAL WAS FOUND FIRST, AND ONE
    // OF THEM RENDERS THE WHOLE FRAME BLACK. `bw_brow.mjs` clones "the first
    // MeshBasicMaterial in the scene" for the same good reason (the app does not put
    // THREE on `window`, so a Basic material has to be reached through one that
    // exists). On `preview.html` that is a catchlight and it is harmless. On the MENU
    // portrait scene the first one is `menu_ground_decal`: `blending 5` (CustomBlending)
    // and `depthWrite false`. Every clone inherited it, so every part multiplied itself
    // into the black clear colour and the ablation returned `px 0/0/0` with
    // `meshes 4/4/4` — a confident, silent, all-zero measurement. NORMALISE THE CLONE.
    // NormalBlending is 1; the numeric constant is used because THREE is not importable
    // page-side here.
    const NORMAL_BLENDING = 1;
    const norm = (m) => {
      m.blending = NORMAL_BLENDING;
      m.toneMapped = false;
      m.fog = false;
      m.alphaTest = 0;
      m.depthTest = true;
      m.visible = true;
      return m;
    };
    const flat = (hex) => {
      const m = norm(basicProto.clone());
      m.color.set(hex); m.transparent = false; m.opacity = 1; m.depthWrite = true;
      return m;
    };

    st.scene.traverse((o) => {
      if (!o.isMesh || !o.material) return;
      const m = flat('#000000');
      // Occlusion has to stay honest — a decal that never wrote depth must not start.
      m.transparent = !!o.material.transparent;
      m.opacity = o.material.opacity ?? 1;
      m.side = o.material.side;
      m.depthWrite = o.material.depthWrite !== false;
      o.material = m;
    });
    const clear = st.renderer.getClearColor(new (basicProto.color.constructor)()).clone();
    st.renderer.setClearColor(0x000000, 1);

    const requested = [
      { key: 'brow', sub: brow, hex: '#ff00ff' },
      { key: 'lid', sub: lid, hex: '#00e6e6' },
      { key: 'eye', sub: eye, hex: '#00ff00' },
    ];
    const parts = requested.filter((p) => p.sub);
    // 🚨 NON-EMPTY BEFORE ANY LOOP OVER IT. `[].every()` is `true` and so is every
    // `for (const p of [])` below.
    if (!parts.length) return { fatal: 'NO PART SPECS AT ALL', code: 4 };

    // MATCH FIRST, PAINT LATER — the two were one loop in the pre-`569354e` tool and
    // that is exactly how a doubly-claimed mesh became a silent `lid = 0 px`.
    const counts = { brow: 0, lid: 0, eye: 0 };
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
    const unresolved = parts.filter((p) => counts[p.key] === 0);
    if (unresolved.length) {
      return { code: 4, meshes: counts, ratio, buffer: { w, h }, css: { w: cssBox.width, h: cssBox.height },
        fatal: `PART MATCHED NOTHING: ${unresolved.map((p) => `${p.key}="${p.sub}"`).join(', ')}` };
    }
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
      return { code: 4, meshes: counts, ratio, buffer: { w, h }, css: { w: cssBox.width, h: cssBox.height },
        fatal: `PART SPECS COLLIDE (${clash.length}): ${clash.slice(0, 4).join('; ')}` };
    }

    for (const p of parts) {
      for (const { o, isHull } of matched[p.key]) {
        if (nudge && p.key === 'brow') o.position.y += nudge;
        o.material = flat(p.hex);
        o.renderOrder = 500 + (isHull ? 0 : 1);
      }
    }
    // 🚨 `setRenderTarget(null)` IS LOAD-BEARING AND ITS ABSENCE IS SILENT.
    // `Stage` drives a post chain, so the renderer can be left bound to an offscreen
    // target. `renderer.render()` then draws into THAT and `gl.readPixels` reads the
    // DEFAULT framebuffer — which still holds the previous LIT frame. Every part then
    // classifies to 0 px while the paint floor reads a healthy 0.1444, i.e. a confident
    // "the brow drew nothing" off a frame that is not the one that was just rendered.
    // Measured here first time out: px 0/0/0 with meshes 4/4/4. Arm 2 caught it.
    st.renderer.setRenderTarget(null);
    st.renderer.render(st.scene, st.rig.camera);
    const buf = new Uint8Array(w * h * 4);
    gl.readPixels(0, 0, w, h, gl.RGBA, gl.UNSIGNED_BYTE, buf);
    st.renderer.setClearColor(clear, 1);
    let ablNonBlack = 0;
    for (let i = 0; i < buf.length; i += 4) if (Math.max(buf[i], buf[i + 1], buf[i + 2]) >= 40) ablNonBlack++;

    // ⚠️ readPixels rows run BOTTOM-UP: "above" is a LARGER row index.
    const browBot = new Int32Array(w).fill(-1);
    const lidTop = new Int32Array(w).fill(-1);
    const px = { brow: 0, lid: 0, eye: 0 };
    let ex0 = w, ex1 = -1;
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
        if (k === 'brow') { if (browBot[x] < 0 || y < browBot[x]) browBot[x] = y; }
        else if (k === 'lid') { if (y > lidTop[x]) lidTop[x] = y; }
        else { if (x < ex0) ex0 = x; if (x > ex1) ex1 = x; }
      }
    }
    const mid = ex1 >= ex0 ? (ex0 + ex1) / 2 : w / 2;
    const sideStat = (x0, x1) => {
      const g = [];
      for (let x = x0; x <= x1; x++) if (browBot[x] >= 0 && lidTop[x] >= 0) g.push(browBot[x] - lidTop[x] - 1);
      g.sort((p, q) => p - q);
      return g.length
        ? { lidGapPx: g[Math.floor(g.length / 2)], min: g[0], max: g[g.length - 1], cols: g.length }
        : { lidGapPx: null, min: null, max: null, cols: 0 };
    };
    const all = [];
    for (let x = 0; x < w; x++) if (browBot[x] >= 0 && lidTop[x] >= 0) all.push(browBot[x] - lidTop[x] - 1);
    all.sort((p, q) => p - q);
    const info = window.__charStage ? window.__charStage() : null;

    return {
      meshes: counts, px, ratio, dpr: window.devicePixelRatio, ablNonBlack,
      buffer: { w, h }, css: { w: cssBox.width, h: cssBox.height },
      lit: { mean, stdev },
      L: sideStat(0, Math.floor(mid)), R: sideStat(Math.ceil(mid), w - 1),
      lidGapPx: all.length ? all[Math.floor(all.length / 2)] : null,
      fill: info ? info.fill : null, aspect: info ? info.aspect : null,
      crown: info ? info.crown : null, feet: info ? info.feet : null,
      charId: info ? info.id : null,
    };
  }, { brow: opts.browSpec ?? BROW, lid: opts.lidSpec ?? LID, eye: opts.eyeSpec ?? EYE,
    nudge: opts.nudge ?? 0, blank: !!opts.blank });

  if (!res.fatal && PNG_OUT && opts.png !== false) {
    await mkdir(dirname(PNG_OUT), { recursive: true });
    await page.locator('canvas').first().screenshot({ path: PNG_OUT });
  }
  res.errs = errs;
  await page.close();
  return res;
}

const FLOOR = 0.02;
const num = (v, d = 2) => (v === null || v === undefined ? 'n/a' : v.toFixed(d));
const fmt = (r) => (r.fatal ? `FATAL(${r.code}): ${r.fatal}`
  : `buf ${r.buffer.w}x${r.buffer.h}  css ${r.css.w.toFixed(0)}x${r.css.h.toFixed(0)}  ratio ${num(r.ratio, 3)} (dpr ${r.dpr})  fill ${r.fill}  aspect ${r.aspect}\n`
  + `   meshes b/l/e=${r.meshes.brow}/${r.meshes.lid}/${r.meshes.eye}  px ${r.px.brow}/${r.px.lid}/${r.px.eye}  litStdev ${num(r.lit.stdev, 4)}  ablNonBlack ${r.ablNonBlack}\n`
  + `   lidGap DEVICE px  L=${r.L.lidGapPx} (${r.L.min}..${r.L.max}, ${r.L.cols}c)  R=${r.R.lidGapPx} (${r.R.min}..${r.R.max}, ${r.R.cols}c)\n`
  + `   lidGap CSS    px  L=${num(r.L.lidGapPx === null ? null : r.L.lidGapPx / r.ratio)}  R=${num(r.R.lidGapPx === null ? null : r.R.lidGapPx / r.ratio)}`);

let code = 0;
if (SELFTEST) {
  let pass = 0, n = 0;
  const chk = (label, ok, detail) => {
    n++; if (ok) pass++; else code = 1;
    console.log(`${ok ? ' ok ' : 'FAIL'} ${n}. ${label}${detail ? `  — ${detail}` : ''}`);
  };
  const base = await measure({ png: false });
  console.log(`base   ${fmt(base)}`);
  if (base.fatal) { console.error(`!! the BASELINE is fatal: ${base.fatal}`); await browser.close(); process.exit(2); }

  chk('PAINTED: the LIT drawing buffer has real content before anything is ablated',
    base.lit.stdev > FLOOR, `stdev=${num(base.lit.stdev, 4)} > ${FLOOR}`);
  chk('NON-EMPTY: brow, lash and sclera all resolve AND draw px, BOTH sides, finite lidGap (arms 3-5 assert over this)',
    base.meshes.brow > 0 && base.meshes.lid > 0 && base.meshes.eye > 0
    && base.px.brow > 0 && base.px.lid > 0 && base.px.eye > 0
    && base.L.lidGapPx !== null && base.R.lidGapPx !== null,
    `meshes ${base.meshes.brow}/${base.meshes.lid}/${base.meshes.eye} px ${base.px.brow}/${base.px.lid}/${base.px.eye} L=${base.L.lidGapPx} R=${base.R.lidGapPx}`);

  const collide = await measure({ browSpec: 'brow', lidSpec: 'eye_lash', eyeSpec: 'eye', png: false });
  chk('COLLIDE: substring specs (`--eye eye` claims `eye_lash`) are FATAL here too, not a confident lid = 0 px',
    collide.fatal !== undefined && collide.code === 4 && /COLLIDE/.test(collide.fatal),
    collide.fatal ? collide.fatal.slice(0, 72) : `NO FATAL — lidPx=${collide.px?.lid}`);

  const up = await measure({ nudge: 0.02, png: false });
  chk('MOVES: +0.02 m page-side lifts the brow -> lidGapPx GROWS',
    up.lidGapPx > base.lidGapPx, `${base.lidGapPx} -> ${up.lidGapPx}`);

  // ── 5. HOLDS. THE ASSERTION WAS REVERSED; THE OLD WORDING IS KEPT ABOVE IT ──
  // WAS: "an identical run reproduces EVERY number EXACTLY — the null is 0", over
  //      `lidGapPx`, `L`, `R` AND `px.brow/lid/eye`.
  // It FAILED, and it was right to: `browPx 110 -> 112` between two identical runs.
  // Unlike `preview.html?shot=1`, the menu portrait is NOT a frozen frame — it runs an
  // idle animation and `charStage`'s own intro on the wall clock, so the pose at the
  // shutter differs by a frame or two and the ANTIALIASED EDGE COUNT moves with it.
  // That is a real property of this screen, not a bug to threshold away.
  // NOW: the drift control is asserted over the statistics this tool actually QUOTES —
  // the per-side lidGap medians and the buffer integer — and the pixel counts are
  // printed as data rather than asserted. `--repeat N` measures the null on the
  // medians directly, which is the honest floor for any A/B quoted off this tool.
  const again = await measure({ png: false });
  chk('HOLDS (THE DRIFT CONTROL): an identical run reproduces the QUOTED medians and the buffer integer exactly',
    again.lidGapPx === base.lidGapPx && again.L.lidGapPx === base.L.lidGapPx
    && again.R.lidGapPx === base.R.lidGapPx && again.buffer.w === base.buffer.w,
    `lidGap ${base.lidGapPx}/${again.lidGapPx}  L ${base.L.lidGapPx}/${again.L.lidGapPx}  R ${base.R.lidGapPx}/${again.R.lidGapPx}`
    + `  [browPx ${base.px.brow}/${again.px.brow} DRIFTS — not asserted, see above]`);

  const blank = await measure({ blank: true, png: false });
  chk('BLANK: clearing the buffer makes the PAINTED floor FAIL (a floor never shown to fail is decoration)',
    !blank.fatal && blank.lit.stdev <= FLOOR, `stdev ${num(base.lit.stdev, 4)} -> ${num(blank.lit?.stdev, 4)}`);

  console.log(`\nbxv_portrait --selftest: ${pass}/${n}`);
} else if (REPEAT > 1) {
  // The NULL, measured rather than assumed. The menu portrait animates on the wall
  // clock, so identical arms do not have to agree; how far they disagree IS the
  // resolution floor for anything quoted off this tool.
  const Ls = [], Rs = [];
  let first = null;
  for (let i = 0; i < REPEAT; i++) {
    const r = await measure({ png: false });
    if (r.fatal) { console.error(`!! ${r.fatal}`); code = r.code ?? 5; break; }
    if (!first) first = r;
    Ls.push(r.L.lidGapPx); Rs.push(r.R.lidGapPx);
    console.log(`${LABEL.padEnd(8)} run ${i + 1}/${REPEAT}  L=${r.L.lidGapPx} R=${r.R.lidGapPx}  browPx=${r.px.brow} lidPx=${r.px.lid} eyePx=${r.px.eye}  buf ${r.buffer.w}x${r.buffer.h}`);
  }
  if (first) {
    const rng = (v) => `${Math.min(...v)}..${Math.max(...v)} (spread ${Math.max(...v) - Math.min(...v)})`;
    console.log(`${LABEL.padEnd(8)} NULL over ${Ls.length} identical runs   L ${rng(Ls)}   R ${rng(Rs)}   ratio ${num(first.ratio, 3)} buf ${first.buffer.w}x${first.buffer.h}`);
    console.log(`${LABEL.padEnd(8)} CSS px   L ${(Math.min(...Ls) / first.ratio).toFixed(2)}..${(Math.max(...Ls) / first.ratio).toFixed(2)}   R ${(Math.min(...Rs) / first.ratio).toFixed(2)}..${(Math.max(...Rs) / first.ratio).toFixed(2)}`);
  }
} else {
  const r = await measure();
  if (r.fatal) { console.error(`!! ${r.fatal}`); code = r.code ?? 5; }
  else if (r.lit.stdev <= FLOOR) {
    console.error(`!! PAINT FLOOR FAILED: litStdev ${num(r.lit.stdev, 4)} <= ${FLOOR}. Nothing was drawn.`);
    code = 3;
  } else {
    console.log(`${LABEL.padEnd(8)} ${fmt(r)}`);
    if (JSON_OUT) {
      await mkdir(dirname(JSON_OUT), { recursive: true });
      await writeFile(JSON_OUT, JSON.stringify({ tool: 'bxv_portrait.mjs', label: LABEL, id: ID, viewport: { W, H, DSF }, ...r }, null, 2));
      console.log(`wrote ${JSON_OUT}`);
    }
  }
}

await browser.close();
process.exit(code);
