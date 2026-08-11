/**
 * THE INPUT WIRE FORMAT — and the one rule that keeps it from desyncing.
 *
 * ══════════════════════════════════════════════════════════════════════════════
 *  🚨 THE QUANTISED VALUE MUST **BE** THE CANONICAL INPUT.
 * ══════════════════════════════════════════════════════════════════════════════
 *
 * A client that quantises on the way OUT and simulates from the raw float it started with is
 * running a different match from the host, by a hair, on every single tick. Under lockstep
 * that is a desync and it is invisible for minutes; under the authoritative model this project
 * chose (`DECISIONS §52`) it is *"only"* a permanent prediction error that reconciliation
 * fights every frame — a rubber band with no cause anyone can find.
 *
 * So `quantizeInput` is exported FIRST and `ClientSession.sendInput` returns it: the value you
 * feed your own sim is the value that went on the wire, by construction rather than by
 * discipline. `nw_wire.mjs --selftest` proves both halves — that `quantizeInput` is idempotent,
 * and that a RAW input does **not** survive the round trip, which is why the rule exists.
 *
 * ── THE LAYOUT ─────────────────────────────────────────────────────────────────
 *
 *   header   uint32 tick                                            4 B
 *            uint16 seat mask (bit i = slot i is present)           2 B
 *   per seat int8  move.x, int8 move.y        (1/127 quantum)       2 B
 *            int16 aim.x,  int16 aim.y  (1/32767, max-norm dir)   4 B
 *            uint8 flags: weapon 0..7 | attack<<3 | hasAim<<4       1 B
 *   ─────────────────────────────────────────────────────────────────────
 *                                                        7 B / seat / tick
 *
 * At the shipped 59.999 Hz that is **0.76 KiB/s up** for one seat and **2.83 KiB/s down** for
 * six. ⚠️ `NETCODE.md` §1 measured the payload and then said the thing that actually matters:
 * *"AT THESE SIZES THE PACKET HEADER IS THE MESSAGE"* — 60–90 B of UDP/IP/DTLS/SCTP framing
 * around a 13 B payload. **The lever is the send rate and batching, not the encoding.**
 *
 * ── ⚠️ A DELIBERATE DEVIATION FROM `NETCODE.md` §1'S 5-BYTE DESIGN, AND ITS REASON ──
 *
 * That design encoded aim as a **uint16 angle** (2π/65536 rad) — 5 B/seat instead of 7. It is
 * rejected here on the same axis that decided §52 itself: decoding an angle back to a facing
 * costs `Math.cos` and `Math.sin`, which are two of the **five implementation-approximated
 * trig call sites** §4 catalogues. Putting one of them on the *input decode path* would mean
 * the client's predicted facing and the host's authoritative facing could differ in the last
 * bit **because the two ran different JS engines**, for a saving of 2 bytes against a 60–90 B
 * packet header. Two int16 components are exact on every engine — the whole path is
 * `Math.abs`, `Math.max`, `Math.round` and `/`, every one of them IEEE-754 exact — and there is
 * no trig and no `Math.sqrt` anywhere on it.
 *
 * The second reason is gameplay rather than arithmetic: an int8-per-axis aim (the other way to
 * reach 5 B) quantises the player's aim to ~0.45° near the axes, which is ~3.9 wu of lateral
 * error at 500 wu against a ~21–25 wu hit radius. Small, real, and **not something we need to
 * buy**. int16 is 0.0017°.
 *
 * ⚠️ `move` IS still int8 and that IS a real gameplay quantisation — the analog thumb stick
 * lands on 254 steps per axis, a ≤0.8% speed error. It is accepted because the value that
 * matters is the one both ends agree on, and because `input.ts` already clamps the composite
 * to [-1,1]. ⚠️ `NETCODE.md` §1 flags that the measured input corpus has **3 distinct values
 * on `move.x`** because the scripted driver emits −1/0/+1 — so the quantum below is a design
 * choice, **not** something that corpus licenses.
 */

import type { MatchInput, Vec2 } from '../game/state.ts';

