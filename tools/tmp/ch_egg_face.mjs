#!/usr/bin/env node
/**
 * ch_egg_face — does this character's SCLERA actually reach the reference's value?
 *
 *   node tools/tmp/ch_egg_face.mjs --selftest            # 14 hand-derived assertions, no browser
 *   node tools/tmp/headserve.mjs -- node tools/tmp/ch_egg_face.mjs
 *   node tools/tmp/headserve.mjs --overlay src/characters/egg.ts -- node tools/tmp/ch_egg_face.mjs
 *
 * ── WHY THIS EXISTS ─────────────────────────────────────────────────────────
 * The whole cast face pass rests on ONE number, recorded in DECISIONS §37/§42:
 *
 *   > 0% of OUR eye pixels are above 0.85 luma. The reference plates' two eye
 *   > regions are 31.1% and 34.1%. Our faces carry two values total.
 *
 * `rules.ts` now specifies the fix for all eleven characters — *"a white sclera
 * that is the BRIGHTEST VALUE ANYWHERE ON THE CHARACTER"* — and nothing in this
 * repo could measure whether a given character had met it. `valuescan` measures the
 * character's whole ladder and `sepscan` measures near-white CLIPPING; neither can
 * say where the bright pixels are, and "the eyes got brighter" and "the shell got
 * blown out" look identical to both of them. That distinction is the entire point.
 *
 * ── HOW THE FACE IS ISOLATED ────────────────────────────────────────────────
 * Ablation, not a hand-drawn box. `rig.ts` parents every facial feature to the
 * `face` joint, so the face mask is the set of pixels that CHANGE when that one
 * group is hidden — measured on the DIRECT render with the post chain bypassed,
 * because bloom is not geometry (the same rule `valuescan` states for its mattes:
 * hiding the head moves 41,332 post-processed pixels against a 26,173 px
 * character, so a post-processed diff would be 58% halo).
 *
 * Values are then read from the SHIPPED post-processed frame, because that is what
 * the player sees.
 *
 * ⚠️ THE `face` GROUP IS EYES + BROWS + MOUTH, not eyes alone. So `faceAbove85`
 * is a STRICTLY CONSERVATIVE reading of the 31.1%/34.1% reference figure — the
 * brow ridges and the mouth are dark by design and dilute it. `eyeAbove85`
 * restricts to the two largest bright components and is the like-for-like number.
 *
 * ── THE CAMERA ──────────────────────────────────────────────────────────────
 * pitch 20, because `charStage.ts:451` is `pitchDeg: 20` and that is the screen
 * Uri is judging. Every character instrument in this repo measures the match's 58,
 * where the face is foreshortened under the crown of the food mass. Both are real;
 * this one answers the question that was asked.
 */
import { chromium } from 'playwright';
import sharp from 'sharp';
import { mkdir, writeFile } from 'node:fs/promises';

const a = process.argv;
const get = (k, d) => (a.includes(k) ? a[a.indexOf(k) + 1] : d);
const has = (k) => a.includes(k);

const BASE = process.env.PREVIEW_BASE ?? process.env.HEADSERVE_URL ?? get('--url', null);
const ID = get('--id', 'egg');
const PITCH = Number(get('--pitch', 20));
const YAW = Number(get('--yaw', 0));
const OUT = get('--out', `shots/ch/${ID}`);
const TAG = get('--tag', 'now');

const LAUNCH_ARGS = ['--use-gl=angle', '--use-angle=swiftshader', '--enable-unsafe-swiftshader',
  '--enable-webgl', '--ignore-gpu-blocklist', '--disable-gpu-sandbox'];

// ── the metric, as pure functions so `--selftest` can drive them ─────────────

/** Display luma, byte-encoded sRGB. Identical formula to `valuelib.mjs:vlLuma`, so
 *  a number here is comparable with a number there. */
export function luma(r, g, b) { return (0.2126 * r + 0.7152 * g + 0.0722 * b) / 255; }

/** Pixels that DIFFER between two RGB buffers by more than `tol` on any channel. */
export function diffMask(aBuf, bBuf, n, tol = 6) {
  const m = new Uint8Array(n);
  for (let i = 0; i < n; i++) {
    const o = i * 3;
    if (Math.abs(aBuf[o] - bBuf[o]) > tol || Math.abs(aBuf[o + 1] - bBuf[o + 1]) > tol
      || Math.abs(aBuf[o + 2] - bBuf[o + 2]) > tol) m[i] = 1;
  }
  return m;
}

