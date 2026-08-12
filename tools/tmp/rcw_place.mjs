#!/usr/bin/env node
/**
 * RCW_PLACE — IS `HudFrameInfo.place` ACTUALLY ABSENT AT TWO SEATS?
 *
 * ## The claim under test, and why it needed testing
 *
 * `src/ui/hud.ts` says of the finishing-place branch:
 *
 *   > *"Absent today at every seat count, so this branch writes nothing and the element
 *   > stays `display: none` — the card is byte-identical to before."*
 *
 * That was true when it was written. `git log -L` dates it to **48ad6ca, 20:32:26**, and
 * `bb00d66` added `match.ts:hudPlace()` at **20:36:16** — four minutes later. `hudPlace()`
 * returns `{ place: localPlace + 1, of: seats }` for any ended match with `seats > 1`, and
 * `hudResult()` spreads it into BOTH `hud.update` call sites. So the comment is stale in the
 * direction that matters: it says a branch is dead that is now live on every card a player
 * sees.
 *
 * ⚠️ Reading two commit timestamps is not evidence that a branch RUNS. This plays a real
 * two-seat match through the shipped screens and reads the element.
 *
 * ## 🚨 THE KNOWN-BAD
 *
 * `--arm nofeed` strips `place` out of the frame on its way to the HUD, which is the world
 * the comment describes. The row must go GREEN there and RED here, or this file is measuring
 * "an element exists" rather than "the game fills it in".
 *
 * ## Use
 *
 *   node tools/tmp/sx_snap.mjs --root <worktree> -- node tools/tmp/rcw_place.mjs --url '{URL}'
 *   node tools/tmp/rcw_place.mjs --url <base> --selftest
 */
import { chromium } from 'playwright';
import { resolve } from 'node:path';
import { pathToFileURL } from 'node:url';

const IS_MAIN = process.argv[1] !== undefined
  && pathToFileURL(resolve(process.argv[1])).href === import.meta.url;
const argv = process.argv.slice(2);
const flag = (n, d = null) => {
  const i = argv.indexOf(`--${n}`);
  return i >= 0 && argv[i + 1] && !argv[i + 1].startsWith('--') ? argv[i + 1] : d;
};
const BASE = (flag('url') ?? process.env.PREVIEW_BASE ?? '').replace(/\/$/, '');
const ARM = flag('arm', 'base');
const WALL = Number(flag('wall', '240000'));

const rows = [];
const check = (name, pass, ev) => {
  rows.push({ name, pass: !!pass });
  console.log(`  ${pass ? 'ok  ' : 'FAIL'} ${name}${ev ? ` — ${ev}` : ''}`);
  return !!pass;
};

/**
 * `--arm nofeed` — the world the stale comment describes, built by rewriting the MODULE.
 *
 * ⚠️ THE FIRST VERSION OF THIS ARM PATCHED `window.__matchHud`, WHICH DOES NOT EXIST. That
 * global was invented rather than checked (`grep` finds `__matchDebug` and `__matchArena` in
 * `match.ts` and no third), and it would have thrown on every run — a known-bad that cannot
 * be installed is not a known-bad. There is no page-side handle on the live HUD object, so
 * the arm intercepts the served module instead and neuters the ONE line that supplies the
 * field. That is precisely the pre-`bb00d66` source, which is what the comment claims is
 * still true.
 */
const NOFEED_FROM = 'place: this.hudPlace(),';
const NOFEED_TO = 'place: null,';

