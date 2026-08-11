# Start here — the continuation prompt

**Written 2026-08-12, at the end of an unattended overnight session (~204 commits, ~20 agents).**

---

## The one screen

| | |
|---|---|
| **Where it is** | `/Users/uribishansky/claude-code/food-arena`, branch `main`, in sync with origin. |
| **What is deployed** | `https://uri-onceuponyou.github.io/food-arena/` — built from `f5dddb4`. Verified: the whole `src/` diff between that build and HEAD is **comment-only**, so what Uri plays *is* the code. |
| **Play locally** | `node tools/tmp/playtest.mjs` → `http://localhost:4321`. ⚠️ **Never play on `:5173`** — every agent save reloads the page under you. |
| **The single next thing** | 🔴 **Re-score the game.** The only numbers that describe product quality were measured **210 commits and one map-doubling ago**. Everything below is steered by them. See rank 1. |
| **Does Uri have homework?** | **No. Nothing is blocking.** Four items want a one-line answer and **every one has a default already in force.** If he answers none, work still starts. |

> ⚠️ **This file deliberately pins NO `HEAD` SHA.** `docs/STATE.md`'s header pinned one and went a full
> session stale while every gate stayed green — it says so itself, and it is stale again right now.
> Run `git log -1` and believe that.

---

## Paste this

