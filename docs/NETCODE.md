# Netcode — authoritative server vs lockstep vs rollback, decided on measurements

> **Nothing here is a decision.** The transport is parked for Uri as
> **`docs/DECISIONS-FOR-URI.md` §52**. This file is the evidence under it: every number below
> comes out of `node tools/tmp/nc_measure.mjs` against this tree, and the tool validates each
> of its own instruments against a known-bad input first (`--selftest`, 18/18).
>
> Measured on `HEAD` = `e876c3d`, node v24.15.0, darwin/arm64, seven sim files hashed before
> and after the run and identical. `dt` 16.667 ms → 59.999 ticks/s.

---

## The one-screen answer

| | authoritative server | lockstep | rollback |
|---|---|---|---|
| **client → server, per client** | 0.64 KiB/s compact · 5.8 KiB/s JSON | 0.64 KiB/s | 0.64 KiB/s |
| **→ client, N=6** | 12.9 KiB/s binary delta @60 Hz · 26.0 KiB/s JSON delta @20 Hz | 2.11 KiB/s (everyone's inputs) | 2.11 KiB/s + periodic sync |
| **CPU on the machine of record, N=6 humans** | **2.66 µs/tick** (0.016% of real time) | same, but on **every** client | same × rollback depth |
| **CPU when the match has 5 bots** | 399.50 µs/tick (2.40%) | same, on every client, **including the phone** | **× depth: 3.2 ms per 8-tick rollback = 19% of a frame** |
| **needs bit-identical floats across browser engines?** | **no** | **yes — 32 impl-approximated call sites** | **yes — same 32** |
| **needs `MatchState` to serialise?** | **yes — and it does not today** (§6) | **no** | only for the initial sync |
| **replays the `GameEvent[]` stream?** | no | no | **yes — 0.335 events/tick get re-emitted** |
| **survives a modified client?** | yes | no | no |
| **needs server infrastructure?** | yes (or a host peer) | signalling only | signalling only |

**Recommendation: authoritative simulation with client-side prediction of the local fighter —
run first as a HOST PEER (one client authoritative, WebRTC to the rest), later as a Node process,
because the sim runs unchanged in both.**

✅ **DECIDED (`DECISIONS §52`, 2026-08-11) and now BUILT as infrastructure — see `src/net/`.**
The wire format, the transport seam, the loopback, the host peer, prediction/reconciliation and
the lobby/league model all exist and are gated by `tools/tmp/nw_wire.mjs` and
`tools/tmp/nw_stack.mjs`. ⚠️ **No real transport, no signalling, no server and no delta
compression** — read `nw_stack.mjs`'s header for the exact list of what the loopback can and
cannot prove before quoting any of it.

**The number that decides it: 2.66 µs.** That is one six-human tick — 0.016% of real time,
≈ 6,260 concurrent matches per core. Server CPU is the *only* resource an authoritative design
spends that lockstep saves, and here it is free. Lockstep's remaining advantages are bandwidth
(2.11 vs 12.9 KiB/s — both irrelevant) and zero serialisation work; its cost is 32
implementation-approximated float call sites that must agree bit-for-bit on V8, JavaScriptCore
*and* SpiderMonkey, which **cannot be bought with a measurement** — only with a rewrite of those
32 sites and a cross-engine rig this repo does not have.

⚠️ **A recommendation is not a decision.** §52 lays out what each choice forecloses.

---

## 0. The property this whole document is about

The sim is **pure, deterministic and seeded**, and that is not a claim — it is
`cdcdd65` + `1b506d6`'s acceptance corpus: bit-identical at N=2 over **26,388,976 ticks and
7,039,194 events in order**, and **38/38** self-consistency rows at N=3–6. `stepMatch(state, dt,
inputs)` returns a typed `GameEvent[]` and touches nothing else.

**Every design below spends or preserves that property, and that is the axis to judge them on.**

Two things follow immediately, and they are the reason this decision is even open:

* **`stepMatch` already takes one input per slot.** `MatchInputs = MatchInput | readonly
  (MatchInput | null | undefined)[]`. A second human seat is a *transport* problem, not a sim
  problem — there is no signature to change and no call site to visit.
* **`MatchState.fighters` is an ARRAY, never a `Map`.** `state.ts` says why out loud: *"a `Map`
  traverses in INSERTION order … that is the classic lockstep desync mechanism."* Somebody
  already built this thing with a wire in mind.

---

## 1. What is the input?

`node tools/tmp/nc_measure.mjs` §1 — 16,338 single-seat inputs and 25,470 whole-tick arrays,
harvested from real matches at N=2 and N=6.

`MatchInput` is `move: Vec2` (each axis independently in [-1,1], deliberately **not** normalised),
an optional `aim: Vec2` (only its direction is read — `applyAim` normalises internally),
`selectedWeapon` (0..3) and `attack: boolean`.

| encoding | N=2 | N=6 |
|---|---|---|
| JSON, whole tick | **199.8 B** mean / 229 max | **635.3 B** mean / 680 max |
| JSON, one seat | 98.4 B mean / 114 max | (same field set) |
| compact binary | **16 B** | **36 B** |

The compact encoding, and the one rule that makes it safe:

```
move    2 × int8, 1/127 quantum                                    2 B
aim     uint16 angle (2π/65536 rad), 0xFFFF = "no aim this tick"   2 B
weapon  2 bits   attack 1 bit   (one shared byte)                  1 B
────────────────────────────────────────────────────────────────────
                                                       5 B / seat / tick
+ uint32 tick + uint16 seat mask                                   6 B
```

🚨 **The quantised value must BE the canonical input.** The client feeds its own sim the *decoded*
value, never the raw float it started from. Quantising on the way out and simulating on the way in
from the raw float is the classic lockstep desync, and it is invisible for minutes.

### Bandwidth at the shipped tick rate (59.999 Hz)

| | N=2 | N=6 |
|---|---|---|
| JSON, whole tick | 11.71 KiB/s | 37.22 KiB/s |
| compact, one seat **up** | **0.64 KiB/s** | **0.64 KiB/s** |
| compact, all seats **down** | 0.94 KiB/s | **2.11 KiB/s** |

🚨 **AT THESE SIZES THE PACKET HEADER IS THE MESSAGE.** A WebRTC DataChannel message carries
roughly 60–90 B of UDP/IP + DTLS + SCTP framing. A 16 B input payload therefore travels in a
~80–105 B packet: **the payload is 15–20% of the wire cost.** So the lever that matters is the
SEND RATE and BATCHING, not the encoding — sending inputs at 30 Hz in pairs halves the wire cost
and changes the payload not at all. (Standard protocol arithmetic, *not* a measurement of this
repo — see "what could not be measured".)

⚠️ **The observed domains are the DRIVER's, not a human's.** The corpus reports `move.x` taking
**3 distinct values** — because `scripted_player.mjs` emits −1/0/+1. `input.ts:253` clamps
`x + touch.move.x` to [−1,1] and **the touch stick is analog**, so a real player's `move` is
continuous. The int8 quantum above is a design choice; it is not licensed by this corpus.

---

## 2. What is the state?

`nc_measure` §2, on `comparable(state)` — `conceal_lab.mjs`'s own exclusion list (the shared
`arena` object and function-valued keys), reused rather than reinvented.

