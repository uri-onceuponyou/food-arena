# HANDOVER — read this, then `docs/STATE.md`

Written at the close of a 109-commit session, HEAD `85f1847`. Deployed and live at
`https://uri-onceuponyou.github.io/food-arena/`.

> ⚠️ **This file is a SNAPSHOT and it starts rotting the moment it is written.** Three separate
> claims in `CLAUDE.md` were falsified this session, each of which had looked verified for weeks —
> one because it *cited the very document that had reversed it*. **Treat every number below as a
> hypothesis, re-derive it, and report what does not check out.** That instruction is not politeness:
> agents caught the orchestrator on a stale σ digit, a dirty-file count, six tool prefixes that did
> not exist, a two-line hunk that was four, a chroma direction that had been retired months earlier,
> and a line citation that drifted twice in one day.

---

## THE FIRST SCREEN — where this stands

```
gatecount            88 verified · 64 SKIP (browser/non-numeric) · 0 faults
wm_gate --ratchet    clean · 13 faults / 7 blurbs   (was 23 / 13)
q1 critic round      58 of 58 — COMPLETE
sim.test             745
```

**The game is playable, six-player, on a phone, and every mandatory gate is green.** The blind
critic round is finished. What is *not* settled is what the round measured — see the confound below,
because it changes how you should read every quality number in this repo.

---

## 🚨 THE THREE THINGS A NEW SESSION MUST KNOW BEFORE ACTING

### 1. The critic instrument drifted by the size of the effect it measures

Four drift arms re-scored **byte-identical 2026-08-05 pixels** and all four came back **0.5–1.0
points lower**. Three of four clear the 0.566 floor; all four point the same way.

**That is the same magnitude as the arena gap the whole round exists to measure.** So any
before/after comparison quoted across 2026-08-05 → now is confounded, including several the previous
orchestrator quoted to Uri.

⚠️ **Candidate, not settled.** At `q1_sigma`'s *measured* σ today (0.649, df 39) rather than the
published 0.50, the floor is 0.734 and only one arm survives; at the interval's upper end, none do.
**Do not "correct" any historical score for it.** Do re-run the drift arms before trusting a
cross-session comparison.

### 2. The arena gap has four tested explanations and all four are null

| hypothesis | verdict |
|---|---|
| we scored an unlucky frame | **null** — paired mean Δ **0.000** against a 0.693 floor |
| the arena is too empty | **null** — **+0.00** across 13.0% → 24.9% footprint |
| the ground needs surface treatment | **refuted, and it points the other way** — our ground carries **2.69× the high-frequency detail of every reference plate** |
| our subject is framed too small | **falsified** — reference 8.4–14.2% of frame height, ours 8.8–10.8%, *inside* their range |

**Every one closed by measurement, no scoring round spent.** Do not restart any of them without new
evidence. `LESSONS §6b` is the standing warning and this round produced a sharper one: **`ctl_high` —
a shipped third-party frame placed in the OURS slot — drew the same complaints as our work and still
scored 8.** A defect being named repeatedly does not show it costs the points.

### 3. Six-seat invisibility is this project's dominant defect class

Defects that **cannot express themselves at two seats** and passed every two-seat test for weeks:
the result card, corpse input, shake proximity, seat order, melee resolving against one target,
projectiles resolving against one target. Three of five *wrong camera policies* were also invisible
at N=2.

**Build and test at N=6. A control written at N=2 for any of these passes vacuously.**

---

## WHAT SHIPPED THIS SESSION (a player feels all of these)

| | | |
|---|---|---|
| whole game **25% slower**, ratios preserved | `fd83a5c` | evade window **210 → 280 ms** |
| **spectator camera** — follows your killer, then theirs | `30e3360` `18ba2a4` `605f374` | camera travel after death **0.00 → 87.64 wu** |
| **body-block a shot** | `5c11427` | projectiles resolved only against their original target |
| **melee ultimates hit everyone in the arc** | `3483d23` | a 360° slam hit **one** fighter |
| **Giant radius 400 → 157.22**, derived from the camera | `afad1ca` | it could hit from **2× beyond what your screen shows** |
| terrain slow + trail boost reach bots | `b2be2f7` `f1e6c03` | player 1.35× / bot 1.00× before |
| **displacement weapons** — knockback, lure, self-launch | `a975567` `7582619` | absent on 29 of 33 weapons |
| impact anchor + two redrawn sculpts | `a42224c` `b3e3482` `f11b6c6` | worst impact **128 → 682 px** |
| soup gold end-to-end · hamburger brows/flag · HUD level | `c9a2ed0` `062513c` `b6e53c1` | |

