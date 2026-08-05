#!/usr/bin/env node
/**
 * MENU AUDIO — is there any sound on a menu screen, in a REAL browser?
 *
 * ── The bug this was written for ────────────────────────────────────────────
 *
 * Uri, playing the DEPLOYED build: *"i can't hear on menus."*
 *
 * The only sound a menu screen makes is the theme, "Bounce and Bash" — an
 * `HTMLAudioElement` streamed through `createMediaElementSource` (`src/audio/music.ts`).
 * Its URL was a hand-written string literal, `'/audio/bounce-and-bash.mp3'`. Vite
 * rewrites asset URLs it RESOLVES at build time (imports, `/x` inside HTML and CSS); it
 * does not rewrite string literals inside TypeScript. So under `DEPLOY_BASE=/food-arena/`
 * every other asset shipped as `/food-arena/assets/...` and the track alone shipped as
 * `/audio/...` — a 404 on GitHub Pages, on every load, forever.
 *
 * The failure is completely silent to the game: `el.play()` rejects, `music.ts` catches
 * the rejection on purpose (autoplay refusals must not throw into the render loop), and
 * the same catch swallows "this file does not exist".
 *
 * ── Why 389 offline assertions could not see it ─────────────────────────────
 *
 * Two independent blind spots, and BOTH have to be closed or this class of bug returns:
 *
 *  1. `tools/audio-probe.mjs` renders through `OfflineAudioContext`, where a media
 *     element does not exist at all. Music is skipped by design. No offline assertion
 *     can ever observe the theme.
 *  2. Every live audio instrument here (`musicprobe`, `theme_cycle`, `musicstop`) points
 *     at a server rooted at `/` — the dev server, or a snapshot, or `playtest.mjs`.
 *     **At base `/` the bug does not exist.** The defect is a pure function of the deploy
 *     base, and nothing in this repo had ever measured a based build.
 *
 * So this tool measures the SHIPPED artefact at the base it is actually served from.
 *
 * ── What it measures ────────────────────────────────────────────────────────
 *
 * A `ScriptProcessorNode` on the master bus via `window.__audio.connectTap`, not an
 * analyser poll — `docs/LESSONS.md` §10: polling an analyser from rAF at SwiftShader's
 * frame rate once missed 4 of 5 countdown blips and reported the game as silent. A
 * ScriptProcessor receives every 2048-sample block regardless of frame rate.
 *
 * It boots straight onto `?screen=home` — a MENU route with no title card — because
 * `171c2d2` made the URL name the screen, so a reload now lands there directly. That is
 * also the path with the weakest autoplay story, so it is the one worth measuring.
 * A real `page.mouse.click()` supplies the trusted gesture.
 *
 * ── Modes ───────────────────────────────────────────────────────────────────
 *
 *   node tools/tmp/aud_menu_silence.mjs --url https://uri-onceuponyou.github.io/food-arena/
 *   node tools/tmp/aud_menu_silence.mjs --selftest      # the five-cell matrix, below (~3 min)
 *
 * ── --selftest: the instrument is validated against KNOWN-BAD inputs ────────
 *
 * `docs/LESSONS.md` §13 / `CLAUDE.md` §6: a guard that has not been shown to FAIL on the
 * bug it guards against is not a guard. Nineteen instruments on this project were caught
 * returning confident wrong answers. So `--selftest` freezes the tree ONCE and builds it
 * TWICE from the same frozen source — the base is the only variable — then measures five
 * cells:
 *
 *   | cell            | build base    | served at      | route  | expected |
 *   |-----------------|---------------|----------------|--------|----------|
 *   | ROOT            | `/`           | `/`            | home   | SOUND    |  known-good
 *   | ROOT+MUSIC-OFF  | `/`           | `/`            | home   | SILENT   |  known-bad (control)
 *   | ROOT+404        | `/`           | `/`, mp3 → 404 | home   | SILENT   |  known-bad (control)
 *   | BASED           | `/food-arena/`| `/food-arena/` | home   | SOUND    |  THE GATE — the deploy
 *   | MATCH           | `/`           | `/`            | match  | theme PAUSED |  Uri's §17 answer
 *
 * ROOT proves the instrument can HEAR. The two controls prove it can hear NOTHING — one
 * by disabling music in the app, one by making the network return 404 for the track while
 * the app is untouched, which is the exact failure mode under test. BASED is then the
 * measurement, and it is the whole reason this file exists: **it read SILENT before the
 * fix (rms 0, `networkState 3`, `MediaError 4`, 404) and SOUND after (rms 0.022438, 200),
 * against controls that did not move.** Selftest exits non-zero if any cell lands on the
 * wrong side — including a control, which would mean the instrument itself is lying.
 */

