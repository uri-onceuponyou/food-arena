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
| **6** | Lobby reference plates | — | ✅ **RESOLVED — Uri supplied 5 plates** | done |
| **12** | Game got harder | — | ✅ **DONE — flee fix + `ENEMY_MAX_HP` 90. Shipped at 52.2%** | landed |
| **15** | Should a fleeing enemy shoot at you? | — | ✅ **DONE — it aims at you now** | landed |
| **16** | Soup lost its red band, egg went cream, cast p95 is +0.027 over reference | shipped | **look at it — these are looks, not measurements** | per-character, self-contained |
| **17** | Music during matches · `hurt()` masking what hit you | silence · full level | **both are yours; the roster brightening is already going** | one line each |
| **18** | Arena has half the cover density of the reference — the fix is **bushes**, a gameplay mechanic | no concealment | **your call — this is a feature, not an art pass** | new mechanic |
| **19** | Back out of a live match abandons it silently · mid-match reload restarts it | abandon · restart | **two small feel calls** | one line each |
| **22** | **Character levels 1–15** | — | ✅ **DONE — shipped, and the flat curve is VERIFIED (1.9pp drift)** | landed |
| **23** | ⚠️ PvP makes `PLAYER_MAX_HP` ≠ `ENEMY_MAX_HP` **unfair by definition** | 100 vs 90 | **your §12 dial has a shelf life** | a roadmap item |
| **24** | Rarity vs level | — | ✅ **DONE — tier spread 20.7pp → 4.0pp, below the noise floor** | landed |
| **26** | ⚠️ **Rarity now buys NOTHING and costs 4.5× to level** | genre-faithful default | **needs you — rarity has no job left** | one multiplier, or a kit pass |
| **25** | ⚠️ **The 7+ bar is now calibrated** — the critic never scores shipped Brawl Stars above 9 | 7+ | **your bar is sound; the measurements under it were not** | — |
| **20** | Characters are proportioned narrower and drawn smaller than the reference | as-is | **stance widening is going ahead; the sheet is for your eye** | revertible per character |
| **1** | Match length | 45 s | **keep** — 35–45 s are all safe now | one constant |
| **10** | Two icons unreadable at 20px | as drawn | **change the subject**, not the drawing | a design call |
| **11** | Longer legs — every silhouette changed | longer | **keep** — legs now exist at all | 2 constants + 1 row/archetype |
| **5** | Floor hue as the blocking cue | restored | **keep** — two sources agreed it was a defect | six constants |
| **7** | Audio | as-is | ✅ **ANSWERED — "flat, monotonic, no splash on a tomato hit"** → now a build, not a tune | see §7 |
| **4** | `ROSTER_GATED` | off | **yours** — shop is built and honest either way | one flag |
| **2** | Timeout tiebreak | HP fraction → zone → you | **keep** (it now actually fires) | a few lines |
| **3** | Trail damage cap | 1 per tick | **keep** | one constant |
| **13** | Rarity runs backwards; the stat card is fiction | — | ⚠️ **PARTLY REVERSED by §24** — keep per-character stats, drop the rarity ramp | in flight |
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

**And the mix is silent most of the time.** Across 121 real matchups: mean play length **11.7 s**,
and the mean gap between the start whistle and the first combat sound is **5.00 s — 47% of the
match, in one unbroken silence**, with the music faded out and no ambience at all.

> ⚠️ **CORRECTED (`47feb9a`).** This was first recorded as **6.55 s / 69.9%** and reported to Uri as
> fact. That figure came from `audio_mix_record.mjs`, which carried a stale driver whose stuck
> detector ran during the countdown. Two separate errors were stacked in it: the fix itself takes
> **1.90 s** off (121/121 matchups moved, paired), and the old tool's answer was **a function of
> countdown length** — 6.55 / 6.17 / 6.04 / 6.55 s at `COUNTDOWN_FROM` 5 / 3 / 8 / 12, i.e. 0.51 s
> of spread from a quantity `sim.test.mjs` §21 proves the sim cannot see. With the fixed driver all
> four trees give **5.00 s, identical to the last digit.**
>
> **The conclusion survives; the number did not.** 5.00 s of silence in an 11.7 s match is still an
> enormous unbroken hole with the music faded out, so the ambience bed's justification stands.

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

