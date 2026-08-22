# State — what is done, what is pending

**Every gate below was run against `85f1847`, 2026-08-22.** `node tools/verify-head.mjs` **OK** ·
`node tools/tmp/gatecount.mjs` **ZERO FAULTS** · `sim.test` and `economy.test` green ·
`node tools/tmp/wm_gate.mjs --ratchet` **fault set unchanged**.
⚠️ **HEAD moved to `23f8ce7` while this file was being written** (docs only — `CLAUDE.md` plus a new
`docs/HANDOVER.md`). That is not a footnote, it is the demonstration: **the SHA above is the tree
these words were verified against, not necessarily the tip.** Nothing checks this line; it has gone
stale five times now, always while every gate stayed green. Run `git log --oneline -1`.

✅ **THE DEPLOY IS CURRENT.** `origin/gh-pages` is **`cfdd6e0`** (2026-08-22 15:50) — *"spectator
camera, body-block, displacement weapons, Giant derived from the camera, 25% slower game"* — and the
newest `src/` commit anywhere is `f199ac8` (08-21 21:19). `git rev-list --count f199ac8..HEAD -- src/`
is **0**. **Everything in §2 is live for Uri to play.**

> 🚨 **AND HERE IS HOW THIS LINE NEARLY SHIPPED AS *"fifteen commits behind"*.** The first read of
> `git log origin/gh-pages` returned `b318eba` from **the previous day** — a **stale local ref**.
> `git fetch origin gh-pages` moved it forward by a whole deploy (`+ b318eba...cfdd6e0 (forced
> update)`). **`ac8bfa5` documented this exact trap this session** — *"the LOCAL gh-pages ref is
> stale, which is how the wrong 'before' gets picked up"* — and it was walked into anyway, one day
> later, by an agent that had read the commit. **`git fetch origin gh-pages` BEFORE you claim
> anything about the deployed build.**
> ⚠️ The deploy commit still records **no source SHA**, so identifying a deployed tree means matching
> bundle hashes. Worth fixing the next time anyone touches the deploy step.

⚠️ **`docs/HANDOVER.md` is new (`23f8ce7`) and carries its own "first screen".** It is a **snapshot of
the 2026-08-19 → 08-22 session and says so in its own header**; this file is the standing record.
**Two documents holding one first screen is precisely how six counts went stale in a single
session** — if they ever disagree, re-derive rather than picking one.

---

# 1. WHERE THIS PROJECT STANDS — the one screen

A real-time 3D brawler in Three.js. **It is playable end to end on desktop and on a phone**, six
seats are **reachable from the home screen**, and the simulation carries a fair spawn set, a scaling
endgame ring, a derived sudden death, a 3–6 seat payout curve, XP, a placement result card, a
tuning/admin layer and a wire codec for multiplayer.

Three sentences, honestly:

- **There is finally a score, and it is a three-point gap.** The blind round is **complete, 58 of 58,
  zero discarded**: **ours ~4.6–4.9 against a reference ~7.9–8.3**. It is the first score measured on
  the ×4 map. **It is a gap, not an improvement** — nothing here says the game got better on the
  axis a critic reads.
- **The instrument itself moved, and that is the most consequential finding of the session.** Four
  drift arms of **byte-identical 2026-08-05 pixels** re-read **0.330 to 1.003 points LOWER**, all
  four in the same direction. Any before/after spanning 2026-08-05 → now is confounded (§3.2).
- **Six-seat invisibility is this project's dominant defect class**, and it is still producing. Six
  named instances, **four of them closed since 2026-08-18**, every one correct at N=2 and silent at
  N=6 — which is the only seat count Uri plays.

| | where it is |
|---|---|
| shipped & reachable | 1v1 **and 2–6 seats via the lobby**, 11 characters, levels 1–15, economy, menus, touch, audio, phone perf, concealment, spectator camera, admin/tuning panel (behind `VITE_FA_ADMIN=1`) |
| shipped & inert | **five drawn telegraphs that cannot fire** — `waterbottle.Mega` is still the only weapon in the roster with a `castMs`, re-derived today (`a0370a0`, `edadf78`) |
| built & inert | multiplayer transport (`src/net/`) — **nothing under `src/` imports it**, re-derived on this tree |
| not started | skins, matchmaking, any mobile wrapper |

**Judgement calls live in `docs/DECISIONS-FOR-URI.md` (§1–§82), which opens with its own answer
sheet. This file points at it and does not restate it.** ⚠️ That page's live-question table is
maintained by whoever owns it; three of its rows are answered in the tree — see §4.

---

# 2. DONE — with the SHA and the number

Every row is a commit whose message carries the measurement. **Nothing here is a plan.**
§2b is the 2026-08-19 → 08-22 session, whose first commit is **`8f75ddc`**; §2a is everything that
landed between the last rewrite of this file (`e5fd816`, at `2d618a6`) and that session, **none of
which was ever recorded here.** ⚠️ **No commit count is quoted, on purpose** — `git rev-list --count`
answers it exactly and a typed count here would be wrong within the hour. It already moved once
while this paragraph was being written.

## 2a. 2026-08-12 → 08-18 — the work this file never mentioned

| | what changed | evidence |
|---|---|---|
| **the lobby** | seat count is a **screen**, reachable from home; `?fighters=` is no longer the only way in | `2d4840e` — and the prerequisite nobody had found: `shell.ts:parseRoute` **dropped `seats` on every `popstate`**, so a six-player match silently became a 1v1 after one Android back button, with nothing red anywhere. `DECISIONS §74` |
| **a dead player kept playing** | Uri: *"when I played 6 players and lost, I continued to move as dead, able to fire and move"* | `7a32f3d` — `sim.ts` had **no `alive` check anywhere on the human path**, while `ai.ts:stepAI` already refused on `hp <= 0`. A corpse could heal to full and win on the whistle. Unreachable below three seats |
| **the status chain lock** | Uri: *"you essentially lock him in place"*. Duty cycle **83.3% → 33.7%** (Noodle), 76.9% → 24.5% (Cheese) | `8a2d0de` — and the existing guard's own comment was TRUE and the WRONG BOUND: it bounded one unbroken application, never the duty cycle of a chain. The cooldown is a **sawtooth** — Cheese at 1300 ms locked harder than Glass at 1100 |
| **the admin/tuning panel** | every constant tunable, `DECISIONS §76`; 2,194 lines in `src/admin/` + three instruments | `c5b9754` `eb3e44d` `5f53bcc` — and the best thing in it is that the author **refused to commit for three hours** because its imports resolved to files a peer had never committed. `git archive HEAD` gave TS2307. That is `CLAUDE.md` #1 caught *before* the commit |
| **the wind-up programme** | §77 supers may be redesigned · §78 a wind-up costs POSITION not silence · §79 the lock is a KIT property · §80 a super must be DODGEABLE | `be2784a` `06e4e3e` `7034762` `48c8166` `f3bdeaf` `a756cd0` `3be074f` `eff6390` `1f17719` — the shipped 1100 ms wind-up was **1.83× its own derivation** because the rule read a CONE as a DISC (`12bd5fa`); §79's kit trim was **measured and NOT applied** because the price ends the character |
| **the scripted driver sees a wind-up** | `DRIVER_REV` 4 → **5**; §78's +19.7 pp re-priced to **+17.4** | `c441ac2` — ⚠️ this file said "rev 4" for a session |
| **fog canopy** | slid the wrong way; the pixels put its edge **154 wu** apart on one circle | `1691b75` |
| **camera shake** | **two thirds** of every kick came from something you cannot see | `d0a42ea` |
| **voices** | **80.6%** of every voice was scenery at a flat 0.32, and the floor guarded a case that cannot occur | `8ca8f88` |

## 2b. 2026-08-19 → 08-22 — this session

