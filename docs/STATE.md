# State — what is done, what is pending

**As of commit `6650bf6`.** Every commit verified with `tools/verify-head.mjs` before push.
**Deployed and live** at `https://uri-onceuponyou.github.io/food-arena/`.

> ⚠️ **The header used to read *"as of `b967242`, 125 commits into an unattended session… working
> tree clean."* Kept because the staleness is itself the lesson:** this line is the first thing a new
> session reads, and it went a full session out of date while every gate stayed green. Nothing checks
> it. If you land work, move it.

---

## 📌 SESSION OF 2026-08-10/11 — READ THIS BEFORE THE REST OF THIS FILE

Most of what follows is still true about the SCORE. It is out of date about the CODE. The short
version, with the section that supersedes each:

**Landed**
- 🔴 **The sim is no longer hard-1v1.** `cdcdd65` — `fighters: Fighter[]`, slot identity, an N×N
  perception matrix, `damagedMask`, `hitRadius` on the fighter. `state.player`/`state.enemy` remain
  real properties holding the same objects, so **every renderer/HUD/audio/tool consumer needed zero
  changes.** Proved: **0 differing ticks in 26,388,976** over per-tick state AND 7,039,194 events in
  order. Seat cap was pinned at 2; raising it is in flight.
- **All eleven characters** got the arms-vs-legs pass (`25665f9`, `76369eb`, `75daec3`): they were
  not merely similar, they were **the same call** — hamburger's forearm and shin shared one `case`
  block, and three archetypes made **arms fatter than legs**.
- Fighters cast a contact shadow in grease and water (`e47ba7c`); the puddle was depth-rejecting it.
- Design-system adoption on home + character select (`f5a6229`), `theme.ts`'s shared gaps (`3481d71`).
- Sushi's Big Catch 160 → 280 wu/s (`0558bc5`) — roster range 12.5 → 8.8 pp, **minimum RAISED**.

**Falsified — do not act on these, they are recorded here because they read as settled**
- 🚨 **`weakBoundaryPct` produced a FALSE FAIL and a FALSE PASS in one run** (egg 61.8% with a
  contact-local count of 0.0; hamburger PASSES at 4.3% with a contact count of 9.0). It is not
  "noisy but conservative". **Steer on `minDL` (floor 0.0039) and the contact-local variant.**
  `dlBelow10` is **0 of 11** — that class is closed on merit.
- 🚨 **Every icon round ever judged was judged at the wrong size**, one with inverted polarity — and
  the protocol (whether the judge may zoom) is worth **29 points**, more than any icon. **Never quote
  an icon verdict without its protocol.** `DECISIONS §46` was WITHDRAWN on this.
- **"The AI can't play Legendary" was wrong** — a homing projectile was losing a race, because
  `stepProjectiles` retires on cumulative path length and the human flees at 120 while the AI flees
  at 70. Every homing weapon is worth ~2× in a human's hands.
- **More cover does NOT create contact.** First contact is monotonic in prop count.
- **A ×4 arena costs +12.77 s to first contact at N=2** and must ship WITH the roster change
  (`DECISIONS §48`). ✅ **This one held — see below, and it is the only half of §48 that did.**

---

## 📌 LANDED SINCE, 2026-08-11 — the map doubled and the ring learned to count

- 🔴 **The ×4 arena SHIPPED** (`6631446`). `ARENA_W/H` 1400×1000 → **2800×2000**; `shared.ts` moved by
  two constants and everything downstream derives. The acceptance test whose own header said *"it goes
  away when §48's arena lands, not before"* reports **37/37**, and the N=6 census at 9.0 s has all six
  seats at **full health** — on the old map slot 0 was dead. Six spawns in six separate admissible
  regions, **892.0 wu minimum pairwise separation** (was 75.2), 111 props at *lower* density than
  before, `ap_reach` clean at every body width 18–26.