async function run() {
  if (!BASE) { console.error('rcw_place: --url (or PREVIEW_BASE) is required.'); process.exit(2); }
  const browser = await chromium.launch();
  try {
    const page = await browser.newPage({ viewport: { width: 430, height: 932 } });
    const errors = [];
    page.on('pageerror', (e) => errors.push(e.message));
    await page.route('**/@vite/client*', (r) => r.fulfill({
      status: 200, contentType: 'text/javascript',
      body: 'const noop=()=>{};export const createHotContext=()=>({accept:noop,acceptExports:noop,'
        + 'dispose:noop,prune:noop,invalidate:noop,on:noop,off:noop,send:noop,decline:noop,data:{}});'
        + 'export const injectQuery=(u)=>u;export const updateStyle=noop;export const removeStyle=noop;'
        + 'export const ErrorOverlay=class{};export default {};',
    }));
    let patched = 0;
    if (ARM === 'nofeed') {
      await page.route('**/src/game/match.ts*', async (route) => {
        const res = await route.fetch();
        const body = await res.text();
        if (!body.includes(NOFEED_FROM)) {
          // Stated loudly rather than silently passing through: if the anchor moves, this
          // arm quietly becomes the base arm and the selftest starts certifying nothing.
          throw new Error(`rcw_place: --arm nofeed could not find "${NOFEED_FROM}" in match.ts`);
        }
        patched++;
        await route.fulfill({ response: res, body: body.replace(NOFEED_FROM, NOFEED_TO) });
      });
    }
    // TWO seats — the seat count that ships, and the one the stale comment covers.
    await page.goto(`${BASE}/?fighters=sushi;hamburger&pointerLock=0&simSpeed=8`,
      { waitUntil: 'domcontentloaded', timeout: 120_000 });
    await page.waitForFunction(() => window.__gameReady === true, null, { timeout: 180_000 });
    if (ARM === 'nofeed' && !check('the known-bad was actually installed', patched > 0,
      `${patched} module rewrites`)) { await page.close(); await browser.close(); return 1; }
    const t0 = Date.now();
    let seen = null;
    while (Date.now() - t0 < WALL) {
      seen = await page.evaluate(() => {
        const card = document.querySelector('.hud-gameover-card');
        const go = card?.closest('.hud-gameover');
        if (!card || go?.style.display !== 'flex') return null;
        const el = card.querySelector('.hud-gameover-place');
        return {
          text: el?.textContent ?? null,
          display: el ? getComputedStyle(el).display : 'absent',
          title: card.querySelector('.hud-gameover-title')?.textContent ?? null,
        };
      });
      if (seen) break;
      await page.waitForTimeout(250);
    }
    if (!check('a real two-seat match reached a result card', !!seen,
      `${((Date.now() - t0) / 1000).toFixed(1)}s`)) { await page.close(); await browser.close(); return 1; }
    check('the finishing place is FILLED IN at two seats (the hud.ts comment says it is not)',
      !!seen.text && /^\d+(st|nd|rd|th) of 2$/i.test(seen.text.trim()),
      `text="${seen.text}" display=${seen.display} title="${seen.title}"`);
    check('...and the element is therefore VISIBLE, not display:none',
      seen.display !== 'none', `display=${seen.display}`);
    check('no page errors', errors.length === 0, errors.slice(0, 2).join(' | '));
    await page.close();
  } finally {
    await browser.close();
  }
  const failed = rows.filter((r) => !r.pass);
  console.log(`\nrcw_place: ${rows.length - failed.length}/${rows.length} checks passed (arm=${ARM})`);
  return failed.length;
}

async function selftest() {
  const self = resolve(new URL(import.meta.url).pathname);
  const { spawnSync } = await import('node:child_process');
  const r = spawnSync(process.execPath, [self, '--url', BASE, '--arm', 'nofeed'], { encoding: 'utf8' });
  const line = (r.stdout ?? '').split('\n').find((l) => l.includes('the finishing place is FILLED IN'));
  const red = !!line && line.trim().startsWith('FAIL');
  console.log(`  ${red ? 'ok  ' : 'FAIL'} --arm nofeed: the row is ${red ? 'RED' : 'GREEN'}`);
  if (!red) console.log(`        ${(line ?? '(row absent)').trim()}`);
  return red ? 0 : 1;
}

if (IS_MAIN) {
  const code = argv.includes('--selftest') ? await selftest() : await run();
  process.exit(code === 0 ? 0 : 1);
}
