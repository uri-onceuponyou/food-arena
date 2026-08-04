/**
 * Lollipop — the GLASS voice. The only INHARMONIC sound in the game.
 *
 * Matched to `src/vfx/weapons/lollipop.ts`, which owns *"candy stripes wrapped on a
 * body, plus a boundary arc"*, and whose central constraint is stated in capitals:
 * **THE GIANT SLAM TELL MUST BE READABLE WITH THE CASTER OFF SCREEN.** Audio is the
 * one channel that works regardless of framing, which is why `director.ts` routes
 * every `giantSlam` cast to `sounds.ts`'s `castGiantSlam()` centre-panned at full
 * level rather than through this file.
 *
 * ── The split: the CAST carries the weight, the IMPACT carries the identity ─────
 *
 * That routing decision is what makes this file possible. If the ultimate's IMPACT
 * also had to be enormous it would need a huge low body, and a huge low body would
 * drag Lollipop to the bottom of the spectral ladder next to Hamburger — two
 * characters colliding to satisfy one weapon. Because `castGiantSlam()` already
 * delivers the size (a 30 Hz saturated boom, the longest decay in the game), the
 * impact is free to be what a lollipop actually IS: hard candy, which is glass.
 *
 * ── The device: RING MODULATION ────────────────────────────────────────────────
 *
 * Struck glass is INHARMONIC — its partials sit at ratios no harmonic series
 * contains, and that is why glass is instantly recognisable and why no amount of
 * saturation or filtering can imitate it (saturation generates harmonics, which is
 * the opposite of what is wanted). `ring` in `synth.ts` multiplies an oscillator by
 * another and passes only the sum and difference frequencies, which are inharmonic by
 * construction. Nothing else in the roster uses it.
 *
 * Against the two neighbours on the resonant axis:
 *   * **Donut** rings near-harmonically and long — a hoop, "ding".
 *   * **Water Bottle** rings inharmonically but is heavily damped — plastic, "bonk".
 *   * **Lollipop** rings inharmonically AND long — glass, "ting", and it shimmers.
 *
 * Lollipop sits at the TOP of the roster's centroid ladder. Hard candy is the
 * brightest thing anybody in this game is made of.
 *
 * Weapon keys (`rules.ts` -> `CHARACTERS.lollipop.weapons`): `'Smash'` (11 dmg,
 * melee — she swings herself like a hammer), `'Giant'` (10 dmg, 360 degree cone,
 * `giantSlam: true`, stun — the cast is voiced centrally by `castGiantSlam()`).
 */

import {
  centsJitter,
  grainCloud,
  longest,
  modes,
  noiseBurst,
  tone,
  transient,
  type SynthCtx,
} from '../synth';
import type { CharacterWeaponSfxMap, WeaponSfxCtx } from './types';

/**
 * HARD CANDY. A modal bank at glassy stretched ratios, every partial ring-modulated
 * so its own sidebands are inharmonic too.
 *
 * The ring-modulator frequency is deliberately NOT a multiple of the fundamental:
 * a ratio of 1.37 puts the sum and difference partials at 2.37f and 0.37f, neither of
 * which any harmonic series contains, and doing it per-mode means the whole spectrum
 * is dense with intervals that cannot resolve to a pitch. That density is what glass
 * sounds like.
 */
function candy(s: SynthCtx, f0: number, dur: number, peak: number): number {
  const a = modes(s, {
    freq: f0,
    duration: dur,
    peak,
    attack: 0.0008,
    wet: 0.36,
    modes: [
      { ratio: 1, gain: 1, decay: 1 },
      { ratio: 2.76, gain: 0.8, decay: 0.7 },
      { ratio: 5.4, gain: 0.5, decay: 0.44 },
    ],
  });
  // The inharmonic layer, sitting under the modal bank rather than replacing it —
  // ring modulation alone has no fundamental at all and reads as a sound effect, not
  // an object. Together they read as struck candy.
  const b = tone(s, {
    type: 'sine',
    freq: [f0 * 1.02, f0 * 0.92],
    ring: f0 * 1.37,
    peak: peak * 0.7,
    attack: 0.0008,
    duration: dur * 0.8,
    wet: 0.4,
  });
  return longest(a, b);
}

