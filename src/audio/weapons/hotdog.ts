/**
 * Hot Dog — the SQUEEZED voice, plus the only CLAP in the game.
 *
 * Matched to `src/vfx/weapons/hotdog.ts`, which states the identity in one line:
 * *"POLYLINES. A condiment squeezed out of a bottle: a constant-width ribbon with
 * hard corners, straight runs and blunt caps. Plus the split bun — two hinged
 * troughs that CLAP."* Nothing else in the roster draws a line with corners in it,
 * and nothing else in the roster claps.
 *
 * ── The two devices, and why neither is an EQ setting ───────────────────────────
 *
 * 1. **A NON-MONOTONIC PITCH CONTOUR.** Every other pitched gesture in this game
 *    moves one way: impacts sweep down (weight), Soup's droplets sweep up (drips),
 *    Sushi's blade sweeps up (the cut). A condiment forced through a nozzle does
 *    something none of them do — the pitch rises as the pressure builds and falls
 *    again as the bottle empties. Two overlapping resonant sweeps in opposite
 *    directions is the whole trick, it is unmistakable next to anything else here,
 *    and it is directly measurable: `--mode identity` tracks the resonance early,
 *    mid and late and asserts mid > early AND mid > late, which NO other cast in the
 *    game satisfies.
 *
 * 2. **THE CLAP.** Bun Slash is two hard transients 26 ms apart. That interval is
 *    chosen and not arbitrary: below ~15 ms two clicks fuse into one thicker click,
 *    above ~50 ms they read as two separate hits and the weapon stops feeling like a
 *    single strike. 26 ms is comfortably inside the window where the ear hears ONE
 *    event with a doubled attack, which is exactly what two bun halves meeting is.
 *    Taco's Double Toss uses a 55 ms stagger for the opposite reason — that one is
 *    MEANT to read as two impacts.
 *
 * Hot Dog sits second-lowest on the roster's spectral-centroid ladder, just above
 * Hamburger: condiments are thick and gluey, and a bun is soft. He is the low-mid
 * character, where Hamburger is the low one.
 *
 * Weapon keys (`rules.ts` -> `CHARACTERS.hotdog.weapons`): `'Mustard'` (7 dmg,
 * long), `'Ketchup'` (5 dmg, mid, slow), `'Slash'` (11 dmg, melee).
 */

import { centsJitter, grainCloud, longest, noiseBurst, tone, transient, type SynthCtx } from '../synth';
import type { CharacterWeaponSfxMap, WeaponSfxCtx } from './types';

/**
 * THE SQUEEZE — the signature gesture. A high-Q resonance whose centre rises through
 * the first half and falls through the second, built as two overlapping bursts
 * because `applyRamp` in `synth.ts` is deliberately a two-point ramp and a third
 * point is not worth an API for one caller.
 *
 * `f0` is where it starts and ends, `top` is the peak of the arc, `thick` 0..1 pulls
 * the whole thing lower and slower (ketchup is thicker than mustard).
 */
function squeeze(s: SynthCtx, f0: number, top: number, thick: number, level: number): number {
  const j = centsJitter(s.rng, 60);
  const rise = 0.075 + thick * 0.045;
  const fall = 0.1 + thick * 0.06;
  const up = noiseBurst(s, {
    filter: 'bandpass',
    freq: [f0 * j, top * j],
    // High Q is what makes this a SQUEAL rather than a swept hiss. A condiment
    // nozzle is a narrow aperture and narrow apertures resonate.
    q: 5.5,
    peak: level,
    attack: 0.012,
    duration: rise,
    drive: 1.8,
    wet: 0.2,
  });
  const down = noiseBurst(
    { ...s, when: s.when + rise * 0.82 },
    {
      filter: 'bandpass',
      freq: [top * j, f0 * 0.72 * j],
      q: 5.5,
      peak: level * 0.9,
      attack: 0.008,
      duration: fall,
      drive: 1.8,
      wet: 0.24,
    },
  );
  // A pitched gulp riding the same arc, so the contour is present in the harmonic
  // content too and not only in the noise band.
  const gulp = tone(s, {
    type: 'triangle',
    freq: [f0 * 0.34 * j, top * 0.3 * j],
    peak: level * 0.5,
    attack: 0.014,
    duration: rise + fall * 0.6,
    drive: 2.4,
    voices: 2,
    detuneCents: 16,
    wet: 0.14,
  });
  return longest(up, rise * 0.82 + down, gulp);
}

