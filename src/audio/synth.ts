/**
 * Procedural synthesis primitives — the bottom layer of the audio pillar.
 *
 * This game ships ZERO audio assets. Every sound in it is generated from
 * oscillators and noise at the moment it plays, which is a deliberate fit rather
 * than a workaround: a stylised food-fight brawler wants punchy cartoon sounds, and
 * synthesis gives per-event pitch/timing variation for free, so a weapon fired forty
 * times in a match never machine-guns the same sample forty times. It also costs
 * nothing to download, which matters because mobile is a target.
 *
 * ── THE ONE ARCHITECTURAL RULE IN THIS DIRECTORY ────────────────────────────────
 *
 * A sound is a PURE FUNCTION of `(SynthCtx) -> duration`. It never reaches for a
 * global, never asks what time it is, and never assumes the context it is writing
 * into is a live `AudioContext`. Everything below takes `BaseAudioContext`, which
 * `OfflineAudioContext` also satisfies.
 *
 * That single constraint is what makes this layer *provable*. Audio cannot be
 * screenshotted, and this project's most expensive recurring failure is code that is
 * wired correctly and produces nothing (eleven separate times). Because every sound
 * here is context-agnostic, a test can render the exact production code path into an
 * `OfflineAudioContext` and assert on real sample data — RMS, peak, decay time,
 * spectral centroid — instead of asserting that a function was called. See
 * `tools/audio-probe.mjs`.
 *
 * ── WHY THIS FILE GREW: "they are very shallow and similar" (Uri, 2026-08-04) ────
 *
 * The first version of this layer had exactly two ways to make a sound: a filtered
 * noise burst and a bare oscillator. That is enough to make something audible and
 * nowhere near enough to make something feel like a physical object, and the gap was
 * measurable rather than a matter of taste. Rendered through the production chain and
 * analysed (`tools/audio-probe.mjs --mode depth`):
 *
 *   * `generic.impact(16)` — the most-heard sound in the game — resolved to exactly
 *     **ONE spectral peak** (129 Hz). A bare `sine` control scores the same 1. The
 *     pitched layer of every impact in the game had the harmonic structure of a test
 *     tone, because it *was* a test tone with an envelope on it.
 *   * Every texture layer measured **spectral flatness 0.70-0.80**, against 0.699 for
 *     a single unshaped bandpass-noise control. Same story one layer up: the crunch
 *     was noise, and only noise.
 *   * Every sound's measured **-66 dBFS extent was SHORTER than its own declared
 *     duration** — post-declared energy was zero across the whole catalogue. There
 *     was no tail anywhere, and no sense of a room at all.
 *   * **rt20 spanned 18-88 ms for the entire catalogue.** Everything decayed inside a
 *     tenth of a second, which is the measurable form of "the mix has one texture".
 *
 * So four primitives were added, each aimed at one of those numbers, and each is
 * asserted on rendered samples rather than assumed:
 *
 *   1. `drive` — WAVESHAPING. A `tanh` saturator on the oscillator BEFORE its
 *      envelope. This is the single biggest change: it turns one partial into a
 *      harmonic series, and it is also the only reason a hit has any low end on a
 *      phone. A 45 Hz sine is inaudible on a phone speaker; its saturation harmonics
 *      at 135/225/315 Hz are not, and the ear reconstructs the missing fundamental
 *      from them. "No low end" and "too little harmonic content" are the same fix.
 *   2. `voices`/`detuneCents` — DETUNED STACKS. Two or three oscillators a few cents
 *      apart beat against each other, which is the difference between a tone and a
 *      thing that is vibrating.
 *   3. `ring` — RING MODULATION. Multiplies the oscillator by another, producing
 *      INHARMONIC sidebands. Struck glass, hard candy and thin plastic are all
 *      inharmonic; a harmonic series can never sound like them.
 *   4. `modes()` — MODAL RESONANCE. A bank of independently-decaying partials at
 *      chosen ratios, higher modes decaying faster. This is how a real object rings,
 *      and it is what makes Donut's ring and Lollipop's candy read as objects rather
 *      than as EQ settings.
 *
 * ...plus the one that fixes "everything is dry": a synthesised impulse response and
 * a per-voice reverb SEND (`wet`), described under `impulseResponse()` below.
 *
 * ── Scheduling discipline ───────────────────────────────────────────────────────
 *
 * Every node is created, scheduled and forgotten. Web Audio source nodes are
 * one-shot by specification (`start()` may be called once), so there is no such
 * thing as reusing an oscillator — the pooling that matters here is (a) the shared
 * noise buffer built once per context, (b) the shared saturation curves and impulse
 * response, also once per context, and (c) the voice budget in `engine.ts`.
 *
 * `exponentialRampToValueAtTime` can never touch zero, so every decay lands on
 * `SILENCE` and is then hard-zeroed with a `setValueAtTime` — otherwise a node's
 * gain stays at a small non-zero value forever and a few hundred of them add up to
 * an audible noise floor.
 *
 * ── Node cost, because mobile is a target ───────────────────────────────────────
 *
 * Every primitive here reports honestly in `--mode depth`'s node census, which
 * counts real `ctx.create*` calls per sound and fails the build if any single sound
 * exceeds its budget. Saturation costs ONE `WaveShaperNode` on top of a tone;
 * `voices: 2` costs one extra oscillator; the reverb costs ONE convolver for the
 * WHOLE PAGE (it lives on the master bus, not on the voice) plus one gain per voice.
 * The expensive primitive is and always was `grainCloud`, which is why it is the one
 * with a documented count ceiling.
 */

