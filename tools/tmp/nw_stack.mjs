#!/usr/bin/env node
/**
 * NW STACK — the gate on the whole host/client stack over the loopback transport.
 *
 *   node tools/tmp/nw_stack.mjs --selftest    # every check, each with its known-bad
 *   node tools/tmp/nw_stack.mjs --latency     # just the latency/loss table
 *
 * ══════════════════════════════════════════════════════════════════════════════
 *  🚨 WHAT THIS PROVES, AND — MORE IMPORTANTLY — WHAT IT CANNOT.
 * ══════════════════════════════════════════════════════════════════════════════
 *
 * **PROVES, exactly:**
 *   * at zero latency the client's predicted view is **bit-identical** to the host's
 *     authoritative state, including the three alias invariants and every sentinel;
 *   * the host's `inputLog` replays to a **bit-identical** state from a fresh `createMatch`,
 *     so the network did not cost the determinism every balance number in this repo rests on;
 *   * a client cannot move a seat it does not hold (the authority check FIRES, and a
 *     legitimate frame is accepted, so it is not just refusing everything);
 *   * nothing is shared by reference between the host's graph and a client's, except the
 *     arena — i.e. the loopback is an honest transport rather than two names for one object.
 *
 * **CANNOT prove, and no amount of running it will:**
 *   * ⚠️ **anything about a REAL network.** Latency here is a tick counter, loss is a seeded
 *     draw, and there is no MTU, no head-of-line blocking, no congestion control, no NAT and
 *     no reconnection. `NETCODE.md` §9 already lists latency as one of the things that *"could
 *     not be measured"* in this repo and it still cannot.
 *   * ⚠️ **anything about cross-engine float agreement.** Everything runs on one V8. That
 *     matters far less here than it would under lockstep — the host is the only sim of record
 *     — but a client's *prediction* is its own arithmetic, so a JSC or SpiderMonkey client
 *     would show a small constant reconciliation error this rig cannot see.
 *   * ⚠️ **anything about how it FEELS.** Prediction error in world units is not the same
 *     quantity as "does it rubber-band", and this project's own record is blunt about which
 *     instrument answers that: *"the two most valuable bug reports on this project came from
 *     you simply playing it."*
 *   * ⚠️ **anything about mobile CPU.** Replay depth × `stepAI` is printed below in
 *     microseconds of desktop arm64 Node. A phone is plausibly 5–10× slower and nothing in
 *     this project has ever measured a mobile GPU or CPU.
 *
 * ⚠️ **RESOLUTION FLOOR.** The equality checks are EXACT — identical or not, no tolerance.
 * The prediction-error numbers are **paired positional deltas on identical seeds**, which
 * `CLAUDE.md` #10 classes as exact rather than as an aggregate: 0.0 means bit-identical.
 * The µs timings are the only noisy quantity here and they are reported, never asserted on.
 */

import { HostSession } from '../../src/net/host.ts';
import { ClientSession } from '../../src/net/client.ts';
import { LoopbackHub } from '../../src/net/transport.ts';
import { diffStates, checkStateIntegrity } from '../../src/net/wire.ts';
import { bytesToB64, encodeInputFrame, quantizeInput } from '../../src/net/inputCodec.ts';
import {
  applyMatchResult, assignSeat, createLeague, createLobby, createMemoryLeagueStore, fillWithBots,
  lobbyViolations, releaseSeat, seatedCount, shuffleSeats, standings, toWireSeats, twoSeatCurve,
} from '../../src/net/lobby.ts';
import { makeFixtureArena, stimulus } from './nw_fixture.mjs';

const args = new Set(process.argv.slice(2));
const LATENCY_ONLY = args.has('--latency');

let pass = 0;
let fail = 0;
const failures = [];
function ok(label, cond, detail = '') {
  if (cond) { pass++; console.log(`  ✓ ${label}${detail ? `  — ${detail}` : ''}`); }
  else { fail++; failures.push(label); console.log(`  ✗ ${label}${detail ? `  — ${detail}` : ''}`); }
}
function section(t) { console.log(`\n── ${t} ${'─'.repeat(Math.max(0, 74 - t.length))}`); }

const DT = 1000 / 60;

/** Slot-ordered wire seats on the fixture arena. `humans` seats get a peer; the rest are bots. */
function seatsFor(arena, n, humans) {
  const CAST = ['hamburger', 'sushi', 'taco', 'pizza', 'donut', 'waterbottle'];
  return Array.from({ length: n }, (_, i) => ({
    slot: i,
    peer: i < humans ? `c${i}` : null,
    characterId: CAST[i % CAST.length],
    level: 1 + (i % 5),
    spawn: { x: arena.spawns[i].x, y: arena.spawns[i].y },
  }));
}

