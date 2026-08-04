#!/usr/bin/env node
/**
 * MENU PORTRAIT figure/ground probe — the instrument LESSONS §13 says must exist.
 *
 * §13: `src/preview.ts` and `src/ui/screens/charStage.ts` both cleared to a saturated
 * cyan `0x39b7e8`, which makes the character read DARKER than its surround
 * (contrast -0.40) while the real match makes it LIGHTER (+0.27). Opposite polarity.
 * Every A/B ever judged on the menu portrait was judged against a figure/ground
 * relationship the player never sees.
 *
 * This measures the polarity ON THE MENU SCREENS — home and character select — which
 * `bgsweep.mjs` (the preview-harness sibling) does not cover. Same method, so the two
 * numbers are comparable:
 *
 *   1. Render the character ALONE against an unmissable green clear -> silhouette mask.
 *   2. Render the screen normally -> measure.
 *   3. Report body luma, surround luma, body-minus-surround, and the 6px edge/ring pair
 *      (the ring is what a viewer's eye actually integrates against the silhouette).
 *
 * Reference numbers, from `tools/tmp/shipframe.mjs` on the shipped match framing:
 *   body 0.5411   frame 0.3250   body-frame +0.216   edge-ring +0.2063
 * and the §13 headline pair: preview -0.40 vs match +0.27.
 *
 * THE SWAY IS FROZEN. `charStage.update()` yaws +/-22 degrees off a wall clock, so an
 * unfrozen reading moves by more than the effect being measured. Everything below runs
 * inside ONE page.evaluate, with `rig.yawDeg` pinned, so rAF cannot advance between the
 * mask pass and the measured pass.
 *
 * Usage (snapshot only — LESSONS §5, and the server dies with its shell so chain it):
 *   URL=$(node tools/snapshot.mjs --json | ...) \
 *     && node tools/tmp/stage_fg.mjs --url "$URL" --label before
 *
 *   --screens home,characters      which menu routes to measure
 *   --ids hamburger,donut,egg      which fighters (character select can switch; home
 *                                  shows the equipped one, so home is measured once)
 *   --sweep "wall:floor,..."       hex pairs, swept in-page against the SAME mask
 */
import { chromium } from 'playwright';
import { mkdir, writeFile } from 'node:fs/promises';

const LAUNCH_ARGS = ['--use-gl=angle', '--use-angle=swiftshader', '--enable-unsafe-swiftshader',
  '--enable-webgl', '--ignore-gpu-blocklist', '--disable-gpu-sandbox'];

const argv = process.argv;
const get = (k, d) => (argv.includes(k) ? argv[argv.indexOf(k) + 1] : d);
const BASE = get('--url', process.env.PREVIEW_BASE ?? 'http://localhost:5173');
const LABEL = get('--label', 'run');
const OUT = get('--out', 'shots/stagefg');
const SCREENS = get('--screens', 'home,characters').split(',');
const IDS = get('--ids', '').split(',').filter(Boolean);
const SWEEP = get('--sweep', '').split(',').filter(Boolean);
const W = Number(get('--w', 1600));
const H = Number(get('--h', 900));

const HMR_STUB = `const noop=()=>{};
export const createHotContext=()=>({accept:noop,acceptExports:noop,dispose:noop,prune:noop,
  invalidate:noop,on:noop,off:noop,send:noop,decline:noop,data:{}});
export const injectQuery=(u)=>u; export const updateStyle=noop; export const removeStyle=noop;
export const ErrorOverlay=class{}; export default {};`;

/**
 * Runs entirely in-page. Returns one row per sweep candidate (or a single row when no
 * sweep is asked for), plus the framing readout so a fill regression is visible here too.
 */
