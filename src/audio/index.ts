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
  };
}

export { AudioEngine, MatchAudio };
export type { AudioState, MatchAudioOptions };
export * from './synth';
