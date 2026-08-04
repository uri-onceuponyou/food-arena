# Launch plan — ready to fire on resume

Written while paused at ~10% token budget. **Nothing here needs re-deriving.** Read this
plus `PROGRESS.md`.

Designed so a resumed session can run 8–10 hours across 2–3 sessions without hitting a
token wall. The budget discipline in "Token management" is the part that makes that true
— it is not optional advice, it is why the plan is shaped this way.

---

## ▶ START HERE — state as of 2026-08-04, Uri away ~2h

79 commits, all pushed. `tsc` clean, sim 51/51, `tools/aspect.mjs` PASS (0.00wu spread),
live game verified by screenshot. **Waves 0 and 1.5 are DONE — do not redo them.**

### Landed since the plan was written
| | evidence |
|---|---|
| Body archetypes (4, replacing one shared body) | silhouettes now read distinctly |
| Viewport fairness | 199.2wu guaranteed on every aspect, 0.00 spread |
| Weapon-range rebalance | characters 8.1% → ~13% of frame, fairness kept |
| **Colour grade replaced** | was destroying a fifth of the frame: 8/12 palette colours lost a channel, all arriving at saturation exactly 1.00. Now 0/12 clipped |
| **SSAO dropped** | measured exactly 0.0000/255 at every framing, for the whole project |
| **Fog / safe zone visual** | was 50 HP/s with NO renderer at all |
| Prop grounding un-buried | contact decals 1.99 → 7.14/255 |
| Hazard rework landed | had been a total no-op from an ownership deadlock |
| Impact burst rescaled | was 2.25× character height; gated Wave 3 |
| Cast decals retired + key swung to raking | barrel terminator ramp +26% |
| Cover props | 4 → 5 → **6** → 5; heights 0.32–0.98× → 1.15–1.69× char height |

### Running right now
- **Arena apron** (`apron.ts`, `kitchen.ts`) — uncommitted but typechecking. Was told the
  stale key azimuth at `apron.ts:214` needs updating to the new 16.0° (`Math.hypot(16.35,
  4.69)`), and that raking light now rewards apron geometry with real relief far more than
  flat planes.

### Do these next, in order (Uri, 2026-08-04)

1. **Finish the weapons** — burrito+egg and hotdog+sushi are the last four; agents running.
   That completes the per-weapon VFX pass (7 of 11 done before this).
2. **Economy data model + trophy road, TOGETHER.** Uri asked for trophy road first and
   economy after, but trophy road IS a reward track that grants chests and currency — so
   building its UI on no data model means retrofitting it immediately. Build the model
   (currency, chest/box types, reward tables, unlock + progression state, persistence)
   with trophy road as its first consumer.
   The design already exists: `reference/prototypes/trophy-road-screen.html` and
   `shop-screen.html`. **`reference/` is gitignored — read only, never copy into `src/`,
   never commit.** `src/ui/screens/profile.ts` already does localStorage and holds
   `profile.wins`, so extend rather than replace it.
   Default unless Uri says otherwise: **earn-only currency, no real-money purchase flow.**
3. **Shop + chests/boxes UI** on the settled model. Both critics penalised dead UI, so
   nothing ships with buttons that do not buy.
4. **Settings** — currently a dead control on home ("coming soon"), needs no economy, and
   is where keybinds and the mobile quality tiers have to live anyway.
5. **Audio for the remaining weapons**, once the audio agent reports its authoring pattern.
6. **Character heads** (scope: head + torso only; archetypes own the bodies), then the
   **whole-arena scanner** and the **motion filmstrip** — motion is still entirely
   unassessed, yet "reads like a turntable render" is a complaint about motion.

### Open decisions Uri still owns
- **Emoji icons.** Both menu critics named emoji-as-icons the loudest remaining tell, but
  `hud.ts` uses emoji throughout and is the one element that BEAT the shipped reference.
  Replacing them means a drawn icon set covering the HUD too.
- **giantSlam.** Its tell is readable with the caster off screen (verified), but the slam
  resolves on the same tick it is cast, so it cannot be dodged. Whether an instantaneous
  unavoidable map-scale hit from an unseen attacker is acceptable design is a real
  question; giving it a wind-up in the sim would make the visual a true warning.

### Waiting on Uri — do not start without him
**Floor is PARKED.** There is a specific hypothesis in `PROGRESS.md` (the 6/10 was
low-band macro variation; r4 overshot it at 0.32 vs 0.22). Three further floor items were
named by all three prop critics and should be folded into that same session:
- the pantry's **orange plank pad shares hue and material with the counter tops** — now
  the single worst blocking-vs-walkable confusion left in the arena
