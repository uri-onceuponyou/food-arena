#!/usr/bin/env node
/**
 * qv4_res — DID THE RESOLUTION PATH CHANGE BETWEEN THE TWO BUILDS URI ACTUALLY PLAYED?
 *
 * ── The question, and why it is not the one already asked ──────────────────────
 * A peer probe (angle B) established that `charStage.ts`'s `maxPixelRatio: 2` is INERT
 * on every shipped tier, and measured `characters` and `match` both at pixelRatio 1.25
 * on the LIVE tree. That is a statement about ONE tree at ONE instant. Uri's report is
 * a statement about a CHANGE:
 *
 *   previous verdict  "feels ALOT better than before. smooth."
 *   this verdict      "slight regression is VFX quality ... character screen seems
 *                      like the resolution is slightly lower, or something else changed"
 *
 * A long-standing state cannot explain a change. So this tool measures the resolution
 * path on **both deployed bundles** — the one he praised and the one he is complaining
 * about — at his device profile, and asks whether a single number moved.
 *
 * ── Why deployed bundles and not the source tree ──────────────────────────────
 * `AGENT-BRIEF.md` §4.8: measure the artefact you SHIP, on the path you ship it to.
 * `origin/gh-pages` is a single orphan commit (force-pushed each deploy), so the ONLY
 * copy of the build Uri praised is the local `gh-pages` branch, which still carries 4.
 * Both are extracted with `git archive` — legal here per `CLAUDE.md` rule 8, because
 * nothing inside a served bundle shells out to `git`; the ban is on `git archive` as a
 * TREE TO RUN THE GATE BATTERY IN, which this is not.
 *
 * ── What makes a number here believable ───────────────────────────────────────
 *
 *  1. **DRIFT CONTROL (`CLAUDE.md` rule 4).** Each cell reads the page back TWICE with
 *     nothing changed in between and requires the two to be byte-identical on every
 *     numeric field. The eighteenth "it isn't there" rendered plausibly and WRONGLY;
 *     "is it the SAME?" is asked before any difference is believed. A drifting cell is
 *     printed as DRIFT and its delta is refused, never rounded away.
 *
 *  2. **KNOWN-BAD ARM (`CLAUDE.md` rule 6).** `--knownbad` re-runs the identical cell
 *     with `&tier=high`, which MUST move the character screen's pixel ratio 1.25 -> 2
 *     and the backing store with it. A readback that returns the same numbers on both
 *     tiers is measuring a constant, and every number it produced is worthless. The arm
 *     asserts; it does not merely print.
 *
 *  3. **NON-EMPTY FIRST.** `[].every()` is `true`, and that vacuity has fired at least
 *     seven times in this repo. Every filtered set here is asserted non-empty BEFORE it
 *     is asserted over — on-screen canvases, live stages, and the field set of the A/B
 *     diff. Zero rows is a FAILURE, not a silent pass.
 *
 *  4. **INDEPENDENT OF SOURCE.** Nothing is computed from `quality.ts`. The tier caps
 *     are re-stated as literals so agreement with the table is evidence rather than
 *     tautology, and every ratio is read off the live renderer and the live canvas.
 *
 * ── What this tool does NOT claim ─────────────────────────────────────────────
 * SwiftShader is not an A17 and Chromium is not WebKit. A drawing-buffer size is an
 * integer that is engine-independent and therefore quotable; how the frame LOOKS, how
 * fast it runs, and iOS's own memory behaviour are NOT measured here and must not be
 * inferred from this output.
 *
 *   node tools/tmp/qv4_res.mjs --old <dir> --new <dir>
 *   node tools/tmp/qv4_res.mjs --old <dir> --new <dir> --knownbad
 *   node tools/tmp/qv4_res.mjs --selftest      # validates the differ + the vacuity guard
 *
 * Exit 1 on any drift, any empty assertion set, or a failed known-bad arm.
 */
import { chromium, devices } from 'playwright';
import { createServer } from 'node:http';
import { readFile, stat, writeFile, mkdir } from 'node:fs/promises';
import { join, extname, dirname, resolve } from 'node:path';

const A = process.argv.slice(2);
const get = (k, d) => (A.includes(k) ? A[A.indexOf(k) + 1] : d);
const has = (k) => A.includes(k);

/** Restated as literals ON PURPOSE — a probe that imports the table it checks proves
 *  only that the code agrees with itself. */
const EXPECTED_CAP = { high: 2, medium: 1.5, low: 1.25 };

const BASE_PATH = get('--basepath', '/food-arena/');
const SAMPLES = Number(get('--samples', 6));
const SAMPLE_MS = Number(get('--samplems', 150));