| | what changed | evidence |
|---|---|---|
| 🔴 **the whole game is 25% slower** | Uri: *"drop the bots as well. same rate."* `PLAYER_SPEED` 0.12 → **0.09**, chase 0.07 → 0.0525, flee 0.085 → 0.06375. **Both ratios held** (player/chase 1.7143, flee/chase 1.2143) | `fd83a5c` — the answer was the RATIO, not the number. Evade window **210 → 280 ms (+33.3%)**. `waterbottle.Mega.castMs` **followed its own derivation** 1100 → 1400 without an edit. **The price is in §3.4 and it is large** |
| 🔴 **you can body-block a shot** | projectiles resolved only against `state.fighters[p.targetId]` and flew through everybody else | `5c11427` — **bit-identical at two seats, 110/110 matchups, state and events**, so the 110-cell corpus every balance number rests on is unchanged by construction |
| 🔴 **a melee swing hits everyone in its arc** | a 360° `lollipop.Giant` slam hit **one** fighter | `3483d23` — same shape, same proof: 110/110 bit-identical at N=2. `wm_gate` had it recorded as `multi-target` MISSING |
| 🔴 **dying no longer pins you to your corpse** | killer-chain spectator ladder in `render/camera.ts:resolveViewSubject`; HUD, radar, weapon tray and the audio ear follow the subject | `30e3360` · HUD `18ba2a4` · wiring `605f374`. Measured `a9c6b5b` on detached worktrees of `7db3859`→`30e3360`: camera travel 3 s after death **0.00 wu → 87.64 wu**, and the 0.00 is **bit-zero** — a pinned build calls `follow()` with a frozen argument every frame |
| 🔴 **the giant slam is derived from the camera** | `REACH.ultimateSlam` **400 → 157.22** = `GUARANTEED_VISIBLE_RADIUS − BODY_LENGTH`, answering Uri's *"almost, but it shouldn't catch everything in the map"* | `afad1ca` — **shrinking it made Lollipop PLACE BETTER at six seats (3.313 → 3.013) while its WIN RATE FELL (13.3% → 7.3%)**. Different quantities, reported separately. 🔴 It also makes Lollipop the **weakest character at two seats, 25.0%** (§3.5) |
| **terrain slows anyone** | every bot walked through every puddle at full speed while the human crawled — one-tick control, **player 0.450000 / enemy 1.000000** | `b2be2f7` — fixed by DELETION: the body moved to `movement.ts:terrainSlowAt`, one implementation, two callers |
| **the trail boost reaches bots** | shipped **player 1.35 / bot 1.35**; pre-fix **1.35 / 1.00** | `f1e6c03` — 🚨 **it survived the pass that fixed the previous one.** `b2be2f7` edited the same expression a line away and did not look. *Fixing one instance of "a rule stated once in `rules.ts` and implemented twice" is not evidence about the next line* |
| **displacement exists** | knockback / lure / selfLaunch, absent on every weapon before this; **five authored a number, one was reverted, so FOUR carry it today** — re-counted in `rules.ts`: `egg.Tackle` selfLaunch · `sushi.Seaweed` lure · `sushi.Catch` lure · `hotdog.Ketchup` knockback | `a975567` built, `7582619` priced. Paired per-matchup **40 of 110 moved, mean \|Δ\| 8.2 pp**; the aggregate is inside its ~9 pp floor and says nothing. 🔴 **`waterbottle.Mega.selfLaunch` was BUILT then REVERTED at −9.0 / −11.2 pp**, the one field where both policies agree in sign and clear the floor |
| **the impact beat has an anchor** | the cast beat's anchor, given to the impact beat; then **subordinated** when it became the effect; then the two rescue rows fixed | `a42224c` (and 0.75 was the wrong number to copy) → `b3e3482` (**19 of 27** hits were mostly the shared burst, and the guard divided by the wrong denominator) → `f11b6c6` (they were not too small, they were drawn **inside** the target: 128 px → 682, 277 → 793, rescue 2 → 0) |
| **the slam's drawing follows the sim** | **260,963 px → 115,635** with **zero bytes changed under `src/vfx/`** | `8dc385c` — that file's founding constraint inverted. `679dd2b` then removed the visual nudge that made render and sim disagree once the sim moved struck fighters for real |
| **weapon cards stop lying** | `wm_gate` is a **standing gate**, not a report: 103 declared claims across 34 blurbs | `5888af0` `3030904` `ab734fa` — **23 faults / 13 blurbs → 13 faults / 7 blurbs**, re-derived on this tree today. ⚠️ **The famous "20 of 34" was never falsifiable** — the original audit had no closed vocabulary and counted similes and bare plurals as claims. **It is still quoted in `src/ui/screens/lobby.ts` and twice in `DECISIONS-FOR-URI.md`** |
| **the level is on the nameplate** | and `?level=`, the parameter documented as the way to reach a levelled fighter, **had never once worked** | `b6e53c1` |
| **soup and hamburger** | soup's liquid is one colour and its garnish rendered **0 px at every shipped camera**; hamburger's brows were **on top of his head** | `c9a2ed0` `9c23d56` `5708407` · `062513c` `569354e` `9450f72` |
| **the menus were paying a MATCH's pixel budget** | **17.3% of native**; portrait 458×202 → 734×324, upscale 2.40× → 1.50×, **zero extra draw calls** | `2fc072c` — `DECISIONS §82`. The cost is **+83.5 MB of GPU memory on home** and whether an iPhone minds **cannot be measured in this repo** |
| **the blind round, complete** | **58 of 58 scored, zero discarded**, every reference side inside the 7–9 validity band | `128a878` `a7f611c` `2315f55` `a86fe9b` `8f544fc` — run **one critic at a time** on Uri's instruction, interleaved with drift so drift is sampled on the same cadence as the signal |

## 🔴 Uri played it again, and it produced the session's spine

Seven owner reports on record. Two of them landed in this window, and between them they drove the
spectator-camera chain and the whole `qa_*`/`qb_*`/`qv*` investigation:

> *"when I played 6 players and lost, I continued to move as dead, able to fire and move."*
> *"a slight regression in VFX quality. home screen, and more specifically character screen seems
> like the resolution is slightly lower, or something else changed."*

The first was `7a32f3d`, and **its fix caused `30e3360`** — closing the input half froze the corpse's
position, turning *"you play on as a corpse"* into *"you watch your corpse"* for up to 150 s.
`sim.ts` recorded the consequence **at the site of its own fix** and routed it rather than reaching
into `match.ts`; that routing is why the spectator camera exists.

The second is the more instructive one, because **the thing he named was not the thing**:

- `789b01c` — the resolution path is **bit-identical across every deploy since 2026-08-11**.
- `b147e25` — the 1.25 cap is real and reproduces, and is **byte-identical on the 08-11, 08-18 and
  live 08-19 trees**, including the build he called *"feels ALOT better than before."*
- `8a1438f` — the character portrait is drawn at **0.416× the panel's linear resolution**, and has
  been **in every build ever deployed**. Reproducible to the digit, therefore not a regression.
- `ac8bfa5` — the lobby change bisects to **one commit, `062513c`**, and it is not resolution: the
  brows landed on the eyes. `aaf50e9`: **2.4× worse at the lobby camera than at the match camera**.

**Both halves of that are results.** A player naming a cause is naming a symptom; the report is
still the best instrument this project has, and the record is now **seven for seven**.

---

# 3. PENDING — ranked by what it unblocks, and what blocks it

## 🔴 1. Nobody has PLAYED the current build — and that is the highest-yield item on this page

The deploy is current (see the header), and **not one of §2b's changes has been through a human
yet**: the game is a quarter slower, dying puts you on a killer-chain camera, shots collide with
bodies, a slam hits everyone in its arc, and the Giant's reach fell 400 → 157.22. Every one of those
is a **feel** change, and this repo's record on feel is unambiguous — **seven owner reports, seven
real defects, none visible to any gate here**, two of them the spine of this session (§2).
**Blocked by:** nothing at all. `https://uri-onceuponyou.github.io/food-arena/` is live and is
`cfdd6e0`. ⚠️ **Do not spend agents re-deriving an aesthetic judgement a human is minutes from
making** — `docs/AGENT-BRIEF.md` §1b prices that mistake at ~1M tokens.

## 🔴 2. The critic instrument moved — **every cross-session before/after is confounded**