| | N=2 | N=6 |
|---|---|---|
| **full snapshot, JSON** mean | **3,417 B** | **8,126 B** |
| p50 / p99 / max | 2,843 / 7,287 / 10,125 | 7,488 / 13,803 / **17,089** |
| leaf fields (max) | 539 | **918** |
| — of which numeric | 381 | 678 |
| **float32 floor** (numeric leaves × 4 B) | **1,524 B** | **2,712 B** |
| peak projectiles / trail marks / splats | 13 / 27 / 5 | 15 / 27 / 7 |

### What a delta costs

| | N=2 | N=6 |
|---|---|---|
| **changed leaves per tick** mean | **17.9** | **35.9** |
| p99 / max | 106 / 210 | 161 / 338 |
| delta as `{path: value}` JSON | 641 B mean | 1,329 B mean |
| **delta as (uint16 field id + float32)** | **~111 B** | **~220 B** |

⚠️ The `{path: value}` figure spends the **path string** on every field. A real delta protocol
spends a field index. Both are printed because **the gap between them is exactly the engineering
a delta protocol IS** — a stable field-id table that must be regenerated whenever `state.ts`
gains a field, which is the "one rule stated once and implemented twice" shape this project has
been bitten by repeatedly.

### Downstream bandwidth, per client

| | N=2 | N=6 |
|---|---|---|
| full snapshot @60 Hz | 200.2 KiB/s | 476.1 KiB/s |
| full snapshot @20 Hz | 66.7 KiB/s | 158.7 KiB/s |
| JSON delta @60 Hz | 37.5 KiB/s | 77.9 KiB/s |
| JSON delta @20 Hz | 12.5 KiB/s | 26.0 KiB/s |
| **binary delta @60 Hz** | **6.5 KiB/s** | **12.9 KiB/s** |
| **binary delta @20 Hz** | 2.2 KiB/s | **4.3 KiB/s** |