/** Share of masked pixels at or above `t`. Returns null on an EMPTY mask rather
 *  than 0 — "no face was found" and "the face has no bright pixels" are different
 *  answers and a tool that conflates them reports a confident wrong 0%. */
export function shareAbove(lum, mask, t) {
  let n = 0, hit = 0;
  for (let i = 0; i < mask.length; i++) if (mask[i]) { n++; if (lum[i] >= t) hit++; }
  return n ? hit / n : null;
}

/** 4-connected components of `mask`, largest first, as {n, cx, cy, maxL}. */
export function components(mask, W, H, lum) {
  const seen = new Uint8Array(mask.length);
  const out = [];
  const stack = new Int32Array(mask.length);
  for (let s = 0; s < mask.length; s++) {
    if (!mask[s] || seen[s]) continue;
    let sp = 0; stack[sp++] = s; seen[s] = 1;
    let n = 0, sx = 0, sy = 0, maxL = 0;
    while (sp) {
      const p = stack[--sp];
      const x = p % W, y = (p / W) | 0;
      n++; sx += x; sy += y;
      if (lum && lum[p] > maxL) maxL = lum[p];
      if (x > 0 && mask[p - 1] && !seen[p - 1]) { seen[p - 1] = 1; stack[sp++] = p - 1; }
      if (x < W - 1 && mask[p + 1] && !seen[p + 1]) { seen[p + 1] = 1; stack[sp++] = p + 1; }
      if (y > 0 && mask[p - W] && !seen[p - W]) { seen[p - W] = 1; stack[sp++] = p - W; }
      if (y < H - 1 && mask[p + W] && !seen[p + W]) { seen[p + W] = 1; stack[sp++] = p + W; }
    }
    out.push({ n, cx: sx / n, cy: sy / n, maxL });
  }
  out.sort((p, q) => q.n - p.n);
  return out;
}

