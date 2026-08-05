/**
 * The audio engine: context lifecycle, the master bus, volume/mute, the voice
 * budget, and the retrigger throttle that stops repeated sounds machine-gunning.
 *
 * Nothing above this file talks to the `AudioContext` directly. Sounds
 * (`synth.ts`, `sounds.ts`, `weapons/`) are pure schedulers; the director
 * (`director.ts`) translates game events into sound requests; this is the only
 * module that owns state.
 *
 * ── Design decisions and why ────────────────────────────────────────────────────
 *
 * **The context is created lazily, on the first user gesture**, and `unlock()` now
 * ENFORCES that rather than merely documenting it. Browsers block audio until a
 * gesture, and a context created before one starts `suspended` with a frozen
 * `currentTime`. `play()` refuses outright while the context is not `running`, so
 * nothing can pile up at t≈0 — the pile-up this comment used to warn about is
 * structurally impossible and the warning was wrong about the mechanism. The cost is
 * real but narrower, and it was measured rather than argued (`unlock()` carries the
 * numbers): `resume()` is asynchronous, so a context created outside a gesture is
 * still `suspended` for the whole of the FIRST gesture's call stack, and every sound
 * that gesture's own handlers schedule is dropped. A context created INSIDE the
 * gesture is born `running` and the same sound is heard. Nothing throws on either
 * path; the game just makes no sound until the player touches something, which they
 * must do to reach a match at all (the menu shell in `ui/screens/` guarantees a real
 * gesture before any match starts).
 *
 * **Volume and mute are read from `localStorage` in the constructor**, before a
 * single node exists, so a muted player is muted on frame one rather than getting one
 * loud frame before the settings screen mounts. There is no settings screen yet; the
 * API this file exposes is what one should call (see `AudioEngine`'s public methods).
 *
 * **The master gain sits AFTER the limiter.** That ordering makes mute provably
 * silent — gain 0 multiplies everything downstream of the dynamics processing, so
 * there is no path by which a compressor's release or a stray tail leaks out — and it
 * keeps the limiter operating at a constant level regardless of where the player set
 * the slider.
 *
 * **Voices are budgeted, not pooled.** Web Audio source nodes are one-shot by
 * specification, so "pooling an oscillator" is not a thing that exists. What pooling
 * means here is the shared noise buffer (`synth.ts`) plus this file's hard cap on
 * concurrent voices, with priority-based rejection when the cap is hit. That is the
 * part that matters on a phone: a 5-pellet spread landing on the same frame as a
 * death and two casts is 8+ simultaneous sounds, each of which is several nodes.
 *
 * **Every public entry point is wrapped.** An audio failure must degrade to silence,
 * never to an exception in the render loop — `match.ts` calls into this on every
 * frame that produced events.
 */

import { convolver, makeRng, type Rng, type SoundFn, type SynthCtx } from './synth';

/** localStorage keys. Namespaced so they can't collide with the profile's. */
const LS_VOLUME = 'fa.audio.volume';
const LS_MUTED = 'fa.audio.muted';

/**
 * Fixed headroom trim folded into the master gain, so "volume 1.0" is a comfortable
 * level rather than a wall of sound, and the limiter has something to work with.
 */
const MASTER_TRIM = 0.62;

/** Concurrent voices allowed. A voice is one `play()` call, which may be a dozen
 * nodes (a grain cloud). Sized for a mid-range phone: past this the CPU cost of
 * biquads and the mud of overlapping transients both stop paying for themselves. */
const DEFAULT_MAX_VOICES = 20;

/** Scheduling lookahead. Web Audio wants a few ms of slack or a sound scheduled at
 * exactly `currentTime` can be clipped at its attack. */
const LOOKAHEAD = 0.008;

export type AudioState = 'idle' | 'running' | 'suspended' | 'failed';

/**
 * Priority decides who survives when the voice budget is full.
 *
 * Deliberately a frozen object rather than a `const enum`: `isolatedModules` is on
 * (see `tsconfig.json`), so esbuild compiles each file alone and cannot inline a
 * const enum's members across module boundaries. That is exactly the class of bug
 * that type-checks cleanly and misbehaves only at runtime.
 */
export const Priority = {
  /** Fog ticks, cover thuds, trail squelches — first to be dropped. */
  Ambient: 0,
  /** Casts and ordinary impacts. */
  Normal: 1,
  /** Deaths, ultimates, match start/end. Never dropped for budget reasons. */
  Critical: 2,
} as const;
export type Priority = (typeof Priority)[keyof typeof Priority];

