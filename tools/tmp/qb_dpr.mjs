#!/usr/bin/env node
/**
 * qb_dpr — THE RESOLUTION PATH, END TO END, READ BACK IN-PAGE.
 *
 * Uri, on an iPhone 15 Pro against the DEPLOYED build: *"home screen, and more
 * specifically character screen seems like the resolution is slightly lower"*.
 *
 * This tool answers one question and refuses to answer any other: **what is the
 * character screen's actual drawing-buffer size on his device profile, and what
 * decided it?** It computes nothing from source. Every number below is read off the
 * live renderer and the live canvas.
 *
 * ── Why it serves a TREE and not the dev server ─────────────────────────────────
 * `CLAUDE.md` rule 2, and the sharper form of it in `AGENT-BRIEF.md` §3: `snapshot.mjs`
 * freezes the WORKING tree, so it stops peers changing things *during* a run without
 * removing what they already changed. Every arm here is a directory extracted from a
 * **committed gh-pages tree** with `git show`, i.e. the exact bytes Uri's phone
 * downloaded. That is `AGENT-BRIEF.md` §4.8 — *measure the artefact you SHIP, on the
 * path you ship it to* — and it also makes the working tree irrelevant by construction.
 *
 * ── The two things that make a number here trustworthy ──────────────────────────
 *
 *  1. **DRIFT CONTROL (`CLAUDE.md` rule 4).** Every cell reads back TWICE from the same
 *     live page and requires the two reads to be EXACTLY equal on every numeric field.
 *     A non-zero drift invalidates the cell and is printed, never rounded away. The
 *     eighteenth "it isn't there" on this project rendered plausibly and WRONGLY, so
 *     "is it the same?" is asked before any difference is believed.
 *
 *  2. **KNOWN-BAD ARM (`CLAUDE.md` rule 6).** `--knownbad` re-runs the identical cell
 *     with `&tier=high` forced, which must move the pixel ratio 1.25 -> 2 and the buffer
 *     with it. **An instrument that cannot be shown to FAIL is not an instrument**, and
 *     a readback that returns the same string on both tiers is measuring a constant.
 *     The arm ASSERTS the numbers differ; it does not merely print them.
 *
 *     ⚠️ And it asserts on a NON-EMPTY set first. `[].every()` is `true`, and that
 *     vacuity has fired at least seven times in this repo, always because something
 *     upstream emptied the filtered set. If no canvas is found, that is a FAILURE, not
 *     a pass with nothing to check.
 *
 * ── The backing store is sampled as a TIME SERIES, on purpose ───────────────────
 * Brief item 4 asks whether the char screen actually goes through `resize()` or is left
 * at a default, and whether a panel-size change can leave the buffer stale. A single
 * read after `__screenReady` cannot tell those apart — and `__screenReady` IS NOT A
 * PAINT (`AGENT-BRIEF.md` §3, measured opacity 0.000 when it flips). So this samples
 * every canvas's `width/height` repeatedly and reports the whole series plus whether it
 * ever CHANGED after the first sample. A buffer that starts wrong and is fixed by the
 * ResizeObserver looks completely different from one that is simply small.
 *
 * ── What this tool DOES NOT claim ───────────────────────────────────────────────
 * SwiftShader is not a phone. Drawing-buffer pixels are hardware-independent — the same
 * integer on an A17 as here — so the SIZES are quotable. Nothing about frame time,
 * sharpness-as-perceived, or iOS's own memory behaviour is measured here, and none of
 * it should be inferred from this output.
 *
 *   node tools/tmp/qb_dpr.mjs --tree <dir> --label cur
 *   node tools/tmp/qb_dpr.mjs --tree <dir> --label cur --knownbad
 *   node tools/tmp/qb_dpr.mjs --selftest        # validates the differ, not the pointing
 *
 * Exit 1 on any drift, any empty assertion set, or a failed known-bad arm.
 */
