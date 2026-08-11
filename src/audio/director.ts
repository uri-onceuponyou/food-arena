/**
 * `MatchAudio` — the audio consumer of the sim's typed `GameEvent[]` stream.
 *
 * ── Where this sits, and why it sits there ──────────────────────────────────────
 *
 * `src/game/vfx.ts` is the model this follows. The simulation is pure and knows
 * nothing about presentation; `stepMatch()` returns events; `match.ts` is the only
 * module that talks to both sim and renderer. VFX is one consumer of that event
 * stream and audio is a SECOND, entirely independent one. The sim gains no knowledge
 * of sound, `vfx.ts` gains no knowledge of sound, and this file gains no ability to
 * affect gameplay — it reads `MatchState` and never writes it.
 *
 * That independence is worth stating because the tempting shortcut is to have
 * `vfx.ts` play sounds alongside its bursts, since it already resolves the weapon.
 * Two consumers of one stream can be developed, tested and disabled separately; one
 * consumer doing two jobs cannot.
 *
 * ── Spatialisation ──────────────────────────────────────────────────────────────
 *
 * The listener is the LOCAL PLAYER, not the camera. The camera follows the player, so
 * the two are nearly identical in practice, and using the player keeps this module
 * free of any renderer dependency — it needs `MatchState` and nothing else.
 *
 * Sounds are panned and attenuated by their offset from the player in world units.
 * Two deliberate exceptions are centre-panned at full level: match-flow sounds
 * (countdown, start, end), which are not events in the world, and `giantSlam`
 * ultimates, whose whole design contract is that they must read with the caster off
 * screen (`PROGRESS.md`) — an ultimate you cannot see should still be one you cannot
 * miss.
 *
 * ── What is deliberately NOT sounded ────────────────────────────────────────────
 *
 * `splat-created`, `trail-mark-created` and `projectile-spawned` all fire at a rate
 * that would turn the mix to mud: Donut drops a trail mark every few hundred ms while
 * moving, and a 5-pellet spread emits five spawn events for one trigger pull. The
 * cast is voiced from `weapon-fired`, which fires exactly once per attack regardless
 * of pellet count, and the splat/trail are represented by the impact that made them.
 *
 * Measured rather than assumed — `tools/tmp/audio_census.mjs` runs the real `sim.ts`
 * over 121 matchups and counts what the stream actually contains. Per match at the
 * 45 s clock: 36.8 `projectile-spawned`, 14.3 `trail-mark-created` and 2.6
 * `splat-created` against 27.5 `weapon-fired` and 33.2 `hit-landed`. Voicing the three
 * silent kinds would add 54 voices per match to a mix that currently carries 62.
 *
 * ── State that is NOT in the event stream ───────────────────────────────────────
 *
 * `GameEvent` does not carry everything a player needs to hear. Two cases, both new
 * this session, both handled by reading `MatchState` directly:
 *
 *   * The ring reaching `MIN_SAFE_RADIUS` — see `watchZone`. There is no event for it.
 *   * A match ending on the CLOCK rather than by knockout — `match-ended` fires for
 *     both and carries no reason, so the discriminant is that both fighters are still
 *     alive. See the `'match-ended'` case.
 *   * A status that was REFUSED by the grace rule — `hit-landed` carries the effect the
 *     WEAPON has, not whether the target accepted it. See `statusWrittenThisFrame`.
 *
 * ── A swing that hits and a swing that misses ───────────────────────────────────
 *
 * `combat.ts` pushes `weapon-fired` UNCONDITIONALLY, before any range or cone test —
 * and melee at zero separation now MISSES for a coned weapon, so point-blank whiffs
 * are a real and newly-common outcome. There is deliberately no separate "whiff"
 * sound: a connect is `weapon-fired` + `hit-landed` and a whiff is `weapon-fired`
 * alone, so the impact layer IS the difference. `tools/audio-probe.mjs --mode coverage`
 * measures that separation rather than assuming it.
 */

import { CHARACTERS, REGEN_AMOUNT, ringFloorFor, type CharacterId, type Weapon } from '../game/rules';
import type { Fighter, GameEvent, MatchState, FighterId, FighterRole } from '../game/state';
// The presentation-side seat rules, stated once for all four consumers of the event
// stream. ⚠️ `otherRole` is gone from this file — `state[otherRole(ev.targetRole)]` was
// "whoever is not the victim", which is the attacker only while there are two fighters.
// `roster.ts` explains why every resolver keeps a role fallback: this file is driven by
// `tools/audio-probe.mjs`, whose duck-typed states carry NO `fighters` array and whose
// synthetic `hit-landed` events carry NO `targetId` and NO `attackerId`.
import { fighterOf, fightersOf, LOCAL_SLOT, slotOf, weaponAttackerOf } from '../game/roster';
import { Priority, type AudioEngine } from './engine';
import * as S from './sounds';
import type { SoundFn, SynthCtx } from './synth';
import { getWeaponSfx } from './weapons';
import type { WeaponSfxCtx } from './weapons/types';

