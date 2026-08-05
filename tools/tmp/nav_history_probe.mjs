#!/usr/bin/env node
/**
 * Session continuity — does a RELOAD land the player where they were?
 *
 * ── The defect this exists to measure ───────────────────────────────────────────
 * `src/ui/screens/shell.ts:navigate()` never touched `history`. Nothing in `src/`
 * did (`grep -rn "history\.\|popstate" src/` returned zero hits before this probe was
 * written). So the URL never changed as the player navigated, and `main.ts:bootRoute`
 * re-derived the boot route from the ORIGINAL bare `/` on every document load —
 * opening -> home. Any reload therefore dumped the player on the home screen:
 *
 *   * a Vite HMR full-reload (measured at ONE EVERY 9.3 s on the shared dev server,
 *     against a 45 s match — `docs/TOOLS.md`),
 *   * a refresh, a restored tab, a mobile tab eviction, a renderer crash.
 *
 * Uri reported it as *"the game is crashing mid-flight and starting over from
 * homescreen."* HMR was the trigger; THIS was the mechanism that made it look like a
 * crash. The trigger was fixed by serving a production bundle (`playtest.mjs`); the
 * mechanism is what this probe holds down.
 *
 * ── The rule being asserted ─────────────────────────────────────────────────────
 * The URL always names the current screen, and a reload always lands on that screen.
 * A MATCH is the one route that cannot be resumed — it is a live 45 s simulation with
 * no serialised form — so a reload of a match URL re-enters the SAME MATCHUP as a
 * FRESH match. Nothing is lost by that: `matchScreen.ts` banks a result only on
 * `phase === 'ended'`, so an interrupted match was never recorded (group 3 measures
 * that rather than assuming it).
 *
 * ── Groups, and why each is here ────────────────────────────────────────────────
 *   0  INSTRUMENT VALIDATION. Every later group reads `window.__screen` and trusts
 *      `main.ts` to decode `?screen=`. Group 0 proves both against KNOWN inputs
 *      first (`docs/LESSONS.md` §13). If group 0 fails, no other number here means
 *      anything.
 *   1  The URL reflects the mounted screen.
 *   2  A reload lands on the same MENU screen.
 *   3  A reload mid-MATCH re-enters the same matchup, and banks nothing.
 *   4  Back / forward move the app, and the boot splash is not a Back trap.
 *   5  REGRESSION GUARD: every pre-existing query parameter survives the rewrite.
 *      `?simSpeed=`, `?tier=`, `?px=`, `?aimMode=` and friends are read lazily by
 *      six modules; a router that "tidied" the URL would silently break most of the
 *      tool suite. This group passes vacuously BEFORE the fix and must still pass
 *      after — that is the whole point of it.
 *   6  A screen that THROWS while mounting must not take the app with it. Before the
 *      fix `swapping` latched true forever and every subsequent navigation was a
 *      silent no-op behind an opaque curtain — a recoverable event turned into a
 *      permanent black screen.
 *
 *   7  FALSE-POSITIVE GUARD: ordinary play destroys GL contexts on purpose, and must
 *      never look like the GPU failure group 3 of `glloss_probe.mjs` surfaces.
 *
 * Group 6's fault is an UNKNOWN ROUTE NAME rather than the shell's `__shellFault`
 * seam, deliberately: the seam is part of the fix, so a fault only it can inject would
 * make the group unmeasurable on the code being fixed. An unknown route breaks both
 * versions, so the before/after is a real comparison. `__shellFault` is used only for
 * the last-resort case, where the FALLBACK screen has to fail too.
 *
 *   node tools/tmp/nav_history_probe.mjs --url http://localhost:5188
 *   node tools/tmp/with_snapshot.mjs -- node tools/tmp/nav_history_probe.mjs   # after
 *   node tools/tmp/headserve.mjs     -- node tools/tmp/nav_history_probe.mjs   # before
 */
import { chromium } from 'playwright';
import { settleScreen } from './settle.mjs';

const LAUNCH_ARGS = ['--use-gl=angle', '--use-angle=swiftshader', '--enable-unsafe-swiftshader',
  '--enable-webgl', '--ignore-gpu-blocklist', '--disable-gpu-sandbox'];
