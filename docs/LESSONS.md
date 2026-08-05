# Lessons

Everything below was paid for. Reading this is cheaper than re-learning any of it.

---

## 1. "It isn't there" almost always means it IS there and is INVISIBLE

**True cause eighteen separate times.** Assume rendering-but-invisible *first*, and prove it
with an unmissable probe rather than reasoning about it.

The first sixteen, grouped by mechanism — the variety is the point:

**Occluded or buried**
1. Sesame seeds placed at a mesh's "front" landed on its hidden back face (the mesh is
   flipped 180° about X, which negates Z).
2. Contact-shadow decals at y=0.011 under floor tiles whose tops sit at y=0.015.
3. Prop grounding decals under opaque floor pads that props *deliberately stand on* — 63%
   of the area never reached the screen.
4. Splash particles spawned at y=0.06, underneath a puddle decal stack at 0.15–0.25.
5. Sushi's maki roll rendered perfectly, inside the default torso barrel (r=0.17 in 0.22).
6. Water Bottle's strap anchored to `joints.torso`, which on a STUB body is an empty group
   **at the hips** — it drew as a hook beside the waist. Identical to Lollipop's cape on
   `joints.neck`.

**Inside the target**
7. Pizza's Cheese Blind: a 0.33m sheet at the head *centre* against a 0.48m head radius —
   **zero pixels**.
8. Sushi's blade: **correctly sized** at 2.74m but spawned mid-torso, and its lens geometry
   is thickest in the middle — the target ate the middle third and one stroke rendered as
   two disconnected shards. *A height error on correctly-sized geometry; a scale-focused
   review walks straight past it.*
9. Egg's arms, pivoted where the shell bulges widest — a critic reported "this character
   has no arms".

**Contrast, blending, colour**
10. HUD cooldown wipe, dark-on-dark. Three critics reported "no visible cooldown" across
    three rounds.
11. Slow-effect ring in the *same cyan* as the puddle it sits on.
12. Hamburger's apron within a few units of the tomato — they fused into one red cylinder
    and the bottom bun vanished.
13. Burrito's foil warmed to within 4% of the tortilla behind it.
14. Range arrows drawing ink on ink.
15. A spatula blade at `metalness: 0.55` rendering near-black.
16. **Taco's front wall leaned *toward* camera**, tipping its normal away from the key —
    the character's largest surface rendered as a near-black slab, which is why critics
    read it as *a crown*.

**Also, adjacent:** additive blending over this bright warm floor makes a wash, not a core.
Transparent materials without `depthWrite: false` still write depth and silently occlude.
The ground layer stack is crowded — floor pads 0.045–0.048, seams 0.062, baked shadows
0.068–0.07, prop kicks 0.08.

**The seventeenth — and it is a RECURRENCE, which is the real lesson**
17. Water Bottle's belt: **3,974 px of footprint, 0 px delivered.** This is case 6 coming back
    *after its own fix*. Case 6 moved the strap off `joints.torso` (an empty group at the hips
    on a STUB body); the repair re-anchored it to `joints.hips` — still inside a body spanning
    x[−0.56 … 0.53]. **Fixing the anchor is not the same as verifying the result reaches the
    screen.** A fix for an invisibility bug must be closed out by measuring delivered pixels,
    or it silently re-lands in the same class.

Corollary found at the same time: **every transparent material in the entire cast carries
`depthWrite: true`** — the exact silent-occluder trap named two paragraphs above, present
project-wide and never swept for.

### The probe technique
Replace the thing with something **unmissable** — a garish 4×4 red/cyan checker, a 5× scale,
a 10-second lifetime — and render. This *disproved* a five-round theory in ten minutes: the
texture was wired perfectly and the real bug was spatial frequency. **The pattern above is a
prompt to test, not a conclusion to reach.**


**The eighteenth is the worst kind: it rendered PLAUSIBLY, and wrongly.**

Every previous instance was *absent* — nothing on screen, so somebody eventually noticed. A WebGL
context loss and restore produced a frame that looked **completely normal** and was 15.65 luma-mean
darker than the frame before it. Measured on a frozen sim with a drift control over the same
wall-clock span:

| | HEAD | after |
|---|---|---|
| drift control (no loss at all) | 0.007 | 0.000 |
| frame mean, pre-loss → post-restore | 76.291 → **60.641** | 96.466 → 96.458 |
| delta | **−15.650** | −0.008 |

Two causes, both invisible: the **PMREM environment map** is a render-target texture with no CPU
image, so three's property reset leaves it empty; and the **shadow map** never redraws, because
`autoUpdate` is false and three preserves `needsUpdate: false` across the restore.

**A match hides it and a menu exposes it** — fighters move, so the shadow map redraws *by accident*;
a static character-select portrait just silently loses its contact shadow. That asymmetry is why it
would have survived any amount of gameplay testing.

