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

import { CHARACTERS, MIN_SAFE_RADIUS, REGEN_AMOUNT, type CharacterId, type Weapon } from '../game/rules';
import type { GameEvent, MatchState, FighterRole } from '../game/state';
import { otherRole } from '../game/state';
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

export interface MatchAudioOptions {
  /** Which fighter is the local listener. Always `player` in the shipped game;
   * parameterised because a spectator or replay view would move it. */
  listener?: FighterRole;
}

export class MatchAudio {
  private readonly listenerRole: FighterRole;
  private lastFogSoundAt = -Infinity;
  private lastHealSoundAt = -Infinity;
  /** One-shot latch for the ring reaching `MIN_SAFE_RADIUS`. See `watchZone`. */
  private ringFloored = false;
  /** Guard against an arena whose ring starts at its own floor. See `watchZone`. */
  private sawRingAboveFloor = false;

  constructor(
    private readonly engine: AudioEngine,
    opts: MatchAudioOptions = {},
  ) {
    this.listenerRole = opts.listener ?? 'player';
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
      for (const ev of events) this.handleEvent(ev, state);
    } catch (err) {
      // The engine already swallows per-sound failures; this catches anything in the
      // dispatch itself (a malformed event, a missing weapon).
      console.warn('[audio] event dispatch failed:', err);
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
    if (state.safeRadius > MIN_SAFE_RADIUS + 0.5) {
      this.sawRingAboveFloor = true;
      return;
    }
    if (!this.sawRingAboveFloor) return;
    this.ringFloored = true;
    this.engine.play(S.ringFloor(), { priority: Priority.Critical });
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
        const timeout = state.player.alive === true && state.enemy.alive === true;
        const won = ev.winner === this.listenerRole;
        this.engine.play(timeout ? S.matchEndTimeout(won) : S.matchEnd(won), {
          priority: Priority.Critical,
        });
        break;
      }

      case 'weapon-fired':
        this.playCast(ev.fighterRole, ev.weaponKey, state);
        break;

      case 'hit-landed':
        this.playHit(ev, state);
        break;

      case 'heal': {
        // See `HEAL_MIN_INTERVAL_MS`. A regen tick is throttled; a deliberate heal
        // (Hamburger's 25 HP Onion Ring) always plays.
        if (ev.amount <= REGEN_AMOUNT && state.elapsed - this.lastHealSoundAt < HEAL_MIN_INTERVAL_MS) break;
        this.lastHealSoundAt = state.elapsed;
        const f = state[ev.fighterRole];
        this.engine.play(S.heal(), { ...this.place(f.x, f.y, state), key: 'heal' });
        break;
      }

      case 'death': {
        const f = state[ev.fighterRole];
        this.engine.play(S.death(), {
          ...this.place(f.x, f.y, state),
          priority: Priority.Critical,
          // A death is the loudest thing that can happen to you; give the local
          // player's own death full level regardless of where they are standing.
          gain: ev.fighterRole === this.listenerRole ? 1 : undefined,
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

  private playCast(role: FighterRole, weaponKey: string, state: MatchState): void {
    const fighter = state[role];
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
    const attacker = state[otherRole(ev.targetRole)];
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
    if (ev.targetRole === this.listenerRole) {
      const target = state[ev.targetRole];
      this.engine.play(S.hurt(target.hp / target.maxHp), {
        gain: 0.9,
        key: 'hurt',
        priority: Priority.Normal,
      });
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
    const me = state[this.listenerRole];
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