/** The floor an exponential ramp decays to (it may not reach 0). -80 dBFS. */
const SILENCE = 0.0001;

/** Deterministic per-event variation source. */
export type Rng = () => number;

/**
 * Small xorshift32 PRNG. Deliberately NOT `Math.random`: variation has to be
 * reproducible on demand so a probe can render the same sound twice and assert the
 * two renders are IDENTICAL (proving the seed is honoured) and then render two
 * different seeds and assert they DIFFER (proving variation is real and not a
 * constant that happens to be applied).
 */
export function makeRng(seed: number): Rng {
  let s = (seed | 0) || 0x9e3779b9;
  return () => {
    s ^= s << 13;
    s ^= s >>> 17;
    s ^= s << 5;
    // >>> 0 then scale — keeps the result in [0, 1).
    return (s >>> 0) / 4294967296;
  };
}

/** Everything a sound needs. See the header: this is the whole surface. */
export interface SynthCtx {
  /** Live `AudioContext` in the game, `OfflineAudioContext` under test. */
  ctx: BaseAudioContext;
  /** Where this sound's output goes. The engine hands each voice its own gain node
   * (already panned and level-matched), so a sound never needs to know about the
   * master bus, the limiter, or the mute state. */
  dest: AudioNode;
  /**
   * The REVERB SEND for this voice, or `undefined` if the engine has no reverb bus
   * (the mobile low-quality tier, and the dry control in `--mode depth`).
   *
   * Optional by design. A sound written against `dest` alone still works and just
   * comes out dry, so the reverb can be switched off wholesale without touching a
   * single sound — which is exactly what a quality tier needs to be able to do.
   * Use it through `wet` on `NoiseOpts`/`ToneOpts`, or `sendWet()` directly.
   */
  wet?: AudioNode;
  /** Context time this sound starts at. Always >= `ctx.currentTime`. */
  when: number;
  /** Per-event variation. Call it as many times as you like. */
  rng: Rng;
}

/** A scheduled sound. Returns its total duration in SECONDS, tail included — the
 * engine uses this to know when the voice is free again, so under-reporting it
 * truncates your own sound's cleanup and over-reporting it wastes a voice slot.
 *
 * The reverb tail is deliberately NOT counted: it rings out on the shared bus after
 * the voice has been released, which is what lets a sound have a room around it
 * without paying for one of the twenty voice slots to hear it. */
export type SoundFn = (s: SynthCtx) => number;

/** Uniform sample in `[lo, hi)`. */
export function rand(rng: Rng, lo: number, hi: number): number {
  return lo + rng() * (hi - lo);
}

/** Multiplicative pitch jitter, expressed in cents so it reads musically.
 * `±40` cents is a comfortable "same sound, not a clone" amount. */
export function centsJitter(rng: Rng, cents: number): number {
  return Math.pow(2, rand(rng, -cents, cents) / 1200);
}

// ─────────────────────────────────────────────────────────────────────────────
// Shared white-noise buffer
// ─────────────────────────────────────────────────────────────────────────────

/**
 * One 2-second mono white-noise buffer per context, built lazily and shared by
 * every noise-based sound forever after.
 *
 * This is the single allocation that actually matters in this layer: at 48 kHz a
 * 2 s Float32 buffer is 384 KB, and splashes/crackles/whooshes are the most common
 * sounds in the game. Generating one per shot would allocate tens of megabytes a
 * minute and stall on GC — on a phone, visibly. Sources instead read a random
 * OFFSET into this one buffer, which also gives every noise burst a different grain
 * for free.
 *
 * Keyed by context in a `WeakMap` so an offline render under test never touches the
 * live game's buffer, and neither leaks if a context is thrown away.
 */
const noiseBuffers = new WeakMap<BaseAudioContext, AudioBuffer>();

export function noiseBuffer(ctx: BaseAudioContext): AudioBuffer {
  const cached = noiseBuffers.get(ctx);
  if (cached) return cached;
  const length = Math.floor(ctx.sampleRate * 2);
  const buf = ctx.createBuffer(1, length, ctx.sampleRate);
  const data = buf.getChannelData(0);
  // Fixed seed: the noise BED is identical every run, so a probe measuring spectral
  // content gets a stable number. Per-event variation comes from the random read
  // offset and the filter/envelope parameters, not from the bed itself.
  const rng = makeRng(0x5eed1e);
  for (let i = 0; i < length; i++) data[i] = rng() * 2 - 1;
  noiseBuffers.set(ctx, buf);
  return buf;
}

// ─────────────────────────────────────────────────────────────────────────────
// Waveshaping / saturation
// ─────────────────────────────────────────────────────────────────────────────

