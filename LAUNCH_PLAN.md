# Launch plan — ready to fire on resume

Written while paused at ~10% token budget. **Nothing here needs re-deriving.** Read this
plus `PROGRESS.md`, then start at Wave 0.

Designed so a resumed session can run 8–10 hours across 2–3 sessions without hitting a
token wall. The budget discipline in "Token management" is the part that makes that true
— it is not optional advice, it is why the plan is shaped this way.

---

## The body-archetype decision (Uri's call, 2026-08-03)

The silhouette test showed all 11 characters share effectively ONE body, so every scrap
of identifying information lives in the head. The fix is **not** 11 bespoke bodies.

> *"I think it will be easier to manage 3/4 body types and reuse them instead of creating
> 11 unique body types. For example — one body type has very short legs and hands, no
> torso — would work for the bottle. The majority of the character sits in the head and
> sometimes torso. Then the loops can focus only on head+torso and disregard the body,
> just make sure it fits."*

This is the right shape for the problem: 4 deliberately CONTRASTING bodies give more
silhouette separation than 11 near-identical bespoke ones, at a fraction of the work, and
it collapses each character loop's scope to head + torso.

### Why the bodies are currently identical — the actual blocker

`RigProportions` exposes only `height`, `headFraction`, `armRadius`, `handRadius`,
`legRadius`, `shoulderWidth`, `stanceWidth`. Every one of those is a THICKNESS or a
WIDTH. **There is no knob for torso size, torso presence, or limb LENGTH.** No character
file can change its body shape even if it wants to. That is the root cause, and Wave 0
exists to fix it.

### The four archetypes

Assignment follows each food's real-world shape class, so the body reinforces identity
instead of fighting it. Note the three silhouette failures land in three DIFFERENT
archetypes — Wave 0 helps all of them at once.

| Archetype | Form | Characters |
|---|---|---|
| **STUB** | No torso. Head sits almost directly on the hips, very short thick limbs, wide stance. Reads as "a thing with feet." | waterbottle, egg, lollipop, donut |
| **STOUT** | Short wide torso, thick short limbs, low centre of mass. Reads heavy and planted. | soup, hamburger, taco |
| **STANDARD** | Medium torso and limbs — roughly today's chibi, kept as the neutral baseline. | pizza, sushi |
| **LANKY** | Tall narrow torso, long thin limbs, narrow stance. Reads tall and light. | burrito, hotdog |

Rule for every character loop from now on: **you own head + torso dressing. You do not
author a body — you pick an archetype and make your head fit it.** Changing archetype is
allowed and is a legitimate fix; authoring a twelfth bespoke body is not.

---

## Wave 0 — the blocker (SERIAL, must finish before any character loop)

One agent, alone. Everything in Wave 2 depends on it.

**Owns:** `src/characters/rig.ts`, plus a new `src/characters/bodies.ts`.

**Task:**
1. Extend `RigProportions` with the missing shape knobs — at minimum torso height, torso
   width/depth, arm length, leg length, and a way to express "no torso" (STUB) where the
   head mounts near the hips.
2. Create `bodies.ts` exporting the four archetypes above as named presets.
3. Retrofit all 11 character files to opt into their assigned archetype. This is the one
   time an agent is allowed to touch every character file — it must be behaviour-
   preserving in gameplay terms and is a pure visual change.
4. Prove it with ONE render: `preview.html?piece=roster&silhouette=1`. Success is four
   visibly distinct body shapes in that image. **Read the PNG and look at it.**

**Gate:** `tsc` clean, sim 51/51, and the roster silhouette shows four distinct bodies.

**Traps:** `headCentreY` assumes a head mass extending ~±R about its origin — STUB will
stress this hardest. `dressTorso`'s `size.h` measures off the DEFAULT torso bbox (~92% of
nominal), which already caused one floating head. A STUB archetype with no torso will
break any code that assumes a torso exists — grep before assuming.

---

## Wave 1 — non-character loops (run DURING Wave 0, they don't touch characters)

Max 3 concurrent. These were dispatched pre-pause and stopped having done nothing but
read — **re-dispatch from scratch, there is no partial work to recover.**

