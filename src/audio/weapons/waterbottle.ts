/**
 * Water Bottle — the HOLLOW voice.
 *
 * Matched to `src/vfx/weapons/waterbottle.ts`, whose converted weapon (Glass Shards)
 * is described there as the deliberate opposite of Hamburger's Tomato: *"hard,
 * angular, brittle shards that shatter"*, drawn as stretched octahedron slivers with
 * bright glints. The rest of the fighter is a plastic bottle full of cold water.
 *
 * ── The axis: A RESONANT CAVITY ─────────────────────────────────────────────────
 *
 * A bottle is the only object in this roster that is HOLLOW, and hollowness has a
 * completely specific sound: a small number of strongly-damped resonant modes at
 * non-integer ratios. That is `modes()` in `synth.ts`, and it is the device this
 * character owns.
 *
 * The distinction that matters most is against the two other characters that could
 * be called "bright and hard", because a roster where three fighters are all
 * "shattery" has not solved anything:
 *
 *   * **vs Taco** — Taco is a CLOUD of many irregular transients (broadband, high
 *     spectral flatness). Water Bottle is a FEW discrete pitched modes (low flatness).
 *     Same rough brightness, opposite spectral structure, and the ear resolves those
 *     independently.
 *   * **vs Lollipop** — Lollipop's hard candy is glass: long, ringing, and made
 *     inharmonic by RING MODULATION. Water Bottle's shell is plastic: the same modal
 *     idea heavily DAMPED, so it goes "bonk" where Lollipop goes "ting". The decay
 *     length is the separator, and it is measured.
 *   * **vs Soup** — both have water. Soup's is HOT: low, thick, and it steams. Water
 *     Bottle's is COLD: thin, bright, and there is not one vapour layer in this file.
 *
 * Weapon keys (`rules.ts` -> `CHARACTERS.waterbottle.weapons`): `'Spray'` (3 dmg,
 * 3 pellets, slow), `'Glass'` (7 dmg, stun), `'Cap'` (6 dmg, long, slow),
 * `'Mega'` (18 dmg, melee — the biggest single hit in the game).
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
 * THE BOTTLE — a squat, strongly damped modal bank.
 *
 * The ratios are deliberately irrational and closely spaced. A hollow plastic vessel
 * is not a tube (integer ratios) and not a bell (widely spaced ones); it is a
 * short cavity whose first few modes crowd together, which is why "bonk" is a
 * recognisable sound and not just a low note.
 *
 * Every mode decays FASTER than the fundamental (`decay` < 1 throughout). Plastic
 * has almost no Q — that short decay is the whole difference between this and
 * Lollipop's candy, which uses the same primitive with the opposite settings.
 */
function bottle(s: SynthCtx, f0: number, dur: number, peak: number): number {
  return modes(s, {
    freq: f0,
    duration: dur,
    peak,
    attack: 0.001,
    drive: 1.8,
    wet: 0.22,
    modes: [
      { ratio: 1, gain: 1, decay: 1 },
      { ratio: 2.43, gain: 0.78, decay: 0.55 },
      { ratio: 3.71, gain: 0.5, decay: 0.34 },
      { ratio: 5.86, gain: 0.3, decay: 0.2 },
    ],
  });
}

/** Cold water: thin, bright, and — unlike Soup — with no low mass under it at all. */
function coldWater(s: SynthCtx, level: number, dur: number): number {
  const spray = noiseBurst(s, {
    filter: 'bandpass',
    // Centre well above Soup's, and it sweeps UP rather than collapsing downward.
    // Soup's whole device is energy falling; this is energy dispersing.
    freq: [1300, 2800],
    q: 1.5,
    peak: level,
    attack: 0.004,
    duration: dur,
    wet: 0.34,
  });
  const beads = grainCloud(s, {
    count: 6,
    spread: dur * 0.7,
    grainMs: [3, 7],
    freq: [2400, 5200],
    q: 8,
    peak: level * 0.42,
    decay: 0.3,
    wet: 0.3,
  });
  return longest(spray, beads);
}

