# State — what is done, what is pending

**As of commit `b967242`, 125 commits into an unattended session.** Every commit verified with
`tools/verify-head.mjs` before push. Working tree clean.

Judgement calls live in **`docs/DECISIONS-FOR-URI.md`** — read that first if you are Uri; it opens
with a one-screen answer sheet. **New session? Read `CLAUDE.md`, then this file, then
`docs/LESSONS.md`.**

---

# PART 0 — where the game actually stands

**For the first time, the score can be trusted.** The blind-critic instrument was audited and rebuilt:
a canonical rubric (`tools/review.rubric.txt`), top-down plates for gameplay, action frames rather
than idle ones, menus scored against menus, and a **measured resolution floor of ±1.4 points**.
43 rounds, 43 valid.

| element | ours | sd | reference | gap in **floors** |
|---|---|---|---|---|
| **cast in match** | **4.33** | 0.52 | 8.00 | **6.5** |
| arena (action frame) | 5.17 | 0.41 | 8.33 | 5.6 |
| home | 5.17 | 0.41 | 8.50 | 5.9 |
| in-match HUD | 5.67 | 0.52 | 8.33 | 4.6 |
| character select | 7.00 | *n=1* | 8.00 | not a result |

**The bar is 7+.** Calibration: over 34 observations the critic **never scores shipped Brawl Stars
above 9**, typically 8–8.5 — so 7+ sits ~1–1.5 below shipped Brawl Stars. The bar is well placed.

⚠️ **Do not splice these onto the old series** (arena 5.33/4.0/3.875/6.0, characters 3.6/3.25/3.0/2.0).
Different rubric, plates, frame content and n. And note what the audit proved about that old series:
**its largest single step was 1.0 — inside the floor. "The characters got worse" was never an
observation.**

## The one finding that dominates

**"Surfaces are flat and unlit — no material variation, no contact shadow, no depth."**
**6/6** critics on HUD, **6/6** home, **5/6** select, **4/6** arena. Two said it unprompted:

> *"the playfield looks like coloured paper **while the HUD looks shipped**"*

Our best element was being marked down for the surfaces behind it. **This is the #1 item**, and it
has measured leads already in hand — see PART 2.

---

# PART 1 — DONE

## Gameplay

- **All six 🔴 bugs** fixed (the clock ended nothing · trail marks stacked an 87 HP one-frame kill ·
  melee at distance 0 ignored facing · a fighter inside the pot was 0.0% visible · the radar showed
  no zone · match duration ~7× too long).
- **Five AI driver bugs**, every one the same shape — *a rule stated once in `rules.ts` and
  implemented differently elsewhere*: a stun silenced the AI (11/11 characters — the stunned player
  fired 100% of its shots, the stunned AI 0%); both drivers ranked weapons by authored `damage`
  (which is per-*pellet*); a melee-only AI had nothing to fire when fleeing; the flee branch aimed
  **away** from the player and fired along it (8 of 11 dealt literally zero); and the terrain slow is
  applied to the player only — **the AI crosses every puddle at full speed** (0.450000 vs 1.000000;
  *parked* — fixing it regresses settled 17→19).
- **Levels 1–15**, +5%/level of HP and damage (1.70× each = 2.89× effective). **Level 1 is
  bit-identical to the pre-levels build**, proven tick-for-tick. The AI mirrors the player's level:
  win rate drifts **1.9 pp across L1→L15**; with the enemy pinned at L1 it would be **99.4%** by L15.
- **The roster has a second axis.** Per-character health and speed are simulated (they were card
  fiction). **Settled matchups 70 → 22 → 17 of 110.** Rarity is **not** power — tier spread
  **3.98 pp** against a ~9 pp floor — and costs nothing extra to level (§26). Speed measured as a
  **nearly inert lever**; every point of the result is health.
- **Pacing.** Countdown 5.68 → 3.68 s with **zero** win-rate change, proven: 3,520 matches
  bit-identical. `MATCH_DURATION_MS` and the fog schedule were both **falsified** as pacing levers.
- **Touch is sound and closeable** — 36/36 distinct bearings, worst error 0.27°, reversal spread 0.
  Two real defects fixed: a second finger in the same zone killed the stick, and **83.3% of the
  bottom 38% of a portrait frame was dead to touch, with the control hints drawn on it**.
