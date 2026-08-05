/**
 * Sushi — the CUT. Bright and NARROW, where Taco is bright and broad.
 *
 * Matched to `src/vfx/weapons/sushi.ts`, which opens with the fact that shapes this
 * whole file: *"Sushi is the WEAKEST SILHOUETTE IN THE CAST... every other weapon set
 * here can afford effects that merely don't clash, and this one has to actively do
 * identity work its character cannot do for itself."* Its four signs are THE CUT (a
 * dead-straight, hard-edged, near-white, COOL blade line), THE ROLL, THE GRAIN (rice
 * that BOUNCES rather than splashing or shattering) and THE SHEET (nori).
 *
 * ── The device: a NARROW resonance, not a wide one ──────────────────────────────
 *
 * Sushi and Taco both sit near the top of the spectral-centroid ladder, and centroid
 * alone would make them the same character. They are separated on a second axis the
 * ear resolves completely independently — SPECTRAL FLATNESS, i.e. tonal versus noisy:
 *
 *   * **Taco** is a cloud of many irregular broadband transients. High centroid, HIGH
 *     flatness. It is noise, and that is what brittle means.
 *   * **Sushi** is a single high-Q resonance sweeping upward and stopping dead. High
 *     centroid, LOW flatness. It is nearly a pitch, and that is what a blade means.
 *
 * `--mode identity` asserts both halves: Sushi's blade must measure narrower (lower
 * flatness) than every Taco impact, while both stay above the brightness floor. Two
 * characters that a one-dimensional measurement would call identical, separated on a
 * dimension a listener actually uses.
 *
 * The blade also does something no other gesture in the roster does: it sweeps UP and
 * then STOPS, with no decay tail at all. Everything else here decays. A cut is the one
 * event that genuinely ends rather than fading, and the abrupt stop is most of why it
 * reads as a cut rather than as a whistle.
 *
 * THE GRAIN is the counterweight. Rice bounces: many tiny DRY ticks with no
 * resonance, no body and almost no reverb send, which keeps Rice Spray (2 damage,
 * 5 pellets, 700 ms cooldown — the most frequently fired weapon in the game) from
 * fatiguing.
 *
 * Weapon keys (`rules.ts` -> `CHARACTERS.sushi.weapons`): `'Rice'` (2 dmg, 5 pellets),
 * `'Seaweed'` (5 dmg, slow), `'Fish'` (6 dmg, melee, 150 degree cone), `'Catch'`
 * (9 dmg, 3 homing — a roll that grows, then is SLICED IN HALF on impact).
 */

import {
  centsJitter,
  grainCloud,
  longest,
  noiseBurst,
  tone,
  transient,
  type SynthCtx,
} from '../synth';
import type { CharacterWeaponSfxMap, WeaponSfxCtx } from './types';

/**
 * THE CUT — a very high-Q band sweeping upward, stopped dead.
 *
 * Q 12 is far outside what any other file here uses (2-7). At that resonance a
 * bandpassed noise stops being noise and becomes an almost-pitch, which is exactly
 * the narrow metallic "shing" a blade makes and exactly what separates this character
 * from Taco's broadband clatter.
 *
 * `curve: 'lin'` on the amplitude is the second half of the trick: a linear fade to
 * zero over a short window has a hard end, where the exponential every other sound in
 * the game uses trails off. A cut does not trail off.
 */
