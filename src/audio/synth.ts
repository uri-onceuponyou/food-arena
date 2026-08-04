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
 * ── Scheduling discipline ───────────────────────────────────────────────────────
 *
 * Every node is created, scheduled and forgotten. Web Audio source nodes are
 * one-shot by specification (`start()` may be called once), so there is no such
 * thing as reusing an oscillator — the pooling that matters here is (a) the shared
 * noise buffer built once per context, and (b) the voice budget in `engine.ts`.
 * Nothing in this file allocates a buffer.
 *
 * `exponentialRampToValueAtTime` can never touch zero, so every decay lands on
 * `SILENCE` and is then hard-zeroed with a `setValueAtTime` — otherwise a node's
 * gain stays at a small non-zero value forever and a few hundred of them add up to
 * an audible noise floor.
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
  /** Context time this sound starts at. Always >= `ctx.currentTime`. */
  when: number;
  /** Per-event variation. Call it as many times as you like. */
  rng: Rng;
}

/** A scheduled sound. Returns its total duration in SECONDS, tail included — the
 * engine uses this to know when the voice is free again, so under-reporting it
 * truncates your own sound's cleanup and over-reporting it wastes a voice slot. */
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
      src.connect(makeFilter(q)).connect(makeFilter(q)).connect(head);
    } else {
      src.connect(makeFilter(o.q ?? 1)).connect(head);
    }
  } else {
    src.connect(head);
  }
  env.connect(dest);

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
}

/** Pitched oscillator with an optional pitch sweep — thumps, blips, chirps, stings. */
export function tone(s: SynthCtx, o: ToneOpts): number {
  const { ctx, dest, when } = s;
  const osc = ctx.createOscillator();
  osc.type = o.type ?? 'sine';
  applyRamp(osc.frequency, o.freq, when, o.duration, o.freqCurve ?? 'exp');

  const env = envelope(ctx, when, o);
  if (o.lowpass !== undefined) {
    const filt = ctx.createBiquadFilter();
    filt.type = 'lowpass';
    filt.Q.value = 0.7;
    applyRamp(filt.frequency, o.lowpass, when, o.duration);
    osc.connect(filt).connect(env);
  } else {
    osc.connect(env);
  }
  env.connect(dest);

  osc.start(when);
  osc.stop(when + o.duration + 0.02);
  return o.duration;
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
  for (let i = 0; i < o.count; i++) {
    // Slight bias toward the front of the window: a shatter is dense at the start
    // and sparse at the end, never uniform.
    const t = Math.pow(s.rng(), 1.5) * o.spread;
    const dur = rand(s.rng, gMinMs, gMaxMs) / 1000;
    const level = o.peak * (1 - (t / o.spread) * (1 - decay)) * rand(s.rng, 0.55, 1);
    noiseBurst(
      { ...s, when: s.when + t },
      {
        filter: 'bandpass',
        freq: rand(s.rng, o.freq[0], o.freq[1]),
        q: o.q ?? 6,
        peak: level,
        attack: 0.0008,
        duration: dur,
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
  o: { count: number; spread: number; freq: readonly [number, number]; rise?: number; peak: number },
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
