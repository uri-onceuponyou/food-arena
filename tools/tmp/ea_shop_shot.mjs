#!/usr/bin/env node
/**
 * ea_shop_shot — LOOK at the shop after items, and read what the cards actually say.
 *
 *   node tools/tmp/with_snapshot.mjs -- node tools/tmp/ea_shop_shot.mjs --url "{URL}" --out tools/tmp/ea_shot
 *
 * ── WHY A SCREENSHOT AND NOT JUST THE UNIT SUITE ────────────────────────────
 * `economy.test.mjs` proves the model can award an item. It cannot see that the SHOP
 * changed state as a consequence: four Buy buttons that have carried `disabled` since
 * this screen was built come alive, the "Nothing here is for sale yet" banner
 * disappears, and every card grows a new chip. `CLAUDE.md` non-negotiable 3 — judge
 * rendered pixels, read the PNG — and non-negotiable 8: when something is "not there",
 * assume it is rendering and INVISIBLE. The match pause chip shipped working at 1.026:1
 * against its own background. A new chip is exactly that shape of risk.
 *
 * So this dumps three things: the PNG, the literal text of every card (so a false
 * sentence is readable rather than inferred), and the enabled/disabled state of every
 * Buy control taken off the DOM `disabled` PROPERTY, not a class.
 *
 * ⚠️ This is a LOOKING tool, not an acceptance gate. `tools/tmp/shop_accept.mjs` is the
 * gate and it is NOT in this file set — its group 2 asserts the old all-disabled state
 * and is expected to go red on this change. Reported, not edited.
 */

import { chromium } from 'playwright';
import { mkdirSync, writeFileSync } from 'node:fs';
import { join } from 'node:path';

const arg = (name, dflt) => {
  const i = process.argv.indexOf(`--${name}`);
  return i >= 0 && process.argv[i + 1] ? process.argv[i + 1] : dflt;
};

const base = arg('url', process.env.PREVIEW_BASE);
const out = arg('out', 'tools/tmp/ea_shot');
if (!base) {
  console.error('ea_shop_shot: need --url (or PREVIEW_BASE). Run under with_snapshot.mjs.');
  process.exit(2);
}
mkdirSync(out, { recursive: true });

const LAUNCH_ARGS = [
  '--use-gl=angle', '--use-angle=swiftshader', '--enable-unsafe-swiftshader',
  '--enable-webgl', '--ignore-gpu-blocklist', '--disable-gpu-sandbox',
];

/** The desktop frame the shop was laid out against, plus the portrait phone that every
 *  landscape viewport in this repo has historically missed. */
const VIEWPORTS = [
  { name: 'desktop-1600x900', w: 1600, h: 900 },
  { name: 'phone-portrait-390x844', w: 390, h: 844 },
];

/**
 * A profile blob with enough currency to make a Buy button LIVE.
 *
 * ⚠️ Without this the tool only ever photographs the DISABLED state, because the default
 * profile holds 500 coins and the cheapest box is 900 — so "the buttons come alive" would
 * be a claim about a branch no screenshot had rendered. The state a change unlocks is the
 * state that has to be looked at. Seeded straight into `localStorage` under the key
 * `profile.ts` owns; `deserialize` validates it on the way in, so a wrong shape here
 * degrades to a fresh profile rather than to a crash.
 */
const RICH_PROFILE = {
  name: 'Rich', wins: 40, losses: 10, xp: 900, selected: 'hamburger',
  economy: {
    trophies: 600, bestTrophies: 600, coins: 50000, gems: 900,
    containers: { chest: 0, hamburgerBox: 0, pineappleBox: 0, redBox: 0, fireBox: 0 },
    claimed: [], unlocked: ['hamburger'], items: ['springform'],
    winsTowardChest: 0, levels: {}, seed: 4242, rolls: 0,
  },
};

const browser = await chromium.launch({ args: LAUNCH_ARGS });
const report = [];

const RUNS = [
  { tag: 'default', profile: null },
  { tag: 'rich', profile: RICH_PROFILE },
];