export interface PlayOptions {
  /** Stereo position, -1 (left) to +1 (right). */
  pan?: number;
  /** Linear gain multiplier applied to this voice on top of the sound's own level. */
  gain?: number;
  priority?: Priority;
  /**
   * Throttle bucket. Two `play()` calls sharing a key within `RETRIGGER_WINDOW`
   * duck the later one and detune it (see `retrigger`), which is what keeps a
   * 5-pellet Rice Spray or a 3-hit peck from sounding like a machine gun.
   */
  key?: string;
  /** Seed for this voice's variation. Omit for a random one. */
  seed?: number;
  /** Delay before the sound starts, seconds. Used for deliberate layering. */
  delay?: number;
}

/** How long after a `key`'s last use a repeat is still considered a retrigger. */
const RETRIGGER_WINDOW = 0.11;
/** Level multiplier applied to the Nth rapid repeat (index 0 = full). Past the end
 * of this table the sound is dropped entirely — five simultaneous pellets should
 * read as one fat impact with texture, not five impacts. */
const RETRIGGER_GAINS = [1, 0.62, 0.42, 0.3, 0.22];

export interface MasterChain {
  /** Where every voice connects. */
  input: GainNode;
  /**
   * The shared REVERB SEND. Every voice that wants a room feeds this; there is
   * exactly ONE convolution for the whole page behind it, not one per voice.
   * `null` when the reverb is disabled (the mobile low-quality tier, and the dry
   * control in `--mode depth`).
   */
  wetIn: GainNode | null;
  /** Static soft-clip curve — see `buildMasterChain`. */
  limiter: WaveShaperNode;
  /** Volume × mute. Last node before the destination. */
  master: GainNode;
}

/**
 * Level of the reverb RETURN, folded in once for the whole game.
 *
 * Per-sound `wet` amounts (`synth.ts`) decide the balance BETWEEN layers; this one
 * number decides how much room the game has at all, and living on the return means
 * changing it does not require re-tuning a single sound.
 *
 * Set by measurement, not by ear alone. At the first value tried (0.85) the room was
 * measurably LOUDER than the dry body 75 ms into an ordinary impact, which is what
 * "drowning in reverb" looks like in numbers: it flattened the measured pitch
 * envelope of every hit, because by then the thing being measured was mostly its own
 * reflections. At 0.5 the room sits about 22 dB under the dry peak — present in the
 * A/B (`--mode depth` renders every sound twice, with the bus and without) and never
 * competing with the hit that caused it.
 */
const REVERB_RETURN = 0.5;

/** Summed signal level below which the soft clip is exactly transparent. */
const CLIP_KNEE = 0.7;
/** Ceiling the curve asymptotes to. */
const CLIP_CEIL = 1.2;
/** Widest summed signal the curve is defined over. Beyond this a `WaveShaperNode`
 * clamps to the endpoint, which is the hard limit of last resort — roughly six loud
 * voices landing on the same sample. */
const CLIP_SPAN = 3;

const clipCurves = new WeakMap<BaseAudioContext, Float32Array>();

/**
 * Static soft-clip transfer curve: identity up to `CLIP_KNEE`, then a tanh knee
 * asymptoting at `CLIP_CEIL`. One table per context, built once.
 *
 * **Why not a `DynamicsCompressorNode`.** That was the first implementation, and it
 * was measured, which is the only reason this comment exists. Configured at
 * threshold -6 dB / ratio 12, Chrome's compressor took **8.2 dB off a signal peaking
 * at -12 dBFS** — 6 dB BELOW its own threshold, where it should have been
 * transparent. A generic ranged cast went in at 0.251 and came out at 0.097. Web
 * Audio's compressor has no makeup gain, so that loss is permanent: the entire game
 * would simply have been quiet, for a reason no amount of reading the code would
 * have revealed. A static curve is transparent by construction, costs a table lookup
 * per sample instead of an envelope follower (this matters on a phone), and renders
 * bit-identically offline — which is what allows the volume assertion in
 * `tools/audio-probe.mjs` to be an equality rather than a range.
 */