import { chromium, devices } from 'playwright';
import { createServer } from 'node:http';
import { readFile, stat, writeFile, mkdir } from 'node:fs/promises';
import { join, extname, dirname, resolve } from 'node:path';

// ─────────────────────────────────────────────────────────────────────────────
// args
// ─────────────────────────────────────────────────────────────────────────────
const A = process.argv.slice(2);
const get = (k, d) => (A.includes(k) ? A[A.indexOf(k) + 1] : d);
const has = (k) => A.includes(k);

/**
 * Uri's device, stated once. iPhone 15 Pro, devicePixelRatio 3.
 *
 * `isMobile`+`hasTouch` are NOT cosmetic — `quality.ts:detectTier` gates on
 * `matchMedia('(pointer: coarse)')` and `maxTouchPoints`, and without them Chromium
 * reports a desktop and detection returns `high`. That would silently measure a tier
 * Uri's phone never selects.
 *
 * ⚠️ `--w 393 --h 852` IS THE SCREEN, NOT THE VIEWPORT, AND THE TWO ARE DIFFERENT
 * NUMBERS ON THE DEVICE THIS IS ABOUT.
 *
 * 852 is the iPhone 15 Pro's panel height in CSS px. The page never gets it: Safari's
 * URL bar and toolbar take the difference, and Playwright's own `iPhone 15 Pro`
 * descriptor records the visible viewport as **393x659** with `screen` separately at
 * 393x852. Those feed different things —
 *
 *   * the VIEWPORT decides how tall the character panel is laid out, i.e. how many
 *     pixels the portrait is drawn into;
 *   * `screen` is what `quality.ts:qualitySignals` reads for
 *     `screenShortEdgeCssPx`, i.e. which TIER the device gets.
 *
 * Measuring at 393x852 (as this tool did first) therefore reports a taller panel than
 * Uri has and gets the tier right by luck — the short edge is 393 either way. Passing
 * `--device "iPhone 15 Pro"` uses the real descriptor for both, which is the closest
 * this repo can get without WebKit installed.
 *
 * 🚨 And it is still CHROMIUM. `devices[...]` sets a viewport, a scale factor, touch
 * flags and a UA string; it does not make ANGLE/SwiftShader behave like Apple's WebKit
 * on an A17. Drawing-buffer integers are engine-independent and quotable; anything
 * about how it LOOKS or how fast it runs on the real phone is not measured here.
 */
const named = get('--device', null);
const D = named ? devices[named] : null;
if (named && !D) { console.error(`unknown --device ${named}`); process.exit(2); }
const DEV = D
  ? {
    w: D.viewport.width, h: D.viewport.height, dsf: D.deviceScaleFactor,
    screenW: D.screen?.width ?? D.viewport.width, screenH: D.screen?.height ?? D.viewport.height,
    ua: D.userAgent, device: named,
  }
  : {
    w: Number(get('--w', 393)), h: Number(get('--h', 852)), dsf: Number(get('--dsf', 3)),
    screenW: Number(get('--w', 393)), screenH: Number(get('--h', 852)), ua: undefined, device: null,
  };

const BASE_PATH = get('--basepath', '/food-arena/');
const SAMPLES = Number(get('--samples', 12));
const SAMPLE_MS = Number(get('--samplems', 120));
/** `--resize 852x393` rotates the viewport mid-cell. See the resize probe in `measure`. */
const resizeTo = (() => {
  const v = get('--resize', null);
  if (!v) return null;
  const [w, h] = v.split('x').map(Number);
  return Number.isFinite(w) && Number.isFinite(h) ? { w, h } : null;
})();

const MIME = {
  '.html': 'text/html', '.js': 'text/javascript', '.mjs': 'text/javascript',
  '.css': 'text/css', '.json': 'application/json', '.webmanifest': 'application/manifest+json',
  '.png': 'image/png', '.woff2': 'font/woff2', '.mp3': 'audio/mpeg', '.txt': 'text/plain',
  '.svg': 'image/svg+xml', '.ico': 'image/x-icon',
};