/** SUGAR — a shower of tiny hard bright grains. The stripes coming off. */
function sugar(s: SynthCtx, count: number, spread: number, level: number): number {
  return grainCloud(s, {
    count,
    spread,
    grainMs: [2, 5],
    freq: [5000, 10000],
    q: 11,
    peak: level,
    decay: 0.3,
    wet: 0.3,
  });
}

export const lollipopWeaponSfx: CharacterWeaponSfxMap = {
  // ── Lollipop Smash: 11 dmg melee. She swings HERSELF like a hammer. ─────────
  Smash: {
    cast(c: WeaponSfxCtx): number {
      const j = centsJitter(c.rng, 50);
      // A wide swing with the candy head already singing faintly as it moves — the
      // stick is a handle and the head is the mass, so the pitch is up top.
      const swing = noiseBurst(c, {
        filter: 'bandpass',
        freq: [600 * j, 2400 * j],
        q: 2.4,
        peak: 0.44,
        attack: 0.055,
        hold: 0.1,
        duration: 0.22,
        drive: 1.5,
        wet: 0.3,
      });
      const hum = candy(c, 2400 * j, 0.12, 0.16);
      return longest(swing, hum);
    },
    impact(c: WeaponSfxCtx): number {
      const j = centsJitter(c.rng, 45);
      // The hardest, brightest transient in the roster. Glass on impact is all edge.
      const tr = transient(c, { peak: 0.66, freq: 6400, snap: 4200, snapMs: 6, wet: 0.14 });
      const glass = candy(c, 4400 * j, 0.34, 0.56);
      const shards = sugar(c, 9, 0.2, 0.42);
      // A body small enough not to move the character down the ladder, and saturated
      // enough that 11 damage still lands. This is the tightest constraint in the
      // file and the reason `castGiantSlam()` carrying the weight matters.
      //
      // It is SHORT rather than quiet, which is the whole trick. `--mode depth`
      // measures weight as the low band's PEAK, and the spectral ladder is measured
      // as an energy-weighted centroid — so 70 ms of real low end gives an 11-damage
      // hit something to land on while contributing almost nothing to the energy
      // integral that decides where Lollipop sits. At the first attempt this layer
      // peaked at 18% of the loudest band and the hit measured, correctly, as
      // weightless.
      const body = tone(c, {
        type: 'sine',
        freq: [250 * j, 100 * j],
        peak: 0.62,
        attack: 0.0015,
        duration: 0.12,
        drive: 3,
        wet: 0.12,
      });
      return longest(tr, glass, shards, body);
    },
  },

  // ── Giant Lollipop: the ultimate. Cast is `castGiantSlam()`; this is the hit. ─
  Giant: {
    impact(c: WeaponSfxCtx): number {
      const j = centsJitter(c.rng, 35);
      // Everything Smash does, wider and longer: a bigger candy mass shattering, more
      // sugar, and a shimmer tail that outlasts it. The shimmer is the audio
      // equivalent of the boundary arc sweeping past you — it is the part that is
      // still arriving after the hit has landed, which is the right shape for an
      // ability whose whole design problem is that its source is off screen.
      const tr = transient(c, { peak: 0.72, freq: 5800, snap: 3600, snapMs: 9, wet: 0.16 });
      const glass = candy(c, 3700 * j, 0.5, 0.64);
      const shards = sugar(c, 12, 0.36, 0.46);
      const shimmer = noiseBurst(c, {
        filter: 'bandpass',
        freq: [6000, 9500],
        q: 1.4,
        peak: 0.14,
        attack: 0.06,
        duration: 0.58,
        wet: 0.6,
      });
      const body = tone(c, {
        type: 'sine',
        freq: [230 * j, 78 * j],
        peak: 0.52,
        attack: 0.0025,
        duration: 0.14,
        drive: 3,
        voices: 2,
        detuneCents: 16,
        wet: 0.14,
      });
      return longest(tr, glass, shards, shimmer, body);
    },
  },
};