> ## ⚠️ CORRECTED — the instruments that produced this section were contaminated
>
> An audit (`d9753ff`) found **ten** instruments sharing a stale driver whose stuck detector
> ran during the countdown. All three tools behind this section were among them. Verdicts,
> measured paired on identical seeds against a frozen `git archive` sim:
>
> | claim | verdict |
> |---|---|
> | **(c) 53 of 110 settled** | **SHIFTS — and it is WORSE: 70 of 110. 64% of the grid.** |
> | **(b) ρ = 0.327** | **WITHDRAWN** — does not reproduce (0.395 same conditions; 0.462 today) |
> | (a) rarity runs backwards | **stands**, but every tier number below is wrong |
> | "Hamburger is first in every measurement" | **FALSE — Taco is first** (83.3 vs 75.5) |
>
> **(c) decomposes exactly:** the driver fix alone 53 → 63, sim drift alone 53 → 59,
> combined **70**. And "fixing Lollipop moved it 53 → 52" came from the bad instrument.
>
> **(b)'s claim survives with a better argument that no number can move:** with n=11,
> significance needs ρ ≈ 0.62 — but the card's stat total takes only **five distinct values
> across eleven characters, six of them tied at 19.** It cannot discriminate *even in
> principle*. (Also: the text below says "four axes"; `STAT_ROWS` has **three**.)
>
> **Corrected tier means:** Cyber 29.5 → **41.5**, Neon 34.8 → **25.3**, Epic 12.5 → **24.7**.
>
> ✅ **Uri has answered this section: rarity MEANS power, build real health and speed.**
> The build is in flight and is using the corrected figures.


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


---

## 21. ✅ §12, §13 and §15 are all LANDED — and the roster problem halved twice

Your two answers are shipped. Numbers, all re-measured on the **fixed** driver (110 matchups × 32
seeds × 2 policies = 7,040 matches per row, paired):

| | settled matchups | rarity monotonic | player win |
|---|---|---|---|
| before | **70 / 110** | no | 27.4% |
| §12 + §15 (flee fix + HP 90) | 43 / 110 | no | **52.2%** |
| §13 (real health + speed) | **22 / 110** | **YES** | 51.8% |

**52.2% against the 52.8% you approved** — inside the ~9 pp resolution floor. (The baseline reads
27.4% rather than the 31.8% I quoted you because the *driver* was fixed in between; that 4.4 pp gap
was instrument artefact.)

**The rarity ramp now runs the right way:** Normal 40.4 · Rare 41.7 · Epic 46.3 · Legendary 50.0 ·
Neon 58.7 · Cyber 61.1 — from 66.6 / 63.3 / 19.7 / 68.0 / 24.7 / 42.7. The trophy road no longer
sells a downgrade.

### The finding inside it: **speed is a nearly inert lever**

Tested one character at a time on a neutral roster with a 20% speed cut: **nine of eleven move under
6 pp**, and the response is not even monotone — two get *better* at a 20% cut, four at a 10% one.
Only Donut responds strongly, and that is the Sticky Trail rather than speed. **Every point of the
result above is health.** The speed axis is kept and honestly scaled, but it is not what fixed
anything, and that is stated rather than implied.

### Three caveats, none of them hidden

1. **The ramp was fitted on the skilled policy.** Under the naive one the roster is much flatter
   (settled 71 → 57) but **not monotone**, and its aggregate falls 45.0 → 36.6% — 8.4 pp, just
   inside the floor.
2. **Pizza cannot be helped further.** It is already at `health: 10`, the top of the scale.
3. **The HP pools inverted** — the enemy now has 90 against your 100. Three assertions written
   against "the enemy has more HP" were re-derived to test the *rule* rather than the era.

### What the character card now says

**`src/ui/` needed no change** — it already read `def.stats[key]` as integers on a 0–10 scale. The
data changed; the view did not. The difference is that the bars now mean something: Hamburger reads
**10/3/5** (glass cannon), Pizza **4/10/5** (wall). Stat totals take **7 distinct values with no tie
above 3**, against **5 distinct values with a five-way tie** before. That was the structural reason
the card could not discriminate, and it is gone.

