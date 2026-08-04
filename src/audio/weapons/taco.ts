/**
 * Taco — the BRITTLE voice.
 *
 * Matched to `src/vfx/weapons/taco.ts`, whose identity is a hard corn shell coming
 * apart into fragments. The sound design question that matters is not "which EQ is
 * crispy" — it is what the ear actually uses to judge brittleness, and the answer is
 * the DENSITY AND IRREGULARITY OF TRANSIENTS. A single bright noise burst is a
 * cymbal; a dozen tiny irregular clicks in 180 ms is something breaking. No envelope
 * on a single source can fake that, which is why `grainCloud` exists in `synth.ts`
 * and why this file is built almost entirely out of it.
 *
 * The measurable claim, and the numbers it actually produces (mean of 6 renders,
 * energy-weighted spectral centroid): Taco's three impacts sit at **2478 / 2824 /
 * 5114 Hz** against Soup's **1345 / 1741 / 1919 Hz**. The two ranges do not overlap,
 * and the driest weapon here measures **3.8x** brighter than the wettest one there.
 * Two characters at opposite ends of one axis is what proves the system can express
 * identity at all, so both halves of that comparison are asserted in
 * `tools/audio-probe.mjs --mode identity`.
 *
 * The three weapons sit on one scale of how much shell is involved:
 *   `'Filling'` 12 dmg — a heavy filled shell. Meat body under the shatter, which is
 *                         why it is the DARKEST of the three (2478 Hz) despite being
 *                         the biggest — the low body is the filling.
 *   `'Onion'`    7 dmg — lighter, drier, higher, papery. Least body.
 *   `'Double'`  14 + 9  — both at once, staggered by ~55 ms so the combo reads as
 *                         TWO impacts rather than one louder one. That stagger is
 *                         the only thing that makes a combo feel like a combo.
 */

import { centsJitter, grainCloud, longest, noiseBurst, tone, transient, type SynthCtx } from '../synth';
import type { CharacterWeaponSfxMap, WeaponSfxCtx } from './types';

/**
 * The shell breaking. `size` 0..1 scales the number of fragments and how much low
 * body sits under them; `dry` pushes the grains higher and shortens them (Onion is
 * papery, Filling is not).
 */
function shellShatter(s: SynthCtx, size: number, dry: number): number {
  const j = centsJitter(s.rng, 70);
  // The initial CRACK — one hard mid transient. Without it a grain cloud reads as
  // rustling; with it, the cloud becomes the debris of a break that just happened.
  const crack = noiseBurst(s, {
    filter: 'bandpass',
    freq: [3400 * j, 1500 * j],
    q: 1.2,
    peak: 0.55 + size * 0.3,
    attack: 0.0006,
    duration: 0.03,
    drive: 2.2,
    wet: 0.12,
  });
  // A pitched snap under the crack. Added in the depth pass: the crack alone put all
  // of its onset energy above 3 kHz with no peak structure at all, which is the
  // spectral signature of a hiss rather than of something breaking.
  const snap = transient(s, {
    peak: 0.44 + size * 0.2,
    freq: 5200 * j,
    snap: (2900 - size * 500) * j,
    snapMs: 8,
    wet: 0.1,
  });
  const fragments = grainCloud(s, {
    // 8 + 7, down from 9 + 9. Double Toss calls this twice and each grain is four
    // nodes, so the old counts cost 192 nodes for ONE voice against a 20-voice
    // budget — see the node census in `--mode depth`. Brittleness is carried by the
    // irregularity of the grains, not by how many there are.
    count: Math.round(7 + size * 6),
    spread: 0.14 + size * 0.1,
    grainMs: [3, 9 - dry * 3],
    freq: [2700 + dry * 900, 8000 + dry * 2200],
    q: 7,
    peak: 0.34 + size * 0.16,
    decay: 0.28,
    drive: 1.6,
    wet: 0.26,
  });
  // Body, and only as much as the weapon has filling. Onion (`dry` 1) is nearly all
  // shell, so it gets almost none — which is what stops the three weapons from being
  // the same sound at three volumes.
  const body =
    size * (1 - dry) > 0.02
      ? tone(s, {
          type: 'sine',
          freq: [(190 - size * 60) * j, (72 - size * 22) * j],
          peak: 0.24 + size * 0.26,
          attack: 0.002,
          duration: 0.08 + size * 0.1,
          drive: 2.6,
          voices: 2,
          detuneCents: 16,
          wet: 0.14,
        })
      : 0;
  return longest(crack, snap, fragments, body);
}

