#!/usr/bin/env node
/**
 * fq_face — does the FACE survive the MATCH camera at GAMEPLAY SUBJECT SCALE?
 *
 * THROWAWAY, READ-ONLY on src/. Measurement instrument; changes no game code.
 *
 * ── THE QUESTION, AND WHY THE EXISTING TOOLS CANNOT ANSWER IT ───────────────
 * `cf_ablate.mjs` (a peer's, tracked) answers "which pixels does this part own" and
 * is the right shape — but it hard-codes a 900x1400 PORTRAIT viewport, and the
 * question here is about a LANDSCAPE match frame where the fighter is 10-12% of
 * frame height. Aspect is not cosmetic: `subjectFill` is a fraction of the VERTICAL
 * frame, so the same fill in 900x1400 puts 154 px of character on screen and in
 * 1600x900 puts 99 px. The whole finding is about how many pixels an eye gets, so a
 * tool that cannot set the viewport cannot be pointed at it. Copied rather than
 * edited: CLAUDE.md #9, one owner per file, and `cf_*` is a peer's prefix.
 *
 * ── WHAT IT MEASURES ────────────────────────────────────────────────────────
 *   subject box   from `hide the character root` vs control — a real silhouette,
 *                 not a projected joint box. Gives subject height as % of frame,
 *                 which is the number the "dead subject scale" hypothesis was
 *                 closed on and must be re-confirmed on every arm.
 *   eye pixels    from `paint eye meshes magenta` vs control. VISIBLE eye area,
 *                 after occlusion by the lash, the bun and everything else, because
 *                 it is counted on the SHIPPED frame through the SHIPPED post chain.
 *   eye contrast  luma of the sclera pixels vs the ring of face immediately around
 *                 them, on the UNPAINTED control frame. "Large high-contrast eyes"
 *                 is the reference behaviour; area alone does not capture it.
 *
 * ⚠️ AREA AND CONTRAST ARE DIFFERENT QUANTITIES AND ARE NOT COMBINED. An eye can be
 * large and invisible (no contrast) or tiny and stark. Reported side by side.
 *
 * ── KNOWN-BAD INPUTS (CLAUDE.md #6) ─────────────────────────────────────────
 *   `--knownbad nomatch`   asks for a mesh name that cannot exist. MUST exit 4.
 *                          A confident 0.0% from an unmatched name is the exact
 *                          failure `cb_rig`'s raycast shipped for a session.
 *   `--knownbad selfpair`  same tree, same URL, twice. MUST be 0 changed px, or no
 *                          A/B on this rig means anything.
 *   `--knownbad blindfold` paints the eye meshes the SAME colour as the sclera
 *                          already is. The painted-pixel count MUST collapse toward
 *                          zero while the mesh count stays high — that separates
 *                          "the tool found the meshes" from "the tool can see them".
 *
 * ⚠️ VACUITY (CLAUDE.md #6): every statistic below is computed over a FILTERED set
 * of pixels. Each filter asserts NON-EMPTY before any mean is taken, because
 * `[].every()` is `true` and a mean of nothing is `NaN` that prints as a number in
 * some formatters. `--selftest` covers the assertions themselves.
 *
 * ── USE ─────────────────────────────────────────────────────────────────────
 *   PREVIEW_BASE=http://localhost:5xxx node tools/tmp/fq_face.mjs \
 *     --id hotdog --pitch 58 --fill 0.11 --w 1600 --h 900 --out shots/fq/hd_p58.png
 */
import { chromium } from 'playwright';
import { mkdir, writeFile } from 'node:fs/promises';
import { dirname } from 'node:path';
import sharp from 'sharp';