/** `move` axis quantum. int8 range is [-127, 127]; -128 is never emitted. */
const MOVE_SCALE = 127;
/** `aim` component quantum. int16 range is [-32767, 32767]; -32768 is never emitted. */
const AIM_SCALE = 32767;

export const INPUT_HEADER_BYTES = 6;
export const INPUT_SEAT_BYTES = 7;

/**
 * The highest weapon index the 3-bit field can carry.
 *
 * The roster's widest character has **4** weapons (`hamburger`, `sushi`, `waterbottle`), so 2
 * bits would fit today and 3 is one doubling of headroom. `encodeInputFrame` THROWS above this
 * rather than masking, because a silently masked weapon index is a player pressing 5 and firing
 * 1 — a bug that looks like an input bug and is a protocol bug.
 */
export const MAX_WEAPON_INDEX = 7;

function q8(v: number): number {
  if (!Number.isFinite(v)) return 0;
  return Math.max(-MOVE_SCALE, Math.min(MOVE_SCALE, Math.round(v * MOVE_SCALE)));
}
function q16(v: number): number {
  if (!Number.isFinite(v)) return 0;
  return Math.max(-AIM_SCALE, Math.min(AIM_SCALE, Math.round(v * AIM_SCALE)));
}

/**
 * THE CANONICAL FORM OF AN INPUT. Feed your own sim THIS, never the raw value.
 *
 * `quantizeInput(quantizeInput(x))` deep-equals `quantizeInput(x)` — asserted by the gate, not
 * assumed, because idempotence is the property that makes "the value on the wire is the value
 * I simulated" checkable at all.
 *
 * ⚠️ **AIM IS NORMALISED HERE, AND THAT IS NOT A TIDY-UP.** `sim.ts:applyAim` reads only the
 * DIRECTION and normalises internally, so an un-normalised aim of length 400 (a raw
 * screen-to-world delta, which is exactly what `match.ts` produces) would quantise to
 * `(32767, 32767)` — clamped, and pointing at 45° regardless of where the mouse was. The
 * normalisation has to happen before the quantum, on the sender, and the result is what both
 * ends simulate.
 *
 * 🚨 **AND IT IS A MAX-NORM, NOT A UNIT VECTOR, BECAUSE THE UNIT VECTOR IS NOT IDEMPOTENT.**
 * The first version divided by `Math.hypot`-style length and `nw_wire.mjs` caught it
 * immediately: **75 of 4,000 seeded inputs changed on the SECOND application.** The reason is
 * exact — after quantising, the stored pair has length `sqrt(nx²+ny²)/32767`, which is *near*
 * 1 and not 1, so re-normalising divides by something ≠ 1 and the re-rounding can land on a
 * different integer. Dividing by the LARGER component instead pins it to ±1 exactly, so a
 * second pass divides by 1 and rounds an integer to itself. **Fixed point by construction.**
 *
 * That is not a cosmetic property. `ClientSession.sendInput` predicts with the value it
 * returns, the host re-quantises what it decodes, and the whole "the quantised value IS the
 * input" rule rests on `q(q(x)) === q(x)`. A codec that drifts on re-application produces a
 * one-bit disagreement between client and host **only on the inputs that happen to sit near a
 * rounding boundary**, which is the least reproducible bug this layer could have.
 *
 * Direction is unharmed: the worst-case angular step is still ~0.0017°, the ray is identical,
 * and `applyAim` normalises internally so the magnitude never reaches gameplay. It also
 * removes the only `Math.sqrt` on the input path.
 *
 * A zero-length or absent aim stays absent: `MatchInput.aim` is documented as "omit to keep the
 * previous facing untouched", and turning that into `(0,0)` present-but-zero would be the same
 * statement only by luck of `applyAim`'s magnitude test.
 */
export function quantizeInput(input: MatchInput): MatchInput {
  const out: MatchInput = {
    move: { x: q8(input.move?.x ?? 0) / MOVE_SCALE, y: q8(input.move?.y ?? 0) / MOVE_SCALE },
    selectedWeapon: Math.max(0, Math.min(MAX_WEAPON_INDEX, Math.trunc(input.selectedWeapon) || 0)),
    attack: input.attack === true,
  };
  const aim = input.aim;
  if (aim && Number.isFinite(aim.x) && Number.isFinite(aim.y)) {
    const m = Math.max(Math.abs(aim.x), Math.abs(aim.y));
    if (m > 0) {
      const nx = q16(aim.x / m);
      const ny = q16(aim.y / m);
      if (nx !== 0 || ny !== 0) out.aim = { x: nx / AIM_SCALE, y: ny / AIM_SCALE };
    }
  }
  return out;
}

