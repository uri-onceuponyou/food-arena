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

4. **When something "isn't there", assume it is rendering and INVISIBLE.** True cause **eighteen**
   times. The eighteenth rendered *plausibly and wrongly* — a restored WebGL context 15.65 luma
   darker, forever. So the question is no longer only "is it there?" but **"is it the SAME?"**,
   answered with a drift control rather than a guessed tolerance.

5. **Probe before you loop.** Every plateau ever probed here was a **bug**, not a taste gap — now
   **eight for eight**. A probe has repeatedly beaten a ~300k critic loop.

6. **⚠️ VALIDATE EVERY INSTRUMENT AGAINST A KNOWN-BAD INPUT BEFORE BELIEVING IT.**
   **Nineteen** instruments were caught returning confident wrong answers in one session — including
   the blind critic itself, a driver copied into ten tools, a cache serving stale JSON, and a guard
   whose coverage *shrank* when a bug was fixed. **A guard that has not been shown to FAIL on the bug
   it guards against is not a guard.** `tools/tmp/sentinel.mjs` (17/17) encodes this: MOVES, HOLDS,
   ORDERS, SELF-PAIR.

7. **The blind critic has a MEASURED RESOLUTION FLOOR of ±1.4 points.** σ = 0.50, and a round's two
   panels are **n=1, not n=2** (one critic scores both and agrees with itself). **Do not act on a
   smaller difference.** Use the canonical rubric — `tools/review.rubric.txt`, `--rubric canonical` —
   because the rubric alone is worth **2.0 points**, and **never compare scores across rubrics**.
   Score the reference side every round; outside 7–9 discards it. Two critics reversing → stop.

8. **Never `git stash`.** Its blast radius is the entire repo, including other agents' uncommitted work.

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

---

## Gates before every commit

```bash
npx tsc --noEmit                          # clean
node src/game/sim.test.mjs                # 218
node src/game/economy/economy.test.mjs    # 220
node tools/aspect.mjs                     # PASS, 0.00wu — competitive fairness, not a nicety
node tools/verify-head.mjs                # the committed tree builds
node tools/tmp/driver_guard.mjs           # 60 — no 14th copy of the scripted driver
node tools/tmp/sentinel.mjs               # 17 selftest + 10 live
PREVIEW_BASE=<snapshot> node tools/tmp/menu_accept.mjs          # 361
PREVIEW_BASE=<snapshot> node tools/tmp/menu_accept_portrait.mjs # 219
```

`docs/TOOLS.md` carries the full battery (~25 gates) with expected counts.

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

---

## Security constraints — permanent

- **`reference/prototypes/` and `reference/images/` are gitignored and must NEVER be committed,
  copied into `src/`, or published.** They are the original 2D prototypes and third-party
  screenshots. Prototypes were once stripped from all git history because one contained a live
  Supabase key. **Never `git add -f` anything under `reference/`.**
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