/**
 * World-unit offset from the player at which a sound is panned fully to one side.
 * Sized to the fair-play window (`render/camera.ts` guarantees 199.2 wu on every
 * aspect), so something at the edge of what you can SEE is at the edge of what you
 * hear — the pan and the picture agree on any device.
 */
const PAN_FULL_WU = 210;
/** Hard pan is fatiguing on headphones and actively misleading on a phone speaker.
 * 0.78 keeps a clear side while leaving both ears fed. */
const PAN_MAX = 0.78;

/** World-unit distance at which a sound is at half level. The arena is 1400x1000 wu
 * and fighters spawn 1080 apart, so this has to be generous or the opponent's attacks
 * would be inaudible for most of a match — which is a competitive problem, not a mix
 * problem: you must be able to hear that you are being shot at. */
const DISTANCE_HALF_WU = 420;
/** Floor on distance attenuation. Nothing that matters ever becomes inaudible. */
const MIN_DISTANCE_GAIN = 0.32;

/** Minimum gap between two fog ticks being voiced. The sim ticks fog every 300 ms
 * (`FOG_TICK_MS`), which is a nag, not a rhythm. */
const FOG_MIN_INTERVAL_MS = 900;

/**
 * Minimum gap between two REGEN heal ticks being voiced.
 *
 * Out-of-combat regen emits a `heal` event every `REGEN_TICK_MS` (200 ms) for
 * `REGEN_AMOUNT` (2 HP), so a fighter healing from low health emits up to ~50 of them
 * in a row. 200 ms is comfortably OUTSIDE the engine's 110 ms retrigger window, so
 * nothing throttled them: measured, five events 200 ms apart produced five voices of a
 * rising triad — the "one sound stuttering" failure the retrigger table exists to
 * prevent, arriving through the one gap the table cannot cover.
 *
 * 520 ms = 2.6 x `REGEN_TICK_MS`, so every third tick is voiced and consecutive voices
 * never overlap (`heal()` is 390 ms long).
 *
 * Deliberately keyed on the AMOUNT, not on the event: Hamburger's Onion Ring heals 25
 * HP on a 6 s cooldown and is a decision the player made, so it is never throttled. A
 * regen tick is the game breathing; a 25 HP heal is a play.
 */
const HEAL_MIN_INTERVAL_MS = 520;

/**
 * Level the kitchen bed is played at, on top of the level authored in `kitchenBed()`.
 *
 * Split from `sounds.ts` on purpose: the SHAPE of the bed belongs there and how loudly
 * the game runs it belongs here, next to `place()` and the distance rules it has to sit
 * under. Two numbers to turn, not a re-tune of four layers and an accent bank.
 *
 * ── Why there are two of them ──────────────────────────────────────────────────
 *
 * The bed has to satisfy two requirements that pull directly against each other, and a
 * single level cannot:
 *
 *   * FILL THE SILENCE. 69.9% of the mean match is one unbroken silence before the
 *     first combat sound. A bed quiet enough to be safe during a fight is a bed nobody
 *     hears during the two thirds of the match that has no fight in it.
 *   * DO NOT MASK. `tools/tmp/audio_mix.mjs --ambience` highpasses the render at 2 kHz
 *     and compares each weapon impact against the bed IN THE SAME WINDOW. At the first
 *     level tried the bed's own 2-16 kHz energy sat ABOVE the 10th-percentile impact's
 *     — a background layer covering the foreground, in exactly the octaves the
 *     roster-wide top-end pass had just been built to fill.
 *
 * So the level follows the match. Combat within the last `AMBIENCE_CALM_MS` and the bed
 * plays at `FIGHT`; a quiet stretch and the next chunk comes up to `CALM`. It is a
 * chunk-granular duck rather than a sidechain, which is the whole reason the bed is
 * re-triggered in 2.7 s pieces: the level is chosen at `engine.play` time from state
 * this class already has, with no envelope to automate, no handle to keep, and no
 * change to `engine.ts` at all. The 0.7 s crossfade between chunks IS the ramp.
 */
const AMBIENCE_GAIN_FIGHT = 0.45;
/**
 * +10.5 dB over `FIGHT`. Both numbers are bounded by the masking measurement above
 * rather than chosen by ear: `FIGHT` is the largest value at which 90% of weapon
 * impacts still clear the bed by 6 dB above 2 kHz, and `CALM` is as far above it as the
 * chunk-granular duck can carry without the calm level bleeding into the first exchange.
 */
const AMBIENCE_GAIN_CALM = 1.5;
/**
 * How long after a cast or a hit the match still counts as a fight.
 *
 * 1.6 s, and it is deliberately longer than the 1.2 s that would merely cover the gap
 * between an attack and its impact: a duck that releases the instant a fight pauses for
 * breath is a bed that pumps, and a pumping bed is more noticeable than a loud one.
 */