function clipCurve(ctx: BaseAudioContext): Float32Array {
  const cached = clipCurves.get(ctx);
  if (cached) return cached;
  const n = 2048;
  const curve = new Float32Array(n);
  for (let i = 0; i < n; i++) {
    // A WaveShaper maps its own input range [-1, 1] across the curve, so the pre-gain
    // below scales the real signal range [-CLIP_SPAN, CLIP_SPAN] onto that.
    const s = ((i / (n - 1)) * 2 - 1) * CLIP_SPAN;
    const a = Math.abs(s);
    const y =
      a <= CLIP_KNEE
        ? a
        : CLIP_KNEE + (CLIP_CEIL - CLIP_KNEE) * Math.tanh((a - CLIP_KNEE) / (CLIP_CEIL - CLIP_KNEE));
    curve[i] = Math.sign(s) * y;
  }
  clipCurves.set(ctx, curve);
  return curve;
}

/**
 * Build the production master bus. Exported so a test can construct the EXACT same
 * chain inside an `OfflineAudioContext` — the mute and volume assertions are only
 * worth anything if they run through the real graph.
 *
 * ```
 * voices -> input ---------------------> preClip -> softClip -> master (vol x mute) -> dest
 *        \-> wetIn -> convolver -> ret -/^
 * ```
 *
 * `master` is deliberately LAST. Mute is then provably silent — gain 0 multiplies
 * everything downstream of the non-linearity AND downstream of the reverb return, so
 * no tail of any kind can leak past it — and the clip curve always sees the same
 * level whatever the player set the slider to, so the mix does not change character
 * with volume.
 *
 * **The reverb return re-enters at `input`, not after the limiter.** That ordering is
 * what makes the room part of the mix rather than a layer painted over it: a loud
 * frame ducks its own reverb along with everything else, which is what stops the
 * tail from swelling up out of a busy fight. It also means the room is inside every
 * existing assertion — mute, volume scaling and the clip ceiling all cover it for
 * free, with no new trust placed anywhere.
 */
export function buildMasterChain(
  ctx: BaseAudioContext,
  destination?: AudioNode,
  reverb = true,
): MasterChain {
  const input = ctx.createGain();
  input.gain.value = 1;

  // ONE convolution for the page. A per-voice convolver would be twenty of them on a
  // busy frame, which is the single most expensive thing this pillar could do to a
  // phone; a send bus makes the room cost exactly the same whether one sound is
  // playing or twenty.
  let wetIn: GainNode | null = null;
  if (reverb) {
    try {
      wetIn = ctx.createGain();
      wetIn.gain.value = 1;
      const ret = ctx.createGain();
      ret.gain.value = REVERB_RETURN;
      wetIn.connect(convolver(ctx)).connect(ret).connect(input);
    } catch {
      // A missing/failing ConvolverNode must cost the room, never the game.
      wetIn = null;
    }
  }

  const preClip = ctx.createGain();
  preClip.gain.value = 1 / CLIP_SPAN;

  const limiter = ctx.createWaveShaper();
  // Cast through the node's own property type: TS 5.7 parameterises typed arrays by
  // buffer kind and `WaveShaperNode.curve` demands a non-shared `ArrayBuffer`.
  limiter.curve = clipCurve(ctx) as WaveShaperNode['curve'];
  limiter.oversample = '2x';

  const master = ctx.createGain();
  master.gain.value = 0;

  input.connect(preClip).connect(limiter).connect(master).connect(destination ?? ctx.destination);
  return { input, wetIn, limiter, master };
}

/** Perceptual volume curve. A linear slider maps to a squashed gain so the useful
 * range is spread across the whole travel instead of bunched at the top. */
export function gainForVolume(volume01: number): number {
  const v = Math.max(0, Math.min(1, volume01));
  return Math.pow(v, 1.8) * MASTER_TRIM;
}

/**
 * Is the page inside a user gesture right now? See `unlock()` for the measurement
 * this exists to satisfy.
 *
 * TRANSIENT activation, not sticky: `isActive` is what decides whether a freshly
 * constructed `AudioContext` is born `running` or `suspended`, and it is exactly the
 * question being asked. `hasBeenActive` would be wrong — the page having been touched
 * at some point in the past does not make a context created from a `setTimeout`
 * callback start running.
 *
 * Returns TRUE when the API is unavailable (Safari < 16.4, any non-browser host), so
 * the fallback is precisely the behaviour that shipped before this guard existed.
 */
function hasUserActivation(): boolean {
  const ua = typeof navigator !== 'undefined'
    ? (navigator as Navigator & { userActivation?: { isActive: boolean } }).userActivation
    : undefined;
  return ua === undefined || ua.isActive === true;
}