const MEASURE = ({ pairs }) => {
  const stage = window.__stage;
  if (!stage || stage.disposed) return { error: 'no live stage' };
  const scene = stage.scene;
  const renderer = stage.renderer;
  const cam = stage.rig.camera;
  const ColorCtor = scene.background ? scene.background.constructor : null;
  const gl = renderer.getContext();
  const cv = renderer.domElement;
  const PW = cv.width;
  const PH = cv.height;
  const read = () => {
    const p = new Uint8Array(PW * PH * 4);
    gl.readPixels(0, 0, PW, PH, gl.RGBA, gl.UNSIGNED_BYTE, p);
    return p;
  };

  // Freeze the turntable. Without this the silhouette measured in the mask pass is not
  // the silhouette in the measured pass, and the whole number is noise.
  stage.rig.yawDeg = 0;
  stage.rig.update(0);
  stage.rig.update(0);

  // The character root: the only scene child with a descendant named `head`.
  let root = null;
  for (const c of scene.children) {
    if (c.isLight) continue;
    let has = false;
    c.traverse((o) => { if (o.name === 'head') has = true; });
    if (has) { root = c; break; }
  }
  if (!root) return { error: 'character root not found' };

  // ── mask pass ──────────────────────────────────────────────────────────────
  const hidden = [];
  for (const c of scene.children) {
    if (c === root || c.isLight || c.name === 'lighting') continue;
    if (c.visible) { hidden.push(c); c.visible = false; }
  }
  const fog = scene.fog;
  const bg = scene.background;
  const sh = renderer.shadowMap.enabled;
  scene.fog = null;
  scene.background = null;
  renderer.shadowMap.enabled = false;
  renderer.setRenderTarget(null);
  renderer.setClearColor(0x00ff00, 1);
  renderer.clear();
  renderer.render(scene, cam);
  const key = read();
  scene.fog = fog;
  scene.background = bg;
  renderer.shadowMap.enabled = sh;
  for (const c of hidden) c.visible = true;

  const mask = new Uint8Array(PW * PH);
  let area = 0;
  for (let j = 0; j < PW * PH; j++) {
    const i = j * 4;
    const isKey = key[i] < 60 && key[i + 1] > 180 && key[i + 2] < 60;
    mask[j] = isKey ? 0 : 1;
    if (!isKey) area++;
  }
  // 6px band either side of the silhouette edge.
  const inner = new Uint8Array(PW * PH);
  const outer = new Uint8Array(PW * PH);
  for (let y = 6; y < PH - 6; y++) {
    for (let x = 6; x < PW - 6; x++) {
      const j = y * PW + x;
      if (!mask[j]) continue;
      if (mask[j - 1] && mask[j + 1] && mask[j - PW] && mask[j + PW]) continue;
      for (let dy = -6; dy <= 6; dy++) {
        for (let dx = -6; dx <= 6; dx++) {
          const k = (y + dy) * PW + (x + dx);
          if (mask[k]) inner[k] = 1; else outer[k] = 1;
        }
      }
    }
  }

  const named = (n) => scene.getObjectByName(n);
  const rows = [];
  const candidates = pairs.length ? pairs : ['-'];
  for (const pair of candidates) {
    if (pair !== '-' && ColorCtor) {
      const [wall, floorC] = pair.split(':');
      const w = named('menu_wall');
      const f = named('menu_ground');
      if (w && wall) w.material.color = new ColorCtor(`#${wall}`);
      if (f && floorC) f.material.color = new ColorCtor(`#${floorC}`);
      if (scene.background && wall) scene.background = new ColorCtor(`#${wall}`);
    }
    stage.rig.yawDeg = 0;
    stage.render(0);
    stage.render(0);
    const px = read();
    let lb = 0, nb = 0, lf = 0, nf = 0, li = 0, ni = 0, lo = 0, no = 0;
    let sb = 0, sf = 0, so = 0;
    const sat = (r, g, b) => { const mx = Math.max(r, g, b); return mx === 0 ? 0 : (mx - Math.min(r, g, b)) / mx; };
    for (let j = 0; j < PW * PH; j++) {
      const i = j * 4;
      const L = (0.2126 * px[i] + 0.7152 * px[i + 1] + 0.0722 * px[i + 2]) / 255;
      const S = sat(px[i], px[i + 1], px[i + 2]);
      if (mask[j]) {
        lb += L; sb += S; nb++;
        if (inner[j]) { li += L; ni++; }
      } else {
        lf += L; sf += S; nf++;
        if (outer[j]) { lo += L; so += S; no++; }
      }
    }
    const f4 = (v) => +v.toFixed(4);
    const body = lb / Math.max(1, nb);
    const frame = lf / Math.max(1, nf);
    const edge = li / Math.max(1, ni);
    const ring = lo / Math.max(1, no);
    rows.push({
      pair,
      bodyLuma: f4(body),
      surroundLuma: f4(frame),
      bodyMinusSurround: f4(body - frame),
      edgeLuma: f4(edge),
      ringLuma: f4(ring),
      edgeMinusRing: f4(edge - ring),
      bodySat: f4(sb / Math.max(1, nb)),
      surroundSat: f4(sf / Math.max(1, nf)),
      ringSat: f4(so / Math.max(1, no)),
      charPixelShare: f4(area / (PW * PH)),
    });
  }
  return {
    rows,
    canvas: `${PW}x${PH}`,
    info: window.__charStage ? window.__charStage() : null,
  };
};

