# Parked for Uri

Decisions that need human judgement. **Nothing here is blocking** — work continued past every
item using the stated assumption. Each entry says what was assumed, what it would cost to
change, and where the change would land.

Answer any subset. Unanswered items stay on the stated assumption.

---

## 🔴 OPEN RIGHT NOW — four questions, four one-line answers

**As of `63407e8`, 2026-08-12.** Everything else on this page is history; these four are live.
**Nothing is blocking** — every one has a default in force and running.

| # | question | in force | what I'd do | cost to reverse |
|---|---|---|---|---|
| **§66** | 🔴 **Six-player has NO way in.** Where does the button live? How are the other five chosen? What level are five bots? | QA URL only | **Answer (1) and I'll wire it — ~15 lines.** A "Brawl" tile on home, five bots at your own level, is the smallest coherent version | it is new UI; nothing existing changes |
| **§58** | ✅ **ANSWERED 2026-08-12 — and by PLAYING it, not by reading this page.** Uri hit the defect in a live match and specified the replacement schedule. **→ §72.** The recommendation on this row was *"keep 30 s"* and it was **WRONG**: it treated the trigger as a tuning choice when the 30 s trigger was **truncating the ring schedule**, which is a bug | — | — | landed in §72 |
| **§71** | **Three icon subjects** — `boxBurger`, `stun`, `wrap` | as drawn | ⚠️ **"Leave it" is a real answer for all three** — every one ships beside its own text label. If you pick one, pick `wrap`: 0 of 30 judges, ten panels, and all three geometric options are closed by measurement | one drawing each |
| **§33** | **Your phone model + iOS version, and a fresh 10-second capture** | unknown | **This is the only experiment that turns "−47.9% on desktop" into a real number on your device** | — |

**If you only do one thing: play it for ten minutes.** The two most valuable bug reports this project
has ever had came from exactly that, and both were invisible to every gate here. It has changed a lot
since you last played — the map is 4× bigger, the controls moved off the play area, and the frame is
**54% cheaper**.

**If you only answer one thing: §66.** It is the only one holding real work back, and it unblocks two
finished things that are currently unreachable (the payout curve and the result card).

---

## The history — everything previously parked, and where it landed

⚠️ **This table used to be the answer sheet and told you *"if you only answer one thing: #6"* — which
had been resolved for days.** It is kept as the record; the live questions are above. Detail for every
row is in the numbered sections below.

| # | question | in force now | my recommendation | cost to reverse |
|---|---|---|---|---|
| **6** | Lobby reference plates | — | ✅ **RESOLVED — Uri supplied 5 plates** | done |
| **12** | Game got harder | — | ✅ **DONE — flee fix + `ENEMY_MAX_HP` 90. Shipped at 52.2%** | landed |
| **15** | Should a fleeing enemy shoot at you? | — | ✅ **DONE — it aims at you now** | landed |
| **16** | Soup lost its red band, egg went cream, cast p95 is +0.027 over reference | shipped | **look at it — these are looks, not measurements** | per-character, self-contained |
| **17** | Music during matches · `hurt()` masking what hit you | silence · full level | **both are yours; the roster brightening is already going** | one line each |
| **18** | Arena has half the cover density of the reference — the fix is **bushes**, a gameplay mechanic | inert, built | ✅ **ANSWERED — Uri: *"add bushes, but make it relevant to kitchen. For example plates you can hide under."*** Sim mechanic shipped inert; **→ now §29** | done |
| **19** | Back out of a live match abandons it silently · mid-match reload restarts it | abandon · restart | **two small feel calls** | one line each |
| **22** | **Character levels 1–15** | — | ✅ **DONE — shipped, and the flat curve is VERIFIED (1.9pp drift)** | landed |
| **23** | ⚠️ PvP makes `PLAYER_MAX_HP` ≠ `ENEMY_MAX_HP` **unfair by definition** | 100 vs 90 | **your §12 dial has a shelf life** | a roadmap item |
| **24** | Rarity vs level | — | ✅ **DONE — tier spread 20.7pp → 4.0pp, below the noise floor** | landed |
| **26** | ⚠️ **Rarity now buys NOTHING and costs 4.5× to level** | genre-faithful default | **needs you — rarity has no job left** | one multiplier, or a kit pass |
| **28** | 🆕 Hamburger's heal 25 → **18 HP**, after the measuring instrument was fixed | 18 | **measured to ±3 HP; the exact integer is a feel call.** ⚠️ And the constraint has moved off Hamburger onto **Legendary at the bottom** — the next balance pass is a Sushi pass | one constant |
| **29** | 🆕 **Concealment is BUILT and inert.** Three calls before it ships | off | ⚠️ **(a) bush size is now an AI constraint — ~168wu max, big hero bushes are OFF — STILL OPEN, awaiting your read of the size screenshot** · (b) ✅ **DONE — fully hidden, verified on pixels** · (c) ✅ **DONE — attacking BREAKS the plate and reveals you for 500 ms (`f0e7aed`), and §35's projectile leak closed with it** | (a) is a re-layout once patches ship; (b)(c) landed |
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
| **51** | 🆕 **The mobile app — which wrapper?** | nothing chosen | **the bundle already survives a third base (4/4, with both known-bad controls failing), so this is a wrapper pick + one `index.html` line.** ⚠️ `file://` is measured UNBOOTABLE — it needs a scheme | a wrapper is swappable; no `src/` change either way |
| **52** | 🆕 **Multiplayer transport — authoritative server, lockstep, or rollback?** | nothing chosen, nothing shipped | **authoritative, with prediction of your own fighter — host peer first.** The number: a six-human tick costs **2.66 µs** (0.016% of real time, ~6,260 matches/core), so the CPU lockstep saves is free, while the bit-identical floats it *requires* span **32 impl-approximated call sites** across three browser engines. Full evidence in `docs/NETCODE.md` | no `src/` change either way; the sim already takes one input per slot |

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

## 26. ✅ ANSWERED AND SHIPPED — rarity costs the SAME to level as everything else

> **Uri, 2026-08-05: *"26 - go"*.** Then again on 2026-08-06: *"as far as i understand in all other
> games it means nothing besides the rarity to obtain it."*

**Landed.** `rarityCostMultiplier` is **1.0 across every tier** (`68cac7a`), and the player-facing
copy that still contradicted it was fixed in `33a0048`. **Nothing here needs you. Do not re-decide it.**

| tier | multiplier | cost to max, before | after |
|---|---|---|---|
| Normal | 1.0 → 1.0 | 44,770 | **44,770** (unchanged) |
| Rare | 1.35 → 1.0 | 60,440 | 44,770 |
| Epic | 1.8 → 1.0 | 80,590 | 44,770 |
| Legendary | 2.45 → 1.0 | 109,690 | 44,770 |
| Neon | 3.3 → 1.0 | 147,750 | 44,770 |
| Cyber | 4.5 → 1.0 | 201,460 | **44,770** (−77.8%) |

Tier spread **156,690 coins (4.50×) → 0**. Whole roster 1,208,810 → 492,470 coins.

⚠️ **But do not read that as an economy-wide loosening.** Normal *was* the 1.0× tier, so **the
cheapest path through the game did not move by a single coin.** Nothing was made easier; a penalty
was removed from the people who had been paying it.

**Verified by mutation, not by grep:** setting the ladder back to 1.0→4.5 and re-fingerprinting every
box price, box odd, trophy-road reward, store product, duplicate value, match payout and starting
balance leaves **all of them identical**, while `costToMax(Cyber)` *does* move — so the probe is live
rather than inert. `levels.ts:44` is the only consumer.

### 🚨 The defect this uncovered, and it is the interesting part

The constant was flattened yesterday. **The sentence describing it to players was not.**
`RARITY_MEANING` — rendered by **both** `shop.ts:511` and `trophyRoad.ts:586` on the **drop-rate
sheet, the one screen this product treats as a legal disclosure** — still read:

> *"Rarity sets how hard a fighter is to find **and how much it costs to level up**"*

It stopped being true in the same commit that wrote *"It no longer affects levelling cost at all"*
into a comment **three lines above it**. **168 shop assertions and 220 economy assertions passed over
it**, because `shop_accept` re-derives every *number* on the screen and this was the one part of the
disclosure that was **prose**. Now derived from `LEVEL_UP` and guarded in both places, each guard
shown to FAIL on the wrong sentence.

**The general lesson, which is worth more than the fix:** a battery that checks every number will
sail past a false *claim*. Where a screen makes a promise in words, the words need deriving too.

### The old recommendation is WITHDRAWN, and the reason is recorded

This entry used to recommend *"make rarer kits more DISTINCTIVE"* as the way to give rarity a job.
**That was measured and rejected** — `rules.ts:2370` records eight candidate kits tested with
**0 of 55 pairs indistinguishable** and no balance change shipped. Uri's answer supersedes it
anyway: rarity is **acquisition rarity only**, which is the genre norm and needs no job beyond it.

<details>
<summary>The original entry, kept because the reasoning was sound and only the premise changed</summary>

The argument was that in Clash Royale, cost scaling is a *consequence* of copy scarcity — rare cards
are hard to *find*, and the cost reflects it. Here there is no scarcity mechanic behind it, so once
you own a rare character, rarity was a **pure penalty**: same power, 4.5× the price. Three ways out
were offered — keep it, flatten the cost, or make rarer kits more distinctive — and the third was
recommended on the grounds that Brawl Stars' rarest brawlers are not stronger, they are *weirder*.
**Uri chose the second.** The guard that mattered still stands either way: "more distinctive" must
never quietly mean "stronger", or rarity becomes power through the back door.

</details>

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

---

## 28. Hamburger's heal is now 18 HP — the exact integer inside 15–21 is yours

**Assumed: `healAmount: 25 → 18`.** Landed in `80ae0e0`. Nothing is blocked on you; this is a
"do you like the feel of it" call, and it is the only number in this pass that measurement could
not settle on its own.

**Why it moved at all.** The instrument that balanced this roster **twice** could not press heal —
`bestWeapon` opened `if (w.type === 'self') return;`. With that fixed (plus a second, larger fault
in the same function), Hamburger became the strongest character in the game and the rarity guard
you settled in §24b/§26 blew from 3.98 pp to 15.94 pp. Dropping the heal to 18 brings it back to
**8.05 pp**, under the ~9 pp floor, so your "rarity is not power" ruling holds.

**What is measured, and what is not:**

| | |
|---|---|
| the **ladder** — 25 → 70.9% strength · 22 → 63.1 · 20 → 60.6 · **18 → 53.4** · 15 → 40.3 | **measured**, monotone, spanning 30.6 pp at **3.06 pp of strength per 1 HP** |
| 18 is the **argmin of the tier spread** and the only rung clearing the floor | **measured** |
| 18 vs 20 specifically | **NOT resolved** — 2.8 pp strength / 3.2 pp spread, both inside the ~9 pp floor |

So: **the direction and the magnitude are measured to ±3 HP. The exact integer is not.** If 18 makes
the heal feel like a non-event when you play it, 20 is free — it costs 3.2 pp of spread and stays
under the floor. Below 15 the spread gets *worse* again, because Normal then falls past Legendary on
the other side.

> 🚨 **CORRECTION (2026-08-10): the range above is 18–21, not 15–21.** `sim.test.mjs` §25(c) requires
> the heal to clear a quarter of Hamburger's 70 HP pool, i.e. `healAmount > 17.5`, so **15, 16 and 17
> turn a gate red.** The measured ladder and the admissible range were never the same range and
> nothing said so. If you want one of the three anyway, say so — the threshold moves, not the heal.

**⚠️ One thing you should know, because it changes what the next balance pass is about.**
The constraint has **moved off Hamburger**. At 18 the tiers read:

```
Normal 53.0 · Rare 52.3 · Epic 53.0 · Legendary 45.0 · Neon 49.5 · Cyber 48.7
```

The 8.05 pp spread is now set by **Legendary at the BOTTOM** — Sushi 43.8%, Water Bottle 46.3% —
not by anything at the top. **Sushi is the weakest character in every driver variant measured.**
Every document here frames tier spread as a Hamburger problem; that framing expired the moment the
driver was fixed. **The next balance pass is a Sushi/Legendary pass, and it has to push Legendary
UP** — there is no version of pushing Hamburger further down that helps.

> ✅ **RUN, AND REFUSED — 2026-08-10. Nothing here needs you; this is recorded so it is not run
> twice.** Health is the only lever (speed is inert, Sushi is already at the speed cap), and the
> measured ladder says **one card health point is worth 13.5–27.9 pp** of a character's strength —
> **1.7× to 3.5× wider than the whole 8.05 pp band it would have to land inside.** Of six candidates
> only one lowers the spread at all (Sushi health 6: 8.05 → 7.03 pp), that 1.02 pp is *inside* the
> ~9 pp floor and therefore not a real improvement, and it costs a real one: the roster's strength
> range goes 9.7 → 16.6 pp, Sushi flips from the weakest character to the strongest, and Cyber takes
> Legendary's place at the bottom. **The roster's floor does not rise — it falls 0.5 pp.** Full
> arithmetic in `rules.ts` under "THE SUSHI/LEGENDARY PASS WAS RUN".

**And a second-order note, for whoever runs that pass.** At 18, Hamburger's role split has flipped
sign and grown: **asPlayer 62.5% / asAI 44.4% = −18.1 pp** (it was −9.4 pp at heal 25, inside the
floor; the original bug was +50.6 pp the other way). Each half is an aggregate over 10 matchups ×
32 seeds, so −18.1 pp is **outside** the ~9 pp floor and −9.4 was not. Hamburger is now measurably
better in your hands than in the AI's — at about a third the magnitude of the split just closed.
Strength (the role-symmetric mean) sits at the roster mean, so this was not re-opened; it is
recorded so nobody rediscovers it as a surprise.

**Cost to change:** one constant in `src/game/rules.ts`. Re-run
`node tools/tmp/roster_lab.mjs --seeds 32` and read tier spread, which binds before win rate does.

---

## 29. Concealment is BUILT and inert — three calls before it can ship

You approved this in §18: *"add bushes — but make it relevant to kitchen. For example plates you
can hide under."* The **sim mechanic exists now** (`1c140c0`) and is **switched off**: no arena ships
a concealment region, so the game plays exactly as before. That is proven, not asserted — 110
matchups × 32 seeds stepped in lockstep against a git-extracted HEAD, every field compared after
every tick: **0 differing ticks in 3,283,873**.

The rule is one sentence: **while you are concealed, nothing that tracks you updates.** The AI's
belief freezes at your last sighting, and *visibility* — not believed distance — gates the shot.

### ⚠️ 1. BUSH SIZE IS NOW AN AI CONSTRAINT, NOT A TASTE ONE. Read this before any art is made.

`stepAI` **has no search behaviour**. It walks to where it last saw you, stops, and can see 84 wu
from there. Measured both ways: at half that radius it re-acquires; at double, it **never does** —
final separation 363 wu, never sighted.

**So a large bush is a permanent AI-denial zone.** A player who stands still inside one breaks the
enemy for the rest of the match.

> **The constraint: many SMALL patches. No interior point more than ~84 wu from an edge the AI
> might walk in through — i.e. patches up to roughly 168 wu across.**

**Big hero bushes are off the table** unless someone builds AI search, which is a real piece of work
and not currently planned. This arrived independently from two directions: the architecture probe
measured that the reference's cover is *dozens of small tufts*, not a few big masses, and the sim
agent hit the same number from the AI side. **Two derivations, one answer — that is as close to
certain as this project gets.**

### 2. Half-hidden, or fully hidden? — **this one actually blocks shipping**

While concealed, the enemy's **radar blip, HP bar and 3D model are all still drawn.** Each is a
one-line change in a file the sim agent did not own (`ui/hud.ts:757`, `game/match.ts:1191`), and
`Fighter.concealed` is already published for exactly them.

**Shipping without them means concealment reads as broken** — you hide, the AI loses you, and your
own screen still shows it tracking you perfectly. My recommendation is to hide the blip and the HP
bar and **keep the model visible** (you should always see where you are), but the reverse is a
legitimate design choice and it is yours.

### 3. Should attacking reveal you?

Genre norm — in Brawl Stars, firing from a bush exposes you. **Deferred deliberately**: it is a
second rule with its own balance cost, and it cannot be measured until regions actually exist.
Your call whether it ships with v1 or after.

> ✅ **ANSWERED in §30 and now BUILT (`f0e7aed`).** *"attacking from under it will break it and
> reveal you. You can also step out and attack."* Both halves shipped: the plate is **destroyed**
> (a consumable, one ambush each — and it stops concealing the *opponent* too, because the object
> broke), and the attacker is **exposed for 500 ms** so it cannot break a plate and vanish into the
> next one in the same tick. Pressing the **heal** does neither — it is not an attack. Still inert;
> the balance cost you were told about is still unmeasured, and stays unmeasured until §29a's
> plates are placed.

### One number NOT to trust, and why I am telling you rather than quoting it

A first placement measurement says the player would spend **1.51%** of its time concealed against
the enemy's 23.90%. **Do not read that as "concealment is worthless."** The scripted player used to
measure it has *perfect information and no concept of concealment at all* — by design, because
giving it perception would invalidate every balance number in the project. So that figure bounds
**what the harness can see**, not what the feature is worth to a human.

What the same run *did* establish, and this is real: only **86 buildable 80×80 cells exist** in the
whole arena once cover and the endgame keep-out are removed, and player traffic and enemy traffic are
**spatially segregated** — the player is at **0.000%** in every one of the enemy's four busiest
cells. **A single set of bushes cannot be high-traffic for both fighters.** That is a level-design
tension worth knowing before the patches are placed, not after.

**Cost to change any of this:** the mechanic is inert until an arena declares regions, so all three
answers are still cheap. Once patches ship, (1) becomes a re-layout.

---

## 30. ✅ URI'S ANSWERS, 2026-08-06 — eight settled, two deferred, one new bug

Verbatim answers, with what each one changes. **Do not reopen these.**

### ✅ §29b — FULLY HIDDEN. And it is NOT bushes.

> *"it's supposed to be plates and other kitchen objects you can hide under — fully hidden.
> Bushes don't make sense in a kitchen."*

**Two decisions in one sentence, and the second is a correction every document here needs.**

1. **Fully hidden.** While concealed, the enemy's **radar blip, HP bar AND model** are all hidden.
   Not the half-measure I recommended. `Fighter.concealed` is already published for exactly this
   (`ui/hud.ts:757`, `game/match.ts:1191`, plus the model in the renderer).
2. 🚨 **THE THEME IS PLATES AND KITCHEN OBJECTS, NOT BUSHES.** Every doc in this repo — this file,
   `STATE.md`, `LESSONS.md`, the commit log — says *"bushes"*, because that is what the reference
   game uses and what the original §18 framing borrowed. **Uri has never asked for bushes.** He said
   *"make it relevant to kitchen"* the first time and has now said it plainly a second time. The
   word is banned going forward: **concealment objects are plates, pot lids, crates, stacked trays.**

### ✅ §29c — attacking from cover BREAKS the cover and reveals you

> *"attacking from under it will break it and reveal you. You can also step out and attack."*

**This is stronger than the genre norm and better.** In Brawl Stars firing from a bush merely
reveals you; the bush survives. Here the concealment object is **destroyed**, so:

- concealment is a **consumable, per-object resource** — one ambush per plate, then it is gone
- there is a real **tactical choice**: ambush from cover and spend it, or step out and keep it
- ⚠️ **and it partially self-solves the AI-denial problem in §29a** — a camper who ever attacks
  destroys their own hiding place. It does **not** fully solve it: a player who hides and never
  attacks still breaks an AI that cannot search. §29a stands.

### 🖼️ §29a — **THE SCREENSHOT IS RENDERED AND WAITING FOR YOU**

> *"send a screenshot so i can evaluate"*

**`shots/conceal/concealment-scale.png`** — four panels at **shipped match framing**, identical
camera, character in frame for scale:

| panel | size | verdict |
|---|---|---|
| 1 | 120 wu | safe |
| 2 | 168 wu | the limit |
| 3 | 300 wu | **over** — the dead core the AI can never see into is drawn in red |
| 4 | five patches at 110–130 wu | the recommendation |

*(The old wording said this was "in flight". It was produced in `44af5e8`, its caption corrected in
`eb676ba` — the "same hiding area" figure was 80%, not 100% — and it has been waiting since. Kept
above so it is clear the artefact was not missing, only the sentence.)*

### 🧯 AND THE CEILING COSTS FAR LESS THAN IT SOUNDS — this was measured LATER and belongs here

Measured in **`d03e5d5`** on a 5 wu lattice: **the shipped kitchen's largest square that is clear of
cover AND outside the 248.25 wu endgame keep-out is 285 wu**, and it is jammed against the west wall
at (143, 428). The only genuinely 300 wu clear square sits on the hub, *inside* the keep-out.

**So the AI's limit (168 wu) and the map's limit (285 wu, in one degenerate corner) are within about
one prop of each other.** The "big hero hiding place" branch was never really available on this map,
independently of whether the AI can search. That materially shrinks what you are being asked to give
up — and it was not on the answer sheet when the question was written.

⚠️ Your §29c answer already removes the *ambush* camper — attacking destroys the plate. What remains
is only the player who hides and **never attacks**, and small patches remove that too.

### ✅ §26 — rarity is acquisition rarity ONLY. The 4.5× level cost is therefore WRONG.

> *"as far as i understand in all other games it means nothing besides the rarity to obtain it."*

Correct, and that is the genre norm. It closes the loop opened by §24b: rarity grants **no power**
(already landed) and must therefore also cost **nothing extra to level**. The **4.5× cost multiplier
is a leftover from when rarity was power** and is now a pure tax on owning a rarer character.
→ **Action: remove it.** `src/game/economy/tuning.ts`.

### ✅ §14 — LANDSCAPE ONLY

> *"i think the game should be landscape. Portrait can't serve the game. When it will be in an app,
> we'll force landscape."*

Settled. Portrait gets a **rotate prompt**, not a playable layout.
⚠️ **Do not delete the portrait work** — `menu_accept_portrait` (219 assertions) and the portrait
thumb band stay as they are. They cost real time to get right, the rotate prompt still needs a
correctly laid-out portrait screen to live on, and an app wrapper forcing landscape is a future
state, not the current one.

### ✅ §10 — change the two icons' subjects

> *"do it"*

### ⏸️ §28 — DEFERRED by Uri

> *"leveling it after I play some more"*

`healAmount` stays at **18**. He will decide after playing. Nothing is blocked.

### ⏸️ §16 — DEFERRED by Uri

> *"i'll send tomorrow thorough rejects on all characters."*

**Do not run a character-look pass before that arrives.** Per-character art notes from Uri outrank
any critic round, and starting one now risks doing work he is about to reject by name.

### 🔴 §17 — ANSWERED, **and it contains a NEW BUG REPORT**

> *"i can't hear on menus as well now. During matches off."*

- **Music during matches: OFF.** Settled — matches stay as they are.
- 🚨 **"I can't hear on menus as well now" is a DEFECT REPORT, not a preference.** Menus are
  supposed to have audio. "as well" and "now" both point at a regression. **This is being
  investigated as a bug.** It is the third bug in this project's history found by Uri simply
  playing it, and the previous two were invisible to every gate here.

### ❓ §19 — MY QUESTION WAS UNCLEAR. Re-asked plainly below.

> *"not sure what you meant"*

My fault — I asked it in terms of the code rather than the experience. Concretely:

**You are in the middle of a match. You press the browser Back button (or the phone's back
gesture). What should happen?**

- **(a) what it does today** — the match is abandoned immediately and silently. You are back on the
  menu, the fight is gone, no confirmation, no result.
- **(b) the alternative** — Back opens the **pause sheet** instead, and you choose whether to quit.

Today's behaviour is (a) purely because the pause sheet lives in a file a different agent owned at
the time — **not** because anyone decided it. It is one line either way.

---

## 31. ✅ §19 ANSWERED — and a NEW brief: the home screen looks amateurish

### ✅ §19 — Back opens the PAUSE SHEET

> *"Pause menu is fine."*

Settled. Back during a live match opens the pause sheet; it no longer abandons the match silently.
The old behaviour was never a decision — it was where the code landed because `matchScreen.ts`
belonged to a different owner at the time.

### 🔴 NEW — the home screen and menus

> *"I've had a look at the Home Screen and menus and we need to do a better job there.
> Looks amateurish."*

**The blind critic independently agrees**: home scores **5.17 against a reference 8.50** — a
5.9-floor gap and the second-worst element in the game. Uri named the symptom; a fresh
proven-painted capture was compared against `bs_home.png` to find the mechanism.

**⚠️ The problem is concentrated on HOME, not "the menus" generally.** Character select scores
**7.00** and is visibly the stronger screen — per-character coloured backdrops, rarity chips, real
colour variety. **That is an internal reference that already works**, and a large part of the fix is
"make home as good as the screen next door" rather than inventing a new language.

Six differences, from pixels:

| | ours | Brawl Stars |
|---|---|---|
| **backdrop** | flat orange radial gradient + dot pattern | a rendered **3D environment** — pipes, machinery, silhouettes, glow behind the hero |
| **the hero** | boxed in a flat dark-blue **card** with a corner title | **no card** — full-bleed, standing *in* the world |
| **panels** | every one an identical cream rounded rect | differentiated **by function** — yellow action tiles, dark utility tiles |
| **depth** | flat; panels sit *on* the background | hard drop shadows and bevels; elements are physical objects |
| **labels** | text — PROGRESS · WINS/LOSSES/BEST · YOUR FIGHTER · CHANGE | **pictorial icons** carry the meaning |
| **hierarchy** | three roughly equal columns | one dominant hero, one dominant PLAY, utilities clustered small |

**The backdrop is the biggest single item.** Our home is literally *"coloured paper"* — the exact
phrase six critics used about the match playfield, now appearing in the menu. And the hero **card**
actively separates the character from the page rather than placing them in a world.

⚠️ **One thing that may need Uri, and is flagged rather than assumed:** a 3D environment behind the
hero is a **new scene**, not a CSS change. It is the largest lever and the largest cost, and it is
the one item that cannot be reached from `src/ui/screens/home.ts` alone. If it turns out to be
expensive, the fallback — panel differentiation, depth, icons, killing the hero card — is most of
the gap and is all reachable from the one file.

### ✅ The backdrop is APPROVED — Uri wants the 3D world

> *"Perhaps we should also create a background image or even better a background 3d world."*

The item flagged above as *"may need Uri"* is settled, and he prefers the **3D world** over a flat
image. Two facts that make this much cheaper than it sounds:

1. **`src/ui/screens/charStage.ts` already builds a real 3D set** behind the hero — its own header
   describes *"a lit cyclorama, a floor, the ground plane"*, and records that a previous pass
   deliberately moved four elements out of CSS overlays into **real geometry**, because `Stage`
   clears opaque and nothing can be painted *behind* the canvas. The place to put a world already
   exists and is already lit.
2. **We already own a kitchen.** `createKitchenArena()` is a complete dressed 3D environment.
   **Brawl Stars' own lobby backdrop is a game environment, not bespoke art** — so rendering a
   reduced, dimmed slice of our own arena behind the hero gives a real world for a fraction of the
   cost of authoring one, *and* makes the lobby and the match read as the same place.

⚠️ **The constraint is draw calls, and it is real.** `preview-arena` is **1,700 draw calls against a
match's 696** — a full arena behind the hero would cost more than playing the game. It needs a
reduced set (a few hero props, the floor, the cyclorama; not the layout), priced with
`tools/perf.mjs --mode counts` before it ships. **Home is the first screen on a phone and has to
stay cheap.**

The five smaller items — panel differentiation, depth/shadows, pictorial icons, killing the hero
card, hierarchy — are still most of the gap, are all reachable from one file, and are being done
regardless, so the screen improves even if the world needs a second pass.

---

## 32. ✅ §10 CLOSED — and the unmeasured thing it flagged was a swap on the CURRENCY

Uri: *"do it"*. Done, `92ee601`. Per-icon deltas, paired on identical tile positions (**exact**):

| icon | before | after |
|---|---|---|
| `mustardblast` → **the hot dog itself** | 0/6 | **4/5** |
| `cap` → **the cap in flight, edge-on** | 0/3 | **3/5** |
| `coin` → **struck face is a star** | 0/3 | 1/3 |
| mutual swaps on the 65-icon plate | coin↔honey, boxRed↔gift | **none** |

⚠️ **The aggregate move is INSIDE its own floor and is not being claimed** — food plate 18.0 → 20.8
of 28, cross-family 47.0 → 49.0 of 65, against judge-to-judge floors of ~3.1 and ~4.0. The per-icon
counts above are the evidence; the totals are not.

### 🔴 The real find: the game's MONEY read as a weapon