// ── selftest ─────────────────────────────────────────────────────────────────
// Every assertion's expected value is derived BY HAND from a synthetic input, and
// at least one of each kind is a KNOWN-BAD input that the metric MUST refuse.
// `docs/LESSONS.md` §13: a guard that has not been shown to FAIL is not a guard.
if (has('--selftest')) {
  let pass = 0, fail = 0;
  const ok = (name, got, want, eps = 1e-9) => {
    const good = typeof want === 'number' && typeof got === 'number'
      ? Math.abs(got - want) <= eps : JSON.stringify(got) === JSON.stringify(want);
    console.log(`  ${good ? '✓' : '✗'} ${name.padEnd(62)} ${JSON.stringify(got)}`);
    good ? pass++ : fail++;
  };

  console.log('\nA. LUMA — the same formula as `valuelib.mjs`, so the numbers are comparable');
  ok('pure white is 1.0', luma(255, 255, 255), 1);
  ok('pure black is 0.0', luma(0, 0, 0), 0);
  ok('mid grey 128 is 0.502', luma(128, 128, 128), 128 / 255, 1e-9);
  // ⚠️ A LITERAL, NOT THE SAME EXPRESSION. This assertion originally read
  // `luma(0xD8,0xCA,0xAB) === (0.2126*216 + 0.7152*202 + 0.0722*171)/255`, which is
  // `f(x) === f(x)` — it passes for ANY implementation, including a wrong one.
  // `docs/LESSONS.md` §13's tautological-guard trap, committed while writing the
  // guard against it. Worked by hand: 45.9216 + 144.4704 + 12.3462 = 202.7382, /255.
  ok('SHELL #D8CAAB is 0.795052', luma(0xD8, 0xCA, 0xAB), 0.795052, 5e-7);

  console.log('\nB. THE MASK — an ablation diff, and it must find EXACTLY the changed pixels');
  {
    const n = 6;
    const A = new Uint8Array([10, 10, 10, 200, 200, 200, 10, 10, 10, 10, 10, 10, 250, 250, 250, 10, 10, 10]);
    const B = new Uint8Array([10, 10, 10, 10, 10, 10, 10, 10, 10, 10, 10, 10, 10, 10, 10, 10, 10, 10]);
    ok('two pixels changed -> mask has exactly those two', Array.from(diffMask(A, B, n)), [0, 1, 0, 0, 1, 0]);
    ok('a buffer against ITSELF yields an EMPTY mask', Array.from(diffMask(A, A, n)), [0, 0, 0, 0, 0, 0]);
    // KNOWN-BAD: a 4/255 dither must NOT register as geometry.
    const C = Uint8Array.from(A, (v) => Math.min(255, v + 4));
    ok('KNOWN-BAD a +4 dither is BELOW tol and reports nothing', diffMask(A, C, n).reduce((s, v) => s + v, 0), 0);
    // ⚠️ 5, NOT 6, AND THE 5 IS THE POINT. Pixel 4 of `A` is 250, so `+8` CLAMPS to
    // 255 — a difference of 5, below tol. Writing 6 here (the first version did) is
    // the shape of an assertion tuned to the answer it wanted: it would have been
    // "fixed" by raising the clamp, hiding that a near-white ablation delta is
    // genuinely compressed. Near-white is exactly where this character's eyes live.
    ok('...a +8 shift is above tol on 5 of 6 — the 6th CLAMPS at 255',
      diffMask(A, Uint8Array.from(A, (v) => Math.min(255, v + 8)), n).reduce((s, v) => s + v, 0), 5);
  }

  console.log('\nC. shareAbove — and the two ways it must be able to FAIL');
  {
    const lum = Float32Array.from([0.10, 0.90, 0.80, 0.99]);
    const all = Uint8Array.from([1, 1, 1, 1]);
    ok('2 of 4 at/above 0.85', shareAbove(lum, all, 0.85), 0.5);
    // THE KNOWN-BAD INPUT THIS WHOLE TOOL EXISTS FOR: the recorded defect is a face
    // whose brightest pixel is a catchlight and whose sclera is not white. If the
    // metric cannot report 0 on that, it can never have proved the 0 it reported.
    ok('KNOWN-BAD a face topping out at 0.84 reports 0%', shareAbove(Float32Array.from([0.2, 0.5, 0.84]), Uint8Array.from([1, 1, 1]), 0.85), 0);
    ok('...and one at 0.86 reports 100%', shareAbove(Float32Array.from([0.86, 0.90, 0.99]), Uint8Array.from([1, 1, 1]), 0.85), 1);
    ok('AN EMPTY MASK IS null, NOT 0 — "no face found" != "face is dark"', shareAbove(lum, Uint8Array.from([0, 0, 0, 0]), 0.85), null);
    ok('the mask is honoured: only pixel 0 counted', shareAbove(lum, Uint8Array.from([1, 0, 0, 0]), 0.85), 0);
  }

  console.log('\nD. COMPONENTS — two eyes must come back as TWO blobs, not one');
  {
    const W = 9, H = 3;
    const m = new Uint8Array(W * H);
    for (const p of [1, 2, 10, 11, 6, 7, 15, 16]) m[p] = 1;   // two 2x2 blobs, a gap between
    const c = components(m, W, H, null);
    ok('two components', c.length, 2);
    ok('each is 4 px', [c[0].n, c[1].n], [4, 4]);
    // KNOWN-BAD: bridge them and the tool MUST say one — otherwise "the eyes are
    // separate" is an answer it gives for every input.
    const bridged = Uint8Array.from(m); bridged[3] = 1; bridged[4] = 1; bridged[5] = 1;
    ok('KNOWN-BAD bridged -> ONE component of 11', components(bridged, W, H, null).map((x) => x.n), [11]);
    ok('an empty mask has no components', components(new Uint8Array(W * H), W, H, null).length, 0);
  }

  console.log(`\n${pass} passed, ${fail} failed`);
  process.exit(fail ? 1 : 0);
}

// ── live ─────────────────────────────────────────────────────────────────────
if (!BASE) {
  console.error('\n✗ REFUSED — no PREVIEW_BASE. Run under `headserve.mjs` or `with_snapshot.mjs`.\n');
  process.exit(2);
}

/**
 * ⚠️ THE MEASUREMENT RUNS IN THE PAGE, AND THE FIRST VERSION DID NOT.
 * It returned four full framebuffers to node and computed there. At this viewport
 * that is ~24 M numbers through the CDP JSON bridge and node died on
 * `Ineffective mark-compacts near heap limit` after 45 s — which looks exactly like
 * a hung render and is not (`docs/LESSONS.md` §16).
 *
 * So the four pure functions above are shipped into the page BY SOURCE, via
 * `Function.prototype.toString()`. That is deliberate rather than convenient: it
 * makes the code `--selftest` proves identical, by construction, to the code that
 * produces the live number. A hand-written in-page copy would be a second
 * implementation that nothing tests — the shape `driver_guard.mjs` exists to stop.
 */
