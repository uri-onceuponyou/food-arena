#!/usr/bin/env node
/**
 * THE MIX PROBE — what a player actually hears, as opposed to what one sound measures.
 *
 * ## The gap this exists to close
 *
 * Every audio instrument on this project renders ONE sound in ISOLATION.
 * `audio-probe --mode identity` (77 assertions) proves the sounds are distinguishable
 * FROM EACH OTHER. `--mode depth` (91) proves each one has layer structure. Both are
 * true and neither is what a player hears. A player hears a MIX: a real event stream,
 * through the director's distance and pan gains, through the engine's retrigger throttle
 * and 20-voice budget, summed on one bus, through the shared reverb return and the static
 * soft clip. **A voice can be perfectly layered on its own and mush in the mix, and
 * nothing here had ever measured that.**
 *
 * So this joins the two halves that already existed:
 *   * `tools/tmp/audio_mix_record.mjs` runs the REAL `src/game/sim.ts` and records a real
 *     match's event stream tick by tick;
 *   * the in-page harness replays it through the REAL `MatchAudio` + `AudioEngine` on an
 *     `OfflineAudioContext`, which is the production path.
 *
 * Offline, never a live poll: `docs/LESSONS.md` §10 — "a slow harness fabricates false
 * negatives", and polling an analyser at SwiftShader's frame rate once reported this game
 * as silent.
 *
 * ## The unclipped reference, and why it is exact rather than approximate
 *
 * To price the soft clip you need the signal that WOULD have arrived without it. The
 * chain is `voices -> input -> preClip(1/3) -> softClip -> master`, and the curve is
 * IDENTITY below `CLIP_KNEE` (0.7) by construction. So rendering the identical timeline
 * with `engine.busInput.gain` set to a small `LIN_G` and multiplying the samples back by
 * `1/LIN_G` recovers the pre-clip sum EXACTLY, not approximately — every sample of every
 * arm is under the knee, the reverb return is scaled with everything else because it
 * re-enters at `input`, and the shaper is linear over the whole excursion.
 *
 * That claim is not taken on trust. `--validate` renders known inputs through both arms
 * and checks the recovered value against the closed-form curve. This session has found
 * NINE instruments returning confident wrong answers; two were in this pillar.
 *
 * ## Modes
 *
 *   --validate   Instrument self-test against known inputs. Run this first, always.
 *   --shape      Node only, no browser: the match's SILENCE structure across all 121
 *                matchups — how long the mix is empty, and how concentrated it is.
 *   --mix        The full render. Dynamic range as DELIVERED, spectral spread of the
 *                whole match, per-voice loudness distribution, and the ablations:
 *                does a bespoke impact survive to the output, and by how much.
 *
 * Usage:
 *   node tools/tmp/audio_mix.mjs --validate --url http://localhost:PORT
 *   node tools/tmp/audio_mix.mjs --shape
 *   node tools/tmp/audio_mix.mjs --mix --url http://localhost:PORT [--player pizza --enemy taco]
 */

import { chromium } from 'playwright';
import { spawn } from 'node:child_process';
import { record } from './audio_mix_record.mjs';

const args = process.argv;
const get = (k, d) => (args.includes(k) ? args[args.indexOf(k) + 1] : d);
const has = (k) => args.includes(k);
let BASE = get('--url', 'http://localhost:5173');
const ROOT = new URL('../..', import.meta.url).pathname;

/**
 * Own the frozen snapshot from inside this process.
 *
 * `tools/snapshot.mjs --json` prints its URL and then STAYS ALIVE holding the Vite child,
 * so `URL=$(node tools/snapshot.mjs --json)` never returns — command substitution waits
 * for the process to exit, not for a line. Spawning it as a child of a long-lived probe
 * is the form that actually works, and it also guarantees the server dies with the probe
 * instead of leaking a port per run.
 */
let snapProc = null;
async function startSnapshot() {
  return await new Promise((res, rej) => {
    snapProc = spawn('node', [`${ROOT}tools/snapshot.mjs`, '--json'], { cwd: ROOT, stdio: ['ignore', 'pipe', 'inherit'] });
    let buf = '';
    const timer = setTimeout(() => rej(new Error('snapshot did not print a URL in 180s')), 180000);
    snapProc.stdout.on('data', (d) => {
      buf += String(d);
      const nl = buf.indexOf('\n');
      if (nl < 0) return;
      clearTimeout(timer);
      res(JSON.parse(buf.slice(0, nl)).url);
    });
    snapProc.on('exit', (c) => { clearTimeout(timer); rej(new Error(`snapshot exited ${c}`)); });
  });
}
function stopSnapshot() { if (snapProc) { try { snapProc.kill('SIGTERM'); } catch { /* gone */ } snapProc = null; } }

let failures = 0;
let checks = 0;
function check(name, ok, detail) {
  checks++;
  if (!ok) failures++;
  console.log(`${ok ? '  ok  ' : ' FAIL '} ${name}${detail ? `   ${detail}` : ''}`);
}

const LAUNCH_ARGS = ['--use-gl=angle', '--use-angle=swiftshader', '--enable-unsafe-swiftshader', '--mute-audio'];

const db = (x) => (x > 0 ? 20 * Math.log10(x) : -Infinity);
const fmtDb = (x) => (Number.isFinite(db(x)) ? db(x).toFixed(2) : '-inf');
const pct = (a, f) => {
  if (!a.length) return NaN;
  const s = [...a].sort((x, y) => x - y);
  return s[Math.min(s.length - 1, Math.max(0, Math.round(f * (s.length - 1))))];
};
const mean = (a) => (a.length ? a.reduce((x, y) => x + y, 0) / a.length : NaN);

