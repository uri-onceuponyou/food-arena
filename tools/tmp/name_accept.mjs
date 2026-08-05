#!/usr/bin/env node
/**
 * Acceptance test for the PLAYER NAME — the product's only free-text field.
 *
 * `docs/STATE.md` carried "Player name — `PlayerProfile` has no setter" under NOT
 * BUILT. There is one now, and a setter that takes arbitrary typing needs its own
 * battery for the same reason `input_accept.mjs` does: everything it can break is
 * invisible to `tsc`, to the 173 economy assertions and to a screenshot.
 *
 * Deliberately a separate file rather than four more lines in `menu_accept.mjs`. That
 * suite is the commit gate for several agents at once and is being edited by one of
 * them right now; adding to it would change its count under everybody. This runs on
 * its own and reports its own number.
 *
 * ── What it asserts, and why each one ───────────────────────────────────────
 *  1. IT IS A SETTER AT ALL. Typing moves `localStorage`, the lobby badge and a
 *     reload — read back off storage and off the badge, never off the field that was
 *     typed into.
 *  2. THE CAP HOLDS ON BOTH ROUTES. `maxlength` stops a typist; it does NOT stop a
 *     programmatic `.value` write, a paste on some engines, or a hand-edited blob in
 *     `localStorage`. `profile.ts` therefore sanitises on the way IN and on the way
 *     OUT of storage, and both paths are driven here.
 *  3. IT CANNOT BECOME MARKUP. A tag typed into the field must render as the literal
 *     characters. Asserted structurally — the badge must contain ZERO element
 *     children and its `textContent` must equal what was typed — rather than by
 *     eyeballing the screenshot, because a successful injection looks like nothing.
 *  4. IT CANNOT REVERSE THE UI. U+202E RIGHT-TO-LEFT OVERRIDE is the display attack
 *     that survives escaping: it re-orders everything drawn after it. It has to be
 *     stripped, not encoded.
 *  5. IT CANNOT BREAK THE LAYOUT. A full-length name at the narrowest supported
 *     phone must leave the lobby's top bar inside the viewport — measured off
 *     `getBoundingClientRect()`, never `scrollWidth`, because `.fa-root` is
 *     `overflow: hidden` and reports a clean width while a child is amputated
 *     (`menu_accept_portrait.mjs`, and it is the reason that file exists).
 *  6. RESET STILL WIPES IT. The name lives in `food-arena.profile.v1`, which the
 *     danger zone prefix-clears, so a reset must return the badge to "Chef".
 *
 *   node tools/tmp/with_snapshot.mjs -- node tools/tmp/name_accept.mjs
 *   PREVIEW_BASE=<url> node tools/tmp/name_accept.mjs
 */

import { chromium } from 'playwright';

const BASE = process.env.PREVIEW_BASE ?? 'http://localhost:5173';
const LAUNCH_ARGS = [
  '--use-gl=angle', '--use-angle=swiftshader', '--enable-unsafe-swiftshader',
  '--enable-webgl', '--ignore-gpu-blocklist', '--disable-gpu-sandbox',
];

/** Must match `NAME_MAX` in `src/ui/screens/profile.ts`. */
const NAME_MAX = 16;
const DEFAULT_NAME = 'Chef';

const results = [];
let failures = 0;
function record(group, check, ok, detail = '') {
  results.push({ group, check, ok, detail });
  if (!ok) failures++;
}

const storedName = (page) => page.evaluate(() => {
  const raw = localStorage.getItem('food-arena.profile.v1');
  return raw ? JSON.parse(raw).name : null;
});
const badgeText = (page) => page.evaluate(() => {
  const chip = document.querySelector('.fa-home [data-el="name"]');
  return chip ? chip.textContent : null;
});

async function openSettings(page) {
  await page.goto(`${BASE}/?screen=settings&pointerLock=0`, { waitUntil: 'networkidle', timeout: 60000 });
  await page.waitForFunction('window.__screen === "settings" && window.__screenReady === true', null, { timeout: 60000 });
}
async function openHome(page) {
  await page.goto(`${BASE}/?screen=home&pointerLock=0`, { waitUntil: 'networkidle', timeout: 60000 });
  await page.waitForFunction('window.__screen === "home" && window.__screenReady === true', null, { timeout: 60000 });
}

