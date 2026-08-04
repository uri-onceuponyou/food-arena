#!/usr/bin/env node
/**
 * Audio verification probe — the instrument for a pillar that cannot be screenshotted.
 *
 * This project's single most expensive recurring failure is code that is wired
 * correctly and produces nothing (true cause eleven times, per `PROGRESS.md`). Audio
 * is even easier to get wrong invisibly than graphics: there is no frame to look at,
 * and "the function was called" is worth exactly nothing.
 *
 * So every claim this probe makes is measured off REAL SAMPLE DATA:
 *
 *   offline   Render every sound in the catalogue through the PRODUCTION master
 *             chain inside an OfflineAudioContext. Measure peak, RMS, the -66 dBFS
 *             tail length, and the spectral centroid. Cross-check each sound's
 *             self-reported duration (which the engine uses to free the voice)
 *             against the sample data.
 *   identity  Assert the three bespoke voices are actually different KINDS of sound,
 *             not the same sound at three EQ settings: Soup's centroid low, Taco's
 *             high, Pizza's throw carrying a real amplitude modulation at the disc's
 *             spin rate (recovered by demodulating the rendered envelope).
 *   negative  Muted renders must be bit-zero. Volume must scale as documented.
 *             Panning must actually move energy between channels.
 *   variation Same seed must render identically; different seeds must differ. A
 *             "variation" system that produces a constant is the invisible failure.
 *   budget    Fire hundreds of events through the real engine and assert the voice
 *             count is capped, never negative, and returns to zero — no leak.
 *   dispatch  Push real `GameEvent` objects through the real `MatchAudio` director
 *             and measure what comes out: every event type that should be audible is,
 *             every one that should not be is bit-zero, panning follows position,
 *             distance attenuates, and the throttles fire.
 *   live      Run the ACTUAL GAME in a browser, tap the master bus post-volume with
 *             an AnalyserNode, and measure the waveform while a real match plays.
 *             This is the only mode that proves the wiring, the autoplay unlock and
 *             the event stream all work together.
 *
 * Usage:  node tools/audio-probe.mjs [--mode all|offline|identity|negative|variation|budget|dispatch|live]
 *         (dev server must be running on :5173)
 */

import { chromium } from 'playwright';

const args = process.argv;
const get = (k, d) => (args.includes(k) ? args[args.indexOf(k) + 1] : d);
const MODE = get('--mode', 'all');
const BASE = get('--base', 'http://localhost:5173');

const LAUNCH_ARGS = [
  '--use-gl=angle',
  '--use-angle=swiftshader',
  '--enable-unsafe-swiftshader',
  '--enable-webgl',
  '--ignore-gpu-blocklist',
  '--disable-gpu-sandbox',
];

let failures = 0;
let checks = 0;
function check(name, ok, detail) {
  checks++;
  if (!ok) failures++;
  console.log(`${ok ? '  ok  ' : ' FAIL '} ${name}${detail ? `   ${detail}` : ''}`);
}
const near = (a, b, tol) => Math.abs(a - b) <= tol;