const AMBIENCE_CALM_MS = 1600;
/**
 * Separation below which the match counts as a fight even with nothing on the wire yet.
 *
 * The duck is chunk-granular, so it can only ever react one chunk late — and the chunk
 * that matters most is the one covering the FIRST exchange, which by construction has no
 * combat behind it to react to. Two fighters this close are about to be in one, and
 * `MatchState` already carries both positions. Set to `DISTANCE_HALF_WU`, the range at
 * which a sound is already half level, so "close enough to duck for" and "close enough
 * to hear clearly" are the same number rather than two.
 */
const AMBIENCE_ENGAGE_WU = DISTANCE_HALF_WU;

/**
 * Pan of successive ambience chunks, as a golden-ratio walk.
 *
 * A bed pinned dead centre is a bed the ear stops hearing as a room — and a random pan
 * would need an rng this class deliberately does not have (every sound gets its own
 * from the engine; the director itself is pure dispatch). `0.618...` is the least
 * rational number there is, so consecutive chunks never repeat a position and never
 * fall into a pattern, from one integer counter and no state.
 */
const AMBIENCE_PAN_STRIDE = 0.6180339887;
/** How far off centre a chunk may sit. Small: the kitchen surrounds you, it is not an
 * object at a position, and a bed swinging hard left is a bed you notice. */
const AMBIENCE_PAN_SPREAD = 0.42;

export interface MatchAudioOptions {
  /** Which fighter is the local listener. Always `player` in the shipped game;
   * parameterised because a spectator or replay view would move it.
   *
   * ⚠️ A SEAT NAME, and therefore only able to name slots 0 and 1. Kept because it is
   * the published option and `tools/audio-probe.mjs` constructs directors with it; use
   * `listenerId` to name any other slot. Ignored when `listenerId` is given. */
  listener?: FighterRole;
  /** Which SLOT is the local listener. `roster.ts:LOCAL_SLOT` by default, which is what
   * `listener: 'player'` meant and is the only seat the shipped game ever sits in. */
  listenerId?: FighterId;
}

export class MatchAudio {
  private readonly listenerSlot: number;
  private lastFogSoundAt = -Infinity;
  private lastHealSoundAt = -Infinity;
  /** One-shot latch for the ring reaching `MIN_SAFE_RADIUS`. See `watchZone`. */
  private ringFloored = false;
  /** Guard against an arena whose ring starts at its own floor. See `watchZone`. */
  private sawRingAboveFloor = false;
  /**
   * Each fighter's `stunnedUntil` / `slowedUntil` as they stood at the END of the last
   * batch — i.e. BEFORE this frame's sim steps ran. The discriminant for a refused
   * status; see `statusWrittenThisFrame`.
   *
   * `NaN` means "not known yet", which is the correct starting value: a first batch
   * carrying a status hit must be read as LANDED (a fresh fighter is always ready), and
   * `NaN !== anything` gives exactly that with no extra branch.
   */
  private statusBefore: { stun: number; slow: number }[] = [];
  /** Consumed once per batch, per target, per effect. See `statusWrittenThisFrame`. */
  private statusWriterUnclaimed: { stun: boolean; slow: boolean }[] = [];
  /** False when the `MatchState` handed in does not carry `status` at all — see
   * `openStatusWindow`. Nothing is voiced as a refusal while this is false. */
  private statusTrackable = false;
  /** Match time at which the next ambience chunk is due. See `watchAmbience`. */
  private nextAmbienceAt = -Infinity;
  /** How many chunks this match has played — drives the pan walk, nothing else. */
  private ambienceChunk = 0;
  /** Match time of the last cast or hit. Decides which ambience level the next chunk
   * comes up at; see `AMBIENCE_GAIN_FIGHT`. */
  private lastCombatAt = -Infinity;

  constructor(
    private readonly engine: AudioEngine,
    opts: MatchAudioOptions = {},
  ) {
    this.listenerSlot = opts.listenerId ?? (opts.listener === 'enemy' ? 1 : LOCAL_SLOT);
  }

