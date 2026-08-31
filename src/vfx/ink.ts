/**
 * ── SQUID INK: THE ONE-WRITER / ONE-READER CHANNEL BETWEEN THE SIM AND THE VIEW ──
 *
 * Uri, verbatim: *"Ink spray that blots their screen imparing their ability to see
 * (actual disturbance like ink blots across the screen for the users that got hit"*.
 *
 * `rules.ts:ITEMS.squid_ink.look` calls it *"THE ONLY ITEM WHOSE MAIN EXPRESSION IS NOT
 * IN THE WORLD"*, and `state.ts:ItemState.blotUntil` is explicit that the sim half is a
 * flag with a deadline and nothing else: the sim renders nothing, DECIDES nothing on it,
 * and a blinded fighter behaves identically to a sighted one inside the simulation. The
 * entire effect is what one human can see.
 *
 * ── WHY THIS FILE EXISTS AT ALL, WHICH IS AN OWNERSHIP ANSWER AND NOT A DESIGN ONE ──
 *
 * The two halves of this effect live in two files:
 *
 *   `game/vfx.ts`     observes the sim. Its `sync(state)` is the only per-frame call in
 *                     the presentation layer that is handed a live `MatchState`, so it is
 *                     the only place that can read `localFighter(state).item.blotUntil`.
 *   `render/stage.ts` owns the post chain. It is the only place that can draw a
 *                     screen-space effect, and it is never handed a `MatchState`.
 *
 * Neither holds a reference to the other. The obvious wiring — pass the `Stage` into
 * `VfxLayer`, or add an `item-hit` case to `match.ts`'s event switch — changes a
 * constructor signature or an event handler in **`match.ts`, which this track does not
 * own**. So the seam is a module: `vfx.ts` writes, `stage.ts` reads, both files belong to
 * the same owner, and `match.ts` is not touched.
 *
 * ⚠️ **IT IS MODULE STATE, AND THAT IS DEFENSIBLE HERE FOR A REASON THAT WOULD NOT
 * GENERALISE.** A module-level singleton is the wrong shape for anything the sim owns —
 * the sim seats six fighters and every one of them is a peer. This is not that: it is a
 * property of the SCREEN, and `roster.ts:LOCAL_SLOT` records at length that the renderer
 * is *"one human's client"* where the sim is symmetric. There is exactly one screen, one
 * camera and one post chain per page, so there is exactly one ink state. If a second
 * human seat ever ships on one page, this becomes a field on whatever object owns that
 * seat — the same sentence `LOCAL_SLOT` already carries.
 *
 * Nothing here imports THREE, so `render/stage.ts` importing it introduces no cycle:
 * `game/vfx.ts` already imports `render/toon.ts` and `render/lighting.ts`.
 */

/** How the blot field is laid out. Read by `stage.ts` to size its uniform array. */
export const INK_DISC_COUNT = 15;

/**
 * Fade in, ms. Fast enough that the hit and the blindness are one event, slow enough
 * that the frame does not snap — a step change on a full-screen effect is the shape that
 * reads as a rendering fault rather than as a thing that happened to you.
 */
export const INK_FADE_IN_MS = 180;

/**
 * Fade out, ms. Deliberately much longer than the fade in and deliberately the LAST
 * slice of the state rather than an extra tail after it: `ITEM_TUNING.squid_ink.blotMs`
 * is Uri's five seconds and the effect must be gone at exactly five seconds, not at five
 * plus a fade. So the envelope reaches 0 at the deadline and the sim's flag and the
 * picture expire on the same millisecond.
 */
export const INK_FADE_OUT_MS = 900;

/**
 * ── THE ENVELOPE, AS A PURE FUNCTION, SO IT CAN BE TESTED WITHOUT A GPU ──────
 *
 * `remainingMs` is `blotUntil - elapsed`; `totalMs` is the duration the status was
 * applied for. Returns 0..1.
 *
 * ⚠️ **THE `<= 0` ARM IS THE "CLEARS CLEANLY ON EXPIRY" REQUIREMENT AND IT RETURNS AN
 * EXACT ZERO**, never a small number. `stage.ts` bypasses the whole pass on exactly
 * `amount === 0`, so an envelope that asymptotes instead of terminating would leave a
 * fullscreen shader running for the rest of the match at an amplitude nobody can see —
 * `docs/LESSONS.md` §1's shape, with the sign flipped.
 */