function blade(s: SynthCtx, from: number, to: number, dur: number, level: number): number {
  const j = centsJitter(s.rng, 45);
  const edge = noiseBurst(s, {
    filter: 'bandpass',
    freq: [from * j, to * j],
    q: 12,
    peak: level,
    attack: 0.004,
    duration: dur,
    curve: 'lin',
    freqCurve: 'exp',
    wet: 0.18,
  });
  // A second, quieter, even narrower pass an octave up, slightly late. Two stacked
  // resonances is what gives steel its metallic edge; one alone reads as a whistle.
  const ring = noiseBurst(
    { ...s, when: s.when + dur * 0.16 },
    {
      filter: 'bandpass',
      freq: [from * 2 * j, to * 1.7 * j],
      q: 14,
      peak: level * 0.5,
      attack: 0.002,
      duration: dur * 0.7,
      curve: 'lin',
      wet: 0.22,
    },
  );
  // A THIRD pass, narrower still, at 3.4x — the top of the edge.
  //
  // Sushi's share of the roster-wide top-end pass is deliberately TONAL rather than
  // noisy, and this is why: `--mode identity` separates Sushi from Taco by spectral
  // STRUCTURE (measured partials 2.7 against 1.7), not by brightness, because the two
  // sit on the same rung. Giving Sushi its top octave as another noise scatter would
  // have raised the centroid and spent the one axis that keeps the pair apart. A high-Q
  // resonance up here is what a keen edge actually sounds like anyway — steel is the
  // one material in the roster with real modes above 8 kHz.
  const keen = noiseBurst(
    { ...s, when: s.when + dur * 0.06 },
    {
      filter: 'bandpass',
      freq: [from * 3.4 * j, to * 2.6 * j],
      q: 16,
      peak: level * 0.8,
      attack: 0.0015,
      duration: dur * 0.45,
      curve: 'lin',
      wet: 0.24,
    },
  );
  return longest(edge, dur * 0.16 + ring, dur * 0.06 + keen);
}

/** THE GRAIN — rice. Tiny, dry, plural, and it BOUNCES: no resonance, no body, and
 * the lowest reverb send in the file, so a five-pellet spray stays crisp. */
function rice(s: SynthCtx, count: number, spread: number, level: number): number {
  return grainCloud(s, {
    count,
    spread,
    grainMs: [2, 5],
    // Band top raised 8.2 -> 10.4 kHz in the roster-wide top-end pass. A dry grain of
    // rice bouncing off a hard surface is one of the smallest, hardest events a kitchen
    // produces; the old ceiling was set by what the rest of the game could reach, not by
    // the material. Q stays at 6 (Taco's shards are 7-8) so these still read as bouncing
    // rather than ringing.
    freq: [4200, 12000],
    q: 6,
    peak: level,
    decay: 0.35,
    wet: 0.1,
  });
}