// ─────────────────────────────────────────────────────────────────────────────
// In-page DSP toolkit. Injected as a string so it lives in one place.
// ─────────────────────────────────────────────────────────────────────────────
const DSP = `
window.__dsp = (() => {
  function fft(re, im) {
    const n = re.length;
    for (let i = 1, j = 0; i < n; i++) {
      let bit = n >> 1;
      for (; j & bit; bit >>= 1) j ^= bit;
      j ^= bit;
      if (i < j) { [re[i], re[j]] = [re[j], re[i]]; [im[i], im[j]] = [im[j], im[i]]; }
    }
    for (let len = 2; len <= n; len <<= 1) {
      const ang = -2 * Math.PI / len;
      const wr = Math.cos(ang), wi = Math.sin(ang);
      for (let i = 0; i < n; i += len) {
        let cr = 1, ci = 0;
        for (let k = 0; k < len / 2; k++) {
          const ur = re[i + k], ui = im[i + k];
          const vr = re[i + k + len / 2] * cr - im[i + k + len / 2] * ci;
          const vi = re[i + k + len / 2] * ci + im[i + k + len / 2] * cr;
          re[i + k] = ur + vr; im[i + k] = ui + vi;
          re[i + k + len / 2] = ur - vr; im[i + k + len / 2] = ui - vi;
          const ncr = cr * wr - ci * wi; ci = cr * wi + ci * wr; cr = ncr;
        }
      }
    }
  }

  function stats(x) {
    let peak = 0, sum = 0;
    for (let i = 0; i < x.length; i++) { const a = Math.abs(x[i]); if (a > peak) peak = a; sum += x[i] * x[i]; }
    return { peak, rms: Math.sqrt(sum / x.length) };
  }

  // -66 dBFS absolute gate. Absolute rather than relative to peak so a quiet sound
  // cannot pass by being measured against its own quietness.
  const GATE = 0.0005;
  function extent(x, sr) {
    let first = -1, last = -1;
    for (let i = 0; i < x.length; i++) if (Math.abs(x[i]) > GATE) { if (first < 0) first = i; last = i; }
    if (first < 0) return { onset: 0, duration: 0 };
    return { onset: first / sr, duration: (last - first + 1) / sr };
  }

  /**
   * ENERGY-WEIGHTED average spectral centroid, computed over 2048-sample frames
   * across the sound's own extent.
   *
   * Not one big windowed FFT. That was the first version and it measured the wrong
   * thing in a way that looked entirely reasonable: a Hann window peaks at the CENTRE
   * of its span, and a percussive sound has decayed to ~2% of peak by the middle of a
   * 186 ms window, so the analysis was weighted onto the quiet tail. Soup's splash
   * therefore measured 3.7 kHz — brighter than Taco's shattering shell — because the
   * only thing left alive at mid-window was its steam.
   *
   * Weighting each frame by its own energy is what a listener does. Frames below 4%
   * of the loudest frame's RMS are ignored outright as tail.
   */
  function centroid(x, sr) {
    const { onset, duration } = extent(x, sr);
    if (duration <= 0) return 0;
    const N = 2048, hop = 1024;
    const start = Math.floor(onset * sr);
    const stop = Math.min(x.length, Math.floor((onset + duration) * sr));
    const frames = [];
    let maxRms = 0;
    for (let p = start; p + N <= stop || p === start; p += hop) {
      const re = new Float64Array(N), im = new Float64Array(N);
      let e = 0;
      for (let i = 0; i < N; i++) {
        const v = p + i < x.length ? x[p + i] : 0;
        e += v * v;
        re[i] = v * (0.5 - 0.5 * Math.cos(2 * Math.PI * i / (N - 1)));
      }
      const rms = Math.sqrt(e / N);
      if (rms > maxRms) maxRms = rms;
      fft(re, im);
      let num = 0, den = 0;
      const loBin = Math.ceil(30 * N / sr), hiBin = Math.floor(16000 * N / sr);
      for (let k = loBin; k <= hiBin; k++) {
        const mag = Math.hypot(re[k], im[k]);
        num += (k * sr / N) * mag; den += mag;
      }
      frames.push({ rms, c: den > 0 ? num / den : 0 });
    }
    let wsum = 0, csum = 0;
    for (const f of frames) {
      if (f.rms < maxRms * 0.04) continue;
      const w = f.rms * f.rms;
      wsum += w; csum += w * f.c;
    }
    return wsum > 0 ? csum / wsum : 0;
  }

  /**
   * Demodulate the amplitude envelope and report (a) the strongest modulation
   * frequency in 5-60 Hz and (b) its MODULATION DEPTH, normalised so a pure sinusoidal
   * tremolo of relative depth d reads back as d. This is how a "spinning plate" is
   * proven to actually spin.
   *
   * Three measurement decisions, each of which was wrong in the first version and
   * each of which produced a plausible-looking but meaningless number:
   *
   *  1. The Hann window spans the DATA, not the zero-padded FFT length. Windowing
   *     across N=1024 when the envelope occupies only the first ~150 samples
   *     multiplies the real signal by the near-zero start of the curve and analyses
   *     mostly silence — that alone reported every Pizza spin rate as ~6 Hz.
   *  2. The trend is removed by DIVISION against a smooth estimate, not subtraction
   *     of a boxcar average. A 40 ms moving average is a comb filter with a null at
   *     exactly 25 Hz, which is the rate one of the three weapons is authored at.
   *     The smoother here is a two-pass one-pole, which has no nulls anywhere.
   *  3. The result is a normalised DEPTH, not a "prominence" ratio against the
   *     spectrum's own median. That ratio is noise-dominated for a short broadband
   *     sound and happily reported 8.4 for a control with no modulation at all.
   */
  function envelopeMod(x, sr) {
    const { onset, duration } = extent(x, sr);
    if (duration <= 0.08) return { hz: 0, depth: 0 };
    // Skip the attack transient and the last of the decay: neither is the flutter.
    const start = Math.floor((onset + 0.03) * sr);
    const end = Math.min(x.length, Math.floor((onset + duration - 0.02) * sr));
    const envRate = 1000;
    const step = sr / envRate;
    const outN = Math.floor((end - start) / step);
    if (outN < 80) return { hz: 0, depth: 0 };

    const win = Math.max(1, Math.round(sr * 0.0015));
    const env = new Float64Array(outN);
    for (let i = 0; i < outN; i++) {
      const c = start + Math.floor(i * step);
      let s = 0, n = 0;
      for (let k = -win; k <= win; k++) { const j = c + k; if (j >= 0 && j < x.length) { s += Math.abs(x[j]); n++; } }
      env[i] = s / Math.max(1, n);
    }
    // Two-pass one-pole smoother (forward then backward = zero phase, no nulls).
    const a = Math.exp(-1 / (0.045 * envRate));
    const sm = new Float64Array(outN);
    let acc = env[0];
    for (let i = 0; i < outN; i++) { acc = a * acc + (1 - a) * env[i]; sm[i] = acc; }
    acc = sm[outN - 1];
    for (let i = outN - 1; i >= 0; i--) { acc = a * acc + (1 - a) * sm[i]; sm[i] = acc; }
    const norm = new Float64Array(outN);
    for (let i = 0; i < outN; i++) norm[i] = sm[i] > 1e-9 ? env[i] / sm[i] - 1 : 0;

    const N = 2048;
    const re = new Float64Array(N), im = new Float64Array(N);
    let wsum = 0;
    for (let i = 0; i < outN && i < N; i++) {
      const w = 0.5 - 0.5 * Math.cos(2 * Math.PI * i / (outN - 1));
      re[i] = norm[i] * w;
      wsum += w;
    }
    fft(re, im);
    // Only search frequencies this window can actually RESOLVE: at least three full
    // cycles must fit. Without this floor the detector reports the residual trend at
    // the very bottom of the band and calls a 0.22 s melee swing "modulated at
    // 5.4 Hz" — a number a 0.17 s window cannot possibly support.
    const minHz = Math.max(8, 3 / (outN / envRate));
    let best = 0, bestHz = 0;
    for (let k = 1; k < N / 2; k++) {
      const hz = k * envRate / N;
      if (hz < minHz || hz > 60) continue;
      const m = Math.hypot(re[k], im[k]);
      if (m > best) { best = m; bestHz = hz; }
    }
    // A real sinusoid of amplitude A windowed with coherent gain wsum splits into
    // two bins of magnitude A*wsum/2, so depth = 2*peak/wsum.
    return { hz: bestHz, depth: (2 * best) / Math.max(1e-9, wsum) };
  }

  function analyse(chans, sr) {
    const mono = new Float64Array(chans[0].length);
    for (let i = 0; i < mono.length; i++) {
      let s = 0; for (const c of chans) s += c[i];
      mono[i] = s / chans.length;
    }
    const st = stats(mono);
    const ex = extent(mono, sr);
    const per = chans.map((c) => stats(c));
    return {
      peak: st.peak, rms: st.rms,
      onset: ex.onset, duration: ex.duration,
      centroid: centroid(mono, sr),
      mod: envelopeMod(mono, sr),
      left: per[0] ? per[0].rms : 0,
      right: per[1] ? per[1].rms : 0,
    };
  }

  return { analyse, stats, extent, centroid, envelopeMod };
})();
`;

// ─────────────────────────────────────────────────────────────────────────────
// Boot
// ─────────────────────────────────────────────────────────────────────────────
async function newPage(browser, url, { extraArgsNote } = {}) {
  const page = await browser.newPage({ viewport: { width: 1000, height: 640 }, deviceScaleFactor: 1 });
  page.on('pageerror', (e) => console.error('PAGEERROR', String(e)));
  page.on('console', (m) => { if (m.type() === 'error') console.error('CONSOLE', m.text()); });
  page.on('framenavigated', (f) => { if (f === page.mainFrame()) console.error('!! PAGE RELOADED mid-probe'); });
  // Other agents are editing this repo live; every save fires a Vite HMR update that
  // full-reloads the app and wipes in-page state halfway through a run.
  await page.route('**/@vite/client*', (r) => r.fulfill({
    status: 200,
    contentType: 'text/javascript',
    body: `const noop=()=>{};
export const createHotContext=()=>({accept:noop,acceptExports:noop,dispose:noop,prune:noop,
  invalidate:noop,on:noop,off:noop,send:noop,decline:noop,data:{}});
export const injectQuery=(u)=>u; export const updateStyle=noop; export const removeStyle=noop;
export const ErrorOverlay=class{}; export default {};`,
  }));
  await page.goto(url, { waitUntil: 'domcontentloaded', timeout: 60000 });
  await page.addScriptTag({ content: DSP });
  return page;
}