**One visual consequence of §15 to watch for when you next play:** a fleeing enemy now backpedals
**facing you** rather than turning its back, because the model rotates to `facing`. Genre-normal, and
it is what you already do — but you will notice it.


---

## 22. Character levels 1–15 — requested, in flight, and one call will come back to you

**Uri, verbatim:** *"I want the ability to improve characters in levels. 1–15, each level improves
damage and HP. To increase levels you need to spend coins/anything else. Add this and let's also
make sure the entire game economics is done."*

Being built as one vertical slice — model, sim, and both screens under one owner, because a level
system split across two agents produces two half-systems. Banked in phases so nothing is trapped:
model → sim → UI → completeness audit.

### ✅ ANSWERED — **the AI scales to the player's level**

> *"The game eventually should be humans vs. humans. We will incorporate AI players to enrich. They
> need to be adjusted to the player's level."*

So the win-rate curve across 1→15 is now a **verification, not a question**: it should come out
**flat** at ~52%, and a non-flat curve is a defect rather than a shape to park. Mechanically it is
the cheap path — `maxHpFor(id, roleBaseHp)` is linear in its base and asserted to be, so the same
level multiplier goes to both sides.

**The more important half is architectural**, and it is written up as §23: an AI opponent is a
*stand-in for a human*, which means difficulty belongs in **decision quality, not in stats**.

<details><summary>The original open question, for the record</summary>

### The one that will come back to you: **who else levels up?**

You tuned difficulty to **52.2%** an hour ago, after §12 sat parked for most of a day. **A level
system makes win rate a function of player level** — so unless the enemy scales too, the game is
trivially easy by level 15 and the number you just chose stops meaning anything.

You will get a **win-rate curve across levels 1→15**, not a single number. A flat ~52% across the
range is the obvious target, but the *shape* is yours: a game that gets slightly easier as you invest
is a legitimate reward, and a game that stays exactly level is a legitimate discipline. The default
shipped will be defensible and stated, not silent.

</details>

### The second interaction, and it is the interesting one

**Rarity became monotonic in strength an hour ago** (§13/§21: Normal 40.4 → Cyber 61.1). Levels are a
**second power axis on top of that one.** So: *should a level-15 Normal beat a level-1 Cyber?*

Both answers work, and they are different games. "Yes" means investment beats rarity and your free
starter stays viable forever. "No" means rarity is a hard ceiling and the trophy road is the real
progression. What must not happen is the answer arriving **by accident** — that is exactly how the old
roster ended up with the free starter as the strongest character in the game. **The crossover will be
measured and parked for you.**

### "The entire game economics is done"

Treated as a completeness audit rather than an extension: sources and sinks (levelling is a large new
sink — it must not starve unlocking, or vice versa), the cost-versus-strength curve, and pacing
**re-measured honestly** — the recorded ~13 hours to the last unlock was measured against a
**45-second** match, and mean play length is now **~11.7 s**, so that figure is stale by construction.

Two existing properties are protected: the shop still ships **visible and disabled** with its refusal
stated in the model's own arithmetic, and `ROSTER_GATED` is still never read (availability is
*derived*) — so **§4 remains your call and is not pre-empted by this work.**


---

## 23. ⚠️ Your §12 dial has a shelf life, and it is worth knowing now rather than later

You answered §22 with *"the game eventually should be humans vs. humans."* That has a consequence
worth stating plainly, because it is not obvious and it is cheap to design around **now** and
expensive later.

**Today `PLAYER_MAX_HP` is 100 and `ENEMY_MAX_HP` is 90.** They are separate **role** constants, and
that 10% asymmetry exists purely as a difficulty dial — the one you used two hours ago to answer §12.

**In humans versus humans, that asymmetry cannot exist.** Both sides are players; any role-based stat
difference is unfair by definition. So the dial is **temporary scaffolding**, and the level system is
being built **symmetric by construction** so that removing it later is a *deletion* rather than a
refactor. Nothing new will depend on the two sides having different bases.

### The better version of the same lever

If difficulty can be delivered through **AI decision quality** rather than an HP handicap, that is
strictly better for where this game is going: `ENEMY_MAX_HP` could return to 100 while keeping your
~52% target, and the AI would then be an honest stand-in for a human of the same level rather than a
deliberately weakened one.