→ **The lesson widens: "is it there?" is not enough. Ask "is it the SAME?"** — and answer it with a
drift control measured over the same span, not a guessed tolerance. A restored, resumed or
reconstructed thing that *looks* right is the hardest possible failure to find, because nothing about
it invites a second look.

**And the brief's premise was falsified in passing.** The task said "no `preventDefault`, so the
context is never restorable" — but three's own handler already calls it (`three.module.js:15852`),
measured `defaultPrevented === true` on HEAD before any handler of ours existed. The real bug was not
the missing thing everyone assumed; it was the *plausible* thing nobody checked.

---

## 2. Probe before you loop

**Every plateau ever probed on this project turned out to be a bug or an ownership
deadlock — never a taste gap.** Five for five.

A ~20k probe has repeatedly beaten a ~300k critic loop. The floor loop spent **309k tokens
for a score that did not move at all**, while a single silhouette render named exactly which
characters failed and a checker probe root-caused a five-round blocker in minutes.

Corollary: **no critic round finds a bug.** If an element has plateaued, build an instrument
before buying more rounds.

---

## 3. The critic instrument is not stable — calibrate it

Critics judge a blind A/B packet and **also score the reference side**. Across three fresh
critics on the *same* reference library: 8–9, 8–9, and **4 and 5**. A four-point spread on
the control, with that critic ranking our menu *above* shipped Brawl Stars.

**Rules:**
- **Record the reference score every round.** Outside ~7–9 means the round measured the
  critic. **Discard it before acting**, not afterwards while reconciling — an invalid round
  (references at 6,6,5) already drove the two largest rewrites the apron ever received.
- **Two critics reversing each other → STOP.** That has happened four times: floor, apron,
  home, icons. More rounds measure noise.
- **Do not take a critic's stated *mechanism* at face value.** Two of three reasons in a
  recent 4/10 were measurably false — "props float over dark violet nothing" was disproved
  by 100% apron coverage at luma 34.7. That is the invisible-render trap *in reverse*:
  absence reported where there is presence.
  **Second, larger instance:** a critic scored the cast 3–5 against a reference at 9 and named
  one cause — *"add a cool back-rim light; none of the 3D panels has one."* A rim light already
  existed (`#addcff`, intensity 1.70, azimuth −126°), **identical in preview and in the match**,
  and a measured sweep showed retuning it was worth **at most +0.012 of figure/ground before it
  inverts** — past intensity ~3.4–6.0 separation drops *below* switching the rim off entirely,
  because the rim lights the floor faster than it lights the fighter. The critic's *observation*
  (limbs vanish into torsos) was correct and valuable; its *mechanism* was wrong, and the true
  cause was a sign error in nine of eleven stance blocks. **Take the symptom, re-derive the
  cause.**
- Trust order: **named reproducible gaps > objective acceptance tests > trends > the bare
  number.**

### Every loop needs a measurable acceptance test, defined before round 1
Without one, loops oscillate instead of converging. Good ones from this project:
- floor: *composite a mid-value character silhouette — its outline must be the darkest edge
  within a 200px radius*
- icons: *at real pixel size, can each be identified without its label?*
- lighting: figure/ground ≥0.10, shadow offset ≥0.10R, no authored channel driven to 0/255
- home: *character width ÷ hero panel width* (0.26 → 0.68)
- audio: **five deliberately single-layer controls that must FAIL** — including one that is
  saturated, swept *and* detuned, which is what stops "add more saturation" being mistaken
  for "add a transient"


### It now has a MEASURED resolution floor, and this project spent a session below it

σ = **0.50**, from 16 fresh critics on one fixed image across 5 prompt phrasings and both A/B slots
(ours 5.125; reference 8.167 ± 0.39). With the prompt held byte-identical the spread is **zero** —
6 of 6 returned the same numbers.

**Minimum resolvable difference: ~1.4 points.**

And the unit of replication is the **critic**, not the panel: one critic scores both panels of a
round and gave both the same number in **4 of 4** cases. So a round with 2 panels is **n = 1**, not
n = 2. Two *independent* critics bring the floor to ~1.0.

**Applied to the character history — 3.6 → 3.25 → 3.0 → 2.0 — the largest single step is 1.0. Not
one transition ever cleared the floor.** Two passes were reported as "the score fell" and a third
was nearly cancelled on that basis. **It was never an observation.**

Falsified while measuring it: **position bias is 0.00** (our frame against *itself* tied 6/6 and 5/5;
forcing our panel into slot A then slot B gave identical means), and **resolution is not the story**
— the reference plates arrive **upscaled 1.33–1.43×**, delivering **0.42–0.48× our edge acuity**, and
still score 8.

→ **State a resolution floor for every instrument, and refuse to act inside it.** This project had
floors for win rate (~9 pp) and pacing (~0.8 s) and none for the instrument that decided what every
agent worked on.