/** Install the in-page harness that renders a sound offline through the real chain. */
async function installHarness(page) {
  await page.evaluate(async () => {
    const audio = await import('/src/audio/index.ts');
    const sounds = await import('/src/audio/sounds.ts');
    const weapons = await import('/src/audio/weapons/index.ts');
    const rules = await import('/src/game/rules.ts');
    const director = await import('/src/audio/director.ts');
    window.__A = { audio, sounds, weapons, rules, director };

    /**
     * Render one sound through a REAL AudioEngine on an OfflineAudioContext — same
     * master chain, same limiter, same volume/mute logic, same voice budget as the
     * shipped game. Returns analysis plus the duration the sound reported to the
     * engine, so the two can be cross-checked.
     */
    window.__render = async (makeSound, opt = {}) => {
      const sr = 44100;
      const seconds = opt.seconds ?? 2;
      const ctx = new OfflineAudioContext(2, Math.ceil(sr * seconds), sr);
      const engine = new audio.AudioEngine({ context: ctx, persist: false });
      if (opt.volume !== undefined) engine.setVolume(opt.volume);
      if (opt.muted !== undefined) engine.setMuted(opt.muted);
      let declared = 0;
      const wrapped = (s) => { declared = makeSound(s); return declared; };
      const scheduled = engine.play(wrapped, {
        seed: opt.seed ?? 1234567,
        pan: opt.pan,
        gain: opt.gain,
      });
      const buf = await ctx.startRendering();
      const chans = [buf.getChannelData(0), buf.getChannelData(1)];
      const a = window.__dsp.analyse(chans, sr);
      return { scheduled, declared, ...a, samples: null };
    };

    /**
     * Render a batch of REAL `GameEvent`s through the REAL `MatchAudio` director on
     * an offline engine. This is the dispatch path `game/match.ts` calls every frame,
     * exercised end to end, with the sample data measured at the master bus.
     *
     * The `MatchState` is duck-typed to the fields the director actually reads
     * (`player`/`enemy` x, y, hp, maxHp, characterId, and `elapsed`). Deliberately so:
     * building a full sim state here would drag the arena, three.js and the whole
     * renderer into an audio test for no added coverage — the FULL state path is
     * covered by `--mode live`, which runs the actual game.
     */
    window.__renderEvents = async (events, opt = {}) => {
      const sr = 44100;
      const ctx = new OfflineAudioContext(2, Math.ceil(sr * (opt.seconds ?? 2)), sr);
      const engine = new audio.AudioEngine({ context: ctx, persist: false });
      const md = new director.MatchAudio(engine);
      const state = {
        elapsed: opt.elapsed ?? 1000,
        player: { role: 'player', characterId: opt.playerId ?? 'soup', x: 0, y: 0, hp: opt.playerHp ?? 100, maxHp: 100 },
        enemy: { role: 'enemy', characterId: opt.enemyId ?? 'taco', x: 100, y: 0, hp: 150, maxHp: 150 },
      };
      md.handleEvents(events, state);
      const buf = await ctx.startRendering();
      const a = window.__dsp.analyse([buf.getChannelData(0), buf.getChannelData(1)], sr);
      return { ...a, started: engine.counters.started, dropped: engine.counters.droppedThrottle };
    };

    /** Two batches at two virtual times, to exercise the director's own throttles. */
    window.__renderEventSeq = async (batches) => {
      const sr = 44100;
      const ctx = new OfflineAudioContext(2, Math.ceil(sr * 2), sr);
      const engine = new audio.AudioEngine({ context: ctx, persist: false });
      const md = new director.MatchAudio(engine);
      for (const b of batches) {
        engine.setVirtualTime(b.at);
        md.handleEvents(b.events, {
          elapsed: b.elapsed,
          player: { role: 'player', characterId: 'soup', x: 0, y: 0, hp: 100, maxHp: 100 },
          enemy: { role: 'enemy', characterId: 'taco', x: 100, y: 0, hp: 150, maxHp: 150 },
        });
      }
      const buf = await ctx.startRendering();
      const a = window.__dsp.analyse([buf.getChannelData(0), buf.getChannelData(1)], sr);
      return { ...a, started: engine.counters.started };
    };

    /** Raw channel data, for the bit-exactness comparisons. */
    window.__renderRaw = async (makeSound, opt = {}) => {
      const sr = 44100;
      const ctx = new OfflineAudioContext(1, Math.ceil(sr * (opt.seconds ?? 1.5)), sr);
      const engine = new audio.AudioEngine({ context: ctx, persist: false });
      engine.setVolume(opt.volume ?? 1);
      engine.play(makeSound, { seed: opt.seed ?? 1 });
      const buf = await ctx.startRendering();
      return Array.from(buf.getChannelData(0));
    };
  });
}

// ─────────────────────────────────────────────────────────────────────────────
// Catalogue definition — the acceptance table
// ─────────────────────────────────────────────────────────────────────────────
/**
 * Each entry: how to build the sound in-page, and what must be true of the samples.
 * `centroid` bands are the identity claims; everything else is "this makes a sound
 * of roughly the shape its author said it does".
 */
const CATALOGUE = [
  { id: 'generic.castRanged', expr: `S.castRanged(8)` },
  { id: 'generic.castMelee', expr: `S.castMelee(12, 80)` },
  { id: 'generic.castSelf', expr: `S.castSelf()` },
  { id: 'generic.castGiantSlam', expr: `S.castGiantSlam()`, minPeak: 0.2 },
  { id: 'generic.impact.small', expr: `S.impact(4)` },
  { id: 'generic.impact.big', expr: `S.impact(16)`, minPeak: 0.15 },
  { id: 'generic.hurt', expr: `S.hurt(0.8)` },
  { id: 'generic.hurt.critical', expr: `S.hurt(0.15)` },
  { id: 'generic.death', expr: `S.death()`, minPeak: 0.15 },
  { id: 'generic.heal', expr: `S.heal()` },
  { id: 'generic.fogTick', expr: `S.fogTick()` },
  { id: 'generic.hazardTick', expr: `S.hazardTick()` },
  { id: 'generic.trailTick', expr: `S.trailTick()` },
  { id: 'generic.coverThud', expr: `S.coverThud()` },
  { id: 'generic.countdownTick', expr: `S.countdownTick(3)` },
  { id: 'generic.matchStart', expr: `S.matchStart()` },
  { id: 'generic.matchEnd.win', expr: `S.matchEnd(true)` },
  { id: 'generic.matchEnd.lose', expr: `S.matchEnd(false)` },
  { id: 'generic.uiClick', expr: `S.uiClick()` },
];

/** Build an in-page expression for a bespoke weapon hook. */
function weaponExpr(charId, weaponKey, hook, damage) {
  return `(() => {
    const w = W.rules.CHARACTERS['${charId}'].weapons.find(x => x.key === '${weaponKey}');
    const sfx = W.weapons.getWeaponSfx('${charId}', '${weaponKey}');
    if (!sfx || !sfx.${hook}) throw new Error('no ${hook} hook for ${charId}.${weaponKey}');
    return (s) => sfx.${hook}({ ...s, color: w.color, damage: ${damage ?? 'w.damage'}, weapon: w, characterId: '${charId}' });
  })()`;
}

async function renderById(page, expr, opt = {}) {
  return page.evaluate(
    async ([e, o]) => {
      const S = window.__A.sounds;
      const W = window.__A;
      // eslint-disable-next-line no-eval
      const fn = eval(e);
      return window.__render(fn, o);
    },
    [expr, opt],
  );
}