- **Session continuity.** The URL now names the screen and reloads land there. A restored WebGL
  context was rendering **15.65 luma darker, permanently** (a dead PMREM env map plus a shadow map
  that never redraws). One bad screen constructor used to kill the router permanently.

## Presentation

- **Cast:** dark rung (p05 0.273 → 0.157; 11/11 pass `range`/`p05`/`steps10`), silhouette (hull
  deficiency 0.1379 → **0.2621**, the reference median; appendages 0.5 → 3.0; **11/11** clear the
  floor, from 1/11), near-white clipping **0.1007 → 0.0275** against a reference median of 0.0249.
- **Arena:** brightness (nothing railed it; frame luma 0.322 → 0.402), edge grammar (the reference
  marks a ground seam with a **dark band, never a bright line** — we had it inverted), contact
  grounding (share past the 0.06 threshold 16.9% → 35.6%), stains (they had **no dark core at all** —
  a bright ring around nothing).
- **Lighting:** the key light's **azimuth sign** was throwing every shadow behind its own object.
  Contact ΔL 0.0353 → **0.1242**. Figure/ground *paid* rather than cost: cast minimum −0.0014 →
  **+0.0593**, gate failures 3 → 0.
- **HUD:** 20 WCAG failures → 0, min ratio 1.89 → 6.48. Eight defects, all bugs — including a
  `.hud-zone.is-danger` state authored and selected by nothing, and damage numbers erasing the clock.
- **VFX:** the trail was **0.7° of hue from the floor and 1.0° from the cast** — the critic's phrase
  was literal. Now 22.4°, with cast figure/ground +5.1%.
- **Audio:** the top three octaves did not exist (tilt −5.57 dB/oct, 86.2% of energy below 1 kHz).
  Now −5.07, duty cycle **21.9% → 58.6%**, plus a kitchen ambience bed. `generic.hurt()` alone was
  holding the game darker than the other fifteen sounds combined.
- **Menus:** key rebinding (35 assertions read off **sim state**), the levels UI, and three more
  "shows a number the model does not compute" defects.

## The instruments — the session's real output

**Nineteen instruments were caught returning confident wrong answers.** Each is fixed and validated
against a known-bad input. The most consequential:

| instrument | what it was doing |
|---|---|
| **the blind critic** | **±1.4-point floor; a round's two panels are n=1, not n=2.** The rubric alone is worth 2.0 points and there was no canonical one. |
| `scripted_player.mjs` | **`bestWeapon` skips `'self'` — the measurement cannot press heal.** Worth **50.6 pp** on Hamburger. ⚠️ **The roster was balanced twice against this.** |
| `feel_probe.diff()` | saturated: a fog hit (flash only) read 3904 px; a weapon hit (flash **plus the whole burst**) read 3879. The burst's real range is **6.31×**, not 1.66×. |
| `valuescan --mode gate` | served **stale JSON off disk** — reported 0/11 passing where HEAD is 11/11, and named the **wrong characters**. |
| one stale driver | copied into **ten** tools; a fourteenth born mid-audit. `roster_table`'s aggregate moved 0.8 pp while **58 of 110 matchups moved, max 34.4 pp**. |
| `arena-scan` | ignored `PREVIEW_BASE`, silently measuring whatever was on port 5187. Three rails also disagreed with their own HUD-free twins. |
| `hud_fit` harness | missing `box-sizing`, so it reported "0 px overflow" against a real 15.1 px — **and `hud.ts` cited that number in a source comment as proof.** |
| `driver_guard` | its coverage **shrank** when a bug was fixed (49 → 41), because its census keyed off the bug's own fingerprint. |
| `limbcheck` | measured **22°** and a pose the player never sees; the match camera is **58°**. Reported 9/11 passing on a cast where 10/11 failed. |

---

---

# PART 0b — 🚨 THE SESSION THAT MOVED EVERY OBJECTIVE METRIC AND ZERO POINTS OF SCORE

**Read this before choosing what to work on.** 22 fresh critics, 22 valid rounds, 0 discarded,
every reference panel in 7–9, canonical rubric, `gameplay_topdown` plates only, HEAD `56ccb62`.

