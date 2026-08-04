#!/usr/bin/env node
/**
 * Acceptance test for the screen layer (`src/ui/screens/`).
 *
 * Defined BEFORE the critic loop so "better" is a measurement, not a mood. Five
 * checks, all of which must pass on every supported viewport:
 *
 *  1. NO PAGE SCROLL. `document.documentElement` must not overflow in either axis.
 *     Anything that can overflow has to scroll inside its own box.
 *  2. TOUCH TARGETS. Every enabled control is >= 44x44 CSS px.
 *  3. SAFE AREAS. With simulated notch insets injected on <html>, no control's
 *     bounding rect enters the inset band on any edge.
 *  4. HERO IN FRAME. The 3D portrait's bounding box projects fully inside [0,1] on
 *     both axes — no cropped characters.
 *  5. FLOW. boot -> home -> character select -> match (window.__gameReady) ->
 *     back to home, with zero console errors along the way.
 *  6. INPUT PASSTHROUGH. This one exists because of a shipped regression: the
 *     full-viewport `#screens` layer defaulted to `pointer-events: auto` and became
 *     the hit target for every pointer event, so the game canvas received ZERO
 *     mousemove and ZERO mousedown during a match. That silently disabled firing
 *     and froze the fighter's aim-facing, and it is invisible to tsc, to the sim
 *     tests and to screenshots — only a human trying to play finds it. So it is
 *     asserted here with real (not synthetic) mouse events routed through the
 *     browser's own hit testing, in BOTH directions: the canvas must receive events
 *     during a match, and the menus' own buttons must still receive theirs.
 *
 * Usage: node tools/tmp/menu_accept.mjs [--flow-only]
 */

import { chromium } from 'playwright';
import { readdir, readFile } from 'node:fs/promises';

/**
 * Static guard, run before the browser starts.
 *
 * Every screen module ends in `const CSS = ` + a template literal. A stray backtick
 * inside that literal (writing `.fa-screen` in a CSS comment, say) silently
 * terminates the string and turns the whole module into a syntax error — which
 * presents as a Vite 500 and a blank page, not as anything a screenshot would show.
 * It has cost FOUR round-trips now, so it is a check.
 *
 * Coverage is every module in the project that ships CSS this way, not just the
 * screens directory: `src/ui/hud.ts` and `src/game/pointerLock.ts` have exactly the
 * same shape and exactly the same failure mode, and a 500 in either takes the dev
 * server down for every other agent in the repo. Deliberately still ONE `record()`
 * call so the total check count does not move.
 */
async function lintCssLiterals() {
  const dir = 'src/ui/screens';
  const paths = (await readdir(dir))
    .filter((f) => f.endsWith('.ts'))
    .map((f) => `${dir}/${f}`)
    .concat(['src/ui/hud.ts', 'src/game/pointerLock.ts']);
  const offenders = [];
  for (const p of paths) {
    const src = await readFile(p, 'utf8').catch(() => null);
    if (src === null) continue;
    const m = src.match(/const CSS = `([\s\S]*?)\n`;/);
    if (!m) continue;
    for (const line of m[1].split('\n')) {
      if (line.includes('`')) offenders.push(`${p}: ${line.trim().slice(0, 70)}`);
    }
  }
  record('static', '-', 'no-backtick-in-css', offenders.length === 0, offenders.slice(0, 3).join(' | '));
}

const BASE = process.env.PREVIEW_BASE ?? 'http://localhost:5173';
const LAUNCH_ARGS = [
  '--use-gl=angle', '--use-angle=swiftshader', '--enable-unsafe-swiftshader',
  '--enable-webgl', '--ignore-gpu-blocklist', '--disable-gpu-sandbox',
];

const VIEWPORTS = [
  { name: 'desktop-16:9', width: 1600, height: 900 },
  { name: 'laptop-16:10', width: 1280, height: 800 },
  { name: 'tablet-4:3', width: 1024, height: 768 },
  { name: 'phone-19.5:9', width: 844, height: 390 },
  { name: 'ultrawide-21:9', width: 2560, height: 1080 },
];

/** Simulated notch. Landscape iPhone: 44/44 on the long edges, 21 for the home bar. */
const SAFE = { t: 0, r: 44, b: 21, l: 44 };

const MIN_TAP = 44;

const results = [];
let failures = 0;

function record(vp, screen, check, ok, detail = '') {
  results.push({ vp, screen, check, ok, detail });
  if (!ok) failures++;
}