async function main() {
  await mkdir(OUT, { recursive: true });
  const browser = await chromium.launch({ args: LAUNCH_ARGS });
  const report = [];
  for (const screen of SCREENS) {
    const page = await browser.newPage({ viewport: { width: W, height: H }, deviceScaleFactor: 1 });
    await page.route('**/@vite/client*', (r) => r.fulfill({ status: 200, contentType: 'text/javascript', body: HMR_STUB }));
    const errors = [];
    page.on('pageerror', (e) => errors.push(String(e)));
    try {
      await page.goto(`${BASE}/?screen=${screen}`, { waitUntil: 'networkidle', timeout: 120000 });
      await page.waitForFunction(`window.__screen === "${screen}" && window.__screenReady === true`, null, { timeout: 120000 });
      await page.waitForTimeout(4500);
      const ids = screen === 'characters' && IDS.length ? IDS : [null];
      for (const id of ids) {
        if (id) {
          await page.click(`.chars-card[data-char="${id}"]`);
          await page.waitForTimeout(1200);
        }
        const res = await page.evaluate(MEASURE, { pairs: SWEEP });
        if (res.error) { console.error(`✗ ${screen}${id ? '/' + id : ''}: ${res.error}`); continue; }
        for (const r of res.rows) {
          report.push({ screen, id: id ?? 'equipped', ...r });
          const sign = r.bodyMinusSurround >= 0 ? '+' : '';
          console.log(
            `${screen.padEnd(11)} ${(id ?? 'equipped').padEnd(11)} ${r.pair.padEnd(14)}`
            + ` body ${r.bodyLuma.toFixed(4)}  surround ${r.surroundLuma.toFixed(4)}`
            + `  POLARITY ${sign}${r.bodyMinusSurround.toFixed(4)}`
            + `  edge-ring ${r.edgeMinusRing >= 0 ? '+' : ''}${r.edgeMinusRing.toFixed(4)}`
            + `  ringSat ${r.ringSat.toFixed(3)}`,
          );
        }
      }
    } catch (e) {
      console.error(`✗ ${screen}: ${e}`);
    } finally {
      if (errors.length) console.error(`  page errors: ${errors.slice(0, 3).join(' | ')}`);
      await page.close();
    }
  }
  await browser.close();
  await writeFile(`${OUT}/${LABEL}.json`, JSON.stringify(report, null, 2));
  console.log(`\nmatch reference: body 0.5411  frame 0.3250  POLARITY +0.216  edge-ring +0.2063`);
  console.log(`wrote ${OUT}/${LABEL}.json`);
}

main().catch((e) => { console.error(e); process.exit(1); });
