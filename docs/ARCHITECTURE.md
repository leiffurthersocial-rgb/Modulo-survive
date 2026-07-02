# MODULO: SURVIVE — Technical Architecture

> Phase‑1 planning artifact, written before implementation and kept as the source of truth.

## 1. Stack Decision

| Concern | Choice | Rationale |
|---|---|---|
| Language | **TypeScript (strict)** | type-safe data-driven content, refactorable at scale |
| Bundler/dev | **Vite 6** | instant HMR, native worker bundling, tiny config, Vercel-native |
| Game rendering | **PixiJS 8 (WebGL)** | batched sprite rendering, blend modes for lighting, mature |
| UI layer | **React 18** | menus/HUD/inventory as declarative components over the canvas |
| Simulation threads | **Web Workers** | world generation off the main thread |
| Persistence | **IndexedDB** | large binary chunk storage, async, quota-friendly |
| Audio | **WebAudio** | fully procedural SFX/music — zero binary assets |
| Tests | **Vitest** | fast, shares Vite pipeline |
| Lint | **ESLint 9 + typescript-eslint** | flat config |
| CI/CD | **GitHub Actions + Vercel** | lint→typecheck→test→build on every push; static deploy |

Why not a full ECS library? The simulation uses an **entity–system hybrid**: entities are flat
records with hot fields inline (`x, y, vx, vy, hp…`) plus a typed `kind` and per-kind data bag;
systems are pure functions iterating entity arrays. This gives ECS-style data/logic separation
and cache-friendly iteration without archetype bookkeeping overhead — measured as the right
trade-off for a few hundred live entities. The pattern is isolated behind `game/entities.ts`
so a structural ECS can be swapped in if entity counts grow 10×.

## 2. Module Map (dependency-ordered, no cycles)

```
src/
  core/        zero-dependency utilities
    math.ts        vectors, AABB, interpolation, easing
    rng.ts         seeded PRNG (sfc32 + hash), fork-able streams
    noise.ts       value/simplex-style 2D noise + fBm + ridged, seeded
    rle.ts         RLE codec for chunk arrays (save format)
    events.ts      typed EventBus (also the future network boundary)
  data/        declarative content (imports core only)
    constants.ts   tile size, chunk size, world height, physics constants
    types.ts       shared content interfaces (BlockDef, ItemDef, EnemyDef…)
    blocks.ts      block registry (200+ defs, id = registration order)
    items.ts       item registry (250+ defs: tools/weapons/armor/potions/food…)
    recipes.ts     crafting recipes per station
    enemies.ts     enemy defs: AI archetype + stats + drops + spawn rules
    characters.ts  the 8 playable survivors
    npcs.ts        NPC defs: dialogue, shops, quests, schedules
    dimensions.ts  dimension defs: palettes, biome sets, gen params, music keys
    quests.ts      milestone quest chain
  world/       world state + generation (imports data, core)
    chunk.ts       typed-array chunk storage, dirty tracking
    world.ts       chunk lifecycle, tile API, block break/place rules
    liquids.ts     cellular water/lava simulation
    lighting.ts    per-chunk BFS light propagation (sky + emissive)
    gen/
      generator.ts pure chunk generation (shared by worker & tests)
      structures.ts deterministic multi-chunk structure rasterization
      worker.ts    Web Worker wrapper around generator
  game/        simulation (imports world, data, core)
    entities.ts    entity model, pools, spatial queries
    inventory.ts   stacks, slots, transfer logic
    player.ts      movement, tools, use-item state machine
    combat.ts      melee arcs, damage/crit/knockback, status effects
    projectiles.ts arrows/bolts/enemy shots
    ai.ts          the 12 AI archetype behaviors
    spawner.ts     biome/depth/night/event spawn budgeting
    bosses.ts      boss FSM framework + boss encounters
    npcAI.ts       housing validation, schedules, happiness
    farming.ts     tilled soil, crop growth ticks
    machines.ts    generator/extractor/sprinkler/teleport-anchor logic
    worldEvents.ts meteor shower, Crimson Static, Umbral Veil, storms…
    portals.ts     portal frame detection + dimension travel
    game.ts        orchestrator: fixed-step sim loop, save/load glue
  render/      presentation (imports game read-only)
    textures.ts    procedural pixel-art atlas baked at boot
    sprites.ts     procedural entity sprite/animation generation
    chunkView.ts   per-chunk baked canvas textures (tiles/walls/liquid/light)
    background.ts  sky gradient, sun/moon, stars, clouds, parallax layers
    particles.ts   pooled particle renderer
    weather.ts     rain/snow/sandstorm/fog overlays
    renderer.ts    Pixi app, layer tree, camera, screen shake, zoom
  audio/
    engine.ts      WebAudio graph, buses, positional panning
    sfx.ts         synthesized effect presets
    music.ts       generative chiptune sequencer per dimension/time
  save/
    storage.ts     StorageAdapter interface + IndexedDB + in-memory impls
    saves.ts       world/character serialization, autosave policy
  input/
    input.ts       action mapping, rebinding, keyboard/mouse
    gamepad.ts     Gamepad API polling → actions
    touch.ts       virtual joystick + buttons → actions
  ui/          React (talks to game only via store + command bus)
    store.ts       minimal external store (useSyncExternalStore)
    App.tsx        screen router
    components/…   HUD, Inventory, Crafting, Map, Quests, Settings, Menus…
  main.tsx     bootstrap
```