/**
 * Mean of `n` renders at DIFFERENT seeds.
 *
 * Every sound in this system varies per event by design, and a grain cloud varies
 * structurally — measured spread on Taco's shatter is roughly 2000-3200 Hz of
 * spectral centroid. A threshold checked against one fixed seed is therefore a
 * threshold checked against one lucky draw, and would pass or fail depending on a
 * number nobody chose. Every identity assertion below is made against the mean.
 */
async function renderMean(page, expr, n = 6, opt = {}) {
  const acc = { peak: 0, rms: 0, duration: 0, centroid: 0, modHz: 0, modDepth: 0, onset: 0, left: 0, right: 0 };
  let scheduled = true, declared = 0;
  for (let i = 0; i < n; i++) {
    const r = await renderById(page, expr, { ...opt, seed: 1000 + i * 7919 });
    acc.peak += r.peak; acc.rms += r.rms; acc.duration += r.duration; acc.centroid += r.centroid;
    acc.modHz += r.mod.hz; acc.modDepth += r.mod.depth; acc.onset += r.onset;
    acc.left += r.left; acc.right += r.right;
    scheduled = scheduled && r.scheduled;
    declared = r.declared;
  }
  for (const k of Object.keys(acc)) acc[k] /= n;
  return { ...acc, scheduled, declared, mod: { hz: acc.modHz, depth: acc.modDepth } };
}

// ─────────────────────────────────────────────────────────────────────────────
// Modes
// ─────────────────────────────────────────────────────────────────────────────

async function modeOffline(page) {
  console.log('\n── offline: every sound rendered through the production master chain ──');
  console.log('  id                             peak     rms    dur(s)  declared  centroid');
  const rows = [];
  for (const entry of CATALOGUE) {
    const r = await renderById(page, entry.expr);
    rows.push([entry.id, r]);
    console.log(
      `  ${entry.id.padEnd(28)} ${r.peak.toFixed(4)} ${r.rms.toFixed(5)}  ${r.duration.toFixed(3)}   ${r.declared.toFixed(3)}    ${Math.round(r.centroid)}`,
    );
  }
  for (const [id, r] of rows) {
    const entry = CATALOGUE.find((c) => c.id === id);
    check(`${id}: scheduled`, r.scheduled === true);
    check(`${id}: audible (peak > ${entry.minPeak ?? 0.02})`, r.peak > (entry.minPeak ?? 0.02), `peak=${r.peak.toFixed(4)}`);
    check(`${id}: has energy (rms > 0.001)`, r.rms > 0.001, `rms=${r.rms.toFixed(5)}`);
    check(
      `${id}: measured tail matches declared duration`,
      r.duration > r.declared * 0.3 && r.duration < r.declared + 0.2,
      `measured=${r.duration.toFixed(3)} declared=${r.declared.toFixed(3)}`,
    );
    check(`${id}: starts promptly (onset < 40ms)`, r.onset < 0.04, `onset=${r.onset.toFixed(4)}`);
  }
  return rows;
}