/**
 * Uri's device. `screen` (393x852) and `viewport` (393x659) are DIFFERENT numbers and
 * feed different things: `quality.ts:qualitySignals` reads `screen` for
 * `screenShortEdgeCssPx` (i.e. which TIER), while the viewport decides how many CSS
 * pixels the portrait panel is laid out into. Playwright's own descriptor carries both.
 * `isMobile`+`hasTouch` are load-bearing: `detectTier` gates on `pointer: coarse` and
 * `maxTouchPoints`, and without them Chromium reports a desktop and detection returns
 * `high` — measuring a tier his phone never selects.
 */
const D = devices['iPhone 15 Pro'];
const DEV = {
  w: Number(get('--w', D.viewport.width)),
  h: Number(get('--h', D.viewport.height)),
  screenW: Number(get('--screenw', D.screen.width)),
  screenH: Number(get('--screenh', D.screen.height)),
  dsf: Number(get('--dsf', D.deviceScaleFactor)),
  ua: D.userAgent,
};

const MIME = {
  '.html': 'text/html', '.js': 'text/javascript', '.mjs': 'text/javascript',
  '.css': 'text/css', '.json': 'application/json', '.webmanifest': 'application/manifest+json',
  '.png': 'image/png', '.woff2': 'font/woff2', '.mp3': 'audio/mpeg', '.txt': 'text/plain',
  '.svg': 'image/svg+xml', '.ico': 'image/x-icon', '.jpg': 'image/jpeg',
};

/** In-process static server. It cannot outlive this run and cannot be caught by a
 *  peer's pattern kill, which is `CLAUDE.md` 8b satisfied structurally. */
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
  return {
    url: `http://127.0.0.1:${srv.address().port}${BASE_PATH}`,
    close: () => new Promise((r) => srv.close(r)),
  };
}

/**
 * Read the whole resolution path off the LIVE page.
 *
 * Canvases are enumerated from the DOM rather than trusted from `window.__stage`: that
 * getter has a recorded history of pointing at a DEAD Stage (a thumbnail generator's
 * corpse reported as the trophy road). Whatever is on screen is in the DOM list. The
 * `__stages` registry is reported ALONGSIDE so the two can be compared rather than one
 * assumed. Canvas identity is its position + parent class, which survives minification;
 * variable names do not.
 */
const READBACK = () => {
  const canvases = [...document.querySelectorAll('canvas')].map((c, i) => {
    const r = c.getBoundingClientRect();
    const cssW = Math.round(r.width * 1000) / 1000;
    const cssH = Math.round(r.height * 1000) / 1000;
    return {
      i,
      parent: c.parentElement ? (c.parentElement.className || c.parentElement.tagName) : null,
      onScreen: r.width > 1 && r.height > 1 && r.right > 0 && r.bottom > 0
        && r.left < window.innerWidth && r.top < window.innerHeight,
      bufW: c.width, bufH: c.height, cssW, cssH,
      // The number this tool exists for: backing-store pixels per CSS pixel.
      effRatio: cssW > 0 ? Math.round((c.width / cssW) * 10000) / 10000 : null,
      mpx: Math.round((c.width * c.height) / 1e3) / 1e3,
    };
  });
  const stages = (window.__stages ?? []).map((s, i) => {
    try {
      return {
        i,
        offscreen: !!s.offscreen, disposed: !!s.disposed, contextLost: !!s.contextLost,
        pixelRatio: s.renderer ? s.renderer.getPixelRatio() : null,
        canvasW: s.canvas ? s.canvas.width : null,
        canvasH: s.canvas ? s.canvas.height : null,
        passes: s.composer ? s.composer.passes.length : 0,
        shadowMap: s.lighting?.key?.shadow?.mapSize?.x ?? null,
      };
    } catch (e) { return { i, error: String(e) }; }
  });
  const q = window.__quality ?? {};
  return {
    screen: window.__screen ?? null,
    devicePixelRatio: window.devicePixelRatio,
    innerW: window.innerWidth, innerH: window.innerHeight,
    screenW: window.screen?.width ?? null, screenH: window.screen?.height ?? null,
    renderTier: window.__renderTier ?? null,
    tier: q.tier ?? null, choice: q.choice ?? null, forced: q.forced ?? null,
    detected: q.detected ?? null,
    pixelRatioCap: q.profile?.pixelRatioCap ?? null,
    bloom: q.profile?.bloom ?? null, smaa: q.profile?.smaa ?? null,
    msaaSamples: q.profile?.msaaSamples ?? null,
    shadowMapScale: q.profile?.shadowMapScale ?? null,
    propInk: q.profile?.propInk ?? null,
    signals: q.signals ?? null,
    glLog: (window.__glLog ?? []).map((e) => `${e.type}@${e.size}${e.offscreen ? ' (off)' : ''}`),
    canvases, stages,
  };
};