That is plausible rather than proven. The AI driver has had three passes this session and its
competence is now well characterised — three real bugs fixed, and a fourth (the flee branch firing
backwards) that you chose to land. So the question is *answerable*, and the level agent has been
asked to report the size of the lever if its measurements reveal it. **Nobody will build it without
you** — it is a roadmap item, not a pending change.

**Nothing needs deciding today.** This is recorded so that when PvP arrives, the 90 is understood as
a dial that was always meant to come out, rather than a balance number someone is afraid to touch.


---

## 24. "Level 15 Normal beats level 1 Cyber" — and the consequence you should see coming

**Uri:** *"I think that level 15 normal should be able to beat level 1 cyber. Understand the logic of
how this works in common games and do the same."*

### How the reference games actually do it

Brawl Stars (power 1–11) and Clash Royale (card levels 1–14) share one structure:

1. **Level applies a percentage scale to HP and damage** on the character's own base — roughly
   +5% to +10% per level, a **1.5×–2.5× total swing** across the ladder.
2. **Rarity does not confer power at equal level.** It governs **how hard the character is to get and
   to upgrade**, not how strong it is when two characters sit at the same level.
3. **Matchmaking pairs similar investment**, so maxed-versus-fresh is an edge case, not the norm.

A level-14 Common beats a level-1 Legendary in Clash Royale for a simple reason: **the level range is
wide and the rarity range at equal level is zero.**

### ⚠️ This game has already chosen the opposite of point 2 — and that is fine, but it has a price

**§13/§21 made rarity monotonic in strength** (Normal 40.4 → Cyber 61.1, a ~20 pp spread), an hour
before you asked for this. So Food Fight Arena stacks **two** power axes where the reference games
have one.

If both rarity and level grant raw power and **nothing else differs, a rare character is strictly
better forever** — same level, more power, always. Your two answers would quietly contradict each
other everywhere except the exact L15-vs-L1 case you named.

### The resolution being built: **rarity buys power, and pays for it in cost**

Rarer characters are **more expensive to level**. That satisfies both of your answers at once:

- **§13 stays true** — like for like, at equal level, rarer *is* stronger.
- **§22/§24 stays true** — investment overcomes rarity, because the level range is wider than the
  rarity spread.
- **The trade becomes legible to the player** — *a rare character is a better long-run investment; a
  common one is cheaper to max.*

That is Clash Royale's rarity-scaled upgrade cost, transplanted onto a game where rarity **also**
grants base power. **This is a design call made from your two answers rather than one you gave
explicitly** — flagged here so you can overrule it. The alternative is to flatten rarity's power back
to zero at equal level (the pure genre pattern), which would undo §13.

### What you will get back

- The **measured crossover**: at what level a Normal overtakes a level-1 Cyber, and confirmation that
  it **never** overtakes a *level-matched* Cyber — that second one is what keeps rarity meaningful.
- Both measured **under both policies**, since the rarity ramp is monotone under the skilled policy
  but not the naive one.
- A **top-end sanity check**: ~+5%/level over 14 steps is ~1.7× on HP *and* damage simultaneously,
  i.e. roughly **2.9× effective combat power** against an unlevelled opponent. That is a big number
  and it needs to not break anything.


---

## 24b. ⚠️ REVERSAL — rarity does not grant power, and the reason is your own §22 answer

**Uri:** *"Match how common games do it. There is a reason for it."*

He is right, and I had it wrong. My §24 compromise — rarity grants power *and* costs more to level —
is **withdrawn**. The pure genre pattern is being built instead.

### The reason, stated because it is the whole point

**Rarity-as-power is pay-to-win, and it is the one imbalance that skill cannot close.** A player who
got a Cyber has a permanent edge over an equally-skilled, equally-invested player who did not.

That is tolerable in a single-player game and **fatal in a competitive one** — and §22 says this game
is *"eventually humans vs. humans."* Which is exactly why every game in this genre puts rarity on
**acquisition** rather than on **strength**: Brawl Stars brawlers differ wildly in kit and are roughly
balanced at equal power level; Clash Royale's rarity sets how many copies a card needs, not what it
does.

**Levels are a legitimate power axis precisely because anyone can reach them** — they cost time, not
luck.

### What changes, and what is kept

**§13/§21 did two things and only one is being undone.**