export function inkEnvelope(remainingMs: number, totalMs: number): number {
  if (!(remainingMs > 0) || !(totalMs > 0)) return 0;
  const elapsed = totalMs - remainingMs;
  // Both ramps are clamped independently and multiplied, so a status SHORTER than
  // `INK_FADE_IN_MS + INK_FADE_OUT_MS` still peaks somewhere in the middle instead of
  // producing a discontinuity where the two windows overlap.
  const rise = Math.min(1, Math.max(0, elapsed / INK_FADE_IN_MS));
  const fall = Math.min(1, Math.max(0, remainingMs / INK_FADE_OUT_MS));
  return Math.min(rise, fall);
}

/**
 * ── THE BLOT LAYOUT, COMPUTED IN JS AND NOT IN THE SHADER ────────────────────
 *
 * Fifteen discs, unioned in the shader into four or five organic masses. Discs rather
 * than a lobed radial function because a lobed one needs `atan` per disc per pixel and a
 * disc needs one dot product; the union of three overlapping discs reads as an ink blot
 * and costs a third of the instructions.
 *
 * 🚨 **PLACED HERE SO THE LAYOUT RULE IS READABLE AND ARGUABLE, NOT HASHED PER PIXEL.**
 * The two constraints below are design decisions, and a `fract(sin(...))` in the fragment
 * shader would bury both of them in a magic constant:
 *
 *  1. **A SPARED DISC AROUND THE SUBJECT.** The camera follows your own fighter, so the
 *     centre of the frame is *you*. Uri asked for impairment, not for a black screen —
 *     *"imparing their ability to see"*. Covering your own body would not impair you, it
 *     would disorient you: you would not know where you were standing. So the layout
 *     refuses to place a disc whose core overlaps `SPARE`, and what the ink takes away is
 *     the ARENA — where the other five fighters are, where the fog is — which is exactly
 *     the information the item is supposed to deny.
 *  2. **NO PER-FRAME MOTION.** The layout is a pure function of the seed and is computed
 *     ONCE per cast. The only thing that moves for the whole five seconds is the fade and
 *     a slow downward sag (`stage.ts`'s `inkAge`), which is monotone. Oscillating,
 *     swimming or jittering full-screen distortion is the specific thing that makes a
 *     post effect nauseating, and it is a requirement of this item that it not be.
 *
 * Coordinates are in ASPECT-CORRECTED screen space — x scaled by the aspect ratio, so a
 * disc is round on every device and the layout does not restack on a phone.
 */

/** Centre of the spared disc, in uv. Below centre because the rig looks ahead of the
 * subject, so the subject sits low of the frame's middle. Verified against the measured
 * projection of the local fighter rather than assumed — see `tools/tmp/ev_ink.mjs`. */
export const INK_SPARE_UV = { x: 0.5, y: 0.56 } as const;
/** Radius of the spared disc, in aspect-corrected units (y is the unit axis). */
export const INK_SPARE_R = 0.17;

export interface InkDisc { x: number; y: number; r: number }

/**
 * Deterministic layout for a given seed. Same seed, same discs, on every device and every
 * run — which is what lets a probe measure occlusion as an EXACT number rather than as a
 * sample from a distribution.
 */