/**
 * `tanh` saturation curves, cached per context and per drive amount.
 *
 * **Why this is the most important primitive added in the depth pass.** A sine has
 * one partial. Measured on the shipped catalogue before this existed, `impact(16)`'s
 * body resolved to exactly one spectral peak at 129 Hz — the same count a bare sine
 * control scores — which is precisely what "sounds synthetic" means in a spectrum.
 * Pushing that sine through `tanh(drive·x)` generates a full odd-harmonic series, so
 * the same note becomes a thing with a timbre.
 *
 * It is also, and separately, the ONLY way this game has any low end on a phone. An
 * impact body sweeping to 45 Hz is inaudible on a phone speaker no matter how loud
 * it is scheduled; its saturation harmonics at 135/225/315 Hz are perfectly audible,
 * and the ear reconstructs the missing fundamental from them. The two complaints
 * "too little harmonic content" and "no low end" have one fix.
 *
 * The curve is normalised by `tanh(drive)` so the peak stays at 1 and `peak` in the
 * envelope keeps meaning what it says — otherwise every saturated layer would also
 * quietly get quieter, and the whole mix would drift as drive was tuned.
 */
const saturationCurves = new WeakMap<BaseAudioContext, Map<number, Float32Array>>();

export function saturationCurve(ctx: BaseAudioContext, drive: number): Float32Array {
  let perCtx = saturationCurves.get(ctx);
  if (!perCtx) {
    perCtx = new Map();
    saturationCurves.set(ctx, perCtx);
  }
  // Quantise the key so per-event jitter on `drive` cannot spawn a thousand tables.
  const d = Math.max(0.05, Math.round(drive * 20) / 20);
  const cached = perCtx.get(d);
  if (cached) return cached;
  const n = 1024;
  const curve = new Float32Array(n);
  const norm = Math.tanh(d);
  for (let i = 0; i < n; i++) {
    const x = (i / (n - 1)) * 2 - 1;
    curve[i] = Math.tanh(d * x) / norm;
  }
  perCtx.set(d, curve);
  return curve;
}

/** A `WaveShaperNode` carrying `saturationCurve(drive)`. `2x` oversampling: enough
 * to keep the harmonics this generates from folding back as aliasing, and half the
 * cost of `4x`, which matters when a busy frame has twenty voices. */
export function saturator(ctx: BaseAudioContext, drive: number): WaveShaperNode {
  const ws = ctx.createWaveShaper();
  ws.curve = saturationCurve(ctx, drive) as WaveShaperNode['curve'];
  ws.oversample = '2x';
  return ws;
}

// ─────────────────────────────────────────────────────────────────────────────
// The room
// ─────────────────────────────────────────────────────────────────────────────

/** How long the synthesised kitchen impulse response runs, in seconds. */
const IR_SECONDS = 0.26;
/** Time for the diffuse tail to fall 60 dB. A small hard-surfaced room, not a hall.
 * Deliberately short: the acceptance test in `--mode offline` cross-checks every
 * sound's measured -66 dBFS extent against its declared duration, and a long tail
 * would make every sound in the game measure as over-running itself. A kitchen is
 * genuinely this short, and a brawler cannot afford a hit to still be audible when
 * the next one lands. */
const IR_RT60 = 0.19;

const impulseResponses = new WeakMap<BaseAudioContext, AudioBuffer>();

/**
 * A synthesised stereo impulse response — the game's only sense of space, and it
 * costs zero bytes of download.
 *
 * "Everything is dry" was measurable, not a matter of taste: before this existed,
 * every sound in the catalogue had a -66 dBFS extent SHORTER than its own declared
 * duration. There was no energy after the envelope at all, anywhere, so every sound
 * was pasted onto the frame rather than happening in a place.
 *
 * The response is built in three parts, which is what a small hard room actually
 * does and what a plain exponential noise burst does not:
 *
 *  1. **Pre-delay** (~5 ms of silence). Separates the source from its room, which is
 *     what stops reverb from thickening the transient it is supposed to sit behind.
 *  2. **Early reflections** — a handful of discrete taps at 7-46 ms with alternating
 *     signs, at DIFFERENT times in the two channels. This is the part the ear
 *     actually uses to judge room size, and the inter-channel difference is what
 *     makes the room wide. A mono IR sounds like a filter, not a space.
 *  3. **Diffuse tail** — decorrelated noise under an exponential decay, progressively
 *     lowpassed so the tail darkens as it dies (a one-pole whose coefficient walks
 *     toward 1). Tile and steel are bright, so the damping is mild.
 *
 * Deterministic by construction (fixed seed), so `--mode variation`'s "same seed
 * renders identically" assertion still holds to within a float32 ULP with the room
 * in the signal path.
 */