**Dependency rule:** `core ← data ← world ← game ← render/audio/ui`. UI never imports game
internals directly; it reads a published store snapshot and issues commands. This boundary is
also the future network protocol boundary (see NETWORKING.md).

## 3. Simulation Loop

Fixed-step simulation at **60 Hz** decoupled from rendering (rAF, up to 144 Hz):

```
accumulator += dt
while accumulator >= STEP:  simulate(STEP)   // deterministic order:
    input → player → AI → physics → projectiles → combat → status
    → liquids (budgeted) → farming/machines (tick-sliced) → spawner
    → world events → npc → portals → cleanup
render(alpha)                                  // interpolated positions
```

Determinism matters for future netcode: the sim never reads wall-clock time or `Math.random`
— all randomness flows through seeded RNG streams.

## 4. World Representation

- Tile = 16 px. Chunk = 32×32 tiles. World height = 512 tiles (16 chunk rows), infinite X.
- Chunk storage: `Uint16Array` foreground, `Uint16Array` walls, `Uint8Array` liquid amount,
  `Uint8Array` liquid type, `Uint8Array` light (computed), `Uint8Array` explored (map).
- Chunk key: `dim:cx:cy`. Loaded radius follows the camera; unloaded chunks are evicted LRU,
  persisted only if modified.
- Block ids are indices into the block registry; saves store an id→key manifest so registry
  reordering never corrupts saves.

## 5. Rendering Strategy

- **Chunks are baked, not per-tile sprites.** Each loaded chunk owns a 512×512 canvas baked
  from the atlas (walls darkened beneath), uploaded once as a texture and re-baked only on
  block change. Visible chunks ≈ 12 → ~12 quads for the whole terrain.
- **Lighting** is a per-chunk 33×33 low-res canvas (1 px/tile + border) filled with
  `skylight ⊕ emissive` BFS values tinted by time-of-day, scaled ×16 with bilinear filtering
  and drawn with `multiply` blend — soft shadows for free. Light rebakes are dirty-flagged
  and budgeted per frame.
- **Layer tree:** sky → parallax (3 procedural strata) → walls → tiles → liquid overlay →
  entities → particles → light multiply → weather → world-space text (damage numbers).
- **Camera:** smoothed follow with look-ahead, zoom, trauma-based screen shake.
- All textures live in one procedurally baked atlas (nearest-neighbor, pixel-perfect).

## 6. Procedural Asset Pipeline (zero binary assets)

The repository ships **no image or audio binaries**; everything is generated at boot in <100 ms:

- **Block atlas:** every block def declares a base color + *pattern style* (soil, stone,
  brick, plank, ore-on-stone, crystal, sand, foliage, liquid…). A seeded painter renders
  16×16 tiles with dithering, edge shading and per-id speckle so families look cohesive.
- **Entity sprites:** body-plan generators (humanoid, blob, flyer, quadruped, worm, turret…)
  take palette + feature params (hair style/color, glasses, goatee, bulk — matching the eight
  survivors' described appearances) and emit multi-frame walk/attack animations.
- **Audio:** SFX are synthesized envelopes (noise/osc); music is a generative chiptune
  sequencer fed per-dimension scale/tempo/timbre parameters.

Benefits: no licensing risk, tiny bundle, infinite variants; art direction is enforced by a
single global palette ramp function.

## 7. Save System

`StorageAdapter { get, put, delete, keys }` with IndexedDB (runtime) and Map (tests/SSR)
implementations — the seam for future cloud sync. Object stores: `characters`, `worlds`
(meta: seed, time, flags, weather, NPCs, player state), `chunks` (RLE-encoded diffs, keyed
`world/dim/cx/cy`), `map` (explored bits). Autosave: every 60 s, on `visibilitychange`, on
quit-to-menu. Saves are versioned (`saveVersion`) with a migration hook.

## 8. Optimization Playbook

| Technique | Where |
|---|---|
| Worker-threaded generation | `world/gen/worker.ts`; main thread never generates |
| Chunk texture baking | 1 draw per chunk instead of 1024 sprites |
| Budgeted lighting | dirty chunks re-lit max N per frame, day-factor quantized |
| Liquid simulation slicing | active-cell set, budgeted per step |
| Entity + particle pooling | `entities.ts`, `particles.ts` |
| Spatial hashing | entity collision queries |
| Culling | chunks and entities outside camera + margin skipped |
| Texture atlas + batching | single base texture for all tiles/items |
| React isolation | game state changes never re-render React except HUD snapshots @ 10 Hz |
| Lazy systems | farming/machines tick-sliced across frames |

Budget: sim ≤ 4 ms, render ≤ 4 ms at 60 FPS on a 2019 laptop; frame-time HUD in settings.

## 9. Error Handling & Quality Gates

- Boot-time registry validation (recipes reference real items, drops reference real ids…)
  fails loudly in dev and in a dedicated unit test.
- CI: `lint → typecheck → test → build` on every push (`.github/workflows/ci.yml`).
- Vitest suites cover: RNG/noise determinism, chunk RLE roundtrip, worldgen reproducibility,
  inventory/crafting invariants, combat math, lighting monotonicity, liquid conservation,
  save/load roundtrip, registry referential integrity.
