# State — what is done, what is pending

**As of commit `07c5294`, end of the unattended session of 2026-08-11 → 12.**
Tree clean, in sync with `origin/main`, ~300 commits and ~20 agents since `b967242`.
**Deployed and live** at `https://uri-onceuponyou.github.io/food-arena/` — the served build is
`f5dddb4`, and its only difference from `07c5294` is **comment-only** (verified: the whole
`f5dddb4..07c5294` diff under `src/` is comments, zero executable lines).

> ⚠️ **The header used to read *"as of `b967242`, 125 commits into an unattended session… working
> tree clean"*, and then *"as of `6650bf6`"*. Kept because the staleness is itself the lesson:** this
> line is the first thing a new session reads, and it has now gone stale twice while every gate
> stayed green. Nothing checks it. If you land work, move it.
>
> 🚨 **And it went stale AGAIN while this very file was being written** — HEAD advanced past
> `07c5294` during the four-document handover. That is not a footnote, it is the demonstration: the
> commit named above is the tree these words were **verified against**, not necessarily the tip.
> Run `git log --oneline -1` before you trust it.

---

# 1. WHERE THIS PROJECT STANDS — the one screen

A real-time 3D brawler in Three.js. **It is playable end to end on desktop and on a phone**, and the
simulation now seats **up to six fighters** with a fair spawn set, a scaling endgame ring, sudden
death, a 3–6 seat payout curve, XP, a result card, and a wire codec for multiplayer.

Three sentences, honestly:

- **The GAME is in better shape than the SCORE.** Every objective gameplay metric moved this session
  — seat fairness, roster range, reach, phone cost, controls. **No blind-critic round has been run
  since the ×4 map landed**, so §7's score table describes a frame that no longer exists.
- **The largest finished thing in the project is unreachable.** Six-player, the payout curve, the
  placement result card and the scaled ring all work and all ship — and **nothing in the UI can start
  a six-player match.** One answer from Uri unblocks five shipped systems (§4, item 1).
- **The instruments are the risk, not the code.** Nine controls this session could not distinguish
  their own two arms. See §6 — it is the single most valuable page here.

| | where it is |
|---|---|
| shipped & reachable | 1v1 match, 11 characters, levels 1–15, economy, menus, touch, audio, phone perf, concealment |
| shipped & UNREACHABLE | 3–6 seats, placement payouts, placement result card, `minSafeRadiusFor(N)` |
| built & inert | multiplayer transport (`src/net/`) — no server, no session |
| not started | skins, matchmaking, any mobile wrapper |

**Judgement calls are in `docs/DECISIONS-FOR-URI.md` (§48–§71 are this session).** That file is the
per-decision record and opens with a four-row answer sheet. **This file points at it and does not
restate it.**

---

# 2. DONE — this session, with evidence

Every row is a commit whose message carries the measurement. **Nothing here is a plan.**

| | what changed | evidence |
|---|---|---|
| **×4 arena** | `ARENA_W/H` 1400×1000 → **2800×2000**; six spawns in three bays; **111 props at *lower* density** (17.92%) | `6631446` — the acceptance test whose own header said *"it goes away when §48's arena lands, not before"* reports **37/37**; all six seats at full health at 9.0 s, where the old map had slot 0 dead |
| **seat fairness** | spawn advantage **2.680 → 0.342 places** of 6; all six seats deal damage in **600/600** (was 74.5%) | `2d3e9bd` — and the quantity that had to be equal was **in-degree of the t=0 targeting digraph**, not radius and not spacing. Both obvious alternatives falsified *by construction*. Current minimum pairwise spawn separation **915.9 wu** (slots 0↔3) against `REACH.rangedMax` 140 |
| **endgame ring** | `minSafeRadiusFor(N)` = 140 at N≤4, **187.42** at N=5, **237.00** at N=6 | `4bb64e4` — N=2 proved a no-op over **45,959,702 ticks / 12,503,511 in-order events / 0 divergent**. ⚠️ **See the caveat in §5: at the shipped constants this function's result is never reached.** |
| **sudden death** | ring collapses at 30 s; `resolveTimeout` fires **0/880** | `f87d407` — the timeout tiebreak Uri asked about in §2 now actually never fires, because the match ends before it |
| **payouts** | 3–6 seat curve on **normalised** rank, + XP, **+ it now reaches the game** | `721ce3c` `a588066` `bb00d66` — the curve was complete, correct and unreachable: a 3rd-of-6 finish was being paid as a 1v1 loss |
| **result card** | placement, **real elimination order**, payout chips | `7743f08` `e60117d` — the loser list was slot-ordered |
| **ranged reach** | **23 of 23 → 2 of 23** weapons cannot connect at their own press gate | `af35362` `a9da836` — `range` was two quantities wearing one number; the retirement budget is now in the **target's** frame |
| **roster** | range **27.8 → 9.8 pp**, tier spread 16.2 → 6.1, sd 7.1 → 3.1, **no mechanic touched** | `33318a1` — five weapon constants, paying back the price Uri authorised in advance for the reach fix. Both quantities reported separately per `CLAUDE.md` #10 |
| **concealment** | **20 patches (10 mirror pairs), 110–130 wu**, three kitchen kinds, walk-through, breakable | `b9bc00e` then `6631446` — §18/§29 shipped. All patches ≤168 wu, the AI-search ceiling. See §5: **this closes an item this file still called "the largest single item waiting"** |
| **phone** | draw calls **928 → 423** (−54.4%), main thread **−47.9%** against a **±0.71 ms** floor | `5aa4655` — 1,908 static props merged to one mesh per material; scene objects −64.0%, shadow casters 1,657 → 186. ⚠️ **Triangles ROSE** 1.09 M → 1.52 M (+38.6%); the win is object count, not geometry |
| **landscape UI** | weapon tray hides **7.92% → 0.00%** of guaranteed-visible arena; clock **13.12% → 0.49%**; all controls 22.6% → 4.3% at 844×390 | `bd39464` `b2f2cb1` `f1f2a40` `845716a` |
| **multiplayer** | wire codec + delta compression **7.1×**, `src/game/` untouched | `915bbaf` `a588066` — one alias-aware walker, not a field list |
| **fog** | no longer renders as nothing at radius 0 (the one radius sudden death is made of); now covers the corners | `779dc62` `06da604` — 3.25% of standable ground was outside it |
| **unreachable floor** | **14 gaps in 7 mirror pairs**, wider than a drawn body and narrower than `PLAYER_SIZE` | `b9bc00e` — a render/sim mismatch a legal-space flood is structurally blind to. **The threshold is the NARROWEST character (19.1 wu), not the average one**; a first pass at 26 wu declared the kitchen clean and six were still open |
| **icons** | per-icon absolute scoring **retired on its own arithmetic** | `706c35c` `07c5294` — a 3-judge panel is worth 1.51 judges and the 0..3 scale is at its ceiling |
| **gates** | 12 faults → the documented residue | `docs/TOOLS.md`'s gate table is the **one** place expected counts live; run `node tools/tmp/gatecount.mjs`. **Do not copy a count into this file** — `gatecount` refuses a second copy even one that agrees |