export function impulseResponse(ctx: BaseAudioContext): AudioBuffer {
  const cached = impulseResponses.get(ctx);
  if (cached) return cached;
  const sr = ctx.sampleRate;
  const n = Math.floor(sr * IR_SECONDS);
  const buf = ctx.createBuffer(2, n, sr);
  const predelay = Math.floor(sr * 0.005);
  // ln(1000) = 6.9078 — the decay constant that lands 60 dB down at IR_RT60.
  const k = 6.9078 / (IR_RT60 * sr);

  for (let ch = 0; ch < 2; ch++) {
    const d = buf.getChannelData(ch);
    const rng = makeRng(ch === 0 ? 0x1e5f21 : 0x77a3d1);

    // (3) diffuse tail, with progressive damping.
    let lp = 0;
    for (let i = predelay; i < n; i++) {
      const t = i - predelay;
      // Damping coefficient walks from 0.30 to 0.72 across the tail: the room gets
      // duller as it decays, which is what absorption does.
      const a = 0.3 + 0.42 * (t / (n - predelay));
      const white = rng() * 2 - 1;
      lp = lp * a + white * (1 - a);
      d[i] = lp * Math.exp(-k * t);
    }

    // (2) early reflections, laid ON TOP of the tail. Times differ per channel by a
    // few samples — that difference IS the width.
    const taps = ch === 0
      ? [0.0071, 0.0132, 0.0198, 0.0281, 0.0367, 0.0458]
      : [0.0083, 0.0119, 0.0214, 0.0263, 0.0389, 0.0441];
    for (let e = 0; e < taps.length; e++) {
      const i = predelay + Math.floor(taps[e] * sr);
      if (i >= n) continue;
      const sign = e % 2 === 0 ? 1 : -1;
      d[i] += sign * 0.62 * Math.exp(-k * (i - predelay) * 0.55);
    }
  }

  // Normalise to a known peak so `wet` amounts mean the same thing on every device
  // and in every render. `ConvolverNode.normalize` is switched OFF in `convolver()`
  // for exactly this reason: its own normalisation is by total power, which changes
  // if the IR is ever re-tuned, and a wet send that silently re-levels itself is not
  // something a measurement can pin down.
  let peak = 0;
  for (let ch = 0; ch < 2; ch++) {
    const d = buf.getChannelData(ch);
    for (let i = 0; i < n; i++) peak = Math.max(peak, Math.abs(d[i]));
  }
  const g = peak > 0 ? 0.6 / peak : 1;
  for (let ch = 0; ch < 2; ch++) {
    const d = buf.getChannelData(ch);
    for (let i = 0; i < n; i++) d[i] *= g;
  }

  impulseResponses.set(ctx, buf);
  return buf;
}

/** The shared room. ONE of these exists per page — it lives on the master bus in
 * `engine.ts`, never on a voice, so twenty simultaneous sounds cost one convolution
 * and not twenty. */
export function convolver(ctx: BaseAudioContext): ConvolverNode {
  const c = ctx.createConvolver();
  c.normalize = false;
  c.buffer = impulseResponse(ctx);
  return c;
}

/**
 * Route a node into this voice's reverb send at `amount`.
 *
 * Silently does nothing when the engine has no reverb bus, which is the whole point
 * of the optional `wet` on `SynthCtx`: a sound never has to ask whether the room
 * exists, and switching the room off for a low-end phone is one flag in `engine.ts`
 * rather than an edit to every sound in the game.
 */
export function sendWet(s: SynthCtx, node: AudioNode, amount: number): void {
  if (!s.wet || !(amount > 0)) return;
  const g = s.ctx.createGain();
  g.gain.value = amount;
  node.connect(g);
  g.connect(s.wet);
}

// ─────────────────────────────────────────────────────────────────────────────
// Envelopes
// ─────────────────────────────────────────────────────────────────────────────

export interface EnvOpts {
  /** Peak linear gain. */
  peak: number;
  /** Seconds from silence to peak. A few ms reads as a transient; 30-80 ms reads as
   * a swell (a swung weapon, a pour). */
  attack?: number;
  /** Total length including the attack. */
  duration: number;
  /** Fraction of the post-attack time spent at full level before the decay starts.
   * 0 for a percussive hit, ~0.4 for something with a body. */
  hold?: number;
  /** `exp` for a natural percussive tail, `lin` for a mechanical fade. */
  curve?: 'exp' | 'lin';
  /**
   * How much of this layer goes to the shared room, 0..1. Roughly: 0.05-0.12 for a
   * transient (a click wants to stay tight and dry or it turns to mush), 0.12-0.25
   * for a body, 0.25-0.5 for something that is meant to sound distant or wet.
   *
   * No-op when the engine has no reverb bus.
   */
  wet?: number;
}

/**
 * Build a gain node carrying a complete AD(H)SR-ish envelope. The caller connects
 * sources into it and it into `dest`.
 */
export function envelope(ctx: BaseAudioContext, when: number, o: EnvOpts): GainNode {
  const g = ctx.createGain();
  const attack = Math.max(0.0005, o.attack ?? 0.002);
  const hold = (o.duration - attack) * Math.max(0, Math.min(0.9, o.hold ?? 0));
  const peak = Math.max(SILENCE * 2, o.peak);
  const end = when + o.duration;

  g.gain.setValueAtTime(SILENCE, when);
  g.gain.linearRampToValueAtTime(peak, when + attack);
  if (hold > 0) g.gain.setValueAtTime(peak, when + attack + hold);
  if ((o.curve ?? 'exp') === 'exp') g.gain.exponentialRampToValueAtTime(SILENCE, end);
  else g.gain.linearRampToValueAtTime(0, end);
  // Hard zero after the ramp — an exponential tail never actually reaches 0, and a
  // few dozen nodes idling at -80 dBFS is a measurable noise floor.
  g.gain.setValueAtTime(0, end + 0.001);
  return g;
}

