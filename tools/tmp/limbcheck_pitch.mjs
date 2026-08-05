#!/usr/bin/env node
/**
 * THROWAWAY read-only probe — the ACCEPTANCE TEST for the limb-burial work.
 *
 * Same instrument as `tools/tmp/charprobe.mjs --mode chars` (identical `plain()`
 * render, identical chroma key, identical hide-vs-isolate diff) so its numbers are
 * directly comparable to the recorded baseline in `shots/probe/chars.json`. Three
 * things are added, each because the fix has a failure mode in BOTH directions:
 *
 *  1. **`anim`** — the baseline measured idle t=1.5 only and flagged that as
 *     unverified. Arms can swing clear during a run, so a character that is armless
 *     standing still may not be while moving, and vice versa. Both are measured.
 *
 *  2. **Detachment** (`docs/LESSONS.md` §1 in reverse). Egg's arms are currently
 *     BURIED's opposite failure: floating clear of the shell with background between
 *     limb and body. Measured as connected components of the final silhouette — any
 *     component that does not contain the head is a detached part, and its pixels are
 *     reported. A fix that pushes a limb out of the mass and past its edge fails here
 *     instead of passing there, which is what stops the correction overshooting.
 *
 *  3. **Figure/ground**, on the shipped post-processed frame, so the preview backdrop
 *     change can be verified and hotdog's 0.10 floor can be tracked from here rather
 *     than needing a full game boot for every iteration.
 *
 * PASS, per character per anim:
 *   every limb group with footprint >= 700 px delivers >= 0.50 of it, and
 *   detached limb pixels are 0.
 */
/**
 * capture-audit: css-immune — `gl.readPixels()` on `preview.html`, exactly as `limbcheck.mjs`, with the camera pitch
 * as a parameter. Nothing in the verdict passes through CSS.
 */
import { chromium } from 'playwright';
import { mkdir, writeFile } from 'node:fs/promises';

const LAUNCH_ARGS = ['--use-gl=angle', '--use-angle=swiftshader', '--enable-unsafe-swiftshader',
  '--enable-webgl', '--ignore-gpu-blocklist', '--disable-gpu-sandbox'];
const a = process.argv;
const get = (k, d) => (a.includes(k) ? a[a.indexOf(k) + 1] : d);
const BASE = process.env.PREVIEW_BASE ?? 'http://localhost:5173';
const OUT = get('--out', 'shots/probe/limb');
const TAG = get('--tag', 'run');
const IDS = get('--ids', 'hamburger,donut,taco,burrito,egg,lollipop,pizza,sushi,soup,waterbottle,hotdog').split(',');
const ANIMS = get('--anims', 'idle,run').split(',');
/** Run is sampled at two stride phases; the WORST of the two is what is reported. */
const TS = get('--t', '1.5').split(',').map(Number);
const W = Number(get('--w', 640)), H = Number(get('--h', 800));
const VERBOSE = a.includes('--verbose');
const FOOT_MIN = Number(get('--footMin', 700));
const RATIO_MIN = Number(get('--ratioMin', 0.5));
/**
 * ── THE ONLY CHANGE FROM `limbcheck.mjs` ─────────────────────────────────────
 * Camera pitch, in degrees, handed to `preview.html?pitch=`.
 *
 * `limbcheck.mjs` inherits `preview.ts`'s character default of **22°**. The MATCH
 * camera is **58°** (`arena-scan.mjs` header, and `preview.ts`'s own arena piece uses
 * 58 for the same reason). The limb-delivery failure this metric exists to measure is
 * a PROJECTION problem — a limb is buried when the food mass's silhouette covers it —
 * and the projection of a vertical limb onto a screen shortens as cos(pitch) while the
 * body's own top surface grows as sin(pitch). So the metric is not obviously
 * pitch-invariant, and two full character passes have been steered by the 22° figure.
 *
 * `docs/LESSONS.md` §6: judge at shipped framing, or the score measures the harness.
 * Everything else in this file — the chroma key, the hide-vs-isolate diff, the
 * connected-component detachment test, the pass rule — is byte-identical to
 * `limbcheck.mjs`, so the two runs are directly comparable and any delta is PITCH.
 */
const PITCH = Number(get('--pitch', 22));

const HMR_STUB = `const noop=()=>{};
export const createHotContext=()=>({accept:noop,acceptExports:noop,dispose:noop,prune:noop,
  invalidate:noop,on:noop,off:noop,send:noop,decline:noop,data:{}});
export const injectQuery=(u)=>u; export const updateStyle=noop; export const removeStyle=noop;
export const ErrorOverlay=class{}; export default {};`;

