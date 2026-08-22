#!/usr/bin/env node
/**
 * WT_DRAWS — the frame cost of the puddle change, at two seats and at six.
 *
 * 🚨 `CLAUDE.md` #10: DRAW COUNTS ARE EXACT. Uri plays an iPhone 15 Pro and `5aa4655`
 * took that phone from 928 draws to 423 by merging the static props one mesh per
 * material — "a beautiful frame that drops his framerate is a regression". So a
 * rendering change reports draws before it reports anything else.
 *
 * ⚠️ `renderer.info` IS RESET AT THE START OF EVERY `renderer.render()` CALL unless
 * `autoReset === false`, and the app leaves the default. On a composited frame a naive
 * read therefore reports only the LAST post pass — `calls: 1`, which reads as "the
 * arena draws nothing". This sets `autoReset = false`, samples in a rAF callback
 * registered AFTER the app's (so it lands after that frame's render) and resets by
 * hand.
 *
 * ⚠️ The MILLISECONDS here are SwiftShader on a laptop, not the phone. Draws,
 * triangles and program count are device-independent and are the numbers to quote; the
 * rAF interval is reported with its own spread and a null arm so it cannot be quoted
 * as if it were exact.
 *
 * ⚠️ `--seats 1` IS NOT REACHABLE. `src/game/state.ts` — `MIN_FIGHTERS = 2`; a match
 * is a player and at least one opponent. The two arms are the shipped duel and the
 * six-seat brawl, which is what `MAX_FIGHTERS` is.
 *
 *   node tools/tmp/sx_snap.mjs --root <worktree> -- node tools/tmp/wt_draws.mjs --url '{URL}' --tag before
 */
import { chromium } from 'playwright';
import { realpathSync, writeFileSync, mkdirSync } from 'node:fs';
import { fileURLToPath } from 'node:url';

const argv = process.argv.slice(2);
const arg = (k, d = null) => { const i = argv.indexOf('--' + k); return i >= 0 ? argv[i + 1] : d; };

async function measure(page, base, seats, frames) {
  // Pinned next to the SOUTH pool, so the thing being priced is actually on screen —
  // a draw-call delta measured with the puddle out of frame is a measurement of
  // nothing (§6: assert the subject is in shot).
  const q = `player=hamburger&enemy=donut&px=1950&py=1100&fogRadius=1200&simSpeed=0.02&pointerLock=0${seats > 2 ? `&seats=${seats}` : ''}`;
  await page.goto(`${base}/?${q}`, { waitUntil: 'networkidle', timeout: 120_000 });
  await page.waitForFunction('window.__gameReady === true', null, { timeout: 120_000 });
  await page.waitForTimeout(2500);

  const out = await page.evaluate(async (n) => {
    const s = window.__stage;
    const r = s.renderer;
    r.info.autoReset = false;
    const calls = [], tris = [], dt = [];
    let last = performance.now();
    await new Promise((done) => {
      let i = 0;
      const tick = () => {
        const now = performance.now();
        calls.push(r.info.render.calls);
        tris.push(r.info.render.triangles);
        dt.push(now - last);
        last = now;
        r.info.reset();
        if (++i >= n) { r.info.autoReset = true; done(); return; }
        requestAnimationFrame(tick);
      };
      requestAnimationFrame(tick);
    });
    // Drop the first sample: it carries the reset boundary, not a frame.
    const c = calls.slice(1), t = tris.slice(1), d = dt.slice(1);
    const med = (a) => { const b = [...a].sort((x, y) => x - y); return b[Math.floor(b.length / 2)]; };
    return {
      // ⚠️ NOT `window.__matchDebug.state.fighters` — `MatchDebug` (`match.ts:257`)
      // carries the input→sim edge and no roster at all, so that read returned
      // `undefined` and printed `fighters=null` while the draw counts plainly differed
      // by seat count. The check was vacuous in exactly the direction that matters: it
      // could not have caught a seat count the app ignored. The HUD builds one
      // `.hud-fighter` per seat, which is the shipped, observable thing.
      fighters: document.querySelectorAll('.hud-fighter').length || null,
      callsMin: Math.min(...c), callsMed: med(c), callsMax: Math.max(...c),
      trisMed: med(t),
      programs: r.info.programs.length,
      dtMedMs: +med(d).toFixed(3),
      dtP10: +[...d].sort((a, b) => a - b)[Math.floor(d.length * 0.1)].toFixed(3),
      dtP90: +[...d].sort((a, b) => a - b)[Math.floor(d.length * 0.9)].toFixed(3),
      samples: c.length,
    };
  }, frames);
  return out;
}

const isMain = realpathSync(process.argv[1]) === realpathSync(fileURLToPath(import.meta.url));
if (isMain) {
  const BASE = (arg('url') ?? process.env.PREVIEW_BASE ?? '').replace(/\/$/, '');
  if (!BASE) { console.error('wt_draws: need --url or PREVIEW_BASE'); process.exit(2); }
  if (/:5173(\/|$)/.test(BASE)) { console.error('wt_draws: that is the SHARED dev server.'); process.exit(2); }
  const TAG = arg('tag', 'run');
  const FRAMES = Number(arg('frames', '60'));
  const OUT = arg('out', 'tools/tmp/wt_perf');

  const browser = await chromium.launch({
    args: ['--use-gl=angle', '--use-angle=swiftshader', '--enable-unsafe-swiftshader', '--enable-webgl', '--ignore-gpu-blocklist', '--disable-gpu-sandbox'],
  });
  const page = await browser.newPage({ viewport: { width: 1300, height: 740 }, deviceScaleFactor: 1 });
  page.on('pageerror', (e) => console.error('PAGEERROR', String(e)));

  const rows = [];
  let bad = 0;
  for (const seats of [2, 6]) {
    const m = await measure(page, BASE, seats, FRAMES);
    rows.push({ tag: TAG, seats, ...m });
    // NON-EMPTY / SUBJECT: a run that measured no frames, or a seat count the app did
    // not honour, must fail loudly rather than average to something plausible.
    const okSeats = m.fighters === seats;
    const okFrames = m.samples >= FRAMES - 5;
    if (!okSeats || !okFrames) bad++;
    console.log(`${TAG} seats=${seats} fighters=${m.fighters}${okSeats ? '' : ' ← SEAT COUNT NOT HONOURED'}  draws ${m.callsMin}/${m.callsMed}/${m.callsMax}  tris ${m.trisMed}  programs ${m.programs}  rAF ${m.dtMedMs} ms [p10 ${m.dtP10}, p90 ${m.dtP90}] n=${m.samples}${okFrames ? '' : ' ← TOO FEW FRAMES'}`);
  }
  mkdirSync(OUT, { recursive: true });
  writeFileSync(`${OUT}/${TAG}.json`, JSON.stringify(rows, null, 2));
  await browser.close();
  process.exit(bad === 0 ? 0 : 3);
}