async function modeIdentity(page) {
  console.log('\n── identity: the three bespoke voices must be different KINDS of sound ──');

  const cases = [
    { id: 'soup.Splash.impact', expr: weaponExpr('soup', 'Splash', 'impact', 3) },
    { id: 'soup.Noodle.impact', expr: weaponExpr('soup', 'Noodle', 'impact', 5) },
    { id: 'soup.Dump.impact', expr: weaponExpr('soup', 'Dump', 'impact', 16) },
    { id: 'soup.Splash.cast', expr: weaponExpr('soup', 'Splash', 'cast') },
    { id: 'soup.Noodle.cast', expr: weaponExpr('soup', 'Noodle', 'cast') },
    { id: 'soup.Dump.cast', expr: weaponExpr('soup', 'Dump', 'cast') },
    { id: 'pizza.Dough.cast', expr: weaponExpr('pizza', 'Dough', 'cast') },
    { id: 'pizza.Tomato.cast', expr: weaponExpr('pizza', 'Tomato', 'cast') },
    { id: 'pizza.Cheese.cast', expr: weaponExpr('pizza', 'Cheese', 'cast') },
    { id: 'pizza.Dough.impact', expr: weaponExpr('pizza', 'Dough', 'impact', 5) },
    { id: 'pizza.Tomato.impact', expr: weaponExpr('pizza', 'Tomato', 'impact', 6) },
    { id: 'pizza.Cheese.impact', expr: weaponExpr('pizza', 'Cheese', 'impact', 4) },
    { id: 'taco.Filling.cast', expr: weaponExpr('taco', 'Filling', 'cast') },
    { id: 'taco.Onion.cast', expr: weaponExpr('taco', 'Onion', 'cast') },
    { id: 'taco.Double.cast', expr: weaponExpr('taco', 'Double', 'cast') },
    { id: 'taco.Filling.impact', expr: weaponExpr('taco', 'Filling', 'impact', 12) },
    { id: 'taco.Onion.impact', expr: weaponExpr('taco', 'Onion', 'impact', 7) },
    { id: 'taco.Double.impact', expr: weaponExpr('taco', 'Double', 'impact', 14) },
  ];

  const m = {};
  console.log('  (all figures are the mean of 6 renders at different seeds)');
  console.log('  id                             peak     rms    dur(s)  centroid  modHz  modDepth');
  for (const c of cases) {
    const r = await renderMean(page, c.expr);
    m[c.id] = r;
    console.log(
      `  ${c.id.padEnd(28)} ${r.peak.toFixed(4)} ${r.rms.toFixed(5)}  ${r.duration.toFixed(3)}    ${String(Math.round(r.centroid)).padStart(5)}  ${r.mod.hz.toFixed(1).padStart(5)}    ${r.mod.depth.toFixed(3)}`,
    );
  }

  for (const c of cases) {
    check(`${c.id}: audible`, m[c.id].peak > 0.02 && m[c.id].rms > 0.001,
      `peak=${m[c.id].peak.toFixed(4)} rms=${m[c.id].rms.toFixed(5)}`);
  }

  // Soup is WET: energy collapses downward, so the centroid must be low.
  for (const id of ['soup.Splash.impact', 'soup.Noodle.impact', 'soup.Dump.impact']) {
    check(`${id}: centroid low (< 2000 Hz, wet)`, m[id].centroid < 2000, `${Math.round(m[id].centroid)} Hz`);
  }
  // Taco is BRITTLE: a cloud of tiny high transients, so the centroid must be high.
  // `Filling` sits lowest of the three because it is the one with real meat under the
  // shell — that is the design, and it is why the extremes below are the claim.
  for (const id of ['taco.Filling.impact', 'taco.Onion.impact', 'taco.Double.impact']) {
    check(`${id}: centroid high (> 2200 Hz, brittle)`, m[id].centroid > 2200, `${Math.round(m[id].centroid)} Hz`);
  }
  // Every soup impact must be darker than every taco impact — no overlap at all
  // between the two characters' ranges. This is the claim that the system expresses
  // identity, and it is stronger than any single pair.
  const soupMax = Math.max(...['soup.Splash.impact', 'soup.Noodle.impact', 'soup.Dump.impact'].map((id) => m[id].centroid));
  const tacoMin = Math.min(...['taco.Filling.impact', 'taco.Onion.impact', 'taco.Double.impact'].map((id) => m[id].centroid));
  check('soup and taco impact centroid ranges do not overlap', tacoMin > soupMax,
    `soup max=${Math.round(soupMax)} taco min=${Math.round(tacoMin)}`);
  // And at the extremes of the axis — the wettest weapon against the driest — the
  // separation is more than an octave and a half.
  const wettest = m['soup.Dump.impact'].centroid;
  const driest = m['taco.Onion.impact'].centroid;
  check('wettest vs driest weapon: >2.5x centroid separation', driest / wettest > 2.5,
    `soup.Dump=${Math.round(wettest)} taco.Onion=${Math.round(driest)} ratio=${(driest / wettest).toFixed(2)}x`);

  // Pizza SPINS: real amplitude modulation on the throw, near the authored rate.
  const spinExpect = { 'pizza.Dough.cast': 16, 'pizza.Tomato.cast': 26, 'pizza.Cheese.cast': 12 };
  for (const [id, hz] of Object.entries(spinExpect)) {
    check(`${id}: real amplitude modulation (depth > 0.35)`, m[id].mod.depth > 0.35,
      `depth=${m[id].mod.depth.toFixed(3)} @ ${m[id].mod.hz.toFixed(1)} Hz`);
    check(`${id}: modulation near authored spin rate (~${hz} Hz)`, near(m[id].mod.hz, hz, Math.max(6, hz * 0.4)),
      `measured=${m[id].mod.hz.toFixed(1)} Hz`);
  }
  // Ordering: the disc authored to spin fastest must MEASURE fastest. Frequency
  // resolution on a ~0.4 s sound is ~10 Hz, so absolute rates are approximate, but
  // the ordering is not — and it is what proves the rate is a real parameter rather
  // than one arbitrary flutter reused three times.
  check('spin rate ordering: Tomato (26 Hz) measures faster than Cheese (12 Hz)',
    m['pizza.Tomato.cast'].mod.hz > m['pizza.Cheese.cast'].mod.hz + 5,
    `tomato=${m['pizza.Tomato.cast'].mod.hz.toFixed(1)} cheese=${m['pizza.Cheese.cast'].mod.hz.toFixed(1)}`);

  // Controls: nothing that is NOT a spinning plate may show this modulation, or the
  // measurement is picking up something generic rather than the LFO.
  const ctlDepths = [];
  for (const [label, expr] of [
    ['generic ranged cast', `S.castRanged(8)`],
    ['generic melee cast', `S.castMelee(12, 80)`],
    ['soup Noodle cast', weaponExpr('soup', 'Noodle', 'cast')],
    ['taco Filling cast', weaponExpr('taco', 'Filling', 'cast')],
  ]) {
    const ctl = await renderMean(page, expr);
    ctlDepths.push(ctl.mod.depth);
    check(`control (${label}) shows no spin modulation (depth < 0.25)`, ctl.mod.depth < 0.25,
      `depth=${ctl.mod.depth.toFixed(3)} @ ${ctl.mod.hz.toFixed(1)} Hz`);
  }
  // The margin, stated as a ratio so it cannot quietly erode: filtered noise always
  // wobbles a little, and what matters is that Pizza's flutter is several times any
  // of that residual, not that the residual is zero.
  const pizzaMin = Math.min(...Object.keys(spinExpect).map((id) => m[id].mod.depth));
  const ctlMax = Math.max(...ctlDepths);
  check('pizza spin modulation is >2.5x any control\'s residual', pizzaMin > ctlMax * 2.5,
    `pizza min=${pizzaMin.toFixed(3)} control max=${ctlMax.toFixed(3)} ratio=${(pizzaMin / ctlMax).toFixed(1)}x`);

  // Pizza dough must be the DULLEST impact — the deliberate counterexample.
  check('pizza.Dough.impact is the dullest impact in the game (centroid < 1400 Hz)', m['pizza.Dough.impact'].centroid < 1400,
    `${Math.round(m['pizza.Dough.impact'].centroid)} Hz`);
  return m;
}

async function modeNegative(page) {
  console.log('\n── negative: mute, volume, panning ──');

  const loud = await renderById(page, `S.impact(16)`, { volume: 1 });
  const muted = await renderById(page, `S.impact(16)`, { volume: 1, muted: true });
  check('muted render is bit-zero (peak === 0)', muted.peak === 0, `peak=${muted.peak}`);
  check('muted render has zero RMS', muted.rms === 0, `rms=${muted.rms}`);
  check('unmuted control is loud', loud.peak > 0.1, `peak=${loud.peak.toFixed(4)}`);

  const half = await renderById(page, `S.impact(16)`, { volume: 0.5 });
  const expected = Math.pow(0.5, 1.8);
  const ratio = half.peak / loud.peak;
  check(`volume 0.5 scales by the documented curve (v^1.8 = ${expected.toFixed(3)})`,
    near(ratio, expected, 0.03), `measured ratio=${ratio.toFixed(3)}`);

  const zero = await renderById(page, `S.impact(16)`, { volume: 0 });
  check('volume 0 is silent', zero.peak === 0, `peak=${zero.peak}`);

  const left = await renderById(page, `S.impact(12)`, { pan: -0.78 });
  const right = await renderById(page, `S.impact(12)`, { pan: 0.78 });
  check('pan -0.78 puts energy left', left.left > left.right * 2.5,
    `L=${left.left.toFixed(5)} R=${left.right.toFixed(5)}`);
  check('pan +0.78 puts energy right', right.right > right.left * 2.5,
    `L=${right.left.toFixed(5)} R=${right.right.toFixed(5)}`);

  // The engine must refuse to schedule into a context that is not running — the
  // autoplay guard. Verified directly rather than inferred from the browser's
  // behaviour, which varies by flag.
  const locked = await page.evaluate(async () => {
    const { AudioEngine } = window.__A.audio;
    const e = new AudioEngine({ persist: false }); // no context yet -> state 'idle'
    const before = e.getState();
    const ok = e.play(window.__A.sounds.impact(10));
    return { before, ok, dropped: e.counters.droppedNotRunning };
  });
  check('engine refuses to schedule before unlock', locked.before === 'idle' && locked.ok === false && locked.dropped === 1,
    JSON.stringify(locked));
}

