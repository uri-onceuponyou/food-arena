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
 * THE TRAP. Several modules build their markup and their CSS as template literals. A
 * stray backtick inside one — writing `.fa-screen` in a CSS comment, or naming a
 * module in an HTML comment — silently terminates the string and turns the whole file
 * into a syntax error. That presents as a Vite 500 and a blank page for EVERY agent in
 * the repo, and as nothing at all in a screenshot. It has now cost five round-trips.
 *
 * WHY THIS IS NO LONGER A REGEX. The first version matched `const CSS = ` + literal
 * and scanned its lines for a backtick. That guard was standing right next to the
 * hole it did not cover: the very next backtick to break `hud.ts` went into its
 * `root.innerHTML = ` markup literal instead. Widening the regex to `innerHTML` then
 * immediately produced FALSE positives, because `characterSelect.ts` legitimately
 * nests template literals inside `${...}` interpolations — and a lint that cries wolf
 * on valid code gets ignored, which is worse than the hole.
 *
 * Both failures are the same mistake: pattern-matching a language instead of parsing
 * it. So it parses. `ts.createSourceFile` yields `parseDiagnostics` directly, which is
 * exactly and only "would this file compile", with no notion of what a backtick is —
 * so it catches every variant of the trap AND every other syntax error, and cannot
 * false-positive on valid nesting. Measured: 88 files in ~95 ms, which is why it can
 * cover all of `src/` rather than a hand-maintained list that would go stale the first
 * time someone adds a module.
 *
 * `tsc` also catches this, but only if it is run BEFORE the file is saved — by the
 * time anyone runs it the dev server is already down. This runs first, before the
 * browser even launches. Still ONE `record()` call, so the total check count does not
 * move.
 */