const a = process.argv;
const get = (k, d) => (a.includes(k) ? a[a.indexOf(k) + 1] : d);
const BASE = process.env.PREVIEW_BASE ?? get('--url', null);
const ID = get('--id', 'hotdog');
const PITCH = Number(get('--pitch', '58'));
const YAW = Number(get('--yaw', '0'));
const FILL = Number(get('--fill', '0.11'));
const W = Number(get('--w', '1600'));
const H = Number(get('--h', '900'));
const T = Number(get('--t', '1.5'));
const ANIM = get('--anim', 'idle');
const OUT = get('--out', null);
const LABEL = get('--label', 'unlabelled');
const KNOWNBAD = get('--knownbad', null);
const SELFTEST = a.includes('--selftest');
/** Mesh-name substrings that make up "the eye". Overridable per character. */
const EYE = get('--eye', 'eye_white,pupil,eye_glint').split(',').map(s => s.trim()).filter(Boolean);
/** The root group name the whole fighter hangs from, for the silhouette arm. */
const ROOT = get('--root-name', 'char_root');
/**
 * 🚨 `--no-outline` EXCLUDES the `__outline` ink hulls from the painted set, and it
 * is not a nicety. `outlineCharacter()` builds a SEPARATE inverted-normal mesh per
 * part named `<part>__outline`, and a substring match on `eye_white` catches
 * `eye_white__outline` too. Those pixels are near-black, so including them drags the
 * measured "eye luma" DOWN and inverts the sign of the contrast statistic: hotdog
 * read CONTRAST -16.6 codes with them in, which says "the eye is darker than the
 * face" about a mesh whose whole job is to be the brightest thing on the model.
 * `569daec3` is the precedent — a hamburger round measured `lid = 0 px` as a missing
 * mesh when it was OVERPAINT, because its instrument claimed the lash as the eye.
 */
const NO_OUTLINE = a.includes('--no-outline');
/**
 * `--no-clone` REINTRODUCES the shared-material bug on purpose, so `--knownbad
 * sharedmat` can be shown to go RED on the exact fault it exists to catch. CLAUDE.md
 * #6: a guard that has not been demonstrated to FAIL on its bug is not a guard.
 */
const NO_CLONE = a.includes('--no-clone');
/**
 * LIVE TWEAKS — apply a transform to named meshes through the shipped path, with NO
 * source edit. `--lash-lift 1.15 --lash-flat 0.8` multiplies `eye_lash`'s
 * `position.y` and `scale.y`. A candidate can therefore be RENDERED AND LOOKED AT
 * before anything is committed, and a rejected candidate leaves no diff behind.
 * ⚠️ A live tweak is a HYPOTHESIS TEST, not the change. Whatever ships still has to
 * be re-measured from the committed tree, because a tweak applied after `restPose()`
 * is not necessarily the same as the same number authored into the constructor.
 */
const TWEAK = {
  lashLift: Number(get('--lash-lift', '1')),
  lashFlat: Number(get('--lash-flat', '1')),
  lashFwd: Number(get('--lash-fwd', '0')),
};

// ── SELFTEST: the pure logic, no browser ────────────────────────────────────
if (SELFTEST) {
  let pass = 0, fail = 0;
  const ok = (n, c) => { if (c) { pass++; } else { fail++; console.error(`  FAIL ${n}`); } };

  // §A bbox of a known mask
  {
    const m = new Uint8Array(10 * 10);
    m[2 * 10 + 3] = 1; m[7 * 10 + 8] = 1;
    const b = bboxOf(m, 10, 10);
    ok('A1 bbox x0', b.x0 === 3); ok('A2 bbox y0', b.y0 === 2);
    ok('A3 bbox x1', b.x1 === 8); ok('A4 bbox y1', b.y1 === 7);
    ok('A5 bbox h', b.h === 6); ok('A6 bbox w', b.w === 6);
  }
  // §B bbox REFUSES an empty mask rather than returning 0x0 — the vacuity arm.
  {
    let threw = false;
    try { bboxOf(new Uint8Array(100), 10, 10); } catch { threw = true; }
    ok('B1 empty mask throws (vacuity)', threw);
  }
  // §C mean refuses empty
  {
    let threw = false;
    try { meanOf([]); } catch { threw = true; }
    ok('C1 meanOf([]) throws', threw);
    ok('C2 meanOf works', Math.abs(meanOf([1, 2, 3]) - 2) < 1e-9);
  }
  // §D luma is Rec.709 and monotone
  {
    ok('D1 black', luma(0, 0, 0) === 0);
    ok('D2 white', Math.abs(luma(255, 255, 255) - 255) < 1e-6);
    ok('D3 green>red', luma(0, 255, 0) > luma(255, 0, 0));
  }
  // §E dilate ring: a single pixel dilated by 1 yields its 8 neighbours, and the
  //    ring EXCLUDES the source. A ring that included its source would report the
  //    sclera's own luma as the surround and make every contrast read ~0.
  {
    const m = new Uint8Array(9); m[4] = 1;
    const r = ringOf(m, 3, 3, 1);
    let n = 0; for (let i = 0; i < 9; i++) n += r[i];
    ok('E1 ring size 8', n === 8);
    ok('E2 ring excludes source', r[4] === 0);
  }
  console.log(`fq_face --selftest: ${pass} passed, ${fail} failed`);
  process.exit(fail ? 1 : 0);
}