import { chromium } from 'playwright';
import { spawnSync } from 'node:child_process';
import { cpSync, existsSync, mkdirSync, mkdtempSync, readFileSync, rmSync, symlinkSync, statSync } from 'node:fs';
import { tmpdir } from 'node:os';
import { join, resolve, extname, normalize } from 'node:path';
import http from 'node:http';
import net from 'node:net';

const ROOT = resolve(new URL('../..', import.meta.url).pathname);
const argv = process.argv.slice(2);
const get = (k, d) => { const i = argv.indexOf(`--${k}`); return i >= 0 && argv[i + 1] && !argv[i + 1].startsWith('--') ? argv[i + 1] : d; };
const has = (k) => argv.includes(`--${k}`);

/**
 * The floor between "sound" and "silence", stated before any number is acted on
 * (`CLAUDE.md` §10). Silence on this bus is not near zero, it is EXACTLY zero: no voice
 * ran, so no sample was ever written. The theme measures ~0.022 RMS (`music.ts` records
 * 0.0222 vs exactly 0 for the enabled/disabled differential). 1e-4 sits ~220x below the
 * signal and infinitely above the noise, so the discrimination is not marginal and no
 * tolerance is being guessed.
 */
const SOUND_FLOOR = 1e-4;

// ───────────────────────────── static server ─────────────────────────────────
const MIME = {
  '.html': 'text/html; charset=utf-8', '.js': 'text/javascript; charset=utf-8',
  '.mjs': 'text/javascript; charset=utf-8', '.css': 'text/css; charset=utf-8',
  '.json': 'application/json; charset=utf-8', '.mp3': 'audio/mpeg', '.png': 'image/png',
  '.jpg': 'image/jpeg', '.svg': 'image/svg+xml', '.woff2': 'font/woff2', '.ico': 'image/x-icon',
};

function freePort() {
  return new Promise((res, rej) => {
    const s = net.createServer();
    s.listen(0, '127.0.0.1', () => { const p = s.address().port; s.close(() => res(p)); });
    s.on('error', rej);
  });
}

/**
 * Serve `dir` under `base` with an SPA fallback.
 *
 * ⚠️ **Anything outside `base` is a hard 404, and that is the whole point.** The first
 * version of this server fell back to serving `dir` for any path, so a request for
 * `/audio/x.mp3` against a `/food-arena/` build was answered 200 from the build root —
 * and the BASED cell reported **SOUND** on a build whose bundle provably contains the
 * broken literal. The instrument was contradicting a fact already established by
 * `grep` on the deployed artefact. GitHub Pages serves a project site from `/<repo>/`
 * and nothing else exists at the apex, so a host that answers outside its base is not a
 * model of the deploy — it is a model of nothing. This is instrument fault #20 on this
 * project and it was caught only because the deployed build had already been measured
 * directly.
 *
 * `block` is a substring: any request whose path contains it gets a 404. That is the
 * known-bad injector — it reproduces the deploy's missing track WITHOUT touching a byte
 * of the app, so the control and the subject differ in exactly one thing.
 */