/** The fields that MUST be bit-identical across two reads of one unchanged page, and
 *  across two builds if the resolution path did not move. */
function key(m) {
  return JSON.stringify({
    tier: m.tier, detected: m.detected, cap: m.pixelRatioCap, dpr: m.devicePixelRatio,
    inner: [m.innerW, m.innerH], screen: [m.screenW, m.screenH],
    bloom: m.bloom, smaa: m.smaa, msaa: m.msaaSamples,
    shadowMapScale: m.shadowMapScale, propInk: m.propInk,
    canvases: m.canvases.map((c) => [c.parent, c.onScreen, c.bufW, c.bufH, c.cssW, c.cssH]),
    stages: m.stages.map((s) => [s.offscreen, s.disposed, s.pixelRatio, s.canvasW, s.canvasH,
      s.passes, s.shadowMap]),
  });
}

const ROUTES = {
  home: { q: 'screen=home', ready: () => window.__screenReady === true && window.__screen === 'home' },
  characters: { q: 'screen=characters', ready: () => window.__screenReady === true && window.__screen === 'characters' },
  match: { q: 'player=hamburger&enemy=donut', ready: () => window.__gameReady === true },
};

const LAUNCH_ARGS = ['--use-gl=angle', '--use-angle=swiftshader', '--enable-unsafe-swiftshader',
  '--enable-webgl', '--ignore-gpu-blocklist', '--disable-gpu-sandbox'];

async function measure(browser, baseUrl, routeName, extraQuery) {
  const route = ROUTES[routeName];
  const ctx = await browser.newContext({
    viewport: { width: DEV.w, height: DEV.h },
    screen: { width: DEV.screenW, height: DEV.screenH },
    deviceScaleFactor: DEV.dsf, isMobile: true, hasTouch: true, userAgent: DEV.ua,
  });
  const page = await ctx.newPage();
  const errors = [];
  page.on('pageerror', (e) => errors.push(String(e)));
  const url = `${baseUrl}?${route.q}${extraQuery ? `&${extraQuery}` : ''}`;
  await page.goto(url, { waitUntil: 'domcontentloaded', timeout: 90_000 });
  await page.waitForFunction(route.ready, undefined, { timeout: 120_000 });

  // `__screenReady` IS NOT A PAINT (AGENT-BRIEF §3, measured opacity 0.000 when it
  // flips) and the ResizeObserver fires after the mount, so a single read cannot tell
  // "small" from "stale, then corrected". Sample a series and settle on the last.
  let last = null;
  for (let i = 0; i < SAMPLES; i++) {
    last = await page.evaluate(READBACK);
    if (i < SAMPLES - 1) await page.waitForTimeout(SAMPLE_MS);
  }
  // THE DRIFT CONTROL: one more read, immediately, nothing changed in between.
  const again = await page.evaluate(READBACK);
  const drift = key(last) === key(again) ? 0 : 1;
  await ctx.close();
  return { ...last, drift, errors, url };
}