export const waterbottleWeaponSfx: CharacterWeaponSfxMap = {
  // ── Water Spray: 3 dmg, 3 pellets, slows. The thinnest hit in the game. ──────
  Spray: {
    cast(c: WeaponSfxCtx): number {
      const hiss = noiseBurst(c, {
        filter: 'bandpass',
        freq: [900, 2800],
        q: 1.1,
        peak: 0.34,
        attack: 0.02,
        duration: 0.14,
        wet: 0.28,
      });
      // The squeeze of a plastic bottle — a short low mode, so even the spray has
      // the vessel in it.
      const flex = bottle(c, 190, 0.06, 0.2);
      return longest(hiss, flex);
    },
    impact(c: WeaponSfxCtx): number {
      const tr = transient(c, { peak: 0.28, freq: 4200, snap: 2500, snapMs: 8, wet: 0.12 });
      const water = coldWater(c, 0.34, 0.16);
      // Barely any body at all. This is a 3-damage tick and it must not feel like
      // a hit — the low end is what `impact()` uses to say "that mattered".
      const body = tone(c, {
        type: 'sine',
        freq: [260, 120],
        peak: 0.3,
        attack: 0.002,
        duration: 0.09,
        drive: 2,
        wet: 0.12,
      });
      return longest(tr, water, body);
    },
  },

  // ── Glass Shards: 7 dmg, stuns. Hard, angular, faceted — see the VFX file. ───
  Glass: {
    cast(c: WeaponSfxCtx): number {
      const j = centsJitter(c.rng, 70);
      const throwOut = noiseBurst(c, {
        filter: 'highpass',
        freq: [1600 * j, 3600 * j],
        q: 1.2,
        peak: 0.36,
        attack: 0.018,
        duration: 0.13,
        wet: 0.26,
      });
      const glint = grainCloud(c, {
        count: 3,
        spread: 0.07,
        grainMs: [3, 7],
        freq: [4200, 8000],
        q: 9,
        peak: 0.14,
        wet: 0.3,
      });
      return longest(throwOut, glint);
    },
    impact(c: WeaponSfxCtx): number {
      // The crack, then the shell ringing, then the pieces. The ring is what makes
      // this a VESSEL breaking rather than generic brittleness — Taco has the
      // fragments but nothing to resonate.
      const tr = transient(c, { peak: 0.62, freq: 4600, snap: 3400, snapMs: 9, wet: 0.14 });
      const shell = bottle(c, 460, 0.13, 0.42);
      const shards = grainCloud(c, {
        count: 9,
        spread: 0.15,
        grainMs: [3, 8],
        freq: [3000, 7600],
        q: 8,
        peak: 0.3,
        decay: 0.25,
        wet: 0.32,
      });
      return longest(tr, shell, shards);
    },
  },

  // ── Cap Shot: 6 dmg, long, slows. The purest BONK in the game. ──────────────
  Cap: {
    cast(c: WeaponSfxCtx): number {
      // A cap popping off: one short pitched pop with a click on it, and nothing
      // else. The shortest cast in the roster.
      const pop = tone(c, {
        type: 'sine',
        freq: [520, 900],
        peak: 0.4,
        attack: 0.001,
        duration: 0.05,
        drive: 2.6,
        wet: 0.2,
      });
      const tick = transient(c, { peak: 0.3, freq: 4000, snap: 2400, snapMs: 6, wet: 0.12 });
      return longest(pop, tick);
    },
    impact(c: WeaponSfxCtx): number {
      const tr = transient(c, { peak: 0.52, freq: 3800, snap: 2300, snapMs: 9, wet: 0.12 });
      // A lower, longer bottle than Glass uses: this is the vessel being struck
      // rather than broken, so the fundamental rings and the upper modes do not.
      const bonk = bottle(c, 560, 0.2, 0.7);
      const body = tone(c, {
        type: 'sine',
        freq: [150, 68],
        peak: 0.17,
        attack: 0.003,
        duration: 0.11,
        drive: 2.4,
        wet: 0.12,
      });
      return longest(tr, bonk, body);
    },
  },

  // ── Mega Splash: 18 dmg melee — the single biggest hit in the game. ─────────
  Mega: {
    cast(c: WeaponSfxCtx): number {
      const j = centsJitter(c.rng, 35);
      // The wind-up: the bottle inverting. A long rising hiss and a low mode
      // sliding UP, which is the only upward-bending body in the roster and reads
      // as something being lifted.
      const lift = noiseBurst(c, {
        filter: 'bandpass',
        freq: [500 * j, 2600 * j],
        q: 1.8,
        peak: 0.44,
        attack: 0.1,
        hold: 0.08,
        duration: 0.34,
        drive: 1.5,
        wet: 0.34,
      });
      const swell = tone(c, {
        type: 'sine',
        freq: [90 * j, 200 * j],
        peak: 0.34,
        attack: 0.12,
        duration: 0.36,
        drive: 2.4,
        voices: 2,
        detuneCents: 14,
        wet: 0.2,
      });
      return longest(lift, swell);
    },
    impact(c: WeaponSfxCtx): number {
      const tr = transient(c, { peak: 0.58, freq: 3000, snap: 1500, snapMs: 16, wet: 0.12 });
      // A wall of cold water. Bright and dispersing, where Soup's Dump at 16 damage
      // is dark and collapsing — the two heaviest wet hits in the game, and they are
      // measurably at opposite ends of the ladder rather than being the same sound.
      const wall = coldWater(c, 0.56, 0.42);
      const shell = bottle(c, 380, 0.24, 0.56);
      const body = tone(c, {
        type: 'sine',
        freq: [140, 46],
        peak: 0.62,
        attack: 0.003,
        duration: 0.3,
        drive: 3.2,
        voices: 2,
        detuneCents: 18,
        wet: 0.16,
      });
      return longest(tr, wall, shell, body);
    },
  },
};
