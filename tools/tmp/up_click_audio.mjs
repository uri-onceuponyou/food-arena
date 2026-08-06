#!/usr/bin/env node
/**
 * up_click_audio — does tapping a MENU BUTTON make a sound, measured off the master bus?
 *
 * ── The bug this was written for ────────────────────────────────────────────
 *
 * Uri, playing the deployed build: *"i can't hear on menus as well now."* Half of that
 * was a 404 on the theme (`aud_menu_silence.mjs`, fixed). The other half was that
 * `uiClick()` had existed in `src/audio/sounds.ts` since the audio pillar was built and
 * its ONLY caller was the settings screen's volume slider. Play, Foods, Trophies, Shop,
 * Back, Fight, every roster card, every claim — all silent when tapped.
 *
 * ── Why this cannot be an offline assertion ─────────────────────────────────
 *
 * `tools/audio-probe.mjs` renders sounds through `OfflineAudioContext`: it proves
 * `uiClick()` PRODUCES sound, which was never in doubt and was true the whole time the
 * menus were silent. What was missing was the CALL. That is a wiring question, it lives
 * in the DOM, and the only place it can be answered is a real browser with a real
 * trusted click and a tap on the real master bus. Same blind spot, same shape, as
 * `docs/LESSONS.md` §3b.
 *
 * ── What it measures ────────────────────────────────────────────────────────
 *
 * A `ScriptProcessorNode` on the master bus through `window.__audio.connectTap` —
 * not an analyser poll, which at SwiftShader's frame rate once missed 4 of 5 blips
 * (`docs/LESSONS.md` §10). The tap runs continuously and is sampled per CELL, so each
 * cell's number is the energy on the bus in the ~700 ms window around one real click.
 *
 * MUSIC IS DISABLED via `localStorage` before the page loads. The theme is a continuous
 * ~0.02 rms on the same bus and would drown a 55 ms blip in its own noise — the metric
 * would be true and would tell you nothing (`docs/LESSONS.md` §14).
 *
 * The context is unlocked with a trusted SHIFT KEYDOWN, not a click: the engine's own
 * gesture listeners include `keydown`, so this spends the first-gesture-is-silent frame
 * (`resume()` has not resolved when the first `play()` is reached) on an input that
 * touches no control and can therefore never be mistaken for the thing being measured.
 *
 * ── THE KNOWN-BAD INPUTS (CLAUDE.md non-negotiable #6) ──────────────────────
 *
 * A guard that has not been shown to FAIL on the bug it guards against is not a guard.
 * Every cell below has a stated expectation and the file exits 1 if any cell disagrees:
 *
 *   | cell            | what it clicks                     | expect |
 *   |-----------------|------------------------------------|--------|
 *   | button          | the home screen's Foods tab        | SOUND  |
 *   | dead-space      | background pixels, no control       | SILENT |
 *   | muted           | the same tab, engine muted          | SILENT |
 *   | suppressed      | settings' MUTE toggle              | SILENT |
 *   | sibling-control | settings' MUSIC toggle beside it   | SOUND  |
 *
 * `dead-space` is the control that stops this from being a click detector: without it a
 * probe that played a sound on every pointer event anywhere would pass. `suppressed`
 * and `sibling-control` are a PAIRED negative — same screen, same class, same delegated
 * handler, adjacent in the DOM, differing only by `data-clicksound="off"` — so a pass
 * there cannot be explained by the settings screen being special.
 *
 * ⚠️ And the negative that matters most is not in this file, because it cannot be: the
 * BEFORE tree. Run this against a snapshot holding `src/ui/screens/shell.ts` live
 * (`tools/tmp/snap_hold.mjs --swap src/ui/screens/shell.ts`) with the file reverted to
 * the version that has no listener, and the `button` cell must read SILENT. That is the
 * only run that proves the instrument is measuring the wiring rather than the engine.
 *
 *   node tools/tmp/up_click_audio.mjs --url http://localhost:PORT
 */
import { chromium } from 'playwright';