/** `NEUTRAL_INPUT`'s public twin — a fresh object each call, so a caller cannot freeze ours. */
export function neutralInput(): MatchInput {
  return { move: { x: 0, y: 0 }, selectedWeapon: 0, attack: false };
}

/**
 * Encode one tick's inputs.
 *
 * ⚠️ **AN ARRAY INDEXED BY SLOT, NEVER A MAP OR A RECORD.** `state.ts` states the rule at
 * `MatchInputs`: *"a keyed container's traversal order depends on insertion order, and a sim
 * whose determinism underwrites every balance number in the project cannot take an input whose
 * association depends on how the caller built it."* The seat MASK carries which slots are
 * present, so a hole and a neutral input are different statements on the wire as well as in
 * the sim.
 */
export function encodeInputFrame(tick: number, inputs: readonly (MatchInput | null | undefined)[]): Uint8Array {
  if (!Number.isInteger(tick) || tick < 0 || tick > 0xffffffff) {
    throw new RangeError(`encodeInputFrame: tick ${tick} does not fit in uint32`);
  }
  if (inputs.length > 16) {
    throw new RangeError(`encodeInputFrame: ${inputs.length} seats, the uint16 mask carries 16`);
  }
  let mask = 0;
  const present: { slot: number; input: MatchInput }[] = [];
  for (let i = 0; i < inputs.length; i++) {
    const raw = inputs[i];
    if (raw === null || raw === undefined) continue;
    if (!Number.isInteger(raw.selectedWeapon) || raw.selectedWeapon < 0 || raw.selectedWeapon > MAX_WEAPON_INDEX) {
      throw new RangeError(`encodeInputFrame: slot ${i} selectedWeapon ${raw.selectedWeapon}`
        + ` outside 0..${MAX_WEAPON_INDEX}`);
    }
    mask |= 1 << i;
    present.push({ slot: i, input: raw });
  }

  const bytes = new Uint8Array(INPUT_HEADER_BYTES + present.length * INPUT_SEAT_BYTES);
  const view = new DataView(bytes.buffer);
  view.setUint32(0, tick, true);
  view.setUint16(4, mask, true);
  let off = INPUT_HEADER_BYTES;
  // Ascending slot order, which is the same order the mask is read back in. Stated once so
  // the two cannot drift: the decoder walks bits 0..15 upward.
  for (const { input } of present) {
    view.setInt8(off, q8(input.move?.x ?? 0));
    view.setInt8(off + 1, q8(input.move?.y ?? 0));
    const aim = input.aim;
    const hasAim = aim !== undefined && aim !== null && (aim.x !== 0 || aim.y !== 0);
    view.setInt16(off + 2, hasAim ? q16(aim.x) : 0, true);
    view.setInt16(off + 4, hasAim ? q16(aim.y) : 0, true);
    view.setUint8(off + 6, (input.selectedWeapon & 0x07) | (input.attack ? 0x08 : 0) | (hasAim ? 0x10 : 0));
    off += INPUT_SEAT_BYTES;
  }
  return bytes;
}

export interface DecodedInputFrame {
  tick: number;
  /**
   * Slot-indexed and DENSE up to the highest present slot. A slot with no input is `null` —
   * `stepMatch` reads that as `NEUTRAL_INPUT` ("a seat with nobody in it stands still rather
   * than inheriting its neighbour's controls"), which is a different statement from a present
   * neutral input and the host distinguishes them.
   */
  inputs: (MatchInput | null)[];
  /** The raw seat mask, so a receiver can check authority without inspecting the array. */
  seatMask: number;
}