const PURE_SRC = [luma, diffMask, shareAbove, components].map((f) => f.toString()).join('\n');

/**
 * One `page.evaluate`. Renders four ways off the SAME frame state and restores
 * everything it touches:
 *   shipped   post chain on, everything visible  -> the values
 *   direct    post bypassed, everything visible  -> mask reference
 *   noFace    post bypassed, `face` group hidden -> face mask by difference
 *   noChar    post bypassed, character hidden    -> character mask by difference
 */
const CAPTURE = (opts) => {
  const { luma, diffMask, shareAbove, components } =
    new Function(`${opts.src}\nreturn { luma, diffMask, shareAbove, components };`)();
  const stage = window.__stage;
  if (!stage || stage.disposed) return { error: 'no live Stage on this page' };
  const r = stage.renderer, scene = stage.scene, cam = stage.rig && stage.rig.camera;
  if (!r || !scene || !cam) return { error: 'Stage missing renderer/scene/rig.camera' };
  const gl = r.getContext();
  const W = r.domElement.width, H = r.domElement.height;
  if (!W || !H) return { error: 'zero-size drawing buffer' };

  let charRoot = null;
  scene.traverse((o) => { if (o.name === `character:${opts.id}`) charRoot = o; });
  if (!charRoot) return { error: `no character:${opts.id} in the scene` };
  let faceJoint = null;
  charRoot.traverse((o) => { if (!faceJoint && o.name === 'face') faceJoint = o; });
  if (!faceJoint) return { error: 'no `face` joint under the character' };
  const faceMeshes = [];
  faceJoint.traverse((o) => { if (o.isMesh) faceMeshes.push(o); });
  if (!faceMeshes.length) return { error: 'the `face` joint owns no meshes — nothing to measure' };

  const read = () => {
    const buf = new Uint8Array(W * H * 4);
    gl.readPixels(0, 0, W, H, gl.RGBA, gl.UNSIGNED_BYTE, buf);
    const out = new Uint8Array(W * H * 3);
    for (let row = 0; row < H; row++) {
      const src = (H - 1 - row) * W * 4, dst = row * W * 3;
      for (let x = 0; x < W; x++) {
        out[dst + x * 3] = buf[src + x * 4];
        out[dst + x * 3 + 1] = buf[src + x * 4 + 1];
        out[dst + x * 3 + 2] = buf[src + x * 4 + 2];
      }
    }
    return out;
  };

  const direct = () => { r.render(scene, cam); return read(); };

  const n = W * H;
  let shipped, dAll, dNoFace, dNoChar;
  try {
    stage.render(0);
    shipped = read();
    dAll = direct();
    faceMeshes.forEach((m) => { m.visible = false; });
    dNoFace = direct();
    faceMeshes.forEach((m) => { m.visible = true; });
    charRoot.visible = false;
    dNoChar = direct();
  } finally {
    faceMeshes.forEach((m) => { m.visible = true; });
    charRoot.visible = true;
    stage.render(0);   // leave the canvas showing the SHIPPED frame for `page.screenshot()`
  }

  const lum = new Float32Array(n);
  for (let i = 0; i < n; i++) lum[i] = luma(shipped[i * 3], shipped[i * 3 + 1], shipped[i * 3 + 2]);

  const charMask = diffMask(dAll, dNoChar, n);
  const faceMask = diffMask(dAll, dNoFace, n);
  let charN = 0, faceN = 0;
  for (let i = 0; i < n; i++) { charN += charMask[i]; faceN += faceMask[i]; }
  if (!charN) return { error: 'the character mask is EMPTY — the ablation found nothing' };
  if (!faceN) return { error: 'the FACE mask is EMPTY — the `face` joint renders nothing visible' };

  // The bright components of the face — the sclerae, if there are any.
  const bright = new Uint8Array(n);
  for (let i = 0; i < n; i++) if (faceMask[i] && lum[i] >= 0.85) bright[i] = 1;
  const comps = components(bright, W, H, lum).filter((c) => c.n >= 8);
  const eyeN = comps.slice(0, 2).reduce((s, c) => s + c.n, 0);

  // Where is the brightest pixel on the CHARACTER, and is it in the face?
  let maxL = -1, maxI = -1, faceMax = 0, bodyMax = 0;
  for (let i = 0; i < n; i++) {
    if (!charMask[i]) continue;
    if (lum[i] > maxL) { maxL = lum[i]; maxI = i; }
    if (faceMask[i]) { if (lum[i] > faceMax) faceMax = lum[i]; }
    else if (lum[i] > bodyMax) bodyMax = lum[i];
  }

  let x0 = W, x1 = 0, y0 = H, y1 = 0;
  for (let i = 0; i < n; i++) if (faceMask[i]) {
    const x = i % W, y = (i / W) | 0;
    if (x < x0) x0 = x; if (x > x1) x1 = x; if (y < y0) y0 = y; if (y > y1) y1 = y;
  }

  // ── PER-JOINT DELIVERY at THIS camera ──────────────────────────────────────
  // `fc4d9ad` added a pelvis on `hips` because `limbmatch` had no `hips` row for 10
  // of 11 characters — the joint owned no meshes at all — and its own report says
  // the new pelvis delivers **0 px on donut, egg and soup at 58 degrees**, then says
  // the lobby is a 20 degree camera and "nothing here has ever measured the lobby".
  // This is that measurement. `own` counts the meshes the joint itself owns (not its
  // children), so `hips` is the pelvis alone and is not credited with the legs.
  const perJoint = {};
  for (const jn of opts.joints) {
    let joint = null;
    charRoot.traverse((o) => { if (!joint && o.name === jn) joint = o; });
    if (!joint) { perJoint[jn] = { own: 0, footprint: null, delivered: null, note: 'JOINT ABSENT' }; continue; }
    const own = [];
    joint.children.forEach((c) => { if (c.isMesh) own.push(c); });
    if (!own.length) { perJoint[jn] = { own: 0, footprint: 0, delivered: 0, note: 'owns no meshes' }; continue; }
    // FOOTPRINT: the joint alone against an empty scene — how big it would be if
    // nothing occluded it. DELIVERED: how many pixels of the full render it is
    // actually responsible for. The gap between the two is the whole point: a mass
    // buried inside the food has a large footprint and delivers nothing, which is
    // this project's most-repeated defect and is invisible to any tool that only
    // asks whether the geometry exists.
    const others = [];
    scene.traverse((o) => { if (o.isMesh && o.visible && !own.includes(o)) { others.push(o); o.visible = false; } });
    const solo = direct();
    own.forEach((m) => { m.visible = false; });
    const blank = direct();
    own.forEach((m) => { m.visible = true; });
    others.forEach((o) => { o.visible = true; });
    const fp = diffMask(solo, blank, n).reduce((s, v) => s + v, 0);

    own.forEach((m) => { m.visible = false; });
    const without = direct();
    own.forEach((m) => { m.visible = true; });
    const dl = diffMask(dAll, without, n).reduce((s, v) => s + v, 0);
    perJoint[jn] = { own: own.length, footprint: fp, delivered: dl, pct: fp ? +(100 * dl / fp).toFixed(1) : null };
  }
  stage.render(0);

  return {
    W, H, nFaceMeshes: faceMeshes.length, charN, faceN, perJoint,
    faceAbove85: shareAbove(lum, faceMask, 0.85),
    faceAbove94: shareAbove(lum, faceMask, 0.94),
    charAbove94: shareAbove(lum, charMask, 0.94),
    eyeN, comps: comps.slice(0, 6).map((c) => ({ n: c.n, cx: Math.round(c.cx), cy: Math.round(c.cy), maxL: +c.maxL.toFixed(4) })),
    nComps: comps.length, faceMax, bodyMax, maxL, maxInFace: faceMask[maxI] === 1,
    bbox: [x0, y0, x1, y1],
  };
};

