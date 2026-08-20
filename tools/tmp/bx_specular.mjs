#!/usr/bin/env node
/**
 * bx_specular — is the BROW still ink, or has it gone MIRROR again?
 *
 * THROWAWAY, read-only on `src/`. Measurement instrument; changes no game code.
 *
 * ── WHY IT EXISTS ────────────────────────────────────────────────────────────
 * `062513c` fixed a defect only the MATCH camera can see: a flat ink plate on this
 * crown is *"a mirror aimed at the match camera"*. `hamburger.ts`'s `browGeometry`
 * header carries the arithmetic — `lighting.ts`'s front fill is a `DirectionalLight` at
 * **8 deg**, the crown normal at the face's hFrac 0.62 is **32.3 deg**, and the
 * half-vector between an 8 deg light and a 58 deg eye is **33 deg**. 0.7 deg off the
 * mirror direction, so at roughness 0.42 the whole stroke lifted to `#eef4ff` grey.
 * It was fixed physically (bend the plate + roughness 0.90 + `rim: false`).
 *
 * **Moving the brow moves it back through that band**, and nothing already in the tree
 * measures it: `bw_brow` paints every part a flat unlit colour, so it is structurally
 * blind to a specular lift — the one instrument you would reach for first cannot see
 * this defect at all. `bw_shot` renders it but returns no number.
 *
 * ── WHAT IT MEASURES ─────────────────────────────────────────────────────────
 * Two renders of ONE page, ONE camera, in this order and the order matters:
 *   1. LIT     the shipped materials, `renderer.render(scene, rig.camera)`, readPixels.
 *   2. MASK    every mesh painted flat black, the brow plates painted white, rendered
 *              again. Depth is untouched, so a brow behind the bun stays masked out.
 * The mask is then applied to the LIT buffer and the tool reports, per side:
 *   lumaMean / lumaP95 / lumaMax over the brow's own pixels, and `greyFrac`, the share
 *   of them above `--grey` (default 0.35 — ink is ~0.05, the `#eef4ff` fill is ~0.95).
 * Sides are split at the midpoint of the mask's own bounding box, derived not typed.
 *
 * ⚠️ THE PASSES RUN IN THAT ORDER BECAUSE THE MASK PASS DESTROYS THE MATERIALS.
 * There is no restore step and there must not be one: a restore that silently failed
 * would make every LIT number a number about flat black paint.
 *
 * ⚠️ `renderer.render()` IS CALLED DIRECTLY, NOT `stage.render()`, so `CameraRig.update()`
 * never runs and the shake cannot re-randomise between the two passes
 * (`docs/AGENT-BRIEF.md` §3). The two buffers are therefore the same camera by
 * construction rather than by tolerance — which arm 4 then checks rather than assumes.
 *
 * ── KNOWN-BADS (`--selftest`). A guard not shown to FAIL is not a guard. ──────
 *   1 NON-EMPTY  the brow mask is non-empty ON BOTH SIDES before any luma is quoted.
 *                Arms 2-4 all assert over that mask; `[].every()` is `true`, and a
 *                mis-typed `--brow` would otherwise turn all three green at once.
 *   2 MASK IS THE BROW  hide the brow meshes and the mask must go EMPTY. A mask that
 *                survives its own subject is a mask of something else — the failure
 *                that put 101,125 px of a non-existent lid into this tool's neighbour.
 *   3 MIRROR     force the brow material to `roughness 0.05` — a mirror, which is what
 *                the pre-`062513c` plate effectively was at this normal — and the
 *                masked luma MUST RISE. This is the defect being guarded against,
 *                reproduced on the live material rather than on a synthetic fixture.
 *   4 HOLDS      a second identical run reproduces `lumaMean` EXACTLY. The render is
 *                deterministic and the camera is not stepped, so this is an equality.
 *
 *   PREVIEW_BASE=<snapshot> node tools/tmp/bx_specular.mjs --id hamburger --brow =brow --pitch 58
 *   PREVIEW_BASE=<snapshot> node tools/tmp/bx_specular.mjs --selftest --id hamburger --brow =brow --pitch 58
 */
import { chromium } from 'playwright';

const a = process.argv;
const get = (k, d) => (a.includes(k) ? a[a.indexOf(k) + 1] : d);
const BASE = process.env.PREVIEW_BASE ?? get('--url', null);
const ID = get('--id', 'hamburger');
const BROW = get('--brow', '=brow');
const PITCH = Number(get('--pitch', '58'));
const YAWS = get('--yaws', '0').split(',').map(Number);
const FILL = Number(get('--fill', '0.60'));
const GREY = Number(get('--grey', '0.35'));
const SELFTEST = a.includes('--selftest');

