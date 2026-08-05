/**
 * Music playback — Uri's theme, "Bounce and Bash".
 *
 * This is the ONE asset in the audio pillar. Everything in `sounds.ts` and
 * `weapons/` is synthesised at play time from oscillators; music is the exception,
 * because you cannot synthesise a composed track.
 *
 * ## Why a `<audio>` element and not `decodeAudioData`
 *
 * The rest of the engine works with `AudioBuffer`s, so the obvious move is
 * `fetch` → `decodeAudioData` → `AudioBufferSourceNode`. **Do not.** Decoding
 * expands MP3 to raw float32 PCM in memory, and this track is ~8.6 minutes of
 * 48 kHz stereo:
 *
 *     516 s × 48000 Hz × 2 ch × 4 bytes = ~198 MB resident
 *
 * That is unacceptable anywhere and fatal on the mobile devices this project
 * targets — for a 4 MB file. `HTMLAudioElement` + `createMediaElementSource()`
 * streams instead: the browser decodes a small rolling window, memory stays flat,
 * and playback can start before the file has finished downloading. The cost is that
 * the node is not a `BaseAudioContext`-only object, so music is skipped entirely in
 * `OfflineAudioContext` renders — which is correct, since the probe measures
 * synthesis and a streamed element cannot be rendered offline anyway.
 *
 * ## Routing
 *
 * `element → MediaElementSource → musicGain → engine bus input`
 *
 * Going through the engine's own bus input means music passes the same soft-clip
 * limiter and the same master gain as everything else, so **global mute silences
 * music too, provably**, without this file knowing anything about how mute works.
 * `musicGain` sits before that and carries music's OWN level, because "music
 * quieter than effects" is the single most common audio preference and folding the
 * two together would make it unexpressible.
 *
 * ## Gesture unlock
 *
 * Browsers block audio until a user gesture, and that applies to media elements as
 * well as to `AudioContext`. `play()` returns a promise that REJECTS on an autoplay
 * block; that rejection is caught and the intent is remembered, so the next unlock
 * starts the music rather than losing it. Nothing here throws into the render loop.
 */

// Imported from the package index rather than from `engine.ts` because the singleton
// lives there. This is a cycle (index -> music -> index), but a safe one: every use is
// inside a method, so it resolves at call time, long after both modules have evaluated.
import { getAudioEngine } from './index';

/**
 * ── THE DEPLOY BASE. Read this before touching the line below. ───────────────
 *
 * 🚨 This was **`'/audio/bounce-and-bash.mp3'`**, a hand-written absolute literal, and
 * it made **every menu on the deployed build silent** for as long as the theme has
 * existed. Uri found it by playing it: *"i can't hear on menus."*
 *
 * The theme is served from `public/`, so it never goes through the JS bundle — which is
 * exactly why it broke. **Vite rewrites the asset URLs it RESOLVES at build time**
 * (module imports, and `/x` inside HTML and CSS). **It does not rewrite string literals
 * inside TypeScript**, because it has no way to know one is a URL. So under
 * `DEPLOY_BASE=/food-arena/` (`vite.config.ts`) every other asset shipped correctly as
 * `/food-arena/assets/…` and this one shipped as `/audio/…` — which on GitHub Pages,
 * where a project site is served from `/<repo>/` and the apex holds nothing, is a
 * **404 on every load, forever**. Measured on the live deployed bundle:
 *
 *     grep dep-main.js → "/audio/bounce-and-bash.mp3"     (every other asset: /food-arena/…)
 *     GET https://uri-onceuponyou.github.io/audio/bounce-and-bash.mp3   → 404
 *     GET https://uri-onceuponyou.github.io/food-arena/audio/…mp3       → 200, 4133040 bytes
 *
 * The file was deployed the whole time. Only the request was wrong.
 *
 * **And the failure was structurally invisible.** `play()` rejects, and the `catch` two
 * screens down exists on purpose — an autoplay refusal must never throw into the render
 * loop. That same `catch` swallowed "this file does not exist". The element reports
 * `readyState 0`, `networkState 3`, `error.code 4`, and **`paused === false`**, so
 * everything in this file believed the theme was playing. `isPlaying()` returned `true`
 * against a bus carrying **exactly 0.000000 RMS**.
 *
 * `import.meta.env.BASE_URL` is Vite's own value for the base — `'/'` in dev, in every
 * snapshot, in `playtest.mjs` and in every probe under `tools/`, and `'/food-arena/'` in
 * the Pages build. So the local number does not move by a byte and the deploy is fixed.
 * The `?? '/'` fallback is not decoration: this module is also loaded by harnesses that
 * do not go through Vite's define pass.
 *
 * ⚠️ **If you ever add a second asset here, do NOT type its path.** Either build it off
 * `BASE_URL` like this one, or `import` it so Vite resolves it. `tools/tmp/aud_menu_silence.mjs
 * --selftest` builds the tree at BOTH bases from one frozen source and measures real
 * samples at each; it is the only gate in this repo that can see this class of bug, and
 * it was written because 389 offline assertions structurally cannot.
 */