// ─────────────────────────────────────────────────────────────────────────────
// The in-page harness. Everything numeric is computed in the page; only numbers
// cross the Playwright bridge (a 15 s stereo render is 1.3M floats).
// ─────────────────────────────────────────────────────────────────────────────
const HARNESS = `
window.__MIX = (() => {
  let M = null;
  async function mods() {
    if (M) return M;
    M = {
      audio: await import('/src/audio/index.ts'),
      sounds: await import('/src/audio/sounds.ts'),
      director: await import('/src/audio/director.ts'),
      weapons: await import('/src/audio/weapons/index.ts'),
      pizza: await import('/src/audio/weapons/pizza.ts'),
      engineMod: await import('/src/audio/engine.ts'),
      synth: await import('/src/audio/synth.ts'),
    };
    return M;
  }

  const dec = (v) => (v === '-inf' ? -Infinity : v === '+inf' ? Infinity : v);
  function hydrate(tick) {
    const f = (o) => ({ ...o, status: { stunnedUntil: dec(o.status.stunnedUntil), slowedUntil: dec(o.status.slowedUntil) } });
    return { elapsed: tick.t, phase: tick.phase, safeRadius: tick.safeRadius, player: f(tick.player), enemy: f(tick.enemy) };
  }

  // ── DSP ────────────────────────────────────────────────────────────────────
  function fft(re, im) {
    const n = re.length;
    for (let i = 1, j = 0; i < n; i++) {
      let bit = n >> 1;
      for (; j & bit; bit >>= 1) j ^= bit;
      j ^= bit;
      if (i < j) { [re[i], re[j]] = [re[j], re[i]]; [im[i], im[j]] = [im[j], im[i]]; }
    }
    for (let len = 2; len <= n; len <<= 1) {
      const ang = -2 * Math.PI / len, wr = Math.cos(ang), wi = Math.sin(ang);
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
  function win(x, sr, t0, t1) {
    const a = Math.max(0, Math.floor(t0 * sr)), b = Math.min(x.length, Math.ceil(t1 * sr));
    let peak = 0, e = 0;
    for (let i = a; i < b; i++) { const v = Math.abs(x[i]); if (v > peak) peak = v; e += x[i] * x[i]; }
    return { peak, rms: b > a ? Math.sqrt(e / (b - a)) : 0, n: b - a };
  }
  /** Energy-weighted spectral centroid over a span, 2048-sample frames. Frames under 4%
   * of the loudest frame's RMS are ignored — otherwise a percussive sound's own tail
   * dominates the answer, which is the bug that once measured a splash as brighter than
   * a shattering shell. */
  function centroid(x, sr, t0, t1) {
    const N = 2048, hop = 1024;
    const start = Math.max(0, Math.floor(t0 * sr)), stop = Math.min(x.length, Math.ceil(t1 * sr));
    const frames = []; let maxRms = 0;
    for (let p = start; p + N <= stop || p === start; p += hop) {
      const re = new Float64Array(N), im = new Float64Array(N);
      let e = 0;
      for (let i = 0; i < N; i++) {
        const v = p + i < x.length ? x[p + i] : 0;
        e += v * v;
        re[i] = v * (0.5 - 0.5 * Math.cos(2 * Math.PI * i / (N - 1)));
      }
      const rms = Math.sqrt(e / N); if (rms > maxRms) maxRms = rms;
      fft(re, im);
      let num = 0, den = 0;
      const lo = Math.ceil(30 * N / sr), hi = Math.floor(16000 * N / sr);
      for (let k = lo; k <= hi; k++) { const m = Math.hypot(re[k], im[k]); num += (k * sr / N) * m; den += m; }
      frames.push({ rms, c: den > 0 ? num / den : 0 });
    }
    let w = 0, c = 0;
    for (const f of frames) { if (f.rms < maxRms * 0.04) continue; const ww = f.rms * f.rms; w += ww; c += ww * f.c; }
    return w > 0 ? c / w : 0;
  }
  /** Octave-band energy share of a whole render. Bin selection, no filters: a 2-pole
   * lowpass leaks an octave and once mis-reported a residual by 50 dB. */
  const EDGES = [20, 63, 125, 250, 500, 1000, 2000, 4000, 8000, 16000];
  function bands(x, sr) {
    const N = 8192, hop = 4096;
    const acc = new Float64Array(EDGES.length - 1);
    for (let p = 0; p + N <= x.length; p += hop) {
      const re = new Float64Array(N), im = new Float64Array(N);
      for (let i = 0; i < N; i++) re[i] = x[p + i] * (0.5 - 0.5 * Math.cos(2 * Math.PI * i / (N - 1)));
      fft(re, im);
      for (let k = 1; k < N / 2; k++) {
        const hz = k * sr / N;
        if (hz < EDGES[0] || hz >= EDGES[EDGES.length - 1]) continue;
        let b = 0; while (b < EDGES.length - 2 && hz >= EDGES[b + 1]) b++;
        acc[b] += re[k] * re[k] + im[k] * im[k];
      }
    }
    const tot = acc.reduce((a, b2) => a + b2, 0) || 1;
    return Array.from(acc, (v) => v / tot);
  }
  /**
   * Long-term average spectrum in 1/6-octave bands, 25 Hz - 16 kHz.
   *
   * The octave table answers "is the mix dark". This answers the different question
   * Uri's words actually pose — "one tone, maybe two" — because a NARROW peak is a tone
   * and a broad tilt is not, and an octave-wide bin cannot tell them apart.
   */
  function fineSpectrum(x, sr) {
    const N = 8192, hop = 4096;
    const step = Math.pow(2, 1 / 6);
    const centres = [];
    for (let f = 25; f < 16000; f *= step) centres.push(f);
    const acc = new Float64Array(centres.length);
    let frames = 0;
    for (let p = 0; p + N <= x.length; p += hop) {
      const re = new Float64Array(N), im = new Float64Array(N);
      let e = 0;
      for (let i = 0; i < N; i++) { const v = x[p + i]; e += v * v; re[i] = v * (0.5 - 0.5 * Math.cos(2 * Math.PI * i / (N - 1))); }
      if (Math.sqrt(e / N) < 1e-5) continue; // skip silence: it is not part of the timbre
      frames++;
      fft(re, im);
      for (let b = 0; b < centres.length; b++) {
        const lo = centres[b] / Math.pow(2, 1 / 12), hi = centres[b] * Math.pow(2, 1 / 12);
        const k0 = Math.max(1, Math.ceil(lo * N / sr)), k1 = Math.min(N / 2 - 1, Math.floor(hi * N / sr));
        let sum = 0, cnt = 0;
        for (let k = k0; k <= k1; k++) { sum += re[k] * re[k] + im[k] * im[k]; cnt++; }
        // Energy DENSITY: per-bin, so a wide band does not win just by being wide.
        acc[b] += cnt > 0 ? sum / cnt : 0;
      }
    }
    const peak = Math.max(...acc);
    return { centres, db: Array.from(acc, (v) => (v > 0 && peak > 0 ? 10 * Math.log10(v / peak) : -120)), frames };
  }

  /** Short-term loudness series: 46 ms window, 23 ms hop. */
  function blocks(x, sr) {
    const N = 2048, hop = 1024, out = [];
    for (let p = 0; p + N <= x.length; p += hop) {
      let e = 0; for (let i = 0; i < N; i++) e += x[p + i] * x[p + i];
      out.push(Math.sqrt(e / N));
    }
    return out;
  }

  /**
   * Rewrite a weapon hit so \`director.ts\`'s weapon lookup fails and the GENERIC impact is
   * used instead of the bespoke one. The per-weapon suffix is kept so the retrigger
   * throttle still buckets the arms identically — collapsing every weapon onto one key
   * would change how many voices are dropped and the A/B would measure the throttle.
   */
  function degenerify(ev) {
    if (ev.type !== 'hit-landed' || ev.source.kind !== 'weapon') return ev;
    return { ...ev, source: { ...ev.source, weaponKey: '__generic_' + ev.source.weaponKey + '__' } };
  }

  // ── The render ─────────────────────────────────────────────────────────────
  /**
   * Replay a recorded match through the real director on an offline engine.
   *
   * \`opt.linGain\`  scale \`busInput\` so the soft clip is provably transparent; samples
   *                are multiplied back by 1/linGain, recovering the pre-clip sum exactly.
   * \`opt.dropKeys\` refuse voices whose director key is listed (an ablation arm).
   * \`opt.genericImpacts\` rewrite each weapon hit's \`source.weaponKey\` to a name no
   *                character owns. \`director.ts\` then fails its weapon lookup and falls
   *                through to \`sounds.impact(ev.amount)\` — so this is the bespoke-vs-generic
   *                A/B done entirely in DATA, with no module patched.
   *
   *                It is done this way because patching the registry DOES NOT WORK here and
   *                fails SILENTLY: with a peer saving files, Vite serves \`./pizza\` to
   *                \`weapons/index.ts\` under an HMR \`?t=\` query and serves this harness's
   *                \`import('/src/audio/weapons/pizza.ts')\` unqueried, so the two are
   *                different module instances holding different objects. Measured:
   *                \`getWeaponSfx('pizza','Tomato') === pizzaWeaponSfx.Tomato\` is **false**,
   *                the mutation applies to an object nothing reads, and the A/B reports a
   *                -134 dB difference — the instrument's own noise floor — while looking
   *                entirely successful.
   * Seeds are injected deterministically from a per-voice counter, so two arms differ
   * ONLY by the thing under test. \`opt.randomSeeds\` restores the shipped behaviour.
   */
  async function render(timeline, opt = {}) {
    const m = await mods();
    const sr = opt.sampleRate || 44100;
    const endS = (timeline.ticks[timeline.ticks.length - 1].t / 1000) + (opt.tail ?? 1.5);
    const ctx = new OfflineAudioContext(2, Math.ceil(sr * endS), sr);
    const engine = new m.audio.AudioEngine({ context: ctx, persist: false, reverb: opt.reverb !== false });
    if (opt.volume !== undefined) engine.setVolume(opt.volume);
    const lin = opt.linGain ?? 1;
    if (lin !== 1) engine.busInput.gain.value = lin;

    // ── THE OFFLINE-PRUNE TRAP, and why this override is required ─────────────
    //
    // \`AudioEngine.release()\` silences a finished voice with \`gain.value = 0\` and
    // \`disconnect()\` — correct in a live context, where it runs in WALL CLOCK time long
    // after the sound has been heard. Offline, ALL scheduling happens before
    // \`startRendering()\`, so advancing the virtual clock past a voice's end silences and
    // disconnects it BEFORE A SINGLE SAMPLE OF IT HAS BEEN RENDERED. The first version of
    // this probe measured exactly that: 36 of 49 voices came out below -100 dBFS and only
    // the last ~13 (still alive at the final virtual time) survived. It looked like a
    // shocking result about the mix; it was the instrument erasing the match.
    //
    // The faithful offline analogue is to schedule the mute AT THE TIMELINE MOMENT the
    // release happens, rather than applying it retroactively to the whole render. For a
    // PRUNED voice that moment is at or after its declared end, so the mute is inaudible —
    // as in production. For a STOLEN voice (budget pressure) it is mid-sound, so the steal
    // stays audible and the voice budget keeps behaving exactly as it ships.
    // \`opt.noRelease\` disables it entirely and is the control that prices the truncation.
    let vnow = 0;
    if (!opt.noRelease) {
      engine.release = (v) => {
        const at = Math.max(0, vnow);
        for (const g of [v.node, v.wet]) {
          if (!g) continue;
          try { g.gain.cancelScheduledValues(at); g.gain.setValueAtTime(0, at); } catch { /* gone */ }
        }
      };
    } else {
      engine.release = () => {};
    }

    const voices = [];
    let idx = 0;
    let tickIdx = -1;
    const origPlay = engine.play.bind(engine);
    engine.play = (fn, o = {}) => {
      const key = o.key ?? null;
      if (opt.dropKeys && opt.dropKeys.includes(key)) return false;
      if (opt.soloKey !== undefined && key !== opt.soloKey) return false;
      const rec = {
        i: idx, tick: tickIdx, key,
        gain: o.gain ?? 1, pan: o.pan ?? 0, priority: o.priority ?? 1,
        when: null, dur: 0, scheduled: false,
      };
      const seed = opt.randomSeeds ? undefined : (0x9e3779b9 ^ (idx * 2654435761)) | 0;
      const wrapped = (s) => { rec.when = s.when; const d = fn(s); rec.dur = d; return d; };
      idx++;
      const ok = origPlay(wrapped, seed === undefined ? o : { ...o, seed });
      rec.scheduled = ok;
      voices.push(rec);
      return ok;
    };

    const md = new m.director.MatchAudio(engine);
    for (let i = 0; i < timeline.ticks.length; i++) {
      const tk = timeline.ticks[i];
      tickIdx = i;
      vnow = tk.t / 1000;
      engine.setVirtualTime(vnow);
      md.handleEvents(opt.genericImpacts ? tk.ev.map(degenerify) : tk.ev, hydrate(tk));
    }
    const buf = await ctx.startRendering();

    const L = buf.getChannelData(0), R = buf.getChannelData(1);
    const n = L.length;
    const mono = new Float32Array(n);
    const k = lin !== 1 ? 1 / lin : 1;
    for (let i = 0; i < n; i++) mono[i] = (L[i] + R[i]) * 0.5 * k;
    return { engine, voices, mono, sr, ctx, buffer: buf,
      counters: { ...engine.counters },
      chanPeak: [win(L, sr, 0, n / sr).peak * k, win(R, sr, 0, n / sr).peak * k] };
  }

  /**
   * A 24 dB/oct highpass, applied offline to a whole signal, so "energy above 2 kHz in
   * this 60 ms window" is a thing that can be measured.
   *
   * The octave-band and 1/6-octave instruments above are both FFT-per-frame and neither
   * can answer a question about a window shorter than a frame, which is exactly the
   * question a masking test asks: at the instant of a hit, is the hit above the bed in
   * the band the bed occupies? Two cascaded biquads, coefficients from the RBJ cookbook,
   * and \`hpCal\` below proves the thing actually filters before any number is believed.
   */
  function highpass(x, sr, fc) {
    const w0 = 2 * Math.PI * fc / sr, cw = Math.cos(w0), sw = Math.sin(w0);
    const alpha = sw / (2 * Math.SQRT1_2);
    const b0 = (1 + cw) / 2, b1 = -(1 + cw), b2 = (1 + cw) / 2;
    const a0 = 1 + alpha, a1 = -2 * cw, a2 = 1 - alpha;
    let y = new Float32Array(x);
    for (let stage = 0; stage < 2; stage++) {
      const out = new Float32Array(y.length);
      let x1 = 0, x2 = 0, y1 = 0, y2 = 0;
      for (let i = 0; i < y.length; i++) {
        const v = (b0 / a0) * y[i] + (b1 / a0) * x1 + (b2 / a0) * x2 - (a1 / a0) * y1 - (a2 / a0) * y2;
        x2 = x1; x1 = y[i]; y2 = y1; y1 = v; out[i] = v;
      }
      y = out;
    }
    return y;
  }

  // ── Public API ─────────────────────────────────────────────────────────────
  return {
    mods,
    /** The masking test's own instrument, against inputs whose answer is known. */
    hpCal() {
      const sr = 44100, n = sr;
      const mk = (f) => { const a = new Float32Array(n); for (let i = 0; i < n; i++) a[i] = Math.sin(2 * Math.PI * f * i / sr); return a; };
      const r = (f) => win(highpass(mk(f), sr, 2000), sr, 0.2, 0.8).rms / win(mk(f), sr, 0.2, 0.8).rms;
      return { at250: r(250), at500: r(500), at2000: r(2000), at8000: r(8000) };
    },
    /**
     * DOES THE BED EAT THE HIT? The one question a background layer has to answer.
     *
     * Three arms of the same match: everything, everything-but-the-bed, and the bed
     * alone. Then, inside each weapon impact's own window, the energy above 2 kHz of
     * the hit against the energy above 2 kHz of the bed at that same instant. A bed
     * that is merely QUIET can still mask, because quiet is a broadband statement and
     * masking is a per-band one — and this bed is deliberately the brightest thing in
     * the game, so the assumption "it is 19 dB down, therefore it is under" is exactly
     * the kind of assumption this project has been caught by.
     */
    async ambienceMask(timeline, key = 'ambience') {
      const full = await render(timeline, {});
      const noBed = await render(timeline, { dropKeys: [key] });
      const bedOnly = await render(timeline, { soloKey: key });
      const sr = full.sr;
      const hpHit = highpass(noBed.mono, sr, 2000);
      const hpBed = highpass(bedOnly.mono, sr, 2000);
      const hpFull = highpass(full.mono, sr, 2000);
      const hits = full.voices.filter((v) => v.scheduled && v.when !== null && v.key && v.key.startsWith('impact:'));
      const per = hits.map((v) => {
        const t0 = v.when, t1 = v.when + Math.min(Math.max(v.dur, 0.08), 0.3);
        return { key: v.key, hit: win(hpHit, sr, t0, t1).rms, bed: win(hpBed, sr, t0, t1).rms };
      });
      const dur = full.mono.length / sr;
      return {
        per,
        bedHiRms: win(hpBed, sr, 0, dur).rms,
        fullHiRms: win(hpFull, sr, 0, dur).rms,
        noBedHiRms: win(hpHit, sr, 0, dur).rms,
        bedPeak: win(bedOnly.mono, sr, 0, dur).peak,
        fullPeak: win(full.mono, sr, 0, dur).peak,
        bedBands: bands(bedOnly.mono, sr),
        blocksFull: blocks(full.mono, sr),
        blocksNoBed: blocks(noBed.mono, sr),
        fineFull: fineSpectrum(full.mono, sr),
        fineNoBed: fineSpectrum(noBed.mono, sr),
        bandsFull: bands(full.mono, sr),
        bandsNoBed: bands(noBed.mono, sr),
      };
    },
    /**
     * THE THING URI CAN ACTUALLY JUDGE — the same real match, as a stereo WAV.
     *
     * Every number in this file is a proxy for a listening test that nobody has run.
     * A spectral tilt is not something a person can hear and Uri has said twice that
     * the audio is flat, so the only honest deliverable for an authoring pass is a
     * before/after pair of renders of the SAME event stream, at the same seeds,
     * through the same production chain. Everything else in this probe exists to
     * decide what to change; this exists to prove it changed.
     *
     * Returned as base-64 16-bit interleaved PCM because only numbers and strings
     * cross the Playwright bridge; the Node side writes the 44-byte RIFF header.
     */
    async wav(timeline, opt = {}) {
      const r = await render(timeline, opt);
      // Re-read the rendered buffer's two channels. The render helper returns the
      // summed mono for analysis, so the stereo image — which is half of what a mix
      // IS — has to be taken from the buffer itself.
      const buf = r.buffer;
      const l = buf.getChannelData(0), rr = buf.getChannelData(1);
      const n = l.length;
      const pcm = new Int16Array(n * 2);
      const clamp = (x) => (x > 1 ? 1 : x < -1 ? -1 : x);
      for (let i = 0; i < n; i++) {
        pcm[2 * i] = Math.round(clamp(l[i]) * 32767);
        pcm[2 * i + 1] = Math.round(clamp(rr[i]) * 32767);
      }
      const bytes = new Uint8Array(pcm.buffer);
      let bin = '';
      const CH = 0x8000;
      for (let i = 0; i < bytes.length; i += CH) bin += String.fromCharCode.apply(null, bytes.subarray(i, i + CH));
      return { sr: r.sr, frames: n, b64: btoa(bin), peak: Math.max(...r.chanPeak) };
    },
    /** One arm, analysed. Returns numbers only. */
    async arm(timeline, opt = {}) {
      const r = await render(timeline, opt);
      const { mono, sr, voices } = r;
      const dur = mono.length / sr;
      const scheduled = voices.filter((v) => v.scheduled && v.when !== null);
      // Per-voice window: from onset to the end of its declared duration, capped so a
      // long tail cannot swallow the next event.
      const per = scheduled.map((v) => {
        const t0 = v.when, t1 = v.when + Math.min(Math.max(v.dur, 0.08), 0.45);
        const w = win(mono, sr, t0, t1);
        const overlap = scheduled.some((o) => o !== v && o.when < t1 && o.when + Math.max(o.dur, 0.08) > t0);
        return { i: v.i, key: v.key, gain: v.gain, pan: v.pan, when: v.when, dur: v.dur,
          peak: w.peak, rms: w.rms, cent: centroid(mono, sr, t0, t1), overlap };
      });
      const bl = blocks(mono, sr);
      return {
        sr, dur, counters: r.counters, chanPeak: r.chanPeak,
        nRequested: voices.length, nScheduled: scheduled.length,
        full: win(mono, sr, 0, dur),
        bands: bands(mono, sr),
        fine: fineSpectrum(mono, sr),
        blocks: bl,
        per,
      };
    },
    /**
     * The soft clip's action, measured SAMPLE BY SAMPLE against the exact pre-clip sum.
     *
     * The clip is the only non-linearity in the chain and it is memoryless, so
     * \`prod(t)/linear(t)\` IS its instantaneous gain reduction — no envelope follower, no
     * assumption, and no need to isolate a voice to price it. Reported as the share of
     * signal (not of wall clock: silence is excluded by an absolute floor) that is being
     * reduced, and by how much.
     */
    async clipAction(timeline, opt = {}) {
      const A = await render(timeline, { ...opt });
      const B = await render(timeline, { ...opt, linGain: 0.05 });
      const n = Math.min(A.mono.length, B.mono.length);
      const FLOOR = 10 ** (-60 / 20);
      // ── Why an ENVELOPE and not the raw sample ratio ──────────────────────
      // The first version divided sample by sample and reported a worst-case gain
      // reduction of -85.6 dB, which a curve asymptoting at 1.2 cannot produce. Near a
      // ZERO CROSSING the numerator is ~0 and the ratio is meaningless, and the limiter
      // runs at \`oversample: '2x'\`, whose up/down-sampling filters shift the crossing by
      // a fraction of a sample. A 1 ms peak envelope is immune to both and still resolves
      // the clip, which acts within one cycle.
      const W = Math.round(A.sr * 0.0005);
      const env = (x, i) => {
        let m = 0;
        for (let k = Math.max(0, i - W); k <= Math.min(x.length - 1, i + W); k++) { const v = Math.abs(x[k]); if (v > m) m = v; }
        return m;
      };
      const grs = [];
      let worst = 1, worstAt = 0;
      for (let i = 0; i < n; i += 8) {
        const l = env(B.mono, i);
        if (l < FLOOR) continue;
        const g = env(A.mono, i) / l;
        grs.push(g);
        if (g < worst) { worst = g; worstAt = i / A.sr; }
      }
      grs.sort((a, b) => a - b);
      const q = (f) => (grs.length ? grs[Math.min(grs.length - 1, Math.round(f * (grs.length - 1)))] : 1);
      const share = (thr) => grs.filter((g) => g < thr).length / Math.max(1, grs.length);
      return {
        nSamples: grs.length,
        worst, worstAt,
        p01: q(0.01), p10: q(0.1), p50: q(0.5),
        share05: share(10 ** (-0.5 / 20)), share1: share(10 ** (-1 / 20)), share3: share(10 ** (-3 / 20)),
        peakProd: A.mono.reduce((m, v) => Math.max(m, Math.abs(v)), 0),
        peakLin: B.mono.reduce((m, v) => Math.max(m, Math.abs(v)), 0),
      };
    },
    /**
     * WHERE THE HIGH BAND GOES. Band-limited energy in successive 10 ms windows from a
     * voice's onset, averaged over that voice's occurrences in the match.
     *
     * The octave table says the mix is dark; this says WHEN it is dark. If a hit's high
     * band is present for one window and its low band for twenty, the ear — which
     * integrates over ~100-200 ms — hears the body and nothing else, and the sound reads
     * as a thud however bright its first 7 ms were.
     */
    async bandDecay(timeline, key, opt = {}) {
      const r = await render(timeline, { ...opt, soloKey: key });
      const hits = r.voices.filter((v) => v.scheduled);
      const sr = r.sr;
      const EB = [[20, 500], [500, 2000], [2000, 6000], [6000, 16000]];
      const N = 1024;
      const nWin = 24;
      const acc = EB.map(() => new Float64Array(nWin));
      for (const h of hits) {
        for (let w = 0; w < nWin; w++) {
          const p = Math.floor((h.when + w * 0.01) * sr);
          if (p + N > r.mono.length) break;
          const re = new Float64Array(N), im = new Float64Array(N);
          for (let i = 0; i < N; i++) re[i] = r.mono[p + i] * (0.5 - 0.5 * Math.cos(2 * Math.PI * i / (N - 1)));
          fft(re, im);
          for (let b = 0; b < EB.length; b++) {
            let e = 0;
            const k0 = Math.max(1, Math.ceil(EB[b][0] * N / sr)), k1 = Math.min(N / 2 - 1, Math.floor(EB[b][1] * N / sr));
            for (let k = k0; k <= k1; k++) e += re[k] * re[k] + im[k] * im[k];
            acc[b][w] += e / Math.max(1, hits.length);
          }
        }
      }
      const peak = Math.max(...acc.map((a) => Math.max(...a)));
      return { n: hits.length, bands: EB, db: acc.map((a) => Array.from(a, (v) => (v > 0 ? 10 * Math.log10(v / peak) : -120))) };
    },
    /**
     * How much of a given MOMENT is one voice.
     *
     * Renders the full mix, the mix without \`key\`, and \`key\` alone, then measures energy
     * inside the windows where \`key\` actually fires. That is the question "when I get
     * hit, how much of what I hear is the hurt layer rather than the weapon" — which no
     * isolated render can answer, because it depends on what else is sounding.
     */
    async share(timeline, key, opt = {}) {
      const full = await render(timeline, opt);
      const alone = await render(timeline, { ...opt, dropKeys: null, soloKey: key });
      const without = await render(timeline, { ...opt, dropKeys: [key] });
      const hits = alone.voices.filter((v) => v.scheduled && v.key === key);
      const sr = full.sr;
      let eF = 0, eA = 0, eW = 0, n = 0;
      for (const h of hits) {
        const a = Math.max(0, Math.floor(h.when * sr));
        const b = Math.min(full.mono.length, Math.ceil((h.when + Math.min(Math.max(h.dur, 0.08), 0.45)) * sr));
        for (let i = a; i < b; i++) { eF += full.mono[i] ** 2; eA += alone.mono[i] ** 2; eW += without.mono[i] ** 2; n++; }
      }
      return { n, hits: hits.length, rmsFull: Math.sqrt(eF / n), rmsAlone: Math.sqrt(eA / n), rmsWithout: Math.sqrt(eW / n),
        bandsAlone: bands(alone.mono, sr), bandsWithout: bands(without.mono, sr) };
    },
    /** Two arms rendered back to back, plus their sample-level difference. */
    async ab(timeline, optA, optB) {
      const A = await render(timeline, optA);
      const B = await render(timeline, optB);
      const n = Math.min(A.mono.length, B.mono.length);
      let de = 0, ae = 0, be = 0, dpeak = 0;
      for (let i = 0; i < n; i++) {
        const d = A.mono[i] - B.mono[i];
        de += d * d; ae += A.mono[i] * A.mono[i]; be += B.mono[i] * B.mono[i];
        if (Math.abs(d) > dpeak) dpeak = Math.abs(d);
      }
      return {
        rmsA: Math.sqrt(ae / n), rmsB: Math.sqrt(be / n), rmsDiff: Math.sqrt(de / n), peakDiff: dpeak,
        bandsA: bands(A.mono, A.sr), bandsB: bands(B.mono, B.sr),
        nA: A.voices.filter((v) => v.scheduled).length, nB: B.voices.filter((v) => v.scheduled).length,
      };
    },
    /**
     * The fine-spectrum instrument against a known input: white noise has flat energy
     * DENSITY, so its 1/6-octave slope must be ~0 dB/octave. Anything else means the
     * band integration is weighting by bandwidth and the "the mix is dark" claim would
     * be measuring the instrument.
     */
    async fineCal() {
      const m = await mods();
      const sr = 44100;
      const ctx = new OfflineAudioContext(1, sr * 2, sr);
      const g = ctx.createGain(); g.gain.value = 0.3; g.connect(ctx.destination);
      const src = ctx.createBufferSource(); src.buffer = m.synth.noiseBuffer(ctx);
      src.loop = true; src.connect(g); src.start(0); src.stop(2);
      const buf = await ctx.startRendering();
      return fineSpectrum(buf.getChannelData(0), sr);
    },
    /**
     * Octave-band calibration against two spectra known in closed form: a 1414 Hz sine
     * (all of it in one band) and white noise (equal energy per Hz, so each band holds
     * twice its predecessor and the top octave holds about half the total).
     *
     * 1414 Hz, not 1000: 1000 is exactly a band EDGE, and a Hann main lobe straddling an
     * edge splits 69/31 across two bands. That is the instrument behaving correctly and it
     * would have read as a 31% error. Calibrate at a band's geometric centre.
     */
    async bandCal() {
      const m = await mods();
      const sr = 44100;
      const run = async (make) => {
        const ctx = new OfflineAudioContext(1, sr * 2, sr);
        const g = ctx.createGain(); g.gain.value = 0.3; g.connect(ctx.destination);
        make(ctx, g);
        const buf = await ctx.startRendering();
        return bands(buf.getChannelData(0), sr);
      };
      const sine = await run((ctx, g) => {
        const o = ctx.createOscillator(); o.type = 'sine'; o.frequency.value = 1414;
        o.connect(g); o.start(0); o.stop(2);
      });
      const noise = await run((ctx, g) => {
        const src = ctx.createBufferSource(); src.buffer = m.synth.noiseBuffer(ctx);
        src.loop = true; src.connect(g); src.start(0); src.stop(2);
      });
      return { sine, noise };
    },
    /**
     * Instrument self-test. Schedules a KNOWN sine through the real engine and checks
     * that (1) the window reader recovers its amplitude, (2) the production arm equals
     * the closed-form soft-clip value, and (3) the linear arm recovers the input exactly.
     */
    async validate(opt = {}) {
      const m = await mods();
      const sr = 44100;
      const runOne = async (amp, linGain) => {
        const ctx = new OfflineAudioContext(2, sr * 2, sr);
        const engine = new m.audio.AudioEngine({ context: ctx, persist: false, reverb: false });
        if (linGain !== 1) engine.busInput.gain.value = linGain;
        // A bare sine at a known amplitude, 200 ms, no envelope: the peak IS the amplitude.
        const sound = (s) => {
          const osc = s.ctx.createOscillator();
          osc.type = 'sine'; osc.frequency.value = 1000;
          const g = s.ctx.createGain(); g.gain.value = amp;
          osc.connect(g).connect(s.dest);
          osc.start(s.when); osc.stop(s.when + 0.2);
          return 0.2;
        };
        engine.setVirtualTime(0.5);
        engine.play(sound, { seed: 1 });
        const buf = await ctx.startRendering();
        const L = buf.getChannelData(0);
        const k = linGain !== 1 ? 1 / linGain : 1;
        // Measure in the steady middle of the tone, away from the on/off discontinuity.
        const w = win(L, sr, 0.56, 0.68);
        return w.peak * k;
      };
      const master = m.engineMod.gainForVolume(0.8);
      const KNEE = 0.7, CEIL = 1.2;
      const clip = (a) => (a <= KNEE ? a : KNEE + (CEIL - KNEE) * Math.tanh((a - KNEE) / (CEIL - KNEE)));
      const out = [];
      for (const amp of [0.2, 0.5, 1.0, 1.5, 2.5]) {
        out.push({ amp, master,
          prod: await runOne(amp, 1), prodExpect: clip(amp) * master,
          linear: await runOne(amp, 0.05), linExpect: amp * master });
      }
      return out;
    },
  };
})();
`;

