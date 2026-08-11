# Agent brief — paste-by-reference preamble

**Every build agent should be pointed at this file.** It lives in the repo *deliberately*: this
content previously sat in a session scratchpad under `/private/tmp`, that directory was cleaned
mid-session, and agents were briefed at a dead path for hours. They fell back to `CLAUDE.md` and
were fine — but a brief that can silently vanish is not a brief.

Read this, then `CLAUDE.md`, then the sections of `docs/LESSONS.md` your brief names.

---

## 1. YOUR OWNED FILE SET

Your brief names it. **You may not edit any file outside it.** One owner per file set held across
~200 agents with zero clobbering; it broke exactly once, when the orchestrator assigned `rig.ts` to
two agents at once and a commit swept a peer's in-flight work under the wrong message.

🚨 **Pathspec form does NOT protect you from a second owner.** `git commit -- <path>` commits the
**working tree** for that path, including a peer's uncommitted edits to the *same file*. **If you
find changes in your file you did not write, stop and report — do not commit them.**

🚨 **AND "NOTHING ELSE IS RUNNING" EXPIRES. TREAT IT AS TRUE ONLY WHEN YOU WERE DISPATCHED.**
An orchestrator writes that sentence honestly and it stops being true the moment your work outlives
your dispatch window — a successor is briefed on your own handover ladder and lands *in your file
set*, correctly. Happened 2026-08-11: the N-fighter step-1 agent woke on a stale wait-loop hours
after finishing, found +1,091 lines across five of its files, and **stopped without committing,
reverting or stashing anything.** That was the right move and it cost nothing.

So: **re-read `git status` before you touch anything after any pause.** If your files carry changes
you did not write, you are no longer the owner — **report and stop.** Do not diff-and-merge, do not
"just commit my part": `git commit -- <path>` commits the *working tree* for that path, so your
message would ship a peer's half-finished work under it.
⚠️ And do **not** run gates on that tree either. Any `tsc` / `sim.test` / bit-identity number you
quote would be measured on a peer's half-saved files — a red result there is noise, not a regression,
and reporting it as one wastes an orchestrator's next decision.

**The release valve:** a **provably additive, non-behavioural** fix — a comment, a user-facing
string, a doc line — may cross a boundary if you (a) verify the file is **clean in `git status`**
immediately before and after, (b) change **nothing executable**, and (c) **declare it**. ⚠️ A row in
`docs/TOOLS.md`'s gate table is **executable** (`gatecount` runs what it lists) and is *not* covered.

## 1b. 🚨 DO NOT SPEND AGENTS ON WHAT URI IS ABOUT TO DO BETTER

**Burned ~1M tokens on 2026-08-11**, five agents sent to judge the freshly-deployed build from five
angles — dispatched in the same turn Uri said *"let's push all so I can test everything."* He was
already opening it. **A human playing the game is the better instrument for every subjective question
that fan-out was asked**, and this project's own record says so: *"the two most valuable bug reports
on this project came from you simply playing it — clicks not firing, and the character not facing the
cursor. Both were invisible to `tsc`, to the assertions, and to every screenshot."*

**Split the work by what each side is actually good at:**

| question | who |
|---|---|
| does it build, resolve, 200, base-path correctly, stay bit-identical | **gates** — cheap, exact, already exist |
| does it look right, feel right, read right | **Uri** — free, and better than any critic here |
| what specifically is wrong and why | **agents**, AFTER he says something is wrong |

⚠️ **The trigger is the word "I".** *"so I can test"*, *"I'll look tomorrow"*, *"let me play it"* —
that is a handover, not a request for a second opinion. **Verify the mechanical half, hand it over,
and stop.**
⚠️ And a standing opt-in to fan out is **permission, not justification.** Scale to the question:
five agents to re-derive an aesthetic judgement a human is seconds from making is waste however it
was authorised.

## 2. NEVER

- **`git stash`** — blast radius is the whole repo. 🚨 **And `git pull --rebase --autostash` CREATES
  a stash.** Don't pull with a dirty tree; commit your own files first, or use `headserve.mjs`.
- **`git commit --amend`** — a peer pushed between an agent's `git log -1` and its amend.
- **`pkill -f <pattern>`** — every agent runs the same tool names, so your pattern matches theirs.
  **Kill by PID.** `snapsweep.mjs` kills on a *derived bound*, which is why it is safe.
- **`git add -f` anything under `reference/`** — and 🚨 **describing those plates counts as
  publishing them. This repo is PUBLIC.** Describe the compositional ROLE, never the artwork.