### The RUBRIC is worth 2.0 points, and there was never a canonical one

Identical sheets, same critic model: *"overall visual quality"* → ours **5.0**; *"character design and
rendering only"* → ours **3.0**. Deterministic, 2 of 2 each, and **the reference side does not move**.

There was **no canonical critic prompt anywhere in this repo** — every round was written fresh by
whichever agent ran it. So scores were never comparable across rounds, and a 2.0-point lever sat
uncontrolled while agents acted on 0.25-point differences.

→ `tools/review.mjs` now records `--rubric` and writes `RUBRIC.txt` into the packet. **Never compare
scores across different rubrics.**

### The wrong-plates defect RECURRED, in a second element, unnoticed

`docs/STATE.md` recorded that an arena packet drew **4 of 6 Zooba** plates, whose camera is a low
third-person chase rather than our top-down. **All three character rounds then did exactly the
same** — including one wide aerial parachute shot the library's own index offers as an *environment*
reference, used to score characters. `gameplay_topdown` existed and was not used.

→ A defect recorded but not **enforced** recurs. `review.mjs` now warns by name on mixed-camera
categories and prints the actual draw.
---

## 4. Verify the artefact you are shipping

`tsc --noEmit` and the tests run against the **working tree**, including untracked files.
They say nothing about HEAD. A committed `match.ts` imported an uncommitted `pointerLock.ts`
and **HEAD did not build for 24 commits** while every gate passed.

→ `node tools/verify-head.mjs`. A missing file is not a type error; only a resolver notices.

---

## 5. Measurement contamination is a separate problem from write conflicts

Single-owner file sets stop agents clobbering each other and do **nothing** about
measurement, because any render includes the whole tree. One cause, many costumes:

- a whole-arena scan silently contaminated by ~40 concurrent saves to `floor.ts`
- `menu_accept` failing with "execution context destroyed" and being **reported as a
  regression** when it was a peer's save reloading the page
- one syntax error 500-ing the dev server for *every* agent at once
- probes reading a `window.__stage` a peer's screen had already disposed
- an agent chasing the resulting phantom all the way to `git stash`

→ **`tools/snapshot.mjs`. Edit on the shared tree, measure on a snapshot.** `--swap <file>`
freezes everything except one file, which is the only way an A/B means anything.

### An instrument can be only PARTLY isolated, which is worse than not at all

`menu_accept` measures a frozen snapshot — **except its static no-backtick-in-CSS lint, which
parses the LIVE tree.** So a peer mid-save in any of 106 modules fails your run, on a file you
have never opened, and it presents *exactly* like your own break. It cost time twice in one
session, once naming `src/render/stage.ts:111` while the agent reading the failure owned
`src/ui/`.

The general form: **when part of a tool reads the working tree and part reads a snapshot, say so
in its output.** A number that is 90% isolated invites you to trust the 10% that isn't. Either
isolate the whole thing, or print which side each result came from — the arena-scan colour gate
now stamps the SHA its baseline represents for the same reason.

### A mask from one render and a value from another is a lie wherever they disagree

`valuescan --mode dl` took its character **mask** from an environment-hidden render and read
**luma** from the shipped frame. Wherever a prop occludes the character, the two renders disagree,
and the tool confidently reported **the prop's luma as the character's**.

It was caught only by a tell: four of eighteen stations returned values **identical to four decimal
places** across a change that moved every other station by 0.03–0.04. Something that does not move
when everything else does is not stable — **it is not measuring what you think.** Rendering those
four and looking at them showed the player was not on screen at all, only its floating HP bar above
a pantry counter.

The general form: **a two-render metric is only valid where the two renders agree.** If one hides
geometry to build a mask, the mask is of an *unoccluded* scene and the value is of an *occluded*
one. Either sample both from the same frame, or detect the disagreement and report those samples as
**invalid rather than as a number** — because a number is indistinguishable from a good one.

That makes **ten** instruments found returning confident wrong answers in a single session. The
tenth was found by an agent inside the very tool it was using to judge its own work, which is the
argument for §2 in one sentence.


### The measurement BOX is part of the instrument, and a long fan-out silently poisons it

Ten hours into a six-agent session this machine had **28 `fa-snap-*` Vite servers alive against 4
live `with_snapshot` parents**, the oldest running **10h43m**. `snapshot.mjs` is documented as dying
with its parent and `with_snapshot.mjs` owns both sides of a run — neither held. Every leaked server
was parented to an `npm exec vite` shim, i.e. the owner had gone and the shim kept the child alive.

**Load average 38.4 across 789 processes.** That is not untidiness, it is a tax on every measurement
in flight, and it is almost certainly the hidden cause of a whole class of "flaky under peer load"
reports this session: `audio-probe --mode live` failing a *different* check each run, `menu_accept`
dying with `Execution context was destroyed`, capture probes racing their own animations. Those were
all attributed to peers *saving files*. Some of them were peers *saturating the CPU*.