export interface AudioEngineOptions {
  /**
   * Inject a context instead of creating one. Tests pass an `OfflineAudioContext`;
   * doing so also disables the gesture-unlock and page-visibility plumbing, since
   * neither is meaningful offline.
   */
  context?: BaseAudioContext;
  /** Where the master bus terminates. Defaults to `context.destination`. */
  destination?: AudioNode;
  maxVoices?: number;
  /** Persist volume/mute to localStorage. Off for tests. */
  persist?: boolean;
  /**
   * Build the shared reverb bus. Default true.
   *
   * Two real uses. (1) `tools/audio-probe.mjs --mode depth` renders the SAME sound
   * with it on and off, which is the only way to prove the room is contributing
   * energy rather than merely being wired up — the exact failure mode this project
   * has paid for eleven times. (2) It is the low-quality tier's off switch: the
   * convolution is the only per-sample cost in this pillar worth turning off on a
   * weak phone, and because every sound reaches it through the optional `wet` on
   * `SynthCtx`, switching it off changes nothing else and breaks nothing.
   */
  reverb?: boolean;
}

interface LiveVoice {
  node: GainNode;
  /** This voice's reverb send, if it has one. Released with the voice — see
   * `release()` for why cutting the send does NOT cut the tail. */
  wet: GainNode | null;
  /** Context time this voice is finished and can be pruned. */
  end: number;
  priority: Priority;
}

export class AudioEngine {
  private ctx: BaseAudioContext | null = null;
  private chain: MasterChain | null = null;
  private state: AudioState = 'idle';
  private failure: string | null = null;

  private volume = 0.8;
  private muted = false;

  private readonly maxVoices: number;
  private readonly persist: boolean;
  private readonly reverb: boolean;
  private readonly injected: BaseAudioContext | null;
  private readonly injectedDestination: AudioNode | null;
  /** True when running on an `OfflineAudioContext` — no gestures, no real clock. */
  private readonly offline: boolean;

  private readonly voices: LiveVoice[] = [];
  private readonly retrigger = new Map<string, { at: number; count: number }>();
  private readonly listeners = new Set<() => void>();

  /** Offline test clock. `now()` takes the max of this and `ctx.currentTime`, so it
   * is inert for a live context (stays 0) and lets a probe drive the voice budget
   * deterministically offline. */
  private virtualTime = 0;

  /** QA/debug: total voices ever started, and total rejected by the budget. */
  readonly counters = { started: 0, droppedBudget: 0, droppedThrottle: 0, droppedNotRunning: 0 };

  private analyser: AnalyserNode | null = null;
  private gestureBound = false;

  constructor(opts: AudioEngineOptions = {}) {
    this.maxVoices = opts.maxVoices ?? DEFAULT_MAX_VOICES;
    this.persist = opts.persist ?? true;
    this.reverb = opts.reverb ?? true;
    this.injected = opts.context ?? null;
    this.injectedDestination = opts.destination ?? null;
    this.offline =
      !!this.injected && typeof OfflineAudioContext !== 'undefined' && this.injected instanceof OfflineAudioContext;

    this.loadSettings();

    if (this.injected) {
      this.attachContext(this.injected);
      // An OfflineAudioContext reports `suspended` until `startRendering()`. Treat it
      // as running so the real code path (which refuses to schedule into a
      // non-running context) is exercised rather than bypassed.
      if (this.offline) this.state = 'running';
    } else {
      this.bindGestureUnlock();
      this.bindVisibility();
    }
  }

  // ── Settings — this is the surface a settings screen should call ──────────

  /** 0..1. Applied immediately and persisted. */
  setVolume(v: number): void {
    this.volume = Math.max(0, Math.min(1, Number.isFinite(v) ? v : 0));
    this.applyMasterGain(0.02);
    this.saveSettings();
    this.emit();
  }

  getVolume(): number {
    return this.volume;
  }

  setMuted(m: boolean): void {
    this.muted = !!m;
    this.applyMasterGain(0.015);
    this.saveSettings();
    this.emit();
  }

  isMuted(): boolean {
    return this.muted;
  }

  toggleMuted(): boolean {
    this.setMuted(!this.muted);
    return this.muted;
  }