if (!BASE) { console.error('need PREVIEW_BASE or --url'); process.exit(2); }

// ── pure helpers (exercised by --selftest) ──────────────────────────────────
function luma(r, g, b) { return 0.2126 * r + 0.7152 * g + 0.0722 * b; }
function meanOf(arr) {
  if (!arr.length) throw new Error('meanOf: EMPTY set — refusing to return NaN as a measurement');
  let s = 0; for (const v of arr) s += v; return s / arr.length;
}
function bboxOf(mask, w, h) {
  let x0 = 1e9, y0 = 1e9, x1 = -1, y1 = -1, n = 0;
  for (let y = 0; y < h; y++) for (let x = 0; x < w; x++) {
    if (!mask[y * w + x]) continue;
    n++; if (x < x0) x0 = x; if (x > x1) x1 = x; if (y < y0) y0 = y; if (y > y1) y1 = y;
  }
  if (!n) throw new Error('bboxOf: EMPTY mask — refusing to report a 0x0 box as a measurement');
  return { x0, y0, x1, y1, w: x1 - x0 + 1, h: y1 - y0 + 1, n };
}
function ringOf(mask, w, h, rad) {
  const out = new Uint8Array(w * h);
  for (let y = 0; y < h; y++) for (let x = 0; x < w; x++) {
    if (mask[y * w + x]) continue;
    let near = false;
    for (let dy = -rad; dy <= rad && !near; dy++) for (let dx = -rad; dx <= rad; dx++) {
      const nx = x + dx, ny = y + dy;
      if (nx < 0 || ny < 0 || nx >= w || ny >= h) continue;
      if (mask[ny * w + nx]) { near = true; break; }
    }
    if (near) out[y * w + x] = 1;
  }
  return out;
}

const LAUNCH_ARGS = ['--use-gl=angle', '--use-angle=swiftshader', '--enable-unsafe-swiftshader',
  '--enable-webgl', '--ignore-gpu-blocklist', '--disable-gpu-sandbox'];
const HMR_STUB = `const noop=()=>{};
export const createHotContext=()=>({accept:noop,acceptExports:noop,dispose:noop,prune:noop,
  invalidate:noop,on:noop,off:noop,send:noop,decline:noop,data:{}});
export const injectQuery=(u)=>u; export const updateStyle=noop; export const removeStyle=noop;
export const ErrorOverlay=class{}; export default {};`;

const urlFor = (sil) => `${BASE}/preview.html?piece=character&id=${ID}&pitch=${PITCH}&yaw=${YAW}&fill=${FILL}`
  + `&t=${T}&anim=${ANIM}&shot=1&bg=3d2b21${sil ? '&silhouette=1' : ''}`;
const url = urlFor(false);

const browser = await chromium.launch({ args: LAUNCH_ARGS });

/**
 * One capture through the SHIPPED path.
 *   op = 'control'  untouched
 *   op = 'paint'    repaint `names` magenta (emissive lift so post cannot bury it)
 *   op = 'hide'     hide every mesh under the character, for the silhouette
 *   op = 'same'     repaint `names` the colour they already are (the blindfold arm)
 */