/** Serve a committed tree under BASE_PATH. Returns { url, close } — no PID kill needed:
 *  the server lives inside THIS process, so it cannot be caught by a peer's pattern kill
 *  and cannot outlive the run (`CLAUDE.md` 8b). */
async function serveTree(root) {
  const srv = createServer(async (req, res) => {
    try {
      let p = decodeURIComponent(new URL(req.url, 'http://x').pathname);
      if (p.startsWith(BASE_PATH)) p = p.slice(BASE_PATH.length - 1);
      if (p === '/' || p === '') p = '/index.html';
      const file = join(root, p);
      if (!resolve(file).startsWith(resolve(root))) { res.writeHead(403).end(); return; }
      const st = await stat(file).catch(() => null);
      if (!st?.isFile()) { res.writeHead(404).end('not found'); return; }
      res.writeHead(200, {
        'content-type': MIME[extname(file)] ?? 'application/octet-stream',
        'cache-control': 'no-store',
      });
      res.end(await readFile(file));
    } catch (e) { res.writeHead(500).end(String(e)); }
  });
  await new Promise((r) => srv.listen(0, '127.0.0.1', r));
  const port = srv.address().port;
  return { url: `http://127.0.0.1:${port}${BASE_PATH}`, close: () => new Promise((r) => srv.close(r)) };
}

// ─────────────────────────────────────────────────────────────────────────────
// the readback — everything, in one page-side function
// ─────────────────────────────────────────────────────────────────────────────
/**
 * Read the resolution path off the LIVE page.
 *
 * Enumerates every `<canvas>` in the document rather than trusting `window.__stage`.
 * That getter prefers a live on-screen Stage and has a documented history of pointing
 * at a DEAD one (`stage.ts`: `perf.mjs` once described a thumbnail generator's corpse
 * as the trophy road). Enumerating the DOM cannot be pointed at the wrong object —
 * whatever is on screen is in the list, and the registry is reported ALONGSIDE it so
 * the two can be compared instead of one being assumed.
 */
const READBACK = () => {
  const stages = (window.__stages ?? []).map((s, i) => {
    let r = null;
    try {
      r = {
        i,
        offscreen: !!s.offscreen,
        disposed: !!s.disposed,
        contextLost: !!s.contextLost,
        pixelRatio: s.renderer ? s.renderer.getPixelRatio() : null,
        canvasW: s.canvas ? s.canvas.width : null,
        canvasH: s.canvas ? s.canvas.height : null,
        passes: s.composer ? s.composer.passes.length : 0,
        shadowMap: s.lighting?.key?.shadow?.mapSize?.x ?? null,
      };
    } catch (e) { r = { i, error: String(e) }; }
    return r;
  });

  const canvases = [...document.querySelectorAll('canvas')].map((c, i) => {
    const rect = c.getBoundingClientRect();
    const cssW = Math.round(rect.width * 1000) / 1000;
    const cssH = Math.round(rect.height * 1000) / 1000;
    return {
      i,
      // Identity that survives minification: where it sits, not what it is called.
      parent: c.parentElement ? (c.parentElement.className || c.parentElement.tagName) : null,
      onScreen: rect.width > 1 && rect.height > 1 && rect.right > 0 && rect.bottom > 0
        && rect.left < window.innerWidth && rect.top < window.innerHeight,
      bufW: c.width,
      bufH: c.height,
      cssW,
      cssH,
      clientW: c.clientWidth,
      clientH: c.clientHeight,
      // THE NUMBER THIS TOOL EXISTS FOR: pixels of backing store per CSS pixel.
      effRatioW: cssW > 0 ? Math.round((c.width / cssW) * 10000) / 10000 : null,
      effRatioH: cssH > 0 ? Math.round((c.height / cssH) * 10000) / 10000 : null,
      mpx: Math.round((c.width * c.height) / 1e3) / 1e3,
    };
  });

  const q = window.__quality ?? {};
  return {
    screen: window.__screen ?? null,
    screenReady: window.__screenReady === true,
    devicePixelRatio: window.devicePixelRatio,
    innerW: window.innerWidth,
    innerH: window.innerHeight,
    screenW: window.screen?.width ?? null,
    screenH: window.screen?.height ?? null,
    renderTier: window.__renderTier ?? null,
    tier: q.tier ?? null,
    choice: q.choice ?? null,
    forced: q.forced ?? null,
    detected: q.detected ?? null,
    pixelRatioCap: q.profile?.pixelRatioCap ?? null,
    bloom: q.profile?.bloom ?? null,
    smaa: q.profile?.smaa ?? null,
    msaaSamples: q.profile?.msaaSamples ?? null,
    shadowMapScale: q.profile?.shadowMapScale ?? null,
    propInk: q.profile?.propInk ?? null,
    signals: q.signals ?? null,
    glLog: (window.__glLog ?? []).map((e) => `${e.type}@${e.size}${e.offscreen ? ' (offscreen)' : ''}`),
    canvases,
    stages,
  };
};