- **The endgame ring scales with fighter count** (`4bb64e4`). `minSafeRadiusFor(N) = max(MIN_SAFE_RADIUS,
  ENDGAME_STANDOFF / sin(π/N) − POT.dangerRadius)` — **140** at N≤4, **187.42** at N=5, **237.00** at
  N=6. N=2 proved a no-op over **45,959,702 ticks / 12,503,511 in-order events / 0 divergent**.
- **The eight palest weapons had a halo the colour of the ground** (`50c5272`). `PROJECTILE_HALO_L` was
  a lightness floor *with no ceiling*, so weapons already at 0.83–1.00 got a halo of their own pale
  colour over cream cloth. A threshold at 0.78 (sitting in a 0.104-wide empty band) sends those eight
  dark instead: **1.76–4.63× on their worst background**, fifteen others unchanged to four decimals.

### 🚨 §48's fixture was NEAR-EXACT on the one thing it measured and wrong about everything it inferred

This is the finding worth carrying, and it is more useful than "the prediction was wrong":

| | §48 predicted | measured |
|---|---|---|
| first contact | **+12.77 s** | **+12.75 s** (5.67 → 18.42) |
| win rate | −13.4 pp | **−2.6 pp** — inside the ~9 pp floor |
| chase policy | collapses to 1.7% | **41.5%** |
| never-contacted | 30/880 | **0/880, both arms** |
| draw calls | *fall* | **rise** 896 → 1,012 (+12.9%) |

**The one number §48 actually simulated — time to first contact — came in within 0.02 s.** Every other
row is a *consequence* it reasoned to from that number, and every one of those is wrong, three of them
in the opposite direction. The draw-call miss has a named cause (it read the **stretch** arm; what
shipped is the **held-density** one, so more props end up in frame, not fewer). The behavioural rows do
not: fighters that take 12.75 s longer to meet simply did not stop meeting.

⚠️ **`bd068d0`'s commit message garbles this** — it says the fixture was *"right about the mechanism and
wrong about its size by 5×"*, which conflates the first-contact row (near-exact) with the win-rate row
(5.15× too large). Amend is forbidden, so the correction lives here: **the split is measured-vs-inferred,
not mechanism-vs-size.**

### 🔴 And the cost, being paid right now

Six gates went red **on HEAD** the moment the map committed — `arena-scan`, `ap_reach`, `sp_place`,
`sp_gate`, `conceal_lab`, `level_lab` — every one carrying a 1400×1000 literal, plus `sentinel` as a
seventh. **All closed** (`72d50a4`, `336a85b`, `f27973f`, `9c10722`): `gatecount` on a clean worktree
went **12 faults → 2**, and neither survivor belongs to that work.

⚠️ **TWO THINGS I WROTE IN THIS SECTION WERE WRONG. Both are corrected below and the wrong wording is
kept, because each was believed on the strength of a method rather than a measurement.**

- 🚨 **I wrote *"`level_lab` is a finding, not a fixture — the level-1 player now wins 100.0%, so it is
  pinned at its ceiling and can no longer tell level 1 from level 15."* FALSE.** Measured: **40 of 110
  cells are unsaturated and every one of them rises**, max **93.8 pp**; the full grid moves
  **55.00% → 99.32%**. **One hand-picked cell had saturated** and I generalised from it to the
  instrument. It now runs a declared 11-cell cyclic panel (47.7% → 98.9%, **+51.1 pp against 5.3 pp of
  standard error**) *plus a row that asserts the baseline has headroom before asserting it moves* —
  which is the guard my framing would have skipped.
- 🚨 **I recommended `git archive HEAD` as the clean-tree method, twice, to several agents. It is the
  WRONG TREE for this battery.** Five of these gates shell out to `git` and die without a `.git`
  directory — **it reported 8 faults where a real worktree reports 2, and it reports a wrong CAUSE, not
  merely a wrong number.** Use **`git worktree add --detach`** with `node_modules` **and** `reference`
  symlinked in. (My own first run of it was worse still: no `node_modules` at all, so seven gates died
  on a missing import and looked exactly like seven broken gates.)