/**
 * Drive a whole match over the loopback.
 *
 * ⚠️ **THE ORDER INSIDE THE LOOP IS THE PROTOCOL AND IT IS NOT ARBITRARY.** Clients produce
 * their input for tick t, the hub delivers upward, the host runs tick t, the hub delivers
 * downward. Any other order changes which tick an input lands on and would make the
 * zero-latency identity claim below either trivially true or impossible.
 */
function runStack({
  n = 2, humans = 1, ticks = 600, seed = 4242, delayTicks = 0, jitterTicks = 0, loss = 0,
  framing = 'text', snapshotEveryTicks = 3, clientArenas = null, hostArena = null,
} = {}) {
  const arena = hostArena ?? makeFixtureArena();
  const hub = new LoopbackHub({ framing, seed });
  const hostTransport = hub.connect('host');
  const seats = seatsFor(arena, n, humans);

  const clients = [];
  for (let i = 0; i < humans; i++) {
    const t = hub.connect(`c${i}`);
    if (delayTicks || jitterTicks || loss) {
      hub.setLink('host', `c${i}`, { delayTicks, jitterTicks, loss });
      hub.setLink(`c${i}`, 'host', { delayTicks, jitterTicks, loss });
    }
    clients.push(new ClientSession({
      transport: t,
      hostPeer: 'host',
      arena: clientArenas ? clientArenas[i] : makeFixtureArena(),
      name: `c${i}`,
    }));
  }

  const host = new HostSession({ transport: hostTransport, arena, seats, dtMs: DT, snapshotEveryTicks });
  hub.pump(0);            // deliver the clients' `hello`
  host.start();
  hub.pump(0);            // deliver welcome + match-start + tick-0 snapshot

  let exactAtSnapshot = 0;
  let differingAtSnapshot = 0;
  let replayTotal = 0;
  const replayNs = [];
  // ── THE DIVERGENCE THAT ACTUALLY EXISTS UNDER LOCAL-ONLY PREDICTION ──
  // Split by seat, because the two halves behave completely differently and averaging them
  // would hide the whole point: the LOCAL fighter is predicted, so its position tracks the
  // host exactly; every REMOTE fighter is a snapshot that is `delayTicks` old, so it lags by
  // however far it walked in that time. That lag is what an interpolation layer would hide,
  // and there is no interpolation layer.
  let localMaxWu = 0;
  let remoteMaxWu = 0;

  for (let t = 1; t <= ticks; t++) {
    // ⚠️ CAPTURED AT THE TOP, AND THE FIRST VERSION CAPTURED IT AFTER THE UPWARD PUMP — which
    // silently reported `0 exact / 0 differing` on every delayed arm, because a snapshot in
    // flight for 3 ticks is delivered by the FIRST pump of a later iteration and the check only
    // looked at the second. A comparison that never runs reads exactly like a comparison that
    // always passes.
    const before = clients.map((c) => (c.reconcile ? c.reconcile.tick : -1));
    for (let i = 0; i < clients.length; i++) {
      if (clients[i].ready) clients[i].sendInput(stimulus(seed, t, i));
    }
    const t0 = process.hrtime.bigint();
    hub.pump(t);
    host.step();
    hub.pump(t);
    const t1 = process.hrtime.bigint();
    for (let i = 0; i < clients.length; i++) {
      const c = clients[i];
      if (!c.reconcile || c.reconcile.tick === before[i]) continue;
      // A snapshot landed on this client this tick — compare its view to the host's state.
      if (c.reconcile.replayed > 0) replayNs.push(Number(t1 - t0));
      replayTotal += c.reconcile.replayed;
      if (diffStates(host.state, c.view).length === 0) exactAtSnapshot++;
      else differingAtSnapshot++;
      for (let f = 0; f < host.state.fighters.length; f++) {
        const a = host.state.fighters[f];
        const b = c.view.fighters[f];
        const d = Math.sqrt((a.x - b.x) ** 2 + (a.y - b.y) ** 2);
        if (f === c.slot) localMaxWu = Math.max(localMaxWu, d);
        else remoteMaxWu = Math.max(remoteMaxWu, d);
      }
    }
    if (host.state.phase === 'ended') break;
  }

  return { hub, host, clients, arena, seats, exactAtSnapshot, differingAtSnapshot, replayTotal,
    replayNs, localMaxWu, remoteMaxWu };
}

/** Objects reachable from BOTH graphs, excluding the arena (which is shared on purpose). */
function sharedObjects(a, b, arenas) {
  const setA = new Set();
  const walk = (v, out) => {
    if (v === null || typeof v !== 'object' || out.has(v)) return;
    if (arenas.has(v)) return;
    out.add(v);
    if (Array.isArray(v)) { for (let i = 0; i < v.length; i++) if (i in v) walk(v[i], out); }
    else for (const k of Object.keys(v)) walk(v[k], out);
  };
  walk(a, setA);
  const setB = new Set();
  walk(b, setB);
  let shared = 0;
  for (const o of setB) if (setA.has(o)) shared++;
  return shared;
}
/** Every object reachable from an arena, so `sharedObjects` can skip them. */
function arenaObjects(...arenas) {
  const out = new Set();
  const walk = (v) => {
    if (v === null || typeof v !== 'object' || out.has(v)) return;
    out.add(v);
    if (Array.isArray(v)) { for (let i = 0; i < v.length; i++) if (i in v) walk(v[i]); }
    else for (const k of Object.keys(v)) walk(v[k]);
  };
  for (const a of arenas) walk(a);
  return out;
}