// ─────────────────────────────────────────────────────────────────────────────
// selftest — validates the DIFFER and the VACUITY GUARD. It does NOT validate
// where the tool is pointed (`CLAUDE.md` rule 6: `--selftest` never can).
// ─────────────────────────────────────────────────────────────────────────────
function selftest() {
  const fails = [];
  const ok = (name, cond) => { if (!cond) fails.push(name); console.log(`  ${cond ? 'ok  ' : 'FAIL'} ${name}`); };
  const base = {
    tier: 'low', detected: 'low', pixelRatioCap: 1.25, devicePixelRatio: 3,
    innerW: 393, innerH: 659, screenW: 393, screenH: 852,
    bloom: false, smaa: false, msaaSamples: 4, shadowMapScale: 0.5, propInk: false,
    canvases: [{ parent: 'stage', onScreen: true, bufW: 491, bufH: 824, cssW: 393, cssH: 659 }],
    stages: [{ offscreen: false, disposed: false, pixelRatio: 1.25, canvasW: 491, canvasH: 824, passes: 3, shadowMap: 1024 }],
  };
  const clone = (o) => JSON.parse(JSON.stringify(o));

  console.log('§A  differ');
  ok('A1 identical inputs -> equal keys', key(base) === key(clone(base)));
  const b1 = clone(base); b1.stages[0].pixelRatio = 2;
  ok('A2 pixelRatio move is CAUGHT', key(base) !== key(b1));
  const b2 = clone(base); b2.canvases[0].bufW = 786;
  ok('A3 backing-store move is CAUGHT', key(base) !== key(b2));
  const b3 = clone(base); b3.pixelRatioCap = 2;
  ok('A4 tier cap move is CAUGHT', key(base) !== key(b3));
  const b4 = clone(base); b4.bloom = true;
  ok('A5 a VFX-tier knob (bloom) move is CAUGHT', key(base) !== key(b4));
  const b5 = clone(base); b5.shadowMapScale = 1;
  ok('A6 shadowMapScale move is CAUGHT', key(base) !== key(b5));

  console.log('§B  vacuity — the set is asserted NON-EMPTY before it is asserted over');
  const empty = clone(base); empty.canvases = []; empty.stages = [];
  ok('B1 empty canvases FAILS the guard (does not silently pass)', gateNonEmpty(empty).length > 0);
  ok('B2 populated canvases PASSES the guard', gateNonEmpty(base).length === 0);
  // The trap this guards: two builds that both render NOTHING have identical keys.
  ok('B3 two EMPTY reads have equal keys — i.e. a bare key() diff WOULD go vacuous',
    key(empty) === key(clone(empty)));

  console.log('§C  known-bad arithmetic, restated independently of quality.ts');
  const eff = (dpr, caller, cap) => Math.min(dpr, caller, cap);
  ok('C1 caller 2 is INERT on low  (min(3,2,1.25) === min(3,Inf,1.25))',
    eff(3, 2, EXPECTED_CAP.low) === eff(3, Infinity, EXPECTED_CAP.low));
  ok('C2 caller 2 is INERT on medium', eff(3, 2, EXPECTED_CAP.medium) === eff(3, Infinity, EXPECTED_CAP.medium));
  ok('C3 caller 2 is INERT on high', eff(3, 2, EXPECTED_CAP.high) === eff(3, Infinity, EXPECTED_CAP.high));
  ok('C4 but a caller ceiling CAN bind — thumbs.ts passes 1, and 1 < 1.25',
    eff(3, 1, EXPECTED_CAP.low) !== eff(3, Infinity, EXPECTED_CAP.low));
  ok('C5 forcing tier=high MUST move low\'s ratio (the known-bad arm is not a no-op)',
    eff(3, 2, EXPECTED_CAP.low) !== eff(3, 2, EXPECTED_CAP.high));

  console.log(fails.length === 0 ? '\nSELFTEST PASS' : `\nSELFTEST FAIL: ${fails.join(', ')}`);
  process.exit(fails.length === 0 ? 0 : 1);
}

/** Returns a list of vacuity violations. Empty list == the sets are safe to assert over. */
function gateNonEmpty(m) {
  const bad = [];
  const onScreen = (m.canvases ?? []).filter((c) => c.onScreen);
  if (onScreen.length === 0) bad.push('no ON-SCREEN canvas — every canvas assertion would be vacuous');
  const live = (m.stages ?? []).filter((s) => !s.disposed);
  if (live.length === 0) bad.push('no LIVE stage — every stage assertion would be vacuous');
  return bad;
}

function fmt(m, label) {
  const on = m.canvases.filter((c) => c.onScreen);
  const live = m.stages.filter((s) => !s.disposed);
  console.log(`  ${label.padEnd(22)} tier=${m.tier}(detected ${m.detected}) cap=${m.pixelRatioCap} `
    + `dpr=${m.devicePixelRatio} inner=${m.innerW}x${m.innerH} screen=${m.screenW}x${m.screenH}`);
  console.log(`  ${''.padEnd(22)} bloom=${m.bloom} smaa=${m.smaa} msaa=${m.msaaSamples} `
    + `shadowScale=${m.shadowMapScale} propInk=${m.propInk} gl=[${m.glLog.join(',')}]`);
  for (const c of on) {
    console.log(`  ${''.padEnd(22)} canvas[${c.i}] parent=${String(c.parent).slice(0, 28).padEnd(28)} `
      + `buf=${c.bufW}x${c.bufH} css=${c.cssW}x${c.cssH} eff=${c.effRatio} ${c.mpx}Mpx`);
  }
  for (const s of live) {
    console.log(`  ${''.padEnd(22)} stage[${s.i}]${s.offscreen ? ' OFFSCREEN' : ''} `
      + `pixelRatio=${s.pixelRatio} buf=${s.canvasW}x${s.canvasH} passes=${s.passes} shadow=${s.shadowMap}`);
  }
  if (m.errors?.length) console.log(`  ${''.padEnd(22)} PAGE ERRORS: ${m.errors.join(' | ')}`);
}