/** Set the field the way a script or a paste would — bypassing `maxlength` — and let
 *  the screen's own handlers see it. This is the path `maxlength` does not cover. */
async function forceValue(page, value) {
  await page.evaluate((v) => {
    const el = document.querySelector('[data-el="name"]');
    el.value = v;
    el.dispatchEvent(new Event('input', { bubbles: true }));
    el.dispatchEvent(new Event('change', { bubbles: true }));
  }, value);
  await page.waitForTimeout(80);
}

const browser = await chromium.launch({ args: LAUNCH_ARGS });
const errs = [];

// ── 1. The happy path, typed ─────────────────────────────────────────────────
{
  const page = await browser.newPage({ viewport: { width: 1280, height: 720 } });
  page.on('pageerror', (e) => errs.push(String(e)));
  page.on('console', (m) => { if (m.type() === 'error') errs.push(m.text()); });

  await openSettings(page);
  const field = await page.$('[data-el="name"]');
  record('basics', 'the-field-exists', !!field);
  record('basics', 'the-field-shows-the-current-name',
    (await page.inputValue('[data-el="name"]')) === DEFAULT_NAME,
    `showed "${await page.inputValue('[data-el="name"]')}"`);
  record('basics', 'the-counter-renders',
    (await page.textContent('[data-el="namecount"]')) === `${DEFAULT_NAME.length}/${NAME_MAX}`,
    `${await page.textContent('[data-el="namecount"]')}`);

  // Real keystrokes, not a value write.
  await page.click('[data-el="name"]');
  await page.keyboard.press('ControlOrMeta+A');
  await page.locator('[data-el="name"]').pressSequentially('Uri', { delay: 12 });
  await page.waitForTimeout(80);
  record('basics', 'typing-writes-through-to-storage', (await storedName(page)) === 'Uri',
    `stored "${await storedName(page)}"`);
  record('basics', 'the-counter-follows',
    (await page.textContent('[data-el="namecount"]')) === `3/${NAME_MAX}`,
    `${await page.textContent('[data-el="namecount"]')}`);

  await page.keyboard.press('Enter');
  await page.waitForTimeout(80);
  record('basics', 'enter-settles-the-field',
    (await page.inputValue('[data-el="name"]')) === 'Uri'
    && (await page.evaluate(() => document.activeElement?.getAttribute('data-el') !== 'name')),
    'blurred and canonicalised');

  await openHome(page);
  record('basics', 'the-lobby-badge-shows-it', (await badgeText(page)) === 'Uri',
    `badge "${await badgeText(page)}"`);

  await page.reload({ waitUntil: 'networkidle' });
  await page.waitForFunction('window.__screen === "home" && window.__screenReady === true', null, { timeout: 60000 });
  record('basics', 'it-survives-a-reload', (await badgeText(page)) === 'Uri',
    `badge "${await badgeText(page)}"`);

  // ── 2. The cap, both routes ────────────────────────────────────────────────
  await openSettings(page);
  await page.click('[data-el="name"]');
  await page.keyboard.press('ControlOrMeta+A');
  await page.locator('[data-el="name"]').pressSequentially('ABCDEFGHIJKLMNOPQRSTUVWXYZ', { delay: 6 });
  await page.waitForTimeout(80);
  const typed = await storedName(page);
  record('cap', 'typing-past-the-cap-stores-at-most-16', (typed ?? '').length === NAME_MAX,
    `stored ${(typed ?? '').length} chars: "${typed}"`);

  await forceValue(page, 'x'.repeat(120));
  const forced = await storedName(page);
  record('cap', 'a-programmatic-write-past-the-cap-is-also-capped',
    (forced ?? '').length === NAME_MAX, `stored ${(forced ?? '').length} chars`);

  // ── 3/4. Hostile strings ───────────────────────────────────────────────────
  const HOSTILE = [
    { name: 'markup', raw: '<img src=x onerror=1>', want: '<img src=x onerr' },
    // A TAB, not a newline. `<input type="text">`'s value setter runs the HTML "strip
    // newlines" algorithm, so a CR/LF can never be IN the field — measured, after this
    // case was first written with a `\n` and reported "ab c". The newline path is real
    // but arrives through storage, and is asserted there instead.
    { name: 'tab', raw: 'a\tb\tc', want: 'a b c' },
    { name: 'rtl-override', raw: 'ab‮cd', want: 'abcd' },
    { name: 'zero-width', raw: 'a​b', want: 'ab' },
    { name: 'padding', raw: '                ', want: DEFAULT_NAME },
    { name: 'leading-trailing', raw: '   Bob   ', want: 'Bob' },
    { name: 'inner-runs', raw: 'A     B', want: 'A B' },
  ];
  for (const h of HOSTILE) {
    // eslint-disable-next-line no-await-in-loop
    await forceValue(page, h.raw);
    // eslint-disable-next-line no-await-in-loop
    const got = await storedName(page);
    record('sanitise', `${h.name}-is-normalised`, got === h.want,
      `stored ${JSON.stringify(got)} want ${JSON.stringify(h.want)}`);
  }

  // The structural version of "it cannot become markup".
  await forceValue(page, '<b>x</b>');
  await openHome(page);
  const inject = await page.evaluate(() => {
    const chip = document.querySelector('.fa-home [data-el="name"]');
    return {
      text: chip?.textContent ?? null,
      children: chip?.children.length ?? -1,
      strayB: document.querySelectorAll('.fa-home [data-el="name"] b').length,
    };
  });
  record('sanitise', 'a-tag-renders-as-characters',
    inject.text === '<b>x</b>' && inject.children === 0 && inject.strayB === 0,
    `text ${JSON.stringify(inject.text)} children=${inject.children} <b>=${inject.strayB}`);

  await page.close();
}