async function modeVariation(page) {
  console.log('\n── variation: repeated sounds must differ, seeded sounds must not ──');
  const res = await page.evaluate(async () => {
    const S = window.__A.sounds;
    const a = await window.__renderRaw(S.impact(10), { seed: 7 });
    const b = await window.__renderRaw(S.impact(10), { seed: 7 });
    const c = await window.__renderRaw(S.impact(10), { seed: 99 });
    const maxDiff = (x, y) => { let m = 0; for (let i = 0; i < x.length; i++) m = Math.max(m, Math.abs(x[i] - y[i])); return m; };
    // Also compare a bespoke grain-cloud sound, where variation is structural
    // (grain positions) rather than a pitch nudge.
    const w = window.__A.rules.CHARACTERS.taco.weapons.find((x) => x.key === 'Filling');
    const sfx = window.__A.weapons.getWeaponSfx('taco', 'Filling');
    const mk = (s) => sfx.impact({ ...s, color: w.color, damage: 12, weapon: w, characterId: 'taco' });
    const t1 = await window.__renderRaw(mk, { seed: 3 });
    const t2 = await window.__renderRaw(mk, { seed: 4 });
    return { sameSeed: maxDiff(a, b), diffSeed: maxDiff(a, c), tacoDiff: maxDiff(t1, t2) };
  });
  // 1 float32 ULP (1.19e-7) of drift is the offline renderer's own arithmetic, not
  // variation — the tolerance is one ULP, five orders of magnitude below the 0.28
  // difference two different seeds actually produce.
  check('same seed renders identically (variation is seeded, not random noise)',
    res.sameSeed < 2e-7, `maxDiff=${res.sameSeed.toExponential(2)}`);
  check('different seeds render differently (variation is REAL, not a constant)',
    res.diffSeed > 0.01, `maxDiff=${res.diffSeed.toFixed(4)}`);
  check('bespoke grain-cloud sound varies structurally between seeds',
    res.tacoDiff > 0.01, `maxDiff=${res.tacoDiff.toFixed(4)}`);
}

async function modeBudget(page) {
  console.log('\n── budget: voice cap, throttle, and no leak after hundreds of events ──');
  const r = await page.evaluate(async () => {
    const { AudioEngine } = window.__A.audio;
    const S = window.__A.sounds;
    const sr = 44100;
    const ctx = new OfflineAudioContext(1, sr * 4, sr);
    const e = new AudioEngine({ context: ctx, persist: false, maxVoices: 20 });

    let maxActive = 0;
    let minActive = 1e9;
    // 400 events across 3 virtual seconds — far more than a real match produces.
    for (let i = 0; i < 400; i++) {
      e.setVirtualTime(i * 0.0075);
      e.play(S.impact(6 + (i % 10)), { key: i % 3 === 0 ? 'impact:test' : undefined });
      const a = e.activeVoices();
      maxActive = Math.max(maxActive, a);
      minActive = Math.min(minActive, a);
    }
    const peakActive = maxActive;
    // Advance past every possible tail and re-check.
    e.setVirtualTime(3 + 5);
    const after = e.activeVoices();
    return {
      peakActive, minActive, after,
      started: e.counters.started,
      droppedBudget: e.counters.droppedBudget,
      droppedThrottle: e.counters.droppedThrottle,
    };
  });
  console.log(`  peakActive=${r.peakActive} after=${r.after} started=${r.started} droppedBudget=${r.droppedBudget} droppedThrottle=${r.droppedThrottle}`);
  check('voice count never exceeds the cap', r.peakActive <= 20, `peak=${r.peakActive}`);
  check('voice count never goes negative', r.minActive >= 0, `min=${r.minActive}`);
  check('ALL voices released after the tails elapse (no leak)', r.after === 0, `active=${r.after}`);
  check('some voices actually played', r.started > 50, `started=${r.started}`);
  check('the retrigger throttle dropped rapid repeats', r.droppedThrottle > 0, `dropped=${r.droppedThrottle}`);
  check('the budget rejected the overflow rather than growing', r.started + r.droppedBudget + r.droppedThrottle === 400,
    `${r.started}+${r.droppedBudget}+${r.droppedThrottle}`);
}