---

## RANKED NEXT WORK

### 🔴 Blocked on Uri — do not guess these

1. **A Giant wind-up is now affordable and makes the whole disc dodgeable** — escapable band
   **−24.94 wu** at the derived 2300 ms (32.9% of cooldown; it was 5400 ms / 77% at radius 400).
   §80 met by one decision.
2. **28 total wipes in 360 six-player matches, where there were 0.** Everyone dying is a reachable
   ending now. A design question, not a bug.
3. **§75 cost +14 settled matchups on both AI policies** — the roster got *more* polarised.
4. **§26 rarity** buys nothing and costs 4.5× to level. He said "later".
5. **§29a bush placement** — concealment is built and inert; he has the screenshot.

### 🎯 The one measured lead

**One hue owns 88% of the cast frame** — 94.34% of chromatic pixels inside a single 35° band,
concentration R > 0.995. **Absent on the arena** (58.47%, three distinct colour masses), so this is a
**character/effects** problem, not an arena one.

Three critics named it and **all three prescribed *value* separation, which already separates by
51–72 luma.** The collapsed axis is hue, and no critic has ever named it in a prescription.

⚠️ Measured on a frozen 2026-08-05 capture. **Re-derive on today's tree first** — if it no longer
reproduces, that is worth more than the fix. And the direction is constrained: **never fix anything
by desaturating** (falsified four times), and there is **no standing chroma direction in any
document** — run `arena-scan --baseline` and read it.

### 🧱 Buildable now, nothing blocking

* **HP/damage rescale — and it is NOT ×20, and it is NOT "buildable now".** Uri asked for it
  explicitly (*"damage in the 100s, HP in the 1000s… make it interesting, look at reference"*).
  🚨 **THIS LINE SAID "Specced, zero implemented" AND BOTH HALVES WERE MISLEADING.** Kept visible
  per house style.
  * **There is no spec in `docs/`.** The word *"rescale"* appears in exactly one place across every
    document — this line. The spec is **10 committed tools, 3,412 lines**, under `tools/tmp/sd*`
    (`sda_scale` the planter with three sabotage known-bads, `sda_bitid` the quotient comparator,
    `sdc_lattice` the design lattice, `sda_accept` the presentation acceptance test, `sdb_res`,
    `sda_res`, `sda_why`, `sdb_acc`, `sd_lab`, `sd_feelevent`). They were swept in by a bulk
    tool-commit at a session close and **referenced by zero documents since** — the exact
    `AGENT-BRIEF.md` failure mode `CLAUDE.md`'s reading table warns about, at 3,412 lines.
  * **The spec's answer is k ∈ [25, 42], not ×20.** `sdc_lattice` §3 solves Uri's own two
    constraints: *"damage ≥ 100"* needs **k ≥ 25** per press, *"HP ≤ 4 digits"* needs **k ≤ 42**.
    ⚠️ And **per-PELLET display is infeasible at every k** — a multi-pellet weapon cannot show
    three-figure numbers per pellet and keep HP under four digits.
  * **"Bit-identical" is only true at LEVEL 1.** Measured at six seats: k=25 at L1 is **0/11 on
    survivor set, death order and tick count** once the arena hazard is scaled with everything
    else — but at L15 it is **11/11 winners, 2/11 survivor sets, 4/11 death orders**. The residual
    is not rounding (`--round-policy preserve` measures identically); it is **IEEE-754
    non-associativity**, `(d*k)*m` vs `k*(d*m)`, differing in **44 of 225 cells, worst 1.137e-13**,
    which a chaotic sim amplifies into a different death order. **The honest invariant is "exact at
    L1, bounded by 1.1e-13 above it".**
  * 🚨 **AND IT IS BLOCKED BY OWNERSHIP, NOT BY DESIGN.** `sda_accept`'s live regex census finds
    **20 presentation sites in 14 files** whose response curves are damage-denominated. Its
    known-bad arm — coefficients left untouched — goes **20/20 pinned at the 100% ceiling**: every
    hit becomes max shake, max hit-stop, max knockback, max particles, max damage-number tier, max
    audio weight. **Landing `rules.ts` alone ships exactly that.** 6 of the 20 sites are unowned
    (`hud.ts` ×2, `match.ts` ×3, `sounds.ts` ×1); **14 are in `vfx.ts` and `vfx/weapons/*`**.
    → **Needs ONE owner holding `rules.ts` + `vfx.ts` + `vfx/weapons/**` + `match.ts` + `hud.ts` +
    `sounds.ts` at once.** The transform is mechanical (divide each curve's damage coefficient by an
    exported `HP_SCALE`); `sda_accept` and `hp_bitid6 --scale-arena` prove both halves.
  * ⚠️ Two traps found while establishing the control, both live: **`tools/arena.gameplay.json`
    hardcodes the central hazard's `damage: 8`** while the shipped game derives it from `POT.damage`
    (`kitchen.ts`), so a `rules.ts`-only rescale leaves every offline instrument running the pot at
    1/k strength — stale-but-legal, invisible to every legality check **and invisible at two seats**,
    because nobody stands in the middle of a 2800×2000 map when there are two of them. And
    **`tune()` bands do not survive a rescale**: `register()` validates *overrides* against
    `min`/`max` but never the authored default, so a rescaled constant ships fine and then the admin
    panel refuses every legitimate override.