## 🔴 And Uri played it mid-session, which produced the two best reports again

> *"there are regions in the map that are unreachable due to obstacles"* · *"i can't hide under
> conceilments or break them."*

**Both were right and neither was visible to any gate here.** The first was the 14-gap render/sim
mismatch above. The second was not a bug in the mechanic at all — `f0e7aed` had built the entire
feature (radar blip, pill, model, homing re-aim, `breakConcealment`) and **it had never been given a
region to act on.** `docs/LESSONS.md`'s standing claim that playing it beats every instrument here is
now **four for four**.

---

# 3. PENDING — ranked by what it UNBLOCKS, not by size

## 🔴 1. Six-player has no entry point — **one answer unblocks five shipped systems**

Reachable only via `?fighters=`, which `src/game/match.ts:326` documents as **QA-ONLY** and which
`main.ts` lists in `MATCH_ONLY_PARAMS`. `matchScreen` always builds two seats. The arena declares six
spawns and `sim.ts:createMatch` reads them, so **the sim end is finished** — what is missing is UI.

Blocked behind it, all finished and all currently dead: **the 3–6 payout curve · placement XP · the
placement result card · `minSafeRadiusFor(N)` · the seat-fairness work.**

Three design questions, none of them code: **where the affordance lives** (no mode selector exists),
**how the other five are chosen** (no matchmaking), **what level five bots are**. → §4 item 1.

## 🔴 2. The six-fighter result card is 705 px wide at 430×932 — the winner is off-screen

Left edge at **−138 px**. Pre-existing and unreachable in shipped play, so it is not urgent today —
**it becomes the immediate blocker the moment item 1 is answered.** No owner. `DECISIONS §70`.

## 🟠 3. Nobody has scored the game since the map doubled

§7's table (cast 4.33 / arena 5.17 / home 5.17 / HUD 5.67 against a 7+ bar) was measured on the
**1400×1000** map, before the phone pass, before concealment, before the rim-clone fix. It is the
best score data in the project and **it describes a frame that no longer exists**. Any claim that the
art work did or did not move needs a fresh baseline first. Floor is **±1.4 points**; use
`--rubric canonical`; never compare across rubrics.

## 🟠 4. The art gap itself — flat/unlit surfaces, and "short of THINGS"

The #1 critic complaint on three elements, with a known mechanism (§8) and a landed partial fix
(`cloneToon` now has 16 call sites). **Two independent measurements say the remaining gap is not
surface texture**: our `mf`/`lf` band detail sits on the reference *median*, while `featShare`
— object-scale contrast — is **24.6–34.9% reference against 15.3–20.7% ours, non-overlapping**.
⚠️ **All of those numbers were taken on the 1× map with 96 props; the ×4 map has 111 at lower
density, so re-measure before acting.** Detail in §8.

## 🟠 5. Concealment is placed but its size call is still open

20 patches shipped. `DECISIONS §29(a)` — **bush size** — is the one part still awaiting Uri's read,
and it is constrained rather than free: `stepAI` **has no search**, sees `CONCEAL_REVEAL_RADIUS` =
84 wu from where it last saw you, and at double that radius it never re-acquires. **A large patch is
a permanent AI-denial zone**, so nothing may exceed ~168 wu across. Every shipped patch is 110–130.

## 🟡 6. Instrument and hygiene debt, no owner

- `hl_sweep` still reports `INSTRUMENT INVALID` — for **one** reason now, not two. `PIX` is closed
  (§5 correction 3); **`SWAP` is not.** ⚠️ **Three different figures for it are in the tree and they
  do not agree** — `docs/TOOLS.md`'s row says *"12 of 23"* in one clause and *"12 of 22"* in another,
  while the same file's gate-table SKIP note says *"fails on every weapon measured"*. What is
  unambiguous: **every other control passes 22 of 22** (N · A · DIFF · PAIR · RESTORE · NULL · PIX)
  over a 2.9 h full-roster run, so the instrument is sound apart from that one arm; and the one case
  with a diagnosed cause is **`waterbottle.Cap` — 4 pellets at 104.5 wu overrunning a 130 wu patch, a
  harness coverage defect, not a game defect.** ⚠️ **Do not quote a `SWAP` count without re-running
  it.** It is the slowest browser gate here (~7 min per weapon).
- `n2_geom --ids all --knownbad sort` fails 3 checks; its header claims coverage its default does not
  deliver.
- `ic_spec` prints **24 on a working tree and 16 on a committed one** — 8 arms read the gitignored
  `shots/` tree. ⚠️ **The mechanism circulated for this was WRONG: `gatecount` does not build or measure a
  committed tree — it has no `git worktree` and no `git archive` and runs each tool wherever you invoke
  it.** `ic_spec` simply counts 8 extra arms when the **gitignored** `shots/` tree is populated. So a
  working directory reads **24** and **a fresh clone reads 16 and sees `gatecount: 0 FAULTS`** — this
  "standing fault" is an artifact of having run the shot tools, not a property of the repo. **16 is the
  documented number because it is what a clean machine reproduces.** Stable,
  documented, and the reason this row read 24 for so long: *every agent who "checked" it checked a
  working tree.*
- `x4_shot` prints which spawn bays have no screenshot station within `SPAWN_TAG_WU` (200 wu) — a
  coverage note it is **designed to print**, not a failure. ⚠️ **This circulated as an `sx_fog` defect
  and `sx_fog` has no spawn-bay arm at all** — it is a 2×3 grid of {sudden death, wide ring} ×
  {centre, mid, corner} and passes 2/2.