- `floor_drain` reads as a collider or pickup, not a floor marking
- the **teal mats mean "run across me" in one place and "solid object" in another**, being
  used both as decoration and as pedestals under props
- plus a stale copy of the old key azimuth at ~line 891

### CORRECTED budget rule — this one is load-bearing
Measured: **6 concurrent agents burned 30% of a session in 30 minutes.** Each agent costs
~300k regardless of scheduling, so **total agent count is the budget; concurrency only
sets the rate.**

| concurrency | burn | over a 4h session |
|---|---|---|
| 6 | ~30% / 30min | 240% ✗ |
| 3 | ~15% / 30min | 120% ✗ |
| **2** | ~10% / 30min | **80%** ✓ |

**Hold at 2.** Available budget is not a reason to widen — Wave 3 alone is ~2.7M whether
run 6-up or 2-up. The decision that matters is *which* work gets an agent.

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

## Wave 1.5 — viewport fairness (do this EARLY, it moves the camera)

Uri's requirement: the game must also run on **mobile in landscape**, and desktop and
mobile players must have **the same view abilities — same view distance, same
proportions**. In a PvP brawler this is competitive fairness, not layout polish: seeing
further than your opponent is a straightforward advantage.

### This is already broken today, by default

`src/render/camera.ts:70` is `new THREE.PerspectiveCamera(opts.fov ?? 34, aspect, ...)`.
**three.js `fov` is the VERTICAL fov**, so vertical extent is fixed and horizontal extent
scales linearly with aspect ratio — classic "Hor+" behaviour that nobody chose.

Visible arena WIDTH, relative to 16:9:

| Device | Aspect | Sees | hFOV |
|---|---|---|---|
| Ultrawide desktop | 21:9 | **+31%** | 71.0° |
| Phone landscape | 19.5:9 | **+22%** | 67.0° |
| Desktop baseline | 16:9 | — | 57.0° |
| iPad | 4:3 | **−25%** | 44.4° |

An ultrawide player sees **75% more arena width than an iPad player**. Fix this before
tuning composition, or every framing decision gets made against a moving target.

### The fix: fit a fixed world rectangle, don't fit the screen

1. Define a **fair-play rectangle** in world units — the region guaranteed visible on
   every device. Derive it from gameplay, not from a screen: the longest weapon range in
   `rules.ts` plus reaction distance. Anything an opponent can hit you from must be on
   screen on the narrowest supported aspect.
2. Each resize, solve camera distance/fov so that rectangle is **fully contained at any
   aspect** — fit by whichever axis is binding, not always by height.
3. Screens wider than the design aspect then reveal extra space. Two options, pick one
   and write it down: treat the surplus as **cosmetic bleed** (arena border and decor
   only — never spawns, pickups, hazards or cover), or hard-mask it. Cosmetic bleed looks
   far better than letterboxing and is what shipped mobile brawlers do; it only works if
   the surplus is guaranteed non-informational, which is an ARENA LAYOUT constraint, so
   the arena owners need to know about it.
4. Add aspect-ratio isolation shots to the harness — render the same scene at 4:3, 16:9,
   19.5:9, 21:9 and diff what is reachable. This is exactly the kind of thing that is
   invisible until isolated, and we now have six instances of that lesson.

### The rest of mobile parity — scope it now, build it later

- **Safe areas.** Notches, rounded corners and the home indicator eat the HUD's corners
  in landscape. The HUD is DOM/CSS, so `env(safe-area-inset-*)` applies directly — cheap
  to do right, ugly to retrofit.
- **Touch controls reserve screen space.** Twin virtual sticks sit in the lower corners
  and thumbs physically occlude that area. That region must not be where gameplay-critical
  information lives — another constraint on HUD and on the fair rectangle.
- **Cap `devicePixelRatio`.** Phones report 3–4×; rendering the full post chain at native
  DPR will melt a mobile GPU for no visible gain.
- **Quality tiers.** The current pipeline runs IBL + SSAO + bloom + a normal pass. That is
  a desktop budget. Mobile needs a tier that drops SSAO and probably bloom while keeping
  the look recognisable — note that the art direction depends on saturation and contrast
  passes, which are cheap, and on IBL, which is not.
- **Input abstraction.** `src/game/input.ts` is DOM/keyboard today. Touch is a second
  backend behind the same interface, not a rewrite — worth checking that boundary holds
  before it calcifies.

**Ordering note:** do the camera fit early (it changes framing, so every later visual
judgement depends on it) and defer the rest until after Wave 3. But do NOT let the arena
loops finalise layout without knowing the cosmetic-bleed constraint from step 3.

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
