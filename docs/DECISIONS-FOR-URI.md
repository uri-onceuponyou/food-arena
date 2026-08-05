# Parked for Uri

Decisions that need human judgement. **Nothing here is blocking** — work continued past every
item using the stated assumption. Each entry says what was assumed, what it would cost to
change, and where the change would land.

Answer any subset. Unanswered items stay on the stated assumption.

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

### ✅ ANSWERED — recommendation: keep 45 s. If you want to move it, 40 s is nearly free. **Do not go below 40 s.**

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
match *ends*; `FOG_FIRST_CONTACT_S` and the linear close decide when the ring *bites*. Making it
bite at 20–25 s is a **schedule** change in `arena/shared.ts`, and it lets 45 s keep its proper role
as a backstop. Shortening the clock instead costs three things:

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