→ **`tools/tmp/snapsweep.mjs`**, and note the rule it encodes, because `pkill -f fa-snap` would
destroy a peer's in-flight run for exactly the reason `git stash` is banned:

> A `with_snapshot` process cannot outlive the measurement it owns, so **any snapshot server older
> than the oldest live `with_snapshot` parent cannot be backing a live run.**

That is a *derived* bound, not a guess, and it self-adjusts — a long measurement pushes the threshold
out to protect itself. Sweeping 21 leaked servers on that rule took load 38.4 → 33.4 and left all
four live snapshots untouched. Dry run is the default, because the failure mode is destroying work.


### One stale COPY of a driver contaminated ten instruments, and the count was wrong by 2×

The fix landed in `match-sim.mjs` on 2026-08-05: the scripted player's **stuck detector runs during
the countdown**, walking it sideways for **+567 ms** at the whistle. It never reached
`arena_probe.mjs` — and four other tools had lifted that driver verbatim.

**The brief said five files. `grep -l detourUntil tools/` returned thirteen.** Ten carried the
defect. Five still do. And a **fourteenth copy was born during the audit**, by a peer who could not
edit the files being fixed and correctly copied from a *good* source — caught by the new guard on its
first run.

What it cost, paired on identical seeds against a frozen sim:

| tool | delta |
|---|---|
| `arena_probe --matchups` | **110/110 matchups changed** in all three policies |
| `status_census` | 37/110 moved, max **50.0 pp**; median play −10.3% |
| `roster_table` | 58/110 moved, max **34.4 pp** — while the *aggregate* moved 0.8 pp, inside the noise floor |

**That last row is the trap in one line.** The aggregate was clean. Fifty-eight individual matchups
were not. An instrument can be right about the number you are watching and wrong about every number
underneath it — so **a paired per-matchup delta and an aggregate delta are different quantities, and
conflating them hides exactly this.**

**A second fault in the same driver is subtler and worse:** it *decides* during the countdown,
drawing seeded RNG. So changing the countdown length **re-seeds every match** — a change that moved
the approach by **+0.01 s** appeared to move **38 of 110 matchups by up to 50 pp.** Any timing change
can manufacture a large, consistent, reproducible, entirely fictitious balance result.

→ **Do not fix a copied bug in the copy. Delete the copies.** `tools/tmp/scripted_player.mjs` is now
the single implementation, both historical faults are reachable by flag so every "before" reproduces
**byte-identically**, and `driver_guard.mjs` (49 assertions) fails if a fourteenth appears. **Every
check also runs against the historical driver and must FAIL there** — a guard that passes on the bug
it guards against is not a guard.

**And re-derive history before building on it.** `ed8de35`'s "Lollipop was pulled out of last place"
does not survive its own tree: with the fixed driver at that commit, Lollipop is last again. It holds
on HEAD — but it held *then* for a reason the instrument invented.
---

## 6. Scale, zoom and framing decide what is worth building

- **Judge at shipped framing.** Isolation views sat at 265wu while the game showed ~578wu —
  every arena/floor/prop loop judged at **~3.5× the real zoom**. Re-shooting sorted the
  floor's work into *survives / vanishes / inverts*: the low-frequency gradient survives;
  tile bevels, grain and jitter vanish; tile scale **inverts** (25wu, sized to look right
  close up, puts 36 tiles across a real frame with ~1px joints — an aliasing generator).
- **Frequency bands.** A texture spanning 0..1 across one tile draws features *the size of
  the tile*, which reads as a tint, not detail. And `map` is per-**material**, not
  per-instance — any recognisable mark becomes a visible stamp across every surface. Own
  the bands separately: HIGH → texture (isotropic, no landmarks), MID → nobody, LOW →
  `instanceColor`.
- **But the low band is invisible per-frame.** Its wavelengths are 420–530wu against a
  578wu frame, so a player's whole screen sits inside roughly one lobe. It is a mood drift
  over ten seconds of running, not composition — five rounds were spent tuning it.
- **Measure sizes off a rendered frame, not by trigonometry.** Two agents computed the
  character's on-screen height as 13% and 7%; the truth is **~10.5%**. One ignored camera
  pitch, the other over-corrected for it. The *subject's shape* decides the answer.
- `preview-arena` is **1,700 draws against a match's 696** — judging performance there looks
  at 2.5× the real load.

---

## 7. Local optima fight each other; watch the sum

The per-element loop model has a structural flaw that was recorded as a risk from the start
and then **confirmed and quantified**: elements score 5–7 individually, the **whole scores
4.2**. The gap is real.

`tools/arena-scan.mjs` exists to catch this and found **ten** cases of separately-optimised
elements fighting — a HUD pill saying "safe" drawn over a ring meaning "lethal", a cyan
slow-tint matching the wrong hazard, one asset meaning both "run across me" and "solid".

