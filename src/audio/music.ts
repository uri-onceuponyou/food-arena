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

/** Served from `public/`, so it is a plain URL and never goes through the JS bundle. */
const TRACK_URL = '/audio/bounce-and-bash.mp3';

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
    this.wanted = true;
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

  private applyGain(explicit?: number): void {
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
        this.gain.gain.linearRampToValueAtTime(target, t + 0.08);
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
