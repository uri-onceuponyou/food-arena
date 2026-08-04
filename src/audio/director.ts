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
 */

import { CHARACTERS, type CharacterId, type Weapon } from '../game/rules';
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

export interface MatchAudioOptions {
  /** Which fighter is the local listener. Always `player` in the shipped game;
   * parameterised because a spectator or replay view would move it. */
  listener?: FighterRole;
}

export class MatchAudio {
  private readonly listenerRole: FighterRole;
  private lastFogSoundAt = -Infinity;

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
    if (events.length === 0) return;
    try {
      for (const ev of events) this.handleEvent(ev, state);
    } catch (err) {
      // The engine already swallows per-sound failures; this catches anything in the
      // dispatch itself (a malformed event, a missing weapon).
      console.warn('[audio] event dispatch failed:', err);
    }
  }

  /** Call on match restart so per-match throttles do not carry across. */
  reset(): void {
    this.lastFogSoundAt = -Infinity;
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

      case 'match-ended':
        this.engine.play(S.matchEnd(ev.winner === this.listenerRole), { priority: Priority.Critical });
        break;

      case 'weapon-fired':
        this.playCast(ev.fighterRole, ev.weaponKey, state);
        break;

      case 'hit-landed':
        this.playHit(ev, state);
        break;

      case 'heal': {
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
