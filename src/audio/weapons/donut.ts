/**
 * Donut — the RING voice. The only sound in the game that rings.
 *
 * Matched to `src/vfx/weapons/donut.ts`, whose identity is stated as: *"Donut is the
 * only weapon in the roster whose form has a HOLE in it, so the hole is the whole
 * design"* — a glazed ring flying face-up, a chain of fading ring echoes behind it,
 * breaking into CURVED ARC fragments, never straight shards or round blobs. Plus
 * sprinkles, which that file calls *"the single most recognisable thing about a
 * donut"* and uses as the identity carrier on the impact scatter.
 *
 * ── The device: MODAL RESONANCE with a long decay ───────────────────────────────
 *
 * A ring is a closed loop, and a closed loop is the one geometry that rings — a
 * struck hoop sustains, where a plate, a shard or a blob dies immediately. So Donut
 * is the roster's only RESONANT character, and the measurement that separates her is
 * not brightness but DECAY LENGTH: her impact's -66 dBFS extent is the longest of any
 * non-ultimate weapon in the game, at a spectral centroid where everything else is
 * over in under 150 ms.
 *
 * The mode ratios are near-harmonic but stretched (1, 2.06, 3.18, 4.34). A real
 * circular ring's modes are close to integer multiples and slightly sharp, and that
 * slight stretch is audibly the difference between a hoop and an organ pipe. Compare:
 *
 *   * **Water Bottle** uses the same primitive with crowded irrational ratios and
 *     decays of 0.2-0.55 — a cavity, heavily damped, "bonk".
 *   * **Lollipop** uses ring MODULATION on top for genuinely inharmonic sidebands —
 *     glass, "ting".
 *   * **Donut** is near-harmonic and long — a hoop, "ding".
 *
 * The SPRINKLES are the second layer and they do the same job the VFX gives them:
 * they break the symmetry. Six tiny hard ticks scattered across the ring's decay,
 * bright and dry, so the sustain has grit on it and does not read as a synthesiser
 * pad.
 *
 * The ECHO is the third. `donut.ts` draws "a chain of fading ring echoes behind it";
 * this schedules two quieter repeats of the ring at 90 and 175 ms, detuned upward.
 * Nothing else in the game repeats itself, and it costs six oscillators.
 *
 * Weapon keys (`rules.ts` -> `CHARACTERS.donut.weapons`): `'Candy'` (4 dmg, long,
 * 3 pellets at 14 degrees, `trailBoosted`). One weapon, so this voice carries the
 * whole character.
 */