**And the scanner itself does not catch everything.** Two independently-correct desaturation
passes together drove warm chroma to **0.067 against a reference 0.145** — under half.
Nobody was watching the cumulative total.

---

## 8. Correct the instruction, not just the output

Three critics unanimously prescribed "crush the environment into one desaturated band".
Measuring the reference showed it is **not desaturated** — mean saturation 0.493 — and that
we had already dropped *below all ten plates*. The critics were right about the **goal**
(separation) and wrong about the **mechanism**. The reference reserves **hue**, not
saturation: a saturated *cool* ground with the warm half of the wheel left for the cast.

Adding cool chroma lowers the warm band's share more cheaply than removing warm chroma does.

Similarly: scoping. `KPAL` controls ~21% of the frame; `floor.ts` overrides ~34% and
`props/counters.ts` ~16%. `KPAL.cabinet` and `KPAL.butcherBlock` reach the screen at **zero
pixels** — two rounds argued about them for nothing.

---

## 9. Lint a language by parsing it, not pattern-matching it

`hud.ts`'s CSS lives in a JS template literal, so a backtick anywhere in it — *including in
a comment* — terminates the string and 500s the dev server for every agent. It has bitten
four times.

A regex guard was widened, immediately false-positived on legitimate nested template
literals, and **a lint that cries wolf gets ignored**. It is now a parser catching every
syntax error across all 88 modules in ~95ms.

**Its limit is known:** a comment inserted after a `*/` silently ate a CSS rule and the
parser *cannot* catch it, because it is valid TypeScript. Only a screenshot found it. (The
`verify-head` import checker made the same mistake in its first version, matching imports
inside doc comments.)

---

## 10. Some things only a human can judge — say which

- **Feel cannot be screenshotted.** Aim comfort, hit weight, whether losing 88 HP in 1.2s
  reads as "outplayed" or "cheated".
- **Pointer lock cannot be tested here at all.** Playwright's Chromium refuses
  `requestPointerLock()` headless, headed, and with automation flags stripped.
- **Playwright's Chromium never blurs a page.** Measured: zero `blur` events and
  `document.hasFocus() === true` across a same-context tab switch, a cross-context
  `bringToFront()`, and `Emulation.setFocusEmulationEnabled: false`. So alt-tab-with-a-key-held,
  and the whole pointer-lock blur→pause path, can only ever be tested by *dispatching* the
  event — never by provoking one. Sibling of the pointer-lock refusal, and the same rule
  applies: test up to the boundary, then say where the boundary is.
- **A QA parameter can manufacture a bug that does not exist.** `?px=`/`?py=` place a fighter
  *exactly* where asked and do not validate against cover, so `px=850` drops the 42wu fighter
  inside a 50wu `CoverBox`. `tryMove` tests the **destination** for overlap and does no
  depenetration, so every step from inside is refused — **permanently, silently, on both axes.**
  That was reported as "WASD is dead on HEAD" and cost a full investigation to overturn. The
  general lesson: when a probe shows the game broken, **suspect the probe's own setup before
  the game**, and instrument the *edge* between subsystems (`window.__matchDebug` now mirrors
  input→sim) so "the input never arrived" and "the sim refused to act on it" cannot be
  confused again.
- **Frame time cannot be measured here.** SwiftShader is a CPU rasteriser; ~9–10 fps means
  nothing. Use draw calls, fill, program links, texture residency — all hardware-independent.
- **A slow harness fabricates false negatives.** Polling an analyser from rAF at
  SwiftShader's frame rate missed 4 of 5 countdown blips and reported the game as *silent*.
- **The two most valuable bug reports on this project came from Uri simply playing it** —
  clicks not firing, and the character not facing the cursor. Both were invisible to `tsc`,
  to 51 assertions, and to every screenshot.

Saying "I could not verify this" is a valuable answer. A plausible measurement taken once
and treated as fact has cost this project real time — twice.

---

## 11. Budget

- **~300k tokens typical, ~470k worst** per build/loop agent.
- **6 concurrent burned 30% of a session in 30 minutes.** 2 concurrent ≈ 20%/hour.
- **Total agent count is the budget; concurrency only sets the rate.** Nine weapon agents
  cost ~2.7M whether run 6-up or 2-up.
- There is a **200-agent per-session spawn cap**, and this session hit it — which ended all
  parallel work. Treat agents as a finite resource, not a throttle.
- **Under-pacing is a real failure too**: an idle slot while waiting on a report. Have the
  next brief ready before the current agent finishes.
- Extra budget buys **thoroughness, not parallelism** — deeper verification, more probes,
  re-running the whole-arena scan after every change.

---

## 12. Trap list (mechanical)

- `restPose()` must fully reset the `body` transform — attack/hit/death accumulate with `+=`.
- `ChibiRig.headCentreY` assumes a head mass extending ~±R about its origin; non-spherical
  masses float or sink.
