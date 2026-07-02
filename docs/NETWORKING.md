# MODULO: SURVIVE — Networking Design (future capability)

> Multiplayer is **designed-for, not shipped** in v0.1. This document specifies the model and
> the architectural affordances already present so co-op can land without a rewrite.

## Model: authoritative host, deterministic worldgen

- **Topology:** 2–8 players; one authoritative simulation (dedicated Node host or
  host-player). Transport: WebSocket baseline, WebRTC DataChannel upgrade for P2P.
- **World transfer is nearly free:** worldgen is a pure function of `(seed, dim, cx, cy)`;
  clients generate chunks locally and the host sends only **chunk diffs** (the same RLE
  format the save system already writes) plus a modification log for loaded chunks.
- **State sync:** host streams entity snapshots @ 20 Hz within each client's interest radius
  (chunk-based interest management already exists as the chunk load radius). Clients
  interpolate 100 ms behind and predict their own player from the shared fixed-step
  simulation, reconciling on authoritative corrections.
- **Input protocol:** clients send *intents* (the existing `input → action` layer output),
  never positions. The `EventBus` message types in `core/events.ts` are the wire schema.

## Affordances already built into v0.1

1. **Fixed-step, seeded simulation** — no wall-clock or `Math.random` in the sim path; a
   host and client stepping the same inputs agree.
2. **UI/game command boundary** — React issues serializable commands; replacing the local
   dispatcher with a socket writer is a one-file change.
3. **Chunk diff serialization** — save format doubles as the network chunk format.
4. **Storage adapter seam** — cloud persistence for hosted worlds plugs in behind
   `StorageAdapter` without touching game code.

## Sequencing plan

1. Extract host loop into a headless entry (`game/game.ts` already renders nothing).
2. Add `net/` package: transport, snapshot codec (delta-compressed typed arrays), clock sync.
3. Interest management + entity ownership (player-owned projectiles fire client-side
   immediately, host validates).
4. Conflict rules: block edits are host-ordered; chests use host-side locking.
5. Anti-cheat posture: server-authoritative inventory and damage; clients render only.