- `src/characters/taco.ts:949` cites `rig.ts:602/630`. ⚠️ **Both numbers are stale and so is the
  replacement that was circulated for them** — the lines the comment actually describes (head shrink;
  head mount above the neck gap) are **`rig.ts:811` and `rig.ts:838`** on `07c5294`. Verified by
  reading the code, not by adding a drift.
- Seven weapon files carry a stale copy of the generic size curve. Soup's three impact hooks read
  `ctx.damage` nowhere (1.00×).
- Skins need a per-character material-variant system that does not exist.

---

# 4. NEEDS URI — four questions, four one-line answers. **Nothing is blocking.**

Every one has a default **in force and running**. Full pricing per item is in
`docs/DECISIONS-FOR-URI.md`; this is the index.

| # | question | in force | the default, if you say nothing |
|---|---|---|---|
| **1** | 🔴 **Six-player: where does the button live, how are the other five chosen, what level are the bots?** | QA URL only | stays unreachable. Recommended: a tile on home, five bots at your own level — **~15 lines** once the call is made. `DECISIONS §66` |
| **2** | **Sudden death fires at 30 s. Right?** ⚠️ **Escalated**: the seat fix made all six actually engage, so it now decides **90.5%** of six-player matches (was 66.0%). **It is the normal ending now, not the edge case.** | 30 s | keep 30 s. Moving it to ~42 s makes the scaled ring real but leaves sudden death lasting **3.2 s** — a blip, not a phase. One constant. `DECISIONS §58` |
| **3** | **Three icon subjects** — `boxBurger`, `stun`, `wrap` | as drawn | ⚠️ **"Leave it" is a legitimate answer for all three** — every one ships beside its own text label. If you pick one, pick `wrap`. `DECISIONS §71` |
| **4** | **Your phone model, its iOS version, and a fresh 10-second capture** | unknown | −47.9% stays a **desktop** number. This is the only experiment that turns it into a real one on your device. `DECISIONS §33`/`§62` |

**Do not re-ask anything else.** Uri cleared the entire backlog on 2026-08-11 (`DECISIONS §54`) and
answered §49 and §53; §43 and §46 are withdrawn.

**And the standing one:** the four most valuable bug reports this project has ever had came from Uri
simply playing it — two of them **this session**. A build is deployed for exactly that.

---

# 5. THE CORRECTIONS — things written here or in DECISIONS that were FALSIFIED

House style: **keep the wrong wording next to the right one.** Every entry below was believed on the
strength of a method rather than a measurement, and every one was caught by an agent that
**re-derived** rather than pasted.

### From the orchestrator (the main conversation) — six, of which agents caught five

1. 🚨 **Written here: *"`level_lab` is a finding, not a fixture — the level-1 player now wins 100.0%,
   so it is pinned at its ceiling and can no longer tell level 1 from level 15."* FALSE.**
   Measured: **40 of 110 cells unsaturated and every one rises**, max 93.8 pp; the full grid moves
   **55.00% → 99.32%**. **One hand-picked cell had saturated and I generalised from it to the
   instrument.** It now runs a declared 11-cell cyclic panel (47.7% → 98.9%, **+51.1 pp against
   5.3 pp of standard error**) *plus a row asserting the baseline has headroom before asserting it
   moves* — the guard the original framing would have skipped.

2. 🚨 **Written here and recommended to several agents, twice: *"`git archive HEAD` is the clean-tree
   method."* WRONG TREE.** Five gates shell out to `git` and die without a `.git` directory:
   **it reports 8 faults where a real worktree reports 2 — a wrong CAUSE, not merely a wrong number.**
   → Use **`git worktree add --detach`** with `node_modules` **and** `reference` symlinked in.
   (The first attempt was worse still: no `node_modules` at all, so seven gates died on a missing
   import and looked exactly like seven broken gates.)

3. 🚨 **Written here: *"`hl_sweep`'s fix emptied its own validator corpus."* FALSE — the corpus was
   never empty.** The **default split stopped partitioning it**: `vfx.ts:haloColorFor` splits on the
   **weapon's** colour and `hl_sweep:retarget` splits on the **halo material's**, which are the same
   number *only while the bug exists*. Over all 33 shipped halo colours, `--split 0.75` selects 0 of
   33. Default is now 0.53.

4. 🚨 ***"The rank has to come out of the sim's final state."* IT CANNOT.** Every loser ends
   `hp:0, deaths:1` **identically**, so a final-state resolver degenerates to slot order — which is
   exactly the bug the result card had. The order is in the **death event stream**.

5. 🚨 **A patch routed to an agent as ready — `.map(s => roster[s]).filter(Boolean)` — silently DROPS
   fighters.** On a 3-entry order it lists **3 of 5** losers. The agent probed instead of pasting.

6. **Two swapped SHAs, and an `h49_chips` row quoted as saying `+156` when it never said it.** A
   stale reading passed on.

### Earlier entries in this file, now closed by work that landed

7. ⚠️ **PART/§9 item 2 still reads *"The scripted player cannot heal… one line in
   `scripted_player.mjs`."* CLOSED.** The driver is at `DRIVER_REV = 4` with the heal on a branch
   *ahead* of the offensive ranking gated on `ai.ts:rankHeal`'s own conditions, and the ranking keyed
   on `ai.ts:pressValue` rather than authored per-pellet `damage`. **Both faults are guarded** —
   `node tools/tmp/driver_guard.mjs` is in the commit battery for exactly this. Hamburger's
   `healAmount` 25 → **18** landed with it.

8. ⚠️ **PART/§10 item 3 still reads *"Kitchen concealment — approved by Uri, unstarted… the largest
   single item waiting."* CLOSED.** 20 patches (10 mirror pairs, 110–130 wu) ship in the kitchen
   (`b9bc00e`, extended in `6631446`). Only `DECISIONS §29(a)`, the size read, is open.

9. ⚠️ **Previously live: *"`x4_layout.mjs:SPAWN_NORTH` is a stale generator that would silently revert
   the seat fix."* FIXED** (`c469da2`). Its guard **became its own opposite**: it now asserts
   AGREEMENT rather than divergence, calls the generator's `build()` instead of regexing the source,
   and asserts `length === 6` *before* `every()` — the empty-set trap that went vacuous three times
   this session.