/** Apply a one- or two-point ramp to any `AudioParam`, in the shape the rest of
 * this file wants: a scalar means "hold", a pair means "sweep from → to". */
function applyRamp(
  param: AudioParam,
  value: number | readonly [number, number],
  when: number,
  duration: number,
  curve: 'exp' | 'lin' = 'exp',
): void {
  if (typeof value === 'number') {
    param.setValueAtTime(value, when);
    return;
  }
  const [from, to] = value;
  param.setValueAtTime(from, when);
  if (curve === 'exp' && from > 0 && to > 0) param.exponentialRampToValueAtTime(to, when + duration);
  else param.linearRampToValueAtTime(to, when + duration);
}

// ─────────────────────────────────────────────────────────────────────────────
// Primitives
// ─────────────────────────────────────────────────────────────────────────────

export interface NoiseOpts extends EnvOpts {
  /** Filter shape applied to the noise. `bandpass` is the workhorse (splashes,
   * whooshes, crunches); `lowpass` for dull/wet; `highpass` for brittle/crisp. */
  filter?: BiquadFilterType;
  /** Cutoff/centre in Hz, or `[start, end]` to sweep it across the sound's life.
   * The sweep is what turns a static hiss into a gesture. */
  freq?: number | readonly [number, number];
  /** Filter resonance. > 4 starts to whistle, which is exactly what a droplet or a
   * gurgle wants and exactly what a crunch does not. */
  q?: number;
  /**
   * Filter slope in dB/octave: 12 (one biquad, the default) or 24 (two cascaded).
   *
   * This matters far more than it looks. A single biquad lowpass is NOT enough to
   * make a sound dark — white noise has equal energy per Hz, so the three octaves
   * above the cutoff still carry most of the spectral weight at 12 dB/oct. Measured:
   * Soup's splash, lowpassed at ~2.5 kHz, came out with a spectral centroid of
   * **3.7 kHz** — the wettest weapon in the game measuring brighter than the
   * brittlest. Cascading a second pole moves the same sound to ~1.8 kHz and, more to
   * the point, makes it actually sound muffled instead of hissy.
   */
  poles?: 12 | 24;
  /** Playback-rate multiplier on the noise bed — cheap spectral tilt on top of the
   * filter, and another axis of per-event variation. */
  rate?: number;
  /** Curve for the frequency sweep (independent of the amplitude curve). */
  freqCurve?: 'exp' | 'lin';
  /** Ride an amplitude modulation on top of the envelope — see `tremolo`. This is
   * how a spinning object is made to sound like it is spinning. */
  tremolo?: { rate: number | readonly [number, number]; depth: number };
  /**
   * Saturation drive applied AFTER the filter, 0 for none.
   *
   * On noise this is a thickener rather than a harmonic generator: `tanh` squashes
   * the peaks of a Gaussian-ish signal toward its RMS, which raises the perceived
   * density of a crunch without raising its peak. A crunch at drive 2.5 sounds
   * heavier at the same measured peak level, which is exactly what a small speaker
   * needs.
   */
  drive?: number;
}

/**
 * Filtered noise burst — splashes, crunches, whooshes, hiss, sizzle.
 * The single most-used primitive in this directory.
 */
export function noiseBurst(s: SynthCtx, o: NoiseOpts): number {
  const { ctx, dest, when } = s;
  const src = ctx.createBufferSource();
  src.buffer = noiseBuffer(ctx);
  src.playbackRate.value = o.rate ?? 1;
  // Random read offset into the shared bed — different grain per shot, zero cost.
  const offset = rand(s.rng, 0, 1.5);

  const env = envelope(ctx, when, o);
  // The tremolo (if any) sits IN SERIES before the envelope, multiplying it — see
  // `tremoloNode` for why it cannot be added onto the envelope's own gain param.
  const head: AudioNode = o.tremolo
    ? tremoloNode(ctx, when, o.duration, o.tremolo.rate, o.tremolo.depth)
    : env;
  if (head !== env) (head as GainNode).connect(env);

  // Saturation sits between the filter and the envelope: shaping a constant-level
  // signal gives a stable timbre, where shaping the already-enveloped signal would
  // make the drive fall away with the decay and the harmonics move as it dies.
  const shaped: AudioNode = o.drive ? saturator(ctx, o.drive) : head;
  if (shaped !== head) (shaped as WaveShaperNode).connect(head);

  if (o.filter) {
    const makeFilter = (q: number): BiquadFilterNode => {
      const filt = ctx.createBiquadFilter();
      filt.type = o.filter!;
      filt.Q.value = q;
      applyRamp(filt.frequency, o.freq ?? 1000, when, o.duration, o.freqCurve ?? 'exp');
      return filt;
    };
    if (o.poles === 24) {
      // Split the resonance across the two stages, or a cascaded Q of (say) 4 twice
      // over rings like a filter sweep instead of just being steep.
      const q = Math.sqrt(Math.max(0.1, o.q ?? 1));
      src.connect(makeFilter(q)).connect(makeFilter(q)).connect(shaped);
    } else {
      src.connect(makeFilter(o.q ?? 1)).connect(shaped);
    }
  } else {
    src.connect(shaped);
  }
  env.connect(dest);
  sendWet(s, env, o.wet ?? 0);

  src.start(when, offset, o.duration + 0.02);
  src.stop(when + o.duration + 0.02);
  return o.duration;
}