§10 recorded that *one judge had once read a food icon as "coin"* and flagged cross-family collisions
as **never measured**. Measured now, and it was the reverse and unanimous: **the currency scored 0/3
and all three judges answered *"a pot of honey"***, while `honey`'s own miss answered *"a gold coin"*.
**A mutual swap between the game's money and a weapon glyph** — on a monetisation surface.

**Neither family measured alone can find this.** A judge shown only food icons cannot answer "coin".
That is exactly why the gap existed. Hue cannot fix it either — money must be gold and honey must
look like honey; the collision was the **construction**, a gold mass with a pale horizontal band.
Striking a star into the coin face took *"a pot of honey"* from 3/3 to 0/3 and the swap is gone.

### §10's own parked recommendation for `cap` was REFUSED, with a measurement

§10 suggested *"a water droplet with a spinning motion arc"*. **Cap Shot ships in Water Bottle's
four-slot bar directly beside Water Spray, whose glyph is `droplets`** (`rules.ts:1800-1807`). That
is precisely the construction that collapsed `mustardblast`/`ketchupslip` to 1/6 + 1/6 — two glyphs
differing only in a detail that vanishes at 20 px. Built anyway to check: at 20 px the arc
disappears and the tile is a droplet. `droplets` scores **6/6**, so the trade would spend the set's
strongest glyph on its weakest. **Refused on the number, not on taste.**

Also built and reverted: `cap` with motion strokes read as **"a fish" 3 of 3** — a blue body with two
strokes off one end, and `fish` is in the same registry. *Worse* than the 0/3 it replaced, whose
misreads at least scattered.

### Still open, routed rather than churned

`shards` reads as *"a double-headed arrow"* 3/3 — a **cross-family collision with the UI `range`
chip**. And `boxBurger`/`boxRed`/`boxFire` each read as `gift` 3/3: box↔box is by design, **box→gift
is not**. Left alone deliberately — §10's own history is that redraws break more than they fix
(8 of 14 measured worse and were reverted).

⚠️ **A limit of the 65-tile plate worth knowing before anyone reads its numbers:** with 65 candidates
for 65 tiles, judges drift toward a **bijection** despite the instruction, producing displacement
chains. `mustardblast`→`patty`→`cap` appears there while the same glyphs score 4/5 and 5/5 with zero
confusion on the 28-tile plate. **The 65-plate is authoritative for which pairs COLLIDE across
families — not for per-icon scores.**

---

## 33. 🔴 §17's bug is FIXED and REDEPLOYED — and your "now" was you, not the code

> *"i can't hear on menus as well now."*

**You were right, it was real, and it was only ever broken on the thing you play.**

`src/audio/music.ts` set the track URL as a **hand-written string literal**, `'/audio/…'`. Vite
rewrites the asset URLs it *resolves* at build time — imports, and `/x` inside HTML and CSS — but it
**does not rewrite string literals in TypeScript**. So under `DEPLOY_BASE=/food-arena/` every other
asset shipped as `/food-arena/assets/…` and **the theme alone shipped unbased**, asking the host for
`/audio/…` and getting a **404**. The mp3 had been deployed correctly the whole time; only the
request was wrong. **It was the only absolute asset path in all of `src/`.**

Measured on the live page before the fix: `rms 0.000000`, `MediaError 4`, `404`. Autoplay was
**cleared, not assumed** — the audio engine was running fine.

⚠️ **"It never worked" is the honest answer to your "now".** The URL had no base in *any* revision,
and the first deploy postdates the theme. **Your "now" is you moving from local play to the deploy** —
which is exactly why your reports are worth more than our gates: you are the only one testing the
thing we actually ship.

**Fixed, and redeployed.** Rebuild it in your browser (hard refresh) and the menu theme should play.

**A second bug fell out of the same investigation:** a deep-linked or reloaded `?screen=match` was
**starting the theme over the fight** on your first tap. Now off on every path, per your *"during
matches off"*.

### ❓ One question for you, because it cannot be tested here

There is **no Safari in this environment**, and you play on a phone. Two iOS-specific causes remain
possible *in addition* to the 404 that was fixed:

> **On your phone: is the side silent/ringer switch off? And after a hard refresh, do you now hear
> the menu theme?**

If it is still silent with the ringer on, it is `webkitAudioContext` resume timing and needs a
different fix.

### 🔴 And a separate gap that may be part of what you meant

**The menu buttons have no click sound at all.** `uiClick()` exists but is only ever called by the
settings sliders — **every other button in the game is silent when tapped.** If *"can't hear on
menus"* partly meant taps rather than music, that gap is real, it is unrelated to the 404, and it is
now on the list.

---

## 34. ✅ ANSWERED — **"keep it tiles, add debris."** Uri, 2026-08-06

**A taste call no metric here can make**, and it decides which of two builds is worth doing.

The floor was probed rather than looped (`ac08dbf`), and **the critics' stated mechanism is false**:
*"no surface detail"* does not survive measurement. Our ground's 3–12 px and 12–48 px detail lands
on the **reference median** (1.07× and 1.01×). More grain, a normal map or an AO map would move a
quantity that is already where Brawl Stars is.

**What IS out of band is that our ground is a regular LATTICE.** Our tiles repeat at ~100 × 83 px
with strong autocorrelation; **five of the six reference plates have no periodic ground repeat at
all.** Look at `shots/floor2/ours_vs_bs01_ground.png` — ours is a two-direction grout grid with
nothing on it; theirs is ground with **dozens of small chips scattered over it** and joints you can
barely see.

**The two ways out are different products:**

| | what it means | cost |
|---|---|---|
| **keep the tiled floor, break the grid** | irregular or hex pavers, joints in more than two directions, near-invisible contrast | a rewrite of the largest surface in the game |
| **keep the grid, scatter debris on it** | dozens of small ground chips arena-wide — which is what the reference actually does | additive, does not touch the tile field |

✅ **URI CHOSE THE SECOND — keep the tiled floor, scatter debris on it.** The tile field is NOT
being rewritten. My recommendation, now his decision, and not only because it is cheaper: the same probe found that
the whole-frame gap is **object-scale contrast**, not texture — the reference frame carries 24.6–34.9%
against our 15.3–20.7%. **The frame is short of THINGS, not short of surface.** Scattering ground
debris serves that directly and dilutes the lattice as a side effect.

⚠️ **But a tiled kitchen floor is a legible, correct choice for a kitchen**, and "stop being tiled"
is a look decision, not an engineering one. If you want the irregular-paver version, say so and it
gets built; nobody should rewrite the floor on a metric that has **no established link to the score**.

### 🔴 And a separate finding from the same probe, which needs no decision from you

**Characters have no contact shadow.** Brawl Stars puts a soft elliptical shadow **directly under**
each brawler; we have only the offset directional cast shadow, with nothing tight under the feet.
That is, word for word, what nine of fourteen critics said — *"characters sit on it like decals."*

⚠️ And **nobody has ever measured it**: our contact instruments cover the **prop** version (where we
already match the reference), and the **character** version is un-instrumented. It is now the
strongest remaining candidate for the cast score, and it is being treated as a build-the-instrument-
first job, not a tweak.

---

## 35. ❓ Concealment: two edges of "fully hidden" that the build had to decide

You said *"fully hidden"* (§30). Landed and **verified on rendered pixels** — a concealed enemy's
**radar blip, floating HP pill and 3D model** (with its cast shadow) are all gone. Two edges the
implementation had to rule on, both easy to change:

### 1. The CORNER NAMEPLATE still shows the enemy's HP — deliberately

Your *"fully hidden"* named the **floating pill above the character**. The **corner nameplate** — the
permanent scoreboard element — still reports their HP while they are hidden.

**The argument for leaving it:** it reports **HP, not position**, so it leaks nothing about where
they are; it is a fixed layout element, so hiding it leaves a hole; and it tells you nothing you did
not already know from having hit them.

**If you disagree, it is one line** plus a decision about what fills the gap. Say the word.

### 2. 🔴 A concealed enemy's PROJECTILES are still drawn — and this one is a real hole

Projectiles and ability VFX are **world entities**, not parented to the enemy's model, so they do not
hide with it. **Measured**, not assumed — a probe was thrown away and rebuilt because a pecking-chick
projectile stayed on screen after the character vanished.

So today: **a concealed enemy can shoot at you, stay invisible, and its projectile leaks its
position anyway.**

⚠️ **Under your §29c answer this is arguably correct** — *"attacking from under it will break it and
reveal you"*. If attacking reveals you, a visible projectile is honest. **But §29c is not
implemented yet**, so right now we have the leak without the reveal, which is the worst of both.
These two ship together or the feature is incoherent.

> ✅ **CLOSED — §29c is implemented and they DID ship together (`f0e7aed`).** Attacking destroys
> every standing plate the attacker is under and lights them for **500 ms**
> (`CONCEAL_ATTACK_REVEAL_MS = FLIGHT_MS.normal` — one flight time of the game's workhorse
> projectile, i.e. *long enough for the return shot to arrive*). A projectile therefore only ever
> exists while its owner is exposed, so **the visible projectile is now honest and `vfx.ts` needed
> no change at all** — hiding projectiles would now be the bug. Still inert: no arena declares a
> region, and bit-identity held **exactly — 0 differing ticks in 3,283,873**.
> **One case is NOT covered and is named in `vfx.ts`:** a shot can fly into a plate and hit a
> fighter its shooter cannot see (concealment is not intangibility), and the impact burst draws at
> the victim. It leaks only to the player who already landed the shot. Yours if you want it changed.

### One thing that needed no decision, but you should know it exists

**`window.__vfxDebugFighters` publishes both fighters' exact x/y/hp to the browser window every
frame.** Harmless single-player QA hook today. **In any multiplayer future it is a wallhack** — and
concealment is precisely the feature it would defeat. Worth a note now rather than a surprise later.

---

## 36. ✅ NOT A DECISION — resolved by measurement. The trail's own hypotheses were both false and the cap is a fact, not a choice.

Not blocking; recorded because it caps a whole class of future VFX work and cannot be fixed where
anyone would look for it.

**The Sticky Trail was investigated as an area/opacity problem and both hypotheses were false.**
Measured with same-frame ablation against the reference's own large ground effect:

| | share of frame |
|---|---|
| ours | **2.49%** (5.34% on the frame the critics scored) |
| `bs_05`'s poison cloud, same code | **15.86%** |

*"Covers a third of the play space"* is wrong by ~6×, and **we are 3× smaller than the reference's
own big ground effect.** The real defect was that ~20 marks each drew their **own bright outline** —
a segmented worm rather than one spill. Fixed by inverting the rim (dark outside, bright speckles
inside), so a pile of marks draws **one contour around the union**.

### The part that needs you

**`bs_05` gets 162° of hue separation between its ground effect and its floor. We can get ~27°, and
`vfx.ts` cannot change that — the arena has taken every direction:**

| direction | already spoken for |
|---|---|
| magenta 300–320° | the fog / closing zone |
| orange 14–42° | the splat, and the enemy's own trail |
| cool green / cyan | the hazard ellipses — and it reads as *"safe"*, which is the opposite of a damage trail |

`bs_05` buys its separation by putting a **magenta cloud on a green floor**. Our floor is **warm
rose**, so the half of the wheel that would separate is the half the arena already uses.

**So: every future ground effect is competing for the same ~27°.** Widening it means changing the
**floor's hue** or re-allocating what the zone and hazards use — an arena-wide decision, not a VFX
one, and exactly the kind of thing that is cheap now and expensive after five more effects are
tuned against the current palette.

Related and same cause: the trail's internal structure is ~25% short of the reference cloud's
(L stdev 0.102 vs 0.137), and **a saturated red at this mean cannot carry a wider range** — so that
gap is also downstream of the hue choice rather than fixable in the effect.

---

## 37. ✅ URI'S HAMBURGER REJECTS — all three corroborate a measurement already in hand

> 1. *"It seems like the **legs are disconnected from the body**."*
> 2. *"I don't understand what the **silver/grey element that is going in and out of the character**."*
> 3. *"I think the **face is the worst part**. It looks **drawn lines and not actual face**."*

**A human owner and a blind per-part critic reached the same conclusions from opposite directions.**
That convergence is the strongest signal this project recognises, and it is worth recording that the
instrument built last night *earned its keep on its first real test*.

### 1. The legs — a known invisibility bug, recorded in the file's own comments

`src/characters/hamburger.ts:387` already says: **`hipR` delivered 0.000 of a 4,697 px footprint.**
The hips render **nothing**, so the legs have no visible attachment. `docs/LESSONS.md` §1 for the
twentieth time — *"it isn't there" means it IS there and is INVISIBLE.* Uri saw the consequence of a
number that was already written down and not acted on.

### 2. The silver element is the SPATULA, and "in and out" is the diagnosis

It is his held weapon (`rig.joints.handR`). **That he cannot tell what it is, is the finding.**
*"Going in and out of the character"* means the blade is **intersecting the body geometry** — the
same class as `LESSONS §1` case 8, where Sushi's correctly-sized blade spawned mid-torso and
rendered as **two disconnected shards**. The per-part pass independently scored `prop` **3 vs 8.5**.

### 3. The face — and the instrument had already named both the defect and the fix

Per-part scores: `face-overall` **3.5 vs 9**, `eyes` **3 vs 8.5**. The measurement behind Uri's
"drawn lines":

> **Our eyes have 0% of pixels above 0.85 luma. The reference's two eye regions are 31.1% and 34.1%.
> There is no white in our eyes at all** — the face carries two values total, orange bun and
> near-black, so the largest, brightest, highest-contrast element of a reference face is *absent*.

The fix, already specified: **open eyes** — a white sclera oval that becomes the brightest value on
the face, a dark tapered pupil offset for gaze, and the existing black arc demoted from *being* the
eye to being its upper lash line.

**Routed to the live cast agent; hamburger only.** Uri is sending rejects for the rest of the cast
soon, and **no other character gets a look pass until they arrive** — starting one now risks doing
work he is about to reject by name.

---

## 38. ✅ URI'S DONUT REJECTS — one symptom, TWO mechanisms, and an internal reference

> *"Same issue with **legs detached from torso**. Same issue with **face**. It's **better than the
> burger** — the eyes have more depth, but can be taken deeper, and the mouth is deeper than burger
> but **still missing details**."*

### 🚨 "Legs detached" is the same complaint on both characters and a DIFFERENT bug on each

| | archetype | why it reads detached |
|---|---|---|
| **hamburger** | `STOUT` — *has* a torso | **`hipR` delivers 0.000 of a 4,697 px footprint.** The hip renders **nothing**. An invisibility bug. |
| **donut** | `STUB` — **no torso at all** | There is genuinely **nothing between the limbs**; the chain sprouts from the ring's edge. A design consequence, not a bug. |

**One fix would have been wrong for one of them.** `donut.ts:371` already records the STUB torso as a
no-op, and `docs/LESSONS.md` §1 case 6 records the same empty group biting before — Water Bottle's
strap anchored to `joints.torso`, which on a STUB body sits at the hips, drawing as a hook beside
the waist.

⚠️ Swapping donut off STUB is recorded as *"a supported one-line fix"* — **but it changes the
silhouette Uri has just called better than the burger's**, and the file prices it at 0.17 m. So the
first move is a visible **attachment mass** where limb meets ring, not an archetype swap.

### 🎯 Donut's eyes are Hamburger's fix, and it is already in our own code

Uri: *"the eyes have more depth."* **They do, and the reason is mechanical:**

| | construction |
|---|---|
| **donut** | `SphereGeometry(R * 0.125)` at `roughness 0.25` — **real 3D geometry**, proud of the icing, catching a specular highlight |
| **hamburger** | *"a small flattened arc… the torus"* — **strokes** |