**Read:** even the *dumbest* option — a full JSON snapshot 20 times a second at six seats — is
158.7 KiB/s ≈ 1.3 Mbit/s. That is a bad protocol, and it still fits on a phone. **Bandwidth does
not decide this.**

---

## 3. Can it rollback?

`stepMatch` is a pure function of `(state, dt, inputs)`, so yes, mechanically. The question is
what a re-simulation costs. `nc_measure` §3, **over playing ticks only** — `stepMatch` runs no
fighter loop at all during the 5.7 s countdown, which on a short match is half the corpus.

| arm | playing ticks | mean | p50 | p99 | % of a 16.667 ms frame | matches/core @1× |
|---|---|---|---|---|---|---|
| N=2, 1 human + 1 AI *(what ships)* | 5,706 | 28.64 µs | 4.13 | 183.88 | 0.172% | 581 |
| N=2, both AI | 10,158 | 244.16 µs | 259.63 | 471.50 | 1.465% | 68 |
| **N=2, both human** | 6,409 | **0.94 µs** | 0.58 | 2.04 | 0.006% | 17,775 |
| **N=6, all AI** | 12,356 | **399.50 µs** | 317.08 | 933.46 | 2.397% | **41** |
| **N=6, all human** | 15,541 | **2.66 µs** | 1.50 | 6.96 | 0.016% | **6,260** |

### Save and restore — not in `stepMatch`, and rollback pays it every tick

| | N=2 | N=6 |
|---|---|---|
| **hand clone** (arena by reference) | **0.482 µs** | **0.891 µs** |
| `structuredClone` (deep-copies the arena too) | 22.59 µs | 36.94 µs |
| JSON round trip | 19.01 µs | 33.70 µs — **and it is broken, see §6** |

### The rollback budget

Re-simulating *d* ticks costs `d × (step + restore)`:

| depth | N=6 all human | N=6 all AI | N=6 all AI @p99 |
|---|---|---|---|
| 4 ticks (~67 ms) | 14 µs — **0.09%** of a frame | 1.60 ms — 9.6% | 3.74 ms — 22% |
| 8 ticks (~133 ms) | 28 µs — **0.17%** | **3.20 ms — 19.2%** | 7.48 ms — **45%** |
| 30 ticks (~500 ms) | 107 µs — 0.64% | 12.0 ms — **72%** | 28.0 ms — **over budget** |

**Rollback is essentially free for a six-human match and expensive the moment the match contains
bots** — and a live 6-player game fills empty seats with bots. That is the arm that breaks, and
§5 says exactly why.

### The cost rollback pays that neither of the others does

`stepMatch` **returns** `GameEvent[]`, and four consumers are built on it: `game/match.ts`,
`game/vfx.ts`, `ui/hud.ts`, `audio/director.ts`. `cdcdd65` spent a whole step establishing that
the event stream is half the sim's contract and that comparing state alone was *"only half a
proof"*.

**Re-simulating a tick re-emits its events.** From `1b506d6`'s N=6 corpus: 16,462 events over
49,203 ticks = **0.335 events/tick**, so an 8-tick rollback re-fires ~2.7 events that already
played — every one of them a damage number, an explosion, a hit-stop and a note of the score.
A rollback design must therefore either suppress the stream during re-simulation or make every
consumer idempotent. **Lockstep and the authoritative server never replay a tick and never pay
this.** It is not a hard problem; it is a whole subsystem, and it is invisible until you build it.

---

## 4. What breaks determinism today?

### Nothing in the sim. Measured, not grepped.

`nc_measure` §4 patches a counter onto `Math.random` and runs a real corpus:

> **0 draws over 17,628 real ticks.**