const LIMBS = ['shoulderL', 'shoulderR', 'elbowL', 'elbowR', 'handL', 'handR',
  'hipL', 'hipR', 'kneeL', 'kneeR', 'footL', 'footR'];

const TOOLKIT = () => {
  const stage = window.__stage, scene = stage.scene, renderer = stage.renderer;
  const gl = renderer.getContext(), cv = renderer.domElement;
  const W = cv.width, H = cv.height;
  const K = {}; window.__K = K;
  K.stage = stage; K.scene = scene; K.W = W; K.H = H;
  K.read = () => { const p = new Uint8Array(W * H * 4); gl.readPixels(0, 0, W, H, gl.RGBA, gl.UNSIGNED_BYTE, p); return p; };
  K.plain = (clear = 0x00ff00) => {
    const fog = scene.fog, bg = scene.background, sh = renderer.shadowMap.enabled;
    scene.fog = null; scene.background = null; renderer.shadowMap.enabled = false;
    renderer.setRenderTarget(null); renderer.setClearColor(clear, 1); renderer.clear();
    renderer.render(scene, stage.rig.camera);
    const px = K.read();
    scene.fog = fog; scene.background = bg; renderer.shadowMap.enabled = sh;
    return px;
  };
  K.root = null;
  for (const c of scene.children) {
    if (c.isLight || c.name === 'preview_ground' || c.name === 'lighting') continue;
    let has = false; c.traverse((o) => { if (o.name === 'head') has = true; });
    if (has) { K.root = c; break; }
  }
  K.ground = scene.getObjectByName('preview_ground') ?? null;
  K.meshes = () => { const out = []; K.root.traverse((o) => { if (o.isMesh) out.push(o); }); return out; };
  K.maskFrom = (px) => {
    const m = new Uint8Array(W * H);
    for (let i = 0, j = 0; i < px.length; i += 4, j++) m[j] = (px[i] < 60 && px[i + 1] > 180 && px[i + 2] < 60) ? 0 : 1;
    return m;
  };
  K.bboxOf = (m) => {
    let x0 = 1e9, x1 = -1e9, y0 = 1e9, y1 = -1e9, n = 0;
    for (let y = 0; y < H; y++) for (let x = 0; x < W; x++) {
      if (!m[y * W + x]) continue;
      n++; if (x < x0) x0 = x; if (x > x1) x1 = x; if (y < y0) y0 = y; if (y > y1) y1 = y;
    }
    return n ? { x0, x1, y0, y1, w: x1 - x0 + 1, h: y1 - y0 + 1, n } : null;
  };
  K.JOINTS = ['face', 'head', 'neck', 'torso', 'hips', 'shoulderL', 'shoulderR', 'elbowL', 'elbowR',
    'handL', 'handR', 'hipL', 'hipR', 'kneeL', 'kneeR', 'footL', 'footR', 'rig_body', 'rig_root'];
  K.groupKey = (o) => {
    let n = o;
    while (n) { if (K.JOINTS.includes(n.name)) return n.name; if (n === K.root) break; n = n.parent; }
    return 'other';
  };
};