async function serve(dir, base, block) {
  const port = await freePort();
  const server = http.createServer((req, res) => {
    let p = decodeURIComponent((req.url || '/').split('?')[0]);
    if (block && p.includes(block)) { res.writeHead(404); res.end('blocked by --selftest control'); return; }
    if (base !== '/') {
      const bare = '/' + base.replace(/^\/|\/$/g, '');
      if (p.startsWith(base)) p = '/' + p.slice(base.length);
      else if (p === bare) p = '/';
      else { res.writeHead(404); res.end(`outside base ${base}`); return; }
    }
    const rel = normalize(p).replace(/^(\.\.[/\\])+/, '');
    let file = join(dir, rel);
    try { if (statSync(file).isDirectory()) file = join(file, 'index.html'); } catch { /* fallthrough */ }
    if (!existsSync(file)) file = join(dir, 'index.html');       // SPA fallback
    try {
      const body = readFileSync(file);
      res.writeHead(200, { 'content-type': MIME[extname(file)] || 'application/octet-stream', 'content-length': body.length });
      res.end(body);
    } catch { res.writeHead(500); res.end('read failed'); }
  });
  await new Promise((r) => server.listen(port, '127.0.0.1', r));
  const url = `http://127.0.0.1:${port}${base}`;
  return { url, close: () => new Promise((r) => server.close(r)) };
}

// ───────────────────────────── the measurement ───────────────────────────────
/**
 * Load a menu route, supply one real gesture, and report what the master bus carries.
 * `killMusic` is the in-app known-bad control: the app is told to disable music, which
 * must read as silence or the instrument is not measuring the theme at all.
 */
async function measure(browser, baseUrl, { killMusic = false, label = '', route = 'home' } = {}) {
  const page = await browser.newPage({ viewport: { width: 1000, height: 640 } });
  const net404 = [];
  const mediaReq = [];
  page.on('response', (r) => {
    const u = r.url();
    if (/\.mp3(\?|$)/.test(u)) mediaReq.push({ url: u, status: r.status() });
    if (r.status() >= 400) net404.push(`${r.status()} ${u.slice(0, 110)}`);
  });
  page.on('requestfailed', (r) => {
    if (/\.mp3(\?|$)/.test(r.url())) mediaReq.push({ url: r.url(), status: `FAILED ${r.failure()?.errorText ?? ''}` });
  });

  // The element is deliberately never appended to the DOM (`music.ts`), so
  // `document.querySelectorAll('audio')` finds nothing even while the theme plays.
  // Capture it at construction instead, BEFORE any page script runs.
  await page.addInitScript(() => {
    const orig = Document.prototype.createElement;
    window.__auditEls = [];
    Document.prototype.createElement = function (tag, ...rest) {
      const el = orig.call(this, tag, ...rest);
      if (String(tag).toLowerCase() === 'audio') window.__auditEls.push(el);
      return el;
    };
  });

  // `?screen=match` is a real deep link into a fight (`main.ts` bootRoute). Used by the
  // MATCH cell to check Uri's other answer — music during matches: OFF — against the
  // element rather than against the source comment that claims it.
  const q = route === 'match' ? 'screen=match&player=hamburger&enemy=donut' : 'screen=home';
  const url = baseUrl + (baseUrl.includes('?') ? '&' : '?') + q;
  await page.goto(url, { waitUntil: 'load', timeout: 60_000 });
  // The shell publishes the mounted route name. Wait on the NAME, never on "some screen".
  await page.waitForFunction((r) => window.__screen === r, route, { timeout: 30_000 }).catch(() => {});

  if (killMusic) {
    await page.evaluate(() => { window.__audio?.engine && (window.__killMusic = true); });
  }

  // One real, trusted gesture — this is what an autoplay policy is waiting for.
  await page.mouse.click(500, 320);
  await page.waitForTimeout(400);

  if (killMusic) {
    // Reach the player through the QA handle's engine module graph. `setEnabled(false)`
    // pauses the element and zeroes music's own gain, so the bus must go to exactly 0.
    await page.evaluate(() => { for (const el of window.__auditEls || []) el.pause(); });
  }

  await page.waitForTimeout(2600);   // stream buffer + fadeIn ramp

  const rms = await page.evaluate((floorArg) => new Promise((res) => {
    const h = window.__audio;
    if (!h) return res({ err: 'no window.__audio' });
    const ctx = h.engine.context;
    if (!ctx) return res({ err: 'no AudioContext', rms: 0, peak: 0 });
    const sp = ctx.createScriptProcessor(2048, 2, 1);
    let peak = 0, sum = 0, n = 0, blocks = 0;
    const done = (extra) => { try { sp.disconnect(); } catch { /* already gone */ }
      res({ rms: +Math.sqrt(sum / Math.max(1, n)).toFixed(6), peak: +peak.toFixed(6), blocks, ...extra }); };
    sp.onaudioprocess = (e) => {
      const d = e.inputBuffer.getChannelData(0);
      for (let i = 0; i < d.length; i++) { const v = Math.abs(d[i]); if (v > peak) peak = v; sum += d[i] * d[i]; n++; }
      if (++blocks >= 60) done({});
    };
    sp.connect(ctx.destination);
    h.connectTap(sp);
    setTimeout(() => done({ timeout: true }), 6000);
  }), SOUND_FLOOR);

  const el = await page.evaluate(() => {
    const a = (window.__auditEls || [])[0];
    const s = window.__audio?.stats?.() ?? null;
    const m = window.__audio?.music ?? null;   // present from the fix onward; null on older trees
    return {
      qaUrl: m?.url ?? null,
      qaError: m?.error ?? null,
      qaPlaying: m?.playing ?? null,
      count: (window.__auditEls || []).length,
      src: a ? a.currentSrc || a.src : null,
      paused: a ? a.paused : null,
      readyState: a ? a.readyState : null,   // 0 = HAVE_NOTHING
      networkState: a ? a.networkState : null, // 3 = NETWORK_NO_SOURCE
      errCode: a && a.error ? a.error.code : null, // 4 = SRC_NOT_SUPPORTED (a 404 lands here)
      errMsg: a && a.error ? String(a.error.message).slice(0, 90) : null,
      currentTime: a ? +a.currentTime.toFixed(2) : null,
      engineState: s?.state ?? null,
    };
  });

  await page.close();
  const heard = (rms.rms ?? 0) > SOUND_FLOOR;
  return { label, url, heard, rms, el, mediaReq, net404: net404.slice(0, 6) };
}