const a = process.argv;
const get = (k, d) => (a.includes(k) ? a[a.indexOf(k) + 1] : d);
// `--url` wins; otherwise PREVIEW_BASE, which both `with_snapshot.mjs` (frozen
// working tree) and `headserve.mjs` (pristine `git archive HEAD`) export. That is
// what lets the SAME probe file measure the before and the after.
const base = get('--url', process.env.PREVIEW_BASE || 'http://localhost:5173').replace(/\/$/, '');
const only = get('--only', null);

/** Vite's HMR client, stubbed. A peer's save mid-run is a page reload, and this probe
 *  asserts on what a reload does — an uninvited one would be indistinguishable from
 *  the ones it performs itself. `docs/TOOLS.md` calls this out for any probe holding
 *  in-page state; here it is load-bearing for correctness, not just for speed. */
const HMR_STUB = 'const noop=()=>{};export const createHotContext=()=>({accept:noop,acceptExports:noop,dispose:noop,prune:noop,invalidate:noop,on:noop,off:noop,send:noop,decline:noop,data:{}});export const injectQuery=(u)=>u;export const updateStyle=noop;export const removeStyle=noop;export const ErrorOverlay=class{};export default {};';

let pass = 0;
let fail = 0;
const failures = [];
let group = '';

function ok(cond, label, detail = '') {
  if (cond) { pass++; console.log(`  PASS  ${label}${detail ? `   ${detail}` : ''}`); }
  else { fail++; failures.push(`[${group}] ${label} ${detail}`); console.log(`  FAIL  ${label}${detail ? `   ${detail}` : ''}`); }
  return cond;
}
function eq(actual, want, label) {
  return ok(actual === want, label, `got ${JSON.stringify(actual)} want ${JSON.stringify(want)}`);
}
function head(name) {
  group = name;
  console.log(`\n── ${name} ${'─'.repeat(Math.max(0, 66 - name.length))}`);
}
const skip = (name) => only !== null && !name.startsWith(only);

const browser = await chromium.launch({ args: LAUNCH_ARGS });
const ctx = await browser.newContext({ viewport: { width: 1280, height: 720 } });
const page = await ctx.newPage();
const pageErrors = [];
page.on('pageerror', (e) => pageErrors.push(String(e)));
await page.route('**/@vite/client*', (r) => r.fulfill({ status: 200, contentType: 'text/javascript', body: HMR_STUB }));

/** Everything this probe reads about "where am I", in one page evaluation. */
const look = () => page.evaluate(() => {
  const u = new URL(location.href);
  return {
    screen: window.__screen ?? null,
    route: window.__shell ? window.__shell.route() : null,
    search: u.search,
    param: Object.fromEntries(u.searchParams.entries()),
    state: history.state ?? null,
    len: history.length,
    stackChildren: document.querySelectorAll('.fa-stack > *').length,
    curtain: (() => {
      const c = document.querySelector('.fa-curtain');
      return c ? Number(getComputedStyle(c).opacity) : null;
    })(),
  };
});

/**
 * Wait for a named screen to be mounted AND painted. Never a bare timeout.
 *
 * `window.__screenReady === true` does not mean the screen is VISIBLE — the flag is
 * set in the same tick the curtain drops and a 0.26 s fade then runs, measured at
 * opacity 0.000 when the flag flips. `settleScreen` is the shared paint condition and
 * is correct at any machine speed. `soft` because a group that is SUPPOSED to fail
 * (every one of them, before the fix) must report its failure rather than throw.
 *
 * The screen-name wait is capped at 45 s and not 120: a menu mounts within a couple of
 * seconds of `domcontentloaded` even under SwiftShader, and the difference on a run
 * that is expected to fail sixteen of these is twenty minutes. `__gameReady` keeps a
 * long budget because a match really does take that long to boot here.
 */
async function waitScreen(name, opts = {}) {
  await page.waitForFunction(
    (n) => window.__screen === n && window.__screenReady === true,
    name,
    { timeout: opts.timeout ?? 45_000 },
  ).catch(() => {});
  if (name === 'match') {
    await page.waitForFunction(() => window.__gameReady === true, null, { timeout: 180_000 }).catch(() => {});
  } else {
    await settleScreen(page, { timeout: 25_000, soft: true });
  }
  return look();
}