export function inkLayout(seed: number, aspect: number): InkDisc[] {
  // A small integer hash, so the layout is reproducible across engines. `Math.sin`-based
  // hashing is not: its low bits differ between implementations, and this number ends up
  // in a reported occlusion figure.
  let s = (Math.floor(seed * 2654435761) ^ 0x9e3779b9) >>> 0;
  const rnd = (): number => {
    s = (s ^ (s << 13)) >>> 0;
    s = (s ^ (s >>> 17)) >>> 0;
    s = (s ^ (s << 5)) >>> 0;
    return s / 4294967296;
  };

  const out: InkDisc[] = [];
  // Aspect-corrected extent of the frame: y spans 0..1, x spans 0..aspect.
  const spareX = INK_SPARE_UV.x * aspect;
  const spareY = INK_SPARE_UV.y;

  // Four clusters of 3-4 discs each. A cluster is a seat plus satellites, so the union
  // reads as one splat with lobes rather than as a row of circles — the same defect
  // `vfx.ts:buildGlazeMarkTexture` records for ground marks.
  const clusters = 4;
  for (let c = 0; c < clusters; c++) {
    // Seat the cluster on a ring around the spared disc, at a jittered bearing, so the
    // four masses are spread rather than clumped on one side. The ring radius is large
    // enough that a cluster's core clears `SPARE` by construction and small enough that
    // the cluster is on screen.
    const ang = ((c + rnd() * 0.55) / clusters) * Math.PI * 2;
    const ring = INK_SPARE_R + 0.20 + rnd() * 0.26;
    const cx = spareX + Math.cos(ang) * ring * aspect * 0.92;
    const cy = spareY + Math.sin(ang) * ring * 1.25;
    const seatR = 0.15 + rnd() * 0.07;
    const members = 3 + (rnd() > 0.5 ? 1 : 0);
    for (let m = 0; m < members; m++) {
      const off = m === 0 ? 0 : seatR * (0.55 + rnd() * 0.55);
      const oa = rnd() * Math.PI * 2;
      const r = m === 0 ? seatR : seatR * (0.42 + rnd() * 0.38);
      const x = cx + Math.cos(oa) * off;
      const y = cy + Math.sin(oa) * off;
      // CONSTRAINT 1, enforced rather than hoped for: a disc whose CORE would cover the
      // subject is pushed radially out until it does not. Pushed and not dropped, so the
      // disc count is a constant and the shader's loop bound never depends on the seed.
      const dx = x - spareX;
      const dy = y - spareY;
      const d = Math.hypot(dx, dy) || 1e-6;
      const need = INK_SPARE_R + r * 0.55;
      const k = d < need ? need / d : 1;
      out.push({ x: spareX + dx * k, y: spareY + dy * k, r });
    }
  }
  // Pad or trim to exactly INK_DISC_COUNT. The shader's array is fixed-size and a short
  // array would leave stale discs from the previous cast in the tail.
  while (out.length < INK_DISC_COUNT) out.push({ x: -9, y: -9, r: 0 });
  return out.slice(0, INK_DISC_COUNT);
}

/**
 * The live channel. One writer (`game/vfx.ts:sync`), one reader
 * (`render/stage.ts:render`).
 */
export interface InkChannel {
  /** Envelope, 0..1. **Exactly 0 means the pass is bypassed.** */
  amount: number;
  /** 0..1 across the whole blot life, monotone. Drives the slow downward sag only. */
  age: number;
  /** Which layout. Changes once per cast. */
  seed: number;
  /** Bumped every time `seed` changes, so `stage.ts` can rebuild the uniform array
   * without comparing fifteen floats every frame. */
  revision: number;
}

const CHANNEL: InkChannel = { amount: 0, seed: 0, age: 0, revision: 0 };

/** Read the live channel. Never mutate the returned object. */
export function readInk(): Readonly<InkChannel> {
  return CHANNEL;
}

/**
 * Write the channel. `seed` only takes effect — and only bumps `revision` — when it
 * actually differs, so a five-second status produces exactly one layout.
 */
export function writeInk(amount: number, age: number, seed: number): void {
  CHANNEL.amount = amount;
  CHANNEL.age = age;
  if (seed !== CHANNEL.seed) {
    CHANNEL.seed = seed;
    CHANNEL.revision++;
  }
}

/**
 * Hard reset. Called by `VfxLayer.clear()` and `VfxLayer.dispose()`.
 *
 * ⚠️ **REQUIRED, NOT TIDINESS.** The channel outlives a match — it is module state — so a
 * player who dies inked, or who quits to the menu inked, would otherwise take the blots
 * with them into the lobby, which shares the same `Stage` class and the same post chain.
 * `revision` is deliberately NOT reset: it is a monotone counter and resetting it could
 * make a fresh cast's seed compare equal to a stale one.
 */
export function clearInk(): void {
  CHANNEL.amount = 0;
  CHANNEL.age = 0;
}
