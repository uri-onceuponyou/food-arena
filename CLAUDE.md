# Food Fight Arena

Real-time 3D brawler in Three.js (Vite + TypeScript strict), rebuilding a 2D prototype's
execution at the visual bar of **Brawl Stars** and **Zooba**. Owner: Uri.

Remote: https://github.com/uri-onceuponyou/food-arena — push freely.

> **New session? Read this file, then `docs/STATE.md`. Do not re-derive anything.**

---

## Read these, in this order

| file | what it is |
|---|---|
| **`docs/STATE.md`** | What is DONE (with evidence) and what is PENDING (ranked). Start here. |
| **`docs/DECISIONS-FOR-URI.md`** | Every judgement call parked for Uri, with what was assumed and what reversing costs. Opens with a one-screen answer sheet. |
| **`docs/LESSONS.md`** | Every hard-won learning. Reading it is cheaper than re-learning any of it. |
| **`docs/APP.md`** | What a mobile wrapper must supply, measured rather than assumed — the scheme requirement (`file://` is unbootable), the audio-unlock number, safe areas, fonts, payload. |
| **`docs/TOOLS.md`** | The runbook and the gate battery. Most tools exist to answer a question that cost real time. |
| `PROGRESS.md`, `LAUNCH_PLAN.md` | Historical. Superseded by `docs/LESSONS.md` where they overlap. |

---

## 🎮 To PLAY it

- **Deployed:** `https://uri-onceuponyou.github.io/food-arena/` — a built bundle with **no HMR**, so
  nothing reloads under you. Works on a phone, which is the only way the touch pillar gets judged by
  a human. Republish by rebuilding with `DEPLOY_BASE=/food-arena/` and pushing `dist/` to `gh-pages`
  (`docs/pages-workflow.yml` automates it, but the token needs `workflow` scope).
- **Locally:** `node tools/tmp/playtest.mjs` → http://localhost:4321. Same idea, no network.
- ⚠️ **Never play on the shared dev server (`:5173`)** — every agent save reloads the page, which is
  what Uri correctly reported as the game "crashing mid-flight".

---

## The non-negotiables

Not style preferences. Every one exists because breaking it cost hours.

1. **Verify the COMMITTED tree, not your working tree.** `tsc` and the sim tests run against files on
   disk, including untracked ones. HEAD was unbootable for 24 commits because a committed file
   imported an uncommitted one and every gate passed. → **`node tools/verify-head.mjs` before you push.**

2. **Measure on a frozen snapshot, never the shared dev server.** Any render includes the whole tree,
   so a peer's half-saved edit silently contaminates you.
   → `node tools/tmp/with_snapshot.mjs -- <cmd> --url {URL}` — the placeholder is **`{URL}`**, and it
   injects `PREVIEW_BASE` into the child automatically.
   ⚠️ **Never `URL=$(node tools/snapshot.mjs --json | ...)`** — `--json` does not exit; that hangs forever.

3. **Judge rendered pixels. Read the PNG with the Read tool and actually look at it.** Judging a
   description instead of an image is this project's most common failure.

   🚨 **THERE ARE TWO SHIPPED CAMERAS, AND THEY EXPOSE DIFFERENT DEFECTS. USE BOTH.**
   `src/ui/screens/charStage.ts:451` is **`pitchDeg: 20`** — the lobby, close and shallow, where Uri
   looks at a character and where every one of his reject sheets came from.
   `src/render/camera.ts:265` defaults the **match** to **58** — steep and far.
   `limbmatch`, `sepscan`, `valuescan` and the per-part pass all measure **58**.

   ⚠️ **This is NOT "the instruments measure the wrong camera" — that framing is wrong and it was
   mine.** Uri's correction, and it is the right model:

   > *"Angle only provides the ability to see what you can't notice easily on another camera. The
   > intersecting limbs is hard to identify from 58 degrees, but from a shallower look you can
   > identify it. Fixing something in the physics shouldn't damage the 58-degree view — it should
   > improve it and make it more realistic."*

   **A limb passing through a torso is a 3D fact. It is wrong at every angle.** The shallow view does
   not make it wrong; it makes it **visible**. So:
   - **The lobby camera is the better DETECTOR** for interpenetration, limb attachment and face
     construction — defects that foreshortening hides at 58°.
   - **Fix the GEOMETRY, not the appearance at one pitch.** A change that only looks right at 58° is
     a cheat and will fail the lobby, where the owner is looking.
   - **Verify at BOTH.** A real geometric fix improves both views; if it improves one and costs the
     other, it is not the fix.
   - **Diagnose UP CLOSE.** Render at lobby framing to find the defect, then confirm at match
     framing that it survived.

   ⚠️ And note `limbcheck`'s long-standing caveat — *"it measures the preview's 22°, not the match's
   58°"* — reads differently now: **22° is within two degrees of the lobby camera**, so it was never
   measuring nothing. It was answering the *other* question, and nobody noticed there were two.

