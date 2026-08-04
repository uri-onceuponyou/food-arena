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
 * ── How the generic hit is built, and why ───────────────────────────────────────
 * Three layers, in the order the ear resolves them:
 *   1. TRANSIENT — a couple of milliseconds of high-passed noise. This is what makes
 *      a hit feel like it happened at a precise instant. Without it, everything
 *      sounds soft and late no matter how loud it is.
 *   2. BODY — a sine with a fast downward pitch sweep. This carries the WEIGHT, and
 *      it is the only layer that scales meaningfully with damage: a 2-damage Rice
 *      Spray tick and a 16-damage Soup Dump differ mostly in how low and how long
 *      the body goes, which is the same relationship the screen shake in `match.ts`
 *      already encodes visually.
 *   3. TEXTURE — a band-limited noise crunch. This is the layer a bespoke weapon
 *      voice usually replaces first, because it is where "wet", "brittle" and
 *      "dull" actually live.
 */

import {
  centsJitter,
  droplets,
  grainCloud,
  longest,
  noiseBurst,
  rand,
  tone,
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
    });
    const push = tone(s, {
      type: 'sine',
      freq: [440 * j, 180 * j],
      peak: 0.14 + size * 0.1,
      attack: 0.004,
      duration: 0.1,
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
    });
    const body = tone(s, {
      type: 'sawtooth',
      freq: [200 * j, 88 * j],
      lowpass: [900, 300],
      peak: 0.2 + size * 0.12,
      attack: 0.02,
      duration: dur * 0.8,
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
        { type: 'triangle', freq: f * j, peak: 0.2, attack: 0.012, hold: 0.2, duration: 0.3 },
      );
    });
    const shimmer = noiseBurst(s, {
      filter: 'highpass',
      freq: [3000, 7000],
      q: 0.8,
      peak: 0.07,
      attack: 0.08,
      duration: 0.42,
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
 */
export function castGiantSlam(): SoundFn {
  return (s) => {
    const j = centsJitter(s.rng, 30);
    const boom = tone(s, {
      type: 'sine',
      freq: [120 * j, 32 * j],
      peak: 0.95,
      attack: 0.004,
      hold: 0.08,
      duration: 0.72,
    });
    const roar = noiseBurst(s, {
      filter: 'lowpass',
      freq: [2200, 140],
      q: 1.4,
      peak: 0.55,
      attack: 0.01,
      duration: 0.62,
    });
    const crack = noiseBurst(s, {
      filter: 'bandpass',
      freq: [1800, 700],
      q: 1,
      peak: 0.5,
      attack: 0.001,
      duration: 0.1,
    });
    const debris = grainCloud(s, {
      count: 10,
      spread: 0.42,
      freq: [900, 4200],
      peak: 0.16,
      q: 5,
    });
    return longest(boom, roar, crack, debris);
  };
}

// ─────────────────────────────────────────────────────────────────────────────
// Hits
// ─────────────────────────────────────────────────────────────────────────────

/** The generic impact — transient + body + texture, see the header. */
export function impact(damage: number): SoundFn {
  const size = damage01(damage);
  return (s) => {
    const j = centsJitter(s.rng, 60);
    const click = noiseBurst(s, {
      filter: 'highpass',
      freq: 4200,
      peak: 0.26,
      attack: 0.0006,
      duration: 0.022,
    });
    const body = tone(s, {
      type: 'sine',
      // Heavier hits start lower and land lower — the pitch IS the weight.
      freq: [(210 - size * 70) * j, (74 - size * 26) * j],
      peak: 0.42 + size * 0.4,
      attack: 0.002,
      duration: 0.09 + size * 0.14,
    });
    const crunch = noiseBurst(s, {
      filter: 'bandpass',
      freq: [1600 * j, 480 * j],
      q: 1.5,
      peak: 0.26 + size * 0.22,
      attack: 0.001,
      duration: 0.07 + size * 0.08,
    });
    return longest(click, body, crunch);
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
 * Below ~30% health it adds a sub-bass thud, so the last few hits before death feel
 * different from the first few without a single new event type.
 */
export function hurt(health01: number): SoundFn {
  const critical = health01 < 0.3;
  return (s) => {
    const j = centsJitter(s.rng, 45);
    const grunt = tone(s, {
      type: 'sawtooth',
      freq: [320 * j, 140 * j],
      lowpass: [1300, 280],
      peak: 0.3,
      attack: 0.004,
      duration: 0.22,
    });
    const dull = noiseBurst(s, {
      filter: 'lowpass',
      freq: [900, 190],
      q: 0.9,
      peak: 0.2,
      attack: 0.002,
      duration: 0.16,
    });
    const sub = critical
      ? tone(s, { type: 'sine', freq: [70, 44], peak: 0.55, attack: 0.006, duration: 0.3 })
      : 0;
    return longest(grunt, dull, sub);
  };
}

/** Death — a deflating fall plus a low boom. The only downward pitch sweep in the
 * game that lasts long enough to be heard AS a sweep. */
export function death(): SoundFn {
  return (s) => {
    const j = centsJitter(s.rng, 40);
    const fall = tone(s, {
      type: 'sawtooth',
      freq: [440 * j, 62 * j],
      lowpass: [2600, 260],
      peak: 0.42,
      attack: 0.006,
      duration: 0.55,
    });
    const poof = noiseBurst(s, {
      filter: 'lowpass',
      freq: [3200, 200],
      q: 1.1,
      peak: 0.34,
      attack: 0.004,
      duration: 0.4,
    });
    const boom = tone(s, {
      type: 'sine',
      freq: [96 * j, 36 * j],
      peak: 0.7,
      attack: 0.003,
      duration: 0.5,
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
        { type: 'triangle', freq: f * j, peak: 0.26, attack: 0.01, duration: 0.24 },
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
 */
export function fogTick(): SoundFn {
  return (s) => {
    const rumble = noiseBurst(s, {
      filter: 'lowpass',
      freq: [420, 110],
      q: 1.2,
      peak: 0.34,
      attack: 0.05,
      duration: 0.34,
    });
    const wind = noiseBurst(s, {
      filter: 'bandpass',
      freq: [1400, 2600],
      q: 0.7,
      peak: 0.1,
      attack: 0.08,
      duration: 0.36,
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
    });
    const spit = grainCloud(s, { count: 4, spread: 0.2, freq: [2500, 6000], peak: 0.1, q: 7 });
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
    });
    const pop = tone(s, { type: 'sine', freq: [180, 90], peak: 0.14, duration: 0.1 });
    return longest(squelch, pop);
  };
}

/** A projectile that hit cover or expired — a small dull thud so a miss still has a
 * consequence you can hear. */
export function coverThud(): SoundFn {
  return (s) => {
    const j = centsJitter(s.rng, 90);
    const thud = tone(s, { type: 'sine', freq: [150 * j, 70 * j], peak: 0.2, duration: 0.08 });
    const knock = noiseBurst(s, {
      filter: 'lowpass',
      freq: [800, 240],
      q: 1.4,
      peak: 0.16,
      attack: 0.001,
      duration: 0.06,
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
      duration: 0.14,
    });
    const tick = noiseBurst(s, { filter: 'highpass', freq: 3800, peak: 0.12, duration: 0.015 });
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
        { type: 'square', freq: f, lowpass: [3200, 1800], peak: 0.22, attack: 0.006, hold: 0.3, duration: 0.34 },
      );
    });
    const swell = noiseBurst(s, {
      filter: 'bandpass',
      freq: [500, 4000],
      q: 0.9,
      peak: 0.16,
      attack: 0.14,
      duration: 0.2,
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
    const blip = tone(s, { type: 'triangle', freq: [900, 640], peak: 0.22, duration: 0.055 });
    const tick = noiseBurst(s, { filter: 'highpass', freq: 5000, peak: 0.1, duration: 0.012 });
    return longest(blip, tick);
  };
}

// Re-exported so bespoke weapon files can reach the shared helpers through one
// import (`from '../sounds'`) rather than reaching past this layer.
export { droplets, rand, centsJitter, longest };