// ── 5. Layout, at the narrowest supported phone ─────────────────────────────
{
  const LONG = 'W'.repeat(NAME_MAX);
  for (const vp of [{ n: 'portrait-360x800', w: 360, h: 800 }, { n: 'phone-land-844x390', w: 844, h: 390 }]) {
    // eslint-disable-next-line no-await-in-loop
    const page = await browser.newPage({ viewport: { width: vp.w, height: vp.h } });
    page.on('pageerror', (e) => errs.push(String(e)));
    // eslint-disable-next-line no-await-in-loop
    await page.addInitScript((name) => {
      try {
        localStorage.setItem('food-arena.profile.v1', JSON.stringify({
          name, wins: 3, losses: 1, xp: 300, selected: 'hamburger',
          economy: {
            trophies: 120, bestTrophies: 120, coins: 500, gems: 10,
            containers: { chest: 0, hamburgerBox: 0, pineappleBox: 0, redBox: 0, fireBox: 0 },
            claimed: [], unlocked: ['hamburger'], winsTowardChest: 1,
            lastMatch: null, seed: 4242, rolls: 0,
          },
        }));
      } catch { /* private mode */ }
    }, LONG);
    // eslint-disable-next-line no-await-in-loop
    await openHome(page);
    // eslint-disable-next-line no-await-in-loop
    const geo = await page.evaluate(() => {
      const de = document.documentElement;
      const chip = document.querySelector('.fa-home [data-el="name"]')?.closest('.fa-chip');
      const bar = document.querySelector('.fa-home .fa-topbar');
      const r = (n) => (n ? n.getBoundingClientRect() : null);
      const c = r(chip); const b = r(bar);
      return {
        vw: de.clientWidth,
        chip: c ? { l: c.left, rr: c.right, w: c.width } : null,
        bar: b ? { l: b.left, rr: b.right, w: b.width } : null,
        text: document.querySelector('.fa-home [data-el="name"]')?.textContent ?? null,
      };
    });
    record('layout', `${vp.n}-badge-holds-a-full-length-name`,
      !!geo.chip && geo.chip.l >= -1 && geo.chip.rr <= geo.vw + 1,
      `chip ${Math.round(geo.chip?.w ?? -1)}px at ${Math.round(geo.chip?.l ?? -1)}..${Math.round(geo.chip?.rr ?? -1)} in ${geo.vw}`);
    record('layout', `${vp.n}-topbar-stays-in-the-viewport`,
      !!geo.bar && geo.bar.l >= -1 && geo.bar.rr <= geo.vw + 1,
      `bar ${Math.round(geo.bar?.w ?? -1)}px in ${geo.vw}`);
    record('layout', `${vp.n}-name-is-not-truncated-by-the-model`,
      geo.text === LONG, `showed ${JSON.stringify(geo.text)}`);
    // eslint-disable-next-line no-await-in-loop
    await page.close();
  }
}