// ─────────────────────────────────────────────────────────────────────────────
/**
 * A blank page on the Vite origin — deliberately NOT the game.
 *
 * `page.goto('/')` boots `main.ts`, three.js, the renderer and every screen, which this
 * probe needs none of: it imports the audio modules directly and renders offline. Booting
 * the app would (a) cost seconds per run, (b) make an audio measurement fail whenever a
 * peer's renderer edit is mid-save, and (c) drag a live `AudioContext` and a `Stage` into
 * a measurement that must contain only the graph under test. Same origin, so
 * `import('/src/audio/…')` still resolves through Vite and gets the real transformed
 * modules.
 */
async function openPage() {
  const browser = await chromium.launch({ args: LAUNCH_ARGS });
  const page = await browser.newPage();
  page.on('pageerror', (e) => console.error('PAGEERROR', e.message));
  page.on('console', (m) => { if (m.type() === 'error') console.error('CONSOLE', m.text()); });
  await page.route('**/__audiomix', (r) => r.fulfill({
    status: 200, contentType: 'text/html', body: '<!doctype html><meta charset="utf-8"><title>audiomix</title><body></body>',
  }));
  // Peers save constantly; a Vite HMR reload mid-render wipes in-page state.
  await page.route('**/@vite/client*', (r) => r.fulfill({
    status: 200, contentType: 'text/javascript',
    body: `const noop=()=>{};export const createHotContext=()=>({accept:noop,acceptExports:noop,dispose:noop,prune:noop,invalidate:noop,on:noop,off:noop,send:noop,decline:noop,data:{}});export const injectQuery=(u)=>u;export const updateStyle=noop;export const removeStyle=noop;export const ErrorOverlay=class{};export default {};`,
  }));
  await page.goto(`${BASE}/__audiomix`, { waitUntil: 'domcontentloaded', timeout: 60000 });
  await page.addScriptTag({ content: HARNESS });
  return { browser, page };
}