  /**
   * Voice one tick's events. Never throws — `match.ts` calls this from the render
   * loop, and a bad sound must cost silence, not a frame.
   */
  handleEvents(events: readonly GameEvent[], state: MatchState): void {
    try {
      // Deliberately BEFORE the early-out on an empty batch, and that ordering is the
      // whole reason the early-out is gone.
      //
      // Not everything the player needs to hear is an event. The ring reaching its
      // floor is a threshold crossed by a continuously-varying number in `MatchState`,
      // and the tick it crosses on is overwhelmingly likely to carry no events at all:
      // measured by `tools/tmp/audio_census.mjs` over 121 matchups of the real sim,
      // 7,547 of 158,992 ticks carry any event — **95.3% of ticks are empty**. The old
      // `if (events.length === 0) return` would therefore have dropped this cue about
      // nineteen times out of twenty, silently, which is precisely the
      // wired-but-produces-nothing failure this project keeps paying for
      // (`docs/LESSONS.md` §1). The cost of the change is one float compare per frame.
      this.watchZone(state);
      // Same argument as `watchZone`, for the same reason it sits here: the kitchen is
      // not an event either. It is a CONTINUOUS state of the match, and 95.3% of ticks
      // carry no events at all, so anything driven off the event stream would be a bed
      // that starts whenever the first shot happens to be fired — which is precisely
      // the 6.55 s of silence this exists to fill.
      this.watchAmbience(state);
      this.openStatusWindow(state);
      for (const ev of events) this.handleEvent(ev, state);
    } catch (err) {
      // The engine already swallows per-sound failures; this catches anything in the
      // dispatch itself (a malformed event, a missing weapon).
      console.warn('[audio] event dispatch failed:', err);
    } finally {
      // In `finally` on purpose: a throw in the middle of a batch must not leave the
      // snapshot describing a frame that is now two frames old, which would misread
      // every status hit until the next clean batch.
      this.closeStatusWindow(state);
    }
  }

  /** Call on match restart so per-match throttles and one-shot latches do not carry
   * across. With `MATCH_DURATION_MS` at 45 s this happens roughly four times as often
   * per hour as it used to, so a latch that failed to clear would now be four times as
   * visible — it would silence the final-ring cue for every match after the first. */
  reset(): void {
    this.lastFogSoundAt = -Infinity;
    this.lastHealSoundAt = -Infinity;
    this.ringFloored = false;
    this.sawRingAboveFloor = false;
    // Back to "not known yet".
    //
    // Stated precisely, because the tempting overclaim is wrong: leaving these dangling
    // would NOT mis-voice match two today. The stale value differs from the new
    // fighters' `-Infinity`, so the comparison says "moved", so the first stun reads as
    // landed — which is also the truth, because a fresh fighter is always ready. It is
    // correct by coincidence, and per-match state that survives a match is exactly the
    // kind of thing a later change silently starts depending on. Asserted rather than
    // assumed: `--mode dispatch` drives a second match through a `reset()` director.
    // Emptied rather than refilled with two seats: `openStatusWindow` sizes both arrays
    // from the roster it is handed, so a second match with a different seat count cannot
    // inherit the first one's length.
    this.statusBefore = [];
    this.statusWriterUnclaimed = [];
    this.statusTrackable = false;
    // Both matter for match two. `nextAmbienceAt` is an absolute match time and the
    // clock restarts at zero, so leaving it would suppress the bed for as long as the
    // previous match lasted — i.e. the whole of match two on a short one.
    this.nextAmbienceAt = -Infinity;
    this.ambienceChunk = 0;
    this.lastCombatAt = -Infinity;
  }

  // ── The shrug-off discriminant ────────────────────────────────────────────

  /**
   * One fighter's status expiry timestamps, or `null` if this `MatchState` does not
   * carry them.
   *
   * `--mode dispatch` in `tools/audio-probe.mjs` duck-types a state to exactly the
   * fields the director reads, deliberately, and `status` is not among them. A missing
   * field must therefore mean "cannot tell", never "refused" — `vfx.ts` reaches the
   * same conclusion for its own snapshot: **no signal beats a wrong one.**
   */
  private static statusTimestamps(f: Fighter): { stun: number; slow: number } | null {
    const st = (f as { status?: { stunnedUntil?: number; slowedUntil?: number } }).status;
    if (!st || typeof st.stunnedUntil !== 'number' || typeof st.slowedUntil !== 'number') return null;
    return { stun: st.stunnedUntil, slow: st.slowedUntil };
  }