// ── 2b. A hand-edited blob is sanitised on the way OUT of storage ────────────
//
// This is the path a NEWLINE can actually reach the model on: the field itself cannot
// hold one (see the `tab` case above), but JSON can, and `load()` used to run a bare
// `.slice(0, 16)` over whatever it found.
{
  const BLOBS = [
    {
      name: 'a-hand-edited-blob-is-sanitised-on-load',
      raw: '  ‮evil<script>  name that is far too long to fit  ',
      // The first 16 characters after the override is stripped and the padding
      // collapses — i.e. the cap lands mid-word, which is correct: a name is not
      // prose, and truncating to a word boundary would store something the player
      // never typed.
      want: 'evil<script> nam',
    },
    {
      // The case the sanitiser's RULE ORDER exists for. Strip control characters
      // first and this stores "ChefBoyardee": two words silently welded together.
      name: 'a-newline-in-storage-becomes-a-space-not-nothing',
      raw: 'Chef\nBoyardee',
      want: 'Chef Boyardee',
    },
  ];
  for (const blob of BLOBS) {
    // eslint-disable-next-line no-await-in-loop
    const page = await browser.newPage({ viewport: { width: 1280, height: 720 } });
    page.on('pageerror', (e) => errs.push(String(e)));
    // eslint-disable-next-line no-await-in-loop
    await page.addInitScript((name) => {
      try {
        localStorage.setItem('food-arena.profile.v1', JSON.stringify({
          name, wins: 0, losses: 0, xp: 0, selected: 'hamburger',
        }));
      } catch { /* private mode */ }
    }, blob.raw);
    // eslint-disable-next-line no-await-in-loop
    await openHome(page);
    // eslint-disable-next-line no-await-in-loop
    const shown = await badgeText(page);
    record('storage', blob.name,
      typeof shown === 'string' && shown.length <= NAME_MAX && !shown.includes('‮')
      && shown === blob.want,
      `badge ${JSON.stringify(shown)} want ${JSON.stringify(blob.want)}`);
    // eslint-disable-next-line no-await-in-loop
    await page.close();
  }
}

// ── 6. The danger zone still takes it ────────────────────────────────────────
{
  const page = await browser.newPage({ viewport: { width: 1280, height: 720 } });
  page.on('pageerror', (e) => errs.push(String(e)));
  await openSettings(page);
  await forceValue(page, 'Doomed');
  record('reset', 'a-name-to-wipe-is-in-place', (await storedName(page)) === 'Doomed');
  await page.click('[data-el="reset"]');
  await page.waitForTimeout(120);
  await Promise.all([
    page.waitForNavigation({ waitUntil: 'networkidle', timeout: 60000 }),
    page.click('[data-el="confirmyes"]'),
  ]);
  await page.waitForFunction('window.__screen !== undefined', null, { timeout: 60000 });
  await openHome(page);
  record('reset', 'reset-returns-the-badge-to-the-default',
    (await badgeText(page)) === DEFAULT_NAME, `badge "${await badgeText(page)}"`);
  await page.close();
}

record('-', 'no-console-errors', errs.length === 0, errs.slice(0, 3).join(' | '));

await browser.close();

let group = null;
for (const r of results) {
  if (r.group !== group) { group = r.group; console.log(`\n── ${group} ──`); }
  console.log(`${r.ok ? 'PASS' : 'FAIL'}  ${r.check.padEnd(48)} ${r.detail}`);
}
console.log(`\n${results.length - failures}/${results.length} checks passed`);
process.exit(failures ? 1 : 0);