async function capture(op, names) {
  const page = await browser.newPage({ viewport: { width: W, height: H }, deviceScaleFactor: 1 });
  await page.route('**/@vite/client', (r) => r.fulfill({ status: 200, contentType: 'application/javascript', body: HMR_STUB }));
  await page.goto(urlFor(op === 'sil'), { waitUntil: 'load', timeout: 120_000 });
  await page.waitForFunction('window.__previewReady === true && !!window.__stage', null, { timeout: 180_000 });
  const hit = await page.evaluate(({ op, names, noOutline, noClone, tw }) => {
    const s = window.__stage;
    let n = 0; const seen = [];
    // The preview mounts exactly one character; the ground is named `preview_ground`
    // and the backdrop is not a mesh under it. So "everything that is not the ground"
    // IS the fighter, which avoids depending on a root name that may not exist.
    s.scene.traverse((o) => {
      if (!o.isMesh) return;
      if (op === 'sil') { if (o.name !== 'preview_ground') n++; return; }
      if (op === 'control') return;
      if (!names.some((q) => o.name.includes(q))) return;
      if (noOutline && o.name.includes('__outline')) return;
      n++; seen.push(o.name);
      // 🚨 CLONE BEFORE MUTATING. `hotdog.ts` builds `pupil`, `eye_lash` and `mouth`
      // from ONE `inkMat` instance, so `m.color.setHex()` on "the pupil" repainted all
      // three and this tool reported pupil, lash and mouth as 130 px each with the
      // IDENTICAL 37x19 box — three disjoint parts cannot share a bounding box, which
      // is how it was caught. Cloning isolates the paint to the matched mesh.
      // ⚠️ `Material.clone()` DROPS `onBeforeCompile` (CLAUDE.md #5, 54 clone sites lost
      // the Fresnel rim). That is acceptable HERE and only here: the clone is a flat
      // magenta key used to derive a MASK, and its shading is never read. It would not
      // be acceptable in `--color` albedo-sweep form, which this tool does not have.
      const src = Array.isArray(o.material) ? o.material : [o.material];
      const mats = src.map((m) => (m && op === 'paint' && !noClone ? m.clone() : m));
      if (op === 'paint' && !noClone) o.material = Array.isArray(o.material) ? mats : mats[0];
      for (const m of mats) {
        if (!m) continue;
        // 🚨 NO EMISSIVE LIFT. The first version of this tool lifted the painted
        // meshes' emissive to stop the post chain burying them — and that made
        // `BloomEffect` fire, which smeared the diff across the WHOLE FRAME: the
        // subject box came back 1582x896 at fill=0.11, i.e. the entire frame, for a
        // fighter that is 99 px tall. Same class as `40b8a1a`'s contaminated hero
        // mask (a mask from one render and a value from another). Albedo only.
        if (op === 'paint') { if (m.color) m.color.setHex(0xff00ff); }
        m.needsUpdate = true;
      }
    });
    // Live tweaks run on EVERY arm including the control, so an A/B of two tweak
    // settings is single-variable. Applied before the render, after the rig posed.
    if (tw && (tw.lashLift !== 1 || tw.lashFlat !== 1 || tw.lashFwd !== 0)) {
      let touched = 0;
      s.scene.traverse((o) => {
        if (!o.isMesh || !o.name.includes('eye_lash')) return;
        touched++;
        o.position.y *= tw.lashLift;
        o.scale.y *= tw.lashFlat;
        o.position.z += tw.lashFwd;
      });
      // VACUITY: a tweak that matched nothing would render the BASE frame and every
      // row of a sweep would be identical, reading as "this parameter does nothing".
      if (touched === 0) throw new Error('live tweak matched NO eye_lash mesh — refusing a vacuous sweep');
    }
    s.render(0);
    return { n, seen: [...new Set(seen)] };
  }, { op, names: names ?? [], noOutline: NO_OUTLINE, noClone: NO_CLONE, tw: TWEAK });
  const buf = await page.locator('canvas').first().screenshot();
  await page.close();
  return { buf, hit };
}

const raw = async (buf) => sharp(buf).raw().toBuffer({ resolveWithObject: true });
/**
 * `thr` is a MAGNITUDE threshold in 0-255 codes on the max channel delta, not a
 * boolean "did anything change". At thr=0 the SMAA/grade/vignette response to any
 * edit reaches the whole frame and the mask is useless. The threshold is not
 * guessed: `--sweep` prints the count at 0/2/4/8/16/32/64 so the plateau is VISIBLE
 * and a reader can see the answer is not a function of the number I picked.
 */
function changedMask(A, B, thr = 0) {
  const ch = A.info.channels, w = A.info.width, h = A.info.height;
  const m = new Uint8Array(w * h);
  let n = 0;
  for (let p = 0, i = 0; p < w * h; p++, i += ch) {
    const d = Math.max(Math.abs(A.data[i] - B.data[i]), Math.abs(A.data[i + 1] - B.data[i + 1]),
      Math.abs(A.data[i + 2] - B.data[i + 2]));
    if (d > thr) { m[p] = 1; n++; }
  }
  return { m, n, w, h };
}
/** Silhouette mode paints the cast matte black on a white backdrop. */
function darkMask(A, thr = 110) {
  const ch = A.info.channels, w = A.info.width, h = A.info.height;
  const m = new Uint8Array(w * h); let n = 0;
  for (let p = 0, i = 0; p < w * h; p++, i += ch) {
    if (luma(A.data[i], A.data[i + 1], A.data[i + 2]) < thr) { m[p] = 1; n++; }
  }
  return { m, n, w, h };
}