Four drift arms, **byte-identical 2026-08-05 sheets**, re-read now on distinct sheets only
(6-vs-6 floor **0.566**, the manifest's own formula):

| arm | 2026-08-05 | now | Δ | |
|---|---|---|---|---|
| `drift_base_arena` | 5.17 (n=6) | 4.167 | **−1.003** | CLEARS |
| `drift_base_cast` | 4.33 (n=6) | 3.500 | **−0.830** | CLEARS |
| `drift_cr1_arena` | 5.00 (n=6) | 4.167 | **−0.833** | CLEARS |
| `drift_cr1_cast` | 3.83 (n=6) | 3.500 | −0.330 | inside floor |

**All four move the same way on pixels that cannot have changed**, and three clear the floor.
⚠️ **Report it as a CANDIDATE, not a result.** `node tools/tmp/q1_sigma.mjs` measures σ = **0.649**
today (df 39, CI [0.526, 0.819] — excludes 0.50 *and* excludes 1.1), at which the 6-vs-6 floor is
0.734 and **only `base_arena` survives**; at the CI's upper end none do. Its §C confirms the
published σ = 0.50 **does** check out at its own source (pooled 0.501, df 26).
**Blocked by:** nothing but critics — 8-vs-8 on one drift arm settles it. Until then, **do not quote
any score delta that spans 2026-08-05 → now.**

## 🔴 3. The blind gap is measured, the round is closed, and **four cheap explanations are dead**

`node tools/tmp/q1_ledger.mjs` is the live table; the shape is ours ~4.6–4.9 against ref ~7.9–8.3.
Four hypotheses were tested and **every one came back null — all four closed by measurement, with
no scoring round spent:**

| hypothesis | result | |
|---|---|---|
| frame choice | **paired mean Δ 0.000** over 4 plate-matched pairs, against a 0.693 between-arms floor | `9585ed6` |
| prop density | **+0.00** across **13.0% → 24.9%** footprint; low arms 5.50, high arms 5.50 | `fd76ef0` |
| surface treatment | our ground carries **2.69× the hf detail of every reference plate** (ground-only median window, ours 0.01905 vs ref 0.00336–0.01005). **Texturing moves us AWAY** | `6c133ce` |
| subject scale | ref **8.4–14.2%** of frame height (median 12.4), ours **8.8–10.8%** (median 10.2) — **INSIDE** | `6c133ce` |

**The one live lead is a CAST property, not an arena one.** On the 2026-08-05 cast panel, one 35°
hue band holds **95.04% of chromatic pixels and 88.64% of the whole frame**; on the current cast
panel it is 75.14% / 73.30%; **on the arena it does not reproduce — 58.47%, three colour masses**
(58.47 / 23.01 / 11.08) (`dd7c5ce`). And `sbj_hue` finds every arena hue statistic **inside** the
reference range, less concentrated than three of the six plates (`6c133ce`).
⚠️ **Three critics named "washes together" and all three prescribed VALUE — the one axis already
working.** Measured Δluma **51.48 / 51.94 / 65.44 / 71.64** while hue sat at **0.82° / 1.68° /
15.2°**. The collapse is **figure-specific**: the same frame's other figure separates on both axes
at 66.9° of hue. *"Add hue separation"* is no more a global instruction than *"add value"* was.
**Blocked by:** the colour question sits inside `DECISIONS §73`, which **explicitly parks it**
pending Uri's read — `topCellsInCastBand` **0.296 → 0.648**, `hueSeparationDeg` **97.1**, and every
rail passes so nothing gates it.

## 🟠 4. §75's price: the roster got MORE polarised, and nothing has been paid back

`roster_lab --seeds 32`, 7,040 matches per policy, paired against a detached worktree of `f1e6c03`
(`fd83a5c`):

| policy | settled | aggregate | roster range | first contact |
|---|---|---|---|---|
| smart2 | **23 → 37 (+14)** | 67.4 → 65.7 | 42.7 → **50.5 pp** | 20.1 → 23.7 s |
| chase | **44 → 58 (+14)** | 42.1 → 48.2 | 63.3 → **75.6 pp** | 20.1 → 23.7 s |

**+14 settled matchups on BOTH policies is the number to read.** Both aggregates sit inside the
~9 pp floor while **97 of 110 paired cells moved (max 87.5 pp)** — the exact conflation `CLAUDE.md`
#10 warns about. **Blocked by:** `DECISIONS §77` forbids paying this back by re-tuning other
characters, so it needs a kit pass or Uri's word, not a constants sweep.

## 🟠 5. Lollipop is the weakest character in the game at two seats — **25.0% smart2**

The consequence of `afad1ca`, stated in its own commit. **Blocked by:** the same §77 rule. §79's kit
trim was **measured and refused** because the price ends the character (`f3bdeaf`). This is a design
decision with a number attached, not a tuning task.

## 🟠 6. 28 total wipes in 360 six-player matches where there were **0**

`nf_ffa --n 6 --rosters 60`, after §75: mean survivors at end **1.00 → 0.92**, deaths 1800 → 1828.
Every match still resolved (360/360, ko 360, timeout 0). `state.ts:lastFighterStanding` already
documents that state as *"a defensible outcome rather than a designed one"*.
**Blocked by:** it is a design question about the endgame. **Reported, not papered over** (`fd83a5c`).

## 🟠 7. `wm_gate`'s roadmap is a ranked build list, and it re-derives itself

`node tools/tmp/wm_gate.mjs` — **12 MISSING mechanics + 1 WRONG-VALUE across 7 blurbs**, re-derived
on this tree today. `MISSING` means no field, no state, no code: **that class is the roadmap.**
`status-strength` ×3 · `multi-target` ×2 · `projectile-destructible` · `ground-effect-damage` ·
`vision-block` · `status-cleared-by-damage` · `projectile-grows` · `summon-entity` ·
`merge-entities`. **Blocked by:** nothing. Each is a feature with a card already promising it.
⚠️ **That list is a re-derivation, not a record.** `--ratchet` is in the commit battery and
`tools/tmp/wm_ledger.json` is the durable form; **run the gate rather than trusting this paragraph**,
because the one thing every stale number in this repo had in common was being copied.

## 🟠 8. Concealment ships; its SIZE call is still open — `DECISIONS §29(a)`

**20 patches** (10 mirror pairs, 110–130 wu) — re-counted on the tree: 20 `addConceal` calls in
`src/arena/kitchen.ts`. The constraint is not free: `stepAI` **has no search**, sees
`CONCEAL_REVEAL_RADIUS` = 84 wu from where it last saw you, and at double that never re-acquires, so
**nothing may exceed ~168 wu across**. **Blocked by:** Uri's read of the size screenshot.
⚠️ And the feature is now **priced rather than merely unbuilt**: `as_cost`'s ORACLE arm — `visible`
forced true, a hard upper bound on anything an AI search could buy — moves the aggregate +0.0 pp at
1400×1000 and is **bit-identical, 0 of 110, at 2800×2000** on both policies (`d8b455d`).
**The ~168 wu cap is not a workaround for a missing feature; it is why the feature would buy nothing.**

## 🟡 9. The colour baseline predates **every commit in §2**

`tools/scan/colour-baseline.json` was generated **2026-08-12 at `072f245`**. All 11 rails pass —
warm 0.0596 → **0.0823** — which its own header calls **the risk it carries, not a victory lap**:
*"a gate that never fires is a gate nobody reads."* Re-baseline before steering on any colour rail.
🚨 **And `CLAUDE.md`'s "warm is the scarce budget today" block is STALE** — it cites `DECISIONS §73`,
which is **the section that retired it** (`6c133ce` found this and routed it; `CLAUDE.md` has another
owner). The old reading came from a baseline pinned **61 commits before the ×4 map**.

## 🟡 10. Instrument and hygiene debt, no owner

- **`hl_sweep` is still `INSTRUMENT INVALID` on one arm — `SWAP`.** `gatecount`'s row today reads
  *"fails on every weapon measured"*; every other control passes over a full-roster run, and the one
  diagnosed case (`waterbottle.Cap` — 4 pellets at 104.5 wu overrunning a 130 wu patch) is a
  **harness coverage defect, not a game defect**. ⚠️ **Do not quote a `SWAP` count without re-running
  it** — it is the slowest browser gate here.
  ⚠️ *This bullet used to add "three different figures for it are in the tree and they do not agree
  — 12 of 23 / 12 of 22".* Left as the reason the count is not repeated here.
- **`taco.ts`'s citation of `rig.ts` has now drifted THREE times.** It shipped `602`/`630`, was
  corrected to `811`/`838` at `072f245`, and today the head shrink and the head mount are at
  **`809–812`** and **`837`**. 🚨 **Stop citing line numbers.** The durable coordinates are the
  symbols: the `headH = Math.max(...)` block and the `this.headCentreY = ...` assignment, both inside
  the `// ── The neck gap, and the head shrink that PAYS for it ──` section. `9019142` records an
  earlier attempt to fix this class by *adding a symbol next to the number*; the number drifted
  again within a day.
- **Soup's three `impact(ctx)` hooks read `ctx.damage` nowhere** — re-derived: three hooks in
  `src/vfx/weapons/soup.ts`, zero occurrences of `ctx.damage` in the file. Needs per-weapon floors
  first, or small weapons drop under the ~300 px floor.
- `x4_shot` prints which spawn bays have no screenshot station within `SPAWN_TAG_WU` (200 wu) — a
  coverage note it is **designed to print**, not a failure. ⚠️ **This circulated as an `sx_fog`
  defect and `sx_fog` has no spawn-bay arm at all.**
- `perf_tier.mjs` should be `perf.mjs --query`; the clone-census budget is a holding action.
- Skins need a per-character material-variant system that does not exist.
- Character select is **n=1** — packets `select2-c2..c6` are built and waiting for five more critics.

---

# 4. NEEDS URI — **nothing is blocking**, and this file does not restate the page

Every parked call is in `docs/DECISIONS-FOR-URI.md`, which opens with its own live-question table.
Two things this file adds, both re-derived against the tree rather than read off that page:

1. **Three of its "open" rows were answered in the tree, in the copy I read** (that page has its own
   owner and may already be updated): `§66` (six-player entry) — **the lobby ships and `home.ts`
   navigates to it**; `§81` (the giant slam) — **answered by Uri 2026-08-21 and landed as
   `afad1ca`**; `§33` (the phone) — **answered, `d1a4f6c`, iPhone 15 Pro / iOS 26.5.2, worst frame
   618.33 → 33.33 ms.** The genuinely live ones are **§82** (look at the character screen for one
   minute) and **§71** (three icon subjects, where *"leave it"* is a legitimate answer for all
   three), plus **§29(a)** and **§73** named in §3 above.
2. **The standing one, and it is §3.1.** Seven owner reports, seven real defects, **none visible to
   any gate here.** The two from this session drove the entire spectator-camera chain *and* the
   whole `qa_*`/`qb_*`/`qv*` investigation. **A current build is deployed for exactly that** —
   `cfdd6e0`, carrying every feel change in §2b, none of which a human has played.

---

# 5. CORRECTIONS — what this file said that turned out to be FALSE

House style: **keep the wrong wording next to the right one.** Every entry was believed on the
strength of a method rather than a measurement.

### Closed by work that landed — the old wording, and why it is gone

1. 🚨 **This file's #1 pending item read: *"Six-player has no entry point — one answer unblocks five
   shipped systems… `matchScreen` always builds two seats."* CLOSED.** `2d4840e` made the seat count
   a screen; `src/ui/screens/lobby.ts` ships, `main.ts` routes `?screen=lobby`, and `home.ts` carries
   a button labelled *"Match lobby — choose how many players are in the match"*. The payout curve,
   placement XP, the result card, `minSafeRadiusFor(N)` and the seat-fairness work are all reachable.

2. 🚨 **This file's #2 pending item read: *"the six-fighter result card is 705 px wide at 430×932 —
   the winner is off-screen. No owner."* IT WAS ALREADY CLOSED BY THE COMMIT ITS OWN DONE TABLE
   CITED.** `72d6c36` landed the bound and measured 126 cards; the same table two sections above
   listed it as done. **One file disagreed with itself, and either half could be "confirmed" by
   reading the other** — the exact failure `gatecount` exists to prevent in the two files it reads,
   and **it does not read this one.**

3. 🚨 **This file said: *"at the shipped constants `minSafeRadiusFor`'s result is never reached —
   `SUDDEN_DEATH_MS` collapses the ring 9.6–11.8 s before the schedule would arrive."* REVERSED, and
   `rules.ts` says so at the function itself.** `fogRadiusAt` now interpolates to that value and
   lands on it at `FOG_CLOSE_MS` = 120 s; sudden death is **derived**, `FOG_CLOSE_MS +
   SUDDEN_DEATH_GRACE_MS` = **135 s**, and the ring **stands on the final circle for a full 15 s**.
   **That a documented dead branch turned out to be a player-visible defect is the whole reason the
   fog pass exists.** Consequently this file's *"Sudden death fires at 30 s. Right?"* question and its
   *"ring collapses at 30 s"* DONE row are both retired.
   ⚠️ `SUDDEN_DEATH_MS` is registered with `deriveds()`, so `{ SUDDEN_DEATH_MS: 5 }` is a **compile
   error** — §76 constraint 2 verbatim: *"a panel that let you type it would un-fix the exact bug he
   found by playing."*

4. ⚠️ **This file said `n2_geom --ids all --knownbad sort` *"fails 3 checks"*. It passes, 0 failed** —
   re-run on this tree today, exactly as written above.

5. ⚠️ **This file said `ic_spec`'s documented number *"is 16, because that is what a clean machine
   reproduces"*, with two paragraphs explaining why. It MOVED** (`369ae51`), and the explanation went
   with it. 🚨 **The new value is deliberately not written here.** That bullet was this file's
   textbook offence — an unpoliced second copy of a gate count sitting under three separate sentences
   saying such a thing could not happen, because `gatecount` reads `CLAUDE.md` and `docs/TOOLS.md`
   **and nothing else**. The count lives in `docs/TOOLS.md`'s gate table. Run the gate.

6. ⚠️ **This file said `cloneToon` has *"16 call sites"*. It has TEN.** Re-derived: 16 is the number
   of times the token appears anywhere under `src/` — 10 calls (9 in `arena/floor.ts`, 1 in
   `arena/props/counters.ts`), plus the definition, two imports and three comments. **A textual
   occurrence count was published as a call-site count.**

7. ⚠️ **This file's *"17 faults across 10 blurbs"* and its own correction *"the gate re-derives it as
   13"* are BOTH stale** — the fault set moved twice more after each was written. The live figure is
   in §3.7 and the durable one is `tools/tmp/wm_ledger.json`. **And the "20 of 34" that started all
   this was never falsifiable** — the original audit had no closed vocabulary — yet it is *still*
   quoted in `src/ui/screens/lobby.ts` and twice in `DECISIONS-FOR-URI.md`. **A number that cannot be
   re-derived outlives every correction issued against it.**

8. ⚠️ **This file said the scripted driver is at `DRIVER_REV = 4`. It is 5** (`c441ac2`), and the
   revision exists because the driver can now **see a wind-up**, which re-priced §78 from +19.7 pp
   to +17.4.

9. ⚠️ **Two entries this file carried for months as open are CLOSED**, and the old wording is kept
   here on purpose: *"The scripted player cannot heal… one line in `scripted_player.mjs`"* — the
   driver is at `DRIVER_REV = 5`, the heal sits on a branch ahead of the offensive ranking, and
   **both faults are guarded** (`node tools/tmp/driver_guard.mjs`, in the commit battery). And
   *"Kitchen concealment — approved by Uri, unstarted… the largest single item waiting"* — 20 patches
   ship (`b9bc00e`, extended in `6631446`); only `DECISIONS §29(a)`, the size read, is open (§3.8).

### From the orchestrator (the main conversation) — the standing record

Six falsifiable claims were published in one earlier session and **every one was wrong**; agents
caught five, always by re-deriving rather than pasting. That record continued this session, and the
sharpest entries are worth carrying because the mechanisms differ:

10. 🚨 ***"`level_lab` is pinned at its ceiling."* FALSE** — 40 of 110 cells unsaturated, the full
    grid moves 55.00% → 99.32%. One hand-picked cell had saturated and it was generalised to the
    instrument.
11. 🚨 ***"`git archive HEAD` is the clean-tree method."* WRONG TREE** — five gates shell out to
    `git` and die without a `.git`: **8 faults where a real worktree reports 2, a wrong CAUSE.**
12. 🚨 ***"`hl_sweep`'s fix emptied its own validator corpus."* FALSE — the corpus was never empty**;
    the default split stopped partitioning it, because two files split on colours that are equal only
    while the bug exists.
13. 🚨 ***"The rank comes out of the sim's final state."* IT CANNOT** — every loser ends `hp:0,
    deaths:1` identically. The order is in the **death event stream**.
14. 🚨 **A patch routed as ready — `.map(s => roster[s]).filter(Boolean)` — silently DROPS fighters.**
15. ⚠️ **A resolution floor circulated as *"main-thread JS ±1.28–1.76 ms"* DOES NOT EXIST.** The
    measured figure, from a null arm, is **±0.71 ms** (`DECISIONS §62`).
16. ⚠️ **This session's briefs carried *"the critic drift arms read 0.5 to 1.0 points lower"* and
    *"one hue owns 88% of the cast frame at R > 0.995."*** The first is a rounding of **0.330 to
    1.003**; the second's band and direction reproduce exactly but **`R > 0.995` does not** — two
    independent tools measure **0.9579** and **0.8762**, and the 88% belongs to the **2026-08-05**
    cast panel, not the current one (73.30%).

### And one older correction, kept because it reads as settled

⚠️ **`bd068d0`'s commit message garbles §48's fixture** — it says the fixture was *"right about the
mechanism and wrong about its size by 5×"*, which conflates the first-contact row (**near-exact**:
predicted +12.77 s, measured +12.75 s) with the win-rate row (5.15× too large). Amend is forbidden,
so the correction lives here: **the split is measured-vs-inferred, not mechanism-vs-size.**

