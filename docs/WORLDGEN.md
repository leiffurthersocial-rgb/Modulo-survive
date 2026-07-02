# MODULO: SURVIVE — World Generation Specification

> Phase‑1 planning artifact. The generator is **pure and deterministic**: `(seed, dimension,
> chunkX, chunkY) → chunk data`, no cross-chunk communication, identical output on worker,
> main thread and test runner.

## 1. Coordinate System

- Tile = 16 px. Chunk = 32×32 tiles. World height = 512 tiles (chunk rows 0–15), X infinite.
- Strata (overworld): Sky `y < surface−40` · Surface `±40` · Underground `to 300` · Cavern
  `to 420` · Deep/magma `to 512`.

## 2. Deterministic Randomness

- Global seed (string → 32-bit hash). Every subsystem *forks* a stream:
  `hash(seed, "cave"), hash(seed, "ore:iron"), hash(seed, cx, cy, "deco")…` so features are
  independent — changing tree placement never reshuffles caves.
- Noise: seeded 2-D gradient-style value noise with fBm (up to 5 octaves) and ridged
  variants, implemented in `core/noise.ts` (no dependencies).

## 3. Column Pass (terrain shape)

For each world column `x`, three continuous low-frequency fields shape terrain — biome
*selection* never moves terrain, which kills seam artifacts:

```
continental = fbm(x · 0.0012)          → base elevation (plains ↔ highlands)
erosion     = fbm(x · 0.004  + φ₁)     → amplitude multiplier (flat ↔ jagged)
ridges      = ridged(x · 0.008 + φ₂)   → mountain peaks where erosion is low
surface(x)  = SURFACE_BASE − continental·46 − ridges·erosionInv·60 + detail·6
```

Climate fields select the biome per column: `temperature = fbm(x·0.0016)`,
`humidity = fbm(x·0.0021)`; a biome table maps (t, h) → biome (desert hot/dry, jungle
hot/wet, snowfields cold, meadow/forest temperate, volcanic = hot extreme + high ridges,
mountains = high elevation override). Biomes control **materials and decoration only**.

## 4. Fill Pass (per tile)

Depth-ordered material selection: air above `surface`; biome topsoil (grass/sand/snow/jungle
sod) for the top 1 tile; subsoil 4–8 tiles; stone below with biome tinting; basalt/deepstone
in the Deep stratum. Background walls mirror the material two tiles below the surface.

**Caves** (subtractive, in order):
1. *Spaghetti*: `|noise2(x·0.02, y·0.03)| < 0.055 + depthBonus` — winding tunnels.
2. *Cheese*: `noise2(x·0.009, y·0.012) > 0.62` below y=surface+40 — chambers.
3. *Worm burrows*: per 4×4-chunk region, deterministic worm walks carved analytically
   (each chunk rasterizes only the segment crossing it).
4. Surface entrances: spaghetti threshold widened near the surface on low-erosion columns.

**Liquids:** cheese chambers below the water table partially fill with water; Deep-stratum
cavities fill with lava; snow biome pockets freeze over (ice sheet).

**Ores** (noise threshold + depth gate + biome bonus): coal, copper, iron, silver, gold,
crystal shards (cavern), meteoric cores (event-placed), + one exclusive metal per dimension.

**Underground biomes:** Crystal Caverns (`noise2(x·0.006,y·0.006)>0.66` in Cavern stratum →
crystal walls, glow flora), Fungal Hollows (Underground stratum, wet columns → mycelium,
glowshrooms).

## 5. Landmark & Structure Pass

Structures use **region-deterministic placement**: a structure candidate is seeded per
region (e.g., every 8×8 chunks rolls once); every chunk overlapping the candidate's bounding
box rasterizes *its slice* from the same seed — multi-chunk buildings need no chunk
cross-talk. Table (overworld):

| Structure | Region | Chance | Stratum | Contents |
|---|---|---|---|---|
| Ruined obelisk | 4×4 | 18 % | surface | lore tablet, loot urn |
| Abandoned camp | 4×4 | 14 % | surface | campfire, tent, supply chest |
| Ancient ruin complex | 8×8 | 30 % | surface/buried | multi-room brick ruin, traps, vault |
| Hidden laboratory | 8×8 | 18 % | underground | machine shells, electronics loot |
| Treasure vault | 8×8 | 22 % | cavern | locked chest ring, rare loot |
| Underground city | 16×16 | 12 % | cavern | streets, houses, forge, mythic chest |
| Floating island | 8×8 | 25 % | sky | earth blob, trees, skyward chest |

Chest contents roll from stratum/biome loot tables with the world seed.

## 6. Decoration Pass

Per-column RNG: trees (biome species, 5 trunk heights, canopy variants, fully inside chunk
margin), grass tufts, flowers, vines (jungle), cacti (desert), icicles (snow), glow flora
(caverns), stalactites, loose boulders. Tree density modulated by humidity.

## 7. Spawn Markers

Generation emits **spawn hints** (surface level per column, cave pockets, structure rooms)
consumed by the runtime spawner; enemies are never baked into chunks.

## 8. Dimension Parameterization

`DimensionDef` overrides: surface base/amplitude curves, biome table, material set, cave
density, liquid types (Molten: lava seas; Frozen: ice sheets; Void: floating shards + no
liquids + inverted skylight; Sky: island blobs replace the column pass entirely; Machine:
rectilinear corridor noise mixed into caves), exclusive ore, structure table, palette,
weather set, music key. The same generator code path serves all eight worlds.

## 9. Why Each Seed Feels Unique

- Three independent macro fields (continental/erosion/ridges) with different phases produce
  qualitatively different skylines (archipelago-of-hills vs. mesas vs. alpine walls).
- Region rolls make landmark constellations differ (a seed might have a surface-visible
  underground city entrance next to spawn; another buries everything).
- Climate field phases shift biome adjacency (jungle-next-to-snow borders are possible but
  rare, gated by a transition smoothing band).

## 10. Verification

Unit tests assert: (a) identical seeds ⇒ byte-identical chunks across 20 random coords;
(b) different seeds ⇒ differing chunks; (c) surface within legal band and grass present in
meadow; (d) cave air ratio within 8–45 % in cavern stratum; (e) structure rasterization is
identical from any overlapping chunk's perspective; (f) every generated id exists in the
block registry.