  /**
   * Decide, for this batch, whether each target's status timer MOVED — and therefore
   * whether one of the status hits in this batch was accepted.
   *
   * ── Why the timestamp and not the predicate ────────────────────────────────
   *
   * `combat.ts` exports `statusReadyAt()` and `vfx.ts` renders the shrug-off band from
   * it, so the obvious thing is to import it here too. It does not work at this call
   * site: by the time the director sees the event, `applyDamage` has ALREADY written
   * `stunnedUntil`, so a stun that landed and a stun that was refused while the target
   * was still stunned both read as "not ready" and the predicate answers the same for
   * the two cases it exists to separate.
   *
   * `applyDamage` is the only writer of either field and writes them ONLY on acceptance,
   * so **the timestamp moving is the acceptance**, exactly and with no threshold. A
   * landing always moves it strictly upward (`elapsed + DURATION` against a value that
   * was refused because it was already >= `elapsed`), so the two can never coincide.
   *
   * Where one batch carries several status hits on the same target — a multi-pellet
   * spread, every pellet stamped with the weapon's effect — at most ONE of them can have
   * been the writer, so the first claims it and the rest are refusals, which is what the
   * sim did. `tools/tmp/audio_shrug_census.mjs` uses this same discriminant to count
   * refusals over 110 matchups and is where the 95-stun figure in `sounds.ts` comes from.
   *
   * The comparison is against the values as of the END of the previous batch, which is
   * "before this frame's sim steps" — the same one-frame-old snapshot `vfx.ts` reads,
   * so the ring pop and the sound can never disagree about a given hit.
   */
  private openStatusWindow(state: MatchState): void {
    const roster = fightersOf(state);
    const now = roster.map((f) => MatchAudio.statusTimestamps(f));
    // ⚠️ EVERY fighter must carry timers, not just the first two. `statusTrackable` is
    // the "cannot tell" flag the offline probe's duck-typed state depends on, and a
    // partial roster is exactly the case where a refusal must not be voiced.
    this.statusTrackable = now.length > 0 && now.every((t) => t !== null);
    if (!this.statusTrackable) return;
    for (let slot = 0; slot < now.length; slot++) {
      const before = this.statusBefore[slot] ?? { stun: NaN, slow: NaN };
      const cur = now[slot]!;
      this.statusWriterUnclaimed[slot] = {
        stun: cur.stun !== before.stun,
        slow: cur.slow !== before.slow,
      };
    }
  }

  /** Carry this batch's timestamps forward to be the next batch's "before". */
  private closeStatusWindow(state: MatchState): void {
    fightersOf(state).forEach((f, slot) => {
      const ts = MatchAudio.statusTimestamps(f);
      if (ts) this.statusBefore[slot] = ts;
    });
  }

  /** True when this event's status was discarded by the grace rule. */
  private wasStatusRefused(slot: number, effect: 'stun' | 'slow'): boolean {
    if (!this.statusTrackable) return false;
    const claim = this.statusWriterUnclaimed[slot];
    if (claim?.[effect]) {
      claim[effect] = false;
      return false;
    }
    return true;
  }

  // ── State the event stream does not carry ─────────────────────────────────

  /**
   * The ring reaching `MIN_SAFE_RADIUS` — the moment the fog stops closing.
   *
   * `sim.ts` floors the safe radius rather than letting it reach zero, so there is now
   * a permanent safe annulus and a moment at which the squeeze STOPS. The HUD renders
   * that state as "FINAL RING". It is not in `GameEvent` — the sim emits no event for
   * it — so audio derives it from the same number the HUD reads.
   *
   * Latched, and one-shot per match: `safeRadius` sits AT the floor for every remaining
   * tick (measured: 6.34 s of a 45 s match, ~380 ticks), so an unlatched test would
   * fire the cue several hundred times.
   *
   * `sawRingAboveFloor` guards the degenerate case where an arena's `maxSafeRadius` is
   * already <= the floor: without it, such an arena would announce "the ring has
   * stopped" on the first playing tick, which is true but useless. The shipped arena is
   * 993 wu against a 140 wu floor, so this only ever matters for a future arena.
   *
   * The HUD's "FINAL RING" label is deliberately NOT what is voiced here. That label is
   * PLAYER-RELATIVE (`dist <= MIN_SAFE_RADIUS` — am I standing inside the final ring),
   * so it flickers on and off as the player walks, and a sound tied to it would nag
   * every time they crossed the line. This is the SCHEDULE fact, which happens exactly
   * once and at a deterministic time.
   */
  private watchZone(state: MatchState): void {
    if (this.ringFloored) return;
    if (state.phase !== 'playing') return;
    // A number rather than an exact equality: `safeRadius` is clamped with `Math.max`,
    // so it lands exactly on the floor — but an arena or schedule change should not
    // silently break the cue, and a half-unit band costs nothing.
    //
    // ⚠️ THIS READ `MIN_SAFE_RADIUS` UNTIL 2026-08-11, AND IT WAS WRONG TWICE OVER.
    //   * The floor scales with seat count (`DECISIONS §53b`): at five and six fighters
    //     the ring stops at 187.42 / 237.00, so a 140 wu comparison would have waited
    //     for a radius that never arrives and the cue would never have fired at all.
    //   * The floor is ZERO once sudden death begins (`DECISIONS §2`). `ringFloorFor`
    //     carries both, so this latch now fires on the sudden-death collapse — the
    //     moment the squeeze does not stop but COMPLETES. That is the right instant for
    //     this cue and it is the only zone cue there is; a dedicated sudden-death sting
    //     would be a new entry in `sfx.ts`, which is not this pass's to write.
    if (state.safeRadius > ringFloorFor(state.fighters.length, state.timeRemaining) + 0.5) {
      this.sawRingAboveFloor = true;
      return;
    }
    if (!this.sawRingAboveFloor) return;
    this.ringFloored = true;
    this.engine.play(S.ringFloor(), { priority: Priority.Critical });
  }