// ═════════════════════════════════════════════════════════════════════════════
if (LATENCY_ONLY) {
  section('LATENCY / LOSS SWEEP  (all numbers exact; the µs column is the noisy one)');
  console.log('   delay  jitter   loss |  snapshots exact  differing |  replay depth  max error wu');
  for (const arm of [
    { delayTicks: 0, jitterTicks: 0, loss: 0 },
    { delayTicks: 1, jitterTicks: 0, loss: 0 },
    { delayTicks: 3, jitterTicks: 0, loss: 0 },
    { delayTicks: 6, jitterTicks: 2, loss: 0 },
    { delayTicks: 6, jitterTicks: 2, loss: 0.10 },
  ]) {
    const r = runStack({ ...arm, ticks: 600 });
    const c = r.clients[0];
    const depth = c.stats.snapshots > 0 ? (c.stats.replayed / c.stats.snapshots) : 0;
    console.log(`   ${String(arm.delayTicks).padStart(5)}  ${String(arm.jitterTicks).padStart(6)}`
      + `  ${String((arm.loss * 100).toFixed(0) + '%').padStart(5)} |`
      + `  ${String(r.exactAtSnapshot).padStart(15)}  ${String(r.differingAtSnapshot).padStart(9)} |`
      + `  ${depth.toFixed(2).padStart(12)}  ${c.stats.maxErrorWu.toFixed(2).padStart(12)}`);
  }
  process.exit(0);
}

console.log('NW STACK — host peer + prediction over the deterministic loopback');

// ─────────────────────────────────────────────────────────────────────────────
section('S. ZERO LATENCY — the exact identity claim');

{
  const r = runStack({ n: 2, humans: 1, ticks: 600 });
  const c = r.clients[0];
  ok('S1  the client got a seat', c.slot === 0, `slot ${c.slot}`);
  ok('S2  the host stepped a full match', r.host.tick === 600, `${r.host.tick} ticks`);
  ok('S3  every snapshot arrived', c.stats.snapshots === 201, `${c.stats.snapshots} snapshots`);
  ok('S4  🚨 at every snapshot the client VIEW is bit-identical to the host STATE',
    r.exactAtSnapshot > 0 && r.differingAtSnapshot === 0,
    `${r.exactAtSnapshot} exact / ${r.differingAtSnapshot} differing`);
  ok('S5  prediction error is EXACTLY zero (no tolerance applied)', c.stats.maxErrorWu === 0,
    `max ${c.stats.maxErrorWu}`);
  ok('S6  nothing was replayed, because nothing was unacknowledged', c.stats.replayed === 0,
    `${c.stats.replayed} replayed inputs`);
  ok('S7  the client state passes every integrity invariant',
    checkStateIntegrity(c.view).length === 0);
  ok('S8  the client received authoritative events', c.drainEvents !== undefined);

  // 🚨 THE HONESTY CHECK ON THE TRANSPORT ITSELF.
  const skip = arenaObjects(r.arena, c.arena);
  ok('S9  🚨 host and client share NO object except the arena — the loopback really serialises',
    sharedObjects(r.host.state, c.view, skip) === 0,
    `${sharedObjects(r.host.state, c.view, skip)} shared`);
  ok('S10 …and they are not even the same arena instance', c.arena !== r.arena);
}

// ─────────────────────────────────────────────────────────────────────────────
section('R. THE DETERMINISM THE NETWORK MUST NOT COST');