The counter is validated (`--selftest` §D1: it counts a draw the test makes itself), so the zero
is a measurement rather than a broken probe. `rules.ts` already carries the claim as a comment —
*"`grep -rn 'Math.random' src/game/{sim,state,combat,ai,movement}.ts` returns NOTHING"* — but a
comment stating a grep result is a grep result from whenever somebody wrote it.

Static census of the six sim modules, **comments stripped**:

| | count | where |
|---|---|---|
| `Math.random` | **0** | — |
| `Date.now` / `performance.now` / `new Date` | **0** | — |
| `new Map` / `new Set` | **0** | — |
| `for…in` (key-order dependent) | **0** | — |
| `Object.keys/entries/values` | 1 | `rules.ts` (`kitSignature`, a test helper) |
| `.sort(` | 2 | `sim.ts:resolveTimeout` (total comparator, ends on `id`), `rules.ts` |
| **`Math.hypot`** — *implementation-approximated* | **27** | sim 13 · ai 4 · movement 7 · combat 2 · state 1 |
| **`Math.sin/cos`** — *implementation-approximated* | **3** | ai 1 · combat 2 |
| **`Math.atan2/acos`** — *implementation-approximated* | **2** | combat 2 |
| `Math.sqrt` / `Math.pow` / `**` | 0 | — |

### So the streams a lockstep design would have to pin are:

1. **None inside the sim.** There is no RNG stream to seed and no clock to freeze. That is the
   rare property, and it is the whole reason lockstep is on the table at all.
2. **The renderer's, and only for the picture.** `3980e6e` measured this and it does not need
   re-deriving: **22,744 of 23,060 `Math.random` draws in a booted client are
   `THREE.MathUtils.generateUUID`** — object ids, reaching no pixel. **Only 309 draws reach a
   pixel** (`camera.ts:shake` 3 per kick; `vfx.ts` from 29 sites; `arena/{ambient,floor,apron,
   textures}.ts` at build time). None of them is in the sim, so **none of them can desync a
   match** under any of the three designs. They govern whether two clients see the *same sparks*,
   which is a cosmetic question and not a netcode one.
3. 🚨 **The 32 implementation-approximated float call sites.** `Math.hypot`, `Math.sin`,
   `Math.cos`, `Math.atan2` and `Math.acos` are *implementation-approximated* in ECMAScript — the
   spec does not pin their last bits, and V8, JavaScriptCore and SpiderMonkey are free to differ.
   `+`, `−`, `×`, `÷` and `Math.sqrt` are IEEE-754 exact and are **not** a hazard.

   One ulp is enough. `nearestLivingOpponent` ranks by `Math.hypot`; a last-bit disagreement
   picks a different target on one client, and from that tick the two matches are different
   games. This is the load-bearing risk in both lockstep and rollback, and it is the one thing
   in this document that **could not be measured here** — see the last section.

   The scoped fix, if lockstep is chosen: replace all 27 `Math.hypot(a,b)` with
   `Math.sqrt(a*a + b*b)` (exact), and route the 5 trig sites through a fixed polynomial.
   ⚠️ **That is a behaviour change, not a refactor** — `Math.hypot` is deliberately more accurate
   than the naive form and avoids overflow — so it has to go through `conceal_lab --bitid` and be
   declared, exactly like every other sim change in this repo.

---

## 5. How much of the tick is `stepAI`?

`nc_measure` §5, `sim.ts`'s fighter loop patched with an `hrtime` probe on both branches (probe
overhead measured at 42 ns/call and declared, included in the shares below).

| arm | `stepAI` | human branch | everything else |
|---|---|---|---|
| N=2, 1 human + 1 AI | **26.151 µs/call — 93.5%** | 0.386 µs/call — 1.4% | 5.1% |
| N=6, all AI | **65.995 µs/call — 99.2%** | — | 0.8% |
| N=6, all human | — | 0.163 µs/call — 30.3% | 69.7% |

**The sim is the AI.** A six-human tick is 2.66 µs; the same tick with six bots is 399.50 µs —
**150× more expensive**, and 99.2% of it is `stepAI`.

### Where `stepAI`'s time actually goes: a BFS flow field

⚠️ **"`stepAI` HAS NO SEARCH BEHAVIOUR" IS TRUE AND IT IS ABOUT SOMETHING ELSE.** The claim lives
at **`src/arena/types.ts:95`** (not `rules.ts`), and it is echoed in `docs/LESSONS.md` and
`DECISIONS §29`. It means the AI **does not hunt for a target it has lost** — it walks to the
last-seen point, stops, and sees 84 wu from there; at twice that radius it *never* re-acquires
(final separation 363 wu). That is a **behavioural** claim, and it is the one that sizes
concealment patches and constrains §48's bigger map.

