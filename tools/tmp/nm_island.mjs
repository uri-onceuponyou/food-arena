#!/usr/bin/env node
/**
 * nm_island — IS THE HEAD STILL ATTACHED? Connected components of the character's
 * own matte, through the SHIPPED render path, at either shipped camera.
 *
 * THROWAWAY. READ-ONLY on `src/`. Measurement instrument; changes no game code.
 *
 * ── WHY ─────────────────────────────────────────────────────────────────────
 * The neck migration deletes the one piece of geometry that spans `torsoTopY` to the
 * food mass. Whether that is a FIX or a HOLE is not answerable from the neck's own
 * delivered pixel count — that number is the same either way — and it is not
 * answerable from `rg_neckz` either, which measures whether the column is EXPOSED,
 * not whether anything else reaches across. It is answerable from one question:
 * **after the column goes, is the head a separate island?**
 *
 * That is this project's standard test for the defect class (a 877 px `lettuce_frill`
 * component; a 9,032 px arm at `--anims run`; `limbcheck`'s own component count), and
 * it is the test the neck work never ran.
 *
 * ── HOW THE MATTE IS BUILT, AND WHAT IT CANNOT SEE ──────────────────────────
 * Two renders of the same frame: shipped, and with `rig_root` hidden (the same handle
 * `r2_shot --knownbad nochar` uses). The matte is every pixel that DIFFERS.
 * ⚠️ A character pixel whose colour exactly equals the backdrop behind it is invisible
 * to this, so the matte can carry interior holes. It cannot invent a JOIN, which is
 * the direction that matters here: a reported split is real; a reported join could in
 * principle be two islands bridged by a pixel that happens to match. The cast's ink
 * outline makes that vanishingly unlikely and the known-bad below tests the split
 * direction, which is the one this pass is deciding on.
 * ⚠️ The character's own cast SHADOW lands on the ground and moves when the character
 * is hidden, so it enters the raw difference. `--minshadow` drops it: shadow pixels
 * differ from the no-character frame by a small, roughly neutral amount, geometry
 * does not. The floor is printed with the verdict and the shipped counts are given
 * both ways so the choice is auditable rather than assumed.
 *
 * ── KNOWN-BAD INPUTS (CLAUDE.md #6) ─────────────────────────────────────────
 *   `--knownbad split`   lifts the rig's `head` joint by `--dy` metres before the
 *                        capture. The component count MUST rise. A detector that
 *                        cannot see a head lifted clear of its own body is not
 *                        measuring attachment, and every "1 component" it prints
 *                        would be worth nothing.
 *   `--knownbad selfpair` the same tree twice: 0 differing pixels, exactly.
 *
 * ── USE ─────────────────────────────────────────────────────────────────────
 *   PREVIEW_BASE=... node tools/tmp/nm_island.mjs --ids sushi,soup --pitch 20
 *   PREVIEW_BASE=... node tools/tmp/nm_island.mjs --ids sushi --knownbad split --dy 0.5
 */
import { chromium } from 'playwright';
import { mkdir, writeFile } from 'node:fs/promises';
import sharp from 'sharp';
import { components } from './silhlib.mjs';

const a = process.argv;
const get = (k, d) => (a.includes(k) ? a[a.indexOf(k) + 1] : d);
const BASE = process.env.PREVIEW_BASE ?? get('--url', null);
const IDS = get('--ids', 'sushi').split(',').map((s) => s.trim()).filter(Boolean);
const PITCH = Number(get('--pitch', '20'));
const YAW = Number(get('--yaw', '0'));
const FILL = Number(get('--fill', '0.60'));
const MIN = Number(get('--min', '60'));
const MINSHADOW = Number(get('--minshadow', '18'));
const DY = Number(get('--dy', '0.5'));
const KNOWNBAD = get('--knownbad', null);
const OUT = get('--out', null);
const W = 900, H = 1400;

if (!BASE) { console.error('need PREVIEW_BASE or --url'); process.exit(2); }

const LAUNCH_ARGS = ['--use-gl=angle', '--use-angle=swiftshader', '--enable-unsafe-swiftshader',
  '--enable-webgl', '--ignore-gpu-blocklist', '--disable-gpu-sandbox'];
const HMR_STUB = `const noop=()=>{};
export const createHotContext=()=>({accept:noop,acceptExports:noop,dispose:noop,prune:noop,
  invalidate:noop,on:noop,off:noop,send:noop,decline:noop,data:{}});
export const injectQuery=(u)=>u; export const updateStyle=noop; export const removeStyle=noop;
export const ErrorOverlay=class{}; export default {};`;

const browser = await chromium.launch({ args: LAUNCH_ARGS });

