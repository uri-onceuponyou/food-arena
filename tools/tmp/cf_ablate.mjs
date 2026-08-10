#!/usr/bin/env node
/**
 * cf_ablate — repaint named meshes an unmissable colour through the SHIPPED render
 * path, screenshot, and COUNT the pixels they own.
 *
 * THROWAWAY, READ-ONLY on src/. Measurement instrument; changes no game code.
 *
 * ── WHY ─────────────────────────────────────────────────────────────────────
 * `rg_solid.mjs` frames the model's own bbox and `charStage` does not, so it is
 * wrong at the lobby camera by up to 35x and is valid at pitch 58 only. Every
 * lobby-pitch conclusion in this round therefore has to come from ABLATION — paint
 * the part, capture through the shipped path, count — which is how the neck table's
 * sign was found to be backwards.
 *
 * It answers two different questions and they must not be confused:
 *   `--mode paint`  repaint the named meshes magenta. The count is HOW MUCH OF THE
 *                   FRAME THAT PART OWNS, i.e. what a value change to it can move.
 *                   ⚠️ This is an UPPER BOUND on the part's leverage and nothing more
 *                   (docs/LESSONS.md §6b: a probe tells you what is broken, not that
 *                   fixing it is what the viewer reacts to).
 *   `--mode hide`   set `.visible = false`. The frame MUST move; if it does not, the
 *                   part was never on screen and any theory about it is dead. This is
 *                   the form that killed `bottomBun.receiveShadow = false`.
 *
 * ── KNOWN-BAD INPUTS (CLAUDE.md #6) ─────────────────────────────────────────
 *   `--names __nosuchmesh__`  matches nothing. The tool MUST exit 4 rather than
 *                             report a plausible 0.0% — a confident zero is exactly
 *                             the wrong answer, and `cb_rig`'s raycast learned this
 *                             the expensive way (an unmatched body name REFUSES).
 *   `--knownbad selfpair`     runs the SAME tree twice and requires the two frames to
 *                             differ by EXACTLY 0 changed pixels. A drift control:
 *                             if a self-pair moves, no A/B on this rig means anything.
 *
 * ── USE ─────────────────────────────────────────────────────────────────────
 *   PREVIEW_BASE=... node tools/tmp/cf_ablate.mjs --id hamburger --pitch 20 \
 *     --names patty --out shots/cf/ablate/hb-patty-p20.png
 */
import { chromium } from 'playwright';
import { mkdir, writeFile } from 'node:fs/promises';
import { dirname } from 'node:path';
import sharp from 'sharp';

const a = process.argv;
const get = (k, d) => (a.includes(k) ? a[a.indexOf(k) + 1] : d);
const BASE = process.env.PREVIEW_BASE ?? get('--url', null);
const ID = get('--id', 'hamburger');
const NAMES = get('--names', '').split(',').map((s) => s.trim()).filter(Boolean);
const MODE = get('--mode', 'paint');
const OUT = get('--out', null);
const PITCH = Number(get('--pitch', '20'));
const YAW = Number(get('--yaw', '0'));
const FILL = Number(get('--fill', '0.60'));
const KNOWNBAD = get('--knownbad', null);
/**
 * `--color RRGGBB` repaints the named meshes that colour instead of magenta and skips
 * the emissive lift, i.e. it is an ALBEDO SWEEP through the shipped path. It exists so
 * a candidate value can be RENDERED AND LOOKED AT without editing `src/` — the brief's
 * *"render both and LOOK, do not tune a number"* — and so a rejected candidate leaves
 * no diff behind. ⚠️ The `magentaPx` column is meaningless in this mode and prints as
 * `-`; only `changedPx` and the PNG mean anything.
 */
const COLOR = get('--color', null);
const W = 900, H = 1400;

if (!BASE) { console.error('need PREVIEW_BASE or --url'); process.exit(2); }
if (!NAMES.length && KNOWNBAD !== 'selfpair') { console.error('need --names'); process.exit(2); }

const LAUNCH_ARGS = ['--use-gl=angle', '--use-angle=swiftshader', '--enable-unsafe-swiftshader',
  '--enable-webgl', '--ignore-gpu-blocklist', '--disable-gpu-sandbox'];
const HMR_STUB = `const noop=()=>{};
export const createHotContext=()=>({accept:noop,acceptExports:noop,dispose:noop,prune:noop,
  invalidate:noop,on:noop,off:noop,send:noop,decline:noop,data:{}});
export const injectQuery=(u)=>u; export const updateStyle=noop; export const removeStyle=noop;
export const ErrorOverlay=class{}; export default {};`;

const url = `${BASE}/preview.html?piece=character&id=${ID}&pitch=${PITCH}&yaw=${YAW}&fill=${FILL}`
  + `&t=1.5&anim=idle&shot=1&bg=3d2b21`;

const browser = await chromium.launch({ args: LAUNCH_ARGS });