export const tacoWeaponSfx: CharacterWeaponSfxMap = {
  // ── Filling Toss: 12 dmg, long range. The heavy one. ─────────────────────────
  Filling: {
    cast(c: WeaponSfxCtx): number {
      const j = centsJitter(c.rng, 60);
      // A hefty underarm toss with a few shell flakes coming off it — the throw is
      // already brittle, so the impact is a confirmation rather than a surprise.
      const heave = noiseBurst(c, {
        filter: 'bandpass',
        freq: [700 * j, 1800 * j],
        q: 2,
        peak: 0.44,
        attack: 0.03,
        duration: 0.16,
        drive: 1.6,
        wet: 0.26,
      });
      const flakes = grainCloud(c, { count: 4, spread: 0.1, freq: [3000, 7000], peak: 0.11, q: 8, wet: 0.28 });
      const push = tone(c, {
        type: 'sine',
        freq: [260 * j, 130 * j],
        peak: 0.14,
        duration: 0.1,
        drive: 2,
        wet: 0.12,
      });
      return longest(heave, flakes, push);
    },
    impact(c: WeaponSfxCtx): number {
      return shellShatter(c, 0.75, 0.3);
    },
  },

  // ── Onion Bomb: 7 dmg, mid range. Dry, papery, almost no body. ───────────────
  Onion: {
    cast(c: WeaponSfxCtx): number {
      const j = centsJitter(c.rng, 80);
      const toss = noiseBurst(c, {
        filter: 'highpass',
        freq: [1800 * j, 3400 * j],
        q: 1.1,
        peak: 0.36,
        attack: 0.02,
        duration: 0.12,
        wet: 0.28,
      });
      return toss;
    },
    impact(c: WeaponSfxCtx): number {
      // Papery layers separating: high, short, and with a faint airy puff under it
      // so it does not read as pure clatter.
      const shatter = shellShatter(c, 0.3, 1);
      const puff = noiseBurst(c, {
        filter: 'bandpass',
        freq: [1100, 420],
        q: 1.6,
        peak: 0.26,
        attack: 0.006,
        duration: 0.1,
        drive: 1.7,
        wet: 0.24,
      });
      return longest(shatter, puff);
    },
  },

  // ── Double Toss: the combo. Two impacts, deliberately staggered. ─────────────
  Double: {
    cast(c: WeaponSfxCtx): number {
      const j = centsJitter(c.rng, 50);
      // Two throws, 55 ms apart, the second a little higher — the same interval the
      // impacts use, so the whole ability has one rhythm.
      const a = noiseBurst(c, {
        filter: 'bandpass',
        freq: [640 * j, 1700 * j],
        q: 2,
        peak: 0.44,
        attack: 0.025,
        duration: 0.15,
        drive: 1.6,
        wet: 0.26,
      });
      const b = noiseBurst(
        { ...c, when: c.when + 0.055 },
        {
          filter: 'bandpass',
          freq: [820 * j, 2100 * j],
          q: 2,
          peak: 0.38,
          attack: 0.02,
          duration: 0.13,
          drive: 1.6,
          wet: 0.26,
        },
      );
      const push = tone(c, {
        type: 'sine',
        freq: [240 * j, 118 * j],
        peak: 0.16,
        duration: 0.12,
        drive: 2,
        wet: 0.12,
      });
      return longest(a, 0.055 + b, push);
    },
    impact(c: WeaponSfxCtx): number {
      const first = shellShatter(c, 0.85, 0.1);
      const second = shellShatter({ ...c, when: c.when + 0.055 }, 0.4, 0.85);
      return longest(first, 0.055 + second);
    },
  },
};