const browser = await chromium.launch({ args: LAUNCH_ARGS });
const page = await browser.newPage({ viewport: { width: 760, height: 980 }, deviceScaleFactor: 1 });
const url = `${BASE}/preview.html?id=${ID}&pitch=${PITCH}&yaw=${YAW}&anim=idle`;
await page.goto(url, { waitUntil: 'domcontentloaded' });
await page.waitForFunction(() => window.__previewReady === true, null, { timeout: 60_000 });
// `preview.html` has no shell and no curtain, so `__previewReady` is not the
// `docs/LESSONS.md` §8 trap here — there is no fade for it to fire inside. Two
// presented frames after it is the same wait `shoot.mjs --char` uses on this page.
await page.evaluate(() => new Promise((res) => requestAnimationFrame(() => requestAnimationFrame(res))));

const JOINTS = get('--joints', 'hips,hipL,hipR,kneeL,torso,neck').split(',').filter(Boolean);
// The model's real standing height in METRES, off the preview's own API. Cheap, and
// it is the only number that can say whether this character sits in the cast band —
// `valuescan`'s on-screen `h` cannot, because it is a share of a frame.
const modelInfo = await page.evaluate(() => window.__preview?.info() ?? null);
const cap = await page.evaluate(CAPTURE, { id: ID, src: PURE_SRC, joints: JOINTS });
if (cap.error) { console.error(`\n✗ ${cap.error}\n`); await browser.close(); process.exit(1); }