import {
  centsJitter,
  glint,
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
 * THE RING. Near-harmonic, stretched, and long. `decay` values are all close to 1
 * on purpose — a hoop's upper modes are only slightly more damped than its
 * fundamental, which is precisely why a ring SUSTAINS instead of thudding.
 */
function ring(s: SynthCtx, f0: number, dur: number, peak: number): number {
  return modes(s, {
    freq: f0,
    duration: dur,
    peak,
    attack: 0.0012,
    // Light drive only. Heavy saturation would fill the gaps between the modes and
    // turn a ring into a buzz; the whole point here is that the partials are
    // separable by ear.
    drive: 1.4,
    wet: 0.34,
    modes: [
      { ratio: 1, gain: 1, decay: 1 },
      // Upper-mode gains raised 0.72/0.46/0.26 -> 0.82/0.60/0.40 in the roster-wide
      // top-end pass. This is the musical form of Donut's brightening and the reason it
      // is not simply more sprinkles: a hoop's timbre IS its mode balance, so a thinner,
      // harder ring is a different object rather than the same object with dust on it.
      // The decays are untouched, because DECAY LENGTH is what separates this character
      // from Lollipop and Water Bottle and is asserted directly.
      { ratio: 2.06, gain: 0.82, decay: 0.82 },
      { ratio: 3.18, gain: 0.6, decay: 0.6 },
      { ratio: 4.34, gain: 0.4, decay: 0.42 },
      // A FIFTH mode. Donut and Taco were the closest pair left after the roster-wide
      // pass (1.041x against a 1.08x floor) and the two are separated by KIND — Taco is
      // a noise cloud, Donut is modal — so the separation had to be bought with more
      // MODE rather than with more noise, or the axis that tells them apart would have
      // been spent buying the distance that hides them.
      { ratio: 5.52, gain: 0.3, decay: 0.3 },
    ],
  });
}

/** SPRINKLES — tiny hard bright ticks scattered over the ring's decay. Dry, so they
 * stay separate from the ring rather than dissolving into its tail. Band top raised
 * 9 kHz -> 12 kHz in the roster-wide top-end pass; a sprinkle is a grain of sugar and
 * has nothing in it below the top two octaves. */
function sprinkles(s: SynthCtx, spread: number, level: number): number {
  return grainCloud(s, {
    count: 7,
    spread,
    grainMs: [2, 5],
    freq: [4200, 12000],
    q: 10,
    peak: level,
    decay: 0.3,
    wet: 0.12,
  });
}

/**
 * THE GLAZE — sugar crystal, and the one part of this character that is not modal.
 *
 * Donut and Sushi are the closest pair on the whole roster ladder (1.096x, against a
 * 1.08x floor) and the roster-wide top-end pass had to separate them further rather
 * than bringing them together, so the two got DIFFERENT top-end devices on purpose:
 * Sushi's is a noise scatter of dry grains, Donut's is PITCHED. `glint()` was added to
 * `synth.ts` for exactly this — hard crystalline matter is identified by discrete
 * pitch, not by level in a band, and a level difference would not have held the two
 * apart under a re-tune.
 *
 * It rises (`bend` above 1) where every other glint in the game falls. A sugar shell
 * cracking off a hot glaze tightens; broken glass and plastic settle.
 */
function glaze(s: SynthCtx, spread: number, level: number): number {
  return glint(s, {
    count: 4,
    spread,
    freq: [5000, 12500],
    peak: level,
    pingMs: [5, 13],
    bend: 1.08,
    wet: 0.2,
  });
}

export const donutWeaponSfx: CharacterWeaponSfxMap = {
  // ── Candy Barrage: 4 dmg, 3 pellets. Donut's only weapon. ───────────────────
  Candy: {
    cast(c: WeaponSfxCtx): number {
      const j = centsJitter(c.rng, 70);
      // The throw is a quoit release: a short airy sweep with the hoop already
      // starting to ring as it leaves the hand. Short, because it fires every
      // 900 ms and the IMPACT is where this character's identity lives.
      const air = noiseBurst(c, {
        filter: 'bandpass',
        freq: [1400 * j, 3200 * j],
        q: 2,
        peak: 0.34,
        attack: 0.022,
        duration: 0.13,
        wet: 0.28,
      });
      const pre = ring(c, 1900 * j, 0.11, 0.2);
      const dust = sprinkles(c, 0.07, 0.1);
      return longest(air, pre, dust);
    },
    impact(c: WeaponSfxCtx): number {
      const j = centsJitter(c.rng, 60);
      // A bright, small strike. The transient is glassy rather than meaty — this is
      // a hard glazed surface being hit, and 4 damage should not feel like a truck.
      const tr = transient(c, { peak: 0.5, freq: 5400, snap: 3200, snapMs: 8, wet: 0.12 });
      // The ring itself: the longest pitched decay of any non-ultimate weapon.
      const hoop = ring(c, 2450 * j, 0.4, 0.56);
      const dust = sprinkles(c, 0.22, 0.9);
      const sugar = glaze(c, 0.16, 0.74);
      // TWO ECHOES, detuned upward. The VFX draws a chain of fading ring echoes; this
      // is that chain. Each is quieter, shorter and slightly sharper, which is what a
      // hoop that is still bouncing actually does.
      const e1 = ring({ ...c, when: c.when + 0.09 }, 2450 * j * 1.02, 0.26, 0.22);
      const e2 = ring({ ...c, when: c.when + 0.175 }, 2450 * j * 1.045, 0.17, 0.11);
      // Just enough low end to register as damage, and no more — a body any bigger
      // would swamp the modes, which are the entire character. SHORT rather than
      // quiet: 55 ms of real weight barely registers in the energy-weighted centroid
      // that fixes Donut's place on the ladder, while still giving the hit something
      // to land on. At peak 0.13 it measured as no low layer at all.
      const body = tone(c, {
        type: 'sine',
        freq: [280 * j, 130 * j],
        peak: 0.42,
        attack: 0.0018,
        duration: 0.1,
        drive: 3.2,
        wet: 0.12,
      });
      return longest(tr, hoop, dust, sugar, 0.09 + e1, 0.175 + e2, body);
    },
  },
};
