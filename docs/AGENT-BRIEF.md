# Agent brief — paste-by-reference preamble

**Every build agent should be pointed at this file.** It lives in the repo *deliberately*: this
content once sat in a session scratchpad under `/private/tmp`, that directory was cleaned
mid-session, and agents were briefed at a dead path for hours.

Read this, then `CLAUDE.md`, then the sections of `docs/LESSONS.md` your brief names.

🔴 **DO NOT RENUMBER THESE SECTIONS — THEY ARE AN API.** Measured 2026-08-22: **136 files cite a
section of this one** (`§3` on 141 lines, `§4.4` on 23, plus `§4.1/4.2/4.5/4.6/4.7/4.8`, `§1`, `§6`,
`§7`). A shifted number silently re-points all of them and no gate can see it. **Add as `§Nb`** —
hence `§2b`, `§4b`; `§4`'s rules keep their order for the same reason. ⚠️ Drift has begun:
`arena-scan.mjs:1594` cites *"§7"* for "a baseline is itself a measurement", which is `§4.7`.

---

## 1. YOUR OWNED FILE SET

Your brief names it. **You may not edit any file outside it.** It held across ~200 agents with zero
clobbering *in the assigned source sets*, and broke when `rig.ts` went to two agents at once.

🚨 **Pathspec form does NOT protect you from a second owner.** `git commit -- <path>` commits the
**working tree** for that path, peer's uncommitted edits included. **If you find changes in your
file you did not write, stop and report — do not commit them.**

🚨 **"NOTHING ELSE IS RUNNING" EXPIRES — it was true when you were DISPATCHED.** It stops being true
the moment your work outlives that window; a successor briefed on your own handover lands in your
file set, correctly. 2026-08-11: an agent woke on a stale wait-loop, found **+1,091 lines across five
of its files**, and stopped without committing, reverting or stashing. Right move, cost nothing.
→ **Re-read `git status` after any pause.** Changes you did not write mean you are not the owner:
**report and stop.** Do not diff-and-merge, do not "just commit my part".
⚠️ **And do not run GATES on that tree** — any `tsc` / `sim.test` / bit-identity number would be
measured on a peer's half-saved files. A red result there is noise, and filing it as a regression
wastes the orchestrator's next decision.

**The release valve:** a **provably additive, non-behavioural** fix — a comment, a user-facing
string, a doc line — may cross a boundary if you (a) verify the file is **clean in `git status`**
immediately before and after, (b) change **nothing executable**, (c) **declare it**. ⚠️ A row in
`docs/TOOLS.md`'s gate table is **executable** (`gatecount` runs what it lists) and is *not* covered.

## 1b. 🚨 DO NOT SPEND AGENTS ON WHAT URI IS ABOUT TO DO BETTER

**~1M tokens burned on 2026-08-11** — five agents sent to judge a fresh deploy, in the same turn Uri
said *"let's push all so I can test everything."* **His two bug reports are this project's most
valuable** — clicks not firing, the character not facing the cursor — and both were invisible to
`tsc`, to every assertion, and to every screenshot.

| question | who |
|---|---|
| does it build, resolve, 200, base-path correctly, stay bit-identical | **gates** — cheap, exact, already exist |
| does it look right, feel right, read right | **Uri** — free, and better than any critic here |
| what specifically is wrong and why | **agents**, AFTER he says something is wrong |

⚠️ **The trigger is the word "I".** *"so I can test"*, *"I'll look tomorrow"* — that is a handover.
**Verify the mechanical half, hand it over, stop.** A standing opt-in to fan out is **permission,
not justification**: scale to the question.

## 2. NEVER

- **`git stash`** — blast radius is the whole repo. 🚨 **`git pull --rebase --autostash` CREATES a
  stash.** Don't pull with a dirty tree; commit your own files first, or use `headserve.mjs`.
- **`git commit --amend`** — a peer pushed between an agent's `git log -1` and its amend.
- **`pkill -f <pattern>`** — every agent runs the same tool names, so your pattern matches theirs.
  **Kill by PID.** `snapsweep.mjs` kills on a *derived bound*, which is why it is safe.