| element | baseline | now | delta | floor | clears? |
|---|---|---|---|---|---|
| arena (action frame) | 5.17 ± 0.41 | **5.00 ± 0.63** | −0.17 | 0.60 | **NO** |
| cast in match | 4.33 ± 0.52 | **3.83 ± 0.41** | −0.50 | 0.53 | **NO** |

**`hi70` moved 4.7 floors — 2.40% → 13.58%, past the reference median — and the score moved
nothing.** That was the acceptance test defined before round 1, honestly measured, and passed
convincingly. **It was not the binding constraint.** This is `docs/LESSONS.md` §7 in its purest form
so far: an objective test can be well-chosen, cleanly measured, and still not be the thing.

### The drift control, and why it is ALSO not a result

The same **byte-identical** baseline sheets, re-scored by fresh critics six hours later, read
**0.42 (arena) / 0.58 (cast) LOWER**. That would mean a cross-session wobble of ~0.5 that is not the
game. **But it does not clear its own floor either** — at σ=0.50 with n=6 vs n=4 the SE is 0.323, so
those are **1.30σ and 1.80σ**. *Suggestive, not established.* **8 critics per arm would settle it**,
which is cheap and worth doing before any future before/after spans a session boundary.

⚠️ So the correct reading of today is: **no measurable change in either direction, and a live
hypothesis that the instrument itself drifts across sessions.** Do not report today's work as a
regression — and do not report it as a win.

## THE ACTIONABLE OUTPUT — three mechanisms critics named UNPROMPTED

`docs/LESSONS.md` §3: when two critics name the same mechanism unprompted, take it seriously.

### 🔴 1. THE FLOOR PLANE — **9 of 14 arena critics**, and we deliberately never touched it

> *"a flat, untextured pink-and-blue checkerboard with hard unmodulated tile lines and no surface
> detail or contact shading, so the characters sit on it like decals rather than in a built
> environment"* · *"a **hard, unblended straight seam** between the two colours"* · *"the vast empty
> grid-tiled floor is flat and prop-less across most of the frame"*

`e4734e2` raised prop **top faces**. `apron.ts:830` passes `rim: false` to the ground **on purpose**,
and the arena agent was explicitly told to leave `tileLight`/`tileDark`/`subfloor` alone because
`floorprobe` breaks on a global floor value change. **Every one of these critics is looking at the
one surface nobody was allowed to touch.**

**And it converges with a measurement taken independently, from pixels:** p1 found **63.44% of a
gameplay frame is a flat ground plane**, with **zero normalMaps project-wide**. Two signals, one
surface. ⚠️ But `bs_04`'s ground is *also* smooth — so the lever is most likely the **hard tile grid
and the unblended colour seam**, not surface detail. Probe before looping.

### 🔴 2. ONE PROP READS AS AN UNFINISHED PLACEHOLDER — **~8 critics**, arena *and* cast

> *"the giant untextured pale-blue box in the foreground looks like an unfinished placeholder block"*
> · *"the huge blank ice-block slab in the lower-left crops the frame with nothing on it"* ·
> *"untextured, unlit and unshadowed, and it **hard-crops the character it overlaps**"*

⚠️ **Consider that `e4734e2` may have made this worse.** Raising a big blank slab's top face into
the 0.72–0.82 band makes it *more* prominent, not less. That is a plausible mechanism for cast
4.33 → 3.83 — which does not clear the floor, so it is a hypothesis, not a finding. **Probe it.**

### 🟠 3. THE TRAIL STILL EATS THE CAST — and the previous fix's rationale is FALSIFIED

`b967242` fixed the trail's **hue** (0.7° from the floor → 22.4°). The occlusion complaint **did not
move**: 5 of 6 critics on the old frame (*"opaque flat-pink cloud swallows both fighters"*), **5 of 6
on the new** (*"a large flat semi-transparent red blob that covers a third of the play space"*).
**Hue was never the binding constraint — AREA and OPACITY are.**

## And my own frame read was REFUTED on both halves — recorded because the error is instructive

The orchestrator eyeballed a frame and claimed the character was *"~5% of frame height"* and *"the
right-hand third is empty tile"*. Measured off ruled frames (`cr_geom.mjs`, 17/17 selftest):

- character height is **10.6–12.6%** (donut 10.6–11.9, taco 9.2, hamburger 12.6) against plates at
  **11.7–14.4%**. We sit at or just under the low end. **The eyeball was wrong by ~2×** — the exact
  documented trap (*"two agents computed 13% and 7%; the truth is ~10.5%"*), committed again.