// ─────────────────────────────────────────────────────────────────────────────
// --shape : Node only. The match's silence structure. No render needed.
// ─────────────────────────────────────────────────────────────────────────────
async function modeShape() {
  const ROOT = new URL('../..', import.meta.url).pathname;
  const RULES = await import(`${ROOT}src/game/rules.ts`);
  const voicesFor = (ev) => {
    switch (ev.type) {
      case 'countdown-tick': case 'match-started': case 'match-ended':
      case 'weapon-fired': case 'heal': case 'death': return 1;
      case 'projectile-destroyed': return ev.reason === 'hit-cover' ? 1 : 0;
      case 'hit-landed': return 1 + (ev.targetRole === 'player' && ev.source.kind !== 'fog' ? 1 : 0);
      default: return 0;
    }
  };
  const rows = [];
  for (const p of RULES.CHARACTER_IDS) for (const e of RULES.CHARACTER_IDS) {
    const tl = record(p, e, 'smart');
    let startAt = null, endAt = null; const vt = []; let nv = 0;
    for (const t of tl.ticks) for (const ev of t.ev) {
      if (ev.type === 'match-started') startAt = t.t;
      if (ev.type === 'match-ended') endAt = t.t;
      const v = voicesFor(ev);
      if (v > 0 && ev.type !== 'match-started' && ev.type !== 'countdown-tick' && startAt !== null && t.t > startAt) { vt.push(t.t); nv += v; }
    }
    if (startAt === null || endAt === null) continue;
    const play = endAt - startAt;
    const first = vt.length ? vt[0] - startAt : play;
    let gap = first, prev = startAt;
    for (const t of vt) { gap = Math.max(gap, t - prev); prev = t; }
    gap = Math.max(gap, endAt - prev);
    const bins = Math.max(1, Math.ceil(play / 25)); const on = new Uint8Array(bins);
    for (const t of vt) { const s = Math.floor((t - startAt) / 25); for (let i = s; i < Math.min(bins, s + 12); i++) on[i] = 1; }
    rows.push({ p, e, play, first, gap, nv, duty: on.reduce((a, b) => a + b, 0) / bins });
  }
  console.log(`\n══ match SHAPE · ${rows.length} matchups · real sim ══\n`);
  const f = (k) => rows.map((r) => r[k]);
  console.log(`play length                    mean ${(mean(f('play')) / 1000).toFixed(2)}s   median ${(pct(f('play'), 0.5) / 1000).toFixed(2)}s   max ${(pct(f('play'), 1) / 1000).toFixed(2)}s`);
  console.log(`match-start -> 1st combat sound mean ${(mean(f('first')) / 1000).toFixed(2)}s   median ${(pct(f('first'), 0.5) / 1000).toFixed(2)}s   min ${(pct(f('first'), 0) / 1000).toFixed(2)}s   max ${(pct(f('first'), 1) / 1000).toFixed(2)}s`);
  console.log(`  as a fraction of the match    mean ${(mean(rows.map((r) => r.first / r.play)) * 100).toFixed(1)}%`);
  console.log(`longest silent gap in the match mean ${(mean(f('gap')) / 1000).toFixed(2)}s   median ${(pct(f('gap'), 0.5) / 1000).toFixed(2)}s`);
  console.log(`DUTY CYCLE (any voice in 300ms) mean ${(mean(f('duty')) * 100).toFixed(1)}%   median ${(pct(f('duty'), 0.5) * 100).toFixed(1)}%   p90 ${(pct(f('duty'), 0.9) * 100).toFixed(1)}%`);
  console.log(`voices requested per match      mean ${mean(f('nv')).toFixed(1)}`);
  check('the match is silent for more than half its length', mean(rows.map((r) => r.first / r.play)) > 0.5,
    `${(mean(rows.map((r) => r.first / r.play)) * 100).toFixed(1)}% of play is before the first combat sound`);
}