**It is not a claim about cost, and the two senses of "search" pull in opposite directions.**
`stepAI` never searches for a *target*, but it navigates to one through a **breadth-first
distance field** over a nav grid (`movement.ts:navBuildField`), rebuilt whenever the goal cell
moves. `movement.ts` exports `navStats` for exactly this and `tools/tmp/nav_probe.mjs --cost`
already reads it. So §48's ×4 arena has **two** independent constraints on the AI, not one: the
behavioural one already recorded, and the grid-resolution one measured below.

Grid: **140 × 100 = 14,000 cells @ 10 wu** (7,730 passable).

| arm | BFS field rebuilds / tick | BFS cells visited / tick |
|---|---|---|
| N=2, 1 human + 1 AI | 0.19 | 1,433 |
| N=2, both AI | 1.67 | 12,928 |
| **N=2, both human** | **0.00** | **0** |
| N=6, all AI | 2.94 | 22,736 |
| **N=6, all human** | **0.00** | **0** |

A human seat runs `moveFighter` and never touches the pathfinder. **That is the entire 150×.**

### 🚨 What `DECISIONS §48`'s ×4 arena does to it — and it is not what it looks like

`NAV_MAX_CELLS` is **40,000**, and its own comment says *"Never hit at 1400×1000"*. §48 makes the
arena 2800×2000. At `NAV_CELL` 10 that is 280×200 = **56,000 cells — over the cap** — so
`navGrid` doubles the cell size until it fits. Verified against the real `navGrid` on a bare
arena of each size (grid arithmetic only; **no layout claim** — §48/§49d own placement):

| arena | grid | cells | cell size |
|---|---|---|---|
| 1400×1000 | 140×100 | 14,000 | **10 wu** |
| 2800×2000 | 140×100 | 14,000 | **20 wu** |

**The BFS does not get four times more expensive. The RESOLUTION SILENTLY HALVES.** And
`NAV_CELL`'s own doc block records that **cell 20 already failed the shipped kitchen's tightest
legal gap** — an 11 wu band of legal centre positions — and *"cost 7 of 358 cells"*.

→ **Routed to the §48 arena pass.** `movement.ts` is not this file set's to change. The fix is
one constant (`NAV_MAX_CELLS`), and the consequence of *not* moving it is that the AI loses
corridors on the bigger map while every timing number here stays flat.

---

## 6. Does `MatchState` survive a round trip?

**No.** `nc_measure` §6, on a real N=6 state.

| | alias invariants |
|---|---|
| `JSON.parse(JSON.stringify(…))` | **3 BROKEN** — `player !== fighters[0]`, `enemy !== fighters[1]`, `aiSighting !== sightings[n+0]` |
| `structuredClone` | ALL HOLD |
| hand clone (arena by reference) | ALL HOLD |

> 🚨 **CORRECTION, 2026-08-11, from `tools/tmp/nw_wire.mjs` D9 — the `structuredClone` row is
> right about what it measured and does NOT transfer to the shipped arena.**
> `structuredClone(state)` **throws `DataCloneError`** on a real `MatchState`, because
> `arena/types.ts` declares `build(): THREE.Group` as a REQUIRED method and the structured
> clone algorithm refuses a function. Every number in this section was taken against
> `tools/arena.gameplay.json`, a **data-only** arena cache with no methods on it — so the
> aliases really do survive (D10 reproduces that), but only on an arena that has been stripped.
> With the arena made data-only it also **deep-copies it** (D11), so `state.arena` becomes a
> stranger to the one the renderer holds and `brokenConcealment` then points into the copy
> (D12). The hand clone is the only option that works on the arena the game actually ships.
> ⚠️ And a **fourth** loss on the JSON trip that this section does not list: `Fighter.hazardTimers`
> is documented *"sparse; grows lazily"* and `sim.ts:applyWorldTick` writes it at the hazard's
> index, so it has real array **HOLES** — 12 of them in the N=6 fixture. `JSON.stringify` turns
> a hole into `null` and `JSON.parse` gives back a present `null`. Benign today, because
> `(hazardTimers[idx] ?? 0)` reads both as 0. Which is exactly why nobody would ever notice.