const MEASURE = ({ t, anim }) => {
  const K = window.__K;
  const { W, H, stage, scene } = K;
  window.__preview.frameAt(t, { anim, remount: true });
  // `frameAt` REMOUNTS the character, so the root captured by TOOLKIT is stale — a
  // disposed group that renders nothing. Re-resolve it every sample.
  K.root = null;
  for (const c of scene.children) {
    if (c.isLight || c.name === 'preview_ground' || c.name === 'lighting') continue;
    let has = false; c.traverse((o) => { if (o.name === 'head') has = true; });
    if (has) { K.root = c; break; }
  }

  const all = K.meshes();
  const gv = K.ground ? K.ground.visible : null;
  if (K.ground) K.ground.visible = false;

  const base = K.plain();
  const maskAll = K.maskFrom(base);
  const bboxAll = K.bboxOf(maskAll);

  const groups = new Map();
  for (const m of all) {
    const k = K.groupKey(m);
    if (!groups.has(k)) groups.set(k, []);
    groups.get(k).push(m);
  }
  // ── the food mass, alone ───────────────────────────────────────────────────
  // The occluder every limb has to negotiate. Measured in SCREEN space rather than
  // from world geometry, because that is the space the failure happens in: a limb is
  // buried when the mass's silhouette covers it and detached when nothing of the mass
  // is anywhere near it. Both are pixel facts, and both directions have to be scored
  // or the fix for one becomes the other (Finding 7).
  const MASS_GROUPS = ['head', 'face', 'neck', 'torso', 'hips'];
  {
    const prev = all.map((m) => m.visible);
    all.forEach((m) => { m.visible = MASS_GROUPS.includes(K.groupKey(m)); });
    const iso = K.plain();
    all.forEach((m, i) => { m.visible = prev[i]; });
    K.massMask = K.maskFrom(iso);
  }
  // Distance from the food mass, capped — a multi-source BFS, so `gapPx` below is an
  // exact 4-connected distance rather than a bbox approximation.
  const CAP = 60;
  const dist = new Int16Array(W * H).fill(CAP);
  {
    const q = new Int32Array(W * H);
    let head = 0, tail = 0;
    for (let j = 0; j < W * H; j++) if (K.massMask[j]) { dist[j] = 0; q[tail++] = j; }
    while (head < tail) {
      const p = q[head++];
      const d = dist[p] + 1;
      if (d >= CAP) continue;
      const x = p % W, y = (p / W) | 0;
      if (x > 0 && dist[p - 1] > d) { dist[p - 1] = d; q[tail++] = p - 1; }
      if (x < W - 1 && dist[p + 1] > d) { dist[p + 1] = d; q[tail++] = p + 1; }
      if (y > 0 && dist[p - W] > d) { dist[p - W] = d; q[tail++] = p - W; }
      if (y < H - 1 && dist[p + W] > d) { dist[p + W] = d; q[tail++] = p + W; }
    }
  }

  const parts = [];
  const groupMask = {};
  for (const [key, meshes] of groups) {
    const set = new Set(meshes);
    const prev = all.map((m) => m.visible);
    meshes.forEach((m) => { m.visible = false; });
    const hid = K.plain();
    all.forEach((m, i) => { m.visible = prev[i]; });
    let contrib = 0;
    for (let i = 0; i < base.length; i += 4) {
      const d = Math.abs(base[i] - hid[i]) + Math.abs(base[i + 1] - hid[i + 1]) + Math.abs(base[i + 2] - hid[i + 2]);
      if (d > 12) contrib++;
    }
    all.forEach((m) => { m.visible = set.has(m); });
    const iso = K.plain();
    all.forEach((m, i) => { m.visible = prev[i]; });
    const im = K.maskFrom(iso);
    const ib = K.bboxOf(im);
    if (K.JOINTS.includes(key)) groupMask[key] = im;
    // How this limb sits against the food mass: `ovl` = share of the limb's own
    // footprint that the mass silhouette covers (burial pressure), `gapPx` = closest
    // this limb ever gets to the mass (0 = touching, i.e. attached).
    let ovl = 0, gapPx = CAP;
    let needPx = null;
    if (ib && ib.n) {
      for (let j = 0; j < W * H; j++) {
        if (!im[j]) continue;
        if (K.massMask[j]) ovl++;
        if (dist[j] < gapPx) gapPx = dist[j];
      }
      ovl = +(ovl / ib.n).toFixed(3);
      // ── how far OUT does this limb have to move? ────────────────────────────
      // On the rows the limb occupies, compare the mass's outer edge with the
      // limb's own INNER edge, on the limb's own side. Positive = the mass still
      // reaches past the limb's inner edge by this many px, i.e. the limb is
      // buried by that much; negative = the limb's inner edge is already clear of
      // the mass by that much, i.e. it is detached by that much. Zero is the
      // straddle the window wants. Reported in METRES so it can be typed straight
      // into a `shoulderWidth` / `stanceWidth`.
      const side = key.endsWith('L') ? -1 : key.endsWith('R') ? 1 : 0;
      if (side !== 0) {
        const diffs = [];
        for (let y = ib.y0; y <= ib.y1; y++) {
          let limbInner = null, massOuter = null;
          for (let x = 0; x < W; x++) {
            const xx = side > 0 ? x : W - 1 - x; // scan inward-to-outward on this side
            const j = y * W + xx;
            if (im[j] && limbInner === null) limbInner = xx;
            if (K.massMask[j]) massOuter = xx;
          }
          // massOuter as scanned is the OUTERMOST mass pixel on this side
          if (limbInner === null || massOuter === null) continue;
          diffs.push(side > 0 ? massOuter - limbInner : limbInner - massOuter);
        }
        if (diffs.length) {
          diffs.sort((p, q) => p - q);
          needPx = diffs[Math.floor(diffs.length / 2)];
        }
      }
    }
    parts.push({
      part: key, foot: ib ? ib.n : 0, contrib,
      ratio: ib && ib.n ? +(contrib / ib.n).toFixed(3) : null,
      ovl, gapPx, needPx,
    });
  }

  // ── detachment: connected components of the FINAL silhouette ────────────────
  const comp = new Int32Array(W * H).fill(-1);
  const stack = new Int32Array(W * H);
  const sizes = [];
  for (let j0 = 0; j0 < W * H; j0++) {
    if (!maskAll[j0] || comp[j0] >= 0) continue;
    const id = sizes.length;
    let sp = 0; stack[sp++] = j0; comp[j0] = id;
    let n = 0;
    while (sp > 0) {
      const p = stack[--sp]; n++;
      const x = p % W, y = (p / W) | 0;
      if (x > 0 && maskAll[p - 1] && comp[p - 1] < 0) { comp[p - 1] = id; stack[sp++] = p - 1; }
      if (x < W - 1 && maskAll[p + 1] && comp[p + 1] < 0) { comp[p + 1] = id; stack[sp++] = p + 1; }
      if (y > 0 && maskAll[p - W] && comp[p - W] < 0) { comp[p - W] = id; stack[sp++] = p - W; }
      if (y < H - 1 && maskAll[p + W] && comp[p + W] < 0) { comp[p + W] = id; stack[sp++] = p + W; }
    }
    sizes.push(n);
  }
  // The body component is the largest one (the food mass dominates every character).
  let main = 0;
  for (let i = 1; i < sizes.length; i++) if (sizes[i] > sizes[main]) main = i;
  const islands = sizes.filter((n) => n >= 40).length;
  // Which limb groups have visible pixels sitting in a NON-main component?
  const detached = {};
  let detachedPx = 0;
  for (const key of Object.keys(groupMask)) {
    if (!LIMB_SET.includes(key)) continue;
    const gm = groupMask[key];
    let off = 0;
    for (let j = 0; j < W * H; j++) if (gm[j] && maskAll[j] && comp[j] !== main) off++;
    if (off > 0) { detached[key] = off; detachedPx += off; }
  }

  if (K.ground) K.ground.visible = gv;

  // ── figure/ground on the SHIPPED post-processed frame ──────────────────────
  const inner = new Uint8Array(W * H), outer = new Uint8Array(W * H);
  for (let y = 6; y < H - 6; y++) for (let x = 6; x < W - 6; x++) {
    const j = y * W + x;
    if (!maskAll[j]) continue;
    if (maskAll[j - 1] && maskAll[j + 1] && maskAll[j - W] && maskAll[j + W]) continue;
    for (let dy = -6; dy <= 6; dy++) for (let dx = -6; dx <= 6; dx++) {
      const k = (y + dy) * W + (x + dx);
      if (maskAll[k]) inner[k] = 1; else outer[k] = 1;
    }
  }
  stage.render(0); stage.render(0);
  const px = K.read();
  let lb = 0, nb = 0, lf = 0, nf = 0, li = 0, ni = 0, lo = 0, no = 0;
  for (let j = 0; j < W * H; j++) {
    const i = j * 4;
    const L = (0.2126 * px[i] + 0.7152 * px[i + 1] + 0.0722 * px[i + 2]) / 255;
    if (maskAll[j]) { lb += L; nb++; if (inner[j]) { li += L; ni++; } }
    else { lf += L; nf++; if (outer[j]) { lo += L; no++; } }
  }
  const f = (v) => +v.toFixed(4);

  return {
    charBBox: bboxAll ? [bboxAll.x0, bboxAll.y0, bboxAll.w, bboxAll.h, bboxAll.n] : null,
    parts: parts.sort((p, q) => (p.ratio ?? 9) - (q.ratio ?? 9)),
    islands, componentSizes: sizes.filter((n) => n >= 40).sort((p, q) => q - p).slice(0, 8),
    detached, detachedPx,
    // Scale, so `needPx` can be read as metres and typed into a rig constant.
    pxPerM: bboxAll ? +(bboxAll.h / Math.max(0.01, window.__preview.info().height ?? 2.1)).toFixed(1) : null,
    // `types.ts` convention #1 is "feet at y=0"; the cast violates it by -0.08 to
    // -0.25m standing still, which is both a floor-intersection bug and part of the
    // "feet with no legs" read.
    footY: window.__preview.info().footY,
    modelH: window.__preview.info().height,
    bodyLuma: f(lb / Math.max(1, nb)), frameLuma: f(lf / Math.max(1, nf)),
    bodyMinusFrame: f(lb / Math.max(1, nb) - lf / Math.max(1, nf)),
    edgeMinusRing: f(li / Math.max(1, ni) - lo / Math.max(1, no)),
  };
};