// ─────────────────────────────────────────────────────────────────────────────
async function modeValidate() {
  const { browser, page } = await openPage();
  try {
    const rows = await page.evaluate(() => window.__MIX.validate());
    console.log(`\n══ INSTRUMENT VALIDATION · known inputs through the real chain ══\n`);
    console.log(`  amp    master   prod measured / expected      linear measured / expected`);
    for (const r of rows) {
      console.log(`  ${r.amp.toFixed(2)}   ${r.master.toFixed(4)}   ${r.prod.toFixed(6)} / ${r.prodExpect.toFixed(6)}   ${r.linear.toFixed(6)} / ${r.linExpect.toFixed(6)}`);
    }
    for (const r of rows) {
      check(`prod arm matches the closed-form soft clip @ amp ${r.amp}`,
        Math.abs(r.prod - r.prodExpect) / r.prodExpect < 0.01,
        `${((r.prod / r.prodExpect - 1) * 100).toFixed(2)}% off`);
      check(`linear arm recovers the pre-clip amplitude @ amp ${r.amp}`,
        Math.abs(r.linear - r.linExpect) / r.linExpect < 0.01,
        `${((r.linear / r.linExpect - 1) * 100).toFixed(2)}% off`);
    }
    const big = rows[rows.length - 1];
    check('the two arms genuinely disagree where the clip acts', big.linear / big.prod > 1.5,
      `linear ${big.linear.toFixed(4)} vs prod ${big.prod.toFixed(4)} = ${db(big.linear / big.prod).toFixed(2)} dB of gain reduction`);
    const small = rows[0];
    check('the two arms agree where the clip does not act', Math.abs(small.linear / small.prod - 1) < 0.01,
      `ratio ${(small.linear / small.prod).toFixed(5)}`);

    // Ablation control: dropping a key that never occurs must change nothing at all.
    const tl = record('pizza', 'taco', 'smart');
    const nul = await page.evaluate(async (t) => {
      const r = await window.__MIX.ab(t, {}, { dropKeys: ['impact:nobody.Nothing'] });
      return r;
    }, tl);
    // THE ABLATION NOISE FLOOR. Two renders of the identical timeline are not
    // bit-identical — they differ by ~1 ULP of float32, which is what a 0.5-magnitude
    // sample rounds to. That residual is the instrument's own floor and every ablation
    // result below is only meaningful as a multiple of it, so it is measured and printed
    // rather than assumed to be zero.
    const floorDb = db(nul.rmsDiff / nul.rmsA);
    console.log(`\n  ablation noise floor (drop a key that never occurs): ${floorDb.toFixed(1)} dB rel. to the match RMS`);
    check('the ablation noise floor is below -100 dB', floorDb < -100,
      `${floorDb.toFixed(1)} dB   rmsDiff ${nul.rmsDiff.toExponential(3)}  voices ${nul.nA} vs ${nul.nB}`);
    const real = await page.evaluate(async (t) => window.__MIX.ab(t, {}, { dropKeys: ['hurt'] }), tl);
    check('ablating a key the match DOES use rises far above that floor',
      db(real.rmsDiff / real.rmsA) - floorDb > 60 && real.nB < real.nA,
      `${db(real.rmsDiff / real.rmsA).toFixed(2)} dB vs floor ${floorDb.toFixed(1)} dB   voices ${real.nA} -> ${real.nB}`);

    // ── The offline-prune trap, asserted so it cannot come back ───────────────
    // Every scheduled voice must actually be AUDIBLE in its own window. The first
    // version of this harness let the engine's live-context cleanup silence voices
    // retroactively and 36 of 49 came out below -100 dBFS.
    const arm = await page.evaluate(async (t) => window.__MIX.arm(t, {}), tl);
    const audible = arm.per.filter((p) => p.peak > 10 ** (-60 / 20));
    check('every scheduled voice is audible in its own window',
      audible.length === arm.nScheduled,
      `${audible.length}/${arm.nScheduled} voices above -60 dBFS`);
    const noRel = await page.evaluate(async (t) => window.__MIX.ab(t, {}, { noRelease: true }), tl);
    console.log(`  voice-release truncation costs ${db(noRel.rmsDiff / noRel.rmsA).toFixed(1)} dB rel. to the match RMS`);
    check('the engine\'s voice release is not truncating audible tails',
      db(noRel.rmsDiff / noRel.rmsA) < -20,
      `${db(noRel.rmsDiff / noRel.rmsA).toFixed(2)} dB`);

    // ── Window attribution against known onsets ───────────────────────────────
    // A synthetic timeline whose events sit at times chosen by the test: the per-voice
    // windows must land on them, and nowhere else.
    const synth = await page.evaluate(async () => {
      const mk = (t, ev) => ({ t, phase: 'playing', safeRadius: 900,
        player: { role: 'player', characterId: 'pizza', x: 0, y: 0, hp: 100, maxHp: 100, alive: true, status: { stunnedUntil: '-inf', slowedUntil: '-inf' } },
        enemy: { role: 'enemy', characterId: 'taco', x: 0, y: 0, hp: 100, maxHp: 100, alive: true, status: { stunnedUntil: '-inf', slowedUntil: '-inf' } },
        ev });
      const ticks = [];
      for (let t = 0; t <= 3000; t += 100) {
        ticks.push(mk(t, t === 500 || t === 1500 || t === 2500
          ? [{ type: 'weapon-fired', fighterRole: 'player', weaponKey: 'Tomato' }] : []));
      }
      return window.__MIX.arm({ ticks }, {});
    });
    // The bespoke-vs-generic A/B must be PROVED capable of moving. Its predecessor
    // (patching the sfx registry) failed silently and reported the noise floor.
    const gen = await page.evaluate(async (t) => window.__MIX.ab(t, {}, { genericImpacts: true }), tl);
    check('the bespoke -> generic swap actually changes the render',
      db(gen.rmsDiff / gen.rmsA) - floorDb > 60 && gen.nA === gen.nB,
      `${db(gen.rmsDiff / gen.rmsA).toFixed(2)} dB vs floor ${floorDb.toFixed(1)} dB, voices ${gen.nA} vs ${gen.nB}`);

    // The octave-band instrument, against inputs whose spectrum is known in closed form.
    const bandCal = await page.evaluate(async () => window.__MIX.bandCal());
    console.log(`  band cal · 1414 Hz sine -> ${(bandCal.sine[5] * 100).toFixed(1)}% in 1-2 kHz | white noise -> ${(bandCal.noise[8] * 100).toFixed(1)}% in 8-16 kHz (an octave-per-band sweep of white noise doubles each step; 8-16k should hold ~half)`);
    check('a 1414 Hz sine lands in the 1-2 kHz band', bandCal.sine[5] > 0.97, `${(bandCal.sine[5] * 100).toFixed(2)}%`);
    check('white noise puts ~half its energy in the top octave', bandCal.noise[8] > 0.45 && bandCal.noise[8] < 0.56,
      `${(bandCal.noise[8] * 100).toFixed(2)}%`);

    const fc = await page.evaluate(async () => window.__MIX.fineCal());
    const fcSlope = slopeDbPerOct(fc, 80, 8000);
    check('white noise reads as a 0 dB/octave spectrum', Math.abs(fcSlope) < 0.5,
      `${fcSlope.toFixed(2)} dB/oct (pink would be -3.00)`);

    // The synthetic timeline is `phase: 'playing'` throughout, so `director.ts`'s
    // kitchen bed runs underneath it — which is correct and is exactly what a real
    // match does. Split rather than suppressed: the three CAST onsets are the claim
    // this check has always made, and the bed's own grid becomes a second claim, so
    // the ambience is validated by the instrument that validates everything else.
    const cast = synth.per.filter((p) => p.key !== 'ambience');
    const bed = synth.per.filter((p) => p.key === 'ambience');
    const onsets = cast.map((p) => p.when);
    check('per-voice onsets land where the timeline put them',
      onsets.length === 3 && onsets.every((o, i) => Math.abs(o - [0.5, 1.5, 2.5][i]) < 0.02),
      `onsets ${onsets.map((o) => o.toFixed(3)).join(', ')} s`);
    check('all three synthetic voices are audible', cast.every((p) => p.peak > 1e-3),
      cast.map((p) => fmtDb(p.peak)).join(' / ') + ' dBFS');
    // The bed is re-triggered on a fixed period from the first PLAYING tick, so over a
    // 3 s timeline it must land on 0, 1.5 and 3.0 s and nowhere else.
    const bedOn = bed.map((p) => p.when);
    check('the kitchen bed is re-triggered on its authored period and no other',
      bedOn.length >= 2 && bedOn.every((o, i) => i === 0 || Math.abs((o - bedOn[i - 1]) - 1.5) < 0.02),
      `bed onsets ${bedOn.map((o) => o.toFixed(3)).join(', ')} s`);
    // NON-OVERLAPPING bed voices only, and that qualifier is the whole assertion.
    // A per-voice window is a window on the WHOLE MIX, so the bed chunk that happens to
    // start 8 ms after a cast measures the cast's peak and reads -16.8 dBFS against the
    // two clean chunks' -43. The first version of this check did exactly that and
    // reported the bed as being as loud as the thing it sits behind, which is the
    // opposite of true. Whether the bed masks anything is a per-BAND question answered
    // properly by `--ambience`; this only has to catch a bed left at the wrong level.
    const clean = bed.filter((b) => !b.overlap);
    check('the bed sits well under the events it plays behind',
      clean.length >= 1 && clean.every((b) => b.peak < Math.min(...cast.map((c) => c.peak)) * 0.25),
      `bed ${clean.map((b) => fmtDb(b.peak)).join('/')} vs quietest cast ${fmtDb(Math.min(...cast.map((c) => c.peak)))} dBFS`);
  } finally {
    await browser.close();
  }
}

// ─────────────────────────────────────────────────────────────────────────────
const EDGES = [20, 63, 125, 250, 500, 1000, 2000, 4000, 8000, 16000];

/**
 * Least-squares slope of a 1/6-octave spectrum in dB per OCTAVE, over `lo`..`hi` Hz.
 *
 * The reference this is read against is PINK NOISE, which has -3 dB/octave of energy
 * density and is the conventional "neutral broadband" tilt. White noise is 0 dB/octave
 * and is the instrument's own control (`fineCal`).
 */
function slopeDbPerOct(fine, lo, hi) {
  const xs = [], ys = [];
  for (let i = 0; i < fine.centres.length; i++) {
    if (fine.centres[i] < lo || fine.centres[i] > hi) continue;
    xs.push(Math.log2(fine.centres[i])); ys.push(fine.db[i]);
  }
  const n = xs.length, mx = mean(xs), my = mean(ys);
  let num = 0, den = 0;
  for (let i = 0; i < n; i++) { num += (xs[i] - mx) * (ys[i] - my); den += (xs[i] - mx) ** 2; }
  return num / den;
}