  /** Subscribe to volume/mute/state changes — for a settings screen to reflect a
   * value changed from anywhere else (a hotkey, another tab). Returns an unsubscribe. */
  onChange(fn: () => void): () => void {
    this.listeners.add(fn);
    return () => this.listeners.delete(fn);
  }

  /** `idle` before the first gesture, `running` once unlocked, `failed` if Web Audio
   * is unavailable or threw. A settings screen can use this to explain why the
   * slider does nothing yet. */
  getState(): AudioState {
    return this.state;
  }

  /** Only set when `getState() === 'failed'`. */
  getFailure(): string | null {
    return this.failure;
  }

  /** Number of voices currently sounding. Exposed for the leak assertions. */
  activeVoices(): number {
    this.prune(this.now());
    return this.voices.length;
  }

  // ── Unlock ────────────────────────────────────────────────────────────────

  /**
   * Create/resume the context. Safe to call from anywhere, any number of times, and
   * safe to call outside a gesture (it just won't succeed). Called automatically by
   * the gesture listeners installed in the constructor — a settings screen only needs
   * it if it wants to preview a sound from a control that isn't a real gesture.
   *
   * ── "It just won't succeed" was FALSE, and the failure was silent ─────────────
   *
   * Called outside a gesture this used to CREATE the context anyway. It cannot be
   * resumed there, so it is born `suspended` with a frozen clock — the exact state
   * this file's header says must never happen. Measured on the shipped boot route
   * (`tools/tmp/audio_boot_probe.mjs`, and it was `opening.ts`'s 4.5 s auto-continue
   * `setTimeout` that did it, not `shell.mount()`'s `music.fadeIn()`, which cannot:
   * `ensureGraph()` bails while `engine.context` is null):
   *
   *   * at `/`, no gesture, t=7.5 s: engine `suspended`, one context, born
   *     `state="suspended"`, `currentTime` 0 -> 0 across 1.5 s of wall clock.
   *   * the cost is ONE SPECIFIC THING and it is not the pile-up the header warns
   *     about (nothing can pile up — `play()` refuses while not `running`). It is
   *     that `resume()` is ASYNCHRONOUS, so `state` is still `suspended` for the
   *     whole of the first gesture's call stack and every sound scheduled from that
   *     gesture's own handlers is dropped. A/B on the same page, same click:
   *     early context -> `play()` returns **false**, `droppedNotRunning` 0 -> 1;
   *     no context -> `new AudioContext()` inside the gesture is born
   *     `state="running"` and `play()` returns **true**.
   *
   * So the guard: outside transient user activation, RESUME an existing context but
   * never CREATE one. That makes the caller's stated assumption true rather than
   * asking eleven call sites to know this rule. `navigator.userActivation` is absent
   * on Safari < 16.4, where the fallback is exactly today's behaviour — never worse.
   */
  unlock(): void {
    if (this.state === 'failed' || this.offline) return;
    if (!this.ctx && !hasUserActivation()) return;
    const ctx = this.ensureContext();
    if (!ctx) return;
    if (typeof (ctx as AudioContext).resume === 'function' && ctx.state !== 'running') {
      // Autoplay rejection is expected and must never surface.
      void (ctx as AudioContext).resume().then(
        () => this.syncState(),
        () => this.syncState(),
      );
    }
    this.syncState();
  }

  private bindGestureUnlock(): void {
    if (this.gestureBound || typeof window === 'undefined') return;
    this.gestureBound = true;
    const events: Array<keyof WindowEventMap> = ['pointerdown', 'touchend', 'keydown', 'click'];
    const onGesture = (): void => {
      this.unlock();
      // Only stop listening once the context is genuinely running — a first gesture
      // can be rejected (e.g. a synthetic click), and giving up after one attempt is
      // how a game ends up permanently silent.
      if (this.state === 'running' || this.state === 'failed') {
        for (const type of events) window.removeEventListener(type, onGesture, true);
      }
    };
    for (const type of events) window.addEventListener(type, onGesture, true);
  }

  /** Suspend while the tab is hidden — a phone should not burn battery rendering
   * audio nobody can hear, and iOS will interrupt the context anyway. */
  private bindVisibility(): void {
    if (typeof document === 'undefined') return;
    document.addEventListener('visibilitychange', () => {
      const ctx = this.ctx as AudioContext | null;
      if (!ctx || typeof ctx.suspend !== 'function') return;
      try {
        if (document.hidden) void ctx.suspend().catch(() => {});
        else if (this.state !== 'idle') void ctx.resume().catch(() => {});
      } catch {
        /* degrade to silence */
      }
      this.syncState();
    });
  }