/** Fields that MUST be bit-identical between two reads of one unchanged page. */
function driftKey(m) {
  return JSON.stringify({
    tier: m.tier, cap: m.pixelRatioCap, dpr: m.devicePixelRatio,
    canvases: m.canvases.map((c) => [c.bufW, c.bufH, c.cssW, c.cssH, c.onScreen]),
    stages: m.stages.map((s) => [s.pixelRatio, s.canvasW, s.canvasH, s.passes, s.shadowMap]),
  });
}

/**
 * `match` is here to answer ONE question and it is a falsification test.
 *
 * `charStage.ts` passes `maxPixelRatio: 2`; `match.ts` passes NOTHING, so its ceiling is
 * `Infinity`. That asymmetry looks like it should make the two screens render at
 * different sharpness — which would explain Uri saying the character screen is *"more
 * specifically"* affected. It cannot, and this route is what proves it rather than
 * arguing it: `effectivePixelRatio` is `min(dpr, caller, tierCap)` and EVERY shipped
 * tier cap (high 2, medium 1.5, low 1.25) is <= 2, so the caller's 2 is never the
 * binding term on any tier that ships. The `match` row must read the SAME ratio as
 * `characters`. If it ever does not, this comment is wrong and the measurement wins.
 *
 * Its readiness flag is `__gameReady`, not `__screenReady` — `main.ts` boots straight
 * into a match when a match-only parameter is present and never mounts a named screen.
 */
const ALL_ROUTES = {
  home: { name: 'home', q: 'screen=home', ready: (w) => window.__screenReady === true && window.__screen === w },
  characters: { name: 'characters', q: 'screen=characters', ready: (w) => window.__screenReady === true && window.__screen === w },
  match: { name: 'match', q: 'player=hamburger&enemy=donut', ready: () => window.__gameReady === true },
};
const ROUTES = get('--routes', 'home,characters').split(',').map((n) => {
  const r = ALL_ROUTES[n.trim()];
  if (!r) { console.error(`unknown route ${n}`); process.exit(2); }
  return r;
});

const LAUNCH_ARGS = ['--use-gl=angle', '--use-angle=swiftshader', '--enable-unsafe-swiftshader',
  '--enable-webgl', '--ignore-gpu-blocklist', '--disable-gpu-sandbox'];