- `dressTorso`'s `size.h` measures off the **default** torso bbox (~92% of nominal) — caused
  a floating head that *looked* like a `headCentreY` bug and wasn't.
- **Lathe profiles must run bottom→top** or normals invert and the mesh renders near-black.
  Bit six characters at once.
- Composing `rotation.x` then `rotation.y` does **not** rotate a flat plane about world up —
  Euler angles are intrinsic and sequential, so it tips edge-on and vanishes from this
  camera. Use explicit quaternions.
- `setFromUnitVectors` picks the shortest arc and leaves a **different residual roll per
  side** — Sushi's eyes read as a lazy eye.
- **Never set `material.vertexColors = true`** on the tile mesh: it enables a per-vertex
  `USE_COLOR` path needing a `color` attribute the geometry lacks, rendering the whole floor
  **solid black**. `InstancedMesh.instanceColor` alone is sufficient.
- **Never read initial state off a pooled material.** A spawn helper that reads its opacity
  inherits whatever the last particle faded to, so once the pool wraps every particle spawns
  invisible ~1s into every match. *Set*, never read.
- `stance.shoulderL/R`: `shoulderL` sits at `x = −shoulderWidth`, so a **positive** z-rotation
  swings that arm **across** the body. Both arms swing inward by default — fine on a narrow
  body, buries them on a wide one.
- Clamp menu `dt` at zero: a negative first rAF delta drove `Math.pow(0, negative) → Infinity`
  into `CameraRig`'s lerp and NaN'd the portrait camera permanently.
- `#screens` / `.hud-root` must stay `pointer-events: none` with only real controls opting
  in. A full-screen `auto` layer starved firing **and** aim-facing at once.
- `renderer.dispose()` does **not** release a GL context — needs `forceContextLoss()` and
  canvas removal.
- `renderer.info` after `composer.render()` reports only the **last pass** unless
  `autoReset = false`.
- `BlendFunction.SKIP` is **9** in postprocessing 6.37; `0` is `ADD`. A documented ablation
  recipe was *adding* effects while claiming to skip them — a 6× under-report.
- Vite's SPA fallback returns **200 for any unknown path**, so a status-code test passes
  vacuously. Compare bodies.
- `tools/snapshot.mjs` servers **die with the shell that started them** — start and measure
  in one invocation.
- `window.__stage` is a single slot overwritten by the last `Stage` constructed; on menus
  that is a throwaway thumbnail generator which then disposes.
- **An ID buffer must be READ in the space it was WRITTEN.** `renderer.outputColorSpace` is
  sRGB, so linear-written IDs are transfer-encoded on the way to the framebuffer and every ID
  quantises into the wrong slot. This produced a confident, entirely **fictional** list of
  zero-pixel meshes — hotdog's bun and sausage, pizza's cheese, soup's broth — and an agent
  came close to "fixing" meshes that were never broken. Forcing the pass to linear showed all
  of them fine. Any probe that encodes data as colour must disable the transfer, or it is
  measuring the transfer. See §13: an instrument that lies plausibly is worse than none.
- 🚨 **`Material.clone()` does NOT copy `onBeforeCompile`.** `Material.copy()`
  (`three/src/materials/Material.js:940-976`) names 40+ properties and not that one, so **every
  cloned material silently loses its shader patch.** This is what reduced our Fresnel rim — the
  term `toon.ts` calls *"the single largest material lever in the frame"* — to **1.402% of
  delivered pixels** across 54 clone sites, and it is the root cause of the #1 defect.
  The smoking gun is the shape to look for: **the same material name appearing twice in one
  frame with different behaviour** (`kpal:woodPad`, 0.805% of frame with the rim, its clone
  2.501% without). *Zero* new GL programs is the reason it is safe to fix everywhere:
  `customProgramCacheKey()` returns `onBeforeCompile.toString()`, so an identical patch source
  shares one compiled program and only the uniform container is per-material.
- 🚨 **And the repair has its own trap: `Material.copy()` runs `userData` through
  `JSON.parse(JSON.stringify(...))`.** Two consequences, both live here:
  1. A plain `.clone()` of an **already-rendered** material carries a **dead, JSON-mangled**
     `userData.rimUniforms`. Four instruments (`haloprobe`, `matvar`, `rimcheck`,
     `p1_matresp`) detect a rim by testing that key and **count the corpse as live**.
  2. Anything you stash in `userData` to survive a clone must be **JSON-safe**. A
     `THREE.Color` round-trips to `{r,g,b}`, which `new THREE.Color()` cannot read back —
     so the rim parameters are recorded as a plain hex + number, deliberately.
  The general form: **a property written from INSIDE `onBeforeCompile` does not exist until
  first render**, so a build-time clone has nothing to copy. Record what a clone needs
  *synchronously*, at the point of application.