- **Measuring on the shared dev server (`:5173`).**
- **`URL=$(node tools/snapshot.mjs --json | ...)`** — `--json` never exits; `$(...)` blocks forever
  and reads exactly like a hung build.

## 3. MEASUREMENT

```bash
node tools/tmp/with_snapshot.mjs -- <cmd> --url '{URL}'    # placeholder is literally {URL}
```

🚨 **`snapshot.mjs` copies the WORKING tree — "frozen" is not "clean."** It stops changes *during*
your run; it does not remove peers' half-saved work. **For any A/B you will quote, snapshot a
DETACHED WORKTREE of a known commit.**
⚠️ A fresh snapshot's **first** client eats a dep-optimisation reload that presents as
`execution context was destroyed`. Warm it with a cheap page load.
🚨 **`rg_lib.loadCast` IGNORES `headserve` ENTIRELY — SO A `--ref`-PINNED A/B READS THE WORKING TREE
FOR BOTH ARMS.** `buildBundle` esbuilds straight out of `REPO`. Both arms then return byte-identical
numbers on every column, **which reads exactly like "the change did nothing"** — the most dangerous
possible failure, because a null result is a normal outcome here and nobody re-checks it. **Every
tool built on `rg_lib` inherits this.** For a pinned A/B, use a **detached worktree of the SHA** with
`node_modules` symlinked, not `--ref`.

⚠️ **An UNNAMED mesh is invisible to every diagnostic here.** Ablation, part maps and the brow/eye
tools all key on `name`. If you build geometry you may later need to measure, name it.

🚨 **A TOOL THAT EXPORTS ANYTHING NEEDS AN `IS_MAIN` GUARD, AND THREE HERE DID NOT.** Making a
function importable — the right instinct, so a second tool reuses a validated rig instead of copying
it — silently makes the whole CLI path run on import. Measured tonight: importing `snapsweep.mjs`
**printed a live sweep report** (so `node anything.mjs` that imported it would have killed every
snapshot server on the box), importing `da_census.mjs` **fell through into `runCapture`** and, with
`PREVIEW_BASE` set — which it is inside every `with_snapshot` child — would launch Chromium and walk
20 captures. Related: a module that reads `process.argv` **at module scope** made `valuescan
--selftest` run a *different* tool's selftest and exit. **Guard the main path; keep the exports.**

🚨 **CAMERA SHAKE RE-RANDOMISES ON EVERY `render()`, SO A FROZEN FRAME IS NOT A FROZEN CAMERA.**
`render/camera.ts:CameraRig.update()` multiplies the shake **decay** by `dtSeconds` but **not the
re-randomisation** — so at `dt = 0` the branch never exits and **every `stage.render()` call moves
the camera to a new random offset**, and `Stage.render()` calls `rig.update()` before drawing.
Measured: **344 of 344 frozen frames drifted, up to 349 px of mask.** **Every rAF-frozen probe here
that renders twice with shake active has been measuring a moving camera.** `feel_probe.mjs` forced
the offset to zero for exactly this reason and never generalised it. **Zero the shake explicitly.**

🚨 **CSS ANIMATIONS RUN ON THE DOCUMENT TIMELINE, NOT `requestAnimationFrame`.** So **freezing rAF
does not still them**, and **every rAF-frozen probe in this repo has been animating CSS the whole
time**. Worse, `locator('canvas').screenshot()` is a **page capture clipped to the canvas box**, so a
`position: fixed` HUD keyframe lands inside every PNG you think is "the canvas". Measured: one arena
station self-paired at **471,742 px of 1,440,000 with rAF already frozen**, and **0 px** once the CSS
was stilled. Still them explicitly (`PAGE_STILL_HUD` / `--still-hud`) or mark the station
non-comparable. ⚠️ Related: *"freezing the clock is not freezing the loop"* — `__feelDebug.frames`
counts rAF turns, so a paused sim clock still leaves the loop running.

🚨 **`page.evaluate()` GRANTS TRANSIENT USER ACTIVATION.** Playwright issues it over CDP with
`userGesture: true`. Proved on `about:blank` with a page-side sampler: `isActive` false at 1003 ms,
**true at 1205 ms, from a single `page.evaluate(() => 1)`.** So a probe's own bookkeeping read hands
the app a gesture it never received — an audio no-tap control reported the theme playing at rms
0.022 with nothing tapped. **This applies to every probe that evaluates before the gesture it
measures**, not just audio. Fix structurally: observe page-side via `addInitScript`, allow exactly
one `evaluate` per cell and make it LAST, and compute the verdict from the samples.

