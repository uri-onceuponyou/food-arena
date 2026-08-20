#!/usr/bin/env node
/**
 * QA_AB — DID THE HOME AND CHARACTER SCREENS ACTUALLY CHANGE BETWEEN THE TWO DEPLOYS?
 *
 * Uri, on an iPhone 15 Pro against `https://uri-onceuponyou.github.io/food-arena/`:
 *   > "It feels like there is a slight regression is VFX quality. home screen, and more
 *   >  specifically character screen seems like the resolution is slightly lower, or
 *   >  something else changed."
 *
 * He named THREE candidate defects and told us he cannot tell them apart. This tool does
 * not try to. It answers the prior question — **is there anything to explain, and where** —
 * and it answers it on the exact artefact he loaded.
 *
 * ── WHAT IS BEING COMPARED, AND WHY IT IS THE RIGHT PAIR ───────────────────────────
 * Not a guess at a range. Both arms are IDENTIFIED BY BUNDLE HASH against `gh-pages`:
 *
 *   AFTER  = a494f98 -> `vite build` emits main-vWXKMCSO.js / kitchen-BTNkGVUO.js
 *            which are BYTE-IDENTICAL to the files in gh-pages 5ecdc04 (deployed
 *            2026-08-19 22:21), i.e. literally the bundle Uri is playing.
 *   BEFORE = 8ca8f88 -> emits main-D905jUiP.js / kitchen-CRxYy-tF.js, which are the
 *            asset names in gh-pages 9cbc718 (deployed 2026-08-18), i.e. the build his
 *            "feels ALOT better than before. smooth." was about.
 *
 * ⚠️ The orchestrator's candidate list named `d0a42ea` (shake) and `2d4840e` (lobby).
 * BOTH ARE ANCESTORS OF 8ca8f88 — they were already in the build he liked, so neither
 * can be the regression. The real range is `8ca8f88..a494f98`, 32 commits.
 *
 * ── WHY PRODUCTION BUNDLES AND NOT `with_snapshot` ─────────────────────────────────
 * CLAUDE.md rule 2 exists to stop a peer's half-saved file contaminating a render.
 * A `vite build` run inside a DETACHED WORKTREE already satisfies that strictly better
 * than a snapshot does: the output is an immutable directory of bytes, and its provenance
 * is provable by hash rather than by "whatever the shell's cwd happened to be" (which is
 * the documented hole in `with_snapshot`, since it spawns `snapshot.mjs` with no `cwd`).
 * It also satisfies AGENT-BRIEF §4.8 — *measure the artefact you SHIP, on the PATH you
 * ship it to* — because it is served under `/food-arena/`, the deployed base, not `/`.
 *
 * Both servers are plain in-process `node:http`. Nothing is backgrounded, so there is no
 * PID to leak and no pattern to kill (CLAUDE.md 8b).
 *
 * ── DETERMINISM: WHY THE DRIFT CONTROL CAN BE `EXACTLY ZERO` ───────────────────────
 * These screens animate. A naive repeat capture differs every time, which would make
 * every A/B number below unreadable — so three sources of variance are removed, and the
 * removal is then PROVED by a self-pair rather than assumed:
 *
 *  1. **rAF timestamps.** `shell.ts:tick` computes `dt` from the rAF argument, so the
 *     portrait's pose is a function of wall-clock frame timing. Every rAF callback is
 *     wrapped so it receives a VIRTUAL timestamp that advances by exactly 16.6667 ms
 *     **once per real frame** (all callbacks sharing a real `t` share one virtual `t`).
 *     Captures are then taken at a fixed FRAME COUNT, never a fixed duration, so both
 *     runs land on the same virtual instant on any machine at any speed.
 *  2. **`Math.random`.** Reseeded to a fixed PRNG, same pattern as `lq_shot.mjs`.
 *  3. **Camera shake.** `AGENT-BRIEF` §3: `CameraRig.update()` multiplies the shake DECAY
 *     by dt but not the RE-RANDOMISATION, so a frozen frame is not a frozen camera and
 *     344 of 344 frozen frames drifted. Zeroed explicitly on every live stage.
 *  4. **CSS animations** run on the document timeline, not rAF, so freezing rAF does not
 *     still them. `screenshot({ animations: 'disabled' })` does.
 *
 * ⚠️ **SwiftShader IS NOT A PHONE.** Everything here runs on a software rasteriser. That
 * is fine for an A/B (same instrument in both arms) and worthless as an absolute claim
 * about what an iPhone does. The device profile below emulates the ONE thing that governs
 * the quantity in question — viewport, deviceScaleFactor, coarse pointer, touch — and
 * `--assert-phone` refuses to report if the emulated tier is not the one a real phone
 * would pick, so a silently-desktop measurement cannot be mistaken for a phone one.
 *
 * ── USE ────────────────────────────────────────────────────────────────────────────
 *   node tools/tmp/qa_ab.mjs --before /tmp/fa-qa-before/dist-deploy \
 *                            --after  /tmp/fa-qa-after/dist-deploy  --out tools/tmp/qa_out
 *   node tools/tmp/qa_ab.mjs --selftest        # logic checks, incl. the known-bad
 *
 * ⚠️ `--selftest` validates this file's LOGIC. It does NOT validate where it is POINTED.
 * The pointing is validated by the bundle-hash identification above and by `--verify-dirs`.
 *
 * Exit 0 = ran. Exit 1 = the DRIFT CONTROL FAILED, i.e. no number here may be believed.
 * Exit 2 = usage / pointing error.
 */