export function decodeInputFrame(bytes: Uint8Array): DecodedInputFrame {
  if (bytes.byteLength < INPUT_HEADER_BYTES) {
    throw new RangeError(`decodeInputFrame: ${bytes.byteLength} bytes, header is ${INPUT_HEADER_BYTES}`);
  }
  const view = new DataView(bytes.buffer, bytes.byteOffset, bytes.byteLength);
  const tick = view.getUint32(0, true);
  const seatMask = view.getUint16(4, true);
  let count = 0;
  for (let i = 0; i < 16; i++) if (seatMask & (1 << i)) count++;
  const expected = INPUT_HEADER_BYTES + count * INPUT_SEAT_BYTES;
  if (bytes.byteLength !== expected) {
    throw new RangeError(`decodeInputFrame: mask 0x${seatMask.toString(16)} implies ${expected} bytes,`
      + ` got ${bytes.byteLength}`);
  }

  const highest = seatMask === 0 ? -1 : 31 - Math.clz32(seatMask);
  const inputs: (MatchInput | null)[] = new Array<MatchInput | null>(highest + 1).fill(null);
  let off = INPUT_HEADER_BYTES;
  for (let slot = 0; slot <= highest; slot++) {
    if (!(seatMask & (1 << slot))) continue;
    const mx = view.getInt8(off) / MOVE_SCALE;
    const my = view.getInt8(off + 1) / MOVE_SCALE;
    const ax = view.getInt16(off + 2, true) / AIM_SCALE;
    const ay = view.getInt16(off + 4, true) / AIM_SCALE;
    const flags = view.getUint8(off + 6);
    const input: MatchInput = {
      move: { x: mx, y: my },
      selectedWeapon: flags & 0x07,
      attack: (flags & 0x08) !== 0,
    };
    if ((flags & 0x10) !== 0) input.aim = { x: ax, y: ay } satisfies Vec2;
    inputs[slot] = input;
    off += INPUT_SEAT_BYTES;
  }
  return { tick, inputs, seatMask };
}

// ─────────────────────────────────────────────────────────────────────────────
// Byte transport for a text channel
// ─────────────────────────────────────────────────────────────────────────────

const B64 = 'ABCDEFGHIJKLMNOPQRSTUVWXYZabcdefghijklmnopqrstuvwxyz0123456789+/';

/**
 * Base64 without `btoa`.
 *
 * ⚠️ Hand-rolled rather than `btoa(String.fromCharCode(...bytes))` for two reasons that both
 * bite in this repo: the spread form blows the argument limit on a large frame, and `btoa`
 * exists in Node **and in the browser** but with different edge behaviour on lone surrogates,
 * which is exactly the class of "works in the instrument, fails in the app" defect
 * `docs/LESSONS.md` records under *measure the artefact you SHIP*.
 */
export function bytesToB64(bytes: Uint8Array): string {
  let out = '';
  let i = 0;
  for (; i + 2 < bytes.length; i += 3) {
    const n = (bytes[i] << 16) | (bytes[i + 1] << 8) | bytes[i + 2];
    out += B64[(n >>> 18) & 63] + B64[(n >>> 12) & 63] + B64[(n >>> 6) & 63] + B64[n & 63];
  }
  const rem = bytes.length - i;
  if (rem === 1) {
    const n = bytes[i] << 16;
    out += `${B64[(n >>> 18) & 63]}${B64[(n >>> 12) & 63]}==`;
  } else if (rem === 2) {
    const n = (bytes[i] << 16) | (bytes[i + 1] << 8);
    out += `${B64[(n >>> 18) & 63]}${B64[(n >>> 12) & 63]}${B64[(n >>> 6) & 63]}=`;
  }
  return out;
}

export function b64ToBytes(s: string): Uint8Array {
  const clean = s.replace(/=+$/, '');
  const out = new Uint8Array((clean.length * 3) >> 2);
  let acc = 0;
  let bits = 0;
  let o = 0;
  for (let i = 0; i < clean.length; i++) {
    const idx = B64.indexOf(clean[i]);
    if (idx < 0) throw new RangeError(`b64ToBytes: byte ${i} is not base64`);
    acc = (acc << 6) | idx;
    bits += 6;
    if (bits >= 8) {
      bits -= 8;
      out[o++] = (acc >>> bits) & 0xff;
    }
  }
  return out.subarray(0, o);
}