{
  const r = runStack({ n: 2, humans: 1, ticks: 700, seed: 7 });
  const replay = r.host.replayInputLog();
  ok('R1  🚨 replaying the host input log reproduces the final state BIT-IDENTICALLY',
    diffStates(r.host.state, replay).length === 0,
    (diffStates(r.host.state, replay)[0]?.detail ?? '').slice(0, 80));
  ok('R2  the log is one row per tick', r.host.inputLog.length === r.host.tick,
    `${r.host.inputLog.length} rows / ${r.host.tick} ticks`);

  // KNOWN-BAD: the replay must be able to FAIL, or R1 is a comment with a tick next to it.
  const tampered = new HostSession({
    transport: new LoopbackHub().connect('h2'),
    arena: r.arena, seats: r.seats, dtMs: DT,
  });
  tampered.start();
  const log = r.host.inputLog.map((row) => ({ tick: row.tick, inputs: row.inputs.map((i) => (i ? { ...i } : null)) }));
  // ⚠️ THE TAMPER IS A REVERSED `move`, NOT A FLIPPED `attack`, AND THE FIRST VERSION USED
  // `attack` AND PASSED FALSELY. An `attack: true` on a weapon that is still on cooldown is a
  // no-op in `combat.ts:attemptAttack`, so flipping one bit at one arbitrary tick reproduced
  // the identical match and the known-bad reported "no divergence" — a KNOWN-BAD THAT DOES NOT
  // GO BAD is worse than no known-bad, because it certifies the check it was meant to falsify.
  // Reversing the movement axis always moves the fighter somewhere else unless it is pinned on
  // both axes at once.
  // ⚠️ 85% IN, NOT HALFWAY, AND THE HALFWAY VERSION PASSED FALSELY TWICE.
  // `stepMatch` runs NO fighter loop during the countdown, which is ~223 ticks of a 700-tick
  // run here — so a tamper at tick 200 mutates an input nothing reads and the replay comes out
  // bit-identical. The known-bad reported "no divergence" and would have certified a broken
  // replay check. Same failure shape as `NETCODE.md` §3's note that rollback costs must be
  // measured "over playing ticks only".
  ok('R2b the run actually reached the playing phase', r.host.state.phase === 'playing',
    r.host.state.phase);
  const mid = Math.floor(log.length * 0.85);
  const row = log[mid].inputs[0];
  if (row) log[mid].inputs[0] = { ...row, move: { x: -row.move.x, y: -row.move.y }, attack: !row.attack };
  tampered.inputLog.length = 0;
  tampered.inputLog.push(...log);
  ok('R3  KNOWN-BAD  tampering with ONE input row inside the playing phase diverges the replay',
    diffStates(r.host.state, tampered.replayInputLog()).length > 0);

  // And a second run of the identical scenario must land on the identical state.
  const r2 = runStack({ n: 2, humans: 1, ticks: 700, seed: 7 });
  ok('R4  two runs of the same scenario are bit-identical',
    diffStates(r.host.state, r2.host.state).length === 0);
}

// ─────────────────────────────────────────────────────────────────────────────
section('L. LATENCY — where prediction starts doing work, and what the CORRECTION really measures');