async function modeDispatch(page) {
  console.log('\n── dispatch: real GameEvents through the real director ──');
  const ev = {
    castSoup: { type: 'weapon-fired', fighterRole: 'player', weaponKey: 'Splash' },
    castTaco: { type: 'weapon-fired', fighterRole: 'enemy', weaponKey: 'Filling' },
    hitEnemy: { type: 'hit-landed', targetRole: 'enemy', amount: 12, effect: null, source: { kind: 'weapon', weaponKey: 'Splash', weaponName: 'Soup Splash' }, x: 100, y: 0 },
    hitPlayer: { type: 'hit-landed', targetRole: 'player', amount: 12, effect: null, source: { kind: 'weapon', weaponKey: 'Filling', weaponName: 'Filling Toss' }, x: 0, y: 0 },
    fog: { type: 'hit-landed', targetRole: 'player', amount: 15, effect: null, source: { kind: 'fog' }, x: 0, y: 0 },
    death: { type: 'death', fighterRole: 'enemy' },
    heal: { type: 'heal', fighterRole: 'player', amount: 25 },
    cover: { type: 'projectile-destroyed', id: 1, reason: 'hit-cover', x: 60, y: 0 },
    countdown: { type: 'countdown-tick', value: 3 },
    ended: { type: 'match-ended', winner: 'player' },
    // Deliberately NOT sounded — see director.ts's header.
    splat: { type: 'splat-created', x: 40, y: 0 },
    trailMark: { type: 'trail-mark-created', ownerRole: 'player', x: 20, y: 0 },
    spawned: { type: 'projectile-spawned', id: 2, ownerRole: 'player', weaponKey: 'Splash', x: 5, y: 0, color: '#E8792A', emoji: '💦' },
  };
  const run = (list, opt) => page.evaluate(([l, o]) => window.__renderEvents(l, o), [list, opt ?? {}]);

  const audible = [
    ['weapon-fired (bespoke: soup.Splash)', [ev.castSoup]],
    ['weapon-fired (generic fallback: hamburger.Smash)', [{ type: 'weapon-fired', fighterRole: 'player', weaponKey: 'Smash' }], { playerId: 'hamburger' }],
    ['hit-landed on enemy', [ev.hitEnemy]],
    ['hit-landed on player', [ev.hitPlayer]],
    ['hit-landed from fog', [ev.fog]],
    ['death', [ev.death]],
    ['heal', [ev.heal]],
    ['projectile-destroyed (hit-cover)', [ev.cover]],
    ['countdown-tick', [ev.countdown]],
    ['match-ended', [ev.ended]],
  ];
  const m = {};
  for (const [label, list, opt] of audible) {
    const r = await run(list, opt);
    m[label] = r;
    console.log(`  ${label.padEnd(46)} peak=${r.peak.toFixed(4)} rms=${r.rms.toFixed(5)} voices=${r.started} centroid=${Math.round(r.centroid)}`);
    check(`${label} makes a sound`, r.peak > 0.01 && r.started > 0, `peak=${r.peak.toFixed(4)} voices=${r.started}`);
  }

  const quiet = await run([ev.splat, ev.trailMark, ev.spawned]);
  check('splat/trail-mark/projectile-spawned are deliberately SILENT',
    quiet.peak === 0 && quiet.started === 0, `peak=${quiet.peak} voices=${quiet.started}`);

  // The local player being hit gets an extra `hurt` layer the enemy does not.
  check('being hit yourself is a bigger sound than hitting the enemy',
    m['hit-landed on player'].started > m['hit-landed on enemy'].started,
    `player=${m['hit-landed on player'].started} voices, enemy=${m['hit-landed on enemy'].started}`);

  // Bespoke vs generic must actually diverge. Compared like for like: the SAME event
  // (a 12-damage hit on the enemy) fired by a weapon that has a bespoke voice and by
  // one that does not. If these measured the same, the registry lookup would be
  // silently dead and every weapon would be playing the generic burst — which is
  // exactly the wired-but-produces-nothing failure this whole probe exists for.
  // Averaged over 5 renders each: unlike `--mode identity`, the director seeds every
  // voice randomly (that is the whole point of the per-event variation), so a single
  // render of a grain cloud is noisy by design. Five is enough for the means to
  // separate cleanly while still measuring the real dispatch path.
  const meanCentroid = async (list, opt) => {
    let sum = 0;
    for (let i = 0; i < 5; i++) sum += (await run(list, opt)).centroid;
    return sum / 5;
  };
  const cBespoke = await meanCentroid(
    [{ ...ev.hitEnemy, amount: 7, source: { kind: 'weapon', weaponKey: 'Onion', weaponName: 'Onion Bomb' } }],
    { playerId: 'taco' },
  );
  const cGeneric = await meanCentroid(
    [{ ...ev.hitEnemy, amount: 7, source: { kind: 'weapon', weaponKey: 'Smash', weaponName: 'Patty Smash' } }],
    { playerId: 'hamburger' },
  );
  console.log(`  same 7-dmg hit, n=5: bespoke(taco.Onion) centroid=${Math.round(cBespoke)}  generic(hamburger.Smash) centroid=${Math.round(cGeneric)}`);
  check('bespoke weapon voice diverges from the generic fallback on the same event',
    cBespoke > cGeneric * 2, `bespoke=${Math.round(cBespoke)} generic=${Math.round(cGeneric)}`);

  // Spatialisation: the listener is the player at x=0; the enemy is to the +x side.
  const right = await run([ev.hitEnemy]);
  check('a hit to the player\'s right is panned right', right.right > right.left * 1.4,
    `L=${right.left.toFixed(5)} R=${right.right.toFixed(5)}`);
  const leftHit = await run([{ ...ev.hitEnemy, x: -300 }]);
  check('a hit to the player\'s left is panned left', leftHit.left > leftHit.right * 1.4,
    `L=${leftHit.left.toFixed(5)} R=${leftHit.right.toFixed(5)}`);

  // Distance attenuation.
  const nearHit = await run([{ ...ev.hitEnemy, x: 20 }]);
  const farHit = await run([{ ...ev.hitEnemy, x: 900 }]);
  check('a distant hit is quieter than a near one', farHit.rms < nearHit.rms * 0.8,
    `near rms=${nearHit.rms.toFixed(5)} far rms=${farHit.rms.toFixed(5)}`);

  // Fog throttle: the sim ticks fog every 300 ms; only one in three may be voiced.
  const fogSeq = await page.evaluate(() => window.__renderEventSeq([
    { at: 0, elapsed: 1000, events: [{ type: 'hit-landed', targetRole: 'player', amount: 15, effect: null, source: { kind: 'fog' }, x: 0, y: 0 }] },
    { at: 0.3, elapsed: 1300, events: [{ type: 'hit-landed', targetRole: 'player', amount: 15, effect: null, source: { kind: 'fog' }, x: 0, y: 0 }] },
    { at: 0.6, elapsed: 1600, events: [{ type: 'hit-landed', targetRole: 'player', amount: 15, effect: null, source: { kind: 'fog' }, x: 0, y: 0 }] },
  ]));
  check('three 300 ms fog ticks are throttled to one voice', fogSeq.started === 1, `voices=${fogSeq.started}`);

  // The multi-pellet case. Sushi's Rice Spray fires 5 pellets and Soup's Splash 3;
  // all of them land within a frame or two of each other. The retrigger throttle
  // ducks each repeat rather than dropping it, so the burst keeps its texture while
  // the LEVEL stays close to one fat impact instead of five stacked ones.
  const onePellet = await run([{ ...ev.hitEnemy, amount: 2 }]);
  const pellets = Array.from({ length: 5 }, (_, i) => ({ ...ev.hitEnemy, amount: 2, x: 100 + i }));
  const spray = await run(pellets);
  const ratio = spray.rms / onePellet.rms;
  console.log(`  5-pellet spread: voices=${spray.started} rms x${ratio.toFixed(2)} vs a single pellet (unducked would be ~5x)`);
  check('a 5-pellet spread is ducked, not stacked (< 3.2x one pellet)', ratio < 3.2 && ratio > 1.2,
    `x${ratio.toFixed(2)}`);
  // Past the duck table the repeats are dropped outright.
  const flood = await run(Array.from({ length: 9 }, (_, i) => ({ ...ev.hitEnemy, amount: 2, x: 100 + i })));
  check('repeats beyond the duck table are dropped entirely',
    flood.dropped >= 4 && flood.started === 5, `voices=${flood.started} throttled=${flood.dropped}`);
}

/**
 * The end-to-end check: a REAL match, the REAL wiring, and an AnalyserNode reading
 * the master bus. Everything above proves the sounds exist; only this proves the
 * game plays them.
 */