```
Continue work on Food Fight Arena (/Users/uribishansky/claude-code/food-arena).

Read CLAUDE.md first, then docs/STATE.md, then docs/DECISIONS-FOR-URI.md (it opens with a
one-screen answer sheet; §56–§71 are this session's). docs/LESSONS.md and docs/TOOLS.md are
the reference shelf — do not re-derive anything any of them record.

GOAL: match the visual and gameplay quality of Brawl Stars and Zooba. The bar is an
independent blind critic scoring 7+/10 against real reference plates.

════════════════════════════════════════════════════════════════════════════
WHAT IS TRUE THIS MORNING
════════════════════════════════════════════════════════════════════════════

The overnight session was a SYSTEMS session, not a looks session. Shipped and deployed:

  arena       1400x1000 -> 2800x2000, six spawns, 111 props at lower density
  endgame     minSafeRadiusFor(N): 140 at N<=4, 187.42 at N=5, 237.00 at N=6
  sudden      the ring collapses at 30 s; resolveTimeout now fires 0 times in 880
  payouts     a 3-6 seat curve on NORMALISED rank, + XP, and it now REACHES the game
  net         wire codec + delta compression 7.1x, with src/game/ untouched
  phone       draw calls 928 -> 423, main thread -47.9% against a +-0.71 ms floor
  landscape   weapon tray hides 7.92% -> 0.00% of guaranteed-visible arena; clock 13.12% -> 0.49%
  fairness    spawn advantage 2.680 -> 0.342 places of 6; all six seats deal damage 600/600
  roster      range 27.8 -> 9.8 pp, tier spread 16.2 -> 6.1, and NO mechanic was touched
  reach       23 of 23 -> 2 of 23 ranged weapons cannot connect at their own press gate
  result      the card shows placement, real elimination order, and payout chips

NOT ONE OF THOSE IS A LOOKS CHANGE. The last blind-critic reading is arena 5.00 and cast
3.83 against references 8.00-8.50 — and it was taken at 56ccb62, which is 210 commits
before the map doubled. Nobody has ever scored the arena that is deployed.

════════════════════════════════════════════════════════════════════════════
THE RANKED PIPELINE — ranked, with the reason for the rank
════════════════════════════════════════════════════════════════════════════

1. 🔴 RE-MEASURE BEFORE YOU BUILD. Two instruments are pointed at a world that no
   longer exists, and everything below is steered by them:
     * the blind critic last ran at 56ccb62 — 210 commits and a 4x map ago;
     * tools/scan/colour-baseline.json carries provenance sha 36ee0a6, which is 61
       commits BEFORE the map doubled. arena-scan --baseline is comparing today's
       2800x2000 arena against a 1400x1000 one.
   RANKED FIRST because this is "probe before you loop" applied to a whole session, and
   because the standing visual advice may have inverted under it. The recorded finding is
   "the frame is short of THINGS, not short of surface" (featShare ours 15.3-20.7% vs
   reference 24.6-34.9%) — measured on the 1x map, and the 4x map ships MORE props at
   LOWER density. That could have moved either way. Measure it; do not assume it.
   ⚠️ Carry the identical-sheet drift control: byte-identical baseline sheets re-scored
   six hours later read 0.42/0.58 LOWER, which is 1.30σ/1.80σ — suggestive, not
   established. 8 critics per arm would settle it and it is cheap.
   ⚠️ Re-baseline arena-scan with headserve --ref <sha>, and record the sha, as d0f52c2
   did. Do not hand-edit the json.

2. 🔴 SIX-PLAYER HAS NO ENTRY POINT. It is reachable ONLY via ?fighters=, which
   src/game/match.ts:326 documents as QA-ONLY, and matchScreen builds two seats always.
   RANKED SECOND because it is the largest body of shipped, measured, unreachable work in
   the repo: the map seats six, the ring counts to six, the payout curve spans 3-6 seats,
   seat fairness was tuned to 0.342 places OF SIX, and the result card renders six. Every
   one of those numbers describes a mode a player cannot reach.
   It is ~15 lines of wiring behind THREE DESIGN QUESTIONS THAT ARE URI'S (below). Do the
   wiring behind a flag if he has not answered; do not invent the affordance.

3. 🟠 THE SIX-FIGHTER RESULT CARD IS 705 px WIDE AT 430x932, left edge at -138 px — the
   winner's portrait and name are entirely off-screen. RANKED THIRD BECAUSE IT IS CAUSED
   BY ITEM 2: it is pre-existing and unreachable in shipped play today, and it becomes
   ship-blocking the instant item 2 lands. The fix needs a per-fighter wrapper span so
   flex-wrap cannot separate a name from its portrait, and that MOVES THE TWO-SEAT CARD'S
   DOM — so reuse §70's oracle, which already proves two-seat byte-identity 24/24 against
   a detached worktree of the pre-change commit.

4. 🟠 THREE TOOLS BUILT LAST NIGHT WERE NEVER REGISTERED in docs/TOOLS.md's gate table:
   tools/tmp/al_guard.mjs, tools/tmp/n2_geom.mjs, tools/tmp/sx_fog.mjs. RANKED HERE
   BECAUSE OF THE MECHANISM: gatecount reads the gate table and never enumerates
   tools/tmp/, so a tool that was never registered is INVISIBLE to the one check that
   would notice it rotting. al_guard is specifically the guard against the class that hid
   the map change for a whole session. An unregistered guard is a guard that dies quietly.

5. 🟠 n2_geom --ids all --knownbad sort FAILS 3 CHECKS — verified by running it:
   hamburger, egg and waterbottle still report a non-positive head/body gap with the head
   lifted 0.6 m (hamburger -0.131, egg -0.337, waterbottle -0.145). Its header also claims
   coverage its default invocation does not deliver. Real geometry, real failure, no owner.

6. 🟡 hl_sweep's ONE surviving SWAP failure: waterbottle.Cap — 4 pellets at 104.5 wu
   overrun a 130 wu patch. It is a HARNESS COVERAGE defect, not a render defect. Ranked
   low because --replay made re-checking 1 s instead of 2.9 h, so it is cheap whenever,
   and it buys one row.

7. 🟡 taco.ts:949 cites rig.ts:602/630 for the neck arithmetic. Those lines are now an
   interface field and a group declaration. VERIFIED CORRECT TODAY: rig.ts:811 is the
   headH subtraction and rig.ts:838 is the head mount. Comment-only, provably additive,
   crosses no behaviour — the CLAUDE.md rule 9 release valve covers it if you are not the
   owner of taco.ts. Declare it if you take it.

8. ⚪ ic_spec's 24-vs-16 is THE ONE STANDING gatecount FAULT AND IT IS AN ARTIFACT — do
   not "fix" it. Eight of its arms read the gitignored shots/ tree, so it reads one number
   on a working tree and another on a committed one, and the committed one is the
   contract. gatecount measures the committed tree. Confirmed by running both.
   Same shape: x4_shot reports which spawn bays have no station within SPAWN_TAG_WU
   (200 wu) — a coverage note it is designed to print, not a failure.

════════════════════════════════════════════════════════════════════════════
NEEDS URI — four one-line answers, EVERY ONE WITH A DEFAULT ALREADY IN FORCE
════════════════════════════════════════════════════════════════════════════

Nothing here blocks anything. If Uri says nothing, the default holds and work proceeds.

  1. SIX-PLAYER ENTRY POINT (item 2 above). Three questions, none of which code can
     answer: WHERE the affordance lives (there is no mode selector), HOW the other five
     are chosen (there is no matchmaking), WHAT LEVEL five bots are.
     Default in force: it stays behind ?fighters= and no player can reach it.

  2. SUDDEN DEATH'S 30 s TRIGGER — DECISIONS §58 prices three options (a) keep 30 s,
     (b) move it to >= 41.83 s, which all but deletes the phase, (c) lengthen the match.
     Default in force: (a). ⚠️ ESCALATED SINCE §58 WAS WRITTEN: the seat fix made all six
     fighters engage, so sudden death now fires in 90.5% of matches, up from 66.0%. It is
     no longer an edge case — IT IS THE NORMAL ENDING OF A MATCH.

  3. THREE ICON SUBJECTS — boxBurger, stun, wrap. DECISIONS §71 has a one-screen brief
     with 2-3 options each. Default in force: leave all three. ⚠️ AND "LEAVE IT" IS A
     LEGITIMATE ANSWER FOR ALL THREE — every one of them ships immediately beside its own
     text label and is never asked to carry meaning alone.

  4. THE PHONE. docs/PHONE.md §6 lists four captures in priority order: (1) device and
     iOS version, (2) a LANDSCAPE Safari screenshot in a match, (3) a 10-second screen
     recording, (4) add-to-home-screen then screenshot. Nothing needs a cable or a debug
     build. This is the one experiment that turns "-47.9% on desktop Chromium" into a real
     number, because WebKit is not Chromium and that gap could change a conclusion.

════════════════════════════════════════════════════════════════════════════
OPERATIONAL — the things a fresh session actually trips over
════════════════════════════════════════════════════════════════════════════

  * THE SUBAGENT SPAWN CAP IS PER PROCESS, NOT PER CONVERSATION. /clear does NOT reset
    it. A fresh context inherited an exhausted pool and the first fan-out died at 200/200
    before a file was touched. Fix durably with an env block in ~/.claude/settings.json:
    "env": { "CLAUDE_CODE_MAX_SUBAGENTS_PER_SESSION": "800" } — or restart the terminal
    for a fresh counter. Workflow-dispatched agents draw from a DIFFERENT pool.
  * NEVER PLAY ON :5173. Every agent save reloads the page; Uri correctly reported that
    as the game "crashing mid-flight". Use playtest.mjs or the deployed build.
  * MEASURE ON A FROZEN SNAPSHOT, never the shared dev server:
    node tools/tmp/with_snapshot.mjs -- <cmd> --url {URL}   (the placeholder is {URL})
    ⚠️ Never URL=$(node tools/snapshot.mjs --json | ...) — --json does not exit; it hangs.
  * THE CLEAN-TREE METHOD IS git worktree add --detach WITH node_modules AND reference
    SYMLINKED IN. NOT git archive HEAD — five gates shell out to git and die without a
    .git directory, reporting a wrong CAUSE and not merely a wrong number.
  * KILL BY PID, NEVER BY PATTERN. Every agent runs the same tool names, so any pkill -f
    that matches your process matches a peer's. Use tools/tmp/snapsweep.mjs, which kills
    on a derived bound rather than a name.
  * NEVER git stash — including --autostash, which creates one. Commit with pathspec
    form: git commit -F - -- <paths>. Never git commit --amend.
  * ONE OWNER PER FILE SET. It held across ~200 agents with zero clobbering. Pathspec
    protects you from other FILES, not from a second agent in YOUR file.
  * Full runbook and the gate battery: docs/TOOLS.md. The non-negotiables and why each
    one exists: CLAUDE.md. Do not restate either from memory.

════════════════════════════════════════════════════════════════════════════
METHOD — what last night actually taught, and it was one thing
════════════════════════════════════════════════════════════════════════════

SEVEN VACUOUS CONTROLS SHIPPED, AND NOT ONE WAS CAUGHT BY ANOTHER CHECK. Every single one
was found by an agent RE-DERIVING SOMETHING IT HAD BEEN TOLD WAS ALREADY TRUE:

  * a fixture pointing at the wrong prop, and an "axis mirror" mirroring about the OLD
    centre — both green
  * a known-bad placed WHERE THE BUG COULD NOT EXPRESS ITSELF, so both arms passed
  * [].every() returning true after a fix EMPTIED the filtered set — three times, three files
  * a differ blinded to a field that had nothing to drop yet
  * a wrong-base demo INSIDE THE COUNTDOWN, where nothing moves
  * a sentinel written onto a field already holding it
  * a call-site census counting the FUNCTION DECLARATION as a call site, printing ok next
    to an evidence line describing the failure
  * a suite reporting "227 passed, unchanged" straight through a rewrite it could not see
  * two arms of ONE instrument FALSE BY CONSTRUCTION — comparing a rendered frame's LUMA
    against a material's COLOUR. A lit surface reads brighter, so a 0.06 threshold cut
    through one continuous population with rows landing either side by 0.001.

  >> A PASSING TEST IS NOT EVIDENCE THE THING IT POINTS AT IS RIGHT. --selftest validates
  >> a tool's LOGIC, never where the tool is POINTED. valuescan read 105/105 while 14 of
  >> its 18 stations were in the wrong quadrant and eleven were INSIDE SOLID PROPS.

AND THE ORCHESTRATOR — the main conversation — PUBLISHED SIX FALSE CLAIMS, and agents
caught five of them by verifying instead of pasting:
  * "level_lab is pinned at its instrument ceiling" — FALSE, 40 of 110 cells unsaturated
  * "git archive HEAD is the clean tree" — WRONG TREE, recommended twice
  * "hl_sweep's fix emptied its own validator corpus" — FALSE, the DEFAULT SPLIT stopped
    partitioning it, because two quantities were wearing one number
  * "the rank comes out of the sim's final state" — it CANNOT; every loser ends hp:0
    deaths:1 identically, so a final-state resolver degenerates to slot order. The order
    is in the DEATH EVENT STREAM.
  * a routed patch .map(s => roster[s]).filter(Boolean) that SILENTLY DROPS FIGHTERS
  * two swapped SHAs, and a table row that never said what was claimed

  >> TREAT ANY BRIEF YOU ARE GIVEN — INCLUDING THIS ONE — AS A HYPOTHESIS. Verify each
  >> claim against the tree before acting on it, and REPORT WHAT DID NOT CHECK OUT. That
  >> is a result, not a nuisance. Five of six were caught exactly that way.

AND THE ONE-SENTENCE REASON THE MAP CHANGE HID FOR A WHOLE SESSION:

  >> THE 1x PLAYFIELD IS EXACTLY THE NW QUADRANT OF THE 4x ONE, SO EVERY STALE COORDINATE
  >> STAYED LEGAL.

No legality check could have found that class. Eleven were found one at a time by
accident; a systematic sweep then found 12 more at a 0.5% false-positive rate, plus 63
enumerated and frozen. The worst instance: match-play.mjs — THE ONLY "play the whole thing
on screen" TOOL — sent hands 1,077 wu inside the old NW quadrant, read every radius 2.23x
low and every timestamp 4x high. And run on the stale spawn table, x4_layout printed
"EVERY CHECK PASSED" and its selftest 54/54. LEGALITY IS NOT FAIRNESS.
⚠️ Would another resize be safe? "Safer, not safe" — ~30 files now hold a hardcoded
2800/1985, so today's correct literals are the next generation's stale ones.

STANDING RULES THAT KEEP EARNING THEIR PLACE:
  * probe before you loop — NINE for nine: every plateau ever probed here was a BUG
  * an acceptance test proves you moved the thing you NAMED, not that it was the thing.
    Ask what fraction of the frame your metric governs and what is EXCLUDED BY POLICY
    (LESSONS §6b). hi70 moved 4.7 floors past the reference median and the score moved 0.
  * a BASELINE IS ITSELF A MEASUREMENT — see rank 1; comparing against an unvalidated one
    manufactures a regression as convincingly as a real bug
  * ask of every assertion: WHAT IMPLEMENTATION WOULD FAIL THIS? If you cannot name one,
    it is a comment with a tick next to it
  * measure the artefact you SHIP, on the PATH you ship it to
  * a round is n=1 and the critic floor is +-1.4 points

RESOLUTION FLOORS — state one before acting on a change in a metric:
  aggregate win rate ~9 pp · pacing ~0.8 s contact / ~4 pp dead time · blind critic +-1.4
  points · FFA placement 0.978 places single-phase · seat spread 0.315 places (a LABEL
  PERMUTATION, not a standard error — it is the range of six correlated means) ·
  main-thread JS +-1.28-1.76 ms · draw counts EXACT
  ⚠️ A PAIRED PER-MATCHUP DELTA ON IDENTICAL SEEDS IS EXACT, and it is a DIFFERENT
  QUANTITY from an aggregate. roster_table's aggregate once moved 0.8 pp, inside the
  floor, while 58 of 110 individual matchups moved, max 34.4 pp. Report them separately.

════════════════════════════════════════════════════════════════════════════
SECURITY — this repo is PUBLIC
════════════════════════════════════════════════════════════════════════════

reference/ is gitignored and must never be committed, copied into src/, OR DESCRIBED.
Describe a plate's compositional ROLE, never what it depicts. Crop COORDINATES are fine —
they are numbers and they disclose nothing. Breached once on 2026-08-06 and scrubbed.
reference/images/curated/menus/zb_home.png contains Uri's own account details.

He plays at https://uri-onceuponyou.github.io/food-arena/. The three most valuable bug
reports this project has ever had came from him playing it.
```