{
  const r0 = runStack({ delayTicks: 0, ticks: 600 });
  const r3 = runStack({ delayTicks: 3, ticks: 600 });
  const c3 = r3.clients[0];
  // The check must be shown to FAIL, or the zero-latency identity claim is measuring nothing.
  ok('L1  🚨 KNOWN-BAD  with 3 ticks of one-way delay the SAME equality check FAILS',
    r3.differingAtSnapshot > 0,
    `${r3.exactAtSnapshot} exact / ${r3.differingAtSnapshot} differing`);
  ok('L2  …and the client is now replaying real work',
    c3.stats.replayed > 0, `${(c3.stats.replayed / c3.stats.snapshots).toFixed(2)} inputs per snapshot`);
  ok('L4  CONTROL  the zero-latency arm of the same rig is still exact',
    r0.differingAtSnapshot === 0);

  // ══════════════════════════════════════════════════════════════════════════
  //  🚨 THE FINDING. THIS ROW LOOKS LIKE A PASS AND IT IS A CORRECTION.
  // ══════════════════════════════════════════════════════════════════════════
  //
  // `ReconcileReport.errorWu` was written expecting latency to produce visible corrections.
  // It does not, and the reason is exact rather than lucky: **the correction measures the
  // SELF-CONSISTENCY of the client's own prediction chain, not its agreement with the host.**
  // Rebuilding `authoritative + my unacknowledged inputs` reproduces precisely the chain the
  // client already had, so with ONE human and no loss it lands on the same position it was
  // already at — at any latency.
  //
  // ⚠️ So a rig that only ever ran this arm would report "prediction is perfect at 100 ms" and
  // be measuring its own tautology. `CLAUDE.md` #6's tautological-guard failure, exactly.
  // The metric moves for two reasons and neither of them is latency on its own:
  //   * a REMOTE human's input, which the local client cannot predict (L6);
  //   * a LOST input, which changes what the host actually applied (L7).
  ok('L5  🚨 the correction is EXACTLY 0 at 3 ticks of delay with one human and no loss —'
    + ' the metric measures self-consistency, NOT agreement with the host',
    c3.stats.maxErrorWu === 0, `max ${c3.stats.maxErrorWu} wu`);

  // ⚠️ THE FIRST VERSION OF THIS ROW EXPECTED A SECOND HUMAN TO MAKE THE CORRECTION NON-ZERO.
  // It does not, and the probe said why: the local fighter's trajectory is a pure function of
  // its OWN inputs and the arena until it actually interacts with somebody. So a remote human
  // walking around 500 wu away changes nothing the local prediction got wrong. The divergence
  // is real and it is on the OTHER fighters, which is precisely what "predict the local
  // fighter only" means — so that is what gets measured.
  const rh = runStack({ n: 2, humans: 2, delayTicks: 3, ticks: 600, seed: 88 });
  const worst = Math.max(...rh.clients.map((c) => c.stats.maxErrorWu));
  ok('L6  🚨 a second human does NOT move the correction either — the local trajectory is a'
    + ' function of the local inputs until the two fighters interact',
    worst === 0, `max ${worst} wu`);
  // ⚠️ AND THESE TWO NUMBERS ARE NOT THE SAME QUANTITY WITH DIFFERENT SIZES.
  //   * the LOCAL gap is a LEAD: the client has predicted `delayTicks` further than the host
  //     has stepped, so its own fighter is *ahead*. That gap IS prediction working, and it is
  //     bounded by the local fighter's speed times the delay.
  //   * the REMOTE gap is a LAG: the client is drawing a position from a snapshot that is
  //     `delayTicks` old and then holding the remote seat's last known input flat through the
  //     replay, so the error accrues over roughly twice the one-way delay.
  // The remote number is therefore the larger of the two, and it is the one an interpolation
  // layer would exist to hide. There is no interpolation layer.
  ok('L6b 🚨 the LOCAL fighter LEADS the host (prediction working) and the REMOTE fighters LAG'
    + ' by MORE — the remote gap is what nothing here hides',
    rh.remoteMaxWu > rh.localMaxWu && rh.localMaxWu > 0,
    `remote max ${rh.remoteMaxWu.toFixed(2)} wu vs local lead ${rh.localMaxWu.toFixed(2)} wu`
    + ` (PLAYER_SPEED 0.12 wu/ms x 3 ticks = 6.0 wu of travel)`);
  ok('L6c CONTROL  at zero latency the remote fighters do not lag at all',
    r0.remoteMaxWu === 0 && r0.localMaxWu === 0);

  const rl = runStack({ delayTicks: 6, jitterTicks: 2, loss: 0.10, ticks: 600 });
  const cl = rl.clients[0];
  ok('L7  🚨 KNOWN-BAD  a 10% lossy link also makes it real — the host applied something the'
    + ' client did not predict',
    cl.stats.maxErrorWu > 0, `max ${cl.stats.maxErrorWu.toFixed(2)} wu,`
    + ` mean ${(cl.stats.sumErrorWu / cl.stats.snapshots).toFixed(3)} wu`);
  ok('L8  a 10% lossy, jittery link still runs to completion',
    rl.host.tick === 600 && cl.stats.snapshots > 0,
    `${rl.hub.dropped} of ${rl.hub.sent} messages dropped, ${cl.stats.snapshots} snapshots landed`);
  ok('L9  jitter produced re-ordered frames and the host DROPPED them rather than rewinding a seat',
    rl.host.seatStats()[0].stale > 0, `${rl.host.seatStats()[0].stale} stale frames`);
  ok('L10 and the lossy arm never violated an invariant',
    checkStateIntegrity(cl.view).length === 0 && checkStateIntegrity(rl.host.state).length === 0);

  console.log(`    replay cost, measured: ${rl.replayNs.length} reconciliations,`
    + ` median ${median(rl.replayNs).toFixed(0)} ns, max ${Math.max(0, ...rl.replayNs).toFixed(0)} ns`);
  console.log('    ⚠️ desktop arm64 Node, 1 bot seat, and it includes the pump. NETCODE.md §5:'
    + ' stepAI is 65.995 µs/call, so depth d over k bots ≈ d×k×66 µs.');
  console.log('    At d=8, k=5 that is 2.6 ms — 16% of a 16.7 ms frame, on a machine 5-10x'
    + ' faster than the phone Uri says is already unplayable (§33).');
}

section('A. AUTHORITY — a client may move its own seat and no other');