function report(r) {
  console.log(`\n── ${r.label || r.url}`);
  console.log(`   ${r.heard ? 'SOUND  ' : 'SILENT '} rms=${r.rms.rms ?? '-'} peak=${r.rms.peak ?? '-'} blocks=${r.rms.blocks ?? '-'}${r.rms.err ? `  (${r.rms.err})` : ''}`);
  console.log(`   engine=${r.el.engineState}  audioEls=${r.el.count} paused=${r.el.paused} ready=${r.el.readyState} netState=${r.el.networkState} err=${r.el.errCode ?? '-'} t=${r.el.currentTime}`);
  console.log(`   track src: ${r.el.src ?? '(none)'}`);
  // From the fix onward the app can report its OWN failure — the point of `getLoadError()`
  // is that a 404 is otherwise indistinguishable from an autoplay block through every
  // other flag the API exposes.
  if (r.el.qaUrl !== null || r.el.qaError !== null) {
    console.log(`   __audio.music: playing=${r.el.qaPlaying} error=${r.el.qaError ?? 'none'}`);
  }
  for (const m of r.mediaReq) console.log(`   mp3 request: ${m.status}  ${m.url}`);
  for (const f of r.net404) console.log(`   http error : ${f}`);
}

// ───────────────────────────── freeze + build ────────────────────────────────
const INCLUDE = ['src', 'public', 'index.html', 'preview.html', 'vite.config.ts', 'tsconfig.json', 'package.json', 'package-lock.json'];