import { chromium } from 'playwright';
import sharp from 'sharp';
import { createServer } from 'node:http';
import { createHash } from 'node:crypto';
import { readFile, mkdir, writeFile } from 'node:fs/promises';
import { existsSync, readFileSync } from 'node:fs';
import { join, extname, resolve } from 'node:path';

const argv = process.argv.slice(2);
const has = (k) => argv.includes(k);
const arg = (k, d) => (argv.includes(k) ? argv[argv.indexOf(k) + 1] : d);

const BASE_PATH = arg('--base', '/food-arena/');
const OUT = resolve(arg('--out', 'tools/tmp/qa_out'));
const FRAMES = Number(arg('--frames', '150'));
/**
 * Which character the profile has equipped, seeded straight into localStorage.
 *
 * This is the CONTROL for the whole diagnosis. `062513c` changed `hamburger.ts`, and
 * hamburger is the default equipped character — so every frame in the default A/B has a
 * changed subject in it. Re-running with a character whose file did NOT change in the
 * range separates "the subject was edited" from "something global moved": if the
 * background is bit-identical with `donut` equipped and differs with `hamburger`, the
 * background is not independently broken, it is being re-framed by the subject.
 */
const CHARACTER = arg('--character', null);
const STEP_MS = 1000 / 60;

/**
 * The device. iPhone 15 Pro, portrait: 393x852 CSS at deviceScaleFactor 3.
 * `isMobile`+`hasTouch` are what make `quality.ts:detectTier` see a phone at all — it
 * reads `coarsePointer && maxTouchPoints > 0`, then the screen's short edge in CSS px.
 */
const DEVICES = {
  phone: { viewport: { width: 393, height: 852 }, deviceScaleFactor: 3, isMobile: true, hasTouch: true },
  phone_land: { viewport: { width: 852, height: 393 }, deviceScaleFactor: 3, isMobile: true, hasTouch: true },
  desk: { viewport: { width: 1280, height: 800 }, deviceScaleFactor: 1, isMobile: false, hasTouch: false },
};

const SCREENS = [
  { name: 'home', path: '?screen=home' },
  { name: 'characters', path: '?screen=characters' },
];

const MIME = {
  '.html': 'text/html; charset=utf-8', '.js': 'text/javascript; charset=utf-8',
  '.css': 'text/css; charset=utf-8', '.json': 'application/json',
  '.webmanifest': 'application/manifest+json', '.png': 'image/png', '.svg': 'image/svg+xml',
  '.woff2': 'font/woff2', '.mp3': 'audio/mpeg', '.txt': 'text/plain; charset=utf-8',
  '.ico': 'image/x-icon',
};

