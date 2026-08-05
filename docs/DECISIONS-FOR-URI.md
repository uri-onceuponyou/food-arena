# Parked for Uri

Decisions that need human judgement. **Nothing here is blocking** — work continued past every
item using the stated assumption. Each entry says what was assumed, what it would cost to
change, and where the change would land.

Answer any subset. Unanswered items stay on the stated assumption.

---

## The answer sheet — everything at a glance

You can settle most of this with one word each. Detail is in the numbered sections below.

| # | question | in force now | my recommendation | cost to reverse |
|---|---|---|---|---|
| **6** | **⚠️ Lobby reference plates** | none exist | **only you can fix this — it blocks all menu scoring** | drop 3–4 screenshots in |
| **12** | ⚠️ **Game is now MUCH harder: 51.2% → 31.8%** | the harder version | **your call — this one is big** | `ENEMY_MAX_HP` ≈123 restores it |
| **15** | Should a fleeing enemy shoot at you? | it fires backwards | **measured at a further −25.9pp — parked, not landed** | a two-word patch |
| **16** | Soup lost its red band, egg went cream, cast p95 is +0.027 over reference | shipped | **look at it — these are looks, not measurements** | per-character, self-contained |
| **17** | Music during matches · `hurt()` masking what hit you | silence · full level | **both are yours; the roster brightening is already going** | one line each |
| **18** | Arena has half the cover density of the reference — the fix is **bushes**, a gameplay mechanic | no concealment | **your call — this is a feature, not an art pass** | new mechanic |
| **19** | Back out of a live match abandons it silently · mid-match reload restarts it | abandon · restart | **two small feel calls** | one line each |
| **20** | Characters are proportioned narrower and drawn smaller than the reference | as-is | **stance widening is going ahead; the sheet is for your eye** | revertible per character |
| **1** | Match length | 45 s | **keep** — 35–45 s are all safe now | one constant |
| **10** | Two icons unreadable at 20px | as drawn | **change the subject**, not the drawing | a design call |
| **11** | Longer legs — every silhouette changed | longer | **keep** — legs now exist at all | 2 constants + 1 row/archetype |
| **5** | Floor hue as the blocking cue | restored | **keep** — two sources agreed it was a defect | six constants |
| **7** | Audio | as-is | ✅ **ANSWERED — "flat, monotonic, no splash on a tomato hit"** → now a build, not a tune | see §7 |
| **4** | `ROSTER_GATED` | off | **yours** — shop is built and honest either way | one flag |
| **2** | Timeout tiebreak | HP fraction → zone → you | **keep** (it now actually fires) | a few lines |
| **3** | Trail damage cap | 1 per tick | **keep** | one constant |
| **13** | Rarity runs backwards; the stat card is fiction | as built | **decide if rarity means power** — half the grid is settled at select | a real build, not a tune |
| **14** | Portrait phones: 65% black bars | letterboxed to 4:3 | **prompt to rotate** — or rethink the fairness model | one prompt, or a model rework |
| **8** | Pointer lock | shipped as built | ✅ **ANSWERED — Uri: "works good"** | — |
| **9** | Feel — ranges, wind-ups, weight | as built | **cannot be screenshotted** — needs you playing | — |

**If you only do one thing:** play it for ten minutes. The two most valuable bug reports this
project has ever had came from exactly that, and both were invisible to every gate here.

**If you only answer one thing:** #6. Three consecutive menu rounds scored our lobby against
in-match combat frames, and both critics flagged it unprompted.

---

## How to read this

| field | meaning |
|---|---|
| **Assumed** | what the code does right now, so you can play it |
| **Cost to change** | how much work reversing it is, honestly |
| **Why it needs you** | what measurement could not settle |

---

## 1. Match length, and what the closing fog does

**Why it needs you.** `MATCH_DURATION_MS` was 180 s against a mean match of 25.3 s, so the
closing-zone system never fired at all (fog was 0.4% of all damage). Shortening it is a pacing
decision, not a correctness one — and it cascades: `arena/shared.ts` *derives*
`MAX_SAFE_RADIUS = ARENA_HALF_DIAGONAL / (1 − FOG_FIRST_CONTACT_S·1000 / MATCH_DURATION_MS)`,
so a shorter clock starts the ring **larger** to keep fog off the arena corners at t=0.

**Assumed: `MATCH_DURATION_MS` = 45 s** (was 180 s). Criterion used: at least 1.5× the longest
natural match, fog in single-digit % of all damage, and the ring actually biting in long matches.
Swept 25/30/35/40/45/50/60/90/180 s through the real sim.

| | 180 s | **45 s** |
|---|---|---|
| fog share of all damage | 1.6% | **8.2%** |
| ring radius at the median match end | 797 wu | **597 wu** |
| opening ring / sweep rate | 890 wu · 4.9 wu/s | 993 wu · 22.1 wu/s |

**❓ 45 s, or shorter?** 40 s puts fog at 9.7%; 35 s makes the ring bite before the median match
ends — but risks truncating fights rather than stalemates, since **13.0 s of the mean 19.6 s match
is spent just walking to contact.** 25–30 s pushed fog to 19–34% of all damage, which is too much.

