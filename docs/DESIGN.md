# MODULO: SURVIVE — Game Design Document

> Phase‑1 planning artifact. Written **before** any implementation code, per the project charter.
> Companion documents: [ARCHITECTURE.md](./ARCHITECTURE.md), [WORLDGEN.md](./WORLDGEN.md),
> [LORE.md](./LORE.md), [NETWORKING.md](./NETWORKING.md), [ROADMAP.md](./ROADMAP.md).

---

## 1. Vision

**MODULO: SURVIVE** is an original 2D sandbox survival game. You wake on the surface of a
*modular* world — a reality assembled from repeating mathematical strata that drifted out of
alignment. Every world is infinite, generated from a seed, and layered with biomes, cave
systems, ruins of the Modular civilization, and portals into seven parallel **dimensions**.
The loop is classic sandbox survival — *explore → gather → craft → build → fight → progress* —
but the identity is its own: modular ruins, resonance technology, dimension engineering, and a
cast of eight survivors with distinct traits.

Design pillars:

1. **The world is the antagonist.** Weather, temperature, hunger, night creatures and world
   events pressure the player constantly; shelter and preparation matter.
2. **Every seed tells a different story.** Generation favors landmark variety (ruins, labs,
   floating islands, underground cities) over uniform noise.
3. **Progression through dimensions.** Each dimension gates exclusive materials, enemies,
   recipes and a boss; portals are built, not found.
4. **Data over code.** Blocks, items, recipes, enemies, quests, dimensions are declarative
   data; systems interpret them. Content scales without new engine code.
5. **Instant play.** Browser-native, no install, 60+ FPS on modest hardware, autosaving.

## 2. The Core Loop

```
   explore ──► gather ──► craft ──► build/base ──► fight ──► boss ──► unlock dimension ─┐
      ▲                                                                                 │
      └─────────────────────────────── new materials/recipes/threats ◄─────────────────┘
```

Minute-to-minute: mine and place blocks, manage light and temperature, dodge and counter
enemies, and keep food up. Session-to-session: expand the base, house NPCs, farm, take on
world events, summon bosses, and open the next dimension.

## 3. Player Characters

The player chooses one of eight survivors before entering a world. All are male; traits shape
the **early game only** and stay balanced (≈ +10–20 % in their specialty, no exclusive content).

| Character | Appearance | Trait | Bonuses |
|---|---|---|---|
| **Robin** | blonde, brown eyes, white shirt, short textured hair | Builder | +15 % building speed, +15 % crafting speed |
| **Leif** | brown medium textured hair, gray eyes, black shirt | Hunter | +15 % bow damage, tracking (enemies pinged on map), +5 % crit chance |
| **Jovan** | taller, brown hair, brown eyes, white shirt, medium textured hair | Explorer | +12 % move speed, wall-climb grip, +25 % vision radius |
| **Leonidas** | shorter, very muscular, styled brown hair, brown eyes | Warrior | +15 % melee damage, +20 max HP, +2 defense |
| **Erim** | medium black hair, black goatee, glasses, brown eyes | Engineer | machines 25 % faster, cheaper electronics recipes |
| **Till** | blonde, blue eyes, short hair | Gatherer | +20 % mining/woodcutting speed, +10 % resource yield |
| **Lenni** | brown middle-part hair, glasses, brown eyes, dark green shirt | Scholar | +20 % research (recipe discovery), −10 % mana costs, −10 % crafting material waste |
| **Tusya** | brown skin, black hair, brown eyes | Merchant | 15 % better shop prices, +10 % loot rolls, starts with extra coins |

Characters are saved independently of worlds (a character can visit any world).

## 4. Survival Systems

- **Health** (hearts), **Mana** (magic), **Stamina** (sprint/dodge/climb).
- **Hunger** 0–100: drains slowly; < 30 stops natural regen; < 10 drains HP. Food restores
  hunger and grants buffs (cooked > raw).
- **Temperature**: ambient value from biome + depth + time + weather. Extremes apply
  **Freezing** (slow, HP drain) or **Scorching** (stamina drain, HP drain). Counters:
  campfires, torches, armor, potions, appropriate clothing.