- per-third occupancy **L 33.6 / C 47.6 / R 38.7**, min-third ÷ whole **0.825** against a plate band
  of **0.712–0.918**. Whole-frame occupancy **rose** 32.73 → 40.74, into the plate range.
- ⚠️ **And the frame looked at was the wrong artefact entirely** — `shots/knee2/shipped.png` is a
  `kneeprice` probe frame: no HUD, no opponent, no VFX, one idle character. Precisely the idle
  content that costs ~1 point and that `baseline_capture.mjs` exists to stop scoring.

**But the perception was picking up something real that the metric cannot express:** occupancy scores
one big value-varied slab the same as many small props. *"Not emptier in value"* and *"emptier in
content"* are both true, and the gap between them **is** convergence 2.

---

# PART 2 — PENDING, ranked

## 🔴 1. Flat, unlit surfaces — the #1 defect. **THE MECHANISM IS NOW KNOWN: the game draws no highlights.**

Named by 6/6 critics on three elements. **Three independent probes converged on one mechanism** —
the convergence signal `docs/LESSONS.md` §3 says to trust, and the *ninth* consecutive plateau that
turned out to be a bug rather than a taste gap:

| probe | measured | says |
|---|---|---|
| p1 | Fresnel rim reaches **1.402% of pixels**; 33 of 112 lit materials carry it | the edge-highlight term is **missing** |
| p2 | prop surfaces carry **one flat value per face** — no gradient across a face, no crevice darkening | the form-highlight is **missing** |
| p6 | share of playfield above luma 0.80: **ours 0.67–1.68% vs reference 2.39–19.06%**, non-overlapping | **nothing bright is ever drawn** |

### ✅ LANDED — `c90c9ea` · `ecd07fa` · `e4734e2`

| metric | before | after | in floors | reference |
|---|---|---|---|---|
| **hi70** (playfield share > luma 0.70) | 2.40% | **13.58%** | **4.7×** | min 6.65 · median 9.40 |
| **p95** (playfield) | 0.6616 | **0.7725** | **3.6×** | min 0.732 · median 0.791 |
| live rims, whole scene | 71/112 | **93/112** | — | — |
| rim **corpses** | **22** | **0** | — | — |
| cast `centreContrast` (paired, exact) | 0.0426 | **0.0516** | +21%, held/grew 13/18 | — |
| `arena-scan` meanSat | 0.4657 | **0.4877** | — | target 0.493 |

**Saturation went UP**, confirmed by an instrument sharing no code with the probe. 10 of 13 baseline
rails moved closer. `floorprobe` 5/5 with `pantry_ne` **byte-identical** to its pre-session value —
the drift control proving no floor value moved.

⚠️ **`clippedHighPct` is NOT a concern**: measured on the identical definition, whole frame, both
sides — **reference 1.36–16.36%** (median ~6.2%) against **ours 0.379% → 0.434%**. We are **3.1×
below the lowest plate**. The rise is correct and nowhere near the band.

### ⚠️ `valuescan --mode gate` — VERIFIED (`freshness PROVEN`), and it is **4 PASS / 7 FAIL**

**A CAST PASS TRADED `p05` FOR FIGURE/GROUND, across the whole roster.** This is the cleanest
instance of `docs/LESSONS.md` §7 (local optima fighting each other) yet measured here:

| gate | before (16:43) | now | |
|---|---|---|---|
| `p05` (dark anchor) | **11 of 11 FAIL** | **0 of 11** | ✅ fixed roster-wide |
| `range` | 6 of 11 FAIL | **0 of 11** | ✅ fixed |
| `dlBelow10` (figure/ground) | 1 of 11 FAIL | **6 of 11 FAIL** | 🔴 paid for it |

**17 failures fixed, 5 created.** Arguably a good trade — but nobody chose it, and the gate is red.

**The mechanism, on `lollipop` (clearest case):** `fig` is pinned at **0.497 at 17 of 18 stations**
against a ground at 0.40–0.48, so `dL` sits at 0.02–0.10 **by construction**. Its `range`/`p05` went
0.681/0.2915 (both FAIL) → 0.862/0.071 (both PASS) in the same window. **Pulling a character's
median into the floor's own value band is what fixes `p05` and what destroys `dL`.**

