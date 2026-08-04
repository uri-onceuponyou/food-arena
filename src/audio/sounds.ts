/**
 * The generic sound catalogue — what every weapon and every fighter sounds like
 * before anyone authors a bespoke voice for it.
 *
 * This mirrors `game/vfx.ts` exactly one layer down: that file holds one generic
 * "hit burst" recipe reused for every weapon, and `vfx/weapons/` overrides it per
 * weapon. Here, `impact()` / `castRanged()` / `castMelee()` are the generic recipe
 * and `audio/weapons/` overrides them. A weapon with no bespoke entry sounds like
 * this, and that is a complete, shipped state — not a stub.
 *
 * Every export is a FACTORY returning a `SoundFn`, so the parameters that matter
 * (damage, weapon type, remaining health) are baked in at the call site and the
 * resulting function is still the pure `(SynthCtx) -> duration` the engine and the
 * offline probe both expect.
 *
 * ── THE FOUR-LAYER CONTRACT ─────────────────────────────────────────────────────
 *
 * Every impact-shaped sound in this file is built from four layers, in the order the
 * ear resolves them. The first version of this file had three, and the third one was
 * doing two jobs badly:
 *
 *   1. TRANSIENT — `transient()` in `synth.ts`: a high-passed noise tick AND a short
 *      pitched snap under it. The tick alone marks the instant; the snap is what
 *      makes the instant belong to an OBJECT. A transient with no pitch in it reads
 *      as a hiss no matter how loud it is, which is measurable — the shipped version
 *      of this sound put 22-29% of its onset energy above 3 kHz with no peak
 *      structure whatsoever.
 *   2. BODY — a DETUNED, SATURATED oscillator pair with a fast downward pitch sweep.
 *      This carries the WEIGHT, and it is the layer that scales with damage: a
 *      2-damage Rice Spray tick and a 16-damage Soup Dump differ mostly in how low
 *      and how long the body goes, the same relationship `match.ts`'s screen shake
 *      already encodes visually. The saturation is not decoration: measured, the
 *      unsaturated body resolved to exactly ONE spectral peak, the same count a bare
 *      test tone scores, and that single number is most of what "shallow" meant.
 *   3. SUB — a separate, deeper, lightly-saturated sine under the body on anything
 *      that is meant to feel heavy. Kept apart from the body so its LENGTH can differ:
 *      weight is a long low tail under a short bright body, and one layer cannot be
 *      both.
 *   4. TEXTURE + ROOM — a band-limited crunch (where "wet", "brittle" and "dull"
 *      live, and the layer a bespoke voice usually replaces first), plus a quiet,
 *      slow, dark wash sent mostly to the shared reverb. That wash is the layer that
 *      says WHERE this happened. Before it existed, every sound in the catalogue had
 *      a measured -66 dBFS extent SHORTER than its own declared duration — no energy
 *      after the envelope at all, anywhere in the game.
 *
 * ── DECAY IS AN AXIS, NOT A CONSTANT ────────────────────────────────────────────
 *
 * "Envelopes too fast and uniform" was true and measurable: the whole catalogue's
 * rt20 fitted inside 18-88 ms, so the mix genuinely had one texture. Decay time is
 * now deliberately spread across more than an order of magnitude — a UI click at a
 * few tens of ms, an ordinary impact in the low hundreds, a death and the ultimate
 * out past half a second — and `--mode depth` asserts the SPREAD, not just the
 * individual values, so a future tuning pass cannot quietly collapse it again.
 */

import {
  centsJitter,
  droplets,
  grainCloud,
  longest,
  modes,
  noiseBurst,
  rand,
  tone,
  transient,
  type SoundFn,
} from './synth';

/** Map a weapon's damage onto 0..1. The roster spans 2 (Rice Spray) to 18 (Mega
 * Splash); anything outside clamps rather than running away. */
function damage01(damage: number): number {
  return Math.max(0, Math.min(1, (damage - 2) / 16));
}

// ─────────────────────────────────────────────────────────────────────────────
// Attacks
// ─────────────────────────────────────────────────────────────────────────────

/** Generic thrown/fired attack — a short air whoosh with a soft pitched push
 * behind it. Deliberately restrained: it fires as often as every 650 ms and it must
 * not fatigue. */