export const sushiWeaponSfx: CharacterWeaponSfxMap = {
  // ── Rice Spray: 2 dmg, 5 pellets, 700 ms. The most-fired weapon in the game. ─
  Rice: {
    cast(c: WeaponSfxCtx): number {
      const puff = noiseBurst(c, {
        filter: 'highpass',
        freq: [2200, 4200],
        q: 1,
        peak: 0.3,
        attack: 0.012,
        duration: 0.09,
        wet: 0.2,
      });
      const grains = rice(c, 7, 0.09, 0.2);
      return longest(puff, grains);
    },
    impact(c: WeaponSfxCtx): number {
      // Deliberately the lightest impact in the roster: a handful of dry ticks and a
      // barely-there body. Five of these land per trigger pull and the throttle ducks
      // repeats 2-5, so the whole spread has to read as texture, not as five hits.
      const grains = rice(c, 6, 0.075, 0.34);
      const tap = transient(c, { peak: 0.3, freq: 5600, snap: 3600, snapMs: 5, wet: 0.08 });
      const body = tone(c, {
        type: 'sine',
        freq: [300, 170],
        peak: 0.16,
        attack: 0.0015,
        duration: 0.05,
        drive: 2,
        wet: 0.1,
      });
      return longest(grains, tap, body);
    },
  },

  // ── Seaweed Bait: 5 dmg, slows. A rippling nori sheet — dry and papery. ─────
  Seaweed: {
    cast(c: WeaponSfxCtx): number {
      const j = centsJitter(c.rng, 60);
      // A sheet thrown flat: a wide airy flutter, no edge to it at all.
      const flutter = noiseBurst(c, {
        filter: 'bandpass',
        freq: [1600 * j, 3400 * j],
        q: 1.8,
        peak: 0.34,
        attack: 0.03,
        duration: 0.18,
        wet: 0.3,
      });
      return flutter;
    },
    impact(c: WeaponSfxCtx): number {
      const j = centsJitter(c.rng, 55);
      // Nori is dry and papery — a rustle with a lid on it and no body underneath,
      // which is what keeps this weapon in Sushi's bright half of the ladder while
      // still being the darkest thing the character does.
      const rustle = grainCloud(c, {
        count: 10,
        spread: 0.16,
        grainMs: [3, 9],
        freq: [2800, 6400],
        q: 4.5,
        peak: 0.28,
        decay: 0.35,
        wet: 0.28,
      });
      // The `slow` cue: a narrow band that sags. Sushi's one downward gesture.
      const sag = noiseBurst(c, {
        filter: 'bandpass',
        freq: [3600 * j, 1600 * j],
        q: 7,
        peak: 0.26,
        attack: 0.012,
        duration: 0.24,
        wet: 0.32,
      });
      const tap = transient(c, { peak: 0.32, freq: 4200, snap: 2400, snapMs: 7, wet: 0.1 });
      const body = tone(c, {
        type: 'sine',
        freq: [280, 150],
        peak: 0.13,
        attack: 0.003,
        duration: 0.06,
        drive: 2,
        wet: 0.12,
      });
      return longest(rustle, sag, tap, body);
    },
  },

  // ── Fish Pile: 6 dmg melee, 150 degree cone. THE CUT, at full length. ───────
  Fish: {
    cast(c: WeaponSfxCtx): number {
      // The draw. A short, quiet, rising narrow band — the blade coming up before it
      // comes down, so the impact lands at the top of a gesture.
      return blade(c, 900, 2600, 0.14, 0.3);
    },
    impact(c: WeaponSfxCtx): number {
      const cut = blade(c, 2600, 8200, 0.17, 0.72);
      // A slab of salmon landing under the cut — soft, wet, brief. This is the ONLY
      // low content in the file, and it is short so the blade stays the identity.
      const slab = noiseBurst(c, {
        filter: 'lowpass',
        poles: 24,
        freq: [1100, 340],
        q: 2.4,
        peak: 0.16,
        attack: 0.006,
        duration: 0.09,
        drive: 1.8,
        wet: 0.24,
      });
      const grains = rice(c, 5, 0.1, 0.2);
      const body = tone(c, {
        type: 'sine',
        freq: [230, 96],
        peak: 0.42,
        attack: 0.0018,
        duration: 0.07,
        drive: 2.4,
        wet: 0.12,
      });
      return longest(cut, slab, grains, body);
    },
  },

  // ── Big Catch: 9 dmg, 3 homing. A roll that grows, then is SLICED IN HALF. ──
  Catch: {
    cast(c: WeaponSfxCtx): number {
      const j = centsJitter(c.rng, 40);
      // The roll growing: a slow swell with the pitch bending UP, which is the only
      // rising body Sushi has and reads as something inflating.
      const grow = tone(c, {
        type: 'sine',
        freq: [140 * j, 300 * j],
        peak: 0.3,
        attack: 0.1,
        duration: 0.3,
        drive: 2.2,
        voices: 2,
        detuneCents: 14,
        wet: 0.24,
      });
      const air = noiseBurst(c, {
        filter: 'bandpass',
        freq: [800 * j, 2400 * j],
        q: 2.2,
        peak: 0.34,
        attack: 0.08,
        duration: 0.28,
        wet: 0.32,
      });
      return longest(grow, air);
    },
    impact(c: WeaponSfxCtx): number {
      // THE SLICE. The blade first and hardest, then the two halves falling apart —
      // rice scattering and one soft thud, in that order, because the cut precedes
      // the consequence. Exactly the order the VFX plays it in.
      const cut = blade(c, 3000, 9000, 0.15, 0.8);
      const halves = noiseBurst(
        { ...c, when: c.when + 0.05 },
        {
          filter: 'lowpass',
          poles: 24,
          freq: [1300, 420],
          q: 2.2,
          peak: 0.2,
          attack: 0.005,
          duration: 0.11,
          drive: 1.9,
          wet: 0.26,
        },
      );
      const grains = rice({ ...c, when: c.when + 0.04 }, 8, 0.16, 0.28);
      const tr = transient(c, { peak: 0.52, freq: 5000, snap: 2800, snapMs: 7, wet: 0.1 });
      const body = tone(c, {
        type: 'sine',
        freq: [220, 80],
        peak: 0.5,
        attack: 0.0018,
        duration: 0.09,
        drive: 2.6,
        voices: 2,
        detuneCents: 14,
        wet: 0.14,
      });
      return longest(cut, 0.05 + halves, 0.04 + grains, tr, body);
    },
  },
};