- **Status effects**: Poison, Burning, Freezing, Bleeding, Slow, Weak, Regeneration, Haste,
  Ironhide, Nightvision, Featherfall… all data-driven with duration + tick behavior.
- **Fall damage** above a velocity threshold (cancelled by water, Featherfall).
- **Breath** meter underwater; drowning damage.
- **Death**: drop a coin fraction, respawn at spawn/bed. Worlds persist.

## 5. World & Biomes (Overworld)

Infinite horizontally, 512 tiles deep, five vertical strata: **Sky → Surface → Underground →
Cavern → Deep (magma)**. Surface biomes: **Meadow, Forest, Dense Jungle, Desert, Snowfields,
Mountains, Volcanic Wastes**; underground biomes: **Crystal Caverns, Fungal Hollows, Deep
City**. Landmarks: ruins, abandoned camps, hidden laboratories, treasure vaults, underground
cities, floating islands, ancient obelisks. Full generation spec: [WORLDGEN.md](./WORLDGEN.md).

**Day/night**: 24-minute day cycle; night spawns are stronger and more numerous.
**Weather**: clear, wind, rain, storm (lightning), snow, sandstorm, fog — biome-gated.

### World Events (original equivalents)

| Event | Trigger | Effect |
|---|---|---|
| **Meteor Shower** | random night | meteors streak and impact, leaving *Meteoric Core* ore |
| **Crimson Static** (blood-moon analog) | random night, post-first-boss | red static sky, ×4 spawns, unique drops, NPCs hide |
| **Umbral Veil** (eclipse analog) | random day, post-Warden | daylight fades to violet dusk; elite daytime spawns |
| **Storm** | weather roll | rain + wind + lightning strikes that can ignite/energize |
| **Earthquake** | rare | screen shake, dust, loose gravel falls in caves |
| **Dimensional Incursion** | after a portal is opened | rifts spawn that dimension's enemies in the overworld |
| **Wandering Colossus** | very rare | a roaming mini-boss crosses the map with high-tier loot |

## 6. Dimensions

Portals are **constructed**: a 4×5 frame of dimension-keyed frame blocks + an **Attunement
Core** (crafted). Each dimension is a fully procedural infinite world with exclusive terrain,
blocks, enemies, weather, lighting, music, resources and a boss.

| Dimension | Identity | Exclusive metal/resource | Boss |
|---|---|---|---|
| **Ancient** | ochre ruins, dust storms, buried vaults | Relictium | Warden of the First Modulus |
| **Crystal** | refractive caverns, prism light | Prismite | The Refractor |
| **Frozen** | permafrost, aurora nights | Cryostal | Borea, the Stilled Heart |
| **Molten** | basalt seas, ashfall | Magmite | Pyraxis the Undermelt |
| **Machine** | rusted megastructures, sparks | Ferrox | F4BR-1K, Foundry Tyrant |
| **Sky** | island archipelagos, gales | Auralite | The Zephyr Court |
| **Void** | inverted gravity wells, silence | Voidglass | The Null Sovereign |

Progression order is soft-gated by portal recipe ingredients (each dimension's loot feeds the
next portal), not hard-locked.

## 7. Building

Foreground blocks, background walls, platforms (one-way), stairs/slopes (45°), ropes, bridges,
doors, windows/glass, paint (dye any block's hue), light sources, furniture (tables, chairs,
beds, storage chests, crafting stations, decorations), and machines. Smart placement rules
(attachment checks), block hardness vs. tool tiers, and instant visual feedback (cracks,
particles, sound).

## 8. Crafting & Stations

Stations: **Workbench → Forge → Kitchen → Alchemy Bench → Engineering Table → Enchanting
Altar → Fabricator** (late-game). Recipes are data (`inputs → output @ station`), discovered
naturally: a recipe is revealed once the player has *seen* each ingredient. The crafting UI
shows craftable-now first, in-range stations detected automatically.

Material tiers: Wood → Stone → Copper → Iron → Steel → Meteoric → (7 dimension metals).
Each tier: tools (pick, axe, hoe), weapons (sword, spear, bow, wand), armor (head/chest/legs).

## 9. Combat