const BASE_URL: string = (import.meta as ImportMeta & { env?: { BASE_URL?: string } }).env?.BASE_URL ?? '/';
const TRACK_URL = `${BASE_URL.endsWith('/') ? BASE_URL : `${BASE_URL}/`}audio/bounce-and-bash.mp3`;

/** Music's own level, below effects by default — a theme should sit under gameplay. */
const DEFAULT_MUSIC_VOLUME = 0.45;

const STORAGE_KEY = 'fa.audio.music';

interface MusicState {
  volume: number;
  enabled: boolean;
}

function loadState(): MusicState {
  try {
    const raw = localStorage.getItem(STORAGE_KEY);
    if (raw) {
      const p = JSON.parse(raw) as Partial<MusicState>;
      return {
        volume: typeof p.volume === 'number' ? Math.min(1, Math.max(0, p.volume)) : DEFAULT_MUSIC_VOLUME,
        enabled: p.enabled !== false,
      };
    }
  } catch {
    /* private mode / quota — fall through to defaults */
  }
  return { volume: DEFAULT_MUSIC_VOLUME, enabled: true };
}

function saveState(s: MusicState): void {
  try {
    localStorage.setItem(STORAGE_KEY, JSON.stringify(s));
  } catch {
    /* never let a storage failure break playback */
  }
}

class MusicPlayer {
  private el: HTMLAudioElement | null = null;
  private source: MediaElementAudioSourceNode | null = null;
  private gain: GainNode | null = null;
  private state: MusicState = loadState();
  /** Set when play() was asked for but blocked; retried on the next unlock. */
  private wanted = false;
  private listeners = new Set<() => void>();
  /** Invalidates a pending fade-out pause when a fade-in overtakes it. */
  private fadeToken = 0;
  /**
   * Why the track is not playing, when the reason is the FILE and not the policy.
   *
   * The whole reason the base bug survived to a player was that this failure had no
   * surface anywhere. `play()`'s rejection is caught deliberately (an autoplay refusal
   * must not throw into the render loop) and that catch cannot distinguish "the browser
   * said not yet" from "the file 404s" — the first is normal on every cold load, the
   * second is fatal and permanent. So the element's own `error` event is captured here
   * instead, where the two are trivially distinguishable, and it is surfaced three ways:
   * `getLoadError()`, one `console.warn`, and a `onChange` emit so a settings screen can
   * say something truer than a mute toggle that appears to work.
   */
  private loadError: string | null = null;
  /**
   * ── MUSIC DURING MATCHES: OFF. Uri, §17. ────────────────────────────────────
   *
   * `true` between `fadeOut()` and the next `fadeIn()`. `ui/screens/shell.ts` mount()
   * calls **exactly one of the two on every route transition** — `fadeOut()` for a match,
   * `fadeIn()` for everything else — so this flag is re-synced to the route on every
   * navigation and cannot drift.
   *
   * 🚨 **Without it, a fight that is DEEP-LINKED or RELOADED into plays the theme over
   * the top of itself.** Measured, not reasoned — `tools/tmp/aud_menu_silence.mjs`'s
   * MATCH cell caught it on `?screen=match`: `playing=true`, `currentTime=5.53 s`,
   * theme audible on the bus for the whole fight.
   *
   * The mechanism is an ordering one and it is invisible from any single file:
   *
   *   1. `shell.mount('match')` calls `fadeOut()` at t=0. There is no gesture yet, so
   *      there is no context, no element and nothing to fade — `fadeOut()` returned on
   *      its first line and the request was simply LOST.
   *   2. `main.ts:89` then calls `play()` unconditionally, one line after `navigate()`,
   *      which sets `wanted = true`. It is written to be refused, and it is.
   *   3. The player's first tap unlocks the engine, `onUnlock()` honours `wanted`, and
   *      the theme starts — inside a match, with the one call that would have stopped it
   *      already spent.
   *
   * Ordering alone made it look correct on the normal path (menu → match), where the
   * element exists and `fadeOut()` really does pause it. So this is scoped state rather
   * than a `wanted` tweak: `fadeOut()` means "the theme must not be audible until
   * `fadeIn()`", and that has to hold for a `play()` that has not happened yet.
   *
   * ⚠️ This became reachable when `171c2d2` made the URL name the screen. Before it,
   * every load started at the title card and a reload could not land in a fight.
   */
  private suppressed = false;

