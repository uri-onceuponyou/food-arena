# Three-session plan (~15 h) — priorities and budget

Written 2026-08-04. Companion to `LAUNCH_PLAN.md`; that file holds the resume state, this
one holds the ordering and the pacing.

---

## Budget — REVISED 2026-08-04 after Uri moved 5x → 20x

**Tokens are no longer the binding constraint. CONTENTION is.** That is the whole change.

| fact | source |
|---|---|
| A loop/build agent costs **~300k typical, ~470k worst** | floor 309k, camera 201k, lighting 350k, menus 472k, economy 473k |
| At 5x, **2 concurrent ≈ 20 %/h** — a 5 h session was ~full | measured |
| At 20x, the equivalent burn rate is **~8 concurrent** | arithmetic |
| **But 6 concurrent already caused real damage** | corrupted screenshots, HMR reloads wiping probes mid-run, one agent's save 500ing the dev server for everyone, and a `git stash` that briefly reverted two agents' work |

**None of those get better with more budget.** So the cap moves to **6, not 8**, and the
limiter is now the shared dev server and file ownership.

### Two classes of agent, capped differently
- **Browser-heavy** (screenshots, critic loops, probes): **cap 6.** For anything with
  sustained capture, start a private Vite (`npx vite --port 518x`) and pass `--url` to the
  tools, rather than sharing :5173.
- **Pure logic** (sim/economy/tests/docs, no rendering): effectively **uncapped** — these
  never touch the contended resource.

### Mitigations that make 6 safe (all already exist)
1. `tools/tmp/menu_accept.mjs` now **parses all 88 modules in ~95 ms**, catching the
   broken-save class that 500s the shared server. Run it early and often.
2. HMR stubbing in any probe that holds page state — a peer's save otherwise reloads the
   page mid-run. `tools/tmp/rake.mjs` shows the pattern.
3. **Never `git stash`** — blast radius is the whole repo.
4. Strict single-owner file sets. This is the hardest constraint and always has been.

### What the extra budget actually buys
Not more parallelism — **more thoroughness per unit of work**, and things previously
ruled out on cost:
- All 11 character head loops, rather than the 3 worst
- Skins, including the per-character material-variant system that does not exist
- More probe-first passes, which have consistently outperformed loops
- Deeper verification: every plateau probed so far was a bug, so verification is the
  highest-yield spend on this project
- Re-running the whole-arena scanner after every element change instead of once

## Priority rationale — where the value has actually come from

Of every plateau probed on this project, **every single one turned out to be a bug or an
ownership deadlock, not a taste gap.** The fog killed you invisibly. SSAO contributed
exactly 0.0000/255 for the whole project. The colour grade was destroying a fifth of every
frame. 63 % of prop grounding was buried. Meanwhile the floor loop spent 309k and moved
its score zero.

**So: unassessed areas outrank known-weak areas, and probes outrank loops.**

That single principle produces the ordering below.

---

## SESSION 1 — close the unassessed gaps

The theme is *things nobody has ever looked at*, which is where every large finding has
come from.

| # | Work | Why now | Size |
|---|---|---|---|
| 1 | **Icons** *(running)* | 6 critics called it the #1 defect; quantified at ~1 point | 1 |
| 2 | **Apron critic** *(running)* | built twice, never once judged | 1 |
| 3 | **SFX depth + the 8 missing voices** *(running)* | Uri played it: "shallow and similar" | 1.5 |
| 4 | **MOTION — filmstrip + animation pass** | **The largest unassessed thing in the project.** Every character critique has judged STILLS, yet "reads like a turntable render" is a complaint about motion. Characters have been parked at 4/10 partly on this. | 1.5 |
| 5 | **Whole-arena scanner** | The real scoreboard. Element scores read higher than the whole because a critic judging one barrel is not weighing composition. **Optimising the easier metric is the standing risk of this entire working model** and this is the only thing that catches it. | 1 |
| 6 | **Full-match feel pass** | Nobody has played a match end-to-end and judged pacing, readability under pressure, or whether the retuned ranges feel right. Cheap, and it is how Uri found two real bugs. | 1 |

**Checkpoint:** commit, push, `tsc` + sim + economy + menu_accept + aspect all green.