// ── KNOWN-BAD ARMS ──────────────────────────────────────────────────────────
if (KNOWNBAD === 'selfpair') {
  const A = await capture('control'); const B = await capture('control');
  const [ra, rb] = await Promise.all([raw(A.buf), raw(B.buf)]);
  const d = changedMask(ra, rb);
  console.log(`SELF-PAIR ${ID} p${PITCH} fill=${FILL} ${W}x${H}: changedPx=${d.n} (MUST be exactly 0)`);
  await browser.close(); process.exit(d.n === 0 ? 0 : 5);
}
if (KNOWNBAD === 'sharedmat') {
  // Paint two parts that are DISJOINT in space and require their masks to differ.
  // If they come back identical, the tool is painting through a SHARED material
  // instance and every per-part number it has ever printed is a union. This is the
  // arm that caught `inkMat` serving pupil + lash + mouth on hotdog.
  const A = get('--part-a', 'pupil'), B = get('--part-b', 'mouth_throat');
  const c = await capture('control');
  const pa = await capture('paint', [A]), pb = await capture('paint', [B]);
  if (pa.hit.n === 0 || pb.hit.n === 0) {
    console.error(`SHAREDMAT arm: '${A}' matched ${pa.hit.n}, '${B}' matched ${pb.hit.n} — a zero`);
    console.error(`  match makes this arm VACUOUS. Refusing to report a pass.`);
    await browser.close(); process.exit(4);
  }
  const [rc0, ra0, rb0] = await Promise.all([raw(c.buf), raw(pa.buf), raw(pb.buf)]);
  const ma = changedMask(rc0, ra0, 24), mb = changedMask(rc0, rb0, 24);
  let both = 0, only = 0;
  for (let i = 0; i < ma.m.length; i++) { if (ma.m[i] && mb.m[i]) both++; if (ma.m[i] !== mb.m[i]) only++; }
  console.log(`SHAREDMAT ${ID}: '${A}' ${ma.n} px, '${B}' ${mb.n} px, overlap ${both}, differing ${only}`);
  console.log(`  masks MUST differ. identical => shared-material bleed.`);
  await browser.close(); process.exit(only > 0 ? 0 : 8);
}
if (KNOWNBAD === 'nomatch') {
  const r = await capture('paint', ['__nosuchmesh__']);
  console.log(`NOMATCH arm: meshes=${r.hit.n} — tool MUST refuse (exit 4) rather than report 0.0%`);
  await browser.close(); process.exit(r.hit.n === 0 ? 4 : 6);
}

// ── MAIN ────────────────────────────────────────────────────────────────────
const ctl = await capture('control');
const sil = await capture('sil');
const eye = await capture(KNOWNBAD === 'blindfold' ? 'same' : 'paint', EYE);

if (eye.hit.n === 0) {
  console.error(`!! --eye ${EYE.join(',')} matched NO mesh on ${ID}. Refusing to report 0 px.`);
  await browser.close(); process.exit(4);
}
if (sil.hit.n === 0) {
  console.error(`!! silhouette arm hid NO mesh — the scene has no fighter in it.`);
  await browser.close(); process.exit(4);
}

const [rc, rs, re] = await Promise.all([raw(ctl.buf), raw(sil.buf), raw(eye.buf)]);
const ch = rc.info.channels;
// SUBJECT comes from the preview's own `silhouette=1` mode (matte black cast on a
// white backdrop), NOT from hide-and-diff. Hiding the fighter also removes his cast
// shadow and his contact decal, so a diff mask counts floor as subject — the exact
// contamination `40b8a1a` measured at "more than half the mask was ground".
const subj = darkMask(rs, 110);
const EYE_THR = Number(get('--eye-thr', '24'));
const eyed = changedMask(rc, re, EYE_THR);

if (a.includes('--sweep')) {
  console.log(`  THRESHOLD SWEEP (eye mask, ${ID} p${PITCH}) — plateau is the answer, not my pick:`);
  for (const t of [0, 2, 4, 8, 16, 24, 32, 48, 64]) {
    const k = changedMask(rc, re, t);
    console.log(`    thr>${String(t).padStart(2)}  ${String(k.n).padStart(8)} px`);
  }
  for (const t of [60, 90, 110, 130, 160]) {
    const k = darkMask(rs, t);
    let bb = 'EMPTY'; try { const b = bboxOf(k.m, k.w, k.h); bb = `${b.w}x${b.h}`; } catch {}
    console.log(`    silLuma<${String(t).padStart(3)}  ${String(k.n).padStart(8)} px  box ${bb}`);
  }
}

