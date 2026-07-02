# Changelog

All notable changes to MODULO: SURVIVE are documented here. The format follows
[Keep a Changelog](https://keepachangelog.com/en/1.1.0/); versions follow SemVer.

## [Unreleased]

## [0.1.0] — 2026-07-02

### Added
- Phase‑1 design bible: game design, technical architecture, worldgen spec, lore,
  networking design, verification & roadmap (`docs/`).
- Infinite chunked worlds (16×512-tile columns per chunk, worker-generated) with
  continental/erosion/ridge terrain shaping, seven surface biomes, cave systems,
  underground lakes, lava depths, ores, crystal caverns, ruins, camps, laboratories,
  treasure vaults, underground cities and floating islands.
- Eight playable survivors (Robin, Leif, Jovan, Leonidas, Erim, Till, Lenni, Tusya) with
  balanced early-game traits.
- Mining, building (blocks, walls, platforms, doors, torches, furniture, paint), tool tiers.
- Inventory, hotbar, data-driven crafting across seven station types, natural recipe
  discovery.
- Survival systems: health/mana/stamina, hunger, temperature, fall damage, drowning,
  status effects.
- Combat: directional melee, bows/projectiles, magic, summons, crits, dodge roll,
  knockback; twelve enemy AI archetypes with 100+ enemy variants; night pressure.
- Boss framework with multi-phase encounters (Warden of the First Modulus, Chronophage,
  Null Sovereign and dimension bosses).
- Eight dimensions (Overworld, Ancient, Crystal, Frozen, Molten, Machine, Sky, Void) with
  constructible portals, exclusive materials, palettes, weather, music and bosses.
- NPCs with housing validation, happiness, shops, dialogue and quests; farming; machines.
- World events: Meteor Shower, Crimson Static, Umbral Veil, storms, earthquakes,
  dimensional incursions.
- Day/night cycle, dynamic weather, per-chunk BFS lighting with soft shadows, parallax
  skies, particles, screen shake.
- Fully procedural pixel-art atlas + entity sprites and procedural WebAudio SFX/music —
  zero binary assets in the repository.
- IndexedDB save system (characters, worlds, RLE chunk diffs) with autosave and
  versioned format.
- React UI: menus, character/world selection, HUD, inventory/crafting, map, quest log,
  settings with key rebinding, gamepad and touch support.
- Tooling: Vite 6, strict TypeScript, ESLint 9, Vitest suites, GitHub Actions CI,
  Vercel deployment config.