⚠️ **`process.exit()` inside a `try` SKIPS THE `finally`** — a frozen tree leaked on every run of a
probe that looked correct.

⚠️ **`window.__screenReady` IS NOT A PAINT** — measured opacity 0.000 when it flips. Wait on
`tools/tmp/settle.mjs`, and on the screen's **NAME**.

## 4. THE RULES THAT COST THE MOST WHEN BROKEN

1. **Read every PNG you produce with the Read tool and LOOK at it.** Judging a description instead
   of an image is this project's most common failure — and it is what caught a per-part run where
   four panels showed the wrong body part while all five numeric checks passed green.
2. **"It isn't there" means it IS there and is INVISIBLE** — true **twenty** times.
   ⚠️ The twentieth: a shader that never linked drew nothing for three rounds, because the
   **shadow-depth program has no rim patch** and kept drawing each chip's contact shadow. **A mesh's
   shadow, outline or decal can be drawn by a DIFFERENT program from the mesh.** Ablate to an
   unmissable colour and require the frame to MOVE.
3. **Probe before you loop** — nine for nine. ⚠️ **But a probe tells you what is broken, not that
   fixing it is what the viewer reacts to** (`LESSONS.md` §6b).
4. **VALIDATE EVERY INSTRUMENT AGAINST A KNOWN-BAD INPUT.** A guard not shown to FAIL is not a
   guard — and a guard can also be **tautological**. **Ask of every assertion: what implementation
   would fail this?** If you cannot name one, it is a comment with a tick next to it.
5. **State a metric's RESOLUTION FLOOR before acting on a change in it.** Aggregate win rate
   **~9 pp**; pacing **~0.8 s**; the blind critic **±1.4** (~1.0 with two independent critics).
   ⚠️ A **paired per-matchup delta on identical seeds is EXACT** and is a **different quantity** from
   an aggregate. Never conflate them.
6. **An acceptance test proves you moved the thing you NAMED, not that it was the thing.** Ask what
   fraction of the frame your metric governs and what is **excluded from it by policy**.
   ⚠️ And read backwards: **a flat metric is not evidence a change did nothing** — ask what the
   metric can *express*.
7. **A BASELINE IS ITSELF A MEASUREMENT.** Comparing against an unvalidated one manufactures a
   regression as convincingly as a real bug does.
8. **Measure the artefact you SHIP, on the PATH you ship it to.** A 404 on the deployed build
   survived 427 audio assertions because every one pointed at `/`.
9. **Two cameras, and they expose different defects.** Lobby `charStage.ts` **pitch 20** (what Uri
   judges); match `camera.ts` **58**. A limb through a torso is wrong at both. **Fix the geometry,
   verify at both, diagnose up close.**

## 5. GATES

```bash
npx tsc --noEmit
node tools/tmp/gatecount.mjs     # ← EXPECTED COUNTS LIVE ONLY IN docs/TOOLS.md's gate table
node tools/verify-head.mjs       # the COMMITTED tree — run before EVERY push
```

🔴 **Do not write an expected count anywhere but that table.** `gatecount` refuses a second copy
**even one that agrees** — today's agreeing copy is next month's stale one. Eight counts went stale
in one session and every one was found by an agent tripping over it.

**Commit with pathspec form.** Commit messages carry the reasoning and the measurements; this log is
a primary source. **When an assertion encodes a reversed rule, change it and keep the old wording
above it with the reason.**

## 6. ART DIRECTION — settled, and it contradicts generic advice

Brawl Stars is **NOT cel-shaded**. Smooth-shaded, hyper-saturated, high-key, vinyl-toy, soft
specular, almost no ink outline. **No filmic tonemapping.**
⚠️ **Do not fix anything by desaturating — falsified four times.**
⚠️ **And "adding cool chroma is the cheap lever" is STALE** — warm now FAILS LOW (0.053 vs a 0.072
minimum) while cool is over target. **Re-read `arena-scan --baseline` before assuming a direction.**

## 7. REPORT FORMAT

Lead with **what landed** (SHAs + before/after + floor), then **what you REVERTED and the number
that killed it**, then **what you could NOT verify**. *"I could not verify this"* is a valuable
answer; a plausible measurement treated as fact has cost this project real time. Name any
**out-of-set defect** you found, and anything that needs **Uri**.