/**
 * Freeze a tree to build from.
 *
 * ── Why `--from head` exists, and why it is the default here ────────────────
 *
 * This gate has to run a real `vite build`, and a `vite build` compiles the WHOLE tree.
 * In a session with six agents saving files, that means any peer's half-typed line
 * fails this gate on a file the author has never opened. It happened on the first run:
 * `src/ui/screens/home.ts(192,64): error TS1005` — someone else's uncommitted edit,
 * mid-save — took down `tsc`, the snapshot's dev server (500 on that module) and both
 * builds at once, and it presents exactly like your own break. `CLAUDE.md`'s snapshot
 * rule stops peers *contaminating* a measurement; it does nothing about peers
 * *preventing* one, because a snapshot copies the working tree including their edits.
 *
 * So: seed from `git archive HEAD` — a tree that provably built, since `verify-head`
 * gates it — and copy the working-tree paths under test back on top. The build then
 * contains exactly HEAD plus the change being judged, which is also the cleanest
 * possible A/B: nothing else in the frame moved.
 *
 * `--from worktree` restores the naive behaviour for when you genuinely want everyone's
 * live edits in the frame.
 */
function freeze({ from = 'head', overlay = ['src/audio'] } = {}) {
  const dir = mkdtempSync(join(tmpdir(), 'fa-audsilence-'));
  if (from === 'head') {
    const a = spawnSync('sh', ['-c', `git -C ${JSON.stringify(ROOT)} archive HEAD | tar -x -C ${JSON.stringify(dir)}`], { encoding: 'utf8' });
    if (a.status !== 0) throw new Error(`git archive HEAD failed: ${a.stderr}`);
    for (const rel of overlay) {
      const src = join(ROOT, rel);
      if (existsSync(src)) { rmSync(join(dir, rel), { recursive: true, force: true }); cpSync(src, join(dir, rel), { recursive: true }); }
    }
  } else {
    for (const e of INCLUDE) {
      const src = join(ROOT, e);
      if (existsSync(src)) cpSync(src, join(dir, e), { recursive: true });
    }
  }
  // `public/` is tracked, so `git archive` carries the 4 MB theme. Assert it, because a
  // gate about a missing audio file that silently tested a tree with no audio file would
  // be the same class of lie it was built to catch.
  if (!existsSync(join(dir, 'public/audio/bounce-and-bash.mp3'))) {
    throw new Error(`frozen tree has no theme at public/audio/bounce-and-bash.mp3 — this gate would be meaningless`);
  }
  symlinkSync(join(ROOT, 'node_modules'), join(dir, 'node_modules'), 'dir');
  return dir;
}

function build(srcDir, base, outName) {
  const out = join(srcDir, outName);
  const r = spawnSync('npx', ['vite', 'build', '--outDir', outName, '--emptyOutDir'], {
    cwd: srcDir, env: { ...process.env, DEPLOY_BASE: base }, encoding: 'utf8',
  });
  if (r.status !== 0) { console.error(r.stdout, r.stderr); throw new Error(`vite build (base=${base}) failed`); }
  if (!existsSync(join(out, 'index.html'))) throw new Error(`no index.html in ${out}`);
  return out;
}

// ───────────────────────────────── main ──────────────────────────────────────
const browser = await chromium.launch({
  args: ['--use-gl=angle', '--use-angle=swiftshader', '--enable-unsafe-swiftshader', '--enable-webgl', '--ignore-gpu-blocklist'],
});

let exitCode = 0;

