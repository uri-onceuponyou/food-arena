# Lessons

Everything below was paid for. Reading this is cheaper than re-learning any of it.

---

## 1. "It isn't there" almost always means it IS there and is INVISIBLE

**True cause seventeen separate times.** Assume rendering-but-invisible *first*, and prove it
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