⚠️ **6 of the 7 failures have `worstStn` = `fog_late` or `fog_boundary`** — stations where figure
*and* ground both collapse toward the veil colour. **That is an ARENA fix, not a cast fix**, and the
gate already grants `grease_in` an exemption for exactly this class. Do not send a character agent
at a fog station.

⚠️ And the `weakBoundaryPct` failures carry the tool's **own** warning: *"the 15 cap was calibrated
on `dL` and does NOT transfer to `weakBc%`"*, plus the cliff-not-band note (a 0.0142 luma move once
swung it 33 pp).

**Attribution:** the arena rim raises ground luma by **+0.0088** and `fig > grd` for these
characters, so it can only push stations already sitting in the **0.100–0.109** band across the
line — exactly **one** qualifies across lollipop's 18 (`pot_diagonal`, 0.1015). **The other failures
are not the arena pass.**

⚠️ **A correction to an earlier entry in this file.** The `lollipop`/`sushi` scare was closed here as
*"not a regression"* on the grounds that `1f51987` already recorded **lollipop 11 of 18 stations,
sushi 6 of 18**. That is still true **for those two characters**. But it was written as if it closed
the whole question, and it did not: across the roster `dlBelow10` went from **2 characters failing
pre-session to 6**. **Resolving the named instance is not the same as resolving the class** — the
same error shape this file records in §1 (fixing an anchor is not verifying the result reaches the
screen).

### 🚨 Root cause — `Material.clone()` silently drops `onBeforeCompile`

`three/src/materials/Material.js` `copy()` names 40+ properties and **not** `onBeforeCompile`.
`applyRimLight` is called from exactly **one** site (`toon.ts:192`, inside `toonMat`) and nothing
re-applies it after a clone. There are **54 material-clone sites in `src/`**, so the arena's whole
cloned palette renders with **no rim** — the term `toon.ts` itself calls *"the single largest
material lever in the frame."*

**Smoking gun:** `kpal:woodPad` appears **twice in one frame under the same name** — the original
with the rim (0.805% of frame), its clone without (2.501%). Two independent instruments agree on
33 of 112 (`matvar --mode census`, and a `renderer.properties` handle count).

→ Fix with a **`cloneToon()` helper in `src/render/toon.ts`** so the 54 sites cannot silently drop it
again. Zero draw calls, zero new programs (an identical `onBeforeCompile` source shares one cached
GL program). ⚠️ **Not the ground plane** — `src/arena/apron.ts:830` passes `rim: false` on purpose.

### ⚠️ Lead 1 (the contact decal) is FALSIFIED — it was the "cheapest lead" and it was a category error

**The old wording, kept so nobody re-derives it:** *"Raise `src/arena/`'s baked contact decal ~2.5×.
It sits at |dL| 0.0491 against a 0.1238 reference measured off real barrels. Beats a whole SSAO pass,
for zero draw calls."*

**0.0491 and 0.1238 are different quantities.** 0.0491 is the mean *ablation delta of the baked decal
layer alone* over 0–0.15 m; 0.1238 is the reference's *total shipped contact contrast* (open-floor
luma − contact-band luma) over 0–0.25 m, all layers. Measured **like-for-like on HEAD, ours already
matches or exceeds Brawl Stars**:

| | ours | bs_04 |
|---|---|---|
| shadow side, ≤3 m | **0.1415 / 0.2181** | 0.1238 |
| lit side | −0.0044 / 0.0000 | 0.0161 |

And **there is no 2.5× in the knob** in any of its three readings: opacity headroom **1.11×**
(`CONTACT_PEAK_ALPHA` is already 0.9), darkness headroom **1.14×**. All three possible changes move
the arena *further* from the reference. The layer actually doing the grounding work is the **shadow
map**, not the decal. **Do not spend a round on this.**

### Lead 2 (SSAO) — worse than recorded, and a cheaper approximation exists

`useAO` has **zero call sites in `src/`**, so it cannot be re-measured on HEAD, but its draw cost is
bounded exactly and is worse than recorded: **+395 draws (+94%), +99% triangles**. An
`EffectAttribute`-based approximation in the existing post chain is the cheaper route if ever wanted.

### Lead 3 (`glossyMat` has no rim) — real, and now gated