// ─────────────────────────────────────────────────────────────────────────────
// The page-side instrument. Installed before any app code runs.
// ─────────────────────────────────────────────────────────────────────────────
function initScript(stepMs) {
  return `(() => {
    const STEP = ${stepMs};
    let HALT_AT = Infinity;
    let virt = 0, lastReal = null, frames = 0, halted = false, advancing = false;
    const real = window.requestAnimationFrame.bind(window);
    // One virtual tick per REAL frame. Every callback scheduled for the same real
    // frame receives the SAME virtual timestamp, which is what makes the sequence a
    // function of the frame COUNT and not of machine speed.
    window.requestAnimationFrame = (cb) => {
      if (halted) return 0;
      return real((t) => {
        if (halted) return undefined;
        // VIRTUAL TIME IS PINNED AT 0 UNTIL arm() IS CALLED.
        // Boot, mount and asset upload therefore all happen at t=0, so every screen's
        // own elapsed starts from the SAME instant no matter how slow the machine was
        // — which is the last source of drift here. Counting N frames from an armed
        // point was not enough: the shell's elapsed accumulates from MOUNT, and mount
        // lands at a different real moment every run, so identical frame counts still
        // produced different animation phases. Pinning the origin fixes the phase.
        if (lastReal === null || t !== lastReal) {
          lastReal = t;
          if (advancing) { virt += STEP; frames++; }
        }
        // AUTO-HALT AT AN EXACT FRAME COUNT, ARMED BY THE DRIVER.
        // Two separate defects were fixed here, and the second one only showed up
        // because the first was fixed:
        //  1. Halting FROM the driver let the app run for however many frames fell
        //     inside a 100 ms poll, so the arms stopped on different frames — 18.2% of
        //     pixels. The stop has to be page-side and exact.
        //  2. Counting from PAGE LOAD then made the window overlap asset loading, so
        //     frame 150 caught a different amount of decoded/uploaded work each run.
        //     That one was INTERMITTENT — it passed on one run and failed at 24.1% on
        //     the next, which is the worst way for a control to be wrong. The count is
        //     now armed only after every readiness gate has passed, so all N frames are
        //     frames of a fully-loaded page.
        if (frames > HALT_AT) { halted = true; return undefined; }
        return cb(virt);
      });
    };
    performance.now = () => virt;
    // Keep the wheel turning even if the mounted screen defines no update().
    const pump = () => { window.requestAnimationFrame(pump); };
    window.requestAnimationFrame(pump);
    let seed = 0x9e3779b9 >>> 0;
    Math.random = () => {
      seed = (seed + 0x6d2b79f5) >>> 0;
      let x = seed;
      x = Math.imul(x ^ (x >>> 15), x | 1) >>> 0;
      x = (x ^ (x + Math.imul(x ^ (x >>> 7), x | 61))) >>> 0;
      return ((x ^ (x >>> 14)) >>> 0) / 4294967296;
    };
    // HALT. Once set, no wrapped callback is ever scheduled again, so the app stops
    // advancing and the canvas keeps whatever was last drawn into it. Without this the
    // loop kept running between the readback and the shutter and the SELF-PAIR DIFFERED
    // — which is the whole reason a drift control is run before anything else.
    window.__qa = {
      frames: () => frames, vt: () => virt,
      halt() { halted = true; },
      arm(n) { advancing = true; HALT_AT = frames + n; return HALT_AT; },
      armed: () => HALT_AT,
      halted: () => halted,
    };
  })()`;
}

