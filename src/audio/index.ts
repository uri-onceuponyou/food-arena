/**
 * Public surface of the audio pillar.
 *
 * ── What a caller outside `src/audio/` needs to know ────────────────────────────
 *
 * * `audio` — the process-wide settings/lifecycle handle. This is what a settings
 *   screen calls. Volume and mute are persisted and are applied before the first
 *   node exists, so a muted player never hears a frame.
 * * `createMatchAudio()` — one per `GameSession`. Feed it the same `GameEvent[]`
 *   `stepMatch()` already returns (see `game/match.ts`).
 *
 * There is exactly ONE `AudioContext` for the page, created lazily on the first user
 * gesture and shared by every match. Browsers cap contexts per page (six in Chrome)
 * and creating one per match would exhaust that within a session; more importantly a
 * context is expensive to spin up and there is no reason to.
 *
 * ── Autoplay ────────────────────────────────────────────────────────────────────
 * Nothing here ever throws on the autoplay policy. Before the first gesture the
 * engine has no context and `play()` is a counted no-op; the gesture listeners
 * installed by the engine's constructor (`pointerdown`/`touchend`/`keydown`/`click`,
 * capture phase, on `window`) create and resume it. The menu shell guarantees a real
 * gesture before any match starts, and a URL that boots straight into a match simply
 * stays silent until the player touches something — which they must do to play.
 */

import { AudioEngine, type AudioState } from './engine';
import { MatchAudio, type MatchAudioOptions } from './director';
import { uiClick } from './sounds';
import { getMusic } from './music';

let engineInstance: AudioEngine | null = null;

/** The one engine. Created on first use; safe to call before any gesture. */
export function getAudioEngine(): AudioEngine {
  if (!engineInstance) {
    engineInstance = new AudioEngine();
    publishQaHandle(engineInstance);
  }
  return engineInstance;
}

/** One director per match. See `game/match.ts` for the (three-line) wiring. */
export function createMatchAudio(opts?: MatchAudioOptions): MatchAudio {
  return new MatchAudio(getAudioEngine(), opts);
}

/**
 * ── THE SETTINGS-SCREEN API ─────────────────────────────────────────────────────
 *
 * There is no settings screen yet. When one is built (`src/ui/screens/`), these are
 * the only calls it needs — it must not reach for `AudioContext` itself:
 *
 * ```ts
 * import { audio } from '../../audio';
 *
 * slider.value = String(audio.getVolume());        // 0..1, already restored
 * muteToggle.checked = audio.isMuted();
 *
 * slider.oninput  = () => { audio.setVolume(Number(slider.value)); audio.previewClick(); };
 * muteToggle.onchange = () => audio.setMuted(muteToggle.checked);
 *
 * // Reflect changes made anywhere else (a hotkey, another tab, the engine
 * // unlocking). Returns an unsubscribe — call it from the screen's dispose().
 * const off = audio.onChange(() => { … re-read getVolume()/isMuted()/getState() … });
 * ```
 *
 * `getState()` is worth surfacing: it is `'idle'` until the first gesture unlocks the
 * context, `'running'` after, and `'failed'` if Web Audio is unavailable. A slider
 * that does nothing because the page has not been touched yet is a support ticket; a
 * slider that says so is not.
 *
 * `previewClick()` exists because a volume control with no audible feedback is a
 * control you cannot actually set. Call it on `input`, not on every animation frame.
 */