const browser = await chromium.launch({ args: LAUNCH_ARGS });
await mkdir(OUT, { recursive: true });
console.log(`limbcheck @ pitch ${PITCH}deg  (preview default 22, MATCH camera 58)  base ${BASE}`);
const results = {};
try {
  for (const id of IDS) {
    const page = await browser.newPage({ viewport: { width: W, height: H }, deviceScaleFactor: 1 });
    page.on('pageerror', (e) => console.error('PAGEERROR', String(e)));
    page.on('console', (m) => { if (m.type() === 'error') console.error('CONSOLE', m.text()); });
    await page.route('**/@vite/client*', (r) => r.fulfill({ status: 200, contentType: 'text/javascript', body: HMR_STUB }));
    try {
      await page.goto(`${BASE}/preview.html?piece=character&id=${id}&anim=idle&t=1.5&shot=1&pitch=${PITCH}`, { waitUntil: 'networkidle', timeout: 120000 });
      await page.waitForFunction('window.__previewReady === true', null, { timeout: 120000 });
      await page.evaluate(TOOLKIT);
      await page.evaluate((L) => { window.LIMB_SET = L; }, LIMBS);
      results[id] = {};
      for (const anim of ANIMS) {
        const ts = anim === 'run' ? TS : [TS[0]];
        let worst = null;
        for (const t of ts) {
          const r = await page.evaluate(MEASURE, { t, anim });
          r.t = t;
          // `--verbose` prints EVERY sampled phase, not just the worst. Added because
          // "the trailing leg is invisible at run" has two very different causes with
          // the same summary line: a body-plan defect that holds all cycle, or one
          // extreme of the stride where the leg genuinely is behind the character.
          // Only the per-phase spread can tell them apart. Reporting only — the
          // pass/fail metric below is untouched.
          if (VERBOSE) {
            const legs = r.parts.filter((p) => ['hipL', 'hipR', 'kneeL', 'kneeR', 'footL', 'footR'].includes(p.part))
              .sort((p, q) => p.part.localeCompare(q.part))
              .map((p) => `${p.part}=${String(p.ratio).padEnd(5)}(ovl ${p.ovl})`).join(' ');
            console.log(`      t=${t.toFixed(3)} ${legs}`);
          }
          if (!worst) worst = r;
          else {
            // keep the sample with the most failing limbs, then the most detached px
            const bad = (x) => x.parts.filter((p) => LIMBS.includes(p.part) && p.foot >= FOOT_MIN && (p.ratio ?? 0) < RATIO_MIN).length;
            if (bad(r) > bad(worst) || (bad(r) === bad(worst) && r.detachedPx > worst.detachedPx)) worst = r;
          }
        }
        const limbParts = worst.parts.filter((p) => LIMBS.includes(p.part));
        const gated = limbParts.filter((p) => p.foot >= FOOT_MIN);
        const fails = gated.filter((p) => (p.ratio ?? 0) < RATIO_MIN).map((p) => `${p.part}:${p.foot}/${p.ratio}`);
        let wasted = 0, tot = 0;
        for (const p of limbParts) { tot += p.foot; wasted += p.foot * (1 - (p.ratio ?? 0)); }
        worst.wastedPct = +(100 * wasted / Math.max(1, tot)).toFixed(1);
        worst.fails = fails;
        worst.pass = fails.length === 0 && worst.detachedPx === 0;
        results[id][anim] = worst;
        console.log(`${worst.pass ? 'PASS' : 'FAIL'} ${id.padEnd(12)} ${anim.padEnd(5)} wasted ${String(worst.wastedPct).padStart(5)}%  detached ${String(worst.detachedPx).padStart(5)}px (islands ${worst.islands})  b-f ${worst.bodyMinusFrame >= 0 ? '+' : ''}${worst.bodyMinusFrame}  ${fails.join(' ') || '-'}`);
      }
    } catch (e) {
      console.error(`✗ ${id}: ${e}`);
      results[id] = { error: String(e) };
    } finally { await page.close(); }
  }
} finally { await browser.close(); }
await writeFile(`${OUT}/${TAG}.json`, JSON.stringify(results, null, 2));
console.log(`\nwrote ${OUT}/${TAG}.json`);
const allPass = Object.values(results).every((r) => !r.error && Object.values(r).every((x) => x.pass));
console.log(allPass ? 'ALL PASS' : 'FAILURES PRESENT');