- **`git add -f` anything under `reference/`** — and 🚨 **describing those plates counts as
  publishing them. This repo is PUBLIC.** Describe the compositional ROLE, never the artwork.
- **Measuring on the shared dev server (`:5173`).**
- **`URL=$(node tools/snapshot.mjs --json | ...)`** — `--json` never exits; `$(...)` blocks forever
  and reads exactly like a hung build.

## 2b. CLAIMING TOOL SPACE, AND COMMITTING WHAT YOU MEASURED

🚨 **`git commit -- <path>` FAILS ON AN UNTRACKED FILE** — `error: pathspec '<path>' did not match
any file(s) known to git`, exit 1 (re-derived 2026-08-22). **`git add` the EXACT PATH first, never
the directory** — `git add tools/tmp` sweeps every peer's scratch into your commit. Chain
`edit && commit`, **never `;`**: a `;` once let a commit run after its own edit had failed an
assertion, and the message described a change that never landed.

🚨 **`tools/tmp/` IS ONE FLAT NAMESPACE AND NOBODY IS TOLD WHO HOLDS A PREFIX.** Check with **BOTH
`git ls-files tools/tmp` AND `ls tools/tmp`** — different questions, neither sufficient. This tree,
2026-08-22: **840 top-level entries on disk · 728 with tracked content · 112 invisible to
`git ls-files`.** Tracked means a peer *committed* it, so a clobber is recoverable; untracked means
it is not, and five live instruments were untracked until `85f1847`. **`Read` before you `Write`** —
`Edit` refuses a file you have not read and `Write` has no such interlock, which is why the one
clobbering on record (`CLAUDE.md` rule 9) happened with `Write`. ⚠️ **An orchestrator naming a free
prefix is not a check** — the last named **six** that did not exist.

**Report the count you MEASURED, never the one in your brief.** An agent published a four-row table
typed from memory with **3 of 4 rows wrong**, ninety seconds after correcting a different typo, with
the correct output still on screen: *"a count written from memory is wrong here at roughly coin-flip
rate, whoever it came from."* Verify every number **before** it enters a commit message — `--amend`
is banned, so a wrong one stays, and the log is a primary source.

## 3. MEASUREMENT

```bash
node tools/tmp/with_snapshot.mjs -- <cmd> --url '{URL}'    # placeholder is literally {URL}
```

🚨 **`snapshot.mjs` copies the WORKING tree — "frozen" is not "clean."** It stops changes *during*
your run; it does not remove peers' half-saved work. **For any A/B you will quote, snapshot a
DETACHED WORKTREE of a known commit** — `sx_snap.mjs --root <dir>`, same `{URL}`/`PREVIEW_BASE`
contract. ⚠️ A fresh snapshot's **first** client eats a dep-optimisation reload presenting as
`execution context was destroyed`; warm it with a cheap page load.

🚨 **`rg_lib.loadCast` IGNORES `headserve` — SO A `--ref`-PINNED A/B READS THE WORKING TREE FOR BOTH
ARMS** (`buildBundle` esbuilds straight out of `REPO`). Both arms return byte-identical numbers on
every column, **which reads exactly like "the change did nothing"** — the most dangerous failure
here, because a null result is a normal outcome and nobody re-checks it. **Every tool on `rg_lib`
inherits it.** Pin with a detached worktree of the SHA (`node_modules` symlinked), never `--ref`.

🚨 **CAMERA SHAKE RE-RANDOMISES ON EVERY `render()` — A FROZEN FRAME IS NOT A FROZEN CAMERA.**
`CameraRig.update()` scales the shake *decay* by `dtSeconds` but not the *re-randomisation*, so at
`dt = 0` every `stage.render()` moves it: **344 of 344 frozen frames drifted, up to 349 px of mask.**
**Zero the shake explicitly.**