export const audio = {
  /** 0..1. Persisted. Applied with a short ramp so it never clicks. */
  setVolume(v: number): void {
    getAudioEngine().setVolume(v);
  },
  getVolume(): number {
    return getAudioEngine().getVolume();
  },
  setMuted(m: boolean): void {
    getAudioEngine().setMuted(m);
  },
  isMuted(): boolean {
    return getAudioEngine().isMuted();
  },
  /** Returns the new state. */
  toggleMuted(): boolean {
    return getAudioEngine().toggleMuted();
  },
  /** Subscribe to volume/mute/engine-state changes. Returns an unsubscribe. */
  onChange(fn: () => void): () => void {
    return getAudioEngine().onChange(fn);
  },
  getState(): AudioState {
    return getAudioEngine().getState();
  },
  /** Force an unlock attempt. The engine already does this on the first gesture;
   * a settings screen only needs it if it wants sound from a non-gesture control. */
  unlock(): void {
    getAudioEngine().unlock();
  },
  /** Audible feedback while dragging a volume slider. */
  previewClick(): void {
    getAudioEngine().play(uiClick(), { key: 'ui' });
  },

  /**
   * The theme, "Bounce and Bash" — the one real asset in this pillar.
   *
   * Separate from `setVolume`/`setMuted` on purpose: music has its OWN level
   * (people routinely want music under effects) but routes through the same bus,
   * so the global mute above silences it too. A settings screen wants both.
   *
   * `play()` before a user gesture is safe — the browser blocks it, the rejection
   * is swallowed, and the intent is retried on unlock.
   */
  music: {
    play(): void {
      getMusic().play();
    },
    pause(): void {
      getMusic().pause();
    },
    isPlaying(): boolean {
      return getMusic().isPlaying();
    },
    getVolume(): number {
      return getMusic().getVolume();
    },
    setVolume(v: number): void {
      getMusic().setVolume(v);
    },
    isEnabled(): boolean {
      return getMusic().isEnabled();
    },
    setEnabled(on: boolean): void {
      getMusic().setEnabled(on);
    },
    /** Fade out and pause — the menus-to-match handoff. Resumes with fadeIn(). */
    fadeOut(seconds?: number): void {
      getMusic().fadeOut(seconds);
    },
    /** Resume from where it stopped and fade back up. */
    fadeIn(seconds?: number): void {
      getMusic().fadeIn(seconds);
    },
    /** Pull the theme down under a match without stopping it. */
    duck(factor?: number): void {
      getMusic().duck(factor);
    },
    unduck(): void {
      getMusic().unduck();
    },
    onChange(fn: () => void): () => void {
      return getMusic().onChange(fn);
    },
    /**
     * `null` when healthy; a string when the TRACK ITSELF could not be loaded.
     *
     * Worth a settings screen's attention, and worth more than it looks. A 404 on the
     * theme is indistinguishable from an autoplay block everywhere else in this API:
     * `isPlaying()` returns `true`, `isEnabled()` returns `true`, `getState()` returns
     * `'running'`, and the bus carries exactly 0.000000 RMS. That combination shipped —
     * every menu on the deployed build was silent because the track URL was written as
     * an absolute literal and lost the deploy base (see `music.ts`). This is the only
     * call that can tell you so.
     */
    getLoadError(): string | null {
      return getMusic().getLoadError();
    },
    /** The URL actually requested. Base-dependent — see the warning in `music.ts`. */
    getTrackUrl(): string {
      return getMusic().getTrackUrl();
    },
  },
};

declare global {
  interface Window {
    /**
     * QA-only handle, mirroring `__vfxQaCounts` / `__stage`. Never read by game
     * logic. Exists because audio cannot be screenshotted: `tools/audio-probe.mjs`
     * taps the master bus through this and measures real sample data from a real
     * match, which is the only way to tell a working sound from a code path that ran
     * and produced silence.
     */
    __audio?: {
      engine: AudioEngine;
      /** Insert (once) and return an `AnalyserNode` branched off the master output,
       * post-volume and post-mute. */
      tap(): AnalyserNode | null;
      /** Branch the master output into any node — used with a `ScriptProcessorNode`
       * for gapless capture, since polling an analyser from rAF misses short sounds
       * entirely on a slow frame rate. */
      connectTap(node: AudioNode): boolean;
      /** Voices started/dropped since boot, plus the live voice count and state. */
      stats(): {
        state: AudioState;
        activeVoices: number;
        started: number;
        droppedBudget: number;
        droppedThrottle: number;
        droppedNotRunning: number;
        volume: number;
        muted: boolean;
      };
      /**
       * The theme's real state, for a probe that cannot see it any other way.
       *
       * The element is deliberately never appended to the DOM (`music.ts`), so
       * `document.querySelectorAll('audio')` finds NOTHING even while it plays — and a
       * failed load looks identical to a healthy one through every other flag. This is
       * the surface `tools/tmp/aud_menu_silence.mjs` asserts against.
       */
      music: {
        url: string;
        error: string | null;
        playing: boolean;
        enabled: boolean;
      };
    };
  }
}

function publishQaHandle(engine: AudioEngine): void {
  if (typeof window === 'undefined') return;
  window.__audio = {
    engine,
    tap: () => engine.tap(),
    connectTap: (node: AudioNode) => engine.connectTap(node),
    stats: () => ({
      state: engine.getState(),
      activeVoices: engine.activeVoices(),
      started: engine.counters.started,
      droppedBudget: engine.counters.droppedBudget,
      droppedThrottle: engine.counters.droppedThrottle,
      droppedNotRunning: engine.counters.droppedNotRunning,
      volume: engine.getVolume(),
      muted: engine.isMuted(),
    }),
    // A getter, not a snapshot: the handle is published once at engine construction and
    // read by probes many seconds later, after the track has had time to fail. Reading
    // `getMusic()` lazily also keeps the index -> music -> index cycle resolving at call
    // time rather than at module evaluation, exactly as `music.ts`'s own import does.
    get music() {
      const m = getMusic();
      return { url: m.getTrackUrl(), error: m.getLoadError(), playing: m.isPlaying(), enabled: m.isEnabled() };
    },
  };
}

export { AudioEngine, MatchAudio };
export type { AudioState, MatchAudioOptions };
export * from './synth';