The per-character `clipShare` run it was gated on is **done: 4 of 5 pass, SOUP FAILS** (pushes past
the reference band maximum), and on egg it does almost nothing.

⚠️ Facts to carry, both **confirmed on HEAD**: **52.6% of the cast (20 of 38) is authored at
roughness ≥0.6**, where specular headroom has already collapsed 10×; and
**`material.envMapIntensity` is silently discarded** (`three.module.js:17341-17343`, outside the
`refreshMaterial` guard, so it runs every draw). Assigning `material.envMap = scene.environment` to
escape the overwrite is a **provable no-op at the scene's own 0.32** (dMean 0.0000/255) — and at ×2
it behaves as **flat ambient, not sheen**: floor p05 0.248 → 0.361 while range 0.307 → 0.263, i.e. it
washes the darks. **It is not a sheen control.** All 112 materials sit at the default 1, so the knob
carries zero authored variation today.

### The composition census nobody had

**18.39% of a gameplay frame is `MeshBasicMaterial`** — a shader with no normal in it at all: zero
specular, zero rim, zero diffuse falloff, zero shadow receive. **140 of 255 materials are Basic**,
the largest single unlit surface being `hazard:glow` at 11.68%. Separately, **63.44% of the frame is
a flat ground plane**, with **zero normalMaps project-wide** (and 4 roughnessMaps, all arena metal).
⚠️ But the reference argues for restraint: `bs_04`'s ground is *also* a smooth flat plane — what stops
it reading as paper is **prop density and a dark offset contact under every object**, not surface
detail. Treat a floor normal map as second-order, and only at the gentle end.

## 🔴 2. The scripted player cannot heal — **and "one line" is a DIFFERENT, WORSE fix**

**The old wording, kept because it is wrong and would be re-derived:** *"One line in
`tools/tmp/scripted_player.mjs`. Worth settled 17 → 14."*

The recorded end-state reproduces **exactly** (settled 17→14, tier spread 3.98→16.56 pp), from two
independent implementations — but **the literal one-line deletion does not produce it.** Deleting
`if (w.type === 'self') return;` alone gives **settled 13, tier spread 9.14 pp, Hamburger 53.9%**,
and **wastes 66.5% of every heal** (it presses at full HP). The heal must be gated on
`ai.ts:rankHeal`'s own three conditions — the rule already stated once in the codebase.

⚠️ **The SECOND bug in the same function is the bigger one, and it names the wrong characters.**
`bestWeapon` ranks by authored `damage`, which is per-*pellet*. Fixing only the ranking key
(→ `ai.ts:pressValue`), heal still excluded, moves **40 of 110 matchups — paired, exact, max |Δ|
46.9 pp** (`taco>donut` 9.4% → 56.3%). It mis-ranks **five** characters, not the two `rules.ts` and
`sim.test.mjs` name.

**Land both faults in one act**, keep both old behaviours reachable by flag (as `--nav-countdown-bug`
already is) so every pre-fix figure reproduces byte-identically, and extend `driver_guard.mjs` so
each new check also runs against the historical driver and **FAILS there**.

**Then Hamburger:** the heal is the whole character, priced at **~3.1 pp of strength per 1 HP**.
Measured ladder under the fully-fixed driver, 32 seeds: `healAmount` 25 (shipped) → strength 70.9%,
spread 15.94 pp · **18 → spread 8.05 pp, settled 14**. ⚠️ **And the binding constraint then moves off
Hamburger**: at 18 the tiers read Normal 53.0 · Rare 52.3 · Epic 53.0 · **Legendary 45.0** · Neon
49.5 · Cyber 48.7 — the spread is now set by **Legendary at the BOTTOM**, not Hamburger at the top.

## 🟠 3. Kitchen concealment — approved by Uri, unstarted

**§18, and five critics deep.** Uri: *"add bushes — but make it relevant to kitchen. For example
plates you can hide under."* Solid props cannot deliver it (the collision was carefully tuned);
**walk-through concealment adds screen area without adding collision.** Sim mechanic + AI awareness
+ props. **The largest single item waiting.**

⚠️ **Corrections from the architecture probe, before anyone chases the recorded number:**
- **Our 21.36% reproduces** (n=12 canonical stations, ablation-validated instrument). **The
  "35–45%" reference has NO instrument anywhere in this repo** — it is one critic's prose about four
  plates, and *three of the plates do not show it*. Do not tune to it.