async function measure(browser, baseUrl, route, extraQuery) {
  const ctx = await browser.newContext({
    viewport: { width: DEV.w, height: DEV.h },
    screen: { width: DEV.screenW, height: DEV.screenH },
    deviceScaleFactor: DEV.dsf,
    isMobile: true,
    hasTouch: true,
    ...(DEV.ua ? { userAgent: DEV.ua } : {}),
  });
  const page = await ctx.newPage();
  const errors = [];
  page.on('pageerror', (e) => errors.push(String(e)));
  const url = `${baseUrl}?${route.q}${extraQuery ? `&${extraQuery}` : ''}`;
  await page.goto(url, { waitUntil: 'domcontentloaded', timeout: 90_000 });
  await page.waitForFunction(route.ready, route.name, { timeout: 120_000 });

  // The TIME SERIES. `__screenReady` is not a paint and the ResizeObserver fires after
  // the mount, so a single read cannot distinguish "small" from "stale then corrected".
  const series = [];
  for (let i = 0; i < SAMPLES; i++) {
    series.push(await page.evaluate(READBACK));
    if (i < SAMPLES - 1) await page.waitForTimeout(SAMPLE_MS);
  }
  // The DRIFT CONTROL: one more read, immediately, with nothing changed between.
  const again = await page.evaluate(READBACK);
  const last = series[series.length - 1];
  const drift = driftKey(last) === driftKey(again) ? 0 : 1;

  /**
   * ── Brief item 4: can a panel-size change leave the backing store STALE? ──────
   *
   * `charStage.attachTo` wires a `ResizeObserver` on the host and `Stage.resize()`
   * calls `setSize(w, h, false)`. Both look right in source, and "looks right in
   * source" is what this project's rule 6 exists to distrust. So: rotate the viewport,
   * wait, and re-read. A backing store that still reports the PRE-rotation size is
   * stale — the exact defect that would make a screen soft after an orientation change
   * and sharp on a reload, which is a very plausible shape for *"or something else
   * changed"*.
   *
   * The check is `buf ≈ css * ratio` on the NEW css size, so it is a statement about
   * the numbers agreeing after the event, not about a size we predicted in advance.
   */
  let resizeProbe = null;
  if (resizeTo) {
    const before = last.canvases.filter((c) => c.onScreen).map((c) => `${c.bufW}x${c.bufH}@${c.cssW}x${c.cssH}`);
    await page.setViewportSize({ width: resizeTo.w, height: resizeTo.h });
    await page.waitForTimeout(1200);
    const after = await page.evaluate(READBACK);
    const on = after.canvases.filter((c) => c.onScreen);
    // NON-EMPTY FIRST. A rotation that leaves no on-screen canvas would make every
    // comparison below vacuously true.
    const vacuous = on.length === 0;
    const consistent = !vacuous && on.every((c) => {
      const want = Math.round(c.cssW * after.stages.find((s) => !s.offscreen && !s.disposed)?.pixelRatio);
      return Math.abs(c.bufW - want) <= 1;
    });
    resizeProbe = {
      to: `${resizeTo.w}x${resizeTo.h}`,
      before,
      after: on.map((c) => `${c.bufW}x${c.bufH}@${c.cssW}x${c.cssH}`),
      cssChanged: JSON.stringify(before) !== JSON.stringify(on.map((c) => `${c.bufW}x${c.bufH}@${c.cssW}x${c.cssH}`)),
      vacuous,
      consistent,
    };
  }

  await ctx.close();
  return { url, series, drift, driftBefore: driftKey(last), driftAfter: driftKey(again), errors, resizeProbe };
}