/** Every check that can run against a mounted menu screen. */
async function auditScreen(page, vp, screen, { safe }) {
  const data = await page.evaluate(({ MIN_TAP, safe }) => {
    const de = document.documentElement;
    const vw = de.clientWidth;
    const vh = de.clientHeight;

    const visible = (el) => {
      const r = el.getBoundingClientRect();
      return r.width > 0 && r.height > 0;
    };

    // Controls the player is expected to be able to hit.
    const controls = [...document.querySelectorAll(
      '.fa-root button:not([disabled]), .fa-root .fa-menuitem:not([disabled])',
    )].filter(visible);
    // Scroll viewports must themselves be inside the safe area.
    const scrollers = [...document.querySelectorAll('.fa-root .fa-scroll')].filter(visible);

    const small = controls
      .map((el) => ({ el, r: el.getBoundingClientRect() }))
      .filter(({ r }) => r.width < MIN_TAP - 0.5 || r.height < MIN_TAP - 0.5)
      .map(({ el, r }) => `${el.className.split(' ')[0]}[${el.textContent.trim().slice(0, 14)}] ${Math.round(r.width)}x${Math.round(r.height)}`);

    // Elements inside a scrolling region are clipped by it, so their own rect can
    // legitimately sit outside the viewport. The thing that has to respect the safe
    // area is the SCROLLER, not its scrolled-away children.
    const outside = controls
      .filter((el) => !el.closest('.fa-scroll'))
      .map((el) => ({ el, r: el.getBoundingClientRect() }))
      .filter(({ r }) =>
        r.left < safe.l - 1 || r.top < safe.t - 1 ||
        r.right > vw - safe.r + 1 || r.bottom > vh - safe.b + 1)
      .map(({ el, r }) => `${el.className.split(' ')[0]}[${el.textContent.trim().slice(0, 14)}] L${Math.round(r.left)} T${Math.round(r.top)} R${Math.round(vw - r.right)} B${Math.round(vh - r.bottom)}`)
      .concat(scrollers
        .map((el) => ({ el, r: el.getBoundingClientRect() }))
        .filter(({ r }) =>
          r.left < safe.l - 1 || r.top < safe.t - 1 ||
          r.right > vw - safe.r + 1 || r.bottom > vh - safe.b + 1)
        .map(({ el, r }) => `scroller.${el.className.split(' ').pop()} L${Math.round(r.left)} T${Math.round(r.top)} R${Math.round(vw - r.right)} B${Math.round(vh - r.bottom)}`));

    return {
      scrollW: de.scrollWidth, clientW: vw,
      scrollH: de.scrollHeight, clientH: vh,
      controlCount: controls.length,
      small, outside,
      hero: window.__charStage?.() ?? null,
    };
  }, { MIN_TAP, safe });

  record(vp.name, screen, 'no-page-scroll',
    data.scrollW <= data.clientW + 1 && data.scrollH <= data.clientH + 1,
    `${data.scrollW}x${data.scrollH} vs ${data.clientW}x${data.clientH}`);

  record(vp.name, screen, 'tap-targets>=44',
    data.small.length === 0, data.small.slice(0, 4).join(' | '));

  record(vp.name, screen, 'inside-safe-area',
    data.outside.length === 0, data.outside.slice(0, 4).join(' | '));

  const h = data.hero;
  if (h && h.feet) {
    const pts = [h.feet, h.crown, h.left, h.right];
    const inFrame = pts.every((p) => p && p.x >= -0.005 && p.x <= 1.005 && p.y >= -0.005 && p.y <= 1.005);
    record(vp.name, screen, 'hero-in-frame', inFrame && h.cameraOk === true,
      `fill=${h.fill} feet=${JSON.stringify(h.feet)} crown=${JSON.stringify(h.crown)} L=${JSON.stringify(h.left)} R=${JSON.stringify(h.right)}`);
  }

  record(vp.name, screen, 'controls-present', data.controlCount >= 3, `${data.controlCount} controls`);
}