const a = {};
for (let i = 2; i < process.argv.length; i++) {
  if (process.argv[i].startsWith('--')) a[process.argv[i].slice(2)] = process.argv[i + 1] ?? '1';
}
const URL_BASE = a.url ?? process.env.PREVIEW_BASE ?? 'http://localhost:5173';

/**
 * Energy floor for "a sound happened".
 *
 * `uiClick()` is a 55 ms triangle blip at peak 0.22 plus a 12 ms noise tick, through a
 * 0.62 master trim — so a real one lands two orders of magnitude above this, and a
 * genuinely silent bus reads 0.000000 rather than something small. Measured both ways
 * before this number was chosen; it is a gap, not a threshold.
 */
const SOUND_FLOOR = 0.0004;

const LAUNCH_ARGS = [
  '--use-gl=angle', '--use-angle=swiftshader', '--enable-unsafe-swiftshader',
  '--enable-webgl', '--ignore-gpu-blocklist', '--disable-gpu-sandbox',
  '--autoplay-policy=no-user-gesture-required',
];

const browser = await chromium.launch({ args: LAUNCH_ARGS });
const ctxOpts = { viewport: { width: 1280, height: 800 } };
const context = await browser.newContext(ctxOpts);
const page = await context.newPage();

const errs = [];
page.on('pageerror', (e) => errs.push(String(e)));

// Music OFF before the first script runs: see the header. Volume pinned to 1 so the
// number is not a function of whatever the last run left in this profile.
await page.addInitScript(() => {
  try {
    localStorage.setItem('fa.audio.music', JSON.stringify({ volume: 0, enabled: false }));
    localStorage.setItem('fa.audio.volume', '1');
    localStorage.setItem('fa.audio.muted', '0');
  } catch { /* private mode — the cells will say so */ }
});

/**
 * Navigate, then RE-ARM.
 *
 * ⚠️ A full page load destroys the `AudioContext` and with it the ScriptProcessor tap.
 * The first version of this file installed the tap once on home and then navigated to
 * settings, and both settings cells came back `blocks=0` — no audio blocks captured at
 * all. One of them was expecting SILENT and "passed", which is the tautological-guard
 * failure `docs/LESSONS.md` §13 is about: a cell that cannot observe sound will always
 * agree that there was none. That is why `blocks` is asserted below, and why the unlock
 * gesture and the tap are both re-applied on every navigation.
 */
async function goto(screen) {
  await page.goto(`${URL_BASE}/?screen=${screen}`, { waitUntil: 'load' });
  await page.waitForFunction(
    `window.__screen === ${JSON.stringify(screen)} && window.__screenReady === true`,
    null, { timeout: 60_000 },
  );
  await page.keyboard.press('Shift');
  await page.waitForTimeout(600);
  const t = await installTap();
  if (t.err) throw new Error(`could not re-arm the tap on "${screen}": ${t.err}`);
  await page.waitForTimeout(300);
}

/** Install a continuous master-bus tap that accumulates into a window global. */
async function installTap() {
  return page.evaluate(() => {
    const h = window.__audio;
    if (!h?.engine?.context) return { err: 'no AudioContext' };
    const ctx = h.engine.context;
    const sp = ctx.createScriptProcessor(2048, 2, 1);
    window.__clickTap = { sum: 0, n: 0, peak: 0, blocks: 0 };
    sp.onaudioprocess = (e) => {
      const d = e.inputBuffer.getChannelData(0);
      const t = window.__clickTap;
      for (let i = 0; i < d.length; i++) {
        const v = Math.abs(d[i]);
        if (v > t.peak) t.peak = v;
        t.sum += d[i] * d[i];
        t.n++;
      }
      t.blocks++;
    };
    // A ScriptProcessor only pulls if it is connected to something downstream, and
    // `destination` is the only always-present sink. It contributes nothing audible:
    // `connectTap` branches a COPY of the master output into it.
    sp.connect(ctx.destination);
    const ok = h.connectTap(sp);
    return { err: ok ? null : 'connectTap refused', state: h.stats().state };
  });
}

