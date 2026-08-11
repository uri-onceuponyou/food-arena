#!/usr/bin/env node
/**
 * MP_PLAY — DOES THE PAYOUT ACTUALLY LAND? Played end to end, through the real renderer,
 * read back out of the real `localStorage`.
 *
 *   node tools/tmp/sx_snap.mjs --root <worktree> -- \
 *     node tools/tmp/mp_play.mjs --url '{URL}' --out shots/pj
 *
 * ## Why a browser arm exists at all
 *
 * `mp_join.mjs` proves the RULE — offline, exactly, against real matches. It cannot prove
 * the WIRE: `src/ui/**` is unreachable from Node (`DECISIONS §61`), so no offline gate can
 * see `matchScreen.ts`'s `onPhase` actually firing, `GameSession` actually recording the
 * `death` order, or `PlayerProfile` actually committing to storage. Every one of those is a
 * place the join can be correct and still not happen.
 *
 * 🚨 **AND THE KNOWN-BAD IS THE SAME RUN ON THE UNJOINED BUILD.** Point `--root` at a
 * worktree of the commit before the join and the six-fighter arm reports `seats: 2` — the
 * defect, reproduced end to end rather than described. A green here without that red is a
 * green from an instrument that has not been shown to be able to fail.
 *
 * ⚠️ The profile is CLEARED before each arm through `addInitScript`, which runs before any
 * page script — clearing after boot would leave the shell holding an already-loaded profile
 * object and the write would land on the old one.
 */
import { chromium } from 'playwright';
import { mkdirSync, writeFileSync } from 'node:fs';
import { resolve } from 'node:path';
import { pathToFileURL } from 'node:url';

const IS_MAIN = process.argv[1] !== undefined
  && pathToFileURL(resolve(process.argv[1])).href === import.meta.url;

const argOf = (k, d) => {
  const i = process.argv.indexOf(`--${k}`);
  return i >= 0 && process.argv[i + 1] && !process.argv[i + 1].startsWith('--') ? process.argv[i + 1] : d;
};

const STORAGE_KEY = 'food-arena.profile.v1';