10. ⚠️ **The shipped table's `minSafeRadiusFor(N)` row reads as if it binds. It does not, today.**
    `rules.ts:1131` states it: **at the shipped constants the function's result is never reached** —
    `SUDDEN_DEATH_MS` collapses the ring **9.6–11.8 s** before the schedule would arrive there. It is
    not dead code (it is the floor for every `t < SUDDEN_DEATH_MS`, and it binds the moment either
    constant moves), but **§4 item 2 and this row cannot both be live**: answering sudden death at
    ~42 s is what makes the scaled ring real.

11. ⚠️ **A resolution floor circulated as *"main-thread JS ±1.28–1.76 ms"* does not exist in this
    repo.** The measured figure, from a null arm, is **±0.71 ms** (`DECISIONS §62`). Use that.

### And one older correction, kept because it reads as settled

⚠️ **`bd068d0`'s commit message garbles §48's fixture** — it says the fixture was *"right about the
mechanism and wrong about its size by 5×"*, which conflates the first-contact row (**near-exact**:
predicted +12.77 s, measured +12.75 s) with the win-rate row (5.15× too large). Amend is forbidden,
so the correction lives here: **the split is measured-vs-inferred, not mechanism-vs-size.** §48
simulated exactly one number and got it to 0.02 s; every other row was *reasoned to* from it and
three of those came out in the opposite direction.

---

# 6. 🚨 THE DOMINANT LESSON — controls that could not fail, none caught by another check

⚠️ **The count is in `docs/LESSONS.md` §17 and deliberately not repeated here** — it was written as
seven, nine and ten in four files describing one enumeration, which is exactly the defect §17 is about.

**Every one was found by an agent re-deriving something it had been told was already true.** Not one
was caught by another check. The mechanisms are all different and all invisible:

1. a fixture pointing at **a herb crate**; an "axis mirror" mirroring about **the old centre** — both green
2. a known-bad placed **where the bug could not express itself**, so both arms passed
3. `[].every()` returning `true` after a fix **emptied the filtered set** — **three times, in three files**
4. a differ blinded to a field that **had nothing to drop yet**
5. a wrong-base demo **inside the countdown**, where nothing moves
6. a sentinel written onto a field **already holding it**
7. a call-site census counting the **function declaration** as a call site, printing `ok` next to an
   evidence line describing the failure
8. a suite reporting **227 passed, unchanged**, straight through a feature rewrite it could not see
9. **two arms of ONE instrument false BY CONSTRUCTION** — comparing a *rendered frame's luma* against
   a *material's colour*. A lit surface reads brighter, so a 0.06 threshold cut straight through one
   continuous population, with rows landing either side of it by **0.001**

> ### A passing test is not evidence the thing it points at is right.
> **`--selftest` validates a tool's LOGIC. It never validates where the tool is POINTED.**
> `valuescan` read **105/105** while **14 of its 18 stations** were in the wrong quadrant and eleven
> were **inside solid props**.

## 🚨 The second lesson — why the map change hid for a whole session

> **The 1× playfield is exactly the NW quadrant of the ×4 one, so every stale coordinate stayed LEGAL.**

**No legality check could have found that class.** Eleven were found one at a time by accident; a
systematic sweep then found **12 more at a 0.5% false-positive rate**, plus 63 enumerated and frozen.
`tools/tmp/al_guard.mjs` now catches the class.

⚠️ **Would another resize be safe? "Safer, not safe."** Dozens of files across `src/` and `tools/`
now hold a hardcoded **2800** or **1985**, so **today's correct literals are the next generation's
stale ones.**

The worst instances are worth naming because each one *passed*:

- **`match-play.mjs`** — the only "play the whole thing on screen" tool — sent hands **1,077 wu inside
  the NW quadrant**, read every radius **2.23× low** and every timestamp **4× high**.
- **`h49_chips`** spawned **2 of 6 seats outside the ring**, taking 50 HP/s.
- Run on the stale spawn table, **`x4_layout` printed ✅ EVERY CHECK PASSED** and `--selftest` 54/54.
  The old seats really are legal, symmetric, 892 wu apart and in one nav component.
  🚨 **Legality is not fairness.**

## The third — verify, do not paste

The orchestrator published six wrong things this session (§5) and **agents caught five of them, every
time by re-deriving instead of accepting.** The sixth was caught by a gate.

**Keep saying so in every brief.** It is the highest-yield sentence in the agent template.

---

# 7. Resolution floors — state one before acting on a change in it