const resetTap = () => page.evaluate(() => {
  if (window.__clickTap) window.__clickTap = { sum: 0, n: 0, peak: 0, blocks: 0 };
});

const readTap = () => page.evaluate(() => {
  const t = window.__clickTap ?? { sum: 0, n: 1, peak: 0, blocks: 0 };
  const s = window.__audio?.stats?.() ?? {};
  return {
    rms: +Math.sqrt(t.sum / Math.max(1, t.n)).toFixed(6),
    peak: +t.peak.toFixed(6),
    blocks: t.blocks,
    started: s.started ?? null,
    droppedNotRunning: s.droppedNotRunning ?? null,
    muted: s.muted ?? null,
  };
});

const cells = [];
function cell(name, expect, got, detail) {
  const ok = expect === got;
  cells.push({ name, expect, got, ok, detail });
  console.log(`  ${ok ? 'PASS' : 'FAIL'}  ${name.padEnd(16)} expect ${expect.padEnd(6)} got ${got.padEnd(6)}  ${detail}`);
}

/**
 * Click a selector (or a raw x/y for dead space), then read the window around it.
 *
 * `blocks === 0` is reported as **NOTAP**, never as SILENT. A tap that captured no audio
 * blocks has not measured silence — it has not measured anything, and calling that
 * "SILENT" makes every negative cell pass for free. It is a distinct verdict so it can
 * never satisfy an expectation.
 */
async function measure(name, expect, action) {
  await resetTap();
  await action();
  await page.waitForTimeout(700);
  const r = await readTap();
  const got = r.blocks === 0 ? 'NOTAP' : (r.rms > SOUND_FLOOR ? 'SOUND' : 'SILENT');
  cell(name, expect, got,
    `rms=${r.rms} peak=${r.peak} blocks=${r.blocks} started=${r.started} notRunning=${r.droppedNotRunning}`);
  return r;
}

console.log(`\nup_click_audio  ${URL_BASE}`);

// ── HOME ────────────────────────────────────────────────────────────────────
// `goto` unlocks with a keydown (not a click — see the header) and arms the tap.
await goto('home');
const state = await page.evaluate(() => window.__audio?.stats?.().state ?? 'none');
console.log(`  engine state=${state}\n`);

/** A control that exists on home, is a plain <button>, and does not navigate away —
 *  navigation would tear down the tap's page context mid-measurement. */
const HOME_BUTTON = '.fa-root [data-kit="1"]';

await measure('button', 'SOUND', async () => { await page.click(HOME_BUTTON); });

// Dead space: the far top-left of the screen background, chosen because `.fa-bg`,
// `.fa-rays` and `.fa-dots` all live there and none of them is a control.
await measure('dead-space', 'SILENT', async () => { await page.mouse.click(4, 4); });

await page.evaluate(() => window.__audio.engine.setMuted(true));
await page.waitForTimeout(200);
await measure('muted', 'SILENT', async () => { await page.click(HOME_BUTTON); });
await page.evaluate(() => window.__audio.engine.setMuted(false));
await page.waitForTimeout(200);

// ── SETTINGS: the paired negative ───────────────────────────────────────────
// `goto` re-arms the tap; see its header for the run where it did not.
await goto('settings');

await measure('sibling-control', 'SOUND', async () => {
  await page.click('.fa-root [data-toggle="motion"]');
});

// The MUTE toggle carries `data-clicksound="off"`. Measured while UNMUTED, so the only
// thing that can silence it is the suppression itself.
await measure('suppressed', 'SILENT', async () => {
  await page.click('.fa-root [data-toggle="mute"]');
});
// Undo, so the run leaves the engine as it found it.
await page.evaluate(() => window.__audio.engine.setMuted(false));

const bad = cells.filter((c) => !c.ok);
console.log(`\n${cells.length - bad.length}/${cells.length} cells as expected` + (errs.length ? `  (${errs.length} page errors)` : ''));
if (errs.length) console.log(errs.slice(0, 3).join('\n'));
await browser.close();
process.exit(bad.length ? 1 : 0);