🚨 **CSS ANIMATIONS RUN ON THE DOCUMENT TIMELINE, NOT rAF — freezing rAF does not still them**, and
`locator('canvas').screenshot()` is a **page capture clipped to the canvas box**, so a
`position: fixed` HUD keyframe lands in every "canvas" PNG. One station self-paired at **471,742 px
of 1,440,000** with rAF frozen, **0 px** once stilled (`--still-hud`). ⚠️ And **freezing the clock is
not freezing the loop.**

🚨 **`page.evaluate()` GRANTS TRANSIENT USER ACTIVATION** (`userGesture: true`), so a probe's own
bookkeeping read hands the app a gesture it never received — `isActive` false at 1003 ms, **true at
1205 ms from one `page.evaluate(() => 1)`** on `about:blank`; an audio no-tap control reported the
theme playing at rms 0.022 with nothing tapped. Observe page-side via `addInitScript`; one
`evaluate` per cell, LAST.

🚨 **A TOOL THAT EXPORTS ANYTHING NEEDS AN `IS_MAIN` GUARD** — three here did not. Importing
`snapsweep.mjs` **ran a live sweep**; `da_census.mjs` fell into `runCapture` and, with `PREVIEW_BASE`
set (as it is in every `with_snapshot` child), would launch Chromium. Reading `process.argv` at
module scope made `valuescan --selftest` run a *different* tool's selftest.

⚠️ **`process.exit()` inside a `try` SKIPS THE `finally`** — a frozen tree leaked on every run.
⚠️ **`window.__screenReady` IS NOT A PAINT** (opacity 0.000 when it flips). Wait on `settle.mjs`,
and on the screen's **NAME**.
⚠️ **An UNNAMED mesh is invisible to every diagnostic here** — ablation, part maps and the brow/eye
tools all key on `name`. Name geometry you may later need to measure.

## 4. THE RULES THAT COST THE MOST WHEN BROKEN

1. **Read every PNG you produce with the Read tool and LOOK at it.** Judging a description instead
   of an image is this project's most common failure — it caught a run where four panels showed the
   wrong body part while all five numeric checks were green.
2. **"It isn't there" means it IS there and is INVISIBLE** — true **twenty** times. ⚠️ The twentieth:
   a shader that never linked drew nothing for three rounds, because the shadow-depth program has no
   rim patch and kept drawing the contact shadow. **A mesh's shadow, outline or decal can be drawn by
   a DIFFERENT program.** Ablate to an unmissable colour and require the frame to MOVE.
3. **Probe before you loop** — nine for nine. ⚠️ **But a probe tells you what is broken, not that
   fixing it is what the viewer reacts to** (`LESSONS.md` §6b).
4. **VALIDATE EVERY INSTRUMENT AGAINST A KNOWN-BAD INPUT.** A guard not shown to FAIL is not a
   guard — and a guard can also be **tautological**. **Ask of every assertion: what implementation
   would fail this?** If you cannot name one, it is a comment with a tick next to it.
   🚨 **A CHECKER ANSWERS ITS OWN QUESTION AND IS SILENT ABOUT EVERY OTHER ONE:**
   - **`--selftest` validates a tool's LOGIC, never where it is POINTED.** `valuescan` read a
     perfect selftest with **14 of 18** stations in the wrong quadrant, **eleven** inside a `CoverBox`.
   - **`node --check` validates SYNTAX, never ORDER.** It passed three files whose shared `SELF`
     binding was declared **6, 2 and 34 lines BELOW its own first use** — a temporal-dead-zone
     `ReferenceError` at module load in all three (`830f7d7`), caught only by **RUNNING the tool**.
   → **Green from a checker is evidence about that checker's question and nothing else.**
5. **State a metric's RESOLUTION FLOOR before acting on a change in it.** Aggregate win rate
   **~9 pp**; pacing **~0.8 s**; the blind critic **±1.4**. ⚠️ A **paired per-matchup delta on
   identical seeds is EXACT** — a *different quantity* from an aggregate. Never conflate them.
   🚨 **And the critic INSTRUMENT appears to have moved**: four drift arms on byte-identical
   2026-08-05 pixels all read LOWER (−1.003, −0.830, −0.833, −0.330), three clearing the 6-vs-6 floor
   of 0.566 — **the same magnitude as the gap a round exists to measure, so any before/after across
   08-05 → now is confounded.** ⚠️ **CANDIDATE, not settled**: at `q1_sigma`'s measured σ today
   (0.649) the floor is 0.734 and only one arm survives.