if (!BASE) { console.error('need PREVIEW_BASE or --url'); process.exit(2); }

const T = 1.5, ANIM = 'idle';
const W = 900, H = 1400;
const LAUNCH_ARGS = ['--use-gl=angle', '--use-angle=swiftshader', '--enable-unsafe-swiftshader',
  '--enable-webgl', '--ignore-gpu-blocklist', '--disable-gpu-sandbox'];
const HMR_STUB = `const noop=()=>{};
export const createHotContext=()=>({accept:noop,acceptExports:noop,dispose:noop,prune:noop,
  invalidate:noop,on:noop,off:noop,send:noop,decline:noop,data:{}});
export const injectQuery=(u)=>u; export const updateStyle=noop; export const removeStyle=noop;
export const ErrorOverlay=class{}; export default {};`;

const browser = await chromium.launch({ args: LAUNCH_ARGS });

async function measure(opts = {}) {
  const yaw = opts.yaw ?? YAWS[0];
  const page = await browser.newPage({ viewport: { width: W, height: H }, deviceScaleFactor: 1 });
  await page.route('**/@vite/client', (r) => r.fulfill({ status: 200, contentType: 'application/javascript', body: HMR_STUB }));
  const url = `${BASE}/preview.html?piece=character&id=${ID}&pitch=${opts.pitch ?? PITCH}&yaw=${yaw}`
    + `&fill=${FILL}&t=${T}&anim=${ANIM}&shot=1&bg=3d2b21`;
  await page.goto(url, { waitUntil: 'load', timeout: 120_000 });
  await page.waitForFunction('window.__previewReady === true && !!window.__stage', null, { timeout: 180_000 });

  const res = await page.evaluate(({ brow, hide, mirror, grey }) => {
    const st = window.__stage;
    const gl = st.renderer.getContext();
    const cv = st.renderer.domElement;
    const w = cv.width, h = cv.height;

    // Resolve the brow plates. `=name` is EXACT after hull-stripping, matching
    // `bw_brow.mjs`'s spec grammar so one syntax covers both tools. The inverted-hull
    // ink is deliberately EXCLUDED: the hull is unlit ink by construction and can only
    // dilute the statistic, and the mirror defect is a property of the PLATE's normal.
    const exact = brow.startsWith('=');
    const want = exact ? brow.slice(1) : brow;
    const plates = [];
    st.scene.traverse((o) => {
      if (!o.isMesh || !o.name) return;
      if (o.name.endsWith('__outline')) return;
      if (exact ? o.name !== want : !o.name.includes(want)) return;
      plates.push(o);
    });
    if (!plates.length) return { fatal: `BROW MATCHED NOTHING for "${brow}"`, code: 4 };

    if (hide) for (const o of plates) o.visible = false;
    if (mirror) {
      for (const o of plates) {
        // The live material, mutated in place. A cloned stand-in would prove only that
        // a clone can be made shiny; the arm has to move the material the frame uses.
        o.material.roughness = 0.05;
        o.material.needsUpdate = true;
      }
    }

    const readBuf = () => {
      const b = new Uint8Array(w * h * 4);
      gl.readPixels(0, 0, w, h, gl.RGBA, gl.UNSIGNED_BYTE, b);
      return b;
    };

    // ── PASS 1: LIT ────────────────────────────────────────────────────────
    st.renderer.render(st.scene, st.rig.camera);
    const lit = readBuf();

    // ── PASS 2: MASK. Destroys the materials; nothing is read from the scene after.
    let basicProto = null;
    st.scene.traverse((o) => {
      if (basicProto) return;
      if (o.isMesh && o.material && o.material.isMeshBasicMaterial) basicProto = o.material;
    });
    if (!basicProto) return { fatal: 'no MeshBasicMaterial in the scene to clone for the mask', code: 5 };
    const flat = (hex) => { const m = basicProto.clone(); m.color.set(hex); m.transparent = false; m.opacity = 1; return m; };
    st.scene.traverse((o) => {
      if (!o.isMesh || !o.material) return;
      const m = flat('#000000');
      m.transparent = !!o.material.transparent;
      m.opacity = o.material.opacity ?? 1;
      m.side = o.material.side;
      o.material = m;
    });
    for (const o of plates) { o.material = flat('#ffffff'); o.renderOrder = 501; }
    st.renderer.render(st.scene, st.rig.camera);
    const mask = readBuf();

    // ── APPLY ──────────────────────────────────────────────────────────────
    const lum = (i, b) => (0.2126 * b[i] + 0.7152 * b[i + 1] + 0.0722 * b[i + 2]) / 255;
    let x0 = w, x1 = -1;
    const cols = [];
    for (let y = 0; y < h; y++) {
      for (let x = 0; x < w; x++) {
        const i = (y * w + x) * 4;
        if (mask[i] < 200 || mask[i + 1] < 200 || mask[i + 2] < 200) continue;
        if (x < x0) x0 = x; if (x > x1) x1 = x;
        cols.push([x, lum(i, lit)]);
      }
    }
    const mid = x1 >= x0 ? (x0 + x1) / 2 : w / 2;
    const stat = (vals) => {
      if (!vals.length) return { n: 0, mean: null, p95: null, max: null, greyFrac: null };
      const s = vals.slice().sort((p, q) => p - q);
      return {
        n: vals.length,
        mean: vals.reduce((t, v) => t + v, 0) / vals.length,
        p95: s[Math.min(s.length - 1, Math.floor(s.length * 0.95))],
        max: s[s.length - 1],
        greyFrac: vals.filter((v) => v > grey).length / vals.length,
      };
    };
    const L = [], R = [], ALL = [];
    for (const [x, v] of cols) { ALL.push(v); (x <= mid ? L : R).push(v); }
    return { maskPx: cols.length, mid, L: stat(L), R: stat(R), all: stat(ALL) };
  }, { brow: BROW, hide: !!opts.hide, mirror: !!opts.mirror, grey: GREY });

  await page.close();
  return res;
}