| | verdict |
|---|---|
| **per-character health and speed as real stats** | ✅ **KEPT** — this was the actual prize: **settled matchups 70 → 22 of 110**, because the matchup matrix finally had a second axis. Must not regress. |
| **those stats correlating with rarity tier** | ❌ **REMOVED** — the ramp Normal 40.4 → Cyber 61.1 flattens. |

**The distinction that matters: characters should differ in *shape*, not in *total*.** The card
already gets this right — Hamburger **10/3/5** (glass cannon), Pizza **4/10/5** (wall). Those are
trade-offs at comparable totals. What goes is any tendency for the *totals* to climb with rarity.

**Rarity keeps two real jobs**, and they are the ones that make it feel valuable: how hard a character
is to **obtain**, and how expensive it is to **level**. That half of §24 survives — it is the genre
pattern, and it is what makes a rare character an investment rather than an advantage.

### The one thing that could still come back to you

If flattening rarity turns out to cost the **settled-matchup count**, that is a real tension between
two of your goals — a balanced roster and a varied one — and you will get the numbers rather than a
silent trade.

*(§13 remains correct about the defect it found: the trophy road was selling a downgrade and the stat
card was fiction. Both are fixed. Only the "rarity = power" remedy is reversed.)*


---

## 25. Your 7+ bar is sound — but everything measured against it needs re-reading

The blind-critic instrument has been audited for the first time. Three things you should know.

**1. It cannot resolve differences smaller than ~1.4 points.** σ = 0.50 across 16 fresh critics on
one fixed image. And a round's two panels are **n = 1**, not n = 2 — one critic scores both and
agrees with itself 4 times out of 4.

⚠️ **So "the characters got worse" was never an observation.** The history reads 3.6 → 3.25 → 3.0 →
2.0, and the largest single step is **1.0** — inside the floor every time. I reported those moves to
you as real. They were not. **The correct reading is that characters have sat at roughly 3, ±1.4,
throughout** — which is still far below your bar, but it is a plateau, not a decline.

**2. Your bar is well placed, and now calibrated.** Over 34 observations the critic **never scores
shipped Brawl Stars above 9**, and typically 8–8.5. So **7+ sits about 1–1.5 points below shipped
Brawl Stars** — demanding, reachable, and not asking for a perfect score. That was a good instinct.

**3. The instrument had two uncontrolled levers, both now fixed.** The *rubric* is worth **2.0
points** — the same sheet reads 5.0 under "overall visual quality" and 3.0 under "character design
only", with the reference side unmoved — and there was **no canonical prompt in the repo**; every
round was written fresh. And all three character rounds drew **4 of 6 Zooba plates** (over-the-
shoulder camera) to score a top-down game, repeating a defect already recorded for the arena.

### What the critics actually mean, now that it is measurable

**"The failure is mass, not scale."** Burrito measures head **46 px** wide, body **15 px**, figure
126 px tall — a needle. Hull deficiency and appendage count are **area-blind**, which is why 11 of 11
characters clearing the silhouette floor changed nothing.

⚠️ **And a constant was moved on a wrong number.** Our character is **10.4% of frame height** (14.2%
with legs) against **Shelly at 12.5%** in the same plate — two blind critics independently measured
~12%. The 14–21% figure that justified `CHARACTER_HEIGHT` 2.1 → 2.35 **was wrong**; the critic's
10–12% was right. That is being re-derived. **The sheet I sent you still stands as a look — just not
as a size correction.**

**One concrete defect, fully verified:** **24.3% of our egg is clipped near white** (p95 0.981)
against Shelly 0.2% and Barley 0.0%, on exactly the top-facing surfaces a top-down camera sees most
of. Empty-floor controls read 0.0%, so it is the character. That is the cost of the value pass,
visible at the pixel — and it is fixable without any critic at all.


---

## 26. ⚠️ Rarity now buys nothing, and costs 4.5× to level

This is the direct consequence of *"match how common games do it"*, and it is the one thing from the
level build that needs you.

**What shipped, and it is genre-faithful:** rarity no longer grants power (tier spread **20.7 pp →
4.0 pp**, below the ~9 pp noise floor), and instead scales **upgrade cost** 1.0× → 4.5× — Normal
costs **44,770** coins to max, Cyber **201,460**.