export function castRanged(damage: number): SoundFn {
  const size = damage01(damage);
  return (s) => {
    const j = centsJitter(s.rng, 70);
    const air = noiseBurst(s, {
      filter: 'bandpass',
      freq: [2600 * j, 620 * j],
      q: 1.1,
      peak: 0.26 + size * 0.12,
      attack: 0.006,
      duration: 0.13,
      // Light drive thickens the air without brightening it — a whoosh with no
      // density reads as tape hiss with an envelope on it.
      drive: 1.5,
      wet: 0.14,
    });
    // The push is what the arm did. Detuned and saturated so it is a MOVEMENT rather
    // than a beep; the whole cast is under 150 ms and there is no room for a beep.
    const push = tone(s, {
      type: 'sine',
      freq: [440 * j, 170 * j],
      peak: 0.16 + size * 0.12,
      attack: 0.004,
      duration: 0.11,
      drive: 1.9,
      voices: 2,
      detuneCents: 14,
      wet: 0.1,
    });
    return longest(air, push);
  };
}

/**
 * Generic melee swing — a whoosh whose spectrum sweeps UPWARD as it swells, which is
 * what the ear reads as something accelerating past it. The opposite sweep (bright →
 * dull) reads as something moving away, and made every swing sound like a miss.
 */
export function castMelee(damage: number, coneDeg: number): SoundFn {
  const size = damage01(damage);
  // A 360° omni swing (Lollipop's Giant) is a wider, slower gesture than an 80°
  // chop; widen the whoosh with the cone.
  const wide = Math.min(1, coneDeg / 180);
  return (s) => {
    const j = centsJitter(s.rng, 55);
    const dur = 0.2 + wide * 0.1;
    const swing = noiseBurst(s, {
      filter: 'bandpass',
      freq: [420 * j, (1900 - wide * 600) * j],
      q: 2.2,
      peak: 0.44 + size * 0.2,
      attack: 0.05 + wide * 0.03,
      hold: 0.12,
      duration: dur,
      drive: 1.6,
      wet: 0.2,
    });
    const body = tone(s, {
      type: 'sawtooth',
      freq: [200 * j, 88 * j],
      lowpass: [900, 300],
      peak: 0.2 + size * 0.12,
      attack: 0.02,
      duration: dur * 0.8,
      drive: 1.8,
      voices: 2,
      detuneCents: 18,
      wet: 0.12,
    });
    return longest(swing, body);
  };
}

/** Generic self-buff / heal cast — a rising triad, the one unambiguously "good"
 * shape in the catalogue. Nothing else in the game rises. */
export function castSelf(): SoundFn {
  const notes = [523.25, 659.25, 783.99];
  return (s) => {
    const j = centsJitter(s.rng, 25);
    notes.forEach((f, i) => {
      tone(
        { ...s, when: s.when + i * 0.06 },
        {
          type: 'triangle',
          freq: f * j,
          peak: 0.2,
          attack: 0.012,
          hold: 0.2,
          duration: 0.3,
          voices: 2,
          detuneCents: 9,
          // The one deliberately WET sound in the catalogue. A heal should feel like
          // it opens the space up, and this is the only place in the game where the
          // room is meant to be noticed rather than merely present.
          wet: 0.42,
        },
      );
    });
    const shimmer = noiseBurst(s, {
      filter: 'highpass',
      freq: [3000, 7000],
      q: 0.8,
      peak: 0.07,
      attack: 0.08,
      duration: 0.42,
      wet: 0.5,
    });
    return longest(0.3 + notes.length * 0.06, shimmer);
  };
}

/**
 * Lollipop's Giant Lollipop and anything else flagged `giantSlam` — the biggest
 * sound in the game, and the only one allowed to be.
 *
 * Its VFX assumption is that the tell must read with the caster OFF SCREEN
 * (`PROGRESS.md`), and audio is the one channel that works regardless of framing, so
 * this is scheduled centre-panned rather than positioned: an ultimate you cannot see
 * should still be an ultimate you cannot miss.
 *
 * The heaviest saturation and the longest decay in the game, both deliberately: a
 * 32 Hz fundamental is inaudible on a phone, so the harmonics the shaper generates
 * at 96/160/224 Hz are the only reason this reads as enormous rather than as absent
 * on the device most likely to be playing it.
 */