async function modeMix() {
  const P = get('--player', 'pizza');
  const E = get('--enemy', 'taco');
  const { browser, page } = await openPage();
  try {
    const tl = record(P, E, 'smart');
    console.log(`\n══ THE MIX · ${P} vs ${E} · ${tl.ticks.length} ticks · ends ${(tl.endedAt / 1000).toFixed(2)}s ══\n`);
    const prod = await page.evaluate(async (t) => window.__MIX.arm(t, {}), tl);

    console.log(`voices requested ${prod.nRequested}  scheduled ${prod.nScheduled}  dropped: throttle ${prod.counters.droppedThrottle} budget ${prod.counters.droppedBudget}`);
    console.log(`full render      peak ${prod.full.peak.toFixed(4)} (${fmtDb(prod.full.peak)} dBFS)   rms ${prod.full.rms.toFixed(5)}`);

    // ── (a) THE SOFT CLIP, priced against the exact pre-clip sum ─────────────
    const ca = await page.evaluate(async (t) => window.__MIX.clipAction(t, {}), tl);
    console.log(`\n── the SOFT CLIP in a real match (sample-by-sample against the exact pre-clip sum) ──`);
    console.log(`  unclipped peak ${ca.peakLin.toFixed(4)} (${fmtDb(ca.peakLin)} dBFS)   delivered peak ${ca.peakProd.toFixed(4)} (${fmtDb(ca.peakProd)} dBFS)`);
    console.log(`  worst instantaneous gain reduction ${db(ca.worst).toFixed(2)} dB at t=${ca.worstAt.toFixed(2)}s`);
    console.log(`  of the ${ca.nSamples} samples above -60 dBFS:  reduced >0.5 dB ${(ca.share05 * 100).toFixed(1)}%   >1 dB ${(ca.share1 * 100).toFixed(1)}%   >3 dB ${(ca.share3 * 100).toFixed(1)}%`);
    console.log(`  gain reduction  p01 ${db(ca.p01).toFixed(2)}  p10 ${db(ca.p10).toFixed(2)}  median ${db(ca.p50).toFixed(2)} dB`);

    // ── Short-term loudness and duty cycle ───────────────────────────────────
    const loud = prod.blocks.filter((b) => b > 10 ** (-50 / 20));
    console.log(`\n── short-term loudness (46 ms blocks over the whole render) ──`);
    console.log(`  blocks above -50 dBFS: ${loud.length}/${prod.blocks.length} = ${((loud.length / prod.blocks.length) * 100).toFixed(1)}%  (the rest is silence)`);
    console.log(`  of the audible blocks: p10 ${fmtDb(pct(loud, 0.1))}  p50 ${fmtDb(pct(loud, 0.5))}  p90 ${fmtDb(pct(loud, 0.9))} dBFS   spread ${(db(pct(loud, 0.9)) - db(pct(loud, 0.1))).toFixed(2)} dB`);

    // ── Spectral spread of the whole mix ─────────────────────────────────────
    console.log(`\n── octave-band energy of the WHOLE match render ──`);
    let cum = 0;
    for (let i = 0; i < prod.bands.length; i++) {
      cum += prod.bands[i];
      console.log(`  ${String(EDGES[i]).padStart(5)}-${String(EDGES[i + 1]).padEnd(6)} ${(prod.bands[i] * 100).toFixed(2).padStart(6)}%   cumulative ${(cum * 100).toFixed(1)}%`);
    }
    console.log(`  energy below 1 kHz: ${(prod.bands.slice(0, 5).reduce((a, b) => a + b, 0) * 100).toFixed(1)}%`);

    // ── "One tone, maybe two": the long-term average spectrum, 1/6-octave ────
    console.log(`\n── long-term average spectrum of the match, 1/6 octave, energy density rel. to peak ──`);
    const F = prod.fine;
    for (let i = 0; i < F.centres.length; i++) {
      if (F.centres[i] < 40 || F.centres[i] > 12000) continue;
      const v = F.db[i];
      const barN = Math.max(0, Math.round((v + 40) / 1.2));
      console.log(`  ${F.centres[i].toFixed(0).padStart(6)} Hz ${v.toFixed(1).padStart(7)} dB  ${'#'.repeat(barN)}`);
    }
    const within6 = F.db.filter((v, i) => F.centres[i] >= 40 && F.centres[i] <= 12000 && v > -6).length;
    const within12 = F.db.filter((v, i) => F.centres[i] >= 40 && F.centres[i] <= 12000 && v > -12).length;
    const nb = F.db.filter((v, i) => F.centres[i] >= 40 && F.centres[i] <= 12000).length;
    console.log(`  bands within 6 dB of the peak: ${within6}/${nb} = ${(within6 / nb * 100).toFixed(0)}%   within 12 dB: ${within12}/${nb} = ${(within12 / nb * 100).toFixed(0)}%`);
    const sl = slopeDbPerOct(F, 80, 8000);
    const slDry = slopeDbPerOct((await page.evaluate(async (t) => window.__MIX.arm(t, { reverb: false }), tl)).fine, 80, 8000);
    console.log(`  SPECTRAL TILT 80 Hz - 8 kHz: ${sl.toFixed(2)} dB/octave   (white noise 0.00, PINK NOISE -3.00)   dry ${slDry.toFixed(2)}`);

    // ── SOLO renders, one per director key ───────────────────────────────────
    //
    // The per-voice windows in the FULL mix are useless for level and timbre: this
    // match puts 33 of its 49 voices inside a 2.0 s burst, so every window contains
    // every other voice's peak (measured: the "per-voice" p50 came out EXACTLY equal to
    // the whole render's peak). Rendering each key alone, in place, with its real
    // distance gain and pan, is the only way to read a voice's own delivered level —
    // and it makes every occurrence temporally isolated, so within-sound repetition
    // variance becomes measurable too.
    // `null` is a real key: the match-flow sounds (countdown, start, death, end) are
    // scheduled without one, and leaving them out would hide the loudest thing in the game.
    const allKeys = [...new Set(prod.per.map((v) => v.key))];
    const keys = allKeys;
    const label = (k) => k ?? '(match flow)';
    console.log(`\n── SOLO: each director key rendered alone, in place (${keys.length} keys, ${prod.per.length} voices) ──`);
    console.log(`  ${'key'.padEnd(26)} n   delivered peak      unclipped        clip   centroid       repeat spread`);
    const solos = [];
    for (const k of keys) {
      const drop = allKeys.filter((x) => x !== k);
      const [s, sl] = await page.evaluate(async ([t, d]) => [
        await window.__MIX.arm(t, { dropKeys: d }),
        await window.__MIX.arm(t, { dropKeys: d, linGain: 0.05 }),
      ], [tl, drop]);
      const pk = s.per.map((v) => v.peak), lk = sl.per.map((v) => v.peak);
      const ct = s.per.map((v) => v.cent).filter((c) => c > 0);
      const gr = db(pct(pk, 0.5)) - db(pct(lk, 0.5));
      const pkSpread = pk.length > 1 ? db(Math.max(...pk)) - db(Math.min(...pk)) : 0;
      const ctSpread = ct.length > 1 ? (Math.max(...ct) - Math.min(...ct)) / pct(ct, 0.5) : 0;
      solos.push({ k: label(k), n: s.per.length, peak: pct(pk, 0.5), lin: pct(lk, 0.5), gr, cent: pct(ct, 0.5), pkSpread, ctSpread, bands: s.bands });
      console.log(`  ${label(k).padEnd(26)} ${String(s.per.length).padStart(2)}   ${fmtDb(pct(pk, 0.5)).padStart(7)} dBFS   ${fmtDb(pct(lk, 0.5)).padStart(7)} dBFS   ${gr.toFixed(2).padStart(6)} dB   ${(ct.length ? pct(ct, 0.5).toFixed(0) : '—').padStart(6)} Hz   peak ${pkSpread.toFixed(1).padStart(4)} dB / centroid ${(ctSpread * 100).toFixed(1).padStart(4)}%`);
    }
    const dp = solos.map((s) => s.peak), dl = solos.map((s) => s.lin), dc = solos.filter((s) => s.cent > 0).map((s) => s.cent);
    console.log(`\n  AUTHORED spread across the match's vocabulary  ${(db(Math.max(...dl)) - db(Math.min(...dl))).toFixed(2)} dB`);
    console.log(`  DELIVERED spread across the match's vocabulary ${(db(Math.max(...dp)) - db(Math.min(...dp))).toFixed(2)} dB`);
    console.log(`  CENTROID  range ${Math.min(...dc).toFixed(0)}–${Math.max(...dc).toFixed(0)} Hz = ${(Math.log2(Math.max(...dc) / Math.min(...dc))).toFixed(2)} octaves`);
    console.log(`  within-sound repeat spread: peak median ${pct(solos.filter((s) => s.n > 1).map((s) => s.pkSpread), 0.5).toFixed(2)} dB   centroid median ${(pct(solos.filter((s) => s.n > 1).map((s) => s.ctSpread), 0.5) * 100).toFixed(1)}%`);

    // ── Ablation: does a voice survive to the output? ─────────────────────────
    console.log(`\n── ABLATION: how much of each voice survives to the output ──`);
    const abl = [];
    for (const k of ['hurt', ...keys.filter((s) => s && s.startsWith('impact:'))]) {
      const r = await page.evaluate(async ([t, key]) => window.__MIX.ab(t, {}, { dropKeys: [key] }), [tl, k]);
      abl.push({ k, ...r });
      console.log(`  drop ${k.padEnd(26)} voices ${r.nA}->${r.nB}  contribution ${db(r.rmsDiff / r.rmsA).toFixed(2)} dB rel. to the match RMS   peak of the difference ${fmtDb(r.peakDiff)} dBFS`);
    }

    // ── Is a BESPOKE impact distinguishable from the generic one, in the mix? ──
    // The sharpest form of "does the authoring reach the player": swap pizza's bespoke
    // impacts for `sounds.impact(damage)` and diff the whole match render.
    const sub = await page.evaluate(async (t) => window.__MIX.ab(t, {}, { genericImpacts: true }), tl);
    console.log(`\n── BESPOKE vs GENERIC: every weapon impact replaced by the generic catalogue sound ──`);
    console.log(`  whole-match difference ${db(sub.rmsDiff / sub.rmsA).toFixed(2)} dB rel. to the match RMS   peak of the difference ${fmtDb(sub.peakDiff)} dBFS`);
    console.log(`  band shift (bespoke -> generic):`);
    for (let i = 0; i < sub.bandsA.length; i++) {
      console.log(`    ${String(EDGES[i]).padStart(5)}-${String(EDGES[i + 1]).padEnd(6)} ${(sub.bandsA[i] * 100).toFixed(2).padStart(6)}% -> ${(sub.bandsB[i] * 100).toFixed(2).padStart(6)}%`);
    }

    // ── WHERE THE HIGH BAND GOES, per 10 ms, for the hits ────────────────────
    console.log(`\n── band energy per 10 ms from onset (dB rel. to the loudest band-window) ──`);
    for (const k of ['impact:' + P + '.Tomato', 'impact:' + P + '.Dough', 'hurt'].filter((k) => allKeys.includes(k))) {
      const bd = await page.evaluate(async ([t, key]) => window.__MIX.bandDecay(t, key), [tl, k]);
      console.log(`  ${k}  (${bd.n} occurrences)`);
      for (let b = 0; b < bd.bands.length; b++) {
        const row = bd.db[b].slice(0, 20).map((v) => (v > -70 ? v.toFixed(0).padStart(4) : '   .')).join('');
        console.log(`    ${String(bd.bands[b][0]).padStart(5)}-${String(bd.bands[b][1]).padEnd(5)} Hz ${row}`);
      }
      const hi = bd.db[2], lo = bd.db[0];
      const life = (a) => { let n = 0; for (const v of a) if (v > a[0] - 20 && v > -70) n++; else break; return n * 10; };
      console.log(`    LIFETIME within 20 dB of its own start:  20-500 Hz ${life(lo)} ms   2-6 kHz ${life(hi)} ms`);
    }

    // ── (b) hurt(): the most-repeated sound, and the only one with no variation ──
    const sh = await page.evaluate(async (t) => window.__MIX.share(t, 'hurt'), tl);
    console.log(`\n── WHEN THE PLAYER IS HIT: how much of the moment is generic.hurt() ──`);
    console.log(`  ${sh.hits} hurt voices, ${(sh.n / prod.sr * 1000).toFixed(0)} ms of match inside their windows`);
    console.log(`  the whole moment      ${fmtDb(sh.rmsFull)} dBFS rms`);
    console.log(`  hurt alone            ${fmtDb(sh.rmsAlone)} dBFS rms  = ${((sh.rmsAlone ** 2 / sh.rmsFull ** 2) * 100).toFixed(1)}% of the moment's ENERGY`);
    console.log(`  everything but hurt   ${fmtDb(sh.rmsWithout)} dBFS rms`);
    console.log(`  removing hurt costs the moment ${(db(sh.rmsWithout) - db(sh.rmsFull)).toFixed(2)} dB`);

    // ── The room: is the low-frequency dominance the sounds, or the reverb? ──
    const dry = await page.evaluate(async (t) => window.__MIX.arm(t, { reverb: false }), tl);
    console.log(`\n── the ROOM's share of the spectrum (same match, reverb bus off) ──`);
    for (let i = 0; i < prod.bands.length; i++) {
      console.log(`  ${String(EDGES[i]).padStart(5)}-${String(EDGES[i + 1]).padEnd(6)} wet ${(prod.bands[i] * 100).toFixed(2).padStart(6)}%   dry ${(dry.bands[i] * 100).toFixed(2).padStart(6)}%`);
    }
    console.log(`  energy below 1 kHz:  wet ${(prod.bands.slice(0, 5).reduce((a, b) => a + b, 0) * 100).toFixed(1)}%   dry ${(dry.bands.slice(0, 5).reduce((a, b) => a + b, 0) * 100).toFixed(1)}%`);

    check('every scheduled voice reaches the output', prod.per.filter((v) => v.peak > 1e-3).length === prod.nScheduled,
      `${prod.per.filter((v) => v.peak > 1e-3).length}/${prod.nScheduled}`);
    check('at least one bespoke impact contributes measurably to the mix',
      abl.some((a) => a.k.startsWith('impact:') && db(a.rmsDiff / a.rmsA) > -30), '');
  } finally {
    await browser.close();
  }
}

