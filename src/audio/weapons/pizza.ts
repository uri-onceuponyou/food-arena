/**
 * Pizza — the SPINNING PLATE voice.
 *
 * Matched to `src/vfx/weapons/pizza.ts`, whose central decision is that every Pizza
 * projectile is a flat plate thrown face-up like a discus, spinning about world +Y
 * so its outline is presented to the camera at every instant of flight. The audio
 * has exactly one job: make that spin audible.
 *
 * ── The device: real amplitude modulation ───────────────────────────────────────
 *
 * A flat object spinning through air chops it, and the ear hears that as a periodic
 * flutter riding on a whoosh. So every Pizza cast here is a bandpass noise sweep with
 * a genuine LFO on its gain (`tremolo` in `synth.ts`) — not an EQ trick, not a
 * shorter envelope. That choice is what makes this voice identifiable in one frame
 * next to Soup's splash and Taco's crackle, and it is directly measurable: the
 * probe demodulates the rendered envelope and asserts a peak in the 12-30 Hz band.
 * If the LFO were ever disconnected the sound would still be a perfectly reasonable
 * whoosh — which is precisely the kind of silent, plausible failure this project
 * keeps paying for, and precisely why it is measured rather than assumed.
 *
 * Measured (mean of 6 renders): modulation depth **0.48-0.55** at **14.9 / 23.7 /
 * 12.9 Hz** for Dough / Tomato / Cheese, against **0.00-0.15** for every control
 * (the generic ranged cast, the generic melee swing, Soup's and Taco's throws) — a
 * 3.3x margin over the largest residual any non-spinning sound produces.
 *
 * The three weapons differ by spin RATE and plate WEIGHT, which is the same axis the
 * VFX file uses to separate them:
 *   `'Dough'`  a hand-tossed base — heavy, 16 Hz spin, dull. Soft on impact.
 *   `'Tomato'` the hero slice — 26 Hz, bright, and the only one that splatters.
 *   `'Cheese'` a floppy sheet — the slowest flutter at 12 Hz, and it FLAPS rather
 *              than cracking, because a sheet of cheese has no rigidity to lose.
 *
 * Spin rates have a measurement floor as well as a taste one: a throw lasting ~0.4 s
 * cannot carry a modulation slower than about 8 Hz (fewer than three cycles fit, and
 * neither an ear nor an FFT can call that a rhythm). Cheese was authored at 9 Hz and
 * measured as an unrelated 47.9 Hz artefact for exactly that reason.
 */

import { centsJitter, longest, noiseBurst, tone } from '../synth';
import type { CharacterWeaponSfxMap, WeaponSfxCtx } from './types';

/**
 * The shared discus release. `spinHz` is the flutter rate, `weight` 0..1 pulls the
 * whole thing lower and slower.
 */
function discusThrow(c: WeaponSfxCtx, spinHz: number, weight: number): number {
  const j = centsJitter(c.rng, 60);
  // Long enough for the flutter to be HEARD as a flutter: at Cheese's slow spin a
  // 0.19 s throw is barely two revolutions, which reads as a wobble, not a spin.
  const duration = 0.38 + weight * 0.12;
  const air = noiseBurst(c, {
    filter: 'bandpass',
    // Rising centre frequency: the plate accelerating out of the hand.
    freq: [(560 - weight * 200) * j, (2200 - weight * 900) * j],
    q: 1.5,
    peak: 1.2,
    attack: 0.035,
    hold: 0.1,
    duration,
    // The spin. Rate climbs slightly as the plate is released, depth is deep enough
    // to be unmistakable without gating the sound into fragments.
    tremolo: { rate: [spinHz * 0.88, spinHz], depth: 0.85 },
  });
  // A short edge "tick" as the rim leaves the hand — the plate is a hard object and
  // needs one hard moment, or the whole voice is soft.
  const edge = noiseBurst(c, {
    filter: 'highpass',
    freq: 3600,
    peak: 0.16,
    attack: 0.0008,
    duration: 0.018,
  });
  return longest(air, edge);
}

export const pizzaWeaponSfx: CharacterWeaponSfxMap = {
  // ── Dough Balls: a hand-tossed base. Heavy, slow spin, and SOFT on landing. ───
  Dough: {
    cast(c: WeaponSfxCtx): number {
      return discusThrow(c, 16, 0.85);
    },
    impact(c: WeaponSfxCtx): number {
      const j = centsJitter(c.rng, 70);
      // Raw dough absorbs its own impact: almost no high content, a fat low body,
      // and a very short tail. Deliberately the dullest impact in the game — it is
      // the counterexample that makes Taco's brittleness read.
      const flop = noiseBurst(c, {
        filter: 'lowpass',
        poles: 24,
        freq: [1100 * j, 190 * j],
        q: 1.1,
        peak: 0.34,
        attack: 0.004,
        duration: 0.13,
      });
      const body = tone(c, {
        type: 'sine',
        freq: [150 * j, 58 * j],
        peak: 0.5,
        attack: 0.003,
        duration: 0.16,
      });
      return longest(flop, body);
    },
  },

  // ── Tomato Splat: the hero slice. Fast spin, and the only wet one. ────────────
  Tomato: {
    cast(c: WeaponSfxCtx): number {
      return discusThrow(c, 26, 0.25);
    },
    impact(c: WeaponSfxCtx): number {
      const j = centsJitter(c.rng, 65);
      // A SLAP, not a splash. Soup owns spreading liquid; a tomato bursting on a
      // surface is one hard wet moment and then it is over. The separation is in the
      // attack time (1 ms here vs 6-20 ms in `soup.ts`) and the length.
      const slap = noiseBurst(c, {
        filter: 'bandpass',
        freq: [2400 * j, 620 * j],
        q: 1.4,
        peak: 0.42,
        attack: 0.001,
        duration: 0.07,
      });
      const pulp = noiseBurst(c, {
        filter: 'lowpass',
        freq: [900, 240],
        q: 2.6,
        peak: 0.24,
        attack: 0.008,
        duration: 0.15,
      });
      const body = tone(c, { type: 'sine', freq: [200 * j, 76 * j], peak: 0.42, duration: 0.12 });
      return longest(slap, pulp, body);
    },
  },

  // ── Cheese Blind: a floppy sheet. It flaps, it does not crack. ────────────────
  Cheese: {
    cast(c: WeaponSfxCtx): number {
      return discusThrow(c, 12, 0.6);
    },
    impact(c: WeaponSfxCtx): number {
      const j = centsJitter(c.rng, 55);
      // Two devices for "rubbery sheet": a low-mid noise flap with a soft attack,
      // and a pitch bend slow enough to be heard AS a bend. Nothing else in the
      // roster bends on impact, which is what sells the stun this weapon applies —
      // the sound goes slack, like the target's vision does.
      const flap = noiseBurst(c, {
        filter: 'bandpass',
        freq: [1400 * j, 480 * j],
        q: 2.2,
        peak: 0.3,
        attack: 0.01,
        duration: 0.2,
      });
      const slack = tone(c, {
        type: 'triangle',
        freq: [300 * j, 110 * j],
        peak: 0.3,
        attack: 0.012,
        hold: 0.25,
        duration: 0.34,
      });
      return longest(flap, slack);
    },
  },
};