---

## SCREENS — status, and Uri's unfreeze (2026-08-04)

> *"They can be unfrozen to improve quality."*

The prototypes are now **reference, not specification**, for the menu screens: deviate from
their layout and information architecture wherever it demonstrably raises quality. Same
authorisation `rules.ts` already has. Preserve intent, not arrangement.

**Built, with scores:**

| screen | score | note |
|---|---|---|
| Home | **4/10, 4/10** | weakest thing shipped; the loop STOPPED early because two critics reversed each other, so it never converged |
| Character select | 4–5 → **6/10** | roster cards are real 3D renders now |
| Trophy road | 5, 5, **6/10** | reference control 7/7/7 every round, so the number is trustworthy |
| Match screen | — | never scored on its own |

**Not built at all** (all four have prototypes): **settings**, shop, skins, and the
**opening/splash** screen.

**Sequencing — icons must land first.** Emoji-as-icons is the named #1 defect on these
exact screens, quantified by one critic at ~1 full point with no layout change. Polishing
home before the icons land means judging it with its worst element still in place and
re-running the round afterwards. So: icons → then home polish + settings, together.

Settings is more than cosmetic — `M` mutes today with nothing announcing it exists, and
audio, keybinds and the mobile quality tiers all currently have no home.

## SESSION 2 — mobile, and the known-weak elements

**Touch input is a missing PILLAR, not a feature.** Mobile landscape is a stated target,
viewport fairness was built specifically for it, safe-area insets are wired — and there is
**no touch input at all.** This is the same shape of gap audio was before it was built.

| # | Work | Why | Size |
|---|---|---|---|
| 1 | **Touch controls** — twin sticks, thumb zones | Mobile is unplayable without it. Note the fair-play window already reserves the lower corners as thumb-occlusion space. | 1.5 |
| 2 | **Mobile quality tiers + DPR cap** | Phones report DPR 3–4; the full post chain at native DPR will melt a mobile GPU. The art direction leans on cheap passes (saturation/contrast) and one expensive one (IBL) — that is the interesting trade. | 1 |
| 3 | **Floor** *(needs Uri present — he parked it)* | Hypothesis ready: the 6/10 was LOW-band macro variation and r4 overshot it at 0.32 vs 0.22. Plus 3 blocking-vs-walkable items all three prop critics named. | 1 |
| 4 | **Character heads ×3** | Scope is now head+torso only; archetypes own bodies. Start with the weakest silhouettes. | 1.5 |
| 5 | **Settings screen** | `M` mutes but nothing announces it; keybinds, audio, and the quality tiers from #2 all need a home. | 1 |
| 6 | **Performance pass** | Never measured. Frame time, draw calls, GC pressure at shipped framing. | 1 |

---

## SESSION 3 — economy surface, and finishing

Gated on Uri flipping `ROSTER_GATED`. **Do not ship the shop before that** — with
everything owned, every box is a guaranteed coin loss (900 coins in, ~138 EV out).

| # | Work | Notes | Size |
|---|---|---|---|
| 1 | **Roster gate ON + shop + boxes** | Model, odds and reveal are all built and tested; this is UI only | 1.5 |
| 2 | **Character heads ×4** | continue | 1.5 |
| 3 | **Skins** | Needs a per-character material-variant system that does not exist. Real work, and the reason it was deferred. | 1.5 |
| 4 | **Whole-game review pass** | Boot → menu → select → match → result → progression, as one artefact | 1 |
| 5 | **Buffer** | Something always lands late. Leaving this unallocated is deliberate. | 2 |

---

## Standing rules

1. **Probe before looping.** ~20k to find out what is actually wrong beats ~300k of
   critique. Three of four blockers were bugs, and no number of critic rounds finds a bug.
2. **No loop without a measurable acceptance test**, defined before round 1.
3. **Stop at 3 flat rounds**, or the moment two critics reverse each other.
4. **Score the reference side every round.** Outside ~7–9 means the round measured the
   critic, not the work — discard it.
5. **Check the tree, not the agent\'s last message.** Agents narrate the step they are
   BEGINNING and often finish several more.
6. **Verify before believing.** "Wired correctly but produces nothing" has been the true
   cause **fourteen times**.
