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

import { centsJitter, grainCloud, longest, noiseBurst, spray, tone, transient } from '../synth';
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
    drive: 1.5,
    // THE ONE LAYER IN THE GAME WHOSE ROOM IS RATIONED, and for a measured reason.
    //
    // Reverb fills in a tremolo's troughs: the reflections of one peak arrive during
    // the next dip, and a flutter whose dips are filled is not a flutter. At a flat
    // wet 0.26 the probe's demodulator read these discs spinning at depth 0.12-0.24
    // against an authored 0.85 — the LFO was connected, working, and inaudible, which
    // is this project's signature failure wearing a new hat.
    //
    // The send therefore scales INVERSELY with spin rate, which is also the physics:
    // the faster the flutter, the shorter its period, and the less room it can carry
    // before consecutive peaks smear into each other. Cheese (12 Hz) keeps a real
    // room; Tomato (26 Hz) gets under half of it.
    wet: 0.1 * Math.min(1, 16 / spinHz),
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
    wet: 0.1,
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
        drive: 1.8,
        wet: 0.24,
      });
      // A DULL transient: the tick corner is at 1.6 kHz and the snap is low, so raw
      // dough still has an onset without acquiring an edge it should not have. The
      // depth pass added this everywhere; here it had to be added without moving the
      // weapon off its own acceptance bound. That bound is now RELATIVE — `--mode
      // identity` requires Dough to sit below the ladder's geometric centre and at least
      // 2x below every Taco impact — because the old absolute (`< 1400 Hz`) carried a
      // name that was false on the day it was written: `hamburger.Smash` and
      // `pizza.Cheese` were both duller than Dough at that very tuning.
      const tr = transient(c, { peak: 0.34, freq: 1600, snap: 660, snapMs: 18, wet: 0.1 });
      const body = tone(c, {
        type: 'sine',
        freq: [150 * j, 58 * j],
        peak: 0.5,
        attack: 0.003,
        duration: 0.18,
        drive: 2.8,
        voices: 2,
        detuneCents: 18,
        wet: 0.14,
      });
      // A FLOUR PUFF. Dough is the dull end of the roster and stays there, so its
      // share of the roster-wide top-end pass is the softest form brightness can take:
      // a slow-attack band with no discrete matter in it at all, so it reads as a
      // cloud of flour leaving the surface rather than as anything cracking. No
      // grains, no pings, no open highpass — every one of those would put Dough where
      // Cheese and Tomato live.
      const puff = noiseBurst(c, {
        filter: 'bandpass',
        freq: [2500, 1700],
        q: 0.8,
        peak: 0.028,
        attack: 0.012,
        duration: 0.11,
        wet: 0.4,
      });
      return longest(flop, tr, body, puff);
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
        freq: [1350 * j, 400 * j],
        q: 1.4,
        peak: 0.34,
        attack: 0.001,
        duration: 0.07,
        drive: 2,
        wet: 0.2,
      });
      const pulp = noiseBurst(c, {
        filter: 'lowpass',
        poles: 24,
        freq: [900, 240],
        q: 2.6,
        peak: 0.3,
        attack: 0.008,
        duration: 0.15,
        drive: 1.7,
        wet: 0.26,
      });
      const tr = transient(c, { peak: 0.34, freq: 2000, snap: 900, snapMs: 13, wet: 0.1 });
      const body = tone(c, {
        type: 'sine',
        freq: [200 * j, 72 * j],
        peak: 0.62,
        duration: 0.18,
        drive: 3.2,
        voices: 2,
        detuneCents: 16,
        wet: 0.14,
      });
      // ── THE SPLASH. This is the sound Uri asked for, by name. ─────────────
      //
      // *"I would expect a splash sound when I throw a tomato and it hits."* He was
      // right and it was measurable: at the brightest instant of this exact hit the
      // 2-6 kHz band sat 25 dB under the 20-500 Hz band and 6-16 kHz sat 32 dB under,
      // for the whole life of the sound. Everything above is authored below ~2 kHz
      // apart from a 13 ms snap, so the burst a bursting tomato throws off — the fine
      // matter that leaves the surface faster than the pulp does — simply did not
      // exist. A slap with no spray is a slap on a dry board.
      //
      // Deliberately the widest and wettest top layer any of Pizza's three weapons
      // gets: Tomato is the only wet one in the file, Dough gets a flour puff and
      // Cheese gets a sticky peel, so the three stay three sounds rather than one
      // sound at three levels.
      const burst = spray(c, {
        peak: 0.15,
        freq: [8200, 3000],
        duration: 0.085,
        drops: 6,
        wet: 0.34,
      });
      return longest(slap, pulp, tr, body, burst);
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
        drive: 1.6,
        wet: 0.26,
      });
      const slack = tone(c, {
        type: 'triangle',
        freq: [300 * j, 110 * j],
        peak: 0.32,
        attack: 0.012,
        hold: 0.25,
        duration: 0.34,
        drive: 2.4,
        voices: 2,
        detuneCents: 20,
        wet: 0.18,
      });
      const tr = transient(c, { peak: 0.26, freq: 1800, snap: 760, snapMs: 16, wet: 0.1 });
      // A STICKY PEEL. Molten cheese coming off a surface is a few strands letting go
      // one after another, not a burst — so this is a sparse grain cloud whose band
      // walks DOWNWARD as the strands thin out and snap. Same primitive Burrito's
      // ribbon uses, at a third the density and half the window, which is the
      // difference between "unrolling" and "peeling".
      const strands = grainCloud(c, {
        count: 4,
        spread: 0.13,
        grainMs: [6, 16],
        freq: [3200, 5200],
        q: 3.5,
        peak: 0.16,
        decay: 0.35,
        freqShift: [1, 0.62],
        wet: 0.34,
      });
      return longest(flap, slack, tr, strands);
    },
  },
};