`arena-scan` was the big one and the reason is worth keeping: its 18 stations were all 1× coordinates,
so quadrant coverage was **18/2/2/0 with SE empty**. ⚠️ **And the placement guard that was supposed to
catch this was a PARTIAL catch — it flagged 6 of 18. Acting on its list would have moved six stations
and still shipped an empty quadrant.**

Also live: **triangles went 480,094 → 1,316,686 (×2.74)** and meshes ×2.34 — onto a phone Uri already
describes as unplayable (§33). Nothing in this project has ever measured a mobile GPU.
**↑ THAT SENTENCE IS NOW OUT OF DATE IN BOTH HALVES — see the next section.**

---

## 📌 THE REST OF 2026-08-11 — the phone got fixed, the game got fair, and SEVEN GUARDS TURNED OUT VACUOUS

Everything above still stands; this is what happened after it. **Full detail per item in
`docs/DECISIONS-FOR-URI.md` §56–§69** — this is the index, not the record.

### Shipped, and Uri can play all of it now

| | |
|---|---|
| **Phone frame** | draw calls **928 → 423** (−54.4%), main thread **−47.9%** against a ±0.71 ms floor. The 1,908 static props are one mesh per material. The ×4 map now costs **less** main thread than the build Uri played. `5aa4655` |
| **Landscape controls** | weapon tray hides **7.92% → 0.00%** of the guaranteed-visible arena; the clock **13.12% → 0.49%**; all controls 22.6% → 4.3% at 844×390. `bd39464` `b2f2cb1` `f1f2a40` `845716a` |
| **Seat fairness** | spawn advantage **2.680 → 0.342 places** of 6; all six seats deal damage in **600/600** (was 74.5%). `d1d9f9e` |
| **Roster** | range **27.8 → 9.8 pp**, tier spread 16.2 → 6.1, **no mechanic touched**. `33318a1` |
| **Ranged reach** | **23 of 23 → 2 of 23** weapons cannot connect at their own press gate. `af35362` `a9da836` |
| **Sudden death** | ships; `resolveTimeout` fires **0/880**. `f87d407` |
| **Payouts** | the 3–6 seat curve exists *and now reaches the game* — a 3rd-of-6 finish was paid as a 1v1 loss. `721ce3c` `a588066` `bb00d66` |
| **Multiplayer** | wire codec + delta compression **7.1×**, `src/game/` untouched. `915bbaf` `a588066` |
| **Fog** | no longer renders as nothing at radius 0, and now covers the corners (**3.25% of standable ground was outside it**). `779dc62` `2d3e9bd` |
| **Gates** | **0 faults**, 69 verified / 57 skipped, up from 12 faults. |

### 🚨 THE ONE LESSON THIS SESSION ACTUALLY TAUGHT

**Seven independent controls could not distinguish their own two arms, and three of those passed by
having nothing left to check.** Not one was caught by another check — every one was found by an agent
re-deriving something it had been told was already true.

The mechanisms, because they are all different and all invisible:

- a fixture pointing at **a herb crate**, and an "axis mirror" mirroring about **the old centre** — both
  green
- a known-bad placed **where the bug could not express itself**, so both arms passed
- `[].every()` returning `true` after a fix **emptied the set** the guard filtered on — **three times, in
  three different files**
- a differ blinded to a field that **had nothing to drop yet**; a wrong-base demo **inside the countdown**,
  where nothing moves; a sentinel written onto a field **already holding it**
- a call-site census counting the **function declaration** as a call site, printing `ok` next to an
  evidence line describing the failure
- a suite reporting **227 passed, unchanged**, straight through a feature rewrite it could not see
- **two arms of one instrument FALSE BY CONSTRUCTION** — comparing a *rendered frame's luma* against a
  *material's colour*, where a lit surface reads brighter, so the threshold cut through one continuous
  population with rows landing either side by **0.001**

