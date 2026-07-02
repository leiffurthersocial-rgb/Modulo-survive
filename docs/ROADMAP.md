# MODULO: SURVIVE — Design Verification, Risk Review & Roadmap

> Phase‑1 closing artifact: the design from DESIGN/ARCHITECTURE/WORLDGEN was reviewed for
> weaknesses **before implementation**; each weakness below records its mitigation. This file
> also tracks the milestone plan.

## Design Verification Pass

| # | Weakness found | Mitigation adopted |
|---|---|---|
| 1 | Per-tile sprites would collapse FPS at 32×32×12 visible chunks | Bake each chunk to one texture; re-bake only on edit (§Rendering) |
| 2 | Biome-driven terrain height causes ugly seams at biome borders | Terrain shape comes from continuous macro-noise only; biomes select materials, never height |
| 3 | Multi-chunk structures need cross-chunk communication → worker races | Region-seeded structures rasterized per overlapping chunk from the same deterministic seed |
| 4 | Full-world lighting recompute is O(world) per time-of-day change | Quantize day factor (32 buckets); per-chunk dirty flags; budgeted re-lights per frame |
| 5 | Liquid simulation can flood the CPU in ocean-scale pools | Active-cell set with per-step budget + settle-to-sleep |
| 6 | React re-rendering on 60 Hz game state would stall | UI reads a snapshot store throttled to 10 Hz; HUD numbers only; canvas untouched by React |
| 7 | Registry ids in saves break when content is reordered | Saves carry an id→key manifest; loader remaps ids |
| 8 | "Hundreds of items/blocks" risks placeholder junk | Content is generated from material×form matrices (real recipes, tools, tiers) so every entry is functional |
| 9 | Shipping binary art/audio assets bloats repo and risks incoherent style | 100 % procedural asset pipeline with one palette ramp; enforced cohesion |
| 10 | Worker + IndexedDB untestable in CI | Generator is a pure function tested directly; storage behind adapter with in-memory impl |
| 11 | Character traits could unbalance mid-game | Traits capped at 10–25 % early-game multipliers, no exclusive content |
| 12 | Scope: 8 dimensions × full content in one release | Dimensions share one parameterized generator + shared boss framework; per-dimension cost is data, not code |

## Milestones

- **M0 — Foundation** ✅ planned: repo, CI, Vercel, docs, toolchain.
- **M1 — World**: chunks, worker generation, rendering, lighting, day/night, parallax.
- **M2 — Player**: movement, mining/building, inventory, crafting, tools, survival meters.
- **M3 — Danger**: enemies, combat, projectiles, status effects, spawner, night pressure.
- **M4 — Persistence**: saves, autosave, character/world selection screens.
- **M5 — Depth**: NPCs, farming, machines, quests, world events, weather.
- **M6 — Dimensions & Bosses**: portals, 8 dimensions, boss framework + encounters.
- **M7 — Polish**: audio, particles, settings, touch/gamepad, map, accessibility, perf pass.

## Post-v0.1 Backlog

- Co-op multiplayer per [NETWORKING.md](./NETWORKING.md)
- Wiring/logic gates layer for machines; rail transport
- Fishing, weather-locked rare creatures, seasonal events
- Enchanting depth (affix rerolling), artifact sets
- Cloud save sync + shareable world seeds gallery
- Mod API: JSON content packs loaded at boot (registry already data-driven)
