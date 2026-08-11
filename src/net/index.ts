/**
 * MULTIPLAYER INFRASTRUCTURE — the barrel, and the map of what is here.
 *
 * `DECISIONS §52`, decided 2026-08-11: **authoritative simulation with local prediction, built
 * as a HOST PEER first and moved to a Node process later without touching `src/game/`.**
 * Nothing in this directory imports Three.js, the DOM or anything under `src/render`,
 * `src/ui` or `src/audio`; `host.ts` in particular is already a dedicated server that happens
 * to be running in a tab.
 *
 * | file | what it owns |
 * |---|---|
 * | `wire.ts` | the state format. One alias-aware walker; encode / decode / clone. |
 * | `inputCodec.ts` | 7 B/seat input frames, and the rule that the quantised value IS the input. |
 * | `protocol.ts` | the message union, versions, and connect-to-nothing config. |
 * | `transport.ts` | the seam, plus a deterministic, serialising, pumped loopback. |
 * | `host.ts` | the authoritative peer. The only caller of `stepMatch` that matters. |
 * | `client.ts` | prediction + reconciliation. Never emits an event. |
 * | `lobby.ts` | lobbies and leagues as pure data. No service, no storage, no keys. |
 *
 * **`src/game/` is untouched.** That was the constraint and it held: the sim already took one
 * input per slot (`MatchInputs`), already kept fighters in a slot-ordered array, and already
 * refused to invent a spawn. Nothing here needed a signature changed.
 *
 * ⚠️ **WHAT THIS IS NOT.** It is infrastructure, not a shipped netcode. There is no real
 * transport, no signalling, no server, no delta compression and no interpolation of remote
 * fighters. `tools/tmp/nw_stack.mjs` states exactly which claims the loopback can and cannot
 * carry; read that before quoting any of this as "multiplayer works".
 */

export {
  WIRE_VERSION,
  WireError,
  arenaFingerprint,
  arenaRegistry,
  canonicalJson,
  checkStateIntegrity,
  cloneMatchState,
  decodeMatchState,
  diffStates,
  encodeMatchState,
  refTopology,
  type ArenaRegistry,
  type Json,
  type Violation,
  type WireState,
} from './wire.ts';

export {
  INPUT_HEADER_BYTES,
  INPUT_SEAT_BYTES,
  MAX_WEAPON_INDEX,
  b64ToBytes,
  bytesToB64,
  decodeInputFrame,
  encodeInputFrame,
  neutralInput,
  quantizeInput,
  type DecodedInputFrame,
} from './inputCodec.ts';

export {
  NET_CONFIG_DEFAULTS,
  PROTOCOL_VERSION,
  readNetConfig,
  type LobbyStatus,
  type NetConfig,
  type NetMessage,
  type PeerId,
  type RejectCode,
  type Slot,
  type WireSeat,
} from './protocol.ts';

export {
  DEFAULT_LINK,
  LoopbackHub,
  type Framing,
  type LinkConditions,
  type LoopbackHubOptions,
  type MessageHandler,
  type PeerHandler,
  type Transport,
} from './transport.ts';

export {
  DELTA_VERSION,
  DeltaError,
  canonicaliseWire,
  deltaBytes,
  deltaOpCount,
  diffWire,
  patchWire,
  wirePathTable,
  type WireDelta,
} from './delta.ts';

export { HostSession, type AppliedTick, type HostSessionOptions } from './host.ts';
export { ClientSession, type ClientSessionOptions, type ReconcileReport } from './client.ts';

export {
  applyMatchResult,
  assignSeat,
  createLeague,
  createLobby,
  createMemoryLeagueStore,
  enterLeague,
  fillWithBots,
  allReady,
  lobbyViolations,
  releaseSeat,
  seatedCount,
  setReady,
  shuffleSeats,
  standings,
  toWireSeats,
  placementCurve,
  type League,
  type LeagueEntrant,
  type LeagueMatchResult,
  type LeagueStore,
  type Lobby,
  type LobbySeat,
  type PlacementCurve,
} from './lobby.ts';