**Note this interacts with the navigation work now in flight.** If spawn separation (STATE.md #11)
gets fixed and that 13.0 s of walking drops, 45 s becomes generous and should be revisited.

### ⚠️ New evidence, and it cuts BOTH ways

Measured since, over **363 real matches** (121 matchups × 3 policies):

- **The timeout tiebreak and the FINAL RING were reached in 0 of 363 matches.** Longest match is
  25.1 s of play; the ring floor arrives at **t=38.66 s**. Both were built today, both are correct,
  and **neither currently ever happens.** Only forcing both fighters immortal reaches them (121/121).
  → argues the clock is **too long**.
- **`REGEN_DELAY_MS = 10_000` against a mean play length of 16.2 s** → out-of-combat regen fires
  **0.02 times per match**. A whole mechanic, and the sound written for it, is dead content.
  → also argues **too long**.
- But **13.0 s of the mean match is still walking**, and an arena-layout pass is cutting exactly
  that right now. → argues it will be **too long again** once that lands.

### ✅ ANSWERED — and then RELAXED. See the update at the end of this section: **35 s is now safe too.**

### Original answer: keep 45 s. If you want to move it, 40 s is nearly free. **Do not go below 40 s.**

A ~126,000-match audit (110 matchups × up to 25 seeds × 5 policies) settled this, and it **corrected
two things I told you above.**

**Correction 1 — the "fog 1.6% → 8.2%" figure compared two different estimators.** 1.5% was an
*aggregate* share; 8.1% was a *mean of per-match ratios*. On one estimator (aggregate, `smart`):

| clock | fog share | enemy killed by fog | player killed by fog | player win |
|---|---|---|---|---|
| 180 s | 0.8% | — | — | 55.0% |
| 60 s | 2.1% | 10.8% | 0.2% | 55.2% |
| **45 s (shipped)** | **3.7%** | **14.2%** | **0.9%** | **54.4%** |
| 40 s | 5.2% | 17.0% | 2.9% | 53.8% |
| 35 s | 9.7% | 22.9% | 5.8% | 51.4% |
| 30 s | 19.2% | 25.5% | 20.3% | 43.8% |

The decision was **directionally right** — 5× more fog — but its magnitude was **overstated ~2×**.

**Correction 2 — almost nothing was ever tuned against 180 s.** Mean play length is **18.81 s at a
180 s clock and 17.92 s at 45 s**; no match ever reached the old clock. Only the fog schedule
derives from it. Everything else lives against play length and **engaged time (~6.0 s)**, which the
clock change did not touch.

**So the clock is not too long — the closing schedule is too slow.** The whistle only decides when a
match *ends*; `FOG_FIRST_CONTACT_S` and the linear close decide when the ring *bites*.

**⚠️ Correction: that schedule change CANNOT be made in `arena/shared.ts`, and the arithmetic is
conclusive.** I recorded `shared.ts` as the lever; the arena-layout agent then proved it is not. The
corner-safety invariant — the thing that stops the arena's corners being in lethal fog at t=0 — pins
the bite time at

```
t_bite = 0.4187 · T + 0.5813 · FOG_FIRST_CONTACT_S
```

At T = 45 s that is **22.3 s**, and driving `FOG_FIRST_CONTACT_S` all the way to **zero** only
reaches **18.8 s** — while breaking the invariant. **The real lever is a non-linear close in
`sim.ts`** (hold the opening radius until first contact, then sweep), not a constant in `shared.ts`.

Shortening the clock instead costs three things:

1. **Below 40 s the clock starts deciding matches** — −3.0 pp of player win rate at 35 s, −10.6 pp at
   30 s, because fog is a flat 50 HP/s against unequal HP pools.
2. **It hands you a degenerate strategy**, because the AI has no ring awareness: at 40 s the
   pure-evasion policies' win rate jumped from 1–18% to **46–52%** — the enemy walks into the fog
   while you stand still. *A combat/AI agent is fixing that now.*
3. **It does not buy the timeout tiebreak anyway.** The longest match any of six policies produced
   across 13,750 runs is **40.30 s**. To make the whistle routinely reachable you would be at ~30 s,
   where you are truncating fights rather than stalemates.

**The timeout tiebreak and FINAL RING are not dead code — they are 4.7 s out of reach**, and they
come into reach on their own if the arena-layout pass lands its dead-time cut alongside a schedule
change. I would not shorten the clock to reach them.

### 🔄 UPDATE — the constraint that forced "no lower than 40 s" has been removed

Reason 2 above was that shortening the clock **hands you a degenerate strategy**, because the AI had
no ring awareness and walked into the fog. **That is fixed** (`07a4e3a`), and re-measured across four
clocks, 880 matches per cell:

| clock | evasion win rate, before → after | **enemy killed by fog, before → after** | timeouts |
|---|---|---|---|
| 45 s | 3.4% → **0.2%** | 9.0% → **0.5%** | 1 → 11 |
| 40 s | 2.2% → **0.2%** | 9.8% → **0.1%** | 7 → 10 |
| 35 s | 9.2% → **0.6%** | 10.6% → **0.2%** | 30 → 17 |
| 30 s | **16.4%** → **0.9%** | 12.0% → **0.0%** | 149 → 24 |

Two corrections to what I told you:

- **The "46–52% at 40 s" figure does not reproduce.** It was measured on the *pre-layout* arena;
  even before the AI fix it is now 2.2%. The arena pass had already blunted it.
- **But it did still re-emerge as the clock shortened** — 3.4% → 9.2% → **16.4%** at 30 s, with
  timeouts hitting 149 of 880. **After the fix it is flat at ≤0.9% at every clock**, and the
  mechanism is gone: the enemy stops dying to the zone at all.

**And the scripted win rate is now nearly clock-invariant** (52.5 / 52.2 / 51.2 / 54.0 across
45/40/35/30 s). **The clock is a pacing dial again, not a balance one.** 40 s is safe; **35 s no
longer hands you anything.**

⚠️ One honest caveat: the evasion policies now die to the fog *themselves* 40–68% of the time,
because that policy has no obstacle avoidance on a 27-box map. **The number I stand behind is the
mechanism** — enemy fog deaths 9.0% → 0.5% — not the win rate.

**Also: your §2 tiebreak now actually fires.** The timeout was reached **0 of 363** times when §2 was
written; it is now **11 of 880** at the 45 s clock.

**Related sub-question — answered, tell me if you disagree.** `FOG_FIRST_CONTACT_S` stays an
**absolute 6 s** rather than scaling with the clock. Reasoning: it encodes a human duration you
specified in seconds, and first contact is with an arena *corner* nobody stands in. What actually
matters is when the ring crosses the inscribed radius (22.3 s) and reaches its floor (42.0 s), and
both are already functions of the clock alone.

**Cost to change.** One constant in `rules.ts`. Everything else derives. Minutes.

---

## 2. Timeout tiebreak

**Why it needs you.** The clock previously ended nothing — `phase` stayed `'playing'` forever.
In practice the ring reached 0 and the 100 HP player died ~0.9 s before the 150 HP enemy, so
**timeout was an arithmetically guaranteed player loss.** That is fixed, but *who should win a
timeout* is a design call: higher absolute HP, higher HP fraction, or an explicit draw.

**Assumed: HP *fraction* → zone control (nearer the ring centre) → the human player.**
HP fraction rather than absolute HP, because 100 max vs 150 max would hand the enemy a 50 HP head
start it did nothing to earn. Resolved *after* everything else in the tick, so a killing blow on
the final tick is still a knockout rather than a timeout.

**❓ Is a draw preferable to "ties go to the human"?** The agent chose no-draw partly for a
structural reason worth knowing: `GameEvent.match-ended` requires a non-null winner, so supporting
a draw means widening that type in `state.ts` first. Cheap, but not free.

**Also new: `MIN_SAFE_RADIUS = 140`** — the ring no longer closes to zero. Without a floor, the fog
resolved every long match before the whistle could, so the tiebreak was unreachable. 140 = the pot's
95 wu danger ring + one body length, leaving a 45 wu-wide safe annulus. `sim.test.mjs` asserts that
relationship so a bigger pot cannot silently re-create the bug.

**❓ Keep "no safe ground left" as endgame drama, or keep it fair?** Current answer is fair. Note it
cannot force a final duel: with the 95 wu pot at the centre, two fighters in the annulus can still
be 280 wu apart, beyond every weapon's 165 wu effective reach.

**Cost to change.** A few lines in `sim.ts`. Minutes.

---

## 3. Sticky Trail damage cap

**Why it needs you.** Trail marks damaged once per mark, uncapped, all in the same tick —
measured **100 HP → 1 HP in a single 16.7 ms tick, 30 simultaneous hit events.** Undodgeable.
The mechanic is kept and capped, but *what a trail field should cost per second* is balance,
not correctness.

**Assumed: `TRAIL.maxHitsPerTick = 1`** — one instance per victim per tick, 3 HP. Every *other*
mark the victim is standing in is still consumed, which is what stops the cap becoming a drip that
costs the same 87 HP spread over the next 29 ticks. Criterion: the passive must sit below the pot
(32 HP/s) and the fog (50 HP/s) and near Donut's own output (13–20 HP/s).

Measured A/B with `rules.ts` held constant, so this is the logic change alone:

| | before | after |
|---|---|---|
| worst single tick | 9 HP (3 events) | **3 HP (1 event)** |
| worst single second | 36 HP/s | 33 HP/s |
| trail damage per Donut match | 35.1 HP | **33.9 HP (−3.4%)** |

The burst is gone and the *rate and total are untouched* — the mechanic survives intact.

**❓ Is a Donut trail field costing ~34 HP per match the right weight?** `TRAIL.damage` is the lever
if not.

**Cost to change.** One constant in `rules.ts:TRAIL`. Minutes.

---

## 4. `ROSTER_GATED` — the shop stays parked until this flips

**Why it needs you.** Carried over from the previous session; your call, deliberately off while
evaluating. While everything is owned, every box is a guaranteed coin loss (900 coins in,
~138 EV out), so shipping the shop against an ungated roster would be dishonest.

**Assumed.** Still off. The shop UI is being built behind the flag so flipping it is a one-line
change rather than a project.

**Cost to change.** One flag, once the UI lands.

---

## 5. Floor hue — blocking vs walkable

**Why it needs you.** The floor terracotta moved into the **PLUM family** (`tileLight` hue
332–340) — the same hue family `coverBody`/`coverPlinthPanel` reserve for *blocking*. The hue
half of the blocking-vs-walkable cue is gone; value alone (53 luma) now carries it.

**New evidence since that was written:** a blind critic, with no access to these docs,
independently reported the same confusion — *"the dark teal/cyan pads under both counters read
ambiguously to me; I could not tell whether they are raised platforms, floor mats, water, or
pits, because their value merges with the counters' dark base skirts."*

**Assumed.** Treating it as a real defect and restoring a hue-based cue, because two independent
sources now agree. Flag if you prefer the current look.

---

## 6. The review library has no lobby plates — menu scores are measuring the wrong thing

**Why it needs you.** This one needs images only you can supply. `reference/images/curated/` has
no lobby / hero-select category, so round 2 of the home work was scored against **two in-match
combat frames**. The critic flagged it unprompted, without being told: *"neither comparison panel
is a lobby, so nothing on these sheets tests the lobby's layout, chrome, or type against a real
lobby reference."*

Round 1 happened to draw two lobby-ish tablet plates and scored our home 6.5 against 8.5/8.0.
Round 2 drew combat frames and scored it 6.0 against 8/7. **Some of that movement is the
comparison changing, not the screen.**

**Assumed.** Menu work now leads with objective metrics (contrast ratios, value structure,
type hierarchy) and treats critic rounds as a secondary signal, because the primary one is
compromised. That is a workaround, not a fix.

**What would fix it.** 3–4 screenshots of Brawl Stars / Zooba **lobby and hero-select** screens
dropped into `reference/images/`. They stay gitignored and are never committed or published, per
the permanent security constraint.

**Related, and cheaper — I can do this one without you if you'd rather:** our review packets are
shot against a **first-run profile** — 0 trophies, 0 wins, 0 XP, empty bars. A critic reads that
as an unshipped game, and so would a store screenshot. Shooting packets against a seeded
mid-progression profile is a harness change, not a design one. Say the word and it happens.

---

## 7. Audio — does it sound *good*?

**Why it needs you.** Structure is measured (319 assertions from real rendered samples); taste
is not. Specifically: does the synthesised room read as a *kitchen* rather than a small box, and
does Hamburger at 767 Hz read as "heavy" or merely "muffled"?

**Assumed.** Unchanged. Not touched without a human ear.

---

### ✅ ANSWERED, then RE-ANSWERED — and the first answer was wrong

> **"It still seems like it's flat. One tone, maybe two, monotonic. I would expect a splash sound
> when I throw a tomato and it hits, for example. More depth. More realism as much as possible."**

⚠️ **The first diagnosis written here was falsified by measurement and has been deleted.** It said
the sounds had no material identity (that impacts fell through to one generic sound) and that the
synthesis was "one or two oscillators". Both are false: **32 of 33 impacts are bespoke**, no voice
lacks noise, and `pizza.Tomato.impact` alone is **3 oscillators + 3 noise sources + 4 filters + 4
shapers**. It is recorded here rather than quietly removed, because it is the exact failure this
project keeps paying for — a confident description standing in for a measurement.

**The real answer, measured on the production path** (`9d3d1a6`). Every audio instrument here
rendered ONE sound in ISOLATION, which is how 91 depth and 77 identity assertions all passed on a
mix nobody would call good. Recording a **real** match's event stream and replaying it through the
**real** engine offline gives a completely different picture:

| | measured | reference |
|---|---|---|
| spectral tilt, 80 Hz–8 kHz | **−5.57 dB/oct** | pink −3.00, white 0.00 |
| energy below 1 kHz | **86.2%** | — |
| 1/6-oct bands within 6 dB of peak | **8 of 49 — all between 71 and 141 Hz** | — |
| 2–6 kHz at a hit's *brightest instant* | **−25 dB** | — |
| 6–16 kHz at the same instant | **−32 dB** | — |

**"One tone, maybe two" is literally true in the spectrum.** The whole game lives in 80–650 Hz. The
high band is not decaying too fast — **it never arrives**, which is precisely where a splash's
identity lives.

**And the mix is silent most of the time.** Across 121 real matchups: mean play length **9.60 s**,
and the mean gap between the start whistle and the first combat sound is **6.55 s — 69.9% of the
match, in one unbroken silence**, with the music faded out and no ambience at all.

**Two suspects formally cleared, so nobody re-opens them:**
- **The soft clip is not the problem.** It reduces **2.00%** of signal by more than 0.5 dB, and the
  delivered spread across a match's vocabulary is **18.9 dB — identical to the authored spread**.
  The old "13 dB authored → 5 dB delivered" figure came from rendering catalogue sounds with no
  placement; in a real match distance gain *adds* range. **So dropping the flow stings 4–5 dB is not
  needed for flatness** — it remains your call for the ultimate's drama, but flatness is not the
  argument for it.
- **The bespoke voices do reach your ears.** Ablating one impact moves the whole match −4.56 dB,
  about 130 dB above the instrument's own noise floor.

**In flight now:** the roster-wide brightening pass, authorized by your "more depth, more realism as
much as possible", plus a kitchen ambience bed for the silence. See **§17** for what still needs you.

---

## 8. Pointer lock — ✅ ANSWERED: Uri confirms it works

**Uri, playing on a real browser: "Mouse capturing works good."** That closes this. No harness in this
repo could ever have answered it — Playwright's Chromium refuses `requestPointerLock()`
unconditionally, headless, headed, and with automation flags stripped. Everything below is kept as
the record of why it was unanswerable.

---

### (original entry)

## 8b. Pointer lock — could not be tested here

**Why it needs you.** Playwright's Chromium refuses `requestPointerLock()` unconditionally —
headless, headed, and with automation flags stripped. **The multi-monitor case that prompted the
work cannot be reproduced by any harness in this repo.** Also: does "Click to resume" feel
responsive, given Chrome's ~1 s re-acquisition limit?

**Assumed.** Shipped as built. Only you can confirm.

---

## 9. Feel — the things a screenshot cannot capture

Carried from the previous session, still true, still unanswerable here:

- **How the retuned ranges feel.** The longest weapon reaches 3.3 body-lengths, down from 6.2.
- **Does `giantSlam` need a wind-up?** Its tell is readable with the caster off screen, but the
  slam resolves on the *same tick it is cast* — it cannot be dodged, only explained.
- **The trophy road curve.** A deliberate redesign, not a transcription: 34 nodes to 3,200
  trophies, ~4 matches to the first unlock and ~394 (~13 h) to the full roster.

**The two most valuable bug reports on this project came from you simply playing it** — clicks
not firing, and the character not facing the cursor. Both were invisible to `tsc`, to the
assertions, and to every screenshot. That is still the highest-yield thing you can do.

---

## 10. Icons — two need a SUBJECT change, and that is a design call, not a drawing one

**This answers `docs/STATE.md` Part 3 item 6** ("whether the icons need another pass"). Measured
answer: **no more redrawing.** Identify-at-real-size went **21.7 → 24.0 of 28** and mutual swaps
**4 → 0**, but the instructive part is what did *not* work — **21 of 28 icons were already
perfect, and 8 of 14 redraws measured WORSE and were reverted** (`wrap` 3/3→1/3 across three
attempts, `meat` 3/3→1/3, `slash` and `shards` 3/3→2/3).

Two icons resist drawing entirely, because the problem is the **subject**, not the execution:

- **`mustardblast`.** Four attempts. It and `ketchupslip` are both squeeze bottles differing only
  in **hue and chirality** — and at the shipped 20px, hue is a tint and chirality is not a mass.
  They are one icon drawn twice. Making them a true mirror pair took them from 7/7 + 4/7 to
  **1/6 + 1/6, swapping with each other.**
  **❓ Recommendation: give Mustard Blast the hot dog itself with a mustard stripe** — a silhouette
  nothing else in the set owns.
- **`cap`.** Five drafts (disc, dome-with-teeth, cap-on-neck, ¾ crown) all scored 0–1 of 3. A
  bottle cap has no distinguishing mass at 20px.
  **❓ Recommendation: a water droplet with a spinning motion arc** — or accept 1/3.

**Never tested at all, and worth knowing:** the 37 `UI_ICONS` (coin, gem, chest, gear) have never
been measured, and one judge read a food icon as "coin" — so **cross-set collisions between the
two icon families are unmeasured**.

---

## 11. The cast's legs — longer legs change every silhouette

**Why it needs you.** Arms are fixed (buried limb groups **50 → 26**, mean wasted footprint
37.1% → 27.4%). Legs barely moved, **73 → 61**, and the arithmetic says tuning cannot finish it:
the camera looks **down** (58° in game), so a mass above the hips projects *over* the legs however
wide they stand. On Hamburger the knee would need to move **0.545 m forward** to clear the bun.
Widening even backfires — Soup's shins went **0.653 → 0.000** under the bowl's overhang.

The only lever with the right sign is **`legFraction`** on the STOUT and STUB archetypes. A pass
is running now, targeting roughly 0.25 → 0.31 and 0.15 → 0.20.

**Assumed.** That longer legs are worth it, because the silhouette is the *only* thing that reads
at the ~10.5% of frame height a character occupies in game.

**❓ This changes the proportions of every character in the cast** — it is the most visible
single change of the session. **Reverting is one constant per archetype.** Look at the roster
silhouette before/after and say if you hate it.

---

## 12. The game just got harder — 62.1% → 51.3%. Keep it, or dial it back?

**Why it needs you.** This is the one change this session that is a **deliberate difficulty shift**,
and it is declared rather than smuggled. Bounding the status lock and giving the AI hazard awareness
cost the player **~9–11 pp** of win rate, because both were player *advantages* in aggregate:

- The **enemy was locked ~2× as much as the player** (33.9% of engaged time vs 18.6%). An
  11-second undodgeable movement lock was, on balance, working *for* you.
- The **zone killed the enemy 11× more often than you** — 94.8% of all pot damage and 100% of all
  fog damage landed on the AI, because it had no ring or hazard term at all.

| policy | before | after |
|---|---|---|
| scripted skilled player | 62.1% | **51.3%** |
| naive "charge straight in" | 25.5% | **18.4%** |

**Assumed: keep it.** 51.3% against a 150 HP enemy is a healthier baseline than 62.1%, and the
points came from deleting two things that were never design — an 11-second undodgeable lock, and an
AI that walked into fire.

**❓ If you disagree, the dial is one constant and it is already measured:** `ENEMY_MAX_HP` 150 →
**140 gives 56.3%**, → **130 gives 62.3%** (i.e. 130 restores the old difficulty almost exactly).
**Please do not buy it back by re-opening the lock** — that mechanic was undodgeable by construction.

### Two consequences, not decisions

- **Pizza is now weak, and it was carrying itself on the bug.** Player-Pizza won **98.8%** of its ten
  matchups on Cheese Blind alone; it now wins 63.1%, and in AI hands 10.6%. It was a coin that
  decided the match by who held it. Worth its own balance pass.
- **You cannot see the new rule.** A stun that is *refused* currently draws nothing, and "nothing"
  looks identical to "my weapon did nothing" — i.e. like a bug. `combat.ts` exports `statusReadyAt()`
  and the VFX owner has been asked to render it. Flagging it because **if it ships unrendered, the
  fix will read as a defect.**

### And the thing only you can settle

Whether **2.0 s of zero movement still feels awful**, and whether a refused stun feels like a rule or
a bug. `docs/LESSONS.md` §10 — the two most valuable bug reports this project ever had came from you
playing it. This is squarely that kind of question.

---

## 13. Power runs BACKWARDS against rarity, and the character card is fiction

**Why it needs you.** The roster was measured per character for the first time — 110 matchups ×
32 seeds, each character scored in the player's hands *and* in the AI's. Three findings, and all
three are design questions rather than defects.

### (a) The free starter is the strongest character in the game

Mean strength by rarity tier:

| tier | Normal | Rare | Legendary | Neon | Cyber | **Epic** |
|---|---|---|---|---|---|---|
| strength | **68.6** | 67.3 | 68.4 | 34.8 | 29.5 | **12.5** |

**Hamburger — Normal tier, the character you start with — is first in every measurement**, with no
mistuned number to point at: highest kit DPS, joint-longest reach, both statuses, and the only heal
in the roster. Meanwhile the two rarest tiers are the two weakest. **The trophy road currently
sells a downgrade** — ~13 hours of play to unlock characters measurably worse than the free one.

**❓ Is rarity meant to mean power, or just cosmetic variety?** Both are legitimate; a lot of games
do the latter deliberately. But the trophy road is built as a *progression*, so if rarity is not
power, the reward curve is promising something it does not deliver.

### (b) `CharacterDef.stats` is display-only — and two of its four axes do not exist

The card on character select shows stats. Correlation between the card's stat total and measured
strength is **ρ = 0.327** — barely better than chance.

Worse: **`health` and `speed` do not exist in the simulation at all.** Every character has identical
HP and identical movement speed. Donut's trail is the roster's only genuine movement difference.

**❓ Is the card a promise?** If it is, the roster needs per-character HP and speed, **which is a
real build, not a tuning pass** — `PLAYER_MAX_HP`/`ENEMY_MAX_HP` are per-*role* constants today, so
this touches the sim, the HUD and the economy's balance assumptions. If it is not, the card should
show something true.

### (c) The roster's dominant problem is not any one character

**53 of 110 matchups are decided before they start** — one side wins ≥95% or ≤5% across 32 seeds.
Fixing Lollipop moved that to 52.

**This is the finding I would act on if you only pick one.** A brawler where half the grid is
settled at character select is a different problem from a brawler with one weak character, and no
amount of per-character tuning reaches it. It plausibly needs the thing (b) describes — real
per-character health and speed — to give the matchup matrix more than one axis to vary on.

**Assumed.** Nothing here is changed. Lollipop was pulled out of last place because its special was
weaker than its own basic attack, which was categorically a defect; everything above is design.

**One honest caveat on all of it:** these are scripted-player numbers. A human moves at 120 wu/s
against an AI that chases at 70, so a human can dictate engagement far better than any policy here
does. The **AI-hands** column is the driver-neutral one, because all eleven characters share one
driver there.

---

## 14. Portrait phones get 35% game and 65% black bars

**Why it needs you.** Found by the first end-to-end play-through of the shipped path. At
**390×844** — an ordinary phone held upright — the canvas renders **292 px tall inside an 844 px
viewport**. Roughly **two thirds of the screen is flat black.** Screenshot:
`shots/e2e/portrait/03_portrait_countdown.png`.

**This is deliberate and documented, not a bug.** `stage.ts:resize()` masks anything outside
`SUPPORTED_ASPECT` (4:3 → 21:9) when `frameMode` is `'fair'`, and the whole viewport-fairness
guarantee depends on it: `aspect.mjs` passes at **0.00wu spread across every viewport** *because*
extreme aspects are letterboxed rather than given more or less of the world to see. That fairness
property was hard-won — it once found a live bug where forward visibility was **below every melee
range**, so you could be hit from off screen.

**But the trade is severe on the one platform the touch controls were built for.** The twin
floating sticks are proven at 46/46 with real touch events, the phone HUD is a shipped layout, and
quality tiers exist for phones — and then portrait play happens in a third of the screen. **No
shipped mobile brawler letterboxes portrait this hard.**

**Assumed.** Unchanged. Nothing here is a defect to fix — it is a design trade with a real
guarantee on the other side of it.

**❓ Three options, in increasing cost:**
1. **Keep it.** Fairness is exact, the game is legible, portrait is a secondary orientation.
2. **Widen `SUPPORTED_ASPECT` toward portrait** and accept that a portrait player sees a different
   amount of world — which breaks the 0.00wu guarantee and reopens the "hit from off screen" risk
   the fairness work was built to close.
3. **Rotate-to-landscape prompt on portrait phones**, the way most brawlers do. Cheapest of the
   three that keeps fairness intact, and honest about the constraint rather than hiding it.

**Recommendation: (3)**, unless you want portrait to be a first-class orientation — in which case
it is (2), and that needs the fairness model rethought rather than relaxed.


---

## 15. Should a fleeing enemy be able to shoot at you? (and the difficulty that came with §12)

**Why it needs you.** Three driver bugs landed in `4105116`, each a case of a rule stated once in
`rules.ts` and implemented differently in `ai.ts`. Together they cost **51.2% → 31.8%** of player
win rate (scripted skilled) and **13.8% → 4.1%** (naive). That is far bigger than the ~9 pp §12
was written about, so **§12's calibration is superseded** and re-measured against the current tree:

| `ENEMY_MAX_HP` | 150 (shipped) | 130 | 115 | 100 |
|---|---|---|---|---|
| player win | **31.8%** | 45.7% | 58.3% | 76.3% |

**≈123 restores the pre-change 51.2%.** The dial is still yours and still untouched.

### And a fourth bug, measured and deliberately NOT landed

**The flee branch has never actually sniped.** It points `facing` directly *away* from you and then
fires along it — and `combat.ts` resolves both the melee cone and the projectile heading off
`attacker.facing`. So **8 of 11 characters deal literally zero damage from the branch called "flee
and snipe"**; every point in the table comes from the three *homing* weapons curving back.

The fix is a **two-word deletion**, and it costs **another −25.9 pp, to 5.9%** — more than all three
landed fixes combined. Four reasons it was written up instead of shipped:

1. It is **2.4× the shift §12 already has parked for you.**
2. The mechanism is a **cliff, not a slope** — AI damage per match goes 59.7–111.0 to 98.1–113.5
   against your 100 HP pool, so **every character crosses it at once.** That makes it an HP-pool
   question, i.e. yours.
3. At 5.9% the roster instrument **saturates** (strength sd 20.6 → 6.8 pp) and the next balance pass
   goes blind.
4. On the fixed tree, `ENEMY_MAX_HP` 150 → **90** puts it back at 52.8%.

`node tools/tmp/ai_ladder.mjs <dir>` emits the exact patch, so the decision comes with its diff.

**⚠️ One visual consequence if you take it:** `match.ts:546` rotates the model to `facing`, so a
fleeing enemy would **backpedal facing you** instead of turning its back. That is what you already
do (mouse aim + WASD away) and it is the genre norm — but it is a look, and it is worth seeing
before deciding.

### Pizza is now 9.2, and it is not a Pizza problem

It was carrying itself on the stun bug twice over. **Worth its own pass — but after you settle the
above**, because the flee decision moves it again.


---

## 16. Two character colours changed on judgement, and the highlight rule turned out to be a mean

The value pass (`a5ce2a5`) closed the session's #1 red item — the cast finally has a dark rung, and
**10 of 11 characters now reach the reference's dark end where none did before.** It is the most
visible change of the session: every character, in the match, the roster, character select and the
trophy road, because all of them go through `createCharacter`.

Three things in it are **judgement, not measurement**, so they are yours:

**1. Soup's red trim band is now near-black maroon.** Its near-black had to land on a mass already
worth 6–12% of the character's pixels — that is what buys the p05 with one constant — and the rim
band was the only such mass. It works, and it costs soup its one spot of identity colour.

**2. Egg's lower shell went from near-white to warm cream.** Egg is the one character that
**cannot** pass on colour at all: its head is 93.7% of it, and the shell being near-white *is* the
egg. It ended at p05 0.279 against a ≤0.180 gate — still failing — having given up some of its
whiteness for nothing. **The real fix is a dark garment**, which is geometry and is now in flight.
It may be right to put egg's shell back to near-white and let the garment do the work.

**3. The "do not lift highlights" rule was bent, deliberately.** It was recorded as *"p95 already
equals the reference at 0.896, do not touch it"* — but that was a **cast mean hiding a 0.780–0.979
spread**. Five characters sitting *below* the reference were lifted (taco 0.780→0.871, hotdog
0.805→0.904, pizza 0.849→0.904, donut 0.812→0.853, hamburger 0.884→0.892); the six at or above are
byte-unchanged. Cast mean is now **0.923, +0.027 over the reference median**. 81% of the range gain
came from the dark end, 19% from the light end.

**How to judge it:** run `node tools/tmp/playtest.mjs` → http://localhost:4321 and look at soup and
egg in character select. That is a 30-second call and it is the kind only you can make.

**Reverting is cheap and precise.** Per-character revert is safe — each file's changes are
self-contained named constants at the top of the file with the measurement in the comment. The
whole-set revert is `git checkout 430c3c0 -- src/characters/` (**not** `git revert`, because the
code is trapped inside the mislabelled `9854f2c`).


---

## 17. Two audio calls that are yours, now that the diagnosis is settled

The roster-wide brightening and the kitchen ambience bed have **landed**. Your *"more depth, more
realism as much as possible"* is the direction, so they did not wait.

**→ Listen to these. Same match, same seeds, HEAD versus now, 16 seconds each:**

```
shots/audio/before-pizza-vs-taco.wav       shots/audio/after-pizza-vs-taco.wav
shots/audio/before-soup-vs-donut.wav       shots/audio/after-soup-vs-donut.wav
shots/audio/before-hamburger-vs-sushi.wav  shots/audio/after-hamburger-vs-sushi.wav
```

Start with **pizza vs taco** — that is the tomato you asked about. Its impact's top octave
(6–16 kHz) went from **32 dB under** the low band at the brightest instant of the hit to **22 dB
under**, and it now survives 150 ms instead of 90. The match is also no longer silent for two thirds
of its length: **21.9% → 58.6%** of it now carries sound.

These two were deliberately **not** taken, and both are still yours:

**1. Should the music keep playing during a match?** Today `shell.ts` fades it **out** for the whole
match. Brawl Stars never does this. The kitchen bed has now gone in underneath, so the 6.55-second
gap — 70% of an average match — is no longer *total* silence; it is a room. **That does not answer
the music question, it only stops it being urgent.** `shell.ts` has a live owner and is outside the
audio pillar's file set, so the fade was left exactly as it was. Three options, not exclusive: keep
the music playing under the match at a lower level, leave it faded and rely on the bed, or add
footsteps as well. It changes the feel of every match you have played of this build, so it is yours.

**2. Should `generic.hurt()` drop about 3 dB?** It is **40.9% of the energy of every moment you are
hit**. It is centre-panned at full level while the weapon that hit you is distance-attenuated, it is
tied for the loudest recurring sound in the game, and it has the **lowest centroid of all sixteen
keys** — sitting deepest into the band every weapon body already occupies. So the sound of *you
being hurt* is masking the sound of *what hit you*.

Dropping it would let you hear the weapon. Keeping it makes damage feel heavier. It is a real
trade and it is taste, not measurement — one number, trivially reversible either way.

**Its LEVEL is still exactly what it was**, on purpose. But its **spectrum** changed, because a
measurement made the case unanswerable: `tools/tmp/audio_mix.mjs --tilt` drops one sound at a time
from a real match and re-fits the whole spectrum, and of the sixteen sounds a pizza-vs-taco match
uses, **`hurt` alone was holding the game darker than the other fifteen combined** (+0.61 dB/octave
without it, against ~+0.90 for all the rest together). It now carries a contact spray, and its own
centroid went **1366 → 2205 Hz**. So "what hit me" is more readable than it was even at the same
level — which may be enough on its own, and is worth listening for before you decide about the 3 dB.

**A caveat on the target, stated by the agent that measured it:** pink noise at −3.0 dB/oct is a
*neutral broadband reference*, not a musical goal, and **there is no audio reference in this repo to
measure Brawl Stars against** — the reference plates are images. So "brighter, toward −4.0" is
steering by physics, and your ear is the only instrument that can say whether it landed.

**Where it landed, and the honest reason it is not −4.0.** Long-term tilt went **−5.57 → −5.07
dB/oct** across six matchups. That is a third of the way, and the pass that produced it moved the
individual hits far more than that number suggests: a single hit's 4–8 kHz band nearly doubled and
its 8–16 kHz band went up ~80%. The reason the whole-match average moves less is that **42% of a
match's total energy sits in one octave, 500–1000 Hz** — the countdown, the whistle, the result
sting, the hurt grunt, and the room prolonging all of them — and **19% sits in 63–125 Hz**, an octave
a phone speaker cannot reproduce at all. Getting to −4.0 means taking energy OUT of those two places,
not putting more in at the top: retuning the countdown/whistle/result pitches, and trimming the
sub-125 Hz fundamentals that are costing headroom without being heard. **Both are taste calls on
sounds you already know, so neither was taken.** Say the word and either is an afternoon.


---

## 18. The arena needs roughly twice the cover it has, and the only way there is a gameplay mechanic

The arena just took a full blind loop. It found and fixed a real defect — the whole arena had drifted
**a full stop below every reference plate** and nothing was railing brightness (frame luma mean
**0.322 → 0.402**, into the plates' band). **The blind score did not move: 4.0 → 3.875**, both rounds
valid, reference side scoring 8.0 and 8–9. The bar is 7+.

Two critics then reversed each other on the floor's value — which is the project's stop signal — so
the agent probed instead of looping. Three blockers came out, and **only one of them is art**:

| blocker | where it lives | status |
|---|---|---|
| props read as not standing on the floor | `render/lighting.ts` | **owned, in flight** |
| cover density ~17–20% vs reference 35–45% | **gameplay** | **needs you** |
| `playerRank` rail is self-contradictory | `tools/arena-scan.mjs` | instrument fix, queued |

### The density one is yours

Measured two independent ways that agree: a critic put our cover at *"~12% of screen area against
35–45% in all four reference frames"*, and an ID-buffer measurement independently put our standing
geometry at **17–20%**. Either way it is **roughly half**.

**It cannot be closed from `src/arena/`.** More solid props means more collision, and the layout's
collision was *just* tuned — the closing ring used to herd fighters into furniture (occlusion rose
30.6% → 67.7% as the zone closed; it now correctly falls 27.7% → 25.2%). Undoing that to add cover
trades a fixed gameplay bug for a visual one.

**The way the reference does it is bushes** — and in Brawl Stars, bushes are the single biggest
contributor to that 35–45%, precisely *because they are walk-through*. They add screen area without
adding collision. But walk-through concealment is a **gameplay mechanic**, not decoration: it means
hiding, ambushes, and an enemy you cannot see. That changes how the game plays, so it is your call
and not one an agent should make.

Roughly what it would involve: a new prop class in `src/arena/props/`, a concealment test in the
sim, an AI that understands it (the AI already has a flow field and hazard awareness, so this is
tractable), and a visibility rule for the camera. Non-trivial but well within reach.

**If the answer is no**, say so and the arena's ceiling on density is what it is — the remaining
arena-side wins are smaller and mostly cosmetic. The cheapest one already identified: the pink/teal
zone boundary is a hard straight edge with a bright cyan rim that a critic said *"reads as a
picture-in-picture window pasted over the frame."* Confirmed at crop, not yet fixed.

### One thing you should NOT be asked to decide

`playerRank` regressed 19.5 → 31 under the brightness fix, and the derivation shows the entire loss
is the term that rewards the environment for being **far from the player's luma** — measured with a
single character. The reference plates' own ground value is 0.40–0.46. **As constituted, that rail
forbids the arena from ever matching the plates it is scored against.** It is being re-derived as an
instrument fix. It is not a game problem and no one should tune the game to satisfy it.


---

## 19. Two small calls about leaving a match, now that reloads actually work

`shell.ts` never touched `history`, so the URL never named the screen and **any reload landed you on
home — including mid-match.** That is the mechanism behind your *"crashing mid-flight and starting
over from homescreen"*: HMR was the trigger, this was why it looked like a crash. Fixed (`171c2d2`):
the URL now names the screen, reloads land there, back/forward work, and all existing query
parameters survive.

**The resume rule chosen, and why.** A match is re-entered as a **fresh match of the same matchup**,
never restored mid-fight. A match has no serialised form anywhere in this project, and inventing one
hands you a fight you did not set up, at a disadvantage you cannot see. Nothing is lost, and that is
measured rather than assumed — the profile only banks on `phase === 'ended'`.

**Two consequences are yours:**

1. **Back out of a live match now abandons it with no confirmation.** The alternative is that back
   opens the pause sheet, which lives in `matchScreen.ts` — a different owner, so it was not done
   unilaterally. Which do you want?
2. **A mid-match reload restarts the match.** On the shared dev server that means an HMR reload
   restarts a match every ~9 s instead of dumping you to home. Arguably better, arguably more
   confusing. Either way, `node tools/tmp/playtest.mjs` remains the way to actually play — it serves
   a frozen production build with no HMR at all.

**One number is chosen rather than measured:** a lost GPU context now shows a notice immediately and
a Reload button after **3 s**. There is no data on how long a real restore takes on your hardware, so
if you ever see that button appear during normal play, that grace period is too short.


---

## 20. The cast is going to get wider, and you should see it

**This is the clearest measured gap in the game**, and for the first time a blind critic and an
instrument calibrated against real reference plates arrived at the *same quantity* from opposite
directions.

Measured in the live match, at the match camera and the **shipped spawn facing** — not the 22° preview
pose every previous character judgement used:

| | our cast | Brawl Stars (6 hand-verified plates) |
|---|---|---|
| hull deficiency | **0.1379** | min **0.2007**, median 0.2617 |
| shape events on the outline | **0.5** — *zero on 8 of 11* | median **2.5** |

The critic, blind, said it in words: *"Break the circular top-down outline… roughly a quarter to a
third of the outline area should come from non-body parts. Every character in the fox game has 3–5
shape events on its outline. The egg has zero."* Characters scored **3.25** against a reference side
of 7.75. The bar is 7+.

**Why this is proceeding without you.** Your standing instruction is to match Brawl Stars and Zooba,
and the reference plates are the specification — they are simply wider-stanced and carry more outline
detail than ours. Two things make it safe to act: it is **revertible per character** (self-contained
constants), and **you will get a before/after sheet of all eleven at match size** to judge in 30
seconds.

**What is actually changing:** stance widened from the **hips** (measured: soup 0.106 → 0.202,
hamburger 0.115 → 0.175), plus distinctive protruding features — a brim, a straw, a fin, a curl of
peel. ⚠️ Widening the **shoulders** instead was tried and rejected: it **detaches the mitts** on four of
five characters, confirmed by rendering it.

**The one number you may want to overrule:** at the magnitude that reaches the reference floor, a
STOUT stance is **1.4–2.0 m wide on a 2.1 m character.** That is a big proportion change. If it looks
wrong to you on the sheet, say so — it is one constant per character.

### Two related items, both already routed

- **Egg's cowl.** It bought the `p05` gate that was this project's #1 red item (0.270 → **0.060**) —
  but at match size it reads as a **two-tone sphere**, and the critic independently called out *"a
  crushed near-black hemisphere with a hard purple-rimmed edge cutting the body exactly in half."*
  Keep / soften / revert is being decided with your eye in mind, and will be reported.
- **The characters are drawn 25–35% too small.** Brawl Stars draws a brawler at 14–21% of frame
  height; ours are 11–15%. Measured by hand at native pixels *and* named independently by the critic.
  That lives in the camera's fair-play radius and is routed there — ⚠️ but it is guarded by
  `aspect.mjs`, a **competitive-fairness** gate, so it may prove impossible without breaking the
  guarantee that every viewport sees the same distance in every direction.