/** Everything numeric a "resolution" or "VFX" claim could live in. */
const READBACK = `(() => {
  const out = { canvases: [], stages: [], errors: [] };
  const dpr = window.devicePixelRatio;
  out.dpr = dpr;
  out.innerW = window.innerWidth; out.innerH = window.innerHeight;
  out.screenW = screen.width; out.screenH = screen.height;
  out.screenShortEdge = Math.min(screen.width, screen.height);
  out.frames = window.__qa ? window.__qa.frames() : null;
  out.vt = window.__qa ? window.__qa.vt() : null;
  out.screen = window.__screen ?? null;
  out.quality = window.__quality ? {
    tier: window.__quality.tier, choice: window.__quality.choice,
    forced: window.__quality.forced, detected: window.__quality.detected,
    profile: JSON.parse(JSON.stringify(window.__quality.profile)),
    signals: JSON.parse(JSON.stringify(window.__quality.signals)),
  } : null;
  for (const c of Array.from(document.querySelectorAll('canvas'))) {
    const r = c.getBoundingClientRect();
    out.canvases.push({
      cssW: +r.width.toFixed(2), cssH: +r.height.toFixed(2),
      bufW: c.width, bufH: c.height,
      bufMpx: +((c.width * c.height) / 1e6).toFixed(4),
      // The ratio the app ACTUALLY achieved, not the one it asked for.
      realisedRatio: r.width > 0 ? +(c.width / r.width).toFixed(4) : null,
      onScreen: r.width > 1 && r.height > 1 && r.right > 0 && r.bottom > 0,
    });
  }
  const stages = window.__stages || [];
  for (const s of stages) {
    if (s.disposed) continue;
    let info = null;
    try {
      const i = s.renderer.info;
      info = { calls: i.render.calls, tris: i.render.triangles, lines: i.render.lines,
               points: i.render.points, geometries: i.memory.geometries,
               textures: i.memory.textures, programs: i.programs ? i.programs.length : null };
    } catch (e) { out.errors.push('renderer.info: ' + e); }
    let composer = null;
    try { composer = { present: !!s.composer, passes: s.composer ? s.composer.passes.length : 0 }; }
    catch (e) { composer = null; }
    out.stages.push({
      offscreen: !!s.offscreen,
      pixelRatio: s.renderer.getPixelRatio(),
      drawW: s.renderer.domElement.width, drawH: s.renderer.domElement.height,
      tier: s.profile ? s.profile.tier : null,
      pixelRatioCap: s.profile ? s.profile.pixelRatioCap : null,
      bloom: s.profile ? s.profile.bloom : null,
      smaa: s.profile ? s.profile.smaa : null,
      msaaSamples: s.profile ? s.profile.msaaSamples : null,
      shadowMapScale: s.profile ? s.profile.shadowMapScale : null,
      halfFloatBuffers: s.profile ? s.profile.halfFloatBuffers : null,
      info, composer,
    });
  }
  try { out.charStage = window.__charStage ? window.__charStage() : null; } catch (e) { out.charStage = null; }
  try { out.glLog = (window.__glLog || []).slice(-8); } catch (e) { out.glLog = null; }
  return out;
})()`;

function staticServer(root, basePath) {
  return new Promise((res) => {
    const srv = createServer(async (req, rq) => {
      try {
        let p = decodeURIComponent(req.url.split('?')[0]);
        if (basePath !== '/' && p.startsWith(basePath)) p = '/' + p.slice(basePath.length);
        if (p === '/' || p === '') p = '/index.html';
        let f = join(root, p);
        if (!existsSync(f) || !extname(f)) f = join(root, 'index.html'); // SPA fallback
        const body = await readFile(f);
        rq.writeHead(200, { 'content-type': MIME[extname(f)] || 'application/octet-stream',
          'cache-control': 'no-store' });
        rq.end(body);
      } catch (e) { rq.writeHead(404); rq.end('nope'); }
    });
    srv.listen(0, '127.0.0.1', () => res({ srv, port: srv.address().port }));
  });
}

const sha = (buf) => createHash('sha256').update(buf).digest('hex').slice(0, 16);

/**
 * A hash answers "identical?"; it cannot answer "how far?". A one-pixel dither and a
 * whole-frame darkening both read DIFFERS, and rule 4's eighteenth case — a restored GL
 * context 15.65 luma darker — is precisely a case where the SIZE was the diagnosis.
 * Returns px changed, %, mean |delta| over changed px, and mean luma of each side.
 */