export function castGiantSlam(): SoundFn {
  return (s) => {
    const j = centsJitter(s.rng, 30);
    const boom = tone(s, {
      type: 'sine',
      freq: [130 * j, 30 * j],
      peak: 0.9,
      attack: 0.004,
      hold: 0.08,
      duration: 0.78,
      drive: 3.4,
      voices: 3,
      detuneCents: 22,
      wet: 0.3,
    });
    const roar = noiseBurst(s, {
      filter: 'lowpass',
      freq: [2200, 140],
      q: 1.4,
      peak: 0.55,
      attack: 0.01,
      duration: 0.62,
      drive: 2.2,
      wet: 0.34,
    });
    const crack = transient(s, { peak: 0.62, freq: 3000, snap: 1900, snapMs: 26 });
    const debris = grainCloud(s, {
      count: 10,
      spread: 0.42,
      freq: [900, 4200],
      peak: 0.16,
      q: 5,
      wet: 0.4,
    });
    return longest(boom, roar, crack, debris);
  };
}

// ─────────────────────────────────────────────────────────────────────────────
// Hits
// ─────────────────────────────────────────────────────────────────────────────

/** The generic impact — transient + body + sub + texture/room, see the header. */
export function impact(damage: number): SoundFn {
  const size = damage01(damage);
  return (s) => {
    const j = centsJitter(s.rng, 60);
    // 1. TRANSIENT. Heavier hits land lower and duller — a big thing striking is not
    // a bright tick, it is a thud with an edge on it.
    const tr = transient(s, {
      peak: 0.66 - size * 0.14,
      freq: 3900 - size * 1100,
      snap: 2700 - size * 800,
      snapMs: 11 + size * 7,
    });
    // 2. BODY. Detuned pair + saturation: this is the layer that stopped being a
    // test tone. Heavier hits start lower and land lower — the pitch IS the weight.
    const body = tone(s, {
      type: 'sine',
      freq: [(230 - size * 80) * j, (62 - size * 22) * j],
      peak: 0.48 + size * 0.34,
      attack: 0.0018,
      duration: 0.11 + size * 0.22,
      drive: 2 + size * 1.5,
      voices: 2,
      detuneCents: 16,
      wet: 0.16,
    });
    // 3. SUB. Only appears once a hit is worth feeling, and outlasts the body.
    const sub =
      size > 0.12
        ? tone(s, {
            type: 'sine',
            freq: [(118 - size * 38) * j, (44 - size * 12) * j],
            peak: 0.14 + size * 0.38,
            attack: 0.004,
            duration: 0.1 + size * 0.2,
            drive: 1.5,
            wet: 0.1,
          })
        : 0;
    // 4a. TEXTURE.
    const crunch = noiseBurst(s, {
      filter: 'bandpass',
      freq: [1700 * j, 470 * j],
      q: 1.5,
      peak: 0.24 + size * 0.2,
      attack: 0.0012,
      duration: 0.07 + size * 0.1,
      drive: 1.9,
      wet: 0.22,
    });
    // 4b. ROOM. Quiet, slow, dark, and mostly sent to the reverb — this is the layer
    // that puts the hit in a kitchen instead of in a vacuum.
    const air = noiseBurst(s, {
      filter: 'bandpass',
      // Deliberately ABOVE the body band. At [1100 -> 320] this wash reached down
      // into the body's own octave and measurably held up the low-band spectrum as
      // the body's pitch fell — i.e. it was low-mid mud sitting exactly where the
      // weight is supposed to be.
      freq: [1900, 640],
      q: 0.9,
      peak: 0.05 + size * 0.05,
      attack: 0.018,
      duration: 0.16 + size * 0.22,
      wet: 0.6,
    });
    return longest(tr, body, sub, crunch, air);
  };
}

/**
 * The extra layer that plays only when the LOCAL player is the one being hit.
 *
 * The enemy taking a hit and the player taking a hit are the same `hit-landed`
 * event, and a brawler in which they sound identical is one where you learn your own
 * health from the HUD instead of from the fight. This is the audio counterpart of
 * `match.ts`'s `targetBias` on screen shake.
 *
 * Below ~30% health it adds a sub-bass thud AND lengthens the whole thing, so the
 * last few hits before death feel different from the first few without a single new
 * event type.
 */
export function hurt(health01: number): SoundFn {
  const critical = health01 < 0.3;
  return (s) => {
    const j = centsJitter(s.rng, 45);
    const grunt = tone(s, {
      type: 'sawtooth',
      freq: [320 * j, 130 * j],
      lowpass: [1300, 260],
      peak: 0.3,
      attack: 0.004,
      duration: critical ? 0.34 : 0.22,
      drive: 2.4,
      voices: 2,
      detuneCents: 20,
      wet: 0.18,
    });
    const dull = noiseBurst(s, {
      filter: 'lowpass',
      poles: 24,
      freq: [900, 190],
      q: 0.9,
      peak: 0.2,
      attack: 0.002,
      duration: 0.16,
      drive: 1.6,
      wet: 0.24,
    });
    const sub = critical
      ? tone(s, {
          type: 'sine',
          freq: [96, 32],
          peak: 0.55,
          attack: 0.006,
          duration: 0.3,
          drive: 2.6,
          wet: 0.16,
        })
      : 0;
    return longest(grunt, dull, sub);
  };
}