  private ensureContext(): BaseAudioContext | null {
    if (this.ctx) return this.ctx;
    if (this.state === 'failed') return null;
    try {
      const Ctor: typeof AudioContext | undefined =
        typeof AudioContext !== 'undefined'
          ? AudioContext
          : (globalThis as unknown as { webkitAudioContext?: typeof AudioContext }).webkitAudioContext;
      if (!Ctor) {
        this.fail('Web Audio API unavailable');
        return null;
      }
      // `latencyHint: 'interactive'` asks for the smallest buffer the device will
      // give us. This is a brawler; a 40 ms hit confirmation is worse than a 40 ms
      // frame.
      const ctx = new Ctor({ latencyHint: 'interactive' });
      this.attachContext(ctx);
      return ctx;
    } catch (err) {
      this.fail(String(err));
      return null;
    }
  }

  private attachContext(ctx: BaseAudioContext): void {
    this.ctx = ctx;
    try {
      this.chain = buildMasterChain(ctx, this.injectedDestination ?? undefined, this.reverb);
      this.applyMasterGain(0);
      this.syncState();
    } catch (err) {
      this.fail(String(err));
    }
  }

  private syncState(): void {
    if (this.state === 'failed') return;
    const prev = this.state;
    if (!this.ctx) this.state = 'idle';
    else if (this.offline) this.state = 'running';
    else this.state = this.ctx.state === 'running' ? 'running' : 'suspended';
    if (prev !== this.state) this.emit();
  }

  private fail(reason: string): void {
    this.state = 'failed';
    this.failure = reason;
    // One line, once. An audio failure is worth knowing about and worth never
    // spamming a 60 fps loop with.
    console.warn('[audio] disabled:', reason);
    this.emit();
  }

  // ── Playback ──────────────────────────────────────────────────────────────

  /**
   * Schedule one sound. Returns true if it was scheduled, false if it was refused
   * (locked, muted-and-skipped, over budget, throttled, or failed).
   *
   * Never throws. `match.ts` calls into this from the render loop.
   */
  play(sound: SoundFn, opts: PlayOptions = {}): boolean {
    try {
      return this.playInner(sound, opts);
    } catch (err) {
      // A single malformed sound must not take the audio system — or the frame —
      // with it. Report once and keep going.
      if (!this.failure) {
        this.failure = String(err);
        console.warn('[audio] sound failed:', err);
      }
      return false;
    }
  }

