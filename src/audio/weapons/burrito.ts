/**
 * Burrito — the PAPER voice: a crinkle whose band WALKS.
 *
 * Matched to `src/vfx/weapons/burrito.ts`, whose identity paragraph is the whole
 * brief: *"Burrito is the only fighter whose ammunition is a thing that has been
 * ROLLED UP... every big beat here is that strip changing state — a tight coil
 * UNROLLING into a sweeping arc (`Disc`), or a loose strip WINDING UP around a target
 * (`Roll`)."* Plus the FOIL — *"COOL, near-white, opaque and hard-edged"* — and
 * spilled filling that is deliberately different in form from Taco's.
 *
 * ── The device: `freqShift` — a grain cloud that MOVES ──────────────────────────
 *
 * Burrito and Taco are the two fighters made of "food that comes apart", and a roster
 * where they sound alike has failed at the only job this system has. They both use
 * `grainCloud`, and everything else about how they use it is opposite:
 *
 *   |               | Taco                        | Burrito                      |
 *   |---------------|-----------------------------|------------------------------|
 *   | grain density | sparse, 9-18 hard clicks    | dense, 16-22 soft ticks      |
 *   | grain length  | 3-9 ms (clicks)             | 5-14 ms (rustles)            |
 *   | leading edge  | ONE hard CRACK              | none at all — paper does not crack |
 *   | band          | fixed: one break, one place | **WALKS** via `freqShift`    |
 *
 * That last row is the identity. A shell shatters at one instant, so its fragments
 * all come from the same event and its band stays put. A rolled strip comes apart
 * PROGRESSIVELY ALONG ITS LENGTH, so the texture slides — down as it unrolls, up as
 * it winds. `freqShift` in `synth.ts` exists for this and nothing else uses it, and
 * the direction is measurable: the probe compares the spectral centroid of the first
 * third of the cloud against the last third and asserts Disc falls while Roll rises.
 * Two weapons on one character with opposite signs on the same measurement is a
 * stronger claim than either one alone.
 *
 * The FOIL is the second layer and the reason this does not just sound like rustling
 * leaves: a short, bright, hard-edged crinkle band up at 5-9 kHz sitting on top of
 * the soft tortilla. Cool where the tortilla is warm, exactly as in the VFX.
 *
 * Weapon keys (`rules.ts` -> `CHARACTERS.burrito.weapons`): `'Disc'` (10 dmg, long —
 * he throws HIMSELF, rolled), `'Roll'` (4 dmg, melee, stun — the target gets
 * WRAPPED), `'Swarm'` (5 dmg, 4 homing pellets, one per topping).
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
 * THE RIBBON. A dense cloud of soft mid-band ticks whose centre walks from `from` to
 * `to` across the window. `from > to` unrolls; `from < to` winds up.
 *
 * No leading crack, by design — see the header table. The one hard moment Burrito is
 * allowed is the foil, and that is a separate, brighter, quieter layer.
 */
function ribbon(s: SynthCtx, spread: number, from: number, to: number, level: number): number {
  return grainCloud(s, {
    // 12, not 18. A grain is 4 nodes and this fires twice per hit alongside the
    // foil; at 18 a single Burrito Disc impact cost 140 nodes against a 20-voice
    // budget, which `--mode depth`'s node census flags as a mobile problem before
    // anyone has to hear a dropout. Density survives the cut because the grains are
    // long and overlapping, which is what made paper read as paper in the first
    // place — it was never the count.
    count: 12,
    spread,
    // Longer than Taco's grains: paper rustles where shell clicks.
    grainMs: [5, 14],
    freq: [2300, 4600],
    freqShift: [from, to],
    // Lower Q than a shell fragment. A brittle piece rings; a soft one does not.
    q: 3.2,
    peak: level,
    decay: 0.4,
    drive: 1.5,
    wet: 0.3,
  });
}

/**
 * THE FOIL: brief, bright, hard-edged crinkle. Cool and metallic over the warm
 * tortilla, the audio counterpart of the VFX file's near-white opaque wrapper.
 *
 * Band widened to 11 kHz and grain count raised 5 -> 7 in the roster-wide top-end pass.
 * Foil crinkle is one of the few sounds in the real world whose energy genuinely peaks
 * in the top octave, so this character's share of the pass costs nothing in identity —
 * it is the layer already doing the job, finally authored at the level the physics
 * implies. The CALLERS carry most of that change: this layer was being mixed at
 * 0.13-0.24 under bodies peaking at 0.46.
 */
function foil(s: SynthCtx, spread: number, level: number): number {
  return grainCloud(s, {
    count: 7,
    spread,
    grainMs: [2, 5],
    freq: [5600, 11000],
    q: 9,
    peak: level,
    decay: 0.25,
    wet: 0.34,
  });
}

