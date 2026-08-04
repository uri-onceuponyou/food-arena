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
| **`docs/LESSONS.md`** | Every hard-won learning. Reading this is cheaper than re-learning any of it. |
| **`docs/TOOLS.md`** | The runbook. Sixteen tools exist; most were built to answer a question that cost real time. |
| `PROGRESS.md` | Historical narrative and the original trap list. Superseded by `docs/LESSONS.md` where they overlap. |
| `LAUNCH_PLAN.md`, `THREE_SESSION_PLAN.md` | Earlier planning docs. Historical. |

---

## The non-negotiables

These are not style preferences. Every one of them exists because breaking it cost hours.

1. **Verify the COMMITTED tree, not your working tree.**
   `npx tsc --noEmit` and the sim tests run against files on disk, including untracked
   ones. HEAD was unbootable for 24 commits because a committed file imported an
   uncommitted one and every gate passed anyway.
   → **`node tools/verify-head.mjs` before you push.**

2. **Measure on a frozen snapshot, never the shared dev server.**
   Any render includes the whole tree, so a peer's half-saved edit silently contaminates
   your measurement. → `node tools/snapshot.mjs --json`, and **start it and measure in the
   same shell invocation** (it dies with its parent).

3. **Judge rendered pixels. Read the PNG with the Read tool and actually look at it.**
   Judging a description instead of an image is this project's most common failure.

4. **When something "isn't there", assume it is rendering and INVISIBLE.**
   True cause **sixteen** separate times. See `docs/LESSONS.md` §1 for all sixteen.

5. **Probe before you loop.** Every plateau ever probed here turned out to be a **bug**,
   not a taste gap. A ~20k probe has repeatedly beaten a ~300k critic loop.

6. **Score the reference side every critic round.** Outside ~7–9 means the round measured
   the critic, not the work — **discard it before acting**, not afterwards. Stop the moment
   two critics reverse each other.

7. **Never `git stash`.** Its blast radius is the entire repo, including other agents'
   uncommitted work.

8. **One owner per file set.** Parallel agents in the same file clobber each other. This is
   the single hardest constraint in this project.

---

## Gates before every commit

```bash
npx tsc --noEmit                      # must be clean
node src/game/sim.test.mjs            # 51/51
node src/game/economy/economy.test.mjs # 173/173
node tools/aspect.mjs                 # PASS, 0.00wu spread
node tools/verify-head.mjs            # the committed tree builds
PREVIEW_BASE=<snapshot-url> node tools/tmp/menu_accept.mjs   # 315/315
```

Commit messages carry the *reasoning and the measurements*, not just the change — this
project's git log is a primary source and has repeatedly been the only record of why a
number is what it is.

---

## Architecture

| path | role |
|---|---|
| `src/game/rules.ts` | Single source of truth: 11 characters, weapons, balance. **No longer frozen** — values are tunable where it demonstrably improves the game. Import constants, never hardcode. |
| `src/game/{sim,state,combat,ai,movement}.ts` | Pure simulation, no Three.js. `stepMatch()` returns a typed `GameEvent[]`. |
| `src/game/economy/` | Pure logic, seeded-deterministic, 173 assertions. **All tunables in `tuning.ts`.** |
| `src/game/match.ts` | `GameSession` — the only place that talks to both sim and renderer. |
| `src/game/{input,touch,pointerLock,vfx}.ts` | Input backends + VFX driven off the event stream. |
| `src/audio/` | Audio pillar. Procedural synthesis, zero assets except the theme. Second consumer of the same event stream. |
| `src/render/` | Stage, post chain, camera rig, lighting, materials. |
| `src/characters/` | `rig.ts` (shared ChibiRig) + `bodies.ts` (4 archetypes) + one file per character. |
| `src/arena/` | Floor, hazards, props, apron, textures, ambient, shared palette. |
| `src/ui/screens/` | Shell/router, home, character select, trophy road, settings, opening, match. |
| `src/ui/icons/` | 65 authored icons replacing all emoji. |
| `tools/` | See `docs/TOOLS.md`. |

**Art direction** — verified against reference, and it contradicts the original brief's
prose: Brawl Stars is **not cel-shaded**. Smooth-shaded, hyper-saturated, high-key,
vinyl-toy, soft specular, almost no ink outline. `toonMat` returns `MeshStandardMaterial`.
No filmic tonemapping (it desaturates and was removed deliberately).

---

## Security constraints — permanent

- **`reference/prototypes/` and `reference/images/` are gitignored and must NEVER be
  committed, copied into `src/`, or published.** They are the original 2D prototypes and
  third-party screenshots. Prototypes were once stripped from all git history because one
  contained a live Supabase key. **Never `git add -f` anything under `reference/`.**
- The prototypes are **reference, not specification**, for menus (Uri unfroze them) and
  remain the design source for gameplay.

---

## Working with subagents

- **~300k tokens typical, ~470k worst** per build/loop agent. **Total agent count is the
  budget; concurrency only sets the rate.**
- Cap concurrency at **6**, and note there is a **200-agent per-session spawn cap** — this
  session hit it, which ended parallel work entirely. Budget agents like a finite resource.
- Every brief must carry: the owned file set, the snapshot rule, "never `git stash`", the
  reference-scoring rule, and the relevant traps from `docs/LESSONS.md`.
- **An agent's last message is not its state.** It narrates the step it is *beginning* and
  often finishes several more. Check the diff before writing a resume note — this was got
  wrong three times.