  /** Build the element + graph once. Safe to call repeatedly. */
  private ensureGraph(): boolean {
    if (typeof document === 'undefined') return false;
    const engine = getAudioEngine();
    const ctx = engine.context;
    const busInput = engine.busInput;
    // No context yet (pre-unlock), or an offline render: nothing to attach to.
    if (!ctx || !busInput || typeof (ctx as AudioContext).createMediaElementSource !== 'function') return false;
    if (this.source) return true;

    if (!this.el) {
      // Deliberately NEVER appended to the DOM. `createMediaElementSource` works on a
      // detached element, and keeping it out of the document means no stray default
      // controls, no layout participation, and nothing for a CSS change to disturb.
      // Consequence worth knowing when debugging: `document.querySelectorAll('audio')`
      // finds NOTHING even while the theme is playing. Verify through the audio graph
      // (`window.__audio.connectTap`) instead — a differential measurement with music
      // enabled vs disabled is the reliable check, and reads 0.0222 RMS vs exactly 0.
      const el = document.createElement('audio');
      el.src = TRACK_URL;
      el.loop = true;
      el.preload = 'auto';
      // Element volume stays at 1: level is controlled by `gain`, inside the graph,
      // so it rides the same ramps and the same master mute as everything else.
      el.volume = 1;
      el.crossOrigin = 'anonymous';
      // A missing/undecodable track is otherwise INVISIBLE — see `loadError`. Note the
      // element also leaves `paused === false` in this state, so nothing downstream can
      // infer the failure from playback flags either.
      el.addEventListener('error', () => {
        const code = el.error ? el.error.code : 0;
        this.loadError = `music track failed to load (MediaError ${code}) from ${el.currentSrc || el.src}`;
        // Once, not per retry: this fires again on every play() attempt.
        console.warn(`[audio] ${this.loadError}`);
        this.emit();
      }, { once: true });
      this.el = el;
    }

    try {
      this.source = (ctx as AudioContext).createMediaElementSource(this.el);
      this.gain = ctx.createGain();
      this.gain.gain.value = this.state.enabled ? this.state.volume : 0;
      this.source.connect(this.gain).connect(busInput);
      return true;
    } catch {
      // createMediaElementSource throws if the element is already attached to
      // another context. Degrade to silence rather than taking the game down.
      this.source = null;
      this.gain = null;
      return false;
    }
  }

  /** Start (or resume) the theme. Idempotent. Never throws. */
  play(): void {
    // Intent is recorded FIRST and unconditionally, so a `play()` that arrives during a
    // match is honoured on the way back out rather than lost. Only the *sounding* is
    // suppressed — see `suppressed`, and `main.ts:89`, which is exactly such a call.
    this.wanted = true;
    if (this.suppressed) return;
    if (!this.state.enabled) return;
    if (!this.ensureGraph() || !this.el) return;
    const p = this.el.play();
    if (p && typeof p.catch === 'function') {
      // Autoplay blocked — keep `wanted` set so the next unlock picks it up.
      p.catch(() => undefined);
    }
  }

  pause(): void {
    this.wanted = false;
    this.el?.pause();
  }

  /** Called by the engine after a successful unlock, to honour a blocked play(). */
  onUnlock(): void {
    if (this.wanted) this.play();
  }

  isPlaying(): boolean {
    return !!this.el && !this.el.paused;
  }

  /**
   * `null` when healthy; a description when the track itself could not be loaded.
   *
   * ⚠️ This is NOT the inverse of `isPlaying()`, and conflating them is the bug.
   * `isPlaying()` reports the element's *intent* and returned `true` throughout the
   * 404 — a media element that cannot fetch its source still reports `paused === false`
   * once `play()` has been called. Only this says whether a sound can exist.
   */
  getLoadError(): string | null {
    return this.loadError;
  }

  /** The URL actually requested, so a probe can assert the base without guessing it. */
  getTrackUrl(): string {
    return this.el ? this.el.src : TRACK_URL;
  }

  getVolume(): number {
    return this.state.volume;
  }

  setVolume(v: number): void {
    this.state.volume = Math.min(1, Math.max(0, v));
    saveState(this.state);
    this.applyGain();
    this.emit();
  }

  isEnabled(): boolean {
    return this.state.enabled;
  }

  setEnabled(on: boolean): void {
    this.state.enabled = on;
    saveState(this.state);
    this.applyGain();
    if (on) this.play();
    else this.el?.pause();
    this.emit();
  }

