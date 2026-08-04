/**
 * Egg — the FRACTURE voice, and the only two-stage envelope in the game.
 *
 * Matched to `src/vfx/weapons/egg.ts`, which is unusually explicit about what makes
 * this fighter different: *"Every other converted weapon breaks by SCATTERING... An
 * egg does not scatter first: it FRACTURES, and only then spills."* Its vocabulary is
 * the fracture star, yolk (fat, glossy, viscous, holds a round form), albumen
 * (translucent stretching strands), and down (weightless feathers, Hatch! only). The
 * file also states flatly that it *"draws no vapour of any kind"* — that is Soup's.
 *
 * ── The device: A GAP ───────────────────────────────────────────────────────────
 *
 * Every other impact in this game is one event with layers stacked on the same
 * instant. Egg is TWO events with a hole between them:
 *
 *      [ 0 ms ]  CRACK   — the hardest, shortest transient in the roster
 *      [ 0-45 ms ]       — near silence. This is the whole idea.
 *      [ 45 ms ]  SPILL  — a thick viscous glop with shell ticks in it
 *
 * The gap is what makes a shell read as a shell. A crack and a spill played together
 * is a wet crunch, which is a sound the game already has three of; separated, the ear
 * hears a sequence of two physical events and infers a container failing. It is also
 * trivially measurable — the probe finds the envelope minimum between two maxima and
 * asserts the dip is real (`--mode identity` requires the trough to fall below 45% of
 * both peaks), and no other character in the game satisfies that test.
 *
 * The yolk is why the spill is a LOW-PASSED GLOP and not a splash: yolk is viscous
 * and holds together. Soup owns thin broth that sprays; the separation is in the
 * attack (a splash resonates open, a glop closes) and in the complete absence of
 * anything above 3 kHz in the second stage.
 *
 * Weapon keys (`rules.ts` -> `CHARACTERS.egg.weapons`): `'Tackle'` (16 dmg, melee —
 * she throws herself), `'Hatch'` (5 dmg, homing, `peckHits: 3`), `'Shards'` (4 dmg,
 * 3 pellets, slow).
 */

import {
  centsJitter,
  grainCloud,
  longest,
  noiseBurst,
  rand,
  tone,
  transient,
  type SynthCtx,
} from '../synth';
import type { CharacterWeaponSfxMap, WeaponSfxCtx } from './types';

/**
 * STAGE ONE — the crack. Deliberately the hardest, driest transient in the game:
 * a 0.4 ms attack, nothing below 900 Hz, and over before the gap starts.
 */
function crack(s: SynthCtx, level: number, bright: number): number {
  const j = centsJitter(s.rng, 60);
  const tr = transient(s, {
    peak: level,
    freq: (4200 + bright * 1800) * j,
    snap: (2600 + bright * 900) * j,
    snapMs: 7,
    // Almost dry. Reverb on the crack blurs the gap, and the gap is the point.
    wet: 0.05,
  });
  // The split itself — a very short bright band that opens outward, which is the
  // fracture star running along the shell.
  const split = noiseBurst(s, {
    filter: 'bandpass',
    freq: [(2600 + bright * 800) * j, (5200 + bright * 1600) * j],
    q: 3.4,
    peak: level * 0.8,
    attack: 0.0005,
    duration: 0.022,
    drive: 2.2,
    wet: 0.1,
  });
  return longest(tr, split);
}

/**
 * STAGE TWO — the spill. Viscous, closing, and with a lid on it at ~2.2 kHz: yolk
 * has no spray in it. `size` scales how much there is to come out.
 */
function spill(s: SynthCtx, size: number): number {
  const j = centsJitter(s.rng, 70);
  const glop = noiseBurst(s, {
    filter: 'lowpass',
    poles: 24,
    freq: [(1800 + size * 600) * j, (420 - size * 110) * j],
    // High Q for the cavity, low attack for the viscosity — a glop does not have an
    // edge, which is exactly why it needs the crack in front of it.
    q: 3.6,
    peak: 0.26 + size * 0.18,
    attack: 0.012 + size * 0.01,
    duration: 0.15 + size * 0.12,
    drive: 2,
    wet: 0.24,
  });
  const mass = tone(s, {
    type: 'sine',
    freq: [(180 - size * 45) * j, (58 - size * 16) * j],
    peak: 0.36 + size * 0.3,
    attack: 0.006,
    duration: 0.13 + size * 0.1,
    drive: 3.2,
    voices: 2,
    detuneCents: 16,
    wet: 0.14,
  });
  // Albumen: a few long stretching strands. A slow upward bend on a filtered band —
  // the one stringy gesture in the roster, and what sells `effect: 'slow'`.
  const strands = noiseBurst(s, {
    filter: 'bandpass',
    freq: [700 * j, 1500 * j],
    q: 6,
    peak: 0.12 + size * 0.08,
    attack: 0.03,
    duration: 0.2 + size * 0.14,
    wet: 0.36,
  });
  const bits = grainCloud(s, {
    count: Math.round(4 + size * 4),
    spread: 0.12 + size * 0.06,
    grainMs: [3, 8],
    freq: [3200, 7200],
    q: 7,
    peak: 0.26 + size * 0.14,
    decay: 0.3,
    wet: 0.28,
  });
  return longest(glop, mass, strands, bits);
}

