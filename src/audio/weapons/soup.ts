/**
 * Soup — the LIQUID voice.
 *
 * Matched to `src/vfx/weapons/soup.ts`, which states the physical identity this file
 * has to agree with: a thrown fluid has no pieces. It stretches and sheds drips in
 * flight, it SPREADS on impact rather than flying apart, it pools, and — the cue
 * nothing else in the roster has — it STEAMS, because this soup is hot.
 *
 * The four sonic devices, in the order they carry the identity:
 *
 * 1. **A low spectral centre.** Every splash here is lowpassed with the cutoff
 *    falling through the sound, so the energy collapses downward the way a mass of
 *    liquid does. Measured (mean of 6 renders, energy-weighted spectral centroid):
 *    Soup's three impacts land at **1345 / 1741 / 1919 Hz**, Taco's at
 *    **2478 / 2824 / 5114 Hz** — two ranges that do not overlap at all, and a 3.8x
 *    separation between the wettest and driest weapon in the two sets. If those ever
 *    converge, the roster has stopped having voices, and
 *    `tools/audio-probe.mjs --mode identity` fails the moment they do.
 *
 * 2. **Upward-chirping droplets** (`droplets()` in `synth.ts`). A sine sweeping UP
 *    while it decays is the canonical drip; sweeping DOWN is a thump. Nothing else in
 *    the game chirps upward, so the drips alone identify Soup even under a pile of
 *    other sounds.
 *
 * 3. **Resonance instead of transient.** A splash has almost no attack — the sound is
 *    the RESONANCE of a cavity filling, so these bursts use a high filter Q and a
 *    soft attack where the generic impact uses a hard click. That single swap is most
 *    of the difference between "wet" and "hit".
 *
 * 4. **A steam tail** — quiet band-limited noise that outlasts the splash. It is the
 *    tail, not the body, so it never masks the hit; it just means the last thing you
 *    hear from a Soup attack is heat. (It is a BAND and not a highpass for a reason
 *    that was measured — see `steam()` below.)
 *
 * Weapon keys (`rules.ts` -> `CHARACTERS.soup.weapons`): `'Splash'` (3 dmg, 3-pellet
 * close spread), `'Noodle'` (5 dmg, long, slow), `'Dump'` (16 dmg, melee heavy, the
 * special).
 */

import {
  centsJitter,
  droplets,
  grainCloud,
  longest,
  noiseBurst,
  rand,
  tone,
  transient,
  type SynthCtx,
} from '../synth';
import type { CharacterWeaponSfxMap, WeaponSfxCtx } from './types';

/** The steam tail. Long, quiet, high — heat, not hiss. */
function steam(s: SynthCtx, level: number, duration: number): number {
  return noiseBurst(s, {
    // BANDPASS, not highpass. A highpass hiss runs all the way to Nyquist, and
    // measured against the splash it is meant to sit under, that pulled Soup's
    // spectral centroid to 6-7 kHz — i.e. the wettest weapon in the game measured
    // as the brightest. Steam is a band, not everything above a corner.
    filter: 'bandpass',
    freq: [2600, 4400],
    q: 0.85,
    peak: level,
    // A slow attack is what stops this reading as a transient. Steam rises.
    attack: duration * 0.35,
    duration,
    // The wettest send in the file. Steam is the part of a Soup hit that is meant to
    // hang in the room after the splash has gone.
    wet: 0.55,
  });
}

/**
 * The shared splash body: a resonant lowpass burst whose cutoff collapses downward.
 * `size` 0..1 scales how big and how low the mass is.
 */
function splashBody(s: SynthCtx, size: number, duration: number, peak: number): number {
  const j = centsJitter(s.rng, 80);
  const open = (2600 - size * 900) * j;
  const close = (420 - size * 200) * j;
  const wet = noiseBurst(s, {
    filter: 'lowpass',
    freq: [open, close],
    // 24 dB/oct. At 12 the three octaves above the cutoff still carry most of the
    // spectral weight and the splash measures BRIGHTER than Taco's shattering shell
    // — see `poles` in `synth.ts`. This is what makes "wet" actually dark.
    poles: 24,
    // High Q is the "cavity" — this is what separates a splash from a noise burst.
    q: 2.4 + size * 2,
    // 0.72 of the layer level, not all of it. A 24 dB/oct resonant splash at full
    // level raises the spectral floor across 200-1700 Hz, which is exactly where the
    // mass's saturation harmonics live — measured, it buried four of the body's six
    // partials and Soup's heaviest hit scored the same as a bare sine plus noise.
    peak: peak * 0.72,
    attack: 0.006 + size * 0.012,
    duration,
    drive: 1.8,
    wet: 0.3,
  });
  // Detuned and saturated, like every body in the game since the depth pass — a
  // splash still needs mass under it, and a bare sine measured as one spectral peak.
  // Drive stays moderate here: heavy saturation puts harmonics in the 300-900 Hz
  // region, which would drag Soup UP the brightness ladder and straight into Water
  // Bottle's rung. Soup being dark is the identity, so this is the one body in the
  // roster whose drive is capped by a measurement rather than by taste.
  const mass = tone(s, {
    type: 'sine',
    freq: [(190 - size * 60) * j, (68 - size * 22) * j],
    peak: peak * (0.85 + size * 0.55),
    attack: 0.005,
    duration: duration * 0.75,
    drive: 2.5,
    voices: 2,
    detuneCents: 16,
    wet: 0.14,
  });
  // A soft, LOW transient. Soup's design says "resonance instead of transient", and
  // that stays true — this has no click in it at all (the snap is at 520 Hz, an
  // octave below anything else in the roster) and exists only so the splash has a
  // moment of onset rather than fading in from nothing.
  const onset = transient(s, {
    peak: 0.22 + size * 0.12,
    freq: 1150,
    snap: 460,
    snapMs: 18,
    wet: 0.12,
  });
  return longest(wet, mass, onset);
}