---

## Notes for whoever pastes it

### What changed since the previous version of this file

The previous version ranked a **floor-plane** pass first and a **pale-blue foreground counter** second.
Both survive as visual work, but they now sit **behind rank 1**, and the reason is not taste:

- **The floor's own mechanism was probed and falsified** (`ac08dbf`). *"No surface detail"* is FALSE —
  `mf` and `lf` land on the reference **median**, and they govern 37–46% of the frame. A normalMap or
  grain would move a quantity that is already where the reference is. The one genuinely out-of-band
  thing is that our ground is a **lattice** (`oriAll` 1.55×, non-overlapping), and `oriAll` has **no
  established link to critic score and no measured resolution floor.**
- **`featShare` says the frame is short of THINGS, not short of surface** — and the ×4 map changed prop
  count and density underneath that measurement. Re-measure before spending the pass.

### Claims from the session brief that did NOT check out

- **"~298 commits."** Counted three ways: **166** on 2026-08-11, **204** since 2026-08-10 12:00, and
  **259** since the previous version of this file was committed (`4a4643b`). None is ~298. This file's
  header says ~204 and names the window it counts.
- **"HEAD is `07c5294`."** True when the brief was written; HEAD advanced to `a5578e9` **while this file
  was being written**, because peers were still committing. This is exactly why the block pins no SHA.