**The problem:** in Clash Royale that cost scaling is a *consequence* of copy scarcity — rare cards
are hard to *find*, and the cost reflects it. Here there is no scarcity mechanic behind it. So once
you own a rare character, rarity is a **pure penalty**: same power, 4.5× the price.

**Three ways out:**

| | what rarity would mean | cost |
|---|---|---|
| **keep it** | prestige and kit variety only | nothing — already shipped |
| **flatten the cost** (multiplier → 1.0) | nothing at all, honestly | one constant |
| **make rarer kits more DISTINCTIVE** ⭐ | rarity buys *character*, not power | a kit pass |

**I would take the third**, and I have started it — it is the only option that gives rarity a job
worth having, and it does not foreclose either of the others. A rare character that plays *unlike*
anything else is a genuine reward and is exactly what Brawl Stars sells: its rarest brawlers are not
stronger, they are **weirder**. It also serves the roster directly — **17 of 110 matchups are still
decided before they start**, and kit variety is what breaks those.

⚠️ **Note what it must NOT become:** "more distinctive" cannot quietly mean "stronger", or rarity
becomes power again through the back door and PvP is pay-to-win after all. The measured guard is the
tier spread staying inside the noise floor.

---

## Also from the level build — three smaller things

**A number I quoted you was wrong by 4.7×.** Every "hours to unlock" figure came from a `const MIN =
2` literal left over from when a match was 180 s. The full roster was quoted at **~15 hours**; it is
**394 matches ≈ 2.8 hours**. Pacing assertions are now in *matches*, never hours, with the one
invented input (10 s of menu time per match) labelled as assumed.

**The shop was promising power that rarity no longer sells** — "with a chance of **better**", including
in an aria label read to exactly the users who cannot check the visual. Now says "rarer", with a
statement of what rarity actually buys.

**Coin-bought boxes are strictly dominated** while `ROSTER_GATED` is false — 900 coins returns 138 EV.
They only become a real coin sink when that flag flips, which is still **§4, and still yours.**


---

## 27. ✅ §6 RESOLVED — and two of your plates confirm today's decisions

You supplied five menu plates. They are in `reference/images/curated/menus/`, **gitignored and verified
invisible to git** (`.gitignore:19`).

`bs_home` · `bs_roster_grid` · `bs_character_detail` · `zb_character_detail` · `zb_progression` ·
**`zb_home`**

⚠️ `zb_home` contains Uri's own account details (display name, signed-in username, a friend's name).
It is gitignored and stays local, which is correct — **those strings must never appear in a report,
a packet, or any committed file.** Refer to it by filename only.

**This unblocks all menu scoring.** Three consecutive menu rounds had been scored against *in-match
combat frames*, and both critics flagged it unprompted every time. The re-score in flight has them.

### `bs_character_detail` independently confirms §24b

Brawl Stars shows rarity as **"EPIC"** — a small purple word tucked under the role label
("MARKSMAN"). It is **not a stat, not a bar, not a number.** The stat panel next to it lists only
**HEALTH 6000 · ATTACK 2800 · SUPER**, and above them **POWER 11 / MAX 11** as a pip bar.

That is exactly the structure you asked for with *"match how common games do it"* — rarity is a
**label**, power is a **level**. Your reversal was right, and the shipped reference proves it rather
than my arguing it.

⚠️ **It also sharpens §26.** In Brawl Stars, rarity carries *no* mechanical job at all — not power,
and not an upgrade-cost penalty either. So of §26's three options, the plate supports **flattening
`rarityCostMultiplier` to 1.0** and letting rarity be pure acquisition-and-prestige. The kit pass
independently reached the same conclusion by measurement: *"rarity cannot be given a distinctiveness
job in this roster at a price worth paying — §26 should resolve on one of its other two branches."*
**Two independent routes, same answer.** That is now a one-constant change in `economy/tuning.ts`
whenever you say so.

### ✅ `zb_home` confirms the level range you picked — **Zooba's max is 15**

Its hero card reads **"MAX · 15 · 343/680"**. You asked for *"levels 1–15"* without reference to
hand; that is **exactly Zooba's ladder**, and Brawl Stars' is 1–11. So the range that shipped sits
right where the genre puts it — not a number we invented and then had to defend.