---

# 6. 🚨 THE DOMINANT LESSONS

## Controls that could not fail — none of them caught by another check

⚠️ **The count is in `docs/LESSONS.md` §17 and deliberately not repeated here** — it was written as
seven, nine and ten in four files describing one enumeration, which is exactly the defect §17 is
about. **Every one was found by an agent re-deriving something it had been told was already true.**

1. a fixture pointing at **a herb crate**; an "axis mirror" mirroring about **the old centre**
2. a known-bad placed **where the bug could not express itself**, so both arms passed
3. `[].every()` returning `true` after a fix **emptied the filtered set** — three times, three files
4. a differ blinded to a field that **had nothing to drop yet**
5. a wrong-base demo **inside the countdown**, where nothing moves
6. a sentinel written onto a field **already holding it**
7. a call-site census counting the **function declaration** as a call site
8. a suite reporting **227 passed, unchanged**, straight through a feature rewrite it could not see
9. **two arms of ONE instrument false BY CONSTRUCTION** — a rendered frame's *luma* against a
   material's *colour*, so one threshold cut through a single continuous population

> ### A passing test is not evidence the thing it points at is right.
> **`--selftest` validates a tool's LOGIC. It never validates where the tool is POINTED.**
> `valuescan` read a **fully green** selftest while **14 of its 18 stations** were in the wrong
> quadrant and eleven stood inside solid props. (The selftest's count is a gate-table number and is
> deliberately not repeated here — see §5 correction 5 for why this file is the wrong place for one.)

