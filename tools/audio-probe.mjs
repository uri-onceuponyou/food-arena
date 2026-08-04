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
 *   live      Run the ACTUAL GAME in a browser, tap the master bus post-volume with
 *             an AnalyserNode, and measure the waveform while a real match plays.
 *             This is the only mode that proves the wiring, the autoplay unlock and
 *             the event stream all work together.
 *
 * Usage:  node tools/audio-probe.mjs [--mode all|offline|identity|depth|negative|variation|budget|dispatch|live]
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

  return { analyse, stats, extent, centroid, envelopeMod, layers, windowRms, bandPeaks, partials, pitchSlope, lowFrac };
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
  check('the theme reaches the master bus (and so is covered by global mute)',
    withMusic > noMusic * 5 && withMusic > 1e-3, `${noMusic.toExponential(2)} -> ${withMusic.toExponential(2)}`);

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
  const wantsOffline = ['all', 'offline', 'identity', 'depth', 'negative', 'variation', 'budget', 'dispatch'].includes(MODE);
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
    await page.close();
  }
  if (MODE === 'all' || MODE === 'live') await modeLive(browser);
} finally {
  await browser.close();
}

console.log(`\n${checks - failures}/${checks} checks passed${failures ? `, ${failures} FAILED` : ''}`);
process.exit(failures ? 1 : 0);