// ─────────────────────────────────────────────────────────────────────────────
/**
 * The headline numbers across several matchups, so nothing above is a pizza-vs-taco
 * artefact. One production render and one unclipped render per matchup.
 */
/**
 * WHICH KEYS OWN THE TILT — the measurement that has to come before any authoring.
 *
 * The roster-wide top-end pass raised every bespoke impact's spectral centroid by
 * 15-90% and moved the match's long-term tilt by 0.15 dB/octave. That is not a
 * contradiction and it is not a failure of the pass: a long-term average spectrum is
 * energy-weighted over the WHOLE render, the mix's duty cycle is 21.9%, and the loudest
 * things in a match are not the hits. Guessing which key is holding the spectrum down
 * would be exactly the "probe before you loop" failure this project keeps paying for
 * (`docs/LESSONS.md` section 2), so this drops one director key at a time and reports
 * what the tilt does without it.
 *
 * Read it as: a key whose removal makes the mix BRIGHTER (tilt rises toward 0) is a key
 * that is holding the mix dark, and the size of that rise is its share of the problem.
 */
async function modeTilt() {
  const P = get('--player', 'pizza');
  const E = get('--enemy', 'taco');
  const { browser, page } = await openPage();
  try {
    const tl = record(P, E, 'smart');
    const prod = await page.evaluate(async (t) => window.__MIX.arm(t, {}), tl);
    const base = slopeDbPerOct(prod.fine, 80, 8000);
    const allKeys = [...new Set(prod.per.map((v) => v.key))];
    console.log(`\n══ TILT ATTRIBUTION · ${P} vs ${E} · ${prod.per.length} voices, ${allKeys.length} keys ══\n`);
    console.log(`  whole mix tilt ${base.toFixed(2)} dB/oct   energy below 1 kHz ${(prod.bands.slice(0, 5).reduce((a, b) => a + b, 0) * 100).toFixed(1)}%`);
    console.log(`\n  ${'drop this key'.padEnd(26)} n   tilt without it   change   500-1k band   its own centroid`);
    const rows = [];
    for (const k of allKeys) {
      const a = await page.evaluate(async ([t, d]) => window.__MIX.arm(t, { dropKeys: [d] }), [tl, k]);
      // `dropKeys: d`, NOT `[d]`. The first version wrapped the already-array in
      // another array, so `dropKeys.includes(key)` was false for every key, every solo
      // arm was the FULL mix, and the table printed the same 49 voices and the same
      // 3033 Hz on all sixteen rows — a confident, uniform, completely wrong answer.
      // The n column below is what caught it and it is asserted at the end of the mode.
      const solo = await page.evaluate(async ([t, d]) => window.__MIX.arm(t, { dropKeys: d }),
        [tl, allKeys.filter((x) => x !== k)]);
      const tilt = slopeDbPerOct(a.fine, 80, 8000);
      const ct = solo.per.map((v) => v.cent).filter((c) => c > 0);
      rows.push({ k, n: solo.per.length, tilt, d: tilt - base, b: solo.bands[4], cent: pct(ct, 0.5) });
    }
    rows.sort((x, y) => y.d - x.d);
    for (const r of rows) {
      console.log(`  ${String(r.k ?? '(match flow)').padEnd(26)} ${String(r.n).padStart(2)}   ${r.tilt.toFixed(2).padStart(9)} dB/oct  ${(r.d >= 0 ? '+' : '') + r.d.toFixed(2)}   ${(r.b * 100).toFixed(1).padStart(9)}%   ${(ctOrDash(r.cent)).padStart(8)}`);
    }
    console.log(`\n  (a POSITIVE change means the mix got brighter without that key — it was holding the spectrum down)`);
    // The instrument checking itself against a known input: the solo arms partition the
    // mix, so their voice counts must sum to exactly the whole. This is the assertion
    // that would have caught `dropKeys: [d]` in the first run instead of the third.
    const summed = rows.reduce((a, r) => a + r.n, 0);
    check('the solo arms partition the mix (voice counts sum to the whole)',
      summed === prod.per.length, `${summed} vs ${prod.per.length}`);
  } finally { await browser.close(); }
}
const ctOrDash = (c) => (Number.isFinite(c) && c > 0 ? `${Math.round(c)} Hz` : '—');

/**
 * THE AMBIENCE BED, priced against the mix it has to sit inside.
 *
 * Two things have to be true at once and they pull in opposite directions: the bed must
 * fill a match that is silent 70% of its length, and it must not eat the top three
 * octaves the roster pass exists to create. "Quiet enough" does not settle that —
 * masking is per band, and this bed is deliberately the brightest object in the game.
 */
async function modeAmbience() {
  const pairs = String(get('--matchups', 'pizza:taco,hamburger:sushi,soup:donut'))
    .split(',').map((x) => x.split(':'));
  const { browser, page } = await openPage();
  try {
    const cal = await page.evaluate(async () => window.__MIX.hpCal());
    console.log(`\n══ THE KITCHEN BED · ${pairs.length} matchups ══\n`);
    console.log(`  masking filter calibration (2 kHz highpass, 24 dB/oct): 250 Hz ${db(cal.at250).toFixed(1)} dB · 500 Hz ${db(cal.at500).toFixed(1)} dB · 2 kHz ${db(cal.at2000).toFixed(1)} dB · 8 kHz ${db(cal.at8000).toFixed(1)} dB`);
    check('the masking filter rejects the low band', db(cal.at250) < -30, `${db(cal.at250).toFixed(1)} dB at 250 Hz`);
    check('the masking filter passes the high band', Math.abs(db(cal.at8000)) < 1.5, `${db(cal.at8000).toFixed(1)} dB at 8 kHz`);
    // -6 dB, not -3: this is TWO cascaded Butterworth sections, so each contributes its
    // own -3 dB at the shared corner. The first version of this assertion asked for -3
    // and failed a filter that was behaving exactly as specified — the same shape as the
    // 1 kHz sine that was fed to the octave-band calibrator and read as a 31% error
    // because 1 kHz is a band EDGE. Calibrate against what the design says, not against
    // the number that comes to mind.
    check('the masking filter is -6 dB at its corner (two cascaded sections)',
      Math.abs(db(cal.at2000) + 6) < 1, `${db(cal.at2000).toFixed(2)} dB at 2 kHz`);

    const acc = [];
    for (const [P, E] of pairs) {
      const tl = record(P, E, 'smart');
      const r = await page.evaluate(async (t) => window.__MIX.ambienceMask(t), tl);
      const dutyF = r.blocksFull.filter((b) => b > 10 ** (-50 / 20)).length / r.blocksFull.length;
      const dutyN = r.blocksNoBed.filter((b) => b > 10 ** (-50 / 20)).length / r.blocksNoBed.length;
      const tF = slopeDbPerOct(r.fineFull, 80, 8000), tN = slopeDbPerOct(r.fineNoBed, 80, 8000);
      const margins = r.per.map((p) => db(p.hit / p.bed));
      console.log(`\n  ── ${P} vs ${E} ──`);
      console.log(`  duty cycle            ${(dutyN * 100).toFixed(1)}% without the bed  ->  ${(dutyF * 100).toFixed(1)}% with it`);
      console.log(`  spectral tilt         ${tN.toFixed(2)} dB/oct without  ->  ${tF.toFixed(2)} dB/oct with`);
      console.log(`  bed peak              ${fmtDb(r.bedPeak)} dBFS, against a match peak of ${fmtDb(r.fullPeak)} dBFS  (${(db(r.fullPeak) - db(r.bedPeak)).toFixed(1)} dB under)`);
      console.log(`  above 2 kHz, whole match: bed ${fmtDb(r.bedHiRms)} dBFS rms · everything else ${fmtDb(r.noBedHiRms)} dBFS rms`);
      console.log(`  AT EACH HIT, above 2 kHz: the hit is this far above the bed —`);
      console.log(`     min ${Math.min(...margins).toFixed(1)} dB   p10 ${pct(margins, 0.1).toFixed(1)} dB   median ${pct(margins, 0.5).toFixed(1)} dB   max ${Math.max(...margins).toFixed(1)} dB   (n=${margins.length})`);
      console.log(`  bed's own octave shares: ` + r.bedBands.map((b, i) => `${EDGES[i]}-${EDGES[i + 1]} ${(b * 100).toFixed(0)}%`).join(' · '));
      acc.push({ P, E, dutyF, dutyN, tF, tN, margins, r });
    }
    const allMargins = acc.flatMap((a) => a.margins);
    console.log(`\n  ACROSS ALL MATCHUPS   duty ${(mean(acc.map((a) => a.dutyN)) * 100).toFixed(1)}% -> ${(mean(acc.map((a) => a.dutyF)) * 100).toFixed(1)}%   tilt ${mean(acc.map((a) => a.tN)).toFixed(2)} -> ${mean(acc.map((a) => a.tF)).toFixed(2)} dB/oct   hit-over-bed above 2 kHz: median ${pct(allMargins, 0.5).toFixed(1)} dB, worst ${Math.min(...allMargins).toFixed(1)} dB`);

    // 6 dB is one doubling of amplitude and is the conventional floor for "this is
    // foreground and that is background". It is asserted on the p10 rather than the
    // minimum because the quietest hit in a match is a 2-damage Rice Spray tick landing
    // at maximum range through the distance attenuation, and a bed you can hear behind
    // THAT is a bed doing its job.
    // 12 dB is four times the amplitude and is the conventional line between foreground
    // and background; 6 dB is one doubling and is the floor below which two things are
    // simply both there. The p10 rather than the minimum, because the quietest hit in a
    // match is a 2-damage tick landing at maximum range through the distance
    // attenuation, and a room you can still hear behind THAT is a room doing its job.
    check('every matchup: the median hit sits at least 12 dB above the bed above 2 kHz',
      acc.every((a) => pct(a.margins, 0.5) > 12), `worst median ${Math.min(...acc.map((a) => pct(a.margins, 0.5))).toFixed(1)} dB`);
    check('90% of hits clear the bed by at least 6 dB above 2 kHz',
      acc.every((a) => pct(a.margins, 0.1) > 6), `worst p10 ${Math.min(...acc.map((a) => pct(a.margins, 0.1))).toFixed(1)} dB`);
    check('the bed more than doubles the share of the match that is not silence',
      acc.every((a) => a.dutyF > a.dutyN * 2), `${acc.map((a) => `${(a.dutyN * 100).toFixed(0)}->${(a.dutyF * 100).toFixed(0)}%`).join(', ')}`);
    check('the bed is at least 15 dB under the match peak in every matchup',
      acc.every((a) => db(a.r.fullPeak) - db(a.r.bedPeak) > 15),
      `worst ${Math.min(...acc.map((a) => db(a.r.fullPeak) - db(a.r.bedPeak))).toFixed(1)} dB`);
  } finally { await browser.close(); }
}

