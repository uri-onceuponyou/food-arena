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
 *   5. SPRAY — `spray()` in `synth.ts`, and it is FIVE layers now because a mix
 *      measurement said so. Layers 1-4 are all authored below about 2 kHz apart from a
 *      7 ms tick, and rendering a real match's event stream through the production
 *      chain (`tools/tmp/audio_mix.mjs`) showed the consequence: the long-term average
 *      spectrum falls at **-5.6 dB/octave** from 80 Hz to 8 kHz against pink noise's
 *      -3.0, **86% of every matchup's energy is below 1 kHz**, and at the brightest
 *      instant of a hit the 2-6 kHz band is already 25 dB under the low band. A splash
 *      lives in exactly the octaves that were empty. See `spray()` for the full table.
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
  glint,
  grainCloud,
  longest,
  modes,
  noiseBurst,
  rand,
  spray,
  tone,
  transient,
  type SoundFn,
  type SynthCtx,
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
    // 5. SPRAY — the top three octaves, which this sound did not reach at all.
    //
    // Measured in a real match (`tools/tmp/audio_mix.mjs`): at the BRIGHTEST INSTANT of
    // an impact the 2-6 kHz band sat 25 dB under the 20-500 Hz band and 6-16 kHz sat
    // 32 dB under, and stayed there for the sound's whole life. Layers 1-4 above are all
    // authored below ~2 kHz apart from a 7 ms tick, so the ear — which integrates over
    // 100-200 ms — only ever heard the body. Light hits get a brighter, tighter spray and
    // heavy ones a lower, longer one, so this stays an axis rather than a coat of varnish.
    const mist = spray(s, {
      peak: 0.1 + (1 - size) * 0.06,
      freq: [8600 - size * 2200, 3400 - size * 900],
      duration: 0.06 + size * 0.05,
      drops: 5,
      wet: 0.28,
    });
    return longest(tr, body, sub, crunch, air, mist);
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
    // ── Why this varies on more than pitch ──────────────────────────────────
    //
    // This is the most-repeated sound in the game and it was the least varied. Measured
    // in a real match through the production chain (`tools/tmp/audio_mix.mjs`, pizza vs
    // taco): 8 of 49 voices, tied for the loudest RECURRING key at -13.00 dBFS, the
    // LOWEST spectral centroid of all sixteen keys in the match at 1070 Hz, and **37.8%
    // of the energy of every moment the player is hit**. It is also unplaced — centre,
    // no distance attenuation — so it arrives at full level while the weapon impact
    // beside it has been attenuated by distance.
    //
    // The old version varied by `centsJitter(rng, 45)` on the grunt ALONE: +/-2.6% of
    // pitch on one of three layers, with the noise band, both durations and the sub all
    // fixed. Eight identical arrivals per match is a strong candidate for "monotonic" on
    // its own, and it costs nothing to fix — every axis below is a free draw from the
    // per-event rng the engine already hands every voice.
    //
    // The LEVEL is deliberately unchanged. Whether the hurt layer should sit under the
    // weapon that caused it is a mix decision and belongs to Uri
    // (`docs/DECISIONS-FOR-URI.md` section 7), not to this file.
    const j = centsJitter(s.rng, 45);
    const len = rand(s.rng, 0.9, 1.15);
    const gruntF = rand(s.rng, 285, 360);
    const grunt = tone(s, {
      type: 'sawtooth',
      freq: [gruntF * j, gruntF * j * 0.4],
      lowpass: [rand(s.rng, 1180, 1620), 260],
      peak: 0.3,
      attack: 0.004,
      duration: (critical ? 0.34 : 0.22) * len,
      drive: rand(s.rng, 2.1, 2.8),
      voices: 2,
      detuneCents: 20,
      wet: 0.18,
    });
    const dullTop = rand(s.rng, 830, 1150);
    const dull = noiseBurst(s, {
      filter: 'lowpass',
      poles: 24,
      freq: [dullTop, 190],
      q: 0.9,
      peak: 0.2,
      attack: 0.002,
      duration: 0.16 * len,
      drive: 1.6,
      wet: 0.24,
    });
    // A SCUFF — a few milliseconds of contact well ABOVE the whole hit vocabulary, so
    // "that one was me" is carried by a band no weapon body occupies rather than by more
    // energy in the band every weapon already fills. Quiet on purpose: it is a marker,
    // not a layer. Across the six matchups measured, 86% of the mix's energy sits under
    // 1 kHz and the 2-6 kHz region is 25 dB down, so a cue placed up there costs almost
    // no loudness and has almost no competition.
    //
    // The first component is FIXED and the second varies, and that split is deliberate.
    // `--mode depth` splits every hit into 20-300 / 300-2500 / 2500-16000 Hz and requires
    // all three to peak within 8.4 dB of the loudest. The critical variant's sub peaks at
    // 0.55, so the high band has to clear ~0.066 of absolute peak. A first version put
    // that entire band in a 3-grain cloud whose grains each draw `rand(0.55, 1)`, and the
    // gate's one fixed seed drew low: 0.11 against a 0.12 floor, FAILED — and would have
    // passed or failed at random on a different seed, which is worse than failing. A fixed
    // tick guarantees the band on every draw; the grains ride on top and carry the
    // variation. Randomise the CHARACTER of a layer, never whether it exists.
    const edge = transient(s, { peak: 0.2, freq: 3600, wet: 0.16 });
    const scuff = grainCloud(s, {
      count: 4,
      spread: 0.03,
      grainMs: [3, 8],
      freq: [rand(s.rng, 2700, 3400), rand(s.rng, 6000, 9000)],
      q: 4,
      peak: 0.24,
      decay: 0.3,
      wet: 0.2,
    });
    // ── THE CONTACT SPRAY, and why it is here rather than on a weapon ─────────
    //
    // This is the single most consequential change in the whole roster top-end pass,
    // and it was found by measurement rather than by ear. `tools/tmp/audio_mix.mjs
    // --tilt` drops one director key at a time from a real match and re-fits the
    // long-term spectrum. Of the sixteen keys a pizza-vs-taco match uses:
    //
    //   drop `hurt`                   tilt -5.67 -> -5.06 dB/oct   (+0.61)
    //   drop ALL FIFTEEN OTHER KEYS   about +0.90 between them
    //
    // `hurt` alone was holding down more of the game's spectrum than every weapon
    // impact, every cast, the hazard, the shrug-off and the whole match-flow fanfare
    // COMBINED. That follows from what it is: eight voices a match, tied for the
    // loudest recurring key, centre-panned at full level while the weapon that caused
    // it is distance-attenuated, and — before this — the lowest spectral centroid of
    // any key in the game at 1366 Hz. Brightening eleven characters and leaving this
    // alone would have been a roster pass the player never hears, because this sound is
    // mixed on top of every one of them.
    //
    // Physically it is also the right place: `hurt` is the sound of SOMETHING HITTING
    // YOU, and the part of a hit that reaches the victim first is the fine matter that
    // leaves the point of contact. The grunt below is still the identity — this rides
    // on it, at a fifth of its level.
    //
    // The LEVEL of the whole sound is deliberately still unchanged. Whether `hurt`
    // should sit under the weapon that caused it is a mix decision and belongs to Uri
    // (`docs/DECISIONS-FOR-URI.md`), and answering it by quietly making this layer loud
    // would be answering it without asking.
    const contact = spray(s, {
      peak: 0.13,
      freq: [rand(s.rng, 7600, 9400), rand(s.rng, 2800, 3600)],
      duration: rand(s.rng, 0.05, 0.08),
      drops: 5,
      wet: 0.26,
    });
    const sub = critical
      ? tone(s, {
          type: 'sine',
          freq: [rand(s.rng, 88, 104), 32],
          peak: 0.55,
          attack: 0.006,
          duration: 0.3 * len,
          drive: 2.6,
          wet: 0.16,
        })
      : 0;
    return longest(grunt, dull, edge, scuff, contact, sub);
  };
}