  private playInner(sound: SoundFn, opts: PlayOptions): boolean {
    if (this.state === 'failed') return false;
    if (this.state !== 'running' || !this.ctx || !this.chain) {
      this.counters.droppedNotRunning++;
      return false;
    }

    const now = this.now();
    this.prune(now);

    const priority = opts.priority ?? Priority.Normal;

    // ── Retrigger throttle ────────────────────────────────────────────────
    // Rapid repeats of the same sound duck and detune progressively, then stop.
    let throttleGain = 1;
    let detune = 1;
    if (opts.key) {
      const rec = this.retrigger.get(opts.key);
      const count = rec && now - rec.at < RETRIGGER_WINDOW ? rec.count + 1 : 0;
      this.retrigger.set(opts.key, { at: now, count });
      if (count >= RETRIGGER_GAINS.length) {
        this.counters.droppedThrottle++;
        return false;
      }
      throttleGain = RETRIGGER_GAINS[count];
      // A slight upward detune per repeat is what makes a burst of pellets read as
      // a textured spray rather than one sound stuttering.
      detune = 1 + count * 0.045;
    }

    // ── Voice budget ──────────────────────────────────────────────────────
    if (this.voices.length >= this.maxVoices) {
      if (priority < Priority.Critical && !this.steal(priority)) {
        this.counters.droppedBudget++;
        return false;
      }
      // Critical sounds always get in: steal the oldest low-priority voice, or the
      // oldest voice outright if everything present is critical too.
      if (priority >= Priority.Critical && this.voices.length >= this.maxVoices) this.steal(Priority.Critical);
    }

    const ctx = this.ctx;
    const when = Math.max(now, ctx.currentTime) + LOOKAHEAD + (opts.delay ?? 0);

    // Per-voice bus: gain → (optional pan) → master input.
    const level = Math.max(0, (opts.gain ?? 1) * throttleGain);
    const voiceGain = ctx.createGain();
    voiceGain.gain.value = level;

    const panWanted = opts.pan !== undefined && typeof ctx.createStereoPanner === 'function';
    const panAt = Math.max(-1, Math.min(1, opts.pan ?? 0));

    let tail: AudioNode = voiceGain;
    if (panWanted) {
      const panner = ctx.createStereoPanner();
      panner.pan.value = panAt;
      voiceGain.connect(panner);
      tail = panner;
    }
    tail.connect(this.chain.input);

    // The voice's reverb SEND mirrors the dry path: same level, same pan.
    //
    // Same LEVEL so distance attenuation and the retrigger duck reach the room too —
    // otherwise a far-off hit would arrive quiet and drenched, which reads as louder,
    // not further. Same PAN so the room stays on the same side as the event; an
    // unpanned send would drag every sound back toward centre and quietly weaken the
    // spatialisation the director works to produce (`--mode negative` asserts a 2.5x
    // channel ratio, and it is measured downstream of this).
    let voiceWet: GainNode | null = null;
    if (this.chain.wetIn) {
      voiceWet = ctx.createGain();
      voiceWet.gain.value = level;
      if (panWanted) {
        const wetPan = ctx.createStereoPanner();
        wetPan.pan.value = panAt;
        voiceWet.connect(wetPan).connect(this.chain.wetIn);
      } else {
        voiceWet.connect(this.chain.wetIn);
      }
    }

    const rng: Rng = makeRng(opts.seed ?? ((Math.random() * 0xffffffff) | 0));
    const synth: SynthCtx = { ctx, dest: voiceGain, wet: voiceWet ?? undefined, when, rng };

    let duration = 0;
    try {
      duration = sound(synth) || 0;
    } catch (err) {
      voiceGain.disconnect();
      voiceWet?.disconnect();
      throw err;
    }
    // Detuning a whole voice after the fact isn't possible without re-authoring
    // every node, so the throttle's detune rides on playback duration instead —
    // a repeat that is slightly shorter reads as slightly tighter, which is the
    // same perceptual job.
    const end = when + duration / detune + 0.05;

    this.voices.push({ node: voiceGain, wet: voiceWet, end, priority });
    this.counters.started++;

    if (!this.offline) {
      // Real cleanup timer. `prune()` is the authority; this just guarantees the
      // graph is torn down even if nothing calls `play()` again.
      const ms = Math.max(30, (end - ctx.currentTime) * 1000 + 40);
      setTimeout(() => this.prune(this.now()), ms);
    }
    return true;
  }

  /** Drop the oldest voice strictly below `priority`. Returns true if one went. */
  private steal(priority: Priority): boolean {
    let idx = -1;
    for (let i = 0; i < this.voices.length; i++) {
      if (this.voices[i].priority < priority) {
        idx = i;
        break;
      }
    }
    if (idx < 0) return false;
    const [v] = this.voices.splice(idx, 1);
    this.release(v);
    return true;
  }

  private prune(now: number): void {
    for (let i = this.voices.length - 1; i >= 0; i--) {
      if (this.voices[i].end <= now) {
        const [v] = this.voices.splice(i, 1);
        this.release(v);
      }
    }
    // The throttle map is keyed by sound name, so it is bounded by the number of
    // distinct sounds — but clear stale entries anyway so a long match doesn't hold
    // a growing map of dead keys.
    if (this.retrigger.size > 64) {
      for (const [k, rec] of this.retrigger) if (now - rec.at > 1) this.retrigger.delete(k);
    }
  }

  /**
   * Tear a voice down: silence, then disconnect, both dry and wet.
   *
   * Cutting the wet SEND does not cut the reverb TAIL — the convolver has already
   * consumed those samples and rings out on the shared bus for the remaining ~190 ms
   * of the impulse response. That is deliberate and is what lets a sound have a room
   * around it without paying one of the twenty voice slots to hear it: the voice's
   * declared duration covers the sound, and the room outlives it for free. It also
   * means a STOLEN voice still decays into the room instead of stopping dead, which
   * is the difference between a stolen voice being unnoticeable and being a click.
   */
  private release(v: LiveVoice): void {
    try {
      // Silence first, then disconnect — a voice stolen mid-sound must not click.
      v.node.gain.cancelScheduledValues(0);
      v.node.gain.value = 0;
      v.node.disconnect();
    } catch {
      /* already gone */
    }
    if (!v.wet) return;
    try {
      v.wet.gain.cancelScheduledValues(0);
      v.wet.gain.value = 0;
      v.wet.disconnect();
    } catch {
      /* already gone */
    }
  }