- **"`sx_fog`'s hub-ring spawn bay has no screenshot station within 200 wu."** Wrong tool. The
  spawn-bay coverage report is **`tools/tmp/x4_shot.mjs`** (`SPAWN_TAG_WU = 200`, the block at line 171).
  `sx_fog` has three stations — centre, mid, corner — and **passes 2/2**, verified by running it.
- **"`taco.ts:949` cites `rig.ts:602/630`, now 798/825."** The stale citation is real, but **798/825 is
  also wrong.** Verified today: `rig.ts:811` is the `headH` subtraction and `rig.ts:838` is the head
  mount. 798 is the opening line of the explanatory comment, not the arithmetic.
- **"gates 12 faults → 1"** and **STATE.md's "0 faults"** are *both* right and they disagree because
  they were run on **different trees**. `ic_spec` reads the gitignored `shots/` tree, so a working tree
  and a committed worktree give different answers. Confirmed by running `gatecount` here. Do not
  reconcile them by editing a number.

### Two things a fresh session would still be missing

1. **`docs/STATE.md`'s "🔴 Live for the next session" list is stale in two rows** — it says the result
   card is still slot-ordered with no payout (finished in `7743f08`/`e60117d`, §70) and that
   `x4_layout.mjs:SPAWN_NORTH` is an unfixed time bomb (fixed in `c469da2`; the guard **inverted** from
   asserting divergence to asserting agreement). Its header SHA is also 14 commits behind. STATE.md
   documents that exact failure mode about itself; it has recurred.
2. **`tools/scan/colour-baseline.json` is stale again** — provenance `36ee0a6`, **61 commits before the
   map doubled**. `d0f52c2` re-baselined it six days late and wrote up why a permanently-firing gate
   gets switched off. Nothing checks the baseline's age, so it will keep happening. That is rank 1's
   second half and it is the cheapest half.