// VACUITY: both masks asserted non-empty BEFORE any statistic is taken over them.
if (subj.n === 0) { console.error('!! subject mask EMPTY — the fighter drew nothing.'); await browser.close(); process.exit(7); }
const sbox = bboxOf(subj.m, subj.w, subj.h);   // throws on empty by construction

const total = rc.info.width * rc.info.height;
console.log(`${LABEL}  ${ID}  pitch=${PITCH}  fill=${FILL}  ${W}x${H}  anim=${ANIM}`);
console.log(`  SUBJECT  box ${sbox.w}x${sbox.h} px   height ${(100 * sbox.h / H).toFixed(2)}% of frame`
  + `   silhouette ${subj.n} px (${(100 * subj.n / total).toFixed(3)}%)`);

if (eyed.n === 0) {
  console.log(`  EYE      0 px VISIBLE — ${eye.hit.n} eye meshes exist and NONE reaches the frame.`);
  console.log(`           matched: ${eye.hit.seen.join(', ')}`);
} else {
  const ebox = bboxOf(eyed.m, eyed.w, eyed.h);
  // contrast: control-frame luma of eye pixels vs a 2px ring just outside them
  const ring = ringOf(eyed.m, eyed.w, eyed.h, 2);
  const eL = [], rL = [];
  for (let p = 0, i = 0; p < eyed.w * eyed.h; p++, i += ch) {
    if (eyed.m[p]) eL.push(luma(rc.data[i], rc.data[i + 1], rc.data[i + 2]));
    else if (ring[p] && subj.m[p]) rL.push(luma(rc.data[i], rc.data[i + 1], rc.data[i + 2]));
  }
  // VACUITY: the ring is filtered twice (ring AND on-subject) so it is the one most
  // likely to come back empty; assert before meaning it.
  const haveRing = rL.length > 0;
  console.log(`  EYE      ${eyed.n} px VISIBLE (${(100 * eyed.n / subj.n).toFixed(2)}% of silhouette)`
    + `   box ${ebox.w}x${ebox.h}   meshes=${eye.hit.n}`);
  console.log(`           eyeLuma ${meanOf(eL).toFixed(1)}`
    + (haveRing ? `   surroundLuma ${meanOf(rL).toFixed(1)}   CONTRAST ${(meanOf(eL) - meanOf(rL)).toFixed(1)} codes  (ring n=${rL.length})`
      : `   surround ring EMPTY — contrast NOT REPORTED (would have been a mean of nothing)`));
  console.log(`           matched: ${eye.hit.seen.join(', ')}`);
}

if (OUT) {
  await mkdir(dirname(OUT), { recursive: true });
  await writeFile(OUT, ctl.buf);
  // A 6x nearest-neighbour crop of the head end of the subject box, because rule 3
  // is "look at the pixels" and 99 px of character cannot be judged at 1x.
  const cw = Math.min(sbox.w + 20, W), cx = Math.max(0, sbox.x0 - 10);
  const cheight = Math.min(Math.round(sbox.h * 0.6) + 10, H), cy = Math.max(0, sbox.y0 - 5);
  const Z = Number(get('--zoom', '6'));
  await sharp(ctl.buf).extract({ left: cx, top: cy, width: cw, height: cheight })
    .resize(cw * Z, cheight * Z, { kernel: 'nearest' }).toFile(OUT.replace(/\.png$/, `_head${Z}x.png`));
  // The SAME crop of the eye-painted arm. Rule 3 is "look at the pixels", and where
  // the eye LANDS is a different question from how many pixels it owns — a count
  // cannot tell you the eye is behind the lash or under the bun.
  await sharp(eye.buf).extract({ left: cx, top: cy, width: cw, height: cheight })
    .resize(cw * Z, cheight * Z, { kernel: 'nearest' }).toFile(OUT.replace(/\.png$/, `_eyepaint${Z}x.png`));
  await writeFile(`${OUT}.json`, JSON.stringify({
    tool: 'fq_face.mjs', label: LABEL, id: ID, url, anim: ANIM,
    camera: { pitchDeg: PITCH, yawDeg: YAW, subjectFill: FILL }, viewport: { w: W, h: H },
    subject: { box: sbox, pctFrameH: 100 * sbox.h / H, silhouettePx: subj.n },
    eye: { visiblePx: eyed.n, meshes: eye.hit.n, matched: eye.hit.seen },
    takenAt: new Date().toISOString(),
  }, null, 2));
  console.log(`  wrote ${OUT} + _head6x.png`);
}
await browser.close();