if (IS_MAIN) {
  const BASE = String(argOf('url', process.env.PREVIEW_BASE ?? '')).replace(/\/$/, '');
  if (!BASE) { console.error('pj_play: --url or PREVIEW_BASE required'); process.exit(2); }
  const OUT = argOf('out', 'shots/pj');
  const SPEED = Number(argOf('speed', 8));
  mkdirSync(OUT, { recursive: true });

  const browser = await chromium.launch({
    args: ['--use-gl=angle', '--use-angle=swiftshader', '--enable-unsafe-swiftshader',
      '--enable-webgl', '--ignore-gpu-blocklist', '--disable-gpu-sandbox'],
  });

  let pass = 0; let fail = 0;
  const failures = [];
  const ok = (label, cond, detail = '') => {
    if (cond) { pass++; console.log(`  ✓ ${label}${detail ? `  — ${detail}` : ''}`); }
    else { fail++; failures.push(label); console.log(`  ✗ ${label}${detail ? `  — ${detail}` : ''}`); }
  };

  /**
   * Play one match to `phase === 'ended'` and hand back what was banked.
   *
   * ⚠️ `drive: 'survive'` IS NOT DECORATION. With no input the local seat stands on its
   * spawn and is shot first, so it places LAST at every seat count — and last of six pays
   * exactly what last of two pays (`DECISIONS §59`: last place *is* r=1 and takes the
   * shipped loss term verbatim). A run that only ever finishes last therefore proves the
   * PLACE is recorded and proves nothing about the MONEY. Walking to the arena centre —
   * `sx_sixplay.mjs`'s own `--arm survive`, and the only reliable way to get a living local
   * seat past the 30 s sudden-death trigger — is what produces a mid-table finish, which is
   * the only kind whose payout the boolean join could not express.
   */
  async function arm(name, ids, drive = 'idle') {
    const page = await browser.newPage({ viewport: { width: 844, height: 390 } });
    const errors = [];
    page.on('pageerror', (e) => errors.push(e.message));
    page.on('console', (m) => { if (m.type() === 'error') errors.push(m.text()); });
    // The snapshot already freezes the tree; this closes the HMR socket as well, so a peer's
    // save cannot reload the page mid-match.
    await page.route('**/@vite/client*', (r) => r.fulfill({
      status: 200, contentType: 'text/javascript',
      body: 'const noop=()=>{};export const createHotContext=()=>({accept:noop,acceptExports:noop,dispose:noop,prune:noop,invalidate:noop,on:noop,off:noop,send:noop,decline:noop,data:{}});export const injectQuery=(u)=>u;export const updateStyle=noop;export const removeStyle=noop;export const ErrorOverlay=class{};export default {};',
    }));
    await page.addInitScript((k) => { try { localStorage.removeItem(k); } catch { /* first load */ } }, STORAGE_KEY);

    const url = `${BASE}/?fighters=${encodeURIComponent(ids.join(';'))}&pointerLock=0&simSpeed=${SPEED}`;
    await page.goto(url, { waitUntil: 'domcontentloaded', timeout: 120_000 });
    await page.waitForFunction(() => window.__gameReady === true, null, { timeout: 180_000 });
    if (drive === 'survive') {
      // Slot 0 spawns west-north of the arena centre on the shipped kitchen
      // (`spawns[0] = {300, 810}`, `center = {1400, 1000}`), so +x/+y is "toward the middle"
      // and that is D + S. Released once inside `MIN_SAFE_RADIUS`, so the fighter is not
      // still walking when the ring collapses on top of it.
      await page.keyboard.down('KeyD');
      await page.keyboard.down('KeyS');
      await page.waitForFunction(() => {
        const f = window.__vfxDebugFighters?.slots?.[0];
        const a = window.__matchArena;
        if (!f || !a) return window.__matchDebug?.phase === 'ended';
        return Math.hypot(f.x - a.center.x, f.y - a.center.y) < 130
          || window.__matchDebug?.phase === 'ended';
      }, null, { timeout: 120_000 }).catch(() => {});
      await page.keyboard.up('KeyD');
      await page.keyboard.up('KeyS');
    }
    await page.waitForFunction(
      () => window.__matchDebug && window.__matchDebug.phase === 'ended',
      null, { timeout: 240_000 },
    );
    // The profile is written inside `onPhase`, synchronously with the transition — but the
    // transition is observed from a polled `waitForFunction`, so give the same frame a beat
    // to finish rather than racing it.
    await page.waitForTimeout(400);

    const banked = await page.evaluate((k) => {
      const raw = localStorage.getItem(k);
      if (!raw) return { raw: null };
      const blob = JSON.parse(raw);
      return { last: blob.economy?.lastMatch ?? null, xp: blob.xp, wins: blob.wins, losses: blob.losses };
    }, STORAGE_KEY);

    const shot = `${OUT}/${name}_result.png`;
    await page.screenshot({ path: shot });
    const cardText = await page.evaluate(() => {
      const el = document.querySelector('.hud-gameover-card');
      return el ? el.textContent.replace(/\s+/g, ' ').trim() : null;
    });
    await page.close();
    return { banked, errors, shot, cardText };
  }

  const SIX = ['hamburger', 'donut', 'taco', 'sushi', 'pizza', 'egg'];
  const TWO = ['hamburger', 'donut'];

  console.log(`MP_PLAY — the payout join, end to end\n  base: ${BASE}`);

  console.log('\n── SIX SEATS ────────────────────────────────────────────────────────────────');
  const six = await arm('six', SIX);
  console.log(`    lastMatch: ${JSON.stringify(six.banked.last)}`);
  console.log(`    xp ${six.banked.xp}  W${six.banked.wins}/L${six.banked.losses}`);
  console.log(`    card: ${six.cardText}`);
  console.log(`    shot: ${six.shot}`);
  ok('a six-fighter match banked something at all', !!six.banked.last);
  // 🔴 THE ROW THAT IS RED ON THE UNJOINED BUILD. It reports `seats: 2` there.
  ok('...and it banked SIX seats, not two',
    six.banked.last?.seats === 6, `seats=${six.banked.last?.seats}`);
  ok('...at a place inside 0..5',
    Number.isInteger(six.banked.last?.place) && six.banked.last.place >= 0 && six.banked.last.place <= 5,
    `place=${six.banked.last?.place}`);
  ok('...and `won` agrees with `place === 0`',
    six.banked.last?.won === (six.banked.last?.place === 0));
  ok('no page errors during the six-seat match', six.errors.length === 0, six.errors.slice(0, 2).join(' | '));

  console.log('\n── SIX SEATS, LOCAL SEAT DRIVEN TO THE CENTRE (a MID-TABLE finish) ──────────');
  const mid = await arm('six_survive', SIX, 'survive');
  console.log(`    lastMatch: ${JSON.stringify(mid.banked.last)}`);
  console.log(`    xp ${mid.banked.xp}  W${mid.banked.wins}/L${mid.banked.losses}`);
  console.log(`    shot: ${mid.shot}`);
  ok('the driven seat banked six seats', mid.banked.last?.seats === 6, `seats=${mid.banked.last?.seats}`);
  // The claim this arm exists for: a place the boolean join CANNOT express. At two seats
  // there is no place strictly between first and last, so any such finish is proof the
  // payout moved rather than merely the bookkeeping.
  ok('...at a place strictly between first and last — unreachable from a boolean',
    mid.banked.last?.place > 0 && mid.banked.last?.place < 5,
    `place=${mid.banked.last?.place} of ${mid.banked.last?.seats}`);
  ok('...and XP is NOT one of the two duel endpoints (so the third ladder moved too)',
    mid.banked.xp !== 100 && mid.banked.xp !== 35, `xp=${mid.banked.xp}`);
  ok('no page errors during the driven match', mid.errors.length === 0, mid.errors.slice(0, 2).join(' | '));

  console.log('\n── TWO SEATS (the control: the join must change NOTHING here) ───────────────');
  const two = await arm('two', TWO);
  console.log(`    lastMatch: ${JSON.stringify(two.banked.last)}`);
  console.log(`    xp ${two.banked.xp}  W${two.banked.wins}/L${two.banked.losses}`);
  console.log(`    shot: ${two.shot}`);
  ok('a duel still banks TWO seats', two.banked.last?.seats === 2, `seats=${two.banked.last?.seats}`);
  ok('...at place 0 or 1',
    two.banked.last?.place === 0 || two.banked.last?.place === 1, `place=${two.banked.last?.place}`);
  ok('...and XP is one of the two shipped duel endpoints (100 win / 35 loss)',
    two.banked.xp === 100 || two.banked.xp === 35, `xp=${two.banked.xp}`);
  ok('no page errors during the duel', two.errors.length === 0, two.errors.slice(0, 2).join(' | '));

  writeFileSync(`${OUT}/pj_play.json`, JSON.stringify({ six: six.banked, mid: mid.banked, two: two.banked }, null, 2));
  await browser.close();
  console.log(`\n${fail === 0 ? '✅' : '🔴'} MP_PLAY: ${pass} passed, ${fail} failed`);
  if (fail) console.log(`   failing: ${failures.join(' · ')}`);
  process.exit(fail === 0 ? 0 : 1);
}