export const burritoWeaponSfx: CharacterWeaponSfxMap = {
  // ── Burrito Disc: 10 dmg, long range. He throws HIMSELF, rolled. ─────────────
  Disc: {
    cast(c: WeaponSfxCtx): number {
      const j = centsJitter(c.rng, 55);
      // THE UNROLL — the longest textural gesture in the game, and the band walks
      // DOWN through it as the coil opens out.
      const strip = ribbon(c, 0.3, 1.35, 0.62, 0.3);
      const wrap = foil(c, 0.22, 0.13);
      // Air under it, so the strip is being thrown and not merely handled.
      const air = noiseBurst(c, {
        filter: 'bandpass',
        freq: [700 * j, 1800 * j],
        q: 1.6,
        peak: 0.34,
        attack: 0.05,
        hold: 0.1,
        duration: 0.3,
        drive: 1.4,
        wet: 0.3,
      });
      return longest(strip, wrap, air);
    },
    impact(c: WeaponSfxCtx): number {
      // A rolled cylinder landing flat: a soft slap, then the strip coming apart
      // downward. There is a body here — Disc is 10 damage and has to land — but it
      // is short and dull so the crinkle stays the identifying part.
      const tr = transient(c, { peak: 0.46, freq: 3400, snap: 1600, snapMs: 10, wet: 0.1 });
      const slap = noiseBurst(c, {
        filter: 'bandpass',
        freq: [2400, 950],
        q: 2,
        peak: 0.3,
        attack: 0.003,
        duration: 0.07,
        drive: 1.9,
        wet: 0.24,
      });
      const strip = ribbon(c, 0.2, 1.3, 0.68, 0.3);
      const wrap = foil(c, 0.14, 0.46);
      const body = tone(c, {
        type: 'sine',
        freq: [190, 72],
        peak: 0.46,
        attack: 0.0022,
        duration: 0.1,
        drive: 2.6,
        voices: 2,
        detuneCents: 15,
        wet: 0.14,
      });
      return longest(tr, slap, strip, wrap, body);
    },
  },

  // ── Roll Stun: 4 dmg melee, stuns. The target gets WRAPPED. ─────────────────
  Roll: {
    cast(c: WeaponSfxCtx): number {
      const j = centsJitter(c.rng, 60);
      const spin = noiseBurst(c, {
        filter: 'bandpass',
        freq: [900 * j, 2100 * j],
        q: 2.4,
        peak: 0.36,
        attack: 0.04,
        duration: 0.2,
        drive: 1.5,
        wet: 0.3,
      });
      return spin;
    },
    impact(c: WeaponSfxCtx): number {
      // THE WIND-UP: the same ribbon, band walking UPWARD. Everything in this game
      // that tightens goes up and everything that lets go goes down, and this is the
      // only character that does both.
      const strip = ribbon(c, 0.26, 0.7, 1.5, 0.32);
      const wrap = foil(c, 0.2, 0.44);
      // The stun cue: a body that CLOSES rather than decays — a rising, narrowing
      // band that stops dead, which reads as being pinned rather than struck.
      const cinch = noiseBurst(c, {
        filter: 'bandpass',
        freq: [1100, 3400],
        q: 7,
        peak: 0.3,
        attack: 0.02,
        duration: 0.26,
        drive: 1.6,
        wet: 0.32,
      });
      const body = tone(c, {
        type: 'sine',
        freq: [230, 124],
        peak: 0.18,
        attack: 0.004,
        duration: 0.08,
        drive: 2.2,
        wet: 0.12,
      });
      return longest(strip, wrap, cinch, body);
    },
  },

  // ── Topping Swarm: 4 homing pellets, one per topping. ───────────────────────
  // `combat.ts` spawns one projectile per `pelletColors` entry, all under this key,
  // so this hook serves all four toppings — exactly as the VFX file's single entry
  // does. The engine's retrigger throttle ducks the repeats, so four pellets land as
  // one textured event rather than four impacts.
  Swarm: {
    cast(c: WeaponSfxCtx): number {
      const j = centsJitter(c.rng, 70);
      // The squeeze that ejects them, then four little foil ticks fanning out.
      const squeeze = noiseBurst(c, {
        filter: 'bandpass',
        freq: [1400 * j, 3000 * j],
        q: 4,
        peak: 0.36,
        attack: 0.025,
        duration: 0.17,
        drive: 1.7,
        wet: 0.3,
      });
      const ticks = foil(c, 0.16, 0.16);
      return longest(squeeze, ticks);
    },
    impact(c: WeaponSfxCtx): number {
      const tr = transient(c, { peak: 0.36, freq: 4200, snap: 2200, snapMs: 7, wet: 0.1 });
      const strip = ribbon(c, 0.13, 1.2, 0.8, 0.24);
      // Swarm was the ONE Burrito impact with no foil in it, which is a plain
      // authoring gap rather than a decision: the toppings come off the same wrapped
      // roll as everything else this character throws. Sparse and quiet, because four
      // pellets land under one retrigger bucket and a dense crinkle x4 is a hiss.
      const wrap = foil(c, 0.1, 0.3);
      const body = tone(c, {
        type: 'sine',
        freq: [250, 118],
        peak: 0.18,
        attack: 0.002,
        duration: 0.07,
        drive: 2.4,
        wet: 0.12,
      });
      return longest(tr, strip, wrap, body);
    },
  },
};