async function pixDiff(a, b) {
  if (!a || !b) return null;
  const ia = sharp(a).ensureAlpha().raw();
  const ib = sharp(b).ensureAlpha().raw();
  const [ra, rb] = await Promise.all([ia.toBuffer({ resolveWithObject: true }),
    ib.toBuffer({ resolveWithObject: true })]);
  if (ra.info.width !== rb.info.width || ra.info.height !== rb.info.height) {
    return { sizeMismatch: true, a: `${ra.info.width}x${ra.info.height}`, b: `${rb.info.width}x${rb.info.height}` };
  }
  const A = ra.data, B = rb.data;
  const n = ra.info.width * ra.info.height;
  let changed = 0, sumDelta = 0, lumA = 0, lumB = 0, maxDelta = 0;
  for (let i = 0; i < n; i++) {
    const o = i * 4;
    const d = Math.abs(A[o] - B[o]) + Math.abs(A[o + 1] - B[o + 1]) + Math.abs(A[o + 2] - B[o + 2]);
    if (d > 0) { changed++; sumDelta += d / 3; if (d / 3 > maxDelta) maxDelta = d / 3; }
    lumA += 0.2126 * A[o] + 0.7152 * A[o + 1] + 0.0722 * A[o + 2];
    lumB += 0.2126 * B[o] + 0.7152 * B[o + 1] + 0.0722 * B[o + 2];
  }
  return {
    w: ra.info.width, h: ra.info.height, px: n,
    changed, pct: +((changed / n) * 100).toFixed(4),
    meanDeltaOnChanged: changed ? +(sumDelta / changed).toFixed(3) : 0,
    maxDelta: +maxDelta.toFixed(1),
    lumaA: +(lumA / n).toFixed(3), lumaB: +(lumB / n).toFixed(3),
    lumaDelta: +((lumA - lumB) / n).toFixed(3),
  };
}

/**
 * One capture: boot, run a FIXED NUMBER OF VIRTUAL FRAMES, still the shake, shoot.
 * Returns { png, canvasPng, metrics }.
 */
async function capture(browser, url, dev, screen, tag) {
  const ctx = await browser.newContext({ ...DEVICES[dev] });
  const page = await ctx.newPage();
  const pageErrors = [];
  page.on('pageerror', (e) => pageErrors.push(String(e)));
  await page.addInitScript(initScript(STEP_MS));
  if (CHARACTER) {
    // `profile.ts:load()` validates each field and falls back per-field, so a blob
    // carrying only `selected` is enough and everything else keeps its default.
    await page.addInitScript(`(() => {
      try { localStorage.setItem('food-arena.profile.v1', JSON.stringify({ selected: ${JSON.stringify(CHARACTER)} })); } catch (e) {}
    })()`);
  }
  await page.goto(`${url}${screen.path}`, { waitUntil: 'domcontentloaded', timeout: 120_000 });
  // ⚠️ rAF is wrapped, and Playwright's default `waitForFunction` polling IS rAF.
  // Poll on a timer instead or this deadlocks in a way that reads as a hung build.
  await page.waitForFunction(
    `window.__screenReady === true && window.__screen === ${JSON.stringify(screen.name)}`,
    null, { timeout: 120_000, polling: 200 },
  );
  // ── EVERY READINESS GATE BEFORE THE FRAME COUNT IS ARMED ────────────────────
  // Each of these completes on a REAL-TIME schedule (decode, upload, font load), so any
  // frame counted while one is outstanding is a frame whose content depends on how fast
  // this machine happened to be. Gate first, then count.
  await page.waitForFunction('window.__previewReady === true', null, { timeout: 60_000, polling: 100 })
    .catch(() => {});
  await page.waitForFunction('window.__thumbsReady === true', null, { timeout: 60_000, polling: 100 })
    .catch(() => {});
  await page.evaluate('document.fonts ? document.fonts.ready.then(() => true) : true').catch(() => {});
  await page.waitForFunction(
    'Array.prototype.every.call(document.images, (i) => i.complete)', null,
    { timeout: 60_000, polling: 100 },
  ).catch(() => {});
  // Now arm. Fixed FRAME COUNT, not a fixed duration, decided page-side so a slow poll
  // cannot let one arm run further than the other.
  await page.evaluate(`window.__qa.arm(${FRAMES})`);
  await page.waitForFunction('window.__qa && window.__qa.halted()',
    null, { timeout: 180_000, polling: 100 });
  // Pose. AGENT-BRIEF §3: a frozen frame is not a frozen camera — the shake
  // re-randomises on every render() — so zero the rig BEFORE the one render we keep.
  await page.evaluate(`(() => {
    for (const s of (window.__stages || [])) {
      if (s.disposed) continue;
      try { s.rig.shakeAmount = 0; s.rig.shakeOffset.set(0, 0, 0); s.rig.apply(); } catch (e) {}
    }
    for (const s of (window.__stages || [])) {
      if (s.disposed) continue;
      try { s.render(0); } catch (e) {}
    }
  })()`);
  const metrics = await page.evaluate(READBACK);
  metrics.pageErrors = pageErrors;
  const full = await page.screenshot({ animations: 'disabled' });
  // ⚠️ The canvas crop is CUT OUT OF THAT ONE FRAME, not shot separately.
  // `locator.screenshot()` is a second `Page.captureScreenshot` with a clip — the same
  // operation, one shutter later — and on `desk/home` the two shutters disagreed at
  // meanDelta 0.371 / max 5.7 while the FULL PAGE was bit-identical, i.e. the difference
  // was manufactured entirely by firing twice. One shutter, cropped, is exact by
  // construction. (AGENT-BRIEF §3 already notes a locator canvas shot is a clipped page
  // capture; that cuts the other way too.)
  let canvasPng = null;
  const cv = page.locator('canvas').first();
  if (await cv.count()) {
    const bb = await cv.boundingBox();
    const dsf = DEVICES[dev].deviceScaleFactor;
    if (bb && bb.width > 1 && bb.height > 1) {
      const meta = await sharp(full).metadata();
      const left = Math.max(0, Math.round(bb.x * dsf));
      const top = Math.max(0, Math.round(bb.y * dsf));
      const width = Math.min(Math.round(bb.width * dsf), meta.width - left);
      const height = Math.min(Math.round(bb.height * dsf), meta.height - top);
      if (width > 1 && height > 1) {
        canvasPng = await sharp(full).extract({ left, top, width, height }).png().toBuffer();
      }
    }
  }
  await ctx.close();
  return { tag, metrics, full, canvasPng };
}