const num = (v, d = 4) => (v === null || v === undefined ? 'n/a' : v.toFixed(d));
const line = (tag, r) => (r.fatal ? `${tag} FATAL: ${r.fatal}`
  : `${tag} maskPx=${String(r.maskPx).padStart(5)}  `
    + `L mean=${num(r.L.mean)} p95=${num(r.L.p95)} max=${num(r.L.max)} grey=${num(r.L.greyFrac, 3)} (${r.L.n}px)  `
    + `R mean=${num(r.R.mean)} p95=${num(r.R.p95)} max=${num(r.R.max)} grey=${num(r.R.greyFrac, 3)} (${r.R.n}px)`);

let code = 0;
if (SELFTEST) {
  let pass = 0, n = 0;
  const chk = (label, ok, detail) => {
    n++; if (ok) pass++; else code = 1;
    console.log(`${ok ? ' ok ' : 'FAIL'} ${n}. ${label}${detail ? `  — ${detail}` : ''}`);
  };

  const base = await measure();
  console.log(line('base  ', base));
  if (base.fatal) { console.error(`!! baseline is fatal: ${base.fatal}`); await browser.close(); process.exit(2); }

  // 1 — and it is FIRST because 2, 3 and 4 all assert over this mask.
  chk('NON-EMPTY: the brow mask is non-empty on BOTH sides before any luma is quoted',
    base.maskPx > 0 && base.L.n > 0 && base.R.n > 0,
    `maskPx=${base.maskPx} L=${base.L.n} R=${base.R.n}`);

  const hidden = await measure({ hide: true });
  chk('MASK IS THE BROW: hiding the brow plates empties the mask, it does not survive them',
    hidden.maskPx === 0,
    `maskPx ${base.maskPx} -> ${hidden.maskPx}`);

  const mirror = await measure({ mirror: true });
  console.log(line('mirror', mirror));
  chk('MIRROR: roughness 0.05 on the LIVE brow material LIFTS the masked luma (the 062513c defect)',
    mirror.all.mean > base.all.mean && mirror.all.max > base.all.max,
    `mean ${num(base.all.mean)} -> ${num(mirror.all.mean)}   max ${num(base.all.max)} -> ${num(mirror.all.max)}`);

  const again = await measure();
  chk('HOLDS: an identical second run reproduces lumaMean EXACTLY (deterministic, camera not stepped)',
    again.all.mean === base.all.mean && again.maskPx === base.maskPx,
    `mean ${num(base.all.mean, 8)}/${num(again.all.mean, 8)}  maskPx ${base.maskPx}/${again.maskPx}`);

  console.log(`\nbx_specular --selftest: ${pass}/${n}`);
} else {
  for (const yaw of YAWS) {
    const r = await measure({ yaw });
    if (r.fatal) { console.error(`!! ${r.fatal}`); code = r.code ?? 5; break; }
    console.log(line(`${ID.padEnd(11)} p${String(PITCH).padStart(2)} y${String(yaw).padStart(3)} `, r));
  }
}

await browser.close();
process.exit(code);