async function main() {
  if (has('--selftest')) return selftest();
  const oldDir = get('--old', null);
  const newDir = get('--new', null);
  if (!oldDir || !newDir) { console.error('need --old <dir> --new <dir>'); process.exit(2); }
  const routes = get('--routes', 'home,characters,match').split(',').map((s) => s.trim());
  for (const r of routes) if (!ROUTES[r]) { console.error(`unknown route ${r}`); process.exit(2); }

  const sOld = await serveTree(oldDir);
  const sNew = await serveTree(newDir);
  const browser = await chromium.launch({ args: LAUNCH_ARGS });
  let failed = 0;
  const out = { device: DEV, oldDir, newDir, cells: [] };

  try {
    console.log(`device: viewport ${DEV.w}x${DEV.h}  screen ${DEV.screenW}x${DEV.screenH}  dsf ${DEV.dsf}`);
    console.log(`OLD = ${oldDir}\nNEW = ${newDir}\n`);
    for (const r of routes) {
      console.log(`── route ${r} ─────────────────────────────────────────────`);
      const mo = await measure(browser, sOld.url, r);
      const mn = await measure(browser, sNew.url, r);
      fmt(mo, `OLD ${r}`);
      fmt(mn, `NEW ${r}`);

      // NON-EMPTY FIRST, both arms, before anything is compared.
      const vac = [...gateNonEmpty(mo).map((s) => `OLD: ${s}`), ...gateNonEmpty(mn).map((s) => `NEW: ${s}`)];
      if (vac.length) { console.log(`  VACUOUS: ${vac.join(' ; ')}`); failed++; }
      if (mo.drift || mn.drift) {
        console.log(`  DRIFT: old=${mo.drift} new=${mn.drift} — this cell's delta is REFUSED`);
        failed++;
      } else {
        const same = key(mo) === key(mn);
        console.log(`  >> RESOLUTION PATH ${same ? 'IDENTICAL (delta EXACTLY zero)' : 'MOVED'} between the two deployed builds`);
        if (!same) {
          const a = JSON.parse(key(mo)); const b = JSON.parse(key(mn));
          for (const k of Object.keys(a)) {
            if (JSON.stringify(a[k]) !== JSON.stringify(b[k])) {
              console.log(`     ${k}: ${JSON.stringify(a[k])}  ->  ${JSON.stringify(b[k])}`);
            }
          }
        }
      }
      out.cells.push({ route: r, old: mo, new: mn, identical: key(mo) === key(mn) });
      console.log('');
    }

    if (has('--knownbad')) {
      console.log('── KNOWN-BAD ARM: force tier=high, the ratio MUST move ──────────');
      const kbRoute = routes.includes('characters') ? 'characters' : routes[0];
      const bad = await measure(browser, sNew.url, kbRoute, 'tier=high');
      fmt(bad, `NEW ${kbRoute} tier=high`);
      const ref = out.cells.find((c) => c.route === kbRoute).new;
      const refLive = ref.stages.filter((s) => !s.disposed && !s.offscreen);
      const badLive = bad.stages.filter((s) => !s.disposed && !s.offscreen);
      if (refLive.length === 0 || badLive.length === 0) {
        console.log('  KNOWN-BAD VACUOUS: no on-screen live stage on one arm'); failed++;
      } else if (bad.pixelRatioCap === ref.pixelRatioCap
        || refLive[0].pixelRatio === badLive[0].pixelRatio) {
        console.log(`  KNOWN-BAD FAILED: cap ${ref.pixelRatioCap}->${bad.pixelRatioCap}, `
          + `ratio ${refLive[0].pixelRatio}->${badLive[0].pixelRatio} — the readback is measuring a CONSTANT`);
        failed++;
      } else {
        console.log(`  KNOWN-BAD PASS: cap ${ref.pixelRatioCap}->${bad.pixelRatioCap}, `
          + `ratio ${refLive[0].pixelRatio}->${badLive[0].pixelRatio}, `
          + `buf ${refLive[0].canvasW}x${refLive[0].canvasH}->${badLive[0].canvasW}x${badLive[0].canvasH} `
          + `— the instrument CAN see a resolution change`);
      }
      out.knownbad = bad;
    }
  } finally {
    await browser.close();
    await sOld.close();
    await sNew.close();
  }

  const jsonOut = get('--json', null);
  if (jsonOut) { await mkdir(dirname(jsonOut), { recursive: true }); await writeFile(jsonOut, JSON.stringify(out, null, 1)); }
  process.exit(failed ? 1 : 0);
}

main().catch((e) => { console.error(e); process.exit(1); });