/** The gap, in seconds. See the header — 45 ms is long enough for the ear to
 * resolve two events and short enough that they still belong to one hit. */
const GAP = 0.045;

export const eggWeaponSfx: CharacterWeaponSfxMap = {
  // ── Egg Tackle: 16 dmg melee, she throws HERSELF. Full fracture treatment. ───
  Tackle: {
    cast(c: WeaponSfxCtx): number {
      const j = centsJitter(c.rng, 40);
      // A 2.2 s cooldown means this is a committed, telegraphed move — the cast is
      // a launch, not a flick, and it is the only rising body Egg has.
      const launch = noiseBurst(c, {
        filter: 'bandpass',
        freq: [420 * j, 1900 * j],
        q: 2,
        peak: 0.44,
        attack: 0.07,
        hold: 0.1,
        duration: 0.26,
        drive: 1.6,
        wet: 0.3,
      });
      const push = tone(c, {
        type: 'sine',
        freq: [120 * j, 240 * j],
        peak: 0.28,
        attack: 0.08,
        duration: 0.24,
        drive: 2.4,
        voices: 2,
        detuneCents: 14,
        wet: 0.16,
      });
      return longest(launch, push);
    },
    impact(c: WeaponSfxCtx): number {
      const a = crack(c, 0.88, 0.35);
      const b = spill({ ...c, when: c.when + GAP }, 1);
      return longest(a, GAP + b);
    },
  },

  // ── Hatch!: a CHICK that waddles the whole way there and pecks three times. ──
  Hatch: {
    cast(c: WeaponSfxCtx): number {
      // The hatch itself, then the chick. Nothing else in the game is ALIVE, so the
      // chirp is worth more identity than any amount of texture would be.
      const a = crack(c, 0.5, 0);
      const chirp = tone(
        { ...c, when: c.when + 0.05 },
        {
          type: 'triangle',
          freq: [1500, 2400],
          peak: 0.3,
          attack: 0.006,
          duration: 0.09,
          drive: 2.2,
          wet: 0.32,
        },
      );
      const chirp2 = tone(
        { ...c, when: c.when + 0.15 },
        {
          type: 'triangle',
          freq: [1800, 2700],
          peak: 0.24,
          attack: 0.005,
          duration: 0.07,
          drive: 2.2,
          wet: 0.32,
        },
      );
      return longest(a, 0.05 + chirp, 0.15 + chirp2);
    },
    impact(c: WeaponSfxCtx): number {
      // A PECK: one tiny hard tap and a chirp, three times per cast. Deliberately
      // the smallest impact in the game — it fires every 500 ms and must not tire.
      const tap = transient(c, { peak: 0.4, freq: 5400, snap: 3200, snapMs: 6, wet: 0.1 });
      const beak = tone(c, {
        type: 'triangle',
        freq: [2100, 1250],
        peak: 0.22,
        attack: 0.0015,
        duration: 0.05,
        drive: 2.4,
        wet: 0.2,
      });
      const chirp = tone(
        { ...c, when: c.when + 0.035 },
        {
          type: 'triangle',
          freq: [1700, 2600],
          peak: 0.18,
          attack: 0.005,
          duration: 0.06,
          drive: 2,
          wet: 0.3,
        },
      );
      // Just enough low end that a peck still registers as damage.
      const body = tone(c, {
        type: 'sine',
        freq: [240, 120],
        peak: 0.22,
        attack: 0.002,
        duration: 0.06,
        drive: 2.2,
        wet: 0.1,
      });
      return longest(tap, beak, 0.035 + chirp, body);
    },
  },

  // ── Shell Shards: 4 dmg, 3 pellets, slows. Dry shell, albumen still on it. ───
  Shards: {
    cast(c: WeaponSfxCtx): number {
      const j = centsJitter(c.rng, 80);
      const scatter = noiseBurst(c, {
        filter: 'highpass',
        freq: [1900 * j, 3800 * j],
        q: 1.1,
        peak: 0.32,
        attack: 0.016,
        duration: 0.11,
        wet: 0.26,
      });
      const flecks = grainCloud(c, {
        count: 4,
        spread: 0.08,
        grainMs: [3, 6],
        freq: [3400, 7000],
        q: 8,
        peak: 0.13,
        wet: 0.28,
      });
      return longest(scatter, flecks);
    },
    impact(c: WeaponSfxCtx): number {
      // Three pellets land within a frame or two of each other and the engine's
      // retrigger throttle ducks repeats 2 and 3, so each one is a SMALL version of
      // the same two-stage shape rather than a third of a big one. The gap shortens
      // with the sound: a small shell fails faster.
      const g = GAP * 0.62;
      const a = crack(c, 0.66, 1);
      const b = spill({ ...c, when: c.when + g }, 0.18);
      return longest(a, g + b);
    },
  },
};
