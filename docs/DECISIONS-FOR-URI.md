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
| **12** | Game got harder, 62.1% → 51.3% | the harder version | **keep** — the points came from deleting a bug | `ENEMY_MAX_HP` 130 restores it |
| **1** | Match length | 45 s | **keep** — 35–45 s are all safe now | one constant |
| **10** | Two icons unreadable at 20px | as drawn | **change the subject**, not the drawing | a design call |
| **11** | Longer legs — every silhouette changed | longer | **keep** — legs now exist at all | 2 constants + 1 row/archetype |
| **5** | Floor hue as the blocking cue | restored | **keep** — two sources agreed it was a defect | six constants |
| **7** | Audio: the mix's top is flat | as-is | **drop the flow stings 4–5 dB** | levels only |
| **4** | `ROSTER_GATED` | off | **yours** — shop is built and honest either way | one flag |
| **2** | Timeout tiebreak | HP fraction → zone → you | **keep** (it now actually fires) | a few lines |
| **3** | Trail damage cap | 1 per tick | **keep** | one constant |
| **13** | Rarity runs backwards; the stat card is fiction | as built | **decide if rarity means power** — half the grid is settled at select | a real build, not a tune |
| **14** | Portrait phones: 65% black bars | letterboxed to 4:3 | **prompt to rotate** — or rethink the fairness model | one prompt, or a model rework |
| **8** | Pointer lock | shipped as built | **cannot be tested here at all** — needs your browser | — |
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

### Evidence gathered since — not a verdict, but the room question now has a number

The reverb return is doing measurable work **and is filling the tremolo's troughs**: at `wet: 0.22`
a 24 Hz warble was completely undetectable against an unmodulated control, and only became
measurable at `wet: 0.06`. `weapons/pizza.ts` had already hit this and rations its send inversely
with spin rate. So if the room reads as *"a small box"* rather than *"a kitchen"*, there is a
concrete lead: the current impulse (~190 ms) is **short enough to smear fast detail while too short
to read as a large space** — the worst of both. Not changed; it is a taste call about the whole
game's acoustic space. The Hamburger / 767 Hz question is untouched — nothing measured bears on it.

### ❓ A NEW audio question, with numbers, and there is no free fix

**The soft clip is flattening the top of the mix.** Eleven of 22 sounds sit above the knee *on
their own*, and every centre-panned match-flow sting does:

| sound | authored | delivered | soft clip takes |
|---|---|---|---|
| `castGiantSlam` (the ultimate) | 3.006 | 0.7439 FS | **−8.0 dB** |
| `death` | 1.532 | 0.7225 FS | −2.4 dB |
| `ringFloor` | 1.470 | 0.7168 FS | −2.1 dB |
| `matchEnd.win` | 1.290 | 0.6905 FS | −1.3 dB |
| `matchStart` | 1.017 | 0.6080 FS | −0.3 dB |

**Authored 13.0 dB apart; delivered 5.0 dB apart.** The ultimate's authored level is 8 dB
fictional — cutting it by 7 dB would change what you hear by ~0.5 dB. Nothing clips (the chain
*structurally cannot* reach 0 dBFS), order is preserved, and the ultimate is still the loudest
sound and still 3.6 dB above an ordinary impact — all asserted.

**The choice, and there is no third option:** keep today's loudness and accept a compressed top,
**or** drop the flow stings 4–5 dB so the ultimate is genuinely the biggest sound in the game.
Raising the master trim to compensate would break the no-clipping guarantee. **Recommendation:
drop the stings** — an ultimate that does not feel like an ultimate is the more expensive loss.
Not done, because how loud the game should be is taste.

---

## 8. Pointer lock — cannot be tested here at all

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