async function run() {
  const flowOnly = process.argv.includes('--flow-only');
  await lintCssLiterals();
  const browser = await chromium.launch({ args: LAUNCH_ARGS });

  if (!flowOnly) {
    for (const vp of VIEWPORTS) {
      const page = await browser.newPage({ viewport: { width: vp.width, height: vp.height } });
      const errs = [];
      page.on('pageerror', (e) => errs.push(String(e)));
      page.on('console', (m) => { if (m.type() === 'error') errs.push(m.text()); });

      for (const screen of ['home', 'characters']) {
        await page.goto(`${BASE}/?screen=${screen}`, { waitUntil: 'networkidle', timeout: 45000 });
        await page.waitForFunction('window.__previewReady === true', null, { timeout: 45000 });
        await page.waitForTimeout(250);

        // Pass 1: real (zero) insets.
        await page.evaluate(() => {
          for (const k of ['t', 'r', 'b', 'l']) document.documentElement.style.removeProperty(`--fa-safe-${k}`);
        });
        await page.waitForTimeout(80);
        await auditScreen(page, vp, screen, { safe: { t: 0, r: 0, b: 0, l: 0 } });

        // Pass 2: simulated notch. `--fa-safe-*` are declared on :root precisely so
        // this is testable without a device.
        await page.evaluate((safe) => {
          const s = document.documentElement.style;
          s.setProperty('--fa-safe-t', `${safe.t}px`);
          s.setProperty('--fa-safe-r', `${safe.r}px`);
          s.setProperty('--fa-safe-b', `${safe.b}px`);
          s.setProperty('--fa-safe-l', `${safe.l}px`);
        }, SAFE);
        await page.waitForTimeout(160);
        await auditScreen(page, vp, `${screen}+notch`, { safe: SAFE });
      }

      record(vp.name, '-', 'no-console-errors', errs.length === 0, errs.slice(0, 3).join(' | '));
      await page.close();
    }
  }

  // ── Flow: home -> characters -> match -> home ────────────────────────────
  {
    const page = await browser.newPage({ viewport: { width: 1280, height: 720 } });
    const errs = [];
    page.on('pageerror', (e) => errs.push(String(e)));
    page.on('console', (m) => { if (m.type() === 'error') errs.push(m.text()); });
    let step = 'boot';
    try {
      await page.goto(`${BASE}/`, { waitUntil: 'networkidle', timeout: 45000 });
      await page.waitForFunction('window.__screen === "home"', null, { timeout: 45000 });

      step = 'home->characters';
      await page.click('[data-el="start"]', { force: true });
      await page.waitForFunction('window.__screen === "characters" && window.__screenReady === true', null, { timeout: 20000 });

      step = 'pick a different fighter';
      await page.click('.chars-card[data-char="lollipop"]');
      await page.waitForTimeout(200);

      step = 'characters->match';
      await page.click('[data-el="fight"]', { force: true });
      await page.waitForFunction('window.__screen === "match"', null, { timeout: 20000 });
      await page.waitForFunction('window.__gameReady === true', null, { timeout: 60000 });

      step = 'input reaches the canvas';
      {
        const box = await page.evaluate(() => {
          const c = document.querySelector('#game canvas');
          const r = c.getBoundingClientRect();
          window.__probeMove = 0;
          window.__probeDown = 0;
          c.addEventListener('mousemove', () => { window.__probeMove++; }, true);
          c.addEventListener('mousedown', () => { window.__probeDown++; }, true);
          return { x: r.left + r.width / 2, y: r.top + r.height / 2 };
        });
        // Real mouse events: Playwright dispatches these through the browser's hit
        // testing, so an overlay that steals them WILL make this fail — which a
        // synthetic dispatchEvent on the canvas would not.
        await page.mouse.move(box.x - 60, box.y - 40);
        await page.mouse.move(box.x + 40, box.y + 30);
        await page.mouse.down();
        await page.mouse.up();
        const hit = await page.evaluate(() => ({
          move: window.__probeMove, down: window.__probeDown,
          topAtCentre: document.elementFromPoint(
            Math.round(window.innerWidth / 2), Math.round(window.innerHeight / 2))?.tagName ?? '?',
        }));
        record('flow', 'match', 'canvas-gets-mousemove', hit.move > 0, `${hit.move} events`);
        record('flow', 'match', 'canvas-gets-mousedown', hit.down > 0, `${hit.down} events`);
        record('flow', 'match', 'canvas-is-top-at-centre', hit.topAtCentre === 'CANVAS', hit.topAtCentre);
      }

      step = 'pause';
      await page.click('[data-el="pause"]');
      await page.waitForSelector('.match-sheet.is-open', { timeout: 5000 });
      await page.click('[data-el="resume"]', { force: true });

      step = 'match->home';
      await page.click('[data-el="pause"]');
      await page.click('[data-el="quit"]');
      await page.waitForFunction('window.__screen === "home" && window.__screenReady === true', null, { timeout: 20000 });

      step = 'equipped fighter persisted';
      const equipped = await page.evaluate(() =>
        document.querySelector('[data-el="heroname"]')?.textContent ?? '');
      record('flow', '-', 'selection-persists', equipped === 'Lollipop', `home hero = "${equipped}"`);

      step = 'menu buttons still receive their own clicks';
      {
        const top = await page.evaluate(() => {
          const btn = document.querySelector('[data-el="start"]');
          const r = btn.getBoundingClientRect();
          const el = document.elementFromPoint(Math.round(r.left + r.width / 2), Math.round(r.top + r.height / 2));
          return el === btn || btn.contains(el);
        });
        record('flow', 'home', 'cta-is-hit-target', top, 'elementFromPoint over START GAME');
      }

      record('flow', '-', 'round-trip', true, 'home -> characters -> match -> home');
    } catch (err) {
      record('flow', '-', 'round-trip', false, `failed at "${step}": ${String(err).split('\n')[0]}`);
    }
    record('flow', '-', 'no-console-errors', errs.length === 0, errs.slice(0, 3).join(' | '));
    await page.close();
  }

  await browser.close();

  const pad = (s, n) => String(s).padEnd(n);
  console.log('');
  for (const r of results) {
    if (r.ok && process.argv.includes('--quiet')) continue;
    console.log(`${r.ok ? 'PASS' : 'FAIL'}  ${pad(r.vp, 16)} ${pad(r.screen, 18)} ${pad(r.check, 20)} ${r.detail}`);
  }
  console.log(`\n${results.length - failures}/${results.length} checks passed`);
  process.exit(failures > 0 ? 1 : 0);
}

run().catch((e) => { console.error(e); process.exit(1); });