async function lintCssLiterals() {
  const { default: ts } = await import('typescript');
  const roots = ['src'];
  const paths = [];
  const walk = async (dir) => {
    for (const ent of await readdir(dir, { withFileTypes: true })) {
      const p = `${dir}/${ent.name}`;
      if (ent.isDirectory()) await walk(p);
      else if (ent.name.endsWith('.ts')) paths.push(p);
    }
  };
  for (const r of roots) await walk(r);

  const offenders = [];
  for (const p of paths) {
    const src = await readFile(p, 'utf8').catch(() => null);
    if (src === null) continue;
    const sf = ts.createSourceFile(p, src, ts.ScriptTarget.Latest, false, ts.ScriptKind.TS);
    for (const d of sf.parseDiagnostics ?? []) {
      const { line } = sf.getLineAndCharacterOfPosition(d.start ?? 0);
      offenders.push(`${p}:${line + 1} ${ts.flattenDiagnosticMessageText(d.messageText, ' ')}`);
    }
  }
  // A guard that silently matches nothing is worse than no guard — that is how the
  // innerHTML hole stayed open. Assert it actually looked at something.
  const ok = offenders.length === 0 && paths.length >= 20;
  record('static', '-', 'no-backtick-in-css', ok,
    offenders.length ? offenders.slice(0, 3).join(' | ') : `${paths.length} modules parsed clean`);
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

/**
 * ── Economy acceptance, added with the trophy road ──────────────────────────
 *
 * The model itself is asserted 172 ways under plain Node in
 * `src/game/economy/economy.test.mjs`. What CANNOT be asserted there — and is
 * therefore asserted here, in a real browser — is that the screen is wired to the
 * model at all, and that the three states the road can be in each produce honest UI:
 *
 *  1. CLAIM. A player with unclaimed trophies sees claimable nodes, tapping one pops
 *     the reveal card, and the balance actually moves. This is the check that would
 *     have caught "the button renders but nothing happens", which is the single
 *     defect both menu critics punished.
 *  2. OPEN. A held chest opens and pays out; an empty inventory draws NO open button
 *     (a control that cannot work must not be drawn).
 *  3. STORE. Every real-money product is DISABLED and the sheet says purchases are
 *     unavailable. This is the one place a "coming soon" claim can be verified rather
 *     than trusted, and it is deliberately asserted in both directions: the buttons
 *     must be disabled AND the copy must say so.
 *  4. ODDS. The published drop rates render, and the 0.01% row is not rounded to 0% —
 *     which is a compliance statement, not a formatting preference.
 *
 * State is seeded through localStorage before boot rather than played into, because
 * reaching 200 trophies through the UI is 14 real matches.
 */
async function auditEconomy(browser) {
  const page = await browser.newPage({ viewport: { width: 1280, height: 720 } });
  const errs = [];
  page.on('pageerror', (e) => errs.push(String(e)));
  page.on('console', (m) => { if (m.type() === 'error') errs.push(m.text()); });

  // A player at 200 trophies with two chests in hand and nothing claimed.
  //
  // The `if (!existing)` guard is load-bearing, not defensive: `addInitScript` runs on
  // EVERY navigation, so an unguarded seed would silently restore this blob on the
  // reload below and the persistence check would pass no matter how broken saving was.
  await page.addInitScript(() => {
    if (localStorage.getItem('food-arena.profile.v1')) return;
    localStorage.setItem('food-arena.profile.v1', JSON.stringify({
      name: 'QA', wins: 9, losses: 3, xp: 400, selected: 'hamburger',
      economy: {
        trophies: 200, bestTrophies: 200, coins: 1000, gems: 40,
        containers: { chest: 2, hamburgerBox: 0, pineappleBox: 0, redBox: 0, fireBox: 0 },
        claimed: [], unlocked: ['hamburger'], winsTowardChest: 1,
        lastMatch: null, seed: 987654, rolls: 0,
      },
    }));
  });

  let step = 'boot';
  try {
    await page.goto(`${BASE}/?screen=trophies`, { waitUntil: 'networkidle', timeout: 45000 });
    await page.waitForFunction('window.__screen === "trophies"', null, { timeout: 45000 });
    await page.waitForTimeout(300);

    step = 'seeded state renders';
    const seeded = await page.evaluate(() => ({
      trophies: document.querySelector('[data-el="trophies"]')?.textContent,
      coins: document.querySelector('[data-el="coins"]')?.textContent,
      claimable: document.querySelectorAll('.tr-node.is-claimable').length,
      nodes: document.querySelectorAll('.tr-node').length,
      pins: document.querySelectorAll('.tr-pin').length,
      opens: document.querySelectorAll('[data-open]').length,
    }));
    record('economy', 'trophies', 'model-drives-screen', seeded.trophies === '200', `showed "${seeded.trophies}"`);
    record('economy', 'trophies', 'road-renders-every-node', seeded.nodes >= 30, `${seeded.nodes} nodes`);
    record('economy', 'trophies', 'exactly-one-you-are-here-pin', seeded.pins === 1, `${seeded.pins} pins`);
    record('economy', 'trophies', 'reached-nodes-are-claimable', seeded.claimable >= 5, `${seeded.claimable} claimable`);
    record('economy', 'trophies', 'held-chests-draw-an-open-button', seeded.opens === 1, `${seeded.opens} open buttons`);

    step = 'claim a milestone';
    const coinsBefore = await page.evaluate(() =>
      Number((document.querySelector('[data-el="coins"]')?.textContent ?? '0').replace(/,/g, '')));
    await page.click('.tr-node.is-claimable');
    await page.waitForSelector('.tr-sheet.is-open .tr-reveal', { timeout: 5000 });
    record('economy', 'trophies', 'claim-opens-the-reveal', true, '');
    await page.click('.tr-sheet .fa-btn--primary', { force: true }); // force: the CTA pulses forever, so it is never 'stable'
    await page.waitForTimeout(150);
    const afterClaim = await page.evaluate(() => ({
      open: document.querySelector('.tr-sheet')?.classList.contains('is-open'),
      claimable: document.querySelectorAll('.tr-node.is-claimable').length,
      claimed: document.querySelectorAll('.tr-node.is-claimed').length,
      coins: Number((document.querySelector('[data-el="coins"]')?.textContent ?? '0').replace(/,/g, '')),
    }));
    record('economy', 'trophies', 'reveal-closes', afterClaim.open === false);
    record('economy', 'trophies', 'claimed-node-changes-state', afterClaim.claimed >= 1
      && afterClaim.claimable === seeded.claimable - 1,
      `${afterClaim.claimed} claimed / ${afterClaim.claimable} left`);

    step = 'claim the rest';
    await page.click('[data-el="claimall"]', { force: true });
    await page.waitForSelector('.tr-sheet.is-open .tr-reveal', { timeout: 5000 });
    await page.click('.tr-sheet .fa-btn--primary', { force: true }); // force: the CTA pulses forever, so it is never 'stable'
    await page.waitForTimeout(150);
    const afterAll = await page.evaluate(() => ({
      claimable: document.querySelectorAll('.tr-node.is-claimable').length,
      coins: Number((document.querySelector('[data-el="coins"]')?.textContent ?? '0').replace(/,/g, '')),
      claimAllVisible: (document.querySelector('[data-el="claimall"]')?.getBoundingClientRect().height ?? 0) > 0,
    }));
    record('economy', 'trophies', 'claim-all-clears-the-road', afterAll.claimable === 0,
      `${afterAll.claimable} left`);
    record('economy', 'trophies', 'claiming-moves-the-balance', afterAll.coins > coinsBefore,
      `${coinsBefore} -> ${afterAll.coins}`);
    // The one control that must NOT linger once it has nothing to do.
    record('economy', 'trophies', 'claim-all-hides-when-empty', afterAll.claimAllVisible === false);

    step = 'open a chest';
    // Claiming the road handed over more chests, so the count is read rather than
    // assumed — asserting a literal here would be asserting the milestone table.
    const chestsHeld = await page.evaluate(() =>
      Number(document.querySelector('.tr-open-count')?.textContent ?? '0'));
    await page.click('[data-open="chest"]');
    await page.waitForSelector('.tr-sheet.is-open .tr-reveal', { timeout: 5000 });
    await page.click('.tr-sheet .fa-btn--primary', { force: true }); // force: the CTA pulses forever, so it is never 'stable'
    await page.waitForTimeout(150);
    const afterOpen = await page.evaluate(() => ({
      count: Number(document.querySelector('.tr-open-count')?.textContent ?? '0'),
      coins: Number((document.querySelector('[data-el="coins"]')?.textContent ?? '0').replace(/,/g, '')),
    }));
    record('economy', 'trophies', 'opening-consumes-exactly-one-chest',
      chestsHeld > 0 && afterOpen.count === chestsHeld - 1, `${chestsHeld} -> ${afterOpen.count}`);
    record('economy', 'trophies', 'opening-pays-out', afterOpen.coins >= afterAll.coins,
      `${afterAll.coins} -> ${afterOpen.coins}`);

    step = 'empty inventory draws no open button';
    // Drain whatever is held, of any kind — the road hands out boxes as well as
    // chests, so a chest-only loop leaves the inventory non-empty and tests nothing.
    for (let guard = 0; guard < 20; guard++) {
      const remaining = await page.evaluate(() => document.querySelectorAll('[data-open]').length);
      if (remaining === 0) break;
      await page.click('[data-open]');
      await page.waitForSelector('.tr-sheet.is-open', { timeout: 5000 });
      await page.click('.tr-sheet .fa-btn--primary', { force: true });
      await page.waitForTimeout(110);
    }
    const empty = await page.evaluate(() => ({
      opens: document.querySelectorAll('[data-open]').length,
      hint: document.querySelector('.tr-inv-empty')?.textContent?.trim() ?? '',
    }));
    record('economy', 'trophies', 'no-open-button-with-nothing-to-open', empty.opens === 0,
      `${empty.opens} still drawn`);
    record('economy', 'trophies', 'empty-inventory-explains-itself', /win/i.test(empty.hint), empty.hint);

    step = 'the gem store is honest';
    await page.click('[data-el="storebtn"]');
    await page.waitForSelector('.tr-sheet.is-open .tr-skus', { timeout: 5000 });
    const store = await page.evaluate(() => {
      const buys = [...document.querySelectorAll('.tr-sku-buy')];
      return {
        products: buys.length,
        enabled: buys.filter((b) => !b.disabled).length,
        notice: document.querySelector('.tr-soon')?.textContent?.trim() ?? '',
        prices: buys.filter((b) => /\$/.test(b.textContent)).length,
      };
    });
    record('economy', 'store', 'products-are-listed', store.products >= 4, `${store.products} SKUs`);
    record('economy', 'store', 'NO-purchase-button-is-live', store.enabled === 0,
      `${store.enabled} enabled`);
    record('economy', 'store', 'unavailability-is-stated-in-words',
      /not available|coming soon/i.test(store.notice), store.notice.slice(0, 80));
    record('economy', 'store', 'prices-are-still-shown', store.prices === store.products);
    await page.click('.tr-sheet [data-el="close"]');
    await page.waitForTimeout(120);

    step = 'drop rates are published';
    await page.click('[data-el="oddsbtn"]');
    await page.waitForSelector('.tr-sheet.is-open .tr-odds-list', { timeout: 5000 });
    const odds = await page.evaluate(() => {
      const pct = [...document.querySelectorAll('.tr-odds-pct')].map((n) => n.textContent.trim());
      return {
        blocks: document.querySelectorAll('.tr-odds-block').length,
        rows: pct.length,
        zeroRows: pct.filter((p) => p === '0%').length,
        hasTinyRow: pct.includes('0.01%'),
      };
    });
    record('economy', 'odds', 'every-container-publishes-its-table', odds.blocks === 5, `${odds.blocks} blocks`);
    record('economy', 'odds', 'rows-render', odds.rows >= 15, `${odds.rows} rows`);
    // A real 0.01% chance published as "0%" is a false statement about a paid
    // randomised item, not a rounding choice.
    record('economy', 'odds', 'no-real-chance-is-rounded-to-zero', odds.zeroRows === 0, `${odds.zeroRows} rows read 0%`);
    record('economy', 'odds', 'sub-tenth-percent-rows-survive', odds.hasTinyRow === true);
    await page.click('.tr-sheet [data-el="close"]');

    step = 'progress survives a reload';
    await page.reload({ waitUntil: 'networkidle' });
    await page.waitForFunction('window.__screen === "trophies"', null, { timeout: 30000 });
    await page.waitForTimeout(250);
    const persisted = await page.evaluate(() => ({
      claimable: document.querySelectorAll('.tr-node.is-claimable').length,
      claimed: document.querySelectorAll('.tr-node.is-claimed').length,
      opens: document.querySelectorAll('[data-open]').length,
    }));
    record('economy', 'trophies', 'claims-persist-across-a-reload',
      persisted.claimable === 0 && persisted.claimed >= 5,
      `${persisted.claimed} claimed, ${persisted.claimable} claimable`);
    record('economy', 'trophies', 'spent-chests-stay-spent', persisted.opens === 0);

    record('economy', '-', 'economy-flow', true, 'claim / open / store / odds / reload');
  } catch (err) {
    record('economy', '-', 'economy-flow', false, `failed at "${step}": ${String(err).split('\n')[0]}`);
  }
  record('economy', '-', 'no-console-errors', errs.length === 0, errs.slice(0, 3).join(' | '));
  await page.close();
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

      for (const screen of ['home', 'characters', 'trophies']) {
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

      step = 'home -> trophy road';
      await page.click('[data-go="trophies"]', { force: true });
      await page.waitForFunction('window.__screen === "trophies" && window.__screenReady === true', null, { timeout: 20000 });

      step = 'no stale celebration for a match that never finished';
      {
        // The flow QUITS from the pause menu, so no result was ever banked. The
        // road must therefore show no trophy delta — a screen that congratulates
        // you for a match you abandoned is worse than one that says nothing, and
        // the `lastMatch.seen` flag is the only thing standing between them.
        const state = await page.evaluate(() => ({
          delta: document.querySelector('[data-el="delta"]')?.textContent ?? '',
          trophies: document.querySelector('[data-el="trophies"]')?.textContent ?? '',
        }));
        record('flow', 'trophies', 'no-delta-for-an-abandoned-match', state.delta === '',
          `delta = "${state.delta}"`);
        record('flow', 'trophies', 'trophy-count-renders', /^[\d,]+$/.test(state.trophies),
          `trophies = "${state.trophies}"`);
      }

      step = 'trophies -> home';
      await page.click('[data-el="back"]', { force: true });
      await page.waitForFunction('window.__screen === "home" && window.__screenReady === true', null, { timeout: 20000 });

      record('flow', '-', 'round-trip', true, 'home -> characters -> match -> home -> trophies -> home');
    } catch (err) {
      record('flow', '-', 'round-trip', false, `failed at "${step}": ${String(err).split('\n')[0]}`);
    }
    record('flow', '-', 'no-console-errors', errs.length === 0, errs.slice(0, 3).join(' | '));
    await page.close();
  }

  await auditEconomy(browser);

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