for (const run of RUNS) for (const vp of VIEWPORTS) {
  const page = await browser.newPage({ viewport: { width: vp.w, height: vp.h } });
  if (run.profile) {
    // Set BEFORE the app boots, or `profile.ts` reads an empty store and then overwrites.
    await page.addInitScript((blob) => {
      window.localStorage.setItem('food-arena.profile.v1', JSON.stringify(blob));
    }, run.profile);
  }
  await page.goto(`${base}/?screen=shop`, { waitUntil: 'domcontentloaded', timeout: 60000 });
  await page.waitForSelector('.fa-shop .shop-card', { timeout: 30000 });
  await page.waitForTimeout(600);

  const dom = await page.evaluate(() => {
    const txt = (n) => (n ? n.textContent.replace(/\s+/g, ' ').trim() : '');
    return {
      notice: txt(document.querySelector('.fa-shop .shop-notice')),
      footnote: txt(document.querySelector('[data-el="footnote"]')),
      cards: [...document.querySelectorAll('.fa-shop .shop-card')].map((card) => ({
        name: txt(card.querySelector('.shop-card-name')),
        chips: [...card.querySelectorAll('.shop-guarantee')].map(txt),
        odds: [...card.querySelectorAll('.shop-odds-row')].map(txt),
        pools: [...card.querySelectorAll('.shop-pool-line')].map(txt),
        why: txt(card.querySelector('.shop-why')),
        buys: [...card.querySelectorAll('.shop-buy')].map((b) => ({
          label: txt(b),
          // The DOM PROPERTY, never a class: a class-only "disabled" is still clickable
          // and still focusable, which is the defect both menu critics punished.
          disabled: b.disabled === true,
          hasAttr: b.hasAttribute('disabled'),
        })),
      })),
      // Anything that scrolls sideways is a layout fault, measured on element rects
      // rather than on scrollWidth — `.fa-root` is overflow:hidden and hides it.
      overflowPx: Math.max(0, ...[...document.querySelectorAll('.fa-shop *')]
        .map((n) => n.getBoundingClientRect().right - window.innerWidth)),
      // ⚠️ VERTICAL IS A DIFFERENT QUESTION AND HAS TO BE ASKED SEPARATELY. The card
      // copy grew, so the question is not "does it fit" (it is a scroll container, it
      // never had to) but "is anything UNREACHABLE" — content taller than the box with
      // no scroll to reach it. `overflow` on the scroller distinguishes them; a card
      // whose bottom sits below the scroller's own scrollHeight is genuinely clipped.
      scroll: (() => {
        const sc = document.querySelector('.fa-shop .shop-scroll');
        if (!sc) return null;
        const canScroll = sc.scrollHeight > sc.clientHeight + 1;
        const style = getComputedStyle(sc);
        const cards = [...document.querySelectorAll('.fa-shop .shop-card')];
        const scTop = sc.getBoundingClientRect().top;
        const deepest = Math.max(0, ...cards.map(
          (c) => (c.getBoundingClientRect().bottom - scTop) + sc.scrollTop,
        ));
        return {
          clientH: Math.round(sc.clientHeight),
          scrollH: Math.round(sc.scrollHeight),
          canScroll,
          overflowY: style.overflowY,
          deepestCardBottom: Math.round(deepest),
          clippedPx: Math.round(Math.max(0, deepest - sc.scrollHeight)),
        };
      })(),
    };
  });

  await page.screenshot({ path: join(out, `shop-${run.tag}-${vp.name}.png`), fullPage: false });
  report.push({ viewport: `${run.tag} / ${vp.name}`, ...dom });
  await page.close();
}

await browser.close();
writeFileSync(join(out, 'shop.json'), `${JSON.stringify(report, null, 2)}\n`);

for (const r of report) {
  console.log(`\n═══ ${r.viewport} ═══`);
  console.log(`overflow past viewport: ${r.overflowPx.toFixed(1)}px`);
  console.log(`scroller: ${JSON.stringify(r.scroll)}`);
  console.log(`banner:   ${r.notice || '(none)'}`);
  console.log(`footnote: ${r.footnote}`);
  for (const c of r.cards) {
    const live = c.buys.filter((b) => !b.disabled).length;
    console.log(`\n  ${c.name}  —  ${live}/${c.buys.length} buy controls LIVE`);
    for (const chip of c.chips) console.log(`    chip: ${chip}`);
    for (const o of c.odds) console.log(`    odds: ${o}`);
    for (const p of c.pools) console.log(`    pool: ${p}`);
    console.log(`    why:  ${c.why}`);
  }
}
console.log(`\nPNGs + shop.json in ${out}`);
