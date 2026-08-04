/**
 * Hamburger — the THICK, DAMPED voice. The darkest character in the roster.
 *
 * Matched to `src/vfx/weapons/hamburger.ts`, whose converted weapon (Tomato Toss) is
 * described there as "a wet, splattering fruit — round-but-squashed in flight, a soft
 * SETTLING splatter (not crystalline shards/rings) on impact", and which is
 * deliberately the opposite pole from `waterbottle.ts`'s hard angular shattering.
 * Everything Hamburger throws is soft, wet and heavy, and nothing he does rings,
 * cracks or sparkles.
 *
 * ── The axis: DAMPING ────────────────────────────────────────────────────────────
 *
 * Eleven characters cannot all be separated by "brightness" alone, so each one owns a
 * position on a shared measurable axis and a device nobody else uses. Hamburger owns
 * the BOTTOM of the spectral-centroid ladder — his impacts measure lower than any
 * other fighter's — and the device that puts him there is not EQ, it is DAMPING:
 *
 *   * Every noise layer is 24 dB/oct lowpassed with a cutoff that COLLAPSES. A single
 *     biquad is not enough to make anything dark (see `poles` in `synth.ts`); this is
 *     the same lesson `soup.ts` learned, applied harder.
 *   * The transients have no tick above 2 kHz at all. Hamburger's snap is a low
 *     pitched thump, not a click — meat hitting bread does not click.
 *   * The bodies are the heaviest and most saturated in the game, and the DECAYS are
 *     the shortest. That combination is what "damped" means physically: a lot of
 *     energy going in and almost none coming back out. A long dark sound is a cave; a
 *     SHORT dark sound is something soft absorbing the hit.
 *
 * Weapon keys (`rules.ts` -> `CHARACTERS.hamburger.weapons`): `'Smash'` (12 dmg,
 * melee), `'Tomato'` (8 dmg, slow, splatter), `'Lettuce'` (6 dmg, stun),
 * `'Onion'` (self, heals 25 — cast only, there is no impact to voice).
 */

import { centsJitter, longest, noiseBurst, tone, transient, type SynthCtx } from '../synth';
import type { CharacterWeaponSfxMap, WeaponSfxCtx } from './types';

/**
 * The shared "meat" body: the heaviest, most saturated, shortest-decaying pitched
 * layer in the game. `size` 0..1 scales weight; `dur` is deliberately a parameter
 * because damping is about how QUICKLY this dies, not only how low it goes.
 */
function meat(s: SynthCtx, size: number, dur: number, peak: number): number {
  const j = centsJitter(s.rng, 70);
  const body = tone(s, {
    type: 'sine',
    freq: [(170 - size * 55) * j, (52 - size * 16) * j],
    peak,
    attack: 0.003,
    duration: dur,
    // The highest drive on any body in the roster. A 40 Hz fundamental is inaudible
    // on a phone; these harmonics are the entire reason this reads as heavy there.
    drive: 3 + size * 1.2,
    voices: 2,
    detuneCents: 18,
    wet: 0.12,
  });
  const thud = noiseBurst(s, {
    filter: 'lowpass',
    poles: 24,
    freq: [(760 - size * 220) * j, (150 - size * 45) * j],
    q: 1.2,
    // 0.45, not 0.62. Damping is about the ENVELOPE, not about how much noise sits
    // over the body — at 0.62 this layer raised the local spectral floor enough to
    // bury the body's own saturation harmonics, and the hit measured as two partials
    // where its body alone produces six.
    peak: peak * 0.45,
    attack: 0.002,
    duration: dur * 0.7,
    drive: 2.2,
    wet: 0.2,
  });
  return longest(body, thud);
}