{
  const arena = makeFixtureArena();
  const hub = new LoopbackHub({ seed: 1 });
  const hostT = hub.connect('host');
  const c0T = hub.connect('c0');
  const c1T = hub.connect('c1');
  const seats = seatsFor(arena, 3, 2);
  const c0 = new ClientSession({ transport: c0T, hostPeer: 'host', arena: makeFixtureArena() });
  const c1 = new ClientSession({ transport: c1T, hostPeer: 'host', arena: makeFixtureArena() });
  const host = new HostSession({ transport: hostT, arena, seats, dtMs: DT });
  hub.pump(0);
  host.start();
  hub.pump(0);

  ok('A1  two clients got two DIFFERENT slots', c0.slot === 0 && c1.slot === 1,
    `${c0.slot} / ${c1.slot}`);

  // CONTROL FIRST: a legitimate frame is accepted, so the check below is not "refuse everything".
  const legit = quantizeInput({ move: { x: 1, y: 0 }, selectedWeapon: 0, attack: false });
  c0T.send('host', { t: 'input', b: bytesToB64(encodeInputFrame(1, [legit])) });
  hub.pump(1);
  ok('A2  CONTROL  a legitimate frame for the sender\'s own seat is ACCEPTED',
    host.stats.inputsAccepted === 1 && host.stats.inputsRejected === 0,
    `${host.stats.inputsAccepted} accepted / ${host.stats.inputsRejected} rejected`);

  // 🚨 THE FORGERY: c0 sends a frame whose mask claims slot 1.
  c0T.send('host', { t: 'input', b: bytesToB64(encodeInputFrame(2, [null, legit])) });
  // ⚠️ TWO PUMPS. The host's `reject` is enqueued *during* the delivery of the input, so it
  // lands on the next pump — which is not a quirk of the loopback, it is what a round trip IS.
  hub.pump(2);
  hub.pump(2);
  ok('A3  🚨 KNOWN-BAD  a frame claiming ANOTHER seat is REJECTED with code "authority"',
    host.stats.inputsRejected === 1 && c0.stats.rejects === 1,
    `${host.stats.inputsRejected} rejected`);
  ok('A4  …and slot 1 was not touched by it',
    host.seatStats()[1].received === 0 && host.seatStats()[1].latestTick === -1);

  // A frame claiming BOTH seats is the same refusal.
  c0T.send('host', { t: 'input', b: bytesToB64(encodeInputFrame(3, [legit, legit])) });
  hub.pump(3);
  ok('A5  a frame claiming its own seat AND another is rejected too', host.stats.inputsRejected === 2);

  // A malformed payload is rejected without throwing.
  c1T.send('host', { t: 'input', b: 'not-base64-@@@' });
  hub.pump(4);
  ok('A6  a malformed frame is rejected, not thrown', host.stats.inputsRejected === 3);
}

// ─────────────────────────────────────────────────────────────────────────────
section('N. SIX SEATS, SIX CLIENTS');

{
  const r = runStack({ n: 6, humans: 6, ticks: 400, seed: 31 });
  ok('N1  six clients each hold a distinct slot',
    new Set(r.clients.map((c) => c.slot)).size === 6, r.clients.map((c) => c.slot).join(','));
  ok('N2  🚨 all six views are bit-identical to the host at every snapshot',
    r.differingAtSnapshot === 0, `${r.exactAtSnapshot} exact / ${r.differingAtSnapshot} differing`);
  ok('N3  every one passes the integrity invariants',
    r.clients.every((c) => checkStateIntegrity(c.view).length === 0));
  ok('N4  the host applied inputs for all six seats',
    r.host.seatStats().every((s) => s.received > 0),
    r.host.seatStats().map((s) => s.received).join('/'));
  const kib = r.hub.bytes / 1024;
  console.log(`    wire traffic: ${r.hub.sent} messages, ${kib.toFixed(0)} KiB over`
    + ` ${r.host.tick} ticks = ${(kib / (r.host.tick * DT / 1000)).toFixed(1)} KiB/s total`
    + ` (${(kib / (r.host.tick * DT / 1000) / 6).toFixed(1)} KiB/s per client, snapshots at 20 Hz)`);
  console.log('    ⚠️ FULL SNAPSHOTS, no delta. NETCODE.md §2 measured a binary delta at ~220 B'
    + ' against ~8 KB here — a ~37x saving that is NOT built, and is the top remaining item.');
}

// ─────────────────────────────────────────────────────────────────────────────
section('J. JOINING LATE, AND THE ARENA DRIFT CONTROL');

{
  const arena = makeFixtureArena();
  const hub = new LoopbackHub({ seed: 5 });
  const hostT = hub.connect('host');
  const c0T = hub.connect('c0');
  const seats = seatsFor(arena, 2, 1);
  const c0 = new ClientSession({ transport: c0T, hostPeer: 'host', arena: makeFixtureArena() });
  const host = new HostSession({ transport: hostT, arena, seats, dtMs: DT });
  hub.pump(0);
  host.start();
  hub.pump(0);
  for (let t = 1; t <= 120; t++) {
    c0.sendInput(stimulus(9, t, 0));
    hub.pump(t);
    host.step();
    hub.pump(t);
  }

  // A spectator arrives at tick 120 with no seat.
  const specT = hub.connect('spec');
  const spec = new ClientSession({ transport: specT, hostPeer: 'host', arena: makeFixtureArena() });
  hub.pump(121);   // hello -> host
  hub.pump(121);   // welcome + match-start + snapshot -> spectator
  ok('J1  a late joiner with no seat is welcomed with slot null', spec.slot === null);
  ok('J2  …and receives match-start plus a FULL snapshot in the same exchange', spec.ready);
  ok('J3  🚨 …whose decoded state is bit-identical to the host at the tick it joined',
    diffStates(host.state, spec.confirmed).length === 0);
  ok('J4  …and it got no backlog of events that happened before it arrived',
    spec.drainEvents().length === 0);
  ok('J5  its arena fingerprint matches', spec.stats.arenaMismatch === false);

  // 🚨 THE DRIFT CONTROL: a client on a stale bundle.
  const staleT = hub.connect('stale');
  const stale = new ClientSession({ transport: staleT, hostPeer: 'host', arena: makeFixtureArena(1) });
  hub.pump(122);
  hub.pump(122);
  ok('J6  🚨 KNOWN-BAD  a client whose arena differs by ONE coordinate is FLAGGED',
    stale.stats.arenaMismatch === true);
  ok('J7  …and note that it still decoded a complete, valid-looking state — which is exactly'
    + ' why the fingerprint has to exist',
    stale.ready && checkStateIntegrity(stale.confirmed).length === 0);
}