6. **An acceptance test proves you moved the thing you NAMED, not that it was the thing.** Ask what
   fraction of the frame your metric governs and what is **excluded from it by policy**. ⚠️ Read it
   backwards too: **a flat metric is not evidence a change did nothing** — ask what it can *express*.
7. **A BASELINE IS ITSELF A MEASUREMENT.** Comparing against an unvalidated one manufactures a
   regression as convincingly as a real bug does.
8. **Measure the artefact you SHIP, on the PATH you ship it to.** A 404 on the deployed build
   survived 427 audio assertions because every one pointed at `/`.
9. **Two cameras, and they expose different defects.** Lobby `charStage.ts` **pitch 20** (what Uri
   judges); match `camera.ts` **58**. A limb through a torso is wrong at both. **Fix the geometry,
   verify at both, diagnose up close.** ⚠️ **Cite the VALUE and grep for it — never a line number.**
   `camera.ts`'s 58 is at `:640` today; a citation "corrected" to `:476` went stale inside a day, and
   `CLAUDE.md` still points at `:265`, a different function.

## 4b. 🚨 THE DOMINANT DEFECT CLASS: CORRECT AT TWO SEATS, SILENT AT SIX

`MAX_FIGHTERS` is **6** and **Uri plays six-player.** Six shipped defects were **unreachable below
three seats**, every N=2 instrument green throughout. The commits number the class as they land,
because nobody recognised it until the fifth:

| defect | SHA | why two seats could not see it |
|---|---|---|
| loser list in SLOT order | `7743f08` | reversed elimination order agrees with slot order in **0.0%** of six-seat matches — but at N=2 there is one loser, so they agree trivially |
| corpse kept moving and firing | `7a32f3d` | at N=2 the kill sets `phase='ended'` and the loop is gated on `'playing'`; at N=6 a knockout deliberately does **not** end the match |
| shake had no distance term | `d0a42ea` | N=2 **95.2%** of kicks inside full radius / **0.0%** beyond fade; N=6 **30.0% / 66.7%**, delivered/raw **0.426** |
| a 360° melee slam hit ONE fighter | `3483d23` | *"nearest opponent"* and *"everyone in the arc"* **name the same fighter**; 621 assertions passed |
| projectiles resolved only vs `targetId` | `5c11427` | same sentence at two seats — the only living opponent **is** the target; 638 assertions passed |
| dying pinned you to your corpse | `30e3360` | for up to `MATCH_DURATION_MS` = **150 000 ms**, match off screen |

🚨 **SO A CONTROL BUILT AT N=2 FOR ANY OF THESE PASSES VACUOUSLY** — not because it is weak, but
because the two behaviours it compares are **the same sentence** at two seats. `sv_subject.mjs` arm
C: **3 of 5 wrong camera policies are completely invisible at N=2.** Build the known-bad at **six**,
and state the N your defect first expresses at.
⚠️ **The sharper half of that arm:** its first version compared `slot + viewReason` and reported
**4 of 5 CAUGHT at N=2** — caught on **an instrumentation field the same commit had just added, which
no player can see.** On the observable it is 2 of 5. **Measure the observable, not the field you
added to measure it with.**
⚠️ **And do not round every bug up to six seats.** `72d6c36` — the result card overflowing a 430 px
phone — looked like this class and **was not**: 40 of 112 cards overflowed **from three seats**, and
two overflowed whenever a chest credit made a fourth payout chip. It was clipping in shipped play.

## 5. GATES

```bash
npx tsc --noEmit
node tools/tmp/gatecount.mjs     # ← EXPECTED COUNTS LIVE ONLY IN docs/TOOLS.md's gate table
node tools/verify-head.mjs       # the COMMITTED tree — run before EVERY push
```

