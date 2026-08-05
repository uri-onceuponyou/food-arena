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
 *   identity  Assert ALL ELEVEN characters are different KINDS of sound, not the same
 *             sound at eleven EQ settings. Prints the full pairwise spectral-centroid
 *             separation table across the roster (55 pairs, each figure the mean of 6
 *             seeds) and fails if any pair converges; plus the per-character device
 *             claims — Soup's centroid low, Taco's high, Pizza's throw carrying a real
 *             amplitude modulation at the disc's spin rate.
 *   depth     Assert every hit has LAYER STRUCTURE rather than being one layer with an
 *             envelope on it: a transient, a body with a measurable pitch envelope,
 *             harmonic content beyond a test tone, low end, a decay, and a room. Every
 *             threshold is calibrated against deliberately single-layer CONTROLS
 *             rendered in the same pass, which must FAIL — see `modeDepth`.
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
 *   coverage  The MAP: every member of the `GameEvent` union in `state.ts` against the
 *             sound it produces, cross-checked against the union parsed out of the
 *             source so a new event kind cannot arrive unvoiced and unnoticed. Then the
 *             sim states that arrived with the 45 s clock — a match ending on the CLOCK
 *             rather than by knockout, and the ring reaching `MIN_SAFE_RADIUS` — each
 *             proved distinguishable by an 8-band spectral distance stated as a
 *             multiple of the instrument's OWN noise floor. Then the MIX: every sound's
 *             level referred back to the soft clip's input, and the worst tick that
 *             really happens (measured by `tools/tmp/audio_census.mjs` over 363 real
 *             matches) summed and checked for clipping, with a deliberately impossible
 *             pile-up as the control that must fail.
 *   nyquist   Assert on the frequency the code ASKS FOR, at scheduling time — no
 *             oscillator anywhere in the game may be driven above the audible band.
 *             The only evidence of this class of bug is a Chrome console warning
 *             (`value 24276 outside nominal range [-24000, 24000]`), which an
 *             `OfflineAudioContext` never prints. Swept at 24 seeds per sound because
 *             the offender was a per-event jitter that only crosses the line on part of
 *             its own distribution. Then the half that is NOT about intent: the same
 *             bank rendered twice through the production chain at both shipped sample
 *             rates, differing by exactly the partial the ceiling drops. A partial
 *             clamped to EXACTLY Nyquist is not inaudible — it degenerates and puts
 *             89.8% of its energy below 2 kHz.
 *   live      Run the ACTUAL GAME in a browser, tap the master bus post-volume with
 *             an AnalyserNode, and measure the waveform while a real match plays.
 *             This is the only mode that proves the wiring, the autoplay unlock and
 *             the event stream all work together. Boots `/` — the route a player
 *             actually loads — with a CONTROL arm that defeats `engine.ts`'s gesture
 *             guard, so the lock assertion is proved capable of failing.
 *             ⚠️ Its frame-rate and onset-count checks are load-dependent under
 *             SwiftShader (`docs/LESSONS.md` §10) and are the first thing to discount
 *             when this mode disagrees with itself between runs.
 *
 * Usage:  node tools/audio-probe.mjs [--mode all|offline|identity|depth|negative|variation|budget|dispatch|coverage|nyquist|live]
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
  // Stated rather than inherited. `--mode live` asserts things about the autoplay
  // gate — whether a context is born running, whether the first gesture's own sound is
  // heard — and every one of those answers changes if the harness quietly runs a
  // different policy from the shipped browser. This is Chrome's desktop default.
  '--autoplay-policy=document-user-activation-required',
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
    if (first < 0) return { onset: 0, duration: 0, first: 0, last: 0 };
    return { onset: first / sr, duration: (last - first + 1) / sr, first, last };
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

  // ───────────────────────────────────────────────────────────────────────────
  // LAYER-STRUCTURE INSTRUMENTS (--mode depth)
  //
  // Every one of these was calibrated against synthetic controls before being
  // trusted, because an instrument that reports a plausible number for the wrong
  // reason is exactly how this project has lost weeks. The calibration is not a
  // one-off: the controls are rendered on every run and asserted to FAIL, so if one
  // of these ever stops discriminating, the probe says so.
  //
  // Two earlier versions of these are recorded below where they were wrong, because
  // both looked entirely reasonable and both produced meaningless numbers.
  // ───────────────────────────────────────────────────────────────────────────

  /** Hann window over dataN real samples, zero-padded to fftN. True resolution stays
   * sr/dataN; the padding samples the spectrum finely enough that a local median has
   * bins to work with and a peak can be located between them. */
  function frameZ(x, sr, p, dataN, fftN) {
    const re = new Float64Array(fftN), im = new Float64Array(fftN);
    for (let i = 0; i < dataN; i++) {
      const v = p + i >= 0 && p + i < x.length ? x[p + i] : 0;
      re[i] = v * (0.5 - 0.5 * Math.cos(2 * Math.PI * i / (dataN - 1)));
    }
    fft(re, im);
    const mag = new Float64Array(fftN / 2);
    for (let k = 0; k < fftN / 2; k++) mag[k] = Math.hypot(re[k], im[k]);
    return mag;
  }

  function ifft(re, im) {
    const n = re.length;
    for (let i = 0; i < n; i++) im[i] = -im[i];
    fft(re, im);
    for (let i = 0; i < n; i++) { re[i] /= n; im[i] = -im[i] / n; }
  }

  /**
   * BANDS — the peak AMPLITUDE each of three bands reaches, relative to the loudest
   * band. Split exactly in the frequency domain (forward FFT, zero the out-of-band
   * bins, inverse FFT), so the split is zero-phase and no filter skirt can leak one
   * layer into a neighbouring band's score.
   *
   * Peak amplitude, not band ENERGY. A 7 ms transient and a 300 ms body carry wildly
   * different energy while being equally present to a listener; an energy-based split
   * scores a real transient at a twentieth of the body it sits on, and the first
   * version of this did exactly that and called every three-layer impact two layers.
   *
   * This is the most direct statement of the layer claim there is: a single-layer
   * sound cannot make a low body and a high transient peak at the same time. A bare
   * sine lights one band. A bare noise burst lights one or two adjacent ones. A
   * saturated, swept, detuned sine — a single layer with every trick applied — still
   * only lights two. Only a genuine stack lights all three.
   */
  function bandPeaks(x, sr) {
    const ex = extent(x, sr);
    const need = Math.min(x.length, ex.last + 1);
    let n = 1; while (n < need) n <<= 1;
    const fr = new Float64Array(n), fi = new Float64Array(n);
    for (let i = 0; i < need; i++) fr[i] = x[i];
    fft(fr, fi);
    const edges = [[20, 300], [300, 2500], [2500, 16000]];
    const peak = edges.map(([f0, f1]) => {
      const lo = Math.max(1, Math.round(f0 * n / sr)), hi = Math.min(n / 2 - 1, Math.round(f1 * n / sr));
      const br = new Float64Array(n), bi = new Float64Array(n);
      for (let k = lo; k <= hi; k++) { br[k] = fr[k]; bi[k] = fi[k]; br[n - k] = fr[n - k]; bi[n - k] = fi[n - k]; }
      ifft(br, bi);
      let m = 0;
      for (let i = ex.first; i <= ex.last && i < n; i++) { const a = Math.abs(br[i]); if (a > m) m = a; }
      return m;
    });
    const mx = Math.max.apply(null, peak);
    const rel = peak.map((v) => (mx > 0 ? v / mx : 0));
    return { rel, bands: rel.filter((v) => v >= 0.12).length };
  }

  /**
   * PARTIALS — how many discrete pitched components the sound contains below 2.5 kHz.
   *
   * A peak counts if it is a local maximum standing at least 8 dB above the MEDIAN
   * magnitude of its own +/-300 Hz neighbourhood. That local-median test is what makes
   * this immune to noise: noise is locally flat, so however loud it is, its bins never
   * stand 8 dB proud of their own surroundings in a smoothed spectrum.
   *
   * Measured on a SHORT (23 ms) frame early in the sound. A long frame smears a swept
   * tone into one broad hump and reports 1 partial for anything percussive — the first
   * version used 93 ms and reported the generic impact and a bare sine as identical.
   *
   * Validated on controls every run: a bare sine scores 1, and the same sine at
   * drive 2.5 scores 7 with a textbook odd-harmonic series (178, 538, 899, 1260,
   * 1620, 1981, 2342 Hz). That is the instrument proving itself, not being trusted.
   */
  function partials(x, sr) {
    const ex = extent(x, sr);
    const N = 1024, F = 8192;
    // Pick the frame with the most sub-2.5 kHz energy in the first 60% of the sound,
    // rather than a fixed offset from onset. A fixed offset assumes every sound has
    // one onset, and Egg's whole identity is that it has TWO with a 45 ms hole
    // between them — sampled at +12 ms it was measured inside its own gap and scored
    // 0 partials for a hit that has six.
    const limit = Math.min(x.length - N - 1, ex.first + Math.round((ex.last - ex.first) * 0.6));
    let p = Math.max(0, Math.min(x.length - N - 1, ex.first + Math.round(sr * 0.006)));
    let best = -1;
    for (let q = Math.max(0, ex.first); q <= limit; q += 256) {
      let e = 0;
      for (let i = 0; i < N; i++) { const v = q + i < x.length ? x[q + i] : 0; e += v * v; }
      if (e > best) { best = e; p = q; }
    }
    const mag = frameZ(x, sr, p, N, F);
    const bin = (hz) => Math.round(hz * F / sr);
    // Smooth over one TRUE resolution cell, or the padded spectrum's ripple becomes a
    // forest of fake peaks.
    const cell = Math.max(1, Math.round(F / N / 2));
    const sm = new Float64Array(mag.length);
    for (let k = 0; k < mag.length; k++) {
      let s = 0, c = 0;
      for (let d = -cell; d <= cell; d++) { const j = k + d; if (j >= 0 && j < mag.length) { s += mag[j]; c++; } }
      sm[k] = s / c;
    }
    const lo = bin(45), hi = bin(2500), wide = bin(300), guard = bin(70);
    let count = 0; const list = [];
    for (let k = lo; k <= hi; k++) {
      let isMax = true;
      for (let d = -guard; d <= guard; d++) { const j = k + d; if (j >= lo && j <= hi && sm[j] > sm[k]) { isMax = false; break; } }
      if (!isMax) continue;
      const near = [];
      for (let d = -wide; d <= wide; d++) { const j = k + d; if (j <= 0 || j >= sm.length) continue; if (Math.abs(d) <= guard) continue; near.push(sm[j]); }
      if (near.length < 12) continue;
      near.sort((a, b) => a - b);
      const med = near[near.length >> 1];
      if (sm[k] > med * 2.51) { count++; list.push(Math.round(k * sr / F)); k += guard; }
    }
    return { count, list: list.slice(0, 10) };
  }

  /** Frequency of the strongest partial in 35-330 Hz. */
  function dominantLow(x, sr, p, N) {
    const F = 8192;
    const mag = frameZ(x, sr, p, N, F);
    const lo = Math.max(2, Math.ceil(35 * F / sr)), hi = Math.floor(330 * F / sr);
    let bk = lo, bv = 0;
    for (let k = lo; k <= hi; k++) if (mag[k] > bv) { bv = mag[k]; bk = k; }
    return bv > 0 ? bk * sr / F : 0;
  }

  /**
   * PITCH-ENVELOPE SLOPE — the body's dominant partial at onset, over the same at 30%
   * through. A downward sweep on the body is most of what makes an impact feel like it
   * has weight, and a static-frequency tone is the definition of "sounds synthetic".
   *
   * Two earlier versions failed in instructive ways. (1) A band-limited CENTROID: as
   * a saturated body's pitch falls, its own odd harmonics march down into the band and
   * hold the centroid up, so a real sweep measured as 1.0. (2) AUTOCORRELATION: with a
   * body and a sub at a non-integer ratio it locks onto a common sub-multiple early
   * and the true period late, and reports the pitch going UP. Tracking the single
   * strongest low partial has neither failure.
   *
   * Reported as 0 — not a flattering 1 — when the sound has no body to measure, so a
   * pure noise burst cannot pass by being "flat but present".
   */
  function pitchSlope(x, sr, declared, lowBandPeak) {
    const ex = extent(x, sr);
    const D = declared > 0 ? declared : ex.duration;
    // Gated on the low band's PEAK, not on its share of total energy. A bright
    // character with a small-but-real body (Lollipop's 70 ms sub) has a low energy
    // FRACTION and a perfectly trackable pitch envelope; an energy gate refused to
    // measure it and reported 0. A bare noise burst peaks at 0.02-0.03 in this band
    // and is still correctly refused.
    if (D <= 0.03 || lowBandPeak < 0.12) return 0;
    const N = 1024;
    // The late sample is clamped to 85 ms. D is the sound's DECLARED length, which
    // includes anything long and quiet the author scheduled — Soup's steam tail runs
    // 750 ms — so 30% of it can land long after the body has gone, and what gets
    // measured there is the tail's noise floor. Measured: Soup's Dump reported a
    // pitch envelope of 0.38 (rising!) purely because its late sample sat 225 ms in,
    // where the only thing left was steam.
    const lateAt = Math.min(D * 0.3, 0.085);
    const a = dominantLow(x, sr, Math.max(0, ex.first + Math.round(sr * 0.005)), N);
    const b = dominantLow(x, sr, Math.min(x.length - N - 1, ex.first + Math.round(sr * lateAt)), N);
    return a > 20 && b > 20 ? a / b : 0;
  }

  /** LOW END — fraction of total energy below 250 Hz. A hit with nothing down here
   * feels weak on any speaker, and on a phone it feels like nothing at all. */
  function lowFrac(x, sr) {
    const ex = extent(x, sr);
    const N = 4096;
    let lo = 0, all = 0;
    for (let p = ex.first; p + N <= ex.last || p === ex.first; p += N / 2) {
      const re = new Float64Array(N), im = new Float64Array(N);
      for (let i = 0; i < N; i++) {
        const v = p + i < x.length ? x[p + i] : 0;
        re[i] = v * (0.5 - 0.5 * Math.cos(2 * Math.PI * i / (N - 1)));
      }
      fft(re, im);
      const cut = Math.floor(250 * N / sr), hi = Math.floor(14000 * N / sr);
      for (let k = 1; k <= hi; k++) { const e = re[k] * re[k] + im[k] * im[k]; all += e; if (k <= cut) lo += e; }
    }
    return all > 0 ? lo / all : 0;
  }

  /** RMS over an absolute window relative to onset — used for the reverb A/B. */
  function windowRms(x, sr, fromS, toS) {
    const ex = extent(x, sr);
    const a = ex.first + Math.round(fromS * sr), b = Math.min(x.length, ex.first + Math.round(toS * sr));
    if (b <= a) return 0;
    let s = 0;
    for (let i = a; i < b; i++) s += x[i] * x[i];
    return Math.sqrt(s / (b - a));
  }

  /** Everything --mode depth needs, from one buffer. */
  function layers(x, sr, declared) {
    const low = lowFrac(x, sr);
    const bp = bandPeaks(x, sr);
    const pt = partials(x, sr);
    return {
      bands: bp.bands, bandRel: bp.rel,
      partials: pt.count, peaks: pt.list,
      pitchSlope: pitchSlope(x, sr, declared, bp.rel[0]),
      lowFrac: low,
      extent: extent(x, sr).duration,
    };
  }

  /**
   * Normalised energy across 8 logarithmic bands, 60 Hz - 16 kHz, summing to 1.
   *
   * The distinguishability instrument. A spectral CENTROID is one number and two very
   * different sounds can share it (a dark thud plus a bright tick averages to the same
   * place as a mid-band buzz), so "these two are different" cannot rest on it alone.
   * An 8-band profile compared with an L1 distance is bounded in [0, 2], is
   * level-independent by construction (it is normalised), and — the part that matters —
   * has a CALIBRATION available: two renders of the SAME sound at different seeds give
   * the instrument's own noise floor, so a claimed separation can be stated as a
   * multiple of it rather than as a bare number nobody chose (docs/LESSONS.md section 13).
   *
   * Framed and energy-weighted exactly like the centroid function, for the same reason: a
   * percussive sound spends most of its samples decaying, and an unweighted analysis
   * measures the tail.
   */
  function bandProfile(x, sr, nB = 8) {
    const { onset, duration } = extent(x, sr);
    const out = new Array(nB).fill(0);
    if (duration <= 0) return out;
    const N = 2048, hop = 1024;
    const start = Math.floor(onset * sr);
    const stop = Math.min(x.length, Math.floor((onset + duration) * sr));
    const LO = 60, HI = 16000;
    const edges = [];
    for (let b = 0; b <= nB; b++) edges.push(LO * Math.pow(HI / LO, b / nB));
    let total = 0;
    for (let p = start; p + N <= stop || p === start; p += hop) {
      const re = new Float64Array(N), im = new Float64Array(N);
      for (let i = 0; i < N; i++) {
        const v = p + i < x.length ? x[p + i] : 0;
        re[i] = v * (0.5 - 0.5 * Math.cos(2 * Math.PI * i / (N - 1)));
      }
      fft(re, im);
      for (let k = 1; k < N / 2; k++) {
        const hz = k * sr / N;
        if (hz < LO || hz > HI) continue;
        const e = re[k] * re[k] + im[k] * im[k];
        let b = Math.floor((Math.log(hz / LO) / Math.log(HI / LO)) * nB);
        if (b < 0) b = 0; else if (b >= nB) b = nB - 1;
        out[b] += e;
        total += e;
      }
    }
    if (total <= 0) return out;
    for (let b = 0; b < nB; b++) out[b] /= total;
    return out;
  }

  /**
   * analyse() reports the MONO SUM's peak, which is the right number for "is this
   * audible" and the WRONG number for "does this clip": a hard-panned voice puts all
   * its energy in one channel, and averaging two channels halves it. peakMax is the
   * loudest sample in ANY channel, which is what a converter sees.
   */
  function analyse(chans, sr, opt) {
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
      peakL: per[0] ? per[0].peak : 0,
      peakR: per[1] ? per[1].peak : 0,
      peakMax: per.reduce((a, p) => Math.max(a, p.peak), 0),
      onset: ex.onset, duration: ex.duration,
      centroid: centroid(mono, sr),
      mod: envelopeMod(mono, sr),
      left: per[0] ? per[0].rms : 0,
      right: per[1] ? per[1].rms : 0,
      // Opt-in: an extra framed FFT pass per render, and --mode identity makes ~200
      // of them. Only --mode coverage needs it.
      bands: opt && opt.bands ? bandProfile(mono, sr) : null,
    };
  }

  /**
   * RMS of the signal above fc, as an ABSOLUTE number.
   *
   * bandProfile() is normalised and so answers "where is this sound's energy",
   * deliberately — it cannot answer "did this render gain energy up here", which is the
   * question when two renders of the SAME event are compared and one carries an extra
   * layer. Two cascaded one-pole highpasses (-12 dB/oct); the exact slope does not
   * matter because both arms of every A/B go through the identical filter.
   */
  /**
   * UNNORMALISED energy strictly between lo and hi Hz, by framed FFT.
   *
   * Written because a filter cannot do this job at the top of the band: a 2-pole
   * lowpass at 16 kHz attenuates 22 kHz by only ~5 dB, so a "below 16 kHz" residual
   * measured that way is mostly the 22 kHz thing it was supposed to exclude. That
   * mistake read -19.8 dB where the truth was -68.3, i.e. it made an inaudible partial
   * look like an audible one. Bin selection has no slope and cannot leak an octave.
   *
   * Absolute scale is arbitrary (no window or FFT normalisation), which is fine and
   * deliberate: every use is a RATIO of two signals analysed by this same function.
   */
  function bandEnergy(x, sr, lo, hi) {
    const N = 4096, hop = 2048;
    let total = 0;
    for (let p = 0; p + N <= x.length; p += hop) {
      const re = new Float64Array(N), im = new Float64Array(N);
      for (let i = 0; i < N; i++) re[i] = x[p + i] * (0.5 - 0.5 * Math.cos(2 * Math.PI * i / (N - 1)));
      fft(re, im);
      for (let k = 1; k < N / 2; k++) {
        const hz = k * sr / N;
        if (hz < lo || hz > hi) continue;
        total += re[k] * re[k] + im[k] * im[k];
      }
    }
    return total;
  }

  function hpRms(x, sr, fc) {
    const dt = 1 / sr;
    const rc = 1 / (2 * Math.PI * fc);
    const a = rc / (rc + dt);
    let y1 = 0, p1 = 0, y2 = 0, p2 = 0, acc = 0;
    for (let i = 0; i < x.length; i++) {
      const v = x[i];
      y1 = a * (y1 + v - p1); p1 = v;
      y2 = a * (y2 + y1 - p2); p2 = y1;
      acc += y2 * y2;
    }
    return Math.sqrt(acc / Math.max(1, x.length));
  }

  return { analyse, stats, extent, centroid, envelopeMod, layers, windowRms, bandPeaks, partials, pitchSlope, lowFrac, bandProfile, hpRms, bandEnergy };
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
    // `engine.ts` directly, not through the package index: `gainForVolume` is the
    // master chain's own curve and `--mode coverage` refers every measured level back
    // through it. Hardcoding 0.62 in the probe would make the mix table lie the moment
    // anyone retunes MASTER_TRIM.
    const engineMod = await import('/src/audio/engine.ts');
    window.__A = { audio, sounds, weapons, rules, director, engineMod };

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
      const engine = new audio.AudioEngine({ context: ctx, persist: false, reverb: opt.reverb });
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
      const a = window.__dsp.analyse(chans, sr, opt);
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
    /**
     * Count the kitchen bed's voices SEPARATELY from everything else.
     *
     * `director.ts` runs a continuous ambience bed whenever `phase === 'playing'`, and
     * three of the harnesses below drive the director with exactly that phase in order
     * to test something else entirely — the shrug-off, the final-ring latch, the status
     * grace rule. Every assertion they make is "this produces exactly N voices", so a
     * state-driven bed folded into `counters.started` makes nine of them report the bed.
     * Returns a getter for the bed's own count, so each harness can subtract it and
     * still have it available to assert on.
     */
    window.__countAmbience = (engine) => {
      let n = 0;
      const orig = engine.play.bind(engine);
      engine.play = (fn, o = {}) => {
        const ok = orig(fn, o);
        if (ok && o && o.key === 'ambience') n++;
        return ok;
      };
      return () => n;
    };

    window.__renderEvents = async (events, opt = {}) => {
      const sr = 44100;
      const ctx = new OfflineAudioContext(2, Math.ceil(sr * (opt.seconds ?? 2)), sr);
      const engine = new audio.AudioEngine({ context: ctx, persist: false });
      const md = new director.MatchAudio(engine);
      const state = {
        elapsed: opt.elapsed ?? 1000,
        // `phase`/`safeRadius`/`alive` are absent unless a caller asks for them, so
        // every assertion written before the sim gained `resolveTimeout` and
        // `MIN_SAFE_RADIUS` keeps measuring exactly what it measured before: the
        // director's own discriminants are `=== true` and `=== 'playing'`, so an
        // absent field takes the old path.
        ...(opt.phase !== undefined ? { phase: opt.phase } : {}),
        ...(opt.safeRadius !== undefined ? { safeRadius: opt.safeRadius } : {}),
        player: {
          role: 'player', characterId: opt.playerId ?? 'soup',
          x: opt.playerX ?? 0, y: opt.playerY ?? 0,
          hp: opt.playerHp ?? 100, maxHp: 100,
          ...(opt.playerAlive !== undefined ? { alive: opt.playerAlive } : {}),
        },
        enemy: {
          role: 'enemy', characterId: opt.enemyId ?? 'taco', x: 100, y: 0, hp: 150, maxHp: 150,
          ...(opt.enemyAlive !== undefined ? { alive: opt.enemyAlive } : {}),
        },
      };
      // ── The kitchen bed is counted SEPARATELY, and that is not a convenience ──
      //
      // `director.ts` now runs a continuous ambience bed whenever `phase === 'playing'`,
      // which is state rather than a response to any event. Every assertion in
      // `--mode dispatch` is of the form "this event produces exactly N voices", so
      // folding a state-driven bed into that count would make nine assertions about
      // the SHRUG-OFF and the FINAL RING report the bed instead — they all pass
      // `phase: 'playing'`, and all nine did exactly that on the first run.
      //
      // Split rather than filtered out: `startedAmbience` is asserted directly below,
      // so the bed is still covered by a shipped gate and cannot be silently lost.
      const bed = window.__countAmbience(engine);
      md.handleEvents(events, state);
      const buf = await ctx.startRendering();
      const a = window.__dsp.analyse([buf.getChannelData(0), buf.getChannelData(1)], sr, opt);
      return { ...a, started: engine.counters.started - bed(), startedAmbience: bed(),
        startedAll: engine.counters.started, dropped: engine.counters.droppedThrottle,
        droppedBudget: engine.counters.droppedBudget };
    };

    /**
     * Drive a sequence of TICKS through the real director with a real, shrinking
     * `safeRadius` and — deliberately — NO EVENTS on any of them.
     *
     * This is the assertion that the state-derived final-ring cue cannot be faked. The
     * director used to `return` immediately on an empty event batch; measured over 121
     * matchups a real match produces ~120 events across ~2,700 ticks, so the tick on
     * which the ring crosses its floor almost certainly carries nothing. If the cue
     * only fires when something else happens to be happening, it is not wired to the
     * ring at all.
     */
    window.__renderZone = async (radii, opt = {}) => {
      const sr = 44100;
      const ctx = new OfflineAudioContext(2, Math.ceil(sr * (opt.seconds ?? 3)), sr);
      const engine = new audio.AudioEngine({ context: ctx, persist: false });
      const md = new director.MatchAudio(engine);
      // The bed is not a response to the ring — see `__countAmbience`. Note every tick
      // here carries `elapsed: 1000`, so the bed fires exactly once per match arm no
      // matter how many radii are stepped through.
      const bed = window.__countAmbience(engine);
      const mk = (r) => ({
        elapsed: 1000, phase: opt.phase ?? 'playing', safeRadius: r,
        player: { role: 'player', characterId: 'soup', x: 0, y: 0, hp: 100, maxHp: 100, alive: true },
        enemy: { role: 'enemy', characterId: 'taco', x: 100, y: 0, hp: 150, maxHp: 150, alive: true },
      });
      for (const r of radii) md.handleEvents([], mk(r));
      if (opt.reset) {
        md.reset();
        for (const r of radii) md.handleEvents([], mk(r));
      }
      const buf = await ctx.startRendering();
      const a = window.__dsp.analyse([buf.getChannelData(0), buf.getChannelData(1)], sr, opt);
      return { ...a, started: engine.counters.started - bed(), startedAmbience: bed() };
    };

    /**
     * THE SHRUG-OFF A/B — the same `hit-landed` twice, differing only in whether the
     * sim accepted its stun.
     *
     * The state here carries `status`, which the other duck-typed states deliberately
     * do not: the director's discriminant is that `applyDamage` moved
     * `status.stunnedUntil`, so an A/B on it has to model two consecutive frames and
     * change nothing else. Frame 1 carries no events and exists only to set the
     * "before" snapshot — which is precisely how the shipped path works, `match.ts`
     * calling `handleEvents` every frame whether or not the tick produced anything.
     *
     * Everything else is held identical: same weapon (none — the generic impact), same
     * damage, same position, same seed, same virtual time.
     */
    window.__renderStatusHit = async (opt = {}) => {
      const sr = 44100;
      const ctx = new OfflineAudioContext(2, Math.ceil(sr * (opt.seconds ?? 2)), sr);
      const engine = new audio.AudioEngine({ context: ctx, persist: false });
      const md = new director.MatchAudio(engine);
      // The bed is not a response to a status hit — see `__countAmbience`.
      const bed = window.__countAmbience(engine);
      const mk = (elapsed, enemyStun) => ({
        elapsed, phase: 'playing',
        player: {
          role: 'player', characterId: 'soup', x: 0, y: 0, hp: 100, maxHp: 100, alive: true,
          status: { stunnedUntil: -Infinity, slowedUntil: -Infinity },
        },
        enemy: {
          role: 'enemy', characterId: 'taco', x: 0, y: 0, hp: 150, maxHp: 150, alive: true,
          status: { stunnedUntil: enemyStun, slowedUntil: -Infinity },
        },
      });
      const hit = (effect) => ({
        type: 'hit-landed', targetRole: opt.target ?? 'enemy', amount: opt.amount ?? 12, effect,
        // A key no character owns, so the generic `impact()` is used and the A/B is not
        // measuring one weapon's bespoke voice.
        source: { kind: 'weapon', weaponKey: '__generic__', weaponName: 'Generic' },
        x: 0, y: 0,
      });
      // A refused stun is one whose timestamp does NOT move across the frame; a landed
      // one moves it. -Infinity -> 3000 is a landing; 3000 -> 3000 is a refusal.
      const before = opt.refused ? 3000 : -Infinity;
      md.handleEvents([], mk(0, before));
      if (opt.resetBetween) {
        // A second match on the same director. `reset()` must put the snapshot back to
        // "not known yet" — and the first stun of the new match must still land.
        md.reset();
        md.handleEvents([], mk(0, -Infinity));
      }
      engine.setVirtualTime(0);
      md.handleEvents([hit(opt.effect ?? 'stun')], mk(1000, 3000));
      const buf = await ctx.startRendering();
      const chans = [buf.getChannelData(0), buf.getChannelData(1)];
      const mono = new Float64Array(chans[0].length);
      for (let i = 0; i < mono.length; i++) mono[i] = (chans[0][i] + chans[1][i]) / 2;
      const a = window.__dsp.analyse(chans, sr, opt);
      return {
        ...a,
        started: engine.counters.started - bed(),
        startedAmbience: bed(),
        hp1200: window.__dsp.hpRms(mono, sr, 1200),
      };
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

    /**
     * Render one sound to MONO, with a census of every node it created, and return
     * only NUMBERS — the layer metrics are computed in-page because shipping 88200
     * samples across the Playwright bridge per render turns a 200-render sweep into
     * minutes.
     *
     * The node census wraps `ctx.create*` before the sound runs. It is the CPU
     * assertion this pillar needs and could not otherwise make: "is this fast enough
     * on a phone" is not answerable by reading code, and a 20-voice budget times an
     * unbounded per-voice node count is not a budget at all.
     *
     * Rendered TWICE — once with the reverb bus and once without — because the room
     * has to be proven to contribute energy rather than merely to be wired up. That
     * is the same A/B that caught SSAO contributing exactly 0.0000/255 for this
     * project's entire history (`PROGRESS.md`), and it is the only form of proof this
     * codebase has learned to trust.
     *
     * The LAYER metrics are taken from the DRY render on purpose. Layer structure is a
     * property of the synthesis; measuring a body's pitch envelope through its own
     * reflections measures the room, not the body (at the first reverb level tried,
     * that alone flattened every measured pitch envelope in the game to 1.0). The room
     * gets its own assertions below, from the A/B.
     */
    window.__depth = async (makeSound, opt = {}) => {
      const sr = 44100;
      const run = async (reverb) => {
        const ctx = new OfflineAudioContext(1, Math.ceil(sr * (opt.seconds ?? 2)), sr);
        let nodes = 0;
        for (const k of ['createGain', 'createOscillator', 'createBufferSource', 'createBiquadFilter',
                         'createWaveShaper', 'createStereoPanner', 'createConvolver', 'createDelay']) {
          const orig = ctx[k].bind(ctx);
          ctx[k] = (...a) => { nodes++; return orig(...a); };
        }
        const engine = new audio.AudioEngine({ context: ctx, persist: false, reverb });
        // The master chain and the shared room are built in the constructor and are
        // per-CONTEXT, not per-voice; subtract them so the census reports what one
        // SOUND costs, which is the number the 20-voice budget multiplies.
        const overhead = nodes;
        let declared = 0;
        const wrapped = (s) => { declared = makeSound(s); return declared; };
        engine.play(wrapped, { seed: opt.seed ?? 1234567 });
        const buf = await ctx.startRendering();
        return { x: buf.getChannelData(0), nodes: nodes - overhead, declared };
      };
      const wet = await run(true);
      const dry = await run(false);
      const D = wet.declared;
      const L = window.__dsp.layers(dry.x, sr, D);
      // The room, measured two ways: how much longer the sound lasts, and how much
      // energy exists in a window that starts AFTER the sound's own declared end —
      // where a dry sound has, by construction, nothing at all.
      const lateWet = window.__dsp.windowRms(wet.x, sr, D + 0.02, D + 0.17);
      const lateDry = window.__dsp.windowRms(dry.x, sr, D + 0.02, D + 0.17);
      return {
        ...L, declared: D, nodes: wet.nodes,
        extentWet: window.__dsp.extent(wet.x, sr).duration,
        extentDry: window.__dsp.extent(dry.x, sr).duration,
        lateWet, lateDry,
      };
    };

    /**
     * Every frequency this sound schedules onto an OSCILLATOR, at scheduling time.
     *
     * ── Why this cannot be measured off the rendered buffer ────────────────────
     *
     * Chrome clamps `OscillatorNode.frequency` to the context's nominal range and
     * says so on the CONSOLE — `value 24276 outside nominal range [-24000, 24000];
     * value will be clamped`. `OfflineAudioContext` emits no such warning, and the
     * rendered samples are innocent either way: the offending partial is above
     * hearing, so it changes no measurable peak, RMS or (audible-band) centroid.
     * Five of these fired in one real match and every one of 389 assertions passed.
     *
     * So the assertion has to be made on the INTENT, not on the output — the number
     * the code asked for, caught at the moment it asks. Same shape as the
     * `GameEvent`-union check that fetched a file through Vite, got type-stripped
     * output, parsed zero kinds and passed: measure the thing itself.
     *
     * Wraps `createOscillator` per context (not the prototype — parallel renders
     * would cross-talk) and intercepts all four ways a frequency can be set:
     * `setValueAtTime`, both ramps, and a plain `.value =` assignment.
     */
    window.__oscScan = async (makeSound, opt = {}) => {
      const sr = opt.sampleRate ?? 44100;
      const ctx = new OfflineAudioContext(1, Math.ceil(sr * (opt.seconds ?? 1.2)), sr);
      const scheduled = [];
      const valueDesc = Object.getOwnPropertyDescriptor(AudioParam.prototype, 'value');
      const origCreate = ctx.createOscillator.bind(ctx);
      ctx.createOscillator = () => {
        const osc = origCreate();
        const p = osc.frequency;
        for (const m of ['setValueAtTime', 'linearRampToValueAtTime', 'exponentialRampToValueAtTime']) {
          const orig = p[m].bind(p);
          p[m] = (v, t) => { scheduled.push({ via: m, hz: v, type: osc.type }); return orig(v, t); };
        }
        if (valueDesc && valueDesc.set) {
          Object.defineProperty(p, 'value', {
            configurable: true,
            get: () => valueDesc.get.call(p),
            set: (v) => { scheduled.push({ via: 'value=', hz: v, type: osc.type }); valueDesc.set.call(p, v); },
          });
        }
        return osc;
      };
      const engine = new audio.AudioEngine({ context: ctx, persist: false, reverb: opt.reverb !== false });
      engine.play(makeSound, { seed: opt.seed ?? 1234567 });
      // Deliberately NOT rendered: every frequency is scheduled synchronously inside
      // `play()`, and skipping `startRendering()` makes a 400-sound sweep seconds
      // rather than minutes.
      let max = -Infinity, maxVia = '', maxType = '';
      for (const s of scheduled) {
        if (s.hz > max) { max = s.hz; maxVia = s.via; maxType = s.type; }
      }
      return { count: scheduled.length, max, maxVia, maxType,
               over: scheduled.filter((s) => s.hz > (opt.ceiling ?? 20000)).map((s) => s.hz) };
    };

    /** Raw channel data, for the bit-exactness comparisons. */
    window.__renderRaw = async (makeSound, opt = {}) => {
      // Overridable because the Nyquist A/B has to render the SAME sound at both of the
      // sample rates a shipped device actually uses: at 44.1 kHz the out-of-band partial
      // is clamped by the browser, at 48 kHz it is not, and the whole question is
      // whether that difference reaches the audible band.
      const sr = opt.sampleRate ?? 44100;
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
  // The shrug-off. In the standard catalogue rather than only in the dispatch A/B, so
  // it carries the same declared-duration and prompt-onset assertions as every other
  // sound — its whole design depends on a slow attack (22 ms, so its peak lands past
  // the impact transient it rides on) and "slow attack" is one edit away from "starts
  // late", which the 40 ms onset check is there to catch.
  { id: 'generic.statusRefused', expr: `S.statusRefused()` },
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
  // Both arrived with the 45 s clock: a match can now end ON THE CLOCK with both
  // fighters alive, and the ring now floors at MIN_SAFE_RADIUS instead of closing to
  // zero. They are in the standard catalogue, not only in `--mode coverage`, so they
  // carry the same declared-duration and prompt-onset assertions as everything else —
  // the engine frees a voice on its DECLARED duration, and a sound that outlives its
  // own declaration is cut off mid-tail.
  { id: 'generic.matchEndTimeout.win', expr: `S.matchEndTimeout(true)` },
  { id: 'generic.matchEndTimeout.lose', expr: `S.matchEndTimeout(false)` },
  { id: 'generic.ringFloor', expr: `S.ringFloor()` },
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
  console.log('\n── identity: all ELEVEN characters must be different KINDS of sound ──');

  // ── The roster ladder. This is the direct answer to "they are... similar". ──
  //
  // Every character's impacts are rendered at 6 different seeds and averaged, then
  // the character's position is the mean over its own weapons. Single-seed thresholds
  // measure one lucky draw: a grain cloud varies STRUCTURALLY between seeds (Taco's
  // shatter spreads roughly 2000-3200 Hz of spectral centroid on its own), so a
  // threshold checked against one fixed seed is a threshold checked against a number
  // nobody chose.
  //
  // The claim is not "these are different" — it is that NO PAIR of the 55 converges,
  // which is much harder and is what actually stops the roster drifting back into one
  // voice as weapons get re-tuned.
  const cat = await impactCatalogue(page);
  const ladder = [];
  console.log('  --- per-character spectral-centroid ladder (mean of 6 seeds per weapon) ---');
  for (const [id, ws] of Object.entries(cat)) {
    const per = [];
    for (const w of ws) {
      const r = await renderMean(page, weaponExpr(id, w.key, 'impact', w.damage));
      per.push([w.key, r.centroid, r.peak, r.rms]);
      check(`${id}.${w.key}.impact: audible`, r.peak > 0.02 && r.rms > 0.001,
        `peak=${r.peak.toFixed(4)} rms=${r.rms.toFixed(5)}`);
    }
    const mean = per.reduce((a, b) => a + b[1], 0) / per.length;
    ladder.push({ id, mean, per });
  }
  ladder.sort((a, b) => a.mean - b.mean);
  for (const row of ladder) {
    console.log(
      `  ${row.id.padEnd(12)} ${String(Math.round(row.mean)).padStart(5)} Hz   ` +
      row.per.map(([k, c]) => `${k}=${Math.round(c)}`).join(' '),
    );
  }

  // The full pairwise table, printed as ratios (>=1 by construction, read row/col).
  console.log('\n  --- pairwise separation, ratio of spectral centroids (all 55 pairs) ---');
  const names = ladder.map((r) => r.id);
  console.log('              ' + names.map((n) => n.slice(0, 5).padStart(6)).join(''));
  let minRatio = Infinity, minPair = '';
  for (let i = 0; i < ladder.length; i++) {
    let line = '  ' + ladder[i].id.padEnd(12);
    for (let j = 0; j < ladder.length; j++) {
      if (j >= i) { line += '     ·'; continue; }
      const ratio = ladder[i].mean / ladder[j].mean;
      if (ratio < minRatio) { minRatio = ratio; minPair = `${ladder[j].id} vs ${ladder[i].id}`; }
      line += ratio.toFixed(2).padStart(6);
    }
    console.log(line);
  }
  console.log(`  closest pair: ${minPair} at ${minRatio.toFixed(3)}x   ladder span ${Math.round(ladder[0].mean)}-${Math.round(ladder[ladder.length - 1].mean)} Hz (${(ladder[ladder.length - 1].mean / ladder[0].mean).toFixed(2)}x)`);

  check('all 11 characters have a bespoke impact voice', ladder.length === 11, `${ladder.length} characters`);
  // 1.08 with the measured minimum at ~1.10 leaves one tuning pass of slack and no
  // more, which is the point: this should fail the moment two characters start
  // converging, not once they have already merged.
  check('no two characters converge (every one of the 55 pairs separated by > 1.08x)',
    minRatio > 1.08, `closest = ${minPair} at ${minRatio.toFixed(3)}x`);
  check('the roster spans more than 4x of spectral centroid end to end',
    ladder[ladder.length - 1].mean / ladder[0].mean > 4,
    `${Math.round(ladder[0].mean)} -> ${Math.round(ladder[ladder.length - 1].mean)} Hz`);

  // ── THE LADDER'S OWN CENTRE, and why two gates below are derived from it ──
  //
  // Two checks in this mode used to be ABSOLUTE Hz numbers — "pizza.Dough < 1400" and
  // "every soup impact < 2000" — and both were set against the tuning of the day they
  // were written. That is fine until the day the whole roster is retuned at once, and
  // then it is worse than useless: the numbers fail for a reason that has nothing to do
  // with what they were protecting, and the only two available moves are to break the
  // gate or to move the number, which is the same thing.
  //
  // The claims they encode are RELATIVE and always were. "Dough is the dull landing"
  // and "Soup is the wet dark one" are statements about where those sounds sit AMONG
  // THE OTHERS, not about a frequency. So they are now measured that way, against the
  // geometric centre of the eleven-rung ladder this mode has already computed —
  // geometric because the ladder is geometric (every separation in this file is a
  // RATIO), so the arithmetic mean would sit far above the middle rung and the bound
  // would silently loosen every time the bright end moved.
  //
  // This survives any future roster-wide pass in either direction, which is exactly
  // what the old numbers could not do.
  const ladderCentre = Math.exp(ladder.reduce((a, r) => a + Math.log(r.mean), 0) / ladder.length);
  console.log(`  ladder geometric centre: ${Math.round(ladderCentre)} Hz  (the bound the "dull" and "wet" claims below are measured against)`);

  console.log('\n  --- per-character device claims ---');

  const cases = [
    { id: 'soup.Splash.impact', expr: weaponExpr('soup', 'Splash', 'impact', 3) },
    { id: 'soup.Noodle.impact', expr: weaponExpr('soup', 'Noodle', 'impact', 5) },
    { id: 'soup.Dump.impact', expr: weaponExpr('soup', 'Dump', 'impact', 16) },
    { id: 'soup.Dump.cast', expr: weaponExpr('soup', 'Dump', 'cast') },
    { id: 'pizza.Dough.cast', expr: weaponExpr('pizza', 'Dough', 'cast') },
    { id: 'pizza.Tomato.cast', expr: weaponExpr('pizza', 'Tomato', 'cast') },
    { id: 'pizza.Cheese.cast', expr: weaponExpr('pizza', 'Cheese', 'cast') },
    { id: 'pizza.Dough.impact', expr: weaponExpr('pizza', 'Dough', 'impact', 5) },
    { id: 'taco.Filling.impact', expr: weaponExpr('taco', 'Filling', 'impact', 12) },
    { id: 'taco.Onion.impact', expr: weaponExpr('taco', 'Onion', 'impact', 7) },
    { id: 'taco.Double.impact', expr: weaponExpr('taco', 'Double', 'impact', 14) },
    { id: 'donut.Candy.impact', expr: weaponExpr('donut', 'Candy', 'impact', 4) },
    { id: 'lollipop.Smash.impact', expr: weaponExpr('lollipop', 'Smash', 'impact', 11) },
    { id: 'waterbottle.Cap.impact', expr: weaponExpr('waterbottle', 'Cap', 'impact', 6) },
    { id: 'sushi.Fish.impact', expr: weaponExpr('sushi', 'Fish', 'impact', 6) },
    { id: 'hamburger.Smash.impact', expr: weaponExpr('hamburger', 'Smash', 'impact', 12) },
    { id: 'hotdog.Slash.impact', expr: weaponExpr('hotdog', 'Slash', 'impact', 11) },
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

  // Soup is WET: energy collapses downward, so it must sit in the DARK HALF of the
  // roster — every one of its impacts below the ladder's geometric centre.
  //
  // Was `< 2000 Hz`, an absolute set when Soup measured 1322-1831 and the whole game
  // fell at -5.57 dB/octave with 86% of its energy under 1 kHz. The roster-wide top-end
  // pass moved every character up, Soup included (its own steam and a new fine-droplet
  // layer), and 2000 Hz then described nothing: it was 9% above the day's authored
  // value and no more principled than that. The claim being made has never been "under
  // 2 kHz", it is "darker than the roster", and that is what is measured now.
  for (const id of ['soup.Splash.impact', 'soup.Noodle.impact', 'soup.Dump.impact']) {
    check(`${id}: in the DARK HALF of the roster (below the ladder's geometric centre, wet)`,
      m[id].centroid < ladderCentre,
      `${Math.round(m[id].centroid)} Hz vs centre ${Math.round(ladderCentre)} Hz`);
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

  // ── Pizza Dough is the DULL LANDING — the deliberate counterexample. ──────
  //
  // Was a single check reading `pizza.Dough.impact is the dullest impact in the game
  // (centroid < 1400 Hz)`, and the NAME WAS FALSE ON THE DAY IT WAS WRITTEN: at that
  // tuning `hamburger.Smash` measured 707 Hz and `pizza.Cheese` 1184 against Dough's
  // 1254, so two impacts were already duller and one of them is asserted to be, four
  // lines below. What the gate really held was an absolute ceiling, and 1400 was 12%
  // above the authored value of the day — a tolerance, not a derivation.
  //
  // `docs/LESSONS.md` section 9: a gate whose report is false gets fixed or switched
  // off. So it is split into the two claims the comment in `weapons/pizza.ts` actually
  // makes, both relative and both self-maintaining under a roster-wide retune:
  //
  //   1. Dough is a DULL landing — in the dark half of the roster, same bound Soup is
  //      held to, so "dull" means the same thing for both.
  //   2. Dough is the COUNTEREXAMPLE THAT MAKES BRITTLENESS READ — at least 2x below
  //      every one of Taco's impacts. That is the sentence `pizza.ts` opens with, and
  //      it is the only part a listener can actually hear.
  const dough = m['pizza.Dough.impact'].centroid;
  check('pizza.Dough.impact is a DULL landing (below the ladder\'s geometric centre)',
    dough < ladderCentre, `${Math.round(dough)} Hz vs centre ${Math.round(ladderCentre)} Hz`);
  const tacoMinAll = Math.min(...['taco.Filling.impact', 'taco.Onion.impact', 'taco.Double.impact'].map((id) => m[id].centroid));
  check('pizza.Dough.impact is the counterexample to brittleness (>2x below every taco impact)',
    tacoMinAll / dough > 2, `dough=${Math.round(dough)} taco min=${Math.round(tacoMinAll)} ratio=${(tacoMinAll / dough).toFixed(2)}x`);

  // ── The two pairs that share a rung on the ladder ────────────────────────
  // Centroid alone would call these four characters two characters. They are
  // separated on axes the ear resolves INDEPENDENTLY of brightness, and if that
  // claim is not measured it is decoration.
  //
  // 1. Taco vs Sushi — both bright. Taco is a cloud of broadband transients; Sushi is
  //    a single high-Q resonance. Noise versus near-pitch, i.e. spectral FLATNESS.
  const flat = async (expr) =>
    page.evaluate(async ([e]) => {
      const S = window.__A.sounds; const W = window.__A; const A = window.__A.audio;
      // eslint-disable-next-line no-eval
      const fn = eval(e);
      let acc = 0;
      for (let i = 0; i < 6; i++) {
        const r = await window.__depth(fn, { seed: 1000 + i * 7919 });
        acc += r.partials;
      }
      return acc / 6;
    }, [expr]);
  const sushiPartials = await flat(weaponExpr('sushi', 'Fish', 'impact', 6));
  const tacoPartials = await flat(weaponExpr('taco', 'Onion', 'impact', 7));
  console.log(`  taco vs sushi, both bright: partials taco=${tacoPartials.toFixed(1)} sushi=${sushiPartials.toFixed(1)}`);
  check('taco and sushi are separated by SPECTRAL STRUCTURE, not brightness (sushi is more tonal)',
    sushiPartials > tacoPartials, `sushi=${sushiPartials.toFixed(1)} taco=${tacoPartials.toFixed(1)} partials`);

  // 2. Donut vs Lollipop — both resonant. Donut's ring is near-harmonic and long;
  //    Lollipop's candy is ring-modulated and inharmonic. Both use `modes()`, so if
  //    they were not separated the primitive would be doing all the work and neither
  //    character would own anything.
  check('donut RINGS longer than any other non-ultimate weapon',
    m['donut.Candy.impact'].duration > m['lollipop.Smash.impact'].duration &&
      m['donut.Candy.impact'].duration > m['waterbottle.Cap.impact'].duration,
    `donut=${m['donut.Candy.impact'].duration.toFixed(3)}s lollipop=${m['lollipop.Smash.impact'].duration.toFixed(3)}s waterbottle=${m['waterbottle.Cap.impact'].duration.toFixed(3)}s`);
  check('waterbottle is the DAMPED one of the three resonant characters',
    m['waterbottle.Cap.impact'].duration < m['donut.Candy.impact'].duration,
    `waterbottle=${m['waterbottle.Cap.impact'].duration.toFixed(3)}s vs donut=${m['donut.Candy.impact'].duration.toFixed(3)}s`);

  // 3. Hamburger owns the bottom of the ladder outright — he is the counterweight
  //    that makes every other character's brightness mean something.
  check('hamburger is darker than every other character\'s comparable hit',
    m['hamburger.Smash.impact'].centroid < m['hotdog.Slash.impact'].centroid &&
      m['hamburger.Smash.impact'].centroid < m['pizza.Dough.impact'].centroid,
    `hamburger=${Math.round(m['hamburger.Smash.impact'].centroid)} hotdog=${Math.round(m['hotdog.Slash.impact'].centroid)} pizza=${Math.round(m['pizza.Dough.impact'].centroid)} Hz`);

  return m;
}

/**
 * Every character's bespoke impacts, discovered from the REGISTRY rather than listed
 * here. A voice that is authored and never registered, or registered and never
 * measured, is the exact failure this probe exists for; deriving the list from
 * `getWeaponSfx` makes forgetting one impossible.
 */
async function impactCatalogue(page) {
  return page.evaluate(() => {
    const out = {};
    for (const [id, def] of Object.entries(window.__A.rules.CHARACTERS)) {
      const ws = def.weapons
        .filter((w) => { const sfx = window.__A.weapons.getWeaponSfx(id, w.key); return sfx && sfx.impact; })
        .map((w) => ({ key: w.key, damage: w.damage || 10 }));
      if (ws.length) out[id] = ws;
    }
    return out;
  });
}

// ─────────────────────────────────────────────────────────────────────────────
// depth — the answer to "they are very shallow"
// ─────────────────────────────────────────────────────────────────────────────

/**
 * LAYER STRUCTURE, measured on rendered samples.
 *
 * Uri played the game and said the SFX are *"very shallow and similar"*. "Similar" is
 * an authoring problem and `--mode identity` covers it. "Shallow" is a synthesis
 * problem, and this mode exists so that it can never be declared fixed because the
 * code changed. The diagnosis it was built from, measured on the shipped catalogue
 * before any of this work:
 *
 *   * `impact(16)` — the most-heard sound in the game — contained exactly ONE spectral
 *     partial. A bare sine control scores the same 1.
 *   * Texture layers measured spectral flatness 0.70-0.80 against 0.699 for a single
 *     unshaped noise burst. Also indistinguishable from their own control.
 *   * EVERY sound's -66 dBFS extent was SHORTER than its own declared duration. There
 *     was no tail anywhere in the game and no sense of a room at all.
 *   * The whole catalogue's decay fitted inside 18-88 ms — one texture, everywhere.
 *
 * ── WHY THE CONTROLS ARE RENDERED EVERY RUN ────────────────────────────────────
 *
 * A threshold with no control is a number somebody liked. Five deliberately
 * single-layer sounds are rendered alongside the real ones and REQUIRED TO FAIL, and
 * they are chosen to fail for different reasons, so no single lucky metric can carry
 * the suite:
 *
 *   C1  a bare sine                      -> 1 partial, slope 1.00, 1-2 bands
 *   C2  a bare noise burst               -> no body at all: lowFrac 0.00, slope 0
 *   C3  a SATURATED sine, static pitch   -> rich (7 partials) but NO pitch envelope
 *   C4  a swept sine, no saturation      -> real envelope but NO harmonic content
 *   C5  saturated + swept + detuned      -> a single layer with every trick applied,
 *                                           and it still only lights TWO bands
 *
 * C5 is the important one. It is not a straw man — it is a genuinely rich single
 * layer, and the suite must still be able to tell it apart from a real stack. It is
 * what stops "add more saturation" from being mistaken for "add a transient".
 */
async function modeDepth(page) {
  console.log('\n── depth: layer structure, the room, and the node budget ──');

  const CONTROLS = [
    ['C1 bare sine', `(s) => A.tone(s, { type: 'sine', freq: 180, peak: 0.6, duration: 0.2 })`],
    ['C2 bare noise', `(s) => A.noiseBurst(s, { filter: 'bandpass', freq: 2000, q: 1, peak: 0.6, duration: 0.2 })`],
    ['C3 sat sine, static', `(s) => A.tone(s, { type: 'sine', freq: 180, peak: 0.6, duration: 0.2, drive: 2.5 })`],
    ['C4 swept sine, clean', `(s) => A.tone(s, { type: 'sine', freq: [220, 62], peak: 0.6, duration: 0.2 })`],
    ['C5 sat+swept+detuned', `(s) => A.tone(s, { type: 'sine', freq: [220, 62], peak: 0.6, duration: 0.2, drive: 2.5, voices: 2, detuneCents: 16 })`],
  ];

  // One representative impact per character, plus the generic family every
  // unconverted weapon still falls back to.
  const cat = await impactCatalogue(page);
  const heaviest = {};
  for (const [id, ws] of Object.entries(cat)) {
    heaviest[id] = ws.reduce((a, b) => (b.damage > a.damage ? b : a));
  }
  const HITS = [
    ['generic.impact(4)', `S.impact(4)`, 4],
    ['generic.impact(16)', `S.impact(16)`, 16],
    ['generic.death', `S.death()`, 16],
    ['generic.hurt.crit', `S.hurt(0.15)`, 16],
    ...Object.entries(heaviest).map(([id, w]) => [
      `${id}.${w.key}`, weaponExpr(id, w.key, 'impact', w.damage), w.damage,
    ]),
  ];
  // Short sounds too, so the DECAY SPREAD assertion covers the whole range and not
  // only the hits.
  const OTHERS = [
    ['generic.uiClick', `S.uiClick()`],
    ['generic.coverThud', `S.coverThud()`],
    ['generic.castGiantSlam', `S.castGiantSlam()`],
    ['generic.castSelf', `S.castSelf()`],
  ];

  const measure = (expr) =>
    page.evaluate(async ([e]) => {
      const S = window.__A.sounds;
      const W = window.__A;
      const A = window.__A.audio;
      // eslint-disable-next-line no-eval
      const fn = eval(e);
      return window.__depth(fn, { seed: 4242 });
    }, [expr]);

  console.log('  id                        nodes  bands (L/M/H)        partials  pitchSlope  low<250  extent  dExt(room)   late wet/dry');
  const show = (id, r) =>
    console.log(
      `  ${id.padEnd(24)} ${String(r.nodes).padStart(5)}  ${r.bands} (${r.bandRel.map((v) => v.toFixed(2)).join('/')})` +
      `  ${String(r.partials).padStart(7)}  ${r.pitchSlope.toFixed(2).padStart(9)}  ${r.lowFrac.toFixed(3).padStart(6)}` +
      `  ${r.extentWet.toFixed(3)}   ${(r.extentWet - r.extentDry).toFixed(3).padStart(6)}     ${r.lateWet.toExponential(1)}/${r.lateDry.toExponential(1)}`,
    );

  // ── The controls. Every one of these MUST fail the layer test. ────────────
  console.log('  --- single-layer CONTROLS (these must FAIL) ---');
  const ctl = {};
  for (const [id, expr] of CONTROLS) {
    const r = await measure(expr);
    ctl[id] = r;
    show(id, r);
  }
  check('CONTROL C1 (bare sine) fails the harmonic-content test', ctl['C1 bare sine'].partials <= 1,
    `${ctl['C1 bare sine'].partials} partials`);
  check('CONTROL C1 (bare sine) fails the pitch-envelope test', ctl['C1 bare sine'].pitchSlope < 1.25,
    `slope=${ctl['C1 bare sine'].pitchSlope.toFixed(2)}`);
  check('CONTROL C2 (bare noise) fails the low-end test', ctl['C2 bare noise'].lowFrac < 0.05,
    `lowFrac=${ctl['C2 bare noise'].lowFrac.toFixed(3)}`);
  check('CONTROL C2 (bare noise) fails the pitch-envelope test (no body to measure)',
    ctl['C2 bare noise'].pitchSlope < 1.25, `slope=${ctl['C2 bare noise'].pitchSlope.toFixed(2)}`);
  check('CONTROL C3 (saturated but static) fails the pitch-envelope test',
    ctl['C3 sat sine, static'].pitchSlope < 1.25, `slope=${ctl['C3 sat sine, static'].pitchSlope.toFixed(2)}`);
  check('CONTROL C4 (swept but clean) fails the harmonic-content test',
    ctl['C4 swept sine, clean'].partials <= 1, `${ctl['C4 swept sine, clean'].partials} partials`);
  check('CONTROL C5 (a rich SINGLE layer) still fails the three-band test',
    ctl['C5 sat+swept+detuned'].bands < 3, `${ctl['C5 sat+swept+detuned'].bands} bands`);
  // The instrument proving itself: the ONLY difference between C1 and C3 is the
  // saturator, and it has to move the partial count from 1 to many or the whole
  // harmonic-content claim is unmeasured.
  check('the partial counter responds to saturation (C1 vs C3, same pitch, same envelope)',
    ctl['C3 sat sine, static'].partials >= 4 && ctl['C1 bare sine'].partials <= 1,
    `C1=${ctl['C1 bare sine'].partials} -> C3=${ctl['C3 sat sine, static'].partials} partials`);
  check('the pitch tracker responds to a sweep (C3 vs C4, same synthesis otherwise)',
    ctl['C4 swept sine, clean'].pitchSlope > 1.25,
    `C3=${ctl['C3 sat sine, static'].pitchSlope.toFixed(2)} -> C4=${ctl['C4 swept sine, clean'].pitchSlope.toFixed(2)}`);

  // ── The real hits. ────────────────────────────────────────────────────────
  console.log('  --- every character\'s heaviest hit, plus the generic fallback ---');
  const hit = {};
  for (const [id, expr, dmg] of HITS) {
    const r = await measure(expr);
    hit[id] = { ...r, damage: dmg };
    show(id, r);
  }
  for (const [id, expr, dmg] of HITS) {
    const r = hit[id];
    check(`${id}: three layers are measurably present (transient + body + texture)`, r.bands === 3,
      `bands=${r.bands} (${r.bandRel.map((v) => v.toFixed(2)).join('/')})`);
    check(`${id}: harmonic content beyond a test tone (>= 3 partials; a bare sine scores 1)`,
      r.partials >= 3, `${r.partials} partials @ ${JSON.stringify(r.peaks)}`);
    check(`${id}: the body has a real pitch envelope (>= 1.25x; a static tone scores 1.00)`,
      r.pitchSlope >= 1.25, `slope=${r.pitchSlope.toFixed(2)}`);
    void expr; void dmg;
  }
  // LOW END, asserted where it means something: any hit meant to land.
  //
  // Measured as the low band's PEAK relative to the loudest band, not as its share of
  // total ENERGY. The energy fraction trades off directly against brightness, so
  // asserting it would quietly forbid a bright character from ever having weight —
  // and the two are independent in reality. A bare bandpass-noise control scores
  // 0.02-0.03 here, so the test still fails everything with no low layer at all.
  for (const [id, , dmg] of HITS) {
    if (dmg < 8) continue;
    check(`${id}: has real low end (low band peaks at >= 25% of the loudest band)`,
      hit[id].bandRel[0] >= 0.25,
      `lowBand=${hit[id].bandRel[0].toFixed(2)} lowFrac=${hit[id].lowFrac.toFixed(3)}`);
  }

  // ── The room. The A/B, not the wiring. ────────────────────────────────────
  const others = {};
  for (const [id, expr] of OTHERS) {
    const r = await measure(expr);
    others[id] = r;
    show(id, r);
  }
  const all = { ...hit, ...others };
  //
  // The per-sound claim is the unambiguous one: in a window starting 20 ms AFTER the
  // sound's own declared end, the dry render has EXACTLY zero energy — the envelopes
  // are hard-zeroed there by construction — and the wet render does not. Anything
  // measured in that window is the room and can be nothing else.
  //
  // How far the -66 dBFS extent moves is reported per sound but asserted across the
  // CATALOGUE, because a sound whose own tail is long and quiet (Burrito's grain
  // cloud, the heal triad) has its reflections riding underneath its own decay. That
  // is correct physics, not a missing room, and the A/B above already proves it.
  for (const id of Object.keys(all)) {
    const r = all[id];
    check(`${id}: the room contributes energy past the sound's own end (dry is bit-zero there)`,
      r.lateDry === 0 && r.lateWet > 0,
      `late wet=${r.lateWet.toExponential(2)} dry=${r.lateDry.toExponential(2)} dExt=${(r.extentWet - r.extentDry).toFixed(3)}s`);
  }
  const dExts = Object.values(all).map((r) => r.extentWet - r.extentDry);
  const meanDExt = dExts.reduce((a, b) => a + b, 0) / dExts.length;
  check('the room measurably lengthens the catalogue (mean added tail > 0.03 s)', meanDExt > 0.03,
    `mean=${meanDExt.toFixed(3)}s min=${Math.min(...dExts).toFixed(3)} max=${Math.max(...dExts).toFixed(3)}`);
  // ...and the room must stay a room. Before this was measured the reverb return was
  // set by ear at 0.85 and the reflections were LOUDER than the dry body 75 ms into an
  // ordinary impact, which flattened every pitch envelope in the game.
  const roomiest = Math.max(...Object.values(all).map((r) => r.extentWet - r.extentDry));
  check('the room is a small kitchen, not a hall (longest added tail < 0.30 s)', roomiest < 0.3,
    `${roomiest.toFixed(3)} s`);

  // ── Decay spread: "envelopes too fast and uniform". ───────────────────────
  const exts = Object.entries(all).map(([id, r]) => [id, r.extentWet]).sort((a, b) => a[1] - b[1]);
  const spread = exts[exts.length - 1][1] / exts[0][1];
  console.log(`  decay spread: shortest ${exts[0][0]}=${exts[0][1].toFixed(3)}s  longest ${exts[exts.length - 1][0]}=${exts[exts.length - 1][1].toFixed(3)}s  ratio=${spread.toFixed(2)}x`);
  check('the catalogue spans more than one decay texture (longest / shortest > 4x)', spread > 4,
    `${spread.toFixed(2)}x`);

  // ── Node census: the mobile assertion. ────────────────────────────────────
  const worst = Object.entries(all).sort((a, b) => b[1].nodes - a[1].nodes)[0];
  const totals = Object.values(all).map((r) => r.nodes);
  console.log(`  node census: worst single sound = ${worst[0]} at ${worst[1].nodes} nodes; median ${totals.sort((a, b) => a - b)[totals.length >> 1]}`);
  check('no single sound exceeds the per-voice node budget (150)', worst[1].nodes <= 150,
    `${worst[0]} = ${worst[1].nodes} nodes`);
  /**
   * THE CPU BUDGET, measured rather than reasoned about.
   *
   * Mobile is a target and this pass added a convolution and roughly 3x the nodes per
   * voice, so "is it still cheap enough" stopped being answerable by reading the code.
   * A full 20-voice frame is rendered offline and timed against the audio it produced:
   * the ratio is how many times faster than real time this machine can synthesise the
   * worst case the voice budget allows. A phone is perhaps 5-10x slower than a desktop,
   * so the floor is set well above 1 and the actual figure is printed every run — a
   * future change that halves the headroom will be visible before it is audible.
   */
  const rt = await page.evaluate(async () => {
    const audio = window.__A.audio;
    const S = window.__A.sounds;
    const sr = 44100, seconds = 2;
    const ctx = new OfflineAudioContext(2, sr * seconds, sr);
    const e = new audio.AudioEngine({ context: ctx, persist: false });
    // The worst case the budget permits: a full 20 voices, the most expensive sounds
    // in the game among them, all overlapping.
    const heavy = [
      () => S.castGiantSlam(), () => S.death(), () => S.impact(16), () => S.impact(4),
      () => S.hurt(0.15), () => S.castMelee(12, 80), () => S.castRanged(8), () => S.hazardTick(),
    ];
    for (let i = 0; i < 20; i++) e.play(heavy[i % heavy.length](), { seed: i * 977, pan: (i % 5) / 4 - 0.5 });
    const t0 = performance.now();
    await ctx.startRendering();
    const ms = performance.now() - t0;
    return { ms, realtimeFactor: (seconds * 1000) / ms };
  });
  console.log(`  CPU: a full 20-voice frame renders ${rt.realtimeFactor.toFixed(1)}x faster than real time (${rt.ms.toFixed(0)} ms for 2 s of audio)`);
  check('a full 20-voice frame renders well faster than real time (>= 8x here)',
    rt.realtimeFactor >= 8, `${rt.realtimeFactor.toFixed(1)}x`);

  check('the shared room costs ONE convolver for the page, not one per voice',
    await page.evaluate(async () => {
      const audio = window.__A.audio;
      const sr = 44100;
      const ctx = new OfflineAudioContext(1, sr, sr);
      let convolvers = 0;
      const orig = ctx.createConvolver.bind(ctx);
      ctx.createConvolver = (...a) => { convolvers++; return orig(...a); };
      const e = new audio.AudioEngine({ context: ctx, persist: false });
      for (let i = 0; i < 12; i++) e.play(window.__A.sounds.impact(10), { seed: i });
      return convolvers === 1;
    }), '12 voices, 1 convolver');
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
  // Determinism is asserted as a RATIO, not against an absolute floor.
  //
  // Two renders of the same seed are not bit-identical and never were: the offline
  // renderer's own arithmetic drifts by about one float32 ULP (1.19e-7) per stage of
  // the graph, and adding the shared reverb took that from one ULP to two. An
  // absolute tolerance therefore encodes the graph's DEPTH, and quietly fails the
  // next time a stage is added — which is exactly what happened here, on a change
  // that had nothing to do with determinism.
  //
  // The claim that matters is that same-seed drift is negligible NEXT TO real
  // variation, and as a ratio that is five orders of magnitude of headroom rather
  // than a number tuned to today's node count.
  const ulp = 1.1920929e-7;
  console.log(`  same-seed drift ${(res.sameSeed / ulp).toFixed(1)} float32 ULP; different-seed difference ${res.diffSeed.toFixed(4)} (${(res.diffSeed / res.sameSeed).toExponential(1)}x larger)`);
  check('same seed renders identically (drift is float arithmetic, <= 8 ULP)',
    res.sameSeed <= ulp * 8, `maxDiff=${res.sameSeed.toExponential(2)} = ${(res.sameSeed / ulp).toFixed(1)} ULP`);
  check('same-seed drift is negligible against real variation (>10000x apart)',
    res.diffSeed / res.sameSeed > 1e4, `${(res.diffSeed / res.sameSeed).toExponential(1)}x`);
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

  // ── The shrug-off ────────────────────────────────────────────────────────
  //
  // The hardest thing to assert here is a NEGATIVE that used to be free: a refused
  // status is not in the event stream at all, so before this the director could not
  // have been wrong about it. Now it can, in both directions, and both are asserted.
  const st = (o) => page.evaluate((opt) => window.__renderStatusHit(opt), o);
  const landed = await st({ refused: false });
  const refused = await st({ refused: true });
  const dB = 20 * Math.log10(refused.hp1200 / Math.max(1e-12, landed.hp1200));
  console.log(`  shrug-off: landed voices=${landed.started} peak=${landed.peak.toFixed(4)}; ` +
    `refused voices=${refused.started} peak=${refused.peak.toFixed(4)}; ` +
    `>1.2 kHz ${landed.hp1200.toExponential(2)} -> ${refused.hp1200.toExponential(2)} (${dB >= 0 ? '+' : ''}${dB.toFixed(1)} dB)`);
  check('a stun that LANDED voices the impact alone', landed.started === 1, `voices=${landed.started}`);
  check('a stun that was REFUSED adds exactly one voice', refused.started === 2, `voices=${refused.started}`);
  // The whole point of the cue: it has to survive being played on top of the hit it
  // annotates. Above 1.2 kHz is where `impact()` is thinnest (its body and sub are
  // under 250 Hz) and where the shrug-off lives.
  check('the refusal is audible THROUGH the hit (> +4 dB above 1.2 kHz)', dB > 4,
    `${dB >= 0 ? '+' : ''}${dB.toFixed(1)} dB`);
  // ...and it must not become the hit. A refusal is an annotation, not an event.
  check('the refusal does not outweigh the impact it rides on',
    refused.peak < landed.peak * 1.35,
    `peak ${landed.peak.toFixed(4)} -> ${refused.peak.toFixed(4)}`);

  // The three ways this could fire when it must not.
  const slowRefused = await st({ refused: true, effect: 'slow' });
  check('a refused SLOW is silent — 460 of them per 27.9 min, see sounds.ts',
    slowRefused.started === 1, `voices=${slowRefused.started}`);
  const afterReset = await st({ refused: true, resetBetween: true });
  check('reset() clears the snapshot, so match two\'s first stun is not a shrug-off',
    afterReset.started === 1, `voices=${afterReset.started}`);
  // The duck-typed states every other assertion in this mode uses carry no `status`.
  // "Cannot tell" must mean silence, or every dispatch test above would have gained a
  // voice the moment this landed.
  const noStatus = await run([{ ...ev.hitEnemy, effect: 'stun' }]);
  check('a state carrying no `status` voices no shrug-off (cannot tell != refused)',
    noStatus.started === 1, `voices=${noStatus.started}`);
}

// ─────────────────────────────────────────────────────────────────────────────
// coverage — the event map, the sim states that arrived with the 45 s clock, the mix
// ─────────────────────────────────────────────────────────────────────────────

/**
 * Measured by `tools/tmp/audio_census.mjs` over the REAL `src/game/sim.ts`, 121
 * matchups per policy, at `MATCH_DURATION_MS = 45 s`. Quoted here so the thresholds
 * below are traceable to a number rather than to a guess, and so a future clock change
 * that invalidates them is visible.
 */
const CENSUS = {
  perMatch: {
    'countdown-tick': 5.0, 'match-started': 1.0, 'match-ended': 1.0,
    'weapon-fired': 27.49, 'projectile-spawned': 36.84, 'projectile-destroyed': 36.16,
    'hit-landed': 33.21, heal: 0.02, death: 1.0, 'splat-created': 2.6,
    'trail-mark-created': 14.26,
  },
  /** The loudest single 16.7 ms tick found anywhere in 363 matches: a 5-pellet Rice
   *  Spray landing on the LOCAL player (so every impact carries a `hurt` layer too)
   *  while both fighters cast. 15 director voice requests. */
  worstTickVoices: 15,
  maxTrailHitsPerTick: 2,
};

/** The master chain's own constants, mirrored from `src/audio/engine.ts`. */
const CLIP = { knee: 0.7, ceil: 1.2, span: 3 };

/**
 * Recover the summed level AT THE LIMITER INPUT from a peak measured at the master
 * output. That is the only place the question "is the mix gain-staged correctly"
 * has an answer: the soft-clip curve is transparent below `knee` and compressing
 * above it, so a sound's headroom is `knee / level`, and a sound already past the
 * knee on its own is one that will squash everything it lands with.
 *
 * This is the direct descendant of the bug in `docs/STATE.md`: a compressor eating
 * 8.2 dB on a signal 6 dB below its own threshold. A static curve cannot do that —
 * but only a measurement can show it is not doing it.
 */
function preLimiterLevel(peakOut, masterGain) {
  const y = peakOut / masterGain;
  if (y <= CLIP.knee) return y;
  const t = (y - CLIP.knee) / (CLIP.ceil - CLIP.knee);
  if (t >= 1) return Infinity; // beyond the curve's asymptote — impossible in practice
  return CLIP.knee + (CLIP.ceil - CLIP.knee) * Math.atanh(t);
}
const dB = (x) => (x > 0 ? 20 * Math.log10(x) : -Infinity);
/** L1 distance between two normalised 8-band profiles. Bounded [0, 2]. */
const bandDist = (a, b) => a.reduce((s, v, i) => s + Math.abs(v - b[i]), 0);

async function modeCoverage(page) {
  console.log('\n── coverage: every GameEvent kind, the new sim states, and the mix ──');
  const run = (list, opt) => page.evaluate(([l, o]) => window.__renderEvents(l, o), [list, opt ?? {}]);
  const masterGain = await page.evaluate(() => window.__A.engineMod.gainForVolume(1));

  // ── 1. THE MAP. Every GameEvent kind, and what it produces. ─────────────
  //
  // `GameEvent` is a closed union in `src/game/state.ts`. The table below must name
  // every member of it — the last assertion in this block compares this list against
  // the union parsed out of the source, so a NEW event kind added by the sim cannot
  // land without an audio decision being made about it. That is the failure this
  // whole mode exists to prevent: the sim changed materially this session and audio
  // was written before any of it existed.
  const hit = (over) => ({
    type: 'hit-landed', targetRole: 'enemy', amount: 12, effect: null,
    source: { kind: 'weapon', weaponKey: 'Splash', weaponName: 'Soup Splash' }, x: 100, y: 0, ...over,
  });
  const MAP = [
    { kind: 'countdown-tick', expect: 'voiced', sound: 'countdownTick(value)', events: [{ type: 'countdown-tick', value: 3 }] },
    { kind: 'match-started', expect: 'voiced', sound: 'matchStart()', events: [{ type: 'match-started' }] },
    { kind: 'match-ended', expect: 'voiced', sound: 'matchEnd(won) | matchEndTimeout(won)', events: [{ type: 'match-ended', winner: 'player' }] },
    { kind: 'weapon-fired', expect: 'voiced', sound: 'weapon cast (bespoke or generic)', events: [{ type: 'weapon-fired', fighterRole: 'player', weaponKey: 'Splash' }] },
    { kind: 'projectile-spawned', expect: 'silent', sound: '— represented by weapon-fired', events: [{ type: 'projectile-spawned', id: 2, ownerRole: 'player', weaponKey: 'Splash', x: 5, y: 0, color: '#E8792A', emoji: '💦' }] },
    { kind: 'projectile-destroyed:hit-cover', expect: 'voiced', sound: 'coverThud()', events: [{ type: 'projectile-destroyed', id: 1, reason: 'hit-cover', x: 60, y: 0 }] },
    { kind: 'projectile-destroyed:hit-target', expect: 'silent', sound: '— the hit-landed voices it', events: [{ type: 'projectile-destroyed', id: 1, reason: 'hit-target', x: 60, y: 0 }] },
    { kind: 'projectile-destroyed:expired', expect: 'silent', sound: '— a shot fading out at max range', events: [{ type: 'projectile-destroyed', id: 1, reason: 'expired', x: 60, y: 0 }] },
    { kind: 'hit-landed:weapon', expect: 'voiced', sound: 'weapon impact (bespoke or generic)', events: [hit()] },
    { kind: 'hit-landed:weapon(on me)', expect: 'voiced', sound: 'impact + hurt(health)', events: [hit({ targetRole: 'player', x: 0 })] },
    { kind: 'hit-landed:trail', expect: 'voiced', sound: 'trailTick()', events: [hit({ source: { kind: 'trail', ownerRole: 'enemy' } })] },
    { kind: 'hit-landed:hazard', expect: 'voiced', sound: 'hazardTick()', events: [hit({ source: { kind: 'hazard' } })] },
    { kind: 'hit-landed:fog', expect: 'voiced', sound: 'fogTick(), throttled to 900 ms', events: [hit({ source: { kind: 'fog' }, targetRole: 'player', x: 0 })] },
    { kind: 'heal', expect: 'voiced', sound: 'heal()', events: [{ type: 'heal', fighterRole: 'player', amount: 2 }] },
    { kind: 'death', expect: 'voiced', sound: 'death()', events: [{ type: 'death', fighterRole: 'enemy' }] },
    { kind: 'splat-created', expect: 'silent', sound: '— the impact that made it', events: [{ type: 'splat-created', x: 40, y: 0 }] },
    { kind: 'trail-mark-created', expect: 'silent', sound: '— fires every few hundred ms while moving', events: [{ type: 'trail-mark-created', ownerRole: 'player', x: 20, y: 0 }] },
  ];

  console.log('\n  EVENT COVERAGE MAP                                            per match   peakMax     rms  voices');
  for (const row of MAP) {
    const r = await run(row.events);
    const rate = CENSUS.perMatch[row.kind.split(':')[0]];
    console.log(
      `  ${row.kind.padEnd(30)} ${row.sound.padEnd(30)} ${(rate ?? 0).toFixed(2).padStart(7)}  ${r.peakMax.toFixed(4)} ${r.rms.toFixed(5)}  ${String(r.started).padStart(3)}`,
    );
    if (row.expect === 'voiced') {
      check(`map: ${row.kind} is VOICED`, r.peakMax > 0.01 && r.started > 0,
        `peak=${r.peakMax.toFixed(4)} voices=${r.started}`);
    } else {
      check(`map: ${row.kind} is deliberately SILENT`, r.peakMax === 0 && r.started === 0,
        `peak=${r.peakMax} voices=${r.started}`);
    }
  }

  // Every member of the `GameEvent` union, parsed out of the source rather than
  // listed by hand. A new event kind must not be able to arrive unvoiced and
  // unnoticed — which is exactly what happened to `resolveTimeout` and the ring floor
  // this session, and cost this whole investigation.
  //
  // `?raw`, not a plain fetch. Vite TRANSPILES `/src/game/state.ts` on the way out and
  // a type-only union erases to nothing, so the obvious version of this parsed an empty
  // string, found zero kinds, and PASSED — a vacuous green exactly like the SPA-fallback
  // trap in `docs/LESSONS.md` §12. The count is printed and asserted non-empty so it
  // cannot happen again.
  const unionKinds = await page.evaluate(async () => {
    const mod = await import('/src/game/state.ts?raw');
    const src = mod.default;
    const start = src.indexOf('export type GameEvent =');
    const end = src.indexOf(';', src.indexOf('trail-mark-created'));
    const body = src.slice(start, end);
    return [...body.matchAll(/type:\s*'([a-z-]+)'/g)].map((m) => m[1]);
  });
  check('the GameEvent union was actually parsed (not a vacuous pass)',
    unionKinds.length >= 8, `${unionKinds.length} kinds parsed out of state.ts`);
  const covered = new Set(MAP.map((r) => r.kind.split(':')[0]));
  const missing = unionKinds.filter((k) => !covered.has(k));
  console.log(`\n  GameEvent union has ${unionKinds.length} kinds; the map covers ${covered.size}`);
  check('every GameEvent kind in state.ts has a coverage-map decision',
    missing.length === 0, missing.length ? `uncovered: ${missing.join(', ')}` : `${unionKinds.length} kinds`);

  // ── 2. THE NEW SIM STATES ────────────────────────────────────────────────
  console.log('\n  ── states that arrived with the 45 s clock ──');

  /**
   * Mean 8-band profile over `n` renders, plus the instrument's OWN noise floor: the
   * mean pairwise distance between those n renders of the SAME thing. Every
   * separation claimed below is stated as a multiple of that floor, so it cannot be a
   * number nobody chose (`docs/LESSONS.md` §13 — validate the instrument against a
   * known input before believing it on an unknown one).
   */
  const meanBands = (rs) => rs[0].bands.map((_, i) => rs.reduce((s, r) => s + r.bands[i], 0) / rs.length);
  /** Deterministic 3-vs-3 splits of six renders. See `selfFloor`. */
  const SPLITS = [[[0, 1, 2], [3, 4, 5]], [[0, 2, 4], [1, 3, 5]], [[0, 3, 5], [1, 2, 4]]];
  /**
   * The instrument's own noise floor, measured as the SAME KIND OF QUANTITY as the
   * number it calibrates: the L1 distance between two MEAN profiles of the same sound.
   *
   * The first version averaged pairwise distances between INDIVIDUAL renders, and that
   * is a different quantity — `fogTick` is two noise bursts with no pitched layer, so
   * single renders scatter by 0.34 while their means scatter by an order less. Comparing
   * a mean-to-mean distance against a render-to-render floor rejected a genuine 1.14
   * separation as noise. The halves here are of THREE renders against the six the cross
   * distance uses, so the floor is measured on a noisier sample than the thing it
   * gates — deliberately conservative.
   */
  const selfFloor = (runs) => {
    let s = 0;
    for (const [a, b] of SPLITS) s += bandDist(meanBands(a.map((i) => runs[i])), meanBands(b.map((i) => runs[i])));
    return s / SPLITS.length;
  };
  const profile = async (list, opt, n = 6) => {
    const runs = [];
    for (let i = 0; i < n; i++) runs.push(await run(list, { ...(opt ?? {}), bands: true }));
    const bands = meanBands(runs);
    return {
      bands, self: selfFloor(runs),
      peakMax: runs.reduce((s, r) => s + r.peakMax, 0) / n,
      rms: runs.reduce((s, r) => s + r.rms, 0) / n,
      centroid: runs.reduce((s, r) => s + r.centroid, 0) / n,
      duration: runs.reduce((s, r) => s + r.duration, 0) / n,
      modDepth: runs.reduce((s, r) => s + r.mod.depth, 0) / n,
      modHz: runs.reduce((s, r) => s + r.mod.hz, 0) / n,
    };
  };
  const separated = (label, a, b, factor = 4) => {
    const d = bandDist(a.bands, b.bands);
    const floor = Math.max(a.self, b.self, 1e-6);
    console.log(`    ${label.padEnd(52)} L1=${d.toFixed(3)}  self=${floor.toFixed(3)}  x${(d / floor).toFixed(1)}   centroid ${Math.round(a.centroid)} vs ${Math.round(b.centroid)} Hz`);
    check(`${label} (>= ${factor}x the instrument's own noise floor)`, d >= floor * factor,
      `L1=${d.toFixed(3)} floor=${floor.toFixed(3)} ratio=${(d / floor).toFixed(1)}`);
    return d;
  };

  // (a) A match ending on the CLOCK must not sound like a knockout. `resolveTimeout`
  //     pushes no `death` event and leaves both fighters alive; that is the
  //     discriminant the director uses, so it is the one exercised here.
  const ended = (winner) => [{ type: 'match-ended', winner }];
  const ko = { playerAlive: false, enemyAlive: true, seconds: 2.5 };
  const to = { playerAlive: true, enemyAlive: true, seconds: 2.5 };
  const koWin = await profile(ended('player'), { ...ko, playerAlive: true, enemyAlive: false });
  const koLose = await profile(ended('enemy'), ko);
  const toWin = await profile(ended('player'), to);
  const toLose = await profile(ended('enemy'), to);
  console.log(`    knockout  win peak=${koWin.peakMax.toFixed(4)} dur=${koWin.duration.toFixed(2)}s   lose peak=${koLose.peakMax.toFixed(4)} dur=${koLose.duration.toFixed(2)}s`);
  console.log(`    timeout   win peak=${toWin.peakMax.toFixed(4)} dur=${toWin.duration.toFixed(2)}s   lose peak=${toLose.peakMax.toFixed(4)} dur=${toLose.duration.toFixed(2)}s  whistle mod=${toWin.modHz.toFixed(1)}Hz depth=${toWin.modDepth.toFixed(2)}`);
  check('a timeout ending is audible at all', toWin.peakMax > 0.02 && toLose.peakMax > 0.02,
    `win=${toWin.peakMax.toFixed(4)} lose=${toLose.peakMax.toFixed(4)}`);
  separated('timeout WIN vs knockout WIN', toWin, koWin);
  separated('timeout LOSS vs knockout LOSS', toLose, koLose);
  separated('timeout WIN vs timeout LOSS (verdict still readable)', toWin, toLose, 2);
  // The whistle is the layer doing the separating, so prove it is really a WHISTLE and
  // not just a band of noise. Two claims, both about the layer rather than the sound:
  //
  //  1. It warbles. A pea whistle does; the tremolo is authored at 24 Hz. Measured over
  //     the WHOLE 1.11 s sound the detector reports 9.6 Hz, and that is the detector
  //     being right: the whistle occupies only the first 0.62 s and the verdict notes
  //     that follow carry no modulation at all, so the dominant envelope feature across
  //     the full span is the two-blast structure, not the warble. Rendering a 0.6 s
  //     context truncates the buffer to the whistle alone and asks the question that was
  //     actually meant. (`docs/LESSONS.md` §13: an instrument pointed at the wrong window
  //     returns a plausible number for the wrong thing.)
  //     0.27 s, not 0.6 s: the sound has TWO blasts with a 0.10 s gap between them, and
  //     that gap is a far bigger envelope feature than the warble riding on top of it.
  //     Measured over both blasts the detector returns 8.3 Hz — a harmonic of the
  //     2.8 Hz blast structure — which is the detector correctly reporting the loudest
  //     modulation in its window and the window being the wrong one. One blast, one
  //     question.
  //
  //     And the claim is made on the FREQUENCY'S STABILITY ACROSS SEEDS, not on the
  //     depth. The depth figure was tried first and a control killed it: `fogTick` is
  //     bandpassed noise with no tremolo anywhere in it and it reads depth 0.110, more
  //     than DOUBLE the whistle's 0.047. A bandpass at Q=10 passes ~290 Hz, and filtered
  //     noise has a randomly fluctuating envelope of its own, so the demodulator finds
  //     something in every noise burst — raising the authored depth from 0.7 to 0.85
  //     moved the measurement by 0.001, which is how it is known the number is floored
  //     by the noise and says nothing about the tremolo. What separates a real
  //     modulation from that is CONSISTENCY: a coherent 24 Hz LFO lands in the same bin
  //     every render, and a noise artefact does not.
  const modSweep = async (expr, seconds) => {
    const hz = [];
    for (let i = 0; i < 5; i++) hz.push((await renderById(page, expr, { seconds, volume: 1, seed: 1000 + i * 7919 })).mod.hz);
    const mean = hz.reduce((a, b) => a + b, 0) / hz.length;
    return { hz, mean, sd: Math.sqrt(hz.reduce((s, v) => s + (v - mean) ** 2, 0) / hz.length) };
  };
  //
  //     The control has to be MATCHED, and the first two attempts were not. `fogTick`
  //     reads 53.8 Hz with an sd of 3.4 — more STABLE than the whistle, at a rate set by
  //     its own filter bandwidth rather than by any modulation — so "the whistle's rate
  //     is stable" is not the discriminator either. The only control that isolates the
  //     tremolo is the SAME LAYER with the tremolo removed: identical filter, Q, level,
  //     duration and seed, one line different. Reconstructed here rather than exported
  //     from `sounds.ts`, because the shipped sound must not grow a test-only variant.
  const blast = (trem) => `(s) => W.audio.noiseBurst(s, { filter: 'bandpass', freq: 2900, q: 10,`
    + ` peak: 0.7, attack: 0.012, hold: 0.45, duration: 0.26,`
    + (trem ? ` tremolo: { rate: 24, depth: 0.7 },` : ``)
    + ` wet: 0.06 })`;
  const withTrem = await modSweep(blast(true), 0.3);
  const noTrem = await modSweep(blast(false), 0.3);
  const whistleMod = await modSweep(`S.matchEndTimeout(true)`, 0.27);
  console.log(`    matched A/B on the whistle layer, 5 seeds each:`);
  console.log(`      tremolo ON : ${withTrem.hz.map((h) => h.toFixed(1)).join(' ')} Hz  (mean ${withTrem.mean.toFixed(1)}, sd ${withTrem.sd.toFixed(1)})`);
  console.log(`      tremolo OFF: ${noTrem.hz.map((h) => h.toFixed(1)).join(' ')} Hz  (mean ${noTrem.mean.toFixed(1)}, sd ${noTrem.sd.toFixed(1)})`);
  console.log(`    the shipped sound: ${whistleMod.hz.map((h) => h.toFixed(1)).join(' ')} Hz  (mean ${whistleMod.mean.toFixed(1)})`);
  //     And the discriminator is the SPREAD, not the mean. Measured, the unmodulated
  //     control's mean sits at 27.3 Hz — right next to the authored 24 — purely by
  //     chance, because the demodulator returns SOMETHING for every noise burst. What it
  //     cannot fake is landing in the same bin every time: with the tremolo on, five
  //     seeds give sd 0.9 Hz; with it off, sd 8.6 Hz. A mean-based test would have
  //     passed the control and been worthless.
  check('the tremolo reaches the output: with it ON, five seeds agree on 24 Hz',
    Math.abs(withTrem.mean - 24) <= 5 && withTrem.sd <= 2,
    `mean ${withTrem.mean.toFixed(1)} Hz sd ${withTrem.sd.toFixed(1)} vs authored 24`);
  check('CONTROL: with the tremolo OFF the same layer agrees on nothing',
    noTrem.sd >= 4, `mean ${noTrem.mean.toFixed(1)} Hz sd ${noTrem.sd.toFixed(1)}`);
  check('the shipped timeout whistle carries that warble',
    Math.abs(whistleMod.mean - 24) <= 8, `mean ${whistleMod.mean.toFixed(1)} Hz vs authored 24`);
  // Duration is the other discriminator, and the most robust one: the whistle makes the
  // timeout ending structurally longer, which no amount of spectral similarity can hide.
  check('a timeout ending is measurably longer than a knockout',
    toWin.duration > koWin.duration * 1.4 && toLose.duration > koLose.duration * 1.4,
    `win ${koWin.duration.toFixed(2)}s -> ${toWin.duration.toFixed(2)}s, loss ${koLose.duration.toFixed(2)}s -> ${toLose.duration.toFixed(2)}s`);
  //  2. It lives where a whistle lives. Band 5 of the 8-band profile spans 1.97-3.96 kHz
  //     and the whistle is authored at 2.9 kHz; `matchEnd` has no noise layer at all, so
  //     this names the MECHANISM of the separation measured above rather than restating it.
  //     Compared over the SAME 0.6 s window in both endings. Over the full sound the
  //     comparison is unfair in the timeout's favour-then-against: the whistle occupies
  //     only the first half, and the verdict notes that follow are shared between the
  //     two. Truncating the render to 0.6 s asks "in the window where the whistle plays,
  //     is it there" — which is the question.
  const koHead = await renderById(page, `S.matchEnd(true)`, { seconds: 0.6, volume: 1, bands: true });
  const toHead = await renderById(page, `S.matchEndTimeout(true)`, { seconds: 0.6, volume: 1, bands: true });
  console.log(`    1.97-3.96 kHz share over the first 0.6 s: timeout ${(toHead.bands[5] * 100).toFixed(1)}%  knockout ${(koHead.bands[5] * 100).toFixed(1)}%`);
  check('the whistle dominates the 2-4 kHz band the knockout ending only grazes',
    toHead.bands[5] > koHead.bands[5] * 2, `${(toHead.bands[5] * 100).toFixed(1)}% vs ${(koHead.bands[5] * 100).toFixed(1)}%`);

  // (b) The ring reaching MIN_SAFE_RADIUS. State-derived: driven here through the real
  //     director on ticks carrying NO EVENTS AT ALL, which is the case that matters —
  //     ~96% of real ticks are empty and the crossing tick is almost certainly one.
  const zone = (radii, opt) => page.evaluate(([r, o]) => window.__renderZone(r, o), [radii, opt ?? {}]);
  const closing = [900, 600, 300, 160, 141, 140, 140, 140, 140, 140];
  const ring = await zone(closing, { seconds: 3 });
  console.log(`    ring floor: voices=${ring.started} peak=${ring.peakMax.toFixed(4)} dur=${ring.duration.toFixed(2)}s over ${closing.length} EMPTY ticks`);
  check('the ring reaching its floor is audible', ring.peakMax > 0.02 && ring.started > 0,
    `peak=${ring.peakMax.toFixed(4)} voices=${ring.started}`);
  check('the final-ring cue fires EXACTLY ONCE, not once per tick at the floor',
    ring.started === 1, `voices=${ring.started} over ${closing.filter((r) => r <= 140).length} ticks at the floor`);
  const never = await zone([900, 600, 300, 160, 145], { seconds: 3 });
  check('the cue does NOT fire while the ring is still closing', never.started === 0, `voices=${never.started}`);
  const inCountdown = await zone(closing, { phase: 'countdown', seconds: 3 });
  check('the cue does not fire during the countdown', inCountdown.started === 0, `voices=${inCountdown.started}`);
  // A ring that starts AT its floor (a hypothetical small arena) must not announce
  // itself on tick one — see `watchZone`'s `sawRingAboveFloor`.
  const degenerate = await zone([140, 140, 140, 140], { seconds: 3 });
  check('a ring that starts at its own floor does not announce itself',
    degenerate.started === 0, `voices=${degenerate.started}`);
  // The latch must clear on `reset()`, or every match after the first is silent here.
  // At a 45 s clock that is ~4x as many matches per hour as it used to be.
  const afterReset = await zone(closing, { reset: true, seconds: 3 });
  check('reset() re-arms the final-ring latch for the next match',
    afterReset.started === 2, `voices=${afterReset.started} (1 per match over 2 matches)`);

  // ── The kitchen ambience bed ──────────────────────────────────────────────
  // A bed is state, not an event, so it cannot be asserted the way everything else in
  // this mode is — and a state-driven sound that is wired but produces nothing is
  // exactly the failure this project keeps paying for (`docs/LESSONS.md` section 1).
  // Three claims: it runs during play, it does NOT run outside it, and it is the first
  // thing dropped under budget pressure rather than something that survives at the
  // expense of a hit.
  const bedPlaying = await run([], { phase: 'playing', safeRadius: 900, seconds: 3.5 });
  const bedIdle = await run([], { seconds: 3.5 });
  const bedCountdown = await run([{ type: 'countdown-tick', value: 3 }], { phase: 'countdown', safeRadius: 900, seconds: 3.5 });
  console.log(`  ambience: playing=${bedPlaying.startedAmbience} voice(s) peak=${bedPlaying.peak.toFixed(4)} · no-phase=${bedIdle.startedAmbience} · countdown=${bedCountdown.startedAmbience}`);
  check('the kitchen bed plays during a match, on a tick carrying no events at all',
    bedPlaying.startedAmbience === 1 && bedPlaying.peak > 0.005,
    `voices=${bedPlaying.startedAmbience} peak=${bedPlaying.peak.toFixed(4)}`);
  check('the kitchen bed does NOT play outside `phase: playing`',
    bedIdle.startedAmbience === 0 && bedCountdown.startedAmbience === 0,
    `no-phase=${bedIdle.startedAmbience} countdown=${bedCountdown.startedAmbience}`);
  check('the kitchen bed is Ambient priority, so a fight evicts it before it evicts a hit',
    bedPlaying.startedAmbience === 1 && bedPlaying.startedAll === bedPlaying.started + 1,
    `all=${bedPlaying.startedAll} sfx=${bedPlaying.started} bed=${bedPlaying.startedAmbience}`);

  const fog = await profile([hit({ source: { kind: 'fog' }, targetRole: 'player', x: 0 })], { seconds: 2.5 });
  const start = await profile([{ type: 'match-started' }], { seconds: 2.5 });
  const ringP = { bands: null, self: 0 };
  {
    const runs = [];
    for (let i = 0; i < 6; i++) runs.push(await zone(closing, { seconds: 3, bands: true }));
    ringP.bands = meanBands(runs);
    ringP.self = selfFloor(runs);
    ringP.centroid = runs.reduce((a, r) => a + r.centroid, 0) / 6;
  }
  separated('final ring vs a fog tick (release, not another nag)', ringP, fog);
  separated('final ring vs match START (the game\'s only other flow sting)', ringP, start);

  // (c) A melee swing that CONNECTS versus one that WHIFFS. `combat.ts` pushes
  //     `weapon-fired` unconditionally and melee at zero separation now MISSES for a
  //     coned weapon, so point-blank whiffs are newly common. There is no separate
  //     whiff sound by design — the impact IS the difference — so measure the
  //     difference rather than assuming it.
  const swing = [{ type: 'weapon-fired', fighterRole: 'player', weaponKey: 'Smash' }];
  const connect = [...swing, hit({ amount: 12, source: { kind: 'weapon', weaponKey: 'Smash', weaponName: 'Patty Smash' }, x: 60 })];
  const whiffP = await profile(swing, { playerId: 'hamburger', seconds: 2 });
  const connectP = await profile(connect, { playerId: 'hamburger', seconds: 2 });
  console.log(`    melee whiff peak=${whiffP.peakMax.toFixed(4)} rms=${whiffP.rms.toFixed(5)}   connect peak=${connectP.peakMax.toFixed(4)} rms=${connectP.rms.toFixed(5)}`);
  separated('melee CONNECT vs melee WHIFF', connectP, whiffP, 3);
  check('a connect is louder than a whiff', connectP.peakMax > whiffP.peakMax * 1.3,
    `${whiffP.peakMax.toFixed(4)} -> ${connectP.peakMax.toFixed(4)}`);

  // ── 3. THE MIX ───────────────────────────────────────────────────────────
  //
  // `docs/STATE.md`: "Audio compressor eating 8.2 dB on a signal 6 dB BELOW its own
  // threshold. The whole game would simply have been quiet." That class of bug is
  // measurable, and this is the measurement. Every level below is taken at the MASTER
  // OUTPUT of the production chain at volume 1.0, then referred back to the limiter's
  // input, which is the only place "gain-staged correctly" means anything.
  console.log('\n  ── mix: levels at the master output, volume 1.0 (master gain %s) ──'.replace('%s', masterGain.toFixed(4)));
  console.log('    sound                          peakMax   pre-limiter   headroom to knee    rms');
  const MIX = CATALOGUE.map((c) => ({ id: c.id, expr: c.expr }));
  const levels = [];
  for (const m of MIX) {
    const r = await renderById(page, m.expr, { volume: 1, seconds: 2.5 });
    const pre = preLimiterLevel(r.peakMax, masterGain);
    const head = dB(CLIP.knee / pre);
    levels.push({ id: m.id, peak: r.peakMax, pre, head, rms: r.rms });
    console.log(`    ${m.id.padEnd(30)} ${r.peakMax.toFixed(4)}      ${pre.toFixed(4)}      ${head >= 0 ? '+' : ''}${head.toFixed(1)} dB     ${r.rms.toFixed(5)}`);
  }
  const loudest = levels.reduce((a, b) => (b.pre > a.pre ? b : a));
  const quietest = levels.reduce((a, b) => (b.pre < a.pre ? b : a));
  const hot = levels.filter((l) => l.pre > CLIP.knee);
  console.log(`    AUTHORED spread ${dB(loudest.pre / quietest.pre).toFixed(1)} dB (${loudest.id} ${loudest.pre.toFixed(3)} -> ${quietest.id} ${quietest.pre.toFixed(3)})`);
  console.log(`    DELIVERED spread ${dB(Math.max(...levels.map((l) => l.peak)) / Math.min(...levels.map((l) => l.peak))).toFixed(1)} dB at the master output`);
  console.log(`    ${hot.length}/${levels.length} sounds are above the soft-clip knee ON THEIR OWN, worst-case (gain 1.0, centre)`);

  // ── What the soft clip is actually doing, and to what ──────────────────
  //
  // The knee is at 0.7 and the curve asymptotes at 1.2, so there are only 4.7 dB of
  // curve above the knee to absorb everything from 0.7 upward. Measured, the sounds
  // the DIRECTOR plays at gain 1.0 — the centre-panned match-flow stings, the ultimate
  // and the local player's own death — all sit above it, and the curve therefore
  // COMPRESSES THE TOP OF THE GAME'S DYNAMIC HIERARCHY TOWARD ONE LEVEL. That is
  // reported as a number rather than asserted away, because how loud the game should be
  // is a taste call and `docs/DECISIONS-FOR-URI.md` §7 parks taste.
  //
  // Everything else in the game reaches this bus through `place()`, whose distance gain
  // is at most 1 and typically well under it, so an ordinary hit is quieter than the
  // table above says. The table is the WORST case by construction.
  const FULL_GAIN = ['generic.castGiantSlam', 'generic.death', 'generic.ringFloor',
    'generic.matchStart', 'generic.matchEnd.win', 'generic.matchEnd.lose',
    'generic.matchEndTimeout.win', 'generic.matchEndTimeout.lose', 'generic.countdownTick'];
  const flow = levels.filter((l) => FULL_GAIN.includes(l.id)).sort((a, b) => b.pre - a.pre);
  console.log('    sounds the director plays at FULL level (centre, gain 1.0):');
  for (const l of flow) {
    console.log(`      ${l.id.padEnd(30)} authored ${l.pre.toFixed(3)}  delivered ${l.peak.toFixed(4)} FS   soft clip takes ${dB(l.peak / (l.pre * masterGain)).toFixed(1)} dB`);
  }
  const flowAuthored = dB(flow[0].pre / flow[flow.length - 1].pre);
  const flowDelivered = dB(flow[0].peak / flow[flow.length - 1].peak);
  console.log(`      -> authored ${flowAuthored.toFixed(1)} dB apart, delivered ${flowDelivered.toFixed(1)} dB apart`);

  // The claims that CAN be made honestly, and that a future tuning pass must not break.
  check('the loudness ORDER survives the soft clip (no pair is inverted)',
    flow.every((l, i) => i === 0 || flow[i - 1].peak >= l.peak - 1e-9),
    flow.map((l) => `${l.id.split('.').pop()}=${l.peak.toFixed(3)}`).join(' '));
  check('the ultimate is still the loudest thing in the game at the output',
    loudest.id === 'generic.castGiantSlam' &&
    levels.every((l) => l.id === 'generic.castGiantSlam' || l.peak <= levels.find((x) => x.id === 'generic.castGiantSlam').peak),
    `giantSlam=${levels.find((l) => l.id === 'generic.castGiantSlam').peak.toFixed(4)} FS`);
  check('the ultimate is at least 3 dB above an ordinary impact at the output',
    dB(levels.find((l) => l.id === 'generic.castGiantSlam').peak / levels.find((l) => l.id === 'generic.impact.small').peak) >= 3,
    `${dB(levels.find((l) => l.id === 'generic.castGiantSlam').peak / levels.find((l) => l.id === 'generic.impact.small').peak).toFixed(1)} dB`);
  check('the delivered catalogue still spans a real dynamic range (>= 12 dB)',
    dB(Math.max(...levels.map((l) => l.peak)) / Math.min(...levels.map((l) => l.peak))) >= 12,
    `${dB(Math.max(...levels.map((l) => l.peak)) / Math.min(...levels.map((l) => l.peak))).toFixed(1)} dB`);
  // The ceiling is structural, not a hope: the soft-clip curve asymptotes at
  // CLIP_CEIL and the master gain follows it, so nothing the game can do reaches 0 dBFS.
  check('the chain cannot digitally clip: ceil x master < 1.0',
    CLIP.ceil * masterGain < 1, `${(CLIP.ceil * masterGain).toFixed(3)} FS`);
  check('nothing in the catalogue reaches 0 dBFS at the master output',
    levels.every((l) => l.peak < 1), `max=${Math.max(...levels.map((l) => l.peak)).toFixed(4)} FS`);

  // The worst tick that really happens. Straight out of the census: a 5-pellet Rice
  // Spray landing on the LOCAL player (so every impact carries a `hurt` layer) while
  // both fighters cast. Re-based so the listener sits at the origin — the director
  // only ever uses offsets from the listener.
  const rice = (i) => hit({
    targetRole: 'player', amount: 2, x: -1 + i * 0.2, y: 0,
    source: { kind: 'weapon', weaponKey: 'Rice', weaponName: 'Rice Spray' },
  });
  // Exactly the tick the census found, minus the kinds that are deliberately silent:
  // 2 casts + 5 Rice pellets on the player (impact + hurt each) + 3 on the enemy = 15.
  const worstTick = [
    { type: 'weapon-fired', fighterRole: 'player', weaponKey: 'Catch' },
    { type: 'weapon-fired', fighterRole: 'enemy', weaponKey: 'Rice' },
    ...Array.from({ length: 5 }, (_, i) => rice(i)),
    ...Array.from({ length: 3 }, (_, i) => hit({
      targetRole: 'enemy', amount: 2, x: 40 + i, y: 0,
      source: { kind: 'weapon', weaponKey: 'Catch', weaponName: 'Fish Catch' },
    })),
  ];
  const busy = await run(worstTick, { volume: 1, playerId: 'sushi', enemyId: 'sushi', seconds: 2.5 });
  const busyPre = preLimiterLevel(busy.peakMax, masterGain);
  const onePellet = await run([rice(0)], { volume: 1, playerId: 'sushi', enemyId: 'sushi', seconds: 2.5 });
  console.log(`\n    worst REAL tick (census: ${CENSUS.worstTickVoices} voice requests): voices=${busy.started} throttled=${busy.dropped} budget-dropped=${busy.droppedBudget}`);
  console.log(`      peakMax=${busy.peakMax.toFixed(4)} FS   pre-limiter=${busyPre.toFixed(3)}   headroom to knee ${dB(CLIP.knee / busyPre).toFixed(1)} dB`);
  console.log(`      vs ONE pellet: peak x${(busy.peakMax / onePellet.peakMax).toFixed(2)}, rms x${(busy.rms / onePellet.rms).toFixed(2)} (unducked ${busy.started} voices would be far more)`);
  // The number that matters is GAIN REDUCTION, not whether the knee was crossed. The
  // curve is a tanh: 0.9 dB past a knee at 0.7 costs 0.01 dB, so "above the knee" and
  // "being squashed" are entirely different claims and only the second is a defect.
  // The bug this whole section exists for was 8.2 dB of reduction on a signal BELOW
  // its threshold; the honest test is therefore on the dB, measured.
  const busyGR = dB(busy.peakMax / (busyPre * masterGain));
  console.log(`      soft clip takes ${busyGR.toFixed(2)} dB off it`);
  check('the census worst tick reaches the director as the voices it should',
    busy.started === CENSUS.worstTickVoices && busy.droppedBudget === 0,
    `voices=${busy.started} expected=${CENSUS.worstTickVoices} budget-dropped=${busy.droppedBudget}`);
  check('the worst tick that really happens does not digitally clip', busy.peakMax < 1,
    `peak=${busy.peakMax.toFixed(4)} FS`);
  check('the soft clip is effectively transparent on the worst tick that really happens',
    busyGR > -0.5, `${busyGR.toFixed(2)} dB, pre-limiter ${busyPre.toFixed(3)} vs knee ${CLIP.knee}`);
  // The retrigger table ducks each repeat rather than dropping it, so 15 voices must
  // NOT arrive as 15 stacked impacts. Phase-aligned linear stacking would be 15x one
  // pellet; the measured figure is what the duck plus phase incoherence deliver.
  check('the worst tick is DUCKED, not stacked (15 voices arrive under 5x one pellet)',
    busy.peakMax < onePellet.peakMax * 5,
    `x${(busy.peakMax / onePellet.peakMax).toFixed(2)} of one pellet, from ${busy.started} voices (linear stacking would be x${busy.started})`);

  // CONTROL. The transparency claim above is only worth anything if this instrument CAN
  // report gain reduction — "no clipping" from a detector that would say that about
  // anything is this project's most expensive recurring mistake (`docs/LESSONS.md` §13:
  // validate the instrument against a KNOWN input before believing it on an unknown one).
  // A 16-damage impact driven 5x is not a state the game can reach; it is there to make
  // the detector prove it works.
  const ctrl = await renderById(page, `S.impact(16)`, { volume: 1, gain: 5, seconds: 2.5 });
  const ctrlPre = preLimiterLevel(ctrl.peakMax, masterGain);
  const ctrlGR = dB(ctrl.peakMax / (ctrlPre * masterGain));
  // `preLimiterLevel` returns Infinity when the measured output is past the curve's own
  // asymptote — which happens here because the WaveShaper is 2x oversampled and can
  // overshoot `CLIP_CEIL` slightly. That is the correct answer to "what input produced
  // this", and it is reported as such rather than as a number.
  const ctrlPreStr = Number.isFinite(ctrlPre) ? ctrlPre.toFixed(3) : `>${CLIP.span} (past the curve)`;
  console.log(`    CONTROL — one impact driven x5 (unreachable): peak=${ctrl.peakMax.toFixed(4)} pre-limiter=${ctrlPreStr} soft clip takes ${Number.isFinite(ctrlGR) ? `${ctrlGR.toFixed(1)} dB` : '>14 dB'}`);
  check('CONTROL: the detector reports heavy gain reduction on a deliberately overdriven input',
    !(ctrlGR > -6), `${Number.isFinite(ctrlGR) ? `${ctrlGR.toFixed(1)} dB` : 'past the curve'} at pre-limiter ${ctrlPreStr}`);
  check('CONTROL: even that does not digitally clip', ctrl.peakMax < 1, `peak=${ctrl.peakMax.toFixed(4)} FS`);
  // Reported, not asserted: even a physically impossible pile-up of the biggest sound in
  // the game barely engages the curve, because the retrigger table drops repeats 6+ and
  // ducks the rest. The voice budget and the throttle are doing the work the limiter is
  // usually credited with.
  const slam = { type: 'weapon-fired', fighterRole: 'player', weaponKey: 'Giant' };
  const pile = await run(Array.from({ length: 12 }, () => slam), { volume: 1, playerId: 'lollipop', seconds: 2.5 });
  const pilePre = preLimiterLevel(pile.peakMax, masterGain);
  console.log(`    12 simultaneous ultimates: voices=${pile.started} throttled=${pile.dropped} peak=${pile.peakMax.toFixed(4)} pre-limiter=${pilePre.toFixed(3)} soft clip takes ${dB(pile.peakMax / (pilePre * masterGain)).toFixed(2)} dB`);
  check('12 simultaneous ultimates still do not digitally clip', pile.peakMax < 1, `peak=${pile.peakMax.toFixed(4)} FS`);

  // Trail damage used to fire up to 30 hit events in ONE tick (`docs/STATE.md`), which
  // this layer would have met with 30 voice requests. `TRAIL.maxHitsPerTick` caps it at
  // 1 PER FIGHTER, so 2 per tick is the real worst case. Both numbers measured, because
  // the interesting question is what the OLD behaviour did to the mix — the retrigger
  // throttle was silently absorbing it, which is why nobody heard the bug.
  const trailHit = (i) => hit({ source: { kind: 'trail', ownerRole: 'enemy' }, amount: 3, x: 30 + i, y: 0 });
  const nowTrail = await run([trailHit(0), trailHit(1)], { volume: 1, seconds: 2 });
  const oldTrail = await run(Array.from({ length: 30 }, (_, i) => trailHit(i)), { volume: 1, seconds: 2 });
  console.log(`    trail: capped (2/tick) voices=${nowTrail.started} peak=${nowTrail.peakMax.toFixed(4)}   uncapped (30/tick, the old bug) voices=${oldTrail.started} throttled=${oldTrail.dropped} peak=${oldTrail.peakMax.toFixed(4)}`);
  check('the capped trail tick is quiet and unthrottled', nowTrail.started === 2 && nowTrail.dropped === 0,
    `voices=${nowTrail.started} throttled=${nowTrail.dropped}`);
  check('the OLD 30-hit trail tick was absorbed by the retrigger throttle, not stacked',
    oldTrail.started === 5 && oldTrail.dropped === 25,
    `voices=${oldTrail.started} throttled=${oldTrail.dropped}`);
  check('even the old uncapped trail tick did not clip', oldTrail.peakMax < 1, `peak=${oldTrail.peakMax.toFixed(4)}`);

  // Out-of-combat regen ticks every REGEN_TICK_MS = 200 ms, which is OUTSIDE the
  // engine's 110 ms retrigger window — so nothing throttles it and a full regen from
  // low health is ~50 rising triads back to back. Measured, then throttled in the
  // director; this asserts the throttle.
  const healSeq = await page.evaluate(() => window.__renderEventSeq(
    [0, 0.2, 0.4, 0.6, 0.8].map((t) => ({
      at: t, elapsed: 1000 + t * 1000,
      events: [{ type: 'heal', fighterRole: 'player', amount: 2 }],
    })),
  ));
  console.log(`    five 200 ms regen ticks: voices=${healSeq.started}`);
  check('a run of regen ticks is throttled, not one rising triad every 200 ms',
    healSeq.started <= 3, `voices=${healSeq.started} from 5 heal events over 800 ms`);
}

/**
 * The end-to-end check: a REAL match, the REAL wiring, and an AnalyserNode reading
 * the master bus. Everything above proves the sounds exist; only this proves the
 * game plays them.
 */
/**
 * The highest frequency any oscillator in the game may be asked for.
 *
 * Two facts fix it. **22050 Hz** is the stricter of the two Nyquist limits the shipped
 * game actually meets — a 44.1 kHz device clamps there, a 48 kHz one at 24000 — and
 * **~20 kHz** is the top of human hearing, well above it for any adult. Anything
 * scheduled above 20 kHz is therefore inaudible on every device AND clamped on some,
 * which makes it strictly a bug: it costs an oscillator and a gain node, contributes
 * nothing anyone can hear, and — the part that matters — a clamped partial has stopped
 * tracking whatever ratio put it there, so the voice is misauthored below Nyquist too.
 */
const OSC_CEILING_HZ = 20000;

/** Every bespoke weapon hook that exists, cast and impact, across the whole roster. */
async function hookCatalogue(page) {
  return page.evaluate(() => {
    const out = [];
    for (const [id, def] of Object.entries(window.__A.rules.CHARACTERS)) {
      for (const w of def.weapons) {
        const sfx = window.__A.weapons.getWeaponSfx(id, w.key);
        if (!sfx) continue;
        for (const hook of ['cast', 'impact']) {
          if (sfx[hook]) out.push({ id, key: w.key, hook, damage: w.damage || 10 });
        }
      }
    }
    return out;
  });
}

/**
 * NYQUIST — no oscillator may be driven above the audible band.
 *
 * This mode exists because a real match printed five of these to the console:
 *
 *   Oscillator.frequency.setValueAtTime value 24276 outside nominal range
 *   [-24000, 24000]; value will be clamped.
 *
 * and every other mode passed. They cannot see it: `OfflineAudioContext` prints no
 * warning, and a clamp at 24 kHz changes no sample anyone can hear. So this asserts on
 * the number the code ASKS FOR, captured inside `play()` before a single sample exists.
 *
 * Swept at 24 SEEDS per sound, and that is load-bearing rather than thorough: the one
 * offender is a per-event pitch jitter riding on an already-high partial, so it only
 * crosses the line on part of its own distribution. A single-seed check finds it about
 * a quarter of the time, which is the worst possible kind of gate.
 */
async function modeNyquist(page) {
  console.log('\n── nyquist: no oscillator may be scheduled above the audible band ──');
  const hooks = await hookCatalogue(page);
  const list = [
    ...CATALOGUE.map((c) => ({ id: c.id, expr: c.expr })),
    ...hooks.map((h) => ({ id: `${h.id}.${h.key}.${h.hook}`, expr: weaponExpr(h.id, h.key, h.hook, h.damage) })),
  ];
  const SEEDS = 24;

  // One round trip for the whole sweep: ~90 sounds x 24 seeds is minutes across the
  // Playwright bridge and seconds in the page.
  const rows = await page.evaluate(
    async ([entries, seeds, ceiling]) => {
      const S = window.__A.sounds;
      const W = window.__A;
      const out = [];
      for (const e of entries) {
        // eslint-disable-next-line no-eval
        const fn = eval(e.expr);
        let max = -Infinity, via = '', type = '', over = 0, total = 0, oscs = 0;
        for (let i = 0; i < seeds; i++) {
          const r = await window.__oscScan(fn, { seed: 1000 + i * 7919, ceiling });
          total += 1;
          oscs = Math.max(oscs, r.count);
          over += r.over.length;
          if (r.max > max) { max = r.max; via = r.maxVia; type = r.maxType; }
        }
        out.push({ id: e.id, max, via, type, over, total, oscs });
      }
      return out;
    },
    [list, SEEDS, OSC_CEILING_HZ],
  );

  rows.sort((a, b) => b.max - a.max);
  console.log(`  the ten highest oscillator frequencies in the game (worst of ${SEEDS} seeds each)`);
  console.log('  id                              max Hz   set via                     osc/voice');
  for (const r of rows.slice(0, 10)) {
    console.log(`  ${r.id.padEnd(30)} ${String(Math.round(r.max)).padStart(6)}   ${r.via.padEnd(26)} ${r.oscs}` +
      (r.over ? `   ⚠ ${r.over}/${r.total} seeds over ${OSC_CEILING_HZ}` : ''));
  }

  const offenders = rows.filter((r) => r.max > OSC_CEILING_HZ);
  for (const r of offenders) {
    console.log(`  OVER: ${r.id} reaches ${r.max.toFixed(1)} Hz via ${r.via} on a "${r.type}" oscillator ` +
      `(${r.over}/${r.total} seeds)`);
  }
  check(`no sound schedules an oscillator above ${OSC_CEILING_HZ} Hz`, offenders.length === 0,
    offenders.length ? offenders.map((r) => `${r.id}=${Math.round(r.max)}Hz`).join(', ')
                     : `highest in the game: ${rows[0].id} at ${Math.round(rows[0].max)} Hz`);
  // The line Chrome actually enforces. Stated separately so a regression report says
  // whether it is merely inaudible or genuinely clamped, and on which devices.
  const clamped44 = rows.filter((r) => r.max > 22050);
  const clamped48 = rows.filter((r) => r.max > 24000);
  check('nothing would be clamped on a 44.1 kHz device (Nyquist 22050)', clamped44.length === 0,
    clamped44.map((r) => `${r.id}=${Math.round(r.max)}`).join(', ') || 'none');
  check('nothing would be clamped on a 48 kHz device (Nyquist 24000)', clamped48.length === 0,
    clamped48.map((r) => `${r.id}=${Math.round(r.max)}`).join(', ') || 'none');
  // The instrument's own control. A wrapper that quietly saw nothing would report a
  // clean sweep, which is `docs/LESSONS.md` §13's "healthy dashboard" failure exactly.
  // Sounds with NO oscillator at all are legitimate (pure filtered noise), so the
  // assertion is on how many DO have one, and they are named rather than assumed.
  const withOsc = rows.filter((r) => r.oscs > 0);
  const noOsc = rows.filter((r) => r.oscs === 0).map((r) => r.id);
  if (noOsc.length) console.log(`  pure-noise sounds, no oscillator at all: ${noOsc.join(', ')}`);
  check('the scanner is actually seeing oscillators (not silently wrapping nothing)',
    withOsc.length > 40 && rows.length > 60,
    `${withOsc.length}/${rows.length} sounds carry at least one oscillator; ` +
    `total scheduled frequencies seen = ${rows.reduce((a, r) => a + r.oscs, 0)}`);

  // ── The guard's own A/B ─────────────────────────────────────────────────────
  // Every check above would also pass if `modes()` were building all its partials and
  // this scanner were blind. So: the SAME bank at two fundamentals, one of which puts
  // its top partial out of band. The in-band one must build three oscillators and the
  // out-of-band one two — proving the drop happens AND that the scanner can count.
  const ab = await page.evaluate(async ([ceiling]) => {
    const W = window.__A;
    const bank = [{ ratio: 1, gain: 1, decay: 1 }, { ratio: 2.76, gain: 0.8, decay: 0.7 },
                  { ratio: 5.4, gain: 0.5, decay: 0.44 }];
    const mk = (f0) => (s) => W.audio.modes(s, { freq: f0, duration: 0.3, peak: 0.5, modes: bank });
    return {
      inBand: await window.__oscScan(mk(1000), { ceiling }),   // top partial 5,400 Hz
      outOfBand: await window.__oscScan(mk(5000), { ceiling }), // top partial 27,000 Hz
    };
  }, [OSC_CEILING_HZ]);
  console.log(`  control: a 3-partial bank at f0=1000 schedules ${ab.inBand.count} oscillator frequencies ` +
    `(max ${Math.round(ab.inBand.max)} Hz); the SAME bank at f0=5000 schedules ${ab.outOfBand.count} ` +
    `(max ${Math.round(ab.outOfBand.max)} Hz)`);
  check('an in-band 3-partial modal bank builds all three', ab.inBand.count === 3, `${ab.inBand.count} oscillators`);
  check('the same bank drops the partial that would be out of band', ab.outOfBand.count === 2,
    `${ab.outOfBand.count} oscillators, max ${Math.round(ab.outOfBand.max)} Hz`);

  // ── IS ANY OF THIS AUDIBLE? ────────────────────────────────────────────────
  //
  // Everything above measures INTENT — the frequency the code asks for. The separate
  // and much more expensive question is whether the ear was ever involved, and it is
  // not answerable by argument: "24 kHz is above hearing" is true of a SINE and says
  // nothing about a chain containing a saturator and a soft clip, where an inaudible
  // partial can intermodulate with an audible one and land the difference tone right
  // in the middle of the band. |24385 - 12144| = 12.2 kHz; clamped, |22050 - 12144| =
  // 9.9 kHz. If the chain were non-linear here, clamping would MOVE an audible tone.
  //
  // So: the offending bank rendered through the production chain, twice, differing by
  // exactly the partial the guard now drops — reconstructed with the same opts `modes()`
  // would have given it (peak `o.peak * gain`, duration `o.duration * decay`, same
  // attack, same wet). Neither arm consumes the rng, so the two are otherwise sample-
  // identical, and the difference is subtracted sample by sample and low-passed at
  // 16 kHz. That residual is what a listener could possibly hear.
  // Lollipop's `candy()` bank, verbatim, at Smash's impact fundamental.
  const BANK = [
    { ratio: 1, gain: 1, decay: 1 },
    { ratio: 2.76, gain: 0.8, decay: 0.7 },
    { ratio: 5.4, gain: 0.5, decay: 0.44 },
  ];
  const F0 = 4400, DUR = 0.34, PEAK = 0.56;
  for (const sr of [44100, 48000]) {
    const r = await page.evaluate(async ([sampleRate, f0, dur, peak, bank]) => {
      const W = window.__A;
      const opts = { freq: f0, duration: dur, peak, attack: 0.0008, wet: 0.36, modes: bank };
      const shipped = (s) => W.audio.modes(s, opts);
      const prefix = (s) => {
        const d = W.audio.modes(s, opts);
        // The partial `modes()` now skips, rebuilt exactly as it used to be built.
        W.audio.tone(s, {
          type: 'sine', freq: f0 * 5.4, peak: peak * 0.5,
          attack: 0.0008, duration: dur * 0.44, wet: 0.36,
        });
        return d;
      };
      // The partial on its own, with nothing to hide behind. If the diff below shows
      // audible-band energy, this says whether it came from the oscillator itself or
      // from the chain's non-linearity intermodulating it with the rest of the bank.
      const alone = (s) => W.audio.tone(s, {
        type: 'sine', freq: f0 * 5.4, peak: peak * 0.5,
        attack: 0.0008, duration: dur * 0.44, wet: 0.36,
      });
      const a = await window.__renderRaw(shipped, { sampleRate, seconds: 0.8 });
      const b = await window.__renderRaw(prefix, { sampleRate, seconds: 0.8 });
      const c = await window.__renderRaw(alone, { sampleRate, seconds: 0.8 });
      const d = new Float64Array(a.length);
      for (let i = 0; i < a.length; i++) d[i] = b[i] - a[i];
      const E = (x, lo, hi) => window.__dsp.bandEnergy(x, sampleRate, lo, hi);
      // 20 Hz - 16 kHz is the whole of the audible band; anything the partial does
      // OUTSIDE it is by definition not heard, and 20-16k is where the bank lives.
      const sig = E(a, 20, 16000);
      const res = E(d, 20, 16000);
      // The same residual measured across the WHOLE spectrum, as the control: it proves
      // the extra partial really was rendered, so "nothing in the audible band" cannot
      // be the sound of the probe failing to add anything at all.
      const resAll = E(d, 20, sampleRate / 2 - 1);
      const split = [[20, 2000], [2000, 8000], [8000, 16000], [16000, sampleRate / 2 - 1]]
        .map(([lo, hi]) => E(c, lo, hi));
      return { sig, res, resAll, split, aloneTotal: split.reduce((x, y) => x + y, 0) };
    }, [sr, F0, DUR, PEAK, BANK]);
    const dB = 10 * Math.log10(Math.max(r.res, 1e-30) / Math.max(r.sig, 1e-30));
    const dBAll = 10 * Math.log10(Math.max(r.resAll, 1e-30) / Math.max(r.sig, 1e-30));
    const clamped = F0 * 5.4 > sr / 2;
    const shareLow = r.split[0] / Math.max(1e-30, r.aloneTotal);
    const pcts = r.split.map((e) => `${((100 * e) / Math.max(1e-30, r.aloneTotal)).toFixed(1)}%`);
    console.log(`  ${sr} Hz (Nyquist ${sr / 2}): the dropped partial asks for ${Math.round(F0 * 5.4)} Hz` +
      `${clamped ? ` and the browser CLAMPS it to ${sr / 2}` : ' and it renders as asked'}` +
      `  ->  residual ${dB.toFixed(1)} dB in 20 Hz-16 kHz, ${dBAll.toFixed(1)} dB full band`);
    console.log(`    that partial rendered ALONE puts its energy: ` +
      `20Hz-2k ${pcts[0]}  2k-8k ${pcts[1]}  8k-16k ${pcts[2]}  16k-Nyq ${pcts[3]}`);
    // The control for both arms: the reconstruction really is in the render, so an
    // "inaudible" verdict below cannot be the sound of the probe adding nothing.
    check(`at ${sr} Hz the reconstructed partial is really in the render (> -60 dB full band)`,
      dBAll > -60, `${dBAll.toFixed(1)} dB`);
    if (!clamped) {
      // 48 kHz: 23,760 Hz fits under Nyquist, renders as asked, and is exactly the
      // harmless supersonic partial everyone assumed this bug was.
      check(`at ${sr} Hz, under Nyquist, the partial is inaudible (< -60 dB in 20 Hz-16 kHz)`,
        dB < -60, `${dB.toFixed(1)} dB`);
    } else {
      // ⚠️ 44.1 kHz: it is NOT. This is the finding, and it inverts the assumption the
      // fix was originally justified by (mine included, until it was measured).
      //
      // Clamped to EXACTLY Nyquist, Chrome's oscillator does not produce a 22,050 Hz
      // tone that nobody can hear — it degenerates, and what reaches the bus is a LOW
      // FREQUENCY artefact: 89.8% of that partial's energy lands below 2 kHz, at
      // -24.3 dB against the whole bank. That is squarely audible, on every Lollipop
      // Smash impact, on any device running at 44.1 kHz. 48 kHz gets no such thing.
      // Same code, same event, two different sounds, decided by the audio device.
      //
      // These two assertions therefore document a BROWSER behaviour, and if a future
      // Chrome band-limits its way out of it they will fail. That is the correct
      // failure: the ceiling in `synth.ts` would then be buying only intent, and
      // whoever reads this next should be told so rather than left with a green check.
      check(`at ${sr} Hz the CLAMPED partial is audible — the cost the ceiling removes (> -40 dB)`,
        dB > -40, `${dB.toFixed(1)} dB in 20 Hz-16 kHz`);
      check(`and that artefact is LOW, not supersonic (>= 50% of its energy under 2 kHz)`,
        shareLow >= 0.5, `${(100 * shareLow).toFixed(1)}% below 2 kHz`);
    }
  }

  // ── WHERE the oscillator starts to degenerate, and therefore whether 20 kHz is far
  // enough away from it. A ceiling chosen for "top of hearing" would be the wrong
  // number if the artefact began at 20,500 Hz.
  const sweep = await page.evaluate(async ([freqs]) => {
    const W = window.__A;
    const out = [];
    for (const hz of freqs) {
      const x = await window.__renderRaw(
        (s) => W.audio.tone(s, { type: 'sine', freq: hz, peak: 0.28, attack: 0.0008, duration: 0.15, wet: 0 }),
        { sampleRate: 44100, seconds: 0.5 },
      );
      const low = window.__dsp.bandEnergy(x, 44100, 20, 2000);
      const all = window.__dsp.bandEnergy(x, 44100, 20, 22049);
      out.push({ hz, share: low / Math.max(1e-30, all) });
    }
    return out;
  }, [[12000, 16000, 19000, 20000, 21000, 22050]]);
  console.log(`  a lone sine at 44.1 kHz, share of its energy below 2 kHz:`);
  console.log(`    ${sweep.map((s) => `${s.hz}Hz ${(100 * s.share).toFixed(1)}%`).join('   ')}`);
  const atCeiling = sweep.find((s) => s.hz === OSC_CEILING_HZ);
  check(`the ceiling itself is clean — a sine AT ${OSC_CEILING_HZ} Hz stays where it was put (< 5% below 2 kHz)`,
    atCeiling.share < 0.05, `${(100 * atCeiling.share).toFixed(2)}%`);
}

/**
 * THE SHIPPED BOOT ROUTE — `/`, untouched, right through the title card.
 *
 * This exists because the assertion it replaces was measuring a path no player takes.
 * `--mode live` boots `?player=…&enemy=…`, a MATCH route, and asserted "engine is
 * LOCKED before any user gesture". That is true there for an uninteresting reason
 * (`shell.mount()` calls `music.fadeOut()` on a match route and nothing calls
 * `unlock()`), and it stayed green while the real boot route `/` reached the home
 * screen with a context already created and `suspended` — `opening.ts`'s 4.5 s
 * auto-continue `setTimeout` calling `audio.unlock()` outside any gesture. A gate that
 * tests a path nobody uses cannot fail for the reason it was written.
 *
 * ── ⚠️ THE HARNESS GRANTS THE THING BEING MEASURED ─────────────────────────────
 *
 * `page.evaluate()` sends CDP `Runtime.evaluate` with `userGesture: true`, so ASKING
 * the page what state it is in makes `navigator.userActivation.isActive` true for the
 * next ~5 s — and a context created inside that window is born `running` instead of
 * `suspended`. Measured: two consecutive runs of an earlier version of this check gave
 * OPPOSITE answers purely on whether the poll landed before or after the auto-continue.
 * So everything here is sampled by an init script inside the page and read out by
 * exactly one `evaluate`, after the measuring is over. `docs/LESSONS.md` §13.
 *
 * The auto-continue is required to have actually fired (`screen === 'home'`) before the
 * lock assertion counts — otherwise it would pass vacuously on a slow load, which is
 * the same defect in a new costume.
 */
/**
 * When the probe's own first gesture lands, measured from `domcontentloaded`. The
 * pre-gesture window is everything before it, and the title card's 4500 ms
 * auto-continue has to fall inside that window or the check below is vacuous.
 */
const CLICK_AT_MS = 12000;

/**
 * Boot `/` once and report everything observed. `opts.fakeActivation` runs the CONTROL
 * arm — see `modeLiveBootControl`.
 */
async function bootRun(browser, opts = {}) {
  const page = await browser.newPage({ viewport: { width: 1000, height: 640 } });
  if (opts.fakeActivation) {
    // Defeat `engine.ts`'s `hasUserActivation()` guard, and ONLY that guard: an own
    // property on `navigator` shadows the prototype accessor for anything reading it
    // from JS, while the browser's own autoplay decision — which is what actually
    // decides whether a fresh context is born `running` or `suspended` — reads its
    // internal state and is untouched. So this arm runs the SHIPPED call path
    // (`opening.ts`'s auto-continue `setTimeout` -> `audio.unlock()`) exactly as it ran
    // before the guard existed, and the browser answers honestly.
    await page.addInitScript(`Object.defineProperty(navigator, 'userActivation', {
      configurable: true, get: () => ({ isActive: true, hasBeenActive: true }),
    });`);
  }
  await page.addInitScript(`(() => {
    window.__bootLog = [];
    window.__bootCtx = [];
    window.__bootWitness = [];
    const Real = window.AudioContext;
    if (Real) {
      function Patched(...a) {
        const c = new Real(...a);
        window.__bootCtx.push({ at: Math.round(performance.now()), born: c.state });
        window.__theCtx = c;
        return c;
      }
      Patched.prototype = Real.prototype;
      Object.setPrototypeOf(Patched, Real);
      window.AudioContext = Patched;
    }
    setInterval(() => {
      window.__bootLog.push({
        at: Math.round(performance.now()),
        state: window.__audio ? window.__audio.stats().state : 'no-engine',
        ctxs: window.__bootCtx.length,
        screen: window.__screen || null,
      });
    }, 250);
    // Bubble phase on window: the engine's own capture-phase unlock listener has
    // already run, so this sees exactly what a button's click handler would.
    window.addEventListener('click', () => {
      window.__bootWitness.push({
        state: window.__audio ? window.__audio.stats().state : 'no-engine',
        played: window.__audio ? window.__audio.engine.play(() => 0.05, { key: 'probe' }) : false,
      });
    }, false);
  })();`);
  await page.route('**/@vite/client*', (r) => r.fulfill({
    status: 200, contentType: 'text/javascript',
    body: `const noop=()=>{};export const createHotContext=()=>({accept:noop,acceptExports:noop,dispose:noop,prune:noop,invalidate:noop,on:noop,off:noop,send:noop,decline:noop,data:{}});export const injectQuery=(u)=>u;export const updateStyle=noop;export const removeStyle=noop;export const ErrorOverlay=class{};export default {};`,
  }));
  await page.goto(`${BASE}/`, { waitUntil: 'domcontentloaded', timeout: 60000 });
  // Long enough for the title card's 4500 ms auto-continue to fire and for home to
  // mount, on a machine where three peer agents are also rendering.
  await page.waitForTimeout(CLICK_AT_MS);
  await page.mouse.click(500, 320);   // the page's FIRST real gesture
  await page.waitForTimeout(900);

  const r = await page.evaluate(() => ({
    log: window.__bootLog, ctx: window.__bootCtx, witness: window.__bootWitness,
    final: window.__audio ? window.__audio.stats() : null,
  }));
  await page.close();

  const pre = r.log.filter((e) => e.at < (r.ctx[0]?.at ?? Infinity));
  const reachedHome = r.log.some((e) => e.screen === 'home');
  const states = [...new Set(pre.map((e) => e.state))];
  const preGesture = [...new Set(r.log.filter((e) => e.at < CLICK_AT_MS).map((e) => e.state))];
  return { ...r, pre, reachedHome, states, preGesture };
}

/**
 * THE CONTROL — the same page, the same route, the same call site, with the guard's
 * ONE INPUT flipped. This is what decides "real defect or stale comment", and it is the
 * arm that makes the assertion above mean something: without it, "no context before a
 * gesture" would also be green if `opening.ts` had simply stopped calling `unlock()`,
 * or if the auto-continue never fired, or if the probe were blind.
 *
 * `docs/LESSONS.md` §13's rule, applied to a gate rather than to an image: before
 * trusting a green check, confirm it goes red when the thing it guards is removed.
 */
async function modeLiveBootControl(browser) {
  console.log('\n── live/boot CONTROL: the same route with engine.ts\'s gesture guard defeated ──');
  const r = await bootRun(browser, { fakeActivation: true });
  console.log(`  screens seen: ${[...new Set(r.log.map((e) => e.screen))].join(' -> ')}`);
  for (const c of r.ctx) console.log(`  AudioContext created at ${c.at} ms, born state="${c.born}"`);
  console.log(`  engine states before the first click: ${r.preGesture.join(', ')}`);
  for (const w of r.witness) console.log(`  inside the first click: engine=${w.state}, play() ${w.played ? 'SCHEDULED' : 'REFUSED'}`);
  console.log(`  droppedNotRunning after the click: ${r.final?.droppedNotRunning}`);

  check('CONTROL: without the guard, / creates a context with no gesture',
    r.ctx.length >= 1, `${r.ctx.length} context(s)`);
  check('CONTROL: that context is born SUSPENDED — the state engine.ts says must never happen',
    r.ctx[0]?.born === 'suspended', `born "${r.ctx[0]?.born}"`);
  check('CONTROL: and the engine is observably suspended before any gesture',
    r.preGesture.includes('suspended'), `states seen: ${r.preGesture.join(', ')}`);
  // The COST, and the reason this is a defect and not a cosmetic complaint. `resume()`
  // is asynchronous: the context is still `suspended` for the whole of the first
  // gesture's call stack, so every sound that gesture's own handlers ask for is refused.
  check('CONTROL: the first click\'s own sound is DROPPED (resume() is async)',
    r.witness.length > 0 && r.witness[0].played === false,
    r.witness.length ? `played=${r.witness[0].played} state=${r.witness[0].state}` : 'no click observed');
  check('CONTROL: and the engine counted that drop',
    (r.final?.droppedNotRunning ?? 0) >= 1, `droppedNotRunning=${r.final?.droppedNotRunning}`);
}

async function modeLiveBoot(browser) {
  console.log('\n── live/boot: the SHIPPED boot route, GET / with no gesture ──');
  const r = await bootRun(browser);
  const { reachedHome, states } = r;
  console.log(`  ${r.log.length} samples over ${r.log[r.log.length - 1]?.at ?? 0} ms; ` +
    `screens seen: ${[...new Set(r.log.map((e) => e.screen))].join(' -> ')}`);
  console.log(`  engine state before any context existed: ${states.join(', ')}`);
  for (const c of r.ctx) console.log(`  AudioContext created at ${c.at} ms, born state="${c.born}"`);
  for (const w of r.witness) console.log(`  inside the first click: engine=${w.state}, play() ${w.played ? 'SCHEDULED' : 'REFUSED'}`);

  check('the title card auto-continued, so the lock claim is not vacuous', reachedHome, `screen reached home`);
  // `born === "running"` is the property, and it is stronger than a timestamp: a
  // browser only starts a fresh AudioContext running when it is constructed under
  // transient user activation. One born "suspended" is proof it was created outside a
  // gesture, whenever that was.
  check('/ creates NO AudioContext outside a gesture (any it creates is born running)',
    r.ctx.length <= 1 && (r.ctx.length === 0 || r.ctx[0].born === 'running'),
    r.ctx.length ? `${r.ctx.length} context(s), born "${r.ctx[0].born}"` : 'no context');
  // `no-engine` is a LEGAL pre-gesture state and the first version of this check
  // rejected it, so the gate that was written to catch the early context failed for a
  // reason that had nothing to do with it. The samples run from `domcontentloaded`, and
  // `window.__audio` is published when `main.ts`'s module graph finishes evaluating —
  // measured, that is the first one or two samples of ~47. The invariant is not "the
  // engine object exists and is idle", it is that **no live context state is ever
  // observed before a gesture**: `suspended` here is the defect, and `running` before a
  // gesture would be a browser policy failure.
  const live = r.preGesture.filter((st) => st === 'suspended' || st === 'running');
  check('no live AudioContext state is ever observed before a gesture on /',
    live.length === 0, `states seen: ${r.preGesture.join(', ')}`);
  check('a sound fired from the FIRST click is scheduled, not dropped',
    r.witness.length > 0 && r.witness[0].played === true,
    r.witness.length ? `played=${r.witness[0].played} state=${r.witness[0].state}` : 'no click observed');
  check('nothing was ever dropped for a locked engine on the boot route',
    (r.final?.droppedNotRunning ?? -1) === 0, `droppedNotRunning=${r.final?.droppedNotRunning}`);
}

async function modeLive(browser) {
  await modeLiveBoot(browser);
  await modeLiveBootControl(browser);
  console.log('\n── live: real match, master bus tapped with a ScriptProcessorNode ──');
  // simSpeed=3: under SwiftShader the page runs at ~9 fps and `match.ts` clamps dt to
  // 50 ms, so real time advances the sim at less than half speed. At 1x the countdown
  // had not even finished by the end of the run and the probe was measuring a game
  // that had not started.
  const page = await newPage(browser, `${BASE}/?player=soup&enemy=taco&simSpeed=3`);
  await page.waitForFunction('window.__gameReady === true', null, { timeout: 60000 });

  const before = await page.evaluate(() => (window.__audio ? window.__audio.stats() : null));
  check('audio QA handle published by the game', before !== null, JSON.stringify(before));
  // Deliberately narrow now: this is the MATCH route, which reaches `shell.mount()`'s
  // `music.fadeOut()` branch and never calls `unlock()`. The claim about the route a
  // player actually boots is made in `modeLiveBoot` above, against `/`.
  check('engine is LOCKED before any user gesture on a deep-linked MATCH route',
    before && before.state !== 'running', `state=${before && before.state}`);

  /**
   * FRAME-RATE BASELINE, taken here because right now the audio context does not
   * exist: nothing is being synthesised, no convolution is running, and the render
   * loop has the machine to itself. Whatever this reads is the software renderer's
   * own speed, and the comparison at the end of this mode is against it.
   *
   * This replaced an absolute floor ("> 5 fps") that was measuring the wrong thing.
   * Under SwiftShader that figure ranged 4.9-11.0 fps across runs of an UNCHANGED
   * build, so it passed or failed on scheduling. Measured directly: with audio locked
   * the loop ran at 0.7/5.8/6.5 fps and with audio running and firing continuously it
   * ran at 3.5/5.9/7.0 — i.e. FASTER, because the variance is warm-up and machine load
   * and the audio cost is not visible at all. A ratio against a baseline taken in the
   * same session is immune to that; an absolute threshold never can be.
   */
  const measureFps = () => page.evaluate(async () => {
    let n = 0;
    const t0 = performance.now();
    await new Promise((res) => {
      const tick = () => { n++; if (performance.now() - t0 > 2000) res(); else requestAnimationFrame(tick); };
      requestAnimationFrame(tick);
    });
    return (n * 1000) / (performance.now() - t0);
  });
  await page.waitForTimeout(1200); // let SwiftShader warm up before timing anything
  const fpsLocked = await measureFps();

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

  /**
   * THE THEME HAS TO COME OFF THE BUS BEFORE ANY OF THIS IS MEASURABLE.
   *
   * `music.ts` routes through `engine.busInput`, deliberately, so global mute
   * silences it. The consequence for measurement is that while the theme is playing
   * the master bus is NEVER silent: measured here, the idle bus sits at a median
   * block RMS of 1.94e-2, which is 6.5x the burst detector's own onset threshold. The
   * detector therefore sees one continuous sound from the first note to the last and
   * reports "1 burst" for a countdown that emitted six.
   *
   * This is not a music bug and nothing about `music.ts` changes: a URL that boots
   * straight into a match (which is what this probe does) legitimately bypasses the
   * menu's fade-out. It is an instrument problem, and the fix is the instrument's —
   * measure the SFX in isolation, then put the theme back and prove it was really
   * there, which is a stronger check than the one that was silently passing before.
   */
  const musicOn = await page.evaluate(async () => {
    const m = await import('/src/audio/index.ts');
    const was = m.audio.music.isPlaying();
    m.audio.music.setEnabled(false);
    return was;
  });
  check('the theme is playing and routed through the shared bus', musicOn === true, `isPlaying=${musicOn}`);
  await page.waitForTimeout(400);

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

  /** Count discrete sound EVENTS in a block-RMS series, with hysteresis. Requires the
   * bus to fall back to near-silence between events, so it UNDER-counts anything that
   * overlaps. Kept as a reported figure; the assertion uses `countOnsets`. */
  const countBursts = (blocks, hi = 3e-3, lo = 5e-4) => {
    let n = 0, on = false;
    for (const b of blocks) {
      if (!on && b > hi) { on = true; n++; }
      else if (on && b < lo) on = false;
    }
    return n;
  };

  /**
   * Count discrete ATTACKS by energy flux — a block more than 2.2x louder than the one
   * before it, above an absolute floor, with a two-block refractory.
   *
   * This replaced hysteresis for the assertions, and the reason is worth recording
   * because it is a real property of the change being tested. Since the sounds gained
   * a room and longer decays, consecutive events legitimately overlap: the bus no
   * longer returns to silence between two shots fired 600 ms apart, so a
   * fall-to-silence detector fuses them and reports 7 events for 20 voices. That is
   * the detector failing, not the game. An onset detector counts the attacks, which is
   * what "discrete sound events" means to a listener in the first place.
   */
  const countOnsets = (blocks, jump = 2.2, floor = 1.5e-3) => {
    let n = 0, hold = 0;
    for (let i = 1; i < blocks.length; i++) {
      if (hold > 0) { hold--; continue; }
      if (blocks[i] > floor && blocks[i] > blocks[i - 1] * jump) { n++; hold = 2; }
    }
    return n;
  };

  /**
   * ── 1. The countdown. Five ticks plus a START sting, no gameplay required. ──
   *
   * The event assertions below are made against the number of voices the ENGINE
   * started in the same window, not against an absolute count. Under SwiftShader this
   * machine ran anywhere from 4 to 11 fps across runs of an unchanged build, and
   * `match.ts` advances the sim from real elapsed time, so a fixed wall-clock window
   * catches a different number of game events every run — 17 voices on one pass and
   * 32 on the next. An absolute count measures the renderer; a RATIO measures what
   * this probe is actually for, which is whether the voices the engine believes it
   * started arrived at the master bus as audible, discrete attacks.
   */
  const atUnlock = unlocked.started;
  await page.waitForTimeout(4500);
  const cd = await page.evaluate(() => ({ peak: window.__rec.peak, blocks: window.__rec.blocks.slice() }));
  const cdVoices = (await page.evaluate(() => window.__audio.stats())).started - atUnlock;
  const cdBursts = countBursts(cd.blocks);
  const cdOnsets = countOnsets(cd.blocks);
  const cdLoud = cd.blocks.filter((b) => b > 1e-3).length;
  console.log(`  countdown: peak=${cd.peak.toFixed(4)} onsets=${cdOnsets} bursts=${cdBursts} voices=${cdVoices} loudBlocks=${cdLoud}/${cd.blocks.length}`);
  check('countdown produced a real waveform at the master bus', cd.peak > 0.01, `peak=${cd.peak.toFixed(4)}`);
  check('countdown emitted multiple DISCRETE sound events', cdOnsets >= 2, `${cdOnsets} onsets`);
  check('most countdown voices reached the bus as discrete attacks (>= 50% of voices started)',
    cdVoices === 0 || cdOnsets >= cdVoices * 0.5,
    `${cdOnsets} onsets from ${cdVoices} voices (${cdBursts} non-overlapping bursts)`);

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
  const fightVoices = stats.started - atUnlock - cdVoices;
  const fightBursts = countBursts(fight.blocks);
  const fightOnsets = countOnsets(fight.blocks);
  const meanRms = fight.blocks.reduce((a, b) => a + b, 0) / Math.max(1, fight.blocks.length);
  console.log(`  combat: peak=${fight.peak.toFixed(4)} meanRms=${meanRms.toFixed(5)} onsets=${fightOnsets} bursts=${fightBursts} voices=${fightVoices} blocks=${fight.blocks.length}`);
  console.log(`  engine: ${JSON.stringify(stats)}`);
  check('live combat produced a real waveform', fight.peak > 0.02, `peak=${fight.peak.toFixed(4)}`);
  // A bare silence catcher. The absolute count used to be the assertion here (">= 8")
  // and it was really a proxy for how many game events a 4-11 fps software renderer
  // managed to produce in a fixed wall-clock window — it failed on a run where combat
  // legitimately generated only 6 voices. The real claim moved to the ratio below,
  // which is both stricter and independent of renderer speed.
  check('live combat emitted discrete sound events', fightOnsets >= 2, `${fightOnsets} onsets`);
  check('most combat voices reached the bus as discrete attacks (>= 40% of voices started)',
    fightVoices > 0 && fightOnsets >= fightVoices * 0.4,
    `${fightOnsets} onsets from ${fightVoices} voices (${fightBursts} non-overlapping bursts)`);
  check('live combat voices were actually started', stats.started > 8, `started=${stats.started}`);
  check('no voice leak during live play', stats.activeVoices <= 20, `active=${stats.activeVoices}`);
  // Counted FROM THE MOMENT OF UNLOCK, not from boot. Events fired before the first
  // gesture are supposed to be dropped — that is the autoplay guard working — so an
  // absolute cap conflates the guard doing its job with the bug this is looking for,
  // and moves every time anything changes how long the page sits before being clicked.
  // The claim is that the count does not grow AFTER unlock, and that is what is
  // asserted.
  check('nothing was dropped for being locked after unlock',
    stats.droppedNotRunning === unlocked.droppedNotRunning,
    `${unlocked.droppedNotRunning} at unlock -> ${stats.droppedNotRunning} after combat`);

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

  // ── 4b. Put the theme back and prove it reaches the master bus. ───────────
  // A differential measurement: the SFX bus is idle in both windows, so any energy
  // difference is the theme and nothing else. This is what the burst assertions above
  // were accidentally measuring, now measured on purpose.
  await page.evaluate(() => window.__recReset());
  await page.waitForTimeout(900);
  const noMusic = await page.evaluate(() => {
    const b = window.__rec.blocks.slice();
    return b.length ? b.reduce((a, c) => a + c, 0) / b.length : 0;
  });
  await page.evaluate(async () => {
    const m = await import('/src/audio/index.ts');
    m.audio.music.setEnabled(true);
    window.__recReset();
  });
  await page.waitForTimeout(1200);
  const withMusic = await page.evaluate(() => {
    const b = window.__rec.blocks.slice();
    return b.length ? b.reduce((a, c) => a + c, 0) / b.length : 0;
  });
  console.log(`  theme on the bus: idle meanRms without=${noMusic.toExponential(2)} with=${withMusic.toExponential(2)}`);
  // ── Why this is a POWER subtraction and no longer a ratio ─────────────────
  //
  // The comment above says "the SFX bus is idle in both windows", and as of the kitchen
  // ambience bed that is no longer true: this measurement is taken mid-match and
  // `director.ts` runs a continuous room tone there by design. The floor rose, the
  // `withMusic > noMusic * 5` ratio stopped holding (2.19e-2 -> 4.94e-2 = 2.3x), and the
  // check failed for a reason that has nothing to do with the claim it exists to make.
  //
  // The claim — the theme reaches the master bus, and is therefore covered by global
  // mute — is about the theme's OWN contribution, and the theme and the bed are
  // uncorrelated, so their powers add. Subtracting in power recovers exactly that
  // contribution and is independent of whatever the SFX floor happens to be, now or
  // after any future change to the bed.
  const themeOnly = Math.sqrt(Math.max(0, withMusic * withMusic - noMusic * noMusic));
  console.log(`  theme's own contribution (power subtraction, uncorrelated with the room tone): ${themeOnly.toExponential(2)}`);
  check('the theme reaches the master bus (and so is covered by global mute)',
    themeOnly > 1e-2 && withMusic > noMusic,
    `${noMusic.toExponential(2)} -> ${withMusic.toExponential(2)}, theme alone ${themeOnly.toExponential(2)}`);

  // ── 5. The render loop must not have been harmed. ────────────────────────
  // Measured against this session's own audio-locked baseline — see `fpsLocked`.
  await page.mouse.down();
  const fpsRunning = await measureFps();
  await page.mouse.up();
  console.log(`  frame rate: ${fpsLocked.toFixed(1)} fps audio-locked -> ${fpsRunning.toFixed(1)} fps audio running and firing (SwiftShader software renderer)`);
  check('render loop still running', fpsRunning > 2, `${fpsRunning.toFixed(1)} fps`);
  check('audio costs the render loop nothing measurable (>= 70% of the audio-locked baseline)',
    fpsRunning >= fpsLocked * 0.7,
    `${fpsLocked.toFixed(1)} -> ${fpsRunning.toFixed(1)} fps (${((fpsRunning / fpsLocked - 1) * 100).toFixed(0)}%)`);

  await page.close();
}

// ─────────────────────────────────────────────────────────────────────────────

const browser = await chromium.launch({ args: LAUNCH_ARGS });
try {
  const wantsOffline = ['all', 'offline', 'identity', 'depth', 'negative', 'variation', 'budget', 'dispatch', 'coverage', 'nyquist'].includes(MODE);
  if (wantsOffline) {
    // The home screen: no match, no sim, nothing competing for CPU while rendering.
    const page = await newPage(browser, `${BASE}/?screen=home`);
    await installHarness(page);
    if (MODE === 'all' || MODE === 'offline') await modeOffline(page);
    if (MODE === 'all' || MODE === 'identity') await modeIdentity(page);
    if (MODE === 'all' || MODE === 'depth') await modeDepth(page);
    if (MODE === 'all' || MODE === 'negative') await modeNegative(page);
    if (MODE === 'all' || MODE === 'variation') await modeVariation(page);
    if (MODE === 'all' || MODE === 'budget') await modeBudget(page);
    if (MODE === 'all' || MODE === 'dispatch') await modeDispatch(page);
    if (MODE === 'all' || MODE === 'coverage') await modeCoverage(page);
    if (MODE === 'all' || MODE === 'nyquist') await modeNyquist(page);
    await page.close();
  }
  if (MODE === 'all' || MODE === 'live') await modeLive(browser);
} finally {
  await browser.close();
}

console.log(`\n${checks - failures}/${checks} checks passed${failures ? `, ${failures} FAILED` : ''}`);
process.exit(failures ? 1 : 0);