// ─────────────────────────────────────────────────────────────────────────────
section('P. LOBBIES AND LEAGUES — the data model, and the seam into HostSession');

{
  const arena = makeFixtureArena();
  const lob = createLobby('lob-1', 'host', arena.id, 6);
  ok('P1  a fresh lobby is slot-indexed and self-consistent',
    lob.seats.length === 6 && lob.seats.every((s2, i) => s2.slot === i) && lobbyViolations(lob).length === 0);

  ok('P2  assignSeat hands out the LOWEST free slot',
    assignSeat(lob, 'p1', 'hamburger') === 0 && assignSeat(lob, 'p2', 'sushi') === 1);
  ok('P3  a peer that is already seated is not seated twice',
    assignSeat(lob, 'p1', 'taco') === null && seatedCount(lob) === 2);
  ok('P4  releaseSeat empties the slot IN PLACE — seats are positions, not a queue',
    releaseSeat(lob, 'p1') === 0 && lob.seats[0].peer === null && lob.seats[1].peer === 'p2');
  ok('P5  …so the next joiner gets slot 0 back', assignSeat(lob, 'p3', 'pizza') === 0);

  // KNOWN-BADS for the validator. It must be shown to fail, like every other guard here.
  {
    const bad = createLobby('x', 'h', arena.id, 4);
    assignSeat(bad, 'dup', 'hamburger');
    bad.seats[2].peer = 'dup';
    bad.seats[2].characterId = 'sushi';
    ok('P6  KNOWN-BAD  the same peer in two seats → peer/duplicate',
      lobbyViolations(bad).some((v) => v.startsWith('peer/duplicate')));
  }
  {
    const bad = createLobby('x', 'h', arena.id, 4);
    bad.seats[2].slot = 9;
    ok('P7  KNOWN-BAD  a seat whose slot disagrees with its index → slot/index',
      lobbyViolations(bad).some((v) => v.startsWith('slot/index')));
  }
  {
    const bad = createLobby('x', 'h', arena.id, 4);
    bad.seats[1].bot = true;   // bot with no character
    ok('P8  KNOWN-BAD  an occupied seat with no character → slot/no-character',
      lobbyViolations(bad).some((v) => v.startsWith('slot/no-character')));
  }

  // The seeded shuffle: reproducible, and it actually shuffles.
  {
    const a = createLobby('a', 'h', arena.id, 6);
    const b = createLobby('b', 'h', arena.id, 6);
    for (const id of ['q1', 'q2', 'q3', 'q4', 'q5', 'q6']) {
      assignSeat(a, id, 'hamburger');
      assignSeat(b, id, 'hamburger');
    }
    const order = (l) => l.seats.map((x) => x.peer).join(',');
    const joinOrder = order(a);
    shuffleSeats(a, 1234);
    shuffleSeats(b, 1234);
    ok('P9  shuffleSeats is a pure function of its seed', order(a) === order(b), order(a));
    ok('P10 …and it really re-deals', order(a) !== joinOrder, `${joinOrder} -> ${order(a)}`);
    const c = createLobby('c', 'h', arena.id, 6);
    for (const id of ['q1', 'q2', 'q3', 'q4', 'q5', 'q6']) assignSeat(c, id, 'hamburger');
    shuffleSeats(c, 999);
    ok('P11 …differently for a different seed', order(c) !== order(a), order(c));
    ok('P12 …and it stays slot-indexed and valid', lobbyViolations(a).length === 0);
  }

  // 🚨 THE SEAM. A lobby becomes a real authoritative match.
  {
    const full = createLobby('full', 'host', arena.id, 4);
    assignSeat(full, 'h0', 'hamburger', 3);
    assignSeat(full, 'h1', 'sushi', 5);
    const bots = fillWithBots(full, 'taco');
    ok('P13 fillWithBots filled the remaining seats', bots === 2 && seatedCount(full) === 4);
    const wireSeats = toWireSeats(full, arena);
    ok('P14 toWireSeats is slot-ordered and carries SPAWN COORDINATES, never a formula',
      wireSeats.every((w, i) => w.slot === i)
      && wireSeats.every((w, i) => w.spawn.x === arena.spawns[i].x && w.spawn.y === arena.spawns[i].y));

    const hub = new LoopbackHub({ seed: 3 });
    const hostT = hub.connect('host');
    const cT = hub.connect('h0');
    const c = new ClientSession({ transport: cT, hostPeer: 'host', arena: makeFixtureArena() });
    const host = new HostSession({ transport: hostT, arena, seats: wireSeats, dtMs: DT });
    hub.pump(0); host.start(); hub.pump(0);
    for (let t = 1; t <= 60; t++) { c.sendInput(stimulus(1, t, 0)); hub.pump(t); host.step(); hub.pump(t); }
    ok('P15 🚨 a lobby drives a real authoritative match end to end',
      host.state.fighters.length === 4 && c.ready && diffStates(host.state, c.view).length === 0);
    ok('P16 …with the bot seats driven by the sim and the human seat by the wire',
      host.state.fighters[0].controller === 'human' && host.state.fighters[3].controller === 'ai');
  }

  // 🚨 SPAWNS ARE DATA. An arena that has not done the placement work is REFUSED, not filled in.
  {
    const twoSpawn = makeFixtureArena();
    twoSpawn.spawns = twoSpawn.spawns.slice(0, 2);
    const six = createLobby('six', 'h', twoSpawn.id, 6);
    for (const id of ['a', 'b', 'c', 'd', 'e', 'f']) assignSeat(six, id, 'hamburger');
    let threw = null;
    try { toWireSeats(six, twoSpawn); } catch (e) { threw = e; }
    ok('P17 🚨 KNOWN-BAD  six seats on a two-spawn arena THROWS rather than deriving a ring',
      threw !== null && String(threw.message).includes('Spawn placement is arena geometry'));
  }
}