🔴 **Do not write an expected count anywhere but that table.** `gatecount` refuses a second copy
**even one that agrees** — today's agreeing copy is next month's stale one.
⚠️ **But "refuses" is not "cannot happen".** It reads exactly two documents, `CLAUDE.md` and
`docs/TOOLS.md` — **not this file, not `docs/STATE.md`, not `docs/LESSONS.md`** — and inside them only
sees a copy on a line naming the gate's **`.mjs` path**, plus the line after; a count beside a bare
tool name is invisible. The blind spot is deliberate and priced (bare names measured **16 false
positives to 1 true one** here). So **the rule is enforced in two files and is on you everywhere
else** — which is how `docs/STATE.md` came to carry an unpoliced count.

🚨 **A `gatecount` FAULT LIST IS A PROPERTY OF *WHEN* AND *WHERE* YOU RAN IT — BOTH DIRECTIONS.**
It runs every offline gate **against the tree it stands in**, taking minutes: **361.6 s** on
`85f1847`, 2026-08-22, for **88 verified · 64 skipped · 0 faults** — *an observation stamped with its
SHA and hour, NOT an expected count; do not re-quote it, re-run it.* Two agents got different fault
sets minutes apart because peers moved; a peer's *fix* deletes a fault you were about to report as
surely as a half-saved edit invents one.
→ **Any fault list you will QUOTE must be measured on a clean worktree of your own commit** (`§3`).
⚠️ **And never file "pre-existing, not mine" off a dirty tree** — a red gate dismissed that way by
**six agents in a row** is how a gate becomes furniture (`3230abf`).

**Commit with pathspec form** (`§2b`). Commit messages carry the reasoning and the measurements; this
log is a primary source. **When an assertion encodes a reversed rule, change it and keep the old
wording above it with the reason.**

## 6. ART DIRECTION — settled, and it contradicts generic advice

Brawl Stars is **NOT cel-shaded**. Smooth-shaded, hyper-saturated, high-key, vinyl-toy, soft
specular, almost no ink outline. **No filmic tonemapping.**
⚠️ **Do not fix anything by desaturating — falsified four times.**

🚨 **THE CHROMA DIRECTION THIS SECTION CARRIED IS DEAD, CORRECTED HERE** — old wording kept per the
reversal rule: *"warm now FAILS LOW (0.053 vs a 0.072 minimum) while cool is over target."*
`tools/scan/colour-baseline.json`, on a **served, committed** tree at `072f245` (2026-08-12):
**`warmChroma` 0.0823 PASS** (floor 0.0725) and **`coolChroma` 0.3855 PASS** (target 0.343,
`freeAbove` — above target is free, only the 0.5145 ceiling binds). **Warm is no longer a contract
violation**, merely the furthest rail from target (57% of 0.145) — a far weaker claim. 0.0596-FAIL
is the **superseded** baseline `36ee0a6`, one day older; 0.053 older still. ⚠️ `CLAUDE.md` and
`docs/TOOLS.md` still carry the dead number — routed.
→ **Only the durable half survives: re-read `arena-scan --baseline` BEFORE assuming a direction.**
This direction went stale in 24 hours and outlived its correction by ten days.

## 7. REPORT FORMAT

Lead with **what landed** (SHAs + before/after + floor), then **what you REVERTED and the number
that killed it**, then **what you could NOT verify**. *"I could not verify this"* is a valuable
answer; a plausible measurement treated as fact has cost this project real time. Name any
**out-of-set defect** you found, and anything that needs **Uri**.

🚨 **AND REPORT EVERY CLAIM IN YOUR BRIEF THAT DID NOT CHECK OUT — that is a RESULT, not a
digression.** An orchestrator writes from summaries; **you are the only one holding the file.** In
one session it published six falsifiable claims and every one was wrong; **agents caught five, always
by re-deriving rather than pasting.** Contradicting the brief is the job.