This is not pedantry. `state.ts` is explicit that `state.player` **is** `state.fighters[0]` — the
same object — and that making them getters instead would silently break the bit-identity differ.
A JSON round trip gives you *two independent copies of every fighter*: a write through
`state.player` becomes invisible through `state.fighters[0]`, and nothing throws.

Two more losses on the same trip:

* **`-Infinity` sentinels.** 7 of them in one N=6 state (`lastDamagedAt`, every `lastUsed` slot,
  both status deadlines, `revealedUntil`), and `JSON.stringify` flattens **all 7** to `null`.
  `1b506d6` records the same trap from the other side: two states differing *only* in those
  fields compare EQUAL under `stringify`, and *"they are exactly the fields a mis-built fighter
  gets wrong."*
* **`brokenConcealment` holds arena boxes BY REFERENCE**, and `movement.ts:isConcealed` tests
  them with reference identity. JSON has no references. (`structuredClone` of state+arena
  together preserves the pairing; so does a hand clone against the shared arena.)

### What that costs each design

* **Lockstep pays nothing.** It never serialises state — that is its single largest structural
  advantage in *this* codebase, and it is bigger than the bandwidth argument.
* **Rollback pays nothing locally** — the hand clone is 0.891 µs and preserves everything. It
  pays only for the initial state sync.
* **The authoritative server pays in full**, and the bill has a shape worth naming: a hand-written
  encoder/decoder that restores 3 aliases, 7 sentinel fields and a set of arena references — and
  **every future field added to `state.ts` must be added to it too**, which is the exact
  "one rule stated once and implemented twice" defect shape this project keeps re-learning.

  ⚠️ **Unless the boundary is a `postMessage`.** The structured clone algorithm preserves internal
  references, so an authoritative sim in a **Web Worker** — or a host peer talking to its own
  renderer — costs **zero** serialisation work. Only a real *network* hop needs the encoder.
  That is a strong argument for building the host-peer form first: it exercises the entire
  authoritative architecture with none of the serialisation bill.

---

## 7. What `DECISIONS §49` costs under each design

§49a–§49f are parked and **none of them is decided here.** But some are cheaper under one
transport than another, and that is worth knowing before the transport is picked.

### §49a — the timeout tiebreak's rung 3 ("the lower slot wins")

The *answer* is transport-neutral. The **cost of changing it later** is not:

* **Authoritative server:** a config value. The server is the only sim of record, so the rule
  ships with the server and no client needs to know it changed. Changeable mid-season.
* **Lockstep / rollback:** a **protocol version**. Every peer must run the identical rule or they
  disagree at the tiebreak, so it needs a version handshake and a forced client update.

⚠️ In practice this is cheap under any design: **3,520 forced-immortal timeouts landed rung 1
3,516 / rung 2 4 / rung 3 ZERO.** No corpus reaches it. The transport decides the cost of
changing it, not the difficulty of getting it right.

### §49b — a trail is worth up to 5× at N=6 (`damagedMask`)

`damagedMask` is **order-free by construction**, which is precisely the property a replicated or
re-simulated tick needs: the outcome does not depend on the order `fighters` happens to be
walked in. **Transport-neutral, and already netcode-correct.**

⚠️ But it interacts with **prediction**, in the one way that shows: a trail bite emits a
`hit-landed` with `source.kind === 'trail'`, and `vfx.ts` + `audio/director.ts` both react to it.
A *mispredicted* trail bite paints a damage number that then un-happens — the most visible
misprediction artefact this game can produce, because trail marks are dropped by *other* fighters
and are therefore exactly the state a local predictor gets wrong.

* **Authoritative server (predicting the local fighter only):** cheapest. World state — trails,
  hazards, the fog ring — is never predicted, so it is never rolled back on screen.
* **Rollback:** most expensive. It re-simulates the trail interaction along with everything else.

**→ If §49b is answered "keep per-victim" (in force), that argues mildly for the authoritative
model.** It does not decide it.

### §49c — which HP / **size** dial does seat 2+ get?

The HP half is transport-neutral. **The size half has a measured cost, and it is large.**