export interface ToneOpts extends EnvOpts {
  type?: OscillatorType;
  /** Hz, or `[start, end]` for a pitch sweep. A fast DOWNWARD sweep is the universal
   * "impact/thump"; a fast UPWARD sweep is the universal "water droplet". */
  freq: number | readonly [number, number];
  /** Optional lowpass over the oscillator, same scalar-or-sweep shape. Rounds off a
   * saw/square so it reads as a body rather than a buzz. */
  lowpass?: number | readonly [number, number];
  freqCurve?: 'exp' | 'lin';
  /**
   * Saturation drive, 0 or absent for a clean oscillator.
   *
   * **This is the knob that fixes "shallow" on a pitched layer.** A `sine` at drive 0
   * measures as exactly one spectral peak — the same count as a test tone, which is
   * what it is. At drive 2-3 the same sine measures 4-7 peaks and reads as an object.
   * See the file header for the measurement this was derived from.
   */
  drive?: number;
  /**
   * Number of detuned oscillators stacked, 1-3. Stacked voices beat against each
   * other at a few Hz, which is the difference between a tone and something
   * physically vibrating. Costs one extra oscillator per voice above the first.
   */
  voices?: number;
  /** Total detune spread across the stack, in cents. 8-25 is a body; past ~40 it
   * reads as two separate notes. */
  detuneCents?: number;
  /**
   * Ring-modulate the oscillator by a sine at this frequency (or sweep).
   *
   * True ring modulation — the carrier is fully suppressed and what comes out is the
   * SUM and DIFFERENCE frequencies only. Those are INHARMONIC, which no amount of
   * saturation or filtering can produce, and inharmonicity is exactly what the ear
   * uses to identify struck glass, hard candy and thin plastic. Lollipop's candy and
   * Water Bottle's shell are both built on it, and nothing else in the roster is.
   */
  ring?: number | readonly [number, number];
}

/** Pitched oscillator with an optional pitch sweep — thumps, blips, chirps, stings. */
export function tone(s: SynthCtx, o: ToneOpts): number {
  const { ctx, dest, when } = s;
  const env = envelope(ctx, when, o);

  // Saturation, then (optionally) ring modulation, then the envelope. Order matters:
  // saturating BEFORE the ring mod keeps the inharmonic sidebands from being folded
  // back into a harmonic series by the shaper.
  let head: AudioNode = env;
  if (o.ring !== undefined) {
    // A gain node whose gain is driven from ±1 by an LFO, with a static value of 0,
    // multiplies its input by that LFO — i.e. true ring modulation, carrier fully
    // suppressed. (The same node used with a non-zero static value would be tremolo;
    // see `tremoloNode` for why that distinction has bitten this project already.)
    const ringGain = ctx.createGain();
    ringGain.gain.value = 0;
    const lfo = ctx.createOscillator();
    lfo.type = 'sine';
    applyRamp(lfo.frequency, o.ring, when, o.duration, 'exp');
    lfo.connect(ringGain.gain);
    lfo.start(when);
    lfo.stop(when + o.duration + 0.02);
    ringGain.connect(env);
    head = ringGain;
  }
  if (o.drive) {
    const ws = saturator(ctx, o.drive);
    ws.connect(head);
    head = ws;
  }
  if (o.lowpass !== undefined) {
    const filt = ctx.createBiquadFilter();
    filt.type = 'lowpass';
    filt.Q.value = 0.7;
    applyRamp(filt.frequency, o.lowpass, when, o.duration);
    filt.connect(head);
    head = filt;
  }

  const stack = Math.max(1, Math.min(3, Math.round(o.voices ?? 1)));
  const spread = o.detuneCents ?? 0;
  for (let i = 0; i < stack; i++) {
    const osc = ctx.createOscillator();
    osc.type = o.type ?? 'sine';
    // Spread the stack symmetrically about the authored pitch: -s/2 .. +s/2.
    const cents = stack === 1 ? 0 : (i / (stack - 1) - 0.5) * spread;
    const mul = Math.pow(2, cents / 1200);
    if (typeof o.freq === 'number') applyRamp(osc.frequency, o.freq * mul, when, o.duration, o.freqCurve ?? 'exp');
    else applyRamp(osc.frequency, [o.freq[0] * mul, o.freq[1] * mul], when, o.duration, o.freqCurve ?? 'exp');
    // Level-compensate the stack so `peak` keeps meaning the same thing whether a
    // layer is one oscillator or three.
    if (stack > 1) {
      const g = ctx.createGain();
      g.gain.value = 1 / stack;
      osc.connect(g).connect(head);
    } else {
      osc.connect(head);
    }
    osc.start(when);
    osc.stop(when + o.duration + 0.02);
  }

  env.connect(dest);
  sendWet(s, env, o.wet ?? 0);
  return o.duration;
}