- **Directional melee**: swing arcs aimed at the cursor; spears thrust; hit-stop + knockback.
- **Ranged**: bows (arrow physics, gravity), throwing weapons, machine guns (late).
- **Magic**: wands/tomes with mana costs — bolts, homing shards, ground flames, frost novas.
- **Summons**: minion companions that fight autonomously (capped by summon slots).
- **Crits**: chance-based ×1.8, floating damage numbers.
- **Dodge roll**: stamina-costed dash with i-frames.
- **Defense formula**: `damage_taken = max(1, dmg − defense/2)`.
- **Enemy AI archetypes**: walker, hopper, flyer, diver, floater (through walls at night),
  caster, charger, spitter, burrower, swimmer, turret, worm-segment — parameterized per enemy.

## 10. Bosses

Multi-phase FSM bosses with arena mechanics, telegraphs, summons and exclusive drops. Each
kill sets a **progression flag** that unlocks recipes/NPCs/events. Flagship encounters:

1. **Warden of the First Modulus** (summon: Resonant Sigil) — stone colossus; P1 slam/boulder
   toss; P2 (≤50 %) enrage, seismic waves, spawns Shardlings.
2. **Chronophage** (appears during Umbral Veil, or summoned) — time-eater; dash weave,
   clock-shard bullets; P2 slows projectiles/players in zones.
3. **The Null Sovereign** (Void altar) — teleport volleys, void rifts, radial bullet finale.
4. One themed boss per remaining dimension (see table above), sharing the boss framework.

## 11. NPCs

Rescued/attracted NPCs move into **valid housing** (enclosed room, door, light, table+chair,
bed). Happiness derives from biome preference + crowding and adjusts shop prices. NPCs have
daily schedules (wander by day, home at night, hide during events), dialogue pools, shops and
**quests** (fetch/kill/explore with rewards). Launch cast: **Ordo the Merchant, Vessa the
Herbalist, Brann the Tinker, Kael the Nomad** (+ per-dimension visitors planned).

## 12. Farming

Hoe tills soil; plant seeds (Amberkorn, Rootstalk, Berrybush, Glowfruit, Frostcap, Emberpod);
growth in stages via world ticks, faster near Sprinklers; harvest feeds Kitchen recipes that
grant the strongest food buffs.

## 13. Machines (Engineering)

Generator (radius power) → powers: Extractor (slow ore yield on veins), Sprinkler, Arc Lamp,
Teleport Anchors (paired), Conveyor (item drift), Auto-Hammer (crafting speed aura). Engineer
trait boosts machine speed. Machines are placeable furniture-class blocks with tick logic.

## 14. Economy & Loot

Coins drop from enemies/quests/treasure; loot tables are data-driven with rarity tiers
(Common → Uncommon → Rare → Epic → Mythic) and biome/dimension pools. Merchant trait and NPC
happiness modify prices.

## 15. UI/UX

Minimal, modern, readable pixel-UI: main menu → character select/create → world select/create
(seed input) → play. HUD: hearts, mana, stamina, hunger, temperature dial, hotbar (10),
buff icons, clock/compass, boss bar, event banners. Panels: inventory (40 + armor +
accessories), crafting, chests, map (fog-of-war explored map), quest log, NPC dialogue/shop,
settings (graphics/audio/controls/accessibility, key rebinding, gamepad, touch). Full
keyboard/mouse, gamepad, and mobile touch layouts.

## 16. Audio

Procedural WebAudio engine — no binary assets: synthesized SFX (dig/place/swing/shoot/hurt/
pickup/portal/thunder/roar…), generative chiptune music keyed to biome/dimension/time with
day/night variants and boss themes, ambient beds (wind, rain, cave drips, birdsong), and
positional panning by world distance.

## 17. Persistence

Characters and worlds saved separately (IndexedDB). Worlds store: meta (seed, time, flags,
weather), player-modified chunk diffs (RLE-compressed), NPC states, map exploration.
Autosave every 60 s + on tab hide + manual save. Architecture is cloud-sync-ready (storage
adapter interface). Unmodified chunks are never stored — they regenerate from the seed.

## 18. Performance Targets

60 FPS baseline / 144 FPS capable on desktop; chunked world streaming; per-chunk baked
tile/light textures; entity pooling; culling; texture atlas; worker-threaded generation;
capped particle budgets. Details in [ARCHITECTURE.md](./ARCHITECTURE.md) §Optimization.