4. **When something "isn't there", assume it is rendering and INVISIBLE.** True cause **eighteen**
   times. The eighteenth rendered *plausibly and wrongly* — a restored WebGL context 15.65 luma
   darker, forever. So the question is no longer only "is it there?" but **"is it the SAME?"**,
   answered with a drift control rather than a guessed tolerance.

5. **Probe before you loop.** Every plateau ever probed here was a **bug**, not a taste gap — now
   **nine for nine**. The ninth: six probes on the "flat, unlit surfaces" plateau found that
   `Material.clone()` silently drops `onBeforeCompile`, so 54 clone sites had lost the Fresnel rim
   and it reached **1.402% of pixels**. A probe has repeatedly beaten a ~300k critic loop.
   ⚠️ **But see `docs/LESSONS.md` §6b before you act on what a probe finds.** That one was real,
   correctly measured, fixed — and the blind score **did not move**, because the metric it produced
   governed the minority of the frame. **A probe tells you what is broken; it does not tell you that
   fixing it is what the viewer is reacting to.**

6. **⚠️ VALIDATE EVERY INSTRUMENT AGAINST A KNOWN-BAD INPUT BEFORE BELIEVING IT.**
   **Nineteen** instruments were caught returning confident wrong answers in one session — including
   the blind critic itself, a driver copied into ten tools, a cache serving stale JSON, and a guard
   whose coverage *shrank* when a bug was fixed. **A guard that has not been shown to FAIL on the bug
   it guards against is not a guard.** `tools/tmp/sentinel.mjs` encodes this: MOVES, HOLDS, ORDERS,
   SELF-PAIR. ⚠️ **This line quoted sentinel's own count and carried a stale `17/17`** <!-- gatecount: historical -->
   long after it was 32 — one of six counts that went stale in a single session, every one found by
   an agent tripping over it rather than by a check. Counts now live in exactly one place,
   `docs/TOOLS.md`'s gate table, and `node tools/tmp/gatecount.mjs` refuses a second copy in this
   file *even one that agrees*.

7. **The blind critic has a MEASURED RESOLUTION FLOOR of ±1.4 points.** σ = 0.50, and a round's two
   panels are **n=1, not n=2** (one critic scores both and agrees with itself). **Do not act on a
   smaller difference.** Use the canonical rubric — `tools/review.rubric.txt`, `--rubric canonical` —
   because the rubric alone is worth **2.0 points**, and **never compare scores across rubrics**.
   Score the reference side every round; outside 7–9 discards it. Two critics reversing → stop.

8. **Never `git stash`.** Its blast radius is the entire repo, including other agents' uncommitted work.
   🚨 **AND THAT INCLUDES `--autostash`.** `git pull --rebase --autostash` **creates a stash**, and it
   is the natural way to pull a branch with a dirty tree — so the ban is easy to break while trying
   to be careful. Done 2026-08-06; it happened to be a no-op that re-applied immediately, and the
   agent declared it. **That was luck, not care.** If you must pull with peers mid-edit: don't.
   Commit your own files with pathspec form first, or work from `git archive HEAD` (`headserve.mjs`).