## Six-seat invisibility is the dominant DEFECT class, and it kept producing

**Six named instances**, four closed since 2026-08-18, and the shape is identical every time:
**at N=2 the correct sentence and the buggy sentence NAME THE SAME FIGHTER.**

| | |
|---|---|
| the result card | slot-ordered loser list |
| corpse input | `sim.ts` had no `alive` check on the human path (`7a32f3d`) |
| shake proximity | centred on the local seat, not the view subject (`30e3360`) |
| seat order | — |
| **melee single-target** | a 360° slam hit one fighter (`3483d23`) |
| **projectile single-target** | shots flew through every body but the target's (`5c11427`) |

⚠️ **And the camera POLICY is not a two-seat question either**: of five wrong policies,
**3 of 5 are completely invisible at N=2** on the observable a player can see (`30e3360`, arm C).
The first version of that arm reported 4 of 5 caught — **on an instrumentation field**.

## Three separate ways to be flatteringly wrong about `n`, in ONE round

All three were the orchestrator's, all three erred in the flattering direction (`8f544fc`):

- a **k=2 fallback** claiming more confidence than two observations support;
- **SKIPPED rows counted toward `k`** — and the committed record could not reproduce its own floors,
  because `skipped` lived only in the gitignored half (`5cd3fb6`);
- **repeated sheets counted as independent** — `DRIFT_ORDER = [1,2,3,4,5,6,1,2]` is 8 seats over
  **6 distinct images, by design**, so a published floor of 0.490 rested on an honest 0.566.

⚠️ **The MEANS are unaffected** (4.125 → 4.167 on the worst cell). **A floor error is not a score
error, and conflating the two would be a fourth way.**

## The map change hid for a whole session because every stale coordinate stayed LEGAL

> **The 1× playfield is exactly the NW quadrant of the ×4 one.**

No legality check could have found that class. Eleven were found one at a time by accident; a
systematic sweep then found **12 more at a 0.5% false-positive rate**, plus 63 enumerated and frozen.
`tools/tmp/al_guard.mjs` now catches it. ⚠️ **Another resize is "safer, not safe"** — dozens of files
hold a hardcoded 2800 or 1985, so today's correct literals are the next generation's stale ones.
The worst instances are worth naming because each one *passed*: `match-play.mjs` sent hands **1,077 wu
inside the NW quadrant**; `h49_chips` spawned **2 of 6 seats outside the ring**; and `x4_layout`
printed **✅ EVERY CHECK PASSED**, with a fully green `--selftest`, on the stale spawn table — because
the old seats really were legal, symmetric, 892 wu apart and in one nav component.
🚨 **Legality is not fairness.**

## Verify, do not paste

The orchestrator has now published wrong claims in three consecutive sessions and **agents caught
almost all of them, every time by re-deriving instead of accepting** (§5). **Keep saying so in every
brief. It is the highest-yield sentence in the agent template.**

---

# 7. Resolution floors — state one before acting on a change in it

