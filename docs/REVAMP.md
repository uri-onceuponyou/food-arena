# REVAMP — the graphics campaign and the bug sweep (started 2026-10-15)

Uri, 2026-10-15: *"Review the game, plan a graphics revamp, i want to take it a few levels up. in
addition check for any gameplay bugs and fix them. Plan extensively, dispatch agents with
improvement loops until score it good enough."* — and, an hour in: *"You are running to much in
parallel.. it will consume token limit to fast."*

This file is the campaign's plan, its scoreboard and its rules. It was written from a review run
on `1090046` (six visual audits, a measured whole-frame gap analysis, seven bug hunts at six seats,
two independent verifiers per finding, and today's blind-critic baseline). ⚠️ **Every number is a
measurement on that tree on that day — re-derive before acting on one** (`CLAUDE.md`, top).

> **Agents: read this, then `docs/AGENT-BRIEF.md`.** Your brief names your work package (§5) and
> its owned file set. Contradicting this file is part of the job when the tree disagrees with it.

---

## 0. One screen

| | |
|---|---|
| **the score** | blind critic, canonical rubric v1, one fresh critic per sheet (§1) |
| **r0, today** | arena **4.60** · arena6 **4.97** · cast **4.51** · home **5.37** · select **5.83** — reference side 7.91–8.43 |
| **target** | every element **≥ 7.0** ("shipped"); stop early on two flat waves (§6) |
| **the diagnosis in one line** | the eye goes to a loud, busy, lifted floor and to flat-lit furniture, while the fighters are pale, un-inked, un-ringed and unlabelled (§2) |
| **bugs** | **39 confirmed** by two verifiers each (≈27 unique after dedup) · 17 unverified · 20 design questions → `DECISIONS §91` |
| **how work runs** | ≤ **3 agents at once**, one owner per file set, each on its own branch + worktree, a merge + gates + scoring round between waves (§4, §7) |

---

## 1. The score — what it is and how to re-run it

**Instrument.** `tools/tmp/rv_capture.mjs` re-captures five canonical frames on ANY served tree;
`tools/tmp/rv_packets.mjs` turns them into blind A/B sheets (our frame vs a different reference
plate per sheet, slots balanced, key never in a path). A critic sees ONE sheet with the canonical
rubric (`tools/review.rubric.txt`, sha `611d8985…`, unchanged since q1) and returns two scores.

| element | what it is | reference category |
|---|---|---|
| `arena` | 1v1 action frame, match camera (58°), 1600×900 | top-down gameplay |
| `arena6` | six-seat action frame, match camera | top-down gameplay |
| `cast` | the crop around the fighters of `arena` | top-down cast |
| `home` | home screen, populated profile (lobby camera, 20°) | home/lobby menus |
| `select` | character select, populated profile | select menus |

**r0 — 2026-10-15, HEAD `1090046`, critics = the session model at effort `high`**

| element | ours | sd | ref | n |
|---|---|---|---|---|
| arena | **4.60** | 0.25 | 8.35 | 8 |
| arena6 | **4.97** | 0.29 | 8.43 | 8 |
| cast | **4.51** | 0.40 | 7.91 | 8 |
| home | **5.37** | 0.42 | 8.27 | 6 |
| select | **5.83** | 0.43 | 8.33 | 6 |
| ctl_high (a shipped plate in OUR slot) | 8.10 | 0.17 | 8.40 | 3 |
| ctl_low (our arena frame, degraded) | 3.20 | — | 8.60 | 1 |

The instrument **validates both ways** today: shipped work in our slot reads 8.1, a degraded frame
reads below the real one. **Floor:** today's per-critic sd is 0.25–0.43, so at k=6 the standard
error of a mean is ~0.1–0.18 and a **difference under ~0.5 is not a result** (`CLAUDE.md` rule 10).
⚠️ That floor is tighter than the published ±1.4 because σ was measured lower today — it is a
property of THIS critic configuration; **do not compare these scores to any pre-2026-10-15 score**
(different model, `HANDOVER` item 1).

**Re-run on a tree** (from the main repo dir; both symlinks load-bearing):

```bash
SHA=<commit>; WT=/private/tmp/fa-rv-$SHA
git worktree add --detach "$WT" "$SHA"
ln -s "$PWD/node_modules" "$WT/node_modules"; ln -s "$PWD/reference" "$WT/reference"
node tools/tmp/sx_snap.mjs --root "$WT" -- \
  node tools/tmp/rv_capture.mjs --url '{URL}' --tree "$WT" --out shots/rv/<round>/cap
node tools/tmp/rv_packets.mjs --cap shots/rv/<round>/cap --round shots/rv/<round>
node tools/tmp/rv_packets.mjs --verify shots/rv/<round>
```

Capture self-noise on one tree: **5 of 7 frames byte-identical; arena/cast differ in 6 px by 1/255.**
Selftests: `rv_capture --selftest` 31/31, `rv_packets --selftest` 14/14.

**What the critics said about OUR frames (r0, unprompted, every one):**
- **arena / arena6 (16 of 16):** the fighters are *tiny, pale, low-contrast blobs* lost on a *big flat
  pink floor* covered in *confetti-like specks*; the props are *plain flat-coloured blocks*.
- **cast (8 of 8):** the fighters are *buried under red/pink hit splashes the same colour as the floor*.
- **home (6 of 6):** the hero is *crude* — *stick-thin limbs, blob hands, flat plastic*, small on a bare
  pedestal against a flat wall.
- **select (4 of 6):** the right column is **clipped** — the Upgrade price and the second ability card
  are cut off. *A layout bug, not taste.* Plus a flat backdrop and a small hero.

⚠️ A naming tally is an attention signal, not a defect census (`LESSONS §3`). The measurements in
§2 are what the plan stands on; the tally only says where the critics' eyes went.

---

## 2. Diagnosis — measured, ranked by expected critic impact

Every number below is ours vs the six top-down reference plates, same code, measured on frozen
frames with exact role masks (`tools/tmp/gx_gap_*`). Reference plates described by ROLE only.

### 2.1 🔴 The fighters are not where the eye goes — and the reference marks them, it does not light them

| | ours | reference |
|---|---|---|
| best fighter cell, 32×18 thumbnail salience rank | 20–100 (median **39**) | 3–41 (median **11.5**) |
| fighter mass, share of frame | 0.16–1.09% | 1.1–2.1% strict / 2.1–7.4% loose, **+0.9–3.0% of seat ring** |
| fighter median luma | **0.71–0.82** (pastel) | 0.41–0.50 |
| fighter pixels above luma 0.8 | 20–56% | 4–8% |
| dark-contour share on the fighter | **0.009** | ~0.07 (near-black, ~3–5 px at 900-px-equivalent) |
| fighter-vs-surround ΔL | **+0.35** | −0.02 — *the reference does NOT separate by value* |
| seat ring under each fighter | **none exists in source** | every fighter |
| over-head plate | 106×28 px dark pill, no name, no number (0.21% of frame) | ~165×110 px, team-coloured name + big stroked HP number + thick bar (~1.2%) |

No lighting variant moved fighter salience (D4's best fighter cell stayed at rank 144–184 in every
probe): **lighting and fighter readability are separate problems.** The reference's fighter "unit"
is ring + contour + label + saturated mid-value body.

⚠️ **This contradicts two standing claims, both measured:** `CLAUDE.md`'s *"almost no ink outline"*
does not hold for the cast at gameplay scale, and `toon.ts`'s note that the reference separates
characters *"through value contrast, rim light and the ground ring"* — the ring was never built and
value is the one axis the reference does not use. → `DECISIONS §91`.

### 2.2 🔴 The world is lit flat from the camera, and its shadows are the loudest shapes in it

- **Front fill** (`lighting.ts` `front`, DirectionalLight 2.2 at 8° on the camera axis) lifts prop
  front faces to the brightness of their tops: same-mesh front/top **0.84–0.93** (fill off: **0.42**);
  reference blocks **0.35–0.38**. Props read as flat primitives.
- **Additive Fresnel rim** on flat architectural faces is a whole-face pale wash, not an edge
  (counter face S 0.654 → 0.457). 74 prop materials carry it.
- **Cast shadows are 3–8× deeper** than the reference (−57% under a fighter, −31…−49% under a prop vs
  −3…−10%), shifted **24° toward violet** on the floor (reference 1–3°). **88–99% of the ground cells
  in our top-20 salience are cast shadow**; the reference has zero ground cells there.
- The fighter's own shadow is a shapeless combed wedge (17 PCF taps over ~6 texels).

### 2.3 🔴 The floor is lifted, loud and never rests — 55–71% of the frame

- Ground median luma **0.46–0.50** vs reference median **0.39**; OKLab C above every reference ground.
- Lit-ground windows are dead-flat in **10–15.5%** of pixels vs **40–93%**; micro-gradient
  0.0076–0.0084 vs reference median 0.0025 — re-confirms the closed road (`HANDOVER`): *our ground is
  the busy end of the range.*
- The busyness has named sources: embossed multi-band Voronoi seams + a 1-px dotted hairline (an
  aliasing generator), 520 tile flecks, translucent stain decals that read as render garbage, faceted
  chip "confetti" on the pot mat (1.3–1.6% of hub fight frames), hard-edged blue pads.

### 2.4 🟠 The level is a scatter, not a composition

~111 cover boxes of 50–230 wu in point-mirrored pairs at near-uniform spacing: **no walls, no lanes,
no masses, one landmark** (the pot, which reads as a plastic bucket). A match frame shows ~4% of the
map → 2–4 isolated islands on open pink. The perimeter is a black void with grey slabs.
Concealment patches are **see-through gold cages over cream cloth — the brightest masses on screen.**
⚠️ The density null (`fd76ef0`, 13% → 24.9% footprint, +0.00) forbids fixing this by adding today's
props; it must come with a production prop kit (§5, `A2`).

### 2.5 🟠 VFX: the loudest object in the canonical frame is a floor hazard

Donut's Sticky Trail covers 4.8–12.5% of the frame but owns **44–98% (median 71.6%)** of its top-2%
most chromatic pixels, drawn **brighter** than the floor (OKLab L 0.70 vs 0.61–0.64) — violating
`vfx.ts`'s own rule 3 (persistent marks are spent DARK). That is the "red/pink splash" 8 of 8 cast
critics named. Also: projectiles read as coins/marbles with no motion language; melee swings are flat
pie fans; supers are huge low-energy discs; status turns fighters into pale ghosts; ~12 code paths
draw concentric rings with a dozen meanings; pools starve at six seats.

### 2.6 🟠 Characters are toy robots designed for a camera the game does not use

- **Identity collapses with facing at 58°**: the donut's hole is visible at **0/8** facings; face
  visible at only 4/8 facings for donut, pizza, sushi. Probe: an identity plane tilted back ≥32° faces
  a 58° camera from every azimuth (donut at 35°: 8/8, hole visible).
- 8 of 11 characters' dominant hue sits in one 60° arc (0–60°); the canonical player's glaze shares
  the floor's hue.
- Visible size varies 3–10× at one hit radius (burrito 32% of soup's silhouette).
- Ball joints, bead-stack limbs, sphere hands, puck boots, spider stance — *"stick limbs, blob hands"*
  is what every home critic wrote.

### 2.7 🟡 Menus: busier, lighter and far less vivid than the reference menus

Local contrast 0.18/0.22 vs 0.06–0.12; select median luma 0.58 vs 0.15–0.40; vivid share (OKLab
C > 0.15) **12.6% / 8.4%** vs 46.8% / 32–69% on the primary reference. The home hero's own
figure/ground matches the plate — **the gap is the backdrop, the chrome and the hero's craft.**
HUD chrome is single-tone "web UI": one geometric face for every job, flat SVG glyphs.

### 2.8 🧱 The hard constraint: the phone has no draw-call headroom at six seats

A six-seat brawl on the phone tier issues **1,567–1,571 draws** and 361 program binds per frame
(431 at 1v1); each fighter costs **~143 draws** (76–177 part meshes, 22–78 of them per-part ink
hulls) with 36–49 materials; the frame is CPU-bound ~3:1. **Any richer look must be bought back with
character draw reduction first** — the post-process contour (§5 `R1`) deletes 336 hull draws at six
seats on its own.

### 2.9 Claims that did NOT check out (results, not footnotes)

- `HANDOVER`'s *one measured lead* — "one hue owns 88% of the cast frame, R > 0.995" — **does not
  reproduce**: best 35° window 0.37–0.78 (n=11) vs 0.39–0.72 on the reference.
- *"Our subject is framed too small — falsified"* holds for **height** only; per-fighter **area** is
  ~3× smaller and mass/marking/salience are all outside the reference range.
- `CLAUDE.md` *"almost no ink outline"* — contradicted at gameplay scale (§2.1).
- `vfx.ts` rule 3 *"now fixed … checkable"* — `trail_probe` checks one station; the floor varies
  0.487–0.554 by location and the slot-0 trail fails at the canonical one.
- `shared.ts`'s `ARENA_VALUE_GAMMA` note ("the arena sat below all six plates") is historical; today
  the ground sits **above** the reference median.
- `lighting.ts` prices the front fill at "~15% of prop internal contrast"; the measured structural
  cost is ~2.2× the lighting-only ratio.
- The pre-captured "1v1 action frames" are one scene over ~4 s (n≈1), atypical on value.
- The capture route shows the HUD **crippled**: generic portrait marks on every plate and damage
  numbers invisible at the shutter (UI audit) — a scoring-pipeline defect as well as a game one.

---

## 3. What NOT to do — measured and refuted here

- **Do not desaturate to fix anything** (falsified four times). Every value move in this plan is a
  *value* move that keeps or raises saturation (palette re-key, ground re-key per role).
- **No filmic tonemapping.** Brawl Stars is **not cel-shaded** (smooth, saturated, vinyl).
- **Do not add today's props to fill space** — the density null (`fd76ef0`).
- **Do not "add surface detail" to the ground** — it is already the busiest in the range.
- **Do not chase a metric that governs a minority of the frame** (`LESSONS §6b`): the floor is
  55–71% of the scored frames and was the carve-out last time.
- **Do not judge at isolation framing** — judge at shipped framing, diagnose at 4× (`LESSONS §6`, §22).
- **Do not trust N=2** for anything with more than one opponent (`LESSONS §28`).

---

## 4. How the work runs (and what it costs)

**Measured cost of the review** (from the agents' own transcripts): a critic ≈ **0.4k output +
0.15M cached input**; a verifier ≈ 17k output + 40M cache reads; an audit ≈ 48k output + 217M
cache reads. **The cost driver is long-running agents re-reading a growing context every turn, not
the number of critics.** Hence:

1. **≤ 3 agents in flight at any time** (Uri's standing rule, re-stated 2026-10-15).
2. **Small, focused agents in sequence** beat one long agent: context resets are cheaper than a
   400-turn session. A package that needs more than ~10 changes is two packages.
3. **No per-finding verifier fan-outs.** The 39 bugs are already double-verified; for the 17
   unverified ones, the fixer's **failing-test-first** step IS the verification (a test that will not
   go red on HEAD means the bug is not real — report it, do not fix it).
4. **Critic rounds are cheap** and run in parallel; build agents never do.
5. Sub-agents run at effort `high` (builders) / `high` (critics, pinned for comparability).

**Every build agent:** own branch + own worktree (`/private/tmp/fa-rv-wp-<key>`, both symlinks),
created by the orchestrator from `main` at wave start; measures on its own worktree only
(`sx_snap --root`); commits there with pathspec form; never touches a file outside its set (the
release valve in `CLAUDE.md` rule 9 still applies). The orchestrator merges, runs the gates on a
clean worktree of the merge, pushes, then runs the scoring round.

---

## 5. Work packages

Owned file sets are **disjoint within a wave**. `→` marks what a package must NOT touch even though
it is adjacent.

### Graphics

| key | goal | owned files | acceptance (mechanical) | moves |
|---|---|---|---|---|
| **R1** · re-light for form + fighter contour | split the rig (character fill moves INTO the character material; world front fill ~0.8 or off); normal-based form ramp on structure (\|n.y\|<0.35 faces ×0.55–0.65); key shadow intensity ~0.7, shadows kept in the ground's hue; rim off on flat architectural materials; **screen-space near-black silhouette contour** on fighters (~2.5–3.5 px at 900 px; alpha tag + one convolution pass) replacing per-part character hulls **in the match only**; a soft toy-gloss lobe on the cast | `src/render/{lighting,toon,stage,quality}.ts` → not `camera.ts` | same-mesh front/top 0.40–0.60 (`gx_gap_form`); shadow ratio 0.67–0.74, hue shift ≤5°; ground cells in top-20 salience ≤3; fighter dark-contour share ≥0.06; **six-seat phone draws DOWN** (hulls removed); lobby not worse at 20°; `aspect`, `menu_accept` green | arena, arena6, cast |
| **A1** · calm stage | remove stain/grease/wet decals; confetti chips → flat ground-hued crumb decals at ≤⅓ count, none on the pot mat; flecks ÷3; Voronoi seam → one soft dark band (no bevel ring, no hairline, no gap); pot mat removed or feathered into a darker cool-neutral second floor; concealment cages → solid canopies in one mid-value saturated accent family, slats non-casting; ⚠️ **no global value re-key until R1 has merged** — re-key per role in A2 | `src/arena/**` | lit-ground windows dead-flat ≥40%; micro-gradient ≤0.005; litter <0.5% of hub frames; `arena-scan --gate` 11/11; `al_guard`; concealment still conceals (AI constraint ≤168 wu, `DECISIONS §29`) | arena, arena6, cast |
| **F1** · the fighter unit | a **seat ring** under every fighter (unlit decal, local = reserved bright hue, opponents = enemy hue; ~1.5× footprint; rim + soft fill; match framing only; one draw each) — status segments live on it later; **brawler nameplates** (team-coloured name, big stroked HP number over a thick two-tone bar, ~6× today's plate); top HUD scrim removed/compacted; capture-visible portraits + damage numbers (UI-01/02); the HUD halves of bugs F1/F4/F7/U1/ML-8 | new `src/render/seatRings.ts`, `src/render/stage.ts` (hook only, after R1 merged), `src/ui/hud.ts` | best fighter salience rank ≤15; fighter+ring mass ≥2.5%; `hud_fit`, `hud_accept`, `lu_occlude`, `lu_land` green at every viewport | arena, arena6, cast |
| **V1** · VFX language | Sticky Trail + splats as DARK ground marks with one union rim (premultiplied, not accumulate); projectiles = soft additive glow + Fresnel rim + one shared velocity-aligned ribbon trail; melee = swept crescent swoosh (no filled fan); per-character VFX palettes chosen against the floor; pools sized from `MAX_FIGHTERS` | `src/game/vfx.ts`, `src/vfx/**` | trail ΔL ≤ −0.15 or Δhue ≥ 90° vs floor at ≥3 stations; 0 pool steals at six seats (`gx_vfx_pools`); transient p95 ≥ 0.9; no new draws on the phone tier | cast, arena, arena6 |
| **C1** · characters for the 58° camera | palette re-key to **saturated mid-values** (median luma 0.45–0.6, ≤15% above 0.8 — saturation UP, never down); one signature hue per character on its largest top-visible mass; identity planes tilted ≥32° back; chunky tapered limbs, joints in limb colour, mitten hands, shoes; per-joint batching (≤25 draws per fighter) | `src/characters/**` | per-character median luma 0.45–0.6 at both cameras; face visible ≥6/8 facings; draws per fighter ≤25 (`gx_chars_draws`); `limbcheck`/`limbmatch` green (~~`charprobe`~~ — not on main: it exists only in the unmerged WIP commit `b3dda69`); **verify at 20° AND 58°** | cast, home, select, arena |
| **U1** · menus as hero shots | home: full-bleed stage, hero ~50% of viewport height, dark saturated backdrop, portrait light rig in `charStage`; select: **fix the clipped right column**, saturated solid-fill cards, bigger lit hero; slab chrome tokens (face gradient, hue-matched lip, bevel); one heavy display face for titles/CTAs/numerals | `src/ui/screens/{home,characterSelect,theme,charStage,thumbs}.ts`, `src/ui/icons/**`, `index.html` (font preload) | `menu_accept` + portrait battery green; `mc_smoke` no clipped control; `home_metrics` contrast | home, select |
| **A2** · prop kit + beauty corner | production modular kit (counter, cook line, shelf, crate, sack, barrel, canopy, hero pot): chunky bevels, lit top edge, same-hue darker sides (0.6–0.7×), baked vertex AO, material identity, silhouette breaks; per-role value script (ground L 0.50–0.54 / C ≤0.10 in-frame, structure caps light, sides dark, actors own the top of the range); **one district done end-to-end first and scored before scaling** | `src/arena/**` | per-piece ≤2.5k tris; `arena-scan --gate`; playerRank median ≤15; a blind round on the district before any map-wide change | arena, arena6 |
| **A3** · the level (only if A2's district scores) | ~8–12 compound structures per half: counter runs and L-shaped lines as walls cutting lanes, canopies framing them, an open plaza at the pot, 2–3 landmarks per quadrant, a built perimeter | `src/arena/**`, `tools/arena.gameplay.json` | spawn fairness at N=2..6 unchanged within floor; `al_guard`; AI pathing census; blind round | arena, arena6 |
| **P1** · perf enablers (as needed) | static/dynamic shadow split; adaptive DPR on phones; character draw batching if C1 did not reach it | `src/render/**` (after R1), `src/characters/rig.ts` (after C1) | `perf.mjs --mode counts` phone six-seat draws < today's 1,567 | — |

### Gameplay bug fixes — test-first, one package per owner

Root causes, deduplicated across finders (finder IDs in brackets). Full evidence:
`shots/rv/bugs/verified.json` (gitignored) and the `bh_*` reproductions in `tools/tmp/`.

| key | files | bugs |
|---|---|---|
| **B1** · match core | `src/game/match.ts`, `src/render/camera.ts`, `src/audio/**` | **items can never be used** — HUD arms Q/E and buttons, the press never reaches the sim [F1, META-01, B1, ML-2] · **the sim keeps running under the result card**: shots in flight kill the declared winner after the whistle [BH-01, ML-1, B5] · hit detection fed up to 4× dt on hit-stop catch-up [BH-13] · **waterbottle.Mega's 1400 ms wind-up draws no telegraph** (system built, never wired) [B2] · hit-stop + slam flash fire for events no display shows — 53% at N=6 [B3] · a Leftovers-revived fighter drawn as a corpse [B4, ML-3] (pose half in `rig.ts` → C1 or routed) · knocked-out player at N≥3 can leave and erase a decided result [META-02] · spectator whip-pans to a revived seat [ML-7] · the inaudible-voice cull is dead (43.6% of N=6 voices) [B6] |
| **B2** · input + screens | `src/game/{input,touch,pointerLock}.ts`, `src/ui/screens/{matchScreen,lobby,settings,shell,types,profile,trophyRoad}.ts`, `src/game/economy/containers.ts`, `src/game/roster.ts` | **a click or tap shorter than one frame never fires** (attack sampled as a level) [F2] · with mouse capture the pause sheet is unreachable [F6] · in-match buttons keep focus, Space/Enter re-press them [F3] · letterboxed window: cannot aim/fire outside the canvas [F5] · first touch on a weapon button fires instead of selecting [F7] · settings accepts Q/E/Space as movement keys, omits item keys [F8] · AZERTY number row [F4] · **changing fighter from the lobby or a six-seat pause sheet silently makes it a 1v1** [META-03] · Escape after the whistle opens pause and says the match pays nothing [META-06, ML-6] · drop-rate sheet never names the items [META-07] · two tabs overwrite each other's progress [META-08] · Back during a live match abandons silently [ML-4, unverified] |
| **B3** · combat + items | `src/game/{combat,state,rules}.ts`, `src/game/sim.test.mjs` | **Blue Cheese does nothing** — no aura code exists, yet it is offered and labelled AUTO [BH-07, ML-5, META-04] · Donut's Ring Spin declared trail-boosted, never applied [BH-03] · a human's projectile homes and range-budgets against the NEAREST opponent, not the aimed one [BH-04] · Shiitake reflects overkill [BH-05] · a stun does not cancel an item wind-up [BH-06] · multi-pellet lure drags bystanders through the bait [BH-09] · Leftovers revive HP not level-scaled [BH-11] · tray reads ready while clogged/asleep — sim half [U1] · loadout validation accepts `constructor`/`toString` [META-09] |
| **B4** · movement + sim timers | `src/game/{movement,sim}.ts` (+ the Disposal branch of `combat.ts` after B3 merged) | **Disposal can drop its victim permanently inside cover** [BH-02, move B1] · Disposal relocates a fighter mid-wind-up; the slam lands up to 588 wu from its telegraph [BH-10, move B2] · a dead Donut's trail stays drawn but stops hurting [BH-08, move B5] · Egg's Hatch pecks from wherever the chick landed [BH-12] · pot/fog/regen/trail timers reset instead of carrying overshoot; fog timer restarts on re-entry [move B3, B4 — unverified] |
| **B5** · AI | `src/game/ai.ts` | all unverified, test-first decides: sudden death silences chase-branch bots [AI-B1] · stale belief about never-targeted opponents [AI-B2] · concealment patches as permanent denial zones [AI-B3] · hidden-target lock ignores a visible shooter [AI-B4] · flow-field cache thrash at ≥2 bots [AI-B5] · following a target into the pot [AI-U1] |

---

## 6. Waves, the loop, and when to stop

| wave | packages (≤3) | why this order |
|---|---|---|
| **1** | **R1** · **A1** · **B1** | the two biggest measured levers on the floor + fighters, plus the bugs Uri hits every match (items, the result screen, the wind-up) |
| **2** | **F1** · **B3** · **B2** | the fighter unit needs R1's stage; B3/B2 are disjoint from F1 (F1 owns `hud.ts`) |
| **3** | **C1** · **A2** · **U1** | ⚠️ re-ordered after w1 (§8): characters that read at 58° and a filled, built district are what 24 of 24 critic notes ask for; menus after B2 frees the screens. ~~V1 · C1 · U1~~ was the plan before the score |
| **4** | **V1** · **B4** · **B5** | VFX under the new lighting and the new cast; ~~A2 · B4 · B5~~ before w1 |
| **5+** | chosen from the last round's critic notes and measurements | A3, P1, the minors, second passes |

**After every wave:** merge the branches → gates on a clean worktree of the merge (`tsc`, `sim.test`,
`economy.test`, `aspect`, `verify-head`, `driver_guard`, `sentinel`, `menu_accept` ×2, `gatecount`,
`perf.mjs --mode counts`) → push → **scoring round**: re-capture with `rv_capture`, k=6 fresh critics
per element, plus a drift arm (r0's own sheets re-scored, k=2 per element) so a moving instrument
cannot pass for a moving game → record in §8.

**Stop rules.**
- **Target met:** every element ≥ 7.0 at k ≥ 6, reference side inside 7–9, drift arm flat.
- **Plateau:** an element that fails to move by more than the floor (~0.5) across **two** waves that
  targeted it is **parked** in `DECISIONS-FOR-URI.md` with the numbers (Uri's rule,
  `park-loops-that-stop-converting`), and the next wave goes elsewhere.
- **A regression beyond the floor** on any element blocks the next wave until it is explained.
- **Uri's report outranks every number here** — seven of seven owner reports were real defects no
  gate could see.

---

## 7. The brief every build agent gets

Owned file set (§5) · its own worktree + branch · the snapshot rule (`sx_snap --root <own worktree>`,
never `:5173`) · never `git stash` / `--amend` / `pkill -f` · the known-bad rule (a guard that has
not failed on the bug is not a guard; failing test FIRST for every bug) · **verify every claim in the
brief and in this file against the tree, and report what did not check out** · the two cameras
(fix geometry, verify at 20° and 58°) · six seats · read every PNG it produces · the critic floor
(~0.5 at k=6 today) · no third-party descriptions in anything committed · commit with pathspec
form, the reasoning and the numbers in the message · stop and report if a file in its set changes
under it.

---

## 8. Scoreboard

### What w1 taught (2026-10-15) — every mechanical target met, the score did not move

R1 and A1 hit their acceptance numbers (front/top 0.51–0.58, shadow ratio 0.69–0.70, hue shift
≤3.2°, fighter contour share 0.087–0.156, dead-flat floor 0.56–0.61, litter 0.00–0.01%) and the
blind score is flat — `LESSONS §6b` again. The critics' sentences say why, and they are unanimous:

| theme in the critic's one change for OUR panel | arena (8) | arena6 (8) | cast (8) |
|---|---|---|---|
| the floor is **empty / flat / nothing on it** | 8 | 8 | 4 |
| the fighters are **small, pale, unreadable blobs** | 8 | 8 | 8 |
| **fill the playfield with cover / props** | 7 | 7 | 4 |
| props are **plain untextured blocks** | 4 | 3 | 4 |
| a fighter is **"a jumble of overlapping shapes with no clear head, body or silhouette"** | — | — | 8 |
| VFX hides the fighters | 2 | 0 | 3 |

r0's critics asked for a calmer floor *and* for cover; A1 delivered the first, so the second is now
the whole complaint. **Re-ordered waves 3–4 on this evidence (§6): C1 (characters) and A2 (props +
a filled district) move up, V1 (VFX) moves down** — VFX is named in 5 of 24 notes, characters in 24.


| round | tree | arena | arena6 | cast | home | select | notes |
|---|---|---|---|---|---|---|---|
| r0 | `1090046` | 4.60 | 4.97 | 4.51 | 5.37 | 5.83 | baseline; ref 7.91–8.43; ctl_high 8.10, ctl_low 3.20 |
| w1 | `ef26eeb` (R1 + A1) | 4.50 | 4.81 | 4.45 | = r0 | = r0 | **flat** — every Δ inside the floor. k=8 per match element; home/select frames byte-identical to r0 (R1 left the lobby untouched), so not re-scored. ref 8.00–8.49, 0 invalid; drift (r0's own sheets, same-sheet paired, n=10) **−0.11**; ctl_high 8.2, ctl_low 3.5. Data: `shots/rv/w1/scores.json` |
| w2 | `362623f` (+ B1, F1) | 4.64 | 4.76 | **5.00** | = r0 | = r0 | arena/arena6 flat; **cast +0.55 on w1** (+0.49 on r0) — at the k=8 floor's edge (0.49 at σ 0.50, 0.64 at 0.649), so *probable, not proven*; drift (same 10 r0 sheets) **−0.22**, i.e. today's critics are harsher, which would make the cast move larger, not smaller. ref 7.89–8.45, 0 invalid; ctl_high 8.0, ctl_low 3.0. Ring-specific notes: 6 of 24 called the ring a **solid disc burying the fighter** → `e14b875` thins it (1.5/0.42 → 1.3/0.18). Data: `shots/rv/w2/scores.json` |
| w3 | `6b93d55` (+ B2, B3, C1a, A2a) | 4.88 | 4.79 | 5.00 | (U1 pending) | (U1 pending) | arena +0.28 on r0, arena6 and cast flat on w2. Drift (same 10 r0 sheets) **−0.26** — the third harsher reading in a row (−0.11, −0.22, −0.26), so drift-adjusted: arena **+0.54**, arena6 +0.08, cast **+0.75** on r0. ref 7.80–8.40, 0 invalid; ctl_high 8.2, ctl_low 3.0. Two NEW complaints, both ours: the darker floor reads **"mauve / muddy maroon"** (A2a's value cut also cut chroma 0.122 → 0.103) and the **pale-blue counter top reads as greybox** (5/8 crop notes). The empty floor is still the first complaint on 16/16 arena notes. Data: `shots/rv/w3/scores.json` |
| w4 | `d1b2621` (+ B3b, U1, A2b) | **5.21** | 4.99 | (not re-scored) | 5.47 | 5.82 | k=8 arena/arena6, k=6 home/select; cast skipped (only its background changed — the counter top — and C1b + V1 will change the fighters next round). ref 8.27–8.48, 0 invalid; ctl_high 8.0, ctl_low 4.3; drift (10 r0 sheets, now without r0's unblurred bs_home sheets) **−0.13**. **arena +0.33 on w3, +0.61 on r0 — the fourth rise in a row (4.60 → 4.50 → 4.64 → 4.88 → 5.21)**; arena6 +0.20 on w3, +0.02 on r0 — still flat after four waves, and its frame landed on a DIFFERENT moment this round (B3b's aim rule and A2b's walls move the scripted six-seat match; the pot is centre-frame, one new counter in shot), so it carries composition noise on top of the district. **Menus flat:** home +0.10, select −0.01 on r0 after U1 (the clips fixed, a lit set). Notes: arena/arena6 **16/16 "empty floor", 15/16 "tiny fighters"** — but subject scale is INSIDE the reference band (`sbj_scale`, STATE §3) and density (`fd76ef0`) and surface detail (`6c133ce`) are measured nulls, so the prescription is not the lever; home 5/6 "flat backdrop" ("a flat blue tiled box with plain jars"), select 4/6 "empty dead zone below the ability card". |