The progress display is the part we do not have: **343/680 toward the next step**, on the home screen,
on the character you are about to play. Ours shows a level with no sense of how close the next one is.

`zb_home` is also the **second home plate**, so home goes from the weakest-covered element to the
best-covered — two independent games to compare against instead of one.

### `zb_character_detail` is a blueprint for the level UI we just shipped

Worth comparing against what landed today:

| Zooba does | we do |
|---|---|
| level **13** with a **314/340 progress bar** | level number — check we show progress to next |
| HEALTH **8025** / DAMAGE **5598** / SPEED **102** — real numbers **plus** segmented bars | 0–10 integer bars only |
| a prominent yellow **UPGRADES** CTA beside SELECT, with a badge count | upgrade control shipped — compare prominence |
| weapons as **separate named cards** (BOW RAPID FIRE · SPEAR SINGLE SHOT · BOMB THROW) | weapons not surfaced on the card |
| left nav: Info · Upgrades · Items · Weapons · Skins | single panel |

And `bs_roster_grid` shows **power level as a circled number on every card**, with green **"+"** pips
where an upgrade is affordable — a legible "you have something to spend" signal we do not have.

**None of this is queued yet** — it is a comparison, not a decision. But it is the first time this
project has had a picture of what the destination looks like for these screens, and it will make the
next menu pass measurable instead of speculative.

---

## 27. The title card's blue backdrop — measured, and the only remaining lever is not in that file

The opening screen is the first frame of the product and had never been judged as one. It is
otherwise sound; one thing on it is not, and it is worth thirty seconds of your eye.

`charStage.ts`'s 3D set — deep-blue cyclorama, floor, horizon — is a large, well-measured win on
home and character select, where it is framed as a display case. On the **title card** it is
supposed to be invisible, and it is not: a cool pool with a horizon line runs across the frame
behind the fighter's chest. It is worst in portrait
(`shots/screen_m/loose/final-opening-phone-portrait.png`).

**Both levers inside `opening.ts` are now measured and both are closed** (`tools/tmp/openglare.mjs`,
a two-frame differential with a drift control of ±0.14 pp / ±0.45%):

| | cool share of the stage box | fighter + podium pixels |
|---|---|---|
| **shipped mask** | 6.15% | 168,306 |
| tighter core | 1.88% | 116,270 — **−31%** |
| tighter still | 0.73% | 73,572 — **−56%** |

**Every mask that removes the blue removes the character with it**, by 60× the drift floor. The
shipped values are exactly where that lever runs out.

The other lever — a warm veil over the patch instead of a cut — loses no geometry at all and takes
the cool share 7.62% → 2.16%, and it was **rejected on the pixels**: it desaturates the hero into a
sticker behind frosted glass, spending precisely the figure/ground the 3D set was built to win
(−0.23 → +0.19). See `shots/open/phone-portrait-glow-warm-veil-30.png` — that one is worth looking
at, because the numbers alone say it is a good trade and the image says it is not.

**❓ What would actually fix it: a per-mount backdrop colour on the shared stage** — a warm
cyclorama for the title card only, cool everywhere else. That is `charStage.ts`, a different owner,
and it is a look change on a screen three others share. Say the word and it is an hour.

**If the answer is "leave it"**, that is a legitimate answer and the trade is now written down in
`opening.ts` in numbers rather than in prose, so nobody re-derives it.

### Two smaller things from the same pass, neither blocking

- **Rebinding ships for the four MOVEMENT keys only**, and the arrow keys are deliberately fixed as
  a fallback so no stored blob, hand edit or half-finished rebind can leave a player unable to move.
  Mute, pause, aim and fire are stated as fixed **because they are** — they are compared as string
  primitives inside their own modules. If you want those rebindable too, it is a small change in
  `game/input.ts` and `matchScreen.ts` rather than in the settings screen.
- **`settings.ts` now WRITES `MOVE_KEYS`**, the table `game/input.ts` exports and `moveAxes()` reads
  every frame. That is what makes a rebind live on the next tick with no reload, and `input.ts`'s own
  header anticipated it — but the honest shape is for `input.ts` to own a `setMoveKeys()` and for the
  UI to call it. Worth tidying when that file is next free; nothing depends on it happening.