8b. 🚨 **KILL BY PID, NEVER BY PATTERN.** `pkill -f "<toolname>"` matched **two peers' snapshot
   servers** and killed them mid-measurement (2026-08-06; they restarted, so it cost time rather
   than work). This file already banned `pkill -f fa-snap` for exactly this reason and the ban was
   read as being about *that string* rather than about *pattern-killing*. **Every agent runs the same
   tool names**, so any `-f` pattern that matches your process matches theirs. Record the PID when
   you spawn something and kill that. `tools/tmp/snapsweep.mjs` exists because it kills on a
   **derived bound** — nothing younger than the oldest live `with_snapshot` parent — rather than on
   a name.

9. **One owner per file set.** Parallel agents in the same file clobber each other. The hardest
   constraint in this project — it held across ~200 agents with zero clobbering.

   ⚠️ **But it has a cost, so it has a RELEASE VALVE.** Three agents in one session found real
   defects they were forbidden to fix: the shop still promising *"Epic or better"* two hours after
   rarity stopped granting power; `settings.ts` telling portrait players their controls do not exist,
   while the touch pass had *just proved* the portrait thumb band works; and a weapon row printing
   `1 2 3 4` for every character. Each was visible to an agent that could not touch it.

   **The valve:** a **provably additive, non-behavioural** fix — a comment, a user-facing string, a
   doc line — may cross a file-set boundary if you (a) verify the file is **clean in `git status`**
   immediately before and after, (b) change **nothing executable**, and (c) **declare it in your
   report** as an out-of-set edit. Anything else: report it to the orchestrator to route. Two agents
   did exactly this correctly this session and both declared it.

10. **State a metric's RESOLUTION FLOOR before acting on a change in it.** Known floors: aggregate
    win rate **~9 pp**, pacing **~0.8 s of contact / ~4 pp dead time**, the blind critic **±1.4
    points**. **Every one of these was discovered AFTER someone had already acted inside it** — a
    whole character programme was steered by score moves of 0.25–1.0, and two passes were reported as
    regressions that never cleared the noise.

    ⚠️ And a **paired per-matchup delta on identical seeds is EXACT** — it is a *different quantity*
    from an aggregate and must be reported separately. `roster_table`'s aggregate once moved 0.8 pp,
    inside the floor, while **58 of 110 individual matchups moved, max 34.4 pp**. Conflating them
    hides exactly that.

11. **Commit with pathspec form** — `git commit -F - -- <paths>` commits exactly those paths
    regardless of the index. Peers stage files under you constantly; `git add X && git commit` once
    swept six agents' work into one mislabelled commit. ⚠️ **Never `git commit --amend`** — a peer
    pushed between an agent's `git log -1` and its amend, and an appendix landed on someone else's
    pushed commit.

    🚨 **BUT PATHSPEC PROTECTS YOU FROM OTHER *FILES*, NOT FROM OTHER *AGENTS IN YOUR FILE*.**
    `git commit -- <path>` commits the **working tree** for that path — including a peer's
    uncommitted edits to the *same file*. Happened 2026-08-06: a rig commit carried ~250 lines of a
    peer's in-flight `armClearance` work under a message describing something else. Nothing was
    lost, HEAD built, and the agent declared it — but the commit is mislabelled forever.
    **The only real protection is rule 9: ONE OWNER PER FILE.** Pathspec is a guard against your own
    index, not against a second owner. **If you find changes in your file you did not write, stop
    and report — do not commit them under your message.**

---

## Gates before every commit

```bash
npx tsc --noEmit                          # clean
node src/game/sim.test.mjs
node src/game/economy/economy.test.mjs
node tools/aspect.mjs                     # PASS, 0.00wu — competitive fairness, not a nicety
node tools/verify-head.mjs                # the committed tree builds
node tools/tmp/driver_guard.mjs           # no 14th copy, + both `bestWeapon` faults
node tools/tmp/sentinel.mjs               # the meta-guard: MOVES / HOLDS / ORDERS / SELF-PAIR
PREVIEW_BASE=<snapshot> node tools/tmp/menu_accept.mjs
PREVIEW_BASE=<snapshot> node tools/tmp/menu_accept_portrait.mjs

node tools/tmp/gatecount.mjs              # ← EXPECTED COUNTS LIVE HERE, doc vs tree, exit 1 on drift
```