  /**
   * THE KITCHEN BED — re-triggered, not looped, and that is the design.
   *
   * ## The measurement this answers
   *
   * `tools/tmp/audio_mix.mjs --shape`, 121 matchups of the real sim: mean play length
   * 9.60 s, mean gap from the start whistle to the first combat sound **6.55 s — 69.9%
   * of the match, in one unbroken silence**, duty cycle 21.9%. `shell.ts` fades the
   * music out for the whole match, so that silence is total. A brawler is not silent
   * for two thirds of its running time, and the fix is a room.
   *
   * ## Why a chunk every 2 s and not one long voice
   *
   * A single voice spanning the match would have to be started on an event, cancelled
   * on another, and would sit permanently in a 20-voice budget it can never be evicted
   * from without a click. Re-triggering a 2.7 s chunk every 2.0 s instead means:
   *
   *   * it costs the SAME machinery every other sound uses — `engine.play`, the voice
   *     budget, `Priority.Ambient`, the retrigger table — with no special case anywhere;
   *   * under budget pressure (a big fight) the bed is the FIRST thing stolen, which is
   *     exactly the priority a bed should have, and it returns on the next chunk;
   *   * it renders identically offline, so the mix probe measures the shipped thing;
   *   * and each chunk draws a fresh accent and a fresh band, so nothing repeats. A
   *     literal loop is the one thing a procedural bed must not be, because the ear
   *     finds a loop point in about fifteen seconds and never un-hears it.
   *
   * The 0.7 s overlap is the crossfade: `kitchenBed()`'s hold is set so its release
   * begins exactly as the next chunk's attack does.
   *
   * ## Where it starts and stops
   *
   * `phase === 'playing'` only. The countdown has its own three beats and a whistle and
   * does not want a room fading up underneath it, and once the match is over the result
   * sting should land in silence. Both ends therefore need no event and no wiring
   * outside this file — `match.ts` and `shell.ts` are untouched.
   */
  private watchAmbience(state: MatchState): void {
    if (state.phase !== 'playing') return;
    if (state.elapsed < this.nextAmbienceAt) return;
    // Absolute, not incremental: on the first playing tick `nextAmbienceAt` is
    // -Infinity, so the chunk fires immediately rather than 2 s into the fight.
    this.nextAmbienceAt = state.elapsed + S.AMBIENCE_PERIOD_S * 1000;
    const walk = (this.ambienceChunk * AMBIENCE_PAN_STRIDE) % 1;
    this.ambienceChunk++;
    // ⚠️ WAS `hypot(player - enemy)` — the distance between slots 0 and 1, which at six
    // fighters would leave the bed calm while four of them brawled in a corner. The
    // question the bed is asking is "is anybody about to be in a fight near anybody",
    // so it is the CLOSEST PAIR. Identical at two seats: there is exactly one pair.
    const roster = fightersOf(state);
    let gap = Infinity;
    for (let i = 0; i < roster.length; i++) {
      for (let j = i + 1; j < roster.length; j++) {
        const d = Math.hypot(roster[i].x - roster[j].x, roster[i].y - roster[j].y);
        if (d < gap) gap = d;
      }
    }
    const fighting = state.elapsed - this.lastCombatAt < AMBIENCE_CALM_MS || gap < AMBIENCE_ENGAGE_WU;
    this.engine.play(S.kitchenBed(), {
      gain: fighting ? AMBIENCE_GAIN_FIGHT : AMBIENCE_GAIN_CALM,
      pan: (walk * 2 - 1) * AMBIENCE_PAN_SPREAD,
      priority: Priority.Ambient,
      key: 'ambience',
    });
  }

  // ── Dispatch ──────────────────────────────────────────────────────────────