| quantity | floor |
|---|---|
| aggregate win rate | **~9 pp** |
| pacing | ~0.8 s of contact / ~4 pp dead time |
| blind critic | **±1.4 points** (σ = 0.50; a round's two panels are **n=1, not n=2**) |
| FFA mean placement | **0.978 places** single-phase (`nf_ffa`); ~0.32 pooled over 11,088 matches |
| seat spread | **0.315 places** — a **label permutation** over 4,000 reps, **NOT a standard error**: the spread is the *range of six correlated means* |
| main-thread JS | **±0.71 ms**, from a null arm |
| draw counts | **EXACT** |

🚨 **A paired per-matchup delta on identical seeds is EXACT, and it is a DIFFERENT QUANTITY from an
aggregate.** Report both, separately. `roster_table`'s aggregate once moved 0.8 pp — inside the floor
— while **58 of 110 individual matchups moved, max 34.4 pp**. `b9bc00e` is the same shape: aggregate
win 0.0 pp, paired **58/110 moved with 14 winner flips**.

⚠️ **Every one of these floors was discovered AFTER someone had already acted inside it.** A whole
character programme was steered by score moves of 0.25–1.0, and two passes were reported as
regressions that never cleared the noise.

---
---

# ARCHIVE — the record before 2026-08-11

🔴 **READ THIS BEFORE THE SECTIONS BELOW.** Everything from here down is kept because it is the only
record of *why* several numbers are what they are, and because `docs/LESSONS.md` outranks it on any
art-direction question. **It is stale in three specific ways, and none of them is marked inline:**

- **Every arena, frame and composition measurement below was taken on the 1400×1000 map** with ~96
  props — occupancy, `featShare`, `oriAll`, `hi70`, `floorprobe`, the tile-lattice finding, the
  concealment traffic census. **The map is now 2800×2000 with 111 props at lower density.** The
  *diagnoses* mostly survive; **the numbers do not.**
- **Every payout figure below assumes the two-outcome (win/lose) model.** Payouts are now a **3–6
  seat curve on normalised rank, plus XP**.
- **§9 item 2 (the scripted player cannot heal) and §10 item 3 (concealment unstarted) are CLOSED**
  — see §5 corrections 7 and 8. Their old wording is deliberately left standing below.

---

# 8. Where the game stood on score (measured pre-×4, `56ccb62`)

**For the first time, the score could be trusted.** The blind-critic instrument was audited and
rebuilt: a canonical rubric (`tools/review.rubric.txt`), top-down plates for gameplay, action frames
rather than idle ones, menus scored against menus, and a **measured resolution floor of ±1.4 points**.
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

Our best element was being marked down for the surfaces behind it.

## 🚨 THE SESSION THAT MOVED EVERY OBJECTIVE METRIC AND ZERO POINTS OF SCORE

22 fresh critics, 22 valid rounds, 0 discarded, every reference panel in 7–9, canonical rubric.

| element | baseline | now | delta | floor | clears? |
|---|---|---|---|---|---|
| arena (action frame) | 5.17 ± 0.41 | **5.00 ± 0.63** | −0.17 | 0.60 | **NO** |
| cast in match | 4.33 ± 0.52 | **3.83 ± 0.41** | −0.50 | 0.53 | **NO** |

**`hi70` moved 4.7 floors — 2.40% → 13.58%, past the reference median — and the score moved
nothing.** That was the acceptance test defined before round 1, honestly measured, and passed
convincingly. **It was not the binding constraint.** `docs/LESSONS.md` §7 in its purest form: an
objective test can be well-chosen, cleanly measured, and still not be the thing.

### The drift control, and why it is ALSO not a result

The same **byte-identical** baseline sheets, re-scored by fresh critics six hours later, read
**0.42 (arena) / 0.58 (cast) LOWER**. That would mean a cross-session wobble of ~0.5 that is not the
game. **But it does not clear its own floor either** — at σ=0.50 with n=6 vs n=4 the SE is 0.323, so
those are **1.30σ and 1.80σ**. *Suggestive, not established.* **8 critics per arm would settle it**,
which is cheap and worth doing before any future before/after spans a session boundary.

⚠️ The correct reading: **no measurable change in either direction, and a live hypothesis that the
instrument itself drifts across sessions.** Not a regression, and not a win.

## ✅ THE FLOOR WAS PROBED, AND THE CRITICS' MECHANISM IS FALSIFIED — `ac08dbf`

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
that is already where the reference is** — §6b applied *before* the round was spent. These govern
**37–46% of the whole frame** (stated, as §6b requires).

**The one real out-of-band thing is that our ground is a LATTICE.** Our tile field repeats at
**100–107 × 80–86 px, autocorrelation 0.55–0.82**, while **five of six plates have NO periodic ground
repeat at all** above the instrument's own noise floor.

🚨 **AND THE WHOLE-FRAME GAP IS NOT THE GROUND AT ALL.** `featShare` reference **24.6–34.9%** against
ours **15.3–20.7%**, non-overlapping — and `featShare` counts **object-scale contrast, not texture**.
**The frame is short of THINGS, not short of surface.**

⚠️ **Not changed, and here is why:** `oriAll` is real and out of band but **has no established link
to critic score**, and rewriting the largest surface in the game steered by an unlinked metric is
exactly the §6b failure. Specced for whoever takes it: break the two-direction lattice (irregular or
hex pavers, joints at more than two orientations) targeting `oriAll` ≤ 0.351; and scatter small
ground chips arena-wide — ~12 px against an 80–106 px stone (11–15% of a stone width), each with its
own shading. Materially different from the deleted "polka dots" (35% of a tile, flat tinted discs).
Before-control recorded: `floorprobe` **5/5**, R mean 0.388, worst `pantry_ne` R=0.672.

⚠️ **`oriAll` has NO measured resolution floor** — frame-to-frame spread ~0.08 (ours) and ~0.12
(plates) against a 0.13 gap. **Established in direction, not in magnitude.**

## The mechanism behind "flat and unlit": the game drew no highlights

**Three independent probes converged** — the convergence signal `docs/LESSONS.md` §3 says to trust,
and the *ninth* consecutive plateau that turned out to be a bug rather than a taste gap:

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

**Saturation went UP**, confirmed by an instrument sharing no code with the probe. `floorprobe` 5/5
with `pantry_ne` **byte-identical** to its pre-session value — the drift control proving no floor
value moved.

⚠️ **`clippedHighPct` is NOT a concern**: measured on the identical definition, whole frame, both
sides — **reference 1.36–16.36%** (median ~6.2%) against **ours 0.379% → 0.434%**. We are **3.1×
below the lowest plate**.

### 🚨 Root cause — `Material.clone()` silently drops `onBeforeCompile`

`three/src/materials/Material.js` `copy()` names 40+ properties and **not** `onBeforeCompile`.
`applyRimLight` is called from exactly **one** site (`toon.ts`, inside `toonMat`) and nothing
re-applies it after a clone. There were **54 material-clone sites in `src/`**, so the arena's whole
cloned palette rendered with **no rim** — the term `toon.ts` itself calls *"the single largest
material lever in the frame."*

**Smoking gun:** `kpal:woodPad` appeared **twice in one frame under the same name** — the original
with the rim (0.805% of frame), its clone without (2.501%).

✅ **Fixed with `cloneToon()` in `src/render/toon.ts`** — 16 call sites today, so the sites cannot
silently drop it again. ⚠️ **Not the ground plane** — `src/arena/apron.ts` passes `rim: false` on
purpose.

### ⚠️ Lead 1 (the contact decal) is FALSIFIED — it was the "cheapest lead" and a category error

**The old wording, kept so nobody re-derives it:** *"Raise `src/arena/`'s baked contact decal ~2.5×.
It sits at |dL| 0.0491 against a 0.1238 reference measured off real barrels. Beats a whole SSAO pass,
for zero draw calls."*

**0.0491 and 0.1238 are different quantities.** 0.0491 is the mean *ablation delta of the baked decal
layer alone* over 0–0.15 m; 0.1238 is the reference's *total shipped contact contrast* over 0–0.25 m,
all layers. Measured **like-for-like, ours already matches or exceeds the reference**: shadow side
≤3 m **0.1415 / 0.2181** against 0.1238. And **there is no 2.5× in the knob**: opacity headroom
**1.11×**, darkness headroom **1.14×**. The layer doing the grounding work is the **shadow map**.
**Do not spend a round on this.**

### Lead 2 (SSAO) — worse than recorded

`useAO` has effectively no live call path, so it cannot be re-measured, but its draw cost is bounded
exactly and is worse than recorded: **+395 draws (+94%), +99% triangles**. An `EffectAttribute`-based
approximation in the existing post chain is the cheaper route if ever wanted.

### Lead 3 (`glossyMat` has no rim) — real, and gated

The per-character `clipShare` run it was gated on is **done: 4 of 5 pass, SOUP FAILS**.

⚠️ Two facts to carry: **52.6% of the cast (20 of 38) is authored at roughness ≥0.6**, where specular
headroom has already collapsed 10×; and **`material.envMapIntensity` is silently discarded**
(outside the `refreshMaterial` guard, so it runs every draw). Assigning
`material.envMap = scene.environment` to escape the overwrite is a **provable no-op at the scene's
own 0.32** — and at ×2 it behaves as **flat ambient, not sheen** (floor p05 0.248 → 0.361 while range
0.307 → 0.263: it washes the darks). **It is not a sheen control.**

### The composition census nobody had

**18.39% of a gameplay frame is `MeshBasicMaterial`** — a shader with no normal in it at all: zero
specular, zero rim, zero diffuse falloff, zero shadow receive. **140 of 255 materials are Basic**,
the largest single unlit surface being `hazard:glow` at 11.68%. Separately, **63.44% of the frame is
a flat ground plane**, with **zero normalMaps project-wide**. ⚠️ But the reference argues for
restraint: `bs_04`'s ground is *also* a smooth flat plane — what stops it reading as paper is **prop
density and a dark offset contact under every object**, not surface detail.

### And the orchestrator's own frame read was REFUTED on both halves

It eyeballed a frame and claimed the character was *"~5% of frame height"* and *"the right-hand third
is empty tile"*. Measured off ruled frames (`cr_geom.mjs`, 17/17 selftest):

- character height is **10.6–12.6%** against plates at **11.7–14.4%**. **The eyeball was wrong by
  ~2×** — the exact documented trap (*"two agents computed 13% and 7%; the truth is ~10.5%"*).
- per-third occupancy **L 33.6 / C 47.6 / R 38.7**, min-third ÷ whole **0.825** against a plate band
  of **0.712–0.918**.
- ⚠️ **And the frame looked at was the wrong artefact entirely** — a `kneeprice` probe frame: no HUD,
  no opponent, no VFX, one idle character. Precisely the idle content that costs ~1 point.

**But the perception was picking up something real the metric cannot express:** occupancy scores one
big value-varied slab the same as many small props. *"Not emptier in value"* and *"emptier in
content"* are both true — and that gap **is** the `featShare` finding.

---

# 9. DONE before this session — gameplay, presentation, instruments

## Gameplay

- **All six 🔴 bugs** fixed (the clock ended nothing · trail marks stacked an 87 HP one-frame kill ·
  melee at distance 0 ignored facing · a fighter inside the pot was 0.0% visible · the radar showed
  no zone · match duration ~7× too long).
- **Five AI driver bugs**, every one the same shape — *a rule stated once in `rules.ts` and
  implemented differently elsewhere*: a stun silenced the AI (11/11 characters — the stunned player
  fired 100% of its shots, the stunned AI 0%); both drivers ranked weapons by authored `damage`
  (which is per-*pellet*); a melee-only AI had nothing to fire when fleeing; the flee branch aimed
  **away** from the player and fired along it (8 of 11 dealt literally zero); and the terrain slow is
  applied to the player only — **the AI crosses every puddle at full speed** (*parked*).
- **Levels 1–15**, +5%/level of HP and damage (1.70× each = 2.89× effective). **Level 1 is
  bit-identical to the pre-levels build**, proven tick-for-tick. Win rate drifts **1.9 pp across
  L1→L15**; with the enemy pinned at L1 it would be **99.4%** by L15.
- **The roster has a second axis.** Per-character health and speed are simulated (they were card
  fiction). Rarity is **not** power and costs nothing extra to level (§26). Speed measured as a
  **nearly inert lever**; every point of the result is health.
- **Pacing.** Countdown 5.68 → 3.68 s with **zero** win-rate change, proven: 3,520 matches
  bit-identical. `MATCH_DURATION_MS` and the fog schedule were both **falsified** as pacing levers.
- **Touch is sound and closeable** — 36/36 distinct bearings, worst error 0.27°, reversal spread 0.
  Two real defects fixed: a second finger in the same zone killed the stick, and **83.3% of the
  bottom 38% of a portrait frame was dead to touch, with the control hints drawn on it**.
- **Session continuity.** The URL names the screen and reloads land there. A restored WebGL context
  was rendering **15.65 luma darker, permanently**. One bad screen constructor used to kill the
  router permanently.
- 🔴 **The sim stopped being hard-1v1** — `cdcdd65`: `fighters: Fighter[]`, slot identity, an N×N
  perception matrix, `damagedMask`, `hitRadius` on the fighter. `state.player`/`state.enemy` remain
  real properties holding the same objects, so **every renderer/HUD/audio/tool consumer needed zero
  changes.** Proved: **0 differing ticks in 26,388,976** over per-tick state AND 7,039,194 events in
  order.

## Presentation

- **Cast:** dark rung (p05 0.273 → 0.157; 11/11 pass `range`/`p05`/`steps10`), silhouette (hull
  deficiency 0.1379 → **0.2621**, the reference median; **11/11** clear the floor, from 1/11),
  near-white clipping **0.1007 → 0.0275** against a reference median of 0.0249. All eleven got the
  arms-vs-legs pass (`25665f9`, `76369eb`, `75daec3`): they were not merely similar, they were **the
  same call** — hamburger's forearm and shin shared one `case` block, and three archetypes made
  **arms fatter than legs**.
- **Arena:** brightness (frame luma 0.322 → 0.402), edge grammar (the reference marks a ground seam
  with a **dark band, never a bright line** — we had it inverted), contact grounding (share past the
  0.06 threshold 16.9% → 35.6%), stains (they had **no dark core at all** — a bright ring around
  nothing).
- **Lighting:** the key light's **azimuth sign** was throwing every shadow behind its own object.
  Contact ΔL 0.0353 → **0.1242**. Figure/ground *paid* rather than cost: cast minimum −0.0014 →
  **+0.0593**, gate failures 3 → 0. Fighters now cast a contact shadow in grease and water
  (`e47ba7c`) — the puddle was depth-rejecting it.
- **HUD:** 20 WCAG failures → 0, min ratio 1.89 → 6.48. Eight defects, all bugs — including a
  `.hud-zone.is-danger` state authored and selected by nothing, and damage numbers erasing the clock.
- **VFX:** the trail was **0.7° of hue from the floor and 1.0° from the cast** — the critic's phrase
  was literal. Now 22.4°, with cast figure/ground +5.1%. ⚠️ **But the occlusion complaint did not
  move**: 5 of 6 critics before, 5 of 6 after. **Hue was never the binding constraint — AREA and
  OPACITY are.**
- **Weapon halos:** the eight palest weapons had a halo the colour of the ground (`50c5272`).
  `PROJECTILE_HALO_L` was a lightness floor *with no ceiling*. A threshold at 0.78 sends those eight
  dark instead: **1.76–4.63× on their worst background**, fifteen others unchanged to four decimals.
- **Audio:** the top three octaves did not exist (tilt −5.57 dB/oct, 86.2% of energy below 1 kHz).
  Now −5.07, duty cycle **21.9% → 58.6%**, plus a kitchen ambience bed. `generic.hurt()` alone was
  holding the game darker than the other fifteen sounds combined.
- **Menus:** key rebinding (35 assertions read off **sim state**), the levels UI, three more "shows a
  number the model does not compute" defects, design-system adoption on home + character select
  (`f5a6229`), `theme.ts`'s shared gaps (`3481d71`).

## The instruments — an earlier session's real output

**Nineteen instruments were caught returning confident wrong answers.** Each was fixed and validated
against a known-bad input. The most consequential:

| instrument | what it was doing |
|---|---|
| **the blind critic** | **±1.4-point floor; a round's two panels are n=1, not n=2.** The rubric alone is worth 2.0 points and there was no canonical one. |
| `scripted_player.mjs` | **`bestWeapon` skips `'self'` — the measurement cannot press heal.** Worth **50.6 pp** on Hamburger. ⚠️ **The roster was balanced twice against this.** (Now fixed — §5 correction 7.) |
| `feel_probe.diff()` | saturated: a fog hit (flash only) read 3904 px; a weapon hit (flash **plus the whole burst**) read 3879. The burst's real range is **6.31×**, not 1.66×. |
| `valuescan --mode gate` | served **stale JSON off disk** — reported 0/11 passing where HEAD was 11/11, and named the **wrong characters**. |
| one stale driver | copied into **ten** tools; a fourteenth born mid-audit. |
| `arena-scan` | ignored `PREVIEW_BASE`, silently measuring whatever was on port 5187. |
| `hud_fit` harness | missing `box-sizing`, so it reported "0 px overflow" against a real 15.1 px — **and `hud.ts` cited that number in a source comment as proof.** |
| `driver_guard` | its coverage **shrank** when a bug was fixed (49 → 41), because its census keyed off the bug's own fingerprint. |
| `limbcheck` | measures **22°** and a pose the player never sees; the match camera is **58°**. |

⚠️ **`limbcheck` vs `limbcheck_pitch`:** an earlier warning here said they are *"93.3% identical while
the latter's header claims byte-identity"*. **The warning OVERSTATED it.** Diffed directly: 25
differing lines, and the only **executable** differences are the pitch constant, one `console.log`
banner, and `&pitch=` on the URL. **`limbcheck` IS `limbcheck_pitch --pitch 22`**. The 93.3% was a
*line* count over a mostly-comment file — a similarity percentage over prose says nothing about
behaviour. **The real limitation stands:** at 58° idle passes go 8/11 → 0/11, idle *ranking* survives
(ρ 0.927) and **run ranking does not** (ρ 0.673).

⚠️ **And `limbcheck`'s caveat reads differently since `CLAUDE.md` #3 was rewritten:** **22° is within
two degrees of the LOBBY camera** (`charStage.ts` is `pitchDeg: 20`), so it was never measuring
nothing. It was answering the *other* question, and nobody noticed there were two cameras.

---

# 10. Older pending items, still open

## 🟠 Cast value ladder — the "regressions" are a RENDER commit, and the metric is wrong

**The old wording, kept because both halves are misleading:** *"`weakBoundaryPct` fails 5 of 11 — and
pizza 22.0 → 41.0 and waterbottle 22.9 → 53.9 got worse while the gate was frozen. `dlBelow10` fails
lollipop and sushi. The dl table is 171 of 198 rows."*

- 🚨 **They are not character regressions.** A 9-tree paired bisect puts **both** collapses inside
  `ce49cd3..47feb9a`, whose only character-rendering commit is **`086ff5f` — the key-light move that
  added a near-head-on 2.2 front fill.** One `src/render/` commit, not two `src/characters/` ones.
- 🚨 **`weakBoundaryPct` measures the wrong quantity** and **produced a FALSE FAIL and a FALSE PASS in
  one run** (egg 61.8% with a contact-local count of 0.0; hamburger PASSES at 4.3% with a contact
  count of 9.0). It gates on `dL = |p50(A) − p50(B)|` — the two parts' *whole-part medians* — while
  contacts are counted on a merged owner map. It disagrees with a contact-local step on **11 of 35
  live pairs**, including the pair producing **32.7 of pizza's 41.0 points**. It is also a **cliff,
  not a band** (a 0.0142 luma move once swung it 33 pp). **Steer on `minDL` (floor 0.0039) and the
  contact-local variant.** `dlBelow10` is **0 of 11** — that class is closed on merit.
- **burrito and sushi regressed too, and by more than pizza** — burrito head|torso 0.3605 →
  **0.0114**, sushi 0.2647 → **0.0403**. This file named neither.
- **The fix is already built and it is INVISIBLE.** `e6fed57` added a neck column plus a dark collar
  to 8 of 11 characters; at the shipped camera and facing it delivers **0 pixels** on burrito
  (565 px footprint), sushi (939 px) and soup (2199 px).
- **The 171 dl rows never existed on disk** — no `dl.rows.jsonl` anywhere, and all 17 `dl*.json` are
  **unstamped**. The untracked `tools/tmp/rigs_lg*.json` are not them.
- ✅ Drift control clean: `0529aa8` and `b967242` moved the cast's value ladder by **0.000**.
- ✅ Harness polarity **confirmed correct** — `--mode chars`/`--mode dl` drive the real game URL, not
  the inverted `preview.html`.

## ⚠️ The `valuescan --mode gate` trade — a CAST PASS TRADED `p05` FOR FIGURE/GROUND

The cleanest instance of `docs/LESSONS.md` §7 (local optima fighting each other) measured here:

| gate | before | after | |
|---|---|---|---|
| `p05` (dark anchor) | **11 of 11 FAIL** | **0 of 11** | ✅ fixed roster-wide |
| `range` | 6 of 11 FAIL | **0 of 11** | ✅ fixed |
| `dlBelow10` (figure/ground) | 1 of 11 FAIL | **6 of 11 FAIL** | 🔴 paid for it |

**17 failures fixed, 5 created. Arguably a good trade — but nobody chose it.**
**The mechanism, on `lollipop`:** `fig` is pinned at **0.497 at 17 of 18 stations** against a ground
at 0.40–0.48, so `dL` sits at 0.02–0.10 **by construction**. **Pulling a character's median into the
floor's own value band is what fixes `p05` and what destroys `dL`.**

⚠️ **6 of the 7 failures have `worstStn` = `fog_late` or `fog_boundary`** — stations where figure
*and* ground both collapse toward the veil colour. **That is an ARENA fix, not a cast fix.** Do not
send a character agent at a fog station.

⚠️ **A correction, kept.** The `lollipop`/`sushi` scare was closed here as *"not a regression"* on the
grounds that `1f51987` already recorded **lollipop 11 of 18 stations, sushi 6 of 18**. Still true
**for those two characters** — but it was written as if it closed the whole question, and across the
roster `dlBelow10` went from **2 characters failing pre-session to 6**. **Resolving the named instance
is not the same as resolving the class.**

## Concealment — the constraints that survive, now that it has shipped

⚠️ These were derived before placement and **all of them still bind**:

- 🚨 **The sim contains ZERO randomness.** Concealment expressed as an accuracy *roll* would destroy
  the determinism underwriting every balance number in the project. **Region membership** (the shape
  `terrainSlowFactor` already uses) is the only safe form, and is what shipped.
- 🚨 **`stepAI` has NO SEARCH.** It walks to the last-seen point, stops, and sees **84 wu** from
  there. At half that radius it re-acquires; at **double, it never does** — final separation 363 wu,
  never sighted. **A large patch is a permanent AI-denial zone**, so nothing may exceed ~**168 wu**
  across. This independently reproduces the reference GRAIN finding from the opposite direction:
  *dozens of small patches, not a few big masses.* ⚠️ **And building AI search is now PRICED rather than
merely unbuilt: `as_cost`'s ORACLE arm — `visible` forced true, a hard upper bound on anything a search
behaviour could buy — moves the aggregate +0.0 pp at 1400×1000 and is BIT-IDENTICAL, 0 of 110, at
2800×2000, on both policies (`d8b455d`). The ~168 wu cap is not a workaround for a missing feature; it
is why the feature would buy nothing.** **Big hero bushes stay off the table** unless
  someone builds AI search.
- **Our 21.36% cover share reproduces** (n=12 canonical stations, ablation-validated). ⚠️ **The
  "35–45%" reference has NO instrument anywhere in this repo** — it is one critic's prose about four
  plates, and *three of the plates do not show it*. **Do not tune to it.**
- **One rule the mechanic is built on:** *while you are concealed, nothing that tracks you updates.*
  All **three** `stepAI` sites are routed through it — separation, facing, and the direct
  `steer(..., player.x, player.y)` nav target — plus a **fourth outside `ai.ts`**: homing projectiles
  re-aim every tick, and the observer there is the *projectile*, so it stays symmetric between sides.
- **Attacking breaks the plate and reveals you** (`f0e7aed`). Two halves, deliberately separate:
  **destruction is about the OBJECT** (`breakConcealment` removes **every** standing region
  containing the attacker's centre, never the first — and it lives on `MatchState`, never on
  `arena.concealment`, because **one `ArenaDefinition` serves every match a process runs**);
  **reveal is about the FIGHTER** (`revealedUntil`, written at the press, above every outcome test).
  A `self` press does neither — Uri's word was *attacking*.
  **The duration is DERIVED:** `CONCEAL_ATTACK_REVEAL_MS = FLIGHT_MS.normal` (500 ms) — how long a
  shot takes to arrive. Deliberately **not** the firing weapon's own cooldown, which would make a
  fast weapon a strictly safer ambush. The test asserts the derivation, never the literal.
- 🚨 **The mutant that escaped is the lesson.** Of 14 mutants, *"breakConcealment breaks only the
  FIRST region"* passed **287/287** — because **the AI fires too**, and the enemy's own shot broke
  the second plate. **Asking about a fighter is never a neutral way to ask about a plate.**
- ⚠️ **`arena_probe --occl` and `--verify` were BLIND to concealment** — the series came from
  `arena.cover` only. Check their state before trusting either on a concealment question.

## Known, not started

- **Seven weapon files carry a stale copy of the generic size curve**, each documenting it as matching
  `game/vfx.ts` — a claim the re-derivation invalidated. **Soup's three impact hooks read `ctx.damage`
  nowhere (1.00×).** Needs per-weapon floors first, or small weapons drop under the ~300 px floor.
- `perf_tier.mjs` should be `perf.mjs --query`; the clone-census budget is a holding action.
- Skins need a per-character material-variant system that does not exist.
- Character select is **n=1** — packets `select2-c2..c6` are built and waiting for five more critics.

---

**Judgement calls live in `docs/DECISIONS-FOR-URI.md`** — read that first if you are Uri; it opens
with a four-row answer sheet. **New session? Read `CLAUDE.md`, then this file, then
`docs/LESSONS.md`.**