export interface ModeSpec {
  /** Partial frequency as a MULTIPLE of the fundamental. Integer ratios read as a
   * pitched/harmonic object (a struck tube); irrational ones read as metal, glass or
   * hard candy. */
  ratio: number;
  /** Relative amplitude, 0..1. */
  gain: number;
  /** This partial's decay as a multiple of the fundamental's. Real objects damp
   * their high modes fastest, so anything above ~1 sounds backwards. */
  decay: number;
}

export interface ModesOpts {
  /** Fundamental in Hz, or `[from, to]` for a struck object that also bends. */
  freq: number | readonly [number, number];
  /** How long the FUNDAMENTAL rings. Higher modes are shorter by their `decay`. */
  duration: number;
  peak: number;
  attack?: number;
  modes: readonly ModeSpec[];
  drive?: number;
  wet?: number;
}

/**
 * A bank of independently-decaying partials — MODAL SYNTHESIS, and the layer that
 * makes a sound say WHAT WAS HIT rather than just that something was.
 *
 * A struck object does not produce a harmonic series with one envelope on it: it
 * produces a set of resonant modes at ratios fixed by its geometry, each losing
 * energy at its own rate, with the high modes dying first. That last detail is most
 * of the effect — a bank of partials sharing one envelope sounds like a chord, and
 * the same bank with staggered decays sounds like an object.
 *
 * Used by the three characters whose identity is a RESONANCE rather than a texture:
 * Donut's ring (near-harmonic, long), Lollipop's hard candy (inharmonic, glassy) and
 * Water Bottle's hollow plastic shell (a squat, strongly damped low mode). Nothing
 * else in the roster rings, which is exactly why they are separable by ear.
 *
 * Costs one oscillator + one gain per mode, so keep banks to 3-5 partials.
 */
export function modes(s: SynthCtx, o: ModesOpts): number {
  let longest = 0;
  for (const m of o.modes) {
    const dur = o.duration * m.decay;
    longest = Math.max(longest, dur);
    const f: number | readonly [number, number] =
      typeof o.freq === 'number' ? o.freq * m.ratio : [o.freq[0] * m.ratio, o.freq[1] * m.ratio];
    tone(s, {
      type: 'sine',
      freq: f,
      peak: o.peak * m.gain,
      attack: o.attack ?? 0.0015,
      duration: dur,
      drive: o.drive,
      wet: o.wet,
    });
  }
  return longest;
}

/**
 * A gain node carrying an amplitude modulation (tremolo), to be inserted IN SERIES
 * ahead of an envelope.
 *
 * Used by Pizza, whose whole identity is a FLAT SPINNING DISC: a disc chopping
 * through air is a whoosh with a periodic flutter on it, and that flutter is what
 * separates it from every other whoosh in the game. It is directly measurable — the
 * probe demodulates the rendered envelope and asserts a peak at the spin rate — so
 * this is a claim about the output, not about the code.
 *
 * **Why series and not additive.** Connecting an LFO straight onto an envelope's
 * `gain` AudioParam ADDS to it, which is wrong twice over: once the envelope has
 * decayed below the LFO's amplitude the modulation stops being a modulation and
 * becomes the entire signal (so the sound never decays), and when the sum goes
 * negative the gain merely inverts phase instead of dipping, so the amplitude never
 * actually reaches a trough — the flutter would be inaudible AND unmeasurable. A
 * separate node oscillating about `1 - depth/2` multiplies the envelope instead,
 * which is what tremolo actually is.
 *
 * `depth` is 0..1, where 1 is full 0→1 modulation.
 */
export function tremoloNode(
  ctx: BaseAudioContext,
  when: number,
  duration: number,
  rateHz: number | readonly [number, number],
  depth: number,
): GainNode {
  const d = Math.max(0, Math.min(1, depth));
  const g = ctx.createGain();
  g.gain.value = 1 - d * 0.5;

  const lfo = ctx.createOscillator();
  lfo.type = 'sine';
  applyRamp(lfo.frequency, rateHz, when, duration, 'lin');
  const amount = ctx.createGain();
  amount.gain.value = d * 0.5;
  lfo.connect(amount);
  amount.connect(g.gain);
  lfo.start(when);
  lfo.stop(when + duration + 0.02);
  return g;
}

export interface TransientOpts {
  peak: number;
  /** Where the noise tick sits. 4-6 kHz is a hard surface; 2-3 kHz is soft/meaty. */
  freq?: number;
  /** The pitched snap's starting frequency; it sweeps down an octave and a half.
   * Omit for a pure noise tick (rarely what you want — see below). */
  snap?: number;
  /** Snap length. Under ~6 ms reads as part of the click; over ~25 ms reads as a
   * separate little bleep. */
  snapMs?: number;
  wet?: number;
}

/**
 * THE TRANSIENT LAYER — a few milliseconds that tell the ear the exact instant
 * something happened.
 *
 * Two components, and the second is the one that is usually missing:
 *
 *  1. A very short high-passed noise TICK. On its own this is a "tss": it marks the
 *     instant but carries no information about what made it.
 *  2. A pitched SNAP — a fast downward-swept triangle, saturated. This is what gives
 *     a click a *pitch*, and it is the difference between a hit and a hiss. Measured:
 *     the shipped generic impact's transient was noise alone and its onset spectrum
 *     carried 0.22-0.29 of its energy above 3 kHz with no peak structure at all,
 *     which is a definition of "sounds like a beep or a hiss".
 *
 * Deliberately dry by default (`wet` 0.06). Reverb on a transient smears the one
 * thing the transient exists to do.
 */