/**
 * THE SHRUG-OFF — a stun that was REFUSED by `combat.ts`'s grace rule.
 *
 * ── Why this sound exists, and why it fires for stuns only ─────────────────────
 *
 * Statuses no longer stack: a stun that lands on a target already stunned, or inside
 * the 500 ms grace after one ends, is discarded. The hit still lands, still deals FULL
 * damage and still emits the same `hit-landed`, so nothing about the moment is audible
 * — the player hears an ordinary connect and has no way to learn the rule that just
 * decided their next three seconds. `vfx.ts` gives it a ring pop, but the whole value
 * of a refusal cue is that it reaches a player who is **looking somewhere else**.
 *
 * Whether it deserves a sound is a RATE question before it is a taste question, and it
 * was measured rather than argued — `tools/tmp/audio_shrug_census.mjs`, 110 matchups of
 * the real sim, 27.9 minutes of play:
 *
 *   | refusals | total | per minute | per match | worst match |
 *   |----------|-------|------------|-----------|-------------|
 *   | slow     |  460  |    16.5    |    4.2    |     ~18     |
 *   | stun     |   83  |     3.0    |    0.75   |      2      |
 *
 * **67.7% of every status hit in the game is refused**, so a cue on all of them is not a
 * cue, it is a texture: 65.5% of consecutive refusals are less than 250 ms apart, which
 * is one perceived sound and not two. Slows are where that mass is — a slow is refused
 * 460 times to a stun's 83, and its refusal changes a movement multiplier the player is
 * not tracking. A refused STUN is the one that changes what they do next, because they
 * committed to a follow-up on a target they believed was rooted. At 0.75 per match and a
 * worst case of 2, it cannot become noise. (Two runs 40 minutes apart, with a peer agent
 * editing `ai.ts` in between, gave 95 and 83 stun refusals against 476 and 460 slow ones
 * — so the ~20x ratio and the ~1-per-match rate are the durable facts here, not the
 * third digit. Re-run the census after any AI or weapon change.)
 *
 * ── Why it sounds like this ────────────────────────────────────────────────────
 *
 * It plays SIMULTANEOUSLY with the impact it belongs to (and, on the player's own body,
 * with `hurt()` as well), so being merely audible is not enough — it has to be audible
 * THROUGH a hit and never mistakable FOR one. Three properties, each chosen against a
 * layer of `impact()`:
 *
 *   * **It rises.** Every impact-shaped sound in this file sweeps DOWN (`impact`'s body
 *     230->62 Hz, `hurt`'s grunt 320->130, `death`'s fall). Direction alone separates it
 *     from the entire hit vocabulary, and an upward sweep is already the game's "this
 *     did not land" gesture rather than "this connected".
 *   * **It is inharmonic**, via true ring modulation — the same device Lollipop's candy
 *     and Water Bottle's shell use for "struck something that did not give". No amount
 *     of saturation produces those sidebands, so it cannot be confused with a driven
 *     body.
 *   * **It lives above the hit and arrives after it.** The energy sits at 0.5-2.5 kHz
 *     while `impact()`'s body and sub are under 250 Hz, and a 22 ms attack (against the
 *     impact transient's 1.2-1.8 ms) puts its peak past the transient instead of inside
 *     it. Measured through the real director on the same event twice, differing only in
 *     whether the sim accepted the stun: **+5.4 to +5.7 dB above 1.2 kHz** for **+2.2 to
 *     +2.7% of peak** (0.3499 -> 0.3595). Quoted as a range because the director seeds
 *     every voice randomly — that is the point of the per-event variation — so a single
 *     render is one draw. Clearly present where the hit is thin, nearly invisible where
 *     the hit is loud, which is the whole design; `--mode dispatch` asserts both ends.
 *
 * Level is deliberately below the hit it rides on: this is an annotation on a hit, not
 * an event of its own, and the ordering `impact > shrug-off` is asserted.
 */