if (has('selftest')) {
  console.log('MENU AUDIO — selftest matrix. One frozen tree, two builds, base is the only variable.');
  const from = get('from', 'head');
  const overlay = get('overlay', 'src/audio').split(',').filter(Boolean);
  console.log(`  tree: ${from}${from === 'head' ? ` + working copy of ${overlay.join(', ')}` : ' (working tree — includes every peer\'s live edits)'}`);
  const dir = freeze({ from, overlay });
  let servers = [];
  try {
    const rootOut = build(dir, '/', 'dist-root');
    const basedOut = build(dir, '/food-arena/', 'dist-based');

    const sRoot = await serve(rootOut, '/'); servers.push(sRoot);
    const sRoot404 = await serve(rootOut, '/', 'bounce-and-bash'); servers.push(sRoot404);
    const sBased = await serve(basedOut, '/food-arena/'); servers.push(sBased);

    const cells = [
      { r: await measure(browser, sRoot.url, { label: 'ROOT            base=/            (known-good, expect SOUND)' }), expect: true, control: true },
      { r: await measure(browser, sRoot.url, { killMusic: true, label: 'ROOT+MUSIC-OFF  base=/            (known-bad, expect SILENT)' }), expect: false, control: true },
      { r: await measure(browser, sRoot404.url, { label: 'ROOT+404        base=/ mp3→404   (known-bad, expect SILENT)' }), expect: false, control: true },
      { r: await measure(browser, sBased.url, { label: 'BASED           base=/food-arena/ (the deploy — THE GATE)' }), expect: true, control: false },
    ];
    for (const c of cells) report(c.r);

    /**
     * ── MUSIC DURING MATCHES: OFF ───────────────────────────────────────────
     *
     * Uri's other answer in the same message. It is already the shipped behaviour —
     * `ui/screens/shell.ts` mount() fades the theme out on the way into a match — but
     * "the comment says so" is not a measurement, and this pass exists precisely
     * because a comment stood in for one. So it is asserted on the ELEMENT.
     *
     * Deliberately NOT a bus-RMS check: combat SFX share the master bus, so a match is
     * loud whether or not music plays and RMS cannot separate them. The element's
     * `paused` flag can, and `fadeOut()` is what sets it (0.6 s ramp, then pause).
     *
     * ⚠️ This assertion only became meaningful today. Before the base fix the element
     * was paused during a match for the WRONG REASON on the deployed build — it had no
     * source at all — so a green result here would have been true and worthless. It is
     * therefore run on the ROOT build, where the track provably loads and playback
     * provably starts (t≈5.5 s in the ROOT cell above), which makes "paused" a
     * statement about the handoff rather than about a 404.
     */
    const m = await measure(browser, sRoot.url, { route: 'match', label: 'MATCH           base=/ ?screen=match (music must be OFF in a fight)' });
    console.log(`\n── ${m.label}`);
    console.log(`   theme playing=${m.el.qaPlaying} paused=${m.el.paused} t=${m.el.currentTime} err=${m.el.qaError ?? 'none'}  (bus rms=${m.rms.rms}, combat SFX share it)`);
    const matchOk = m.el.qaPlaying === false;
    if (!matchOk) exitCode = 1;

    console.log('\n── verdict');
    let controlsOk = true;
    for (const c of cells) {
      const ok = c.r.heard === c.expect;
      if (!ok) exitCode = 1;
      if (c.control && !ok) controlsOk = false;
      console.log(`  ${ok ? ' ok  ' : 'FAIL '} ${(c.control ? 'control' : 'GATE   ')} ${c.r.label.split(' ')[0].padEnd(15)} expected ${c.expect ? 'SOUND' : 'SILENT'}, got ${c.r.heard ? 'SOUND' : 'SILENT'}`);
    }
    console.log(`  ${matchOk ? ' ok  ' : 'FAIL '} GATE    MATCH           theme paused inside a fight, got playing=${m.el.qaPlaying}`);
    if (!controlsOk) console.log('\n  THE INSTRUMENT IS NOT TRUSTWORTHY — a control landed on the wrong side. Do not act on the BASED row.');
    else if (exitCode) console.log('\n  Controls are correct, so the BASED failure is REAL: the deployed build has no menu audio.');
    else console.log("\n  5/5. Controls prove this can hear sound AND silence; BASED proves the deploy is audible; MATCH proves the fight stays music-free.");
  } finally {
    for (const s of servers) await s.close();
    rmSync(dir, { recursive: true, force: true });
  }
} else {
  const url = get('url', process.env.PREVIEW_BASE || 'https://uri-onceuponyou.github.io/food-arena/');
  const r = await measure(browser, url.endsWith('/') ? url : url + '/', { label: url, killMusic: has('kill-music') });
  report(r);
  console.log(`\n  ---->  menus are ${r.heard ? 'AUDIBLE' : 'SILENT'} at ${url}`);
  if (!r.heard) exitCode = 1;
}

await browser.close();
process.exit(exitCode);