That is precisely *"drawn lines"* vs *"an actual face"*, and it means **the fix is to copy our own
better character rather than invent one** — cheaper, lower risk, and it makes two characters speak
one language. (Same pattern as `characterSelect` being home's reference in §31.)

### But donut is not finished either, and the measurement says how much further

Uri: *"can be taken deeper."* The per-part number: **our eyes have 0% of pixels above 0.85 luma
against the reference's 31.1% and 34.1%.** Donut has a specular **dot**; the reference has a large
white **sclera** as the brightest mass on the face. **A highlight is not a sclera.** The move is from
*"a dark bead with a glint"* to *"a white eye with a dark pupil"*.

**The mouth** — *"deeper than burger but still missing details"*: the per-part pass named it on
hamburger as *"a flat dark shape with no lip thickness or interior value step."* A mouth needs an
**interior** — a darker throat value behind the lip line — so it reads as an opening rather than a
painted curve. Same principle as the eyes: **a value step INSIDE the silhouette.**

---

## 39. ✅ TACO + BURRITO rejects — and Burrito exposes a blind spot in our best new instrument

### Taco
> *"legs — same issue, **I'll stop relating to the leg issue, it's on all characters so far**.
> Eyes — better, still needs work. **No mouth, seems like a hat or something.** Not sure about the
> items on the head, **looks like fruit, not taco add-ons**."*

- **The legs escalated to a RIG defect** — see §40 below. Uri seeing it on three of three is what
  turned it from a character note into the widest-reach fix in the cast.
- **Taco's eyes are the best in the cast**, and Uri's ranking is exactly the construction ladder:
  hamburger a flattened **arc** (a stroke) → donut a **sphere** with a specular → taco a sphere
  **plus an explicit white glint mesh**. His eye tracked the geometry without seeing the code.
- **"No mouth, seems like a hat"** — likely a **fusion**, not a missing mouth. Taco's mouth is the
  shell's own opening, and directly beneath it `taco.ts:216` says *"the neck column and its collar
  are this character's DARKEST band."* A dark opening immediately above the darkest band merges into
  one mass that reads as a **brim**. Same class as Hamburger's apron fusing with its tomato into one
  red cylinder, and Burrito's foil landing within 4% of its tortilla.
- **"Looks like fruit"** is a **SHAPE** problem, not a colour one — the fillings are authored
  correctly (`TOMATO #E63946`, `LETTUCE`, `ONION`) but built as **spheres and rings**, and spheres
  read as berries while purple rings read as grapes. Real fillings are **shredded, diced, crumbled**.
  Change the shapes, keep the palette.

### Burrito — *"Looks a bit like a goat. Face is not good."*

**He is right, and it is not a face problem.** Every element is individually correct:

| element | authored as | reads as |
|---|---|---|
| two upright pointed shapes on top | **torn foil peaks** on the wrap (`burrito.ts:19`) | **ears** |
| LANKY archetype — *"tall narrow torso, long thin limbs"* | a burrito is a long vertical tube | animal proportions |
| `TORTILLA #DFD2B9`, pale cream | flour wrap | fur |
| small face low on a long narrow head | a face on a tube | a **muzzle** |

**Each part is a correct burrito feature. Together they compose a goat.** Improving the face will
not fix it — the *silhouette* is what says "animal", and the silhouette is read first.

### 🚨 And this is a BLIND SPOT in the per-part instrument, worth more than the character

The per-part method — Uri's own suggestion, and the thing that independently found Hamburger's face
and eyes — **scores each part in ISOLATION to reduce noise.** That is exactly what makes it unable
to see this: **isolation removes the information needed to detect a gestalt error.** A per-part run
on Burrito would score the foil peaks, the head and the face separately and could rate each of them
fine, while the assembled character reads as the wrong animal.

**So the two methods are complementary and neither replaces the other:** per-part finds *"this
component is badly built"*; only a whole-character look finds *"these correct components compose
something else."* Any future per-part run must be paired with a whole-figure panel — and the
existing `figure-whole` control exists for precisely this, so **read it, do not just compute it.**

---

## 40. ✅ EGG — and three cross-character patterns that matter more than any single character

> *"The **ears don't make sense**. The egg **lost the appearance of egg**. We need to improve the
> face, and the shape to resemble an egg."*

Egg's shell is authored as *"a **true ovoid** (not a sphere) — fuller at the bottom, tapering"*, and
`egg.ts:206` records that a clean ovoid was **"the one thing Egg had going for it in the silhouette
test."** So the egg read was not lost to a bad shape — **it was lost to the details added on top of
it**: a lifted lid that breaks the crown, and shell **shards** that flank the head.

**The detail added to signal the subject destroyed the silhouette that signalled it better.**
That is the finding, and it generalises past this character.

---

### 🚨 PATTERN 1 — a pointed shape flanking a head reads as an EAR. Three for three.

| character | authored as | Uri reads |
|---|---|---|
| **burrito** | torn foil peaks on the wrap | *"looks a bit like a goat"* |
| **egg** | shell shards | *"the ears don't make sense"* |
| **hamburger** | lettuce leaves | (visible in his shot, same construction) |

**Two pointed masses either side of a head is the universal ear signal**, and it overrides whatever
the shapes are actually made of. Any character with side-flanking points needs them re-placed
(above, behind, asymmetric) or re-shaped (rounded, drooping) — **or the character will read as an
animal no matter how good its face is.**

### 🎯 PATTERN 2 — Uri's eye ranking is exactly the construction ladder, and it names our reference

He ranked the faces without seeing any code: hamburger *worst* → donut *better* → taco *better
still* → and Egg's are plainly the most complete.

| | construction |
|---|---|
| hamburger | a flattened **arc/torus** — a stroke |
| donut | `SphereGeometry` at `roughness 0.25` — a specular highlight |
| taco | sphere **+ an explicit white glint mesh** |
| **egg** | **open eyes with catchlights** — sclera, pupil and highlight as separate elements |

**Egg is the cast reference for eyes.** Bring the other ten up to it rather than inventing anything —
and then take *all* of them further, because the per-part measurement still says **0% of our eye
pixels are above 0.85 luma against the reference's 31.1% / 34.1%**.

### ⚠️ PATTERN 3 — the per-part instrument cannot see any of this

It scores parts **in isolation**, which is what removes the noise — and also what removes the
information needed to see *"these correct parts compose a goat"* or *"the lid broke the egg read"*.
**Per-part finds badly-built components; only a whole-figure look finds a mis-composed character.**
Uri has now caught two of these that the instrument structurally could not. Every future per-part
run must be **paired with a whole-figure panel that is actually looked at.**

---

## 41. ✅ LOLLIPOP — and both complaints trace to ONE LINE OF SPEC, faithfully implemented

> *"Limbs and torso intersecting, **making the face invisible** sometimes. The candy should have
> **more colors than red only**, make it colorful. **Unfreeze the structure — the mouth doesn't have
> to be above the eyes.** Fix it so it looks good."*

### 🚨 The implementation was CORRECT. The specification was wrong.

`src/game/rules.ts:1734`:

```
face: 'Eyes on the stick, mouth on the candy. Concentric red/white swirl disc.',
```

**That single line is the source of both complaints.** `lollipop.ts` follows it exactly and says so
(`:344` — *"`rules.ts` puts the eyes on the stick and the mouth on the candy"*), and the file even
records fighting the consequence: at 0.19R the eyes came out **~3 px** at the size a player actually
sees, *"because the only thing on the huge disc was a small mouth arc."*

**So nobody made a mistake — an agent honoured a written spec, and the spec produced a face with the
mouth above the eyes.** Uri has now released it.

⚠️ **The fix must change BOTH `rules.ts` and `lollipop.ts`.** Changing only the character file leaves
the spec in place, and the next agent to read it will faithfully re-implement the layout Uri just
rejected. That is this project's most-repeated defect shape — *a rule stated once and implemented
elsewhere* — appearing for the first time in its **inverse** form: **the rule was obeyed, and the
rule was wrong.**

The same line carries *"Concentric red/white swirl disc"*, which is the palette complaint. **Both
halves of that sentence are now open.** Note the character already contains a second colour family —
`LIMB_TEAL #8FE0C9` on the limbs — so a colourful disc has somewhere to start that is already in the
palette rather than invented.

### The face being occluded is the RIG defect with a worse consequence here

*"Limbs and torso intersecting, making the face invisible"* is the cast-wide interpenetration issue
(§40 / task 21), but on Lollipop it **hides the face**, not just a limb. Note also that Lollipop is
the **worst figure/ground character in the cast** — 12 of 18 stations below the 0.10 standard, with
its `fig` pinned at 0.497 at 17 of 18 stations against a ground at 0.40–0.48, so `dL` sits at
0.02–0.10 **by construction**. A colourful disc would help that measurement too.

### ⚠️ Pattern 1 again — FOUR for four

The two black shapes flanking the disc are the **cellophane cape petals** (`WRAPPER_INK` — *"cape,
collar, petals — near-black cellophane"*). They read as **horns**. Burrito's foil, Egg's shards,
Hamburger's lettuce, and now Lollipop's cape: **any pointed mass either side of a head reads as an
ear or a horn, whatever it is made of.**

### And one thing worth saying plainly

*"Fix it so it looks good"* is broader latitude than the other four sheets, which named specific
defects. **Recorded as such** — this one is a redesign brief, not a bug report, and it should be
judged by Uri's eye rather than by a metric clearing a floor.

---

## 42. 🚨 THE CAST'S FACE PROBLEM IS SPECIFIED IN `rules.ts`, AND URI'S RANKING PROVES IT

Uri reviewed seven characters without seeing any code. **His ranking correlates exactly with the
one-line `face:` field in `rules.ts` that the agents were implementing.**

| `rules.ts` `face:` | character | Uri's verdict |
|---|---|---|
| **"Closed happy eyes, small smile"** | hamburger | *"the **worst part** in the character… drawn lines and not an actual face"* |
| **"Closed eyes, smiling"** | pizza | *"face is **terrible**"* |
| **(no face spec at all)** — *"White wrap, stands upright, toppings visible"* | burrito | *"**face is not good**"* |
| *"Crooked smile"* — no eye spec | donut | *"**better** than the burger, the eyes have more depth"* |
| ✅ **"Open eyes with highlights, straight neutral mouth"** | **egg** | the most complete face in the cast |

**Every character he rated poorly is specified with CLOSED eyes, or with no eye spec at all. The one
specified with OPEN EYES AND HIGHLIGHTS is the one whose face he ranked best.** Eleven agents each
implemented their line faithfully; the line was the problem.

### This is the INVERSE of this project's most expensive defect shape

Five AI bugs came from *"a rule stated once in `rules.ts` and implemented differently elsewhere."*
This is the same file, and the opposite failure: **the rule was implemented exactly, and the rule
was wrong.** An agent doing excellent work against a bad spec produces a bad character and no gate
can tell — because every gate here measures *conformance*, not whether the target was worth hitting.

### It also PREDICTS the rejects Uri has not sent yet

| `face:` says | prediction |
|---|---|
| **soup — "Gray steam-coloured eyes, no mouth"** | 🔴 the same *"no mouth"* complaint he already made about taco |
| **waterbottle — "Eyes floating above the cap"** | floating, detached facial features |
| **hotdog — "Sleepy half-closed eyes"** | the closed-eye family again |
| **taco — "face floats completely outside the shell, to the side"** | he already flagged the mouth reading as a hat |

**Fix the specs first, then the characters.** Changing only a character file leaves the spec in
place, and the next agent to read it re-implements the rejected face faithfully — which is exactly
what happened to Lollipop (§41).

### What the new spec should say — grounded, not invented

Egg is the working example **and** the per-part measurement agrees with it. Target, for every
character: **open eyes with a white sclera that is the brightest value anywhere on the face**, a dark
pupil offset for gaze, an explicit catchlight, and a mouth with an **interior value step** so it
reads as an opening rather than a painted curve.

⚠️ Current measurement: **0% of our eye pixels are above 0.85 luma, against the reference's 31.1% and
34.1%.** Our faces carry **two values total**. Even Egg — the best of them — has a catchlight rather
than a sclera, so **the whole cast moves, not just the seven Uri has reviewed.**

---

## 43. ❌ WITHDRAWN — the metric behind it CANNOT RESOLVE ITS OWN GAP. Do not answer this.

🚨 **This asked Uri to choose a chrome direction on a number that was never able to support the
question.** `dark%` has a measured resolution floor of **±4.26** against a gap of **0.87** between our
5.17 home and our 7.00 character select — **a fifth of the noise** — and that was measured **eight
hours BEFORE this section was written**, by a different agent whose work its author had not seen.
Rule 10 forbids acting on it. The section's own closing caveat also disqualifies its evidence: the
reference side scored **7.12 ± 1.22** against a recorded 8.17, with **4 of 17 rounds discarded**.
Acting on it would mean darkening the art to satisfy an instrument. **Original text kept below.**

### 🔒 ORIGINAL §43 — refuted above

Measured across 17 isolated UI elements, ours against the reference plates by identical code:

| | ours | reference |
|---|---|---|
| **darkFrac** (share of the element that is near-black) | **0.13 – 0.19** | **0.70 – 0.73** |
| satMean, ours − reference | negative on **12 of 17**, median ≈ **−0.33** | |

**The reference draws its chrome on near-black plates. We draw ours on cream.** Nearly all of our
chroma deficit lives there — it is not a hundred small colour mistakes, it is one structural choice.

⚠️ **I am not recommending a direction, and that is deliberate.** Reversing it is a whole
design-system change, and **our own best-scoring screen (character select, 7.00) is also cream on
warm.** So the evidence does not point one way. **This is yours.**

### 🔴 Four hard defects found in the same audit, being fixed now — no judgement needed

1. **The hero nameplate is occluded by the nav tab bar.** The guard exists and is **15 px short** —
   it resolves to 47.2 px against a bar whose bottom edge is at y=62.
2. **Eight strings truncate with a visible ellipsis** — *"2 rewards ready"* renders as
   *"2 rewards re…"* on the shipped landscape phone; at 852×480 it is **every** chest-row title and
   sub, plus all three ability names. Two critics named it unprompted and it produced the
   **joint-worst score in the audit, 4 against 8.**
3. The character-select abilities list is **clipped mid-descender** by its own panel.
4. 🔴 **On a landscape phone, home has NO ability buttons at all** — `.home-kit` is `display: none`
   below 460 px of viewport height. It is deliberate and documented, but since you have ruled the
   game **landscape-only** (§14), that is not an edge case — **it is the phone experience.** You may
   want a view on whether the kit should be shrunk to fit rather than hidden.

### ⚠️ And a correction to something I told you

I said character select was our internal reference for the chrome, and that home should be made more
like it. **That is wrong.** The chrome is **shared** — every element measured lives in `theme.ts`,
and the two places character select overrides it moved the critic **zero**. Its 7.00 against home's
5.17 is **not** coming from its components. The fixes belong in the shared layer.

### ⚠️ One instrument caveat, so no one over-reads the per-element numbers

**Isolating a UI element displaces the critic's scale.** The reference side scored **7.12 ± 1.22**
against a recorded **8.17** for whole images, and **4 of 17 rounds fell outside the valid 7–9 band**
and were discarded — critics saying an isolated crop *"reads as a debug overlay… a UI wireframe, not
a game screenshot."* Both controls passed, so the instrument discriminates; it is the **scale** that
moves. **Per-element numbers are usable as gaps and are NOT comparable to the 5.17 / 7.00 screen
scores.** (Notably, all three rounds where we *beat* the reference were among the four discarded —
the validity rule caught every anomaly it exists to catch.)

---

## 44. ✅ §34 SHIPPED — ground debris landed, and the pale-blue slab was the STOVE ISLAND CAP

Your *"keep it tiles, add debris"* is done (`aa9b743`). **The tile field was not touched** — no
pavers, no hex, no tile-size change, no global floor value moved.

Measured against a **true null arm** (chips driven to zero on the same tree; it reproduces HEAD's
draw counts *exactly*, which is what proves it is the null):

| | null | after | in floors | reference band |
|---|---|---|---|---|
| **groundFeat** | 0.1239 | **0.1635** | **14.1×** | 0.136–0.276 — **every frame now inside it** |
| **featShare** | 0.1765 | **0.2398** | **9.9×** | 0.246–0.349 — now overlaps; median still **one floor short**. Not closed. |
| oriAll (the lattice) | 0.4723 | 0.4204 | 3.9× | diluted, as predicted |

Cost: **+30 draw calls (+3.7%)** — and the chip layer itself is **+4 draws for 1,734 chips**.
Side effects, all paired on 18 identical stations: cast figure/ground **+17%**, `playerRank`
37 → 32.5 (recovering about a third of the earlier standing regression), and `arena-scan`'s
**warm-chroma rail flips FAIL → PASS**.

**The pale-blue "placeholder slab" was the stove island cap** — the arena's largest cover, 8.5×4.5 m,
with its hob covering only **11.5%** of the top face. So **88% of the biggest object in frame was one
unbroken fill.** Independent corroboration, from an instrument with no notion of "blank": a
ground-finder mistook it for *floor* in 3/10, 4/10 and 3/10 frames before — and **1 of 9** after.
And the earlier prop-value pass **did** make it worse (167 → 195 delivered luma), confirmed rather
than assumed. The value was kept (it bought the highlight result); the blankness was filled instead.

### ❓ One taste call for you: chip density

We sit at `groundFeat` **0.163** against a reference band of 0.136–0.276 (median 0.187) — **inside
the band and below its median**, so by the reference's own measure the floor is *not* over-littered.
But **1,734 chips is a busy floor**, and that is an eye question, not a metric one. Two constants
dial it: `CHIP_CELL` and `CHIP_P_MIN/MAX` in `src/arena/floor.ts`.

⚠️ **And one piece of our own standing advice is now stale.** `docs/LESSONS.md` §8 says *"adding cool
chroma is the cheaper lever"*. Measured today: **warm chroma FAILS LOW (0.053 vs a 0.072 minimum)
while cool sits at 0.427 against a 0.343 target — over.** A teal-chip palette copied literally from
the reference was **rejected on that basis**: it would have spent the one budget this frame has none
of. **Warm is the scarce budget now.** CLAUDE.md has been corrected.

---

## 45. ❌ THE 22° HYPOTHESIS IS FALSIFIED — the reference camera is ~51°, ours is 57.4°

Uri: *"the reference characters are roughly 22 degrees… that could also explain why we couldn't
improve scores."* **Measured, and it does not hold.**

A circle lying on the ground images as an ellipse with `minor/major = sin(pitch)` — semantic-free,
no rig, no knowledge of what a plate depicts. **Calibrated on our own renders first, including a
held-out angle:**

| target | true | recovered |
|---|---|---|
| ours, ground ring @ 20° | 20 | **19.50** |
| ours, ground ring @ 40° *(held out)* | 40 | **39.24** |
| ours, ground ring @ 58° | 58 | **57.44** |
| reference `bs_06` / `bs_01` / `bs_04` | — | **49.4 · 49.9 · 51.3 · 53.2** |

Resolution floor **±1.0°**. So the like-for-like gap is **~6.5°, not 36°.** Closing it moves
crown-share from 0.924 to 0.888 — far too small to be the binding constraint on a 4.33-vs-8.00
element — while the blast radius is `FAIR_PLAY` radius, `aspect.mjs`, HUD layout and every arena
framing constant. **Recommendation: leave the match camera at 58°.**

**Two follow-up hypotheses of its own, also falsified:** delivered face *area* survives the steep
camera fine (median 0.842 where a flat vertical face would give 0.564 — our faces survive *better*
than flat), and crown blankness is a **null** (ours 78.7–152.3 against plates 66.5–147.8, fully
overlapping).

### 🎯 But something real survived, and it is a RIG lever, not a camera one

**Face-plane elevation: 8 of 11 characters have their face aimed BELOW the horizon.**

```
hotdog +23.9 · hamburger +22.6 · egg +7.8    ← aimed up
sushi −11.9 · soup −12.4 · burrito −12.4 · donut −19.6
waterbottle −21.4 · pizza −27.6 · taco −32.7 · lollipop −56.3   ← aimed down
```

**A face aimed below the horizon is wrong at BOTH shipped cameras** — the same class as a limb
passing through a torso, which is your own framing applied to a second defect. Note the three
aimed *up* include the two whose faces you rated best-constructed.

⚠️ **Do not rank the cast on this number alone** — it assumes a spherical head and it fails for
donut (a torus head's centre-to-face vector is not its surface normal; predicted 1.000, measured
0.645). It is a pointer, not a scoreboard.

⚠️ **And the live cast overhaul is already moving it, hard, in both directions** — lollipop
**−56.3 → +65.8**, donut −19.6 → −30.0, egg +7.8 → +17.9. Whether or not those agents intend to,
they are moving exactly this quantity.

---

## 46. ❌ WITHDRAWN — `shards` did NOT reproduce. **You do not need to decide anything here.**

🚨 **THIS SECTION ASKED YOU A QUESTION AND THE QUESTION WAS WRONG. Read this box, not the section
below it** — the original text is kept verbatim because it is what was in front of you, and because
how it failed is worth more than the answer would have been.

**Re-run at the corrected delivered size, `shards` was called "a double-headed arrow" ZERO times** —
across **nine judge readings, three panels and two protocols**. Zoomed: 3/3 correct. Unzoomed: 0/3,
but as *seaweed* ×3, not as an arrow. `range` was 3/3 correct everywhere. **Nothing is asked of you.**

### Why the original was wrong, which is the part that matters

The 6/6 came from two rounds of an instrument whose between-round swing on **byte-identical art** was
later measured as *the full range* — the same instrument that scored `boxRed` 3/3 then 0/3 without a
byte changing. Two rounds of that are not 6 of 6; they are one reading, repeated.

And underneath it sat a second error nobody had controlled for. Same PNG, same 63 tiles, same
candidate list, same model — **only the protocol differed**:

| protocol | score |
|---|---|
| judge may zoom | **96.3%** (61/61/60 of 63) |
| one look at native size | **67.2%** (43/40/44 of 63) |
| the historical rounds | 62–72% |

**29 points from the protocol alone**, and every historical round sits squarely in the no-zoom band.
**This instrument was measuring judge acuity and icon quality mixed together, and never controlled
the second.** The failures are not even the same failures between the two arms. Whether the original
judges magnified cannot be recovered — the answer sheets do not record it.

**The rule that comes out of this: never quote an icon verdict without its protocol.** That now sits
in `docs/TOOLS.md` next to the scorer.

### What is actually true after the re-run

- **box → gift is CLOSED**: zero of 45 at the corrected size (r3-zoom 0/12, r3-nozoom 0/12, r4 0/21).
- **`boxBurger`'s colourway is not the lever** — the paired plate the earlier pass asked for was
  built and run: shipped 1/3, the reverted candidate 1/3, clasp-only 1/3. **Δ = 0.** Twin floor
  clean: 0 of 6 pairs disagreed on byte-identical art.
- **`patty → cap` is gone** (3/3 both arms). What survives is a real mutual swap `slow ↔ cap`, and
  at low acuity `coin` reading as a round *food* (tomato, egg) rather than as a cap.
- The earlier claim that *"the boxBurger fix killed the gift read and moved it onto `chest`"* was
  between-round noise. **The revert was right for the wrong reason.**

---

<details>
<summary>Original section 46, kept verbatim. It is refuted above.</summary>

**This one needs you, because the remaining fix is a SUBJECT change and that is a taste call.**

The Glass Shards ability icon was named *"a double-headed arrow"* by blind judges **3/3 and 3/3 —
6 of 6.** The confusion is with the UI **`range` chip**, which is an actual double-headed arrow, and
the two ship **in the same box**: on character select the Glass Shards pill carries `shards` at
23.2 px with the `range` chip **40 px below it**. Same screen, same eye movement, two meanings.

**Measured on a forged plate before any of this was believed:** `range`'s *artwork* was substituted
into `shards`'s tile — identical pixels, two names — and judges named it "a double-headed arrow"
**3/3, the same answer at the same rate as the real glyph.** So the collision is in the shape, not
in the label or the tile.

### Why it cannot be fixed by moving the triangles

All three possible arrangements were rendered and judged:

| arrangement | reads as |
|---|---|
| apexes **opposed** along one diagonal (shipped) | a double-headed arrow |
| apexes **co-directional** | arrows |
| **scattered** | arrows |

Two sharp triangles at a distance read as arrowheads whatever you do with them. **The subject has to
change** — something that is recognisably broken glass rather than two pointed shapes.

### What was NOT done, deliberately

`range` was **not** touched. It scores **6/6 correct**, and `§10` already refused exactly this trade
once for `cap` — degrading a glyph that works to rescue one that doesn't is a trade this project has
declined before. Flagging rather than repeating it.

**Your call:** what should Glass Shards *look* like? Any answer that is not "two triangles" is
actionable. ⚠️ A subject change also needs its candidate string updated in
`tools/tmp/icon_score.mjs`, or the blind test will keep scoring it against the old answer.

</details>

---

## 47. ❓ ONE ability carries TWO different emoji depending on which screen you are on

**Measured across the whole roster: 1 mismatch in 31 weapons / 34 abilities.** Every other same-named
move carries the same emoji on both surfaces. Lollipop's is the sole outlier:

```
rules.ts:2020   weapon   'Giant Lollipop'  emoji '🍭'   → `lollipop` icon, match HUD weapon bar
rules.ts:2024   ability  'Giant Lollipop'  emoji '💫'   → `stun` icon, character select
```

Same move, two icons, depending on the screen. It is also **why the `lollipop` icon is authored but
nearly unreachable** — it renders in exactly one place in the entire game.

**Two defensible directions and they are genuinely different choices:**
- **💫 everywhere** — matches the move's actual `effect: 'stun'`, and retires a glyph that renders
  once. Functional.
- **🍭 everywhere** — keeps the character's own identity on their signature move. Thematic.

⚠️ **NOTHING WAS CHANGED, and the reason matters.** The obvious argument for 💫 is that `lollipop`
scored **0/3 ("a map pin")** in the blind test — but that score was taken at the harness's **20 px
fallback, not at a measured delivered size**, because the glyph never rendered un-occluded in the
sweep. The agent that measured it said so explicitly. **Acting on it would be acting on exactly the
kind of number this project keeps getting caught by** (see `§45`, and `docs/LESSONS.md` §6b). The
mismatch is a fact; the direction is yours.

### Two more icons that are authored and effectively unreachable

`flag` and `party` render **only at a completed trophy road** (`home.ts:424`, `trophyRoad.ts:405`,
`trophyRoad.ts:187`) — unreachable on any normal profile, and never measured until now. Not a bug on
its own, but it means neither has ever been seen by a judge or by you.

---

## 48. ✅ THE ARENA GROWS ×4 IN **AREA** — 1400×1000 → 2800×2000

> *"Arena x4 - area to accommodate 4-6 players"*

Uri, 2026-08-10, answering the one ambiguity that was blocking the work. **×4 AREA, not ×4 linear**
— so **2× on each edge**, 1400×1000 → **2800×2000**. (×4 linear would have been 5600×4000, i.e. 16×
the area.) Per-fighter space roughly triples going 2 → 6 fighters, which is the reading that matches
the stated purpose.

**Do not reopen this.** What follows are the consequences, not the decision.

### ✅ LANDED 2026-08-11 as `6631446` — and the fixture that said it would fail was WRONG

`ARENA_W/H` is 2800×2000. `shared.ts` changed by **two constants**; everything downstream is derived.
The acceptance test whose own header said *"IT EXITS NON-ZERO ON TODAY'S MAP… it goes away when §48's
2800×2000 arena lands, not before"* now reports **37/37**, and the N=6 census at 9.0 s has all six
seats at **full health** — on the map this replaces, slot 0 was 0/70 and dead.

- **Six spawns in six separate admissible regions.** Minimum pairwise separation over all 15 pairs is
  **892.0 wu** against `REACH.rangedMax` 140 — 6.4× clear, against **75.2 wu** before. Admissible
  cells 2,186 → **34,242 in 36 regions**; all six in one nav component.
- **111 props** (was 27) at **17.92%** density (was 20.11%), no prop rescaled; hub unchanged;
  concealment 6 → **20 patches**. `ap_reach` at body widths 18/20/22/24/26: **0 sealed, 0 phantom,
  0 face gaps.**
- ⚠️ **§48's own fixture mispredicted its own outcome.** It predicted −13.4 pp on win rate, chase
  collapsing to 1.7%, and 30/880 matches never making contact. Measured: **−2.6 pp** (inside the
  ~9 pp floor), chase **41.5%**, and **0/880 never-contacted in both arms.** First contact did move,
  5.67 s → **18.42 s**, and duty halved, 33.5% → 18.9%. These are **1v1** numbers; balance at 4–6 is
  not claimed.
- ⚠️ **Perf moved the opposite way to the prediction too**: §48 said draw calls would *fall*. They
  rose 896 → **1,012** (+12.9%) and triangles ×2.74, because that prediction came from the stretch
  arm and this is the held-density one.
- 🔴 **The cost, and it is being paid now:** six gates went red *on HEAD* the moment this committed,
  every one carrying a 1400×1000 literal — `arena-scan` (its 18 stations now sample only the NW
  quadrant), `ap_reach`, `sp_place`, `sp_gate`, `conceal_lab`, `level_lab`. **All closed** — `gatecount`
  went 12 faults → 2, neither survivor from this work. ⚠️ **The sentence that stood here — *"`level_lab`
  is a finding rather than a fixture, pinned at its ceiling and unable to tell level 1 from level 15"* —
  was FALSE and is kept for the lesson.** Measured: **40 of 110 cells are unsaturated and every one
  rises** (max 93.8 pp), the full grid moving **55.00% → 99.32%**. **One hand-picked cell had saturated**
  and I generalised from it to the whole instrument. See §60.

### 🚨 EVERY ONE OF THESE IS ANCHORED TO 1400×1000 AND MUST BE RE-DERIVED, NOT SCALED BY EYE

1. **Fog.** `shared.ts:115` derives the closing schedule from `ARENA_HALF_DIAGONAL`; `rules.ts:900`
   says explicitly that the r=545 close is anchored to the ARENA, not to the weapon. The half
   diagonal **doubles**. The fog either closes twice as far or takes longer, and match pacing moves
   with it — floor ~0.8 s of contact / ~4 pp dead time.
2. **The AI has NO SEARCH BEHAVIOUR** (`rules.ts:1034`). `stepAI` walks to where it last saw you and
   stops. A 2× longer map makes every lost-contact event longer. ⚠️ **This is the same piece of work
   as the concealment ceiling in §29a** — `CONCEAL_REVEAL_RADIUS` does not scale with the arena, so
   a 4× map needs ~4× the patch COUNT rather than bigger patches.
3. **Balance.** Every weapon REACH, damage radius and movement speed is in these units. The spawn-gap
   sweep ran all 110 matchups at gaps 1080/1000/920/840/760 **on this layout** (`kitchen.ts:541`) and
   is void at a new size. Report AGGREGATE (floor ~9 pp) and PAIRED per-matchup (exact) separately.
4. **Camera / fairness.** `FAIR_PLAY` in `render/camera.ts`; `tools/aspect.mjs` must still PASS at
   0.00 wu. With 4–6 fighters the framing question changes shape entirely — a 2-fighter rule may
   have no 6-fighter answer.
5. **Apron + perf.** `apron.ts` covers everything outside the playfield; `floor.ts:885` scatters
   ~1/3 of 875 tiles density-modulated over 1400×1000. At constant density **×4 area is ×4 tiles.**

### 🧱 HOW IT SCALES — Uri, on reading the first brief

> *"You didn't explain how to scale. Obviously adding more obstacles, keeping the pot in the middle,
> things like that"*

The first brief said "grow `ARENA_W/H` and re-derive the constants" and said **nothing about what the
map should BECOME**. Taken literally that produces the wrong arena, and it would look like it worked.

**❌ NOT a 2x linear stretch of the existing layout.** `kitchen.ts` has **30 props** over 1400x1000.
Stretched, that is 30 props over 2800x2000 — **a quarter of the current cover density**, twice as far
between hiding places, on a map whose AI cannot search. Prop positions currently derive from
`ARENA_W`/`ARENA_H` (`x: ARENA_W - 1010` and friends), so a naive constant bump does exactly this
**by default**.

**✅ THE RULES:**

1. **Keep DENSITY, add obstacles.** ~4x area wants **~4x the props** — order of 100+, not 30 — using
   the kinds already authored. This is a layout pass, not an art pass.
2. **The pot / central stove hub stays in the middle AT ITS CURRENT SCALE** (`kitchen.ts:165`). It is
   a designed centrepiece — *"danger in the middle, cover on the corners"*, cardinal lanes open,
   diagonals blocked, the hub lethal to linger on. **A hub that doubles is a different game object; a
   hub that stays put becomes the landmark a bigger map needs.**
3. **Preserve true 180 degree point symmetry** (`kitchen.ts:6`) — *"so both spawns face an identical,
   fair map."* Every added prop needs its partner. **This is competitive fairness, the same category
   as `aspect.mjs`**, and it is the easiest thing to break while placing ~70 props by hand. Generate
   the second half by transform and **assert the symmetry in a test.**
4. **New space needs new structure, not more clutter.** At 2800x2000 there is room for real lanes and
   rooms; extend the existing design language outward rather than sprinkling props uniformly.
5. **The concealment ceiling does NOT scale** — `CONCEAL_REVEAL_RADIUS` is fixed, so patches stay
   capped at ~168 wu however big the map gets, and a 4x map wants **~4x the patch COUNT**. Same
   instinct as rule 1: **more objects, not bigger ones.** See §29a.

⚠️ **And this changes the pacing measurement**: measure at the **populated** layout, never at a bare
2800x2000 field. More cover shortens sightlines and creates contact, so an empty box would measure far
worse and give the wrong sequencing answer.

### 🔴 MEASURED — **DO NOT SHIP 2800x2000 UNTIL THE SIM HOLDS 4-6 FIGHTERS**

`0a63d96` + `09fca76`, via `tools/tmp/ax_layout.mjs` (22). 110 matchups x 8 seeds x 2 policies per
arm, identical seeds, **timing untouched** so the countdown-reseed trap does not apply.
**SELF-PAIR drift control: two copies of the shipped dump -> 0/110 matchups moved, bit-identical.**

| arm | props / density | first contact | % of clock | duty | no contact | agg win |
|---|---|---|---|---|---|---|
| **1400x1000 shipped** | 27 / 20.11% | **5.67 s** | 13% | **33.5%** | 0/880 | 57.5% |
| 2800x2000 naive stretch | 27 / 5.03% | 12.00 s | 27% | 24.8% | 0/880 | 55.3% |
| **2800x2000 built to the rules above** | 103 / 19.49% | **18.44 s** | 41% | **23.1%** | 30/880 | **44.1%** |
| 2800x2000 uniform tiling | 108 / 20.11% | 21.09 s | 47% | 16.1% | 39/880 | 51.9% |

Against the floors: first contact is **8x-19x the 0.8 s floor**, duty **2x-4x the 4 pp floor**, and
the HUB arm's aggregate win moves **-13.4 pp, outside the ~9 pp floor** (`chase` policy on the same
arm collapses 40.9% -> **1.7%**). The **paired** per-matchup delta is exact and is a separate
quantity: **95 of 110 matchups moved, mean 33 pp, max 100 pp.** The balance table is not the same
table at the new size.

**Your layout rules were the best arm measured** — density held, one pot dead centre at shipped
scale, true 180 degree point symmetry — and it still costs **+12.77 s to first contact**. It beats a
naive tiling; it does not rescue a 1v1 match.

### ❌ AND ONE CLAIM IN MY OWN AMENDMENT WAS FALSIFIED

I wrote *"more cover shortens sightlines and creates contact, so measure at the populated layout."*
The first half is **measured false**. First contact is **monotonic in prop count at fixed size**:

    12.00 s (27 props)  ->  18.44 s (103)  ->  21.09 s (108)

**Cover does not create contact in this sim; it blocks the approach** — both fighters path around 4x
more boxes, against an AI with no search behaviour. The advice to measure on the populated layout was
still right, and the rules are still right for the FRAME and for concealment. **Density is not a
pacing lever.**

**The fog is not a recovery lever either.** Sweeping `maxSafeRadius` 1985/1600/1300 moves first
contact 21.09 / 20.77 / 20.72 s — a 0.37 s spread, *inside* the floor — while never-contacted gets
**worse** (39 -> 98/880). A tighter ring damages before it herds. So the §48.1 answer is **derive
it**: the relative schedule is scale-invariant (1.1543 -> 1.1538) and only the absolute sweep doubles
(22.1 -> 44.1 wu/s). ⚠️ Pinning the 1x literal 993 on a 2x map is degenerate — both spawns start
*outside* it, **880/880 no contact**, every match over in 2.03 s.

### ⚠️ TWO THINGS THAT ONLY BREAK AT THE NEW SIZE

- **A single centre pot becomes lethal to pacing when cover is dense.** Four quadrant pots vs none is
  *bit-identical*. **One** pot at the exact centre with dense cover: contact 36.6 s, duty 3.3%,
  **542-801 of 880 matches with ZERO contact**, decided by fog. The same geometry is harmless at
  1400x1000.

  ❌ **THE ATTRIBUTION BELOW IS FALSIFIED. Kept verbatim because it steered a whole workstream.**
  > *"Traced: AI stalled 50% of the match, longest unbroken stall 18.6 s (`rules.ts:1034`). This does
  > not argue against the centre pot — it argues that the searchless AI is the binding constraint,
  > and it is the same constraint as §29a."*

  🚨 **It was NAVIGATION, not search.** `as_cost.mjs` (**32**) reproduced that table to the digit on
  `git show b9bc00e~1`, then read the belief cell `stepAI` itself writes: **stale for 0 of 2,020,248
  playing ticks.** That map declared **no concealment**, so `isVisibleFrom` returned true
  unconditionally — **100% of the stall was an AI that could see exactly where its target was and
  could not get there.**
  ✅ **`b9bc00e`'s reachability pass fixed it** — same fixture, today's layout: never-contacted
  **542/801 → 26/45**, contact **36.60 → 22.29 s**, duty **3.3% → 16.6%**. Isolated against
  concealment: stripping the plates gives the same numbers.
  ⚠️ **The citation was wrong too** — the constraint lives at `src/arena/types.ts:95`, not
  `rules.ts:1034`, and it is a *behavioural* claim rather than a cost one.
  ⇒ **Do not build AI search.** An ORACLE arm — `visible` forced true, a hard upper bound on what any
  search could buy — moves the aggregate **+0.0 pp at both map sizes** and is **bit-identical, 0 of
  110 paired matchups, at ×4**.
- **`MIN_SAFE_RADIUS` (140 wu) does not scale.** The endgame duel window shrinks 6.4 s -> 3.2 s and
  now opens *after* first contact, so the 100/150 HP asymmetry it exists to prevent re-opens (fog
  dealt 50.3 to the player, 0.0 to the enemy).

### ✅ WHAT THE SIZE DOES **NOT** BREAK
- **`aspect.mjs` PASSES at 0.00 wu.** `FAIR_PLAY.radiusUnits` derives from `REACH`, never from the
  arena — the camera is **size-independent by construction**.
- **Concealment scales cleanly**: buildable 80x80 cells **86 -> 652**. The ~168 wu ceiling is
  unchanged, so ~20 patches at 110-130 wu. Rule 5 holds.
- **Perf is survivable but not free**: draw calls 868 -> **574** (culling), triangles 451,278 ->
  **1,051,644** (+2.33x — `InstancedMesh` is not per-instance culled, so floor scatter tracks *area*).

### => THE SEQUENCING ANSWER
**The arena ships WITH the N-fighter refactor, not before it.** Nothing in `src/` was changed. The
work is not wasted: the layout rules, the fog derivation, the concealment count and the two
scale-only defects above are all now measured and written down, so the arena pass becomes execution
rather than discovery the moment the roster can fill it.

### ⚠️ AND THE HONEST RISK, STATED BEFORE THE WORK STARTS

**A ×4 arena with only TWO fighters will almost certainly play WORSE**, and that is expected rather
than a regression: the same two fighters have four times the floor to find each other on, against an
AI that cannot search. The sim is **hard 1v1 at the type level** — `MatchState` has exactly
`player: Fighter` and `enemy: Fighter` (`state.ts:287`) — so the 4–6 fighters this arena is *for*
require the N-fighter refactor first.

=> **Measure the 1v1 pacing cost BEFORE shipping the size**, and report it. If it is severe, the
arena wants to land WITH the roster change rather than before it. That is a sequencing question with
a measurable answer, not a taste call, so it is not being sent back to Uri.

---

## 49. ✅ ANSWERED BY URI 2026-08-11 — four of the five are decided

> **49a** *"Fewest deaths, then lower slot"*
> **49b** *"Keep per-victim (in force)"*
> **49c** *"AI player is currently only for testing the game. Later on when real PvP occurs each
> player has it stats based on the level if their brawler"*
> **49f** *"Local seat full, others as chips"*

✅ **49a AND 49c ARE LANDED — `3ae6749`.** Bit-identity held: **41,722,453 ticks / 12,423,915 events
in order, 0 divergent**, across default, 15:1 and 1:15 level arms, plus 38/38 self-consistency at
N=3–6. ⚠️ **49a is inert at every N today** and that is expected, not a failure: `deaths ∈ {0,1}` and
`deaths === 1` iff `hp === 0`, which rung 1 has already sorted. It becomes reachable the day respawns
exist. 49b needed no work (per-victim already ships). **49f is in flight.**

🚨 **49c IS A BIGGER STATEMENT THAN THE OPTION IT ANSWERS, AND IT REFRAMES A CONSTANT.** Uri's answer
says the AI opponent is a **test harness, not a design target**. So `ENEMY_MAX_HP` (90) is not a
balance dial for the shipped game at all — it is a **testing constant**, and in real play *every*
fighter's pool and damage come from `Fighter.level` and its character's card. That means:
- above 1v1 there is **no asymmetric seat**: fighters are dialled by LEVEL, not by slot
- `ENEMY_MAX_HP` keeps meaning **only** where the opponent is a bot, i.e. the current single-player
  duel and the measuring instruments
- ⚠️ and it retires §49c's "keep the seat dial" option permanently — **do not re-offer it.**
⚠️ It also touches `roster_lab`/`kit_lab`/`match-sim`, which all encode the 100/90 split as the world.
They are **instruments** and may keep it; nothing that SHIPS may.

**49e is not a decision** — it is a measurement task (four trail colours unmeasured; re-probe against
the floor during the §48 arena pass). **49d was never Uri's** — spawns above slot 1 belong to §48.

⚠️ **The original text is kept below in full**, because it is the record of what each step cost and
of the precondition that changed twice.

---

### 🔒 ORIGINAL §49 — kept verbatim; the answers above supersede the "Options" lists

## 49. ❓ THE BALANCE CALLS THAT ONLY EXIST ONCE THERE ARE MORE THAN TWO FIGHTERS

⚠️ **WAS "TWO BALANCE CALLS"; IT IS THREE, AND THE PRECONDITION IN THE NEXT SENTENCE HAS CHANGED.**
This opened: *"Both surfaced by the N-fighter container (`cdcdd65`). **Neither blocks anything
tonight** — at N=2 both are provably identical to today, and the seat cap is still pinned at 2. They
must be answered **before the cap is raised**, because each one silently picks a winner otherwise."*

**The cap is now raised** (`MAX_FIGHTERS` 2 → 6). Nothing about 49a or 49b changed, and nothing is
blocked: `createMatch`'s legacy `(arena, playerId, enemyId, levels)` form still builds **exactly
two** fighters, all 74 call sites in the repo use it, and **nothing in `src/` seats more than two**.
The list form that can seat 3–6 exists and has no caller outside the instruments. So the sentence
now reads: **these must be answered before anything SHIPS a match with more than two seats**, and a
third one (49c) came into existence with the list form.

⚠️ **AND IT IS FIVE NOW, NOT THREE.** The header above is kept as written because it is the record
of what each step cost. Making the PRESENTATION N-capable added **49e** (four of the six trail
colours are unmeasured) and **49f** (the top bar seats six nameplates by squeezing). Both are still
invisible today for the same reason as 49a–49c: **nothing in `src/` seats more than two**, and the
two-fighter frame is measured byte-identical at both shipped cameras.

At two fighters every one of them is provably identical to today — measured tick-for-tick over both
state and events against `cdcdd65`, not argued.

### 49a — the timeout tiebreak's rung 3 is now "the LOWER SLOT wins"

The 45 s timeout resolves in rungs: HP fraction → zone control → **tiebreak**. Rung 3 used to read
*"the tie goes to the human"*. In a slot array there is no "the human", so it now reads **"the tie
goes to the lower slot"**.

**Identical at N=2, by construction.** At N>2 it is a **standing positional advantage**: seat 0 wins
every exact tie, forever, and seats are assigned in `createMatch` argument order.

⚠️ **No corpus reaches it.** 3,520 forced-immortal timeouts landed **rung 1: 3,516 · rung 2: 4 ·
rung 3: ZERO**. So this cannot be settled by measurement — the case essentially never occurs, which
is also why it is cheap to change. `sim.test.mjs` §27(c) constructs all three rungs by hand and
checks them against the two-way formula written longhand, so whatever you choose stays pinned.

**Options:** lower slot wins (in force, invisible today) · a genuine draw · fewest deaths, then lower
slot · most damage dealt. ⚠️ A draw is not free — `GameEvent.match-ended` requires a non-null winner,
and the payout table has no draw row, so it is an economy change too (see §2, which asks the same
question for 1v1).

### 49b — a trail is worth N× more when there are N fighters

Trail marks used to carry `damaged: boolean` — **one bite total**. That had to change, because "one
bite, first victim in slot order" would have made trail damage depend on **seat order**, which is the
one thing a deterministic sim must not smuggle in. It is now `damagedMask: number`, a per-victim
bitmask: **order-free, and each victim can be bitten once.**

**Identical at N=2.** At N=6 it means **Donut's trail is worth up to 5× its current value** in one
pass, because five different fighters can each take the bite.

That is a **balance** decision, not a correctness one, and the honest options are:
- **keep per-victim** (in force) — a trail becomes an area-denial tool that scales with the crowd,
  which is arguably what a trail *should* be in a 6-player brawl
- **cap hits per mark** at 2 or 3 — keeps some scaling without a lane becoming lethal
- **scale `TRAIL.damage` down** as fighter count rises

⚠️ **Do not answer this from the 1v1 balance table.** `roster_lab`, `kit_lab` and `match-sim` all
assume a 110-cell **1v1** matchup grid; a 4–6 fighter balance number is a **different quantity** and
the instrument for it does not exist yet. Whoever prices this builds that first.

### 49c — ❓ NEW: which HP / size dial does **seat 2 and up** get?

Surfaced by raising the cap. `createMatch` now takes a FIGHTER LIST (the 3-argument form is a
compat overload and every shipped call site still uses it). At **two** fighters the dials are
unchanged and proven bit-identical: slot 0 gets `PLAYER_MAX_HP` (100), `PLAYER_SIZE`,
`HIT_RADIUS_VS_PLAYER`; slot 1 gets `ENEMY_MAX_HP` (90), `ENEMY_SIZE`, `HIT_RADIUS_VS_ENEMY`.

Above two, **every slot from 1 up gets the ENEMY dial** — the smallest rule that reduces exactly
to today, and it is a CHOICE rather than a derivation. A six-way brawl built this way seats one
100 HP fighter against five 90 HP ones: a standing **+11% pool advantage to whoever `createMatch`
listed first**, which is the same shape as §49a's rung 3.

⚠️ **At 1v1 that asymmetry is the point.** `ENEMY_MAX_HP` 150 → 90 is AUTHORISED DEVIATION #9 and
it is your difficulty dial (§12, §15). In a free-for-all there is no "the enemy", so the dial has
no obvious meaning and it silently becomes a seat advantage instead.

**Options:**
- **keep the seat dial** (in force) — slot 0 is "the human seat" and keeps its 100 HP edge at
  every match size. Zero work, and invisible until somebody plays a 6-way and loses seat 3.
- **one pool above 1v1** — everyone gets `PLAYER_MAX_HP` when `fighters.length > 2`, and
  `ENEMY_MAX_HP` keeps its meaning in the duel only. Symmetric; makes the brawl a different game
  object from the duel, which it arguably already is.
- **let LEVEL carry the difficulty instead** — your own stated direction is *"AI players need to
  be adjusted to the player's level"*, and `Fighter.level` already scales both pool and damage.
  Then `ENEMY_MAX_HP` is a duel-only constant and the brawl is flat.

⚠️ **Do not answer this from the 1v1 balance table**, for the same reason as §49b: `roster_lab`,
`kit_lab` and `match-sim` all assume a 110-cell **1v1** matchup grid. A 4–6 fighter balance number
is a different quantity and the instrument for it does not exist yet.

**Nothing is blocked by this.** The legacy `createMatch(arena, playerId, enemyId, levels)` form
still builds exactly two fighters, all 74 call sites in the repo use it, and nothing in `src/`
seats more than two.

### 49d — ℹ️ NOT a decision for you: spawns above slot 1 are REFUSED, on purpose

`ArenaDefinition` declares exactly two spawn points, so `createMatch` **throws** when a list seats
a fighter in slot 2+ without an explicit `spawn` rather than inventing a ring around the centre.
That is deliberate: spawn placement for 4–6 fighters is part of §48's layout pass, where true 180°
point symmetry is a **competitive-fairness** constraint in the same category as `aspect.mjs`. A
default invented in `sim.ts` would be a second, quieter source of truth for it, it would produce
balance numbers, and it would look like it worked. → **The arena pass owns this**; the sim will
refuse loudly until it lands.

⚠️ **AND THE PRESENTATION PASS DID NOT WORK AROUND IT.** Making the renderer N-capable needed a
way to actually put six fighters on screen, and the QA parameter that does it
(`?fighters=<id>@<x>,<y>;…`, `match.ts`) is a **transport for coordinates the probe chose** — it
carries no placement policy of its own, exactly like the existing `?px=`/`?py=`. The ring the
instrument uses lives in `tools/tmp/np_nfighter.mjs` and nothing shipped reads it.

### 49e — ❓ NEW: four of the six trail colours are UNMEASURED

Donut's Sticky Trail is drawn from a per-slot colour. Slots 0 and 1 are the two hexes the debris
pass **measured against the floor and the cast** (`#F5475E` rose, `#F5C147` gold — `vfx.ts`'s hue
contract, and the `trail_probe` numbers that produced them: the old mark was **0.3 degrees** of hue
from the floor it lay on). Above two fighters there were no colours at all, and a missing entry
composites to **black**, so four of six trails would have been an unreadable hole in the floor.

Four have been added — cyan `#47C4F5`, green `#6BE05A`, violet `#B36BF5`, orange `#F58A47` — placed
in the same luma band as the measured pair and spread away from the arena's WALKABLE rose 330–340.
🔴 **They are NOT measured.** The whole point of the block they sit in is that this cannot be
settled from a hue wheel: the first attempt at the two that ARE measured took the marks uniformly
dark, fixed the floor collision, and created a *cast* collision in its place at |dL| 0.132.

**Nothing is blocked.** No shipped match seats a third fighter, so no shipped frame contains one of
these. Whoever runs the 4–6 fighter arena pass should re-run `trail_probe` against the new floor
with all six. ⚠️ And note the standing warning: **warm chroma is the scarce budget in this frame
today** (0.053 against a 0.072 minimum), so adding three cool hues is exactly the direction
`arena-scan --baseline` says to check before assuming.

### 49f — ❓ NEW: the top bar seats six nameplates by SQUEEZING, and it shows

The HUD's fighter nameplates are now built one per slot instead of being a hard-coded pair. At two
fighters the DOM is character-for-character what it was (measured: byte-identical). At six, the top
bar is a flex row with `flex: 1 1 260px` per plate, so six plates plus the clock **compress to
~45% of their design width** and the clock is pushed hard left off centre. Photographed at 1280×720
in `shots/np/nf6.png`.

It is *legible* — every name, every HP number and every portrait is readable — but it is not a
design, it is a consequence. The honest options, none of them chosen:

- **keep the squeeze** — zero work, and it is what a 4-player match would ship with today;
- **local seat left, everyone else as small chips** — the Brawl Stars / Zooba pattern: your own
  bar full size, opponents reduced to portrait + a short bar;
- **drop the opponent bars entirely above 1v1** and rely on the floating pills over each head,
  which already exist and are already per-slot.

⚠️ **This is a LAYOUT call and it needs a plate, not a rule.** `menu_accept_portrait` measures the
2-fighter bar on three phone widths and passes; there is no equivalent for six, and building one
before the shape is chosen would pin the wrong thing.

---

## 50. ❓ EGG'S `Hatch!` CANNOT HIT ANYBODY, AND THE ONLY FIX COSTS THE WADDLE

**One taste call, one sim-design call, and one thing you do not have to decide.** Nothing is
blocked — nothing shipped tonight, and the tree is byte-identical to before this pass
(comment-only in `rules.ts`, proved mechanically and reproduced bit-identically across all 880
matches).

### The finding, in one line

**Egg's Hatch! is not weak. It is inert.** The chick flies at 80 wu/s. Every fighter in the game
moves at 105.6–120 wu/s when you drive them and 61.6–70 when the AI does. **The projectile is
slower than its target**, so there is no separation at which it catches anyone who is walking away.

Measured — the largest separation at which one press still delivers its full authored 15 against a
target walking straight away (`tools/tmp/hm_audit.mjs`):

| | |
|---|---|
| the separation the game lets you press it from | **140 wu** — the longest in the roster |
| against a fleeing **AI** | 58 wu (41% of that) |
| against a fleeing **human** | **27 wu** (19%) — and the hit radius is 26, so that is *"already touching you"* |
| Egg's own **melee** (Egg Tackle) | **84 wu** |

The game's longest-ranged weapon connects at **a third of its owner's punching distance**.

**Why nothing ever flagged it:** it is broken *symmetrically*. `c786fd7` found every homing weapon
is worth 1.89×–2.14× more in a human's hands than the AI's. Hatch! is the worst in the roster at
**2.00×** — and Egg's role split is only **+1.6 pp**, because 40% and 20% of nothing are the same
nothing. **A weapon that misses both roles equally looks balanced.**

### ❓ 50a — TASTE CALL: does the chick keep waddling?

`rules.ts` authors the slowness on purpose. `FLIGHT_MS.drift`'s comment is *"8.3 evade windows.
Egg's Hatch! — a chick that waddles at you."* That is a character choice and it reads on screen.

**Two of the three levers are refuted by measurement, not by opinion:**

- **Homing strength** — cannot help. Hatch! is the roster's only *single-projectile* homing weapon,
  so it wastes **zero** path on turning; a displacement-based rule leaves its reach at 27 wu,
  unchanged to the digit. A better turn rate cannot buy a weapon that never turns.
- **Reach** — cannot help. `REACH.rangedMax` is already the longest rung **and it sets the camera**.
  Reach works out to `range − speed_of_target × flight_time`, so at 1750 ms you would need a range
  over **210 wu** just to break even: a ~50% camera pull-back, and every character shrinks.

**Speed is the only lever, and it is the waddle.** Priced at 8 seeds against a frozen worktree, with
a no-op staging control reproduced bit-identically before any candidate was believed:

| candidate | Egg strength | roster range | roster min | rarity tier spread |
|---|---|---|---|---|
| **shipped** (80 wu/s, 1750 ms) | 46.9% | 8.8 pp | 46.3% | 6.9 pp |
| 280 wu/s (500 ms) | **70.6%** | 27.5 pp | 43.1% | 15.3 pp |
| 160 wu/s (875 ms) | 63.7% | 20.6 pp | 43.1% | 11.9 pp |
| 280 wu/s **+ damage 5→4** | 47.5% | 9.4 pp | 45.0% | 6.2 pp |
| 160 wu/s **+ damage 5→4** | 46.3% | 9.4 pp | 45.0% | 6.9 pp |
| 280 wu/s + damage 5→3 | 35.0% | 21.9 pp | 43.1% | 13.1 pp |

Read two things off that table:

1. **Uncompensated it is a +23.8 pp buff** — the strongest character in the roster by 16 pp. That is
   the tell that Egg's numbers were authored around a weapon delivering nothing.
2. **Compensated it lands, but there is no tuning room.** Damage moves Egg **~17.8 pp per point**
   (5 → 70.6%, 4 → 47.5%, 3 → 35.0%). That is the same coarseness that got the vitals pass refused
   in `6cc2438` (13.5–27.9 pp per point) inside an 8.8 pp band. "Damage 4 lands" is integer luck.

Every roster figure in both landing rows moves **inside the ~9 pp resolution floor**, so the balance
argues neither for nor against. **It is a straight trade of one feel for another and it is yours:**

- **(a) Keep the waddle.** Hatch! stays a flavour press that lands on someone who is standing
  still, charging, or already on top of you. The weapon reads as broken to anyone who tries to use
  it at range — which is where the game lets you press it from.
- **(b) 160 wu/s + damage 4.** 875 ms is still slow and readable (4.2 evade windows, the same rung
  as Burrito's Topping Swarm). The chick still visibly lumbers; reach goes 27 → 61 wu.
- **(c) 280 wu/s + damage 4.** It works properly at range; the waddle is gone. Best tier spread of
  the three (6.2 pp).

⚠️ If you take (b) or (c), **`FLIGHT_MS.drift` becomes an orphan rung** with no weapon on it.

### ❓ 50b — SIM CALL: `range` is doing two jobs, and one of them is a lie

This is the root of the whole family and it is **not** Egg-specific.

`ai.ts:pickWeapon` refuses to press a weapon past `w.range`, so **`range` is the separation a
fighter believes the weapon works at**. `sim.ts:stepProjectiles` retires a projectile at
`traveled >= range`, so **the same number is the path budget it actually gets**. Those coincide only
when the target is standing still — and every one of the 183 cells that validated the AI's ranking
key is a stationary target.

**23 of 23 ranged weapons cannot connect at their own press gate against a fleeing human.**

The proposal on the table was to retire on **displacement** instead of path length. Staged and
measured, and the answer is **"it helps, but not where you would expect"**:

| Egg's Hatch!, fleeing human | path (shipped) | displacement | "relative" |
|---|---|---|---|
| straight away | 27 wu | **27 wu** | 27 wu |
| perpendicular | 34 wu | 34 wu | 34 wu |

| Burrito's Topping Swarm, fleeing human | path | displacement | "relative" |
|---|---|---|---|
| straight away | 51 wu | 55 wu | **128 wu** |
| perpendicular | 26 wu | **69 wu** | 118 wu |

Displacement refunds only the path a shot spends **turning**. On a straight chase there is no turn,
so it refunds nothing — it does **not** remove the human/AI asymmetry at its root, and it does
nothing at all for Egg. What it does buy is large and real: it roughly **triples** a pellet fan's
reach against a target running sideways.

The third column is the rule that *would* fix it at the root: denominate the budget in the
**target's frame**, so a shot gets `range` world units of *ground gained* rather than ground
covered. It nearly equalises the two roles. Its price is honest and should be stated: it needs a
hard age cap (a shot that cannot gain ground would otherwise never die — a new constant), it makes
every ranged weapon meaningfully stronger, and it lands in all 110 matchups at once.

**Nothing here is urgent and nothing is blocked.** Recorded because the *next* homing weapon anyone
authors will hit the same wall, and because the honest version of the proposal is now measured
rather than assumed.

### ℹ️ 50c — NOT a decision for you: Burrito's Topping Swarm was fixed and it made him *worse*

Included so nobody re-runs it. Burrito's Swarm has the identical defect (reach 51 wu against a
140 wu gate; 1.89× more valuable in your hands than the AI's). Applying **exactly** the one-token
fix that worked on Sushi (`0558bc5`) makes Burrito **−11.9 pp weaker**, and the mechanism is now
measured: homing turn rate is *angular*, so **the turning radius scales with speed**. Topping Swarm
is the roster's widest fan (55°); at the faster speed its outer pellets cannot turn back inside
60 wu, and it loses **half its delivery against a target that is standing still**.

Sushi's 40° fan survives the same speed cleanly and Egg has no fan at all — which is why `0558bc5`
was safe, and why that rung **is not transferable between homing weapons**. Burrito is left alone;
the only lever that helps him without a close-range cost is 50b.

---

## 51. ❓ THE APP IS SMALLER THAN IT LOOKS — the bundle already survives a third base. Pick a wrapper.

**Nothing is blocked and nothing shipped in `src/`.** This is a wrapper choice, one small
`index.html` change, and two tiny defaults. The game itself is ready.

### The good news first, because it changes the size of the job

You asked for this as a mobile app. The fear was the failure class that already cost us the silent
menus: **Vite rewrites the asset URLs it resolves and never string literals in TypeScript**, so a
hand-typed `/audio/…` shipped as a permanent 404 on the deployed build and **427 audio assertions
survived it**, because every one pointed at a server rooted at `/`. A wrapper is a *third* base —
so the question was how many more of those are hiding.

**Answer: zero.** Every emitted chunk was audited at three bases for root-absolute literals,
`new URL`, `fetch`, CSS `url()`, workers and service workers. The only asset URL built in
TypeScript is the theme, and it already reads `import.meta.env.BASE_URL`. `DEPLOY_BASE=./` makes
the whole bundle relative and it runs under any prefix, verified end to end:

| built at | served at | expected | got |
|---|---|---|---|
| `/food-arena/` — the live deploy | `/food-arena/` | PASS | **PASS** |
| `./` — the wrapper | `/app/v1/wrap/` | PASS | **PASS** |
| `/` — control | `/app/v1/wrap/` | FAIL | **FAIL** |
| `/food-arena/` + the historical `music.ts` literal — control | `/food-arena/` | FAIL | **FAIL** |

`node tools/tmp/ab_basepath.mjs --selftest`. The two controls exist because a guard that has not
been shown to fail on the bug it guards against is not a guard.

### The one hard constraint, measured

🚨 **The bundle cannot load over `file://`, and no base fixes it.** Vite emits
`<script type="module">`; a module script is fetched with CORS; a `file://` document has an opaque
origin, so Chromium refuses it. The page sits on *"Heating the kitchen…"* with zero canvases,
forever, with the URL it asked for being **correct**. **The wrapper must supply a scheme or a
loopback origin** — which every modern wrapper does by default and Cordova famously did not.

**Assumed.** Nothing. No wrapper has been chosen and none is implied by anything in the tree.

### ❓ 51a — which wrapper?

Everything below satisfies the scheme constraint. They differ in what you own afterwards.

| | what you get | what it costs |
|---|---|---|
| **1. Capacitor** | Serves over `capacitor://localhost` (iOS) / `https://localhost` (Android) out of the box, so §1 is solved by the default. First-party plugins for orientation lock, status bar, safe areas and the hardware back button. `npx cap sync` after each `vite build`. | An `ios/` and `android/` project in (or beside) the repo, a Node dependency in the build, Xcode + Android Studio to produce a store binary. Most-travelled path; most tutorials are correct. |
| **2. Hand-rolled WebView** | `WKWebView` + `WKURLSchemeHandler` on iOS, `WebView` + `WebViewAssetLoader` on Android. Nothing between you and the platform; smallest possible surface; no JS dependency at all. | You write the scheme handler, the orientation lock, the inset opt-in, the back-button policy and all the store plumbing yourself — a few hundred lines per platform — and you own them forever. |
| **3. PWA, no wrapper** | Zero native code. Add a manifest + a service worker and it installs to the home screen from the browser. | **No app store presence**, which is usually the actual point. Orientation lock is honoured unevenly on iOS. Offline needs a service worker we do not have. |
| **4. Tauri v2 mobile / RN WebView** | Same shape as (1) with different ecosystems. | Smaller communities for the mobile-WebView case specifically; more unknowns per hour spent. |
| ❌ **Cordova** | — | **Defaults to `file://`, which is the exact configuration measured above as unbootable.** Listed only so it is refused on a number rather than on taste. |

**This pass deliberately did not pick one.** It is your call, and the honest input is that the
game is wrapper-agnostic: `docs/APP.md` states every requirement as a capability rather than as an
API in somebody's SDK, so choosing (2) later after starting with (1) costs nothing in `src/`.

### ❓ 51b — two small defaults that come with whichever you pick

1. **Back button at the home screen.** In-app back already works — the router is history-driven and
   its `popstate` handler names the Android hardware button explicitly. But the first mount
   *replaces* rather than pushes, so at home there is nothing to go back to. Either **let it exit**
   (Android's default, and correct) or **intercept and require a second press**. Most games do the
   second. Wrapper-side either way; no `src/` change.
2. **Bundle the fonts.** `index.html` loads Rubik and Heebo from `fonts.googleapis.com` — the only
   external request the game makes, and an app is offline by definition. With the CDN blocked:
   **33 font faces → 0**, the UI falls to the platform sans, and the home screen's weapon caption
   **clips** — `Tomato Toss –` re-wraps and loses its leading `T` off the left edge of its pill.
   Self-hosting the two `woff2` files fixes it and also removes a render-blocking third-party
   request from the **web** build's critical path. One `index.html` edit; not made in this pass
   because that file belonged to nobody tonight.

### ℹ️ 51c — NOT a decision: forcing landscape in the app does NOT retire portrait on the web

Your §14 answer — *"the game should be landscape… when it will be in an app, we'll force
landscape"* — is taken as settled and is not reopened. Recording the consequence so nobody
"tidies up" on the strength of it:

* **App target:** landscape-locked natively. Portrait is unreachable.
* **Web target:** unchanged. A phone browser still renders portrait, so
  `menu_accept_portrait.mjs` (**219** assertions) **stays a shipped gate**, and the portrait layouts
  in `shop.ts`, `settings.ts`, `trophyRoad.ts` and `characterSelect.ts` stay load-bearing.

Deleting them would be a regression *in web*, justified by a decision that was only ever about
*app*.

### ℹ️ 51d — NOT a decision: the audio unlock already works, and you should not "help" it

Mobile autoplay policy needs a real gesture. **The first tap supplies it**, measured on a phone-shaped
touch device with the policy forced on: the engine goes `idle → running` **131 ms after the first
pointerdown**, the theme loads (`200`) and the master bus carries 0.021 RMS — against a no-tap
control that stays `idle` with no audio context at all for 10.6 s. The title card's "tap to start"
is what spends that first tap.

**So: do not add a synthetic gesture, and do not deep-link the wrapper past the title card.** If it
opened straight on home, the theme would still start but the player's first *button* press would be
silent — `resume()` is asynchronous, so the voice scheduled inside that first gesture is dropped.

⚠️ One caveat stated rather than hidden: that measurement is Chromium with
`--autoplay-policy=user-gesture-required`. **Real iOS WebView behaviour is not verified here** and
Safari's rules for media elements are stricter. It is the first thing to check on a real device.

⚠️ And one instrument fault worth your knowing, because it is the kind of thing that produces
confident nonsense: the first version of that probe read the state with `page.evaluate()` before
the tap, **which itself grants a user gesture** — and duly reported the theme playing with **no tap
at all**. Caught by its own control, and the probe is now built so the measurement never talks to
the page until it is over.


---

## 52. ❓ MULTIPLAYER TRANSPORT — authoritative server, lockstep, or rollback?

**Nothing is blocked and nothing shipped.** No `src/` file was touched by this pass. The sim
already seats six and already takes one input per slot, so this is the *next* question, not a
prerequisite for anything in flight.

📄 **The full evidence is `docs/NETCODE.md`.** Every number below comes from
`node tools/tmp/nc_measure.mjs`, whose 18 instrument checks each carry a known-bad input.

### The one thing that makes this decidable at all

The sim is **pure, deterministic and seeded** — bit-identical over **26,388,976 ticks and
7,039,194 events in order** (`cdcdd65`, `1b506d6`), with **0 `Math.random` draws measured live
over 17,628 real ticks** and **0 clock reads**. Most games cannot even consider lockstep. This
one can. **Any design that spends that property is the wrong design**, and none of the three
below spends it.

### The measured comparison

| | authoritative server | lockstep | rollback |
|---|---|---|---|
| client sends | 0.64 KiB/s | 0.64 KiB/s | 0.64 KiB/s |
| client receives, 6 seats | 12.9 KiB/s binary delta @60 Hz | 2.11 KiB/s | 2.11 KiB/s + sync |
| CPU, 6 **humans** | **2.66 µs/tick** — 0.016% of real time | same, on **every** client | same × rollback depth |
| CPU, 5 **bots** | 399.50 µs/tick — 2.40% | same, on every client incl. the phone | **3.2 ms per 8-tick rollback = 19% of a frame** |
| needs identical floats on every browser? | **no** | **yes** — 32 call sites | **yes** — same 32 |
| needs `MatchState` to serialise? | **yes, and it does not today** | **no** | only the first sync |
| re-fires the VFX/audio event stream? | no | no | **yes** — 0.335 events/tick |
| survives a hacked client? | **yes** | no | no |

**Bandwidth does not decide this.** Even the dumbest option — a full JSON snapshot 20×/s at six
seats — is 158.7 KiB/s, and it fits on a phone.

### 🔵 My recommendation, and the number behind it

**Authoritative simulation with client-side prediction of your own fighter. Built first as a HOST
PEER** (one player's browser runs the match, the rest send inputs over WebRTC), **and moved to a
real server later without touching `src/game/`.**

**The number: 2.66 µs.** That is one six-human tick — **0.016% of real time, ≈6,260 concurrent
matches per CPU core.** Server CPU is the *only* resource an authoritative design spends that
lockstep saves, and here it costs essentially nothing. What lockstep must buy instead is
bit-identical floating point across V8, Safari's JavaScriptCore and Firefox's SpiderMonkey over
**32 implementation-approximated call sites** (27 `Math.hypot`, 5 trig) — and that cannot be
bought with a measurement, only with a 32-site rewrite and a cross-engine test rig we do not have.

Two supporting reasons, both specific to this game rather than general advice:

* **This repo is public and the game has a HIDING mechanic.** Under lockstep or rollback every
  client holds the whole state, so §29's concealment is decoration against a modified client.
  Only the authoritative model can withhold what a player should not see.
* **Rollback breaks on bots, and a live 6-player game fills empty seats with bots.** It is free at
  six humans (0.17% of a frame per 8-tick rollback) and 19% of a frame with five bots — 45% at
  p99. It is also the only design that **re-fires the event stream**, so every damage number,
  explosion and note of the score would have to become idempotent.

### ⚠️ What choosing my recommendation costs you

Stated because a recommendation that only lists its upsides is an advertisement:

* **Infrastructure, eventually.** §51 wraps the *client*; there is no backend anywhere in this
  repo. The host-peer form postpones that; it does not avoid it.
* **`MatchState` does not survive a round trip today.** `JSON.parse(JSON.stringify(state))` breaks
  **3 alias invariants silently** (`player` stops being `fighters[0]`), loses **7 `-Infinity`
  sentinels** to `null`, and drops the arena references `brokenConcealment` holds by identity. A
  network hop needs a hand-written encoder that every future `state.ts` field must be added to.
  ⚠️ **But `postMessage` uses the structured clone algorithm, which preserves all of it** — so the
  host-peer form costs **zero** serialisation work and the bill only arrives at a real server.
* **The AI is 150× the sim.** A six-human tick is 2.66 µs; the same tick with six bots is 399.50 µs,
  and **99.2% of that is `stepAI`**. A phone acting as host spends 2.4% of its frame budget
  simulating before it renders anything.

### ℹ️ 52b — NOT a decision: what this changes about §49

None of §49a–§49f is decided here, but three of them get cheaper or dearer depending on 52:

* **§49a (timeout tiebreak).** Under an authoritative server it is a **config value** changeable
  mid-season; under lockstep/rollback it is a **protocol version** needing a forced client update.
  Still cheap either way — 3,520 forced-immortal timeouts reached rung 3 **zero** times.
* **§49c (the seat dial) has a MEASURED cost if you differentiate seats by SIZE rather than HP.**
  `movement.ts:navGrid` caches one passability grid per arena and keys the cache on the fighter's
  size. Today every fighter is 42 wu, so the grid is built **once, ever**. Give seat 0 a different
  body and consecutive AI seats alternate the requested size: **1,114 full grid rebuilds over 680
  playing ticks, against 1.** → **Prefer the HP dial to the size dial**, whichever option you pick.
  (This is a latent bug in its own right — it would bite the moment anyone varied `Fighter.size`
  for any reason. Reported out of set; `movement.ts` is not this pass's file.)
* **§49d (spawns above slot 1) turns out to be netcode-correct already.** Under lockstep or
  rollback every peer must compute the *same* spawn points, and a derived ring is `Math.cos` +
  `Math.sin` — two of the 32 risky call sites — so **a derived ring would be a desync at tick 0,
  before anybody moved.** `sim.ts` already refuses to invent spawns and `match.ts`'s QA
  `?fighters=` parameter is already a transport for coordinates somebody else chose. Nothing to
  change; the existing refusal is right for a second reason.

§49b is transport-neutral (the `damagedMask` is order-free, which is exactly what a replicated
tick needs) and §49e/§49f are presentation and unaffected.

### 🚨 52c — NOT a decision, but the arena pass needs to know

`NAV_MAX_CELLS` is **40,000** and its own comment says *"Never hit at 1400×1000"*. **§48 makes the
arena 2800×2000**, which at the shipped 10 wu cell is **56,000 cells — over the cap** — so
`movement.ts:navGrid` doubles the cell to **20 wu** and the grid stays 140×100. Verified against
the real `navGrid` on a bare arena of each size.

So the AI's pathfinding does **not** get four times more expensive on the bigger map — **its
resolution silently halves.** And `NAV_CELL`'s own doc block records that **cell 20 already failed
the shipped kitchen's tightest legal gap** (an 11 wu band of legal centre positions) and *"cost 7
of 358 cells"*.

→ **One constant, owned by the §48 arena pass.** Nothing to decide; it needs to be on their list.

### ❓ 52a — the actual question for you

1. **Which transport?** Authoritative (my recommendation) · lockstep · rollback · "not yet".
2. **If authoritative: host peer first, or wait for a real server?** Host peer needs only a
   signalling service and exercises the whole architecture with zero serialisation work. A real
   server is the only form that survives the host quitting mid-match.
3. **Is multiplayer even next?** Everything above is true whenever you get to it. The sim will not
   drift out from under it — the bit-identity differ is a standing gate.

---

## 53. ✅ ANSWERED 2026-08-11 — the current map seats FOUR, and the endgame ring scales with N

> **53a** *"6 players only on the ×4 map"*
> **53b** *"Scale the radius with player count"*

### 53a — 1400×1000 IS A FOUR-PLAYER MAP. Ship four now; six waits for §48.

Uri said it from play — *"this map can't fit 6 players"* — and `sp_place.mjs` (**22**) then measured
it: of **327,561** cells on a 2 wu lattice, **2,186** satisfy every spawn rule, in **two** mirror-pair
regions. Three pairs need three, so pair C shares the west bay with pair A at **75.2 wu — inside
`REACH.meleeHeavy` (84)**. An exhaustive 1 wu search caps it at **77.6**.

Observed, not inferred: at 9 s of a seeded N=6 match slot 0 reads **0/70, dead**, and **the two
worst-hurt seats are both bay-sharers while the two healthiest are both in the north lane**
(`shots/sp/n6-playing.png`). ✅ **The paired control in the same run is healthy: N=3 and N=4 spawn
509.8 wu apart and nobody died.**

**So four players is shippable on the shipped map today, and six is gated on the ×4 arena.** That
makes **§48 the path to six**, not an optional enlargement.
⚠️ **Three alternatives were offered and rejected, so nobody re-derives them:** letting two seats
start concealed (would have bought 143.9 wu — clear of every weapon — at the cost of 2 of 6 players
starting hidden); relaxing the runway rule (it binds by **47×**: dropping it alone takes 2,186 →
103,926 cells); and re-placing the six concealment patches.

### 53b — `MIN_SAFE_RADIUS` scales with fighter count

It is **140 wu and constant**, while the pot burns to r=95 and blocks a centre to r=73 — so the
0 HP/s floor is an **annulus 45 wu wide, 1.07 body widths, at every N AND every arena size.** Evenly
spaced neighbours: **N=4 chord 166 wu** (outside every reach) → **N=5 138 wu, inside `rangedMax`** →
**N=6 117 wu, inside `rangedLong`**. ⚠️ **A bigger arena does not fix this — the floor is a
constant**, which is why it is answered here rather than inside §48.

=> The final ring must hold N fighters at a fightable spacing. ⚠️ **The fog schedule is derived from
this radius**, so it must be re-derived rather than pinned, and the change is measurable at N=2 as a
no-op or it is wrong.

### ✅ LANDED 2026-08-11 as `4bb64e4`

`src/game/rules.ts` exports **`minSafeRadiusFor(N) = max( MIN_SAFE_RADIUS , ENDGAME_STANDOFF / sin(π/N) − POT.dangerRadius )`**
— two derived terms, each binding in its own regime.

| N | ring | binds | chord between neighbours |
|---|---|---|---|
| 2 | 140.00 | pot | 235.00 |
| 3 | 140.00 | pot | 203.52 |
| 4 | 140.00 | pot — **0.17 wu of margin** | 166.17 |
| 5 | 187.42 | spacing | 166.00 |
| **6** | **237.00** | spacing | 166.00 |

**The threshold falls between 4 and 5 — this section's own verdict, reproduced rather than fitted.**
The chord is measured at the **mid-annulus** `(dangerRadius + safeRadius)/2`, the only circle adjacent
to neither the burn ring nor the fog; the 2 and the /2 cancel, which is *why* the pot radius appears
in the answer. The standoff band is `REACH.rangedMax` + the larger hit radius = **166 wu**, which lands
inside `FAIR_PLAY.radiusUnits` (199.2), so the final ring is *out of reach and still on screen*.

**N=2 is a proven no-op**, as this section required: 45,959,702 ticks across three level configurations,
12,503,511 events in order, **0 divergent, 0 added fields** — measured on a detached worktree because a
peer had 32 uncommitted lines in one of the six compared modules.

⚠️ **The finding worth keeping: `range + hitRadius` is not a miss, it is a coin flip in the last ulp.**
`p.traveled` is a running sum — 874 additions of 0.16 reach 139.99999999999773, so expiry does not fire,
the hit test runs once more, and sees 25.99999999999 against a 26 wu radius. And distance is computed on
**absolute** coordinates, so **the same shot at the same separation lands in a 3000 wu arena and misses in
a 4000 wu one.** The standoff therefore takes the *larger* of the two hit radii (166, not 165.2) to put
the binding chord 0.8 wu clear of the razor. The gate asserts the **indeterminacy**, not a direction.

🔴 **Consequence for §48's new map:** at six seats the ring closes to **237 wu**, and the ×4 layout's
nearest solid cover sits at **241.35 wu** — 3.65 wu of clearance. **Nothing solid may come inside ~237 wu
of centre** or six fighters get funnelled into a ring they cannot occupy. Concealment inside it is fine —
it is cover you can shoot through.

---

## 54. ✅ ANSWERED 2026-08-11 — Uri cleared the whole backlog, and delegated the technical calls

> **§52** *"Decide what is best for the project. i don't understand the technicalities."*
> **§51a** *"Not technical - Pick for me."*
> **§50a** *"chick is faster than the egg"*
> **§50b** *"do what is needed"*
> **§33** *"the phone experience is very bad. VFX looks clunky and the in browser gameplay is not playable. this is why i want to move to app."*
> **§2** *"no. after 30 seconds reduce the fog to all screen and the one who has more HP wins. (Sudden Death)"*
> **§47 / §35 / §17 / §27** *"you decide"* · **§9** *"not sure what it means"*

### 🚨 §33 IS NOT AN AUDIO ANSWER — IT IS THE MOST IMPORTANT LINE IN THE MESSAGE

It was asked as *"does the theme play on your phone"*. The answer is that **the game is not playable
on a phone at all**: *"VFX looks clunky and the in browser gameplay is not playable."*

⚠️ **AND THE INFERENCE IN IT NEEDS CORRECTING BEFORE ANY WORK IS AIMED AT IT.** *"this is why i want
to move to app"* — **a wrapper will not fix this.** Capacitor, a WebView and Safari all run **the same
WebGL renderer at the same frame rate**. An app buys orientation lock, fullscreen, no browser chrome,
no CDN round-trip and a real origin. It buys **nothing** on draw calls, triangle count, shader cost or
touch latency. **If the frame is slow in mobile Safari it will be slow in the app.**
→ **Phone performance is now the top item and it is its own investigation**, not a side-effect of
§51a. Everything measured on this project has been measured on desktop SwiftShader.

### §52 — DECIDED: authoritative simulation with local prediction, host peer first

Uri delegated it. Taking the measured recommendation: **2.66 µs/tick** with six humans is 0.016% of a
core (~6,260 concurrent matches), so **server CPU — the only thing lockstep saves — is free here**,
while lockstep *requires* bit-identical `Math.hypot`/trig across V8, JSC and SpiderMonkey over **32
implementation-approximated call sites**, which no measurement can guarantee.
⚠️ **Build it as a host PEER first and move it to Node later without touching `src/game/`.** And
⚠️ **`MatchState` does not survive a JSON round trip** — three alias invariants break *silently*
(`player` stops being `fighters[0]`), seven `-Infinity` sentinels flatten to `null` — while
`structuredClone` preserves all of it. **The obvious wire format corrupts state in a way nothing
reports.**

### §51a — DECIDED: Capacitor

⚠️ **Cordova is refused on a number** — it defaults to `file://`, and a `file://` document has an
**opaque origin**, so `<script type="module">` fails CORS: measured `net::ERR_FAILED`, 0 canvases,
stuck on the boot curtain forever **with the URL it asked for correct**. Capacitor serves from a
custom scheme with a **real origin**, which is the one thing the bundle actually needs; it is the
smallest delta from the static build we already ship (proven to work at any base, `ab_basepath` 4/4),
and it supplies orientation lock and safe-area insets natively. A hand-rolled WebView is the same work
without the ecosystem; a PWA does not give reliable iOS fullscreen or audio.
⚠️ **It does not fix §33.** See above.

### §50a — Egg's chick must be FASTER THAN EGG. That is now a derivable constraint, not a taste call.

Egg's card speed is **4**; `PLAYER_SPEED` is 0.12 and `AI_CHASE_SPEED` 0.07 wu/ms, scaled by
`speedFor`. `Hatch!` sits on `SPEED.maxDrift` = **80 wu/s**, which is slower than **every fighter in
the game** — so the projectile can never catch anything, in either role.
=> **The rung must be raised until the chick's speed exceeds Egg's own delivered speed with margin.**
⚠️ **`FLIGHT_MS.drift`'s comment calls it *"a chick that waddles at you"*** — that flavour is now
overruled by Uri, who says the chick is faster than the egg. **Update the comment; do not preserve the
waddle.**
⚠️ **Damage compensation is INTEGER LUCK at this scale** — damage moves Egg ~17.8 pp per point inside
an 8.8 pp band. Report the tier table every iteration.

### §50b — DECIDED: fix the retirement rule at its root

**23 of 23 ranged weapons cannot connect at their own press gate against a fleeing human**, because
`stepProjectiles` retires on **cumulative path length** while the human flees at 120 and the AI at 70.
⚠️ **Displacement is NOT the fix** — it refunds only path spent *turning*, and a straight chase has no
turn, so it changes Egg by **nothing** (27 → 27). **Denominate the budget in the target's frame.**
**The price is stated and now authorised: a new age-cap constant, every ranged weapon stronger, all
110 matchups moving at once.**
⚠️ `pickWeapon`'s gate and `stepProjectiles`' retirement must end up denominated in the **same
quantity**, or the belief/budget split reappears somewhere else.

### §2 — SUDDEN DEATH replaces the timeout tiebreak

> *"after 30 seconds reduce the fog to all screen and the one who has more HP wins."*

**Reading, flagged rather than assumed:** at **30 s of the 45 s match** the safe radius collapses to
**zero** so the fog covers the whole arena and everyone takes ring damage; the match then resolves to
whoever is left, which is whoever had more HP. **No draw. No tiebreak rungs.**
⚠️ **This supersedes §49a** (*"fewest deaths, then lower slot"*) **for the 1v1 timeout**, because a
timeout with a collapsed ring should no longer be reachable. **§49a's rungs stay implemented** — they
are still the resolver of record if the clock ever runs out — but they should now be unreachable, and
that is worth asserting rather than assuming.
⚠️ **It also interacts with §53b** (the ring scales with N). Sudden death is the ring going to zero;
§53b is the ring's size before that. **They must be derived together.**

### §9 — explained, then decided: NO wind-up

**What it means:** Lollipop's `giantSlam` resolves **on the same tick it is cast**. There is no
wind-up frame, so it **cannot be dodged — only explained after the fact**. The question was whether it
should telegraph.
**Decision: leave it.** It is bounded by construction (an undodgeable hit may not exceed the biggest
dodgeable one — Water Bottle's Mega Splash at 18), `render/camera.ts` deliberately excludes it from
the fair-play radius, and its attribution cue is verified readable with the caster off screen. Adding
a wind-up is **a new deferred-resolution path in `combat.ts`**, where melee is instantaneous — a real
sim change for a defect nobody has reported from play.

### §47 — DECIDED: 🍭 everywhere

One mismatch in 31 weapons / 34 abilities. The move is **named** "Giant Lollipop" and it is the
character's signature; the emoji should say *which move*, not *what status it applies*. Change the
**ability** entry `💫 → 🍭`. ⚠️ The 0/3 score on the `lollipop` glyph is **not** a reason — it was
taken at a 20 px fallback the game never ships.

### §35 — DECIDED: leave the corner nameplate showing a concealed enemy's HP

Edge 2 already **closed** (`f0e7aed`). Edge 1 stands as built: the nameplate reports **HP, not
position**, so it leaks nothing about where they are; it is a fixed layout element, so hiding it
leaves a hole; and it tells you nothing you did not already know from having hit them.

### §17 — DECIDED: leave the hurt grunt at `gain: 0.9`

Its evidence **predates the contact spray**, so re-measuring is cheaper than changing. Uri has played
this build and the one audio complaint on record was a 404, not a mix balance.

### §27 — DECIDED: leave the title card's cool cove

Already in force, already measured, already written into `opening.ts` in numbers. It protects
character select (**7.00, the strongest screen in the build**) and home, which consume the same
constant. Reversing later is additive and cheap.

---

## 55. ✅ MEASURED 2026-08-11 — the phone screen. **Uri's instinct to force landscape is now a number, and the portrait half of the plan is worth NOTHING.**

Uri, on his own phone: *"force full screen horizontal on game launch."* That is now measured rather
than assumed, and the measurement **splits his sentence in two** — the *horizontal* half is worth a
lot and the *full screen* half is worth nothing without it.

`tools/tmp/sc2_screen.mjs`, 40 cells, reading the real canvas rect out of `Stage.resize()`:

| device | Safari tab | added to home screen |
|---|---|---|
| iPhone 15 **landscape** | 75.2% | **100.0%** |
| iPhone 14 landscape | 77.5% | **100.0%** |
| 16 Pro Max landscape | 77.7% | **100.0%** |
| Pixel 7 landscape | 80.2% | **100.0%** |
| iPhone 15 **portrait** | 34.6% | **34.6% — ZERO GAIN** |

🚨 **The two losses are NOT additive, which is how everyone including me had been reasoning about
them.** In portrait the canvas is **width-bound**: `Stage.resize()` sets `h = cw / (4/3)` and never
reads viewport height at all, so every one of the ~193 CSS pixels reclaimed from browser chrome lands
**in the letterbox**. Identical on all five devices tested. Both PNGs were read: same arena strip,
more empty dark space. **Portrait standalone is not bigger, it is emptier.**

=> **Add-to-Home-Screen is a LANDSCAPE feature.** It takes 75–80% of the screen to 100%. In portrait
it is a no-op. This does not weaken Uri's request — it sharpens it: **the orientation is the whole
prize, and the fullscreen is the reward for getting it.**

### The 4:3 mask — DECIDED (Uri delegated it): **DO NOT WIDEN.** And the fairness gate cannot be cited either way.

The obvious way to reclaim the portrait letterbox is to widen `SUPPORTED_ASPECT.min` from `4/3`.
Two builds differing **only** in that constant, iPhone 15 portrait:

| `min` | canvas | share of screen | guaranteed R | visible arena **depth** |
|---|---|---|---|---|
| `4/3` | 393×295 | 34.6% | 199.22 wu | 462 wu |
| `0.46` | 393×852 | **100.0%** | 199.22 wu | **1181 wu** |
| *(landscape, for scale)* | 852×393 | 100.0% | 199.22 wu | 398 wu |

It gains 2.89× the pixels and loses on three counts:

1. **Competitive fairness.** A portrait player would see **2.96× the arena depth** of a landscape
   player. Today that ratio is 1.16×.
2. 🚨 **`tools/aspect.mjs` PASSES at 0.00 wu on BOTH arms — so it must not be cited for this.** It
   checks the *floor*, which `computeFairDistance()` holds at every aspect **by construction**;
   nothing gates the *bleed*. **The fairness gate is structurally blind to the exact change it looks
   like it authorises.** A green `aspect.mjs` here means "the thing I measure is unaffected", not
   "this is fair" — and that is the single easiest way this decision could have been got wrong.
3. **The look breaks.** The PNG was read: at 2.5× camera distance the depth fog saturates the whole
   upper frame flat orange and the fighter is a speck.

A middle point exists and is derived, not guessed — `min: 1` gives 393×393, 46.1% of screen, 1.48×
depth. **Not taken**, because the landscape path reaches 100% with zero fairness cost and portrait is
not the orientation this game is being aimed at.

### 🔴 The one action standing between all of this and Uri's phone

**The deploy is stale.** `gh-pages` still serves a bundle with **no manifest in it**, so
Add-to-Home-Screen currently buys him nothing on any device. Rebuilding with
`DEPLOY_BASE=/food-arena/` and pushing `dist/` publishes whatever HEAD holds for every agent running
at that moment, so it is sequenced deliberately: **it happens once the in-flight mobile work lands,
not per-commit.**

### Could not be measured here, and it is worth knowing which

- **Real `env(safe-area-inset-*)` values.** Chromium reports 0 whatever it emulates, so the
  `black-translucent` inset behaviour is a **platform claim, not a measurement**.
- **Anything about WebKit specifically.** Standalone mode is emulated as *the viewport change it
  causes* — exact for canvas geometry, and silent about everything else iOS does.
- ⚠️ **There is no `ScreenOrientation.lock()` call anywhere in the codebase**, and on iPhone it is a
  silent no-op regardless. Forcing landscape on iOS Safari is not available; it comes with the
  wrapper (§51a, Capacitor), which is the one thing a wrapper genuinely does buy.

---

## 56. ✅ MEASURED 2026-08-11 — §33 ANSWERED. The phone is a **draw-call** problem, the fix is known, and **the ×4 map must not be deployed to Uri until it lands.**

§33 was Uri's most important line — *"the phone experience is very bad. VFX looks clunky and the in
browser gameplay is not playable."* It has now been measured on the production bundle at the tier a
phone actually gets (`low`, buffer 1055×487 @1.25, ANGLE/Metal, CPU ×4).

### 🔴 The timing fact that gates the deploy

| | when |
|---|---|
| the build Uri actually played (`gh-pages` `a0bf880`) | 2026-08-11 **08:05** |
| his screen capture | 2026-08-11 **16:04** |
| `6631446`, the ×4 arena | 2026-08-11 **16:33** |

**Uri's capture predates the ×4 map by 29 minutes.** Everything he reported describes the
**1400×1000** map. That build measures **7.40 ms** of main-thread JS at cpu ×4; HEAD measures
**11.00 ms (+48.6%)**. Projecting his measured **30.93 fps** forward by that ratio gives
**≈21–26 fps** — derived, and labelled as derived, because not all of his frame is JS this can see.

=> **Do not publish the ×4 map to him until the patches below land.** The deploy is being held.

### The frame, measured

**JS 14.70 ms = 8.70 pre-draw + 6.00 renderer-submit · GPU 2.37 ms · 942 draws · 1,095,807 triangles.**
**The main thread is 6.2× the GPU.**

🚨 **It is NOT shaders, materials or textures — that is now settled.** Across the ×4 commit GL programs
went **26 → 25** and texture bytes **7.48 MB → 7.48 MB**, flat. What moved is **object count**: objects
1,416 → 3,126, prop drawables 486 → **1,924** (×3.96), floor instances 2,609 → **10,685** (×4.10).

🚨 **The shadow pass is 557 of 934 draws — 59.6% of the whole frame — and 495 of those are props that
never move.** `stage.ts:1735` re-hashes every visible caster each frame; the fighters move a millimetre,
the hash changes, and it re-renders **all 1,657 casters, 1,615 of them static**. ⚠️ `stage.ts:787-789`
already priced this at *"302 draws, 43.6%"* and concluded the fighters were most of it. **The fighters
are now 28 of 557.** That reasoning was correct when written and the map grew out from under it.

### The ranked fix — and why it is a PREREQUISITE, not an optimisation

| | patch | measured | look cost |
|---|---|---|---|
| 1 | **Merge the static arena props by material** — `toon.ts`'s `merge` option already exists for exactly this and says *"ONLY VALID FOR A GROUP WHOSE PARTS NEVER MOVE"*. 1,924 drawables for 111 props, none merged. | bound **−8.00 ms (54.4%), −613 draws**; expected **−4 to −6 ms** | **zero** — parts don't move relative to each other |
| 2 | **Split the shadow map static/dynamic** | **−495 draws = −52.5% of the frame**, −2.2 to −2.9 ms — *the same saving as switching shadows off*, keeping the fighters' | ⚠️ **non-zero — only a PNG caught it** |
| 3 | Distance-cull the ground scatter | **GPU −0.53 ms (−22.4%)**; CPU nothing | none |

🚨 **One visible character is 245 draw calls.** At N=2 the opponent is usually frustum-culled and draws
zero — first contact is 18.4 s. **At 4–6 fighters on screen the cast alone adds ~900–1,300 draws on top
of today's 942.** The ×4 map exists *for* 4–6 fighters. **Patch 1 is a precondition of the roster
change, not a tidy-up after it.**

Measured non-levers, so nobody spends a day on them: bloom, SMAA and the post chain are **already off**
at `low`; HUD DOM, VFX, fog, apron and concealment are **every one inside the resolution floor**.

### ⚠️ TWO EARLIER CLAIMS OF MINE ARE WITHDRAWN

- **The *"post-chain fill −14.6×"* result is NOT a saving available to ship.** `detectTier()` already
  returned `low` on a real phone — **that fix was to the measurement harness, not to the game.** It is
  the difference between two tiers, one of which a phone never received. Ablating the post chain for
  real is **−1 draw and −0.36 ms of GPU**. I reported it as the largest shippable lever found here.
  It is not a shippable lever at all.
- **The judder numbers I quoted were an instrument artefact.** *"8 of 60 repeats at 30 Hz, 19 of 59 at
  60 Hz"* came from a tool that seeks on **a fixed grid it is told**, so **a grid finer than the
  source's frame interval returns the same frame twice**. Proof: a synthesised clip containing **zero**
  repeats, sampled that way at 2× its own rate, reports **48.1% "repeats"**; at 1× it reports 0.0%.

### The real judder measurement — worse than the artefact, and better founded

Measured by walking `requestVideoFrameCallback` (one callback per **presented** frame, carrying its
`mediaTime`), so the rate is measured rather than assumed. Capture is **59.88 fps** container; window
6–24 s:

- **393 of 813 presented frames repeat (48.3%)**, robust to a 4× threshold sweep
- ⇒ **30.93 distinct frames per second**
- run lengths 138×1, 66×2, 25×3, 4×4, 1×5, 1×6, **3×7** — steady ~31 fps with excursions to 20 and
  15 fps and **real 50–117 ms stalls during motion**
- ⚠️ the two longest runs (651 ms, 735 ms) are in the first 4 s and are surrounded by **0.000% motion**
  — **a static screen, not a stall.** The old tool would have made them the headline.

### *"VFX looks clunky"* — UNRESOLVED, and the reason is worth recording

It could not be made into a frame-cost claim: the VFX layer is **0.14% of the frame's triangles** and
hiding it moved **zero** draws over 200 frames. But the ablation could not answer the question either,
because **on the ×4 map the camera follows the local seat, the enemy is ~2,500 wu away, and first
contact is 18.4 s — a probe watching an idle player never has a hit on screen.** The synthetic event
hook that would fix that has a **broken `trail` kind** (`__feelEvent` throws; the other three work),
now routed. **Reported as unresolved, not as zero.** The live candidates are a recorded look defect in
the sticky trail and the 31 fps floor itself making everything read as clunky.

### What still needs a real device — named precisely

1. **Uri's phone model and iOS version.** Still outstanding; every number above is phone-class dependent.
2. **A second 10-second capture AFTER the ×4 map deploys.** The one experiment that settles the
   projection above.
3. **WebKit's per-draw-call overhead.** The whole ranking rests on draw submission being the cost. If
   WebKit is *worse* than Chromium here — plausible, it routes WebGL through a separate GPU process —
   **the ranking gets stronger, not weaker.** A cable and macOS Safari's Develop menu closes it.
4. **Thermals over a 45 s match.** A phone that starts at 31 fps does not stay there.

---

## 57. ✅ MULTIPLAYER INFRASTRUCTURE LANDED 2026-08-11 — `915bbaf`, `2ec44da`. **One thing now needs Uri: the payout curve for 3–6 seats.**

Uri asked for *"infrastructure for multiplayer game (host games, leagues, online multiplayer game)"*.
§52 decided the shape (authoritative sim + local prediction, host peer first, movable to Node later
**without touching `src/game/`**). That constraint held: **`src/game/` is untouched by a single line**,
because three decisions made before there was any network turned out right — `stepMatch` already took
one input per slot, `fighters` was already a slot-ordered array, and `createMatch` already refused to
invent a spawn. `src/net/` is new and nothing shipped imports it, so the bundle is unchanged.

### 🚨 §52's OWN STATED FALLBACK DOES NOT WORK — and §8's reason 4 is falsified

§52 said *"`structuredClone` preserves all of it"*. **It does not: `structuredClone(state)` throws
`DataCloneError` on a real `MatchState`**, because `arena.build` is a required method. Every
`structuredClone` figure in `docs/NETCODE.md` §6 was taken against the **data-only**
`arena.gameplay.json`, not against the shipped object. **`postMessage(state)` throws for the same
reason**, which falsifies §8's *reason 4* for the design (*"the serialisation bill is deferrable,
postMessage costs zero"*).

⚠️ **This does NOT reverse §52.** The other four reasons stand, and the transform that was supposed to
be deferrable now simply exists. But the fallback everyone would have reached for is not there, and
this was believed on the strength of a measurement taken against the wrong object.

### The wire format, and the control that makes the other 66 checks worth reading

Not a field list — **one alias-aware structural walker with three consumers** (encode / decode / clone).
A field list rots silently the day `state.ts` grows a field; this carries plain data of any shape
unregistered, carries reference topology generically, and **refuses by path** anything it has no rule
for. `refTopology` prints the reference census and the gate asserts it, so a lost *or added* alias goes
red with a diff.

**The JSON known-bad, `nw_wire.mjs` B4: `JSON.stringify(original) === JSON.stringify(corrupted)` is
TRUE.** That is the whole point — **the corruption is in identity, not values, so the obvious check
passes on it.** On a live N=6 state the JSON round trip breaks all 3 aliases, flattens **39 of 39**
`-Infinity` sentinels to `null`, loses `brokenConcealment`'s arena reference identity, and — not listed
anywhere before — turns **12 real array holes** in `hazardTimers` into present `null`s.

Also caught: the aim quantisation **was not idempotent** (75 of 4,000 inputs changed on second
application). Replaced with a max-norm, a fixed point by construction.

### What the loopback proves — and one arm that would have lied

**Proves exactly:** at zero latency the client's predicted view is **bit-identical** to the host's at
every snapshot (200/200 at N=2; **798/798 across six clients at N=6**); the host's `inputLog` replays
bit-identically from a fresh `createMatch`; host and client share **zero** objects except the arena; the
authority check fires on a forged seat.

⚠️ **The arm that looks like a pass and is a tautology:** `errorWu` is **exactly 0 at any latency** with
one human and no loss — it measures the client's own self-consistency, **not agreement with the host**.
A rig running only that arm would report *"prediction is perfect at 100 ms"* and be measuring nothing.
What the real arm shows: at 3 ticks of delay the local fighter **leads by 4.01 wu** and remote fighters
**lag by 15.07 wu** — the gap an interpolation layer would hide, and there is no interpolation layer yet.

## ❓ NEEDS URI — the only new decision here: **what does a 3–6 player match pay?**

`MATCH_PAYOUT` prices **exactly two outcomes**, win and loss. There is no placement curve anywhere for
3rd through 6th, and `applyMatchResult` **throws rather than inventing one** — which is the right
behaviour and also means **a six-player match cannot currently pay out at all.**

This is a design call, not a technical one, which is why it is here rather than decided:

- **How steep?** Brawl-Stars-like games pay the top half and charge the bottom half, which makes 4th of
  6 a real loss. A flat-ish curve is friendlier and makes placement matter less.
- **Does 6th of 6 pay zero, or go negative?** §49a already decided the *ordering* (*"fewest deaths, then
  lower slot"*); this is the money on top of it.
- **Does the curve scale with N**, so 3rd of 6 and 3rd of 4 differ?

⚠️ **Anything chosen here interacts with the trophy road and the store**, both of which are tuned
against the current two-outcome payout — so the honest answer is that a curve cannot be dropped in
without re-checking `economy.test.mjs`'s progression assertions. **If Uri would rather not spend a
decision on it, the safe default is a curve that preserves today's expected value at N=2 exactly and
interpolates upward**, so nothing already tuned moves. That is reversible; a generous curve shipped and
then cut is not.

### What remains before this is multiplayer rather than infrastructure for it

1. **A real transport** — WebRTC DataChannel behind `Transport`, plus signalling. Nothing above changes.
2. **Delta compression — the top item.** Full snapshots cost **981.6 KiB/s for six clients** at 20 Hz.
   §2 measured a binary delta at ~220 B against ~8 KB: a **~37× saving that is not built.**
3. **Interpolation of remote fighters** — the 15.07 wu lag is currently drawn raw.
4. **The payout curve above.**
5. **A backend decision.** ⚠️ Nothing was provisioned, no account created, no endpoint in any committed
   file; `NetConfig` defaults to connect-to-nothing. That stays true until Uri says otherwise.
6. **Reconnection, spectator UI, matchmaking** — none exist.

---

## 58. ✅ SUDDEN DEATH LANDED `f87d407` — ❓ **and it makes §53b's ring UNREACHABLE. Two of Uri's own answers cannot both bind.**

§2 shipped exactly as asked: *"after 30 seconds reduce the fog to all screen and the one who has more
HP wins."* At the 30 s trigger the safe radius collapses to zero, everyone burns, and the last fighter
standing is whoever had more HP. **`resolveTimeout` fired 0 times in an 880-match census** — §49a's
rungs are now provably unreachable, which is what §2 said should happen, asserted rather than assumed.

### ❓ THE DECISION — one line from Uri closes it

On the 2800×2000 map `maxSafeRadius` derives to **1985 wu**, so at 30 s the ring is still **661.67 wu**.
For §53b's floor to ever be reached, the trigger would have to be **later than the ring's arrival**:

| N | §53b floor | ring reaches it at | §2 fires at | gap |
|---|---|---|---|---|
| 2–4 | 140.00 | **41.83 s** | 30 s | fires **11.83 s early** |
| 5 | 187.42 | 40.75 s | 30 s | 10.75 s early |
| 6 | 237.00 | **39.63 s** | 30 s | **9.63 s early** |

**`minSafeRadiusFor(N)` is now unreachable at every seat count.** §53b's work is not wasted — it still
shapes the ring *while it is closing* — but **the endgame spacing it was built to guarantee never
happens.** Uri answered §2 and §53b in the same message and they cannot both hold in a 45 s match:

- **(a) KEEP 30 s — recommended.** Sudden death is a real **15-second** final phase. The census says it
  works: it fires in **5.0%** of N=2 matches, **31 of 44 end on the collapse tick**, and the HP leader
  won **43 of 43** decided. §53b becomes the shape of the closing ring rather than a floor anyone
  reaches.
- **(b) MOVE THE TRIGGER to ≥ 41.83 s** (39.63 s at six seats) so the ring floor binds. ⚠️ **This all
  but deletes sudden death** — it would last **3.17 s**, which is a blip, not a phase.
- **(c) LENGTHEN THE MATCH** so both fit. The only option that keeps everything, and it changes every
  pacing number in the project.

=> **Assumption in force until Uri says otherwise: (a).** §53b governs the ring while closing; §2
supersedes it at the trigger. Nothing is pinned — the whole table above is computed at run time from
`MATCH_DURATION_MS`, `arena.maxSafeRadius`, `POT` and `REACH`, and asserted in `sim.test.mjs` §30.

### It is a STEP, not a ramp — and Uri's second clause is what decided it

Under a gradual ramp the fighter nearer the centre is engulfed last, so **position decides the match and
HP only breaks ties.** Only a step makes *"the one who has more HP wins"* a true sentence. That also
makes the resolution **absolute HP**, not `resolveTimeout`'s HP *fraction* — a deliberate rule change,
stated rather than slipped in.

### 🚨 Collapsing the ring was NOT sufficient. Three things would have shipped wrong.

1. **The fog is quantised** (15 HP per 300 ms), so any HP gap **under 15** put two fighters in the same
   bucket and the killing tick walked **slot order** — **a 100 HP fighter in slot 0 lost to a 91 HP
   fighter in slot 1.** The exact opposite of what Uri asked for. Fixed by ordering the pass ascending
   by HP, ties by descending id so the lowest slot survives, agreeing with §49a rung 4.
2. **`Fighter.fogTimer` is per-fighter**, so anyone already burning died *earlier with more HP*. The
   cadence is now derived from the match clock.
3. **Without a `phase !== 'playing'` break the pass killed the winner it had just declared** — 6 deaths
   from 6 seats, with `state.winner` naming a corpse.

### And the control had to be fixed before it was a control

With the test fighters at 300 wu, **both unreachability known-bads came back green** — the legacy ring
passes 300 wu at 31.4 s and burns them anyway, so that scenario never reached a timeout in *either* arm.
Moving them to **100 wu** — inside `MIN_SAFE_RADIUS`, where pre-§2 they sit in the permanent safe
annulus and only the clock can end the match — turned both rows red. **A known-bad placed where the bug
cannot express itself is not a known-bad.**

N=2 bit-identity before the trigger: **3,520 matches · 5,410,470 ticks · 537,095 events in order ·
0 divergent**, holding over the whole state *and* the returned `GameEvent[]` in order, and deliberately
excluding everything after the trigger — which is the behaviour Uri asked to change. **Outside the
countdown-reseed path**: the trigger keys off `state.timeRemaining`, which is `MATCH_DURATION_MS` for
the entire countdown, so no decision, rng draw or reaction offset moves.

### 🚨 A shipped defect it exposed: the fog RENDERS AS NOTHING at radius 0

`src/arena/fogRing.ts:~505` fades the whole boundary out at radius 0 — **so the fog disappears at the
exact moment it is supposed to cover the arena.** Measured: `?fogRadius=0&fogRingRaw=1` renders at mean
luma **130.6** against a no-fog frame's **132.3**, while the HUD reads *"OUTSIDE THE ZONE −50 HP/s"*.
With the fix: **72.0**, a canopy over the whole screen. **The fix is one character (`> 0` → `>= 0`)**,
routed. Before sudden death existed, radius 0 was unreachable in a real match.

⚠️ **And sudden death invalidates every QA station requesting a fog radius below 661.67 wu** — nine
tools plus `apron.ts`'s documented `?fogRadius=420`. They do not error; they **silently render the
sudden-death frame** with a console warning. Migration is one number: request **> 661.67**. Routed.

---

## 59. ✅ §57's PARKED PAYOUT QUESTION IS BUILT — `721ce3c`. ❓ **Uri's answer is now ONE NUMBER, and every option is priced.**

A six-player match can pay out. The curve is indexed on **normalised rank** `r = place/(seats−1)`, which
answers §57's third question directly: **3rd of 6 is r=0.40 → +5; 3rd of 4 is r=0.67 → −2.** A raw-place
table pays them the same and is wrong at one of the two.

| seats | trophies (above the grace band) | coins | mean/match |
|---|---|---|---|
| 2 | +15 −10 | 60 20 | 2.500 |
| 3 | +15 +3 −10 | 60 40 20 | 2.667 |
| 4 | +15 +7 −2 −10 | 60 47 33 20 | 2.500 |
| 5 | +15 +9 +3 −4 −10 | 60 50 40 30 20 | 2.600 |
| 6 | **+15 +10 +5 0 −5 −10** | 60 52 44 36 28 20 | 2.500 |

**Last place pays exactly what losing a 1v1 pays today** — it *is* r=1, so it takes the shipped loss
term verbatim: **zero inside the grace band**, so a new player still cannot go backwards at six seats.
Coins floor at `coinsLoss`, so **every finisher at every seat count is paid something.**

### ❓ THE ONE DECISION LEFT: how steep? `MATCH_PAYOUT.placementSteepness`

| k | six seats | who gains / holds / loses | trophies/match | matches to finish the road |
|---|---|---|---|---|
| 0.6 | +15 +5 +1 −3 −7 −10 | 1,2,3 / — / 4,5,6 | 0.17 | **1084** 🔴 |
| **1.0 (shipped)** | **+15 +10 +5 0 −5 −10** | **1,2,3 / 4th / 5,6** | **2.50** | **576** ✅ |
| 1.6 | +15 +13 +9 +4 −2 −10 | 1,2,3,4 / — / 5,6 | 4.83 | **404** 🔴 |

**In plain terms:** at **k=1.0** finishing 4th of 6 is a wash — you keep what you had. At **k=0.6** the
bottom half is punished and the road takes nearly twice as long. At **k=1.6** four of six seats gain and
the road finishes in two-thirds the time. **Both alternatives require retuning the trophy road; the
shipped value does not.**

⚠️ **The dial CANNOT reach the 1v1 at any value.** Endpoints are pinned *structurally* (`r<=0`→0,
`r>=1`→1, evaluated **before** the exponent), and two seats only ever produce r∈{0,1}. Asserted against
exponents 0, 0.25, 0.6, 1, 1.6, 4, 8, Infinity and NaN. **So Uri's answer is a one-value edit that needs
no re-verification of the shipped duel.** `node tools/tmp/pc_lab.mjs --compare` prints the sheet above.

### 🚨 THE FINDING THAT MATTERS MOST HERE HAS NOTHING TO DO WITH PAYOUTS

**`economy.test.mjs` covered NOTHING above two seats — and could not see this change at all.**

It called `applyMatchResult(state, boolean)` **97 times and never once with a seat count**. The words
`placement`, `seat` and `position` appeared **zero** times in the whole file. A complete placement curve
was then written, `applyMatchResult` was rewritten to delegate through it, and a persisted struct grew
two fields — and the suite reported **227 passed, 0 failed, unchanged.** It is now **271**.

Of four deliberate mutations later run against the shipped source, **three were invisible to the
pre-existing suite.** ⚠️ **Green was necessary and nowhere near sufficient**, and nothing but writing the
coverage would have revealed that.

### What was proven, and what is honestly not claimed

- **N=2 is a no-op, proven against a FROZEN ORACLE** — the pre-curve body transcribed from
  `MATCH_PAYOUT`, importing nothing from the new curve — over **8 careers × 500 = 4,000 matches** across
  win rates 0.0 to 1.0. ⚠️ Compared as a **transcript, not a final balance**: two errors that cancel
  leave identical final coins and a different transcript, and that is the known-bad it was shown to fail
  on.
- **Pacing cannot move with seat count.** Linear-on-normalised-rank has the same mean payout at every N.
  Road completion **594 matches at 2 seats → 576 at 6, Δ −18**, against a stated floor of **±102**
  (2 sd over seeds). Inside it.
- ⚠️ **NOT claimed: that the curve is *right* at six seats.** Nothing above two seats has a before-value,
  and no measurement of real 6-player placement distributions exists in this repo. What is claimed is
  that it is coherent, monotone, endpoint-exact, EV-neutral and pacing-neutral. The field model behind
  the career numbers is **a model**, labelled as one everywhere it prints.

### One honest cost, taken deliberately rather than rounded away

`winsTowardChest` is an integer that `deserialize` floors, so fractional chest credit would **discard
progress on every reload**. So chests stay integral and the cost is priced: chests/match **0.600 (2) ·
0.429 (3) · 0.618 (4) · 0.515 (5) · 0.627 (6)** — flat to ±4.5% except at three seats, **28.5% slower**,
because r=0.5 lands exactly on 2nd of 3. The comparison is **strict**, which puts that coin flip on the
conservative side; `<=` was +28.5% — the same magnitude in the direction that cannot be walked back.

### ⚠️ A number §58 may have just staled

`MATCH_PACING.sessionSeconds = 15.5` was measured **before** sudden death shipped. Sudden death ends the
~5% of matches that reach 30 s and would previously have run to 45 s, so the true mean is now **~14.8 s**.
It is never asserted, by design, so no gate is red — **but every "hours to unlock" figure derives from
it**, and if Uri picks §58 option **(c) lengthen the match**, it moves materially.

### Routed, not made (out of set)

- **`src/net/lobby.ts`** hardcodes `15` where `MATCH_PAYOUT.trophiesWin` belongs — retune the constant
  and the league silently pays the old rate.
- **`src/ui/screens/profile.ts`** needs a `recordPlacement` sibling. ⚠️ **And it contains a SECOND
  two-outcome ladder nobody had noticed: `XP_WIN`/`XP_LOSS`.** The consistent answer is the same
  normalised-rank interpolation; it is being decided deliberately rather than stubbed silently.
- `src/ui/screens/home.ts` needs **nothing**, and `trophyRoad.ts`'s screen already renders `trophies === 0`
  correctly via its `is-flat` class — so 4th of six works untouched.

---

## 60. ✅ THE GATE BATTERY IS GREEN AGAIN — 12 faults → 2. **And four fixtures were passing while testing something nobody chose.**

The seven gates the ×4 map broke are closed (`72d50a4`, `336a85b`, `f27973f`, `9c10722`), every one
proved red on a known-bad first. `gatecount` on a clean worktree: **12 faults → 2**, neither from this
work.

### 🚨 The finding that matters most: a green gate can be testing the wrong thing entirely

**Four of the eleven fixtures moved were still PASSING at their 1× coordinates — while testing something
nobody chose.** Found only by re-deriving each one from the new map, never by a red run:

- `sp_gate`'s *"seat inside the pot"* fixture was pointing at **a herb crate**
- *"24 wu from the sink counter"* was pointing at **open floor**
- the *"axis mirror"* was a mirror about **the old centre**
- `sp_place`'s freezer still reported `inside-cover` **by luck**

⚠️ **Reverting to the 1× coordinate is NOT a valid known-bad for those four** — they passed at 1× too.
Each had to be proved non-tautological by feeding it a *legal* input and requiring the row to go red.

And the automated guard for exactly this was a **partial** catch: `arena-scan`'s placement check flagged
**6 of 18** stations. **Acting on its list would have moved six and still shipped an empty quadrant**
(coverage was 18/2/2/0, SE empty).

### 🚨 TWO CLAIMS OF MINE FALSIFIED — both believed on a method rather than a measurement

- **`level_lab` was NOT at an instrument ceiling.** I reported it as *"a finding, not a fixture — the
  level-1 player wins 100.0%, so it can no longer tell level 1 from level 15."* Measured: **40 of 110
  cells are unsaturated and every one rises**, max **93.8 pp**, the full grid moving **55.00% → 99.32%**.
  **One hand-picked cell had saturated and I generalised from it to the instrument.** It now runs a
  declared 11-cell cyclic panel (47.7% → 98.9%, **+51.1 pp against 5.3 pp of standard error**) **plus a
  row asserting the baseline has headroom *before* asserting it moves** — the guard my framing skipped.
- 🚨 **`git archive HEAD` is the WRONG clean-tree method for this battery, and I recommended it twice.**
  Five of these gates shell out to `git` and die without a `.git` directory: **it reported 8 faults where
  a real worktree reports 2 — a wrong CAUSE, not merely a wrong number.** Use **`git worktree add
  --detach`** with `node_modules` **and** `reference` symlinked. (My own first attempt was worse: no
  `node_modules`, so seven gates died on a missing import and looked exactly like seven broken gates.)

### 🚨 And a third: `ic_spec`'s "drift" was real, and every check of it was made on the wrong tree

Two agents reported doc **24** vs tree **16**; a third ran it, got 24, and reported the drift claim false.
**All three were right about what they saw.** Eight of its arms read gitignored `shots/`, so it prints
**24 on a working tree and 16 on a committed one.** *"I checked and it's fine"* was a working-tree check
every time — the same class of error as this session's HEAD-vs-tree attribution mistakes, one layer down.

### 🔴 A real gameplay defect found on the way: BOTH SLOW PUDDLES ARE UNREACHABLE

`src/arena/kitchen.ts`: **0 of 7,845 cells** inside either 50 wu puddle is standable, and **1 of 15,813**
over the full 71 wu slow field. Nearest legal ground is **75 wu outside**. **Two hazards no fighter can
ever enter.** `sp_place` now *prints* this every run and deliberately does **not** assert it — a bug-pin
that goes red when the bug is fixed is a trap. Routed to the arena owner.

### ⚠️ A guard whose default stopped partitioning its corpus

🚨 **THE SENTENCE THAT STOOD HERE WAS WRONG AND IS KEPT FOR THE LESSON:** *"`50c5272` moved every weapon
to one side of the 0.75 split, so its `PIX` control has nothing left to exercise — the fix emptied the
population its own guard was written to discriminate."* **The corpus was never empty.**

Measured over all **33 shipped halo colours**: `--split 0.75` selects **0 of 33**, and **0.53 selects 23**.
The real cause is subtler and more useful: **`vfx.ts` splits on the WEAPON's colour; `hl_sweep:retarget`
splits on the HALO MATERIAL's.** Those were the same number **only while the bug existed** — the fix made
them different, and the guard's default went on pointing at the old one. **The corpus stopped being
partitioned, which is not the same thing as being empty**, and I reported the wrong mechanism because I
inferred it from a count instead of measuring the population.

Re-aimed rather than retired, and it is now **strictly more instrument**: `PIX` went from vacuous to
exercised, and a full live run then derived **0.5294 from the shipped materials on its own** — two paths,
no shared code, same answer. ⚠️ **Still INVALID on one control, `SWAP` at 12 of 22** (reproducing an
inherited 12-of-23; an earlier "6 of 6" reading of mine was a partial read). Every other control passes
22/22. **Routed, not papered over.**

### 🚨 AND THE SAME CLASS, ONE FILE OVER, WITH A GREEN COUNT THE WHOLE TIME

**`valuescan --selftest` was 105/105 green throughout — while 14 of its 18 stations were measuring the
wrong place.** The whole table was 1× coordinates on the ×4 map: **eleven stations were inside a
`CoverBox`**, and quadrant coverage was **NW 18 / NE 0 / SW 0 / SE 0.** Now 2 of 18, spread 4/2/5/7.
**`--selftest` structurally cannot see this** — it validates the tool's logic, not where the tool is
pointed. Exactly `arena-scan`'s defect in a second file, found only because someone re-derived the table
rather than trusting the green.

⚠️ And one station was **re-aimed rather than migrated, deliberately**: `fog_late` was named for a
nearly-closed ring, and **no shipped match holds one any more** since sudden death collapses it. It now
says so in place of pretending.

### Still red, all routed, none from this work

`s49_mutants` **22/24** (sudden death changed the timeout tiebreak under §49a's mutant battery) ·
`as_cost` **30/32** · `sc2_manifest` **51/54** (its *"pure HEAD has no manifest"* control predates the
manifest landing) · `valuescan.mjs:230-232` still requests a fog radius that snaps to sudden death.

### And rule 11's hazard fired again, in the other direction

**Registry edits to `gatecount.mjs` were swept into a peer's weapon-tray commit by pathspec form.**
Nothing lost and the tree builds, but that commit is mislabelled forever, and HEAD sat inconsistent
(a registered gate with no doc row) until the follow-up closed it. The agent then held `docs/TOOLS.md`
for two hours specifically to avoid doing the same to the peer. **Pathspec protects you from your own
index, never from a second agent in your file** — CLAUDE.md rule 11, demonstrated for the third time
this session.

---

## 61. ✅ DELTA COMPRESSION + THE CURVE WIRED THROUGH — `a588066`. **And wiring it up found a silent 10-trophy-per-match bug.**

### 🔴 The bug that only appeared when two correct pieces were connected

`src/net/lobby.ts` priced a whole league off **one shared curve**. But `trophyRoad.ts:placementCurve`
says outright that *"a field whose members sit at different standings needs one call per finisher"* —
and a league is exactly that field. Measured: **a 3,000-trophy loser priced on a curve built at 0
trophies is charged 0 instead of −10**, because the grace band belongs to the rookie, not the veteran.
**A 10-trophy error every match, silently.**

`applyMatchResult` now prices **every finisher at their own standing**; the curve argument survives as an
explicit override for a fixed-rate event. ⚠️ **Neither the payout pass nor the netcode pass could have
found this alone** — the curve was right, the caller was right about two seats, and the defect lived in
the join. That is the case for the six-player end-to-end acceptance run now in flight.

Also gone: **`twoSeatCurve`'s hardcoded `15`** where `MATCH_PAYOUT.trophiesWin` belonged — retune the
constant and the league would have kept paying the old rate.

### XP was a SECOND two-outcome ladder. It is now interpolated, not stubbed.

Six-seat XP: **100 / 87 / 74 / 61 / 48 / 35**, on the same normalised rank as trophies and coins, and it
*imports* the shared weight function rather than copying it — so a steepness retune (§59) moves all
three together.

⚠️ **The binary stopgap was rejected on a number, not a preference: it pays 2nd of six and 6th of six
identically** — precisely the defect normalised rank exists to remove, re-installed in a second ladder
one commit after the first was fixed, **and invisible at two seats where both agree.**

### Delta compression — **7.1× on payload, 4.3× on the wire**

10,657 → **1,501 B** at N=6; host-side broadcast 187.6 → **44.1 KiB/s** at 20 Hz. It diffs the **wire
tree, not the state**, so it inherits everything the codec already proves and cannot get aliases or
sentinels wrong. **There is no field-id table** — both ends enumerate the base they already agree on, so
a new field in `state.ts` appears by itself on both ends. Recovery under 12% loss: 362 deltas refused,
320 keyframes served, **every client recovered**.

⚠️ Note what remains: §2's ~220 B figure is a **binary encoding layer BELOW this one**, not a better
diff. This is 7.1×; that is a further step.

### 🚨 THREE known-bads passed falsely before they were fixed — each certified the check it was meant to falsify

This is the fourth independent instance tonight of the same failure, and the three mechanisms are worth
naming because they are all invisible:

- the differ blinded to `hp` **had nothing to drop** — the fighters had not met yet
- the wrong-base demonstration sat **inside the countdown**, where nothing moves
- a sentinel was written onto a field **already holding it**

**Ask of every control: could this scenario distinguish the two arms at all?**

### And one asserted claim was simply false

*"A different-shape wrong base is always caught structurally."* Measured instead: **385 threw, 13 patched
silently — 3%.** So the structural catch is a bonus and **the base tick is the guard.** Recorded because
the assertion sounded like a proof and was an assumption.

### ⚠️ A structural gap nobody had noticed: **no Node gate has ever reached the UI layer**

**`src/ui/**` cannot be imported by any Node instrument in this repo** — its imports are extension-less
and resolve only under Vite/tsc. `nw_profile.mjs` esbuilds a single bridge entry to get at `profile.ts`.
Every UI check this project owns is therefore a *browser* check; there has never been a unit-level one.
That is not a defect, but it explains a coverage shape nobody chose.

### A deviation from instruction, declared and accepted

The brief said *"add a sibling to `recordResult`, do not change it"*. The agent made `recordResult`
**delegate** instead, on the grounds that two bodies for one rule is exactly what the economy pass had
just refused. **Accepted** — and it is proven rather than argued: a **2,000-match seeded career** replayed
through a frozen transcription of the pre-change body, compared on the **whole serialised profile after
every match**, bit-identical, with a one-XP-point tamper shown to be caught.

### Still not built

A real transport and signalling · **interpolation of remote fighters** (they lag **15.07 wu** at 3 ticks
and nothing hides it) · the binary encoding under the delta · reconnection, spectator UI, matchmaking.

---

## 62. ✅ THE PHONE IS FIXED AND DEPLOYED — 928 draws → 423, and the controls are out of the play area

Both halves of §33 and §52 landed and are **live at `https://uri-onceuponyou.github.io/food-arena/`**
(`f1f2a40`; ten assets verified 200, manifest and icons included).

### The draw-call fix — `5aa4655`, measured on the same bundle `?merge=0` apart

| | unbatched | batched | Δ |
|---|---|---|---|
| draws/frame | **928** | **423** | **−505 (−54.4%)** |
| …of which shadow | 551 | 112 | **−439 (−79.7%)** |
| scene objects | 3,126 | 1,124 | −2,002 |
| shadow casters | 1,657 | 186 | −1,471 |

**Main thread −5.15 ms of 10.75 ms (−47.9%)**, against a **±0.71 ms floor measured from a null arm** —
7.3× the floor. GPU **+0.24 ms**, the price of losing frustum culling on merged meshes.
🔴 **The ×4 map now costs LESS main thread than the build Uri actually played**, rather than the +48.6%
it cost three hours earlier.

**Patch 2 came free.** An earlier pass priced removing prop shadows at −495 draws and **refused it on a
picture**. Batching returns **−439 shadow draws while casting the identical shadow from the identical
triangles.** No static/dynamic split was needed; the residual is ~84 draws ≈ 0.3 ms, inside the floor.

**Proved it cannot have changed the look:** geometry identity both arms (268,600 tris / 217,273 verts
identical), **mean per-vertex world deviation 1.74e-6 m = 0.21 float32 ulp**, and a 0.5 mm nudge — 22×
larger — *is* caught by the same check. PNGs read at both cameras, 58° and a close 22°: indistinguishable.
The 0.26%-of-pixels residual was bisected to the 0.21-ulp re-rounding deciding **surfaces that were
already z-fighting**.

⚠️ **One patch was built, measured and thrown away, which is the result.** The ground-scatter cull cost
**+22 draw calls to save 81,776 triangles** — a net loss on a CPU-bound frame at 5.9 µs/draw, and inside
the floor either way. It also falsified its own brief: **the 867,750 "scatter" triangles are the TILE
FIELD, not the chips**, and **the shadow frustum, not the camera, is what keeps 9 of 12 tiles alive.**

### The controls — `bd39464`, `b2f2cb1`, `f1f2a40`

Uri: *"the weapon choosing is on the most critical part of the screen where most gameplay happens."*

**Instrumented in WORLD UNITS, not pixels** — the score is the share of `FAIR_PLAY.radiusUnits` (199.2 wu,
the arena *every* device is guaranteed to show) that a control hides. ⚠️ **A pixel metric flatters
bottom-edge controls** — a bottom pixel of a 58° frame covers ~⅓ the ground of a top one — **and that is
where every control is.**

| | 844×390 | 667×375 | 932×430 |
|---|---|---|---|
| weapon tray before | 7.92% | 5.75% | 6.45% |
| weapon tray **after** | **0.00%** | **3.13%** | **0.00%** |
| all controls | 22.62 → **17.05%** | 22.66 → **20.86%** | 17.64 → **12.42%** |

**A disc inscribed in a rectangle never reaches its corners** — so *"corners for controls, centre clear"*
is what mathematically minimises this quantity. The instrument reached the reference layout **without
being shown a plate.** Scoped to touch **and** landscape: desktop bottom-centre unchanged at 0.00 px,
portrait untouched, and `menu_accept` 361/361 + `menu_accept_portrait` 219/219 unmoved. Slots are **58 px**,
not the 46 px "touch floor" — that number was arithmetic forced by four-in-a-row, so **the phone gets the
bigger button.**

### Menus: ONE real offender, three false alarms

Uri's *"it seems like it was designed for vertical… its the same of all game menus"* is **true of exactly
one screen.** Home, character select and shop are **already** three-column landscape at **96.7–97.2% of
width**. **Settings** was the portrait one — a 1170 px column in a 263 px window at 667×375 — and the
cause was **160 pixels**: a 400 px track minimum needs 806 and that viewport gives 646. Scroll **1170 →
931 (−20.4%)**, with 844 and 932 byte-identical.

### The zone pill was lying in BOTH directions

Now `ringFloorFor(fighters.length, timeRemaining)`. Before: during **sudden death** (floor 0) it said
*"FINAL RING"* while the fog burned at 50 HP/s; at **N=6** (floor 237) it counted down to an arrival that
never happens. Copy is now **"SUDDEN DEATH / MOST HP WINS"**. ⚠️ No leading glyph — `ft_glyphs` measured
**0 of 44 symbols actually drawn** by the loaded faces, and ☠ rendered as a padlock.

### 🔴 The next occluder is now the CLOCK, and it is bigger than the tray ever was

**The clock + zone column hides 13.12% of the guaranteed-visible arena at 844×390** — larger than the
weapon tray's 7.92% that this pass removed. Untouched, because `h49_chips` derives the chip rail from its
measured bottom. **It is now the largest single occluder in the frame.**

### Two instrument faults found and worth propagating

- **`np_nfighter`'s `CENTRE = {700,500}` is stale** — the ×4 map moved it to `{1400,1000}`. It cost a false
  failure before being derived live.
- **`da_census` is a clean NEGATIVE ONLY** — 0 property diffs, but it *structurally cannot see* either menu
  edit (one element is absent from its captures, the other only changes at a viewport it does not capture).
  **A green from an instrument that cannot see the change is not evidence.** The plates are.

---

## 63. ✅ §50a AND §50b LANDED — `af35362`, `a9da836`. **23 of 23 ranged weapons could not connect; now 2 of 23.** ❓ And the roster spread doubled, as the stated price.

### §50b — `range` was two quantities wearing one number

`stepProjectiles` now charges a tick with the ground the shot **gained on its target** rather than the
path it flew, refunded only when the target is receding. **The proof that `pickWeapon`'s gate and the
retirement are finally the same quantity is executable** (`sim.test.mjs` §31c): a Lettuce Fling pressed
at 120 wu against a *fleeing* target is charged **93.3 wu against a separation crossed of 94**, while the
path it actually flew is **365.3 wu**. The same press at a *stationary* target is charged 93.3352 and flew
93.3352 — identical to **1.3e-13**. Under the old rule those two columns were the same number *by
definition*, so that row is red on the old rule. **`pickWeapon` needed no change at all.**

The age cap is derived, not picked: `range / (speed − 120 wu/s)`, the roster's own movement cap. It
**provably never truncates a legal shot**, and exists for **exactly one case in the shipped game** — a
trail-boosted Donut at 152.28 wu/s that `SPEED.maxSlow` closes on at 7.72 wu/s. Budget alone would chase
it for **18.1 seconds**.

**Reach: 23/23 → 2/23 cannot connect at their own press gate, in both roles.** Cost: lifetime mean
280 → 285 ms, **0 wu outside the map**, concurrency unchanged (max 14/tick) — **no draw-call cost.**

### ❓ THE PRICE URI AUTHORISED HAS ARRIVED, AND IT IS BIGGER THAN THE HEADLINE

| | before | after |
|---|---|---|
| roster range | 14.2 pp | **28.1 pp** |
| settled matchups | 18/110 | **28/110** |

⚠️ **The aggregate is NOT the result and must not be quoted as one.** smart2 moved 59.3% → 67.4%
(+8.1 pp) — **inside the ~9 pp floor.** The real quantity is the paired per-matchup delta on identical
seeds, which is **exact**: **49 of 110 matchups moved, max |Δ| 81.3 pp, mean 8.6 pp.** Winners burrito
+13.3 and donut +9.7; losers pizza −8.1 and **egg −7.5** — everyone else's kit started working while
Hatch! was still inert, which is §50a's case seen from the other side.

=> **A re-balance around the new reach is its own pass, and it must be steered by the paired table.**
Steering it by the 8.1 pp aggregate would be steering inside a floor — the exact error this project has
made before. Uri authorised the price and said not to hold the roster still; **whether 28.1 pp is
acceptable is his call, and the pass is queued.**

### §50a — the chick is faster than the egg, and the interesting part is that the two drivers disagree

`Hatch!` moved from `SPEED.maxDrift` (80 wu/s — slower than **every fighter in the game**) to
`SPEED.maxSlow` (160), the *smallest* rung clearing both constraints: 1.52× Egg's delivered 105.6 wu/s
and above the 120 the age cap needs. **Reach 27 → 140 wu.** `FLIGHT_MS.drift`'s *"a chick that waddles at
you"* is reversed with its old wording kept, because the arithmetic in it is the reason nothing may
return to that rung.

Damage compensation was measured at **three** points, not two: **20.1 and 15.7 pp per point, mean 17.9** —
reproducing the pre-fix 17.8. **The lever did not get finer when the weapon started working.**

🚨 **And the finding worth more than the integer: the two drivers disagree about which damage value is the
no-op, by more than a whole point.** d4 is **+0.9 pp on smart2** (inside the floor) and **−13.9 on chase**
(outside); d5 is the mirror (+21.1 / +4.4). The mechanism is real — **a *chasing* opponent was always
reachable by an 80 wu/s chick**, so on that policy the speed fix is worth nothing and only the damage cut
lands. **No single-parameter compensation exists**: a cooldown raise would have to cost smart2 4.8× what
it costs chase. **d4 ships because it holds the character still on the stronger driver**, the chase cost
is stated rather than hidden, and no third constant was touched to paper over it.

### Two instruments broken BY the fix — and both are now asserting a defect that no longer exists

- **`ac_homing --selftest` 11/11 → 9/11.** Both failing rows assert the pre-fix behaviour (*"perpendicular
  flight loses ground on a stationary one"*: 18 vs 27, now 27 vs 27). **Correctly false.** Re-authoring,
  not deletion.
- **`hm_audit --selftest` THROWS** — and the reason is worth keeping: **it patches source by exact string
  match**, on two literals the fix rewrote. A tool that stages a mutation by literal substitution breaks
  silently the day anyone touches the line. Its purpose (pricing the retirement options) is arguably
  discharged now that the relative-frame option shipped.

⚠️ **And the pass caught its own guard going vacuous:** a fallback assertion filtered the roster for
weapons on an orphan speed rung, and **the moment the fix emptied that set, `[].every()` returned `true`
and the guard passed by having nothing to check.** Third instance tonight of that exact shape.

Two instrument off-by-ones also documented rather than worked around: `press` reads a projectile's books
*before* the tick that kills it, so a budget-killed shot always reads one step short — **the first draft
failed on all 23 and looked exactly like the finding.** And a weapon that has **landed** is removed with
reason `'expired'`, so reading `reason` alone reports Egg's Hatch! as a miss **on the tick it delivered
its full damage**.

### Countdown-reseed: measured, and it is OUTSIDE

880 matches stepped in lockstep against HEAD with one driver feeding both: **847 diverge, 0 before the
whistle, 0 before the first `projectile-spawned`.** `attemptAttack` is reachable only inside
`phase === 'playing'`.

---

## 64. 🔴 THE SIX-PLAYER ACCEPTANCE RUN — it works, and it has five defects no unit gate could see

Everything in §48–§63 was verified in isolation; **nothing had verified them together.** This is that run:
four full renderer matches to a result card with **zero page errors and zero failed requests**, plus
400 sim matches with **0 unresolved and 0 timeouts**. Measured on a detached worktree while four peers
were live.

**Verdict: a six-player match is playable end to end.** Nothing crashes, nothing hangs, the HUD is
correctly wired, and the frame survives easily. **And every one of the five defects below was invisible
to every gate this project owns** — which is the same thing that was true of both of Uri's own best bug
reports.

### 1. 🔴 EVERY MATCH PAYS AS A DUEL. The whole payout curve is unreachable.

`ui/screens/matchScreen.ts:124` is `recordResult(winner === 'player')` — **a boolean**, and a tree-wide
census found it is **the only payout call site outside the economy.**

| place of 6 (at 500 trophies) | 1st | 2nd | 3rd | 4th | 5th | 6th |
|---|---|---|---|---|---|---|
| the curve | 15/60/100 | **11/52/87** | **7/44/74** | **3/36/61** | **−1/28/48** | −5/20/35 |
| what ships | 15/60/100 | **−5/20/35** | **−5/20/35** | **−5/20/35** | **−5/20/35** | −5/20/35 |

Priced on a real 200-match place distribution: **underpays 4.16–6.92 trophies, 11.1 coins and 18.0 XP
per match.** ⚠️ **The API is fine** — `nw_profile` is 21/21 including §61's own known-bad, and **at two
seats the two paths agree exactly at every standing.** This is purely the join, **which is exactly what
§61 predicted this run would find.**

### 2. 🔴 THE SPAWN DECIDES THE MATCH — worth **2.64 places out of 6**

200 matches, roster shuffled every match so character strength averages out (fair = 3.50):

| seat | 0 | 1 | 2 | 3 | 4 | 5 |
|---|---|---|---|---|---|---|
| mean placement | 4.49 | 4.45 | **1.85** | **2.06** | 3.98 | 4.17 |
| ± SE | 0.097 | 0.094 | 0.064 | 0.077 | 0.120 | 0.091 |
| 1st places | 5 | 7 | **85** | **81** | 19 | 3 |

**Spread 2.64 places against a worst-seat SE of 0.120 — 22× the noise.** The north-lane pair took
**166 of 200 firsts and zero lasts.** It is the **spawn**, not the slot: rotating the spawn list moves the
advantage with the coordinates. Confirmed independently with six *identical* fighters.

🚨 **The mechanism is the good part: the favoured pair WINS BY NOT PARTICIPATING.** They deal **half the
damage** and walk 1,767 wu against ~1,000 — `nearestLivingOpponent` pairs the other four off at 892 wu
while they sit 1,040 wu from anyone. **So the predictor is distance to the nearest opponent, not distance
to centre**, and "equalise the radii" is a hypothesis rather than the fix.

### 3. The result card cannot tell you where you finished

`hud.ts:1260` builds the loser list **in slot order**, so a six-player match always reads
`EGG defeated HAMBURGER DONUT TACO SUSHI PIZZA` — **identical whether you came 2nd or 6th.** No trophies,
coins or XP on it. And `onPhase(phase, winner)` carries **a role, not a rank**, so the place does not
exist at the HUD boundary at all.

### 4. 🔴 Every off-screen opponent gets an HP pill pinned to the frame edge

`updateFloatingBars` **clamps into the viewport instead of hiding**. **63.7–82.9% of opponent pills drawn
at six seats belong to a fighter outside the viewport**; mean distance to a living opponent is **1,534 wu**
against a `FAIR_PLAY` radius of 199.2. ⚠️ **The clamp is correct for its authored case** (*"a fighter above
the top of the frame"*). At six seats it becomes **a permanent free read on every opponent's HP and
bearing** — quietly undoing the fog of war and the concealment feature.

### 5. 🔴 The fog canopy misses the corners — **`FIELD_OUTER_UNITS = 1500` is the 1× number**

`fogRing.ts:207` justifies it with *"the arena's half-diagonal is ~860"*. **860.2 is the OLD map.** The
×4 map's is **1720.5** and the furthest standable cell is **1691.2**. ⚠️ **`779dc62`'s commit message
repeats the false claim**, so the log is wrong too.

**7,413 of 228,319 standable cells (3.25%) sit outside the canopy** — 3.25% of the map, **100% lethal
there.** The PNG is `f87d407`'s defect signature back again: HUD reading *"OUTSIDE THE ZONE −50 HP/s"*,
radar saying *"GET INSIDE"*, fighter standing on **bright fully-lit floor.**

### ✅ What is genuinely closed — including both of Uri's own reports

- **Concealment: 20 of 20 plates 100% standable, `isConcealed` true at every centroid.** *"I can't hide
  under concealments"* is closed on the ×4 map.
- **Unreachable regions: none.** 0 sealed, 0 phantom, 0 face gaps at every body width; one nav component.
- **Sudden death decides correctly:** reaches the trigger in **65.5%** of six-seat matches, `resolveTimeout`
  **0/200**, HP leader wins **108/108** on fog alone. The unreachability assertion has a known-bad
  (`--arm immortal`) that **turns it red 8/8**.
- **Spawns:** 892.0 wu minimum separation, every seat moved in 200/200, all six dealt damage in 79%.

### ✅ Perf at six seats — cheaper than projected

| | mobile `low` | desktop |
|---|---|---|
| N=2, shipped spawns | **423** | 483 |
| N=6, shipped spawns | **445 (+22)** | 531 |
| N=6, all six in a 190 wu ring | 1175 | 1051 |

§56 projected the cast would add **+900–1,300 draws**; on the merged-props build the worst case is **+752**
— and **the worst case never occurred: across four six-seat matches the camera never held more than 3 of 6.**
**The real six-player frame costs +22 draws over the duel.** The static-prop merge bought more than enough.

### ⚠️ AND THE REASON DEFECT 1 IS NOT COSTING URI ANYTHING TODAY

**Six-player is reachable only through the QA `?fighters=` parameter.** `matchScreen` always builds two
seats — **nothing a player can press produces a third fighter.** That is what keeps the payout defect
theoretical, and it is also **the one thing that must change before six seats ship.**

### Two vacuous checks, declared by the run's own author

`sx_pay` §D **printed `ok` next to an evidence line describing the failure** — it counted the *declaration*
`recordPlacement(place, seats)` as a call site. And a polarity control fired **once in 200 matches**,
because both reducers prefer the lower id on a tie, so at `hpSpread === 0` *"the winner had the least HP"*
is true exactly when *"the most"* is. **Neither was caught by a check.** That is now **seven** instances
tonight of a control that could not distinguish its own two arms.

---

## 65. ✅ THE GATE BATTERY IS AT **ZERO FAULTS** — 69 verified, 57 skipped. And two gaps `gatecount` structurally could not see.

Measured at `09c84d4` on a `git worktree --detach` tree. Baseline was 2; three more appeared from peers'
commits mid-run and all are closed. Four new netcode gates registered with every count personally
re-run — `nw_wire` **67**, `nw_stack` **77**, `nw_delta` **28**, `nw_profile` **21** — plus `s49_mutants`
**29**, `as_cost` **34**, `sc2_manifest` **55**, `ac_homing` **12**, `np_nfighter` **64**, `tf_reach` **9**,
`tf_bitid` **2**, `sim.test.mjs` **476**, `gatecount --selftest` **42**.

### 🚨 Two gaps the guard-checker could not detect about itself

- **`hc_occluders` was registered OFFLINE and launches Chromium** — so **`gatecount` has been booting a
  GPU probe on every run.** It failed only *under contention*: `GATE-FAIL` inside a battery, **exit 0 on
  three consecutive standalone runs of the same worktree.** A flake that is deterministic when you check
  it alone is the hardest kind to believe.
- **`tf_reach` and `tf_bitid` were committed with no table row at all.** ⚠️ **`gatecount` faults on a row
  without an entry, and never on a file without a row** — so an unregistered gate is invisible to the
  thing whose job is registration. Both now registered.

### The re-fixtures, each with the known-bad it was shown to fail on

- **`s49_mutants`** — sudden death makes every timeout tick a **fog** tick, taking 15 HP *absolute* off
  both fighters, so ties built from unequal pools (50/100 vs 45/90) stop being ties: 0.3500 vs 0.3333.
  ⚠️ **Only one of the three broken rows went red** — a rung-2 row kept passing **with the right answer
  decided by the wrong rung**, so "revert and watch it fail" was never available for it.
- **`as_cost`** — A1 was a **bug-pin** asserting that `scaleArena` *drops* concealment; `72d50a4` fixed
  the bug, so the pin inverted. Old wording kept; known-bad is the historical drop.
- **`sc2_manifest`** — the *"no manifest"* control now **ablates the shipped build** (three removals, each
  required to bite) with a paired positive control on the same dist at the same base, instead of relying
  on a pre-manifest HEAD that no longer exists.
- **`ac_homing`** — the literal `160` was a weapon's **old speed**; derived, it reads 0/27.
- **`np_nfighter`** — the pre-change file was run as a control: **62 passed, 0 failed with its measuring
  ring 1,077 wu off centre.** Centre is now read live and `resolveCenter` **throws rather than defaulting**.

### `hm_audit` — RETIRED, with the reason recorded

Its purpose (pricing the retirement options) is discharged now that the relative-frame rule shipped, and
it was structurally fragile besides: **it staged mutations by substituting on literal source strings**,
both of which `af35362` rewrote. A tool that patches source by exact text match breaks silently the day
anyone touches the line.

### Two small items routed

- **`hl_sweep`'s `SWAP` control, 12 of 22** — the only thing keeping it invalid. Needs a browser owner.
- **`nw_wire.mjs` contains two literal NUL bytes** (written raw rather than escaped). Legitimate test
  data — but `file` reports the source as **binary** and **`grep` silently skips it**, so that file is
  invisible to every text search in the repo. One-character fix, zero behaviour change.

### ⚠️ A correction to §62

I reported `docs/TOOLS.md`'s `h49_chips` row as saying `+156 --touch` against a measured 551. **There is
no `+156` anywhere in the file** — the row already reads **293** (551 with `--touch`), landed in
`bd39464`. I passed on a stale reading without checking it.

---

## 66. ✅ THE PAYOUT JOIN IS FIXED — `bb00d66`. **And my own brief's premise was wrong; the agent probed instead of believing me.**

`matchScreen.ts:124` now banks `recordPlacement(outcome.localPlace, outcome.seats)`. The card reads
**"DEFEAT! / 3RD OF 6"** in podium gold, and the gate is **proven red on the old HEAD** (3 passed /
3 failed) and **21/0** after. A driven six-seat match finishing 3rd was paid as a 1v1 loss — **9 trophies,
24 coins and 39 XP short.**

### 🚨 I briefed it wrong, and the probe is the reason it works

I wrote: *"the rank has to come out of the sim's final state."* **It cannot.** Measured on real matches
through real `stepMatch`:

| seats | matches | ended by knockout | alive at end | distinct `(hp, deaths)` among LOSERS |
|---|---|---|---|---|
| 2 / 3 / 4 | 60 each | all | 1 | **1.000 (max 1)** |
| 6 | 40 | all | 1 | **1.000 (max 1)** |

**Every loser ends `alive:false, hp:0, deaths:1` — identically** — because `applyDamage` clamps at zero
and nothing respawns, and there is never a second survivor because `lastFighterStanding` ends the match
on the (N−1)th knockout. **A final-state resolver ranks losers by nothing and degenerates to slot
order — the very bug it was meant to fix.** The order exists only in the `death` **event stream**.
Reversed elimination order agrees with slot order in **53.3% (N=3), 26.7% (N=4), 0.0% (N=6)** — so at six
seats the two are unrelated.

⚠️ **My second claim was also wrong:** I said sudden death would *"end the match with several fighters
alive at different HP."* It does not — the fog pass breaks on `phase !== 'playing'`, so **exactly one
survives, every time.**

### ⚠️ Still open on the card

- **The loser LIST is still slot-ordered** — `SUSHI defeated HAMBURGER DONUT TACO PIZZA EGG`. Trivially
  fixable now that the rank exists; routed with an exact patch.
- **No trophies, coins or XP on the card.** A player paid +9/44/74 for 3rd of 6 **is told none of it.**

### ❓ NEEDS URI — the six-player entry point is a design question, not plumbing

**The session plumbing already exists** (`newMatch()` takes a list); the wiring is ~15 lines. What is
missing is all yours:

1. **Where does the affordance live?** There is no mode selector anywhere in the game.
2. **How are the other five chosen?** `characterSelect.ts:432` uses `pickOpponent()` — a **one**-opponent
   random picker — and matchmaking does not exist.
3. **What level are five bots?** `enemyLevelFor` mirrors a single opponent.

⚠️ **Until this is answered, six-player is reachable only through the QA `?fighters=` URL** — which is
also the only reason the payout defect never cost you anything.

### 🚨 A near-miss worth recording: an agent's `Write` destroyed 1,294 lines of a committed tool

It chose the prefix `pj_` for a new instrument; `tools/tmp/pj_probe.mjs` already existed. Recovered whole
from git, nothing lost. **`tools/tmp` is a flat namespace shared by every agent and `??` in `git status`
is the only signal.** The rule now: **`git ls-files tools/tmp | grep <prefix>` before claiming one.**

---

## 67. ✅ EVERY SURVIVING 1× LITERAL, SWEPT — 12 fixed, 63 frozen, **0.5% false-positive rate**

Tonight found eleven stale map literals **one at a time, each by accident**. This pass went looking.

| | |
|---|---|
| raw grep for the 13 suspect numbers | **2,534 hits / 639 files** — useless, most `1000`/`500` are milliseconds |
| extracted by **syntactic role** | 821 candidates → **94** flagged in code → ~50 adjudicated |
| **real** | **12 fixed + 63 enumerated and frozen** |
| **false positives** | **exactly one** (~0.5%) |

### 🚨 The one-sentence explanation of why every one of these stayed GREEN

> **The 1× playfield is exactly the NW quadrant of the ×4 one, so every stale coordinate stayed legal.**

No legality check could ever have found this class. That is why `valuescan` read 105/105 with 14 of 18
stations wrong, and why four `sp_gate`/`sp_place` fixtures passed while pointing at a herb crate.

**The worst one found:** `match-play.mjs` — the project's only *"play the whole thing on screen"* tool —
sent hands to a point **1,077 wu inside the NW quadrant**, reported every radius **2.23× low** and every
timestamp **4× high**, and had **11 of 16 shot marks unreachable** on a 45 s clock. **`h49_chips` spawned
2 of 6 seats outside the ring, taking 50 HP/s.** And `arena-scan`'s hazard stations were stale to a
commit **eleven hours old**.

**The guard is the deliverable:** `al_guard.mjs`, 19/19 on the tree and 24/24 selftest, **proved red by a
real tree revert**. ⚠️ **Its own selftest caught three defects in itself** — including one that silently
killed coverage on 8 files, **found only because the flagged count FELL.**

⚠️ **Would another arena resize be safe? "Safer, not safe" — the honest answer.** What is genuinely
derived survives. What would still break: the 63 frozen probe URLs (enumerated, so you get the list
immediately), and **~30 files now holding a hardcoded 2800/1985 — today's correct literals are the next
generation's stale ones.**

---

## 68. ✅ THE ROSTER IS BACK UNDER CONTROL — range **27.8 → 9.8 pp**, and no mechanic was touched

`33318a1`. `sim.ts`/`combat.ts`/`ai.ts`/`movement.ts` are **byte-identical** — §63's retirement fix is
intact. **Five weapon constants**, plus one *derived* card bar.

| | smart2 | chase |
|---|---|---|
| **roster range** | **27.8 → 9.8 pp** | 68.4 → 63.4 pp |
| settled | 29 → **23** /110 | 43 → 46 /110 |
| tier spread | 16.2 → **6.1 pp** | 50.4 → 46.8 pp |
| aggregate *(inside the ~9 pp floor — context, not a result)* | 65.9 → 67.5% | 41.7 → 40.7% |
| **paired, EXACT** | **40/110 moved, max 68.8, mean 6.7** | 27/110 moved, max 75.0, mean 4.6 |

**Range is now below even the pre-fix 14.2 pp. Settled is not** (23 against 18) — **and that was reported
rather than smoothed over**: a flat roster and a roster with few decided matchups are different
properties.

### The policy split reproduced on a second character — and the lever that broke it

§50a found the two drivers disagreeing about Egg. **Every Burrito knob costs `chase` 1.3–2.4× what it
costs `smart2`**, and solving for (smart2 −13, chase 0) needs a knob scaled **3.7×** — which does not
exist. **`Roll` Stun is the only non-degenerate lever**: its smart2 response **saturates** (4→5 +10.6,
4→6 +10.6, 4→7 +11.9) while chase keeps climbing (+5.6, +14.4, +20.0). **`smart2` was optimised and the
price is stated: Burrito 49.4% → 34.5% on `chase`.** No third constant was reached for.

### ⚠️ And the countdown-reseed tool's one-line verdict is a FALSE POSITIVE here

It says *"INSIDE"*. The arithmetic says otherwise: **432 of 880 diverged — exactly `880 − 8·7·8`, the
matches involving one of the three changed characters**, and every match between the other eight is
bit-identical. The 160 "before the first shot" are **exactly `880 − 10·9·8`, the Lollipop matches**, whose
changed weapon is **melee** and spawns no projectile. The tool's second clause was written for a
projectile-rule change. **The verdict line is wrong; the numbers underneath it are right.**

### Mechanic-not-constant findings, routed

- **`scripted_player.mjs:preferredRange` sets the movement band from the highest AUTHORED damage** — its
  own comment flags this as an unmeasured rung. **It is why no `rules.ts` constant can ever square the
  two policies.**
- **`pressValue`'s table is a `WeakMap` built once at module load** — mutating a weapon's damage at run
  time changes nothing the AI ranks on. **A test staged that way passes vacuously.**
- **Lollipop's slam now sits exactly on the undodgeable ceiling.** If that ceiling ever drops, Giant must
  drop with it.
- **Refused:** a change measuring **1.4 pp better** was declined because it would orphan a VFX form.

---

## 69. ✅ SEAT UNFAIRNESS CLOSED — **2.680 → 0.342 places** — and the quantity that had to be equal was nobody's first guess

`2d3e9bd` (⚠️ **this section first cited `d1d9f9e`, which is an unrelated tmpdir cleanup — my error, caught by the agent I gave it to; the fog commit below was swapped with it in the same way**). §64 measured the spawn set as worth **2.64 places out of 6**. It is now **0.342**, and no
individual seat is distinguishable from fair.

| seat | 0 | 1 | 2 | 3 | 4 | 5 |
|---|---|---|---|---|---|---|
| mean placement | 3.70 | 3.64 | 3.43 | 3.48 | 3.35 | 3.41 |
| ± SE | 0.078 | 0.074 | 0.073 | 0.075 | 0.059 | 0.057 |

⚠️ **N=2 is bit-identical over 200 matches** — pair A was pinned, so `playerSpawn`/`enemySpawn` and every
1v1 number in the project are untouched. **All six seats now deal damage in 600/600 matches** (was 74.5%;
53 of 1,200 seat-matches dealt none — now **0 of 3,600**).

### 🚨 The answer: the IN-DEGREE OF THE SPAWN-TIME TARGETING DIGRAPH

Not radius. Not spacing. **How many opponents pick you as their nearest at t=0.** `stepAI` and
`attemptAttack` both steer by `nearestLivingOpponent`, so the six seats form a digraph with one out-edge
each, and in-degree orders the measured table exactly on **three independent seatings** (in-degree 0 →
~1.9 places, 1 → ~4.0, 2 → ~4.5).

**Both obvious alternatives were FALSIFIED BY CONSTRUCTION rather than argued away:**

- **Equal radius** is refuted by the baseline's own table — it predicts 2,3 then 0,1 then 4,5; measured is
  2,3 then **4,5** then 0,1. **The middle radius is the worst seat.**
- **Equal nearest-opponent distance was BUILT** — a legal seating with all six distances **exactly equal
  at 814.0 wu**, and better centrality spreads than the shipped map — and it measured **3.05 places,
  WORSE than the map it replaced**, with the two unpursued seats winning. **That control is the reason
  this is not an elaborate way of equalising the wrong quantity.**

### And the layout's shape is FORCED, not chosen — with a cost that has to be stated

Nearest-neighbour digraphs have no cycle longer than 2, so in-degree 1 everywhere ⇒ a perfect matching
into mutual pairs. The map's C2 symmetry means σ must fix at least one pair; a σ-fixed pair is diametric;
and a diametric pair is only its own minimum if everything else is further out ⇒ **it is necessarily the
innermost pair.**

=> **Equal centrality and a fair targeting graph are mutually exclusive on a C2 map.** The three pairs
cannot share a radius. That is a **stated cost**, not an oversight.

### 🚨 The resolution floor already misled its own author — and the fix was to build the right floor

**A standard error is not the spread's scale**: the spread is the **range of six correlated means**. The
floor was built by **label permutation** — 4,000 reps preserving the place distribution and the sum-to-21
constraint — giving a 95th percentile of **0.315 places**. Old: 2.680 = **8.5× the floor**, worst seat
**43.8σ**. New: 0.342 = **1.09×**, worst seat **2.54σ against a null 95th of 2.66.**

⚠️ **At 200 matches two candidate layouts read 0.40 and 0.70. At 600 they read 0.39 and 0.34 — the
ranking REVERSED.** Shipping on the 200-match run would have taken the worse layout **and** a seat with a
**2 wu legal halo** against 20–30 wu for every shipped one.

### ⚠️ Declared side effect

**Sudden death now fires in 90.5% of matches, up from 66.0%**, and matches run 32.55 → 33.96 s. Six
fighters who all actually engage take longer to resolve. This makes §58's parked question — *"is 30 s the
right trigger?"* — **materially more important than it was**: sudden death is now the normal ending, not
the exception.

### 🔴 And a live time bomb, guarded rather than left

**`tools/tmp/x4_layout.mjs:SPAWN_NORTH` — the GENERATOR `kitchen.ts` points at — still holds the OLD
coordinates.** Anyone regenerating from it **silently reverts this entire fix**, and the revert would look
like a routine regeneration. `kx_seatfair --selftest` §A3 now asserts the divergence is exactly the
declared one and **goes red if either side moves.** Being fixed properly.

## ✅ And the fog canopy is derived — `06da604`

`FIELD_OUTER_UNITS = ARENA_HALF_DIAGONAL + APRON_OUT` = **2480.47 wu**, from two constants that already
move with the map, bounded exactly against the furthest standable cell (1691.2) plus the camera's
worst-case ground reach (470) = 2161.2, with **319 wu spare**.

Paired A/B on two worktrees differing only by this diff: **only the position that was outside moved** —
corner luma **64.917 → 27.927**, centre and mid unchanged to **±0.03**. PNGs read: the before-corner is
`f87d407`'s signature (bright pink floor, canopy a hard diagonal edge away to the right); the after is
uniformly canopied.

⚠️ **Its known-bad ladder is the point, and worth copying**: `1500` turns three sections red; **`1721`
passes two of them** and is caught only by the last two; `9999` passes three and fails the fourth; and an
empty standable set **fails section 0 rather than printing "0 of 0" green.**

---

## 70. ✅ THE RESULT CARD IS FINISHED — `7743f08`, `e60117d`. **And the patch I routed would have deleted fighters.**

The six-player card now reads **"DEFEAT! / 5TH OF 6 / EGG defeated HAMBURGER TACO PIZZA SUSHI DONUT /
Match time 0:32 / 🏆+3 🪙+28 ⭐+48 xp"** — real placement, real elimination order, real payout. Slot order
would have printed `SUSHI HAMBURGER DONUT TACO PIZZA`: **genuinely different**, and the local seat sits
4th in the list, agreeing with *"5th of 6"*.

### 🚨 The agent refused the patch I gave it, and computed the counterfactual instead of arguing

I routed `.map(s => roster[s]).filter(Boolean)` as an exact patch. **It silently DROPS fighters** when the
order is short, duplicated or out of range — and §C measures it rather than asserting it: **on a 3-entry
order it lists 3 of 5 losers.** A fighter vanishing off the result screen, **invisible at two seats**,
where every order has exactly one loser. Shipped code validates the order is a **permutation** and
otherwise falls back wholesale to the old expression, kept verbatim above it.

**Two-seat byte-identity is proved, not asserted:** 24 end states rendered through the real `hud.ts`
against an oracle recorded on a detached worktree of the pre-change commit — **24/24 identical**, with the
new hidden payout element asserted as a **subtraction** so that anything *else* moving goes red.

⚠️ **And §A declares itself TAUTOLOGICAL in its own header** — removing the winner from a two-element
permutation leaves one fighter in every possible order. **That is why two seats are safe, and why §A
compares against an oracle that can move rather than against itself.** Naming your own tautology is the
opposite of the vacuous controls this session produced (**the count is in `docs/LESSONS.md` §17 and
nowhere else — four files gave it four different values**).

### The payout cannot double-bank, proven three ways

`match.ts`/`hud.ts` import nothing from `game/economy/` (`--arm fakeimport` red) · a real six-fighter
match banks **+3/+28/+48** against a card reading **+3/+28/+48** · and the totals are **frozen across 20
rendered frames** — a render-side bank would have multiplied them 20× (`--arm poison` red).

⚠️ **§E first reported a coin delta of 528 against a card saying 28** — which looks exactly like a
double-bank and was a **missing baseline**: `profile.ts` only writes on change, so 500 starting coins were
being measured against zero.

### 🚨 Three prose defects the repo-wide sweep MISSED — because they are arithmetic, not coordinates

- **`hud.ts`'s imminent-warning worked example computes `199.2 / (993/45000) = 9.0 s`. The real answer on
  the shipped clock is 4.5 s — the alarm documents TWICE the lead it gives.**
- *"265 wu of a 993 wu opening ring"* is **13.4%**, not the stated 26.7%.
- A *"890 → 993"* progression that stopped at the second of three values.

**A census keyed to positions cannot see a wrong division.** Both `src/audio/` comments also predate
sudden death — the ring never reaches `minSafeRadiusFor(N)` now, so that cue fires at the 30 s collapse.

### And a defect only a 4× zoom could find

At normal size the trophy chip was **a gold sliver with a dash under it**: its handles and stem are ink
strokes, near-black by default, **on a near-black plate**. ⚠️ **It measured square at 18×18, so no layout
row could ever have seen it.** Fixed at 22 px with a light ink token; all three chips now read at a glance.

### 🔴 KNOWN, NOT FIXED — the six-fighter card does not fit a phone

At **430×932** the card is **705 px wide with its left edge at −138 px**: the winner's portrait and name
are **entirely off-screen** and the last loser's portrait is clipped. **Pre-existing** — the subtitle was
always a non-wrapping flex row — and **unreachable in shipped play**, because six seats only exist behind
`?fighters=`.

**Deliberately stopped rather than forced:** the fix needs a per-fighter wrapper span so `flex-wrap`
cannot separate a name from its portrait, and that **moves the two-seat card's DOM** — the one thing this
pass was required to keep byte-identical. ⚠️ **This becomes urgent the moment §66's six-player entry point
is answered, and not before.**

### One out-of-set edit, declared and isolated

`src/ui/screens/matchScreen.ts` (+31/−2) — unavoidable, because the payout exists only as the return value
of banking, which happens there. Clean in `git status` before and after, and **committed separately as
`e60117d` so it can be reverted alone**, leaving `7743f08` building with the socket unfilled.

---

## 71. ✅ PER-ICON SCORING IS RETIRED — it cannot be made to reproduce, and the reason is ARITHMETIC. ❓ **Three icons need a one-line answer from Uri.**

`706c35c`. **9 independent panels × 3 judges × 63 icons = 1,701 judgements**, art byte-identical across
plates, only the shuffle differing.

| | |
|---|---|
| two panels reproduce an exact 0..3 score | **65.2%** |
| **the arithmetic ceiling** at each icon's own p | **65.8%** |
| ICC | 0.4936 — 3 judges on one plate are worth **1.51** independent |
| panels for ±1 judge of 3 / ±0.5 / ±0.25 | **6 / 23 / 92** (18 / 69 / 276 judges) |
| at 27 judges | **26 of 63 resolve. 33 stay UNRESOLVED.** |

🚨 **The measured value sits ON the ceiling, so better judges buy nothing.** A 3-judge panel has four
possible values and a sampling SD of 0.87, so **two *perfect* panels agree on the exact score only 31.3%
of the time.** This is not a judge-quality problem and no affordable panel count fixes it.

**Two facts sharpen it past the model:**

- ⚠️ **The within-round floor is 33%.** 36 of 108 twin readings gave **byte-identical art two different
  names** — one judge, one plate, one pass. `gift` scored **27/27 at one grid position and 18/27 at
  another, same pixels.** **A paired Δ of 1 of 3 is noise** — which is exactly where six of this
  project's Δ +0 icon results were measured.
- 🔴 **Eight unanimous panels were reversed by the tenth.** `heal` scored 0/3 eight consecutive times
  (Wilson [0.01, 0.32], printed BROKEN), then 2/3, then **3/3**. Tile order and label proximity were both
  tested and **the cause was not found.**

✅ **And a control the judging pipeline never had:** three tiles drew another icon's pixels under their
own key name — the pool **named the SOURCE 6 of 9 and the KEY NAME 0 of 9.** The judges read pixels.

### One standing belief falsified

`ui.ts` concluded boxBurger's failure was *"a legibility floor at 11.83 px."* Across all 63 icons,
**legibility does not depend on delivered size — Pearson r = −0.076, and the sub-12 px band is the MOST
legible (0.828).** Corrected in place, old wording kept.

### What reproduces at 10 panels / 30 judges

- **`wrap`: 0 of 30, every panel, 100% reproducing** — the only per-icon failure verdict in the set that
  never wavered
- **`chest ↔ boxBurger`**: 23 of 60 readings of the pair cross. **Neither is exempt.**
- `wave → slow` 17/30 (one-way) · `mustardblast → patty` 14/30 — **the collision r13 hoped was a bad
  round is real** · `heal → gem` 22/30 but bimodal, **do not act**
- **`shards` was called "a double-headed arrow" 0 of 30 while `range` scored 30/30** — §46's withdrawal
  confirmed at 30 judges

**No glyph was changed, and that is the finding rather than an omission.**

## ❓ THE THREE THAT NEED URI — and one fact makes "leave it" legitimate for all three

🚨 **Every one of these icons ships immediately beside its own label** — `${icon('stun')} Stun`,
`${containerIcon(kind)} ${def.name}`, and the ability pill's own name. **None is ever asked to carry
meaning alone.** That moves all three from bug to polish: a wrong read fights the label, but nothing is
unusable. **"Leave it" is a real answer.**

### `boxBurger` — the tier-1 purchasable container (8/30, → `chest` ×7; `chest` names it back 16/30)

It is a **box**, and the set draws three other boxes plus `chest` — the shared silhouette is deliberate,
the collision is not, and `chest` is the **free** rung against boxBurger's 900 coins. **Six drawing
variables already spent, all Δ +0.**

1. **Drop the food emblem; make the rung a countable mark** (1–4 pips on the lid) — `tierPips()` already
   ships as *text* beside it, so the icon would agree with the label instead of competing.
2. **Make tier 1 not a box** — a folded-top paper bag or takeaway carton. No other glyph has that
   silhouette and it is on-theme.
3. **Four rungs, four different objects.** Costs the family read, buys four readable rungs.

### `stun` — the stun status effect (11/30, → `star` ×8, `sparkle` ×6)

**Three glyphs in one star family with three meanings.** And `stun` is the **most unstable glyph in the
set**: its two byte-identical tiles got different names in **17 of 27** readings.

1. **Stay in the family but change the silhouette class** — a halo/arc of small stars, a ring rather than
   a mass.
2. **Retire `sparkle` instead** (its "rewards to claim" job can be a dot badge) and let `stun` own the
   four-point mark, which is the more universal stun symbol. **Structural — fixes the family, not one
   member.**
3. **Leave it.** The pill already reads "Stun" beside it.

⚠️ **Avoid spiral eyes** — `slow` is a snail-shell spiral on the same pill row. ⚠️ And `icon_score.mjs`'s
candidate string *describes the current drawing*, so **any redraw leaving the star family must land its
new string in the same commit** or it will be scored wrong for succeeding.

### `wrap` — Burrito's "Burrito Disc" (**0 of 30, ten panels, 100% reproducing**)

The strongest evidence in the set, and **all three geometric axes are closed by measurement**: 45° is a
blade *either way* (mirroring moved the answer from `damage` to `slash`, 3/3 unanimous); upright is a
vessel (the 1.7-unit outline renders a gold tin can); horizontal is `mustardblast` and `patty`. Colour is
a proven null. **A rolled burrito is a fat rounded bar, and every orientation of a fat rounded bar is
already owned.**

1. **Draw it END-ON — a tortilla spiral disc.** The weapon is literally called Burrito **Disc**, and a
   spiral disc is the one silhouette class no blade has. ⚠️ Risk: `slow` is a spiral and `patty` is a
   brown disc.
2. **Depict the throw, not the object** — the bar plus a circular motion arc. The ring is what breaks the
   blade read, and it keeps the subject.
3. **Change the weapon's object entirely.** Biggest blast radius — but **§30 is the precedent: the mustard
   bottle became a hot dog and gained +2.**

---

## 72. ✅ ANSWERED — the match is 2:30, the fog HOLDS then CLOSES, and sudden death stops eating the schedule

**Answered by Uri on 2026-08-12, from playing it.** This entry supersedes **§58** and **REVERSES
§1** (*"Assumed: `MATCH_DURATION_MS` = 45 s… ❓ 45 s, or shorter?"* — the answer turned out to be
**much longer**, and the question as posed could not have found that, because it only offered
*shorter*).

### 🔴 What he saw, and why no gate here could have

> *"It seems like something in the fog doesn't make sense. It starts decreasing my HP before it
> reaches me… it does seem like sudden death, it's also written and the entire screen becomes
> purple. **It happens before the fog reaches the center.**"*

**This repo had already written the mechanism down and never connected it to play.**
`rules.ts:1132`, of `minSafeRadiusFor(N)`: *"at the shipped constants this function's result is
never reached — `SUDDEN_DEATH_MS` collapses the ring 9.6–11.8 s before the schedule would arrive
there."* `docs/STATE.md` correction 10 restates it and adds that the scaled-ring row and the
sudden-death question *"cannot both be live"*.

Both files describe it as **dead code with an academic caveat**. It is not: the ring is scheduled
to reach the centre at `MATCH_DURATION_MS` (45 s) and sudden death fires at 30 s, so **the last
third of the fog schedule never runs** and the phase that replaces it starts while the fog is still
a third of the map away. A player experiences that as *the screen turning purple and burning them
while the fog is visibly elsewhere*. **`minSafeRadiusFor(N)` — 140 / 187.42 / 237.00, derived
longhand, proven a no-op at N≤4 over 45,959,702 ticks — has never once been reached in a shipped
match.** So has the whole endgame-ring pass.

🚨 **The lesson is not that the fog was wrong. It is that "unreachable" was recorded as a curiosity
in two documents and by a third instrument, and nobody asked what the player sees instead.**
`docs/LESSONS.md`'s standing claim that playing it beats every instrument here is now **five for
five**, and this is the first one that was *already written down before he found it*.

### The schedule he specified

```
0:00 ────────────────────────────── 2:00 ──── 2:15 ─ 2:30
     ring shrinking (centre reached)  small   SUDDEN
                                      circle  DEATH
```

| | value | what it means |
|---|---|---|
| `FOG_HOLD_MS` | **~25 s** | the ring HOLDS at its opening radius. New concept — today the fog first bites the corners at `FOG_FIRST_CONTACT_S` = 6 s. His reason: a grace period to find a weapon and an opponent **on a 2800×2000 map where spawns are 916 wu apart** |
| `FOG_CLOSE_MS` | **120 s** | the ring reaches `minSafeRadiusFor(N)` — *"the fog should reach the center"* |
| `SUDDEN_DEATH_MS` | **135 s** | *"only after 15 seconds the sudden death should start"* |
| `MATCH_DURATION_MS` | **150 s** | clock ceiling. Was **45 s** |

⚠️ **The structural half is that the ring schedule is currently WELDED TO THE CLOCK** —
`matchProgress = elapsed / MATCH_DURATION_MS`. The ring must now finish at 120 s while the clock
runs to 150 s, so the two have to be decoupled. `SUDDEN_DEATH_REMAINING_MS` stays exactly 15 000
by coincidence, **which is a trap rather than a convenience**: today the two coincide by accident
and the next person to move the clock would silently move sudden death with it.

### What this costs, stated in advance rather than discovered later

🚨 **EVERY BALANCE NUMBER IN THIS PROJECT WAS MEASURED AT A 45 s CLOCK.** Roster range
27.8 → 9.8 pp, tier spread 16.2 → 6.1, the ranged-reach pass, pacing, fog share of all damage
(8.2%, *the number the 45 s clock was itself chosen on* — §1). None of it is safe to assume at
150 s. A re-measure is dispatched with this change, reporting **aggregate and paired separately**
against their stated floors (aggregate win rate ~9 pp; a paired per-matchup delta on identical
seeds is EXACT).

**Two consequences are for Uri, not for us, and neither is a bug:**

1. **Out-of-combat regen now runs over 150 s instead of 45 s** — 3.3× the healing window. If two
   fighters can out-regen each other, the fog becomes the thing that decides matches rather than
   the thing that ends stalemates. Being measured; if it happens, it is a **design** call.
2. 💰 **The economy's earn RATE falls ~3.3×.** Payouts are per match and a match now takes 3.3× the
   wall-clock, so trophies/coins/XP **per minute** drop by that factor unless a payout moves.
   Nothing is broken — the curve is per-finish and correct — but *"how long to the next chest"*
   just tripled. **The number will be quantified and handed over; the decision is yours.**

⚠️ And a third, which is a *benefit*: `minSafeRadiusFor(N)` and the whole scaled-ring pass become
**live for the first time**, which closes `STATE.md` correction 10's *"§4 item 2 and this row
cannot both be live"* in the direction that keeps both.

---

## 73. ❓ THE ARENA'S WARM PROBLEM IS FIXED — and the fix landed in the ONE PLACE the contract reserves for the cast

`arena-scan` was re-baselined at `072f245` (`43932ce`). The old baseline was pinned to `36ee0a6`,
**61 commits before the ×4 map**, so for a day it compared the 2800×2000 arena against a 1400×1000
one. On the real map:

| rail | 36ee0a6 (1× map) | 072f245 (×4 map) | |
|---|---|---|---|
| **warm chroma** | 0.0596 **FAIL** | **0.0823 PASS** | the one rail that was out of contract |
| arena-only warm | 0.0580 **WARN** | **0.0828 PASS** | |
| cool chroma | 0.4077 (19% over target) | 0.3856 (12% over) | moved *toward* target |
| warm share | 0.1258 | 0.1735 | was 0.006 above its floor; now 0.054 |

**All 11 rails now pass — the first time `--gate` has fired on nothing.** Floor first: four
independent sweeps of the same commit spread **0.0002** on warm chroma, so +0.0227 is **114× the
noise**. This is real.

**⚠️ But the warm went into the ENVIRONMENT, and the contract reserves warm for the CAST.**

| | 36ee0a6 | 072f245 |
|---|---|---|
| loudest non-player cells wearing the cast's own hue | **30%** | **65%** |
| env chroma sitting in the cast's hue band | 0.1198 | 0.1700 |
| cast↔env hue separation | 133.5° | **97.1°** |

65% reproduced on three separate sweeps, so it is not noise. In the frames it is the large **yellow
counter tops at hue ~50°** — the burger's own dominant hue bin. `995ea7d` deliberately bought this
number *down* (37% → 24%) by moving the gold trim, plank pads, floor grime and pot stack out of that
band, and gained 10 places of player salience doing it. **The ×4 map has spent much of that back.**
Every rail still PASSES, so **nothing gates it** and no future run will mention it.

### The call, and it is a real trade because the two goods are the SAME PIXELS

The warm that fixed the rail *is* the warm sitting in the hero's hue band. You cannot simply have
both. Three options, cheapest first:

1. **Leave it.** Every rail passes and the arena reads bright and warm. Cost: the hero competes with
   his own background — the exact defect `995ea7d` was written to remove.
2. **Shift the counter tops off 0–60°** (toward the cream/steel end, or cooler). Recovers the
   separation; likely pushes warm chroma back down toward the 0.0725 floor it just cleared.
3. **Re-spend the warm on things the contract *does* reserve it for** — hazards, pickups, the danger
   ring — and vacate the large flat surfaces. Most work, and the only option that plausibly keeps
   both numbers.

**A note that may change how you weigh this:** the 0.145 warm target the rail chases is a **mean
pulled up by a single plate**. Per-plate warm chroma runs 0.017 · 0.022 · 0.065 · 0.079 · 0.079 ·
0.095 · 0.115 · 0.135 · 0.171 · 0.213 · **0.603**. The **median is 0.0950**, and our 0.0823 is
**87% of it** with 5 of the 11 plates now *below* us. By the median we are essentially there, which
makes option 2 or 3 cheaper than the 0.145 figure suggests — **and raises a second, smaller
question: should the warm band be rebuilt on the median rather than the mean?** That is a one-line
change to `RAILS` in `tools/arena-scan.mjs`, and it would move the floor from 0.0725 to ~0.0475.

*No agent should act on this without your read — options 2 and 3 both spend the rail that just came
into contract for the first time.*

---

## 74. ✅ ANSWERED — §33 the phone, and §66 the six-player lobby

**Both answered by Uri on 2026-08-12.**

### §33 — the device, and the first real number this project has ever had for it

**iPhone 15 Pro · iOS 26.5.2.** Two Safari captures supplied, in
`reference/video/` (**gitignored — never commit, never `git add -f`**), one from
**2026-08-11** and one from **2026-08-12** *after* the phone pass and the fog schedule.
Same device, same recorder, same 384×848 portrait pipeline — so they are **paired**.

Measured with `tools/tmp/vid_frames.mjs` (frame timing straight out of the MP4 `stts`
table; no ffmpeg on this machine, no pixel decoding):

| | 2026-08-11 | 2026-08-12 |
|---|---|---|
| delivered | 48.86 fps | **53.04 fps** |
| p99 frame interval | 50.00 ms | **33.33 ms** |
| **max frame interval** | **618.33 ms** | **33.33 ms** |
| severe stalls (>3.5× median) | 5 (0.43%) | **0** |
| time lost to stalls | 18.57% | **11.65%** |

🚨 **The headline is the MAX, not the mean.** A **618 ms** frame is over half a second of
frozen screen. In the new capture **max == p99 == 33.33 ms**: not one frame in 1,002
exceeded two display intervals. That is a *ceiling*, which is a far stronger statement
than an average, and it is what "smooth" means to a player.

⚠️ **THE INSTRUMENT IS ONE-SIDED BY CONSTRUCTION AND MUST BE QUOTED THAT WAY.** It reads
the **capture pipeline**, not the render loop. A long interval proves *something* stalled.
A short one does **not** prove the app rendered every frame — iOS records the display, so
an app running at 30 fps under a 60 Hz recorder writes duplicate frames this never sees.
**It can prove jank; it cannot prove smoothness.**

⚠️ And this **does not validate the −47.9% main-thread figure**, which remains desktop
Chromium under SwiftShader (`§62`, against a ±0.71 ms floor). Different quantity, different
engine, different machine. What it does establish is that **the device-side experience
improved on the axis a player actually feels**, and it is the first WebKit-on-hardware
evidence in the project.

⚠️ **Both captures are PORTRAIT (384×848).** Every landscape number — the weapon tray at
7.92% → 0.00% of guaranteed-visible arena, the clock at 13.12% → 0.49% — describes a mode
neither capture is in. `docs/PHONE.md` §6 asked for landscape and got portrait, which is a
finding about the ask, not about Uri: **portrait is evidently how he actually plays.**

### §66 — the six-player lobby. **The default is withdrawn; build the affordance.**

The row above said *"stays behind `?fighters=` and no player can reach it"*. Uri's answer:

  > *"We need the lobby where the gameplay is set, to be able to choose how many players,
  > and assign bots to the one who plays locally. Also wire it up to multiplayer — real
  > users can join the game as well (from UI perspective); the actual connection to
  > multiplayer will be done later."*

Four things, and the fourth is the one with a trap in it:

1. **A lobby screen** — a real place where a match is configured, not a tile that starts one.
2. **Choose the player count** — 2–6, the range `MAX_FIGHTERS`, the payout curve and
   `minSafeRadiusFor(N)` already span.
3. **Bots fill the remaining seats** for the local player. `economy/levels.ts:enemyLevelFor`
   is *"the single place Uri's answer lives"* on bot level and must stay so.
4. 🚨 **The multiplayer join UI ships, the transport does not.** `src/net/` is built and
   inert — wire codec, delta compression 7.1×, loopback host/client, 77+28+67 assertions —
   with **no server and no session**. So the lobby must present seats that a human *could*
   occupy without implying one *can* today. **A join affordance that silently does nothing
   is the "shows a number the model does not compute" class**, which this repo has now paid
   for four separate times (the stat card, the rarity ramp, the shop's *"Epic or better"*,
   and 20 of 34 weapon descriptions). **Say what state each seat is in, honestly.**

---

## 75. ✅ ANSWERED — the status LOCK, and movement speed. Both from playing, both measured.

**Uri, 2026-08-12, after playing the new schedule:**

  > *"All characters are moving too fast, and the cooldown of the weapons is too short, so if
  > you slow down or stun someone, you essentially lock him to place since you can continue to
  > fire at him and redo the cast."*

### The measurement — he is right, and it is worse than "too short"

A shrug-off guard **does** exist (`combat.ts:statusReadyAt`, `STUN_GRACE_MS`/`SLOW_GRACE_MS` = 500).
It is far too short against the effect it guards. Locked share = `duration / (ceil((duration +
grace) / cooldown) * cooldown)`:

| weapon | cd | effect | **locked** |
|---|---|---|---|
| **Noodle** | 1000 | slow | **83.3%** |
| Tomato | 800 | slow | 78.1% |
| **Cheese** | 1300 | stun | **76.9%** |
| Roll | 1400 | stun | 71.4% |
| Glass / Lettuce | 1100 | stun | 60.6% |

**Stun is movement locked to 0**, so Cheese holds a target at zero movement for **77% of a fight**.

🚨 **THREE FINDINGS THAT MAKE "JUST LENGTHEN THE COOLDOWNS" THE WRONG FIX:**

1. **The duty cycle is a SAWTOOTH in cooldown, so a LONGER cooldown can be WORSE.** Cheese at
   **1300 ms locks 76.9%** while Glass at **1100 ms locks 60.6%** — 2×1300 lands just past the
   2500 ms guard, while 3×1100 overshoots it by 800. **Tuning cooldowns could silently worsen the
   exact thing being reported**, and nothing in the repo would have shown it.
2. **`statusReadyAt` is PER-EFFECT** — slow immunity and stun immunity are independent timers, so
   a character carrying one of each runs **both locks at once** and neither grace protects against
   the other.
3. **`Noodle`'s 1000 ms cooldown divides the 3000 ms cycle EXACTLY**, so it re-applies on the
   frame the guard opens, indefinitely. That is not a tuning miss; it is a resonance.

### The two answers

**(a) DIMINISHING RETURNS**, not a longer grace and not shorter effects. Each re-application
within a window is weaker than the last — **100% / 50% / 25% / immune**, the genre standard.
Chosen because it is **the only option that cannot be defeated by a cooldown that happens to
divide the cycle** — the other two leave the resonance in place and only lower its ceiling.
Being chain-targeted still hurts, but it always ends, and the counterplay is legible.

**(b) `PLAYER_SPEED` 120 → 90 wu/s (−25%).** At 120 a fighter **closes maximum weapon range
(140 wu) in 1.17 s** and mid range in 0.83 s, so ranged weapons barely get to be ranged; you cross
your own 42 wu body in 0.35 s, which is the twitchiness he is describing. At 90: max range 1.56 s,
mid 1.11 s, map crossing 23 s → 31 s — **which the 150 s clock (§72) now easily affords, and did
not before.**

### ⚠️ What implementing this must not get wrong

* **It needs per-fighter, per-effect application state**, so it lands in `state.ts:Fighter` beside
  `status`, **never on the shared `Weapon` records** — `CHARACTERS` is a module-level `Record` and
  `ai.ts:PRESS_VALUE` keys on Weapon **object identity**, so weapon objects are process-wide
  singletons. `Fighter.lastUsed[]` and `Fighter.cast` are the precedents.
* It must be **a real own enumerable property initialised in `createFighter()`**, not `undefined`
  and not a getter — `conceal_lab --bitid` walks state with `Object.keys`/spread and an accessor
  is silently dropped from the differ.
* **This is a nerf to every status weapon**, and the roster range is **9.8 pp**. Measure aggregate
  and paired **separately** (aggregate floor ~9 pp; a paired per-matchup delta on identical seeds
  is EXACT — once an aggregate moved 0.8 pp while **58 of 110 matchups moved, max 34.4 pp**).
* ⚠️ **`AI_SLOW_MULTIPLIER` (0.35) is harsher than `SLOW_MOVE_MULTIPLIER` (0.45)** — a slowed bot
  is slowed *more* than a slowed player. Diminishing returns must apply to both or the asymmetry
  compounds.
* The player must be able to **see** the rule: `statusReadyAt`'s own header says it is exported so
  the HUD can render the shrug-off window, because *"a player who cannot see the rule cannot learn
  it."* Diminishing returns needs the same treatment — otherwise it is invisible and reads as
  inconsistency.