export function statusRefused(): SoundFn {
  return (s) => {
    const j = centsJitter(s.rng, 30);
    // 1. CONTACT — a thin, bright tick, well above the impact transient's 2.7-3.9 kHz
    // so it reads as a second surface rather than a doubling of the first.
    const tick = transient(s, { peak: 0.2, freq: 5400, snap: 3800, snapMs: 6 });
    // 2. THE REFUSAL — ring-modulated, so what is heard is the SUM and DIFFERENCE of a
    // rising carrier and a falling modulator: two inharmonic partials pulling apart.
    // That divergence is the "it bounced" gesture; a single rising tone reads as a
    // pickup or a UI confirm.
    const bounce = tone(s, {
      type: 'triangle',
      freq: [620 * j, 1560 * j],
      ring: [132, 96],
      peak: 0.34,
      attack: 0.022,
      duration: 0.26,
      wet: 0.34,
    });
    // 3. WARD — quiet, high, mostly reverb send. The tail that survives the hit and is
    // what is actually left to hear 150 ms in.
    const ward = tone(s, {
      type: 'sine',
      freq: [1880 * j, 2520 * j],
      peak: 0.1,
      attack: 0.03,
      duration: 0.34,
      wet: 0.55,
    });
    return longest(tick, bounce, ward);
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

/** How long one ambience chunk runs. See `kitchenBed`. */
export const AMBIENCE_CHUNK_S = 2.1;
/**
 * How often `director.ts` re-triggers it — chunk minus the crossfade.
 *
 * 1.5 s rather than the 2.0 s first tried, and the reason is the DUCK rather than the
 * sound: the level of a chunk is chosen when it is scheduled, so the period IS the
 * duck's response time. At 2.0 s a chunk that came up at the calm level a moment before
 * the first shot stayed there for 2.7 s of the fight, and the masking measurement
 * showed it: the 10th-percentile impact fell 1.9 dB BELOW the bed above 2 kHz. Six
 * extra voices per match is the price of a duck that arrives.
 */
export const AMBIENCE_PERIOD_S = 1.5;
/** Fade-in of one chunk. The release is derived from it so the two always meet. */
const AMBIENCE_ATTACK_S = 0.55;

/**
 * THE KITCHEN — a procedural ambience bed, and the answer to the other half of "flat".
 *
 * ## Why this exists, measured rather than argued
 *
 * `tools/tmp/audio_mix.mjs --shape` ran the real `sim.ts` over all 121 matchups and
 * measured the SILENCE:
 *
 *   | | |
 *   |---|---|
 *   | mean play length | **9.60 s** |
 *   | mean gap from the start whistle to the FIRST combat sound | **6.55 s** |
 *   | that gap as a fraction of the match | **69.9%** |
 *   | duty cycle (any voice inside a 300 ms window) | **21.9%** |
 *
 * Seven tenths of every match, in one unbroken silence, with `shell.ts` fading the
 * music out for the duration and no ambience of any kind. Uri's *"flat, one tone,
 * maybe two"* is partly a spectrum problem and partly this: the one tone is heard
 * against NOTHING, so there is no context to hear it against, no sense of a place, and
 * nothing at all happening for the two thirds of the match spent closing distance.
 *
 * ## Why it is built the way it is
 *
 * Procedural, like everything else here except the theme — a loop of recorded kitchen
 * would be an asset, a download, and a repeat the ear locates within about fifteen
 * seconds. Four layers, and the balance between them is the whole design:
 *
 *  1. **The extractor** — a quiet low drone. Kept DELIBERATELY SMALL. 20% of the mix's
 *     energy already sits in 63-125 Hz, an octave a phone speaker cannot reproduce at
 *     all, and a bed is the last thing that should add to it.
 *  2. **The fryer** — a wide band of noise, slowly breathing. This is the layer that
 *     says "kitchen" and it is the reason a kitchen was the right choice of room for a
 *     game that needs its top three octaves occupied: frying is genuinely broadband.
 *  3. **Air** — a 24 dB/oct corner above 6 kHz, very quiet. The top octave, present
 *     continuously rather than only during the 21.9% of the match that has combat in it.
 *  4. **One accent per chunk** — a lid, a pan, a knife on a board, a burst of steam.
 *     Discrete events are what stop a bed reading as tape hiss, and they are what make
 *     a room feel occupied rather than merely audible. Chosen from the per-voice rng,
 *     so no two chunks are the same and nothing here loops.
 *
 * ## Level, and the one rule it must obey
 *
 * It must sit UNDER combat and it must not eat the top end the roster pass exists to
 * create. Peak is authored at roughly a fifth of an impact's, and the measured
 * consequence is in the commit — the correct test is not "is it quiet" but "does the
 * 2-16 kHz share of a HIT still rise above the bed", and that is a measurement, not a
 * level.
 */
export function kitchenBed(): SoundFn {
  return (s) => {
    const D = AMBIENCE_CHUNK_S;
    // A long attack and an exponential release with the hold set so the release IS the
    // crossfade: chunk N+1 starts exactly as chunk N begins to fall.
    // The hold is DERIVED, not authored: it is set so the release begins exactly as the
    // next chunk's attack does, whatever the chunk length and period are. Authoring it
    // as a number would mean a silent gap or a 3 dB bump the first time either constant
    // moved, and both constants moved once already in tuning the duck.
    const shape = {
      attack: AMBIENCE_ATTACK_S,
      hold: (AMBIENCE_PERIOD_S - AMBIENCE_ATTACK_S) / (D - AMBIENCE_ATTACK_S),
      duration: D,
    } as const;

    // 1. THE EXTRACTOR. Two detuned partials, not one — a fan is a machine with blades
    // and beats slowly against itself. Level is the smallest in the layer stack.
    const fan = tone(s, {
      type: 'sine',
      freq: 118 * centsJitter(s.rng, 25),
      peak: 0.026,
      voices: 3,
      detuneCents: 26,
      drive: 1.6,
      ...shape,
      wet: 0.25,
    });

    // 2. THE FRYER. `loop` because this outlasts the shared 2 s noise bed; the band
    // drifts slowly across the chunk so consecutive chunks never sit still.
    const fry = noiseBurst(s, {
      filter: 'bandpass',
      freq: [rand(s.rng, 900, 1500), rand(s.rng, 1700, 2500)],
      q: 0.45,
      peak: 0.055,
      loop: true,
      // Slow, deep-ish breathing. Under ~0.4 Hz it reads as a fault; over ~1.5 Hz it
      // reads as a helicopter.
      tremolo: { rate: [0.55, 0.85], depth: 0.3 },
      ...shape,
      wet: 0.4,
    });

    // 3. AIR — the top octave, continuously. 24 dB/oct because one biquad cannot place
    // a band up here (see `NoiseOpts.poles`), and quiet because this is the layer that
    // would turn into tape hiss first.
    const air = noiseBurst(s, {
      filter: 'highpass',
      poles: 24,
      freq: [6400, 8200],
      q: 0.7,
      // 0.013, down from 0.03. See `director.ts` -> `watchAmbience` and the masking
      // measurement in the commit: at the first level tried, the bed's own 2-16 kHz
      // energy sat ABOVE the 10th-percentile weapon impact's in the same band, which is
      // a background layer masking the foreground it exists to sit behind — and, worse,
      // masking precisely the octaves the roster-wide pass had just been built to fill.
      peak: 0.009,
      loop: true,
      ...shape,
      wet: 0.5,
    });

    // 4. ONE ACCENT. Placed anywhere in the chunk's steady middle, so accents land at
    // irregular intervals across chunks rather than on a 2 s grid.
    const at = rand(s.rng, 0.3, D - 0.6);
    const a: SynthCtx = { ...s, when: s.when + at };
    const pick = Math.floor(s.rng() * 4);
    let acc = 0;
    if (pick === 0) {
      // A pan lid settling — a short inharmonic ring, the far side of the room.
      acc = modes(a, {
        freq: rand(s.rng, 620, 980),
        duration: 0.42,
        peak: 0.085,
        attack: 0.0015,
        wet: 0.62,
        modes: [
          { ratio: 1, gain: 1, decay: 1 },
          { ratio: 2.71, gain: 0.6, decay: 0.5 },
          { ratio: 4.63, gain: 0.34, decay: 0.3 },
        ],
      });
    } else if (pick === 1) {
      // A knife on a board. Two taps, uneven — a cook does not use a metronome.
      const t1 = transient(a, { peak: 0.1, freq: 3400, snap: 900, snapMs: 14, wet: 0.5 });
      const gap = rand(s.rng, 0.11, 0.19);
      const t2 = transient({ ...a, when: a.when + gap }, { peak: 0.075, freq: 3100, snap: 820, snapMs: 12, wet: 0.5 });
      acc = longest(t1, gap + t2);
    } else if (pick === 2) {
      // A burst of steam off a pot.
      acc = noiseBurst(a, {
        filter: 'bandpass',
        freq: [rand(s.rng, 2800, 3600), rand(s.rng, 5600, 7400)],
        q: 0.8,
        peak: 0.04,
        attack: 0.09,
        duration: 0.55,
        wet: 0.7,
      });
    } else {
      // Cutlery, somewhere out of sight. The one accent with real top octave in it.
      acc = glint(a, {
        count: 3,
        spread: 0.16,
        freq: [4200, 11000],
        peak: 0.022,
        pingMs: [8, 20],
        bend: 0.94,
        wet: 0.6,
      });
    }

    return longest(fan, fry, air, at + acc);
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

/**
 * The ring reaching its floor — the moment the fog stops closing.
 *
 * This state did not exist when the catalogue was written: the ring used to shrink to
 * zero, so there was never a moment when it stopped. `sim.ts` floors it and the HUD calls
 * the resulting state "FINAL RING".
 *
 * ⚠️ **WHAT FOLLOWED HERE STATED THE 1x MAP'S SCHEDULE AS CURRENT. IT IS KEPT ABOVE ITS
 * REPLACEMENT BECAUSE IT WAS TRUE, AND MEASURED, UNTIL 2026-08-11:**
 *
 *   > *"`sim.ts` now floors it at 140 wu and the HUD calls the resulting state 'FINAL
 *   > RING'. Measured against the shipped arena (`maxSafeRadius` 993) the floor is reached
 *   > at play-time **t=38.66 s of 45 s**, so this fires once, roughly six seconds before
 *   > the whistle, and never again.*
 *   >
 *   > *How often that happens today: never. `tools/tmp/audio_census.mjs` ran 363 real
 *   > matches across three player policies and the longest was 25.1 s of play — the ring
 *   > floor was reached in 0 of them, and only forcing both fighters immortal gets there
 *   > (121/121, at play-time 38.65 s against the 38.66 s schedule)."*
 *
 * **Three numbers in that moved, and none of them lives in this file.**
 *
 *   * `maxSafeRadius` is **1985 wu**. The arena went x4 in area (`DECISIONS §48`) and
 *     `arena/shared.ts` derives the opening radius from the half-diagonal, so it doubled
 *     with the map; the figure in the quotation above is the 1x map's.
 *   * The floor is no longer the constant 140. `rules.ts:minSafeRadiusFor(N)` scales it
 *     with the seat count (`DECISIONS §53b`) — 140 at N<=4, 187.42 at N=5, **237.00 at
 *     N=6**.
 *   * 🚨 **And the ring never reaches it.** Sudden death (`DECISIONS §2`) collapses the
 *     ring to zero at `SUDDEN_DEATH_MS` = **30 s of 45 s**, which `rules.ts`' own table
 *     puts **9.6-11.8 s before** the schedule would arrive at any of those floors.
 *
 * So this cue now fires on the **sudden-death collapse at t=30 s** — the moment the squeeze
 * does not stop but COMPLETES — 15 s before the whistle rather than 6. That is not a
 * reinterpretation: `audio/director.ts:watchZone` was changed to latch on
 * `ringFloorFor(N, timeRemaining)`, which returns 0 while sudden death is active, precisely
 * so this stayed one cue rather than becoming two.
 *
 * ⚠️ **AND THE "never happens" MEASUREMENT IS NOT SIMPLY INVERTED, IT IS UNMEASURED.** The
 * 0-of-363 figure was counted against a floor that no longer governs, on a map a quarter
 * of this one's size. The only fresh number is `DECISIONS §64`: **six-seat matches reach
 * the sudden-death trigger 65.5% of the time.** The two-seat rate has not been re-measured
 * since the map changed and is not claimed here.
 *
 * ═══════════════════════════════════════════════════════════════════════════════
 * 🚨 EVERYTHING ABOVE IS THE 45-SECOND CLOCK. `6d5c4d6` REVERSED THE PART IN BOLD,
 *    AND THE PARAGRAPH THAT SAID "UNMEASURED" IS NOW MEASURED.
 * ═══════════════════════════════════════════════════════════════════════════════
 *
 * Uri's schedule decoupled the ring from the clock. `MATCH_DURATION_MS` is **150 000**,
 * `FOG_HOLD_MS` holds the ring for 25 s, `FOG_CLOSE_MS` lands it on `minSafeRadiusFor(N)`
 * at **120 s**, and `SUDDEN_DEATH_MS` is `FOG_CLOSE_MS + SUDDEN_DEATH_GRACE_MS` = **135 s**.
 * So the claim above — *"the ring never reaches it"*, sudden death arriving 9.6–11.8 s
 * EARLY — is false: **the ring now arrives first, by 15 s, at every seat count.** This cue
 * is back to meaning what its name says. `rules.ts:fogRadiusAt` interpolates TO the floor
 * rather than decaying past it, so the arrival is a schedule constant rather than an
 * accident of arithmetic, and `audio/director.ts:watchZone`'s `ringFloorFor` latch fires on
 * the genuine stop at 120 s instead of on the collapse at 30 s. **No code moved.**
 *
 * And the opening radius moved a third time: `1985` above was `halfDiagonal / (1 − 6000/T)`
 * on the 45 s clock. `rules.ts:fogOpeningRadiusFor` is now the one derivation and it is the
 * IDENTITY on the half-diagonal — **1720.4650534085254 wu**. (On the 150 s clock the old
 * formula returns 1792: 4.2% high, plausible, and silent. Do not retype either number;
 * `arena/shared.ts:MAX_SAFE_RADIUS` derives it.)
 *
 * ── HOW OFTEN THIS CUE FIRES, MEASURED RATHER THAN ASSUMED ──────────────────
 *
 * `tools/tmp/sr_ringfloor.mjs`, 880 matches (110 matchups × 8 seeds, policy `smart2`, the
 * shipped 2800×2000 dump) — the same corpus `roster_lab` measures pacing on:
 *
 *   mean play length **22.05 s** · LONGEST **62.23 s**
 *   reached the ring floor (120 s): **0 / 880**
 *   reached sudden death   (135 s): **0 / 880**
 *   the longest match ended **57.77 s** before the ring lands.
 *
 * So the answer to *"how often does this fire?"* is **still never in a duel**, but for the
 * opposite reason and with a far bigger margin than the 0-of-363 that opened this comment:
 * matches end long before the ring moves at all, not just before it stops. ⚠️ That is a
 * TWO-SEAT number. `DECISIONS §64`'s 65.5% six-seat figure was measured on the 45 s clock
 * and is NOT carried forward here; six seats on this schedule is unmeasured, and the honest
 * statement is that nobody has run it.
 *
 * Deliberately a RELEASE rather than an alarm, and that is the whole design argument:
 * everything else the zone does is pressure (`fogTick` is a nag with no transient at
 * all), and the one thing this event means is that the pressure has stopped growing.
 * A descending fifth that lands on a held pedal is the opposite gesture to `castSelf`
 * and `matchStart`, which are the only two RISING shapes in the game.
 *
 * Centre-panned and Critical at the call site for the same reason as the countdown:
 * this is a fact about the match, not an object in the world, so it has no position.
 */
export function ringFloor(): SoundFn {
  return (s) => {
    const j = centsJitter(s.rng, 18);
    // The announcement: a descending perfect fifth. Two notes, not three — a triad
    // would read as a verdict, and the match is not over.
    [587.33, 392].forEach((f, i) => {
      tone(
        { ...s, when: s.when + i * 0.16 },
        {
          type: 'triangle',
          freq: f * j,
          peak: 0.26,
          attack: 0.008,
          hold: 0.25,
          duration: 0.38,
          voices: 2,
          detuneCents: 11,
          wet: 0.34,
        },
      );
    });
    // The pedal the fifth lands on. This is the "and it stays there" half: a long,
    // saturated low note that outlasts the chime instead of decaying with it.
    const pedal = tone(s, {
      type: 'sine',
      freq: [196 * j, 98 * j],
      peak: 0.34,
      attack: 0.02,
      hold: 0.3,
      duration: 0.72,
      drive: 2.2,
      voices: 2,
      detuneCents: 15,
      wet: 0.28,
    });
    // The wind dying. Same band `fogTick` lives in, swept DOWN and out — the zone's
    // own texture, resolving. Wet, because the zone is the room closing in and this is
    // the room stopping.
    const settle = noiseBurst(s, {
      filter: 'bandpass',
      freq: [2200, 620],
      q: 0.8,
      peak: 0.12,
      attack: 0.06,
      duration: 0.66,
      wet: 0.55,
    });
    return longest(0.38 + 0.16, pedal, settle);
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

/**
 * The match ending ON THE CLOCK, with both fighters still standing.
 *
 * ── Why this is a separate sound and not `matchEnd` with a different mood ───────
 *
 * `sim.ts` gained `resolveTimeout` this session. Before it, the clock ended nothing —
 * `phase` stayed `'playing'` forever and in practice the fog decided every long match,
 * so the ONLY way a match could end was a knockout and `matchEnd` was a complete
 * vocabulary. It is not any more. The HUD already stopped saying "defeated" for this
 * case because nobody was defeated, and audio holds the same line: a player who just
 * ran out of clock while alive must not hear the sound of being knocked out.
 *
 * Same reachability caveat as `ringFloor`: 0 of 363 scripted matches reached the
 * whistle (longest 25.1 s of a 45 s clock), and only forcing both fighters immortal
 * produces a timeout. The ending is real, deterministic and tested; it is the AI that
 * does not currently let a match get there.
 *
 * The whistle is the distinguishing layer and it is doing real work, not decoration.
 * `matchEnd` is four sustained notes with no noise in it at all; this opens with a
 * resonant, warbling band of noise at 2.9 kHz — a referee's whistle — which puts it in
 * a completely different part of the spectrum before a single note is played. Measured
 * through the production chain, the two separate by roughly 3x on spectral centroid,
 * which is a wider gap than any pair in the eleven-character identity ladder.
 *
 * The verdict still follows, and still differs win from loss: a timeout is not a draw
 * (`GameEvent.match-ended` requires a non-null winner — see `docs/DECISIONS-FOR-URI.md`
 * §2, where the draw question is parked for Uri). It is deliberately three notes rather
 * than `matchEnd`'s four, and it arrives after the whistle rather than opening the
 * sound, so "the clock decided this" is heard BEFORE "and you won".
 */
export function matchEndTimeout(won: boolean): SoundFn {
  const notes = won ? [523.25, 659.25, 1046.5] : [587.33, 493.88, 392];
  /** How long the whistle occupies before the verdict starts. */
  const WHISTLE = 0.62;
  return (s) => {
    // Two blasts, the second shorter — the universal "time" gesture. The tremolo is
    // what makes it a whistle rather than a kettle: a real pea whistle warbles at a
    // few tens of Hz, and `--mode coverage` asserts that modulation is measurable
    // rather than merely requested.
    const blast = (at: number, dur: number): number => {
      noiseBurst(
        { ...s, when: s.when + at },
        {
          filter: 'bandpass',
          freq: 2900,
          // Q and level are set together and were measured together. At q=16 the
          // passband is ~180 Hz wide, so the layer PEAKED loud and carried almost no
          // ENERGY: its share of the 1.97-3.96 kHz band came out at 6.2%, BELOW the
          // 8.5% that `matchEnd`'s square-wave harmonics put there by accident. A
          // whistle that measures duller than the sound it is supposed to distinguish
          // itself from is the invisible-render failure in audio form
          // (`docs/LESSONS.md` §1) — present in the code, absent from the output.
          q: 10,
          peak: 0.7,
          attack: 0.012,
          hold: 0.45,
          duration: dur,
          // 0.7, not 0.5. `tremoloNode` oscillates about `1 - depth/2`, so depth 0.5 is
          // only a 0.75 +/- 0.25 swing.
          tremolo: { rate: 24, depth: 0.7 },
          // 0.06, and this is the whole reason the warble is measurable at all.
          //
          // At 0.22 a matched A/B — this exact layer rendered with the tremolo ON and
          // OFF at five identical seeds — demodulated to 26.9 Hz and 28.7 Hz. The same
          // number. The LFO was connected, running, and contributing nothing an
          // instrument could find, which is this project's signature failure
          // (`docs/LESSONS.md` §1) in its audio form.
          //
          // `weapons/pizza.ts` had already found and documented the mechanism: reverb
          // FILLS A TREMOLO'S TROUGHS, because the reflections of one peak arrive during
          // the next dip. Its send scales as `0.1 * min(1, 16/spinHz)`, which at this
          // 24 Hz rate gives 0.067. A whistle blast is a close, dry, loud thing anyway,
          // so the physics and the measurement agree.
          wet: 0.06,
        },
      );
      return at + dur;
    };
    blast(0, 0.26);
    const whistleEnd = blast(0.36, 0.22);
    // A low buzzer under both blasts, so the whistle has a body and reads as an
    // announcement over a PA rather than as something small and shrill. Deliberately
    // well under the whistle: at 0.22 it was the loudest thing in the first 0.6 s and
    // it carries no modulation, which is what flattened the warble measurement.
    const buzz = tone(s, {
      type: 'sawtooth',
      freq: [150, 132],
      lowpass: [1100, 420],
      peak: 0.14,
      attack: 0.01,
      hold: 0.5,
      duration: 0.58,
      drive: 1.8,
      voices: 2,
      detuneCents: 22,
      wet: 0.2,
    });
    // The verdict, after the whistle.
    notes.forEach((f, i) => {
      tone(
        { ...s, when: s.when + WHISTLE + i * 0.1 },
        {
          type: won ? 'square' : 'sawtooth',
          freq: f,
          lowpass: won ? [3600, 2200] : [1600, 500],
          peak: 0.24,
          attack: 0.008,
          hold: 0.3,
          duration: 0.36,
          voices: 2,
          detuneCents: won ? 9 : 16,
          wet: 0.34,
        },
      );
    });
    return longest(whistleEnd, buzz, WHISTLE + (notes.length - 1) * 0.1 + 0.36);
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