export function transient(s: SynthCtx, o: TransientOpts): number {
  const f = o.freq ?? 5000;
  const tick = noiseBurst(s, {
    filter: 'highpass',
    freq: f,
    q: 0.9,
    peak: o.peak,
    attack: 0.0004,
    duration: 0.007,
    wet: o.wet ?? 0.06,
  });
  if (!o.snap) return tick;
  const snapDur = (o.snapMs ?? 14) / 1000;
  const snap = tone(s, {
    type: 'triangle',
    freq: [o.snap, o.snap * 0.38],
    peak: o.peak * 0.72,
    attack: 0.0006,
    duration: snapDur,
    drive: 2.2,
    wet: o.wet ?? 0.06,
  });
  return longest(tick, snap);
}

export interface GrainOpts {
  /** How many grains. 10-20 reads as a shatter; 3-5 as a few pieces landing. */
  count: number;
  /** Window the grains are scattered across. */
  spread: number;
  /** Each grain's length. Under ~10 ms it reads as a click, not a tone. */
  grainMs?: readonly [number, number];
  /** Bandpass centre range each grain picks from. High = brittle/ceramic/crisp. */
  freq: readonly [number, number];
  q?: number;
  peak: number;
  /** Grains later in the window get quieter by this factor at the end of the
   * spread, so a shatter decays instead of rattling flat. */
  decay?: number;
  /**
   * Multiply every grain's centre frequency by a factor that walks from `[0]` to
   * `[1]` across the spread.
   *
   * This is what separates a cloud that is BREAKING from a cloud that is UNROLLING.
   * Taco's shell fragments all come from the same brittle break, so its band stays
   * put; Burrito's tortilla ribbon comes apart progressively along its length, so its
   * band walks downward as the strip unwinds. Same primitive, different gesture, and
   * the difference is audible and measurable rather than a matter of EQ.
   */
  freqShift?: readonly [number, number];
  /** Saturation on each grain. Thickens a crunch without raising its peak. */
  drive?: number;
  wet?: number;
}

/**
 * A cloud of very short filtered clicks — crackle, shatter, fragments, debris.
 *
 * This is Taco's whole voice (a brittle shell breaking) and it is deliberately a
 * different SHAPE of sound from a burst or a tone, not just a different EQ: the ear
 * identifies brittleness from the density and irregularity of transients, which is
 * something no single envelope can fake.
 *
 * Costs `count` source nodes, so the caller pays for the drama — keep counts modest
 * and let the voice budget in `engine.ts` be the backstop.
 */
export function grainCloud(s: SynthCtx, o: GrainOpts): number {
  const [gMinMs, gMaxMs] = o.grainMs ?? [4, 11];
  const decay = o.decay ?? 0.35;
  const shift = o.freqShift;
  for (let i = 0; i < o.count; i++) {
    // Slight bias toward the front of the window: a shatter is dense at the start
    // and sparse at the end, never uniform.
    const t = Math.pow(s.rng(), 1.5) * o.spread;
    const dur = rand(s.rng, gMinMs, gMaxMs) / 1000;
    const level = o.peak * (1 - (t / o.spread) * (1 - decay)) * rand(s.rng, 0.55, 1);
    const walk = shift ? shift[0] + (shift[1] - shift[0]) * (t / o.spread) : 1;
    noiseBurst(
      { ...s, when: s.when + t },
      {
        filter: 'bandpass',
        freq: rand(s.rng, o.freq[0], o.freq[1]) * walk,
        q: o.q ?? 6,
        peak: level,
        attack: 0.0008,
        duration: dur,
        drive: o.drive,
        wet: o.wet,
      },
    );
  }
  return o.spread + gMaxMs / 1000;
}

/**
 * Scattered upward-chirping sine drops — the canonical "water droplet" cue.
 *
 * A sine whose pitch sweeps UP fast while it decays is what the ear reads as a drip;
 * downward is a thump. Soup uses this everywhere, and nothing else in the roster
 * does, which is what stops a soup splash from sounding like any other wet hit.
 */
export function droplets(
  s: SynthCtx,
  o: {
    count: number;
    spread: number;
    freq: readonly [number, number];
    rise?: number;
    peak: number;
    wet?: number;
  },
): number {
  const rise = o.rise ?? 2.6;
  let last = 0;
  for (let i = 0; i < o.count; i++) {
    const t = rand(s.rng, 0, o.spread);
    const f0 = rand(s.rng, o.freq[0], o.freq[1]);
    const dur = rand(s.rng, 0.045, 0.095);
    last = Math.max(last, t + dur);
    tone(
      { ...s, when: s.when + t },
      {
        type: 'sine',
        freq: [f0, f0 * rise],
        peak: o.peak * rand(s.rng, 0.5, 1),
        attack: 0.002,
        duration: dur,
        wet: o.wet,
      },
    );
  }
  return last;
}

/** Longest of a set of scheduled durations — what a composite sound returns. */
export function longest(...durations: number[]): number {
  let m = 0;
  for (const d of durations) if (d > m) m = d;
  return m;
}