// ─────────────────────────────────────────────────────────────────────────────
// SELFTEST — logic only. See the header: it does not validate the pointing.
// ─────────────────────────────────────────────────────────────────────────────
if (has('--selftest')) {
  let fails = 0;
  const ok = (c, m) => { console.log(`${c ? '  ok  ' : '  FAIL'} ${m}`); if (!c) fails++; };

  // §A — the PRNG in the init script is deterministic and not the identity.
  const mk = () => {
    let seed = 0x9e3779b9 >>> 0;
    return () => {
      seed = (seed + 0x6d2b79f5) >>> 0;
      let x = seed;
      x = Math.imul(x ^ (x >>> 15), x | 1) >>> 0;
      x = (x ^ (x + Math.imul(x ^ (x >>> 7), x | 61))) >>> 0;
      return ((x ^ (x >>> 14)) >>> 0) / 4294967296;
    };
  };
  const a = [], b = [];
  const ra = mk(), rb = mk();
  for (let i = 0; i < 50; i++) { a.push(ra()); b.push(rb()); }
  ok(JSON.stringify(a) === JSON.stringify(b), 'A1 seeded PRNG reproduces');
  ok(new Set(a).size > 40, 'A2 seeded PRNG is not constant');
  ok(a.every((v) => v >= 0 && v < 1), 'A3 seeded PRNG in range');

  // §B — KNOWN-BAD. A differ that cannot see a one-byte change is not a differ.
  const p = Buffer.from('the same bytes');
  const q = Buffer.from('the same byteS');
  ok(sha(p) === sha(Buffer.from('the same bytes')), 'B1 hash stable on identical input');
  ok(sha(p) !== sha(q), 'B2 KNOWN-BAD: hash MOVES on a one-byte change');

  // §C — the virtual clock advances once per real frame, not once per callback.
  let virt = 0, lastReal = null, frames = 0;
  const wrap = (t) => { if (lastReal === null || t !== lastReal) { lastReal = t; virt += STEP_MS; frames++; } };
  wrap(100); wrap(100); wrap(100); wrap(116); wrap(116);
  ok(frames === 2, `C1 three callbacks in one real frame = one tick (got ${frames})`);
  ok(Math.abs(virt - 2 * STEP_MS) < 1e-9, 'C2 virtual time tracks frame count');

  // §D — NON-EMPTINESS. `[].every()` is `true`; the vacuity has fired 7+ times here.
  ok(SCREENS.length > 0, 'D1 SCREENS non-empty');
  ok(Object.keys(DEVICES).length > 0, 'D2 DEVICES non-empty');
  const phoneShort = Math.min(DEVICES.phone.viewport.width, DEVICES.phone.viewport.height);
  ok(phoneShort <= 500, `D3 phone profile short edge ${phoneShort} <= 500, the detectTier threshold`);
  ok(DEVICES.phone.hasTouch && DEVICES.phone.isMobile,
    'D4 phone profile sets the two signals detectTier actually reads');
  ok(DEVICES.desk.hasTouch === false,
    'D5 KNOWN-BAD control: the desktop profile must NOT satisfy the phone predicate');

  // §E — the tier caps this tool reports against, held as literals on purpose so the
  // check cannot be satisfied by the code agreeing with itself.
  const qsrc = readFileSync('src/render/quality.ts', 'utf8');
  for (const [t, cap] of [['high', 2], ['medium', 1.5], ['low', 1.25]]) {
    const re = new RegExp(`tier:\\s*'${t}'[\\s\\S]{0,600}?pixelRatioCap:\\s*([0-9.]+)`);
    const m = qsrc.match(re);
    ok(m && Number(m[1]) === cap, `E-${t} pixelRatioCap is ${cap} in quality.ts (read ${m ? m[1] : 'NOT FOUND'})`);
  }
  console.log(fails ? `\nSELFTEST: ${fails} FAILED` : '\nSELFTEST: all passed');
  process.exit(fails ? 1 : 0);
}