- **The gap is GRAIN, not area.** Our 21.4% is delivered by **~2 objects per frame**; the reference
  delivers its share as dozens of small tufts in lane-aligned bands. And **every solid prop in the
  arena is one height — 2.415 m**, taller than a character.
- 🚨 **The sim contains ZERO randomness.** Concealment expressed as an accuracy *roll* destroys the
  determinism underwriting every balance number in the project. Region membership
  (`terrainSlowFactor` is a working template) is the safe shape.
- `stepAI` reads the player's true position at **three independent sites**, one a direct read — the
  exact shape of all five AI bugs found so far.

### ✅ STEP 0 IS DONE AND INERT — `1c140c0`

**Bit-identity PASS: 0 differing ticks in 3,283,873.** 110 matchups × 32 seeds = 3520 matches,
driver rev 4, stepped in **lockstep** against a git-extracted HEAD with one driver feeding both
sims, every field compared after every tick. No arena ships a region, so the game plays exactly as
before. `sim.test.mjs` 219 → **253**; new `tools/tmp/conceal_lab.mjs` (selftest 22).

One rule: **while you are concealed, nothing that tracks you updates.** All **three** `stepAI`
sites are routed through it — separation, facing, and the direct `steer(..., player.x, player.y)`
nav target; `state.player` now appears nowhere else in `stepAI`. Plus a **fourth outside `ai.ts`**:
homing projectiles re-aim every tick, and the observer there is the *projectile*, so it stays
symmetric between the sides — the property all five recorded `ai.ts` defects lacked.

### 🚨 THE FINDING THAT CONSTRAINS THE ART: `stepAI` has NO SEARCH

It walks to the last-seen point, stops, and sees **84 wu** from there. Measured both ways: at half
that radius it re-acquires; at **double, it never does** — final separation 363 wu, never sighted.

> **A large bush is a permanent AI-denial zone.** Concealment needs **many SMALL patches — no
> interior point more than ~84 wu from a plausible entry edge**, i.e. up to roughly **168 wu** across.

**This independently reproduces the probe's GRAIN finding from the opposite direction** — the
reference measurement said *dozens of small tufts, not a few big masses*; the AI says the same
number. Two derivations, one answer. **Big hero bushes are off the table** unless someone builds AI
search. → `docs/DECISIONS-FOR-URI.md` §29.

### Still to route (all out-of-set for the sim agent)
`src/arena/types.ts` (+`concealment?: ConcealBox[]`) · `src/ui/hud.ts:757` (radar blip) ·
`src/game/match.ts:1191` (enemy HP bar) · `tools/arena-dump.js:24` ·
`tools/tmp/arena_probe.mjs` extractor **and** `--verify` normaliser.

⚠️ **`arena_probe --occl` and `--verify` are BLIND to concealment** — the series comes from
`arena.cover` only and the normaliser compares `{w,h,c,msr,ps,es,cover,hz}`. Until they are fixed
the sim-side guard is the only thing that can see a region.

⚠️ **The endgame annulus is handled**: `concealmentKeepoutRadius = max(MIN_SAFE_RADIUS,
maxSafe × 0.25)` = **248.25 wu** on the shipped kitchen, measured on the region's **nearest** point
(a band whose centre is legal can still reach the hub), with §26(i) showing it FAIL on a hub box.

⚠️ **One number not to trust:** a first placement run says the player would be concealed **1.51%**
of ticks against the enemy's 23.90%. **That measures the HARNESS, not the feature** — the scripted
player has perfect information and no concept of concealment, by design. What the run *did*
establish: only **86 buildable 80×80 cells exist**, and traffic is **spatially segregated** — the
player is at **0.000%** in every one of the enemy's four busiest cells, so **one region set cannot
be high-traffic for both fighters.**

## 🟠 4. Cast value ladder — **the "regressions" are a RENDER commit, and the metric is wrong**

**The old wording, kept because both halves are misleading:** *"`weakBoundaryPct` fails 5 of 11 — and
pizza 22.0 → 41.0 and waterbottle 22.9 → 53.9 got worse while the gate was frozen. `dlBelow10` fails
lollipop and sushi. The dl table is 171 of 198 rows."*