🔴 **This block deliberately carries NO expected counts, and adding one back is a gate failure.**
Six documented counts went stale in a single session and every one was found by an agent tripping
over it, never by a check; twice the same file disagreed with itself, so either copy could be
"confirmed" by reading the other. The counts lived in three places — this block, `docs/TOOLS.md`'s
quick-start, and `docs/TOOLS.md`'s gate table. **They now live in the gate table only**, and
`node tools/tmp/gatecount.mjs` parses it, runs every offline gate, diffs, and **refuses a second
copy in either file even when it agrees** — today's agreeing copy is next month's stale one. It
runs no browser gate (peers are measuring on the GPU), so it is not a substitute for the browser
half; those rows print as visible SKIPs. `docs/TOOLS.md` carries the full battery — and its own
size, because that sentence is a documented count too and `gatecount` checks it against the table.

**Commit messages carry the reasoning and the measurements**, not just the change. This log is a
primary source and has repeatedly been the only record of why a number is what it is. When an
assertion encodes a rule that has been reversed, **change it and keep the old wording above it with
the reason** — done five times this session, never deleted.

---

## Architecture

| path | role |
|---|---|
| `src/game/rules.ts` | Single source of truth for COMBAT: 11 characters, weapons, balance, `LEVEL_MAX`. Import constants, never hardcode. |
| `src/game/economy/tuning.ts` | Single source of truth for PROGRESSION: payouts, trophy road, level costs, store. |
| `src/game/{sim,state,combat,ai,movement}.ts` | Pure simulation, no Three.js. `stepMatch()` returns a typed `GameEvent[]`. Deterministic and seeded — that underwrites every balance number. |
| `src/game/match.ts` | `GameSession` — the only place that talks to both sim and renderer. |
| `src/game/{input,touch,pointerLock,vfx}.ts` | Input backends + VFX driven off the event stream. |
| `src/units.ts` | `CHARACTER_HEIGHT` (visual only — the sim collides on `PLAYER_SIZE`). |
| `src/audio/` | Procedural synthesis, zero assets except the theme. Second consumer of the same event stream. |
| `src/render/` | `stage` (post chain), `lighting`, `camera` (fair-play radius), `toon` (shared materials), `quality` (tiers). |
| `src/characters/` | `rig.ts` + `bodies.ts` (4 archetypes) + one file per character. |
| `src/arena/` | Floor, hazards, props, apron, textures, ambient, shared palette. |
| `src/ui/screens/` | Shell/router, home, character select, trophy road, settings, opening, shop, match. |
| `tools/` | See `docs/TOOLS.md`. |

**Art direction** — verified against reference plates, and it contradicts the original brief's prose:
Brawl Stars is **not cel-shaded**. Smooth-shaded, hyper-saturated, high-key, vinyl-toy, soft specular,
almost no ink outline. `toonMat` returns `MeshStandardMaterial`. **No filmic tonemapping** (it
desaturates; removed deliberately). ⚠️ **Do not fix anything by desaturating** — falsified four times.

Reference plates live in `reference/images/curated/` — `gameplay_topdown/` for the arena and cast,
`menus/` for the screens (6 plates supplied by Uri).

⚠️ **"ADDING COOL CHROMA IS THE CHEAP LEVER" IS NOW STALE — the frame moved under it.** That advice
(`docs/LESSONS.md` §8) was true when the frame was under-chromatic overall and warm-heavy in share.
Measured **2026-08-06** on the debris pass: **warm chroma now FAILS LOW (0.053 against a 0.072
minimum) while cool sits at 0.427 against a 0.343 target — over.** A teal-chip palette copied
literally from `bs_01` was **rejected on `arena-scan`** for exactly this: *"copying the plate would
have spent the one budget this frame has none of."*
→ **Warm is the scarce budget today.** Re-read `arena-scan --baseline` before assuming either
direction; the rails move as the arena changes, and the standing advice ages with them.

---

## Security constraints — permanent

- **`reference/prototypes/` and `reference/images/` are gitignored and must NEVER be committed,
  copied into `src/`, or published.** They are the original 2D prototypes and third-party
  screenshots. Prototypes were once stripped from all git history because one contained a live
  Supabase key. **Never `git add -f` anything under `reference/`.**