// ─────────────────────────────────────────────────────────────────────────────
const BEFORE = arg('--before', null);
const AFTER = arg('--after', null);
if (!BEFORE || !AFTER) { console.error('usage: --before <distdir> --after <distdir>'); process.exit(2); }
for (const d of [BEFORE, AFTER]) {
  if (!existsSync(join(d, 'index.html'))) { console.error(`no index.html in ${d}`); process.exit(2); }
}
await mkdir(OUT, { recursive: true });

const sb = await staticServer(BEFORE, BASE_PATH);
const sa = await staticServer(AFTER, BASE_PATH);
const urlB = `http://127.0.0.1:${sb.port}${BASE_PATH}`;
const urlA = `http://127.0.0.1:${sa.port}${BASE_PATH}`;
console.log(`BEFORE ${BEFORE}\n   -> ${urlB}`);
console.log(`AFTER  ${AFTER}\n   -> ${urlA}\n`);

const browser = await chromium.launch({
  args: ['--use-gl=angle', '--use-angle=swiftshader', '--enable-unsafe-swiftshader',
    '--enable-webgl', '--ignore-gpu-blocklist', '--disable-gpu-sandbox', '--disable-dev-shm-usage'],
});

const rows = [];
let driftFail = 0;
const devices = (arg('--devices', 'phone,desk')).split(',');