- 🚨 **They are not character regressions.** A 9-tree paired bisect (same tool, `headserve --ref`)
  puts **both** collapses inside `ce49cd3..47feb9a`, whose only character-rendering commit is
  **`086ff5f` — the key-light move that added a near-head-on 2.2 front fill.** One `src/render/`
  commit, not two `src/characters/` ones.
- 🚨 **`weakBoundaryPct` measures the wrong quantity.** It gates on `dL = |p50(A) − p50(B)|` — the two
  parts' *whole-part medians* — while contacts are counted on a merged owner map. Proven wrong in
  **both** directions by construction; it disagrees with a contact-local step on **11 of 35 live
  pairs**, including the pair producing **32.7 of pizza's 41.0 points**. **Fix the metric before
  dispatching any character agent** (add `dLcontact` alongside `dL`; do not change `dL` — peers A/B
  against it). It is also a **cliff, not a band**.
- **burrito and sushi regressed too, and by more than pizza** — burrito head|torso 0.3605 → **0.0114**,
  sushi 0.2647 → **0.0403**. STATE.md named neither.
- **The fix is already built and it is INVISIBLE — LESSONS §1 for the nineteenth time.** `e6fed57`
  added a neck column plus a dark collar to 8 of 11 characters; at the shipped camera and facing it
  delivers **0 pixels** on burrito (565 px footprint), sushi (939 px) and soup (2199 px).
- **The 171 dl rows never existed on disk** — no `dl.rows.jsonl` anywhere, and all 17 `dl*.json` are
  **unstamped**. The untracked `tools/tmp/rigs_lg*.json` are not them.
- `valuescan --selftest` is **78**, not the 57 `docs/TOOLS.md` still names.
- ✅ Drift control clean: `0529aa8` and `b967242` moved the cast's value ladder by **0.000**.
- ✅ Harness polarity **confirmed correct** — `--mode chars`/`--mode dl` drive the real game URL, not
  the inverted `preview.html`. And the recorded `limbcheck_pitch` warning **overstates it**: the only
  executable differences are the pitch constant, a banner and `&pitch=` on the URL.

## 🟡 Known, not started

- **Seven weapon files carry a stale copy of the generic size curve**, each documenting it as matching
  `game/vfx.ts` — a claim the re-derivation invalidated. **Soup's three impact hooks read `ctx.damage`
  nowhere (1.00×).** Needs per-weapon floors first, or small weapons drop under the ~300 px floor.
- ~~**`limbcheck.mjs` and `limbcheck_pitch.mjs` are 93.3% identical**, while the latter's header claims
  byte-identity so *"any delta is PITCH"*. **Every 22°-vs-58° comparison rests on that claim.**~~
  ⚠️ **RESOLVED — the warning OVERSTATED the defect, and the old wording is struck above.** The two
  files were diffed directly: 25 differing lines, and the only **executable** differences are
  (a) `const PITCH = Number(get('--pitch', 22))`, (b) one extra `console.log` banner, and
  (c) `&pitch=${PITCH}` appended to the preview URL. **`limbcheck` IS `limbcheck_pitch --pitch 22`**,
  so "any delta is PITCH" holds. The 93.3% figure was a *line* count over a mostly-comment file —
  a reminder that a similarity percentage over prose says nothing about behaviour.
  **The real limitation stands untouched:** `limbcheck` measures the preview's **22°** while the
  match camera is **58°**; at 58° idle passes go 8/11 → 0/11, idle *ranking* survives (ρ 0.927) and
  **run ranking does not** (ρ 0.673).
- `perf_tier.mjs` should be `perf.mjs --query`; the clone-census budget is a holding action.
- Skins need a per-character material-variant system that does not exist.
- Character select is **n=1** — packets `select2-c2..c6` are built and waiting for five more critics.

---

# PART 3 — NEEDS URI

**→ `docs/DECISIONS-FOR-URI.md`.** Twelve were answered this session (§6, §12, §13, §15, §18, §22,
§24, §24b, §26 …). Still open: **§17** (music during matches, `hurt` level), **§19** (back out of a
live match), **§4** (`ROSTER_GATED`), **§14** (portrait), **§10** (two icons need a *subject* change),
and **§16/§20** (looks to eyeball).

And the standing one: **the two most valuable bug reports this project has ever had came from Uri
simply playing it.** A build is deployed for exactly that — see `CLAUDE.md`.