  private now(): number {
    if (!this.ctx) return this.virtualTime;
    return Math.max(this.ctx.currentTime, this.virtualTime);
  }

  /** Offline/testing only: advance the engine's notion of "now" so the voice budget
   * and the retrigger throttle can be exercised deterministically without a clock. */
  setVirtualTime(seconds: number): void {
    this.virtualTime = seconds;
    this.prune(seconds);
  }

  // ── QA hooks ──────────────────────────────────────────────────────────────

  /**
   * Insert an `AnalyserNode` as a BRANCH off the master output (post-volume,
   * post-mute) and return it. The tap is a dead end — nothing is routed through it —
   * so it cannot alter what the player hears.
   *
   * This is the instrument that answers the question this project keeps getting
   * wrong: not "did the code path run" but "did a waveform come out". A probe reads
   * `getFloatTimeDomainData` every frame of a real match and measures RMS.
   */
  tap(): AnalyserNode | null {
    if (!this.ctx || !this.chain) return null;
    if (this.analyser) return this.analyser;
    try {
      const an = this.ctx.createAnalyser();
      an.fftSize = 2048;
      an.smoothingTimeConstant = 0;
      this.chain.master.connect(an);
      this.analyser = an;
      return an;
    } catch {
      return null;
    }
  }

  /**
   * QA-only: branch the master output (post-volume, post-mute) into any node.
   *
   * `tap()` polls, which means it can only see what happens to be sounding on the
   * frame it is read — and under a software renderer at 9 fps that missed four of
   * five countdown blips and reported the game as nearly silent. A
   * `ScriptProcessorNode` connected here instead receives EVERY sample block, so a
   * probe can measure continuously and count discrete sound events rather than
   * sampling and hoping.
   */
  connectTap(node: AudioNode): boolean {
    if (!this.ctx || !this.chain) return false;
    try {
      this.chain.master.connect(node);
      return true;
    } catch {
      return false;
    }
  }

  /** The live context, or null before unlock. For probes only. */
  get context(): BaseAudioContext | null {
    return this.ctx;
  }

  /**
   * The bus input node, or null before unlock.
   *
   * Exposed so MUSIC can join the same chain as every synthesised voice — it feeds
   * `input`, which means it passes the identical soft-clip limiter and the identical
   * master gain. Global mute therefore silences music provably, without `music.ts`
   * knowing anything about how mute is implemented. Music carries its own level in a
   * gain node BEFORE this point, so "music quieter than effects" stays expressible.
   */
  get busInput(): GainNode | null {
    return this.chain?.input ?? null;
  }

  // ── Internals ─────────────────────────────────────────────────────────────

  private applyMasterGain(rampSeconds: number): void {
    if (!this.chain || !this.ctx) return;
    const target = this.muted ? 0 : gainForVolume(this.volume);
    const param = this.chain.master.gain;
    try {
      if (rampSeconds > 0 && !this.offline) {
        const t = this.ctx.currentTime;
        param.cancelScheduledValues(t);
        param.setValueAtTime(param.value, t);
        param.linearRampToValueAtTime(target, t + rampSeconds);
      } else {
        param.cancelScheduledValues(0);
        param.value = target;
      }
    } catch {
      param.value = target;
    }
  }

  private loadSettings(): void {
    if (!this.persist || typeof localStorage === 'undefined') return;
    try {
      const v = localStorage.getItem(LS_VOLUME);
      if (v !== null) {
        const n = Number(v);
        if (Number.isFinite(n)) this.volume = Math.max(0, Math.min(1, n));
      }
      this.muted = localStorage.getItem(LS_MUTED) === '1';
    } catch {
      /* private mode / disabled storage — defaults stand */
    }
  }

  private saveSettings(): void {
    if (!this.persist || typeof localStorage === 'undefined') return;
    try {
      localStorage.setItem(LS_VOLUME, String(this.volume));
      localStorage.setItem(LS_MUTED, this.muted ? '1' : '0');
    } catch {
      /* ignore */
    }
  }

  private emit(): void {
    for (const fn of this.listeners) {
      try {
        fn();
      } catch {
        /* a listener must not break the engine */
      }
    }
  }
}