  /**
   * Fade the theme out and pause it — for entering a match.
   *
   * A hard `pause()` on a track that is mid-phrase is audible as a click and reads as
   * a bug. This ramps the gain down first and only pauses once silent, so the handoff
   * from menu music to combat is clean. Playback intent is NOT cleared, so `fadeIn()`
   * on the way back to the menus resumes rather than restarting the track.
   */
  fadeOut(seconds = 0.6): void {
    // BEFORE the early return, and that is the whole fix. On a deep-linked or reloaded
    // match this call arrives with no context and no element, so everything below it is
    // skipped — but the *instruction* ("no theme until fadeIn") still has to be recorded,
    // or the first gesture starts music over a fight. See `suppressed`.
    this.suppressed = true;
    if (!this.el || this.el.paused) return;
    this.applyGain(0, seconds);
    const el = this.el;
    window.setTimeout(() => {
      // Only pause if nothing asked us to come back in the meantime.
      if (this.fadeToken === token) el.pause();
    }, seconds * 1000 + 40);
    const token = ++this.fadeToken;
  }

  /**
   * Resume and fade back to the set level — for returning to the menus.
   *
   * ── Why this checks `paused` first ──────────────────────────────────────────
   *
   * `ui/screens/shell.ts` calls this from `mount()` for EVERY route that is not a
   * match, which includes every menu-to-menu navigation — home to character select,
   * character select to trophy road, and so on. On those the theme is already playing
   * at full level and there is nothing to fade in.
   *
   * The first version dropped the gain to zero unconditionally and ramped back over
   * 0.8 s, so every menu tap ducked the music. Measured on the real bus with a
   * `ScriptProcessorNode`: the level sat **below half of steady for 379 ms** after each
   * navigation, and 8 of 168 blocks across four navigations through the real router
   * were below half. Not a click — the largest sample-to-sample step during the drop
   * was 2.6e-2 against the music's own 5.1e-2, so it is inaudible as a tick — but an
   * audible duck on every button press, and one that arrived four times as often per
   * hour when `MATCH_DURATION_MS` went 180 s -> 45 s.
   *
   * A track that is already rolling therefore just ramps to level from wherever it is.
   * That also improves the interrupted case (back out of a match before the fade-out
   * finishes): it recovers from the level the fade reached instead of restarting the
   * fade from silence.
   */
  fadeIn(seconds = 0.8): void {
    this.fadeToken++;
    // The match is over (or was never entered). Lift the scoped suppression first, so a
    // `play()` intent recorded while it was on can now be honoured.
    this.suppressed = false;
    if (!this.state.enabled) return;
    if (!this.ensureGraph() || !this.el) return;
    // Captured BEFORE play(): `play()` clears `paused` synchronously, long before its
    // promise settles, so reading it afterwards always says "was already playing".
    const wasPaused = this.el.paused;
    if (wasPaused) {
      if (this.gain) this.gain.gain.value = 0;
      const p = this.el.play();
      if (p && typeof p.catch === 'function') p.catch(() => undefined);
    }
    // A real resume gets the full fade; a track that never stopped gets a short ramp,
    // which is a no-op when it is already at level and a quick recovery when a
    // fade-out was in flight.
    this.applyGain(undefined, wasPaused ? seconds : 0.25);
  }

  /** Duck to a fraction of the set level — for a match, a pause sheet, a cutscene. */
  duck(factor = 0.35): void {
    this.applyGain(this.state.volume * Math.min(1, Math.max(0, factor)));
  }

  unduck(): void {
    this.applyGain();
  }

  onChange(fn: () => void): () => void {
    this.listeners.add(fn);
    return () => this.listeners.delete(fn);
  }

  private applyGain(explicit?: number, rampSeconds = 0.08): void {
    if (!this.gain) return;
    const engine = getAudioEngine();
    const ctx = engine.context;
    const target = this.state.enabled ? (explicit ?? this.state.volume) : 0;
    try {
      if (ctx) {
        const t = ctx.currentTime;
        this.gain.gain.cancelScheduledValues(t);
        this.gain.gain.setValueAtTime(this.gain.gain.value, t);
        // Short ramp so a slider drag never clicks — same discipline as master.
        this.gain.gain.linearRampToValueAtTime(target, t + rampSeconds);
      } else {
        this.gain.gain.value = target;
      }
    } catch {
      this.gain.gain.value = target;
    }
  }

  private emit(): void {
    for (const fn of this.listeners) {
      try {
        fn();
      } catch {
        /* a bad listener must not break playback */
      }
    }
  }
}

let player: MusicPlayer | null = null;

export function getMusic(): MusicPlayer {
  if (!player) {
    player = new MusicPlayer();
    // Retry a blocked play() once the engine actually reaches `running`. The engine's
    // own gesture listeners keep trying until they succeed (a synthetic click can be
    // rejected), so hooking the state change rather than the gesture is what makes
    // "press play before touching the page" behave as the player expects instead of
    // silently doing nothing forever.
    const p = player;
    getAudioEngine().onChange(() => {
      if (getAudioEngine().getState() === 'running') p.onUnlock();
    });
  }
  return player;
}

export type { MusicPlayer };