export const soupWeaponSfx: CharacterWeaponSfxMap = {
  // ── Soup Splash: three small pellets of hot broth, close range ──────────────
  // Fires as three simultaneous projectiles, so the engine's retrigger throttle
  // (`engine.ts`) ducks and shortens repeats 2 and 3 — which is exactly right here:
  // a handful of broth should land as one wet event with texture, not three.
  Splash: {
    cast(c: WeaponSfxCtx): number {
      const j = centsJitter(c.rng, 90);
      // The throw is a "gloop": a short resonant swell with no click at all.
      const gloop = noiseBurst(c, {
        filter: 'bandpass',
        freq: [900 * j, 260 * j],
        q: 3.4,
        peak: 0.46,
        attack: 0.012,
        duration: 0.12,
        drive: 1.8,
        wet: 0.24,
      });
      const drips = droplets(c, { count: 2, spread: 0.07, freq: [620, 980], peak: 0.2, wet: 0.3 });
      return longest(gloop, drips);
    },
    impact(c: WeaponSfxCtx): number {
      const body = splashBody(c, 0.24, 0.2, 0.44);
      const drips = droplets(c, { count: 4, spread: 0.16, freq: [480, 900], peak: 0.14, wet: 0.3 });
      const heat = steam(c, 0.035, 0.34);
      return longest(body, drips, heat);
    },
  },

  // ── Noodle Toss: a long thrown strand. Slappier, with a slurp on the way out ──
  Noodle: {
    cast(c: WeaponSfxCtx): number {
      const j = centsJitter(c.rng, 70);
      const whip = noiseBurst(c, {
        filter: 'bandpass',
        freq: [1500 * j, 520 * j],
        q: 2.2,
        peak: 0.42,
        attack: 0.01,
        duration: 0.16,
        drive: 1.7,
        wet: 0.26,
      });
      // The slurp: a downward bend, opposite to the droplets, so the throw and the
      // splash it becomes are not the same gesture twice.
      const slurp = tone(c, {
        type: 'sine',
        freq: [520 * j, 190 * j],
        peak: 0.16,
        attack: 0.02,
        duration: 0.18,
        drive: 2,
        wet: 0.16,
      });
      return longest(whip, slurp);
    },
    impact(c: WeaponSfxCtx): number {
      // A wet SLAP — a strand landing has a leading edge a splash does not.
      const slap = noiseBurst(c, {
        filter: 'bandpass',
        freq: [1400, 560],
        q: 1.6,
        peak: 0.26,
        attack: 0.0015,
        duration: 0.05,
        drive: 1.8,
        wet: 0.18,
      });
      const body = splashBody(c, 0.35, 0.26, 0.44);
      const drips = droplets(c, { count: 3, spread: 0.2, freq: [440, 820], peak: 0.12, wet: 0.3 });
      const heat = steam(c, 0.04, 0.42);
      return longest(slap, body, drips, heat);
    },
  },

  // ── Soup Dump: 16 damage, the special. Soup tips ITSELF over onto you. ────────
  // The cast is the POUR and it is deliberately the longest cast in this file: the
  // VFX opens a 90° cone of falling liquid, and a pour that is over in 120 ms reads
  // as a throw. Built as a granular cascade of small lowpass bursts rather than one
  // long noise, because a real pour is irregular — that irregularity IS the gurgle.
  Dump: {
    cast(c: WeaponSfxCtx): number {
      const j = centsJitter(c.rng, 40);
      let last = 0;
      const grains = 9;
      for (let i = 0; i < grains; i++) {
        const t = (i / grains) * 0.34 + rand(c.rng, -0.012, 0.012);
        const f = rand(c.rng, 320, 1100) * j;
        const d = rand(c.rng, 0.05, 0.11);
        last = Math.max(last, t + d);
        noiseBurst(
          { ...c, when: c.when + Math.max(0, t) },
          {
            filter: 'lowpass',
            poles: 24,
            freq: [f * 2.2, f * 0.6],
            q: 4.5,
            peak: 0.32,
            attack: 0.008,
            duration: d,
            drive: 1.6,
            wet: 0.28,
          },
        );
      }
      const swell = tone(c, {
        type: 'sine',
        freq: [150 * j, 70 * j],
        peak: 0.3,
        attack: 0.12,
        duration: 0.4,
        drive: 2,
        voices: 2,
        detuneCents: 14,
        wet: 0.2,
      });
      return longest(last, swell);
    },
    impact(c: WeaponSfxCtx): number {
      // The heaviest wet hit in the game. Everything scales up: lower cutoff, more
      // drips, a longer steam tail than any other Soup weapon.
      const body = splashBody(c, 1, 0.42, 0.62);
      const drips = droplets(c, { count: 7, spread: 0.34, freq: [380, 820], peak: 0.16, wet: 0.34 });
      // A few bits of solid — the noodles and vegetables in the broth. Kept sparse
      // and low so this never crosses into Taco's brittle territory.
      const bits = grainCloud(c, { count: 5, spread: 0.26, freq: [600, 1500], peak: 0.1, q: 4, wet: 0.3 });
      const heat = steam(c, 0.075, 0.75);
      return longest(body, drips, bits, heat);
    },
  },
};