`movement.ts:navGrid` caches ONE passability grid per arena object and validates the hit with
`cached.size === size`. Today `PLAYER_SIZE === ENEMY_SIZE === 42`, so every fighter asks for the
same grid and it is built **once per arena, ever**. Give seat 0 a different body and consecutive
AI seats alternate the requested size, and every alternation misses the cache and rebuilds the
whole grid — 14,000 cells, each running `collidesWithCover` over the arena's cover list:

| | grid rebuilds over 680 playing ticks |
|---|---|
| same size (today) | **1** |
| seat 0 given a different body (42 vs 40) | **1,114** |

**→ If Uri differentiates seats by SIZE rather than by HP, the pathfinder pays ~1,100 full grid
rebuilds per 680 ticks.** Under an authoritative server that lands on one machine, where it can
be capacity-planned. Under lockstep or rollback it lands on **every client, including the phone**,
and rollback multiplies it by the re-simulation depth.

⚠️ This is a *cost*, not an argument against the choice. It is also a latent bug that would bite
the moment anybody varied `Fighter.size` for any reason — it is not netcode-specific, and it is
reported to the orchestrator as an out-of-set finding.

### §49d — spawn geometry above slot 1

`createMatch` **throws** rather than inventing a ring, and §49d parks placement with the §48
arena pass. That refusal turns out to be **netcode-correct, for a reason nobody had yet stated**:

* **Lockstep / rollback:** every peer must compute the **same** spawn positions. A *derived* ring
  is `Math.cos` and `Math.sin` — two of the five implementation-approximated call sites from §4 —
  so **a derived ring spawn is a potential desync at tick 0, before anybody has moved.** Spawn
  positions must be **transmitted as coordinates in the match-start packet, never re-derived.**
* **Authoritative server:** the server picks and sends them; clients never compute them.

Under all three designs the answer is the same: **spawns are data, not a formula.** `sim.ts`
already refuses to make them a formula, and `match.ts`'s QA `?fighters=<id>@<x>,<y>` parameter is
already shaped as a transport for coordinates somebody else chose. Nothing to change.

### §49e (four unmeasured trail colours) and §49f (six nameplates squeezed to ~45%)

**Transport-neutral.** Both are presentation. Worth one note: under an authoritative server the
client still renders from a full replicated state, so both remain exactly the local rendering
problems they are today. Neither becomes easier or harder.

---

## 8. The recommendation, stated as a position

**Authoritative simulation with client-side prediction of the local fighter only.**
**Built first as a HOST PEER** — one client runs `stepMatch`, the others send inputs over a
WebRTC DataChannel and receive deltas — **and moved to a Node process later without touching
`src/game/`,** because the sim is pure and already runs unchanged in Node (every instrument in
`tools/` is proof).

**Because:**

1. **2.66 µs.** Server CPU is the only thing lockstep saves, and at six human seats it is 0.016%
   of real time — ≈ 6,260 concurrent matches per core, ≈ 2,395 at p99. There is nothing to save.
2. **32 implementation-approximated float call sites.** Lockstep and rollback both require them
   to agree bit-for-bit on every browser engine a player might use. That requirement cannot be
   discharged by a measurement in this repo; it needs a 32-site rewrite plus a cross-engine rig
   that does not exist. An authoritative server does not care what a client's `Math.hypot`
   returns.
3. **Cheating.** This is a public web game. Under lockstep and rollback every client holds the
   full state, which makes `DECISIONS §29`'s concealment — a *hiding* mechanic — decoration
   against a modified client. Only the authoritative model can withhold what a player should not
   see.
4. **The serialisation bill is deferrable.** `postMessage` uses the structured clone algorithm,
   which §6 measures as preserving every alias. So the host-peer form exercises the whole
   architecture with **zero** encoder work; the encoder is only needed at a real network hop.

   > 🚨 **CORRECTION, 2026-08-11 — REASON 4 IS FALSE FOR THE ARENA THE GAME SHIPS, and it was
   > measured rather than reasoned.** `port1.postMessage(state)` on a live N=6 `MatchState`
   > throws **`DataCloneError`**, for the same cause as §6's correction: `arena/types.ts`
   > declares `build(): THREE.Group` as a REQUIRED method and the structured clone algorithm
   > refuses a function. `postMessage(state minus arena)` does not throw, which isolates it.
   > So a Web-Worker or host-peer boundary does **not** cost zero encoder work — it costs
   > exactly the transform that excludes the arena and refers to it instead.
   > ⚠️ **This does not reverse §52.** It removes one of five supporting reasons; reasons 1
   > (2.66 µs), 2 (32 implementation-approximated call sites), 3 (cheating) and 5 (rollback's
   > event replay) are untouched, and the transform in question **now exists** — `src/net/wire.ts`,
   > gated at `tools/tmp/nw_wire.mjs` 67/67. The bill was not deferrable; it was small.
   > It is also the reason the encoder had to be written before anything could be tested, rather
   > than after a network appeared.