| Loop | Owns | Isolation | Target |
|---|---|---|---|
| Floor | `src/arena/floor.ts` | `piece=floor` | 7/10 — texture blocker cleared, fresh start |
| Lighting | `src/render/lighting.ts`, `stage.ts` | build a neutral probe scene | 7/10 |
| Cover props | `src/arena/props/*` | `piece=prop&kind=` per prop | 7/10 |

Lighting needs a small `preview.ts` wiring change it does not own — have it report the
change rather than make it, then wire it from the main thread.

---

## Wave 2 — character loops (AFTER Wave 0 lands)

Scope is now head + torso only. Run **3 at a time**, in this order:

1. **waterbottle, burrito, sushi** — the three the silhouette test named.
2. **egg, lollipop, donut** — STUB cohort; they share a body, so they must differentiate
   by head, and judging them together catches collisions between them.
3. **soup, hamburger, taco** — STOUT cohort.
4. **pizza, hotdog** — remainder.

Each: exclusive file ownership, fresh critic per round, cap 4 rounds (down from 5 — see
token management), self-scores are not verdicts.

---

## Wave 3 — per-weapon VFX

Nine stubs remain in `src/vfx/weapons/`, wired to the generic fallback so nothing
regresses until each is converted. `hamburger.ts` and `waterbottle.ts` are worked
examples, deliberately chosen from opposite ends of the weapon space.

Run **3 at a time**. These are cheaper than element loops — narrow scope, one file each,
and the contract is already fixed.

Remaining: burrito, donut, egg, hotdog, lollipop, pizza, soup, sushi, taco.

---

## Wave 4 — the things nobody has done yet

- **Whole-arena scanner** as the real scoreboard. Element scores read higher than the
  whole, because a critic judging one barrel isn't weighing composition or density.
  Optimising the easier metric is the standing risk of this entire working model, and
  this is the only thing that catches it.
- **Motion filmstrip.** Every character critique so far has judged stills, yet "reads
  like a turntable render" is a complaint about MOTION — currently unassessed entirely.
- **Ambient effects alone** — steam, dust, flame are invisible in a busy frame.
- **Play a full match at real framerate and judge how it FEELS.** Still nobody has.

---

## Token management — the part that makes 8–10 hours possible

Measured costs from this session, not estimates: a single element loop agent burned
**259k** (floor, 5 rounds) and **434k** (slow-feedback, 197 tool calls). Budget **~300k
typical, ~450k worst case** per loop agent.

Naively fanning out all 15 remaining loops at once is ~4.5M tokens with no checkpoint —
it would blow the budget mid-flight and leave half-finished edits everywhere. That is
exactly what happened at this pause, and it only ended cleanly because the agents were
stopped early.

**Rules:**

1. **Max 3 concurrent agents.** Also avoids dev-server and screenshot contention — the
   shared Vite server caused mid-capture reloads and one corrupted screenshot when
   several agents ran together.
2. **The main thread must stay cheap.** Reading full-res PNGs is one of the most
   expensive things it does. Delegate looking at images to agents and ask for TEXT
   verdicts. Read an image yourself only to adjudicate a disagreement or verify a claim
   that changes a decision.
3. **Cap loops at 4 rounds, not 5.** Round-5 score movement has been within inter-critic
   noise (two fresh critics scored comparable material 5 and 4). The 5th round has
   reliably cost ~60k tokens for no measurable gain.
4. **Commit after every wave, never mid-wave.** A wave boundary is a safe pause point; a
   mid-wave stop is not.
5. **Checkpoint at each wave end:** `tsc` clean, sim 51/51, working tree clean, pushed.
   If the budget dies right there, the next session loses nothing.
6. **Order by value under uncertainty.** Wave 0 first because it unblocks the most work
   per token. Wave 3 (weapons) last because it is the most parallel and least risky to
   interrupt.

**Rough plan:** Wave 0 + Wave 1 ≈ 1.2M. Wave 2 ≈ 1.4M. Wave 3 ≈ 0.9M. Wave 4 ≈ 0.5M.
That is a natural 3-session split with a checkpoint between each.