export const hamburgerWeaponSfx: CharacterWeaponSfxMap = {
  // ── Patty Smash: 12 dmg melee. The heaviest damped hit in the game. ──────────
  Smash: {
    cast(c: WeaponSfxCtx): number {
      const j = centsJitter(c.rng, 55);
      // A slow, low swing. No air hiss: a patty is not aerodynamic.
      const heave = noiseBurst(c, {
        filter: 'lowpass',
        poles: 24,
        freq: [1300 * j, 420 * j],
        q: 1.6,
        peak: 0.42,
        attack: 0.055,
        hold: 0.1,
        duration: 0.22,
        drive: 1.7,
        wet: 0.22,
      });
      const grunt = tone(c, {
        type: 'sawtooth',
        freq: [180 * j, 92 * j],
        lowpass: [620, 220],
        peak: 0.24,
        attack: 0.03,
        duration: 0.2,
        drive: 2.2,
        voices: 2,
        detuneCents: 20,
        wet: 0.12,
      });
      return longest(heave, grunt);
    },
    impact(c: WeaponSfxCtx): number {
      // The transient is a LOW thump, not a click — `snap` at 620 Hz with the tick
      // corner down at 1.5 kHz. Every other character's transient sits above 2 kHz.
      const tr = transient(c, { peak: 0.44, freq: 1500, snap: 620, snapMs: 22, wet: 0.1 });
      const body = meat(c, 1, 0.24, 0.86);
      return longest(tr, body);
    },
  },

  // ── Tomato Toss: 8 dmg, close, slows. Wet, but a SETTLING splatter. ──────────
  Tomato: {
    cast(c: WeaponSfxCtx): number {
      const j = centsJitter(c.rng, 80);
      const toss = noiseBurst(c, {
        filter: 'lowpass',
        poles: 24,
        freq: [1500 * j, 520 * j],
        q: 2.1,
        peak: 0.36,
        attack: 0.014,
        duration: 0.14,
        drive: 1.6,
        wet: 0.18,
      });
      const push = tone(c, {
        type: 'sine',
        freq: [300 * j, 140 * j],
        peak: 0.16,
        attack: 0.006,
        duration: 0.11,
        drive: 2,
        wet: 0.1,
      });
      return longest(toss, push);
    },
    impact(c: WeaponSfxCtx): number {
      // A wet slap that SETTLES: the burst is short and the low body outlasts it, so
      // the fruit collapses rather than bursting. Soup's splash is the opposite
      // shape — the wet part is the long part there.
      const tr = transient(c, { peak: 0.34, freq: 1900, snap: 780, snapMs: 15, wet: 0.1 });
      const body = meat(c, 0.55, 0.19, 0.62);
      const pulp = noiseBurst(c, {
        filter: 'lowpass',
        poles: 24,
        freq: [1000, 260],
        q: 2.8,
        peak: 0.24,
        attack: 0.008,
        duration: 0.13,
        drive: 1.8,
        wet: 0.26,
      });
      return longest(tr, body, pulp);
    },
  },

  // ── Lettuce Fling: 6 dmg, max range, stuns. Softest hit on the roster. ───────
  Lettuce: {
    cast(c: WeaponSfxCtx): number {
      // A leaf has almost no mass, so this is nearly all air — the quietest cast in
      // the game, and the one place Hamburger is allowed any brightness at all.
      const flap = noiseBurst(c, {
        filter: 'bandpass',
        freq: [900, 2200],
        q: 1.2,
        peak: 0.26,
        attack: 0.03,
        duration: 0.15,
        wet: 0.3,
      });
      return flap;
    },
    impact(c: WeaponSfxCtx): number {
      // The stun is sold by the body going SLACK: a slow downward bend under a damp
      // rustle. No transient worth the name — a leaf does not strike.
      const rustle = noiseBurst(c, {
        filter: 'lowpass',
        poles: 24,
        freq: [1600, 380],
        q: 1.4,
        peak: 0.3,
        attack: 0.006,
        duration: 0.16,
        drive: 1.5,
        wet: 0.3,
      });
      const slack = tone(c, {
        type: 'triangle',
        freq: [240, 96],
        peak: 0.3,
        attack: 0.012,
        hold: 0.2,
        duration: 0.3,
        drive: 2.4,
        voices: 2,
        detuneCents: 22,
        wet: 0.18,
      });
      return longest(rustle, slack);
    },
  },

  // ── Onion Ring: the self-heal. No impact exists to voice. ────────────────────
  // The generic `castSelf` rising triad is the right SHAPE (it is the only
  // unambiguously good sound in the catalogue) but it is bright, and a bright cue
  // from the darkest character in the roster breaks his identity at the one moment
  // he is most exposed. Same gesture, moved down two octaves and thickened.
  Onion: {
    cast(c: WeaponSfxCtx): number {
      const j = centsJitter(c.rng, 20);
      const notes = [174.61, 220, 261.63];
      notes.forEach((f, i) => {
        tone(
          { ...c, when: c.when + i * 0.07 },
          {
            type: 'triangle',
            freq: f * j,
            peak: 0.28,
            attack: 0.016,
            hold: 0.22,
            duration: 0.34,
            drive: 2.2,
            voices: 2,
            detuneCents: 11,
            wet: 0.4,
          },
        );
      });
      const warmth = noiseBurst(c, {
        filter: 'lowpass',
        poles: 24,
        freq: [900, 300],
        q: 1,
        peak: 0.1,
        attack: 0.1,
        duration: 0.45,
        wet: 0.5,
      });
      return longest(0.34 + notes.length * 0.07, warmth);
    },
  },
};