// ─────────────────────────────────────────────────────────────────────────────
// selftest — validates the DIFFER's logic. It does NOT validate where we point.
// ─────────────────────────────────────────────────────────────────────────────
if (has('--selftest')) {
  const mk = (bufW, bufH, ratio) => ({
    tier: 'low', pixelRatioCap: 1.25, devicePixelRatio: 3,
    canvases: [{ bufW, bufH, cssW: 393, cssH: 852, onScreen: true }],
    stages: [{ pixelRatio: ratio, canvasW: bufW, canvasH: bufH, passes: 2, shadowMap: 512 }],
  });
  const a = mk(491, 1065, 1.25);
  const b = mk(491, 1065, 1.25);
  const c = mk(786, 1704, 2);
  let bad = 0;
  // §A — identical reads must be identical. A differ that fails this is useless.
  if (driftKey(a) !== driftKey(b)) { console.log('SELFTEST FAIL §A: identical reads differ'); bad++; }
  // §B — A REAL RESOLUTION CHANGE MUST BE VISIBLE. This is the known-bad half: if the
  // differ cannot see 1.25 -> 2 it would have reported "no change" for the whole run.
  if (driftKey(a) === driftKey(c)) { console.log('SELFTEST FAIL §B: 1.25 vs 2.0 read as equal'); bad++; }
  // §C — NON-EMPTINESS. `[].every()` is true; so is a differ over two empty arrays.
  const empty = { tier: 'low', pixelRatioCap: 1.25, devicePixelRatio: 3, canvases: [], stages: [] };
  if (driftKey(empty) !== driftKey({ ...empty })) { console.log('SELFTEST FAIL §C setup'); bad++; }
  if (!(empty.canvases.length === 0)) { console.log('SELFTEST FAIL §C'); bad++; }
  console.log(bad ? `selftest: ${bad} FAILURES` : 'selftest: 3/3 sections pass (differ logic only — NOT where it points)');
  console.log('⚠️  A passing selftest says nothing about whether the run pointed at the right tree.');
  process.exit(bad ? 1 : 0);
}

// ─────────────────────────────────────────────────────────────────────────────
// run
// ─────────────────────────────────────────────────────────────────────────────
const tree = get('--tree', null);
const label = get('--label', tree ? tree.split('/').pop() : 'run');
const jsonOut = get('--json', null);
if (!tree && !get('--url', null)) {
  console.error('need --tree <dir of a committed gh-pages tree> or --url <base>');
  process.exit(2);
}

const server = tree ? await serveTree(tree) : null;
const baseUrl = server ? server.url : get('--url').replace(/\/$/, '') + '/';
const browser = await chromium.launch({ args: LAUNCH_ARGS });

let failures = 0;
const out = { label, tree, device: DEV, cells: [] };