- 🚨 **AND THAT INCLUDES DESCRIBING THEM. This repo is PUBLIC.** Breached 2026-08-06 by the per-part
  pass, which committed crop tables whose notes named a third-party character's costume and held
  prop verbatim. No pixels and no secrets left the machine — but the rule says *published*, and
  prose derived from viewing a plate is derived from it. The rule was scrubbed and restated in
  `tools/tmp/pp_ref_parts.mjs`:
  > **Describe the compositional ROLE, never the third-party artwork.**
  > *"the costume element in the torso role"* — yes. Naming what it depicts — no.
  Crop **coordinates** are fine: they are numbers, they disclose nothing, and they are needed for
  reproducibility. **This was an honest misreading of a rule that only said "the images", so the
  rule now says both.** Remedy was proportionate — a scrub commit, not a history rewrite, because
  nothing sensitive shipped; a leaked secret or an actual plate would warrant the rewrite.
- ⚠️ `reference/images/curated/menus/zb_home.png` contains **Uri's own account details**. It stays
  local; those strings must never appear in a report, a packet, or a committed file.
- The prototypes are **reference, not specification**, for menus and remain the design source for
  gameplay.

---

## Working with subagents

- **~300–500k tokens per build/loop agent. Total agent count is the budget; concurrency only sets the rate.**
- ⚠️ **The spawn cap is per PROCESS, not per conversation — `/clear` does NOT reset it.** A fresh
  context inherited an exhausted pool from the previous 8–10 h run and the first fan-out of the
  session died on `Subagent spawn limit reached (200 of 200)` before a single file was touched.
  Two ways out, and prefer the first:
  - **Raise the ceiling durably** — an `env` block in `~/.claude/settings.json`:
    `"env": { "CLAUDE_CODE_MAX_SUBAGENTS_PER_SESSION": "800" }`. Set 2026-08-05, because 200 was
    exhausted by one session. Per-invocation equivalent: `CLAUDE_CODE_MAX_SUBAGENTS_PER_SESSION=800 claude`.
  - **Restart the terminal** — a new `claude` process gets a fresh counter. Do it at a moment when
    nothing is uncommitted; the cost is every in-flight agent dying mid-file.
  - ⚠️ **`Workflow`-dispatched agents draw from a DIFFERENT pool** and were still available with the
    `Agent` pool at 200/200 (probed, returned `ALIVE`). That is the escape hatch when a restart is not
    worth it — but workflow agents are **not resumable via `SendMessage`**, so the "assess the tree and
    resume" recovery below does not apply to them.
- Budget agents like a finite resource, and keep the cap of **6 concurrent** actually saturated —
  dispatching reactively one-at-a-time wastes the scarcer resource, which is wall-clock, not agents.
- Every brief must carry: the owned file set, the snapshot rule, "never `git stash`", the
  known-bad-input rule, the ±1.4 critic floor, and the relevant traps from `docs/LESSONS.md`.
- **An agent's last message is not its state.** It narrates the step it is *beginning* and often
  finishes several more. Check the diff before writing a resume note.
- **When one dies, assess the tree and resume via `SendMessage`** — they die mid-file, not
  mid-thought, so the work is usually type-clean.
- ⚠️ **Watch long probes, but do not misdiagnose them.** A probe was killed as "hung" on two signals
  that are both wrong for this workload: **0.0% parent CPU is expected under SwiftShader** (the work
  is in Chromium's renderer children), and "no file writes" meant nothing because the tool only wrote
  at completion. It was on row 171 of 198. Judge progress by a tool's own per-row output.
- **`tools/tmp/snapsweep.mjs`** sweeps leaked snapshot servers on a derived bound (nothing younger
  than the oldest live `with_snapshot` parent). A ten-hour fan-out once leaked 21 of them to load 38.

**Optional:** `github.com/cloudai-x/threejs-skills` is a set of Three.js API skills. Materials,
lighting and postprocessing are directly relevant; loaders and animation cover nothing here (all
geometry is procedural, no GLTF, no `AnimationMixer`). It is audited against **r160+** and we are on
**0.180.0** — spot-check claims. ⚠️ **A skill tells you what the API does; it never tells you what
this game should look like. `docs/LESSONS.md` outranks it on every art-direction question** — generic
advice would recommend filmic tonemapping and cel-shading, both of which were measured and rejected here.