const { W, H, charN, faceN, eyeN } = cap;
const pct = (v) => (v == null ? '  n/a' : `${(v * 100).toFixed(1)}%`);
console.log(`\nch_egg_face — ${ID} @ pitch ${PITCH} yaw ${YAW}  (${W}x${H}, ${cap.nFaceMeshes} face meshes)\n`);
console.log(`  model bounding height            ${modelInfo?.height ?? '?'} m   width ${modelInfo?.width ?? '?'} m   footY ${modelInfo?.footY ?? '?'}`);
console.log(`  character pixels                 ${charN}`);
console.log(`  face pixels (ablation)           ${faceN}  (${((100 * faceN) / charN).toFixed(2)}% of the character)`);
console.log(`  faceAbove85                      ${pct(cap.faceAbove85)}   <- conservative: includes brows + mouth`);
console.log(`  faceAbove94                      ${pct(cap.faceAbove94)}`);
console.log(`  eyeAbove85 (2 largest blobs)      ${eyeN} px, ${((100 * eyeN) / faceN).toFixed(1)}% of face   <- vs reference 31.1% / 34.1%`);
console.log(`  bright components >= 8px         ${cap.nComps}  sizes ${cap.comps.map((c) => c.n).join(',') || '—'}`);
console.log(`  face peak luma                   ${cap.faceMax.toFixed(4)}`);
console.log(`  body peak luma (face removed)    ${cap.bodyMax.toFixed(4)}`);
console.log(`  brightest pixel on the character ${cap.maxL.toFixed(4)}  ${cap.maxInFace ? 'IS IN THE FACE ✓' : 'is NOT in the face ✗'}`);
console.log(`  charAbove94 (near-white clip)     ${pct(cap.charAbove94)}   <- reference band 0.72%-9.29%, median 2.49%`);
console.log(`\n  PER-JOINT DELIVERY at pitch ${PITCH} — the camera nothing in this repo had measured`);
console.log(`    ${'joint'.padEnd(9)} ${'meshes'.padStart(6)} ${'footprint'.padStart(10)} ${'delivered'.padStart(10)}  reaches`);
for (const [k, v] of Object.entries(cap.perJoint)) {
  console.log(`    ${k.padEnd(9)} ${String(v.own).padStart(6)} ${String(v.footprint ?? '—').padStart(10)} ${String(v.delivered ?? '—').padStart(10)}`
    + `  ${v.pct == null ? (v.note ?? '') : `${v.pct}%`}`);
}

await mkdir(OUT, { recursive: true });
const full = await page.screenshot();
const png = `${OUT}/face.${TAG}.png`;
await writeFile(png, full);
// A 2x crop around the face mask's bounding box — the panel to actually LOOK at.
const [x0, y0, x1, y1] = cap.bbox;
const padX = Math.round((x1 - x0) * 0.55), padY = Math.round((y1 - y0) * 0.85);
const cx0 = Math.max(0, x0 - padX), cy0 = Math.max(0, y0 - padY);
const cw = Math.min(W - cx0, x1 - x0 + padX * 2), ch = Math.min(H - cy0, y1 - y0 + padY * 2);
const crop = `${OUT}/facecrop.${TAG}.png`;
await sharp(full).extract({ left: cx0, top: cy0, width: cw, height: ch }).resize(cw * 2).png().toFile(crop);
await writeFile(`${OUT}/face.${TAG}.json`, JSON.stringify({ id: ID, pitch: PITCH, yaw: YAW, ...cap }, null, 2));
console.log(`\n  wrote ${png}\n        ${crop}\n`);

await browser.close();