> **A passing test is not evidence the thing it points at is right.** `--selftest` validates a tool's
> logic, never where the tool is *pointed*: `valuescan` read **105/105** while **14 of its 18 stations**
> were in the wrong quadrant and eleven were **inside solid props**.

### 🚨 And the one-sentence reason the map change hid for so long

> **The 1× playfield is exactly the NW quadrant of the ×4 one, so every stale coordinate stayed legal.**

No legality check could ever have found that class. Eleven were found one at a time by accident; a
systematic sweep then found **12 more with a 0.5% false-positive rate**, plus 63 enumerated and frozen.
`al_guard.mjs` now catches the class. ⚠️ **Would another resize be safe? "Safer, not safe"** — ~30 files
now hold a hardcoded **2800/1985**, so today's correct literals are the next generation's stale ones.

### Corrections to things written above and in DECISIONS, kept rather than deleted

- **`level_lab` was NOT at an instrument ceiling** (40 of 110 cells unsaturated, grid 55.00 → 99.32%)
- **`hl_sweep`'s corpus was never emptied** — the *default split stopped partitioning it*, because
  `vfx.ts` splits on the **weapon's** colour and the tool splits on the **halo material's**
- **`git archive HEAD` is the wrong clean tree** — use `git worktree add --detach`
- **"the rank comes from the sim's final state"** — it cannot; every loser ends `hp:0, deaths:1`
  identically, so a final-state resolver degenerates to slot order. The order is in the **death event
  stream**
- **the `h49_chips` row never said `+156`** — I passed on a stale reading

### 🔴 Live for the next session

- **Six-player has NO entry point** — reachable only via `?fighters=`. Three design questions are Uri's:
  where the affordance lives, how the other five are chosen, what level five bots are.
- **Sudden death now fires in 90.5% of matches** (was 66.0%) because the seat fix made all six engage —
  so `DECISIONS §58`'s parked trigger question is now about the **normal** ending.
- The result card's loser list is still slot-ordered, and shows no trophies/coins/XP (in flight).
- `x4_layout.mjs:SPAWN_NORTH` is a **stale generator that would silently revert the seat fix** (in flight,
  guarded meanwhile).

**Open for Uri:** nothing is blocking. He cleared the entire backlog on 2026-08-11 (`DECISIONS §54`)
and answered §49 and §53; §43 and §46 are closed — **do not re-ask any of them.** What he owes is
device-side only: **his phone model, its iOS version, and a landscape Safari screenshot.**


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

### ✅ THE FLOOR WAS PROBED, AND THE CRITICS' MECHANISM IS FALSIFIED — `ac08dbf`

**Nothing was changed, deliberately.** 8 fresh action frames on a frozen snapshot against the 6
`gameplay_topdown` plates, ground-only masks computed identically both sides and audited by eye.

| metric | reference band | ours | verdict |
|---|---|---|---|
| `mf` 3–12 px | 0.00930–0.02414 | 0.01535–0.01918 | **1.07× — the reference MEDIAN** |
| `lf` 12–48 px | 0.01095–0.03989 | 0.01749–0.01957 | **1.01× — the reference MEDIAN** |
| `hf` 1–3 px | 0.00336–0.01005 | 0.01283–0.01572 | 1.92×, against a 2.08× acuity handicap ⇒ **parity** |
| **`oriAll`** (global lattice) | 0.229–0.351 | **0.421–0.547** | **1.55× — NON-OVERLAPPING** |

🚨 **"No surface detail" is FALSE.** `mf`/`lf` describe 3–48 px features, survive the plates' upscale,
and land on the reference **median**. **A normalMap, aoMap, grain or mottle would move a quantity
that is already where the reference is** — §6b applied *before* the round was spent, which is the
whole point of writing §6b down. These govern **37–46% of the whole frame** (stated, as §6b requires).