---

## 13. The harness can invert the very thing you are measuring

`src/preview.ts` set the character backdrop to a saturated cyan `0x39b7e8`. Measured:

| | character vs background |
|---|---|
| **preview harness** | character is **darker** — edge 0.438 vs surround 0.839, contrast **−0.40** |
| **the real match** | character is **lighter** — edge 0.571 vs surround 0.301, contrast **+0.27** |

**Opposite polarity.** Every character packet ever judged on this project was scored against a
figure/ground relationship the player never sees — and a *cool* rim light on a *cyan* backdrop
reduced apparent separation by 0.035, which is precisely why critics kept reporting the rim as
absent. The asset was fine; the darkroom had the wrong safelight.

This is the sibling of §5 (measurement contamination) and §6 (judge at shipped framing), and it
is worse than both: contamination adds noise and wrong framing adds bias, but **an inverted
harness flips the sign of the answer.** Before trusting any A/B, confirm the harness reproduces
the *polarity* of the shipped view, not merely its subject.

### A metric can be perfectly TRUE and still tell you nothing

**"AI stalled: 0.0%" was true for months while the AI was permanently deadlocked.**

Measured: with the player motionless on its own spawn, the enemy walked 2,968wu, parked against a
counter face and **oscillated 38wu for the remaining 25 seconds of every match, in all 11
characters.** It never registered, because `match-sim.mjs` calls a stall a span under **15wu** —
and 38 > 15. The metric was not wrong. It was answering a narrower question than the one everyone
believed it was answering.

The number that *did* expose it was **reachability** — 79.1%, and an idle player reached in
**0 of 110 matchups**. Two lessons, and the second is the general one:

- **Prefer a metric that asks about the OUTCOME** ("does the AI ever arrive?") over one that asks
  about a symptom ("is it standing still?"). Symptom metrics have thresholds, and a bug that
  clears the threshold is invisible.
- **A healthy dashboard is not evidence of health.** It is evidence that nothing you chose to
  measure is failing. Before trusting a green metric, ask what it would look like if the thing
  you actually care about were broken — and if the answer is "the same", it is not a guard.

Same shape as §7's local-optima problem: the elements each scored 5–7 while the whole scored 4.2.
Every measurement was correct and the conclusion drawn from them was wrong.

**The general form: validate the instrument against a known input before believing it on an
unknown one.** Two of this project's most expensive detours were instrument faults that no
number of additional rounds could ever have found — five rounds tuning a low-frequency gradient
whose wavelengths (420–530wu) exceed the frame (578wu), and every character round judged
against inverted contrast.

### 🚨 And the sharpest version: a check that CANNOT fail, inside the guard built to catch that

`tools/tmp/sentinel.mjs` is the **meta-guard** — the instrument that validates the other
instruments, and the encoding of *"a guard that has not been shown to FAIL is not a guard."*
Its `selfPair` kind was implemented as `holds({ a, b: a })`.

**That compares `metric(a)` against `metric(a)`, which is zero for ANY pure function regardless
of what it returns.** It proved *determinism*, nothing more. So the row reading

> *"figureGround reports ZERO on a figure identical to its ground"*

**asserted no such thing for its entire life.** A `figureGround` returning a confident **0.42** on
an identical field passed it. Proven on a real mutant: a `+0.42` constant in the boundary path is
**accepted** by the old form and **refused** by the new one — same input, same process.

Fixed by giving `selfPair` an optional `identity`: when the answer on a self-identical input is
known *by construction*, the returned **value** is checked too, not merely its stability. The
existing figureGround row was measured at exactly 0 — so it was **true**; it had simply never
been **asserted**.

→ **A guard has two ways to be worthless, and this project had only been watching for one.**
It can fail to fail on the bug (the known-bad-input rule). Or it can be **tautological** — phrased
so that no implementation could ever fail it. The second is harder to see, because it passes
loudly and forever. **Ask of every assertion: what implementation would FAIL this?** If you cannot
name one, it is a comment with a `✓` next to it.

Corollary from the same pass: when a mutation harness rebuilds an instrument to break it, the
**unmutated rebuild must be asserted to reproduce the original exactly**, and a missing mutation
anchor must **throw** rather than skip. A skipped mutation turns every refusal into a pass — the
same shape as the `driver_guard` whose coverage *shrank* from 49 to 41 when a bug was fixed.


---

## 14. A metric can measure the RIGHT thing and still be saturated

`feel_probe.diff()` counted pixels changed against a pre-event baseline, to score how much an impact
burst grows with damage. It reported **1.66×** across a 9.0× damage input, and a whole pass was
dispatched to fix "the weakest feel channel".

**The channel was fine. The counter was full.** A hit moves the burst, the white flash *and* the
knockback inside the same box. Proof from the tool's own output on an unchanged tree:

| | reads |
|---|---|
| a **fog** hit — flash only, no VFX at all | **3904 px** |
| a **weapon** hit at the same damage — flash **plus the entire burst** | **3879 px** |

The whole burst moved the counter by **−25 px**, under its own 197 px noise floor. Ablating the VFX
layer against itself in one instant gives the real answer: **6.31×**, between camera kick (6.73×) and
hit-stop (4.83×). It never needed fixing.

→ **When several effects share a region, a whole-region counter measures the loudest one forever.**
Ablate the thing you are actually asking about, in the same frame, and prove the ablation moves with
a control that has none of it.

---

## 15. The measurement instrument had been shaping the game for two passes

`tools/tmp/scripted_player.mjs:bestWeapon` opens `if (w.type === 'self') return;` — **the scripted
player cannot press heal.** It is the exact mirror of a bug fixed months earlier in `ai.ts`, where
`pickHighestDamageWeapon` skipped `'self'` so the *AI* could never heal. Same weapon, same character,
same one-line exclusion, other side of the match.

It cost **50.6 pp on exactly one character** — Hamburger owns the roster's only `self` weapon and its
smallest pool, so one press is a third of its HP. Self-heal reads 0.0 HP/match in the player's hands
and 27.0 in the AI's, while engagement distance, damage taken, status application and opening all
agree within a few percent.

**A human can press it. Only the measurement could not.** And the roster was balanced *twice* against
that instrument — so "Hamburger is the strongest character in the game" and "8 of 17 settled matchups
involve Hamburger" are both artefacts of a driver that under-plays one character.

→ **Before tuning a system, ask what the thing measuring it cannot do.** A one-line exclusion in a
harness is indistinguishable from a design fact until someone runs the control.

---

## 15b. A probe that CHECKS for a capability, correctly finds it absent, and proceeds anyway

The subtlest instrument fault found so far, because every individual step of it is correct.

A probe priced the post chain's `highlightKnee` and reported the lever was worth **+0.72 pp** of
playfield highlight share. Re-measured paired inside one synchronous evaluate — drift control
**exactly 0.0000** — it is worth **+0.081 pp**. **Nine times smaller**, and the difference decided
whether a knob got turned.

The cause: the probe needed to freeze the sim, so it tested `typeof d.pause === 'function'` on
`window.__matchDebug`. That returned `false` — **correctly**, because `__matchDebug.paused` is a
*field on a read-only mirror*, not a `pause()` method. The probe then **carried on measuring
anyway**, so its "before" and "after" frames were two different moments of a running match and it
was reading animation, not the knob.

→ **A capability check whose failure branch is "continue regardless" is not a check, it is a
comment.** If a probe needs an invariant to hold, it must **refuse to produce a number** when the
invariant is absent — the same rule `valuescan` learned about stale caches, one level further in.
And note the shape of the near-miss: the probe *knew* the answer and did not *use* it.

### Corollary — a critic of a metric can commit the metric's own sin

The same probe's headline argument was that `stage.ts` had rejected a knob using a **cross-quantity
comparison**. It was right that this happened. But its own replacement compared *"any channel at
exactly 255, whole canvas"* against *"luma > 0.94, playfield crop"* — pure red (255,0,0) is **100%
of the first and 0% of the second**. It replaced one cross-quantity comparison with another.

Its **conclusion** still survived, on a control neither side had taken: the reference plates' own
channel clipping, identical crop, identical code, **native resolution** — reference **1.70–18.93%**
against ours **0.044–0.51%**. We do not produce a single all-channel-white playfield pixel; every
plate does. **So take the finding and re-derive the argument** — §3's rule about critics applies to
instruments and to agents, not only to the blind critic.

*(And the "40× regression" that rejection rested on is an artefact: `softKnee` is asymptotic to 1.0
and can never emit 255, so the metric is nearly a detector for "is a shoulder present at all."
At ≥250 the real move is **1.29×**.)*

---

## 16. Two signals that look like "hung" and are not

A probe was killed as deadlocked on 55 minutes elapsed, **0.0% CPU**, and **no file writes in 43
minutes**. It was on **row 171 of 198**, working normally. Both signals were wrong for this workload:

- **0.0% parent CPU is expected under SwiftShader.** The rasterisation happens in Chromium's
  *renderer children*; the parent node process legitimately idles while waiting on them.
- **"No writes" meant nothing** because the tool buffered its whole result and wrote at completion.
  From outside, "measuring row 172" and "hung forever" were identical.

The fix was not better judgement — it was **making the tool account for itself**: rows now append to
`<out>/dl.rows.jsonl` as they are measured, with the meta stamp as line 1, so a partial file is
self-describing.

→ **The same defect underlies the stale-cache bug in the same tool: a tool that gives no observable
account of its own state cannot be distinguished from a broken one.** Judge a long-running probe by
its own per-row output, never by CPU or mtime.