  private handleEvent(ev: GameEvent, state: MatchState): void {
    switch (ev.type) {
      case 'countdown-tick':
        this.engine.play(S.countdownTick(ev.value), { priority: Priority.Critical });
        break;

      case 'match-started':
        this.engine.play(S.matchStart(), { priority: Priority.Critical });
        break;

      case 'match-ended': {
        // A KNOCKOUT and a TIMEOUT are the same event and must not be the same sound.
        //
        // `resolveTimeout` in `sim.ts` is new this session: a match can now end on the
        // clock with BOTH fighters alive, decided on HP fraction. It pushes no `death`
        // event and leaves both fighters `alive`, which is exactly the discriminant
        // used here — the sim does not carry a reason on the event, and adding one
        // would mean widening `GameEvent` in `state.ts`, which this pillar does not
        // own. Both fighters standing is a complete and sufficient test: any knockout
        // ending has a dead fighter by construction.
        //
        // `=== true` rather than a truthiness test on purpose, so a partial/duck-typed
        // state (the offline probe builds one) takes the knockout path rather than
        // silently reclassifying every ending.
        // ⚠️ WAS `state.player.alive === true && state.enemy.alive === true`. `every` is
        // the same statement at two seats and the right one above two — a six-way that
        // reaches the clock with four survivors is a timeout, and the two-seat form only
        // ever asked about slots 0 and 1. The `=== true` per fighter is unchanged and is
        // still load-bearing: a duck-typed state with no `alive` field must take the
        // KNOCKOUT path rather than silently reclassifying every ending.
        const roster = fightersOf(state);
        const timeout = roster.length > 0 && roster.every((f) => f.alive === true);
        const won = slotOf(ev.winnerId, ev.winner) === this.listenerSlot;
        this.engine.play(timeout ? S.matchEndTimeout(won) : S.matchEnd(won), {
          priority: Priority.Critical,
        });
        break;
      }

      case 'weapon-fired':
        // Marked on the CAST as well as the hit, deliberately: a projectile takes up to
        // several hundred ms to arrive, and a bed that only ducks once something lands
        // is a bed sitting at full level underneath the shot that caused it.
        this.lastCombatAt = state.elapsed;
        this.playCast(fighterOf(state, ev.fighterId, ev.fighterRole), ev.weaponKey, state);
        break;

      case 'hit-landed':
        this.lastCombatAt = state.elapsed;
        this.playHit(ev, state);
        break;

      case 'heal': {
        // See `HEAL_MIN_INTERVAL_MS`. A regen tick is throttled; a deliberate heal
        // (Hamburger's 25 HP Onion Ring) always plays.
        if (ev.amount <= REGEN_AMOUNT && state.elapsed - this.lastHealSoundAt < HEAL_MIN_INTERVAL_MS) break;
        this.lastHealSoundAt = state.elapsed;
        const f = fighterOf(state, ev.fighterId, ev.fighterRole);
        this.engine.play(S.heal(), { ...this.place(f.x, f.y, state), key: 'heal' });
        break;
      }

      case 'death': {
        const f = fighterOf(state, ev.fighterId, ev.fighterRole);
        this.engine.play(S.death(), {
          ...this.place(f.x, f.y, state),
          priority: Priority.Critical,
          // A death is the loudest thing that can happen to you; give the local
          // player's own death full level regardless of where they are standing.
          gain: slotOf(ev.fighterId, ev.fighterRole) === this.listenerSlot ? 1 : undefined,
        });
        break;
      }

      case 'projectile-destroyed':
        // 'hit-target' is already voiced by the `hit-landed` that accompanies it, and
        // 'expired' is a projectile fading out at max range — neither wants a thud.
        if (ev.reason === 'hit-cover') {
          this.engine.play(S.coverThud(), {
            ...this.place(ev.x, ev.y, state),
            priority: Priority.Ambient,
            key: 'cover',
          });
        }
        break;

      default:
        // projectile-spawned / splat-created / trail-mark-created — see the header.
        break;
    }
  }

  private playCast(fighter: Fighter, weaponKey: string, state: MatchState): void {
    const weapon = CHARACTERS[fighter.characterId].weapons.find((w) => w.key === weaponKey);
    if (!weapon) return;

    // The ultimate: centre-panned, full level, top priority. See the header.
    if (weapon.giantSlam) {
      this.engine.play(S.castGiantSlam(), { priority: Priority.Critical });
      return;
    }

    const bespoke = getWeaponSfx(fighter.characterId, weaponKey)?.cast;
    const sound = bespoke
      ? this.wrapWeaponHook(bespoke, weapon, fighter.characterId, weapon.damage)
      : genericCast(weapon);

    this.engine.play(sound, {
      ...this.place(fighter.x, fighter.y, state),
      key: `cast:${fighter.characterId}.${weaponKey}`,
    });
  }