/** One capture. `mode` is 'shipped' | 'nochar', `lift` moves the head joint up first. */
async function capture(id, mode, lift) {
  const url = `${BASE}/preview.html?piece=character&id=${id}&pitch=${PITCH}&yaw=${YAW}&fill=${FILL}`
    + `&t=1.5&anim=idle&shot=1&bg=3d2b21`;
  const page = await browser.newPage({ viewport: { width: W, height: H }, deviceScaleFactor: 1 });
  await page.route('**/@vite/client', (r) => r.fulfill({ status: 200, contentType: 'application/javascript', body: HMR_STUB }));
  await page.goto(url, { waitUntil: 'load', timeout: 120_000 });
  await page.waitForFunction('window.__previewReady === true && !!window.__stage', null, { timeout: 180_000 });
  const info = await page.evaluate(({ mode, lift }) => {
    const s = window.__stage;
    let heads = 0;
    if (lift) s.scene.traverse((o) => { if (o.name === 'head') { o.position.y += lift; heads++; } });
    if (mode === 'nochar') s.scene.traverse((o) => { if (o.name === 'rig_root') o.visible = false; });
    s.scene.updateMatrixWorld(true);
    s.render(0);
    return { heads };
  }, { mode, lift });
  const buf = await page.locator('canvas').first().screenshot();
  await page.close();
  return { buf, info };
}

/** matte + components. Returns the report for one (id, arm). */
async function measure(id, lift) {
  const A = await capture(id, 'shipped', lift);
  const B = await capture(id, 'nochar', lift);
  const [ra, rb] = await Promise.all([
    sharp(A.buf).raw().toBuffer({ resolveWithObject: true }),
    sharp(B.buf).raw().toBuffer({ resolveWithObject: true }),
  ]);
  const ch = ra.info.channels;
  const raw = new Uint8Array(W * H);
  const solid = new Uint8Array(W * H);
  let rawPx = 0, solidPx = 0;
  for (let j = 0; j < W * H; j++) {
    const i = j * ch;
    const dr = ra.data[i] - rb.data[i], dg = ra.data[i + 1] - rb.data[i + 1], db = ra.data[i + 2] - rb.data[i + 2];
    if (dr === 0 && dg === 0 && db === 0) continue;
    raw[j] = 1; rawPx++;
    // Shadow: a small, near-neutral darkening of the ground. Geometry replaces the
    // pixel outright, so its channel deltas are large and/or strongly non-neutral.
    const mag = Math.max(Math.abs(dr), Math.abs(dg), Math.abs(db));
    const chroma = Math.max(dr, dg, db) - Math.min(dr, dg, db);
    if (mag >= MINSHADOW || chroma >= MINSHADOW) { solid[j] = 1; solidPx++; }
  }
  const { sizes } = components(solid, W, H);
  const big = sizes.map((s, i) => [i, s]).filter(([, s]) => s >= MIN).sort((x, y) => y[1] - x[1]);
  return { rawPx, solidPx, nComp: big.length, sizes: big.map(([, s]) => s), A, B };
}

if (KNOWNBAD === 'selfpair') {
  let bad = 0;
  for (const id of IDS) {
    const A = await capture(id, 'shipped', 0);
    const B = await capture(id, 'shipped', 0);
    const [ra, rb] = await Promise.all([
      sharp(A.buf).raw().toBuffer({ resolveWithObject: true }),
      sharp(B.buf).raw().toBuffer({ resolveWithObject: true }),
    ]);
    let d = 0;
    for (let i = 0; i < ra.data.length; i += ra.info.channels) {
      if (ra.data[i] !== rb.data[i] || ra.data[i + 1] !== rb.data[i + 1] || ra.data[i + 2] !== rb.data[i + 2]) d++;
    }
    console.log(`SELF-PAIR ${id} p${PITCH}: changedPx=${d} (MUST be exactly 0)`);
    if (d !== 0) bad++;
  }
  await browser.close();
  process.exit(bad ? 5 : 0);
}

console.log(`nm_island  pitch ${PITCH}  yaw ${YAW}  min component ${MIN} px  shadow floor ${MINSHADOW}`);
console.log('id           rawPx   solidPx  components  sizes');
let bad = 0;
for (const id of IDS) {
  const base = await measure(id, 0);
  console.log(`${id.padEnd(12)} ${String(base.rawPx).padStart(7)} ${String(base.solidPx).padStart(8)}`
    + `  ${String(base.nComp).padStart(9)}  ${base.sizes.slice(0, 6).join(', ')}`);
  if (OUT) {
    await mkdir(OUT, { recursive: true });
    await writeFile(`${OUT}/${id}_p${PITCH}.png`, base.A.buf);
    await writeFile(`${OUT}/${id}_p${PITCH}_nochar.png`, base.B.buf);
  }
  if (KNOWNBAD === 'split') {
    const lifted = await measure(id, DY);
    const detected = lifted.nComp > base.nComp;
    console.log(`${' '.repeat(12)} head +${DY} m -> components ${base.nComp} -> ${lifted.nComp}`
      + `  (${lifted.sizes.slice(0, 6).join(', ')})  ${detected ? 'DETECTED ✓' : '🔴 NOT DETECTED'}`);
    if (lifted.info === undefined) { /* unreachable, keeps the shape explicit */ }
    if (!detected) bad++;
  }
}
if (KNOWNBAD === 'split') {
  console.log(bad ? `\n🔴 KNOWN-BAD FAILED on ${bad} character(s) — this detector cannot see a lifted head.`
    : '\n✓ a head lifted clear of its body splits the matte on every character tested.');
}
await browser.close();
process.exit(bad ? 1 : 0);