/** Death — a deflating fall plus a low boom. The only downward pitch sweep in the
 * game that lasts long enough to be heard AS a sweep, and the longest decay outside
 * the ultimate. */
export function death(): SoundFn {
  return (s) => {
    const j = centsJitter(s.rng, 40);
    const fall = tone(s, {
      type: 'sawtooth',
      freq: [440 * j, 58 * j],
      lowpass: [2600, 240],
      peak: 0.42,
      attack: 0.006,
      duration: 0.6,
      drive: 2.2,
      voices: 2,
      detuneCents: 24,
      wet: 0.26,
    });
    const poof = noiseBurst(s, {
      filter: 'lowpass',
      freq: [3200, 200],
      q: 1.1,
      peak: 0.34,
      attack: 0.004,
      duration: 0.44,
      drive: 1.5,
      wet: 0.4,
    });
    const boom = tone(s, {
      type: 'sine',
      // Steep and early. At [96 -> 34] over 0.55 s this layer fell by a sixth in its
      // first 85 ms, which is not an envelope the ear reads as weight — it reads as a
      // low note. The fall has to happen while the sound is still loud.
      freq: [150 * j, 30 * j],
      peak: 0.7,
      attack: 0.003,
      duration: 0.42,
      drive: 3,
      voices: 2,
      detuneCents: 14,
      wet: 0.2,
    });
    return longest(fall, poof, boom);
  };
}

/** Heal tick — same rising shape as `castSelf` but shorter and softer, since it can
 * fire repeatedly during regen. */
export function heal(): SoundFn {
  const notes = [392, 523.25, 659.25];
  return (s) => {
    const j = centsJitter(s.rng, 20);
    notes.forEach((f, i) => {
      tone(
        { ...s, when: s.when + i * 0.05 },
        {
          type: 'triangle',
          freq: f * j,
          peak: 0.26,
          attack: 0.01,
          duration: 0.24,
          voices: 2,
          detuneCents: 8,
          wet: 0.34,
        },
      );
    });
    return 0.24 + notes.length * 0.05;
  };
}

// ─────────────────────────────────────────────────────────────────────────────
// Ambient damage sources — deliberately quiet and deliberately NOT impacts
// ─────────────────────────────────────────────────────────────────────────────

/**
 * The closing safe zone. `match.ts` already treats fog damage as categorically
 * different from a hit (no burst, no shake, a violet "ZONE" number); this keeps that
 * distinction in audio. It is a pressure, not an event: low rumble plus wind, no
 * transient at all, so it never competes with a real hit landing at the same moment.
 *
 * The one sound in the game with NO transient layer, deliberately. It is also the
 * wettest thing in the catalogue after `castSelf` — the zone is not in the room with
 * you, it is the room closing in.
 */
export function fogTick(): SoundFn {
  return (s) => {
    const rumble = noiseBurst(s, {
      filter: 'lowpass',
      poles: 24,
      freq: [420, 110],
      q: 1.2,
      peak: 0.34,
      attack: 0.05,
      duration: 0.4,
      drive: 2,
      wet: 0.35,
    });
    const wind = noiseBurst(s, {
      filter: 'bandpass',
      freq: [1400, 2600],
      q: 0.7,
      peak: 0.1,
      attack: 0.08,
      duration: 0.42,
      wet: 0.55,
    });
    return longest(rumble, wind);
  };
}

/** Standing in the boiling pot / a hazard — a sizzle. */
export function hazardTick(): SoundFn {
  return (s) => {
    const sizzle = noiseBurst(s, {
      filter: 'highpass',
      freq: [2600, 5200],
      q: 0.8,
      peak: 0.18,
      attack: 0.01,
      duration: 0.26,
      wet: 0.3,
    });
    const spit = grainCloud(s, {
      count: 4,
      spread: 0.2,
      freq: [2500, 6000],
      peak: 0.1,
      q: 7,
      wet: 0.35,
    });
    return longest(sizzle, spit);
  };
}