async function modeLive(browser) {
  console.log('\n── live: real match, master bus tapped with a ScriptProcessorNode ──');
  // simSpeed=3: under SwiftShader the page runs at ~9 fps and `match.ts` clamps dt to
  // 50 ms, so real time advances the sim at less than half speed. At 1x the countdown
  // had not even finished by the end of the run and the probe was measuring a game
  // that had not started.
  const page = await newPage(browser, `${BASE}/?player=soup&enemy=taco&simSpeed=3`);
  await page.waitForFunction('window.__gameReady === true', null, { timeout: 60000 });

  const before = await page.evaluate(() => (window.__audio ? window.__audio.stats() : null));
  check('audio QA handle published by the game', before !== null, JSON.stringify(before));
  check('engine is LOCKED before any user gesture', before && before.state !== 'running', `state=${before && before.state}`);

  // A real, trusted user gesture — exactly what the browser's autoplay policy wants.
  await page.mouse.click(500, 320);
  await page.waitForTimeout(300);
  const unlocked = await page.evaluate(() => window.__audio.stats());
  check('first gesture unlocks the context', unlocked.state === 'running', `state=${unlocked.state}`);
  if (unlocked.state !== 'running') {
    console.log('  (headless audio unavailable — live measurements skipped)');
    await page.close();
    return;
  }

  // Gapless capture: every 2048-sample block of the master output, regardless of
  // frame rate. The processor's own output is muted so it cannot colour anything.
  await page.evaluate(() => {
    const ctx = window.__audio.engine.context;
    const proc = ctx.createScriptProcessor(2048, 1, 1);
    const mute = ctx.createGain();
    mute.gain.value = 0;
    proc.connect(mute).connect(ctx.destination);
    window.__rec = { blocks: [], peak: 0 };
    proc.onaudioprocess = (e) => {
      const d = e.inputBuffer.getChannelData(0);
      let p = 0, s = 0;
      for (let i = 0; i < d.length; i++) { const a = Math.abs(d[i]); if (a > p) p = a; s += d[i] * d[i]; }
      const r = window.__rec;
      if (p > r.peak) r.peak = p;
      if (r.blocks.length < 20000) r.blocks.push(Math.sqrt(s / d.length));
      // Required, or the node contributes nothing and gets optimised into silence.
      e.outputBuffer.getChannelData(0).fill(0);
    };
    window.__audio.connectTap(proc);
    window.__recReset = () => { window.__rec.blocks.length = 0; window.__rec.peak = 0; };
  });

  /** Count discrete sound EVENTS in a block-RMS series, with hysteresis. */
  const countBursts = (blocks, hi = 3e-3, lo = 5e-4) => {
    let n = 0, on = false;
    for (const b of blocks) {
      if (!on && b > hi) { on = true; n++; }
      else if (on && b < lo) on = false;
    }
    return n;
  };

  // ── 1. The countdown. Five ticks plus a START sting, no gameplay required. ──
  await page.waitForTimeout(4500);
  const cd = await page.evaluate(() => ({ peak: window.__rec.peak, blocks: window.__rec.blocks.slice() }));
  const cdBursts = countBursts(cd.blocks);
  const cdLoud = cd.blocks.filter((b) => b > 1e-3).length;
  console.log(`  countdown: peak=${cd.peak.toFixed(4)} bursts=${cdBursts} loudBlocks=${cdLoud}/${cd.blocks.length}`);
  check('countdown produced a real waveform at the master bus', cd.peak > 0.01, `peak=${cd.peak.toFixed(4)}`);
  check('countdown emitted multiple DISCRETE sound events', cdBursts >= 3, `${cdBursts} bursts`);

  // ── 2. Combat. Hold fire and cycle weapons so every Soup slot casts. ──────
  await page.evaluate(() => window.__recReset());
  const canvas = await page.$('canvas');
  const box = await canvas.boundingBox();
  await page.mouse.move(box.x + box.width * 0.72, box.y + box.height * 0.5);
  await page.mouse.down();
  for (const key of ['Digit1', 'Digit2', 'Digit3', 'Digit1']) {
    await page.keyboard.press(key);
    await page.waitForTimeout(1600);
  }
  await page.mouse.up();
  await page.waitForTimeout(400);
  const fight = await page.evaluate(() => ({ peak: window.__rec.peak, blocks: window.__rec.blocks.slice() }));
  const stats = await page.evaluate(() => window.__audio.stats());
  const fightBursts = countBursts(fight.blocks);
  const meanRms = fight.blocks.reduce((a, b) => a + b, 0) / Math.max(1, fight.blocks.length);
  console.log(`  combat: peak=${fight.peak.toFixed(4)} meanRms=${meanRms.toFixed(5)} bursts=${fightBursts} blocks=${fight.blocks.length}`);
  console.log(`  engine: ${JSON.stringify(stats)}`);
  check('live combat produced a real waveform', fight.peak > 0.02, `peak=${fight.peak.toFixed(4)}`);
  check('live combat emitted many discrete sound events', fightBursts >= 8, `${fightBursts} bursts`);
  check('live combat voices were actually started', stats.started > 8, `started=${stats.started}`);
  check('no voice leak during live play', stats.activeVoices <= 20, `active=${stats.activeVoices}`);
  check('nothing was dropped for being locked after unlock', stats.droppedNotRunning <= 1,
    `droppedNotRunning=${stats.droppedNotRunning}`);

  // ── 3. Mute mid-match: the negative assertion on the LIVE bus. ────────────
  await page.evaluate(() => { window.__audio.engine.setMuted(true); });
  await page.waitForTimeout(500); // let the mute ramp and existing tails finish
  await page.evaluate(() => window.__recReset());
  await page.mouse.down();
  await page.waitForTimeout(3000);
  await page.mouse.up();
  const silent = await page.evaluate(() => ({ peak: window.__rec.peak, n: window.__rec.blocks.length }));
  const mutedStats = await page.evaluate(() => window.__audio.stats());
  console.log(`  muted: peak=${silent.peak.toExponential(2)} over ${silent.n} blocks, voices still started=${mutedStats.started}`);
  check('muted live match is bit-silent at the master bus', silent.peak === 0, `peak=${silent.peak.toExponential(2)}`);
  check('mute silences OUTPUT, it does not stop the game producing events',
    mutedStats.started > stats.started, `${stats.started} -> ${mutedStats.started}`);

  // ── 4. Unmute and confirm it comes back (mute must not be a one-way door). ─
  await page.evaluate(() => { window.__audio.engine.setMuted(false); window.__recReset(); });
  await page.mouse.down();
  await page.waitForTimeout(2500);
  await page.mouse.up();
  await page.waitForTimeout(200);
  const back = await page.evaluate(() => ({ peak: window.__rec.peak }));
  console.log(`  unmuted: peak=${back.peak.toFixed(4)}`);
  check('unmuting restores audio', back.peak > 0.01, `peak=${back.peak.toFixed(4)}`);

  // ── 5. The render loop must not have been harmed. ────────────────────────
  const fps = await page.evaluate(async () => {
    let n = 0;
    const t0 = performance.now();
    await new Promise((res) => {
      const tick = () => { n++; if (performance.now() - t0 > 1500) res(); else requestAnimationFrame(tick); };
      requestAnimationFrame(tick);
    });
    return (n * 1000) / (performance.now() - t0);
  });
  console.log(`  frame rate with audio running: ${fps.toFixed(1)} fps (SwiftShader software renderer)`);
  check('render loop still running', fps > 5, `${fps.toFixed(1)} fps`);

  await page.close();
}

// ─────────────────────────────────────────────────────────────────────────────

const browser = await chromium.launch({ args: LAUNCH_ARGS });
try {
  const wantsOffline = ['all', 'offline', 'identity', 'negative', 'variation', 'budget', 'dispatch'].includes(MODE);
  if (wantsOffline) {
    // The home screen: no match, no sim, nothing competing for CPU while rendering.
    const page = await newPage(browser, `${BASE}/?screen=home`);
    await installHarness(page);
    if (MODE === 'all' || MODE === 'offline') await modeOffline(page);
    if (MODE === 'all' || MODE === 'identity') await modeIdentity(page);
    if (MODE === 'all' || MODE === 'negative') await modeNegative(page);
    if (MODE === 'all' || MODE === 'variation') await modeVariation(page);
    if (MODE === 'all' || MODE === 'budget') await modeBudget(page);
    if (MODE === 'all' || MODE === 'dispatch') await modeDispatch(page);
    await page.close();
  }
  if (MODE === 'all' || MODE === 'live') await modeLive(browser);
} finally {
  await browser.close();
}

console.log(`\n${checks - failures}/${checks} checks passed${failures ? `, ${failures} FAILED` : ''}`);
process.exit(failures ? 1 : 0);