* **13 weapon faults across 7 cards** — `vision-block`, `summon-entity`, `merge-entities`,
  `ground-effect-damage`, `projectile-grows`, `status-strength`, 2 ranged `multi-target`.
  `waterbottle.Mega` carries four.
  ⚠️ **`status-strength` needs an owner holding BOTH `sim.ts` and `ai.ts`** — the two slow
  multipliers differ *by design*, so doing half of it slows the human and not the bot.
* **Five ultimates are still not on the cast/telegraph system.**
* **The blind has an operator-side hole**: confirming a cell is unscored means opening the raw
  ledger, **which holds its twin's slot and both scores in plain text**. Drift arms are 8 seats over
  6 sheets *by design*, so twins are normal. `q1_verify` protects the sheet; nothing protects the
  ledger.

---

## TRAPS THAT COST TIME THIS SESSION

* **`node --check` is NOT the workflow parser.** It passed a script the parser rejected.
* **`git commit -- <path>` FAILS on an untracked file.** `git add` the exact path first — never the
  directory, or you sweep a peer's work in.
* **A `gatecount` fault list is a property of WHEN and WHERE you ran it, in both directions.** Two
  agents got different sets minutes apart because peers moved. Run it on a clean worktree of your
  own commit to see your real state.
* **Verify a `tools/tmp` prefix with `git ls-files tools/tmp` AND `ls`.** The previous orchestrator
  named **six** that did not exist.
* **Report the count you MEASURED, never the one in your brief** — and verify any count before it
  enters a commit message. `--amend` is banned; the log is a primary source.
* **Ignore rules go stale by SHAPE, not by age.** Three times this session: a file, then a directory
  when panels went parallel, then every agent scratch directory when six agents ran at once. Each
  rule was right when written.

---

## HOW THE CRITIC ROUND IS RUN NOW

Panels used to run one at a time because `q1_scores.jsonl` and `q1_public.jsonl` are
read-modify-write files and concurrent appends clobber silently. **The working pattern is: score in
parallel, record serially** — `N` agents each write only their own file under `tools/tmp/q1_par/`,
then one merge agent validates, records in run order, exports and commits once.

The merge agent **must derive the pending set** (ids in the scratch dir, minus ids already in the
ledger, intersected with the manifest run order). That directory is gitignored and accumulates
across waves — it has held 17 and 27 files while a wave was 5 or 6. **A directory listing is not a
wave.**

⚠️ **The highest-value thing a panel agent does is measure the critic's sentence against the
pixels.** Seven agents added more that way than by recording a score, and the recurring pattern is
that the critic names the right symptom and the wrong mechanism.