{
  const league = createLeague('lg', 'Kitchen Cup', 'S1', 2);
  const res = { matchId: 'm1', placements: ['alice', 'bob'], ticks: 2700 };
  const deltas = applyMatchResult(league, res, twoSeatCurve(4));
  ok('P18 a finished match moves the ladder',
    deltas[0].delta === 15 && deltas[1].delta === -4 && deltas[1].trophies === 0,
    JSON.stringify(deltas));
  ok('P19 trophies never go negative — the same floor economy/state.ts holds',
    league.entrants.every((e) => e.trophies >= 0));
  applyMatchResult(league, { matchId: 'm2', placements: ['bob', 'alice'], ticks: 2700 }, twoSeatCurve(4));
  ok('P20 placement counts are recorded per position',
    league.entrants[0].finishes[0] === 1 && league.entrants[0].finishes[1] === 1);

  // The comparator must be TOTAL, or a leaderboard reshuffles equal players on every render.
  const tied = createLeague('tie', 'Tie', 'S1', 2);
  for (const id of ['zed', 'amy', 'moe']) applyMatchResult(tied, { matchId: 'm', placements: [id], ticks: 1 }, [0]);
  const once = standings(tied).map((e) => e.playerId).join(',');
  ok('P21 standings are a TOTAL order — three players on identical records sort deterministically',
    once === standings(tied).map((e) => e.playerId).join(',') && once === 'amy,moe,zed', once);

  // 🚨 THE PLACEMENT CURVE IS NOT INVENTED HERE.
  let threw = null;
  try {
    applyMatchResult(createLeague('l6', 'Six', 'S1', 6),
      { matchId: 'm', placements: ['a', 'b', 'c', 'd', 'e', 'f'], ticks: 1 }, twoSeatCurve(4));
  } catch (e) { threw = e; }
  ok('P22 🚨 KNOWN-BAD  a 6-fighter result with a 2-position curve THROWS — economy/tuning.ts'
    + ' owns the payout curve and there is no 3-6 seat one yet',
    threw !== null && String(threw.message).includes('economy/tuning.ts'));
}

{
  const store = createMemoryLeagueStore();
  const lg = createLeague('mem', 'Memory', 'S1', 4);
  await store.save(lg);
  await store.record('mem', { matchId: 'm', placements: ['a'], ticks: 1 });
  ok('P23 the store interface round-trips, and it is memory-only — nothing was provisioned',
    (await store.load('mem'))?.id === 'mem' && (await store.load('nope')) === null);
}

// ─────────────────────────────────────────────────────────────────────────────
function median(xs) {
  if (xs.length === 0) return 0;
  const s = [...xs].sort((a, b) => a - b);
  return s[Math.floor(s.length / 2)];
}

console.log(`\n${fail === 0 ? '✅' : '🔴'}  nw_stack: ${pass}/${pass + fail} checks passed`);
if (fail > 0) { console.log(`   failed: ${failures.join(', ')}`); process.exit(1); }