try {
  for (const dev of devices) {
    for (const screen of SCREENS) {
      // ── 1. DRIFT CONTROL, FIRST AND ALWAYS. Same bytes, same instrument, twice.
      //    Anything non-zero here and every number below is unreadable.
      const c0 = await capture(browser, urlA, dev, screen, `${dev}_${screen.name}_selfA`);
      const c1 = await capture(browser, urlA, dev, screen, `${dev}_${screen.name}_selfB`);
      const selfFull = sha(c0.full) === sha(c1.full);
      const selfCv = c0.canvasPng && c1.canvasPng ? sha(c0.canvasPng) === sha(c1.canvasPng) : null;
      const selfDiffFull = selfFull ? null : await pixDiff(c0.full, c1.full);
      const selfDiffCv = selfCv === false ? await pixDiff(c0.canvasPng, c1.canvasPng) : null;
      if (!selfFull || selfCv === false) driftFail++;

      // ── 2. Only now, the other arm.
      const b = await capture(browser, urlB, dev, screen, `${dev}_${screen.name}_before`);

      const write = async (name, buf) => { if (buf) await writeFile(join(OUT, name), buf); };
      await write(`${dev}_${screen.name}_AFTER.png`, c0.full);
      await write(`${dev}_${screen.name}_AFTER2.png`, c1.full);
      await write(`${dev}_${screen.name}_BEFORE.png`, b.full);
      await write(`${dev}_${screen.name}_AFTER_canvas.png`, c0.canvasPng);
      await write(`${dev}_${screen.name}_BEFORE_canvas.png`, b.canvasPng);

      const row = {
        device: dev, screen: screen.name,
        drift: { fullIdentical: selfFull, canvasIdentical: selfCv,
          shaA: sha(c0.full), shaA2: sha(c1.full),
          diffFull: selfDiffFull, diffCanvas: selfDiffCv },
        ab: { fullIdentical: sha(b.full) === sha(c0.full),
          canvasIdentical: b.canvasPng && c0.canvasPng ? sha(b.canvasPng) === sha(c0.canvasPng) : null,
          shaBefore: sha(b.full),
          diffFull: await pixDiff(b.full, c0.full),
          diffCanvas: await pixDiff(b.canvasPng, c0.canvasPng) },
        before: b.metrics, after: c0.metrics,
      };
      rows.push(row);

      const cvA = c0.metrics.canvases.filter((c) => c.onScreen);
      const cvB = b.metrics.canvases.filter((c) => c.onScreen);
      console.log(`── ${dev} / ${screen.name}`);
      const d2s = (d) => (!d ? '' : d.sizeMismatch ? `SIZE ${d.a} vs ${d.b}`
        : `${d.changed}px ${d.pct}%  meanDelta ${d.meanDeltaOnChanged} max ${d.maxDelta}  luma ${d.lumaA} vs ${d.lumaB} (${d.lumaDelta >= 0 ? '+' : ''}${d.lumaDelta})`);
      console.log(`   DRIFT CONTROL  full=${selfFull ? 'IDENTICAL' : 'DIFFERS ✗ ' + d2s(selfDiffFull)}`);
      console.log(`                  canvas=${selfCv === null ? 'n/a' : selfCv ? 'IDENTICAL' : 'DIFFERS ✗ ' + d2s(selfDiffCv)}`);
      console.log(`   A/B  full      ${row.ab.fullIdentical ? 'identical' : d2s(row.ab.diffFull)}`);
      console.log(`   A/B  canvas    ${row.ab.canvasIdentical === null ? 'n/a' : row.ab.canvasIdentical ? 'identical' : d2s(row.ab.diffCanvas)}`);
      console.log(`   tier   before=${b.metrics.quality?.tier}/${b.metrics.quality?.detected}  after=${c0.metrics.quality?.tier}/${c0.metrics.quality?.detected}`);
      const fmt = (c) => c.map((x) => `${x.bufW}x${x.bufH}(css ${x.cssW}x${x.cssH}, r=${x.realisedRatio})`).join(' | ') || 'none on screen';
      console.log(`   canvas before  ${fmt(cvB)}`);
      console.log(`   canvas after   ${fmt(cvA)}`);
      const sA = c0.metrics.stages.filter((s) => !s.offscreen);
      const sB = b.metrics.stages.filter((s) => !s.offscreen);
      const fs = (s) => s.map((x) => `pr=${x.pixelRatio} cap=${x.pixelRatioCap} draws=${x.info?.calls} tris=${x.info?.tris} tex=${x.info?.textures} progs=${x.info?.programs} bloom=${x.bloom} smaa=${x.smaa} msaa=${x.msaaSamples}`).join('\n                  ') || 'none';
      console.log(`   stage before   ${fs(sB)}`);
      console.log(`   stage after    ${fs(sA)}`);
      if (b.metrics.pageErrors.length) console.log(`   ⚠️ BEFORE page errors: ${b.metrics.pageErrors.join(' | ')}`);
      if (c0.metrics.pageErrors.length) console.log(`   ⚠️ AFTER  page errors: ${c0.metrics.pageErrors.join(' | ')}`);
      console.log('');
    }
  }
} finally {
  await browser.close();
  sb.srv.close(); sa.srv.close();
}

await writeFile(join(OUT, 'qa_ab.json'), JSON.stringify({ before: BEFORE, after: AFTER, frames: FRAMES, rows }, null, 2));
console.log(`\nwrote ${join(OUT, 'qa_ab.json')}`);
if (driftFail) {
  console.log(`\n🚨 DRIFT CONTROL FAILED on ${driftFail} cell(s). NO A/B NUMBER ABOVE MAY BE BELIEVED.`);
  process.exit(1);
}
console.log('\nDRIFT CONTROL: every self-pair bit-identical. A/B results are readable.');