try {
  for (const route of ROUTES) {
    const cell = await measure(browser, baseUrl, route, null);
    const last = cell.series[cell.series.length - 1];
    const first = cell.series[0];

    // Did any canvas's backing store MOVE during the series? (brief item 4)
    const moved = cell.series.some((s) => JSON.stringify(s.canvases.map((c) => [c.bufW, c.bufH]))
      !== JSON.stringify(first.canvases.map((c) => [c.bufW, c.bufH])));

    // ⚠️ NON-EMPTY FIRST. An on-screen canvas set that is empty means the readback is
    // pointed at nothing, and every assertion below would pass vacuously.
    const onscreen = last.canvases.filter((c) => c.onScreen);
    if (onscreen.length === 0) {
      console.log(`FAIL ${label}/${route.name}: NO ON-SCREEN CANVAS — assertions would be vacuous`);
      failures++;
    }
    if (cell.drift !== 0) {
      console.log(`FAIL ${label}/${route.name}: DRIFT CONTROL NON-ZERO — no number from this cell is usable`);
      console.log(`  before ${cell.driftBefore}`);
      console.log(`  after  ${cell.driftAfter}`);
      failures++;
    }

    console.log(`\n── ${label} / ${route.name} ${'─'.repeat(46)}`);
    console.log(`  drift control: ${cell.drift === 0 ? 'EXACTLY ZERO' : 'NON-ZERO (cell invalid)'}`);
    console.log(`  device: ${DEV.device ?? 'custom'} viewport ${DEV.w}x${DEV.h} / screen ${DEV.screenW}x${DEV.screenH} CSS @ dSF ${DEV.dsf} -> devicePixelRatio ${last.devicePixelRatio} (page reports screen ${last.screenW}x${last.screenH})`);
    for (const c of last.canvases.filter((x) => x.onScreen)) {
      const nw = Math.round(c.cssW * DEV.dsf); const nh = Math.round(c.cssH * DEV.dsf);
      console.log(`  SHORTFALL canvas[${c.i}]: drawn ${c.bufW}x${c.bufH} into a panel of ${nw}x${nh} device px -> ${(c.bufW / nw).toFixed(3)}x linear, ${((c.bufW * c.bufH) / (nw * nh)).toFixed(3)}x the pixels (upscaled ${(nw / c.bufW).toFixed(2)}x to glass)`);
    }
    console.log(`  tier: ${last.tier} (choice=${last.choice} forced=${last.forced} detected=${last.detected})  cap=${last.pixelRatioCap}`);
    console.log(`  signals: coarse=${last.signals?.coarsePointer} touch=${last.signals?.maxTouchPoints} shortEdge=${last.signals?.screenShortEdgeCssPx} mem=${last.signals?.deviceMemoryGb}`);
    console.log(`  post: bloom=${last.bloom} smaa=${last.smaa} msaa=${last.msaaSamples} shadowScale=${last.shadowMapScale} propInk=${last.propInk}`);
    console.log(`  backing store changed during ${SAMPLES} samples: ${moved ? 'YES' : 'no'}`);
    console.log(`  glLog: ${last.glLog.length ? last.glLog.join(', ') : '(empty)'}`);
    for (const c of last.canvases) {
      console.log(`   canvas[${c.i}] ${c.onScreen ? 'ON-SCREEN ' : 'offscreen '}buffer ${c.bufW}x${c.bufH} (${c.mpx} Mpx)  css ${c.cssW}x${c.cssH}  -> ${c.effRatioW}x/${c.effRatioH}x  parent=${String(c.parent).slice(0, 34)}`);
    }
    for (const s of last.stages) {
      console.log(`   stage[${s.i}] ratio ${s.pixelRatio}  buffer ${s.canvasW}x${s.canvasH}  passes ${s.passes}  shadow ${s.shadowMap}  ${s.offscreen ? 'OFFSCREEN ' : ''}${s.disposed ? 'DISPOSED ' : ''}${s.contextLost ? 'CONTEXT-LOST' : ''}`);
    }
    if (cell.errors.length) console.log(`   pageerrors: ${cell.errors.slice(0, 3).join(' | ')}`);
    if (cell.resizeProbe) {
      const r = cell.resizeProbe;
      if (r.vacuous) { console.log(`   RESIZE -> ${r.to}: NO ON-SCREEN CANVAS AFTER ROTATE — vacuous, not a pass`); failures++; }
      else {
        console.log(`   RESIZE -> ${r.to}: ${r.before.join(',')}  =>  ${r.after.join(',')}`);
        console.log(`     buffer followed the new panel size: ${r.consistent ? 'YES (buf = css x ratio)' : 'NO — STALE BACKING STORE'}`);
        if (!r.consistent) failures++;
      }
    }

    out.cells.push({ route: route.name, drift: cell.drift, moved, series: cell.series, errors: cell.errors });

    // ── KNOWN-BAD ARM ────────────────────────────────────────────────────────
    // Force `tier=high`. `min(3, callerCap, 2)` must give 2 where `low` gave 1.25.
    // If the readback returns the same buffer for both, it is measuring a constant and
    // every "no change between deploys" conclusion drawn from it is worthless.
    if (has('--knownbad')) {
      const kb = await measure(browser, baseUrl, route, 'tier=high');
      const kbLast = kb.series[kb.series.length - 1];
      const kbOn = kbLast.canvases.filter((c) => c.onScreen);
      if (kbOn.length === 0 || onscreen.length === 0) {
        console.log(`  KNOWN-BAD FAIL ${route.name}: empty canvas set on one arm — vacuous`);
        failures++;
      } else {
        const a = onscreen.map((c) => `${c.bufW}x${c.bufH}`).join(',');
        const b = kbOn.map((c) => `${c.bufW}x${c.bufH}`).join(',');
        const sawIt = a !== b;
        console.log(`  KNOWN-BAD tier=high: ${b}  vs low: ${a}  -> instrument ${sawIt ? 'SEES the change (valid)' : 'BLIND (INVALID)'}`);
        if (!sawIt) failures++;
        out.cells[out.cells.length - 1].knownBad = { low: a, high: b, sawIt };
      }
    }
  }
  /**
   * ── `--nav`: reach the character screen the way a PLAYER does ────────────────────
   *
   * Every cell above deep-links `?screen=characters`. That is not how Uri gets there, and
   * the difference is not cosmetic: on a deep link the Stage is constructed into a panel
   * that is already laid out, while on a navigation `charStage.attachTo` runs during a
   * curtain fade and a `fa-screen-in` transform, and its `ResizeObserver` has to correct
   * whatever it measured mid-animation. A backing store that is right on a deep link and
   * WRONG after a tap would be invisible to every cell above — and it is a very good fit
   * for *"or something else changed"*, because it would depend on how you arrived.
   *
   * The comparison is against the deep-linked number for the SAME tree, so this is a
   * paired test, not an absolute one.
   */
  if (has('--nav')) {
    const ctx = await browser.newContext({
      viewport: { width: DEV.w, height: DEV.h },
      screen: { width: DEV.screenW, height: DEV.screenH },
      deviceScaleFactor: DEV.dsf, isMobile: true, hasTouch: true,
      ...(DEV.ua ? { userAgent: DEV.ua } : {}),
    });
    const page = await ctx.newPage();
    await page.goto(`${baseUrl}?screen=home`, { waitUntil: 'domcontentloaded', timeout: 90_000 });
    await page.waitForFunction(() => window.__screenReady === true && window.__screen === 'home', null, { timeout: 120_000 });
    await page.waitForTimeout(1500);
    // The roster tab. Located by its VISIBLE LABEL rather than a class, because a class is
    // a build detail and the label is the contract with the player.
    const tab = page.getByText('Foods', { exact: false }).first();
    await tab.click({ timeout: 30_000 });
    await page.waitForFunction(() => window.__screenReady === true && window.__screen === 'characters', null, { timeout: 120_000 });
    await page.waitForTimeout(2500);
    const navRead = await page.evaluate(READBACK);
    await ctx.close();

    const on = navRead.canvases.filter((c) => c.onScreen);
    const deep = out.cells.find((c) => c.route === 'characters');
    const deepOn = deep ? deep.series[deep.series.length - 1].canvases.filter((c) => c.onScreen) : [];
    // NON-EMPTY FIRST, both arms — otherwise "they match" is a statement about nothing.
    if (on.length === 0 || deepOn.length === 0) {
      console.log('\nNAV FAIL: an arm has no on-screen canvas — comparison would be vacuous');
      failures++;
    } else {
      const navStr = on.map((c) => `${c.bufW}x${c.bufH}@${c.cssW}x${c.cssH}`).join(',');
      const deepStr = deepOn.map((c) => `${c.bufW}x${c.bufH}@${c.cssW}x${c.cssH}`).join(',');
      console.log(`\n── NAV (home -> tap "Foods" -> characters) ${'─'.repeat(28)}`);
      console.log(`  navigated : ${navStr}`);
      console.log(`  deep-link : ${deepStr}`);
      console.log(`  ${navStr === deepStr ? 'SAME — arrival path does not change the backing store' : '*** DIFFERENT — the backing store depends on how you arrived ***'}`);
      out.nav = { navStr, deepStr, same: navStr === deepStr };
    }
  }

} finally {
  await browser.close();
  if (server) await server.close();
}


if (jsonOut) {
  await mkdir(dirname(jsonOut), { recursive: true });
  await writeFile(jsonOut, JSON.stringify(out, null, 2));
  console.log(`\nwrote ${jsonOut}`);
}
console.log(failures ? `\n${failures} FAILURES` : '\nall cells valid (drift zero, sets non-empty)');
process.exit(failures ? 1 : 0);