| quantity | floor |
|---|---|
| aggregate win rate | **~9 pp** |
| pacing | ~0.8 s of contact / ~4 pp dead time |
| blind critic, published | **±1.4 points** (σ = 0.50; a round's two panels are **n=1, not n=2**) |
| blind critic, per-arm | `q1-manifest.json:floors` — **1.386** at k=1, 0.800 at k=3, 0.693 at k=4, **0.566 at k=6**, 0.490 at k=8, **0.529 between an 8-arm and a 6-arm** |
| FFA mean placement | **0.978 places** single-phase (`nf_ffa`); ~0.32 pooled over 11,088 matches |
| seat spread | **0.315 places** — a **label permutation** over 4,000 reps, **NOT a standard error** |
| main-thread JS | **±0.71 ms**, from a null arm |
| draw counts | **EXACT** |
| paired per-matchup delta on identical seeds | **EXACT — and a DIFFERENT QUANTITY from an aggregate** |

🚨 **Report the paired and the aggregate separately, always.** `roster_table`'s aggregate once moved
0.8 pp — inside the floor — while **58 of 110 matchups moved, max 34.4 pp**. `fd83a5c` is the same
shape at larger scale: both aggregates inside ~9 pp while **97 of 110 cells moved, max 87.5 pp**.

⚠️ **`k` IS DISTINCT OBSERVATIONS OF THE ARTWORK, NOT SCORED ROWS.** Two reads of one file are two
observations **of the critic**. See §6.

⚠️ **Every one of these floors was discovered AFTER someone had already acted inside it.**

---
---

# ARCHIVE — the record up to and including 2026-08-12

🔴 **READ THIS BEFORE THE SECTIONS BELOW.** Everything from here down is kept because it is the only
record of *why* several numbers are what they are. **It is stale in four specific ways, and none of
them is marked inline:**

- **Every arena, frame and composition measurement below was taken on the 1400×1000 map** with ~96
  props. The map is now **2800×2000 with 111 props at lower density**. The *diagnoses* mostly
  survive; **the numbers do not.**
- **Every payout figure below assumes the two-outcome (win/lose) model.** Payouts are now a **3–6
  seat curve on normalised rank, plus XP**.
- **Every score below is on the OLD reading of the instrument**, which §3.2 says has moved by up to
  a point on unchanged pixels.
- **Two long-standing "still open" items that used to live down here are CLOSED** (§5 correction 9):
  *"the scripted player cannot heal"* (the driver is at `DRIVER_REV = 5` and `driver_guard.mjs` is in
  the commit battery for exactly that fault) and *"kitchen concealment — unstarted, the largest single
  item waiting"* (20 patches ship; only the SIZE call is open, §3.8). **Their old wording is quoted in
  §5 rather than left to be re-derived.**

---

# 8. Where the game stood on score (measured pre-×4, `56ccb62`)

The blind-critic instrument was audited and rebuilt: a canonical rubric (`tools/review.rubric.txt`),
top-down plates for gameplay, action frames rather than idle ones, menus scored against menus, and a
measured floor of ±1.4 points. 43 rounds, 43 valid.

| element | ours | sd | reference | gap in **floors** |
|---|---|---|---|---|
| **cast in match** | **4.33** | 0.52 | 8.00 | **6.5** |
| arena (action frame) | 5.17 | 0.41 | 8.33 | 5.6 |
| home | 5.17 | 0.41 | 8.50 | 5.9 |
| in-match HUD | 5.67 | 0.52 | 8.33 | 4.6 |
| character select | 7.00 | *n=1* | 8.00 | not a result |

**The bar is 7+.** Calibration: over 34 observations the critic **never scores shipped Brawl Stars
above 9**, typically 8–8.5. ⚠️ **Do not splice these onto the older series** (arena 5.33/4.0/3.875/6.0,
characters 3.6/3.25/3.0/2.0) — different rubric, plates, frame content and n. And note what the audit
proved about that series: **its largest single step was 1.0 — inside the floor. "The characters got
worse" was never an observation.**

## The finding that dominated: "surfaces are flat and unlit"

**6/6** critics on HUD, **6/6** home, **5/6** select, **4/6** arena. Two said it unprompted:

> *"the playfield looks like coloured paper **while the HUD looks shipped**"*

## 🚨 THE SESSION THAT MOVED EVERY OBJECTIVE METRIC AND ZERO POINTS OF SCORE

22 fresh critics, 22 valid rounds, canonical rubric. Arena 5.17 → **5.00** (floor 0.60, **NO**);
cast 4.33 → **3.83** (floor 0.53, **NO**). **`hi70` moved 4.7 floors — 2.40% → 13.58%, past the
reference median — and the score moved nothing.** That was the acceptance test defined before round
1, honestly measured, and passed convincingly. **It was not the binding constraint.**
`docs/LESSONS.md` §7 in its purest form.

⚠️ The drift control in that same session read **0.42 / 0.58 lower** on byte-identical sheets at
1.30σ and 1.80σ — *suggestive, not established*, and it explicitly asked for 8 critics per arm to
settle it. **§3.2 is that experiment, run.**

## ✅ THE FLOOR WAS PROBED AND THE CRITICS' MECHANISM WAS FALSIFIED — `ac08dbf`

**Nothing was changed, deliberately.** 8 fresh action frames on a frozen snapshot against the 6
`gameplay_topdown` plates, ground-only masks computed identically both sides.

| metric | reference band | ours | verdict |
|---|---|---|---|
| `mf` 3–12 px | 0.00930–0.02414 | 0.01535–0.01918 | **1.07× — the reference MEDIAN** |
| `lf` 12–48 px | 0.01095–0.03989 | 0.01749–0.01957 | **1.01× — the reference MEDIAN** |
| `hf` 1–3 px | 0.00336–0.01005 | 0.01283–0.01572 | 1.92×, against a 2.08× acuity handicap ⇒ **parity** |
| **`oriAll`** | 0.229–0.351 | **0.421–0.547** | **1.55× — NON-OVERLAPPING** |

🚨 **"No surface detail" is FALSE.** ⚠️ **And `6c133ce` re-ran this class on the ×4 map and made it
sharper: ground-only `hf` is 2.69× ABOVE the whole reference range and `mf` 1.81× above.**
**Texturing the ground moves us AWAY from the reference. That road is closed.**

**The one real out-of-band thing is that our ground is a LATTICE** — repeating at 100–107 × 80–86 px,
autocorrelation 0.55–0.82, while five of six plates have no periodic ground repeat at all.
⚠️ On the current scored panel `oriTop2` measures **INSIDE** the reference band, so *"repeating
lattice"* is no longer anomalous on that statistic; `oriAll` is still 1.52× above. ⚠️ **`oriAll` has
NO measured resolution floor** — frame-to-frame spread ~0.08 (ours) and ~0.12 (plates) against a
0.13 gap. **Established in direction, not in magnitude.**

## The mechanism behind "flat and unlit": the game drew no highlights

**Three independent probes converged** — the *ninth* consecutive plateau that turned out to be a bug:

| probe | measured | says |
|---|---|---|
| p1 | Fresnel rim reaches **1.402% of pixels**; 33 of 112 lit materials carry it | the edge-highlight term is **missing** |
| p2 | prop surfaces carry **one flat value per face** | the form-highlight is **missing** |
| p6 | share of playfield above luma 0.80: ours **0.67–1.68%** vs reference **2.39–19.06%** | **nothing bright is ever drawn** |

### ✅ LANDED — `c90c9ea` · `ecd07fa` · `e4734e2`

`hi70` 2.40% → **13.58%** (4.7 floors; reference min 6.65, median 9.40) · playfield p95 0.6616 →
**0.7725** · live rims 71/112 → **93/112** · rim corpses **22 → 0** · cast `centreContrast` (paired,
exact) 0.0426 → **0.0516** · `arena-scan` meanSat 0.4657 → **0.4877**.
⚠️ **`clippedHighPct` is NOT a concern** — reference 1.36–16.36% against ours 0.379% → 0.434%.

### 🚨 Root cause — `Material.clone()` silently drops `onBeforeCompile`

`three/src/materials/Material.js` `copy()` names 40+ properties and **not** `onBeforeCompile`.
`applyRimLight` is called from exactly **one** site (`toon.ts`, inside `toonMat`) and nothing
re-applies it after a clone, so the arena's whole cloned palette rendered with **no rim** — the term
`toon.ts` itself calls *"the single largest material lever in the frame."*
**Smoking gun:** `kpal:woodPad` appeared **twice in one frame under the same name** — the original
with the rim (0.805% of frame), its clone without (2.501%).

✅ **Fixed with `cloneToon()` in `src/render/toon.ts` — TEN call sites today** (§5 correction 6; this
line read "16" for a session and 16 is the token's total textual occurrence count).
⚠️ **Not the ground plane** — `src/arena/apron.ts` passes `rim: false` on purpose.
`node tools/tmp/clonetoon_test.mjs` is a registered gate.

### ⚠️ Lead 1 (the contact decal) is FALSIFIED — a category error

**The old wording, kept so nobody re-derives it:** *"Raise `src/arena/`'s baked contact decal ~2.5×.
It sits at |dL| 0.0491 against a 0.1238 reference measured off real barrels."*
**0.0491 and 0.1238 are different quantities** — an ablation delta of one layer over 0–0.15 m against
a total shipped contact contrast over 0–0.25 m. Like-for-like, **ours already matches or exceeds the
reference** (0.1415 / 0.2181 against 0.1238), and there is no 2.5× in the knob: opacity headroom
**1.11×**, darkness headroom **1.14×**. The layer doing the grounding work is the **shadow map**.
**Do not spend a round on this.**

### Lead 2 (SSAO) — worse than recorded

`useAO` has no live call path, but its draw cost is bounded exactly: **+395 draws (+94%), +99%
triangles.** An `EffectAttribute`-based approximation in the existing post chain is the cheaper route.

### Lead 3 (`glossyMat` has no rim) — real, and gated

Two facts to carry: **52.6% of the cast (20 of 38) is authored at roughness ≥0.6**, where specular
headroom has already collapsed 10×; and **`material.envMapIntensity` is silently discarded**.
Assigning `material.envMap = scene.environment` is a **provable no-op at the scene's own 0.32**, and
at ×2 it behaves as **flat ambient, not sheen** (floor p05 0.248 → 0.361 while range 0.307 → 0.263:
it washes the darks). **It is not a sheen control.**

### The composition census nobody had

**18.39% of a gameplay frame is `MeshBasicMaterial`** — zero specular, zero rim, zero diffuse
falloff, zero shadow receive. **140 of 255 materials are Basic**, the largest single unlit surface
being `hazard:glow` at 11.68%. **63.44% of the frame is a flat ground plane**, with **zero
normalMaps project-wide**. ⚠️ But the reference argues for restraint: `bs_04`'s ground is *also* a
smooth flat plane — what stops it reading as paper is **prop density and a dark offset contact under
every object**, not surface detail. ⚠️ **And `fd76ef0` then falsified the density half on score:
13.0% → 24.9% footprint moves the blind read by +0.00.**

### And the orchestrator's own frame read was REFUTED on both halves

It eyeballed a frame and claimed the character was *"~5% of frame height"* and *"the right-hand third
is empty tile"*. Measured (`cr_geom.mjs`, 17/17 selftest): character height **10.6–12.6%** against
plates at 11.7–14.4% — **the eyeball was wrong by ~2×**; per-third occupancy L 33.6 / C 47.6 / R 38.7,
min-third ÷ whole **0.825** against a plate band of 0.712–0.918. ⚠️ **And the frame looked at was the
wrong artefact entirely** — a `kneeprice` probe frame with no HUD, no opponent, no VFX.
**But the perception was picking up something real the metric cannot express:** occupancy scores one
big value-varied slab the same as many small props.
⚠️ **`6c133ce` later measured the subject-scale question properly and closed it: ref 8.4–14.2%
(median 12.4), ours 8.8–10.8% (median 10.2) — INSIDE.**

---

# 9. DONE up to 2026-08-12 — gameplay, presentation, instruments

## Gameplay

- **All six 🔴 bugs** fixed (the clock ended nothing · trail marks stacked an 87 HP one-frame kill ·
  melee at distance 0 ignored facing · a fighter inside the pot was 0.0% visible · the radar showed
  no zone · match duration ~7× too long).
- **Five AI driver bugs**, every one the same shape — *a rule stated once in `rules.ts` and
  implemented differently elsewhere*: a stun silenced the AI (the stunned player fired 100% of its
  shots, the stunned AI 0%); both drivers ranked weapons by authored `damage` (which is per-*pellet*);
  a melee-only AI had nothing to fire when fleeing; the flee branch aimed **away** from the player and
  fired along it. ⚠️ **The fifth — the terrain slow reaching only the player — was CLOSED this
  session (`b2be2f7`), and a SIXTH and SEVENTH of the same shape were then found**: the trail boost
  (`f1e6c03`) and the corpse's missing `alive` check (`7a32f3d`).
- **×4 arena** — `ARENA_W/H` 1400×1000 → **2800×2000**, six spawns in three bays, **111 props at
  *lower* density** (`6631446`; the acceptance test whose own header said *"it goes away when §48's
  arena lands, not before"* reports 37/37).
- **Seat fairness** — spawn advantage **2.680 → 0.342 places** of 6; all six seats deal damage in
  **600/600** (was 74.5%) (`2d3e9bd`). The quantity that had to be equal was **in-degree of the t=0
  targeting digraph**, not radius and not spacing; both obvious alternatives were falsified *by
  construction*.
- **Endgame ring** — `minSafeRadiusFor(N)` = **140** at N≤4, **187.42** at N=5, **237.00** at N=6
  (`4bb64e4`; N=2 proved a no-op over 45,959,702 ticks / 12,503,511 in-order events / 0 divergent).
  **These values are current** — re-read off `rules.ts` today.
- **The fog schedule** — `FOG_HOLD_MS` 25 s · `FOG_CLOSE_MS` 120 s · `SUDDEN_DEATH_MS` **derived** ·
  clock 150 s; arrival proved at 120.00 s for every N=2..6 (`6d5c4d6`, `DECISIONS §72`).
- **Payouts** — 3–6 seat curve on **normalised** rank, + XP, **+ it reaches the game**
  (`721ce3c` `a588066` `bb00d66`; a 3rd-of-6 finish had been paid as a 1v1 loss).
- **Result card** — placement, **real elimination order**, payout chips, and a width bound
  (`7743f08` `e60117d` `72d6c36`; the loser list was slot-ordered, and 40 of 112 cards overflowed
  **from three seats**).
- **Ranged reach** — **23 of 23 → 2 of 23** weapons cannot connect at their own press gate
  (`af35362` `a9da836`); `range` was two quantities wearing one number.
- **Roster** — range **27.8 → 9.8 pp**, tier spread 16.2 → 6.1, sd 7.1 → 3.1, **no mechanic touched**
  (`33318a1`). ⚠️ **§75 has since re-opened this — see §3.4.**
- **Concealment** — 20 patches (10 mirror pairs, 110–130 wu), three kitchen kinds, walk-through,
  breakable (`b9bc00e`, `6631446`).
- **Unreachable floor** — **14 gaps in 7 mirror pairs**, wider than a drawn body and narrower than
  `PLAYER_SIZE` (`b9bc00e`). **The threshold is the NARROWEST character (19.1 wu), not the average
  one**; a first pass at 26 wu declared the kitchen clean while six were still open.
- **Phone** — draw calls **928 → 423 (−54.4%)**, main thread **−47.9%** against a **±0.71 ms** floor
  (`5aa4655`); 1,908 static props merged to one mesh per material, shadow casters 1,657 → 186.
  ⚠️ **Triangles ROSE** 1.09 M → 1.52 M (+38.6%); the win is object count, not geometry.
- **Phone, on the real device** — iPhone 15 Pro / iOS 26.5.2, two paired captures: **worst frame
  618.33 → 33.33 ms**, max == p99 (`d1a4f6c`). ⚠️ It reads the CAPTURE pipeline: **proves jank,
  cannot prove smoothness**, and **both captures are PORTRAIT**.
- **Landscape UI** — weapon tray hides **7.92% → 0.00%** of guaranteed-visible arena; clock 13.12% →
  0.49%; all controls 22.6% → 4.3% at 844×390 (`bd39464` `b2f2cb1` `f1f2a40` `845716a`).
- **Multiplayer** — wire codec + delta compression **7.1×**, `src/game/` untouched (`915bbaf`
  `a588066`); one alias-aware walker, not a field list.
- **Levels 1–15**, +5%/level of HP and damage. **Level 1 is bit-identical to the pre-levels build**,
  proven tick-for-tick; win rate drifts **1.9 pp** across L1→L15.
- **Pacing.** Countdown 5.68 → 3.68 s with **zero** win-rate change, proven over 3,520 bit-identical
  matches. `MATCH_DURATION_MS` and the fog schedule were both **falsified** as pacing levers.
- **Touch** — 36/36 distinct bearings, worst error 0.27°, reversal spread 0. Two real defects fixed:
  a second finger in the same zone killed the stick, and **83.3% of the bottom 38% of a portrait
  frame was dead to touch, with the control hints drawn on it**.
- 🔴 **The sim stopped being hard-1v1** — `cdcdd65`: `fighters: Fighter[]`, slot identity, an N×N
  perception matrix. `state.player`/`state.enemy` remain real properties holding the same objects, so
  **every renderer/HUD/audio/tool consumer needed zero changes.** Proved: **0 differing ticks in
  26,388,976**, and 7,039,194 events in order.

## Presentation

- **Cast:** dark rung (p05 0.273 → 0.157; 11/11 pass), silhouette (hull deficiency 0.1379 →
  **0.2621**, the reference median; **11/11** clear the floor, from 1/11), near-white clipping
  0.1007 → 0.0275. All eleven got the arms-vs-legs pass: they were not merely similar, they were
  **the same call** — hamburger's forearm and shin shared one `case` block.
- **Arena:** brightness (frame luma 0.322 → 0.402), edge grammar (the reference marks a ground seam
  with a **dark band, never a bright line** — we had it inverted), contact grounding (share past the
  0.06 threshold 16.9% → 35.6%), stains (they had **no dark core at all**).
- **Lighting:** the key light's **azimuth sign** was throwing every shadow behind its own object.
  Contact ΔL 0.0353 → **0.1242**. Figure/ground *paid* rather than cost.
- **HUD:** 20 WCAG failures → 0, min ratio 1.89 → 6.48. Eight defects, all bugs.
- **VFX:** the trail was **0.7° of hue from the floor and 1.0° from the cast**; now 22.4°.
  ⚠️ **But the occlusion complaint did not move** — 5 of 6 critics before, 5 of 6 after. **Hue was
  never the binding constraint — AREA and OPACITY are.**
- **Weapon halos:** the eight palest weapons had a halo the colour of the ground (`50c5272`).
  `PROJECTILE_HALO_L` was a lightness floor *with no ceiling*.
- **Audio:** the top three octaves did not exist (tilt −5.57 dB/oct, 86.2% of energy below 1 kHz).
  Now −5.07, duty cycle **21.9% → 58.6%**. `generic.hurt()` alone was holding the game darker than
  the other fifteen sounds combined.
- **Menus:** key rebinding (its assertions read off **sim state**, not the DOM), the levels UI, three more "shows a
  number the model does not compute" defects, design-system adoption (`f5a6229`, `3481d71`).

## The instruments — an earlier session's real output

**Nineteen instruments were caught returning confident wrong answers.** The most consequential:

| instrument | what it was doing |
|---|---|
| **the blind critic** | **±1.4-point floor; a round's two panels are n=1, not n=2.** The rubric alone is worth 2.0 points and there was no canonical one. |
| `scripted_player.mjs` | **`bestWeapon` skips `'self'` — the measurement cannot press heal.** Worth **50.6 pp** on Hamburger. ⚠️ **The roster was balanced twice against this.** (Fixed; now at `DRIVER_REV = 5`.) |
| `feel_probe.diff()` | saturated: a fog hit read 3904 px, a weapon hit 3879. The burst's real range is **6.31×**, not 1.66×. |
| `valuescan --mode gate` | served **stale JSON off disk** — reported 0/11 where HEAD was 11/11, and named the **wrong characters**. |
| one stale driver | copied into **ten** tools; a fourteenth born mid-audit. |
| `arena-scan` | ignored `PREVIEW_BASE`, silently measuring whatever was on port 5187. |
| `hud_fit` harness | missing `box-sizing`, so it reported "0 px overflow" against a real 15.1 px — **and `hud.ts` cited that number in a source comment as proof.** |
| `driver_guard` | its coverage **shrank** when a bug was fixed (49 → 41), because its census keyed off the bug's own fingerprint. |
| `limbcheck` | measures **22°** and a pose the player never sees; the match camera is **58°**. |

⚠️ **`limbcheck` vs `limbcheck_pitch`:** an earlier warning here said they are *"93.3% identical while
the latter's header claims byte-identity"*. **The warning OVERSTATED it.** Diffed directly: the only
**executable** differences are the pitch constant, one `console.log` banner, and `&pitch=` on the URL.
**`limbcheck` IS `limbcheck_pitch --pitch 22`.** The 93.3% was a *line* count over a mostly-comment
file. **The real limitation stands:** at 58° idle passes go 8/11 → 0/11, idle *ranking* survives
(ρ 0.927) and **run ranking does not** (ρ 0.673).
⚠️ **And 22° is within two degrees of the LOBBY camera** (`charStage.ts` is `pitchDeg: 20`), so it was
never measuring nothing. It was answering the *other* question, and nobody noticed there were two.

---

# 10. Older pending items, still open

## 🟠 Cast value ladder — the "regressions" are a RENDER commit, and the metric is wrong

**The old wording, kept because both halves are misleading:** *"`weakBoundaryPct` fails 5 of 11 — and
pizza 22.0 → 41.0 and waterbottle 22.9 → 53.9 got worse while the gate was frozen. `dlBelow10` fails
lollipop and sushi. The dl table is 171 of 198 rows."*

- 🚨 **They are not character regressions.** A 9-tree paired bisect puts **both** collapses inside
  `ce49cd3..47feb9a`, whose only character-rendering commit is **`086ff5f` — the key-light move.**
- 🚨 **`weakBoundaryPct` measures the wrong quantity** and **produced a FALSE FAIL and a FALSE PASS in
  one run** (egg 61.8% with a contact-local count of 0.0; hamburger PASSES at 4.3% with a contact
  count of 9.0). It is also a **cliff, not a band** (a 0.0142 luma move once swung it 33 pp).
  **Steer on `minDL` (floor 0.0039) and the contact-local variant.** `dlBelow10` is **0 of 11** —
  that class is closed on merit.
- **burrito and sushi regressed too, and by more than pizza** — burrito head|torso 0.3605 →
  **0.0114**, sushi 0.2647 → **0.0403**. This file named neither.
- **The fix is already built and it is INVISIBLE.** `e6fed57` added a neck column plus a dark collar
  to 8 of 11 characters; at the shipped camera and facing it delivers **0 pixels** on burrito, sushi
  and soup.
- **The 171 dl rows never existed on disk** — no `dl.rows.jsonl` anywhere.
- ✅ Drift control clean: `0529aa8` and `b967242` moved the cast's value ladder by **0.000**.

## ⚠️ The `valuescan --mode gate` trade — a CAST PASS TRADED `p05` FOR FIGURE/GROUND

| gate | before | after | |
|---|---|---|---|
| `p05` (dark anchor) | **11 of 11 FAIL** | **0 of 11** | ✅ fixed roster-wide |
| `range` | 6 of 11 FAIL | **0 of 11** | ✅ fixed |
| `dlBelow10` (figure/ground) | 1 of 11 FAIL | **6 of 11 FAIL** | 🔴 paid for it |

**17 failures fixed, 5 created. Arguably a good trade — but nobody chose it.**
**The mechanism, on `lollipop`:** `fig` is pinned at **0.497 at 17 of 18 stations** against a ground
at 0.40–0.48, so `dL` sits at 0.02–0.10 **by construction**.
⚠️ **6 of the 7 failures have `worstStn` = `fog_late` or `fog_boundary`** — stations where figure
*and* ground both collapse toward the veil colour. **That is an ARENA fix, not a cast fix. Do not
send a character agent at a fog station.**
⚠️ **A correction, kept.** The `lollipop`/`sushi` scare was closed as *"not a regression"* on the
grounds that `1f51987` already recorded lollipop 11 of 18 stations, sushi 6 of 18. Still true **for
those two characters** — but across the roster `dlBelow10` went from **2 characters failing
pre-session to 6**. **Resolving the named instance is not the same as resolving the class.**

## Concealment — the constraints that survive, now that it has shipped

- 🚨 **The sim contains ZERO randomness.** Concealment expressed as an accuracy *roll* would destroy
  the determinism underwriting every balance number. **Region membership** is the only safe form.
- 🚨 **`stepAI` has NO SEARCH** — see §3.8 for the cap and for the ORACLE arm that prices it.
- **Our 21.36% cover share reproduces** (n=12 canonical stations, ablation-validated). ⚠️ **The
  "35–45%" reference has NO instrument anywhere in this repo** — it is one critic's prose about four
  plates, and *three of the plates do not show it*. **Do not tune to it.**
- **One rule the mechanic is built on:** *while you are concealed, nothing that tracks you updates.*
  All three `stepAI` sites are routed through it, plus a **fourth outside `ai.ts`**: homing
  projectiles re-aim every tick, and the observer there is the *projectile*, so it stays symmetric.
  ⚠️ **A fifth was added this session and it is the spectator camera** (`30e3360`): the concealment
  observer moves to the view subject, because asked from a corpse 2,000 wu away it would hide the
  fighter the camera is pointed at from the person watching them.
- **Attacking breaks the plate and reveals you** (`f0e7aed`). Two halves, deliberately separate:
  **destruction is about the OBJECT** (`breakConcealment` removes **every** standing region
  containing the attacker's centre, never the first — and it lives on `MatchState`, never on
  `arena.concealment`, because **one `ArenaDefinition` serves every match a process runs**);
  **reveal is about the FIGHTER** (`revealedUntil`). A `self` press does neither.
  **The duration is DERIVED:** `CONCEAL_ATTACK_REVEAL_MS = FLIGHT_MS.normal` (500 ms). Deliberately
  **not** the firing weapon's own cooldown, which would make a fast weapon a strictly safer ambush.
- 🚨 **The mutant that escaped is the lesson.** Of 14 mutants, *"breakConcealment breaks only the
  FIRST region"* passed **287/287** — because **the AI fires too**, and the enemy's own shot broke
  the second plate. **Asking about a fighter is never a neutral way to ask about a plate.**
- ⚠️ **`arena_probe --occl` and `--verify` were BLIND to concealment** — the series came from
  `arena.cover` only.

---

**Judgement calls live in `docs/DECISIONS-FOR-URI.md`** — read that first if you are Uri.
**New session? Read `CLAUDE.md`, then this file, then `docs/LESSONS.md`.**