async function goto(path, screen) {
  await page.goto(`${base}${path}`, { waitUntil: 'domcontentloaded', timeout: 90_000 });
  return waitScreen(screen);
}

/** Navigate the way the game does — through the shell's own router. */
async function nav(route) {
  await page.evaluate((r) => window.__shell.navigate(r), route);
  return waitScreen(route.name);
}

try {
  // ── 0. INSTRUMENT VALIDATION ────────────────────────────────────────────────
  // Known input -> known answer, before anything unknown is believed.
  if (!skip('0')) {
    head('0. instrument validation (known inputs — must pass before AND after)');
    let s = await goto('/?screen=settings', 'settings');
    eq(s.screen, 'settings', 'goto ?screen=settings mounts the settings screen');
    s = await goto('/?screen=characters', 'characters');
    eq(s.screen, 'characters', 'goto ?screen=characters mounts the roster');
    s = await goto('/?player=pizza&enemy=egg', 'match');
    eq(s.screen, 'match', 'goto ?player=&enemy= boots straight into a match');
    ok(s.param.player === 'pizza' && s.param.enemy === 'egg', 'the match QA params are visible to the page',
      `player=${s.param.player} enemy=${s.param.enemy}`);
  }

  // ── 1. THE URL REFLECTS THE SCREEN ──────────────────────────────────────────
  if (!skip('1')) {
    head('1. the URL names the mounted screen');
    await goto('/?screen=home', 'home');
    for (const name of ['characters', 'trophies', 'shop', 'settings', 'home']) {
      const s = await nav({ name });
      // eslint-disable-next-line no-await-in-loop
      eq(s.param.screen, name, `after navigate(${name}) the URL says screen=${name}`);
      eq(s.screen, name, `...and the mounted screen agrees`);
    }
    const s = await nav({ name: 'match', player: 'pizza', enemy: 'egg' });
    eq(s.param.screen, 'match', 'a match writes screen=match');
    eq(s.param.player, 'pizza', '...and carries its own player');
    eq(s.param.enemy, 'egg', '...and its enemy');
  }

  // ── 2. A RELOAD LANDS WHERE YOU WERE ────────────────────────────────────────
  if (!skip('2')) {
    head('2. a reload lands on the same MENU screen');
    for (const name of ['characters', 'trophies', 'settings', 'shop']) {
      // eslint-disable-next-line no-await-in-loop
      await goto('/?screen=home', 'home');
      // eslint-disable-next-line no-await-in-loop
      await nav({ name });
      // eslint-disable-next-line no-await-in-loop
      await page.reload({ waitUntil: 'domcontentloaded', timeout: 90_000 });
      // eslint-disable-next-line no-await-in-loop
      const s = await waitScreen(name);
      eq(s.screen, name, `reload on ${name} lands back on ${name}`);
    }
  }

  // ── 3. A RELOAD MID-MATCH ───────────────────────────────────────────────────
  if (!skip('3')) {
    head('3. a reload mid-match re-enters the SAME MATCHUP, and banks nothing');
    await goto('/?screen=home', 'home');
    await nav({ name: 'match', player: 'taco', enemy: 'donut' });
    // Let the match actually run, so "mid-flight" is not a figure of speech.
    await page.waitForTimeout(1500);
    // `matchScreen.ts` banks a result only on `phase === 'ended'`, so an interrupted
    // match should leave the profile untouched — including leaving it ABSENT, which is
    // itself the evidence: an interruption that recorded a loss would have to write
    // the key to do it.
    const before = await page.evaluate(() => {
      const raw = localStorage.getItem('food-arena.profile.v1');
      const d = raw ? JSON.parse(raw) : null;
      return { wins: d?.wins ?? null, losses: d?.losses ?? null, stored: raw !== null };
    });
    await page.reload({ waitUntil: 'domcontentloaded', timeout: 90_000 });
    const s = await waitScreen('match');
    eq(s.screen, 'match', 'reload mid-match lands on the match screen, not home');
    eq(s.route?.player, 'taco', '...with the same player');
    eq(s.route?.enemy, 'donut', '...against the same enemy');
    const after = await page.evaluate(() => {
      const raw = localStorage.getItem('food-arena.profile.v1');
      const d = raw ? JSON.parse(raw) : null;
      return { wins: d?.wins ?? null, losses: d?.losses ?? null, stored: raw !== null };
    });
    ok(before.wins === after.wins && before.losses === after.losses && before.stored === after.stored,
      'an interrupted match banks no win and no loss',
      `wins/losses ${before.wins}/${before.losses} -> ${after.wins}/${after.losses}`
      + ` (profile record ${before.stored ? 'present' : 'absent'} -> ${after.stored ? 'present' : 'absent'})`);
  }

  // ── 4. BACK AND FORWARD ─────────────────────────────────────────────────────
  if (!skip('4')) {
    head('4. back / forward move the app, and the splash is not a Back trap');
    await goto('/?screen=home', 'home');
    await nav({ name: 'characters' });
    await page.goBack({ waitUntil: 'domcontentloaded', timeout: 60_000 }).catch(() => {});
    let s = await waitScreen('home');
    eq(s.screen, 'home', 'Back from the roster returns to home');
    await page.goForward({ waitUntil: 'domcontentloaded', timeout: 60_000 }).catch(() => {});
    s = await waitScreen('characters');
    eq(s.screen, 'characters', 'Forward returns to the roster');

    // Out of a match, Back is the same exit the pause sheet offers.
    await nav({ name: 'match', player: 'pizza', enemy: 'egg' });
    await page.goBack({ waitUntil: 'domcontentloaded', timeout: 60_000 }).catch(() => {});
    s = await waitScreen('characters');
    eq(s.screen, 'characters', 'Back out of a match returns to the screen that started it');

    // The title card is boot-only ("a splash you can reach twice is a splash you are
    // trapped in" — types.ts). Its auto-continue must REPLACE, not push, or Back from
    // home lands on the splash which immediately auto-continues to home again.
    await page.goto(`${base}/?hold=300`, { waitUntil: 'domcontentloaded', timeout: 90_000 });
    await waitScreen('opening');
    await waitScreen('home');
    const back = await page.goBack({ waitUntil: 'domcontentloaded', timeout: 30_000 }).catch(() => null);
    const url = page.url();
    const landed = url.startsWith(base) ? (await look()).screen : null;
    ok(landed !== 'opening', 'Back from home does NOT re-enter the title card',
      `landed on ${landed ?? url} (goBack ${back ? 'navigated' : 'refused'})`);
  }

  // ── 5. REGRESSION GUARD — QA PARAMETERS SURVIVE ─────────────────────────────
  if (!skip('5')) {
    head('5. every pre-existing query parameter survives the rewrite');
    await goto('/?player=pizza&enemy=egg&simSpeed=0.02&tier=low&aimMode=free&pointerLock=0', 'match');
    const inMatch = await look();
    eq(inMatch.param.simSpeed, '0.02', 'simSpeed survives the boot rewrite');
    eq(inMatch.param.tier, 'low', 'tier survives the boot rewrite');
    const s = await nav({ name: 'home' });
    eq(s.param.simSpeed, '0.02', 'simSpeed survives a navigation');
    eq(s.param.tier, 'low', 'tier survives a navigation');
    eq(s.param.aimMode, 'free', 'aimMode survives a navigation');
    eq(s.param.pointerLock, '0', 'pointerLock survives a navigation');
    await page.reload({ waitUntil: 'domcontentloaded', timeout: 90_000 });
    await waitScreen('home');
    const tier = await page.evaluate(() => window.__renderTier ?? null);
    eq(tier, 'low', '...and still applies after the reload it enabled');
  }

  // ── 6. A SCREEN THAT THROWS MUST NOT TAKE THE APP WITH IT ───────────────────
  if (!skip('6')) {
    head('6. a screen that throws while mounting must not freeze the router');
    await goto('/?screen=home', 'home');
    const supported = await page.evaluate(() => typeof window.__shell?.navigate === 'function');
    ok(supported, 'the shell exposes its QA navigation handle');
    // A route name the factory table has no case for. Deliberately NOT the
    // `__shellFault` seam: that seam is part of the fix, so a fault only it can inject
    // would make this group unmeasurable on the code being fixed. An unknown route is
    // a real arrival path (a `history.state` written by an older build) AND it fails
    // on both sides, so the before/after here is a genuine comparison.
    await page.evaluate(() => window.__shell.navigate({ name: 'not-a-screen' }));
    await page.waitForTimeout(1200);
    const broken = await look();
    ok(broken.stackChildren > 0, 'a screen is still mounted after the failed build',
      `${broken.stackChildren} child(ren) in .fa-stack`);
    ok((broken.curtain ?? 1) < 0.02, 'the curtain came back down', `opacity ${broken.curtain}`);
    // The sharp one: before the fix `swapping` latched true and EVERY later
    // navigation was a silent no-op.
    let s = await nav({ name: 'settings' });
    eq(s.screen, 'settings', 'the router still works after a screen threw');

    // ...and the last resort: the FALLBACK fails too. There is nowhere left to go, so
    // the only acceptable outcome is a panel that says so and offers a reload — never
    // an opaque curtain over nothing.
    await page.evaluate(() => { window.__shellFault = { build: 2 }; });
    await page.evaluate(() => window.__shell.navigate({ name: 'characters' }));
    await page.waitForTimeout(1500);
    const fatal = await page.evaluate(() => {
      const el = document.querySelector('[data-el="fa-fatal"]');
      const btn = el ? el.querySelector('button') : null;
      const r = btn ? btn.getBoundingClientRect() : null;
      return {
        present: !!el,
        text: el ? (el.textContent || '').trim().slice(0, 60) : null,
        btn: r ? { w: Math.round(r.width), h: Math.round(r.height) } : null,
      };
    });
    ok(fatal.present && fatal.btn && fatal.btn.h >= 44,
      'when even the fallback screen fails, the player gets a panel and a way out',
      `${fatal.text ?? 'no panel'} ${fatal.btn ? `button ${fatal.btn.w}x${fatal.btn.h}` : ''}`);
    await page.evaluate(() => { window.__shellFault = null; });
    s = await nav({ name: 'home' });
    eq(s.screen, 'home', 'and the app recovers from even that');
  }

  // ── 7. THE FALSE-POSITIVE GUARD ─────────────────────────────────────────────
  // `shell.ts` now surfaces a "graphics interrupted" notice on `fa:webglcontextlost`.
  // Ordinary play DELIBERATELY destroys GL contexts — `disposeCharacterStage()` on
  // the way into a match, `Stage.dispose()` on the way out, and `thumbs.ts`'s
  // offscreen generator disposing itself on every menu — and each of those ends in
  // `forceContextLoss()`, i.e. a REAL `webglcontextlost` event. A notice that fires on
  // those would be worse than the bug it reports.
  if (!skip('7')) {
    head('7. normal play must never look like a GPU failure');
    await goto('/?screen=home', 'home');
    await page.evaluate(() => { window.__glProbeSeen = 0; window.addEventListener('fa:webglcontextlost', () => { window.__glProbeSeen++; }); });
    for (const step of [
      { name: 'characters' },
      { name: 'match', player: 'pizza', enemy: 'egg' },
      { name: 'home' },
      { name: 'match', player: 'taco', enemy: 'donut' },
      { name: 'home' },
    ]) {
      // eslint-disable-next-line no-await-in-loop
      await nav(step);
    }
    const seen = await page.evaluate(() => ({
      broadcasts: window.__glProbeSeen ?? null,
      notice: !!document.querySelector('[data-el="fa-gl-notice"]'),
      log: (window.__glLog ?? []).map((e) => `${e.type}${e.offscreen ? '(offscreen)' : ''}`),
    }));
    ok(seen.broadcasts === 0, 'two full menu -> match -> menu round trips broadcast NO context loss',
      `${seen.broadcasts} broadcast(s); __glLog = ${JSON.stringify(seen.log)}`);
    ok(seen.notice === false, 'and no notice was ever shown');
  }
} finally {
  head('page errors');
  // A thrown screen constructor legitimately reports one error; anything beyond the
  // faults this probe injected is a real defect.
  console.log(pageErrors.length ? pageErrors.slice(0, 6).map((e) => `  ${e.slice(0, 160)}`).join('\n') : '  none');
  await ctx.close();
  await browser.close();
}

console.log(`\n${pass}/${pass + fail} assertions passed`);
if (fail) {
  console.log('\nFAILURES');
  for (const f of failures) console.log(`  ${f}`);
}
process.exit(fail ? 1 : 0);