5. **Rollback's own arithmetic argues against it here.** It is free at 2.66 µs/tick and 19% of a
   frame per 8-tick rollback the moment the match contains bots — and a live 6-player game fills
   empty seats with bots. Plus it is the only design that replays the `GameEvent[]` stream
   (0.335 events/tick), which means every VFX, HUD and audio consumer has to become idempotent.

**What choosing this forecloses,** stated because a recommendation that only lists its upsides is
an advertisement:

* Server infrastructure eventually, and a place to run it. §51 is about wrapping the *client*;
  nothing in this repo has a backend, and the host-peer form is a way to postpone that, not to
  avoid it.
* The 150× AI cost lands on the host. A 6-bot match at 399.50 µs/tick is 41 matches per core —
  fine for a server, and it means a *phone* acting as host is doing 2.4% of its frame budget on
  simulation before it renders anything.
* Prediction means writing the reconciliation path: the client re-applies its unacknowledged
  inputs on top of each authoritative state. That is rollback's machinery in miniature — but
  applied to **one fighter's movement**, not to the whole world, which is why it does not pay
  rollback's event-replay bill.

---

## 9. What could NOT be measured, and it matters

1. 🚨 **Cross-engine float agreement.** Everything above ran on **V8 only** (node v24.15.0,
   darwin/arm64). Whether JavaScriptCore and SpiderMonkey return the same bits from
   `Math.hypot`, `sin`, `cos`, `atan2` and `acos` is *the* load-bearing question for lockstep and
   rollback, and answering it needs the three browser engines running the same corpus.
   That is a browser task; peers were on the GPU. **Until it is answered, lockstep's feasibility
   is an assumption, not a measurement.**
2. **Latency.** There is no network in this repo. Input delay, rollback depth in ticks, jitter
   buffering and the RTT at which lockstep becomes unplayable are all functions of a number I did
   not measure and could not.
3. **Mobile CPU.** Every microsecond here is desktop arm64 Node. A phone is plausibly 5–10×
   slower and I did not measure it. The N=6 all-AI figure (2.40% of a frame) is the one that
   would hurt if that multiplier is real.
4. **Real packet overhead.** The byte counts are **payloads**. The 60–90 B of UDP/IP/DTLS/SCTP
   framing quoted in §1 is standard protocol arithmetic, not something measured here — and at
   these payload sizes it dominates.
5. ⚠️ **A 4–6 fighter BALANCE number, which does not exist and whose instrument does not exist.**
   `roster_lab`, `kit_lab` and `match-sim` all assume a 110-cell **1v1** grid (`DECISIONS §49b`).
   Nothing in this document is a balance claim, and the scripted driver's two-seat view means
   every N>2 run here is a deterministic **stimulus**, not a model of how six people play.
6. **`GameEvent` stream volume under prediction.** The 0.335 events/tick figure is `1b506d6`'s
   N=6 corpus, quoted. How many of those a *predicting* client would emit and then have to
   retract is a property of the prediction design, which does not exist yet.

---

## 10. How to re-run it

```bash
node tools/tmp/nc_measure.mjs --selftest   # 18 instrument checks, each with a known-bad (~3 s)
node tools/tmp/nc_measure.mjs              # the full table (~90 s)
node tools/tmp/nc_measure.mjs --quick      # 2 seeds, for a smoke run (~10 s)
```

The tool hashes the seven sim files before and after the run and **fails if the tree moved under
it** — `1b506d6` discarded two whole batteries to learn that a number quoted across a moving tree
is not a measurement.

⚠️ **`driver_guard.mjs`'s census is a bare substring sweep over every `.mjs` in `tools/`**, so a
file that merely *names* the scripted player's nav-latch field in prose is indicted as a
fourteenth copy of the driver. This one did exactly that and turned the gate red until the word
was removed. `driver_guard.mjs` solves the same problem for itself by registering itself as
`GUARD`; a tool that cannot edit that registry has to avoid the token instead.