/** One capture. `names` empty => the untouched control frame. */
async function capture(names, mode) {
  const page = await browser.newPage({ viewport: { width: W, height: H }, deviceScaleFactor: 1 });
  await page.route('**/@vite/client', (r) => r.fulfill({ status: 200, contentType: 'application/javascript', body: HMR_STUB }));
  await page.goto(url, { waitUntil: 'load', timeout: 120_000 });
  await page.waitForFunction('window.__previewReady === true && !!window.__stage', null, { timeout: 180_000 });
  const hit = await page.evaluate(({ names, mode, color }) => {
    const s = window.__stage;
    let n = 0; const seen = [];
    s.scene.traverse((o) => {
      if (!o.isMesh) return;
      // Substring match on the mesh's own name. The cast tags meshes with suffixes
      // (`grill_mark__no_outline`), so an exact match would silently miss them —
      // which is the "confident zero" this tool refuses to return.
      if (!names.some((q) => o.name.includes(q))) return;
      // An outline hull is a SEPARATE mesh with an inverted normal and its own dark
      // material. Repainting it to the albedo under test would delete the character's
      // ink line and change the frame for a reason that has nothing to do with the
      // value being judged, so an albedo sweep skips it. `paint`/`hide` still take it,
      // because there the question is "which pixels does this part own".
      if (color && o.name.includes('__outline')) return;
      n++; seen.push(o.name);
      if (mode === 'hide') { o.visible = false; return; }
      const mats = Array.isArray(o.material) ? o.material : [o.material];
      for (const m of mats) {
        if (!m) continue;
        if (m.color) m.color.setHex(color ? parseInt(color, 16) : 0xff00ff);
        if (m.emissive && !color) m.emissive.setHex(0x440044);
        m.needsUpdate = true;
      }
    });
    s.render(0);
    return { n, seen: [...new Set(seen)] };
  }, { names, mode, color: COLOR });
  const buf = await page.locator('canvas').first().screenshot();
  await page.close();
  return { buf, hit };
}

if (KNOWNBAD === 'selfpair') {
  const A = await capture([], 'paint');
  const B = await capture([], 'paint');
  const [ra, rb] = await Promise.all([
    sharp(A.buf).raw().toBuffer({ resolveWithObject: true }),
    sharp(B.buf).raw().toBuffer({ resolveWithObject: true }),
  ]);
  let diff = 0;
  for (let i = 0; i < ra.data.length; i += ra.info.channels) {
    if (ra.data[i] !== rb.data[i] || ra.data[i + 1] !== rb.data[i + 1] || ra.data[i + 2] !== rb.data[i + 2]) diff++;
  }
  console.log(`SELF-PAIR ${ID} p${PITCH}: changedPx=${diff} (MUST be exactly 0)`);
  await browser.close();
  process.exit(diff === 0 ? 0 : 5);
}

const ctl = await capture([], 'paint');
const abl = await capture(NAMES, MODE);

if (abl.hit.n === 0) {
  console.error(`!! --names ${NAMES.join(',')} matched NO mesh on ${ID}. Refusing to report 0.0%: a`);
  console.error(`   confident zero from an unmatched name is indistinguishable from a real zero.`);
  await browser.close();
  process.exit(4);
}

const [rc, rA] = await Promise.all([
  sharp(ctl.buf).raw().toBuffer({ resolveWithObject: true }),
  sharp(abl.buf).raw().toBuffer({ resolveWithObject: true }),
]);
const ch = rc.info.channels;
const total = rc.info.width * rc.info.height;
let changed = 0, magenta = 0;
for (let i = 0; i < rc.data.length; i += ch) {
  const r = rA.data[i], g = rA.data[i + 1], b = rA.data[i + 2];
  if (rc.data[i] !== r || rc.data[i + 1] !== g || rc.data[i + 2] !== b) changed++;
  if (r > 140 && b > 140 && g < 90) magenta++;
}
console.log(`${ID} p${PITCH} mode=${MODE}${COLOR ? ` color=#${COLOR}` : ''} names=[${NAMES.join(',')}] meshes=${abl.hit.n}`);
console.log(`  matched: ${abl.hit.seen.join(', ')}`);
console.log(`  changedPx=${changed} (${(100 * changed / total).toFixed(3)}% of frame)`
  + (MODE === 'paint' ? `  magentaPx=${COLOR ? '-' : `${magenta} (${(100 * magenta / total).toFixed(3)}%)`}` : ''));

if (OUT) {
  await mkdir(dirname(OUT), { recursive: true });
  await writeFile(OUT, abl.buf);
  await writeFile(`${OUT}.capture.json`, JSON.stringify({
    tool: 'cf_ablate.mjs', id: ID, names: NAMES, mode: MODE, url,
    camera: { pitchDeg: PITCH, yawDeg: YAW, subjectFill: FILL },
    meshes: abl.hit.n, matched: abl.hit.seen, changedPx: changed, magentaPx: magenta, totalPx: total,
    takenAt: new Date().toISOString(),
  }, null, 2));
  console.log(`wrote ${OUT}`);
}
await browser.close();
