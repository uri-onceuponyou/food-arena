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
| 🚨 **`docs/AGENT-BRIEF.md`** | **The preamble EVERY build agent must be pointed at** — owned file set, the snapshot rule, the known-bad rule, the traps. ⚠️ **It exists in the repo because this content once sat in a session scratchpad that was cleaned mid-session, and agents were briefed at a dead path for hours. It then grew 200 lines and was referenced by ZERO files — the file that exists so a brief cannot vanish had vanished from the handover.** |
| `docs/NETCODE.md` · `docs/PHONE.md` | The transport decision priced on this sim (§52); the phone capture protocol and what it asks Uri for. Both grew several hundred lines this session and were nearly undiscoverable for the same reason. |
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

   🚨 **BUT "FROZEN" IS NOT "CLEAN", AND THE SHIPPED LAUNCHER FREEZES THE *WORKING* TREE.**
   `with_snapshot` spawns `snapshot.mjs` with **no `cwd`**, so what it copies is whatever directory
   the shell happens to be in — peers' half-saved edits included. It stops changes *during* your run;
   it does not remove the ones already sitting there. That is right for the ordinary case and wrong
   for **any A/B you will quote**, which must describe a commit that actually exists.
   → Build a detached worktree (rule 8's recipe) and point at it:
   `node tools/tmp/sx_snap.mjs --root <dir> -- <cmd> --url {URL}` — identical `{URL}`/`{DIR}` and
   `PREVIEW_BASE` contract, cwd-aware, same PID-recorded teardown.

3. **Judge rendered pixels. Read the PNG with the Read tool and actually look at it.** Judging a
   description instead of an image is this project's most common failure.

   🚨 **THERE ARE TWO SHIPPED CAMERAS, AND THEY EXPOSE DIFFERENT DEFECTS. USE BOTH.**
   `src/ui/screens/charStage.ts:451` is **`pitchDeg: 20`** — the lobby, close and shallow, where Uri
   looks at a character and where every one of his reject sheets came from.
   `src/render/camera.ts` — **grep `opts.pitchDeg ?? 58`**, in `CameraRig`'s constructor —
   defaults the **match** to **58**, steep and far.

   🚨 **THERE IS NO LINE NUMBER HERE ON PURPOSE, AND IT TOOK TWO TRIES TO LEARN THAT.**
   This said `:265` for a session — a *distance helper* — so a rule about looking at the
   right camera pointed at the wrong line. I corrected it to `:476` and wrote *"cite the
   SYMBOL as well as the line."* **Within one day peers moved it to `:640` and `:476` was
   wrong again**, caught by a third agent. Citing the symbol *as well as* the line still
   ships a number that rots; the line adds nothing a `grep` does not, and subtracts
   trust every time it drifts. **Cite the symbol INSTEAD.**

   ⚠️ Both corrections came from an agent re-deriving a claim it had been handed as true,
   never from a check — and `gatecount` measured the cost of automating this class at
   **16 false positives for 1 true one**. This is a habit, not a guard.
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
   SELF-PAIR.

   🚨 **AND A GUARD CAN PASS BY HAVING NOTHING LEFT TO CHECK — `[].every()` returns `true`.** That
   exact vacuity fired **three times, in three files, in one session**, always because a fix *emptied
   the filtered set the assertion ran over*. Same class, different disguises, all green: a fixture
   pointed at the wrong object; a known-bad planted where the bug **cannot express itself**; a differ
   blinded to a field that had nothing to drop yet; a sentinel written onto a field already holding
   it; a wrong-base demo staged inside the countdown, where nothing moves; a census counting the
   **function declaration** as a call site; and two arms of one instrument false *by construction* —
   comparing a rendered frame's **luma** against a material's **colour**, incommensurable units, so a
   single threshold cut through one continuous population.
   → **If you FILTER a set before asserting over it, assert the set is NON-EMPTY FIRST.**
   → **`--selftest` validates a tool's LOGIC. It never validates where the tool is POINTED.**
   `valuescan` read a perfect selftest while 14 of its 18 stations sat in the wrong quadrant and
   eleven stood inside solid props. **A passing test is not evidence that the thing it points at is
   right**, and every one of these was caught by an agent **re-deriving something it had been told
   was already true** — never by another check.

   ⚠️ **This line quoted `tools/tmp/sentinel.mjs`'s own count and carried a stale `17/17`** <!-- gatecount: historical -->
   long after it was 32 — one of six counts that went stale in a single session, every one found by
   an agent tripping over it rather than by a check. Counts now live in exactly one place,
   `docs/TOOLS.md`'s gate table, and `node tools/tmp/gatecount.mjs` refuses a second copy in this
   file or that one *even one that agrees* — **when the line NAMES THE SCRIPT PATH.** A count
   sitting next to a bare tool name is invisible to it, deliberately: matching bare names was
   measured on these documents at **3 false positives and 0 true positives**, so the blind spot is
   cheaper than the noise. `gatecount --selftest`'s §G asserts both halves against the real files.

   🚨 **AND THE `gatecount: historical` MARKER ON THE LINE ABOVE WENT INERT FOR A WHILE, WHICH IS
   ITS OWN LESSON ABOUT ANNOTATED EXEMPTIONS.** It was load-bearing when written (`d9788eb`: the
   name was on one line and the `17/17` on the next, inside the two-line window). The paragraph
   then grew, the name drifted **19 lines** away from the count, the scan stopped reaching the
   marker, and it sat there for a session looking like it was doing something — so the next agent
   preserves it, or adds one as a "fix" for a duplicate it never suppressed. Naming the path on the
   marker's own line put it back in the window, and **§G's known-bad now strips the marker from the
   real `CLAUDE.md` and requires a `DUP` to appear** — the arm is red the moment it goes decorative
   again. **An exemption that is not asserted to be doing something is indistinguishable from a
   comment.**

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
   Commit your own files with pathspec form first, or work from a clean tree built the right way ↓

   🚨 **`git archive HEAD` IS THE WRONG CLEAN TREE, and this file recommended it.** It writes a
   directory with **no `.git`** — and **five gates shell out to `git`**, so they die on the missing
   repo rather than on anything real: the battery reported **8 faults where a real worktree reports
   2**. That is a wrong **CAUSE**, not merely a wrong number, and it sends you debugging gates that
   were never broken. The recipe, and both symlinks are load-bearing:

   ```bash
   git worktree add --detach /tmp/fa-clean <sha>
   ln -s "$PWD/node_modules" /tmp/fa-clean/node_modules   # omit this and seven gates die on a
   ln -s "$PWD/reference"    /tmp/fa-clean/reference      # missing import, looking exactly broken
   ```

   `git archive` is still correct for **serving a committed bundle to a browser** — `headserve.mjs`,
   `verify-head.mjs` — because nothing inside those exports runs `git`. It is wrong as *a tree to run
   the battery in*. Pair the worktree with `sx_snap.mjs` (rule 2) to measure on it.

8b. 🚨 **KILL BY PID, NEVER BY PATTERN.** `pkill -f "<toolname>"` matched **two peers' snapshot
   servers** and killed them mid-measurement (2026-08-06; they restarted, so it cost time rather
   than work). This file already banned `pkill -f fa-snap` for exactly this reason and the ban was
   read as being about *that string* rather than about *pattern-killing*. **Every agent runs the same
   tool names**, so any `-f` pattern that matches your process matches theirs. Record the PID when
   you spawn something and kill that. `tools/tmp/snapsweep.mjs` exists because it kills on a
   **derived bound** — nothing younger than the oldest live `with_snapshot` parent — rather than on
   a name.

9. **One owner per file set.** Parallel agents in the same file clobber each other. The hardest
   constraint in this project — it held across ~200 agents with zero clobbering **in the assigned
   source sets**. ⚠️ That qualifier is new and it is not pedantry: the one clobbering on record
   happened in `tools/tmp/`, where nothing is *assigned* at all — see the flat-namespace note below.

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

   🚨 **AND `tools/tmp/` IS ONE FLAT NAMESPACE THAT EVERY AGENT WRITES INTO.** A filename prefix is a
   convention, not a reservation, and nobody is told who holds one. A `Write` to a name a peer had
   already committed **destroyed 1,294 lines of a working tool** — recovered from HEAD, so it cost
   time rather than work, and only because it *was* committed. `??` in `git status` is the only
   signal you get, and it distinguishes untracked from tracked, never yours from a peer's.
   → **`git ls-files tools/tmp` before you claim a prefix, and `Read` before you `Write`.** `Edit`
   refuses to touch a file you have not read; `Write` has no such interlock, which is precisely why
   this happened with `Write` and not with `Edit`.

10. **State a metric's RESOLUTION FLOOR before acting on a change in it.** Known floors: aggregate
    win rate **~9 pp** · pacing **~0.8 s of contact / ~4 pp dead time** · the blind critic **±1.4
    points** · FFA placement **0.978 places** single-phase · seat spread **0.315 places** · main-thread
    JS **±0.71 ms**, from a null arm (`DECISIONS §62`) · draw counts **EXACT**. 🚨 **A floor of *"±1.28–1.76 ms"* circulated for a whole session, was quoted into agent briefs, and DOES NOT EXIST in this repo — it was never measured. Kept here because rule 10 publishing a fabricated floor is the sharpest possible illustration of rule 10.** **Every one of these was discovered AFTER someone had
    already acted inside it** — a whole character programme was steered by score moves of 0.25–1.0, and
    two passes were reported as regressions that never cleared the noise.

    ⚠️ And a **paired per-matchup delta on identical seeds is EXACT** — it is a *different quantity*
    from an aggregate and must be reported separately. `roster_table`'s aggregate once moved 0.8 pp,
    inside the floor, while **58 of 110 individual matchups moved, max 34.4 pp**. Conflating them
    hides exactly that.

    ⚠️ **AND A STANDARD ERROR IS NOT ALWAYS THE RIGHT SCALE — ask what the statistic *is* first.**
    The seat-fairness spread is the **range of six correlated means** measured over one shared set of
    matches; the arms are not independent samples, so the SE of any one mean says nothing about how
    far apart six of them should land by chance. Its floor had to be built by **permuting the seat
    labels** and reading the null range. Reaching for the standard formula because it is the standard
    formula is how a floor gets quoted an order of magnitude too tight.

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

    ⚠️ **Chain edit-then-commit with `&&`, never `;`.** A `;` let a commit run after its edit had
    already failed an assertion, and the message described a change that never landed. The log is a
    primary source here; a commit that lies is worse than one that never happened.

---

## Gates before every commit

```bash
npx tsc --noEmit                          # clean
node src/game/sim.test.mjs
node src/game/economy/economy.test.mjs
node tools/aspect.mjs                     # PASS, 0.00wu — competitive fairness, not a nicety
node tools/verify-head.mjs                # the committed tree builds
node tools/tmp/driver_guard.mjs           # the driver census, + both `bestWeapon` faults
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

⚠️ **"EITHER FILE" IS THE WHOLE OF IT, AND THAT SENTENCE WAS READ AS "ANYWHERE" IN THREE PLACES.**
`gatecount` opens **`CLAUDE.md` and `docs/TOOLS.md`**, nothing else, and inside them it recognises a
copy only on a line carrying the gate's **`.mjs` path** (that line and the next). So a count beside a
bare tool name is invisible, and `docs/STATE.md` is not read at all — which is how it came to hold an
unpoliced gate count *underneath its own sentence saying that could not happen*. The blind spot is
deliberate and was priced before it was accepted: matching bare names measured **16 false positives
for 1 true positive** across these documents, because the house style is to keep old values beside
new ones on purpose, and a guard that cries wolf gets switched off. `gatecount --selftest` §G4/§G5
now assert the limit instead of leaving it to be discovered. **Outside those two files the one-copy
rule is a convention you keep, not a check that keeps you.**

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
| `src/arena/` | Floor, hazards, props, apron, textures, ambient. `shared.ts` is the single source of truth for MAP SCALE and the palette. |
| `src/ui/screens/` | Shell/router, home, character select, trophy road, settings, opening, shop, match. |
| `tools/` | See `docs/TOOLS.md`. |

**Map scale — `src/arena/shared.ts`, and anything in any file that says otherwise is STALE.**
The arena is **2800×2000** (`ARENA_W`/`ARENA_H`), centre **1400,1000**, with **six** spawns; it was
1400×1000 with two until `6631446`, i.e. ×4 the area. `MAX_FIGHTERS` is **6** (`src/game/state.ts`).
The endgame ring **scales with fighter count** — `minSafeRadiusFor(N)` in `rules.ts`, 140 at N≤4 up to
237.00 at N=6 — and `SUDDEN_DEATH_MS` collapses it to zero at **30 s**, which no shipped schedule ever
reaches on its own.

🚨 **STALE MAP LITERALS ARE INVISIBLE TO EVERY LEGALITY CHECK, WHICH IS WHY THEY HID FOR A SESSION.**
The 1× playfield is **exactly the NW quadrant** of the ×4 one, so every stale coordinate is still a
**legal** coordinate — "is this point on the map?" cannot see the class, and neither can `gatecount`,
which checks that a gate's count matches its documented count and has nothing to say about whether the
gate is **pointed anywhere real**. A mis-aimed fixture keeps its count perfectly. Eleven were found one
at a time by accident — four of them green the whole time — and a systematic sweep then found a dozen more.
→ `node tools/tmp/al_guard.mjs` now catches it on three detectors that *do* work — exact 1× scalars,
one-quadrant clustering, and a station standing inside a prop.
⚠️ **Is another resize safe now? Safer, not safe.** Dozens of files hold a hardcoded `2800`/`1985`, so
today's correct literals are the next generation's stale ones. **Derive from `shared.ts`. Never retype
a coordinate.**

**Art direction** — verified against reference plates, and it contradicts the original brief's prose:
Brawl Stars is **not cel-shaded**. Smooth-shaded, hyper-saturated, high-key, vinyl-toy, soft specular,
almost no ink outline. `toonMat` returns `MeshStandardMaterial`. **No filmic tonemapping** (it
desaturates; removed deliberately). ⚠️ **Do not fix anything by desaturating** — falsified four times.

Reference plates live in `reference/images/curated/` — `gameplay_topdown/` for the arena and cast,
`menus/` for the screens (6 plates supplied by Uri).

🚨 **DO NOT TAKE A CHROMA DIRECTION FROM THIS FILE. RUN `arena-scan --baseline` AND READ IT.**
This paragraph has now been wrong TWICE, in opposite directions, and the second time is the
instructive one.

  * `docs/LESSONS.md` §8 said *"adding cool chroma is the cheap lever"*. True once.
  * This file then said **warm chroma FAILS LOW (0.053 vs a 0.072 minimum), cool is OVER** and
    **"warm is the scarce budget today"** — measured 2026-08-06 on the debris pass, and it cited
    **`DECISIONS §73`** as its source.
  * ⚠️ **§73 IS THE SECTION THAT RETIRED IT, AND ITS TITLE SAYS SO: *"THE ARENA'S WARM PROBLEM IS
    FIXED"*.** The old baseline was pinned 61 commits before the ×4 map, so for a day it compared
    a 2800×2000 arena against a 1400×1000 one. Re-baselined: warm chroma **0.0596 FAIL → 0.0823
    PASS**, cool moved *toward* target, **all 11 rails pass — the first time `--gate` fired on
    nothing.** Floor first: four sweeps of one commit spread 0.0002, so the move is 114× the noise.

**So a rule here cited a document that had already reversed it, and the citation is what made it
look verified.** It survived because "warm is scarce" reads like hard-won knowledge — and it was,
for about a day. Found 2026-08-21 by an agent that ran the tool instead of reading this line, after
I had put it into every arena brief of the weekend.

→ **There is no standing chroma direction. The rails move as the arena changes; the tool is the
only source.** ⚠️ And two things that have NOT changed: **do not fix anything by desaturating**
(falsified four times), and a teal-chip palette copied literally from a plate was **rejected on
`arena-scan`** — copying a plate's colours is not the same as passing its rails.

---

## Security constraints — permanent

- **`reference/prototypes/`, `reference/images/` AND `reference/video/`** — ⚠️ **the last was added to
  `.gitignore` only on 2026-08-11 (`e65d255`), after a 4.9 MB phone capture sat committable. Phone
  captures land there, and the next thing this project asks Uri for is a screen recording.**
  All three **are gitignored and must NEVER be committed,
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
- 🚨 **AND IT MUST SAY: VERIFY EVERY CLAIM IN THIS BRIEF AGAINST THE TREE BEFORE ACTING ON IT.**
  The orchestrator — the main conversation — published **six** falsifiable claims in one session and
  **every one was wrong**: an instrument declared "pinned at its ceiling" that had 40 of 110 cells
  unsaturated; `git archive HEAD` as the clean tree, twice; a corpus called empty that was never
  empty (its *default split* had stopped partitioning, because two files split on different colours
  and those colours were equal only while the bug existed); "the rank comes out of the sim's final
  state" when every loser ends bit-identical and the order lives in the **death event stream**; a
  routed patch whose `.filter(Boolean)` silently **dropped fighters**; and two swapped SHAs.
  **Agents caught five of the six, always by re-deriving rather than pasting.** An orchestrator sees
  summaries; the agent is the only one holding the file. **Contradicting the brief is the job, and a
  claim that does not check out is a RESULT — report it.**
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