  private playHit(
    ev: Extract<GameEvent, { type: 'hit-landed' }>,
    state: MatchState,
  ): void {
    const place = this.place(ev.x, ev.y, state);

    // Resolved BEFORE the ambient early-outs below, because the writer claim has to be
    // consumed in event order to stay attributable: today only `kind: 'weapon'` ever
    // carries an effect (trail, hazard and fog all pass `null` to `applyDamage`), but a
    // future stunning hazard must not be able to hand its claim to the next weapon hit.
    const targetSlot = slotOf(ev.targetId, ev.targetRole);
    const shrugged = ev.effect === 'stun' && this.wasStatusRefused(targetSlot, 'stun');

    // Ambient damage sources are categorically not weapon hits — `match.ts` already
    // treats fog this way visually (no burst, no shake, a violet "ZONE" number) and
    // the audio holds the same line.
    if (ev.source.kind === 'fog') {
      if (state.elapsed - this.lastFogSoundAt < FOG_MIN_INTERVAL_MS) return;
      this.lastFogSoundAt = state.elapsed;
      // The zone is everywhere, so it is not placed — it surrounds you.
      this.engine.play(S.fogTick(), { priority: Priority.Ambient, key: 'fog' });
      return;
    }
    if (ev.source.kind === 'hazard') {
      this.engine.play(S.hazardTick(), { ...place, priority: Priority.Ambient, key: 'hazard' });
      return;
    }
    if (ev.source.kind === 'trail') {
      this.engine.play(S.trailTick(), { ...place, priority: Priority.Ambient, key: 'trail' });
      return;
    }

    // ── Weapon hit ────────────────────────────────────────────────────────
    // `weaponKey` is hoisted out of the `find` callback deliberately: TypeScript
    // discards the `ev.source` discriminant narrowing inside a closure, so reading
    // it there would not compile.
    const weaponKey = ev.source.weaponKey;
    // ⚠️ WAS `state[otherRole(ev.targetRole)]`. See the import block: the id is the
    // attacker, "not the victim" only happens to be the attacker at two seats.
    const attacker = weaponAttackerOf(state, ev.source, ev.targetRole);
    const weapon = CHARACTERS[attacker.characterId].weapons.find((w) => w.key === weaponKey);
    const bespoke = weapon ? getWeaponSfx(attacker.characterId, weapon.key)?.impact : undefined;
    const sound =
      bespoke && weapon
        ? this.wrapWeaponHook(bespoke, weapon, attacker.characterId, ev.amount)
        : S.impact(ev.amount);

    this.engine.play(sound, {
      ...place,
      key: `impact:${attacker.characterId}.${weaponKey}`,
    });

    // The extra "you are being hit" layer, local player only. See `sounds.ts` ->
    // `hurt()`: this is the audio counterpart of `match.ts`'s `targetBias` on shake.
    if (targetSlot === this.listenerSlot) {
      const target = fighterOf(state, ev.targetId, ev.targetRole);
      this.engine.play(S.hurt(target.hp / target.maxHp), {
        gain: 0.9,
        key: 'hurt',
        priority: Priority.Normal,
      });
    }

    // ── The shrug-off ─────────────────────────────────────────────────────
    // STUN only, and that is a measured line rather than a cautious one: see
    // `sounds.ts` -> `statusRefused()` for the 110-matchup census (460 refused slows
    // against 83 refused stuns, 65.5% of all refusals less than 250 ms apart).
    //
    // The per-frame discriminant below is not an approximation of the per-step truth,
    // it IS it: replayed over the same 110 matchups at 1, 3, 6 and 12 sim steps per
    // rendered frame, the rule finds all 83 and invents none, at every batch size.
    //
    // Placed like the impact it annotates, so a refusal on the far side of the arena
    // arrives from that side and one on the player's own body arrives centred — which
    // is the whole difference between "my stun bounced" and "I shrugged that off",
    // carried by the pan the hit already had, with no second sound to author.
    if (shrugged) {
      this.engine.play(S.statusRefused(), { ...place, key: 'shrug', priority: Priority.Normal });
    }
  }

  // ── Helpers ───────────────────────────────────────────────────────────────

  /**
   * Adapt a `WeaponSfx` hook (which takes a `WeaponSfxCtx`) into the plain `SoundFn`
   * the engine schedules. The engine owns `ctx`/`dest`/`when`/`rng`; the gameplay
   * facts are closed over here, exactly as `vfx.ts` builds its `WeaponVfxCtx`.
   */
  private wrapWeaponHook(
    hook: (c: WeaponSfxCtx) => number,
    weapon: Weapon,
    characterId: CharacterId,
    damage: number,
  ): SoundFn {
    return (s: SynthCtx) => hook({ ...s, color: weapon.color, damage, weapon, characterId });
  }

  /** Pan + distance gain for a world-unit position, relative to the listener. */
  private place(xWU: number, yWU: number, state: MatchState): { pan: number; gain: number } {
    const me = fightersOf(state)[this.listenerSlot] ?? state.player;
    const dx = xWU - me.x;
    const dy = yWU - me.y;
    const pan = Math.max(-1, Math.min(1, dx / PAN_FULL_WU)) * PAN_MAX;
    const dist = Math.hypot(dx, dy);
    // Simple rational falloff — no inverse-square, because a brawler wants distant
    // threats audible, not physically accurate.
    const gain = Math.max(MIN_DISTANCE_GAIN, 1 / (1 + dist / DISTANCE_HALF_WU));
    return { pan, gain };
  }
}

/** Generic cast, chosen by weapon type. Split out so the probe can reach it without
 * constructing a director. */
export function genericCast(weapon: Weapon): SoundFn {
  if (weapon.type === 'melee') return S.castMelee(weapon.damage, weapon.cone ?? 90);
  if (weapon.type === 'self') return S.castSelf();
  return S.castRanged(weapon.damage);
}