/** A condiment landing: a gluey slap with a fat low-mid body under it. */
function condimentSplat(s: SynthCtx, size: number, bright: number): number {
  const j = centsJitter(s.rng, 70);
  const tr = transient(s, {
    peak: 0.3 + size * 0.1,
    freq: 1700 + bright * 700,
    snap: 700 + bright * 320,
    snapMs: 16,
    wet: 0.1,
  });
  const goo = noiseBurst(s, {
    filter: 'lowpass',
    poles: 24,
    freq: [(1400 + bright * 600) * j, (280 + bright * 120) * j],
    q: 3.2,
    peak: 0.42 + size * 0.2,
    attack: 0.005,
    duration: 0.15 + size * 0.07,
    drive: 2,
    wet: 0.26,
  });
  const body = tone(s, {
    type: 'sine',
    freq: [(210 - size * 50) * j, (66 - size * 18) * j],
    peak: 0.6 + size * 0.34,
    attack: 0.0025,
    duration: 0.16 + size * 0.14,
    drive: 2.6,
    voices: 2,
    detuneCents: 15,
    wet: 0.14,
  });
  // THE SQUIRT — the fine jet that leaves a condiment bottle ahead of the slug.
  //
  // Hotdog's device is the SQUEEZE, and until this pass the squeeze existed only in the
  // cast (a non-monotonic pitch contour) while the landing was pure low-mid goo. A
  // squeezed jet atomises: the thin stuff arrives first, high and short, and the fat
  // stuff follows. That gives the impact the same physical story the cast already tells
  // and puts Hotdog's share of the roster's top three octaves somewhere it belongs.
  //
  // `bright` is the mustard/ketchup axis and it drives the BAND, not just the level:
  // mustard is thin and sprays, ketchup is thick and barely does.
  const jet = noiseBurst(s, {
    filter: 'bandpass',
    freq: [(4200 + bright * 2200) * j, (2100 + bright * 900) * j],
    q: 0.75,
    peak: 0.23 + bright * 0.06,
    attack: 0.0015,
    duration: 0.05 + bright * 0.03,
    wet: 0.34,
  });
  return longest(tr, goo, body, jet);
}

export const hotdogWeaponSfx: CharacterWeaponSfxMap = {
  // ── Mustard Blast: 7 dmg, long range. The thin, bright condiment. ────────────
  Mustard: {
    cast(c: WeaponSfxCtx): number {
      return squeeze(c, 520, 1250, 0.15, 0.44);
    },
    impact(c: WeaponSfxCtx): number {
      return condimentSplat(c, 0.42, 1);
    },
  },

  // ── Ketchup Slip: 5 dmg, slows. Thicker, slower, lower — a fat wobbling slug. ─
  Ketchup: {
    cast(c: WeaponSfxCtx): number {
      return squeeze(c, 340, 780, 1, 0.42);
    },
    impact(c: WeaponSfxCtx): number {
      // The `slow` effect is sold by a slick: a long, low, almost pitchless smear
      // after the splat, which is the one part of this file that is allowed to
      // outlast its own transient by a wide margin.
      const splat = condimentSplat(c, 0.3, 0);
      const slick = noiseBurst(c, {
        filter: 'lowpass',
        poles: 24,
        freq: [640, 200],
        q: 4,
        peak: 0.2,
        attack: 0.04,
        duration: 0.34,
        drive: 1.6,
        wet: 0.4,
      });
      return longest(splat, slick);
    },
  },

  // ── Bun Slash: 11 dmg, melee. THE CLAP. ─────────────────────────────────────
  Slash: {
    cast(c: WeaponSfxCtx): number {
      const j = centsJitter(c.rng, 50);
      // The bun opening — a short airy suck before it comes down. Rising, so the
      // clap that follows lands on the top of a gesture rather than out of nowhere.
      const open = noiseBurst(c, {
        filter: 'bandpass',
        freq: [700 * j, 2300 * j],
        q: 2,
        peak: 0.38,
        attack: 0.05,
        hold: 0.1,
        duration: 0.19,
        drive: 1.5,
        wet: 0.26,
      });
      return open;
    },
    impact(c: WeaponSfxCtx): number {
      const j = centsJitter(c.rng, 45);
      // TWO transients, 26 ms apart. See the header for why that interval and not
      // another: this must read as one strike with a doubled attack, never as two.
      const GAP = 0.026;
      const half = (at: number, level: number, f: number): number =>
        transient({ ...c, when: c.when + at }, { peak: level, freq: f, snap: f * 0.3, snapMs: 20, wet: 0.12 });
      // Bread, not glass: the tick corners sit at 1.4/1.2 kHz, an octave and a half
      // below any other transient in the roster except Hamburger's.
      const a = half(0, 0.5, 1400);
      const b = half(GAP, 0.4, 1200);
      // Bread is a soft absorber, so the body under a bun clap is short and woody
      // rather than resonant — this is the one hit in the file with no goo in it.
      const wood = noiseBurst(c, {
        filter: 'bandpass',
        freq: [900 * j, 340 * j],
        q: 2.4,
        peak: 0.34,
        attack: 0.0015,
        duration: 0.12,
        drive: 2.1,
        wet: 0.24,
      });
      const body = tone(c, {
        type: 'sine',
        freq: [200 * j, 58 * j],
        peak: 0.95,
        attack: 0.002,
        duration: 0.24,
        drive: 3,
        voices: 2,
        detuneCents: 17,
        wet: 0.14,
      });
      // CRUMBS. A bun clapping shut throws off dry crumb, and dry crumb is discrete
      // matter — so this is grains rather than the jet the two condiments get, which
      // keeps the melee weapon audibly a different event from the two ranged ones
      // inside one character's voice. Sparse and short: bread is still a soft absorber
      // and this must not turn the clap brittle.
      const crumbs = grainCloud(c, {
        count: 5,
        spread: 0.075,
        grainMs: [3, 9],
        freq: [3000, 6400],
        q: 4,
        peak: 0.38,
        decay: 0.3,
        wet: 0.3,
      });
      return longest(a, GAP + b, wood, body, crumbs);
    },
  },
};