/** Walking through someone's Sticky Trail — a squelch. */
export function trailTick(): SoundFn {
  return (s) => {
    const squelch = noiseBurst(s, {
      filter: 'lowpass',
      freq: [1400, 260],
      q: 3.2,
      peak: 0.2,
      attack: 0.008,
      duration: 0.15,
      drive: 1.8,
      wet: 0.2,
    });
    const pop = tone(s, {
      type: 'sine',
      freq: [180, 84],
      peak: 0.14,
      duration: 0.11,
      drive: 2.2,
      wet: 0.14,
    });
    return longest(squelch, pop);
  };
}

/** A projectile that hit cover or expired — a small dull thud so a miss still has a
 * consequence you can hear. The shortest sound in the game after `uiClick`, and
 * deliberately so: a miss must not occupy the same amount of time as a hit. */
export function coverThud(): SoundFn {
  return (s) => {
    const j = centsJitter(s.rng, 90);
    const knock = transient(s, { peak: 0.26, freq: 2400, snap: 1200, snapMs: 8 });
    const thud = tone(s, {
      type: 'sine',
      freq: [150 * j, 66 * j],
      peak: 0.22,
      duration: 0.09,
      drive: 2,
      wet: 0.24,
    });
    return longest(thud, knock);
  };
}

// ─────────────────────────────────────────────────────────────────────────────
// Match flow
// ─────────────────────────────────────────────────────────────────────────────

/** Countdown 5→1. Pitch climbs as the number falls, so the tension is in the sound
 * and not only in the numeral. */
export function countdownTick(value: number): SoundFn {
  const steps = [523.25, 587.33, 659.25, 698.46, 783.99];
  const f = steps[Math.max(0, Math.min(steps.length - 1, 5 - value))];
  return (s) => {
    const blip = tone(s, {
      type: 'triangle',
      freq: f,
      peak: 0.34,
      attack: 0.004,
      hold: 0.25,
      duration: 0.16,
      voices: 2,
      detuneCents: 7,
      wet: 0.3,
    });
    const tick = noiseBurst(s, {
      filter: 'highpass',
      freq: 3800,
      peak: 0.12,
      duration: 0.015,
      wet: 0.12,
    });
    return longest(blip, tick);
  };
}

/** "START!" — a rising major triad with a noise swell under it. */
export function matchStart(): SoundFn {
  const notes = [523.25, 659.25, 1046.5];
  return (s) => {
    notes.forEach((f, i) => {
      tone(
        { ...s, when: s.when + i * 0.07 },
        {
          type: 'square',
          freq: f,
          lowpass: [3200, 1800],
          peak: 0.22,
          attack: 0.006,
          hold: 0.3,
          duration: 0.34,
          voices: 2,
          detuneCents: 10,
          wet: 0.3,
        },
      );
    });
    const swell = noiseBurst(s, {
      filter: 'bandpass',
      freq: [500, 4000],
      q: 0.9,
      peak: 0.16,
      attack: 0.14,
      duration: 0.2,
      wet: 0.35,
    });
    return longest(0.34 + notes.length * 0.07, swell);
  };
}

/** Win: a major arpeggio up. Loss: a minor one down. */
export function matchEnd(won: boolean): SoundFn {
  const notes = won ? [523.25, 659.25, 783.99, 1046.5] : [659.25, 587.33, 493.88, 392];
  return (s) => {
    notes.forEach((f, i) => {
      tone(
        { ...s, when: s.when + i * 0.1 },
        {
          type: won ? 'square' : 'sawtooth',
          freq: f,
          lowpass: won ? [3600, 2200] : [1600, 500],
          peak: 0.24,
          attack: 0.008,
          hold: 0.3,
          duration: 0.4,
          voices: 2,
          detuneCents: won ? 9 : 16,
          wet: 0.34,
        },
      );
    });
    return 0.4 + notes.length * 0.1;
  };
}

// ─────────────────────────────────────────────────────────────────────────────
// UI
// ─────────────────────────────────────────────────────────────────────────────

/** A tiny blip. Exists so a volume slider can make a noise while you drag it — a
 * volume control with no audible feedback is a control you cannot set. */
export function uiClick(): SoundFn {
  return (s) => {
    const blip = tone(s, {
      type: 'triangle',
      freq: [900, 620],
      peak: 0.22,
      duration: 0.055,
      drive: 1.6,
      wet: 0.16,
    });
    const tick = noiseBurst(s, { filter: 'highpass', freq: 5000, peak: 0.1, duration: 0.012 });
    return longest(blip, tick);
  };
}

// Re-exported so bespoke weapon files can reach the shared helpers through one
// import (`from '../sounds'`) rather than reaching past this layer.
export { droplets, rand, centsJitter, longest, modes, transient };