**The one real out-of-band thing is that our ground is a LATTICE.** Our tile field repeats at
**100–107 × 80–86 px, autocorrelation 0.55–0.82**, while **five of six plates have NO periodic ground
repeat at all** above the instrument's own noise floor. `bs_01`'s paver ground — the plate `floor.ts`
is keyed to — is **irregular polygons whose joints run in many directions at near-invisible
contrast**, and scores the *lowest* `oriAll` of the six. Side by side:
`shots/floor2/ours_vs_bs01_ground.png`.

🚨 **AND THE WHOLE-FRAME GAP IS NOT THE GROUND AT ALL.** `featShare` reference **24.6–34.9%** against
ours **15.3–20.7%**, non-overlapping — and `featShare` counts **object-scale contrast, not texture**.
**The frame is short of THINGS, not short of surface.** That redirects the arena effort at props and
cover density (items 2 and 3 below), not at the floor.

⚠️ **Not changed, and here is why:** `oriAll` is real and out of band but **has no established link
to critic score**, and rewriting the largest surface in the game steered by an unlinked metric is
exactly the §6b failure. Specced for whoever takes it: break the two-direction lattice (irregular or
hex pavers, joints at more than two orientations) targeting `oriAll` ≤ 0.351; and scatter small
ground chips arena-wide — `bs_01`'s ground detail is **objects**, ~12 px against an 80–106 px stone
(11–15% of a stone width), each with its own shading. That is materially different from the deleted
"polka dots" (35% of a tile, flat tinted discs). Before-control recorded: `floorprobe` **5/5**,
R mean 0.388, worst `pantry_ne` R=0.672.

⚠️ **`oriAll` has NO measured resolution floor** — frame-to-frame spread ~0.08 (ours) and ~0.12
(plates) against a 0.13 gap. **Established in direction, not in magnitude.**

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

### ✅ §29c LANDED — attacking BREAKS the plate and reveals you (`f0e7aed`)

Bit-identity held **exactly**: **0 differing ticks in 3,283,873** (110 matchups × 32 seeds), with
the three-part claim §15c requires — baseline fields hold, none disappears, the three additions
declared (`state.brokenConcealment`, `player.revealedUntil`, `enemy.revealedUntil`).

**Two halves, deliberately separate because they fail independently:**
- **Destruction is about the OBJECT.** `breakConcealment` removes **every** standing region
  containing the attacker's centre, not the first — overlapping plates would otherwise spend one and
  reveal nothing. It lives on `MatchState.brokenConcealment` and **never** mutates
  `arena.concealment`: **one `ArenaDefinition` serves every match a process runs**, so a plate broken
  on the arena would stay broken for the session.
- **Reveal is about the FIGHTER.** `revealedUntil = now + CONCEAL_ATTACK_REVEAL_MS`, written at the
  press, above every outcome test. Destruction alone is not enough and that is measurable: patches
  cap at ~168 wu and the layout wants dozens, so an attacker whose plate shattered is one step from
  the next one.
- A **`self` press (the heal) does neither** — Uri's word was *attacking*.

**The duration is DERIVED, not invented:** `CONCEAL_ATTACK_REVEAL_MS = FLIGHT_MS.normal` (500 ms) —
how long a shot takes to arrive. Deliberately **not** the firing weapon's own cooldown, which would
make a fast weapon a strictly safer ambush. The test asserts the derivation, never the literal.

**`vfx.ts` needed no change, and the reasoning is now in the file:** a projectile exists only because
someone pressed attack, and `attemptAttack` breaks their cover three lines before the spawn — so
**hiding projectiles would now be the bug**. One case is named rather than left to be found:
`spawnImpactBurst` on `hit-landed` can fire into a plate and hit a fighter its shooter cannot see
(concealment is not intangibility). It leaks only to the player who already landed the shot.

🚨 **The mutant that escaped is the lesson.** Of 14 mutants, *"breakConcealment breaks only the FIRST
region"* passed **287/287** — because **the AI fires too**, and the enemy's own shot broke the second
plate. **Asking about a fighter is never a neutral way to ask about a plate.** Fixed with a parked
enemy, an `ownerRole` assertion and a `NEVER_ATTACKED` probe; two other checks had the same disease.

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