/** RIFF/WAVE header for 16-bit stereo PCM. */
function wavHeader(frames, sr) {
  const b = Buffer.alloc(44);
  const dataBytes = frames * 4;
  b.write('RIFF', 0); b.writeUInt32LE(36 + dataBytes, 4); b.write('WAVE', 8);
  b.write('fmt ', 12); b.writeUInt32LE(16, 16); b.writeUInt16LE(1, 20); b.writeUInt16LE(2, 22);
  b.writeUInt32LE(sr, 24); b.writeUInt32LE(sr * 4, 28); b.writeUInt16LE(4, 32); b.writeUInt16LE(16, 34);
  b.write('data', 36); b.writeUInt32LE(dataBytes, 40);
  return b;
}

/**
 * Render one real match to a stereo WAV on disk. `--wav <path>`.
 *
 * `--matchups a:b,c:d` renders several and suffixes each file, so a listening test can
 * be a whole roster rather than one pair.
 */
async function modeWav() {
  const out = get('--wav', 'shots/audio/match.wav');
  const pairs = String(get('--matchups', `${get('--player', 'pizza')}:${get('--enemy', 'taco')}`))
    .split(',').map((x) => x.split(':'));
  const fs = await import('node:fs');
  const path = await import('node:path');
  const { browser, page } = await openPage();
  try {
    for (const [P, E] of pairs) {
      const tl = record(P, E, 'smart');
      const w = await page.evaluate(async (t) => window.__MIX.wav(t, {}), tl);
      const pcm = Buffer.from(w.b64, 'base64');
      const file = pairs.length > 1
        ? out.replace(/\.wav$/, '') + `-${P}-vs-${E}.wav`
        : out;
      fs.mkdirSync(path.dirname(file), { recursive: true });
      fs.writeFileSync(file, Buffer.concat([wavHeader(w.frames, w.sr), pcm]));
      console.log(`  wrote ${file}   ${(w.frames / w.sr).toFixed(2)} s   peak ${fmtDb(w.peak)} dBFS   ${P} vs ${E}`);
    }
  } finally { await browser.close(); }
}

async function modeSweep() {
  const pairs = String(get('--matchups', 'pizza:taco,hamburger:sushi,soup:donut,lollipop:egg,burrito:hotdog,waterbottle:pizza'))
    .split(',').map((x) => x.split(':'));
  const { browser, page } = await openPage();
  try {
    console.log(`\n══ SWEEP · ${pairs.length} matchups ══\n`);
    console.log(`  matchup                keys/voices   duty   tilt dB/oct   <1kHz   delivered spread   clip >0.5dB   worst clip`);
    const acc = [];
    for (const [P, E] of pairs) {
      const tl = record(P, E, 'smart');
      const prod = await page.evaluate(async (t) => window.__MIX.arm(t, {}), tl);
      const ca = await page.evaluate(async (t) => window.__MIX.clipAction(t, {}), tl);
      const allKeys = [...new Set(prod.per.map((v) => v.key))];
      const solos = [];
      for (const k of allKeys) {
        const drop = allKeys.filter((x) => x !== k);
        const so = await page.evaluate(async ([t, d]) => window.__MIX.arm(t, { dropKeys: d }), [tl, drop]);
        solos.push(pct(so.per.map((v) => v.peak), 0.5));
      }
      const duty = prod.blocks.filter((b) => b > 10 ** (-50 / 20)).length / prod.blocks.length;
      const tilt = slopeDbPerOct(prod.fine, 80, 8000);
      const below1k = prod.bands.slice(0, 5).reduce((a, b) => a + b, 0);
      const spread = db(Math.max(...solos)) - db(Math.min(...solos));
      acc.push({ P, E, keys: allKeys.length, n: prod.per.length, duty, tilt, below1k, spread, ca });
      console.log(`  ${(P + ' vs ' + E).padEnd(22)} ${String(allKeys.length).padStart(2)}/${String(prod.per.length).padEnd(4)} ${(duty * 100).toFixed(1).padStart(7)}% ${tilt.toFixed(2).padStart(11)} ${(below1k * 100).toFixed(1).padStart(8)}% ${spread.toFixed(1).padStart(15)} dB ${(ca.share05 * 100).toFixed(1).padStart(12)}% ${db(ca.worst).toFixed(2).padStart(11)} dB`);
    }
    console.log(`\n  MEAN   keys ${mean(acc.map((a) => a.keys)).toFixed(1)}   voices ${mean(acc.map((a) => a.n)).toFixed(1)}   duty ${(mean(acc.map((a) => a.duty)) * 100).toFixed(1)}%   tilt ${mean(acc.map((a) => a.tilt)).toFixed(2)} dB/oct   below 1 kHz ${(mean(acc.map((a) => a.below1k)) * 100).toFixed(1)}%   delivered spread ${mean(acc.map((a) => a.spread)).toFixed(1)} dB   clip >0.5 dB on ${(mean(acc.map((a) => a.ca.share05)) * 100).toFixed(2)}% of signal`);
    // 5% is where the measurement landed, not a hope: 0.4-4.3% across six matchups, mean
    // 2.0%. The threshold exists so a future mix change that DOES start leaning on the
    // clip is visible, and it is set just above today's worst rather than at a round
    // number nobody measured.
    check('the soft clip is not the flattener: it touches under 5% of signal in every matchup',
      acc.every((a) => a.ca.share05 < 0.05), `worst ${(Math.max(...acc.map((a) => a.ca.share05)) * 100).toFixed(2)}%`);
    check('the mix is darker than pink noise in every matchup', acc.every((a) => a.tilt < -3),
      `tilts ${acc.map((a) => a.tilt.toFixed(1)).join(', ')}`);
  } finally { await browser.close(); }
}

/**
 * WITHIN-SOUND REPETITION. A synthetic timeline of N well-separated hits on the local
 * player at a constant health, soloed to one director key, so every occurrence is
 * temporally isolated and the spread across repeats is the sound's own variation and
 * nothing else. "Monotonic" is a claim about repeats, and no isolated render makes it.
 */
async function modeVary() {
  const key = get('--key', 'hurt');
  const n = Number(get('--n', '14'));
  const { browser, page } = await openPage();
  try {
    const r = await page.evaluate(async ([k, N]) => {
      const mk = (t, ev) => ({ t, phase: 'playing', safeRadius: 900,
        player: { role: 'player', characterId: 'pizza', x: 0, y: 0, hp: 100, maxHp: 100, alive: true, status: { stunnedUntil: '-inf', slowedUntil: '-inf' } },
        enemy: { role: 'enemy', characterId: 'taco', x: 0, y: 0, hp: 100, maxHp: 100, alive: true, status: { stunnedUntil: '-inf', slowedUntil: '-inf' } },
        ev });
      const ticks = [];
      let i = 0;
      for (let t = 0; t <= (N + 1) * 700; t += 100) {
        const fire = t > 0 && t % 700 === 0 && i < N;
        if (fire) i++;
        ticks.push(mk(t, fire ? [{ type: 'hit-landed', targetRole: 'player', amount: 9, effect: null,
          source: { kind: 'weapon', weaponKey: 'Tomato', weaponName: 'Tomato Splat' }, x: 0, y: 0 }] : []));
      }
      return window.__MIX.arm({ ticks }, { soloKey: k, randomSeeds: true });
    }, [key, n]);
    const pk = r.per.map((v) => v.peak), ct = r.per.map((v) => v.cent).filter((c) => c > 0), du = r.per.map((v) => v.dur);
    console.log(`\n══ REPETITION · '${key}' x ${r.per.length}, isolated, random seeds (the shipped behaviour) ══\n`);
    console.log(`  peak      ${fmtDb(Math.min(...pk))} .. ${fmtDb(Math.max(...pk))} dBFS   spread ${(db(Math.max(...pk)) - db(Math.min(...pk))).toFixed(2)} dB`);
    console.log(`  centroid  ${Math.min(...ct).toFixed(0)} .. ${Math.max(...ct).toFixed(0)} Hz   spread ${(100 * (Math.max(...ct) - Math.min(...ct)) / pct(ct, 0.5)).toFixed(1)}% of median`);
    console.log(`  duration  ${(Math.min(...du) * 1000).toFixed(0)} .. ${(Math.max(...du) * 1000).toFixed(0)} ms   spread ${(100 * (Math.max(...du) - Math.min(...du)) / pct(du, 0.5)).toFixed(1)}%`);
    check(`'${key}' varies between repeats by more than 5% of centroid`,
      (Math.max(...ct) - Math.min(...ct)) / pct(ct, 0.5) > 0.05,
      `${(100 * (Math.max(...ct) - Math.min(...ct)) / pct(ct, 0.5)).toFixed(1)}%`);
  } finally { await browser.close(); }
}

const BROWSER_MODES = ['--validate', '--mix', '--sweep', '--vary', '--tilt', '--wav', '--ambience'];
if (has('--shape')) await modeShape();
if (BROWSER_MODES.some(has)) {
  if (has('--snapshot')) { BASE = await startSnapshot(); console.log(`frozen snapshot: ${BASE}`); }
  try {
    if (has('--validate')) await modeValidate();
    if (has('--mix')) await modeMix();
    if (has('--sweep')) await modeSweep();
    if (has('--vary')) await modeVary();
    if (has('--tilt')) await modeTilt();
    if (has('--ambience')) await modeAmbience();
    if (has('--wav')) await modeWav();
  } finally { stopSnapshot(); }
}
if (!has('--shape') && !BROWSER_MODES.some(has)) {
  console.log('pick one of --shape (node only) / --validate / --mix / --sweep / --vary / --tilt / --ambience / --wav <path>');
}
console.log(`\n${checks - failures}/${checks} checks passed`);
process.exit(failures ? 1 : 0);
